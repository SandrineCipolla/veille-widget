import { describe, it, expect } from 'vitest';
import { extractIncontournables, formatDiscordMessage } from '../discord-client.js';

const DIGEST_WITH_SECTION = `# Veille techno 2026-W24

## 🔥 Incontournables

- **React 19 RC** — hooks améliorés
- **Node.js 22 LTS** — performance V8

## 📦 Stack TS/React/Node.js

Contenu de la section stack.`;

const DIGEST_WITHOUT_SECTION = `# Veille techno 2026-W24

## 📦 Stack TS/React/Node.js

Contenu sans incontournables.`;

describe('extractIncontournables', () => {
  it('extrait la section quand elle est présente', () => {
    const result = extractIncontournables(DIGEST_WITH_SECTION);
    expect(result).not.toBeNull();
    expect(result).toContain('🔥 Incontournables');
    expect(result).toContain('React 19 RC');
    expect(result).toContain('Node.js 22 LTS');
  });

  it('retourne null si la section est absente', () => {
    expect(extractIncontournables(DIGEST_WITHOUT_SECTION)).toBeNull();
  });

  it('retourne null sur une chaîne vide', () => {
    expect(extractIncontournables('')).toBeNull();
  });

  it('ne capture pas le contenu de la section suivante', () => {
    const result = extractIncontournables(DIGEST_WITH_SECTION);
    expect(result).not.toContain('Stack TS/React/Node.js');
  });
});

describe('formatDiscordMessage', () => {
  const incontournables = '## 🔥 Incontournables\n\n- React 19 RC\n- Node.js 22';
  const weekLabel = '2026-W24';
  const owner = 'SandrineCipolla';
  const repo = 'sandrine-veille-techno';

  it('contient le label de semaine', () => {
    const msg = formatDiscordMessage(incontournables, weekLabel, owner, repo);
    expect(msg).toContain('2026-W24');
  });

  it('contient le lien wiki', () => {
    const msg = formatDiscordMessage(incontournables, weekLabel, owner, repo);
    expect(msg).toContain(`https://github.com/${owner}/${repo}/wiki`);
  });

  it('contient les incontournables', () => {
    const msg = formatDiscordMessage(incontournables, weekLabel, owner, repo);
    expect(msg).toContain('React 19 RC');
  });

  it('tronque à 1900 caractères max', () => {
    const longContent = '## 🔥 Incontournables\n\n' + 'x'.repeat(2000);
    const msg = formatDiscordMessage(longContent, weekLabel, owner, repo);
    expect(msg.length).toBeLessThanOrEqual(1900);
  });

  it('conserve le footer après troncature', () => {
    const longContent = '## 🔥 Incontournables\n\n' + 'x'.repeat(2000);
    const msg = formatDiscordMessage(longContent, weekLabel, owner, repo);
    expect(msg).toContain('Lire le digest complet');
  });
});
