/**
 * js/t5_uwp_auditor.js
 * 
 * T5 UWP AUDITOR (v2.0 Modular Architecture)
 * Validates T5 system generation and enforces technical constraints.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math', './t5_stellar_engine'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'), require('./t5_stellar_engine'));
    } else {
        root.T5_UWP_Auditor = factory(root.UniversalMath, root.T5_Stellar_Engine);
    }
}(this, function (UniversalMath, T5_Stellar_Engine) {
    const { toUWPChar, fromUWPChar } = UniversalMath;
    const { getStarHZ } = T5_Stellar_Engine;

    const _log = (typeof writeLogLine === 'function') ? writeLogLine : () => {};
    const _tSection = (typeof tSection === 'function') ? tSection : () => {};
    const _tResult = (typeof tResult === 'function') ? tResult : () => {};

    /**
     * Normalizes size to a number.
     */
    function normSize(size, type = '') {
        const typeStr = type || '';
        const isGG = typeStr.includes('Gas Giant') || typeStr === 'Ice Giant';
        if (size === 'S' && !isGG) return 0.4;
        if (size === 'R' && !isGG) return 0;
        if (typeof size === 'number') return size;
        if (typeof size === 'string') return fromUWPChar(size);
        return 0;
    }

    /**
     * Checks constraints for a specific body.
     */
    function checkConstraints(body, orbit, isSat, hzOrbit) {
        let errs = 0;
        const logFail = (msg) => { _log(`[FAIL] ${msg}`); errs++; };

        if (!body.worldType) {
            logFail(`Missing Data: Body in Orbit ${orbit} is missing worldType.`);
        }
        if (['Hospitable', 'InnerWorld', 'IceWorld', 'StormWorld', 'RadWorld', 'BigWorld'].includes(body.worldType) && normSize(body.size, body.type) < 1) {
            logFail(`Size Clamping Check: ${body.worldType} in Orbit ${orbit} has Size ${toUWPChar(body.size)}. Must be >= 1.`);
        }
        if (body.worldType === 'Belt' && normSize(body.size, body.type) !== 0) {
            logFail(`Belt Check: Belt in Orbit ${orbit} has Size ${toUWPChar(body.size)}. Must be 0.`);
        }
        if (body.worldType === 'Inferno' && body.atm !== 11 && body.atm !== fromUWPChar('B')) {
            logFail(`Atmosphere Check: Inferno in Orbit ${orbit} has Atm ${toUWPChar(body.atm)}. Must be B (11).`);
        }
        if (body.worldType === 'Belt' && body.atm !== 0) {
            logFail(`Atmosphere Check: Belt in Orbit ${orbit} has Atm ${toUWPChar(body.atm)}. Must be 0.`);
        }
        if (body.worldType === 'StormWorld' && (body.atm || 0) < 4) {
            logFail(`Atmosphere Check: StormWorld in Orbit ${orbit} has Atm ${toUWPChar(body.atm)}. Must be >= 4.`);
        }
        if (['Inferno', 'Belt'].includes(body.worldType) && (body.hydro || 0) !== 0) {
            logFail(`Hydro Check: ${body.worldType} in Orbit ${orbit} has Hydro ${toUWPChar(body.hydro)}. Must be 0.`);
        }
        if (normSize(body.size, body.type) < 2 && (body.hydro || 0) !== 0) {
            logFail(`Hydro Check: World with Size ${toUWPChar(body.size)} in Orbit ${orbit} has Hydro ${toUWPChar(body.hydro)}. Must be 0.`);
        }

        // Zone A Integrity
        if (orbit <= hzOrbit + 1) {
            if (body.worldType === 'IceWorld' || (body.worldType === 'Worldlet' && normSize(body.size) >= 1)) {
                logFail(`Zone A Integrity: ${body.worldType} in Orbit ${orbit} is in Zone A (Orbit <= ${hzOrbit + 1}).`);
            }
        }
        // Zone B Integrity
        if (orbit >= hzOrbit + 2) {
            if (isSat) {
                if (['Inferno', 'InnerWorld', 'Hospitable'].includes(body.worldType)) {
                    logFail(`Zone B Integrity (Satellite): ${body.worldType} in Orbit ${orbit} is in Zone B (Orbit >= ${hzOrbit + 2}).`);
                }
            } else {
                if (['Inferno', 'InnerWorld', 'StormWorld', 'Hospitable'].includes(body.worldType)) {
                    logFail(`Zone B Integrity (Planet): ${body.worldType} in Orbit ${orbit} is in Zone B (Orbit >= ${hzOrbit + 2}).`);
                }
            }
        }
        return errs;
    }

    /**
     * Executes the final system audit.
     */
    function runT5SystemAudit(sys, hzOrbit) {
        if (!sys || !sys.stars) return;
        if (hzOrbit === undefined) hzOrbit = getStarHZ(sys.stars[0]);

        let mainworldBase = null;
        let mwCount = 0;
        let ggCount = 0;
        let beltCount = 0;
        let totalWorlds = 0;

        // --- 1. Identify Mainworld and Counts ---
        sys.stars.forEach(star => {
            star.orbits.forEach(o => {
                const w = o.contents;
                if (!w || w.type === 'Empty') return;

                totalWorlds++;
                if (w.type === 'Mainworld') {
                    mainworldBase = w;
                    mwCount++;
                }
                if (w.type && (w.type.includes('Gas Giant') || w.type === 'Ice Giant')) ggCount++;
                if (w.type === 'Planetoid Belt') beltCount++;

                if (w.satellites) {
                    w.satellites.forEach(s => {
                        totalWorlds++;
                        if (s.type === 'Mainworld') {
                            mainworldBase = s;
                            mwCount++;
                        }
                    });
                }
            });
        });

        _tSection('T5 System Audit');
        let totalErrors = 0;

        // --- 2. Structure Check ---
        if (mwCount === 0) { _log('[FAIL] Structure: No Mainworld found in system.'); totalErrors++; }
        else if (mwCount > 1) { _log(`[FAIL] Structure: Multiple Mainworlds found (${mwCount}).`); totalErrors++; }
        else { _log('[PASS] Structure: Exactly 1 Mainworld present.'); }

        _log(`[INFO] Inventory: ${ggCount} Gas Giants, ${beltCount} Belts, ${totalWorlds} total bodies across ${sys.stars.length} stars.`);

        // --- 3. Planetary Physics & Satellite Audit ---
        _tSection('Planetary Physics & Satellite Audit');
        let physErrors = 0;
        sys.stars.forEach(star => {
            star.orbits.forEach(o => {
                let w = o.contents;
                if (!w || !w.satellites || w.satellites.length === 0) return;
                let parentSize = normSize(w.size, w.type);
                w.satellites.forEach((sat, idx) => {
                    let satSize = normSize(sat.size, sat.type);
                    if (satSize > parentSize) {
                        _log(`[FAIL] Physics: Star ${star.name} Orbit ${o.orbit} Satellite ${idx + 1} Size (${satSize}) exceeds Parent Size (${parentSize})`);
                        physErrors++;
                    }
                });
            });
        });
        totalErrors += physErrors;
        if (physErrors === 0) _log('[PASS] Physics & Orbits: All satellite constraints align.');

        // --- 4. World Type & Size Audit ---
        _tSection('World Type & Size Audit');
        let typeErrors = 0;
        sys.stars.forEach(star => {
            const hostHZ = getStarHZ(star);
            star.orbits.forEach(o => {
                let w = o.contents;
                if (!w || w.type === 'Empty') return;
                if (w.type !== 'Mainworld') typeErrors += checkConstraints(w, o.orbit, false, hostHZ);
                if (w.satellites) {
                    w.satellites.forEach(s => { if (s.type !== 'Mainworld') typeErrors += checkConstraints(s, o.orbit, true, hostHZ); });
                }
            });
        });
        totalErrors += typeErrors;
        if (typeErrors === 0) _log('[PASS] World Type & Size: All classification and size rules followed.');

        // --- 5. Population Cap Audit ---
        _tSection('Population Cap Audit');
        let popErrors = 0;
        const mwPop = (mainworldBase && mainworldBase.pop !== undefined) ? mainworldBase.pop : 0;
        sys.stars.forEach(star => {
            star.orbits.forEach(o => {
                let w = o.contents;
                if (!w || w.type === 'Empty' || w.type === 'Mainworld') return;
                if (w.pop > 0 && w.pop >= mwPop && mwPop < 15) {
                    _log(`[FAIL] Pop Cap: Star ${star.name} Orbit ${o.orbit} has Pop ${toUWPChar(w.pop)}, which is >= Mainworld Pop ${toUWPChar(mwPop)}.`);
                    popErrors++;
                }
                if (w.satellites) {
                    w.satellites.forEach(s => {
                        if (s.pop > 0 && s.type !== 'Mainworld' && s.pop >= mwPop && mwPop < 15) {
                            _log(`[FAIL] Pop Cap: Moon of Star ${star.name} Orbit ${o.orbit} has Pop ${toUWPChar(s.pop)}, which is >= Mainworld Pop ${toUWPChar(mwPop)}.`);
                            popErrors++;
                        }
                    });
                }
            });
        });
        totalErrors += popErrors;
        if (popErrors === 0) _log('[PASS] Population: No subordinate world exceeds or equals the Mainworld population.');

        _tResult('T5 Audit Summary', totalErrors === 0 ? 'ALL CLEAR' : `${totalErrors} error(s) detected`);
    }

    return {
        runT5SystemAudit
    };
}));
