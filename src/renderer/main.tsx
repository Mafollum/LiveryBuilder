import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useEditor } from './state/store';
import { getCurrentView } from './canvas/viewRegistry';
import './styles.css';

if (window.lmu.isTest) {
  (window as unknown as { __livery: unknown }).__livery = {
    getState: () => useEditor.getState(),
    textureToClient: (x: number, y: number) => getCurrentView()!.textureToClient(x, y),
    clientToTexture: (x: number, y: number) => getCurrentView()!.clientToTexture(x, y),
    getView: () => getCurrentView()!.getView(),
    isCanvasReady: () => !!getCurrentView()?.isReady(),
  };
}

createRoot(document.getElementById('root')!).render(<App />);
