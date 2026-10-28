# 03 — Modèle de données

Conventions (inchangées) : IDs `text` UUID (`crypto.randomUUID()`), montants
**entiers en unités mineures** (XOF → francs), `user_id` sur toute table
métier avec `onDelete: cascade`. Nouvelles conventions : `created_at`,
`updated_at` (`$onUpdate(() => new Date())`), `deleted_at` nullable sur les
tables synchronisées ; `client_id` nullable + index unique partiel
`(user_id, client_id) WHERE client_id IS NOT NULL`.

Toutes les lectures filtrent `deleted_at IS NULL` sauf l'endpoint de sync.

## 1. Enums

```js
category_type        = ["income", "expense"]                          // existant
recurring_frequency  = ["weekly", "monthly"]                          // existant
account_kind         = ["cash", "mobile_money", "bank", "savings"]
plan_kind            = ["obligation", "planned", "wish", "goal", "income"]
plan_status          = ["draft", "active", "done", "dropped"]
price_certainty      = ["known", "estimated", "rough", "unknown"]
priority             = ["must", "should", "could", "nice"]
income_likelihood    = ["sure", "likely", "uncertain"]
quota_kind           = ["category_cap", "category_floor", "tag_cap", "savings_rate", "savings_amount", "safety_buffer"]
quota_period         = ["week", "month"]
quota_strictness     = ["hard", "soft"]
capture_source       = ["text", "voice", "form"]
capture_status       = ["pending", "transcribing", "transcribed", "parsing", "needs_review", "applied", "discarded", "failed"]
entity_source        = ["manual", "capture", "advisor", "recurring", "import"]
```

## 2. Tables

### users (modifiée)
| colonne | type | note |
|---|---|---|
| currency | text not null default `'XOF'` | ISO 4217 |
| locale | text not null default `'fr-FR'` | |
| timezone | text not null default `'Africa/Abidjan'` | remplacé à la 1re connexion par le fuseau du navigateur |
| settings | jsonb not null default `{}` | `{ moneySuffix: "F", autoApplyHighConfidence: false, transcriptionHints: "", defaultMargins: {estimated: 0.15, rough: 0.30}, horizonMonths: 6, monthStartDay: 1 }` — validé par zod `UserSettingsSchema` |

### accounts (nouvelle)
| colonne | type | note |
|---|---|---|
| id, user_id | | |
| name | text not null | « Espèces », « MoMo », « Banque » |
| kind | account_kind not null | |
| opening_balance | integer not null default 0 | solde à `opening_date` |
| opening_date | date not null | |
| is_default | boolean not null default false | un seul par user (index unique partiel) |
| archived | boolean not null default false | |
| created_at, updated_at, deleted_at | | |

> Seed/migration : créer un compte « Principal » (`cash`, solde 0, date = plus
> ancienne transaction ou aujourd'hui), `is_default = true`. L'onboarding V2
> demande « Combien as-tu aujourd'hui, et où ? » pour régler les soldes
> d'ouverture (c'est indispensable au « libre à dépenser »).

### transfers (nouvelle, phase 7)
`id, user_id, from_account_id, to_account_id, amount, date, note, client_id, created_at, updated_at, deleted_at`.
Un transfert vers un compte `savings` compte comme épargne réalisée.

### categories (modifiée)
| ajout | type | note |
|---|---|---|
| essential | boolean not null default false | alimentation, transport, santé… → un minimum s'applique au « libre à dépenser » |
| keywords | text[] not null default `{}` | aide au classement (quickParse + prompt) |
| archived | boolean not null default false | |
| updated_at, deleted_at | | |

### transactions (modifiée)
| colonne | changement |
|---|---|
| amount_cents → **amount** | renommée ; données ÷ 100 (voir §4) |
| account_id | ajout, FK accounts, not null après migration (défaut = compte par défaut) |
| plan_id | ajout, FK plans `set null` — transaction issue d'un projet réalisé |
| capture_id | ajout, FK captures `set null` |
| tags | ajout text[] not null default `{}` — minuscules, sans accent (« restaurant », « taxi ») |
| source | ajout entity_source not null default `'manual'` (`recurring` si `recurring_id`) |
| client_id, updated_at, deleted_at | ajout |
| index | + `(user_id, plan_id)`, + GIN sur `tags` |

### recurring_transactions (modifiée)
`amount_cents → amount`, + `account_id`, + `end_date date null`, + `updated_at`, `deleted_at`.

