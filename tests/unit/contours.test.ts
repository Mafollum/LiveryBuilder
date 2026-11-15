import { describe, it, expect } from 'vitest';
import { traceContours, simplifyPolyline } from '@shared/contours';
import { extractPanelData } from '../../src/main/templates/panelMap';
import { makeTemplate } from '../fixtures/makeTemplate';

function map(w: number, h: number, ones: Array<[number, number]>): Uint8Array {
  const m = new Uint8Array(w * h);
  for (const [x, y] of ones) m[y * w + x] = 1;
  return m;
}
const bbox = (loop: number[]) => {
  const xs = loop.filter((_, i) => i % 2 === 0);
  const ys = loop.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

describe('traceContours', () => {
  it('traces a 2x2 block as one loop along pixel edges', () => {
    const loops = traceContours(map(4, 4, [[1, 1], [2, 1], [1, 2], [2, 2]]), 4, 4);
    expect(loops.length).toBe(1);
    expect(bbox(loops[0])).toEqual([1, 1, 3, 3]);
  });
  it('gives one loop per separate blob', () => {
    expect(traceContours(map(6, 3, [[0, 0], [4, 1]]), 6, 3).length).toBe(2);
  });
  it('gives an extra loop for a hole', () => {
    const ones: Array<[number, number]> = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!(x === 1 && y === 1)) ones.push([x, y]);
    expect(traceContours(map(5, 5, ones), 5, 5).length).toBe(2);
  });
  it('simplifies the fixture panel rectangle to a handful of points', () => {
    const d = extractPanelData(makeTemplate({ size: 256, mask: { rects: [{ x: 20, y: 30, w: 100, h: 60 }] } }));
    const loops = traceContours(d.panel, 256, 256).map((l) => simplifyPolyline(l, 1));
    expect(loops.length).toBe(1);
    expect(loops[0].length / 2).toBeGreaterThanOrEqual(4);
    expect(loops[0].length / 2).toBeLessThanOrEqual(5);
    expect(bbox(loops[0])).toEqual([20, 30, 120, 90]);
  });
});

describe('simplifyPolyline', () => {
  it('drops collinear points', () => {
    expect(simplifyPolyline([0, 0, 1, 0, 2, 0, 2, 2], 0.5)).toEqual([0, 0, 2, 0, 2, 2]);
  });
});
