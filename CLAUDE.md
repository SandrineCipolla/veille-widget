# CLAUDE.md — Instructions pour ce projet

## Contexte
Widget bureau Windows (Electron) de veille technologique automatisée.
Pipeline de génération en TypeScript strict, Node.js 20+, tsx (pas de build step).
Le run automatique (quotidien lun-ven + récap hebdo vendredi) est piloté par
GitHub Actions (`.github/workflows/veille.yml`) — c'est la source de vérité,
fiable même PC éteint. Le widget local sert de visualisation (relit le wiki
au démarrage + toutes les 15 min) et de déclenchement manuel optionnel.
Développeuse : fullstack TS/Node, formation RNCP 7 INGETIS.

## Règles générales

### TypeScript
- `strict: true` obligatoire — pas de `any`, jamais
- Types explicites sur toutes les fonctions (paramètres + retour)
- Préférer `interface` pour les objets métier, `type` pour les unions/utilitaires
- Zod pour valider les réponses d'API externes (Perplexity, GitHub)

### Architecture
- Un fichier = une responsabilité (SRP strict)
- Pas de logique métier dans `run-once.ts` / `electron/main.cjs` — ils orchestrent uniquement
- Chaque module exporte une fonction principale typée
- Pas d'état global mutable

### Nommage
- Fonctions : verbe + nom, camelCase (`fetchVeille`, `pushToWiki`)
- Fichiers : kebab-case (`github-wiki.ts`, `perplexity-client.ts`)
- Constantes : UPPER_SNAKE_CASE (`MAX_RETRIES`, `WIKI_REPO`)
- Interfaces : PascalCase préfixé par domaine (`PerplexityResponse`, `WikiPage`)

### Gestion des erreurs
- Pas de `try/catch` silencieux — toujours logger l'erreur
- Fonctions async retournent `Result<T, Error>` ou throwent explicitement
- Messages d'erreur en français, clairs pour l'utilisateur final
- Erreurs réseau : 3 tentatives avec backoff exponentiel

### Secrets & configuration
- Tout dans `.env`, jamais hardcodé
- Valider la présence des variables au démarrage avec message explicite
- `.env.example` toujours à jour avec toutes les clés nécessaires

### Qualité
- Une fonction = une chose, max ~30 lignes
- Pas de commentaires qui répètent le code — commenter le "pourquoi", pas le "quoi"
- JSDoc sur les fonctions publiques exportées
- Pas de code mort ou commenté committé

## Structure du projet

```
veille-widget/
├── CLAUDE.md
├── .env.example
├── package.json
├── tsconfig.json
├── .github/
│   └── workflows/
│       └── veille.yml        # pipeline cloud — quotidien (lun-ven) + hebdo (ven)
├── src/
│   ├── run-once.ts           # entrée CLI utilisée par le workflow cloud et le widget (--mode=daily|weekly)
│   ├── config.ts             # chargement et validation des variables d'env (zod)
│   ├── pipeline.ts           # orchestration du run (runVeille)
│   ├── tavily-client.ts      # recherche web multi-topics via Tavily
│   ├── openrouter-client.ts  # rédaction structurée via OpenRouter, fallback multi-modèles
│   ├── translate.ts          # traduction locale EN→FR, même logique de fallback
│   ├── github-wiki.ts        # push vers le wiki GitHub via simple-git
│   ├── drive-client.ts       # upload optionnel vers Google Drive
│   ├── discord-client.ts     # webhook Discord + extraction des incontournables
│   ├── notifier.ts           # notification Windows native
│   ├── output.ts             # sauvegarde locale, labels de run, HTML de traduction
│   ├── run-logger.ts         # log JSON des runs (logs/pipeline.json)
│   ├── retry.ts              # utilitaire retry avec backoff exponentiel
│   ├── types.ts              # interfaces et types partagés
│   └── __tests__/            # tests unitaires (vitest)
├── electron/
│   ├── main.cjs               # process principal du widget (CJS)
│   ├── preload.cjs            # bridge IPC contextIsolation
│   └── renderer/index.html    # UI du widget
├── prompts/
│   ├── veille-quotidienne.txt
│   └── veille-recap.txt
├── scripts/
│   ├── test-pipeline.ts       # test complet (--mode, --skip-*)
│   ├── auth-google.ts         # OAuth2 Google Drive (one-shot)
│   └── list-free-models.ts    # liste les modèles OpenRouter gratuits
└── output/                   # fichiers Markdown générés (gitignored)
```

## Dépendances autorisées
- `electron` — widget desktop (fenêtre + systray natif)
- `node-cron` — cron local optionnel dans le widget (`electron/main.cjs`), désactivé par défaut
- `node-notifier` — notifications Windows natives
- `@tavily/core` — recherche web
- `openai` — client OpenRouter compatible ; liste de modèles avec fallback ordonné via `OPENROUTER_MODELS`
- `simple-git` — push vers le wiki GitHub (le Git Data API GitHub ne supporte pas les repos wiki)
- `googleapis` — upload Google Drive optionnel (OAuth2, configuré via scripts/auth-google.ts)
- `zod` — validation des schémas
- `dotenv` — chargement .env
- `tsx` — exécution TypeScript sans build
- `vitest` — tests unitaires

## Git

- Tout travail se fait sur une branche dédiée — jamais directement sur `main`
- Nommage des branches : `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`
- Une branche = une fonctionnalité ou un correctif
- Les commits sont en français, au présent, avec un préfixe conventionnel : `feat:`, `fix:`, `chore:`, `refactor:`
- On merge sur `main` uniquement via Pull Request

## Ce qu'on ne fait pas
- Pas de framework web (Express, Fastify) — c'est un script, pas un serveur
- Pas de base de données — le wiki GitHub EST le stockage
- Pas de bundler (webpack, esbuild) — tsx suffit
