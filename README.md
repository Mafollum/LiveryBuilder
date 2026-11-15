# LMU Livery Builder

A simple livery editor for **Le Mans Ultimate**. Pick a car, put your own images,
shapes, text and brush strokes on its panels, and send the livery straight to the
game. You see it on the real car in the game's showroom.

## Getting the program

1. On GitHub, open this repository's **Actions** tab.
2. Click the latest **Build Windows** run that has a green tick.
3. At the bottom, under **Artifacts**, download **LiveryBuilder-win-x64**.
   GitHub wraps it in a zip; inside is `LiveryBuilder-win-x64.zip` (about 155 MB).
4. Unzip it anywhere you like, for example `Documents\LiveryBuilder`.
5. Double-click **LiveryBuilder.exe**.

The first time, Windows may say **"Windows protected your PC"**. That's because the
program isn't signed. Click **More info → Run anyway**.

There's nothing to install. To update, download the newest build and replace the folder.

## Making a livery

1. **Pick a car.** The program finds Le Mans Ultimate by itself (the usual Steam
   folder `C:\Program Files (x86)\Steam\steamapps\common\Le Mans Ultimate`, or any
   other Steam library). If it can't, click **Choose LMU folder…**.
2. **Add your stuff** on the white panels: **Image** (PNG, JPG, WebP, SVG; or drag
   files onto the car), **Rectangle**, **Circle**, **Line**, **Triangle**, **Text**,
   **Brush** and **Eraser**. Move, resize and rotate with **Select**. Anything outside
   the panels is shown faded, because it won't be on the car.
3. **Pick a Finish** for each item: Paint, Carbon, Special 1, Special 2 or Sticker.
   **Car colour** (bottom left) colours all the panels.
4. Click **Send to game** (or press Ctrl+Enter). The program writes
   `customskin.tga` and `customskin_region.tga` into
   `…\Le Mans Ultimate\UserData\Liveries`. Before it replaces a livery that's already
   there, it asks and can keep a backup.
5. In Le Mans Ultimate: **Team → Liveries → Apply to a New Car** → pick the same car →
   in the showroom press **RELOAD**. Then choose what each finish looks like
   (metallic, matte, chrome …) with the showroom's material settings.

**Save** (Ctrl+S) keeps your work as a `.lmulivery` project you can open again later
(Ctrl+O). Unsaved work is also saved automatically every minute.

## Shortcuts

| Keys | Does |
|---|---|
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Delete | Delete the selected item |
| Arrow keys (Shift = bigger steps) | Nudge the selected item |
| Mouse wheel | Zoom |
| Space + drag, or middle mouse | Pan |
| Ctrl+S / Ctrl+Shift+S / Ctrl+O | Save / Save as / Open |
| Ctrl+Enter | Send to game |

## Developing

Requirements: Node.js 22.

```bash
npm install
npm run dev          # run the app with hot reload
npm test             # unit tests (Vitest)
npm run build && xvfb-run -a npx playwright test   # end-to-end tests (Electron + Playwright)
npm run dist:win     # portable Windows zip in dist/
```

The LMU templates are game files and are never committed. Some tests use a local copy
at `/home/user/lmu-data/tpl/LiveryTemplates` when it exists and are skipped otherwise.

Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
