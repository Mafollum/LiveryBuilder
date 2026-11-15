import { contextBridge, ipcRenderer } from 'electron';
import type { LmuApi } from '../shared/types';

const api: LmuApi = {
  ready: () => ipcRenderer.send('app:ready'),
  isTest: process.env.LIVERY_TEST === '1',
  getLmuFolder: () => ipcRenderer.invoke('lmu:getFolder'),
  chooseLmuFolder: () => ipcRenderer.invoke('lmu:chooseFolder'),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  openTemplate: (fileName) => ipcRenderer.invoke('templates:open', fileName),
  openTemplateFile: (absPath) => ipcRenderer.invoke('templates:openFile', absPath),
  chooseTemplateFile: () => ipcRenderer.invoke('templates:chooseFile'),
  liveryStatus: () => ipcRenderer.invoke('livery:status'),
  writeLivery: (paint, region, backup) => ipcRenderer.invoke('livery:write', paint, region, backup),
  saveLiveryElsewhere: (paint, region) => ipcRenderer.invoke('livery:saveElsewhere', paint, region),
  saveProject: (bytes, path, suggestedName) => ipcRenderer.invoke('project:save', bytes, path, suggestedName),
  openProject: () => ipcRenderer.invoke('project:open'),
  openRecentProject: (path) => ipcRenderer.invoke('project:openRecent', path),
  listRecentProjects: () => ipcRenderer.invoke('project:recent'),
  writeAutosave: (bytes) => ipcRenderer.invoke('autosave:write', bytes),
  readAutosave: () => ipcRenderer.invoke('autosave:read'),
  clearAutosave: () => ipcRenderer.invoke('autosave:clear'),
  onCloseRequested: (cb) => {
    ipcRenderer.removeAllListeners('app:close-requested');
    ipcRenderer.on('app:close-requested', () => cb());
  },
  closeNow: () => ipcRenderer.send('app:close-now'),
  autosaveMs: Number(process.env.LIVERY_AUTOSAVE_MS) || 60_000,
};

contextBridge.exposeInMainWorld('lmu', api);
