# 04 — Moteur financier déterministe (`core/src/engine`)

Le moteur est le « cerveau » de l'app. Il est **pur** (aucune E/S, aucune
horloge implicite), **entier** (aucun flottant stocké, arrondis explicites), et
**déterministe** (même entrée → même sortie, tri stable avec `id` en
départage). Il tourne côté serveur et côté navigateur.

```
runEngine(input: EngineInput, options?: { adjustments?: Change[] }) → EngineOutput
simulate(input, changes: Change[]) → { output, delta }
```

## 0. Helpers d'arrondi (core/src/money.js)

- `ceil100(x)` = arrondi à la centaine **supérieure** (prudence sur les dépenses).
- `floor100(x)` = arrondi à la centaine **inférieure** (prudence sur les revenus).
- Les autres moyennes : `Math.round`.
- Ces pas d'arrondi utilisent `roundingStep` = 100 pour XOF (config par devise ;
  EUR → 1 en unités mineures = 0,01 €).

## 1. Entrée (`EngineInputSchema`)

Construite par `server/src/services/snapshot.js` (et mise en cache côté client).

```js
{
  today: "2026-10-28",             // dans le fuseau de l'utilisateur
  currency: "XOF",
  horizonMonths: 6,                // 3 | 6 | 12
  settings: { defaultMargins: { estimated: 0.15, rough: 0.30 } },
  accounts: [{ id, name, kind, balance }],          // solde courant calculé en SQL (ouverture + mouvements ≤ today)
  categories: [{ id, name, type, essential }],
  history: [{ month: "2026-07", categoryId, variableTotal, recurringTotal, planTotal, count }], // 4 mois complets précédents + mois courant
  monthToDate: { byCategory: { [categoryId]: variableSpent }, byTag: { [tag]: { amount, count, weekAmount, weekCount } }, savedThisMonth },
  futureTransactions: [{ id, date, amount, type, categoryId }],  // transactions datées > today
  recurring: [{ id, amount, type, categoryId, frequency, dayOfPeriod, startDate, endDate, lastGeneratedDate, active }],
  plans: [ /* actifs + brouillons */ ],
  donePlans: [{ id, categoryId, certainty, estimateExpected, actualAmount, doneAt }], // 24 derniers mois, pour l'apprentissage
  quotas: [ /* actifs, permanents + surcharges du mois courant et des mois de l'horizon */ ],
  adjustments: [],                 // changements de simulation (§8), vide en temps normal
}
```

« Variable » = dépense sans `recurring_id` ni `plan_id` (le quotidien).

Mois : `M0` = mois de `today`, puis `M1 … M(h-1)`. Fin d'horizon = dernier jour
de `M(h-1)`.

## 2. Résolution des montants incertains (`resolve.js`)

`resolvePlan(plan, ctx) → { pessimistic, expected, optimistic } | null`

**Dépenses** (obligation, planned, wish, goal) :

| certainty | prudent | probable | optimiste |
|---|---|---|---|
| known | amount | amount | amount |
| estimated | ceil100(amount × (1 + m)) | amount | amount |
| rough | max (ou ceil100(max × (1 + marginPct)) si marginPct explicite) | round((min+max)/2) | min |
| unknown + amount_max | max | ceil100(max × 0,8) | idem probable |
| unknown sans max | **null** → « prix à chercher » | null | null |

`m` = `plan.marginPct` ?? marge apprise de la catégorie (§9) ??
`settings.defaultMargins[certainty]`.

Pour `goal` : montant = cible ; le **reste à constituer** = max(0, cible − reserved).

**Revenus** (`kind = income`) :

| likelihood | prudent | probable | optimiste |
|---|---|---|---|
| sure | amount | amount | amount |
| likely | amount_min ?? floor100(amount × 0,8) | amount ?? round((min+max)/2) | amount_max ?? amount |
| uncertain | **0** | round(amount × 0,5) | amount_max ?? amount |

