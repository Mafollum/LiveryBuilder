import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export const ROOT = resolve(__dirname, '../..');
export const MAIN = resolve(ROOT, 'out/main/index.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const ELECTRON: string = require('electron') as unknown as string;

export async function launchApp(
  env: Record<string, string> = {},
  args: string[] = [],
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [MAIN, '--no-sandbox', ...args],
    env: { ...process.env, LIVERY_TEST: '1', ...env } as Record<string, string>,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}
