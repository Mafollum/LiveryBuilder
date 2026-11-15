/**
 * A small Photoshop-style compositor for template layers (straight-alpha RGBA rasters with a position).
 * Supports: visibility, opacity, layer masks, clipping, common blend modes, groups, and the layer
 * effects LMU templates use (colour overlay, pattern overlay, stroke) plus Levels/Hue-Saturation/
 * Brightness-Contrast adjustments inside groups.
 */
import { getLayerImageData, getLayerMaskImageData, type Layer, type PatternInfo } from 'ag-psd';
import { buildLevelsLut } from '../../shared/levels';

export interface Raster { x: number; y: number; w: number; h: number; data: Uint8ClampedArray }
export interface CompositeContext { patterns: PatternInfo[] }

type Blend = (s: number, d: number) => number;
const SEPARABLE: Record<string, Blend> = {
  normal: (s) => s,
  multiply: (s, d) => s * d,
  screen: (s, d) => s + d - s * d,
  overlay: (s, d) => (d <= 0.5 ? 2 * s * d : 1 - 2 * (1 - s) * (1 - d)),
  darken: (s, d) => Math.min(s, d),
  lighten: (s, d) => Math.max(s, d),
  difference: (s, d) => Math.abs(d - s),
  exclusion: (s, d) => s + d - 2 * s * d,
  'color dodge': (s, d) => (d === 0 ? 0 : s >= 1 ? 1 : Math.min(1, d / (1 - s))),
  'color burn': (s, d) => (d >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - d) / s)),
  'linear dodge': (s, d) => Math.min(1, s + d),
  'linear burn': (s, d) => Math.max(0, s + d - 1),
  'hard light': (s, d) => (s <= 0.5 ? 2 * s * d : 1 - 2 * (1 - s) * (1 - d)),
  'soft light': (s, d) => (s <= 0.5 ? d - (1 - 2 * s) * d * (1 - d) : d + (2 * s - 1) * ((d <= 0.25 ? ((16 * d - 12) * d + 4) * d : Math.sqrt(d)) - d)),
};
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;

/** Draws src over dst (either may be null) with a blend mode and extra opacity; returns a raster covering both. */
export function compositeOver(dst: Raster | null, src: Raster, blendMode: string, opacity: number, inPlace = false): Raster {
  const x0 = dst ? Math.min(dst.x, src.x) : src.x;
  const y0 = dst ? Math.min(dst.y, src.y) : src.y;
  const x1 = dst ? Math.max(dst.x + dst.w, src.x + src.w) : src.x + src.w;
  const y1 = dst ? Math.max(dst.y + dst.h, src.y + src.h) : src.y + src.h;
  const fits = !!dst && x0 === dst.x && y0 === dst.y && x1 === dst.x + dst.w && y1 === dst.y + dst.h;
  let out: Raster;
  if (inPlace && fits) out = dst!;
  else {
    out = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, data: new Uint8ClampedArray((x1 - x0) * (y1 - y0) * 4) };
    if (dst) blit(out, dst);
  }
  const sep = SEPARABLE[blendMode] ?? (blendMode === 'darker color' || blendMode === 'lighter color' ? null : SEPARABLE.normal);
  const normal = sep === SEPARABLE.normal;
  const darker = blendMode === 'darker color';
  const o = out.data;
  const s = src.data;
  const op255 = opacity / 255;
  for (let y = 0; y < src.h; y++) {
    let si = y * src.w * 4;
    let oi = ((src.y - y0 + y) * out.w + (src.x - x0)) * 4;
    for (let x = 0; x < src.w; x++, si += 4, oi += 4) {
      const sa8 = s[si + 3];
      if (sa8 === 0) continue;
      const as = sa8 * op255;
      const da8 = o[oi + 3];
      if (da8 === 0 || (as >= 1 && normal)) {
        o[oi] = s[si];
        o[oi + 1] = s[si + 1];
        o[oi + 2] = s[si + 2];
        o[oi + 3] = as >= 1 ? 255 : Math.round(as * 255);
        continue;
      }
      const ad = da8 / 255;
      const ao = as + ad * (1 - as);
      const ws = as * (1 - ad), wb = as * ad, wd = (1 - as) * ad;
      const sr = s[si] / 255, sg = s[si + 1] / 255, sb = s[si + 2] / 255;
      const dr = o[oi] / 255, dg = o[oi + 1] / 255, db = o[oi + 2] / 255;
      let br: number, bg: number, bb: number;
      if (normal) {
        br = sr; bg = sg; bb = sb;
      } else if (sep) {
        br = sep(sr, dr); bg = sep(sg, dg); bb = sep(sb, db);
      } else {
        const takeSrc = darker ? lum(sr, sg, sb) < lum(dr, dg, db) : lum(sr, sg, sb) > lum(dr, dg, db);
        if (takeSrc) { br = sr; bg = sg; bb = sb; } else { br = dr; bg = dg; bb = db; }
      }
      const k = 255 / ao;
      o[oi] = (ws * sr + wb * br + wd * dr) * k + 0.5;
      o[oi + 1] = (ws * sg + wb * bg + wd * dg) * k + 0.5;
      o[oi + 2] = (ws * sb + wb * bb + wd * db) * k + 0.5;
      o[oi + 3] = ao * 255 + 0.5;
    }
  }
  return out;
}

