import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { CarTemplate } from '@shared/types';
import { StartScreen } from './screens/StartScreen';
import { Editor } from './screens/Editor';
import { useEditor } from './state/store';
import { Dialog } from './components/Dialog';
import { isTyping } from './canvas/CanvasView';
import { currentProjectBytes, MissingTemplateError, openProjectBytes, openWithTemplateFile, saveCurrent } from './project/projectActions';

type Screen = { kind: 'start' } | { kind: 'opening'; label: string } | { kind: 'editor' };
type Modal =
  | { kind: 'restore'; bytes: Uint8Array }
  | { kind: 'missingTemplate'; err: MissingTemplateError }
  | { kind: 'saveChanges' }
  | { kind: 'message'; text: string };

const APP_TITLE = 'LMU Livery Builder';
const baseName = (p: string) => p.split(/[\\/]/).pop()!.replace(/\.lmulivery$/i, '');

export function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' });
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const projectPath = useEditor((s) => s.projectPath);
  const dirty = useEditor((s) => s.dirty);
  const label = useEditor((s) => s.template?.label);

  useEffect(() => {
    window.lmu.ready();
    void window.lmu.readAutosave().then((bytes) => bytes && setModal({ kind: 'restore', bytes }));
  }, []);

  useEffect(() => {
    if (screen.kind !== 'editor') document.title = APP_TITLE;
    else document.title = `${projectPath ? baseName(projectPath) : label}${dirty ? '*' : ''} — ${APP_TITLE}`;
  }, [screen, projectPath, dirty, label]);

  const openCar = async (car: CarTemplate) => {
    setError(null);
    setScreen({ kind: 'opening', label: car.label });
    try {
      const panel = await window.lmu.openTemplate(car.fileName);
      useEditor.getState().openCar(car, panel);
      setScreen({ kind: 'editor' });
    } catch (e) {
      setError(`Couldn't open ${car.label}: ${e instanceof Error ? e.message : String(e)}`);
      setScreen({ kind: 'start' });
    }
  };

  const openBytes = useCallback(async (bytes: Uint8Array, path: string | null, restored = false) => {
    const back = screenRef.current;
    setScreen({ kind: 'opening', label: path ? baseName(path) : 'your livery' });
    try {
      await openProjectBytes(bytes, path, restored);
      setScreen({ kind: 'editor' });
    } catch (e) {
      setScreen(back.kind === 'opening' ? { kind: 'start' } : back);
      if (e instanceof MissingTemplateError) setModal({ kind: 'missingTemplate', err: e });
      else setModal({ kind: 'message', text: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const openProject = useCallback(async () => {
    const res = await window.lmu.openProject();
    if (res) await openBytes(res.bytes, res.path);
  }, [openBytes]);

  const openRecent = async (path: string) => {
    const res = await window.lmu.openRecentProject(path);
    if (res) await openBytes(res.bytes, res.path);
    else setModal({ kind: 'message', text: `${path} isn't there any more.` });
  };

  // keyboard: Ctrl+O everywhere, Ctrl+S / Ctrl+Shift+S in the editor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'o') {
        e.preventDefault();
        void openProject();
      } else if (k === 's' && screenRef.current.kind === 'editor') {
        e.preventDefault();
        void saveCurrent(e.shiftKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openProject]);

  // autosave while there are unsaved changes
  useEffect(() => {
    const t = setInterval(() => {
      if (screenRef.current.kind === 'editor' && useEditor.getState().dirty) void currentProjectBytes().then((b) => window.lmu.writeAutosave(b));
    }, window.lmu.autosaveMs);
    return () => clearInterval(t);
  }, []);

  // closing the window
  useEffect(() => {
    window.lmu.onCloseRequested(async () => {
      if (screenRef.current.kind === 'editor' && useEditor.getState().dirty) setModal({ kind: 'saveChanges' });
      else {
        await window.lmu.clearAutosave();
        window.lmu.closeNow();
      }
    });
  }, []);

  const goBack = () => {
    if (useEditor.getState().dirty) void currentProjectBytes().then((b) => window.lmu.writeAutosave(b));
    setScreen({ kind: 'start' });
  };

  return (
    <div className="app">
      {screen.kind === 'start' && (
        <StartScreen onOpenCar={openCar} onOpenProject={() => void openProject()} onOpenRecent={(p) => void openRecent(p)}>
          {error && <p className="error">{error}</p>}
        </StartScreen>
      )}
      {screen.kind === 'opening' && <div className="opening">Opening {screen.label}…</div>}
      {screen.kind === 'editor' && <Editor onBack={goBack} onSave={() => void saveCurrent(false)} />}

      {modal?.kind === 'restore' && (
        <Dialog
          title="Restore your last unsaved work?"
          message={<p>The livery builder closed without saving. You can pick up where you left off.</p>}
          buttons={[
            { label: 'Restore', primary: true, onClick: () => { const b = modal.bytes; setModal(null); void openBytes(b, null, true); } },
            { label: 'Discard', onClick: () => { setModal(null); void window.lmu.clearAutosave(); } },
          ]}
        />
      )}
      {modal?.kind === 'missingTemplate' && (
        <Dialog
          title="Car template not found"
          message={<p>{modal.err.message}</p>}
          buttons={[
            {
              label: 'Choose template file…',
              primary: true,
              onClick: async () => {
                const file = await window.lmu.chooseTemplateFile();
                if (!file) return;
                const err = modal.err;
                setModal(null);
                setScreen({ kind: 'opening', label: err.fileName });
                try {
                  await openWithTemplateFile(err, file);
                  setScreen({ kind: 'editor' });
                } catch (e) {
                  setScreen({ kind: 'start' });
                  setModal({ kind: 'message', text: `Couldn't open that template: ${e instanceof Error ? e.message : String(e)}` });
                }
              },
            },
            { label: 'Cancel', onClick: () => setModal(null) },
          ]}
        />
      )}
      {modal?.kind === 'saveChanges' && (
        <Dialog
          title="Save changes?"
          message={<p>Your livery has changes that aren't saved yet.</p>}
          buttons={[
            {
              label: 'Save',
              primary: true,
              onClick: async () => {
                if (await saveCurrent(false)) {
                  setModal(null);
                  window.lmu.closeNow();
                }
              },
            },
            { label: "Don't save", onClick: async () => { setModal(null); await window.lmu.clearAutosave(); window.lmu.closeNow(); } },
            { label: 'Cancel', onClick: () => setModal(null) },
          ]}
        />
      )}
      {modal?.kind === 'message' && <Dialog title="Something's not right" message={<p>{modal.text}</p>} buttons={[{ label: 'OK', primary: true, onClick: () => setModal(null) }]} />}
    </div>
  );
}
