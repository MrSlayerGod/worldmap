-- A small Scribunto mock exercises the installed parser, not a duplicate parser.
mw = { ext = {}, title = { getCurrentTitle = function() return {nsText='', rootText='Example', text='Pottery wheel'} end } }
function mw.clone(value)
  if type(value) ~= 'table' then return value end
  local copy = {}; for k,v in pairs(value) do copy[k] = mw.clone(v) end; return copy
end
mw.text = {}
function mw.text.trim(value) return tostring(value):match('^%s*(.-)%s*$') end
function mw.text.split(value, pattern)
  local result, first = {}, 1
  while true do
    local a,b = string.find(value, pattern, first)
    if not a then result[#result+1] = string.sub(value, first); break end
    result[#result+1] = string.sub(value, first, a-1); first = b+1
  end
  return result
end
function mw.text.gsplit(value, pattern)
  local values, i = mw.text.split(value, pattern), 0
  return function() i=i+1; return values[i] end
end
local function escape(value) return tostring(value):gsub('&','&amp;'):gsub('"','&quot;'):gsub('<','&lt;') end
function mw.text.jsonEncode(value)
  if type(value)=='string' then return '"' .. value:gsub('\\','\\\\'):gsub('"','\\"'):gsub('\n','\\n') .. '"' end
  if type(value)~='table' then return tostring(value) end
  local list = {}; if #value>0 or next(value)==nil then
    for _,v in ipairs(value) do list[#list+1]=mw.text.jsonEncode(v) end
    return '[' .. table.concat(list, ',') .. ']'
  end
  for k,v in pairs(value) do list[#list+1]=mw.text.jsonEncode(k)..':'..mw.text.jsonEncode(v) end
  return '{' .. table.concat(list, ',') .. '}'
end
mw.uri = {encode = function(value) return (value:gsub('[^%w%-_%.~]', function(c) return string.format('%%%02X', string.byte(c)) end)) end}
local Builder = {}; Builder.__index = Builder
function Builder:addClass(value) self.attrs.class=(self.attrs.class or '')..' '..value; return self end
function Builder:attr(key,value) self.attrs[key]=value; return self end
function Builder:css(key,value) self.attrs.style=(self.attrs.style or '')..key..':'..value..';'; return self end
function Builder:wikitext(value) self.children[#self.children+1]=tostring(value); return self end
function Builder:tag(name) local child=mw.html.create(name); child.parent=self; self.children[#self.children+1]=child; return child end
function Builder:done() return self.parent or self end
function Builder:__tostring()
  local attrs,children={},{}
  for k,v in pairs(self.attrs) do attrs[#attrs+1]=' '..k..'="'..escape(v)..'"' end
  for _,v in ipairs(self.children) do children[#children+1]=tostring(v) end
  return '<'..self.name..table.concat(attrs)..'>'..table.concat(children)..'</'..self.name..'>'
end
mw.html = {create=function(name) return setmetatable({name=name,attrs={},children={}},Builder) end}
local module = dofile('wiki/Module_Map.lua')
local html = module.buildMap({type='maplink',mtype='pin',[1]='x:2586,y:3327,icon:greenPin',[2]='x:2588,y:3327,icon:greenPin'})
assert(html:find('data%-ls%-map%-lazy="1"'), html)
assert(html:find('markers=2586%%2C3327%%2C0%%7C2588%%2C3327%%2C0'), html)
local pair = module.buildMap({[1]='2586',[2]='3327',zoom='9'})
assert(pair:find('data%-ls%-map%-zoom="9"'), pair)
assert(pair:find('markers=2586%%2C3327%%2C0'), pair)
local hidden = module.buildMap({x=2586,y=3327,marker='no'})
assert(not hidden:find('markers='), hidden)
for _,kind in ipairs({'pin','dot','circle','text'}) do
  local result=module.buildMap({x=2586,y=3327,mtype=kind,label='Wheel'})
  assert(result:find('FeatureCollection'), kind)
end
local poly = module.buildMap({mtype='polygon',[1]='2580,3320',[2]='2590,3320',[3]='2590,3330'})
assert(poly:find('Polygon'), poly)
print('Lua map: lazy multi-pin links, legacy coordinate pairs/zoom, marker=no and feature shapes passed.')
