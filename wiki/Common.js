/**
 * LegacyScape 667 Wiki — Common.js
 * Map v4: direct Leaflet rendering (OSRS Module:Map + legacy .rs-map).
 * This is a complete Common.js replacement for the code supplied in this chat:
 * it keeps the infobox charge switcher and quest checklist.
 * The wiki renders inline; the viewer URL data attribute is intentionally ignored.
 * Fixes old v2 "Unexpected map viewer URL" when the repo moved to /worldmap/.
 */
(function () {
    'use strict';

    // LegacyScape 667 World Atlas is now published at /worldmap/.
    // Embed maps directly with Leaflet: no iframe, frame-src CSP or postMessage.
    var ATLAS_BASE = 'https://mrslayergod.github.io/worldmap/';
    window.LegacyScapeWikiMapVersion = 'v5-667-lazy-retry';
    var SUPPORT_BASE = 'https://cdn.jsdelivr.net/gh/MrSlayerGod/worldmap@map-wiki-667-v2/js/';
    var supportLoading = false;
    var toggleCount = 0;
    var initializedLeaflet = false;
    var leafletLoading = false;
    var pendingLegacyMaps = [];
    var pendingModernMaps = [];
    var mapInstances = new WeakMap();

    function num(value, fallback, min, max) {
        var n = Number(value);
        return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
    }
    function gameCoords(x, y) {
        return L.latLng((y - 64) * 4, x * 4);
    }
    function featurePoint(xy) {
        if (!Array.isArray(xy) || xy.length < 2) return null;
        var x = Number(xy[0]), y = Number(xy[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return gameCoords(x, y);
    }
    function featureLine(points) {
        return (Array.isArray(points) ? points : []).map(featurePoint).filter(Boolean);
    }
    function secureColour(input, fallback) {
        return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(String(input)) ? String(input) : fallback;
    }
    function featureStyle(props) {
        return {
            color: secureColour(props.stroke, '#e4bd71'),
            weight: num(props['stroke-width'], 2, 0, 14),
            opacity: num(props['stroke-opacity'], 1, 0, 1),
            fillColor: secureColour(props.fill, '#d0a04b'),
            fillOpacity: num(props['fill-opacity'], 0.28, 0, 1)
        };
    }
    function tooltipText(value) {
        if (value === undefined || value === null) return '';
        var safeDoc = new DOMParser().parseFromString(String(value).slice(0, 3000), 'text/html');
        return (safeDoc.body.textContent || '').trim().slice(0, 750);
    }
    function featurePopup(props, xy) {
        var box = document.createElement('div');
        var heading = document.createElement('strong');
        heading.textContent = tooltipText(props.title) || 'LegacyScape map feature';
        box.appendChild(heading);
        if (props.description) {
            var description = document.createElement('p');
            description.textContent = tooltipText(props.description);
            box.appendChild(description);
        }
        if (xy && xy.length >= 2) {
            var coord = document.createElement('small');
            coord.textContent = ' (' + Math.floor(xy[0]) + ', ' + Math.floor(xy[1]) + ')';
            box.appendChild(coord);
        }
        return box;
    }
    function iconColour(name) {
        var key = String(name || '').toLowerCase();
        if (key.includes('green')) return '#54b98e';
        if (key.includes('red')) return '#df6965';
        if (key.includes('blue')) return '#6faade';
        if (key.includes('yellow')) return '#edc768';
        if (key.includes('purple')) return '#b18add';
        return '#d4ac63';
    }
    function createFeature(feature, activePlane) {
        if (!feature || feature.type !== 'Feature' || !feature.geometry) return null;
        var props = feature.properties || {};
        if (num(props.mapID, 0, -100, 100000) !== 0 || num(props.plane, 0, 0, 3) !== activePlane) return null;
        var geom = feature.geometry;
        var type = geom.type;
        var style = featureStyle(props);
        var layer = null, anchor = null;
        if (type === 'Point') {
            anchor = geom.coordinates;
            var point = featurePoint(anchor);
            if (!point) return null;
            if (props.shape === 'Circle') {
                // Simple CRS circles are expressed in game tiles, not earth metres.
                var radius = num(props.radius, 10, 0, 10000);
                var circlePts = [];
                for (var i = 0; i < 48; i++) {
                    var a = Math.PI * 2 * i / 48;
                    circlePts.push(gameCoords(Number(anchor[0]) + Math.cos(a) * radius,
                                              Number(anchor[1]) + Math.sin(a) * radius));
                }
                layer = L.polygon(circlePts, style);
            } else if (props.shape === 'Dot') {
                layer = L.circleMarker(point, {radius: 5, weight: 1, color: '#fff',
                    fillColor: secureColour(props.fill, '#fff'), fillOpacity: 1});
            } else if (props.shape === 'Text') {
                var textIcon = L.divIcon({className: 'ls-map-label-icon',
                    html: '<span class="ls-map-text-label"></span>', iconSize: [0, 0]});
                layer = L.marker(point, {icon: textIcon});
                var displayLabel = tooltipText(props.label).slice(0, 120);
                layer.on('add', function () {
                    var node = this.getElement();
                    if (node) { var label = node.querySelector('.ls-map-text-label');
                        if (label) label.textContent = displayLabel; }
                });
            } else {
                var pin = L.divIcon({className: 'ls-map-pin-icon',
                    html: '<span class="ls-map-pin" style="--ls-pin:' + iconColour(props.icon) + '"></span>',
                    iconSize: [22, 28], iconAnchor: [11, 28], popupAnchor: [0, -24]});
                layer = L.marker(point, {icon: pin});
            }
        } else if (type === 'LineString') {
            var line = featureLine(geom.coordinates);
            if (line.length < 2) return null;
            layer = L.polyline(line, style);
            anchor = geom.coordinates[0];
        } else if (type === 'Polygon') {
            var rings = (geom.coordinates || []).map(featureLine).filter(function (r) {return r.length >= 3;});
            if (!rings.length) return null;
            layer = L.polygon(rings, style);
            anchor = geom.coordinates[0][0];
        } else if (type === 'MultiPolygon') {
            var polygons = (geom.coordinates || []).map(function (p) {
                return (p || []).map(featureLine).filter(function (r) {return r.length >= 3;});
            }).filter(function (p) {return p.length;});
            if (!polygons.length) return null;
            layer = L.polygon(polygons, style);
            anchor = geom.coordinates[0][0][0];
        }
        if (layer && (props.title || props.description)) layer.bindPopup(featurePopup(props, anchor));
        return layer;
    }
    function renderOsrsMap(frame) {
        if (frame.getAttribute('data-ls-map-ready') === '1') return;
        var target = frame.querySelector('.ls-osrs-map-placeholder');
        if (!target) return;
        var height = num(frame.getAttribute('data-ls-map-height'), 300, 100, 1200);
        var x = num(frame.getAttribute('data-ls-map-x'), 3233, 0, 16000);
        var y = num(frame.getAttribute('data-ls-map-y'), 3222, 0, 16000);
        var floor = num(frame.getAttribute('data-ls-map-plane'), 0, 0, 3);
        if (num(frame.getAttribute('data-ls-map-id'), 0, -100, 100000) !== 0) {
            target.textContent = 'This map ID is not available in the 667 cache export.';
            frame.setAttribute('data-ls-map-ready', '1');
            return;
        }
        var zoom = num(frame.getAttribute('data-ls-map-zoom'), 8, 4, 11);
        var json = frame.getAttribute('data-ls-map-json') || '';
        var collection = {type: 'FeatureCollection', features: []};
        try {
            if (json.length > 120000) throw new Error('Too much map feature data');
            if (json) collection = JSON.parse(json);
            if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)
                || collection.features.length > 500) throw new Error('Invalid map features');
        } catch (err) {
            target.textContent = 'Invalid wiki map data: ' + err.message;
            target.classList.add('ls-map-error');
            return;
        }
        try {
            frame.setAttribute('data-ls-map-ready', '1');
            // Also recover from the old iframe loader's configuration-error panel.
            target.classList.remove('ls-map-error');
            target.textContent = '';
            target.style.height = height + 'px';
            setupLegacyCRS();
            var bounds = [[-16384, -32768], [65536, 65536]];
            var map = L.map(target, {crs: L.CRS.LegacyScapeWiki,
                minZoom: 4, maxZoom: 11, maxBounds: bounds,
                zoomControl: true, zoomSnap: 1, attributionControl: false, preferCanvas: true});
            var tileLayer = window.createLegacy667TileLayer(L, {
                getPlane: function () { return floor; },
                baseUrls: ['https://cdn.jsdelivr.net/gh/MrSlayerGod/worldmap@map-wiki-667-v2/tiles/legacy667/'],
                options: { bounds: bounds }
            });
            var count = 0;
            collection.features.slice(0, 400).forEach(function (feature) {
                var layer = createFeature(feature, floor);
                if (layer) {layer.addTo(map); count++;}
            });
            map.setView(gameCoords(x + 0.5, y + 0.5), zoom, {animate: false});
            var status = document.createElement('div');
            status.className = 'ls-map-load-label';
            status.textContent = 'Loading LegacyScape map…';
            target.parentNode.appendChild(status);
            var errors = 0;
            tileLayer.on('loading', function () { errors = 0; status.hidden = false; status.textContent = 'Loading map…'; });
            tileLayer.on('tileerror', function () {errors++;});
            tileLayer.on('load', function () {
                status.hidden = !errors;
                if (errors) {
                    status.textContent = 'Some tiles could not load. ';
                    var retry = document.createElement('button');
                    retry.type = 'button';
                    retry.textContent = 'Retry';
                    retry.addEventListener('click', function () { tileLayer.redraw(); });
                    status.appendChild(retry);
                }
            });
            tileLayer.addTo(map);
            window.setTimeout(function () {
                map.invalidateSize({animate: false});
            }, 60);
            // Wiki tables and collapsible sections can resize after initial paint.
            if (typeof ResizeObserver !== 'undefined') {
                var observer = new ResizeObserver(function () {
                    map.invalidateSize({animate: false, pan: false});
                });
                observer.observe(target);
            }
            window.setTimeout(function () {
                if (!status.hidden && !errors) status.textContent = 'Map tiles are slow to load — you can still open the full map below.';
            }, 12000);
            mapInstances.set(frame, map);
        } catch (err) {
            frame.removeAttribute('data-ls-map-ready');
            target.textContent = 'Map could not load. Use the full map link below.';
            target.classList.add('ls-map-error');
            console.error('[LegacyScape] OSRS map failed:', err);
        }
    }

    // Backward compatibility for your original LegacyScape Module:Map markup.
    function setupLegacyCRS() {
        if (L.CRS.LegacyScapeWiki) return;
        L.CRS.LegacyScapeWiki = L.extend({}, L.CRS.Simple, {
            offsetZoom: 8,
            scale: function (z) { return Math.pow(2, z - this.offsetZoom); },
            zoom: function (s) { return Math.log(s) / Math.LN2 + this.offsetZoom; }
        });
    }
    function oldCoords(x, y, middle) {
        return L.latLng((y + (middle ? 0.5 : 0) - 64) * 4, (x + (middle ? 0.5 : 0)) * 4);
    }
    function makeLegacyMap(el) {
        if (el.getAttribute('data-loaded') === '1') return;
        var x = num(el.getAttribute('data-x'), 3222, 0, 20000);
        var y = num(el.getAttribute('data-y'), 3218, 0, 20000);
        var plane = num(el.getAttribute('data-plane'), 0, 0, 3);
        var zoom = num(el.getAttribute('data-zoom'), 8, 4, 11);
        var showMarker = el.getAttribute('data-marker') !== 'no';
        try {
            el.setAttribute('data-loaded', '1');
            var bounds = [[-16384, -32768], [65536, 65536]];
            var leaflet = L.map(el, {
                crs: L.CRS.LegacyScapeWiki,
                maxBounds: bounds,
                minZoom: 4,
                maxZoom: 11,
                zoomControl: true,
                zoomSnap: 1
            });
            window.createLegacy667TileLayer(L, {
                getPlane: function () { return plane; },
                baseUrls: ['https://cdn.jsdelivr.net/gh/MrSlayerGod/worldmap@map-wiki-667-v2/tiles/legacy667/'],
                options: { bounds: bounds }
            }).addTo(leaflet);
            leaflet.setView(oldCoords(x, y, true), zoom, { animate: false });
            if (showMarker) {
                var raw = el.getAttribute('data-coords') || (x + ',' + y);
                raw.split('|').slice(0, 200).forEach(function (entry) {
                    var match = /^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/.exec(entry);
                    if (!match) return;
                    var px = Number(match[1]), py = Number(match[2]);
                    L.marker(oldCoords(px, py, true))
                        .bindPopup('(' + px + ', ' + py + ')')
                        .addTo(leaflet);
                });
            }
            window.setTimeout(function () { leaflet.invalidateSize({animate: false}); }, 50);
            if (typeof ResizeObserver !== 'undefined') {
                var observer = new ResizeObserver(function () {
                    leaflet.invalidateSize({animate: false, pan: false});
                });
                observer.observe(el);
            }
        } catch (error) {
            el.removeAttribute('data-loaded');
            el.textContent = 'Unable to initialize map.';
            console.error('[LegacyScape] Old map failed:', error);
        }
    }
    function drainLegacyMaps() {
        if (!window.createLegacy667TileLayer || !window.Legacy667TileCoverage) {
            if (supportLoading) return;
            supportLoading = true;
            function loadScript(name, next) {
                var script = document.createElement('script');
                script.src = SUPPORT_BASE + name;
                script.onload = next;
                script.onerror = function () {
                    supportLoading = false;
                    pendingModernMaps.forEach(function (frame) {
                        var target = frame.querySelector('.ls-osrs-map-placeholder');
                        if (target) target.textContent = 'Map support could not load. Close and reopen the map to retry, or use the full map link.';
                    });
                };
                document.head.appendChild(script);
            }
            loadScript('legacy_tile_manifest.js', function () {
                loadScript('legacy_tile_layer.js', function () { supportLoading = false; drainLegacyMaps(); });
            });
            return;
        }
        setupLegacyCRS();
        pendingModernMaps.splice(0).forEach(renderOsrsMap);
        pendingLegacyMaps.splice(0).forEach(makeLegacyMap);
    }
    function loadLegacyLeaflet(legacyNodes, modernNodes) {
        pendingLegacyMaps = pendingLegacyMaps.concat(legacyNodes || []);
        pendingModernMaps = pendingModernMaps.concat(modernNodes || []);
        if (initializedLeaflet) return drainLegacyMaps();
        if (leafletLoading) return;
        leafletLoading = true;

        if (!document.querySelector('link[data-ls-leaflet]')) {
            var css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
            css.setAttribute('data-ls-leaflet', '1');
            document.head.appendChild(css);
        }
        if (window.L && window.L.map) {
            initializedLeaflet = true;
            leafletLoading = false;
            return drainLegacyMaps();
        }
        var js = document.createElement('script');
        js.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
        js.onload = function () { initializedLeaflet = true; leafletLoading = false; drainLegacyMaps(); };
        js.onerror = function () {
            leafletLoading = false;
            pendingLegacyMaps.splice(0).forEach(function (el) {
                el.textContent = 'Could not load the map library.';
            });
            pendingModernMaps.splice(0).forEach(function (frame) {
                var target = frame.querySelector('.ls-osrs-map-placeholder');
                if (target) {
                    target.textContent = 'Could not load Leaflet. Please check your browser console.';
                    target.classList.add('ls-map-error');
                }
            });
            console.error('[LegacyScape v4] Leaflet was blocked or could not be downloaded.');
        };
        document.head.appendChild(js);
    }

    function prepareToggle(frame) {
        if (frame.getAttribute('data-ls-toggle-ready') === '1') return;
        frame.setAttribute('data-ls-toggle-ready', '1');
        var panel = document.createElement('div');
        panel.className = 'ls-map-panel';
        panel.id = 'ls-map-panel-' + (++toggleCount);
        while (frame.firstChild) panel.appendChild(frame.firstChild);
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'ls-map-toggle';
        button.textContent = 'Show map';
        button.setAttribute('aria-label', 'Show map');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', panel.id);
        panel.hidden = true;
        frame.classList.add('ls-map-collapsible');
        frame.style.width = 'auto';
        frame.appendChild(button);
        frame.appendChild(panel);
        button.addEventListener('click', function () {
            var open = panel.hidden;
            panel.hidden = !open;
            button.textContent = open ? 'Hide map' : 'Show map';
            button.setAttribute('aria-label', open ? 'Hide map' : 'Show map');
            button.setAttribute('aria-expanded', String(open));
            if (!open) return;
            if (frame.getAttribute('data-ls-map-ready') !== '1') loadLegacyLeaflet([], [frame]);
            else {
                var map = mapInstances.get(frame);
                if (map) window.setTimeout(function () { map.invalidateSize({animate: false, pan: false}); }, 0);
            }
        });
    }

    function initMaps(root) {
        if (!root || !root.querySelectorAll) return;
        var modern = [];
        if (root.matches && root.matches('.ls-osrs-map-frame') && root.getAttribute('data-ls-map-ready') !== '1') modern.push(root);
        root.querySelectorAll('.ls-osrs-map-frame:not([data-ls-map-ready="1"])').forEach(function (el) {modern.push(el);});
        var legacy = [];
        if (root.matches && root.matches('.rs-map') && root.getAttribute('data-loaded') !== '1') legacy.push(root);
        root.querySelectorAll('.rs-map:not([data-loaded="1"])').forEach(function (el) { legacy.push(el); });
        modern = modern.filter(function (frame) {
            if (frame.getAttribute('data-ls-map-lazy') === '1' || frame.closest('td')) {
                prepareToggle(frame);
                return false;
            }
            return true;
        });
        if (legacy.length || modern.length) loadLegacyLeaflet(legacy, modern);
    }

    function initChargeSwitchers(root) {
        root.querySelectorAll('.infobox-switcher').forEach(function (switcher) {
            if (switcher.getAttribute('data-ls-switch-ready') === '1') return;
            switcher.setAttribute('data-ls-switch-ready', '1');
            switcher.querySelectorAll('.infobox-switcher-tab').forEach(function (tab) {
                tab.addEventListener('click', function () {
                    switcher.querySelectorAll('.infobox-switcher-tab').forEach(function (t) {
                        t.classList.remove('infobox-switcher-active');
                    });
                    tab.classList.add('infobox-switcher-active');
                    var caption = switcher.nextElementSibling && switcher.nextElementSibling.querySelector('caption');
                    if (caption && /^\d+$/.test(tab.dataset.charge || '')) {
                        caption.textContent = caption.textContent.replace(/\s*\(\d+\)\s*$/, '') + ' (' + tab.dataset.charge + ')';
                    }
                });
            });
        });
    }
    function initVersionSwitchers(root) {
        root.querySelectorAll('.infobox-switch[data-resource-class]').forEach(function (box) {
            if (box.getAttribute('data-ls-versions-ready') === '1') return;
            var selector = box.getAttribute('data-resource-class');
            var resources = box.nextElementSibling;
            while (resources && !resources.matches(selector)) resources = resources.nextElementSibling;
            if (!resources) return;
            box.setAttribute('data-ls-versions-ready', '1');
            var buttons = box.querySelectorAll('[data-switch-index]');
            function select(index) {
                box.querySelectorAll('[data-attr-param]').forEach(function (cell) {
                    var param = cell.getAttribute('data-attr-param');
                    var group = Array.from(resources.children).find(function (node) { return node.getAttribute('data-attr-param') === param; });
                    if (!group) return;
                    var source = group.querySelector('[data-attr-index="' + index + '"]') || group.querySelector('[data-attr-index="0"]');
                    if (!source) return;
                    cell.replaceChildren.apply(cell, Array.from(source.childNodes).map(function (node) { return node.cloneNode(true); }));
                });
                buttons.forEach(function (button) {
                    var active = button.getAttribute('data-switch-index') === index;
                    button.classList.toggle('selected', active);
                    button.setAttribute('aria-pressed', String(active));
                });
            }
            buttons.forEach(function (button) {
                button.setAttribute('role', 'button');
                button.tabIndex = 0;
                function choose() { select(button.getAttribute('data-switch-index')); }
                button.addEventListener('click', choose);
                button.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
                });
            });
            if (buttons.length) select(buttons[0].getAttribute('data-switch-index'));
        });
    }
    function initChecklists(root) {
        root.querySelectorAll('.quest-checklist-wrapper').forEach(function (wrapper) {
            if (wrapper.getAttribute('data-ls-checklist-ready') === '1') return;
            wrapper.setAttribute('data-ls-checklist-ready', '1');
            wrapper.querySelectorAll('li').forEach(function (li) {
                // Do not duplicate checkboxes already supplied by another script/template.
                if (li.querySelector(':scope > input[type="checkbox"]')) return;
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.style.marginRight = '6px';
                cb.style.cursor = 'pointer';
                cb.style.accentColor = '#c9a84c';
                li.prepend(cb);
            });
            var uncheck = wrapper.querySelector('.checklist-uncheck');
            if (uncheck) {
                var link = document.createElement('a');
                link.href = '#';
                link.textContent = 'uncheck all';
                link.style.fontSize = '0.85em';
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    wrapper.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
                });
                uncheck.textContent = '[';
                uncheck.appendChild(link);
                uncheck.appendChild(document.createTextNode(']'));
            }
        });
    }
    function init(root) {
        if (!root) return;
        initMaps(root);
        if (root.querySelectorAll) {
            initChargeSwitchers(root);
            initVersionSwitchers(root);
            initChecklists(root);
        }
    }
    if (typeof mw !== 'undefined' && mw.hook) {
        mw.hook('wikipage.content').add(function ($content) {
            init(($content && $content[0]) || document);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(document); });
    } else {
        init(document);
    }
}());
