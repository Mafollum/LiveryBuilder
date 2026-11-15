import { create } from 'zustand';
import { produce } from 'immer';
import type { CarTemplate, Item, PanelData, Project } from '../../shared/types';

export type ToolId = 'select' | 'brush' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'triangle' | 'text' | 'image';
export interface BrushSettings { colour: string; size: number; opacity: number; softness: number }

const HISTORY_LIMIT = 100;
const RECENT_LIMIT = 8;

export interface EditorState {
  template: CarTemplate | null;
  panel: PanelData | null;
  project: Project;
  selectedId: string | null;
  tool: ToolId;
  brush: BrushSettings;
  recentColours: string[];
  dirty: boolean;
  projectPath: string | null;
  past: Project[];
  future: Project[];
  /** Snapshot taken before the first update of a transient sequence (drag, slider). */
  transientBase: Project | null;

  openCar(t: CarTemplate, p: PanelData): void;
  loadProject(p: Project, path: string | null): void;
  setPanel(t: CarTemplate | null, p: PanelData | null): void;
  addItem(item: Item): void;
  updateItem(id: string, patch: Partial<Item>, opts?: { transient?: boolean }): void;
  commitTransient(): void;
  removeItem(id: string): void;
  duplicateItem(id: string): void;
  flipItem(id: string, axis: 'h' | 'v'): void;
  moveItem(id: string, toIndex: number): void;
  setCarColour(c: string): void;
  select(id: string | null): void;
  setTool(t: ToolId): void;
  setBrush(patch: Partial<BrushSettings>): void;
  useColour(c: string): void;
  undo(): void;
  redo(): void;
  markSaved(path: string | null): void;
}

export const emptyProject = (templateFileName = ''): Project => ({ version: 1, templateFileName, carColour: '#ffffff', items: [] });

export const newId = (): string => globalThis.crypto.randomUUID();

export const useEditor = create<EditorState>()((set, get) => {
  /** Applies a recorded change to the project. */
  const change = (recipe: (p: Project) => void, extra: Partial<EditorState> = {}) => {
    const { project, past } = get();
    const next = produce(project, recipe);
    if (next === project) return;
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [], dirty: true, transientBase: null, ...extra });
  };
  const indexOf = (id: string) => get().project.items.findIndex((i) => i.id === id);

  return {
    template: null,
    panel: null,
    project: emptyProject(),
    selectedId: null,
    tool: 'select',
    brush: { colour: '#1d6fe0', size: 40, opacity: 1, softness: 0 },
    recentColours: [],
    dirty: false,
    projectPath: null,
    past: [],
    future: [],
    transientBase: null,

    openCar: (t, p) =>
      set({ template: t, panel: p, project: emptyProject(t.fileName), selectedId: null, past: [], future: [], dirty: false, projectPath: null, transientBase: null, tool: 'select' }),
    loadProject: (p, path) => set({ project: p, projectPath: path, selectedId: null, past: [], future: [], dirty: false, transientBase: null, tool: 'select' }),
    setPanel: (t, p) => set({ template: t, panel: p }),

    addItem: (item) => change((p) => { p.items.push(item); }, { selectedId: item.id }),

    updateItem: (id, patch, opts) => {
      if (opts?.transient) {
        const { project, transientBase } = get();
        const next = produce(project, (p) => {
          const it = p.items.find((i) => i.id === id);
          if (it) Object.assign(it, patch);
        });
        set({ project: next, transientBase: transientBase ?? project, dirty: true });
        return;
      }
      change((p) => {
        const it = p.items.find((i) => i.id === id);
        if (it) Object.assign(it, patch);
      });
    },

    commitTransient: () => {
      const { transientBase, past, project } = get();
      if (!transientBase) return;
      if (transientBase === project) return set({ transientBase: null });
      set({ past: [...past, transientBase].slice(-HISTORY_LIMIT), future: [], transientBase: null, dirty: true });
    },

    removeItem: (id) =>
      change((p) => { p.items = p.items.filter((i) => i.id !== id); }, get().selectedId === id ? { selectedId: null } : {}),

    duplicateItem: (id) => {
      const i = indexOf(id);
      if (i < 0) return;
      const src = get().project.items[i];
      const copy: Item = { ...structuredClone(src), id: newId(), name: `${src.name} copy`, x: src.x + 40, y: src.y + 40 };
      change((p) => { p.items.splice(i + 1, 0, copy); }, { selectedId: copy.id });
    },

    flipItem: (id, axis) =>
      change((p) => {
        const it = p.items.find((x) => x.id === id);
        if (!it) return;
        if (axis === 'h') it.scaleX = -it.scaleX;
        else it.scaleY = -it.scaleY;
      }),

    moveItem: (id, toIndex) => {
      const from = indexOf(id);
      if (from < 0 || from === toIndex) return;
      change((p) => {
        const [it] = p.items.splice(from, 1);
        p.items.splice(Math.max(0, Math.min(toIndex, p.items.length)), 0, it);
      });
    },

    setCarColour: (c) => change((p) => { p.carColour = c; }),
    select: (id) => set({ selectedId: id }),
    setTool: (t) => set({ tool: t }),
    setBrush: (patch) => set({ brush: { ...get().brush, ...patch } }),
    useColour: (c) => set({ recentColours: [c, ...get().recentColours.filter((x) => x !== c)].slice(0, RECENT_LIMIT) }),

    undo: () => {
      const { past, project, future, selectedId } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({
        project: prev,
        past: past.slice(0, -1),
        future: [project, ...future],
        dirty: true,
        transientBase: null,
        selectedId: prev.items.some((i) => i.id === selectedId) ? selectedId : null,
      });
    },
    redo: () => {
      const { past, project, future, selectedId } = get();
      if (!future.length) return;
      const next = future[0];
      set({
        project: next,
        past: [...past, project].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        dirty: true,
        transientBase: null,
        selectedId: next.items.some((i) => i.id === selectedId) ? selectedId : null,
      });
    },
    markSaved: (path) => set({ dirty: false, projectPath: path }),
  };
});
