import { useState } from 'react';
import type React from 'react';
import type { ImageItem } from '@shared/types';
import { useEditor } from '../state/store';
import { addAsset, getAssetImage } from '../state/assets';
import { removePlainBackground } from '../image/removeBackground';
import { subjectMask } from '../image/autoBackground';
import { showMessage, plainError } from '../messages';

async function pngBytes(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('could not encode the image');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Background removal for the selected image: plain colour, or automatic (AI), and back to the original. */
export function BackgroundTools({ item }: { item: ImageItem }): React.JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, change: (pixels: ImageData) => Promise<void> | void) => {
    const img = getAssetImage(item.assetId);
    if (!img) return;
    setBusy(label);
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height);
      await change(pixels);
      ctx.putImageData(pixels, 0, 0);
      const asset = await addAsset(await pngBytes(c), 'image/png');
      useEditor.getState().updateItem(item.id, { assetId: asset.id, originalAssetId: item.originalAssetId ?? item.assetId } as Partial<ImageItem>);
    } catch (e) {
      showMessage("Couldn't remove the background", plainError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-tools">
      <span className="field-title">Background</span>
      <div className="button-row">
        <button type="button" disabled={!!busy} onClick={() => run('plain', (p) => { p.data.set(removePlainBackground(p.data, p.width, p.height)); })}>
          Remove plain background
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() =>
            run('auto', async (p) => {
              const mask = await subjectMask(getAssetImage(item.assetId)!, p.width, p.height);
              for (let i = 0; i < mask.length; i++) p.data[i * 4 + 3] = Math.round((p.data[i * 4 + 3] * mask[i]) / 255);
            })
          }
        >
          Remove background (automatic)
        </button>
        <button
          type="button"
          disabled={!!busy || !item.originalAssetId}
          onClick={() => useEditor.getState().updateItem(item.id, { assetId: item.originalAssetId!, originalAssetId: undefined } as Partial<ImageItem>)}
        >
          Restore original
        </button>
      </div>
      {busy && <p className="hint small">{busy === 'auto' ? 'Finding the subject… (the first time takes a few seconds)' : 'Removing the background…'}</p>}
      {!busy && <p className="hint small">Plain: for logos on one colour. Automatic: for photos.</p>}
    </div>
  );
}
