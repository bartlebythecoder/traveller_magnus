// =============================================================================
// AOW_EDITOR_ADAPTER.JS — System Editor engine adapter for Architect of Worlds (AoW)
// Extracted verbatim from system_editor.js's _ENGINE_ADAPTERS.AoW (no logic
// changes) so AoW-specific editor troubleshooting can no longer touch working
// CT/MgT2E/T5/RTT code by accident, and vice versa. Registers itself on
// window.SystemEditorAdapters.AoW; system_editor.js picks it up when it builds
// _ENGINE_ADAPTERS. Must load BEFORE system_editor.js (see hex_map.html).
//
// Per OW-9: AoW's actual generation logic (star-physics solving, hierarchy
// mapping, disk-worksheet synthesis) lives entirely in js/aow_seed_bridge.js,
// not here — this adapter stays thin, unlike CT/T5/RTT's write() which do
// their own field-locking inline.
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
// window.AoWBottomUpGenerator is a true global (from aow_bottomup_generator.js),
// not part of system_editor.js's closure, so it's referenced directly.
// =============================================================================

'use strict';

(function () {
    function SE() { return window.SystemEditorShared; }

    window.SystemEditorAdapters = window.SystemEditorAdapters || {};
    window.SystemEditorAdapters.AoW = {
        detect(stateObj) {
            if (stateObj.aowSystem && stateObj.aowSystem.stars && stateObj.aowSystem.stars.length > 0) {
                return { raw: stateObj.aowSystem, engine: 'AoW' };
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
                    moons:         (w.moons || w.satellites || []).map(SE().buildMoon),
                    _manualFields: w._manualFields ? [...w._manualFields] : [],
                    _raw: w,
                });
            });
            return bodies;
        },

        // Deliberately thin: the actual field-locking (aowUwpLockFor/aowPhysSeed) happens
        // inside AoWSeedBridge.synthesizeDiskWorksheets, which is what consumes seed.worlds —
        // this just carries each working-copy body through with the fields that function and
        // aow_bottomup_generator.js's Phase 1 star-physics resolution need: parentStarId
        // (a star _id, not an index — synthesizeDiskWorksheets maps bodies to worksheets by
        // matching this against each star's own _id), orbitId, au, _raw, _manualFields.
        write(wc, starIdxById) {
            const worlds = wc.bodies.map(b => ({
                _id: b._id,
                name: b.name || '',
                type: b.type, // editor vocabulary ('Gas Giant'/'Belt'/'World') — mapped to AoW's own planetType inside the bridge
                uwp: b.uwp || null,
                orbitId: b.orbitId != null ? b.orbitId : null,
                au: b.orbitId != null ? (SE().orbitIdToAU(b.orbitId) ?? b.au ?? 1.0) : (b.au ?? 1.0),
                parentStarId: b.parentStarId,
                isMainworld: !!b.isMainworld,
                moons: (b.moons || []).map(m => ({
                    _id: m._id, name: m.name || '', uwp: m.uwp || null,
                    isMainworld: !!m.isMainworld,
                    _raw: m._raw, _manualFields: m._manualFields ? [...m._manualFields] : [],
                })),
                _raw: b._raw,
                _manualFields: b._manualFields ? [...b._manualFields] : [],
            }));
            return { worlds };
        },

        run(hexId, seedSys, stateObj) {
            let newSys = null;
            if (typeof window !== 'undefined' && window.AoWBottomUpGenerator) {
                newSys = window.AoWBottomUpGenerator.generateAoWSystemBottomUp(hexId, seedSys);
            }
            if (newSys) {
                SE().clearSystemData(stateObj);
                stateObj.aowSystem = newSys;
                stateObj.mgt2eData = newSys.mainworld || null;
                // AoW uses MgT2E's socio display fields (macro_orchestrator.js:1128)
                stateObj.mgtSocio  = newSys.mainworld || null;
            }
            return newSys;
        },
    };
})();
