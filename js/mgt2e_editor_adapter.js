// =============================================================================
// MGT2E_EDITOR_ADAPTER.JS — System Editor engine adapter for MgT2E
// Extracted verbatim from system_editor.js's _ENGINE_ADAPTERS.MgT2E (no logic
// changes) so CT-specific editor troubleshooting can no longer touch working
// MgT2E code by accident. Registers itself on window.SystemEditorAdapters.MgT2E;
// system_editor.js picks it up when it builds _ENGINE_ADAPTERS. Must load BEFORE
// system_editor.js (see hex_map.html script order).
//
// Shared helpers (uid/orbitIdToAU/canonType/ggTypeFrom/isMW/buildMoon/normTz/
// applyUwpSeed/clearSystemData) live in system_editor.js's closure and are only
// reachable via window.SystemEditorShared, set up by that file's own IIFE. The
// lazy SE() accessor below defers that lookup to call time (adapter methods
// only ever run long after both scripts have finished loading), so load order
// between the two files doesn't matter for these — only for the registration
// below, which system_editor.js reads synchronously while it builds
// _ENGINE_ADAPTERS.
//
// 2026-07-12: gained restoreManualFields()/backfillFromGenerated(), moved here (also verbatim)
// from system_editor.js's _restoreDisplayManualFields()/_preview() — those were the one part of
// the 2026-07-11 adapter-file split that hadn't actually moved yet (still per-engine
// if/else-if chains in system_editor.js). See _ENGINE_ADAPTERS' comment block there.
// =============================================================================

'use strict';

