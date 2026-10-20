/* LegacyScape 667 wiki feature viewer.
   Uses the SAME SimpleOffset CRS, tiles and coordinate conversion as Void.
   The wiki sends the OSRS module's GeoJSON via a safe postMessage bridge;
   legacy direct links may still include ?geojson=... . */
'use strict';

const params = new URLSearchParams(window.location.search);
const embed = params.get('embed') === '1';
if (embed) document.body.classList.add('embed');
const zoomMin = 4;
const zoomMax = 11;
const tileSize = 256;
const numTiles = 256;
const bounds = [
    [-tileSize * numTiles / 4, -tileSize * numTiles / 2],
    [tileSize * numTiles, tileSize * numTiles]
];

function intParam(name, fallback, min = -100000, max = 100000) {
    const source = params.get(name);
    if (source === null || !/^-?\d+$/.test(source)) return fallback;
    const n = Number(source);
    return Number.isSafeInteger(n) && n >= min && n <= max ? n : fallback;
}

let plane = intParam('centreZ', 0, 0, 3);
const initialZoom = intParam('zoom', 8, zoomMin, zoomMax);
const centreX = intParam('centreX', 3233);
const centreY = intParam('centreY', 3222);

L.CRS.LegacyOffset = L.extend({}, L.CRS.Simple, {
    offsetZoom: 8,
    scale: function (zoom) { return Math.pow(2, zoom - this.offsetZoom); },
    zoom: function (scale) { return Math.log(scale) / Math.LN2 + this.offsetZoom; }
});

const map = L.map('map', {
    crs: L.CRS.LegacyOffset,
    maxBounds: bounds,
    center: [tileSize * 50, tileSize * 50],
    minZoom: zoomMin,
    maxZoom: zoomMax,
    zoom: 8,
    zoomControl: true,
    zoomSnap: 1,
    zoomDelta: 1,
    preferCanvas: true
});

function gameToLatLng(x, y) {
    // Position.toLatLng from your original Void map: one game tile = 4 CRS
    // units at zoom 8; max zoom 11 stores 32 model pixels per game tile.
    return map.unproject(L.point(x * 32, -(y - 64) * 32), zoomMax);
}

function latLngToGame(latlng) {
    return {
        x: Math.floor(latlng.lng / 4),
        y: Math.floor(latlng.lat / 4) + 64
    };
}

const tiles = window.createLegacy667TileLayer(L, {
    getPlane: () => plane,
    baseUrls: [new URL('tiles/legacy667/', window.location.href).href,
        'https://cdn.jsdelivr.net/gh/MrSlayerGod/worldmap@map-wiki-667-v2/tiles/legacy667/'],
    options: { bounds }
}).addTo(map);

// The imported 667 cache does not provide these image tiles yet. This deliberately
// uses the existing 2D atlas tiles; it does NOT imply they match custom 667 areas.
map.setView(gameToLatLng(centreX + 0.5, centreY + 0.5), initialZoom, { animate: false });
const coordsBox = document.getElementById('coordinates');
const statusBox = document.getElementById('status');
const note = document.getElementById('map-note');
const featureLayer = L.layerGroup().addTo(map);
const atlasLink = document.getElementById('atlas-link');

function updateAtlasLink() {
    const game = latLngToGame(map.getCenter());
    const query = new URLSearchParams({
        centreX: String(game.x), centreY: String(game.y),
        centreZ: String(plane), zoom: String(Math.round(map.getZoom()))
    });
    atlasLink.href = './?' + query.toString();
}


function noteMessage(message) {
    note.hidden = !message;
    note.textContent = message || '';
}
function tidyString(value) {
    if (value === undefined || value === null) return '';
    const text = String(value);
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    return (parsed.body.textContent || '').trim().slice(0, 1200);
}
function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}
function color(value, fallback) {
    const s = String(value || '');
    return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s) ? s : fallback;
}
function pinColor(icon) {
    const s = String(icon || '').toLowerCase();
    if (s.includes('red')) return '#ef766c';
    if (s.includes('green')) return '#5bc996';
    if (s.includes('yellow')) return '#e9c977';
    if (s.includes('blue')) return '#72b5ee';
    if (s.includes('purple')) return '#ae92e6';
    return '#eab96d';
}

