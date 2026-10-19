'use strict';

import {Position, RS_TILE_WIDTH_PX, RS_TILE_HEIGHT_PX} from './Position.js';

export class PolyArea {

    constructor(map) {
        this.map = map;
        this.positions = [];
        this.polygon = undefined;
        this.featureGroup = new L.FeatureGroup();
    }

    add(position) {
        this.positions.push(position);
        if (this.polygon) {
            this.featureGroup.removeLayer(this.polygon);
        }
        this.polygon = this.toLeaflet();
        this.featureGroup.addLayer(this.polygon);
    }
    
    addAll(positions) {
        for (var i = 0; i < positions.length; i ++) {
            this.positions.push(positions[i]);
        }
        if (this.polygon) {
            this.featureGroup.removeLayer(this.polygon);
        }
        this.polygon = this.toLeaflet();
        this.featureGroup.addLayer(this.polygon);
    }

    removeLast() {
        if (this.positions.length > 0) {
            this.positions.pop();
            if (this.polygon) {
                this.featureGroup.removeLayer(this.polygon);
            }
        }

        if (this.positions.length == 0) {
            this.polygon = undefined;
        } else {
            this.polygon = this.toLeaflet();
            this.featureGroup.addLayer(this.polygon);
        }
    }

    removeAll() {
        this.positions = [];
        if (this.polygon) {
            this.featureGroup.removeLayer(this.polygon);
        }
        this.polygon = undefined;
    }
    
    isEmpty() {
        return this.positions.length === 0;
    }

    toLeaflet() {
        var latLngs = [];

        for (var i = 0; i < this.positions.length; i++) {
            latLngs.push(this.positions[i].toCentreLatLng(this.map));
        }

        return L.polygon(
            latLngs, {
                color: "#33b5e5",
                weight: 1,
                interactive: false
            }
        );
    }
    
    getName() {
        return "Area";
    }
};