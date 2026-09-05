<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.js";

const auth = useAuthStore();
const router = useRouter();

const showTopbar = computed(() => auth.isAuthenticated);

async function handleLogout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="app-shell">
    <header v-if="showTopbar" class="topbar">
      <router-link to="/" class="brand">Ledger / Dépenses</router-link>
      <nav class="topnav">
        <router-link to="/" exact-active-class="active">Dashboard</router-link>
        <router-link to="/transactions" active-class="active">Transactions</router-link>
        <router-link to="/settings" active-class="active">Paramètres</router-link>
      </nav>
      <div class="topbar-user">
        <span class="topbar-greeting">{{ auth.user?.name }}</span>
        <button class="btn-ghost" @click="handleLogout">Déconnexion</button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
    <footer class="app-legal">
      <span>Ledger / Dépenses</span>
      <nav>
        <router-link to="/mention-legales">Mentions légales</router-link>
        <router-link to="/confidentialite">Confidentialité</router-link>
        <router-link to="/contact">Contact</router-link>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.topnav {
  display: flex;
  gap: 1.2rem;
}

.topnav a {
  color: var(--text-dim);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.3rem 0;
  border-bottom: 2px solid transparent;
}

.topnav a.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

.app-legal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.8rem;
}

.app-legal nav {
  display: flex;
  gap: 1.25rem;
}

.app-legal a {
  color: var(--text-dim);
  text-decoration: none;
}

.app-legal a:hover {
  color: var(--accent);
}
</style>
