'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { spawn } = require('child_process');
const cron = require('node-cron');

// ── Génération de l'icône PNG (cercle orange sur fond transparent) ──────────
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td  = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function buildPngIcon(size = 32) {
  const cx = size / 2 - 0.5;
  const rows = Buffer.alloc(size * (1 + size * 4), 0);
  for (let y = 0; y < size; y++) {
    const base = y * (1 + size * 4);
    rows[base] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cx) ** 2);
      const p = base + 1 + x * 4;
      if (d <= size * 0.44) {           // cercle orange #f5a623
        rows[p] = 245; rows[p+1] = 166; rows[p+2] = 35; rows[p+3] = 255;
      } else if (d <= size * 0.48) {    // liseré sombre (anti-aliasing manuel)
        rows[p] = 30;  rows[p+1] = 30;  rows[p+2] = 46; rows[p+3] = 120;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const APP_ROOT = path.join(__dirname, '..');
const OUTPUT_LATEST     = path.join(APP_ROOT, 'output', 'latest.md');
const OUTPUT_TRANSLATED = path.join(APP_ROOT, 'output', 'latest-traduit.html');
const ICON_PATH = path.join(APP_ROOT, 'assets', 'icon.ico');

// Lecture minimale du .env pour les infos wiki (pas de dépendance dotenv)
function loadEnvValue(key) {
  const envPath = path.join(APP_ROOT, '.env');
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf-8').split('\n').find(l => l.startsWith(key + '='));
  return line ? line.slice(key.length + 1).trim().replace(/^["'\r]/g, '').replace(/["'\r]$/g, '') : '';
}

const GITHUB_OWNER = loadEnvValue('GITHUB_USERNAME');
const GITHUB_REPO  = loadEnvValue('GITHUB_REPO') || 'sandrine-veille-techno';
console.log('[Widget] GitHub owner:', GITHUB_OWNER, '| repo:', GITHUB_REPO);

let win = null;
let tray = null;
let pipelineRunning = false;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const icon = nativeImage.createFromBuffer(buildPngIcon(256));

  win = new BrowserWindow({
    width: 320,
    height: 460,
    x: width - 340,
    y: height - 480,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    backgroundColor: '#1e1e2e',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createTray() {
  tray = new Tray(nativeImage.createFromBuffer(buildPngIcon(32)));
  tray.setToolTip('Veille Techno');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Afficher / Masquer', click: () => toggleWindowVisibility() },
    { label: 'Lancer la veille',   click: () => runPipeline(new Date().getDay() === 5 ? 'weekly' : 'daily') },
    { type: 'separator' },
    {
      label: 'Lancer au démarrage',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindowVisibility());

}

function readLatestContent() {
  if (!fs.existsSync(OUTPUT_LATEST)) return null;
  return fs.readFileSync(OUTPUT_LATEST, 'utf-8');
}

function extractIncontournables(markdown) {
  const match = markdown.match(/##\s*🔥\s*Incontournables([\s\S]*?)(?=\n##\s|$)/);
  return match ? match[0].trim() : null;
}

function extractLabel(markdown) {
  // Supporte "<!-- label: 2026-06-16 -->" (daily) et "<!-- label: 2026-W25 -->" (weekly)
  const match = markdown.match(/<!-- label: ([\w-]+) -->/);
  return match ? match[1] : null;
}

function toggleWindowVisibility() {
  if (!win) return;
  if (win.isMinimized()) { win.restore(); win.focus(); return; }
  if (!win.isVisible()) { win.show(); win.focus(); return; }
  // Si collapsed, déployer plutôt que cacher
  const b = win.getBounds();
  if (b.height <= 50) {
    win.setBounds({ x: b.x, y: b.y - (460 - 46), width: 320, height: 460 });
    win.webContents.send('collapsed', false);
    return;
  }
  win.hide();
}

function pushContent() {
  if (!win) return;
  const markdown = readLatestContent();
  if (!markdown) {
    win.webContents.send('update-content', { incontournables: null, weekLabel: null, wikiUrl: null, hasTranslation: false });
    return;
  }
  const label = extractLabel(markdown);
  const wikiUrl = GITHUB_OWNER && GITHUB_REPO && label
    ? `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/wiki/${label}`
    : null;
  const hasTranslation = fs.existsSync(OUTPUT_TRANSLATED);
  console.log('[Widget] pushContent → label:', label, '| wikiUrl:', wikiUrl, '| hasTranslation:', hasTranslation);
  win.webContents.send('update-content', {
    incontournables: extractIncontournables(markdown),
    weekLabel: label,
    wikiUrl,
    hasTranslation,
  });
}

function runPipeline(mode = 'daily') {
  if (pipelineRunning) return;
  pipelineRunning = true;
  win?.webContents.send('pipeline-status', { running: true });

  const args = ['tsx', 'src/run-once.ts', `--mode=${mode}`];
  const child = spawn('npx', args, {
    cwd: APP_ROOT,
    shell: true,
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    pipelineRunning = false;
    const success = code === 0;
    win?.webContents.send('pipeline-status', { running: false, success });
    if (success) pushContent();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  win.webContents.once('did-finish-load', () => pushContent());

  const cronDaily = loadEnvValue('CRON_DAILY');
  if (cronDaily && cron.validate(cronDaily)) {
    cron.schedule(cronDaily, () => runPipeline('daily'));
    console.log('[Widget] Cron daily actif —', cronDaily);
  }

  const cronWeekly = loadEnvValue('CRON_WEEKLY');
  if (cronWeekly && cron.validate(cronWeekly)) {
    cron.schedule(cronWeekly, () => runPipeline('weekly'));
    console.log('[Widget] Cron weekly actif —', cronWeekly);
  }
});

ipcMain.on('get-latest', () => pushContent());
ipcMain.on('run-pipeline', () => runPipeline(new Date().getDay() === 5 ? 'weekly' : 'daily'));
ipcMain.on('close-window', () => win?.hide());
ipcMain.on('open-url', (_, url) => shell.openExternal(url));
ipcMain.on('open-translated', () => {
  if (fs.existsSync(OUTPUT_TRANSLATED)) shell.openPath(OUTPUT_TRANSLATED);
});
ipcMain.on('set-tray-icon', (_, dataUrl) => {
  const icon = nativeImage.createFromDataURL(dataUrl);
  tray?.setImage(icon);
  win?.setIcon(icon);
});
ipcMain.on('toggle-collapse', () => {
  if (!win) return;
  const b = win.getBounds();
  const EXPANDED = 460;
  const COLLAPSED = 46;
  const expanding = b.height <= 50;
  win.setBounds({
    x: b.x,
    y: expanding ? b.y - (EXPANDED - COLLAPSED) : b.y + (EXPANDED - COLLAPSED),
    width: 320,
    height: expanding ? EXPANDED : COLLAPSED,
  });
  win.webContents.send('collapsed', !expanding);
});

// Garder l'app active même si la fenêtre est fermée (systray)
app.on('window-all-closed', (e) => e.preventDefault());