function blit(dst: Raster, src: Raster): void {
  for (let y = 0; y < src.h; y++) {
    const di = ((src.y - dst.y + y) * dst.w + (src.x - dst.x)) * 4;
    dst.data.set(src.data.subarray(y * src.w * 4, (y + 1) * src.w * 4), di);
  }
}

function layerPixels(layer: Layer): Raster | null {
  const own = layer.imageData as ImageData | undefined;
  const img = own ?? getLayerImageData(layer);
  if (!img || !img.width || !img.height) return null;
  // freshly decoded pixels are ours to modify; pixels stored on the layer are copied
  const data = own ? new Uint8ClampedArray(img.data) : (img.data as Uint8ClampedArray);
  return { x: layer.left ?? 0, y: layer.top ?? 0, w: img.width, h: img.height, data };
}

function applyMask(r: Raster, layer: Layer): void {
  const m = layer.mask;
  if (!m || m.disabled) return;
  const mimg = (m.imageData as ImageData | undefined) ?? getLayerMaskImageData(layer);
  const mx = m.left ?? 0, my = m.top ?? 0, def = m.defaultColor ?? 0;
  const mw = mimg?.width ?? 0, mh = mimg?.height ?? 0, md = mimg?.data;
  const d = r.data;
  for (let y = 0; y < r.h; y++) {
    const py = r.y + y - my;
    const rowInside = !!md && py >= 0 && py < mh;
    let i = y * r.w * 4 + 3;
    for (let x = 0; x < r.w; x++, i += 4) {
      if (d[i] === 0) continue;
      const px = r.x + x - mx;
      const v = rowInside && px >= 0 && px < mw ? md![(py * mw + px) * 4] : def;
      if (v !== 255) d[i] = (d[i] * v) / 255 + 0.5;
    }
  }
}

type Fx = { enabled?: boolean; color?: { r: number; g: number; b: number }; opacity?: number; blendMode?: string; size?: { value: number }; position?: string; pattern?: { id?: string; name?: string }; scale?: number; align?: boolean; phase?: { x: number; y: number }; fillType?: string };
const enabled = (e: unknown): Fx[] => (Array.isArray(e) ? e : e ? [e] : []).filter((x: Fx) => x && x.enabled !== false) as Fx[];

function overlay(r: Raster, colourAt: (x: number, y: number) => [number, number, number] | null, opacity: number, blendMode: string): void {
  const sep = SEPARABLE[blendMode] ?? SEPARABLE.normal;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4;
      if (!r.data[i + 3]) continue;
      const c = colourAt(r.x + x, r.y + y);
      if (!c) continue;
      for (let k = 0; k < 3; k++) {
        const d = r.data[i + k] / 255;
        const b = sep(c[k] / 255, d);
        r.data[i + k] = Math.round((d * (1 - opacity) + b * opacity) * 255);
      }
    }
}

