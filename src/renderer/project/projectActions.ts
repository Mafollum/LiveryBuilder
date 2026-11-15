import type { CarTemplate, PanelData, Project } from '../../shared/types';
import { carDisplayName } from '../../main/templates/carName';
import { useEditor } from '../state/store';
import { getAsset, registerAsset } from '../state/assets';
import { deserializeProject, serializeProject, type AssetBytes } from './projectZip';
import { plainError, showMessage } from '../messages';

export class MissingTemplateError extends Error {
  constructor(readonly fileName: string, readonly project: Project, readonly path: string | null, readonly dirty: boolean) {
    super(`This project needs the car template ${fileName}, which wasn't found.`);
  }
}

/** The current project as .lmulivery bytes (with the images it uses). */
export async function currentProjectBytes(): Promise<Uint8Array> {
  const { project } = useEditor.getState();
  const ids = new Set(project.items.flatMap((i) => (i.type === 'image' ? [i.assetId, ...(i.originalAssetId ? [i.originalAssetId] : [])] : [])));
  const assets: AssetBytes[] = [];
  for (const id of ids) {
    const a = getAsset(id);
    if (a) assets.push({ id, mime: a.mime, bytes: a.bytes });
  }
  return serializeProject(project, assets);
}

/** Saves to the current file, or asks where (Save As). Returns false if cancelled or failed (the user is told). */
export async function saveCurrent(saveAs: boolean): Promise<boolean> {
  const st = useEditor.getState();
  try {
    const bytes = await currentProjectBytes();
    const path = await window.lmu.saveProject(bytes, saveAs ? null : st.projectPath, st.template?.label ?? 'Livery');
    if (!path) return false;
    st.markSaved(path);
    await window.lmu.clearAutosave();
    return true;
  } catch (e) {
    showMessage("Couldn't save the project", `Your livery was not saved: ${plainError(e)}. Try saving somewhere else (Ctrl+Shift+S).`);
    return false;
  }
}

function templateFor(fileName: string, list: CarTemplate[]): CarTemplate {
  return list.find((t) => t.fileName === fileName) ?? { fileName, ...carDisplayName(fileName), sizeBytes: 0, mtimeMs: 0 };
}

function show(project: Project, path: string | null, t: CarTemplate, panel: PanelData, dirty: boolean): void {
  const st = useEditor.getState();
  st.openCar(t, panel);
  st.loadProject(project, path);
  if (dirty) useEditor.setState({ dirty: true });
}

/** Opens project bytes: registers its images, finds its car template and shows it. */
export async function openProjectBytes(bytes: Uint8Array, path: string | null, dirty = false): Promise<void> {
  const { project, assets } = await deserializeProject(bytes);
  for (const a of assets) await registerAsset(a.id, a.bytes, a.mime);
  const list = await window.lmu.listTemplates();
  const t = list.find((x) => x.fileName === project.templateFileName);
  if (!t) throw new MissingTemplateError(project.templateFileName, project, path, dirty);
  const panel = await window.lmu.openTemplate(t.fileName);
  show(project, path, t, panel, dirty);
}

/** Continues opening a project with a template file the user picked. */
export async function openWithTemplateFile(err: MissingTemplateError, file: string): Promise<void> {
  const panel = await window.lmu.openTemplateFile(file);
  show(err.project, err.path, templateFor(err.fileName, []), panel, err.dirty);
}
