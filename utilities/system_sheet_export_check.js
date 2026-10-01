// ---------------------------------------------------------------------------
// SYSTEM SHEET EXPORT CHECK - the sheet in the HTML and Obsidian exporters.
//
// Part of the SYSTEM SHEET harness (v0.18.1.1). Run from the repo root:
//     node utilities/system_sheet_export_check.js
//
// TESTS THE EXPORTERS BY EXPORTING. A missing parameter broke Export Wiki for
// three days while `node --check` and every piece-level assertion passed. This
// calls the real `startExport` of both exporters, captures the ZIP through a
// stubbed `downloadBlob`, and reads the image bytes out of it.
//
// What it asserts (rulings in project_manifest.md 0.0.C, Sean 2026-09-24;
// the sheet/orrery/both choice added Sean 2026-10-01). Every
// MODE of the dialog's "System images" choice is exported at every level:
//   * GM export and level (g): 'sheet' gives the SHEET - a JPEG, 3440 px wide
//     (scale 2), filename ending (hex).jpg; 'orrery' gives the 900x500 orrery
//     PNG named "(hex) Orrery.png"; 'both' gives the sheet THEN the orrery, in
//     that order on the page.
//   * Levels (d)-(f): every mode but 'none' gives the level-aware ORRERY and
//     NEVER the sheet. The sheet shows (e)/(f)/(g) data and names the
//     mainworld; an image cannot be filtered, only withheld. The user's choice
//     may only REMOVE an image - 'sheet' and 'both' fall back to the orrery.
//   * Level (c), and mode 'none' everywhere: no system image at all.
//   * The legacy boolean includeSystemImages:true still means 'sheet'.
//   * Every image a page references is actually in the ZIP (catches a page
//     still pointing at .png after the file became .jpg).
//
// Each case trims hexStates to ONE hex, so an export is one system and quick.
// Sector files under .tmp/ are gitignored - if one is missing, ask Sean.
// Launches with --disable-gpu (see directives/terrain_spec.md 14.1).
// ---------------------------------------------------------------------------
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').split(String.fromCharCode(92)).join('/');

const SHEET_W = 3440;                 // SystemSheet.W (1720) x export scale 2
const ORRERY = { w: 900, h: 500 };    // SystemViewer.renderSnapshot in both exporters

// One per sheet shape that matters to the exporters. Every one of them draws
// an orrery today (the reduced and stars-only hexes included, checked
// 2026-09-24), so every one must still carry it at (d)-(f).
const CASES = [
    { sector: 'sectors/solo_6.json',        hex: '18-A-0103', what: 'MgT2E, lunar mainworld' },
    { sector: '.tmp/ct_bu.json',            hex: '18-A-0104', what: 'CT, lunar mainworld' },
    { sector: '.tmp/aow_bu.json',           hex: '18-D-3005', what: 'AoW, 32 bodies (split table)' },
    { sector: '.tmp/spinward marches.json', hex: '18-C-1910', what: 'T5 import, reduced sheet' },
    { sector: '.tmp/rtt_bu.json',           hex: '18-A-0106', what: 'RTT, stars-only sheet' },
];
const LEVELS = [null, 'g', 'f', 'd', 'c'];      // null = GM export
// 'legacy' passes the old boolean includeSystemImages:true and no systemImages;
// it must behave exactly as 'sheet'. Two levels are enough for it.
const MODES = ['sheet', 'orrery', 'both', 'none', 'legacy'];
const LEGACY_LEVELS = [null, 'd'];

// ── ZIP + image parsing ─────────────────────────────────────────────────────
// The exporters write STORED (uncompressed) ZIPs, so local headers suffice.
function readZip(buf) {
    const out = new Map();
    let pos = 0;
    while (pos + 4 <= buf.length && buf.readUInt32LE(pos) === 0x04034b50) {
        const size = buf.readUInt32LE(pos + 18);
        const nameLen = buf.readUInt16LE(pos + 26), extraLen = buf.readUInt16LE(pos + 28);
        const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
        const at = pos + 30 + nameLen + extraLen;
        out.set(name, buf.subarray(at, at + size));
        pos = at + size;
    }
    return out;
}

function imageInfo(b) {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47)
        return { type: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
        let p = 2;
        while (p + 9 < b.length) {
            if (b[p] !== 0xff) { p++; continue; }
            const m = b[p + 1];
            // SOFn carries the frame size; C4/C8/CC are not frames.
            if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
                return { type: 'jpeg', h: b.readUInt16BE(p + 5), w: b.readUInt16BE(p + 7) };
            p += 2 + b.readUInt16BE(p + 2);
        }
        return { type: 'jpeg', w: 0, h: 0 };
    }
    return { type: 'unknown', w: 0, h: 0 };
}

