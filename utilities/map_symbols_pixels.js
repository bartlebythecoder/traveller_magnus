/**
 * map_symbols_pixels.js — pixel fingerprint of the hex map's world symbols.
 *
 * Proves a refactor of the map's drawing code changed NOTHING on screen or in
 * the exporters' subsector images. It builds a frozen synthetic map that uses
 * every icon style, colour stack, ring, background fill, text style, gas giant
 * (plain and ringed), scout/naval base and travel zone, then hashes the live
 * canvas at several zoom levels (both the full-icon and the low-zoom paths), in
 * dark and White Background Mode, in Development view, and hashes the PNGs
 * captureSubsector() returns (the same draw() the HTML/Obsidian exports use).
 *
 * Written for v0.18.3 (map legend), when the icon drawing was lifted out of
 * draw() into shared functions so the legend draws its swatches with the map's
 * own code.
 *
 * Usage, from the repo root:
 *   node utilities/map_symbols_pixels.js --out before.json
 *   ... change the renderer ...
 *   node utilities/map_symbols_pixels.js --out after.json --compare before.json
 *
 * Run both sides on the same machine and browser build: canvas antialiasing can
 * differ between GPUs, so a baseline from another machine proves nothing.
 */

const fs = require('fs');
const crypto = require('crypto');
const { launchApp } = require('./route_test_common');

const args = process.argv.slice(2);
const argVal = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = argVal('--out');
const COMPARE = argVal('--compare');
// --named: every world gets a name (same RNG stream, so the map is otherwise
// identical). Used to prove a change touched only unnamed worlds.
const ALL_NAMED = args.includes('--named');
// --labels: also lay two regions and two borders over the fixture and show
// their names (v0.18.3 placeable names). Its own baseline; do not mix with a run
// taken without it.
const LABELS = args.includes('--labels');

// Built in the page. A frozen LCG, NOT the app's mulberry32, so the fixture
// cannot move when the app's generators do.
const BUILD = function (allNamed, labels) {
    let _s = 20261114 >>> 0;
    const rnd = () => { _s = (Math.imul(1664525, _s) + 1013904223) >>> 0; return _s / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)];

    // Stop the default-rule injection and any rule pass from rewriting custom_ui.
    window.activeFilterRules = [];
    window.sectorRoutes = [];
    hexStates.clear();
    selectedHexes.clear();

    const STYLES = [undefined, 'Classic', 'Asteroid Belt', 'Rounded Rectangle', 'Square',
                    'Diamond', 'Octagon', 'Asteroid Grid', 'Refined', 'Minimal'];
    const COLS = ['#ff3355', '#33ff88', '#3388ff', '#ffcc00', '#cc44ff'];
    const ZONES = ['Green', 'Green', 'Amber', 'Red', 'G', undefined];
    let i = 0;
    for (let q = 0; q < 16; q++) {
        for (let r = 0; r < 20; r++) {
            const id = getHexId(q, r);
            if (!id) continue;
            const roll = rnd();
            if (roll < 0.12) continue;                                // no entry
            if (roll < 0.18) { hexStates.set(id, { type: 'BLANK' }); continue; }
            if (roll < 0.22) { hexStates.set(id, { type: 'EMPTY', custom_ui: { appliedColors: [], bgFillColor: '#004488' } }); continue; }
            if (roll < 0.25) { hexStates.set(id, { type: 'SYSTEM_PRESENT' }); continue; } // no data yet
            i++;
            const nCol = Math.floor(rnd() * 4);
            const applied = [];
            for (let c = 0; c < nCol; c++) applied.push(pick(COLS));
            const custom = { appliedColors: applied };
            const st = STYLES[i % STYLES.length];
            if (st) custom.iconStyle = st;
            if (rnd() < 0.3) custom.ringColor = pick(COLS);
            if (rnd() < 0.2) custom.bgFillColor = pick(COLS);
            if (rnd() < 0.2) custom.textCase = pick(['ALL CAPS', 'lowercase']);
            if (rnd() < 0.2) custom.isItalic = true;
            if (rnd() < 0.2) custom.isUnderline = true;

            const sa = rnd() < 0.35;
            const data = {
                name: (rnd() < 0.85 || allNamed) ? ('World ' + q + '-' + r) : undefined,
                uwp: 'A788899-C',
                starport: pick(['A', 'B', 'C', 'D', 'E', 'X', undefined]),
                gasGiant: rnd() < 0.6,
                navalBase: rnd() < 0.3,
                scoutBase: rnd() < 0.35,
                travelZone: pick(ZONES),
                tradeCodes: sa ? ['Sa', 'Ag'] : ['Ag'],
            };
            if (sa) data.parentType = pick(['Gas Giant', 'Terrestrial Planet', undefined]);
            const state = { type: 'SYSTEM_PRESENT', mgt2eData: data, custom_ui: custom };
            if (rnd() < 0.05) state.isHiddenByFilter = true;
            hexStates.set(id, state);
        }
    }
    if (labels) {
        window.regionDefinitions = [
            { id: 1, name: 'Spinward Reach', color: '#ff8800', visible: true },
            { id: 2, name: 'Core Worlds', color: '#00ccff', visible: true },
        ];
        window.borderDefinitions = [
            { id: 1, name: 'Imperium', color: '#ff2222', visible: true },
            { id: 2, name: 'Zhodani', color: '#44ff44', visible: true },
        ];
        window.hexBorderAssignments = new Map();
        for (let q = 0; q < 16; q++) for (let r = 0; r < 20; r++) {
            const id = getHexId(q, r);
            window.hexBorderAssignments.set(id, r < 10 ? 1 : 2);
            const st = hexStates.get(id);
            if (st && typeof st === 'object') st.cluster = (q < 8 && r < 12) ? 'Spinward Reach' : (q >= 9 && r >= 8) ? 'Core Worlds' : '----';
        }
        window.regionNamesEnabled = true;
        window.borderNamesEnabled = true;
        if (typeof window.invalidateBorderNamesCache === 'function') window.invalidateBorderNamesCache();
    }
    selectedHexes.add(getHexId(3, 4));
    return i;
};

