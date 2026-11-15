import type { CanvasView } from './CanvasView';

/** The canvas currently on screen (one at a time). */
let current: CanvasView | null = null;
export const setCurrentView = (v: CanvasView | null): void => { current = v; };
export const getCurrentView = (): CanvasView | null => current;
