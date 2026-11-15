import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { TextItem } from '@shared/types';
import { getCurrentView } from '../canvas/viewRegistry';

export type TextEdit = { mode: 'new'; at: { x: number; y: number } } | { mode: 'edit'; item: TextItem };

interface Props {
  edit: TextEdit;
  holder: HTMLDivElement;
  defaultFont: string;
  defaultSize: number;
  onCommit(text: string): void;
  onCancel(): void;
}

/** A text box over the canvas for typing new text or changing existing text. */
export function TextOverlay({ edit, holder, defaultFont, defaultSize, onCommit, onCancel }: Props): React.JSX.Element | null {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(edit.mode === 'edit' ? edit.item.text : '');
  const done = useRef(false);
  const view = getCurrentView();

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!view) return null;
  const at = edit.mode === 'edit' ? { x: edit.item.x, y: edit.item.y } : edit.at;
  const c = view.textureToClient(at.x, at.y);
  const r = holder.getBoundingClientRect();
  const scale = view.getView().scale;
  const font = edit.mode === 'edit' ? edit.item.fontFamily : defaultFont;
  const size = (edit.mode === 'edit' ? edit.item.fontSize * Math.abs(edit.item.scaleY) : defaultSize) * scale;

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit && value.trim()) onCommit(value);
    else onCancel();
  };

  return (
    <textarea
      ref={ref}
      aria-label="Text"
      className="text-overlay"
      value={value}
      rows={1}
      style={{ left: c.x - r.left, top: c.y - r.top, fontFamily: font, fontSize: Math.max(12, size) }}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}