/** Grows (or shrinks) the alpha channel with a round brush of the given radius. */
function morphAlpha(r: Raster, radius: number, grow: boolean, pad: number): Raster {
  const out: Raster = { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad, data: new Uint8ClampedArray((r.w + 2 * pad) * (r.h + 2 * pad) * 4) };
  const offs: Array<[number, number]> = [];
  const rr = Math.ceil(radius);
  for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= radius * radius + 0.5) offs.push([dx, dy]);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= r.w || y >= r.h ? 0 : r.data[(y * r.w + x) * 4 + 3]);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      let v = grow ? 0 : 255;
      for (const [dx, dy] of offs) {
        const s = a(x - pad + dx, y - pad + dy);
        v = grow ? Math.max(v, s) : Math.min(v, s);
      }
      out.data[(y * out.w + x) * 4 + 3] = v;
    }
  return out;
}

/** Pattern pixels as {width, height, data}: ag-psd gives ImageData, or raw RGBA bytes plus bounds. */
function patternPixels(pat: PatternInfo | undefined): { width: number; height: number; data: ArrayLike<number> } | null {
  if (!pat?.data) return null;
  const d = pat.data as unknown as { width?: number; height?: number; data?: ArrayLike<number> } & ArrayLike<number>;
  if (d.width && d.height && d.data) return { width: d.width, height: d.height, data: d.data };
  const b = (pat as unknown as { bounds?: { w: number; h: number } }).bounds;
  if (b && b.w && b.h && d.length >= b.w * b.h * 4) return { width: b.w, height: b.h, data: d };
  return null;
}

function applyEffects(r: Raster, layer: Layer, ctx: CompositeContext): Raster {
  const fx = layer.effects as Record<string, unknown> | undefined;
  if (!fx || fx.disabled) return r;
  for (const p of enabled(fx.patternOverlay)) {
    const pat = ctx.patterns.find((q) => q.id === p.pattern?.id) ?? ctx.patterns.find((q) => q.name === p.pattern?.name);
    const pd = patternPixels(pat);
    if (!pd) continue;
    const scale = p.scale && p.scale > 0 ? p.scale : 1;
    const ox = (p.align !== false ? r.x : 0) + (p.phase?.x ?? 0);
    const oy = (p.align !== false ? r.y : 0) + (p.phase?.y ?? 0);
    overlay(r, (x, y) => {
      const px = Math.floor((((x - ox) / scale) % pd.width + pd.width) % pd.width);
      const py = Math.floor((((y - oy) / scale) % pd.height + pd.height) % pd.height);
      const i = (py * pd.width + px) * 4;
      return [pd.data[i], pd.data[i + 1], pd.data[i + 2]];
    }, p.opacity ?? 1, p.blendMode ?? 'normal');
  }
  for (const c of enabled(fx.solidFill)) {
    const col = c.color ?? { r: 0, g: 0, b: 0 };
    overlay(r, () => [col.r, col.g, col.b], c.opacity ?? 1, c.blendMode ?? 'normal');
  }
  for (const s of enabled(fx.stroke)) {
    if (s.fillType && s.fillType !== 'color') continue;
    const size = s.size?.value ?? 1;
    const col = s.color ?? { r: 0, g: 0, b: 0 };
    const pos = s.position ?? 'outside';
    const strokeColour = (alpha: Raster): Raster => {
      for (let i = 0; i < alpha.data.length; i += 4) {
        alpha.data[i] = col.r;
        alpha.data[i + 1] = col.g;
        alpha.data[i + 2] = col.b;
      }
      return alpha;
    };
    if (pos === 'inside') {
      const inner = morphAlpha(r, size, false, 0);
      const ring = strokeColour(morphAlpha(r, 0, true, 0));
      for (let i = 3; i < ring.data.length; i += 4) ring.data[i] = Math.max(0, ring.data[i] - inner.data[i]);
      r = compositeOver(r, ring, 'normal', s.opacity ?? 1);
    } else {
      const radius = pos === 'center' ? size / 2 : size;
      const pad = Math.ceil(radius);
      const grown = strokeColour(morphAlpha(r, radius, true, pad));
      r = compositeOver(compositeOver(null, grown, 'normal', s.opacity ?? 1), r, 'normal', 1);
    }
  }
  return r;
}

