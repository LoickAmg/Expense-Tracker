<script setup>
import { ref, onMounted } from "vue";
import { useTransactionsStore } from "@/stores/transactions.js";
import { useCategoriesStore } from "@/stores/categories.js";
import { formatMoney } from "@/lib/money.js";
import TransactionModal from "@/components/TransactionModal.vue";

const store = useTransactionsStore();
const categoriesStore = useCategoriesStore();

const editingTransaction = ref(undefined); // undefined = fermé, null = création, objet = édition

onMounted(async () => {
  if (!categoriesStore.loaded) await categoriesStore.fetchAll();
  await store.fetchAll();
});

async function applyFilters() {
  await store.fetchAll();
}

async function handleSave(payload) {
  if (editingTransaction.value?.id) {
    await store.update(editingTransaction.value.id, payload);
  } else {
    await store.create(payload);
  }
  editingTransaction.value = undefined;
}

async function handleDelete(transaction) {
  if (!confirm(`Supprimer la transaction "${transaction.note || transaction.category.name}" ?`)) return;
  await store.remove(transaction.id);
}
</script>

<template>
  <div class="transactions-page">
    <header class="page-header">
      <h1>Transactions</h1>
      <div class="header-actions">
        <a class="btn-ghost" :href="store.exportUrl()" download>⬇ Export CSV</a>
        <button @click="editingTransaction = null">+ Nouvelle transaction</button>
      </div>
    </header>

    <div class="card filters-bar">
      <label class="field">
        <span>Mois</span>
        <input v-model="store.filters.month" type="month" @change="applyFilters" />
      </label>
      <label class="field">
        <span>Catégorie</span>
        <select v-model="store.filters.categoryId" @change="applyFilters">
          <option value="">Toutes</option>
          <option v-for="c in categoriesStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <button
        v-if="store.filters.month || store.filters.categoryId"
        class="btn-ghost"
        @click="
          store.filters.month = '';
          store.filters.categoryId = '';
          applyFilters();
        "
      >
        Réinitialiser
      </button>
    </div>

    <p v-if="store.error" class="error-banner">{{ store.error }}</p>

    <div class="card transactions-table-wrap">
      <table class="transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Catégorie</th>
            <th>Note</th>
            <th class="align-right">Montant</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in store.items" :key="t.id">
            <td>{{ t.date }}</td>
            <td>
              <span class="category-cell">
                <span class="dot" :style="{ background: t.category.color }"></span>
                {{ t.category.name }}
              </span>
            </td>
            <td class="note-cell">{{ t.note || "—" }}</td>
            <td class="align-right" :class="t.category.type === 'income' ? 'amount-income' : 'amount-expense'">
              {{ t.category.type === "income" ? "+" : "−" }}{{ formatMoney(t.amount) }}
            </td>
            <td class="row-actions">
              <button class="btn-ghost btn-icon" title="Modifier" @click="editingTransaction = t">✏️</button>
              <button class="btn-ghost btn-icon" title="Supprimer" @click="handleDelete(t)">🗑️</button>
            </td>
          </tr>
          <tr v-if="!store.loading && !store.items.length">
            <td colspan="5" class="empty-hint">Aucune transaction pour ces filtres.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <TransactionModal
      v-if="editingTransaction !== undefined"
      :transaction="editingTransaction"
      @save="handleSave"
      @close="editingTransaction = undefined"
    />
  </div>
</template>

<style scoped>
.transactions-page {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.page-header h1 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.header-actions a {
  text-decoration: none;
}

.filters-bar {
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

.field select,
.field input {
  min-width: 160px;
}

.transactions-table-wrap {
  overflow-x: auto;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.transactions-table th,
.transactions-table td {
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.transactions-table th {
  color: var(--text-dim);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.align-right {
  text-align: right;
}

.category-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.note-cell {
  color: var(--text-dim);
}

.row-actions {
  display: flex;
  gap: 0.3rem;
  justify-content: flex-end;
}

.empty-hint {
  text-align: center;
  color: var(--text-dim);
  padding: 2rem 0;
}
</style>
