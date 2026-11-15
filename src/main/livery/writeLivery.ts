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

/**
 * Writes the paint and finish files into the folder. Each file is written under a temporary name
 * and renamed over the target, so the game never reads a half-written file.
 */
export function writeLiveryFiles(
  folder: string,
  paint: Uint8Array,
  region: Uint8Array,
  opts: { backup: boolean; now?: Date },
  fsx: typeof fs = fs,
): void {
  fsx.mkdirSync(folder, { recursive: true });
  if (opts.backup) {
    const s = stamp(opts.now ?? new Date());
    for (const [file, backup] of [[PAINT_FILE, `customskin_backup_${s}.tga`], [REGION_FILE, `customskin_region_backup_${s}.tga`]]) {
      if (fsx.existsSync(join(folder, file))) fsx.copyFileSync(join(folder, file), join(folder, backup));
    }
  }
  for (const [file, bytes] of [[PAINT_FILE, paint], [REGION_FILE, region]] as const) {
    const target = join(folder, file);
    const tmp = `${target}.tmp-${process.pid}`;
    try {
      fsx.writeFileSync(tmp, bytes);
      fsx.renameSync(tmp, target);
    } catch (e) {
      try {
        if (fsx.existsSync(tmp)) fsx.unlinkSync(tmp);
      } catch {
        // leave it; the original error matters more
      }
      throw e;
    }
  }
}

export function describeWriteError(e: NodeJS.ErrnoException): string {
  switch (e.code) {
    case 'EPERM':
    case 'EACCES':
      return "Windows didn't allow writing to the game folder.";
    case 'EBUSY':
      return 'The game is using the file right now. Leave the showroom or close the game, then try again.';
    case 'ENOSPC':
      return 'The disk is full.';
    default:
      return `Something went wrong (${e.code ?? e.message}).`;
  }
}
