import type { BrushItem, BrushStroke } from '../../shared/types';

export interface Bounds { x: number; y: number; w: number; h: number }

/** Extra margin around a stroke for its blur. */
const blurOf = (s: BrushStroke) => (s.softness > 0 ? (s.softness * s.size) / 4 : 0);

export function strokeBounds(s: BrushStroke): Bounds | null {
  if (s.points.length < 2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < s.points.length; i += 2) {
    minX = Math.min(minX, s.points[i]);
    maxX = Math.max(maxX, s.points[i]);
    minY = Math.min(minY, s.points[i + 1]);
    maxY = Math.max(maxY, s.points[i + 1]);
  }
  const m = s.size / 2 + blurOf(s) * 3 + 2;
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

/** Draws one stroke: a round polyline (blurred by softness), composited with the stroke's opacity. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: BrushStroke): void {
  const b = strokeBounds(s);
  if (!b) return;
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, b.w);
  scratch.height = Math.max(1, b.h);
  const sc = scratch.getContext('2d')!;
  const blur = blurOf(s);
  sc.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  sc.strokeStyle = s.colour;
  sc.lineCap = 'round';
  sc.lineJoin = 'round';
  sc.lineWidth = s.size * (1 - 0.5 * s.softness);
  sc.beginPath();
  sc.moveTo(s.points[0] - b.x, s.points[1] - b.y);
  if (s.points.length === 2) sc.lineTo(s.points[0] - b.x + 0.01, s.points[1] - b.y);
  for (let i = 2; i < s.points.length; i += 2) sc.lineTo(s.points[i] - b.x, s.points[i + 1] - b.y);
  sc.stroke();
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
