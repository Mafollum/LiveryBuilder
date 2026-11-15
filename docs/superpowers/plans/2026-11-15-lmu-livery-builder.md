# LMU Livery Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A portable Windows desktop program that shows a Le Mans Ultimate car's panels as plain white shapes with an outline, lets the user put images, shapes, text and brush strokes on them, and writes `customskin.tga` and `customskin_region.tga` straight into the game's Liveries folder.

**Architecture:** Electron app. The main process (Node) finds the LMU folder, reads PSD templates with `ag-psd` in a `worker_threads` worker to get a one-bit panel map plus Levels settings, caches the result, and does all file I/O. The renderer is a React UI with an imperative Konva canvas. Document state lives in a Zustand store with snapshot undo. Export renders every item at template resolution in the renderer, builds the paint and region buffers, and hands TGA bytes to the main process to write.

**Tech Stack:** Electron 45, electron-vite 6 (Vite 8), React 19, TypeScript 5.9, Zustand 5 + Immer 11, Konva 10 (no react-konva), ag-psd 34, JSZip 3, pngjs (tests/tools only), Vitest 5, @playwright/test (driving Electron), electron-builder 26.

**Spec:** `docs/superpowers/specs/2026-11-14-lmu-livery-builder-design.md` (approved). Read it before starting any task.

## Global Constraints

- Windows x64 only. Portable zip `LiveryBuilder-win-x64.zip` containing `LiveryBuilder.exe`. No installer, no auto-update, no signing (`signAndEditExecutable: false`).
- No network access at runtime. No native Node modules, so cross-building from Linux works.
- Settings and caches go in `app.getPath('userData')`, with the app name set to `LiveryBuilder` (→ `%APPDATA%\LiveryBuilder`). Default project folder: `<Documents>\LMU Livery Builder`.
- LMU templates and the user's example livery are **never committed**. Local copies for testing: templates `/home/user/lmu-data/tpl/LiveryTemplates/` (60 PSDs), example livery `/home/user/lmu-data/ex/example livery/`.
- The UI uses plain words only. These strings never appear in the UI: "UV", "region", "levels", "mask", "layer", "alpha", "blend".
- Exact UI copy:
  - Button "Send to game"; after success "Sent! Press RELOAD in the showroom."
  - Overwrite prompt "There's already a livery in the game folder. Replace it?" with buttons "Keep a backup and replace", "Replace", "Cancel".
  - Write failure "Couldn't write to the game folder" plus a reason; offer "Save the two files somewhere else…".
  - No panels found: "This car's template has no panel outlines".
  - Finish hint: "You choose what each finish looks like in the game's showroom."
- Finishes, in order (id / label / region RGB): `paint` "Paint" (0,0,0) · `carbon` "Carbon" (255,0,0) · `special1` "Special 1" (0,255,0) · `special2` "Special 2" (0,0,255) · `sticker` "Sticker" (255,255,255). Defaults: image and text → sticker; shape and brush → paint; car colour → paint.
- Output TGA: type 2, 32 bpp, descriptor `0x08`, bottom-left origin, BGRA, alpha 255, plus the 26-byte TGA 2.0 footer (8 zero bytes + `TRUEVISION-XFILE.` + `\0`). A 4096² file is exactly 67,108,908 bytes and its header is `00 00 02 00 00 00 00 00 00 00 00 00 00 10 00 10 20 08`.
- Canvas look: background `#cdcdcd`; panels filled with the car colour (default `#ffffff`); off-car veil `rgba(205,205,205,0.75)` drawn above items; outline `#333333`, 1 screen pixel wide whatever the zoom, drawn on top of everything except selection handles.
- Undo history is capped at 100 steps. Autosave every 60 s while there are unsaved changes, and on close.
- Text fonts, exactly: Arial, Arial Black, Bahnschrift, Calibri, Consolas, Impact, Segoe UI, Tahoma, Times New Roman, Verdana.
- Car class order on the start screen: Hypercar, LMP2, LMP3, GT3, GTE, Other.
- Test hooks: env `LIVERY_LMU_DIR` (skip detection), `LIVERY_USER_DATA` (override userData), `LIVERY_DOCUMENTS` (override the Documents folder), `LIVERY_TEST=1` (exposes `window.__livery`). Command-line flag `--smoke-test`: exit 0 once the renderer signals ready, or exit 1 after 30 s.
- After `npm install`, if `node_modules/electron/dist` is missing, run `node node_modules/electron/install.js` (seen once in this environment).
- Run the Electron e2e tests with `xvfb-run -a`.

## Review Focus

1. **Keyboard shortcuts while typing.** Delete, Ctrl+Z, arrow keys and Space typed into a text box (item name, text content, hex colour) must edit the text, not delete, undo, nudge or pan items. Test: Task 10.
2. **Huge or odd images.** A 6000×3000 photo should import, downscaled so its longest side is at most 4096, without freezing. A corrupt PNG or an unsupported file (.psd, .txt) shows "Can't open this file. Use PNG, JPG, WebP or SVG." and adds nothing. Test: Task 11.
3. **Windows display scaling (125%/150%).** The pointer must land where the user clicks: a rectangle dragged on screen ends up at the same texture coordinates whatever the scaling. Test: Task 10, with `--force-device-scale-factor=1.5`.
4. **LMU found but no templates** (game moved or updated, or the wrong folder picked). The start screen says "No car templates found in <folder>" and offers "Choose LMU folder…", rather than an empty list. Test: Task 6.
5. **Game running or file locked during Send to game.** A clear message names the cause, nothing is left half-written, and the "Save the two files somewhere else…" path works. Test: Task 13.

---

## File structure

```
package.json · electron.vite.config.ts · tsconfig.json · tsconfig.node.json · tsconfig.web.json
vitest.config.ts · playwright.config.ts · electron-builder.yml · .gitignore · README.md
.github/workflows/build-windows.yml
src/shared/types.ts          Item/Project/PanelData/CarTemplate/LevelsSettings/LmuApi types
src/shared/finish.ts         FINISHES table, defaultFinishFor()
src/shared/levels.ts         buildLevelsLut(), applyLevels()
src/shared/tga.ts            encodeTga32(), decodeTga32()
src/shared/contours.ts       traceContours(), simplifyPolyline()
src/main/index.ts            app lifecycle, window, env overrides, --smoke-test, close handshake
src/main/ipc.ts              registerIpc(): every ipcMain.handle
src/main/settings.ts         loadSettings()/saveSettings()
src/main/lmu/findLmu.ts      parseLibraryFolders(), findLmuFolder()
src/main/templates/carName.ts      carDisplayName()
src/main/templates/listTemplates.ts listTemplates()
src/main/templates/morph.ts        dilate4(), erode4(), floodFromBorder()
src/main/templates/wirePanels.ts   panelsFromWire()
src/main/templates/panelMap.ts     extractPanelData(), isMaskLayerName(), isWireLayerName()
src/main/templates/panelWorker.ts  worker_threads entry calling extractPanelData
src/main/templates/panelCache.ts   cacheKey(), readCachedPanel(), writeCachedPanel()
src/main/livery/writeLivery.ts     liveryStatus(), writeLiveryFiles(), describeWriteError()
src/main/project/projectIo.ts      save/open dialogs, autosave files
src/preload/index.ts         contextBridge.exposeInMainWorld('lmu', api)
src/renderer/index.html · main.tsx · App.tsx · styles.css
src/renderer/state/store.ts        useEditor (Zustand) + history
src/renderer/state/factories.ts    newShapeItem(), newTextItem(), newImageItem(), newBrushItem()
src/renderer/state/assets.ts       asset registry: id → {mime, bytes, image}
src/renderer/screens/StartScreen.tsx · Editor.tsx
src/renderer/components/TopBar.tsx · Toolbar.tsx · PropertiesPanel.tsx · ItemsList.tsx · ColourPicker.tsx · Dialog.tsx
src/renderer/canvas/CanvasView.ts  Konva stage controller (view transform, layers, sync from store)
src/renderer/canvas/panelImages.ts makePanelCanvas(), makeVeilCanvas()
src/renderer/canvas/nodes.ts       createItemNode(), updateItemNode()
src/renderer/canvas/brush.ts       drawStroke(), BrushCache
src/renderer/canvas/tools.ts       pointer handlers per tool
src/renderer/export/regionMap.ts   paintRegion()
src/renderer/export/renderLivery.ts renderLivery()
src/renderer/project/projectZip.ts serializeProject(), deserializeProject()
tests/fixtures/makeTemplate.ts     synthetic PSD writer (ag-psd)
tests/fixtures/fakeLmu.ts          makeFakeLmu(): temp LMU folder tree
tests/unit/*.test.ts               Vitest (node environment)
tests/e2e/*.spec.ts                Playwright + Electron
tools/check-templates.ts           runs extraction over real templates, writes stats + contact sheet
tools/reference_panels.py          psd-tools reference panel maps
```

