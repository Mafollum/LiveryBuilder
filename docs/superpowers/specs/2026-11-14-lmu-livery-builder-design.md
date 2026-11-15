# LMU Livery Builder — Design

Date: 2026-11-14
Status: draft, awaiting approval

## 1. Intent

The user makes custom liveries for Le Mans Ultimate (LMU). Today that means
opening the official Photoshop template for a car in GIMP or Photoshop,
painting on top of it, exporting two TGA files by hand and checking the result
in the game's showroom. They want a simple, purpose-built app instead: open a
car's template, place their own images, paint with a basic brush, add basic
adjustable shapes, and see the result on the real car without touching
GIMP/Photoshop.

The "see the car in 3D and rotate it" requirement is met by LMU's own showroom:
the app writes the livery files straight into the game folder and the user
presses **RELOAD** in the showroom. (Decision made by the user, see
§4 Approaches.)

## 2. Goals, non-goals, anti-goals

**Goals**
- A small Windows program the user unzips and runs (no installer).
- Finds the LMU install by itself and opens any official template
  (`Template_*.psd`) from the game's `Support\LiveryTemplates` folder: all 61
  templates, every class and season.
- Edit on the flat 4096×4096 template: own images, brush, adjustable shapes,
  text, layers, with a wireframe/mask overlay as a placement guide.
- One action writes `customskin.tga` and `customskin_region.tga` into the
  game's `UserData\Liveries` folder, ready for RELOAD in the showroom.
- The region file (material map) is generated automatically from a "finish"
  setting on each layer. The user never paints it by hand.
- Save a project and reopen it later to keep editing.

**Non-goals**
- A 3D view inside the app.
- Getting 3D car models out of the game.
- Photoshop-class features: selections, filters, gradients, blend modes for
  user layers, layer masks, PSD export.
- Uploading or sharing liveries (Livery Hub, RaceControl).
- Storing LMU templates in this repository (game files, ~4 GB).
- macOS/Linux builds, an installer, auto-update, code signing.

**Anti-goals** (failure even if it "works")
- A livery that looks right in the app but wrong in the game: flipped,
  misaligned, black car, wrong brightness, compressed TGA.
- Silently overwriting a livery the user already has in the game folder.
- Needing an account, server or internet connection to use it.
- Feeling laggy at 4096×4096 on a normal gaming PC.

## 3. Constraints (verified facts)