(function () {
    function SE() { return window.SystemEditorShared; }

    function _mgt2eUwpLockFor(body) {
        const raw = body._raw || {};
        if (!body.uwp || !body._raw) return { fields: {}, mf: [] };
        const fields = {};
        const mf = [];
        // Phase 1 physicals — size kept when !== undefined; no _manualFields needed
        if (raw.size !== undefined) fields.size = raw.size;
        // Phase 2 atm — engine checks _manualFields.includes('atmCode')
        // Hex editor saves 'atm'; engine field is 'atmCode' — prefer edited value.
        const atmVal = raw.atm !== undefined ? raw.atm : raw.atmCode;
        if (atmVal !== undefined) { fields.atmCode = atmVal; mf.push('atmCode'); }
        // Phase 2 hydro — engine checks _manualFields.includes('hydroCode')
        const hydroVal = raw.hydro !== undefined ? raw.hydro : raw.hydroCode;
        if (hydroVal !== undefined) { fields.hydroCode = hydroVal; mf.push('hydroCode'); }
        // Phase 5 socio — generateMainworldUWP inherits via hasSocials field check;
        // generateSubordinateSocial uses _manualFields, so add to mf for both paths.
        if (raw.pop      !== undefined) { fields.pop      = raw.pop;     mf.push('pop'); }
        if (raw.popCode  !== undefined) { fields.popCode  = raw.popCode; }
        if (raw.gov      !== undefined) { fields.gov      = raw.gov;     mf.push('gov'); }
        if (raw.govCode  !== undefined) { fields.govCode  = raw.govCode; }
        if (raw.law      !== undefined) { fields.law      = raw.law;     mf.push('law'); }
        if (raw.tl       !== undefined) { fields.tl       = raw.tl;      mf.push('tl'); }
        if (raw.starport !== undefined) { fields.starport = raw.starport; mf.push('starport'); }
        return { fields, mf };
    }

    // Fields seeded from _raw for all body types so generators skip re-rolling them.
    // Guards already exist in calculateTerrestrialPhysical for density/diamKm/mass/gravity.
    // 'size' is included so moons without a UWP (which bypass _mgt2eUwpLockFor) still have
    // their size seeded — the generatePhysicals guard checks body.size === undefined.
    // meanTempK/highTempK/lowTempK are intentionally excluded: the generator's geothermal
    // pass (line ~2376 in mgt2e_world_engine.js) uses w.meanTempK as the *solar-only* base
    // and adds inherentK on top. If we seed meanTempK with the final post-geothermal value
    // from _raw, the geothermal heat is applied twice. Let the generator re-derive all three
    // from the seeded albedo, greenhouseFactor, and eccentricity instead.
    const _MGT2E_PHYS_FIELDS = [
        'size',
        'siderealHours', 'axialTilt', 'tidallyLocked', 'solarDayHours',
        'eccentricity',
        'albedo', 'greenhouseFactor',
        'density', 'diamKm', 'mass', 'gravity', 'composition',
    ];
    function _mgt2ePhysSeed(raw) {
        const fields = {}; const mf = [];
        // Excludes null, not just undefined: a Planetoid Belt (or size-0/Ring body) has
        // siderealHours/solarDayHours/axialTilt deliberately nulled by generateRotationalDynamics
        // (mgt2e_world_engine.js — rotation doesn't apply to those types). Locking a null in as
        // "manual" survives a later type/size change away from Belt, so the next Preview's
        // isManual() check skips recomputing it and leaves the real value null — crashing the
        // first .toFixed() call on it (e.g. Solar Day (Hours) logging).
        _MGT2E_PHYS_FIELDS.forEach(f => { if (raw[f] !== undefined && raw[f] !== null) { fields[f] = raw[f]; mf.push(f); } });
        return { fields, mf };
    }

    // Extended Socioeconomics (Ix, RU, GWP, WTN, IR, DR, and all profile strings) is
    // expensive to hand-tune and fully re-rolled by mgt2e_socio_engine.js on every
    // generation pass. An unrelated System Editor edit (moving an orbit, adding a gas
    // giant) would otherwise regenerate the whole system and silently reroll all of it.
    // Snapshot the mainworld's already-generated values here so the socio engine can
    // carry them forward unchanged; the user can still force a fresh roll at any time
    // via the existing right-click "Generate Socioeconomic" menu action, which operates
    // directly on stateObj.mgtSystem and never sees this snapshot.
    const _MGT2E_EXT_SOCIO_FIELDS = [
        'pValue', 'totalWorldPop', 'pcr', 'urbanPercent', 'totalUrbanPop',
        'majorCities', 'totalMajorCityPop', 'govProfile', 'factions', 'factionsData',
        'lawProfile', 'techProfile', 'culturalProfile', 'culturalQuirks',
        'economicProfile', 'starportProfile', 'militaryProfile', 'judicialSystemProfile',
        'Im', 'ecoR', 'ecoL', 'ecoI', 'ecoE', 'RU', 'pcGWP', 'WTN', 'IR', 'DR',
        'resourceRating',
    ];
    function _mgt2eExtSocioSeedFor(raw) {
        if (!raw || raw.RU === undefined) return null;
        const snap = {};
        _MGT2E_EXT_SOCIO_FIELDS.forEach(f => { if (raw[f] !== undefined) snap[f] = raw[f]; });
        return snap;
    }

    window.SystemEditorAdapters = window.SystemEditorAdapters || {};
    window.SystemEditorAdapters.MgT2E = {
        detect(stateObj) {
            if (stateObj.mgtSystem && stateObj.mgtSystem.stars && stateObj.mgtSystem.stars.length > 0) {
                return { raw: stateObj.mgtSystem, engine: 'MgT2E' };
            }
            return null;
        },

        readBodies(raw, starIdByIdx) {
            const bodies = [];
            const mwRef = raw.mainworld;
            (raw.worlds || []).forEach(w => {
                if (!w || w.type === 'Empty') return;
                const isMainworld = SE().isMW(w, mwRef) || w.type === 'Mainworld';
                const rawType     = isMainworld ? 'World' : (w.type || '');
                const canon       = isMainworld ? 'World' : SE().canonType(rawType);
                const au          = w.au ?? w.orbitalRadius ?? w.distAU ?? (w.orbitId != null ? SE().orbitIdToAU(w.orbitId) : null);
                bodies.push({
                    _id: SE().uid('body'), type: canon,
                    ggType:        canon === 'Gas Giant' ? (w.ggType || SE().ggTypeFrom(rawType)) : null,
                    name: w.name || '', uwp: w.uwp || null, au,
                    orbitId:       w.orbitId ?? w.orbit ?? null,
                    travelZone:    w.travelZone || w.travelCode || 'G',
                    parentStarId:  starIdByIdx(w.parentStarIdx ?? 0),
                    isMainworld,
                    // A lunar mainworld's moon carries `type: 'Mainworld'` (stamped by
                    // Bottom-Up Phase 3's mainworld election / Top-Down's fixed anchor) but
                    // never its own `isMainworld` boolean — that flag is only ever set here,
                    // from mwRef/type, mirroring the top-level `isMainworld` check above and
                    // T5's equivalent fix (CT had the same gap, fixed 2026-07-07 as OW-12).
                    // Without this, no body shows the ★ highlight, wc.mainworldRef never
                    // resolves, and the next Preview/Save re-elects an entirely new mainworld.
                    moons:         (w.moons || w.satellites || []).map(m => SE().buildMoon(
                        Object.assign({}, m, { isMainworld: !!(m.isMainworld || m.type === 'Mainworld' || SE().isMW(m, mwRef)) })
                    )),
                    _manualFields: w._manualFields ? [...w._manualFields] : [],
                    _raw: w,
                });
            });
            return bodies;
        },

        // Returns the MgT2E-specific seedSys fields to merge onto the common seed skeleton
        // (stars/_mainworldRef/_allowAddBodies/age/hzco) that _buildSeedSys already built.
        write(wc, starIdxById) {
            const worlds = wc.bodies.map(b => {
                const parentStarIdx = starIdxById[b.parentStarId] ?? 0;
                const engType = b.isMainworld   ? 'Mainworld'
                    : b.type === 'Gas Giant'    ? 'Gas Giant'
                    : b.type === 'Belt'         ? 'Planetoid Belt'
                    : 'Terrestrial Planet';
                const { fields: uwpLock, mf: extraMF } = _mgt2eUwpLockFor(b);
                // Gas Giants: seed physical properties so sizeGasGiantBody preserves
                // diameter/mass and the Hill Sphere stays stable across Preview.
                const ggRaw = (b.type === 'Gas Giant' && b._raw) ? b._raw : null;
                const ggPhysFields = ggRaw ? {
                    ...(ggRaw.diamTerra !== undefined && { diamTerra: ggRaw.diamTerra }),
                    ...(ggRaw.diamKm    !== undefined && { diamKm:    ggRaw.diamKm    }),
                    ...(ggRaw.mass      !== undefined && { mass:      ggRaw.mass      }),
                    ...(ggRaw.gravity   !== undefined && { gravity:   ggRaw.gravity   }),
                    ...(ggRaw.density   !== undefined && { density:   ggRaw.density   }),
                } : {};
                const ggPhysMF = ggRaw
                    ? ['diamTerra', 'mass', 'gravity', 'density'].filter(f => ggRaw[f] != null)
                    : [];
                // All bodies: seed rotation/thermal so generateRotationalDynamics skips re-rolls.
                const { fields: rotFields, mf: rotMF } = _mgt2ePhysSeed(b._raw || {});
                return SE().applyUwpSeed({
                    _id:           b._id,
                    type:          engType,
                    ggType:        b.ggType  || null,
                    name:          b.name    || '',
                    uwp:           b.uwp     || null,
                    ...uwpLock,
                    ...rotFields,
                    ...ggPhysFields,
                    orbitId:       b.orbitId != null ? b.orbitId : null,
                    au:            b.orbitId != null ? (SE().orbitIdToAU(b.orbitId) ?? b.au ?? 1.0) : (b.au ?? 1.0),
                    orbitalRadius: b.orbitId != null ? (SE().orbitIdToAU(b.orbitId) ?? b.au ?? 1.0) : (b.au ?? 1.0),
                    parentStarIdx,
                    travelZone:    SE().normTz(b.travelZone),
                    _extSocioFrozen: _mgt2eExtSocioSeedFor(b._raw),
                    moons: (b.moons || []).map(m => {
                        const { fields: mUwpLock, mf: mExtraMF } = _mgt2eUwpLockFor(m);
                        const { fields: mRotFields, mf: mRotMF } = _mgt2ePhysSeed(m._raw || {});
                        return SE().applyUwpSeed({
                            _id:          m._id,
                            type:         m.isMainworld ? 'Mainworld' : 'Satellite',
                            name:         m.name || '',
                            uwp:          m.uwp  || null,
                            ...mUwpLock,
                            ...mRotFields,
                            isMainworld:  !!m.isMainworld,
                            pd:           m.pd,
                            pos:          m.pos,
                            eccentricity: m.eccentricity,
                            retrograde:   m.retrograde,
                            _extSocioFrozen: _mgt2eExtSocioSeedFor(m._raw),
                            _manualFields: [...(m._manualFields || []), ...mExtraMF, ...mRotMF],
                        }, m._uwpSeed);
                    }),
                    _manualFields: [...(b._manualFields || []), ...extraMF, ...rotMF, ...ggPhysMF],
                }, b._uwpSeed);
            });
            return { worlds };
        },

        run(hexId, seedSys, stateObj) {
            let newSys = null;
            if (typeof MgT2EBottomUpGenerator !== 'undefined') {
                newSys = MgT2EBottomUpGenerator.generateSystem(hexId, seedSys);
            }
            if (newSys) {
                SE().clearSystemData(stateObj);
                stateObj.mgtSystem = newSys;
                stateObj.mgt2eData = newSys.mainworld || null;
                stateObj.mgtSocio  = newSys.mainworld || null;
            }
            return newSys;
        },

        // Restores true (user-edited-only) _manualFields on the generated output. uwpLockFor()/
        // physSeed()/ggPhysFields (write() above) deliberately mark every field present in a
        // body's/moon's _raw as "manually locked" so the generator won't re-roll values that are
        // only being preserved from a prior save — necessary for stability. But that same
        // _manualFields array is also what the accordion reads to highlight a field as
        // user-edited (isManual(), core.js:478). Left uncorrected, every pre-existing world's
        // fields would show as manually edited the moment the System Editor regenerates the
        // system at all, even if the user only touched one unrelated body. The working copy's
        // own _manualFields (built up only by explicit UI edits — star overrides, UWP seed
        // digits, moon pd edits, drag-reorder, etc.) is the source of truth for display purposes,
        // so copy it onto the generated output.
        restoreManualFields(wc, newSys) {
            if (!newSys.worlds) return;
            wc.bodies.forEach(wcBody => {
                const genBody = newSys.worlds.find(w => w._id === wcBody._id);
                if (!genBody) return;
                genBody._manualFields = wcBody._manualFields ? [...wcBody._manualFields] : [];
                (wcBody.moons || []).forEach(wcMoon => {
                    const genMoon = (genBody.moons || []).find(m => m._id === wcMoon._id);
                    if (genMoon) genMoon._manualFields = wcMoon._manualFields ? [...wcMoon._manualFields] : [];
                });
            });
        },

        // Backfill ONLY hillSpanPd (Hill Sphere limit, in planetary diameters) so _addMoon can
        // pick a safe orbital slot for new moons. Deliberately narrow: physSeed()/ggPhysFields
        // (write() above) treat ANY field present in a body's _raw as manually locked and stamp
        // it into _manualFields — which is also what the accordion reads to paint a field
        // yellow/italic (isManual(), core.js:478). Backfilling the full physical-field set here
        // previously caused every world's fields to show as "manually edited". hillSpanPd itself
        // isn't consumed by any of those lock helpers, so storing it is inert with respect to
        // _manualFields/highlighting.
        //
        // Also backfills moon orbital data (pd/pos/eccentricity/retrograde) so repeated Previews
        // don't keep re-rolling positions, and re-sorts each body's moon list to match the
        // engine's final (orbital-distance-sorted) order — otherwise the editor's own list
        // silently drifts out of sync with the order shown in the accordion after Save.
        backfillFromGenerated(wc, newSys) {
            if (!newSys.worlds) return;
            wc.bodies.forEach(wcBody => {
                const genBody = newSys.worlds.find(w => w._id === wcBody._id);
                if (!genBody) return;
                if (genBody.hillSpanPd !== undefined) {
                    wcBody._raw = wcBody._raw || {};
                    wcBody._raw.hillSpanPd = genBody.hillSpanPd;
                }
                if (!genBody.moons || !wcBody.moons.length) return;
                wcBody.moons.forEach(wcMoon => {
                    const genMoon = genBody.moons.find(m => m._id === wcMoon._id);
                    if (!genMoon) return;
                    if (genMoon.pd           !== undefined) wcMoon.pd           = genMoon.pd;
                    if (genMoon.pos          !== undefined) wcMoon.pos          = genMoon.pos;
                    if (genMoon.eccentricity !== undefined) wcMoon.eccentricity = genMoon.eccentricity;
                    if (genMoon.retrograde   !== undefined) wcMoon.retrograde   = genMoon.retrograde;
                });
                wcBody.moons.sort((a, b) => (a.pd ?? Infinity) - (b.pd ?? Infinity));
            });
        },
    };
})();
