import { describe, it, expect } from "vitest";
import { loginAsNewUser, createCategory } from "./helpers.js";

describe("dashboard", () => {
  it("calcule revenus, dépenses et solde pour le mois demandé", async () => {
    const { agent } = await loginAsNewUser();
    const salaire = await createCategory(agent, { name: "Salaire", type: "income" });
    const alimentation = await createCategory(agent, { name: "Alimentation", type: "expense" });

    await agent.post("/api/transactions").send({ categoryId: salaire.id, amount: 2000, date: "2026-01-05" });
    await agent.post("/api/transactions").send({ categoryId: alimentation.id, amount: 300, date: "2026-01-10" });
    // Transaction hors période — ne doit pas compter dans le mois demandé.
    await agent.post("/api/transactions").send({ categoryId: alimentation.id, amount: 999, date: "2026-02-10" });

    const res = await agent.get("/api/dashboard?month=2026-01").expect(200);
    expect(res.body.income).toBe(2000);
    expect(res.body.expense).toBe(300);
    expect(res.body.balance).toBe(1700);
  });

  it("signale un dépassement de budget", async () => {
    const { agent } = await loginAsNewUser();
    const alimentation = await createCategory(agent, { name: "Alimentation", type: "expense" });

    await agent.put("/api/budgets").send({ categoryId: alimentation.id, month: "2026-01", amount: 200 });
    await agent.post("/api/transactions").send({ categoryId: alimentation.id, amount: 250, date: "2026-01-10" });

    const res = await agent.get("/api/dashboard?month=2026-01").expect(200);
    const line = res.body.byCategory.find((c) => c.categoryId === alimentation.id);
    expect(line.overBudget).toBe(true);
    expect(line.remaining).toBe(-50);
  });

  it("renvoie 6 mois de tendance se terminant sur le mois demandé", async () => {
    const { agent } = await loginAsNewUser();
    await createCategory(agent);

    const res = await agent.get("/api/dashboard?month=2026-06").expect(200);
    expect(res.body.trend.map((t) => t.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });

  it("rejette un mois mal formé", async () => {
    const { agent } = await loginAsNewUser();
    const res = await agent.get("/api/dashboard?month=not-a-month");
    expect(res.status).toBe(400);
  });
});
