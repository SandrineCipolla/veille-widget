import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { searchVeilleTopics } from './tavily-client.js';
import { generateVeilleMarkdown } from './openrouter-client.js';
import { pushToWiki } from './github-wiki.js';
import { notifySuccess, notifyError } from './notifier.js';
import { getWeekLabel, saveOutput, saveLatestDigest } from './output.js';
import { uploadToDrive } from './drive-client.js';
import { extractIncontournables, formatDiscordMessage, postToDiscord } from './discord-client.js';
import { appendRunLog } from './run-logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

/**
 * Exécute le pipeline de veille complet : Tavily → OpenRouter → wiki → notifications.
 * Throw en cas d'échec (après avoir loggé et notifié).
 */
export async function runVeille(): Promise<void> {
  const startedAt = Date.now();
  const label = getWeekLabel();

  try {
    const prompt = loadPrompt();
    console.log('[Veille] Recherche web Tavily…');
    const searchResults = await searchVeilleTopics(config.tavilyApiKey);
    console.log(`[Veille] Rédaction OpenRouter (${config.openrouterModel})…`);
    const body = await generateVeilleMarkdown(config.openrouterApiKey, config.openrouterModel, prompt, searchResults);

    const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
    const markdown = `_Généré le ${date}_\n\n${body}`;

    console.log('[Veille] Sauvegarde locale…');
    const filepath = saveOutput(markdown, OUTPUT_DIR);
    const filename = path.basename(filepath);
    saveLatestDigest(markdown, label, OUTPUT_DIR);

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

function loadPrompt(): string {
  const promptPath = path.join(PROMPTS_DIR, 'veille-hebdo.txt');
  if (!fs.existsSync(promptPath)) throw new Error(`Prompt introuvable : ${promptPath}`);
  const content = fs.readFileSync(promptPath, 'utf-8').trim();
  if (!content || content === '[COLLE TON PROMPT ICI]') throw new Error('Le prompt veille-hebdo.txt est vide ou non renseigné.');
  return content;
}
