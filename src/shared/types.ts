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

/** panel: 1 = on the car, row-major, width*height bytes. */
export interface PanelData {
  width: number;
  height: number;
  panel: Uint8Array;
  source: 'mask' | 'wire' | 'none';
  levels: LevelsSettings | null;
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
/** points: x,y pairs in item-local texture px. */
export interface BrushStroke {
  mode: 'paint' | 'erase';
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
}
