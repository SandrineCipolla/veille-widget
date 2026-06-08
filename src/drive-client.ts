import { google } from 'googleapis';
import { Readable } from 'stream';
import { z } from 'zod';

const MIME_MARKDOWN = 'text/markdown';
const DriveFileSchema = z.object({ id: z.string() });

/** Config Google OAuth2 requise pour l'upload Drive */
export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId?: string;
}

/**
 * Uploade ou met à jour le fichier Markdown dans Google Drive.
 * Retourne l'URL de visualisation du fichier.
 */
export async function uploadToDrive(
  config: DriveConfig,
  filename: string,
  content: string,
): Promise<string> {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
  auth.setCredentials({ refresh_token: config.refreshToken });
  const drive = google.drive({ version: 'v3', auth });

  const existingId = await findExistingFile(drive, filename, config.folderId);

  if (existingId) {
    await drive.files.update({
      fileId: existingId,
      media: { mimeType: MIME_MARKDOWN, body: Readable.from([content]) },
    });
    return driveUrl(existingId);
  }

  const metadata: { name: string; parents?: string[] } = { name: filename };
  if (config.folderId) metadata.parents = [config.folderId];

  const { data } = await drive.files.create({
    requestBody: metadata,
    media: { mimeType: MIME_MARKDOWN, body: Readable.from([content]) },
    fields: 'id',
  });

  const { id } = DriveFileSchema.parse(data);
  return driveUrl(id);
}

async function findExistingFile(
  drive: ReturnType<typeof google.drive>,
  filename: string,
  folderId?: string,
): Promise<string | undefined> {
  const q = [
    `name='${filename}'`,
    'trashed=false',
    ...(folderId ? [`'${folderId}' in parents`] : []),
  ].join(' and ');

  const { data } = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
  return data.files?.[0]?.id ?? undefined;
}

function driveUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}