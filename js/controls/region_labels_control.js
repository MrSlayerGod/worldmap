'use strict';

import { Position } from '../model/Position.js';
import { CanvasLayer } from '../external/L.CanvasLayer.js';
import { Region, MIN_X, MAX_X, MIN_Y, MAX_Y, REGION_WIDTH, REGION_HEIGHT } from '../model/Region.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

var RegionLabelsCanvas = CanvasLayer.extend({
    setData: function () {
        this.needRedraw();
    },

    onDrawLayer: function (info) {
        const zoom = this._map.getZoom();
        const ctx = info.canvas.getContext('2d');
        ctx.clearRect(0, 0, info.canvas.width, info.canvas.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.strokeStyle = 'rgba(8, 12, 18, 0.75)';
        ctx.lineWidth = 3;

        const fontSize = clamp(12 * Math.pow(1.12, zoom - 7), 10, 20);
        ctx.font = `700 ${fontSize}px Inter, Segoe UI, Calibri, sans-serif`;

        const bounds = this._map.getBounds().pad(0.1);

        for (let x = MIN_X; x < MAX_X; x += REGION_WIDTH) {
            for (let y = MIN_Y; y < MAX_Y; y += REGION_HEIGHT) {
                const position = new Position(x + (REGION_WIDTH / 2), y + (REGION_HEIGHT / 2), 0);
                const latLng = position.toCentreLatLng(this._map);
                if (!bounds.contains(latLng)) continue;

                const region = Region.fromPosition(position);
                const point = info.layer._map.latLngToContainerPoint(latLng);
                const text = region.id.toString();
                ctx.strokeText(text, point.x, point.y);
                ctx.fillText(text, point.x, point.y);
            }
        }
    }
});

export var RegionLabelsControl = L.Control.extend({
    options: {
        position: 'topleft'
    },

    onAdd: function (map) {
        map.createPane('region-labels');
        map.getPane('region-labels').style.zIndex = 415;
        map.getPane('region-labels').style.pointerEvents = 'none';

        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control noselect');
        container.style.background = 'none';
        container.style.width = '130px';
        container.style.height = 'auto';

        var labelsButton = L.DomUtil.create('a', 'leaflet-bar leaflet-control leaflet-control-custom', container);
        labelsButton.id = 'toggle-region-labels';
        labelsButton.innerHTML = 'Toggle Region Labels';

        this._regionLabelsCanvas = new RegionLabelsCanvas({ pane: 'region-labels' });
        map.getPane('region-labels').style.display = 'none';
        map.addLayer(this._regionLabelsCanvas);

        this.visible = false;

        L.DomEvent.on(labelsButton, 'click', () => {
            if (this.visible) {
                map.getPane('region-labels').style.display = 'none';
            } else {
                map.getPane('region-labels').style.display = '';
                this._regionLabelsCanvas.drawLayer();
            }
            this.visible = !this.visible;
        }, this);

        L.DomEvent.disableClickPropagation(container);
        return container;
    }
});
