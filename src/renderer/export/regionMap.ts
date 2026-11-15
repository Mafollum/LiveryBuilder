/** Sets the finish colour wherever the item is at least 50% opaque (alpha >= 128). Region alpha stays 255. */
export function paintRegion(region: Uint8ClampedArray, itemRgba: Uint8ClampedArray, rgb: [number, number, number]): void {
  const [r, g, b] = rgb;
  for (let i = 0; i < itemRgba.length; i += 4) {
    if (itemRgba[i + 3] >= 128) {
      region[i] = r;
      region[i + 1] = g;
      region[i + 2] = b;
    }
  }
}

/** Like paintRegion, for an item rendered only in its own rectangle (x, y, w, h) of a region that is regionWidth wide. */
export function paintRegionAt(
  region: Uint8ClampedArray,
  regionWidth: number,
  itemRgba: Uint8ClampedArray,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
): void {
  const [r, g, b] = rgb;
  for (let row = 0; row < h; row++) {
    let s = row * w * 4;
    let d = ((y + row) * regionWidth + x) * 4;
    for (let col = 0; col < w; col++, s += 4, d += 4) {
      if (itemRgba[s + 3] >= 128) {
        region[d] = r;
        region[d + 1] = g;
        region[d + 2] = b;
      }
    }
  }
}
