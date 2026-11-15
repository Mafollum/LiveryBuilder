import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheKey, writeCachedPanel, readCachedPanel } from '../../src/main/templates/panelCache';
import type { PanelData } from '../../src/shared/types';

function randomPanel(): PanelData {
  const panel = new Uint8Array(1024 * 1024);
  let s = 12345;
  for (let i = 0; i < panel.length; i++) { s = (s * 1103515245 + 12345) >>> 0; panel[i] = (s >>> 16) & 1; }
  return { width: 1024, height: 1024, panel, source: 'wire', levels: { channels: [{ shadowInput: 0, highlightInput: 255, shadowOutput: 10, highlightOutput: 210, midtoneInput: 1 }] } };
}

describe('panel cache', () => {
  it('round-trips a panel map', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    const data = randomPanel();
    const key = cacheKey({ fileName: 'Template_GT3_X.psd', sizeBytes: 100, mtimeMs: 5 });
    writeCachedPanel(dir, key, data);
    const back = readCachedPanel(dir, key)!;
    expect(back.width).toBe(1024);
    expect(back.height).toBe(1024);
    expect(back.source).toBe('wire');
    expect(back.levels).toEqual(data.levels);
    expect(Buffer.from(back.panel).equals(Buffer.from(data.panel))).toBe(true);
  });
  it('keys on file name, size and modification time', () => {
    const a = cacheKey({ fileName: 'a.psd', sizeBytes: 1, mtimeMs: 1 });
    expect(cacheKey({ fileName: 'a.psd', sizeBytes: 1, mtimeMs: 2 })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });
  it('returns null for a missing or corrupt entry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    expect(readCachedPanel(dir, 'nope')).toBeNull();
    mkdirSync(join(dir, 'panel-cache'), { recursive: true });
    writeFileSync(join(dir, 'panel-cache', 'bad.bin'), 'garbage');
    expect(readCachedPanel(dir, 'bad')).toBeNull();
  });
});

describe('panel cache outline', () => {
  it('round-trips the outline loops', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    const data = { ...randomPanel(), outline: [[0, 0, 4, 0, 4, 4, 0, 4]] };
    writeCachedPanel(dir, 'k', data);
    expect(readCachedPanel(dir, 'k')!.outline).toEqual([[0, 0, 4, 0, 4, 4, 0, 4]]);
  });
});

describe('panel cache fixed elements', () => {
  it('round-trips fixed element images', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    const fixed = [{ id: '3', name: 'Class Stickers', label: 'Class stickers', visible: true, x: 1, y: 2, width: 3, height: 4, png: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) }];
    writeCachedPanel(dir, 'f', { ...randomPanel(), fixed });
    const back = readCachedPanel(dir, 'f')!;
    expect(back.fixed!.length).toBe(1);
    expect(back.fixed![0]).toMatchObject({ id: '3', label: 'Class stickers', visible: true, x: 1, y: 2, width: 3, height: 4 });
    expect([...back.fixed![0].png]).toEqual([137, 80, 78, 71, 1, 2, 3]);
  });
});
