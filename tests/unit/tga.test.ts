import { describe, it, expect } from 'vitest';
import { encodeTga32, decodeTga32 } from '@shared/tga';

const FOOTER = [0, 0, 0, 0, 0, 0, 0, 0, ...Array.from('TRUEVISION-XFILE.').map((c) => c.charCodeAt(0)), 0];

function twoByTwo(): Uint8Array {
  return new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, // top row: red, green
    0, 0, 255, 255, 255, 255, 255, 255, // bottom row: blue, white
  ]);
}

describe('encodeTga32', () => {
  it('writes header, bottom-up BGRA pixels and TGA 2.0 footer', () => {
    const out = encodeTga32(twoByTwo(), 2, 2);
    expect(out.length).toBe(60);
    expect(Array.from(out.slice(0, 18))).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 32, 8]);
    expect(Array.from(out.slice(18, 34))).toEqual([255, 0, 0, 255, 255, 255, 255, 255, 0, 0, 255, 255, 0, 255, 0, 255]);
    expect(Array.from(out.slice(34))).toEqual(FOOTER);
  });
  it('matches the game file size and header at 4096x4096', () => {
    const out = encodeTga32(new Uint8Array(4096 * 4096 * 4), 4096, 4096);
    expect(out.length).toBe(67108908);
    expect(Array.from(out.slice(0, 18))).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10, 0, 0x10, 0x20, 0x08]);
  });
});

describe('decodeTga32', () => {
  it('round-trips encodeTga32', () => {
    const img = twoByTwo();
    const back = decodeTga32(encodeTga32(img, 2, 2));
    expect(back.width).toBe(2);
    expect(back.height).toBe(2);
    expect(Array.from(back.rgba)).toEqual(Array.from(img));
  });
});
