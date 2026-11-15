import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { fixedLabel, isFixedLayerName } from '../../src/main/templates/fixedElements';
import { extractPanelData } from '../../src/main/templates/panelMap';
import { makeTemplate } from '../fixtures/makeTemplate';

describe('fixed element names', () => {
  it.each([
    ["Number Plates (Don't Move)", 'Number plates'],
    ['Nimber Plates (Don\'t Move)', 'Number plates'],
    ["Numplate(Don't Move)", 'Number plates'],
    ["Number Board(Don't Move)", 'Number plates'],
    ['Class Stickers', 'Class stickers'],
    ['Class Stickers copy', 'Class stickers'],
    ['Class icon', 'Class stickers'],
    ['Car Stickers', 'Car stickers'],
    ['Car Icons', 'Car stickers'],
    ['Display Panel Position', 'Position display'],
    ['Dsiplay Panel Position', 'Position display'],
    ['banner', 'Windscreen banner'],
    ['Sponsors', 'Series stickers'],
    ['Decals', 'Series stickers'],
    ['Clamp', 'Clamps'],
    ['T Cam', 'TV camera'],
    ['Door Hinges', 'Door hinges'],
  ])('%s → %s', (name, label) => {
    expect(isFixedLayerName(name)).toBe(true);
    expect(fixedLabel(name)).toBe(label);
  });
  it.each(['Base', 'Carbon', 'Metal Plates', 'Region', 'Mask(Disable for export)', 'Wireframe', 'plastic', 'Levels 1'])('not fixed: %s', (n) =>
    expect(isFixedLayerName(n)).toBe(false));
});

describe('fixed elements from a template', () => {
  const bytes = makeTemplate({
    size: 256,
    mask: { rects: [{ x: 10, y: 10, w: 200, h: 200 }] },
    fixed: [
      { name: "Number Plates (Don't Move)", rect: { x: 40, y: 50, w: 30, h: 20 }, rgba: [255, 255, 255, 255] },
      { name: 'Class Stickers', rect: { x: 100, y: 120, w: 10, h: 10 }, rgba: [0, 0, 0, 255], overlay: [0, 200, 0] },
      { name: 'Car Stickers', rect: { x: 150, y: 150, w: 5, h: 5 }, rgba: [255, 0, 0, 255], hidden: true },
    ],
  });
  const d = extractPanelData(bytes);
  const decode = (png: Uint8Array) => PNG.sync.read(Buffer.from(png));

  it('lists them bottom to top with plain labels, positions and visibility', () => {
    expect(d.fixed!.map((f) => [f.label, f.x, f.y, f.width, f.height, f.visible])).toEqual([
      ['Number plates', 40, 50, 30, 20, true],
      ['Class stickers', 100, 120, 10, 10, true],
      ['Car stickers', 150, 150, 5, 5, false],
    ]);
  });
  it('renders their pixels with effects applied', () => {
    const plate = decode(d.fixed![0].png);
    expect([plate.width, plate.height]).toEqual([30, 20]);
    expect([...plate.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
    expect([...decode(d.fixed![1].png).data.subarray(0, 4)]).toEqual([0, 200, 0, 255]);
  });
});
