export type FinishId = 'paint' | 'carbon' | 'special1' | 'special2' | 'sticker';
export type CarClass = 'Hypercar' | 'LMP2' | 'LMP3' | 'GT3' | 'GTE' | 'Other';

export interface LevelsChannel {
  shadowInput: number;
  highlightInput: number;
  shadowOutput: number;
  highlightOutput: number;
  midtoneInput: number;
}
/** [0] = master (RGB), [1..3] = R, G, B (ag-psd order). */
export interface LevelsSettings {
  channels: LevelsChannel[];
}

export interface CarTemplate {
  fileName: string;
  carClass: CarClass;
  label: string;
  sizeBytes: number;
  mtimeMs: number;
}

/** A fixed element of the car from the template (number plates, stickers…), drawn above the user's items. */
export interface FixedElement {
  /** index of the template's top-level layer */
  id: string;
  /** layer name in the template */
  name: string;
  /** plain label, shared by elements of the same kind */
  label: string;
  /** shown by default (as saved in the template) */
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  png: Uint8Array;
}

/** Whether a fixed element is shown and sent: the user's choice for its label, else the template's default. */
export function fixedShown(el: FixedElement, visibility: Record<string, boolean> | undefined): boolean {
  return visibility?.[el.label] ?? el.visible;
}

/** panel: 1 = on the car, row-major, width*height bytes. */
export interface PanelData {
  width: number;
  height: number;
  panel: Uint8Array;
  source: 'mask' | 'wire' | 'none';
  levels: LevelsSettings | null;
  /** Panel outlines: closed loops, flat [x0, y0, x1, y1, ...] in pixel-corner coordinates. */
  outline?: number[][];
  /** Fixed elements from the template, bottom to top. */
  fixed?: FixedElement[];
}

interface ItemBase {
  id: string;
  name: string;
  visible: boolean;
  finish: FinishId;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
}
export interface ImageItem extends ItemBase {
  type: 'image';
  assetId: string;
  /** the imported image before its background was removed */
  originalAssetId?: string;
  width: number;
  height: number;
}
/** line: width = length, height = thickness. */
export interface ShapeItem extends ItemBase {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line' | 'triangle';
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}
export interface TextItem extends ItemBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  bold: boolean;
  italic: boolean;
  stroke: string;
  strokeWidth: number;
}
export type BrushKind = 'hard' | 'soft' | 'airbrush' | 'pencil' | 'marker' | 'calligraphy' | 'spray' | 'chalk';

/** points: x,y pairs in item-local texture px. */
export interface BrushStroke {
  mode: 'paint' | 'erase';
  /** brush type (older strokes have none: hard round) */
  kind?: BrushKind;
  colour: string;
  size: number;
  opacity: number;
  softness: number;
  points: number[];
}
export interface BrushItem extends ItemBase {
  type: 'brush';
  strokes: BrushStroke[];
}
export type Item = ImageItem | ShapeItem | TextItem | BrushItem;

/** items: bottom -> top. */
export interface Project {
  version: 1;
  templateFileName: string;
  carColour: string;
  items: Item[];
  /** Fixed template elements switched on/off by the user, by label (otherwise as saved in the template). */
  fixedVisibility?: Record<string, boolean>;
}

export type ChooseFolderResult = { folder: string } | { error: string } | null;

/** The API the preload script exposes to the renderer as window.lmu. */
export interface LmuApi {
  ready(): void;
  isTest: boolean;
  getLmuFolder(): Promise<string | null>;
  chooseLmuFolder(): Promise<ChooseFolderResult>;
  listTemplates(): Promise<CarTemplate[]>;
  openTemplate(fileName: string): Promise<PanelData>;
  openTemplateFile(absPath: string): Promise<PanelData>;
  chooseTemplateFile(): Promise<string | null>;
  liveryStatus(): Promise<{ folder: string; exists: boolean }>;
  writeLivery(paint: Uint8Array, region: Uint8Array, backup: boolean): Promise<{ ok: true } | { ok: false; message: string }>;
  saveLiveryElsewhere(paint: Uint8Array, region: Uint8Array): Promise<{ ok: true; folder: string } | { ok: false; message: string } | null>;
  saveProject(bytes: Uint8Array, path: string | null, suggestedName: string): Promise<string | null>;
  openProject(): Promise<{ path: string; bytes: Uint8Array } | null>;
  openRecentProject(path: string): Promise<{ path: string; bytes: Uint8Array } | null>;
  listRecentProjects(): Promise<string[]>;
  writeAutosave(bytes: Uint8Array): Promise<void>;
  readAutosave(): Promise<Uint8Array | null>;
  clearAutosave(): Promise<void>;
  onCloseRequested(cb: () => void): void;
  closeNow(): void;
  autosaveMs: number;
  loadBackgroundModel(): Promise<{ model: Uint8Array; wasm: Uint8Array }>;
}
