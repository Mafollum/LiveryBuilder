import { describe, it, expect } from 'vitest';
import { parseLibraryFolders, findLmuFolder, DEFAULT_STEAM, LMU_SUBPATH } from '../../src/main/lmu/findLmu';

const VDF = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"label"		""
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
	}
}`;

function fakeFs(existing: string[], files: Record<string, string> = {}) {
  const set = new Set(existing);
  return {
    exists: (p: string) => set.has(p),
    readText: (p: string) => files[p] ?? null,
  };
}

const DEFAULT_LMU = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate';
const VDF_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf';

describe('parseLibraryFolders', () => {
  it('reads every library path and unescapes backslashes', () => {
    expect(parseLibraryFolders(VDF)).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary']);
  });
});

describe('findLmuFolder', () => {
  it('exposes the default Steam folder and LMU sub-path', () => {
    expect(DEFAULT_STEAM).toBe('C:\\Program Files (x86)\\Steam');
    expect(LMU_SUBPATH).toBe('steamapps\\common\\Le Mans Ultimate');
  });
  it('finds LMU in the default Steam folder', () => {
    expect(findLmuFolder(fakeFs([`${DEFAULT_LMU}\\Support\\LiveryTemplates`]))).toBe(DEFAULT_LMU);
  });
  it('finds LMU in another Steam library listed in libraryfolders.vdf', () => {
    const fsx = fakeFs(['D:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate\\Support\\LiveryTemplates'], { [VDF_PATH]: VDF });
    expect(findLmuFolder(fsx)).toBe('D:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate');
  });
  it('returns null when LMU is nowhere', () => {
    expect(findLmuFolder(fakeFs([], { [VDF_PATH]: VDF }))).toBeNull();
  });
  it('does not accept a folder without Support\\LiveryTemplates', () => {
    expect(findLmuFolder(fakeFs([DEFAULT_LMU]))).toBeNull();
  });
});
