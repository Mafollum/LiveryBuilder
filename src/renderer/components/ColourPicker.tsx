import { useEffect, useState } from 'react';
import type React from 'react';
import { useEditor } from '../state/store';

const HEX = /^#[0-9a-f]{6}$/i;

interface Props {
  label: string;
  value: string;
  onChange(colour: string): void;
}

/** Colour square, hex field and the last 8 colours used. */
export function ColourPicker({ label, value, onChange }: Props): React.JSX.Element {
  const recent = useEditor((s) => s.recentColours);
  const useColour = useEditor((s) => s.useColour);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const apply = (c: string) => {
    const v = c.toLowerCase();
    if (!HEX.test(v)) return setText(value);
    useColour(v);
    if (v !== value.toLowerCase()) onChange(v);
  };

  return (
    <div className="colour-picker">
      <span className="colour-label">{label}</span>
      <input type="color" title="Choose colour" aria-label="Choose colour" value={HEX.test(value) ? value : '#000000'} onChange={(e) => apply(e.target.value)} />
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
