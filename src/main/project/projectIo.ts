import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadSettings, saveSettings } from '../settings';

const MAX_RECENT = 8;
const FILTERS = [{ name: 'Livery projects', extensions: ['lmulivery'] }];

const autosaveFile = () => join(app.getPath('userData'), 'autosave.lmulivery');
export const defaultProjectDir = (): string => join(app.getPath('documents'), 'LMU Livery Builder');

function addRecent(path: string): void {
  const dir = app.getPath('userData');
  const s = loadSettings(dir);
  saveSettings(dir, { ...s, recentProjects: [path, ...s.recentProjects.filter((p) => p !== path)].slice(0, MAX_RECENT) });
}

function removeRecent(path: string): void {
  const dir = app.getPath('userData');
  const s = loadSettings(dir);
  saveSettings(dir, { ...s, recentProjects: s.recentProjects.filter((p) => p !== path) });
}

function writeAtomic(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, path);
}

const safeName = (name: string) => name.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Livery';

export function registerProjectIpc(): void {
  ipcMain.handle('project:save', async (e, bytes: Uint8Array, path: string | null, suggestedName: string) => {
    let target = path;
    if (!target) {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
      mkdirSync(defaultProjectDir(), { recursive: true });
      const res = await dialog.showSaveDialog(win!, {
        title: 'Save livery project',
        defaultPath: join(defaultProjectDir(), `${safeName(suggestedName)}.lmulivery`),
        filters: FILTERS,
      });
      if (res.canceled || !res.filePath) return null;
      target = res.filePath.endsWith('.lmulivery') ? res.filePath : `${res.filePath}.lmulivery`;
    }
    writeAtomic(target, bytes);
    addRecent(target);
    return target;
  });

  ipcMain.handle('project:open', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win!, { title: 'Open livery project', defaultPath: defaultProjectDir(), properties: ['openFile'], filters: FILTERS });
    if (res.canceled || !res.filePaths[0]) return null;
    const path = res.filePaths[0];
    addRecent(path);
    return { path, bytes: new Uint8Array(readFileSync(path)) };
  });

  ipcMain.handle('project:openRecent', (_e, path: string) => {
    if (!existsSync(path)) {
      removeRecent(path);
      return null;
    }
    addRecent(path);
    return { path, bytes: new Uint8Array(readFileSync(path)) };
  });

  ipcMain.handle('project:recent', () => loadSettings(app.getPath('userData')).recentProjects.filter((p) => existsSync(p)));

  ipcMain.handle('autosave:write', (_e, bytes: Uint8Array) => writeAtomic(autosaveFile(), bytes));
  ipcMain.handle('autosave:read', () => (existsSync(autosaveFile()) ? new Uint8Array(readFileSync(autosaveFile())) : null));
  ipcMain.handle('autosave:clear', () => rmSync(autosaveFile(), { force: true }));
}
