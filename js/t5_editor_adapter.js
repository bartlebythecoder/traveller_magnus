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
// system_editor.js). See _ENGINE_ADAPTERS' comment block there. T5 had no backfillFromGenerated
// at all until later (see that method below) — _preview() never had a T5 branch before this
// split either, so there was nothing to move at the time.
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
    // gov/law/starport/tl were previously left unlocked here (T5 overhaul punch-list item 2 /
    // OW-10 Gap 2) even though generateT5SubordinateUWP (t5_topdown_generator.js) already gates
    // all four behind `!_isManual(world, ...)` — the engine-side guard was ready and waiting,
    // only this lock-for function never marked them manual, so every subordinate body's
    // government, law level, starport, and tech level re-rolled from scratch on every single
    // Preview/Fill & Save regardless of what the user touched. Matches _ctUwpLockFor's exact
    // treatment of these same four fields.
    function _t5UwpLockFor(body) {
        const raw = body._raw || {};
        // Gated on _raw presence alone, not body.uwp — a mainworld whose _raw carries real prior
        // digits (atm, hydro, pop, ...) can still have a momentarily falsy .uwp (see the freshRoll
        // fix below), and gating on .uwp here would throw all of that away. A genuinely blank body
        // (_addBody's `_raw: {}`) still locks nothing: every raw.X check below is undefined either
        // way, so fields/mf come back empty regardless of which guard is used.
        if (!body._raw) return { fields: {}, mf: [] };
        const fields = {};
        const mf = [];
        if (raw.worldType !== undefined) fields.worldType = raw.worldType;
        if (raw.size      !== undefined) fields.size      = raw.size;
        if (raw.atm   !== undefined) { fields.atm   = raw.atm;   mf.push('atm'); }
        if (raw.hydro !== undefined) { fields.hydro = raw.hydro; mf.push('hydro'); }
        if (raw.pop   !== undefined) { fields.pop   = raw.pop;   mf.push('pop'); }
        if (raw.gov      !== undefined) { fields.gov      = raw.gov;      mf.push('gov'); }
        if (raw.law      !== undefined) { fields.law      = raw.law;      mf.push('law'); }
        if (raw.starport !== undefined) { fields.starport = raw.starport; mf.push('starport'); }
        if (raw.tl       !== undefined) { fields.tl       = raw.tl;       mf.push('tl'); }
        return { fields, mf };
    }

    // Mainworld-only trade-codes lock — a deliberate sibling to _t5UwpLockFor, not folded into it
    // (see write()'s call site for why: _t5UwpLockFor's manual-fields list also feeds
    // _t5BodySeed's subordinate/moon seeds, which never forward tradeCodes to the generator).
    // _raw here is either an imported flat t5Data object or a previously generated mainworld's own
    // _raw — either way, once a mainworld has passed through this editor, its trade codes are
    // locked unless the user changes them, matching how every other UWP digit is already treated.
    function _t5MainworldTradeCodesLock(mwBody) {
        const raw = mwBody && mwBody._raw;
        if (!raw || raw.tradeCodes === undefined) return null;
        return raw.tradeCodes;
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
    //
    // Typed "Seed UWP digits" on a not-yet-generated subordinate body/moon (b._uwpSeed /
    // m._uwpSeed — system_editor.js only shows these boxes while !body.uwp) used to never be
    // read here at all: the mainworld's write() branches (above) apply theirs via applyUwpSeed,
    // but this function only ever spread the locked (_raw-sourced) fields, so a freshly typed
    // digit on a brand-new subordinate world/moon was silently discarded on Fill & Save — same
    // family of bug as the mainworld one, just never wired up here in the first place. Overlay
    // applies only to keys actually present in _uwpSeed; applyUwpSeed no-ops (returns the locked
    // fields unchanged) when _uwpSeed is null/undefined, which is every already-generated body
    // that never had digits typed — no behavior change for those.
    function _t5BodySeed(b, starIdxById) {
        const { fields: uwpLock, mf: extraMF } = _t5UwpLockFor(b);
        const seeded = SE().applyUwpSeed({ ...uwpLock, _manualFields: [...extraMF] }, b._uwpSeed);
        return {
            _id: b._id,
            type: b.type === 'Gas Giant' ? (b.ggType === 'GS' ? 'Small Gas Giant' : 'Large Gas Giant')
                : b.type === 'Belt' ? 'Planetoid Belt' : 'Terrestrial World',
            name: b.name || '', uwp: b.uwp || null,
            worldType: seeded.worldType, size: seeded.size, atm: seeded.atm, hydro: seeded.hydro,
            pop: seeded.pop, gov: seeded.gov, law: seeded.law, starport: seeded.starport, tl: seeded.tl,
            orbitId: b.orbitId, parentStarIdx: starIdxById[b.parentStarId] ?? 0,
            travelZone: SE().normTz(b.travelZone),
            moons: (b.moons || []).map(m => {
                const { fields: mLock, mf: mMF } = _t5UwpLockFor(m);
                const mSeeded = SE().applyUwpSeed({ ...mLock, _manualFields: [...mMF] }, m._uwpSeed);
                return {
                    _id: m._id, name: m.name || '', uwp: m.uwp || null,
                    worldType: mSeeded.worldType, size: mSeeded.size, atm: mSeeded.atm, hydro: mSeeded.hydro,
                    pop: mSeeded.pop, gov: mSeeded.gov, law: mSeeded.law, starport: mSeeded.starport, tl: mSeeded.tl,
                    _manualFields: [...(m._manualFields || []), ...mSeeded._manualFields],
                };
            }),
            _manualFields: [...(b._manualFields || []), ...seeded._manualFields],
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
                    // baseOrbit (OTU importer, traveller_worlds_importer.js) is the real integer
                    // orbit slot a body occupies — orbitId there is a *different*, often
                    // fractional value (`baseOrbit + increment/10`) used only to disambiguate
                    // display order when multiple objects share a base slot. Every consumer of
                    // this working-copy orbitId (_nextOrbitId's max+1 arithmetic, and
                    // t5_topdown_generator.js's findAvailableOrbit, which requires an exact
                    // integer array-index match) expects a real slot number. Passing the
                    // fractional orbitId through unchanged (as this used to do) poisoned
                    // _nextOrbitId for every body added after an imported one with a fractional
                    // value, and findAvailableOrbit then silently dropped all of them at
                    // generation time — no error, just missing bodies (OW-58).
                    au: w.au ?? w.distAU ?? (w.orbitId != null ? SE().orbitIdToAU(w.orbitId) : null),
                    orbitId: w.baseOrbit ?? w.orbitId ?? null,
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

            // OTU-imported systems (io_manager.js importT5Tab) store the mainworld as flat
            // t5System.mainworld data but never place it into any star's orbits[].contents — flatWorlds
            // above is built exclusively by walking that structure, so it's always empty for a fresh
            // import. Synthesize one working-copy body from raw.mainworld here, in the exact shape the
            // isMainworld branch above already produces, so it's indistinguishable from a normal
            // mainworld to the rest of the editor. _t5UwpLockFor already reads body._raw.X for exactly
            // this field set (starport/size/atm/hydro/pop/gov/law/tl) with zero changes needed.
            // Skipped once any flatWorlds body is already flagged isMainworld — true for every non-import
            // system, and true for an imported system that has already been through one Fill & Save since
            // this fix shipped (its mainworld is then a real orbits[].contents entry).
            if (raw.mainworld && !bodies.some(b => b.isMainworld)) {
                const mw = raw.mainworld;
                bodies.push({
                    _id: SE().uid('body'), type: 'World', ggType: null,
                    name: mw.name || '', uwp: mw.uwp || null,
                    au: mw.au ?? (mw.orbitId != null ? SE().orbitIdToAU(mw.orbitId) : null),
                    orbitId: mw.orbitId ?? null,
                    travelZone: mw.travelZone || 'G',
                    parentStarId: starIdByIdx(mw.parentStarIdx ?? 0),
                    isMainworld: true,
                    moons: [],
                    _manualFields: mw._manualFields ? [...mw._manualFields] : [],
                    _raw: mw,
                });
            }

            return bodies;
        },

        write(wc, starIdxById) {
            _t5ElectMainworldIfNeeded(wc);   // Algorithm 7 — no-op if already designated

            const mwRefBody   = wc.mainworldRef ? wc.bodies.find(b => b._id === wc.mainworldRef) : null;
            const ownerOfMoon = mwRefBody ? null : wc.bodies.find(b => (b.moons || []).some(m => m._id === wc.mainworldRef));
            const mwMoon      = ownerOfMoon ? ownerOfMoon.moons.find(m => m._id === wc.mainworldRef) : null;
            const mwBody      = mwRefBody || mwMoon || wc.bodies.find(b => b.isMainworld);
            const isMoonMW    = !!mwMoon;

            const { fields: mwLock, mf: mwLockMF } = _t5UwpLockFor(mwBody || {});
            const mwTradeCodes = _t5MainworldTradeCodesLock(mwBody);

            // OW-44 (directives/project_manifest.md): a brand-new mainworld (no prior .uwp) was
            // never actually generated at all — this used to fall back to a literal placeholder
            // UWP string unconditionally. Roll a real one via the classic flow's own
            // generateT5Mainworld (t5_world_engine.js), seeded with any typed "Seed UWP digits"
            // via the shared applyUwpSeed (the same call CT/MgT2E's write() already make —
            // wiring up T5's seed-digit boxes for the first time here too).
            //
            // The seed used to start from a blank `{ _manualFields: [] }` — fine for a body
            // that's never been generated at all, but if mwBody._raw already carries real prior
            // digits (atm, hydro, pop, ...) despite .uwp itself being momentarily falsy, that blank
            // slate threw all of it away: generateT5Mainworld only skips rolling a field when it's
            // marked manual, and nothing here marked the untyped ones, so every field the user
            // DIDN'T type in this Save got a fresh, unrelated dice roll (e.g. atm silently jumping
            // from 0 to a random value after only typing a new Starport). Seed from mwLock (same
            // lock the already-generated-mainworld path below uses) so only fields with no prior
            // value at all — and no typed digit — actually get rolled.
            let freshRoll = null;
            if (mwBody && !mwBody.uwp && typeof T5_World_Engine !== 'undefined') {
                const editorSeed = SE().applyUwpSeed({ ...mwLock, _manualFields: [...mwLockMF] }, mwBody._uwpSeed);
                freshRoll = T5_World_Engine.generateT5Mainworld(wc.hexId, editorSeed);
            }

            // OW-XX: typed "Seed UWP digits" on an ALREADY-generated mainworld (mwBody.uwp
            // truthy) used to be silently discarded — mwBody._uwpSeed was only ever read inside
            // the freshRoll branch above, so re-typing e.g. Starport on an existing/imported
            // mainworld and hitting Fill & Save left the old locked value (mwLock, sourced from
            // mwBody._raw — the pre-edit snapshot) untouched, and the typed digit never made it
            // into .uwp either (mainworldUWP.uwp fell straight back to mwBody.uwp). Overlay the
            // seed digits onto the locked fields here so a typed digit always wins, whether the
            // mainworld is brand-new or already generated; fields the user didn't type keep their
            // locked (mwLock) values via applyUwpSeed's in-place merge.
            let seeded = null;
            if (mwBody && mwBody.uwp && mwBody._uwpSeed) {
                seeded = SE().applyUwpSeed({ ...mwLock, _manualFields: [] }, mwBody._uwpSeed);
            }

            const mainworldUWP = mwBody ? {
                _id: mwBody._id,
                uwp: freshRoll ? freshRoll.uwp
                    : seeded ? `${seeded.starport}${toEHex(seeded.size)}${toEHex(seeded.atm)}${toEHex(seeded.hydro)}${toEHex(seeded.pop)}${toEHex(seeded.gov)}${toEHex(seeded.law)}-${toEHex(seeded.tl)}`
                    : (mwBody.uwp || 'A788899-9'),
                name: mwBody.name || '',
                travelZone: SE().normTz(mwBody.travelZone),
                isPreMoon: isMoonMW,
                orbitId: isMoonMW ? ownerOfMoon.orbitId : mwBody.orbitId,
                parentBodyId:  isMoonMW ? ownerOfMoon._id : null,
                parentStarIdx: isMoonMW ? (starIdxById[ownerOfMoon.parentStarId] ?? 0) : null,
                ...mwLock,
                ...(mwTradeCodes !== null ? { tradeCodes: mwTradeCodes } : {}),
                _manualFields: [...mwLockMF, ...(mwTradeCodes !== null ? ['tradeCodes'] : [])],
                ...(seeded ? {
                    worldType: seeded.worldType, starport: seeded.starport, size: seeded.size,
                    atm: seeded.atm, hydro: seeded.hydro, pop: seeded.pop,
                    gov: seeded.gov, law: seeded.law, tl: seeded.tl,
                } : {}),
                ...(freshRoll ? {
                    worldType: freshRoll.worldType, starport: freshRoll.starport, size: freshRoll.size,
                    atm: freshRoll.atm, hydro: freshRoll.hydro, pop: freshRoll.pop,
                    gov: freshRoll.gov, law: freshRoll.law, tl: freshRoll.tl,
                } : {}),
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
            } else if (typeof window !== 'undefined' && window.T5_TopDown_Generator &&
                       typeof window.T5_TopDown_Generator.buildT5StarOnlyPreview === 'function') {
                // No mainworld yet (blank Create, before any body has been added) — show just
                // the star(s) in the orrery immediately, matching MgT2E/CT parity, without
                // invoking generateT5System's mainworld-anchored pipeline at all (T5's own
                // "Continuation Method" requires a real mainworld before that runs). See OW-49.
                newSys = window.T5_TopDown_Generator.buildT5StarOnlyPreview(seedSys);
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

        // Backfills each working-copy body/moon's rolled UWP digits (+ trade codes, mainworld
        // only) into _raw right after every Preview. Without this, _t5UwpLockFor/
        // _t5MainworldTradeCodesLock have nothing to lock onto for a body added and generated
        // within the same editing session — _addBody seeds _raw as `{}`, which only ever gets
        // real data from readBodies() after a Fill & Save + reopen round-trip — so every
        // subsequent Preview, and the final Fill & Save itself, independently re-rolled that
        // body's entire UWP from scratch (T5 had no backfillFromGenerated at all — see this
        // file's header comment — so this was true for every newly added body's first editing
        // session, not just the mainworld). Mirrors CT's identical fix (_ctEditorAdapter.js
        // backfillFromGenerated), adapted to T5's shape: bodies live under
        // newSys.stars[].orbits[].contents, moons under .satellites (not .moons). The
        // mainworld — top-level or a moon — is already the SAME object reference
        // generateT5System placed into that structure (t5_topdown_generator.js Phase 1), so no
        // separate mainworld lookup/special-casing is needed beyond the isMainworld check that
        // decides whether tradeCodes also gets backfilled.
        backfillFromGenerated(wc, newSys) {
            const genBodies = [];
            (newSys.stars || []).forEach(star => (star.orbits || []).forEach(o => { if (o.contents) genBodies.push(o.contents); }));

            const lockFields = ['worldType', 'size', 'atm', 'hydro', 'pop', 'gov', 'law', 'starport', 'tl'];
            function backfill(wcObj, genObj, isMainworld) {
                if (!genObj) return;
                wcObj._raw = wcObj._raw || {};
                lockFields.forEach(f => { if (genObj[f] !== undefined) wcObj._raw[f] = genObj[f]; });
                // tradeCodes is only ever read back out of _raw for the mainworld
                // (_t5MainworldTradeCodesLock) — see that function's comment for why subordinate
                // bodies/moons deliberately don't get the same treatment (_t5BodySeed never
                // forwards a tradeCodes field to the generator for them).
                if (isMainworld && genObj.tradeCodes !== undefined) wcObj._raw.tradeCodes = genObj.tradeCodes;
            }

            wc.bodies.forEach(wcBody => {
                const genBody = genBodies.find(b => b._id === wcBody._id);
                backfill(wcBody, genBody, wcBody.isMainworld);
                (wcBody.moons || []).forEach(wcMoon => {
                    const genMoon = genBody && (genBody.satellites || []).find(m => m._id === wcMoon._id);
                    backfill(wcMoon, genMoon, wcMoon.isMainworld);
                });
            });
        },
    };
})();
