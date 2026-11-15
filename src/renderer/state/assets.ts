import { newId } from './store';

export interface Asset { id: string; mime: string; bytes: Uint8Array; image: HTMLImageElement }

const assets = new Map<string, Asset>();

export function loadImage(bytes: Uint8Array, mime: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image could not be decoded'));
    };
    img.src = url;
  });
}

/** Registers image bytes under a given id (used when opening projects). */
export async function registerAsset(id: string, bytes: Uint8Array, mime: string): Promise<Asset> {
  const image = await loadImage(bytes, mime);
  const a = { id, mime, bytes, image };
  assets.set(id, a);
  return a;
}

export async function addAsset(bytes: Uint8Array, mime: string): Promise<{ id: string; width: number; height: number }> {
  const a = await registerAsset(newId(), bytes, mime);
  return { id: a.id, width: a.image.naturalWidth, height: a.image.naturalHeight };
}

export const getAssetImage = (id: string): HTMLImageElement | undefined => assets.get(id)?.image;
export const getAssetBytes = (id: string): Uint8Array | undefined => assets.get(id)?.bytes;
export const allAssets = (): Asset[] => [...assets.values()];
export const clearAssets = (): void => assets.clear();

export const getAsset = (id: string): Asset | undefined => assets.get(id);
