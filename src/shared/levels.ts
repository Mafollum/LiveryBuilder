import type { LevelsChannel, LevelsSettings } from './types';

/** Photoshop-style Levels for one channel as a 256-entry lookup table. */
export function buildLevelsLut(ch: LevelsChannel): Uint8Array {
  const lut = new Uint8Array(256);
  const range = Math.max(1, ch.highlightInput - ch.shadowInput);
  const gamma = ch.midtoneInput > 0 ? ch.midtoneInput : 1;
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - ch.shadowInput) / range));
    const out = ch.shadowOutput + Math.pow(t, 1 / gamma) * (ch.highlightOutput - ch.shadowOutput);
    lut[v] = Math.min(255, Math.max(0, Math.round(out)));
  }
  return lut;
}

/** In place on RGBA data. Per-channel tables first (R, G, B), then the master table. Alpha untouched. */
export function applyLevels(rgba: Uint8Array | Uint8ClampedArray, levels: LevelsSettings | null): void {
  if (!levels || levels.channels.length === 0) return;
  const identity = buildIdentity();
  const master = levels.channels[0] ? buildLevelsLut(levels.channels[0]) : identity;
  const per = [1, 2, 3].map((i) => (levels.channels[i] ? buildLevelsLut(levels.channels[i]) : identity));
  const combined = per.map((lut) => {
    const c = new Uint8Array(256);
    for (let v = 0; v < 256; v++) c[v] = master[lut[v]];
    return c;
  });
  const [r, g, b] = combined;
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = r[rgba[i]];
    rgba[i + 1] = g[rgba[i + 1]];
    rgba[i + 2] = b[rgba[i + 2]];
  }
}

function buildIdentity(): Uint8Array {
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) lut[v] = v;
  return lut;
}
