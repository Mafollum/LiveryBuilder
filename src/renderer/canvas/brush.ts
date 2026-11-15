import type { BrushItem, BrushStroke } from '../../shared/types';

export interface Bounds { x: number; y: number; w: number; h: number }

/** Softness actually used: "soft" brushes are always at least half soft. */
const softnessOf = (s: BrushStroke) => (s.kind === 'soft' ? 0.5 + 0.5 * s.softness : s.kind === 'hard' || !s.kind ? s.softness : 0);
/** Extra margin around a stroke for its blur. */
const blurOf = (s: BrushStroke) => {
  const soft = softnessOf(s);
  return soft > 0 ? (soft * s.size) / 4 : 0;
};

export function strokeBounds(s: BrushStroke): Bounds | null {
  if (s.points.length < 2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < s.points.length; i += 2) {
    minX = Math.min(minX, s.points[i]);
    maxX = Math.max(maxX, s.points[i]);
    minY = Math.min(minY, s.points[i + 1]);
    maxY = Math.max(maxY, s.points[i + 1]);
  }
  const m = s.size * 0.75 + blurOf(s) * 3 + 2;
  return { x: Math.floor(minX - m), y: Math.floor(minY - m), w: Math.ceil(maxX - minX + 2 * m), h: Math.ceil(maxY - minY + 2 * m) };
}

/** Area covered by the paint strokes, in the brush item's own coordinates (not clipped). */
export function brushLocalBounds(strokes: BrushStroke[]): Bounds | null {
  let b: Bounds | null = null;
  for (const s of strokes) {
    if (s.mode !== 'paint') continue;
    const sb = strokeBounds(s);
    if (!sb) continue;
    if (!b) b = sb;
    else {
      const x = Math.min(b.x, sb.x), y = Math.min(b.y, sb.y);
      b = { x, y, w: Math.max(b.x + b.w, sb.x + sb.w) - x, h: Math.max(b.y + b.h, sb.y + sb.h) - y };
    }
  }
  return b;
}

/** Deterministic random numbers, so a stroke always looks the same when it is redrawn. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s: BrushStroke) => {
  let h = 2166136261;
  for (let i = 0; i < Math.min(s.points.length, 16); i++) h = Math.imul(h ^ Math.round(s.points[i] * 10), 16777619);
  return (h ^ s.points.length) >>> 0;
};
/** Grain value 0..1 for a texture position (chalk). */
const grain = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Calls f at points every `step` px along the stroke's path. */
function alongPath(pts: number[], step: number, f: (x: number, y: number) => void): void {
  f(pts[0], pts[1]);
  let carry = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    for (; d <= len; d += step) f(x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len);
    carry = len - (d - step);
  }
}

function polyline(sc: CanvasRenderingContext2D, pts: number[]): void {
  sc.beginPath();
  sc.moveTo(pts[0], pts[1]);
  if (pts.length === 2) sc.lineTo(pts[0] + 0.01, pts[1]);
  for (let i = 2; i < pts.length; i += 2) sc.lineTo(pts[i], pts[i + 1]);
  sc.stroke();
}

