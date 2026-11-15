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
