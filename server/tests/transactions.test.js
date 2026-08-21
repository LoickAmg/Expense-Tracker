import { describe, it, expect } from "vitest";
import { loginAsNewUser, createCategory } from "./helpers.js";

describe("transactions", () => {
  it("crée une transaction et convertit le montant en centimes", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    const res = await agent
      .post("/api/transactions")
      .send({ categoryId: category.id, amount: 12.5, date: "2026-01-05", note: "Test" })
      .expect(201);

    expect(res.body.amountCents).toBe(1250);
    expect(res.body.amount).toBe(12.5);
  });

  it("rejette une catégorie d'un autre utilisateur", async () => {
    const owner = await loginAsNewUser({ email: "owner@example.com" });
    const category = await createCategory(owner.agent);

    const other = await loginAsNewUser({ email: "other@example.com" });
    const res = await other.agent
      .post("/api/transactions")
      .send({ categoryId: category.id, amount: 5, date: "2026-01-05" });
    expect(res.status).toBe(404);
  });

  it("filtre les transactions par mois", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);
    await agent.post("/api/transactions").send({ categoryId: category.id, amount: 10, date: "2026-01-15" });
    await agent.post("/api/transactions").send({ categoryId: category.id, amount: 20, date: "2026-02-15" });

    const res = await agent.get("/api/transactions?month=2026-01").expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(10);
  });

  it("filtre les transactions par catégorie", async () => {
    const { agent } = await loginAsNewUser();
    const alimentation = await createCategory(agent, { name: "Alimentation" });
    const transport = await createCategory(agent, { name: "Transport" });
    await agent.post("/api/transactions").send({ categoryId: alimentation.id, amount: 10, date: "2026-01-15" });
    await agent.post("/api/transactions").send({ categoryId: transport.id, amount: 20, date: "2026-01-16" });

    const res = await agent.get(`/api/transactions?categoryId=${transport.id}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category.name).toBe("Transport");
  });

  it("modifie et supprime une transaction", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);
    const created = (
      await agent.post("/api/transactions").send({ categoryId: category.id, amount: 10, date: "2026-01-15" })
    ).body;

    const updated = await agent.patch(`/api/transactions/${created.id}`).send({ amount: 15.75 }).expect(200);
    expect(updated.body.amount).toBe(15.75);

    await agent.delete(`/api/transactions/${created.id}`).expect(204);
    const list = await agent.get("/api/transactions").expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("exporte un CSV avec les bonnes colonnes", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent, { name: "Alimentation" });
    await agent
      .post("/api/transactions")
      .send({ categoryId: category.id, amount: 9.9, date: "2026-01-15", note: "Boulangerie" });

    const res = await agent.get("/api/transactions/export.csv").expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("date,catégorie,type,montant,note");
    expect(res.text).toContain("Boulangerie");
    expect(res.text).toContain("9.90");
  });

  it("rejette un mois mal formé", async () => {
    const { agent } = await loginAsNewUser();
    const res = await agent.get("/api/transactions?month=2026-1");
    expect(res.status).toBe(400);
  });
});
