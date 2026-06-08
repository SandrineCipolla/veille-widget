/**
 * Authentification Google Drive — à lancer une seule fois.
 * Ouvre le navigateur, attend le callback OAuth2, affiche le refresh token.
 *
 * Usage : npx tsx scripts/auth-google.ts
 */
import http from 'http';
import { exec } from 'child_process';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const clientId = process.env['GOOGLE_CLIENT_ID'];
const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];

if (!clientId || !clientSecret) {
  console.error('❌ GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être dans le .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

console.log('\n=== Authentification Google Drive (une seule fois) ===\n');
console.log('Ouverture du navigateur...');
exec(`start "" "${authUrl}"`);
console.log('\nSi le navigateur ne s\'ouvre pas, copiez cette URL :\n');
console.log(authUrl + '\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost:3000');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('Erreur : code OAuth manquant.');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>✓ Authentification réussie !</h1><p>Vous pouvez fermer cette fenêtre.</p>');
  server.close();

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error('\n❌ Pas de refresh token reçu.');
    console.error('   → Révoquez l\'accès dans Google Account puis relancez ce script.');
    process.exit(1);
  }

  console.log('✓ Authentification réussie !\n');
  console.log('Ajoutez ces lignes dans votre .env :\n');
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('\nOptionnel — ID du dossier Drive cible (copié depuis l\'URL du dossier) :');
  console.log('GOOGLE_DRIVE_FOLDER_ID=<votre-folder-id>');
  process.exit(0);
});

server.listen(3000, () => {
  console.log('En attente du callback sur http://localhost:3000...\n');
});
