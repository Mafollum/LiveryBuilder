import { test, expect, _electron as electron } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { ELECTRON, ROOT, makeSandbox, ALPHA } from './helpers';

const APP = join(ROOT, 'windows', 'app');
const BAT = join(ROOT, 'Start LiveryBuilder.bat');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test('the batch file downloads the matching, checksummed Electron runtime and starts windows\\app', () => {
  const bat = readFileSync(BAT, 'utf8');
  expect(bat.includes('\r\n')).toBe(true);
  expect(bat.replace(/\r\n/g, '').includes('\n')).toBe(false); // CRLF only: cmd.exe labels need it
  const version = JSON.parse(readFileSync(join(ROOT, 'node_modules/electron/package.json'), 'utf8')).version;
  expect(bat).toContain(`set "ELECTRON_VERSION=${version}"`);
  expect(bat).toContain('cd1ab0d49c2f76838c0c9ff75afefb4d9d85ca59036691932bf35be8eceba98b');
  expect(bat).toContain('windows\\app');
});

test('the committed Windows app matches the current build', () => {
  const built = files(join(ROOT, 'out')).map((f) => relative(join(ROOT, 'out'), f)).sort();
  const committed = files(join(APP, 'out')).map((f) => relative(join(APP, 'out'), f)).sort();
  expect(committed).toEqual(built);
  for (const f of built) expect(readFileSync(join(APP, 'out', f)).equals(readFileSync(join(ROOT, 'out', f))), f).toBe(true);
  const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
  expect(pkg.main).toBe('out/main/index.js');
});

test('the Windows app runs on its own (no node_modules) and reads templates', async () => {
  const copy = join(mkdtempSync(join(tmpdir(), 'winapp-')), 'app');
  cpSync(APP, copy, { recursive: true });
  expect(existsSync(join(copy, 'node_modules'))).toBe(false);
  const sb = makeSandbox();
  const app = await electron.launch({ executablePath: ELECTRON, args: [copy, '--no-sandbox'], env: { ...process.env, ...sb.env, LIVERY_TEST: '1' } as Record<string, string> });
  try {
    const page = await app.firstWindow();
    await expect.poll(() => page.title()).toBe('LMU Livery Builder');
    const source = await page.evaluate(async (f) => {
      try { return (await window.lmu.openTemplate(f)).source; } catch (e) { return `ERR ${(e as Error).message}`; }
    }, ALPHA);
    expect(source).toBe('mask');
  } finally { await app.close(); }
});
