/**
 * Test du pipeline complet sans la systray.
 * Lance : npx tsx scripts/test-pipeline.ts [--mode=daily|weekly] [--skip-github] [--skip-drive] [--skip-discord]
 */
import { config } from '../src/config.js';
import { searchVeilleTopics } from '../src/tavily-client.js';
import { generateVeilleMarkdown } from '../src/openrouter-client.js';
import { pushToWiki } from '../src/github-wiki.js';
import { uploadToDrive } from '../src/drive-client.js';
import { extractIncontournables, formatDiscordMessage, postToDiscord } from '../src/discord-client.js';
import { saveOutput, saveLatestDigest, saveTranslatedDigest, getRunLabel, getWeekDailyDigests } from '../src/output.js';
import { translateDigest } from '../src/translate.js';
import { appendRunLog } from '../src/run-logger.js';
import type { RunMode } from '../src/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');

const mode: RunMode = process.argv.includes('--mode=weekly') ? 'weekly' : 'daily';
const SKIP_GITHUB  = process.argv.includes('--skip-github');
const SKIP_DRIVE   = process.argv.includes('--skip-drive');
const SKIP_DISCORD = process.argv.includes('--skip-discord');

const PROMPT_FILES: Record<RunMode, string> = {
  daily:  'veille-quotidienne.txt',
  weekly: 'veille-recap.txt',
};

const TAVILY_DAYS: Record<RunMode, number | undefined> = {
  daily:  2,
  weekly: undefined,
};

console.log(`=== Test pipeline veille (mode: ${mode}) ===\n`);

// ── 1. Prompt ──────────────────────────────────────────────────────────────
const promptPath = path.join(PROMPTS_DIR, PROMPT_FILES[mode]);
if (!fs.existsSync(promptPath)) throw new Error(`Prompt introuvable : ${promptPath}`);
const prompt = fs.readFileSync(promptPath, 'utf-8').trim();
console.log(`✓ Prompt chargé : ${PROMPT_FILES[mode]} (${prompt.length} caractères)`);

// ── 2. Tavily ──────────────────────────────────────────────────────────────
console.log('\n[1/3] Recherche Tavily (9 topics × 3 résultats)…');
const t0 = Date.now();
const freshResults = await searchVeilleTopics(config.tavilyApiKey, TAVILY_DAYS[mode]);
console.log(`✓ Tavily : ${freshResults.length} caractères en ${Date.now() - t0} ms`);
console.log('--- Aperçu Tavily (500 premiers caractères) ---');
console.log(freshResults.slice(0, 500) + '…\n');

// ── 3. OpenRouter ──────────────────────────────────────────────────────────
let searchInput = freshResults;
if (mode === 'weekly') {
  const weekDigests = getWeekDailyDigests(OUTPUT_DIR);
  if (weekDigests) {
    searchInput =
      `DIGESTS LUNDI→JEUDI :\n\n${weekDigests}\n\n` +
      `---\n\nNOUVEAUTÉS DU VENDREDI :\n\n${freshResults}`;
    console.log('[weekly] Digests lundi→jeudi inclus\n');
  } else {
    console.log('[weekly] Aucun digest de semaine trouvé (normal si premier run)\n');
  }
}

console.log(`[2/3] Rédaction OpenRouter (${config.openrouterModel})…`);
const t1 = Date.now();
const body = await generateVeilleMarkdown(config.openrouterApiKey, config.openrouterModel, prompt, searchInput);
console.log(`✓ OpenRouter : ${body.length} caractères en ${Date.now() - t1} ms`);

const label = getRunLabel(mode);
const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
const markdown = `_Généré le ${date}_\n\n${body}`;

// ── 4. Sauvegarde locale ───────────────────────────────────────────────────
const filepath = saveOutput(markdown, mode, OUTPUT_DIR);
saveLatestDigest(markdown, label, OUTPUT_DIR);
console.log(`✓ Sauvegardé : ${filepath}`);

// ── 4b. Traduction locale ──────────────────────────────────────────────────
console.log('\n[4b] Traduction locale (articles [EN])…');
const t1b = Date.now();
try {
  const translated = await translateDigest(markdown, config.openrouterApiKey, config.openrouterModel);
  saveTranslatedDigest(translated, OUTPUT_DIR);
  console.log(`✓ Traduit : output/latest-traduit.html (${Date.now() - t1b} ms)`);
} catch (err) {
  console.warn(`⚠ Traduction échouée (non bloquant) : ${(err as Error).message}`);
}

// ── 5. GitHub wiki ─────────────────────────────────────────────────────────
if (SKIP_GITHUB) {
  console.log('\n[3/3] GitHub wiki ignoré (--skip-github)\n');
} else {
  console.log('\n[3/3] Push GitHub wiki…');
  const t2 = Date.now();
  const { commitSha, filename } = await pushToWiki(
    config.githubToken, config.githubUsername, config.githubRepo, label, markdown,
  );
  console.log(`✓ Wiki mis à jour : ${filename} — commit ${commitSha.slice(0, 7)} (${Date.now() - t2} ms)`);
}

// ── 6. Google Drive ────────────────────────────────────────────────────────
if (SKIP_DRIVE || !config.google) {
  console.log(`[Drive] Ignoré (${SKIP_DRIVE ? '--skip-drive' : 'vars Google absentes'})\n`);
} else {
  console.log('\n[Drive] Upload Google Drive…');
  const t3 = Date.now();
  const filename = path.basename(filepath);
  const driveUrl = await uploadToDrive(config.google, filename, markdown);
  console.log(`✓ Drive → ${driveUrl} (${Date.now() - t3} ms)`);
}

// ── 7. Discord ─────────────────────────────────────────────────────────────
if (SKIP_DISCORD || !config.discordWebhookUrl) {
  console.log(`[Discord] Ignoré (${SKIP_DISCORD ? '--skip-discord' : 'DISCORD_WEBHOOK_URL absente'})\n`);
} else {
  console.log('\n[Discord] Envoi webhook Discord…');
  const t4 = Date.now();
  const incontournables = extractIncontournables(markdown);
  if (!incontournables) {
    console.log('[Discord] Section "🔥 Incontournables" introuvable — envoi ignoré');
  } else {
    const message = formatDiscordMessage(incontournables, label, config.githubUsername, config.githubRepo);
    await postToDiscord(config.discordWebhookUrl, message);
    console.log(`✓ Discord → message envoyé (${Date.now() - t4} ms)`);
  }
}

// ── 8. Log ─────────────────────────────────────────────────────────────────
appendRunLog({
  date: new Date().toISOString(),
  durationMs: Date.now() - t0,
  model: config.openrouterModel,
  wikiPage: label,
  success: true,
});
console.log('✓ Run loggé dans logs/pipeline.json');

console.log('\n=== Pipeline OK ===');
