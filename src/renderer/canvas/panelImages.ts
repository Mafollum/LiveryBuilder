import type { PanelData } from '../../shared/types';

export const OFF_CAR_GREY = '#cdcdcd';
const VEIL_RGBA: [number, number, number, number] = [205, 205, 205, 191]; // rgba(205,205,205,0.75)

function canvasFromMask(panel: PanelData, inside: boolean, rgba: [number, number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = panel.width;
  c.height = panel.height;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(panel.width, panel.height);
  const d = img.data;
  const want = inside ? 1 : 0;
  for (let i = 0, p = 0; i < panel.panel.length; i++, p += 4) {
    if (panel.panel[i] === want) {
      d[p] = rgba[0];
      d[p + 1] = rgba[1];
      d[p + 2] = rgba[2];
      d[p + 3] = rgba[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** White where the car is, transparent elsewhere: the shape used to colour the panels. */
export function makePanelMask(panel: PanelData): HTMLCanvasElement {
  return canvasFromMask(panel, true, [255, 255, 255, 255]);
}

/** Car colour where panel = 1, transparent elsewhere. */
export function makePanelCanvas(panel: PanelData, colour: string, mask: HTMLCanvasElement = makePanelMask(panel)): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = panel.width;
  c.height = panel.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Semi-transparent grey over everything that is not on the car. */
export function makeVeilCanvas(panel: PanelData): HTMLCanvasElement {
  return canvasFromMask(panel, false, VEIL_RGBA);
}
