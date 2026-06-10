import OpenAI from 'openai';
import { z } from 'zod';
import { withRetry } from './retry.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_TOKENS = 2_000;
const TIMEOUT_MS = 120_000;
// Les modèles gratuits OpenRouter ont un rate-limit strict — 15 s entre chaque retry
const RETRY_BASE_DELAY_MS = 15_000;

const CompletionContentSchema = z.string().min(1, 'Réponse OpenRouter vide');

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 429 || status === 502 || status === 503;
}

/**
 * Envoie le prompt de veille + les résultats Tavily à OpenRouter.
 * Le modèle est configurable via OPENROUTER_MODEL dans .env.
 */
export async function generateVeilleMarkdown(
  apiKey: string,
  model: string,
  prompt: string,
  searchResults: string,
): Promise<string> {
  return withRetry(() => callOpenRouter(apiKey, model, prompt, searchResults), isRetryable, RETRY_BASE_DELAY_MS);
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  prompt: string,
  searchResults: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: TIMEOUT_MS,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/SandrineCipolla/veille-widget',
      'X-Title': 'Veille Techno Widget',
    },
  });

  const userMessage = `${prompt}\n\n---\n\nRésultats de recherche web (7 derniers jours) :\n\n${searchResults}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: MAX_TOKENS,
    });
  } catch (err) {
    const e = err as { status?: number; message?: string; code?: string };
    if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT') {
      throw Object.assign(new Error(`Impossible de joindre OpenRouter (réseau) : ${e.message}`), { code: e.code });
    }
    if (e.status === 401) throw new Error('OpenRouter : clé API invalide (401)');
    if (e.status === 429) throw Object.assign(new Error('OpenRouter : quota dépassé (429)'), { status: 429 });
    throw new Error(`OpenRouter erreur ${e.status ?? '?'} : ${e.message}`);
  }

  const rawContent: unknown = completion.choices[0]?.message?.content;
  const parsed = CompletionContentSchema.safeParse(rawContent);
  if (!parsed.success) throw new Error(`Réponse OpenRouter invalide : ${parsed.error.message}`);

  return parsed.data;
}
