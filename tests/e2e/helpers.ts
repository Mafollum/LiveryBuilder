import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export const ROOT = resolve(__dirname, '../..');
export const MAIN = resolve(ROOT, 'out/main/index.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const ELECTRON: string = require('electron') as unknown as string;

export async function launchApp(
  env: Record<string, string> = {},
  args: string[] = [],
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    executablePath: ELECTRON,
    args: [MAIN, '--no-sandbox', ...args],
    env: { ...process.env, LIVERY_TEST: '1', ...env } as Record<string, string>,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeTemplate } from '../fixtures/makeTemplate';
import { makeFakeLmu } from '../fixtures/fakeLmu';

export const ALPHA = 'Template_GT3_TestCarAlpha_2025.psd';
export const BETA = 'Template_HYPER_TestCarBeta.psd';
export const LEVELS_10_210 = { shadowInput: 0, highlightInput: 255, shadowOutput: 10, highlightOutput: 210, midtoneInput: 1 };

let fixtureCache: Record<string, Uint8Array> | null = null;
export function standardTemplates(): Record<string, Uint8Array> {
  fixtureCache ??= {
    [ALPHA]: makeTemplate({
      size: 1024,
      mask: { rects: [{ x: 100, y: 100, w: 400, h: 200 }, { x: 600, y: 500, w: 300, h: 400 }] },
      levels: LEVELS_10_210,
      fixed: [
        { name: "Number Plates (Don't Move)", rect: { x: 420, y: 230, w: 60, h: 60 }, rgba: [0, 160, 0, 255] },
        { name: 'Class Stickers', rect: { x: 620, y: 520, w: 40, h: 30 }, rgba: [0, 0, 0, 255], overlay: [255, 255, 0] },
      ],
    }),
    [BETA]: makeTemplate({ size: 1024, wire: { rects: [{ x: 200, y: 200, w: 600, h: 400 }] } }),
  };
  return fixtureCache;
}

export interface Sandbox { root: string; lmu: string; userData: string; documents: string; env: Record<string, string> }

/** A temp LMU install (standard fixtures unless `templates` is given), user data and documents folders. */
export function makeSandbox(templates: Record<string, Uint8Array> = standardTemplates()): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'livery-e2e-'));
  const lmu = makeFakeLmu(root, templates);
  const userData = join(root, 'userData');
  const documents = join(root, 'Documents');
  mkdirSync(userData, { recursive: true });
  mkdirSync(documents, { recursive: true });
  return { root, lmu, userData, documents, env: { LIVERY_LMU_DIR: lmu, LIVERY_USER_DATA: userData, LIVERY_DOCUMENTS: documents } };
}

import { PNG } from 'pngjs';
import type { Page as PwPage } from '@playwright/test';

/** Screen colour [r, g, b] at a client pixel. */
export async function pixelAt(page: PwPage, x: number, y: number): Promise<[number, number, number]> {
  const buf = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  const png = PNG.sync.read(buf);
  return [png.data[0], png.data[1], png.data[2]];
}

export async function textureToClient(page: PwPage, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([tx, ty]) => window.__livery.textureToClient(tx, ty), [x, y] as const);
}

/** Colour at a texture coordinate as shown on screen. */
export async function texturePixel(page: PwPage, x: number, y: number): Promise<[number, number, number]> {
  const c = await textureToClient(page, x, y);
  return pixelAt(page, c.x, c.y);
}

/** Opens a car from the start screen and waits until its panels are on screen. */
export async function openCar(page: PwPage, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForFunction(() => !!window.__livery?.getState().panel && window.__livery.isCanvasReady());
}

/** Colour equality within ±tol per channel (canvas blending rounds by 1). */
export function near(actual: [number, number, number], expected: [number, number, number], tol = 1): boolean {
  return actual.every((v, i) => Math.abs(v - expected[i]) <= tol);
}

/** Drags with the mouse between two texture coordinates. */
export async function dragTexture(page: PwPage, from: [number, number], to: [number, number]): Promise<void> {
  const a = await textureToClient(page, from[0], from[1]);
  const b = await textureToClient(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

export const items = (page: PwPage) => page.evaluate(() => window.__livery.getState().project.items);
