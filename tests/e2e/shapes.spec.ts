import { test, expect, type Page } from '@playwright/test';
import { launchApp, makeSandbox, openCar, texturePixel, dragTexture, items } from './helpers';

async function start(args: string[] = []) {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env, args);
  await openCar(page, 'Test Car Alpha — 2025');
  return { app, page };
}

async function drawRect(page: Page) {
  await page.getByLabel('Fill').fill('#ff0000');
  await page.getByLabel('Fill').press('Enter');
  await page.getByRole('button', { name: 'Rectangle' }).click();
  await dragTexture(page, [120, 120], [220, 220]);
}

test('rectangle tool draws a red square on the panel', async () => {
  const { app, page } = await start();
  try {
    await drawRect(page);
    const list = await items(page);
    expect(list.length).toBe(1);
    expect(list[0]).toMatchObject({ type: 'shape', shape: 'rect', finish: 'paint' });
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(list[0][k] - (k === 'x' || k === 'y' ? 120 : 100))).toBeLessThanOrEqual(2);
    await expect.poll(() => texturePixel(page, 170, 170)).toEqual([255, 0, 0]);
  } finally { await app.close(); }
});

test('circle, line and triangle tools create their shapes', async () => {
  const { app, page } = await start();
  try {
    for (const [tool, shape] of [['Circle', 'ellipse'], ['Line', 'line'], ['Triangle', 'triangle']] as const) {
      await page.getByRole('button', { name: tool, exact: true }).click();
      await dragTexture(page, [150, 150], [300, 250]);
      const list = await items(page);
      expect(list[list.length - 1].shape).toBe(shape);
    }
    expect((await items(page)).length).toBe(3);
  } finally { await app.close(); }
});

test('select tool moves a shape; undo puts it back', async () => {
  const { app, page } = await start();
  try {
    await drawRect(page);
    await page.getByRole('button', { name: 'Select' }).click();
    await dragTexture(page, [170, 170], [220, 170]);
    expect(Math.abs((await items(page))[0].x - 170)).toBeLessThanOrEqual(2);
    await page.keyboard.press('Control+z');
    expect(Math.abs((await items(page))[0].x - 120)).toBeLessThanOrEqual(2);
    await page.keyboard.press('Control+y');
    expect(Math.abs((await items(page))[0].x - 170)).toBeLessThanOrEqual(2);
    await page.getByRole('button', { name: 'Undo' }).click();
    expect(Math.abs((await items(page))[0].x - 120)).toBeLessThanOrEqual(2);
    await page.getByRole('button', { name: 'Redo' }).click();
    expect(Math.abs((await items(page))[0].x - 170)).toBeLessThanOrEqual(2);
  } finally { await app.close(); }
});

test('properties change colour, opacity and finish', async () => {
  const { app, page } = await start();
  try {
    await drawRect(page);
    await page.getByLabel('Fill').fill('#00ff00');
    await page.getByLabel('Fill').press('Enter');
    await expect.poll(() => texturePixel(page, 170, 170)).toEqual([0, 255, 0]);
    await page.getByLabel('Opacity').fill('50');
    await expect.poll(async () => (await items(page))[0].opacity).toBe(0.5);
    const finish = page.getByLabel('Finish');
    expect(await finish.locator('option').allTextContents()).toEqual(['Paint', 'Carbon', 'Special 1', 'Special 2', 'Sticker']);
    await finish.selectOption({ label: 'Carbon' });
    expect((await items(page))[0].finish).toBe('carbon');
    await expect(page.getByText("You choose what each finish looks like in the game's showroom.")).toBeVisible();
  } finally { await app.close(); }
});

test('items list: order, hide, reorder, rename', async () => {
  const { app, page } = await start();
  try {
    await drawRect(page);
    await page.getByRole('button', { name: 'Circle', exact: true }).click();
    await dragTexture(page, [300, 150], [400, 250]);
    const rows = page.getByRole('list', { name: 'Items', exact: true }).getByRole('listitem');
    await expect(rows).toHaveText(['Circle 1', 'Rectangle 1'].map((n) => new RegExp(n)));
    await page.getByRole('button', { name: 'Hide Rectangle 1' }).click();
    expect((await items(page))[0].visible).toBe(false);
    await page.getByRole('button', { name: 'Show Rectangle 1' }).click();
    expect((await items(page))[0].visible).toBe(true);
    await rows.nth(1).dragTo(rows.nth(0));
    await expect(rows).toHaveText(['Rectangle 1', 'Circle 1'].map((n) => new RegExp(n)));
    await rows.nth(0).getByText('Rectangle 1').dblclick();
    const edit = page.getByLabel('Item name');
    await edit.fill('Door stripe');
    await edit.press('Enter');
    await expect(rows.nth(0)).toHaveText(/Door stripe/);
  } finally { await app.close(); }
});

test('flip, duplicate and delete', async () => {
  const { app, page } = await start();
  try {
    await drawRect(page);
    await page.getByRole('button', { name: 'Flip ⇆' }).click();
    expect((await items(page))[0].scaleX).toBe(-1);
    await page.getByRole('button', { name: 'Duplicate' }).click();
    const list = await items(page);
    expect(list.length).toBe(2);
    expect(list[1].x - list[0].x).toBeCloseTo(40, 0);
    expect(list[1].y - list[0].y).toBeCloseTo(40, 0);
    await page.keyboard.press('Delete');
    expect((await items(page)).length).toBe(1);
  } finally { await app.close(); }
});

test('typing in a text field does not trigger editor shortcuts', async () => {
  const { app, page } = await start();
  try {
    await drawRect(page);
    const name = page.getByLabel('Name', { exact: true });
    await name.click();
    await name.press('End');
    await name.press('Delete');
    await name.press('Backspace');
    await name.press('Control+z');
    await name.press('ArrowLeft');
    const list = await items(page);
    expect(list.length).toBe(1);
    expect(Math.abs(list[0].x - 120)).toBeLessThanOrEqual(2);
  } finally { await app.close(); }
});

test('drawing lands in the right place with 150% display scaling', async () => {
  const { app, page } = await start(['--force-device-scale-factor=1.5']);
  try {
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1.5);
    await drawRect(page);
    const it = (await items(page))[0];
    expect(Math.abs(it.x - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(it.width - 100)).toBeLessThanOrEqual(2);
  } finally { await app.close(); }
});
