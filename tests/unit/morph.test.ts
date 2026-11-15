import { describe, it, expect } from 'vitest';
import { dilate4, erode4, floodFromBorder } from '../../src/main/templates/morph';

const sum = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

describe('morphology', () => {
  it('dilates a pixel into a cross, then a diamond', () => {
    const m = new Uint8Array(11 * 11);
    m[5 * 11 + 5] = 1;
    expect(sum(dilate4(m, 11, 11, 1))).toBe(5);
    expect(sum(dilate4(m, 11, 11, 2))).toBe(13);
  });
  it('erodes a 5x5 block to its 3x3 centre (outside counts as 0)', () => {
    const m = new Uint8Array(5 * 5).fill(1);
    const e = erode4(m, 5, 5, 1);
    expect(sum(e)).toBe(9);
    expect(e[2 * 5 + 2]).toBe(1);
    expect(e[0]).toBe(0);
  });
  it('flood from the border does not reach an enclosed hole', () => {
    const W = 9;
    const free = new Uint8Array(W * W).fill(1);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) free[y * W + x] = 0; // ring + hole block
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) free[y * W + x] = 1; // 3x3 hole inside the ring
    const reached = floodFromBorder(free, W, W);
    expect(reached[4 * W + 4]).toBe(0);
    expect(reached[0]).toBe(1);
    expect(reached[2 * W + 2]).toBe(0); // ring itself is not free
  });
});
