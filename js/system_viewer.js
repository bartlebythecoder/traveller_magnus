// =============================================================================
// SYSTEM_VIEWER.JS  —  Dev-only Orrery Overlay
// Triggered when devView=true and user scrolls past max map zoom.
// Supports MgT2E, CT, and T5 systems via normalisation.
// Exposes window.SystemViewer  { open, close, isOpen, handleWheel }
//
// Zoom model: SEMANTIC ZOOM — orbital radii scale with _viewZoom,
// but star/planet body sizes stay constant in screen pixels.
// =============================================================================

'use strict';

const SystemViewer = (() => {

    // ── State ─────────────────────────────────────────────────────────────────
    let _overlay   = null;
    let _orrCanvas = null;
    let _orrCtx    = null;
    let _sys       = null;   // normalised system object
    let _tooltip   = null;
    let _hitBodies = [];

    let _canvasW = 0;
    let _canvasH = 0;

    let _viewZoom = 1.0;
    let _viewOffX = 0;
    let _viewOffY = 0;

    let _dragging = false;
    let _dragLast = null;

    // ── Fallback orbit→AU table ───────────────────────────────────────────────
    const _FALLBACK_ORBIT_AU = [
        0, 0.2, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10.0, 20.0, 40.0, 77.0, 154.0, 308.0
    ];

    // ── Spectral type colours ─────────────────────────────────────────────────
    const _STAR_COLORS = {
        O: '#9bb0ff', B: '#aabfff', A: '#cad7ff',
        F: '#f8f7ff', G: '#fff4ea', K: '#ffd2a1',
        M: '#ffcc6f', D: '#dce0ff', BD: '#a56432'
    };

    // ── Fixed body sizes (never scale with zoom) ──────────────────────────────

    function _starBodyRadius(s) {
        const cls = s.sClass || 'V';
        if (cls === 'Ia' || cls === 'Ib') return 28;
        if (cls === 'II' || cls === 'III') return 22;
        if (cls === 'IV') return 16;
        if (s.sType === 'BD') return 6;
        if (s.sType === 'D')  return 5;
        if (s.sType === 'M')  return 8;
        if (s.sType === 'K')  return 10;
        return 14;
    }

    function _worldBodyRadius(w) {
        if (w.type === 'Gas Giant') {
            if (w.ggType === 'GL') return 14;
            if (w.ggType === 'GM') return 10;
            return 8;
        }
        if (w.type === 'Mainworld') return 8;
        return 5;
    }

    // ── Colour helpers ────────────────────────────────────────────────────────

    function _starColor(s) { return _STAR_COLORS[s.sType] || '#ffffff'; }

    function _worldColor(w) {
        if (w.type === 'Gas Giant') {
            if (w.ggType === 'GL') return '#c8a97a';
            if (w.ggType === 'GM') return '#d4b98a';
            return '#e0cc9a';
        }
        if (w.type === 'Mainworld')      return '#4fc3a1';
        if (w.type === 'Planetoid Belt') return '#888888';
        return '#a0a0b0';
    }

    // ── Orbit / AU helpers ────────────────────────────────────────────────────

    function _orbitToAU(orbitId) {
        const tbl = (window.MgT2EData && window.MgT2EData.stellar && window.MgT2EData.stellar.orbitAu)
                    || _FALLBACK_ORBIT_AU;
        const idx  = Math.floor(orbitId);
        const frac = orbitId - idx;
        const max  = tbl.length - 1;
        const lo   = tbl[Math.min(idx, max)];
        const hi   = idx < max ? tbl[idx + 1] : lo;
        return lo + frac * (hi - lo);
    }

    // Returns the AU distance of a companion star, supporting normalised orbitAU
    // (set by CT/T5 normalisers) or falling back to _orbitToAU(s.orbitId).
    function _starCompanionAU(s) {
        return (s.orbitAU !== undefined && s.orbitAU !== null)
            ? s.orbitAU
            : _orbitToAU(s.orbitId || 0.5);
    }

    function _logR(au, maxAU, maxPx) {
        if (au <= 0 || maxAU <= 0 || maxPx <= 0) return 0;
        return maxPx * Math.log(1 + au) / Math.log(1 + maxAU);
    }

    // ── System normalisation ──────────────────────────────────────────────────
    // Each normaliser returns a common object:
    // {
    //   edition: string,
    //   age: number,
    //   hzAU: number,          ← HZ centre in AU (used directly, bypasses hzco)
    //   stars: [{
    //     name, sType, sClass, subType, mass, diam, temp, lum,
    //     role, separation, orbitId, orbitAU  ← orbitAU: AU from primary (companions)
    //   }],
    //   worlds: [{
    //     type, ggType, au, parentStarIdx, orbitType, eccentricity,
    //     mass, diamKm, gravity, meanTempK,
    //     moons: [{type, name, uwp, starport, tl, tradeCodes, travelZone,
    //              diamKm, mass, gravity, meanTempK, size, pd}],
    //     uwp, name, starport, tl, tradeCodes, travelZone, orbitId
    //   }]
    // }

    function _detectSystem(state) {
        if (state.mgtSystem && state.mgtSystem.stars && state.mgtSystem.stars.length > 0)
            return { raw: state.mgtSystem, edition: 'MgT2E' };
        if (state.ctSystem  && state.ctSystem.stars  && state.ctSystem.stars.length  > 0)
            return { raw: state.ctSystem,  edition: 'CT'    };
        if (state.t5System  && state.t5System.stars  && state.t5System.stars.length  > 0)
            return { raw: state.t5System,  edition: 'T5'    };
        if (state.rttSystem && state.rttSystem.stars && state.rttSystem.stars.length > 0)
            return { raw: state.rttSystem, edition: 'RTT'   };
        return null;
    }

    // MgT2E: normalise worlds to handle both current and older JSON save formats.
    // Older saves may be missing orbitType, parentStarIdx, and use type:'Planet'.
    function _normalizeMgT2E(sys) {
        const hzAU = _orbitToAU(sys.hzco || 3);
        const mw   = sys.mainworld;
        const worlds = (sys.worlds || []).map(w => {
            const isMainworld = _isSameWorld(w, mw) || w.type === 'Mainworld';
            let type = isMainworld ? 'Mainworld' : w.type;
            if (type === 'Planet') type = 'Terrestrial Planet';
            return Object.assign({}, w, {
                type,
                orbitType:     w.orbitType     || 'S-Type',
                parentStarIdx: w.parentStarIdx ?? 0,
                travelZone:    w.travelZone    || w.travelCode || 'G',
            });
        });
        return Object.assign({}, sys, { edition: 'MgT2E', hzAU, worlds });
    }

    // Shared moon normaliser for CT and T5 (both use world.satellites[]).
    function _normMoon(m, mainworldRef) {
        const isMainworld = _isSameWorld(m, mainworldRef);
        return {
            type:        isMainworld ? 'Mainworld' : (m.type || 'Satellite'),
            name:        m.name       || null,
            uwp:         m.uwp        || null,
            starport:    m.starport   || null,
            tl:          m.tl         ?? null,
            tradeCodes:  m.tradeCodes || [],
            travelZone:  m.travelZone || m.zone || 'G',
            diamKm:      m.diamKm     || null,
            mass:        m.mass       || null,
            gravity:     m.gravity    || null,
            meanTempK:   m.meanTempK  || null,
            size:        m.size       ?? null,
            pd:          m.pd         || null,
        };
    }

    function _isSameWorld(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        return a.uwp && b.uwp && a.uwp === b.uwp && a.name === b.name;
    }

    // ── CT normaliser ─────────────────────────────────────────────────────────

    function _normalizeCT(sys) {
        const mw = sys.mainworld;

        // Stars
        const stars = (sys.stars || []).map((s, i) => {
            // CT companion orbit may be 'Close', 'Far', or a number
            let orbitAU = null;
            if (i > 0) {
                if (typeof s.orbit === 'number') orbitAU = _orbitToAU(s.orbit);
                else if (s.distAU)               orbitAU = s.distAU;
                else if (s.orbit === 'Close')     orbitAU = 0.05;
                else                              orbitAU = 10;
            }
            return {
                name:       s.name || `${s.type}${s.decimal ?? ''} ${s.size}`,
                sType:      s.type  || 'G',
                sClass:     s.size  || 'V',
                subType:    s.decimal ?? 5,
                mass:       s.mass        || 1,
                diam:       s.diam        || 1,
                temp:       null,
                lum:        s.luminosity  || 1,
                role:       s.role || (i === 0 ? 'Primary' : 'Companion'),
                separation: i > 0 ? (typeof s.orbit === 'string' ? s.orbit : null) : null,
                orbitId:    typeof s.orbit === 'number' ? s.orbit : null,
                orbitAU,
            };
        });

        // Worlds — flattened from sys.orbits[]
        const worlds = [];
        (sys.orbits || []).forEach(slot => {
            const w = slot.contents;
            if (!w || w.type === 'Empty') return;
            worlds.push(_normCTWorld(w, slot.distAU || 0, mw));
        });
        // Captured planets (anomalies)
        (sys.capturedPlanets || []).forEach(w => {
            if (w && w.type !== 'Empty') worlds.push(_normCTWorld(w, w.distAU || 0, mw));
        });

        // HZ centre: use mainworld distAU, or first H-zone slot
        let hzAU = mw && mw.distAU ? mw.distAU : null;
        if (!hzAU) {
            const hSlot = (sys.orbits || []).find(o => o.zone === 'H');
            hzAU = hSlot ? (hSlot.distAU || 1.0) : 1.0;
        }

        return { edition: 'CT', age: sys.age || 0, hzAU, stars, worlds };
    }

    function _normCTWorld(w, au, mainworldRef) {
        const isMainworld = _isSameWorld(w, mainworldRef) || w.type === 'Mainworld';
        let type  = isMainworld ? 'Mainworld' : (w.type || 'Terrestrial Planet');
        let ggType = null;
        if (w.type === 'Gas Giant') {
            type   = 'Gas Giant';
            ggType = (w.size === 'S') ? 'GS' : 'GL';
        }
        return {
            type, ggType,
            au:            au || w.distAU || 0,
            parentStarIdx: 0,
            orbitType:     'S-Type',
            eccentricity:  0,
            mass:          w.mass     || null,
            diamKm:        w.diamKm   || null,
            gravity:       w.gravity  || null,
            meanTempK:     w.meanTempK|| null,
            moons:         (w.satellites || []).map(m => _normMoon(m, mainworldRef)),
            uwp:           w.uwp      || null,
            name:          w.name     || null,
            starport:      w.starport || null,
            tl:            w.tl       ?? null,
            tradeCodes:    w.tradeCodes || [],
            travelZone:    w.travelZone || w.zone || 'G',
            orbitId:       w.orbit    ?? null,
        };
    }

    // ── T5 normaliser ─────────────────────────────────────────────────────────

    function _normalizeT5(sys) {
        const mw = sys.mainworld;

        // Stars
        const stars = (sys.stars || []).map((s, i) => ({
            name:       s.name || `${s.type}${s.decimal ?? ''} ${s.size}`,
            sType:      s.type  || 'G',
            sClass:     s.size  || 'V',
            subType:    s.decimal ?? 5,
            mass:       s.mass        || 1,
            diam:       s.diam        || 1,
            temp:       null,
            lum:        s.luminosity  || 1,
            role:       s.role || (i === 0 ? 'Primary' : 'Companion'),
            separation: i > 0 ? (s.role || null) : null,
            orbitId:    s.orbitID     || null,
            orbitAU:    i > 0 ? (s.distAU || null) : null,
        }));

        // Worlds — per-star orbital arrays
        const worlds = [];
        (sys.stars || []).forEach((s, si) => {
            (s.orbits || []).forEach(slot => {
                const w = slot.contents;
                if (!w || w.type === 'Empty') return;
                worlds.push(_normT5World(w, slot.distAU || 0, si, mw));
            });
        });

        // HZ centre: mainworld distAU
        const hzAU = (mw && mw.distAU) ? mw.distAU : 1.0;

        return { edition: 'T5', age: sys.age || 0, hzAU, stars, worlds };
    }

    function _normT5World(w, au, parentStarIdx, mainworldRef) {
        const isMainworld = _isSameWorld(w, mainworldRef);
        let type  = 'Terrestrial Planet';
        let ggType = null;
        if (isMainworld) {
            type = 'Mainworld';
        } else if (w.type === 'Gas Giant') {
            type = 'Gas Giant'; ggType = 'GM';
        } else if (w.type === 'Ice Giant') {
            type = 'Gas Giant'; ggType = 'GS';
        } else if (w.type === 'Planetoid Belt') {
            type = 'Planetoid Belt';
        }
        return {
            type, ggType,
            au:            au || w.distAU || 0,
            parentStarIdx,
            orbitType:     'S-Type',
            eccentricity:  0,
            mass:          w.mass      || null,
            diamKm:        w.diamKm    || null,
            gravity:       w.gravity   || null,
            meanTempK:     w.meanTempK || null,
            moons:         (w.satellites || []).map(m => _normMoon(m, mainworldRef)),
            uwp:           w.uwp       || null,
            name:          w.name      || null,
            starport:      w.starport  || null,
            tl:            w.tl        ?? null,
            tradeCodes:    w.tradeCodes || [],
            travelZone:    w.travelZone || 'G',
            orbitId:       null,
        };
    }

    // ── RTT normaliser ────────────────────────────────────────────────────────
    // RTT stores worlds per-star under star.planetarySystem.orbits[].
    // No AU distances — synthesised from zone (Epistellar/Inner/Outer) + orbit index.

    // Approximate AU per zone index (0-based within zone)
    const _RTT_ZONE_AU = {
        Epistellar: { base: 0.10, step: 0.10 },
        Inner:      { base: 0.50, step: 0.70 },
        Outer:      { base: 5.00, step: 8.00 },
    };

    // Companion separation label → approximate AU
    const _RTT_COMPANION_AU = { Tight: 0.05, Close: 0.5, Moderate: 5, Distant: 60 };

    function _normalizeRTT(sys) {
        const stars = (sys.stars || []).map((s, i) => {
            // RTT uses type:'L' for brown dwarfs; luminosityClass:'D' for white dwarfs
            let sType  = s.type || 'G';
            if (sType === 'L')                sType = 'BD';
            else if (s.luminosityClass === 'D') sType = 'D';

            const sClass  = (s.luminosityClass === 've' || s.luminosityClass === 'Ve') ? 'V' : (s.luminosityClass || 'V');
            const orbitAU = i > 0 ? (_RTT_COMPANION_AU[s.orbitType] ?? 5) : null;

            return {
                name:       s.classification || `${s.type}-${s.luminosityClass}`,
                sType, sClass,
                subType:    5,
                mass:       s.mass || 1,
                diam:       s.diam || 1,
                temp:       null,
                lum:        s.lum  || 1,
                role:       s.role || (i === 0 ? 'Primary' : 'Companion'),
                separation: i > 0 ? (s.orbitType || null) : null,
                orbitId:    null,
                orbitAU,
            };
        });

        const worlds = [];
        (sys.stars || []).forEach((s, si) => {
            if (!s.planetarySystem) return;
            const zoneCounts = {};
            const sorted = [...(s.planetarySystem.orbits || [])].sort((a, b) => (a.orbitNumber || 0) - (b.orbitNumber || 0));
            sorted.forEach(body => {
                const zone    = body.zone || 'Inner';
                const idx     = zoneCounts[zone] = (zoneCounts[zone] || 0);
                zoneCounts[zone]++;
                const z       = _RTT_ZONE_AU[zone] || _RTT_ZONE_AU.Inner;
                const au      = z.base + idx * z.step;
                worlds.push(_normRTTWorld(body, au, si));
            });
        });

        const mw   = worlds.find(w => w.type === 'Mainworld');
        const hzAU = mw ? mw.au : 1.0;
        return { edition: 'RTT', age: sys.age || 0, hzAU, stars, worlds };
    }

    function _normRTTWorld(body, au, parentStarIdx) {
        const isMainworld = body.isMainworld === true;
        let type   = 'Terrestrial Planet';
        let ggType = null;

        if (isMainworld) {
            type = 'Mainworld';
        } else if (body.type === 'Jovian Planet' || body.worldClass === 'Jovian' || body.worldClass === 'Chthonian') {
            type = 'Gas Giant'; ggType = 'GL';
        } else if (body.type === 'Helian Planet') {
            type = 'Gas Giant'; ggType = 'GS';
        } else if (body.type === 'Asteroid Belt') {
            type = 'Planetoid Belt';
        }

        // Build a compact UWP string if the body has social data
        let uwp = null;
        const _eh = (v) => (typeof window.getEHexLetter === 'function') ? window.getEHexLetter(v || 0) : String(v || 0);
        if (body.starport && body.population != null) {
            const sz = (typeof body.size === 'number') ? _eh(body.size) : (body.size || '0');
            uwp = `${body.starport}${sz}${_eh(body.atmosphere)}${_eh(body.hydrosphere)}` +
                  `${_eh(body.population)}${_eh(body.government)}${_eh(body.lawLevel)}-${_eh(body.tl)}`;
        }

        const moons = (body.satellites || []).map(m => ({
            type:       m.isMainworld ? 'Mainworld' : 'Satellite',
            name:       m.name       || null,
            uwp:        null,
            starport:   m.starport   || null,
            tl:         m.tl         ?? null,
            tradeCodes: m.tradeCodes || [],
            travelZone: 'G',
            diamKm:     m.diamKm     || null,
            mass:       null,
            gravity:    m.gravity    || null,
            meanTempK:  m.meanTempK  || null,
            size:       (typeof m.size === 'number') ? m.size : null,
            pd:         null,
        }));

        return {
            type, ggType, au, parentStarIdx,
            orbitType:    'S-Type',
            eccentricity: 0,
            mass:         null,
            diamKm:       body.diamKm    || null,
            gravity:      body.gravity   || null,
            meanTempK:    body.meanTempK || null,
            moons,
            uwp,
            name:         body.name      || null,
            starport:     body.starport  || null,
            tl:           body.tl        ?? null,
            tradeCodes:   body.tradeCodes || [],
            travelZone:   (body.bases || []).includes('Z') ? 'Red' : 'G',
            orbitId:      null,
        };
    }

    // ── Centre-hex detection ──────────────────────────────────────────────────

    function _centerHexId() {
        const cx = cameraX + (window.innerWidth  / 2) / zoom;
        const cy = cameraY + (window.innerHeight / 2) / zoom;
        const coords = pixelToHex(cx, cy, baseHexSize);
        return getHexId(coords.q, coords.r);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    function isOpen() { return _overlay !== null; }

    function open() {
        const hexId = _centerHexId();
        if (!hexId) return;
        const state = hexStates.get(hexId);
        if (!state) return;

        const found = _detectSystem(state);
        if (!found) return;  // no system expansion — silently do nothing

        let normalised;
        if      (found.edition === 'MgT2E') normalised = _normalizeMgT2E(found.raw);
        else if (found.edition === 'CT')    normalised = _normalizeCT(found.raw);
        else if (found.edition === 'T5')    normalised = _normalizeT5(found.raw);
        else                                normalised = _normalizeRTT(found.raw);

        _sys      = normalised;
        _viewZoom = 1.0;
        _viewOffX = 0;
        _viewOffY = 0;
        _buildOverlay(hexId);
        requestAnimationFrame(_drawOrrery);
    }

    function close() {
        if (!_overlay) return;
        window.removeEventListener('mousemove', _onWindowMouseMove);
        window.removeEventListener('mouseup',   _onWindowMouseUp);
        _overlay.remove();
        _overlay   = null;
        _orrCanvas = null;
        _orrCtx    = null;
        _sys       = null;
        _tooltip   = null;
        _hitBodies = [];
        _canvasW   = 0;
        _canvasH   = 0;
        _viewZoom  = 1.0;
        _viewOffX  = 0;
        _viewOffY  = 0;
        _dragging  = false;
        _dragLast  = null;
    }

    function handleWheel(direction) {
        if (direction < 0 && _viewZoom <= 1.0) close();
    }

    // ── DOM Construction ──────────────────────────────────────────────────────

    function _buildOverlay(hexId) {
        const sys      = _sys;
        const starLine = sys.stars.map(s => s.name).join(' / ');
        const age      = (sys.age || 0).toFixed(2);
        const edition  = sys.edition || '';

        _overlay = document.createElement('div');
        _overlay.id = 'system-viewer-overlay';
        Object.assign(_overlay.style, {
            position: 'fixed', inset: '0', zIndex: '9000',
            background: 'rgba(10,14,20,0.97)',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
            color: '#c5c6c7', userSelect: 'none'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '8px 18px', flexShrink: '0',
            borderBottom: '1px solid #45a29e55'
        });

        const title = document.createElement('span');
        Object.assign(title.style, { color: '#66fcf1', fontSize: '15px', fontWeight: 'bold' });
        title.textContent = `SYSTEM  ${hexId}`;

        const editionBadge = document.createElement('span');
        Object.assign(editionBadge.style, {
            fontSize: '10px', color: '#45a29e',
            border: '1px solid #45a29e55', padding: '1px 6px'
        });
        editionBadge.textContent = edition;

        const sub = document.createElement('span');
        Object.assign(sub.style, { fontSize: '12px', color: '#8a8f94' });
        sub.textContent = `${starLine}   ·   Age ${age} Gyr`;

        const hint = document.createElement('span');
        Object.assign(hint.style, {
            fontSize: '11px', color: '#55686b',
            marginLeft: 'auto', marginRight: '12px'
        });
        hint.textContent = 'Scroll to zoom orbits  ·  Drag to pan  ·  Scroll out at full view or ESC to return';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: '1px solid #45a29e',
            color: '#66fcf1', padding: '3px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px'
        });
        closeBtn.addEventListener('click', close);

        header.append(title, editionBadge, sub, hint, closeBtn);
        _overlay.appendChild(header);

        _orrCanvas = document.createElement('canvas');
        Object.assign(_orrCanvas.style, { display: 'block', cursor: 'crosshair' });
        _overlay.appendChild(_orrCanvas);

        _tooltip = document.createElement('div');
        Object.assign(_tooltip.style, {
            position: 'fixed', display: 'none', pointerEvents: 'none',
            background: 'rgba(10,14,20,0.95)', border: '1px solid #45a29e',
            padding: '8px 12px', fontSize: '12px', lineHeight: '1.65',
            maxWidth: '280px', zIndex: '9100', fontFamily: 'inherit'
        });
        _overlay.appendChild(_tooltip);

        document.body.appendChild(_overlay);

        const headerH = header.getBoundingClientRect().height || 44;
        _canvasW = window.innerWidth;
        _canvasH = window.innerHeight - headerH;
        _orrCanvas.style.width  = _canvasW + 'px';
        _orrCanvas.style.height = _canvasH + 'px';

        const dpr = window.devicePixelRatio || 1;
        _orrCanvas.width  = Math.round(_canvasW * dpr);
        _orrCanvas.height = Math.round(_canvasH * dpr);
        _orrCtx = _orrCanvas.getContext('2d');
        _orrCtx.scale(dpr, dpr);

        _orrCanvas.addEventListener('wheel',      _onWheel,     { passive: false });
        _orrCanvas.addEventListener('mousedown',  _onMouseDown);
        _orrCanvas.addEventListener('mousemove',  _onMouseMove);
        _orrCanvas.addEventListener('mouseleave', _hideTooltip);
        window.addEventListener('mousemove', _onWindowMouseMove);
        window.addEventListener('mouseup',   _onWindowMouseUp);
    }

    // ── Orrery Draw ───────────────────────────────────────────────────────────

    function _redraw() { requestAnimationFrame(_drawOrrery); }

    function _drawOrrery() {
        if (!_orrCtx || !_canvasW || !_canvasH) return;
        const W   = _canvasW;
        const H   = _canvasH;
        const ctx = _orrCtx;

        ctx.clearRect(0, 0, W, H);
        _hitBodies = [];

        const sys    = _sys;
        const stars  = sys.stars || [];
        const worlds = (sys.worlds || []).filter(w => w.type !== 'Empty');

        // Max AU in system → calibrate base log scale
        let maxAU = 1;
        worlds.forEach(w => { if ((w.au || 0) > maxAU) maxAU = w.au; });
        stars.slice(1).forEach(s => {
            const au = _starCompanionAU(s);
            if (au > maxAU) maxAU = au;
        });
        maxAU = Math.max(maxAU * 1.18, 2);

        const margin     = 70;
        const baseMaxR   = Math.min(W, H) / 2 - margin;
        const scaledMaxR = baseMaxR * _viewZoom;

        const originX = W / 2 + _viewOffX;
        const originY = H / 2 + _viewOffY;

        // Companion star screen positions
        const companions = stars.slice(1);
        const starPos    = new Map();
        starPos.set(0, { cx: originX, cy: originY });

        const FAN = [0, -Math.PI / 7, Math.PI / 7, -Math.PI / 3.5, Math.PI / 3.5];
        companions.forEach((s, i) => {
            const compAU = _starCompanionAU(s);
            const dist   = Math.max(90, _logR(compAU, maxAU, scaledMaxR));
            const angle  = FAN[i % FAN.length];
            starPos.set(i + 1, {
                cx: originX + dist * Math.cos(angle),
                cy: originY + dist * Math.sin(angle)
            });
        });

        _drawStarField(ctx, W, H);

        // HZ band — hzAU is set by the normaliser for all editions
        const hzAU      = sys.hzAU !== undefined ? sys.hzAU : _orbitToAU(sys.hzco || 3);
        const hzInnerPx = _logR(hzAU * 0.70, maxAU, scaledMaxR);
        const hzOuterPx = _logR(hzAU * 1.55, maxAU, scaledMaxR);
        _drawHZBand(ctx, originX, originY, hzInnerPx, hzOuterPx);

        // Companion orbit rings + sub-orreries
        companions.forEach((s, i) => {
            const sIdx   = i + 1;
            const pos    = starPos.get(sIdx);
            const compAU = _starCompanionAU(s);
            const orbitR = Math.max(90, _logR(compAU, maxAU, scaledMaxR));

            ctx.beginPath();
            ctx.arc(originX, originY, orbitR, 0, Math.PI * 2);
            ctx.strokeStyle = '#45a29e28';
            ctx.lineWidth   = 1;
            ctx.setLineDash([4, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            const sWorlds = worlds.filter(
                w => w.orbitType === 'S-Type' && w.parentStarIdx === sIdx
            );
            if (sWorlds.length > 0) {
                const subMaxAU = sWorlds.reduce((m, w) => Math.max(m, w.au || 0), 0.01) * 1.2;
                const subMaxR  = orbitR * 0.28;
                _drawWorldSet(ctx, sWorlds, pos.cx, pos.cy, subMaxAU, subMaxR);
            }
        });

        // Primary worlds
        const primaryWorlds = worlds.filter(w =>
            w.orbitType === 'P-Type' ||
            (w.orbitType === 'S-Type' && (w.parentStarIdx === 0 || w.parentStarIdx === undefined))
        );
        if (primaryWorlds.length > 0) {
            _drawWorldSet(ctx, primaryWorlds, originX, originY, maxAU, scaledMaxR);
        }

        // Stars — topmost layer
        stars.forEach((s, i) => {
            const pos = starPos.get(i);
            _drawStar(ctx, s, pos.cx, pos.cy, i);
            _hitBodies.push({
                kind: 'star', body: s,
                cx: pos.cx, cy: pos.cy,
                r: _starBodyRadius(s) + 8
            });
        });
    }

    // ── World set ─────────────────────────────────────────────────────────────

    // A size-0 mainworld is an asteroid cluster — draw as a belt ring.
    function _isMainworldBelt(w) {
        if (w.type !== 'Mainworld') return false;
        if (w.size === 0) return true;
        if (w.uwp && w.uwp[1] === '0') return true;
        return false;
    }

    function _drawWorldSet(ctx, worldList, cx, cy, maxAU, maxPx) {
        const isBelt = w => w.type === 'Planetoid Belt' || _isMainworldBelt(w);
        const belts  = worldList.filter(isBelt);
        const bodies = worldList.filter(w => !isBelt(w));

        belts.forEach(w => {
            const r    = _logR(w.au || 0, maxAU, maxPx);
            const isMW = _isMainworldBelt(w);
            _drawBeltRing(ctx, cx, cy, r, isMW);
            if (isMW && w.name) {
                ctx.save();
                ctx.fillStyle = '#66fcf1';
                ctx.font      = '11px "Share Tech Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(w.name, cx, cy - r - 8);
                ctx.restore();
            }
            _hitBodies.push({
                kind: isMW ? 'world' : 'belt',
                body: w, cx, cy, r: r + 7, innerR: r - 7
            });
        });

        bodies.forEach(w => {
            const r = _logR(w.au || 0, maxAU, maxPx);
            if (r < 2) return;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = '#45a29e1a';
            ctx.lineWidth   = 1;
            ctx.stroke();
        });

        const GOLDEN = 2.39996;
        bodies.forEach((w, idx) => {
            const r     = _logR(w.au || 0, maxAU, maxPx);
            const angle = idx * GOLDEN - Math.PI / 2;
            const px    = cx + r * Math.cos(angle);
            const py    = cy + r * Math.sin(angle);
            _drawWorld(ctx, w, px, py);
        });
    }

    // ── Element drawing ───────────────────────────────────────────────────────

    function _drawStarField(ctx, W, H) {
        ctx.save();
        for (let i = 0; i < 220; i++) {
            const x = (i * 7919 + 131) % W;
            const y = (i * 6271 + 179) % H;
            const r = i % 5 === 0 ? 0.9 : 0.45;
            ctx.globalAlpha = 0.10 + (i % 6) * 0.04;
            ctx.fillStyle   = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function _drawHZBand(ctx, cx, cy, innerR, outerR) {
        if (outerR <= innerR || innerR < 0) return;
        const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        grad.addColorStop(0,    'rgba(80,200,100,0)');
        grad.addColorStop(0.25, 'rgba(80,200,100,0.07)');
        grad.addColorStop(0.75, 'rgba(80,200,100,0.07)');
        grad.addColorStop(1,    'rgba(80,200,100,0)');
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2, false);
        ctx.arc(cx, cy, Math.max(0, innerR), 0, Math.PI * 2, true);
        ctx.fill();
        ctx.restore();
    }

    function _drawStar(ctx, s, cx, cy, idx) {
        const r     = _starBodyRadius(s);
        const color = _starColor(s);

        ctx.save();
        const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 3);
        glow.addColorStop(0, color + 'aa');
        glow.addColorStop(1, color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
        disc.addColorStop(0,   '#ffffff');
        disc.addColorStop(0.4, color);
        disc.addColorStop(1,   color + 'bb');
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = '#c5c6c7';
        ctx.font      = '11px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.name, cx, cy + r + 15);
        if (idx > 0 && s.separation) {
            ctx.fillStyle = '#65706e';
            ctx.font      = '10px "Share Tech Mono", monospace';
            ctx.fillText(s.separation, cx, cy + r + 27);
        }
        ctx.restore();
    }

    function _drawWorld(ctx, w, px, py) {
        const r     = _worldBodyRadius(w);
        const color = _worldColor(w);

        if (w.type === 'Mainworld') {
            ctx.beginPath();
            ctx.arc(px, py, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#66fcf1';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        const moons = (w.moons || []).filter(m => m.type !== 'Empty');
        moons.forEach((m, mi) => {
            const mAngle      = Math.PI / 6 + (mi / Math.max(moons.length, 1)) * Math.PI * 2;
            const mDist       = r + 10 + mi * 6;
            const mx          = px + mDist * Math.cos(mAngle);
            const my          = py + mDist * Math.sin(mAngle);
            const isMainworld = m.type === 'Mainworld';
            const moonR       = isMainworld ? 5 : 3;

            if (isMainworld) {
                ctx.beginPath();
                ctx.arc(mx, my, moonR + 3, 0, Math.PI * 2);
                ctx.strokeStyle = '#66fcf1';
                ctx.lineWidth   = 1.2;
                ctx.stroke();
            }

            ctx.fillStyle = isMainworld ? '#4fc3a1' : '#6a7070';
            ctx.beginPath();
            ctx.arc(mx, my, moonR, 0, Math.PI * 2);
            ctx.fill();

            if (isMainworld && m.name) {
                ctx.save();
                ctx.fillStyle = '#66fcf1';
                ctx.font      = '10px "Share Tech Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(m.name, mx, my - moonR - 5);
                ctx.restore();
            }

            _hitBodies.push({ kind: 'moon', body: m, cx: mx, cy: my, r: Math.max(moonR + 6, 9) });
        });

        if (w.type === 'Mainworld' && w.name) {
            ctx.save();
            ctx.fillStyle = '#66fcf1';
            ctx.font      = '11px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(w.name, px, py - r - 8);
            ctx.restore();
        }

        _hitBodies.push({ kind: 'world', body: w, cx: px, cy: py, r: Math.max(r + 9, 14) });
    }

    function _drawBeltRing(ctx, cx, cy, r, isMainworld = false) {
        if (r < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = isMainworld ? '#4fc3a188' : '#88888855';
        ctx.lineWidth   = isMainworld ? 7 : 5;
        ctx.setLineDash([3, 7]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ── Wheel: semantic zoom toward mouse ─────────────────────────────────────

    function _onWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        const direction = e.deltaY < 0 ? 1 : -1;
        const factor    = 1.15;
        const rect      = _orrCanvas.getBoundingClientRect();
        const mx        = e.clientX - rect.left;
        const my        = e.clientY - rect.top;
        const cx        = _canvasW / 2;
        const cy        = _canvasH / 2;

        if (direction > 0) {
            const newZoom = Math.min(_viewZoom * factor, 200);
            const ratio   = newZoom / _viewZoom;
            _viewOffX = mx - cx - (mx - cx - _viewOffX) * ratio;
            _viewOffY = my - cy - (my - cy - _viewOffY) * ratio;
            _viewZoom = newZoom;
            _redraw();
        } else {
            const newZoom = _viewZoom / factor;
            if (newZoom < 1.0) {
                close();
            } else {
                const ratio = newZoom / _viewZoom;
                _viewOffX = mx - cx - (mx - cx - _viewOffX) * ratio;
                _viewOffY = my - cy - (my - cy - _viewOffY) * ratio;
                _viewZoom = newZoom;
                _redraw();
            }
        }
    }

    // ── Drag-to-pan ───────────────────────────────────────────────────────────

    function _onMouseDown(e) {
        if (e.button !== 0) return;
        _dragging = true;
        _dragLast = { x: e.clientX, y: e.clientY };
        _orrCanvas.style.cursor = 'grabbing';
    }

    function _onWindowMouseMove(e) {
        if (!_dragging) return;
        _viewOffX += e.clientX - _dragLast.x;
        _viewOffY += e.clientY - _dragLast.y;
        _dragLast  = { x: e.clientX, y: e.clientY };
        _hideTooltip();
        _redraw();
    }

    function _onWindowMouseUp() {
        if (!_dragging) return;
        _dragging = false;
        if (_orrCanvas) _orrCanvas.style.cursor = 'crosshair';
    }

    // ── Hover / tooltip ───────────────────────────────────────────────────────

    function _onMouseMove(e) {
        if (_dragging) return;
        const rect = _orrCanvas.getBoundingClientRect();
        const mx   = e.clientX - rect.left;
        const my   = e.clientY - rect.top;

        let hit = null;
        for (let i = _hitBodies.length - 1; i >= 0; i--) {
            const b  = _hitBodies[i];
            const dx = mx - b.cx;
            const dy = my - b.cy;
            const d  = Math.sqrt(dx * dx + dy * dy);
            if (b.innerR !== undefined) {
                if (d <= b.r && d >= b.innerR) { hit = b; break; }
            } else {
                if (d <= b.r) { hit = b; break; }
            }
        }

        if (hit) {
            _showTooltip(hit, e.clientX, e.clientY);
            _orrCanvas.style.cursor = 'pointer';
        } else {
            _hideTooltip();
            _orrCanvas.style.cursor = _dragging ? 'grabbing' : 'crosshair';
        }
    }

    function _showTooltip(hit, mx, my) {
        if (!_tooltip) return;
        const body = hit.body;
        let html   = '';

        if (hit.kind === 'star') {
            const s = body;
            html += `<div style="color:#66fcf1;margin-bottom:5px;border-bottom:1px solid #45a29e44;padding-bottom:4px">`;
            html += `${s.name} <span style="color:#8a8f94">(${s.role || 'Primary'})</span></div>`;
            html += `<div>Type: ${s.sType}${s.subType ?? ''} ${s.sClass}</div>`;
            if (s.temp)       html += `<div>Temperature: ${Math.round(s.temp).toLocaleString()} K</div>`;
            if (s.mass)       html += `<div>Mass: ${s.mass.toFixed(3)} M☉</div>`;
            if (s.diam)       html += `<div>Diameter: ${s.diam.toFixed(3)} D☉</div>`;
            if (s.lum)        html += `<div>Luminosity: ${s.lum.toFixed(4)} L☉</div>`;
            if (s.separation) html += `<div>Separation: ${s.separation}</div>`;
            const compAU = _starCompanionAU(s);
            if (compAU)       html += `<div>Distance: ${compAU.toFixed(3)} AU</div>`;

        } else if (hit.kind === 'world') {
            const w = body;
            const typeTag = w.ggType
                ? ` <span style="color:#8a8f94">(${w.type} ${w.ggType})</span>`
                : (w.name ? ` <span style="color:#8a8f94">(${w.type})</span>` : '');
            html += `<div style="color:#66fcf1;margin-bottom:5px;border-bottom:1px solid #45a29e44;padding-bottom:4px">`;
            html += `${w.name || w.type}${typeTag}</div>`;
            if (w.orbitId != null) html += `<div>Orbit #: ${w.orbitId.toFixed ? w.orbitId.toFixed(2) : w.orbitId}</div>`;
            if (w.au)              html += `<div>Distance: ${w.au.toFixed(3)} AU</div>`;
            if (w.eccentricity)    html += `<div>Eccentricity: ${w.eccentricity.toFixed(3)}</div>`;
            if (w.uwp)             html += `<div style="margin-top:4px">UWP: <strong>${w.uwp}</strong></div>`;
            if (w.starport)        html += `<div>Starport: ${w.starport}</div>`;
            if (w.tl != null)      html += `<div>TL: ${w.tl}</div>`;
            if (w.tradeCodes && w.tradeCodes.length)
                                   html += `<div>Codes: ${w.tradeCodes.join(' ')}</div>`;
            if (w.travelZone && w.travelZone !== 'G')
                                   html += `<div>Zone: ${w.travelZone}</div>`;
            if (w.diamKm)          html += `<div style="margin-top:4px">Diameter: ${w.diamKm.toLocaleString()} km</div>`;
            if (w.mass)            html += `<div>Mass: ${w.mass.toFixed(2)} M⊕</div>`;
            if (w.gravity)         html += `<div>Gravity: ${w.gravity.toFixed(2)} G</div>`;
            if (w.meanTempK)       html += `<div>Mean Temp: ${Math.round(w.meanTempK - 273.15)}°C</div>`;
            const moons = (w.moons || []).filter(m => m.type !== 'Empty');
            if (moons.length)      html += `<div style="margin-top:4px">Moons: ${moons.length}</div>`;

        } else if (hit.kind === 'moon') {
            const m           = body;
            const isMainworld = m.type === 'Mainworld';
            const label       = m.name || (isMainworld ? 'Mainworld (Moon)' : 'Moon');
            const typeLabel   = isMainworld ? 'Mainworld Satellite' : 'Satellite';
            html += `<div style="color:#66fcf1;margin-bottom:5px;border-bottom:1px solid #45a29e44;padding-bottom:4px">`;
            html += `${label} <span style="color:#8a8f94">(${typeLabel})</span></div>`;
            if (m.pd != null)      html += `<div>Orbit: ${m.pd.toFixed(1)} PD from parent</div>`;
            if (m.uwp)             html += `<div style="margin-top:4px">UWP: <strong>${m.uwp}</strong></div>`;
            if (m.starport)        html += `<div>Starport: ${m.starport}</div>`;
            if (m.tl != null)      html += `<div>TL: ${m.tl}</div>`;
            if (m.tradeCodes && m.tradeCodes.length)
                                   html += `<div>Codes: ${m.tradeCodes.join(' ')}</div>`;
            if (m.travelZone && m.travelZone !== 'G')
                                   html += `<div>Zone: ${m.travelZone}</div>`;
            if (m.diamKm)          html += `<div style="margin-top:4px">Diameter: ${m.diamKm.toLocaleString()} km</div>`;
            if (m.mass)            html += `<div>Mass: ${m.mass.toFixed(2)} M⊕</div>`;
            if (m.gravity)         html += `<div>Gravity: ${m.gravity.toFixed(2)} G</div>`;
            if (m.meanTempK)       html += `<div>Mean Temp: ${Math.round(m.meanTempK - 273.15)}°C</div>`;
            if (m.size != null)    html += `<div>Size: ${m.size}</div>`;

        } else if (hit.kind === 'belt') {
            html += `<div style="color:#66fcf1;margin-bottom:5px">Planetoid Belt</div>`;
            if (body.au)              html += `<div>Distance: ${body.au.toFixed(3)} AU</div>`;
            if (body.orbitId != null) html += `<div>Orbit #: ${body.orbitId}</div>`;
        }

        _tooltip.innerHTML = html;
        _tooltip.style.display = 'block';

        const W = window.innerWidth, H = window.innerHeight;
        let tx = mx + 16, ty = my - 12;
        if (tx + 295 > W) tx = mx - 305;
        if (ty + 280 > H) ty = my - 290;
        _tooltip.style.left = Math.max(0, tx) + 'px';
        _tooltip.style.top  = Math.max(0, ty) + 'px';
    }

    function _hideTooltip() {
        if (_tooltip) _tooltip.style.display = 'none';
    }

    // ── ESC ───────────────────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) close();
    });

    return { open, close, isOpen, handleWheel };

})();

window.SystemViewer = SystemViewer;
