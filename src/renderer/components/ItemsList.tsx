import { useState } from 'react';
import type React from 'react';
import { useEditor } from '../state/store';
import { fixedShown } from '@shared/types';

/** The template's fixed elements (number plates, stickers…), one row per kind, top-most first. */
function FixedList(): React.JSX.Element | null {
  const fixed = useEditor((s) => s.panel?.fixed);
  const visibility = useEditor((s) => s.project.fixedVisibility);
  const setFixedVisible = useEditor((s) => s.setFixedVisible);
  if (!fixed?.length) return null;
  const labels = [...new Set([...fixed].reverse().map((f) => f.label))];
  return (
    <div className="fixed-panel">
      <h3>On the car</h3>
      <p className="hint small">From the car's template. They sit on top of your design and are sent to the game with it.</p>
      <ul className="items" aria-label="On the car">
        {labels.map((label) => {
          const shown = fixed.some((f) => f.label === label && fixedShown(f, visibility));
          return (
            <li key={label} className="fixed-row">
              <button type="button" className="eye" aria-label={`${shown ? 'Hide' : 'Show'} ${label}`} onClick={() => setFixedVisible(label, !shown)}>
                {shown ? '◉' : '○'}
              </button>
              <span className="item-name">{label}</span>
              <span className="lock" title="Part of the template" aria-hidden>🔒</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** All items, newest (top-most) first. Drag rows to reorder, double-click to rename. */
export function ItemsList(): React.JSX.Element {
  const items = useEditor((s) => s.project.items);
  const selectedId = useEditor((s) => s.selectedId);
  const { select, updateItem, moveItem } = useEditor.getState();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const rows = [...items].reverse();

  const commitName = (id: string) => {
    const v = draft.trim();
    if (v) updateItem(id, { name: v });
    setEditing(null);
  };

  return (
    <div className="items-panel">
      <FixedList />
      <h3>Items</h3>
      {rows.length === 0 && <p className="hint small">Nothing yet. Pick a tool on the left.</p>}
      <ul className="items" aria-label="Items">
        {rows.map((it) => (
          <li
            key={it.id}
            className={it.id === selectedId ? 'selected' : ''}
            draggable={editing !== it.id}
            onClick={() => select(it.id)}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id && id !== it.id) moveItem(id, useEditor.getState().project.items.findIndex((x) => x.id === it.id));
            }}
          >
            <button
              type="button"
              className="eye"
              aria-label={`${it.visible ? 'Hide' : 'Show'} ${it.name}`}
              onClick={(e) => {
                e.stopPropagation();
                updateItem(it.id, { visible: !it.visible });
              }}
            >
              {it.visible ? '◉' : '○'}
            </button>
            {editing === it.id ? (
              <input
                aria-label="Item name"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitName(it.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName(it.id);
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <span
                className="item-name"
                onDoubleClick={() => {
                  setDraft(it.name);
                  setEditing(it.id);
                }}
              >
                {it.name}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
