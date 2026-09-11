/**
 * otu_import_undo.js — regression test for multi-sector OTU import undo.
 *
 * THE BUG (fixed 2026-09-01): runImport() took no history snapshot AND did not
 * clear the undo stacks, so Ctrl+Z after a multi-sector import applied whatever
 * snapshot happened to be on top — from before the import. It LOOKED like the
 * import was undone (the hexes did disappear) while actually restoring a much
 * older state and silently discarding editing done beforehand.
 *
 * Decision (Sean, 2026-09-01): a bulk import is a new-document operation and is
 * deliberately NOT undoable, matching executeUniverseImport() which has cleared
 * the stacks all along. Snapshotting instead was rejected — a pre-import copy of
 * hexStates is the size the undo cap exists to avoid.
 *
 * Runs entirely OFFLINE: the importer consults a localStorage sector cache before
 * fetching, so seeding that cache means no call to travellermap.com is ever made.
 * `fetch` is additionally stubbed to throw, which fails the test loudly rather
 * than silently going to the network if that ever stops being true.
 *
 *   node utilities/otu_import_undo.js
 */
const { launchApp, buildMap } = require('./route_test_common');

const results = [];
function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

(async () => {
    const { browser, page } = await launchApp({ headless: true });
    await buildMap(page, { gridW: 7, gridH: 5, cols: 8, rows: 8, density: 0.9, seed: 3 });

    const setup = await page.evaluate(() => {
        // Any network call is a test failure, not a fallback.
        window.__fetched = [];
        window.fetch = (url) => {
            window.__fetched.push(String(url));
            return Promise.reject(new Error('network blocked in test'));
        };

        // Seed the cache for the first two sectors the modal will list.
        const sectors = (window.IMPERIUM_SECTORS || []).slice(0, 2);
        const tsv = [
            'Hex\tName\tUWP\tBases\tRemarks\tZone\tPBG\tAllegiance\tStars\t{Ix}\t(Ex)\t[Cx]\tNobility\tW',
            '0101\tTestworldA\tA788899-C\t\tAg Ni\t\t123\tIm\tG2 V\t{ 2 }\t(A46+1)\t[1716]\tBc\t7',
            '0203\tTestworldB\tB543321-8\t\tPo\t\t100\tIm\tM0 V\t{ 0 }\t(632-2)\t[1214]\t\t4'
        ].join('\n');
        sectors.forEach(s => {
            localStorage.setItem('otu_cache_' + s.name,
                JSON.stringify({ timestamp: Date.now(), data: tsv }));
        });

        // Ordinary prior work, the kind any session accumulates.
        const ids = [];
        hexStates.forEach((st, id) => { if (st.type === 'SYSTEM_PRESENT') ids.push(id); });
        ids.sort();
        saveHistoryState('Edit one');
        hexStates.get(ids[0]).mgt2eData.name = 'EDITED_ONE';
        saveHistoryState('Edit two');
        hexStates.get(ids[1]).mgt2eData.name = 'EDITED_TWO';

        return {
            sectorsSeeded: sectors.map(s => s.name),
            undoDepth: window.undoStack.length,
            ids: ids.slice(0, 2),
            names: [hexStates.get(ids[0]).mgt2eData.name, hexStates.get(ids[1]).mgt2eData.name]
        };
    });
    check('fixture: prior edits are on the undo stack',
        setup.undoDepth === 2 && setup.names[1] === 'EDITED_TWO',
        'depth ' + setup.undoDepth + ', ' + setup.names.join('/'));

    // ── Drive the real modal ────────────────────────────────────────────────
    const ran = await page.evaluate(async (seeded) => {
        window.openImperiumModal();
        const rows = Array.from(document.querySelectorAll('.otu-sector-row'));
        // Tick only the two sectors whose TSV is cached; untick everything else,
        // or the import reaches for the network on the very first uncached one.
        rows.forEach(row => {
            const cb = row.querySelector('.otu-sector-check');
            const label = row.textContent || '';
            cb.checked = seeded.some(n => label.indexOf(n) !== -1);
        });
        const picked = rows.filter(r => r.querySelector('.otu-sector-check').checked).length;

        // Sector data only — routes/borders/regions would each want metadata.
        const set = (id, on) => { const el = document.getElementById(id); if (el) el.checked = on; };
        set('otu-opt-sector', true);
        set('otu-opt-routes', false);
        set('otu-opt-borders', false);
        set('otu-opt-regions', false);
        set('otu-opt-system-data', false);

        const btn = document.getElementById('otu-submit');   // js/otu_importer.js:707
        if (!btn) return { ok: false, why: 'import button #otu-submit not found' };
        btn.click();
        return { ok: true, picked };
    }, setup.sectorsSeeded);

    if (!ran.ok) { check('drive the modal', false, ran.why); }
    else check('fixture: the import ran on cached sectors only', ran.picked === 2,
        ran.picked + ' sector(s) ticked');

    await page.waitForTimeout(4000);   // the importer yields between sectors

    const after = await page.evaluate(() => ({
        undoDepth: window.undoStack.length,
        redoDepth: window.redoStack.length,
        fetched: window.__fetched.length,
        hexes: hexStates.size
    }));
    check('offline: no network call was made', after.fetched === 0,
        after.fetched + ' fetch(es)');
    check('the undo stacks are cleared by the import',
        after.undoDepth === 0 && after.redoDepth === 0,
        'undo ' + after.undoDepth + ', redo ' + after.redoDepth);

    // ── Ctrl+Z must now do nothing at all ───────────────────────────────────
    //
    // Note the pre-import edits themselves are NOT asserted to survive: they sat
    // in the sector the import wrote into, so overwriting them is the import
    // doing its job. What matters is that undo cannot quietly move the map to
    // some older state afterwards — so the whole of hexStates is fingerprinted
    // and compared, rather than two hexes being spot-checked.
    const fingerprint = () => page.evaluate(() => {
        const parts = [];
        hexStates.forEach((st, id) => { parts.push(id + ':' + (st.type || '')); });
        parts.sort();
        return parts.join('|');
    });

    const fpBefore = await fingerprint();
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    const fpAfter = await fingerprint();

    check('Ctrl+Z after the import changes nothing at all',
        fpBefore === fpAfter && fpBefore.length > 0,
        fpBefore === fpAfter ? 'map identical' : 'MAP MOVED');

    // ── NEGATIVE CONTROL ────────────────────────────────────────────────────
    // With the stacks empty, Ctrl+Z can do nothing whatever the code does — so
    // the check above would pass even if undo were broken outright. Push one real
    // snapshot, press the same key, and the map MUST move. That is what shows the
    // fingerprint comparison can actually detect an undo.
    await page.evaluate(() => {
        saveHistoryState('control snapshot');
        const first = hexStates.keys().next().value;
        hexStates.delete(first);      // a change undo should reverse
    });
    const fpDirty = await fingerprint();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
    const fpRestored = await fingerprint();

    check('NEGATIVE CONTROL: with a snapshot present, the same key DOES move the map',
        fpDirty !== fpRestored && fpRestored === fpAfter,
        fpDirty !== fpRestored ? 'undo detected, as it must be' : 'undo did nothing (test is blind)');

    console.log('\npage errors: ' + (page._errors.length ? JSON.stringify(page._errors) : 'none'));
    const failed = results.filter(x => !x.pass);
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed.');
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})();
