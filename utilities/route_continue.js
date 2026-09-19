/**
 * route_continue.js — verification for "Continue existing route".
 *
 * Spec: directives/route_extend_spec.md §4 (C1–C9, amended C1/C4), §4.1 (C10–C13,
 * the v0.17.5 additions), §6, and test plan items 1–12 and 21–30.
 *
 * Drives the real UI — the checkbox, the form, the Generate button — rather than
 * calling the generator directly, because most of this feature IS the UI
 * behaviour: what the fields contain, when the box is enabled, what the saved
 * setup becomes. node --check would see none of it.
 *
 * The C-checks came with v0.17.4 and all lay clean two-ended chains. The V-checks
 * came with v0.17.5 and lay the shapes those cannot reach: three-ended routes,
 * self-crossing ones, loops, and a line beside a detached loop.
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
        // Lay an ARBITRARY shape, not a chain. The v0.17.5 checks need routes the
        // strict chain test refuses and the weak end test accepts, and a chain is
        // by definition never one of those.
        layShape(routeId, pairs) {
            window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);
            pairs.forEach(p => window.sectorRoutes.push({
                startId: p[0], endId: p[1], type: 'Trade', subtype: 'PointToPoint',
                routeId: routeId, groupId: 'p2p_' + routeId
            }));
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
                continueChecked:  document.getElementById('route-auto-p2p-continue').checked,
                // The tooltip is the only place the reason lives, so a box that is
                // correctly disabled for the wrong reason has to be catchable.
                continueTitle: (document.getElementById('route-auto-p2p-continue-label') || {}).title || ''
            };
        },
        fill(start, end, waypoints) {
            document.getElementById('route-auto-p2p-start').value = start || '';
            document.getElementById('route-auto-p2p-end').value   = end || '';
            const list = document.getElementById('route-auto-p2p-waypoints-list');
            list.innerHTML = '';
            (waypoints || []).forEach(w => addWaypointRow(w, false));
        },
        // jump defaults to 3. Jump-1 matters for the segment-count check: at
        // Jump-3 the pathfinder shortcuts past the route's own edges, so nothing
        // is ever retraced and the miscount cannot be reproduced.
        generate(jump) {
            document.getElementById('route-auto-p2p-jump').value = String(jump || 3);
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

    // ════════════════════════════════════════════════════════════════════════
    // v0.17.5 — Continue's eligibility rule was WEAKENED here.
    //
    //   was: one unbroken chain, exactly two ends   (walkRouteChain)
    //   now: one piece, at least one loose end      (walkRouteEnds)
    //
    // Every scenario above lays a clean two-ended chain, which BOTH rules accept
    // — so all fifteen of them would still pass if the old rule were put back.
    // The checks below are the ones that would not. Each shape is paired with
    // the strict test as its own control: if `strictOk` is ever true, the shape
    // has stopped being one the old rule refused and the check has gone vacuous.
    // ════════════════════════════════════════════════════════════════════════

    // ── V1: a Y. Three loose ends — what a doubled-back waypoint leaves ──────
    r = await page.evaluate(([A, B, C, D]) => {
        // A—B—C with a spur B—D, so B has degree 3 and the ends are A, C and D.
        window.__T.layShape(4, [[A, B], [B, C], [B, D]]);
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        const ends = getRouteEnds(4).ends;
        return {
            form: window.__T.form(),
            ends,
            labels: ends.map(id => formatWorldLabel(id)),
            strictOk: getRouteChain(4).ok
        };
    }, [A, B, C, D]);
    check('V1: a route with THREE loose ends can be continued',
        r.form.continueDisabled === false && r.ends.length === 3,
        r.ends.length + ' ends, disabled=' + r.form.continueDisabled);
    check('V1: the tooltip offers EVERY end, not the first two',
        r.labels.length === 3 && r.labels.every(l => r.form.continueTitle.indexOf(l) !== -1),
        r.labels.join(' | '));
    check('V1: the tooltip warns that the saved setup will be dropped',
        /3 loose ends/.test(r.form.continueTitle) && /clear its saved setup/.test(r.form.continueTitle));
    check('V1 CONTROL: the OLD rule really does refuse this shape',
        r.strictOk === false,
        r.strictOk ? 'strict test accepts it too (check is vacuous)' : 'refused, as expected');

    // ── V2: a route that crosses itself but still has exactly two ends ───────
    r = await page.evaluate(([A, B, C, D, E]) => {
        // A—B—C—D—E plus a shortcut B—D: B and D reach degree 3, ends stay A/E.
        window.__T.layShape(4, [[A, B], [B, C], [C, D], [D, E], [B, D]]);
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        const w = getRouteEnds(4);
        return { form: window.__T.form(), ends: w.ends, crosses: w.crosses,
                 strictOk: getRouteChain(4).ok };
    }, [A, B, C, D, E]);
    check('V2: a self-crossing route with two ends can be continued',
        r.form.continueDisabled === false && r.ends.length === 2 && r.crosses === true,
        r.ends.length + ' ends, crosses=' + r.crosses);
    check('V2: the tooltip says travel order is lost',
        /listed[\s\S]*alphabetically/.test(r.form.continueTitle), r.form.continueTitle);
    check('V2 CONTROL: the OLD rule really does refuse this shape',
        r.strictOk === false,
        r.strictOk ? 'strict test accepts it too (check is vacuous)' : 'refused, as expected');

    // ── V3: a closed loop is STILL refused — it has no end anywhere ──────────
    r = await page.evaluate(([A, B, C]) => {
        window.__T.layShape(4, [[A, B], [B, C], [C, A]]);
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        return { form: window.__T.form(), reason: getRouteEnds(4).reason };
    }, [A, B, C]);
    check('V3: a closed loop is still refused, and the tooltip says why',
        r.form.continueDisabled === true && r.reason === 'cycle' &&
        /closed loop/.test(r.form.continueTitle),
        r.reason + ' — ' + r.form.continueTitle);

    // ── V4: a line PLUS a separate loop. Two ends, and still refused ─────────
    // The shape that makes "count the ends" wrong: the loop contributes none, so
    // a naive test sees an ordinary two-ended route and continues it, growing the
    // line and silently leaving the loop behind.
    r = await page.evaluate(([A, B, C, D, E, F]) => {
        window.__T.layShape(4, [[A, B], [B, C], [D, E], [E, F], [F, D]]);
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        const w = getRouteEnds(4);
        return { form: window.__T.form(), reason: w.reason,
                 // What the naive test would have seen: A and C, and nothing else.
                 looseCount: [A, B, C, D, E, F].filter(id =>
                     new Set((window.sectorRoutes || [])
                         .filter(s => s.routeId === 4)
                         .flatMap(s => s.startId === id ? [s.endId] : s.endId === id ? [s.startId] : [])
                     ).size === 1).length };
    }, [A, B, C, D, E, F]);
    check('V4: a line plus a detached loop is refused as more than one piece',
        r.form.continueDisabled === true && r.reason === 'disconnected' &&
        /more than one piece/.test(r.form.continueTitle),
        r.reason + ' — ' + r.form.continueTitle);
    check('V4 CONTROL: it really does present exactly two loose ends',
        r.looseCount === 2,
        r.looseCount + ' loose ends — connectivity, not the end count, is what refused it');

    // ── V5: on a three-ended route, a bad Start is told all three ────────────
    r = await page.evaluate(([A, B, C, D, E]) => {
        window.__T.layShape(4, [[A, B], [B, C], [B, D]]);
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const before = window.__T.segs(4);
        window.__T.fill(formatWorldLabel(B), formatWorldLabel(E), []);  // B is the junction
        window.__T.generate();
        return { before, after: window.__T.segs(4), toast: window.__lastToast,
                 labels: getRouteEnds(4).ends.map(id => formatWorldLabel(id)) };
    }, [A, B, C, D, E]);
    check('V5: a Start that is not an end is refused and NAMES all three ends',
        JSON.stringify(r.before) === JSON.stringify(r.after) &&
        r.labels.length === 3 && r.labels.every(l => (r.toast || '').indexOf(l) !== -1),
        r.toast);
    check('V5: the end list reads as English and carries no stray indexes',
        / or /.test(r.toast || '') && !/\b[12] \(\d-[A-Z]-\d{4}\)/.test(r.toast || ''),
        r.toast);

    // ── V6-V8: the box is re-tested when the segments change beneath it ──────
    // refreshRouteWindowCounts() is the funnel every such path goes through, and
    // it returns early unless the Route Manager is actually open — so open it.
    r = await page.evaluate(([A, B, C]) => {
        window.sectorRoutes = [];
        window.__T.setStored(4, null);
        if (!document.getElementById('route-window').classList.contains('visible')) {
            window.toggleRouteWindow();
        }
        window.__T.openPanel(4);
        const empty = window.__T.form();                 // disabled: no segments
        window.__T.layChain(4, [A, B, C]);               // "drawn on the map"
        window.refreshRouteWindowCounts();
        const drawn = window.__T.form();
        return { empty, drawn };
    }, [A, B, C]);
    check('V6: drawing segments under an open panel enables the box',
        r.empty.continueDisabled === true && r.drawn.continueDisabled === false,
        'empty=' + r.empty.continueDisabled + ' drawn=' + r.drawn.continueDisabled);
    check('V6 CONTROL: the disabled tooltip named the real reason',
        /no segments yet/.test(r.empty.continueTitle), r.empty.continueTitle);

    r = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, null);
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const ticked = window.__T.form();
        window.__T.layChain(4, [A, B, C, D]);            // still continuable
        window.refreshRouteWindowCounts();
        return { ticked, after: window.__T.form() };
    }, [A, B, C, D]);
    check('V7: a re-test does not disturb a tick the user already made',
        r.ticked.continueChecked === true && r.after.continueChecked === true &&
        r.after.continueDisabled === false);

    r = await page.evaluate(([A, B, C]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        const before = window.__T.form();
        window.__T.tickContinue(true);
        window.sectorRoutes = [];                        // the route is cleared
        window.refreshRouteWindowCounts();
        return { before, after: window.__T.form() };
    }, [A, B, C]);
    check('V8: a tick cannot outlive its precondition — it unticks itself',
        r.after.continueChecked === false && r.after.continueDisabled === true,
        'checked=' + r.after.continueChecked + ' disabled=' + r.after.continueDisabled);
    check('V8: and the form Continue rewrote is put back, not left half-edited',
        r.after.start === r.before.start && r.after.end === r.before.end &&
        JSON.stringify(r.after.waypoints) === JSON.stringify(r.before.waypoints),
        JSON.stringify(r.after));

    await page.evaluate(() => window.closeRouteWindow());

    // ── V9: continuing past two ends drops the saved setup, and says so ──────
    r = await page.evaluate(([A, B, C, D, E]) => {
        window.__T.layShape(4, [[A, B], [B, C], [B, D]]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        // Grow end C out to a FRESH world. Aiming at D instead would join two of
        // the route's own ends to each other and leave it with one — the setup
        // would then be kept, correctly, and this check would prove nothing.
        window.__T.fill(formatWorldLabel(C), formatWorldLabel(E), []);
        window.__T.generate();
        return { setup: window.__T.setup(4), toast: window.__lastToast,
                 ends: getRouteEnds(4).ends.length };
    }, [A, B, C, D, E]);
    check('V9: a route with more than two ends has its saved setup cleared',
        r.setup === null && r.ends > 2,
        r.ends + ' ends, setup=' + JSON.stringify(r.setup));
    check('V9: and the toast says so rather than leaving it to be discovered',
        /saved setup was cleared/.test(r.toast || ''), r.toast);

    // ── V10: the announced count is what was DRAWN, not what was walked ──────
    // At Jump-1 a leg that doubles back must retrace the route's own edges, and
    // addRoute skips every pair the slot already holds. Path length and segments
    // written therefore differ — which is the whole bug.
    r = await page.evaluate(([A, B, C, D]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 1 });
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const before = window.__T.segs(4).length;
        // From end C, back through A, then on to D: leg 1 retraces C-B-A entirely.
        window.__T.fill(formatWorldLabel(C), formatWorldLabel(D), [formatWorldLabel(A)]);
        window.__T.generate(1);
        const toast = window.__lastToast || '';
        const m = toast.match(/(\d+) segment\(s\) added/);
        return { before, after: window.__T.segs(4).length,
                 announced: m ? parseInt(m[1], 10) : null, toast };
    }, [A, B, C, D]);
    check('V10: the toast counts segments actually drawn, not edges walked',
        r.announced !== null && r.announced === (r.after - r.before),
        'announced ' + r.announced + ', drew ' + (r.after - r.before) + ' — ' + r.toast);
    check('V10 CONTROL: the leg really did retrace, so the two counts could differ',
        (r.after - r.before) === 1,
        (r.after - r.before) + ' drawn from a 5-edge walk');

    // ── V11: continuing towards a world the route already reaches ────────────
    r = await page.evaluate(([A, B, C]) => {
        window.__T.layChain(4, [A, B, C]);
        window.__T.setStored(4, { startId: A, endId: C, waypointIds: [B], maxJump: 3 });
        window.__T.openPanel(4);
        window.__T.tickContinue(true);
        const before = window.__T.segs(4);
        window.__T.fill(formatWorldLabel(A), formatWorldLabel(B), []);   // already joined
        window.__T.generate();
        return { before, after: window.__T.segs(4), toast: window.__lastToast };
    }, [A, B, C]);
    check('V11: "already connects" is reported, not "no path found"',
        /already connects/.test(r.toast || '') && !/Jump-/.test(r.toast || ''),
        r.toast);
    check('V11: and nothing on the map changed',
        JSON.stringify(r.before) === JSON.stringify(r.after));

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
