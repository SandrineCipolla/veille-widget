import fs from 'fs';
import os from 'os';
import path from 'path';
import simpleGit from 'simple-git';
import type { WeekLabel, WikiPushResult } from './types.js';

/**
 * Clone le wiki GitHub, ajoute le fichier Markdown, commit et push.
 * Utilise simple-git car le Git Data API GitHub ne supporte pas les repos wiki.
 */
export async function pushToWiki(
  token: string,
  owner: string,
  repo: string,
  label: WeekLabel,
  content: string,
): Promise<WikiPushResult> {
  const filename = `${label}.md`;
  const wikiUrl = `https://${token}@github.com/${owner}/${repo}.wiki.git`;
  const tmpDir = path.join(os.tmpdir(), `veille-wiki-${Date.now()}`);

  try {
    console.log('[wiki] Clone du wiki…');
    await simpleGit().clone(wikiUrl, tmpDir);

    fs.writeFileSync(path.join(tmpDir, filename), content, 'utf-8');

    const git = simpleGit(tmpDir);
    await git.addConfig('user.email', 'veille-widget@noreply');
    await git.addConfig('user.name', 'Veille Widget');
    await git.add(filename);
    await git.commit(`feat: veille techno ${label}`);
    await git.push('origin', 'HEAD');

    const log = await git.log({ maxCount: 1 });
    return { commitSha: log.latest?.hash ?? 'unknown', filename };
  } catch (err) {
    throw wrapGitError(err);
  } finally {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function wrapGitError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Authentication failed') || msg.includes('401')) {
    return new Error('GitHub : token invalide ou sans permission wiki (401)');
  }
  if (msg.includes('Repository not found') || msg.includes('404')) {
    return new Error('GitHub : wiki introuvable — activez le wiki et créez une première page sur GitHub (404)');
  }
  return new Error(`GitHub wiki erreur : ${msg}`);
}