## Shared types (`src/shared/types.ts`, created in Task 2, used everywhere)

```ts
export type FinishId = 'paint' | 'carbon' | 'special1' | 'special2' | 'sticker';
export type CarClass = 'Hypercar' | 'LMP2' | 'LMP3' | 'GT3' | 'GTE' | 'Other';
export interface LevelsChannel { shadowInput: number; highlightInput: number; shadowOutput: number; highlightOutput: number; midtoneInput: number }
export interface LevelsSettings { channels: LevelsChannel[] }            // [0] = master (RGB), [1..3] = R,G,B (ag-psd order)
export interface CarTemplate { fileName: string; carClass: CarClass; label: string; sizeBytes: number; mtimeMs: number }
export interface PanelData { width: number; height: number; panel: Uint8Array; source: 'mask' | 'wire' | 'none'; levels: LevelsSettings | null } // panel: 1 = on car, row-major
interface ItemBase { id: string; name: string; visible: boolean; finish: FinishId; x: number; y: number; rotation: number; scaleX: number; scaleY: number; opacity: number }
export interface ImageItem extends ItemBase { type: 'image'; assetId: string; width: number; height: number }
export interface ShapeItem extends ItemBase { type: 'shape'; shape: 'rect' | 'ellipse' | 'line' | 'triangle'; width: number; height: number; fill: string; stroke: string; strokeWidth: number; cornerRadius: number } // line: width = length, height = thickness
export interface TextItem extends ItemBase { type: 'text'; text: string; fontFamily: string; fontSize: number; fill: string; bold: boolean; italic: boolean; stroke: string; strokeWidth: number }
export interface BrushStroke { mode: 'paint' | 'erase'; colour: string; size: number; opacity: number; softness: number; points: number[] } // points: x,y pairs in item-local texture px
export interface BrushItem extends ItemBase { type: 'brush'; strokes: BrushStroke[] }
export type Item = ImageItem | ShapeItem | TextItem | BrushItem;
export interface Project { version: 1; templateFileName: string; carColour: string; items: Item[] } // items bottom → top
```

All coordinates are texture pixels with the origin at the top-left of the template. `x, y` is the item's Konva position; rotation is in degrees.

---

