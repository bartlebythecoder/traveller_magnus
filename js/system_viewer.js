// =============================================================================
// SYSTEM_VIEWER.JS  —  Orrery Overlay
// Triggered when user scrolls past max map zoom.
// Supports MgT2E, CT, and T5 systems via normalisation.
// Exposes window.SystemViewer  { open, close, isOpen, handleWheel }
//
// Zoom model: SEMANTIC ZOOM — orbital radii scale with _viewZoom,
// but star/planet body sizes stay constant in screen pixels.
// =============================================================================

'use strict';

const SystemViewer = (() => {

    // ── State ─────────────────────────────────────────────────────────────────
    let _lightMode = false;   // mirrors window.printMode at open() time

    let _overlay   = null;
    let _orrCanvas = null;
    let _orrCtx    = null;
    let _sys       = null;   // normalised system object
    let _hexId     = null;   // hex currently shown in the orrery
    let _tooltip   = null;
    let _hitBodies = [];

    let _canvasW = 0;
    let _canvasH = 0;

    // Covers the worst realistic case: a tight companion pair (~0.05 AU) rendered
    // alongside a Far companion star (~300 AU) needs ~1900x to visually separate.
    const _MAX_ZOOM = 5000;

    // Dashed-stroke cost scales with circumference (canvas has to walk the whole path
    // to place each dash), so an orbit ring keeps costing more as _viewZoom grows —
    // unlike a plain stroke, which is cheap regardless of radius. At deep zoom a wide
    // companion's ring can reach into the hundreds of thousands of pixels, driving dash
    // segment counts high enough to freeze the render loop (confirmed empirically: a
    // 60-tick zoom-in froze the tab for 13+ minutes before this guard was added). Past
    // this radius the ring is also many multiples of any plausible viewport, so skipping
    // it costs nothing visually. ~80,000px keeps dash segments under ~50k/frame
    // ((2*pi*r)/10) — the ring stays visible at the pre-existing 200x zoom ceiling
    // (~57k px worst case), so this doesn't change behaviour below that; it only kicks
    // in at the deeper zoom this cap increase now allows.
    const _MAX_DASHED_RING_RADIUS = 80000;

    let _viewZoom = 1.0;
    let _viewOffX = 0;
    let _viewOffY = 0;

    let _dragging = false;
    let _dragLast = null;

    let _linearScale = false;
    let _orbitOpacity = 0.25;

    let _hideMoons              = false;
    let _hideHZ                 = false;
    let _hideMainworldHighlight = false;

    let _animFrameId   = null;
    let _lastFrameTime = 0;

    // In-game clock
    let _gameYear        = 0;
    let _gameDay         = 1;    // float, range [1, 366)
    let _speedDaysPerSec = 2;    // in-game days advancing per real second

    // DOM refs updated each frame
    let _yearInput = null;
    let _dayInput  = null;

    let _paused   = false;
    let _pauseBtn = null;

    const GOLDEN = 2.39996;   // golden angle (rad) for spiral angular spacing

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
    // Darker, saturated equivalents for white-background mode (originals wash out).
    const _STAR_COLORS_LIGHT = {
        O: '#3a5cc2', B: '#5070cc', A: '#6080b8',
        F: '#b88a00', G: '#c86800', K: '#c04800',
        M: '#b82800', D: '#6070a0', BD: '#7a4010'
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
        if (w.worldType === 'Worldlet') return 3;
        return 5;
    }

    // ── Colour helpers ────────────────────────────────────────────────────────

    function _starColor(s) {
        const map = _lightMode ? _STAR_COLORS_LIGHT : _STAR_COLORS;
        return map[s.sType] || (_lightMode ? '#606060' : '#ffffff');
    }

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

    function _scaleR(au, maxAU, maxPx) {
        return _linearScale
            ? (maxAU > 0 ? maxPx * (au / maxAU) : 0)
            : _logR(au, maxAU, maxPx);
    }

    // ── Deterministic epoch hash ──────────────────────────────────────────────
    // FNV-1a body + MurmurHash3 finalizer for full avalanche.
    // Without the finalizer, keys differing only in a trailing digit (e.g. ':0'
    // vs ':1') produce raw hash values that differ by only ~16 million, causing
    // all moons of a planet to cluster at nearly the same angle.
    function _hashEpoch(key) {
        let h = 2166136261;
        for (let i = 0; i < key.length; i++) {
            h ^= key.charCodeAt(i);
            h  = Math.imul(h, 16777619) >>> 0;
        }
        h ^= h >>> 16;
        h  = Math.imul(h, 0x85ebca6b) >>> 0;
        h ^= h >>> 13;
        h  = Math.imul(h, 0xc2b2ae35) >>> 0;
        h ^= h >>> 16;
        return (h / 0x100000000) * 2 * Math.PI;
    }

    // ── Physical period helpers ───────────────────────────────────────────────

    // Kepler's 3rd law: period in years for au (AU) around starMass (M☉).
    function _keplerYears(au, starMass) {
        if (au <= 0 || starMass <= 0) return 1;
        return Math.sqrt(Math.pow(au, 3) / starMass);
    }

    // Period in years for a normalised world object.
    function _worldPeriodYears(w, starMass) {
        if (w.periodYears && w.periodYears > 0) return w.periodYears;
        return _keplerYears(w.au || 1, starMass || 1);
    }

    // Period in years for a moon.  Uses periodHrs if stored; otherwise derives
    // from pd (planetary diameters from parent centre) via Kepler in SI units.
    function _moonPeriodYears(m, parentWorld) {
        if (m.periodHrs && m.periodHrs > 0) return m.periodHrs / (365.25 * 24);
        const G            = 6.674e-11;
        const M_EARTH_KG   = 5.972e24;
        const parentMassKg = (parentWorld.mass || 1) * M_EARTH_KG;
        const parentDiamKm = parentWorld.diamKm || 12742;
        const pd           = m.pd || 20;
        const r_m          = pd * parentDiamKm * 1000;   // orbital radius metres
        const T_sec        = 2 * Math.PI * Math.sqrt(Math.pow(r_m, 3) / (G * parentMassKg));
        return T_sec / (365.25 * 24 * 3600);
    }

    // Push current _gameYear / _gameDay into the header inputs.
    // Skip an input while it has focus so the user can type or use the spinner without being overwritten.
    function _updateDateDisplay() {
        if (_yearInput && document.activeElement !== _yearInput) _yearInput.value = _gameYear;
        if (_dayInput  && document.activeElement !== _dayInput)  _dayInput.value  = Math.max(1, Math.floor(_gameDay));
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
        if (state.aowSystem && state.aowSystem.stars && state.aowSystem.stars.length > 0)
            return { raw: state.aowSystem, edition: 'AoW' };
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
        const mwId = mw && mw._id;
        const worlds = (sys.worlds || []).map(w => {
            const isMainworld = _isSameWorld(w, mw) || w.type === 'Mainworld';
            let type = isMainworld ? 'Mainworld' : w.type;
            if (type === 'Planet') type = 'Terrestrial Planet';
            // generateAtmospherics replaces moon objects (w.moons[j] = syncRes with type:'Satellite'),
            // detaching them from sys.mainworld. Re-identify lunar mainworlds by _id.
            const moons = (w.moons || []).map(m => {
                const moonIsMainworld = (mwId && m._id === mwId) || m.type === 'Mainworld';
                return moonIsMainworld ? Object.assign({}, m, { type: 'Mainworld' }) : m;
            });
            return Object.assign({}, w, {
                type,
                moons,
                orbitType:     w.orbitType     || 'S-Type',
                parentStarIdx: w.parentStarIdx ?? 0,
                travelZone:    w.travelZone    || w.travelCode || 'G',
            });
        });
        return Object.assign({}, sys, { edition: 'MgT2E', hzAU, worlds });
    }

    // Shared moon normaliser for CT and T5 (both use world.satellites[]).
    // `ctKelvin`: CT stores a moon's temperature as `temperature`, in Kelvin
    // (ct_physical_library.js getThermalStats). Scoped to CT by the caller so a
    // T5 field of the same name could never be misread as Kelvin.
    function _normMoon(m, mainworldRef, ctKelvin) {
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
            meanTempK:   m.meanTempK  || (ctKelvin && typeof m.temperature === 'number' ? m.temperature : null),
            invented:    (ctKelvin && !m.travelZone && !m.zone) ? ['travelZone'] : [],
            size:        m.size       ?? null,
            pd:          m.pd         || null,
        };
    }

    // R4 (system sheet, ruled 2026-09-23): NO INVENTED VALUE IS PRINTED AS FACT.
    // Several normalisers default a missing field (`mass || 1`, `age || 0`) so
    // the orrery has a number to animate with. The VALUES stay - the orrery
    // needs them - but the field names that were defaulted are listed in
    // `invented`, so a reader that PRINTS numbers (the system sheet) can show a
    // dash instead. Measured: T5 stores no star mass, RTT no star mass/diam/lum,
    // CT and T5 no system age.
    function _inventedStarFields(s, lumKey) {
        const out = [];
        if (!s.mass)     out.push('mass');
        if (!s.diam)     out.push('diam');
        if (!s[lumKey])  out.push('lum');
        return out;
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
            // CT companion orbit may be 'Close', 'Far', or a number (native stochastic
            // generation) — but a System-Editor-authored/repositioned companion never carries
            // those fields at all, only `orbitId` (the shared drag-and-drop position key also
            // used for worlds). Without this fallback, a companion added or dragged in the
            // editor always rendered at the same hardcoded distance in the orrery no matter
            // where it was dropped, because none of the native-format checks ever matched.
            // Mirrors the equivalent read-side fallback in system_editor.js's
            // _buildWorkingCopyFromState (orbitAU derivation for CT/RTT stars).
            let orbitAU = null;
            if (i > 0) {
                if (typeof s.orbit === 'number') orbitAU = _orbitToAU(s.orbit);
                else if (s.distAU)               orbitAU = s.distAU;
                else if (s.orbit === 'Close')     orbitAU = 0.05;
                else if (s.orbitAU != null)       orbitAU = s.orbitAU;
                else if (s.orbitId != null)       orbitAU = _orbitToAU(s.orbitId);
                else                              orbitAU = 10;
            }
            return {
                name:           s.name || `${s.type}${s.decimal ?? ''} ${s.size}`,
                sType:          s.type  || 'G',
                sClass:         s.size  || 'V',
                subType:        s.decimal ?? 5,
                mass:           s.mass        || 1,
                diam:           s.diam        || 1,
                temp:           null,
                lum:            s.luminosity  || 1,
                invented:       _inventedStarFields(s, 'luminosity'),
                role:           s.role || (i === 0 ? 'Primary' : 'Companion'),
                separation:     i > 0 ? (typeof s.orbit === 'string' ? s.orbit : null) : null,
                orbitId:        typeof s.orbit === 'number' ? s.orbit : null,
                orbitAU,
                parentStarIdx:  s.parentStarIdx ?? 0,
            };
        });

        // Worlds — flattened from sys.orbits[]. Read the body's own w.distAU (always freshly
        // recomputed from the current orbit every generation pass — ct_bottomup_generator.js's
        // internalPhysicalPass) rather than slot.distAU (a write-time-only echo of the seed
        // that's never refreshed after a Preview — see OW-25). Matches the pattern captured
        // planets already use correctly, two lines below.
        const worlds = [];
        (sys.orbits || []).forEach(slot => {
            const w = slot.contents;
            if (!w || w.type === 'Empty') return;
            worlds.push(_normCTWorld(w, w.distAU || 0, mw));
        });
        // Captured planets (anomalies)
        (sys.capturedPlanets || []).forEach(w => {
            if (w && w.type !== 'Empty') worlds.push(_normCTWorld(w, w.distAU || 0, mw));
        });

        // Far companions carry their own independent orbit sequence in nestedSystem (set by
        // ct_bottomup_generator.js's generateSystemOrbits or the System Editor's CT write()
        // adapter) — flatten those bodies too, tagged with the companion's own star index, so
        // the existing sub-orrery drawing code (_drawWorldSet's `w.parentStarIdx === sIdx`
        // filter, below) picks them up. Without this a Far companion's own bodies were
        // invisible in the orrery even after the System Editor/accordion could show them (OW-19).
        (sys.stars || []).forEach((s, i) => {
            if (i === 0 || !s.nestedSystem) return;
            (s.nestedSystem.orbits || []).forEach(slot => {
                const w = slot.contents;
                if (!w || w.type === 'Empty') return;
                worlds.push(_normCTWorld(w, w.distAU || 0, mw, i));
            });
            (s.nestedSystem.capturedPlanets || []).forEach(w => {
                if (w && w.type !== 'Empty') worlds.push(_normCTWorld(w, w.distAU || 0, mw, i));
            });
        });

        // HZ centre: prefer sys.hzco — the orbit number CT's generator actually resolved and
        // used for zone classification/placement (ct_bottomup_generator.js's
        // generateSystemOrbits), which respects any System Editor override. Falling back to a
        // live zoneHTable lookup here (as this code used to do unconditionally) meant an
        // edited system's HZ override never moved the ring, since this recomputed straight from
        // the primary's size/type every time regardless of what the generator/editor resolved.
        // sys.hzco is only ever absent (undefined, not null) for systems that predate this field
        // — chiefly Top-Down-generated ones (ct_topdown_generator.js doesn't set it) — so those
        // still fall back to the direct table lookup below.
        const primary = (sys.stars || [])[0];
        let hzAU = null;
        let hzKnownAbsent = false;
        if (sys.hzco !== undefined) {
            if (sys.hzco != null) hzAU = _orbitToAU(sys.hzco);
            // sys.hzco === null means the generator resolved no HZ (RAW ZONE_H_TABLE negative,
            // and no override forced one) — same "known absent" semantics as the table lookup
            // below, not a missing value to fall back from.
            else hzKnownAbsent = true;
        } else if (primary && typeof zoneHTable !== 'undefined' && zoneHTable[primary.size]) {
            const hzOrbitNum = zoneHTable[primary.size][`${primary.type}${primary.decimal}`];
            if (hzOrbitNum != null) {
                if (hzOrbitNum >= 0) hzAU = _orbitToAU(hzOrbitNum);
                // ZONE_H_TABLE uses negative values (e.g. M5/M9 under size 'V', most of 'VI'
                // and 'D') as a deliberate RAW signal that this star type has no classical
                // habitable zone at all — not a lookup failure. _orbitToAU(-1) previously read
                // past the start of the orbit-AU array (tbl[-1] === undefined), producing NaN,
                // which crashed _drawHZBand's ctx.createRadialGradient (non-finite radius) and
                // aborted the whole orrery render before stars/worlds were drawn. Leave hzAU
                // null here — no ring should be drawn, and the mainworld-distance fallback
                // below is skipped too, since falling back there would incorrectly imply a
                // habitable zone exists when RAW says it doesn't.
                else hzKnownAbsent = true;
            }
        }
        if (hzAU == null && !hzKnownAbsent) hzAU = (mw && mw.distAU) ? mw.distAU : 1.0;

        return { edition: 'CT', age: sys.age || 0, hzAU, stars, worlds,
                 invented: sys.age ? [] : ['age'] };
    }

    function _normCTWorld(w, au, mainworldRef, parentStarIdx) {
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
            parentStarIdx: parentStarIdx || 0,
            orbitType:     'S-Type',
            eccentricity:  0,
            mass:          w.mass     || null,
            diamKm:        w.diamKm   || null,
            gravity:       w.gravity  || null,
            // CT stores temperature as `temperature`, in Kelvin (ct_physical_library.js:66).
            // Sean ruled 2026-09-23 to wire it: the in-app body image button already fed
            // it to the renderer (hex_editor.js ~1145), so exports and the system sheet
            // drew CT worlds temperature-blind while the viewer did not. This CHANGES the
            // palette of ~69% of CT world images in exports - accepted, to make them agree.
            meanTempK:     w.meanTempK || (typeof w.temperature === 'number' ? w.temperature : null),
            // R4: CT gives every Gas Giant ("GC Baseline") and Planetoid Belt a
            // fixed 100 K (ct_physical_library.js) - a placeholder, not a
            // calculation. Sean ruled 2026-09-23: flag it, so the system sheet
            // prints a dash. A belt MAINWORLD is typed 'Mainworld' and gets a
            // real thermal calculation, so it is correctly not flagged.
            // R4: CT records no travel zone - the 'G' below is a fill-in, so it is
            // flagged and the system sheet prints a dash rather than "Green".
            invented:      ((!w.meanTempK && (w.type === 'Gas Giant' || w.type === 'Planetoid Belt'))
                               ? ['meanTempK'] : [])
                               .concat(w.travelZone || w.zone ? [] : ['travelZone']),
            // CT stores the orbital period as `orbitalPeriod`, in years (checked against
            // Kepler on ct_bu: 0.2 AU around 0.49 M☉ stores 0.128). Unread before
            // v0.18.1, so the system sheet's Year column was blank on every CT world.
            periodYears:   w.orbitalPeriod ?? null,
            moons:         (w.satellites || []).map(m => _normMoon(m, mainworldRef, true)),
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
            name:          s.name || `${s.type}${s.decimal ?? ''} ${s.size}`,
            sType:         s.type  || 'G',
            sClass:        s.size  || 'V',
            subType:       s.decimal ?? 5,
            mass:          s.mass        || 1,
            diam:          s.diam        || 1,
            temp:          null,
            lum:           s.luminosity  || 1,
            invented:      _inventedStarFields(s, 'luminosity'),
            role:          s.role || (i === 0 ? 'Primary' : 'Companion'),
            separation:    i > 0 ? (s.role || null) : null,
            orbitId:       s.orbitID     || null,
            orbitAU:       i > 0 ? (s.distAU || null) : null,
            parentStarIdx: s.parentStarIdx ?? 0,
        }));

        // Worlds — flat list (imported systems) or per-star orbit slots (generated).
        // Imported systems set sys.worlds; generated systems only have orbit slots.
        const worlds = [];
        if (sys.worlds && sys.worlds.length > 0) {
            sys.worlds.forEach(w => worlds.push(_normT5World(w, w.distAU || 0, w.parentStarIdx || 0, mw)));
        } else {
            (sys.stars || []).forEach((s, si) => {
                (s.orbits || []).forEach(slot => {
                    const w = slot.contents;
                    if (!w || w.type === 'Empty') return;
                    worlds.push(_normT5World(w, slot.distAU || 0, si, mw));
                });
            });
        }

        // HZ centre: prefer the star-physics-derived HZ orbit (getStarHZ in
        // t5_topdown_generator.js, fixed by the primary's spectral type/size — independent
        // of which body is flagged mainworld). Fall back to the mainworld's own distance
        // only for older saves generated before sys.hzOrbit was persisted.
        let hzAU = (sys.hzOrbit != null) ? _orbitToAU(sys.hzOrbit) : null;
        if (hzAU == null) hzAU = (mw && mw.distAU) ? mw.distAU : 1.0;

        return { edition: 'T5', age: sys.age || 0, hzAU, stars, worlds,
                 invented: sys.age ? [] : ['age'] };
    }

    function _normT5World(w, au, parentStarIdx, mainworldRef) {
        const isMainworld = _isSameWorld(w, mainworldRef) || w.type === 'Mainworld';
        let type  = 'Terrestrial Planet';
        let ggType = null;
        if (isMainworld) {
            type = 'Mainworld';
        } else if (w.type === 'Large Gas Giant') {
            type = 'Gas Giant'; ggType = 'GL';
        } else if (w.type === 'Small Gas Giant') {
            type = 'Gas Giant'; ggType = 'GS';
        } else if (w.type === 'Gas Giant') {
            type = 'Gas Giant'; ggType = w.ggType || 'GM';
        } else if (w.type === 'Ice Giant') {
            type = 'Gas Giant'; ggType = 'GS';
        } else if (w.type === 'Planetoid Belt') {
            type = 'Planetoid Belt';
        } else if (w.type === 'Ring') {
            type = 'Planetoid Belt';
        }
        return {
            type, ggType,
            worldType:     w.worldType || null,
            au:            au || w.distAU || 0,
            parentStarIdx,
            orbitType:     'S-Type',
            eccentricity:  0,
            // T5 RAW gives a Gas Giant a literal 'Variable (Giant)' string for `mass` (see
            // calculateT5PhysicalStats, t5_world_engine.js) instead of a number, alongside a
            // separate numeric `massEarths` (317.8, the same fixed value for every tier — T5
            // doesn't vary it by size) — every other T5 body type has a real numeric `mass`.
            // Passing the string straight through broke two things downstream: the tooltip's
            // `w.mass.toFixed(2)` threw a TypeError (aborting the tooltip entirely, so hovering a
            // Gas Giant showed nothing), and _moonPeriodYears' `mass * M_EARTH_KG` coerced the
            // string to NaN, sending every one of that Gas Giant's moons to a NaN screen position
            // (invisible and unhoverable) — see OW-56.
            //
            // A freshly-added Gas Giant (System Editor, before its first full physics resolution)
            // has neither `mass` nor `massEarths` set yet, so this used to fall through to
            // `_moonPeriodYears`' own `parentWorld.mass || 1` default — treating the not-yet-
            // resolved Gas Giant as a 1-Earth-mass body. Since orbital period scales as
            // 1/√mass, that made its moons visibly spin very fast in the live preview, then snap
            // to their correct, much slower speed the instant the Gas Giant's real ~318-Earth-mass
            // got resolved (Preview/Save) — jarring, even though the end state was always correct
            // (OW-60). Default an unresolved Gas Giant to the same 317.8 T5 already uses once
            // resolved, so there's nothing left to visibly snap to.
            mass:          (typeof w.mass === 'number' ? w.mass : w.massEarths) ?? (type === 'Gas Giant' ? 317.8 : null),
            // Same gap as the mass default above (OW-60), just never covered by that fix: a
            // freshly-added Gas Giant (System Editor, before its first full physics resolution)
            // has no diamKm yet either, so this fell through to _moonPeriodYears' own
            // `parentWorld.diamKm || 12742` default — Earth's diameter, roughly 15-20x smaller
            // than a real Gas Giant's (calculateT5PhysicalStats: diamKm = sizeVal * 10000,
            // ~210,000-310,000 km depending on size letter). Since orbital radius scales with
            // parent diameter and period scales as radius^1.5, that made an unresolved GG's
            // moons visibly whip around far too fast in the live preview, snapping to their
            // correct, much slower speed once Preview/Save resolved a real diamKm. 215000 matches
            // a brand-new '+GG' body's default tier (ggType 'GS'/Small — system_editor.js's
            // _addBody — sizes 'M'/'N', 210000/220000 km) so there's nothing to visibly snap to,
            // mirroring the mass default's own reasoning exactly.
            diamKm:        w.diamKm    || (type === 'Gas Giant' ? 215000 : null),
            gravity:       w.gravity   || null,
            meanTempK:     w.meanTempK || null,
            moons:         (w.satellites || []).map(m => _normMoon(m, mainworldRef)),
            uwp:           w.uwp       || null,
            name:          w.name      || null,
            starport:      w.starport  || null,
            tl:            w.tl        ?? null,
            tradeCodes:    w.tradeCodes || [],
            travelZone:    w.travelZone || 'G',
            // T5 stores the orbit number on the body itself (100% of bodies in
            // t5_top_down); this was hardcoded null.
            orbitId:       w.orbitId ?? null,
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
                name:          s.classification || `${s.type}-${s.luminosityClass}`,
                sType, sClass,
                subType:       5,
                mass:          s.mass || 1,
                diam:          s.diam || 1,
                temp:          null,
                lum:           s.lum  || 1,
                // orbitAU below comes from _RTT_COMPANION_AU - a separation WORD
                // turned into a number. Invented, like the zone AU of the worlds.
                invented:      _inventedStarFields(s, 'lum').concat(i > 0 ? ['orbitAU'] : []),
                role:          s.role || (i === 0 ? 'Primary' : 'Companion'),
                separation:    i > 0 ? (s.orbitType || null) : null,
                orbitId:       null,
                orbitAU,
                parentStarIdx: s.parentStarIdx ?? 0,
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
        // RTT is the ONLY engine whose world AU is synthesised (_RTT_ZONE_AU):
        // its raw orbits carry orbitNumber and zone and no distance at all.
        return { edition: 'RTT', age: sys.age || 0, hzAU, stars, worlds,
                 invented: (sys.age ? [] : ['age']).concat(['au']) };
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

        // Build a compact UWP string if the body has social data. Moons carry
        // the same raw fields, so they get the same construction: before
        // 2026-09-23 moons were hardcoded `uwp: null`, and an RTT lunar
        // mainworld showed no UWP on the system sheet (Sean's ruling).
        const _eh = (v) => (typeof window.getEHexLetter === 'function') ? window.getEHexLetter(v || 0) : String(v || 0);
        const _rttUwp = (o) => {
            if (!(o.starport && o.population != null)) return null;
            const sz = (typeof o.size === 'number') ? _eh(o.size) : (o.size || '0');
            return `${o.starport}${sz}${_eh(o.atmosphere)}${_eh(o.hydrosphere)}` +
                   `${_eh(o.population)}${_eh(o.government)}${_eh(o.lawLevel)}-${_eh(o.tl)}`;
        };
        const uwp = _rttUwp(body);

        const moons = (body.satellites || []).map(m => ({
            type:       m.isMainworld ? 'Mainworld' : 'Satellite',
            name:       m.name       || null,
            uwp:        _rttUwp(m),
            starport:   m.starport   || null,
            tl:         m.tl         ?? null,
            tradeCodes: m.tradeCodes || [],
            // Same rule as RTT worlds below, which is the rule rtt_engine.js
            // applies to the mainworld. Hardcoded 'G' showed Red-zone lunar
            // mainworlds as Green in the orrery, the exports and the sheet.
            travelZone: (m.bases || []).includes('Z') ? 'Red' : 'G',
            // RTT stores `diameter`, not `diamKm`; the old read left every RTT
            // disc sized from nothing. diamKm kept first for any edited system.
            // NUMBERS ONLY: RTT Jovians store the string "Variable (Giant)"
            // here (924 bodies in rtt_bu), which made disc sizes NaN and
            // crashed the system sheet the first time it was wired.
            diamKm:     m.diamKm     || (typeof m.diameter === 'number' ? m.diameter : null),
            composition: m.composition || null,
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
            // RTT field is `diameter`; numbers only - Jovians store "Variable (Giant)".
            diamKm:       body.diamKm    || (typeof body.diameter === 'number' ? body.diameter : null),
            composition:  body.composition || null,
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

    // ── AoW normaliser ────────────────────────────────────────────────────────

    function _normalizeAoW(sys) {
        const mw = sys.mainworld;

        // sys.hzco is never computed by the AoW generator (see OW-9 note above), so derive
        // the HZ ring directly from the primary's real solar luminosity — same inverse-square
        // approximation MgT2E uses for HZCO (HZ AU = sqrt(luminosity in L☉)), applied straight
        // in AU since AoW bodies already carry real orbitalRadius rather than an abstract orbit
        // number. Unlike RTT (which only tracks a luminosity *class* letter, not a numeric solar
        // luminosity), AoW's star-physics solver already produces `star.luminosity` for every
        // star, so this needs no new data — only falls back to the mainworld's own orbit if
        // luminosity is somehow missing (e.g. an unresolved/partial star).
        const primaryLum = (sys.stars && sys.stars[0]) ? sys.stars[0].luminosity : null;
        const mwAU = mw ? (mw.orbitalRadius ?? mw.orbitId ?? 1.0) : 1.0;
        const hzAU = (primaryLum != null && primaryLum > 0) ? Math.sqrt(primaryLum) : mwAU;

        // Companion orbit AU from sys.orbits[], sorted by R ascending
        const sortedOrbits = [...(sys.orbits || [])].sort((a, b) => a.R - b.R);

        // WHICH STAR EACH STAR AND EACH WORLD BELONGS TO (v0.18.1.3). AoW builds
        // planets on DISK NODES - one star, or a pair sharing a circumbinary
        // disk - and stamps the NODE index on each planet as `parentStarIdx`
        // (aow_world_engine.js populateAoWWorldsList). That index is not a star
        // index: in a Binary the A-B disk is node 2, so its planets were drawn
        // round star B, and in (A-B, C) star C's planets were drawn round B.
        // The node list is rebuilt here with the engine's own buildNodes, and
        // each node is filed under the FIRST star of its focal group, so an A-B
        // disk belongs to the primary exactly as an MgT2E P-Type orbit does.
        // Each star's own orbit is read from the hierarchy too: sorting
        // sys.orbits by R handed star B the inner B-C pair's orbit in
        // (A, B-C). Unknown hierarchy or no engine loaded: the old behaviour.
        const rawStars = sys.stars || [];
        const orbs = sys.orbits || [];
        const STAR_ORBITS = {
            'Binary':                [null, [orbs[0], 0]],
            'Trinary (A, B-C)':      [null, [orbs[1], 0], [orbs[0], 1]],
            'Trinary (A-B, C)':      [null, [orbs[0], 0], [orbs[1], 0]],
            'Quaternary (A-B, C-D)': [null, [orbs[0], 0], [orbs[2], 0], [orbs[1], 2]],
        }[sys.hierarchy] || null;
        let nodeStar = null;
        if (window.AoWWorldEngine && AoWWorldEngine.buildNodes) {
            try {
                nodeStar = AoWWorldEngine.buildNodes(sys).map(n => {
                    const first = rawStars.indexOf((n.focalStars || [])[0]);
                    return { star: first >= 0 ? first : 0,
                             pType: n.type === 'P' && first === 0 };
                });
            } catch (e) { nodeStar = null; }
        }

        const stars = rawStars.map((star, idx) => {
            let sType = 'G', subType = 5, sClass = 'V';
            const sc = star.spectralClassification || '';
            if (star.state === 'White Dwarf') {
                sType = 'D'; subType = 0; sClass = '';
            } else if (star.state === 'Brown Dwarf') {
                sType = 'BD'; subType = 0; sClass = '';
            } else {
                const m = sc.match(/^([OBAFGKM])(\d+)\s*(Ia|Ib|II|III|IV|V)$/i);
                if (m) { sType = m[1].toUpperCase(); subType = parseInt(m[2]); sClass = m[3]; }
            }
            const own = STAR_ORBITS && STAR_ORBITS[idx];
            const orbitAU = own ? (own[0] && own[0].R != null ? own[0].R : null)
                          : (idx > 0 && sortedOrbits[idx - 1]) ? sortedOrbits[idx - 1].R : null;
            return {
                role:          idx === 0 ? 'Primary' : 'Companion',
                parentStarIdx: own ? own[1] : 0,
                sType, subType, sClass,
                mass:          star.wdMass || star.initialMass || 1.0,
                lum:           star.luminosity ?? null,
                age:           sys.systemAge ?? null,
                orbitAU,
                name:          (star.label ? `${star.label}: ` : '') + (sc || '?'),
            };
        });

        const worlds = (sys.worlds || []).map(w => {
            const isMainworld = w === mw || w.type === 'Mainworld';
            let type   = isMainworld ? 'Mainworld' : (w.type || 'Terrestrial Planet');
            let ggType = null;
            if (type === 'Gas Giant') {
                const em = w.mass || 0;
                ggType = em >= 200 ? 'GL' : em >= 50 ? 'GM' : 'GS';
            }

            const au      = w.orbitalRadius ?? w.orbitId ?? null;
            const diamKm  = (w.radius != null) ? Math.round(w.radius * 2) : null;

            // AoW `worldClass` (Step 26) fills the Composition column - the same
            // kind of label MgT2E puts there. Its class chain ends in a
            // fall-through 'Class 6 (Luna-type)', which lands on ~95% of gas
            // giants and belts; Sean ruled 2026-09-23 to show NO class for gas
            // giants and belts rather than print "Luna-type" on a gas giant.
            const _pt = String(w.planetType || '');
            const _aowClass = (type === 'Gas Giant' || type === 'Planetoid Belt'
                               || _pt.includes('Gas Giant') || _pt === 'Planetoid Belt')
                ? null : (w.worldClass ?? null);
            // AoW `orbitalPeriod` is in HOURS: Step 18 computes sqrt(a^3/M) x 8770.
            // Dividing by the engine's own 8770 gives standard years exactly.
            // (`localYear` is in LOCAL DAYS and is not a year length - do not use it.)
            const _aowYears = (typeof w.orbitalPeriod === 'number') ? w.orbitalPeriod / 8770 : null;

            const moons = (w.satellites || []).map(m => ({
                type:      m.type || 'Satellite',
                name:      m.name       ?? null,
                pd:        null,
                uwp:       m.uwp        ?? null,
                starport:  m.starport   ?? null,
                tl:        m.tl         ?? null,
                tradeCodes: m.tradeCodes || [],
                travelZone: m.travelZone || 'G',
                diamKm:    (m.radius != null) ? Math.round(m.radius * 2) : null,
                mass:      m.mass       ?? null,
                gravity:   m.gravity    ?? null,
                meanTempK: m.avgSurfaceTemp ?? null,
                composition: m.worldClass ?? null,   // see _aowClass below
                size:      m.size       ?? null,
            }));

            // The disk node: `diskNodeIdx` on systems generated since v0.18.1.3,
            // whose `parentStarIdx` is already a star; on older saves the node
            // index IS `parentStarIdx` - see nodeStar above.
            const node = nodeStar && nodeStar[w.diskNodeIdx ?? w.parentStarIdx ?? 0];
            const parentStarIdx = node ? node.star
                : Math.min(w.parentStarIdx ?? 0, Math.max(0, stars.length - 1));

            return {
                type, ggType,
                au, orbitId: au,
                parentStarIdx,
                orbitType:    node && node.pType ? 'P-Type' : 'S-Type',
                eccentricity: w.eccentricity ?? 0,
                diamKm,
                mass:         w.mass       ?? null,
                gravity:      w.gravity    ?? null,
                meanTempK:    w.avgSurfaceTemp ?? null,
                periodYears:  _aowYears,
                composition:  _aowClass,
                size:         w.size       ?? null,
                atm:          w.atmCode    ?? w.atm ?? null,
                hydro:        w.hydroCode  ?? w.hydro ?? null,
                uwp:          w.uwp        || '',
                name:         w.name       || '',
                starport:     w.starport   || '',
                tl:           w.tl         ?? null,
                tradeCodes:   w.tradeCodes || [],
                travelZone:   w.travelZone || 'G',
                moons,
            };
        });

        return { edition: 'AoW', age: sys.systemAge ?? null, hzAU, stars, worlds };
    }

    // ── Surface viewer helpers ────────────────────────────────────────────────

    function _isTerrestrial(w) {
        if (w.type === 'Gas Giant')      return false;
        if (w.type === 'Planetoid Belt') return false;
        if (w.uwp && w.uwp[1] === '0')  return false;   // size-0 belt mainworld
        return true;
    }

    function _findTerrestrialUnderCursor(mx, my) {
        for (let i = _hitBodies.length - 1; i >= 0; i--) {
            const b = _hitBodies[i];
            if (b.kind !== 'world' && b.kind !== 'moon') continue;
            if (!_isTerrestrial(b.body)) continue;
            const dx = mx - b.cx, dy = my - b.cy;
            if (Math.sqrt(dx * dx + dy * dy) <= b.r) return b.body;
        }
        return null;
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

    // Re-normalises the system data from hexStates without closing or resetting any
    // viewer state (zoom, pan, pause, hideMoons, speed, year, etc.).
    // Used by the System Editor's Preview so viewer settings survive each preview cycle.
    function refresh(hexId) {
        if (!_overlay || hexId !== _hexId) return;
        const state = (typeof hexStates !== 'undefined') ? hexStates.get(hexId) : null;
        if (!state) return;
        const found = _detectSystem(state);
        if (!found) return;
        if      (found.edition === 'AoW')   _sys = _normalizeAoW(found.raw);
        else if (found.edition === 'MgT2E') _sys = _normalizeMgT2E(found.raw);
        else if (found.edition === 'CT')    _sys = _normalizeCT(found.raw);
        else if (found.edition === 'T5')    _sys = _normalizeT5(found.raw);
        else                                _sys = _normalizeRTT(found.raw);
        _hitBodies = [];
        if (_tooltip) _tooltip.style.display = 'none';
    }

    function open(explicitHexId) {
        const hexId = explicitHexId || _centerHexId();
        if (!hexId) return;
        const state = hexStates.get(hexId);
        if (!state) return;

        const found = _detectSystem(state);
        if (!found) return;  // no system expansion — silently do nothing

        let normalised;
        if      (found.edition === 'AoW')   normalised = _normalizeAoW(found.raw);
        else if (found.edition === 'MgT2E') normalised = _normalizeMgT2E(found.raw);
        else if (found.edition === 'CT')    normalised = _normalizeCT(found.raw);
        else if (found.edition === 'T5')    normalised = _normalizeT5(found.raw);
        else                                normalised = _normalizeRTT(found.raw);

        _sys         = normalised;
        _hexId       = hexId;
        _lightMode   = !!window.printMode;
        _viewZoom    = 1.0;
        _viewOffX    = 0;
        _viewOffY    = 0;
        _gameYear    = (window.orreryDefaultYear !== undefined) ? window.orreryDefaultYear : 0;
        _gameDay     = (window.orreryDefaultDay  !== undefined) ? window.orreryDefaultDay  : 1;
        _paused      = false;
        _buildOverlay(hexId);
        _startLoop();
    }

    function close() {
        if (!_overlay) return;
        _closeGifDialog();
        window.removeEventListener('mousemove', _onWindowMouseMove);
        window.removeEventListener('mouseup',   _onWindowMouseUp);
        cancelAnimationFrame(_animFrameId);
        _overlay.remove();
        _overlay     = null;
        _orrCanvas   = null;
        _orrCtx      = null;
        _sys         = null;
        _hexId       = null;
        _tooltip     = null;
        _hitBodies   = [];
        _canvasW     = 0;
        _canvasH     = 0;
        _viewZoom    = 1.0;
        _viewOffX    = 0;
        _viewOffY    = 0;
        _dragging      = false;
        _dragLast      = null;
        _animFrameId   = null;
        _lastFrameTime = 0;
        _gameYear      = 0;
        _gameDay       = 1;
        _yearInput     = null;
        _dayInput      = null;
        _paused        = false;
        _pauseBtn      = null;
        _hideMoons              = false;
        _hideHZ                 = false;
        _hideMainworldHighlight = false;
        if (typeof SystemEditor !== 'undefined') SystemEditor.close();
    }

    function handleWheel(direction) {
        if (direction < 0 && _viewZoom <= 0.5) close();
    }

    // ── Play / Pause ──────────────────────────────────────────────────────────

    function _togglePause() {
        _paused = !_paused;
        if (_pauseBtn) _pauseBtn.textContent = _paused ? '▶' : '⏸';
    }

    // ── DOM Construction ──────────────────────────────────────────────────────

    function _buildOverlay(hexId) {
        const sys      = _sys;
        const starLine = sys.stars.map(s => s.name).join(' / ');
        const age      = (sys.age || 0).toFixed(2);
        const edition  = sys.edition || '';

        // Palette: dark (default) or light (print mode)
        const P = _lightMode
            ? { bg: '#ffffff', border: '#45a29e88', text: '#1a1a2e', accent: '#0d6b64',
                sub: '#4a5568', hint: '#6b7280', badge: '#45a29e', badgeBorder: '#45a29eaa' }
            : { bg: '#000000', border: '#45a29e55', text: '#c5c6c7', accent: '#66fcf1',
                sub: '#8a8f94', hint: '#55686b', badge: '#45a29e', badgeBorder: '#45a29e55' };

        _overlay = document.createElement('div');
        _overlay.id = 'system-viewer-overlay';
        Object.assign(_overlay.style, {
            position: 'fixed', inset: '0', zIndex: '9000',
            background: P.bg,
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
            color: P.text, userSelect: 'none'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '8px 18px', flexShrink: '0',
            borderBottom: `1px solid ${P.border}`
        });

        const title = document.createElement('span');
        Object.assign(title.style, { color: P.accent, fontSize: '15px', fontWeight: 'bold' });
        title.textContent = `SYSTEM  ${hexId}`;

        const editionBadge = document.createElement('span');
        Object.assign(editionBadge.style, {
            fontSize: '10px', color: P.badge,
            border: `1px solid ${P.badgeBorder}`, padding: '1px 6px'
        });
        editionBadge.textContent = edition;

        const sub = document.createElement('span');
        Object.assign(sub.style, { fontSize: '12px', color: P.sub });
        sub.textContent = `${starLine}   ·   Age ${age} Gyr`;

        const hint = document.createElement('span');
        Object.assign(hint.style, {
            fontSize: '11px', color: P.hint,
            marginLeft: 'auto', marginRight: '12px'
        });
        hint.textContent = 'Scroll to zoom orbits  ·  Drag to pan  ·  Scroll out at full view or ESC to return';

        // Year input
        const yearWrap = document.createElement('span');
        Object.assign(yearWrap.style, { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' });
        const yearLbl = document.createElement('span');
        yearLbl.textContent = 'Year:';
        Object.assign(yearLbl.style, { color: P.sub, whiteSpace: 'nowrap' });
        _yearInput = document.createElement('input');
        _yearInput.type = 'number'; _yearInput.value = String(_gameYear); _yearInput.step = '1';
        Object.assign(_yearInput.style, {
            width: '64px', background: 'transparent', textAlign: 'center',
            border: `1px solid ${P.badge}`, color: P.accent,
            fontFamily: 'inherit', fontSize: '11px', padding: '1px 4px'
        });
        _yearInput.addEventListener('change', () => {
            _gameYear = parseInt(_yearInput.value) || 0;
            _yearInput.value = _gameYear;
        });
        yearWrap.append(yearLbl, _yearInput);

        // Day input
        const dayWrap = document.createElement('span');
        Object.assign(dayWrap.style, { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' });
        const dayLbl = document.createElement('span');
        dayLbl.textContent = 'Day:';
        Object.assign(dayLbl.style, { color: P.sub, whiteSpace: 'nowrap' });
        _dayInput = document.createElement('input');
        _dayInput.type = 'number'; _dayInput.value = '1'; _dayInput.min = '1'; _dayInput.max = '365'; _dayInput.step = '1';
        Object.assign(_dayInput.style, {
            width: '52px', background: 'transparent', textAlign: 'center',
            border: `1px solid ${P.badge}`, color: P.accent,
            fontFamily: 'inherit', fontSize: '11px', padding: '1px 4px'
        });
        _dayInput.addEventListener('change', () => {
            const d = parseInt(_dayInput.value) || 1;
            _gameDay = Math.min(365, Math.max(1, d));
            _dayInput.value = Math.floor(_gameDay);
        });
        dayWrap.append(dayLbl, _dayInput);

        // Single speed slider — logarithmic scale 0.1–365 d/s
        // Slider pos 0–100 maps via: speed = 0.1 * 3650^(pos/100)
        const _sliderToSpeed = v => 0.1 * Math.pow(3650, v / 100);
        const _speedToSlider = s => Math.log(s / 0.1) / Math.log(3650) * 100;
        const _fmtSpeed = s => s < 1 ? s.toFixed(2) + 'd/s' : s < 10 ? s.toFixed(1) + 'd/s' : Math.round(s) + 'd/s';

        const speedWrap = document.createElement('span');
        Object.assign(speedWrap.style, { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' });
        const speedLbl = document.createElement('span');
        speedLbl.textContent = 'Speed:';
        Object.assign(speedLbl.style, { color: P.sub, whiteSpace: 'nowrap' });
        const speedSlider = document.createElement('input');
        speedSlider.type = 'range'; speedSlider.min = '0'; speedSlider.max = '100';
        speedSlider.step = '1'; speedSlider.value = String(Math.round(_speedToSlider(_speedDaysPerSec)));
        Object.assign(speedSlider.style, { width: '90px', cursor: 'pointer' });
        const speedVal = document.createElement('span');
        speedVal.textContent = _fmtSpeed(_speedDaysPerSec);
        Object.assign(speedVal.style, { color: P.accent, minWidth: '48px' });
        speedSlider.addEventListener('input', () => {
            _speedDaysPerSec = _sliderToSpeed(parseFloat(speedSlider.value));
            speedVal.textContent = _fmtSpeed(_speedDaysPerSec);
        });
        speedWrap.append(speedLbl, speedSlider, speedVal);

        // Linear scale toggle
        const linearWrap = document.createElement('label');
        Object.assign(linearWrap.style, {
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
        });
        const linearCheck = document.createElement('input');
        linearCheck.type    = 'checkbox';
        linearCheck.checked = _linearScale;
        Object.assign(linearCheck.style, { cursor: 'pointer' });
        const linearLbl = document.createElement('span');
        linearLbl.textContent = 'Linear (true scale)';
        Object.assign(linearLbl.style, { color: P.sub });
        linearCheck.addEventListener('change', () => {
            _linearScale = linearCheck.checked;
            _viewZoom = 1.0;
            _viewOffX = 0;
            _viewOffY = 0;
        });
        linearWrap.append(linearCheck, linearLbl);

        // Orbit lines slider
        const orbitWrap = document.createElement('span');
        Object.assign(orbitWrap.style, { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' });
        const orbitLbl = document.createElement('span');
        orbitLbl.textContent = 'Orbit Lines:';
        Object.assign(orbitLbl.style, { color: P.sub, whiteSpace: 'nowrap' });
        const orbitSlider = document.createElement('input');
        orbitSlider.type = 'range'; orbitSlider.min = '0'; orbitSlider.max = '1';
        orbitSlider.step = '0.05'; orbitSlider.value = String(_orbitOpacity);
        Object.assign(orbitSlider.style, { width: '70px', cursor: 'pointer' });
        orbitSlider.addEventListener('input', () => {
            _orbitOpacity = parseFloat(orbitSlider.value);
        });
        orbitWrap.append(orbitLbl, orbitSlider);

        const hideMoonsWrap = document.createElement('label');
        Object.assign(hideMoonsWrap.style, {
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
        });
        const hideMoonsChk = document.createElement('input');
        hideMoonsChk.type    = 'checkbox';
        hideMoonsChk.checked = _hideMoons;
        Object.assign(hideMoonsChk.style, { cursor: 'pointer' });
        const hideMoonsLbl = document.createElement('span');
        hideMoonsLbl.textContent = 'Hide Moons';
        Object.assign(hideMoonsLbl.style, { color: P.sub });
        hideMoonsChk.addEventListener('change', () => { _hideMoons = hideMoonsChk.checked; });
        hideMoonsWrap.append(hideMoonsChk, hideMoonsLbl);

        const hideHZWrap = document.createElement('label');
        Object.assign(hideHZWrap.style, {
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
        });
        const hideHZChk = document.createElement('input');
        hideHZChk.type    = 'checkbox';
        hideHZChk.checked = _hideHZ;
        Object.assign(hideHZChk.style, { cursor: 'pointer' });
        const hideHZLbl = document.createElement('span');
        hideHZLbl.textContent = 'Hide HZ';
        Object.assign(hideHZLbl.style, { color: P.sub });
        hideHZChk.addEventListener('change', () => { _hideHZ = hideHZChk.checked; });
        hideHZWrap.append(hideHZChk, hideHZLbl);

        const hideHighlightWrap = document.createElement('label');
        Object.assign(hideHighlightWrap.style, {
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
        });
        const hideHighlightChk = document.createElement('input');
        hideHighlightChk.type    = 'checkbox';
        hideHighlightChk.checked = _hideMainworldHighlight;
        Object.assign(hideHighlightChk.style, { cursor: 'pointer' });
        const hideHighlightLbl = document.createElement('span');
        hideHighlightLbl.textContent = 'Hide MW';
        Object.assign(hideHighlightLbl.style, { color: P.sub });
        hideHighlightChk.addEventListener('change', () => { _hideMainworldHighlight = hideHighlightChk.checked; });
        hideHighlightWrap.append(hideHighlightChk, hideHighlightLbl);

        _pauseBtn = document.createElement('button');
        _pauseBtn.textContent = '⏸';
        Object.assign(_pauseBtn.style, {
            background: 'transparent', border: `1px solid ${P.badge}`,
            color: P.accent, padding: '3px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px'
        });
        _pauseBtn.addEventListener('click', _togglePause);

        // RTT/AoW System Editor support is still preliminary and slated for an overhaul — T5
        // was closed out 2026-07-16 (OW-19/42/43/44/45/46/47) and is now exposed too.
        let editBtn = null;
        if (edition === 'MgT2E' || edition === 'CT' || edition === 'T5') {
            editBtn = document.createElement('button');
            editBtn.id = 'sv-edit-btn';
            editBtn.textContent = 'Edit System';
            Object.assign(editBtn.style, {
                background: 'transparent', border: `1px solid ${P.badge}`,
                color: P.accent, padding: '3px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '11px', whiteSpace: 'nowrap'
            });
            editBtn.addEventListener('click', () => {
                if (typeof SystemEditor !== 'undefined') SystemEditor.openEdit(_hexId);
            });
        }

        // System Sheet — renders the one-page reference sheet for this system
        // and shows it in a pop-up with a Download PNG button. Guarded on the
        // module being present so the viewer still works if js/system_sheet.js
        // is absent, exactly as the flat-map panel guards on window.TerrainPanel.
        let sheetBtn = null;
        if (window.SystemSheet) {
            sheetBtn = document.createElement('button');
            sheetBtn.id = 'sv-sheet-btn';
            sheetBtn.textContent = 'System Sheet';
            sheetBtn.title = 'Show a one-page reference sheet for this system (downloadable as a PNG)';
            Object.assign(sheetBtn.style, {
                background: 'transparent', border: `1px solid ${P.badge}`,
                color: P.accent, padding: '3px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '11px', whiteSpace: 'nowrap'
            });
            sheetBtn.addEventListener('click', async () => {
                const st = hexStates.get(_hexId);
                if (!st) return;
                const original = sheetBtn.textContent;
                sheetBtn.textContent = 'Charting…';
                sheetBtn.disabled = true;
                try {
                    // Yield one frame so "Charting…" paints before the
                    // synchronous render blocks the page.
                    await new Promise(r => requestAnimationFrame(() => r()));
                    SystemSheet.open(st, _hexId);
                } catch (err) {
                    console.error('[System Sheet] render failed:', err);
                    if (typeof showToast === 'function') showToast('The system sheet could not be drawn — see the console.', 4000);
                } finally {
                    sheetBtn.textContent = original;
                    sheetBtn.disabled = false;
                }
            });
        }

        // GIF — records the orrery as an animated GIF with the current view and
        // settings. Guarded like the sheet button on its module being loaded.
        let gifBtn = null;
        if (window.GifEncoder) {
            gifBtn = document.createElement('button');
            gifBtn.id = 'sv-gif-btn';
            gifBtn.textContent = 'GIF';
            gifBtn.title = 'Record the orrery as an animated GIF, using the current view and settings';
            Object.assign(gifBtn.style, {
                background: 'transparent', border: `1px solid ${P.badge}`,
                color: P.accent, padding: '3px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '11px', whiteSpace: 'nowrap'
            });
            gifBtn.addEventListener('click', _openGifDialog);
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: `1px solid ${P.badge}`,
            color: P.accent, padding: '3px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px'
        });
        closeBtn.addEventListener('click', close);

        header.append(...[title, editionBadge, sub, hint, yearWrap, dayWrap, speedWrap, linearWrap, orbitWrap, hideMoonsWrap, hideHZWrap, hideHighlightWrap, _pauseBtn, sheetBtn, gifBtn, editBtn, closeBtn].filter(Boolean));
        _overlay.appendChild(header);

        _orrCanvas = document.createElement('canvas');
        Object.assign(_orrCanvas.style, { display: 'block', cursor: 'crosshair' });
        _overlay.appendChild(_orrCanvas);

        _tooltip = document.createElement('div');
        Object.assign(_tooltip.style, {
            position: 'fixed', display: 'none', pointerEvents: 'none',
            background: _lightMode ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,20,0.95)',
            border: `1px solid ${P.badge}`,
            color: P.text,
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

    function _redraw() { /* animation loop redraws every frame */ }

    function _startLoop() {
        _lastFrameTime = performance.now();
        function tick(now) {
            if (!_paused) {
                const deltaDay = ((now - _lastFrameTime) / 1000) * _speedDaysPerSec;
                _gameDay += deltaDay;
                while (_gameDay > 365) { _gameDay -= 365; _gameYear++; }
                while (_gameDay < 1)   { _gameDay += 365; _gameYear--; }
                _updateDateDisplay();
            }
            _lastFrameTime = now;
            _drawOrrery();
            _animFrameId = requestAnimationFrame(tick);
        }
        _animFrameId = requestAnimationFrame(tick);
    }

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

        // Primary worlds — defined early so the companion ring pre-computation can reference them
        const primaryWorlds = worlds.filter(w =>
            w.orbitType === 'P-Type' ||
            (w.orbitType === 'S-Type' && (w.parentStarIdx === 0 || w.parentStarIdx === undefined))
        );

        // Pre-compute companion orbit ring radii that honour the true AU order.
        // A close companion gets a minimum visibility bump, but that bump is capped so
        // its ring never visually crosses outside any body at a larger AU from the same parent.
        // Sub-companions (orbiting a secondary star, not the primary) keep a small fixed floor.
        const _COMP_MIN_PX  = 20;  // desired minimum ring radius for visibility
        const _COMP_ABS_MIN =  4;  // absolute floor — ring never drawn smaller than this
        const _COMP_GAP     =  3;  // pixel gap to maintain between adjacent rings
        const _compRingR    = new Map();
        stars.slice(1).forEach(s => {
            const pIdx   = s.parentStarIdx ?? 0;
            const compAU = _starCompanionAU(s);
            const natR   = _scaleR(compAU, maxAU, scaledMaxR);
            if (_linearScale || pIdx !== 0) {
                // Linear mode or sub-companion: simple floor, no ordering constraint needed
                _compRingR.set(s, _linearScale ? Math.max(30, natR) : Math.max(8, natR));
                return;
            }
            // Primary companion: find pixel radius of nearest outer body in primary orbit
            let outerMinR = Infinity;
            primaryWorlds.forEach(w => {
                if ((w.au || 0) > compAU)
                    outerMinR = Math.min(outerMinR, _scaleR(w.au || 0, maxAU, scaledMaxR));
            });
            stars.slice(1).forEach(t => {
                if (t !== s && (t.parentStarIdx ?? 0) === 0 && _starCompanionAU(t) > compAU)
                    outerMinR = Math.min(outerMinR, _scaleR(_starCompanionAU(t), maxAU, scaledMaxR));
            });
            let r = Math.max(natR, _COMP_MIN_PX);
            if (outerMinR !== Infinity && r >= outerMinR - _COMP_GAP)
                r = Math.max(natR, outerMinR - _COMP_GAP - 1);
            _compRingR.set(s, Math.max(r, _COMP_ABS_MIN));
        });

        // Companion star screen positions
        const companions = stars.slice(1);
        const starPos    = new Map();
        starPos.set(0, { cx: originX, cy: originY });

        // Elapsed in-game years drives all orbital angles
        const elapsed_years = _gameYear + (_gameDay - 1) / 365.25;

        // Build a stable world→index map for epoch hashing
        const worldIdxMap = new Map(worlds.map((w, i) => [w, i]));

        // Companion star positions — physical Kepler periods
        companions.forEach((s, i) => {
            const compAU    = _starCompanionAU(s);
            const dist      = _compRingR.get(s);
            const parentMass = (stars[s.parentStarIdx ?? 0] || {}).mass || 1;
            const period    = s.periodYears || _keplerYears(Math.max(compAU, 0.05), parentMass);
            const epoch     = _hashEpoch(_hexId + ':star:' + (i + 1));
            const angle     = epoch + (2 * Math.PI / period) * elapsed_years;
            const parentPos = starPos.get(s.parentStarIdx ?? 0) || { cx: originX, cy: originY };
            starPos.set(i + 1, {
                cx: parentPos.cx + dist * Math.cos(angle),
                cy: parentPos.cy + dist * Math.sin(angle)
            });
        });

        if (!_lightMode) _drawStarField(ctx, W, H);

        // HZ band — hzAU is set by the normaliser for all editions
        const hzAU      = sys.hzAU !== undefined ? sys.hzAU : _orbitToAU(sys.hzco || 3);
        const hzInnerPx = _scaleR(hzAU * 0.70, maxAU, scaledMaxR);
        const hzOuterPx = _scaleR(hzAU * 1.55, maxAU, scaledMaxR);
        if (!_hideHZ) _drawHZBand(ctx, originX, originY, hzInnerPx, hzOuterPx);

        // Companion orbit rings + sub-orreries
        companions.forEach((s, i) => {
            const sIdx      = i + 1;
            const pos       = starPos.get(sIdx);
            const orbitR    = _compRingR.get(s);
            const parentPos = starPos.get(s.parentStarIdx ?? 0) || { cx: originX, cy: originY };

            if (_orbitOpacity > 0 && orbitR <= _MAX_DASHED_RING_RADIUS) {
                const orbitAlpha = _lightMode ? _orbitOpacity * 0.80 : _orbitOpacity * 0.55;
                ctx.beginPath();
                ctx.arc(parentPos.cx, parentPos.cy, orbitR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(69, 162, 158, ${orbitAlpha.toFixed(3)})`;
                ctx.lineWidth   = 1 + _orbitOpacity * 1.5;
                ctx.setLineDash([4, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            const sWorlds = worlds.filter(
                w => w.orbitType === 'S-Type' && w.parentStarIdx === sIdx
            );
            if (sWorlds.length > 0) {
                const subMaxAU    = sWorlds.reduce((m, w) => Math.max(m, w.au || 0), 0.01) * 1.2;
                const subMaxR     = orbitR * 0.28;
                const compStarMass = ((stars[sIdx] || {}).mass) || 1;
                _drawWorldSet(ctx, sWorlds, pos.cx, pos.cy, subMaxAU, subMaxR, elapsed_years, compStarMass, worldIdxMap);
            }
        });

        // Primary worlds
        if (primaryWorlds.length > 0) {
            const primaryStarMass = ((stars[0] || {}).mass) || 1;
            _drawWorldSet(ctx, primaryWorlds, originX, originY, maxAU, scaledMaxR, elapsed_years, primaryStarMass, worldIdxMap);
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

    function _drawWorldSet(ctx, worldList, cx, cy, maxAU, maxPx, elapsed_years, starMass, worldIdxMap) {
        const isBelt = w => w.type === 'Planetoid Belt' || _isMainworldBelt(w);
        const belts  = worldList.filter(isBelt);
        const bodies = worldList.filter(w => !isBelt(w));

        belts.forEach(w => {
            const r      = _scaleR(w.au || 0, maxAU, maxPx);
            const isMW   = _isMainworldBelt(w);
            const wIdx   = worldIdxMap.get(w) ?? 0;
            const period = _worldPeriodYears(w, starMass);
            const epoch  = _hashEpoch(_hexId + ':world:' + wIdx);
            const angle  = epoch + (2 * Math.PI / period) * elapsed_years;
            _drawBeltRing(ctx, cx, cy, r, isMW && !_hideMainworldHighlight, -(angle * r));
            if (isMW && w.name && !_hideMainworldHighlight) {
                ctx.save();
                ctx.fillStyle = _lightMode ? '#0d6b64' : '#66fcf1';
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

        if (_orbitOpacity > 0) bodies.forEach(w => {
            const r = _scaleR(w.au || 0, maxAU, maxPx);
            if (r < 2) return;
            const worldAlpha = _lightMode ? _orbitOpacity * 0.65 : _orbitOpacity * 0.40;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(69, 162, 158, ${worldAlpha.toFixed(3)})`;
            ctx.lineWidth   = 1 + _orbitOpacity * 1.5;
            ctx.stroke();
        });

        bodies.forEach(w => {
            const r      = _scaleR(w.au || 0, maxAU, maxPx);
            const wIdx   = worldIdxMap.get(w) ?? 0;
            const period = _worldPeriodYears(w, starMass);
            const epoch  = _hashEpoch(_hexId + ':world:' + wIdx);
            const angle  = epoch + (2 * Math.PI / period) * elapsed_years;
            const px     = cx + r * Math.cos(angle);
            const py     = cy + r * Math.sin(angle);
            _drawWorld(ctx, w, px, py, elapsed_years, wIdx);
        });
    }

    // ── Element drawing ───────────────────────────────────────────────────────

    function _drawStarField(ctx, W, H) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        let s = 0xdeadbeef;
        const _r = () => { s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) + 1) | 0; return (s >>> 0) / 0x100000000; };
        for (let i = 0; i < 280; i++) {
            const x = _r() * W;
            const y = _r() * H;
            const r = _r() < 0.18 ? 0.9 : 0.45;
            ctx.globalAlpha = 0.08 + _r() * 0.22;
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
        glow.addColorStop(0, color + (_lightMode ? '66' : 'aa'));
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
        ctx.fillStyle = _lightMode ? '#1a1a2e' : '#c5c6c7';
        ctx.font      = '11px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.name, cx, cy + r + 15);
        if (idx > 0 && s.separation) {
            ctx.fillStyle = _lightMode ? '#4a5568' : '#65706e';
            ctx.font      = '10px "Share Tech Mono", monospace';
            ctx.fillText(s.separation, cx, cy + r + 27);
        }
        ctx.restore();
    }

    // A planetary ring — a thin static stroked circle, not an animated orbiting dot. Shared by
    // CT (a moon-slot whose size roll came up 'R', living inside w.moons[]/satellites[]) and
    // MgT2E (the same RAW rule, but stored separately on the planet as w.rings[] rather than
    // inside w.moons[] — see mgt2e_world_engine.js's moon-size-roll-of-'R' branches). Distinct
    // styling from _drawBeltRing's dashed belt line (solid, thinner, silvery) so the two read as
    // different things at a glance.
    function _drawStaticRing(ctx, px, py, dist) {
        ctx.beginPath();
        ctx.arc(px, py, dist, 0, Math.PI * 2);
        ctx.strokeStyle = _lightMode ? '#8a8f9488' : '#c8ccd0aa';
        ctx.lineWidth   = 1;
        ctx.stroke();
    }

    function _drawWorld(ctx, w, px, py, elapsed_years, wIdx) {
        const r     = _worldBodyRadius(w);
        const color = (_hideMainworldHighlight && w.type === 'Mainworld') ? '#a0a0b0' : _worldColor(w);

        if (w.type === 'Mainworld' && !_hideMainworldHighlight) {
            ctx.beginPath();
            ctx.arc(px, py, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = _lightMode ? '#0d6b64' : '#66fcf1';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        const moons = (w.moons || []).filter(m => m.type !== 'Empty');
        if (!_hideMoons) moons.forEach((m, mi) => {
            const mDist = r + 10 + mi * 6;

            // A Ring (CT: size === 'R', from either generation path — Bottom-Up also sets
            // type:'Ring' but Top-Down doesn't, so size is the one field both paths agree on)
            // is a band around the planet, not a discrete orbiting body — skip the per-frame
            // orbital angle entirely and draw a thin static circle instead.
            if (m.size === 'R') {
                _drawStaticRing(ctx, px, py, mDist);
                _hitBodies.push({ kind: 'moon', body: m, cx: px, cy: py, r: mDist + 3, innerR: mDist - 3 });
                return;
            }

            const period = _moonPeriodYears(m, w);
            const mAngle = _hashEpoch(_hexId + ':moon:' + wIdx + ':' + mi)
                         + (2 * Math.PI / period) * elapsed_years;
            const mx          = px + mDist * Math.cos(mAngle);
            const my          = py + mDist * Math.sin(mAngle);
            const isMainworld = m.type === 'Mainworld';
            const moonR       = isMainworld ? 5 : 3;

            if (isMainworld && !_hideMainworldHighlight) {
                ctx.beginPath();
                ctx.arc(mx, my, moonR + 3, 0, Math.PI * 2);
                ctx.strokeStyle = _lightMode ? '#0d6b64' : '#66fcf1';
                ctx.lineWidth   = 1.2;
                ctx.stroke();
            }

            ctx.fillStyle = (isMainworld && !_hideMainworldHighlight) ? '#4fc3a1' : '#6a7070';
            ctx.beginPath();
            ctx.arc(mx, my, moonR, 0, Math.PI * 2);
            ctx.fill();

            if (isMainworld && m.name && !_hideMainworldHighlight) {
                ctx.save();
                ctx.fillStyle = _lightMode ? '#0d6b64' : '#66fcf1';
                ctx.font      = '10px "Share Tech Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(m.name, mx, my - moonR - 5);
                ctx.restore();
            }

            _hitBodies.push({ kind: 'moon', body: m, cx: mx, cy: my, r: Math.max(moonR + 6, 9) });
        });

        // MgT2E rings: RAW's "moon-size roll comes up Ring" outcome is stored on the planet
        // itself (w.rings[]), not inside w.moons[] the way CT's is — see mgt2e_world_engine.js's
        // moon-size-roll-of-'R' branches, which push({}) onto w.rings instead of w.moons. Not
        // interleaved with the moon index sequence above, so rings get their own close-in offset.
        const rings = w.rings || [];
        if (!_hideMoons) rings.forEach((rg, ri) => {
            const rDist = r + 6 + ri * 5;
            _drawStaticRing(ctx, px, py, rDist);
            _hitBodies.push({ kind: 'ring', body: rg, cx: px, cy: py, r: rDist + 3, innerR: rDist - 3 });
        });

        if (w.type === 'Mainworld' && w.name && !_hideMainworldHighlight) {
            ctx.save();
            ctx.fillStyle = _lightMode ? '#0d6b64' : '#66fcf1';
            ctx.font      = '11px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(w.name, px, py - r - 8);
            ctx.restore();
        }

        _hitBodies.push({ kind: 'world', body: w, cx: px, cy: py, r: Math.max(r + 9, 14) });
    }

    function _drawBeltRing(ctx, cx, cy, r, isMainworld = false, dashOffset = 0) {
        if (r < 2 || r > _MAX_DASHED_RING_RADIUS) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle    = isMainworld ? '#4fc3a188' : '#88888855';
        ctx.lineWidth      = isMainworld ? 7 : 5;
        ctx.lineDashOffset = dashOffset;
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
        const cx        = _canvasW / 2;
        const cy        = _canvasH / 2;
        let   mx        = e.clientX - rect.left;
        let   my        = e.clientY - rect.top;

        // Snap to the exact center when the cursor is within a tight tolerance. Mouse
        // coordinates are always whole pixels, but a canvas with an odd width/height has
        // a fractional center (e.g. 357.5) — that sub-pixel gap gets multiplied by `factor`
        // on every tick (offset ~= gap * (1 - factor^n)), so it compounds into a pan large
        // enough to fling the primary off-screen well before reaching deep zoom levels,
        // even though the cursor never actually moved off center.
        const SNAP_PX = 3;
        if (Math.abs(mx - cx) <= SNAP_PX) mx = cx;
        if (Math.abs(my - cy) <= SNAP_PX) my = cy;

        if (direction > 0) {
            const newZoom = Math.min(_viewZoom * factor, _MAX_ZOOM);
            const ratio   = newZoom / _viewZoom;
            _viewOffX = mx - cx - (mx - cx - _viewOffX) * ratio;
            _viewOffY = my - cy - (my - cy - _viewOffY) * ratio;
            _viewZoom = newZoom;
            _redraw();
        } else {
            const newZoom = _viewZoom / factor;
            if (newZoom < 0.5) {
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

    // Gravity may be a STRING: RTT gas giants store "Variable (Giant)". It is
    // RAW data, so it prints as stored (Sean, 2026-09-23); calling .toFixed on
    // it threw and killed the tooltip on every RTT gas giant.
    function _fmtGravity(g) {
        return typeof g === 'number' ? `${g.toFixed(2)} G` : String(g);
    }

    function _showTooltip(hit, mx, my) {
        if (!_tooltip) return;
        const body    = hit.body;
        const TH      = _lightMode ? '#0d6b64' : '#66fcf1';   // tooltip heading colour
        const TSUB    = _lightMode ? '#4a5568' : '#8a8f94';   // tooltip secondary colour
        const TBORDER = _lightMode ? '#45a29eaa' : '#45a29e44';
        let html      = '';

        if (hit.kind === 'star') {
            const s = body;
            html += `<div style="color:${TH};margin-bottom:5px;border-bottom:1px solid ${TBORDER};padding-bottom:4px">`;
            html += `${s.name} <span style="color:${TSUB}">(${s.role || 'Primary'})</span></div>`;
            html += `<div>Type: ${s.sType}${s.subType ?? ''} ${s.sClass}</div>`;
            if (s.temp)       html += `<div>Temperature: ${Math.round(s.temp).toLocaleString()} K</div>`;
            if (s.mass)       html += `<div>Mass: ${s.mass.toFixed(3)} M☉</div>`;
            if (s.diam)       html += `<div>Diameter: ${s.diam.toFixed(3)} D☉</div>`;
            if (s.lum)        html += `<div>Luminosity: ${s.lum.toFixed(4)} L☉</div>`;
            if (s.separation) html += `<div>Separation: ${s.separation}</div>`;
            if (s.role !== 'Primary') {
                const compAU = _starCompanionAU(s);
                if (compAU)   html += `<div>Distance: ${compAU.toFixed(3)} AU</div>`;
            }

        } else if (hit.kind === 'world') {
            const w = body;
            const _displayType = w.ggType ? `${w.type} ${w.ggType}` : (w.worldType || w.type);
            const typeTag = w.name
                ? ` <span style="color:${TSUB}">(${_displayType})</span>`
                : '';
            html += `<div style="color:${TH};margin-bottom:5px;border-bottom:1px solid ${TBORDER};padding-bottom:4px">`;
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
            if (w.gravity)         html += `<div>Gravity: ${_fmtGravity(w.gravity)}</div>`;
            if (w.meanTempK)       html += `<div>Mean Temp: ${Math.round(w.meanTempK - 273.15)}°C</div>`;
            const moons = (w.moons || []).filter(m => m.type !== 'Empty');
            if (moons.length)      html += `<div style="margin-top:4px">Moons: ${moons.length}</div>`;

        } else if (hit.kind === 'moon') {
            const m           = body;
            const isMainworld = m.type === 'Mainworld';
            const label       = m.name || (isMainworld ? 'Mainworld (Moon)' : 'Moon');
            const typeLabel   = isMainworld ? 'Mainworld Satellite' : 'Satellite';
            html += `<div style="color:${TH};margin-bottom:5px;border-bottom:1px solid ${TBORDER};padding-bottom:4px">`;
            html += `${label} <span style="color:${TSUB}">(${typeLabel})</span></div>`;
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
            if (m.gravity)         html += `<div>Gravity: ${_fmtGravity(m.gravity)}</div>`;
            if (m.meanTempK)       html += `<div>Mean Temp: ${Math.round(m.meanTempK - 273.15)}°C</div>`;
            if (m.size != null)    html += `<div>Size: ${m.size}</div>`;

        } else if (hit.kind === 'belt') {
            const beltName = body.name ? `${body.name} ` : '';
            html += `<div style="color:${TH};margin-bottom:5px;border-bottom:1px solid ${TBORDER};padding-bottom:4px">`;
            html += `${beltName}<span style="color:${TSUB}">(Planetoid Belt)</span></div>`;
            if (body.orbitId != null) html += `<div>Orbit #: ${body.orbitId.toFixed ? body.orbitId.toFixed(2) : body.orbitId}</div>`;
            if (body.au)              html += `<div>Distance: ${body.au.toFixed(3)} AU</div>`;
            if (body.uwp)             html += `<div style="margin-top:4px">UWP: <strong>${body.uwp}</strong></div>`;
            if (body.starport)        html += `<div>Spaceport: ${body.starport}</div>`;
            if (body.tl != null)      html += `<div>TL: ${body.tl}</div>`;
            if (body.tradeCodes && body.tradeCodes.length)
                                      html += `<div>Codes: ${body.tradeCodes.join(' ')}</div>`;
            if (body.travelZone && body.travelZone !== 'G')
                                      html += `<div>Zone: ${body.travelZone}</div>`;
            if (body.resourceRating != null) html += `<div style="margin-top:4px">Resource: ${body.resourceRating}</div>`;
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
        // The GIF dialog sits on top of the orrery: Escape closes it (and
        // cancels any recording) without also closing the orrery.
        if (e.key === 'Escape' && _gifDialog) { _closeGifDialog(); return; }
        if (e.key === 'Escape' && isOpen() &&
            !(window.SystemSheet    && window.SystemSheet.isOpen()) &&
            !(window.SurfaceViewer  && window.SurfaceViewer.isOpen()) &&
            !(window.ApproachViewer && window.ApproachViewer.isOpen())) close();
    });

    function normalizeSystem(state) {
        const found = _detectSystem(state);
        if (!found) return null;
        let n;
        if      (found.edition === 'AoW')   n = _normalizeAoW(found.raw);
        else if (found.edition === 'MgT2E') n = _normalizeMgT2E(found.raw);
        else if (found.edition === 'CT')    n = _normalizeCT(found.raw);
        else if (found.edition === 'T5')    n = _normalizeT5(found.raw);
        else                                n = _normalizeRTT(found.raw);
        _attachReported(n, found, state);
        return n;
    }

    // REPORTED BUT NOT CHARTED (system sheet R5, ruled 2026-09-23). A hex can
    // carry real stars and a full mainworld record with no orbits at all - every
    // hex of a TravellerMap import (Spinward Marches: 439/439). `worlds` stays
    // EMPTY, so the orrery and exporters see exactly what they always did; the
    // mainworld is offered separately as `reportedMainworld`, with NO distance
    // (it has none - never invent one), plus the counts the save reports.
    // Only CT and T5 world normalisers are wired here: they are the editions
    // whose raw `mainworld` is a UWP-bearing record. AoW's bodiless hexes carry
    // a barren-system stub with no UWP, and RTT's an X000000-0 placeholder -
    // neither is a reported world, and both are left alone.
    function _attachReported(n, found, state) {
        if (!n) return;
        const live = (n.worlds || []).some(w => w && w.type !== 'Empty');
        const rmw = found.raw && found.raw.mainworld;
        if (live || !rmw || !rmw.uwp) return;
        let w = null;
        if (found.edition === 'T5')      w = _normT5World(rmw, 0, 0, rmw);
        else if (found.edition === 'CT') w = _normCTWorld(rmw, 0, rmw, 0);
        if (!w) return;
        w.type = 'Mainworld';
        w.au = null;
        w.moons = [];
        n.reportedMainworld = w;
        n.reported = {
            belts:     state.beltCount     ?? rmw.planetoidBelts ?? null,
            gasGiants: state.gasGiantCount ?? rmw.gasGiantsCount ?? null,
            worlds:    rmw.worldCount      ?? found.raw.totalWorlds ?? null,
        };
    }

    // ── Snapshot auto-fit ────────────────────────────────────────────────────
    // Computes the viewZoom that makes the outermost body fill FILL_FRAC of the
    // available canvas radius, using the same log-scale formula as _drawOrrery.
    // Mirrors the maxAU logic in _drawOrrery exactly so the two stay in sync.
    function _autoFitZoom(normalised, width, height) {
        const FILL_FRAC = 0.85;
        const MARGIN    = 70;   // must match _drawOrrery's margin constant

        // Find the true outermost orbital distance across all worlds + companions
        let actualMaxAU = 0;
        (normalised.worlds || []).forEach(w => {
            if ((w.au || 0) > actualMaxAU) actualMaxAU = w.au;
        });
        (normalised.stars || []).slice(1).forEach(s => {
            const au = _starCompanionAU(s);
            if (au > actualMaxAU) actualMaxAU = au;
        });

        // Mirror _drawOrrery's floor: rawMaxAU is what _drawOrrery passes to _scaleR
        const rawMaxAU = Math.max(actualMaxAU * 1.18, 2);

        // log-scale: r = baseMaxR * zoom * log(1+au) / log(1+rawMaxAU)
        // Solve for zoom so the outermost body lands at FILL_FRAC * baseMaxR:
        //   zoom = FILL_FRAC * log(1+rawMaxAU) / log(1+actualMaxAU)
        const logActual = Math.log(1 + actualMaxAU);
        const logRaw    = Math.log(1 + rawMaxAU);
        const zoom      = logActual > 0 ? FILL_FRAC * logRaw / logActual : 1.0;

        return Math.max(0.5, Math.min(zoom, 20.0));
    }

    // ── Off-screen render state ──────────────────────────────────────────────
    // Every module-level variable _drawOrrery() reads or writes. An off-screen
    // render (the PNG snapshot, each GIF frame) installs its own values, draws,
    // and puts the live viewer's values back. Add to BOTH functions below if
    // _drawOrrery ever starts reading another module variable, or off-screen
    // renders will silently pick up the live viewer's value instead.
    function _captureRenderState() {
        return {
            orrCtx:                 _orrCtx,
            canvasW:                _canvasW,
            canvasH:                _canvasH,
            sys:                    _sys,
            hexId:                  _hexId,
            gameYear:               _gameYear,
            gameDay:                _gameDay,
            viewZoom:               _viewZoom,
            viewOffX:               _viewOffX,
            viewOffY:               _viewOffY,
            lightMode:              _lightMode,
            linearScale:            _linearScale,
            orbitOpacity:           _orbitOpacity,
            hitBodies:              _hitBodies,
            hideMoons:              _hideMoons,
            hideHZ:                 _hideHZ,
            hideMainworldHighlight: _hideMainworldHighlight,
        };
    }

    function _installRenderState(s) {
        _orrCtx                 = s.orrCtx;
        _canvasW                = s.canvasW;
        _canvasH                = s.canvasH;
        _sys                    = s.sys;
        _hexId                  = s.hexId;
        _gameYear               = s.gameYear;
        _gameDay                = s.gameDay;
        _viewZoom               = s.viewZoom;
        _viewOffX               = s.viewOffX;
        _viewOffY               = s.viewOffY;
        _lightMode              = s.lightMode;
        _linearScale            = s.linearScale;
        _orbitOpacity           = s.orbitOpacity;
        _hitBodies              = s.hitBodies || [];
        _hideMoons              = s.hideMoons;
        _hideHZ                 = s.hideHZ;
        _hideMainworldHighlight = s.hideMainworldHighlight;
    }

    // Draws one frame with `state` installed and always restores the live
    // values, even if the draw throws. Synchronous by design: nothing else can
    // run between install and restore, so the live animation loop never sees
    // a half-swapped state.
    function _drawWith(state) {
        const saved = _captureRenderState();
        _installRenderState(state);
        try {
            _drawOrrery();
        } finally {
            _installRenderState(saved);
        }
    }

    // ── Animated GIF export ──────────────────────────────────────────────────
    // Records the open orrery as an animated GIF using the viewer's CURRENT
    // view and settings (Sean, 2026-10-17): zoom and pan, speed, Hide Moons /
    // HZ / MW, linear scale, orbit-line opacity, light mode, and the date on
    // screen as the first frame. In-app only — the exporters still use the
    // static PNG from renderSnapshot.
    //
    // Body positions are a pure function of elapsed_years (see _drawOrrery),
    // so frame k is simply "draw at start + k steps"; nothing depends on wall
    // clock time, and the same settings always give the same GIF.

    const _GIF_WIDTHS      = [480, 640, 800, 1024, 1280];
    const _GIF_FPS         = [10, 15, 20, 25];
    const _GIF_MAX_SECONDS = 60;

    let _gifJob    = null;   // { cancelled } while a recording runs
    let _gifDialog = null;   // the GIF options dialog element, when open

    // Output sizes offered for the current window: never wider than the live
    // canvas, and tall enough that _drawOrrery's fixed 70px margin still
    // leaves room for the system.
    function _gifSizes() {
        const sizes = _GIF_WIDTHS
            .filter(w => w <= _canvasW)
            .map(w => ({ w, h: Math.round(w * _canvasH / _canvasW) }))
            .filter(s => Math.min(s.w, s.h) / 2 - 70 >= 40);
        if (!sizes.length) sizes.push({ w: Math.round(_canvasW), h: Math.round(_canvasH) });
        return sizes;
    }

    // The body whose orbit the "one orbit" preset loops on: the mainworld, or
    // for a lunar mainworld its parent planet, since that is the motion the
    // orrery shows around the star. Star mass is chosen exactly as
    // _drawOrrery chooses it, so the period matches what is drawn.
    // Returns { name, periodYears } or null.
    function _mainworldOrbit(sys) {
        if (!sys) return null;
        const worlds = (sys.worlds || []).filter(w => w.type !== 'Empty');
        let w = worlds.find(x => x.type === 'Mainworld');
        let name = w && w.name;
        if (!w) {
            w = worlds.find(x => (x.moons || []).some(m => m.type === 'Mainworld'));
            if (!w) return null;
            const moon = w.moons.find(m => m.type === 'Mainworld');
            name = (moon && moon.name) || w.name;
        }
        const stars = sys.stars || [];
        const sIdx  = (w.orbitType === 'S-Type' && w.parentStarIdx > 0) ? w.parentStarIdx : 0;
        const mass  = ((stars[sIdx] || {}).mass) || 1;
        const periodYears = _worldPeriodYears(w, mass);
        if (!(periodYears > 0) || !isFinite(periodYears)) return null;
        return { name: name || 'mainworld', periodYears };
    }

    // Frame plan for the dialog's choices. In orbit mode the step is adjusted
    // (by less than one frame's worth) so the last frame lands exactly one
    // period after the first, which is what makes the loop seamless.
    function _gifPlan(seconds, fps, orbitMode) {
        const delayCs     = Math.round(100 / fps);
        const daysPerFrame = _speedDaysPerSec * delayCs / 100;
        let frames = Math.max(2, Math.round(seconds * 100 / delayCs));
        let yearsPerFrame = daysPerFrame / 365.25;
        if (orbitMode) {
            const orbit = _mainworldOrbit(_sys);
            if (orbit) {
                const want = Math.round(orbit.periodYears / yearsPerFrame);
                frames = Math.max(2, Math.min(want, Math.round(_GIF_MAX_SECONDS * 100 / delayCs)));
                if (want === frames) yearsPerFrame = orbit.periodYears / frames;
            }
        }
        return { delayCs, frames, yearsPerFrame, daysPerFrame: yearsPerFrame * 365.25 };
    }

    // Renders the GIF. opts: { width, fps, seconds, orbit }.
    // onProgress(done, total) is called between batches. Resolves to
    // { bytes, width, height, frames } or null when cancelled.
    //
    // The live animation loop is stopped for the duration and restarted at
    // the end. Each frame is drawn through _drawWith, which installs and
    // restores state synchronously, but the recording itself yields between
    // batches so the progress bar can paint; stopping the loop means the
    // live view cannot advance (or be drawn) while that happens.
    async function renderGif(opts, onProgress) {
        if (!_overlay || !_sys) throw new Error('The orrery is not open.');
        if (_gifJob) throw new Error('A GIF is already being recorded.');
        if (typeof GifEncoder === 'undefined') throw new Error('js/gif_encoder.js is not loaded.');

        const job = { cancelled: false };
        _gifJob = job;
        cancelAnimationFrame(_animFrameId);
        _animFrameId = null;

        try {
            const sizes = _gifSizes();
            const size  = sizes.find(s => s.w === opts.width) || sizes[sizes.length - 1];
            const outW  = size.w, outH = size.h;
            const plan  = _gifPlan(opts.seconds, opts.fps, !!opts.orbit);

            // Match the screen: same framing at a smaller size. Body sizes and
            // label text are fixed in pixels (semantic zoom), so rather than
            // shrinking the whole picture, the zoom is rescaled so the orbits
            // fill the same fraction of the frame as they do on screen.
            const s        = outW / _canvasW;
            const liveBase = Math.min(_canvasW, _canvasH) / 2 - 70;
            const outBase  = Math.min(outW, outH) / 2 - 70;

            const canvas  = document.createElement('canvas');
            canvas.width  = outW;
            canvas.height = outH;
            const ctx     = canvas.getContext('2d', { willReadFrequently: true });
            const bg      = _lightMode ? '#ffffff' : '#000000';

            const base = Object.assign(_captureRenderState(), {
                orrCtx:   ctx,
                canvasW:  outW,
                canvasH:  outH,
                viewZoom: _viewZoom * (liveBase * s) / outBase,
                viewOffX: _viewOffX * s,
                viewOffY: _viewOffY * s,
                gameYear: 0,
                hitBodies: [],
            });
            const startYears = _gameYear + (_gameDay - 1) / 365.25;

            // _drawOrrery computes elapsed_years = _gameYear + (_gameDay - 1) / 365.25,
            // so year 0 with a fractional day gives an exact elapsed time.
            function frame(k) {
                base.gameDay = 1 + (startYears + k * plan.yearsPerFrame) * 365.25;
                _drawWith(base);
                ctx.save();
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, outW, outH);
                ctx.restore();
                return ctx.getImageData(0, 0, outW, outH).data;
            }

            // One palette for the whole animation, from evenly spaced sample frames.
            const SAMPLES = Math.min(8, plan.frames);
            const samples = [];
            for (let i = 0; i < SAMPLES; i++)
                samples.push(frame(Math.round(i * (plan.frames - 1) / Math.max(1, SAMPLES - 1))));
            const enc = GifEncoder.create(outW, outH, GifEncoder.buildPalette(samples), { loop: 0 });
            samples.length = 0;

            let lastYield = performance.now();
            for (let k = 0; k < plan.frames; k++) {
                if (job.cancelled) return null;
                enc.addFrame(frame(k), plan.delayCs);
                if (performance.now() - lastYield > 40) {
                    if (onProgress) onProgress(k + 1, plan.frames);
                    await new Promise(r => setTimeout(r, 0));
                    lastYield = performance.now();
                }
            }
            if (job.cancelled) return null;
            if (onProgress) onProgress(plan.frames, plan.frames);
            return { bytes: enc.finish(), width: outW, height: outH, frames: plan.frames };
        } finally {
            _gifJob = null;
            if (_overlay && _animFrameId === null) _startLoop();
        }
    }

    function _gifFilename() {
        const state = (typeof hexStates !== 'undefined') ? hexStates.get(_hexId) : null;
        let name = _hexId;
        if (state && window.SystemSheet && SystemSheet.resolveSystemName) {
            const orbit = _mainworldOrbit(_sys);
            name = SystemSheet.resolveSystemName(normalizeSystem(state), state,
                                                 orbit ? { name: orbit.name } : null, _hexId);
        }
        const safe = s => String(s).replace(/[^a-z0-9]+/gi, '_');
        return `${safe(name)}_${safe(_hexId)}_orrery.gif`;
    }

    function _closeGifDialog() {
        if (_gifJob) _gifJob.cancelled = true;
        if (_gifDialog) _gifDialog.remove();
        _gifDialog = null;
    }

    function _openGifDialog() {
        if (_gifDialog || !_overlay) return;

        const P = _lightMode
            ? { bg: '#ffffff', border: '#45a29e', text: '#1a1a2e', accent: '#0d6b64', sub: '#4a5568', warn: '#b45309' }
            : { bg: '#0b0f14', border: '#45a29e', text: '#c5c6c7', accent: '#66fcf1', sub: '#8a8f94', warn: '#f0b45a' };

        const backdrop = document.createElement('div');
        backdrop.id = 'sv-gif-dialog';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0', zIndex: '9200',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Share Tech Mono", "Courier New", monospace'
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
            background: P.bg, color: P.text, border: `1px solid ${P.border}`,
            padding: '16px 20px', width: '380px', maxWidth: 'calc(100vw - 32px)',
            fontSize: '12px', lineHeight: '1.6'
        });
        backdrop.appendChild(box);

        const el = (tag, text, style) => {
            const e = document.createElement(tag);
            if (text != null) e.textContent = text;
            if (style) Object.assign(e.style, style);
            return e;
        };
        const inputStyle = {
            background: 'transparent', border: `1px solid ${P.border}`, color: P.accent,
            fontFamily: 'inherit', fontSize: '12px', padding: '2px 4px'
        };
        const btnStyle = {
            background: 'transparent', border: `1px solid ${P.border}`, color: P.accent,
            padding: '3px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px'
        };
        const row = (label, ...controls) => {
            const r = el('div', null, { display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' });
            r.append(el('span', label, { color: P.sub, width: '90px', flexShrink: '0' }), ...controls);
            return r;
        };

        const title = el('div', 'Export Orrery GIF', { color: P.accent, fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' });

        const settingsLine = el('div', [
            `Speed ${_speedDaysPerSec < 10 ? _speedDaysPerSec.toFixed(1) : Math.round(_speedDaysPerSec)} d/s`,
            _hideMoons ? 'moons hidden' : 'moons shown',
            _hideHZ ? 'HZ hidden' : 'HZ shown',
            _linearScale ? 'linear scale' : 'log scale',
        ].join(' · '), { color: P.sub, marginBottom: '8px' });
        const settingsHint = el('div', 'Uses the current view and settings. Change them in the orrery header first.',
            { color: P.sub, fontSize: '11px', marginBottom: '8px' });

        const secInput = el('input', null, Object.assign({ width: '60px' }, inputStyle));
        secInput.type = 'number'; secInput.min = '1'; secInput.max = String(_GIF_MAX_SECONDS);
        secInput.step = '0.5'; secInput.value = '6';

        const orbit = _mainworldOrbit(_sys);
        let orbitMode = false;
        const orbitBtn = el('button', orbit ? `One orbit of ${orbit.name}` : 'No mainworld orbit',
            Object.assign({}, btnStyle, { padding: '2px 8px', fontSize: '11px' }));
        orbitBtn.disabled = !orbit;
        if (!orbit) orbitBtn.style.opacity = '0.5';

        const fpsSel = el('select', null, inputStyle);
        _GIF_FPS.forEach(f => {
            const o = el('option', `${f} fps`); o.value = String(f);
            if (f === 15) o.selected = true;
            fpsSel.appendChild(o);
        });

        const sizes   = _gifSizes();
        const sizeSel = el('select', null, inputStyle);
        const defW    = (sizes.find(s => s.w === 800) || sizes[sizes.length - 1]).w;
        sizes.forEach(s => {
            const o = el('option', `${s.w} × ${s.h}`); o.value = String(s.w);
            if (s.w === defW) o.selected = true;
            sizeSel.appendChild(o);
        });

        const info = el('div', '', { color: P.sub, marginTop: '8px' });
        const warn = el('div', '', { color: P.warn, fontSize: '11px' });

        const barWrap = el('div', null, { height: '6px', border: `1px solid ${P.border}`, marginTop: '10px', display: 'none' });
        const bar     = el('div', null, { height: '100%', width: '0%', background: P.accent });
        barWrap.appendChild(bar);

        const recordBtn = el('button', 'Record', btnStyle);
        const cancelBtn = el('button', 'Cancel', btnStyle);
        const btnRow = el('div', null, { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' });
        btnRow.append(recordBtn, cancelBtn);

        function seconds() {
            const v = parseFloat(secInput.value);
            return Math.min(_GIF_MAX_SECONDS, Math.max(1, isFinite(v) ? v : 6));
        }

        function refreshInfo() {
            const fps  = parseInt(fpsSel.value, 10);
            const plan = _gifPlan(seconds(), fps, orbitMode);
            const secs = plan.frames * plan.delayCs / 100;
            const size = sizes.find(s => s.w === parseInt(sizeSel.value, 10)) || sizes[0];
            info.textContent = `${plan.frames} frames · ${secs.toFixed(1)} s · ${size.w} × ${size.h} · ${plan.daysPerFrame < 1 ? plan.daysPerFrame.toFixed(2) : plan.daysPerFrame.toFixed(1)} days per frame`;

            const notes = [];
            if (orbitMode && orbit) {
                const want = orbit.periodYears * 365.25 / _speedDaysPerSec;
                if (want > _GIF_MAX_SECONDS)
                    notes.push(`One orbit of ${orbit.name} takes ${Math.round(want)} s at this speed — capped at ${_GIF_MAX_SECONDS} s, so it will not loop cleanly. Raise the speed to fit a full orbit.`);
            }
            const hasMoons = (_sys.worlds || []).some(w => (w.moons || []).some(m => m.type !== 'Empty' && m.size !== 'R'));
            if (!_hideMoons && hasMoons && plan.daysPerFrame > 1)
                notes.push(`Each frame jumps ${plan.daysPerFrame.toFixed(1)} days, so fast moons will appear to hop about. Hide Moons or slow the speed for smoother moons.`);
            warn.textContent = notes.join(' ');
        }

        orbitBtn.addEventListener('click', () => {
            if (!orbit) return;
            orbitMode = true;
            const plan = _gifPlan(_GIF_MAX_SECONDS, parseInt(fpsSel.value, 10), true);
            secInput.value = String(Math.round(plan.frames * plan.delayCs) / 100);
            refreshInfo();
        });
        secInput.addEventListener('input', () => { orbitMode = false; refreshInfo(); });
        fpsSel.addEventListener('change', () => {
            if (orbitMode) {
                const plan = _gifPlan(_GIF_MAX_SECONDS, parseInt(fpsSel.value, 10), true);
                secInput.value = String(Math.round(plan.frames * plan.delayCs) / 100);
            }
            refreshInfo();
        });
        sizeSel.addEventListener('change', refreshInfo);

        // Escape is handled by the viewer's own Escape listener (see "ESC"),
        // which closes this dialog before it would close the orrery.
        cancelBtn.addEventListener('click', _closeGifDialog);
        backdrop.addEventListener('mousedown', e => { if (e.target === backdrop && !_gifJob) _closeGifDialog(); });

        recordBtn.addEventListener('click', async () => {
            [secInput, fpsSel, sizeSel, orbitBtn, recordBtn].forEach(c => { c.disabled = true; });
            recordBtn.textContent = 'Recording…';
            barWrap.style.display = 'block';
            try {
                const result = await renderGif({
                    width:   parseInt(sizeSel.value, 10),
                    fps:     parseInt(fpsSel.value, 10),
                    seconds: seconds(),
                    orbit:   orbitMode,
                }, (done, total) => {
                    bar.style.width = (100 * done / total).toFixed(1) + '%';
                    info.textContent = `Recording frame ${done} of ${total}…`;
                });
                if (!result) return;   // cancelled
                const name = _gifFilename();
                const ok = (typeof downloadBlob === 'function')
                    ? downloadBlob(result.bytes, name, 'image/gif') : false;
                if (typeof showToast === 'function') {
                    showToast(ok ? `Saved ${name} (${Math.round(result.bytes.length / 1024)} KB)`
                                 : 'The GIF could not be downloaded — see the console.', ok ? 3000 : 4000);
                }
                _closeGifDialog();
            } catch (err) {
                console.error('[Orrery GIF] recording failed:', err);
                if (typeof showToast === 'function') showToast('The GIF could not be recorded — see the console.', 4000);
                _closeGifDialog();
            }
        });

        box.append(title, settingsLine, settingsHint,
            row('Length (s)', secInput, orbitBtn),
            row('Frame rate', fpsSel),
            row('Size', sizeSel),
            info, warn, barWrap, btnRow);

        document.body.appendChild(backdrop);
        _gifDialog = backdrop;
        refreshInfo();
        recordBtn.focus();
    }

    // ── Snapshot export ───────────────────────────────────────────────────────
    // Renders one static orrery frame to an off-screen canvas and returns the
    // PNG bytes as a Uint8Array.  Safe to call while the live viewer is closed;
    // all module-level render state is saved and fully restored afterwards.
    // Returns null if the state has no detectable system.
    // `opts` (optional, Release 2 / WP5 slice 5d):
    //   level — a disclosure level ('a'..'g'). Absent/null = GM, unchanged.
    //
    // Deliberately ONE level rather than a pair of booleans. The per-entity
    // rules already live in ExportCore's display-name helpers (worlds and moons
    // at (g), stars at (d)), so passing the level makes the image use exactly
    // the labels the page uses. An earlier version passed a single
    // `genericNames` flag and drew "Star A" at (d)-(f) while the page said
    // "K0 V A" — not a leak, but the two disagreed. Found by looking at the
    // rendered PNG, not by any assertion.
    //
    // This exists because an orrery draws body names as PIXELS. No field filter,
    // parity check or DOM sweep can see them, so a players' export cannot simply
    // reuse the GM image — it has to be re-rendered. The DECISION about which
    // level warrants which labels stays in the exporter; this function only
    // obeys, the same split that puts hexPoly() in renderer.js (WP3).
    async function renderSnapshot(state, width, height, opts) {
        width  = width  || 900;
        height = height || 500;
        opts   = opts   || {};

        const found = _detectSystem(state);
        if (!found) return null;

        let normalised;
        if      (found.edition === 'AoW')   normalised = _normalizeAoW(found.raw);
        else if (found.edition === 'MgT2E') normalised = _normalizeMgT2E(found.raw);
        else if (found.edition === 'CT')    normalised = _normalizeCT(found.raw);
        else if (found.edition === 'T5')    normalised = _normalizeT5(found.raw);
        else                                normalised = _normalizeRTT(found.raw);

        const EC2 = (typeof ExportCore !== 'undefined') ? ExportCore : null;
        if (opts.level && EC2) {
            // Copy rather than mutate — `normalised` may share objects with the
            // live hexState, and this must never alter the GM's own data.
            // ExportCore is resolved at call time, not load time, so script
            // order does not matter.
            const stars = normalised.stars || [];
            const multi = stars.length > 1;
            normalised = Object.assign({}, normalised, {
                stars: stars.map((s, i) => Object.assign({}, s, {
                    name: EC2.starDisplayName(s, i, multi, opts.level),
                })),
                worlds: (normalised.worlds || []).map((w, i) => Object.assign({}, w, {
                    name: EC2.worldDisplayName(w, i, opts.level),
                    moons: (w.moons || []).map((m, j) => Object.assign({}, m, {
                        name: EC2.moonDisplayName(m, j, opts.level),
                    })),
                })),
            });
        }

        // Off-screen canvas, drawn with snapshot render state installed
        const canvas  = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        _drawWith({
            orrCtx:       canvas.getContext('2d'),
            canvasW:      width,
            canvasH:      height,
            sys:          normalised,
            hexId:        _hexId || 'snapshot',
            gameYear:     0,   // T=0 → deterministic epoch positions
            gameDay:      1,
            viewZoom:     _autoFitZoom(normalised, width, height),
            viewOffX:     0,
            viewOffY:     0,
            lightMode:    false,  // always dark-mode for export
            linearScale:  false,
            orbitOpacity: 0.3,    // light orbit rings add context without clutter
            hideMoons:    false,
            hideHZ:       false,
            // The mainworld highlight is identification, which is (g) — a coloured
            // body says "this is the one that matters" as loudly as a caption.
            hideMainworldHighlight: !!(opts.level && EC2 &&
                !(window.DisclosureModel && window.DisclosureModel.atLeast(opts.level, 'g'))),
        });

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) { resolve(null); return; }
                blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            }, 'image/png');
        });
    }

    // orbitToAU is exported so the system sheet converts a companion star's
    // orbitId with THIS definition rather than a second copy -- it reads the
    // RAW table at MgT2EData.stellar.orbitAu, which is the authority.
    // NOTE the difference from the private _starCompanionAU above: that one
    // falls back to `s.orbitId || 0.5` for a star with no recorded orbit, which
    // is fine for laying out an orrery and NOT fine for a printed sheet, where
    // it would state an invented distance as fact. Callers that must not invent
    // are expected to check `orbitId != null` themselves first (loose, because
    // legacy saves omit the key entirely -- see project_manifest.md).
    return { open, close, isOpen, refresh, handleWheel, normalizeSystem, renderSnapshot,
             renderGif, orbitToAU: _orbitToAU };

})();

window.SystemViewer = SystemViewer;
