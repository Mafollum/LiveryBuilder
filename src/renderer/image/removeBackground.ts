/** Default colour distance (0..441) still counted as background. */
export const DEFAULT_TOLERANCE = 40;

/** Most common border colour (quantised), i.e. the plain background's colour. */
function borderColour(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 128) return;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += d[i]; c.g += d[i + 1]; c.b += d[i + 2];
    counts.set(key, c);
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255];
}

/**
 * Removes a plain (single-colour) background: every pixel close to the border colour that is connected
 * to the image edge becomes transparent. Enclosed areas of the same colour (the white inside a logo) stay.
 * Edge pixels that are only a little different from the background are faded, so no halo remains.
 */
export function removePlainBackground(rgba: Uint8ClampedArray, w: number, h: number, tolerance = DEFAULT_TOLERANCE): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const [br, bg, bb] = borderColour(rgba, w, h);
  const n = w * h;
  const dist = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) dist[p] = rgba[i + 3] < 16 ? 0 : Math.hypot(rgba[i] - br, rgba[i + 1] - bg, rgba[i + 2] - bb);
  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  const push = (p: number) => {
    if (!isBg[p] && dist[p] <= tolerance) { isBg[p] = 1; queue[tail++] = p; }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  for (let p = 0; p < n; p++) {
    if (isBg[p]) { out[p * 4 + 3] = 0; continue; }
    // soften the rim: pixels touching the background and still close to its colour fade out
    const x = p % w;
    const touches = (x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) || (p >= w && isBg[p - w]) || (p < n - w && isBg[p + w]);
    if (touches && dist[p] < tolerance * 2) out[p * 4 + 3] = Math.round(out[p * 4 + 3] * ((dist[p] - tolerance) / tolerance));
  }
  return out;
}
