'use strict';

// =============================================================================
// TERRAIN_PANEL.JS — Regional map panel for the main app (v0.18 spike)
//
// The entire in-app UI for regional surface maps lives here, so the hook into
// hex_editor.js is a single button. Nothing else in the shipped app changes.
//
// CONTINUITY: hex_editor passes PlanetRenderer.imageSeed(hexId, body) — a
// string like "1105-Kteiroa" — as the seed, and renderFlatMap feeds that string
// in as its hexId. This panel does exactly the same, so the base field here is
// bit-identical to the flat map the user just came from. It also honours the
// two live tuning globals (planetContinentalDefinition / planetCoastlineComplexity)
// for the same reason.
//
// Exposes: window.TerrainPanel  { open }
// =============================================================================

const TerrainPanel = (() => {

    const TEAL = '#66fcf1', TEAL_DIM = '#45a29e', INK = '#c5d4d3', DIM = '#8ab8b5';
    // Used only for a pin whose terrain has been rebuilt under another master
    // seed — deliberately not red: nothing is broken, the pin is just describing
    // ground that no longer looks the way it did.
    const AMBER = '#e0b062';

    function el(tag, style, text) {
        const e = document.createElement(tag);
        if (style) Object.assign(e.style, style);
        if (text !== undefined) e.textContent = text;
        return e;
    }

    const btnStyle = {
        padding: '4px 10px', background: 'transparent',
        border: '1px solid ' + TEAL_DIM + '55', color: DIM, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: '11px', borderRadius: '2px',
    };

    function mkBtn(label, onClick, primary) {
        const b = el('button', btnStyle, label);
        if (primary) Object.assign(b.style, { border: '1px solid ' + TEAL, color: TEAL });
        b.addEventListener('click', onClick);
        return b;
    }

    function labelled(text, control) {
        const row = el('label', {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '8px', margin: '5px 0', fontSize: '11px', color: DIM,
        });
        row.appendChild(el('span', null, text));
        row.appendChild(control);
        return row;
    }

    const fmtLat = v => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'N' : 'S');
    const fmtLon = v => Math.abs(v).toFixed(2) + '°' + (v >= 0 ? 'E' : 'W');

    function open(worldData, seed, titleText, hexLabel) {
        if (!window.TerrainField || !window.TerrainRender ||
            !window.TerrainNames || !window.TerrainFrame) {
            alert('Regional map modules are not loaded.');
            return;
        }

        const ms = (typeof masterSeed !== 'undefined') ? masterSeed : 'default';
        const bodyName = TerrainPins.bodyNameOf(worldData.name);
        // Per-world parameters and the field context both come from
        // TerrainFrame.sheetSetup(), which the exporters call too — so an
        // exported sheet and this one cannot disagree about the same world.
        const S = TerrainFrame.sheetSetup(worldData, seed, ms);
        const planetRadiusKm  = S.planetRadiusKm;
        const hydro           = S.hydro;
        const seaLevel        = S.seaLevel;
        const PLANET_RELIEF_M = S.planetReliefM;
        const worldType       = S.worldType;
        const atmCode         = S.atmCode;
        const ctx             = S.ctx;
        const SUG = { steepness: S.steepness, landformKm: S.landformKm, widthKm: S.widthKm };

        const pinKey = TerrainPins.bodyKey(ms, hexLabel || '0000', bodyName);

        // ── Shell ──
        const overlay = el('div', {
            position: 'fixed', inset: '0', zIndex: '10000',
            background: 'rgba(2,6,10,0.88)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
        });
        const panel = el('div', {
            background: '#06090d', border: '1px solid ' + TEAL_DIM + '66',
            padding: '14px', maxWidth: '96vw', maxHeight: '94vh',
            overflow: 'auto', display: 'flex', gap: '14px',
        });

        const left = el('div', { display: 'flex', flexDirection: 'column', gap: '8px' });
        const side = el('div', { width: '210px', flex: '0 0 210px' });

        const title = el('div', { color: TEAL, fontSize: '13px', letterSpacing: '.08em' },
                         (titleText || bodyName).toUpperCase());
        const canvas = el('canvas', {
            border: '1px solid ' + TEAL_DIM + '44', display: 'block',
            maxWidth: '78vw', maxHeight: '76vh', background: '#000',
        });
        const status = el('div', { fontSize: '10.5px', color: DIM, whiteSpace: 'pre-wrap' },
                          'Rendering…');

        // ── Controls ──
        // NOTE: min/max/step MUST be set before value. An input clamps `value`
        // against whatever range is in force at the time, and the default range
        // is 0-100 — so assigning value first silently pinned the relief slider
        // to 200 m while its label read 5200, producing flat grey maps.
        const rng = (val, min, max, step) => {
            const i = el('input');
            Object.assign(i, { type: 'range', min, max, step: step || 1 });
            i.value = val;                       // after min/max — see note above
            Object.assign(i.style, { width: '96px' });
            return i;
        };

        // The survey window is FIXED at the world's suggested width. Zoom was
        // removed (2026-09-13): it was slow, and because landform size is a
        // property of the planet rather than of the framing, magnifying the
        // window changed almost nothing visible. Panning stays — and stays
        // coherent — because the field is world-anchored: the plate under the
        // cursor is the same ground wherever you drag it to.
        const VIEW_WIDTH_KM = SUG.widthKm;
        const inRes     = el('select');
        [['720', 'Fast'], ['960', 'Balanced'], ['1400', 'Detailed']].forEach(([v, t]) => {
            const o = el('option', null, t); o.value = v;
            if (v === '960') o.selected = true;
            inRes.appendChild(o);
        });
        Object.assign(inRes.style, {
            background: '#0b1017', color: INK, border: '1px solid ' + TEAL_DIM + '44',
            fontFamily: 'inherit', fontSize: '11px',
        });
        // Landform size and steepness are per-world CONSTANTS, not controls.
        // Both are properties of the planet rather than of the framing (see
        // suggested() above — steepness follows the isostatic limit, i.e.
        // 1/radius), so exposing them only invited settings that contradicted
        // the world's own physics. Steepness is metres of relief per kilometre
        // of landform, which IS the terrain's mean gradient: measured mean
        // slope matches atan(steepness/1000) to within half a degree.
        const LANDFORM_KM = SUG.landformKm;
        const STEEPNESS   = SUG.steepness;
        const inLight    = rng(38, 5, 85);
        // Rivers AND LAKES both come out of the hydrology pass, which only runs
        // on terrain model 2 and only on a world with water to run. The box is
        // named for both because it governs both: a lake is a basin the same
        // pass decided holds standing water, so switching this off takes the
        // lakes away with the rivers. Where neither condition holds the
        // box was previously tickable and silently inert — it is now disabled
        // and says which of the two is missing. Read once at open, which is safe:
        // the panel is modal, so the terrain model cannot change underneath it.
        const inRivers   = el('input'); inRivers.type = 'checkbox';
        const riversWhy  = (window.terrainFieldVersion || 1) < 2
            ? 'Not available on Classic world images \u2014 untick Settings \u203a Visual Options \u203a World Image Generation \u203a Use Classic World Images.'
            : (hydro < 1 ? 'This world has no surface water.' : '');
        inRivers.checked  = !riversWhy;
        inRivers.disabled = !!riversWhy;
        const inLabels   = el('input'); inLabels.type = 'checkbox'; inLabels.checked = true;
        const inFrame    = el('input'); inFrame.type = 'checkbox'; inFrame.checked = true;

        const ltVal = el('span', { color: TEAL, fontSize: '10px' }, inLight.value);

        // Relief is DERIVED: steepness x landform size, clamped to something
        // physically sane at the extremes of both per-world values.
        function reliefM() { return S.localReliefM; }
        function syncReadouts() {
            ltVal.textContent = inLight.value;
        }
        inLight.addEventListener('input', syncReadouts);
        syncReadouts();

        const wrap = (c, v) => { const d = el('div', { display: 'flex', gap: '5px',
            alignItems: 'center' }); d.append(c, v); return d; };

        // Built here rather than inline in side.append() so the disabled state
        // can be dressed before the row is placed.
        const riversRow  = labelled('Rivers & lakes', inRivers);
        const riversNote = el('div', {
            fontSize: '9.5px', color: DIM, opacity: '.8', lineHeight: '1.35',
            margin: '-3px 0 5px', display: riversWhy ? 'block' : 'none',
        }, riversWhy);
        if (riversWhy) {
            riversRow.style.opacity = '0.45';
            riversRow.style.cursor  = 'not-allowed';
            riversRow.title         = riversWhy;
            inRivers.style.cursor   = 'not-allowed';
        }

        const head = t => el('div', {
            color: TEAL, fontSize: '9.5px', letterSpacing: '.14em',
            margin: '12px 0 4px', borderBottom: '1px solid ' + TEAL_DIM + '33',
            paddingBottom: '3px',
        }, t.toUpperCase());

        const siteRow = el('div', { marginTop: '4px' });

        // Interactive locator. The globe that appears on the sheet is baked into
        // the composed image and cannot take clicks, so the panel keeps its own
        // live copy here.
        //
        // It is a PREVIEW, not a picker: at 200 px for 360 degrees one pixel is
        // 1.8 degrees, which on an Earth-sized world is about 200 km — the whole
        // survey window. Clicking it therefore opens the full-world locator
        // instead of moving the window directly. See openLocator().
        const mini = el('canvas', {
            width: '200px', height: '100px', display: 'block',
            border: '1px solid ' + TEAL_DIM + '44', cursor: 'zoom-in',
            marginTop: '2px',
        });
        mini.width = 400; mini.height = 200;      // backing store, 2x for sharpness
        mini.title = 'Open the full-world locator';
        const miniHint = el('div', { fontSize: '9.5px', color: DIM, marginTop: '3px',
                                     lineHeight: '1.35' },
                             'Click for the full-world map, or drag the survey map to pan.');

        side.append(
            head('View'),
            labelled('Resolution', inRes),
            labelled('Sun angle °', wrap(inLight, ltVal)),
            head('Sheet'),
            riversRow, riversNote,
            labelled('Feature labels', inLabels),
            labelled('Cartographic frame', inFrame),
            head('Location'),
            mini, miniHint,
            head('Sites'),
            siteRow,
        );

        // ── Globe inset ──
        const globe = document.createElement('canvas');
        let globePreview = null;

        // Equirectangular world image for a preview grid, cached ON the preview
        // object. previewColor() is a pure function of the height and a handful
        // of constants — ctx.oceanRng is a NUMBER, not a live generator — so the
        // same grid always paints the same pixels. Caching therefore cannot
        // drift, and it takes an 88,000-pixel colour loop off every sheet render.
        //
        // worldData is deliberately NOT passed to previewColor. This canvas is
        // what TerrainFrame.compose() bakes into the sheet as the globe inset,
        // so giving it the vegetated ramp would change every exported sheet.
        function previewCanvas(p) {
            if (p._canvas) return p._canvas;
            const cv = document.createElement('canvas');
            cv.width = p.W; cv.height = p.H;
            const img = new ImageData(p.W, p.H);
            const polar = TerrainRender.polarOverlay(worldType, worldData);
            for (let i = 0; i < p.height.length; i++) {
                const row = Math.floor(i / p.W);
                const latAbs = Math.abs(90 - ((row + 0.5) / p.H) * 180);
                const c = TerrainRender.previewColor(worldType, p.height[i],
                                                     seaLevel, atmCode, ctx.oceanRng,
                                                     polar, latAbs);
                const q = i * 4;
                img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2];
                img.data[q + 3] = 255;
            }
            cv.getContext('2d').putImageData(img, 0, 0);
            p._canvas = cv;
            return cv;
        }

        // Where the survey window lands on an equirectangular map, and how large
        // it reads there. Longitude compresses towards the poles, so the box
        // widens with latitude. Shared by the globe inset and the full-world
        // locator, so the two cannot disagree about where the window is; the
        // minimum sizes are a parameter because a legible floor on a 420 px
        // globe is an inflated box on a 1400 px map.
        function windowBox(latDeg, lonDeg, widthKm, W, H, minW, minH) {
            const latR = latDeg * Math.PI / 180;
            const halfW = (widthKm / 2) / planetRadiusKm;
            const halfH = (widthKm * (2 / 3) / 2) / planetRadiusKm;
            return {
                px: ((lonDeg * Math.PI / 180 + Math.PI) / (2 * Math.PI)) * W,
                py: ((Math.PI / 2 - latR) / Math.PI) * H,
                bw: Math.max(minW, (halfW * 2 / Math.max(0.02, Math.cos(latR)) / (2 * Math.PI)) * W),
                bh: Math.max(minH, (halfH * 2 / Math.PI) * H),
            };
        }

        function strokeWindow(g, b) {
            g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 3.5;
            g.strokeRect(b.px - b.bw / 2, b.py - b.bh / 2, b.bw, b.bh);
            g.strokeStyle = '#ff4040'; g.lineWidth = 1.8;
            g.strokeRect(b.px - b.bw / 2, b.py - b.bh / 2, b.bw, b.bh);
        }

        function drawGlobe(latDeg, lonDeg, widthKm) {
            const GW = 420, GH = 210;
            if (!globePreview) globePreview = TerrainField.buildGlobalPreview(ctx, GW, GH);
            globe.width = GW; globe.height = GH;
            const g = globe.getContext('2d');
            // The preview is built at exactly GW x GH, so this 1:1 blit is the
            // same pixels the old putImageData wrote.
            g.drawImage(previewCanvas(globePreview), 0, 0);
            strokeWindow(g, windowBox(latDeg, lonDeg, widthKm, GW, GH, 7, 5));

            const m = mini.getContext('2d');
            m.imageSmoothingEnabled = true;
            m.clearRect(0, 0, mini.width, mini.height);
            m.drawImage(globe, 0, 0, mini.width, mini.height);
        }

        // ── Sites ──
        let lat = 0, lon = 0;
        // Last list refreshSites() built, so the full-world locator can plot the
        // five slots without rebuilding the sidebar as a side effect.
        let lastSites = [];

        function refreshSites() {
            const count = 5;
            const derived = TerrainField.findSites(ctx, seaLevel, count);
            const merged = TerrainPins.mergeSites(derived, TerrainPins.load(pinKey), count, ms);
            siteRow.innerHTML = '';
            merged.forEach(s => {
                const r = el('div', {
                    display: 'flex', alignItems: 'center', gap: '4px', margin: '3px 0',
                    fontSize: '10px',
                    color: s.staleSeed ? AMBER : (s.pinned ? TEAL : DIM),
                });
                if (s.staleSeed) {
                    r.title = 'Pinned under master seed "' + s.seed + '", but this world is '
                            + 'now generated from "' + ms + '". The coordinates are intact; '
                            + 'the terrain under them has been rebuilt. Re-pin or delete it.';
                }
                r.appendChild(el('span', { width: '10px' }, String(s.slot + 1)));
                r.appendChild(el('span', { flex: '1', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                    (s.staleSeed ? '\u26a0 ' : (s.pinned ? '\u25c9 ' : '')) + s.label));
                if (!s.empty) r.appendChild(mkBtn('Go', () => {
                    lat = s.lat; lon = s.lon;
                    // A pin's stored widthKm is ignored now that the window is
                    // fixed; it stays in the record so older pins still load.
                    render(lat, lon, VIEW_WIDTH_KM);
                }));
                r.appendChild(mkBtn('Pin', () => {
                    const res = TerrainPins.setPin(pinKey, s.slot,
                        { lat, lon, widthKm: VIEW_WIDTH_KM, label: s.pinned ? s.label : bodyName + ' ' + (s.slot + 1) });
                    if (!res.ok) { alert(res.reason); return; }
                    refreshSites();
                }));
                if (s.pinned) r.appendChild(mkBtn('×', () => {
                    TerrainPins.clearPin(pinKey, s.slot); refreshSites();
                }));
                siteRow.appendChild(r);
            });
            lastSites = merged;
            return merged;
        }

        mini.addEventListener('click', () => openLocator());

        // ── Full-world locator ───────────────────────────────────────────────
        //
        // The same equirectangular map as the inset, opened at screen width so
        // a site can actually be aimed at. Click precision is a property of the
        // DISPLAY size, not of the backing grid, so the map opens immediately on
        // the 420x210 preview already in hand and sharpens behind the user —
        // the same "answer the mouse now, refine behind it" tiering the sheet
        // itself uses. A click picks and closes: one extra click, in exchange
        // for being able to see what is being picked.
        const LOCATOR_PREVIEW_W = 900;          // detail pass; 2:1, so 900 x 450
        let locatorPreview = null;

        function openLocator() {
            // 2:1 map, bounded by both axes so it never overflows a short window.
            const W = Math.round(Math.min(1400, window.innerWidth * 0.92,
                                          window.innerHeight * 0.74 * 2));
            const H = Math.round(W / 2);
            const kmPerPx = (2 * Math.PI * planetRadiusKm) / W;

            const sheet = el('div', {
                position: 'fixed', inset: '0', zIndex: '10001',
                background: 'rgba(2,6,10,0.94)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Share Tech Mono", "Courier New", monospace',
            });
            const box = el('div', {
                background: '#06090d', border: '1px solid ' + TEAL_DIM + '66',
                padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px',
            });
            const heading = el('div', {
                color: TEAL, fontSize: '12px', letterSpacing: '.08em',
                display: 'flex', justifyContent: 'space-between', gap: '16px',
            });
            const note = el('span', { color: TEAL_DIM, fontSize: '10.5px' }, '');
            heading.append(el('span', null, bodyName.toUpperCase() + ' — SELECT SURVEY LOCATION'),
                           note);

            const big = el('canvas', {
                display: 'block', cursor: 'crosshair', background: '#000',
                border: '1px solid ' + TEAL_DIM + '44',
                width: W + 'px', height: H + 'px',
            });
            big.width = W; big.height = H;

            const foot = el('div', {
                fontSize: '10.5px', color: DIM, display: 'flex',
                justifyContent: 'space-between', gap: '16px', alignItems: 'center',
            });
            const footL = el('span', null,
                'Click to place the ' + Math.round(VIEW_WIDTH_KM) + ' km survey window  ·  '
                + (kmPerPx < 10 ? kmPerPx.toFixed(1) : Math.round(kmPerPx)) + ' km/px');
            const readout = el('span', { color: TEAL, minWidth: '190px', textAlign: 'right' }, '');
            foot.append(footL, readout);

            // Everything except the crosshair is fixed for the life of this
            // modal — the window cannot move until a click closes it — so it is
            // composited once and the pointer only ever blits it back.
            let baseLayer = null;

            function buildBase() {
                baseLayer = document.createElement('canvas');
                baseLayer.width = W; baseLayer.height = H;
                const g = baseLayer.getContext('2d');
                g.imageSmoothingEnabled = true;
                g.drawImage(previewCanvas(locatorPreview || globePreview), 0, 0, W, H);

                g.lineWidth = 1;
                g.strokeStyle = 'rgba(255,255,255,0.12)';
                g.beginPath();
                for (let lo = -150; lo <= 150; lo += 30) {
                    const x = Math.round(((lo + 180) / 360) * W) + 0.5;
                    g.moveTo(x, 0); g.lineTo(x, H);
                }
                for (let la = -60; la <= 60; la += 30) {
                    const y = Math.round(((90 - la) / 180) * H) + 0.5;
                    g.moveTo(0, y); g.lineTo(W, y);
                }
                g.stroke();
                g.strokeStyle = 'rgba(255,255,255,0.26)';
                g.beginPath();
                g.moveTo(0, Math.round(H / 2) + 0.5); g.lineTo(W, Math.round(H / 2) + 0.5);
                g.moveTo(Math.round(W / 2) + 0.5, 0); g.lineTo(Math.round(W / 2) + 0.5, H);
                g.stroke();

                // The five site slots, so a pin is visible as a place rather
                // than only as a row in the sidebar.
                g.font = '11px "Share Tech Mono", "Courier New", monospace';
                g.textBaseline = 'middle';
                lastSites.forEach(s => {
                    if (s.empty) return;
                    const x = ((s.lon + 180) / 360) * W;
                    const y = ((90 - s.lat) / 180) * H;
                    const col = s.staleSeed ? AMBER : (s.pinned ? TEAL : INK);
                    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2);
                    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 3.5; g.stroke();
                    g.strokeStyle = col; g.lineWidth = 1.5; g.stroke();
                    if (s.pinned || s.staleSeed) {
                        g.fillStyle = col;
                        g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
                    }
                    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)';
                    g.strokeText(String(s.slot + 1), x + 9, y);
                    g.fillStyle = col;
                    g.fillText(String(s.slot + 1), x + 9, y);
                });

                // The window itself is only a few pixels across at this scale —
                // a 125 km box on a 29 km/px map is 4 px — so on its own it
                // reads as a sixth site marker rather than as "you are here".
                // Ticks radiating from it make it unmistakable without
                // overstating how much ground it covers.
                const b = windowBox(lat, lon, VIEW_WIDTH_KM, W, H, 6, 4);
                const gapX = b.bw / 2 + 4, gapY = b.bh / 2 + 4, arm = 11;
                for (const pass of [['rgba(0,0,0,0.65)', 3.5], ['#ff4040', 1.6]]) {
                    g.strokeStyle = pass[0]; g.lineWidth = pass[1];
                    g.beginPath();
                    g.moveTo(b.px - gapX, b.py); g.lineTo(b.px - gapX - arm, b.py);
                    g.moveTo(b.px + gapX, b.py); g.lineTo(b.px + gapX + arm, b.py);
                    g.moveTo(b.px, b.py - gapY); g.lineTo(b.px, b.py - gapY - arm);
                    g.moveTo(b.px, b.py + gapY); g.lineTo(b.px, b.py + gapY + arm);
                    g.stroke();
                }
                strokeWindow(g, b);
            }

            let hover = null;

            function paint() {
                const g = big.getContext('2d');
                g.clearRect(0, 0, W, H);
                g.drawImage(baseLayer, 0, 0);
                if (!hover) return;
                g.strokeStyle = 'rgba(102,252,241,0.6)'; g.lineWidth = 1;
                g.beginPath();
                g.moveTo(hover.x + 0.5, 0); g.lineTo(hover.x + 0.5, H);
                g.moveTo(0, hover.y + 0.5); g.lineTo(W, hover.y + 0.5);
                g.stroke();
            }

            // offsetX/clientWidth measure the padding box, which EXCLUDES the
            // border. getBoundingClientRect() includes it, which put the picked
            // point about a degree off from where the cursor actually was.
            function at(ev) {
                const cw = big.clientWidth || 1, ch = big.clientHeight || 1;
                const fx = ev.offsetX / cw, fy = ev.offsetY / ch;
                return {
                    x: fx * W, y: fy * H,
                    lon: Math.max(-180, Math.min(180, fx * 360 - 180)),
                    lat: Math.max(-90, Math.min(90, 90 - fy * 180)),
                };
            }

            big.addEventListener('pointermove', ev => {
                const p = at(ev);
                hover = { x: p.x, y: p.y };
                readout.textContent = fmtLat(p.lat) + '  ' + fmtLon(p.lon);
                paint();
            });
            big.addEventListener('pointerleave', () => {
                hover = null; readout.textContent = ''; paint();
            });
            big.addEventListener('click', ev => {
                const p = at(ev);
                close();
                render(p.lat, p.lon, VIEW_WIDTH_KM);
            });

            function close() {
                document.removeEventListener('keydown', onKey, true);
                sheet.remove();
            }
            function onKey(e) {
                if (e.key !== 'Escape') return;
                // Captured and stopped so it closes the locator and not the
                // panel underneath it, nor anything listening on the map.
                e.stopPropagation(); e.preventDefault();
                close();
            }
            document.addEventListener('keydown', onKey, true);
            sheet.addEventListener('click', e => { if (e.target === sheet) close(); });

            box.append(heading, big, foot, (() => {
                const row = el('div', { display: 'flex', gap: '8px', marginTop: '2px' });
                row.append(mkBtn('Cancel', close));
                return row;
            })());
            sheet.appendChild(box);
            document.body.appendChild(sheet);

            buildBase(); paint();

            // Detail pass. Held in the panel's closure, so reopening the locator
            // on the same body is instant. It is assigned BEFORE the connection
            // check so closing the modal mid-build keeps the work rather than
            // throwing it away.
            if (!locatorPreview) {
                note.textContent = 'sharpening…';
                setTimeout(() => {
                    if (!sheet.isConnected) return;
                    locatorPreview = TerrainField.buildGlobalPreview(
                        ctx, LOCATOR_PREVIEW_W, LOCATOR_PREVIEW_W / 2);
                    if (!sheet.isConnected) return;
                    note.textContent = '';
                    buildBase(); paint();
                }, 30);
            }
        }

        // ── Render + gestures ────────────────────────────────────────────────
        //
        // Three tiers, so the map answers the mouse immediately and sharpens up
        // behind it:
        //
        //   1. DURING a drag — the already-rendered plate is translated with
        //      drawImage. Zero computation, 60fps. This is only honest because
        //      the terrain is world-anchored: the shifted plate is the same
        //      ground, not a different landscape.
        //   2. ON SETTLE — a quick low-resolution pass (~360px) lands in a
        //      fraction of the time and is sharp enough to read.
        //   3. THEN the full-resolution pass, with labels and the frame, which
        //      are wasted work on any intermediate view.
        //
        // A generation counter guards against a slow pass landing after the user
        // has already moved on.

        let gen = 0;
        let committed = null;          // last real render + the geometry it used
        // Pan-only preview transform over that plate. `s` is held at 1 and
        // nothing ever changes it; it is retained so the drawImage path and
        // viewToWindow keep their scale-aware form rather than growing a
        // second, subtly different set of coordinate maths.
        let view = { s: 1, ox: 0, oy: 0 };
        let settleTimer = null;

        function mapRect() {
            if (!committed) return { x: 0, y: 0, w: canvas.width, h: canvas.height };
            return inFrame.checked
                ? { x: TerrainFrame.PAD_X, y: TerrainFrame.PAD_Y,
                    w: committed.plate.width, h: committed.plate.height }
                : { x: 0, y: 0, w: committed.plate.width, h: committed.plate.height };
        }

        // Repaint only the map area with the transformed plate, leaving the
        // sidebar and graticule gutters untouched.
        function paintPreview() {
            if (!committed) return;
            const r = mapRect();
            const g = canvas.getContext('2d');
            g.save();
            g.beginPath();
            g.rect(r.x, r.y, r.w, r.h);
            g.clip();
            g.fillStyle = TerrainFrame.THEME.sheet;
            g.fillRect(r.x, r.y, r.w, r.h);
            g.translate(r.x, r.y);
            g.imageSmoothingEnabled = true;
            g.setTransform(view.s, 0, 0, view.s,
                           r.x + view.ox, r.y + view.oy);
            g.drawImage(committed.plate, 0, 0);
            g.restore();
        }

        // Turn the accumulated preview transform into a real window.
        function viewToWindow() {
            const c = committed;
            const widthKm = VIEW_WIDTH_KM;          // fixed — panning only
            // Plate pixel currently sitting at the centre of the map area.
            const px = (c.plate.width  / 2 - view.ox) / view.s;
            const py = (c.plate.height / 2 - view.oy) / view.s;
            const ll = TerrainField.projector(c.f).toLatLon(
                px * c.f.W / c.plate.width, py * c.f.H / c.plate.height);
            return {
                lat: Math.max(-90, Math.min(90, ll.latDeg)),
                lon: ((ll.lonDeg + 540) % 360) - 180,
                widthKm,
            };
        }

        // One real render. `quick` trades resolution for latency. The pipeline
        // itself lives in TerrainFrame.renderSheet() so the exporters draw the
        // identical sheet — see the note there.
        function renderPass(latD, lonD, widthKm, quick, myGen) {
            const W = quick ? 360 : +inRes.value;
            const H = Math.round(W * 2 / 3);
            const t0 = performance.now();

            const r = TerrainFrame.renderSheet({
                ctx, worldData, worldType, atmCode, seaLevel,
                planetRadiusKm, planetReliefM: PLANET_RELIEF_M,
                latDeg: latD, lonDeg: lonD, widthKm, W, H,
                localReliefM: reliefM(), landformKm: LANDFORM_KM,
                lightAltDeg: +inLight.value,
                hydrology: !quick && inRivers.checked &&
                           (window.terrainFieldVersion || 1) >= 2 && hydro >= 1,
                labels: !quick && inLabels.checked,
                masterSeed: ms, hexId: seed, bodyName,
                abort: () => myGen !== gen,
            });
            if (!r) return null;

            return { plate: r.plate, f: r.f, out: r.out,
                     lat: latD, lon: lonD, widthKm,
                     ms: performance.now() - t0, quick };
        }

        function paintResult(r) {
            drawGlobe(r.lat, r.lon, r.widthKm);
            if (inFrame.checked && !r.quick) {
                TerrainFrame.compose(canvas, {
                    mapCanvas: r.plate, field: r.f, legend: r.out.legend,
                    worldType, worldData: {
                        uwp: worldData.uwp || '',
                        diameterKm: planetRadiusKm * 2,
                        temperatureK: worldData.temperatureK,
                    },
                    title: bodyName,
                    subtitle: r.widthKm <= 60 ? 'Site Survey' : 'Regional Survey',
                    globeCanvas: globe,
                    office: (window.sectorName || 'Sector') + ' Survey Office',
                    surveyId: TerrainFrame.surveyId(hexLabel, bodyName, r.lat, r.lon, r.widthKm),
                    date: new Date().toISOString().slice(0, 10),
                });
            } else {
                // Quick pass (or frame off): keep the sheet's footprint so the
                // canvas does not jump size between tiers.
                const target = committed && inFrame.checked
                    ? { w: canvas.width, h: canvas.height }
                    : { w: r.plate.width, h: r.plate.height };
                if (!inFrame.checked) { canvas.width = target.w; canvas.height = target.h; }
                const g = canvas.getContext('2d');
                const rect = inFrame.checked
                    ? { x: TerrainFrame.PAD_X, y: TerrainFrame.PAD_Y,
                        w: canvas.width - TerrainFrame.PAD_X * 2 - TerrainFrame.SIDEBAR,
                        h: canvas.height - TerrainFrame.PAD_Y * 2 }
                    : { x: 0, y: 0, w: canvas.width, h: canvas.height };
                g.save();
                g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
                g.imageSmoothingEnabled = true;
                g.drawImage(r.plate, rect.x, rect.y, rect.w, rect.h);
                g.restore();
            }
            committed = r;
            view = { s: 1, ox: 0, oy: 0 };
            lat = r.lat; lon = r.lon;
            status.textContent =
                `${r.lat.toFixed(2)}°, ${r.lon.toFixed(2)}°  ·  ${Math.round(r.widthKm)} km  ·  ` +
                `${Math.round(r.f.metresPerPx)} m/px  ·  ${(r.ms / 1000).toFixed(2)} s` +
                (r.quick ? '  ·  refining…' : '');
        }

        // Full re-render at an explicit window (site buttons, sliders, minimap).
        function render(latD, lonD, widthKm) {
            const myGen = ++gen;
            const la = (latD !== undefined) ? latD : lat;
            const lo = (lonD !== undefined) ? lonD : lon;
            const wk = widthKm || VIEW_WIDTH_KM;
            status.textContent = 'Rendering…';
            setTimeout(() => {
                if (myGen !== gen) return;
                const r = renderPass(la, lo, wk, false, myGen);
                if (r && myGen === gen) paintResult(r);
            }, 20);
        }

        // Commit a gesture: quick pass now, full pass right behind it.
        function commitView() {
            if (!committed) return;
            const w = viewToWindow();
            const myGen = ++gen;
            setTimeout(() => {
                if (myGen !== gen) return;
                const q = renderPass(w.lat, w.lon, w.widthKm, true, myGen);
                if (q && myGen === gen) paintResult(q);
                setTimeout(() => {
                    if (myGen !== gen) return;
                    const f = renderPass(w.lat, w.lon, w.widthKm, false, myGen);
                    if (f && myGen === gen) paintResult(f);
                }, 15);
            }, 10);
        }

        function scheduleSettle(ms) {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(commitView, ms === undefined ? 220 : ms);
        }

        // ── Mouse ──
        // Drag pans. There is deliberately no wheel zoom — the window is fixed
        // at the world's own scale.

        function localPoint(ev) {
            const b = canvas.getBoundingClientRect();
            const sx = canvas.width / b.width, sy = canvas.height / b.height;
            const r = mapRect();
            return { x: (ev.clientX - b.left) * sx - r.x,
                     y: (ev.clientY - b.top) * sy - r.y, rect: r };
        }

        function insideMap(pt) {
            return pt.x >= 0 && pt.y >= 0 && pt.x <= pt.rect.w && pt.y <= pt.rect.h;
        }

        canvas.style.cursor = 'grab';

        let dragging = false, dragFrom = null;
        canvas.addEventListener('pointerdown', ev => {
            if (!committed) return;
            const pt = localPoint(ev);
            if (!insideMap(pt)) return;
            dragging = true;
            dragFrom = { x: pt.x, y: pt.y, ox: view.ox, oy: view.oy };
            canvas.setPointerCapture(ev.pointerId);
            canvas.style.cursor = 'grabbing';
            clearTimeout(settleTimer);
        });
        canvas.addEventListener('pointermove', ev => {
            if (!dragging) return;
            const pt = localPoint(ev);
            view.ox = dragFrom.ox + (pt.x - dragFrom.x);
            view.oy = dragFrom.oy + (pt.y - dragFrom.y);
            paintPreview();
        });
        const endDrag = ev => {
            if (!dragging) return;
            dragging = false;
            canvas.style.cursor = 'grab';
            try { canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
            scheduleSettle(0);
        };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);



        // ── Buttons ──
        const dlBtn = mkBtn('Download PNG', () => {
            const a = document.createElement('a');
            a.download = `${bodyName.replace(/\s+/g, '_')}_${lat.toFixed(1)}_${lon.toFixed(1)}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        });
        const renderBtn = mkBtn('Render', () => render(), true);
        const closeBtn = mkBtn('Close', () => overlay.remove());
        const btnRow = el('div', { display: 'flex', gap: '8px', marginTop: '10px' });
        btnRow.append(renderBtn, dlBtn, closeBtn);
        side.appendChild(btnRow);

        [inRes, inLight].forEach(i => i.addEventListener('change', () => render()));
        [inLabels, inFrame, inRivers].forEach(i => i.addEventListener('change', () => render()));

        left.append(title, canvas, status);
        panel.append(left, side);
        overlay.appendChild(panel);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

        const sites = refreshSites();
        const first = sites.find(s => !s.empty);
        if (first) { lat = first.lat; lon = first.lon; }
        render();
    }

    return { open };
})();

window.TerrainPanel = TerrainPanel;
