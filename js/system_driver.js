/**
 * js/system_driver.js
 * 
 * UNIVERSAL SYSTEM ORCHESTRATOR (v2.0 Modular Architecture)
 * Central entry point for all Traveller system generation (CT and T5).
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            './ct_bottomup_generator',
            './ct_topdown_generator',
            './ct_uwp_auditor',
            './t5_topdown_generator',
            './t5_uwp_auditor'
        ], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./ct_bottomup_generator'),
            require('./ct_topdown_generator'),
            require('./ct_uwp_auditor'),
            require('./t5_topdown_generator'),
            require('./t5_uwp_auditor')
        );
    } else {
        root.System_Driver = factory(
            {
                generateSystemSkeleton: root.generateSystemSkeleton,
                processBottomUpSocial: root.processBottomUpSocial
            },
            root.generateTopDownSystem,
            root.auditCTSystem,
            root.T5_TopDown_Generator,
            root.T5_UWP_Auditor
        );
    }
}(this, function (CT_BottomUp, CT_TopDown, CT_Auditor, T5_Generator, T5_Auditor) {

    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;

    /**
     * Main entry point for universal system generation.
     *
     * @param {Object} params - Configuration for generation.
     * @param {string} params.edition - 'CT' or 'T5'.
     * @param {string} params.mode - 'bottom-up' or 'top-down'.
     * @param {Object} [params.mainworldUWP] - Required for 'top-down'.
     * @param {Object} [params.primaryStar] - Optional context.
     * @param {string} [params.hexId] - Seed or identification string.
     * @param {Object} [params.seedSys=null] - Optional seed from the System Editor. When null,
     *   generation is fully stochastic (all existing macro calls). When provided:
     *   - For T5: seedSys._mainworldRef body's UWP is used as mainworldUWP
     *   - For CT: passed to generateSystemSkeleton to gate stellar/skeleton phases
     * @returns {Object} The generated system object.
     */
    function generateSystem(params) {
        const { edition, mode, mainworldUWP, primaryStar, hexId, seedSys = null } = params;

        if (!edition) {
            throw new Error("Sean Protocol Violation: Generation requires a specific 'edition' flag (CT or T5).");
        }

        let sys = null;

        // --- ROUTING: TRAVELLER 5 (T5) ---
        if (edition.toUpperCase() === 'T5') {
            if (mode === 'bottom-up') {
                throw new Error("Error: Traveller 5 generation is strictly Top-Down. Bottom-Up mode is not supported in this edition.");
            }

            if (mode === 'top-down') {
                // When seedSys designates a mainworld, extract its UWP for the top-down anchor
                let resolvedUWP = mainworldUWP;
                if (seedSys && seedSys._mainworldRef) {
                    const mwBody = (seedSys.worlds || []).find(w => w._id === seedSys._mainworldRef) ||
                                   (seedSys.worlds || []).reduce((found, w) => {
                                       if (found) return found;
                                       return (w.moons || []).find(m => m._id === seedSys._mainworldRef) || null;
                                   }, null);
                    if (mwBody && mwBody.uwp) {
                        resolvedUWP = Object.assign({}, mwBody, { uwp: mwBody.uwp });
                    }
                }
                if (!resolvedUWP) {
                    throw new Error("T5 Top-Down generation requires a valid mainworldUWP object.");
                }
                // T5 Generator expects the mainworldBase as the anchor; seedSys threads the
                // System Editor's structural gating (stars/worlds/_allowAddBodies) through.
                sys = T5_Generator.generateT5System(resolvedUWP, seedSys);
            } else {
                throw new Error(`Invalid generation mode for T5: ${mode}. Only 'top-down' is supported.`);
            }
        }

        // --- ROUTING: CLASSIC TRAVELLER (CT) ---
        else if (edition.toUpperCase() === 'CT') {
            if (mode === 'top-down') {
                if (!mainworldUWP) {
                    throw new Error("CT Top-Down generation requires a valid mainworldUWP object.");
                }
                // Determine if we use the standalone topDownGen or the orchestrator logic
                const genFn = (typeof CT_TopDown === 'function') ? CT_TopDown : CT_TopDown.generateTopDownSystem;
                sys = genFn(mainworldUWP, primaryStar);
            }
            else if (mode === 'bottom-up') {
                const skeletonGen = CT_BottomUp.generateSystemSkeleton;
                const socialProc = CT_BottomUp.processBottomUpSocial;

                if (!skeletonGen || !socialProc) {
                    throw new Error("Missing Classic Traveller Bottom-Up generator components.");
                }

                const skeleton = skeletonGen(hexId, seedSys);

                // If seedSys designates a mainworld, pre-set it on the skeleton so
                // processBottomUpDesignation uses the Fixed Anchor path.
                if (seedSys && seedSys._mainworldRef && skeleton) {
                    const _findById = (id) => {
                        for (const slot of (skeleton.orbits || [])) {
                            const w = slot.contents;
                            if (w && w._id === id) return w;
                            for (const m of (w && (w.satellites || w.moons)) || []) {
                                if (m._id === id) return m;
                            }
                        }
                        for (const w of (skeleton.capturedPlanets || [])) {
                            if (w && w._id === id) return w;
                        }
                        return null;
                    };
                    const mw = _findById(seedSys._mainworldRef);
                    if (mw) skeleton.mainworld = mw;
                }

                sys = socialProc(skeleton);
            } else {
                throw new Error(`Invalid generation mode for CT: ${mode}. Use 'bottom-up' or 'top-down'.`);
            }
        }

        else {
            throw new Error(`Unsupported edition: ${edition}. Supported editions are 'CT' and 'T5'.`);
        }

        // --- FINALIZATION: AUDIT & LOGGING ---
        if (sys) {
            if (edition.toUpperCase() === 'T5') {
                // Attaches sys.auditResult for the System Editor's engine-agnostic OW-3 Fill &
                // Save audit gate; falls back to the bare audit call if runAndLog isn't present.
                if (T5_Auditor.runAndLog) T5_Auditor.runAndLog(sys, hexId);
                else T5_Auditor.runT5SystemAudit(sys);
            } else {
                // CT Auditor returns an audit object
                const auditFn = (typeof CT_Auditor === 'function') ? CT_Auditor : CT_Auditor.auditCTSystem;
                sys.audit = auditFn(sys);

                _log("=====================================================================");
                _log("CLASSIC TRAVELLER SYSTEM AUDIT RESULTS");
                if (sys.audit && sys.audit.checks) {
                    sys.audit.checks.forEach(c => _log(c));
                }
                if (sys.audit && sys.audit.errors && sys.audit.errors.length > 0) {
                    sys.audit.errors.forEach(e => _log(`[ERROR] ${e}`));
                }
                _log("=====================================================================");
            }
            return sys;
        }

        throw new Error("System generation failed: Orchestrator returned null.");
    }

    /**
     * Restores manually-set field values from an old T5 sys onto a freshly generated sys.
     * Bodies are matched by star index + orbit index (and satellite index within each orbit).
     * Only fields listed in the old body's _manualFields array are copied.
     */
    function restoreT5ManualFields(newSys, oldSys) {
        if (!oldSys || !oldSys.stars || !newSys || !newSys.stars) return;

        function applyManuals(oldBody, newBody) {
            if (!oldBody || !newBody) return;
            if (!Array.isArray(oldBody._manualFields) || oldBody._manualFields.length === 0) return;
            oldBody._manualFields.forEach(field => {
                newBody[field] = oldBody[field];
            });
            newBody._manualFields = [...oldBody._manualFields];
            // Rebuild UWP string if this is a body with social stats
            const hasSocial = newBody.starport !== undefined && newBody.size !== undefined &&
                              newBody.pop !== undefined && !['Gas Giant', 'Large Gas Giant',
                              'Small Gas Giant', 'Ice Giant', 'Planetoid Belt'].includes(newBody.type);
            if (hasSocial) {
                newBody.uwp = `${newBody.starport}${toEHex(newBody.size)}${toEHex(newBody.atm)}${toEHex(newBody.hydro)}${toEHex(newBody.pop)}${toEHex(newBody.gov)}${toEHex(newBody.law)}-${toEHex(newBody.tl)}`;
                newBody.uwpSecondary = newBody.uwp;
            }
        }

        // Walk stars and match by index
        oldSys.stars.forEach((oldStar, sIdx) => {
            const newStar = newSys.stars[sIdx];
            if (!newStar) return;
            // Star-level manual fields (type, decimal, size class)
            if (Array.isArray(oldStar._manualFields) && oldStar._manualFields.length > 0) {
                oldStar._manualFields.forEach(field => { newStar[field] = oldStar[field]; });
                newStar._manualFields = [...oldStar._manualFields];
                newStar.name = `${newStar.type}${newStar.decimal !== undefined ? newStar.decimal : ''}${newStar.size ? ' ' + newStar.size : ''}`.trim();
            }
            if (!oldStar.orbits || !newStar.orbits) return;
            oldStar.orbits.forEach((oldOrbit, oIdx) => {
                const oldBody = oldOrbit.contents;
                const newOrbit = newStar.orbits[oIdx];
                if (!oldBody || !newOrbit) return;
                applyManuals(oldBody, newOrbit.contents);
                // Satellites
                if (oldBody.satellites && newOrbit.contents && newOrbit.contents.satellites) {
                    oldBody.satellites.forEach((oldSat, satIdx) => {
                        applyManuals(oldSat, newOrbit.contents.satellites[satIdx]);
                    });
                }
            });
        });
    }

    /**
     * Generates a fresh T5 system and restores any manual field overrides from the existing sys.
     * Use this instead of generateSystem when the hex already has a t5System with user edits.
     */
    function generateT5SystemPreservingManuals(mainworldBase, oldSys) {
        const newSys = T5_Generator.generateT5System(mainworldBase);
        if (oldSys) restoreT5ManualFields(newSys, oldSys);
        return newSys;
    }

    /**
     * Restores manually-set field values from an old MgT2E sys onto a freshly generated sys.
     * Bodies are matched by star index + worlds array index.
     * Only fields listed in the old body's _manualFields array are copied.
     */
    function restoreMgt2eManualFields(newSys, oldSys) {
        if (!oldSys || !newSys) return;

        function applyManuals(oldBody, newBody) {
            if (!oldBody || !newBody) return;
            if (!Array.isArray(oldBody._manualFields) || oldBody._manualFields.length === 0) return;
            oldBody._manualFields.forEach(field => { newBody[field] = oldBody[field]; });
            newBody._manualFields = [...oldBody._manualFields];
        }

        // Stars: match by index
        if (Array.isArray(oldSys.stars) && Array.isArray(newSys.stars)) {
            oldSys.stars.forEach((oldStar, sIdx) => {
                const newStar = newSys.stars[sIdx];
                if (!newStar) return;
                if (Array.isArray(oldStar._manualFields) && oldStar._manualFields.length > 0) {
                    oldStar._manualFields.forEach(field => { newStar[field] = oldStar[field]; });
                    newStar._manualFields = [...oldStar._manualFields];
                }
            });
        }

        // Worlds: match by index in sys.worlds array
        if (Array.isArray(oldSys.worlds) && Array.isArray(newSys.worlds)) {
            oldSys.worlds.forEach((oldWorld, wIdx) => {
                const newWorld = newSys.worlds[wIdx];
                if (!newWorld) return;
                applyManuals(oldWorld, newWorld);
                // Moons
                if (Array.isArray(oldWorld.moons) && Array.isArray(newWorld.moons)) {
                    oldWorld.moons.forEach((oldMoon, mIdx) => {
                        applyManuals(oldMoon, newWorld.moons[mIdx]);
                    });
                }
                // Significant bodies
                if (Array.isArray(oldWorld.significantBodies) && Array.isArray(newWorld.significantBodies)) {
                    oldWorld.significantBodies.forEach((oldSb, sbIdx) => {
                        applyManuals(oldSb, newWorld.significantBodies[sbIdx]);
                    });
                }
            });
        }
    }

    /**
     * Generates a fresh MgT2E top-down system and restores any manual field overrides from the existing sys.
     * Use this instead of generateMgT2ESystemTopDown when the hex already has a mgtSystem with user edits.
     */
    function generateMgt2eSystemPreservingManuals(hexId, oldSys) {
        const newSys = generateMgT2ESystemTopDown(hexId);
        if (oldSys) restoreMgt2eManualFields(newSys, oldSys);
        return newSys;
    }

    return { generateSystem, generateT5SystemPreservingManuals, generateMgt2eSystemPreservingManuals };
}));
