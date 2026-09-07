/**
 * route_continue.js — verification for "Continue existing route".
 *
 * Spec: directives/route_extend_spec.md §4 (C1–C9) and §6.
 *
 * Drives the real UI — the checkbox, the form, the Generate button — rather than
 * calling the generator directly, because most of this feature IS the UI
 * behaviour: what the fields contain, when the box is enabled, what the saved
 * setup becomes. node --check would see none of it.
 *
 *   node utilities/route_continue.js
 */
const { launchApp, buildMap } = require('./route_test_common');

const CFG = { gridW: 7, gridH: 5, cols: 14, rows: 16, density: 0.95, seed: 21 };
const results = [];

function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

// Everything below runs inside the page, so these helpers are injected as source.
const HELPERS = `
    window.__T = {
        segs(routeId) {
            return (window.sectorRoutes || []).filter(r => r.routeId === routeId)
                .map(r => r.startId + '>' + r.endId).sort();
        },
        setup(routeId) {
            const d = (window.routeDefinitions || []).find(x => x.id === routeId);
            const ref = d && d.automationRef;
            return (ref && ref.type === 'p2p') ? ref.params : null;
        },
        // Lay a known chain into a slot directly, so tests start from a shape
        // they chose rather than one a generator happened to produce.
        layChain(routeId, ids, opts) {
            opts = opts || {};
            window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);
            for (let i = 0; i < ids.length - 1; i++) {
                const seg = { startId: ids[i], endId: ids[i+1], type: 'Trade',
                              routeId: routeId, groupId: 'p2p_' + routeId };
                if (!opts.noSubtype) seg.subtype = 'PointToPoint';
                window.sectorRoutes.push(seg);
            }
        },
        setStored(routeId, params) {
            const d = (window.routeDefinitions || []).find(x => x.id === routeId);
            d.automationRef = params ? { type: 'p2p', params: params } : null;
        },
        // Drive the panel the way a user does.
        openPanel(routeId) {
            window.openRouteAutoPanel(routeId, 'TestRoute');
            const radio = document.querySelector('input[name="route-auto-type"][value="p2p"]');
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        },
        tickContinue(on) {
            const cb = document.getElementById('route-auto-p2p-continue');
            cb.checked = on;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        },
        form() {
            return {
                start: document.getElementById('route-auto-p2p-start').value,
                end:   document.getElementById('route-auto-p2p-end').value,
                waypoints: Array.from(
                    document.querySelectorAll('#route-auto-p2p-waypoints-list input[type=text]')
                ).map(i => i.value),
                continueDisabled: document.getElementById('route-auto-p2p-continue').disabled,
                continueChecked:  document.getElementById('route-auto-p2p-continue').checked
            };
        },
        fill(start, end, waypoints) {
            document.getElementById('route-auto-p2p-start').value = start || '';
            document.getElementById('route-auto-p2p-end').value   = end || '';
            const list = document.getElementById('route-auto-p2p-waypoints-list');
            list.innerHTML = '';
            (waypoints || []).forEach(w => addWaypointRow(w, false));
        },
        generate() {
            document.getElementById('route-auto-p2p-jump').value = '3';
            document.getElementById('btn-route-auto-generate').disabled = false;
            document.getElementById('btn-route-auto-generate').click();
        },
        // A run of worlds guaranteed adjacent enough to route at Jump-3.
        corridor(n) {
            const out = [];
            hexStates.forEach((s, id) => { if (s.type === 'SYSTEM_PRESENT') out.push(id); });
            out.sort();
            return out.slice(0, n);
        }
    };
`;

