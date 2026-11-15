import type { FinishId, Item } from './types';

export interface Finish {
  id: FinishId;
  label: string;
  rgb: [number, number, number];
}

export const FINISHES: ReadonlyArray<Finish> = [
  { id: 'paint', label: 'Paint', rgb: [0, 0, 0] },
  { id: 'carbon', label: 'Carbon', rgb: [255, 0, 0] },
  { id: 'special1', label: 'Special 1', rgb: [0, 255, 0] },
  { id: 'special2', label: 'Special 2', rgb: [0, 0, 255] },
  { id: 'sticker', label: 'Sticker', rgb: [255, 255, 255] },
];

export function finishById(id: FinishId): Finish {
  const f = FINISHES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown finish ${id}`);
  return f;
}

export function defaultFinishFor(type: Item['type']): FinishId {
  return type === 'image' || type === 'text' ? 'sticker' : 'paint';
}
