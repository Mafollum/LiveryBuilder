import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { carDisplayName } from '../../src/main/templates/carName';

const REAL_DIR = '/home/user/lmu-data/tpl/LiveryTemplates';

describe('carDisplayName', () => {
  it.each([
    ['Template_GT3_Ferrari296LMGT3_2025_ELMS.psd', 'GT3', 'Ferrari 296 LMGT3 — 2025 ELMS'],
    ['Template_GT3_McLaren720EVO_2025 _ELMS.psd', 'GT3', 'McLaren 720 EVO — 2025 ELMS'],
    ['Template_GT3_FordMustang_EVO_LMGT3.psd', 'GT3', 'Ford Mustang LMGT3 — EVO'],
    ['Template_GT3_CorvetteZ06LMGT3.psd', 'GT3', 'Corvette Z06 LMGT3'],
    ['Template_GT3_BMWM4LMGT3_2025.psd', 'GT3', 'BMW M4 LMGT3 — 2025'],
    ['Template_GTE_CorvetteC8R.psd', 'GTE', 'Corvette C8R'],
    ['Template_HYPER_BMWMHybrid_EVO.psd', 'Hypercar', 'BMW M Hybrid — EVO'],
    ['Template_HYPER_CadillacVSeries_EVO_2026.psd', 'Hypercar', 'Cadillac V Series — EVO 2026'],
    ['Template_HYPER_ToyotaGR010_2025.psd', 'Hypercar', 'Toyota GR010 — 2025'],
    ['Template_HYPER_Peugeot9x8_2024.psd', 'Hypercar', 'Peugeot 9x8 — 2024'],
    ['Template_HYPER_Ferrari499P.psd', 'Hypercar', 'Ferrari 499P'],
    ['Template_HYPER_IsottaFraschiniTipo6.psd', 'Hypercar', 'Isotta Fraschini Tipo 6'],
    ['Template_LMP2_Oreca07_ELMS_2025.psd', 'LMP2', 'Oreca 07 — ELMS 2025'],
    ['Template_LMP3_ADESS_AD25.psd', 'LMP3', 'ADESS AD25'],
    ['Template_LMP3_Ginetta_G61Evo.psd', 'LMP3', 'Ginetta G61 Evo'],
    ['Template_XYZ_Thing.psd', 'Other', 'Thing'],
  ])('%s → %s / %s', (file, carClass, label) => {
    expect(carDisplayName(file)).toEqual({ carClass, label });
  });

  it.skipIf(!existsSync(REAL_DIR))('gives every real template a distinct, classified name', () => {
    const files = readdirSync(REAL_DIR).filter((f) => f.endsWith('.psd'));
    expect(files.length).toBe(60);
    const names = files.map(carDisplayName);
    for (const n of names) {
      expect(n.label.length).toBeGreaterThan(0);
      expect(n.carClass).not.toBe('Other');
    }
    // the start screen groups by class, so names must be unique within a class (GT3 and GTE both have a Vantage)
    expect(new Set(names.map((n) => `${n.carClass}|${n.label}`)).size).toBe(60);
  });
});
