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
 * Écrase outputDir/latest-traduit.md avec la version traduite du digest.
 * Fichier local uniquement — outputDir est gitignored, il ne part jamais sur GitHub.
 */
export function saveTranslatedDigest(content: string, outputDir = './output'): void {
  const dir = path.resolve(outputDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'latest-traduit.md'), content, 'utf-8');
}
