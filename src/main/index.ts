import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';
import { registerProjectIpc } from './project/projectIo';

const smokeTest = process.argv.includes('--smoke-test');
let quitting = false;
let allowClose = false;
const CLOSE_ACK_MS = 2000;

app.setName('LiveryBuilder');
if (process.env.LIVERY_USER_DATA) app.setPath('userData', process.env.LIVERY_USER_DATA);
if (process.env.LIVERY_DOCUMENTS) app.setPath('documents', process.env.LIVERY_DOCUMENTS);

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'LMU Livery Builder',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);
  // closing the window asks the editor first (unsaved changes); quitting the app does not
  // if the editor crashed or doesn't answer, the window must still close
  let rendererGone = false;
  let ackTimer: NodeJS.Timeout | null = null;
  win.webContents.on('render-process-gone', () => {
    rendererGone = true;
  });
  win.on('close', (e) => {
    if (allowClose || quitting || smokeTest || rendererGone || win.webContents.isCrashed()) return;
    e.preventDefault();
    win.webContents.send('app:close-requested');
    if (ackTimer) clearTimeout(ackTimer);
    ackTimer = setTimeout(() => {
      allowClose = true;
      win.close();
    }, CLOSE_ACK_MS);
  });
  ipcMain.removeAllListeners('app:close-ack');
  ipcMain.on('app:close-ack', () => {
    if (ackTimer) clearTimeout(ackTimer);
    ackTimer = null;
  });
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  return win;
}

ipcMain.on('app:close-now', (e) => {
  allowClose = true;
  BrowserWindow.fromWebContents(e.sender)?.close();
});

app.on('before-quit', () => {
  quitting = true;
});

ipcMain.on('app:ready', () => {
  if (smokeTest) app.exit(0);
});

if (smokeTest) setTimeout(() => app.exit(1), 30_000);

app.whenReady().then(() => {
  registerIpc();
  registerProjectIpc();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
