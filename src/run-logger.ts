import fs from 'fs';
import path from 'path';
import type { RunLogEntry } from './types.js';

const LOG_PATH = path.resolve('logs', 'pipeline.json');
const MAX_ENTRIES = 52;

/**
 * Ajoute une entrée dans logs/pipeline.json.
 * Conserve les MAX_ENTRIES derniers runs (1 an de veille hebdo).
 */
export function appendRunLog(entry: RunLogEntry): void {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const entries: RunLogEntry[] = fs.existsSync(LOG_PATH)
    ? (JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')) as RunLogEntry[])
    : [];

  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);

  fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}
