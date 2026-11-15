import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeTga32 } from '../../src/shared/tga';
import { launchApp, makeSandbox, openCar, texturePixel, dragTexture } from './helpers';

const px = (img: { width: number; rgba: Uint8Array }, x: number, y: number) => [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('fixed template elements sit on top of the design, can be switched off, and are sent to the game', async () => {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  try {
    await openCar(page, 'Test Car Alpha — 2025');
    await expect.poll(() => texturePixel(page, 450, 260)).toEqual([0, 160, 0]);
    await expect.poll(() => texturePixel(page, 640, 535)).toEqual([255, 255, 0]);

    await page.getByLabel('Fill').fill('#ff0000');
    await page.getByLabel('Fill').press('Enter');
    await page.getByRole('button', { name: 'Rectangle' }).click();
    await dragTexture(page, [400, 210], [495, 295]);
    await page.keyboard.press('Escape'); // hide the selection handles before reading pixels
    await expect.poll(() => texturePixel(page, 450, 260)).toEqual([0, 160, 0]); // plate stays on top
    await expect.poll(() => texturePixel(page, 405, 215)).toEqual([255, 0, 0]);

    await expect(page.getByText('On the car')).toBeVisible();
    await page.getByRole('button', { name: 'Hide Number plates' }).click();
    await expect.poll(() => texturePixel(page, 450, 260)).toEqual([255, 0, 0]);
    expect(await page.evaluate(() => window.__livery.getState().project.fixedVisibility)).toEqual({ 'Number plates': false });
    await page.keyboard.press('Control+z');
    await expect.poll(() => texturePixel(page, 450, 260)).toEqual([0, 160, 0]);

    await page.getByRole('button', { name: 'Send to game' }).click();
    await expect(page.getByText('Sent! Press RELOAD in the showroom.')).toBeVisible({ timeout: 20_000 });
    const dir = join(sb.lmu, 'UserData', 'Liveries');
    const paint = decodeTga32(new Uint8Array(readFileSync(join(dir, 'customskin.tga'))));
    const region = decodeTga32(new Uint8Array(readFileSync(join(dir, 'customskin_region.tga'))));
    expect(px(paint, 450, 260)).toEqual([10, 135, 10, 255]); // green plate with the template's Levels
    expect(px(region, 450, 260)).toEqual([255, 255, 255, 255]); // sticker finish
    expect(px(paint, 405, 215)).toEqual([210, 10, 10, 255]);
    expect(px(region, 640, 535)).toEqual([255, 255, 255, 255]);

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await page.getByRole('button', { name: 'Hide Number plates' }).click();
    await page.getByRole('button', { name: 'Send to game' }).click();
    await expect(page.getByText('Sent! Press RELOAD in the showroom.')).toBeVisible({ timeout: 20_000 });
    const paint2 = decodeTga32(new Uint8Array(readFileSync(join(dir, 'customskin.tga'))));
    expect(px(paint2, 450, 260)).toEqual([210, 10, 10, 255]);
  } finally { await app.close(); }
});
