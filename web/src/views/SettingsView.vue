<script setup>
import { ref } from "vue";
import CategoriesSettings from "@/components/CategoriesSettings.vue";
import RecurringSettings from "@/components/RecurringSettings.vue";
import BudgetsSettings from "@/components/BudgetsSettings.vue";

const TABS = [
  { key: "categories", label: "Catégories" },
  { key: "recurring", label: "Récurrences" },
  { key: "budgets", label: "Budgets" },
];

const activeTab = ref("categories");
</script>

<template>
  <div class="settings-page">
    <h1>Paramètres</h1>

    <nav class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <CategoriesSettings v-if="activeTab === 'categories'" />
    <RecurringSettings v-else-if="activeTab === 'recurring'" />
    <BudgetsSettings v-else-if="activeTab === 'budgets'" />
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.75rem;
}

.tab-btn {
  background: transparent;
  color: var(--text-dim);
  border: none;
  padding: 0.4rem 0.2rem;
  font-weight: 500;
  border-radius: 0;
}

.tab-btn.active {
  color: var(--accent);
}

.tab-btn:hover {
  opacity: 1;
  color: var(--text);
}
</style>
