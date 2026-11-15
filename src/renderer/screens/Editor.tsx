import { useEffect, useRef } from 'react';
import type React from 'react';
import { useEditor } from '../state/store';
import { CanvasView } from '../canvas/CanvasView';
import { setCurrentView } from '../canvas/viewRegistry';
import { TopBar } from '../components/TopBar';
import { ColourPicker } from '../components/ColourPicker';

interface Props { onBack(): void }

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
    return () => {
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
        <div className="canvas-column">
          <div className="canvas-holder" ref={holder} />
          <div className="canvas-footer">
            <ColourPicker label="Car colour" value={carColour} onChange={setCarColour} />
            {panel?.source === 'none' && <span className="note">This car's template has no panel outlines</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
