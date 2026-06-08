/**
 * Test du pipeline complet sans la systray.
 * Lance : npx tsx scripts/test-pipeline.ts [--skip-github]
 */
import { config } from '../src/config.js';
import { searchVeilleTopics } from '../src/tavily-client.js';
import { generateVeilleMarkdown } from '../src/openrouter-client.js';
import { pushToWiki } from '../src/github-wiki.js';
import { saveOutput, getWeekLabel } from '../src/output.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIP_GITHUB = process.argv.includes('--skip-github');

console.log('=== Test pipeline veille ===\n');

// ── 1. Prompt ──────────────────────────────────────────────────────────────
const promptPath = path.resolve(__dirname, '..', 'prompts', 'veille-hebdo.txt');
const prompt = fs.readFileSync(promptPath, 'utf-8').trim();
console.log(`✓ Prompt chargé (${prompt.length} caractères)`);

// ── 2. Tavily ──────────────────────────────────────────────────────────────
console.log('\n[1/3] Recherche Tavily (5 topics × 3 résultats)…');
const t0 = Date.now();
const searchResults = await searchVeilleTopics(config.tavilyApiKey);
console.log(`✓ Tavily : ${searchResults.length} caractères en ${Date.now() - t0} ms`);
console.log('--- Aperçu Tavily (500 premiers caractères) ---');
console.log(searchResults.slice(0, 500) + '…\n');

// ── 3. OpenRouter ──────────────────────────────────────────────────────────
console.log(`[2/3] Rédaction OpenRouter (${config.openrouterModel})…`);
const t1 = Date.now();
const body = await generateVeilleMarkdown(config.openrouterApiKey, config.openrouterModel, prompt, searchResults);
console.log(`✓ OpenRouter : ${body.length} caractères en ${Date.now() - t1} ms`);

const label = getWeekLabel();
const date = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
const markdown = `# Veille Techno ${label}\n\n_Généré le ${date}_\n\n${body}`;

// ── 4. Sauvegarde locale ───────────────────────────────────────────────────
const filepath = saveOutput(markdown);
console.log(`✓ Sauvegardé : ${filepath}`);

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

console.log('\n=== Pipeline OK ===');
