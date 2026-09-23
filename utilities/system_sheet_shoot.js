// ---------------------------------------------------------------------------
// SYSTEM SHEET SHOOT - render named hexes to PNG.  node ... shoot.js 18-E-0313 ...
//
// Part of the SYSTEM SHEET harness (v0.18.1). Run from the repo root:
//     node utilities/system_sheet_shoot.js [sectorPath]
//
// `sectorPath` defaults to sectors/solo_6.json. **PASS A DIFFERENT SECTOR** to
// test another engine: solo_6 is 100% MgT2E and 100% fully-generated, so on
// its own it exercises exactly one of the five engines and never the
// UWP-only case. That gap is the whole reason these files were kept.
//
// Requires playwright, already in node_modules. Launches with --disable-gpu:
// see directives/terrain_spec.md 14.1 for why that matters in this project.
// ---------------------------------------------------------------------------
// Renders system sheets in the real app and writes them out as PNGs.
// Usage: node shoot_sheet.js [hexId ...]
const { chromium } = require('playwright');
const SECTOR_ARG = process.argv.find(a => /\.json$/i.test(a));
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..').replace(/\\/g, '/');
const SECTOR = SECTOR_ARG || (REPO + '/sectors/solo_6.json');
const OUT  = __dirname + '/_sheet_out';

const IDS = process.argv.slice(2).length ? process.argv.slice(2)
          : ['18-E-0313', '18-L-2623', '18-B-1402'];

(async () => {
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto('file:///' + REPO + '/hex_map.html');
    await page.waitForTimeout(2500);

    const sector = JSON.parse(fs.readFileSync(SECTOR, 'utf8'));
    const subset = {};
    for (const id of IDS) subset[id] = sector.hexStates[id];
    const missing = IDS.filter(id => !subset[id]);
    if (missing.length) console.log('NOT IN SECTOR:', missing.join(', '));

    await page.evaluate(({ subset, names, settings }) => {
        for (const [k, v] of Object.entries(subset)) if (v) hexStates.set(k, v);
        if (names) window.sectorNames = names;
        // Honour the sector's own terrain model, exactly as io_manager would.
        if (settings && settings.terrainFieldVersion != null)
            window.terrainFieldVersion = settings.terrainFieldVersion;
    }, { subset, names: sector.sectorNames, settings: sector.settings });

    const report = [];
    for (const id of IDS) {
        if (!subset[id]) continue;
        const data = await page.evaluate(async (hexId) => {
            const st = hexStates.get(hexId);
            const t0 = performance.now();
            const canvas = SystemSheet.render(st, hexId);
            const ms = performance.now() - t0;
            if (!canvas) return { error: 'render returned null' };
            const nsys = SystemViewer.normalizeSystem(st);
            return {
                dataUrl: canvas.toDataURL('image/png'),
                w: canvas.width, h: canvas.height, ms: Math.round(ms),
                name: nsys.name, bodies: (nsys.worlds || []).length,
                stars: (nsys.stars || []).length,
            };
        }, id);

        if (data.error) { report.push({ id, error: data.error }); continue; }
        const b64 = data.dataUrl.split(',')[1];
        const file = `${OUT}/sheet_${id}.png`;
        fs.writeFileSync(file, Buffer.from(b64, 'base64'));
        report.push({ id, name: data.name, px: `${data.w}x${data.h}`,
                      kb: Math.round(Buffer.from(b64, 'base64').length / 1024),
                      ms: data.ms, bodies: data.bodies, stars: data.stars, file });
    }

    console.log('\n' + 'id'.padEnd(12) + 'name'.padEnd(14) + 'size'.padEnd(12)
              + 'KB'.padEnd(7) + 'ms'.padEnd(7) + 'bodies  stars');
    for (const r of report) {
        if (r.error) { console.log(r.id.padEnd(12) + 'ERROR: ' + r.error); continue; }
        console.log(r.id.padEnd(12) + String(r.name).padEnd(14) + r.px.padEnd(12)
                  + String(r.kb).padEnd(7) + String(r.ms).padEnd(7)
                  + String(r.bodies).padEnd(8) + r.stars);
    }
    if (errors.length) console.log('\nPAGE ERRORS:\n  ' + errors.slice(0, 10).join('\n  '));
    else console.log('\nno page errors');
    await browser.close();
})();
