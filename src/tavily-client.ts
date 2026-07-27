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
  /** Si true, le daysOverride du mode daily ne s'applique pas (topics FR peu fréquents) */
  keepDays?: boolean;
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
    keepDays: true,
  },
  {
    label: 'Réglementation & institutions numériques [FR]',
    query: 'numérique public RGPD données réglementation actualité',
    days: 14,
    topic: 'general',
    includeDomains: ['cnil.fr', 'numerique.gouv.fr', 'data.gouv.fr', 'legifrance.gouv.fr'],
    keepDays: true,
  },
  {
    label: 'Communauté dev francophone [FR]',
    query: 'TypeScript JavaScript Node.js développement web actualité',
    days: 14,
    topic: 'general',
    includeDomains: ['developpez.com', 'humancoders.com', 'journalduhacker.net'],
    keepDays: true,
  },
  {
    label: 'IA & outils de dev [FR]',
    query: 'intelligence artificielle outils développeur actualité',
    days: 14,
    topic: 'general',
    includeDomains: ['prompt-inspiration.com'],
    keepDays: true,
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
 * @param daysOverride - Remplace le `days` de chaque topic (mode daily : 2 jours)
 */
export interface TavilySearchOutput {
  /** Texte formaté à passer au LLM, chaque résultat portant une référence [réf:N] */
  text: string;
  /** Référence numérique (telle qu'utilisée dans `text`) → URL réelle Tavily */
  sources: Map<string, string>;
}

export async function searchVeilleTopics(apiKey: string, daysOverride?: number): Promise<TavilySearchOutput> {
  const client = tavily({ apiKey });

  const searches = SEARCH_TOPICS.map((topic) =>
    withRetry(
      () => client.search(topic.query, {
        searchDepth: 'basic',
        topic: topic.topic,
        days: (daysOverride && !topic.keepDays) ? daysOverride : topic.days,
        maxResults: MAX_RESULTS_PER_TOPIC,
        ...(topic.includeDomains ? { includeDomains: topic.includeDomains } : {}),
      }),
      isRetryable,
    ).then((res) => ({ label: topic.label, results: res.results })),
  );

  const settled = await Promise.allSettled(searches);
  const sections: string[] = [];
  const sources = new Map<string, string>();
  let refCounter = 0;

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
      .map((r) => {
        refCounter += 1;
        const ref = String(refCounter);
        sources.set(ref, r.url);
        return `[réf:${ref}] **${r.title}** (${r.publishedDate ?? 'date inconnue'})\n   ${r.content.slice(0, 300)}`;
      })
      .join('\n\n');

    sections.push(`## ${label}\n${items || '_(aucun résultat)_'}`);
  }

  return { text: sections.join('\n\n'), sources };
}

/**
 * Remplace chaque marqueur [réf:N] laissé par le modèle par le vrai lien
 * Markdown vers l'URL Tavily correspondante — évite de demander au modèle
 * de recopier une URL entière (peu fiable, surtout sur les modèles gratuits ;
 * dégénère souvent en "[lien à vérifier]" par excès de prudence). Un numéro
 * de référence absent de `sources` (hallucination du modèle) retombe sur le
 * même repli texte.
 */
export function resolveSourceRefs(markdown: string, sources: Map<string, string>): string {
  return markdown.replace(/\[réf:\s*(\d+)\]/g, (match, ref: string) => {
    const url = sources.get(ref);
    return url ? `[Source](${url})` : '[lien à vérifier]';
  });
}