### budgets → **remplacée par quotas** (voir §4). La table `budgets` est
supprimée à la fin de la migration ; `/api/budgets` est retiré, l'UI Budgets
devient l'écran Règles.

### plans (nouvelle) — cœur de la V2
| colonne | type | note |
|---|---|---|
| id, user_id | | |
| kind | plan_kind not null | |
| status | plan_status not null default `'active'` | `draft` = infos manquantes |
| title | text not null | « Clavier mécanique » |
| notes | text | |
| category_id | FK categories `restrict`, null | null autorisé pour `goal` |
| account_id | FK accounts, null | compte prévu |
| certainty | price_certainty not null | |
| amount | integer null | point d'estimation / montant connu |
| amount_min | integer null | |
| amount_max | integer null | « pas plus de » = max seul |
| margin_pct | real null | surcharge de la marge par défaut (0–1) |
| needs_research | boolean not null default false | « à chercher / à revoir » |
| likelihood | income_likelihood null | uniquement `kind = income` |
| priority | priority not null default `'should'` | |
| flexible | boolean not null | défaut : true pour wish/goal, false sinon |
| target_date | date null | date exacte (échéance) |
| target_month | text null `YYYY-MM` | mois visé si pas de date exacte |
| earliest_month | text null `YYYY-MM` | « pas avant » |
| reserved_amount | integer not null default 0 | déjà mis de côté |
| monthly_reservation | integer null | mise de côté mensuelle souhaitée (null = calculée) |
| sort_order | integer not null default 0 | ordre manuel dans la liste des envies |
| tags | text[] default `{}` | |
| actual_amount | integer null | rempli à `done` |
| done_at | date null | |
| transaction_id | FK transactions `set null`, null | transaction créée à la réalisation |
| capture_id | FK captures `set null` | |
| source | entity_source not null default `'manual'` | |
| postponed_count | integer not null default 0 | incrémenté quand target_month recule |
| client_id, created_at, updated_at, deleted_at | | |

Contraintes (vérifiées par zod `PlanSchema` côté API, et CHECK SQL quand simple) :
- `certainty = known` ⇒ `amount` non null.
- `certainty = estimated` ⇒ `amount` non null.
- `certainty = rough` ⇒ (`amount_min` et `amount_max`) non null, `min ≤ max`.
- `certainty = unknown` ⇒ `amount` null (min/max facultatifs) et `needs_research` vrai par défaut.
- `kind = income` ⇒ `likelihood` non null.
- `target_date` et `target_month` mutuellement exclusifs ; si `target_date` alors le mois effectif = mois de la date.
- Index : `(user_id, status)`, `(user_id, kind)`.

### quotas (nouvelle)
| colonne | type | note |
|---|---|---|
| id, user_id | | |
| kind | quota_kind not null | |
| category_id | FK null | requis pour category_cap/category_floor |
| tag | text null | requis pour tag_cap |
| amount | integer null | plafond / minimum / montant |
| rate | real null | savings_rate (0–1) |
| max_count | integer null | tag_cap en nombre (« max 4 restos/semaine ») |
| period | quota_period not null default `'month'` | week autorisé pour tag_cap uniquement |
| strictness | quota_strictness not null default `'soft'` | hard = alerte rouge + bloque les verdicts d'arbitrage |
| month | text null `YYYY-MM` | null = règle permanente ; sinon surcharge pour ce mois |
| active | boolean not null default true | |
| label | text null | libellé libre |
| client_id, source, created_at, updated_at, deleted_at | | |

Unicité : une seule règle **permanente** active par `(user_id, kind, category_id, tag)` et une seule surcharge par `(…, month)` → index uniques partiels. Résolution pour un mois M : surcharge de M sinon permanente.

