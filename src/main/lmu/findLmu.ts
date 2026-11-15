import path from 'node:path';

export const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';
export const LMU_SUBPATH = 'steamapps\\common\\Le Mans Ultimate';

export interface FsProbe {
  exists(p: string): boolean;
  readText(p: string): string | null;
}

/** Reads the "path" entries from Steam's libraryfolders.vdf. */
export function parseLibraryFolders(vdf: string): string[] {
  const out: string[] = [];
  const re = /"path"\s+"((?:[^"\\]|\\.)*)"/g;
  for (let m = re.exec(vdf); m; m = re.exec(vdf)) out.push(m[1].replace(/\\\\/g, '\\'));
  return out;
}

const isLmuFolder = (fsx: FsProbe, folder: string): boolean =>
  fsx.exists(path.win32.join(folder, 'Support', 'LiveryTemplates'));

/** Looks for Le Mans Ultimate in the default Steam folder, then every Steam library. */
export function findLmuFolder(fsx: FsProbe): string | null {
  const candidates = [path.win32.join(DEFAULT_STEAM, LMU_SUBPATH)];
  const vdf = fsx.readText(path.win32.join(DEFAULT_STEAM, 'steamapps', 'libraryfolders.vdf'));
  if (vdf) for (const lib of parseLibraryFolders(vdf)) candidates.push(path.win32.join(lib, LMU_SUBPATH));
  return candidates.find((c) => isLmuFolder(fsx, c)) ?? null;
}
