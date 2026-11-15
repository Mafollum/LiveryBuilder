import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeTga32 } from '../../src/shared/tga';
import { launchApp, makeSandbox, openCar, items, type Sandbox } from './helpers';

/** 200×100 white image with a red square (70..129, 25..74). */
function logo(): Buffer {
  const p = new PNG({ width: 200, height: 100 });
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 200; x++) {
      const red = x >= 70 && x < 130 && y >= 25 && y < 75;
      p.data.set(red ? [210, 20, 30, 255] : [250, 250, 250, 255], (y * 200 + x) * 4);
    }
  return PNG.sync.write(p);
}

async function addLogoOnCar(page: Page) {
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo() });
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await page.evaluate(() => {
    const s = window.__livery.getState();
    s.updateItem(s.project.items[0].id, { x: 650, y: 650, scaleX: 1, scaleY: 1 });
  });
}

/** Region (finish) colour at a texture point after sending: white = sticker (the image is opaque there). */
async function regionAt(page: Page, sb: Sandbox, x: number, y: number) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.getByRole('button', { name: 'Send to game' }).click();
  await expect(page.getByText('Sent! Press RELOAD in the showroom.')).toBeVisible({ timeout: 20_000 });
  const img = decodeTga32(new Uint8Array(readFileSync(join(sb.lmu, 'UserData', 'Liveries', 'customskin_region.tga'))));
  return [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];
}
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

async function start() {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  await openCar(page, 'Test Car Alpha — 2025');
  await addLogoOnCar(page);
  return { sb, app, page };
}

test('remove plain background keeps only the logo, restore brings the background back', async () => {
  const { sb, app, page } = await start();
  try {
    expect(await regionAt(page, sb, 660, 660)).toEqual(WHITE); // the white background is part of the sticker
    await page.getByRole('button', { name: 'Remove plain background' }).click();
    await expect.poll(async () => (await items(page))[0].originalAssetId).toBeTruthy();
    expect(await regionAt(page, sb, 660, 660)).toEqual(BLACK);
    expect(await regionAt(page, sb, 750, 700)).toEqual(WHITE);
    await page.getByRole('button', { name: 'Restore original' }).click();
    expect(await regionAt(page, sb, 660, 660)).toEqual(WHITE);
    await page.keyboard.press('Control+z');
    expect(await regionAt(page, sb, 660, 660)).toEqual(BLACK);
  } finally { await app.close(); }
});

test('automatic background removal finds the subject', async () => {
  const { sb, app, page } = await start();
  try {
    await page.getByRole('button', { name: 'Remove background (automatic)' }).click();
    await expect.poll(async () => (await items(page))[0].originalAssetId, { timeout: 60_000 }).toBeTruthy();
    expect(await regionAt(page, sb, 660, 660)).toEqual(BLACK);
    expect(await regionAt(page, sb, 750, 700)).toEqual(WHITE);
  } finally { await app.close(); }
});
