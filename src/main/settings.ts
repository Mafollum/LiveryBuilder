import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Settings {
  lmuFolder?: string;
  recentProjects: string[];
}

const file = (dir: string) => join(dir, 'settings.json');

export function loadSettings(dir: string): Settings {
  try {
    if (existsSync(file(dir))) {
      const s = JSON.parse(readFileSync(file(dir), 'utf8')) as Partial<Settings>;
      return { lmuFolder: s.lmuFolder, recentProjects: Array.isArray(s.recentProjects) ? s.recentProjects : [] };
    }
  } catch {
    // unreadable settings: start fresh
  }
  return { recentProjects: [] };
}

export function saveSettings(dir: string, s: Settings): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file(dir), JSON.stringify(s, null, 2));
}
