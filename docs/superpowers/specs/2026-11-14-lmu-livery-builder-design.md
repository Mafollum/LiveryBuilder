# LMU Livery Builder — Design

Date: 2026-11-14 (revised 2026-11-15: "panels only" simplification)
Status: revised, awaiting approval

## 1. Intent

The user makes custom liveries for Le Mans Ultimate (LMU). Today that means
opening the official Photoshop template for a car in GIMP or Photoshop,
painting on top of it, exporting two TGA files by hand and checking the result
in the game's showroom. They want a purpose-built program that is **as simple
to use as possible**: pick a car, see **only the car's panels, plain white with
an outline**, put their own images, brush strokes and simple shapes on top,
and send the result to the game.

The "see the car in 3D and rotate it" requirement is met by LMU's own showroom:
the program writes the livery files straight into the game folder and the user
presses **RELOAD** in the showroom. (Decision made by the user, see
§4 Approaches.)

The user said explicitly that they don't care about wireframes or technical
choices. The UI uses plain words only: no "UV", "region", "levels", "mask",
"layer blend mode" and so on.

## 2. Goals, non-goals, anti-goals

**Goals**
- A small Windows program the user unzips and runs (no installer).
- Finds the LMU install by itself and offers every car that has a template in
  the game's `Support\LiveryTemplates` folder (60 today).
- The canvas shows only the car's panels: plain white shapes with a thin dark
  outline on a light grey background. Nothing else from the template is shown.
- The user can add their own images, paint with a brush, add simple adjustable
  shapes and text, and move, resize, rotate, flip, duplicate and delete them.
- One button ("Send to game") writes `customskin.tga` and
  `customskin_region.tga` into the game's `UserData\Liveries` folder, ready for
  RELOAD in the showroom.
- The material file (`customskin_region.tga`) is generated automatically from
  a simple "Finish" choice on each item. The user never paints it by hand.
- Save a project and reopen it later to keep editing.

**Non-goals**
- A 3D view inside the program.
- Getting 3D car models out of the game.
- Showing or exporting anything from the template other than the panel
  shapes: no template stickers, number plates, carbon parts or wireframe.
- Photoshop-class features: selections, filters, gradients, blend modes,
  masks, PSD export.
- Uploading or sharing liveries (Livery Hub, RaceControl).
- Storing LMU templates in this repository (game files, ~4 GB).
- macOS/Linux builds, an installer, auto-update, code signing.

**Anti-goals** (failure even if it "works")
- A livery that looks right in the program but wrong in the game: flipped,
  misaligned, black car, compressed TGA.
- Silently overwriting a livery the user already has in the game folder.
- Needing an account, server or internet connection to use it.
- A cluttered or technical UI. If a control isn't needed for "put stuff on the
  panels and send it to the game", it isn't there.
- Feeling laggy at 4096×4096 on a normal gaming PC.

## 3. Constraints (verified facts)

**Templates** (checked on the user's copy of all 60 files):
- All are 4096×4096, RGB, 8-bit PSD. Sizes range from 20 MB to 455 MB
  (Toyota GR010).
- File names: `Template_<CLASS>_<Car>[_<variant>].psd`, with CLASS one of
  GT3, GTE, HYPER, LMP2, LMP3 (for example `Template_GT3_Ferrari296LMGT3_2025_ELMS.psd`).
  One name contains a stray space (`…_2025 _ELMS.psd`).
- **Panel shapes, source 1: the mask layer.** 56 of 60 templates have a
  top-level "mask" layer (`Mask(Disable for export)`, `Maks(…)`,
  `Mask - Disable for export`, `Mask(Disable For Export)` …, see Appendix A).
  In every one it is a pixel layer with a layer mask. Its effective coverage
  (pixel alpha × layer-mask value) is opaque **off** the car and transparent
  **on** the car. Off-car share is 24–49%. One template (`LMP3_ADESS_AD25`)
  saves the mask layer hidden; it is used anyway.
- **Panel shapes, source 2: the mesh lines.** The other four
  (`GTE_Ferrari488`, `HYPER_AstonMartinValkyrie`, `HYPER_GenesisGMR001`,
  `LMP3_Ligier_JSP325`) have no mask layer, but they do have a wireframe layer
  (`Wireframe`, `Wire`, `UVW`, …). A prototype got clean panels from it: take
  line pixels (alpha > 32 and luminance > 40, which also works when the layer
  has an opaque black background), thicken them by 2 px, treat every area
  enclosed by lines and not connected to the texture border as panel, then
  remove specks with a 3 px morphological opening. Panel share came out at
  56–74%. Reference images: §7.
- **Levels must be applied on export.** The official guide says to "make sure
  the Levels layer is visible" before exporting. 57 of 60 templates have
  exactly one top-level Levels adjustment layer. It compresses only the master
  channel's output range (for example output 10–210, 10–225, 0–190, gamma 1.0),
  so that in the game white is never pure white. It is applied even where the
  PSD saved it hidden. The other three (`HYPER_LamborghiniSC63`,
  `HYPER_Peugeot9x8_2024`, `HYPER_Peugeot9x8_2026`) have no top-level Levels,
  so nothing is applied. Levels nested inside groups is ignored.
- Reading templates with `ag-psd` (v34) in Node works with a minimal
  `initializeCanvas` shim that provides `createImageData`. With `useRawData`,
  layer pixels are decoded only on request (`getLayerImageData`,
  `getLayerMaskImageData`). Only the mask (or wireframe) layer and the Levels
  settings need to be decoded, so even the 455 MB files stay cheap.

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
- Browsers can't write there (Chromium's File System Access blocklist covers
  `Program Files (x86)`, with paths normalised first), so the user chose a
  **Windows desktop program**.
