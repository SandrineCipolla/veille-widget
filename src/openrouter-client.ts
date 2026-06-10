import OpenAI from 'openai';
import { z } from 'zod';
import { withRetry } from './retry.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_TOKENS = 4_000;
const TIMEOUT_MS = 120_000;
// Les modèles gratuits OpenRouter ont un rate-limit strict — 15 s entre chaque retry
const RETRY_BASE_DELAY_MS = 15_000;

const CompletionContentSchema = z.string().min(1, 'Réponse OpenRouter vide');

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 429 || status === 502 || status === 503;
}

/**
 * Envoie le system prompt de veille + les résultats Tavily à OpenRouter.
 * - systemPrompt : instructions de format et de filtrage (role: system)
 * - searchResults : résultats Tavily bruts à synthétiser (role: user)
 * Le modèle est configurable via OPENROUTER_MODEL dans .env.
 */
export async function generateVeilleMarkdown(
    apiKey: string,
    model: string,
    systemPrompt: string,
    searchResults: string,
): Promise<string> {
  return withRetry(
      () => callOpenRouter(apiKey, model, systemPrompt, searchResults),
      isRetryable,
      RETRY_BASE_DELAY_MS,
  );
}

async function callOpenRouter(
    apiKey: string,
    model: string,
    systemPrompt: string,
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

  const now = new Date();
  const weekLabel = getISOWeekLabel(now);

  const userMessage =
      `Date de génération : ${now.toISOString()}\n` +
      `Semaine : ${weekLabel}\n\n` +
      `RAPPEL : La section "À surveiller" doit uniquement contenir des sujets ` +
      `en lien direct avec la stack TypeScript/React/Node.js/Azure ou un bloc RNCP. ` +
      `Aucun sujet tech généraliste (OS, hardware, télécoms, autres langages).\n\n` +
      `Résultats de recherche web (7 derniers jours) :\n\n${searchResults}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
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

  const rawContent: unknown = completion.choices[0]?.message?.content;
  const parsed = CompletionContentSchema.safeParse(rawContent);
  if (!parsed.success) throw new Error(`Réponse OpenRouter invalide : ${parsed.error.message}`);

  return parsed.data;
}

/**
 * Retourne un label lisible pour la semaine ISO courante.
 * Ex : "S24 (du 09/06/2025 au 15/06/2025)"
 */
function getISOWeekLabel(date: Date): string {
  const startOfWeek = getMonday(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekNum = getISOWeekNumber(date);
  const fmt = (d: Date): string =>
      d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `S${weekNum} (du ${fmt(startOfWeek)} au ${fmt(endOfWeek)})`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // lundi = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}