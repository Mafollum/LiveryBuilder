# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Keep this file current.** Every commit that changes behaviour, commands, IPC channels, data formats,
> env vars, tests or project structure must update the matching section here in the same commit.
> When expanding it, keep the seven-section layout below, use short scannable bullets, list names only
> (never secret values), and don't repeat what is easy to discover by reading one file.

## 1. Project overview & tech stack

- **LMU Livery Builder**: a Windows desktop livery editor for the sim racing game *Le Mans Ultimate*. User picks a car template, places images/shapes/text/brush strokes on the car's panels, and "Send to game" writes `customskin.tga` + `customskin_region.tga` into `<LMU>\UserData\Liveries` (user then presses RELOAD in the game's showroom).
- **Electron 45** (main / preload / renderer) built with **electron-vite 6** + **Vite 8**, **TypeScript 5.9** (strict), **React 19**, **Konva 10** (canvas), **zustand 5 + immer** (state), **jszip** (project files), **ag-psd** (reading the game's PSD templates), **pngjs**, **onnxruntime-web** + U²-Net small (`resources/u2netp.onnx`) for offline automatic background removal.
- Tests: **Vitest 5** (unit, node env) and **Playwright** driving Electron (e2e).
- Node.js 22. No linter/formatter is configured — `npm run typecheck` is the static check.
- Audience is non-technical: UI wording must be plain ("Finish", "panels", "Send to game") — never "UV", "region", "levels", "mask", "layer" (see `docs/superpowers/specs/`).

## 2. Essential commands

```bash
npm ci                     # install (also downloads the Electron binary)
npm run dev                # app with hot reload
npm run typecheck          # tsc for node (main/preload/shared/tests/tools) and web (renderer) projects
npm test                   # all unit tests (Vitest, ~1 s)
npx vitest run tests/unit/store.test.ts          # one unit file
npx vitest run -t "flip"                          # unit tests by name
npm run build              # electron-vite build -> out/  (REQUIRED before e2e: tests launch out/main/index.js)
npm run build && xvfb-run -a npx playwright test --trace off                    # all e2e (headless needs xvfb)
xvfb-run -a npx playwright test tests/e2e/send.spec.ts --trace off              # one e2e file
xvfb-run -a npx playwright test -g "smoke" --trace off                         # e2e by name
npm run pack:windows       # build + copy out/ and resources/ into windows/app (commit the result!)
npm run dist:win           # portable zip in dist/ via electron-builder
```

- No database / migrations.
- Template diagnostics (need real LMU templates): `npx tsx tools/check-templates.ts <templatesDir> <outDir>`, `npx tsx tools/render-fixed.ts <template.psd> <out.png>`; Python cross-checks with psd-tools: `python3 -I tools/reference_panels.py …`, `python3 -I tools/compare_fixed.py …`.

## 3. Demo & self-testing environments

- **No real game needed.** Tests build a fake LMU install:
  - `tests/fixtures/makeTemplate.ts` — writes small synthetic LMU-like PSDs (base layer, Levels, `Mask(Disable for export)` layer or wireframe, fixed-element groups).
  - `tests/fixtures/fakeLmu.ts` — creates `<tmp>/Le Mans Ultimate/Support/LiveryTemplates/*` + `UserData/`.
  - `tests/e2e/helpers.ts` — `makeSandbox()` (temp LMU + userData + Documents, returns `env`), `launchApp(env)`, `openCar(page, label)`, `dragTexture`, `texturePixel`/`pixelAt` (screen colour checks), `items(page)`. Standard fixtures: `ALPHA` (GT3, mask-based, Levels 10–210, two fixed elements) and `BETA` (Hypercar, wireframe-based).
- **Test hook**: with `LIVERY_TEST=1` the renderer exposes `window.__livery` (`getState()` = zustand store incl. actions, `textureToClient`, `clientToTexture`, `getView`, `isCanvasReady`, `brushCanvasSize`) — see `src/renderer/main.tsx`. Use it to drive/assert state instead of pixel-hunting.
- **Real templates** (game files, never committed): tests in `tests/unit/realTemplates.test.ts` and `tests/e2e/real-templates.spec.ts` use `/home/user/lmu-data/tpl/LiveryTemplates` and are skipped when absent (normal in cloud sessions).
- **How to verify your own change before finishing:**
  1. `npm run typecheck && npm test`.
  2. `npm run build`, then run the relevant e2e spec(s) with `xvfb-run -a npx playwright test <spec> --trace off`; for UI changes add/extend a spec using `makeSandbox` + `launchApp` + `window.__livery`, and take a screenshot (`page.screenshot`) to look at it.
  3. If anything under `src/` or `resources/` changed: `npm run pack:windows` and commit `windows/app/` — `tests/e2e/windows-folder.spec.ts` fails if `windows/app/out` differs from a fresh `out/`.
  4. Before finishing, run the full suites (`npm test`, full e2e) — all must pass.

## 4. Directory structure & architecture

- `src/main/` — Electron main process (Node): `index.ts` (window, close handshake, `--smoke-test`), `ipc.ts` (LMU folder, templates, livery IPC), `project/projectIo.ts` (save/open/recent/autosave IPC), `ai.ts` (serves model + ORT wasm bytes), `settings.ts` (`<userData>/settings.json`), `lmu/findLmu.ts` (Steam library search), `livery/writeLivery.ts`, `templates/*`.
- `src/preload/index.ts` — the only bridge: exposes `window.lmu` implementing `LmuApi` (contextIsolation on).
- `src/shared/` — code used by both sides and tests: `types.ts` (data model + `LmuApi`), `finish.ts`, `levels.ts`, `tga.ts`, `contours.ts`. Alias `@shared/*`.
- `src/renderer/` — React app: `App.tsx` (screens start/opening/editor, modals, autosave restore, close prompt), `screens/`, `components/`, `state/` (store, factories, assets), `canvas/` (Konva view, tools, brush, nodes), `export/` (livery rendering), `project/` (.lmulivery zip), `image/` (background removal).
- `windows/app/` — committed, prebuilt copy of `out/` + `resources/` run by `Start LiveryBuilder.bat` (downloads + SHA-256-checks the Electron runtime on first start). Generated; never hand-edit.
- `docs/superpowers/specs|plans/` — original design and implementation plan.

**Data flow**
- *Open car*: renderer `lmu.openTemplate(file)` → main `openTemplateAt` → cache hit in `<userData>/panel-cache` (key = name+size+mtime, `v3` prefix — bump on format change) or a **worker thread** (`panelWorker.ts`) running `extractPanelData` (`panelMap.ts`: panel map from mask layer, else from wireframe via `wirePanels.ts`/`morph.ts`; Levels; fixed elements via `fixedElements.ts` + `composite.ts`) plus outline tracing → `PanelData`.
- *Edit*: all user changes go through `useEditor` actions → `project.items` (bottom→top). `CanvasView` (Konva stage: background, panels, items, fixed, veil, outline, UI) reconciles nodes from items via `canvas/nodes.ts`; `ToolController` handles drawing tools.
- *Send to game*: `export/renderLivery.ts` renders each visible item with the **same** `createItemNode` used on screen, only in its bounding box, at template resolution; builds the finish map (`regionMap.ts`, alpha ≥ 128 → finish colour), draws enabled fixed elements as Sticker, applies template Levels, encodes 32-bit TGA → main `writeLiveryFiles` (atomic pair write with rollback, retries on EPERM/EACCES/EBUSY, optional timestamped backup).
- *Projects*: `.lmulivery` = zip with `project.json` (`Project`, `version: 1`) + `assets/<id>.<ext>`; image bytes live in the renderer `assets` map (not the store).

## 5. Core functionality & APIs (reuse these)

- **Store** (`state/store.ts`): `addItem`, `updateItem(id, patch, {transient})` + `commitTransient()` (drags/sliders = one undo step), `removeItem`, `duplicateItem`, `flipItem`, `moveItem`, `setCarColour`, `setFixedVisible`, `undo/redo` (limit 100), `dirty`, `markSaved`; `localCentre(item)`, `newId()`, `emptyProject()`.
- **Factories** (`state/factories.ts`): `newShapeItem`, `newBrushItem`, etc. with auto names ("Rectangle 2") and `defaultFinishFor` (image/text → sticker, else paint).
- **Assets** (`state/assets.ts`): `addAsset`, `registerAsset`, `getAsset(Image|Bytes)`.
- **Finishes** (`shared/finish.ts`): Paint black, Carbon red, Special 1 green, Special 2 blue, Sticker white in the region TGA.
- **Fixed elements**: `fixedShown(el, project.fixedVisibility)` decides shown/sent, keyed by `label`.
- **Brush** (`canvas/brush.ts`): 8 `BrushKind`s; strokes are item-local points; erase strokes only act within their brush item.
- **Images** (`canvas/importImage.ts`, `image/`): `removePlainBackground` (border-colour flood), `autoBackground.ts` (U²-Net via ORT, model from `lmu.loadBackgroundModel()`); `originalAssetId` enables "Restore original".
- **Messages**: `plainError(e)` turns errors/errno codes into plain sentences; `showMessage(title, text)` opens the app dialog. Main returns `{ ok: false, message }` for expected failures (`describeWriteError`).
- **IPC channels** (`ipc.ts`, `projectIo.ts`, `ai.ts`, `index.ts`): `lmu:getFolder|chooseFolder`, `templates:list|open|openFile|chooseFile`, `livery:status|write|saveElsewhere`, `project:save|open|openRecent|recent`, `autosave:write|read|clear`, `ai:backgroundModel`, `app:ready|close-requested|close-ack|close-now`. Adding one = handler in main + method in `LmuApi` (`shared/types.ts`) + preload.
- Template naming: `carName.ts` parses `Template_<CLASS>_<Car>.psd` into class + label.

## 6. Code conventions & rules

- TypeScript strict everywhere; prefer pure functions in `shared/` or `main/templates/` so they can be unit-tested in node (renderer-only code is covered by e2e).
- Files camelCase (`writeLivery.ts`), React components PascalCase (`PropertiesPanel.tsx`), named exports, short JSDoc `/** … */` explaining *why* on non-obvious functions.
- State: one zustand store; mutate the project only via store actions (immer `produce`), never directly. Non-serialisable data (images, brush canvases) stays outside the store.
- Coordinates: items are in **texture pixels** (template resolution, e.g. 4096²); convert with `CanvasView.textureToClient/clientToTexture`.
- On-screen and export rendering must share `createItemNode`/`updateItemNode` so the game matches the editor.
- File writes are atomic (`*.tmp-<pid>` then rename). Expected failures return plain-language messages; unexpected ones are caught at the UI boundary and shown via `plainError`.
- Styling: plain CSS in `src/renderer/styles.css`; no CSS framework.
- Commits: conventional prefixes (`feat:`, `fix:`, `test:`, `build:`) with a plain-language summary.

## 7. Environment & gotchas

- Env vars (all optional; used by tests): `LIVERY_TEST=1` (exposes `window.__livery`), `LIVERY_LMU_DIR` (override LMU folder), `LIVERY_USER_DATA`, `LIVERY_DOCUMENTS` (override Electron paths), `LIVERY_AUTOSAVE_MS` (default 60000). Dev: `ELECTRON_RENDERER_URL` is set by electron-vite. CLI flag `--smoke-test` exits 0 once the renderer calls `ready()`.
- `externalizeDeps: false`: all dependencies are bundled so `windows/app` runs on a bare Electron runtime with no `node_modules` — don't rely on runtime `require` of node_modules.
- The ORT `.wasm` is stripped from the renderer bundle and served by main (`ai.ts`, `?asset` import); `resources/u2netp.onnx` must ship next to `out/`.
- `windows/app/**` is generated (`.gitattributes` marks it `-diff`); rebuild with `npm run pack:windows` after any source change. `Start LiveryBuilder.bat` must keep CRLF line endings (`*.bat -text`), and its `ELECTRON_VERSION`/SHA-256 must match the installed `electron` package (checked by `windows-folder.spec.ts`).
- E2E needs a display: always `xvfb-run -a` in the cloud container; Playwright config runs 1 worker, 90 s timeout. The first run may print "Downloading Electron binary…".
- Closing the window asks the renderer (unsaved changes) with a 2 s ack timeout; crashed renderers close immediately.
- LMU templates are game files (~4 GB): never commit them. Real-template tests expect exactly 60 templates.
- The GitHub workflow `build-windows.yml` is manual-only (`workflow_dispatch`).
- README download instructions point to the `claude/optimistic-franklin-9lmn7d` branch.
