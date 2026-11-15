import type { BrushItem, ImageItem, Item, ShapeItem, TextItem } from '../../shared/types';
import { defaultFinishFor } from '../../shared/finish';
import { useEditor, newId } from './store';

const SHAPE_NAMES: Record<ShapeItem['shape'], string> = { rect: 'Rectangle', ellipse: 'Circle', line: 'Line', triangle: 'Triangle' };
export const DEFAULT_LINE_THICKNESS = 40;

/** Next free number for "<prefix> N" among the current project's items. */
function nextName(prefix: string): string {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  let max = 0;
  for (const it of useEditor.getState().project.items) {
    const m = re.exec(it.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix} ${max + 1}`;
}

const base = (type: Item['type'], name: string, x: number, y: number) => ({
  id: newId(),
  name,
  visible: true,
  finish: defaultFinishFor(type),
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

export function newShapeItem(shape: ShapeItem['shape'], r: { x: number; y: number; w: number; h: number }, colour: string): ShapeItem {
  return {
    ...base('shape', nextName(SHAPE_NAMES[shape]), r.x, r.y),
    type: 'shape',
    shape,
    width: r.w,
    height: shape === 'line' ? DEFAULT_LINE_THICKNESS : r.h,
    fill: colour,
    stroke: '#000000',
    strokeWidth: 0,
    cornerRadius: 0,
  };
}

export function newTextItem(at: { x: number; y: number }, colour: string): TextItem {
  return {
    ...base('text', nextName('Text'), at.x, at.y),
    type: 'text',
    text: 'Text',
    fontFamily: 'Arial Black',
    fontSize: 200,
    fill: colour,
    bold: false,
    italic: false,
    stroke: '#000000',
    strokeWidth: 0,
  };
}

export function newImageItem(assetId: string, name: string, w: number, h: number, at: { x: number; y: number }): ImageItem {
  return { ...base('image', name, at.x, at.y), type: 'image', assetId, width: w, height: h };
}

export function newBrushItem(): BrushItem {
  return { ...base('brush', nextName('Brush'), 0, 0), type: 'brush', strokes: [] };
}
