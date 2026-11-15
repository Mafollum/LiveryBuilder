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
};

contextBridge.exposeInMainWorld('lmu', api);
