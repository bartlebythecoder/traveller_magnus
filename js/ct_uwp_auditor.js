// =====================================================================
// CLASSIC TRAVELLER: SYSTEM AUDITOR
// =====================================================================
// Validates a generated CT system against Book 6 Extended Rules.

// Browser-safe imports.
//
// This file previously also declared its own local `function walkSystem(sys, callback) {...}`
// (a stale duplicate, missing the "RECURSE into nested systems (Far Companions)" block
// ct_bottomup_generator.js's real walkSystem has). In a classic (non-module) browser script,
// ALL top-level function/var declarations across every loaded <script> share one global
// environment — so that local declaration's hoisting unconditionally overwrote
// `window.walkSystem` the instant this file's script began executing, clobbering the good
// version ct_bottomup_generator.js had already set, regardless of load order. The `else`
// branch below then read `window.walkSystem` back — but by then it was already reading its
// own clobbered value, not ct_bottomup_generator.js's. Every consumer of the shared
// `walkSystem` identifier (including code *inside* ct_bottomup_generator.js itself, like
// designateMainworld — which resolves the bare identifier dynamically at call time via the
// global scope, not at definition time) silently lost nested-system recursion the moment this
// script loaded. Dormant until a Far companion's own bodies were the only mainworld-eligible
// candidates in the system (OW-19) — previously CT never populated Far-companion nested
// systems with real bodies at all, so this always walked an empty branch unnoticed.
var walkSystem;
if (typeof module !== 'undefined' && module.exports) {
    const bottomUp = require('./ct_bottomup_generator.js');
    walkSystem = bottomUp.walkSystem;
} else {
    walkSystem = (typeof window !== 'undefined' && window.walkSystem) ? window.walkSystem : null;
}

/**
 * Audits a generated system object.
 * Returns an object with 'pass' (boolean) and 'errors' (array of strings).
 */
function auditCTSystem(sys) {
    if (!sys) return { pass: false, errors: ["No system provided for audit."] };

    let results = {
        pass: true,
        errors: [],
        checks: []
    };

    let mainworldCount = 0;
    let mainworldRef = null;

    // First Pass: Find the Mainworld
    walkSystem(sys, (body) => {
        if (body.type === 'Mainworld') {
            mainworldCount++;
            mainworldRef = body;
        }
    });

    // Rule: Exactly 1 Mainworld
    if (mainworldCount === 1) {
        results.checks.push(`[PASS] Mainworld Count: 1 detected.`);
    } else {
        results.pass = false;
        results.errors.push(`Mainworld count error: found ${mainworldCount}, expected 1.`);
        results.checks.push(`[FAIL] Mainworld Count: ${mainworldCount} detected.`);
    }

    if (!mainworldRef) return results;

    const mwPop = mainworldRef.pop || 0;
    const mwTL = mainworldRef.tl || 0;

    // Second Pass: Audit all bodies
    walkSystem(sys, (body, slotName) => {
        if (!body || body.type === 'Empty') return;

        // 1. Social Integrity (Pop 0 means no civilization)
        if (body.pop === 0) {
            if (body.gov !== 0 || body.law !== 0 || (body.tl !== 0 && body.type !== 'Mainworld')) {
                 results.pass = false;
                 results.errors.push(`Social Integrity Error: ${body.type} at ${body.orbit || 'captured'} has Pop 0 but Gov/Law/TL is not 0.`);
                 results.checks.push(`[FAIL] Social Integrity: ${body.type} has invalid social stats.`);
            }
        }

        // 2. Population Cap (Subordinate < Mainworld)
        // Note: Planetoids and Gas Giants are exempt from standard pop rules usually
        if (body.type !== 'Mainworld' && body.type !== 'Gas Giant' && body.size !== 'R') {
            if (body.pop >= mwPop && mwPop > 0) {
                results.pass = false;
                results.errors.push(`Pop Cap Error: Subordinate ${body.type} has Pop ${body.pop}, which equals or exceeds Mainworld Pop ${mwPop}.`);
                results.checks.push(`[FAIL] Pop Cap: ${body.type} exceeds Mainworld population.`);
            } else {
                results.checks.push(`[PASS] Pop Cap: ${body.type} pop is below Mainworld.`);
            }
        }

        // 3. Environmental TL Floor (Subordinate Worlds Only)
        if (body.type !== 'Mainworld' && body.pop > 0 && body.tl < 7 && ![5, 6, 8].includes(body.atm)) {
            results.pass = false;
            results.errors.push(`Subordinate TL Error: ${body.type} at ${slotName} has Atm ${body.atm} and TL ${body.tl} (TL 7 minimum required).`);
            results.checks.push(`[FAIL] TL Floor: ${body.type} lacks required life-support tech.`);
        } else if (body.type !== 'Mainworld' && body.pop > 0) {
            results.checks.push(`[PASS] TL Floor: ${body.type} meets environmental requirements.`);
        }

        // 4. Planetoid Belt Integrity
        if (body.type === 'Planetoid Belt') {
            if (body.size !== 0) {
                results.pass = false;
                results.errors.push(`Geometry Error: Planetoid Belt has size ${body.size} (must be 0).`);
                results.checks.push(`[FAIL] Belt Geometry: Size is ${body.size}.`);
            }
        }
    });

    return results;
}

/**
 * Runs the CT UWP Auditor and logs/backlogs any failures. Mirrors
 * MgT2E_UWP_Auditor.runAndLog's role (js/mgt2e_uwp_auditor.js) — attaches the audit
 * result to sys.auditResult (the field system_editor.js's Fill & Save OW-3 gate reads)
 * and pushes failures to the global audit backlog with a consistent shape. CT's errors
 * are plain strings (not MgT2E's {orbitId, message} objects), so orbitId is always null.
 */
function runAndLog(sys, hexId) {
    const results = auditCTSystem(sys);
    sys.auditResult = results;

    if (!results.pass) {
        const errorSummary = results.errors.map(e => `  • ${e}`).join('\n');
        console.warn(`[CT Auditor] System ${hexId} — ${results.errors.length} violation(s):\n${errorSummary}`);

        if (typeof window !== 'undefined') {
            window.auditBacklog = window.auditBacklog || [];
            results.errors.forEach(err => {
                window.auditBacklog.push({ hexId, orbitId: null, engine: 'CT', message: err });
            });
        }
    }

    return results;
}

// Export for both Node.js and Browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auditCTSystem, runAndLog };
} else {
    if (typeof window !== 'undefined') {
        window.auditCTSystem = auditCTSystem;
        window.CT_Auditor = { auditCTSystem, runAndLog };
    }
}
