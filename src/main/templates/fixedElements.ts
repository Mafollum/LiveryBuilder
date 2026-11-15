import { PNG } from 'pngjs';
import type { Layer, Psd } from 'ag-psd';
import type { FixedElement } from '../../shared/types';
import { renderLayers, trim } from './composite';

/** Template layers for the car's fixed elements: number plates, series/class stickers, position display… */
const RULES: Array<[RegExp, string]> = [
  [/numb|nimber|numplate/i, 'Number plates'],
  [/class (sticker|icon)/i, 'Class stickers'],
  [/car (sticker|icon)/i, 'Car stickers'],
  [/panel/i, 'Position display'],
  [/banner/i, 'Windscreen banner'],
  [/sponsor|decal/i, 'Series stickers'],
  [/clamp/i, 'Clamps'],
  [/t cam/i, 'TV camera'],
  [/hinge/i, 'Door hinges'],
];

export function fixedLabel(name: string): string | null {
  return RULES.find(([re]) => re.test(name))?.[1] ?? null;
}

export function isFixedLayerName(name: string): boolean {
  return fixedLabel(name) !== null;
}

function toPng(r: { w: number; h: number; data: Uint8ClampedArray }): Uint8Array {
  const png = new PNG({ width: r.w, height: r.h });
  png.data = Buffer.from(r.data.buffer, r.data.byteOffset, r.data.byteLength);
  return new Uint8Array(PNG.sync.write(png, { deflateLevel: 1, filterType: 0 }));
}

/** Renders every fixed-element top-level layer of a template (bottom to top) as a trimmed PNG. */
export function extractFixedElements(psd: Psd): FixedElement[] {
  const ctx = { patterns: psd.patterns ?? [] };
  const out: FixedElement[] = [];
  (psd.children ?? []).forEach((layer: Layer, index) => {
    const label = fixedLabel(layer.name ?? '');
    if (!label) return;
    const r = renderLayers([{ ...layer, hidden: false }], ctx);
    const t = r && trim(r);
    if (!t) return;
    out.push({ id: `${index}`, name: layer.name ?? '', label, visible: !layer.hidden, x: t.x, y: t.y, width: t.w, height: t.h, png: toPng(t) });
  });
  return out;
}
