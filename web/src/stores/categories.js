import { defineStore } from "pinia";
import { api } from "@/lib/api.js";

export const useCategoriesStore = defineStore("categories", {
  state: () => ({
    items: [],
    loaded: false,
  }),
  getters: {
    byId: (state) => (id) => state.items.find((c) => c.id === id) ?? null,
    expenseCategories: (state) => state.items.filter((c) => c.type === "expense"),
    incomeCategories: (state) => state.items.filter((c) => c.type === "income"),
  },
  actions: {
    async fetchAll() {
      this.items = await api.get("/categories");
      this.loaded = true;
    },
    async create(payload) {
      const category = await api.post("/categories", payload);
      this.items.push(category);
      return category;
    },
    async update(id, payload) {
      const updated = await api.patch(`/categories/${id}`, payload);
      const index = this.items.findIndex((c) => c.id === id);
      if (index !== -1) this.items[index] = updated;
      return updated;
    },
    async remove(id) {
      await api.delete(`/categories/${id}`);
      this.items = this.items.filter((c) => c.id !== id);
    },
  },
});
