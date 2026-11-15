import { describe, it, expect, beforeEach } from 'vitest';
import { useEditor } from '../../src/renderer/state/store';
import { newShapeItem, newTextItem } from '../../src/renderer/state/factories';
import type { CarTemplate, PanelData, ShapeItem } from '../../src/shared/types';

const T: CarTemplate = { fileName: 'Template_GT3_X.psd', carClass: 'GT3', label: 'X', sizeBytes: 1, mtimeMs: 1 };
const P: PanelData = { width: 64, height: 64, panel: new Uint8Array(64 * 64), source: 'mask', levels: null };
const S = () => useEditor.getState();
const rect = () => newShapeItem('rect', { x: 10, y: 20, w: 30, h: 40 }, '#ff0000');

beforeEach(() => S().openCar(T, P));

describe('editor store', () => {
  it('adds an item on top, selects it and records history', () => {
    const it1 = rect();
    S().addItem(it1);
    expect(S().project.items.length).toBe(1);
    expect(S().selectedId).toBe(it1.id);
    expect(S().past.length).toBe(1);
    expect(S().dirty).toBe(true);
  });

  it('undoes and redoes', () => {
    S().addItem(rect());
    S().undo();
    expect(S().project.items.length).toBe(0);
    S().redo();
    expect(S().project.items.length).toBe(1);
  });

  it('records one history step for a transient sequence', () => {
    const it1 = rect();
    S().addItem(it1);
    const before = S().past.length;
    for (let i = 1; i <= 10; i++) S().updateItem(it1.id, { x: 10 + i * 5 }, { transient: true });
    S().commitTransient();
    expect(S().past.length).toBe(before + 1);
    expect(S().project.items[0].x).toBe(60);
    S().undo();
    expect(S().project.items[0].x).toBe(10);
  });

  it('caps history at 100 steps', () => {
    for (let i = 0; i < 120; i++) S().addItem(rect());
    expect(S().past.length).toBe(100);
  });

  it('flips by negating scale', () => {
    const it1 = rect();
    S().addItem(it1);
    S().flipItem(it1.id, 'h');
    expect(S().project.items[0].scaleX).toBe(-1);
    S().flipItem(it1.id, 'h');
    expect(S().project.items[0].scaleX).toBe(1);
    S().flipItem(it1.id, 'v');
    expect(S().project.items[0].scaleY).toBe(-1);
  });

  it('duplicates directly above with an offset and "copy" name', () => {
    const it1 = rect();
    S().addItem(it1);
    S().addItem(newShapeItem('ellipse', { x: 0, y: 0, w: 5, h: 5 }, '#000000'));
    S().duplicateItem(it1.id);
    const items = S().project.items;
    expect(items.length).toBe(3);
    expect(items[1].id).not.toBe(it1.id);
    expect(items[1]).toMatchObject({ x: 50, y: 60, name: 'Rectangle 1 copy' });
    expect(S().selectedId).toBe(items[1].id);
  });

  it('moves an item to another position', () => {
    const a = rect();
    const b = rect();
    S().addItem(a);
    S().addItem(b);
    S().moveItem(b.id, 0);
    expect(S().project.items.map((i) => i.id)).toEqual([b.id, a.id]);
  });

  it('clears the selection when the selected item is removed', () => {
    const a = rect();
    S().addItem(a);
    S().removeItem(a.id);
    expect(S().selectedId).toBeNull();
    expect(S().project.items.length).toBe(0);
  });

  it('loading a project resets history and dirty', () => {
    S().addItem(rect());
    S().loadProject({ version: 1, templateFileName: 'x.psd', carColour: '#ffffff', items: [] }, '/tmp/a.lmulivery');
    expect(S().past).toEqual([]);
    expect(S().future).toEqual([]);
    expect(S().dirty).toBe(false);
    expect(S().projectPath).toBe('/tmp/a.lmulivery');
  });

  it('gives shapes and text their default finishes', () => {
    expect(rect().finish).toBe('paint');
    expect(newTextItem({ x: 0, y: 0 }, '#000000').finish).toBe('sticker');
  });

  it('numbers new items per kind', () => {
    const a = rect();
    S().addItem(a);
    const b = rect();
    expect([a.name, b.name]).toEqual(['Rectangle 1', 'Rectangle 2']);
    expect(newShapeItem('ellipse', { x: 0, y: 0, w: 1, h: 1 }, '#000').name).toBe('Circle 1');
  });

  it('creates lines with a default thickness of 40', () => {
    const l = newShapeItem('line', { x: 0, y: 0, w: 300, h: 0 }, '#000') as ShapeItem;
    expect(l.height).toBe(40);
    expect(l.width).toBe(300);
  });

  it('keeps the last 8 colours, newest first, without duplicates', () => {
    for (const c of ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#3']) S().useColour(c);
    expect(S().recentColours).toEqual(['#3', '#9', '#8', '#7', '#6', '#5', '#4', '#2']);
  });

  it('changes the car colour with undo', () => {
    S().setCarColour('#1e90ff');
    expect(S().project.carColour).toBe('#1e90ff');
    S().undo();
    expect(S().project.carColour).toBe('#ffffff');
  });
});
