'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('host', Object.freeze({
  list: (force) => ipcRenderer.invoke('apps:list', !!force),
  install: (id) => ipcRenderer.invoke('apps:install', id),
  uninstall: (id) => ipcRenderer.invoke('apps:uninstall', id),
  open: (id) => ipcRenderer.invoke('apps:open', id),
  repo: (id) => ipcRenderer.invoke('apps:repo', id),
  info: () => ipcRenderer.invoke('app:info'),
  onProgress: (fn) => { ipcRenderer.removeAllListeners('progress'); ipcRenderer.on('progress', (_e, v) => fn(v)); },
}));
