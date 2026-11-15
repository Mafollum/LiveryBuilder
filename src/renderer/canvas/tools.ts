import Konva from 'konva';
import type { ShapeItem } from '../../shared/types';
import { useEditor } from '../state/store';
import { newShapeItem } from '../state/factories';
import type { CanvasView } from './CanvasView';

const SHAPE_TOOLS = { rect: 'rect', ellipse: 'ellipse', line: 'line', triangle: 'triangle' } as const;
const MIN_DRAG = 3;
const DEFAULT_SIZE = 200;

/** Pointer handling for the drawing tools. Selection/moving is handled by CanvasView + Konva. */
export class ToolController {
  private start: { x: number; y: number } | null = null;
  private preview: Konva.Shape | null = null;

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
    if (useEditor.getState().tool === 'text') {
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

  private move(): void {
    if (!this.start || !this.preview) return;
    const p = this.view.pointer();
    if (!p) return;
    const s = this.start;
    if (this.shapeTool() === 'line') this.preview.setAttr('points', [s.x, s.y, p.x, p.y]);
    else this.preview.setAttr('points', [s.x, s.y, p.x, s.y, p.x, p.y, s.x, p.y]);
    this.view.ui.batchDraw();
  }

  private up = (): void => {
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
