# Setup n8n — Workflow RSS Digest

## Installation et lancement

```bash
npm install -g n8n
n8n start
```

Interface disponible sur **http://localhost:5678**

---

## Credentials à configurer dans n8n

### OpenRouter (HTTP Header Auth)

Dans **Settings → Credentials → New → Header Auth** :

| Champ | Valeur |
|-------|--------|
| Name | `Authorization` |
| Value | `Bearer <OPENROUTER_API_KEY>` |

### Email (SMTP)

Dans **Settings → Credentials → New → SMTP** :

| Champ | Valeur |
|-------|--------|
| Host | `smtp.gmail.com` |
| Port | `465` |
| SSL | Activé |
| User | ton adresse Gmail |
| Password | mot de passe applicatif Google |

> Le mot de passe applicatif se génère dans **Compte Google → Sécurité → Mots de passe des applications** (authentification à deux facteurs requise). Ne pas utiliser le mot de passe du compte.

---

## Nœuds du workflow — dans l'ordre

### 1. Schedule Trigger

- Type : **Schedule Trigger**
- Règle : `Cron` — `0 8 * * 1` (lundi 8h)
- Activer "Manual trigger" pour les tests

### 2. RSS Feed Read

- Type : **RSS Feed Read**
- URL : `https://prompt-inspiration.com/rss.xml`

### 3. Code — Formater les articles

- Type : **Code**
- Mode : `Run Once for All Items`
- Coller le code suivant :

```js
const items = $input.all();
const articles = items.map((item, i) => {
  const { title, link, contentSnippet } = item.json;
  return `${i + 1}. Titre: ${title}\n   URL: ${link}\n   Résumé: ${contentSnippet ?? ''}`;
}).join('\n\n');

return [{ json: { articles } }];
```

### 4. HTTP Request — OpenRouter

- Type : **HTTP Request**
- Method : `POST`
- URL : `https://openrouter.ai/api/v1/chat/completions`
- Authentication : credential OpenRouter créé ci-dessus
- Headers : `Content-Type: application/json`
- Body (JSON) :

```json
{
  "model": "google/gemma-3-4b-it:free",
  "messages": [
    {
      "role": "system",
      "content": "Tu es un assistant pour un développeur fullstack TypeScript/Node.js.\nSélectionne les 3 articles les plus pertinents parmi la liste fournie.\nRéponds UNIQUEMENT en JSON valide, sans markdown, sans texte autour :\n[{\"title\": \"...\", \"url\": \"...\", \"reason\": \"...\"}]"
    },
    {
      "role": "user",
      "content": "=Voici les articles RSS disponibles :\n\n{{ $json.articles }}"
    }
  ]
}
```

> Le prompt complet est dans `prompts/rss-digest-selection.txt`.

### 5. Code — Parser la réponse et construire le HTML

- Type : **Code**
- Mode : `Run Once for All Items`
- Coller le code suivant :

```js
const raw = $input.first().json.choices[0].message.content;
const selected = JSON.parse(raw);

const today = new Date();
const weekLabel = today.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const cards = selected.map(article => `
  <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:16px 20px;margin-bottom:16px;border-radius:4px;">
    <a href="${article.url}" style="color:#2563eb;font-size:16px;font-weight:600;text-decoration:none;">${article.title}</a>
    <p style="color:#64748b;font-style:italic;margin:8px 0 0;">${article.reason}</p>
  </div>
`).join('');

const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Digest RSS — semaine du ${weekLabel}</h1>
        </td></tr>
        <tr><td style="padding:32px;">${cards}</td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;color:#94a3b8;font-size:12px;">
          Généré automatiquement par veille-widget
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

return [{ json: { html, weekLabel } }];
```

### 6. Send Email

- Type : **Send Email**
- Authentication : credential SMTP créé ci-dessus
- To : ton adresse email
- Subject : `Digest RSS — semaine du {{ $json.weekLabel }}`
- Email Type : `HTML`
- HTML Body : `{{ $json.html }}`