Règle d'or : **les décisions (libre à dépenser, arbitrage, alertes) utilisent
le scénario prudent**. Les deux autres servent à l'affichage (bande) et au
diagnostic `INCOME_DEPENDENCY`.

## 3. Placement temporel des projets

`effectiveMonth(plan)` = mois de `target_date` ?? `target_month` ?? null.

| cas | traitement |
|---|---|
| effectiveMonth < M0 et status active | replacé en M0 (jour = today) + diagnostic `PLAN_OVERDUE` |
| obligation / planned avec mois | **engagé** dans ce mois |
| obligation / planned sans mois | non projeté + `PLAN_UNSCHEDULED` (sauf `flexible` → passe à l'arbitrage) |
| wish non flexible avec mois | engagé |
| wish flexible, ou sans mois | **arbitrage** (§6) |
| goal | réservations mensuelles (§4.3) ; jamais « payé » par le moteur |
| income | entrée dans son mois |
| status draft | ignoré par la projection, listé dans `drafts` |

Jour d'un événement non daté exactement dans son mois :
- dépense prudente → 1er du mois (M0 : today) ;
- revenu : prudent → dernier jour du mois, probable → le 15, optimiste → le 1er.

## 4. Projection journalière (`forecast.js`)

On simule **jour par jour** de `today` à la fin d'horizon (≤ 366 jours × 3
scénarios : trivial en coût) car les **dates comptent** (« le loyer tombe le 5,
le salaire le 28 »).

### 4.1 Séries
- `B[t]` : solde de trésorerie total (tous comptes, y compris épargne).
- `R[t]` : montant réservé (non libre) = mises de côté des projets + soldes
  des comptes `savings` + allocations d'épargne de la période.
- `A[t] = B[t] − R[t]` : **disponible**.

Initialisation (début de `today`) :
`B = Σ accounts.balance`, `R = Σ plans.reserved_amount (actifs) + Σ balance des comptes savings`.

