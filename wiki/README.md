# LegacyScape 667 wiki integration

The atlas uses the owner-exported RSPS 667 dataset bundled under tiles/legacy667/ in
MrSlayerGod/worldmap, pinned to the tiles-667-20261020 tag.
Source: D:/void-634/images/final-667 (owner's desktop cache export).
There are 6,180 tiles at native zooms 4-8 across floors 0-3, and 504 labels.
Leaflet maxNativeZoom is 8; display zooms 9-11 enlarge those native tiles.
No old dataset is substituted for missing areas.

Install wiki/Common.js on MediaWiki:Common.js using an interface administrator
account, then hard refresh Pottery wheel. The wiki renders inline and its full
map links use https://mrslayergod.github.io/worldmap/ . It does not use the old
wiki-map.html viewer. GitHub Pages deployment does not install the wiki script.

The jsDelivr host is permitted by the wiki's image CSP; raw.githubusercontent.com
is blocked. Existing infobox charge switcher and quest checklist code is retained.