import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env['OPENROUTER_API_KEY'];
if (!apiKey) throw new Error('OPENROUTER_API_KEY manquante dans .env');

const resp = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { Authorization: `Bearer ${apiKey}` },
});

const data = (await resp.json()) as {
  data: Array<{ id: string; name: string; pricing: { prompt: string } }>;
};

const free = data.data
  .filter((m) => m.pricing?.prompt === '0')
  .map((m) => ({ id: m.id, name: m.name }))
  .sort((a, b) => a.id.localeCompare(b.id));

console.log(`\n${free.length} modèles gratuits disponibles :\n`);
for (const m of free) {
  console.log(`  ${m.id.padEnd(55)} ${m.name}`);
}