import { describe, it, expect } from "vitest";
import { loginAsNewUser, createCategory } from "./helpers.js";

describe("budgets", () => {
  it("crée un budget pour un mois donné", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    const res = await agent
      .put("/api/budgets")
      .send({ categoryId: category.id, month: "2026-01", amount: 300 })
      .expect(201);

    expect(res.body.amount).toBe(300);
  });

  it("remplace le budget existant plutôt que d'en créer un second (upsert)", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    await agent.put("/api/budgets").send({ categoryId: category.id, month: "2026-01", amount: 300 }).expect(201);
    await agent.put("/api/budgets").send({ categoryId: category.id, month: "2026-01", amount: 450 }).expect(201);

    const res = await agent.get("/api/budgets?month=2026-01").expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(450);
  });

  it("isole les budgets par mois", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    await agent.put("/api/budgets").send({ categoryId: category.id, month: "2026-01", amount: 300 });
    await agent.put("/api/budgets").send({ categoryId: category.id, month: "2026-02", amount: 350 });

    const jan = await agent.get("/api/budgets?month=2026-01").expect(200);
    expect(jan.body[0].amount).toBe(300);

    const feb = await agent.get("/api/budgets?month=2026-02").expect(200);
    expect(feb.body[0].amount).toBe(350);
  });

  it("supprime un budget", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);
    const budget = (
      await agent.put("/api/budgets").send({ categoryId: category.id, month: "2026-01", amount: 300 })
    ).body;

    await agent.delete(`/api/budgets/${budget.id}`).expect(204);
    const res = await agent.get("/api/budgets?month=2026-01").expect(200);
    expect(res.body).toHaveLength(0);
  });
});
