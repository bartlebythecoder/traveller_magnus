// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM SHEET — a one-page, print-style reference sheet for a single system.
//
// Landscape, dark, dense: an orbital strip of rendered bodies across the top,
// data panels around it, a planetary table below. Composed entirely on ONE
// canvas and saved as a PNG, which is the whole reason it is canvas and not
// HTML — a browser will not hand you a picture of its own DOM without an
// external library, and this project has no dependencies.
//
// ── THE CONTRACTS THIS MODULE DEPENDS ON ────────────────────────────────────
//
// * `SystemViewer.normalizeSystem(state)` is the data source, NOT ExportCore's
//   block model. The recorded ruling named the block model, and that ruling was
//   right for "world on a page" — a linear document — but wrong here. Blocks are
//   pre-formatted label/value PAIRS (`f('Gravity', '0.47 G')`); a sheet needs
//   `gravity` as a NUMBER, to sort a column, scale a disc and place it on an
//   axis. normalizeSystem returns exactly that, already reconciled across all
//   five engines, and it is what the orrery itself draws from — so the sheet
//   and the orrery agree about a system by construction rather than by care.
//   Numbers are still formatted through `ExportCore.fmtNum`, so precision
//   matches the exports to the digit.
//
// * `PlanetRenderer.renderApproachFrame(canvas, world, hexId, lonOffset)` draws
//   a lit sphere to any canvas at any size. Every disc on the sheet is one call.
//
// * `PlanetRenderer.tempBandFromKelvin(k)` gives the band. USE IT — a planet's
//   colour dot must agree with how that planet actually looks, and those
//   boundaries are already baked into every world-image palette.
//
// ── THINGS THAT WILL BITE, ALL LEARNED THE HARD WAY ─────────────────────────
//
// * SUPERSAMPLE EVERY DISC. Render at 3x the displayed size and let the browser
//   downscale. Terminators and coastlines fall apart at native size.
// * DISC SIZE IS LOG-SCALED AND CLAMPED, never true scale. A 1,600 km rock must
//   read as a pebble beside a 17,600 km world without vanishing.
// * ORBIT SPACING IS ORDINAL. 0.72 AU and 26.32 AU sit evenly and the AU labels
//   carry the truth. Proportional spacing bunches everything against the left.
// * FIELD NAMES LIE. `totalWorlds` on a Makarov-sized system reads 960. Count
//   the list. Never print a number nobody has checked.
// * NO HABITABLE ZONE BAND. `normalizeSystem` falls back to `_orbitToAU(3)`
//   when `sys.hzco` is absent, which it is in real saved sectors — every system
//   then claims an HZ at 1.00 AU, including an M0 III at luminosity 330. The
//   real sources are `MGT2E_HZ_DEVIATION` (js/constants.js) and CT's
//   `hasHZ`/`hzOverride`. Until one of them is wired in, the band stays OFF.
//   Do not substitute sqrt(luminosity) — that is invented, not RAW.
//
// Scope, as agreed: single star, no gas giants, no moons. Belts ARE handled —
// without them the moonless single-star test corpus is one system, not three.
// ─────────────────────────────────────────────────────────────────────────────

