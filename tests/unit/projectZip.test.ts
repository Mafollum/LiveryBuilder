import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { serializeProject, deserializeProject, ProjectFileError } from '../../src/renderer/project/projectZip';
import type { Project } from '../../src/shared/types';

const base = { visible: true, x: 1, y: 2, rotation: 3, scaleX: 1, scaleY: -1, opacity: 0.5 };
const PROJECT: Project = {
  version: 1,
  templateFileName: 'Template_GT3_TestCarAlpha_2025.psd',
  carColour: '#1e90ff',
  items: [
    { ...base, id: 's', name: 'Rectangle 1', finish: 'carbon', type: 'shape', shape: 'rect', width: 10, height: 20, fill: '#ff0000', stroke: '#000000', strokeWidth: 2, cornerRadius: 4 },
    { ...base, id: 'i', name: 'logo', finish: 'sticker', type: 'image', assetId: 'a1', width: 200, height: 100 },
    { ...base, id: 't', name: 'Text 1', finish: 'sticker', type: 'text', text: 'HELLO', fontFamily: 'Impact', fontSize: 120, fill: '#000000', bold: true, italic: false, stroke: '#ffffff', strokeWidth: 3 },
    {
      ...base, id: 'b', name: 'Brush 1', finish: 'paint', type: 'brush', strokes: [
        { mode: 'paint', colour: '#00ff00', size: 40, opacity: 1, softness: 0, points: [1, 2, 3, 4] },
        { mode: 'erase', colour: '#00ff00', size: 20, opacity: 1, softness: 0.5, points: [5, 6] },
      ],
    },
  ],
};

describe('project files', () => {
  it('round-trips a project with every item type and its images', async () => {
    const bytes = await serializeProject(PROJECT, [{ id: 'a1', mime: 'image/jpeg', bytes: new Uint8Array([7, 8, 9]) }]);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(['assets/', 'assets/a1.jpg', 'project.json']);
    const back = await deserializeProject(bytes);
    expect(back.project).toEqual(PROJECT);
    expect(back.assets).toEqual([{ id: 'a1', mime: 'image/jpeg', bytes: new Uint8Array([7, 8, 9]) }]);
  });

  it('rejects files that are not livery projects', async () => {
    await expect(deserializeProject(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow(new ProjectFileError("This file isn't a livery project."));
    const noJson = new JSZip();
    noJson.file('readme.txt', 'hi');
    await expect(deserializeProject(await noJson.generateAsync({ type: 'uint8array' }))).rejects.toBeInstanceOf(ProjectFileError);
  });

  it('rejects other project versions', async () => {
    const z = new JSZip();
    z.file('project.json', JSON.stringify({ ...PROJECT, version: 2 }));
    await expect(deserializeProject(await z.generateAsync({ type: 'uint8array' }))).rejects.toBeInstanceOf(ProjectFileError);
  });
});
