# État du projet — veille-widget

## Ce qui est en place

### Pipeline de veille
- **Tavily** → recherche web multi-topics (TS, Node, React, DevOps, IA, RNCP…)
- **OpenRouter** (Mistral) → rédaction structurée en Markdown
- **GitHub Wiki** → stockage des digests, Home.md mis à jour automatiquement à chaque run
- **Discord** → notification avec titre adapté (daily vs récap)
- **Google Drive** → upload optionnel (OAuth2, non bloquant si token expiré)

### Modes daily / weekly
- Lundi→jeudi : digest quotidien — section `🔥 Incontournables` / label `🗓️ Veille techno`
- Vendredi : récap de la semaine (digests lun→jeu + news du jour) — section `📋 Récap de la semaine`
- Topics FR : fenêtre 14 jours préservée (`keepDays`)

### Widget Electron (Windows)
- Icône systray, fenêtre flottante avec les incontournables du dernier digest
- Label dynamique selon le mode (daily vs weekly)
- Bouton "Lancer la veille" pour run manuel
- Lien vers le digest complet sur le wiki

### Automatisation
- **GitHub Actions** : cron `30 7 * * 1-5` (9h30 Paris) — pipeline cloud, indépendant du PC
- **VBS script** (`lancer-veille.vbs`) : lance le widget sans terminal, placé dans le démarrage Windows

---

## Limites connues

- Le widget affiche uniquement le dernier digest **local** (`output/latest.md`) — il ne se met pas à jour automatiquement quand GitHub Actions tourne (le PC doit être allumé et le widget lancé pour déclencher un run local)
- Google Drive tokens expirent après 7 jours en mode "testing" (fix : publier l'app dans Google Cloud Console)

---

## Ce qu'on souhaite faire

### Feature : impact sur mes projets (n8n)
Utiliser n8n pour analyser chaque digest hebdomadaire et générer une section `## 🎯 Impact sur mes projets` — en comparant les news tech avec le contexte de StockHub et veille-widget.

- Trigger : webhook appelé en fin de pipeline GitHub Actions
- Nodes n8n : HTTP Request (digest) → LLM (OpenAI/OpenRouter) → Discord
- Objectif RNCP : démontrer la capacité à choisir le bon outil (pipeline custom TS vs orchestrateur no-code)
- Prérequis : n8n accessible publiquement (n8n Cloud ou VPS) pour recevoir le webhook de GitHub Actions

### Petites améliorations possibles
- Ajouter `DISCORD_WEBHOOK_URL` dans les secrets GitHub Actions (manquant → pas de notif Discord sur les runs cloud)
- Publier l'app Google OAuth pour éviter l'expiration des tokens Drive
