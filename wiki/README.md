# Wiki installation — 667 integration v2

The atlas and this package use the owner's 667 cache, rendered with facility icons enabled.
The old final-667 export had map.icons=false. The corrected export is
D:/void-634/images/final-667-with-icons. Icons are baked into the PNG tiles.
There are 6,188 native tiles at zooms 4-8 and 504 labels; zooms 9-11 enlarge native tiles.

## Install in this order

1. Upload the PNGs from assets/ on Special:Upload using the exact filenames.
2. Replace Module:Map with Module_Map.lua.
3. Replace Template:Map with Template_Map.wikitext.
4. Replace Module:LocLine with Module_LocLine.lua.
5. Replace Module:Infobox Scenery with Module_Infobox_Scenery.lua.
6. Replace MediaWiki:Common.js with Common.js. It preserves the existing quest checklist and charge switcher and adds proper version switching.
7. Append Common-map.css to MediaWiki:Common.css. Do not replace the full stylesheet.
8. Replace Pottery wheel with Pottery_wheel.wikitext, then hard refresh and purge its cache if needed.

Interface-administrator rights are required for the protected JavaScript/CSS pages.
GitHub Pages deployment does not perform these wiki edits. The connected browser
currently reports no permission to edit MediaWiki:Common.js.

## Behavior

Location rows show compact Show map buttons. They create a Leaflet map only when
opened and retain all pins and an Open full map link. Maps can be closed, reopened,
and resized. Known unexported regions are transparent; failed downloads are retried
and expose a Retry action after persistent failure. Unsupported mapIDs display a
message rather than the wrong surface map. Only mapID=0 is exported.

The atlas loads its own tiles first. Wiki maps use the Miraheze-permitted jsDelivr
host. Support scripts and corrected tiles are pinned to the map-wiki-667-v2 tag.
No iframe or GitHub Pages CSP exception is required. The obsolete wiki-map.html
viewer remains compatible but is not used by the wiki integration.

Advanced data is opt-in on scenery infoboxes: advanced=yes shows the original
object IDs/cache link. Ordinary articles end at Examine, matching the supplied
OSRS layout. Existing version tabs now switch actual infobox field contents.

The products table uses standard shaping XP: pot 6.3 (level 1), pie dish 15 (7),
bowl 18 (8), plant pot 20 (19), pot lid 20 (25). These values also occur in the
supplied local Void pottery configuration. Unfired cups were added to OSRS in June 2023 (https://oldschool.runescape.wiki/w/Unfired_cup) and were not present there,
so they are not asserted to be supported by this 667 server. Firing XP is separate.
The six pre-667 location rows preserve the coordinates previously on the wiki;
custom server spawn differences require the server's object-spawn records.
Modern OSRS-only areas and object IDs were removed from this 667 article draft.

The pottery item icons were rendered from the user's desktop 667 cache. The wheel
illustration is the existing desktop image supplied by the user; it is not the
modern OSRS Darkmeyer model. The wiki must receive these uploads to fix missing files.

## Provenance and limits

Module_Map.lua and Module_LocLine.lua adapt the existing wiki's OSRS-derived Lua,
not a claim of full OSRS extension parity. The source pages are
https://legacyscape667.miraheze.org/wiki/Module:Map and Module:LocLine, with the
OSRS originals at https://oldschool.runescape.wiki/w/Module:Map and
https://oldschool.runescape.wiki/w/Template:Map. Preserve their attribution and
applicable wiki licensing when publishing. OSRS Bucket/Kartographer extensions
are not installed on this Miraheze wiki; fromBucket explicitly explains that limit.

QA: Node tile-layer tests cover failed primary/fallback, retries, known-empty
coverage and stale-view cancellation. Lua tests exercise real parser calls for
multiple pins, legacy x/y and zooms, marker=no, and several feature shapes.
The browser preview in tests/wiki-preview.html verifies lazy maps and item images;
it is a test harness, not an automatically published wiki article.