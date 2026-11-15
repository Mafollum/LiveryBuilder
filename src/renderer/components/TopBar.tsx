import type React from 'react';
import { useEditor } from '../state/store';

interface Props {
  title: string;
  onBack(): void;
  onFit(): void;
  children?: React.ReactNode;
}

export function TopBar({ title, onBack, onFit, children }: Props): React.JSX.Element {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo } = useEditor.getState();
  return (
    <div className="topbar">
      <button type="button" onClick={onBack}>← Cars</button>
      <span className="car-title">{title}</span>
      <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>↶</button>
      <button type="button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo}>↷</button>
      <span className="spacer" />
      <button type="button" onClick={onFit}>Fit</button>
      {children}
    </div>
  );
}