const SystemSheet = (function () {
    'use strict';

    // ── Geometry ────────────────────────────────────────────────────────────
    // Everything below is authored in LOGICAL units and drawn through a scale
    // transform, so the same layout code produces a crisp sheet at any output
    // resolution. Change SCALE, not the numbers.
    const W = 1720, H = 878;
    const SCALE_DEFAULT = 2;          // 3440 x 1756 — the mockup's resolution
    const M = 20;                     // outer margin

    const THEME = {
        sheet:   '#07090e',
        panel:   '#0b1017',
        panelHi: '#0e141d',
        rule:    '#1c2634',
        ink:     '#dfe6ef',
        dim:     '#7d8b9c',
        faint:   '#4a5665',
        gold:    '#d9a441',
        green:   '#4caf6e',
    };

    // ONE semantic colour set, reused in three places — the legend, the table's
    // left gutter and the Band column. That reuse is what makes the sheet read
    // as systematic rather than decorated.
    const BAND_COLOR = {
        Frozen:    '#7fb9e6',
        Cold:      '#4a90d9',
        Cool:      '#3fc0c8',
        Temperate: '#4caf6e',
        Warm:      '#e8973f',
        Hot:       '#e05545',
    };
    const BAND_RANGE = {
        Frozen: '<230 K', Cold: '230–265 K', Cool: '265–290 K',
        Temperate: '290–330 K', Warm: '330–360 K', Hot: '360+ K',
    };
    const BAND_ORDER = ['Frozen', 'Cold', 'Cool', 'Temperate', 'Warm', 'Hot'];

    const SANS = '"Inter","Segoe UI",Helvetica,Arial,sans-serif';
    const MONO = '"JetBrains Mono","Consolas",monospace';

    // ── Number formatting ───────────────────────────────────────────────────
    // Through ExportCore.fmtNum wherever it exists, so a value on the sheet and
    // the same value in an export are formatted by ONE definition.
    function num(v, dp) {
        if (v == null || v === '') return '—';
        if (window.ExportCore && typeof ExportCore.fmtNum === 'function') {
            return String(ExportCore.fmtNum(v, dp));
        }
        const n = parseFloat(v);
        return isFinite(n) ? n.toFixed(dp == null ? 2 : dp) : String(v);
    }
    function intStr(v) {
        const n = parseFloat(v);
        return isFinite(n) ? Math.round(n).toLocaleString() : '—';
    }
    function bandOf(w) {
        const k = w && w.meanTempK;
        if (k == null || !isFinite(k)) return null;
        if (window.PlanetRenderer && PlanetRenderer.tempBandFromKelvin) {
            return PlanetRenderer.tempBandFromKelvin(k);
        }
        return k < 230 ? 'Frozen' : k < 265 ? 'Cold' : k < 290 ? 'Cool'
             : k < 330 ? 'Temperate' : k < 360 ? 'Warm' : 'Hot';
    }

    // ── Body classification ─────────────────────────────────────────────────
    // normalizeSystem hands back `type` strings that differ per engine, so the
    // three questions the sheet actually asks are answered in one place.
    function isBelt(w) {
        const t = String(w.type || '');
        return /belt/i.test(t) || /belt/i.test(String(w.composition || ''));
    }
    function isGasGiant(w) {
        const t = String(w.type || '');
        return /gas ?giant/i.test(t) || /\bGG\b/.test(String(w.composition || ''));
    }
    function isMainworld(w) { return String(w.type || '') === 'Mainworld'; }

    // Travel zone, by the project's own convention (ExportCore.travelZone, the
    // editor's _normTz): Red and Amber are stated; anything else recorded -
    // 'G', 'Green', MgT2E's legacy '-', or absent on a body - is Green. Only a
    // zone the normaliser flagged INVENTED (CT, which records none) is null.
    const TZ_COLOR = { Red: '#e05545', Amber: '#e8a13a' };
    function travelZoneOf(w) {
        if (!w || (w.travelZone === null && 'travelZone' in w)) return null;
        const z = String(w.travelZone || '');
        return /^r/i.test(z) ? 'Red' : /^a/i.test(z) ? 'Amber' : 'Green';
    }

    // The moons of a body that actually exist. `moons[]` carries Empty slots
    // exactly as `worlds[]` does - the phantom-world trap - so every consumer
    // must filter, never take `.length` raw.
    function liveMoons(b) {
        return ((b && b.moons) || []).filter(m => m && m.type !== 'Empty');
    }

    // ── Companion stars ───────────────────────────────────────────────
    //
    // MULTI-STAR IS REALLY A BINARY PROBLEM: of 438 systems in solo_6, 359 are
    // single, 75 are exactly two, and three-or-more occurs FOUR TIMES in the
    // whole sector. Designing for "multi-star" in the abstract means designing
    // for four systems.
    //
    // AND A COMPANION'S ORBIT MAY SIMPLY NOT BE RECORDED. The shipped engine
    // writes `orbitId` and `separation` (mgt2e_stellar_engine.js ~815), but
    // solo_6 is a v0.13.3 file written before those existed, so every one of
    // its 86 companions carries only a `role` WORD -- "Close", "Very Close",
    // "Moderate". There is no RAW table mapping those words to a distance in
    // MgT2E, so a sheet that placed such a star on the orbit axis would be
    // stating an invented figure as fact. It must not, and it does not: a
    // companion is placed ONLY when its orbitId is present, and otherwise it
    // is named in the star panel with its role and no position at all.
    //
    // `!= null` is deliberate and load-bearing — legacy saves OMIT the key, so
    // both null and undefined occur in the wild.
    function resolveCompanions(nsys) {
        const out = [];
        for (const s of (nsys.stars || []).slice(1)) {
            if (!s) continue;
            let au = null;
            // R4: an RTT companion's orbitAU is a separation WORD turned into a
            // number by the normaliser - named by its word, never positioned.
            if ((s.invented || []).includes('orbitAU')) au = null;
            else if (s.orbitAU != null) au = s.orbitAU;
            // D1 (Sean, 2026-09-23): orbitToAU reads MgT2E's orbit table. A T5
            // orbitID is not assumed to share it, so a T5 companion with no
            // recorded distance is named by role only.
            else if (nsys.edition === 'T5') au = null;
            else if (s.orbitId != null && window.SystemViewer && SystemViewer.orbitToAU) {
                au = SystemViewer.orbitToAU(s.orbitId);
            }
            out.push({ star: s, au: au });
        }
        return out;
    }

    function starLabel(s) {
        return s.name || ((s.sType || '?') + (s.subType != null ? s.subType : '') + ' ' + (s.sClass || '')).trim();
    }

    // Returns { body, parent } - `parent` is the planet a lunar mainworld
    // orbits, and null when the mainworld orbits the star directly. Every
    // consumer must ask which it has: the ORBIT belongs to the parent, the
    // physical STATS belong to the body.
    function findMainworld(bodies) {
        const direct = bodies.find(isMainworld);
        if (direct) return { body: direct, parent: null };
        for (const w of bodies) {
            const moon = (w.moons || []).find(m => m && isMainworld(m));
            if (moon) return { body: moon, parent: w };
        }
        return { body: null, parent: null };
    }

    // ── Canvas text helpers ─────────────────────────────────────────────────
    // The part HTML would have given away free. Kept deliberately small: a
    // truncator, a wrapper and a leader-filler cover every label on the sheet.

    function truncate(ctx, text, maxW) {
        const s = String(text == null ? '' : text);
        if (ctx.measureText(s).width <= maxW) return s;
        const ell = '…';
        let lo = 0, hi = s.length;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (ctx.measureText(s.slice(0, mid) + ell).width <= maxW) lo = mid;
            else hi = mid - 1;
        }
        return s.slice(0, lo) + ell;
    }

    function wrap(ctx, text, maxW) {
        const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
        const lines = [];
        let line = '';
        for (const word of words) {
            const trial = line ? line + ' ' + word : word;
            if (ctx.measureText(trial).width <= maxW || !line) line = trial;
            else { lines.push(line); line = word; }
        }
        if (line) lines.push(line);
        return lines;
    }

    // Dotted leader between a left label and a right value. The dots are laid
    // from the label's true end to the value's true start, so a long label
    // simply gets fewer dots rather than colliding with its own value.
    function leaderRow(ctx, x, y, w, label, value, opts) {
        const o = opts || {};
        ctx.font = (o.labelFont || '12px ' + SANS);
        ctx.textAlign = 'left';
        ctx.fillStyle = o.labelColor || THEME.dim;
        const lab = truncate(ctx, label, w * 0.55);
        ctx.fillText(lab, x, y);
        const labW = ctx.measureText(lab).width;

        ctx.font = (o.valueFont || '600 12px ' + SANS);
        ctx.textAlign = 'right';
        ctx.fillStyle = o.valueColor || THEME.ink;
        const val = truncate(ctx, value, w * 0.5);
        ctx.fillText(val, x + w, y);
        const valW = ctx.measureText(val).width;

        const gapL = x + labW + 5, gapR = x + w - valW - 5;
        if (gapR > gapL) {
            ctx.fillStyle = THEME.faint;
            ctx.textAlign = 'left';
            ctx.font = '11px ' + SANS;
            for (let dx = gapL; dx < gapR; dx += 4) ctx.fillText('.', dx, y);
        }
        ctx.textAlign = 'left';
    }

    // A plain two-column row — label dim left, value ink right, no leaders.
    // Mirrors terrain_frame.js's sidebar row, deliberately: the two sheets are
    // siblings and should not diverge in how a key/value line looks.
    function kvRow(ctx, x, y, w, label, value, opts) {
        const o = opts || {};
        ctx.font = o.labelFont || '12px ' + SANS;
        ctx.fillStyle = o.labelColor || THEME.dim;
        ctx.textAlign = 'left';
        ctx.fillText(truncate(ctx, label, w * 0.6), x, y);
        ctx.font = o.valueFont || '600 12px ' + SANS;
        ctx.fillStyle = o.valueColor || THEME.ink;
        ctx.textAlign = 'right';
        ctx.fillText(truncate(ctx, value, w * 0.55), x + w, y);
        ctx.textAlign = 'left';
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y,     x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x,     y + h, r);
        ctx.arcTo(x,     y + h, x,     y,     r);
        ctx.arcTo(x,     y,     x + w, y,     r);
        ctx.closePath();
    }

    // A panel: filled card, hairline border, optional letter-spaced title.
    // Returns the y of the first content line, so callers never hand-compute
    // the offset below a title that may or may not be there.
    function panel(ctx, x, y, w, h, title, opts) {
        const o = opts || {};
        ctx.fillStyle = o.fill || THEME.panel;
        roundRect(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.strokeStyle = o.border || THEME.rule;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (!title) return y + 18;
        ctx.font = '700 11px ' + SANS;
        ctx.fillStyle = o.titleColor || THEME.gold;
        ctx.textAlign = 'left';
        // Letter-spacing by hand — canvas has no such property.
        let tx = x + 16;
        for (const ch of String(title).toUpperCase()) {
            ctx.fillText(ch, tx, y + 24);
            tx += ctx.measureText(ch).width + 1.4;
        }
        return y + 46;
    }

    // ── Disc sizing ─────────────────────────────────────────────────────────
    // Log-scaled and clamped. True scale is unusable: a 1,600 km rock beside a
    // 17,600 km world either vanishes or forces the big one off the sheet.
    const DISC_MIN = 34, DISC_MAX = 76;
    const KM_MIN = 1600, KM_MAX = 17600;
    // GAS GIANTS GET THEIR OWN BAND, ABOVE THE TERRESTRIAL ONE. Sharing one
    // scale is not an option: every gas giant in solo_6 reports exactly
    // 50,000 km, so on the terrestrial curve they all clamp to the same value
    // as a large rocky world and a giant stops reading as a giant. The two
    // bands do not overlap, so any gas giant is larger than any rock — which
    // is the one thing the strip must convey and the only thing true of all
    // of them.
    const GG_MIN = 84, GG_MAX = 108;
    const GG_KM_MIN = 40000, GG_KM_MAX = 160000;
    function discSize(diamKm, gg) {
        const lo = gg ? GG_KM_MIN : KM_MIN, hi = gg ? GG_KM_MAX : KM_MAX;
        const pxLo = gg ? GG_MIN : DISC_MIN, pxHi = gg ? GG_MAX : DISC_MAX;
        // A non-numeric diameter (RTT Jovians: "Variable (Giant)") must size as
        // unknown, never reach createRadialGradient as NaN and abort the sheet.
        const km = Number(diamKm);
        const d = Math.max(lo, Math.min(hi, (diamKm != null && isFinite(km) && km > 0) ? km : lo));
        const t = (Math.log(d) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
        return pxLo + t * (pxHi - pxLo);
    }

    // Draw one body's disc at (cx, cy) with the given LOGICAL diameter.
    // SUPERSAMPLED: the offscreen is 3x the device size, then downscaled by
    // drawImage. This is what keeps a 34 px terminator clean.
    const SS = 3;
    function drawDisc(ctx, world, hexId, cx, cy, sizeLogical, deviceScale, seedFallback) {
        const px = Math.max(8, Math.round(sizeLogical * deviceScale * SS));
        const off = document.createElement('canvas');
        off.width = off.height = px;
        try {
            if (window.PlanetRenderer && PlanetRenderer.renderApproachFrame) {
                // TWO THINGS HERE ARE EASY TO GET WRONG, AND BOTH WERE.
                //
                // 1. renderApproachFrame's third parameter is NAMED `hexId` but
                //    is the whole per-body SEED KEY — every seed inside it is
                //    `masterSeed + '-' + <that> + '-xx'`. Pass a bare hexId and
                //    every body in the system gets the SAME heightfield,
                //    continents and craters: eight identical planets in a row.
                //    `imageSeed` is the one definition of that key, and it is
                //    built from the body's NAME, because orbitId is not unique.
                //
                // 2. It does NOT accept a normalizeSystem world. It reads
                //    `atmosphere` and `hydrographics` as parsed UWP digits and
                //    `temperatureK`, none of which that shape carries — so the
                //    palette classifies every body as an airless rock and the
                //    whole strip comes out grey. `ExportCore.rendererData` is
                //    the one adapter, shared with the world images and the
                //    regional sheets so all three draw the same planet.
                const seed = PlanetRenderer.imageSeed(hexId, world, seedFallback);
                const rd = (window.ExportCore && ExportCore.rendererData)
                    ? ExportCore.rendererData(world) : world;
                PlanetRenderer.renderApproachFrame(off, rd, seed, 0);
            }
        } catch (e) {
            // A body the renderer cannot draw must not take the sheet with it.
            if (window.console) console.warn('SystemSheet: disc failed for', world && world.name, e);
            return false;
        }
        ctx.drawImage(off, cx - sizeLogical / 2, cy - sizeLogical / 2, sizeLogical, sizeLogical);
        return true;
    }

    // One seeded RNG for every decorative draw on the sheet, so a belt, a gas
    // giant and the starfield are all reproducible from the same key and none
    // of them drifts when another is edited.
    function rngFrom(seedStr) {
        let s = 2166136261;
        const str = String(seedStr);
        for (let i = 0; i < str.length; i++) s = ((s ^ str.charCodeAt(i)) * 16777619) >>> 0;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    // ── Gas giants ──────────────────────────────────────────────────────────
    // A GAS GIANT IS NOT A ROCKY WORLD AND MUST NOT BE DRAWN AS ONE.
    // 98.4% of systems in solo_6 carry at least one, and every single one was
    // going through `renderApproachFrame` — which draws a lit rocky surface —
    // so a 50,000 km giant rendered as an oversized grey cratered moon.
    //
    // THIS DELIBERATELY DOES NOT LIVE IN `planet_renderer.js`. That file sits
    // behind the frozen terrain-field guarantee (see directives/terrain_spec.md
    // §3) and a gas giant needs none of its heightfield machinery. Keeping the
    // banding here means `verify_field_v1` is untouched by any of it.
    //
    // Terrain is art, not rules — the Zero-Assumption Policy covers RPG tables,
    // and no Traveller table describes what a gas giant looks like.
    const GG_PALETTES = [
        ['#c9a87c', '#e6d3b0', '#9d7b52', '#f0e4cc'],   // Jupiter-ish tan
        ['#d9c48f', '#f2e6c2', '#b39a63', '#fbf3dc'],   // Saturn-ish gold
        ['#8fc4c9', '#bfe0e2', '#5f9aa1', '#d9eef0'],   // Uranus-ish cyan
        ['#6f8fc4', '#9fb6e0', '#48639d', '#c3d2ef'],   // Neptune-ish blue
        ['#c98f8f', '#e2b6b6', '#9d6161', '#efd2d2'],   // rust
    ];

    function drawGasGiant(ctx, cx, cy, size, seedStr) {
        const rnd = rngFrom(seedStr + '|gg');
        const pal = GG_PALETTES[Math.floor(rnd() * GG_PALETTES.length)];
        const r = size / 2;
        const OBL = 0.94;                       // gas giants are visibly oblate

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, OBL);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = pal[0];
        ctx.fillRect(-r, -r, r * 2, r * 2);

        // Latitudinal bands. Drawn as straight strips inside the clip — at
        // 40-110 px the curvature of a real latitude line is below a pixel,
        // and faking it costs more than it shows.
        const bands = 7 + Math.floor(rnd() * 7);
        let by = -r;
        for (let i = 0; i < bands; i++) {
            const bh = (r * 2 / bands) * (0.6 + rnd() * 0.9);
            const c = pal[1 + Math.floor(rnd() * 3)];
            ctx.globalAlpha = 0.28 + rnd() * 0.42;
            ctx.fillStyle = c;
            // A slight vertical wobble along the band keeps the edges from
            // reading as ruled lines.
            ctx.beginPath();
            ctx.moveTo(-r, by);
            const segs = 8;
            for (let s = 0; s <= segs; s++) {
                const px = -r + (r * 2 * s / segs);
                ctx.lineTo(px, by + Math.sin(s * 1.7 + i) * (bh * 0.10));
            }
            for (let s = segs; s >= 0; s--) {
                const px = -r + (r * 2 * s / segs);
                ctx.lineTo(px, by + bh + Math.sin(s * 1.3 + i * 2) * (bh * 0.10));
            }
            ctx.closePath();
            ctx.fill();
            by += bh;
        }
        ctx.globalAlpha = 1;

        // One storm oval on roughly half of them.
        if (rnd() < 0.5) {
            const sx = (rnd() - 0.5) * r * 1.0;
            const sy = (rnd() - 0.5) * r * 1.1;
            const sw = r * (0.16 + rnd() * 0.18);
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = pal[3];
            ctx.beginPath();
            ctx.ellipse(sx, sy, sw, sw * 0.52, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Limb darkening, then the terminator — lit from the upper left, which
        // is the direction planet_renderer lights every other body from, so a
        // giant and a rock on the same strip agree about where the star is.
        const limb = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
        limb.addColorStop(0, 'rgba(0,0,0,0)');
        limb.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = limb;
        ctx.fillRect(-r, -r, r * 2, r * 2);

        const term = ctx.createRadialGradient(-r * 0.42, -r * 0.42, r * 0.15, -r * 0.30, -r * 0.30, r * 1.55);
        term.addColorStop(0,    'rgba(255,255,255,0.20)');
        term.addColorStop(0.45, 'rgba(0,0,0,0)');
        term.addColorStop(1,    'rgba(0,0,0,0.72)');
        ctx.fillStyle = term;
        ctx.fillRect(-r, -r, r * 2, r * 2);

        ctx.restore();
    }

    // A belt is not a sphere and must not be drawn as one. Seeded scatter, so
    // the same belt looks the same every time the sheet is rendered.
    function drawBelt(ctx, cx, cy, size, seedStr) {
        const rnd = rngFrom(seedStr);
        const rOuter = size / 2, rInner = rOuter * 0.55;
        for (let i = 0; i < 150; i++) {
            const a = rnd() * Math.PI * 2;
            const r = rInner + rnd() * (rOuter - rInner);
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r * 0.42;       // flattened — seen near edge-on
            const d = 0.5 + rnd() * 1.2;
            ctx.fillStyle = `rgba(190,180,165,${0.25 + rnd() * 0.55})`;
            ctx.beginPath();
            ctx.arc(px, py, d, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawStarGlow(ctx, cx, cy, r, sType) {
        const tint = { O: '#9db8ff', B: '#bcd0ff', A: '#eaf0ff', F: '#fff6e8',
                       G: '#ffe9a8', K: '#ffc06a', M: '#ff8a52' }[String(sType || 'G')[0]] || '#ffd98a';
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0,    '#ffffff');
        g.addColorStop(0.35, tint);
        g.addColorStop(0.62, tint);
        g.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Faint starfield, drawn once under everything. Seeded off the hex so a
    // system's sheet is identical every time it is produced.
    function drawBackdrop(ctx, seedStr) {
        ctx.fillStyle = THEME.sheet;
        ctx.fillRect(0, 0, W, H);
        let s = 2166136261;
        for (let i = 0; i < String(seedStr).length; i++) s = ((s ^ String(seedStr).charCodeAt(i)) * 16777619) >>> 0;
        const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        for (let i = 0; i < 260; i++) {
            const x = rnd() * W, y = rnd() * H, a = 0.05 + rnd() * 0.25;
            ctx.fillStyle = `rgba(215,230,248,${a})`;
            ctx.fillRect(x, y, rnd() < 0.12 ? 1.4 : 0.9, rnd() < 0.12 ? 1.4 : 0.9);
        }
    }

    // ── The sheet ───────────────────────────────────────────────────────────

    // R4/R8 - NO INVENTED VALUE IS PRINTED AS FACT (ruled 2026-09-23).
    // The sheet draws from DISPLAY COPIES of the normalised bodies, never the
    // originals, so suppressing a value here cannot leak into the orrery or
    // the exporters that share normalizeSystem:
    //  * an AU the normaliser SYNTHESISED (RTT: `nsys.invented` has 'au') is
    //    nulled - every distance print is null-safe and reads as a dash, and
    //    the strip drops its AU labels entirely. `_orderAU` keeps the order.
    //  * a gravity that is not a finite number (RTT gas giants store the
    //    string "Variable (Giant)") is nulled rather than printed into a
    //    numeric column (R8). The giant is identified by its disc and type.
    // Moons are copied too: the mainworld is a moon in most systems, and the
    // mainworld panels read it directly.
    function displayBodies(nsys) {
        const auInvented = (nsys.invented || []).includes('au');
        const clean = w => {
            const c = Object.assign({}, w);
            c._orderAU = w.au;
            if (auInvented) c.au = null;
            // A per-body field the normaliser flagged as a placeholder (CT gas
            // giant / belt 100 K) is dropped, so it prints as a dash and has no band.
            for (const f of (w.invented || [])) c[f] = null;
            const g = Number(w.gravity);
            c.gravity = (typeof w.gravity === 'number' || typeof w.gravity === 'string')
                && w.gravity !== '' && isFinite(g) ? g : null;
            if (Array.isArray(w.moons)) c.moons = w.moons.map(m => m ? clean(m) : m);
            return c;
        };
        return (nsys.worlds || []).filter(w => w && w.type !== 'Empty').map(clean);
    }

    function render(state, hexId, opts) {
        const o = opts || {};
        const scale = o.scale || SCALE_DEFAULT;

        const nsys = (window.SystemViewer && SystemViewer.normalizeSystem)
            ? SystemViewer.normalizeSystem(state) : null;
        if (!nsys) return null;

        // COUNT THE LIST. `nsys.totalWorlds` exists and is not the number of
        // worlds in this system — it read 960 on an eight-world system in the
        // mockup. Every count below is derived here, from the bodies present.
        let bodies = displayBodies(nsys);
        // R5 - THE REDUCED SHEET (ruled 2026-09-23). A hex with real stars and
        // a UWP-bearing mainworld but no orbits (every TravellerMap import)
        // gets a sheet built from what it HAS: its one table row is the
        // mainworld, the strip is omitted and the layout closes the gap.
        // "A referee asking for a handout on a world does not care that its
        // system was never rolled." render() still returns null for a hex with
        // no world at all - that is what null means now.
        const reduced = !bodies.length && !!nsys.reportedMainworld;
        if (reduced) bodies = displayBodies({ worlds: [nsys.reportedMainworld], invented: nsys.invented });
        // STARS ONLY (Sean, 2026-09-23): real stars and no world of any kind -
        // RTT's X000000-0 systems, AoW's barren systems. An empty star system
        // is real data, so it gets a sheet that SAYS it is empty, rather than
        // a hollow one of "No mainworld recorded" boxes or a refusal.
        const starsOnly = !bodies.length && !reduced;
        const worlds = bodies.filter(w => !isBelt(w));
        const belts  = bodies.filter(isBelt);
        const ggs    = bodies.filter(isGasGiant);
        // A MAINWORLD CAN BE A MOON, AND USUALLY IS. Measured over solo_6 on
        // 2026-09-21: 257 of 438 systems - 58.7% - have their mainworld in a
        // planet's `moons[]` rather than in `worlds[]`. Searching only the top
        // level left both mainworld panels reading "No mainworld recorded" and
        // a third of the sheet blank on the majority of systems.
        // `normalizeSystem` deliberately re-tags such a moon as type
        // 'Mainworld', so the data was right and the lookup was wrong - the
        // same secondary-list-invisible-to-a-function shape that produced the
        // CT captured-planet and moon-type bugs.
        const mwFound  = findMainworld(bodies);
        const mw       = mwFound.body;
        const mwParent = mwFound.parent;   // null when the mainworld orbits the star
        const star   = (nsys.stars || [])[0] || {};

        // `_orderAU` survives R4's suppression of an invented AU, so an RTT
        // system still lists in orbit order with no distance printed.
        const ordered = bodies.slice().sort((a, b) => (a._orderAU || 0) - (b._orderAU || 0));

        // The strip carries bodies AND any companion star whose orbit is known,
        // interleaved by distance. `ordered` stays bodies-only, because it is
        // what numbers the table -- a star must never consume an orbit index.
        const companions = resolveCompanions(nsys);
        const stripItems = ordered.map(b => ({ kind: 'body', b: b, au: b.au }))
            .concat(companions.filter(c => c.au != null)
                              .map(c => ({ kind: 'star', s: c.star, au: c.au })))
            .sort((a, b) => (a.au || 0) - (b.au || 0));

        const canvas = o.canvas || document.createElement('canvas');
        canvas.width  = Math.round(W * scale);
        canvas.height = Math.round(H * scale);
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(scale, scale);
        ctx.textBaseline = 'alphabetic';

        const sysName = resolveSystemName(nsys, state, mw, hexId);
        drawBackdrop(ctx, `${window.masterSeed || ''}|${hexId}|${sysName}`);

        // R2: the six-colour legend explains the Band column, the table gutter
        // and the Satellites gutter. When nothing on this sheet has a band
        // (T5, RTT, CT belts-only...) a legend explains nothing - drop it.
        const showLegend = bodies.some(b => bandOf(b) || liveMoons(b).some(bandOf));
        _header(ctx, sysName, hexId, nsys, showLegend, !reduced && !starsOnly);

        // ── Row 1 ───────────────────────────────────────────────────────────
        const R1Y = 66, R1H = 330;
        const LW = 356;                       // left column width
        const RW = 374;                       // right column width
        const CX = M + LW + 16;               // centre column x
        const CW = W - M - RW - 16 - CX;

        _starPanel(ctx, M, R1Y, LW, 176, star, nsys, companions);
        // T5 socioeconomics on T5 sheets ONLY (Sean, 2026-09-23). solo_6 is
        // MgT2E and still carries `t5Socio` on every hex; printing it there
        // would put one edition's extensions on another edition's world.
        const socio = nsys.edition === 'T5' ? (state.t5Socio || null) : null;
        if (starsOnly) {
            _systemPanel(ctx, M, R1Y + 190, LW, R1H - 190, nsys, ordered, worlds, belts, ggs, mw, mwParent);
            _noWorldsPanel(ctx, CX, R1Y, W - M - CX, R1H, nsys);
            return _finish(canvas, ctx, scale, R1Y + R1H, nsys, false, true);
        } else if (reduced) {
            // No strip: the brief takes the centre and right columns, so the
            // row closes up rather than framing an empty rectangle.
            _reportedPanel(ctx, M, R1Y + 190, LW, R1H - 190, nsys.reported || {});
            _mainworldBrief(ctx, CX, R1Y, W - M - CX, R1H, mw, ordered, nsys, mwParent,
                            { reduced: true, socio });
        } else {
            _systemPanel(ctx, M, R1Y + 190, LW, R1H - 190, nsys, ordered, worlds, belts, ggs, mw, mwParent);
            _orbitStrip(ctx, CX, R1Y, CW, R1H, stripItems, hexId, scale, mw, mwParent, sysName);
            _mainworldBrief(ctx, W - M - RW, R1Y, RW, R1H, mw, ordered, nsys, mwParent, { socio });
        }

        // ── Row 2 ───────────────────────────────────────────────────────────
        const R2Y = R1Y + R1H + 16;
        const R2H = H - R2Y - 44;
        // The table panel is sized to its CONTENT, not to the space available.
        // A full-height box under an eight-row system leaves a quarter of the
        // sheet as an empty rectangle, and a three-body system is far worse —
        // the finding the mockup surfaced. Background is better than a void
        // with a border drawn round it.
        // THE TABLE MUST NEVER DROP A ROW. Nidau (18-P-2632) printed
        // "Catalogued Orbits 16" above a list of 12: the row loop stopped at
        // the panel edge and said nothing. A sheet that quietly omits four
        // worlds is worse than one that fails - the same class of defect as
        // the route panel listing 3 of 6 worlds in v0.17.4.
        //
        // The pitch is therefore DERIVED from the body count rather than fixed
        // at 29, and the font follows it down. Capacity in this space runs from
        // 11 rows at the comfortable pitch to 21 at the tightest.
        const HEAD = 88, PADB = 14, MAX_PITCH = 29, MIN_PITCH = 16;
        const usable = R2H - HEAD - PADB;
        // R6: one column holds floor(usable / MIN_PITCH) rows; past that the
        // table splits in two and the pitch is derived from rows PER COLUMN.
        const oneColCap = Math.floor(usable / MIN_PITCH);
        const splitCols = ordered.length > oneColCap ? 2 : 1;
        const perColRows = Math.ceil(ordered.length / splitCols);
        const rowH = Math.max(MIN_PITCH,
                     Math.min(MAX_PITCH, Math.floor(usable / Math.max(1, perColRows))));
        // Sized to CONTENT, so a three-body system does not sit under a
        // quarter-sheet of empty bordered rectangle.
        const tableH = Math.min(R2H, HEAD + perColRows * rowH + PADB);
        _planetTable(ctx, M, R2Y, W - M - RW - 16 - M, tableH, ordered, mw, rowH, splitCols);
        const mwPanelH = 246;
        _mainworldData(ctx, W - M - RW, R2Y, RW, mwPanelH, mw, mwParent, reduced);
        // D2 (Sean, 2026-09-23): NO EMPTY PANELS. A system with no satellites
        // anywhere - or a reduced sheet, whose satellites were never charted -
        // gets no Satellites box; System Data already says "Satellites 0".
        const anyMoons = !reduced && bodies.some(b => liveMoons(b).length);
        let bottom = Math.max(R2Y + tableH, R2Y + mwPanelH);
        if (anyMoons) {
            _satellites(ctx, W - M - RW, R2Y + mwPanelH + 16, RW, R2H - mwPanelH - 16,
                        mw, mwParent, ordered, sysName, reduced);
            bottom = R2Y + R2H;
        }
        return _finish(canvas, ctx, scale, bottom, nsys, reduced, false);
    }

    // D2 (Sean, 2026-09-23): THE PAGE FITS ITS CONTENT. Layout is computed on
    // the full W x H page - so a dense sheet's capacity is unchanged - and the
    // finished canvas is then cropped to just below the lowest panel, with the
    // footer drawn beneath it. A sparse sheet becomes a shorter image instead
    // of one with an empty lower third. A full sheet reaches H and is untouched.
    const FOOT = 44;
    function _finish(canvas, ctx, scale, contentBottom, nsys, reduced, starsOnly) {
        const pageH = Math.min(H, Math.ceil(contentBottom + FOOT));
        _footer(ctx, nsys, reduced, starsOnly, pageH);
        ctx.restore();
        if (pageH >= H) return canvas;
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = Math.round(pageH * scale);
        tmp.getContext('2d').drawImage(canvas, 0, 0);
        canvas.height = tmp.height;               // resizing clears the canvas
        canvas.getContext('2d').drawImage(tmp, 0, 0);
        return canvas;
    }

    function _header(ctx, sysName, hexId, nsys, showLegend, showMapTitle) {
        ctx.textAlign = 'left';
        ctx.font = '700 30px ' + SANS;
        ctx.fillStyle = THEME.ink;
        ctx.fillText(String(sysName).toUpperCase(), M + 4, 40);

        ctx.font = '12px ' + SANS;
        ctx.fillStyle = THEME.gold;
        const sectorNum = parseInt(String(hexId).split('-')[0], 10);
        const sectorName = (window.sectorNames && window.sectorNames[sectorNum])
                         || (isFinite(sectorNum) ? `Sector ${sectorNum}` : '');
        ctx.fillText(`${sectorName} • Hex ${hexId}`, M + 5, 57);

        // Centre legend — the same colours the table's gutter and Band column use.
        ctx.textAlign = 'center';
        ctx.font = '700 11px ' + SANS;
        ctx.fillStyle = THEME.gold;
        let tx = W / 2 - 52;
        if (showMapTitle !== false)
            for (const ch of 'ORBITAL MAP') { ctx.fillText(ch, tx, 32); tx += ctx.measureText(ch).width + 3.2; }

        // THE LEGEND CARRIES ITS OWN RANGES. It used to name the six bands
        // while a whole separate Band Key panel repeated them with the Kelvin
        // figures attached - the same information twice, in a panel the size of
        // the one the satellites now occupy. One definition, stated once.
        const LEG_W = 130;
        const legendW = BAND_ORDER.length * LEG_W;
        let lx = W / 2 - legendW / 2 + 10;
        for (const band of (showLegend ? BAND_ORDER : [])) {
            ctx.fillStyle = BAND_COLOR[band];
            ctx.beginPath(); ctx.arc(lx - 9, 49, 3.4, 0, Math.PI * 2); ctx.fill();
            ctx.textAlign = 'left';
            ctx.font = '600 11px ' + SANS;
            ctx.fillStyle = THEME.dim;
            ctx.fillText(band, lx, 53);
            const nameW = ctx.measureText(band).width;
            ctx.font = '10px ' + SANS;
            ctx.fillStyle = THEME.faint;
            ctx.fillText(BAND_RANGE[band], lx + nameW + 6, 53);
            lx += LEG_W;
        }

        ctx.textAlign = 'right';
        ctx.font = '700 11px ' + SANS;
        ctx.fillStyle = THEME.ink;
        ctx.fillText('As Above, So Below — Survey Office', W - M - 4, 32);
        ctx.font = '11px ' + SANS;
        ctx.fillStyle = THEME.dim;
        ctx.fillText(`Satellite Survey: ASB-${hexId}`, W - M - 4, 48);
        ctx.fillText(_editionLabel(nsys.edition), W - M - 4, 62);
        ctx.textAlign = 'left';
    }

    function _editionLabel(ed) {
        return { MgT2E: 'Mongoose Traveller 2E', CT: 'Classic Traveller',
                 T5: 'Traveller 5', RTT: 'Revised Traveller', AoW: 'Architect of Worlds' }[ed] || String(ed || '');
    }

    function _starPanel(ctx, x, y, w, h, star, nsys, companions) {
        const comps = companions || [];
        const title = comps.length ? 'Stars' : 'Primary Star';
        const cy = panel(ctx, x, y, w, h, title);

        // With companions present the primary shrinks and moves up to make
        // room for them beneath it, so a binary reads as a binary at a glance
        // rather than as a single star with a footnote.
        const gx = x + 62;
        const gy = comps.length ? y + h / 2 - 8 : y + h / 2 + 8;
        drawStarGlow(ctx, gx, gy, comps.length ? 36 : 46, star.sType);

        if (comps.length) {
            const per = Math.min(comps.length, 4);
            const sw = 104 / Math.max(per, 1);
            comps.slice(0, 4).forEach((c, i) => {
                const ccx = x + 14 + sw * (i + 0.5);
                drawStarGlow(ctx, ccx, y + h - 42, Math.min(13, sw * 0.42), c.star.sType);
                ctx.font = '9px ' + SANS;
                ctx.fillStyle = THEME.dim;
                ctx.textAlign = 'center';
                ctx.fillText(truncate(ctx, starLabel(c.star), sw - 2), ccx, y + h - 20);
                ctx.fillStyle = THEME.faint;
                ctx.fillText(truncate(ctx, c.au != null ? num(c.au, 2) + ' AU'
                                                       : (c.star.separation || c.star.role || '\u2014'), sw - 2),
                             ccx, y + h - 9);
            });
            ctx.textAlign = 'left';
        }

        const tx = x + 130, tw = w - 130 - 18;
        let ry = cy + 8;
        const name = star.name || `${star.sType || '?'}${star.subType ?? ''} ${star.sClass || ''}`.trim();
        kvRow(ctx, tx, ry, tw, 'Type', name); ry += 24;
        // R4: a field the normaliser defaulted (`mass || 1`, `age || 0`) is
        // listed in `invented` and prints as a dash - the row stays, so the
        // reader sees the figure is unrecorded rather than assuming it absent.
        const inv = star.invented || [];
        const starVal = (key, v, unit) => inv.includes(key) ? '\u2014' : `${num(v)} ${unit}`;
        if (star.mass != null) { kvRow(ctx, tx, ry, tw, 'Mass', starVal('mass', star.mass, 'M☉')); ry += 24; }
        if (star.lum  != null) { kvRow(ctx, tx, ry, tw, 'Luminosity', starVal('lum', star.lum, 'L☉')); ry += 24; }
        if (star.diam != null) { kvRow(ctx, tx, ry, tw, 'Diameter', starVal('diam', star.diam, 'D☉')); ry += 24; }
        const ageInvented = star.age == null && (nsys.invented || []).includes('age');
        const age = star.age ?? nsys.age;
        if (age != null) { kvRow(ctx, tx, ry, tw, 'Age', ageInvented ? '\u2014' : `${num(age)} Gyr`); ry += 24; }
        if (comps.length) {
            const unplaced = comps.filter(c => c.au == null).length;
            kvRow(ctx, tx, ry, tw, 'Companions',
                  String(comps.length) + (unplaced ? ' (orbits not recorded)' : ''),
                  { valueFont: '600 ' + (unplaced ? 10 : 12) + 'px ' + SANS });
        }
    }

    // STARS ONLY: one statement in place of the strip and the brief. The
    // panels that would describe a mainworld are omitted, not drawn empty.
    function _noWorldsPanel(ctx, x, y, w, h, nsys) {
        panel(ctx, x, y, w, h, null, { border: THEME.gold });
        const n = (nsys.stars || []).length;
        ctx.textAlign = 'center';
        ctx.font = '700 20px ' + SANS;
        ctx.fillStyle = THEME.gold;
        ctx.fillText('No worlds in this system', x + w / 2, y + h / 2 - 6);
        ctx.font = '12px ' + SANS;
        ctx.fillStyle = THEME.dim;
        ctx.fillText(`${n === 1 ? 'A single star' : n + ' stars'} and no planets, belts or satellites were generated here.`,
                     x + w / 2, y + h / 2 + 20);
        ctx.textAlign = 'left';
    }

    // R5: System Data for a reported-but-not-charted hex. These counts come
    // straight from the save and are LABELLED AS REPORTED - the sheet cannot
    // place any of them, and must not read as though it had charted them.
    function _reportedPanel(ctx, x, y, w, h, rep) {
        const ry0 = panel(ctx, x, y, w, h, 'System Data — Reported');
        const v = n => (n == null ? '\u2014' : String(n));
        const rows = [
            ['Worlds',          v(rep.worlds)],
            ['Gas Giants',      v(rep.gasGiants)],
            ['Planetoid Belts', v(rep.belts)],
        ];
        rows.forEach(([k, val], i) => {
            kvRow(ctx, x + 16, ry0 + i * 21, w - 32, k, val,
                  { labelFont: '11px ' + SANS, valueFont: '600 11px ' + SANS });
        });
        ctx.font = 'italic 10px ' + SANS;
        ctx.fillStyle = THEME.faint;
        ctx.textAlign = 'left';
        ctx.fillText('Reported, not charted: no orbits are recorded for this system.',
                     x + 16, ry0 + rows.length * 21 + 4);
    }

    function _systemPanel(ctx, x, y, w, h, nsys, ordered, worlds, belts, ggs, mw, mwParent) {
        const ry0 = panel(ctx, x, y, w, h, 'System Data');
        const outer = ordered.length ? ordered[ordered.length - 1].au : null;
        const moonTotal = ordered.reduce((a, b) => a + liveMoons(b).length, 0);
        const rows = [
            // 'Catalogued Orbits' no longer fits a half-width column.
            ['Orbits',            String(ordered.length)],
            ['Worlds',            String(worlds.length)],
            ['Planetoid Belts',   String(belts.length)],
            ['Gas Giants',        String(ggs.length)],
            ['Satellites',        String(moonTotal)],
            // THE ORBIT IS THE PARENT'S. A lunar mainworld has no `au` of its
            // own - it has a planetary distance from the planet it circles.
            ['Mainworld Orbit',   (mwParent || mw) && (mwParent || mw).au != null
                                    ? `${num((mwParent || mw).au, 3)} AU` : '\u2014'],
            ['Outermost Orbit',   outer != null ? `${num(outer, 2)} AU` : '\u2014'],
        ];

        // TWO COLUMNS, BECAUSE ONE DROPPED A ROW. Adding "Satellites" pushed
        // this panel past its own height and "Outermost Orbit" simply stopped
        // being drawn - the identical silent-omission defect that the planetary
        // table was fixed for, reintroduced three functions away. A column
        // split absorbs the extra rows outright and leaves room for more.
        const PITCH = 21;
        const perCol = Math.ceil(rows.length / 2);
        const colW = (w - 32 - 18) / 2;
        rows.forEach(([k, v], i) => {
            const cx = x + 16 + (i < perCol ? 0 : colW + 18);
            const cy = ry0 + (i % perCol) * PITCH;
            kvRow(ctx, cx, cy, colW, k, v, { labelFont: '11px ' + SANS, valueFont: '600 11px ' + SANS });
        });
    }

    // ── The orbital strip ──────────────────────────────────────────────
    // ORDINAL spacing. The AU labels under each body carry the real distances;
    // the axis carries only their order.
    //
    // THIS WAS LAID OUT FOR EIGHT BODIES, WHICH IS THE MEDIAN — so it broke on
    // the whole top half of the distribution. At sixteen (Nidau, 18-P-2632) the
    // discs overlapped, every name truncated to "Nidau …" and the AU labels ran
    // together into one unreadable line. Three things fix it, and the first is
    // worth far more than the other two.

    // 1. DROP THE SYSTEM NAME FROM THE LABEL. "Nidau A-I" through "Nidau A-XVI"
    //    repeats the sheet's own title sixteen times and is the entire reason
    //    the names truncated. Stripping it takes a label from ~12 characters to
    //    3-5 and costs nothing: the title is two inches away.
    //    Never strip it to nothing — a mainworld is very often named exactly
    //    after its system, and "Makarov" must not become "".
    // R1 — THE SHEET'S TITLE. Only the MgT2E normaliser carries `name` through
    // (it Object.assigns the raw system); the other four return a fresh literal
    // without it, so `nsys.name` alone titled every CT/T5/RTT/AoW sheet from its
    // mainworld or "Unnamed System". Order is ruled (spec R1): normalised name,
    // hex name, raw system name, mainworld name, hexId. The raw systems are
    // checked in _detectSystem's priority order so the name comes from the
    // same system the sheet is drawing.
    function resolveSystemName(nsys, state, mw, hexId) {
        const s = state || {};
        const raw = [s.aowSystem, s.mgtSystem, s.ctSystem, s.t5System, s.rttSystem]
            .find(r => r && r.stars && r.stars.length > 0);
        const pick = [nsys && nsys.name, s.name, raw && raw.name, mw && mw.name, hexId]
            .map(v => (v == null ? '' : String(v).trim()))
            .find(v => v);
        return pick || String(hexId || '');
    }

    function stripSystemName(bodyName, sysName) {
        const b = String(bodyName || '').trim();
        const s = String(sysName || '').trim();
        if (!b || !s) return b;
        if (b.toLowerCase().startsWith(s.toLowerCase())) {
            const rest = b.slice(s.length).replace(/^[\s\-–—_.,]+/, '').trim();
            if (rest) return rest;
        }
        return b;
    }

    function _orbitStrip(ctx, x, y, w, h, items, hexId, scale, mw, mwParent, sysName) {
        // The strip holds bodies that orbit the STAR, so a lunar mainworld is
        // represented by ringing its PARENT. Interim: moons proper are their
        // own design job and will supersede this.
        const ringed = mwParent || mw;
        panel(ctx, x, y, w, h, null, { fill: '#05070b' });

        if (!items.length) {
            ctx.font = '13px ' + SANS; ctx.fillStyle = THEME.faint; ctx.textAlign = 'center';
            ctx.fillText('No catalogued bodies', x + w / 2, y + h / 2);
            ctx.textAlign = 'left';
            return;
        }

        const n = items.length;
        const pad = n > 12 ? 34 : 46;
        const usable = w - pad * 2;
        const step = n > 1 ? usable / (n - 1) : 0;
        const baseY = y + h * 0.52;

        // 2. SCALE EVERY DISC TO THE COLUMN. Natural sizes are computed first,
        //    then the whole set is scaled so the largest fits its column with a
        //    gap. Scaling the SET rather than each disc preserves the relative
        //    sizes, which is the only thing the sizes are there to convey.
        // A companion star is sized as a mid-range body: large enough to read
        // as a star beside a gas giant, not so large that it dominates the
        // strip it is only one member of.
        const natural = items.map(it => it.kind === 'star'
            ? 56 : discSize(it.b.diamKm, isGasGiant(it.b)));
        const largest = Math.max.apply(null, natural);
        const room = n > 1 ? step * 0.88 : usable * 0.5;
        const fit = largest > room ? room / largest : 1;
        let sizes = natural.map(s => Math.max(12, s * fit));
        // D2 (Sean, 2026-09-23): A LONE BODY IS THE HERO. One disc at its normal
        // 34-108 px sat adrift in a ~1000 px strip; drawn at twice that, capped
        // at 150 px (it clears the labels above and the AU label below), it
        // carries the strip. Still rendered and supersampled exactly as before.
        const HERO_MAX = 150;
        if (n === 1 && items[0].kind === 'body') sizes = [Math.min(HERO_MAX, natural[0] * 2)];

        // The axis, behind the bodies.
        ctx.strokeStyle = 'rgba(120,150,190,0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + pad - 18, baseY);
        ctx.lineTo(x + w - pad + 18, baseY);
        ctx.stroke();

        // 3. STAGGER THE AU LABELS when the columns are too narrow to hold one.
        //    Interleaving on two rows is what keeps them readable at sixteen
        //    bodies; at eight they stay on one line, as before.
        // R4: an ordinal-only strip (RTT - no recorded distances at all) draws
        // orbit numbers and NO distance labels, rather than a row of dashes.
        const anyAU = items.some(it => it.au != null);
        ctx.font = '11px ' + MONO;
        // CROWDED STRIPS LABEL WHAT FITS (Sean, 2026-09-23). At 32 bodies a
        // column is ~33 px and "0.0053 AU" is ~60: even staggered, the labels
        // ran into one unreadable line. The table carries every distance, so
        // the strip steps down only as far as it must:
        //   1. one row, "0.72 AU"          2. staggered, "0.72 AU"
        //   3. staggered, bare "0.72"      4. staggered, every other label
        // Strips up to ~16 bodies stay at 1 or 2, exactly as before.
        const auText = (au, unit) => au != null ? num(au, 3) + (unit ? ' AU' : '') : '\u2014';
        const widestOf = unit => items.reduce((a, it) =>
            Math.max(a, ctx.measureText(auText(it.au, unit)).width), 0);
        const wFull = widestOf(true), wBare = widestOf(false);
        const stagger = n > 1 && wFull > step - 6;
        const auUnit  = !stagger || wFull <= 2 * step - 6;
        const auThin  = stagger && !auUnit && wBare > 2 * step - 6;
        // Returns the label's y, or null when this column carries no label.
        const auLabelY = i => {
            if (auThin && i % 2) return null;
            const k = auThin ? i / 2 : i;
            return y + h - 26 - (stagger && (k % 2) ? 15 : 0);
        };

        // NAMES THAT DO NOT FIT ARE OMITTED, NOT TRUNCATED: "Ma..." and "B-..."
        // told the reader nothing the table does not. The MAINWORLD's label is
        // always drawn in full, and neighbouring names are cleared to make room.
        const colWAll = n > 1 ? Math.max(26, step - 4) : Math.min(260, usable);
        const mwIdx = items.findIndex(it => it.kind === 'body' && ringed && it.b === ringed);
        let mwClear = 0;
        if (mwIdx >= 0 && n > 1) {
            const rb = items[mwIdx].b;
            let ml = stripSystemName(rb.name, sysName);
            if (ml === rb.name && String(rb.name || '').trim().toLowerCase()
                               === String(sysName || '').trim().toLowerCase()) ml = 'Mainworld';
            ctx.font = '600 ' + (n > 12 ? 10 : 11) + 'px ' + SANS;
            const mlW = ctx.measureText(ml || 'Mainworld').width;
            if (mlW > colWAll) mwClear = Math.ceil((mlW - colWAll) / 2 / step);
            ctx.font = '11px ' + MONO;
        }
        const nameCleared = i => mwIdx >= 0 && i !== mwIdx && Math.abs(i - mwIdx) <= mwClear;
        // 6 px of air, or adjacent names run together ("B-XIIIA-VIII").
        const fitsOrNull = (text, maxW) => (ctx.measureText(text).width <= maxW - 6 ? text : null);

        // ORBIT NUMBERS BELONG TO BODIES ONLY. A companion star must never
        // consume an index, or the strip and the planetary table stop agreeing
        // about which world is orbit 7.
        let orbitNo = -1;

        items.forEach((it, i) => {
            const cx = n > 1 ? x + pad + step * i : x + w / 2;
            const size = sizes[i];
            // A SINGLE-BODY SYSTEM HAS NO STEP. `step` is 0 when n === 1, so a
            // label width of `step - 4` clamped to the 26 px floor, and the one
            // world on the sheet was labelled "M..." for "Mainworld". A lone
            // body gets the whole panel to name itself in.
            const colW = n > 1 ? Math.max(26, step - 4) : Math.min(260, usable);
            ctx.textAlign = 'center';

            // ── A companion star ───────────────────────────────────────
            if (it.kind === 'star') {
                const s = it.s;
                ctx.font = '700 ' + (n > 12 ? 11 : 12) + 'px ' + SANS;
                ctx.fillStyle = THEME.gold;
                ctx.fillText('\u2736', cx, y + 58);
                ctx.font = '600 ' + (n > 12 ? 10 : 11) + 'px ' + SANS;
                ctx.fillStyle = THEME.gold;
                const sl = nameCleared(i) ? null : fitsOrNull(starLabel(s), colW);
                if (sl) ctx.fillText(sl, cx, y + 76);
                if (s.role) {
                    ctx.font = (n > 12 ? 9 : 10) + 'px ' + SANS;
                    ctx.fillStyle = THEME.faint;
                    const rl = nameCleared(i) ? null : fitsOrNull(s.role, colW);
                    if (rl) ctx.fillText(rl, cx, y + 90);
                }
                drawStarGlow(ctx, cx, baseY, size / 2, s.sType);
                ctx.font = '11px ' + MONO;
                ctx.fillStyle = THEME.faint;
                const sy = auLabelY(i);
                if (anyAU && sy != null) ctx.fillText(auText(it.au, auUnit), cx, sy);
                return;
            }

            const b = it.b;
            orbitNo++;
            const belt = isBelt(b);
            const gg = isGasGiant(b);
            const isMW = ringed && b === ringed;

            // Index
            ctx.font = '700 ' + (n > 12 ? 12 : 14) + 'px ' + SANS;
            ctx.fillStyle = THEME.ink;
            ctx.fillText(String(orbitNo), cx, y + 58);

            // Name, with the system prefix removed.
            ctx.font = (isMW ? '600 ' : '') + (n > 12 ? 10 : 11) + 'px ' + SANS;
            ctx.fillStyle = isMW ? THEME.green : THEME.dim;
            // A mainworld is very often named EXACTLY after its system, so
            // stripping the prefix leaves nothing and the guard falls back to
            // the full name -- which then truncates to "Royal Leami...". The
            // sheet's title is two inches away and already says it, so name it
            // for what it is instead.
            let label = stripSystemName(b.name, sysName);
            if (label === b.name && isMW && String(b.name || '').trim().toLowerCase()
                                          === String(sysName || '').trim().toLowerCase()) {
                label = 'Mainworld';
            }
            label = label || (belt ? 'Belt' : gg ? 'GG' : 'Body');
            if (isMW) ctx.fillText(label, cx, y + 76);           // always, in full
            else if (!nameCleared(i)) {
                const fl = fitsOrNull(label, colW);
                if (fl) ctx.fillText(fl, cx, y + 76);
            }

            // Name the lunar mainworld under its parent, so the ring is never
            // silently pointing at a world that is not itself the mainworld.
            if (isMW && mwParent && mw) {
                ctx.font = '600 ' + (n > 12 ? 9 : 10) + 'px ' + SANS;
                ctx.fillStyle = THEME.green;
                ctx.fillText('\u233e ' + stripSystemName(mw.name, sysName), cx, y + 90);
            }

            if (belt) {
                drawBelt(ctx, cx, baseY, Math.max(size, 40), hexId + '|' + (b.name || orbitNo));
            } else {
                // A SEAT UNDER EVERY DISC. An airless rock is genuinely very
                // dark, and against a near-black panel its limb disappears —
                // magnified, Alayor's 1,600 km mainworld was a perfectly good
                // cratered world that read as an empty ring on the sheet. This
                // is a faint lift, not a glow: enough to separate a dark limb
                // from the background without lighting it from behind.
                const seat = ctx.createRadialGradient(cx, baseY, size * 0.40, cx, baseY, size * 0.78);
                seat.addColorStop(0, 'rgba(120,150,190,0.13)');
                seat.addColorStop(1, 'rgba(120,150,190,0)');
                ctx.fillStyle = seat;
                ctx.beginPath(); ctx.arc(cx, baseY, size * 0.78, 0, Math.PI * 2); ctx.fill();

                // The mainworld ring is drawn UNDER the disc so it reads as a
                // halo rather than a hoop across the body's face, and its
                // offset scales with the body so it hugs a small world as
                // closely as a large one.
                if (isMW) {
                    const rr = size / 2 + Math.max(4, size * 0.085);
                    ctx.strokeStyle = 'rgba(76,175,110,0.16)';
                    ctx.lineWidth = 3.5;
                    ctx.beginPath(); ctx.arc(cx, baseY, rr, 0, Math.PI * 2); ctx.stroke();
                    ctx.strokeStyle = THEME.green;
                    ctx.lineWidth = 1.3;
                    ctx.beginPath(); ctx.arc(cx, baseY, rr, 0, Math.PI * 2); ctx.stroke();
                }

                if (gg) drawGasGiant(ctx, cx, baseY, size,
                                     PlanetRenderer.imageSeed(hexId, b, 'w' + orbitNo));
                else    drawDisc(ctx, b, hexId, cx, baseY, size, scale, 'w' + orbitNo);
            }

            // Moon count under the disc. The strip cannot show sixty moons and
            // must not pretend they are not there, so it shows how many.
            const nMoons = liveMoons(b).length;
            if (nMoons) {
                // DRAWN, NOT TYPESET. U+263E (the crescent) is absent from the
                // sheet's font stack and rendered as a euro sign - "\u20ac 8"
                // under every moon-bearing world. A two-arc crescent always
                // draws, in any environment, which is the same reason the rest
                // of this sheet avoids symbol glyphs.
                const gy = baseY + size / 2 + 15;
                ctx.font = (n > 12 ? 9 : 10) + 'px ' + SANS;
                ctx.textAlign = 'left';
                const label = String(nMoons);
                const tw = ctx.measureText(label).width;
                const gx = cx - (tw + 11) / 2;
                ctx.fillStyle = THEME.faint;
                ctx.beginPath();
                ctx.arc(gx + 4, gy - 3, 3.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#05070b';
                ctx.beginPath();
                ctx.arc(gx + 6.2, gy - 4.2, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = THEME.faint;
                ctx.fillText(label, gx + 11, gy);
                ctx.textAlign = 'center';
            }

            // AU label
            ctx.font = '11px ' + MONO;
            ctx.fillStyle = THEME.faint;
            ctx.textAlign = 'center';
            const auY = auLabelY(i);
            if (anyAU && auY != null) ctx.fillText(auText(b.au, auUnit), cx, auY);
        });
        ctx.textAlign = 'left';
    }

    // ── The mainworld brief ─────────────────────────────────────────────────
    // The reference sheet fills this space with hand-written lore we cannot
    // generate. Instead it carries derived sentences — each one a fact already
    // on the sheet, stated in words rather than as a number in a column, which
    // is what makes it read as a briefing rather than a second table.
    function _mainworldBrief(ctx, x, y, w, h, mw, ordered, nsys, mwParent, opt) {
        const reduced = !!(opt && opt.reduced);
        panel(ctx, x, y, w, h, null, { border: THEME.gold });
        if (!mw) {
            ctx.font = '13px ' + SANS; ctx.fillStyle = THEME.faint; ctx.textAlign = 'center';
            ctx.fillText('No mainworld recorded', x + w / 2, y + h / 2);
            ctx.textAlign = 'left';
            return;
        }
        ctx.font = '700 22px ' + SANS;
        ctx.fillStyle = THEME.gold;
        ctx.textAlign = 'left';
        ctx.fillText(truncate(ctx, mw.name || 'Mainworld', w - 150), x + 18, y + 38);

        ctx.font = '13px ' + MONO;
        ctx.fillStyle = THEME.ink;
        ctx.textAlign = 'right';
        ctx.fillText(mw.uwp || '—', x + w - 18, y + 38);

        ctx.strokeStyle = THEME.rule;
        ctx.beginPath(); ctx.moveTo(x + 18, y + 52); ctx.lineTo(x + w - 18, y + 52); ctx.stroke();

        ctx.font = '11px ' + SANS;
        ctx.fillStyle = THEME.dim;
        ctx.textAlign = 'left';
        ctx.fillText('Trade Codes', x + 18, y + 70);
        ctx.fillStyle = THEME.ink;
        ctx.font = '600 11px ' + SANS;
        // Sized to the panel, not a fixed 120 px: the reduced sheet's brief is
        // three times as wide and was still cutting Regina's codes at "(Ami...".
        ctx.fillText(truncate(ctx, (mw.tradeCodes || []).join(' ') || '—', w - 92 - 150), x + 92, y + 70);

        const band = bandOf(mw);
        // "ZONE" IS THE TRAVEL ZONE (Sean, 2026-09-23). It used to print the
        // temperature band under this label - which the temperature line below
        // already states - and a Red Zone world carried no warning at all.
        const tz = travelZoneOf(mw);
        ctx.textAlign = 'right';
        ctx.fillStyle = THEME.dim;
        ctx.font = '11px ' + SANS;
        ctx.fillText('Zone', x + w - 88, y + 70);
        ctx.fillStyle = TZ_COLOR[tz] || THEME.ink;
        ctx.font = '600 11px ' + SANS;
        ctx.fillText(tz || '—', x + w - 18, y + 70);
        ctx.textAlign = 'left';

        const idx = ordered.indexOf(mwParent || mw);
        // COUNT MOONS TOO. With the mainworld itself often a moon, counting
        // only top-level bodies produced "Orbit 12 of 16 - 0 of 16 bodies are
        // populated" on a sheet whose whole subject is a populated mainworld.
        const isPop = b => { const d = b && b.uwp && b.uwp[4]; return !!d && d !== '0'; };
        let populated = 0, totalBodies = 0;
        for (const b of ordered) {
            totalBodies++;
            if (isPop(b)) populated++;
            for (const m of (b.moons || [])) {
                if (!m || m.type === 'Empty') continue;
                totalBodies++;
                if (isPop(m)) populated++;
            }
        }

        const lines = [];
        if (mw.starport) lines.push(`Starport ${mw.starport}`);
        if (mw.meanTempK != null) lines.push(`Mean surface temperature ${intStr(mw.meanTempK)} K (${band || '—'})`);
        if (mw.gravity != null && mw.diamKm != null)
            lines.push(`Surface gravity ${num(mw.gravity)} G on a ${intStr(mw.diamKm)} km world`);
        // Orbit facts come from the PARENT for a lunar mainworld; the physical
        // facts above come from the body itself.
        const orb = mwParent || mw;
        if (mwParent) {
            lines.push(`A moon of ${mwParent.name || 'its primary'}`
                + (mw.pd != null ? `, ${num(mw.pd, 1)} planetary diameters out` : ''));
        }
        if (orb.au != null && orb.periodYears != null)
            lines.push(`${mwParent ? 'That world orbits' : 'Orbits'} at ${num(orb.au, 2)} AU`
                + ` — a ${num(orb.periodYears)} year circuit`);
        if (mw.composition) {
            const hyd = mw.uwp && mw.uwp[3];
            lines.push(`${mw.composition} body${hyd != null ? `; hydrographics ${hyd}` : ''}`);
        }
        // R5: T5 socioeconomics - the extensions exactly as the save strings them.
        const so = opt && opt.socio;
        if (so && (so.ixString || so.exString || so.cxString || so.RU != null))
            lines.push([so.ixString && `Importance ${so.ixString}`,
                        so.exString && `Economic ${so.exString}`,
                        so.cxString && `Cultural ${so.cxString}`,
                        (so.RU ?? so.resourceUnits) != null && `RU ${so.RU ?? so.resourceUnits}`]
                       .filter(Boolean).join(' · '));
        // A reduced sheet has ONE row by construction: "Orbit 0 of 1 - the only
        // populated body" would be an invented fact about an uncharted system.
        if (idx >= 0 && !reduced) {
            lines.push(`Orbit ${idx} of ${ordered.length}` +
                (populated === 1 ? ' — the only populated body in the system'
                                 : ` — ${populated} of ${totalBodies} bodies are populated`));
        }
        if (mw.liquidType && mw.liquidType !== 'None') lines.push(`Surface liquid: ${mw.liquidType}`);

        let ly = y + 98, shownLines = 0;
        const tw = w - 54;
        for (const line of lines) {
            ctx.font = '12px ' + SANS;
            const parts = wrap(ctx, line, tw);
            ctx.fillStyle = THEME.gold;
            ctx.fillText('✦', x + 18, ly);
            ctx.fillStyle = THEME.ink;
            for (const p of parts) { ctx.fillText(p, x + 38, ly); ly += 17; }
            ly += 9;
            shownLines++;
            if (ly > y + h - 14) break;
        }
        // THE FOURTH SILENT DROP IN THIS FILE. Same rule as the planetary
        // table, System Data and Mainworld Data: a row loop may not stop
        // without saying that it did.
        if (shownLines < lines.length) {
            ctx.font = 'italic 10px ' + SANS;
            ctx.fillStyle = '#e05545';
            ctx.textAlign = 'left';
            ctx.fillText((lines.length - shownLines) + ' more not shown', x + 18, y + h - 8);
        }
    }

    // ── The planetary table ─────────────────────────────────────────────────
    const COLS = [
        // `fixed` columns keep their declared width and are never stretched or
        // squeezed: in R6's half-width blocks a scaled '#' column truncated
        // every two-digit row number to "..". `short` is the header used when
        // the full label will not fit its column.
        { key: 'band',  label: '',              w: 16,  align: 'center', fixed: true },
        { key: 'idx',   label: '#',             w: 26,  align: 'right',  fixed: true },
        { key: 'name',  label: 'Name',          w: 180, align: 'left'   },
        { key: 'au',    label: 'Distance (AU)', w: 108, align: 'right', short: 'AU' },
        { key: 'uwp',   label: 'UWP',           w: 116, align: 'left', mono: true },
        { key: 'comp',  label: 'Composition',   w: 150, align: 'left',  short: 'Comp.' },
        { key: 'diam',  label: 'Diameter (km)', w: 122, align: 'right', short: 'km' },
        { key: 'grav',  label: 'Gravity (G)',   w: 96,  align: 'right', short: 'G' },
        { key: 'temp',  label: 'Mean Temp (K)', w: 116, align: 'right', short: 'K' },
        { key: 'year',  label: 'Year (yr)',     w: 92,  align: 'right', short: 'Yr' },
        // EVERY MOON IS ACCOUNTED FOR even though almost none get a row of
        // their own - this column is where the other sixty go. See _satellites
        // for why full enumeration is impossible.
        { key: 'moons', label: 'Moons',         w: 62,  align: 'right', short: '☾' },
        // `inset`: a left-aligned column right after a right-aligned one
        // needs air, or "Moons" and "Band" read as one word.
        { key: 'zone',  label: 'Band',          w: 84,  align: 'left', inset: 12 },
    ];

    // R2 - DROP EMPTY COLUMNS, REFLOW THE REST (ruled 2026-09-23).
    // Every row's cells are built FIRST, then a column is kept only if some
    // row on THIS sheet has a value in it. Columns of dashes said "this engine
    // does not record it" in the most expensive way the sheet has; the
    // accepted cost is that column positions now differ between engines.
    // Composition is decided by the FIELD, not the cell: a belt's "Belt" is a
    // fallback label, and it alone must not keep a CT column of dashes alive.
    // `idx` and `name` are always kept. The width freed by a dropped column
    // is reclaimed by the stretch in _planetTable, so names truncate less.
    function tableLayout(ordered, mw) {
        const rows = ordered.map((b, i) => {
            const band = bandOf(b);
            const isMW = !!(mw && b === mw);
            const cells = {
                idx:  String(i),
                name: (isMW ? '★ ' : '') + (b.name || (isBelt(b) ? 'Belt' : 'Body')),
                au:   b.au != null ? num(b.au, 3) : '—',
                uwp:  b.uwp || '—',
                comp: b.composition || (isBelt(b) ? 'Belt' : '—'),
                diam: isBelt(b) ? '—' : intStr(b.diamKm),
                grav: isBelt(b) ? '—' : num(b.gravity),
                temp: b.meanTempK != null ? intStr(b.meanTempK) : '—',
                year: b.periodYears != null ? num(b.periodYears) : '—',
                moons: liveMoons(b).length ? String(liveMoons(b).length) : '—',
                zone: band || '—',
            };
            return { b, band, isMW, cells };
        });
        const ALWAYS = { idx: 1, name: 1 };
        const cols = COLS.filter(c => {
            if (ALWAYS[c.key]) return true;
            if (c.key === 'band') return rows.some(r => r.band);
            if (c.key === 'comp') return rows.some(r => r.b.composition);
            return rows.some(r => r.cells[c.key] && r.cells[c.key] !== '—');
        });
        return { cols, rows };
    }

    function _planetTable(ctx, x, y, w, h, ordered, mw, rowHIn, splitCols) {
        panel(ctx, x, y, w, h, null);

        ctx.textAlign = 'center';
        ctx.font = '700 11px ' + SANS;
        ctx.fillStyle = THEME.gold;
        let tx0 = x + w / 2 - 54;
        for (const ch of 'PLANETARY DATA') { ctx.fillText(ch, tx0, y + 26); tx0 += ctx.measureText(ch).width + 3; }
        ctx.textAlign = 'left';

        const layout = tableLayout(ordered, mw);

        // R6 - TWO COLUMNS WHEN ONE WILL NOT HOLD THE LIST (ruled 2026-09-23).
        // At the 16 px floor one column holds ~20 rows; AoW reaches 32. The
        // rows are dealt top-to-bottom into `nCols` side-by-side blocks that
        // share one pitch - the same answer System Data got for the same
        // defect. Row numbers come from the whole list, so they still match
        // the strip. Accepted cost: narrower columns, more truncation.
        const nCols = Math.max(1, splitCols || 1);
        // TWO COLUMNS DROP THE BAND TEXT (Sean, 2026-09-23). In a half-width
        // block it truncated to "Froz..." while the gutter dot beside it
        // already said the same thing in colour - as the Satellites panel
        // does. Its width goes to Composition, which was cutting AoW classes
        // to "Class 4 (E...", losing the part that tells them apart.
        if (nCols > 1 && layout.cols.some(c => c.key === 'zone')) {
            const zw = layout.cols.find(c => c.key === 'zone').w;
            layout.cols = layout.cols.filter(c => c.key !== 'zone')
                .map(c => c.key === 'comp' ? Object.assign({}, c, { w: c.w + zw }) : c);
        }
        const GAP = 28;
        const blockW = (w - 36 - GAP * (nCols - 1)) / nCols;
        const perCol = Math.ceil(layout.rows.length / nCols);

        // Columns are laid out from their declared widths and then STRETCHED to
        // fill the block, so the table always spans its box whatever the sheet
        // width is — rather than leaving a ragged gap on the right.
        const fixedW = layout.cols.filter(c => c.fixed).reduce((a, c) => a + c.w, 0);
        const flexW  = layout.cols.filter(c => !c.fixed).reduce((a, c) => a + c.w, 0);
        const k = Math.max(0, blockW - fixedW) / flexW;
        const geomAt = bx => {
            let cx = bx;
            return layout.cols.map(c => {
                const cw = c.fixed ? c.w : c.w * k;
                const g = { c, x: cx, w: cw }; cx += cw; return g;
            });
        };

        const headY = y + 58;
        const rowH = rowHIn || 29;
        const firstRowY = headY + 30;
        // How many rows fit in one block. Normally all of them - the pitch is
        // derived from the count - but if not, ONE SLOT IS GIVEN UP to the
        // warning line. It used to be drawn on top of the last row that did
        // fit (Duiven B-XIII, AoW 18-D-3005), hiding the row it warned about.
        let fit = Math.floor((y + h - 12 - firstRowY) / rowH) + 1;
        const overflow = perCol > fit;
        if (overflow) fit = Math.max(0, fit - 1);

        let dropped = 0;
        for (let ci = 0; ci < nCols; ci++) {
            const bx = x + 18 + ci * (blockW + GAP);
            const geom = geomAt(bx);
            ctx.font = '600 11px ' + SANS;
            ctx.fillStyle = THEME.dim;
            for (const g of geom) {
                if (!g.c.label) continue;
                ctx.textAlign = g.c.align === 'right' ? 'right' : (g.c.align === 'center' ? 'center' : 'left');
                const px = g.c.align === 'right' ? g.x + g.w - 6 : (g.c.align === 'center' ? g.x + g.w / 2 : g.x + (g.c.inset || 0));
                const lab = (g.c.short && ctx.measureText(g.c.label).width > g.w - 6) ? g.c.short : g.c.label;
                ctx.fillText(truncate(ctx, lab, g.w - 6), px, headY);
            }
            ctx.strokeStyle = THEME.rule;
            ctx.beginPath(); ctx.moveTo(bx, headY + 9); ctx.lineTo(bx + blockW, headY + 9); ctx.stroke();

            const slice = layout.rows.slice(ci * perCol, (ci + 1) * perCol);
            let rowY = firstRowY;
            slice.forEach(({ band, isMW, cells }, ri) => {
                // Never silent: anything past `fit` is counted and announced.
                if (ri >= fit) { dropped++; return; }

                if (isMW) {
                    ctx.fillStyle = 'rgba(76,175,110,0.10)';
                    ctx.fillRect(bx - 6, rowY - Math.min(19, rowH - 3), blockW + 12, rowH - 4);
                }

                for (const g of geom) {
                    const key = g.c.key;
                    if (key === 'band') {
                        if (band) {
                            ctx.fillStyle = BAND_COLOR[band];
                            ctx.beginPath(); ctx.arc(g.x + g.w / 2, rowY - 4, 3.6, 0, Math.PI * 2); ctx.fill();
                        }
                        continue;
                    }
                    const fs = rowH >= 24 ? 12 : rowH >= 19 ? 11 : 10;
                    ctx.font = (g.c.mono ? (fs - 1) + 'px ' + MONO
                                         : (isMW ? '600 ' : '') + fs + 'px ' + SANS);
                    ctx.fillStyle = key === 'zone' && band ? BAND_COLOR[band]
                                  : isMW ? THEME.ink : (key === 'name' ? THEME.ink : THEME.dim);
                    ctx.textAlign = g.c.align === 'right' ? 'right' : 'left';
                    const px = g.c.align === 'right' ? g.x + g.w - 6 : g.x + (g.c.inset || 0);
                    ctx.fillText(truncate(ctx, cells[key], g.w - 8), px, rowY);
                }
                rowY += rowH;
            });
        }
        if (dropped > 0) {
            ctx.font = '600 12px ' + SANS;
            ctx.fillStyle = '#e05545';
            ctx.textAlign = 'left';
            ctx.fillText('⚠ ' + dropped + ' further '
                + (dropped === 1 ? 'body' : 'bodies')
                + ' not shown - this sheet is incomplete', x + 18,
                firstRowY + fit * rowH);
        }
        ctx.textAlign = 'left';
    }

    function _mainworldData(ctx, x, y, w, h, mw, mwParent, reduced) {
        const title = mw ? `${mw.name || 'Mainworld'} — Mainworld Data` : 'Mainworld Data';
        let ry = panel(ctx, x, y, w, h, title);
        if (!mw) return;
        const tx = x + 18, tw = w - 36;
        // ORBITAL FACTS BELONG TO THE PARENT when the mainworld is a moon.
        // Reading them off the moon gave "Orbital Distance 0.005 AU" and
        // "Year Length 0 standard years" - the moon's circuit of its own
        // planet, rounded away, presented as its orbit of the star.
        const orb = mwParent || mw;
        const rows = [
            ['UWP',              mw.uwp || '—'],
            ['Composition',      mw.composition || '—'],
            ['Diameter',         mw.diamKm != null ? `${intStr(mw.diamKm)} km` : '—'],
            ['Surface Gravity',  mw.gravity != null ? `${num(mw.gravity)} G` : '—'],
            ['Mean Temperature', mw.meanTempK != null ? `${intStr(mw.meanTempK)} K` : '—'],
        ];
        if (mwParent) {
            rows.push(['Orbits', mwParent.name || 'its primary']);
            if (mw.pd != null) rows.push(['Distance from Primary', `${num(mw.pd, 1)} planetary diameters`]);
        }
        rows.push(
            [mwParent ? 'Primary’s Orbital Distance' : 'Orbital Distance',
                orb.au != null ? `${num(orb.au, 3)} AU` : '—'],
            [mwParent ? 'Primary’s Year Length' : 'Year Length',
                orb.periodYears != null ? `${num(orb.periodYears)} standard years` : '—'],
            ['Trade Codes',      (mw.tradeCodes || []).join(' ') || '—'],
        );
        // Liquid ONLY WHEN RECORDED (Sean, 2026-09-23). This row read
        // `liquidType || 'None'`, which told every CT/T5/RTT/AoW sheet its
        // world was dry - T5 hydrographics 7 included. Only MgT2E records it.
        if (mw.liquidType != null && mw.liquidType !== '')
            rows.splice(rows.length - 1, 0, ['Liquid', mw.liquidType]);
        // R5: the reduced sheet carries the travel zone (Green 332 / Amber 88 /
        // Red 19 on Spinward). Only there: several normalisers default a
        // missing zone to 'G', which a full sheet would then print as fact.
        if (reduced) rows.splice(1, 0, ['Travel Zone', travelZoneOf(mw) || '—']);
        // NO DASH ROWS (Sean, 2026-09-23) - R2's rule for table columns and the
        // Liquid ruling, applied to this panel: a field this engine does not
        // record gets no row. UWP and Trade Codes are the core of a mainworld
        // reference and always stay, so their absence is itself stated.
        const ALWAYS = { 'UWP': 1, 'Trade Codes': 1 };
        for (let i = rows.length - 1; i >= 0; i--)
            if (!ALWAYS[rows[i][0]] && (rows[i][1] == null || rows[i][1] === '—')) rows.splice(i, 1);
        // DERIVE THE PITCH — THE THIRD PANEL ON THIS SHEET TO NEED IT.
        // At a fixed 24 px this panel held nine rows, and a LUNAR mainworld has
        // eleven: "Liquid" and "Trade Codes" were simply never drawn, with no
        // indication they existed. The planetary table had the identical defect
        // (announced, then fixed), and so did System Data the moment a
        // "Satellites" row was added to it. **Any panel here that lays out a
        // variable number of rows must size its pitch from the count, never
        // assume the count fits.**
        const avail = (y + h - 10) - ry;
        const pitch = Math.max(16, Math.min(24, Math.floor(avail / Math.max(1, rows.length))));
        let shown = 0;
        for (const [k, v] of rows) {
            if (ry > y + h - 10) break;
            leaderRow(ctx, tx, ry, tw, k, v,
                      { labelFont: (pitch >= 20 ? 12 : 11) + 'px ' + SANS,
                        valueFont: '600 ' + (pitch >= 20 ? 12 : 11) + 'px ' + SANS });
            ry += pitch;
            shown++;
        }
        if (shown < rows.length) {
            ctx.font = 'italic 10px ' + SANS;
            ctx.fillStyle = '#e05545';
            ctx.textAlign = 'left';
            ctx.fillText((rows.length - shown) + ' more not shown', tx, y + h - 6);
        }
    }

    // ── Satellites ─────────────────────────────────────────────────────
    //
    // FULL ENUMERATION IS ARITHMETICALLY IMPOSSIBLE and it is worth writing the
    // numbers down so nobody tries. Measured over solo_6 on 2026-09-21: moons
    // per system run to a MEDIAN OF 19, p95 of 40 and a maximum of 64; listing
    // every one needs a median of 27 rows and up to 76. The table holds 21 at
    // its tightest pitch, so the MEDIAN system already overflows.
    //
    // So the question is never "how do we fit the moons" - it is "which moons
    // earn a row", and everything else is a COUNT, shown on its parent's row in
    // the table and under its parent's disc on the strip. Nothing is hidden;
    // only the detail is rationed.
    //
    // "Populated" was the obvious filter and it does not work: MgT2E populates
    // moons freely, and Starrfield reports 33 of 67 bodies populated. The
    // filter that does work is PROXIMITY TO THE MAINWORLD - the moons a referee
    // actually reaches for. If the mainworld is itself a moon, that is its
    // siblings; if it is a planet, its own moons; and failing both, the richest
    // satellite system in the system, which is the next most interesting thing
    // on the sheet.
    function _satellites(ctx, x, y, w, h, mw, mwParent, ordered, sysName, reduced) {
        let group = [], title = 'Satellites', host = null;
        if (mwParent) {
            host = mwParent; group = liveMoons(mwParent);
            title = 'Satellites of ' + stripSystemName(mwParent.name, sysName);
        } else if (mw && liveMoons(mw).length) {
            host = mw; group = liveMoons(mw);
            title = 'Mainworld Satellites';
        } else {
            let best = null;
            for (const b of ordered) {
                if (!best || liveMoons(b).length > liveMoons(best).length) best = b;
            }
            if (best && liveMoons(best).length) {
                host = best; group = liveMoons(best);
                title = 'Satellites of ' + stripSystemName(best.name, sysName);
            }
        }

        let ry = panel(ctx, x, y, w, h, title);
        if (!group.length) {
            ctx.font = '12px ' + SANS; ctx.fillStyle = THEME.faint; ctx.textAlign = 'center';
            // Uncharted is not the same as none.
            ctx.fillText(reduced ? 'Satellites not charted' : 'No satellites recorded', x + w / 2, y + h / 2 + 8);
            ctx.textAlign = 'left';
            return;
        }

        // Largest first - a referee scanning this wants the substantial ones.
        const sorted = group.slice().sort((a, b) => (b.diamKm || 0) - (a.diamKm || 0));
        const ROW = 18;
        const capacity = Math.max(1, Math.floor((y + h - 10 - ry) / ROW));
        const showing = sorted.slice(0, sorted.length > capacity ? capacity - 1 : capacity);

        const cName = x + 30, cUwp = x + w - 150, cDiam = x + w - 18;
        ctx.font = '600 10px ' + SANS;
        ctx.fillStyle = THEME.faint;
        ctx.textAlign = 'left';  ctx.fillText('NAME', cName, ry - 4);
        ctx.fillText('UWP', cUwp, ry - 4);
        ctx.textAlign = 'right'; ctx.fillText('DIAM (KM)', cDiam, ry - 4);
        ctx.textAlign = 'left';
        ry += 8;

        for (const m of showing) {
            const band = bandOf(m);
            const isMW = isMainworld(m);
            if (band) {
                ctx.fillStyle = BAND_COLOR[band];
                ctx.beginPath(); ctx.arc(x + 18, ry - 4, 3.4, 0, Math.PI * 2); ctx.fill();
            }
            ctx.font = (isMW ? '600 ' : '') + '11px ' + SANS;
            ctx.fillStyle = isMW ? THEME.green : THEME.ink;
            ctx.textAlign = 'left';
            ctx.fillText(truncate(ctx, (isMW ? '★ ' : '') + stripSystemName(m.name, sysName)
                                      || 'Satellite', cUwp - cName - 8), cName, ry);
            ctx.font = '10px ' + MONO;
            ctx.fillStyle = THEME.dim;
            ctx.fillText(truncate(ctx, m.uwp || '—', 110), cUwp, ry);
            ctx.font = '11px ' + SANS;
            ctx.textAlign = 'right';
            ctx.fillText(m.diamKm != null ? intStr(m.diamKm) : '—', cDiam, ry);
            ctx.textAlign = 'left';
            ry += ROW;
        }

        // NEVER a silent omission - the same rule the planetary table follows.
        if (sorted.length > showing.length) {
            ctx.font = 'italic 11px ' + SANS;
            ctx.fillStyle = THEME.faint;
            ctx.fillText((sorted.length - showing.length) + ' further satellite'
                + (sorted.length - showing.length === 1 ? '' : 's')
                + ' not listed — ' + sorted.length + ' in total', cName, ry);
        }
    }

    function _bandKeyUNUSED(ctx, x, y, w, h) {
        let ry = panel(ctx, x, y, w, h, 'Temperature Band Key');
        const colW = (w - 36) / 2;
        BAND_ORDER.forEach((band, i) => {
            const cx = x + 18 + (i % 2) * colW;
            const cy = ry + Math.floor(i / 2) * 25;
            if (cy > y + h - 8) return;
            ctx.fillStyle = BAND_COLOR[band];
            ctx.beginPath(); ctx.arc(cx + 4, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
            ctx.font = '600 12px ' + SANS;
            ctx.fillStyle = THEME.ink;
            ctx.textAlign = 'left';
            ctx.fillText(band, cx + 16, cy);
            // Measure the name at the font it was DRAWN in. Measuring after the
            // switch to 11px under-reads it and the range text laps the name.
            const nameW = ctx.measureText(band).width;
            ctx.font = '11px ' + SANS;
            ctx.fillStyle = THEME.faint;
            ctx.fillText(`(${BAND_RANGE[band]})`, cx + 16 + nameW + 8, cy);
        });
    }

    function _footer(ctx, nsys, reduced, starsOnly, pageH) {
        const fy = (pageH || H) - 16;
        ctx.font = '10px ' + SANS;
        ctx.fillStyle = THEME.faint;
        ctx.textAlign = 'left';
        // R4: RTT records no distances, so the footer must not promise them.
        const noAU = (nsys.invented || []).includes('au');
        ctx.fillText(starsOnly ? 'Star system with no worlds'
                   : reduced ? 'Reported system · orbits not charted'
                   : noAU ? 'Orbit spacing is ordinal · orbital distances not recorded by this edition'
                          : 'Orbit spacing is ordinal, not to scale · distances in AU', M + 4, fy);
        ctx.textAlign = 'right';
        ctx.fillText('Charted with As Above, So Below', W - M - 4, fy);
        ctx.textAlign = 'left';
    }

    // ── Download ────────────────────────────────────────────────────────────
    // Through io_manager's downloadBlob, which defers blob-URL cleanup — without
    // that deferral this download intermittently produces no file at all.
    function download(state, hexId, opts) {
        const canvas = render(state, hexId, opts);
        if (!canvas) {
            if (typeof showToast === 'function') showToast('No system data to chart on this hex.', 3000);
            return Promise.resolve(false);
        }
        return _save(canvas, state, hexId);
    }

    // Saves an already-rendered sheet, so the pop-up's Download button writes
    // exactly the canvas on screen rather than drawing it a second time.
    function _save(canvas, state, hexId) {
        const nsys = SystemViewer.normalizeSystem(state);
        const mw   = nsys ? findMainworld(displayBodies(nsys)).body : null;
        const safe = String(resolveSystemName(nsys, state, mw, hexId)).replace(/[^a-z0-9]+/gi, '_');
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) { resolve(false); return; }
                const name = `${safe}_${String(hexId).replace(/[^a-z0-9]+/gi, '_')}_system_sheet.png`;
                if (typeof downloadBlob === 'function') {
                    resolve(!!downloadBlob(blob, name, 'image/png'));
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = name; a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 4000);
                    resolve(true);
                }
            }, 'image/png');
        });
    }

    // ── Pop-up ──────────────────────────────────────────────────────────────
    // Shows the sheet in a modal over the orrery, styled like the world image
    // panel (hex_editor.js openBodyImagePanel). The canvas is drawn at full
    // resolution and shrunk by CSS to fit the window; Download PNG saves that
    // same full-resolution canvas. z-index 9500 sits above the orrery (9000).
    const PANEL_ID = 'system-sheet-panel';

    function isOpen() { return !!document.getElementById(PANEL_ID); }
    function close()  { const p = document.getElementById(PANEL_ID); if (p) p.remove(); }

    function open(state, hexId, opts) {
        const canvas = render(state, hexId, opts);
        if (!canvas) {
            if (typeof showToast === 'function') showToast('No system data to chart on this hex.', 3000);
            return false;
        }
        close();

        const nsys = SystemViewer.normalizeSystem(state);
        const mw   = nsys ? findMainworld(displayBodies(nsys)).body : null;
        const sysName = resolveSystemName(nsys, state, mw, hexId);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        Object.assign(panel.style, {
            position: 'fixed', inset: '0', zIndex: '9500',
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Share Tech Mono","Courier New",monospace',
        });

        const title = document.createElement('div');
        title.textContent = sysName + '  ·  ' + hexId + '  —  System Sheet';
        Object.assign(title.style, {
            color: '#66fcf1', fontSize: '13px',
            marginBottom: '12px', letterSpacing: '0.05em',
        });

        Object.assign(canvas.style, {
            border: '1px solid #45a29e55',
            display: 'block',
            width: 'auto', height: 'auto',
            maxWidth: '94vw', maxHeight: 'calc(100vh - 110px)',
        });

        const btnStyle = {
            marginTop: '14px', padding: '6px 24px',
            background: 'transparent', border: '1px solid #45a29e',
            color: '#66fcf1', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '12px',
        };

        const dlBtn = document.createElement('button');
        dlBtn.textContent = 'Download PNG';
        Object.assign(dlBtn.style, btnStyle);
        dlBtn.addEventListener('click', async () => {
            dlBtn.disabled = true;
            try {
                await _save(canvas, state, hexId);
            } catch (err) {
                console.error('[System Sheet] download failed:', err);
                if (typeof showToast === 'function') showToast('The system sheet could not be saved — see the console.', 4000);
            } finally {
                dlBtn.disabled = false;
            }
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, btnStyle);
        closeBtn.addEventListener('click', close);
        panel.addEventListener('click', e => { if (e.target === panel) close(); });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '10px' });
        btnRow.append(dlBtn, closeBtn);

        panel.append(title, canvas, btnRow);
        document.body.appendChild(panel);
        return true;
    }

    // ESC closes the pop-up only. system_viewer.js loads first, so its ESC
    // handler runs before this one and sees isOpen() still true — the orrery
    // underneath stays open. stopPropagation keeps the window-level handler in
    // keyboard_shortcuts.js from also closing a palette behind the orrery.
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); }
    });

    return { render, download, open, close, isOpen, resolveSystemName, tableLayout, displayBodies, bandOf, W, H, THEME, BAND_COLOR, discSize, truncate, wrap };
})();

window.SystemSheet = SystemSheet;
