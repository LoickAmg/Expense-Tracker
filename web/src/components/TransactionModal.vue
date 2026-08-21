<script setup>
import { ref, computed } from "vue";
import { useCategoriesStore } from "@/stores/categories.js";

const props = defineProps({
  transaction: { type: Object, default: null }, // null = création
});
const emit = defineEmits(["save", "close"]);

const categoriesStore = useCategoriesStore();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const categoryId = ref(props.transaction?.categoryId ?? categoriesStore.items[0]?.id ?? "");
const amount = ref(props.transaction?.amount ?? "");
const date = ref(props.transaction?.date ?? todayISO());
const note = ref(props.transaction?.note ?? "");
const error = ref(null);
const saving = ref(false);

const isEditing = computed(() => Boolean(props.transaction));

async function handleSubmit() {
  error.value = null;
  const amountNumber = Number(amount.value);
  if (!categoryId.value) {
    error.value = "Choisis une catégorie.";
    return;
  }
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    error.value = "Le montant doit être un nombre positif.";
    return;
  }

  saving.value = true;
  try {
    await emit("save", {
      categoryId: categoryId.value,
      amount: amountNumber,
      date: date.value,
      note: note.value.trim() || undefined,
    });
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <form class="modal card" @submit.prevent="handleSubmit">
      <header class="modal-header">
        <h2>{{ isEditing ? "Modifier la transaction" : "Nouvelle transaction" }}</h2>
        <button type="button" class="btn-ghost btn-icon" title="Fermer" @click="emit('close')">✕</button>
      </header>

      <div class="modal-body">
        <p v-if="error" class="error-banner">{{ error }}</p>

        <label class="field">
          <span>Catégorie</span>
          <select v-model="categoryId">
            <option v-for="c in categoriesStore.items" :key="c.id" :value="c.id">
              {{ c.name }} ({{ c.type === "income" ? "revenu" : "dépense" }})
            </option>
          </select>
        </label>

        <div class="field-row">
          <label class="field">
            <span>Montant (€)</span>
            <input v-model="amount" type="number" step="0.01" min="0.01" required />
          </label>
          <label class="field">
            <span>Date</span>
            <input v-model="date" type="date" required />
          </label>
        </div>

        <label class="field">
          <span>Note</span>
          <input v-model="note" type="text" placeholder="Optionnel" />
        </label>
      </div>

      <footer class="modal-footer">
        <button type="submit" :disabled="saving">{{ saving ? "Enregistrement…" : "Enregistrer" }}</button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3rem 1rem;
  overflow-y: auto;
  z-index: 20;
}

.modal {
  width: 100%;
  max-width: 440px;
  padding: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.05rem;
}

.modal-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field > span {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.field-row {
  display: flex;
  gap: 1rem;
}

.field-row .field {
  flex: 1;
}

.modal-footer {
  padding: 1rem 1.2rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
