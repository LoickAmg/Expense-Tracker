# CLAUDE.md

Expense Tracker — app personnelle de gestion financière (mono-utilisateur),
en cours d'évolution vers la **V2 « Copilote financier »**.

**La conception V2 fait autorité : `docs/v2/`** (index : `docs/v2/README.md`,
plan phasé : `docs/v2/07-plan.md`, brief d'implémentation : `docs/v2/SONNET_BRIEF.md`).
Décisions prises pendant l'implémentation : `docs/v2/DECISIONS-IMPL.md`.
Idées hors périmètre : `docs/v2/IDEAS.md`.

## Stack
- Monorepo npm workspaces : `server/` (Express + Drizzle + PostgreSQL),
  `web/` (Vue 3 + Pinia + Vite), `core/` (V2 : moteur financier pur + schémas zod, partagé).
- Montants : entiers en unités mineures de la devise de l'utilisateur
  (XOF → francs, pas de centimes) à partir de la V2.

## Commandes
- `npm run dev:server` (API :4000) · `npm run dev:web` (SPA :5173, proxy /api)
- `npm run lint` · `npm test` (tests serveur sur Postgres réel `expensetracker_test`)
- `npm run db:migrate` · `npm run db:seed` · `npm run db:generate --workspace server`

## Conventions
- Code et commentaires en français, ESM, zod pour toute validation d'entrée.
- Chaque route : `requireAuth`, filtrage par `req.userId`, vérification
  d'appartenance avant écriture, `asyncHandler`.
- `core/` : aucune E/S, aucune horloge implicite (date du jour en paramètre),
  arrondis explicites ; seule dépendance zod.
- L'IA ne calcule jamais de montants : le moteur `core` calcule, l'IA propose
  (validé par l'utilisateur) ou rédige à partir de chiffres fournis.
- Tests : jamais d'appel réseau réel (`AI_PROVIDER=mock`, `TRANSCRIBE_PROVIDER=mock`).
- UI : tokens CSS de `web/src/style.css`, mobile d'abord (375 px), cibles ≥ 44 px.
- Commits : `type(scope): message` en français.
