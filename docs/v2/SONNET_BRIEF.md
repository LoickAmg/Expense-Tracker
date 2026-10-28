# Brief pour l'agent d'implémentation (Sonnet)

Copie-colle le bloc ci-dessous dans une nouvelle session Claude Code (modèle
Sonnet) ouverte sur ce dépôt, en remplaçant `<N>` par la phase à faire
(P0, P1, …). **Une session par phase.** Après chaque phase : relis le résumé,
teste dans le navigateur, puis lance la phase suivante.

---

```
Tu implémentes la V2 de l'Expense Tracker. La conception est TERMINÉE et
fait autorité : docs/v2/ (lis d'abord docs/v2/README.md, puis le fichier de la
phase dans docs/v2/07-plan.md, puis les sections référencées de 01 à 06 et les
fixtures). Tu ne refais pas la conception : tu l'exécutes.

Phase à réaliser : <N>

Règles :
1. Lis CLAUDE.md et le code existant concerné avant d'écrire. Garde le style du
   dépôt (JS ESM, commentaires en français, zod pour valider, asyncHandler,
   contrôles d'appartenance userId sur chaque route, tokens CSS de style.css).
2. Respecte exactement les noms (tables, colonnes, codes de diagnostic, types
   d'actions, routes) des docs. Si une spec est ambiguë ou contradictoire, choisis
   l'option la plus simple compatible avec le reste, applique-la, et note-la dans
   docs/v2/DECISIONS-IMPL.md (date, phase, question, choix). Si une spec te
   semble fausse (ex. un cas chiffré incohérent), ne la contourne pas en silence :
   note-le dans ce fichier et explique-le dans ton résumé final.
3. Tests d'abord pour le moteur (core) : chaque cas de
   docs/v2/fixtures/engine-cases.md devient un test. Corrige le code, pas les cas.
4. Pas d'appel réseau réel dans les tests : AI_PROVIDER=mock,
   TRANSCRIBE_PROVIDER=mock.
5. API Claude : suis docs/v2/05-ia.md (modèle claude-opus-5-5 par défaut via
   variables d'env, output_config.format + zodOutputFormat, outils strict,
   tool_choice auto uniquement, pas de temperature ni de thinking désactivé,
   cache_control sur le prompt système, fallbacks "default"). Vérifie les
   signatures dans le SDK installé (node_modules/@anthropic-ai/sdk) plutôt que
   de deviner.
6. Ne touche pas aux phases suivantes. Hors périmètre → docs/v2/IDEAS.md.
7. Travaille sur la branche v2/<n>-<nom> (crée-la depuis main ou depuis la
   branche de la phase précédente si elle n'est pas encore fusionnée), commits
   atomiques en français (feat/fix/chore/test/docs(scope): …). Ne pousse pas.
8. Avant de finir : npm run lint, npm test, npm run build:web verts ; vérifie
   les écrans touchés dans le navigateur (desktop + 375 px) ; coche les
   critères d'acceptation de la phase un par un dans ton résumé final (✅ / ❌
   + preuve : nom du test, capture, commande). N'annonce rien de non vérifié.
```

---

## Ordre et jalons

| Phase | Ce que tu peux faire après | Durée indicative pour l'agent |
|---|---|---|
| P0 | App V1 en FCFA, base prête | 1 session |
| P1 | (interne) moteur prêt | 1–2 sessions |
| **P2** | **MVP : planifier, envies arbitrées, libre à dépenser, règles, sur PC et téléphone (navigateur)** | 2 sessions |
| P3 | App installée sur le téléphone, marche hors-ligne | 1 session |
| P4 | Saisie « en vrac » au texte analysée par l'IA | 1–2 sessions |
| P5 | Vocaux | 1 session |
| P6 | Conseiller + chat « est-ce que je peux… » | 1–2 sessions |
| P7 | Apprentissage, rituel mensuel, finitions | 1–2 sessions |

## Ce que TU dois préparer (l'agent ne peut pas le faire à ta place)

- **Avant P4** : une clé API Anthropic (console.anthropic.com) → variable
  `ANTHROPIC_API_KEY` dans `server/.env` et sur Render.
- **Avant P5** : une clé Groq (console.groq.com) → `GROQ_API_KEY`.
- **Avant P3/P5 sur téléphone** : l'app déployée en HTTPS (Render), ou le dev
  HTTPS local décrit dans le README.
- Après P0 : vérifier tes vraies données si tu en as (montants passés de
  centimes à francs).

## Vérification rapide après chaque phase (toi)

- P0 : les montants s'affichent `62 000 F` ; une transaction créée deux fois
  (double-clic réseau) n'apparaît qu'une fois.
- P1 : `GET /api/today` (onglet réseau) renvoie `freeToSpend`.
- P2 : crée une envie « Clavier, environ 40 à 50 000 » → verdict affiché ;
  bascule un « Et si ? ».
- P3 : mode avion → saisie → retour réseau → la saisie arrive une fois.
- P4 : écris « taxi 2000 et je dois payer 150 000 de scolarité le 15 » → 2 cartes.
- P5 : même chose au micro.
- P6 : demande « Je peux m'acheter une console à 400 000 ? ».
