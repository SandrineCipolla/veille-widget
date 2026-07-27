import { describe, it, expect } from 'vitest';
import { resolveSourceRefs } from '../tavily-client.js';

describe('resolveSourceRefs', () => {
  it('remplace [réf:N] par un vrai lien Markdown', () => {
    const sources = new Map([['1', 'https://example.com/article-1']]);
    const result = resolveSourceRefs('Contenu.\n→ [réf:1]', sources);
    expect(result).toBe('Contenu.\n→ [Source](https://example.com/article-1)');
  });

  it('remplace plusieurs références indépendamment', () => {
    const sources = new Map([
      ['1', 'https://example.com/un'],
      ['2', 'https://example.com/deux'],
    ]);
    const result = resolveSourceRefs('→ [réf:1]\n\n→ [réf:2]', sources);
    expect(result).toContain('[Source](https://example.com/un)');
    expect(result).toContain('[Source](https://example.com/deux)');
  });

  it('retombe sur "lien à vérifier" si la référence est inconnue (hallucination du modèle)', () => {
    const sources = new Map([['1', 'https://example.com/un']]);
    const result = resolveSourceRefs('→ [réf:99]', sources);
    expect(result).toBe('→ [lien à vérifier]');
  });

  it('retombe sur "lien à vérifier" pour [réf:0] (aucun résultat correspondant)', () => {
    const sources = new Map([['1', 'https://example.com/un']]);
    const result = resolveSourceRefs('→ [réf:0]', sources);
    expect(result).toBe('→ [lien à vérifier]');
  });

  it("laisse le texte sans marqueur intact", () => {
    const sources = new Map<string, string>();
    const result = resolveSourceRefs('Rien de notable aujourd\'hui.', sources);
    expect(result).toBe('Rien de notable aujourd\'hui.');
  });
});
