import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type * as Systray2Types from 'systray2';
import { config } from './config.js';

// systray2 est un module CJS avec __esModule:true — createRequire évite l'enveloppement ESM
const _require = createRequire(import.meta.url);
const SysTray = (_require('systray2') as { default: typeof Systray2Types.default }).default;
import { searchVeilleTopics } from './tavily-client.js';
import { generateVeilleMarkdown } from './openrouter-client.js';
import { pushToWiki } from './github-wiki.js';
import { notifySuccess, notifyError } from './notifier.js';
import { getWeekLabel, saveOutput } from './output.js';
import { uploadToDrive } from './drive-client.js';
import { extractIncontournables, formatDiscordMessage, postToDiscord } from './discord-client.js';
import { startCronJob } from './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_PATH = path.resolve(__dirname, '..', 'assets', 'icon.ico');
const PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

ensureIcon(ICON_PATH);

// Encapsule l'état d'exécution pour éviter les lancements parallèles
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
  if (action.item.title === 'Lancer la veille') void runVeille();
  if (action.item.title === 'Quitter') { void systray.kill(false); process.exit(0); }
});

console.log('[Veille] Widget démarré — icône dans la barre des tâches.');

const cronJob = startCronJob(config.cronSchedule, () => void runVeille());
if (cronJob) console.log('[Veille] Cron actif —', config.cronSchedule);

async function runVeille(): Promise<void> {
  if (!runGuard.acquire()) {
    console.log('[Veille] Déjà en cours, veuillez patienter…');
    return;
  }

  try {
    const prompt = loadPrompt();
    console.log('[Veille] Recherche web Tavily…');
    const searchResults = await searchVeilleTopics(config.tavilyApiKey);
    console.log(`[Veille] Rédaction OpenRouter (${config.openrouterModel})…`);
    const body = await generateVeilleMarkdown(config.openrouterApiKey, config.openrouterModel, prompt, searchResults);

    const label = getWeekLabel();
    const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
    const markdown = `_Généré le ${date}_\n\n${body}`;
    console.log('[Veille] Sauvegarde locale…');
    const filename = saveMarkdown(markdown);

    console.log('[Veille] Publication sur le wiki GitHub…');
    const { commitSha } = await pushToWiki(config.githubToken, config.githubUsername, config.githubRepo, label, markdown);
    console.log(`[Veille] Wiki — commit ${commitSha.slice(0, 7)}`);

    if (config.google) {
      console.log('[Veille] Upload Google Drive…');
      const driveUrl = await uploadToDrive(config.google, filename, markdown);
      console.log(`[Veille] Drive → ${driveUrl}`);
    }

    if (config.discordWebhookUrl) {
      try {
        const incontournables = extractIncontournables(markdown);
        if (incontournables) {
          const message = formatDiscordMessage(incontournables, label, config.githubUsername, config.githubRepo);
          await postToDiscord(config.discordWebhookUrl, message);
          console.log('[Veille] Discord → message envoyé');
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[Veille] Discord (non bloquant) :', error.message);
      }
    }

    console.log('[Veille] Terminé !');
    notifySuccess(filename);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[Veille] Erreur :', error.message);
    notifyError(error);
  } finally {
    runGuard.release();
  }
}

function loadPrompt(): string {
  const promptPath = path.join(PROMPTS_DIR, 'veille-hebdo.txt');
  if (!fs.existsSync(promptPath)) throw new Error(`Prompt introuvable : ${promptPath}`);
  const content = fs.readFileSync(promptPath, 'utf-8').trim();
  if (!content || content === '[COLLE TON PROMPT ICI]') throw new Error('Le prompt veille-hebdo.txt est vide ou non renseigné.');
  return content;
}

function saveMarkdown(content: string): string {
  const filepath = saveOutput(content, OUTPUT_DIR);
  return path.basename(filepath);
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
