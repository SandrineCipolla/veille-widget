import { describe, it, expect } from 'vitest';
import { buildHomeContent, isoWeekFriday } from '../github-wiki.js';

describe('isoWeekFriday', () => {
  it('calcule le bon vendredi pour la semaine ISO 30 de 2026', () => {
    expect(isoWeekFriday(2026, 30).toISOString().slice(0, 10)).toBe('2026-07-24');
  });

  it('calcule le bon vendredi pour la semaine ISO 27 de 2026', () => {
    expect(isoWeekFriday(2026, 27).toISOString().slice(0, 10)).toBe('2026-07-03');
  });
});

describe('buildHomeContent', () => {
  it('classe un digest quotidien plus récent au-dessus d\'un récap hebdo plus ancien', () => {
    // Régression : comparer "2026-W30" et "2026-07-27" comme du texte classe
    // le "W" au-dessus de n'importe quel chiffre, donc le récap d'il y a 3
    // jours passait toujours devant un digest quotidien plus récent.
    const files = ['2026-W30.md', '2026-07-27.md', '2026-07-24.md', 'Home.md'];
    const content = buildHomeContent(files, '2026-07-27');

    const dailyIndex = content.indexOf('2026-07-27');
    const weeklyIndex = content.indexOf('2026-W30');

    expect(dailyIndex).toBeGreaterThan(-1);
    expect(weeklyIndex).toBeGreaterThan(-1);
    expect(dailyIndex).toBeLessThan(weeklyIndex);
  });

  it('classe le récap hebdo au-dessus des digests quotidiens antérieurs à sa semaine', () => {
    const files = ['2026-W30.md', '2026-07-23.md', '2026-07-20.md'];
    const content = buildHomeContent(files, '2026-W30');

    const weeklyIndex = content.indexOf('2026-W30');
    const dailyIndex = content.indexOf('2026-07-23');

    expect(weeklyIndex).toBeLessThan(dailyIndex);
  });
});
