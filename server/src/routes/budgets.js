import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { budgets, categories } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { isValidMonth } from "../lib/monthRange.js";

export const budgetsRouter = Router();
budgetsRouter.use(requireAuth);

const upsertSchema = z.object({
  categoryId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().positive(),
});

function toCents(amount) {
  return Math.round(amount * 100);
}

budgetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (!month || !isValidMonth(month)) {
      return res.status(400).json({ error: "Paramètre 'month' requis (format YYYY-MM)." });
    }

    const rows = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, req.userId), eq(budgets.month, month)));

    res.json(rows.map((b) => ({ ...b, amount: b.amountCents / 100 })));
  }),
);

// Upsert : un budget est défini par (utilisateur, catégorie, mois). Poser un
// budget pour un mois où il en existe déjà un le remplace simplement.
budgetsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Budget invalide." });

    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.categoryId), eq(categories.userId, req.userId)));
    if (!category) return res.status(404).json({ error: "Catégorie introuvable." });

    const [budget] = await db
      .insert(budgets)
      .values({
        userId: req.userId,
        categoryId: parsed.data.categoryId,
        month: parsed.data.month,
        amountCents: toCents(parsed.data.amount),
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { amountCents: toCents(parsed.data.amount) },
      })
      .returning();

    res.status(201).json({ ...budget, amount: budget.amountCents / 100 });
  }),
);

budgetsRouter.delete(
  "/:budgetId",
  asyncHandler(async (req, res) => {
    const [budget] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, req.params.budgetId), eq(budgets.userId, req.userId)));
    if (!budget) return res.status(404).json({ error: "Budget introuvable." });

    await db.delete(budgets).where(eq(budgets.id, budget.id));
    res.status(204).end();
  }),
);
