# Expense Tracker

App de suivi de dépenses/revenus personnels : catégories, transactions,
**budgets mensuels par catégorie** et **transactions récurrentes**
(loyer, abonnements...). Mono-utilisateur.

## Stack

Backend **Node.js/Express** (API REST) + **Drizzle ORM** + **PostgreSQL**,
frontend **Vue 3** (Composition API) + **Pinia** + **Vite**, graphiques SVG
faits main (aucune librairie de charting), sans framework CSS (thème
sombre écrit à la main, repris du projet Task Manager).

> **Choix d’architecture.** Le backend Node/Express et Drizzle ont été retenus
> pour garder une API légère, explicite et facilement déployable avec PostgreSQL.
> Le domaine métier est séparé des routes HTTP : les calculs de périodes et le
> rattrapage des récurrences peuvent donc être testés indépendamment de la base.

## Fonctionnalités

- **Catégories** (revenu/dépense) avec couleur, propres à chaque compte
- **Transactions** : montant, date, note, catégorie ; filtres par mois et
  par catégorie ; **export CSV**
- **Budgets mensuels** par catégorie de dépense, avec barre de
  progression et alerte de dépassement
- **Transactions récurrentes** (hebdomadaire ou mensuelle, ex. loyer) :
  génération automatique des occurrences manquantes à chaque
  consultation (« rattrapage »), sans tâche planifiée nécessaire — utile
  sur un hébergement gratuit qui se met en veille
- **Dashboard** : revenus/dépenses/solde du mois, répartition des
  dépenses par catégorie (donut), tendance sur 6 mois (barres),
  navigation mois par mois
- **Auth** par session (cookie httpOnly) — un seul compte pour l'instant

## Structure du repo

```
server/          API Express (routes REST, Drizzle, auth par session)
  src/db/        schéma, migrations générées, client, seed
  src/lib/       recurringDates.js (calcul pur des occurrences),
                 recurringCatchUp.js (génération idempotente),
                 monthRange.js, asyncHandler.js
  src/routes/    auth, categories, transactions, recurring, budgets, dashboard
  tests/         tests d'intégration (vitest + supertest, Postgres réel)
web/             SPA Vue 3 (Vite)
  src/stores/    Pinia (auth, categories, transactions, dashboard)
  src/components/  DonutChart, TrendChart, BudgetBar, TransactionModal,
                 CategoriesSettings, RecurringSettings, BudgetsSettings
  src/views/     LoginView, DashboardView, TransactionsView, SettingsView
  tests/         tests de composants et de stores (vitest + @vue/test-utils)
```

## Développement en local

Prérequis : Node 20+, une base PostgreSQL locale (Docker le plus simple).

```bash
# Démarrer Postgres (ou utilise une install locale existante)
docker run --name expensetracker-db -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:16
docker exec expensetracker-db psql -U postgres -c "CREATE DATABASE expensetracker;"
docker exec expensetracker-db psql -U postgres -c "CREATE DATABASE expensetracker_test;"

npm install
cp server/.env.example server/.env   # ajuster si besoin
npm run db:migrate
npm run db:seed                       # crée le compte admin@example.com / changeme123
                                       # + 5 catégories, quelques transactions et un
                                       # loyer récurrent de démo

npm run dev:server   # API sur :4000
npm run dev:web       # SPA sur :5173 (proxy /api vers :4000)
```

Ouvre `http://localhost:5173`, connecte-toi avec les identifiants seedés
(modifiables via les variables `SEED_USER_*` de `server/.env` avant le
premier `db:seed`).

## Tests et lint

```bash
npm run lint    # server (eslint) + web (eslint + eslint-plugin-vue)
npm test        # server : 38 tests d'intégration sur Postgres réel
                 # web : 23 tests de composants/stores (jsdom)
```

Les tests serveur utilisent une vraie base Postgres (`expensetracker_test`),
vidée avant chaque test. La logique de calcul des dates récurrentes
(mensuel/hebdomadaire, chevauchement de mois plus courts, années
bissextiles, reprise après un rattrapage partiel) est testée à la fois en
pur (`recurringDates.test.js`) et en intégration via
`runRecurringCatchUp` (`recurring.test.js`).

Le rendu des graphiques SVG faits main (donut, barres de tendance) et les
flux principaux (dashboard, CRUD transactions, budgets, récurrences) ont
en plus été vérifiés visuellement par capture d'écran (Playwright).

## Permissions et limites

L’authentification est actuellement mono-utilisateur : la session protège l’accès au compte, mais il n’existe pas encore de partage de budget ni de rôle multi-utilisateur. Les routes doivent néanmoins conserver leurs contrôles d’identité afin que l’évolution vers plusieurs comptes ne rende pas les données existantes accessibles par identifiant prévisible. Les tests d’intégration PostgreSQL vérifient les chemins d’authentification et les erreurs de validation ; les seeders ne doivent être utilisés qu’en développement.

Les valeurs `admin@example.com` et `changeme123` sont des identifiants de démonstration documentés pour le local. Il faut les remplacer via `SEED_USER_*` avant toute instance accessible sur un réseau et ne jamais réutiliser le mot de passe seedé en production. Les secrets de session et `DATABASE_URL` restent des variables d’environnement, absentes du dépôt.

## Licence

MIT — voir [LICENSE](./LICENSE).
