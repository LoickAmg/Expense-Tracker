<script setup>
import { computed } from "vue";

const props = defineProps({
  page: { type: String, default: "mentions-legales" },
});

const pages = {
  "mentions-legales": {
    title: "Mentions légales",
    updated: "En vigueur au 21 septembre 2026",
    sections: [
      {
        h: "Éditeur du site",
        body: [
          "« Ledger / Dépenses » est une application de gestion de budget personnel, réalisée en démonstration technique.",
          "Éditeur : Mahouna (éditeur non professionnel ; adresse postale non publiée, communiquée à l'hébergeur (loi n° 2004-575 du 21 juin 2004, art. 6, III, 2°)). Contact : mahounaamg@gmail.com.",
        ],
      },
      {
        h: "Hébergement",
        body: [
          "Le code source est publié sur GitHub (github.com/LoickAmg/Expense-Tracker). Le nom de l'hébergeur du service en ligne sera indiqué ici dès sa mise en production.",
        ],
      },
      {
        h: "Conditions d'utilisation",
        body: [
          "L'application est fournie à des fins de démonstration et d'apprentissage. Les données saisies sont stockées dans la base de l'hébergeur. Vous êtes responsable des informations que vous y enregistrez.",
        ],
      },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    updated: "En vigueur au 21 septembre 2026",
    sections: [
      {
        h: "Données collectées",
        body: [
          "L'application gère un compte utilisateur (adresse email et mot de passe chiffré) et des données financières saisies par vos soins (transactions, catégories, budgets).",
          "Ces données sont utilisées uniquement pour faire fonctionner l'application et ne sont jamais revendues ni partagées avec des tiers.",
        ],
      },
      {
        h: "Session",
        body: [
          "Une session de connexion est conservée via un cookie HTTP-only. Aucun traceur publicitaire ni outil d'analyse d'audience n'est embarqué.",
        ],
      },
      {
        h: "Vos droits (RGPD)",
        body: [
          "Conformément au RGPD, vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à : mahounaamg@gmail.com.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    updated: "",
    sections: [
      {
        h: "Nous écrire",
        body: [
          "Pour toute question, demande de correction ou de suppression de données : mahounaamg@gmail.com.",
          "Nous nous efforçons de répondre sous 5 jours ouvrés.",
        ],
      },
    ],
  },
};

const page = computed(() => pages[props.page] || pages["mentions-legales"]);
</script>

<template>
  <article class="legal-page">
    <p class="legal-kicker">Document légal</p>
    <h1 class="legal-title">{{ page.title }}</h1>
    <p v-if="page.updated" class="legal-updated">{{ page.updated }}</p>
    <section v-for="section in page.sections" :key="section.h" class="legal-section">
      <h2>{{ section.h }}</h2>
      <p v-for="paragraph in section.body" :key="paragraph">{{ paragraph }}</p>
    </section>
  </article>
</template>

<style scoped>
.legal-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 2.5rem 0 4rem;
}

.legal-kicker {
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 0.5rem;
}

.legal-title {
  font-size: 1.8rem;
  margin: 0 0 0.3rem;
  color: var(--text);
}

.legal-updated {
  color: var(--text-dim);
  font-size: 0.85rem;
  margin: 0 0 2rem;
}

.legal-section h2 {
  font-size: 1.05rem;
  margin: 1.75rem 0 0.5rem;
  color: var(--text);
}

.legal-section p {
  color: var(--text-dim);
  line-height: 1.7;
  margin: 0 0 0.9rem;
}
</style>
