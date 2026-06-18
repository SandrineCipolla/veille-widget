import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY manquante'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY manquante'),
  OPENROUTER_MODEL: z.string().default('mistralai/mistral-7b-instruct:free'),
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN manquant'),
  GITHUB_USERNAME: z.string().min(1, 'GITHUB_USERNAME manquant'),
  GITHUB_REPO: z.string().default('sandrine-veille-techno'),
  // Google Drive — optionnel, upload désactivé si absent
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  // Discord — optionnel, envoi désactivé si absent
  DISCORD_WEBHOOK_URL: z.preprocess(v => v || undefined, z.string().url().optional()),
  // Cron — optionnel, déclenchement automatique désactivé si absent
  // CRON_DAILY : lundi→jeudi (ex: "0 8 * * 1-4")
  // CRON_WEEKLY : vendredi récap (ex: "0 8 * * 5")
  CRON_DAILY: z.string().optional(),
  CRON_WEEKLY: z.string().optional(),
});

const result = ConfigSchema.safeParse(process.env);

if (!result.success) {
  const messages = result.error.issues.map((i) => `  - ${i.message}`).join('\n');
  throw new Error(`Configuration invalide — vérifiez votre .env :\n${messages}`);
}

const { data } = result;

const googleConfig =
  data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET && data.GOOGLE_REFRESH_TOKEN
    ? {
        clientId: data.GOOGLE_CLIENT_ID,
        clientSecret: data.GOOGLE_CLIENT_SECRET,
        refreshToken: data.GOOGLE_REFRESH_TOKEN,
        folderId: data.GOOGLE_DRIVE_FOLDER_ID,
      }
    : null;

export const config = {
  tavilyApiKey: data.TAVILY_API_KEY,
  openrouterApiKey: data.OPENROUTER_API_KEY,
  openrouterModel: data.OPENROUTER_MODEL,
  githubToken: data.GITHUB_TOKEN,
  githubUsername: data.GITHUB_USERNAME,
  githubRepo: data.GITHUB_REPO,
  google: googleConfig,
  discordWebhookUrl: data.DISCORD_WEBHOOK_URL,
  cronDaily: data.CRON_DAILY,
  cronWeekly: data.CRON_WEEKLY,
} as const;
