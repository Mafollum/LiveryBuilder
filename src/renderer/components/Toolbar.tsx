import type React from 'react';
import { useEditor, type ToolId } from '../state/store';

export interface ToolButton { id: ToolId; label: string; icon: string }

export const TOOLS: ToolButton[] = [
  { id: 'select', label: 'Select', icon: '⬚' },
  { id: 'brush', label: 'Brush', icon: '🖌' },
  { id: 'eraser', label: 'Eraser', icon: '⌫' },
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'ellipse', label: 'Circle', icon: '◯' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'triangle', label: 'Triangle', icon: '△' },
  { id: 'text', label: 'Text', icon: 'T' },
];

export function Toolbar({ extra }: { extra?: React.ReactNode }): React.JSX.Element {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button key={t.id} type="button" className={tool === t.id ? 'tool active' : 'tool'} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
          <span className="tool-icon" aria-hidden>{t.icon}</span>
          {t.label}
        </button>
      ))}
      {extra}
    </div>
  );
}
