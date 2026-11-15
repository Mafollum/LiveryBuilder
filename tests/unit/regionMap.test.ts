import { describe, it, expect } from 'vitest';
import { paintRegion, paintRegionAt } from '../../src/renderer/export/regionMap';

describe('paintRegion', () => {
  it('colours pixels where the item is at least half opaque', () => {
    const region = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const item = new Uint8ClampedArray([9, 9, 9, 255, 9, 9, 9, 100, 9, 9, 9, 128]);
    paintRegion(region, item, [255, 0, 0]);
    expect(Array.from(region)).toEqual([255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
  });
});

describe('paintRegionAt', () => {
  it('paints an item rectangle placed at an offset in the full region', () => {
    const W = 4;
    const region = new Uint8ClampedArray(W * 3 * 4);
    for (let i = 3; i < region.length; i += 4) region[i] = 255;
    // a 2x1 item at (1,2): first pixel opaque, second transparent
    const item = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0]);
    paintRegionAt(region, W, item, 1, 2, 2, 1, [255, 255, 255]);
    const px = (x: number, y: number) => Array.from(region.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));
    expect(px(1, 2)).toEqual([255, 255, 255, 255]);
    expect(px(2, 2)).toEqual([0, 0, 0, 255]);
    expect(px(0, 0)).toEqual([0, 0, 0, 255]);
  });
});
