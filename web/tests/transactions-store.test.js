import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTransactionsStore } from "@/stores/transactions.js";
import { api } from "@/lib/api.js";

vi.mock("@/lib/api.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("transactions store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetchAll appelle /transactions sans filtre par défaut", async () => {
    const store = useTransactionsStore();
    api.get.mockResolvedValue([]);

    await store.fetchAll();
    expect(api.get).toHaveBeenCalledWith("/transactions");
  });

  it("fetchAll inclut les filtres actifs dans la query string", async () => {
    const store = useTransactionsStore();
    store.filters.month = "2026-01";
    store.filters.categoryId = "cat1";
    api.get.mockResolvedValue([]);

    await store.fetchAll();
    expect(api.get).toHaveBeenCalledWith("/transactions?month=2026-01&categoryId=cat1");
  });

  it("exportUrl reflète les mêmes filtres que fetchAll", () => {
    const store = useTransactionsStore();
    store.filters.month = "2026-01";
    expect(store.exportUrl()).toBe("/api/transactions/export.csv?month=2026-01");
  });

  it("expose une erreur lisible si le chargement échoue", async () => {
    const store = useTransactionsStore();
    api.get.mockRejectedValue(new Error("Mois invalide."));

    await store.fetchAll();
    expect(store.error).toBe("Mois invalide.");
    expect(store.loading).toBe(false);
  });

  it("create puis rafraîchit la liste", async () => {
    const store = useTransactionsStore();
    api.post.mockResolvedValue({ id: "t1" });
    api.get.mockResolvedValue([{ id: "t1" }]);

    await store.create({ categoryId: "c1", amount: 10, date: "2026-01-01" });
    expect(store.items).toHaveLength(1);
  });
});
