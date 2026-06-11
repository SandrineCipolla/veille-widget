import cron, { type ScheduledTask } from 'node-cron';

/**
 * Démarre le job cron si CRON_SCHEDULE est défini.
 * Appelle onTick() à chaque déclenchement.
 * Retourne le job démarré ou null si CRON_SCHEDULE absent.
 */
export function startCronJob(
  schedule: string | undefined,
  onTick: () => void,
): ScheduledTask | null {
  if (!schedule) return null;

  if (!cron.validate(schedule)) {
    throw new Error(`Expression cron invalide : "${schedule}"`);
  }

  console.log(`[cron] Job planifié : ${schedule}`);

  return cron.schedule(schedule, () => {
    console.log('[cron] Déclenchement automatique…');
    onTick();
  });
}
