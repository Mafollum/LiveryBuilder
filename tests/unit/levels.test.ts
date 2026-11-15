import { describe, it, expect } from 'vitest';
import { buildLevelsLut, applyLevels } from '@shared/levels';

const ch = (shadowInput: number, highlightInput: number, shadowOutput: number, highlightOutput: number, midtoneInput: number) =>
  ({ shadowInput, highlightInput, shadowOutput, highlightOutput, midtoneInput });

describe('buildLevelsLut', () => {
  it('compresses the output range linearly', () => {
    const lut = buildLevelsLut(ch(0, 255, 10, 210, 1));
    expect(lut[0]).toBe(10);
    expect(lut[255]).toBe(210);
    expect(lut[128]).toBe(110);
  });
  it('applies gamma from midtoneInput', () => {
    expect(buildLevelsLut(ch(0, 255, 0, 255, 2))[128]).toBe(181);
  });
  it('caps highlights', () => {
    expect(buildLevelsLut(ch(0, 255, 0, 190, 1))[255]).toBe(190);
  });
});

describe('applyLevels', () => {
  it('changes RGB with the master channel and keeps alpha', () => {
    const px = new Uint8ClampedArray([255, 0, 128, 77]);
    applyLevels(px, { channels: [ch(0, 255, 10, 210, 1)] });
    expect(Array.from(px)).toEqual([210, 10, 110, 77]);
  });
  it('does nothing without levels', () => {
    const px = new Uint8ClampedArray([255, 0, 128, 77]);
    applyLevels(px, null);
    expect(Array.from(px)).toEqual([255, 0, 128, 77]);
  });
});
