import { defineStore } from "pinia";
import { api } from "@/lib/api.js";

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.month) params.set("month", filters.month);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const useTransactionsStore = defineStore("transactions", {
  state: () => ({
    items: [],
    loading: false,
    error: null,
    filters: { month: "", categoryId: "" },
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      this.error = null;
      try {
        this.items = await api.get(`/transactions${buildQuery(this.filters)}`);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    async create(payload) {
      const transaction = await api.post("/transactions", payload);
      await this.fetchAll();
      return transaction;
    },
    async update(id, payload) {
      const updated = await api.patch(`/transactions/${id}`, payload);
      await this.fetchAll();
      return updated;
    },
    async remove(id) {
      await api.delete(`/transactions/${id}`);
      this.items = this.items.filter((t) => t.id !== id);
    },
    exportUrl() {
      return `/api/transactions/export.csv${buildQuery(this.filters)}`;
    },
  },
});
