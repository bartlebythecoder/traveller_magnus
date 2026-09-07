/**
 * filter_persistence.js — regression test for R9.
 *
 * THE BUG (fixed 2026-09-01): applyActiveFilters() writes its verdict onto every
 * hex as state.isHiddenByFilter. db_manager persists hex states WHOLE, so the
 * flag reached IndexedDB — while the filter's inputs, being plain DOM fields,
 * did not. Startup was the only path repopulating hexStates that did not
 * recompute, so the map reopened filtered by criteria present nowhere in the UI:
 * worlds hidden, form empty, hasAnyActiveFilter() false, Shift+F answering "No
 * filter is active", and route generation silently restricted to the survivors.
 *
 * Checks, in order:
 *   1  flags do not survive a restart, and the form and the map agree
 *   2  route generation is not silently constrained afterwards
 *   3  the derived flag is not written to IndexedDB at all
 *   4  a saved .json carries no view state
 *   5  the filter-active indicator appears, and says the right thing
 *   6  NEGATIVE CONTROL — with the startup recompute disabled, the bug returns
 *
 * Check 6 is what stops this passing vacuously: a test for "nothing is hidden"
 * passes just as happily on a map where the filter never ran at all.
 *
 *   node utilities/filter_persistence.js
 */
const { launchApp, buildMap } = require('./route_test_common');

const CFG = { gridW: 7, gridH: 5, cols: 12, rows: 14, density: 0.9, seed: 7 };
const results = [];

function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

async function restart(page) {
    await page.reload();
    await page.click('#btn-launch-app');
    await page.waitForFunction(() => typeof window.hexStates !== 'undefined');
    await page.waitForTimeout(1500);
}

// Reads every record out of the hex object store, so "is the flag persisted?"
// is answered from the store itself rather than from the app's copy of it.
const DB_NAME = 'traveller_magnus';      // js/db_manager.js:18
const DB_VERSION = 2;                    // js/db_manager.js:19
const STORE_HEX = 'hexStates';           // js/db_manager.js:20

function readStore() {
    return new Promise(function (resolve, reject) {
        // Open at the app's own version. Opening without one creates an empty
        // v1 database if the name is wrong, which then reports zero flagged
        // records and passes this test for entirely the wrong reason.
        const open = indexedDB.open('traveller_magnus', 2);
        open.onerror = function () { reject(open.error); };
        open.onupgradeneeded = function () { reject(new Error('store did not exist')); };
        open.onsuccess = function () {
            const db = open.result;
            if (!db.objectStoreNames.contains('hexStates')) {
                db.close(); reject(new Error('no hexStates store')); return;
            }
            const out = [];
            const cur = db.transaction('hexStates', 'readonly').objectStore('hexStates').openCursor();
            cur.onsuccess = function (e) {
                const c = e.target.result;
                if (c) { out.push(c.value); c.continue(); }
                else { db.close(); resolve({ storeName: 'hexStates', records: out }); }
            };
        };
    });
}

