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
    brushCanvasSize: (id: string) => {
      const item = useEditor.getState().project.items.find((i) => i.id === id);
      const cache = (window as unknown as { __liveryBrushes?: { get(i: unknown): { canvas: HTMLCanvasElement } | null } }).__liveryBrushes;
      const img = item && cache ? cache.get(item) : null;
      return img ? { width: img.canvas.width, height: img.canvas.height } : null;
    },
  };
}

createRoot(document.getElementById('root')!).render(<App />);
