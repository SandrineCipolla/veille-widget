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
});

const result = ConfigSchema.safeParse(process.env);

if (!result.success) {
  const messages = result.error.issues.map((i) => `  - ${i.message}`).join('\n');
  throw new Error(`Configuration invalide — vérifiez votre .env :\n${messages}`);
}

export const config = {
  tavilyApiKey: result.data.TAVILY_API_KEY,
  openrouterApiKey: result.data.OPENROUTER_API_KEY,
  openrouterModel: result.data.OPENROUTER_MODEL,
  githubToken: result.data.GITHUB_TOKEN,
  githubUsername: result.data.GITHUB_USERNAME,
  githubRepo: result.data.GITHUB_REPO,
} as const;
