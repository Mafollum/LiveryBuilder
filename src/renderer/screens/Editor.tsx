import { useCallback, useEffect, useRef, useState } from 'react';
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
import { TextOverlay, type TextEdit } from '../components/TextOverlay';
import { importImageFile } from '../canvas/importImage';
import { getAssetImage } from '../state/assets';
import { BrushCache } from '../canvas/brush';
import { newTextItem } from '../state/factories';
import type { TextItem } from '@shared/types';

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
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  const addFiles = useCallback(async (files: Iterable<File>) => {
    const view = viewRef.current;
    const holderEl = holder.current;
    if (!view || !holderEl) return;
    for (const file of files) {
      const r = holderEl.getBoundingClientRect();
      const centre = view.clientToTexture(r.left + r.width / 2, r.top + r.height / 2);
      const scale = view.getView().scale;
      const res = await importImageFile(file, { centreX: centre.x, centreY: centre.y, maxW: (r.width * 0.8) / scale, maxH: (r.height * 0.8) / scale });
      if ('error' in res) setNotice(res.error);
      else {
        setNotice(null);
        useEditor.getState().addItem(res);
        useEditor.getState().setTool('select');
      }
    }
  }, []);

  useEffect(() => {
    const view = new CanvasView(holder.current!);
    viewRef.current = view;
    setCurrentView(view);
    const brushes = new BrushCache();
    view.nodeContext = {
      getImage: (id) => getAssetImage(id),
      getBrushCanvas: (item) => {
        const p = useEditor.getState().panel;
        return brushes.get(item, p?.width ?? 1, p?.height ?? 1);
      },
    };
    const tools = new ToolController(view);
    tools.onNotice = (m) => setNotice(m);
    tools.onTextRequest = (at) => setTextEdit({ mode: 'new', at });
    view.callbacks = {
      editText: (id) => {
        const it = useEditor.getState().project.items.find((i) => i.id === id);
        if (it?.type === 'text') setTextEdit({ mode: 'edit', item: it });
      },
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
      view.stage.container().style.cursor = s.tool === 'select' ? '' : 'crosshair';
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
        <Toolbar
          extra={
            <>
              <button type="button" className="tool" onClick={() => fileInput.current?.click()}>
                <span className="tool-icon" aria-hidden>🖼</span>
                Image
              </button>
              <input
                ref={fileInput}
                type="file"
                aria-label="Image file"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                multiple
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = '';
                  void addFiles(files);
                }}
              />
            </>
          }
        />
        <div className="canvas-column">
          <div
            className="canvas-holder"
            ref={holder}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles([...e.dataTransfer.files]);
            }}
          >
            {textEdit && holder.current && (
              <TextOverlay
                key={textEdit.mode === 'edit' ? textEdit.item.id : `${textEdit.at.x},${textEdit.at.y}`}
                edit={textEdit}
                holder={holder.current}
                defaultFont="Arial Black"
                defaultSize={200}
                onCancel={() => setTextEdit(null)}
                onCommit={(text) => {
                  const st = useEditor.getState();
                  if (textEdit.mode === 'edit') st.updateItem(textEdit.item.id, { text } as Partial<TextItem>);
                  else {
                    const it = newTextItem(textEdit.at, st.brush.colour);
                    it.text = text;
                    st.addItem(it);
                    st.setTool('select');
                  }
                  setTextEdit(null);
                }}
              />
            )}
            {notice && (
              <div className="notice-banner" role="alert">
                {notice}
                <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
              </div>
            )}
          </div>
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
