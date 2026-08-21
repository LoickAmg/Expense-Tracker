<script setup>
import { ref, onMounted } from "vue";
import { useCategoriesStore } from "@/stores/categories.js";

const store = useCategoriesStore();
const name = ref("");
const type = ref("expense");
const color = ref("#6ea8fe");
const error = ref(null);

onMounted(() => {
  if (!store.loaded) store.fetchAll();
});

async function handleCreate() {
  error.value = null;
  if (!name.value.trim()) return;
  try {
    await store.create({ name: name.value.trim(), type: type.value, color: color.value });
    name.value = "";
  } catch (err) {
    error.value = err.message;
  }
}

async function handleDelete(category) {
  error.value = null;
  if (!confirm(`Supprimer la catégorie "${category.name}" ?`)) return;
  try {
    await store.remove(category.id);
  } catch (err) {
    error.value = err.message;
  }
}
</script>

<template>
  <div class="settings-section">
    <p v-if="error" class="error-banner">{{ error }}</p>

    <form class="card new-category-form" @submit.prevent="handleCreate">
      <label class="field">
        <span>Nom</span>
        <input v-model="name" type="text" placeholder="Ex. Abonnements" required />
      </label>
      <label class="field">
        <span>Type</span>
        <select v-model="type">
          <option value="expense">Dépense</option>
          <option value="income">Revenu</option>
        </select>
      </label>
      <label class="field color-field">
        <span>Couleur</span>
        <input v-model="color" type="color" />
      </label>
      <button type="submit">+ Ajouter</button>
    </form>

    <ul class="category-list">
      <li v-for="c in store.items" :key="c.id" class="card category-row">
        <span class="dot" :style="{ background: c.color }"></span>
        <span class="category-name">{{ c.name }}</span>
        <span class="category-type">{{ c.type === "income" ? "revenu" : "dépense" }}</span>
        <button class="btn-ghost btn-icon" title="Supprimer" @click="handleDelete(c)">🗑️</button>
      </li>
      <p v-if="!store.items.length" class="hint">Aucune catégorie pour l'instant.</p>
    </ul>
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.new-category-form {
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
  min-width: 160px;
}

.color-field input {
  min-width: 60px;
  padding: 0;
  height: 38px;
}

.category-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.category-row {
  padding: 0.7rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-name {
  flex: 1;
  font-weight: 500;
}

.category-type {
  color: var(--text-dim);
  font-size: 0.8rem;
}

.hint {
  color: var(--text-dim);
}
</style>
