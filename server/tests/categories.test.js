import { describe, it, expect } from "vitest";
import { loginAsNewUser, createCategory } from "./helpers.js";

describe("categories", () => {
  it("crée puis liste une catégorie", async () => {
    const { agent } = await loginAsNewUser();
    await createCategory(agent, { name: "Salaire", type: "income" });

    const res = await agent.get("/api/categories").expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Salaire");
  });

  it("refuse un nom en doublon pour le même utilisateur", async () => {
    const { agent } = await loginAsNewUser();
    await createCategory(agent, { name: "Loisirs" });
    const res = await agent.post("/api/categories").send({ name: "Loisirs", type: "expense" });
    expect(res.status).toBe(409);
  });

  it("permet le même nom de catégorie pour deux utilisateurs différents", async () => {
    const a = await loginAsNewUser({ email: "a@example.com" });
    const b = await loginAsNewUser({ email: "b@example.com" });
    await createCategory(a.agent, { name: "Transport" });
    const res = await b.agent.post("/api/categories").send({ name: "Transport", type: "expense" });
    expect(res.status).toBe(201);
  });

  it("empêche de supprimer une catégorie utilisée par une transaction", async () => {
    const { agent } = await loginAsNewUser();
    const category = await createCategory(agent);
    await agent
      .post("/api/transactions")
      .send({ categoryId: category.id, amount: 12.5, date: "2026-01-05" })
      .expect(201);

    const res = await agent.delete(`/api/categories/${category.id}`);
    expect(res.status).toBe(409);
  });

  it("refuse l'accès aux catégories d'un autre utilisateur", async () => {
    const owner = await loginAsNewUser({ email: "owner@example.com" });
    const category = await createCategory(owner.agent);

    const other = await loginAsNewUser({ email: "other@example.com" });
    const res = await other.agent.patch(`/api/categories/${category.id}`).send({ name: "Hack" });
    expect(res.status).toBe(404);
  });
});
