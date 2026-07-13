// =============================================================================
// CT_EDITOR_ADAPTER.JS — System Editor engine adapter for Classic Traveller (CT)
// Extracted verbatim from system_editor.js's _ENGINE_ADAPTERS.CT (no logic
// changes) so CT-specific editor troubleshooting can no longer touch working
// MgT2E code by accident, and vice versa. Registers itself on
// window.SystemEditorAdapters.CT; system_editor.js picks it up when it builds
// _ENGINE_ADAPTERS. Must load BEFORE system_editor.js (see hex_map.html).
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
// getZoneForOrbit (ct_bottomup_generator.js) and window.CT_Generator are true
// globals, not part of system_editor.js's closure, so they're referenced
// directly rather than through SE().
//
// 2026-07-12: gained restoreManualFields()/backfillFromGenerated(), moved here (also verbatim)
// from system_editor.js's _restoreDisplayManualFields()/_preview() — those were the one part of
// the 2026-07-11 adapter-file split that hadn't actually moved yet (still per-engine
// if/else-if chains in system_editor.js). See _ENGINE_ADAPTERS' comment block there.
// =============================================================================

'use strict';

(function () {
    function SE() { return window.SystemEditorShared; }

    // Seeds physical/population digits from the body's previous generated values (_raw)
    // so Fill & Save doesn't silently reroll size/atm/hydro/pop on a body the user never
    // touched. Mirrors _mgt2eUwpLockFor's role for MgT2E. 'size' is seeded but not marked
    // manual — generatePhysicals already skips rerolling it whenever it's !== undefined,
    // same reasoning as MgT2E's own size field.
    function _ctUwpLockFor(body) {
        const raw = body._raw || {};
        const fields = {};
        const mf = [];

        // Gas Giants never get a `.uwp` (they carry mass/gravity/diamKm instead of
        // atm/hydro/pop/etc), so the uwp-gated preservation below never fires for them. Those
        // physical fields, plus the satellite-lock flag, are only ever set once — during the
        // initial skeleton-placement roll (ct_bottomup_generator.js) and the first satellite
        // pass — and that placement step is skipped entirely once a system is seeded from the
        // editor. Without this, a re-edited Gas Giant silently loses mass/gravity (moon orbital
        // period then falls back to Earth's mass) and gets diamKm re-rolled at random AND its
        // moon family re-rolled from scratch on every Preview/Fill & Save, even with no edits.
        if (body.type === 'Gas Giant' && body._raw) {
            ['mass', 'gravity', 'diamKm', '_satellitesGenerated'].forEach(f => {
                if (raw[f] !== undefined) fields[f] = raw[f];
            });
        }

        // Gated on _raw having actual rolled data, NOT on body.uwp — body.uwp only becomes
        // truthy after Fill & Save + reopen (readBodies), so gating on it left every field
        // below unlocked for a body's entire first editing session no matter how many Previews
        // ran, letting atm/hydro/pop/gov/law/starport/tl reroll on every single edit to ANY
        // body in the system (each reroll shifts the shared seeded RNG's call sequence for
        // every other not-yet-locked body too — see mainworld-designation comment below).
        // backfillFromGenerated (below) now writes each body's rolled values into _raw right
        // after its first Preview, specifically so this gate can engage immediately instead of
        // waiting for a save/reopen round-trip. body._raw is always at least `{}` (set by
        // _addBody), so checking it alone would never gate anything — the per-field
        // `raw.x !== undefined` checks below are what actually decide locking.
        if (!body._raw) return { fields, mf };
        if (raw.size     !== undefined) fields.size     = raw.size;
        if (raw.atm      !== undefined) { fields.atm      = raw.atm;      mf.push('atm'); }
        if (raw.hydro    !== undefined) { fields.hydro    = raw.hydro;    mf.push('hydro'); }
        if (raw.pop      !== undefined) { fields.pop      = raw.pop;      mf.push('pop'); }
        // gov/law/starport/tl were previously left unlocked, so finalizeSubordinateSocial
        // (ct_world_engine.js) re-rolled every subordinate world's government, law level,
        // starport, and tech level from scratch on every Preview/Fill & Save — matches the
        // lock treatment _mgt2eUwpLockFor already gives these same fields for MgT2E.
        if (raw.gov      !== undefined) { fields.gov      = raw.gov;      mf.push('gov'); }
        if (raw.law      !== undefined) { fields.law      = raw.law;      mf.push('law'); }
        if (raw.starport !== undefined) { fields.starport = raw.starport; mf.push('starport'); }
        if (raw.tl       !== undefined) { fields.tl       = raw.tl;       mf.push('tl'); }
        return { fields, mf };
    }

    // Seeds a CT satellite's physical/orbital fields from its previous generated values (m._raw)
    // — pd, size, diamKm, mass, etc. Unlike _ctUwpLockFor (gated on body.uwp, since only
    // already-generated top-level bodies need their atm/hydro/pop protected from reroll), this
    // is NOT gated on the moon having its own uwp: whether a satellite reroll happens at all is
    // decided per-PARENT (processBottomUpSatellites' `if (parent.uwp)` skip), not per-moon, so
    // every moon being carried forward — Ring or populated world alike — needs its physical
    // fields preserved regardless. Without this, any parent whose satellite roll is skipped
    // (i.e. every terrestrial/mainworld parent after its first generation) had its moons
    // silently stripped down to {_id, type, name, uwp} on every Preview/Fill & Save: pd went
    // missing, so the orrery's _moonPeriodYears (system_viewer.js) fell back to a default pd of
    // 20, and getThermalStats/rotation stats lost their inputs too.
    function _ctMoonLockFor(m) {
        const raw = m._raw || {};
        const fields = {};
        const mf = [];
        ['pd', 'size', 'distAU', 'zone', 'orbitType', 'parentType', 'orbit',
         'diamKm', 'mass', 'gravity', 'temperature', 'rotationPeriod', 'axialTilt'].forEach(f => {
            if (raw[f] !== undefined) fields[f] = raw[f];
        });
        if (m.uwp && m._raw) {
            ['atm', 'hydro', 'pop', 'gov', 'law', 'starport', 'tl'].forEach(f => {
                if (raw[f] !== undefined) { fields[f] = raw[f]; mf.push(f); }
            });
        }
        return { fields, mf };
    }

    // applyUwpSeed (system_editor.js) marks manual fields using MgT2E's own naming —
    // 'atmCode'/'hydroCode' — since that's the convention _mgt2eUwpLockFor and MgT2E's world
    // engine check. CT's world engine (_ctFieldIsManual, ct_world_engine.js) checks 'atm'/
    // 'hydro' instead — the same names _ctUwpLockFor already uses above. Without this rename, a
    // freshly seeded body's atm/hydro *value* would be set correctly but the CT generator
    // wouldn't recognize it as locked and would re-roll over it anyway, defeating the seed.
    function _renameUwpSeedManualFields(seedBody) {
        if (!seedBody || !Array.isArray(seedBody._manualFields)) return seedBody;
        seedBody._manualFields = seedBody._manualFields.map(f =>
            f === 'atmCode' ? 'atm' : f === 'hydroCode' ? 'hydro' : f);
        return seedBody;
    }

    // Shared by restoreManualFields()/backfillFromGenerated() below: CT's generated bodies live
    // under newSys.orbits[].contents plus newSys.capturedPlanets[] (not a flat list like MgT2E's
    // newSys.worlds), so both need the same flattening pass first.
    function _ctFlattenBodies(newSys) {
        const genBodies = [];
        (newSys.orbits || []).forEach(slot => { if (slot.contents) genBodies.push(slot.contents); });
        (newSys.capturedPlanets || []).forEach(p => genBodies.push(p));
        return genBodies;
    }

    window.SystemEditorAdapters = window.SystemEditorAdapters || {};
    window.SystemEditorAdapters.CT = {
        detect(stateObj) {
            if (stateObj.ctSystem && stateObj.ctSystem.stars && stateObj.ctSystem.stars.length > 0) {
                return { raw: stateObj.ctSystem, engine: 'CT' };
            }
            return null;
        },

        readBodies(raw, starIdByIdx) {
            const bodies = [];
            const mwRef = raw.mainworld;

            // Shared parser for a CT-shaped { orbits[], capturedPlanets[] } body list — used
            // for both the primary's own top-level lists and a Far companion's own
            // nestedSystem (OW-19). `parentId` is the owning star's working-copy _id.
            const readOrbitSlots = (orbits, parentId) => {
                (orbits || []).forEach(slot => {
                    const w = slot.contents;
                    if (!w || w.type === 'Empty') return;
                    const isMainworld = SE().isMW(w, mwRef) || w.type === 'Mainworld';
                    const canon       = isMainworld ? 'World' : SE().canonType(w.type);
                    bodies.push({
                        _id: SE().uid('body'), type: canon,
                        // CT's own Gas Giant body carries the full word 'Small'/'Large' in
                        // .size (ct_world_engine.js's skeleton placement: `size: gg.size`,
                        // gg.size itself set to exactly 'Large'/'Small') — not the single
                        // letter 'S'. Comparing against 'S' here never matched, so an existing
                        // Small Gas Giant was always misread as Large on open, and re-saving
                        // without ever touching it would silently flip it to Large via write()'s
                        // `ggSize = b.ggType === 'GS' ? 'Small' : 'Large'` (OW-23).
                        ggType:        canon === 'Gas Giant' ? (w.size === 'Small' ? 'GS' : 'GL') : null,
                        name: w.name || '', uwp: w.uwp || null,
                        au: slot.distAU ?? null, orbitId: slot.orbit ?? null,
                        travelZone:    w.travelZone || w.zone || 'G',
                        parentStarId:  parentId, isMainworld,
                        // A lunar mainworld's moon carries `type: 'Mainworld'` (stamped by
                        // processBottomUpDesignation) but never its own `isMainworld` boolean —
                        // that flag is only ever set here, from mwRef/type, mirroring the
                        // top-level `isMainworld` check above (and T5's equivalent fix). Without
                        // this, no body shows the ★ highlight, wc.mainworldRef never resolves,
                        // and the next Preview/Save re-elects an entirely new mainworld.
                        moons:         (w.moons || w.satellites || []).map(m => SE().buildMoon(
                            Object.assign({}, m, { isMainworld: !!(m.isMainworld || m.type === 'Mainworld' || SE().isMW(m, mwRef)) })
                        )),
                        _manualFields: w._manualFields ? [...w._manualFields] : [],
                        _raw: w,
                    });
                });
            };
            const readCaptured = (capturedPlanets, parentId) => {
                (capturedPlanets || []).forEach(w => {
                    if (!w || w.type === 'Empty') return;
                    const isMainworld = SE().isMW(w, mwRef) || w.type === 'Mainworld';
                    bodies.push({
                        _id: SE().uid('body'), type: isMainworld ? 'World' : SE().canonType(w.type),
                        ggType: null, name: w.name || '', uwp: w.uwp || null,
                        au: w.distAU ?? null, orbitId: null, travelZone: 'G',
                        parentStarId: parentId, isMainworld,
                        // A Captured Planet can have its own satellite family, same as any
                        // orbit-slot body (processBottomUpSatellites treats capturedPlanets as
                        // valid parents — ct_bottomup_generator.js). This was previously
                        // hardcoded to `[]`, silently hiding real moons from the editor tree —
                        // and far worse, write()'s buildCaptured() re-serializes `satellites`
                        // straight from this same array, so Preview/Fill & Save on any CT system
                        // with a moon-bearing captured planet permanently deleted those moons.
                        moons: (w.moons || w.satellites || []).map(m => SE().buildMoon(
                            Object.assign({}, m, { isMainworld: !!(m.isMainworld || m.type === 'Mainworld' || SE().isMW(m, mwRef)) })
                        )),
                        _manualFields: w._manualFields ? [...w._manualFields] : [],
                        _raw: w,
                    });
                });
            };

            readOrbitSlots(raw.orbits, starIdByIdx(0));
            readCaptured(raw.capturedPlanets, starIdByIdx(0));

            // Far companions carry their own independent orbit sequence in nestedSystem (set
            // by ct_bottomup_generator.js's generateSystemOrbits — "Handle Far Companions as
            // nested systems" — or, for a System-Editor-authored companion, by write() below).
            // Read those bodies too, parented to the companion star itself, so they round-trip
            // back into the editor instead of silently vanishing on next open (OW-19).
            (raw.stars || []).forEach((s, i) => {
                if (i === 0 || !s.nestedSystem) return;
                readOrbitSlots(s.nestedSystem.orbits, starIdByIdx(i));
                readCaptured(s.nestedSystem.capturedPlanets, starIdByIdx(i));
            });

            return bodies;
        },

        // Captured planets are orbitless (orbitId === null) — the only way a CT body
        // ends up with a null orbitId, since _addBody always assigns a real one.
        //
        // Bodies are split by which star they orbit: primary-parented bodies feed the
        // existing top-level orbits/capturedPlanets seed; bodies parented to a Far companion
        // (the only CT companion role that can have bodies of its own — see the CT/Far gate
        // in _buildCompanionBlock) are built into that companion's own nestedSystem, mirroring
        // ct_bottomup_generator.js's own convention for a Far companion's independent
        // planetary system (generateSystemOrbits, "Handle Far Companions as nested systems").
        // `engStars` — the seed star objects _buildSeedSys already built — is where that
        // nestedSystem gets attached; write() otherwise only returns *additional* top-level
        // seed fields, with no other channel to reach an individual star's own seed object.
        write(wc, starIdxById, engStars) {
            const primaryId = (wc.stars[0] || {})._id;

            // Shared body → CT orbit-slot builder, used for both the primary's own list and
            // any Far companion's nested list. `zoneStar` is the engStars-shaped seed object
            // whose size/specKey the Book 6 zone table classification runs against — was
            // previously hardcoded to 'H' for every body regardless of star or orbit.
            const buildOrbits = (bodies, zoneStar) => bodies.filter(b => b.orbitId != null).map(b => {
                const ctType = b.type === 'Gas Giant'  ? 'Gas Giant'
                    : b.type === 'Belt'                ? 'Planetoid Belt'
                    : 'Terrestrial Planet';
                const { fields: uwpLock, mf: extraMF } = _ctUwpLockFor(b);
                const ggSize = b.type === 'Gas Giant' ? (b.ggType === 'GS' ? 'Small' : 'Large') : undefined;
                const specKey = zoneStar && (zoneStar.specKey || `${zoneStar.sType || 'G'}${zoneStar.subType != null ? zoneStar.subType : 5}`);
                const zone = (zoneStar && typeof getZoneForOrbit === 'function')
                    ? getZoneForOrbit(zoneStar.sClass || 'V', specKey, Math.floor(b.orbitId))
                    : 'H';
                return {
                    orbit:   b.orbitId != null ? b.orbitId : 1,
                    zone,
                    // Recompute from the CURRENT orbitId first, falling back to the working
                    // copy's cached `au` only if that fails — `au` is set once when the body is
                    // first read into the editor (readBodies' `au: slot.distAU ?? null`) and
                    // never refreshed when the user later edits Orbit # (the orbit-input change
                    // handler in system_editor.js only updates orbitId, not au). Preferring the
                    // stale cache here fed a wrong, pre-edit distance into the seed — which
                    // system_viewer.js's orrery then rendered (OW-25), even though orbitId/zone
                    // and every other consumer (accordion, System Editor's own live "→ AU"
                    // display) already read the correct, current position. Matches the same
                    // orbitId-first priority _sortAU (system_editor.js) already uses correctly.
                    distAU:  SE().orbitIdToAU(b.orbitId) ?? b.au ?? null,
                    // applyUwpSeed (system_editor.js) pushes the accordion's "Seed UWP digits"
                    // boxes (b._uwpSeed) onto starport/size/atm(Code)/hydro(Code)/pop/gov/law/tl
                    // and records them in _manualFields — previously only wired up for MgT2E's
                    // adapter, so a brand-new CT body's typed UWP digits were silently discarded
                    // and the CT generator rolled a completely unrelated UWP from scratch.
                    // _ctUwpLockFor (uwpLock, above) only preserves a UWP the body *already has*
                    // from a prior generation, so it can't cover this first-generation case —
                    // applyUwpSeed fills that gap the same way it does for MgT2E.
                    contents: _renameUwpSeedManualFields(SE().applyUwpSeed({
                        _id:          b._id,
                        type:         ctType,
                        ...uwpLock,
                        size:         ggSize !== undefined ? ggSize : uwpLock.size,
                        name:         b.name || '',
                        uwp:          b.uwp  || null,
                        travelZone:   SE().normTz(b.travelZone),
                        satellites:   (b.moons || []).map(m => {
                            const { fields: moonLock, mf: moonMF } = _ctMoonLockFor(m);
                            return _renameUwpSeedManualFields(SE().applyUwpSeed({
                                _id:          m._id,
                                // Derive from the live isMainworld flag, not the frozen `m.type`
                                // _buildMoon stamped at read time — demoting a mainworld moon
                                // (_setMainworld/_clearMainworld) only flips isMainworld, so a
                                // stale 'Mainworld' string here would survive into the next Save
                                // alongside the newly-designated mainworld, producing the CT
                                // auditor's "found 2, expected 1" duplicate-mainworld error.
                                type:         m.isMainworld ? 'Mainworld'
                                            : m.type === 'Mainworld' ? 'Satellite'
                                            : (m.type || 'Satellite'),
                                ...moonLock,
                                name:         m.name || '',
                                uwp:          m.uwp  || null,
                                isMoon:       true,
                                isSatellite:  true,
                                _manualFields: Array.from(new Set([...(m._manualFields || []), ...moonMF])),
                            }, m._uwpSeed));
                        }),
                        _manualFields: Array.from(new Set([...(b._manualFields || []), ...extraMF])),
                    }, b._uwpSeed)),
                };
            });

            // Captured planets carry their own fractional `orbit`/`zone` rather than an
            // integer orbit slot — there's no UI to move one (drag-and-drop and the typed
            // orbit# field both operate on orbitId), so both are simply carried forward
            // from _raw unchanged. `_id` is required: CT_Generator's mainworld-by-_id
            // lookup searches seedSys.capturedPlanets when _mainworldRef points at one.
            const buildCaptured = bodies => bodies.filter(b => b.orbitId == null).map(b => {
                const { fields: uwpLock, mf: extraMF } = _ctUwpLockFor(b);
                return {
                    _id:    b._id,
                    type:   'Captured',
                    orbit:  (b._raw && b._raw.orbit != null) ? b._raw.orbit : 0,
                    zone:   (b._raw && b._raw.zone) || 'H',
                    ...uwpLock,
                    name:   b.name || '',
                    uwp:    b.uwp || null,
                    satellites: (b.moons || []).map(m => {
                        const { fields: moonLock, mf: moonMF } = _ctMoonLockFor(m);
                        return {
                            _id:          m._id,
                            // See the orbits-branch satellites mapping above: derive from the
                            // live isMainworld flag rather than the frozen `m.type`.
                            type:         m.isMainworld ? 'Mainworld'
                                        : m.type === 'Mainworld' ? 'Satellite'
                                        : (m.type || 'Satellite'),
                            ...moonLock,
                            name:         m.name || '',
                            uwp:          m.uwp  || null,
                            isMoon:       true,
                            isSatellite:  true,
                            _manualFields: Array.from(new Set([...(m._manualFields || []), ...moonMF])),
                        };
                    }),
                    _manualFields: Array.from(new Set([...(b._manualFields || []), ...extraMF])),
                };
            });

            const primaryBodies  = wc.bodies.filter(b => b.parentStarId === primaryId);
            const orbits          = buildOrbits(primaryBodies, engStars && engStars[0]);
            const capturedPlanets = buildCaptured(primaryBodies);

            // Far companions: any star with bodies parented to it gets its own nestedSystem,
            // attached directly to its seed star object in engStars (mutated in place —
            // write() has no other channel to reach an individual star's seed entry).
            wc.stars.forEach((compStar, idx) => {
                if (idx === 0 || !engStars) return;
                const compBodies = wc.bodies.filter(b => b.parentStarId === compStar._id);
                if (compBodies.length === 0) return;
                const seedStar = engStars[idx];
                if (!seedStar) return;
                // Self-reference broken via a shallow copy (mirrors
                // ct_bottomup_generator.js's own "Break circularity for JSON stringification
                // and recursive walking" pattern) — a live circular star<->nestedSystem<->star
                // reference would break hexStates' JSON round-trip.
                const compStarCopy = Object.assign({}, seedStar);
                delete compStarCopy.nestedSystem;
                seedStar.nestedSystem = {
                    stars:          [compStarCopy],
                    orbits:         buildOrbits(compBodies, seedStar),
                    capturedPlanets: buildCaptured(compBodies),
                };
            });

            return { orbits, capturedPlanets };
        },

        run(hexId, seedSys, stateObj) {
            let newSys = null;
            if (typeof window !== 'undefined' && window.CT_Generator) {
                newSys = window.CT_Generator.generateSystem({ mode: 'bottom-up', hexId, seedSys });
            }
            if (newSys) {
                SE().clearSystemData(stateObj);
                stateObj.ctSystem = newSys;
                stateObj.ctData   = newSys.mainworld || null;
            }
            return newSys;
        },

        // Restores true (user-edited-only) _manualFields on the generated output, same
        // reasoning/role as MgT2E's own restoreManualFields (see that file) adapted to CT's
        // shape: moons are keyed 'satellites' (not 'moons'). Necessary because _ctUwpLockFor
        // marks atm/hydro/pop manual purely to stop the generator re-rolling them, which would
        // otherwise make every pre-existing CT body's fields show as "manually edited" in the
        // accordion after every Fill & Save, even on bodies the user never touched.
        restoreManualFields(wc, newSys) {
            const genBodies = _ctFlattenBodies(newSys);
            wc.bodies.forEach(wcBody => {
                const genBody = genBodies.find(b => b._id === wcBody._id);
                if (!genBody) return;
                genBody._manualFields = wcBody._manualFields ? [...wcBody._manualFields] : [];
                (wcBody.moons || []).forEach(wcMoon => {
                    const genMoon = (genBody.satellites || []).find(m => m._id === wcMoon._id);
                    if (genMoon) genMoon._manualFields = wcMoon._manualFields ? [...wcMoon._manualFields] : [];
                });
            });
        },

        // Backfills moon pd (orbital distance, in planetary diameters) and re-sorts each body's
        // moon list to match the generator's final order. Without this,
        // ct_bottomup_generator.js's own satellites.sort(pd) (which applyCTOrbitalNames,
        // core.js, relies on for closest-first alphabetical naming) re-orders the *generated*
        // system on every Preview, but the editor's already-open working copy keeps its old
        // order — so the tree you're looking at silently stops matching what Fill & Save will
        // actually name/display in the accordion.
        //
        // Also freezes the auto-designated mainworld and backfills each body's rolled stats
        // into _raw (see below) — both fix the same underlying bug: adding several blank
        // bodies and filling in their details out of order could make the ★ mainworld badge,
        // and rolled fields on bodies you hadn't touched yet, appear to jump between worlds
        // between Previews.
        backfillFromGenerated(wc, newSys) {
            // Freeze the auto-designated mainworld the first time one is chosen. Step 7's
            // population-based scoring (designateMainworld, ct_bottomup_generator.js) reruns
            // from scratch on every Preview with no memory of the previous winner — with
            // several simultaneously-unlocked bodies in play (their pop still rerolling every
            // Preview, per the backfill below not having run for them yet), the "best" candidate
            // could flip to a different body on every edit. Pinning it into wc.mainworldRef
            // makes the next Preview take CT's existing "Fixed Anchor" path (ct_system_driver.js)
            // instead of re-electing. Only runs while the user hasn't chosen one manually —
            // _setMainworld/_clearMainworld remain the only way to move it after that.
            if (!wc.mainworldRef && newSys.mainworld && newSys.mainworld._id) {
                const mwId = newSys.mainworld._id;
                const mwBody = wc.bodies.find(b => b._id === mwId);
                if (mwBody) {
                    mwBody.isMainworld = true;
                    wc.mainworldRef = mwId;
                } else {
                    for (const b of wc.bodies) {
                        const mwMoon = (b.moons || []).find(m => m._id === mwId);
                        if (mwMoon) { mwMoon.isMainworld = true; wc.mainworldRef = mwId; break; }
                    }
                }
            }

            const genBodies = _ctFlattenBodies(newSys);
            wc.bodies.forEach(wcBody => {
                const genBody = genBodies.find(b => b._id === wcBody._id);
                if (!genBody) return;

                // Backfill rolled physical/social stats into _raw so _ctUwpLockFor (above) can
                // lock them starting with the very next Preview — without this, a body with no
                // manually-typed UWP seed digits kept re-rolling atm/hydro/pop/gov/law/starport/
                // tl (or, for a Gas Giant, mass/gravity/diamKm) on every single Preview for its
                // entire first editing session, since nothing wrote the previous roll's values
                // back onto the working copy until Fill & Save + reopen.
                wcBody._raw = wcBody._raw || {};
                const lockFields = wcBody.type === 'Gas Giant'
                    ? ['mass', 'gravity', 'diamKm', '_satellitesGenerated']
                    : ['size', 'atm', 'hydro', 'pop', 'gov', 'law', 'starport', 'tl'];
                lockFields.forEach(f => { if (genBody[f] !== undefined) wcBody._raw[f] = genBody[f]; });

                if (!genBody.satellites || !wcBody.moons.length) return;
                wcBody.moons.forEach(wcMoon => {
                    const genMoon = genBody.satellites.find(m => m._id === wcMoon._id);
                    if (!genMoon) return;
                    if (genMoon.pd !== undefined) wcMoon.pd = genMoon.pd;
                });
                wcBody.moons.sort((a, b) => (a.pd ?? Infinity) - (b.pd ?? Infinity));
            });
        },
    };
})();