### 4.2 Événements datés appliqués à B
- Occurrences récurrentes strictement après `max(today − 1, lastGeneratedDate)`
  jusqu'à la fin d'horizon (`core/recurring.js` : `occurrencesBetween(rule, afterISO, untilISO)`,
  extraction de l'actuel `computeOccurrences` ; respecter `endDate`). Revenu ⇒ +, dépense ⇒ −.
- `futureTransactions`.
- Projets engagés (montant résolu du scénario) ; à la date du paiement,
  `R −= min(plan.reserved_amount + réservations simulées, montant)`
  (l'argent mis de côté est « consommé »).
- Revenus attendus.

### 4.3 Allocations appliquées à R (sans toucher B)
- **Objectifs** : chaque 1er du mois (M1…), `R += monthly_reservation`
  (ou, si null et target_month défini, `ceil100(reste / mois restants)`),
  plafonné au reste à constituer.
- **Épargne** (quotas `savings_rate` / `savings_amount`) : objectif du mois =
  max(rate × revenus du mois dans le scénario, amount). En M0 : `max(0, objectif − monthToDate.savedThisMonth)`
  appliqué à `today` ; en Mk : appliqué le jour du plus gros revenu du mois
  (sinon le 1er).

### 4.4 Dépenses courantes (variables), appliquées à B, réparties par jour
`baseline.js` → pour chaque catégorie de dépense `c` :

```
hist = mois complets parmi M-3..M-1 ayant au moins une transaction (n = 0..3)
base = n > 0 ? round(Σ variableTotal / n) : (cap_c ?? floor_c ?? 0)   // n = 0 → diagnostic LOW_HISTORY
base = max(base, floor_c ?? 0)                                         // un minimum essentiel sera dépensé
base += Σ adjustments.reduce_category(c) applicables au mois           // simulation
prudent = ceil100(base × 1,10) ; probable = base ; optimiste = max(floor100(base × 0,90), floor_c ?? 0)
```

Mois courant M0, `spent = monthToDate.byCategory[c]`, `d` = jour du mois, `D` = jours du mois :
```
reste[s]     = max(0, base[s] − spent)
si d ≥ 5 :  allure = round(spent / d × D) ; reste[prudent] = max(reste[prudent], allure − spent)
```
Le reste est réparti uniformément sur les jours restants de M0 (today inclus) ;
pour Mk, `base[s] / D` par jour. Les montants journaliers sont calculés en
répartissant l'entier exactement (les premiers jours reçoivent le +1 du reste
de la division) pour que la somme mensuelle soit exacte.

### 4.5 Sortie mensuelle
Pour chaque mois et scénario : `startBalance, inflow, committed, variable,
endBalance, reservedEnd, availableEnd, minAvailable, minAvailableDate`.
Pour le graphique : série hebdomadaire échantillonnée (`A` en fin de semaine
+ minimum de la semaine) par scénario.

## 5. Libre à dépenser (`freeToSpend.js`)

Définition : **ce que tu peux dépenser en plus, d'ici la fin du mois, en
« non-essentiel », sans faire passer le disponible prudent sous le matelas à
aucun moment de l'horizon.**

```
A' = série A du scénario prudent, calculée en retirant la dépense variable
     restante de M0 des catégories NON essentielles (c'est elle qu'on mesure)
FTS = max(0, min_{t ≥ today} A'[t] − buffer)
perDay = floor(FTS / joursRestants)   // joursRestants inclut aujourd'hui
bindingDate = premier t qui atteint le minimum
```
`buffer` = quota `safety_buffer` actif (0 si aucun).

`breakdown` (pour l'écran « Comment c'est calculé ? ») : `balance`, `reserved`,
`buffer`, `upcomingCommitted` (d'ici fin de mois), `essentialsRemaining`,
`savingsRemaining`, `sureIncomeBeforeEOM`, `bindingDate`, `bindingReason`
(événement du jour minimal, ex. « Loyer le 25/10 »).

Les envies non arbitrées ne sont **pas** retirées du FTS : l'écran Plan montre
« Clavier possible maintenant — utiliserait 50 000 de tes 150 000 F libres ».

## 6. Arbitrage des envies (`arbitrate.js`)

Candidats : wishes actifs (flexibles ou sans mois) + planned/obligation
flexibles sans mois. Ordre de traitement (stable) :
1. priorité `must < should < could < nice`
2. `sort_order` croissant (ordre manuel de l'utilisateur)
3. mois cible croissant (null en dernier)
4. `created_at`, puis `id`

Algorithme glouton sur la série `A` prudente **complète** (y compris dépense
variable non-essentielle prévue — on ne finance pas une envie en supposant
qu'on arrête de manger dehors, sauf si une action `reduce_category` le simule) :

```
pour chaque candidat P :
  X = resolvePlan(P).pessimistic ; si null → verdict "needs_price" ; continuer
  premier = max(M0, P.earliest_month ?? M0)
  préféré = P.target_month (si ≥ premier)
  pour m de premier à M(h-1) (en essayant d'abord préféré s'il existe) :
     jour = (m == M0) ? today : 1er de m
     faisable = min_{t ≥ jour} A[t] − X ≥ buffer
                ET aucun quota category_cap "hard" de la catégorie de P dépassé en m
                   (base probable de la catégorie en m + X > plafond ⇒ infaisable)
     si faisable : verdict = (m == M0 ? "now" : "month"), month = m ;
                   A[t ≥ jour] −= X ; arrêter
  sinon verdict = "beyond_horizon",
        moisNécessaires = surplus mensuel probable moyen > 0
                          ? ceil((X − (min_{t≥today} A[t] − buffer)) / surplus) : null
```

Sortie : `[{ planId, verdict, month, amountUsed: X, headroomAfter, reason }]`,
`reason` étant un code (`fits`, `after_income`, `blocked_by_shortfall`,
`blocked_by_hard_cap`, `no_price`, `too_big`).

## 7. Diagnostics (`diagnostics.js`)

Chaque diagnostic : `{ code, severity: "critical"|"warning"|"info", impact (montant absolu en jeu, pour trier), params: {…chiffres…}, entity?: {type, id}, actions: Action[] }`.
Tri : sévérité, puis impact décroissant. Seuils dans `core/src/engine/config.js`.

| code | condition | sévérité | actions générées |
|---|---|---|---|
| `SHORTFALL` | min A prudent < buffer sur l'horizon | critical si < 0 ou dans M0/M1, sinon warning | (a) reporter les projets flexibles payés avant la date de manque vers le 1er mois faisable, priorité la plus basse d'abord ; (b) `reduce_category` sur les catégories non essentielles les plus grosses (≤ 30 % de leur base) ; s'arrêter quand le manque est couvert ; 3 actions max |
| `NEGATIVE_BALANCE` | B prudent < 0 | critical | idem SHORTFALL |
| `CATEGORY_OVER_CAP` | spent M0 > plafond | warning (critical si hard) | `set_quota` (augmenter ?) informatif + `reduce_category` sur M1 si récurrent 2 mois de suite |
| `CATEGORY_PACE` | d ≥ 5 et allure > plafond, pas encore dépassé | warning | `limit_category_rest` : « reste X F jusqu'au 31 ≈ Y F/semaine » (X = plafond − spent) |
| `TAG_CAP` | quota d'habitude dépassé ou allure > limite (montant ou nombre, semaine ou mois) | warning | `limit_tag_rest` |
| `FLOOR_AT_RISK` | FTS = 0 et reste essentiel > disponible avant le prochain revenu | critical | reporter projets / reduce non-essentiels |
| `SAVINGS_BEHIND` | jour ≥ 20 et épargne du mois non atteinte, ou épargne prudente non finançable | warning | `reserve_now` (montant manquant) |
| `PLAN_OVERDUE` | date cible passée, projet actif | warning | `schedule_plan` (mois proposé = verdict d'arbitrage), `drop_plan` |
| `PLAN_UNPRICED` | unknown sans max | info (warning si must/should dans ≤ 2 mois) | `set_plan_price` |
| `PLAN_UNSCHEDULED` | planned/obligation sans mois, non flexible | info | `schedule_plan` |
| `WISH_OVERLOAD` | Σ X des envies > 3 × surplus mensuel probable moyen | info | aucune (message : « tes envies = N mois d'épargne ») |
| `WISH_BLOCKED` | envie must/should en `beyond_horizon` | warning | `reduce_category` qui la rendrait faisable à son mois cible (calcul : manque / nb de mois, sur les 2 plus grosses catégories non essentielles), `reserve_monthly` |
| `HABIT_DRIFT` | allure M0 d'une catégorie > 1,25 × base et écart ≥ 5 000 | info | `set_quota` (category_cap = base) |
| `ESTIMATION_BIAS` | biais appris ≥ 1,10 sur ≥ 3 échantillons | info | aucune (la marge apprise s'applique déjà) |
| `GOAL_OFF_TRACK` | reserved + mensuel × mois restants < cible | warning | `reserve_monthly` (montant requis) |
| `INCOME_DEPENDENCY` | un verdict ou l'absence de manque n'existe qu'en scénario probable grâce à un revenu `likely`/`uncertain` | info | aucune (message : « dépend du paiement de X ») |
| `LOW_HISTORY` | < 1 mois d'historique | info | aucune |
| `NO_OPENING_BALANCE` | tous les comptes à 0 et aucune transaction | warning | `open_accounts_setup` |

`params` contient **tous** les nombres que le texte pourra citer (montants
formatables, dates, pourcentages). C'est la liste blanche du garde-fou IA (05-ia §6).

## 8. Actions et simulation (`simulate.js`)

```js
Action =
 | { type: "postpone_plan",      planId, toMonth }
 | { type: "schedule_plan",      planId, month }
 | { type: "drop_plan",          planId }
 | { type: "exclude_plan",       planId }               // « Et si ? » uniquement, jamais persisté
 | { type: "include_plan",       planId, month }        // « Et si ? » : forcer une envie à un mois
 | { type: "set_plan_price",     planId }               // ouvre le formulaire, pas de simulation
 | { type: "reserve_now",        planId, amount }
 | { type: "reserve_monthly",    planId, amount }
 | { type: "reduce_category",    categoryId, amount, fromMonth, months }   // amount par mois
 | { type: "limit_category_rest",categoryId, amount, until }               // informatif
 | { type: "limit_tag_rest",     tag, amount, count, until }
 | { type: "set_quota",          quota: QuotaCreate }
 | { type: "open_accounts_setup" }
```

`simulate(input, changes)` : clone profond de `input`, applique les changements
(projets modifiés, `adjustments` pour les catégories), relance `runEngine`,
renvoie `{ output, delta }` avec
`delta = { freeToSpend, minAvailablePessimistic, shortfallCovered: bool, wishesUnlocked: [planId], wishesMoved: [{planId, from, to}] }`.

Chaque action générée par un diagnostic porte son `effect` = `simulate(input,[action]).delta`.
Une action dont l'effet est nul est supprimée.

Persistance d'une action appliquée (`POST /api/advisor/actions/:id/apply`) :
postpone/schedule → `plans.target_month` (+ `postponed_count` si recul) ;
drop → `status = dropped` ; reserve_now → `reserved_amount +=` (journal `reserve`) ;
reserve_monthly → `monthly_reservation` ; reduce_category → crée/modifie un
quota `category_cap` permanent = base − amount (après confirmation) ; set_quota
→ insert.

## 9. Apprentissage des erreurs d'estimation (`learning.js`)

À la réalisation d'un projet `estimated`/`rough`/`unknown+max` : on stocke
`actualAmount` et `estimateExpected` (montant probable au moment de la
réalisation).

```
ratio = actual / estimateExpected
par catégorie, sur les 5 derniers ratios : si n ≥ 3, biais = médiane
  marge apprise = clamp(biais − 1 + 0,05, 0,05, 0,60) si biais > 1, sinon défaut
global (toutes catégories) si une catégorie a n < 3 et le global n ≥ 5
```
Sortie : `learning.byCategory[categoryId] = { bias, samples, margin }`.

## 10. Sortie (`EngineOutputSchema`)

```js
{
  asOf, currency, horizon: { from, to, months: [...] },
  balance: { total, byAccount: [{id, balance}], reserved, available },
  freeToSpend: { amount, perDay, daysLeft, bindingDate, breakdown },
  months: [{ month, pessimistic: MonthSummary, expected: MonthSummary, optimistic: MonthSummary }],
  weekly: { pessimistic: [{weekStart, end, min}], expected: [...], optimistic: [...] },
  categories: [{ categoryId, essential, baseline: {p,e,o}, spentMonthToDate, pace, cap, floor, status: "ok"|"pace"|"over"|"under_floor" }],
  quotas: [{ quotaId, kind, used, limit, pct, status }],
  plans: [{ planId, effectiveMonth, resolved: {p,e,o} | null, committed: bool, monthlyReservationSuggested }],
  arbitration: [{ planId, verdict, month, amountUsed, reason, monthsNeeded }],
  diagnostics: [Diagnostic],
  drafts: [planId],
  learning: { byCategory },
}
```

## 11. Tests (obligatoires avant toute UI)

`core/tests/engine/*.test.js` implémente **tous** les cas de
[fixtures/engine-cases.md](fixtures/engine-cases.md) + propriétés :
- déterminisme (2 exécutions → `deepEqual`) ;
- prudent ≤ probable ≤ optimiste pour `availableEnd` de chaque mois ;
- ajouter une dépense ne peut jamais augmenter le FTS ;
- `simulate(input, [])` → delta nul ;
- somme des dépenses variables journalières d'un mois = montant mensuel exact ;
- un projet `exclude_plan` n'apparaît plus dans `months[].committed`.
