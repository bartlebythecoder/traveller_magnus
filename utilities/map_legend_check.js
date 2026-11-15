/**
 * map_legend_check.js — the v0.18.3 Map Legend, driven in the real app.
 *
 * Builds small synthetic maps, runs the app's REAL rule pass (reapplyAllRules)
 * and checks what the legend window lists, against the rulings in
 * directives/project_manifest.md §0.0.D: whole map, world symbols + filter rules
 * only, optional rule name, on/off saved with the map.
 *
 * Usage, from the repo root:
 *   node utilities/map_legend_check.js
 *   node utilities/map_legend_check.js --perf      (adds a Universe-sized scan timing)
 *
 * Companion: utilities/map_symbols_pixels.js proves the map itself is unchanged.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchApp } = require('./route_test_common');

const PERF = process.argv.includes('--perf');
let pass = 0, fail = 0;
function check(name, ok, detail) {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''}`); }
}

// In-page helpers, installed once.
const HELPERS = function () {
    window.__w = (q, r, fields) => {
        const id = getHexId(q, r);
        hexStates.set(id, { type: 'SYSTEM_PRESENT', mgt2eData: Object.assign({
            name: 'W' + q + '_' + r, uwp: 'A788899-C', starport: 'A', tradeCodes: [],
        }, fields || {}) });
        return id;
    };
    window.__reset = () => {
        hexStates.clear();
        window.activeFilterRules = [];
        window.filterSuspended = false;
        window.ringedGasGiantSatellites = true;
        devView = false;
        window.reapplyAllRules();
        window.renderRulesLedger();
    };
    // Rescan now (no debounce) and return the legend's labels, in order.
    window.__labels = () => {
        window.renderMapLegend();
        return Array.from(document.querySelectorAll('#map-legend-list .map-legend-label, #map-legend-list .map-legend-empty'))
            .map(e => e.textContent);
    };
    window.__rule = (id, filters, style) => Object.assign({ id, filters, color: null, ringColor: null,
        iconStyle: null, textCase: null, bgFillColor: null, isItalic: false, isUnderline: false,
        description: window.generateFilterDescription(filters) }, style);
};

(async () => {
    const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'legend-'));
    const { browser, page } = await launchApp();
    await page.waitForTimeout(900);              // let the default-rule injection run
    await page.evaluate(`(${HELPERS.toString()})()`);
    const ev = (fn, arg) => page.evaluate(fn, arg);

    console.log('Setting');
    check('off on a fresh browser', await ev(() => window.mapLegendEnabled === false &&
        !document.getElementById('toggle-map-legend').checked &&
        !document.getElementById('map-legend').classList.contains('visible')));
    await ev(() => document.getElementById('toggle-map-legend').click());
    check('tick-box shows the window', await ev(() => window.mapLegendEnabled === true &&
        document.getElementById('map-legend').classList.contains('visible') &&
        localStorage.getItem('traveller_map_legend') === 'true'));

    console.log('Map symbols');
    let r;
    let L = await ev(() => { __reset(); return __labels(); });
    check('empty map says so', L.length === 1 && /Nothing on the map/.test(L[0]), L);

    L = await ev(() => { __reset(); __w(1, 1); return __labels(); });
    check('plain world -> World only', JSON.stringify(L) === JSON.stringify(['World']), L);

    L = await ev(() => { __reset(); __w(1, 1, { gasGiant: true }); return __labels(); });
    check('gas giant, not a satellite -> plain gas giant', L.includes('Gas giant present') &&
        !L.some(s => /satellite/.test(s)), L);

    L = await ev(() => { __reset(); __w(1, 1, { gasGiant: true, tradeCodes: ['Sa'], parentType: 'Gas Giant' }); return __labels(); });
    check('Sa around a gas giant -> ringed entry only', L.includes('Gas giant (mainworld is its satellite)') &&
        !L.includes('Gas giant present'), L);
    L = await ev(() => { window.ringedGasGiantSatellites = false; return __labels(); });
    check('ringed option off -> plain entry', L.includes('Gas giant present') &&
        !L.some(s => /satellite/.test(s)), L);

    L = await ev(() => { __reset(); __w(1, 1, { gasGiant: true, tradeCodes: ['Sa'], parentType: 'Terrestrial Planet' }); return __labels(); });
    check('Sa around a big world -> plain entry', L.includes('Gas giant present') && !L.some(s => /satellite/.test(s)), L);

    // An unnamed world (a blank-named TravellerMap import) keeps its symbols, on the
    // map and in the legend. Until the v0.18.3 fix draw() hid them with the name.
    r = await ev(() => {
        __reset(); __w(1, 1, { name: '', scoutBase: true, navalBase: true, gasGiant: true });
        const names = ['drawGasGiantSymbol', 'drawNavalBaseSymbol', 'drawScoutBaseSymbol'];
        const orig = names.map(n => window[n]); const drawn = [];
        names.forEach((n, i) => { window[n] = function (...a) { drawn.push(n); return orig[i].apply(this, a); }; });
        zoom = 1; cameraX = -60; cameraY = -60; draw();
        names.forEach((n, i) => { window[n] = orig[i]; });
        return { drawn, labels: __labels() };
    });
    check('unnamed world: map draws its gas giant and both bases', r.drawn.length === 3, r);
    check('unnamed world: legend lists them', r.labels.includes('Scout base') && r.labels.includes('Naval base') &&
        r.labels.includes('Gas giant present'), r);
    L = await ev(() => { __reset(); __w(1, 1, { scoutBase: true }); __w(2, 2, { navalBase: true }); return __labels(); });
    check('named worlds: scout + naval base', L.includes('Scout base') && L.includes('Naval base'), L);

    L = await ev(() => { __reset(); __w(1, 1, { travelZone: 'Amber' }); __w(2, 2, { travelZone: 'Red' }); __w(3, 3, { travelZone: 'Green' }); return __labels(); });
    check('Amber and Red zones', L.includes('Amber Zone') && L.includes('Red Zone'), L);

    L = await ev(() => { __reset(); __w(1, 1, { scoutBase: true }); __w(30, 38, { navalBase: true }); return __labels(); });
    check('whole map: a world far off screen still counts', L.includes('Naval base'), L);

    L = await ev(() => { __reset(); const id = __w(1, 1, { navalBase: true }); hexStates.get(id).isHiddenByFilter = true; __w(2, 2); return __labels(); });
    check('world hidden by the filter does not count', !L.includes('Naval base'), L);
    L = await ev(() => { window.filterSuspended = true; return __labels(); });
    check('...but does while Shift+F shows everything', L.includes('Naval base'), L);

    L = await ev(() => { __reset(); __w(1, 1, { navalBase: true, isStellarOnly: true }); return __labels(); });
    check('stellar-only system (hidden by default) does not count', !L.includes('Naval base'), L);

    console.log('Styling rules');
    L = await ev(() => {
        __reset();
        __w(1, 1, { tradeCodes: ['Wa'] }); __w(2, 2, { tradeCodes: ['Ag'] }); __w(3, 3, { tradeCodes: ['Ag'] });
        window.activeFilterRules = [
            __rule('r_wa', { tradeCodes: 'Wa' }, { color: '#46b4e8', name: 'Water worlds' }),
            __rule('r_none', { tradeCodes: 'Zz' }, { color: '#ff0000', name: 'Nobody' }),
            __rule('r_ag', { tradeCodes: 'Ag' }, { ringColor: '#ffcc00' }),
        ];
        window.reapplyAllRules();
        return __labels();
    });
    check('named rule listed by its name', L.includes('Water worlds'), L);
    check('rule matching nothing is not listed', !L.includes('Nobody'), L);
    check('unnamed rule falls back to its description', L.includes('Codes: Ag'), L);
    check('rules listed after the symbols', L.indexOf('World') < L.indexOf('Water worlds'), L);

    r = await ev(() => { window.ruleMatchesByHex = undefined; const l = __labels();
        return { l, rebuilt: window.ruleMatchesByHex instanceof Map }; });
    check('no rule pass yet this session (autosave reopen) -> runs one, lists rules',
        r.l.includes('Water worlds') && r.rebuilt, r);

    L = await ev(() => { window.toggleFilterRuleVisibility('r_wa'); return __labels(); });
    check('rule switched off (eye) is not listed', !L.includes('Water worlds'), L);

    L = await ev(() => {
        __reset(); __w(1, 1, { tradeCodes: ['Ag'] });
        window.activeFilterRules = [
            __rule('r_sq', { tradeCodes: 'Ag' }, { iconStyle: 'Square', name: 'Square rule' }),
            __rule('r_di', { tradeCodes: 'Ag' }, { iconStyle: 'Diamond', name: 'Diamond rule' }),
        ];
        window.reapplyAllRules();
        return __labels();
    });
    check('rule completely overridden by a later one is not listed',
        L.includes('Diamond rule') && !L.includes('Square rule'), L);

    L = await ev(() => {
        __reset(); const id = __w(1, 1, { tradeCodes: ['Ag'] });
        window.activeFilterRules = [__rule('r_bg', { tradeCodes: 'Ag' }, { bgFillColor: '#005500', name: 'Fill rule' })];
        window.reapplyAllRules();
        hexStates.get(id).isHiddenByFilter = true;
        return __labels();
    });
    check('hex-fill rule on a hidden world still listed (fill is still painted)', L.includes('Fill rule'), L);

    console.log('Rule names in the Rules Ledger');
    await ev(() => {
        __reset(); __w(1, 1, { tradeCodes: ['Ag'] });
        window.activeFilterRules = [__rule('r_ag', { tradeCodes: 'Ag' }, { color: '#33ff88' })];
        window.reapplyAllRules(); window.renderRulesLedger();
        // The ledger lives in the Filter window's Advanced Styling pane: open both,
        // as a user would, or the rename field cannot take focus.
        document.getElementById('filter-modal').classList.add('visible');
        document.getElementById('filter-right-pane').style.display = 'block';
    });
    await page.evaluate(() => document.querySelector('#active-rules-list .rule-rename').click());
    await page.keyboard.type('Farm worlds <b>x</b>');
    await page.keyboard.press('Enter');
    r = await ev(() => ({ name: window.activeFilterRules[0].name, labels: __labels(),
        ledger: document.querySelector('#active-rules-list .rule-label').textContent,
        bold: !!document.querySelector('#active-rules-list b') }));
    check('rename via the pencil sets rule.name', r.name === 'Farm worlds <b>x</b>', r);
    check('legend shows the new name, as text not markup', r.labels.includes('Farm worlds <b>x</b>') && !r.bold, r);
    check('ledger shows the name', r.ledger === 'Farm worlds <b>x</b>', r);
    await page.evaluate(() => document.querySelector('#active-rules-list .rule-rename').click());
    await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await page.keyboard.press('Enter');
    r = await ev(() => ({ has: 'name' in window.activeFilterRules[0], labels: __labels() }));
    check('emptying the name removes it; legend falls back', !r.has && r.labels.includes('Codes: Ag'), r);
    await page.evaluate(() => document.querySelector('#active-rules-list .rule-rename').click());
    await page.keyboard.type('Nope'); await page.keyboard.press('Escape');
    check('Escape cancels a rename', await ev(() => !('name' in window.activeFilterRules[0])));

    r = await ev(() => {
        document.getElementById('design-rule-name').value = '  New named rule  ';
        document.getElementById('enable-design-color').checked = true;
        window.applyBatchStyles();
        const rule = window.activeFilterRules[window.activeFilterRules.length - 1];
        document.getElementById('enable-design-color').checked = false;
        return { name: rule.name, field: document.getElementById('design-rule-name').value };
    });
    check('Apply as New Rule stores the trimmed name and clears the field', r.name === 'New named rule' && r.field === '', r);
    r = await ev(() => {
        window.applyBatchStyles.call(null);   // with nothing ticked: aborts, adds no rule
        document.getElementById('enable-design-ring').checked = true;
        window.applyBatchStyles();
        document.getElementById('enable-design-ring').checked = false;
        return 'name' in window.activeFilterRules[window.activeFilterRules.length - 1];
    });
    check('a rule made without a name has no name field', r === false, r);

    console.log('Development view');
    L = await ev(() => { devView = true; const l = __labels(); devView = false; return l; });
    check('dev view explains instead of listing', L.length === 1 && /Development view/.test(L[0]), L);

    console.log('Refresh without being asked');
    r = await ev(async () => {
        __reset(); __w(1, 1);
        window.renderMapLegend();
        __w(2, 2, { navalBase: true });          // no rule pass, no explicit refresh
        draw();
        await new Promise(res => setTimeout(res, 400));
        return Array.from(document.querySelectorAll('#map-legend-list .map-legend-label')).map(e => e.textContent);
    });
    check('a draw after the map changes size rescans (debounced)', r.includes('Naval base'), r);
    r = await ev(async () => {
        window.printMode = true; draw();
        await new Promise(res => setTimeout(res, 400));
        const c = document.querySelector('#map-legend-list canvas');
        const px = c.getContext('2d').getImageData(1, 1, 1, 1).data;
        window.printMode = false; draw();
        return Array.from(px);
    });
    check('White Background Mode redraws swatches on white', r[0] === 255 && r[1] === 255 && r[2] === 255, r);

    console.log('Save and load');
    await ev(() => { __reset(); __w(1, 1, { tradeCodes: ['Ag'] });
        window.activeFilterRules = [__rule('r_ag', { tradeCodes: 'Ag' }, { color: '#33ff88', name: 'Farm' })];
        window.reapplyAllRules(); delete window.showSaveFilePicker; });
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate(() => document.getElementById('btn-save-map').click()),
    ]);
    const saved = path.join(dl, 'map.json');
    await download.saveAs(saved);
    const json = JSON.parse(fs.readFileSync(saved, 'utf8'));
    check('save file: settings.mapLegendEnabled true', json.settings && json.settings.mapLegendEnabled === true, json.settings);
    check('save file: rule name kept', json.aesthetics.activeRules[0].name === 'Farm', json.aesthetics.activeRules[0]);
    check('save file: no derived match list leaked', !JSON.stringify(json).includes('ruleMatchesByHex'));

    await ev(() => window.setMapLegendEnabled(false));
    await page.setInputFiles('#file-load-map', saved);
    await page.waitForFunction(() => window.mapLegendEnabled === true, null, { timeout: 15000 }).catch(() => {});
    r = await ev(async () => { await new Promise(res => setTimeout(res, 400));
        return { on: window.mapLegendEnabled, vis: document.getElementById('map-legend').classList.contains('visible'),
                 box: document.getElementById('toggle-map-legend').checked, labels: __labels() }; });
    check('loading that file turns the legend on', r.on && r.vis && r.box, r);
    check('...and lists the named rule', r.labels.includes('Farm'), r);

    const old = Object.assign({}, json); old.settings = Object.assign({}, json.settings); delete old.settings.mapLegendEnabled;
    const oldPath = path.join(dl, 'old.json'); fs.writeFileSync(oldPath, JSON.stringify(old));
    await page.setInputFiles('#file-load-map', oldPath);
    await page.waitForFunction(() => window.mapLegendEnabled === false, null, { timeout: 15000 }).catch(() => {});
    check('a save without the key (pre-v0.18.3) loads OFF', await ev(() => window.mapLegendEnabled === false &&
        !document.getElementById('map-legend').classList.contains('visible')));

    console.log('Window');
    await ev(() => window.setMapLegendEnabled(true));
    const box = await page.locator('#map-legend .modal-drag-handle h2').boundingBox();
    await page.mouse.move(box.x + 20, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(300, 200, { steps: 5 });
    await page.mouse.up();
    const pos = await ev(() => JSON.parse(localStorage.getItem('traveller_map_legend_pos')));
    check('dragging saves the position', pos && Math.abs(pos.top - 195) < 30, pos);
    await ev(() => document.getElementById('btn-close-map-legend').click());
    check('the X turns the setting off', await ev(() => window.mapLegendEnabled === false &&
        !document.getElementById('toggle-map-legend').checked &&
        localStorage.getItem('traveller_map_legend') === 'false'));
    await ev(() => document.getElementById('toggle-map-legend').click());
    await page.reload();
    await page.click('#btn-launch-app');
    await page.waitForFunction(() => typeof window.renderMapLegend === 'function');
    await page.waitForTimeout(900);
    r = await ev(() => { const b = document.getElementById('map-legend').getBoundingClientRect();
        return { on: window.mapLegendEnabled, vis: document.getElementById('map-legend').classList.contains('visible'), left: b.left, top: b.top }; });
    check('after a reload: still on, same place', r.on && r.vis && Math.abs(r.left - pos.left) < 2 && Math.abs(r.top - pos.top) < 2, { r, pos });

    if (PERF) {
        console.log('Performance');
        await page.evaluate(`(${HELPERS.toString()})()`);
        r = await ev(() => {
            hexStates.clear();
            gridWidth = 16; gridHeight = 8;     // 128 sectors, so getHexId reaches them all
            let w = 0;
            // 163,840 hexes (128 sectors), ~30% worlds, the rest EMPTY: the
            // shape of a Universe import.
            const cols = 32 * 16, rows = 40 * 8;
            for (let q = 0; q < cols; q++) for (let r = 0; r < rows; r++) {
                const id = getHexId(q, r); if (!id) continue;
                if ((q * 7 + r * 13) % 10 < 3) { __w(q, r, { gasGiant: true, navalBase: q % 5 === 0, tradeCodes: ['Ag'] }); w++; }
                else hexStates.set(id, { type: 'EMPTY' });
            }
            window.activeFilterRules = [__rule('r_ag', { tradeCodes: 'Ag' }, { color: '#33ff88', name: 'Farm' })];
            window.reapplyAllRules();
            const t = []; for (let i = 0; i < 3; i++) t.push(window.scanMapLegend().ms);
            return { hexes: hexStates.size, worlds: w, ms: t.map(x => Math.round(x)) };
        });
        console.log(`  scan of ${r.hexes} hexes (${r.worlds} worlds): ${r.ms.join(' / ')} ms`);
    }

    const errs = page._errors;
    check('no page errors', errs.length === 0, errs);
    await browser.close();
    console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} ${pass}/${pass + fail}`);
    process.exitCode = fail === 0 ? 0 : 1;
})();
