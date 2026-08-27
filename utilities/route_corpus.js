/**
 * route_corpus.js — the route corpus differ.
 *
 * Captures every segment every route generator produces, across a fixed set of
 * scenarios, and writes them to JSON. Run it before a change and after, then
 * diff, and "this refactor changes no routes" stops being a claim and becomes a
 * measurement.
 *
 * This is what proved WP0 (the v0.17.2 pathfinder rewrite) route-identical:
 * 19 scenarios, 2,603 segments, byte-for-byte the same before and after.
 *
 * USAGE (from the repo root):
 *   node utilities/route_corpus.js --out tmp/before.json
 *   ...make the change...
 *   node utilities/route_corpus.js --out tmp/after.json
 *   node utilities/route_corpus.js --diff tmp/before.json tmp/after.json
 *
 * Or capture and compare in one step:
 *   node utilities/route_corpus.js --against tmp/before.json
 *
 * Exit code is 0 when the corpora match, 1 when they differ — so it can gate a
 * commit.
 *
 * ── Reading a failure ────────────────────────────────────────────────────────
 * A difference is not automatically a bug. It means the change altered routes,
 * which is fine if that WAS the change. What the differ buys is that you find
 * out, and you find out exactly which scenario and which segments.
 */

const fs   = require('fs');
const path = require('path');
const {
    launchApp, buildMap, fingerprint, clearRoutes, applyFilterSubset, clearFilter
} = require('./route_test_common');

// ── The two maps ─────────────────────────────────────────────────────────────
// One sector-sized, one spanning four sectors. Cross-sector routes exercise
// getHexId/getHexCoords' sector arithmetic, which per-sector code gets wrong in
// ways a single-sector corpus never sees.
const MAPS = {
    single: { seed: 20260819, gridW: 7, gridH: 5, cols: 32, rows: 40, density: 0.42, island: true },
    multi:  { seed: 19770310, gridW: 7, gridH: 5, cols: 64, rows: 80, density: 0.18, island: true }
};

/**
 * Picks `n` world IDs spread across the map by index, so stop choices are
 * deterministic and far apart rather than clustered.
 */
function spread(ids, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(ids[Math.floor((i + 0.5) * ids.length / n)]);
    return out;
}

/**
 * The scenarios. Each returns nothing; it just drives generators into the page.
 * `ctx` carries the map's world IDs and its island.
 */