- Steam normally makes its own folder writable for ordinary users. The user
  already copies livery files there by hand. Whether the write succeeds is
  still checked at runtime (see 5.7).
- The repository is private. The build must reach the user without a public
  host (see 5.1).

## 4. Approaches considered

1. **Flat editor + in-game showroom as the 3D view** (chosen by the user).
   The program edits the 2D texture and writes the two files into the game
   folder, and the user presses RELOAD. The 3D view is exact because it is the
   game itself. The trade-off is that the rotating car is in the game window,
   not in the program.
   - Delivery, also the user's choice: a **Windows desktop program**. The
     alternatives were a single HTML file opened in Chrome/Edge (ruled out
     because Chromium blocks writing under `Program Files (x86)`) and moving
     the game to another Steam library (the user preferred not to).
   - What the canvas shows, also the user's choice: **panels only**, plain
     white with an outline. Reproducing the full Photoshop template (stickers,
     number plates, carbon, effects, blend modes) was planned at first and
     dropped at the user's request.
2. **3D view inside the program using per-car 3D models.** Rejected: no 3D
   models matching LMU's texture layouts exist publicly. Making them would take
   hours of 3D work per car and would likely still be slightly off.
3. **Extract the car models from the game files.** Rejected: the files are
   encrypted, and extracting them breaks the game's terms.

## 5. Design

### 5.1 Running the program
- **Electron** desktop program, Windows x64 (builder's choice, recorded as a
  decision). The editor is a web UI in Electron's renderer. All file access
  goes through the main process with Node `fs`, exposed to the UI by a small
  preload/IPC API.
- Delivered as a **portable zip** (`LiveryBuilder-win-x64.zip`, ~100 MB): the
  user unzips anywhere and runs `LiveryBuilder.exe`. It's unsigned, so Windows
  SmartScreen warns on first run ("More info → Run anyway"). The README says
  this.
- No network access at runtime.
- Getting the zip to the user, in order of preference:
  1. A GitHub Actions workflow on a `windows-latest` runner builds the zip,
     starts the built `.exe` once as a smoke test, and publishes the zip as a
     workflow artifact. The user downloads it from the repo's Actions tab.
  2. If the session can't push workflow files, build the Windows zip on Linux
     (zip target, no exe resource editing, so no wine) and agree another way
     to hand it over with the user.
- Settings (LMU folder, recent projects) are stored as JSON in the program's
  user data folder (`%APPDATA%\LiveryBuilder`).

### 5.2 Picking a car
- On start, the program looks for LMU by itself. It checks
  `C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate`, then every
  Steam library listed in `C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf`.
  If it doesn't find LMU, it asks the user to choose the LMU folder (native
  folder dialog), and remembers it.
- The start screen lists the cars grouped by class (Hypercar, LMP2, LMP3, GT3,
  GTE) with readable names taken from the file names, for example
  "Ferrari 296 LMGT3 — 2025 ELMS". The program builds these names
  automatically: `Template_` and the class are removed, camel case is split
  into words, and season/series suffixes go after a dash. Underneath are
  "Open project…" and the recent projects.
- Picking a car opens the editor with that car's panels. The panel shape is
  computed once per template (5.3) and cached in the user data folder, keyed
  by file name, size and modification time, so the second time it opens
  instantly.

