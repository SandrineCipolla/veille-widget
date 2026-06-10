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
