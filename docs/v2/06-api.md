# 06 — Contrat d'API

Toutes les routes : préfixe `/api`, `requireAuth` (sauf auth/health), JSON,
montants **entiers en unités mineures** (`amount`), dates `YYYY-MM-DD`, mois
`YYYY-MM`. Erreurs : `{ error: string, details?: zodIssues }` (même style que la V1).
Les POST de création acceptent `clientId` (UUID) → idempotents (200 si déjà
créé). Les PATCH acceptent `baseUpdatedAt` → réponse `{ ..., conflict: bool }`.
Les listes excluent les supprimés (`deleted_at`).

## Existant (adapté)
| Méthode | Route | Changement V2 |
|---|---|---|
| POST | /auth/login, /auth/logout ; GET /auth/me | `/me` renvoie aussi `currency, locale, timezone, settings` ; session rolling 180 j |
| CRUD | /categories | + `essential`, `keywords`, `archived` ; DELETE = archive si utilisée |
| CRUD | /transactions | `amount` (entier), + `accountId`, `tags`, `planId`, `source`, `clientId` ; filtres `?month&categoryId&accountId&tag&planId` ; DELETE = soft |
| CRUD | /recurring | + `accountId`, `endDate` |
| — | /budgets | **supprimé** (remplacé par /quotas) |
| GET | /dashboard | **remplacé** par /today et /forecast (garder une redirection 410 explicite) |
| GET | /health | inchangé (sert aussi de réveil) |

## Nouveau

### Paramètres
- `GET /settings` → `{ currency, locale, timezone, settings, ai: { parse, transcribe, advisor } }`
- `PATCH /settings` → `{ timezone?, settings? }` (zod `UserSettingsSchema`)

### Comptes
- `GET /accounts` → `[{ id, name, kind, balance, openingBalance, openingDate, isDefault, archived }]` (balance calculé)
- `POST /accounts`, `PATCH /accounts/:id`, `DELETE /accounts/:id` (refus si mouvements → archive)
- `POST /accounts/:id/set-balance` `{ balance, date? }` → crée une transaction d'ajustement (catégorie système « Ajustement de solde », créée à la volée, `source: manual`) pour que le solde calculé = `balance`

### Projets
- `GET /plans?kind&status` → projets + `resolved` + `verdict` (depuis le moteur)
- `POST /plans` (zod `PlanCreateSchema`), `PATCH /plans/:id`, `DELETE /plans/:id`
- `POST /plans/:id/reserve` `{ amount }` → `reserved_amount += amount` (négatif autorisé, ≥ 0 final)
- `POST /plans/:id/complete` `{ actualAmount, date, accountId? }` → crée la transaction (`planId`, `source`), `status=done`, `actual_amount`, `estimate_expected` figé, libère le réservé ; renvoie `{ plan, transaction }`
- `POST /plans/reorder` `{ ids: [planId…] }` → `sort_order`
- `GET /plans/:id/activity` → journal

### Règles
- `GET /quotas?month` → règles effectives du mois + `used/limit/pct/status`
- `POST /quotas`, `PATCH /quotas/:id`, `DELETE /quotas/:id`

### Captures
- `POST /captures` — `multipart/form-data` (`audio`, `clientId`, `recordedAt`, `durationMs`) **ou** JSON `{ source: "text"|"form", rawText, clientId, recordedAt }` → traitement synchrone (transcription → analyse) → `201 Capture`
- `GET /captures?status=needs_review,failed` → liste
- `GET /captures/:id`
- `PATCH /captures/:id` `{ rawText }` (correction de la transcription)
- `POST /captures/:id/reprocess` (JSON `{ rawText? }` ou multipart audio) → relance
- `POST /captures/:id/apply` `{ decisions: [{ opIndex, decision: "accepted"|"rejected", payload? }], answers?: [{questionIndex, value}] }` → applique en **une transaction SQL** via `services/apply.js`, renseigne `applied_refs`, journalise → `{ capture, created: [{entity, id}] }`
- `POST /captures/:id/undo` → supprime (soft) / restaure tout ce que `applied_refs` référence, statut `needs_review` ; refus si > 30 jours
- `POST /captures/:id/discard`

### Moteur
- `GET /forecast?horizon=3|6|12` → `EngineOutput`
- `POST /forecast/simulate` `{ changes: Action[], horizon? }` → `{ output, delta }` (les « Et si ? » client utilisent `core` localement ; cet endpoint sert au chat et aux clients sans cache)
- `GET /today` → `{ freeToSpend, balance, diagnostics: top3, upcoming7d: [...], reviewCount, quotasMonth: [...] }`

### Synchronisation
- `GET /sync/snapshot?horizon` → `{ serverTime, engineInput, engineOutput, report, reviewCount, user }` (une seule requête pour l'ouverture de l'app ; ETag = hash de `engineInput` → `304` si inchangé)

### Conseiller
- `GET /advisor/report` → dernier rapport (génère si absent ou `input_hash` changé et dernier > 6 h) `{ report, actions: [...] }`
- `POST /advisor/report/refresh` → force (limité 10/jour)
- `POST /advisor/actions/:id/apply` → applique (04-moteur §8), journalise, renvoie l'état mis à jour
- `POST /advisor/actions/:id/dismiss`
- `GET /advisor/thread` → messages du fil courant (texte rendu + cartes d'action, pas les blocs bruts)
- `POST /advisor/chat` `{ message }` → `{ reply, actions: [...] }`
- `POST /advisor/thread/new`

### Divers
- `GET /activity?entity&entityId&limit`
- `GET /export` → JSON complet (toutes tables de l'utilisateur) ; `GET /transactions/export.csv` (existant, à garder)

## Limites
`POST /captures` 60/h · `/advisor/chat` 30/h · `/advisor/report/refresh` 10/j ·
audio ≤ 10 Mo et ≤ 130 s · `rawText` ≤ 4 000 caractères.
