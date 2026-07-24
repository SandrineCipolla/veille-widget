import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY manquante'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY manquante'),
  // Liste de modèles séparés par des virgules, essayés dans l'ordre si 404/429/502/503.
  // Toujours terminer par un modèle payant (ex: openai/gpt-4o-mini) — les modèles
  // gratuits OpenRouter changent/disparaissent régulièrement, un seul modèle fixe
  // finit toujours par recasser le pipeline.
  OPENROUTER_MODELS: z
    .string()
    .default('google/gemma-4-31b-it:free,openai/gpt-oss-20b:free,nvidia/nemotron-nano-9b-v2:free,openai/gpt-4o-mini'),
  // Conservé pour compat ascendante (anciens .env) — plus utilisé si OPENROUTER_MODELS est défini.
  OPENROUTER_MODEL: z.string().optional(),
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

// Si OPENROUTER_MODEL (ancien format, un seul modèle) est présent et OPENROUTER_MODELS
// n'a pas été explicitement fourni, on le met en tête de liste pour ne rien casser.
const legacyModelOnly = data.OPENROUTER_MODEL && !process.env['OPENROUTER_MODELS'];
const modelList = (legacyModelOnly ? data.OPENROUTER_MODEL! : data.OPENROUTER_MODELS)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

export const config = {
  tavilyApiKey: data.TAVILY_API_KEY,
  openrouterApiKey: data.OPENROUTER_API_KEY,
  openrouterModels: modelList,
  githubToken: data.GITHUB_TOKEN,
  githubUsername: data.GITHUB_USERNAME,
  githubRepo: data.GITHUB_REPO,
  google: googleConfig,
  discordWebhookUrl: data.DISCORD_WEBHOOK_URL,
} as const;
