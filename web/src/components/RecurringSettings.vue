<script setup>
import { ref, onMounted } from "vue";
import { api } from "@/lib/api.js";
import { useCategoriesStore } from "@/stores/categories.js";
import { formatMoney } from "@/lib/money.js";

const categoriesStore = useCategoriesStore();
const rules = ref([]);
const error = ref(null);

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const form = ref({
  categoryId: "",
  amount: "",
  frequency: "monthly",
  dayOfPeriod: 1,
  startDate: todayISO(),
  note: "",
});

onMounted(async () => {
  if (!categoriesStore.loaded) await categoriesStore.fetchAll();
  form.value.categoryId = categoriesStore.items[0]?.id ?? "";
  await loadRules();
});

async function loadRules() {
  rules.value = await api.get("/recurring");
}

async function handleCreate() {
  error.value = null;
  try {
    await api.post("/recurring", {
      categoryId: form.value.categoryId,
      amount: Number(form.value.amount),
      frequency: form.value.frequency,
      dayOfPeriod: Number(form.value.dayOfPeriod),
      startDate: form.value.startDate,
      note: form.value.note.trim() || undefined,
    });
    form.value.amount = "";
    form.value.note = "";
    await loadRules();
  } catch (err) {
    error.value = err.message;
  }
}

async function toggleActive(rule) {
  await api.patch(`/recurring/${rule.id}`, { active: !rule.active });
  await loadRules();
}

async function handleDelete(rule) {
  if (!confirm("Supprimer cette récurrence ?")) return;
  await api.delete(`/recurring/${rule.id}`);
  await loadRules();
}

function categoryName(categoryId) {
  return categoriesStore.byId(categoryId)?.name ?? "—";
}

function frequencyLabel(rule) {
  if (rule.frequency === "monthly") return `Le ${rule.dayOfPeriod} de chaque mois`;
  return `Chaque ${WEEKDAYS[rule.dayOfPeriod].toLowerCase()}`;
}
</script>

<template>
  <div class="settings-section">
    <p v-if="error" class="error-banner">{{ error }}</p>

    <form class="card new-rule-form" @submit.prevent="handleCreate">
      <label class="field">
        <span>Catégorie</span>
        <select v-model="form.categoryId" required>
          <option v-for="c in categoriesStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="field">
        <span>Montant (€)</span>
        <input v-model="form.amount" type="number" step="0.01" min="0.01" required />
      </label>
      <label class="field">
        <span>Fréquence</span>
        <select v-model="form.frequency">
          <option value="monthly">Mensuelle</option>
          <option value="weekly">Hebdomadaire</option>
        </select>
      </label>
      <label v-if="form.frequency === 'monthly'" class="field">
        <span>Jour du mois</span>
        <input v-model="form.dayOfPeriod" type="number" min="1" max="31" required />
      </label>
      <label v-else class="field">
        <span>Jour de la semaine</span>
        <select v-model="form.dayOfPeriod">
          <option v-for="(day, index) in WEEKDAYS" :key="index" :value="index">{{ day }}</option>
        </select>
      </label>
      <label class="field">
        <span>Date de départ</span>
        <input v-model="form.startDate" type="date" required />
      </label>
      <label class="field">
        <span>Note</span>
        <input v-model="form.note" type="text" placeholder="Optionnel" />
      </label>
      <button type="submit">+ Ajouter</button>
    </form>

    <ul class="rule-list">
      <li v-for="rule in rules" :key="rule.id" class="card rule-row" :class="{ inactive: !rule.active }">
        <div class="rule-main">
          <strong>{{ categoryName(rule.categoryId) }}</strong>
          <span>{{ formatMoney(rule.amount) }} — {{ frequencyLabel(rule) }}</span>
          <span v-if="rule.note" class="rule-note">{{ rule.note }}</span>
        </div>
        <div class="rule-actions">
          <button class="btn-ghost" @click="toggleActive(rule)">
            {{ rule.active ? "Désactiver" : "Activer" }}
          </button>
          <button class="btn-ghost btn-icon" title="Supprimer" @click="handleDelete(rule)">🗑️</button>
        </div>
      </li>
      <p v-if="!rules.length" class="hint">Aucune récurrence pour l'instant.</p>
    </ul>
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.new-rule-form {
  padding: 1rem;
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-dim);
}

.field input,
.field select {
  min-width: 140px;
}

.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rule-row {
  padding: 0.8rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.rule-row.inactive {
  opacity: 0.5;
}

.rule-main {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.9rem;
}

.rule-note {
  color: var(--text-dim);
  font-size: 0.8rem;
}

.rule-actions {
  display: flex;
  gap: 0.4rem;
}

.hint {
  color: var(--text-dim);
}
</style>
