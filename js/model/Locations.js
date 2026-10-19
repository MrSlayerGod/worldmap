'use strict';

import { Position } from './Position.js';

class Locations {
    constructor() {
        this.locations = [];
        this._loaded = false;
        this._loading = false;
        this._callbacks = [];
    }

    getLocations(callback) {
        if (this._loaded) { callback(this.locations); return; }
        this._callbacks.push(callback);
        if (this._loading) return;
        this._loading = true;

        $.ajax({
            url: 'resources/locations.json',
            dataType: 'json',
            success: (data) => {
                this.locations = (data.locations || []).map((location) => ({
                    name: location.name,
                    position: new Position(location.coords[0], location.coords[1], location.coords[2]),
                    size: location.size
                }));
                this._loaded = true;
                this._loading = false;
                const callbacks = this._callbacks.splice(0);
                callbacks.forEach((cb) => cb(this.locations));
            },
            error: () => {
                this._loading = false;
                const callbacks = this._callbacks.splice(0);
                callbacks.forEach((cb) => cb([]));
                // Subsequent calls can retry if assets were briefly unavailable.
            }
        });
    }
}

export default new Locations();
