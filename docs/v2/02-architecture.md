# 02 — Architecture

## 1. Vue d'ensemble

```
┌──────────────── Navigateur (PC / téléphone, PWA installée) ────────────────┐
│ Vue 3 + Pinia + vue-router                                                 │
│  ├─ Service Worker (vite-plugin-pwa / Workbox) : coque app en cache        │
│  ├─ IndexedDB (lib `idb`) : outbox (captures texte/audio, mutations),      │
│  │                          snapshot (dernier EngineInput + rapport)       │
│  ├─ Recorder (MediaRecorder) → Blob audio                                  │
│  └─ @et/core : moteur financier (Et si ? et prévisions hors-ligne)         │
└───────────────▲───────────────────────────────┬────────────────────────────┘
                │ JSON / multipart, cookie de session (HTTPS)                │
┌───────────────┴───────────────────────────────▼────────────────────────────┐
│ Express (Render, offre gratuite)                                           │
│  routes/ ── services/ ── ai/ ── @et/core                                   │
│   ├─ services/snapshot.js : DB → EngineInput                               │
│   ├─ ai/transcriber.js   : Groq Whisper (interface interchangeable)        │
│   ├─ ai/parser.js        : Claude, sortie structurée → propositions        │
│   ├─ ai/advisor.js       : Claude, rédaction + chat avec outils            │
│   └─ services/apply.js   : applique/annule des propositions (transaction)  │
└───────────────┬────────────────────────────────────────────────────────────┘
                ▼
        PostgreSQL (Neon)        Groq API (audio)      Anthropic API (texte)
```

## 2. Monorepo

```
package.json            workspaces: ["core", "server", "web"]
core/                   @et/core — JS pur ESM, dépendance unique : zod
  src/money.js          toMinor/fromMinor/format/parseAmountInput (XOF exp 0)
  src/dates.js          todayISO(tz), monthOf, addMonths, daysLeftInMonth…
  src/recurring.js      computeOccurrences (DÉPLACÉ depuis server/src/lib/recurringDates.js)
  src/engine/
    resolve.js          résolution des montants incertains par scénario
    baseline.js         dépenses courantes par catégorie
    forecast.js         projection mensuelle 3 scénarios
    freeToSpend.js      « libre à dépenser »
    arbitrate.js        placement des envies
    diagnostics.js      règles de diagnostic
    simulate.js         application de changements + delta
    index.js            runEngine(input, options) → EngineOutput
  src/schemas/          zod : entités, EngineInput, propositions IA, actions
  src/templates.js      gabarits FR des messages de diagnostic (sans IA)
  src/quickParse.js     saisie rapide par règles (fallback sans IA)
  tests/                vitest, cas de fixtures/engine-cases.md
server/
  src/routes/           + accounts, plans, quotas, captures, advisor, forecast, today, sync, settings, activity
  src/services/         snapshot.js, apply.js, activity.js, learning.js
  src/ai/               anthropic.js (client + options), parser.js, advisor.js, tools.js,
                        transcriber.js, prompts/*.md, mock.js
  scripts/eval-parse.js éval réelle (hors CI) sur fixtures/captures.json
web/
  src/lib/offline/      db.js (idb), outbox.js, snapshotCache.js, sync.js
  src/lib/recorder.js
  src/components/capture/  CaptureSheet, RecorderButton, QuickForms/*, ProposalCard, AmountInput, CertaintyToggle…
  src/views/            TodayView, ReviewView, PlanView, PlanDetailView, AdvisorView, RulesView + existantes
```

`core` est consommé en tant que workspace (`"@et/core": "*"`), pas de build :
ESM natif côté Node, Vite le résout côté web. **Interdit dans core** : accès DB,
`fetch`, `Date.now()` implicite (la date du jour est toujours un paramètre),
dépendances autres que zod.

## 3. Argent et dates

