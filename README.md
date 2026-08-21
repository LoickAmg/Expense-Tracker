# Expense Tracker

App de suivi de dépenses/revenus personnels : catégories, transactions,
**budgets mensuels par catégorie** et **transactions récurrentes**
(loyer, abonnements...). Mono-utilisateur.

## Stack

Backend **Node.js/Express** (API REST) + **Drizzle ORM** + **PostgreSQL**,
frontend **Vue 3** (Composition API) + **Pinia** + **Vite**, graphiques SVG
faits main (aucune librairie de charting), sans framework CSS (thème
sombre écrit à la main, repris du projet Task Manager).

> La roadmap prévoyait Laravel (PHP) + une BDD relationnelle. Le backend a
> été pivoté vers Node/Express dès le départ : l'installateur PHP
> (Composer/Packagist) n'est accessible ni dans mon environnement de
> build, ni via le pont vers la machine de l'utilisateur (ni PHP ni
> Composer n'y sont installés, et l'accès réseau y est également
> restreint) — même situation déjà rencontrée sur Manga Quoting et Task
> Manager. Drizzle (plutôt que Prisma) est utilisé pour la même raison :
> Prisma télécharge un moteur binaire natif, bloqué ici, alors que
> Drizzle génère du SQL pur.

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

## Déploiement (Render + Neon)

1. **Neon** : crée un projet Postgres gratuit sur [neon.tech](https://neon.tech),
   récupère la `DATABASE_URL` (avec `?sslmode=require`).
2. **Render** : crée un *Web Service* pointant sur ce repo.
   - Build command : `npm ci --include=dev && npm run build:web && npm run db:migrate && npm run db:seed`
     (`--include=dev` est nécessaire car `NODE_ENV=production` fait sinon
     sauter les devDependencies, dont `vite` ; `db:seed` est idempotent —
     il ne fait rien si le compte admin existe déjà — et permet de créer
     les données initiales même sur le plan gratuit, qui n'a pas accès au
     Shell/aux One-Off Jobs pour lancer la commande à la main.)
   - Start command : `npm start`
   - Variables d'environnement : `DATABASE_URL` (celle de Neon),
     `SESSION_SECRET` (valeur aléatoire), `NODE_ENV=production`,
     `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME`.
3. Le plan gratuit de Render met le service en veille après 15 min
   d'inactivité (le réveil prend ~1 min) — sans conséquence sur les
   transactions récurrentes, qui se rattrapent automatiquement au réveil.

Le serveur active `app.set("trust proxy", 1)` en production dès le
premier commit (Render, comme Heroku/Railway, termine le HTTPS à son
niveau et transmet la requête en HTTP en interne ; sans ce réglage,
Express refuse silencieusement de poser le cookie de session marqué
`secure: true`, et l'utilisateur reste déconnecté juste après un login
qui semble pourtant réussi — bug rencontré et corrigé après coup sur Task
Manager, évité ici dès le départ).

Aucune configuration Docker nécessaire : Render détecte Node.js et utilise
directement les commandes ci-dessus.

## Licence

MIT — voir [LICENSE](./LICENSE).
