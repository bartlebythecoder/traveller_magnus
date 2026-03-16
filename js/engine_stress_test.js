// =====================================================================
// CLASSIC TRAVELLER: ENGINE STRESS TEST & AUDIT
// =====================================================================
// Mock global dice rollers for standalone execution
global.tRoll1D = (label) => Math.floor(Math.random() * 6) + 1;
global.tRoll2D = (label) => Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;

const { generateSystem } = require('./ct_system_driver');
const { auditCTSystem } = require('./ct_uwp_auditor');

const TEST_SAMPLES = 100;
let auditLog = {
    pass: 0,
    fail: 0,
    errors: []
};

function runAudit() {
    console.log(`Starting Stress Test: ${TEST_SAMPLES} systems...\n`);

    for (let i = 0; i < TEST_SAMPLES; i++) {
        // Test both modes
        const mode = i % 2 === 0 ? 'bottom-up' : 'top-down';
        const params = mode === 'bottom-up'
            ? { mode: 'bottom-up', hexId: `Test-${i}` }
            : { mode: 'top-down', mainworldUWP: { pop: 8, gov: 5, law: 7, tl: 12, atm: 6, size: 8, hydro: 5 } };

        const system = generateSystem(params);
        
        // Use the centralized auditor
        const audit = system.audit;
        if (audit.pass) {
            auditLog.pass++;
        } else {
            auditLog.fail++;
            audit.errors.forEach(err => {
                auditLog.errors.push(`System [${i} - ${mode}]: ${err}`);
            });
        }
    }

    console.log(`\n--- TEST SUMMARY ---`);
    console.log(`Total Systems Generated: ${TEST_SAMPLES}`);
    console.log(`Total Audits Passed: ${auditLog.pass}`);
    console.log(`Total Audits Failed: ${auditLog.fail}`);

    if (auditLog.errors.length > 0) {
        console.log(`\n--- ERROR LOG (First 50) ---`);
        auditLog.errors.slice(0, 50).forEach(err => console.error(err));
    }
}

runAudit();