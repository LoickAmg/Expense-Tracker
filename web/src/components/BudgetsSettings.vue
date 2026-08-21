<script setup>
import { ref, reactive, onMounted, watch } from "vue";
import { api } from "@/lib/api.js";
import { useCategoriesStore } from "@/stores/categories.js";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const categoriesStore = useCategoriesStore();
const month = ref(currentMonth());
const budgets = ref([]); // budgets existants pour ce mois
const drafts = reactive({}); // categoryId -> valeur saisie dans le champ
const error = ref(null);

onMounted(async () => {
  if (!categoriesStore.loaded) await categoriesStore.fetchAll();
  await loadBudgets();
});

watch(month, loadBudgets);

async function loadBudgets() {
  budgets.value = await api.get(`/budgets?month=${month.value}`);
  for (const category of categoriesStore.expenseCategories) {
    const existing = budgets.value.find((b) => b.categoryId === category.id);
    drafts[category.id] = existing ? String(existing.amount) : "";
  }
}

function budgetFor(categoryId) {
  return budgets.value.find((b) => b.categoryId === categoryId) ?? null;
}

async function handleSave(categoryId) {
  error.value = null;
  const amount = Number(drafts[categoryId]);
  if (!Number.isFinite(amount) || amount <= 0) {
    error.value = "Le budget doit être un nombre positif.";
    return;
  }
  try {
    await api.put("/budgets", { categoryId, month: month.value, amount });
    await loadBudgets();
  } catch (err) {
    error.value = err.message;
  }
}

async function handleClear(categoryId) {
  const budget = budgetFor(categoryId);
  if (!budget) return;
  await api.delete(`/budgets/${budget.id}`);
  drafts[categoryId] = "";
  await loadBudgets();
}
</script>

<template>
  <div class="settings-section">
    <label class="field month-field">
      <span>Mois</span>
      <input v-model="month" type="month" />
    </label>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <ul class="budget-list">
      <li v-for="category in categoriesStore.expenseCategories" :key="category.id" class="card budget-row">
        <span class="category-name">
          <span class="dot" :style="{ background: category.color }"></span>
          {{ category.name }}
        </span>
        <input v-model="drafts[category.id]" type="number" step="0.01" min="0.01" placeholder="Aucun budget" />
        <button class="btn-ghost" @click="handleSave(category.id)">Enregistrer</button>
        <button v-if="budgetFor(category.id)" class="btn-ghost btn-icon" title="Retirer" @click="handleClear(category.id)">
          ✕
        </button>
      </li>
      <p v-if="!categoriesStore.expenseCategories.length" class="hint">
        Crée d'abord une catégorie de dépense dans l'onglet "Catégories".
      </p>
    </ul>
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-dim);
}

.month-field {
  max-width: 200px;
}

.budget-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.budget-row {
  padding: 0.7rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.budget-row input {
  max-width: 140px;
}

.hint {
  color: var(--text-dim);
}
</style>