const SHOT = function (cfg) {
    window.printMode = !!cfg.print;
    devView = !!cfg.dev;
    window.ringedGasGiantSatellites = cfg.ringed !== false;
    zoom = cfg.zoom; cameraX = cfg.camX; cameraY = cfg.camY;
    draw();
    const c = document.getElementById('map-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // FNV-1a over the raw pixels.
    let h = 0x811c9dc5;
    for (let k = 0; k < d.length; k++) { h ^= d[k]; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16) + ':' + c.width + 'x' + c.height;
};

(async () => {
    const { browser, page } = await launchApp();
    // Let the 500 ms default-rule injection fire first, then build over it.
    await page.waitForTimeout(900);
    const worlds = await page.evaluate(`(${BUILD.toString()})(${ALL_NAMED}, ${LABELS})`);

    const views = [];
    for (const print of [false, true]) {
        for (const [zoomV, camX, camY] of [[1, -60, -60], [2, 200, 150], [0.6, -40, -40],
                                            [0.25, -40, -40], [0.1, -40, -40], [0.05, -40, -40]]) {
            views.push({ print, zoom: zoomV, camX, camY });
        }
        views.push({ print, zoom: 1, camX: -60, camY: -60, ringed: false });
        views.push({ print, zoom: 1, camX: -60, camY: -60, dev: true });
    }

    const result = { worlds, shots: {}, captures: {} };
    for (const v of views) {
        const key = JSON.stringify(v);
        result.shots[key] = await page.evaluate(`(${SHOT.toString()})(${JSON.stringify(v)})`);
    }
    for (const print of [false, true]) {
        for (const sub of ['A', 'B', 'E', 'F']) {
            const b64 = await page.evaluate(async ({ print, sub }) => {
                window.printMode = print; devView = false; window.ringedGasGiantSatellites = true;
                const png = await captureSubsector(1, sub, 900, 1000);
                let s = ''; for (let k = 0; k < png.length; k++) s += String.fromCharCode(png[k]);
                return btoa(s);
            }, { print, sub });
            result.captures[`${print ? 'print' : 'dark'}-${sub}`] =
                crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 16);
        }
    }
    // Players' export maps (WP6 disclosure gate): every hex at one level, and a
    // per-hex mix of all of them.
    for (const lvl of ['a', 'b', 'c', 'd', 'e', 'g', 'mix']) {
        const b64 = await page.evaluate(async (lvl) => {
            window.printMode = false; devView = false; window.ringedGasGiantSatellites = true;
            const L = ['0', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
            const fn = lvl === 'mix'
                ? (id => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return L[h % L.length]; })
                : (() => lvl);
            const png = await captureSubsector(1, 'A', 900, 1000, { disclosure: fn });
            let s = ''; for (let k = 0; k < png.length; k++) s += String.fromCharCode(png[k]);
            return btoa(s);
        }, lvl);
        result.captures['disclosure-' + lvl] =
            crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 16);
    }
    result.errors = page._errors;
    await browser.close();

    if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(`worlds=${worlds} shots=${Object.keys(result.shots).length} captures=${Object.keys(result.captures).length} pageErrors=${result.errors.length}`);
    if (result.errors.length) console.log(result.errors.join('\n'));

    if (COMPARE) {
        const base = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
        let diff = 0, n = 0;
        for (const group of ['shots', 'captures']) {
            for (const k of Object.keys(base[group])) {
                n++;
                if (base[group][k] !== result[group][k]) {
                    diff++;
                    console.log(`DIFF ${group} ${k}: ${base[group][k]} -> ${result[group][k]}`);
                }
            }
        }
        console.log(diff === 0 ? `PASS ${n}/${n} identical` : `FAIL ${diff}/${n} differ`);
        process.exitCode = diff === 0 ? 0 : 1;
    }
})();
