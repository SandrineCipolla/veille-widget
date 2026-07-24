# État du projet — veille-widget

_Dernière mise à jour : 24 juillet 2026_

## Ce qui est en place

### Pipeline de veille
- **Tavily** → recherche web multi-topics (TS, Node, React, DevOps, IA, RNCP…)
- **OpenRouter** → rédaction structurée en Markdown, **fallback multi-modèles** (`OPENROUTER_MODELS`) : bascule automatiquement sur le modèle suivant en cas de 404 (modèle retiré/renommé), 429 (rate limit), 502/503 (indispo)
- **GitHub Wiki** → stockage des digests, `Home.md` mis à jour automatiquement à chaque run
- **Discord** → notification avec titre adapté (daily vs récap), configuré à la fois en local (`.env`) et côté cloud (secret GitHub Actions)
- **Google Drive** → upload optionnel (OAuth2, non bloquant si token expiré)

### Modes daily / weekly
- Lundi → vendredi : digest quotidien — section `🔥 Incontournables` / label `🗓️ Veille techno`
- Vendredi (en plus du quotidien) : récap de la semaine (digests lun→jeu + news du jour) — section `📋 Récap de la semaine`
- Topics FR : fenêtre 14 jours préservée (`keepDays`)

### Automatisation cloud — source de vérité
- **GitHub Actions** (`.github/workflows/veille.yml`) : cron `30 7 * * 1-5` (9h30 Paris), tourne indépendamment du PC
- Le vendredi, le job enchaîne daily puis weekly dans le même run
- Secrets configurés sur le repo `veille-widget` : `TAVILY_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODELS`, `GH_PAT`, `WIKI_USERNAME`, `WIKI_REPO`, `DISCORD_WEBHOOK_URL`

### Widget Electron (Windows)
- Icône systray, fenêtre flottante avec les incontournables du dernier digest
- **Lit le dernier digest depuis le wiki GitHub** (`Home.md` → page correspondante) au démarrage, puis se resynchronise automatiquement toutes les 15 min — reflète le run cloud même si aucun run local n'a eu lieu
- Repli sur le fichier local (`output/latest.md`) si le réseau est indisponible
- Bouton "Lancer la veille" pour un run manuel local (affiche immédiatement son propre résultat)
- Cron local (`CRON_DAILY`/`CRON_WEEKLY`) disponible mais **désactivé par défaut** — évite les doublons avec le run cloud
- Lien vers le digest complet sur le wiki
- IPC `open-url` restreint aux schémas http/https, `set-tray-icon` valide le format et la taille du data URL reçu

### Lancement automatique
- **VBS script** (`lancer-veille.vbs`) : lance le widget sans terminal
- Raccourci dans le dossier de démarrage Windows (`shell:startup`) pointant vers `lancer-veille.vbs`

---

## Limites connues

- `electron/main.cjs` relit `.env` à la main (parsing par split de ligne) en parallèle de la validation stricte Zod de `src/config.ts` — deux sources de vérité pour la même config
- La logique de fallback multi-modèles est dupliquée entre `openrouter-client.ts` et `translate.ts`
- La règle "vendredi ⇒ weekly" est dupliquée entre `electron/main.cjs` (2 endroits) et le workflow GitHub Actions
- Google Drive tokens expirent après 7 jours en mode "testing" (fix : publier l'app dans Google Cloud Console)
- **[Issue #16](https://github.com/SandrineCipolla/veille-widget/issues/16)** — `electron/main.cjs` contient de la logique métier (parsing Markdown, fetch HTTP du wiki, génération d'icône PNG) qui échappe au typage TypeScript strict et aux tests unitaires (dossier exclu de `tsconfig.json`/`__tests__/`), en contradiction avec la règle "orchestration seulement" que ce fichier devrait suivre
- **[Issue #17](https://github.com/SandrineCipolla/veille-widget/issues/17)** — `scripts/auth-google.ts` : flux OAuth vulnérable au CSRF (pas de paramètre `state` généré/vérifié). Impact faible : script one-shot lancé manuellement en local, jamais exposé publiquement

---

## Corrigé le 24/07/2026 (2e et 3e passes d'audit)

- Code mort supprimé : `src/index.ts` (entrée headless systray2, jamais utilisée en prod — `lancer-veille.vbs` lance `npm run electron`), `src/cron.ts`, dépendances `systray2` et `@types/node-cron`
- Token GitHub exposé en clair dans l'URL git (`https://TOKEN@github.com/...`, visible dans la liste des process) — remplacé par une authentification via header HTTP passé en variable d'env (`GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0`)
- Ternaire redondant dans `config.ts` pour la résolution `OPENROUTER_MODEL`/`OPENROUTER_MODELS`
- Champs `cronDaily`/`cronWeekly` morts dans `config.ts` (plus lus depuis la suppression de `cron.ts`)
- `CRON_SCHEDULE` supprimé du `.env` local (mort, jamais lu par aucun code)
- `scripts/test-pipeline.ts` utilisait l'ancienne API OpenRouter (`config.openrouterModel` singulier, anciennes signatures de fonctions) et plantait dès la première étape — invisible car `scripts/` était exclu de `tsconfig.json`. Corrigé + `include` élargi pour attraper ce genre de dérive à l'avenir (voir [PR #15](https://github.com/SandrineCipolla/veille-widget/pull/15))

## Ce qu'on souhaite faire

### Nettoyage technique restant (priorité basse, pas bloquant)
- Factoriser la logique de fallback multi-modèles entre `openrouter-client.ts` et `translate.ts`
- Unifier la lecture de config entre `electron/main.cjs` et `src/config.ts`
- [Issue #16](https://github.com/SandrineCipolla/veille-widget/issues/16) — extraire la logique métier hors de `electron/main.cjs`
- [Issue #17](https://github.com/SandrineCipolla/veille-widget/issues/17) — paramètre `state` OAuth dans `scripts/auth-google.ts`

### Feature : impact sur mes projets (n8n)
Utiliser n8n pour analyser chaque digest hebdomadaire et générer une section `## 🎯 Impact sur mes projets` — en comparant les news tech avec le contexte de StockHub et veille-widget.

- Trigger : webhook appelé en fin de pipeline GitHub Actions
- Nodes n8n : HTTP Request (digest) → LLM (OpenAI/OpenRouter) → Discord
- Objectif RNCP : démontrer la capacité à choisir le bon outil (pipeline custom TS vs orchestrateur no-code)
- Prérequis : n8n accessible publiquement (n8n Cloud ou VPS) pour recevoir le webhook de GitHub Actions
