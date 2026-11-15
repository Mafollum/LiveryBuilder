import * as fs from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const PAINT_FILE = 'customskin.tga';
export const REGION_FILE = 'customskin_region.tga';

export function liveryStatus(lmuFolder: string): { folder: string; exists: boolean } {
  const folder = join(lmuFolder, 'UserData', 'Liveries');
  return { folder, exists: existsSync(join(folder, PAINT_FILE)) };
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Windows briefly refuses renames while another program (antivirus, the game) has the file open. */
const TRANSIENT = new Set(['EPERM', 'EACCES', 'EBUSY']);
const ATTEMPTS = 5;

async function renameWithRetry(fsx: typeof fs, from: string, to: string, delayMs: number): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      fsx.renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (!TRANSIENT.has(code) || attempt >= ATTEMPTS) throw e;
      await sleep(delayMs * attempt);
    }
  }
}

function quietly(f: () => void): void {
  try {
    f();
  } catch {
    // best effort clean-up; the original error matters more
  }
}

/**
 * Writes the paint and finish files into the folder as a pair. Both are written under temporary
 * names first; the old files are moved aside, the new ones moved in, and on any failure the old
 * pair is put back — so the game never sees a half-written file or a mismatched pair.
 */
export async function writeLiveryFiles(
  folder: string,
  paint: Uint8Array,
  region: Uint8Array,
  opts: { backup: boolean; now?: Date; retryDelayMs?: number },
  fsx: typeof fs = fs,
): Promise<void> {
  const delay = opts.retryDelayMs ?? 100;
  fsx.mkdirSync(folder, { recursive: true });
  if (opts.backup) {
    const s = stamp(opts.now ?? new Date());
    for (const [file, backup] of [[PAINT_FILE, `customskin_backup_${s}.tga`], [REGION_FILE, `customskin_region_backup_${s}.tga`]]) {
      if (fsx.existsSync(join(folder, file))) fsx.copyFileSync(join(folder, file), join(folder, backup));
    }
  }
  const files = [
    { target: join(folder, PAINT_FILE), bytes: paint },
    { target: join(folder, REGION_FILE), bytes: region },
  ].map((f) => ({ ...f, tmp: `${f.target}.tmp-${process.pid}`, prev: `${f.target}.prev-${process.pid}`, movedAside: false, placed: false }));

  const cleanTemps = () => files.forEach((f) => quietly(() => fsx.existsSync(f.tmp) && fsx.unlinkSync(f.tmp)));
  try {
    for (const f of files) fsx.writeFileSync(f.tmp, f.bytes);
    for (const f of files) {
      if (fsx.existsSync(f.target)) {
        await renameWithRetry(fsx, f.target, f.prev, delay);
        f.movedAside = true;
      }
    }
    for (const f of files) {
      await renameWithRetry(fsx, f.tmp, f.target, delay);
      f.placed = true;
    }
  } catch (e) {
    // put the old pair back
    for (const f of files) {
      if (f.placed && !f.movedAside) quietly(() => fsx.unlinkSync(f.target));
      if (f.movedAside) quietly(() => fsx.renameSync(f.prev, f.target));
    }
    cleanTemps();
    throw e;
  }
  for (const f of files) if (f.movedAside) quietly(() => fsx.unlinkSync(f.prev));
}

export function describeWriteError(e: NodeJS.ErrnoException): string {
  switch (e.code) {
    case 'EPERM':
    case 'EACCES':
      return "Windows didn't allow writing to the game folder. If the game is showing this livery, leave the showroom and try again.";
    case 'EBUSY':
      return 'The game is using the file right now. Leave the showroom or close the game, then try again.';
    case 'ENOSPC':
      return 'The disk is full.';
    case 'ENOTDIR':
    case 'EEXIST':
      return "The game's Liveries folder couldn't be used: something else with that name is in the way.";
    default:
      return `Something went wrong (${e.code ?? e.message}).`;
  }
}