(async () => {
    const { browser, page } = await launchApp({ headless: true });
    await buildMap(page, CFG);
    await page.evaluate(HELPERS);
    await page.evaluate(() => { window.showToast = m => { window.__lastToast = m; }; });

    const ids = await page.evaluate(() => window.__T.corridor(40));

    // Find four worlds forming a routable chain at Jump-3, plus two more beyond.
    const picked = await page.evaluate((ids) => {
        const near = (a, b) => {
            const ca = getHexCoords(a), cb = getHexCoords(b);
            return getHexDistance(ca.q, ca.r, cb.q, cb.r);
        };
        const chain = [ids[0]];
        for (const id of ids) {
            if (chain.indexOf(id) !== -1) continue;
            if (near(chain[chain.length - 1], id) <= 3) chain.push(id);
            if (chain.length === 6) break;
        }
        return chain;
    }, ids);
    check('test fixture: a 6-world chain within Jump-3', picked.length === 6, picked.join(' '));
    if (picked.length < 6) { await browser.close(); process.exit(1); }
    const [A, B, C, D, E, F] = picked;

    // ── C6: the box resets to off, and is disabled on an empty slot ──────────
    let r = await page.evaluate(() => {
        window.sectorRoutes = [];
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        return window.__T.form();
    });
    check('C6/disabled: off and disabled on an empty slot',
        r.continueChecked === false && r.continueDisabled === true);

    // ── C2: ticking rewrites the form; unticking restores it ────────────────
    r = await page.evaluate(([A, B, C]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        const before = window.__T.form();
        window.__T.tickContinue(true);
        const ticked = window.__T.form();
        window.__T.tickContinue(false);
        const restored = window.__T.form();
        return { before, ticked, restored };
    }, [A, B, C]);
    check('C2: ticking sets Start to the far end, blanks End, clears waypoints',
        /\(/.test(r.ticked.start) && r.ticked.end === '' && r.ticked.waypoints.length === 0,
        JSON.stringify(r.ticked));
    check('C2: unticking restores the form exactly',
        r.restored.start === r.before.start && r.restored.end === r.before.end &&
        JSON.stringify(r.restored.waypoints) === JSON.stringify(r.before.waypoints),
        JSON.stringify(r.restored));

    // ── C1: a Start that is not an end is refused, and nothing changes ──────
    r = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const before = window.__T.segs(4);
        window.__T.fill(B, D, []);          // B is mid-route
        window.__T.generate();
        return { before, after: window.__T.segs(4), toast: window.__lastToast };
    }, [A, B, C, D]);
    check('C1: mid-route Start refused, route untouched',
        JSON.stringify(r.before) === JSON.stringify(r.after) && /is not an end of/.test(r.toast || ''),
        r.toast);

    // ── C7 + C3: append, existing segments untouched, setup accumulates ─────
    r = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const before = window.__T.segs(4);
        window.__T.fill(window.__T.form().start, formatWorldLabel(D), []);
        window.__T.generate();
        const after = window.__T.segs(4);
        return { before, after, setup: window.__T.setup(4), toast: window.__lastToast,
                 kept: before.every(s => after.indexOf(s) !== -1) };
    }, [A, B, C, D]);
    check('C7: existing segments are byte-identical after a continuation',
        r.kept && r.after.length > r.before.length,
        r.before.length + ' -> ' + r.after.length + ' segments');
    check('C3: setup accumulates — old End becomes a waypoint, new target is the End',
        r.setup && r.setup.startId === A && r.setup.endId === D &&
        r.setup.waypointIds.join(',') === [B, C].join(','),
        r.setup ? JSON.stringify(r.setup.waypointIds) + ' end=' + r.setup.endId : 'no setup');

    // ── C8: a continuation that finds nothing leaves the route alone ────────
    r = await page.evaluate(([A, B, C]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        const before = window.__T.segs(4);
        const beforeSetup = JSON.stringify(window.__T.setup(4));
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        // An unreachable target: a vacant hex far outside the map, at Jump-3.
        let far = null;
        for (let q = 200; q < 260 && !far; q++) {
            const id = getHexId(q, 200);
            if (id && isVacantHex(id)) far = id;
        }
        window.__T.fill(window.__T.form().start, far, []);
        window.__T.generate();
        return { before, after: window.__T.segs(4), far,
                 setupUnchanged: JSON.stringify(window.__T.setup(4)) === beforeSetup };
    }, [A, B, C]);
    check('C8: failed continuation changes nothing at all',
        JSON.stringify(r.before) === JSON.stringify(r.after) && r.setupUnchanged,
        r.before.length + ' segments before and after');

    // ── C4 + §6: a route with NO stored setup and NO subtype ────────────────
    r = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C], { noSubtype: true });   // as imported
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        const form = window.__T.form();
        window.__T.tickContinue(true);
        window.__T.fill(window.__T.form().start, formatWorldLabel(D), []);
        window.__T.generate();
        const segs = (window.sectorRoutes || []).filter(x => x.routeId === 4);
        return {
            enabled: !form.continueDisabled,
            allStamped: segs.every(x => x.subtype === 'PointToPoint'),
            listOrdered: getRouteSystemList(4).ordered,
            setup: window.__T.setup(4),
            count: segs.length
        };
    }, [A, B, C, D]);
    check('C4: a route with no stored setup can still be continued', r.enabled);
    check('§6: every segment stamped PointToPoint, so travel order does not depend on array order',
        r.allStamped && r.listOrdered === true, 'stamped=' + r.allStamped + ' ordered=' + r.listOrdered);
    check('OQ-4: no setup is invented for a route that had none', r.setup === null,
        JSON.stringify(r.setup));

    // ── C9: a leg that rejoins the route commits, and says so ───────────────
    r = await page.evaluate(([A, B, C]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const before = window.__T.segs(4).length;
        // Aim the new leg back at the route's own other end: closes a loop.
        window.__T.fill(formatWorldLabel(C), formatWorldLabel(A), []);
        window.__T.generate();
        return { before, after: window.__T.segs(4).length, toast: window.__lastToast,
                 ordered: getRouteSystemList(4).ordered };
    }, [A, B, C]);
    check('C9: a rejoining leg is committed and the loss of travel order is reported',
        r.after > r.before && /listed alphabetically/.test(r.toast || ''),
        r.toast);

    // ── Undo ────────────────────────────────────────────────────────────────
    // Undo lives inline in the keydown handler with no callable entry point, so
    // this presses the actual keys — which exercises the real path rather than a
    // convenience wrapper that might diverge from it.
    const undoBefore = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.undoStack = []; window.redoStack = [];
        const before = window.__T.segs(4);
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        window.__T.fill(window.__T.form().start, formatWorldLabel(D), []);
        window.__T.generate();
        document.activeElement && document.activeElement.blur();
        return { before, after: window.__T.segs(4), stack: window.undoStack.length };
    }, [A, B, C, D]);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const undone = await page.evaluate(() => window.__T.segs(4));

    check('Undo: one Ctrl+Z restores the route exactly as it was',
        JSON.stringify(undone) === JSON.stringify(undoBefore.before) &&
        undoBefore.after.length > undoBefore.before.length,
        undoBefore.before.length + ' -> ' + undoBefore.after.length + ' -> ' + undone.length);

    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);
    const redone = await page.evaluate(() => window.__T.segs(4));
    check('Redo: Ctrl+Shift+Z puts the continuation back',
        JSON.stringify(redone) === JSON.stringify(undoBefore.after),
        undone.length + ' -> ' + redone.length);

    // ── NEGATIVE CONTROL ────────────────────────────────────────────────────
    // With the box OFF the same press must REPLACE, not append. If this fails,
    // every "appended" assertion above proves nothing.
    r = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        window.__T.tickContinue(false);
        const before = window.__T.segs(4);
        window.__T.fill(formatWorldLabel(C), formatWorldLabel(D), []);
        window.__T.generate();
        const after = window.__T.segs(4);
        return { before, after, stillHasOld: before.some(s => after.indexOf(s) !== -1) };
    }, [A, B, C, D]);
    check('NEGATIVE CONTROL: with the box off, Generate still replaces the route',
        r.stillHasOld === false,
        'old segments surviving: ' + (r.stillHasOld ? 'yes (BUG)' : 'none, as expected'));

    console.log('\npage errors: ' + (page._errors.length ? JSON.stringify(page._errors) : 'none'));
    const failed = results.filter(x => !x.pass);
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed.');
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})();
