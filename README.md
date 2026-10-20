# LegacyScape 667 World Atlas — vibe-coded interactive copy (v3)

This is a complete editable website, built from **your supplied Void map project** and the previous LegacyScape modern atlas.
It is **not** a static screenshot or a dummy mockup. The map uses Leaflet, original coordinate conversions, actual Void controls and `resources/locations.json`.

## Features
- Modern responsive explorer sidebar, searchable locations, six quick travel buttons, selectable floors 0–3.
- Coordinates lookup (X / Y / Z), shareable map URL, copy-ready map marker deep links.
- Region grid, optional region IDs, label visibility toggle.
- Full original Void Area / Polygon / Path editor, settings, code output, copy, undo and clear.
- **DOM place and region labels** anchored via Leaflet markers, replacing the drift-prone canvas text.
- Fixed duplicated AJAX location loads, original missing SweetAlert dependency for copy.

## Use
1. Extract the contents of this directory to your GitHub Pages repository root (where `index.html` lives).
2. Test locally with `python -m http.server 8000` and open http://localhost:8000/ (opening `index.html` directly as `file://` blocks JS modules).
3. Deploy through GitHub Pages and hard refresh in the browser.
4. In the right-side **TOOLS** panel, select **Area**, **Polygon** or **Path** to enable the live map drawing features.

## Map tile source
The atlas uses the owner's RSPS 667 cache export in `tiles/legacy667`. Native tiles cover zooms 4-8; higher display zooms enlarge zoom-8 tiles. Labels come from the same cache export. See `wiki/README.md` for the pinned revision and installation.

## Notes
- Upload this as a replacement website, not as a new MediaWiki `Module:Map`.
- Wiki map embeds still need the correct `MediaWiki:Common.js` and `Common.css` wiring.
- Try screenshot tests at zoom 4, 7, 8 and 11; labels should now move with map tiles rather than repaint with offsets.


## v4 Quick Travel fix

Quick Travel and search/goto coordinates use an immediate, integer-zoom
`map.setView(...)` rather than `map.flyTo(...)`. This avoids the fractional
zoom `7.960...` shown in user screenshots and prevents animated tile and
label offsets in the original Void custom offset CRS. Rapid successive
Quick Travel clicks are safe. Map dragging and regular zoom controls remain.

To verify in the browser:
1. Open the map, press Lumbridge, Grand Exchange, Falador and Varrock in succession.
2. Check that location labels stay on their map positions.
3. Check that the URL zoom is a whole number (8, 9, etc).
4. Zoom and drag manually, then use Quick Travel again; no label drift.

If GitHub Pages serves the old map after upload, clear the cached
`js/ui/modern_ui.js` and `js/map.js` (hard refresh with Ctrl+F5).


## v5: First-load progress and collapsible Explorer

- New branded Gielinor loading screen. The progress bar is driven by **real Leaflet tile events** (`tileloadstart`, `tileload`, `tileerror`, `load`). Since new requests can arrive during the load, percentages are an approximate progress indication for tiles requested to date, not total bytes downloaded.
- On startup, the overlay clears when initial tile requests settle. Users can dismiss a slow load after ~9 seconds; it always clears after ~17 seconds even if a tile host is down.
- Quick Travel, panning and floor changes show a smaller, **non-blocking** tile-loading strip whenever additional tiles are requested.
- Desktop Explorer now has a **minimize arrow** in the upper-right corner; an **Explorer** pill appears on the map when hidden. The state persists locally in the same browser.
- Mobile retains its existing menu drawer; the desktop collapse control is hidden on mobile.
- The ` / ` shortcut opens the desktop Explorer before focusing search if it was minimized.
- New files: `js/ui/loading_controller.js` and `css/atlas-enhancements.css`. To use the patch, upload **all modified files** together.

The source now uses the owner-maintained `MrSlayerGod/void-map-tiles` dataset through jsDelivr.


### Wiki integration (October 2026)

This repository is deployed to `https://mrslayergod.github.io/worldmap/`.
The wiki integration files in the accompanying package render maps directly in MediaWiki with Leaflet, and link full maps to this URL. `wiki-map.html` remains available as a standalone viewer.

## 667 map reliability and wiki integration
The current export includes facility icons (banks, shops, water and other symbols) from the same 667 cache. The renderer must use `-Dmap.icons=true` and a fresh output directory or `-Dmap.force=true`; the earlier export had icons disabled. The atlas loads same-origin tiles first and retries failed requests; unexported areas use the generated coverage index. The wiki installation package and exact steps are in `wiki/README.md`. OSRS-style parsing does not require its proprietary wiki extensions.
