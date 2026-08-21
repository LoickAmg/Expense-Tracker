import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { recurringTransactions, categories } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { runRecurringCatchUp } from "../lib/recurringCatchUp.js";

export const recurringRouter = Router();
recurringRouter.use(requireAuth);

const baseSchema = {
  categoryId: z.string(),
  amount: z.number().positive(),
  note: z.string().trim().max(500).optional(),
  frequency: z.enum(["weekly", "monthly"]),
  dayOfPeriod: z.number().int(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean().optional(),
};

const createSchema = z
  .object(baseSchema)
  .refine((data) => (data.frequency === "monthly" ? data.dayOfPeriod >= 1 && data.dayOfPeriod <= 31 : true), {
    message: "Le jour du mois doit être entre 1 et 31.",
  })
  .refine((data) => (data.frequency === "weekly" ? data.dayOfPeriod >= 0 && data.dayOfPeriod <= 6 : true), {
    message: "Le jour de la semaine doit être entre 0 (dimanche) et 6 (samedi).",
  });

const updateSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.number().positive().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
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
}

async function loadOwnedRule(userId, ruleId) {
  const [rule] = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, ruleId), eq(recurringTransactions.userId, userId)));
  return rule ?? null;
}

recurringRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.userId, req.userId));
    res.json(rows.map((r) => ({ ...r, amount: r.amountCents / 100 })));
  }),
);

recurringRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Récurrence invalide." });
    }

    await assertCategoryOwned(req.userId, parsed.data.categoryId);

    const [rule] = await db
      .insert(recurringTransactions)
      .values({
        categoryId: parsed.data.categoryId,
        amountCents: toCents(parsed.data.amount),
        note: parsed.data.note,
        frequency: parsed.data.frequency,
        dayOfPeriod: parsed.data.dayOfPeriod,
        startDate: parsed.data.startDate,
        active: parsed.data.active ?? true,
        userId: req.userId,
      })
      .returning();

    // Rattrape immédiatement les occurrences déjà passées (ex : règle créée
    // avec une date de départ dans le passé).
    await runRecurringCatchUp(req.userId);

    res.status(201).json({ ...rule, amount: rule.amountCents / 100 });
  }),
);

recurringRouter.patch(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const rule = await loadOwnedRule(req.userId, req.params.ruleId);
    if (!rule) return res.status(404).json({ error: "Récurrence introuvable." });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    if (parsed.data.categoryId) await assertCategoryOwned(req.userId, parsed.data.categoryId);

    const patch = { ...parsed.data };
    if ("amount" in patch) {
      patch.amountCents = toCents(patch.amount);
      delete patch.amount;
    }

    const [updated] = await db
      .update(recurringTransactions)
      .set(patch)
      .where(eq(recurringTransactions.id, rule.id))
      .returning();

    res.json({ ...updated, amount: updated.amountCents / 100 });
  }),
);

recurringRouter.delete(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    const rule = await loadOwnedRule(req.userId, req.params.ruleId);
    if (!rule) return res.status(404).json({ error: "Récurrence introuvable." });

    await db.delete(recurringTransactions).where(eq(recurringTransactions.id, rule.id));
    res.status(204).end();
  }),
);
