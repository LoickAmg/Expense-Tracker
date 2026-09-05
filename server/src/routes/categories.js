import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, pgErrorCode } from "../lib/asyncHandler.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["income", "expense"]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const updateSchema = createSchema.partial();

async function loadOwnedCategory(userId, categoryId) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return category ?? null;
}

categoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await db.select().from(categories).where(eq(categories.userId, req.userId));
    res.json(rows);
  }),
);

categoriesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Catégorie invalide." });

    try {
      const [category] = await db
        .insert(categories)
        .values({ ...parsed.data, userId: req.userId })
        .returning();
      res.status(201).json(category);
    } catch (err) {
      if (pgErrorCode(err) === "23505") return res.status(409).json({ error: "Ce nom de catégorie existe déjà." });
      throw err;
    }
  }),
);

categoriesRouter.patch(
  "/:categoryId",
  asyncHandler(async (req, res) => {
    const category = await loadOwnedCategory(req.userId, req.params.categoryId);
    if (!category) return res.status(404).json({ error: "Catégorie introuvable." });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Données invalides." });

    const [updated] = await db
      .update(categories)
      .set(parsed.data)
      .where(eq(categories.id, category.id))
      .returning();
    res.json(updated);
  }),
);

categoriesRouter.delete(
  "/:categoryId",
  asyncHandler(async (req, res) => {
    const category = await loadOwnedCategory(req.userId, req.params.categoryId);
    if (!category) return res.status(404).json({ error: "Catégorie introuvable." });

    try {
      await db.delete(categories).where(eq(categories.id, category.id));
      res.status(204).end();
    } catch (err) {
      // Contrainte FK (transactions.categoryId → restrict) : on refuse la
      // suppression plutôt que de laisser des transactions orphelines.
      // Postgres distingue deux SQLSTATE pour les FK : "23503"
      // (foreign_key_violation, ex. NO ACTION) et "23001"
      // (restrict_violation, levé spécifiquement par ON DELETE RESTRICT —
      // c'est celui-ci que la contrainte du schéma déclenche réellement).
      const code = pgErrorCode(err);
      if (code === "23503" || code === "23001") {
        return res
          .status(409)
          .json({ error: "Catégorie utilisée par des transactions : supprime-les d'abord, ou renomme la catégorie." });
      }
      throw err;
    }
  }),
);
