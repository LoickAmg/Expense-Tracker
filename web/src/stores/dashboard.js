import { defineStore } from "pinia";
import { api } from "@/lib/api.js";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month, delta) {
  const [year, mm] = month.split("-").map(Number);
  const total = year * 12 + (mm - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

export const useDashboardStore = defineStore("dashboard", {
  state: () => ({
    month: currentMonth(),
    data: null,
    loading: false,
    error: null,
  }),
  actions: {
    async fetch() {
      this.loading = true;
      this.error = null;
      try {
        this.data = await api.get(`/dashboard?month=${this.month}`);
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },
    async goToMonth(month) {
      this.month = month;
      await this.fetch();
    },
    async previousMonth() {
      await this.goToMonth(shiftMonth(this.month, -1));
    },
    async nextMonth() {
      await this.goToMonth(shiftMonth(this.month, 1));
    },
  },
});
