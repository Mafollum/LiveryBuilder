import { describe, it, expect } from 'vitest';
import { FINISHES, finishById, defaultFinishFor } from '@shared/finish';

describe('finishes', () => {
  it('has the five finishes in order', () => {
    expect(FINISHES.map((f) => f.id)).toEqual(['paint', 'carbon', 'special1', 'special2', 'sticker']);
    expect(FINISHES.map((f) => f.label)).toEqual(['Paint', 'Carbon', 'Special 1', 'Special 2', 'Sticker']);
  });
  it('maps finishes to pure region colours', () => {
    expect(FINISHES.map((f) => f.rgb)).toEqual([
      [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255],
    ]);
    expect(finishById('carbon').rgb).toEqual([255, 0, 0]);
  });
  it('picks default finishes per item type', () => {
    expect(defaultFinishFor('image')).toBe('sticker');
    expect(defaultFinishFor('text')).toBe('sticker');
    expect(defaultFinishFor('shape')).toBe('paint');
    expect(defaultFinishFor('brush')).toBe('paint');
  });
});