### captures (nouvelle)
| colonne | type | note |
|---|---|---|
| id, user_id, client_id | | |
| source | capture_source | |
| status | capture_status | |
| raw_text | text null | saisie texte, ou transcription corrigée par l'utilisateur |
| transcript | text null | sortie brute de Whisper |
| audio_duration_sec | real null | |
| recorded_at | timestamp not null | horodatage client (pour « hier », « tout à l'heure ») |
| proposals | jsonb null | `ParseResult` validé (05-ia.md §3) |
| decisions | jsonb null | par opération : `{opIndex, decision: "accepted"|"rejected"|"edited", finalPayload}` |
| applied_refs | jsonb null | `[{entity: "plan", id}, …]` pour l'annulation |
| ai_meta | jsonb null | `{model, inputTokens, outputTokens, cacheRead, latencyMs, transcriber}` |
| error | text null | |
| created_at, updated_at, deleted_at | | |

### advice_reports (nouvelle)
`id, user_id, generated_at, input_hash text (sha256 de l'EngineInput normalisé), month text, diagnostics jsonb, actions jsonb, narrative text, narrative_source ("ai"|"template"), ai_meta jsonb`.
Cache : si `input_hash` identique au dernier rapport < 24 h → renvoyer l'existant.

### advice_actions (nouvelle)
`id, user_id, report_id, action jsonb (Action, cf. 04-moteur §8), status ("open"|"applied"|"dismissed"), effect jsonb (delta simulé), applied_at`.

### advisor_messages (nouvelle)
`id, user_id, thread_id text, role ("user"|"assistant"), content jsonb (blocs API Anthropic complets, pour rejouer l'historique sans modification), created_at`.
Un seul fil actif par défaut ; bouton « Nouvelle conversation » = nouveau `thread_id`. **Ajout uniquement** (jamais de réécriture de messages passés).

### activity_log (nouvelle)
`id, user_id, at timestamp, entity text, entity_id text, action ("create"|"update"|"delete"|"apply_capture"|"undo"|"postpone"|"reserve"|"complete"), source entity_source, before jsonb, after jsonb, capture_id null`.
Sert à : historique d'un projet, annulation d'une capture, rapport mensuel.

## 3. Schémas zod partagés (`core/src/schemas/`)

Un fichier par entité exportant `XxxSchema` (lecture), `XxxCreateSchema`,
`XxxUpdateSchema`. Les routes Express les utilisent pour valider ; le front
pour ses formulaires. `EngineInputSchema` (04-moteur §1) et
`ParseResultSchema` (05-ia §3) y vivent aussi.

## 4. Migration V1 → V2 (une migration Drizzle + script de données)

Ordre (une seule migration SQL générée par `drizzle-kit generate`, puis un
fichier SQL de données ajouté à la main dans la même migration si drizzle-kit
ne sait pas faire le renommage — **vérifier que drizzle-kit propose bien un
RENAME et pas DROP/ADD** ; sinon écrire la migration à la main) :

1. `users` : ajouter currency/locale/timezone/settings.
2. Créer `accounts` ; insérer un compte « Principal » par utilisateur.
3. `transactions`/`recurring_transactions` : `RENAME amount_cents TO amount` ;
   `UPDATE … SET amount = amount / 100` (la V1 recevait des montants en unités
   majeures et multipliait par 100 → ÷100 redonne les francs exacts) ; ajouter
   `account_id` (rempli avec le compte Principal puis `SET NOT NULL`), tags,
   source, client_id, updated_at, deleted_at, plan_id, capture_id.
4. `categories` : ajouter essential/keywords/archived/updated_at/deleted_at ;
   marquer `essential = true` pour les noms contenant
   alimentation|nourriture|transport|santé|loyer|logement.
5. Créer plans, quotas, captures, advice_*, advisor_messages, activity_log.
6. `budgets` → `quotas` : pour chaque budget, insérer `category_cap` avec
   `month = budget.month` ÷ 100 ; pour chaque catégorie, le budget du mois le
   plus récent devient aussi une règle permanente (`month = null`).
7. `DROP TABLE budgets`.

Tests de migration : `server/tests/migration.test.js` crée un état V1
(données budgets/transactions en centimes), applique la migration, vérifie
montants, compte par défaut, quotas.

Seed V2 (`npm run db:seed`) : utilisateur démo en XOF, comptes Espèces (25 000)
et MoMo (180 000), catégories FCFA réalistes (Alimentation, Transport,
Restaurants, Logement, Factures, Santé, Loisirs, Salaire, Freelance), 3 mois
de transactions, loyer récurrent 75 000 le 5, salaire 350 000 le 28, règles
(plafond Restaurants 30 000, minimum Alimentation 60 000, épargne 10 %,
matelas 50 000, taxi ≤ 15 000/semaine), projets : scolarité 150 000
(obligation, le 15 du mois prochain), clavier (envie, environ 40–50 000),
téléphone (envie, prix inconnu, pas plus de 200 000), fonds d'urgence (objectif
300 000, 40 000 mis de côté), paiement client attendu 200 000 (likely).
