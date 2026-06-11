# veille-widget

Widget systray Windows automatisant une veille technologique hebdomadaire personnalisée.

Développé dans le cadre du RNCP 7 "Expert en Architecture et Développement Logiciel" (Ingétis, soutenance mars 2027) — constitue la preuve documentée de la compétence **C1.2 Veille technologique** du Bloc 1.

---

## Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  Déclenchement                                                   │
│  ┌──────────────┐     ┌─────────────────────────────────────┐   │
│  │  Clic systray│     │  node-cron (CRON_SCHEDULE=0 8 * * 1)│   │
│  └──────┬───────┘     └─────────────────┬───────────────────┘   │
│         └──────────────────┬────────────┘                       │
└──────────────────────────┬─┘───────────────────────────────────-┘
                           ▼
              ┌────────────────────────┐
              │  Tavily — recherche web│
              │  9 topics × 3 résultats│
              │  (7 derniers jours)    │
              └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  OpenRouter            │
              │  google/gemma-4-31b    │
              │  Synthèse → Markdown   │
              │  structuré (9 sections)│
              └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  Sauvegarde locale     │
              │  output/YYYY-Www.md    │
              └────────────┬───────────┘
                           ▼
         ┌─────────────────┴──────────────────┐
         ▼                 ▼                  ▼
┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  GitHub Wiki   │ │ Google Drive │ │ Discord webhook  │
│  YYYY-Www.md   │ │  (optionnel) │ │  Incontournables │
│  (archivage)   │ └──────────────┘ │  (optionnel)     │
└────────────────┘                  └──────────────────┘
         │
         ▼
┌────────────────┐
│  Notification  │
│  Windows native│
└────────────────┘
```

**9 topics Tavily :** Stack TS/React/Node.js · Architecture logicielle · IA & LLM en production · Sécurité applicative · Réglementation numérique · DevOps & CI/CD · Numérique responsable · Accessibilité · Outils dev & pratiques

---

## Stack

| Rôle | Outil |
|------|-------|
| Runtime | Node.js 22, TypeScript strict, `tsx` |
| Recherche web | `@tavily/core` |
| LLM | OpenRouter — `google/gemma-4-31b-it:free` |
| Stockage | GitHub Wiki via `simple-git` |
| Cloud backup | Google Drive via `googleapis` (OAuth2) |
| Systray | `systray2` + `node-notifier` |
| Cron | `node-cron` |
| Validation | `zod` |

---

## Prérequis

- Node.js 22+
- Un compte [Tavily](https://tavily.com) (clé API gratuite)
- Un compte [OpenRouter](https://openrouter.ai) (clé API gratuite)
- Un token GitHub classic avec scope `repo`
- Un repo GitHub avec le wiki activé (créer une première page manuellement)

---

## Installation

```bash
git clone https://github.com/SandrineCipolla/veille-widget.git
cd veille-widget
npm install
cp .env.example .env
# Remplir les variables dans .env
```

---

## Configuration `.env`

```env
TAVILY_API_KEY=tvly-...
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemma-4-31b-it:free
GITHUB_TOKEN=ghp_...          # classic PAT, scope repo
GITHUB_USERNAME=MonPseudo
GITHUB_REPO=mon-repo-wiki     # le wiki de ce repo sera utilisé

# Optionnels
GOOGLE_CLIENT_ID=             # voir scripts/auth-google.ts
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

DISCORD_WEBHOOK_URL=          # webhook du canal Discord cible
CRON_SCHEDULE=0 8 * * 1       # lundi 8h (désactivé si absent)
```

---

## Lancement

```bash
# Widget complet (systray + cron)
npm start

# Test pipeline sans systray
npx tsx scripts/test-pipeline.ts

# Options disponibles
npx tsx scripts/test-pipeline.ts --skip-github --skip-drive --skip-discord

# Authentification Google Drive (one-shot)
npx tsx scripts/auth-google.ts

# Lister les modèles gratuits OpenRouter
npx tsx scripts/list-free-models.ts
```

---

## Structure

```
src/
├── index.ts              # orchestration + systray
├── config.ts             # validation .env (zod)
├── tavily-client.ts      # 9 topics en parallèle
├── openrouter-client.ts  # appel LLM, retry x3
├── github-wiki.ts        # push wiki via simple-git
├── drive-client.ts       # upload Google Drive OAuth2
├── discord-client.ts     # webhook Discord
├── cron.ts               # déclenchement planifié
├── notifier.ts           # notification Windows
├── output.ts             # sauvegarde locale + label semaine ISO
├── retry.ts              # backoff exponentiel
└── types.ts              # interfaces partagées
prompts/
└── veille-hebdo.txt      # system prompt (source of truth)
scripts/
├── test-pipeline.ts      # test sans systray
├── auth-google.ts        # OAuth2 Google Drive
└── list-free-models.ts   # modèles gratuits OpenRouter
docs/
├── roadmap.md            # features prévues
└── n8n-setup.md          # workflow n8n RSS digest alternatif
workflows/
└── n8n-rss-digest.json   # export workflow n8n importable
```

---

## Sorties

| Destination | Format | Exemple |
|------------|--------|---------|
| Local | `output/YYYY-Www.md` | `output/2026-W24.md` |
| GitHub Wiki | Page par semaine | [Wiki →](https://github.com/SandrineCipolla/sandrine-veille-techno/wiki) |
| Google Drive | Fichier `.md` dans un dossier | optionnel |
| Discord | Message avec les 🔥 Incontournables | optionnel |

---

## Lien RNCP 7

Ce projet constitue la preuve de la compétence **C1.2** (veille technologique, Bloc 1).  
Le digest hebdomadaire archivé dans le wiki GitHub forme une trace documentée, datée et exploitable directement dans le mémoire et lors des soutenances.  
Les 9 topics couvrent les 4 blocs de compétences Ingétis.
