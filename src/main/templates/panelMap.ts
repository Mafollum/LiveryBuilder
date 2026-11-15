import { readPsd, initializeCanvas, getLayerImageData, getLayerMaskImageData, type Layer } from 'ag-psd';
import type { LevelsSettings, PanelData } from '../../shared/types';
import { panelsFromWire } from './wirePanels';
import { extractFixedElements } from './fixedElements';

let canvasReady = false;
function ensureImageDataSupport(): void {
  if (canvasReady) return;
  initializeCanvas(
    () => { throw new Error('canvas not available'); },
    (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
  );
  canvasReady = true;
}

export function isMaskLayerName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n.includes('disable for export') || n.startsWith('mask') || n.startsWith('maks');
}

export function isWireLayerName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('wire') || n.includes('uvw') || n.includes('_uv');
}

function maskPanels(layer: Layer, w: number, h: number): Uint8Array {
  const img = getLayerImageData(layer);
  const mask = layer.mask && !layer.mask.disabled ? layer.mask : undefined;
  const mimg = mask ? getLayerMaskImageData(layer) : undefined;
  const lx = layer.left ?? 0;
  const ly = layer.top ?? 0;
  const mx = mask?.left ?? 0;
  const my = mask?.top ?? 0;
  const mdef = mask?.defaultColor ?? 255;
  const panel = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let alpha = 0;
      if (img) {
        const px = x - lx;
        const py = y - ly;
        if (px >= 0 && py >= 0 && px < img.width && py < img.height) alpha = img.data[(py * img.width + px) * 4 + 3];
      } else if (layer.vectorFill) alpha = 255;
      let mv = 255;
      if (mask) {
        if (mimg) {
          const px = x - mx;
          const py = y - my;
          mv = px >= 0 && py >= 0 && px < mimg.width && py < mimg.height ? mimg.data[(py * mimg.width + px) * 4] : mdef;
        } else mv = mdef;
      }
      if ((alpha * mv) / 255 < 128) panel[y * w + x] = 1;
    }
  }
  return panel;
}

function wireRgba(layer: Layer, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const img = getLayerImageData(layer);
  if (!img) return out;
  const lx = layer.left ?? 0;
  const ly = layer.top ?? 0;
  for (let py = 0; py < img.height; py++) {
    const y = py + ly;
    if (y < 0 || y >= h) continue;
    for (let px = 0; px < img.width; px++) {
      const x = px + lx;
      if (x < 0 || x >= w) continue;
      const s = (py * img.width + px) * 4;
      out.set(img.data.subarray(s, s + 4), (y * w + x) * 4);
    }
  }
  return out;
}

function topLevelLevels(layers: Layer[]): LevelsSettings | null {
  for (const l of layers) {
    const adj = l.adjustment;
    if (adj && adj.type === 'levels') {
      const pick = (c: Record<string, number | undefined> | undefined) => ({
        shadowInput: c?.shadowInput ?? 0,
        highlightInput: c?.highlightInput ?? 255,
        shadowOutput: c?.shadowOutput ?? 0,
        highlightOutput: c?.highlightOutput ?? 255,
        midtoneInput: c?.midtoneInput ?? 1,
      });
      const channels = (adj as unknown as { channels?: Array<Record<string, number>> }).channels ?? [];
      return { channels: channels.map(pick) };
    }
  }
  return null;
}

/** Reads a template PSD and returns its panel map (1 = on the car) and its top-level Levels settings. */
export function extractPanelData(psdBytes: Uint8Array): PanelData {
  ensureImageDataSupport();
  const psd = readPsd(psdBytes, { useRawData: true, skipCompositeImageData: true, skipThumbnail: true });
  const w = psd.width;
  const h = psd.height;
  const layers = psd.children ?? [];
  const levels = topLevelLevels(layers);
  const fixed = extractFixedElements(psd);
  const maskLayer = layers.find((l) => !l.children && isMaskLayerName(l.name ?? ''));
  if (maskLayer) return { width: w, height: h, panel: maskPanels(maskLayer, w, h), source: 'mask', levels, fixed };
  const wireLayer = layers.find((l) => !l.children && isWireLayerName(l.name ?? ''));
  if (wireLayer) return { width: w, height: h, panel: panelsFromWire(wireRgba(wireLayer, w, h), w, h), source: 'wire', levels, fixed };
  return { width: w, height: h, panel: new Uint8Array(w * h).fill(1), source: 'none', levels, fixed };
}
