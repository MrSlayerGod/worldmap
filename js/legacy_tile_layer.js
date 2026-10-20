/* Shared by the atlas and MediaWiki. Generated coverage is appended below. */
(function (global) {
    'use strict';
    const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    global.createLegacy667TileLayer = function (L, settings) {
        const coverage = global.Legacy667TileCoverage;
        const Layer = L.TileLayer.extend({
            createTile: function (coords, done) {
                const tile = document.createElement('img');
                tile.alt = '';
                tile.setAttribute('role', 'presentation');
                const plane = settings.getPlane();
                const key = `${plane}/${coords.z}/${coords.x}`;
                const y = -coords.y;
                const available = coverage && coverage[key];
                let cancelled = false, finished = false, timer, attempt = 0;
                const finish = (error) => {
                    if (cancelled || finished) return;
                    finished = true;
                    clearTimeout(timer);
                    tile.onload = tile.onerror = null;
                    done(error, tile);
                };
                tile._legacyCancel = () => {
                    cancelled = true;
                    clearTimeout(timer);
                    tile.onload = tile.onerror = null;
                };
                // Unexported regions are intentional empty space, not network errors.
                if (coverage && (!available || !available.includes(y))) {
                    tile.src = BLANK;
                    setTimeout(() => finish(null), 0);
                    return tile;
                }
                const path = `${plane}/${coords.z}/${coords.x}/${y}.png`;
                const urls = settings.baseUrls.map((base) => base + path);
                const request = () => {
                    if (cancelled || finished) return;
                    const current = ++attempt;
                    const next = () => {
                        if (current !== attempt || cancelled || finished) return;
                        clearTimeout(timer);
                        if (attempt < 3) request();
                        else finish(new Error('Map tile could not be downloaded: ' + path));
                    };
                    tile.onload = () => {
                        if (current === attempt) finish(null);
                    };
                    tile.onerror = next;
                    let url = urls[(attempt - 1) % urls.length];
                    if (attempt > urls.length) url += '?retry=' + attempt;
                    timer = setTimeout(next, settings.timeout || 6000);
                    tile.src = url;
                };
                request();
                return tile;
            }
        });
        const layer = new Layer('', Object.assign({
            tileSize: 256, minZoom: 4, maxZoom: 11,
            minNativeZoom: 4, maxNativeZoom: 8, noWrap: true
        }, settings.options));
        layer.on('tileunload', (event) => {
            if (event.tile._legacyCancel) event.tile._legacyCancel();
        });
        return layer;
    };
})(window);
