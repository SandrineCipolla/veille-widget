import { tavily } from '@tavily/core';
import { z } from 'zod';
import { withRetry } from './retry.js';

const MAX_RESULTS_PER_TOPIC = 3;
const CURRENT_YEAR = new Date().getFullYear();

interface SearchTopic {
  label: string;
  query: string;
  days: number;
  topic: 'news' | 'general';
  includeDomains?: string[];
}

/**
 * Structure à deux niveaux :
 * - Topics principaux (EN) : topic:'news', 7 jours — garantissent du contenu de qualité
 * - Topics FR supplémentaires : topic:'general', 14 jours + includeDomains officiels FR
 *   → viennent enrichir les mêmes sections ; OpenRouter choisit le meilleur indépendamment de la langue
 */
const SEARCH_TOPICS: ReadonlyArray<SearchTopic> = [
  // ── Topics internationaux ─────────────────────────────────────────────────
  {
    label: 'Stack TS/React/Node.js',
    query: `TypeScript "React framework" OR "Node.js" OR "Vite" release changelog developer ${CURRENT_YEAR}`,
    days: 7,
    topic: 'news',
  },
  {
    label: 'Architecture & patterns',
    query: `software architecture microservices DDD event-driven patterns ${CURRENT_YEAR}`,
    days: 7,
    topic: 'news',
  },
  {
    label: 'IA & LLM en production',
    query: `LLM agent AI production Claude Gemini OpenAI developer ${CURRENT_YEAR}`,
    days: 7,
    topic: 'news',
  },
  {
    label: 'Sécurité — CVE & advisories',
    query: `CVE Node.js npm security vulnerability advisory ${CURRENT_YEAR}`,
    days: 7,
    topic: 'news',
  },
  {
    label: 'DevOps & CI/CD',
    query: `GitHub Actions Docker Kubernetes CI/CD deployment release ${CURRENT_YEAR}`,
    days: 7,
    topic: 'news',
  },
  {
    label: 'Numérique responsable & accessibilité',
    query: `WCAG accessibility green software sustainability web performance ${CURRENT_YEAR}`,
    days: 7,
    topic: 'news',
  },
  // ── Topics FR supplémentaires (enrichissement, pas de remplacement) ───────
  {
    label: 'Sécurité — CERT-FR & ANSSI [FR]',
    query: 'bulletin alerte vulnérabilité sécurité informatique',
    days: 14,
    topic: 'general',
    includeDomains: ['cert.ssi.gouv.fr', 'ssi.gouv.fr', 'cyber.gouv.fr'],
  },
  {
    label: 'Réglementation & institutions numériques [FR]',
    query: 'numérique public RGPD données réglementation actualité',
    days: 14,
    topic: 'general',
    includeDomains: ['cnil.fr', 'numerique.gouv.fr', 'data.gouv.fr', 'legifrance.gouv.fr'],
  },
  {
    label: 'Communauté dev francophone [FR]',
    query: 'TypeScript JavaScript Node.js développement web actualité',
    days: 14,
    topic: 'general',
    includeDomains: ['developpez.com', 'humancoders.com', 'journalduhacker.net'],
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
      () => client.search(topic.query, {
        searchDepth: 'basic',
        topic: topic.topic,
        days: topic.days,
        maxResults: MAX_RESULTS_PER_TOPIC,
        ...(topic.includeDomains ? { includeDomains: topic.includeDomains } : {}),
      }),
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
