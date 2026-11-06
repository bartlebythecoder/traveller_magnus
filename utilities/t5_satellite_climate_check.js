// ---------------------------------------------------------------------------
// T5 SATELLITE & CLIMATE CHECK - v0.18.1.4 changelog items 10-23.
//
// Run from the repo root:
//     node utilities/t5_satellite_climate_check.js
//
// Generates 1,280 T5 systems (hexes 0101-3240, the same seeds every run) in the
// real app and asserts Sean's T5 rulings of 2026-11-01, recorded in
// directives/project_manifest.md 0.0.D and rules/t5_data.js TIDAL_LOCK /
// CLIMATE_TRADE_CODES / HZ_DATA:
//   * Sa only on a satellite MAINWORLD (house rule); Lk on every Close satellite;
//     Close satellites tidally locked; no other moon ever carries Sa.
//   * Chart 2C orbit letters: Close A-M, Far N-Z, always in the right column;
//     plain Flux never reaches the +-6 rows (A, M, N, Z).
//   * Other moons: 2D 7- Close, so about 58% Close.
//   * Mainworld climate code: Tz at Orbit 0/1 (not belts/satellites), else
//     Tr/Tu need size 6-9 atm 4-9 hydro 3-7 at HZ -1/+1, else Ho/Co there;
//     Fr needs size 2-9 hydro 1-A at HZ +2 or beyond. Exactly one, or none;
//     a belt mainworld none at all.
//   * Every other planet and moon follows the same Chart D rule (Sean,
//     2026-11-02); a moon measures from its planet's orbit.
//   * Climate Zone TEXT follows the body's climate code (Tz, Tr/Ho, Tu/Co, Fr);
//     no code = no text. Gas giants and belts have none.
//   * PBG gas giant and belt counts = the bodies actually placed in orbits.
//   * Brown dwarfs: HZ Orbit 0 for every stored size.
//   * Same seed, same system — every field, and still after other hexes are
//     generated (the T5 engines once kept a load-time copy of rng).
//   * System Editor: a Close and a Far satellite mainworld survive Preview +
//     Save twice with every satellite's Close/Far, letter and Sa/Lk unchanged.
//   * "Orbit: Dee (D)" reaches the accordion, the System Sheet, the export
//     formatter and the orrery's normaliser (the hover itself is not driven).
//   * Saves made before Chart 2C: a wrong-column letter is never shown.
//   * Rotation text (TIDAL_LOCK.LOGIC.TZ/LK_DAY_LENGTH): Orbit 0/1 planets "no
//     day/night cycle", Close satellites "day = orbit length", others Undefined;
//     saves with the old "1:1" wording show the new text, hand-typed kept.
//   * System Editor: a brand-new moon made mainworld rolls 2D 7- Close like other
//     moons and keeps it; an old-save Far mainworld (Sa, nothing stored) stays Far.
//   * System Editor: a moon made mainworld keeps its place in its planet's moon
//     list (it used to move to the end).
//   * Orrery: moons are drawn by orbit letter, Ay innermost, Close inside Far,
//     with a display-only speed (drawPd), never a printed pd.
// ---------------------------------------------------------------------------
const { chromium } = require('playwright');
const path = require('path');
const REPO = path.resolve(__dirname, '..').split(String.fromCharCode(92)).join('/');

const pass = [], fail = [];
function check(ok, label, detail) { (ok ? pass : fail).push(label + (ok || !detail ? '' : '  -> ' + detail)); }

