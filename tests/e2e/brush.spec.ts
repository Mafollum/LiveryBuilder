import { test, expect, type Page } from '@playwright/test';
import { launchApp, makeSandbox, openCar, texturePixel, dragTexture, items, near } from './helpers';

async function start() {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  await openCar(page, 'Test Car Alpha — 2025');
  return { app, page };
}

async function setBrush(page: Page, opts: { colour?: string; size?: number; opacity?: number; softness?: number }) {
  if (opts.colour) {
    await page.getByLabel('Brush colour').fill(opts.colour);
    await page.getByLabel('Brush colour').press('Enter');
  }
  if (opts.size !== undefined) {
    await page.getByLabel('Brush size').fill(String(opts.size));
    await page.getByLabel('Brush size').press('Enter');
  }
  if (opts.opacity !== undefined) await page.getByLabel('Brush opacity').fill(String(opts.opacity));
  if (opts.softness !== undefined) await page.getByLabel('Softness').fill(String(opts.softness));
}

test('brush paints, keeps painting the selected brush item, eraser erases, undo restores', async () => {
  const { app, page } = await start();
  try {
    await page.getByRole('button', { name: 'Brush', exact: true }).click();
    await setBrush(page, { colour: '#0000ff', size: 40, opacity: 100, softness: 0 });
    await dragTexture(page, [150, 150], [450, 150]);
    let list = await items(page);
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('brush');
    expect(list[0].strokes.length).toBe(1);
    await expect.poll(() => texturePixel(page, 300, 150)).toEqual([0, 0, 255]);
    expect(await texturePixel(page, 300, 200)).toEqual([255, 255, 255]);

    await dragTexture(page, [150, 250], [450, 250]);
    list = await items(page);
    expect(list.length).toBe(1);
    expect(list[0].strokes.length).toBe(2);

    await page.getByRole('button', { name: 'Eraser', exact: true }).click();
    await dragTexture(page, [140, 150], [460, 150]);
    list = await items(page);
    expect(list[0].strokes.length).toBe(3);
    expect(list[0].strokes[2].mode).toBe('erase');
    await expect.poll(() => texturePixel(page, 300, 150)).toEqual([255, 255, 255]);

    await page.keyboard.press('Control+z');
    await expect.poll(() => texturePixel(page, 300, 150)).toEqual([0, 0, 255]);
  } finally { await app.close(); }
});

test('brush opacity and softness', async () => {
  const { app, page } = await start();
  try {
    await page.getByRole('button', { name: 'Brush', exact: true }).click();
    await setBrush(page, { colour: '#0000ff', size: 40, opacity: 50, softness: 0 });
    await dragTexture(page, [150, 150], [450, 150]);
    await expect.poll(async () => near(await texturePixel(page, 300, 150), [128, 128, 255], 6)).toBe(true);

    await setBrush(page, { opacity: 100, softness: 0 });
    await dragTexture(page, [150, 200], [450, 200]);
    await setBrush(page, { softness: 100 });
    await dragTexture(page, [150, 260], [450, 260]);
    const hard = await texturePixel(page, 300, 218);
    const soft = await texturePixel(page, 300, 278);
    expect(soft[0]).toBeGreaterThan(hard[0]);
  } finally { await app.close(); }
});

test('a brush stroke while a shape is selected starts a new brush item', async () => {
  const { app, page } = await start();
  try {
    await page.getByRole('button', { name: 'Rectangle' }).click();
    await dragTexture(page, [120, 120], [220, 220]);
    await page.getByRole('button', { name: 'Brush', exact: true }).click();
    await dragTexture(page, [300, 150], [450, 150]);
    const list = await items(page);
    expect(list.length).toBe(2);
    expect(list[1]).toMatchObject({ type: 'brush', name: 'Brush 1' });
  } finally { await app.close(); }
});