### Task 1: Scaffold the Electron app

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/styles.css`
- Test: `tests/e2e/launch.spec.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build` (electron-vite build → `out/`), `test` (vitest run), `e2e` (`playwright test`), `dist:win` (build + `electron-builder --win zip --x64`). `tests/e2e/helpers.ts` exports `launchApp(env?: Record<string,string>, args?: string[]): Promise<{ app: ElectronApplication; page: Page }>`, which launches `out/main/index.js` with `--no-sandbox` and `LIVERY_TEST=1` and waits for the first window. Main sets `app.setName('LiveryBuilder')` and honours `LIVERY_USER_DATA` via `app.setPath('userData', …)` before ready. Renderer calls `window.lmu.ready()` once mounted. In smoke-test mode, main exits 0 on that call.

- [ ] **Step 1:** Install dependencies (exact majors from the Tech Stack). Add `.gitignore` with `node_modules/ out/ dist/ test-results/ playwright-report/ *.lmulivery`. Check `node_modules/electron/dist` exists (see Global Constraints).
- [ ] **Step 2: Write the failing test** `tests/e2e/launch.spec.ts`:
  - `test('window opens with title', …)`: `expect(await page.title()).toBe('LMU Livery Builder')`.
  - `test('--smoke-test exits 0', …)`: spawn the built Electron with `out/main/index.js --smoke-test --no-sandbox` and assert exit code `0` within 30 s.
- [ ] **Step 3:** Run `npm run build && xvfb-run -a npx playwright test tests/e2e/launch.spec.ts`. Expected: FAIL (no app yet).
- [ ] **Step 4:** Implement the minimum: BrowserWindow 1400×900 with `contextIsolation: true`, `sandbox: false` (the preload needs Node for `ipcRenderer`), title "LMU Livery Builder"; a React app rendering an empty shell; preload exposing `lmu.ready()`; the smoke-test logic.
- [ ] **Step 5:** Run the same command. Expected: 2 passed.
- [ ] **Step 6:** Commit `chore: scaffold Electron + React app with e2e launch test`.

---

### Task 2: Shared core (types, finishes, Levels, TGA)

**Files:**
- Create: `src/shared/types.ts` (as above), `src/shared/finish.ts`, `src/shared/levels.ts`, `src/shared/tga.ts`
- Test: `tests/unit/finish.test.ts`, `tests/unit/levels.test.ts`, `tests/unit/tga.test.ts`

**Interfaces:**
- Produces:
  - `FINISHES: ReadonlyArray<{ id: FinishId; label: string; rgb: [number, number, number] }>` (order and values from Global Constraints)
  - `finishById(id: FinishId)`
  - `defaultFinishFor(type: Item['type']): FinishId`
  - `buildLevelsLut(ch: LevelsChannel): Uint8Array` (256 entries)
  - `applyLevels(rgba: Uint8Array | Uint8ClampedArray, levels: LevelsSettings | null): void` (in place, never touches alpha)
  - `encodeTga32(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array`
  - `decodeTga32(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array }`

- [ ] **Step 1: Write the failing tests:**
  - finish: `FINISHES.map(f => f.id)` equals `['paint','carbon','special1','special2','sticker']`; labels `['Paint','Carbon','Special 1','Special 2','Sticker']`; rgb values as in Global Constraints; `defaultFinishFor('image') === 'sticker'`, `'text' → 'sticker'`, `'shape' → 'paint'`, `'brush' → 'paint'`.
  - levels: with `{0,255,10,210,1}`: `lut[0]===10`, `lut[255]===210`, `lut[128]===110`. With `{0,255,0,255,2}`: `lut[128]===181`. With `{0,255,0,190,1}`: `lut[255]===190`. `applyLevels` with `{channels:[{0,255,10,210,1}]}` turns pixel `[255,0,128,77]` into `[210,10,110,77]`. `applyLevels(x, null)` leaves `x` unchanged.
  - tga: a 2×2 image, top-down RGBA rows `[red, green]`, `[blue, white]` (all alpha 255), encodes to exactly 60 bytes. Header `[0,0,2,0,0,0,0,0,0,0,0,0,2,0,2,0,32,8]`. Pixels `[255,0,0,255, 255,255,255,255, 0,0,255,255, 0,255,0,255]` (bottom row first, BGRA). Footer `[0,0,0,0,0,0,0,0, ...'TRUEVISION-XFILE.', 0]`. A 4096×4096 encode has length `67108908` and the header from Global Constraints. `decodeTga32(encodeTga32(img))` round-trips.
- [ ] **Step 2:** Run `npx vitest run tests/unit/finish.test.ts tests/unit/levels.test.ts tests/unit/tga.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.** Levels per channel: `t = clamp((v − shadowInput)/(highlightInput − shadowInput), 0, 1)`, then `out = round(shadowOutput + t^(1/midtoneInput) × (highlightOutput − shadowOutput))`. `applyLevels` applies channels[1..3] to R, G, B (when present), then channels[0] to all three. Only the master channel appears in the 60 templates.
- [ ] **Step 4:** Run the same command. Expected: all pass.
- [ ] **Step 5:** Commit `feat: shared finishes, Levels and TGA encoder`.

---

### Task 3: Readable car names

**Files:**
- Create: `src/main/templates/carName.ts`
- Test: `tests/unit/carName.test.ts`

**Interfaces:**
- Produces: `carDisplayName(fileName: string): { carClass: CarClass; label: string }`.

- [ ] **Step 1: Write the failing test.** `test.each` over these exact pairs (file name → class, label):
  - `Template_GT3_Ferrari296LMGT3_2025_ELMS.psd` → GT3, `Ferrari 296 LMGT3 — 2025 ELMS`
  - `Template_GT3_McLaren720EVO_2025 _ELMS.psd` → GT3, `McLaren 720 EVO — 2025 ELMS`
  - `Template_GT3_FordMustang_EVO_LMGT3.psd` → GT3, `Ford Mustang LMGT3 — EVO`
  - `Template_GT3_CorvetteZ06LMGT3.psd` → GT3, `Corvette Z06 LMGT3`
  - `Template_GT3_BMWM4LMGT3_2025.psd` → GT3, `BMW M4 LMGT3 — 2025`
  - `Template_GTE_CorvetteC8R.psd` → GTE, `Corvette C8R`
  - `Template_HYPER_BMWMHybrid_EVO.psd` → Hypercar, `BMW M Hybrid — EVO`
  - `Template_HYPER_CadillacVSeries_EVO_2026.psd` → Hypercar, `Cadillac V Series — EVO 2026`
  - `Template_HYPER_ToyotaGR010_2025.psd` → Hypercar, `Toyota GR010 — 2025`
  - `Template_HYPER_Peugeot9x8_2024.psd` → Hypercar, `Peugeot 9x8 — 2024`
  - `Template_HYPER_Ferrari499P.psd` → Hypercar, `Ferrari 499P`
  - `Template_HYPER_IsottaFraschiniTipo6.psd` → Hypercar, `Isotta Fraschini Tipo 6`
  - `Template_LMP2_Oreca07_ELMS_2025.psd` → LMP2, `Oreca 07 — ELMS 2025`
  - `Template_LMP3_ADESS_AD25.psd` → LMP3, `ADESS AD25`
  - `Template_LMP3_Ginetta_G61Evo.psd` → LMP3, `Ginetta G61 Evo`
  - `Template_XYZ_Thing.psd` → Other, `Thing`
  - Also: every file name in `/home/user/lmu-data/tpl/LiveryTemplates` (skip if the folder is absent) yields a non-empty label, a class other than Other, and 60 distinct labels.
- [ ] **Step 2:** Run `npx vitest run tests/unit/carName.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Strip `Template_` and `.psd`, split on `_`, and trim each token.
  - Token 0 is the class: HYPER→Hypercar, LMP2, LMP3, GT3, GTE; anything else → Other.
  - Tokens matching `/^(\d{4}|ELMS|EVO)$/i` are variant tokens, in order. The rest are model tokens.
  - Split each model token into words at these boundaries:
    - lower→Upper;
    - before the last capital of an all-capital run that is followed by a lowercase letter (`VSeries` → `V Series`);
    - between a mixed-case word and a digit (`Ferrari296`, but not `GR010`, `Z06`, `AD25`);
    - between a digit and a run of 2+ capitals or a capitalised word (`296LMGT3`, `61Evo`, but not `C8R`, `499P`, `9x8`).
  - Then apply overrides: `BMWM4` → `BMW M4`, `BMWM Hybrid` → `BMW M Hybrid`, `Mc Laren` → `McLaren`.
  - Label = model words joined by spaces, plus ` — ` and the variant tokens if there are any.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: readable car names from template file names`.

---

### Task 4: Find the LMU folder

**Files:**
- Create: `src/main/lmu/findLmu.ts`
- Test: `tests/unit/findLmu.test.ts`

**Interfaces:**
- Produces:
  - `parseLibraryFolders(vdf: string): string[]`
  - `findLmuFolder(fsx: { exists(p: string): boolean; readText(p: string): string | null }): string | null`
  - `DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam'`
  - `LMU_SUBPATH = 'steamapps\\common\\Le Mans Ultimate'`
  - Use `path.win32` for every join.

- [ ] **Step 1: Write the failing tests:**
  - A vdf with `"path"		"C:\\Program Files (x86)\\Steam"` and `"path"		"D:\\SteamLibrary"` parses to `['C:\\Program Files (x86)\\Steam','D:\\SteamLibrary']` (escaped backslashes unescaped).
  - With `exists` true only for `C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate\Support\LiveryTemplates`, the result is the default LMU path.
  - With LMU only in `D:\SteamLibrary` (listed in `C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf`), the result is `D:\SteamLibrary\steamapps\common\Le Mans Ultimate`.
  - If nothing exists, the result is `null`.
  - A folder without `Support\LiveryTemplates` is not accepted.
- [ ] **Step 2:** Run `npx vitest run tests/unit/findLmu.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Order: the default path first, then each library from the vdf. A folder is valid when `<folder>\Support\LiveryTemplates` exists.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: detect LMU install from Steam libraries`.

---

### Task 5: Panel extraction from templates

**Files:**
- Create: `src/main/templates/morph.ts`, `src/main/templates/wirePanels.ts`, `src/main/templates/panelMap.ts`, `tests/fixtures/makeTemplate.ts`
- Test: `tests/unit/morph.test.ts`, `tests/unit/panelMap.test.ts`, `tests/unit/realTemplates.test.ts`

**Interfaces:**
- Consumes: `PanelData` and `LevelsSettings` (Task 2).
- Produces:
  - `dilate4(m: Uint8Array, w: number, h: number, iterations: number): Uint8Array`
  - `erode4(m, w, h, iterations): Uint8Array` (pixels outside the image count as 0)
  - `floodFromBorder(free: Uint8Array, w, h): Uint8Array` (4-connectivity, seeded from free border pixels; returns the reached map)
  - `panelsFromWire(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array`
  - `isMaskLayerName(name: string): boolean`
  - `isWireLayerName(name: string): boolean`
  - `extractPanelData(psdBytes: Uint8Array): PanelData`
  - `makeTemplate(opts: { size: number; mask?: { rects: Rect[]; hidden?: boolean; layerRect?: Rect }; wire?: { rects: Rect[]; opaqueBlack?: boolean }; levels?: LevelsChannel; nestedLevelsOnly?: boolean }): Uint8Array`, where `Rect = { x: number; y: number; w: number; h: number }`.
  - The mask fixture is a black, opaque pixel layer named `Mask(Disable for export)`. Its layer mask is white everywhere except black inside `rects`, so the rects are the panels. `layerRect` limits the pixel layer's bounds.
  - The wire fixture draws 1 px white rectangle outlines.

- [ ] **Step 1: Write the failing tests:**
  - morph: one pixel dilated once gives 5 pixels and twice gives 13. A 5×5 block of ones eroded once gives 9 ones (centre 3×3). `floodFromBorder` on a free map that contains a 3×3 free hole fully enclosed by a non-free ring leaves the hole unreached.
  - names: `isMaskLayerName` is true for `Mask(Disable for export)`, `Maks(Disable for export)`, `Mask - Disable for export`, `Mask (Disable for export)`, `Mask(Disable For Export)`, and false for `Car Stickers`, `Region`, `Wireframe`. `isWireLayerName` is true for `Wireframe`, `Wire`, `WIRE`, `wire`, `UVW`, `Body_UV`, `WireEVO`, and false for `Base`, `Car Stickers`.
  - Mask, size 256, rect `{x:20,y:30,w:100,h:60}`, levels `{0,255,10,210,1}`: `source==='mask'`, `panel[50*256+50]===1`, `panel[5*256+5]===0`, the panel sum is 6000, and `levels.channels[0].highlightOutput===210`.
  - A hidden mask layer gives the same result as a visible one.
  - `layerRect {x:10,y:10,w:200,h:200}` with a fully white layer mask: panel=1 at (5,5) and (220,220), 0 at (100,100).
  - Wire, size 256, rect outline `{x:40,y:40,w:100,h:80}`: `source==='wire'`, panel=1 at (60,60) and (100,100), 0 at (10,10) and (200,200). Same with `opaqueBlack: true`.
  - No mask and no wire: `source==='none'`, every value is 1.
  - No Levels: `levels===null`. Levels only inside a group (`nestedLevelsOnly`): `levels===null`.
  - realTemplates (skipped unless `/home/user/lmu-data/tpl/LiveryTemplates` exists): for all 60 files, panel share is in [0.20, 0.85]. Source is `wire` exactly for `Template_GTE_Ferrari488.psd`, `Template_HYPER_AstonMartinValkyrie.psd`, `Template_HYPER_GenesisGMR001.psd`, `Template_LMP3_Ligier_JSP325.psd`, and `mask` for the other 56. `levels===null` exactly for LamborghiniSC63, Peugeot9x8_2024, Peugeot9x8_2026. Timeout 10 minutes.
- [ ] **Step 2:** Run `npx vitest run tests/unit/morph.test.ts tests/unit/panelMap.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Read with `readPsd(bytes, { useRawData: true, skipCompositeImageData: true, skipThumbnail: true })` after `initializeCanvas(() => { throw new Error('canvas not available') }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w*h*4) }))`.
  - Only look at top-level layers.
  - Mask path: coverage = pixel alpha (0 outside the layer bounds) × layer-mask value (outside the mask rect: `mask.defaultColor`) / 255. Panel = coverage < 128. Ignore `hidden`.
  - Wire path: decode the wire layer into a full-size RGBA buffer (transparent outside its bounds), then `panelsFromWire`:
    - line = alpha > 32 && ⌊(3R+6G+B)/10⌋ > 40;
    - `dilate4(line, 2)`;
    - outside = `floodFromBorder(!line)`;
    - panel = !outside;
    - panel = `dilate4(erode4(panel, 3), 3)`.
  - Levels: the first top-level layer with `adjustment.type === 'levels'`. Never decode any other layer.
- [ ] **Step 4:** Run `npx vitest run tests/unit/morph.test.ts tests/unit/panelMap.test.ts tests/unit/realTemplates.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: extract panel maps from LMU templates (mask or mesh lines)`.

---

### Task 6: Main process services, IPC and the start screen

**Files:**
- Create: `src/main/settings.ts`, `src/main/templates/listTemplates.ts`, `src/main/templates/panelWorker.ts`, `src/main/templates/panelCache.ts`, `src/main/ipc.ts`, `tests/fixtures/fakeLmu.ts`, `src/renderer/screens/StartScreen.tsx`
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/shared/types.ts` (add `LmuApi`), `src/renderer/App.tsx`
- Test: `tests/unit/panelCache.test.ts`, `tests/e2e/start.spec.ts`

