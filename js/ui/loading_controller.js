'use strict';

// Leaflet tile loading progress for startup, navigation and floor changes.
// Counts real tile events; it is not a time-based simulated progress bar.
export function createAtlasLoadingController() {
    const el = (id) => document.getElementById(id);
    const overlay = el('atlas-loading-screen');
    const status = el('atlas-loading-message');
    const phase = el('atlas-loading-phase');
    const percent = el('atlas-loading-percent');
    const progress = el('atlas-loading-progress');
    const progressTrack = el('atlas-loading-progress-track');
    const strip = el('atlas-tiles-loading');
    const stripBar = el('atlas-tiles-bar-fill');
    const stripMessage = el('atlas-tiles-message');
    const skip = el('atlas-loading-skip');

    let initial = true;
    let currentLayer = null;
    let events = null;
    let started = 0;
    let finished = 0;
    let failed = 0;
    let lastProgress = 4;
    let latestToken = 0;
    let stripShowTimer = null;
    let stripHideTimer = null;
    const begunAt = Date.now();

    function setInitialProgress(value) {
        const bounded = Math.max(lastProgress, Math.min(100, Math.round(value)));
        lastProgress = bounded;
        progress.style.width = `${bounded}%`;
        percent.textContent = `${bounded}%`;
        progressTrack.setAttribute('aria-valuenow', String(bounded));
    }

    function hideStrip() {
        window.clearTimeout(stripShowTimer);
        window.clearTimeout(stripHideTimer);
        strip.hidden = true;
    }

    function finishInitial() {
        if (!initial) return;
        initial = false;
        setInitialProgress(100);
        phase.textContent = failed ? 'READY · SOME TILES UNAVAILABLE' : 'READY TO EXPLORE';
        status.textContent = failed ? 'World map opened. Some tiles could not be loaded.' : 'Your world map is ready.';
        window.setTimeout(() => {
            overlay.classList.add('is-done');
            window.setTimeout(() => { overlay.hidden = true; }, 425);
        }, Math.max(160, 650 - (Date.now() - begunAt)));
        hideStrip();
    }

    function showStrip() {
        if (initial) return;
        window.clearTimeout(stripShowTimer);
        window.clearTimeout(stripHideTimer);
        stripShowTimer = window.setTimeout(() => {
            if (!initial && currentLayer && finished < started) strip.hidden = false;
        }, 160);
    }

    function refresh() {
        if (!started) return;
        const proportion = Math.min(1, finished / started);
        if (initial) {
            setInitialProgress(18 + proportion * 75);
            status.textContent = `Loading world tiles… ${finished} of ${started}`;
            phase.textContent = failed ? 'LOADING · TILE RETRIES MAY BE NEEDED' : 'RENDERING WORLD TILES';
        } else {
            stripBar.style.width = `${Math.round(6 + 94 * proportion)}%`;
            stripMessage.textContent = failed ? 'Some tiles unavailable…' : 'Loading map tiles…';
        }
    }

    // New tile layers are created when the floor changes. Unhook old layers
    // so late responses cannot update progress for a different floor/view.
    function watch(layer) {
        latestToken++;
        if (currentLayer && events) currentLayer.off(events);
        currentLayer = layer;
        started = 0;
        finished = 0;
        failed = 0;
        stripBar.style.width = '6%';
        hideStrip();
        if (initial) {
            setInitialProgress(14);
            phase.textContent = 'LOADING WORLD TILES';
            status.textContent = 'Fetching the map around your location…';
        }
        const token = latestToken;
        events = {
            loading: () => {
                if (token !== latestToken) return;
                started = 0;
                finished = 0;
                failed = 0;
                stripBar.style.width = '6%';
                hideStrip();
            },
            tileloadstart: () => {
                if (token !== latestToken) return;
                started++;
                showStrip();
                refresh();
            },
            tileload: () => {
                if (token !== latestToken) return;
                finished++;
                refresh();
            },
            tileerror: () => {
                if (token !== latestToken) return;
                failed++;
                finished++;
                refresh();
            },
            load: () => {
                if (token !== latestToken) return;
                if (initial) {
                    finishInitial();
                } else {
                    window.clearTimeout(stripShowTimer);
                    stripHideTimer = window.setTimeout(() => { strip.hidden = true; }, 280);
                }
            }
        };
        layer.on(events);
    }

    // A slow or unavailable tile host must never trap users on the splash.
    window.setTimeout(() => {
        if (initial) {
            status.textContent = 'Map tiles are taking longer than usual. You can explore while they load.';
            skip.hidden = false;
        }
    }, 9000);
    window.setTimeout(finishInitial, 16000);

    return { watch };
}
