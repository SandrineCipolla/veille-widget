# veille-widget 🔍

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-42-47848f)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> Widget bureau Windows automatisant une veille technologique quotidienne et hebdomadaire personnalisée.

Développé dans le cadre du RNCP 7 "Expert en Architecture et Développement Logiciel" (Ingétis, soutenance mars 2027) — constitue la preuve documentée de la compétence **C1.2 Veille technologique** du Bloc 1.

## 🔗 **[Wiki de contenu →](https://github.com/SandrineCipolla/sandrine-veille-techno/wiki)** | 📖 **[Documentation technique →](https://github.com/SandrineCipolla/veille-widget/wiki)**

---

## ✨ Fonctionnalités principales

- ⚡ **Widget Electron** — fenêtre flottante + icône systray, toujours accessible
- 🗓️ **Deux modes** — veille daily (lun-jeu) et récap hebdomadaire (vendredi)
- 🌍 **Sources EN + FR** — 6 topics internationaux + 3 sources officielles françaises (CERT-FR, CNIL, developpez.com)
- 🤖 **Rédaction IA** — OpenRouter synthétise les résultats en digest Markdown structuré
- 📝 **Wiki GitHub** — archivage automatique par date (`YYYY-MM-DD`) ou semaine ISO (`YYYY-Www`)
- 🇫🇷 **Traduction HTML locale** — version française privée, ouverte dans le navigateur (jamais publiée)
- ☁️ **Google Drive** — backup optionnel (OAuth2, app publiée)
- 🔔 **Discord** — notification des incontournables (optionnel)
- ⏰ **Cron** — déclenchement automatique configurable

---

## 🗓️ Modes de veille

### Daily — lundi → jeudi

- Tavily : 2 derniers jours (topics FR gardent 14 jours)
- Prompt : `veille-quotidienne.txt` — digest court, focalisé sur le nouveau
- Wiki page : `YYYY-MM-DD`

### Weekly récap — vendredi

- Tavily : 2 derniers jours (nouveautés du vendredi)
- Entrée LLM : digests lun-jeu + nouveautés du vendredi
- Prompt : `veille-recap.txt` — synthèse de la semaine, sujets récurrents, incontournables
- Wiki page : `YYYY-Www`

---

## 🔄 Pipeline

```
[Widget Electron] ──── clic "Lancer la veille" ────┐
[node-cron]       ── CRON_DAILY / CRON_WEEKLY ──────┤
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
                               │  OpenRouter LLM                     │
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
               └────────┬─────────┘                └──────────────────────┘
                        │
               ┌────────┴────────┐
               ▼                 ▼
        Google Drive         Discord
        (optionnel)          (optionnel)
```

---

## 🛠️ Stack

| Rôle | Outil |
|------|-------|
| Widget UI | Electron 42 |
| Runtime | Node.js 22, TypeScript strict, `tsx` |
| Recherche web | `@tavily/core` |
| LLM | OpenRouter — modèle configurable via `OPENROUTER_MODEL` |
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
OPENROUTER_MODEL=google/gemma-4-31b-it:free
GITHUB_TOKEN=ghp_...           # classic PAT, scope repo
GITHUB_USERNAME=MonPseudo
GITHUB_REPO=mon-repo-contenu   # repo dédié au contenu wiki

# Cron — désactivé si absent
CRON_DAILY=0 8 * * 1-4         # lundi → jeudi 8h
CRON_WEEKLY=0 8 * * 5          # vendredi 8h (récap)

# Google Drive — optionnel (voir scripts/auth-google.ts)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# Discord — optionnel
DISCORD_WEBHOOK_URL=
```

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
```

---

## 📁 Structure

```
src/
├── index.ts              # orchestration systray (headless)
├── config.ts             # validation .env (zod)
├── pipeline.ts           # pipeline principal (RunMode daily/weekly)
├── tavily-client.ts      # 9 topics EN+FR en parallèle
├── openrouter-client.ts  # appel LLM avec retry x3
├── github-wiki.ts        # push wiki via simple-git
├── drive-client.ts       # upload Google Drive OAuth2
├── discord-client.ts     # webhook + extractIncontournables
├── translate.ts          # traduction locale EN→FR
├── output.ts             # sauvegarde, labels, HTML traduction
├── cron.ts               # déclenchement planifié
├── notifier.ts           # notification Windows native
├── run-once.ts           # entrée CLI (--mode=daily|weekly)
├── retry.ts              # backoff exponentiel partagé
└── types.ts              # interfaces et RunMode
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
└── auth-google.ts        # OAuth2 Google Drive (one-shot)
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
