/**
 * route_perf.js — times the route pathfinder as world count grows.
 *
 * Density is held CONSTANT (every hex is populated) and only the area grows, so
 * the single variable is world count. Anything else — a denser map at the same
 * size, say — changes neighbourhood size too and muddles the reading.
 *
 * Three measures, in increasing order of how much a user feels them:
 *
 *   long leg      — corner to corner, a path exists. The common case.
 *   no path       — aimed at a walled-off world, so the search exhausts the
 *                   whole map. The worst case, and the one any permissive
 *                   second pass would run AFTER a failed first pass.
 *   19-leg route  — start to end through 18 waypoints, which is the number a
 *                   user actually sits and waits for. This is the measure that
 *                   went from 25.3 s to 0.2 s in v0.17.2.
 *
 * USAGE (from the repo root):
 *   node utilities/route_perf.js
 *   node utilities/route_perf.js --quick      (skip the two largest sizes)
 *   node utilities/route_perf.js --json out.json
 *
 * Baselines to compare against live in directives/route_partial_spec.md §9
 * (before the v0.17.2 spatial index) and §9.1 (after it). Reproduce those
 * numbers before trusting a new one: an idle laptop and a busy one differ by
 * more than some of the changes being measured.
 */

const fs = require('fs');
const { launchApp, buildMap } = require('./route_test_common');

// Every hex populated; only the area changes. Targets roughly match the world
// counts in the spec's tables so the readings line up with the recorded history.
const SIZES = [
    { label: '~480',    cols: 24,  rows: 20  },
    { label: '~1,200',  cols: 30,  rows: 40  },
    { label: '~2,560',  cols: 32,  rows: 80  },
    { label: '~5,760',  cols: 48,  rows: 120 },
    { label: '~10,240', cols: 64,  rows: 160 },
    { label: '~16,000', cols: 100, rows: 160 }
];

const MAX_JUMP = 2;   // island radius below must exceed this
const REPEATS  = 3;   // report the best of N, to blunt scheduler noise

/** Runs fn in the page REPEATS times, returns the fastest wall time in ms. */
async function timeBest(page, fnBody, args) {
    let best = Infinity, sample = null;
    for (let i = 0; i < REPEATS; i++) {
        const r = await page.evaluate(fnBody, args);
        if (r.ms < best) { best = r.ms; sample = r; }
    }
    return { ms: best, ...sample };
}

const TIME_P2P = (a) => {
    window.sectorRoutes = [];
    const t0 = performance.now();
    const res = generatePointToPointRoute(
        a.startId, a.endId, a.maxJump, '#00ff00', 'perf', 'perf',
        true, a.ids, 4, a.waypointIds || [], false, 1
    );
    const ms = performance.now() - t0;
    return { ms, segments: res.segments, failed: !!res.failure };
};

(async () => {
    const argv  = process.argv.slice(2);
    const sizes = argv.includes('--quick') ? SIZES.slice(0, 4) : SIZES;
    const { browser, page } = await launchApp();
    const rows = [];

    try {
        for (const size of sizes) {
            const info = await buildMap(page, {
                seed: 20260827, gridW: 7, gridH: 5,
                cols: size.cols, rows: size.rows,
                density: 1.0,            // constant density is the whole point
                island: true, islandRadius: MAX_JUMP + 3
            });

            const ids = info.ids;
            // Corner to corner. ids are sorted by hex ID, which sorts by sector
            // then subsector then local coords — so first and last are genuinely
            // far apart on a rectangular map.
            const startId = ids[0];
            const endId   = ids.filter(i => i !== info.islandId).pop();

            const longLeg = await timeBest(page, TIME_P2P,
                { startId, endId, maxJump: MAX_JUMP, ids });

            const noPath = await timeBest(page, TIME_P2P,
                { startId, endId: info.islandId, maxJump: MAX_JUMP, ids });

            // 19 legs = start + 18 waypoints + end, spread across the map.
            const waypointIds = [];
            const usable = ids.filter(i => i !== info.islandId);
            for (let k = 1; k <= 18; k++) {
                waypointIds.push(usable[Math.floor(k * usable.length / 19)]);
            }
            const legs19 = await timeBest(page, TIME_P2P,
                { startId, endId, maxJump: MAX_JUMP, ids, waypointIds });

            const row = {
                label: size.label, worlds: info.worlds,
                longLegMs: +longLeg.ms.toFixed(1), longLegSegments: longLeg.segments,
                noPathMs:  +noPath.ms.toFixed(1),  noPathFailed: noPath.failed,
                legs19Ms:  +legs19.ms.toFixed(1),  legs19Segments: legs19.segments
            };
            rows.push(row);

            // A "no path" run that found a path is measuring the wrong thing.
            if (!noPath.failed) {
                console.error(`  !! ${size.label}: the no-path leg FOUND a path — `
                            + `island radius too small for maxJump ${MAX_JUMP}. Reading is invalid.`);
            }
            console.error(`  ${size.label.padStart(8)}  ${String(info.worlds).padStart(6)} worlds  `
                        + `long ${String(row.longLegMs).padStart(8)}ms  `
                        + `nopath ${String(row.noPathMs).padStart(8)}ms  `
                        + `19-leg ${String(row.legs19Ms).padStart(8)}ms`);
        }

        if (page._errors.length) {
            console.error(`\n!! ${page._errors.length} page error(s): ${page._errors.join(' | ')}`);
        }
    } finally {
        await browser.close();
    }

    console.log('\n|  worlds | long leg, path found | leg with no path | 19-leg route |');
    console.log('|--------:|---------------------:|-----------------:|-------------:|');
    for (const r of rows) {
        console.log(`| ${String(r.worlds).padStart(7)} | ${String(r.longLegMs).padStart(17)} ms `
                  + `| ${String(r.noPathMs).padStart(13)} ms | ${String(r.legs19Ms).padStart(9)} ms |`);
    }

    // Growth factor between the two largest sizes: ~1.0x per 1.0x worlds is
    // linear (what the spatial index bought); ~2.4x per 1.56x is quadratic.
    if (rows.length >= 2) {
        const a = rows[rows.length - 2], b = rows[rows.length - 1];
        const wf = b.worlds / a.worlds;
        console.log(`\nworlds x${wf.toFixed(2)} -> long leg x${(b.longLegMs / a.longLegMs).toFixed(2)}, `
                  + `no-path x${(b.noPathMs / a.noPathMs).toFixed(2)}, `
                  + `19-leg x${(b.legs19Ms / a.legs19Ms).toFixed(2)}  (linear ~x${wf.toFixed(2)})`);
    }

    const i = argv.indexOf('--json');
    if (i !== -1 && argv[i + 1]) {
        fs.writeFileSync(argv[i + 1], JSON.stringify({ maxJump: MAX_JUMP, repeats: REPEATS, rows }, null, 1));
        console.error(`Written to ${argv[i + 1]}`);
    }
})();
