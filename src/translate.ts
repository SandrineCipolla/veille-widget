import OpenAI from 'openai';
import { withRetry } from './retry.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_TOKENS = 4_000;
const TIMEOUT_MS = 120_000;
const RETRY_BASE_DELAY_MS = 15_000;

const TRANSLATE_SYSTEM_PROMPT = `Tu reçois un digest de veille technologique en français.
Pour chaque article marqué [EN] : développe le résumé en une version française complète de 4 à 6 phrases,
en exploitant le contenu fourni et tes connaissances du sujet. Sois précis et concret.
Pour les articles [FR] : conserve-les tels quels, sans modification.
Conserve exactement la structure Markdown, les URLs et les titres (avec leur tag [FR]/[EN]).
Ce document est à usage personnel — privilégie la clarté et le détail sur la concision.`;

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 429 || status === 502 || status === 503;
}

/**
 * Prend le digest hebdomadaire et développe les items [EN] en explications
 * françaises détaillées. Sauvegardé localement uniquement, jamais publié.
 */
export async function translateDigest(digest: string, apiKey: string, model: string): Promise<string> {
  return withRetry(
    () => callTranslate(digest, apiKey, model),
    isRetryable,
    RETRY_BASE_DELAY_MS,
  );
}

async function callTranslate(digest: string, apiKey: string, model: string): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: TIMEOUT_MS,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/SandrineCipolla/veille-widget',
      'X-Title': 'Veille Techno Widget',
    },
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
        { role: 'user', content: digest },
      ],
      max_tokens: MAX_TOKENS,
    });
  } catch (err) {
    const e = err as { status?: number; message?: string; code?: string };
    if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT') {
      throw Object.assign(
        new Error(`Impossible de joindre OpenRouter (réseau) : ${e.message}`),
        { code: e.code },
      );
    }
    if (e.status === 401) throw new Error('OpenRouter : clé API invalide (401)');
    if (e.status === 429)
      throw Object.assign(new Error('OpenRouter : quota dépassé (429)'), { status: 429 });
    throw new Error(`OpenRouter erreur ${e.status ?? '?'} : ${e.message}`);
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Réponse de traduction vide');
  return content;
}
