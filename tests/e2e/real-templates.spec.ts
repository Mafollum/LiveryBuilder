import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { launchApp, openCar, texturePixel, dragTexture, items } from './helpers';

const EXAMPLE = '/home/user/lmu-data/ex/example livery/customskin.tga';

const REAL = '/home/user/lmu-data/tpl/LiveryTemplates';

function realSandbox() {
  const root = mkdtempSync(join(tmpdir(), 'livery-real-'));
  const lmu = join(root, 'Le Mans Ultimate');
  mkdirSync(join(lmu, 'Support'), { recursive: true });
  mkdirSync(join(lmu, 'UserData'), { recursive: true });
  symlinkSync(REAL, join(lmu, 'Support', 'LiveryTemplates'));
  const userData = join(root, 'userData');
  mkdirSync(userData);
  return { LIVERY_LMU_DIR: lmu, LIVERY_USER_DATA: userData, LIVERY_DOCUMENTS: join(root, 'Documents') };
}

/** A texture pixel deep inside a panel (its 9x9 neighbourhood is all panel). */
async function solidPanelPixel(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const { panel } = window.__livery.getState();
    const { width: w, height: h } = panel;
    for (let y = Math.floor(h / 2); y < h - 8; y += 7)
      for (let x = Math.floor(w / 4); x < w - 8; x += 7) {
        let ok = true;
        for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4 && ok; dx++) ok = panel.panel[(y + dy) * w + x + dx] === 1;
        if (ok) return { x, y };
      }
    return null;
  });
}

test.describe('real LMU templates', () => {
  test.skip(!existsSync(REAL), 'real templates not available');

  test('the largest template opens quickly, and instantly the second time', async () => {
    const env = realSandbox();
    let { app, page } = await launchApp(env);
    let t0 = Date.now();
    await openCar(page, 'Toyota GR010 — 2025');
    const first = Date.now() - t0;
    await app.close();
    ({ app, page } = await launchApp(env));
    try {
      t0 = Date.now();
      await openCar(page, 'Toyota GR010 — 2025');
      const second = Date.now() - t0;
      console.log(`Toyota GR010 2025: first open ${first} ms, cached ${second} ms`);
      expect(first).toBeLessThan(15_000);
      expect(second).toBeLessThan(2_000);
    } finally { await app.close(); }
  });

  test('a mesh-line car (Valkyrie) shows white panels', async () => {
    const { app, page } = await launchApp(realSandbox());
    try {
      await openCar(page, 'Aston Martin Valkyrie');
      const p = await solidPanelPixel(page);
      expect(p).not.toBeNull();
      expect(await texturePixel(page, p!.x, p!.y)).toEqual([255, 255, 255]);
    } finally { await app.close(); }
  });

  test('a full-size livery is sent in a few seconds with the same file layout as a working livery', async () => {
    const env = realSandbox();
    const { app, page } = await launchApp(env);
    try {
      await openCar(page, 'Ferrari 296 LMGT3 — 2025');
      await page.getByRole('button', { name: 'Rectangle' }).click();
      await dragTexture(page, [500, 1500], [3500, 1800]);
      await page.getByRole('button', { name: 'Text', exact: true }).click();
      await dragTexture(page, [1800, 2600], [1800, 2600]);
      await page.getByLabel('Text', { exact: true }).fill('LIVERY');
      await page.getByLabel('Text', { exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Brush', exact: true }).click();
      await dragTexture(page, [800, 900], [3000, 1000]);
      await expect.poll(async () => (await items(page)).length).toBe(3);
      const t0 = Date.now();
      await page.getByRole('button', { name: 'Send to game' }).click();
      await expect(page.getByText('Sent! Press RELOAD in the showroom.')).toBeVisible({ timeout: 30_000 });
      const ms = Date.now() - t0;
      console.log(`send to game at 4096x4096 with 3 items: ${ms} ms`);
      expect(ms).toBeLessThan(10_000);
      const dir = join(env.LIVERY_LMU_DIR, 'UserData', 'Liveries');
      const ours = readFileSync(join(dir, 'customskin.tga'));
      const region = readFileSync(join(dir, 'customskin_region.tga'));
      if (existsSync(EXAMPLE)) {
        const theirs = readFileSync(EXAMPLE);
        expect(ours.length).toBe(theirs.length);
        expect([...ours.subarray(0, 18)]).toEqual([...theirs.subarray(0, 18)]);
        expect([...ours.subarray(ours.length - 26)]).toEqual([...theirs.subarray(theirs.length - 26)]);
      }
      expect(region.length).toBe(ours.length);
    } finally { await app.close(); }
  });
});
