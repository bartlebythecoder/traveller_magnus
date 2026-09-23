// ---------------------------------------------------------------------------
// SYSTEM SHEET BINARY - both companion branches (orbitId present / absent).
//
// Part of the SYSTEM SHEET harness (v0.18.1). Run from the repo root:
//     node utilities/system_sheet_binary.js [sectorPath]
//
// `sectorPath` defaults to sectors/solo_6.json. **PASS A DIFFERENT SECTOR** to
// test another engine: solo_6 is 100% MgT2E and 100% fully-generated, so on
// its own it exercises exactly one of the five engines and never the
// UWP-only case. That gap is the whole reason these files were kept.
//
// Requires playwright, already in node_modules. Launches with --disable-gpu:
// see directives/terrain_spec.md 14.1 for why that matters in this project.
// ---------------------------------------------------------------------------
// BOTH branches of the companion path, because solo_6 only exercises one.
//   legacy  - companion has no orbitId  -> named in the star panel, NOT placed
//   modern  - companion has an orbitId  -> placed on the strip by distance
const { chromium } = require('playwright');
const SECTOR_ARG = process.argv.find(a => /\.json$/i.test(a));
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').replace(/\\/g, '/');
const SECTOR = SECTOR_ARG || (REPO + '/sectors/solo_6.json');
const OUT = __dirname + '/_sheet_binary';

(async () => {
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    const b = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto('file:///' + REPO + '/hex_map.html');
    await p.waitForTimeout(2500);

    const sector = JSON.parse(fs.readFileSync(SECTOR, 'utf8'));
    // 18-P-3240 Gokumenon is the 5-star system; 18-C-1905 Normannia is a binary.
    const ids = ['18-P-3240', '18-C-1905'];
    const sub = {}; for (const id of ids) sub[id] = sector.hexStates[id];
    await p.evaluate(({ sub, names }) => {
        for (const [k, v] of Object.entries(sub)) hexStates.set(k, v);
        window.sectorNames = names;
    }, { sub, names: sector.sectorNames });

    for (const id of ids) {
        for (const mode of ['legacy', 'modern']) {
            const r = await p.evaluate(({ hexId, mode }) => {
                const st = JSON.parse(JSON.stringify(hexStates.get(hexId)));
                const sys = st.mgtSystem || st.mgt2eData || null;
                // Find the stars array wherever it lives on this state.
                let stars = null;
                const scan = o => {
                    if (!o || typeof o !== 'object') return;
                    if (Array.isArray(o.stars) && o.stars.length) { stars = o.stars; return; }
                    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') scan(o[k]);
                };
                scan(st);
                if (!stars) return { err: 'no stars array found' };
                if (mode === 'modern') {
                    // What the SHIPPED engine writes today (mgt2e_stellar_engine ~815).
                    const orbits = [3, 6, 9, 11];
                    stars.slice(1).forEach((s, i) => { s.orbitId = orbits[i % orbits.length]; });
                } else {
                    stars.slice(1).forEach(s => { delete s.orbitId; delete s.orbitAU; });
                }
                hexStates.set(hexId + '#' + mode, st);
                const n = SystemViewer.normalizeSystem(st);
                const canvas = SystemSheet.render(st, hexId, { scale: 1 });
                if (!canvas) return { err: 'render null' };
                const comps = (n.stars || []).slice(1);
                const bodies = (n.worlds || []).filter(w => w && w.type !== 'Empty');
                return {
                    dataUrl: canvas.toDataURL('image/png'),
                    stars: (n.stars || []).length,
                    placed: comps.filter(s => s.orbitId != null).length,
                    bodies: bodies.length,
                };
            }, { hexId: id, mode });
            if (r.err) { console.log(id, mode, 'ERROR:', r.err); continue; }
            fs.writeFileSync(OUT + '/' + id + '_' + mode + '.png',
                             Buffer.from(r.dataUrl.split(',')[1], 'base64'));
            console.log(id.padEnd(12) + mode.padEnd(9)
                + 'stars=' + r.stars + '  companions placed on strip=' + r.placed
                + '  bodies=' + r.bodies);
        }
    }
    if (errs.length) console.log('\nPAGE ERRORS:\n  ' + errs.slice(0, 6).join('\n  '));
    else console.log('\nno page errors');
    await b.close();
})();
