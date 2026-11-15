import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';

const smokeTest = process.argv.includes('--smoke-test');

app.setName('LiveryBuilder');
if (process.env.LIVERY_USER_DATA) app.setPath('userData', process.env.LIVERY_USER_DATA);

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
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  return win;
}

ipcMain.on('app:ready', () => {
  if (smokeTest) app.exit(0);
});

if (smokeTest) setTimeout(() => app.exit(1), 30_000);

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => app.quit());
