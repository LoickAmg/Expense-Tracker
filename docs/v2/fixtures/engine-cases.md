# Cas chiffrés du moteur (à transformer en tests vitest)

Montants en XOF. `buffer` = matelas. Sauf mention, marges par défaut :
estimated 0,15 / rough 0,30. Toutes les valeurs attendues ont été calculées à
la main selon 04-moteur.md ; si un test échoue, **corriger le code, pas le cas**
(sauf erreur démontrée dans le cas — la signaler en commentaire).

## R — Résolution des montants

| # | entrée | prudent | probable | optimiste |
|---|---|---|---|---|
| R1 | dépense known 50 000 | 50 000 | 50 000 | 50 000 |
| R2 | estimated 50 000 (marge défaut 0,15) | 57 500 | 50 000 | 50 000 |
| R3 | estimated 43 210 | 49 700 (49 691,5 → centaine sup.) | 43 210 | 43 210 |
| R4 | rough 40 000–50 000 | 50 000 | 45 000 | 40 000 |
| R5 | rough 40 000–50 000, marginPct 0,10 | 55 000 | 45 000 | 40 000 |
| R6 | unknown, max 200 000 | 200 000 | 160 000 | 160 000 |
| R7 | unknown, sans max | null | null | null |
| R8 | estimated 50 000, marge apprise catégorie 0,25 | 62 500 | 50 000 | 50 000 |
| R9 | revenu likely 200 000 sans min | 160 000 | 200 000 | 200 000 |
| R10 | revenu likely 150 000–250 000, amount null | 150 000 | 200 000 | 250 000 |
| R11 | revenu uncertain 200 000 | 0 | 100 000 | 200 000 |
| R12 | goal cible 300 000, reserved 40 000 | reste à constituer = 260 000 | | |

## B — Dépenses courantes (baseline)

| # | historique (3 mois complets) | plancher | base prudent / probable / optimiste |
|---|---|---|---|
| B1 | Restaurants 24 000, 36 000, 30 000 | — | 33 000 / 30 000 / 27 000 |
| B2 | Alimentation 50 000, 55 000, 65 000 (moy. 56 667) | 60 000 | 66 000 / 60 000 / 60 000 |
| B3 | Loisirs : 1 seul mois, 12 000 | — | 13 200 / 12 000 / 10 800 |
| B4 | Santé : aucun historique, plafond 20 000 | — | 22 000 / 20 000 / 18 000 + `LOW_HISTORY` |

## M — Mois courant (allure)

M1 : today = 2026-10-10 (jour 10 / 31). Restaurants base B1, dépensé ce mois 20 000.
- reste prudent : max(33 000 − 20 000, allure 62 000 − 20 000) = **42 000**
- reste probable : **10 000** ; reste optimiste : **7 000**
- avec plafond 30 000 → diagnostic `CATEGORY_PACE` (pas encore dépassé :
  20 000 < 30 000), params `{ projected: 62000, cap: 30000, spent: 20000, rest: 10000, daysLeft: 22 }`,
  action `limit_category_rest { amount: 10000, until: "2026-10-31" }`.

M2 : même chose au jour 4 → pas d'allure (d < 5) : reste prudent 13 000.

## F — Libre à dépenser

Commun F1–F4 : un compte 200 000, rien de réservé, aucun historique de
dépenses courantes (bases à 0), pas d'épargne, horizon 2 mois.

| # | données | min A' (date) | FTS | par jour |
|---|---|---|---|---|
| F1 | today 2026-10-20, buffer 50 000, loyer récurrent 75 000 le 5, salaire récurrent 350 000 le 28 | 200 000 (2026-10-20) | **150 000** | 12 500 (12 jours) |
| F2 | idem mais loyer le **25** | 125 000 (2026-10-25) | **75 000** | 6 250 ; `bindingReason` = loyer du 25/10 |
| F3 | loyer le 25 ; salaire remplacé par un **revenu attendu uncertain** 350 000 en octobre et en novembre (projets) | 50 000 (2026-11-25) | **0** | 0 ; pas de `SHORTFALL` (50 000 = buffer) ; `INCOME_DEPENDENCY` non émis (rien ne dépend du revenu) |
| F4 | F3 avec buffer 60 000 | 50 000 (2026-11-25) | **0** | `SHORTFALL` critical, `params.gap = 10000`, `params.date = "2026-11-25"` |

