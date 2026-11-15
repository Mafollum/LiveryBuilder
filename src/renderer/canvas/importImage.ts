import type { ImageItem } from '../../shared/types';
import { addAsset, loadImage } from '../state/assets';
import { newImageItem } from '../state/factories';

export const BAD_IMAGE = "Can't open this file. Use PNG, JPG, WebP or SVG.";
const MAX_SIDE = 4096;
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };

function mimeOf(file: File): string | null {
  const byMime = Object.values(TYPES).find((m) => m === file.type);
  if (byMime) return byMime;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? null;
}

async function toPng(img: HTMLImageElement, w: number, h: number): Promise<Uint8Array> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('could not encode image');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Natural size of an SVG, falling back to its viewBox when it has no width/height. */
function svgSize(text: string, img: HTMLImageElement): [number, number] {
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  const hasSize = /<svg[^>]*\swidth\s*=/i.test(text) && /<svg[^>]*\sheight\s*=/i.test(text);
  if (!hasSize && vb) return [Number(vb[1]), Number(vb[2])];
  return [img.naturalWidth || 300, img.naturalHeight || 150];
}

export interface Placement { centreX: number; centreY: number; maxW: number; maxH: number }

/** Reads an image file into an image item placed at the centre of the view. */
export async function importImageFile(file: File, place: Placement): Promise<ImageItem | { error: string }> {
  const mime = mimeOf(file);
  if (!mime) return { error: BAD_IMAGE };
  try {
    let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
    let storedMime = mime;
    const img = await loadImage(bytes, mime);
    if (mime !== 'image/svg+xml') {
      // a fully decodable image only: browsers happily "load" truncated files
      const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
      bmp.close();
    }
    if (mime === 'image/svg+xml') {
      const [sw, sh] = svgSize(new TextDecoder().decode(bytes), img);
      const k = MAX_SIDE / Math.max(sw, sh);
      bytes = await toPng(img, Math.round(sw * k), Math.round(sh * k));
      storedMime = 'image/png';
    } else {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return { error: BAD_IMAGE };
      if (Math.max(w, h) > MAX_SIDE) {
        const k = MAX_SIDE / Math.max(w, h);
        bytes = await toPng(img, Math.round(w * k), Math.round(h * k));
        storedMime = 'image/png';
      }
    }
    const asset = await addAsset(bytes, storedMime);
    const scale = Math.min(1, place.maxW / asset.width, place.maxH / asset.height);
    const name = file.name.replace(/\.[^.]+$/, '') || 'Image';
    const item = newImageItem(asset.id, name, asset.width, asset.height, {
      x: place.centreX - (asset.width * scale) / 2,
      y: place.centreY - (asset.height * scale) / 2,
    });
    item.scaleX = scale;
    item.scaleY = scale;
    return item;
  } catch {
    return { error: BAD_IMAGE };
  }
}
