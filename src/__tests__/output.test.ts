import { describe, it, expect } from 'vitest';
import { getWeekLabel } from '../output.js';

describe('getWeekLabel', () => {
  it('retourne le format YYYY-Www', () => {
    const label = getWeekLabel(new Date('2026-06-11'));
    expect(label).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('calcule correctement la semaine 24 de 2026', () => {
    expect(getWeekLabel(new Date('2026-06-11'))).toBe('2026-W24');
  });

  it('calcule correctement la semaine 1 de 2026', () => {
    expect(getWeekLabel(new Date('2026-01-01'))).toBe('2026-W01');
  });

  it('gère le passage d\'année (semaine 53/1)', () => {
    // 31 décembre 2026 appartient à la semaine 53 de 2026
    expect(getWeekLabel(new Date('2026-12-31'))).toBe('2026-W53');
  });

  it('padde le numéro de semaine sur 2 chiffres', () => {
    const label = getWeekLabel(new Date('2026-01-05'));
    const weekPart = label.split('-W')[1];
    expect(weekPart).toHaveLength(2);
  });
});
