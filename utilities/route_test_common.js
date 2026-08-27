/**
 * route_test_common.js — shared bootstrap for the route test harnesses.
 *
 * Drives the real `hex_map.html` in a real browser via Playwright, because
 * `node --check` has repeatedly missed real bugs in this codebase: the app is a
 * single page of globals with no module boundary, so the only honest test is the
 * running application.
 *
 * Used by:
 *   utilities/route_corpus.js — captures every segment every generator produces,
 *                               so a refactor can be PROVED route-identical.
 *   utilities/route_perf.js   — times the pathfinder as world count grows.
 *
 * Requires Playwright, which lives in the repo's node_modules. From the repo root:
 *   node utilities/route_corpus.js --out before.json
 *
 * ── Why the map is built here and not by the app ─────────────────────────────
 * The app's own generation is seeded (mulberry32 via masterSeed) but it is also
 * the thing under test, and it changes between releases. A corpus captured with
 * it would drift for reasons that have nothing to do with routing. So these
 * harnesses write hexStates directly using their OWN generator — a plain LCG
 * defined below — which is frozen forever and owes nothing to js/core.js.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const APP_URL   = 'file:///' + path.join(REPO_ROOT, 'hex_map.html').split(path.sep).join('/');

function requirePlaywright() {
    try {
        return require(path.join(REPO_ROOT, 'node_modules', 'playwright'));
    } catch (e) {
        console.error('Playwright not found in node_modules. Run this from the repo root.');
        throw e;
    }
}

/**
 * Boots the app past its splash screen and returns { browser, page }.
 * Page errors are collected on `page._errors` so a harness can fail on them.
 */
async function launchApp({ headless = true, viewport = { width: 1600, height: 1000 } } = {}) {
    const { chromium } = requirePlaywright();
    const browser = await chromium.launch({ headless });
    const page = await browser.newPage({ viewport });
    page._errors = [];
    page.on('pageerror', e => page._errors.push(String(e)));
    await page.goto(APP_URL);
    await page.click('#btn-launch-app');
    await page.waitForFunction(() => typeof window.hexStates !== 'undefined'
                                  && typeof window.getHexId === 'function');
    return { browser, page };
}

/**
 * The map builder, injected into the page.
 *
 * Populates hexStates deterministically over the rectangle [0,cols) x [0,rows)
 * at the given density. Every field any route generator reads is supplied:
 *
 *   starport/tl/pop/tradeCodes/navalBase/scoutBase — calculateT5Ix (XBoat)
 *   WTN                                            — generateBTNRoutes
 *   travelZone                                     — XBoat and BTN both bar Red
 *                                                    worlds as intermediaries
 *
 * Omitting any of these does not error; it silently produces an empty route,
 * which would make a corpus that "passes" while proving nothing.
 *
 * `isolate` marks a hex SYSTEM_PRESENT but surrounds it with vacuum, giving the
 * unreachable-destination scenarios a target that genuinely cannot be reached.
 */
