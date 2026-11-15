import * as ort from 'onnxruntime-web/wasm';

const SIZE = 320; // U²-Net input size
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  session ??= window.lmu.loadBackgroundModel().then(({ model, wasm }) => {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = wasm;
    return ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  });
  session.catch(() => {
    session = null;
  });
  return session;
}

/**
 * Finds the main subject of an image with U²-Net (small) and returns a per-pixel opacity mask
 * (w×h, 0 = background, 255 = subject). Runs fully offline.
 */
export async function subjectMask(image: CanvasImageSource, w: number, h: number): Promise<Uint8ClampedArray> {
  const s = await getSession();
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let p = 0; p < SIZE * SIZE; p++)
    for (let k = 0; k < 3; k++) input[k * SIZE * SIZE + p] = (px[p * 4 + k] / max - MEAN[k]) / STD[k];
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const pred = out[s.outputNames[0]].data as Float32Array;
  let lo = Infinity, hi = -Infinity;
  for (const v of pred) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const small = ctx.createImageData(SIZE, SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) {
    const v = Math.round(((pred[p] - lo) / (hi - lo || 1)) * 255);
    small.data[p * 4] = small.data[p * 4 + 1] = small.data[p * 4 + 2] = v;
    small.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(small, 0, 0);
  // scale the mask back up to the image size
  const big = document.createElement('canvas');
  big.width = w;
  big.height = h;
  const bctx = big.getContext('2d', { willReadFrequently: true })!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(c, 0, 0, w, h);
  const m = bctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) mask[p] = m[p * 4];
  return mask;
}
