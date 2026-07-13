// =============================================================================
// RTT_EDITOR_ADAPTER.JS — System Editor engine adapter for RTT WorldGen (RTT)
// Extracted verbatim from system_editor.js's _ENGINE_ADAPTERS.RTT (no logic
// changes) so RTT-specific editor troubleshooting can no longer touch working
// CT/MgT2E/T5 code by accident, and vice versa. Registers itself on
// window.SystemEditorAdapters.RTT; system_editor.js picks it up when it builds
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
// computeRTTBodyUWP, generateRTTSectorStep1, and extractRTTMainworld are true
// globals (from rtt_engine.js), not part of system_editor.js's closure, so
// they're referenced directly rather than through SE().
//
// 2026-07-12: gained restoreManualFields(), moved here (also verbatim) from
// system_editor.js's _restoreDisplayManualFields() — that was the one part of the 2026-07-11
// adapter-file split that hadn't actually moved yet (still a per-engine if/else-if chain in
// system_editor.js). See _ENGINE_ADAPTERS' comment block there. RTT has no
// backfillFromGenerated — _preview() never had an RTT branch before this split either, so
// there's nothing to move.
// =============================================================================

'use strict';

(function () {
    function SE() { return window.SystemEditorShared; }

    // RTT's planetary zones (Epistellar/Inner/Outer) map to AU the same way for every star —
    // base distance plus a per-zone step for each body already placed in that zone, tracked via
    // a running per-zone index as the sorted orbit list is walked. Single module-scope home for
    // this so it isn't redefined inline inside the adapter's readBodies every call.
    const _RTT_ZONE_AU = {
        Epistellar: { base: 0.10, step: 0.10 },
        Inner:      { base: 0.50, step: 0.70 },
        Outer:      { base: 5.00, step: 8.00 },
    };
    function _rttOrbitAU(zone, zoneIndex) {
        const zDef = _RTT_ZONE_AU[zone] || _RTT_ZONE_AU.Inner;
        return zDef.base + zoneIndex * zDef.step;
    }

    // Seeds physical/social digits from the body's previous generated values (_raw), same role
    // as _ctUwpLockFor/_t5UwpLockFor. Unlike CT/T5, RTT's manual-preservation mechanism
    // (rtt_engine.js's _rttSaveManual/_rttRestoreManual, and classifyRTTBody's isManual guard)
    // is purely isManual()-based — there's no size-=== -undefined-style presence guard to fall
    // back on — so every locked field here must be pushed into _manualFields, not just the
    // atm/hydro/pop-style subset CT/T5 mark manual.
    const _RTT_LOCK_FIELDS = ['worldClass', 'size', 'atmosphere', 'hydrosphere', 'population', 'government', 'lawLevel', 'starport', 'tl'];
    function _rttUwpLockFor(body) {
        const raw = body._raw || {};
        if (!body.uwp || !body._raw) return { fields: {}, mf: [] };
        const fields = {};
        const mf = [];
        _RTT_LOCK_FIELDS.forEach(f => { if (raw[f] !== undefined) { fields[f] = raw[f]; mf.push(f); } });
        return { fields, mf };
    }

    window.SystemEditorAdapters = window.SystemEditorAdapters || {};
    window.SystemEditorAdapters.RTT = {
        detect(stateObj) {
            if (stateObj.rttSystem && stateObj.rttSystem.stars && stateObj.rttSystem.stars.length > 0)
                return { raw: stateObj.rttSystem, engine: 'RTT' };
            if (stateObj.rttData && stateObj.rttData.stars && stateObj.rttData.stars.length > 0)
                return { raw: stateObj.rttData, engine: 'RTT' };
            return null;
        },

        readBodies(raw, starIdByIdx) {
            const bodies = [];
            (raw.stars || []).forEach((s, si) => {
                if (!s.planetarySystem) return;
                const zoneCounts = {};
                [...(s.planetarySystem.orbits || [])]
                    .sort((a, b) => (a.orbitNumber || 0) - (b.orbitNumber || 0))
                    .forEach(body => {
                        const isMainworld = !!body.isMainworld;
                        const rawType     = body.type || body.worldClass || '';
                        const canon       = isMainworld ? 'World' : SE().canonType(rawType);
                        const zone        = body.zone || 'Inner';
                        const zIdx        = zoneCounts[zone] = (zoneCounts[zone] || 0);
                        zoneCounts[zone]++;
                        bodies.push({
                            _id: SE().uid('body'), type: canon,
                            ggType:        canon === 'Gas Giant' ? 'GL' : null,
                            name: body.name || '',
                            // RTT bodies never carry their own .uwp field — synthesize one
                            // from the raw component stats via rtt_engine.js's shared helper
                            // (also used by extractRTTMainworld for the mainworld summary).
                            uwp: (typeof computeRTTBodyUWP === 'function') ? computeRTTBodyUWP(body) : null,
                            au: _rttOrbitAU(zone, zIdx),
                            orbitId:       body.orbitNumber ?? null,
                            travelZone:    (body.bases || []).includes('Z') ? 'Red' : 'G',
                            parentStarId:  starIdByIdx(si), isMainworld,
                            moons:         (body.moons || body.satellites || []).map(SE().buildMoon),
                            _manualFields: body._manualFields ? [...body._manualFields] : [],
                            _raw: body,
                        });
                    });
            });
            return bodies;
        },

        write(wc, starIdxById) {
            const rttBodies = wc.stars.map(() => []);
            wc.bodies.forEach(b => {
                const si = starIdxById[b.parentStarId] ?? 0;
                const { fields: uwpLock, mf: extraMF } = _rttUwpLockFor(b);
                rttBodies[si].push({
                    _id:         b._id,
                    orbitNumber: b.orbitId != null ? b.orbitId : rttBodies[si].length + 1,
                    // Preserve the body's real zone from its previous generation pass — RTT's
                    // seeded path (generateRTTSectorStep2) uses the seed's zone verbatim (unlike
                    // CT, whose generator recalculates zone from orbit position), so hardcoding
                    // this would silently reclassify e.g. an Outer-zone body as Inner on every
                    // Fill & Save, changing which physical-stat roll branches apply to it.
                    zone:        (b._raw && b._raw.zone) || 'Inner',
                    type:        b.type === 'Gas Giant' ? 'Jovian Planet'
                               : b.type === 'Belt'      ? 'Asteroid Belt'
                               : 'Terrestrial Planet',
                    ...uwpLock,
                    satellites:  (b.moons || []).map((m, mi) => {
                        const { fields: mLock, mf: mMF } = _rttUwpLockFor(m);
                        return {
                            _id:         m._id,
                            orbitNumber: mi + 1,
                            type:        'Satellite',
                            name:        m.name || '',
                            ...mLock,
                            _manualFields: [...(m._manualFields || []), ...mMF],
                        };
                    }),
                    name:          b.name || '',
                    _manualFields: [...(b._manualFields || []), ...extraMF],
                });
            });
            return { rttBodies };
        },

        run(hexId, seedSys, stateObj) {
            let newSys = null;
            if (typeof generateRTTSectorStep1 === 'function') {
                newSys = generateRTTSectorStep1(hexId, { seedSys });
            }
            if (newSys) {
                SE().clearSystemData(stateObj);
                stateObj.rttSystem = newSys;
                // seedSys._mainworldRef (set generically for every engine in _buildSeedSys)
                // is used here instead of a workingCopy param, so the adapter run() signature
                // doesn't need to grow a 4th argument just for RTT.
                stateObj.rttData = (typeof extractRTTMainworld === 'function')
                    ? extractRTTMainworld(newSys, seedSys._mainworldRef) : null;
            }
            return newSys;
        },

        // Restores true (user-edited-only) _manualFields on the generated output, same
        // reasoning/role as MgT2E's own restoreManualFields (see that file) adapted to RTT's
        // shape: generated bodies live under newSys.stars[].planetarySystem.orbits[], and moons
        // are keyed 'satellites'. Necessary because _rttUwpLockFor marks worldClass/size/
        // atmosphere/hydrosphere/etc. manual purely to stop the generator re-rolling them, which
        // would otherwise make every pre-existing RTT body's fields show as "manually edited" in
        // the accordion after every Fill & Save.
        restoreManualFields(wc, newSys) {
            const genBodies = [];
            (newSys.stars || []).forEach(star => {
                if (!star.planetarySystem) return;
                (star.planetarySystem.orbits || []).forEach(b => genBodies.push(b));
            });
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
