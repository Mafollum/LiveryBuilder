import type React from 'react';
import { useEffect } from 'react';

export function App(): React.JSX.Element {
  useEffect(() => {
    window.lmu.ready();
  }, []);
  return <div className="app" />;
}
