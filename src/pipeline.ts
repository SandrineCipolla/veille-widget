import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { searchVeilleTopics } from './tavily-client.js';
import { generateVeilleMarkdown } from './openrouter-client.js';
import { pushToWiki } from './github-wiki.js';
import { notifySuccess, notifyError } from './notifier.js';
import { getRunLabel, saveOutput, saveLatestDigest, getWeekDailyDigests } from './output.js';
import { uploadToDrive } from './drive-client.js';
import { extractIncontournables, formatDiscordMessage, postToDiscord } from './discord-client.js';
import { appendRunLog } from './run-logger.js';
import { translateDigest } from './translate.js';
import { saveTranslatedDigest } from './output.js';
import type { RunMode } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

const PROMPT_FILES: Record<RunMode, string> = {
  daily: 'veille-quotidienne.txt',
  weekly: 'veille-recap.txt',
};

const TAVILY_DAYS: Record<RunMode, number | undefined> = {
  daily: 2,
  weekly: undefined, // utilise les defaults par topic
};

/**
 * Exécute le pipeline de veille.
 * - mode 'daily' (lundi→jeudi) : Tavily 2 jours, prompt court, wiki page = date
 * - mode 'weekly' (vendredi) : Tavily 2 jours + digests lundi→jeudi, prompt récap, wiki page = semaine
 */
export async function runVeille(mode: RunMode = 'daily'): Promise<void> {
  const startedAt = Date.now();
  const label = getRunLabel(mode);

  try {
    const prompt = loadPrompt(mode);

    console.log(`[Veille] Recherche Tavily (mode: ${mode})…`);
    const freshResults = await searchVeilleTopics(config.tavilyApiKey, TAVILY_DAYS[mode]);

    let searchInput = freshResults;
    if (mode === 'weekly') {
      const weekDigests = getWeekDailyDigests(OUTPUT_DIR);
      if (weekDigests) {
        searchInput =
          `DIGESTS LUNDI→JEUDI :\n\n${weekDigests}\n\n` +
          `---\n\nNOUVEAUTÉS DU VENDREDI :\n\n${freshResults}`;
        console.log('[Veille] Digests de la semaine inclus dans le récap');
      }
    }

    console.log(`[Veille] Rédaction OpenRouter (${config.openrouterModel})…`);
    const body = await generateVeilleMarkdown(config.openrouterApiKey, config.openrouterModel, prompt, searchInput);

    const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
    const markdown = `_Généré le ${date}_\n\n${body}`;

    console.log('[Veille] Sauvegarde locale…');
    const filepath = saveOutput(markdown, mode, OUTPUT_DIR);
    const filename = path.basename(filepath);
    saveLatestDigest(markdown, label, OUTPUT_DIR);

    // Traduction locale uniquement — jamais publiée (output/ est gitignored)
    try {
      console.log('[Veille] Traduction locale…');
      const translated = await translateDigest(markdown, config.openrouterApiKey, config.openrouterModel);
      saveTranslatedDigest(translated, OUTPUT_DIR);
    } catch (err) {
      console.warn('[Veille] Traduction (non bloquant) :', (err as Error).message);
    }

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

    appendRunLog({ date: new Date().toISOString(), durationMs: Date.now() - startedAt, model: config.openrouterModel, wikiPage: label, success: true });
    console.log('[Veille] Terminé !');
    notifySuccess(filename);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    appendRunLog({ date: new Date().toISOString(), durationMs: Date.now() - startedAt, model: config.openrouterModel, wikiPage: label, success: false, error: error.message });
    console.error('[Veille] Erreur :', error.message);
    notifyError(error);
    throw error;
  }
}

function loadPrompt(mode: RunMode): string {
  const filename = PROMPT_FILES[mode];
  const promptPath = path.join(PROMPTS_DIR, filename);
  if (!fs.existsSync(promptPath)) throw new Error(`Prompt introuvable : ${promptPath}`);
  const content = fs.readFileSync(promptPath, 'utf-8').trim();
  if (!content) throw new Error(`Le prompt ${filename} est vide.`);
  return content;
}
