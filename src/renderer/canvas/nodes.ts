import Konva from 'konva';
import type { BrushItem, Item, ShapeItem } from '../../shared/types';
import type { BrushImage } from './brush';

export interface NodeContext {
  getImage(assetId: string): CanvasImageSource | undefined;
  getBrush(item: BrushItem): BrushImage | null;
}

/** Konva node type used for each item kind (shapes differ by shape). */
function kindOf(item: Item): string {
  return item.type === 'shape' ? `shape:${item.shape}` : item.type;
}

/** Builds the Konva node that draws an item. Used on screen and for export. */
export function createItemNode(item: Item, ctx: NodeContext): Konva.Shape {
  let node: Konva.Shape;
  switch (item.type) {
    case 'shape':
      if (item.shape === 'ellipse') node = new Konva.Ellipse({ radiusX: 1, radiusY: 1 });
      else if (item.shape === 'triangle') node = new Konva.Line({ points: [], closed: true });
      else node = new Konva.Rect();
      break;
    case 'image':
      node = new Konva.Image({ image: undefined });
      break;
    case 'text':
      node = new Konva.Text();
      break;
    case 'brush':
      node = new Konva.Image({ image: undefined });
      break;
  }
  node.setAttr('itemKind', kindOf(item));
  updateItemNode(node, item, ctx);
  return node;
}

function applyShape(node: Konva.Shape, item: ShapeItem): void {
  const w = item.width;
  const h = item.height;
  node.setAttrs({
    fill: item.fill,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
    strokeEnabled: item.strokeWidth > 0,
    strokeScaleEnabled: false,
  });
  if (item.shape === 'ellipse') {
    node.setAttrs({ radiusX: w / 2, radiusY: h / 2, offsetX: -w / 2, offsetY: -h / 2 });
  } else if (item.shape === 'triangle') {
    node.setAttrs({ points: [w / 2, 0, w, h, 0, h] });
  } else if (item.shape === 'line') {
    node.setAttrs({ width: w, height: h, offsetY: h / 2, cornerRadius: 0 });
  } else {
    node.setAttrs({ width: w, height: h, cornerRadius: Math.max(0, Math.min(item.cornerRadius, w / 2, h / 2)) });
  }
}

/** Copies an item's properties onto its node. */
export function updateItemNode(node: Konva.Node, item: Item, ctx: NodeContext): void {
  node.setAttrs({
    id: item.id,
    name: 'item',
    x: item.x,
    y: item.y,
    rotation: item.rotation,
    scaleX: item.scaleX,
    scaleY: item.scaleY,
    opacity: item.opacity,
    visible: item.visible,
  });
  const shape = node as Konva.Shape;
  switch (item.type) {
    case 'shape':
      applyShape(shape, item);
      break;
    case 'image':
      shape.setAttrs({ image: ctx.getImage(item.assetId), width: item.width, height: item.height });
      break;
    case 'text':
      shape.setAttrs({
        text: item.text,
        fontFamily: item.fontFamily,
        fontSize: item.fontSize,
        fontStyle: `${item.italic ? 'italic ' : ''}${item.bold ? 'bold' : 'normal'}`.trim(),
        fill: item.fill,
        stroke: item.stroke,
        strokeWidth: item.strokeWidth,
        strokeEnabled: item.strokeWidth > 0,
        fillAfterStrokeEnabled: true,
        lineHeight: 1,
      });
      break;
    case 'brush': {
      // the node covers only the painted area, in the item's own coordinates
      const b = ctx.getBrush(item);
      if (b) shape.setAttrs({ image: b.canvas, width: b.canvas.width, height: b.canvas.height, offsetX: -b.x, offsetY: -b.y });
      else shape.setAttrs({ image: undefined, width: 0, height: 0 });
      break;
    }
  }
}

/** True when an existing node can be updated in place for this item. */
export function nodeMatches(node: Konva.Node, item: Item): boolean {
  return node.getAttr('itemKind') === kindOf(item);
}