function adjust(r: Raster, layer: Layer): void {
  const adj = layer.adjustment as Record<string, unknown> & { type: string };
  const d = r.data;
  if (adj.type === 'levels') {
    const ch = (adj.channels as Array<Record<string, number>> | undefined)?.[0];
    if (!ch) return;
    const lut = buildLevelsLut({ shadowInput: ch.shadowInput ?? 0, highlightInput: ch.highlightInput ?? 255, shadowOutput: ch.shadowOutput ?? 0, highlightOutput: ch.highlightOutput ?? 255, midtoneInput: ch.midtoneInput ?? 1 });
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  } else if (adj.type === 'hue/saturation') {
    const m = (adj.master as Record<string, number> | undefined) ?? {};
    const hue = (m.hue ?? 0) / 360, sat = (m.saturation ?? 0) / 100, light = (m.lightness ?? 0) / 100;
    for (let i = 0; i < d.length; i += 4) {
      let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      h = (h + hue + 1) % 1;
      s = Math.max(0, Math.min(1, sat >= 0 ? s + (1 - s) * sat * s : s * (1 + sat)));
      l = light >= 0 ? l + (1 - l) * light : l * (1 + light);
      const [rr, gg, bb] = hslToRgb(h, s, l);
      d[i] = rr; d[i + 1] = gg; d[i + 2] = bb;
    }
  } else if (adj.type === 'brightness/contrast') {
    const lut = brightnessContrastLut((adj.brightness as number | undefined) ?? 0, (adj.contrast as number | undefined) ?? 0, !!adj.useLegacy);
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  }
}

/** Natural cubic spline through (xs, ys), evaluated at t. */
function naturalSpline(xs: number[], ys: number[], t: number): number {
  const n = xs.length - 1;
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const alpha = [0, ...h.slice(1).map((_, i) => (3 / h[i + 1]) * (ys[i + 2] - ys[i + 1]) - (3 / h[i]) * (ys[i + 1] - ys[i]))];
  const l = [1], mu = [0], z = [0];
  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const c = new Array(n + 1).fill(0), b = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let j = n - 1; j >= 0; j--) {
    c[j] = (j > 0 ? z[j] : 0) - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  let j = 0;
  while (j < n - 1 && t > xs[j + 1]) j++;
  const dx = t - xs[j];
  return ys[j] + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;
}

/**
 * Photoshop's Brightness/Contrast as a 256-entry table (the modern curve as reverse-engineered by psd-tools,
 * or the legacy straight line).
 */
