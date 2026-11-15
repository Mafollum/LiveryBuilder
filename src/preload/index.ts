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
};

contextBridge.exposeInMainWorld('lmu', api);
