import { test, expect } from '@playwright/test';
import { launchApp, makeSandbox } from './helpers';

test('start screen lists cars grouped by class', async () => {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  try {
    const hyper = page.getByRole('heading', { name: 'Hypercar' });
    const gt3 = page.getByRole('heading', { name: 'GT3' });
    await expect(hyper).toBeVisible();
    await expect(gt3).toBeVisible();
    const hyperY = (await hyper.boundingBox())!.y;
    const gt3Y = (await gt3.boundingBox())!.y;
    expect(hyperY).toBeLessThan(gt3Y);
    await expect(page.getByRole('button', { name: 'Test Car Alpha — 2025' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Car Beta' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('says so when the LMU folder has no templates', async () => {
  const sb = makeSandbox({});
  const { app, page } = await launchApp(sb.env);
  try {
    await expect(page.getByText('No car templates found in')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose LMU folder…' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('opens a template through the app and caches the result', async () => {
  const sb = makeSandbox();
  const { app, page } = await launchApp(sb.env);
  try {
    const first = await page.evaluate(async () => {
      const d = await window.lmu.openTemplate('Template_GT3_TestCarAlpha_2025.psd');
      let on = 0;
      for (const v of d.panel) on += v;
      return { w: d.width, source: d.source, on, hi: d.levels?.channels[0].highlightOutput };
    });
    expect(first).toEqual({ w: 1024, source: 'mask', on: 400 * 200 + 300 * 400, hi: 210 });
    const beta = await page.evaluate(async () => (await window.lmu.openTemplate('Template_HYPER_TestCarBeta.psd')).source);
    expect(beta).toBe('wire');
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(`${sb.userData}/panel-cache`).filter((f) => f.endsWith('.bin')).length).toBe(2);
  } finally {
    await app.close();
  }
});
