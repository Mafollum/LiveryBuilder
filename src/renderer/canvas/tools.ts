import Konva from 'konva';
import type { BrushItem, BrushStroke, ShapeItem } from '../../shared/types';
import { useEditor } from '../state/store';
import { newBrushItem, newShapeItem } from '../state/factories';
import type { CanvasView } from './CanvasView';

const SHAPE_TOOLS = { rect: 'rect', ellipse: 'ellipse', line: 'line', triangle: 'triangle' } as const;
const MIN_DRAG = 3;
const DEFAULT_SIZE = 200;

/** Pointer handling for the drawing tools. Selection/moving is handled by CanvasView + Konva. */
export class ToolController {
  private start: { x: number; y: number } | null = null;
  private preview: Konva.Shape | null = null;
  private stroke: { mode: 'paint' | 'erase'; points: number[]; target: BrushItem | null; inverse: Konva.Transform } | null = null;

  /** Called when the eraser is used without a brush item selected. */
  onNotice: (message: string) => void = () => {};

  /** Called when the text tool is clicked at a texture position. */
  onTextRequest: (at: { x: number; y: number }) => void = () => {};

  constructor(private view: CanvasView) {
    const stage = view.stage;
    stage.on('mousedown.tools', (e) => this.down(e.evt));
    stage.on('mousemove.tools', () => this.move());
    window.addEventListener('mouseup', this.up);
  }

  destroy(): void {
    this.view.stage.off('.tools');
    window.removeEventListener('mouseup', this.up);
  }

  private shapeTool(): ShapeItem['shape'] | null {
    const t = useEditor.getState().tool;
    return t in SHAPE_TOOLS ? SHAPE_TOOLS[t as keyof typeof SHAPE_TOOLS] : null;
  }

  private down(e: MouseEvent): void {
    if (e.button !== 0 || this.view.isPanning()) return;
    const tool = useEditor.getState().tool;
    if (tool === 'brush' || tool === 'eraser') {
      this.beginStroke(tool === 'brush' ? 'paint' : 'erase');
      return;
    }
    if (tool === 'text') {
      const at = this.view.pointer();
      if (at) this.onTextRequest(at);
      return;
    }
    const shape = this.shapeTool();
    const p = this.view.pointer();
    if (!shape || !p) return;
    this.start = p;
    this.preview = new Konva.Line({ points: [], closed: shape !== 'line', stroke: '#1d6fe0', strokeWidth: 1, strokeScaleEnabled: false, dash: [6, 4], listening: false });
    this.view.ui.add(this.preview);
  }

  private beginStroke(mode: 'paint' | 'erase'): void {
    const st = useEditor.getState();
    const sel = st.project.items.find((i) => i.id === st.selectedId);
    const target = sel?.type === 'brush' ? sel : null;
    if (mode === 'erase' && !target) {
      this.onNotice('The eraser only removes brush paint. Select a brush item in the list first.');
      return;
    }
    const p = this.view.pointer();
    if (!p) return;
    const inverse = target
      ? new Konva.Transform().translate(target.x, target.y).rotate((target.rotation * Math.PI) / 180).scale(target.scaleX, target.scaleY).invert()
      : new Konva.Transform();
    const local = inverse.point(p);
    this.stroke = { mode, points: [local.x, local.y], target, inverse };
    const b = st.brush;
    this.preview = new Konva.Line({
      points: [p.x, p.y, p.x + 0.01, p.y],
      stroke: mode === 'erase' ? '#ffffff' : b.colour,
      opacity: mode === 'erase' ? 0.7 : b.opacity,
      strokeWidth: b.size * (target ? Math.abs(target.scaleX) : 1),
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    });
    this.view.ui.add(this.preview);
    this.view.ui.batchDraw();
  }

  private move(): void {
    if (this.stroke && this.preview) {
      const p = this.view.pointer();
      if (!p) return;
      const local = this.stroke.inverse.point(p);
      const pts = this.stroke.points;
      if (Math.hypot(local.x - pts[pts.length - 2], local.y - pts[pts.length - 1]) < 1) return;
      pts.push(local.x, local.y);
      const line = this.preview as Konva.Line;
      line.points([...line.points(), p.x, p.y]);
      this.view.ui.batchDraw();
      return;
    }
    if (!this.start || !this.preview) return;
    const p = this.view.pointer();
    if (!p) return;
    const s = this.start;
    if (this.shapeTool() === 'line') this.preview.setAttr('points', [s.x, s.y, p.x, p.y]);
    else this.preview.setAttr('points', [s.x, s.y, p.x, s.y, p.x, p.y, s.x, p.y]);
    this.view.ui.batchDraw();
  }

  private endStroke(): void {
    const s = this.stroke!;
    this.stroke = null;
    this.preview?.destroy();
    this.preview = null;
    this.view.ui.batchDraw();
    const st = useEditor.getState();
    const b = st.brush;
    const stroke: BrushStroke = { mode: s.mode, kind: b.kind, colour: b.colour, size: b.size, opacity: b.opacity, softness: b.softness, points: s.points };
    if (s.target) {
      const current = st.project.items.find((i) => i.id === s.target!.id);
      if (current?.type === 'brush') st.updateItem(current.id, { strokes: [...current.strokes, stroke] });
    } else {
      const item = newBrushItem();
      item.strokes = [stroke];
      st.addItem(item);
    }
  }

  private up = (): void => {
    if (this.stroke) {
      this.endStroke();
      return;
    }
    const shape = this.shapeTool();
    const s = this.start;
    this.start = null;
    this.preview?.destroy();
    this.preview = null;
    this.view.ui.batchDraw();
    if (!s || !shape) return;
    const p = this.view.pointer() ?? s;
    const st = useEditor.getState();
    const colour = st.brush.colour;
    let item: ShapeItem;
    if (shape === 'line') {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const len = Math.hypot(dx, dy);
      item = newShapeItem('line', { x: s.x, y: s.y, w: len >= MIN_DRAG ? len : DEFAULT_SIZE, h: 0 }, colour);
      if (len >= MIN_DRAG) item.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
    } else {
      let x = Math.min(s.x, p.x);
      let y = Math.min(s.y, p.y);
      let w = Math.abs(p.x - s.x);
      let h = Math.abs(p.y - s.y);
      if (w < MIN_DRAG && h < MIN_DRAG) {
        w = h = DEFAULT_SIZE;
        x = s.x - w / 2;
        y = s.y - h / 2;
      }
      item = newShapeItem(shape, { x, y, w: Math.max(1, w), h: Math.max(1, h) }, colour);
    }
    st.addItem(item);
    st.setTool('select');
  };
}
