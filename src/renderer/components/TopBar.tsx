import type React from 'react';

interface Props {
  title: string;
  onBack(): void;
  onFit(): void;
  children?: React.ReactNode;
}

export function TopBar({ title, onBack, onFit, children }: Props): React.JSX.Element {
  return (
    <div className="topbar">
      <button type="button" onClick={onBack}>← Cars</button>
      <span className="car-title">{title}</span>
      <span className="spacer" />
      <button type="button" onClick={onFit}>Fit</button>
      {children}
    </div>
  );
}
