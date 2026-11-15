/**
 * Traces the boundaries of a 0/1 map along pixel edges ("crack following").
 * Returns closed loops as flat [x0, y0, x1, y1, ...] lists in pixel-corner coordinates,
 * with points only where the direction changes.
 */
export function traceContours(panel: Uint8Array, w: number, h: number): number[][] {
  const W1 = w + 1;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? panel[y * w + x] : 0);
  // Up to two outgoing edges per vertex; value = target vertex + 1 (0 = none).
  const out = new Int32Array(W1 * (h + 1) * 2);
  const add = (from: number, to: number) => {
    const k = from * 2;
    if (out[k] === 0) out[k] = to + 1;
    else out[k + 1] = to + 1;
  };
  const starts: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!panel[y * w + x]) continue;
      const tl = y * W1 + x;
      const tr = tl + 1;
      const bl = tl + W1;
      const br = bl + 1;
      if (!at(x, y - 1)) { add(tl, tr); starts.push(tl); }
      if (!at(x + 1, y)) add(tr, br);
      if (!at(x, y + 1)) add(br, bl);
      if (!at(x - 1, y)) add(bl, tl);
    }
  }
  const loops: number[][] = [];
  const take = (v: number): number => {
    const k = v * 2;
    if (out[k]) { const t = out[k] - 1; out[k] = out[k + 1]; out[k + 1] = 0; return t; }
    return -1;
  };
  for (const s of starts) {
    if (!out[s * 2]) continue;
    const pts: number[] = [];
    let prevDx = 0;
    let prevDy = 0;
    let v = s;
    for (;;) {
      const next = take(v);
      if (next < 0) break;
      const dx = (next % W1) - (v % W1);
      const dy = Math.floor(next / W1) - Math.floor(v / W1);
      if (dx !== prevDx || dy !== prevDy) pts.push(v % W1, Math.floor(v / W1));
      prevDx = dx;
      prevDy = dy;
      v = next;
      if (v === s) break;
    }
    // the start point may sit in the middle of a straight run
    if (pts.length >= 6) {
      const n = pts.length;
      const [x0, y0, x1, y1, xl, yl] = [pts[0], pts[1], pts[2], pts[3], pts[n - 2], pts[n - 1]];
      if ((x1 - x0) * (y0 - yl) === (y1 - y0) * (x0 - xl)) pts.splice(0, 2);
    }
    if (pts.length >= 6) loops.push(pts);
  }
  return loops;
}

/** Douglas–Peucker simplification of an open polyline; first and last points are kept. */
export function simplifyPolyline(points: number[], tolerance: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = points[a * 2], ay = points[a * 2 + 1], bx = points[b * 2], by = points[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let best = -1;
    let bestD = tol2;
    for (let i = a + 1; i < b; i++) {
      const px = points[i * 2] - ax, py = points[i * 2 + 1] - ay;
      let d2: number;
      if (len2 === 0) d2 = px * px + py * py;
      else {
        const cross = px * dy - py * dx;
        d2 = (cross * cross) / len2;
      }
      if (d2 > bestD) { bestD = d2; best = i; }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const res: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) res.push(points[i * 2], points[i * 2 + 1]);
  return res;
}

/** Simplifies a closed loop (flat points, last point not repeated). */
export function simplifyLoop(loop: number[], tolerance: number): number[] {
  const closed = simplifyPolyline([...loop, loop[0], loop[1]], tolerance);
  return closed.slice(0, -2);
}
