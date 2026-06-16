import { runVeille } from './pipeline.js';
import type { RunMode } from './types.js';

const mode: RunMode = process.argv.includes('--mode=weekly') ? 'weekly' : 'daily';

console.log(`[Veille] Lancement pipeline (mode: ${mode})…`);

runVeille(mode)
  .then(() => { console.log('[Veille] Pipeline terminé.'); process.exit(0); })
  .catch((err: Error) => { console.error('[Veille] Erreur pipeline :', err.message); process.exit(1); });
