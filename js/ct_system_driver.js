// =====================================================================
// CLASSIC TRAVELLER: SYSTEM ORCHESTRATOR
// =====================================================================

// Browser-safe imports
var systemSkeletonGen, socialProcessor, topDownGen, auditor, auConst;

if (typeof module !== 'undefined' && module.exports) {
    const { generateSystemSkeleton, processBottomUpSocial } = require('./ct_bottomup_generator.js');
    const { generateTopDownSystem } = require('./ct_topdown_generator.js');
    const { auditCTSystem } = require('./ct_uwp_auditor.js');
    const { ORBIT_AU } = require('./ct_constants.js');
    
    systemSkeletonGen = generateSystemSkeleton;
    socialProcessor = processBottomUpSocial;
    topDownGen = generateTopDownSystem;
    auditor = auditCTSystem;
    auConst = ORBIT_AU;
} else {
    // In browser, these come from scripts included in hex_map.html
    systemSkeletonGen = typeof generateSystemSkeleton !== 'undefined' ? generateSystemSkeleton : null;
    socialProcessor = typeof processBottomUpSocial !== 'undefined' ? processBottomUpSocial : null;
    topDownGen = typeof generateTopDownSystem !== 'undefined' ? generateTopDownSystem : null;
    auditor = typeof auditCTSystem !== 'undefined' ? auditCTSystem : null;
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
 * @returns {Object} The generated system object.
 */
function generateSystem(params) {
    const { mode, mainworldUWP, primaryStar, hexId } = params;

    let sys = null;
    if (mode === 'top-down') {
        if (!mainworldUWP) {
            throw new Error("Top-Down generation requires a valid mainworldUWP object.");
        }
        sys = topDownGen(mainworldUWP, primaryStar);
    } 
    else if (mode === 'bottom-up') {
        const skeleton = systemSkeletonGen(hexId);
        sys = socialProcessor(skeleton);
    }

    if (sys) {
        sys.audit = auditor(sys);
        if (typeof writeLogLine !== 'undefined') {
            writeLogLine("=====================================================================");
            writeLogLine("SYSTEM AUDIT RESULTS");
            sys.audit.checks.forEach(c => writeLogLine(c));
            if (sys.audit.errors.length > 0) {
                sys.audit.errors.forEach(e => writeLogLine(`[ERROR] ${e}`));
            }
            writeLogLine("=====================================================================");
        }
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
