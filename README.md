# veille-widget 🔍

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-42-47848f)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-Tous%20droits%20réservés-lightgrey.svg)](./LICENSE)

> Widget bureau Windows automatisant une veille technologique quotidienne et hebdomadaire personnalisée.

Développé dans le cadre du RNCP 7 "Expert en Architecture et Développement Logiciel" (Ingétis, soutenance mars 2027) — constitue la preuve documentée de la compétence **C1.2 Veille technologique** du Bloc 1.

## 🔗 **[Wiki de contenu →](https://github.com/SandrineCipolla/sandrine-veille-techno/wiki)** | 📖 **[Documentation technique →](https://github.com/SandrineCipolla/veille-widget/wiki)**

---

## ✨ Fonctionnalités principales

- ☁️ **GitHub Actions** — pipeline cloud, source de vérité : run quotidien (lun-ven) + récap hebdo le vendredi, indépendant du PC
- ⚡ **Widget Electron** — fenêtre flottante + icône systray ; lit le dernier digest sur le wiki au démarrage et se resynchronise toutes les 15 min
- 🔁 **Fallback multi-modèles** — `OPENROUTER_MODELS` essaie plusieurs modèles OpenRouter dans l'ordre (bascule sur 404/429/502/503)
- 🗓️ **Deux modes** — veille daily (lun-ven) et récap hebdomadaire (vendredi)
- 🌍 **Sources EN + FR** — 6 topics internationaux + 3 sources officielles françaises (CERT-FR, CNIL, developpez.com)
- 🤖 **Rédaction IA** — OpenRouter synthétise les résultats en digest Markdown structuré
- 📝 **Wiki GitHub** — archivage automatique par date (`YYYY-MM-DD`) ou semaine ISO (`YYYY-Www`)
- 🇫🇷 **Traduction HTML locale** — version française privée, ouverte dans le navigateur (jamais publiée)
- ☁️ **Google Drive** — backup optionnel (OAuth2, app publiée)
- 🔔 **Discord** — notification des incontournables (optionnel)
- ⏰ **Cron local** — déclenchement optionnel en plus du cloud (désactivé par défaut)

---

## 🗓️ Modes de veille

Le workflow cloud (`.github/workflows/veille.yml`) tourne lundi → vendredi. Le vendredi,
il enchaîne les **deux** modes à la suite (daily puis weekly) — les autres jours, daily seul.

### Daily — lundi → vendredi

- Tavily : 2 derniers jours (topics FR gardent 14 jours)
- Prompt : `veille-quotidienne.txt` — digest court, focalisé sur le nouveau
- Wiki page : `YYYY-MM-DD`

### Weekly récap — vendredi (en plus du daily)

- Tavily : fenêtres par défaut par topic (7j EN / 14j FR), pas le raccourci 2 jours du daily
- Entrée LLM : digests lun-jeu + nouveautés du vendredi
- Prompt : `veille-recap.txt` — synthèse de la semaine, sujets récurrents, incontournables
- Wiki page : `YYYY-Www`

