import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CarTemplate } from '../../shared/types';
import { carDisplayName } from './carName';

export const templatesDir = (lmuFolder: string): string => join(lmuFolder, 'Support', 'LiveryTemplates');

/** Every Template_*.psd in <lmu>/Support/LiveryTemplates with its readable name. */
export function listTemplates(lmuFolder: string): CarTemplate[] {
  const dir = templatesDir(lmuFolder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^Template_.*\.psd$/i.test(f))
    .map((fileName) => {
      const st = statSync(join(dir, fileName));
      return { fileName, ...carDisplayName(fileName), sizeBytes: st.size, mtimeMs: Math.floor(st.mtimeMs) };
    });
}
