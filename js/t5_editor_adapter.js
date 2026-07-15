// =============================================================================
// T5_EDITOR_ADAPTER.JS — System Editor engine adapter for Traveller 5 (T5)
// Extracted verbatim from system_editor.js's _ENGINE_ADAPTERS.T5 (no logic
// changes) so T5-specific editor troubleshooting can no longer touch working
// CT/MgT2E code by accident, and vice versa. Registers itself on
// window.SystemEditorAdapters.T5; system_editor.js picks it up when it builds
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
// T5_Stellar_Engine, rng, and window.System_Driver are true globals (from
// t5_stellar_engine.js and core.js), not part of system_editor.js's closure,
// so they're referenced directly rather than through SE().
//
// 2026-07-12: gained restoreManualFields(), moved here (also verbatim) from
// system_editor.js's _restoreDisplayManualFields() — that was the one part of the 2026-07-11
// adapter-file split that hadn't actually moved yet (still a per-engine if/else-if chain in
// system_editor.js). See _ENGINE_ADAPTERS' comment block there. T5 has no backfillFromGenerated
// — _preview() never had a T5 branch before this split either, so there's nothing to move.
// =============================================================================

'use strict';

(function () {
    function SE() { return window.SystemEditorShared; }

    // Seeds physical/population digits from the body's previous generated values (_raw), same
    // role as _ctUwpLockFor. worldType/size are seeded but not marked manual — the generator's
    // own `!world.worldType`/`size === undefined` guards already skip rerolling them once
    // present. atm/hydro/pop must be marked manual: t5_topdown_generator.js's Inferno/Belt/
    // small-size branches force-overwrite those fields regardless of presence unless the
    // manual flag is checked first (mirrors CT's exact reasoning).
    function _t5UwpLockFor(body) {
        const raw = body._raw || {};
        if (!body.uwp || !body._raw) return { fields: {}, mf: [] };
        const fields = {};
        const mf = [];
        if (raw.worldType !== undefined) fields.worldType = raw.worldType;
        if (raw.size      !== undefined) fields.size      = raw.size;
        if (raw.atm   !== undefined) { fields.atm   = raw.atm;   mf.push('atm'); }
        if (raw.hydro !== undefined) { fields.hydro = raw.hydro; mf.push('hydro'); }
        if (raw.pop   !== undefined) { fields.pop   = raw.pop;   mf.push('pop'); }
        return { fields, mf };
    }

    // Algorithm 7 (directives/project_manifest.md): elects a mainworld when the user hasn't
    // designated one. Runs over WORKING-COPY bodies (not generated output) because T5's
    // generator needs its mainworld anchor *before* generation starts — unlike CT/MgT2E, which
    // elect a candidate from an already-generated body list. `wc` is the live _workingCopy
    // object; mutating it here is visible immediately (accordion ★, name-preservation lookup
    // in _generateAndCommit) with no extra wiring.
    function _t5ElectMainworldIfNeeded(wc) {
        if (wc.mainworldRef) return;
        const already = wc.bodies.find(b => b.isMainworld);
        if (already) { wc.mainworldRef = already._id; return; }

        const primaryWc = wc.stars[0];
        const hzOrbit = (typeof T5_Stellar_Engine !== 'undefined' && primaryWc)
            ? T5_Stellar_Engine.getStarHZ({ type: primaryWc.sType, size: primaryWc.sClass })
            : 3;

        // Step 1: eligible = all worlds (excluding top-level Gas Giants — CT/MgT2E's own
        // mainworld election likewise excludes only bare GGs, admits Belts directly; mirrors
        // the existing "★MW suppressed for type==='Gas Giant'" UI convention) + all moons
        // (inheriting the parent body's orbitId).
        const candidates = [];
        wc.bodies.forEach(b => {
            if (b.type !== 'Gas Giant' && b.orbitId != null) candidates.push({ ref: b, orbitId: b.orbitId });
            (b.moons || []).forEach(m => candidates.push({ ref: m, orbitId: b.orbitId }));
        });
        if (candidates.length === 0) return; // Step 6: proceed with no mainworld, no error

        // Steps 3-5: closest-to-HZ wins; ties broken with the existing global seeded rng
        // (core.js) — never Math.random().
        let bestDist = Infinity, winners = [];
        candidates.forEach(c => {
            const d = Math.abs(c.orbitId - hzOrbit);
            if (d < bestDist) { bestDist = d; winners = [c]; }
            else if (d === bestDist) winners.push(c);
        });
        const winner = winners.length === 1 ? winners[0] : winners[Math.floor(rng() * winners.length)];

        // Step 7 — deliberately NOT pushed to _manualFields: this is an automatic default, not
        // a user click (contrast the explicit _setMainworld() toggle), so
        // _restoreDisplayManualFields won't paint the auto-elected body as "user-edited."
        winner.ref.isMainworld = true;
        wc.mainworldRef = winner.ref._id;
    }

    // Per-body seed construction shared by T5's `write()` for both top-level worlds and the
    // owner-of-a-moon-mainworld case (Algorithm 7 / _t5ElectMainworldIfNeeded above).
    function _t5BodySeed(b, starIdxById) {
        const { fields: uwpLock, mf: extraMF } = _t5UwpLockFor(b);
        return {
            _id: b._id,
            type: b.type === 'Gas Giant' ? (b.ggType === 'GS' ? 'Small Gas Giant' : 'Large Gas Giant')
                : b.type === 'Belt' ? 'Planetoid Belt' : 'Terrestrial World',
            name: b.name || '', uwp: b.uwp || null,
            ...uwpLock,
            orbitId: b.orbitId, parentStarIdx: starIdxById[b.parentStarId] ?? 0,
            travelZone: SE().normTz(b.travelZone),
            moons: (b.moons || []).map(m => {
                const { fields: mLock, mf: mMF } = _t5UwpLockFor(m);
                return {
                    _id: m._id, name: m.name || '', uwp: m.uwp || null, ...mLock,
                    _manualFields: [...(m._manualFields || []), ...mMF],
                };
            }),
            _manualFields: [...(b._manualFields || []), ...extraMF],
        };
    }

    window.SystemEditorAdapters = window.SystemEditorAdapters || {};
    window.SystemEditorAdapters.T5 = {
        detect(stateObj) {
            if (stateObj.t5System && stateObj.t5System.stars && stateObj.t5System.stars.length > 0) {
                return { raw: stateObj.t5System, engine: 'T5' };
            }
            return null;
        },

        readBodies(raw, starIdByIdx) {
            const bodies = [];
            const mwRef = raw.mainworld;
            const flatWorlds = (raw.worlds && raw.worlds.length > 0)
                ? raw.worlds
                : (raw.stars || []).flatMap((s, si) =>
                    (s.orbits || [])
                        // Empty orbit slots have contents: null — must be dropped BEFORE the
                        // Object.assign below, since Object.assign({}, null, {...}) silently
                        // produces a typeless object that the old `w.type !== 'Empty'` filter
                        // let straight through (undefined !== 'Empty' is true), turning every
                        // empty orbit into a phantom body on re-edit.
                        .filter(slot => slot.contents)
                        // orbitId falls back to the slot's own index (slot.orbit) — T5 bodies
                        // don't carry their own orbitId, position is implied by array index.
                        .map(slot => Object.assign({}, slot.contents, {
                            parentStarIdx: si, distAU: slot.distAU,
                            orbitId: slot.contents.orbitId != null ? slot.contents.orbitId : slot.orbit,
                        }))
                        .filter(w => w.type !== 'Empty')
                  );
            flatWorlds.forEach(w => {
                const isMainworld = SE().isMW(w, mwRef) || w.type === 'Mainworld';
                const rawType     = isMainworld ? 'World' : (w.type || '');
                const canon       = isMainworld ? 'World' : SE().canonType(rawType);
                bodies.push({
                    _id: SE().uid('body'), type: canon,
                    ggType:        canon === 'Gas Giant' ? SE().ggTypeFrom(rawType) : null,
                    name: w.name || '', uwp: w.uwp || null,
                    au: w.au ?? w.distAU ?? (w.orbitId != null ? SE().orbitIdToAU(w.orbitId) : null), orbitId: w.orbitId ?? null,
                    travelZone:    w.travelZone || 'G',
                    parentStarId:  starIdByIdx(w.parentStarIdx ?? 0), isMainworld,
                    // A moon flagged as this system's mainworld doesn't reliably carry its own
                    // isMainworld:true from the generator (t5_topdown_generator.js never sets
                    // it explicitly on sys.mainworld) — detect it the same way top-level bodies
                    // are detected (_isMW / type==='Mainworld') before handing off to _buildMoon.
                    moons: (w.moons || w.satellites || []).map(m => SE().buildMoon(
                        Object.assign({}, m, { isMainworld: !!(m.isMainworld || m.type === 'Mainworld' || SE().isMW(m, mwRef)) })
                    )),
                    _manualFields: w._manualFields ? [...w._manualFields] : [],
                    _raw: w,
                });
            });
            return bodies;
        },

        write(wc, starIdxById) {
            _t5ElectMainworldIfNeeded(wc);   // Algorithm 7 — no-op if already designated

            const mwRefBody   = wc.mainworldRef ? wc.bodies.find(b => b._id === wc.mainworldRef) : null;
            const ownerOfMoon = mwRefBody ? null : wc.bodies.find(b => (b.moons || []).some(m => m._id === wc.mainworldRef));
            const mwMoon      = ownerOfMoon ? ownerOfMoon.moons.find(m => m._id === wc.mainworldRef) : null;
            const mwBody      = mwRefBody || mwMoon || wc.bodies.find(b => b.isMainworld);
            const isMoonMW    = !!mwMoon;

            const { fields: mwLock } = _t5UwpLockFor(mwBody || {});
            const mainworldUWP = mwBody ? {
                _id: mwBody._id,
                uwp: mwBody.uwp || 'A788899-9', name: mwBody.name || '',
                travelZone: SE().normTz(mwBody.travelZone),
                isPreMoon: isMoonMW,
                orbitId: isMoonMW ? ownerOfMoon.orbitId : mwBody.orbitId,
                parentBodyId:  isMoonMW ? ownerOfMoon._id : null,
                parentStarIdx: isMoonMW ? (starIdxById[ownerOfMoon.parentStarId] ?? 0) : null,
                ...mwLock,
            } : null;

            // Exclude the top-level mainworld body from seed.worlds (it's threaded separately
            // as the anchor); its owner (if MW is a moon) stays IN seed.worlds so the generator
            // places it normally and Phase 1's parentBodyId lookup finds it there.
            const worlds = wc.bodies
                .filter(b => !(mwBody && !isMoonMW && b._id === mwBody._id))
                .map(b => _t5BodySeed(b, starIdxById));

            return { mainworldUWP, worlds };
        },

        run(hexId, seedSys, stateObj) {
            let newSys = null;
            if (typeof window !== 'undefined' && window.System_Driver && seedSys.mainworldUWP) {
                newSys = window.System_Driver.generateSystem({
                    edition: 'T5', mode: 'top-down',
                    mainworldUWP: seedSys.mainworldUWP, hexId, seedSys,
                });
            }
            if (newSys) {
                SE().clearSystemData(stateObj);
                stateObj.t5System = newSys;
                stateObj.t5Data   = newSys.mainworld || null;
            }
            return newSys;
        },

        // Restores true (user-edited-only) _manualFields on the generated output, same
        // reasoning/role as MgT2E's own restoreManualFields (see that file) adapted to T5's
        // shape: generated bodies live under newSys.stars[].orbits[].contents, and moons are
        // keyed 'satellites' (not 'moons'). Necessary because _t5UwpLockFor marks atm/hydro/pop
        // manual purely to stop the generator re-rolling them, which would otherwise make every
        // pre-existing T5 body's fields show as "manually edited" in the accordion after every
        // Fill & Save.
        restoreManualFields(wc, newSys) {
            const genBodies = [];
            (newSys.stars || []).forEach(star => (star.orbits || []).forEach(o => { if (o.contents) genBodies.push(o.contents); }));
            wc.bodies.forEach(wcBody => {
                const genBody = genBodies.find(b => b._id === wcBody._id)
                    || genBodies.reduce((f, b) => f || (b.satellites || []).find(s => s._id === wcBody._id), null);
                if (!genBody) return;
                genBody._manualFields = wcBody._manualFields ? [...wcBody._manualFields] : [];
                (wcBody.moons || []).forEach(wcMoon => {
                    const genMoon = (genBody.satellites || []).find(m => m._id === wcMoon._id);
                    if (genMoon) genMoon._manualFields = wcMoon._manualFields ? [...wcMoon._manualFields] : [];
                });
            });
        },
    };
})();
