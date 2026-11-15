import { contextBridge, ipcRenderer } from 'electron';

const api = {
  ready: (): void => ipcRenderer.send('app:ready'),
};

contextBridge.exposeInMainWorld('lmu', api);