**Interfaces:**
- Consumes: `findLmuFolder` (Task 4), `carDisplayName` (Task 3), `extractPanelData` (Task 5), `makeTemplate` (Task 5).
- Produces: `window.lmu: LmuApi` with (later tasks add to it):
  ```ts
  getLmuFolder(): Promise<string | null>          // LIVERY_LMU_DIR, else settings, else findLmuFolder; result saved to settings
  chooseLmuFolder(): Promise<{ folder: string } | { error: string } | null> // native folder dialog; null = cancelled; error = "That folder doesn't look like Le Mans Ultimate (there's no Support\\LiveryTemplates inside)." 
  listTemplates(): Promise<CarTemplate[]>         // Template_*.psd in <lmu>/Support/LiveryTemplates
  openTemplate(fileName: string): Promise<PanelData>      // cache first, else worker; panel transferred as Uint8Array
  openTemplateFile(absPath: string): Promise<PanelData>
  chooseTemplateFile(): Promise<string | null>
  ready(): void
  ```
  - `makeFakeLmu(dir, templates: Record<string, Uint8Array>): string` creates `<dir>/Le Mans Ultimate/Support/LiveryTemplates/*` and `<dir>/Le Mans Ultimate/UserData/` and returns the LMU folder.
  - Standard e2e fixtures (`tests/e2e/helpers.ts`), size 1024:
    - `Template_GT3_TestCarAlpha_2025.psd`: mask panels `{x:100,y:100,w:400,h:200}` and `{x:600,y:500,w:300,h:400}`, levels `{0,255,10,210,1}`;
    - `Template_HYPER_TestCarBeta.psd`: wire outline `{x:200,y:200,w:600,h:400}`, no levels.
  - `cacheKey(t: { fileName; sizeBytes; mtimeMs }): string` (sha1 hex of `fileName|size|mtime`).
  - `writeCachedPanel(dir, key, data: PanelData)` and `readCachedPanel(dir, key): PanelData | null`, stored in `<userData>/panel-cache/<key>.bin` as a JSON header line followed by the bit-packed panel compressed with zlib `deflateSync`.

- [ ] **Step 1: Write the failing tests:**
  - panelCache: write → read round-trips `width`, `height`, `source`, `levels` and every panel bit for a 1024² random map. A different `mtimeMs` gives a different key. Reading a missing key returns `null`, and so does reading a corrupt file.
  - start.spec (with `LIVERY_LMU_DIR` set to the fake LMU and `LIVERY_USER_DATA` to a temp dir):
    - the headings "Hypercar" and "GT3" are visible, in that order;
    - buttons "Test Car Alpha — 2025" and "Test Car Beta" are visible;
    - with an empty `LiveryTemplates` folder, the text "No car templates found in" and the button "Choose LMU folder…" are visible.
