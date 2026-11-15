import { useEffect, useState } from 'react';
import type React from 'react';
import { FINISHES } from '@shared/finish';
import type { FinishId, Item } from '@shared/types';
import { useEditor } from '../state/store';
import { ColourPicker } from './ColourPicker';

const FINISH_HINT = "You choose what each finish looks like in the game's showroom.";
export const FONTS = ['Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Consolas', 'Impact', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana'];

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange(v: number): void }) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => setText(String(Math.round(value))), [value]);
  const apply = () => {
    const v = Number(text);
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
    else setText(String(Math.round(value)));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" aria-label={label} min={min} max={max} value={text} onChange={(e) => setText(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === 'Enter' && apply()} />
    </label>
  );
}

function NameField({ item }: { item: Item }) {
  const updateItem = useEditor((s) => s.updateItem);
  const [text, setText] = useState(item.name);
  useEffect(() => setText(item.name), [item.id, item.name]);
  const apply = () => {
    const v = text.trim();
    if (v && v !== item.name) updateItem(item.id, { name: v });
    else setText(item.name);
  };
  return (
    <label className="field">
      <span>Name</span>
      <input type="text" aria-label="Name" value={text} onChange={(e) => setText(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === 'Enter' && apply()} />
    </label>
  );
}

function Percent({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="range" aria-label={label} min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <span className="value">{Math.round(value * 100)}%</span>
    </label>
  );
}

export function PropertiesPanel({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const item = useEditor((s) => s.project.items.find((i) => i.id === s.selectedId) ?? null);
  const brush = useEditor((s) => s.brush);
  const tool = useEditor((s) => s.tool);
  const { updateItem, commitTransient, setBrush, flipItem, duplicateItem, removeItem } = useEditor.getState();

  if (tool === 'brush' || tool === 'eraser') {
    return (
      <div className="props">
        <h3>{tool === 'brush' ? 'Brush' : 'Eraser'}</h3>
        {tool === 'brush' && <ColourPicker label="Brush colour" value={brush.colour} onChange={(c) => setBrush({ colour: c })} />}
        <NumberField label="Brush size" value={brush.size} min={1} max={1000} onChange={(v) => setBrush({ size: v })} />
        <Percent label="Brush opacity" value={brush.opacity} onChange={(v) => setBrush({ opacity: v })} />
        <Percent label="Softness" value={brush.softness} onChange={(v) => setBrush({ softness: v })} />
        <p className="hint small">
          {tool === 'brush'
            ? 'Painting adds to the selected brush item, or starts a new one.'
            : 'The eraser removes paint from the selected brush item only.'}
        </p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="props">
        <h3>Colour for new items</h3>
        <ColourPicker label="Fill" value={brush.colour} onChange={(c) => setBrush({ colour: c })} />
        {children}
      </div>
    );
  }

  const set = (patch: Partial<Item>) => updateItem(item.id, patch);
  return (
    <div className="props">
      <h3>Selected item</h3>
      <NameField item={item} />
      {item.type === 'shape' && (
        <>
          <ColourPicker label="Fill" value={item.fill} onChange={(c, t) => { updateItem(item.id, { fill: c }, { transient: t }); setBrush({ colour: c }); }} onCommit={commitTransient} />
          <ColourPicker label="Outline colour" value={item.stroke} onChange={(c, t) => updateItem(item.id, { stroke: c }, { transient: t })} onCommit={commitTransient} />
          <NumberField label="Outline width" value={item.strokeWidth} min={0} max={200} onChange={(v) => set({ strokeWidth: v })} />
          {item.shape === 'rect' && <NumberField label="Corner radius" value={item.cornerRadius} min={0} max={2000} onChange={(v) => set({ cornerRadius: v })} />}
          {item.shape === 'line' && <NumberField label="Thickness" value={item.height} min={1} max={2000} onChange={(v) => set({ height: v })} />}
        </>
      )}
      {item.type === 'text' && (
        <>
          <label className="field">
            <span>Font</span>
            <select aria-label="Font" value={item.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </label>
          <NumberField label="Size" value={item.fontSize} min={8} max={2000} onChange={(v) => set({ fontSize: v })} />
          <ColourPicker label="Fill" value={item.fill} onChange={(c, t) => { updateItem(item.id, { fill: c }, { transient: t }); setBrush({ colour: c }); }} onCommit={commitTransient} />
          <div className="button-row">
            <button type="button" aria-pressed={item.bold} className={item.bold ? 'active' : ''} onClick={() => set({ bold: !item.bold })}>Bold</button>
            <button type="button" aria-pressed={item.italic} className={item.italic ? 'active' : ''} onClick={() => set({ italic: !item.italic })}>Italic</button>
          </div>
          <ColourPicker label="Outline colour" value={item.stroke} onChange={(c, t) => updateItem(item.id, { stroke: c }, { transient: t })} onCommit={commitTransient} />
          <NumberField label="Outline width" value={item.strokeWidth} min={0} max={200} onChange={(v) => set({ strokeWidth: v })} />
          <p className="hint small">Double-click the text on the car to change it.</p>
        </>
      )}
      {children}
      <label className="field">
        <span>Opacity</span>
        <input
          type="range"
          aria-label="Opacity"
          min={0}
          max={100}
          value={Math.round(item.opacity * 100)}
          onChange={(e) => updateItem(item.id, { opacity: Number(e.target.value) / 100 }, { transient: true })}
          onPointerUp={commitTransient}
          onKeyUp={commitTransient}
          onBlur={commitTransient}
        />
        <span className="value">{Math.round(item.opacity * 100)}%</span>
      </label>
      <label className="field">
        <span>Finish</span>
        <select aria-label="Finish" value={item.finish} onChange={(e) => set({ finish: e.target.value as FinishId })}>
          {FINISHES.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <span className="finish-swatch" style={{ background: `rgb(${FINISHES.find((f) => f.id === item.finish)!.rgb.join(',')})` }} />
      </label>
      <p className="hint small">{FINISH_HINT}</p>
      <div className="button-row">
        <button type="button" title="Flip horizontally" onClick={() => flipItem(item.id, 'h')}>Flip ⇆</button>
        <button type="button" title="Flip vertically" onClick={() => flipItem(item.id, 'v')}>Flip ⇅</button>
        <button type="button" onClick={() => duplicateItem(item.id)}>Duplicate</button>
        <button type="button" onClick={() => removeItem(item.id)}>Delete</button>
      </div>
    </div>
  );
}
