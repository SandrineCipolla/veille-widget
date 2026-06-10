import { tavily } from '@tavily/core';
import { z } from 'zod';
import { withRetry } from './retry.js';

const MAX_RESULTS_PER_TOPIC = 3;
const DAYS = 7;
const CURRENT_YEAR = new Date().getFullYear();

/** Requêtes de recherche couvrant chaque section du prompt de veille */
const SEARCH_TOPICS: ReadonlyArray<{ label: string; query: string }> = [
  {
    label: 'Stack TS/React/Node.js',
    query: `TypeScript React 19 Vite Node.js release changelog ${CURRENT_YEAR}`,
  },
  {
    label: 'Architecture logicielle',
    query: `software architecture patterns microservices monolith news ${CURRENT_YEAR}`,
  },
  {
    label: 'IA & LLM en production',
    query: `LLM production Gemma Mistral OpenRouter Claude AI agent patterns ${CURRENT_YEAR}`,
  },
  {
    label: 'Sécurité applicative',
    query: `OWASP CVE Node.js npm security vulnerability advisory ${CURRENT_YEAR}`,
  },
  {
    label: 'Réglementation numérique',
    query: `EU AI Act RGPD ANSSI Cyber Resilience Act conformité ${CURRENT_YEAR}`,
  },
  {
    label: 'DevOps & CI/CD',
    query: `GitHub Actions CI/CD Docker déploiement continu release ${CURRENT_YEAR}`,
  },
  {
    label: 'Numérique responsable',
    query: `green software sustainability web performance carbon ${CURRENT_YEAR}`,
  },
  {
    label: 'Accessibilité',
    query: `WCAG 2.2 RGAA accessibilité web a11y ${CURRENT_YEAR}`,
  },
  {
    label: 'Outils dev & pratiques',
    query: `Claude Code developer tools TypeScript ESLint Vitest pratiques développement ${CURRENT_YEAR}`,
  },
];

const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  publishedDate: z.string().optional(),
});

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; code?: string };
  if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'ENOTFOUND') return true;
  return e.status === 429 || e.status === 502 || e.status === 503;
}

/**
 * Lance une recherche Tavily par section de veille en parallèle.
 * Retourne les résultats consolidés sous forme de texte structuré.
 */
export async function searchVeilleTopics(apiKey: string): Promise<string> {
  const client = tavily({ apiKey });

  const searches = SEARCH_TOPICS.map((topic) =>
    withRetry(
      () => client.search(topic.query, { searchDepth: 'basic', topic: 'news', days: DAYS, maxResults: MAX_RESULTS_PER_TOPIC }),
      isRetryable,
    ).then((res) => ({ label: topic.label, results: res.results })),
  );

  const settled = await Promise.allSettled(searches);
  const sections: string[] = [];

  for (const [i, outcome] of settled.entries()) {
    const label = SEARCH_TOPICS[i]!.label;
    if (outcome.status === 'rejected') {
      console.warn(`[Tavily] Recherche "${label}" échouée :`, (outcome.reason as Error).message);
      sections.push(`## ${label}\n_(recherche indisponible)_`);
      continue;
    }

    const results = outcome.value.results
      .map((r) => SearchResultSchema.safeParse(r))
      .filter((p) => p.success)
      .map((p) => p.data!);

    const items = results
      .map((r, idx) => `${idx + 1}. **${r.title}** (${r.publishedDate ?? 'date inconnue'})\n   ${r.content.slice(0, 300)}\n   Source : ${r.url}`)
      .join('\n\n');

    sections.push(`## ${label}\n${items || '_(aucun résultat)_'}`);
  }

  return sections.join('\n\n');
}
