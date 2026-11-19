/**
 * js/add_otu_system_info.js
 *
 * PUBLISHED SYSTEM DATA LOADER (v0.19.0, directives/project_manifest.md section 0.0.D)
 *
 * Turns a system from the Traveller wiki snapshot (window.OTU_SNAPSHOT, js/otu_system_data.js,
 * built offline by utilities/wiki_parse.py + utilities/wiki_build.py) into an ordinary T5
 * system on a hex (stateObj.t5System / t5Data). Once loaded it is like any other T5 system:
 * editable in the System Editor and exported as normal.
 *
 * Sean's rulings this follows (all 2026-11-16, recorded in the manifest):
 *   - Bulk loading (import checkbox, whole map, several hexes): a hex loads only when its
 *     sector name, hex number and mainworld name match a snapshot system. The name compared is
 *     TravellerMap's (stored in the snapshot), not the wiki body's spelling. The mainworld keeps
 *     the MAP's values (its UWP etc.); every other body comes from the wiki.
 *   - Single hex: the user picks any snapshot system; it arrives whole, wiki mainworld included.
 *   - A hex that already has system details: ask first. Hexes without are filled silently.
 *   - No bodies are added beyond those the snapshot lists. Derived fields are filled (trade
 *     codes, the Chart D climate code + text, Rotation); physical stats and everything T5 would
 *     roll (world type, a moon's Close/Far and orbit letter, gas giant size letter,
 *     non-mainworld bases) stay blank.
 *   - Companion stars: role by orbit band (0-5 Close, 6-11 Near, 12+ Far) at the wiki's
 *     distance; a second star in the primary's own field is a Companion inside orbit 0.
 *   - Every size-0 planet is a Planetoid Belt; rings are ring moons (size R); Sol's Kuiper Belt
 *     objects are the belt's moons.
 *
 * No game rule is worked out here: derived fields come from the T5 engine's own functions
 * (T5_World_Engine, T5_Stellar_Engine), exactly as the generator calls them.
 *
 * Depends on: otu_system_data.js, core.js (fromEHex, hexStates, saveHistoryState),
 * rules/t5_data.js (T5_Data.ORBIT_AU), t5_world_engine.js, t5_stellar_engine.js.
 */

