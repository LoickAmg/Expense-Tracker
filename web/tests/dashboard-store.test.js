import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "@/stores/dashboard.js";
import { api } from "@/lib/api.js";

vi.mock("@/lib/api.js", () => ({
  api: { get: vi.fn() },
}));

describe("dashboard store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetch charge les données du mois courant par défaut", async () => {
    const store = useDashboardStore();
    api.get.mockResolvedValue({ income: 100, expense: 50, balance: 50, byCategory: [], trend: [] });

    await store.fetch();

    expect(store.data.income).toBe(100);
    expect(api.get).toHaveBeenCalledWith(`/dashboard?month=${store.month}`);
  });

  it("previousMonth recule d'un mois, y compris au passage d'une année", async () => {
    const store = useDashboardStore();
    store.month = "2026-01";
    api.get.mockResolvedValue({ income: 0, expense: 0, balance: 0, byCategory: [], trend: [] });

    await store.previousMonth();
    expect(store.month).toBe("2025-12");
  });

  it("nextMonth avance d'un mois, y compris au passage d'une année", async () => {
    const store = useDashboardStore();
    store.month = "2025-12";
    api.get.mockResolvedValue({ income: 0, expense: 0, balance: 0, byCategory: [], trend: [] });

    await store.nextMonth();
    expect(store.month).toBe("2026-01");
  });

  it("expose l'erreur sans faire planter le store", async () => {
    const store = useDashboardStore();
    api.get.mockRejectedValue(new Error("Erreur serveur."));

    await store.fetch();
    expect(store.error).toBe("Erreur serveur.");
    expect(store.data).toBeNull();
  });
});
