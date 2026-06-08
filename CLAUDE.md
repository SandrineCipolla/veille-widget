# CLAUDE.md — Instructions pour ce projet

## Contexte
Widget bureau Windows de veille technologique automatisée.
Stack : TypeScript strict, Node.js 20+, tsx (pas de build step).
Développeuse : fullstack TS/Node, formation RNCP 7 INGETIS.

## Règles générales

### TypeScript
- `strict: true` obligatoire — pas de `any`, jamais
- Types explicites sur toutes les fonctions (paramètres + retour)
- Préférer `interface` pour les objets métier, `type` pour les unions/utilitaires
- Zod pour valider les réponses d'API externes (Perplexity, GitHub)

### Architecture
- Un fichier = une responsabilité (SRP strict)
- Pas de logique métier dans `index.ts` — il orchestre uniquement
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
├── src/
│   ├── index.ts              # point d'entrée — orchestration uniquement
│   ├── config.ts             # chargement et validation des variables d'env
│   ├── tavily-client.ts      # recherche web multi-topics via Tavily
│   ├── openrouter-client.ts  # rédaction structurée via OpenRouter (mistral-7b)
│   ├── github-wiki.ts        # push vers le wiki GitHub
│   ├── notifier.ts           # notification Windows native
│   ├── retry.ts              # utilitaire retry avec backoff exponentiel
│   └── types.ts              # interfaces et types partagés
├── prompts/
│   └── veille-hebdo.txt      # prompt de veille (source of truth)
└── output/                   # fichiers Markdown générés (gitignored)
```

## Dépendances autorisées
- `systray2` — icône systray Windows (fork maintenu de node-systray)
- `node-notifier` — notifications Windows natives
- `@octokit/rest` — API GitHub
- `@tavily/core` — recherche web (remplace Perplexity)
- `openai` — client OpenRouter compatible (modèle configurable via OPENROUTER_MODEL)
- `simple-git` — push vers le wiki GitHub (le Git Data API ne supporte pas les repos wiki)
- `zod` — validation des schémas
- `dotenv` — chargement .env
- `tsx` — exécution TypeScript sans build

## Git

- Tout travail se fait sur une branche dédiée — jamais directement sur `main`
- Nommage des branches : `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`
- Une branche = une fonctionnalité ou un correctif
- Les commits sont en français, au présent, avec un préfixe conventionnel : `feat:`, `fix:`, `chore:`, `refactor:`
- On merge sur `main` uniquement via Pull Request

## Ce qu'on ne fait pas
- Pas de framework web (Express, Fastify) — c'est un script, pas un serveur
- Pas de base de données — le wiki GitHub EST le stockage
- Pas de tests pour le MVP, mais le code doit être testable (fonctions pures isolées)
- Pas de bundler (webpack, esbuild) — tsx suffit