(function () {
    'use strict';

    const T5_COMPANION_AU = 0.05;   // the generator's close-companion distance (t5_topdown_generator.js)

    function _log(line) {
        if (window.isLoggingEnabled && typeof writeLogLine === 'function') writeLogLine(line);
    }

    function _norm(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function _orbitAU() {
        return (typeof T5_Data !== 'undefined' && T5_Data.ORBIT_AU) ? T5_Data.ORBIT_AU : [];
    }

    /** The T5 orbit number nearest an AU distance. */
    function _orbitNearestAU(au) {
        const tbl = _orbitAU();
        let best = 0, bestDiff = Infinity;
        tbl.forEach((v, i) => {
            const d = Math.abs(Math.log(v) - Math.log(Math.max(au, 1e-6)));
            if (d < bestDiff) { bestDiff = d; best = i; }
        });
        return best;
    }

    /** Sean, 2026-11-16: a companion's role from its orbit band, the T5 generator's ranges. */
    function _roleForOrbit(orbit) {
        if (orbit <= 5) return 'Close';
        if (orbit <= 11) return 'Near';
        return 'Far';
    }

    /**
     * A spectral type string ("F7 V", "M1.5 Ib", "BD", "D", "M9 D") -> { type, decimal, size }.
     * L-type brown dwarfs are read as M: rules/t5_data.js HZ_DATA has no L row (an older ruling,
     * kept from the previous loader).
     */
    function parseStarType(typeStr) {
        const s = String(typeStr || '').trim();
        if (!s) return { type: 'G', decimal: 2, size: 'V' };
        if (/^D[A-Z]?$/i.test(s)) return { type: 'D', decimal: 0, size: 'D' };
        if (/^BD$/i.test(s)) return { type: 'BD', decimal: 0, size: 'V' };
        const m = s.match(/^([OBAFGKML])(\d+(?:\.\d+)?)\s*(\S+)?$/i);
        if (m) {
            const t = m[1].toUpperCase();
            return { type: t === 'L' ? 'M' : t, decimal: Math.floor(parseFloat(m[2])), size: m[3] || 'V' };
        }
        const one = s.match(/^([OBAFGKM])/i);
        return { type: one ? one[1].toUpperCase() : 'G', decimal: 5, size: 'V' };
    }

    function _newStar(snapStar, extra) {
        const p = parseStarType(snapStar && snapStar.type);
        const orbits = _orbitAU().map((au, i) => ({ orbit: i, distAU: au, contents: null }));
        return Object.assign({
            name: (snapStar && snapStar.name) || `${p.type}${p.type === 'D' || p.type === 'BD' ? '' : p.decimal} ${p.size}`,
            type: p.type, decimal: p.decimal, size: p.size,
            // Sean, 2026-11-17: the same display-only estimate generated T5 stars get
            luminosity: (typeof T5_Stellar_Engine !== 'undefined' && T5_Stellar_Engine.estimateT5Luminosity)
                ? T5_Stellar_Engine.estimateT5Luminosity(p.type) : undefined,
            orbits
        }, extra);
    }

    /** UWP digits; a '?' digit stays blank (fromEHex would read it as 0). */
    function _uwpDigits(uwp) {
        const u = String(uwp || '');
        if (!/^.{7}-./.test(u)) return {};
        const dig = (c, keepLetter) => {
            if (c === undefined || c === '?') return undefined;
            if (keepLetter && (c === 'S' || c === 'R')) return c;   // small world / ring sizes
            return fromEHex(c);
        };
        return {
            starport: u[0] === '?' ? undefined : u[0],
            size: dig(u[1], true), atm: dig(u[2]), hydro: dig(u[3]), pop: dig(u[4]),
            gov: dig(u[5]), law: dig(u[6]), tl: dig(u.split('-')[1][0])
        };
    }

    function _clean(o) {
        Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; });
        return o;
    }

    /** A snapshot body (orbit row, moon, belt object) -> a T5 body object. */
    function _t5Body(b, asMoon, parentType) {
        const body = { name: b.name || undefined, _manualFields: [], wikiPublished: true };
        if (b.distance && b.distance.value != null) {
            body.wikiDistance = { value: b.distance.value, unit: b.distance.unit };
        } else if (b.distance && b.distance.min != null) {
            body.wikiDistance = { min: b.distance.min, max: b.distance.max, unit: b.distance.unit };
        }
        const digits = _uwpDigits(b.uwp);
        if (b.kind === 'gas_giant') {
            // Sean, 2026-11-16: a gas giant the wiki gives no Small/Large defaults to Small.
            body.type = b.size_class === 'Large' ? 'Large Gas Giant' : 'Small Gas Giant';
            if (!b.size_class) body.wikiClassDefaulted = true;
            body.worldType = body.type;
            body.gasGiant = true;
            if (b.size_value != null) body.wikiSize = String(b.size_value);   // as written; not a T5 size letter
            if (b.remark) body.wikiRemark = b.remark;
        } else if (b.kind === 'belt') {
            body.type = 'Planetoid Belt'; body.worldType = 'Belt'; body.size = 0;
        } else if (b.kind === 'ring' || digits.size === 'R') {
            Object.assign(body, digits, { type: 'Ring', worldType: 'Ring', size: 'R' });
            if (b.uwp) { body.uwp = b.uwp; body.uwpSecondary = b.uwp; }
        } else {
            // world / unknown: keep whatever UWP the wiki gives ('?' digits blank)
            Object.assign(body, digits);
            if (b.uwp) { body.uwp = b.uwp; body.uwpSecondary = b.uwp; }
            if (asMoon) {
                body.type = 'Moon';
            } else if (digits.size === 0) {
                body.type = 'Planetoid Belt'; body.worldType = 'Belt';     // Sean: every size-0 planet
            } else {
                body.type = 'Terrestrial World';
            }
        }
        if (Array.isArray(b.trade_codes)) body.wikiTradeCodes = b.trade_codes.slice();
        if (asMoon) {
            body.isMoon = true;
            body.parentBody = parentType || 'Planet';
        }
        return _clean(body);
    }

    /** Trade codes, climate code + text and Rotation, from the T5 engine's own functions. */
    function _derive(body, orbitForClimate, hz) {
        const W = (typeof T5_World_Engine !== 'undefined') ? T5_World_Engine : null;
        if (!W) return;
        const isGG = body.type && (body.type.includes('Gas Giant') || body.type === 'Ice Giant');
        const isRing = body.type === 'Ring';
        // A '?' digit is unknown, and the engine reads a missing digit as 0 — so a UWP with any
        // '?' (or none at all) gets no trade or climate codes: they would be invented. Rotation
        // depends only on position, so it still applies.
        const uwpKnown = /^[^?]{7}-[^?]$/.test(String(body.uwp || ''));
        if (!isGG && !isRing && uwpKnown) {
            const codes = W.calculateT5TradeCodes(body);
            (body.wikiTradeCodes || []).forEach(c => { if (!codes.includes(c)) codes.push(c); });
            body.tradeCodes = codes;
            if (hz != null && orbitForClimate != null) W.applyT5ClimateCode(body, orbitForClimate - hz);
            W.calculateT5Climate(body);
        }
        if (!isRing) W.calculateT5RotationalDynamics(body);
    }

    // --- Core builder ---------------------------------------------------------------------

    /**
     * Builds { t5System, t5Data } from one snapshot system.
     * opts.mapMainworld: the hex's existing t5Data (bulk loading keeps the map's mainworld);
     * null = the wiki's mainworld (single-hex loading).
     */
    function buildT5FromSnapshot(snap, opts) {
        const mapMW = opts && opts.mapMainworld;
        const stars = [];
        let mainworld = null;
        const groups = snap.systems || [];

        // Stars ----------------------------------------------------------------------------
        const groupStarIdx = [];
        groups.forEach((g, gi) => {
            const head = (g.stars || [])[0] || { type: 'G2 V' };
            let star;
            if (gi === 0) {
                star = _newStar(head, { role: 'Primary', orbitID: 0, parentStarIdx: null });
            } else {
                const pl = g.placement || {};
                const orbit = pl.orbit != null ? pl.orbit : (pl.au != null ? _orbitNearestAU(pl.au) : 0);
                star = _newStar(head, {
                    role: _roleForOrbit(orbit), orbitID: orbit, parentStarIdx: 0,
                    distAU: pl.au != null ? pl.au : _orbitAU()[orbit]
                });
            }
            groupStarIdx[gi] = stars.length;
            stars.push(star);
            // A second star written in this group's own field: a Companion of it, inside orbit 0
            (g.stars || []).slice(1).forEach(cs => {
                stars.push(_newStar(cs, {
                    role: 'Companion', orbitID: null, distAU: T5_COMPANION_AU, parentStarIdx: groupStarIdx[gi]
                }));
            });
        });

        // Bodies -----------------------------------------------------------------------------
        const hzOf = (star) => (typeof T5_Stellar_Engine !== 'undefined' && T5_Stellar_Engine.getStarHZ)
            ? T5_Stellar_Engine.getStarHZ(star) : null;
        const toDerive = [];   // [body, orbit used for climate, star]

        function placeBody(star, orbitNum, b, au) {
            const isMW = b.mainworld === true;
            let body;
            if (isMW && mapMW) {
                body = Object.assign({}, mapMW, {
                    tradeCodes: [...(mapMW.tradeCodes || [])], _manualFields: mapMW._manualFields || []
                });
            } else {
                body = _t5Body(b, false);
            }
            body.orbitId = orbitNum;
            if (au != null) body.distAU = au;
            const moonList = b.moons || b.objects || [];
            if (moonList.length) {
                const pType = body.type && body.type.includes('Gas Giant') ? 'Gas Giant'
                    : body.type === 'Planetoid Belt' ? 'Planetoid Belt' : 'Planet';
                body.satellites = moonList.map(m => {
                    let moon;
                    if (m.mainworld === true && mapMW) {
                        moon = Object.assign({}, mapMW, {
                            tradeCodes: [...(mapMW.tradeCodes || [])], _manualFields: mapMW._manualFields || [],
                            isMoon: true, parentBody: pType
                        });
                    } else {
                        moon = _t5Body(m, true, pType);
                    }
                    if (body.distAU != null) moon.distAU = body.distAU;
                    if (m.mainworld === true) {
                        moon.isSatellite = true; moon.isLunarMainworld = true;
                        moon.parentType = body.type; moon.parentBody = body.type;
                        mainworld = moon;
                    }
                    toDerive.push([moon, orbitNum, star, m.mainworld === true]);
                    return moon;
                });
            }
            if (isMW) mainworld = body;
            toDerive.push([body, orbitNum, star, isMW]);
            // Orbit slots run 0-19; the snapshot never goes past 17, but keep any extra.
            while (star.orbits.length <= orbitNum) {
                star.orbits.push({ orbit: star.orbits.length, distAU: null, contents: null });
            }
            const slot = star.orbits[orbitNum];
            if (slot.contents) {
                _log(`[Published Systems] ${snap.name}: orbit ${orbitNum} of ${star.name} already holds ${slot.contents.name}; ${body.name} not placed.`);
                return;
            }
            slot.contents = body;
            if (au != null) slot.distAU = au;
        }

        groups.forEach((g, gi) => {
            const star = stars[groupStarIdx[gi]];
            (g.orbits || []).forEach(o => {
                const au = o.distance && o.distance.value != null ? o.distance.value : null;
                if (o.kind === 'empty') return;
                if (o.kind === 'star') {
                    if (o.subsystem != null) return;       // placed once, as its own group
                    const comp = _newStar(o, {
                        role: _roleForOrbit(o.orbit), orbitID: o.orbit,
                        parentStarIdx: groupStarIdx[gi], distAU: au != null ? au : _orbitAU()[o.orbit]
                    });
                    const compIdx = stars.length;
                    stars.push(comp);
                    // Its planets: at the orbit nearest their AU (moons of them come along)
                    (o.planets || []).forEach(p => {
                        const pau = p.distance && p.distance.value != null && p.distance.unit === 'AU' ? p.distance.value : null;
                        let n = pau != null ? _orbitNearestAU(pau) : 0;
                        while (comp.orbits[n] && comp.orbits[n].contents) n++;
                        placeBody(stars[compIdx], n, p, pau);
                    });
                    return;
                }
                placeBody(star, o.orbit, o, au);
            });
        });

        // Derived fields (the map's mainworld keeps its own codes; only Rotation is added)
        stars.forEach(s => { s._hz = hzOf(s); });
        toDerive.forEach(([body, orbit, star, isMW]) => {
            if (isMW && mapMW) {
                if (typeof T5_World_Engine !== 'undefined') T5_World_Engine.calculateT5RotationalDynamics(body);
                return;
            }
            _derive(body, orbit, star._hz);
        });
        stars.forEach(s => { delete s._hz; });

        if (mainworld) {
            mainworld.type = 'Mainworld';
            mainworld.isMainworld = true;
            if (mainworld.isMoon) mainworld.isSatellite = true;
        }

        // PBG gas giants and belts: count the bodies actually placed, as the generator does
        let gg = 0, belts = 0;
        stars.forEach(s => s.orbits.forEach(sl => {
            const c = sl.contents;
            if (!c || !c.type) return;
            if (c.type.includes('Gas Giant') || c.type === 'Ice Giant') gg++;
            else if (c.type === 'Planetoid Belt') belts++;
        }));

        const t5System = {
            mainworld,
            stars,
            sggCount: 0,
            hzOrbit: stars[0] ? hzOf(stars[0]) : null,
            // Provenance: which snapshot this came from. Optional; absent on every other system.
            wikiSnapshot: { snapshot: (window.OTU_SNAPSHOT || {}).snapshot, sector: snap.sector, hex: snap.hex, name: snap.name }
        };

        let t5Data;
        if (mapMW) {
            t5Data = mapMW;
        } else {
            t5Data = Object.assign({}, mainworld || {});
            delete t5Data.satellites;
            t5Data.gasGiantsCount = gg;
            t5Data.gasGiant = gg > 0;
            t5Data.planetoidBelts = belts;
            t5Data.homestar = stars.map(s => `${s.type}${s.type === 'D' || s.type === 'BD' ? '' : s.decimal} ${s.size}`).join(' ');
        }
        return { t5System, t5Data, gasGiants: gg, belts };
    }

    // --- Hex helpers ----------------------------------------------------------------------

    function _sectorNameForHex(hexId) {
        const slot = String(hexId).split('-')[0];
        const names = window.sectorNames || {};
        return names[slot] || names[parseInt(slot, 10)] || null;
    }

    function _hexNum(hexId) {
        const parts = String(hexId).split('-');
        return parts[parts.length - 1];
    }

    function _snapKey(s) { return `${s.sector} ${s.hex}`; }

    function listPublishedSystems() {
        return ((window.OTU_SNAPSHOT || {}).systems || []).slice();
    }

    function findPublishedSystem(key) {
        return listPublishedSystems().find(s => _snapKey(s) === key) || null;
    }

    /** Bulk matching: sector name + hex number + TravellerMap's mainworld name. */
    function matchPublishedSystem(hexId, state) {
        const sector = _sectorNameForHex(hexId);
        if (!sector || !state) return { match: null, reason: 'no sector' };
        const hexNum = _hexNum(hexId);
        // The full sector name, or TravellerMap's short code ("Spin"), which is what a sector
        // imported from a .tsv file is named by.
        const here = listPublishedSystems().filter(s => s.hex === hexNum &&
            (s.sector === sector || (s.sector_abbreviation && s.sector_abbreviation === sector)));
        if (!here.length) return { match: null, reason: 'not in snapshot' };
        const s = here[0];
        if (s.single_hex_only) return { match: null, reason: 'single-hex only', candidate: s };
        const mapName = state.name || (state.t5Data && state.t5Data.name);
        if (_norm(mapName) !== _norm(s.travellermap_name)) return { match: null, reason: 'name differs', candidate: s };
        return { match: s };
    }

    /** True when the hex already holds a full system of any edition (not just a mainworld). */
    function hasSystemDetails(state) {
        if (!state) return false;
        const t5 = state.t5System;
        if (t5 && (t5.stars || []).some(s => (s.orbits || []).some(o => o && o.contents))) return true;
        return !!(state.mgtSystem || state.ctSystem || state.aowSystem || state.rttSystem);
    }

    function _alreadyLoaded(state, snap) {
        const w = state && state.t5System && state.t5System.wikiSnapshot;
        return !!(w && w.sector === snap.sector && w.hex === snap.hex &&
                  w.snapshot === (window.OTU_SNAPSHOT || {}).snapshot);
    }

    function _clearOtherEditions(state) {
        state.ctData = null; state.ctSystem = null;
        state.mgt2eData = null; state.mgtSystem = null;
        state.aowSystem = null;
        state.rttSystem = null; state.rttData = null;
        state.ctPhysical = null; state.mgtPhysical = null; state.t5Physical = null;
        state.mgtSocio = null;
    }

    function _writeBulk(hexId, state, snap) {
        const built = buildT5FromSnapshot(snap, { mapMainworld: state.t5Data || null });
        _clearOtherEditions(state);
        state.type = 'SYSTEM_PRESENT';
        state.t5System = built.t5System;
        if (!state.t5Data) state.t5Data = built.t5Data;
        _log(`[Published Systems] ${hexId}: loaded ${snap.name} (${snap.sector} ${snap.hex}), map mainworld kept.`);
    }

    function _finish(label) {
        if (window.dbManager && window.dbManager.scheduleSyncAll) window.dbManager.scheduleSyncAll();
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof draw === 'function') requestAnimationFrame(draw);
    }

    /**
     * Bulk loading. hexIds: the hexes to consider (default: every hex on the map).
     * options.confirm: replaces window.confirm (tests). options.quiet: no toast.
     * Returns { loaded, replaced, skippedExisting, unmatched: [{hexId, reason, wiki}] }.
     */
    function applyPublishedSystems(hexIds, options) {
        const opts = options || {};
        const ask = opts.confirm || (msg => window.confirm(msg));
        if (!window.OTU_SNAPSHOT) {
            console.warn('[Published Systems] OTU_SNAPSHOT not loaded.');
            return null;
        }
        const ids = hexIds ? [...hexIds] : [...hexStates.keys()];
        const fresh = [], existing = [], unmatched = [];
        let already = 0;
        ids.forEach(hexId => {
            const state = hexStates.get(hexId);
            if (!state || state.type !== 'SYSTEM_PRESENT') return;
            const r = matchPublishedSystem(hexId, state);
            if (!r.match) {
                if (r.candidate) unmatched.push({ hexId, reason: r.reason, wiki: r.candidate.name, map: state.name || '' });
                return;
            }
            if (_alreadyLoaded(state, r.match)) { already++; return; }
            (hasSystemDetails(state) ? existing : fresh).push([hexId, state, r.match]);
        });

        let replace = false;
        if (existing.length) {
            replace = ask(`${existing.length} hex${existing.length === 1 ? '' : 'es'} with wiki-published system data ` +
                `already ${existing.length === 1 ? 'has' : 'have'} system details.\n\n` +
                `OK: replace ${existing.length === 1 ? 'it' : 'them'} with the wiki-published system.\n` +
                `Cancel: leave ${existing.length === 1 ? 'it' : 'them'} as ${existing.length === 1 ? 'it is' : 'they are'} ` +
                `(the other ${fresh.length} still load).`);
        }
        const todo = fresh.concat(replace ? existing : []);
        if (todo.length && typeof saveHistoryState === 'function') saveHistoryState('Load Wiki-Published Systems');
        todo.forEach(([hexId, state, snap]) => _writeBulk(hexId, state, snap));

        unmatched.forEach(u => _log(`[Published Systems] ${u.hexId}: not loaded (${u.reason}) - map "${u.map}", snapshot "${u.wiki}".`));
        const result = {
            loaded: fresh.length, replaced: replace ? existing.length : 0,
            skippedExisting: replace ? 0 : existing.length, alreadyLoaded: already, unmatched
        };
        if (todo.length) _finish();
        if (!opts.quiet && typeof showToast === 'function') {
            const parts = [];
            if (todo.length) parts.push(`Wiki-published system data loaded into ${todo.length} system${todo.length === 1 ? '' : 's'}.`);
            else if (already) parts.push(`Nothing new to load: ${already} system${already === 1 ? ' already has' : 's already have'} the wiki-published data.`);
            else if (!unmatched.length && !existing.length) parts.push('No wiki-published system data for these hexes.');
            if (todo.length && already) parts.push(`${already} already had it.`);
            if (result.skippedExisting) parts.push(`${result.skippedExisting} kept as they were.`);
            if (unmatched.length) parts.push(`${unmatched.length} not matched (name or hex differs) - see the log.`);
            showToast(parts.join(' '), unmatched.length ? 7000 : 4000);
        }
        console.log('[Published Systems]', result);
        return result;
    }

    /**
     * Single hex: put any snapshot system into any hex, whole (the wiki's mainworld included).
     * key: "<Sector> <hex>" as listPublishedSystems() gives it. Asks before replacing details.
     */
    function loadPublishedSystemIntoHex(hexId, key, options) {
        const opts = options || {};
        const ask = opts.confirm || (msg => window.confirm(msg));
        const snap = findPublishedSystem(key);
        if (!snap) { console.warn(`[Published Systems] no snapshot system "${key}".`); return false; }
        let state = hexStates.get(hexId);
        if (state && hasSystemDetails(state) &&
            !ask(`This hex already has system details.\n\nOK: replace them with ${snap.name} (${key}).\nCancel: leave the hex as it is.`)) {
            return false;
        }
        if (typeof saveHistoryState === 'function') saveHistoryState('Load Wiki-Published System');
        if (!state || state.type !== 'SYSTEM_PRESENT') {
            state = Object.assign({}, state && state.type !== 'EMPTY' && state.type !== 'BLANK' ? state : {}, { type: 'SYSTEM_PRESENT' });
            hexStates.set(hexId, state);
        }
        const built = buildT5FromSnapshot(snap, { mapMainworld: null });
        _clearOtherEditions(state);
        state.t5Socio = null;          // the map's socio belonged to the world being replaced
        state.type = 'SYSTEM_PRESENT';
        state.name = (built.t5System.mainworld && built.t5System.mainworld.name) || snap.name;
        state.t5System = built.t5System;
        state.t5Data = built.t5Data;
        state.gasGiantCount = built.gasGiants;
        state.beltCount = built.belts;
        _log(`[Published Systems] ${hexId}: loaded ${snap.name} (${key}) whole, wiki mainworld.`);
        _finish();
        return true;
    }

    /**
     * The OTU importers' hook (otu_importer.js, when "Published System Data" is ticked).
     * slotNums: the sector slots just imported; only their hexes are touched. Omitted = whole map.
     */
    function applyOtuSystemData(slotNums) {
        if (!Array.isArray(slotNums)) return applyPublishedSystems(null);
        const slots = new Set(slotNums.map(n => String(n)));
        const ids = [...hexStates.keys()].filter(id => slots.has(String(id).split('-')[0]));
        return applyPublishedSystems(ids);
    }

    // --- UI: picker, right-click item, whole-map button ------------------------------------

    let _pickerHexId = null;

    function _fillPicker(filter) {
        const list = document.getElementById('published-system-list');
        if (!list) return;
        const f = String(filter || '').toLowerCase();
        const keep = list.value;
        list.innerHTML = '';
        listPublishedSystems()
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            .forEach(s => {
                const label = `${s.name} — ${s.sector} ${s.hex}${s.single_hex_only ? ' (not on TravellerMap)' : ''}`;
                if (f && !label.toLowerCase().includes(f)) return;
                const opt = document.createElement('option');
                opt.value = _snapKey(s);
                opt.textContent = label;
                list.appendChild(opt);
            });
        if (keep && [...list.options].some(o => o.value === keep)) list.value = keep;
        else if (list.options.length) list.selectedIndex = 0;
    }

    /** Single hex: choose any snapshot system (Sean, 2026-11-16). */
    function openPublishedSystemPicker(hexId) {
        const modal = document.getElementById('published-system-modal');
        if (!modal || !window.OTU_SNAPSHOT) return;
        _pickerHexId = hexId;
        const filter = document.getElementById('published-system-filter');
        if (filter) filter.value = '';
        _fillPicker('');
        // Preselect the system published for this very hex, if there is one
        const sector = _sectorNameForHex(hexId);
        const here = listPublishedSystems().find(s => s.hex === _hexNum(hexId) &&
            (s.sector === sector || s.sector_abbreviation === sector));
        const list = document.getElementById('published-system-list');
        if (here && list) list.value = _snapKey(here);
        const hint = document.getElementById('published-system-hint');
        if (hint) hint.textContent = `Hex ${_hexNum(hexId)}: the chosen system arrives whole, its wiki mainworld included. ` +
            `Snapshot ${(window.OTU_SNAPSHOT || {}).snapshot}.`;
        modal.style.display = 'flex';
        if (filter) filter.focus();
    }

    function _closePicker() {
        const modal = document.getElementById('published-system-modal');
        if (modal) modal.style.display = 'none';
        _pickerHexId = null;
    }

    function _pickerLoad() {
        const list = document.getElementById('published-system-list');
        if (!list || !list.value || !_pickerHexId) return;
        const hexId = _pickerHexId, key = list.value;
        _closePicker();
        if (loadPublishedSystemIntoHex(hexId, key) && typeof showToast === 'function') {
            const s = findPublishedSystem(key);
            showToast(`Loaded ${s ? s.name : key} into hex ${_hexNum(hexId)}.`, 3000);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const ctx = document.getElementById('ctx-load-published');
        if (ctx) ctx.addEventListener('click', () => {
            const menu = document.getElementById('context-menu');
            if (menu) menu.classList.remove('visible');
            const ids = [...selectedHexes];
            if (ids.length === 1) openPublishedSystemPicker(ids[0]);
            else if (ids.length > 1) applyPublishedSystems(ids);
        });
        const btn = document.getElementById('btn-import-published-systems');
        if (btn) btn.addEventListener('click', () => applyPublishedSystems(null));

        const filter = document.getElementById('published-system-filter');
        if (filter) {
            filter.addEventListener('input', () => _fillPicker(filter.value));
            filter.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); _pickerLoad(); }
                if (e.key === 'Escape') { e.preventDefault(); _closePicker(); }
            });
        }
        const list = document.getElementById('published-system-list');
        if (list) {
            list.addEventListener('dblclick', _pickerLoad);
            list.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); _pickerLoad(); }
                if (e.key === 'Escape') { e.preventDefault(); _closePicker(); }
            });
        }
        const cancel = document.getElementById('published-system-cancel');
        if (cancel) cancel.addEventListener('click', _closePicker);
        const load = document.getElementById('published-system-load');
        if (load) load.addEventListener('click', _pickerLoad);
    });

    window.PublishedSystems = {
        list: listPublishedSystems,
        find: findPublishedSystem,
        match: matchPublishedSystem,
        build: buildT5FromSnapshot,
        hasSystemDetails,
        applyToHexes: applyPublishedSystems,
        loadIntoHex: loadPublishedSystemIntoHex,
        openPicker: openPublishedSystemPicker,
        parseStarType
    };
    window.applyOtuSystemData = applyOtuSystemData;

}());
