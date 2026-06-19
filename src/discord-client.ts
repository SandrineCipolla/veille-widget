const DISCORD_MAX_LENGTH = 1900;

/**
 * Extrait la section "🔥 Incontournables" d'un digest Markdown.
 * Retourne null si la section est absente.
 */
export function extractIncontournables(markdown: string): string | null {
  const match = markdown.match(/##\s*🔥\s*(?:Incontournables|À retenir aujourd'hui)([\s\S]*?)(?=\n##\s|$)/);
  if (!match) return null;
  return match[0].trim();
}

/**
 * Formate le message Discord : incontournables + lien wiki.
 * Tronque proprement à 1900 caractères si nécessaire (marge sécurité 2000).
 */
export function formatDiscordMessage(
  incontournables: string,
  weekLabel: string,
  wikiOwner: string,
  wikiRepo: string,
): string {
  const wikiUrl = `https://github.com/${wikiOwner}/${wikiRepo}/wiki`;
  const footer = `\n\n📖 [Lire le digest complet](${wikiUrl})`;
  const isWeekly = /^\d{4}-W/.test(weekLabel);
  const title = isWeekly ? `📋 Récap de la semaine — ${weekLabel}` : `🗓️ Veille techno — ${weekLabel}`;
  const header = `**${title}**\n\n`;
  const body = header + incontournables + footer;

  if (body.length <= DISCORD_MAX_LENGTH) return body;

  const truncated = body.slice(0, DISCORD_MAX_LENGTH - footer.length - 4) + '…';
  return truncated + footer;
}

/**
 * Poste le message sur le webhook Discord via fetch natif Node.js 22.
 * Throw une Error en français si le webhook répond != 204.
 */
export async function postToDiscord(webhookUrl: string, message: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });

  if (response.status !== 204) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Discord a répondu ${response.status} : ${detail}`);
  }
}
