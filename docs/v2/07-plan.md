# 07 — Plan d'implémentation

8 phases, chacune livrable et testable seule. **Ne jamais commencer une phase
tant que la précédente n'a pas ses critères d'acceptation verts.**

```
P0 Fondations ─► P1 Moteur ─► P2 Projets/Règles/UI ══► (MVP utilisable sur PC + navigateur mobile)
                                   │
                                   ▼
                     P3 PWA & hors-ligne ─► P4 Captures texte + IA ─► P5 Vocal ─► P6 Conseiller ─► P7 Apprentissage & finitions
```

Branche par phase : `v2/p0-fondations`, `v2/p1-moteur`, … ; commits petits et
atomiques (style du dépôt : `feat(core): …`, `fix(server): …`, en français).
Ne pas pousser ni ouvrir de PR sans accord de l'utilisateur.

**Définition de « terminé » (toutes phases)** : `npm run lint` et `npm test`
verts ; CI adaptée si nécessaire (nouveau workspace `core` testé) ; aucune
régression des tests existants (adapter ceux qui testent un comportement
volontairement changé, en le disant dans le commit) ; README mis à jour pour
toute nouvelle variable d'env ou commande ; vérification manuelle dans le
navigateur des écrans touchés (desktop **et** largeur 375 px).

---

## P0 — Fondations (aucun changement visible, sauf la devise)

1. Créer le workspace `core/` (`package.json` `@et/core`, `"type": "module"`,
   `exports` vers `src/index.js`, vitest, eslint repris du serveur). Ajouter à
   `workspaces` racine, aux scripts `lint`/`test` racine et à la CI.
2. `core/src/money.js` : `currencyExponent`, `toMinor`, `fromMinor`,
   `formatMoney(amount, {currency, suffix})`, `parseAmountInput`, `ceil100`,
   `floor100`, `roundingStep`. Tests : `50k`, `50 000`, `50.000`, `50 mille`,
   `1,5 million`, `un million deux` (non requis : seulement chiffres + mille/million/k),
   formats négatifs refusés.
3. `core/src/dates.js` : `todayISO(tz, now)`, `monthOf`, `addMonths`,
   `daysInMonth`, `daysLeftInMonth`, `eachDay(from, to)`, `isoWeekStart`.
   `now` toujours injecté.
4. Déplacer `server/src/lib/recurringDates.js` → `core/src/recurring.js` (+
   `occurrencesBetween`, gestion `endDate`) ; le serveur importe depuis `@et/core` ;
   déplacer ses tests.
