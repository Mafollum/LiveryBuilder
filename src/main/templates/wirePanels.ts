import { dilate4, erode4, floodFromBorder } from './morph';

const LINE_ALPHA = 32;
const LINE_LUMA = 40;
const LINE_THICKEN = 2;
const SPECK_OPENING = 3;

/** Rebuilds panel shapes from a wireframe layer: every area enclosed by mesh lines is on the car. */
export function panelsFromWire(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const n = w * h;
  let line: Uint8Array = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const luma = Math.floor((3 * rgba[p] + 6 * rgba[p + 1] + rgba[p + 2]) / 10);
    if (rgba[p + 3] > LINE_ALPHA && luma > LINE_LUMA) line[i] = 1;
  }
  line = dilate4(line, w, h, LINE_THICKEN);
  const free = new Uint8Array(n);
  for (let i = 0; i < n; i++) free[i] = line[i] ? 0 : 1;
  const outside = floodFromBorder(free, w, h);
  const panel = new Uint8Array(n);
  for (let i = 0; i < n; i++) panel[i] = outside[i] ? 0 : 1;
  return dilate4(erode4(panel, w, h, SPECK_OPENING), w, h, SPECK_OPENING);
}
