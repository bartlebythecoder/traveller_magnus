/**
 * js/seed_restoration.js
 *
 * SEED RESTORATION — shared System Editor <-> bottom-up generator reconciliation helpers.
 *
 * When the System Editor's `seedSys` provides a body list but a bottom-up generator still
 * rolls fresh inventory/orbits for it (i.e. `_allowAddBodies` is true, or the caller wants
 * user-authored bodies preserved through a re-roll), the freshly-generated body objects are
 * new instances with no relation to the seed's `_id`/name/UWP/`_manualFields`. These helpers
 * re-attach the user's data to the nearest-matching generated body so it survives the roll.
 *
 * Engine-agnostic and rule-system-agnostic: this is pure list/orbit matching, not RPG logic,
 * so it belongs outside any single edition's engine files (see OW-6 — this used to live
 * inline in mgt2e_bottomup_generator.js; CT and RTT will need the same behavior once their
 * own bottom-up generators grow field-level seedSys gating).
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SeedRestoration = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const _log = (typeof writeLogLine === 'function') ? writeLogLine : () => {};
    const _loggingEnabled = () => (typeof window !== 'undefined' && window.isLoggingEnabled);

    // Coarse body-category bucket used to match a seed body to a generated one of the "same
    // kind" — deliberately loose (Gas Giant / Belt / everything else) since the generator is
    // free to re-decide finer distinctions (e.g. exact terrestrial size) on a re-roll.
    function _category(bodyType) {
        return bodyType === 'Gas Giant' ? 'GG' : bodyType === 'Planetoid Belt' ? 'Belt' : 'Rocky';
    }

    function _moonHasUserData(m) {
        return !!(m.name || m.uwp || (m._manualFields && m._manualFields.length > 0));
    }

    /**
     * After a generator has wiped and rebuilt `sys.worlds` from scratch, re-attach each
     * user-edited seed world's data (_id, name, UWP components, _manualFields, moons) onto the
     * nearest-orbit freshly-generated world of the same coarse category. Must run before any
     * physics/atmosphere pass so the restored `_manualFields` are honoured by those engines.
     *
     * Mutates `sys.worlds` in place. No-op if `seedSys` has no worlds, or none of them carry
     * user data (a pristine seed world needs no restoration — the fresh roll IS its data).
     *
     * @param {Object} sys     - system object; sys.worlds must already be the freshly-generated list
     * @param {Object} seedSys - the System Editor's seed; seedSys.worlds is the pre-roll seed list
     */
    function restoreSeedWorldsIntoGenerated(sys, seedSys) {
        if (!seedSys || !(seedSys.worlds || []).length) return;

        const restored = new Set();
        for (const sw of seedSys.worlds) {
            const hasUserData = sw.name || sw.uwp || (sw._manualFields && sw._manualFields.length > 0)
                || (sw.moons && sw.moons.some(_moonHasUserData));
            if (!hasUserData) continue;

            const swCat   = _category(sw.type);
            const swOrbit = sw.orbitId != null ? sw.orbitId : 1;
            let best = null, bestDist = Infinity;
            for (const gw of sys.worlds) {
                if (restored.has(gw)) continue;
                if (_category(gw.type) !== swCat) continue;
                const d = Math.abs((gw.orbitId || 0) - swOrbit);
                if (d < bestDist) { bestDist = d; best = gw; }
            }
            if (!best) continue;
            restored.add(best);

            if (sw._id)  best._id  = sw._id;
            if (sw.name) best.name = sw.name;
            if (sw.uwp)  best.uwp  = sw.uwp;
            ['size', 'atmCode', 'hydroCode', 'pop', 'popCode', 'gov', 'govCode', 'law', 'tl', 'starport'].forEach(f => {
                if (sw[f] != null) best[f] = sw[f];
            });
            if (sw._manualFields && sw._manualFields.length) {
                const mfSet = new Set(best._manualFields || []);
                sw._manualFields.forEach(f => mfSet.add(f));
                best._manualFields = [...mfSet];
            }
            // Restore any user-authored moons (named/detailed) from the seed world.
            // generatePhysicals counts these as existingMoons and will add more if the dice
            // roll exceeds the count; moons with pd already set are kept as-is.
            if (sw.moons && sw.moons.length > 0) {
                best.moons = sw.moons.map(m => Object.assign({}, m));
            }

            if (_loggingEnabled()) {
                _log(`[SEED RESTORE] Seed "${sw.name || sw._id}" → generated ${best.type} at orbit ${best.orbitId != null ? best.orbitId.toFixed(2) : '?'} (dist ${bestDist.toFixed(2)}, moons restored: ${(sw.moons || []).length})`);
            }
        }
    }

    /**
     * Snapshot each world's current moon count, to be passed to trimGeneratedMoonsToSeededCaps
     * after the physics pass runs. Only meaningful when the seed is locking body count
     * (`_allowAddBodies` false) — otherwise the generator is allowed to add moons freely and
     * there is no cap to enforce.
     *
     * @returns {number[]|null} per-world moon counts (same order as sys.worlds), or null if
     *   the seed allows new bodies and no cap should be enforced.
     */
    function captureSeededMoonCaps(sys, seedSys) {
        if (!seedSys || seedSys._allowAddBodies) return null;
        return sys.worlds.map(w => (w.moons || []).length);
    }

    /**
     * Trims back any moons a generatePhysicals-style pass added beyond the seeded count
     * captured by captureSeededMoonCaps. Before slicing, moves the mainworld moon (if any) to
     * index 0 so the cap can never accidentally drop it.
     *
     * @param {Object} sys             - system object, sys.worlds[].moons already (possibly over-)populated
     * @param {Object} seedSys         - the System Editor's seed (for _mainworldRef)
     * @param {number[]|null} seededMoonCaps - result of a prior captureSeededMoonCaps call
     */
    function trimGeneratedMoonsToSeededCaps(sys, seedSys, seededMoonCaps) {
        if (!seededMoonCaps) return;
        const mwId = seedSys && seedSys._mainworldRef ? seedSys._mainworldRef : null;
        sys.worlds.forEach((w, i) => {
            const cap = seededMoonCaps[i] ?? 0;
            if (!w.moons || w.moons.length <= cap) return;
            if (mwId) {
                const mwIdx = w.moons.findIndex(m => m._id === mwId);
                if (mwIdx >= cap) {
                    const mwMoon = w.moons.splice(mwIdx, 1)[0];
                    w.moons.unshift(mwMoon);
                }
            }
            w.moons = w.moons.slice(0, cap);
        });
    }

    return {
        restoreSeedWorldsIntoGenerated,
        captureSeededMoonCaps,
        trimGeneratedMoonsToSeededCaps,
    };
}));
