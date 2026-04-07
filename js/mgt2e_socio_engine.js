/**
 * PROJECT AS ABOVE, SO BELOW
 * MGT2E SOCIO ENGINE - Social & Economic Generation Module
 * 
 * This module contains the core social/economic generation functions:
 * - generateCoreSocial: UWP generation (Pop, Starport, Gov, Law, TL, Bases, Trade Codes)
 * - generateExtendedSocioeconomics: Detailed profiles (Gov, Law, Tech, Culture, Economy, Military)
 * - finalizeSubordinateSocial: Secondary world classifications (Mining, Farming, etc.)
 * 
 * Architectural Compliance:
 * - All RPG mechanics pulled from MgT2EData (Data Shield)
 * - All physics calculations via MgT2EMath (Math Chassis)
 * - State mutation pattern (sys object passed & returned)
 * - Comprehensive trace logging (tSection, tRoll2D, tDM, tResult, tSkip)
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
        factory(exports);
    } else {
        factory((root.MgT2ESocioEngine = {}));
    }
}(typeof self !== 'undefined' ? self : this, function (exports) {
    'use strict';

    // =====================================================================
    // HELPER FUNCTIONS
    // =====================================================================

    /**
     * Get minimum sustainable tech level for a given atmosphere code
     * @param {number} atmCode - Atmosphere code (0-17)
     * @returns {number} Minimum TL required for survival
     */
    function getMgT2EMinSusTL(atmCode) {
        const envTL = MgT2EData.techLevel.environmentalMinimums;
        return envTL[atmCode] || 0;
    }

    /**
     * Calculate MgT2E Trade Codes for a world using the Data Shield
     * @param {Object} w - World object with size, atm, hydro, pop, gov, law, tl
     * @returns {Array} Array of trade code strings
     */
    function calculateMgT2ETradeCodes(w) {
        if (w.isRuin) {
            tSection('Trade Classifications (Ruin Override)');
            tTrade('Ba', 'World is a Ruin (Floor > MW TL)');
            tResult('Final Trade Codes', 'Ba');
            return ['Ba'];
        }
        const codes = [];
        const data = MgT2EData.tradeCodes;
        const atm = w.atmCode !== undefined ? w.atmCode : (w.atm !== undefined ? w.atm : 0);
        const hydro = w.hydroCode !== undefined ? w.hydroCode : (w.hydro !== undefined ? w.hydro : 0);
        const pop = w.popCode !== undefined ? w.popCode : (w.pop !== undefined ? w.pop : 0);
        const gov = w.govCode !== undefined ? w.govCode : (w.gov !== undefined ? w.gov : 0);
        const law = w.law !== undefined ? w.law : 0;
        const size = w.size !== undefined ? w.size : 0;
        const tl = w.tl !== undefined ? w.tl : 0;

        tSection('Trade Classifications');

        const check = (code, cond, reason) => {
            if (cond) {
                codes.push(code);
                tTrade(code, reason);
            }
        };

        // Ag: Agricultural
        const cAg = data.Ag;
        check('Ag', atm >= cAg.minAtm && atm <= cAg.maxAtm && hydro >= cAg.minHydro && hydro <= cAg.maxHydro && pop >= cAg.minPop && pop <= cAg.maxPop, `Atm ${cAg.minAtm}-${cAg.maxAtm}, Hyd ${cAg.minHydro}-${cAg.maxHydro}, Pop ${cAg.minPop}-${cAg.maxPop}`);

        // As: Asteroid
        const cAs = data.As;
        check('As', size === cAs.minSize && atm === cAs.minAtm && hydro === cAs.minHydro, `Size ${cAs.minSize}, Atm ${cAs.minAtm}, Hyd ${cAs.minHydro}`);

        // Ba: Barren
        const cBa = data.Ba;
        check('Ba', pop === cBa.minPop && gov === cBa.minGov && law === cBa.minLaw, `Pop ${cBa.minPop}, Gov ${cBa.minGov}, Law ${cBa.minLaw}`);

        // De: Desert
        const cDe = data.De;
        check('De', atm >= cDe.minAtm && atm <= cDe.maxAtm && hydro === cDe.minHydro, `Atm ${cDe.minAtm}-${cDe.maxAtm}, Hyd ${cDe.minHydro}`);

        // Fl: Fluid Oceans
        const cFl = data.Fl;
        check('Fl', atm >= cFl.minAtm && hydro >= cFl.minHydro, `Atm ${cFl.minAtm}+, Hyd ${cFl.minHydro}+`);

        // Ga: Garden
        const cGa = data.Ga;
        check('Ga', size >= cGa.minSize && size <= cGa.maxSize && cGa.validAtms.includes(atm) && hydro >= cGa.minHydro && hydro <= cGa.maxHydro, `Siz ${cGa.minSize}-${cGa.maxSize}, Atm ${cGa.validAtms.join(',')}, Hyd ${cGa.minHydro}-${cGa.maxHydro}`);

        // Hi: High Population
        const cHi = data.Hi;
        check('Hi', pop >= cHi.minPop, `Pop ${cHi.minPop}+`);

        // Ht: High Tech
        const cHt = data.Ht;
        check('Ht', tl >= cHt.minTl, `TL ${cHt.minTl}+`);

        // Ic: Ice Capped
        const cIc = data.Ic;
        check('Ic', atm <= cIc.maxAtm && hydro >= cIc.minHydro, `Atm ${cIc.minAtm}-${cIc.maxAtm}, Hyd ${cIc.minHydro}+`);

        // In: Industrial
        const cIn = data.In;
        check('In', cIn.validAtms.includes(atm) && pop >= cIn.minPop, `Atm ${cIn.validAtms.join(',')}, Pop ${cIn.minPop}+`);

        // Lo: Low Population
        const cLo = data.Lo;
        check('Lo', pop >= cLo.minPop && pop <= cLo.maxPop, `Pop ${cLo.minPop}-${cLo.maxPop}`);

        // Lt: Low Tech
        const cLt = data.Lt;
        check('Lt', tl <= cLt.maxTl, `TL ${cLt.maxTl}-`);

        // Na: Non-Agricultural
        const cNa = data.Na;
        check('Na', atm <= cNa.maxAtm && hydro <= cNa.maxHydro && pop >= cNa.minPop, `Atm ${cNa.minAtm}-${cNa.maxAtm}, Hyd ${cNa.minHydro}-${cNa.maxHydro}, Pop ${cNa.minPop}+`);

        // Ni: Non-Industrial
        const cNi = data.Ni;
        check('Ni', pop >= cNi.minPop && pop <= cNi.maxPop, `Pop ${cNi.minPop}-${cNi.maxPop}`);

        // Po: Poor
        const cPo = data.Po;
        check('Po', atm >= cPo.minAtm && atm <= cPo.maxAtm && hydro <= cPo.maxHydro, `Atm ${cPo.minAtm}-${cPo.maxAtm}, Hyd ${cPo.maxHydro}-`);

        // Ri: Rich
        const cRi = data.Ri;
        check('Ri', cRi.validAtms.includes(atm) && pop >= cRi.minPop && pop <= cRi.maxPop && gov >= cRi.minGov && gov <= cRi.maxGov, `Atm ${cRi.validAtms.join(',')}, Pop ${cRi.minPop}-${cRi.maxPop}, Gov ${cRi.minGov}-${cRi.maxGov}`);

        // Va: Vacuum
        const cVa = data.Va;
        check('Va', atm === cVa.minAtm, `Atm ${cVa.minAtm}`);

        // Wa: Water World
        const cWa = data.Wa;
        const inAtmRange = cWa.atmRanges.some(r => atm >= r[0] && atm <= r[1]);
        check('Wa', inAtmRange && hydro >= cWa.minHydro, `Atm ${cWa.atmRanges.map(r => r.join('-')).join('/')}, Hyd ${cWa.minHydro}+`);

        // Sa: Satellite (Sean Protocol: Moon-Mainworld Sync)
        check('Sa', w.isMoon || w.isSatellite || w.type === 'Satellite' || (w.parentType === 'Gas Giant' || w.parentBody === 'Gas Giant'), "World is a moon/satellite");

        if (codes.length === 0) tResult('Trade Codes', 'None');
        else tResult('Final Trade Codes', codes.join(' '));

        return codes;
    }

    /**
     * Generate subordinate world social characteristics
     * @param {Object} body - World or moon object
     * @param {Object} mainworld - Mainworld baseline data
     */
    function generateSubordinateSocial(body, mainworld) {
        if (!body || !mainworld) return;
        
        tSection(`Subordinate Physical/Social: ${body.name || body.type}`);

        // 0. Environmental Pass (MgT2E Rule Zero: Fill if missing)
        if (body.size === undefined) {
            body.size = Math.max(0, tRoll1D('Size (1D-3)') - 3);
            tResult('Size', body.size);
        }
        if (body.atmCode === undefined) {
            if (body.size === 0) {
                body.atmCode = 0;
            } else {
                let aRoll = tRoll2D('Atmosphere (2D-7+Size)');
                body.atmCode = Math.max(0, aRoll - 7 + body.size);
            }
            body.atm = body.atmCode;
            tResult('Atmosphere', body.atmCode);
        }
        if (body.hydroCode === undefined) {
            if (body.size <= 1 || body.atmCode <= 1 || body.atmCode >= 10) {
                body.hydroCode = 0;
            } else {
                let hRoll = tRoll2D('Hydrographics (2D-7+Size)');
                body.hydroCode = Math.max(0, hRoll - 7 + (body.atmCode <= 1 ? -10 : 0) + body.size);
                // Note: simplified hydro roll for subordinates
            }
            body.hydro = body.hydroCode;
            tResult('Hydrographics', body.hydroCode);
        }

        // 1. Population
        tSection('Population');
        const systemLimit = Math.max(0, mainworld.pop - roll1D());
        tResult('System Pop Limit (MW Pop - 1D)', systemLimit);

        let popTypeRoll = tRoll1D('Population Presence (5+)');
        if (popTypeRoll >= 5) {
            body.pop = 0;
            tResult('Population', 0);
        } else {
            let pRoll = tRoll1D('Population Value (1D)');
            body.pop = Math.min(systemLimit, pRoll);
            if (pRoll > systemLimit) tClamp('Population', pRoll, body.pop);
            tResult('Population', body.pop);
        }

        // 2. Government
        if (body.pop > 0) {
            tSection('Government');
            let govRoll = tRoll1D('Government');
            if (mainworld.gov === 0) {
                tDM('Mainworld Gov 0', -2);
                govRoll -= 2;
            }
            if (mainworld.gov === 6) {
                tDM(`Mainworld Gov 6 (+MW Pop ${mainworld.pop})`, mainworld.pop);
                govRoll += mainworld.pop;
            }

            if (govRoll <= 1) body.gov = 0;
            else if (govRoll === 2) body.gov = 1;
            else if (govRoll === 3) body.gov = 2;
            else if (govRoll === 4) body.gov = 3;
            else body.gov = 6;
            tResult('Government Code', body.gov);

            // 3. Law Level
            tSection('Law Level');
            if (body.gov === 6) {
                let lRoll = tRoll1D('Law (Captive)');
                if (lRoll <= 4) body.law = mainworld.law;
                else if (lRoll === 5) body.law = mainworld.law + 1;
                else {
                    let offset = tRoll1D('Law Offset');
                    body.law = mainworld.law + offset;
                }
                tResult('Law Level (Captive)', body.law);
            } else if (body.gov >= 1 && body.gov <= 3) {
                tRoll2D('Law (Gov 1-3)');
                tDM('Mainworld Gov', -mainworld.gov);
                let lRoll = pendingRoll.val - mainworld.gov;
                if (lRoll <= 0) {
                    body.law = mainworld.law;
                    tResult('Law Level', 'Matches Mainworld');
                } else {
                    let lawType = tRoll1D('Law Type');
                    if (lawType <= 3) {
                        body.law = tRoll1D('Direct Law');
                    } else {
                        let r = tRoll2D('Relative Law');
                        tDM('Standard Law', -7);
                        tDM('Gov', body.gov);
                        body.law = Math.max(0, r - 7 + body.gov);
                    }
                    tResult('Law Level', body.law);
                }
            } else {
                let r = tRoll2D('Law Level');
                tDM('Standard Law', -7);
                tDM('Gov', body.gov);
                body.law = Math.max(0, r - 7 + body.gov);
                tResult('Law Level', body.law);
            }
        } else {
            tSkip('Pop 0 forces Gov/Law 0');
            body.gov = 0;
            body.law = 0;
        }
        body.law = Math.max(0, Math.min(18, body.law));

        // 4. Spaceport (MgT2E WBH RAW: 1D + Pop DMs)
        tSection('Spaceport');
        let spDM = 0;
        if (body.pop >= 6) { tDM('Population 6+', 2); spDM += 2; }
        else if (body.pop === 1) { tDM('Population 1', -1); spDM -= 1; }
        else if (body.pop === 0) { tDM('Population 0', -3); spDM -= 3; }

        let spRoll = tRoll1D('Spaceport Generation');
        let spTotal = spRoll + spDM;

        if (spTotal >= 6) body.starport = 'F'; // Good
        else if (spTotal >= 4) body.starport = 'G'; // Basic
        else if (spTotal === 3) body.starport = 'H'; // Primitive
        else body.starport = 'Y'; // None

        tResult('Spaceport Class', `${body.starport} (${spTotal})`);

        // 5. Tech Level
        tSection('Tech Level');
        const floor = getMgT2EMinSusTL(body.atmCode);

        if (floor > mainworld.tl) {
            tSection('Uninhabited Reclassification');
            tResult('Tech Level Status', 'Uninhabited (Floor > Mainworld TL — environment unsupportable)');
            body.pop = 0;
            body.gov = 0;
            body.law = 0;
            body.tl = 0;
        } else if (body.pop > 0) {
            const baseline = Math.max(0, mainworld.tl - 1);
            body.tl = baseline; // WBH RAW: Do not bump subordinate UWP TL to meet floor.
            tResult('Baseline Tech Level (Direct Derivation)', body.tl);

            if (body.tl < floor) {
                tResult('Survival State', `Jury-Rigged / Relic Tech (Base TL ${body.tl} < Floor TL ${floor})`);
            }
        } else {
            tSkip('Population 0 forces Tech Level 0');
            body.tl = 0;
        }

        tResult('Final Tech Level', body.tl);

        // Finalize UWP
        syncUWP(body);
    }

    /**
     * Helper to synchronize UWP string with body properties
     */
    function syncUWP(body) {
        if (!body) return;
        
        // Ensure starport is valid MgT2E code (A-X)
        const sp = body.starport || 'X';
        const cSize = clampUWP(body.size || 0, 0, 15);
        const cAtm = clampUWP(body.atmCode !== undefined ? body.atmCode : (body.atm || 0), 0, 17);
        const cHydro = clampUWP(body.hydroCode !== undefined ? body.hydroCode : (body.hydro || 0), 0, 10);
        const cPop = clampUWP(body.pop || 0, 0, 15);
        const cGov = clampUWP(body.gov || 0, 0, 15);
        const cLaw = clampUWP(body.law || 0, 0, 15);
        const cTl = clampUWP(body.tl || 0, 0, 33);

        // Core component persistence (Critical for Hex Editor)
        body.starport = sp;
        body.size = cSize;
        body.atmCode = cAtm;
        body.atm = cAtm;
        body.hydroCode = cHydro;
        body.hydro = cHydro;
        body.popCode = cPop;
        body.pop = cPop;
        body.govCode = cGov;
        body.gov = cGov;
        body.lawCode = cLaw;
        body.law = cLaw;
        body.tlCode = cTl;
        body.tl = cTl;

        const uwp = `${sp}${toUWPChar(cSize)}${toUWPChar(cAtm)}${toUWPChar(cHydro)}${toUWPChar(cPop)}${toUWPChar(cGov)}${toUWPChar(cLaw)}-${toUWPChar(cTl)}`;
        body.uwp = uwp;
        body.uwpSecondary = uwp;
    }

    /**
     * Refreshes a body's social stats (UWP, trade codes, bases) using the provided mainworld baseline.
     * This is critical for ensuring demoted Mainworlds (moons) maintain their correct identity.
     */
    function refreshMainworldSocialInPlace(w, mainworldBase) {
        if (!w || !mainworldBase) return;
        
        tSection(`Mainworld Social Refresher (Orbit ${w.orbitId !== undefined ? w.orbitId.toFixed(2) : 'Unassigned'})`);
        w.name = mainworldBase.name || (typeof getNextSystemName === 'function' ? getNextSystemName(w.hexId) : 'Unnamed');
        
        // Refresh core stats
        w.size = mainworldBase.size;
        w.atmCode = w.atmCode !== undefined ? w.atmCode : mainworldBase.atm;
        w.hydroCode = w.hydroCode !== undefined ? w.hydroCode : mainworldBase.hydro;
        w.pop = mainworldBase.pop !== undefined ? mainworldBase.pop : 0;
        w.gov = mainworldBase.gov !== undefined ? mainworldBase.gov : 0;
        w.law = mainworldBase.law !== undefined ? mainworldBase.law : 0;
        w.tl = mainworldBase.tl !== undefined ? mainworldBase.tl : 0;
        w.starport = mainworldBase.starport || (w.starport || 'X');

        syncUWP(w); 

        // Apply trade codes (recognizing its status)
        w.tradeCodes = calculateMgT2ETradeCodes(w);

        w.navalBase = mainworldBase.navalBase;
        w.scoutBase = mainworldBase.scoutBase;
        w.militaryBase = mainworldBase.militaryBase;
        w.corsairBase = mainworldBase.corsairBase;
        
        w.gasGiant = w.gasGiant || mainworldBase.gasGiant; 
        w.travelZone = mainworldBase.travelZone || "Green";
        
        tResult('Mainworld UWP Refreshed', w.uwp);
        tResult('Trade Codes Refreshed', w.tradeCodes.join(' '));
    }

    // =====================================================================
    // CORE FUNCTION 1: GENERATE CORE SOCIAL (UWP)
    // =====================================================================

    /**
     * Generate core social characteristics (UWP) for all worlds and moons.
     * Handles Population, Starport, Government, Law, Tech Level, Bases, Trade Codes, and Travel Zone.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object} mainworldBase - Mainworld baseline data
     * @returns {Object} Modified system object
     */
    function generateCoreSocial(sys, mainworldBase) {
        tSection('Core Social Generation (UWP)');

        for (let i = 0; i < sys.worlds.length; i++) {
            let w = sys.worlds[i];
            
            // WBH SEAN PROTOCOL: Process moons FIRST before any continue checks on the parent.
            // This ensures demoted Mainworlds orbiting Gas Giants receive full social generation.
            let moons = w.moons || [];
            for (let j = 0; j < moons.length; j++) {
                let m = moons[j];
                // WBH Logic: If a moon is the Mainworld, we MUST refresh it as the Mainworld
                if (m.type === 'Mainworld' || m.targetWorld === 'Mainworld' || m.isLunarMainworld) {
                    refreshMainworldSocialInPlace(m, mainworldBase);
                } else {
                    // Generate subordinate world social
                    generateSubordinateSocial(m, mainworldBase);
                }
            }

            // Skip logic: Only skip empty/giants if they are NOT the Mainworld or a demoted Mainworld.
            const isAnyMainworld = (w.type === 'Mainworld' || w.targetWorld === 'Mainworld' || w.isLunarMainworld);
            if (!isAnyMainworld && (w.type === 'Empty' || w.type === 'Planetoid Belt' || w.type === 'Gas Giant')) {
                continue;
            }

            if (w.type === 'Mainworld') {
                refreshMainworldSocialInPlace(w, mainworldBase);
                // Action 4.4: Gas Giant Trace Logging (Selection Process)
                if (w.gasGiant && window.isLoggingEnabled) {
                    let ggVariant = 'SOLID';
                    let reason = 'Default (Solid)';
                    if (w.tradeCodes && w.tradeCodes.includes('Sa')) {
                        ggVariant = 'RINGED';
                        reason = "Condition 1: 'Sa' trade code present";
                    } else if (w.isMoon || w.isSatellite) {
                        ggVariant = 'RINGED';
                        reason = "Condition 2: Main world is a moon/satellite";
                    }
                    writeLogLine(`[GAS GIANT LOG] Hex ${w.hexId || sys.hexId}: Icon Variant = ${ggVariant} (${reason})`);
                }
            } else {
                generateSubordinateSocial(w, mainworldBase);
            }
        }

        return sys;
    }

    // =====================================================================
    // CORE FUNCTION 2: GENERATE EXTENDED SOCIOECONOMICS
    // =====================================================================

    /**
     * Generate extended socioeconomic profiles for populated worlds.
     * Handles detailed Government, Law, Tech, Cultural, Economic, Starport, and Military profiles.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object} mainworldBase - Mainworld baseline data
     * @returns {Object} Modified system object
     */
    function generateExtendedSocioeconomics(sys, mainworldBase) {
        tSection('Extended Socioeconomics');
    
        // Find the mainworld in the system
        let mainworld = null;
        const findMW = (wList) => {
            for (let w of wList) {
                if (w.type === 'Mainworld' || w.isLunarMainworld || w.targetWorld === 'Mainworld') { 
                    mainworld = w; 
                    return true; 
                }
                if (w.moons && findMW(w.moons)) return true;
                if (w.significantBodies && findMW(w.significantBodies)) return true;
            }
            return false;
        };
        findMW(sys.worlds);
        
        // Fallback if Mainworld type identifier is missing or corrupted
        if (!mainworld && sys.worlds.length > 0) {
            mainworld = sys.worlds[0];
        }
    
        // Use mainworldBase if available, otherwise use found mainworld
        let base = mainworldBase || mainworld;

        // EMERGENCY AUDIT & REPAIR: Ensure core UWP properties exist on `base`
        const uwpStr = base ? (base.uwp || base.uwpSecondary) : null;
        if (base && uwpStr && uwpStr.length >= 7) {
            if (base.starport === undefined) base.starport = uwpStr[0] || 'X';
            if (base.size === undefined) base.size = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[1]) : parseInt(uwpStr[1], 16) || 0;
            if (base.atm === undefined && base.atmCode === undefined) base.atm = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[2]) : parseInt(uwpStr[2], 16) || 0;
            if (base.hydro === undefined && base.hydroCode === undefined) base.hydro = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[3]) : parseInt(uwpStr[3], 16) || 0;
            if (base.pop === undefined) base.pop = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[4]) : parseInt(uwpStr[4], 16) || 0;
            if (base.gov === undefined) base.gov = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[5]) : parseInt(uwpStr[5], 16) || 0;
            if (base.law === undefined) base.law = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[6]) : parseInt(uwpStr[6], 16) || 0;
            if (uwpStr.length >= 9 && base.tl === undefined) {
                base.tl = typeof fromUWPChar === 'function' ? fromUWPChar(uwpStr[8]) : parseInt(uwpStr[8], 16) || 0;
            }
        }

        
        // Also ensure mainworld specifically has `pop` so we don't accidentally skip later if base gets synced but mainworld didn't.
        if (mainworld && mainworld.pop === undefined && base && base.pop !== undefined) {
            mainworld.pop = base.pop;
        }

        if (!mainworld || mainworld.pop === 0) {
            tSkip('No populated mainworld found');
            return sys;
        }
    
        // =====================================================================
        // EXTENDED PROFILE GENERATION
        // =====================================================================
    
        tSection('Socioeconomic Prerequisites');
        let minSusTL = getMgT2EMinSusTL(base.atm || base.atmCode || 0);
        tResult('Minimum Sustainable TL', minSusTL);
    
        // 1. Population P-Value
        tSection('World Population (P-Value)');
        let pValue = 0;
        let totalWorldPop = 0;
        if (base.popDigit !== undefined && base.popDigit !== null && base.popDigit > 0) {
            pValue = base.popDigit;
            tResult('P-Value (Existing popDigit)', pValue);
        } else if (base.pValue !== undefined && base.pValue !== null && base.pValue > 0) {
            pValue = base.pValue;
            tResult('P-Value (Existing pValue)', pValue);
        } else if (base.popMultiplier !== undefined && base.popMultiplier !== null && base.popMultiplier > 0) {
            pValue = base.popMultiplier;
            tResult('P-Value (Existing popMultiplier)', pValue);
        } else if (base.pbg && base.pbg.length > 0) {
            pValue = parseInt(base.pbg[0], 16);
            tResult('P-Value (Inherited from PBG String)', pValue);
        } else if (base.PBG && base.PBG.length > 0) {
            // Check for uppercase PBG as well
            pValue = parseInt(base.PBG[0], 16);
            tResult('P-Value (Inherited from PBG String)', pValue);
        } else if (base.pop >= 10) {

            pValue = 1;
            tResult('Initial P-Value', 1);
            while (pValue < 9) {
                let r = tRoll1D(`P-Value Increment Check (Target 5+, Current: ${pValue})`);
                if (r >= 5) {
                    pValue++;
                } else {
                    break;
                }
            }
            tResult('Final P-Value', pValue);
        } else if (base.pop > 0) {
            pValue = Math.floor(rng() * 9) + 1;
            tResult('P-Value (Random 1-9)', pValue);
        } else {
            pValue = 0;
            tResult('P-Value (Population 0)', 0);
        }
    
        if (base.pop > 0) {
            totalWorldPop = pValue * Math.pow(10, base.pop);
            tResult('Total World Population', totalWorldPop.toLocaleString());
        }
    
        // 2. Population Concentration Rating (PCR)
        tSection('Population Concentration Rating (PCR)');
        let pcr = 0;
        let pcrOverride = false;
        if (base.pop < 6) {
            tRoll1D('Small Pop PCR Check');
            if (pendingRoll.val > base.pop) {
                pcr = 9;
                pcrOverride = true;
                tOverride('PCR (Small Pop)', pendingRoll.val, 9, `Roll > Pop ${base.pop}`);
            }
        }
    
        if (!pcrOverride && base.pop > 0) {
            let pcrRoll = tRoll1D('PCR Roll');
            let pcrDM = 0;
    
            if (base.size === 1) { tDM('Size 1', 2); pcrDM += 2; }
            else if ([2, 3].includes(base.size)) { tDM('Size 2-3', 1); pcrDM += 1; }
    
            if (minSusTL >= 8) { tDM('MinSusTL 8+', 3); pcrDM += 3; }
            else if (minSusTL >= 3 && minSusTL <= 7) { tDM('MinSusTL 3-7', 1); pcrDM += 1; }
    
            if (base.pop === 8) { tDM('Pop 8', -1); pcrDM -= 1; }
            else if (base.pop >= 9) { tDM('Pop 9+', -2); pcrDM -= 2; }
    
            if (base.gov === 7) { tDM('Gov 7', -2); pcrDM -= 2; }
    
            if ([0, 1].includes(base.tl)) { tDM('TL 0-1', -2); pcrDM -= 2; }
            else if ([2, 3].includes(base.tl)) { tDM('TL 2-3', -1); pcrDM -= 1; }
            else if (base.tl >= 4 && base.tl <= 9) { tDM('TL 4-9', 1); pcrDM += 1; }
    
            if (base.tidallyLocked === true) { tDM('Tidally Locked', 2); pcrDM += 2; }
    
            const tcs = base.tradeCodes || [];
            if (tcs.includes("Ag")) { tDM('Ag Trade Code', -2); pcrDM -= 2; }
            if (tcs.includes("In")) { tDM('In Trade Code', 1); pcrDM += 1; }
            if (tcs.includes("Na")) { tDM('Na Trade Code', -1); pcrDM -= 1; }
            if (tcs.includes("Ri")) { tDM('Ri Trade Code', 1); pcrDM += 1; }
    
            pcr = pcrRoll + pcrDM;
            let minPCR = base.pop >= 9 ? 1 : 0;
            let finalPcr = Math.max(minPCR, Math.min(9, pcr));
            if (pcr !== finalPcr) tClamp('PCR', pcr, finalPcr);
            pcr = finalPcr;
        }
        tResult('Final PCR', pcr);
    
        // 3. Generate Urbanisation Percentage
        tSection('Urbanization Percentage');
        let urbanPercent = 0;
        if (base.pop > 0) {
            let uRoll = tRoll2D('Urbanization Roll');
            let uDM = 0;
    
            if ([0, 1, 2].includes(pcr)) { tDM('Low PCR', -3 + pcr); uDM += (-3 + pcr); }
            else if ([7, 8, 9].includes(pcr)) { tDM('High PCR', -6 + pcr); uDM += (-6 + pcr); }
    
            if (minSusTL >= 0 && minSusTL <= 3) { tDM('Low MinSusTL', -1); uDM -= 1; }
    
            if (base.size === 0) { tDM('Size 0', 2); uDM += 2; }
            if (base.pop === 8) { tDM('Pop 8', 1); uDM += 1; }
            else if (base.pop === 9) { tDM('Pop 9', 2); uDM += 2; }
            else if (base.pop >= 10) { tDM('Pop 10+', 4); uDM += 4; }
    
            if (base.gov === 0) { tDM('Gov 0', -2); uDM -= 2; }
            if (base.law >= 9) { tDM('Law 9+', 1); uDM += 1; }
    
            if ([0, 1, 2].includes(base.tl)) { tDM('TL 0-2', -2); uDM -= 2; }
            else if (base.tl === 3) { tDM('TL 3', -1); uDM -= 1; }
            else if (base.tl === 4) { tDM('TL 4', 1); uDM += 1; }
            else if (base.tl >= 5 && base.tl <= 9) { tDM('TL 5-9', 2); uDM += 2; }
            else if (base.tl >= 10) { tDM('TL 10+', 1); uDM += 1; }
    
            const tcs = base.tradeCodes || [];
            if (tcs.includes("Ag")) { tDM('Ag', -2); uDM -= 2; }
            if (tcs.includes("Na")) { tDM('Na', 2); uDM += 2; }
    
            let modURoll = uRoll + uDM;
            tResult('Modified Urbanization Roll', modURoll);
    
            // Base Percentage mapping
            let rolledPercent = 0;
            if (modURoll <= 0) rolledPercent = 0;
            else if (modURoll === 1) rolledPercent = tRoll1D('Urban % mapping (Roll 1D)');
            else if (modURoll === 2) rolledPercent = 6 + tRoll1D('Urban % mapping (6 + 1D)');
            else if (modURoll === 3) rolledPercent = 12 + tRoll1D('Urban % mapping (12 + 1D)');
            else if (modURoll === 4) rolledPercent = 18 + tRoll1D('Urban % mapping (18 + 1D)');
            else if (modURoll === 5) rolledPercent = 22 + (tRoll1D('Urban % mapping (22 + 2D6 + rng)') * 2) + (Math.floor(rng() * 2) + 1);
            else if (modURoll === 6) rolledPercent = 34 + (tRoll1D('Urban % mapping (34 + 2D6 + rng)') * 2) + (Math.floor(rng() * 2) + 1);
            else if (modURoll === 7) rolledPercent = 46 + (tRoll1D('Urban % mapping (46 + 2D6 + rng)') * 2) + (Math.floor(rng() * 2) + 1);
            else if (modURoll === 8) rolledPercent = 58 + (tRoll1D('Urban % mapping (58 + 2D6 + rng)') * 2) + (Math.floor(rng() * 2) + 1);
            else if (modURoll === 9) rolledPercent = 70 + (tRoll1D('Urban % mapping (70 + 2D6 + rng)') * 2) + (Math.floor(rng() * 2) + 1);
            else if (modURoll === 10) rolledPercent = 84 + tRoll1D('Urban % mapping (84 + 1D)');
            else if (modURoll === 11) rolledPercent = 90 + tRoll1D('Urban % mapping (90 + 1D)');
            else if (modURoll === 12) rolledPercent = 96 + (Math.floor(rng() * 3) + 1);
            else if (modURoll >= 13) rolledPercent = 100;
    
            tResult('Initial Urbanization Percentage', rolledPercent);
    
            // Constraints
            let minLimit = -1;
            if (base.pop >= 10) {
                minLimit = 50 + tRoll1D('Min Urbanization constraint (Pop 10+)');
                tResult('Minimum Urbanization Limit', minLimit);
            }
            else if (base.pop === 9) {
                minLimit = 18 + tRoll1D('Min Urbanization constraint (Pop 9)');
                tResult('Minimum Urbanization Limit', minLimit);
            }
    
            let maxLimit = 101;
            if ([0, 1, 2].includes(base.tl)) { maxLimit = Math.min(maxLimit, 20 + tRoll1D('Max Urbanization constraint (TL 0-2)')); }
            else if (base.tl === 3) { maxLimit = Math.min(maxLimit, 30 + tRoll1D('Max Urbanization constraint (TL 3)')); }
            else if (base.tl === 4) { maxLimit = Math.min(maxLimit, 60 + tRoll1D('Max Urbanization constraint (TL 4)')); }
            else if (base.tl >= 5 && base.tl <= 9) { maxLimit = Math.min(maxLimit, 90 + tRoll1D('Max Urbanization constraint (TL 5-9)')); }
    
            if (tcs.includes("Ag")) { maxLimit = Math.min(maxLimit, 90 + tRoll1D('Max Urbanization constraint (Ag)')); }
    
            if (maxLimit !== 101) tResult('Maximum Urbanization Limit', maxLimit);
    
            if (minLimit !== -1 && rolledPercent < minLimit) {
                tOverride('Urban Percentage', rolledPercent, minLimit, 'Minimum Limit');
                urbanPercent = minLimit;
            }
            else if (maxLimit !== 101 && rolledPercent > maxLimit) {
                tOverride('Urban Percentage', rolledPercent, maxLimit, 'Maximum Limit');
                urbanPercent = maxLimit;
            }
            else urbanPercent = rolledPercent;
    
            urbanPercent = Math.max(0, Math.min(100, urbanPercent));
        }
        tResult('Final Urbanization Percentage', urbanPercent);
    
        // 4. Calculate Total Urban Population
        let totalUrbanPop = Math.round(totalWorldPop * (urbanPercent / 100));
    
        // 5. Determine Major Cities and Total Major City Population
        let majorCities = 0;
        let totalMajorCityPop = 0;
    
        if (pcr === 0) {
            majorCities = 0;
            totalMajorCityPop = 0;
            tResult('City Formula', 'PCR 0 forces 0 cities');
        } else if (base.pop <= 5 && pcr === 9) {
            majorCities = 1;
            totalMajorCityPop = totalUrbanPop;
            tResult('City Formula', 'Small Pop + PCR 9 forces 1 city');
        } else if (base.pop <= 5 && pcr >= 1 && pcr <= 8) {
            majorCities = Math.min(9 - pcr, base.pop);
            totalMajorCityPop = totalUrbanPop;
            tResult('City Formula', `Small Pop + PCR 1-8: min(9 - PCR(${pcr}), PopCode(${base.pop})) = ${majorCities}`);
        } else if (base.pop >= 6 && pcr === 9) {
            let mCRoll = tRoll2D('Major Cities Roll (2D)');
            majorCities = Math.max(base.pop - mCRoll, 1);
            totalMajorCityPop = totalUrbanPop;
            tResult('City Formula', `Pop 6+ + PCR 9: max(PopCode(${base.pop}) - Roll(${mCRoll}), 1) = ${majorCities}`);
        } else { // Population >= 6 AND PCR 1-8
            let mCRoll = tRoll2D('Major Cities Roll (2D)');
            let urbanFactor = ((urbanPercent / 100) * 20) / pcr;
            let cityFormula = mCRoll - pcr + urbanFactor;
            majorCities = Math.max(1, Math.round(cityFormula));
            totalMajorCityPop = totalUrbanPop;
            tResult('City Formula', `Pop 6+ + PCR 1-8: Roll(${mCRoll}) - PCR(${pcr}) + [ (Urban%(${urbanPercent}) * 20) / PCR(${pcr}) ] = ${cityFormula.toFixed(2)} -> ${majorCities}`);
        }
        tResult('Major Cities Count', majorCities);
        tResult('Total Major City Pop', totalMajorCityPop.toLocaleString());
    
        // 6. Government Profile - Centralisation Code (C)
        tSection('Government: Centralization');
        let cRoll = tRoll2D('Centralization Roll');
        let cDM = 0;
        if (base.gov >= 2 && base.gov <= 5) { tDM('Gov 2-5', -1); cDM -= 1; }
        if ([6, 8, 9, 10, 11].includes(base.gov)) { tDM('Gov 6,8-11', 1); cDM += 1; }
        if (base.gov === 7) { tDM('Gov 7', 1); cDM += 1; }
        if (base.gov >= 12) { tDM('Gov 12+', 2); cDM += 2; }
        if (pcr >= 0 && pcr <= 3) { tDM('PCR 0-3', -1); cDM -= 1; }
        if (pcr === 7 || pcr === 8) { tDM('PCR 7-8', 1); cDM += 1; }
        if (pcr === 9) { tDM('PCR 9', 3); cDM += 3; }
    
        let cScore = cRoll + cDM;
        let centralisation = 'U';
        if (cScore <= 5) centralisation = 'C';
        else if (cScore <= 8) centralisation = 'F';
        tResult('Centralization Code', `${centralisation} (${cScore})`);
    
        // 7. Primary Authority Code (A)
        tSection('Government: Primary Authority');
        let aRoll = tRoll2D('Authority Roll');
        let aDM = 0;
        if ([1, 6, 10, 13, 14].includes(base.gov)) { tDM('Gov 1,6,10,13,14', 6); aDM += 6; }
        if (base.gov === 2) { tDM('Gov 2', -4); aDM -= 4; }
        if ([3, 5, 12].includes(base.gov)) { tDM('Gov 3,5,12', -2); aDM -= 2; }
        if (base.gov === 11 || base.gov === 15) { tDM('Gov 11,15', 4); aDM += 4; }
        if (centralisation === 'C') { tDM('Centralized', -2); aDM -= 2; }
        if (centralisation === 'U') { tDM('Unitary', 2); aDM += 2; }
    
        let aScore = aRoll + aDM;
        let authority = 'E';
        if (aScore <= 4 || aScore === 8) authority = 'L';
        else if (aScore === 6 || aScore === 11) authority = 'J';
        else if (aScore === 7 || aScore === 9) authority = 'B';
        tResult('Authority Code', `${authority} (${aScore})`);
    
        // 8. Structure Code (S)
        tSection('Government: Structure');
        function getStructure(gov, auth, branch, isSecondary) {
            const label = isSecondary ? `Structure (${branch})` : 'Structure';
            if (gov === 2) { tResult(label, 'D (Gov 2)'); return 'D'; }
            if (gov === 8 || gov === 9) { tResult(label, 'M (Gov 8-9)'); return 'M'; }
            if ([3, 12, 15].includes(gov)) {
                let r = tRoll1D(`${label} (Gov 3,12,15)`);
                let res = r <= 4 ? 'S' : 'M';
                tResult(label, res);
                return res;
            }
            if ([10, 11, 13, 14].includes(gov)) {
                if (!isSecondary) {
                    let r = tRoll1D(`${label} (Gov 10,11,13,14)`);
                    let res = r <= 5 ? 'R' : 'S';
                    tResult(label, res);
                    return res;
                }
            } else if (auth === 'L' && !isSecondary) {
                let sRoll = tRoll2D(`${label} (Auth L)`);
                let res = sRoll <= 3 ? 'D' : sRoll <= 8 ? 'M' : 'S';
                tResult(label, res);
                return res;
            }
    
            let sDM = (isSecondary && [10, 11, 13, 14].includes(gov) ? 2 : 0);
            if (sDM !== 0) tDM('Secondary Multi-Branch', sDM);
            let fallbackRoll = tRoll2D(`${label} (Fallback)`);
            let total = fallbackRoll + sDM;
            let res = 'S';
            if (total <= 3) res = 'D';
            else if (total === 4) res = 'S';
            else if (total <= 6) res = 'M';
            else if (total <= 8) res = 'R';
            else if (total === 9) res = 'M';
            else if (total === 10) res = 'S';
            else if (total === 11) res = 'M';
            tResult(label, res);
            return res;
        }
    
        let structureStr = "";
        if (authority === 'B') {
            structureStr = getStructure(base.gov, authority, 'L', true) +
                getStructure(base.gov, authority, 'E', true) +
                getStructure(base.gov, authority, 'J', true);
        } else {
            structureStr = getStructure(base.gov, authority, authority, false);
        }
    
        let govProfile = `${centralisation}-${authority}-${structureStr}`;
        tResult('Final Government Profile', govProfile);
    
        // 9. Factions
        tSection('Factions');
        let baseFactions = Math.floor(rng() * 3) + 1; // 1 to 3
        tResult('Base Factions (1-3)', baseFactions);
        let fDM = 0;
        if (base.gov === 0 || base.gov === 7) { tDM('Gov 0 or 7', 1); fDM += 1; }
        if (base.gov >= 10) { tDM('Gov 10+', -1); fDM -= 1; }
    
        let totalFactions = baseFactions + fDM;
        tResult('Total Potential Factions', totalFactions);
        let numExternalFactions = 0;
        if (totalFactions > 1) {
            numExternalFactions = totalFactions - 1;
        }
    
        let factionsData = [];
        for (let i = 0; i < numExternalFactions; i++) {
            let fRoll = tRoll2D(`Faction ${i + 1} Strength Roll`);
            let fStrength = 'P';
            if (fRoll <= 3) fStrength = 'O';
            else if (fRoll <= 5) fStrength = 'F';
            else if (fRoll <= 7) fStrength = 'M';
            else if (fRoll <= 9) fStrength = 'N';
            else if (fRoll <= 11) fStrength = 'S';
            
            // WBH RAW: Generate Faction Government
            let fGovRoll = tRoll2D(`Faction ${i + 1} Gov Roll`);
            let fGov = Math.max(0, fGovRoll - 7 + base.pop);
            
            // Identify: Splinter vs Dissident
            let fIdentity = (fGov === base.gov) ? "Splinter/Rival" : "Dissident/Rebel";
            
            factionsData.push({ strength: fStrength, gov: fGov, identity: fIdentity });
            tResult(`Faction ${i + 1}`, `${fIdentity} (Strength ${fStrength}, Gov ${toUWPChar(fGov)})`);
        }
        base.factionsData = factionsData;
        let factionsString = factionsData.map(f => f.strength).join('');
    
        // 10. Law Profile (O-WECPR)
        tSection('Law Profile');
        let overallLaw = base.law;
        tResult('Overall Law Level', overallLaw);
        let judRoll = tRoll2D('Justice System Roll');
        let isInquisitorial = judRoll <= 5;
        tResult('Justice System', isInquisitorial ? 'Inquisitorial' : 'Adversarial');
    
        // Judicial System Profile (JSP)
        tSection('Judicial System Profile');
        let jCode = isInquisitorial ? 'I' : 'A';
        tResult('Judicial System Code', jCode);
        let uCode = 'U';
        if (centralisation === 'C') {
            uCode = 'T';
            tResult('Law Uniformity (Centralized)', uCode);
        } else if (centralisation === 'F') {
            let uniRoll = tRoll1D('Law Uniformity Roll (Federal)');
            uCode = uniRoll <= 5 ? 'T' : 'P';
            tResult('Law Uniformity', uCode);
        } else {
            let uniRoll = tRoll1D('Law Uniformity Roll');
            let uniDM = 0;
            if (base.gov === 3 || base.gov === 5 || base.gov >= 10) {
                tDM('Gov 3,5,10+', -1);
                uniDM -= 1;
            }
            if (base.gov === 2) {
                tDM('Gov 2', 1);
                uniDM += 1;
            }
            let total = uniRoll + uniDM;
            if (total <= 2) uCode = 'P';
            else if (total === 3) uCode = 'T';
            else uCode = 'U';
            tResult('Law Uniformity', uCode);
        }
        let pRoll = tRoll2D('Presumption of Innocence Roll');
        let pDM = 0;
        tDM('Law Level', -overallLaw);
        pDM -= overallLaw;
        if (jCode === 'A') {
            tDM('Adversarial System', 2);
            pDM += 2;
        }
        let pTotal = pRoll + pDM;
        let pCode = pTotal >= 0 ? 'Y' : 'N';
        tResult('Presumption of Innocence', pCode);
        let dRoll = tRoll2D('Death Penalty Roll');
        let dDM = 0;
        if (base.gov === 0) {
            tDM('Gov 0', -4);
            dDM -= 4;
        }
        if (overallLaw >= 9) {
            tDM('Law 9+', 4);
            dDM += 4;
        }
        let dTotal = dRoll + dDM;
        let dCode = dTotal >= 8 ? 'Y' : 'N';
        tResult('Death Penalty', dCode);
        let judicialSystemProfile = `${jCode}${uCode}-${pCode}-${dCode}`;
        tResult('Final Judicial System Profile', judicialSystemProfile);
    
        // Weapons and Armour (W)
        tSection('Law: Weapons & Armour');
        let lawWRoll = tRoll2D3('Weapons Law Roll');
        tDM('Overall Law', overallLaw);
        tDM('WBH Base', -4);
        let wDM = 0;
        if (pcr >= 0 && pcr <= 3) { tDM('PCR 0-3', -1); wDM = -1; }
        if (pcr === 8 || pcr === 9) { tDM('PCR 8-9', 1); wDM = 1; }
        let rawW = lawWRoll + overallLaw - 4 + wDM;
        let lawW = Math.max(0, Math.min(18, rawW));
        if (rawW !== lawW) tClamp('Weapons Law', rawW, lawW);
        tResult('Weapons Law Code', lawW);
    
        // Economic Law (E)
        tSection('Law: Economic');
        let lawERoll = tRoll2D3('Economic Law Roll');
        tDM('Overall Law', overallLaw);
        tDM('WBH Base', -4);
        let eDM = 0;
        if (base.gov === 0) { tDM('Gov 0', -2); eDM = -2; }
        if (base.gov === 1) { tDM('Gov 1', 2); eDM = 2; }
        if (base.gov === 2) { tDM('Gov 2', -1); eDM = -1; }
        if (base.gov === 9) { tDM('Gov 9', 1); eDM = 1; }
        let rawE = lawERoll + overallLaw - 4 + eDM;
        let lawE = Math.max(0, Math.min(18, rawE));
        if (rawE !== lawE) tClamp('Economic Law', rawE, lawE);
        tResult('Economic Law Code', lawE);
    
        // Criminal Law (C)
        tSection('Law: Criminal');
        let lawCRoll = tRoll2D3('Criminal Law Roll');
        tDM('Overall Law', overallLaw);
        tDM('WBH Base', -4);
        let cLawDM = 0;
        if (isInquisitorial) { tDM('Inquisitorial', 1); cLawDM = 1; }
        let rawC = lawCRoll + overallLaw - 4 + cLawDM;
        let lawC = Math.max(0, Math.min(18, rawC));
        if (rawC !== lawC) tClamp('Criminal Law', rawC, lawC);
        tResult('Criminal Law Code', lawC);
    
        // Private Law (P)
        tSection('Law: Private');
        let lawPRoll = tRoll2D3('Private Law Roll');
        tDM('Overall Law', overallLaw);
        tDM('WBH Base', -4);
        let pLawDM = 0;
        if (base.gov === 12) { tDM('Gov 12', -1); pLawDM = -1; }
        let rawP = lawPRoll + overallLaw - 4 + pLawDM;
        let lawP = Math.max(0, Math.min(18, rawP));
        if (rawP !== lawP) tClamp('Private Law', rawP, lawP);
        tResult('Private Law Code', lawP);
    
        // Personal Rights (R)
        tSection('Law: Personal Rights');
        let lawRRoll = tRoll2D3('Personal Rights Roll');
        tDM('Overall Law', overallLaw);
        tDM('WBH Base', -4);
        let rDM = 0;
        if (base.gov === 0 || base.gov === 2) { tDM('Gov 0 or 2', -1); rDM = -1; }
        if (base.gov === 1) { tDM('Gov 1', 2); rDM = 2; }
        let rawR = lawRRoll + overallLaw - 4 + rDM;
        let lawR = Math.max(0, Math.min(18, rawR));
        if (rawR !== lawR) tClamp('Personal Rights Law', rawR, lawR);
        tResult('Personal Rights Law Code', lawR);
    
        let lawProfile = `${toEHex(overallLaw)}-${toEHex(lawW)}${toEHex(lawE)}${toEHex(lawC)}${toEHex(lawP)}${toEHex(lawR)}`;
        tResult('Final Law Profile', lawProfile);
    
        // 11. Tech Profile (H-L-QQQQQ-TTTT-MM-N)
        tSection('Tech Profile');
        function tlm(label) {
            let rLabel = label || 'Tech Level Modifier';
            let roll = tRoll2D(rLabel);
            let mod = 0;
            if (roll === 2) mod = -3;
            else if (roll === 3) mod = -2;
            else if (roll === 4) mod = -1;
            else if (roll >= 5 && roll <= 9) mod = 0;
            else if (roll === 10) mod = 1;
            else if (roll === 11) mod = 2;
            else if (roll === 12) mod = 3;
    
            let resLabel = rLabel.replace('Roll', 'Result');
            tResult(resLabel, mod);
            return mod;
        }
    
        let tcs = base.tradeCodes || [];
        let isInd = tcs.includes("In");
        let isRich = tcs.includes("Ri");
        let isPoor = tcs.includes("Po");
        let habRating = 8; // placeholder - standard HZ world
    
        // Common TL
        tSection('Tech: Common TL (H & L)');
        let H = base.tl;
        tResult('High Tech (H)', H);
        let lDM = 0;
        if (base.pop >= 1 && base.pop <= 5) { tDM('Pop 1-5', 1); lDM += 1; }
        if (base.pop >= 9) { tDM('Pop 9+', -1); lDM -= 1; }
        if ([0, 6, 13, 14].includes(base.gov)) { tDM('Gov 0,6,13,14', -1); lDM -= 1; }
        if (base.gov === 5) { tDM('Gov 5', 1); lDM += 1; }
        if (base.gov === 7) { tDM('Gov 7', -2); lDM -= 2; }
        if (pcr >= 0 && pcr <= 2) { tDM('PCR 0-2', -1); lDM -= 1; }
        if (pcr >= 7) { tDM('PCR 7+', 1); lDM += 1; }
    
        let L = H + tlm('Low Tech Roll') + lDM;
        let finalL = Math.max(Math.floor(H / 2), Math.min(H, L));
        if (L !== finalL) tClamp('Low Tech', L, finalL);
        L = finalL;
        tResult('Low Tech (L)', L);
    
        // Quality of Life TLs
        tSection('Tech: Quality of Life (Q1-Q5)');
    
        // Q1 Energy
        writeLogLine('Q1 Energy');
        let q1DM = 0;
        if (base.pop >= 9) { tDM('Pop 9+', 1); q1DM += 1; }
        if (isInd) { tDM('Industrial', 1); q1DM += 1; }
        let rawQ1 = H + tlm('Q1: Energy TLM Roll') + q1DM;
        let Q1 = Math.max(Math.floor(H / 2), Math.min(Math.floor(H * 1.2), rawQ1));
        if (rawQ1 !== Q1) tClamp('Q1 TL', rawQ1, Q1);
        tResult('Q1: Energy', Q1);
    
        // Q2 Electronics
        writeLogLine('Q2 Electronics');
        let q2DM = 0;
        if (base.pop >= 1 && base.pop <= 5) { tDM('Pop 1-5', 1); q2DM += 1; }
        if (base.pop >= 9) { tDM('Pop 9+', -1); q2DM -= 1; }
        if (isInd) { tDM('Industrial', 1); q2DM += 1; }
        let rawQ2 = H + tlm('Q2: Electronics TLM Roll') + q2DM;
        let Q2 = Math.max(Q1 - 3, Math.min(Q1 + 1, rawQ2));
        if (rawQ2 !== Q2) tClamp('Q2 TL', rawQ2, Q2);
        tResult('Q2: Electronics', Q2);
    
        // Q3 Manufacturing
        writeLogLine('Q3 Manufacturing');
        let q3DM = 0;
        if (base.pop >= 1 && base.pop <= 6) { tDM('Pop 1-6', -1); q3DM -= 1; }
        if (base.pop >= 8) { tDM('Pop 8+', 1); q3DM += 1; }
        if (isInd) { tDM('Industrial', 1); q3DM += 1; }
        let rawQ3 = H + tlm('Q3: Manufacturing TLM Roll') + q3DM;
        let Q3 = Math.max(Q2 - 2, Math.min(Math.max(Q1, Q2), rawQ3));
        if (rawQ3 !== Q3) tClamp('Q3 TL', rawQ3, Q3);
        tResult('Q3: Manufacturing', Q3);
    
        // Q4 Medical
        writeLogLine('Q4 Medical');
        let q4DM = 0;
        if (isRich) { tDM('Rich', 1); q4DM += 1; }
        if (isPoor) { tDM('Poor', -1); q4DM -= 1; }
        let rawQ4 = H + tlm('Q4: Medical TLM Roll') + q4DM;
        let spLowBound = 0;
        if (base.starport === 'A') spLowBound = 6;
        else if (base.starport === 'B') spLowBound = 4;
        else if (base.starport === 'C') spLowBound = 2;
        let Q4 = Math.max(spLowBound, Math.min(Q2, rawQ4));
        if (rawQ4 !== Q4) tClamp('Q4 TL', rawQ4, Q4);
        tResult('Q4: Medical', Q4);
    
        // Q5 Environment
        writeLogLine('Q5 Environment');
        let q5DM = 0;
        if (habRating < 8) {
            let hDM = 8 - habRating;
            tDM('Habitation < 8', hDM);
            q5DM += hDM;
        }
        let rawQ5 = Q3 + tlm('Q5: Environment TLM Roll') + q5DM;
        let Q5 = Math.max(Q1 - 5, Math.min(Q1, rawQ5));
        if (rawQ5 !== Q5) tClamp('Q5 TL', rawQ5, Q5);
        tResult('Q5: Environment', Q5);
    
        // Transportation TLs
        tSection('Tech: Transportation (T1-T4)');
        let atmCode = base.atm || base.atmCode || 0;
        let hydroCode = base.hydro || base.hydroCode || 0;
        
        let t1DM = 0;
        if (hydroCode === 10) { tDM('Hydro A', -1); t1DM -= 1; }
        if (pcr >= 0 && pcr <= 2) { tDM('High Concentration', 1); t1DM += 1; }
        let T1 = Q1 + tlm('T1: Land Roll') + t1DM;
        let fT1 = Math.max(Q2 - 5, Math.min(Q1, T1));
        if (T1 !== fT1) tClamp('T1 TL', T1, fT1);
        T1 = fT1;
        tResult('T1: Land', T1);
    
        let t2DM = 0;
        if (hydroCode === 0) { tDM('Hydro 0', -2); t2DM -= 2; }
        if (hydroCode === 8) { tDM('Hydro 8', 1); t2DM += 1; }
        if (hydroCode === 9) { tDM('Hydro 9', 2); t2DM += 2; }
        if (hydroCode >= 10) { tDM('Hydro A', 4); t2DM += 4; }
        if (pcr >= 0 && pcr <= 2) { tDM('High Concentration', 1); t2DM += 1; }
        let T2 = Q1 + tlm('T2: Water Roll') + t2DM;
        let fT2 = 0;
        if (hydroCode === 0) {
            fT2 = Math.max(0, Math.min(Q1, T2));
        } else {
            fT2 = Math.max(Q2 - 5, Math.min(Q1, T2));
        }
        if (T2 !== fT2) tClamp('T2 TL', T2, fT2);
        T2 = fT2;
        tResult('T2: Water', T2);
    
        let t3DM = 0;
        if ((atmCode <= 3 || atmCode === 14) && H <= 7) { tDM('Atm Extreme & H<=7', -2); t3DM -= 2; }
        if ((atmCode === 4 || atmCode === 5) && H <= 7) { tDM('Atm Thin & H<=7', -1); t3DM -= 1; }
        let T3 = Q1 + tlm('T3: Air Roll') + t3DM;
        let fT3 = Math.max(Q2 - 5, Math.min(Q1, T3));
        if (atmCode === 0 && H <= 5) fT3 = 0;
        if (T3 !== fT3) tClamp('T3 TL', T3, fT3);
        T3 = fT3;
        tResult('T3: Air', T3);
    
        let t4DM = 0;
        if (base.size === 0 || base.size === 1) { tDM('Small World', 2); t4DM += 2; }
        if (base.pop >= 1 && base.pop <= 5) { tDM('Pop 1-5', -1); t4DM -= 1; }
        if (base.pop >= 9) { tDM('Pop 9+', 1); t4DM += 1; }
        if (base.starport === 'A') { tDM('Starport A', 2); t4DM += 2; }
        if (base.starport === 'B') { tDM('Starport B', 1); t4DM += 1; }
        let T4 = Q3 + tlm('T4: Space Roll') + t4DM;
        let fT4 = Math.max(Math.min(Q1 - 3, Q3 - 3), Math.min(Math.min(Q1, Q3), T4));
        if (T4 !== fT4) tClamp('T4 TL', T4, fT4);
        T4 = fT4;
        tResult('T4: Space', T4);
    
        // Military TLs
        tSection('Tech: Military (M1-M2)');
        let m1DM = 0;
        if (base.gov === 0 || base.gov === 7) { tDM('Gov 0 or 7', 2); m1DM += 2; }
        if (overallLaw === 0 || overallLaw >= 13) { tDM('Law Extreme', 2); m1DM += 2; }
        if ((overallLaw >= 1 && overallLaw <= 4) || (overallLaw >= 9 && overallLaw <= 12)) { tDM('Law High/Low', 1); m1DM += 1; }
        let M1 = Q3 + tlm('M1: Personal Roll') + m1DM;
        let fM1 = Math.max((lawW === 0 ? Q3 : 0), Math.min(Q2, M1));
        if (M1 !== fM1) tClamp('M1 TL', M1, fM1);
        M1 = fM1;
        tResult('M1: Personal', M1);
    
        let m2DM = 0;
        if (base.pop >= 1 && base.pop <= 6) { tDM('Pop 1-6', -1); m2DM -= 1; }
        if (base.pop >= 8) { tDM('Pop 8+', 1); m2DM += 1; }
        if ([7, 10, 11, 15].includes(base.gov)) { tDM('Gov 7,10,11,15', 2); m2DM += 2; }
        if (overallLaw >= 13) { tDM('Law 13+', 2); m2DM += 2; }
        if (isInd) { tDM('Industrial', 1); m2DM += 1; }
        let M2 = Q3 + tlm('M2: Heavy Roll') + m2DM;
        let fM2 = Math.max(0, Math.min(Q3, M2));
        if (M2 !== fM2) tClamp('M2 TL', M2, fM2);
        M2 = fM2;
        tResult('M2: Heavy', M2);
    
        // Novelty TL (Acts as Relic/Prototype safety net if base TL is below floor)
        tSection('Tech: Novelty (N)');
        let maxOfAll = Math.max(Q1, Q2, Q3, Q4, Q5, T1, T2, T3, T4, M1, M2);

        // WBH: Prototype gear can be 0 to 2 levels below the minimum sustainable TL
        let juryRigOffset = (base.tl < minSusTL) ? Math.floor(rng() * 3) : 0;
        let relicTL = Math.max(0, minSusTL - juryRigOffset);

        let N = Math.max(maxOfAll, relicTL, Math.max(H + 2, 12));
        tResult('Novelty (N)', N);
    
        let techProfile = `${toEHex(H)}-${toEHex(L)}-${toEHex(Q1)}${toEHex(Q2)}${toEHex(Q3)}${toEHex(Q4)}${toEHex(Q5)}-${toEHex(T1)}${toEHex(T2)}${toEHex(T3)}${toEHex(T4)}-${toEHex(M1)}${toEHex(M2)}-${toEHex(N)}`;
        tResult('Final Tech Profile', techProfile);
    
        // 12. Cultural Profile (DXUS-CPEM)
        tSection('Cultural Profile');
        let culD = 0, culX = 0, culU = 0, culS = 0;
        let culC = 0, culP = 0, culE = 0, culM = 0;
        let culturalProfile = "0000-0000";
    
        if (base.pop > 0) {
            // Diversity
            tSection('Culture: Diversity (D)');
            let cD_DM = 0;
            if (base.pop >= 1 && base.pop <= 5) { tDM('Pop 1-5', -2); cD_DM -= 2; }
            if (base.pop >= 9) { tDM('Pop 9+', 2); cD_DM += 2; }
            if ([0, 1, 2].includes(base.gov)) { tDM('Gov 0,1,2', 1); cD_DM += 1; }
            if (base.gov === 7) { tDM('Gov 7', 4); cD_DM += 4; }
            if ([13, 14, 15].includes(base.gov)) { tDM('Gov 13-15', -4); cD_DM -= 4; }
            if (overallLaw >= 0 && overallLaw <= 4) { tDM('Law 0-4', 1); cD_DM += 1; }
            if (overallLaw >= 10) { tDM('Law 10+', -1); cD_DM -= 1; }
            if (pcr >= 0 && pcr <= 3) { tDM('PCR 0-3', 1); cD_DM += 1; }
            if (pcr >= 7 && pcr <= 9) { tDM('PCR 7-9', -2); cD_DM -= 2; }
            culD = Math.max(1, tRoll2D('Diversity Roll') + cD_DM);
            tResult('Diversity Score', culD);
    
            // Xenophilia
            tSection('Culture: Xenophilia (X)');
            let cX_DM = 0;
            if (base.pop >= 1 && base.pop <= 5) { tDM('Pop 1-5', -1); cX_DM -= 1; }
            if (base.pop >= 9) { tDM('Pop 9+', 2); cX_DM += 2; }
            if (base.gov === 13 || base.gov === 14) { tDM('Gov 13,14', -2); cX_DM -= 2; }
            if (overallLaw >= 10) { tDM('Law 10+', -2); cX_DM -= 2; }
            if (base.starport === 'A') { tDM('Starport A', 2); cX_DM += 2; }
            if (base.starport === 'B') { tDM('Starport B', 1); cX_DM += 1; }
            if (base.starport === 'D') { tDM('Starport D', -1); cX_DM -= 1; }
            if (base.starport === 'E') { tDM('Starport E', -2); cX_DM -= 2; }
            if (base.starport === 'X') { tDM('Starport X', -4); cX_DM -= 4; }
            if (culD >= 1 && culD <= 3) { tDM('Low Diversity', -2); cX_DM -= 2; }
            if (culD >= 12) { tDM('Extreme Diversity', 1); cX_DM += 1; }
            culX = Math.max(1, tRoll2D('Xenophilia Roll') + cX_DM);
            tResult('Xenophilia Score', culX);
    
            // Uniqueness
            tSection('Culture: Uniqueness (U)');
            let cU_DM = 0;
            if (base.starport === 'A') { tDM('Starport A', -2); cU_DM -= 2; }
            if (base.starport === 'B') { tDM('Starport B', -1); cU_DM -= 1; }
            if (base.starport === 'D') { tDM('Starport D', 1); cU_DM += 1; }
            if (base.starport === 'E') { tDM('Starport E', 2); cU_DM += 2; }
            if (base.starport === 'X') { tDM('Starport X', 4); cU_DM += 4; }
            if (culD >= 1 && culD <= 3) { tDM('Low Diversity', 2); cU_DM += 2; }
            if ([9, 10, 11].includes(culX)) { tDM('High Xenophilia', -1); cU_DM -= 1; }
            if (culX >= 12) { tDM('Extreme Xenophilia', -2); cU_DM -= 2; }
            culU = Math.max(1, tRoll2D('Uniqueness Roll') + cU_DM);
            tResult('Uniqueness Score', culU);
    
            // Symbology
            tSection('Culture: Symbology (S)');
            let cS_DM = 0;
            if (base.gov === 13 || base.gov === 14) { tDM('Gov 13,14', 2); cS_DM += 2; }
            if (H === 0 || H === 1) { tDM('Low TL (0-1)', -3); cS_DM -= 3; }
            if (H === 2 || H === 3) { tDM('Low TL (2-3)', -1); cS_DM -= 1; }
            if ([9, 10, 11].includes(H)) { tDM('High TL (9-11)', 2); cS_DM += 2; }
            if (H >= 12) { tDM('High TL (12+)', 4); cS_DM += 4; }
            if ([9, 10, 11].includes(culU)) { tDM('High Uniqueness', 1); cS_DM += 1; }
            if (culU >= 12) { tDM('Extreme Uniqueness', 3); cS_DM += 3; }
            culS = Math.max(1, tRoll2D('Symbology Roll') + cS_DM);
            tResult('Symbology Score', culS);
    
            // Cohesion
            tSection('Culture: Cohesion (C)');
            let cC_DM = 0;
            if (base.gov === 3 || base.gov === 12) { tDM('Gov 3,12', 2); cC_DM += 2; }
            if ([5, 6, 9].includes(base.gov)) { tDM('Gov 5,6,9', 1); cC_DM += 1; }
            if (overallLaw >= 0 && overallLaw <= 2) { tDM('Low Law', -2); cC_DM -= 2; }
            if (overallLaw >= 10) { tDM('High Law', 2); cC_DM += 2; }
            if (pcr >= 0 && pcr <= 3) { tDM('Low PCR', -2); cC_DM -= 2; }
            if (pcr >= 7) { tDM('High PCR', 2); cC_DM += 2; }
            if (culD === 1 || culD === 2) { tDM('Extreme Low Diversity', 4); cC_DM += 4; }
            if ([3, 4, 5].includes(culD)) { tDM('Low Diversity', 2); cC_DM += 2; }
            if ([9, 10, 11].includes(culD)) { tDM('High Diversity', -2); cC_DM -= 2; }
            if (culD >= 12) { tDM('Extreme High Diversity', -4); cC_DM -= 4; }
            culC = Math.max(1, tRoll2D('Cohesion Roll') + cC_DM);
            tResult('Cohesion Score', culC);
    
            // Progressiveness
            tSection('Culture: Progressiveness (P)');
            let cP_DM = 0;
            if ([6, 7, 8].includes(base.pop)) { tDM('Pop 6-8', -1); cP_DM -= 1; }
            if (base.pop >= 9) { tDM('Pop 9+', -2); cP_DM -= 2; }
            if (base.gov === 5) { tDM('Gov 5', 1); cP_DM += 1; }
            if (base.gov === 11) { tDM('Gov 11', -2); cP_DM -= 2; }
            if (base.gov === 13 || base.gov === 14) { tDM('Gov 13,14', -6); cP_DM -= 6; }
            if ([9, 10, 11].includes(overallLaw)) { tDM('High Law', -1); cP_DM -= 1; }
            if (overallLaw >= 12) { tDM('Extreme Law', -4); cP_DM -= 4; }
            if (culD >= 1 && culD <= 3) { tDM('Low Diversity', -2); cP_DM -= 2; }
            if (culD >= 12) { tDM('Extreme Diversity', 1); cP_DM += 1; }
            if (culX >= 1 && culX <= 5) { tDM('Low Xenophilia', -1); cP_DM -= 1; }
            if (culX >= 9) { tDM('High Xenophilia', 2); cP_DM += 2; }
            if (culC >= 1 && culC <= 5) { tDM('Low Cohesion', 2); cP_DM += 2; }
            if (culC >= 9) { tDM('High Cohesion', -2); cP_DM -= 2; }
            culP = Math.max(1, tRoll2D('Progressiveness Roll') + cP_DM);
            tResult('Progressiveness Score', culP);
    
            // Expansionism
            tSection('Culture: Expansionism (E)');
            let cE_DM = 0;
            if (base.gov === 10 || base.gov >= 12) { tDM('Gov 10,12+', 2); cE_DM += 2; }
            if (culD >= 1 && culD <= 3) { tDM('Low Diversity', 3); cE_DM += 3; }
            if (culD >= 12) { tDM('Extreme Diversity', -3); cE_DM -= 3; }
            if (culX >= 1 && culX <= 5) { tDM('Low Xenophilia', 1); cE_DM += 1; }
            if (culX >= 9) { tDM('High Xenophilia', -2); cE_DM -= 2; }
            culE = Math.max(1, tRoll2D('Expansionism Roll') + cE_DM);
            tResult('Expansionism Score', culE);
    
            // Militancy
            tSection('Culture: Militancy (M)');
            let cM_DM = 0;
            if (base.gov >= 10) { tDM('Gov 10+', 3); cM_DM += 3; }
            if ([9, 10, 11].includes(overallLaw)) { tDM('High Law', 1); cM_DM += 1; }
            if (overallLaw >= 12) { tDM('Extreme Law', 2); cM_DM += 2; }
            if (culX >= 1 && culX <= 5) { tDM('Low Xenophilia', 1); cM_DM += 1; }
            if (culX >= 9) { tDM('High Xenophilia', -2); cM_DM -= 2; }
            if (culE >= 1 && culE <= 5) { tDM('Low Expansionism', -1); cM_DM -= 1; }
            if ([9, 10, 11].includes(culE)) { tDM('High Expansionism', 1); cM_DM += 1; }
            if (culE >= 12) { tDM('Extreme Expansionism', 2); cM_DM += 2; }
            culM = Math.max(1, tRoll2D('Militancy Roll') + cM_DM);
            tResult('Militancy Score', culM);
    
            culturalProfile = `${toEHex(culD)}${toEHex(culX)}${toEHex(culU)}${toEHex(culS)}-${toEHex(culC)}${toEHex(culP)}${toEHex(culE)}${toEHex(culM)}`;
            tResult('Final Cultural Profile', culturalProfile);

            // Narrative Cultural Quirks (D66)
            tSection('Cultural Quirks (D66)');
            let numQuirks = Math.round(culD / 4);
            let quirks = [];
            const quirkTable = MgT2EData.socioeconomics.culture.differences;

            for (let i = 0; i < numQuirks; i++) {
                let d1 = tRoll1D('Quirk D66 Tens');
                let d2 = tRoll1D('Quirk D66 Ones');
                let lookup = `${d1}${d2}`;
                let trait = quirkTable[lookup] || "Unusual Custom";
                quirks.push(trait);
                tResult(`Cultural Quirk ${i + 1}`, trait);
            }
            base.culturalQuirks = quirks;
        }
    
        // 13. Economic Profile
        tSection('Economic Profile');
        let ggCount = base.gasGiant ? 1 : 0;
        let beltCount = base.size === 0 ? 1 : 0;
        let basesCount = 0;
        if (base.navalBase) basesCount++;
        if (base.scoutBase) basesCount++;
        if (base.militaryBase) basesCount++;
    
        tSection('Eco: Resources (R)');
        let resourceRating = 0;
        if (base.resourceRating !== undefined) {
            resourceRating = base.resourceRating;
            tResult('Base Resource Rating (Prior Generation)', resourceRating);
        } else {
            let rRoll = tRoll2D('Resources Roll');
            resourceRating = rRoll - 7 + base.size;
            let fRR = Math.max(2, Math.min(12, resourceRating));
            if (resourceRating !== fRR) tClamp('Resources Rating', resourceRating, fRR);
            resourceRating = fRR;
            tResult('Base Resource Rating', resourceRating);
        }
    
        let tcArr = tcs;
        tSection('Eco: Importance (Ix)');
        let Im = 0;
        if (['A', 'B'].includes(base.starport)) { tDM('Starport A-B', 1); Im += 1; }
        if (['D', 'E', 'X'].includes(base.starport)) { tDM('Starport D-X', -1); Im -= 1; }
        if (base.tl <= 8) { tDM('TL <= 8', -1); Im -= 1; }
        if (base.tl >= 10 && base.tl <= 15) { tDM('TL 10-15', 1); Im += 1; }
        if (base.tl >= 16) { tDM('TL 16+', 2); Im += 2; }
        if (base.pop <= 6) { tDM('Pop <= 6', -1); Im -= 1; }
        if (base.pop >= 9) { tDM('Pop >= 9', 1); Im += 1; }
        if (tcArr.includes('Ag')) { tDM('Agricultural', 1); Im += 1; }
        if (tcArr.includes('In')) { tDM('Industrial', 1); Im += 1; }
        if (tcArr.includes('Ri')) { tDM('Rich', 1); Im += 1; }
        if (basesCount >= 2) { tDM('Bases >= 2', 1); Im += 1; }
        tResult('Importance Index (Ix)', Im);
    
        tSection('Eco: Resources Final (R)');
        let ecoR = resourceRating;
        if (tcArr.includes('In') || tcArr.includes('Ag')) {
            let consumeRoll = Math.floor(rng() * 6);
            tDM('Industrial/Ag Consumption', -consumeRoll);
            ecoR -= consumeRoll;
            ecoR = Math.max(2, ecoR);
        }
        if (base.tl >= 8) {
            tDM('TL 8+ GG/Belt bonus', ggCount + beltCount);
            ecoR += ggCount + beltCount;
        }
        if (ecoR < 2) {
            ecoR = 2 + ggCount + beltCount;
            tResult('Minimum Resource Floor', ecoR);
        }
        tResult('Final Resources (R)', ecoR);
    
        tSection('Eco: Labor (L)');
        let ecoL = base.pop <= 1 ? 0 : base.pop - 1;
        tResult('Labor (L)', ecoL);
    
        tSection('Eco: Infrastructure (I)');
        let ecoI = Im;
        if (base.pop >= 4 && base.pop <= 6) {
            let infraBonus = Math.floor(rng() * 6) + 1;
            tDM('Pop 4-6 Bonus', infraBonus);
            ecoI += infraBonus;
        }
        if (base.pop >= 7) {
            let infraRoll = tRoll2D('Infrastructure Bonus Roll');
            ecoI += infraRoll;
        }
        if (base.pop === 0 || ecoI < 0) ecoI = 0;
        tResult('Infrastructure (I)', ecoI);
    
        tSection('Eco: Efficiency (E)');
        let ecoE = 0;
        if (base.pop === 0) ecoE = -5;
        else if (base.pop >= 1 && base.pop <= 6) {
            let eRoll = tRoll2D('Efficiency Roll');
            ecoE = eRoll - 7;
        }
        else if (base.pop >= 7) {
            let eRoll = tRoll2D3('Efficiency Roll Base');
            ecoE = eRoll - 4;
        }
    
        let ecoE_DM = 0;
        if ([0, 3, 6, 9, 11, 12, 15].includes(base.gov)) { tDM('Gov 0,3,6,9,11,12,15', -1); ecoE_DM -= 1; }
        if ([1, 2, 4, 5, 8].includes(base.gov)) { tDM('Gov 1,2,4,5,8', 1); ecoE_DM += 1; }
        if (overallLaw >= 0 && overallLaw <= 4) { tDM('Law 0-4', 1); ecoE_DM += 1; }
        if (overallLaw >= 10) { tDM('Law 10+', -1); ecoE_DM -= 1; }
        if (pcr >= 0 && pcr <= 3) { tDM('PCR 0-3', -1); ecoE_DM -= 1; }
        if (pcr >= 8) { tDM('PCR 8+', 1); ecoE_DM += 1; }
        if (culP >= 1 && culP <= 3) { tDM('Culture P 1-3', -1); ecoE_DM -= 1; }
        if (culP >= 9) { tDM('Culture P 9+', 1); ecoE_DM += 1; }
        if (culE >= 1 && culE <= 3) { tDM('Culture E 1-3', -1); ecoE_DM -= 1; }
        if (culE >= 9) { tDM('Culture E 9+', 1); ecoE_DM += 1; }
    
        if (base.pop > 0) {
            ecoE += ecoE_DM;
            let fEE = Math.max(-5, Math.min(5, ecoE));
            if (ecoE !== fEE) tClamp('Efficiency', ecoE, fEE);
            ecoE = fEE;
            if (ecoE === 0) { tResult('Efficiency 0 Neutralized', 1); ecoE = 1; }
        }
        tResult('Efficiency (E)', ecoE);
    
        tSection('Resource Units (RU)');
        let calcR = ecoR === 0 ? 1 : ecoR;
        let calcL = ecoL === 0 ? 1 : ecoL;
        let calcI = ecoI === 0 ? 1 : ecoI;
        let calcE = ecoE === 0 ? 1 : ecoE;
        let RU = calcR * calcL * calcI * calcE;
        tResult('RU calculation', `${calcR}*${calcL}*${calcI}*${calcE} = ${RU}`);
    
        tSection('GWP calculation');
        let gwpBase = Math.max(1, ecoI) + Math.max(1, ecoR);
        if (base.pop === 0) gwpBase = ecoI + ecoR;
        tResult('Initial GWP Base (I+R)', gwpBase);
    
        let maxGwpBase = Math.max(2, 2 * ecoI);
        tResult('Max GWP Base (2*I)', maxGwpBase);
    
        let finalGwpBase = Math.max(2, Math.min(maxGwpBase, gwpBase));
        if (finalGwpBase !== gwpBase) tClamp('GWP Base', gwpBase, finalGwpBase);
        gwpBase = finalGwpBase;
        tResult('Final GWP Base', gwpBase);
    
        let tlMod = base.tl === 0 ? 0.05 : base.tl / 10;
        tResult('TL multiplier', tlMod.toFixed(2));
    
        let portMod = 1.0;
        switch (base.starport) {
            case 'A': portMod = 1.5; break;
            case 'B': portMod = 1.2; break;
            case 'C': portMod = 1.0; break;
            case 'D': portMod = 0.8; break;
            case 'E': portMod = 0.5; break;
            case 'X': 
            default: portMod = 0.2; break;
        }
        tResult('Starport multiplier', portMod.toFixed(2));
    
        let govMod = 1.0;
        switch (base.gov) {
            case 1: govMod = 1.5; break;
            case 2: govMod = 1.2; break;
            case 3: govMod = 0.8; break;
            case 4: govMod = 1.2; break;
            case 5: govMod = 1.3; break;
            case 6: govMod = 0.6; break;
            case 7: govMod = 1.0; break;
            case 8: govMod = 0.9; break;
            case 9: govMod = 0.8; break;
            case 11: govMod = 0.7; break;
            case 13: govMod = 0.6; break;
            case 14: govMod = 0.5; break;
            case 15: govMod = 0.8; break;
        }
        tResult('Government multiplier', govMod.toFixed(2));
    
        let tcMod = 1.0;
        if (tcArr.includes('Ag')) { tResult('Ag multiplier', 0.9); tcMod *= 0.9; }
        if (tcArr.includes('As')) { tResult('As multiplier', 1.2); tcMod *= 1.2; }
        if (tcArr.includes('Ga')) { tResult('Ga multiplier', 1.2); tcMod *= 1.2; }
        if (tcArr.includes('In')) { tResult('In multiplier', 1.1); tcMod *= 1.1; }
        if (tcArr.includes('Na')) { tResult('Na multiplier', 0.9); tcMod *= 0.9; }
        if (tcArr.includes('Ni')) { tResult('Ni multiplier', 0.9); tcMod *= 0.9; }
        if (tcArr.includes('Po')) { tResult('Po multiplier', 0.8); tcMod *= 0.8; }
        if (tcArr.includes('Ri')) { tResult('Ri multiplier', 1.2); tcMod *= 1.2; }
        if (tcMod !== 1.0) tResult('Total Trade Class multiplier', tcMod.toFixed(2));
    
        let totalMods = tlMod * portMod * govMod * tcMod;
        tResult('Combined GWP Multiplier', `${tlMod.toFixed(2)} * ${portMod.toFixed(2)} * ${govMod.toFixed(2)} * ${tcMod.toFixed(2)} = ${totalMods.toFixed(4)}`);
    
        let pcGWP = 0;
        if (ecoE > 0) {
            pcGWP = 1000 * gwpBase * totalMods * ecoE;
            tResult('GWP Calculation (E>0)', `1000 * ${gwpBase} * ${totalMods.toFixed(4)} * ${ecoE} = ${pcGWP.toFixed(2)}`);
        } else if (ecoE < 0) {
            let denomModifier = -(ecoE - 1);
            pcGWP = (1000 * gwpBase * totalMods) / denomModifier;
            tResult('GWP Calculation (E<0)', `(1000 * ${gwpBase} * ${totalMods.toFixed(4)}) / ${denomModifier} = ${pcGWP.toFixed(2)}`);
        } else {
            pcGWP = 1000 * gwpBase * totalMods * 1;
            tResult('GWP Calculation (Neutral)', `1000 * ${gwpBase} * ${totalMods.toFixed(4)} * 1 = ${pcGWP.toFixed(2)}`);
        }
        pcGWP = Math.round(pcGWP);
        tResult('GWP per Capita (Rounded)', pcGWP);
    
        tSection('World Trade Number (WTN)');
        let wtnBase = base.pop;
        if (base.tl <= 1) { tDM('TL <= 1', -1); wtnBase -= 1; }
        else if (base.tl >= 5 && base.tl <= 8) { tDM('TL 5-8', 1); wtnBase += 1; }
        else if (base.tl >= 9 && base.tl <= 14) { tDM('TL 9-14', 2); wtnBase += 2; }
        else if (base.tl >= 15) { tDM('TL 15+', 3); wtnBase += 3; }
    
        let portWtnMod = 0;
        let wIdx = Math.max(0, wtnBase);
        if (wIdx <= 1) {
            if (base.starport === 'A') portWtnMod = 3;
            else if (['B', 'C'].includes(base.starport)) portWtnMod = 2;
            else if (['D', 'E'].includes(base.starport)) portWtnMod = 1;
            else if (base.starport === 'X') portWtnMod = 0;
        } else if (wIdx <= 3) {
            if (['A', 'B'].includes(base.starport)) portWtnMod = 2;
            else if (['C', 'D'].includes(base.starport)) portWtnMod = 1;
            else portWtnMod = 0;
        } else if (wIdx <= 5) {
            if (base.starport === 'A') portWtnMod = 2;
            else if (['B', 'C'].includes(base.starport)) portWtnMod = 1;
            else if (base.starport === 'X') portWtnMod = -5;
            else portWtnMod = 0;
        } else if (wIdx <= 7) {
            if (['A', 'B'].includes(base.starport)) portWtnMod = 1;
            else if (base.starport === 'E') portWtnMod = -1;
            else if (base.starport === 'X') portWtnMod = -6;
            else portWtnMod = 0;
        } else if (wIdx <= 9) {
            if (base.starport === 'A') portWtnMod = 1;
            else if (base.starport === 'D') portWtnMod = -1;
            else if (base.starport === 'E') portWtnMod = -2;
            else if (base.starport === 'X') portWtnMod = -7;
            else portWtnMod = 0;
        } else if (wIdx <= 11) {
            if (base.starport === 'C') portWtnMod = -1;
            else if (base.starport === 'D') portWtnMod = -2;
            else if (base.starport === 'E') portWtnMod = -3;
            else if (base.starport === 'X') portWtnMod = -8;
            else portWtnMod = 0;
        } else if (wIdx <= 13) {
            if (base.starport === 'B') portWtnMod = -1;
            else if (base.starport === 'C') portWtnMod = -2;
            else if (base.starport === 'D') portWtnMod = -3;
            else if (base.starport === 'E') portWtnMod = -4;
            else if (base.starport === 'X') portWtnMod = -9;
            else portWtnMod = 0;
        } else {
            if (base.starport === 'B') portWtnMod = -2;
            else if (base.starport === 'C') portWtnMod = -3;
            else if (base.starport === 'D') portWtnMod = -4;
            else if (base.starport === 'E') portWtnMod = -5;
            else if (base.starport === 'X') portWtnMod = -10;
            else portWtnMod = 0;
        }
        if (portWtnMod !== 0) tDM(`Starport ${base.starport} WTN Mod`, portWtnMod);
    
        let WTN = Math.max(0, wtnBase + portWtnMod);
        tResult('WTN Final', WTN);
    
        tSection('Inequality Rating (IR)');
        let IRroll = tRoll2D('Inequality Roll');
        let IR = 50 - (ecoE * 5) + ((IRroll - 7) * 2);
        tResult('Step 1: Base Inequality (50 - E*5 + (Roll-7)*2)', `50 - (${ecoE}*5) + (${IRroll}-7)*2 = ${IR}`);
    
        if ([6, 11, 15].includes(base.gov)) {
            tResult('Inequality DM: Gov 6,11,15', '+10');
            IR += 10;
        }
        if ([0, 1, 3, 9, 12].includes(base.gov)) {
            tResult('Inequality DM: Gov 0,1,3,9,12', '+5');
            IR += 5;
        }
        if ([4, 8].includes(base.gov)) {
            tResult('Inequality DM: Gov 4,8', '-5');
            IR -= 5;
        }
        if (base.gov === 2) {
            tResult('Inequality DM: Gov 2', '-10');
            IR -= 10;
        }
        if (overallLaw >= 9) {
            let lawBonus = overallLaw - 8;
            tResult(`Inequality DM: Law ${overallLaw} (Law-8)`, `+${lawBonus}`);
            IR += lawBonus;
        }
        if (pcr !== 0) {
            tResult('Inequality DM: PCR Bonus', `+${pcr}`);
            IR += pcr;
        }
        if (ecoI !== 0) {
            tResult('Inequality DM: Infrastructure Drain', `-${ecoI}`);
            IR -= ecoI;
        }
        tResult('Final Inequality Rating (IR)', IR);
    
        tSection('Development Rating (DR)');
        let drFactor1 = pcGWP / 1000;
        let drFactor2 = 1 - (IR / 100);
        let DR = drFactor1 * drFactor2;
        tResult('Step 1: GWP Factor (GWP / 1000)', `${pcGWP} / 1000 = ${drFactor1.toFixed(2)}`);
        tResult('Step 2: Inequality Factor (1 - IR/100)', `1 - (${IR} / 100) = ${drFactor2.toFixed(2)}`);
        tResult('Step 3: Preliminary DR', `${drFactor1.toFixed(2)} * ${drFactor2.toFixed(2)} = ${DR.toFixed(4)}`);
        DR = DR.toFixed(2);
        tResult('Final Development Rating (DR)', DR);
    
        let formatIm = Im >= 0 ? "+" + Im : Im.toString();
        let formatE = ecoE >= 0 ? "+" + ecoE : ecoE.toString();
        let rlie = `${toEHex(ecoR)}${toEHex(ecoL)}${toEHex(ecoI)}${formatE}`;
        let wtnChar = toEHex(WTN);
    
        let economicProfile = `${formatIm}, ${rlie}, ${RU}, Cr${pcGWP}, ${wtnChar}, ${IR}, ${DR}`;
        tResult('Final Economic Profile', economicProfile);
    
        // 14. Starport Profile
        tSection('Starport Profile');
        let spClass = base.starport || 'X';
        let hxObj = 'HN';
        if (['A', 'B', 'C', 'D'].includes(spClass)) {
            let target = 12;
            if (spClass === 'A') target = 6;
            if (spClass === 'B') target = 8;
            if (spClass === 'C') target = 10;
    
            let hxSR = tRoll2D('Highport Check');
            let hxScore = hxSR;
            if (base.pop >= 9) { tDM('Pop 9+', 1); hxScore += 1; }
            if ([9, 10, 11].includes(base.tl)) { tDM('TL 9-11', 1); hxScore += 1; }
            if (base.tl >= 12) { tDM('TL 12+', 2); hxScore += 2; }
    
            if (hxScore >= target) {
                tResult('Highport Present', 'Yes');
                hxObj = 'HY';
            } else {
                tResult('Highport Present', 'No');
            }
        }
    
        let dxObj = (spClass === 'X') ? 'DN' : 'DY';
        tResult('Downport Status', dxObj === 'DY' ? 'Yes' : 'No');
    
        let spIm = Im;
        if (WTN >= 10) { tDM('WTN 10+', 1); spIm += 1; }
        if (WTN <= 4) { tDM('WTN 4-', -1); spIm -= 1; }
    
        let formatSpIm = spIm >= 0 ? "+" + spIm : spIm.toString();
        let starportProfile = `${spClass}-${hxObj}:${dxObj}:${formatSpIm}`;
        tResult('Final Starport Profile', starportProfile);
    
        // 15. Military Profile
        tSection('Military Profile');
    
        let globalMilitancyDM = 0;
        if (culM >= 1 && culM <= 2) globalMilitancyDM = -4;
        else if (culM >= 3 && culM <= 5) globalMilitancyDM = -1;
        else if (culM >= 6 && culM <= 8) globalMilitancyDM = 1;
        else if (culM >= 9 && culM <= 11) globalMilitancyDM = 2;
        else if (culM >= 12) globalMilitancyDM = 4;
        tDM('Cultural Militancy DM', globalMilitancyDM);
    
        let globalDM = globalMilitancyDM;
        tResult('Global Military DM', globalDM);
    
        // Enforcement
        tSection('Mil: Enforcement');
        let enfDM = 0;
        if (base.gov === 0) { tDM('Gov 0', -5); enfDM -= 5; }
        if (base.gov === 11) { tDM('Gov 11', 2); enfDM += 2; }
        if (overallLaw === 0) { tDM('Law 0', -4); enfDM -= 4; }
        if (overallLaw === 1) { tDM('Law 1', -2); enfDM -= 2; }
        if (overallLaw === 2) { tDM('Law 2', -1); enfDM -= 1; }
        if (overallLaw >= 9 && overallLaw <= 11) { tDM('Law 9-11', 2); enfDM += 2; }
        if (overallLaw >= 12) { tDM('Law 12+', 4); enfDM += 4; }
        if (pcr >= 0 && pcr <= 4) { tDM('High PCR', 2); enfDM += 2; }
    
        writeLogLine(`Calculation: 3 (Base) + ${globalDM} (Global DM) + ${enfDM} (Enforcement DMs) = ${3 + globalDM + enfDM}`);
        let enfEff = 3 + globalDM + enfDM;
        let finalEnf = Math.max(1, Math.min(18, enfEff));
        if (enfEff !== finalEnf) tClamp('Enforcement Effect', enfEff, finalEnf);
        enfEff = finalEnf;
        tResult('Enforcement Effect', enfEff);
        let bE = toEHex(enfEff);
    
        // Militia
        tSection('Mil: Militia');
        let milM_DM = 0;
        if (base.gov === 1) { tDM('Gov 1', -4); milM_DM -= 4; }
        if (base.gov === 2) { tDM('Gov 2', 2); milM_DM += 2; }
        if (base.gov === 6) { tDM('Gov 6', -6); milM_DM -= 6; }
        tDM('Law Penalty', -overallLaw);
        milM_DM -= overallLaw;
        if (pcr >= 0 && pcr <= 2) { tDM('PCR 0-2', 2); milM_DM += 2; }
        if (pcr === 3 || pcr === 4) { tDM('PCR 3-4', 1); milM_DM += 1; }
        if (pcr >= 6) { tDM('PCR 6+', -1); milM_DM -= 1; }
        let milMRoll = tRoll2D('Militia Roll') + globalDM + milM_DM;
        let bM = "0";
        if (milMRoll >= 4) {
            let eff = milMRoll - 4;
            let finalEff = Math.max(1, Math.min(18, eff));
            if (eff !== finalEff) tClamp('Militia Effect', eff, finalEff);
            eff = finalEff;
            bM = toEHex(eff);
        }
        tResult('Militia Effect', bM);
    
        // Army
        tSection('Mil: Army');
        let armyDM = 0;
        if (bM !== "0") { tDM('Militia Present', -2); armyDM -= 2; }
        if (base.gov === 0) { tDM('Gov 0', -6); armyDM -= 6; }
        if (base.gov === 7) { tDM('Gov 7', 4); armyDM += 4; }
        if (base.gov >= 10) { tDM('Gov 10+', 4); armyDM += 4; }
        if (base.tl <= 7) { tDM('TL <= 7', 4); armyDM += 4; }
        if (base.tl >= 8) { tDM('TL 8+', -2); armyDM -= 2; }
        if (base.militaryBase) { tDM('Military Base', 6); armyDM += 6; }
    
        let armyRoll = tRoll2D('Army Roll') + globalDM + armyDM;
        let bA = "0";
        if (armyRoll >= 4) {
            let eff = armyRoll - 4;
            let finalEff = Math.max(1, Math.min(18, eff));
            if (eff !== finalEff) tClamp('Army Effect', eff, finalEff);
            eff = finalEff;
            bA = toEHex(eff);
        }
        tResult('Army Effect', bA);
    
        // Wet Navy
        tSection('Mil: Wet Navy');
        let wetDM = 0;
        if (hydroCode === 0) { tDM('Hydro 0', -20); wetDM -= 20; }
        if (hydroCode >= 1 && hydroCode <= 3) { tDM('Hydro 1-3', -5); wetDM -= 5; }
        if (hydroCode === 8) { tDM('Hydro 8', 2); wetDM += 2; }
        if (hydroCode === 9) { tDM('Hydro 9', 4); wetDM += 4; }
        if (hydroCode >= 10) { tDM('Hydro A', 8); wetDM += 8; }
        if (base.gov === 7) { tDM('Gov 7', 4); wetDM += 4; }
        if (base.tl === 0) { tDM('TL 0', -8); wetDM -= 8; }
        if (base.tl === 8 || base.tl === 9) { tDM('TL 8-9', -2); wetDM -= 2; }
        if (base.tl >= 10) { tDM(`TL ${base.tl} penalty`, -base.tl); wetDM -= base.tl; }
        let wetRoll = tRoll2D('Wet Navy Roll') + globalDM + wetDM;
        let bW = "0";
        if (wetRoll >= 4) {
            let eff = wetRoll - 4;
            let finalEff = Math.max(1, Math.min(18, eff));
            if (eff !== finalEff) tClamp('Wet Navy Effect', eff, finalEff);
            eff = finalEff;
            bW = toEHex(eff);
        }
        tResult('Wet Navy Effect', bW);
    
        // Air Force
        tSection('Mil: Air Force');
        let airDM = 0;
        if (atmCode <= 1 && base.tl <= 8) { tDM('Thin/No Atm & TL<=8', -20); airDM -= 20; }
        if (([2, 3, 14].includes(atmCode)) && base.tl <= 8) { tDM('Atm 2,3,e & TL<=8', -8); airDM -= 8; }
        if (([4, 5].includes(atmCode)) && base.tl <= 8) { tDM('Atm 4,5 & TL<=8', -2); airDM -= 2; }
        if (base.gov === 7) { tDM('Gov 7', 4); airDM += 4; }
        if (base.tl >= 0 && base.tl <= 2) { tDM('TL 0-2', -20); airDM -= 20; }
        if (base.tl === 3) { tDM('TL 3', -10); airDM -= 10; }
        if (base.tl >= 10 && base.tl <= 12) { tDM('TL 10-12', -4); airDM -= 4; }
        if (base.tl >= 13) { tDM('TL 13+', -6); airDM -= 6; }
        let airRoll = tRoll2D('Air Force Roll') + globalDM + airDM;
        let bF = "0";
        if (airRoll >= 4) {
            let eff = airRoll - 4;
            let finalEff = Math.max(1, Math.min(18, eff));
            if (eff !== finalEff) tClamp('Air Force Effect', eff, finalEff);
            eff = finalEff;
            bF = toEHex(eff);
        }
        tResult('Air Force Effect', bF);
    
        // System Defence
        tSection('Mil: System Defence');
        let sysDM = 0;
        if (base.pop <= 3) { tDM('Pop <= 3', -6); sysDM -= 6; }
        if (base.pop === 4 || base.pop === 5) { tDM('Pop 4-5', -2); sysDM -= 2; }
        if (base.tl <= 5) { tDM('TL <= 5', -20); sysDM -= 20; }
        if (base.tl === 6) { tDM('TL 6', -8); sysDM -= 8; }
        if (base.tl === 7) { tDM('TL 7', -6); sysDM -= 6; }
        if (base.tl === 8) { tDM('TL 8', -2); sysDM -= 2; }
        if (base.starport === 'A') { tDM('Starport A', 4); sysDM += 4; }
        if (base.starport === 'B') { tDM('Starport B', 2); sysDM += 2; }
        if (base.starport === 'C') { tDM('Starport C', 1); sysDM += 1; }
        if (base.starport === 'E') { tDM('Starport E', -2); sysDM -= 2; }
        if (base.starport === 'X') { tDM('Starport X', -8); sysDM -= 8; }
        if (hxObj === 'HY') { tDM('Highport Present', 2); sysDM += 2; }
        if (base.navalBase) { tDM('Naval Base', 4); sysDM += 4; }
        if (base.militaryBase) { tDM('Military Base', 2); sysDM += 2; }
    
        let sysRoll = tRoll2D('System Defence Roll') + globalDM + sysDM;
        let bS = "0";
        if (sysRoll >= 4) {
            let eff = sysRoll - 4;
            let finalEff = Math.max(1, Math.min(18, eff));
            if (eff !== finalEff) tClamp('System Defence Effect', eff, finalEff);
            eff = finalEff;
            bS = toEHex(eff);
        }
        tResult('System Defence Effect', bS);
    
        // Navy
        tSection('Mil: Navy');
        let navDM = 0;
        if (base.pop <= 3) { tDM('Pop <= 3', -6); navDM -= 6; }
        if (base.pop >= 4 && base.pop <= 6) { tDM('Pop 4-6', -3); navDM -= 3; }
        if (base.tl <= 5) { tDM('TL <= 5', -20); navDM -= 20; }
        if (base.tl === 6) { tDM('TL 6', -12); navDM -= 12; }
        if (base.tl === 7) { tDM('TL 7', -8); navDM -= 8; }
        if (base.tl === 8) { tDM('TL 8', -6); navDM -= 6; }
        if (base.starport === 'A') { tDM('Starport A', 4); navDM += 4; }
        if (base.starport === 'B') { tDM('Starport B', 1); navDM += 1; }
        if (base.starport === 'E') { tDM('Starport E', -2); navDM -= 2; }
        if (base.starport === 'X') { tDM('Starport X', -8); navDM -= 8; }
        if (hxObj === 'HY') { tDM('Highport Present', 2); navDM += 2; }
        if (base.navalBase) { tDM('Naval Base', 4); navDM += 4; }
        if (base.militaryBase) { tDM('Military Base', 2); navDM += 2; }
        if (culE >= 1 && culE <= 5) { tDM('Low Expansionism', -2); navDM -= 2; }
        if (culE >= 9 && culE <= 11) { tDM('High Expansionism', 2); navDM += 2; }
        if (culE >= 12) { tDM('Extreme Expansionism', 4); navDM += 4; }
    
        let navRoll = tRoll2D('Navy Roll') + globalDM + navDM;
        let bN = "0";
        if (navRoll >= 4) {
            let eff = navRoll - 4;
            let finalEff = Math.max(1, Math.min(18, eff));
            if (eff !== finalEff) tClamp('Navy Effect', eff, finalEff);
            eff = finalEff;
            bN = toEHex(eff);
        }
        tResult('Navy Effect', bN);
    
        // Marines
        tSection('Mil: Marines');
        let marDM = 0;
        if (base.pop <= 5) { tDM('Pop <= 5', -4); marDM -= 4; }
        if (base.tl <= 8) { tDM('TL <= 8', -6); marDM -= 6; }
        if (base.navalBase) { tDM('Naval Base', 2); marDM += 2; }
        if (base.militaryBase) { tDM('Military Base', 2); marDM += 2; }
        if (bN === "0") { tDM('No Navy', -6); marDM -= 6; }
        if (bS === "0") { tDM('No System Defence', -6); marDM -= 6; }
        if (culE >= 1 && culE <= 5) { tDM('Low Expansionism', -4); marDM -= 4; }
        if (culE >= 9 && culE <= 11) { tDM('High Expansionism', 1); marDM += 1; }
        if (culE >= 12) { tDM('Extreme Expansionism', 2); marDM += 2; }
    
        let marRoll = tRoll2D('Marines Roll') + globalDM + marDM;
        let bMar = "0";
        if (marRoll >= 4) {
            let eff = marRoll - 4;
            let finalEff = Math.max(0, Math.min(18, eff));
            if (eff !== finalEff) tClamp('Marines Effect', eff, finalEff);
            eff = finalEff;
            bMar = toEHex(eff);
        }
        tResult('Marines Effect', bMar);
    
        // Budget
        tSection('Mil: Budget');
        let totalEff = enfEff;
        if (bM !== "0") totalEff += parseInt(bM, 36);
        if (bA !== "0") totalEff += parseInt(bA, 36);
        if (bW !== "0") totalEff += parseInt(bW, 36);
        if (bF !== "0") totalEff += parseInt(bF, 36);
        if (bS !== "0") totalEff += parseInt(bS, 36);
        if (bN !== "0") totalEff += parseInt(bN, 36);
        if (bMar !== "0") totalEff += parseInt(bMar, 36);
    
        let branchDrain = Math.floor(totalEff / 10);
        let budDM = 0;
        if ([0, 2, 4].includes(base.gov)) { tDM('Gov 0,2,4', -2); budDM -= 2; }
        if (base.gov === 5) { tDM('Gov 5', 1); budDM += 1; }
        if (base.gov === 9) { tDM('Gov 9', -1); budDM -= 1; }
        if (base.gov === 10 || base.gov === 15) { tDM('Gov 10,15', 3); budDM += 3; }
        if ([11, 12, 14].includes(base.gov)) { tDM('Gov 11,12,14', 2); budDM += 2; }
        if (overallLaw >= 12) { tDM('Ext Law', 2); budDM += 2; }
        if (base.militaryBase) { tDM('Mil Base', 4); budDM += 4; }
        if (base.navalBase) { tDM('Naval Base', 2); budDM += 2; }
        tDM('Militancy Mod', culM - 5);
        budDM += (culM - 5);
        tDM('Branch Drain Mod', -4 + branchDrain);
        budDM += (-4 + branchDrain);
    
        let rollFactor = tRoll2D('Budget Roll') - 7 + budDM;
        if (rollFactor < -9) { tClamp('Budget Floor', rollFactor, -9); rollFactor = -9; }
    
        let totalBudget = 2.0 * (1 + (ecoE / 10)) * (1 + (rollFactor / 10));
        let formatBudget = totalBudget.toFixed(2) + "%";
        tResult('Final Military Budget', formatBudget);
    
        let militaryProfile = `${bE}${bM}${bA}${bW}${bF}-${bS}${bN}${bMar}:${formatBudget}`;
        tResult('Final Military Profile', militaryProfile);
    
        // =====================================================================
        // ATTACH PROFILES TO BASE OBJECT
        // =====================================================================
    
        base.pValue = pValue;
        base.totalWorldPop = totalWorldPop;
        base.pcr = pcr;
        base.urbanPercent = urbanPercent;
        base.totalUrbanPop = totalUrbanPop;
        base.majorCities = majorCities;
        base.totalMajorCityPop = totalMajorCityPop;
        base.govProfile = govProfile;
        base.factions = factionsString;
        base.lawProfile = lawProfile;
        base.techProfile = techProfile;
        base.culturalProfile = culturalProfile;
        base.economicProfile = economicProfile;
        base.starportProfile = starportProfile;
        base.militaryProfile = militaryProfile;
        base.judicialSystemProfile = judicialSystemProfile;
        base.Im = Im;
        base.ecoR = ecoR;
        base.ecoL = ecoL;
        base.ecoI = ecoI;
        base.ecoE = ecoE;
        base.RU = RU;
        base.pcGWP = pcGWP;
        base.WTN = WTN;
        base.IR = IR;
        base.DR = DR;
    
        // Copy profiles back to mainworld object
        if (mainworld && base !== mainworld) {
            Object.assign(mainworld, base);
            // Recalculate MgT2E trade codes after merge — base may carry CT-format trade
            // codes (e.g. no Hi/Ht/Lo/Sa) that differ from MgT2E expectations, which
            // would cause the post-generation audit to flag a trade-code mismatch for
            // every system expanded from a CT mainworld baseline.
            mainworld.tradeCodes = calculateMgT2ETradeCodes(mainworld);
        }
    
        return sys;
    }

    // =====================================================================
    // CORE FUNCTION 3: FINALIZE SUBORDINATE SOCIAL
    // =====================================================================

    /**
     * Finalize subordinate world classifications and social characteristics.
     * Evaluates worlds for Mining, Farming, Research, Military, and Penal classifications.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object} mainworldBase - Mainworld baseline data
     * @returns {Object} Modified system object
     */
    function finalizeSubordinateSocial(sys, mainworldBase) {
        tSection('Secondary World Classifications');

        if (!mainworldBase || mainworldBase.pop === 0) {
            tSkip('No mainworld baseline');
            return sys;
        }

        const mw = mainworldBase;
        const isPoor = (mw.tradeCodes && mw.tradeCodes.includes("Po"));
        const isInd = (mw.tradeCodes && mw.tradeCodes.includes("In"));

        // Safety-net: zero out any world whose atmosphere floor exceeds the mainworld's
        // finalised TL. This catches edge cases where the Phase 6 ruin check used a
        // slightly different TL (e.g. before extended-socio wrote back a revised value).
        const uninhabitIfUnsupported = (body) => {
            if (!body || body.pop === 0) return;
            const bAtm = body.atmCode !== undefined ? body.atmCode : (body.atm || 0);
            const bFloor = getMgT2EMinSusTL(bAtm);
            if (bFloor > mw.tl) {
                tResult(`Uninhabited Safety-Net (Orbit ${body.orbitId !== undefined ? body.orbitId.toFixed(2) : 'Moon'})`,
                    `Floor ${bFloor} > Mainworld TL ${mw.tl} — zeroing out`);
                body.pop = 0; body.popCode = 0;
                body.gov = 0; body.govCode = 0;
                body.law = 0; body.lawCode = 0;
                body.tl = 0;  body.tlCode = 0;
                syncUWP(body);
            }
        };

        // Process all subordinate worlds.
        // Moon loop runs FIRST (before the Gas Giant continue check) — mirrors generateCoreSocial
        // ordering and ensures Gas Giant moons (e.g. sub-gas-giant satellites) receive the
        // uninhabited floor check even though their parent is skipped.
        for (let w of sys.worlds) {
            for (let m of w.moons || []) {
                if (m.type === 'Empty' || m.isLunarMainworld || m.type === 'Mainworld') continue;
                uninhabitIfUnsupported(m);
                if (m.type !== 'Gas Giant') {
                    processSecondaryClassifications(m, mw, isPoor, isInd, sys);
                }
            }

            if (w.type === 'Mainworld' || w.type === 'Empty' || w.type === 'Gas Giant') continue;
            uninhabitIfUnsupported(w);
            processSecondaryClassifications(w, mw, isPoor, isInd, sys);
        }

        return sys;
    }

    /**
     * Process secondary classifications for a single body
     * @param {Object} body - World or moon to classify
     * @param {Object} mw - Mainworld reference
     * @param {boolean} isPoor - Is mainworld Poor?
     * @param {boolean} isInd - Is mainworld Industrial?
     * @param {Object} sys - System object for context
     */
    function processSecondaryClassifications(body, mw, isPoor, isInd, sys) {
        if (!body.pop || body.pop === 0) return;

        tSection(`Classifications: ${body.name || body.type} Orbit ${body.orbitId !== undefined ? body.orbitId.toFixed(2) : (body.pd !== undefined ? body.pd.toFixed(1) + 'r' : 'Unknown')}`);
        body.classifications = body.classifications || [];

        const diff = body.orbitId !== undefined ? getEffectiveHzcoDeviation(body.orbitId, body.worldHzco || sys.hzco) : 99;

        // Farming
        if (Math.abs(diff) <= 1.0 && (body.atmCode >= 4 && body.atmCode <= 9) && 
            (body.hydroCode >= 4 && body.hydroCode <= 8) && body.pop >= 2) {
            tResult('Classification', 'Farming');
            body.classifications.push("Farming");
        }

        // Mining
        if (isInd && body.pop >= 2) {
            let mRoll = tRoll2D('Mining Presence Roll');
            if (body.type === 'Planetoid Belt') { tDM('Planetoid Belt', 4); mRoll += 4; }
            if (mRoll >= 8) {
                tResult('Classification', 'Mining');
                body.classifications.push("Mining");
                
                // WBH Guidelines: Mining Facility TL = max(MW TL, Floor)
                const floor = getMgT2EMinSusTL(body.atmCode || 0);
                const targetTl = Math.max(mw.tl, floor);
                if (body.tl < targetTl) {
                    tOverride('Tech Level (Mining)', body.tl, targetTl, 'Higher of Mainworld TL or Floor per WBH guidelines');
                    body.tl = targetTl;
                    syncUWP(body);
                }
            }
        }

        // Research Base
        if (mw.pop >= 6 && mw.tl >= 8 && !isPoor) {
            let rRoll = tRoll2D('Research Base Roll');
            if (mw.tl >= 12) { tDM('High TL MW', 2); rRoll += 2; }
            if (rRoll >= 10) {
                tResult('Classification', 'Research Base');
                body.classifications.push("Research Base");
                
                // WBH Guidelines: Research Base TL = Mainworld TL (Set Directly)
                if (body.tl !== mw.tl) {
                    tOverride('Tech Level (Research Base)', body.tl, mw.tl, 'Forced to match Mainworld TL per WBH guidelines');
                    body.tl = mw.tl;
                    syncUWP(body);
                }
            }
        }

        // Military Base
        if (mw.tl >= 8 && !isPoor && body.gov === 6) {
            if (tRoll2D('Military Base Roll') >= 12) {
                tResult('Classification', 'Military Base');
                body.classifications.push("Military Base");
                
                // WBH Guidelines: Military Base TL = Mainworld TL (Set Directly)
                if (body.tl !== mw.tl) {
                    tOverride('Tech Level (Military Base)', body.tl, mw.tl, 'Forced to match Mainworld TL per WBH guidelines');
                    body.tl = mw.tl;
                    syncUWP(body);
                }
            }
        }

        // Penal Colony
        if (mw.tl >= 9 && mw.law >= 8 && body.gov === 6) {
            if (tRoll2D('Penal Colony Roll') >= 10) {
                tResult('Classification', 'Penal Colony');
                body.classifications.push("Penal Colony");
            }
        }

        if (body.classifications.length === 0) {
            body.classifications.push('Standard');
        }

        tResult('Final Classifications', body.classifications.join(', '));
    }

    /**
     * Helper: Get effective HZCO deviation
     */
    function getEffectiveHzcoDeviation(orbitId, hzco) {
        if (orbitId < 1.0 || hzco < 1.0) {
            return (orbitId - hzco) / Math.max(0.01, Math.min(orbitId, hzco));
        }
        return orbitId - hzco;
    }

    // =====================================================================
    // CORE FUNCTION 4: GENERATE MAINWORLD UWP
    // =====================================================================

    /**
     * Generate the primary UWP statistics for a new mainworld.
     * @param {string} hexId 
     * @param {Object} existingWorld 
     * @returns {Object} mainworld object
     */
    function generateMainworldUWP(hexId, existingWorld = null) {
        let name = existingWorld?.name || ((typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unnamed');
        // startTrace and reseedForHex are handled by Orchestrator
        let isNativeSophont = existingWorld && existingWorld.nativeSophont === true;

        let size = 0, atm = 0, hydro = 0, pop = 0, gov = 0, law = 0, tl = 0, starport = 'X', popDigit = null;
        let pValue = 0; // Internal reference for extended socio

        let hasPhysicals = existingWorld && (existingWorld.size !== undefined);
        let hasSocials = existingWorld && (existingWorld.pop !== undefined || existingWorld.popCode !== undefined || existingWorld.uwp !== undefined);

        if (hasPhysicals) {
            tSection('World Characteristics (Inherited Physicals)');
            size = (existingWorld.size !== undefined) ? existingWorld.size : 0;
            atm = (existingWorld.atmCode !== undefined) ? existingWorld.atmCode : (existingWorld.atm !== undefined ? existingWorld.atm : 0);
            hydro = (existingWorld.hydroCode !== undefined) ? existingWorld.hydroCode : (existingWorld.hydro !== undefined ? existingWorld.hydro : 0);
            
            tResult('Size Code', size);
            tResult('Atmosphere Code', atm);
            tResult('Hydrographic Code', hydro);
        } else {
            // ── Size ──────────────────────────────────────────────────────
            tSection('Planetary Size');
            let sRoll = tRoll2D('Size');
            tDM('Standard Size', -2);
            let rawSize = sRoll - 2;
            size = Math.max(0, rawSize);
            if (rawSize !== size) tClamp('Size', rawSize, size);
            tResult('Size Code', size);

            // ── Atmosphere ────────────────────────────────────────────────
            tSection('Planetary Atmosphere');
            if (size > 0) {
                let atmRoll = tRoll2D('Atmosphere');
                tDM('Standard Atmo', -7);
                tDM('Size Code', size);
                let rawAtm = atmRoll - 7 + size;
                atm = Math.max(0, rawAtm);
                if (rawAtm !== atm) tClamp('Atmosphere', rawAtm, atm);
            } else {
                tSkip('Size 0 forces Atm 0');
            }
            tResult('Atmosphere Code', atm);

            // ── Hydrographics ─────────────────────────────────────────────
            tSection('Hydrographic Percentage');
            if (size > 1) {
                let hydroRoll = tRoll2D('Hydrographics');
                tDM('Standard Hydro', -7);
                tDM('Atmosphere Code', atm);
                if (atm <= 1 || atm >= 10) {
                    tDM('Atmosphere Extreme', -4);
                }
                let hydroDM = (atm <= 1 || atm >= 10) ? -4 : 0;
                let rawHydro = hydroRoll - 7 + atm + hydroDM;
                hydro = Math.max(0, rawHydro);
                if (rawHydro !== hydro) tClamp('Hydrographics', rawHydro, hydro);
            } else {
                tSkip('Size ≤ 1 forces Hydro 0');
            }
            tResult('Hydrographic Code', hydro);
        }

        if (hasSocials) {
            tSection('World Characteristics (Inherited Socials)');
            pop = (existingWorld.popCode !== undefined) ? existingWorld.popCode : (existingWorld.pop !== undefined ? existingWorld.pop : 0);
            gov = (existingWorld.govCode !== undefined) ? existingWorld.govCode : (existingWorld.gov !== undefined ? existingWorld.gov : 0);
            law = (existingWorld.law !== undefined) ? existingWorld.law : 0;
            tl = (existingWorld.tl !== undefined) ? existingWorld.tl : 0;
            starport = existingWorld.starport || 'X';
            popDigit = (existingWorld.popDigit !== undefined) ? existingWorld.popDigit : (existingWorld.pValue !== undefined ? existingWorld.pValue : null);
            
            tSkip('UWP Social Characteristics inherited from existing world');
            tResult('Population Code', pop);
            tResult('Government Code', gov);
            tResult('Law Level Code', law);
            tResult('Tech Level Code', tl);
            tResult('Starport Class', starport);
            if (popDigit !== null) tResult('P-Value (Inherited)', popDigit);
        }

        if (!hasSocials) {
            // ── Population ────────────────────────────────────────────────
            tSection('Population');
            let popRoll = tRoll2D('Population');
            tDM('Standard Pop', -2);
            let rawPop = popRoll - 2;
            pop = Math.max(0, rawPop);
            
            if (isNativeSophont) {
                if (pop < 6) {
                    tOverride('Population Code', pop, 6, 'Native Sophont Minimum');
                    pop = 6;
                }
            } else {
                if (rawPop !== pop) tClamp('Population', rawPop, pop);
            }
            tResult('Population Code', pop);
        }

        if (!hasSocials) {
            // ── Starport ──────────────────────────────────────────────────
            tSection('Starport Class');
            let starportDM = 0;
            const spData = MgT2EData.starport;

            if (spData && spData.populationDMs) {
                for (let rule of spData.populationDMs) {
                    if (pop >= rule.minPop && pop <= rule.maxPop) {
                        tDM(`Population ${rule.minPop}-${rule.maxPop}`, rule.dm);
                        starportDM += rule.dm;
                        break;
                    }
                }
            }

            if (isNativeSophont && spData && spData.nativeSophontDM !== undefined) {
                tDM('Native Sophont', spData.nativeSophontDM);
                starportDM += spData.nativeSophontDM;
            }

            let starportRoll = tRoll2D('Starport');
            let spTotal = starportRoll + starportDM;
            starport = 'X';

            if (spData && spData.classMap) {
                for (let entry of spData.classMap) {
                    if (spTotal <= entry.maxRoll) {
                        starport = entry.class;
                        break;
                    }
                }
            } else {
                // Fallback if Data Shield is missing
                starport = spTotal <= 2 ? 'X' : spTotal <= 4 ? 'E' : spTotal <= 6 ? 'D' : spTotal <= 8 ? 'C' : spTotal <= 10 ? 'B' : 'A';
            }
            tResult('Starport Class', `${starport} (${spTotal})`);
        }

        if (!hasSocials) {
            // ── Government & Law ──────────────────────────────────────────
            if (pop > 0) {
                tSection('Government');
                let govRoll = tRoll2D('Government');
                tDM('Standard Gov', -7);
                tDM('Population Code', pop);
                let rawGov = govRoll - 7 + pop;
                gov = Math.max(0, rawGov);
                if (rawGov !== gov) tClamp('Government', rawGov, gov);
                tResult('Government Code', gov);

                tSection('Law Level');
                let lawRoll = tRoll2D('Law Level');
                tDM('Standard Law', -7);
                tDM('Government Code', gov);
                let rawLaw = lawRoll - 7 + gov;
                law = Math.max(0, rawLaw);
                if (rawLaw !== law) tClamp('Law Level', rawLaw, law);
                tResult('Law Level Code', law);

                // ── Tech Level ────────────────────────────────────────────
                tSection('Technological Level');
                tRoll1D('Tech Level');

                // Starport DMs
                if (starport === 'A') tDM('Starport A', 6);
                else if (starport === 'B') tDM('Starport B', 4);
                else if (starport === 'C') tDM('Starport C', 2);
                else if (starport === 'D' || starport === 'E') tDM('Starport D/E', 1);
                else if (starport === 'X') tDM('Starport X', -4);

                if (!isNativeSophont) {
                    // Size DMs
                    if (size <= 1) tDM('Size 1-', 2);
                    else if (size >= 2 && size <= 4) tDM('Size 2-4', 1);

                    // Atmosphere DMs
                    if (atm <= 3 || atm >= 10) tDM('Atmosphere Extreme', 1);

                    // Hydrographics DMs
                    if (hydro === 0) tDM('Hydrographics 0', 1);
                    else if (hydro === 9) tDM('Hydrographics 9', 1);
                    else if (hydro === 10) tDM('Hydrographics A', 2);
                }

                // Population DMs
                if (pop >= 1 && pop <= 5) tDM('Population 1-5', 1);
                else if (pop === 8) tDM('Population 8', 1);
                else if (pop === 9) tDM('Population 9', 2);
                else if (pop >= 10) tDM('Population 10+', 4);

                // Government DMs
                if (gov === 0 || gov === 5) tDM('Government 0 or 5', 1);
                else if (gov === 7) tDM('Government 7', 2);
                else if (gov >= 13) tDM('Government D+', -2);

                // Calculate Base TL
                const currentDMs = typeof pendingRoll !== 'undefined' && pendingRoll && pendingRoll.dms ? pendingRoll.dms.reduce((a, b) => a + b.val, 0) : 0;
                let rawTl = (typeof pendingRoll !== 'undefined' && pendingRoll ? pendingRoll.val : 0) + currentDMs;
                let baseTl = Math.max(0, rawTl);

                // Enforce Environmental Limits (Minimum TL)
                if (isNativeSophont && MgT2EData.techLevel.nativeSophontExceptions?.ignoreEnvironmentalMinimums) {
                    tl = baseTl;
                    if (rawTl !== baseTl) tClamp('Tech Level', rawTl, baseTl); // Standard floor clamp
                    tResult('Environmental Minimum Override', 'Ignored for Native Sophonts');
                } else {
                    let minTl = getMgT2EMinSusTL(atm);
                    tl = baseTl; // WBH RAW: Do not bump UWP TL to meet floor.
                    if (rawTl !== baseTl) tClamp('Tech Level', rawTl, baseTl);

                    if (tl < minTl) {
                        tResult('Survival State', `Jury-Rigged / Relic Tech (Base TL ${tl} < Floor TL ${minTl})`);
                    }
                }

                tResult('Tech Level Code', tl);
            } else {
                tSection('Government / Law / TL');
                tSkip('Population 0 forces Gov/Law/TL 0');
            }
        }

        // ── Bases ─────────────────────────────────────────────────────
        tSection('Bases');
        let navalBase = false, scoutBase = false, militaryBase = false, corsairBase = false;
        const baseData = MgT2EData.bases;

        if (baseData) {
            // Dynamic Base Pull from Data Shield (arrays of { starports, target })
            const findRule = (rules) => Array.isArray(rules) ? rules.find(r => r.starports && r.starports.includes(starport)) : null;

            const milRule = findRule(baseData.military);
            if (milRule) {
                militaryBase = tRoll2D('Military Base Check') >= milRule.target;
                tResult('Military Base Present', militaryBase);
            }
            const navRule = findRule(baseData.naval);
            if (navRule) {
                navalBase = tRoll2D('Naval Base Check') >= navRule.target;
                tResult('Naval Base Present', navalBase);
            }
            const sctRule = findRule(baseData.scout);
            if (sctRule) {
                scoutBase = tRoll2D('Scout Base Check') >= sctRule.target;
                tResult('Scout Base Present', scoutBase);
            }
            const corRule = findRule(baseData.corsair);
            if (corRule) {
                let corsairRoll = tRoll2D('Corsair Base Check');
                let lawDM = 0;
                if (baseData.corsairLawDMs) {
                    for (let dm of baseData.corsairLawDMs) {
                        if (dm.law !== undefined && law === dm.law) { lawDM = dm.dm; break; }
                        if (dm.minLaw !== undefined && law >= dm.minLaw && law <= dm.maxLaw) { lawDM = dm.dm; break; }
                    }
                } else {
                    if (law === 0) lawDM = 2;
                    else if (law >= 2) lawDM = -2;
                }
                corsairBase = (corsairRoll + lawDM) >= corRule.target;
                tResult('Corsair Base Present', corsairBase);
            }
        } else {
            // Legacy Hardcoded Fallback
            if (starport === 'A' || starport === 'B') {
                militaryBase = tRoll2D('Military Base (8+)') >= 8;
                navalBase = tRoll2D('Naval Base (8+)') >= 8;
                tResult('Mil/Nav Bases', `${militaryBase}/${navalBase}`);
            } else if (starport === 'C') {
                militaryBase = tRoll2D('Military Base (10+)') >= 10;
                tResult('Mil Base', militaryBase);
            }
            if (['A', 'B', 'C', 'D'].includes(starport)) {
                let threshold = starport === 'A' ? 10 : starport === 'B' || starport === 'C' ? 9 : 8;
                scoutBase = tRoll2D(`Scout Base (${threshold}+)`) >= threshold;
                tResult('Scout Base', scoutBase);
            }
            if (['D', 'E', 'X'].includes(starport)) {
                let cr = tRoll2D('Corsair Base');
                let threshold = starport === 'D' ? 12 : 10;
                corsairBase = (cr + (law === 0 ? 2 : law >= 2 ? -2 : 0)) >= threshold;
                tResult('Corsair Base', corsairBase);
            }
        }

        // ── Gas Giant ─────────────────────────────────────────────────
        tSection('Gas Giant Presence');
        let ggRoll = tRoll2D('Gas Giant (9-)');
        let gasGiant = ggRoll <= 9;
        tResult('Gas Giant Present', gasGiant);

        // ── Trade Codes (Corrected for MGT2E Compliance) ───────────────
        const tradeCodes = calculateMgT2ETradeCodes({
            size, atm, hydro, pop, gov, law, tl
        });

        // ── Travel Zone ───────────────────────────────────────────────
        tSection('Travel Zone');
        let travelZone = "Green";
        const isAmber = (atm >= 10) && ([0, 7, 10].includes(gov)) && (law === 0 || law >= 9);
        if (isAmber) {
            travelZone = "Amber";
            tResult('Travel Zone', 'Amber (Environmental/Social hazard)');
        } else if (starport === 'X') {
            travelZone = "Red";
            tResult('Travel Zone', 'Red (Starport X)');
        } else {
            tResult('Travel Zone', 'Green');
        }

        tSection('System Name');
        tResult('Assigned Name', name);

        // Apply Clamping for final UWP string
        size = clampUWP(size, 0, 15);
        atm = clampUWP(atm, 0, 15);
        hydro = clampUWP(hydro, 0, 10);
        pop = clampUWP(pop, 0, 15);
        gov = clampUWP(gov, 0, 15);
        law = clampUWP(law, 0, 15);
        tl = clampUWP(tl, 0, 33);

        const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;

        if (existingWorld) {
            existingWorld.name = name;
            existingWorld.uwp = uwp;
            existingWorld.uwpSecondary = uwp;
            existingWorld.travelZone = travelZone;
            existingWorld.tradeCodes = tradeCodes;
            existingWorld.starport = starport;
            existingWorld.size = size;
            existingWorld.atm = atm;
            existingWorld.atmCode = atm;
            existingWorld.hydro = hydro;
            existingWorld.hydroCode = hydro;
            existingWorld.pop = pop;
            existingWorld.popCode = pop;
            existingWorld.gov = gov;
            existingWorld.govCode = gov;
            existingWorld.law = law;
            existingWorld.lawCode = law;
            existingWorld.tl = tl;
            existingWorld.tlCode = tl;
            existingWorld.navalBase = navalBase;
            existingWorld.scoutBase = scoutBase;
            existingWorld.militaryBase = militaryBase;
            existingWorld.corsairBase = corsairBase;
            existingWorld.gasGiant = gasGiant;
            return existingWorld;
        }

        return { 
            type: 'Mainworld', 
            hexId, name, uwp, uwpSecondary: uwp, travelZone, tradeCodes, starport, 
            size, atm, atmCode: atm, hydro, hydroCode: hydro, 
            pop, popCode: pop, gov, govCode: gov, law, lawCode: law, tl, tlCode: tl,
            navalBase, scoutBase, militaryBase, corsairBase, gasGiant 
        };
    }

    // =====================================================================
    // EXPORTS
    // =====================================================================

    exports.generateCoreSocial = generateCoreSocial;
    exports.generateExtendedSocioeconomics = generateExtendedSocioeconomics;
    exports.finalizeSubordinateSocial = finalizeSubordinateSocial;
    exports.generateMainworldUWP = generateMainworldUWP;
}));
