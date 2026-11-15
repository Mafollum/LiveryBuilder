import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeTga32 } from '../../src/shared/tga';
import { launchApp, makeSandbox, openCar, dragTexture, items, type Sandbox } from './helpers';

// fixture Levels map 0→10 and 255→210: blue (0,0,255) becomes (10,10,210), the white car (210,210,210)
const BLUE = [10, 10, 210];
const WHITE = [210, 210, 210];

async function start() {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  await openCar(page, 'Test Car Alpha — 2025');
  return { sb, app, page };
}

async function paint(page: Page, type: string, from: [number, number], to: [number, number], opts: { size?: number; softness?: number } = {}) {
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.getByLabel('Brush type').selectOption({ label: type });
  await page.getByLabel('Brush colour').fill('#0000ff');
  await page.getByLabel('Brush colour').press('Enter');
  await page.getByLabel('Brush size').fill(String(opts.size ?? 40));
  await page.getByLabel('Brush size').press('Enter');
  if (opts.softness !== undefined) await page.getByLabel('Softness').fill(String(opts.softness));
  await page.keyboard.press('Escape'); // new strokes start a new brush item
  await dragTexture(page, from, to);
}

async function exportPaint(page: Page, sb: Sandbox) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.getByRole('button', { name: 'Send to game' }).click();
  await expect(page.getByText('Sent! Press RELOAD in the showroom.')).toBeVisible({ timeout: 20_000 });
  const bytes = readFileSync(join(sb.lmu, 'UserData', 'Liveries', 'customskin.tga'));
  return { bytes, img: decodeTga32(new Uint8Array(bytes)) };
}

const rgb = (img: { width: number; rgba: Uint8Array }, x: number, y: number) => [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];
const same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 1);
function region(img: { width: number; rgba: Uint8Array }, x0: number, y0: number, x1: number, y1: number) {
  const out: number[][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(rgb(img, x, y));
  return out;
}

test('the brush type list has the eight types and is stored with each stroke', async () => {
  const { app, page } = await start();
  try {
    await page.getByRole('button', { name: 'Brush', exact: true }).click();
    expect(await page.getByLabel('Brush type').locator('option').allTextContents()).toEqual([
      'Hard round', 'Soft round', 'Airbrush', 'Pencil', 'Marker', 'Calligraphy', 'Spray', 'Chalk',
    ]);
    await paint(page, 'Spray', [150, 150], [450, 150]);
    expect((await items(page))[0].strokes[0].kind).toBe('spray');
  } finally { await app.close(); }
});

test('pencil has crisp edges; hard round is smoothed', async () => {
  const { sb, app, page } = await start();
  try {
    await paint(page, 'Pencil', [150, 140], [450, 160], { size: 20 });
    await paint(page, 'Hard round', [150, 240], [450, 260], { size: 20 });
    const { img } = await exportPaint(page, sb);
    const pencil = region(img, 280, 130, 320, 170);
    expect(pencil.every((p) => same(p, BLUE) || same(p, WHITE))).toBe(true);
    const hard = region(img, 280, 230, 320, 270);
    expect(hard.some((p) => !same(p, BLUE) && !same(p, WHITE))).toBe(true);
  } finally { await app.close(); }
});

test('marker has square ends, hard round has round ends', async () => {
  const { sb, app, page } = await start();
  try {
    await paint(page, 'Marker', [150, 150], [300, 150], { size: 40 });
    await paint(page, 'Hard round', [150, 250], [300, 250], { size: 40 });
    const { img } = await exportPaint(page, sb);
    expect(same(rgb(img, 317, 167), BLUE)).toBe(true); // corner of a square end
    expect(same(rgb(img, 317, 267), WHITE)).toBe(true); // outside a round end
  } finally { await app.close(); }
});

test('calligraphy is thin along the nib and thick across it', async () => {
  const { sb, app, page } = await start();
  try {
    await paint(page, 'Calligraphy', [150, 120], [250, 220], { size: 40 }); // along the 45° nib → thin
    await paint(page, 'Calligraphy', [320, 220], [420, 120], { size: 40 }); // across the nib → thick
    const { img } = await exportPaint(page, sb);
    const across = (cx: number, cy: number, dx: number, dy: number) => {
      let n = 0;
      for (let t = -30; t <= 30; t++) if (same(rgb(img, Math.round(cx + t * dx), Math.round(cy + t * dy)), BLUE)) n++;
      return n;
    };
    const thin = across(200, 170, Math.SQRT1_2, -Math.SQRT1_2);
    const thick = across(370, 170, Math.SQRT1_2, Math.SQRT1_2);
    expect(thick).toBeGreaterThan(thin * 2);
  } finally { await app.close(); }
});

test('airbrush is see-through after one pass; spray scatters dots; chalk is grainy', async () => {
  const { sb, app, page } = await start();
  try {
    await paint(page, 'Airbrush', [150, 130], [450, 130], { size: 40 });
    await paint(page, 'Spray', [150, 200], [450, 200], { size: 40 });
    await paint(page, 'Chalk', [150, 270], [450, 270], { size: 40 });
    const { bytes, img } = await exportPaint(page, sb);
    const air = rgb(img, 300, 130);
    expect(air[0]).toBeGreaterThan(BLUE[0] + 20); // lighter than solid blue
    expect(air[2]).toBeGreaterThan(air[0]); // but bluish
    const spray = region(img, 250, 190, 350, 210);
    const sprayBlue = spray.filter((p) => p[2] > p[0] + 40).length / spray.length;
    expect(sprayBlue).toBeGreaterThan(0.05);
    expect(sprayBlue).toBeLessThan(0.8);
    const chalk = region(img, 250, 266, 350, 274);
    const solid = chalk.filter((p) => same(p, BLUE)).length / chalk.length;
    expect(solid).toBeGreaterThan(0.2);
    expect(solid).toBeLessThan(0.95);
    // the same strokes always render the same (undo/redo, sending again)
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    const again = await exportPaint(page, sb);
    expect(again.bytes.equals(bytes)).toBe(true);
  } finally { await app.close(); }
});