function makePopup(props, coords) {
    const box = document.createElement('div');
    box.className = 'wiki-feature-popup';
    const heading = document.createElement('h3');
    heading.textContent = tidyString(props.title) || 'LegacyScape map feature';
    box.appendChild(heading);
    const desc = tidyString(props.description);
    if (desc) {
        const body = document.createElement('p');
        body.textContent = desc;
        box.appendChild(body);
    }
    const loc = document.createElement('small');
    loc.textContent = `${Math.floor(coords[0])}, ${Math.floor(coords[1])} (floor ${plane})`;
    box.appendChild(loc);
    return box;
}
function toPoint(value) {
    if (!Array.isArray(value) || value.length < 2) return null;
    const x = Number(value[0]), y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? gameToLatLng(x, y) : null;
}
function toPoints(arr) {
    return (Array.isArray(arr) ? arr : []).map(toPoint).filter(Boolean);
}
function toRings(arr) {
    return (Array.isArray(arr) ? arr : []).map(toPoints).filter((ring) => ring.length >= 3);
}
function makeStyle(props) {
    return {
        color: color(props.stroke, '#e8c27f'),
        weight: Math.min(15, Math.max(0, num(props['stroke-width'], 2))),
        opacity: Math.min(1, Math.max(0, num(props['stroke-opacity'], 1))),
        fillColor: color(props.fill, '#dbb072'),
        fillOpacity: Math.min(1, Math.max(0, num(props['fill-opacity'], 0.23)))
    };
}

let collection = { type: 'FeatureCollection', features: [] };
try {
    if (params.has('geojson')) {
        if ((params.get('geojson') || '').length > 30000) {
            throw new Error('Map feature data is too large.');
        }
        const decoded = JSON.parse(params.get('geojson'));
        if (!decoded || decoded.type !== 'FeatureCollection' || !Array.isArray(decoded.features)) {
            throw new Error('Expected a GeoJSON FeatureCollection.');
        }
        collection = decoded;
    }
} catch (err) {
    noteMessage('The wiki map features could not be loaded: ' + err.message);
}

if (intParam('mapID', 0) !== 0) {
    noteMessage('This mapID is not supported by the current LegacyScape surface tiles.');
}

function renderFeatures() {
    featureLayer.clearLayers();
    let count = 0;
    for (const f of collection.features.slice(0, 400)) {
        if (!f || f.type !== 'Feature' || !f.geometry) continue;
        const props = f.properties || {};
        if (num(props.plane, plane) !== plane) continue;
        if (num(props.mapID, 0) !== 0) continue;
        const geo = f.geometry;
        const style = makeStyle(props);
        let layer = null;
        let examplePoint = null;

        if (geo.type === 'Point') {
            examplePoint = geo.coordinates;
            const latlng = toPoint(geo.coordinates);
            if (!latlng) continue;
            if (props.shape === 'Circle') {
                layer = L.circle(latlng, { ...style, radius: Math.min(20000, Math.max(0, num(props.radius, 10))) * 4 });
            } else if (props.shape === 'Dot') {
                layer = L.circleMarker(latlng, { radius: 5, color: '#fff', weight: 1.5, fillColor: color(props.fill, '#ffffff'), fillOpacity: 1 });
            } else if (props.shape === 'Text') {
                const text = tidyString(props.label).slice(0, 90);
                const icon = L.divIcon({
                    className: 'wiki-map-icon',
                    html: '<span class="wiki-label"></span>',
                    iconSize: [0, 0], iconAnchor: [0, 0]
                });
                layer = L.marker(latlng, { icon: icon, interactive: true });
                layer.on('add', function () {
                    const el = this.getElement();
                    if (el) {
                        const label = el.querySelector('.wiki-label');
                        if (label) label.textContent = text;
                    }
                });
            } else {
                const colour = pinColor(props.icon);
                const icon = L.divIcon({
                    className: 'wiki-map-icon',
                    html: '<span class="wiki-pin" style="--pin:' + colour + '"></span>',
                    iconSize: [20, 26], iconAnchor: [10, 26], popupAnchor: [0, -20]
                });
                layer = L.marker(latlng, { icon: icon });
            }
        } else if (geo.type === 'LineString') {
            const points = toPoints(geo.coordinates);
            if (points.length < 2) continue;
            layer = L.polyline(points, style);
            examplePoint = geo.coordinates[0];
        } else if (geo.type === 'Polygon') {
            const rings = toRings(geo.coordinates);
            if (!rings.length) continue;
            layer = L.polygon(rings, style);
            examplePoint = geo.coordinates[0][0];
        } else if (geo.type === 'MultiPolygon') {
            const polygons = (Array.isArray(geo.coordinates) ? geo.coordinates : []).map(toRings).filter((v) => v.length);
            if (!polygons.length) continue;
            layer = L.polygon(polygons, style);
            examplePoint = geo.coordinates[0][0][0];
        }

        if (layer) {
            if (props.title || props.description) layer.bindPopup(makePopup(props, examplePoint || [centreX, centreY]));
            layer.addTo(featureLayer);
            count++;
        }
    }
    statusBox.textContent = count + ' map features';
}

