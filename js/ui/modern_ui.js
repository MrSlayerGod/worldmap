'use strict';

import Locations from '../model/Locations.js';
import { Position } from '../model/Position.js';

// The modern UI is a thin view/controller around the original Leaflet map.
// The original map URL semantics and drawing controls remain intact.
export function initModernUI(map, controls) {
    const el = (id) => document.getElementById(id);
    const searchInput = el('atlas-search');
    const searchResults = el('search-results');
    const featured = el('featured-locations');
    const sidebar = el('explorer-sidebar');
    const backdrop = el('sidebar-backdrop');
    const mobileMenu = el('toggle-mobile-menu');
    const developerPanel = el('advanced-tools-panel');
    const openDev = el('open-developer-tools');
    const resultCard = el('selected-location-card');
    const destinationNames = ['Lumbridge', 'Varrock', 'Falador', 'Edgeville', 'Grand Exchange', 'Al Kharid'];
    let destinations = [];
    let chosenMarker = null;
    let toastTimer;

    const svg = (icon) => `<svg class="svg-icon"><use href="#ic-${icon}"></use></svg>`;

    document.addEventListener('atlas:toast', (event) => notify(String(event.detail || 'Action complete')));

    function notify(message) {
        const toast = el('atlas-toast');
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 2700);
    }

    function setMobileSidebar(open) {
        sidebar.classList.toggle('is-open', open);
        backdrop.hidden = !open;
        mobileMenu.setAttribute('aria-expanded', String(open));
        mobileMenu.setAttribute('aria-label', open ? 'Close map explorer' : 'Open map explorer');
        mobileMenu.querySelector('use').setAttribute('href', open ? '#ic-close' : '#ic-menu');
    }

    mobileMenu.addEventListener('click', () => setMobileSidebar(!sidebar.classList.contains('is-open')));
    backdrop.addEventListener('click', () => setMobileSidebar(false));

    function closeSearch() {
        searchResults.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
    }

    function updateFloors() {
        document.querySelectorAll('[data-floor]').forEach((button) => {
            const active = Number(button.dataset.floor) === map.plane;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        el('goto-z').value = map.plane;
    }

    function changeFloor(nextFloor) {
        if (!Number.isInteger(nextFloor) || nextFloor < 0 || nextFloor > 3 || nextFloor === map.plane) return;
        map.plane = nextFloor;
        map.updateMapPath();
        map.fire('planeChanged', { plane: nextFloor });
        updateFloors();
    }

    document.querySelectorAll('[data-floor]').forEach((button) => {
        button.addEventListener('click', () => changeFloor(Number(button.dataset.floor)));
    });

    const selectionIcon = L.divIcon({
        className: 'atlas-selection-icon',
        html: '<span class="atlas-pin-halo"></span><span class="atlas-pin-center"></span>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    function clearSelection(updateUrl = true) {
        if (chosenMarker) map.removeLayer(chosenMarker);
        chosenMarker = null;
        resultCard.hidden = true;
        if (updateUrl) {
            const url = new URL(window.location.href);
            url.searchParams.delete('selection');
            url.searchParams.delete('place');
            window.history.replaceState(null, '', url.toString());
        }
    }

    function goToPosition(x, y, z, name) {
        changeFloor(z);
        const centre = new Position(x, y, z).toCentreLatLng(map);
        clearSelection(false);
        chosenMarker = L.marker(centre, { icon: selectionIcon, title: name || 'Selected coordinates' }).addTo(map);
        chosenMarker.bindPopup(`<strong>${escapeText(name || 'Selected coordinates')}</strong><br>${x}, ${y}, ${z}`);
        // Quick Travel must not use flyTo here. The Void map uses a custom
        // offset CRS (zoom 8 is its 1:1 tile scale), and animated flyTo can
        // expose fractional intermediate zooms, leaving labels/tiles visually
        // desynchronised when destinations are clicked repeatedly.
        // Stop any ongoing map animation and snap immediately to an integer
        // zoom. Leaflet keeps the DOM labels attached to their game tiles.
        map.stop();
        const destinationZoom = Math.min(map.getMaxZoom(), Math.max(8, Math.round(map.getZoom())));
        map.setView(centre, destinationZoom, { animate: false });
        el('selected-location-name').textContent = name || 'Custom coordinates';
        el('selected-location-coords').textContent = `${x}, ${y}, ${z} · Floor ${z}`;
        resultCard.hidden = false;
        const url = new URL(window.location.href);
        url.searchParams.set('selection', `${x},${y},${z}`);
        if (name) url.searchParams.set('place', name);
        window.history.replaceState(null, '', url.toString());
        el('goto-x').value = x;
        el('goto-y').value = y;
        el('goto-z').value = z;
        closeSearch();
        setMobileSidebar(false);
    }

    function escapeText(text) {
        return String(text).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    el('clear-selection').addEventListener('click', clearSelection);
    el('map-zoom-in').addEventListener('click', () => map.zoomIn());
    el('map-zoom-out').addEventListener('click', () => map.zoomOut());
    el('map-return-home').addEventListener('click', () => goToPosition(3239, 3234, 0, 'Lumbridge'));

    el('goto-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const x = Number(el('goto-x').value);
        const y = Number(el('goto-y').value);
        const z = Number(el('goto-z').value);
        if (![x, y, z].every(Number.isSafeInteger) || x < 0 || x > 6400 || y < 0 || y > 16000 || z < 0 || z > 3) {
            el('goto-feedback').textContent = 'Enter valid X (0–6400), Y (0–16000) and floor (0–3).';
            return;
        }
        el('goto-feedback').textContent = '';
        goToPosition(x, y, z, 'Selected coordinates');
    });

    // The original labels/grid code handles drawing. These checkboxes simply
    // drive the existing controls rather than implementing duplicate overlays.
    function bindLayer(checkboxId, control, selector) {
        const checkbox = el(checkboxId);
        checkbox.addEventListener('change', () => {
            const trigger = control.getContainer().querySelector(selector);
            if (trigger) trigger.click();
        });
    }
    bindLayer('layer-place-labels', controls.labels, '#toggle-map-labels');
    bindLayer('layer-region-grid', controls.grid, '#toggle-region-grid');
    bindLayer('layer-region-labels', controls.regions, '#toggle-region-labels');

    const toolActions = ['Copy drawn data', 'Export settings', 'Area selection', 'Polygon selection', 'Path drawing', 'Undo last point', 'Clear drawing'];
    // Move only the original collection toolbar into the modern developer panel.
    // Its old JS click handlers remain attached and working.
    const collectionRoot = controls.collection.getContainer();
    if (collectionRoot) {
        collectionRoot.classList.add('modern-collection-toolbar');
        el('advanced-tools-toolbar').appendChild(collectionRoot);
        const toolIcons = ['copy', 'settings', 'area', 'polygon', 'path', 'undo', 'trash'];
        const toolCaptions = ['Copy', 'Settings', 'Area', 'Polygon', 'Path', 'Undo', 'Clear'];
        Array.from(collectionRoot.querySelectorAll('a.leaflet-control-custom')).forEach((anchor, index) => {
            anchor.innerHTML = `${svg(toolIcons[index])}<span class="modern-tool-caption">${toolCaptions[index]}</span>`;
            anchor.addEventListener('click', () => {
                const hint = el('advanced-tool-hint');
                if (index >= 2 && index <= 4) {
                    hint.textContent = `${toolCaptions[index]} tool selected. Click tiles to draw; click it again to exit.`;
                } else if (index === 0) {
                    hint.textContent = 'Copies the current drawn geometry to your clipboard.';
                } else if (index === 1) {
                    hint.textContent = 'Set the output format for the original Void editor.';
                } else {
                    hint.textContent = 'Drawing updated. Select a drawing tool to continue.';
                }
            });
            anchor.setAttribute('title', toolActions[index] || 'Map tool');
            anchor.setAttribute('aria-label', toolActions[index] || 'Map tool');
            anchor.setAttribute('role', 'button');
            anchor.setAttribute('tabindex', '0');
            anchor.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); anchor.click(); }
            });
        });
    }

    function setDevOpen(open) {
        developerPanel.classList.toggle('is-open', open);
        developerPanel.setAttribute('aria-hidden', String(!open));
        openDev.setAttribute('aria-expanded', String(open));
    }
    openDev.addEventListener('click', () => setDevOpen(!developerPanel.classList.contains('is-open')));
    el('close-developer-tools').addEventListener('click', () => setDevOpen(false));

    document.addEventListener('keydown', (event) => {
        const element = document.activeElement;
        const editing = element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
        if (event.key === '/' && !editing) {
            event.preventDefault();
            setMobileSidebar(true);
            searchInput.focus();
        } else if (event.key === 'Escape') {
            closeSearch();
            setDevOpen(false);
            setMobileSidebar(false);
            if (element === searchInput) searchInput.blur();
        }
    });

    function createLocationButton(location, index, compact) {
        const [x, y, z] = [location.position.x, location.position.y, location.position.z];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = compact ? 'search-location' : 'destination-card';
        button.innerHTML = compact
            ? `<span class="destination-icon">${svg('pin')}</span><span class="destination-detail"><strong></strong><small>${x}, ${y} · Floor ${z}</small></span>${svg('arrow')}`
            : `<span class="destination-number">${String(index + 1).padStart(2, '0')}</span><span class="destination-detail"><strong></strong><small>${x}, ${y} · Floor ${z}</small></span><span class="destination-arrow">${svg('arrow')}</span>`;
        button.querySelector('strong').textContent = location.name;
        button.addEventListener('click', () => goToPosition(x, y, z, location.name));
        return button;
    }

    function renderSearch() {
        const query = searchInput.value.trim().toLowerCase();
        searchResults.replaceChildren();
        if (!query) { closeSearch(); return; }
        const matches = destinations.filter((location) => location.name.toLowerCase().includes(query)).slice(0, 12);
        if (!matches.length) {
            const note = document.createElement('div');
            note.className = 'no-results';
            note.textContent = 'No matching locations found.';
            searchResults.appendChild(note);
        } else {
            matches.forEach((location, index) => searchResults.appendChild(createLocationButton(location, index, true)));
        }
        searchResults.hidden = false;
        searchInput.setAttribute('aria-expanded', 'true');
    }
    searchInput.addEventListener('input', renderSearch);
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !searchResults.hidden) {
            const first = searchResults.querySelector('button');
            if (first) { event.preventDefault(); first.click(); }
        }
    });
    document.addEventListener('pointerdown', (event) => {
        if (!event.target.closest('.search-block')) closeSearch();
    });

    Locations.getLocations((locations) => {
        destinations = locations.slice();
        featured.replaceChildren();
        destinationNames.forEach((name, index) => {
            const location = locations.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
            if (location) featured.appendChild(createLocationButton(location, index, false));
        });
        if (searchInput.value) renderSearch();
    });

    function updateStatus(position) {
        el('hud-coordinates').textContent = `${position.x}, ${position.y}, ${position.z}`;
        el('header-position').textContent = `${position.x}, ${position.y}`;
        el('hud-region').textContent = String(((position.x >> 6) << 8) + (position.y >> 6));
        el('hud-zoom').textContent = `${map.getZoom()}×`;
    }
    map.on('mousemove', (event) => {
        updateStatus(Position.fromLatLng(map, event.latlng, map.plane));
        el('hud-status').textContent = 'HOVERING TILE';
    });
    map.on('mouseout', () => {
        el('hud-status').textContent = 'MAP READY';
        updateStatus(Position.fromLatLng(map, map.getCenter(), map.plane));
    });
    map.on('moveend zoomend planeChanged', () => {
        updateStatus(Position.fromLatLng(map, map.getCenter(), map.plane));
        updateFloors();
    });

    el('share-map').addEventListener('click', async () => {
        const url = window.location.href;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url);
            } else {
                const tmp = document.createElement('textarea');
                tmp.value = url;
                tmp.style.position = 'fixed';
                tmp.style.opacity = '0';
                document.body.appendChild(tmp);
                tmp.select();
                if (!document.execCommand('copy')) throw new Error('Copy failed');
                tmp.remove();
            }
            notify('Map link copied to clipboard');
        } catch (error) {
            notify('Could not copy the URL; use the browser address bar.');
        }
    });

    updateStatus(Position.fromLatLng(map, map.getCenter(), map.plane));
    updateFloors();
    // Keep navigated-to places in shared URLs without changing the existing
    // ?marker= and ?markers= parameters used by the wiki Lua module.
    const sharedSelection = new URLSearchParams(window.location.search);
    const saved = sharedSelection.get('selection');
    const match = saved && saved.match(/^(\d+),(\d+),([0-3])$/);
    if (match) {
        const [, x, y, z] = match.map(Number);
        if (x <= 6400 && y <= 16000) {
            goToPosition(x, y, z, sharedSelection.get('place') || 'Shared location');
        }
    }
    // Map size might have changed with CSS after the map was created.
    requestAnimationFrame(() => map.invalidateSize());
}
