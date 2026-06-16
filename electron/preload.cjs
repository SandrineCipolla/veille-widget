'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veille', {
  getLatest:       () => ipcRenderer.send('get-latest'),
  runPipeline:     () => ipcRenderer.send('run-pipeline'),
  closeWindow:     () => ipcRenderer.send('close-window'),
  toggleCollapse:  () => ipcRenderer.send('toggle-collapse'),
  openUrl:         (url) => ipcRenderer.send('open-url', url),
  openTranslated:  () => ipcRenderer.send('open-translated'),
  setTrayIcon:     (dataUrl) => ipcRenderer.send('set-tray-icon', dataUrl),
  onContent:       (cb) => ipcRenderer.on('update-content',  (_, data) => cb(data)),
  onStatus:        (cb) => ipcRenderer.on('pipeline-status', (_, data) => cb(data)),
  onCollapsed:     (cb) => ipcRenderer.on('collapsed',       (_, v)    => cb(v)),
});