(async () => {
    const { browser, page } = await launchApp({ headless: true });
    await buildMap(page, CFG);

    const sane = await page.evaluate(() => {
        let bad = 0;
        window.hexStates.forEach((s, id) => { if (!getHexCoords(id)) bad++; });
        return { bad: bad, total: window.hexStates.size };
    });
    check('harness builds a coherent map',
        sane.bad === 0 && sane.total > 100,
        sane.total + ' hexes, ' + sane.bad + ' with unresolvable ids');

    const before = await page.evaluate(async () => {
        document.getElementById('filter-pop').value = '8+';
        window.applyActiveFilters();
        let hidden = 0;
        window.hexStates.forEach(s => { if (s.isHiddenByFilter) hidden++; });
        await window.dbManager.syncAllHexes();
        const el = document.getElementById('filter-active-indicator');
        return { hidden: hidden, indicator: el.textContent, shown: el.style.display !== 'none' };
    });
    check('filter hides worlds while applied', before.hidden > 0, before.hidden + ' hidden');
    check('5. indicator appears and names the filter while it is on',
        before.shown && /Filter active/.test(before.indicator),
        JSON.stringify(before.indicator));

    // ---- 3. is the flag written to the store at all? -----------------------
    const inStore = await page.evaluate(async (src) => {
        const fn = new Function('return ' + src)();
        const res = await fn();
        return {
            records: res.records.length,
            withFlag: res.records.filter(v => v && 'isHiddenByFilter' in v).length
        };
    }, readStore.toString());
    check('3. derived flag never reaches IndexedDB',
        inStore.records > 0 && inStore.withFlag === 0,
        inStore.withFlag + ' of ' + inStore.records + ' records carry it');

    // ---- 4. does a saved .json carry it? -----------------------------------
    const inFile = await page.evaluate(() => {
        const obj = {};
        window.hexStates.forEach((v, k) => { obj[k] = stripHexViewState(v); });
        const vals = Object.keys(obj).map(k => obj[k]);
        return {
            total: vals.length,
            withFlag: vals.filter(v => v && 'isHiddenByFilter' in v).length,
            liveStillFlagged: (() => {
                let n = 0; window.hexStates.forEach(s => { if (s.isHiddenByFilter) n++; }); return n;
            })()
        };
    });
    check('4. saved map file carries no view state',
        inFile.withFlag === 0, inFile.withFlag + ' of ' + inFile.total + ' hexes');
    check('4. stripping does not disturb the live map',
        inFile.liveStillFlagged === before.hidden,
        'live flags still ' + inFile.liveStillFlagged);

    // ---- 1 & 2. the restart ------------------------------------------------
    await restart(page);
    const after = await page.evaluate(() => {
        let hidden = 0, systems = 0;
        window.hexStates.forEach(s => {
            if (s.type === 'SYSTEM_PRESENT') systems++;
            if (s.isHiddenByFilter) hidden++;
        });
        const el = document.getElementById('filter-active-indicator');
        return {
            hidden: hidden, systems: systems,
            popField: document.getElementById('filter-pop').value,
            counter: document.getElementById('filter-results-count').textContent,
            hasAnyActiveFilter: hasAnyActiveFilter(),
            visibleToRouting: getFilteredHexIds().length,
            indicatorShown: el.style.display !== 'none'
        };
    });
    check('1. no worlds hidden after a restart', after.hidden === 0, after.hidden + ' hidden');
    check('1. form and map agree after a restart',
        after.hasAnyActiveFilter === false && after.hidden === 0 && !after.indicatorShown,
        'fields="' + after.popField + '" hasAnyActiveFilter=' + after.hasAnyActiveFilter +
        ' indicator=' + after.indicatorShown);
    check('1. match counter reflects reality',
        after.counter === (after.systems + ' / ' + after.systems), after.counter);
    check('2. route generation sees every world',
        after.visibleToRouting === after.systems,
        after.visibleToRouting + ' of ' + after.systems);

    // ---- 6. negative control -----------------------------------------------
    // Re-pollute the store the way the OLD code did (raw put, no strip), then
    // restart with the startup recompute suppressed. The bug must come back; if
    // it does not, checks 1 and 2 above prove nothing.
    await page.evaluate(async (src) => {
        gridWidth = 7; gridHeight = 5;
        document.getElementById('filter-pop').value = '8+';
        window.applyActiveFilters();
        const fn = new Function('return ' + src)();
        const res = await fn();
        await new Promise(resolve => {
            const open = indexedDB.open('traveller_magnus', 2);
            open.onsuccess = () => {
                const db = open.result;
                const tx = db.transaction(res.storeName, 'readwrite');
                const st = tx.objectStore(res.storeName);
                window.hexStates.forEach((v, k) => st.put(v, k));   // raw, unstripped
                tx.oncomplete = () => { db.close(); resolve(); };
            };
        });
    }, readStore.toString());

    await page.addInitScript(() => {
        // Neutralise the startup recompute only — after the app has defined it.
        window.addEventListener('load', () => { window.applyActiveFilters = function () {}; }, true);
    });
    await restart(page);

    const neg = await page.evaluate(() => {
        let hidden = 0;
        window.hexStates.forEach(s => { if (s.isHiddenByFilter) hidden++; });
        return { hidden: hidden, popField: document.getElementById('filter-pop').value };
    });
    check('6. NEGATIVE CONTROL — bug returns when the recompute is removed',
        neg.hidden > 0 && neg.popField === '',
        neg.hidden + ' hidden with an empty form (this SHOULD be > 0)');

    console.log('\npage errors: ' + (page._errors.length ? JSON.stringify(page._errors) : 'none'));
    const failed = results.filter(r => !r.pass);
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed.');
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})();
