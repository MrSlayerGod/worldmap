# LegacyScape 667 — World Atlas

A modern responsive UI for your existing Void world-map viewer. **This modifies the uploaded Void project; it is not a standalone imitation of the RuneScape world map.**

## Included

- Modern dark explorer layout with warm gold highlights
- Search among 504 locations already in `resources/locations.json`
- Quick-travel buttons for Lumbridge, Varrock, Falador, Edgeville, Grand Exchange and Al Kharid
- Map floor selector (0–3), zoom, and Lumbridge return
- Location labels, region grid, and region-number toggle (delegating to Void's existing overlays)
- Go-to X/Y/Z, map status HUD, coordinate and region readout
- Copyable URLs which retain Void/LegacyScape `marker` and `markers` query parameters
- Shareable selected locations, e.g. `?selection=3211,3450,0&place=Varrock`
- Developer tools drawer preserving Void's area/path/polygon editor, export settings and code output
- Narrow/mobile layout with slide-out explorer panel
- Original `js/model`, Void controls, location dataset and tile-generation conventions retained

## How to publish (GitHub Pages)

1. Back up your live map repository.
2. Replace the site files in your map repository with the contents of **this folder**. Keep its directory structure (`index.html`, `css/`, `js/`, `resources/`, etc.).
3. Commit the changes to the branch used by GitHub Pages.
4. Open your map site and hard-refresh (`Ctrl+F5`).
5. Test map navigation, place search, floor changes, label/grid toggles, and the drawing editor.

You can host under `https://mrslayergod.github.io/void-map/` without changing its URL. The wiki's existing map links should continue to open the map because the previous URL syntax has been retained.

## Local development

Because the application uses JavaScript ES modules and loads JSON via AJAX, **don't launch `index.html` as a `file://` URL**. From inside this project, use a local static server:

```bash
python -m http.server 8000
```

Then browse to `http://localhost:8000/`.

## Existing URL formats (preserved)

```text
?centreX=3222&centreY=3218&centreZ=0&zoom=8
?centreX=3222&centreY=3218&centreZ=0&zoom=8&marker=3222,3218,0
?centreX=3222&centreY=3218&centreZ=0&zoom=8&markers=3222,3218,0%7C3210,3211,0
```

An additional `selection=x,y,z&place=Name` pair is used only for a currently selected destination. It does not replace wiki pins or damage pre-existing marker parameters.

## Wiki embedding

This is **the standalone map site**, not MediaWiki's `Common.js` / `Common.css`. Your Lua `Module:Map` links and the embedded map integration are separate. No Miraheze pages were edited.

## Important: map tile source

The map still loads GregHib's Void tiles from `https://raw.githubusercontent.com/GregHib/void-map-tiles/master/...` in `js/map.js`. **These have NOT been replaced by verified 667 cache-generated tiles.** If you later produce 667 tiles, switch the `CustomTileLayer.getTileUrl` path in that file to your hosted generated tiles.

Your existing `resources/locations.json` is also the existing Void dataset. Any map locations that differ on your own 667 server must be updated separately.

## What changed

- `index.html`: completely redesigned app shell, retaining required original libraries and editor panels
- `css/main.css`: new responsive atlas styling
- `js/map.js`: preserved previous multi-marker and floor logic; wired to the modern UI
- `js/ui/modern_ui.js`: search, navigation, editor drawer, overlays, mobile controls, share URLs
- `README.md`: updated deployment documentation

No build system is needed.

## Validation

Both new/modified JS modules passed Node syntax checks. Internal script imports, HTML ids referenced from the UI code, and the location JSON were checked. Automated Chromium navigation was blocked by the test environment, so full rendered browser QA and live remote tile availability were **not** verified. Test the published site in your browser before making it your production map.