(async () => {
    const browser = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.setDefaultTimeout(0);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.goto('file:///' + REPO + '/hex_map.html');
    await page.waitForTimeout(2500);

    // ── 1. The corpus ────────────────────────────────────────────────────────
    const r = await page.evaluate(() => {
        document.getElementById('splash-screen').style.display = 'none';
        window.isLoggingEnabled = false;
        const C = T5_Data.TIDAL_LOCK.CHART_2C.ORBITS;
        const inCol = (l, close) => Object.values(close ? C.CLOSE : C.FAR).some(x => x.letter === l);
        const isGG = c => c.type && (c.type.includes('Gas Giant') || c.type === 'Ice Giant');
        const isBelt = c => c.type === 'Planetoid Belt' || c.worldType === 'Belt';
        // Climate Zone text follows the climate code; no code (or a gas giant/belt) = no text
        const TEXT = { Tz: 'Twilight Zone (Tz)', Tr: 'Hot / Tropic', Ho: 'Hot / Tropic', Tu: 'Cold / Tundra', Co: 'Cold / Tundra', Fr: 'Frozen' };
        const textFor = c => { if (isGG(c) || isBelt(c)) return '';
            const k = (c.tradeCodes || []).find(x => TEXT[x]); return k ? TEXT[k] : ''; };
        const ROT = { STAR: 'Tidally Locked to Star (no day/night cycle)', PARENT: 'Tidally Locked to Parent (day = orbit length)', FREE: 'Undefined (Referee Discretion)' };
        const sizeOf = w => typeof w.size === 'number' ? w.size : parseInt(w.size, 36);
        // Chart D: the one climate code expected at HZ position pos (a satellite uses its planet's orbit)
        const expectCode = (w, pos, isTz) => { const s = sizeOf(w), a = w.atm || 0, hy = w.hydro || 0;
            const trtu = s >= 6 && s <= 9 && a >= 4 && a <= 9 && hy >= 3 && hy <= 7;
            return (isBelt(w) || isGG(w)) ? '' : isTz ? 'Tz' : pos === -1 ? (trtu ? 'Tr' : 'Ho') : pos === 1 ? (trtu ? 'Tu' : 'Co')
                : (pos >= 2 && s >= 2 && s <= 9 && hy >= 1) ? 'Fr' : ''; };
        const climateOf = w => (w.tradeCodes || []).filter(c => ['Tr', 'Tu', 'Fr', 'Ho', 'Co', 'Tz'].includes(c)).join('+');
        const gen = h => { reseedForHex(h);
            return System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: T5_World_Engine.generateT5Mainworld(h), hexId: h }); };
        const r = { n: 0, bad: {}, ex: {}, mwClose: 0, mwFar: 0, moons: 0, moonsClose: 0, letters: {}, codes: {}, rot: {},
                    otherCodes: {}, others: 0, othersWithText: 0,
                    bdHZ: ['V', 'VI', 'D'].map(sz => T5_Stellar_Engine.getStarHZ({ type: 'BD', size: sz })),
                    deterministic: true, picks: { close: null, far: null } };
        const bad = (k, msg) => { r.bad[k] = (r.bad[k] || 0) + 1; if (!r.ex[k]) r.ex[k] = msg; };
        const fp = s => JSON.stringify(s, (k, v) => (k === 'name' || k === 'names' || k.startsWith('_')) ? undefined : v);
        const firsts = {}; r.deterministicAfterOthers = true;

        for (let x = 1; x <= 32; x++) for (let y = 1; y <= 40; y++) {
            const h = `${String(x).padStart(2, '0')}${String(y).padStart(2, '0')}`;
            const sys = gen(h), mw = sys.mainworld, tc = mw.tradeCodes || [];
            r.n++;

            // Sa / Lk / letters — mainworld
            if (mw.isMoon) {
                const close = mw.isCloseSatellite === true; close ? r.mwClose++ : r.mwFar++;
                if (!tc.includes('Sa')) bad('mwNoSa', h);
                if (tc.includes('Lk') !== close) bad('mwLk', h);
                if (!inCol(mw.orbitLetter, close)) bad('mwLetter', `${h} ${mw.orbitLetter} close=${close}`);
                if (typeof mw.isCloseSatellite !== 'boolean') bad('mwCloseStored', h);
            } else if (tc.includes('Sa') || tc.includes('Lk')) bad('planetMwSaLk', h);

            // Placed bodies: PBG, climate text, other moons
            let gg = 0, belts = 0, mwOrbit = null;
            sys.stars.forEach((st, si) => {
                const hz = si === 0 ? sys.hzOrbit : T5_Stellar_Engine.getStarHZ(st);
                // Every world other than the mainworld follows Chart D too (Sean, 2026-11-02)
                const checkCode = (w, orbit, isTz, label) => { if (w === mw) return;
                    const got = climateOf(w), expect = expectCode(w, orbit - hz, isTz);
                    r.otherCodes[got || '-'] = (r.otherCodes[got || '-'] || 0) + 1; r.others++;
                    if (w.climateZone) r.othersWithText++;
                    if (got !== expect) bad(label, `${h} star ${si} orbit ${orbit} ${w.uwp}: expect ${expect || '-'} got ${got || '-'}`); };
                st.orbits.forEach(o => {
                    const c = o.contents; if (!c || !c.type) return;
                    checkCode(c, o.orbit, !c.isMoon && o.orbit <= 1, 'bodyCode');
                    (c.satellites || []).forEach(m => checkCode(m, o.orbit, false, 'moonCode'));
                    if (c === mw || (c.satellites || []).includes(mw)) mwOrbit = si === 0 ? o.orbit : null;
                    if (isGG(c)) gg++; else if (isBelt(c)) belts++;
                    if (isGG(c) || isBelt(c)) {
                        if (c.climateZone) bad('ggBeltText', `${h} star ${si} orbit ${o.orbit} ${c.type}: ${c.climateZone}`);
                    } else {
                        if (o.orbit <= 1 && !(c.tradeCodes || []).includes('Tz')) bad('bodyTz', `${h} star ${si} orbit ${o.orbit}`);
                        if ((c.climateZone || '') !== textFor(c)) bad('bodyText', `${h} star ${si} orbit ${o.orbit}: ${c.climateZone} vs ${textFor(c) || '(none)'}`);
                        if (!c.isMoon) {
                            const want = o.orbit <= 1 ? ROT.STAR : ROT.FREE;
                            r.rot[c.rotationState] = (r.rot[c.rotationState] || 0) + 1;
                            if (c.rotationState !== want) bad('bodyRot', `${h} star ${si} orbit ${o.orbit}: ${c.rotationState}`);
                        }
                    }
                    (c.satellites || []).forEach(m => {
                        if ((m.climateZone || '') !== textFor(m)) bad('moonText', `${h} orbit ${o.orbit}: ${m.climateZone} vs ${textFor(m) || '(none)'}`);
                        if (!isGG(m) && !isBelt(m)) {
                            const want = m.isCloseSatellite === true ? ROT.PARENT : ROT.FREE;
                            r.rot[m.rotationState] = (r.rot[m.rotationState] || 0) + 1;
                            if (m.rotationState !== want) bad('moonRot', `${h} orbit ${o.orbit}: ${m.rotationState} close=${m.isCloseSatellite}`);
                        }
                        if (m === mw) return;
                        const mt = m.tradeCodes || [], close = m.isCloseSatellite === true;
                        r.moons++; if (close) r.moonsClose++;
                        r.letters[m.orbitLetter] = (r.letters[m.orbitLetter] || 0) + 1;
                        if (mt.includes('Sa')) bad('moonSa', h);
                        if (mt.includes('Lk') !== close) bad('moonLk', h);
                        if (close !== (m.isTidallyLocked === true)) bad('moonLock', h);
                        if (!inCol(m.orbitLetter, close)) bad('moonLetter', `${h} ${m.orbitLetter}`);
                    });
                });
            });
            // Orrery: moons drawn inner->outer by orbit letter, Close inside Far, one ring per letter
            SystemViewer.normalizeSystem({ t5System: sys, t5Data: mw }).worlds.forEach(w => {
                const ms = w.moons || [], L = m => m.satelliteOrbit ? m.satelliteOrbit.letter : null;
                ms.forEach(a => ms.forEach(b => { const la = L(a), lb = L(b); if (a === b || !la || !lb) return;
                    const ok = la === lb ? a.ring === b.ring : la < lb ? (a.ring < b.ring && a.drawPd < b.drawPd) : true;
                    if (!ok || a.pd != null) bad('orreryRing', `${h} ${w.name}: ${ms.map(m => (L(m) || '?') + '@' + m.ring).join(' ')}`); }));
            });
            if ((mw.gasGiantsCount || 0) !== gg) bad('pbgGG', `${h} ${mw.gasGiantsCount} vs ${gg}`);
            if ((mw.planetoidBelts || 0) !== belts) bad('pbgBelts', `${h} ${mw.planetoidBelts} vs ${belts}`);

            // Mainworld climate code, and its text
            if (mwOrbit !== null) {
                const pos = mwOrbit - sys.hzOrbit;
                const expect = expectCode(mw, pos, !mw.isMoon && mwOrbit <= 1);
                const got = climateOf(mw);
                r.codes[got || '-'] = (r.codes[got || '-'] || 0) + 1;
                if (got !== expect) bad('climateCode', `${h} pos ${pos} ${mw.uwp}: expect ${expect || '-'} got ${got || '-'}`);
                if ((mw.climateZone || '') !== textFor(mw)) bad('mwText', `${h} ${got || '-'} beside ${mw.climateZone}`);
            }

            // Editor picks: a Close and a Far satellite mainworld with 3+ other moons
            if (mw.isMoon) {
                let others = 0; sys.stars.forEach(s => s.orbits.forEach(o => (o.contents && o.contents.satellites || []).forEach(m => { if (m !== mw) others++; })));
                const k = mw.isCloseSatellite ? 'close' : 'far';
                if (others >= 3 && !r.picks[k]) r.picks[k] = h;
            }
            // The whole system (names aside), straight away and again after every other hex
            if (x === 1 && y <= 10) {
                firsts[h] = fp(sys);
                if (fp(gen(h)) !== firsts[h]) r.deterministic = false;
            }
        }
        Object.keys(firsts).forEach(h => { if (fp(gen(h)) !== firsts[h]) r.deterministicAfterOthers = false; });

        // Saves made before Chart 2C
        const E = T5_World_Engine;
        r.legacy = [
            E.getT5SatelliteOrbit({ type: 'Mainworld', isMoon: true, orbitLetter: 'g', tradeCodes: ['Sa'] }) === null,
            JSON.stringify(E.getT5SatelliteOrbit({ type: 'Mainworld', isMoon: true, orbitLetter: 'd', tradeCodes: ['Sa', 'Lk'] })) === '{"letter":"D","name":"Dee","isClose":true}',
            E.getT5SatelliteOrbit({ type: 'Mainworld', orbitLetter: 'D' }) === null,
        ];
        // Saves made before the new Rotation wording; a hand-typed one is kept as typed
        const rotOf = o => JSON.stringify(ExportCore.formatT5SatFields(o));
        r.legacyRot = [
            E.getT5RotationDisplay({ rotationState: 'Tidally Locked (1:1 to Star)' }) === ROT.STAR,
            E.getT5RotationDisplay({ rotationState: 'Tidally Locked (1:1 to Parent)' }) === ROT.PARENT,
            E.getT5RotationDisplay({ rotationState: 'Undefined (Referee Discretion)' }) === ROT.FREE,
            E.getT5RotationDisplay({ rotationState: 'Tidally Locked (1:1 to Star)', _manualFields: ['rotationState'] }) === 'Tidally Locked (1:1 to Star)',
            rotOf({ rotationState: 'Tidally Locked (1:1 to Parent)' }).includes(ROT.PARENT),
        ];
        return r;
    });

    check(r.n === 1280, '1,280 systems generated', r.n);
    for (const [k, label] of [
        ['mwNoSa', 'Every satellite mainworld carries Sa'], ['mwLk', 'Satellite mainworld: Lk exactly when Close'],
        ['mwLetter', 'Satellite mainworld letter is in its Close/Far column'], ['mwCloseStored', 'Satellite mainworld stores Close/Far (Far as false)'], ['planetMwSaLk', 'No planet mainworld carries Sa or Lk'],
        ['moonSa', 'No other moon carries Sa'], ['moonLk', 'Other moons: Lk exactly when Close'],
        ['moonLock', 'Other moons: tidally locked exactly when Close'], ['moonLetter', 'Other moons: letter in the right column'],
        ['pbgGG', 'PBG gas giants = gas giants placed'], ['pbgBelts', 'PBG belts = belts placed (belt mainworld included)'],
        ['climateCode', 'Mainworld climate code follows Chart D (Tz/Tr/Ho/Tu/Co/Fr)'], ['mwText', 'Mainworld Climate Zone text agrees with its code'],
        ['bodyCode', 'Other planets: climate code follows Chart D'], ['moonCode', 'Other moons: climate code follows Chart D (from the planet\'s orbit)'],
        ['bodyTz', 'Every planet in Orbit 0/1 carries Tz'], ['bodyText', 'Body Climate Zone text follows its climate code (none without one)'],
        ['ggBeltText', 'Gas giants and belts have no Climate Zone text'], ['moonText', 'Moon Climate Zone text follows its climate code (none without one)'],
        ['orreryRing', 'Orrery: moons drawn by orbit letter (Ay innermost), one ring per letter, no pd printed'],
        ['bodyRot', 'Planet Rotation: Orbit 0/1 "no day/night cycle", else Undefined'], ['moonRot', 'Moon Rotation: Close "day = orbit length", else Undefined'],
    ]) check(!r.bad[k], label, r.bad[k] ? `${r.bad[k]} bad, e.g. ${r.ex[k]}` : '');
    check(r.mwClose > 0 && r.mwFar > 0, 'Both Close and Far satellite mainworlds occur', `${r.mwClose} Close, ${r.mwFar} Far`);
    const closeShare = r.moonsClose / r.moons;
    check(closeShare > 0.53 && closeShare < 0.64, 'About 58% of other moons are Close (2D 7-)', (closeShare * 100).toFixed(1) + '%');
    check(!['A', 'M', 'N', 'Z'].some(l => r.letters[l]), 'Plain Flux never reaches the +-6 rows (A, M, N, Z)', JSON.stringify(r.letters));
    check(r.bdHZ.every(v => v === 0), 'Brown dwarf HZ is Orbit 0 for sizes V, VI, D', JSON.stringify(r.bdHZ));
    check(r.deterministic, 'Same seed, same system (every field, names aside)');
    check(r.deterministicAfterOthers, 'Same system again after generating 1,280 other hexes');
    check(r.legacy.every(Boolean), 'Pre-Chart-2C saves: a wrong-column letter is never shown', JSON.stringify(r.legacy));
    check(r.legacyRot.every(Boolean), 'Old "1:1" Rotation wording shows the new text; hand-typed kept', JSON.stringify(r.legacyRot));
    console.log('climate codes:', JSON.stringify(r.codes));
    console.log(`other worlds' climate codes (${r.othersWithText} of ${r.others} with Climate Zone text):`, JSON.stringify(r.otherCodes));
    console.log('rotation:', JSON.stringify(r.rot));

    // ── 2. System Editor round trip, and the displays ───────────────────────
    for (const [kind, hexId] of Object.entries(r.picks)) {
        if (!hexId) { check(false, `Found a ${kind} satellite mainworld with 3+ other moons`); continue; }
        await page.evaluate(h => {
            reseedForHex(h);
            const sys = System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: T5_World_Engine.generateT5Mainworld(h), hexId: h });
            const st = { type: 'SYSTEM_PRESENT', t5System: sys, t5Data: sys.mainworld, name: 'Check' };
            st.t5Data.name = st.name;
            st.t5Socio = T5_Socio_Engine.generateT5Socioeconomics(sys.mainworld, h);
            hexStates.set(h, st);
        }, hexId);
        const snap = () => page.evaluate(h => {
            const sys = hexStates.get(h).t5System, mw = sys.mainworld, out = [];
            sys.stars.forEach((s, si) => s.orbits.forEach(o => (o.contents && o.contents.satellites || []).forEach((m, i) => {
                out.push(`${si}/${o.orbit}/${m === mw || m.type === 'Mainworld' ? 'MW' : (m.name || i)}:` +
                    `${m.isCloseSatellite ? 'C' : 'F'}${m.orbitLetter}${(m.tradeCodes || []).filter(c => c === 'Sa' || c === 'Lk').join('+')}`);
            })));
            return out.sort().join(' ');
        }, hexId);
        const editRound = async () => {
            await page.evaluate(h => SystemEditor.openEdit(h), hexId);
            await page.waitForTimeout(300);
            await page.locator('button:visible:text-is("Preview")').first().click();
            await page.waitForTimeout(300);
            await page.locator('button:visible:text-is("Save")').first().click();
            await page.waitForTimeout(500);
        };
        const s0 = await snap(); await editRound(); const s1 = await snap(); await editRound(); const s2 = await snap();
        check(s0 === s1 && s1 === s2, `Editor: ${kind} mainworld ${hexId} unchanged after Preview + Save twice`, `${s0}  ->  ${s2}`);

        const d = await page.evaluate(h => {
            const st = hexStates.get(h), sats = [];
            st.t5System.stars.forEach(s => s.orbits.forEach(o => (o.contents && o.contents.satellites || []).forEach(m => sats.push(m))));
            const norm = []; SystemViewer.normalizeSystem(st).worlds.forEach(w => (w.moons || []).forEach(m => norm.push(m.satelliteOrbit)));
            populateEditorAccordions(st);
            const acc = (document.body.textContent.match(/Orbit: [A-Za-z]+ \([A-Z]\)/g) || []).length;
            const texts = [], orig = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { texts.push(String(t)); return orig.call(this, t, ...a); };
            let sheetErr = null; try { SystemSheet.render(st, h, {}); } catch (e) { sheetErr = e.message; }
            CanvasRenderingContext2D.prototype.fillText = orig;
            return { n: sats.length, norm: norm.filter(Boolean).length, acc, sheetErr,
                     sheet: texts.some(t => /^[A-Z][a-z]+ \([A-Z]\)$/.test(t)) && texts.includes('ORBIT'),
                     exp: sats.filter(m => JSON.stringify(ExportCore.formatT5SatFields(m)).includes('Orbit')).length };
        }, hexId);
        check(d.norm === d.n, `${kind}: orrery normaliser gives every satellite its orbit`, `${d.norm}/${d.n}`);
        check(d.acc === d.n, `${kind}: hex accordion shows every satellite's orbit`, `${d.acc}/${d.n}`);
        check(!d.sheetErr && d.sheet, `${kind}: System Sheet draws the ORBIT column`, d.sheetErr || 'no orbit text drawn');
        check(d.exp === d.n, `${kind}: export formatter gives every satellite an Orbit field`, `${d.exp}/${d.n}`);
    }

    // ── 3. A brand-new moon made mainworld in the System Editor ─────────────
    // Ruling (Sean, 2026-11-01): it rolls 2D like other moons (7- Close). Moons are stripped
    // first so the new moon's MW button is the only one on the page.
    const nm = { n: 0, close: 0, bad: [], unstable: [] };
    const mwState = h => page.evaluate(h => { const sys = hexStates.get(h).t5System; let w = null;
        sys.stars.forEach(s => s.orbits.forEach(o => (o.contents && o.contents.satellites || []).forEach(m => { if (m.type === 'Mainworld') w = m; })));
        return w && { close: w.isCloseSatellite, letter: w.orbitLetter, codes: (w.tradeCodes || []).join(' ') }; }, h);
    const previewSave = async () => {
        await page.locator('button:visible:text-is("Preview")').first().click(); await page.waitForTimeout(300);
        await page.locator('button:visible:text-is("Save")').first().click(); await page.waitForTimeout(500);
    };
    for (let y = 1; y <= 40 && nm.n < 24; y++) {
        const h = '05' + String(y).padStart(2, '0');
        const ok = await page.evaluate(h => {
            reseedForHex(h);
            const sys = System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: T5_World_Engine.generateT5Mainworld(h), hexId: h });
            if (sys.mainworld.isMoon) return false;
            sys.stars.forEach(s => s.orbits.forEach(o => { if (o.contents) o.contents.satellites = []; }));
            const st = { type: 'SYSTEM_PRESENT', t5System: sys, t5Data: sys.mainworld, name: 'X' };
            st.t5Socio = T5_Socio_Engine.generateT5Socioeconomics(sys.mainworld, h);
            hexStates.set(h, st); return true;
        }, h);
        if (!ok) continue;
        await page.evaluate(h => SystemEditor.openEdit(h), h); await page.waitForTimeout(300);
        const added = await page.evaluate(() => { const a = document.querySelector('button[title="Add moon"]'); if (!a) return false; a.click(); return true; });
        await page.waitForTimeout(200);
        const promoted = added && await page.evaluate(() => { const b = document.querySelectorAll('button[title="Set moon as mainworld"]');
            if (b.length !== 1) return false; b[0].click(); return true; });
        if (!promoted) { await page.keyboard.press('Escape'); continue; }
        await page.waitForTimeout(200); await previewSave();
        const m1 = await mwState(h);
        await page.evaluate(h => SystemEditor.openEdit(h), h); await page.waitForTimeout(300); await previewSave();
        const m2 = await mwState(h);
        nm.n++; if (m1 && m1.close === true) nm.close++;
        const C = await page.evaluate(() => T5_Data.TIDAL_LOCK.CHART_2C.ORBITS);
        const col = m1 && Object.values(m1.close ? C.CLOSE : C.FAR).some(r => r.letter === m1.letter);
        const codes = m1 ? m1.codes.split(' ') : [];
        if (!m1 || typeof m1.close !== 'boolean' || !col || !codes.includes('Sa') || codes.includes('Lk') !== m1.close) nm.bad.push(`${h} ${JSON.stringify(m1)}`);
        if (JSON.stringify(m1) !== JSON.stringify(m2)) nm.unstable.push(`${h} ${JSON.stringify(m1)} -> ${JSON.stringify(m2)}`);
    }
    console.log(`new moon-mainworlds: ${nm.close}/${nm.n} Close`);
    check(nm.n >= 20, 'Editor: brand-new moons made mainworld (sample)', nm.n);
    check(!nm.bad.length, 'Editor: new moon-mainworld rolls Close/Far, right-column letter, Sa, Lk exactly when Close', nm.bad.slice(0, 2).join(' | '));
    check(nm.close > 0 && nm.close < nm.n, 'Editor: new moon-mainworlds come out both Close and Far (2D 7-)', `${nm.close}/${nm.n} Close`);
    check(!nm.unstable.length, 'Editor: new moon-mainworld unchanged by a second Preview + Save', nm.unstable.slice(0, 2).join(' | '));

    // A Far mainworld saved before isCloseSatellite = false was stored (Sa only) stays Far.
    const farHex = r.picks.far, farRuns = [];
    if (farHex) for (let i = 0; i < 3; i++) {
        await page.evaluate(h => { const sys = hexStates.get(h).t5System;
            sys.stars.forEach(s => s.orbits.forEach(o => (o.contents && o.contents.satellites || []).forEach(m => { if (m.type === 'Mainworld') delete m.isCloseSatellite; }))); }, farHex);
        await page.evaluate(h => SystemEditor.openEdit(h), farHex); await page.waitForTimeout(300); await previewSave();
        farRuns.push(await mwState(farHex));
    }
    check(farRuns.length === 3 && farRuns.every(m => m && m.close === false && !m.codes.split(' ').includes('Lk')),
        'Editor: an old-save Far mainworld (no Close/Far stored) stays Far on re-save', JSON.stringify(farRuns));

    // ── 4. A moon made mainworld keeps its place in its planet's moon list ──
    // Item 8 (2026-11-02): it used to move to the end. Every other planet's moons are stripped
    // so the page's MW buttons are exactly this planet's moons, in order.
    const order = { n: 0, bad: [] };
    // The one planet left with moons (the editor gives bodies new _ids on Save)
    const moonOrder = h => page.evaluate(h => { const out = [];
        hexStates.get(h).t5System.stars.forEach(s => s.orbits.forEach(o => { if (o.contents && (o.contents.satellites || []).length)
            out.push(o.contents.satellites.map(m => (m.type === 'Mainworld' ? '*' : '') + m.name)); }));
        return out.length === 1 ? out[0] : null; }, h);
    for (let y = 1; y <= 40 && order.n < 6; y++) {
        const h = '07' + String(y).padStart(2, '0');
        const found = await page.evaluate(h => {
            reseedForHex(h);
            const sys = System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: T5_World_Engine.generateT5Mainworld(h), hexId: h });
            if (sys.mainworld.isMoon) return null;
            let host = null;
            sys.stars.forEach(s => s.orbits.forEach(o => { const c = o.contents; if (!c) return;
                if (!host && c !== sys.mainworld && (c.satellites || []).length >= 3 && c.satellites.every(m => m.name)) host = c;
                else c.satellites = []; }));
            if (!host) return false;
            const st = { type: 'SYSTEM_PRESENT', t5System: sys, t5Data: sys.mainworld, name: 'X' };
            st.t5Socio = T5_Socio_Engine.generateT5Socioeconomics(sys.mainworld, h);
            hexStates.set(h, st); return true;
        }, h);
        if (!found) continue;
        const before = await moonOrder(h);
        const pick = order.n % 2 === 0 ? 0 : 1;   // the first moon, then a middle one
        await page.evaluate(h => SystemEditor.openEdit(h), h); await page.waitForTimeout(300);
        const clicked = await page.evaluate(([i, n]) => { const b = document.querySelectorAll('button[title="Set moon as mainworld"]');
            if (b.length !== n) return `${b.length} MW buttons, expected ${n}`; b[i].click(); return ''; }, [pick, before.length]);
        if (clicked) { order.bad.push(`${h} ${clicked}`); await page.keyboard.press('Escape'); continue; }
        await page.waitForTimeout(200); await previewSave();
        const after1 = await moonOrder(h);
        await page.evaluate(h => SystemEditor.openEdit(h), h); await page.waitForTimeout(300); await previewSave();
        const after2 = await moonOrder(h);
        order.n++;
        const want = before.map((n, i) => i === pick ? '*' + n : n).join(', ');
        const got1 = after1 ? after1.join(', ') : '(planet gone)', got2 = after2 ? after2.join(', ') : '(planet gone)';
        if (got1 !== want || got2 !== want) order.bad.push(`${h} want [${want}] got [${got1}] then [${got2}]`);
    }
    check(order.n >= 4, 'Editor: moons made mainworld in place (sample)', order.n);
    check(!order.bad.length, 'Editor: a moon made mainworld keeps its place in the moon list through two saves', order.bad.slice(0, 2).join(' | '));

    await browser.close();
    check(errors.length === 0, 'Zero console/page errors', errors.slice(0, 3).join(' | '));
    console.log('\n=== T5 satellite & climate check ===');
    pass.forEach(p => console.log('  PASS  ' + p));
    fail.forEach(f => console.log('  FAIL  ' + f));
    console.log(`\n${pass.length} passed, ${fail.length} failed`);
    process.exit(fail.length ? 1 : 0);
})();
