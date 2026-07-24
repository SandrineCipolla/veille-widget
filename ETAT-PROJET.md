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

- Deux entrées possibles dans le code (`src/index.ts` headless + systray2, et `electron/main.cjs`) — la seconde est celle réellement utilisée, la première est un vestige pré-Electron non retiré (dette technique, pas un bug)
- `electron/main.cjs` relit `.env` à la main (parsing par split de ligne) en parallèle de la validation stricte Zod de `src/config.ts` — deux sources de vérité pour la même config
- La logique de fallback multi-modèles est dupliquée entre `openrouter-client.ts` et `translate.ts`
- La règle "vendredi ⇒ weekly" est dupliquée à 3 endroits (`src/index.ts`, `electron/main.cjs` ×2)
- Google Drive tokens expirent après 7 jours en mode "testing" (fix : publier l'app dans Google Cloud Console)
- `CRON_SCHEDULE` dans `.env` n'est lu par aucun code — variable morte à supprimer

---

## Ce qu'on souhaite faire

### Nettoyage technique (priorité basse, pas bloquant)
- Factoriser la logique de fallback multi-modèles entre `openrouter-client.ts` et `translate.ts`
- Unifier la lecture de config entre `electron/main.cjs` et `src/config.ts`
- Centraliser la règle "vendredi ⇒ weekly" dans une fonction partagée
- Supprimer `CRON_SCHEDULE` (mort) et le ternaire redondant dans `config.ts`

### Feature : impact sur mes projets (n8n)
Utiliser n8n pour analyser chaque digest hebdomadaire et générer une section `## 🎯 Impact sur mes projets` — en comparant les news tech avec le contexte de StockHub et veille-widget.

- Trigger : webhook appelé en fin de pipeline GitHub Actions
- Nodes n8n : HTTP Request (digest) → LLM (OpenAI/OpenRouter) → Discord
- Objectif RNCP : démontrer la capacité à choisir le bon outil (pipeline custom TS vs orchestrateur no-code)
- Prérequis : n8n accessible publiquement (n8n Cloud ou VPS) pour recevoir le webhook de GitHub Actions
