import { app, dialog, ipcMain, BrowserWindow } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findLmuFolder } from './lmu/findLmu';
import { loadSettings, saveSettings } from './settings';
import { listTemplates, templatesDir } from './templates/listTemplates';
import { openTemplateAt } from './templates/openTemplate';
import { describeWriteError, liveryStatus, writeLiveryFiles } from './livery/writeLivery';
import type { ChooseFolderResult } from '../shared/types';

const NOT_LMU = "That folder doesn't look like Le Mans Ultimate (there's no Support\\LiveryTemplates inside).";

let lmuOverride: string | null = process.env.LIVERY_LMU_DIR || null;

export function currentLmuFolder(): string | null {
  if (lmuOverride) return lmuOverride;
  const settings = loadSettings(app.getPath('userData'));
  if (settings.lmuFolder && existsSync(settings.lmuFolder)) return settings.lmuFolder;
  const found = findLmuFolder({
    exists: (p) => existsSync(p),
    readText: (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null),
  });
  if (found) saveSettings(app.getPath('userData'), { ...settings, lmuFolder: found });
  return found;
}

export function registerIpc(): void {
  ipcMain.handle('lmu:getFolder', () => currentLmuFolder());

  ipcMain.handle('lmu:chooseFolder', async (e): Promise<ChooseFolderResult> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win!, { title: 'Choose your Le Mans Ultimate folder', properties: ['openDirectory'] });
    if (res.canceled || !res.filePaths[0]) return null;
    const folder = res.filePaths[0];
    if (!existsSync(templatesDir(folder))) return { error: NOT_LMU };
    const settings = loadSettings(app.getPath('userData'));
    saveSettings(app.getPath('userData'), { ...settings, lmuFolder: folder });
    lmuOverride = null;
    return { folder };
  });

  ipcMain.handle('templates:list', () => {
    const lmu = currentLmuFolder();
    return lmu ? listTemplates(lmu) : [];
  });

  ipcMain.handle('templates:open', (_e, fileName: string) => {
    const lmu = currentLmuFolder();
    if (!lmu) throw new Error('Le Mans Ultimate folder not set');
    return openTemplateAt(join(templatesDir(lmu), fileName), app.getPath('userData'));
  });

  ipcMain.handle('livery:status', () => {
    const lmu = currentLmuFolder();
    if (!lmu) throw new Error('Le Mans Ultimate folder not set');
    return liveryStatus(lmu);
  });

  ipcMain.handle('livery:write', (_e, paint: Uint8Array, region: Uint8Array, backup: boolean) => {
    const lmu = currentLmuFolder();
    if (!lmu) return { ok: false, message: "Couldn't find the Le Mans Ultimate folder." };
    try {
      writeLiveryFiles(liveryStatus(lmu).folder, paint, region, { backup });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: describeWriteError(err as NodeJS.ErrnoException) };
    }
  });

  ipcMain.handle('livery:saveElsewhere', async (e, paint: Uint8Array, region: Uint8Array) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win!, { title: 'Choose a folder for the two livery files', properties: ['openDirectory', 'createDirectory'] });
    if (res.canceled || !res.filePaths[0]) return null;
    try {
      writeLiveryFiles(res.filePaths[0], paint, region, { backup: false });
      return { ok: true, folder: res.filePaths[0] };
    } catch (err) {
      return { ok: false, message: describeWriteError(err as NodeJS.ErrnoException) };
    }
  });

  ipcMain.handle('templates:openFile', (_e, absPath: string) => openTemplateAt(absPath, app.getPath('userData')));

  ipcMain.handle('templates:chooseFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose a car template',
      properties: ['openFile'],
      filters: [{ name: 'Car templates', extensions: ['psd'] }],
    });
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
  });
}
