import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { launchApp, makeSandbox, openCar, texturePixel, textureToClient, items, near } from './helpers';

const BAD_FILE = "Can't open this file. Use PNG, JPG, WebP or SVG.";

function png(w: number, h: number, rgba: [number, number, number, number]): Buffer {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < p.data.length; i += 4) p.data.set(rgba, i);
  return PNG.sync.write(p);
}
const RED = png(200, 100, [255, 0, 0, 255]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#0000ff"/></svg>');

async function start() {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  await openCar(page, 'Test Car Alpha — 2025');
  return { app, page };
}

async function viewCentre(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector('.canvas-holder')!.getBoundingClientRect();
    return window.__livery.clientToTexture(r.left + r.width / 2, r.top + r.height / 2);
  });
}

async function addFile(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
}

test('Image button adds a centred sticker image', async () => {
  const { app, page } = await start();
  try {
    await addFile(page, 'logo.png', 'image/png', RED);
    await expect.poll(async () => (await items(page)).length).toBe(1);
    const it = (await items(page))[0];
    expect(it).toMatchObject({ type: 'image', width: 200, height: 100, finish: 'sticker', name: 'logo' });
    const c = await viewCentre(page);
    expect(Math.abs(it.x + (it.width * it.scaleX) / 2 - c.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(it.y + (it.height * it.scaleY) / 2 - c.y)).toBeLessThanOrEqual(2);
    // the view centre is off the car in this fixture, so the red image is shown faded under the grey veil
    await expect.poll(async () => near(await texturePixel(page, c.x, c.y), [218, 154, 154], 2)).toBe(true);
  } finally { await app.close(); }
});

test('dropping an image file on the canvas adds it', async () => {
  const { app, page } = await start();
  try {
    const dt = await page.evaluateHandle((bytes) => {
      const d = new DataTransfer();
      d.items.add(new File([new Uint8Array(bytes)], 'logo.png', { type: 'image/png' }));
      return d;
    }, [...RED]);
    await page.locator('.canvas-holder').dispatchEvent('drop', { dataTransfer: dt });
    await expect.poll(async () => (await items(page)).length).toBe(1);
  } finally { await app.close(); }
});

test('huge images are reduced to the texture size', async () => {
  const { app, page } = await start();
  try {
    await addFile(page, 'big.png', 'image/png', png(6000, 3000, [0, 128, 0, 255]));
    await expect.poll(async () => (await items(page)).length, { timeout: 30_000 }).toBe(1);
    expect(await items(page)).toMatchObject([{ width: 4096, height: 2048 }]);
  } finally { await app.close(); }
});

test('unsupported or broken files show a message and add nothing', async () => {
  const { app, page } = await start();
  try {
    await addFile(page, 'notes.txt', 'text/plain', Buffer.from('hello'));
    await expect(page.getByText(BAD_FILE)).toBeVisible();
    await addFile(page, 'broken.png', 'image/png', RED.subarray(0, 60));
    await expect(page.getByText(BAD_FILE)).toBeVisible();
    expect((await items(page)).length).toBe(0);
  } finally { await app.close(); }
});

test('SVGs are rasterised at the texture size', async () => {
  const { app, page } = await start();
  try {
    await addFile(page, 'shape.svg', 'image/svg+xml', SVG);
    await expect.poll(async () => (await items(page)).length).toBe(1);
    expect(await items(page)).toMatchObject([{ width: 4096, height: 2048 }]);
  } finally { await app.close(); }
});

test('text tool adds, styles and edits text', async () => {
  const { app, page } = await start();
  try {
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    const at = await textureToClient(page, 300, 200);
    await page.mouse.click(at.x, at.y);
    const box = page.getByLabel('Text', { exact: true });
    await box.fill('HELLO');
    await box.press('Enter');
    await expect.poll(async () => (await items(page)).length).toBe(1);
    expect((await items(page))[0]).toMatchObject({ type: 'text', text: 'HELLO', fontFamily: 'Arial Black', finish: 'sticker' });
    expect(await page.getByLabel('Font').locator('option').allTextContents()).toEqual([
      'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Consolas', 'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana',
    ]);
    await page.getByRole('button', { name: 'Bold' }).click();
    expect((await items(page))[0].bold).toBe(true);
    const inside = await textureToClient(page, 320, 260);
    await page.mouse.dblclick(inside.x, inside.y);
    await box.fill('WORLD');
    await box.press('Enter');
    await expect.poll(async () => (await items(page))[0].text).toBe('WORLD');
    expect((await items(page)).length).toBe(1);
  } finally { await app.close(); }
});