const BUILD_MAP_FN = function buildMapInPage(cfg) {
    // Frozen LCG (Numerical Recipes constants). Deliberately NOT the app's
    // mulberry32: this corpus must not move when js/core.js does.
    let _s = cfg.seed >>> 0;
    const rnd = () => {
        _s = (Math.imul(1664525, _s) + 1013904223) >>> 0;
        return _s / 4294967296;
    };
    const pick = arr => arr[Math.floor(rnd() * arr.length)];

    window.sectorRoutes = [];
    hexStates.clear();

    const STARPORTS = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'E', 'X'];
    const ZONES     = ['Green', 'Green', 'Green', 'Green', 'Green',
                       'Green', 'Green', 'Green', 'Amber', 'Red'];
    const CODES     = ['Ag', 'Hi', 'In', 'Ri', 'Ni', 'Na', 'Po', 'Wa'];

    let made = 0;
    for (let q = 0; q < cfg.cols; q++) {
        for (let r = 0; r < cfg.rows; r++) {
            if (rnd() >= cfg.density) continue;
            const id = getHexId(q, r);
            if (!id) continue;

            const nCodes = Math.floor(rnd() * 3);
            const tradeCodes = [];
            for (let c = 0; c < nCodes; c++) {
                const code = pick(CODES);
                if (!tradeCodes.includes(code)) tradeCodes.push(code);
            }

            hexStates.set(id, {
                type: 'SYSTEM_PRESENT',
                mgt2eData: {
                    name:       'W' + q + '_' + r,
                    uwp:        'A788899-C',
                    starport:   pick(STARPORTS),
                    // Ranges chosen so calculateT5Ix produces a realistic SPREAD
                    // that actually reaches Ix 4+. A flat 0..15 tl and 0..10 pop
                    // made Ix 4 so rare that the XBoat scenarios at the app's
                    // default minIx of 4 found nothing to connect.
                    tl:         5 + Math.floor(rnd() * 11),
                    pop:        3 + Math.floor(rnd() * 8),
                    tradeCodes: tradeCodes,
                    navalBase:  rnd() < 0.15,
                    scoutBase:  rnd() < 0.2,
                    // BTN's own floor is applied by the caller's lowerBTN; the
                    // spread here is what makes maxBTN/minBTN filtering bite.
                    WTN:        Math.round((3 + rnd() * 9) * 2) / 2,
                    travelZone: pick(ZONES)
                }
            });
            made++;
        }
    }

    // An island: a world with nothing within many hexes of it, so a leg aimed at
    // it exhausts the whole search. This is the case a permissive second pass
    // would run after, and the worst case for the pathfinder.
    let islandId = null;
    if (cfg.island) {
        const iq = cfg.cols - 2, ir = cfg.rows - 2;
        islandId = getHexId(iq, ir);
        // Radius must exceed the maxJump the scenario uses, or the "island" is
        // still reachable and the no-path timing silently measures a found path.
        const rad = cfg.islandRadius || 8;
        if (islandId) {
            for (let dq = -rad; dq <= rad; dq++) {
                for (let dr = -rad; dr <= rad; dr++) {
                    const nid = getHexId(iq + dq, ir + dr);
                    if (nid && nid !== islandId) hexStates.delete(nid);
                }
            }
            hexStates.set(islandId, {
                type: 'SYSTEM_PRESENT',
                mgt2eData: {
                    name: 'Island', uwp: 'A788899-C', starport: 'A', tl: 12, pop: 8,
                    tradeCodes: ['Hi'], navalBase: true, scoutBase: true,
                    WTN: 9, travelZone: 'Green'
                }
            });
        }
    }

    const ids = [...hexStates.keys()].sort();
    return { worlds: hexStates.size, made, islandId, first: ids[0], last: ids[ids.length - 1], ids };
};

/**
 * Builds a map in the page. Returns { worlds, islandId, ids, ... }.
 * `gridW`/`gridH` are set first because getHexId's bounds depend on them.
 */
async function buildMap(page, cfg) {
    return page.evaluate(({ fnSrc, cfg }) => {
        gridWidth  = cfg.gridW;
        gridHeight = cfg.gridH;
        // eslint-disable-next-line no-new-func
        const fn = new Function('return ' + fnSrc)();
        return fn(cfg);
    }, { fnSrc: BUILD_MAP_FN.toString(), cfg });
}

/**
 * Every segment currently on the map, as sorted `routeId|type|subtype|start>end`
 * strings. Sorted so array order — which is an implementation detail of the
 * generators — cannot show up as a false difference. Nothing time-based is
 * included, so two runs of unchanged code produce identical output.
 */
async function fingerprint(page) {
    return page.evaluate(() => (window.sectorRoutes || [])
        .map(r => [
            r.routeId == null ? '-' : r.routeId,
            r.type    || '-',
            r.subtype || '-',
            r.startId + '>' + r.endId
        ].join('|'))
        .sort());
}

/** Empties the map's routes without touching hexStates. */
async function clearRoutes(page) {
    await page.evaluate(() => { window.sectorRoutes = []; });
}

/**
 * Marks every world NOT in `keepIds` as hidden by the filter, which is what
 * getFilteredHexIds() reads. Set directly rather than driven through the filter
 * UI so the corpus does not depend on the filter form's markup.
 */
async function applyFilterSubset(page, keepIds) {
    await page.evaluate(keep => {
        const keepSet = new Set(keep);
        hexStates.forEach((st, id) => { st.isHiddenByFilter = !keepSet.has(id); });
    }, keepIds);
}

async function clearFilter(page) {
    await page.evaluate(() => { hexStates.forEach(st => { st.isHiddenByFilter = false; }); });
}

module.exports = {
    APP_URL, REPO_ROOT,
    launchApp, buildMap, fingerprint, clearRoutes,
    applyFilterSubset, clearFilter
};
