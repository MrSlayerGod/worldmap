local p = {}

local editBtn = '<small>' .. require('Module:Edit button')() .. '</small>'
local yesno = require('Module:Yesno')
local isEmpty = require('Module:Paramtest').is_empty
local hc = require('Module:Paramtest').has_content
local buildMap = require('Module:Map').buildMap

local membscol = {
    [true] = '[[File:Member icon.png|link=Members|alt=Members]]',
    [false] = '[[File:Free-to-play icon.png|link=Free-to-play|alt=Free-to-play]]',
}

function p.main(frame)
    local args = frame:getParent().args
    local templateArgs = frame.args

    -- Copy args into a new table
    local mapArgs = {}
    local coordinates = {}

    for k, v in pairs(args) do
        mapArgs[k] = v

        -- Limit coordinates to 100 entries
        if type(k) == 'number' and #coordinates < 100 then
            local cord = mw.text.trim(v)

            if cord ~= '' then
                coordinates[#coordinates + 1] = cord
            end
        end
    end

    if not hc(mapArgs.mtype) then
        mapArgs.mtype = 'pin'
    end

    if not hc(mapArgs.icon) then
        mapArgs.icon = templateArgs.icon
    end

    mapArgs.ptype = templateArgs.ptype

    -- Embedded map frame by default (rendered by Common.js), maplink when embed=no
    local embed = yesno(hc(args.embed) and args.embed or 'no')

    if embed then
        mapArgs.type = 'mapframe'
        mapArgs.align = hc(args.align) and args.align or 'none'
        mapArgs.marker = hc(args.marker) and args.marker or 'yes'
        mapArgs.width = hc(args.width) and args.width or '200px'
        mapArgs.height = hc(args.height) and args.height or '200px'
        mapArgs.title = hc(args.title) and args.title or (hc(args.location) and args.location or '')
    else
        mapArgs.type = 'maplink'
    end

    -- Location
    local loc = args.location or '? ' .. editBtn

    if isEmpty(loc) then
        loc = '? ' .. editBtn
    end

    -- Members / Free-to-play
    local membs = membscol[
        yesno(args.members ~= nil and args.members or 'no')
    ]

    -- Spawns
    local spawns = args.spawns

    if spawns == nil then
        local i = 1

        while args[i] do
            i = i + 1
        end

        spawns = i - 1
    end

    if spawns == 0 then
        spawns = '? ' .. editBtn
    end

    -- Map
    local mapping = buildMap(mapArgs)

    -- Build table row
    local locationRow = mw.html.create('tr')

    -- Location
    locationRow:tag('td')
        :wikitext(loc)
        :done()

    -- Monster levels
    if templateArgs.ptype == 'monster' then
        local levels = args.levels

        if isEmpty(levels) then
            levels = '? ' .. editBtn
        end

        locationRow:tag('td')
            :addClass(levels == 'N/A' and 'table-na' or '')
            :wikitext(levels)
            :done()
    end

    -- Members
    locationRow:tag('td')
        :wikitext(membs)
        :done()

    -- Spawns
    locationRow:tag('td')
        :wikitext(spawns)
        :done()

    -- Map cell (embedded frame or maplink)
    if embed then
        locationRow:tag('td')
            :wikitext(mapping)
            :css('min-width', '200px')
            :done()
    else
        locationRow:tag('td')
            :wikitext(mapping)
            :done()
    end

    return tostring(locationRow)
end

return p