'use strict';

import { Position } from '../model/Position.js';
import { Region, MIN_X, MAX_X, MIN_Y, MAX_Y, REGION_WIDTH, REGION_HEIGHT } from '../model/Region.js';

// Region IDs use the same Leaflet positioning as the underlying tile layer.
export var RegionLabelsControl = L.Control.extend({
    options: { position: 'topleft' },

    onAdd: function (map) {
        this._map = map;
        this.visible = false;
        this._pane = map.createPane('region-labels');
        this._pane.style.zIndex = '445';
        this._pane.style.pointerEvents = 'none';
        this._labels = L.layerGroup().addTo(map);
        this._markers = new Map();

        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control noselect');
        const button = L.DomUtil.create('a', 'leaflet-control-custom', container);
        button.id = 'toggle-region-labels';
        button.textContent = 'Toggle Region Labels';
        button.href = '#';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button, 'click', L.DomEvent.preventDefault);
        L.DomEvent.on(button, 'click', () => {
            this.visible = !this.visible;
            this._render();
        });
        map.on('moveend zoomend planeChanged resize', this._render, this);
        return container;
    },

    onRemove: function (map) {
        map.off('moveend zoomend planeChanged resize', this._render, this);
        if (this._labels) map.removeLayer(this._labels);
    },

    _render: function () {
        this._labels.clearLayers();
        if (!this.visible) return;
        const map = this._map;
        const bounds = map.getBounds().pad(0.05);
        const a = Position.fromLatLng(map, bounds.getSouthWest(), map.plane);
        const b = Position.fromLatLng(map, bounds.getNorthEast(), map.plane);
        const startX = Math.max(MIN_X, Math.floor(Math.min(a.x, b.x) / REGION_WIDTH) * REGION_WIDTH);
        const endX = Math.min(MAX_X, Math.max(a.x, b.x));
        const startY = Math.max(MIN_Y, Math.floor(Math.min(a.y, b.y) / REGION_HEIGHT) * REGION_HEIGHT);
        const endY = Math.min(MAX_Y, Math.max(a.y, b.y));
        const zoom = map.getZoom();
        for (let x = startX; x <= endX; x += REGION_WIDTH) {
            for (let y = startY; y <= endY; y += REGION_HEIGHT) {
                const position = new Position(x + REGION_WIDTH / 2, y + REGION_HEIGHT / 2, 0);
                const regionId = Region.fromPosition(position).id;
                let marker = this._markers.get(regionId);
                if (!marker) {
                    marker = L.marker(position.toCentreLatLng(map), {
                        pane: 'region-labels',
                        interactive: false,
                        keyboard: false,
                        icon: L.divIcon({
                            className: 'rs-region-label-icon',
                            html: `<span class="rs-region-label">${regionId}</span>`,
                            iconSize: [0, 0], iconAnchor: [0, 0]
                        })
                    });
                    this._markers.set(regionId, marker);
                }
                if (zoom >= 5) this._labels.addLayer(marker);
            }
        }
    }
});
