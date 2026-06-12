'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const APP_ROOT = path.join(__dirname, '..');
const OUTPUT_LATEST = path.join(APP_ROOT, 'output', 'latest.md');
const ICON_PATH = path.join(APP_ROOT, 'assets', 'icon.ico');

let win = null;
let tray = null;
let pipelineRunning = false;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 320,
    height: 460,
    x: width - 340,
    y: height - 480,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#1e1e2e',
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
  const icon = fs.existsSync(ICON_PATH)
    ? nativeImage.createFromPath(ICON_PATH)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Veille Techno');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Afficher / Masquer', click: () => { win?.isVisible() ? win.hide() : win?.show(); } },
    { label: 'Lancer la veille', click: () => runPipeline() },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => { win?.isVisible() ? win.hide() : win?.show(); });
}

function readLatestContent() {
  if (!fs.existsSync(OUTPUT_LATEST)) return null;
  return fs.readFileSync(OUTPUT_LATEST, 'utf-8');
}

function extractIncontournables(markdown) {
  const match = markdown.match(/##\s*🔥\s*Incontournables([\s\S]*?)(?=\n##\s|$)/);
  return match ? match[0].trim() : null;
}

function extractWeekLabel(markdown) {
  const match = markdown.match(/(\d{4}-W\d{2})/);
  return match ? match[1] : null;
}

function pushContent() {
  if (!win) return;
  const markdown = readLatestContent();
  if (!markdown) {
    win.webContents.send('update-content', { incontournables: null, weekLabel: null });
    return;
  }
  win.webContents.send('update-content', {
    incontournables: extractIncontournables(markdown),
    weekLabel: extractWeekLabel(markdown),
  });
}

function runPipeline() {
  if (pipelineRunning) return;
  pipelineRunning = true;
  win?.webContents.send('pipeline-status', { running: true });

  const child = spawn('npx', ['tsx', 'src/run-once.ts'], {
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
});

ipcMain.on('get-latest', () => pushContent());
ipcMain.on('run-pipeline', () => runPipeline());
ipcMain.on('close-window', () => win?.hide());

// Garder l'app active même si la fenêtre est fermée (systray)
app.on('window-all-closed', (e) => e.preventDefault());
