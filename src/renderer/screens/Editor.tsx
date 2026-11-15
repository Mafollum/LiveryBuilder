import { useEffect, useRef } from 'react';
import type React from 'react';
import { useEditor } from '../state/store';
import { CanvasView, isTyping } from '../canvas/CanvasView';
import { ToolController } from '../canvas/tools';
import { setCurrentView } from '../canvas/viewRegistry';
import { TopBar } from '../components/TopBar';
import { ColourPicker } from '../components/ColourPicker';
import { Toolbar } from '../components/Toolbar';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { ItemsList } from '../components/ItemsList';

interface Props { onBack(): void }

const NUDGE = 1;
const NUDGE_BIG = 10;

function onShortcut(e: KeyboardEvent): void {
  if (isTyping(e.target)) return;
  const st = useEditor.getState();
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (ctrl && key === 'z' && !e.shiftKey) { e.preventDefault(); st.undo(); return; }
  if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); st.redo(); return; }
  if (ctrl) return;
  if (e.key === 'Escape') { st.select(null); return; }
  const sel = st.project.items.find((i) => i.id === st.selectedId);
  if (!sel) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); st.removeItem(sel.id); return; }
  const step = e.shiftKey ? NUDGE_BIG : NUDGE;
  const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  const m = moves[e.key];
  if (m) { e.preventDefault(); st.updateItem(sel.id, { x: sel.x + m[0], y: sel.y + m[1] }); }
}

export function Editor({ onBack }: Props): React.JSX.Element {
  const holder = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CanvasView | null>(null);
  const template = useEditor((s) => s.template);
  const panel = useEditor((s) => s.panel);
  const carColour = useEditor((s) => s.project.carColour);
  const setCarColour = useEditor((s) => s.setCarColour);

  useEffect(() => {
    const view = new CanvasView(holder.current!);
    viewRef.current = view;
    setCurrentView(view);
    const tools = new ToolController(view);
    view.callbacks = {
      select: (id) => useEditor.getState().select(id),
      geometry: (id, g) => {
        const st = useEditor.getState();
        st.updateItem(id, g, { transient: true });
        st.commitTransient();
      },
    };
    const sync = () => {
      const s = useEditor.getState();
      view.syncItems(s.project.items, s.selectedId, s.tool === 'select');
    };
    sync();
    const unsub = useEditor.subscribe(sync);
    window.addEventListener('keydown', onShortcut);
    return () => {
      window.removeEventListener('keydown', onShortcut);
      unsub();
      tools.destroy();
      setCurrentView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (panel) viewRef.current?.setPanel(panel, useEditor.getState().project.carColour);
  }, [panel]);

  useEffect(() => {
    viewRef.current?.setCarColour(carColour);
  }, [carColour]);

  return (
    <div className="editor">
      <TopBar title={template?.label ?? ''} onBack={onBack} onFit={() => viewRef.current?.fit()} />
      <div className="editor-body">
        <Toolbar />
        <div className="canvas-column">
          <div className="canvas-holder" ref={holder} />
          <div className="canvas-footer">
            <ColourPicker label="Car colour" value={carColour} onChange={setCarColour} />
            {panel?.source === 'none' && <span className="note">This car's template has no panel outlines</span>}
          </div>
        </div>
        <div className="side-panel">
          <PropertiesPanel />
          <ItemsList />
        </div>
      </div>
    </div>
  );
}
