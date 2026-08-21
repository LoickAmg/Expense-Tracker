import { Router } from "express";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { transactions, categories, budgets } from "../db/schema.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { runRecurringCatchUp } from "../lib/recurringCatchUp.js";
import { monthRange, isValidMonth, currentMonth, shiftMonth } from "../lib/monthRange.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

async function monthTotals(userId, month) {
  const { start, end } = monthRange(month);

  const rows = await db
    .select({
      type: categories.type,
      cents: sql`coalesce(sum(${transactions.amountCents}), 0)`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, userId), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(categories.type);

  const income = rows.find((r) => r.type === "income")?.cents ?? 0;
  const expense = rows.find((r) => r.type === "expense")?.cents ?? 0;
  return { income: income / 100, expense: expense / 100 };
}

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const month = req.query.month || currentMonth();
    if (!isValidMonth(month)) return res.status(400).json({ error: "Mois invalide (format YYYY-MM)." });

    await runRecurringCatchUp(req.userId);

    const { start, end } = monthRange(month);

    const [byCategoryRows, budgetRows, trend] = await Promise.all([
      db
        .select({
          categoryId: categories.id,
          name: categories.name,
          color: categories.color,
          type: categories.type,
          cents: sql`coalesce(sum(${transactions.amountCents}), 0)`.mapWith(Number),
        })
        .from(categories)
        .leftJoin(
          transactions,
          and(
            eq(transactions.categoryId, categories.id),
            gte(transactions.date, start),
            lt(transactions.date, end),
          ),
        )
        .where(eq(categories.userId, req.userId))
        .groupBy(categories.id, categories.name, categories.color, categories.type),

      db.select().from(budgets).where(and(eq(budgets.userId, req.userId), eq(budgets.month, month))),

      Promise.all(
        Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map(async (m) => ({
          month: m,
          ...(await monthTotals(req.userId, m)),
        })),
      ),
    ]);

    const budgetByCategory = new Map(budgetRows.map((b) => [b.categoryId, b.amountCents / 100]));

    const byCategory = byCategoryRows
      .map((row) => {
        const total = row.cents / 100;
        const budget = budgetByCategory.get(row.categoryId) ?? null;
        return {
          categoryId: row.categoryId,
          name: row.name,
          color: row.color,
          type: row.type,
          total,
          budget,
          remaining: budget !== null ? budget - total : null,
          overBudget: budget !== null && total > budget,
        };
      })
      .sort((a, b) => b.total - a.total);

    const income = byCategory.filter((c) => c.type === "income").reduce((sum, c) => sum + c.total, 0);
    const expense = byCategory.filter((c) => c.type === "expense").reduce((sum, c) => sum + c.total, 0);

    res.json({
      month,
      income,
      expense,
      balance: income - expense,
      byCategory,
      trend,
    });
  }),
);
