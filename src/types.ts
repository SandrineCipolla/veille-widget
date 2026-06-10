/** Label de semaine ISO 8601 : YYYY-Www (ex. 2026-W23) */
export type WeekLabel = string;

/** Résultat d'un push vers le wiki GitHub */
export interface WikiPushResult {
  commitSha: string;
  filename: string;
}
