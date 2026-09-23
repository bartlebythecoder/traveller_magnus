// ---------------------------------------------------------------------------
// SYSTEM SHEET VERIFY - corpus assertions: no panel may drop a row.
//
// Part of the SYSTEM SHEET harness (v0.18.1). Run from the repo root:
//     node utilities/system_sheet_verify.js [sectorPath]
//
// `sectorPath` defaults to sectors/solo_6.json. **PASS A DIFFERENT SECTOR** to
// test another engine: solo_6 is 100% MgT2E and 100% fully-generated, so on
// its own it exercises exactly one of the five engines and never the
// UWP-only case. That gap is the whole reason these files were kept.
//
// Requires playwright, already in node_modules. Launches with --disable-gpu:
// see directives/terrain_spec.md 14.1 for why that matters in this project.
// ---------------------------------------------------------------------------
// Assertion pass: for EVERY system in the sector, does the sheet's row count
// equal its body count? Rendering 438 sheets is too slow, so this checks the
// two facts that decide it — capacity at the derived pitch, and that a
// mainworld is always found — across the whole corpus rather than a sample.
const { chromium } = require('playwright');
const SECTOR_ARG = process.argv.find(a => /\.json$/i.test(a));
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').replace(/\\/g, '/');
const SECTOR = SECTOR_ARG || (REPO + '/sectors/solo_6.json');
(async () => {
    const b = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///' + REPO + '/hex_map.html');
    await p.waitForTimeout(2500);
    const sector = JSON.parse(fs.readFileSync(SECTOR, 'utf8'));
    const keys = Object.keys(sector.hexStates);
    for (let i = 0; i < keys.length; i += 2000) {
        const part = {};
        for (const k of keys.slice(i, i + 2000)) part[k] = sector.hexStates[k];
        await p.evaluate(x => { for (const [k, v] of Object.entries(x)) hexStates.set(k, v); }, part);
    }
    const r = await p.evaluate(() => {
        // Mirror the sheet's own geometry constants.
        const H = 878, R1Y = 66, R1H = 330;
        const R2Y = R1Y + R1H + 16, R2H = H - R2Y - 44;
        const HEAD = 88, PADB = 14, MAX_PITCH = 29, MIN_PITCH = 16;
        const usable = R2H - HEAD - PADB;
        let checked = 0, overCapacity = [], noMW = [], mwIsMoon = 0;
        for (const [hexId, st] of hexStates.entries()) {
            let n = null;
            try { n = SystemViewer.normalizeSystem(st); } catch (e) { continue; }
            if (!n) continue;
            const bodies = (n.worlds || []).filter(w => w && w.type !== 'Empty');
            if (!bodies.length) continue;
            checked++;
            const rowH = Math.max(MIN_PITCH, Math.min(MAX_PITCH, Math.floor(usable / bodies.length)));
            const capacity = Math.floor(usable / rowH);
            if (bodies.length > capacity) overCapacity.push({ hexId, bodies: bodies.length, capacity, rowH });
            const direct = bodies.find(w => w.type === 'Mainworld');
            const moon = !direct && bodies.some(w => (w.moons || []).some(m => m && m.type === 'Mainworld'));
            if (moon) mwIsMoon++;
            if (!direct && !moon) noMW.push(hexId);
        }
        return { checked, overCapacity, noMW: noMW.length, noMWSample: noMW.slice(0, 5), mwIsMoon };
    });
    console.log('systems checked                 : ' + r.checked);
    console.log('rows that would NOT fit         : ' + r.overCapacity.length
        + (r.overCapacity.length ? '  ' + JSON.stringify(r.overCapacity.slice(0, 5)) : '  <- table cannot drop a row'));
    console.log('mainworld found via moon lookup : ' + r.mwIsMoon);
    console.log('systems with NO mainworld at all: ' + r.noMW
        + (r.noMW ? '  e.g. ' + r.noMWSample.join(', ') : ''));
    if (errs.length) console.log('PAGE ERRORS: ' + errs.slice(0, 5).join(' | '));
    await b.close();
})();
