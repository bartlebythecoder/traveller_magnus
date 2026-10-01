// ---------------------------------------------------------------------------
// SYSTEM SHEET SWEEP - render EVERY hex in one or more sectors and report throws.
//
// Part of the SYSTEM SHEET harness (v0.18.1). Run from the repo root:
//     node utilities/system_sheet_sweep.js <sector.json> [more.json ...]
//
// Added 2026-09-23 after R3 wired RTT `diameter`, whose Jovians store the
// string "Variable (Giant)": every assertion in system_sheet_verify.js passed
// and the sheet still crashed (NaN into createRadialGradient). The verify
// suite checks what the sheet WOULD print; only rendering proves it CAN.
// Renders at scale 0.2 and keeps nothing - roughly 1-2 minutes per sector.
// ---------------------------------------------------------------------------
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').replace(/\\/g, '/');
(async () => {
    for (const f of process.argv.slice(2)) {
        const b = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
        const p = await b.newPage();
        await p.goto('file:///' + REPO + '/hex_map.html'); await p.waitForTimeout(2500);
        const sector = JSON.parse(fs.readFileSync(f, 'utf8'));
        const keys = Object.keys(sector.hexStates);
        for (let i = 0; i < keys.length; i += 2000) {
            const part = {}; for (const k of keys.slice(i, i + 2000)) part[k] = sector.hexStates[k];
            await p.evaluate(x => { for (const [k, v] of Object.entries(x)) hexStates.set(k, v); }, part);
        }
        const t0 = Date.now();
        const r = await p.evaluate(() => {
            let rendered = 0, nulls = 0; const errs = [];
            for (const [hexId, st] of hexStates.entries()) {
                try { const c = SystemSheet.render(st, hexId, { scale: 0.2 }); c ? rendered++ : nulls++; }
                catch (e) { errs.push(hexId + ': ' + e.message); }
            }
            return { rendered, nulls, errors: errs.length, sample: errs.slice(0, 5) };
        });
        console.log(f.split('/').pop(), JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(0) + 's');
        await b.close();
    }
})();
