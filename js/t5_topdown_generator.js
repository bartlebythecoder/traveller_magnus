/**
 * js/t5_topdown_generator.js
 * 
 * T5 SYSTEM GENERATOR (v2.0 Modular Architecture)
 * Orchestrates Top-Down generation for Traveller 5 systems.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math', './t5_data'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'), require('./t5_data'), require('./t5_world_engine'));
    } else {
        root.T5_TopDown_Generator = factory(root.UniversalMath, root.T5_Data, root.T5_World_Engine);
    }
}(this, function (UniversalMath, T5_Data, T5_World_Engine) {
    const { toEHex, fromEHex, clampUWP, rollFlux } = UniversalMath;

    // --- Internal Helpers & Tables (Drawn from T5 Logic) ---
    // Note: Uses global rng/roll functions if available (e.g., from core.js), otherwise fallbacks.
    const _rng = (typeof rng === 'function') ? rng : Math.random;
    const _roll1D = (typeof roll1D === 'function') ? roll1D : () => Math.floor(_rng() * 6) + 1;
    const _roll2D = (typeof roll2D === 'function') ? roll2D : () => _roll1D() + _roll1D();
    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;
    const _tResult = (typeof tResult === 'function') ? tResult : (label, val, source) => _log(`${label}: ${val}`);
    const _isManual = (typeof isManual === 'function') ? isManual : () => false;

    // A Companion star orbits well inside its parent's Orbit 0 (0.2 AU) — T5's ORBIT_AU table
    // has no entry below that, so it isn't a numbered orbit slot at all; give it a fixed
    // close-in separation instead. Mirrors the same constant in t5_stellar_engine.js and the
    // 0.05 AU already used by traveller_worlds_importer.js for OTU-imported companions.
    const T5_COMPANION_AU = 0.05;

    const HZ_DATA = {
        'O': { 'Ia': 15, 'Ib': 15, 'II': 14, 'III': 13, 'IV': 12, 'V': 11, 'D': 1 },
        'B': { 'Ia': 13, 'Ib': 13, 'II': 12, 'III': 11, 'IV': 10, 'V': 9, 'D': 0 },
        'A': { 'Ia': 12, 'Ib': 11, 'II': 9, 'III': 7, 'IV': 7, 'V': 7, 'D': 0 },
        'F': { 'Ia': 11, 'Ib': 10, 'II': 9, 'III': 6, 'IV': 6, 'V': 4, 'VI': 3, 'D': 0 },
        'G': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 7, 'IV': 5, 'V': 3, 'VI': 2, 'D': 0 },
        'K': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 8, 'IV': 5, 'V': 2, 'VI': 1, 'D': 0 },
        'M': { 'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'V': 0, 'VI': 0, 'D': 0 }
    };

    /**
     * Determines the Habitable Zone (HZ) orbit for a star based on Spectral Type and Size.
     */
    function getStarHZ(star) {
        if (!star) return 3;
        const type = (star.type || 'G').charAt(0).toUpperCase();
        const size = star.size || 'V';
        const typeMap = HZ_DATA[type] || HZ_DATA['G'];
        let hz = typeMap[size];
        if (hz === undefined) hz = typeMap['V'] || 3;
        return clampUWP(hz, 0, 19);
    }

    /**
     * T5 ORBIT LABEL HELPER
     * Returns a combined label consisting of [Positional / Climate]
     * per Traveller 5 RAW requirements.
     */
    function getT5OrbitLabel(orbit, hzOrbit) {
        let positional = "";
        if (orbit <= hzOrbit - 2) positional = "Inner";
        else if (orbit >= hzOrbit - 1 && orbit <= hzOrbit + 1) positional = "Hospitable";
        else if (orbit >= hzOrbit + 2) positional = "Outer";

        let climate = "";
        // Special Orbit Labels: 0 or 1 get Twilight Zone (Tz)
        if (orbit === 0 || orbit === 1) {
            climate = "Tz";
        } else {
            if (orbit <= hzOrbit - 1) climate = "Hot / Tropic";
            else if (orbit === hzOrbit) climate = "Temperate";
            else if (orbit >= hzOrbit + 1 && orbit <= hzOrbit + 5) climate = "Cold / Tundra";
            else if (orbit >= hzOrbit + 6) climate = "Frozen";
        }

        if (positional && climate) return `${positional} / ${climate}`;
        return positional || climate || "None";
    }

    /**
     * Generates HZ Variance and Climate based on Spectral Type (T5 Table 2B).
     */
    function generateHZAndClimate(spectralType) {
        let hzFlux = rollFlux();
        let dm = 0;
        const type = (spectralType || 'G').charAt(0).toUpperCase();
        if (type === 'M') dm = 2;
        if (type === 'O' || type === 'B') dm = -2;

        hzFlux = clampUWP(hzFlux + dm, -6, 6);

        let hzVariance = 0, climate = '', tradeCode = '';
        if (hzFlux === -6) {
            hzVariance = -2;
        } else if (hzFlux <= -3) {
            hzVariance = -1; climate = 'Hot / Tropic'; tradeCode = 'Tr';
        } else if (hzFlux <= 2) {
            hzVariance = 0; climate = 'Temperate';
        } else if (hzFlux <= 5) {
            hzVariance = 1; climate = 'Cold / Tundra'; tradeCode = 'Tu';
        } else {
            hzVariance = 2; climate = 'Frozen'; tradeCode = 'Fr';
        }

        return { hzVariance, climate, tradeCode };
    }

    /**
     * Generates Gas Giant Type and Size (T5 Mapping).
     */
    function generateGasGiantStats() {
        let roll = _roll2D();
        let size, type;
        if (roll === 2 || roll === 3) {
            size = (roll === 2 ? 'M' : 'N');
            type = 'Small Gas Giant';
        } else {
            type = 'Large Gas Giant';
            // T5 Basic Placement Chart, rolls 4-12: P Q R S T U V W X (confirmed via Sean's
            // Requirements Agent). A stray space previously sat between 'S' and 'T'
            // ("PQRS TUVWX", 10 chars for 9 rolls), silently shifting T-X down one slot and
            // making the single most likely Large GG roll (8, the 2D6 peak) resolve to a blank
            // size code instead of 'T' — every downstream diamKm/mass/gravity calc for that GG
            // then read an unrecognized size and fell through to 0-ish defaults.
            const chars = "PQRSTUVWX"; // Mapping for 2D rolls 4-12
            size = chars[roll - 4] || 'S';
        }
        return { size, type };
    }

    /**
     * Finds the closest available orbital slot in a star's private subsystem.
     * Handles Preclusion (Surface Orbit) and Duplication (Occupied Slots).
     */
    function findAvailableOrbit(star, target, reservedOrbits = new Set()) {
        const specs = T5_Data.T5_PRECLUDED_ORBITS;
        let surfaceOrbit = -1;

        // 1. Determine Surface Orbit (Preclusion)
        if (star && star.size && specs[star.size]) {
            const type = (star.type && star.type.charAt) ? star.type.charAt(0) : 'G';
            const decimal = star.decimal || 0;
            const sizeMap = specs[star.size];

            // Mapping for O/B stars to A0 values
            const lookupType = (['O', 'B'].includes(type) ? 'A' : type);
            const lookupDec = (['O', 'B'].includes(type) ? 0 : decimal);

            // Find the correct key in the size mapping (e.g., "A0_F5")
            for (const range in sizeMap) {
                if (range === 'LOGIC' || !range) continue;

                // Robust parser for ranges like "A0_F5" or single types like "M9"
                const parts = range.split('_');
                const start = parts[0];
                const end = parts[1] || start;

                // Safety check: ensure start and end are valid strings
                if (!start || !end || typeof start !== 'string' || typeof end !== 'string') {
                    continue;
                }

                const startType = start.charAt(0);
                const startDec = parseInt(start.slice(1)) || 0;
                const endType = end.charAt(0);
                const endDec = parseInt(end.slice(1)) || 0;

                const starWeight = (lookupType.charCodeAt(0) * 10) + lookupDec;
                const startWeight = (startType.charCodeAt(0) * 10) + startDec;
                const endWeight = (endType.charCodeAt(0) * 10) + endDec;

                if (starWeight >= startWeight && starWeight <= endWeight) {
                    surfaceOrbit = sizeMap[range];
                    break;
                }
            }
        }

        const preclusionLimit = surfaceOrbit; // Orbits 0 to surfaceOrbit are blocked

        // 2. Adjustment Loop (Closest possible >= surfaceOrbit + 1)
        // Safety check: ensure star.orbits exists
        if (!star || !star.orbits) return -1;

        const check = (o) => (o >= 0 && o < 20 && o > preclusionLimit && star.orbits[o] && !star.orbits[o].contents && !reservedOrbits.has(o));

        if (check(target)) return target;

        for (let d = 1; d < 20; d++) {
            let above = target + d;
            let below = target - d;
            if (check(above)) return above;
            if (check(below)) return below;
        }

        return -1;
    }

    // --- PIPELINE IMPLEMENTATION ---

    // Initializes each star's 20-slot orbit array (used by findAvailableOrbit/placeCategory
    // later) and resolves a companion star's distAU from its seeded orbit position. Shared by
    // generateT5System (below) and buildT5StarOnlyPreview (System Editor star-only orrery
    // preview, OW-49) — extracted so both get the exact same companion-positioning treatment,
    // including the orbitID/orbitId fallback (OW-46): T5's own star objects use `orbitID`
    // (capital ID, see the classic non-seeded homestar-parsing path above), but
    // system_editor.js's engine-agnostic _buildSeedSys builds every engine's star seed with
    // `orbitId` (lowercase d) — a System-Editor-placed/repositioned companion star's `orbitID`
    // is therefore undefined, and without this fallback `Math.floor(undefined)` corrupts its
    // distAU to NaN.
    function _initStars(stars) {
        stars.forEach(star => {
            star.orbits = [];
            for (let i = 0; i < 20; i++) {
                star.orbits.push({ orbit: i, distAU: T5_Data.ORBIT_AU[i], contents: null });
            }
        });
        stars.slice(1).forEach(star => {
            const orbitIdVal = star.orbitID != null ? star.orbitID : star.orbitId;
            if (orbitIdVal == null) {
                // Companion: no numbered orbit slot — a pre-set distAU (from ROLE_SLOTS,
                // System Editor's orbitAU, or the OTU importer) wins; T5_COMPANION_AU is only
                // the last-resort default.
                star.distAU = star.distAU != null ? star.distAU : T5_COMPANION_AU;
                return;
            }
            const tbl  = T5_Data.ORBIT_AU;
            const idx  = Math.floor(orbitIdVal);
            const frac = orbitIdVal - idx;
            const lo   = tbl[Math.min(idx, tbl.length - 1)] || 0;
            const hi   = idx < tbl.length - 1 ? tbl[idx + 1] : lo;
            star.distAU = lo + frac * (hi - lo);
        });
        return stars;
    }

    // Builds a star-only preview system (System Editor "Create System", before any body has
    // been added yet) — no mainworld, no worlds, just the resolved star(s) at their real
    // positions. Does NOT invoke generateT5System: that function's Phase 1 requires a real
    // mainworldBase by design (T5's "Continuation Method" — the mainworld must exist before the
    // system does, unlike CT/MgT2E which elect one after structure exists), and relaxing that
    // guard would mean null-checking mainworld-dependent code throughout Phase 1 for a need
    // that's purely about preview rendering. See OW-49, directives/project_manifest.md.
    function buildT5StarOnlyPreview(seedSys) {
        if (!seedSys || !(seedSys.stars || []).length) return null;
        const stars = _initStars(seedSys.stars.map(s => Object.assign({}, s)));
        const hzOrbit = (seedSys.hzco != null) ? seedSys.hzco : getStarHZ(stars[0]);
        return { stars, mainworld: null, sggCount: 0, hzOrbit };
    }

    /**
     * Parses a flat T5 "homestar" string (e.g. "F7 V M3 V K2 V") into up to 8 star objects.
     * T5 RAW (see OW-N, directives/project_manifest.md): a system has a Primary, and each of
     * Close/Near/Far may independently exist, and each of Primary/Close/Near/Far may
     * independently have its own Companion — up to 8 stars total. A flat spectral-type list
     * (from a TravellerMap/OTU import, or a fresh homestar override) gives no way to know
     * which token is which role, so role/orbit assignment here is a positional guess —
     * consistent with the project's "guess, don't gate" policy (a wrong guess is corrected
     * via the System Editor's existing Role dropdown, not a blocking UI). Close/Near/Far
     * orbits use T5's real placement dice (1D-1 / 5+1D / 11+1D); Companions use the existing
     * "tightly inside Orbit 0 of the parent star" placeholder (no RAW roll formula given for
     * the exact sub-orbit).
     *
     * Shared by generateT5System's homestar branch (below) and js/io_manager.js's OTU
     * importer (importT5Tab) — previously two divergent copies of this same tokenizer, one of
     * which (the importer) never decomposed spectral type at all and defaulted every
     * secondary star to a flat 'Companion' role with no orbit data.
     */
    function parseT5HomestarString(rawStarsString) {
        if (!rawStarsString || !rawStarsString.trim()) return [];

        let starStrings = [];
        let tokens = rawStarsString.trim().split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
            if (i > 0 && /^(Ia|Ib|II|III|IV|V|VI|VII|D|BD)$/i.test(tokens[i]) && !starStrings[starStrings.length - 1].includes(" ")) {
                starStrings[starStrings.length - 1] += " " + tokens[i];
            } else {
                starStrings.push(tokens[i]);
            }
        }

        // Canonical 8-slot role/orbit assignment. orbitID for Close/Near/Far is rolled fresh
        // (via this module's seeded _roll1D) each time this function runs, matching T5 RAW's
        // placement dice — not a fixed constant. parentStarIdx (Companions only) indexes back
        // into this same array: 0=Primary, 1=Close, 2=Near, 3=Far.
        const ROLE_SLOTS = [
            { role: 'Primary',   orbitID: 0,                 parentStarIdx: null },
            { role: 'Close',     orbitID: _roll1D() - 1,      parentStarIdx: null }, // RAW: 1D-1, range 0-5
            { role: 'Near',      orbitID: 5 + _roll1D(),      parentStarIdx: null }, // RAW: 5+1D, range 6-11
            { role: 'Far',       orbitID: 11 + _roll1D(),     parentStarIdx: null }, // RAW: 11+1D, range 12-17
            // Companions aren't a numbered orbit slot (see T5_COMPANION_AU above) — no orbitID.
            { role: 'Companion', orbitID: null, distAU: T5_COMPANION_AU, parentStarIdx: 0 },    // of Primary
            { role: 'Companion', orbitID: null, distAU: T5_COMPANION_AU, parentStarIdx: 1 },    // of Close
            { role: 'Companion', orbitID: null, distAU: T5_COMPANION_AU, parentStarIdx: 2 },    // of Near
            { role: 'Companion', orbitID: null, distAU: T5_COMPANION_AU, parentStarIdx: 3 },    // of Far
        ];

        if (starStrings.length > ROLE_SLOTS.length) {
            _log(`T5 Star Parse: homestar string has ${starStrings.length} stars — T5's maximum is ${ROLE_SLOTS.length} (Primary/Close/Near/Far, each with an optional Companion). Extra tokens ignored: ${starStrings.slice(ROLE_SLOTS.length).join(', ')}`);
        }

        return starStrings.slice(0, ROLE_SLOTS.length).map((sStr, idx) => {
            let rawType = sStr.split(' ')[0] || '';
            let sType = rawType.length > 0 ? rawType[0] : 'M';
            let subTypeMatch = rawType.match(/\d/);
            let decimal = subTypeMatch ? parseInt(subTypeMatch[0]) : 0;
            let sClass = sStr.split(' ')[1] || 'V';
            if (sType === 'D') { sClass = 'D'; decimal = 0; }
            if (rawType === 'BD') { sType = 'BD'; sClass = 'V'; decimal = 0; }
            const slot = ROLE_SLOTS[idx];
            return {
                role: slot.role,
                // Reconstructed, formula-based label — kept identical to this function's
                // pre-extraction formula for generateT5System's own consumers. Has a known,
                // pre-existing quirk for D/BD stars (produces "D D"/"BD V") — see rawName.
                name: `${sType}${rawType !== 'D' && rawType !== 'BD' ? decimal : ''} ${sClass}`,
                rawName: sStr, // the untouched original token (e.g. "D", "F7 V") — callers that
                                // need a name a downstream spectral-type parser can round-trip
                                // (e.g. io_manager.js's importer) should use this instead of
                                // `name` above.
                type: sType,
                decimal: decimal,
                size: sClass,
                orbitID: slot.orbitID,
                distAU: slot.distAU,
                parentStarIdx: slot.parentStarIdx,
            };
        });
    }

    /**
     * Main T5 Top-Down Generation Orchestrator.
     * Executes the 4-Phase pipeline for system generation.
     */
    function generateT5System(mainworldBase, seedSys = null) {
        if (!mainworldBase) throw new Error("Sean Protocol Violation: Phase 1 requires mainworldBase.");

        // Break potential circularity by deep-cloning the stars for the orbital structure
        let sysStars = null;
        if (seedSys && (seedSys.stars || []).length > 0) {
            // System Editor seed: use the working copy's stars directly, skipping the
            // homestar-string-parsing/default-star fallback below entirely.
            sysStars = seedSys.stars.map(s => Object.assign({}, s));
        } else if (mainworldBase && mainworldBase.homestar && mainworldBase.homestar.trim() !== '') {
            const parsed = parseT5HomestarString(mainworldBase.homestar);
            if (parsed.length > 0) sysStars = parsed;
        }

        if (!sysStars) {
            sysStars = mainworldBase.stars ? JSON.parse(JSON.stringify(mainworldBase.stars)) : [{ type: 'G', decimal: 2, size: 'V', name: 'Primary', orbitID: 0 }];
        }

        const sys = {
            mainworld: { ...mainworldBase, type: 'Mainworld' },
            stars: sysStars,
            sggCount: 0
        };

        _initStars(sys.stars);

        const primary = sys.stars[0];

        // A Companion star (distinct from a numbered Close/Near/Far secondary) is placed "well
        // inside Orbit 0" (T5_COMPANION_AU, 0.05 AU vs. Orbit 0's 0.2 AU) and RAW defines no
        // orbital-stability exclusion zone around it — confirmed via Sean's Requirements Agent,
        // directives/project_manifest.md — unlike Book 6: Scouts, which pushed planets away from
        // secondary stars mathematically. Orbit 0 is therefore fully available to a world
        // whenever the primary has a Companion, exactly as if it didn't — the only thing that
        // ever precludes a low orbit number is the primary star's own physical size
        // (T5_PRECLUDED_ORBITS, consulted inside findAvailableOrbit). A prior pass had
        // findAvailableOrbit reserve Orbit 0 whenever the primary had a Companion, with no RAW
        // basis — removed.

        // System Editor seed-body placement: place every seeded body at its own orbit BEFORE
        // any dice-rolled inventory/placement runs, and before Phase 1 (mainworld anchor), since
        // a moon-mainworld's parent must already be sitting in orbits[].contents by the time
        // Phase 1 looks for it (see mainworldBase.parentBodyId below). findAvailableOrbit's
        // existing `!star.orbits[o].contents` check means placing a body here automatically
        // keeps every later placement pass (Phase 1, 3-5) from landing on the same slot — no
        // separate reserved-orbit bookkeeping is needed.
        const hasSeedWorlds = !!(seedSys && Array.isArray(seedSys.worlds) && seedSys.worlds.length > 0);
        const allowAddBodies = !!(seedSys && seedSys._allowAddBodies);
        // Whether this call came from the System Editor at all (vs. a classic stochastic macro
        // call, which always passes seedSys=null — see generateT5System's default parameter and
        // Algorithm 6's safety guarantee in directives/project_manifest.md). Deliberately NOT
        // the same thing as hasSeedWorlds: T5.write() (t5_editor_adapter.js) always excludes the
        // mainworld body from seed.worlds by design (it's threaded separately via
        // seed.mainworldUWP), so a system whose *only* body is the mainworld produces an empty
        // seed.worlds — hasSeedWorlds alone would (and did, see OW-42, directives/
        // project_manifest.md) wrongly treat that as "nothing was seeded" and let the inventory
        // roll below fire anyway, ignoring the user's unchecked "Allow engine to add additional
        // bodies" box. isEditorSeeded mirrors MgT2E's own `!seedSys || seedSys._allowAddBodies`
        // gate (mgt2e_bottomup_generator.js) instead of inventing a T5-specific signal.
        const isEditorSeeded = !!seedSys;
        if (hasSeedWorlds) {
            seedSys.worlds.forEach(w => {
                const starIdx = w.parentStarIdx || 0;
                const hostStar = sys.stars[starIdx] || primary;
                const resolved = findAvailableOrbit(hostStar, w.orbitId);
                _log(`[SEED PLACEMENT] "${w.name || w.type}" (_id=${w._id}, type=${w.type}) target orbitId=${w.orbitId} parentStarIdx=${starIdx} moons=${(w.moons || []).length} -> ${resolved >= 0 ? `placed at Orbit ${resolved}` : 'DROPPED — no available orbit slot found'}`);
                if (resolved < 0) return;
                const body = createBodyPlaceholder(_seedCategory(w.type), w);
                hostStar.orbits[resolved].contents = body;
                if (w.moons && w.moons.length) {
                    // Skip the mainworld itself if it's one of this body's seeded moons — Phase 1
                    // (below) places sys.mainworld into this same parent's satellites separately;
                    // including it here too would duplicate it.
                    const mwId = seedSys.mainworldUWP && seedSys.mainworldUWP._id;
                    body.satellites = w.moons
                        .filter(m => !mwId || m._id !== mwId)
                        .map(m => Object.assign({ type: 'Moon', _manualFields: [] }, m));
                }
            });
        }

        // PHASE 2 (PRE-REQUISITE): System Inventory (Moved up for Continuation Method)
        // Locked to 0 when this is a System Editor call and the user hasn't checked "Allow
        // engine to add additional bodies" — the seeded bodies (mainworld included, even though
        // it's not part of seedSys.worlds — see isEditorSeeded above) are the entire inventory
        // in that case.
        let ggCountTotal = (isEditorSeeded && !allowAddBodies) ? 0 : Math.max(0, Math.floor(_roll2D() / 2) - 2);
        let beltCountTotal = (isEditorSeeded && !allowAddBodies) ? 0 : Math.max(0, _roll1D() - 3);
        const otherTerrTotal = (isEditorSeeded && !allowAddBodies) ? 0 : _roll2D(); // Inventory = MW + GG + Belt + 2D.

        // System Editor HZCO override (seedSys.hzco, same generic field CT/MgT2E honor via
        // _resolveHzOrbit/seedSys.hzco || 0) — null/undefined means "auto", derive from the
        // primary's own spectral type/size as before. Clearing the editor's HZCO box sets
        // _workingCopy.hzco back to null, which _buildSeedSys carries through unchanged, so the
        // next Preview/Fill & Save falls right back to the star-physics-derived value.
        const hzOrbit = (seedSys && seedSys.hzco != null) ? seedSys.hzco : getStarHZ(primary);
        sys.hzOrbit = hzOrbit; // star-physics HZ orbit (or System Editor override) — read by system_viewer.js
        const hzResult = generateHZAndClimate(primary.type);

        // PHASE 1: THE ANCHOR (Mainworld)
        // =================================================================
        // When editing/re-saving an existing system, the seed already knows this body's prior
        // orbit — pin to it instead of re-rolling HZ + a fresh hzVariance every Fill & Save.
        let mwTarget = (mainworldBase.orbitId != null)
            ? mainworldBase.orbitId
            : clampUWP(hzOrbit + hzResult.hzVariance, 0, 19);
        // Climate/trade-code assignment (Tr/Tu/Fr) is deliberately deferred until mwTarget holds
        // its FINAL resolved value, after the satellite/standalone placement block below — see
        // the comment down there for why.

        // Action 6.3: T5 Continuation Method - Handle Predefined Satellite Injection
        let isSatellite = mainworldBase.isPreMoon === true ||
            (mainworldBase.tradeCodes && (mainworldBase.tradeCodes.includes('Sa') || mainworldBase.tradeCodes.includes('Lk')));

        // Objective 1: Step B2 Intercept (Random Lunar Attachment for standard worlds)
        // The 'Lk'/'Sa' pushes here are provisional — isMoon/isSatellite/isTidallyLocked aren't
        // set on sys.mainworld yet at this point, so a full calculateT5TradeCodes recompute
        // couldn't derive them correctly here even if we ran it now. The real recompute happens
        // below (after the flags are set), which supersedes these; isTidallyLocked is recorded
        // here so that later recompute can tell Close (Lk) apart from Far (Sa).
        if (!isSatellite && mainworldBase.isPreMoon !== false) {
            const lunarFlux = rollFlux();
            if (lunarFlux === -3) {
                isSatellite = true;
                sys.mainworld.isTidallyLocked = true;
                tResult('Lunar Trigger', 'LOCKED SATELLITE (Lk)', 'T5 1.3: Orbit Allocation');
            } else if (lunarFlux <= -4) {
                isSatellite = true;
                tResult('Lunar Trigger', 'FAR SATELLITE (Sa)', 'T5 1.3: Orbit Allocation');
            }
        }

        if (isSatellite) {
            let parent = null;
            // True when `parent` was found already sitting in a star's orbits (placed earlier by
            // the seeded-body pass) rather than freshly synthesized below — see the placement
            // guard at the bottom of this block (OW-59).
            let parentAlreadyPlaced = false;

            // System Editor seed: the mainworld's parent body was already placed above (it's a
            // real body the user placed in the working copy, not a fresh roll) — find it by _id
            // instead of synthesizing a new GG/BigWorld every save.
            if (mainworldBase.parentBodyId) {
                const hostStar = sys.stars[mainworldBase.parentStarIdx || 0];
                const found = hostStar && hostStar.orbits.find(o => o.contents && o.contents._id === mainworldBase.parentBodyId);
                parent = found ? found.contents : null;
                parentAlreadyPlaced = !!parent;
                _log(`[MAINWORLD PARENT LOOKUP] parentBodyId=${mainworldBase.parentBodyId} parentStarIdx=${mainworldBase.parentStarIdx ?? 0} -> ${parent ? `FOUND (${parent.type}, _id=${parent._id})` : 'NOT FOUND — host star\'s placed orbits: [' + ((hostStar && hostStar.orbits || []).filter(o => o.contents).map(o => `Orbit ${o.orbit}: ${o.contents.type} _id=${o.contents._id}`).join(' | ')) + ']'}`);
            } else {
                _log(`[MAINWORLD PARENT LOOKUP] mainworldBase.parentBodyId is not set (isSatellite=true via ${mainworldBase.isPreMoon === true ? 'isPreMoon' : 'tradeCodes/lunar roll'}) — skipping lookup, going straight to fallback.`);
            }

            if (!parent && ggCountTotal > 0) {
                // T5 RAW: Pre-defined moon consumes one GG from inventory
                ggCountTotal--;
                const ggStats = generateGasGiantStats();
                parent = { ...ggStats, type: ggStats.type, satellites: [sys.mainworld] };
            } else if (!parent) {
                // No GGs rolled? Spawn a free BigWorld parent (T5 RAW Backup)
                parent = {
                    type: 'BigWorld',
                    worldType: 'BigWorld',
                    size: _roll2D() + 7,
                    satellites: [sys.mainworld]
                };
            } else {
                if (!parent.satellites) parent.satellites = [];
                parent.satellites.push(sys.mainworld);
            }

            // Objective 2: Sub-Orbit Flux Roll (Ay through Zee naming convention)
            let satFlux = rollFlux();
            sys.mainworld.orbitLetter = String.fromCharCode(97 + (satFlux + 6)); // Flux -6..6 maps to a..m

            // CRITICAL UI FIX: Apply the Universal Project Flags so the map renderer sees the moon
            sys.mainworld.isMoon = true;
            sys.mainworld.isSatellite = true;
            sys.mainworld.isLunarMainworld = true;
            sys.mainworld.parentType = parent.type;
            sys.mainworld.parentBody = parent.type; // Needed for the T5 Biography Logger

            // Recompute trade codes now that isMoon/isSatellite/isTidallyLocked are known — this
            // is the ONLY place a manually-designated satellite mainworld (System Editor
            // isPreMoon, as opposed to the random lunar-attachment roll above) ever gets a
            // chance to pick up 'Sa'/'Lk'. generateT5Mainworld computed tradeCodes once already,
            // long before the mainworld's satellite status was known, so a full recompute here
            // (not just patching in Sa/Lk) also re-validates every other trade code against the
            // now-final worldType/travelZone — mirrors MgT2E's own unconditional recompute at the
            // end of its socioeconomic pass (mgt2e_socio_engine.js).
            if (!_isManual(sys.mainworld, 'tradeCodes') && T5_World_Engine && T5_World_Engine.calculateT5TradeCodes) {
                sys.mainworld.tradeCodes = T5_World_Engine.calculateT5TradeCodes(sys.mainworld);
            }

            // SEAN PROTOCOL: Moon-Mainworld Selection Logging
            tResult('Mainworld Status', 'LUNAR SELECTION', 'T5 1.3: Orbit Allocation');
            _log(`[MAINWORLD LOG] Hex ${mainworldBase.hexId || 'null'}: T5 Mainworld is a MOON attached to a ${parent.type} (Sub-Orbit ${sys.mainworld.orbitLetter})`);

            // Only place `parent` into a fresh orbit slot when it's a newly-synthesized fallback
            // (BigWorld or a new Gas Giant) — those have nowhere to live yet. A `parent` found via
            // the parentBodyId lookup above is *already* sitting in its seeded orbit slot; placing
            // it again here would put the same object reference into a second, different empty
            // slot (findAvailableOrbit naturally picks an empty one, since the real slot is
            // occupied by this very object), duplicating the Gas Giant and every one of its
            // moons — including the mainworld — everywhere the system gets walked (biography log,
            // UWP auditor, System Editor accordion, orrery) (OW-59).
            if (!parentAlreadyPlaced) {
                mwTarget = findAvailableOrbit(primary, mwTarget);
                if (mwTarget >= 0) primary.orbits[mwTarget].contents = parent;
            }
        } else {
            // Mainworld as standalone planet (or belt)
            if (sys.mainworld.size === 0) sys.mainworld.worldType = 'Belt';
            mwTarget = findAvailableOrbit(primary, mwTarget);
            if (mwTarget >= 0) primary.orbits[mwTarget].contents = sys.mainworld;
        }

        // Climate/trade-code assignment (Tr/Tu/Fr), deferred until here so it reads mwTarget's
        // FINAL resolved value — for a standalone mainworld that's its own orbit slot (line 552
        // above); for a lunar mainworld it's the PARENT's slot (the moon's actual distance from
        // the star is the parent's, not some pre-placement estimate), whether the parent was a
        // pre-existing seeded body (mwTarget untouched since it was set from mainworldBase.orbitId
        // — t5_editor_adapter.js's write() already threads the OWNER's orbitId through for a
        // moon-mainworld) or freshly synthesized just above (mwTarget reassigned at line 546).
        // Previously this ran BEFORE the satellite/standalone block even existed (right after
        // hzOrbit was known), using an independent rollFlux() draw with no relationship to the
        // body's actual final position — so moving a mainworld's orbit in the System Editor and
        // hitting Preview several times could roll a *different* climate code each time, and
        // since the old code only checked "is this exact code already present" before pushing,
        // two mutually-exclusive codes (e.g. Tu and Tr — Cold vs Hot, only one can ever be true)
        // could both end up in tradeCodes permanently. Recomputing deterministically from the
        // actual final orbit-vs-HZ distance (same formula T5_World_Engine.calculateT5Climate
        // already uses for subordinate worlds' climateZone: variance = orbit - hzOrbit, clamped
        // to T5_Data.CLIMATE_MAPPING's -2..2 range) fixes both: it always matches wherever the
        // body actually ends up, and stripping any prior Tr/Tu/Fr before adding the new one
        // guarantees at most one is ever present. Runs unconditionally (not gated by
        // _isManual(sys.mainworld,'tradeCodes')) — climate/trade-code here is meant to always
        // track the body's real position, the same way an imported/locked mainworld's *other*
        // trade codes stay untouched by every other step in this function; a locked mainworld's
        // Tr/Tu/Fr can still shift on its first post-import Preview if the import didn't carry a
        // real orbit slot (imports never do — see io_manager.js importT5Tab), same as any other
        // freshly-placed body.
        if (mwTarget >= 0) {
            const climateMapping = (typeof T5_Data !== 'undefined' && T5_Data.CLIMATE_MAPPING) ? T5_Data.CLIMATE_MAPPING : {};
            const climateVariance = clampUWP(mwTarget - hzOrbit, -2, 2);
            sys.mainworld.climateZone = climateMapping[String(climateVariance)] || '';
            const climateTradeCode = climateVariance === -1 ? 'Tr' : climateVariance === 1 ? 'Tu' : climateVariance === 2 ? 'Fr' : '';
            if (!sys.mainworld.tradeCodes) sys.mainworld.tradeCodes = [];
            sys.mainworld.tradeCodes = sys.mainworld.tradeCodes.filter(c => c !== 'Tr' && c !== 'Tu' && c !== 'Fr');
            if (climateTradeCode) sys.mainworld.tradeCodes.push(climateTradeCode);
        }

        // Social and Inventory Flags for Mainworld
        if (T5_World_Engine && T5_World_Engine.generateT5Bases) {
            T5_World_Engine.generateT5Bases(sys.mainworld);
        }
        sys.mainworld.gasGiantsCount = ggCountTotal;
        sys.mainworld.gasGiant = (ggCountTotal > 0 || isSatellite); // If moon of GG, flag is true

        // Shared helper for Rotating Placement
        function placeCategory(category, count, targetStars, placementLogic) {
            let starIdx = 0;
            for (let i = 0; i < count; i++) {
                const hostStar = targetStars[starIdx];
                const hostHZ = getStarHZ(hostStar);

                // Maximum orbit for secondary stars: Primary Orbit - 3
                const maxOrbitLimit = (hostStar === primary) ? 19 : Math.max(0, hostStar.orbitID - 3);

                const targetOrbit = placementLogic(hostHZ, i === count - 1);
                const resolved = findAvailableOrbit(hostStar, targetOrbit);

                if (resolved >= 0 && resolved <= maxOrbitLimit) {
                    const body = createBodyPlaceholder(category);
                    hostStar.orbits[resolved].contents = body;
                }

                starIdx = (starIdx + 1) % targetStars.length;
            }
        }

        // seedOverride (System Editor only): overlays a working-copy body's locked identity/
        // fields onto the placeholder so Fill & Save doesn't reroll a body's type/size/atm/
        // hydro/pop every save. Fields left undefined here (not seeded) fall through to the
        // normal roll further down in generateT5SubordinateUWP, same as an unseeded body.
        function createBodyPlaceholder(category, seedOverride) {
            let base;
            if (category === 'GG') {
                const stats = generateGasGiantStats();
                base = { type: stats.type, size: stats.size, _manualFields: [] };
            } else if (category === 'BELT') {
                base = { type: 'Planetoid Belt', size: 0, worldType: 'Belt', _manualFields: [] };
            } else {
                base = { type: 'Terrestrial World', _manualFields: [] };
            }
            if (!seedOverride) return base;
            return Object.assign(base, {
                _id: seedOverride._id,
                name: seedOverride.name,
                uwp: seedOverride.uwp,
                type: seedOverride.type || base.type,
                worldType: seedOverride.worldType !== undefined ? seedOverride.worldType : base.worldType,
                size: seedOverride.size !== undefined ? seedOverride.size : base.size,
                atm: seedOverride.atm,
                hydro: seedOverride.hydro,
                pop: seedOverride.pop,
                // gov/law/starport/tl were missing here even after _t5UwpLockFor (t5_editor_adapter.js)
                // started marking them manual (T5 overhaul punch-list item 2) — _manualFields
                // correctly claimed these fields were locked, but the actual seeded values never
                // reached the placed body, so generateT5SubordinateUWP's `!_isManual(...)` guard
                // correctly skipped rolling them, leaving them permanently undefined instead of
                // holding the previous roll. See OW-45, directives/project_manifest.md.
                gov: seedOverride.gov,
                law: seedOverride.law,
                starport: seedOverride.starport,
                tl: seedOverride.tl,
                _manualFields: seedOverride._manualFields || [],
            });
        }

        // Maps a System Editor seed body's `type` string to the GG/BELT/WORLD category tags
        // createBodyPlaceholder/placeCategory already use internally.
        function _seedCategory(seedType) {
            if (seedType === 'Large Gas Giant' || seedType === 'Small Gas Giant') return 'GG';
            if (seedType === 'Planetoid Belt') return 'BELT';
            return 'WORLD';
        }

        // PHASE 3: Place Gas Giants
        placeCategory('GG', ggCountTotal, sys.stars, (hz, isFinal) => {
            const roll = _roll2D();
            const stats = generateGasGiantStats(); // We need a temp roll for type to use correct formula
            if (stats.type === 'Large Gas Giant') return clampUWP(hz + (roll - 5), 0, 19);
            if (stats.type === 'Small Gas Giant') return clampUWP(hz + (roll - 4), 0, 19);
            return clampUWP(hz + (roll - 1), 0, 19); // Ice Giant
        });

        // PHASE 4: Place Belts (Reset Rotation)
        placeCategory('BELT', beltCountTotal, sys.stars, (hz) => clampUWP(hz + (_roll2D() - 3), 0, 19));

        // PHASE 5: Place Other Worlds (Reset Rotation)
        placeCategory('WORLD', otherTerrTotal, sys.stars, (hz, isFinal) => {
            const roll = _roll2D();
            if (isFinal) return clampUWP(19 - roll, 0, 19);
            const arrayIndex = clampUWP(roll - 2, 0, 10);
            return T5_Data.P2_PLACEMENT_CHART.WORLD1[arrayIndex];
        });

        // PHASE 6: Fleshing and Audit
        // capToExisting: when the System Editor locked the body count (editor-driven,
        // allowAddBodies unchecked), don't let generateT5Satellites roll additional moons beyond
        // what was seeded. Gated on isEditorSeeded, not hasSeedWorlds — see the inventory-count
        // gate above for why (a mainworld-only system has an empty seedSys.worlds by design, so
        // hasSeedWorlds alone wrongly signals "nothing was seeded" here too, letting a
        // mainworld's own moon count re-roll fresh — and fluctuate, not just grow — on every
        // single Preview/Fill & Save; see OW-43, directives/project_manifest.md).
        fleshOutSubordinates(sys, isEditorSeeded && !allowAddBodies);

        // --- PHASE 7: JOURNEY MATH SWEEP (Phase 2 Integration) ---
        if (typeof MgT2EMath !== 'undefined' && MgT2EMath.performJourneyMathSweep) {
            MgT2EMath.performJourneyMathSweep(sys);
        }

        // --- ACTION 6.4: PLANET-CENTRIC BIOGRAPHIES (v0.6.0.0) ---
        if (T5_Stellar_Engine && T5_Stellar_Engine.walkT5System && T5_Stellar_Engine.logT5BodyBiography) {
            tSection('System Biographies');
            T5_Stellar_Engine.walkT5System(sys, (body) => {
                T5_Stellar_Engine.logT5BodyBiography(body);
            });
        }

        // Auditing is run externally by system_driver.js (T5_Auditor.runAndLog), the single
        // real call site — see js/t5_uwp_auditor.js.

        if (typeof applyT5OrbitalNames === 'function') applyT5OrbitalNames(sys);

        return sys;
    }

    /**
     * Generates subordinate satellites (moons) for a body.
     * T5 RAW ("For Each World in the System", confirmed via Sean's Requirements Agent): the
     * satellite-count dice modifier depends on the PARENT's own zone, not just Gas-Giant-vs-not —
     * Gas Giant 1D-1 (any zone); non-GG Inner 1D-5, Hospitable 1D-4, Outer 1D-3.
     */
    function generateT5Satellites(parent, orbit, hostHZ, maxSubPop, capToExisting) {
        if (!parent || parent.type === 'Empty' || parent.worldType === 'Belt') return;

        if (!parent.satellites) parent.satellites = [];
        const startIdx = parent.satellites.length;

        const isGG = (parent.type && (parent.type.includes('Gas Giant') || parent.type === 'Ice Giant'));
        let countDM;
        if (isGG) {
            countDM = -1;
        } else if (orbit <= hostHZ - 2) {
            countDM = -5; // Inner
        } else if (orbit >= hostHZ + 2) {
            countDM = -3; // Outer
        } else {
            countDM = -4; // Hospitable
        }
        // A roll of exactly 0 means "Ring, reroll for the real solid-moon count" (T5 RAW). This
        // app doesn't model Rings for T5 yet (Sean-confirmed stopgap) — reroll until the count
        // resolves to something other than exactly 0 instead of producing a phantom Ring body.
        // Bounded so a pathological DM can't spin forever; falls back to 0 moons if it never
        // clears (shouldn't happen for any of the four real DMs above, all of which have a
        // nonzero result on 5 of 6 faces).
        let rawCount = _roll1D() + countDM;
        for (let guard = 0; rawCount === 0 && guard < 20; guard++) rawCount = _roll1D() + countDM;
        const rolledCount = Math.max(0, rawCount);
        // capToExisting (System Editor, seeded + allowAddBodies unchecked): never roll additional
        // moons beyond what the user placed.
        const moonCount = capToExisting ? startIdx : rolledCount;

        if (moonCount > startIdx) {
            _log(`Satellite Generation: Body in Orbit ${orbit} rolling for ${moonCount} satellites (already has ${startIdx}).`);
        }

        for (let i = startIdx; i < moonCount; i++) {
            const moon = { type: 'Moon', parentBody: (isGG ? 'Gas Giant' : 'Planet'), _manualFields: [] };
            generateT5SubordinateUWP(moon, orbit, hostHZ, maxSubPop, true);

            // T5 RAW physics constraint: Moon must be smaller than Parent. A Gas Giant's own
            // `.size` is T5's own lettered tier code (M/N for Small, P/Q/R/S/T/U/V/W/X for
            // Large — generateGasGiantStats above) — a standard eHex digit, except 'R'/'S'
            // specifically collide with fromEHex's CT-specific Ring/Small-moon sentinels
            // (0.1/0.5). Resolve those two to their real eHex value (R=25, S=26 — confirmed via
            // Sean's Requirements Agent) directly instead of falling through into fromEHex's
            // CT-flavored intercept; every other GG size letter already resolves correctly via
            // fromEHex with no collision.
            let pSize = parent.size;
            if (isGG) {
                if (parent.size === 'R') pSize = 25;
                else if (parent.size === 'S') pSize = 26;
                else pSize = (typeof parent.size === 'string') ? fromEHex(parent.size) : parent.size;
            }

            if (pSize !== undefined && moon.size >= pSize) {
                _log(`Physics Constraint: Moon size ${moon.size} >= Parent size ${pSize}. Clamping Moon to ${Math.max(0, pSize - 1)}.`);
                moon.size = Math.max(0, pSize - 1);

                // If size is clamped to < 2, we must fix classification and hydrographics to maintain audit integrity
                if (moon.size < 2) {
                    if (moon.size === 0 && ['Hospitable', 'InnerWorld', 'IceWorld', 'StormWorld', 'RadWorld', 'BigWorld'].includes(moon.worldType)) {
                        _log(`Classification Adjustment: ${moon.worldType} size 0 must be Worldlet.`);
                        moon.worldType = 'Worldlet';
                    }
                    if (moon.hydro > 0) {
                        _log(`Hydro Adjustment: Size ${moon.size} world cannot have Hydro ${toEHex(moon.hydro)}. Resetting to 0.`);
                        moon.hydro = 0;
                    }
                    if (moon.size === 0 && moon.atm > 0 && moon.worldType !== 'Inferno') {
                        _log(`Atmosphere Adjustment: Size 0 non-inferno cannot have Atm ${toEHex(moon.atm)}. Resetting to 0.`);
                        moon.atm = 0;
                    }
                }

                // Re-build UWP string with new size and adjusted stats
                moon.uwp = `${moon.starport}${toEHex(moon.size)}${toEHex(moon.atm)}${toEHex(moon.hydro)}${toEHex(moon.pop)}${toEHex(moon.gov)}${toEHex(moon.law)}-${toEHex(moon.tl)}`;
                moon.uwpSecondary = moon.uwp;
            }

            parent.satellites.push(moon);
        }
    }

    /**
     * Iterates through all stars and their orbits to generate UWP data.
     */
    function fleshOutSubordinates(sys, capToExisting) {
        const mwPop = sys.mainworld.pop || 0;
        const maxSubPop = Math.max(0, mwPop - 1);

        sys.stars.forEach(star => {
            const hostHZ = getStarHZ(star);
            star.orbits.forEach(o => {
                const body = o.contents;
                if (!body || body.type === 'Empty') return;

                // Apply Full T5 Orbit Labeling (Positional + Climate)
                if (!_isManual(body, 'climateZone')) body.climateZone = getT5OrbitLabel(o.orbit, hostHZ);
                // Generator placeholders don't carry their own orbitId (position is implied by
                // array index) — stamp it here so calculateT5RotationalDynamics below can tell
                // orbit 0/1 (tidally locked to the star) from everything else.
                if (body.orbitId === undefined) body.orbitId = o.orbit;

                // 1. Flesh out the parent body
                if (body !== sys.mainworld) {
                    generateT5SubordinateUWP(body, o.orbit, hostHZ, maxSubPop, false);
                }

                // 2. Generate new satellites
                if (body.worldType !== 'Belt' && body.type !== 'Planetoid Belt') {
                    generateT5Satellites(body, o.orbit, hostHZ, maxSubPop, capToExisting);
                }

                // 3. Flesh out existing satellites (e.g. injected Mainworld)
                if (body.satellites) {
                    body.satellites.forEach(s => {
                        if (!_isManual(s, 'climateZone')) s.climateZone = body.climateZone;
                        // t5_editor_adapter.js's _t5BodySeed always seeds an ungenerated moon's
                        // uwp as `null` (`m.uwp || null`), never `undefined` — the old strict
                        // `=== undefined` check never matched a seeded-but-not-yet-generated
                        // moon, silently skipping worldType/size/atm/etc. generation for every
                        // manually-added moon that hadn't already completed one full Preview/
                        // Fill & Save (an already-generated moon carries a real, truthy .uwp
                        // string and still correctly skips re-generation here).
                        if (s !== sys.mainworld && !s.uwp) {
                            generateT5SubordinateUWP(s, o.orbit, hostHZ, maxSubPop, true);
                        }
                        
                        if (!s.distAU && body.distAU) { s.distAU = body.distAU; }
                        // Mark as a satellite so calculateT5RotationalDynamics evaluates it against
                        // its parent body, not the star — without this it would inherit the parent's
                        // orbitId and could be wrongly flagged "tidally locked to the star".
                        if (s.isMoon === undefined && s.isSatellite === undefined) s.isMoon = true;

                        // PHASE 2.1 FINAL FIX: Ensure physics are recalculated for EVERY satellite
                        T5_World_Engine.calculateT5PhysicalStats(s);
                        if (T5_World_Engine.calculateT5Climate) T5_World_Engine.calculateT5Climate(s, 1.0);
                        if (T5_World_Engine.calculateT5RotationalDynamics) T5_World_Engine.calculateT5RotationalDynamics(s);
                    });
                }

                // PHASE 2.1 FINAL FIX: Absolute last step for the main body
                T5_World_Engine.calculateT5PhysicalStats(body);
                if (T5_World_Engine.calculateT5Climate) T5_World_Engine.calculateT5Climate(body, 1.0);
                if (T5_World_Engine.calculateT5RotationalDynamics) T5_World_Engine.calculateT5RotationalDynamics(body);
            });
        });
    }

    /**
     * Determines world classification based on orbit and habitability.
     */
    function getT5Classification(orbit, hzOrbit, isSatellite) {
        const isZoneA = (orbit <= hzOrbit + 1);
        const limit = hzOrbit + 1;

        if (isZoneA) {
            _log(`Zone Detection: Orbit ${orbit} is <= HZ+1 (Orbit ${limit}). Zone A applied.`);
        } else {
            _log(`Zone Detection: Orbit ${orbit} is >= HZ+2 (Orbit ${limit}). Zone B applied.`);
        }

        let roll = Math.floor(_rng() * 6) + 1;
        let type;
        if (isZoneA) {
            // T5's "Inner And HZ Satellites" table (confirmed via Sean's Requirements Agent) is
            // distinct from the primary-world Zone A table below — a moon in the HZ/inner zone
            // can only ever be Worldlet/IceWorld/BigWorld/RadWorld, never Inferno/InnerWorld/
            // Hospitable/Stormworld. Zone B already branched on isSatellite for exactly this
            // reason (see the else below); Zone A never did, so a moon here was silently rolling
            // on the primary-world table instead until now.
            if (isSatellite) {
                const table = ['Worldlet', 'IceWorld', 'BigWorld', 'IceWorld', 'RadWorld', 'IceWorld'];
                type = table[roll - 1];
            } else {
                const table = ['Inferno', 'InnerWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'Hospitable'];
                type = table[roll - 1];
            }
        } else {
            if (isSatellite) {
                const table = ['Worldlet', 'IceWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'IceWorld'];
                type = table[roll - 1];
            } else {
                const table = ['Worldlet', 'IceWorld', 'BigWorld', 'IceWorld', 'RadWorld', 'IceWorld'];
                type = table[roll - 1];
            }
        }
        _log(`World Type Roll: 1D6 (${roll}) -> ${type}`);
        return type;
    }

    /**
     * Generates a T5 Subordinate UWP.
     */
    function generateT5SubordinateUWP(world, orbit, hzOrbit, maxPop, isSatellite) {
        if (world.type && (world.type.includes('Gas Giant') || world.type === 'Ice Giant')) {
            world.worldType = world.type;
            T5_World_Engine.calculateT5PhysicalStats(world);
            world.uwp = world.size;
            world.uwpSecondary = world.size;
            return;
        }

        // Preserve existing classification — respect manual override, then soft-guard for already-set type
        if (!_isManual(world, 'worldType') && !world.worldType) {
            if (world.type === 'Planetoid Belt') {
                world.worldType = 'Belt';
            } else {
                world.worldType = getT5Classification(orbit, hzOrbit, isSatellite);
            }
        }

        const type = world.worldType;

        // 1. Physical: Size
        if (!_isManual(world, 'size') && world.size === undefined) {
            if (type === 'Belt') world.size = 0;
            else if (type === 'Inferno') world.size = _roll1D() + 6;
            else if (type === 'BigWorld') world.size = _roll2D() + 7;
            else if (type === 'Worldlet') world.size = Math.max(0, _roll1D() - 3);
            // T5's size overrides are specifically Worldlet/BigWorld/Stormworld (confirmed via
            // Sean's Requirements Agent) — RadWorld was previously lumped in with Stormworld's
            // 2D-exactly roll instead of falling to the standard 2D-2 below.
            else if (type === 'StormWorld') world.size = _roll2D();
            else world.size = Math.max(1, _roll2D() - 2);
        }

        // 2. Physical: Atmosphere
        const sizeVal = (typeof world.size === 'string' ? fromEHex(world.size) : (world.size || 0));

        if (!_isManual(world, 'atm')) {
            if (type === 'Inferno') {
                world.atm = fromEHex('B');
            } else if (type === 'Belt') {
                world.atm = 0;
            } else if (sizeVal === 0) {
                // T5 RAW: Size 0 always forces Atmosphere 0, regardless of Flux — a size-0
                // Worldlet (its size roll floors at 0) was previously still able to roll a
                // nonzero atmosphere from Flux alone.
                world.atm = 0;
            } else if (world.atm === undefined) {
                let dm = (type === 'StormWorld') ? 4 : 0;
                world.atm = clampUWP(sizeVal + rollFlux() + dm, (type === 'StormWorld' ? 4 : 0), 15);
            }
        }

        // 3. Physical: Hydrographics
        if (!_isManual(world, 'hydro')) {
            if (['Inferno', 'Belt'].includes(type) || sizeVal < 2) {
                world.hydro = 0;
            } else if (world.hydro === undefined) {
                let atmDM = (world.atm < 2 || world.atm > 9) ? -4 : 0;
                let typeDM = (['InnerWorld', 'StormWorld'].includes(type)) ? -4 : 0;
                world.hydro = clampUWP((world.atm || 0) + rollFlux() + atmDM + typeDM, 0, 10);
            }
        }

        // 4. Social: Population (Enforce Constraint)
        if (!_isManual(world, 'pop')) {
            let basePop = Math.max(0, _roll2D() - 2);
            let envDM = (type === 'InnerWorld') ? -4 : (['IceWorld', 'StormWorld'].includes(type) ? -6 : 0);
            world.pop = clampUWP(basePop + envDM, 0, maxPop);
        }

        // 5. Social: Spaceport (Enforce Downgrade Constraint)
        if (!_isManual(world, 'starport')) {
            const spScore = world.pop - _roll1D();
            if (spScore >= 4) world.starport = 'F';
            else if (spScore === 3) world.starport = 'G';
            else if (spScore === 2) world.starport = 'H';
            else world.starport = 'Y';
        }

        // 6. Social: Gov/Law
        if (!_isManual(world, 'gov')) world.gov = clampUWP(world.pop + rollFlux(), 0, 15);
        if (!_isManual(world, 'law')) world.law = clampUWP(world.gov + rollFlux(), 0, 18);

        // 7. Social: Tech Level
        if (!_isManual(world, 'tl')) {
            let tlDM = (world.starport === 'F') ? 1 : 0;
            if (world.size <= 1) tlDM += 2;
            if (world.atm <= 3 || world.atm >= 10) tlDM += 1;

            const settingsTlMod = (typeof window !== 'undefined' && window.generationTlMod !== undefined) ? window.generationTlMod : 0;
            const settingsTlMax = (typeof window !== 'undefined' && window.generationTlMax !== undefined) ? window.generationTlMax : 20;
            if (settingsTlMod !== 0) tlDM += settingsTlMod;

            const tlRoll = _roll1D();
            const flooredTl = Math.max(0, tlRoll + tlDM);
            world.tl = Math.min(flooredTl, settingsTlMax);

            _log(`TL Calc (Subordinate): Roll (${tlRoll}) + DMs (${tlDM - settingsTlMod}) = ${flooredTl}`);
            if (typeof tResult !== 'undefined') {
                tResult('Settings TL Modifier', settingsTlMod !== 0 ? `${settingsTlMod > 0 ? '+' : ''}${settingsTlMod}` : 'None (0)');
                tResult('Settings TL Max', world.tl < flooredTl ? `Cap applied: ${flooredTl} → ${world.tl}` : `No cap (${flooredTl} ≤ ${settingsTlMax})`);
                tResult('Tech Level Code', world.tl);
            }
        }

        T5_World_Engine.calculateT5PhysicalStats(world);
        if (T5_World_Engine.calculateT5Climate) T5_World_Engine.calculateT5Climate(world, 1.0);

        // --- 8. Social: Trade Codes ---
        if (!_isManual(world, 'tradeCodes') && T5_World_Engine && T5_World_Engine.calculateT5TradeCodes) {
            const calculated = T5_World_Engine.calculateT5TradeCodes(world);
            if (!world.tradeCodes) world.tradeCodes = [];
            calculated.forEach(code => {
                if (!world.tradeCodes.includes(code)) world.tradeCodes.push(code);
            });
        }

        // --- NEW: Bases and GG flag for Subordinates ---
        if (T5_World_Engine && T5_World_Engine.generateT5Bases && world.starport !== 'Y') {
            T5_World_Engine.generateT5Bases(world);
        }
        if (world.type && (world.type.includes('Gas Giant') || world.type === 'Ice Giant')) {
            world.gasGiant = true;
        }

        world.uwp = `${world.starport}${toEHex(world.size)}${toEHex(world.atm)}${toEHex(world.hydro)}${toEHex(world.pop)}${toEHex(world.gov)}${toEHex(world.law)}-${toEHex(world.tl)}`;
        world.uwpSecondary = world.uwp;
    }

    return { generateT5System, buildT5StarOnlyPreview, parseT5HomestarString };
}));
