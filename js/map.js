'use strict';

import { Position } from './model/Position.js';
import { initModernUI } from './ui/modern_ui.js';
import { createAtlasLoadingController } from './ui/loading_controller.js';

// Original Void map controls — retained for compatibility.
import { CollectionControl } from './controls/collection_control.js';
import { CoordinatesControl } from './controls/coordinates_control.js';
import { LocalCoordinatesControl } from './controls/local_coordinates_control.js';
import { RegionBaseCoordinatesControl } from './controls/region_base_coordinates_control.js';
import { GridControl } from './controls/grid_control.js';
import { LocationLookupControl } from './controls/location_lookup_control.js';
import { MapLabelControl } from './controls/map_label_control.js';
import { PlaneControl } from './controls/plane_control.js';
import { RegionLabelsControl } from './controls/region_labels_control.js';
import { RegionLookupControl } from './controls/region_lookup_control.js';
import { TitleLabel } from './controls/title_label.js';

$(document).ready(function () {
    const tileSize = 256;
    const numTiles = 256;
    const startX = 50;
    const startY = 50;
    const minZoom = 4;
    const maxZoom = 11;
    const maxWikiMarkers = 200;

    const bounds = [
        [-tileSize * numTiles / 4, -tileSize * numTiles / 2],
        [tileSize * numTiles, tileSize * numTiles]
    ];

    L.CRS.SimpleOffset = L.extend({}, L.CRS.Simple, {
        offsetZoom: 8,
        scale: function (zoom) {
            return Math.pow(2, zoom - this.offsetZoom);
        },
        zoom: function (scale) {
            return Math.log(scale) / Math.LN2 + this.offsetZoom;
        }
    });

    const map = L.map('map', {
        crs: L.CRS.SimpleOffset,
        maxBounds: bounds,
        center: [tileSize * startY, tileSize * startX],
        minZoom: minZoom,
        maxZoom: maxZoom,
        zoom: 8,
        zoomSnap: 1,
        zoomDelta: 1,
        zoomControl: false
    });

    const urlParams = new URLSearchParams(window.location.search);
    const parseInteger = (value) => {
        if (value === null || !/^-?\d+$/.test(value.trim())) return null;
        const n = Number(value);
        return Number.isSafeInteger(n) ? n : null;
    };
    const isPlane = (n) => n !== null && n >= 0 && n <= 3;
    const requestedPlane = parseInteger(urlParams.get('centreZ'));
    map.plane = isPlane(requestedPlane) ? requestedPlane : 0;

    // Use the owner-maintained tile dataset through Miraheze-permitted jsDelivr.
    // Dataset provenance alone does not validate every location against the 667 cache.
    const CustomTileLayer = L.TileLayer.extend({
        getTileUrl: function (coords) {
            // When your 667 tiles are generated and hosted, this is the line to change:
            // return `./map_tiles/${map.plane}/${coords.z}/${coords.x}/${-coords.y}.png`;
            return `https://cdn.jsdelivr.net/gh/MrSlayerGod/void-map-tiles@5d08cecd3a9d6e6366961d17907bd256954b5287/${map.plane}/${coords.z}/${coords.x}/${-coords.y}.png`;
        }
    });

    // Track actual Leaflet tile requests for the initial loading screen and
    // compact status strip during navigation; never block map interactions.
    const atlasLoader = createAtlasLoadingController();

    map.updateMapPath = function () {
        if (map.tile_layer !== undefined) {
            map.removeLayer(map.tile_layer);
        }
        map.tile_layer = new CustomTileLayer({
            tileSize: tileSize,
            bounds: bounds
        });
        atlasLoader.watch(map.tile_layer);
        map.tile_layer.addTo(map);
        map.invalidateSize();
    };

    map.getContainer().focus();

    // Position.toCentreLatLng is an INSTANCE method in your Position.js.
    // Calling Position.toCentreLatLng(map, x, y) is incorrect.
    const tileCentre = (x, y, plane = map.plane) =>
        new Position(x, y, plane).toCentreLatLng(map);

    const requestedX = parseInteger(urlParams.get('centreX'));
    const requestedY = parseInteger(urlParams.get('centreY'));
    const requestedZoom = parseInteger(urlParams.get('zoom'));
    const zoom = requestedZoom === null
        ? 8
        : Math.min(maxZoom, Math.max(minZoom, requestedZoom));
    const hasExplicitCentre = requestedX !== null && requestedY !== null;

    if (hasExplicitCentre) {
        map.setView(tileCentre(requestedX, requestedY), zoom, { animate: false });
    } else if (requestedZoom !== null) {
        map.setZoom(zoom, { animate: false });
    }

    // URL formats:
    //   ?marker=3222,3218,0                      (existing one-pin links)
    //   ?markers=3222,3218,0|3210,3211,0        (LegacyScape Lua Module:Map)
    //   ?marker=3222,3218&marker=3210,3211      (repeated parameter)
    // The plane is optional; absent plane means centreZ (default 0).
    // The marker=no flag disables markers, even if the URL contains markers.
    const parseMarker = (token) => {
        if (typeof token !== 'string') return null;
        const m = token.match(/^\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?\s*$/);
        if (!m) return null;
        const x = parseInteger(m[1]);
        const y = parseInteger(m[2]);
        const z = m[3] === undefined ? map.plane : parseInteger(m[3]);
        if (x === null || y === null || !isPlane(z)) return null;
        return { x, y, z };
    };

    const markerIsOff = (value) => ['no', 'false', '0', 'off'].includes(
        (value || '').trim().toLowerCase()
    );
    const markersEnabled = !markerIsOff(urlParams.get('showMarkers')) &&
        !markerIsOff(urlParams.get('marker'));
    const initialMarkers = [];
    const seen = new Set();
    const addMarker = (token) => {
        if (initialMarkers.length >= maxWikiMarkers) return;
        const point = parseMarker(token);
        if (!point) return;
        const key = `${point.x},${point.y},${point.z}`;
        if (seen.has(key)) return;
        seen.add(key);
        initialMarkers.push(point);
    };

    if (markersEnabled) {
        // Split URLs generated by the upgraded wiki Lua module.
        for (const encodedList of urlParams.getAll('markers')) {
            for (const token of encodedList.split('|')) addMarker(token);
        }
        // Also accept old and repeated single-marker URLs without duplicates.
        for (const token of urlParams.getAll('marker')) {
            if (['no', 'false', '0', 'off'].includes(token.trim().toLowerCase())) continue;
            addMarker(token);
        }
    }

    // Keep markers in a layer group, independent of the tile layer, so plane
    // switching never deletes them. Only show markers from the current floor.
    const wikiMarkerLayer = L.layerGroup().addTo(map);
    const wikiMarkers = initialMarkers.map((point) => {
        const marker = L.marker(tileCentre(point.x, point.y, point.z));
        marker.bindPopup(`<strong>(${point.x}, ${point.y}, ${point.z})</strong>`);
        return { point, marker };
    });

    const updateWikiMarkers = () => {
        wikiMarkerLayer.clearLayers();
        for (const entry of wikiMarkers) {
            if (entry.point.z === map.plane) {
                wikiMarkerLayer.addLayer(entry.marker);
            }
        }
    };
    updateWikiMarkers();

    // Convenient behaviour for manually constructed URLs without centreX/Y.
    // Lua-generated links already supply an explicit centre and zoom.
    if (!hasExplicitCentre && initialMarkers.length > 0) {
        const visible = initialMarkers.filter((point) => point.z === map.plane);
        if (visible.length === 1) {
            map.setView(tileCentre(visible[0].x, visible[0].y), zoom, { animate: false });
        } else if (visible.length > 1) {
            const markerBounds = L.latLngBounds(visible.map(
                (point) => tileCentre(point.x, point.y)
            ));
            map.fitBounds(markerBounds, {
                padding: [48, 48],
                maxZoom: maxZoom,
                animate: false
            });
        }
    }

    // Begin tile loading after locating the requested destination.
    map.updateMapPath();

    // Original map controls retained.
    // Original controls remain installed. The new UI presents a cleaner
    // interface and delegates to these original tools when required.
    map.addControl(new TitleLabel());
    map.addControl(new CoordinatesControl());
    map.addControl(new RegionBaseCoordinatesControl());
    map.addControl(new LocalCoordinatesControl());
    map.addControl(L.control.zoom());
    map.addControl(new PlaneControl());
    map.addControl(new LocationLookupControl());
    const labels = new MapLabelControl();
    const collection = new CollectionControl({ position: 'topright' });
    const grid = new GridControl();
    const regions = new RegionLabelsControl();
    map.addControl(labels);
    map.addControl(collection);
    map.addControl(new RegionLookupControl());
    map.addControl(grid);
    map.addControl(regions);

    let prevMouseRect;
    let prevMousePos;
    map.on('mousemove', function (e) {
        const mousePos = Position.fromLatLng(map, e.latlng, map.plane);
        // Compare tile coordinates, not the newly-created Position objects.
        if (prevMousePos && prevMousePos.equals(mousePos)) return;
        prevMousePos = mousePos;
        if (prevMouseRect) map.removeLayer(prevMouseRect);
        prevMouseRect = mousePos.toLeaflet(map);
        prevMouseRect.addTo(map);
    });
    map.on('mouseout', function () {
        if (prevMouseRect) map.removeLayer(prevMouseRect);
        prevMouseRect = undefined;
        prevMousePos = undefined;
    });

    // IMPORTANT: keep any ?marker or ?markers query parameters when the user
    // pans/zooms; otherwise copying the new URL silently loses all markers.
    const setUrlParams = () => {
        const centrePos = Position.fromLatLng(map, map.getCenter(), map.plane);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('centreX', String(centrePos.x));
        newUrl.searchParams.set('centreY', String(centrePos.y));
        newUrl.searchParams.set('centreZ', String(centrePos.z));
        newUrl.searchParams.set('zoom', String(Math.round(map.getZoom())));
        window.history.replaceState(null, '', newUrl.toString());
    };

    map.on('moveend', setUrlParams);
    map.on('zoomend', setUrlParams);
    map.on('planeChanged', function () {
        updateWikiMarkers();
        prevMousePos = undefined;
        if (prevMouseRect) map.removeLayer(prevMouseRect);
        prevMouseRect = undefined;
        setUrlParams();
    });

    initModernUI(map, { labels, collection, grid, regions });
});
