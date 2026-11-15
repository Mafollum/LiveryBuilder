import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useEditor } from '../state/store';

const HEX = /^#[0-9a-f]{6}$/i;

interface Props {
  label: string;
  value: string;
  /** transient = live preview while dragging in the colour square; a commit follows. */
  onChange(colour: string, transient: boolean): void;
  /** Called once a transient sequence ends (the colour square closed). */
  onCommit?(): void;
}

/** Colour square, hex field and the last 8 colours used. */
export function ColourPicker({ label, value, onChange, onCommit }: Props): React.JSX.Element {
  const recent = useEditor((s) => s.recentColours);
  const useColour = useEditor((s) => s.useColour);
  const [text, setText] = useState(value);
  const square = useRef<HTMLInputElement>(null);
  const latest = useRef({ onChange, onCommit, value });
  latest.current = { onChange, onCommit, value };
  useEffect(() => setText(value), [value]);

  // the native "change" event fires once when the colour square is closed: commit there
  useEffect(() => {
    const el = square.current!;
    const done = () => {
      const v = el.value.toLowerCase();
      useColour(v);
      latest.current.onCommit?.();
    };
    el.addEventListener('change', done);
    return () => el.removeEventListener('change', done);
  }, [useColour]);

  const apply = (c: string) => {
    const v = c.toLowerCase();
    if (!HEX.test(v)) return setText(value);
    useColour(v);
    if (v !== value.toLowerCase()) onChange(v, false);
  };

  return (
    <div className="colour-picker">
      <span className="colour-label">{label}</span>
      <input
        ref={square}
        type="color"
        title="Choose colour"
        aria-label="Choose colour"
        value={HEX.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toLowerCase(), true)}
      />
      <input
        type="text"
        className="hex"
        aria-label={label}
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply(text.startsWith('#') ? text : `#${text}`);
        }}
        onBlur={() => apply(text.startsWith('#') ? text : `#${text}`)}
      />
      {recent.length > 0 && (
        <div className="recent" aria-label="Recent colours">
          {recent.map((c) => (
            <button key={c} type="button" className="swatch" title={c} style={{ background: c }} onClick={() => apply(c)} />
          ))}
        </div>
      )}
    </div>
  );
}