// ── Checks ──────────────────────────────────────────────────────────────────
const pass = [], fail = [];
const check = (ok, label, detail) => (ok ? pass : fail).push(label + (detail ? `  [${detail}]` : ''));

function assessExport(kind, c, level, mode, zip) {
    const tag = `${kind} ${c.hex} ${level ? '(' + level + ')' : 'GM'} [${mode}]`;
    const hexCode = c.hex.split('-')[2];
    const names = [...zip.keys()];
    const sysRe = new RegExp(`\\(${hexCode}\\)(\\.(png|jpe?g)| Orrery\\.png)$`, 'i');
    const sysImgs = names.filter(n => /(^|\/)images\//.test(n) && sysRe.test(n));
    const info = sysImgs.map(n => ({ n, ...imageInfo(zip.get(n)) }));
    const desc = info.map(i => `${path.basename(i.n)} ${i.type} ${i.w}x${i.h}`).join(', ') || 'none';

    const isSheet  = i => i.type === 'jpeg' && i.w === SHEET_W
                          && new RegExp(`\\(${hexCode}\\)\\.jpg$`, 'i').test(i.n);
    const isOrrery = i => i.type === 'png' && i.w === ORRERY.w && i.h === ORRERY.h
                          && new RegExp(`\\(${hexCode}\\) Orrery\\.png$`, 'i').test(i.n);
    const m = mode === 'legacy' ? 'sheet' : mode;
    const full = level === null || level === 'g';

    // What this mode at this level must produce, in page order.
    let want;
    if (m === 'none' || level === 'c') want = [];
    else if (!full)                    want = ['orrery'];     // the choice can only REMOVE
    else if (m === 'both')             want = ['sheet', 'orrery'];
    else                               want = [m];

    const kinds = info.map(i => isSheet(i) ? 'sheet' : isOrrery(i) ? 'orrery' : '?');
    check(kinds.length === want.length && want.every(k => kinds.includes(k)),
          `${tag}: system images are [${want.join(', ') || 'none'}]`, desc);
    if (!full) check(!info.some(i => i.type === 'jpeg' || i.w === SHEET_W),
                     `${tag}: the sheet is NOT exported`, desc);

    // Every image reference on every page resolves to a member of the ZIP, and
    // the system page shows the system images in the wanted order.
    const missing = [];
    let sheetAltSaysOrrery = false, orreryAltSaysSheet = false;
    let pageOrder = null;
    for (const n of names) {
        const text = /\.(html|md)$/i.test(n) ? zip.get(n).toString('utf8') : null;
        if (!text) continue;
        const refs = [];
        if (/\.html$/i.test(n)) {
            const dir = path.posix.dirname(n);
            for (const mm of text.matchAll(/<img src="([^"]+)"(?: alt="([^"]*)")?/g)) {
                const target = path.posix.normalize(dir + '/' + decodeURIComponent(mm[1]));
                if (!zip.has(target)) missing.push(`${n} -> ${mm[1]}`);
                if (/\.jpe?g$/i.test(target) && /orrery/i.test(mm[2] || '')) sheetAltSaysOrrery = true;
                if (/ Orrery\.png$/i.test(target) && !/orrery/i.test(mm[2] || '')) orreryAltSaysSheet = true;
                refs.push(path.posix.basename(target));
            }
        } else {
            for (const mm of text.matchAll(/!\[\[([^\]|]+)/g)) {
                if (!names.some(z => path.posix.basename(z) === mm[1])) missing.push(`${n} -> ${mm[1]}`);
                refs.push(mm[1]);
            }
        }
        const sys = refs.filter(r => sysRe.test(r));
        if (sys.length) pageOrder = sys.map(r => /\.jpe?g$/i.test(r) ? 'sheet' : 'orrery');
    }
    check(missing.length === 0, `${tag}: every embedded image is in the ZIP`, missing.slice(0, 2).join(' | '));
    check(JSON.stringify(pageOrder || []) === JSON.stringify(want),
          `${tag}: page shows [${want.join(', ') || 'none'}] in that order`,
          (pageOrder || []).join(', ') || 'none');

    if (kind === 'HTML') {
        check(!sheetAltSaysOrrery, `${tag}: the sheet is not captioned "orrery"`);
        check(!orreryAltSaysSheet, `${tag}: the orrery is captioned "orrery"`);
    }
    if (kind === 'HTML' && want.includes('sheet')) {
        // 3440 px in a ~926 px column is unreadable, so the sheet links to
        // itself at full size (Sean, 2026-09-25).
        const sheetInfo = info.find(isSheet);
        const sheet = sheetInfo && path.basename(sheetInfo.n);
        const pageName = names.find(n => /\.html$/i.test(n) && n.endsWith(`(${hexCode}).html`));
        const html = pageName ? zip.get(pageName).toString('utf8') : '';
        const mm = sheet && html.match(/<a href="([^"]+)"[^>]*><img src="([^"]+)"/);
        check(!!mm && mm[1] === mm[2] && decodeURIComponent(mm[1]).endsWith(sheet),
              `${tag}: the sheet links to itself at full size`, mm ? mm[1] : 'no <a><img> on the page');
    }
}

// ── Run ─────────────────────────────────────────────────────────────────────
(async () => {
    const browser = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const errors = [];
    const loaded = {};
    for (const c of CASES) {
        const file = REPO + '/' + c.sector;
        if (!fs.existsSync(file)) { check(false, `${c.hex}: sector file present`, c.sector); continue; }
        loaded[c.sector] = loaded[c.sector] || JSON.parse(fs.readFileSync(file, 'utf8'));
        const sector = loaded[c.sector];
        const st = sector.hexStates[c.hex];
        if (!st) { check(false, `${c.hex}: hex present in ${c.sector}`); continue; }

        const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        page.setDefaultTimeout(0);
        page.on('pageerror', e => errors.push(`${c.hex} pageerror: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error') errors.push(`${c.hex} console: ${m.text()}`); });
        await page.goto('file:///' + REPO + '/hex_map.html');
        await page.waitForTimeout(2500);
        await page.evaluate(({ hex, st, names, settings }) => {
            window.alert = () => {}; window.confirm = () => true;
            window.isLoggingEnabled = false;
            hexStates.clear();
            hexStates.set(hex, st);
            if (names) window.sectorNames = names;
            if (settings && settings.terrainFieldVersion != null)
                window.terrainFieldVersion = settings.terrainFieldVersion;
            window.downloadBlob = (content, filename) => {
                let bin = '';
                for (let i = 0; i < content.length; i += 0x8000)
                    bin += String.fromCharCode.apply(null, content.subarray(i, i + 0x8000));
                window.__cap = { filename, b64: btoa(bin) };
            };
        }, { hex: c.hex, st, names: sector.sectorNames, settings: sector.settings });

        const [sec, sub] = c.hex.split('-');
        for (const kind of ['HTML', 'Obsidian']) {
            for (const mode of MODES) for (const level of LEVELS) {
                if (mode === 'legacy' && !LEGACY_LEVELS.includes(level)) continue;
                const cap = await page.evaluate(async ({ kind, level, mode, hex, sec, sub }) => {
                    hexStates.get(hex).disclosure = level || undefined;
                    window.__cap = null;
                    let err = null;
                    const opts = { includeImages: false, imageProjection: 'globe', skipAirless: false,
                                   useSubfolders: true,
                                   playerVersion: level !== null,
                                   onProgress: () => {}, onDone: () => {}, onError: e => { err = String(e); } };
                    if (mode === 'legacy') opts.includeSystemImages = true;
                    else opts.systemImages = mode;
                    const X = kind === 'HTML' ? HtmlExporter : ObsidianExporter;
                    try { await X.startExport(parseInt(sec, 10), sub, opts); }
                    catch (e) { err = String(e && e.stack || e); }
                    await new Promise(r => setTimeout(r, 300));
                    return { cap: window.__cap, err };
                }, { kind, level, mode, hex: c.hex, sec, sub });
                const tag = `${kind} ${c.hex} ${level ? '(' + level + ')' : 'GM'} [${mode}]`;
                if (!cap.cap) { check(false, `${tag}: export produced a ZIP`, cap.err || 'no download'); continue; }
                const buf = Buffer.from(cap.cap.b64, 'base64');
                check(buf.readUInt32LE(0) === 0x04034b50, `${tag}: download is a ZIP`, cap.cap.filename);
                assessExport(kind, c, level, mode, readZip(buf));
            }
        }
        await page.close();
        console.log(`done ${c.hex} (${c.what})`);
    }
    await browser.close();

    check(errors.length === 0, 'Zero console/page errors', errors.slice(0, 3).join(' | '));
    console.log('\n=== System sheet export check ===');
    pass.forEach(p => console.log('  PASS  ' + p));
    fail.forEach(f => console.log('  FAIL  ' + f));
    console.log(`\n${pass.length} passed, ${fail.length} failed`);
    process.exit(fail.length ? 1 : 0);
})();
