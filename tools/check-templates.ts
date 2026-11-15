/**
 * Runs panel extraction over every template in a folder.
 * Writes <out>/stats.csv, <out>/contact-sheet.png (all cars, app look) and <out>/maps/<template>.png (full-size maps).
 * Usage: npx tsx tools/check-templates.ts <templatesDir> <outDir>
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { extractPanelData } from '../src/main/templates/panelMap';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('Usage: npx tsx tools/check-templates.ts <templatesDir> <outDir>');
  process.exit(2);
}
mkdirSync(join(out, 'maps'), { recursive: true });

const TILE = 256;
const COLS = 8;
const files = readdirSync(dir).filter((f) => f.endsWith('.psd')).sort();
const rows = Math.ceil(files.length / COLS);
const sheet = new PNG({ width: COLS * TILE, height: rows * TILE });
sheet.data.fill(255);
const lines = ['file,source,panel_share,ms,levels_highlight_output'];

files.forEach((f, idx) => {
  const t0 = Date.now();
  const d = extractPanelData(new Uint8Array(readFileSync(join(dir, f))));
  const ms = Date.now() - t0;
  let on = 0;
  for (const v of d.panel) on += v;
  lines.push(`${f},${d.source},${(on / d.panel.length).toFixed(3)},${ms},${d.levels?.channels[0]?.highlightOutput ?? ''}`);

  const full = new PNG({ width: d.width, height: d.height });
  for (let i = 0; i < d.panel.length; i++) {
    const v = d.panel[i] ? 255 : 0;
    full.data[i * 4] = full.data[i * 4 + 1] = full.data[i * 4 + 2] = v;
    full.data[i * 4 + 3] = 255;
  }
  writeFileSync(join(out, 'maps', f.replace(/\.psd$/, '.png')), PNG.sync.write(full));

  // tile: majority vote per cell, white panels on grey, dark edges
  const k = d.width / TILE;
  const cell = new Uint8Array(TILE * TILE);
  for (let ty = 0; ty < TILE; ty++)
    for (let tx = 0; tx < TILE; tx++) {
      let s = 0;
      for (let y = Math.floor(ty * k); y < Math.floor((ty + 1) * k); y++)
        for (let x = Math.floor(tx * k); x < Math.floor((tx + 1) * k); x++) s += d.panel[y * d.width + x];
      cell[ty * TILE + tx] = s * 2 >= k * k ? 1 : 0;
    }
  const ox = (idx % COLS) * TILE;
  const oy = Math.floor(idx / COLS) * TILE;
  for (let ty = 0; ty < TILE; ty++)
    for (let tx = 0; tx < TILE; tx++) {
      const on1 = cell[ty * TILE + tx];
      const edge = on1 && (tx === 0 || ty === 0 || tx === TILE - 1 || ty === TILE - 1 || !cell[ty * TILE + tx - 1] || !cell[ty * TILE + tx + 1] || !cell[(ty - 1) * TILE + tx] || !cell[(ty + 1) * TILE + tx]);
      const v = edge ? 51 : on1 ? 255 : 205;
      const p = ((oy + ty) * sheet.width + ox + tx) * 4;
      sheet.data[p] = sheet.data[p + 1] = sheet.data[p + 2] = v;
    }
  console.log(`${idx + 1}/${files.length} ${f} ${d.source} ${ms} ms`);
});

writeFileSync(join(out, 'stats.csv'), lines.join('\n') + '\n');
writeFileSync(join(out, 'contact-sheet.png'), PNG.sync.write(sheet));
console.log(`wrote ${join(out, 'stats.csv')} and ${join(out, 'contact-sheet.png')}`);
