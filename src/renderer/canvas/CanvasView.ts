import Konva from 'konva';
import type { PanelData } from '../../shared/types';
import { makePanelCanvas, makePanelMask, makeVeilCanvas, OFF_CAR_GREY } from './panelImages';

const ZOOM_STEP = 1.15;
const MAX_SCALE = 8;
const FIT_MARGIN = 24;
const OUTLINE_COLOUR = '#333333';
const OUTLINE_WIDTH = 1.5;

export interface View { scale: number; x: number; y: number }

/** The Konva stage: grey background, coloured panels, items, off-car veil, outline, UI. */
export class CanvasView {
  readonly stage: Konva.Stage;
  readonly background = new Konva.Layer({ listening: false });
  readonly panels = new Konva.Layer({ listening: false });
  readonly items = new Konva.Layer();
  readonly veil = new Konva.Layer({ listening: false });
  readonly outline = new Konva.Layer({ listening: false });
  readonly ui = new Konva.Layer();

  private panel: PanelData | null = null;
  private mask: HTMLCanvasElement | null = null;
  private panelImage = new Konva.Image({ image: undefined, listening: false });
  private veilImage = new Konva.Image({ image: undefined, listening: false });
  private bgRect = new Konva.Rect({ fill: OFF_CAR_GREY, listening: false });
  private outlineShape: Konva.Shape;
  private fitScale = 1;
  private userMovedView = false;
  private spaceDown = false;
  private panning: { x: number; y: number } | null = null;
  private resizeObserver: ResizeObserver;
  private ready = false;

  constructor(private container: HTMLDivElement) {
    this.stage = new Konva.Stage({ container, width: container.clientWidth || 800, height: container.clientHeight || 600 });
    this.background.add(this.bgRect);
    this.panels.add(this.panelImage);
    this.veil.add(this.veilImage);
    this.outlineShape = new Konva.Shape({
      listening: false,
      stroke: OUTLINE_COLOUR,
      strokeWidth: OUTLINE_WIDTH,
      strokeScaleEnabled: false,
      perfectDrawEnabled: false,
      sceneFunc: (ctx, shape) => {
        const loops = this.panel?.outline ?? [];
        ctx.beginPath();
        for (const loop of loops) {
          ctx.moveTo(loop[0], loop[1]);
          for (let i = 2; i < loop.length; i += 2) ctx.lineTo(loop[i], loop[i + 1]);
          ctx.closePath();
        }
        ctx.strokeShape(shape);
      },
    });
    this.outline.add(this.outlineShape);
    for (const l of [this.background, this.panels, this.items, this.veil, this.outline, this.ui]) this.stage.add(l);

    this.stage.on('wheel', (e) => this.onWheel(e.evt));
    container.addEventListener('mousedown', this.onMouseDown, true);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);
  }

  setPanel(p: PanelData, carColour: string): void {
    this.panel = p;
    this.mask = makePanelMask(p);
    this.bgRect.size({ width: p.width, height: p.height });
    this.panelImage.image(makePanelCanvas(p, carColour, this.mask));
    this.veilImage.image(makeVeilCanvas(p));
    this.userMovedView = false;
    this.fit();
    this.ready = true;
  }

  setCarColour(c: string): void {
    if (!this.panel || !this.mask) return;
    this.panelImage.image(makePanelCanvas(this.panel, c, this.mask));
    this.panels.batchDraw();
  }

  isReady(): boolean {
    return this.ready;
  }

  getView(): View {
    return { scale: this.stage.scaleX(), x: this.stage.x(), y: this.stage.y() };
  }

  fit(): void {
    if (!this.panel) return;
    const cw = this.stage.width();
    const ch = this.stage.height();
    const s = Math.max(0.01, Math.min((cw - 2 * FIT_MARGIN) / this.panel.width, (ch - 2 * FIT_MARGIN) / this.panel.height));
    this.fitScale = s;
    this.stage.scale({ x: s, y: s });
    this.stage.position({ x: (cw - this.panel.width * s) / 2, y: (ch - this.panel.height * s) / 2 });
    this.userMovedView = false;
    this.stage.batchDraw();
  }

  textureToClient(x: number, y: number): { x: number; y: number } {
    const r = this.container.getBoundingClientRect();
    const v = this.getView();
    return { x: r.left + v.x + x * v.scale, y: r.top + v.y + y * v.scale };
  }

  clientToTexture(x: number, y: number): { x: number; y: number } {
    const r = this.container.getBoundingClientRect();
    const v = this.getView();
    return { x: (x - r.left - v.x) / v.scale, y: (y - r.top - v.y) / v.scale };
  }

  /** True while Space is held or a pan is in progress: tools should ignore the pointer. */
  isPanning(): boolean {
    return this.spaceDown || this.panning !== null;
  }

  destroy(): void {
    this.container.removeEventListener('mousedown', this.onMouseDown, true);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.resizeObserver.disconnect();
    this.stage.destroy();
  }

  private zoomAt(clientX: number, clientY: number, factor: number): void {
    const r = this.container.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const old = this.stage.scaleX();
    const next = Math.min(MAX_SCALE, Math.max(this.fitScale / 4, old * factor));
    const tx = (px - this.stage.x()) / old;
    const ty = (py - this.stage.y()) / old;
    this.stage.scale({ x: next, y: next });
    this.stage.position({ x: px - tx * next, y: py - ty * next });
    this.userMovedView = true;
    this.stage.batchDraw();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const notches = Math.max(1, Math.round(Math.abs(e.deltaY) / 100));
    this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? ZOOM_STEP ** notches : 1 / ZOOM_STEP ** notches);
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      e.preventDefault();
      e.stopPropagation();
      this.panning = { x: e.clientX, y: e.clientY };
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.panning) return;
    this.stage.position({ x: this.stage.x() + e.clientX - this.panning.x, y: this.stage.y() + e.clientY - this.panning.y });
    this.panning = { x: e.clientX, y: e.clientY };
    this.userMovedView = true;
    this.stage.batchDraw();
  };

  private onMouseUp = (): void => {
    this.panning = null;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'Space' || isTyping(e.target)) return;
    e.preventDefault();
    this.spaceDown = true;
    this.container.style.cursor = 'grab';
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== 'Space') return;
    this.spaceDown = false;
    this.container.style.cursor = '';
  };

  private onResize(): void {
    this.stage.size({ width: this.container.clientWidth, height: this.container.clientHeight });
    if (!this.userMovedView) this.fit();
    else this.stage.batchDraw();
  }
}

/** True when keyboard input is going into a text field. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}
