import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCategoriesStore } from "@/stores/categories.js";
import { api } from "@/lib/api.js";

vi.mock("@/lib/api.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("categories store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetchAll charge les catégories et marque loaded", async () => {
    const store = useCategoriesStore();
    api.get.mockResolvedValue([{ id: "c1", name: "Alimentation", type: "expense" }]);

    await store.fetchAll();

    expect(store.items).toHaveLength(1);
    expect(store.loaded).toBe(true);
  });

  it("expenseCategories et incomeCategories filtrent par type", () => {
    const store = useCategoriesStore();
    store.items = [
      { id: "c1", name: "Alimentation", type: "expense" },
      { id: "c2", name: "Salaire", type: "income" },
    ];

    expect(store.expenseCategories.map((c) => c.id)).toEqual(["c1"]);
    expect(store.incomeCategories.map((c) => c.id)).toEqual(["c2"]);
  });

  it("byId retrouve une catégorie ou renvoie null", () => {
    const store = useCategoriesStore();
    store.items = [{ id: "c1", name: "Alimentation", type: "expense" }];

    expect(store.byId("c1")?.name).toBe("Alimentation");
    expect(store.byId("inconnu")).toBeNull();
  });

  it("remove retire la catégorie de la liste locale", async () => {
    const store = useCategoriesStore();
    store.items = [{ id: "c1", name: "Alimentation", type: "expense" }];
    api.delete.mockResolvedValue(null);

    await store.remove("c1");
    expect(store.items).toHaveLength(0);
  });

  it("remove propage l'erreur si le serveur refuse (catégorie utilisée)", async () => {
    const store = useCategoriesStore();
    store.items = [{ id: "c1", name: "Alimentation", type: "expense" }];
    api.delete.mockRejectedValue(new Error("Catégorie utilisée par des transactions."));

    await expect(store.remove("c1")).rejects.toThrow("utilisée");
    // La catégorie reste dans la liste puisque la suppression a échoué.
    expect(store.items).toHaveLength(1);
  });
});