**Templates** (checked on the user's copy of all 61 files):
- All are 4096×4096, RGB, 8-bit PSD. Sizes range from 20 MB to 455 MB
  (Toyota GR010).
- File names: `Template_<CLASS>_<Car>[_<variant>].psd`, with CLASS one of
  GT3, GTE, HYPER, LMP2, LMP3 (for example `Template_GT3_Ferrari296LMGT3_2025_ELMS.psd`).
  One name contains a stray space (`…_2025 _ELMS.psd`).
- The top-level layers follow a common pattern, but their names vary
  (full list in Appendix A):
  - paint/base layers (`Base`, `Background`, `Color Fill 1`, `Albedo`, …)
  - carbon/material layers (`Carbon`, `Carbon Fibre`, `plastic`, `steel`, …)
  - number plates (`Number Plates (Don't Move)` and ~15 spellings)
  - stickers (`Car Stickers`, `Class Stickers`, `Decals`, `Sponsors`, icons,
    `Display Panel Position`, `Clamp`, …)
  - a **Levels** adjustment layer (54 of 61)
  - a **mask** layer (`Mask(Disable for export)`, `Maks(…)`, `Mask - Disable for export`, …)
    that blacks out areas of the texture that aren't on the car
  - a **region** group (`Region`/`Regions`/`region`) containing only five
    solid swatches: black, red, green, blue, white
  - a **wireframe** layer (`Wireframe`, `Wire`, `UVW`, `Body_UV`, `WireEVO`, …)
- Layer kinds present: pixel, group, Levels adjustment, solid-colour fill.
  Groups contain smart objects and layers with blend modes. Some layers are
  hidden by default.
- **Levels must be applied on export.** The official guide says: "disable the
  Mask layer and make sure the Levels layer is visible" before exporting. The
  Levels layer compresses the output range of the master channel (for example
  output 10–210, 10–225, 0–190, gamma 1.0) and affects everything below it,
  including the user's artwork. It is applied even where the PSD saved it
  hidden (Corvette Z06 2025, Ligier).

**Output** (matched against a working livery the user supplied):
- Two files: `customskin.tga` (paint) and `customskin_region.tga` (materials).
- Both are TGA type 2 (uncompressed true colour), 32 bpp, 8 alpha bits,
  descriptor byte `0x08` (bottom-left origin), 4096×4096, alpha 255 everywhere.
- Region colours are pure black/red/green/blue/white (0/255 per channel).
- What the region colours mean (official/community guides): **black** = base
  material, the only region that can take metallic/flake paint; **red** = carbon
  preset by default; **green/blue** = free for chrome, sticker, vinyl, etc.;
  **white** = logos and number plates. The actual material for each colour is
  chosen in the game's showroom, not in the file.
- Location: `…\steamapps\common\Le Mans Ultimate\UserData\Liveries\`, directly
  in that folder. It is one fixed showroom slot, not a folder per car. The car
  is chosen in the game (Team → Liveries → Apply to a New Car → Showroom).
  RELOAD in the showroom reloads both files.

**Platform**
- The user's game is at the Steam default,
  `C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate`.
- Chrome and Edge block web pages from reading or writing anything under
  `Program Files`, `Program Files (x86)` and AppData. The block is in Chromium's
  File System Access blocklist, and paths are normalised first, so links and
  junctions don't get around it. A browser-only app therefore can't write the
  livery into the game, so the user chose a **Windows desktop program**.
- Steam normally makes its own folder writable for ordinary users. The user
  already copies livery files there by hand. Whether an ordinary process can
  write there is still checked at runtime (see 5.8).
- The repository is private. The build must reach the user without a public
  host (see 5.1).

## 4. Approaches considered

1. **Flat editor + in-game showroom as the 3D view** (chosen by the user).
   The app edits the 2D template and writes the two files into the game folder,
   and the user presses RELOAD. The 3D view is pixel-exact because it is the
   game itself. The trade-off is that the rotating car is in the game window,
   not inside the app.
   - Delivery, also the user's choice: a **Windows desktop program**. The
     alternatives were a single HTML file opened in Chrome/Edge (ruled out
     because Chromium blocks writing under `Program Files (x86)`) and moving
     the game to another Steam library (the user preferred not to).
2. **3D view inside the app using per-car 3D models.** Rejected: no 3D models
   matching LMU's texture layouts exist publicly. Making them would take hours
   of 3D work per car and would likely still be slightly off.
3. **Extract the car models from the game files.** Rejected: the files are
   encrypted, and extracting them breaks the game's terms.

Existing tools noted as prior art: IlhanYapici/lmu-livery-editor (Windows, 2D)
and Apex & Chill "LMU Livery Studio" (browser, 2D). Neither has a 3D preview.
The user chose to build their own.

## 5. Design

### 5.1 Running the app
- **Electron** desktop program, Windows x64 (builder's choice of framework,
  recorded here as a decision). The editor is a web UI in Electron's renderer.
  All file access goes through the main process with Node `fs`, exposed to the
  UI by a small preload/IPC API. The browser File System Access API isn't used.
- Delivered as a **portable zip** (`LiveryBuilder-win-x64.zip`, ~100 MB): the
  user unzips anywhere and runs `LiveryBuilder.exe`. It's unsigned, so Windows
  SmartScreen warns on first run ("More info → Run anyway"). The download is
  documented in the README.
- No network access at runtime.
- Getting the zip to the user (repo is private, no public hosting), in order
  of preference:
  1. A GitHub Actions workflow on a `windows-latest` runner builds the zip and
     publishes it as a workflow artifact. The user downloads it from the
     Actions tab while logged in. Where possible, the same workflow launches
     the built `.exe` once as a smoke test on real Windows.
  2. If the session can't push workflow files, build the Windows zip on Linux
     (no wine needed for a zip target without exe resource editing) and get it
     to the user another way: for example as a file in the repo if it's under
     100 MB, or by asking the user.
- Settings (LMU folder, recent projects) are stored as JSON in the app's user
  data folder (`%APPDATA%\LiveryBuilder`).

### 5.2 Choosing a car
- First run: the app looks for LMU by itself. It checks the default
  `C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate`, then every
  Steam library listed in `…\Steam\steamapps\libraryfolders.vdf`. If it
  doesn't find LMU, it asks the user to pick the LMU folder (native folder
  dialog). The folder is remembered. Both `Support\LiveryTemplates` and
  `UserData\Liveries` are derived from it, and both can be changed in settings.
- The app lists every `Template_*.psd`, grouped by class, with a readable name
  taken from the file name (for example "Ferrari 296 LMGT3 — 2025 ELMS").
- Picking a car starts a new project from that template. Loading a large
  template shows a progress indicator.

### 5.3 How the template is used
Each top-level template layer/group is sorted into one of these by a
case-insensitive name match. A layer can match several patterns; the first
match in this list wins.

| Kind | Name contains | Behaviour |
|---|---|---|
| Mask | `disable for export`, `mask`, `maks` | Guide overlay that dims off-car areas. Toggleable, **never exported**. |
| Wireframe | `wire`, `uvw`, `_uv` | Guide overlay. Toggleable, adjustable opacity, **never exported**. |
| Region | `region` | Not shown, not exported (swatches only). |
| Levels | layer kind = Levels | Not a visible layer. In every template it sits above all content layers. Its settings are applied to the **whole** composite (template and user layers, whatever their order) in the export and the on-screen preview (see 5.6). If a template has no Levels layer, nothing is applied. |
| Template content | anything else | Appears in the layers panel as a locked layer. Visibility as saved in the PSD, can be toggled. Exported. |

- Template content layers keep their PSD order, blend modes, opacity and group
  structure when composited. Each top-level template layer/group may be
  pre-flattened into one image at load time.
- Template layers can't be edited or moved on the canvas, but the user can
  drag them up or down the layers panel and hide them.
- Number-plate layers get a "don't move/hide" warning icon. The game puts the
  race number on them.
- Default finish (region) of template layers: name contains `carbon` → red.
  Contains `numb`, `nimber`, `numplate`, `sticker`, `icon`, `decal`,
  `sponsor`, `panel`, `banner` → white. (Not `plate` alone: the Toyota's
  `Metal Plates` layer is bodywork, not a number plate.) Everything else → black. The user can
  change it. "Template layer is a sticker/number plate" in 5.4 uses the same
  white-list.

### 5.4 User layers
Every image, shape, text or brush layer is its own layer in one shared layers
panel with the template layers.
- **New layers** go just below the lowest number-plate/sticker template layer,
  so they sit above the base paint and under the mandatory stickers. If no
  such layer exists, they go at the top of the template content. They can be
  dragged anywhere afterwards.
- Layers panel actions: reorder (drag), rename, show/hide, lock, opacity,
  duplicate, delete.
- **Finish** per layer: a dropdown with the five region colours, each shown
  as a swatch and a plain label: "Base paint (black)", "Carbon (red)",
  "Material 2 (green)", "Material 3 (blue)", "Stickers/logos (white)". A
  tooltip explains that the material for each colour is chosen in the game's
  showroom. Defaults: images and text → white; shapes and brush → black.

### 5.5 Tools
- **Select/transform:** click to select, drag to move, corner handles to scale
  (Shift keeps proportions), rotate handle, flip horizontal/vertical, arrow
  keys nudge (Shift = bigger steps), Delete removes.
- **Duplicate & flip:** copies the selected layer, mirrored, so the user can
  place the same design on the other side of the car (the two sides are
  separate areas of the template).
- **Images:** import PNG, JPG, WebP or SVG by button or drag-and-drop.
  Transparency is kept, and images are stored at their original resolution
  so scaling down stays sharp.
- **Shapes:** rectangle (with corner radius), ellipse, line/stripe (with
  thickness) and polygon (click points, double-click to close). Properties:
  fill colour, outline colour, outline width, opacity, and size/rotation via
  handles or number fields. Everything stays editable after creation.
- **Brush:** colour, size, opacity, hardness. Painting goes onto the selected
  brush layer, or a new brush layer if none is selected. The **eraser** erases
  only within the selected brush layer.
- **Text:** font (fonts installed on the PC, or at least a fixed list of
  standard Windows fonts), size, colour, bold/italic, optional outline. Editable after creation. *(Not in the original request; included as
  a proposal.)*
- **Colour picker:** swatch picker with hex input and recent colours.
- **Undo/redo:** Ctrl+Z / Ctrl+Y, at least 50 steps, covering every edit
  including brush strokes.
- **View:** fit-to-screen, mouse-wheel zoom, pan with Space+drag or middle
  mouse, toggles for the wireframe (with opacity) and the mask overlay.

### 5.6 What you see
- The canvas shows the composite with the template's Levels applied, i.e.
  exactly the colours that will be exported (a white rectangle shows as the
  slightly grey value the game receives). The colour picker still shows the
  colour the user chose.

### 5.7 Saving and reopening
- **Autosave** of the current project to the app's user data folder every
  minute or so and on close, restored on the next launch.
- **Save project / Open project:** a single project file (`*.lmulivery`; a zip
  of a JSON description plus the imported images and brush layers) saved where
  the user chooses.
- Default location for project files: `Documents\LMU Livery Builder`.
- Project files store only the template's file name, not the template itself.
  Reopening loads the template from the remembered LMU folder. If the template
  is missing (for example renamed by a game update), the app says which file
  it needs and lets the user pick it.

### 5.8 Send to game
- **Send to game** button (plus a keyboard shortcut). It writes to
  `<LMU folder>\UserData\Liveries`, creating the folder if it's missing.
- Before the first write in a session, if `customskin.tga` already exists
  there, the app asks first and offers to keep a backup copy
  (`customskin_backup_<date>.tga` and the region equivalent).
- Writes both files in the exact format from §3. Each is written to a
  temporary name and then renamed, so the game never sees a half-written
  file. Afterwards it shows "Sent — press RELOAD in the showroom".
- If Windows refuses the write (permissions, or the file locked by the game),
  the app says so in plain words and offers **Save to a folder…**, so the user
  can save the two files elsewhere and copy them over by hand.
- **Paint file:** template content and user layers composited in panel order,
  Levels applied, mask/wireframe/region excluded, alpha forced to 255.
- **Region file:** starts all black. Going bottom to top through visible
  layers, each pixel where a layer is at least half opaque is set to that
  layer's finish colour, so upper layers win. Output uses pure colours only.
- Writing is manual (button), not on every change. Each write is 128 MB.

### 5.9 Performance targets
- Moving, scaling and painting feel smooth at fit-to-screen and when zoomed in
  on a typical gaming PC.
- Send to game finishes in a few seconds.
- Every template loads, including the 455 MB ones, with progress shown.

## 6. Left to the builder
- UI framework, PSD library (for example `ag-psd`), canvas/rendering
  approach, Electron packaging tool, where PSD parsing runs (renderer, worker
  or main process).
- How brush strokes are stored (raster per brush layer or stroke vectors),
  provided undo and the project file work.
- How template layers are pre-flattened and cached, and how memory is managed
  for very large PSDs.
- Exact UI layout, icons and keyboard shortcuts beyond those named above.
- Applying generic Levels (per-channel input/output floor and ceiling, gamma),
  not just the master-channel case seen so far.

## 7. Verification
- **Template parsing:** automated test over the names in Appendix A. Each
  template's layers are sorted into the expected kinds.
- **All 61 templates load** without error in a scripted run of the app
  (Playwright driving Electron) against the local copy in the development
  session at `/home/user/lmu-data/tpl/LiveryTemplates/`. The templates are
  never committed. The user's working example livery is at
  `/home/user/lmu-data/ex/example livery/`.
- **LMU folder detection:** unit tests with fake folder trees and a sample
  `libraryfolders.vdf`.
- **Windows:** the built `.exe` starts on a real Windows machine (CI smoke test
  if available, otherwise the user's first run).
- **Composite accuracy:** for a handful of templates (at least one per class,
  including one with fill layers and one 400 MB+), the app's export with no
  user layers matches a reference render made with `psd-tools` (mask and
  wireframe hidden, Levels applied) within a small per-pixel tolerance.
- **File format:** exported TGAs have byte-identical headers to the user's
  working example and the correct orientation (top of the template = top of
  the image).
- **In the game (user):** a test livery (one shape across a door, one logo, one
  finish change) appears correctly after RELOAD.

## 8. Calls made without the user (for review)
1. Text tool included, although only images, brush and shapes were asked for.
2. Default finishes: images/text → white (sticker), shapes/brush → black (base
   paint). Template carbon → red, stickers/number plates → white.
3. New layers go under the template's stickers and number plates by default.
4. "Duplicate & flip" helper for putting a design on the other side of the car.
5. Electron for the Windows program, delivered as a portable zip.
6. Manual "Send to game" button rather than writing on every change.
7. Backup offered before the first overwrite of an existing livery.

## Appendix A — observed top-level layer names (count across 61 templates)

Car Stickers 59 · Class Stickers 54 · Levels 1 54 · Region 52 ·
Mask(Disable for export) 47 · Base 32 · Wireframe 26 · Carbon 23 ·
Display Panel Position 21 · carbon 18 · Number Plates (Don't Move) 18 · UVW 16 ·
Wire 9 · base 8 · banner 7 · Background 7 · Number Plates(Don't Move) 7 ·
Number Plates - Don't Move 6 · Color Fill 1 6 · Carbon Fibre 6 ·
Number Plates 5 · Regions 5 · Number Plates - Don't move! 4 ·
Number Plate (Don't Move) 4 · plastic 3 · Maks(Disable for export) 3 · Layer 1 3 ·
region 3 · Base Colour 3 · Clamp 3 · steel 2 · Number Plates - Don't Move! 2 ·
Numplate(Don't Move) 2 · Numplates 2 · Mask - Disable for export 2 · Albedo 2 ·
wire 2 · Plastic 2 · Number Plates(don't move) 2 · Mask (Disable for export) 2 ·
Color Fill 2 2 · fine carbon 2 · black plastic 2 · dark grey plastic 2 ·
Mask(Disable For Export) 2 · Car 2 · Number Board(Don't Move) 2 ·
Class Stickers copy 2 · Carbon Fiber 2 · PARTS 2 · Metal Plates 2 · Numplate 2 ·
and once each: Dsiplay Panel Position, Layer 0, Body_UV, Levels, EXHAUST, Black,
Number Plate - Don't Move, PAINT, CARBON FIBER, Nimber Plates (Don't Move), WIRE,
Skirt, DETAILS, Car Stickers copy, Group 2, Numplate Position, WireEVO, chrome,
lines, Background copy, T Cam, Number Plate(Don't Move), Numberplates(Don't Move),
Decals, Sponsors, Door Hinges, Class Icons, Car Icons, Class icon, Car Icon.

Note: the classification table in §5.3 must handle the misspellings above
("Maks", "Nimber", "Dsiplay").