F5 : F1 + catégorie non essentielle Restaurants base 30 000 → le FTS **n'est pas**
diminué par le reste Restaurants de M0 (c'est ce qu'on mesure), mais l'est par
celui de novembre (33 000 prudent réparti sur novembre). Vérifier :
min A' ≥ 150 000 − 0 sur octobre ; résultat attendu FTS = **150 000** (le
minimum reste à today car le salaire du 28/10 couvre novembre).

F6 : F1 + catégorie **essentielle** Alimentation base 60 000 (prudent 66 000),
dépensé ce mois 40 000 → reste prudent M0 = 26 000 réparti sur 12 jours ;
A' baisse jusqu'au 27/10 : 200 000 − 26 000 × 8/12 ≈ 182 667 (répartition entière exacte
requise) ; minimum au 27/10 juste avant salaire → FTS ≈ **132 667** (tester
avec la répartition entière du code : la valeur exacte doit égaler
200 000 − (somme des parts des jours 20→27) − 50 000).

## A — Arbitrage

Base : F1 avec horizon **3 mois** (oct–déc). Série A prudente sans envies :
20/10 200 000 · 28/10 550 000 · 05/11 475 000 · 28/11 825 000 · 05/12 750 000 · 28/12 1 100 000.

Envies (ordre de priorité) :
- A « Clavier » rough 40 000–50 000, `should` → X = 50 000
- B « Téléphone » unknown max 200 000, `could` → X = 200 000
- C « Console » known 400 000, `nice` → X = 400 000
- D « Montre » unknown sans max, `could` → X = null

| envie | calcul | verdict |
|---|---|---|
| A | dès today : min 200 000 − 50 000 = 150 000 ≥ 50 000 | **now** ; A devient 150k/500k/425k/775k/700k/1 050k |
| B | today : min 150 000 − 200 000 < buffer ✗ ; 01/11 : min(425 000…) − 200 000 = 225 000 ✓ | **2026-11** ; A : 28/10 500k inchangé, 05/11 225k, 28/11 575k, 05/12 500k, 28/12 850k |
| C | today ✗ (150k) ; 01/11 : min 225 000 − 400 000 ✗ ; 01/12 : min 500 000 − 400 000 = 100 000 ✓ | **2026-12** |
| D | | **needs_price** + `PLAN_UNPRICED` |

A2 : même jeu, Console passée en `must` → traitée en premier :
today : min 200 000 − 400 000 ✗ ; 01/11 : min(475k, 825k, 750k, 1 100k) = 475 000 − 400 000 = 75 000 ✓ → **2026-11**.
A devient : 20/10 200k · 28/10 550k · 05/11 75k · 28/11 425k · 05/12 350k · 28/12 700k.
Clavier : today min 75 000 − 50 000 = 25 000 ✗ ; 01/11 idem ✗ ; 01/12 : min 350 000 − 50 000 ✓ → **2026-12**
(la console « vitale » repousse le clavier — c'est le comportement voulu).
A : 05/12 300k · 28/12 650k. Téléphone : 01/12 : 300 000 − 200 000 = 100 000 ✓ → **2026-12**.

A3 : Clavier avec `earliest_month = 2026-12` → verdict 2026-12 même si faisable avant.

A4 : quota `category_cap` **hard** Électronique 30 000/mois, Clavier en
Électronique (X = 50 000 > 30 000) → infaisable chaque mois → `beyond_horizon`,
`reason = blocked_by_hard_cap`.

## S — Simulation

S1 : `simulate(input, [])` → `delta` entièrement nul.
S2 : sur F4, `postpone_plan` d'un achat prévu de 30 000 daté 2026-11-10 vers
2026-12 → `shortfallCovered = true` si horizon s'arrête en novembre (le manque
de 10 000 disparaît) ; delta.freeToSpend ≥ 0.
S3 : `exclude_plan` sur l'envie B de A → B absent de `arbitration`, C passe en
2026-11 ? Vérifier : après A seul, 01/11 : min(425k…, 05/12 700k) = 425 000 −
400 000 = 25 000 < buffer ✗ → C reste **2026-12**.

## L — Apprentissage

L1 : catégorie Électronique, ratios réalisés 1,2 · 1,1 · 1,3 → médiane 1,2 →
marge apprise **0,25** ; diagnostic `ESTIMATION_BIAS` (≥ 1,10, 3 échantillons).
L2 : ratios 0,9 · 0,95 · 1,0 → biais 0,95 → marge = défaut (0,15), pas de diagnostic.
L3 : 2 ratios seulement dans la catégorie, 6 ratios globaux médiane 1,15 →
marge globale 0,20.
