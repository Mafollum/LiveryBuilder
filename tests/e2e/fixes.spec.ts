import { test, expect, type Page } from '@playwright/test';
import { launchApp, makeSandbox, openCar, dragTexture, items, texturePixel } from './helpers';

async function start() {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  await openCar(page, 'Test Car Alpha — 2025');
  return { sb, app, page };
}
async function rect(page: Page, from: [number, number] = [120, 120], to: [number, number] = [220, 220]) {
  await page.getByRole('button', { name: 'Rectangle' }).click();
  await dragTexture(page, from, to);
}

test('undo and Delete still work after using a slider or dropdown', async () => {
  const { app, page } = await start();
  try {
    await rect(page);
    await page.getByLabel('Opacity').fill('50');
    await page.getByLabel('Opacity').dispatchEvent('pointerup');
    await page.getByLabel('Opacity').press('Control+z');
    await expect.poll(async () => (await items(page))[0].opacity).toBe(1);
    await page.getByLabel('Finish').selectOption({ label: 'Carbon' });
    await page.getByLabel('Finish').press('Control+z');
    await expect.poll(async () => (await items(page))[0].finish).toBe('paint');
    await page.getByLabel('Finish').press('Delete');
    await expect.poll(async () => (await items(page)).length).toBe(0);
  } finally { await app.close(); }
});

test('leaving the editor or opening a project with unsaved changes asks first', async () => {
  const { app, page } = await start();
  try {
    await rect(page);
    await page.getByRole('button', { name: '← Cars' }).click();
    await expect(page.getByText('Save changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect((await items(page)).length).toBe(1);
    await expect(page.getByRole('button', { name: 'Send to game' })).toBeVisible();

    await page.keyboard.press('Control+o');
    await expect(page.getByText('Save changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect((await items(page)).length).toBe(1);

    await page.getByRole('button', { name: '← Cars' }).click();
    await page.getByRole('button', { name: "Don't save" }).click();
    await expect(page.getByRole('button', { name: 'Test Car Beta' })).toBeVisible();
  } finally { await app.close(); }
});

/** Simulates dragging in the native colour square: many input events, then one change event. */
async function dragColour(page: Page, label: string, count: number) {
  const box = page.locator('.colour-picker', { has: page.getByLabel(label, { exact: true }) }).getByLabel('Choose colour');
  await box.evaluate((el: HTMLInputElement, n: number) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (let i = 0; i < n; i++) {
      setter.call(el, `#${(16 + i).toString(16)}2040`);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, count);
}

test('dragging in the colour square is one undo step and one recent colour', async () => {
  const { app, page } = await start();
  try {
    await rect(page);
    const before = await page.evaluate(() => window.__livery.getState().past.length);
    await dragColour(page, 'Fill', 40);
    const st = await page.evaluate(() => {
      const s = window.__livery.getState();
      return { past: s.past.length, recent: s.recentColours, fill: s.project.items[0].fill };
    });
    expect(st.fill).toBe('#372040');
    expect(st.past).toBe(before + 1);
    expect(st.recent).toEqual(['#372040']);

    const before2 = st.past;
    await dragColour(page, 'Car colour', 30);
    const st2 = await page.evaluate(() => ({ past: window.__livery.getState().past.length, car: window.__livery.getState().project.carColour }));
    expect(st2.car).toBe('#2d2040');
    expect(st2.past).toBe(before2 + 1);
  } finally { await app.close(); }
});

async function brushStroke(page: Page, from: [number, number], to: [number, number]) {
  await page.getByRole('button', { name: 'Brush', exact: true }).click();
  await page.getByLabel('Brush colour').fill('#0000ff');
  await page.getByLabel('Brush colour').press('Enter');
  await dragTexture(page, from, to);
}

test('flipping a brush item keeps it in place', async () => {
  const { app, page } = await start();
  try {
    await brushStroke(page, [150, 150], [450, 150]);
    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByRole('button', { name: 'Flip ⇆' }).click();
    await expect.poll(() => texturePixel(page, 300, 150)).toEqual([0, 0, 255]);
  } finally { await app.close(); }
});

test('painting on a moved brush item is not clipped', async () => {
  const { app, page } = await start();
  try {
    await brushStroke(page, [150, 150], [450, 150]);
    await page.evaluate(() => {
      const s = window.__livery.getState();
      s.updateItem(s.project.items[0].id, { x: 300 });
    });
    await dragTexture(page, [150, 250], [450, 250]);
    expect((await items(page))[0].strokes.length).toBe(2);
    await expect.poll(() => texturePixel(page, 200, 250)).toEqual([0, 0, 255]);
  } finally { await app.close(); }
});

test('a brush item only keeps an image as big as its paint', async () => {
  const { app, page } = await start();
  try {
    await brushStroke(page, [150, 150], [450, 150]);
    const size = await page.evaluate(() => window.__livery.brushCanvasSize(window.__livery.getState().project.items[0].id));
    expect(size.width).toBeLessThan(400);
    expect(size.height).toBeLessThan(100);
  } finally { await app.close(); }
});
