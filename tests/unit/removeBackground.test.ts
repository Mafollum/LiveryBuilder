import { describe, it, expect } from 'vitest';
import { removePlainBackground } from '../../src/renderer/image/removeBackground';

/** w×h white image with a red square from (x0,y0) to (x1,y1) inclusive; optional white hole at (hx,hy). */
function logo(w: number, h: number, x0: number, y0: number, x1: number, y1: number, hole?: [number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const red = x >= x0 && x <= x1 && y >= y0 && y <= y1 && !(hole && x === hole[0] && y === hole[1]);
      d.set(red ? [220, 20, 30, 255] : [252, 251, 250, 255], i);
    }
  return d;
}
const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('removePlainBackground', () => {
  it('clears the background colour connected to the edges and keeps the logo', () => {
    const out = removePlainBackground(logo(10, 10, 3, 3, 6, 6), 10, 10);
    expect(alpha(out, 10, 0, 0)).toBe(0);
    expect(alpha(out, 10, 9, 9)).toBe(0);
    expect(alpha(out, 10, 2, 5)).toBe(0);
    expect(alpha(out, 10, 4, 4)).toBe(255);
    expect([...out.subarray((4 * 10 + 4) * 4, (4 * 10 + 4) * 4 + 3)]).toEqual([220, 20, 30]);
  });
  it('keeps enclosed areas of the background colour (e.g. white inside a logo)', () => {
    const out = removePlainBackground(logo(11, 11, 2, 2, 8, 8, [5, 5]), 11, 11);
    expect(alpha(out, 11, 5, 5)).toBe(255);
  });
  it('works on dark backgrounds too and respects the tolerance', () => {
    const w = 8, h = 8;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) d.set(i % 3 === 0 ? [12, 10, 14, 255] : [5, 5, 5, 255], i * 4); // noisy black
    d.set([255, 255, 0, 255], (4 * w + 4) * 4);
    const out = removePlainBackground(d, w, h);
    expect(alpha(out, w, 0, 0)).toBe(0);
    expect(alpha(out, w, 1, 0)).toBe(0);
    expect(alpha(out, w, 4, 4)).toBe(255);
    const strict = removePlainBackground(d, w, h, 2);
    expect(alpha(strict, w, 0, 0) + alpha(strict, w, 1, 0)).toBeGreaterThan(0); // noise no longer counts as background
  });
  it('does not change the input', () => {
    const d = logo(6, 6, 2, 2, 3, 3);
    removePlainBackground(d, 6, 6);
    expect(alpha(d, 6, 0, 0)).toBe(255);
  });
});