5. Migration DB (03-donnees §4 étapes 1–4, 7 partielle : **garder `budgets`
   jusqu'à P2**) : users (currency/locale/timezone/settings), accounts + compte
   Principal, renommage `amount_cents → amount` ÷ 100, colonnes de sync
   (`client_id`, `updated_at`, `deleted_at`), tags, source, account_id,
   catégories essential/keywords/archived. Test de migration.
6. Adapter routes et front : plus de `toCents`, montants entiers ;
   `web/src/lib/money.js` délègue à `@et/core` (XOF, suffixe « F ») ; champs de
   saisie en entiers (pas de décimales) ; `/auth/me` renvoie currency/timezone.
7. Idempotence `clientId` sur POST transactions/categories ; soft delete
   transactions ; filtres `deleted_at IS NULL` partout (helper `notDeleted(table)`).
8. Fuseau : à la connexion, le front envoie `Intl.DateTimeFormat().resolvedOptions().timeZone`
   si l'utilisateur est encore au défaut ; `runRecurringCatchUp` utilise `todayISO(tz)`.
9. Seed V2 en XOF (03-donnees fin de fichier) — sans plans/quotas (tables pas
   encore là) ; les ajouter en P2.

**Acceptation P0** : app V1 fonctionne à l'identique mais en FCFA (`62 000 F`) ;
migration testée sur données V1 ; `core` testé en CI ; un POST transaction
rejoué avec le même `clientId` ne crée pas de doublon.

---

## P1 — Moteur (pur, testé à fond, branché sur l'API)

1. `core/src/schemas/` : `EngineInputSchema`, `EngineOutputSchema`, `PlanSchema`
   (+ Create/Update avec les contraintes de 03-donnees), `QuotaSchema`, `ActionSchema`.
2. `core/src/engine/` dans l'ordre : `config.js` → `resolve.js` → `baseline.js`
   → `forecast.js` (simulation journalière) → `freeToSpend.js` → `arbitrate.js`
   → `learning.js` → `diagnostics.js` (+ génération d'actions) → `simulate.js`
   → `index.js`. **Écrire chaque test de `fixtures/engine-cases.md` avant ou avec
   le module correspondant**, plus les propriétés de 04-moteur §11.
3. `core/src/templates.js` : gabarit FR par code de diagnostic + par type d'action
   (libellé de carte, ex. « Reporter *Console* en décembre »).
4. Serveur : tables `plans` et `quotas` (migration ; plans/quotas vides pour l'instant
   sauf seed), `services/snapshot.js` (requêtes SQL agrégées : soldes par compte,
   historique 4 mois par catégorie variable/récurrent/projet, mois en cours par
   catégorie et par tag, récurrences, projets, quotas, transactions futures) →
   valide avec `EngineInputSchema`.
5. Routes `GET /forecast`, `POST /forecast/simulate`, `GET /today`,
   `GET /sync/snapshot` (ETag). Tests d'intégration avec le seed.
6. Benchmark simple : `runEngine` sur horizon 12 mois avec 30 projets, 20
   catégories < 30 ms (test `it` avec seuil large 200 ms pour éviter le flaky).

**Acceptation P1** : tous les cas R/B/M/F/A/S/L passent ; `/today` renvoie un
FTS cohérent sur le seed (vérifier à la main avec 04-moteur §5) ; le moteur
s'importe dans le web sans erreur de build (`import { runEngine } from "@et/core"`
dans un test web).

---

## P2 — Projets, règles et nouvelle interface → **MVP**

Serveur :
1. Routes `/accounts` (+ set-balance), `/plans` (+ reserve, complete, reorder,
   activity), `/quotas`, `/settings`, `/activity` ; `services/activity.js`
   (journal sur toute écriture plans/quotas/transactions/accounts).
2. Migration budgets → quotas (03-donnees §4.6–4.7), suppression `/budgets`,
   `/dashboard` → 410.
3. Seed : plans et quotas de démonstration.

Web (mobile d'abord, garder le système de design « papier / encre » et ses tokens) :
4. Coque responsive : barre du bas (< 768 px) / barre latérale (≥ 768 px), FAB
   « + » (deviendra micro en P5) ouvrant `CaptureSheet` (pour l'instant :
   chips de formulaires rapides uniquement).
5. Composants de saisie : `AmountInput` (tolérant `parseAmountInput`, affichage
   formaté), `CertaintyToggle` (Connu/Estimé/Environ/Je ne sais pas → champs
   dynamiques + slider marge), `WhenChips`, `PriorityChips`, `Toggle`,
   `CategoryPicker`, `BottomSheet`.
6. Formulaires rapides : Dépense, Achat prévu, Envie, Revenu attendu, Règle
   (01-produit P3), créant via l'API avec `clientId`.
7. Écrans : **Aujourd'hui** (carte Libre à dépenser + « Comment c'est calculé ? »
   qui affiche `breakdown`, alertes top 3 avec texte de gabarit, échéances 7 j,
   règles du mois) ; **Plan** (graphique SVG fait main : bande prudent–optimiste,
   ligne probable, ligne matelas — dans le style de `TrendChart.vue` ; liste des
   mois ; section Envies avec verdicts ; glisser pour réordonner →
   `/plans/reorder` ; toggles « Et si ? » calculés **localement** avec
   `simulate` de `@et/core` sur `engineInput` du store) ; **Détail projet** ;
   **Règles** ; **Paramètres** (+ comptes avec saisie des soldes, catégories
   essentielles, réglages) ; onboarding minimal à la 1re connexion si
   `NO_OPENING_BALANCE` (« Combien as-tu aujourd'hui, et où ? »).
8. Store `snapshot` (Pinia) : charge `/sync/snapshot`, expose `engineInput`,
   `engineOutput`, rafraîchit après chaque mutation et sur `visibilitychange`.
9. Supprimer `DashboardView`, `BudgetBar`, `BudgetsSettings` (ou les réutiliser
   dans les nouveaux écrans) ; adapter/supprimer leurs tests.

**Acceptation P2** : sur le seed, depuis un téléphone (navigateur), on peut :
créer une envie « environ 40–50 000 », la voir classée « Possible maintenant »
ou « en <mois> », basculer un « Et si ? » et voir le FTS changer sans requête
réseau, marquer un projet payé avec un montant réel, créer un plafond et voir
l'alerte d'allure. Tests de composants pour AmountInput, CertaintyToggle,
store snapshot.

---

## P3 — PWA, hors-ligne, synchronisation

1. `vite-plugin-pwa` (02-architecture §4.4) + manifest + icônes (générer des
   PNG simples cohérents avec la marque « Ledger » ; pas d'image externe) ;
   bandeau de mise à jour.
2. `web/src/lib/offline/` : `db.js` (`idb`, stores `outbox`, `snapshot`),
   `outbox.js` (enqueue/flush/backoff/erreurs, 02-architecture §4.2),
   `snapshotCache.js`, `sync.js` (écouteurs online/visibility/focus, intervalle).
3. Toutes les créations du front (transactions, projets, règles, captures en
   P4) passent par l'outbox avec `clientId`. Les entités en attente
   apparaissent dans les listes avec un marqueur « en attente ».
4. Démarrage : rendu depuis le cache snapshot, `/api/health` immédiat,
   indicateur « réveil du serveur » > 3 s, bandeau « Données du … » si hors-ligne.
5. Session rolling 180 jours.
6. `PATCH` avec `baseUpdatedAt` → gestion `conflict` (toast).
7. `.github/workflows/keepalive.yml` **désactivé par défaut** (`workflow_dispatch`
   + cron commenté) avec documentation dans le README (variable `APP_URL`).

**Acceptation P3** : en mode avion (DevTools offline), l'app s'ouvre, affiche
le dernier état, accepte 3 dépenses ; au retour réseau elles sont envoyées
une seule fois (vérifier en base) ; l'app est installable (Lighthouse PWA
installable) ; une modification faite sur un appareil apparaît sur l'autre au
retour au premier plan.

---

## P4 — Captures texte et IA

1. Tables `captures`, `advice_*` pas encore ; `activity_log` déjà là.
2. `core/src/quickParse.js` (fallback sans IA) : `montant + mots`,
   `-/+` explicites, catégorie par mots-clés/notes fréquentes → `ParseResult`
   avec une opération `add_transaction` ; sinon `note`. Tests.
3. `core/src/schemas/parse.js` (05-ia §3).
4. `server/src/ai/` : `anthropic.js`, `context.js`, `parser.js` (+ post-traitement),
   `mock.js`, `prompts/parse.md` (05-ia §4, + 3 exemples few-shot). Installer
   `@anthropic-ai/sdk` ; vérifier le helper `zodOutputFormat` et la version de
   zod (02-architecture §7).
5. `services/apply.js` : une fonction par type d'opération, dans une transaction
   SQL, contrôles d'appartenance, `applied_refs`, journal ; `undo`.
6. Routes `/captures` (texte uniquement dans cette phase).
7. Web : `CaptureSheet` avec champ texte « Dis-moi tout, en vrac », envoi via
   outbox ; **Revue** : transcription/texte, `ProposalCard` par opération
   (formulaire pré-rempli = mêmes composants que les formulaires rapides),
   questions en chips, Tout valider, toast Annuler ; badge de l'onglet.
8. `ask_advisor` : en P4, afficher la question avec « Disponible bientôt » (P6
   branchera le chat).
9. `server/scripts/eval-parse.js` + script npm (05-ia §8). Le lancer une fois
   avec une vraie clé si disponible et consigner le score dans le README de P4 ;
   sinon le signaler.

**Acceptation P4** : tous les cas de `captures.json` passent en mock ; tests
du post-traitement ; sans `ANTHROPIC_API_KEY`, « taxi 2000 » produit quand
même une dépense via quickParse ; appliquer puis annuler une capture laisse la
base dans l'état initial (test d'intégration).

---

## P5 — Vocal

1. `web/src/lib/recorder.js` (02-architecture §6 : choix du mimeType, 120 s,
   32 kbps, événements niveau sonore pour un vu-mètre simple) +
   `RecorderButton` (tap pour démarrer/arrêter, compteur, annuler) ; le FAB
   devient micro (appui = enregistrer ; le « + » formulaires passe dans la feuille).
2. Outbox `capture_audio` (Blob dans IndexedDB), suppression du blob seulement
   quand la capture serveur est `transcribed` ou au-delà.
3. Serveur : `multer` mémoire, validations, `ai/transcriber.js` (Groq
   `groq-sdk`, `whisper-large-v3-turbo`, `language: "fr"`, `prompt` d'indices),
   mock ; enchaînement transcription → parser dans `POST /captures`.
4. Revue : lecture de l'audio local si encore présent, transcription éditable +
   « Réanalyser ».
5. Réglage « Indices de transcription » dans Paramètres (mots fréquents : noms
   de lieux, marques, « zem », « MoMo », …).
6. Micro désactivé avec explication si `ai.transcribe = false` ; message clair si
   permission refusée.
7. README : `GROQ_API_KEY`, dev HTTPS sur téléphone (`@vitejs/plugin-basic-ssl`).

**Acceptation P5** : sur un vrai téléphone (Android Chrome **et** iOS Safari
si disponible), un vocal de 20 s apparaît en Revue avec ses propositions ;
coupé du réseau pendant l'enregistrement, il est envoyé au retour ; tests
serveur avec `TRANSCRIBE_PROVIDER=mock` et un petit fichier audio de test.

---

## P6 — Conseiller

1. Tables `advice_reports`, `advice_actions`, `advisor_messages`.
2. `ai/numberGuard.js` + tests (05-ia §6).
3. `ai/advisor.js#writeReport` (sortie structurée, cache par `input_hash`,
   repli gabarits) ; routes `/advisor/report*`, `/advisor/actions/*`
   (application conforme à 04-moteur §8, confirmations côté UI pour
   `reduce_category` qui crée un plafond).
4. `ai/tools.js` + `ai/advisor.js#chat` (toolRunner, outils strict, historique
   append-only) ; routes `/advisor/chat`, `/advisor/thread*`.
5. Web **Conseiller** : rapport (headline, body rendu en markdown léger sûr —
   pas de `v-html` brut sans échappement), cartes d'action avec effet chiffré
   (« +12 000 F libres »), Appliquer/Ignorer, fil de chat ; les `ask_advisor` de
   P4 ouvrent le chat pré-rempli.
6. Aujourd'hui : la carte d'alerte affiche le `headline` du rapport quand il existe.

**Acceptation P6** : en mock, le rapport s'affiche (gabarit) et ses actions
s'appliquent en modifiant bien les projets/règles ; le garde-fou rejette un
texte contenant un nombre absent (test) ; avec une vraie clé, « Je peux
m'acheter une console à 400 000 ? » déclenche `check_purchase` et la réponse
cite le mois du verdict moteur.

---

## P7 — Apprentissage, rituel mensuel, finitions

1. `complete_plan` : `estimate_expected` figé, `learning` branché dans le
   snapshot (`donePlans`), marges apprises visibles dans le formulaire
   (« marge suggérée 25 % — tu sous-estimes souvent l'Électronique »).
2. Revue mensuelle (01-produit P5) : bannière à la 1re ouverture du mois,
   écran récapitulatif, reconduction des règles, replanification des projets en
   retard.
3. `transfers` + compte épargne (épargne réalisée = transferts vers `savings`).
4. Tags : filtre transactions par tag ; quotas `tag_cap` dans Règles.
5. `GET /export` JSON ; import CSV simple (date, montant, note, catégorie) optionnel.
6. Page Confidentialité mise à jour (Anthropic, Groq, pas de conservation audio).
7. README V2 complet (fonctionnalités, variables d'env, déploiement Render,
   keepalive optionnel, coûts IA, réglage `AI_MODEL_PARSE`).
8. Passe d'accessibilité (contrastes, labels, focus visibles, cibles 44 px) et
   de performance (lazy routes, taille du bundle < 250 ko gz hors police).

**Acceptation P7** : réaliser 3 projets « Électronique » sous-estimés de 20 %
fait apparaître la marge apprise 25 % ; la revue mensuelle s'affiche une seule
fois par mois et par appareil ; README à jour.

---

## Variables d'environnement finales (`server/.env.example`)

```
DATABASE_URL=…
SESSION_SECRET=…
ANTHROPIC_API_KEY=            # vide = mode sans IA (quickParse + gabarits)
AI_PROVIDER=anthropic         # anthropic | mock
AI_MODEL_PARSE=claude-opus-5-5
AI_MODEL_ADVISOR=claude-opus-5-5
GROQ_API_KEY=                 # vide = micro désactivé
TRANSCRIBE_PROVIDER=groq      # groq | mock
DEFAULT_CURRENCY=XOF
SEED_USER_EMAIL / SEED_USER_PASSWORD / SEED_USER_NAME
PORT=4000
NODE_ENV=development
```

## Risques et parades

| Risque | Parade |
|---|---|
| Migration `amount_cents` mal générée (DROP au lieu de RENAME) | Relire le SQL généré ; test de migration P0 obligatoire |
| Helper `zodOutputFormat` incompatible avec zod 3 | Monter zod en v4 dans tout le monorepo (P4.4) |
| Safari iOS : MediaRecorder `audio/mp4` uniquement, permissions micro par session | Détection du mimeType ; message de permission ; test réel |
| Render gratuit lent au réveil | P3 (cache + outbox) ; keepalive optionnel |
| Sur-promesse de l'IA (chiffres faux) | Garde-fou §6 + moteur seul source des chiffres |
| Coût IA | Cache de prompt, effort bas pour le parsing, cache des rapports ; option `claude-haiku-5-5` pour le parsing |
| Dérive de périmètre | Respecter l'ordre des phases ; tout ajout hors plan → noter dans `docs/v2/IDEAS.md`, ne pas l'implémenter |
