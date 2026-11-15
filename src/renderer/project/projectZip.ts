import JSZip from 'jszip';
import type { Project } from '../../shared/types';

export class ProjectFileError extends Error {
  constructor(message = "This file isn't a livery project.") {
    super(message);
    this.name = 'ProjectFileError';
  }
}

export interface AssetBytes { id: string; mime: string; bytes: Uint8Array }

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/** A .lmulivery file: a zip with project.json and the images it uses. */
export async function serializeProject(p: Project, assets: AssetBytes[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(p, null, 1));
  const folder = zip.folder('assets')!;
  for (const a of assets) folder.file(`${a.id}.${EXT[a.mime] ?? 'png'}`, a.bytes);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function deserializeProject(bytes: Uint8Array): Promise<{ project: Project; assets: AssetBytes[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ProjectFileError();
  }
  const json = zip.file('project.json');
  if (!json) throw new ProjectFileError();
  let project: Project;
  try {
    project = JSON.parse(await json.async('string')) as Project;
  } catch {
    throw new ProjectFileError();
  }
  if (project?.version !== 1 || !Array.isArray(project.items)) throw new ProjectFileError();
  const assets: AssetBytes[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    const m = /^assets\/([^/]+)\.(png|jpg|webp)$/.exec(path);
    if (!m || entry.dir) continue;
    assets.push({ id: m[1], mime: MIME[m[2]], bytes: await entry.async('uint8array') });
  }
  return { project, assets };
}