export function brightnessContrastLut(brightness: number, contrast: number, legacy: boolean): Uint8Array {
  const out = new Uint8Array(256);
  const pivot = 127 / 255;
  if (legacy) {
    const shift = brightness / 255;
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const v = contrast > 0 ? (t + shift - pivot) * (100 / Math.max(100 - contrast, 1e-6)) + pivot : (t - pivot) * ((100 + contrast) / 100) + pivot + shift;
      out[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    }
    return out;
  }
  const b = brightness / 150, c = contrast / 100, bAbs = Math.abs(b);
  const xs = [0, 63 / 255, 191 / 255, 1];
  const ys = [0, xs[1] - c * (25 / 255), xs[2] + c * (25 / 255), 1];
  const xr: number[] = [], yr: number[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const hh = 0.5 * (bAbs * (1.65 * t ** 0.35 - t ** 10) + (1 - bAbs) * (1.96 * t ** 0.4 + t ** 4) + t ** 1.25);
    const bs = b * t * (1 - t) * hh;
    xr.push(t - bs);
    yr.push(naturalSpline(xs, ys, t) + bs);
  }
  // resample the rotated curve at the input values (like numpy.interp)
  let k = 0;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let v: number;
    if (t <= xr[0]) v = yr[0];
    else if (t >= xr[255]) v = yr[255];
    else {
      while (k < 254 && xr[k + 1] < t) k++;
      const f = (t - xr[k]) / (xr[k + 1] - xr[k] || 1);
      v = yr[k] + f * (yr[k + 1] - yr[k]);
    }
    out[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  return out;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const dd = max - min;
  const s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
  const h = max === r ? (g - b) / dd + (g < b ? 6 : 0) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [h / 6, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Renders one layer or group (with its mask, effects and opacity applied); null if nothing visible. */
function renderNode(layer: Layer, ctx: CompositeContext): Raster | null {
  if (layer.hidden) return null;
  let r = layer.children ? renderLayers(layer.children, ctx) : layerPixels(layer);
  if (!r) return null;
  applyMask(r, layer);
  r = applyEffects(r, layer, ctx);
  return r;
}

/** Composites a list of sibling layers (bottom first), handling clipping groups and adjustments. */
export function renderLayers(layers: Layer[], ctx: CompositeContext): Raster | null {
  // one canvas for the whole group up front, so drawing children never has to grow and copy it
  const b = boundsOf(layers);
  let acc: Raster | null = b ? { ...b, data: new Uint8ClampedArray(b.w * b.h * 4) } : null;
  let base: { raster: Raster | null; blend: string; opacity: number } | null = null;
  const flush = () => {
    if (base?.raster) acc = compositeOver(acc, base.raster, base.blend, base.opacity, true);
    base = null;
  };
  for (const l of layers) {
    if (l.hidden) continue;
    if (l.adjustment) {
      flush();
      if (acc) adjust(acc, l);
      continue;
    }
    const r = renderNode(l, ctx);
    if (l.clipping && base) {
      if (r && base.raster) {
        const b = base.raster;
        // keep only the part over the base layer, then draw it onto the base
        for (let y = 0; y < r.h; y++)
          for (let x = 0; x < r.w; x++) {
            const bx = r.x + x - b.x, by = r.y + y - b.y;
            const ba = bx >= 0 && by >= 0 && bx < b.w && by < b.h ? b.data[(by * b.w + bx) * 4 + 3] : 0;
            const i = (y * r.w + x) * 4 + 3;
            r.data[i] = Math.round((r.data[i] * ba) / 255);
          }
        const merged = compositeOver(b, r, l.blendMode ?? 'normal', l.opacity ?? 1);
        base.raster = crop(merged, b);
      }
      continue;
    }
    flush();
    base = { raster: r, blend: l.blendMode === 'pass through' ? 'normal' : l.blendMode ?? 'normal', opacity: l.opacity ?? 1 };
  }
  flush();
  return acc;
}

type Box = { x: number; y: number; w: number; h: number };

/** Effects that draw outside a layer's pixels (outside/centre strokes). */
function effectPad(layer: Layer): number {
  const fx = layer.effects as Record<string, unknown> | undefined;
  if (!fx || fx.disabled) return 0;
  return Math.max(0, ...enabled(fx.stroke).map((st) => (st.position === 'inside' ? 0 : Math.ceil(st.size?.value ?? 1))));
}

/** Upper bound of the area the visible layers can draw into. */
function boundsOf(layers: Layer[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of layers) {
    if (l.hidden || l.adjustment) continue;
    let b: Box | null;
    if (l.children) b = boundsOf(l.children);
    else {
      const w = (l.right ?? 0) - (l.left ?? 0), h = (l.bottom ?? 0) - (l.top ?? 0);
      const img = l.imageData as ImageData | undefined;
      b = img ? { x: l.left ?? 0, y: l.top ?? 0, w: img.width, h: img.height } : w > 0 && h > 0 ? { x: l.left ?? 0, y: l.top ?? 0, w, h } : null;
    }
    if (!b) continue;
    const pad = effectPad(l);
    x0 = Math.min(x0, b.x - pad); y0 = Math.min(y0, b.y - pad);
    x1 = Math.max(x1, b.x + b.w + pad); y1 = Math.max(y1, b.y + b.h + pad);
  }
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function crop(r: Raster, to: { x: number; y: number; w: number; h: number }): Raster {
  const out: Raster = { ...to, data: new Uint8ClampedArray(to.w * to.h * 4) };
  for (let y = 0; y < to.h; y++) {
    const si = ((to.y - r.y + y) * r.w + (to.x - r.x)) * 4;
    out.data.set(r.data.subarray(si, si + to.w * 4), y * to.w * 4);
  }
  return out;
}

/** Shrinks a raster to its non-transparent pixels; null if fully transparent. */
export function trim(r: Raster): Raster | null {
  let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++)
      if (r.data[(y * r.w + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  return crop(r, { x: r.x + x0, y: r.y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
}
