import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { launchApp, ELECTRON, MAIN } from './helpers';

test('window opens with title', async () => {
  const { app, page } = await launchApp();
  try {
    await expect.poll(() => page.title()).toBe('LMU Livery Builder');
  } finally {
    await app.close();
  }
});

test('--smoke-test exits 0', async () => {
  const code = await new Promise<number | null>((resolveExit, reject) => {
    const child = spawn(ELECTRON, [MAIN, '--smoke-test', '--no-sandbox'], { stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('smoke test did not exit within 30 s')); }, 30_000);
    child.on('exit', (c) => { clearTimeout(timer); resolveExit(c); });
  });
  expect(code).toBe(0);
});
