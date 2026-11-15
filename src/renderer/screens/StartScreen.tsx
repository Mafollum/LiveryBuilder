import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import type { CarClass, CarTemplate } from '@shared/types';

const CLASS_ORDER: CarClass[] = ['Hypercar', 'LMP2', 'LMP3', 'GT3', 'GTE', 'Other'];

type Status =
  | { kind: 'loading' }
  | { kind: 'noLmu' }
  | { kind: 'noTemplates'; folder: string }
  | { kind: 'ready'; folder: string; templates: CarTemplate[] };

interface Props {
  onOpenCar(t: CarTemplate): void;
  onOpenProject?(): void;
  children?: React.ReactNode;
}

export function StartScreen({ onOpenCar, onOpenProject, children }: Props): React.JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const folder = await window.lmu.getLmuFolder();
    if (!folder) return setStatus({ kind: 'noLmu' });
    const templates = await window.lmu.listTemplates();
    setStatus(templates.length ? { kind: 'ready', folder, templates } : { kind: 'noTemplates', folder });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async () => {
    const res = await window.lmu.chooseLmuFolder();
    if (!res) return;
    if ('error' in res) return setError(res.error);
    setError(null);
    await load();
  };

  const chooseButton = (
    <button type="button" className="primary" onClick={choose}>
      Choose LMU folder…
    </button>
  );

  return (
    <div className="start">
      <header className="start-header">
        <h1>LMU Livery Builder</h1>
        {onOpenProject && (
          <button type="button" onClick={onOpenProject}>
            Open project…
          </button>
        )}
      </header>
      {children}
      {error && <p className="error">{error}</p>}
      {status.kind === 'loading' && <p>Looking for Le Mans Ultimate…</p>}
      {status.kind === 'noLmu' && (
        <div className="notice">
          <p>Couldn't find Le Mans Ultimate on this PC.</p>
          {chooseButton}
        </div>
      )}
      {status.kind === 'noTemplates' && (
        <div className="notice">
          <p>No car templates found in {status.folder}</p>
          {chooseButton}
        </div>
      )}
      {status.kind === 'ready' && (
        <div className="car-list">
          <p className="hint">Pick a car to start a new livery.</p>
          {CLASS_ORDER.map((cls) => {
            const cars = status.templates.filter((t) => t.carClass === cls).sort((a, b) => a.label.localeCompare(b.label));
            if (!cars.length) return null;
            return (
              <section key={cls} className="car-class">
                <h2>{cls}</h2>
                <div className="car-buttons">
                  {cars.map((t) => (
                    <button type="button" key={t.fileName} className="car" onClick={() => onOpenCar(t)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
