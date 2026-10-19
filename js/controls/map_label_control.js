'use strict';

import Locations from '../model/Locations.js';

// Location names are Leaflet-anchored DOM markers, not canvas text.
// Each label moves with its actual game tile during map pan/zoom animations.
// This avoids the desynchronised canvas position/zoom transforms in Void.
const CLASS_BY_SIZE = {
    large: 'rs-map-label--large',
    medium: 'rs-map-label--medium',
    default: 'rs-map-label--default'
};

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function wrapLocationName(name) {
    // Respect the exact name from locations.json, but make long names legible.
    return escapeHtml(name).replace(/\s+/g, ' ');
}

export var MapLabelControl = L.Control.extend({
    options: { position: 'topleft' },

    onAdd: function (map) {
        this._map = map;
        this._enabled = true;
        this._entries = [];
        this._visible = L.layerGroup().addTo(map);
        this._currentZoomClass = null;
        this._pane = map.createPane('map-labels');
        this._pane.style.zIndex = '450';
        this._pane.style.pointerEvents = 'none';

        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control noselect');
        const button = L.DomUtil.create('a', 'leaflet-control-custom', container);
        button.id = 'toggle-map-labels';
        button.textContent = 'Toggle Labels';
        button.href = '#';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button, 'click', L.DomEvent.preventDefault);
        L.DomEvent.on(button, 'click', this._toggleMapLabels, this);

        // Rebuild layer only when floor, zoom, or visible region actually changes.
        map.on('moveend zoomend planeChanged resize', this._render, this);
        Locations.getLocations((locations) => {
            this._entries = locations.map((location) => {
                const size = CLASS_BY_SIZE[location.size] ? location.size : 'default';
                const icon = L.divIcon({
                    className: 'rs-place-label-icon',
                    html: `<span class="rs-map-label ${CLASS_BY_SIZE[size]}">${wrapLocationName(location.name)}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });
                return {
                    position: location.position,
                    size,
                    marker: L.marker(location.position.toCentreLatLng(map), {
                        icon,
                        pane: 'map-labels',
                        interactive: false,
                        keyboard: false
                    })
                };
            });
            this._render();
        });
        return container;
    },

    onRemove: function (map) {
        map.off('moveend zoomend planeChanged resize', this._render, this);
        if (this._visible) map.removeLayer(this._visible);
    },

    _render: function () {
        if (!this._map || !this._visible) return;
        const zoom = this._map.getZoom();
        const bucket = zoom <= 5 ? 'overview' : zoom <= 8 ? 'standard' : 'detail';
        if (this._currentZoomClass !== bucket) {
            this._pane.classList.remove('rs-zoom-overview', 'rs-zoom-standard', 'rs-zoom-detail');
            this._pane.classList.add(`rs-zoom-${bucket}`);
            this._currentZoomClass = bucket;
        }
        if (!this._enabled) {
            this._visible.clearLayers();
            return;
        }
        const bounds = this._map.getBounds().pad(0.15);
        const currentPlane = this._map.plane;
        const desired = new Set();
        for (const entry of this._entries) {
            if (entry.position.z !== currentPlane) continue;
            if (entry.size === 'default' && zoom < 6) continue;
            if (entry.size === 'medium' && zoom < 5) continue;
            if (!bounds.contains(entry.marker.getLatLng())) continue;
            desired.add(entry.marker);
            if (!this._visible.hasLayer(entry.marker)) this._visible.addLayer(entry.marker);
        }
        this._visible.eachLayer((layer) => {
            if (!desired.has(layer)) this._visible.removeLayer(layer);
        });
    },

    _toggleMapLabels: function () {
        this._enabled = !this._enabled;
        this._render();
    }
});