- XOF : exposant 0 → `amount` stocké en francs entiers. Le code reste générique :
  `core/src/money.js` lit l'exposant via `Intl.NumberFormat(…).resolvedOptions().maximumFractionDigits`
  (XOF → 0, EUR → 2). L'API échange des **unités mineures entières** (`amount: 50000`).
- `parseAmountInput("50k" | "50 000" | "50.000" | "50 mille" | "1,5 million")` → entier.
- Affichage : `formatMoney(62000)` → `62 000 F` (suffixe paramétrable `F`/`FCFA`).
- Arrondis du moteur : marges arrondies **à la centaine supérieure** (prudence).
- Fuseau : `users.timezone` (défaut détecté par le navigateur à la 1re connexion,
  ex. `Africa/Porto-Novo`). Tout « aujourd'hui » passe par `todayISO(tz)`
  (remplace les `new Date().toISOString().slice(0,10)` de la V1, faux près de minuit).

## 4. Synchronisation PC ↔ téléphone et hors-ligne

Principe : **le serveur est la source de vérité**. Pas de base locale complète,
seulement (a) une file d'attente d'écritures et (b) un cache de lecture.

### 4.1 Identifiants et idempotence
- Chaque entité créable par le client (`transactions`, `plans`, `captures`,
  `quotas`) a une colonne `client_id` (UUID généré côté client) avec index
  unique `(user_id, client_id)`. Un POST rejoué renvoie l'entité existante
  (HTTP 200 au lieu de 201) → zéro doublon même si l'envoi est répété.
- Toutes les tables mutables ont `updated_at` (mis à jour à chaque écriture)
  et `deleted_at` (suppression logique pour que l'autre appareil voie la
  suppression).

### 4.2 Outbox (web/src/lib/offline/outbox.js)
- Store IndexedDB `outbox` : `{ id, kind: "capture_text"|"capture_audio"|"mutation", payload, blob?, createdAt, attempts, lastError }`.
- Toute capture passe **toujours** par l'outbox (même en ligne) → comportement
  unique, enregistrement instantané.
- `flush()` déclenché par : ajout, événement `online`, `visibilitychange`
  (visible), démarrage de l'app, toutes les 30 s si non vide. Séquentiel, FIFO,
  backoff exponentiel (max 5 min). Une 4xx (hors 408/429) → l'élément passe en
  « erreur » visible dans Revue (pas de boucle infinie). Supprimé de l'outbox
  seulement après 2xx.
- L'audio reste dans IndexedDB jusqu'à ce que la capture serveur soit au
  minimum en statut `transcribed` (permet de relancer).
- Optionnel phase 3 : Background Sync API si dispo (Chrome Android), sinon flush
  à l'ouverture.

### 4.3 Lecture et fraîcheur
- `GET /api/sync/snapshot` renvoie en un appel tout ce que l'écran
  Aujourd'hui/Plan affiche : `EngineInput` + `EngineOutput` + dernier rapport
  conseiller + compte des captures à valider + `serverTime`.
- Stocké dans IndexedDB `snapshot`. Au lancement : rendu immédiat depuis le
  cache, puis refetch. Refetch aussi sur `focus`/`visibilitychange`/`online`
  et après toute mutation réussie.
- **Conflits** : last-write-wins. Les PATCH envoient `baseUpdatedAt` ; si
  l'entité serveur est plus récente, le serveur applique quand même mais
  renvoie `conflict: true` → toast « Modifié aussi sur un autre appareil —
  version la plus récente gardée ». (Mono-utilisateur : suffisant.)
- Pas de temps réel (WebSocket) : inutile pour 2 appareils d'une même personne.

### 4.4 Service Worker
- `vite-plugin-pwa` (`registerType: "autoUpdate"`), précache de la coque,
  `navigateFallback: /index.html`, **aucune mise en cache des réponses `/api`**
  (c'est IndexedDB qui gère les données ; évite les données périmées
  silencieuses).
