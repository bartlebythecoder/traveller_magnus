// ---------------------------------------------------------------------------
// SYSTEM SHEET GALLERY - census a sector, then render its EXTREMES.
//
// Part of the SYSTEM SHEET harness (v0.18.1). Run from the repo root:
//     node utilities/system_sheet_gallery.js [sectorPath]
//
// `sectorPath` defaults to sectors/solo_6.json. **PASS A DIFFERENT SECTOR** to
// test another engine: solo_6 is 100% MgT2E and 100% fully-generated, so on
// its own it exercises exactly one of the five engines and never the
// UWP-only case. That gap is the whole reason these files were kept.
//
// Requires playwright, already in node_modules. Launches with --disable-gpu:
// see directives/terrain_spec.md 14.1 for why that matters in this project.
// ---------------------------------------------------------------------------
// SYSTEM SHEET GALLERY — the real quality test.
//
// Two jobs, in order:
//   1. CENSUS a whole real sector: how many systems fall inside the sheet's
//      current scope, and what the extremes of name length and body count are.
//   2. Render a spread chosen from those extremes, not a random sample — one
//      good example proves nothing, and neither do twenty average ones.
const { chromium } = require('playwright');
const SECTOR_ARG = process.argv.find(a => /\.json$/i.test(a));
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').replace(/\\/g, '/');
const SECTOR = SECTOR_ARG || (REPO + '/sectors/solo_6.json');
// Renders go to .tmp/ (gitignored), never utilities/ - see project_manifest.md.
// Default: .tmp/galleries/<sector file name>; override with --out=<dir>.
const OUT_ARG = process.argv.find(a => a.startsWith('--out='));
const OUT  = OUT_ARG ? OUT_ARG.slice(6)
           : path.resolve(__dirname, '..', '.tmp', 'galleries',
                          path.basename(SECTOR_ARG || 'solo_6.json', '.json').replace(/\W+/g, '_'));

