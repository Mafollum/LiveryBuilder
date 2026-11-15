import type React from 'react';

export interface DialogButton { label: string; primary?: boolean; onClick(): void }

/** A simple modal dialog with a title, a message and buttons. */
export function Dialog({ title, message, buttons }: { title: string; message?: React.ReactNode; buttons: DialogButton[] }): React.JSX.Element {
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {message && <div className="dialog-message">{message}</div>}
        <div className="dialog-buttons">
          {buttons.map((b) => (
            <button key={b.label} type="button" className={b.primary ? 'primary' : ''} onClick={b.onClick} autoFocus={b.primary}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
