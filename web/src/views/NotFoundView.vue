<script setup>
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div class="nf-page">
    <p class="nf-code">404</p>
    <h1 class="nf-title">Cette page n'existe pas.</h1>
    <p class="nf-text">
      La page demandée n'est pas dans votre grand livre. Vérifiez l'adresse ou revenez au
      tableau de bord.
    </p>
    <button class="btn-primary" type="button" @click="router.push({ name: 'dashboard' })">
      Retour au tableau de bord
    </button>
  </div>
</template>

<style scoped>
.nf-page {
  max-width: 480px;
  margin: 8vh auto;
  text-align: center;
  padding: 0 1.25rem;
}

.nf-code {
  font-family: var(--font-mono, monospace);
  font-size: 3rem;
  color: var(--accent);
  margin: 0;
  font-weight: 700;
}

.nf-title {
  margin: 0.5rem 0 0.75rem;
  font-size: 1.5rem;
  color: var(--text);
}

.nf-text {
  color: var(--text-dim);
  margin-bottom: 1.75rem;
}
</style>