- [ ] **Step 2:** Run `npx vitest run tests/unit/panelCache.test.ts` and `npm run build && xvfb-run -a npx playwright test tests/e2e/start.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. If no LMU folder is found at all, the start screen shows "Couldn't find Le Mans Ultimate on this PC." with the button "Choose LMU folder…". Car buttons are grouped by class in the class order from Global Constraints and sorted by label within each class. Under the list are "Open project…" (wired in Task 14) and recent projects.
- [ ] **Step 4:** Run both commands. Expected: PASS.
- [ ] **Step 5:** Commit `feat: start screen lists cars from the LMU folder; panel cache`.

---

### Task 7: Panel outlines as vector contours

**Files:**
- Create: `src/shared/contours.ts`
- Modify: `src/shared/types.ts` (`PanelData.outline?: number[][]`), `src/main/templates/panelWorker.ts` (compute the outline after extraction), `src/main/templates/panelCache.ts` (store the outline: JSON header gets an `outline` field)
- Test: `tests/unit/contours.test.ts`, `tests/unit/panelCache.test.ts` (add: outline round-trips)

**Interfaces:**
- Produces:
  - `traceContours(panel: Uint8Array, w: number, h: number): number[][]`: closed loops along pixel edges, as flat `[x0,y0,x1,y1,…]` lists in pixel-corner coordinates.
  - `simplifyPolyline(points: number[], tolerance: number): number[]` (Douglas–Peucker; first and last points kept).

- [ ] **Step 1: Write the failing tests:**
  - A 4×4 map with ones at (1,1),(2,1),(1,2),(2,2) gives exactly one loop whose point set has min (1,1) and max (3,3).
  - Two separate blobs give two loops.
  - A blob with a hole gives two loops.
  - `simplifyPolyline([0,0, 1,0, 2,0, 2,2], 0.5)` equals `[0,0, 2,0, 2,2]`.
  - The Task 5 mask fixture (size 256) traces and simplifies (tolerance 1) to one loop of 4 or 5 points.
- [ ] **Step 2:** Run `npx vitest run tests/unit/contours.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement crack-following: collect unit boundary edges between panel and non-panel pixels (outside the image counts as non-panel), link them into loops, then simplify with tolerance 1.0. The result is also produced in the main process and sent along with `PanelData` (add an optional field `outline?: number[][]` to `PanelData`), so the renderer doesn't compute it.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: trace panel outlines as simplified loops`.

---

### Task 8: Document store and history

**Files:**
- Create: `src/renderer/state/store.ts`, `src/renderer/state/factories.ts`, `src/renderer/state/assets.ts`
- Test: `tests/unit/store.test.ts`

**Interfaces:**
- Consumes: types (Task 2), `defaultFinishFor`.
- Produces: `useEditor` (a Zustand store, usable outside React via `useEditor.getState()`).
  - State: `template: CarTemplate | null`, `panel: PanelData | null`, `project: Project`, `selectedId: string | null`, `tool: ToolId`, `brush: { colour: string; size: number; opacity: number; softness: number }`, `recentColours: string[]` (max 8, newest first), `dirty: boolean`, `projectPath: string | null`, `past: Project[]`, `future: Project[]`.
  - `ToolId = 'select'|'brush'|'eraser'|'rect'|'ellipse'|'line'|'triangle'|'text'|'image'`.
  - Actions:
    - `openCar(t: CarTemplate, p: PanelData)` and `loadProject(p: Project, path: string | null)`: both reset history, selection and dirty;
    - `addItem(item: Item)`: pushes the item on top and selects it;
    - `updateItem(id: string, patch: Partial<Item>, opts?: { transient?: boolean })` and `commitTransient()`;
    - `removeItem(id)`;
    - `duplicateItem(id)`: new id, inserted directly above, `x+40`, `y+40`, name `<name> copy`;
    - `flipItem(id, axis: 'h' | 'v')`: negates `scaleX` / `scaleY`;
    - `moveItem(id, toIndex)`;
    - `setCarColour(c)`, `select(id | null)`, `setTool(t)`, `setBrush(patch)`, `useColour(c)` (updates recentColours);
    - `undo()`, `redo()`, `markSaved(path)`.
  - Every non-transient change pushes the previous `project` onto `past` (cap 100), clears `future` and sets `dirty`. A transient sequence pushes one entry, the snapshot from before its first transient update, when `commitTransient()` is called.
  - Factories:
    - `newShapeItem(shape, rect: {x,y,w,h}, colour)` → name `Rectangle N` / `Circle N` / `Line N` / `Triangle N`; `stroke '#000000'`, `strokeWidth 0`, `cornerRadius 0`; for `line`, height = thickness (default 40);
    - `newTextItem(at, colour)` → `'Text'`, Arial Black, 200 px, name `Text N`;
    - `newImageItem(assetId, name, w, h, at)`;
    - `newBrushItem()` → name `Brush N`, position 0,0, scale 1, `strokes: []`.
    - N counts per kind in the current project, starting at 1.
  - Assets: `addAsset(bytes: Uint8Array, mime: string): Promise<{ id: string; width: number; height: number }>` (decodes it into an `HTMLImageElement` kept in memory), `getAssetImage(id)`, `getAssetBytes(id)`, `allAssets()`, `clearAssets()`. Not exercised in unit tests (browser-only).

- [ ] **Step 1: Write the failing tests** (Vitest, node env):
  - add → `items.length 1`, selected = the new id, `past.length 1`, `dirty true`.
  - undo → `items.length 0`; redo → 1.
  - 10 transient `updateItem` calls followed by `commitTransient` → `past.length` grows by exactly 1, and undo restores the pre-drag `x`.
  - 120 adds → `past.length === 100`.
  - `flipItem(id,'h')` twice → `scaleX` back to 1.
  - `duplicateItem` → new item at index+1 with `x+40`, `y+40` and name `Rectangle 1 copy`.
  - `moveItem(id, 0)` moves it to the bottom.
  - `removeItem(selected)` → `selectedId null`.
  - `loadProject` → `past` and `future` empty, `dirty false`.
  - `newShapeItem('rect', …)` has finish `paint`; `newTextItem` has finish `sticker`.
  - Names: two rects give `Rectangle 1`, `Rectangle 2`.
  - `useColour` keeps at most 8 colours, deduplicated, newest first.
- [ ] **Step 2:** Run `npx vitest run tests/unit/store.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with Immer `produce` so snapshots share structure.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: editor store with undo history and item factories`.

---

### Task 9: Editor canvas: panels, outline, veil, car colour, zoom and pan

**Files:**
- Create: `src/renderer/screens/Editor.tsx`, `src/renderer/components/TopBar.tsx`, `src/renderer/components/ColourPicker.tsx`, `src/renderer/canvas/CanvasView.ts`, `src/renderer/canvas/panelImages.ts`
- Modify: `src/renderer/App.tsx` (start screen → editor on car click), `src/renderer/main.tsx` (test hook)
- Test: `tests/e2e/canvas.spec.ts`

**Interfaces:**
- Consumes: `useEditor` (Task 8), `window.lmu.openTemplate` (Task 6), `PanelData.outline` (Task 7).
- Produces:
  - `class CanvasView { constructor(container: HTMLDivElement); setPanel(p: PanelData, carColour: string): void; setCarColour(c: string): void; fit(): void; textureToClient(x: number, y: number): { x: number; y: number }; clientToTexture(x: number, y: number): { x: number; y: number }; destroy(): void }`
  - Konva layers, bottom → top: background, panels, items, veil, outline, ui (Transformer and tool previews).
  - `makePanelCanvas(panel: PanelData, colour: string): HTMLCanvasElement` (car colour where panel = 1, transparent elsewhere) and `makeVeilCanvas(panel): HTMLCanvasElement` (`rgba(205,205,205,0.75)` where panel = 0).
  - The outline is one `Konva.Shape` that strokes a cached `Path2D` of all loops, with `strokeScaleEnabled: false`, width 1, colour `#333333`.
  - When `LIVERY_TEST=1`, `window.__livery = { getState: () => useEditor.getState(), textureToClient, clientToTexture }`.
  - The ColourPicker component (colour square, hex input, last 8 colours) is reused in Tasks 10–12.

