import { useEffect, useState } from 'react';
import type React from 'react';
import type { CarTemplate } from '@shared/types';
import { StartScreen } from './screens/StartScreen';

export function App(): React.JSX.Element {
  const [, setCar] = useState<CarTemplate | null>(null);
  useEffect(() => {
    window.lmu.ready();
  }, []);
  return (
    <div className="app">
      <StartScreen onOpenCar={setCar} />
    </div>
  );
}
