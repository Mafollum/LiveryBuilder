import { useState } from 'react';
import type React from 'react';
import { useEditor } from '../state/store';

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
