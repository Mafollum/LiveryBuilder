import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLiveryFiles, describeWriteError, liveryStatus } from '../../src/main/livery/writeLivery';

const PAINT = new Uint8Array([1, 2, 3]);
const REGION = new Uint8Array([4, 5]);
const err = (code: string) => Object.assign(new Error(code), { code }) as NodeJS.ErrnoException;

describe('writeLiveryFiles', () => {
  it('writes both files byte-exact, creating the folder', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'lv-')), 'UserData', 'Liveries');
    await writeLiveryFiles(dir, PAINT, REGION, { backup: false });
    expect([...readFileSync(join(dir, 'customskin.tga'))]).toEqual([1, 2, 3]);
    expect([...readFileSync(join(dir, 'customskin_region.tga'))]).toEqual([4, 5]);
    expect(readdirSync(dir).some((f) => f.includes('.tmp-'))).toBe(false);
  });

  it('keeps timestamped backups of the previous files when asked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lv-'));
    writeFileSync(join(dir, 'customskin.tga'), 'old paint');
    writeFileSync(join(dir, 'customskin_region.tga'), 'old region');
    await writeLiveryFiles(dir, PAINT, REGION, { backup: true, now: new Date(2026, 10, 15, 10, 20, 30) });
    expect(readFileSync(join(dir, 'customskin_backup_20261115-102030.tga'), 'utf8')).toBe('old paint');
    expect(readFileSync(join(dir, 'customskin_region_backup_20261115-102030.tga'), 'utf8')).toBe('old region');
    expect([...readFileSync(join(dir, 'customskin.tga'))]).toEqual([1, 2, 3]);
    expect(readdirSync(dir).some((f) => f.includes('.tmp-'))).toBe(false);
  });

  it('propagates a failing rename', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lv-'));
    const fsx = { ...fs, renameSync: () => { throw err('EBUSY'); } } as typeof fs;
    await expect(writeLiveryFiles(dir, PAINT, REGION, { backup: false, retryDelayMs: 1 }, fsx)).rejects.toThrow('EBUSY');
  });

  it('keeps the old pair when the finish file cannot be put in place', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lv-'));
    writeFileSync(join(dir, 'customskin.tga'), 'old paint');
    writeFileSync(join(dir, 'customskin_region.tga'), 'old region');
    const fsx = {
      ...fs,
      renameSync: (from: fs.PathLike, to: fs.PathLike) => {
        if (String(from).includes('.tmp-') && String(to).endsWith('customskin_region.tga')) throw err('EBUSY');
        fs.renameSync(from, to);
      },
    } as typeof fs;
    await expect(writeLiveryFiles(dir, PAINT, REGION, { backup: false, retryDelayMs: 1 }, fsx)).rejects.toThrow('EBUSY');
    expect(readFileSync(join(dir, 'customskin.tga'), 'utf8')).toBe('old paint');
    expect(readFileSync(join(dir, 'customskin_region.tga'), 'utf8')).toBe('old region');
    expect(readdirSync(dir).sort()).toEqual(['customskin.tga', 'customskin_region.tga']);
  });

  it('retries briefly when Windows refuses a rename (antivirus, file in use)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lv-'));
    let failures = 2;
    const fsx = {
      ...fs,
      renameSync: (from: fs.PathLike, to: fs.PathLike) => {
        if (failures > 0) { failures--; throw err('EPERM'); }
        fs.renameSync(from, to);
      },
    } as typeof fs;
    await writeLiveryFiles(dir, PAINT, REGION, { backup: false, retryDelayMs: 1 }, fsx);
    expect([...readFileSync(join(dir, 'customskin.tga'))]).toEqual([1, 2, 3]);
  });
});

describe('describeWriteError', () => {
  it.each([
    ['EPERM', "Windows didn't allow writing to the game folder. If the game is showing this livery, leave the showroom and try again."],
    ['EACCES', "Windows didn't allow writing to the game folder. If the game is showing this livery, leave the showroom and try again."],
    ['ENOTDIR', "The game's Liveries folder couldn't be used: something else with that name is in the way."],
    ['EEXIST', "The game's Liveries folder couldn't be used: something else with that name is in the way."],
    ['EBUSY', 'The game is using the file right now. Leave the showroom or close the game, then try again.'],
    ['ENOSPC', 'The disk is full.'],
    ['EXDEV', 'Something went wrong (EXDEV).'],
  ])('%s', (code, text) => expect(describeWriteError(err(code))).toBe(text));
});

describe('liveryStatus', () => {
  it('points at UserData/Liveries and reports existing files', () => {
    const lmu = mkdtempSync(join(tmpdir(), 'lmu-'));
    expect(liveryStatus(lmu)).toEqual({ folder: join(lmu, 'UserData', 'Liveries'), exists: false });
    mkdirSync(join(lmu, 'UserData', 'Liveries'), { recursive: true });
    writeFileSync(join(lmu, 'UserData', 'Liveries', 'customskin.tga'), 'x');
    expect(liveryStatus(lmu).exists).toBe(true);
    expect(existsSync(liveryStatus(lmu).folder)).toBe(true);
  });
});