function setFloor(floor) {
    if (!Number.isInteger(floor) || floor < 0 || floor > 3) return;
    plane = floor;
    tiles.redraw();
    renderFeatures();
    document.querySelectorAll('[data-floor]').forEach(function (button) {
        const active = Number(button.dataset.floor) === plane;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    const url = new URL(window.location.href);
    url.searchParams.set('centreZ', String(plane));
    window.history.replaceState(null, '', url.toString());
    updateAtlasLink();
}

document.querySelectorAll('[data-floor]').forEach(function (button) {
    button.addEventListener('click', function () { setFloor(Number(this.dataset.floor)); });
});
map.on('mousemove moveend zoomend', function (event) {
    const pos = latLngToGame(event.latlng || map.getCenter());
    coordsBox.textContent = pos.x + ', ' + pos.y + ', ' + plane;
});
map.on('moveend', function () {
    const pos = latLngToGame(map.getCenter());
    const url = new URL(window.location.href);
    url.searchParams.set('centreX', pos.x);
    url.searchParams.set('centreY', pos.y);
    url.searchParams.set('centreZ', plane);
    url.searchParams.set('zoom', Math.round(map.getZoom()));
    window.history.replaceState(null, '', url.toString());
    updateAtlasLink();
});
map.on('zoomend', function () {
    if (!Number.isInteger(map.getZoom())) map.setZoom(Math.round(map.getZoom()), { animate: false });
});
setFloor(plane);
updateAtlasLink();
coordsBox.textContent = centreX + ', ' + centreY + ', ' + plane;

// Embedded Miraheze map bridge: accept features only from our wiki.
// Avoid huge URLs (and literal HTML anchors showing in wiki tables).
const allowedWikiOrigins = new Set([
    'https://legacyscape667.miraheze.org',
    'https://mrslayergod.github.io'
]);
window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !allowedWikiOrigins.has(event.origin)) return;
    const payload = event.data;
    if (!payload || payload.type !== 'legacyscape-map-features') return;
    try {
        const data = payload.collection;
        if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 500) {
            throw new Error('Invalid GeoJSON FeatureCollection');
        }
        collection = data;
        renderFeatures();
        window.parent.postMessage({ type: 'legacyscape-map-rendered' }, event.origin);
    } catch (error) {
        window.parent.postMessage({ type: 'legacyscape-map-error' }, event.origin);
        noteMessage('The wiki map could not be loaded: ' + error.message);
    }
});
if (window.parent !== window) {
    window.parent.postMessage({ type: 'legacyscape-map-ready' }, '*');
}
