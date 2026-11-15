import type { Item, LevelsSettings } from '../../shared/types';
import { applyLevels } from '../../shared/levels';
import { encodeTga32 } from '../../shared/tga';
import { finishById } from '../../shared/finish';
import { createItemNode, type NodeContext } from '../canvas/nodes';
import { paintRegion } from './regionMap';

export interface LiveryInput {
  width: number;
  height: number;
  carColour: string;
  items: Item[];
  levels: LevelsSettings | null;
}

/** Renders the livery at template resolution: the paint (car colour + items, Levels applied) and the finish map. */
export async function renderLivery(input: LiveryInput, ctx: NodeContext): Promise<{ paint: Uint8ClampedArray; region: Uint8ClampedArray }> {
  const { width, height } = input;
  const paintCanvas = document.createElement('canvas');
  paintCanvas.width = width;
  paintCanvas.height = height;
  const pctx = paintCanvas.getContext('2d', { willReadFrequently: true })!;
  pctx.fillStyle = input.carColour;
  pctx.fillRect(0, 0, width, height);

  const region = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < region.length; i += 4) region[i] = 255;

  for (const item of input.items) {
    if (!item.visible) continue;
    const node = createItemNode(item, ctx);
    const layerCanvas = node.toCanvas({ x: 0, y: 0, width, height, pixelRatio: 1 });
    const lctx = layerCanvas.getContext('2d', { willReadFrequently: true })!;
    paintRegion(region, lctx.getImageData(0, 0, width, height).data, finishById(item.finish).rgb);
    pctx.drawImage(layerCanvas, 0, 0);
    node.destroy();
    // let the UI breathe between items
    await new Promise((r) => setTimeout(r, 0));
  }

  const paint = pctx.getImageData(0, 0, width, height).data;
  applyLevels(paint, input.levels);
  for (let i = 3; i < paint.length; i += 4) paint[i] = 255;
  return { paint, region };
}

/** Both TGA files, ready to write. */
export async function renderLiveryFiles(input: LiveryInput, ctx: NodeContext): Promise<{ paint: Uint8Array; region: Uint8Array }> {
  const { paint, region } = await renderLivery(input, ctx);
  return { paint: encodeTga32(paint, input.width, input.height), region: encodeTga32(region, input.width, input.height) };
}