- Manifest : nom « Copilote — Dépenses », `display: standalone`, icônes 192/512
  + maskable, `theme_color` = token `--bg`.
- Bandeau « Nouvelle version — Recharger » quand le SW se met à jour.

### 4.5 Session sur téléphone
- Cookie de session : passer à **rolling 180 jours** (`req.session.nowInMinutes`
  touché à chaque requête pour renouveler). L'app installée sur iOS a son propre
  stockage : se connecter une fois dans la PWA installée.
- `sameSite: "lax"` conservé (même origine).

## 5. Render gratuit : contournements

1. Coque PWA en cache → l'app s'ouvre en < 1 s même serveur endormi.
2. Au lancement : `fetch("/api/health")` immédiat (réveil), sans attendre.
3. Captures toujours stockées localement d'abord (§4.2).
4. Indicateur « Serveur en cours de réveil… » si `/api/health` > 3 s.
5. **Optionnel** (à activer par l'utilisateur) : workflow GitHub Actions
   `keepalive.yml` qui appelle `/api/health` toutes les 14 min de 6 h à 23 h
   (heure locale). Rester sous les 750 h/mois gratuites. Documenter que c'est
   facultatif.
6. Disque Render éphémère → **aucun fichier persistant** côté serveur : l'audio
   est traité en mémoire (multer `memoryStorage`) puis jeté.

## 6. Pipeline audio

```
[Client] MediaRecorder
   mimeType = "audio/webm;codecs=opus" si supporté, sinon "audio/mp4" (Safari iOS)
   max 120 s, bitrate 32 kbps (≈ 0,5 Mo/min) → Blob → outbox
      │ POST /api/captures (multipart: audio, clientId, recordedAt, durationMs)
[Serveur] multer memory (limite 10 Mo, types audio/webm|mp4|mpeg|ogg|wav|x-m4a)
   → capture status "transcribing"
   → Transcriber.transcribe(buffer, mime) :
        Groq SDK `groq-sdk`, model "whisper-large-v3-turbo", language "fr",
        response_format "verbose_json", temperature 0,
        prompt = indices de vocabulaire (users.settings.transcriptionHints +
                 noms de catégories + titres des projets actifs, ≤ 200 tokens)
   → capture.transcript, status "transcribed"
   → Parser (même requête, §7) → status "needs_review" | "failed"
   → réponse 201 avec la capture complète
```
- Délai cible : < 8 s pour 30 s d'audio. Timeout global de la route : 60 s.
- En cas d'échec de transcription : `status: "failed"`, `error`, le client garde
  le blob et propose « Réessayer » (`POST /api/captures/:id/reprocess` avec
  l'audio renvoyé).
- Interface : `transcriber.js` exporte `createTranscriber(env)` →
  `{ transcribe(buffer, mime, hints) → { text, durationSec, language } }`.
  Implémentations : `groq` (défaut), `mock` (tests : renvoie un texte de
  fixture). Variable `TRANSCRIBE_PROVIDER=groq|mock`.
- HTTPS requis pour le micro : OK en prod (Render). En dev sur téléphone :
  `@vitejs/plugin-basic-ssl` + `vite --host` (documenter dans le README).

## 7. Intégration IA (détails dans 05-ia.md)

- SDK : `@anthropic-ai/sdk`. Client unique dans `server/src/ai/anthropic.js`.
- Variables : `ANTHROPIC_API_KEY`, `AI_MODEL_PARSE` (défaut `claude-opus-5-5`),
  `AI_MODEL_ADVISOR` (défaut `claude-opus-5-5`), `AI_PROVIDER=anthropic|mock`.
- Parsing : `client.messages.parse` + `output_config: { format: zodOutputFormat(ParseResultSchema), effort: "low" }`.
- Conseiller (rapport) : sortie structurée, `effort: "medium"`.
- Chat : boucle d'outils (`client.beta.messages.toolRunner` + `betaZodTool`,
  outils `strict`), `tool_choice` **auto** uniquement (le choix forcé renvoie
  400 sur Opus 5.5).
- **Ne jamais** envoyer `temperature`/`top_p`/`top_k` ni `thinking: {type:"disabled"}`
  ni `budget_tokens` (rejetés par l'API actuelle).
- Repli serveur en cas de refus : `betas: ["server-side-fallback-2026-07-01"]`,
  `fallbacks: "default"` (appel via `client.beta.messages.*`).
- Cache de prompt : prompt système + définitions d'outils figés en tête,
  `cache_control: { type: "ephemeral" }` ; le contexte variable (date du jour,
  catégories, projets) va **dans le message utilisateur**, jamais dans le système.
- **Mode sans IA** : si `ANTHROPIC_API_KEY` absente → parsing par
  `core/quickParse.js`, conseils par `core/templates.js`. L'endpoint
  `/api/settings` expose `ai: { parse: bool, transcribe: bool }` pour que l'UI
  masque/adapte (micro désactivé sans clé Groq, avec explication).
- Vérification SDK à l'installation : `zodOutputFormat` provient de
  `@anthropic-ai/sdk/helpers/zod`. Si le helper exige zod 4, **monter zod en v4
  dans tout le monorepo** (les schémas `z.object` existants restent compatibles ;
  vérifier `.email()` et messages d'erreur).

### Coût estimé (mono-utilisateur)
~20 captures/jour × ~3 k tokens entrée + 600 sortie, + 1 rapport/jour, + chat
occasionnel. Avec Opus 5.5 (4 $/20 $ par M tokens) et le cache : **≈ 8–15 $/mois**.
Pour diviser ce coût par ~30, régler `AI_MODEL_PARSE=claude-haiku-5-5`
(qualité de parsing à valider avec `npm run eval:parse`). C'est un choix
utilisateur ; le défaut reste Opus 5.5. Groq Whisper : négligeable (< 1 $/mois).

## 8. Sécurité et vie privée

- Clés API uniquement côté serveur (variables d'env Render), jamais dans le bundle.
- Toutes les routes nouvelles derrière `requireAuth` et filtrées par `userId`
  (même pattern que la V1 : vérifier l'appartenance avant toute écriture).
- Limites : `POST /api/captures` 60/h, `/api/advisor/*` 30/h (middleware en
  mémoire, même style que `loginThrottle.js`).
- Les sorties IA ne sont **que des propositions** ; l'application passe par
  `services/apply.js` qui revalide chaque opération avec les schémas zod et les
  contrôles d'appartenance (une opération ne peut référencer que des IDs de
  l'utilisateur).
- Le texte capturé est traité comme **donnée** dans les prompts (balises
  `<capture>`), consigne explicite d'ignorer toute instruction qu'il contient.
- Mise à jour de la page Confidentialité : données envoyées à Anthropic
  (texte) et Groq (audio) pour traitement, pas de conservation de l'audio par
  l'app.
- Export complet JSON (`GET /api/export`) pour la portabilité.

## 9. Ce qu'on ne fait PAS (et pourquoi)

| Rejeté | Raison |
|---|---|
| Réécriture Next.js/Rust/Astro | Pas de gain fonctionnel ; coût énorme. |
| Base locale complète + CRDT (ElectricSQL, PouchDB…) | Surdimensionné pour 1 utilisateur / 2 appareils. |
| sqlite-vec / embeddings | La catégorisation se fait par le LLM avec la liste des catégories + historique de notes ; inutile de maintenir des vecteurs. |
| Web Speech API comme moteur principal | Non supporté de façon fiable sur iOS/Firefox, qualité variable en français. |
| App native (Capacitor) | La PWA couvre micro, installation, hors-ligne. Reconsidérer seulement si notifications iOS avancées nécessaires. |
| Connexion bancaire / Mobile Money automatique | Hors périmètre V2 ; import CSV possible plus tard. |
