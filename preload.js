'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clientDbApi', {
  getClients: () => ipcRenderer.invoke('clients:getAll'),
  getDbPath: () => ipcRenderer.invoke('clients:getDbPath'),
  upsertClient: (client) => ipcRenderer.invoke('clients:upsertOne', client),
  upsertClients: (clients) => ipcRenderer.invoke('clients:upsertMany', clients),
  deleteClient: (id) => ipcRenderer.invoke('clients:delete', id),
  clearClients: () => ipcRenderer.invoke('clients:clear'),
  saveSqliteBackup: () => ipcRenderer.invoke('backup:saveSqlite'),
  restoreSqliteBackup: () => ipcRenderer.invoke('backup:restoreSqlite'),
});