/** Draws the stroke's shape (full strength) into the scratch canvas, in the scratch's coordinates. */
function drawShape(sc: CanvasRenderingContext2D, s: BrushStroke, pts: number[], ox: number, oy: number): void {
  const size = s.size;
  sc.strokeStyle = s.colour;
  sc.fillStyle = s.colour;
  switch (s.kind ?? 'hard') {
    case 'hard':
    case 'soft': {
      const soft = softnessOf(s);
      const blur = blurOf(s);
      sc.filter = blur > 0 ? `blur(${blur}px)` : 'none';
      sc.lineCap = 'round';
      sc.lineJoin = 'round';
      sc.lineWidth = size * (1 - 0.5 * soft);
      polyline(sc, pts);
      sc.filter = 'none';
      break;
    }
    case 'pencil': {
      sc.lineCap = 'round';
      sc.lineJoin = 'round';
      sc.lineWidth = size;
      polyline(sc, pts);
      // crisp: every pixel fully on or off
      const img = sc.getImageData(0, 0, sc.canvas.width, sc.canvas.height);
      const d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
      sc.putImageData(img, 0, 0);
      break;
    }
    case 'marker':
      sc.lineCap = 'square';
      sc.lineJoin = 'miter';
      sc.lineWidth = size;
      polyline(sc, pts);
      break;
    case 'calligraphy':
      // a flat nib at 45°: thin when moving along it, thick when moving across it
      alongPath(pts, 0.75, (x, y) => {
        sc.save();
        sc.translate(x, y);
        sc.rotate(Math.PI / 4);
        sc.fillRect(-size / 2, -size * 0.075, size, size * 0.15);
        sc.restore();
      });
      break;
    case 'spray': {
      const rnd = prng(seedOf(s));
      const dot = Math.max(0.7, size / 40);
      alongPath(pts, Math.max(1, size / 4), (x, y) => {
        for (let k = 0; k < Math.max(3, Math.round(size / 2)); k++) {
          const r = (size / 2) * Math.sqrt(rnd());
          const a = rnd() * Math.PI * 2;
          sc.beginPath();
          sc.arc(x + r * Math.cos(a), y + r * Math.sin(a), dot, 0, Math.PI * 2);
          sc.fill();
        }
      });
      break;
    }
    case 'airbrush': {
      // soft dabs that build up where they overlap
      const r = size / 2;
      const [cr, cg, cb] = hexRgb(s.colour);
      alongPath(pts, Math.max(1, size / 10), (x, y) => {
        const g = sc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},0.12)`);
        g.addColorStop(Math.min(0.95, 0.3 + 0.6 * (1 - s.softness)), `rgba(${cr},${cg},${cb},0.06)`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        sc.fillStyle = g;
        sc.fillRect(x - r, y - r, size, size);
      });
      break;
    }
    case 'chalk': {
      sc.lineCap = 'round';
      sc.lineJoin = 'round';
      sc.lineWidth = size;
      polyline(sc, pts);
      // grainy, like chalk on a rough surface (grain fixed to the texture, so it never "swims")
      const img = sc.getImageData(0, 0, sc.canvas.width, sc.canvas.height);
      const d = img.data;
      const w = sc.canvas.width;
      for (let i = 3, p = 0; i < d.length; i += 4, p++) {
        if (!d[i]) continue;
        const g = grain((p % w) + ox, Math.floor(p / w) + oy);
        d[i] = g > 0.4 ? d[i] : Math.round(d[i] * g * 0.5);
      }
      sc.putImageData(img, 0, 0);
      break;
    }
  }
}

function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

/** Draws one stroke with its brush type, composited with the stroke's opacity (or erasing). */
export function drawStroke(ctx: CanvasRenderingContext2D, s: BrushStroke): void {
  const b = strokeBounds(s);
  if (!b) return;
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, b.w);
  scratch.height = Math.max(1, b.h);
  const sc = scratch.getContext('2d', { willReadFrequently: s.kind === 'pencil' || s.kind === 'chalk' })!;
  const pts = s.points.map((v, i) => v - (i % 2 === 0 ? b.x : b.y));
  drawShape(sc, s, pts, b.x, b.y);
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.globalCompositeOperation = s.mode === 'erase' ? 'destination-out' : 'source-over';
  ctx.drawImage(scratch, b.x, b.y);
  ctx.restore();
}

const MAX_SIDE = 8192;

export interface BrushImage { canvas: HTMLCanvasElement; x: number; y: number }
interface Entry { image: BrushImage; bounds: Bounds; strokes: BrushStroke[] }

const inside = (inner: Bounds, outer: Bounds) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/**
 * One canvas per brush item, just big enough for its paint, in the item's own coordinates
 * (so moved, flipped or rotated brush items keep working). Redrawn incrementally while strokes
 * are only appended inside the current area; redrawn fully otherwise (e.g. after undo).
 */
export class BrushCache {
  private entries = new Map<string, Entry>();

  get(item: BrushItem): BrushImage | null {
    const bounds = brushLocalBounds(item.strokes);
    if (!bounds) {
      this.entries.delete(item.id);
      return null;
    }
    let e = this.entries.get(item.id);
    if (e && e.strokes === item.strokes) return e.image;
    const prev = e?.strokes ?? [];
    const appended = !!e && prev.length <= item.strokes.length && prev.every((s, i) => item.strokes[i] === s) && inside(bounds, e.bounds);
    if (!appended) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(MAX_SIDE, Math.max(1, bounds.w));
      canvas.height = Math.min(MAX_SIDE, Math.max(1, bounds.h));
      e = { image: { canvas, x: bounds.x, y: bounds.y }, bounds, strokes: [] };
      this.entries.set(item.id, e);
    }
    const ctx = e!.image.canvas.getContext('2d')!;
    ctx.save();
    ctx.translate(-e!.image.x, -e!.image.y);
    for (let i = appended ? prev.length : 0; i < item.strokes.length; i++) drawStroke(ctx, item.strokes[i]);
    ctx.restore();
    e!.strokes = item.strokes;
    return e!.image;
  }

  /** Forgets brush images of items that are no longer in the project (they are rebuilt on undo). */
  prune(liveIds: Set<string>): void {
    for (const id of this.entries.keys()) if (!liveIds.has(id)) this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }
}