(async () => {
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto('file:///' + REPO + '/hex_map.html');
    await page.waitForTimeout(2500);

    console.log('reading sector…');
    const sector = JSON.parse(fs.readFileSync(SECTOR, 'utf8'));
    const all = sector.hexStates;
    console.log('hex entries in file:', Object.keys(all).length);

    // Inject in chunks — one 17 MB evaluate argument is needlessly slow.
    const keys = Object.keys(all);
    const CHUNK = 2000;
    for (let i = 0; i < keys.length; i += CHUNK) {
        const part = {};
        for (const k of keys.slice(i, i + CHUNK)) part[k] = all[k];
        await page.evaluate(p => { for (const [k, v] of Object.entries(p)) hexStates.set(k, v); }, part);
    }
    await page.evaluate(({ names, settings }) => {
        if (names) window.sectorNames = names;
        if (settings && settings.terrainFieldVersion != null)
            window.terrainFieldVersion = settings.terrainFieldVersion;
    }, { names: sector.sectorNames, settings: sector.settings });
    console.log('injected.');

    // ── 1. CENSUS ───────────────────────────────────────────────────────────
    let census = await page.evaluate(() => {
        const rows = [];
        for (const [hexId, st] of hexStates.entries()) {
            let nsys = null;
            try { nsys = SystemViewer.normalizeSystem(st); } catch (e) { nsys = null; }
            if (!nsys) continue;
            const bodies = (nsys.worlds || []).filter(w => w && w.type !== 'Empty');
            // THE TWO BODILESS SHAPES (R5 and the stars-only ruling, 2026-09-23).
            // Skipping them left Spinward with a gallery of ZERO sheets - the
            // "green suite can be blind" failure: a missing shape, not a
            // missing assertion. They are censused separately so the charted
            // statistics below are unchanged.
            if (!bodies.length) {
                const rmw = nsys.reportedMainworld;
                rows.push({
                    hexId, kind: rmw ? 'reduced' : 'starsOnly',
                    name: st.name || (rmw && rmw.name) || '',
                    edition: nsys.edition, stars: (nsys.stars || []).length,
                    bodies: 0, belts: 0, ggs: 0, moons: 0, topMW: !!rmw, moonMW: false,
                    maxName: String(st.name || (rmw && rmw.name) || '').length, maxAU: 0,
                    zone: rmw ? String(rmw.travelZone || '') : '',
                });
                continue;
            }

            const isBelt = w => /belt/i.test(String(w.type || '')) || /belt/i.test(String(w.composition || ''));
            const isGG   = w => /gas ?giant/i.test(String(w.type || '')) || /\bGG\b/.test(String(w.composition || ''));
            const moons  = bodies.reduce((a, w) => a + (w.moons || []).filter(m => m && m.type !== 'Empty').length, 0);
            // A mainworld may be a MOON — normalizeSystem re-tags those.
            const topMW  = bodies.some(w => w.type === 'Mainworld');
            const moonMW = bodies.some(w => (w.moons || []).some(m => m && m.type === 'Mainworld'));

            let maxName = 0;
            for (const b of bodies) maxName = Math.max(maxName, String(b.name || '').length);

            rows.push({
                hexId, kind: 'full', name: nsys.name || '',
                edition: nsys.edition,
                stars: (nsys.stars || []).length,
                bodies: bodies.length,
                belts: bodies.filter(isBelt).length,
                ggs: bodies.filter(isGG).length,
                moons, topMW, moonMW,
                maxName,
                maxAU: bodies.reduce((a, w) => Math.max(a, w.au || 0), 0),
            });
        }
        return rows;
    });
    const bodiless = census.filter(r => r.kind !== 'full');
    census = census.filter(r => r.kind === 'full');
    console.log('bodiless hexes    : reduced ' + bodiless.filter(r => r.kind === 'reduced').length
        + '  stars-only ' + bodiless.filter(r => r.kind === 'starsOnly').length);

    console.log('\n════ CENSUS — ' + census.length + ' systems with body data ════\n');

    const pct = n => (100 * n / census.length).toFixed(1) + '%';
    const inScope = census.filter(r => r.stars === 1 && r.ggs === 0 && r.moons === 0);
    console.log('IN CURRENT SCOPE (1 star, 0 gas giants, 0 moons): '
        + inScope.length + ' of ' + census.length + '  (' + pct(inScope.length) + ')');
    console.log('  multi-star          : ' + census.filter(r => r.stars > 1).length + '  (' + pct(census.filter(r => r.stars > 1).length) + ')');
    console.log('  has gas giant(s)    : ' + census.filter(r => r.ggs > 0).length + '  (' + pct(census.filter(r => r.ggs > 0).length) + ')');
    console.log('  has moon(s)         : ' + census.filter(r => r.moons > 0).length + '  (' + pct(census.filter(r => r.moons > 0).length) + ')');
    console.log('  has belt(s)         : ' + census.filter(r => r.belts > 0).length + '  (' + pct(census.filter(r => r.belts > 0).length) + ')');
    console.log('  MAINWORLD IS A MOON : ' + census.filter(r => r.moonMW).length + '  (' + pct(census.filter(r => r.moonMW).length) + ')');
    console.log('  no top-level MW     : ' + census.filter(r => !r.topMW).length + '  (' + pct(census.filter(r => !r.topMW).length) + ')');

    const bodyCounts = census.map(r => r.bodies).sort((a, b) => a - b);
    const nameLens   = census.map(r => r.maxName).sort((a, b) => a - b);
    const q = (arr, p) => arr[Math.floor(arr.length * p)];
    console.log('\nbodies per system : min ' + bodyCounts[0] + '  median ' + q(bodyCounts, 0.5)
              + '  p95 ' + q(bodyCounts, 0.95) + '  max ' + bodyCounts[bodyCounts.length - 1]);
    console.log('longest body name : median ' + q(nameLens, 0.5)
              + '  p95 ' + q(nameLens, 0.95) + '  max ' + nameLens[nameLens.length - 1]);
    const byEd = {};
    for (const r of census) byEd[r.edition] = (byEd[r.edition] || 0) + 1;
    console.log('editions          : ' + JSON.stringify(byEd));

    // ── 2. PICK THE EXTREMES ────────────────────────────────────────────────
    const picks = [];
    const add = (label, row) => {
        if (row && !picks.some(p => p.hexId === row.hexId)) picks.push({ ...row, why: label });
    };
    const maxBy = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a))[0];
    const minBy = (arr, f) => arr.slice().sort((a, b) => f(a) - f(b))[0];

    add('fewest bodies',       minBy(census, r => r.bodies));
    add('most bodies',         maxBy(census, r => r.bodies));
    add('longest name',        maxBy(census, r => r.maxName));
    add('most moons',          maxBy(census, r => r.moons));
    add('most gas giants',     maxBy(census, r => r.ggs));
    add('most stars',          maxBy(census, r => r.stars));
    add('most belts',          maxBy(census, r => r.belts));
    add('widest system (AU)',  maxBy(census, r => r.maxAU));
    add('tightest system',     minBy(census.filter(r => r.bodies > 3), r => r.maxAU));
    add('MAINWORLD IS A MOON', census.find(r => r.moonMW));
    add('no top-level MW',     census.find(r => !r.topMW));
    add('2 bodies',            census.find(r => r.bodies === 2));
    add('3 bodies',            census.find(r => r.bodies === 3));
    // Spread the remainder evenly across the sector for ordinary cases.
    const step = Math.max(1, Math.floor(census.length / 8));
    for (let i = 0; i < census.length && picks.length < 21; i += step) add('spread', census[i]);

    // The bodiless shapes get their own extremes: binary/trinary, the longest
    // name (the brief spans two columns), each travel zone, and a spread.
    const reduced = bodiless.filter(r => r.kind === 'reduced');
    const starsOnly = bodiless.filter(r => r.kind === 'starsOnly');
    add('reduced: most stars',   maxBy(reduced, r => r.stars));
    add('reduced: longest name', maxBy(reduced, r => r.maxName));
    add('reduced: Red zone',     reduced.find(r => /^r/i.test(r.zone)));
    add('reduced: Amber zone',   reduced.find(r => /^a/i.test(r.zone)));
    add('reduced: Green zone',   reduced.find(r => /^g/i.test(r.zone)));
    const rstep = Math.max(1, Math.floor(reduced.length / 4));
    for (let i = 0, k = 0; i < reduced.length && k < 4; i += rstep, k++) add('reduced: spread', reduced[i]);
    add('stars only: most stars', maxBy(starsOnly, r => r.stars));
    add('stars only: single',     starsOnly.find(r => r.stars === 1));

    console.log('\n════ RENDERING ' + picks.length + ' SHEETS ════\n');
    console.log('why'.padEnd(21) + 'hex'.padEnd(12) + 'name'.padEnd(15)
              + 'bod'.padEnd(5) + 'st'.padEnd(4) + 'GG'.padEnd(4) + 'mn'.padEnd(4)
              + 'nameLen'.padEnd(9) + 'ms'.padEnd(7) + 'KB');

    const results = [];
    for (const p of picks) {
        const r = await page.evaluate(async (hexId) => {
            const st = hexStates.get(hexId);
            const t0 = performance.now();
            let canvas = null, err = null;
            try { canvas = SystemSheet.render(st, hexId, { scale: 1 }); }
            catch (e) { err = e.message; }
            if (!canvas) return { err: err || 'render returned null' };
            return { dataUrl: canvas.toDataURL('image/png'), ms: Math.round(performance.now() - t0) };
        }, p.hexId);

        if (r.err) {
            console.log(p.why.padEnd(21) + p.hexId.padEnd(12) + 'RENDER FAILED: ' + r.err);
            results.push({ ...p, failed: r.err });
            continue;
        }
        const buf = Buffer.from(r.dataUrl.split(',')[1], 'base64');
        const file = `${OUT}/${String(picks.indexOf(p)).padStart(2, '0')}_${p.why.replace(/\W+/g, '_')}_${p.hexId}.png`;
        fs.writeFileSync(file, buf);
        console.log(p.why.padEnd(21) + p.hexId.padEnd(12) + String(p.name).slice(0, 14).padEnd(15)
                  + String(p.bodies).padEnd(5) + String(p.stars).padEnd(4) + String(p.ggs).padEnd(4)
                  + String(p.moons).padEnd(4) + String(p.maxName).padEnd(9)
                  + String(r.ms).padEnd(7) + Math.round(buf.length / 1024));
        results.push({ ...p, ms: r.ms, kb: Math.round(buf.length / 1024), file });
    }

    fs.writeFileSync(OUT + '/census.json', JSON.stringify({ census, picks: results }, null, 1));
    if (errors.length) console.log('\nPAGE ERRORS:\n  ' + errors.slice(0, 10).join('\n  '));
    else console.log('\nno page errors');
    await browser.close();
})();
