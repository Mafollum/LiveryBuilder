import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeTga32 } from '../../src/shared/tga';
import { launchApp, makeSandbox, openCar, dragTexture, items, type Sandbox } from './helpers';

const SENT = 'Sent! Press RELOAD in the showroom.';

function whitePng(): Buffer {
  const p = new PNG({ width: 200, height: 100 });
  p.data.fill(255);
  return PNG.sync.write(p);
}

async function buildLivery(page: Page) {
  await page.getByLabel('Fill').fill('#ff0000');
  await page.getByLabel('Fill').press('Enter');
  await page.getByRole('button', { name: 'Rectangle' }).click();
  await dragTexture(page, [120, 120], [220, 220]);
  await page.getByLabel('Finish').selectOption({ label: 'Carbon' });
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: whitePng() });
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await page.evaluate(() => {
    const s = window.__livery.getState();
    const img = s.project.items[1];
    s.updateItem(img.id, { x: 650, y: 650, scaleX: 1, scaleY: 1 });
  });
}

function readTga(file: string) {
  const bytes = new Uint8Array(readFileSync(file));
  return { header: [...bytes.subarray(0, 18)], ...decodeTga32(bytes) };
}
const px = (img: { width: number; rgba: Uint8Array }, x: number, y: number) => [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

async function open(sb: Sandbox) {
  const { app, page } = await launchApp(sb.env);
  await openCar(page, 'Test Car Alpha — 2025');
  return { app, page };
}

test('sends paint and finish files to the game folder', async () => {
  const sb = makeSandbox();
  const { app, page } = await open(sb);
  try {
    await buildLivery(page);
    await page.getByRole('button', { name: 'Send to game' }).click();
    await expect(page.getByText(SENT)).toBeVisible({ timeout: 20_000 });
    const dir = join(sb.lmu, 'UserData', 'Liveries');
    const paint = readTga(join(dir, 'customskin.tga'));
    const region = readTga(join(dir, 'customskin_region.tga'));
    for (const t of [paint, region]) {
      expect([t.width, t.height]).toEqual([1024, 1024]);
      expect(t.header).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 4, 32, 8]);
    }
    expect(px(paint, 300, 200)).toEqual([210, 210, 210, 255]);
    expect(px(paint, 50, 50)).toEqual([210, 210, 210, 255]);
    expect(px(paint, 170, 170)).toEqual([210, 10, 10, 255]);
    expect(px(region, 170, 170)).toEqual([255, 0, 0, 255]);
    expect(px(region, 750, 700)).toEqual([255, 255, 255, 255]);
    expect(px(region, 300, 200)).toEqual([0, 0, 0, 255]);
  } finally { await app.close(); }
});

test('asks before replacing a livery once per session and can keep a backup', async () => {
  const sb = makeSandbox();
  let { app, page } = await open(sb);
  await page.getByRole('button', { name: 'Send to game' }).click();
  await expect(page.getByText(SENT)).toBeVisible({ timeout: 20_000 });
  await app.close();

  ({ app, page } = await open(sb));
  try {
    await page.getByRole('button', { name: 'Send to game' }).click();
    await expect(page.getByText("There's already a livery in the game folder. Replace it?")).toBeVisible();
    for (const b of ['Keep a backup and replace', 'Replace', 'Cancel']) await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Keep a backup and replace' }).click();
    await expect(page.getByText(SENT)).toBeVisible({ timeout: 20_000 });
    const files = readdirSync(join(sb.lmu, 'UserData', 'Liveries'));
    expect(files.filter((f) => /^customskin_backup_\d{8}-\d{6}\.tga$/.test(f)).length).toBe(1);
    expect(files.filter((f) => /^customskin_region_backup_\d{8}-\d{6}\.tga$/.test(f)).length).toBe(1);

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await page.getByRole('button', { name: 'Send to game' }).click();
    await expect(page.getByText(SENT)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("There's already a livery in the game folder. Replace it?")).toHaveCount(0);
  } finally { await app.close(); }
});

test('when the game folder cannot be written, the files can be saved elsewhere', async () => {
  const sb = makeSandbox();
  const liveries = join(sb.lmu, 'UserData', 'Liveries');
  rmSync(liveries, { recursive: true, force: true });
  writeFileSync(liveries, 'not a folder');
  const { app, page } = await open(sb);
  try {
    await page.getByRole('button', { name: 'Send to game' }).click();
    await expect(page.getByText("Couldn't write to the game folder")).toBeVisible({ timeout: 20_000 });
    const elsewhere = mkdtempSync(join(tmpdir(), 'elsewhere-'));
    await app.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [dir] })) as typeof dialog.showOpenDialog;
    }, elsewhere);
    await page.getByRole('button', { name: 'Save the two files somewhere else…' }).click();
    await expect.poll(() => existsSync(join(elsewhere, 'customskin_region.tga')), { timeout: 20_000 }).toBe(true);
    expect(existsSync(join(elsewhere, 'customskin.tga'))).toBe(true);
  } finally { await app.close(); }
});
