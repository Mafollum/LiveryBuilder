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

/** Area covered by the paint strokes of a brush item, clipped to the canvas. */
export function brushBounds(item: BrushItem, width: number, height: number): Bounds | null {
  let b: Bounds | null = null;
  for (const s of item.strokes) {
    if (s.mode !== 'paint') continue;
    const sb = strokeBounds(s);
    if (!sb) continue;
    if (!b) b = sb;
    else {
      const x = Math.min(b.x, sb.x), y = Math.min(b.y, sb.y);
      b = { x, y, w: Math.max(b.x + b.w, sb.x + sb.w) - x, h: Math.max(b.y + b.h, sb.y + sb.h) - y };
    }
  }
  if (!b) return null;
  const x = Math.max(0, b.x), y = Math.max(0, b.y);
  const w = Math.min(width, b.x + b.w) - x, h = Math.min(height, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
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

interface Entry { canvas: HTMLCanvasElement; strokes: BrushStroke[] }

/** One full-size canvas per brush item, redrawn incrementally while strokes are only appended. */
export class BrushCache {
  private entries = new Map<string, Entry>();

  get(item: BrushItem, width: number, height: number): HTMLCanvasElement {
    let e = this.entries.get(item.id);
    if (!e || e.canvas.width !== width || e.canvas.height !== height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      e = { canvas, strokes: [] };
      this.entries.set(item.id, e);
    }
    if (e.strokes === item.strokes) return e.canvas;
    const ctx = e.canvas.getContext('2d')!;
    const prev = e.strokes;
    const isPrefix = prev.length <= item.strokes.length && prev.every((s, i) => item.strokes[i] === s);
    if (!isPrefix) ctx.clearRect(0, 0, width, height);
    for (let i = isPrefix ? prev.length : 0; i < item.strokes.length; i++) drawStroke(ctx, item.strokes[i]);
    e.strokes = item.strokes;
    return e.canvas;
  }

  drop(id: string): void {
    this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
  }
}
