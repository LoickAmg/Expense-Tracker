import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { loginAsNewUser, createCategory } from "./helpers.js";
import { runRecurringCatchUp } from "../src/lib/recurringCatchUp.js";
import { db } from "../src/db/client.js";
import { transactions, recurringTransactions } from "../src/db/schema.js";

describe("recurring rules — API", () => {
  it("crée une règle mensuelle valide", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    const res = await agent
      .post("/api/recurring")
      .send({
        categoryId: category.id,
        amount: 800,
        frequency: "monthly",
        dayOfPeriod: 1,
        startDate: "2026-01-01",
        note: "Loyer",
      })
      .expect(201);

    expect(res.body.amount).toBe(800);
    expect(res.body.active).toBe(true);
  });

  it("rejette un jour du mois hors bornes", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    const res = await agent.post("/api/recurring").send({
      categoryId: category.id,
      amount: 800,
      frequency: "monthly",
      dayOfPeriod: 35,
      startDate: "2026-01-01",
    });
    expect(res.status).toBe(400);
  });

  it("rejette un jour de semaine hors bornes", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);

    const res = await agent.post("/api/recurring").send({
      categoryId: category.id,
      amount: 20,
      frequency: "weekly",
      dayOfPeriod: 9,
      startDate: "2026-01-01",
    });
    expect(res.status).toBe(400);
  });

  it("désactive une règle sans la supprimer", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);
    const rule = (
      await agent.post("/api/recurring").send({
        categoryId: category.id,
        amount: 800,
        frequency: "monthly",
        dayOfPeriod: 1,
        startDate: "2020-01-01",
      })
    ).body;

    const res = await agent.patch(`/api/recurring/${rule.id}`).send({ active: false }).expect(200);
    expect(res.body.active).toBe(false);
  });
});

describe("recurring catch-up", () => {
  it("génère les occurrences manquantes jusqu'à la date donnée, sans dupliquer au second passage", async () => {
    const { agent, user } = await loginAsNewUser();
    const category = await createCategory(agent);

    await agent.post("/api/recurring").send({
      categoryId: category.id,
      amount: 800,
      frequency: "monthly",
      dayOfPeriod: 1,
      startDate: "2020-01-01",
    });
    // La création a déjà déclenché un premier catch-up interne ; on repart
    // d'une base connue pour ce test.
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db
      .update(recurringTransactions)
      .set({ lastGeneratedDate: null })
      .where(eq(recurringTransactions.userId, user.id));

    const created = await runRecurringCatchUp(user.id, "2020-03-01");
    expect(created).toBe(3); // janvier, février, mars

    const again = await runRecurringCatchUp(user.id, "2020-03-01");
    expect(again).toBe(0); // déjà généré, aucun doublon

    const rows = await agent.get("/api/transactions?month=2020-02").expect(200);
    expect(rows.body).toHaveLength(1);
    expect(rows.body[0].date).toBe("2020-02-01");
  });

  it("reprend correctement après un premier passage partiel", async () => {
    const { agent, user } = await loginAsNewUser();
    const category = await createCategory(agent);
    const rule = (
      await agent.post("/api/recurring").send({
        categoryId: category.id,
        amount: 800,
        frequency: "monthly",
        dayOfPeriod: 1,
        startDate: "2020-01-01",
      })
    ).body;
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db
      .update(recurringTransactions)
      .set({ lastGeneratedDate: null })
      .where(eq(recurringTransactions.userId, user.id));

    await runRecurringCatchUp(user.id, "2020-01-01");
    const secondBatch = await runRecurringCatchUp(user.id, "2020-03-01");
    expect(secondBatch).toBe(2); // février, mars

    // On désactive la règle avant d'appeler l'endpoint HTTP : celui-ci
    // déclenche un catch-up jusqu'à la vraie date du jour, ce qui
    // générerait des dizaines d'occurrences supplémentaires depuis 2020
    // si la règle restait active — ce n'est pas ce que ce test vérifie.
    await agent.patch(`/api/recurring/${rule.id}`).send({ active: false });

    const all = await agent.get("/api/transactions").expect(200);
    expect(all.body).toHaveLength(3);
  });

  it("ignore les règles désactivées", async () => {
    const { agent, user } = await loginAsNewUser();
    const category = await createCategory(agent);
    const rule = (
      await agent.post("/api/recurring").send({
        categoryId: category.id,
        amount: 800,
        frequency: "monthly",
        dayOfPeriod: 1,
        startDate: "2020-01-01",
      })
    ).body;
    await agent.patch(`/api/recurring/${rule.id}`).send({ active: false });
    await db.delete(transactions).where(eq(transactions.userId, user.id));

    const created = await runRecurringCatchUp(user.id, "2020-06-01");
    expect(created).toBe(0);
  });
});
