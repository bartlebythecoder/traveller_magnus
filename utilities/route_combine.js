/**
 * route_combine.js — verification for "Combine two routes".
 *
 * Spec: directives/route_extend_spec.md §5 (M1–M5) and §6.
 *
 *   node utilities/route_combine.js
 */
const { launchApp, buildMap } = require('./route_test_common');

const CFG = { gridW: 7, gridH: 5, cols: 14, rows: 16, density: 0.95, seed: 21 };
const results = [];

function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

const HELPERS = `
    window.__C = {
        lay(routeId, ids, opts) {
            opts = opts || {};
            window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);
            for (let i = 0; i < ids.length - 1; i++) {
                const seg = { startId: ids[i], endId: ids[i+1], type: 'Filter',
                              routeId: routeId, groupId: 'p2p_' + routeId };
                if (!opts.noSubtype) seg.subtype = 'PointToPoint';
                if (opts.color) seg.color = opts.color;
                window.sectorRoutes.push(seg);
            }
        },
        segs(routeId) {
            return (window.sectorRoutes || []).filter(r => r.routeId === routeId)
                .map(r => [r.startId, r.endId].slice().sort().join('|')).sort();
        },
        names(routeId) {
            return getCombineCandidates(routeId).map(c => c.name).sort();
        },
        hasDef(routeId) {
            return (window.routeDefinitions || []).some(d => d.id === routeId);
        },
        reset() {
            window.sectorRoutes = [];
            window.routeDefinitions = getDefaultRouteDefinitions();
            window.undoStack = []; window.redoStack = [];
        }
    };
`;

