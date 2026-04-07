/**
 * js/mgt2e_uwp_auditor.js
 * * MGT2E UWP AUDITOR
 * Validates MgT2E system generation and enforces technical and RPG constraints.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MgT2E_UWP_Auditor = factory();
    }
}(this, function () {

    // Fallback UWP Helpers if not globally available
    const EHEX_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skips I and O
    const toUWPChar = (val) => {
        if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return '0';
        val = Math.floor(val);
        if (val < 0) return '0';
        if (val < 10) return val.toString();
        return EHEX_CHARS[val - 10] || 'Z';
    };
    const fromUWPChar = (char) => {
        if (!char) return 0;
        const c = char.toUpperCase();
        if (c >= '0' && c <= '9') return parseInt(c);
        const idx = EHEX_CHARS.indexOf(c);
        if (idx >= 0) return idx + 10;
        return 0;
    };

    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;
    const _tSection = (typeof tSection === 'function') ? tSection : () => { };
    const _tResult = (typeof tResult === 'function') ? tResult : () => { };

    /**
     * Helper to get minimum sustainable Tech Level for a given atmosphere code.
     * Aligns with the core socio engine logic.
     * @param {number} atmCode - Atmosphere code (0-17)
     * @returns {number} Minimum TL required for survival
     */
    function getMgT2EMinSusTL(atmCode) {
        if (!MgT2EData || !MgT2EData.techLevel || !MgT2EData.techLevel.environmentalMinimums) return 0;
        return MgT2EData.techLevel.environmentalMinimums[atmCode] || 0;
    }

    /**
     * Re-calculates Mongoose 2E Trade Codes to verify against output
     */
    function verifyTradeCodes(w) {
        let codes = [];
        const atm = w.atmCode !== undefined ? w.atmCode : w.atm;
        const hydro = w.hydroCode !== undefined ? w.hydroCode : w.hydro;
        const pop = w.popCode !== undefined ? w.popCode : w.pop;
        const gov = w.govCode !== undefined ? w.govCode : w.gov;
        const size = w.size;
        const tl = w.tl;

        const data = MgT2EData.tradeCodes;
        const check = (code, cond) => {
            if (cond) codes.push(code);
        };

        // Ag: Agricultural
        const cAg = data.Ag;
        check('Ag', atm >= cAg.minAtm && atm <= cAg.maxAtm && hydro >= cAg.minHydro && hydro <= cAg.maxHydro && pop >= cAg.minPop && pop <= cAg.maxPop);

        // As: Asteroid
        const cAs = data.As;
        check('As', size === cAs.minSize && atm === cAs.minAtm && hydro === cAs.minHydro);

        // Ba: Barren
        const cBa = data.Ba;
        check('Ba', pop === cBa.minPop && gov === cBa.minGov && w.law === cBa.minLaw);

        // De: Desert
        const cDe = data.De;
        check('De', atm >= cDe.minAtm && atm <= cDe.maxAtm && hydro === cDe.minHydro);

        // Fl: Fluid Oceans
        const cFl = data.Fl;
        check('Fl', atm >= cFl.minAtm && hydro >= cFl.minHydro);

        // Ga: Garden
        const cGa = data.Ga;
        check('Ga', size >= cGa.minSize && size <= cGa.maxSize && cGa.validAtms.includes(atm) && hydro >= cGa.minHydro && hydro <= cGa.maxHydro);

        // Hi: High Population
        const cHi = data.Hi;
        check('Hi', pop >= cHi.minPop);

        // Ht: High Tech
        const cHt = data.Ht;
        check('Ht', tl >= cHt.minTl);

        // Ic: Ice Capped
        const cIc = data.Ic;
        check('Ic', atm >= cIc.minAtm && atm <= cIc.maxAtm && hydro >= cIc.minHydro);

        // In: Industrial
        const cIn = data.In;
        check('In', cIn.validAtms.includes(atm) && pop >= cIn.minPop);

        // Lo: Low Population
        const cLo = data.Lo;
        check('Lo', pop >= cLo.minPop && pop <= cLo.maxPop);

        // Lt: Low Tech
        const cLt = data.Lt;
        check('Lt', tl >= cLt.minTl && tl <= cLt.maxTl);

        // Na: Non-Agricultural
        const cNa = data.Na;
        check('Na', atm >= cNa.minAtm && atm <= cNa.maxAtm && hydro >= cNa.minHydro && hydro <= cNa.maxHydro && pop >= cNa.minPop);

        // Ni: Non-Industrial
        const cNi = data.Ni;
        check('Ni', pop >= cNi.minPop && pop <= cNi.maxPop);

        // Po: Poor
        const cPo = data.Po;
        check('Po', atm >= cPo.minAtm && atm <= cPo.maxAtm && hydro >= cPo.minHydro && hydro <= cPo.maxHydro);

        // Ri: Rich
        const cRi = data.Ri;
        check('Ri', cRi.validAtms.includes(atm) && pop >= cRi.minPop && pop <= cRi.maxPop && gov >= cRi.minGov && gov <= cRi.maxGov);

        // Va: Vacuum
        const cVa = data.Va;
        check('Va', atm === cVa.minAtm);

        // Wa: Water World
        const cWa = data.Wa;
        check('Wa', hydro >= cWa.minHydro && ( (atm >= cWa.atmRanges[0][0] && atm <= cWa.atmRanges[0][1]) || (atm >= cWa.atmRanges[1][0] && atm <= cWa.atmRanges[1][1]) ));

        // Sa: Satellite (Sean Protocol: Moon-Mainworld Sync)
        check('Sa', w.isMoon || w.isSatellite || w.type === 'Satellite' || (w.parentType === 'Gas Giant' || w.parentBody === 'Gas Giant'));

        return codes;
    }

    function auditMgT2ESystem(sys, options = { mode: 'top-down' }) {
        if (!sys) return { pass: false, errors: ["No system provided for audit."], checks: [] };

        let results = { pass: true, errors: [], checks: [] };
        let totalErrors = 0;

        _tSection('MgT2E System Audit');

        // --- 0. Recursive World Collector ---
        let allWorlds = [];
        let mainworldCount = 0;
        let mainworldBase = null;

        const collectWorlds = (worlds) => {
            worlds.forEach(w => {
                allWorlds.push(w);
                if (w.type === 'Mainworld' || w.isLunarMainworld) {
                    mainworldCount++;
                    mainworldBase = w;
                }
                if (w.moons && w.moons.length > 0) {
                    collectWorlds(w.moons);
                }
            });
        };
        collectWorlds(sys.worlds);

        // --- 1. Structure & Mainworld Audit ---
        if (options.mode === 'top-down') {
            if (mainworldCount === 1) {
                _log('[PASS] Structure: Exactly 1 Mainworld present.');
                results.checks.push('[PASS] Structure: Exactly 1 Mainworld present.');
            } else {
                const msg = `Structure: Expected exactly 1 Mainworld, found ${mainworldCount}.`;
                _log(`[FAIL] ${msg}`);
                results.checks.push(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: null, message: msg });
                totalErrors++;
            }
        }

        // --- 2. Physicals & Inner Limit Audit ---
        _tSection('Physical & Orbital Audit');
        let physErrors = 0;
        const innerLimit = sys.ptypeInnerLimit || 0;

        allWorlds.forEach(w => {
            if (w.type === 'Empty') return;

            // Inner Limit Check (Only applicable to primary orbits, not moons)
            if (!w.isMoon && w.orbitId !== undefined && w.orbitId < innerLimit) {
                const msg = `Orbit Violation: World at orbit ${w.orbitId} is inside the star's destroying inner limit (${innerLimit}).`;
                _log(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: w.orbitId, message: msg });
                physErrors++;
            }

            // Size 0 checks
            if (w.size === 0 && w.type !== 'Planetoid Belt' && w.type !== 'Gas Giant') {
                const atm = w.atmCode !== undefined ? w.atmCode : w.atm;
                const hydro = w.hydroCode !== undefined ? w.hydroCode : w.hydro;
                if (atm !== 0 || hydro !== 0) {
                    const msg = `Natural Physics Violation: Size 0 world at orbit ${w.orbitId || 'Moon'} has Atm ${atm} and Hydro ${hydro} (Both must be 0).`;
                    _log(`[FAIL] ${msg}`);
                    results.errors.push({ orbitId: w.orbitId || null, message: msg });
                    physErrors++;
                }
            }
        });

        if (physErrors === 0) _log('[PASS] Physics: All physical dependencies and orbital limits align.');
        totalErrors += physErrors;

        // --- 3. Demographic & Population Cap Audit ---
        _tSection('Demographic Audit');
        let popErrors = 0;
        const mwPop = mainworldBase ? (mainworldBase.popCode !== undefined ? mainworldBase.popCode : mainworldBase.pop) : 0;

        allWorlds.forEach(w => {
            if (w.type === 'Empty' || w.type === 'Mainworld' || w.isLunarMainworld || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

            const pop = w.popCode !== undefined ? w.popCode : w.pop;

            // Pop Cap Check (Strictly less than Mainworld unless Mainworld is Pop 0)
            if (mwPop > 0 && pop >= mwPop) {
                const msg = `Population Cap: Subordinate world at orbit ${w.orbitId || 'Moon'} has Pop ${pop}, which is >= Mainworld Pop ${mwPop}.`;
                _log(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: w.orbitId || null, message: msg });
                popErrors++;
            }

            // Pop 0 Rules
            if (pop === 0) {
                const gov = w.govCode !== undefined ? w.govCode : w.gov;
                if (gov !== 0 || w.law !== 0 || w.tl !== 0) {
                    const msg = `Pop 0 Rules: World at orbit ${w.orbitId || 'Moon'} has Pop 0 but Gov/Law/TL are not 0.`;
                    _log(`[FAIL] ${msg}`);
                    results.errors.push({ orbitId: w.orbitId || null, message: msg });
                    popErrors++;
                }
            }
        });

        if (popErrors === 0) _log('[PASS] Demographics: Subordinate populations and Pop 0 rules respected.');
        totalErrors += popErrors;

        // --- 4. Tech Level Boundaries ---
        _tSection('Tech Level Audit');
        let tlErrors = 0;
        const mwTL = (mainworldBase && mainworldBase.tl !== undefined) ? mainworldBase.tl : 0;

        allWorlds.forEach(w => {
            if (w.type === 'Empty' || w.type === 'Mainworld' || w.isLunarMainworld || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

            const pop = w.popCode !== undefined ? w.popCode : w.pop;
            if (pop === 0) return; // Handled above

            // Identify Classification
            const hasMilitary = w.militaryBase || w.navalBase || (w.classifications && w.classifications.includes("Military Base"));
            const hasResearch = w.researchBase || (w.classifications && w.classifications.includes("Research Base"));
            const hasMining = (w.classifications && (w.classifications.includes("Mining") || w.classifications.includes("Mining Facility")));
            const isFarming = (w.classifications && w.classifications.includes("Farming"));
            const isPenal = (w.classifications && w.classifications.includes("Penal Colony"));

            let classification = "Colony";
            if (hasMilitary) classification = "Military Base";
            else if (hasResearch) classification = "Research Base";
            else if (hasMining) classification = "Mining";
            else if (isFarming) classification = "Farming";
            else if (isPenal) classification = "Penal Colony";

            // Determine survival floor and social guidelines
            const atm = w.atmCode !== undefined ? w.atmCode : (w.atm !== undefined ? w.atm : 0);
            const floor = getMgT2EMinSusTL(atm);
            const guideline = Math.max(0, mwTL - 1);

            // Validation Logic:
            if (floor > mwTL && classification !== 'Mainworld') {
                 // Generator should have zeroed this world to uninhabited. Pop > 0 here is a
                 // generation failure — the safety-net in finalizeSubordinateSocial didn't catch it.
                 const msg = `Uninhabited Environment Violation (${classification}): Orbit ${w.orbitId || 'Moon'} requires Floor ${floor} but Mainworld TL is ${mwTL}. World has Pop > 0 but should be uninhabited.`;
                 _log(`[FAIL] ${msg}`);
                 results.errors.push({ orbitId: w.orbitId || null, message: msg });
                 tlErrors++;
            } else if (w.tl < floor) {
                 const msg = `TL Guideline (${classification}): Orbit ${w.orbitId || 'Moon'} has TL ${w.tl} < Floor ${floor}. Survives via Jury-Rigged Relics (Novelty TL).`;
                 _log(`[PASS] ${msg}`);
                 results.checks.push(`[PASS] ${msg}`);
            } else if (w.tl < guideline && floor <= guideline) {
                 const msg = `TL Violation (${classification}): Orbit ${w.orbitId || 'Moon'} has TL ${w.tl} but standard Guideline (MW-1) is ${guideline}.`;
                 _log(`[FAIL] ${msg}`);
                 results.errors.push({ orbitId: w.orbitId || null, message: msg });
                 tlErrors++;
            }
            // Note: If TL is higher than MW-1 because it is matching the Floor, this is a PASS.
        });

        if (tlErrors === 0) _log('[PASS] Tech Levels: All subordinate TL requirements and guidelines align.');
        totalErrors += tlErrors;

        // --- 5. Starports & Bases ---
        _tSection('Installations Audit');
        let baseErrors = 0;

        allWorlds.forEach(w => {
            if (!w.starport) return;

            if (w.navalBase && !['A', 'B'].includes(w.starport)) {
                const msg = `Base Rules: Naval Base found on Starport ${w.starport} at orbit ${w.orbitId || 'Moon'}.`;
                _log(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: w.orbitId || null, message: msg });
                baseErrors++;
            }
            if (w.scoutBase && !['A', 'B', 'C', 'D'].includes(w.starport)) {
                const msg = `Base Rules: Scout Base found on Starport ${w.starport} at orbit ${w.orbitId || 'Moon'}.`;
                _log(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: w.orbitId || null, message: msg });
                baseErrors++;
            }
        });

        if (baseErrors === 0) _log('[PASS] Installations: All Starports and Bases are legal combinations.');
        totalErrors += baseErrors;

        // --- 6. Data Integrity & Trade Codes ---
        _tSection('Data Integrity Audit');
        let dataErrors = 0;

        allWorlds.forEach(w => {
            if (w.type !== 'Mainworld' && !w.isLunarMainworld) return;

            // UWP String validation
            const uwp = w.uwpSecondary || w.uwp;
            if (!uwp || uwp.length < 9) {
                const msg = `Data Integrity: Malformed UWP string "${uwp}" at orbit ${w.orbitId || 'Moon'}.`;
                _log(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: w.orbitId || null, message: msg });
                dataErrors++;
            }

            // Trade Codes
            const expectedCodes = verifyTradeCodes(w);
            const actualCodes = w.tradeCodes || [];

            // Sort to compare
            const expSorted = [...expectedCodes].sort();
            const actSorted = [...actualCodes].sort();

            if (expSorted.join(' ') !== actSorted.join(' ')) {
                const label = w.isLunarMainworld ? 'Lunar Mainworld' : 'Mainworld';
                const msg = `Trade Codes: ${label} at orbit ${w.orbitId || 'Moon'} generated [${actSorted.join(' ')}] but physics dictate [${expSorted.join(' ')}].`;
                _log(`[FAIL] ${msg}`);
                results.errors.push({ orbitId: w.orbitId || null, message: msg });
                dataErrors++;
            }
        });

        if (dataErrors === 0) _log('[PASS] Data Integrity: UWP formatting and Trade Codes perfectly match physics.');
        totalErrors += dataErrors;

        // Final Summary
        if (totalErrors === 0) {
            results.pass = true;
            _log('MgT2E Audit Summary: ALL CLEAR');
            results.checks.push('MgT2E Audit Summary: ALL CLEAR');
        } else {
            results.pass = false;
            _log(`MgT2E Audit Summary: FAILED with ${totalErrors} strict violations.`);
            results.checks.push(`MgT2E Audit Summary: FAILED with ${totalErrors} strict violations.`);
        }

        return results;
    }

    return {
        auditMgT2ESystem
    };
}));