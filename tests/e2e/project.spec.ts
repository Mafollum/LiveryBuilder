import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeSandbox, openCar, dragTexture, items, standardTemplates, ALPHA, type Sandbox } from './helpers';

async function stubSave(app: ElectronApplication, path: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog;
  }, path);
}
async function stubOpen(app: ElectronApplication, path: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as typeof dialog.showOpenDialog;
  }, path);
}

async function addRectAndText(page: Page) {
  await page.getByRole('button', { name: 'Rectangle' }).click();
  await dragTexture(page, [120, 120], [220, 220]);
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await dragTexture(page, [300, 200], [300, 200]);
  await page.getByLabel('Text', { exact: true }).fill('HELLO');
  await page.getByLabel('Text', { exact: true }).press('Enter');
  await expect.poll(async () => (await items(page)).length).toBe(2);
}

async function savedProject(sb: Sandbox): Promise<string> {
  const file = join(sb.root, 'a.lmulivery');
  const { app, page } = await launchApp(sb.env);
  try {
    await openCar(page, 'Test Car Alpha — 2025');
    await addRectAndText(page);
    await stubSave(app, file);
    await page.keyboard.press('Control+s');
    await expect.poll(() => existsSync(file)).toBe(true);
    await expect.poll(() => page.title()).toBe('a — LMU Livery Builder');
    expect(await page.evaluate(() => window.__livery.getState().dirty)).toBe(false);
  } finally {
    await app.close();
  }
  return file;
}

test('saves with Ctrl+S, reopens with Ctrl+O and lists recent projects', async () => {
  const sb = makeSandbox();
  const file = await savedProject(sb);
  const { app, page } = await launchApp(sb.env);
  try {
    await expect(page.getByRole('button', { name: 'a.lmulivery' })).toBeVisible();
    await stubOpen(app, file);
    await page.keyboard.press('Control+o');
    await expect.poll(async () => (await page.evaluate(() => window.__livery?.getState().project.items.length)) ?? 0).toBe(2);
    await expect(page.getByText('Test Car Alpha — 2025')).toBeVisible();
    expect(await page.evaluate(() => window.__livery.getState().dirty)).toBe(false);
    await page.waitForFunction(() => window.__livery.isCanvasReady());
  } finally { await app.close(); }
});

test('closing with unsaved changes asks first', async () => {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  try {
    await openCar(page, 'Test Car Alpha — 2025');
    await addRectAndText(page);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await expect(page.getByText('Save changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  } finally { await app.close(); }
});

test('offers to restore unsaved work after a crash', async () => {
  const sb = makeSandbox();
  const env = { ...sb.env, LIVERY_AUTOSAVE_MS: '300' };
  let { app, page } = await launchApp(env);
  await openCar(page, 'Test Car Alpha — 2025');
  await addRectAndText(page);
  await expect.poll(() => existsSync(join(sb.userData, 'autosave.lmulivery'))).toBe(true);
  await page.waitForTimeout(500);
  app.process().kill('SIGKILL');

  ({ app, page } = await launchApp(env));
  try {
    await expect(page.getByText('Restore your last unsaved work?')).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect.poll(async () => (await page.evaluate(() => window.__livery?.getState().project.items.length)) ?? 0).toBe(2);
  } finally { await app.close(); }
});

test('asks for the template file when the project template is missing', async () => {
  const sb = makeSandbox();
  const file = await savedProject(sb);
  rmSync(join(sb.lmu, 'Support', 'LiveryTemplates', ALPHA));
  const elsewhere = join(mkdtempSync(join(tmpdir(), 'tpl-')), ALPHA);
  writeFileSync(elsewhere, standardTemplates()[ALPHA]);
  const { app, page } = await launchApp(sb.env);
  try {
    await expect(page.getByRole('button', { name: 'a.lmulivery' })).toBeVisible();
    await stubOpen(app, file);
    await page.keyboard.press('Control+o');
    await expect(page.getByText(`This project needs the car template ${ALPHA}, which wasn't found.`)).toBeVisible();
    await stubOpen(app, elsewhere);
    await page.getByRole('button', { name: 'Choose template file…' }).click();
    await expect.poll(async () => (await page.evaluate(() => window.__livery?.getState().project.items.length)) ?? 0).toBe(2);
    await page.waitForFunction(() => window.__livery.isCanvasReady());
  } finally { await app.close(); }
});