**Comment le récap du vendredi relit les digests lun-jeu malgré des runners GitHub
Actions éphémères** (chaque run repart d'une machine vierge) : le workflow utilise
`actions/cache` sur `output/` avec une clé par semaine ISO (`output-{semaine}-{run}`,
`restore-keys: output-{semaine}-`). Chaque run de la semaine restaure le cache du run
précédent, y écrit son propre digest, et le sauvegarde sous une nouvelle clé — le
vendredi hérite ainsi des fichiers `output/YYYY-MM-DD.md` de lundi à jeudi.

---

## 🔄 Pipeline

Déclencheurs possibles — le cloud est la source de vérité, fiable même PC éteint :

```
[cron-job.org]    ── POST workflow_dispatch, 10h Paris (lun-ven) ──┐  ← source de vérité, tourne même PC éteint
[Widget Electron] ── clic "Lancer la veille" ─────────┤
[node-cron local] ── CRON_DAILY / CRON_WEEKLY ────────┤  ← optionnel, désactivé par défaut
                                                       ▼
                               ┌─────────────────────────────────────┐
                               │  Tavily — 9 topics × 3 résultats    │
                               │  6 topics EN (7j)                   │
                               │  3 topics FR (14j, keepDays=true)   │
                               └─────────────────┬───────────────────┘
                                                 │
                    [mode weekly] ───────────────┤
                    Lecture digests lun-jeu       │
                                                 ▼
                               ┌─────────────────────────────────────┐
                               │  OpenRouter LLM (fallback ordonné)  │
                               │  OPENROUTER_MODELS : model1,        │
                               │  model2… → bascule sur 404/429/     │
                               │  502/503                            │
                               │  veille-quotidienne.txt (daily)     │
                               │  veille-recap.txt (weekly)          │
                               │  → Markdown structuré               │
                               └────────────┬────────────────────────┘
                                            ▼
                          ┌─────────────────┴──────────────────┐
                          ▼                                     ▼
               ┌──────────────────┐                ┌──────────────────────┐
               │  GitHub Wiki     │                │  Traduction FR       │
               │  YYYY-MM-DD.md   │                │  latest-traduit.html │
               │  ou YYYY-Www.md  │                │  (local, privé)      │
               │  + Home.md       │                └──────────────────────┘
               └────────┬─────────┘
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                    ▼
  Google Drive       Discord         [Widget Electron]
  (optionnel)        (optionnel)     relit Home.md → dernier digest
                                     au démarrage + toutes les 15 min
```

---

## 🛠️ Stack

| Rôle | Outil |
|------|-------|
| Widget UI | Electron 42 |
| Runtime | Node.js 22, TypeScript strict, `tsx` |
| Recherche web | `@tavily/core` |
| LLM | OpenRouter — liste de modèles avec fallback ordonné via `OPENROUTER_MODELS` |
| Automatisation cloud | GitHub Actions — `.github/workflows/veille.yml` |
| Stockage | GitHub Wiki via `simple-git` |
| Cloud backup | Google Drive via `googleapis` (OAuth2) |
| Notifications | `node-notifier` |
| Cron | `node-cron` |
| Validation | `zod` |

---

## 🚀 Prérequis

- Node.js 22+
- Compte [Tavily](https://tavily.com) — clé API gratuite
- Compte [OpenRouter](https://openrouter.ai) — clé API gratuite
- Token GitHub classic avec scope `repo`
- Repo GitHub dédié au contenu avec le wiki activé (créer une première page manuellement)

---

## 📦 Installation

```bash
git clone https://github.com/SandrineCipolla/veille-widget.git
cd veille-widget
npm install
cp .env.example .env
# Remplir les variables dans .env
```

---

## ⚙️ Configuration `.env`

```env
TAVILY_API_KEY=tvly-...
OPENROUTER_API_KEY=sk-or-...
# Liste essayée dans l'ordre, bascule sur le suivant si 404/429/502/503.
# Termine toujours par un modèle payant (les gratuits OpenRouter changent souvent) :
OPENROUTER_MODELS=google/gemma-4-31b-it:free,openai/gpt-oss-20b:free,nvidia/nemotron-nano-9b-v2:free,openai/gpt-4o-mini
GITHUB_TOKEN=ghp_...           # classic PAT, scope repo
GITHUB_USERNAME=MonPseudo
GITHUB_REPO=mon-repo-contenu   # repo dédié au contenu wiki

# Cron local — optionnel, désactivé si absent. Le run automatique (quotidien +
# hebdo vendredi) est normalement géré par GitHub Actions (cloud, fiable même
# PC éteint) ; le widget lit alors le wiki au démarrage. N'active ces variables
# que pour un run automatique en plus, en local.
# CRON_DAILY=0 8 * * 1-4         # lundi → jeudi 8h
# CRON_WEEKLY=0 8 * * 5          # vendredi 8h (récap)

# Google Drive — optionnel (voir scripts/auth-google.ts)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# Discord — optionnel (aussi à configurer comme secret GitHub Actions
# DISCORD_WEBHOOK_URL pour recevoir les notifs des runs cloud)
DISCORD_WEBHOOK_URL=
```

### Secrets GitHub Actions (pipeline cloud)

Le workflow `.github/workflows/veille.yml` lit sa config depuis les secrets du repo
(Settings → Secrets and variables → Actions), pas depuis `.env` :

`TAVILY_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODELS`, `GH_PAT`, `WIKI_USERNAME`,
`WIKI_REPO`, `DISCORD_WEBHOOK_URL` (optionnel).

---

## 🖥️ Lancement

```bash
# Widget Electron complet (fenêtre + systray)
npm run electron

# Test pipeline sans widget
npx tsx scripts/test-pipeline.ts --mode=daily --skip-github --skip-drive --skip-discord
npx tsx scripts/test-pipeline.ts --mode=weekly --skip-github --skip-drive --skip-discord

# Authentification Google Drive (one-shot)
npx tsx scripts/auth-google.ts

# Lister les modèles OpenRouter gratuits disponibles (aide au choix d'OPENROUTER_MODELS)
npx tsx scripts/list-free-models.ts

# Tests unitaires (vitest)
npm test
```

### Démarrage automatique (Windows)

`lancer-veille.vbs` lance le widget sans fenêtre de terminal visible (`npm run electron`
en arrière-plan). Pour un lancement automatique à la connexion Windows, placer un
raccourci vers ce fichier dans le dossier de démarrage (`Win+R` → `shell:startup`).

---

## 📁 Structure

```
.github/
└── workflows/
    └── veille.yml         # pipeline cloud — quotidien (lun-ven) + hebdo (ven)
src/
├── config.ts             # validation .env (zod)
├── pipeline.ts           # pipeline principal (RunMode daily/weekly)
├── tavily-client.ts      # 9 topics EN+FR en parallèle
├── openrouter-client.ts  # appel LLM, fallback multi-modèles ordonné
├── github-wiki.ts        # push wiki via simple-git
├── drive-client.ts       # upload Google Drive OAuth2
├── discord-client.ts     # webhook + extractIncontournables
├── translate.ts          # traduction locale EN→FR
├── output.ts             # sauvegarde, labels, HTML traduction
├── notifier.ts           # notification Windows native
├── run-once.ts           # entrée CLI (--mode=daily|weekly), utilisée par le workflow cloud et le widget
├── run-logger.ts         # log JSON des runs (logs/pipeline.json)
├── retry.ts              # backoff exponentiel partagé
├── types.ts              # interfaces et RunMode
└── __tests__/            # tests unitaires (vitest)
electron/
├── main.cjs              # process principal Electron (CJS)
├── preload.cjs           # bridge IPC contextIsolation
└── renderer/
    └── index.html        # UI du widget
prompts/
├── veille-quotidienne.txt # prompt daily
└── veille-recap.txt       # prompt récap vendredi
scripts/
├── test-pipeline.ts      # test complet (--mode, --skip-*)
├── auth-google.ts        # OAuth2 Google Drive (one-shot)
└── list-free-models.ts   # liste les modèles OpenRouter gratuits disponibles (aide au choix d'OPENROUTER_MODELS)
output/                   # gitignored — digests locaux
├── YYYY-MM-DD.md
├── YYYY-Www.md
├── latest.md
└── latest-traduit.html
```

---

## 📊 Sorties

| Destination | Format | Exemple |
|-------------|--------|---------|
| Local | `output/YYYY-MM-DD.md` ou `output/YYYY-Www.md` | `output/2026-06-16.md` |
| Traduction | `output/latest-traduit.html` | privé, jamais publié |
| GitHub Wiki | Page par jour ou par semaine | [sandrine-veille-techno/wiki →](https://github.com/SandrineCipolla/sandrine-veille-techno/wiki) |
| Google Drive | Fichier `.md` dans un dossier Drive | optionnel |
| Discord | Message avec les 🔥 Incontournables | optionnel |

---

## 🎓 Lien RNCP 7

Ce projet constitue la preuve de la compétence **C1.2** (veille technologique, Bloc 1) — RNCP 7 "Expert en Architecture et Développement Logiciel", Ingétis, soutenance mars 2027.

Deux repos distincts :
- **`veille-widget`** (ce repo) — le code du widget et du pipeline
- **[sandrine-veille-techno](https://github.com/SandrineCipolla/sandrine-veille-techno)** — le contenu de la veille, archivé dans son wiki

| Topic Tavily | Bloc RNCP couvert |
|---|---|
| Stack TS/React/Node.js | Bloc 2 — Architecture & développement |
| Architecture & patterns | Bloc 2 — Architecture & développement |
| IA & LLM en production | Bloc 1 — Veille & innovation |
| Sécurité — CVE & advisories | Bloc 3 — DevOps & production |
| DevOps & CI/CD | Bloc 3 — DevOps & production |
| Numérique responsable & accessibilité | Bloc 1 — Veille & innovation |
| CERT-FR & ANSSI [FR] | Bloc 3 — Sécurité |
| Réglementation & CNIL [FR] | Bloc 1 — Veille réglementaire |
| Communauté dev francophone [FR] | Bloc 1 — Veille & innovation |
