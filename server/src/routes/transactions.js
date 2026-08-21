import { Router } from "express";
import { z } from "zod";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { transactions, categories } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { runRecurringCatchUp } from "../lib/recurringCatchUp.js";
import { monthRange, isValidMonth } from "../lib/monthRange.js";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

const createSchema = z.object({
  categoryId: z.string(),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional(),
});

const updateSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.number().positive().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

function toCents(amount) {
  return Math.round(amount * 100);
}

async function assertCategoryOwned(userId, categoryId) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  if (!category) {
    const error = new Error("Catégorie introuvable.");
    error.status = 404;
    throw error;
  }
  return category;
}

function buildFilters(req) {
  const filters = [eq(transactions.userId, req.userId)];
  const { month, categoryId } = req.query;

  if (month) {
    if (!isValidMonth(month)) {
      const error = new Error("Mois invalide (format attendu : YYYY-MM).");
      error.status = 400;
      throw error;
    }
    const { start, end } = monthRange(month);
    filters.push(gte(transactions.date, start), lt(transactions.date, end));
  }

  if (categoryId) filters.push(eq(transactions.categoryId, categoryId));

  return and(...filters);
}

transactionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await runRecurringCatchUp(req.userId);

    const rows = await db
      .select({ transaction: transactions, category: categories })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(buildFilters(req))
      .orderBy(desc(transactions.date), desc(transactions.createdAt));

    res.json(
      rows.map(({ transaction, category }) => ({
        ...transaction,
        amount: transaction.amountCents / 100,
        category,
      })),
    );
  }),
);

transactionsRouter.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    await runRecurringCatchUp(req.userId);

    const rows = await db
      .select({ transaction: transactions, category: categories })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(buildFilters(req))
      .orderBy(desc(transactions.date));

    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["date", "catégorie", "type", "montant", "note"].join(",");
    const lines = rows.map(({ transaction, category }) =>
      [
        transaction.date,
        escape(category.name),
        category.type === "income" ? "revenu" : "dépense",
        (transaction.amountCents / 100).toFixed(2),
        escape(transaction.note),
      ].join(","),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="transactions.csv"');
    res.send([header, ...lines].join("\n"));
  }),
);

transactionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Transaction invalide." });

    await assertCategoryOwned(req.userId, parsed.data.categoryId);

    const [transaction] = await db
      .insert(transactions)
      .values({
        categoryId: parsed.data.categoryId,
        amountCents: toCents(parsed.data.amount),
        date: parsed.data.date,
        note: parsed.data.note,
        userId: req.userId,
      })
      .returning();

    res.status(201).json({ ...transaction, amount: transaction.amountCents / 100 });
  }),
);

async function loadOwnedTransaction(userId, transactionId) {
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return transaction ?? null;
}

transactionsRouter.patch(
  "/:transactionId",
  asyncHandler(async (req, res) => {
    const transaction = await loadOwnedTransaction(req.userId, req.params.transactionId);
    if (!transaction) return res.status(404).json({ error: "Transaction introuvable." });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    if (parsed.data.categoryId) await assertCategoryOwned(req.userId, parsed.data.categoryId);

    const patch = { ...parsed.data };
    if ("amount" in patch) {
      patch.amountCents = toCents(patch.amount);
      delete patch.amount;
    }

    const [updated] = await db
      .update(transactions)
      .set(patch)
      .where(eq(transactions.id, transaction.id))
      .returning();

    res.json({ ...updated, amount: updated.amountCents / 100 });
  }),
);

transactionsRouter.delete(
  "/:transactionId",
  asyncHandler(async (req, res) => {
    const transaction = await loadOwnedTransaction(req.userId, req.params.transactionId);
    if (!transaction) return res.status(404).json({ error: "Transaction introuvable." });

    await db.delete(transactions).where(eq(transactions.id, transaction.id));
    res.status(204).end();
  }),
);
