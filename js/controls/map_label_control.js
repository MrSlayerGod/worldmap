'use strict';

import { CanvasLayer } from '../external/L.CanvasLayer.js';
import Locations from '../model/Locations.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getLabelStyle(size, zoom) {
    const zoomFactor = Math.pow(1.16, zoom - 7);

    switch (size) {
        case 'large':
            return {
                minZoom: 4,
                colour: '#f0b447',
                fontWeight: 800,
                fontSize: clamp(24 * zoomFactor, 18, 42),
                lineHeight: clamp(28 * zoomFactor, 22, 46),
                maxWidth: clamp(200 * zoomFactor, 170, 280),
                strokeWidth: 4
            };
        case 'medium':
            return {
                minZoom: 5,
                colour: '#ffffff',
                fontWeight: 760,
                fontSize: clamp(15 * zoomFactor, 13, 22),
                lineHeight: clamp(18 * zoomFactor, 16, 26),
                maxWidth: clamp(140 * zoomFactor, 120, 200),
                strokeWidth: 3
            };
        default:
            return {
                minZoom: 6,
                colour: '#ffffff',
                fontWeight: 720,
                fontSize: clamp(12 * zoomFactor, 11, 18),
                lineHeight: clamp(15 * zoomFactor, 13, 22),
                maxWidth: clamp(110 * zoomFactor, 100, 160),
                strokeWidth: 3
            };
    }
}

function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];

    const lines = [];
    let current = words[0];

    for (let i = 1; i < words.length; i++) {
        const trial = `${current} ${words[i]}`;
        if (ctx.measureText(trial).width <= maxWidth) {
            current = trial;
        } else {
            lines.push(current);
            current = words[i];
        }
    }

    lines.push(current);
    return lines;
}

var MapLabelsCanvas = CanvasLayer.extend({
    initialize: function (options) {
        CanvasLayer.prototype.initialize.call(this, options);
        this._locations = null;
        this._loaded = false;
    },

    setData: function () {
        this.needRedraw();
    },

    _ensureLocations: function () {
        if (this._loaded) return;
        this._loaded = true;
        Locations.getLocations((locations) => {
            this._locations = locations || [];
            this.needRedraw();
        });
    },

    onDrawLayer: function (info) {
        this._ensureLocations();
        const locations = this._locations;
        if (!locations || !locations.length) return;

        const zoom = this._map.getZoom();
        const ctx = info.canvas.getContext('2d');
        ctx.clearRect(0, 0, info.canvas.width, info.canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(6, 10, 14, 0.88)';

        const currentBounds = this._map.getBounds().pad(0.3);

        for (const location of locations) {
            if (location.position.z !== info.layer._map.plane) continue;

            const style = getLabelStyle(location.size, zoom);
            if (zoom < style.minZoom) continue;

            const latLng = location.position.toCentreLatLng(this._map);
            if (!currentBounds.contains(latLng)) continue;

            const point = info.layer._map.latLngToContainerPoint(latLng);

            ctx.font = `${style.fontWeight} ${style.fontSize}px Inter, Segoe UI, Verdana, sans-serif`;
            ctx.fillStyle = style.colour;
            ctx.lineWidth = style.strokeWidth;

            const lines = wrapText(ctx, location.name, style.maxWidth);
            const blockHeight = (lines.length - 1) * style.lineHeight;
            let y = point.y - (blockHeight / 2);

            for (const line of lines) {
                ctx.strokeText(line, point.x, y);
                ctx.fillText(line, point.x, y);
                y += style.lineHeight;
            }
        }
    }
});

export var MapLabelControl = L.Control.extend({
    options: {
        position: 'topleft'
    },

    onAdd: function (map) {
        map.createPane('map-labels');
        map.getPane('map-labels').style.zIndex = 420;
        map.getPane('map-labels').style.pointerEvents = 'none';

        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control noselect');
        container.style.background = 'none';
        container.style.width = '100px';
        container.style.height = 'auto';

        var labelsButton = L.DomUtil.create('a', 'leaflet-bar leaflet-control leaflet-control-custom', container);
        labelsButton.id = 'toggle-map-labels';
        labelsButton.innerHTML = 'Toggle Labels';

        L.DomEvent.on(labelsButton, 'click', this._toggleMapLabels, this);

        this._enabled = true;

        L.DomEvent.disableClickPropagation(container);

        this._mapLabelsCanvas = new MapLabelsCanvas({ pane: 'map-labels' });
        this._map.addLayer(this._mapLabelsCanvas);

        map.on('planeChanged', function () {
            this._mapLabelsCanvas.drawLayer();
        }, this);

        return container;
    },

    _toggleMapLabels: function () {
        if (this._enabled) {
            this._map.getPane('map-labels').style.display = 'none';
            this._enabled = false;
        } else {
            this._map.getPane('map-labels').style.display = '';
            this._enabled = true;
            this._mapLabelsCanvas.drawLayer();
        }
    }
});
