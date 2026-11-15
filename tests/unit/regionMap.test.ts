import { describe, it, expect } from 'vitest';
import { paintRegion } from '../../src/renderer/export/regionMap';

describe('paintRegion', () => {
  it('colours pixels where the item is at least half opaque', () => {
    const region = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const item = new Uint8ClampedArray([9, 9, 9, 255, 9, 9, 9, 100, 9, 9, 9, 128]);
    paintRegion(region, item, [255, 0, 0]);
    expect(Array.from(region)).toEqual([255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255]);
  });
});
