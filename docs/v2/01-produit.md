# 01 — Spécification produit

## 1. Problème

L'utilisateur a beaucoup d'idées et d'envies en tête, en perd une partie, fait
certaines dépenses et en oublie d'autres, et n'a pas de vision d'ensemble.
L'app doit **capturer vite** (avant d'oublier), **structurer** (même quand le
prix est inconnu), et **arbitrer** (dire quoi réduire, reporter, garder,
provisionner).

## 2. Vocabulaire (à utiliser tel quel dans l'UI et le code)

| Terme UI (FR) | Code | Définition |
|---|---|---|
| Capture | `capture` | Une saisie brute (texte, vocal, formulaire). Produit des *propositions*. |
| Proposition | `proposal` / `operation` | Une action suggérée par l'analyse d'une capture (créer une dépense, un projet, une règle…), à valider. |
| Dépense / Revenu | `transaction` | Mouvement d'argent **réel, déjà passé**. |
| Projet | `plan` | Mouvement **futur** : obligation, achat prévu, envie, objectif d'épargne, revenu attendu. |
| Obligation | `kind=obligation` | Dépense future non négociable (loyer exceptionnel, scolarité, facture). |
| Achat prévu | `kind=planned` | Dépense future décidée. |
| Envie | `kind=wish` | Dépense souhaitée, non décidée, que le moteur peut placer ou refuser. |
| Objectif | `kind=goal` | Somme à constituer (fonds d'urgence, voyage). Financée par « mises de côté ». |
| Revenu attendu | `kind=income` | Rentrée future plus ou moins sûre (client, prime, remboursement). |
| Certitude du prix | `certainty` | `known` (connu) · `estimated` (estimé) · `rough` (approximatif, « environ ») · `unknown` (à chercher). |
| Marge | `marginPct` | Majoration de sécurité appliquée aux prix non connus. |
| Règle | `quota` | Plafond, minimum, épargne, matelas, limite d'habitude. |
| Matelas de sécurité | `safety_buffer` | Solde en dessous duquel on ne veut jamais descendre. |
| Mis de côté | `reservedAmount` | Argent déjà réservé pour un projet (reste sur le compte mais n'est plus « libre »). |
| Libre à dépenser | `freeToSpend` | Ce qu'on peut dépenser d'ici la fin du mois sans casser les engagements, réserves, minimums et matelas. |
| Scénarios | `pessimistic` / `expected` / `optimistic` | Prudent / Probable / Optimiste. **Les décisions se prennent sur Prudent.** |
| Diagnostic | `diagnostic` | Constat chiffré produit par le moteur (déterministe). |
| Conseil | `advice` | Texte rédigé (IA ou gabarit) à partir des diagnostics + actions proposées. |

## 3. Parcours clés

### P1 — Capture vocale express (cas central)
1. Depuis n'importe quel écran, gros bouton micro (FAB). Tap = démarre, tap =
   stop (pas d'appui long obligatoire ; durée max 2 min, compteur visible).
2. L'audio est **immédiatement** stocké en local (IndexedDB) → toast
   « Enregistré ». L'utilisateur peut fermer l'app.
3. En ligne : envoi → transcription → analyse → la capture passe en
   « À valider » (badge sur l'onglet).
4. Écran Revue : transcription affichée (éditable), sous elle les cartes de
   propositions. Chaque carte = formulaire pré-rempli modifiable. Questions de
   l'IA en *chips* de réponse rapide (« Quel mois ? » → [Ce mois] [Mois
   prochain] [Pas de date]).
5. **Tout valider** ou valider/rejeter carte par carte. Toast « 3 éléments
   ajoutés — Annuler ».

### P2 — Capture texte
Même flux, champ texte multiligne (« Dis-moi tout, en vrac »). Si pas de clé
IA ou IA en panne : la **saisie rapide par règles** reconnaît les formes
simples (`taxi 2000`, `-3500 resto`, `+150000 salaire`) et propose une dépense.

### P3 — Formulaires rapides (« menus / toggles »)
Chips en haut de la feuille de capture : **Dépense · Achat prévu · Envie ·
Revenu attendu · Règle**. Chaque chip ouvre un mini-formulaire :
- Titre (texte, autocomplétion sur l'historique)
- Montant : segmented control **Connu / Estimé / Environ / Je ne sais pas**
  - Connu → un champ
  - Estimé → champ + marge (slider 0–50 %, défaut appris ou 15 %)
  - Environ → fourchette min–max (double champ)
  - Je ne sais pas → champ facultatif « Pas plus de » + toggle « À chercher »
- Quand : chips **Ce mois · Mois prochain · Date précise · Un jour**
- Priorité : chips **Vital · Important · Bien · Bonus** (`must/should/could/nice`)
- Toggle **Flexible** (le moteur peut le déplacer) — par défaut ON pour les
  envies, OFF pour les obligations
- Catégorie (pré-suggérée)
- Toggle « Mettre de côté chaque mois » (projets/objectifs)

### P4 — « Est-ce que je peux… ? »
Dans le Conseiller ou via la capture (l'IA détecte une question) :
« Je peux m'acheter le clavier à 50 000 ce mois-ci ? » → le chat appelle
l'outil de simulation → réponse chiffrée + cartes d'action (« Le planifier en
décembre », « Réduire Restaurants de 10 000 F »).

### P5 — Revue mensuelle (rituel)
Le 1er du mois (ou à la 1re ouverture du mois) : bannière « Clôture de
octobre » → résumé (dépensé vs règles, projets réalisés, écarts
d'estimation), projets en retard à replanifier, envies à reconsidérer,
proposition des règles du mois suivant (reprendre / ajuster).

### P6 — Consultation hors-ligne / serveur endormi
L'app s'ouvre instantanément sur le dernier état connu (bandeau « Données du
28/10 à 14:02 — mise à jour… »). Les saisies sont en file d'attente avec un
indicateur (« 2 en attente d'envoi »).

## 4. Écrans

Navigation **mobile** (barre du bas) : `Aujourd'hui` · `Plan` · **[🎤 FAB]** ·
`Conseiller` · `Plus`. **Desktop** : barre latérale gauche avec les mêmes
entrées + `Transactions`, `Règles`, `Paramètres` ; le FAB devient une barre de
capture en haut de l'écran Aujourd'hui + raccourci clavier `N` (nouvelle
capture) et `M` (micro).

| Écran | Route | Contenu |
|---|---|---|
| Aujourd'hui | `/` | Carte héro **Libre à dépenser** (+ par jour, + jours restants) ; solde réel ; 3 alertes max (diagnostics triés) ; échéances 7 jours ; badge captures à valider ; mini-barres des règles du mois |
| Revue | `/revue` | Captures `needs_review` puis `failed` ; transcription + cartes |
| Plan | `/plan` | Sélecteur d'horizon (3/6/12 mois) ; graphique du solde (bande prudent–optimiste + ligne probable + ligne du matelas) ; liste par mois des projets ; section **Envies** avec verdict d'arbitrage ; réordonnancement par glisser ; toggles « inclure » pour *Et si ?* (calcul local via `core`) |
| Projet (détail) | `/plan/:id` | Formulaire complet ; historique (journal) ; « Mettre de côté X » ; « Marquer comme payé » (crée la transaction, demande le montant réel) |
| Conseiller | `/conseiller` | Dernier rapport (date, bouton Actualiser) ; cartes d'action ; fil de discussion |
| Transactions | `/transactions` | Existant + compte, tags, origine (capture/récurrence/projet) |
| Règles | `/regles` | Liste des quotas groupés (Plafonds, Minimums, Épargne, Matelas, Habitudes) avec progression du mois |
| Paramètres | `/parametres` | Catégories (+ « essentielle », mots-clés), comptes, récurrences, devise, fuseau, IA (état des clés, mode validation auto), indices de transcription, export CSV/JSON |

## 5. Règles UX non négociables

- **Saisie ≤ 3 s** jusqu'au « Enregistré » (audio/texte stockés localement
  d'abord).
- **Jamais de chiffre IA non vérifié** à l'écran (cf. 05-ia.md §6).
- Les montants s'affichent `62 000 F` (espace fine insécable, suffixe `F`
  configurable → `FCFA`). Saisie tolérante : `50k`, `50 000`, `50.000`,
  `50 mille`.
- Les éléments incertains portent un marqueur visuel : `≈` (estimé/environ),
  `?` (inconnu), avec la marge affichée au survol/tap.
- Toujours afficher **sur quel scénario** repose un verdict (« en prudent »).
- Toute action destructrice ou issue de l'IA est annulable 10 s (toast) et
  réversible ensuite via le journal.
- Mobile d'abord : cibles ≥ 44 px, formulaires en *bottom sheet*, pas de
  survol requis.
- Langue : français, tutoiement (cohérent avec le ton conseiller).
