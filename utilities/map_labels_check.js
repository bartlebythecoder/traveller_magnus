/**
 * map_labels_check.js — placeable border and region names (v0.18.3), in the real app.
 *
 * Rulings (directives/project_manifest.md §0.0.D, Sean 2026-11-14): Alt + drag on a
 * border/region name moves it, plain drag still pans; a placed name prints once in
 * exports, on its own subsector's map; both kinds of name; saved with the map;
 * undoable; right-click > RESET NAME POSITION; the stale-label bug fixed.
 *
 * Usage, from the repo root:   node utilities/map_labels_check.js
 * Companion: utilities/map_symbols_pixels.js --labels proves unplaced names are
 * drawn exactly as before.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp } = require('./route_test_common');

let pass = 0, fail = 0;
function check(name, ok, detail) {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''}`); }
}

const FIXTURE = function () {
    hexStates.clear();
    selectedHexes.clear();
    window.undoStack = []; window.redoStack = [];
    window.activeFilterRules = [];
    for (let q = 0; q < 16; q++) for (let r = 0; r < 20; r++) {
        hexStates.set(getHexId(q, r), { type: 'BLANK', cluster: (q < 8 && r < 12) ? 'Spinward Reach' : '----' });
    }
    window.regionDefinitions = [
        { id: 1, name: 'Spinward Reach', color: '#ff8800', visible: true },
        { id: 2, name: 'Region 2', color: '#00ccff', visible: true },
    ];
    window.borderDefinitions = [
        { id: 1, name: 'Imperium', color: '#ff2222', visible: true },
        { id: 2, name: 'Border 2', color: '#44ff44', visible: true },
    ];
    window.hexBorderAssignments = new Map();
    for (let q = 8; q < 16; q++) for (let r = 0; r < 10; r++) window.hexBorderAssignments.set(getHexId(q, r), 1);
    window.regionNamesEnabled = true;
    window.borderNamesEnabled = true;
    window.invalidateMapLabelCaches();
    zoom = 1; cameraX = -60; cameraY = -60;
    draw();
};

(async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'labels-'));
    const { browser, page } = await launchApp();
    page.on('dialog', d => d.accept());
    await page.waitForTimeout(900);
    // The splash screen fades out over the map and eats mouse events until it
    // has gone; wait until the canvas is really what the mouse lands on.
    await page.waitForFunction(() => document.elementFromPoint(800, 500) &&
        document.elementFromPoint(800, 500).id === 'map-canvas', null, { timeout: 15000 });
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const hitOf = (kind) => ev((kind) => { draw(); const h = getMapLabelHits().find(x => x.kind === kind);
        return h ? { cx: h.cx, cy: h.cy, sx: (h.cx - cameraX) * zoom, sy: (h.cy - cameraY) * zoom, name: h.def.name } : null; }, kind);
    await ev(`(${FIXTURE.toString()})()`);

    console.log('Unplaced names');
    let r = await ev(() => getMapLabelHits().map(h => h.kind + ':' + h.def.name));
    check('both names drawn and grabbable', r.includes('region:Spinward Reach') && r.includes('border:Imperium'), r);

    console.log('Stale-label bug');
    const before = await hitOf('region');
    r = await ev(() => {
        // Move the region to q 8-15 through the real Assign Region path.
        hexStates.forEach(s => { s.cluster = '----'; });
        selectedHexes.clear();
        for (let q = 8; q < 16; q++) for (let r = 10; r < 20; r++) selectedHexes.add(getHexId(q, r));
        // Clear first via the cluster field, then assign: hex count never changes.
        window.confirmAssignRegion(1);
        selectedHexes.clear();
        draw();
        const h = getMapLabelHits().find(x => x.kind === 'region');
        return h ? { cx: h.cx, cy: h.cy } : null;
    });
    check('reassigning a region moves its name (hex count unchanged)', r && r.cx > before.cx + 200 && r.cy > before.cy, { before, after: r });
    r = await ev(() => {
        window.renderRegionWindow();
        const input = document.querySelector('#region-window-list .border-row .border-name-input');
        input.value = 'Outer Reach'; input.dispatchEvent(new Event('change'));
        draw();
        return getMapLabelHits().filter(h => h.kind === 'region').map(h => h.def.name);
    });
    check('renaming a region shows the new name at once', r.includes('Outer Reach'), r);
    r = await ev(() => {
        selectedHexes.clear();
        for (let q = 0; q < 8; q++) for (let r = 0; r < 10; r++) selectedHexes.add(getHexId(q, r));
        window.confirmAssignBorder(1);   // Imperium now also covers q 0-7
        selectedHexes.clear();
        draw();
        const h = getMapLabelHits().find(x => x.kind === 'border');
        return h ? h.cx : null;
    });
    const borderAfterAssign = r;
    // Imperium was q 8-15 (centroid q 11.5); with q 0-7 added the centroid is q 7.5.
    const ws = await ev(() => 1.5 * baseHexSize);
    check('assigning more hexes to a border moves its name', r !== null && Math.abs(r - 7.5 * ws) < 1, { r, expected: 7.5 * ws });
    r = await ev(() => {
        // Move 40 hexes from border 1 to border 2: the assignment count is unchanged.
        selectedHexes.clear();
        for (let q = 0; q < 8; q++) for (let r = 0; r < 5; r++) selectedHexes.add(getHexId(q, r));
        window.confirmAssignBorder(2);
        selectedHexes.clear();
        draw();
        return getMapLabelHits().filter(h => h.kind === 'border').map(h => h.def.name + '@' + Math.round(h.cx));
    });
    check('reassigning border hexes (same count) updates both names', r.some(s => s.startsWith('Border 2@')), r);

    // Fresh fixture for the interaction checks.
    await ev(`(${FIXTURE.toString()})()`);

    console.log('Alt + drag');
    let h0 = await hitOf('region');
    const cam0 = await ev(() => [cameraX, cameraY]);
    await page.mouse.move(h0.sx, h0.sy);
    await page.keyboard.down('Alt');
    await page.mouse.move(h0.sx + 1, h0.sy);   // hover with Alt held
    const cursor = await ev(() => document.getElementById('map-canvas').style.cursor);
    check('Alt over a name shows the move cursor', cursor === 'move', cursor);
    await page.mouse.down();
    await page.mouse.move(h0.sx + 150, h0.sy + 80, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    r = await ev(() => ({ pos: window.regionDefinitions[0].labelPos, cam: [cameraX, cameraY], undo: window.undoStack.length,
        top: window.undoStack[window.undoStack.length - 1] && window.undoStack[window.undoStack.length - 1].action }));
    let h1 = await hitOf('region');
    check('Alt + drag stores a position on the region', r.pos && typeof r.pos.hex === 'string', r.pos);
    // Pressed at sx + 1 (after the hover), released at sx + 150: moved 149 x 80.
    check('the name follows the mouse', Math.abs(h1.cx - (h0.cx + 149)) < 1e-6 && Math.abs(h1.cy - (h0.cy + 80)) < 1e-6, { h0, h1 });
    check('the map did not pan', r.cam[0] === cam0[0] && r.cam[1] === cam0[1], r.cam);
    check('one undo entry, named for the move', r.undo === 1 && /Move Spinward Reach name/.test(r.top), r);

    const b0 = await hitOf('border');
    await page.keyboard.down('Alt');
    await page.mouse.move(b0.sx, b0.sy); await page.mouse.down();
    await page.mouse.move(b0.sx - 100, b0.sy + 40, { steps: 5 }); await page.mouse.up();
    await page.keyboard.up('Alt');
    r = await ev(() => window.borderDefinitions[0].labelPos);
    check('border names move the same way', r && typeof r.hex === 'string', r);

    await page.mouse.move(h1.sx, h1.sy); await page.mouse.down();
    await page.mouse.move(h1.sx + 60, h1.sy + 30, { steps: 4 }); await page.mouse.up();
    r = await ev(() => ({ cam: [cameraX, cameraY], pos: window.regionDefinitions[0].labelPos }));
    check('a plain drag on a name pans the map instead', r.cam[0] !== cam0[0], r);
    let h2 = await hitOf('region');
    check('...and leaves the placed name where it was on the map', Math.abs(h2.cx - h1.cx) < 1e-6 && Math.abs(h2.cy - h1.cy) < 1e-6, { h1, h2 });

    await ev(() => { zoom = 1; cameraX = -60; cameraY = -60; draw(); });
    await page.keyboard.down('Alt');
    await page.mouse.move(1200, 900); await page.mouse.down();
    await page.mouse.move(1100, 850, { steps: 4 }); await page.mouse.up();
    await page.keyboard.up('Alt');
    r = await ev(() => [cameraX, cameraY]);
    check('Alt + drag away from any name still pans', r[0] !== -60, r);

    console.log('Panning');
    r = await ev(() => {
        zoom = 1;
        const xOf = (name, camX, camY) => { cameraX = camX; cameraY = camY; draw();
            const h = getMapLabelHits().find(x => x.def.name === name); return h ? h.cx : null; };
        // Region 1 (q 0-7, placed) and a new unplaced Region 2 (q 8-15, r 12-19).
        for (let q = 8; q < 16; q++) for (let r = 12; r < 20; r++) hexStates.get(getHexId(q, r)).cluster = 'Region 2';
        window.invalidateMapLabelCaches();
        const ws = 1.5 * baseHexSize;
        const placedX = window.getPlacedLabelCentre(window.regionDefinitions[0]).x;
        // Pan so each area runs off the left edge, past its centroid but not past its name.
        const p1 = xOf('Spinward Reach', -60, -60), p2 = xOf('Spinward Reach', placedX - 100, -60);
        const a1 = xOf('Region 2', -60, 900), a2 = xOf('Region 2', 12 * ws, 900);
        return { placedX, p1, p2, a1, a2, edge: 12 * ws };
    });
    check('a placed name keeps its spot when panning', r.p1 === r.placedX && r.p2 === r.placedX, r);
    check('an unplaced name still slides to stay on screen', r.a1 !== null && r.a2 === r.edge && r.a1 !== r.a2, r);

    console.log('Undo, redo, reset');
    await ev(() => { zoom = 1; cameraX = -60; cameraY = -60; window.undoStack = []; window.redoStack = []; draw(); });
    const before2 = await ev(() => JSON.stringify(window.regionDefinitions[0].labelPos));
    h0 = await hitOf('region');
    await page.keyboard.down('Alt');
    await page.mouse.move(h0.sx, h0.sy); await page.mouse.down();
    await page.mouse.move(h0.sx + 70, h0.sy, { steps: 4 }); await page.mouse.up();
    await page.keyboard.up('Alt');
    const moved = await ev(() => JSON.stringify(window.regionDefinitions[0].labelPos));
    await page.mouse.move(5, 500);
    await page.keyboard.press('Control+z');
    r = await ev(() => JSON.stringify(window.regionDefinitions[0].labelPos));
    check('Ctrl+Z puts the name back', r === before2 && moved !== before2, { before2, moved, r });
    await page.keyboard.press('Control+Shift+z');
    r = await ev(() => JSON.stringify(window.regionDefinitions[0].labelPos));
    check('Ctrl+Shift+Z moves it again', r === moved, { moved, r });

    h0 = await hitOf('region');
    await page.mouse.click(h0.sx, h0.sy, { button: 'right' });
    r = await ev(() => getComputedStyle(document.getElementById('ctx-reset-label')).display);
    check('right-click a placed name offers RESET NAME POSITION', r !== 'none', r);
    await page.click('#ctx-reset-label');
    r = await ev(() => ({ has: 'labelPos' in window.regionDefinitions[0], top: window.undoStack[window.undoStack.length - 1].action }));
    check('reset returns it to automatic placement (undoable)', !r.has && /Reset Spinward Reach name position/.test(r.top), r);
    h0 = await hitOf('region');
    await page.mouse.click(h0.sx, h0.sy, { button: 'right' });
    r = await ev(() => getComputedStyle(document.getElementById('ctx-reset-label')).display);
    check('right-click an unplaced name does not offer it', r === 'none', r);
    await page.keyboard.press('Escape');

    console.log('Exports (captureSubsector)');
    r = await ev(async () => {
        // Region 1 covers q 0-7, r 0-11: subsectors A (r 0-9) and E (r 10-19).
        window.invalidateMapLabelCaches();
        const count = async (sub) => {
            let n = 0; const orig = CanvasRenderingContext2D.prototype.fillText;
            // Count only the export canvas: live-map frames queued meanwhile draw it too.
            const live = document.getElementById('map-canvas');
            CanvasRenderingContext2D.prototype.fillText = function (t) { if (t === 'SPINWARD REACH' && this.canvas !== live) n++; return orig.apply(this, arguments); };
            try { await captureSubsector(1, sub, 900, 1000); } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
            return n;
        };
        const auto = { A: await count('A'), E: await count('E') };
        window.regionDefinitions[0].labelPos = { hex: getHexId(3, 4), dx: 5, dy: -7 };
        const placed = { A: await count('A'), E: await count('E') };
        window.regionDefinitions[0].labelPos = { hex: getHexId(3, 14), dx: 0, dy: 0 };
        const placedE = { A: await count('A'), E: await count('E') };
        delete window.regionDefinitions[0].labelPos;
        return { auto, placed, placedE, hitsAfter: getMapLabelHits().length };
    });
    check('unplaced: printed on every subsector map the region touches (as before)', r.auto.A === 1 && r.auto.E === 1, r);
    check('placed in A: printed on A only', r.placed.A === 1 && r.placed.E === 0, r);
    check('placed in E: printed on E only', r.placedE.A === 0 && r.placedE.E === 1, r);

    console.log('Saving');
    await ev(() => { window.regionDefinitions[0].labelPos = { hex: getHexId(2, 3), dx: 12.5, dy: -4 };
        window.borderDefinitions[0].labelPos = { hex: getHexId(10, 2), dx: -3, dy: 8 }; delete window.showSaveFilePicker; });
    const [download] = await Promise.all([page.waitForEvent('download'),
        ev(() => document.getElementById('btn-save-map').click())]);
    const saved = path.join(tmp, 'map.json');
    await download.saveAs(saved);
    const json = JSON.parse(fs.readFileSync(saved, 'utf8'));
    const rp = json.regionDefinitions.find(d => d.name === 'Spinward Reach').labelPos;
    const bp = json.borderDefinitions.find(d => d.name === 'Imperium').labelPos;
    check('save file holds the region name position', rp && rp.dx === 12.5 && rp.hex === '1-A-0304', rp);
    check('save file holds the border name position', bp && bp.dy === 8 && bp.hex === '1-B-1103', bp);

    await ev(() => { delete window.regionDefinitions[0].labelPos; delete window.borderDefinitions[0].labelPos; });
    await page.evaluate(() => { window.__loaded = false; const o = window.applyLoadedMapData;
        window.applyLoadedMapData = function (...a) { const res = o.apply(this, a); window.__loaded = true; return res; }; });
    await page.setInputFiles('#file-load-map', saved);
    await page.waitForFunction(() => window.__loaded === true, null, { timeout: 30000 });
    r = await ev(() => { window.regionNamesEnabled = true; window.borderNamesEnabled = true; zoom = 1; cameraX = -60; cameraY = -60; draw();
        const rd = window.regionDefinitions.find(d => d.name === 'Spinward Reach'), bd = window.borderDefinitions.find(d => d.name === 'Imperium');
        const h = getMapLabelHits().find(x => x.def === rd); const c = getPlacedLabelCentre(rd);
        return { rp: rd.labelPos, bp: bd.labelPos, drawnAt: h && [h.cx, h.cy], placed: c && [c.x, c.y] }; });
    check('loading it puts both names back where they were', r.rp && r.rp.dx === 12.5 && r.bp && r.bp.dy === 8 &&
        r.drawnAt && r.drawnAt[0] === r.placed[0] && r.drawnAt[1] === r.placed[1], r);

    r = await ev(async () => { await new Promise(res => setTimeout(res, 1500));
        return true; });
    await page.reload();
    await page.click('#btn-launch-app');
    await page.waitForFunction(() => typeof window.getMapLabelHits === 'function');
    await page.waitForTimeout(1200);
    r = await ev(() => { const rd = (window.regionDefinitions || []).find(d => d.name === 'Spinward Reach');
        const bd = (window.borderDefinitions || []).find(d => d.name === 'Imperium'); return { rp: rd && rd.labelPos, bp: bd && bd.labelPos }; });
    check('the browser autosave keeps them across a reload', r.rp && r.rp.dx === 12.5 && r.bp && r.bp.dy === 8, r);

    console.log('Older and odd saves');
    const solo = path.resolve(__dirname, '..', 'sectors', 'solo_6.json');
    await page.evaluate(() => { window.__loaded = false; const o = window.applyLoadedMapData;
        window.applyLoadedMapData = function (...a) { const res = o.apply(this, a); window.__loaded = true; return res; }; });
    await page.setInputFiles('#file-load-map', solo);
    await page.waitForFunction(() => window.__loaded === true, null, { timeout: 120000 });
    r = await ev(() => { window.regionNamesEnabled = true; window.borderNamesEnabled = true; draw();
        return { placed: [...(window.regionDefinitions || []), ...(window.borderDefinitions || [])].filter(d => d.labelPos).length,
                 defs: (window.regionDefinitions || []).length + (window.borderDefinitions || []).length }; });
    check('solo_6.json (v0.13.3) loads with every name automatic', r.placed === 0 && r.defs > 0, r);
    r = await ev(() => {
        const d = window.regionDefinitions[0];
        const bad = [{ hex: 'nonsense', dx: 1, dy: 1 }, { hex: getHexId(1, 1), dx: 'x', dy: 0 }, { dx: 1, dy: 1 }, null, 7];
        const out = bad.map(p => { d.labelPos = p; try { draw(); return getPlacedLabelCentre(d) === null; } catch (e) { return 'threw ' + e.message; } });
        delete d.labelPos; draw();
        return out;
    });
    check('a damaged position falls back to automatic, never throws', r.every(x => x === true), r);

    check('no page errors', page._errors.length === 0, page._errors);
    await browser.close();
    console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} ${pass}/${pass + fail}`);
    process.exitCode = fail === 0 ? 0 : 1;
})();
