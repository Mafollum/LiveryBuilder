import { describe, it, expect } from 'vitest';
import { extractPanelData, isMaskLayerName, isWireLayerName } from '../../src/main/templates/panelMap';
import { makeTemplate } from '../fixtures/makeTemplate';

const LEVELS = { shadowInput: 0, highlightInput: 255, shadowOutput: 10, highlightOutput: 210, midtoneInput: 1 };
const at = (p: Uint8Array, w: number, x: number, y: number) => p[y * w + x];
const sum = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

describe('layer names', () => {
  it.each(['Mask(Disable for export)', 'Maks(Disable for export)', 'Mask - Disable for export', 'Mask (Disable for export)', 'Mask(Disable For Export)'])(
    'mask: %s', (n) => expect(isMaskLayerName(n)).toBe(true));
  it.each(['Car Stickers', 'Region', 'Wireframe'])('not mask: %s', (n) => expect(isMaskLayerName(n)).toBe(false));
  it.each(['Wireframe', 'Wire', 'WIRE', 'wire', 'UVW', 'Body_UV', 'WireEVO'])('wire: %s', (n) => expect(isWireLayerName(n)).toBe(true));
  it.each(['Base', 'Car Stickers'])('not wire: %s', (n) => expect(isWireLayerName(n)).toBe(false));
});

describe('extractPanelData', () => {
  it('reads panels from the mask layer, plus Levels', () => {
    const d = extractPanelData(makeTemplate({ size: 256, mask: { rects: [{ x: 20, y: 30, w: 100, h: 60 }] }, levels: LEVELS }));
    expect(d.source).toBe('mask');
    expect(d.width).toBe(256);
    expect(at(d.panel, 256, 50, 50)).toBe(1);
    expect(at(d.panel, 256, 5, 5)).toBe(0);
    expect(sum(d.panel)).toBe(6000);
    expect(d.levels?.channels[0].highlightOutput).toBe(210);
  });
  it('uses the mask layer even when hidden', () => {
    const d = extractPanelData(makeTemplate({ size: 256, mask: { rects: [{ x: 20, y: 30, w: 100, h: 60 }], hidden: true } }));
    expect(sum(d.panel)).toBe(6000);
  });
  it('treats pixels outside the mask layer bounds as on the car', () => {
    const d = extractPanelData(makeTemplate({ size: 256, mask: { rects: [], layerRect: { x: 10, y: 10, w: 200, h: 200 } } }));
    expect(at(d.panel, 256, 5, 5)).toBe(1);
    expect(at(d.panel, 256, 220, 220)).toBe(1);
    expect(at(d.panel, 256, 100, 100)).toBe(0);
  });
  it.each([false, true])('falls back to mesh lines (opaque black background: %s)', (opaqueBlack) => {
    const d = extractPanelData(makeTemplate({ size: 256, wire: { rects: [{ x: 40, y: 40, w: 100, h: 80 }], opaqueBlack } }));
    expect(d.source).toBe('wire');
    expect(at(d.panel, 256, 60, 60)).toBe(1);
    expect(at(d.panel, 256, 100, 100)).toBe(1);
    expect(at(d.panel, 256, 10, 10)).toBe(0);
    expect(at(d.panel, 256, 200, 200)).toBe(0);
  });
  it('treats everything as panel when there is no mask and no wireframe', () => {
    const d = extractPanelData(makeTemplate({ size: 64 }));
    expect(d.source).toBe('none');
    expect(sum(d.panel)).toBe(64 * 64);
  });
  it('has no Levels when the template has none at the top level', () => {
    expect(extractPanelData(makeTemplate({ size: 64 })).levels).toBeNull();
    expect(extractPanelData(makeTemplate({ size: 64, levels: LEVELS, nestedLevelsOnly: true })).levels).toBeNull();
  });
});
