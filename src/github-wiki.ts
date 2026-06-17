import fs from 'fs';
import os from 'os';
import path from 'path';
import simpleGit from 'simple-git';
import type { WeekLabel, WikiPushResult } from './types.js';

const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Clone le wiki GitHub, ajoute le fichier Markdown, met à jour Home.md, commit et push.
 * Utilise simple-git car le Git Data API GitHub ne supporte pas les repos wiki.
 */
export async function pushToWiki(
  token: string,
  owner: string,
  repo: string,
  label: WeekLabel,
  content: string,
): Promise<WikiPushResult> {
  const filename = `${label}.md`;
  const wikiUrl = `https://${token}@github.com/${owner}/${repo}.wiki.git`;
  const tmpDir = path.join(os.tmpdir(), `veille-wiki-${Date.now()}`);

  try {
    console.log('[wiki] Clone du wiki…');
    await simpleGit().clone(wikiUrl, tmpDir);

    fs.writeFileSync(path.join(tmpDir, filename), content, 'utf-8');

    const existingFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    fs.writeFileSync(path.join(tmpDir, 'Home.md'), buildHomeContent(existingFiles, label), 'utf-8');

    const git = simpleGit(tmpDir);
    await git.addConfig('user.email', 'veille-widget@noreply');
    await git.addConfig('user.name', 'Veille Widget');
    await git.add([filename, 'Home.md']);
    await git.commit(`feat: veille techno ${label}`);
    await git.push('origin', 'HEAD');

    const log = await git.log({ maxCount: 1 });
    return { commitSha: log.latest?.hash ?? 'unknown', filename };
  } catch (err) {
    throw wrapGitError(err);
  } finally {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildHomeContent(wikiFiles: string[], currentLabel: string): string {
  type Entry = { label: string; year: number; month: number; sortKey: string; type: 'daily' | 'weekly'; display: string };

  const labels = wikiFiles
    .map(f => f.replace(/\.md$/, ''))
    .filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l) || /^\d{4}-W\d{2}$/.test(l));

  if (!labels.includes(currentLabel)) labels.push(currentLabel);

  const entries: Entry[] = labels.map((label): Entry => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
      const [y, m, d] = label.split('-').map(Number);
      return { label, year: y!, month: m!, sortKey: label, type: 'daily', display: `${d} ${MOIS_FR[(m ?? 1) - 1]} ${y}` };
    }
    const [yearStr, weekStr] = label.split('-W');
    const year = Number(yearStr);
    const week = Number(weekStr);
    const approxDate = new Date(year, 0, 1 + (week - 1) * 7);
    const month = approxDate.getMonth() + 1;
    return { label, year, month, sortKey: label, type: 'weekly', display: `Semaine ${week}` };
  });

  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const grouped = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${MOIS_FR[entry.month - 1]} ${entry.year}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  const sections = Array.from(grouped.entries())
    .map(([monthLabel, items]) => {
      const rows = items
        .map(e => `| ${e.display} | ${e.type === 'daily' ? 'Daily' : 'Récap hebdo'} | [${e.label}](${e.label}) |`)
        .join('\n');
      return `### ${monthLabel}\n\n| Date | Type | Page |\n|------|------|------|\n${rows}`;
    })
    .join('\n\n');

  return `# 📡 Veille Technologique — Sandrine Cipolla

> Archive de veille technologique automatisée — générée quotidiennement (lun-jeu) et récapitulée chaque vendredi.

Développée dans le cadre du **RNCP 7 "Expert en Architecture et Développement Logiciel"** (Ingétis, soutenance mars 2027) — preuve de la compétence **C1.2 Veille technologique**, Bloc 1.

---

## 📅 Digests archivés

${sections}

---

## 🗓️ Format

**Daily (lundi → jeudi)** — digest court sur les 2 derniers jours :
- 🔥 À retenir aujourd'hui
- 🔒 Sécurité (si alerte critique)
- 📦 Release (si release majeure)
- 💡 IA & LLM (si news nouvelle)

**Weekly récap (vendredi)** — synthèse de la semaine :
- 📢 Ce qui a fait bruit cette semaine
- 🔥 Incontournables
- 📦 Releases & changelogs
- 🏗️ Architecture & bonnes pratiques
- 🔒 Sécurité & conformité
- ⚙️ DevOps & CI/CD
- 🌱 Numérique responsable & accessibilité
- 💡 IA & LLM en production
- 🌍 Source de la semaine
- 🗓️ À surveiller la semaine prochaine

---

## 🌍 Sources

9 topics interrogés à chaque run via **Tavily** :

- Stack TS / React / Node.js
- Architecture & patterns logiciels
- IA & LLM en production
- Sécurité — CVE & advisories
- DevOps & CI/CD
- Numérique responsable & accessibilité
- 🇫🇷 CERT-FR & ANSSI
- 🇫🇷 Réglementation & CNIL
- 🇫🇷 Communauté dev francophone

---

## 🔧 Outil

Cette veille est générée automatiquement par **[veille-widget](https://github.com/SandrineCipolla/veille-widget)** — widget Electron Windows open source.
`;
}

function wrapGitError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Authentication failed') || msg.includes('401')) {
    return new Error('GitHub : token invalide ou sans permission wiki (401)');
  }
  if (msg.includes('Repository not found') || msg.includes('404')) {
    return new Error('GitHub : wiki introuvable — activez le wiki et créez une première page sur GitHub (404)');
  }
  return new Error(`GitHub wiki erreur : ${msg}`);
}
