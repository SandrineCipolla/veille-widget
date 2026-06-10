import { tavily } from '@tavily/core';
import { z } from 'zod';
import { withRetry } from './retry.js';

const MAX_RESULTS_PER_TOPIC = 3;
const DAYS = 7;

/** Requêtes de recherche couvrant chaque section du prompt de veille */
const SEARCH_TOPICS: ReadonlyArray<{ label: string; query: string }> = [
  { label: 'Stack technique', query: 'TypeScript React Vite Node.js Tailwind actualités semaine' },
  { label: 'Architecture', query: 'architecture logicielle DDD microservices BFF hexagonale patterns semaine' },
  { label: 'Sécurité', query: 'sécurité web OWASP CVE vulnérabilité Node.js React RGPD ANSSI semaine' },
  { label: 'DevOps & CI/CD', query: 'DevOps CI/CD GitHub Actions Docker déploiement continu semaine' },
  { label: 'Numérique responsable', query: 'numérique responsable green IT éco-conception web accessibilité WCAG semaine' },
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
