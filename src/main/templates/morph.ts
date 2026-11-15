/** Binary morphology on 0/1 maps with a 4-neighbour (cross) structuring element. */

export function dilate4(m: Uint8Array, w: number, h: number, iterations: number): Uint8Array {
  let src = m;
  for (let it = 0; it < iterations; it++) {
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (src[i] || (x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) dst[i] = 1;
      }
    }
    src = dst;
  }
  return src === m ? m.slice() : src;
}

/** Erosion; pixels outside the image count as 0. */
export function erode4(m: Uint8Array, w: number, h: number, iterations: number): Uint8Array {
  let src = m;
  for (let it = 0; it < iterations; it++) {
    const dst = new Uint8Array(src.length);
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        if (src[i] && src[i - 1] && src[i + 1] && src[i - w] && src[i + w]) dst[i] = 1;
      }
    }
    src = dst;
  }
  return src === m ? m.slice() : src;
}

/** Marks every free pixel reachable (4-connectivity) from a free pixel on the image border. */
export function floodFromBorder(free: Uint8Array, w: number, h: number): Uint8Array {
  const reached = new Uint8Array(free.length);
  const queue = new Int32Array(free.length);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (free[i] && !reached[i]) {
      reached[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < (h - 1) * w) push(i + w);
  }
  return reached;
}
