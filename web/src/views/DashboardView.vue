<script setup>
import { computed, onMounted } from "vue";
import { useDashboardStore } from "@/stores/dashboard.js";
import { formatMoney, formatMonthLabel } from "@/lib/money.js";
import DonutChart from "@/components/DonutChart.vue";
import TrendChart from "@/components/TrendChart.vue";
import BudgetBar from "@/components/BudgetBar.vue";

const store = useDashboardStore();

onMounted(() => store.fetch());

const expenseSegments = computed(
  () =>
    store.data?.byCategory
      .filter((c) => c.type === "expense" && c.total > 0)
      .map((c) => ({ label: c.name, value: c.total, color: c.color })) ?? [],
);

const budgetedLines = computed(() => store.data?.byCategory.filter((c) => c.budget !== null) ?? []);
</script>

<template>
  <div class="dashboard-page">
    <div class="month-nav">
      <button class="btn-ghost btn-icon" @click="store.previousMonth()">←</button>
      <span class="month-label">{{ formatMonthLabel(store.month) }}</span>
      <button class="btn-ghost btn-icon" @click="store.nextMonth()">→</button>
    </div>

    <p v-if="store.error" class="error-banner">{{ store.error }}</p>
    <p v-if="store.loading" class="loading-hint">Chargement…</p>

    <template v-else-if="store.data">
      <section class="summary-cards">
        <div class="card summary-card">
          <span class="summary-label">Revenus</span>
          <span class="summary-value amount-income">{{ formatMoney(store.data.income) }}</span>
        </div>
        <div class="card summary-card">
          <span class="summary-label">Dépenses</span>
          <span class="summary-value amount-expense">{{ formatMoney(store.data.expense) }}</span>
        </div>
        <div class="card summary-card">
          <span class="summary-label">Solde</span>
          <span class="summary-value" :class="store.data.balance >= 0 ? 'amount-income' : 'amount-expense'">
            {{ formatMoney(store.data.balance) }}
          </span>
        </div>
      </section>

      <section class="charts-row">
        <div class="card chart-card">
          <h2>Répartition des dépenses</h2>
          <DonutChart :segments="expenseSegments" />
        </div>
        <div class="card chart-card">
          <h2>Tendance sur 6 mois</h2>
          <TrendChart :points="store.data.trend" />
        </div>
      </section>

      <section v-if="budgetedLines.length" class="card budgets-card">
        <h2>Budgets du mois</h2>
        <div class="budgets-list">
          <BudgetBar v-for="line in budgetedLines" :key="line.categoryId" :line="line" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.loading-hint {
  color: var(--text-dim);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.summary-card {
  padding: 1.1rem 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.summary-label {
  color: var(--text-dim);
  font-size: 0.8rem;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.chart-card {
  padding: 1.2rem;
}

.chart-card h2,
.budgets-card h2 {
  margin: 0 0 1rem;
  font-size: 1rem;
}

.budgets-card {
  padding: 1.2rem;
}

.budgets-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