function buildScenarios(ctx) {
    const { ids, islandId } = ctx;
    const [a, b, c, d, e, f, g, h] = spread(ids, 8);

    const p2p = (name, args) => ({ name, run: page => page.evaluate(a2 =>
        generatePointToPointRoute(
            a2.startId, a2.endId, a2.maxJump, '#00ff00', a2.groupId, a2.name,
            a2.filteredOnly, a2.filteredHexIds, a2.routeId, a2.waypointIds,
            a2.allowEmptyHexes, a2.maxEmptyJumps
        ), Object.assign({
            groupId: 'corpus_' + name, name,
            // filteredOnly is ALWAYS true in the app — the P2P caller passes
            // getFilteredHexIds(), which returns every visible world when no
            // filter is set. Defaulting this to [] instead of `ids` left the
            // traversal graph holding nothing but the stops, and every P2P
            // scenario silently produced zero segments.
            filteredOnly: true, filteredHexIds: ids,
            routeId: 4, waypointIds: [], allowEmptyHexes: false, maxEmptyJumps: 1
        }, args)) });

    return [
        // ── Point-to-Point: jump range ──────────────────────────────────────
        p2p('p2p_j2',  { startId: a, endId: h, maxJump: 2 }),
        p2p('p2p_j3',  { startId: a, endId: h, maxJump: 3 }),
        p2p('p2p_j4',  { startId: a, endId: h, maxJump: 4 }),

        // ── Waypoints: the multi-leg path, where per-leg behaviour shows ────
        p2p('p2p_wp3', { startId: a, endId: h, maxJump: 3, waypointIds: [c, e, g] }),
        p2p('p2p_wp5', { startId: a, endId: h, maxJump: 4, waypointIds: [b, c, d, e, f] }),

        // ── Unreachable: full exhaustion, the pathfinder's worst case ───────
        p2p('p2p_island_j2', { startId: a, endId: islandId, maxJump: 2 }),
        p2p('p2p_island_j4', { startId: a, endId: islandId, maxJump: 4 }),

        // ── Empty-hex traversal at each budget ──────────────────────────────
        p2p('p2p_empty_b1', { startId: a, endId: h, maxJump: 2, allowEmptyHexes: true, maxEmptyJumps: 1 }),
        p2p('p2p_empty_b2', { startId: a, endId: h, maxJump: 2, allowEmptyHexes: true, maxEmptyJumps: 2 }),
        p2p('p2p_empty_b3', { startId: a, endId: h, maxJump: 2, allowEmptyHexes: true, maxEmptyJumps: 3 }),

        // ── Filtered: the traversal set is a subset of the map ──────────────
        {
            name: 'p2p_filtered',
            run: async (page) => {
                const keep = ids.filter((_, i) => i % 3 !== 0);
                await applyFilterSubset(page, keep);
                await page.evaluate(a2 => generatePointToPointRoute(
                    a2.startId, a2.endId, 3, '#00ff00', 'corpus_filtered', 'filtered',
                    true, a2.keep, 4, [], false, 1
                ), { startId: a, endId: h, keep });
                await clearFilter(page);
            }
        },

        // ── A deliberate deep-space stop (supported since v0.17.1) ──────────
        {
            name: 'p2p_deepspace_stop',
            run: async (page) => {
                const vac = await page.evaluate(() => {
                    for (let q = 0; q < gridWidth * 32; q++) {
                        for (let r = 0; r < gridHeight * 40; r++) {
                            const id = getHexId(q, r);
                            if (id && isVacantHex(id)) return id;
                        }
                    }
                    return null;
                });
                if (!vac) return;
                await page.evaluate(a2 => generatePointToPointRoute(
                    a2.startId, a2.endId, 4, '#00ff00', 'corpus_deep', 'deep',
                    true, a2.ids, 4, [a2.vac], false, 1
                ), { startId: a, endId: h, vac, ids });
            }
        },

        // ── XBoat ───────────────────────────────────────────────────────────
        { name: 'xboat_j4_r12_ix4', run: p => p.evaluate(() => generateXboatRoutes(4, 12, 4, 1, 'corpus_xb1')) },
        { name: 'xboat_j2_r8_ix3',  run: p => p.evaluate(() => generateXboatRoutes(2,  8, 3, 1, 'corpus_xb2')) },

        // ── Custom Network ──────────────────────────────────────────────────
        { name: 'net_j2_r6',        run: p => p.evaluate(ids2 =>
            generateAutoRoutes(ids2, 2, 6, '#ff8800', 'corpus_n1', 'n1', 5, false, 1), ids) },
        { name: 'net_j3_r10_e1',    run: p => p.evaluate(ids2 =>
            generateAutoRoutes(ids2, 3, 10, '#ff8800', 'corpus_n2', 'n2', 5, true, 1), ids) },
        { name: 'net_j4_r12_e2',    run: p => p.evaluate(ids2 =>
            generateAutoRoutes(ids2, 4, 12, '#ff8800', 'corpus_n3', 'n3', 5, true, 2), ids) },

        // ── BTN ─────────────────────────────────────────────────────────────
        { name: 'btn_8_9_open',     run: p => p.evaluate(() => generateBTNRoutes({
            lowerBTN: 8, minBTN: 9, maxBTN: null, maxJump: 2, range: 20,
            color: '#aa66ff', groupId: 'corpus_b1', name: 'b1', routeId: 6 })) },
        { name: 'btn_7_8_cap11',    run: p => p.evaluate(() => generateBTNRoutes({
            lowerBTN: 7, minBTN: 8, maxBTN: 11, maxJump: 3, range: 30,
            color: '#aa66ff', groupId: 'corpus_b2', name: 'b2', routeId: 7 })) }
    ];
}

