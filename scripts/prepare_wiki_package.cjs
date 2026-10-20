// Rebuild the installable wiki sources from the live snapshots read for this repair.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../wiki');
const read = (name) => fs.readFileSync(path.join(root, 'upstream', name), 'utf8').replace(/\r\n/g, '\n');
const write = (name, text) => fs.writeFileSync(path.join(root, name), text);
let lua = read('Module_Map.txt');
lua = lua.replace('  local features, mapOpts = ParseArgs(args)', `  -- Legacy coordinate pairs and direct x/y calls share the OSRS feature parser.
  if tonumber(args[1]) and tonumber(args[2]) then
    args.x, args.y = tonumber(args[1]), tonumber(args[2])
    args[1], args[2] = nil, nil
  end
  if (args.x or args.y) and not hc(args.mtype) then args.mtype = 'pin' end
  -- Legacy templates used atlas zooms 4-11; OSRS syntax uses -3 through 3.
  if tonumber(args.zoom) and args.zoom >= 4 then args.zoom = args.zoom - 6 end
  local features, mapOpts = ParseArgs(args)
  if tostring(args.marker or ''):lower() == 'no' then features = {} end`);
lua = lua.replaceAll('https://mrslayergod.github.io/worldmap/wiki-map.html', 'https://mrslayergod.github.io/worldmap/');
const start = lua.indexOf("  if mapOpts.type == 'maplink' then", lua.indexOf('function CreateMapElement'));
const end = lua.indexOf("  local align =", start);
lua = lua.slice(0, start) + lua.slice(end);
lua = lua.replace("    :addClass('ls-osrs-map-frame')", "    :addClass('ls-osrs-map-frame')\n    :attr('data-ls-map-lazy', mapOpts.type == 'maplink' and '1' or '0')");
write('Module_Map.lua', lua);
write('Template_Map.wikitext', `<includeonly>{{#invoke:Map|map}}</includeonly><noinclude>
LegacyScape 667 cache map. Uses the OSRS-style feature syntax with the 667 dataset.

<pre>{{Map|x=2586|y=3327|plane=0|zoom=2|mtype=pin}}</pre>
<pre>{{Map|type=maplink|mtype=pin|x:2586,y:3327,icon:greenPin|x:2588,y:3327,icon:greenPin}}</pre>
<pre>{{Map|mtype=polygon|2580,3320|2590,3320|2590,3330|2580,3330}}</pre>

Default display is a map frame. type=maplink provides a Show map control.
OSRS zooms -3 through 3 are translated to atlas zooms 4 through 9.
Legacy atlas zooms 4-11 and positional x/y pairs are also accepted.
Only mapID=0 is exported; unsupported IDs display an explanatory message.
No OSRS Bucket/Kartographer extension is required. Native cache detail ends at zoom 8.
</noinclude>\n`);
let loc = read('Module_LocLine.txt');
loc = loc.replace("local embed = yesno(hc(args.embed) and args.embed or 'yes')", "local embed = yesno(hc(args.embed) and args.embed or 'no')");
write('Module_LocLine.lua', loc);
let infobox = read('Module_Infobox_Scenery.txt');
const begin = infobox.indexOf("\tret:addRow{\n\t\t{ tag = 'th', content = 'Advanced data'");
const after = infobox.indexOf("\n\tret:addVersionBasedVars", begin);
if (begin < 0 || after < 0) throw new Error('Advanced data source changed');
infobox = infobox.slice(0, begin) + "\t-- Technical fields are opt-in; preserve their definitions for administrators.\n\tif tostring(args.advanced or ''):lower() == 'yes' then\n" +
    infobox.slice(begin, after) + '\n\tend\n' + infobox.slice(after);
infobox = infobox.replace("ret:addClass('infobox-scenery')", "ret:addClass('infobox-scenery')\n\tif tostring(args.advanced or ''):lower() == 'yes' then ret:addClass('show-advanced-data') end");
write('Module_Infobox_Scenery.lua', infobox);

// Keep the pre-667 locations from the current article. Later OSRS areas are not
// evidence of RSPS spawns. Preserve the coordinate tuples already on the wiki.
const oldArticle = read('Pottery_wheel.txt');
const locations = [...oldArticle.matchAll(/\{\{ObjectLocLine\n[\s\S]*?\n\}\}/g)]
    .map((match) => match[0]).filter((row) =>
        /\[\[(East Ardougne|Crafting Guild|Barbarian Village|Rellekka|Exam Centre|Sophanem)\]\]/.test(row));
if (locations.length !== 6) throw new Error('Review the existing location rows before rebuilding.');
const products = [
    ['Unfired bowl', false, 8, '18'],
    ['Unfired pie dish', false, 7, '15'],
    ['Unfired plant pot', true, 19, '20'],
    ['Unfired pot', false, 1, '6.3'],
    ['Unfired pot lid', true, 25, '20']
];
const rows = products.map(([item, members, level, xp]) => `|-\n| [[File:${item}.png|36px|link=${item}]] 1 × [[${item}]]\n| ${members ? 'Members' : 'Free-to-play'}\n| [[Pottery wheel|Potter’s Wheel]]\n| [[Crafting]] ${level}\n| ${xp}\n| 1 × [[File:Soft clay.png|36px|link=Soft clay]] [[Soft clay]]`).join('\n');
write('Pottery_wheel.wikitext', `{{Infobox Scenery
|name = Potter's Wheel
|image = [[File:Potter's Wheel.png|250px]]
|release = [[8 May]] [[2001]]
|members = No
|quest = None
|location = [[Barbarian Village]], [[Crafting Guild]], [[Exam Centre]], [[East Ardougne]], [[Rellekka]], [[Sophanem]]
|options = Use
|examine = Used for fashioning clay items.
|map = No
|id = 4310, 14887, 20375
}}
A '''Potter's Wheel''' is used to mould [[soft clay]] into unfired pottery. With the required [[Crafting]] level, players shape the clay at a wheel, then fire it in a [[Pottery oven]].

==Locations==
{{ObjectTableHead}}
${locations.join('\n')}
{{ObjectTableBottom}}

==Products==
The table lists standard shaping experience, before any server experience multiplier. Firing the finished item is a separate action at a pottery oven.

{| class="wikitable sortable ls-pottery-products"
! Product !! Members !! Facility !! Skills !! XP !! Materials
${rows}
|}
<!-- Unfired cups and modern OSRS location variants are not included without evidence that this 667 server supports them. -->
`);
