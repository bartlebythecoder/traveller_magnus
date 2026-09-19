'use strict';

// =============================================================================
// TERRAIN_FRAME.JS — Cartographic frame for regional maps (v0.18 spike)
//
// Composes a finished survey sheet around a rendered terrain plate: graticule
// with DMS ticks, scale bar, compass rose, data block, terrain key, globe
// locator inset and footer.
//
// This is the half of the reference images that is NOT the terrain. It is also
// the half doing most of the work of making them read as survey documents
// rather than as pictures of ground.
//
// The graticule is drawn as POLYLINES, not straight rules. Under the window's
// azimuthal-equidistant projection, lines of constant latitude and longitude
// are curves. At 150 km that is invisible; past ~1,000 km it is obvious, and a
// straight-ruled grid would put its ticks in the wrong place. All geometry goes
// through TerrainField.projector() so the grid cannot disagree with the feature
// labels about where a coordinate lands.
//
// Exposes: window.TerrainFrame
// =============================================================================

const TerrainFrame = (() => {

    const THEME = {
        sheet:  '#080b11',
        panel:  '#0b1017',
        rule:   '#1e2836',
        ink:    '#dfe6ef',
        dim:    '#7d8b9c',
        accent: '#5aa7d8',
        grid:   'rgba(214,230,246,0.20)',
        gridHi: 'rgba(214,230,246,0.34)',
    };

    // Gutters are asymmetric: the left/right edges carry latitude labels like
    // "35°00'N", which need far more room than the longitude labels above and
    // below. A single 34px gutter clipped them to "5°00'N".
    const PAD_X    = 54;
    const PAD_Y    = 26;
    const SIDEBAR  = 302;
    const SANS     = '"Segoe UI", system-ui, sans-serif';

    // ── Formatting ───────────────────────────────────────────────────────────

    // Candidate graticule steps, in degrees: 30" through 30°.
    const STEPS = [1 / 120, 1 / 60, 1 / 30, 1 / 20, 1 / 12, 1 / 6, 1 / 4, 1 / 3,
                   1 / 2, 1, 2, 3, 5, 10, 15, 20, 30];

    function chooseStep(spanDeg, want) {
        const target = spanDeg / (want || 5);
        for (const s of STEPS) if (s >= target) return s;
        return STEPS[STEPS.length - 1];
    }

    // Degrees → D°M'S" with the precision the step actually needs.
    function fmtDMS(deg, stepDeg, posChar, negChar) {
        const hemi = deg >= 0 ? posChar : negChar;
        let v = Math.abs(deg);
        let d = Math.floor(v + 1e-9);
        let mF = (v - d) * 60;
        let m = Math.floor(mF + 1e-6);
        let s = Math.round((mF - m) * 60);
        if (s >= 60) { s -= 60; m += 1; }
        if (m >= 60) { m -= 60; d += 1; }
        const pad = n => (n < 10 ? '0' : '') + n;
        if (stepDeg >= 1)      return `${pad(d)}°${hemi}`;
        if (stepDeg >= 1 / 60) return `${pad(d)}°${pad(m)}'${hemi}`;
        return `${pad(d)}°${pad(m)}'${pad(s)}"${hemi}`;
    }

    // 1 / 2 / 4 × 10ⁿ, the largest not exceeding target.
    //
    // Deliberately excludes 2.5 and 5: the bar is divided into four segments,
    // and 25 km split four ways gives tick labels of 6.25 / 12.5 / 18.75. These
    // magnitudes always quarter cleanly.
    function niceDistance(target) {
        if (target <= 0) return 1;
        const mags = [1, 2, 4];
        const e = Math.floor(Math.log10(target));
        let best = 1;
        for (let p = e + 1; p >= e - 2; p--) {
            for (let i = mags.length - 1; i >= 0; i--) {
                const v = mags[i] * Math.pow(10, p);
                if (v <= target) { return v; }
            }
        }
        return best;
    }

    // ── Graticule ────────────────────────────────────────────────────────────

    function drawGraticule(ctx, proj, rect, opts) {
        const { x: RX, y: RY, w: RW, h: RH } = rect;
        const sx = RW / proj.W, sy = RH / proj.H;
        const toSheet = p => ({ x: RX + p.x * sx, y: RY + p.y * sy, front: p.front });

        // Coordinate range actually covered, from the plate's corners and edge
        // midpoints (a curved edge can bulge past its corners).
        let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180;
        let crossesAM = false;
        const probes = [];
        for (let i = 0; i <= 8; i++) {
            probes.push([proj.W * i / 8, 0], [proj.W * i / 8, proj.H],
                        [0, proj.H * i / 8], [proj.W, proj.H * i / 8]);
        }
        const lons = [];
        for (const [px, py] of probes) {
            const c = proj.toLatLon(px, py);
            latMin = Math.min(latMin, c.latDeg); latMax = Math.max(latMax, c.latDeg);
            lons.push(c.lonDeg);
        }
        // Longitude wraps; detect it before taking a naive min/max.
        lons.sort((a, b) => a - b);
        let maxGap = 0, gapAt = 0;
        for (let i = 1; i < lons.length; i++) {
            const g = lons[i] - lons[i - 1];
            if (g > maxGap) { maxGap = g; gapAt = i; }
        }
        const wrapGap = (lons[0] + 360) - lons[lons.length - 1];
        if (maxGap > wrapGap && maxGap > 180) {
            crossesAM = true;
            lonMin = lons[gapAt]; lonMax = lons[gapAt - 1] + 360;
        } else {
            lonMin = lons[0]; lonMax = lons[lons.length - 1];
        }

        const latSpan = Math.max(1e-6, latMax - latMin);
        const lonSpan = Math.max(1e-6, lonMax - lonMin);
        const latStep = chooseStep(latSpan, 5);
        const lonStep = chooseStep(lonSpan, 6);

        ctx.save();
        ctx.beginPath();
        ctx.rect(RX, RY, RW, RH);
        ctx.clip();
        ctx.lineWidth = 1;
        ctx.strokeStyle = THEME.grid;

        const ticks = { top: [], bottom: [], left: [], right: [] };
        const EPS = 1.5;

        // Walk a gridline, drawing it and noting where it meets each edge.
        // isLat gridlines may only label the left/right edges, lon gridlines only
        // top/bottom. On a curved graticule a meridian genuinely can exit through
        // the top edge, but putting "60°N" in among the longitude labels reads as
        // a mistake, so those crossings are drawn and simply not labelled.
        function walk(fixed, isLat, vMin, vMax, label) {
            const N = 160;
            let prev = null;
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const t = vMin + (vMax - vMin) * i / N;
                const p = toSheet(isLat ? proj.toScreen(fixed, t) : proj.toScreen(t, fixed));
                if (!p.front || !isFinite(p.x) || !isFinite(p.y)) { prev = null; continue; }
                if (prev) {
                    ctx.moveTo(prev.x, prev.y);
                    ctx.lineTo(p.x, p.y);
                    // Edge crossings, for the tick labels.
                    const inPrev = prev.x >= RX - EPS && prev.x <= RX + RW + EPS &&
                                   prev.y >= RY - EPS && prev.y <= RY + RH + EPS;
                    const inCur  = p.x >= RX - EPS && p.x <= RX + RW + EPS &&
                                   p.y >= RY - EPS && p.y <= RY + RH + EPS;
                    if (inPrev !== inCur) {
                        const e = inCur ? prev : p, f = inCur ? p : prev;
                        const mid = { x: (e.x + f.x) / 2, y: (e.y + f.y) / 2 };
                        if (Math.abs(mid.x - RX) < 6) {
                            if (isLat) ticks.left.push({ at: mid.y, label });
                        } else if (Math.abs(mid.x - (RX + RW)) < 6) {
                            if (isLat) ticks.right.push({ at: mid.y, label });
                        } else if (Math.abs(mid.y - RY) < 6) {
                            if (!isLat) ticks.top.push({ at: mid.x, label });
                        } else if (Math.abs(mid.y - (RY + RH)) < 6) {
                            if (!isLat) ticks.bottom.push({ at: mid.x, label });
                        }
                    }
                }
                prev = p;
            }
            ctx.stroke();
        }

        const latPad = latSpan * 0.15, lonPad = lonSpan * 0.15;
        const latFrom = Math.ceil((latMin - latPad) / latStep) * latStep;
        for (let v = latFrom; v <= latMax + latPad; v += latStep) {
            if (v < -90 || v > 90) continue;
            walk(v, true, lonMin - lonPad, lonMax + lonPad,
                 fmtDMS(v, latStep, 'N', 'S'));
        }
        const lonFrom = Math.ceil((lonMin - lonPad) / lonStep) * lonStep;
        for (let v = lonFrom; v <= lonMax + lonPad; v += lonStep) {
            const vv = ((v + 540) % 360) - 180;
            walk(vv, false, Math.max(-89.99, latMin - latPad),
                            Math.min(89.99, latMax + latPad),
                 fmtDMS(vv, lonStep, 'E', 'W'));
        }
        ctx.restore();

        // Tick labels in the gutter.
        ctx.font = '10px ' + SANS;
        ctx.fillStyle = THEME.dim;
        const seen = { top: {}, bottom: {}, left: {}, right: {} };
        const place = (side, arr) => {
            for (const t of arr) {
                const key = t.label;
                if (seen[side][key]) continue;
                seen[side][key] = 1;
                ctx.save();
                if (side === 'top' || side === 'bottom') {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = side === 'top' ? 'bottom' : 'top';
                    ctx.fillText(t.label, t.at, side === 'top' ? RY - 7 : RY + RH + 8);
                    ctx.strokeStyle = THEME.dim;
                    ctx.beginPath();
                    ctx.moveTo(t.at, side === 'top' ? RY - 4 : RY + RH + 1);
                    ctx.lineTo(t.at, side === 'top' ? RY - 1 : RY + RH + 4);
                    ctx.stroke();
                } else {
                    ctx.textAlign = side === 'left' ? 'right' : 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(t.label, side === 'left' ? RX - 7 : RX + RW + 7, t.at);
                    ctx.strokeStyle = THEME.dim;
                    ctx.beginPath();
                    ctx.moveTo(side === 'left' ? RX - 4 : RX + RW + 1, t.at);
                    ctx.lineTo(side === 'left' ? RX - 1 : RX + RW + 4, t.at);
                    ctx.stroke();
                }
                ctx.restore();
            }
        };
        place('top', ticks.top); place('bottom', ticks.bottom);
        place('left', ticks.left); place('right', ticks.right);
    }

    // ── Sidebar pieces ───────────────────────────────────────────────────────

    function drawScaleBar(ctx, x, y, w, metresPerPxOnSheet) {
        const targetPx = w;
        const targetKm = (targetPx * metresPerPxOnSheet) / 1000;
        const km = niceDistance(targetKm);
        const barPx = (km * 1000) / metresPerPxOnSheet;
        const segs = 4, segPx = barPx / segs;

        ctx.save();
        ctx.font = '9px ' + SANS;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const h = 6;
        for (let i = 0; i < segs; i++) {
            ctx.fillStyle = (i % 2) ? THEME.ink : '#24303f';
            ctx.fillRect(x + i * segPx, y, segPx, h);
        }
        ctx.strokeStyle = THEME.dim;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, barPx, h);
        ctx.fillStyle = THEME.dim;
        for (let i = 0; i <= segs; i++) {
            const v = (km / segs) * i;
            const s = (km / segs < 1) ? v.toFixed(1) : String(Math.round(v));
            ctx.fillText(s, x + i * segPx, y + h + 3);
        }
        ctx.textAlign = 'left';
        ctx.fillText('km', x + barPx + 17, y + h + 3);
        ctx.restore();
        return h + 16;
    }

    function drawCompass(ctx, cx, cy, r) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = THEME.dim;
        ctx.fillStyle = THEME.ink;
        ctx.lineWidth = 1;
        // Eight points, cardinals long.
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const len = (i % 2 === 0) ? r : r * 0.48;
            const wdt = (i % 2 === 0) ? r * 0.16 : r * 0.10;
            const a1 = a + Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
            ctx.lineTo(Math.cos(a1) * wdt, Math.sin(a1) * wdt);
            ctx.lineTo(-Math.cos(a) * wdt * 0.35, -Math.sin(a) * wdt * 0.35);
            ctx.lineTo(-Math.cos(a1) * wdt, -Math.sin(a1) * wdt);
            ctx.closePath();
            ctx.fillStyle = (i % 2 === 0) ? 'rgba(223,230,239,0.85)' : 'rgba(125,139,156,0.55)';
            ctx.fill();
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
        ctx.strokeStyle = THEME.dim;
        ctx.stroke();
        ctx.fillStyle = THEME.ink;
        ctx.font = '600 11px ' + SANS;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('N', 0, -r - 3);
        ctx.restore();
    }

    // ── Compose ──────────────────────────────────────────────────────────────
    //
    // opts: { mapCanvas, field, legend, worldType, worldData, title, subtitle,
    //         globeCanvas, surveyId, date, extraRows }
    function compose(out, opts) {
        const map = opts.mapCanvas;
        const f   = opts.field;
        const RW  = map.width, RH = map.height;

        const sheetW = PAD_X * 2 + RW + SIDEBAR;
        const sheetH = Math.max(PAD_Y * 2 + RH, 620);
        out.width = sheetW;
        out.height = sheetH;
        const ctx = out.getContext('2d');

        ctx.fillStyle = THEME.sheet;
        ctx.fillRect(0, 0, sheetW, sheetH);

        // Map plate.
        const RX = PAD_X, RY = PAD_Y;
        ctx.drawImage(map, RX, RY);
        ctx.strokeStyle = THEME.rule;
        ctx.lineWidth = 1;
        ctx.strokeRect(RX - 0.5, RY - 0.5, RW + 1, RH + 1);

        drawGraticule(ctx, TerrainField.projector(f), { x: RX, y: RY, w: RW, h: RH }, opts);

        // ── Sidebar ──
        const SXo = PAD_X + RW + PAD_X;
        const SW = SIDEBAR - PAD_X;
        ctx.fillStyle = THEME.panel;
        ctx.fillRect(SXo - 12, 0, sheetW - SXo + 12, sheetH);
        ctx.strokeStyle = THEME.rule;
        ctx.beginPath();
        ctx.moveTo(SXo - 12.5, 0); ctx.lineTo(SXo - 12.5, sheetH);
        ctx.stroke();

        let y = PAD_Y + 8;
        const rule = () => {
            ctx.strokeStyle = THEME.rule;
            ctx.beginPath();
            ctx.moveTo(SXo, y + 0.5); ctx.lineTo(SXo + SW, y + 0.5);
            ctx.stroke();
            y += 11;
        };
        const heading = txt => {
            ctx.font = '600 9.5px ' + SANS;
            ctx.fillStyle = THEME.accent;
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(txt.toUpperCase().split('').join(' '), SXo, y);
            y += 6; rule();
        };
        const row = (k, v) => {
            ctx.font = '11px ' + SANS;
            ctx.fillStyle = THEME.dim;
            ctx.textAlign = 'left';
            ctx.fillText(k, SXo, y);
            ctx.fillStyle = THEME.ink;
            ctx.textAlign = 'right';
            ctx.fillText(String(v), SXo + SW, y);
            ctx.textAlign = 'left';
            y += 15;
        };

        // Title.
        ctx.font = '700 26px ' + SANS;
        ctx.fillStyle = THEME.ink;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText((opts.title || 'UNNAMED').toUpperCase(), SXo, y + 20);
        y += 30;
        ctx.font = '11px ' + SANS;
        ctx.fillStyle = THEME.dim;
        ctx.fillText((opts.subtitle || 'Regional Survey').toUpperCase()
                     .split('').join(' '), SXo, y + 8);
        y += 28;

        heading('Survey Data');
        const c = f;
        row('Centre', `${c.lat0Deg.toFixed(2)}°, ${c.lon0Deg.toFixed(2)}°`);
        row('Width', `${Math.round(c.widthKm).toLocaleString()} km`);
        row('Resolution', `${Math.round(c.metresPerPx)} m/px`);
        row('Relief', `${Math.round(c.elevMaxM - c.elevMinM).toLocaleString()} m`);
        if (opts.worldData) {
            const w = opts.worldData;
            if (w.uwp) row('UWP', w.uwp);
            row('Type', (opts.worldType || '').replace('_', ' '));
            if (w.diameterKm) row('Diameter', `${Math.round(w.diameterKm).toLocaleString()} km`);
            if (w.temperatureK) row('Mean Temp.', `${Math.round(w.temperatureK)} K`);
        }
        (opts.extraRows || []).forEach(r => row(r[0], r[1]));
        y += 6;

        // Terrain key — derived from the pixels actually rendered, not authored.
        if (opts.legend && opts.legend.length) {
            heading('Terrain Key');
            ctx.font = '10.5px ' + SANS;
            for (const m of opts.legend.slice(0, 11)) {
                ctx.fillStyle = `rgb(${m.c[0]},${m.c[1]},${m.c[2]})`;
                ctx.fillRect(SXo, y - 8, 16, 10);
                ctx.strokeStyle = 'rgba(0,0,0,0.45)';
                ctx.strokeRect(SXo + 0.5, y - 7.5, 15, 9);
                ctx.fillStyle = THEME.dim;
                ctx.textAlign = 'left';
                ctx.fillText(m.label, SXo + 23, y);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#5a6676';
                ctx.fillText((m.share * 100).toFixed(1) + '%', SXo + SW, y);
                ctx.textAlign = 'left';
                y += 14;
            }
            y += 8;
        }

        // Scale bar — honest because the projection is equidistant from centre.
        heading('Scale');
        const sheetMetresPerPx = c.metresPerPx * (RW / f.W);
        y += drawScaleBar(ctx, SXo, y - 4, SW * 0.82, sheetMetresPerPx);
        y += 10;

        // Compass + globe inset side by side.
        const insetTop = y;
        drawCompass(ctx, SXo + 34, insetTop + 34, 26);
        if (opts.globeCanvas) {
            const gw = SW - 88, gh = gw / 2;
            const gx = SXo + 84, gy = insetTop + 34 - gh / 2;
            ctx.drawImage(opts.globeCanvas, gx, gy, gw, gh);
            ctx.strokeStyle = THEME.rule;
            ctx.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
        }
        y = insetTop + 76;

        // Footer.
        const fy = Math.max(y + 16, sheetH - PAD_Y - 34);
        ctx.strokeStyle = THEME.rule;
        ctx.beginPath();
        ctx.moveTo(SXo, fy - 14.5); ctx.lineTo(SXo + SW, fy - 14.5);
        ctx.stroke();
        ctx.font = '9.5px ' + SANS;
        ctx.fillStyle = THEME.dim;
        ctx.textAlign = 'left';
        ctx.fillText((opts.office || 'SECTOR SURVEY OFFICE').toUpperCase(), SXo, fy);
        ctx.fillText(`Satellite Survey: ${opts.surveyId || '—'}`, SXo, fy + 13);
        ctx.fillText(`Date: ${opts.date || '—'}`, SXo, fy + 26);

        return out;
    }

    // Stable survey identifier: same window on the same body always yields the
    // same ID, so two prints of one location are not mistaken for two surveys.
    function surveyId(hexId, bodyName, latDeg, lonDeg, widthKm) {
        const h = hashString([hexId, bodyName, latDeg.toFixed(2), lonDeg.toFixed(2),
                              Math.round(widthKm)].join('|'));
        const n = (h % 9000) + 1000;
        return `TRS-${hexId || '0000'}-${String(n)}`;
    }


    // ── Per-world sheet parameters ───────────────────────────────────────────
    //
    // Everything a sheet needs that is derived from the WORLD rather than from
    // the framing. ONE definition, shared by the panel and the exporters — the
    // numbers below decide what a planet looks like, so two copies would mean
    // the exported sheet and the on-screen sheet could disagree about the same
    // world.
    //
    // Derived from the world, never from the map width. Deriving landform size
    // from width would make zooming regenerate the terrain — the exact failure
    // the world-anchored cascade was built to remove.
    //
    // STEEPNESS rests on real physics rather than invented rules. The isostatic
    // limit puts maximum mountain height at about sigma/(rho*g), i.e. inversely
    // with surface gravity; for roughly constant density g scales with radius,
    // so relief scales as 1/radius. That prediction checks out against the solar
    // system: Mars at 0.38 g should carry mountains ~2.6x Earth's, and Olympus
    // Mons (22 km) against Everest (8.8 km) is 2.5x.
    //
    // LANDFORM has much weaker grounding — characteristic wavelength depends on
    // lithospheric thickness and tectonic regime, which we do not model and
    // Traveller does not supply. It therefore stays near 25 km with only a gentle
    // nudge upward for smaller bodies, matching the observation that small worlds
    // carry relatively larger features. Deliberately not precise, because the
    // justification is not either.
    //
    // One source for the planetary metre scale — the field and the shader must
    // agree on where sea level is, or the coastline taper and the water
    // colouring would disagree.
    const PLANET_RELIEF_M = 12000;
    const REF_RADIUS_KM   = 6400;               // a size-8 world

    function sheetSetup(worldData, seed, masterSeedStr) {
        const sizeCode = TerrainRender.parseStat(worldData.size);
        const planetRadiusKm = Math.max(400, sizeCode * 800);
        const hydro = TerrainRender.parseStat(worldData.hydrographics);
        const seaLevel = Math.max(0.05, Math.min(1, hydro / 10));

        const rel = REF_RADIUS_KM / Math.max(200, planetRadiusKm);
        const steepness  = Math.max(60, Math.min(450, Math.round(200 * rel / 10) * 10));
        const landformKm = Math.max(6, Math.min(60, Math.round(25 * Math.pow(rel, 0.2))));
        const widthKm    = Math.max(10, Math.min(2000, landformKm * 5));

        // Match planet_renderer's live tuning so the base field agrees with the
        // flat map the user just looked at.
        const maskWeight = typeof window.planetContinentalDefinition === 'number'
            ? window.planetContinentalDefinition : 0.55;
        const warpStrength = typeof window.planetCoastlineComplexity === 'number'
            ? window.planetCoastlineComplexity : 0.45;

        return {
            ctx: TerrainField.buildContext(masterSeedStr, seed, maskWeight, warpStrength),
            worldType: TerrainRender.worldTypeOf(worldData),
            atmCode: TerrainRender.parseStat(worldData.atmosphere),
            hydro: hydro,
            seaLevel: seaLevel,
            planetRadiusKm: planetRadiusKm,
            planetReliefM: PLANET_RELIEF_M,
            steepness: steepness,
            landformKm: landformKm,
            widthKm: widthKm,
            // Relief is DERIVED: steepness x landform size, clamped to something
            // physically sane at the extremes of both per-world values.
            localReliefM: Math.max(200, Math.min(15000, steepness * landformKm)),
        };
    }

    // ── The survey sheet pipeline ────────────────────────────────────────────
    //
    // ONE definition, shared by the in-app panel (terrain_panel.js) and the
    // exporters (export_core.js). It lives here because this module already
    // owns sheet composition, and because a second copy would drift — the same
    // failure `remapHeight` and `isIce` already cost this project once each.
    //
    // Lifted out of terrain_panel.js on 2026-09-14, verbatim. The panel's
    // rendered output was hashed before and after to prove the move was inert.

    // Feature labels. Everything it needs beyond the plate arrives in `o`;
    // it reads no module state.
    function _drawLabels(plate, f, out, o) {
        const c2 = plate.getContext('2d');
        const feats = TerrainNames.featuresFor(o.ctx, {
            worldType: o.worldType,
            seaLevel: o.seaLevel,
            planetRadiusKm: o.planetRadiusKm,
            masterSeed: o.masterSeed,
            hexId: o.hexId,
            bodyName: o.bodyName,
        });
            const proj = TerrainField.projector(f);
        const mem = feats.membership;
        const GW = TerrainNames.GRID_W, GH = TerrainNames.GRID_H;
        const SXn = 41, SYn = 27;
        const tally = feats.map(() => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 }));
        let total = 0;
        for (let j = 0; j < SYn; j++) {
            for (let i = 0; i < SXn; i++) {
                const pxc = ((i + 0.5) / SXn) * plate.width;
                const pyc = ((j + 0.5) / SYn) * plate.height;
                const cc = proj.toLatLon(pxc * f.W / plate.width, pyc * f.H / plate.height);
                const gx = Math.min(GW - 1, Math.max(0,
                    Math.floor((cc.lonDeg + 180) / 360 * GW)));
                const gy = Math.min(GH - 1, Math.max(0,
                    Math.floor((90 - cc.latDeg) / 180 * GH)));
                const k = mem ? mem[gy * GW + gx] : -1;
                total++;
                if (k < 0 || k >= tally.length) continue;
                const t = tally[k];
                t.n++; t.sx += pxc; t.sy += pyc;
                t.sxx += pxc * pxc; t.syy += pyc * pyc; t.sxy += pxc * pyc;
            }
        }
        const order = feats.map((ft, k) => ({ ft, k, cov: tally[k].n / Math.max(1, total) }))
                           .filter(e => e.cov >= 0.12)
                           .sort((a, b) => b.cov - a.cov);
        const drawn = [];
        for (const e of order) {
            if (drawn.length >= 12) break;
            const t = tally[e.k];
            const mx = t.sx / t.n, my = t.sy / t.n;
            const cxx = t.sxx / t.n - mx * mx, cyy = t.syy / t.n - my * my;
            const cxy = t.sxy / t.n - mx * my;
            const trc = cxx + cyy;
            const dsc = Math.sqrt(Math.max(0, (cxx - cyy) ** 2 + 4 * cxy * cxy));
            const l1 = (trc + dsc) / 2, l2 = Math.max(1e-6, (trc - dsc) / 2);
            const elong = Math.sqrt(l1 / l2);
            const majorPx = 4 * Math.sqrt(Math.max(0, l1));
            let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
            if (ang > Math.PI / 2) ang -= Math.PI;
            if (ang < -Math.PI / 2) ang += Math.PI;
            const linear = e.ft.cls === 'range' && elong > 1.35 && t.n >= 8;
            const big = e.cov > 0.45 || majorPx > plate.width * 0.7;
            const fp = big ? 19 : 15;
            c2.font = (big ? 600 : 500) + ' ' + fp + 'px "Segoe UI", system-ui, sans-serif';
            const fill = e.ft.cls === 'sea' ? '#cfe4f5' : '#f2f5f8';
            const txt = e.ft.label.toUpperCase();
            const baseW = c2.measureText(txt).width;
            const targetW = Math.min(majorPx * 0.85, plate.width * 0.88);
            const spanW = Math.max(baseW, Math.min(targetW, baseW * 2.6));
            const chars = txt.split('');
            const tracking = Math.max(0, Math.min(fp * (linear ? 0.85 : 0.32),
                (spanW - baseW) / Math.max(1, chars.length - 1)));
            const halfSpan = (baseW + tracking * (chars.length - 1)) / 2;
            const padX = linear ? halfSpan * Math.abs(Math.cos(ang)) + 10 : halfSpan + 8;
            const padY = linear ? halfSpan * Math.abs(Math.sin(ang)) + 12 : 16;
            const cx = Math.max(padX, Math.min(plate.width - padX, mx));
            const cy = Math.max(padY, Math.min(plate.height - padY, my));
            if (drawn.some(d => Math.abs(d.x - cx) < 160 && Math.abs(d.y - cy) < 32)) continue;
            drawn.push({ x: cx, y: cy });
            c2.save();
            c2.translate(cx, cy);
            if (linear) c2.rotate(ang);
            c2.textAlign = 'left'; c2.textBaseline = 'middle';
            let x = -halfSpan;
            for (let i = 0; i < chars.length; i++) {
                c2.lineWidth = 3.5; c2.strokeStyle = 'rgba(8,12,18,0.78)';
                c2.strokeText(chars[i], x, 0);
                c2.fillStyle = fill;
                c2.fillText(chars[i], x, 0);
                x += c2.measureText(chars[i]).width + tracking;
            }
            c2.restore();
        }
        return drawn.length;
    }

    // Render one survey sheet's MAP PLATE (not the cartographic frame — call
    // compose() for that). Returns { plate, f, out }, or null if `abort` asked
    // to stop partway.
    //
    // o: { ctx, worldData, worldType, atmCode, seaLevel, planetRadiusKm,
    //      planetReliefM, latDeg, lonDeg, widthKm, W, H, localReliefM,
    //      landformKm, lightAltDeg, hydrology, labels,
    //      masterSeed, hexId, bodyName, abort? }
    function renderSheet(o) {
        const W = o.W, H = o.H;
        const stop = o.abort || function () { return false; };

        const f = TerrainField.buildRegional({
            ctx: o.ctx, latDeg: o.latDeg, lonDeg: o.lonDeg, widthKm: o.widthKm,
            planetRadiusKm: o.planetRadiusKm, W: W, H: H,
            localReliefM: o.localReliefM,
            planetReliefM: o.planetReliefM,
            seaLevel: o.seaLevel,
            landformKm: o.landformKm,
            erosionIterations: Math.round(W * H * 0.18),
            // Valleys are cut during generation when this is on, so the flag
            // shapes the TERRAIN, not just what is drawn over it.
            hydrology: !!o.hydrology,
        });
        if (stop()) return null;

        // The valleys already exist in the field — buildRegional cut them.
        // These lines just follow the same flow that did the cutting, so a
        // river cannot end up sitting on a ridge.
        let riverLocal = null;
        if (f.flow && window.TerrainRivers) {
            riverLocal = TerrainRivers.linesFromField(f,
                { seaLevelM: o.planetReliefM * o.seaLevel });
        }

        const out = TerrainRender.shade(f, o.ctx, {
            worldData: o.worldData,
            seaLevelM: o.planetReliefM * o.seaLevel,
            lightAzDeg: 315, lightAltDeg: o.lightAltDeg,
            shadowSteps: Math.round(W * 0.09),
            aoRadius: Math.max(4, Math.round(W * 0.012)),
            microTexture: 0.10,
        });
        if (stop()) return null;

        const plate = document.createElement('canvas');
        plate.width = W; plate.height = H;
        plate.getContext('2d').putImageData(out.image, 0, 0);

        // Rivers go under the labels. Drawn from the shared global network, so
        // the same river appears in the same place on the world image too, and
        // in the world's OWN water tones — an amber or violet sea gets rivers
        // to match rather than a generic blue.
        if (riverLocal) {
            const wc = TerrainRender.waterColors(o.worldType, o.atmCode, o.ctx.oceanRng);
            TerrainRivers.drawLocal(plate.getContext('2d'), riverLocal, {
                shallow: wc.shallow, deep: wc.deep,
                widthScale: Math.max(1, plate.width / 700),
            });
        }
        if (o.labels) _drawLabels(plate, f, out, o);

        return { plate: plate, f: f, out: out };
    }

    return {
        sheetSetup, renderSheet, compose, surveyId, THEME, PAD_X, PAD_Y, SIDEBAR, niceDistance, fmtDMS, chooseStep };
})();

window.TerrainFrame = TerrainFrame;