### 5.3 Getting the panel shape from a template
Output: a 4096×4096 one-bit "panel" map (true = on the car), plus the
template's Levels settings.
1. If a top-level layer's name matches the mask patterns (case-insensitive
   contains `disable for export`, or starts with `mask`/`maks`): panel =
   effective coverage < 128, where coverage = layer pixel alpha × layer-mask
   value / 255 (outside the layer-mask rectangle, use its default colour). The
   layer's hidden flag is ignored.
2. Otherwise, use the first top-level layer whose name contains `wire`, `uvw`
   or `_uv`, and apply the mesh-line method from §3.
3. If neither exists, the whole texture counts as panel, and the user sees a
   one-line note: "This car's template has no panel outlines".
4. Levels: the first top-level layer with a Levels adjustment. Its
   per-channel settings (shadow/highlight input, shadow/highlight output,
   midtone) are kept for export. It's applied whether hidden or not.
5. No other layer is decoded.

### 5.4 The editor screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Cars   Ferrari 296 LMGT3 — 2025        ↶ ↷   Save   [ Send to game ]   │
├────────┬───────────────────────────────────────────────┬─────────────────┤
│ Select │                                               │ Selected item   │
│ Brush  │   light grey background, white panels         │  Colour ■       │
│ Eraser │   with a thin dark outline; your stuff on top │  Size / Opacity │
│ Rect   │                                               │  Finish ▾       │
│ Circle │                                               │  Flip ⇆ ⇅  Dup  │
│ Line   │                                               ├─────────────────┤
│ Triangle│                                              │ Items (top→bot) │
│ Text   │                                               │  👁 Logo        │
│ Image  │                                               │  👁 Stripe      │
│        │   Car colour ■ (white)                        │  👁 Brush 1     │
└────────┴───────────────────────────────────────────────┴─────────────────┘
```

- **Canvas:** light grey background (off-car), white panels, a thin dark
  outline drawn on top of everything at a constant screen thickness (about
  1 px), so the panel edges are always visible, even over the user's artwork.
  Anything placed outside the panels is still drawn, but under a
  semi-transparent grey veil, so it's obvious it won't be on the car.
- **Car colour:** one colour picker, default white, that recolours all panels
  (the base paint of the car).
- **View:** starts fitted to the window. Mouse wheel zooms around the cursor,
  and Space+drag or middle mouse pans. A "Fit" button resets.
- **Items list:** every image, shape, text and brush layer is one item. Drag
  to reorder; eye icon to hide; double-click to rename; delete via button or
  the Delete key. New items go on top.

### 5.5 Tools
- **Select:** click to select; drag to move; corner handles scale (Shift keeps
  proportions); rotate handle; arrow keys nudge (Shift = 10×); Delete removes.
- **Flip horizontal / Flip vertical / Duplicate** buttons for the selected
  item. Duplicate + flip is how the user puts the same design on the other
  side of the car.
- **Images:** "Image" button or drag-and-drop of PNG, JPG, WebP or SVG.
  Transparency is kept. Images are stored at their original resolution, and
  SVGs are rasterised at up to 4096 px on their longest side. A new image is
  placed in the middle of the visible area, scaled down to fit if larger.
- **Shapes:** rectangle (with corner radius), circle/ellipse, line/stripe
  (thickness), triangle. Created by dragging. Properties: fill colour, outline
  colour, outline width, opacity. Size and rotation via handles. Everything
  stays editable.
- **Brush / Eraser:** colour, size, opacity, softness. Painting a stroke
  creates a new brush item if the selected item isn't a brush item, otherwise
  it paints onto the selected brush item. The eraser erases only within the
  selected brush item.
- **Text:** type into a box. Font from a short list of standard Windows fonts
  (Arial, Arial Black, Bahnschrift, Calibri, Consolas, Impact, Segoe UI, Tahoma,
  Times New Roman, Verdana), size, colour, bold/italic, optional outline.
  Editable after creation.
- **Colour picker:** colour square with hex input and the last 8 colours used.
- **Undo/redo:** Ctrl+Z / Ctrl+Y and toolbar buttons, at least 50 steps,
  covering every change including brush strokes.

### 5.6 Finish (material)
- Every item has a **Finish** dropdown with five choices, each with its colour
  swatch: "Paint" (black), "Carbon" (red), "Special 1" (green), "Special 2"
  (blue), "Sticker" (white). A one-line hint: "You choose what each finish
  looks like in the game's showroom."
- Defaults: images and text → Sticker; shapes and brush → Paint. The panels
  themselves (car colour) → Paint.

### 5.7 Send to game
- **Send to game** button and Ctrl+Enter write to
  `<LMU folder>\UserData\Liveries`, creating the folder if missing.
- The first time per program session, if `customskin.tga` already exists
  there, the program asks: "There's already a livery in the game folder.
  Replace it? [Keep a backup and replace] [Replace] [Cancel]". The backup is
  `customskin_backup_<YYYYMMDD-HHMMSS>.tga` plus the region equivalent.
- Each file is written to a temporary name in the same folder and then
  renamed over the target. Afterwards the program shows "Sent! Press RELOAD in
  the showroom."
- If Windows refuses the write, the program says "Couldn't write to the game
  folder" plus the reason in plain words, and offers **Save the two files
  somewhere else…**.
- **Paint file:** fill the whole 4096×4096 with the car colour, so panel edges
  don't bleed dark in the game. Draw the visible items bottom to top at full
  resolution. Apply the template's Levels to every pixel. Force alpha to 255.
  Write the TGA with the exact header from §3, bottom-left origin.
- **Region file:** start all black (car colour = Paint). For each visible item
  bottom to top, set every pixel where the item is at least 50% opaque to the
  item's finish colour. Pure colours only.
- Writing is manual, not on every change. Each send writes 2 × 64 MB.

### 5.8 Saving and reopening
- **Save / Save as / Open** with native dialogs. Default folder:
  `Documents\LMU Livery Builder`. The project file (`*.lmulivery`) is a zip of
  `project.json` (car template file name, car colour, items with all their
  properties) plus the imported images and brush items as PNG.
- **Autosave** to the user data folder every 60 s while there are unsaved
  changes, and on close. The start screen offers to restore after a crash.
- Closing with unsaved changes asks "Save changes?".
- Reopening loads the panel shape from the remembered LMU folder. If the
  template is missing (for example renamed by a game update), the program says
  which car it needs and lets the user pick another template file.

### 5.9 Performance targets
- Moving, scaling and painting feel smooth on a typical gaming PC, fitted and
  zoomed in.
- Opening a car the first time takes a few seconds at most (largest template
  included), with a progress message. After that it's instant (cache).
- Send to game finishes in a few seconds.

## 6. Left to the builder
- UI framework, canvas/rendering library, Electron packaging tool, where
  template reading runs (main process or worker).
- How brush items are stored (raster or stroke vectors), provided undo, the
  project file and full-resolution export all work.
- Exact styling (plain, light, uncluttered), icons, and keyboard shortcuts
  beyond those named.

## 7. Verification
- **Panel extraction**, against the real templates in the development session
  (`/home/user/lmu-data/tpl/LiveryTemplates/`, never committed):
  - all 60 load without error, with panel share between 20% and 85%;
  - for mask templates, the result matches a reference computed independently
    with `psd-tools` to within 0.5% of pixels for at least 3 templates;
  - visual check of a contact sheet of all 60 panel maps (prototype of this
    look: Ferrari 296 LMGT3 2025, Porsche 963 2025, Valkyrie from mesh lines).
- **Readable car names:** a unit test over all 60 file names.
- **LMU folder detection:** unit tests with fake folder trees and a sample
  `libraryfolders.vdf`.
- **File format:** the exported TGAs have byte-identical headers to the user's
  working example (`/home/user/lmu-data/ex/example livery/`), the correct
  orientation (top of the canvas = top of the image), Levels applied, and
  region colours pure.
- **UI flows:** automated end-to-end test driving the Electron app (Playwright):
  pick a car, add each item type, change finish, undo/redo, save and reopen a
  project, send to game into a temporary folder, then check the two files.
- **Windows:** the built `.exe` starts on a real Windows runner (CI smoke
  test), followed by the user's first run.
- **In the game (user):** a test livery (a stripe across a door, a logo, one
  finish change) appears correctly after RELOAD.

## 8. Calls made without the user (for review)
1. Text tool included, although only images, brush and shapes were asked for.
2. Default finishes: images/text → Sticker, shapes/brush → Paint.
3. "Car colour" picker for the base colour of the panels (default white).
4. Things placed outside the panels are shown faded under a grey veil rather
   than hidden.
5. Shapes are rectangle, circle/ellipse, line/stripe, triangle (no free polygon).
6. Template carbon parts, stickers and number-plate boxes are not kept: the
   whole car starts as plain paint in the car colour.
7. Electron for the Windows program, delivered as a portable zip.
8. Manual "Send to game" button; backup offered before the first overwrite.

## Appendix A — observed top-level layer names (count across 60 templates)

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
