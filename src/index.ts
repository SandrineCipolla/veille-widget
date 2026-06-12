import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type * as Systray2Types from 'systray2';
import { config } from './config.js';
import { runVeille } from './pipeline.js';
import { startCronJob } from './cron.js';

const _require = createRequire(import.meta.url);
const SysTray = (_require('systray2') as { default: typeof Systray2Types.default }).default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_PATH = path.resolve(__dirname, '..', 'assets', 'icon.ico');

ensureIcon(ICON_PATH);

const runGuard = createRunGuard();

const systray = new SysTray({
  menu: {
    icon: ICON_PATH,
    title: '',
    tooltip: 'Veille Techno',
    items: [
      { title: 'Lancer la veille', tooltip: 'Tavily + OpenRouter → wiki GitHub', checked: false, enabled: true },
      SysTray.separator,
      { title: 'Quitter', tooltip: 'Fermer le widget', checked: false, enabled: true },
    ],
  },
  debug: false,
  copyDir: true,
});

systray.onClick((action) => {
  if (action.item.title === 'Lancer la veille') void trigger();
  if (action.item.title === 'Quitter') { void systray.kill(false); process.exit(0); }
});

console.log('[Veille] Widget démarré — icône dans la barre des tâches.');

const cronJob = startCronJob(config.cronSchedule, () => void trigger());
if (cronJob) console.log('[Veille] Cron actif —', config.cronSchedule);

async function trigger(): Promise<void> {
  if (!runGuard.acquire()) { console.log('[Veille] Déjà en cours, veuillez patienter…'); return; }
  try { await runVeille(); } catch { /* déjà loggé et notifié dans pipeline.ts */ } finally { runGuard.release(); }
}

function createRunGuard(): { acquire: () => boolean; release: () => void } {
  let running = false;
  return {
    acquire: () => { if (running) return false; running = true; return true; },
    release: () => { running = false; },
  };
}

function ensureIcon(iconPath: string): void {
  if (fs.existsSync(iconPath)) return;
  const dir = path.dirname(iconPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(iconPath, buildIco());
}

function buildIco(): Buffer {
  const W = 16, H = 16;
  const pixelBytes = W * H * 4;
  const maskBytes = Math.ceil(W / 32) * 4 * H;
  const bmpBytes = 40 + pixelBytes + maskBytes;
  const buf = Buffer.alloc(6 + 16 + bmpBytes, 0);
  let o = 0;

  buf.writeUInt16LE(0, o); o += 2;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt8(W, o++); buf.writeUInt8(H, o++); buf.writeUInt8(0, o++); buf.writeUInt8(0, o++);
  buf.writeUInt16LE(1, o); o += 2; buf.writeUInt16LE(32, o); o += 2;
  buf.writeUInt32LE(bmpBytes, o); o += 4; buf.writeUInt32LE(22, o); o += 4;
  buf.writeUInt32LE(40, o); o += 4; buf.writeInt32LE(W, o); o += 4; buf.writeInt32LE(H * 2, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2; buf.writeUInt16LE(32, o); o += 2;
  for (let i = 0; i < 6; i++) { buf.writeUInt32LE(0, o); o += 4; }
  for (let i = 0; i < W * H; i++) { buf[o++] = 0x9B; buf[o++] = 0x59; buf[o++] = 0x27; buf[o++] = 0xFF; }

  return buf;
}