async function capture({ headless = true } = {}) {
    const { browser, page } = await launchApp({ headless });
    const corpus = { capturedBy: 'route_corpus.js', maps: {} };
    let totalSegments = 0, totalScenarios = 0;

    try {
        for (const [mapName, cfg] of Object.entries(MAPS)) {
            const info = await buildMap(page, cfg);
            const ctx = { ids: info.ids, islandId: info.islandId };
            const scenarios = buildScenarios(ctx);

            corpus.maps[mapName] = { worlds: info.worlds, scenarios: {} };
            process.stderr.write(`[${mapName}] ${info.worlds} worlds\n`);

            for (const sc of scenarios) {
                await clearRoutes(page);
                await sc.run(page);
                const fp = await fingerprint(page);
                corpus.maps[mapName].scenarios[sc.name] = fp;
                totalSegments += fp.length;
                totalScenarios++;
                process.stderr.write(`  ${sc.name.padEnd(22)} ${String(fp.length).padStart(5)} segment(s)\n`);
            }
        }
        corpus.totals = { scenarios: totalScenarios, segments: totalSegments };
        if (page._errors.length) {
            corpus.pageErrors = page._errors;
            process.stderr.write(`\n!! ${page._errors.length} page error(s): ${page._errors.join(' | ')}\n`);
        }
    } finally {
        await browser.close();
    }
    return corpus;
}

/** Compares two corpora and prints every difference. Returns true if identical. */
function diff(before, after) {
    let same = true;
    const mapNames = new Set([...Object.keys(before.maps || {}), ...Object.keys(after.maps || {})]);

    for (const m of mapNames) {
        const bm = (before.maps || {})[m], am = (after.maps || {})[m];
        if (!bm || !am) { console.log(`MAP ${m}: present in only one corpus`); same = false; continue; }

        const scNames = new Set([...Object.keys(bm.scenarios), ...Object.keys(am.scenarios)]);
        for (const s of scNames) {
            const bs = bm.scenarios[s], as = am.scenarios[s];
            if (!bs || !as) { console.log(`${m}/${s}: present in only one corpus`); same = false; continue; }

            if (bs.length !== as.length || bs.some((v, i) => v !== as[i])) {
                same = false;
                const bSet = new Set(bs), aSet = new Set(as);
                const gone  = bs.filter(v => !aSet.has(v));
                const added = as.filter(v => !bSet.has(v));
                console.log(`\n${m}/${s}: ${bs.length} -> ${as.length} segment(s)`);
                gone.slice(0, 8).forEach(v  => console.log(`  - ${v}`));
                if (gone.length  > 8) console.log(`  - ...and ${gone.length - 8} more removed`);
                added.slice(0, 8).forEach(v => console.log(`  + ${v}`));
                if (added.length > 8) console.log(`  + ...and ${added.length - 8} more added`);
            }
        }
    }
    return same;
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

(async () => {
    const argv = process.argv.slice(2);
    const arg  = k => { const i = argv.indexOf(k); return i === -1 ? null : argv[i + 1]; };

    // Pure diff of two files on disk — no browser needed.
    if (argv.includes('--diff')) {
        const i = argv.indexOf('--diff');
        const identical = diff(readJson(argv[i + 1]), readJson(argv[i + 2]));
        console.log(identical ? '\nIDENTICAL — no route changed.' : '\nDIFFERENCES FOUND (see above).');
        process.exit(identical ? 0 : 1);
    }

    const corpus = await capture({ headless: !argv.includes('--headed') });
    console.error(`\n${corpus.totals.scenarios} scenarios, ${corpus.totals.segments} segments.`);

    const outPath = arg('--out');
    if (outPath) {
        fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(corpus, null, 1));
        console.error(`Written to ${outPath}`);
    }

    const againstPath = arg('--against');
    if (againstPath) {
        const identical = diff(readJson(againstPath), corpus);
        console.log(identical
            ? `\nIDENTICAL to ${againstPath} — no route changed.`
            : '\nDIFFERENCES FOUND (see above).');
        process.exit(identical ? 0 : 1);
    }

    if (!outPath && !againstPath) {
        console.log(JSON.stringify(corpus, null, 1));
    }
})();
