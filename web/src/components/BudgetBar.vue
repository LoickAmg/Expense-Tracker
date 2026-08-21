<script setup>
import { computed } from "vue";
import { formatMoney } from "@/lib/money.js";

const props = defineProps({
  line: { type: Object, required: true }, // { name, color, total, budget, remaining, overBudget }
});

const fraction = computed(() => {
  if (!props.line.budget) return 0;
  return Math.min(1, props.line.total / props.line.budget);
});

const barColor = computed(() => (props.line.overBudget ? "var(--danger)" : props.line.color));
</script>

<template>
  <div class="budget-row">
    <div class="budget-row-head">
      <span class="category-name">
        <span class="dot" :style="{ background: line.color }"></span>
        {{ line.name }}
      </span>
      <span :class="{ 'amount-expense': line.overBudget }">
        {{ formatMoney(line.total) }} <span class="of-budget">/ {{ formatMoney(line.budget) }}</span>
      </span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${fraction * 100}%`, background: barColor }"></div>
    </div>
    <p v-if="line.overBudget" class="over-budget-hint">
      Dépassement de {{ formatMoney(Math.abs(line.remaining)) }}
    </p>
  </div>
</template>

<style scoped>
.budget-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.budget-row-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.category-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.of-budget {
  color: var(--text-dim);
}

.over-budget-hint {
  margin: 0;
  color: var(--danger);
  font-size: 0.75rem;
}
</style>
