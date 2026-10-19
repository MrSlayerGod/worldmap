# Wiki map repair

The current atlas is https://mrslayergod.github.io/worldmap/ .
The wiki renders its small maps directly using Leaflet and links to this atlas.
It does not need the obsolete wiki-map.html viewer or iframe permissions.

## Install

1. Deploy this repository change through GitHub Pages.
2. Replace MediaWiki:Common.js on the wiki with the contents of wiki/Common.js.
3. Save and hard refresh the Pottery wheel page (Ctrl+F5).
4. Check that East Ardougne, Crafting Guild and Barbarian Village show tiles and pins.
5. Open each full-map link and confirm it opens /worldmap/ at the same location.

## Cause

Miraheze's image Content Security Policy permits cdn.jsdelivr.net but blocks
raw.githubusercontent.com. The wiki script previously used the blocked host.
Both the atlas and wiki now request the existing image tiles through jsDelivr.
This changes delivery only; this repository does not contain replacement 667
map tile exports. The underlying tile dataset remains GregHib/void-map-tiles.

The Common.js snapshot preserves the existing feature rendering, atlas URL,
infobox charge switcher and quest checklist code. Only the blocked tile URL
was replaced. It must be installed on the wiki separately from GitHub Pages.