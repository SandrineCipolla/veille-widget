'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veille', {
  getLatest:   () => ipcRenderer.send('get-latest'),
  runPipeline: () => ipcRenderer.send('run-pipeline'),
  closeWindow: () => ipcRenderer.send('close-window'),
  onContent:   (cb) => ipcRenderer.on('update-content',   (_, data) => cb(data)),
  onStatus:    (cb) => ipcRenderer.on('pipeline-status',  (_, data) => cb(data)),
});
