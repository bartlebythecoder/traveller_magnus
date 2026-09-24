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
        let checked = 0, overCapacity = [], noMW = [], mwIsMoon = 0, splitSheets = 0;
        // R5: reduced sheets (stars + UWP mainworld, no orbits), and HOLLOW
        // ones - stars but no world of any kind - which still render today.
        let reducedSheets = 0; const reducedNoUwp = [], hollow = [];
        // R1: where each title came from, and any sheet titled badly.
        const titleFrom = { nsys: 0, state: 0, raw: 0, mainworld: 0, hexId: 0 };
        const badTitle = [];
        // R2/R4/R8 invariants (added 2026-09-23). Each list holds failures.
        const colAllDash = [], badCell = [], ageUnflagged = [], starUnflagged = [], auUnflagged = [];
        const colsDropped = {};
        // A green check that examined nothing is blind: count what each saw.
        const seen = { r4Systems: 0, r4Stars: 0, r4MissingFields: 0 };
        for (const [hexId, st] of hexStates.entries()) {
            let n = null;
            try { n = SystemViewer.normalizeSystem(st); } catch (e) { continue; }
            if (!n) continue;
            const bodies = (n.worlds || []).filter(w => w && w.type !== 'Empty');
            if (!bodies.length) {
                if (n.reportedMainworld) {
                    reducedSheets++;
                    if (!n.reportedMainworld.uwp) reducedNoUwp.push(hexId);
                } else hollow.push(hexId);
                continue;
            }
            checked++;
            {
                const mwB = bodies.find(w => w.type === 'Mainworld')
                    || bodies.map(w => (w.moons || []).find(m => m && m.type === 'Mainworld')).find(Boolean);
                const title = SystemSheet.resolveSystemName(n, st, mwB, hexId);
                const raw = [st.aowSystem, st.mgtSystem, st.ctSystem, st.t5System, st.rttSystem]
                    .find(x => x && x.stars && x.stars.length > 0);
                const t = v => (v == null ? '' : String(v).trim());
                const src = t(n.name) ? 'nsys' : t(st.name) ? 'state' : t(raw && raw.name) ? 'raw'
                          : t(mwB && mwB.name) ? 'mainworld' : 'hexId';
                titleFrom[src]++;
                const anyName = t(n.name) || t(st.name) || t(raw && raw.name) || t(mwB && mwB.name);
                if (/unnamed/i.test(title) || !title || (title === hexId && anyName))
                    badTitle.push(hexId + '=' + JSON.stringify(title));

                // R2: rebuild the table exactly as the sheet does and demand
                // that every kept column (bar # and Name) has a real value.
                const disp = SystemSheet.displayBodies(n);
                const ordered = disp.slice().sort((a, b) => (a._orderAU || 0) - (b._orderAU || 0));
                const dmw = disp.find(w => w.type === 'Mainworld')
                    || disp.map(w => (w.moons || []).find(m => m && m.type === 'Mainworld')).find(Boolean);
                const lay = SystemSheet.tableLayout(ordered, dmw);
                const keys = lay.cols.map(c => c.key);
                for (const c of ['comp', 'temp', 'year', 'au', 'zone', 'grav', 'diam', 'moons'])
                    if (!keys.includes(c)) colsDropped[c] = (colsDropped[c] || 0) + 1;
                for (const c of lay.cols) {
                    if (c.key === 'idx' || c.key === 'name' || c.key === 'band') continue;
                    const vals = lay.rows.map(r => r.cells[c.key]);
                    const real = c.key === 'comp' ? lay.rows.some(r => r.b.composition)
                                                  : vals.some(v => v && v !== '—');
                    if (!real) colAllDash.push(hexId + ':' + c.key);
                }
                // R8/R4: nothing non-numeric in a numeric cell, no 0 Gyr.
                for (const r of lay.rows) for (const k of ['au', 'diam', 'grav', 'temp', 'year'])
                    if (keys.includes(k) && /[A-Za-z]/.test(r.cells[k] || '')) badCell.push(hexId + ':' + k + '=' + r.cells[k]);

                // R4 against the RAW SAVE (spec 6.2): a field the raw record
                // does not hold must be flagged `invented`, or the sheet prints
                // the normaliser's default as fact.
                if (raw && raw !== st.mgtSystem && raw !== st.aowSystem) {
                    seen.r4Systems++;
                    if (!raw.age) seen.r4MissingFields++;
                    if (!raw.age && !(n.invented || []).includes('age')) ageUnflagged.push(hexId);
                    const lumKey = raw === st.rttSystem ? 'lum' : 'luminosity';
                    (raw.stars || []).forEach((rs, i) => {
                        const ns = (n.stars || [])[i]; if (!ns) return;
                        seen.r4Stars++;
                        for (const [rk, nk] of [['mass', 'mass'], ['diam', 'diam'], [lumKey, 'lum']])
                            if (!rs[rk] && ++seen.r4MissingFields && !(ns.invented || []).includes(nk)) starUnflagged.push(hexId + ':' + i + ':' + nk);
                    });
                    if (raw === st.rttSystem && !(n.invented || []).includes('au')) auUnflagged.push(hexId);
                    // CT's fixed 100 K on gas giants and belts must not reach the sheet.
                    if (raw === st.ctSystem) for (const w of ordered)
                        if ((w.type === 'Gas Giant' || w.type === 'Planetoid Belt') && w.meanTempK != null)
                            starUnflagged.push(hexId + ':' + w.name + ':meanTempK');
                }
            }
            // Mirrors render(): R6 splits the table into two columns past one
            // column's capacity, and derives the pitch from rows PER COLUMN.
            const oneColCap = Math.floor(usable / MIN_PITCH);
            const cols = bodies.length > oneColCap ? 2 : 1;
            const perCol = Math.ceil(bodies.length / cols);
            const rowH = Math.max(MIN_PITCH, Math.min(MAX_PITCH, Math.floor(usable / perCol)));
            const capacity = cols * Math.floor(usable / rowH);
            if (cols > 1) splitSheets++;
            if (bodies.length > capacity) overCapacity.push({ hexId, bodies: bodies.length, capacity, rowH });
            const direct = bodies.find(w => w.type === 'Mainworld');
            const moon = !direct && bodies.some(w => (w.moons || []).some(m => m && m.type === 'Mainworld'));
            if (moon) mwIsMoon++;
            if (!direct && !moon) noMW.push(hexId);
        }
        return { checked, overCapacity, noMW: noMW.length, noMWSample: noMW.slice(0, 5), mwIsMoon,
                 titleFrom, badTitle: badTitle.length, badTitleSample: badTitle.slice(0, 5),
                 colAllDash, badCell, ageUnflagged, starUnflagged, auUnflagged, colsDropped, seen, splitSheets, reducedSheets, reducedNoUwp, hollow };
    });
    console.log('sector                          : ' + path.basename(SECTOR));
    console.log('title source (R1)               : ' + JSON.stringify(r.titleFrom));
    console.log('sheets titled badly (R1)        : ' + r.badTitle
        + (r.badTitle ? '  FAIL e.g. ' + r.badTitleSample.join(', ') : '  <- PASS'));
    const line = (label, list) => console.log(label + list.length
        + (list.length ? '  FAIL e.g. ' + list.slice(0, 5).join(', ') : '  <- PASS'));
    line('all-dash table columns (R2)     : ', r.colAllDash);
    line('non-numeric numeric cells (R8)  : ', r.badCell);
    line('unrecorded age not flagged (R4) : ', r.ageUnflagged);
    line('unrecorded star/body field (R4) : ', r.starUnflagged);
    line('RTT AU not flagged (R4)         : ', r.auUnflagged);
    console.log('columns dropped (sheets)        : ' + JSON.stringify(r.colsDropped));
    console.log('R4 raw-check coverage           : ' + JSON.stringify(r.seen)
        + '  (MgT2E/AoW normalise real values and are not R4-checked)');
    console.log('systems checked                 : ' + r.checked);
    console.log('two-column tables (R6)          : ' + r.splitSheets);
    console.log('reduced sheets (R5)             : ' + r.reducedSheets);
    line('reduced sheet without a UWP (R5): ', r.reducedNoUwp);
    console.log('stars-only sheets (no world)    : ' + r.hollow.length
        + (r.hollow.length ? '  e.g. ' + r.hollow.slice(0, 3).join(', ') : ''));
    console.log('rows that would NOT fit         : ' + r.overCapacity.length
        + (r.overCapacity.length ? '  ' + JSON.stringify(r.overCapacity.slice(0, 5)) : '  <- table cannot drop a row'));
    console.log('mainworld found via moon lookup : ' + r.mwIsMoon);
    console.log('systems with NO mainworld at all: ' + r.noMW
        + (r.noMW ? '  e.g. ' + r.noMWSample.join(', ') : ''));
    if (errs.length) console.log('PAGE ERRORS: ' + errs.slice(0, 5).join(' | '));
    await b.close();
})();
