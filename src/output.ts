import fs from 'fs';
import path from 'path';
import type { WeekLabel } from './types.js';

/** Retourne le label de semaine ISO 8601 courant : YYYY-Www */
export function getWeekLabel(date: Date = new Date()): WeekLabel {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Sauvegarde le contenu Markdown dans outputDir/YYYY-Www.md. Retourne le chemin absolu. */
export function saveOutput(content: string, outputDir = './output'): string {
  const dir = path.resolve(outputDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, `${getWeekLabel()}.md`);
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

/**
 * Écrase outputDir/latest.md avec le digest courant.
 * Préfixe le label ISO en commentaire HTML pour que le widget Electron puisse le lire
 * sans dépendre du format du titre généré par le modèle.
 */
export function saveLatestDigest(content: string, weekLabel: string, outputDir = './output'): void {
  const dir = path.resolve(outputDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest.md'), `<!-- week: ${weekLabel} -->\n${content}`, 'utf-8');
}

/**
 * Écrase outputDir/latest-traduit.html avec la version traduite du digest.
 * Fichier local uniquement — outputDir est gitignored, il ne part jamais sur GitHub.
 * Ouvrir avec shell.openPath → s'affiche dans le navigateur par défaut.
 */
export function saveTranslatedDigest(content: string, outputDir = './output'): void {
  const dir = path.resolve(outputDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest-traduit.html'), markdownToHtml(content), 'utf-8');
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const htmlLines: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // italic
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/^_(.+?)_$/, '<em>$1</em>')
      // liens markdown [texte](url)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // → [url] avec flèche
      .replace(/→\s*\[(https?:\/\/[^\]]+)\]/g, '<a href="$1" target="_blank" class="source">→ Source originale</a>')
      // [url] nu (sans flèche) — format variable selon le modèle
      .replace(/\[(https?:\/\/[^\]]+)\]/g, '<a href="$1" target="_blank" class="source">→ Source originale</a>')
      // → texte sans URL (note RNCP, lien à vérifier…)
      .replace(/→\s*([^<\n]+)/g, '<span class="note">→ $1</span>');

    if (line.startsWith('# ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h1>${line.slice(2)}</h1>`);
    } else if (line.startsWith('## ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h2>${line.slice(3)}</h2>`);
    } else if (line.startsWith('### ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h3>${line.slice(4)}</h3>`);
    } else if (/^---+$/.test(raw)) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push('<hr>');
    } else if (line.startsWith('- ')) {
      if (!inList) { htmlLines.push('<ul>'); inList = true; }
      htmlLines.push(`<li>${line.slice(2)}</li>`);
    } else if (line.trim() === '') {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push('');
    } else {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<p>${line}</p>`);
    }
  }
  if (inList) htmlLines.push('</ul>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Veille Techno — Version FR</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 780px; margin: 40px auto; padding: 0 20px; background: #f9f9fb; color: #1a1a2e; line-height: 1.7; }
    h1 { font-size: 1.6rem; color: #1a1a2e; border-bottom: 2px solid #f5a623; padding-bottom: 8px; margin-top: 32px; }
    h2 { font-size: 1.15rem; color: #f5a623; margin-top: 32px; margin-bottom: 4px; }
    h3 { font-size: 1rem; color: #444; margin-top: 20px; }
    p { margin: 6px 0; }
    ul { margin: 6px 0 6px 20px; }
    li { margin: 4px 0; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.source { display: inline-block; margin-top: 4px; font-size: 0.85rem; color: #f5a623; font-weight: 600; }
    .source-missing { font-size: 0.85rem; color: #999; font-style: italic; }
    .note { font-size: 0.85rem; color: #666; font-style: italic; }
    strong { color: #1a1a2e; }
    hr { border: none; border-top: 1px solid #ddd; margin: 28px 0; }
    em { color: #666; }
  </style>
</head>
<body>
${htmlLines.join('\n')}
</body>
</html>`;
}
