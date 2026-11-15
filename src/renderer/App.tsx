import { useEffect, useState } from 'react';
import type React from 'react';
import type { CarTemplate } from '@shared/types';
import { StartScreen } from './screens/StartScreen';
import { Editor } from './screens/Editor';
import { useEditor } from './state/store';

type Screen = { kind: 'start' } | { kind: 'opening'; car: CarTemplate } | { kind: 'editor' };

export function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.lmu.ready();
  }, []);

  const openCar = async (car: CarTemplate) => {
    setError(null);
    setScreen({ kind: 'opening', car });
    try {
      const panel = await window.lmu.openTemplate(car.fileName);
      useEditor.getState().openCar(car, panel);
      setScreen({ kind: 'editor' });
    } catch (e) {
      setError(`Couldn't open ${car.label}: ${e instanceof Error ? e.message : String(e)}`);
      setScreen({ kind: 'start' });
    }
  };

  return (
    <div className="app">
      {screen.kind === 'start' && (
        <StartScreen onOpenCar={openCar}>{error && <p className="error">{error}</p>}</StartScreen>
      )}
      {screen.kind === 'opening' && <div className="opening">Opening {screen.car.label}…</div>}
      {screen.kind === 'editor' && <Editor onBack={() => setScreen({ kind: 'start' })} />}
    </div>
  );
}
