// =====================================================================
// CLASSIC TRAVELLER: SYSTEM AUDITOR
// =====================================================================
// Validates a generated CT system against Book 6 Extended Rules.

// Browser-safe imports
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
    walkSystem(sys, (body) => {
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

        // 3. Environmental TL Floor (Book 6 Rule: Subordinates in hostile atmo need TL 7+)
        if (body.type !== 'Mainworld' && body.pop > 0 && ![5, 6, 8].includes(body.atm)) {
            if (body.tl < 7) {
                results.pass = false;
                results.errors.push(`TL Floor Error: Subordinate ${body.type} in hostile atmo ${body.atm} has TL ${body.tl} (Minimum 7 required).`);
                results.checks.push(`[FAIL] TL Floor: ${body.type} lacks required life-support tech.`);
            } else {
                results.checks.push(`[PASS] TL Floor: ${body.type} meets environmental requirements.`);
            }
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
 * Reusable walker to ensure we check orbits, satellites, and captured planets.
 */
function walkSystem(sys, callback) {
    if (!sys.orbits) return;
    sys.orbits.forEach(slot => {
        if (slot.contents) {
            callback(slot.contents, slot.orbit);
            if (slot.contents.satellites) {
                slot.contents.satellites.forEach(sat => callback(sat, slot.orbit));
            }
        }
    });
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(p => callback(p, p.orbit));
    }
}

// Export for both Node.js and Browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auditCTSystem };
} else {
    if (typeof window !== 'undefined') {
        window.auditCTSystem = auditCTSystem;
        window.CT_Auditor = { auditCTSystem };
    }
}
