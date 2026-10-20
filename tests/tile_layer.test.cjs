const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/legacy_tile_layer.js'), 'utf8');
function fixture(outcomes, coverage = {'0/8/50': [54]}) {
    const jobs = new Map(), requests = [];
    let id = 0;
    const later = (fn) => { jobs.set(++id, fn); return id; };
    const window = {Legacy667TileCoverage: coverage};
    const document = {createElement: () => ({
        setAttribute() {},
        set src(url) {
            requests.push(url);
            if (!url.startsWith('data:')) {
                const success = outcomes.shift();
                if (success === 'pending') return;
                const callback = success ? this.onload : this.onerror;
                later(() => { if (callback) callback(); });
            }
        }
    })};
    // Delayed timeout jobs are deliberately separate from image events.
    const timeouts = new Map();
    vm.runInNewContext(source, {window, document, setTimeout: (fn, delay) => delay ? (timeouts.set(++id, fn), id) : later(fn), clearTimeout: (key) => {jobs.delete(key); timeouts.delete(key);}});
    const L = {TileLayer: {extend: (methods) => class {
        constructor() { Object.assign(this, methods); this.events = {}; }
        on(name, fn) { this.events[name] = fn; }
    }}};
    const layer = window.createLegacy667TileLayer(L, {getPlane: () => 0, baseUrls: ['primary/', 'fallback/']});
    const flush = () => { while (jobs.size) {const [key, fn] = jobs.entries().next().value; jobs.delete(key); fn();} };
    return {layer, requests, flush, timeouts};
}
{
    const f = fixture(['pending', true]); let completed = 0;
    f.layer.createTile({z: 8, x: 50, y: -54}, (error) => { assert.equal(error, null); completed++; });
    f.timeouts.values().next().value(); f.flush();
    assert.equal(completed, 1); assert.equal(f.requests.length, 2); assert.equal(f.timeouts.size, 0);
}
{
    const f = fixture([false, true]); let completed = 0;
    f.layer.createTile({z: 8, x: 50, y: -54}, (error) => { assert.equal(error, null); completed++; });
    f.flush();
    assert.equal(completed, 1);
    assert.deepEqual(f.requests, ['primary/0/8/50/54.png', 'fallback/0/8/50/54.png']);
    assert.equal(f.timeouts.size, 0);
}
{
    const f = fixture([]); let completed = 0;
    f.layer.createTile({z: 8, x: 99, y: -99}, (error) => { assert.equal(error, null); completed++; });
    f.flush(); assert.equal(completed, 1);
    assert.ok(f.requests[0].startsWith('data:')); assert.equal(f.requests.length, 1);
}
{
    const f = fixture([false, false, false]); let completed = 0;
    f.layer.createTile({z: 8, x: 50, y: -54}, (error) => { assert.ok(error); completed++; });
    f.flush(); assert.equal(completed, 1); assert.equal(f.requests.length, 3);
}
{
    const f = fixture([false]); let completed = 0;
    const tile = f.layer.createTile({z: 8, x: 50, y: -54}, () => {completed++;});
    f.layer.events.tileunload({tile}); f.flush();
    assert.equal(completed, 0); assert.equal(f.timeouts.size, 0); assert.equal(f.requests.length, 1);
}
console.log('Tile retry, timeout fallback, known-empty coverage, exhausted retries, and cancelled-view tests passed.');
