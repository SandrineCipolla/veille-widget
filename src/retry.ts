const MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;

/**
 * Exécute `fn` jusqu'à MAX_RETRIES fois avec backoff exponentiel.
 * Ne retente que si `isRetryable` retourne true pour l'erreur courante.
 * `baseDelayMs` permet d'adapter le délai selon la tolérance de l'API cible.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[retry] Tentative ${attempt}/${MAX_RETRIES} échouée — retry dans ${Math.round(delay / 1000)} s…`);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastErr;
}
