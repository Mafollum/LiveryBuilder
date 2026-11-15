import { writePsdUint8Array, initializeCanvas, type Psd, type Layer } from 'ag-psd';
import type { LevelsChannel } from '../../src/shared/types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface TemplateOptions {
  size: number;
  mask?: { rects: Rect[]; hidden?: boolean; layerRect?: Rect };
  wire?: { rects: Rect[]; opaqueBlack?: boolean };
  levels?: LevelsChannel;
  nestedLevelsOnly?: boolean;
}

let initialized = false;
function init(): void {
  if (initialized) return;
  initializeCanvas(
    () => { throw new Error('canvas not available'); },
    (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
  );
  initialized = true;
}

function solid(w: number, h: number, rgba: [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width: w, height: h, data } as ImageData;
}

/** Writes a small LMU-like template PSD: base, optional Levels, mask layer and/or wireframe. */
export function makeTemplate(opts: TemplateOptions): Uint8Array {
  init();
  const S = opts.size;
  const children: Layer[] = [{ name: 'Base', left: 0, top: 0, imageData: solid(S, S, [128, 128, 128, 255]) }];
  if (opts.levels) {
    const levelsLayer: Layer = { name: 'Levels 1', adjustment: { type: 'levels', channels: [opts.levels] } } as Layer;
    if (opts.nestedLevelsOnly) children.push({ name: 'Group', opened: true, children: [levelsLayer] });
    else children.push(levelsLayer);
  }
  if (opts.mask) {
    const lr = opts.mask.layerRect ?? { x: 0, y: 0, w: S, h: S };
    const maskImg = solid(S, S, [255, 255, 255, 255]);
    for (const r of opts.mask.rects)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) maskImg.data.set([0, 0, 0, 255], (y * S + x) * 4);
    children.push({
      name: 'Mask(Disable for export)',
      hidden: !!opts.mask.hidden,
      left: lr.x,
      top: lr.y,
      imageData: solid(lr.w, lr.h, [0, 0, 0, 255]),
      mask: { left: 0, top: 0, right: S, bottom: S, defaultColor: 0, imageData: maskImg },
    });
  }
  if (opts.wire) {
    const img = solid(S, S, opts.wire.opaqueBlack ? [0, 0, 0, 255] : [0, 0, 0, 0]);
    const white = (x: number, y: number) => img.data.set([255, 255, 255, 255], (y * S + x) * 4);
    for (const r of opts.wire.rects) {
      for (let x = r.x; x <= r.x + r.w; x++) { white(x, r.y); white(x, r.y + r.h); }
      for (let y = r.y; y <= r.y + r.h; y++) { white(r.x, y); white(r.x + r.w, y); }
    }
    children.push({ name: 'Wireframe', hidden: true, left: 0, top: 0, imageData: img });
  }
  children.push({ name: 'Region', hidden: true, opened: false, children: [{ name: 'Region 1', left: 0, top: 0, imageData: solid(S, S, [255, 0, 0, 255]) }] });
  const psd: Psd = { width: S, height: S, children };
  return writePsdUint8Array(psd);
}
