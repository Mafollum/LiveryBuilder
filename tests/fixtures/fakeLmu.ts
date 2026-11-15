import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Creates <dir>/Le Mans Ultimate with Support/LiveryTemplates/* and UserData/, returns the LMU folder. */
export function makeFakeLmu(dir: string, templates: Record<string, Uint8Array>): string {
  const lmu = join(dir, 'Le Mans Ultimate');
  const tpl = join(lmu, 'Support', 'LiveryTemplates');
  mkdirSync(tpl, { recursive: true });
  mkdirSync(join(lmu, 'UserData'), { recursive: true });
  for (const [name, bytes] of Object.entries(templates)) writeFileSync(join(tpl, name), bytes);
  return lmu;
}
