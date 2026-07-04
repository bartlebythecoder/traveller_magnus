// =====================================================================
// CLASSIC TRAVELLER: SYSTEM ORCHESTRATOR
// =====================================================================

// Browser-safe imports
var systemSkeletonGen, socialProcessor, topDownGen, auditor, auditRunAndLog, auConst;

if (typeof module !== 'undefined' && module.exports) {
    const { generateSystemSkeleton, processBottomUpSocial } = require('./ct_bottomup_generator.js');
    const { generateTopDownSystem } = require('./ct_topdown_generator.js');
    const { auditCTSystem, runAndLog } = require('./ct_uwp_auditor.js');
    const { ORBIT_AU } = require('./ct_constants.js');

    systemSkeletonGen = generateSystemSkeleton;
    socialProcessor = processBottomUpSocial;
    topDownGen = generateTopDownSystem;
    auditor = auditCTSystem;
    auditRunAndLog = runAndLog;
    auConst = ORBIT_AU;
} else {
    // In browser, these are resolved at script load time.
    systemSkeletonGen = typeof generateSystemSkeleton !== 'undefined' ? generateSystemSkeleton : null;
    socialProcessor = typeof processBottomUpSocial !== 'undefined' ? processBottomUpSocial : null;
    topDownGen = typeof generateTopDownSystem !== 'undefined' ? generateTopDownSystem : null;
    auditor = typeof auditCTSystem !== 'undefined' ? auditCTSystem : null;
    auditRunAndLog = (typeof window !== 'undefined' && window.CT_Auditor && window.CT_Auditor.runAndLog)
        ? window.CT_Auditor.runAndLog : null;
    auConst = typeof ORBIT_AU !== 'undefined' ? ORBIT_AU : 149597870;
}

/**
 * Main entry point for Classic Traveller system generation.
 * Supports both unbiased "Bottom-Up" and biased "Top-Down" modes.
 *
 * @param {Object} params - Configuration for generation.
 * @param {string} params.mode - 'bottom-up' or 'top-down'.
 * @param {Object} [params.mainworldUWP] - Required for 'top-down'.
 * @param {Object} [params.primaryStar] - Optional for 'top-down'.
 * @param {string} [params.hexId] - Seed or identification string.
 * @param {Object} [params.seedSys=null] - Optional seed from the System Editor. When null,
 *   generation is fully stochastic (all existing macro calls). When provided:
 *   - seedSys.stars / seedSys.orbits are used instead of rolling
 *   - seedSys._mainworldRef: _id of the body to designate as mainworld
 *   - seedSys._allowAddBodies: controls whether skeleton placement is skipped
 * @returns {Object} The generated system object.
 */
function generateSystem(params) {

    const { mode, mainworldUWP, primaryStar, hexId, seedSys = null } = params;

    let sys = null;
    if (mode === 'top-down') {
        if (!mainworldUWP) {
            throw new Error("Top-Down generation requires a valid mainworldUWP object.");
        }
        sys = topDownGen(mainworldUWP, primaryStar);
    }
    else if (mode === 'bottom-up') {
        const skeleton = systemSkeletonGen(hexId, seedSys);

        // If seedSys designates a mainworld, find the body by _id and pre-set it so
        // processBottomUpDesignation uses the Fixed Anchor path instead of electing.
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

        sys = socialProcessor(skeleton);
    }

    if (sys) {
        if (hexId) sys.hexId = sys.hexId || hexId;
        sys.audit = auditRunAndLog ? auditRunAndLog(sys, hexId) : auditor(sys);
        if (typeof writeLogLine !== 'undefined') {
            writeLogLine("=====================================================================");
            writeLogLine("SYSTEM AUDIT RESULTS");
            sys.audit.checks.forEach(c => writeLogLine(c));
            if (sys.audit.errors.length > 0) {
                sys.audit.errors.forEach(e => writeLogLine(`[ERROR] ${e}`));
            }
            writeLogLine("=====================================================================");
        }
        if (typeof applyCTOrbitalNames === 'function') applyCTOrbitalNames(sys);
        return sys;
    }

    throw new Error(`Invalid generation mode: ${mode}. Use 'bottom-up' or 'top-down'.`);
}

// Export for both Node.js and Browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateSystem };
} else {
    // In browser, attach to a global namespace
    window.CT_Generator = { generateSystem };
}
