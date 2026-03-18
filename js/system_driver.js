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
     * @returns {Object} The generated system object.
     */
    function generateSystem(params) {
        const { edition, mode, mainworldUWP, primaryStar, hexId } = params;

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
                if (!mainworldUWP) {
                    throw new Error("T5 Top-Down generation requires a valid mainworldUWP object.");
                }
                // T5 Generator expects the mainworldBase as the anchor
                sys = T5_Generator.generateT5System(mainworldUWP);
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

                const skeleton = skeletonGen(hexId);
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
                // T5 Auditor handles logging internally via writeLogLine if present
                T5_Auditor.runT5SystemAudit(sys);
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

    return { generateSystem };
}));
