import { describe, it, expect } from 'vitest';
import type { Layer } from 'ag-psd';
import { brightnessContrastLut, compositeOver, renderLayers, type Raster } from '../../src/main/templates/composite';

const img = (w: number, h: number, px: number[]) => ({ width: w, height: h, data: new Uint8ClampedArray(Array.from({ length: w * h }, () => px).flat()) }) as unknown as ImageData;
const raster = (x: number, y: number, w: number, h: number, px: number[]): Raster => ({ x, y, w, h, data: new Uint8ClampedArray(Array.from({ length: w * h }, () => px).flat()) });
const at = (r: Raster | null, x: number, y: number) => {
  if (!r || x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return [0, 0, 0, 0];
  const i = ((y - r.y) * r.w + (x - r.x)) * 4;
  return Array.from(r.data.subarray(i, i + 4));
};
const layer = (l: Partial<Layer> & { px?: number[]; w?: number; h?: number }): Layer =>
  ({ left: 0, top: 0, blendMode: 'normal', opacity: 1, ...l, imageData: l.imageData ?? img(l.w ?? 1, l.h ?? 1, l.px ?? [0, 0, 0, 255]) }) as Layer;
const ctx = { patterns: [] };

describe('compositeOver', () => {
  it('blends a half-transparent layer over an opaque one', () => {
    const out = compositeOver(raster(0, 0, 2, 1, [255, 0, 0, 255]), raster(1, 0, 1, 1, [0, 0, 255, 128]), 'normal', 1);
    expect(at(out, 0, 0)).toEqual([255, 0, 0, 255]);
    const p = at(out, 1, 0);
    expect(Math.abs(p[0] - 127)).toBeLessThanOrEqual(1);
    expect(Math.abs(p[2] - 128)).toBeLessThanOrEqual(1);
    expect(p[3]).toBe(255);
  });
  it('grows to cover both rasters', () => {
    const out = compositeOver(raster(0, 0, 1, 1, [1, 1, 1, 255]), raster(3, 2, 1, 1, [2, 2, 2, 255]), 'normal', 1);
    expect([out.x, out.y, out.w, out.h]).toEqual([0, 0, 4, 3]);
  });
  it('darker colour keeps the darker pixel', () => {
    const out = compositeOver(raster(0, 0, 1, 1, [40, 40, 40, 255]), raster(0, 0, 1, 1, [200, 200, 200, 255]), 'darker color', 1);
    expect(at(out, 0, 0)).toEqual([40, 40, 40, 255]);
  });
});

describe('renderLayers', () => {
  it('applies the layer mask', () => {
    const l = layer({ w: 2, h: 1, px: [255, 0, 0, 255], mask: { left: 0, top: 0, right: 1, bottom: 1, defaultColor: 0, imageData: img(1, 1, [255, 255, 255, 255]) } });
    const r = renderLayers([l], ctx);
    expect(at(r, 0, 0)[3]).toBe(255);
    expect(at(r, 1, 0)[3]).toBe(0);
  });
  it('skips hidden layers', () => {
    expect(renderLayers([layer({ hidden: true })], ctx)).toBeNull();
  });
  it('colour overlay recolours but keeps the shape', () => {
    const l = layer({ w: 1, h: 1, px: [0, 0, 0, 200], effects: { solidFill: [{ enabled: true, color: { r: 255, g: 255, b: 255 }, opacity: 1, blendMode: 'normal' }] } as Layer['effects'] });
    expect(at(renderLayers([l], ctx), 0, 0)).toEqual([255, 255, 255, 200]);
  });
  it('outside stroke draws a ring around the shape', () => {
    const l = layer({ left: 2, top: 2, px: [0, 0, 0, 255], effects: { stroke: [{ enabled: true, size: { value: 1, units: 'Pixels' }, position: 'outside', color: { r: 255, g: 255, b: 255 }, opacity: 1, blendMode: 'normal', fillType: 'color' }] } as Layer['effects'] });
    const r = renderLayers([l], ctx);
    expect(at(r, 2, 2)).toEqual([0, 0, 0, 255]);
    expect(at(r, 3, 2)).toEqual([255, 255, 255, 255]);
    expect(at(r, 2, 1)).toEqual([255, 255, 255, 255]);
    expect(at(r, 4, 2)[3]).toBe(0);
  });
  it('pattern overlay tiles the pattern inside the shape', () => {
    const pattern = { id: 'p', name: 'checker', x: 2, y: 2, bounds: { x: 0, y: 0, w: 2, h: 2 }, data: img(2, 2, [0, 0, 0, 255]) };
    pattern.data.data.set([255, 255, 255, 255], 4);
    pattern.data.data.set([255, 255, 255, 255], 8);
    const l = layer({ w: 4, h: 4, px: [9, 9, 9, 255], effects: { patternOverlay: { enabled: true, pattern: { id: 'p', name: 'checker' }, opacity: 1, blendMode: 'normal', scale: 1, align: true, phase: { x: 0, y: 0 } } } as unknown as Layer['effects'] });
    const r = renderLayers([l], { patterns: [pattern as never] });
    expect(at(r, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(at(r, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(at(r, 2, 0)).toEqual([0, 0, 0, 255]);
    expect(at(r, 1, 1)).toEqual([0, 0, 0, 255]);
  });
  it('pattern overlay also works with raw pattern pixels (as stored in real templates)', () => {
    const data = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
    const pattern = { id: 'p', name: 'checker', x: 2, y: 2, bounds: { x: 0, y: 0, w: 2, h: 2 }, data };
    const l = layer({ w: 2, h: 1, px: [9, 9, 9, 255], effects: { patternOverlay: { enabled: true, pattern: { id: 'p', name: 'checker' }, opacity: 1, blendMode: 'normal', scale: 1, align: true, phase: { x: 0, y: 0 } } } as unknown as Layer['effects'] });
    const r = renderLayers([l], { patterns: [pattern as never] });
    expect(at(r, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(at(r, 1, 0)).toEqual([255, 255, 255, 255]);
  });
  it('a clipped layer only shows inside the layer below it', () => {
    const base = layer({ w: 2, h: 2, px: [0, 0, 255, 255] });
    const clipped = layer({ w: 4, h: 4, px: [255, 0, 0, 255], clipping: true });
    const r = renderLayers([base, clipped], ctx);
    expect(at(r, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(at(r, 3, 3)[3]).toBe(0);
  });
  it('group opacity and group effects apply to the whole group', () => {
    const g = { name: 'g', blendMode: 'pass through', opacity: 0.5, children: [layer({ px: [0, 0, 0, 255] })],
      effects: { solidFill: [{ enabled: true, color: { r: 0, g: 255, b: 0 }, opacity: 1, blendMode: 'normal' }] } } as unknown as Layer;
    const p = at(renderLayers([g], ctx), 0, 0);
    expect(p.slice(0, 3)).toEqual([0, 255, 0]);
    expect(Math.abs(p[3] - 128)).toBeLessThanOrEqual(1);
  });
});

describe('brightnessContrastLut (matches Photoshop as reverse-engineered by psd-tools)', () => {
  it.each([
    [0, 0], [32, 40.53], [64, 81.58], [98, 121.18], [128, 152.73], [160, 183.46], [212, 227.19], [255, 255],
  ])('modern curve, brightness 30 / contrast -15: %i → %f', (i, v) => {
    expect(Math.abs(brightnessContrastLut(30, -15, false)[i] - v)).toBeLessThanOrEqual(1);
  });
  it.each([[0, 49.05], [64, 103.45], [128, 157.85], [255, 255]])('legacy curve: %i → %f', (i, v) => {
    expect(Math.abs(brightnessContrastLut(30, -15, true)[i] - v)).toBeLessThanOrEqual(1);
  });
});