- [ ] **Step 1: Write the failing test** `canvas.spec.ts` (standard fixtures; click "Test Car Alpha — 2025"). Use `page.screenshot` clipped to 1 px at `textureToClient(…)`:
  - texture (300,200) is `rgb(255,255,255)`; (50,50) is `rgb(205,205,205)`;
  - within ±2 screen px horizontally of `textureToClient(100,200)` (the panel's left edge) there is a pixel with every channel < 120 (the outline);
  - after setting "Car colour" to `#1e90ff`, (300,200) is `rgb(30,144,255)`;
  - a wheel up over the canvas grows the scale, and "Fit" restores it;
  - Space+drag moves `textureToClient(300,200)` by the drag distance (±2 px);
  - "← Cars" returns to the start screen;
  - opening "Test Car Beta" shows (500,400) white and (100,100) grey.
- [ ] **Step 2:** Run `npm run build && xvfb-run -a npx playwright test tests/e2e/canvas.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The view fits the template into the canvas area with a 24 px margin. Wheel zooms around the cursor by ×1.15 per notch, clamped to [fit/4, 8]. Pan with Space+drag or middle-mouse drag. Show "Opening <car>…" while `openTemplate` runs. If `PanelData.source === 'none'`, show the one-line note "This car's template has no panel outlines".
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: editor canvas with white panels, outline and car colour`.

---

### Task 10: Shapes, selecting and transforming, properties and the items list

**Files:**
- Create: `src/renderer/canvas/nodes.ts`, `src/renderer/canvas/tools.ts`, `src/renderer/components/Toolbar.tsx`, `src/renderer/components/PropertiesPanel.tsx`, `src/renderer/components/ItemsList.tsx`
- Modify: `src/renderer/canvas/CanvasView.ts` (sync items from the store, Transformer, keyboard), `src/renderer/screens/Editor.tsx`
- Test: `tests/e2e/shapes.spec.ts`

**Interfaces:**
- Consumes: store actions and factories (Task 8), `CanvasView` (Task 9).
- Produces:
  - `createItemNode(item: Item, ctx: NodeContext): Konva.Node` and `updateItemNode(node: Konva.Node, item: Item, ctx: NodeContext): void`, where `NodeContext = { getImage(assetId: string): CanvasImageSource | undefined; getBrushCanvas(item: BrushItem): HTMLCanvasElement }`. The same functions are used for export in Task 13.
  - Shape mapping:
    - rect → `Konva.Rect` with `cornerRadius`;
    - ellipse → `Konva.Ellipse` with radii w/2, h/2, offset so x,y is the top-left of its box;
    - line → `Konva.Rect` of length × thickness filled with `fill` (a stripe);
    - triangle → `Konva.Line` closed with points `[w/2,0, w,h, 0,h]`.
  - Every node gets `id = item.id`, `opacity`, `visible`, `x`, `y`, `rotation`, `scaleX`, `scaleY`.
  - Transformer: on `transformend` / `dragend` the change is written back with `updateItem(…, { transient: true })` during the gesture and `commitTransient()` at the end.
  - The keyboard handler ignores events whose target is an `input`, `textarea`, `select` or contenteditable element.

- [ ] **Step 1: Write the failing test** `shapes.spec.ts` (Alpha car):
  - Rect tool, drag from texture (120,120) to (220,220) with colour `#ff0000` → one item with `width 100`, `height 100`, `x 120`, `y 120` (±1), finish `paint`; texture (170,170) shows `rgb(255,0,0)`.
  - Circle, Line and Triangle tools each create one item of the right `shape`.
  - Select tool: dragging the rect by (+50,0) texture px → `x 170`; one undo puts it back at 120.
  - Properties: fill set to `#00ff00` → pixel turns green. Opacity slider at 50% → `opacity 0.5`. The Finish dropdown lists the five labels, and choosing "Carbon" → `finish 'carbon'`. The hint text "You choose what each finish looks like in the game's showroom." is visible.
  - Items list: newest on top. The eye toggles `visible`. Dragging the bottom row to the top reorders. Double-clicking renames to "Door stripe".
  - "Flip ⇆" → `scaleX −1`. "Duplicate" → 2 items, the copy at +40,+40. The Delete key removes the selected item.
  - Review focus 1: with focus in the name field, pressing Delete and Ctrl+Z changes the text only; the item count and positions don't change.
  - Review focus 3: relaunch with `--force-device-scale-factor=1.5`; the rect drag from (120,120) to (220,220) gives the same item geometry (±1).
  - Ctrl+Z / Ctrl+Y and the ↶ ↷ buttons undo and redo.
- [ ] **Step 2:** Run `npm run build && xvfb-run -a npx playwright test tests/e2e/shapes.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Shift while scaling keeps proportions (Transformer `keepRatio` toggled by Shift). Arrow keys nudge 1 px, or 10 px with Shift. Escape deselects. New shapes use the colour currently in the picker.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: shapes, selection/transform, properties and items list`.

---

### Task 11: Images and text

**Files:**
- Modify: `src/renderer/canvas/nodes.ts`, `src/renderer/canvas/tools.ts`, `src/renderer/components/Toolbar.tsx`, `src/renderer/components/PropertiesPanel.tsx`, `src/renderer/state/assets.ts`
- Test: `tests/e2e/images-text.spec.ts` (generates PNG fixtures with pngjs in `beforeAll`)

**Interfaces:**
- Consumes: `addAsset` and factories (Task 8), `createItemNode` (Task 10).
- Produces:
  - `importImageFile(file: File): Promise<ImageItem | { error: string }>`. It accepts PNG, JPG, WebP and SVG (by MIME type or extension). Original bytes are kept as they are. Only images whose longest side is over 4096 px (the texture size, so anything larger can't add detail) are downscaled to 4096 and stored as PNG. This is a deliberate refinement of the spec's "original resolution". SVGs are rasterised so the longest side is 4096. Anything else, or a decode failure, returns `{ error: "Can't open this file. Use PNG, JPG, WebP or SVG." }`.
  - New images are centred in the visible area and scaled so they fit within it.
  - Image node: `Konva.Image`. Text node: `Konva.Text` with `fontStyle` built from bold/italic, and `stroke` / `strokeWidth` for the outline.

- [ ] **Step 1: Write the failing test:**
  - The "Image" button (a file input) with a 200×100 red PNG → one image item with `width 200`, `height 100`, finish `sticker`, centred in the view (±2); its pixel shows red.
  - Dragging and dropping the same file onto the canvas also adds it.
  - Review focus 2: a 6000×3000 PNG → stored `width 4096`, `height 2048`. A `.txt` file and a truncated PNG each show the exact error message and add no item.
  - An SVG of a 100×50 viewBox → item size 4096×2048.
  - Text tool: click at (300,200), type "HELLO", press Enter → a text item `text 'HELLO'`, `fontFamily 'Arial Black'`, finish `sticker`. The font dropdown lists the 10 fonts exactly. Bold toggles `bold true`. Double-clicking the text edits it.
- [ ] **Step 2:** Run `npm run build && xvfb-run -a npx playwright test tests/e2e/images-text.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Text is edited in an absolutely positioned `<textarea>` over the canvas, which commits on Enter or blur and cancels on Escape.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: image import and text tool`.

---

### Task 12: Brush and eraser

**Files:**
- Create: `src/renderer/canvas/brush.ts`
- Modify: `src/renderer/canvas/tools.ts`, `src/renderer/canvas/nodes.ts`, `src/renderer/components/PropertiesPanel.tsx` (brush settings when the brush or eraser tool is active)
- Test: `tests/e2e/brush.spec.ts`

**Interfaces:**
- Consumes: `newBrushItem` and `updateItem` (Task 8), `NodeContext.getBrushCanvas` (Task 10).
- Produces:
  - `drawStroke(ctx: CanvasRenderingContext2D, s: BrushStroke): void`.
  - `class BrushCache { get(item: BrushItem, width: number, height: number): HTMLCanvasElement; drop(id: string): void }`. It redraws incrementally when `item.strokes` extends the previously drawn array with the same prefix (same object references), and redraws everything otherwise, for example after undo.
  - Brush canvases are the template size, positioned at the item's x,y with the item transform.

- [ ] **Step 1: Write the failing test:**
  - Brush (colour `#0000ff`, size 40, opacity 100%, softness 0): drag from texture (150,150) to (450,150) → one brush item with one stroke; (300,150) is `rgb(0,0,255)`; (300,200) is still white.
  - A second stroke while the brush item is selected → still one item, 2 strokes.
  - Eraser along the same line → (300,150) is white again; the item has 3 strokes, the last with `mode 'erase'`.
  - Undo → blue again.
  - Opacity 50% → (300,150) is about `rgb(128,128,255)` (±6).
  - Softness 100% → the pixel 18 px from the centre line is lighter than with softness 0.
  - With the rect item selected, a brush stroke creates a new brush item, `Brush 1`.
- [ ] **Step 2:** Run `npm run build && xvfb-run -a npx playwright test tests/e2e/brush.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `drawStroke`.**
  - Draw the stroke into a scratch canvas covering the stroke's bounding box plus `size`: a polyline with `lineCap`/`lineJoin 'round'`, `lineWidth = size × (1 − 0.5 × softness)`, colour at alpha 1, and `ctx.filter = softness > 0 ? \`blur(${softness × size / 4}px)\` : 'none'`.
  - Composite the scratch canvas onto the target with `globalAlpha = opacity` and `globalCompositeOperation` `'source-over'` (paint) or `'destination-out'` (erase).
  - Pointer points go through the inverse of the item's absolute transform.
  - Points are only added while the pointer has moved at least 1 texture px.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: brush and eraser`.

---

### Task 13: Send to game

**Files:**
- Create: `src/renderer/export/regionMap.ts`, `src/renderer/export/renderLivery.ts`, `src/main/livery/writeLivery.ts`, `src/renderer/components/Dialog.tsx`
- Modify: `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`, `src/renderer/components/TopBar.tsx`
- Test: `tests/unit/regionMap.test.ts`, `tests/unit/writeLivery.test.ts`, `tests/e2e/send.spec.ts`

**Interfaces:**
- Consumes: `createItemNode` (Task 10), `BrushCache` (Task 12), `applyLevels` and `encodeTga32` (Task 2), `finishById` (Task 2).
- Produces:
  - `paintRegion(region: Uint8ClampedArray, itemRgba: Uint8ClampedArray, rgb: [number, number, number]): void` sets RGB (alpha stays 255) wherever `itemRgba` alpha ≥ 128.
  - `renderLivery(input: { width: number; height: number; carColour: string; items: Item[]; levels: LevelsSettings | null }, ctx: NodeContext): Promise<{ paint: Uint8ClampedArray; region: Uint8ClampedArray }>`. It uses one offscreen Konva stage of template size and renders the visible items one at a time into a scratch layer: read RGBA → `paintRegion`, then draw onto the paint canvas. The paint starts as a full fill of the car colour, then Levels is applied and alpha forced to 255. The region starts black with alpha 255.
  - Main:
    - `liveryStatus(lmuFolder: string): { folder: string; exists: boolean }`, where folder = `<lmu>\UserData\Liveries`;
    - `writeLiveryFiles(folder: string, paint: Uint8Array, region: Uint8Array, opts: { backup: boolean; now?: Date }, fsx = fs): void`: `mkdir -p`; optional backups `customskin_backup_YYYYMMDD-HHMMSS.tga` and `customskin_region_backup_YYYYMMDD-HHMMSS.tga` (copies of the existing files); write each file to `<name>.tmp-<pid>` and then `renameSync` it over the target; throws on failure;
    - `describeWriteError(e: NodeJS.ErrnoException): string`:
      - EPERM/EACCES → "Windows didn't allow writing to the game folder."
      - EBUSY → "The game is using the file right now. Leave the showroom or close the game, then try again."
      - ENOSPC → "The disk is full."
      - anything else → "Something went wrong (<code>)."
  - IPC / `LmuApi` additions:
    - `liveryStatus(): Promise<{ folder: string; exists: boolean }>`;
    - `writeLivery(paint: Uint8Array, region: Uint8Array, backup: boolean): Promise<{ ok: true } | { ok: false; message: string }>`;
    - `saveLiveryElsewhere(paint: Uint8Array, region: Uint8Array): Promise<{ ok: true; folder: string } | null>` (folder dialog, then the same writer without backup).

- [ ] **Step 1: Write the failing tests:**
  - regionMap: on a 2×1 region, item alpha `[255, 100]` with rgb `(255,0,0)` → pixel 0 red, pixel 1 still black; alpha 128 counts.
  - writeLivery (temp dir): both files are written byte-exact; with existing files and `backup: true` at `now = 2026-11-15T10:20:30` the two backup names exist with the old bytes; no `*.tmp-*` remains; an injected `renameSync` throwing EBUSY propagates, and `describeWriteError` returns the EBUSY sentence; EACCES and ENOSPC map to their sentences.
  - send.spec (Alpha car; red rect from (120,120) to (220,220) with finish Carbon; a 200×100 white PNG image centred at (750,700) with finish Sticker):
    - "Send to game" with no existing files → "Sent! Press RELOAD in the showroom.";
    - decoding both TGAs from `<fake lmu>/UserData/Liveries` gives size 1024×1024 and header bytes `[0,0,2,0,0,0,0,0,0,0,0,0,0,4,0,4,32,8]`;
    - paint (300,200) = `(210,210,210,255)`, (50,50) = `(210,210,210,255)` (the whole texture is car colour), (170,170) = `(210,10,10,255)`;
    - region (170,170) = `(255,0,0)`, (750,700) = `(255,255,255)`, (300,200) = `(0,0,0)`;
    - a second send in a fresh session shows the overwrite prompt with the three exact buttons; "Keep a backup and replace" creates both backup files; a third send in the same session doesn't ask again;
    - Review focus 5: make `UserData/Liveries/customskin.tga.tmp-*` creation fail by replacing `Liveries` with a file → "Couldn't write to the game folder" plus a reason is shown with "Save the two files somewhere else…"; choosing a temp folder (stub `dialog.showOpenDialog` via `app.evaluate`) writes both files there.
- [ ] **Step 2:** Run `npx vitest run tests/unit/regionMap.test.ts tests/unit/writeLivery.test.ts` and `npm run build && xvfb-run -a npx playwright test tests/e2e/send.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Ctrl+Enter also sends. While sending, the button shows "Sending…" and is disabled. "Asked this session" is renderer state. Each TGA is encoded in the renderer and sent over IPC as `Uint8Array`.
- [ ] **Step 4:** Run both commands. Expected: PASS.
- [ ] **Step 5:** Commit `feat: send livery to the game (paint + finish files)`.

---

### Task 14: Projects: save, open, autosave, close prompt, missing template

**Files:**
- Create: `src/renderer/project/projectZip.ts`, `src/main/project/projectIo.ts`
- Modify: `src/main/index.ts` (close handshake), `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/types.ts`, `src/renderer/components/TopBar.tsx`, `src/renderer/screens/StartScreen.tsx`
- Test: `tests/unit/projectZip.test.ts`, `tests/e2e/project.spec.ts`

**Interfaces:**
- Consumes: store `loadProject` and `markSaved` (Task 8), assets (Task 8), `openTemplate` / `openTemplateFile` / `chooseTemplateFile` (Task 6).
- Produces:
  - `serializeProject(p: Project, assets: Array<{ id: string; mime: string; bytes: Uint8Array }>): Promise<Uint8Array>`: a zip with `project.json` and `assets/<id>.<png|jpg|webp>` (extension from the MIME type; SVGs are already rasterised to PNG on import).
  - `deserializeProject(bytes: Uint8Array): Promise<{ project: Project; assets: Array<{ id; mime; bytes }> }>`: throws `ProjectFileError("This file isn't a livery project.")` for a non-zip, a missing `project.json` or `version !== 1`.
  - `LmuApi` additions:
    - `saveProject(bytes: Uint8Array, path: string | null): Promise<string | null>` (`path === null` → Save As dialog, default `<Documents>\LMU Livery Builder\<car label>.lmulivery`, folder created if missing);
    - `openProject(): Promise<{ path: string; bytes: Uint8Array } | null>`, `openRecentProject(path)`, `listRecentProjects(): Promise<string[]>` (max 8);
    - `writeAutosave(bytes)`, `readAutosave(): Promise<Uint8Array | null>`, `clearAutosave()` (file `<userData>/autosave.lmulivery`);
    - `onCloseRequested(cb: () => void)` and `closeNow()`.
  - On window `close`, main calls `preventDefault()` and sends `app:close-requested`. The renderer saves an autosave and, if dirty, asks "Save changes?" [Save] [Don't save] [Cancel], then calls `closeNow()`.

- [ ] **Step 1: Write the failing tests:**
  - projectZip: a project with one item of each type (a brush item with 2 strokes, an image item with 3 asset bytes) round-trips deep-equal, and the asset bytes come back identical. Random bytes → `ProjectFileError` with the exact message. A zip with `version: 2` → `ProjectFileError`.
  - project.spec:
    - Add a rect and a text, then Ctrl+S (stub `dialog.showSaveDialog` to return `<tmp>/a.lmulivery`) → the file exists and the title shows "a".
    - Ctrl+O on `a.lmulivery` from the start screen restores 2 items, the car "Test Car Alpha — 2025", and a clean dirty flag.
    - Recent projects lists `a.lmulivery`.
    - Closing with unsaved changes shows "Save changes?"; "Cancel" keeps the window open.
    - Relaunch after killing the app (dirty) → the start screen offers "Restore your last unsaved work?", and accepting restores the items.
    - Opening a project whose template file is missing shows "This project needs the car template <fileName>, which wasn't found." with "Choose template file…". Choosing the fixture file opens it.
- [ ] **Step 2:** Run `npx vitest run tests/unit/projectZip.test.ts` and `npm run build && xvfb-run -a npx playwright test tests/e2e/project.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The autosave timer runs every 60 s while `dirty`; a successful save clears the autosave file. Brush items are saved as their strokes (in `project.json`), not as images.
- [ ] **Step 4:** Run both commands. Expected: PASS.
- [ ] **Step 5:** Commit `feat: save/open projects, autosave and close prompt`.

---

### Task 15: Windows build, CI and README

**Files:**
- Create: `electron-builder.yml`, `.github/workflows/build-windows.yml`, `README.md`
- Modify: `package.json` (`dist:win` script)

**Interfaces:**
- Consumes: `--smoke-test` (Task 1).
- Produces:
  - `dist/LiveryBuilder-win-x64.zip` containing `LiveryBuilder.exe`.
  - The workflow runs on push to `claude/**` and `main`, and on `workflow_dispatch`, with `runs-on: windows-latest`:
    - `npm ci`, `npm test`, `npm run dist:win`;
    - smoke test: unzip to `$env:RUNNER_TEMP\app` and run `LiveryBuilder.exe --smoke-test`, asserting exit code 0 within 60 s;
    - `actions/upload-artifact` named `LiveryBuilder-win-x64` with the zip.

- [ ] **Step 1:** Write `electron-builder.yml`:
  - `appId: com.liverybuilder.app`, `productName: LMU Livery Builder`, `executableName: LiveryBuilder`, `directories.output: dist`;
  - `files: [out/**, package.json]`;
  - `win: { target: [{ target: zip, arch: [x64] }], signAndEditExecutable: false }`;
  - `artifactName: LiveryBuilder-win-x64.${ext}`, `npmRebuild: false`.
- [ ] **Step 2:** Run `npm run dist:win` on Linux. Expected: `dist/LiveryBuilder-win-x64.zip` exists and `unzip -l` lists `LiveryBuilder.exe` and `resources/app.asar`.
- [ ] **Step 3:** Write the workflow. Push. Check the run with the GitHub MCP `actions_list` / `actions_get` tools.
  - Expected: the job is green and the artifact `LiveryBuilder-win-x64` exists.
  - If pushing the workflow file is rejected (token lacks the workflows permission), keep the file out of the commit, save it to `docs/build-windows.yml.txt`, and tell the user how to add it through GitHub's web editor. The README covers both cases.
- [ ] **Step 4:** Write `README.md` for the user, in plain language:
  - Download: GitHub → Actions → latest "Build Windows" run → artifact `LiveryBuilder-win-x64`. Unzip, run `LiveryBuilder.exe`, and on the SmartScreen warning choose "More info → Run anyway".
  - Using it, in 6 steps: pick car → add stuff → set finishes → Send to game → in LMU: Team → Liveries → Apply to a New Car → Showroom → RELOAD → pick materials for each finish in the showroom.
  - A short "Developing" section: `npm install`, `npm run dev`, `npm test`, `xvfb-run -a npm run e2e`.
- [ ] **Step 5:** Commit `build: portable Windows zip, CI build with smoke test, README`.

---

### Task 16: Verify against the real templates

**Files:**
- Create: `tools/check-templates.ts`, `tools/reference_panels.py`
- Test: `tests/e2e/real-templates.spec.ts` (skipped unless `/home/user/lmu-data/tpl/LiveryTemplates` exists)

**Interfaces:**
- Consumes: `extractPanelData` (Task 5), `traceContours` (Task 7).
- Produces:
  - `npx tsx tools/check-templates.ts <templatesDir> <outDir>` writes `<outDir>/stats.csv` (file, source, panel share, ms, levels) and `<outDir>/contact-sheet.png` (60 panel maps at 256 px with names, rendered in the app's look) using pngjs.
  - `python3 -I tools/reference_panels.py <psd> <out.png>` renders the reference panel map with psd-tools (mask layer composite alpha < 128). Run with `<outDir>` in the session scratchpad, never in the repo.

- [ ] **Step 1: Write the failing e2e test** `real-templates.spec.ts`. Use a fake LMU folder whose `Support/LiveryTemplates` is a symlink to the real folder:
  - "Toyota GR010 — 2025" opens with panels visible in under 15 s the first time and under 2 s the second time (cache);
  - "Aston Martin Valkyrie" (mesh lines) opens and shows white at a panel pixel taken from `stats`.
- [ ] **Step 2:** Run it. Expected: FAIL until the tools exist and the timings hold. Fix any performance problem found (for example move the cache write off the response path).
- [ ] **Step 3:** Run `check-templates.ts` and `reference_panels.py` for `GT3_Ferrari296LMGT3_2025`, `HYPER_Porsche963_2025` and `LMP2_Oreca07_2025`. Compare each with the app's map. Expected: fewer than 0.5% of pixels differ. View the contact sheet and check visually that all 60 look like car panels. Send the contact sheet to the user.
- [ ] **Step 4:** Run the full suite: `npm test && npm run build && xvfb-run -a npx playwright test`. Expected: all pass.
- [ ] **Step 5:** Commit `test: verification tools and real-template e2e checks`.
