import { test, expect } from '@playwright/test';
import { launchApp, makeSandbox, openCar, texturePixel, textureToClient, pixelAt, near } from './helpers';

test('shows white panels with an outline on grey, car colour, zoom, pan, back', async () => {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  try {
    await openCar(page, 'Test Car Alpha — 2025');
    expect(await texturePixel(page, 300, 200)).toEqual([255, 255, 255]);
    expect(near(await texturePixel(page, 50, 50), [205, 205, 205])).toBe(true);

    const edge = await textureToClient(page, 100, 200);
    const band = await Promise.all([-2, -1, 0, 1, 2].map((dx) => pixelAt(page, edge.x + dx, edge.y)));
    expect(band.some(([r, g, b]) => r < 120 && g < 120 && b < 120)).toBe(true);

    const carColour = page.getByLabel('Car colour');
    await carColour.fill('#1e90ff');
    await carColour.press('Enter');
    await expect.poll(() => texturePixel(page, 300, 200)).toEqual([30, 144, 255]);

    const scale0 = await page.evaluate(() => window.__livery.getView().scale);
    const c = await textureToClient(page, 512, 512);
    await page.mouse.move(c.x, c.y);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => page.evaluate(() => window.__livery.getView().scale)).toBeGreaterThan(scale0);
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect.poll(() => page.evaluate(() => window.__livery.getView().scale)).toBeCloseTo(scale0, 5);

    const before = await textureToClient(page, 300, 200);
    await page.mouse.move(before.x, before.y);
    await page.keyboard.down('Space');
    await page.mouse.down();
    await page.mouse.move(before.x + 100, before.y + 50, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const after = await textureToClient(page, 300, 200);
    expect(Math.abs(after.x - before.x - 100)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.y - before.y - 50)).toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: '← Cars' }).click();
    await openCar(page, 'Test Car Beta');
    expect(await texturePixel(page, 500, 400)).toEqual([255, 255, 255]);
    expect(near(await texturePixel(page, 100, 100), [205, 205, 205])).toBe(true);
  } finally {
    await app.close();
  }
});
