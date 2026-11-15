/**
 * Writes the app's rendering of a template's fixed elements (as shown by default) to one PNG, for comparison.
 * Usage: npx tsx tools/render-fixed.ts <template.psd> <out.png>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { extractPanelData } from '../src/main/templates/panelMap';

const [src, out] = process.argv.slice(2);
const t0 = Date.now();
const d = extractPanelData(new Uint8Array(readFileSync(src)));
const ms = Date.now() - t0;
const canvas = new PNG({ width: d.width, height: d.height });
for (const f of d.fixed ?? []) {
  if (!f.visible) continue;
  const img = PNG.sync.read(Buffer.from(f.png));
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const tx = f.x + x, ty = f.y + y;
      if (tx < 0 || ty < 0 || tx >= d.width || ty >= d.height) continue;
      const s = (y * img.width + x) * 4, o = (ty * d.width + tx) * 4;
      const as = img.data[s + 3] / 255, ad = canvas.data[o + 3] / 255, ao = as + ad * (1 - as);
      if (!ao) continue;
      for (let k = 0; k < 3; k++) canvas.data[o + k] = Math.round((img.data[s + k] * as + canvas.data[o + k] * ad * (1 - as)) / ao);
      canvas.data[o + 3] = Math.round(ao * 255);
    }
}
writeFileSync(out, PNG.sync.write(canvas));
console.log(`${src}: ${d.fixed?.length ?? 0} elements (${d.fixed?.map((f) => f.label + (f.visible ? '' : ' [off]')).join(', ')}), extraction ${ms} ms`);
