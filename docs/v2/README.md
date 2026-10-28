# Expense Tracker V2 — « Copilote financier »

Dossier de conception complet de la V2. **Aucune ligne de code applicatif n'est
écrite ici** : ce dossier est la spécification que l'agent d'implémentation
(Sonnet) exécute phase par phase.

> Objectif utilisateur : vider son « bazar mental » financier (à l'écrit, à la
> voix ou via de petits formulaires à toggles) et obtenir en retour un plan
> organisé, des prévisions qui tiennent compte de l'incertitude des prix, et
> des conseils concrets (« réduis ceci », « reporte cela », « provisionne pour
> ça »). Utilisable sur PC **et** téléphone, données synchronisées, utilisable
> en urgence (même avec un réseau faible).

## Sommaire

| Fichier | Contenu |
|---|---|
| [01-produit.md](01-produit.md) | Vision, vocabulaire, parcours utilisateur, écrans, règles UX |
| [02-architecture.md](02-architecture.md) | Stack, monorepo, PWA/hors-ligne/sync, pipeline audio, IA, sécurité, hébergement |
| [03-donnees.md](03-donnees.md) | Schéma de base complet (Drizzle), migration depuis la V1 |
| [04-moteur.md](04-moteur.md) | Moteur déterministe : solde, « libre à dépenser », prévisions 3 scénarios, arbitrage, diagnostics, simulation |
| [05-ia.md](05-ia.md) | Parsing des captures, conseiller, prompts complets, schémas, garde-fous, évaluation |
| [06-api.md](06-api.md) | Contrat de l'API REST |
| [07-plan.md](07-plan.md) | **Plan d'implémentation phasé** avec critères d'acceptation |
| [SONNET_BRIEF.md](SONNET_BRIEF.md) | Le prompt à donner à Sonnet pour lancer chaque phase |
| [fixtures/captures.json](fixtures/captures.json) | Jeu d'énoncés FR → opérations attendues (tests + éval IA) |
| [fixtures/engine-cases.md](fixtures/engine-cases.md) | Cas chiffrés du moteur (tests unitaires) |

## Décisions structurantes (ADR résumées)

| # | Décision | Pourquoi |
|---|---|---|
| D1 | **On garde la stack** : Vue 3 + Pinia + Vite / Express + Drizzle + PostgreSQL (Neon). Pas de réécriture. | Aucune limite fondamentale : les manques (hors-ligne, mobile, audio, IA, devise) se règlent par ajout. Réécrire ferait perdre 61 tests et des semaines. |
| D2 | **Nouveau workspace `core/`** (JS pur, ESM, seule dépendance `zod`) contenant le **moteur financier** et les **schémas partagés**. Utilisé par le serveur **et** le front. | Le moteur tourne aussi dans le navigateur → « Et si ? » instantané et prévisions consultables **hors-ligne**. Une seule source de vérité pour les schémas. |
| D3 | **L'IA ne calcule jamais d'argent.** Le moteur déterministe calcule ; le LLM (1) transforme le langage naturel en *propositions* structurées que l'utilisateur valide, (2) rédige les conseils à partir de diagnostics déjà chiffrés, (3) pilote des outils de simulation dans le chat. | Fiabilité : pas de chiffres inventés. L'app reste 100 % utile **sans clé API** (gabarits de messages + saisie rapide par règles). |
| D4 | **Devise FCFA (XOF), montants entiers** (XOF n'a pas de sous-unité). Colonnes `amount` en entiers « unités mineures » + `currency` sur l'utilisateur. | Le code V1 est figé en EUR/centimes. On généralise proprement (exposant ISO 4217) sans bloquer un futur multi-devise. |
| D5 | **Serveur = source de vérité ; client PWA avec file d'attente hors-ligne** (IndexedDB) + cache du dernier « snapshot ». Pas de CRDT. | Mono-utilisateur, 2 appareils : le *last-write-wins* + identifiants client idempotents suffit. Bien plus simple que du local-first complet. |
| D6 | **Render gratuit conservé** (choix utilisateur). Mitigations : coque PWA instantanée, saisies enregistrées localement d'abord, ping de réveil au lancement, ping planifié optionnel. | Le réveil (~50 s) ne doit jamais bloquer une saisie urgente. |
| D7 | **Transcription : Groq Whisper** (`whisper-large-v3-turbo`, `language: "fr"`), derrière une interface `Transcriber` interchangeable. | Rapide, excellent en français, coût négligeable. Claude ne fait pas de reconnaissance vocale. |
| D8 | **LLM : Claude via `@anthropic-ai/sdk`**, modèle par défaut `claude-opus-5-5` (configurable par variable d'env), sorties structurées (`output_config.format`) + outils `strict`. | Qualité de compréhension du français oral « désordonné » ; structure garantie par schéma. |
| D9 | **Tout ce que l'IA propose passe par une validation** (une tape « Tout valider ») et est **annulable** (journal d'activité). | Confiance : l'utilisateur garde la main sur ses données financières. |

## Ce que l'utilisateur obtient à la fin

1. Un bouton micro : « Je dois payer la scolarité de 150 000 avant le 15, et
   je veux un clavier, je sais pas le prix, peut-être 40 ou 50 mille » →
   2 cartes pré-remplies (obligation datée + envie avec fourchette) → *Valider*.
2. Un écran **Aujourd'hui** : « Libre à dépenser : 62 000 F — soit 4 100 F/jour
   jusqu'au 31 », les 3 alertes les plus importantes, les échéances des 7
   prochains jours.
3. Un écran **Plan** : courbe du solde sur 3 à 12 mois (prudent / probable /
   optimiste), envies classées « Possible maintenant / Possible en janvier /
   Hors budget / Prix à chercher », interrupteurs « Et si ? ».
4. Un **Conseiller** : rapport rédigé (« Au rythme actuel, Restaurants finira à
   48 000 F pour un plafond de 30 000 F : réduire de 2 sorties/semaine libère
   assez pour le clavier en décembre ») + cartes d'action applicables + chat.
5. Des **règles** : plafonds, minimums à garder, épargne minimale, matelas de
   sécurité, limites d'habitudes (ex. « taxi max 15 000 F/semaine »).
6. Le tout synchronisé PC ↔ téléphone, installable comme une app (PWA).
