/** Label de semaine ISO 8601 : YYYY-Www (ex. 2026-W23) */
export type WeekLabel = string;

/** Résultat d'un push vers le wiki GitHub */
export interface WikiPushResult {
  commitSha: string;
  filename: string;
}

/** Entrée de log d'un run de pipeline */
export interface RunLogEntry {
  date: string;
  durationMs: number;
  model: string;
  wikiPage: string;
  success: boolean;
  error?: string;
}
