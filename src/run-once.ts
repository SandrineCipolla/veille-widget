import { runVeille } from './pipeline.js';

console.log('[Veille] Lancement unique du pipeline…');

runVeille()
  .then(() => { console.log('[Veille] Pipeline terminé.'); process.exit(0); })
  .catch((err: Error) => { console.error('[Veille] Erreur pipeline :', err.message); process.exit(1); });
