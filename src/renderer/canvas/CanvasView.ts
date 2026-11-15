import Konva from 'konva';
import type { Item, PanelData } from '../../shared/types';
import { makePanelCanvas, makePanelMask, makeVeilCanvas, OFF_CAR_GREY } from './panelImages';
import { createItemNode, nodeMatches, updateItemNode, type NodeContext } from './nodes';

/** Geometry written back after the user moves/resizes/rotates an item on the canvas. */
export interface ItemGeometry {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width?: number;
  height?: number;
}

export interface CanvasCallbacks {
  select(id: string | null): void;
  /** Final geometry at the end of a drag or transform. */
  geometry(id: string, g: ItemGeometry): void;
  /** Double-click on a text item. */
  editText?(id: string): void;
}

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
  private itemNodes = new Map<string, Konva.Shape>();
  private lastItems: Item[] = [];
  private selectMode = true;
  readonly transformer = new Konva.Transformer({
    rotateEnabled: true,
    keepRatio: false,
    ignoreStroke: true,
    borderStroke: '#1d6fe0',
    anchorStroke: '#1d6fe0',
    anchorSize: 9,
  });
  nodeContext: NodeContext = {
    getImage: () => undefined,
    getBrushCanvas: () => document.createElement('canvas'),
  };
  callbacks: CanvasCallbacks = { select: () => {}, geometry: () => {} };

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
    this.ui.add(this.transformer);
    this.transformer.on('transformend', () => {
      const node = this.transformer.nodes()[0] as Konva.Shape | undefined;
      if (node) this.callbacks.geometry(node.id(), this.geometryOf(node));
    });
    this.items.on('mousedown touchstart', (e) => {
      if (!this.selectMode || this.isPanning() || e.evt instanceof MouseEvent && e.evt.button !== 0) return;
      const target = e.target as Konva.Node;
      if (target.name() === 'item') this.callbacks.select(target.id());
    });
    this.items.on('dblclick dbltap', (e) => {
      const target = e.target as Konva.Node;
      if (this.selectMode && target.name() === 'item' && target.getAttr('itemKind') === 'text') this.callbacks.editText?.(target.id());
    });
    this.stage.on('mousedown', (e) => {
      if (!this.selectMode || this.isPanning() || e.evt.button !== 0) return;
      const t = e.target as Konva.Node;
      if (t === this.stage || t.getLayer() !== this.items && t.getLayer() !== this.ui) this.callbacks.select(null);
    });

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

  /** Mirrors the document's items as Konva nodes and attaches the selection handles. */
  syncItems(items: Item[], selectedId: string | null, selectMode: boolean): void {
    this.lastItems = items;
    this.selectMode = selectMode;
    const seen = new Set<string>();
    items.forEach((item, index) => {
      seen.add(item.id);
      let node = this.itemNodes.get(item.id);
      if (node && !nodeMatches(node, item)) {
        node.destroy();
        node = undefined;
      }
      if (!node) {
        node = createItemNode(item, this.nodeContext);
        node.on('dragend', () => this.callbacks.geometry(node!.id(), this.geometryOf(node!)));
        this.items.add(node);
        this.itemNodes.set(item.id, node);
      } else {
        updateItemNode(node, item, this.nodeContext);
      }
      node.draggable(selectMode && item.visible);
      node.listening(selectMode);
      node.zIndex(index);
    });
    for (const [id, node] of this.itemNodes) {
      if (!seen.has(id)) {
        node.destroy();
        this.itemNodes.delete(id);
      }
    }
    const sel = selectedId ? this.itemNodes.get(selectedId) : undefined;
    this.transformer.nodes(sel && selectMode && sel.visible() ? [sel] : []);
    this.stage.batchDraw();
  }

  /** Re-applies every item (e.g. after an image finished loading). */
  refreshItems(): void {
    for (const item of this.lastItems) {
      const node = this.itemNodes.get(item.id);
      if (node) updateItemNode(node, item, this.nodeContext);
    }
    this.stage.batchDraw();
  }

  /** Pointer position in texture coordinates. */
  pointer(): { x: number; y: number } | null {
    return this.stage.getRelativePointerPosition();
  }

  private geometryOf(node: Konva.Shape): ItemGeometry {
    const item = this.lastItems.find((i) => i.id === node.id());
    const g: ItemGeometry = { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() };
    if (item?.type === 'shape') {
      // bake the resize into the shape's size so outlines and corners don't stretch
      g.width = Math.max(1, item.width * Math.abs(g.scaleX));
      g.height = Math.max(1, item.height * Math.abs(g.scaleY));
      g.scaleX = Math.sign(g.scaleX) || 1;
      g.scaleY = Math.sign(g.scaleY) || 1;
    }
    return g;
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
