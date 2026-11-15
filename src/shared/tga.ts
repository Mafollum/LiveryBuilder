const FOOTER_SIGNATURE = 'TRUEVISION-XFILE.';
const HEADER_SIZE = 18;
const FOOTER_SIZE = 26;

/** Uncompressed 32-bit TGA (type 2), bottom-left origin, BGRA, with TGA 2.0 footer — the format LMU expects. */
export function encodeTga32(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error('encodeTga32: pixel buffer size mismatch');
  const out = new Uint8Array(HEADER_SIZE + width * height * 4 + FOOTER_SIZE);
  out[2] = 2; // uncompressed true colour
  out[12] = width & 0xff;
  out[13] = (width >> 8) & 0xff;
  out[14] = height & 0xff;
  out[15] = (height >> 8) & 0xff;
  out[16] = 32;
  out[17] = 0x08; // 8 alpha bits, bottom-left origin
  let o = HEADER_SIZE;
  for (let y = height - 1; y >= 0; y--) {
    let i = y * width * 4;
    for (let x = 0; x < width; x++, i += 4, o += 4) {
      out[o] = rgba[i + 2];
      out[o + 1] = rgba[i + 1];
      out[o + 2] = rgba[i];
      out[o + 3] = rgba[i + 3];
    }
  }
  o += 8; // extension + developer area offsets: zero
  for (let k = 0; k < FOOTER_SIGNATURE.length; k++) out[o + k] = FOOTER_SIGNATURE.charCodeAt(k);
  return out;
}

/** Decodes the files written by encodeTga32 (type 2, 32 bpp, either origin). */
export function decodeTga32(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  if (bytes[2] !== 2 || bytes[16] !== 32) throw new Error('decodeTga32: unsupported TGA');
  const width = bytes[12] | (bytes[13] << 8);
  const height = bytes[14] | (bytes[15] << 8);
  const topDown = (bytes[17] & 0x20) !== 0;
  const rgba = new Uint8Array(width * height * 4);
  let s = HEADER_SIZE + bytes[0];
  for (let row = 0; row < height; row++) {
    const y = topDown ? row : height - 1 - row;
    let d = y * width * 4;
    for (let x = 0; x < width; x++, s += 4, d += 4) {
      rgba[d] = bytes[s + 2];
      rgba[d + 1] = bytes[s + 1];
      rgba[d + 2] = bytes[s];
      rgba[d + 3] = bytes[s + 3];
    }
  }
  return { width, height, rgba };
}
