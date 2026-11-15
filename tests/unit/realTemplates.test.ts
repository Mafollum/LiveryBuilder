import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPanelData } from '../../src/main/templates/panelMap';

const DIR = '/home/user/lmu-data/tpl/LiveryTemplates';
const WIRE = ['Template_GTE_Ferrari488.psd', 'Template_HYPER_AstonMartinValkyrie.psd', 'Template_HYPER_GenesisGMR001.psd', 'Template_LMP3_Ligier_JSP325.psd'];
const NO_LEVELS = ['Template_HYPER_LamborghiniSC63.psd', 'Template_HYPER_Peugeot9x8_2024.psd', 'Template_HYPER_Peugeot9x8_2026.psd'];

describe.skipIf(!existsSync(DIR))('real LMU templates', () => {
  it('every template yields a plausible panel map', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.psd')).sort();
    expect(files.length).toBe(60);
    for (const f of files) {
      const d = extractPanelData(new Uint8Array(readFileSync(join(DIR, f))));
      let on = 0;
      for (let i = 0; i < d.panel.length; i++) on += d.panel[i];
      const share = on / d.panel.length;
      expect(share, f).toBeGreaterThanOrEqual(0.2);
      expect(share, f).toBeLessThanOrEqual(0.85);
      expect(d.source, f).toBe(WIRE.includes(f) ? 'wire' : 'mask');
      expect(d.levels === null, f).toBe(NO_LEVELS.includes(f));
    }
  }, 600_000);
});
