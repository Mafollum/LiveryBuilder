import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import type { PanelData } from '../../shared/types';

export function cacheKey(t: { fileName: string; sizeBytes: number; mtimeMs: number }): string {
  return createHash('sha1').update(`v3|${t.fileName}|${t.sizeBytes}|${t.mtimeMs}`).digest('hex');
}

const fileFor = (dir: string, key: string) => join(dir, 'panel-cache', `${key}.bin`);

function pack(panel: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(panel.length / 8));
  for (let i = 0; i < panel.length; i++) if (panel[i]) out[i >> 3] |= 1 << (i & 7);
  return out;
}

function unpack(bits: Uint8Array, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (bits[i >> 3] >> (i & 7)) & 1;
  return out;
}

/** Stores a panel map as one JSON header line followed by the zlib-compressed, bit-packed map. */
export function writeCachedPanel(dir: string, key: string, data: PanelData): void {
  const { panel, fixed, ...rest } = data;
  const meta = { ...rest, fixed: fixed?.map((f) => ({ ...f, png: Buffer.from(f.png).toString('base64') })) };
  mkdirSync(join(dir, 'panel-cache'), { recursive: true });
  const header = Buffer.from(JSON.stringify(meta) + '\n', 'utf8');
  const body = deflateSync(pack(panel));
  const target = fileFor(dir, key);
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, Buffer.concat([header, body]));
  renameSync(tmp, target);
}

export function readCachedPanel(dir: string, key: string): PanelData | null {
  const file = fileFor(dir, key);
  if (!existsSync(file)) return null;
  try {
    const buf = readFileSync(file);
    const nl = buf.indexOf(0x0a);
    if (nl < 0) return null;
    const meta = JSON.parse(buf.subarray(0, nl).toString('utf8')) as Omit<PanelData, 'panel' | 'fixed'> & {
      fixed?: Array<Omit<NonNullable<PanelData['fixed']>[number], 'png'> & { png: string }>;
    };
    if (!meta.width || !meta.height) return null;
    const bits = new Uint8Array(inflateSync(buf.subarray(nl + 1)));
    const fixed = meta.fixed?.map((f) => ({ ...f, png: new Uint8Array(Buffer.from(f.png, 'base64')) }));
    return { ...meta, fixed, panel: unpack(bits, meta.width * meta.height) };
  } catch {
    return null;
  }
}