(async () => {
    const { browser, page } = await launchApp({ headless: true });
    await buildMap(page, CFG);
    await page.evaluate(HELPERS);
    await page.evaluate(() => {
        window.showToast = m => { window.__lastToast = m; };
        window.confirm = () => { window.__confirmed = true; return true; };
    });

    const ids = await page.evaluate(() => {
        const out = [];
        hexStates.forEach((s, id) => { if (s.type === 'SYSTEM_PRESENT') out.push(id); });
        out.sort();
        return out.slice(0, 12);
    });
    const [A, B, C, D, E, F, G, H] = ids;

    // ── M1: end-to-end pairs are offered ────────────────────────────────────
    let r = await page.evaluate(([A, B, C, D, E]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B, C]);      // ends A, C
        window.__C.lay(5, [C, D, E]);      // ends C, E — meets at C
        return { forFour: window.__C.names(4), forFive: window.__C.names(5) };
    }, [A, B, C, D, E]);
    check('M1: an end-to-end pair is offered, in both directions',
        r.forFour.length === 1 && r.forFive.length === 1, JSON.stringify(r));

    // ── M1: a mid-route junction is NOT offered ─────────────────────────────
    r = await page.evaluate(([A, B, C, D, E]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B, C, D]);   // B and C are mid-route
        window.__C.lay(5, [C, E]);         // joins at C, which is mid-route in 4
        return { forFour: window.__C.names(4) };
    }, [A, B, C, D, E]);
    check('M1: a mid-route junction is not offered', r.forFour.length === 0,
        JSON.stringify(r.forFour));

    // ── M1: ends meet BUT they also overlap → not offered ───────────────────
    // The exact case a naive "do the ends touch" test would wrongly admit.
    r = await page.evaluate(([A, B, C, D]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B, C]);      // ends A, C
        window.__C.lay(5, [C, B, D]);      // ends C, D — meets at C, but ALSO uses B
        return { forFour: window.__C.names(4) };
    }, [A, B, C, D]);
    check('M1: ends meet but the routes also overlap → not offered', r.forFour.length === 0,
        JSON.stringify(r.forFour));

    // ── M1: routes that do not touch → not offered ──────────────────────────
    r = await page.evaluate(([A, B, D, E]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B]);
        window.__C.lay(5, [D, E]);
        return { forFour: window.__C.names(4) };
    }, [A, B, D, E]);
    check('M1: non-touching routes are not offered', r.forFour.length === 0,
        JSON.stringify(r.forFour));

    // ── M1: a route in two pieces that this one BRIDGES is offered ──────────
    // Testing the merged shape admits this; a naive ends-test would reject it.
    r = await page.evaluate(([A, B, C, D]) => {
        window.__C.reset();
        window.__C.lay(4, [B, C]);
        window.sectorRoutes.push(
            { startId: A, endId: B, type: 'Filter', routeId: 5, groupId: 'p2p_5', subtype: 'PointToPoint' },
            { startId: C, endId: D, type: 'Filter', routeId: 5, groupId: 'p2p_5', subtype: 'PointToPoint' }
        );
        return { forFour: window.__C.names(4) };
    }, [A, B, C, D]);
    check('M1: a two-piece route this one bridges IS offered (merged shape, not ends)',
        r.forFour.length === 1, JSON.stringify(r.forFour));

    // ── The merge itself: M3, M4, M5, colour, undo ──────────────────────────
    r = await page.evaluate(([A, B, C, D, E]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B, C]);
        window.__C.lay(5, [C, D, E], { noSubtype: true, color: '#ff00ff' });
        const destDef = window.routeDefinitions.find(d => d.id === 4);
        const srcDef  = window.routeDefinitions.find(d => d.id === 5);
        destDef.name = 'Trade Spine'; destDef.color = '#00ff88'; destDef.shortcut = '4';
        srcDef.name  = 'Coreward Run'; srcDef.shortcut = 'k';

        const before4 = window.__C.segs(4);
        const before5 = window.__C.segs(5);

        const cand = getCombineCandidates(4)[0];
        _combineRoutes(4, cand);

        const segs4 = (window.sectorRoutes || []).filter(x => x.routeId === 4);
        return {
            before4, before5,
            after4: window.__C.segs(4),
            srcSlotGone: !window.__C.hasDef(5),
            srcSegsGone: window.__C.segs(5).length === 0,
            destName:  window.routeDefinitions.find(d => d.id === 4).name,
            destColor: window.routeDefinitions.find(d => d.id === 4).color,
            anySegColor: segs4.some(x => x.color !== undefined),
            allStamped: segs4.every(x => x.subtype === 'PointToPoint'),
            ordered: getRouteSystemList(4).ordered,
            worlds: getRouteSystemList(4).worlds.length,
            toast: window.__lastToast
        };
    }, [A, B, C, D, E]);

    check('M3: the destination keeps its name and colour',
        r.destName === 'Trade Spine' && r.destColor === '#00ff88',
        r.destName + ' / ' + r.destColor);
    check('merge: every segment moved across',
        r.after4.length === r.before4.length + r.before5.length && r.srcSegsGone,
        r.before4.length + ' + ' + r.before5.length + ' = ' + r.after4.length);
    check('M4: the absorbed slot is deleted', r.srcSlotGone);
    check('colour: absorbed segments carry no colour of their own, so they wear the destination\'s',
        r.anySegColor === false);
    check('M5/§6: every segment stamped, and the merged route lists in travel order',
        r.allStamped && r.ordered === true && r.worlds === 5,
        'stamped=' + r.allStamped + ' ordered=' + r.ordered + ' worlds=' + r.worlds);

    // ── Undo ────────────────────────────────────────────────────────────────
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    r = await page.evaluate(() => ({
        segs4: window.__C.segs(4),
        segs5: window.__C.segs(5),
        slot5Back: window.__C.hasDef(5),
        name5: (window.routeDefinitions.find(d => d.id === 5) || {}).name,
        shortcut5: (window.routeDefinitions.find(d => d.id === 5) || {}).shortcut
    }));
    check('Undo: both routes come back, including the absorbed slot with its name and key',
        r.slot5Back && r.segs4.length === 2 && r.segs5.length === 2 &&
        r.name5 === 'Coreward Run' && r.shortcut5 === 'k',
        'slot5=' + r.slot5Back + ' segs=' + r.segs4.length + '/' + r.segs5.length +
        ' name=' + r.name5);

    // ── Duplicate segments are not added twice ──────────────────────────────
    r = await page.evaluate(([A, B, C, D]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B, C]);
        // Route 5 repeats B–C and extends to D.
        window.sectorRoutes.push(
            { startId: B, endId: C, type: 'Filter', routeId: 5, groupId: 'p2p_5', subtype: 'PointToPoint' },
            { startId: C, endId: D, type: 'Filter', routeId: 5, groupId: 'p2p_5', subtype: 'PointToPoint' }
        );
        const cands = getCombineCandidates(4);
        if (cands.length === 0) return { offered: false };
        _combineRoutes(4, cands[0]);
        const segs = window.__C.segs(4);
        return { offered: true, segs, unique: new Set(segs).size === segs.length,
                 count: segs.length, toast: window.__lastToast };
    }, [A, B, C, D]);
    check('duplicate segments are not added twice',
        r.offered && r.unique && r.count === 3,
        r.offered ? r.count + ' segments, all unique: ' + r.unique : 'pair was not offered');

    // ── NEGATIVE CONTROL ────────────────────────────────────────────────────
    // The eligibility test must actually reject something. If getCombineCandidates
    // returned everything, half the checks above would pass vacuously.
    r = await page.evaluate(([A, B, C, D, E, F]) => {
        window.__C.reset();
        window.__C.lay(4, [A, B, C]);
        window.__C.lay(5, [C, D]);      // eligible
        window.__C.lay(6, [E, F]);      // not touching
        window.__C.lay(7, [B, E]);      // joins mid-route
        return { offered: window.__C.names(4), total: 3 };
    }, [A, B, C, D, E, F]);
    check('NEGATIVE CONTROL: of three candidate routes, only the eligible one is offered',
        r.offered.length === 1, r.offered.length + ' of ' + r.total + ' offered');

    console.log('\npage errors: ' + (page._errors.length ? JSON.stringify(page._errors) : 'none'));
    const failed = results.filter(x => !x.pass);
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed.');
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})();
