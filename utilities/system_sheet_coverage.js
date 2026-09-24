// ---------------------------------------------------------------------------
// SYSTEM SHEET FIELD COVERAGE — which normalizeSystem fields each engine
// actually populates.
//
//     node utilities/system_sheet_coverage.js <sector.json> [more.json ...]
//
// The sheet prints a column per field. A field no engine fills is a column of
// dashes, and a top-level field only MgT2E fills is a silent MgT2E-ism: the
// MgT2E normaliser ends `Object.assign({}, sys, ...)` and inherits the whole
// raw system, while the other four return a fresh literal carrying only
// { edition, age, hzAU, stars, worlds }.
// ---------------------------------------------------------------------------
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').split(String.fromCharCode(92)).join('/');
const FILES = process.argv.slice(2).filter(a => /\.json$/i.test(a));
if (!FILES.length) { console.error('pass one or more sector paths'); process.exit(1); }

const BODY_FIELDS = ['name','uwp','au','orbitId','diamKm','gravity','mass','meanTempK',
                     'periodYears','composition','tradeCodes','starport','tl','travelZone',
                     'type','moons'];
const STAR_FIELDS = ['name','sType','sClass','mass','diam','lum','temp','age','role',
                     'orbitId','separation'];
const TOP_FIELDS  = ['name','edition','age','hzAU','stars','worlds','totalWorlds','hzco'];

(async () => {
    const browser = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto('file:///' + REPO + '/hex_map.html');
    await page.waitForTimeout(2500);

    for (const file of FILES) {
        const sector = JSON.parse(fs.readFileSync(file, 'utf8'));
        const all = sector.hexStates;
        const keys = Object.keys(all);
        await page.evaluate(() => hexStates.clear());
        for (let i = 0; i < keys.length; i += 2000) {
            const part = {};
            for (const k of keys.slice(i, i + 2000)) part[k] = all[k];
            await page.evaluate(p => { for (const [k, v] of Object.entries(p)) hexStates.set(k, v); }, part);
        }
        const out = await page.evaluate(({ BODY_FIELDS, STAR_FIELDS, TOP_FIELDS }) => {
            const has = v => !(v == null || v === '' ||
                              (Array.isArray(v) && v.length === 0));
            const body = {}, moon = {}, star = {}, top = {};
            for (const f of BODY_FIELDS) { body[f] = 0; moon[f] = 0; }
            for (const f of STAR_FIELDS) star[f] = 0;
            for (const f of TOP_FIELDS)  top[f]  = 0;
            let nSys = 0, nBody = 0, nMoon = 0, nStar = 0, edition = '?';
            let noChart = 0, present = 0;
            const gravNonNumeric = new Set();
            for (const [hexId, st] of hexStates.entries()) {
                if (!st || st.type !== 'SYSTEM_PRESENT') continue;
                present++;
                let n = null;
                try { n = SystemViewer.normalizeSystem(st); } catch (e) { n = null; }
                const bodies = n ? (n.worlds || []).filter(w => w && w.type !== 'Empty') : [];
                if (!n || !bodies.length) { noChart++; continue; }
                nSys++; edition = n.edition;
                for (const f of TOP_FIELDS) if (has(n[f])) top[f]++;
                const walk = (list, isMoon) => { for (const b of list) {
                    if (isMoon) { nMoon++; } else { nBody++; }
                    const tgt = isMoon ? moon : body;
                    for (const f of BODY_FIELDS) if (has(b[f])) tgt[f]++;
                    if (b.gravity != null && typeof b.gravity !== 'number')
                        gravNonNumeric.add(String(b.gravity));
                    if (b.moons && b.moons.length) walk(b.moons.filter(m => m && m.type !== 'Empty'), true);
                } };
                walk(bodies, false);
                for (const s of (n.stars || [])) {
                    nStar++;
                    for (const f of STAR_FIELDS) if (has(s[f])) star[f]++;
                }
            }
            return { edition, nSys, nBody, nMoon, nStar, present, noChart, body, moon, star, top,
                     gravNonNumeric: [...gravNonNumeric].slice(0, 6) };
        }, { BODY_FIELDS, STAR_FIELDS, TOP_FIELDS });

        const p = (c, n) => n ? String(Math.round(100 * c / n)).padStart(3) + '%' : '   -';
        console.log('\n════ ' + path.basename(file) + '  —  ' + out.edition + ' ════');
        console.log('SYSTEM_PRESENT ' + out.present + '   chartable ' + out.nSys
                  + '   NOT chartable ' + out.noChart
                  + '   top-level bodies ' + out.nBody + '   moons ' + out.nMoon
                  + '   stars ' + out.nStar);
        console.log('\n  top-level : ' + TOP_FIELDS.map(f => f + ' ' + p(out.top[f], out.nSys)).join('   '));
        console.log('\n  BODY FIELD        coverage');
        for (const f of BODY_FIELDS) console.log('    ' + f.padEnd(16) + p(out.body[f], out.nBody));
        console.log('\n  STAR FIELD        coverage');
        for (const f of STAR_FIELDS) console.log('    ' + f.padEnd(16) + p(out.star[f], out.nStar));
        if (out.gravNonNumeric.length)
            console.log('\n  ⚠ NON-NUMERIC gravity values: ' + JSON.stringify(out.gravNonNumeric));
    }
    await browser.close();
})();
