// =====================================================================
// MONGOOSE 2ND EDITION (MGT2E) GENERATION ENGINE
// =====================================================================

// =====================================================================
// DICE ROLLING HELPER FUNCTIONS
// =====================================================================
// Note: roll1D, roll2D, rollD3, and rollND are defined in core.js
// Additional MGT2E-specific dice helpers:

function roll3D() {
    return roll1D() + roll1D() + roll1D();
}

function roll4D() {
    return rollND(4);
}

// Convert to Traveller eHex (skipping I and O)
function toEHex(val) {
    if (val === undefined || val === null) return '0';
    if (val <= 9) return val.toString();
    const hexChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skip I and O
    return hexChars[val - 10] || '0';
}

// =====================================================================
// MGT2E MAINWORLD GENERATION
// =====================================================================

function generateMgT2EMainworld(hexId) {
    let name = getNextSystemName(hexId);
    if (window.isLoggingEnabled) startTrace(hexId, 'MgT2E Mainworld', name);
    reseedForHex(hexId);

    // ── Size ──────────────────────────────────────────────────────
    tSection('Planetary Size');
    let sRoll = tRoll2D('Size');
    tDM('Standard Size', -2);
    let rawSize = sRoll - 2;
    let size = Math.max(0, rawSize);
    if (rawSize !== size) tClamp('Size', rawSize, size);
    tResult('Size Code', size);

    // ── Atmosphere ────────────────────────────────────────────────
    tSection('Planetary Atmosphere');
    let atm = 0;
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
    let hydro = 0;
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

    // ── Population ────────────────────────────────────────────────
    tSection('Population');
    let popRoll = tRoll2D('Population');
    tDM('Standard Pop', -2);
    let rawPop = popRoll - 2;
    let pop = Math.max(0, rawPop);
    if (rawPop !== pop) tClamp('Population', rawPop, pop);
    tResult('Population Code', pop);

    // ── Starport ──────────────────────────────────────────────────
    tSection('Starport Class');
    if (pop >= 10) tDM('Population 10+', 2);
    else if (pop >= 8) tDM('Population 8-9', 1);
    else if (pop <= 2) tDM('Population 2-', -2);
    else if (pop <= 4) tDM('Population 3-4', -1);

    let starportRoll = tRoll2D('Starport');
    let starportDM = 0;
    if (pop >= 10) starportDM = 2;
    else if (pop >= 8) starportDM = 1;
    else if (pop <= 2) starportDM = -2;
    else if (pop <= 4) starportDM = -1;

    let spTotal = starportRoll + starportDM;
    let starport = spTotal <= 2 ? 'X' : spTotal <= 4 ? 'E' : spTotal <= 6 ? 'D'
        : spTotal <= 8 ? 'C' : spTotal <= 10 ? 'B' : 'A';
    tResult('Starport Class', `${starport} (${spTotal})`);

    // ── Government & Law ──────────────────────────────────────────
    let gov = 0, law = 0, tl = 0;
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

        if (starport === 'A') tDM('Starport A', 6);
        else if (starport === 'B') tDM('Starport B', 4);
        else if (starport === 'C') tDM('Starport C', 2);
        else if (starport === 'X') tDM('Starport X', -4);

        if (size <= 1) tDM('Size 1-', 2);
        else if (size <= 4) tDM('Size 2-4', 1);

        if (atm <= 3 || atm >= 10) tDM('Atmosphere Extreme', 1);

        if (hydro === 9) tDM('Hydrographics 9', 1);
        else if (hydro === 10) tDM('Hydrographics A', 2);

        if (pop >= 1 && pop <= 5) tDM('Population 1-5', 1);
        else if (pop === 9) tDM('Population 9', 2);
        else if (pop >= 10) tDM('Population 10+', 4);

        if (gov === 0 || gov === 5) tDM('Government 0 or 5', 1);
        else if (gov === 7) tDM('Government 7', 2);
        else if (gov >= 13) tDM('Government D+', -2);

        const currentDMs = pendingRoll.dms.reduce((a, b) => a + b.val, 0);
        let rawTl = pendingRoll.val + currentDMs;
        tl = Math.max(0, rawTl);
        if (rawTl !== tl) tClamp('Tech Level', rawTl, tl);
        tResult('Tech Level Code', tl);
    } else {
        tSection('Government / Law / TL');
        tSkip('Population 0 forces Gov/Law/TL 0');
    }

    // ── Bases ─────────────────────────────────────────────────────
    tSection('Bases');
    let navalBase = false, scoutBase = false, militaryBase = false, corsairBase = false;

    if (starport === 'A' || starport === 'B') {
        let mr = tRoll2D('Military Base (8+)');
        militaryBase = mr >= 8;
        tResult('Military Base Present', militaryBase);
        let nr = tRoll2D('Naval Base (8+)');
        navalBase = nr >= 8;
        tResult('Naval Base Present', navalBase);
    } else if (starport === 'C') {
        let mr = tRoll2D('Military Base (10+)');
        militaryBase = mr >= 10;
        tResult('Military Base Present', militaryBase);
    } else {
        tSkip('Military/Naval Bases (Required Starport A-C)');
    }

    if (['A', 'B', 'C', 'D'].includes(starport)) {
        let threshold = starport === 'A' ? 10 : starport === 'B' || starport === 'C' ? 9 : 8;
        let sr = tRoll2D(`Scout Base (${threshold}+)`);
        scoutBase = sr >= threshold;
        tResult('Scout Base Present', scoutBase);
    } else {
        tSkip('Scout Base (Required Starport A-D)');
    }

    if (['D', 'E', 'X'].includes(starport)) {
        if (law === 0) tDM('Law 0', 2);
        else if (law >= 2) tDM('Law 2+', -2);
        let cr = tRoll2D('Corsair Base');
        let threshold = starport === 'D' ? 12 : 10;
        let finalCR = cr + (law === 0 ? 2 : law >= 2 ? -2 : 0);
        corsairBase = finalCR >= threshold;
        tResult('Corsair Base Present', corsairBase);
    } else {
        tSkip('Corsair Base (Required Starport D-X)');
    }

    // ── Gas Giant ─────────────────────────────────────────────────
    tSection('Gas Giant Presence');
    let ggRoll = tRoll2D('Gas Giant (9-)');
    let gasGiant = ggRoll <= 9;
    tResult('Gas Giant Present', gasGiant);

    // ── Trade Codes (Corrected for MGT2E Compliance) ───────────────
    tSection('Trade Classifications');
    let tradeCodes = [];
    const tc = (code, cond, reason) => { if (cond) { tradeCodes.push(code); tTrade(code, reason); } };

    // Compliant Logic
    tc('Ag', atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7, `Atm 4-9, Hyd 4-8, Pop 5-7`);
    tc('As', size === 0 && atm === 0 && hydro === 0, `Size 0, Atm 0, Hyd 0`);
    tc('Ba', pop === 0 && gov === 0 && law === 0, `Pop 0, Gov 0, Law 0`);
    tc('De', atm >= 2 && atm <= 9 && hydro === 0, `Atm 2-9, Hyd 0`);
    tc('Fl', atm >= 10 && hydro >= 1, `Atm 10+, Hyd 1+`);
    tc('Ga', (size >= 6 && size <= 8) && [5, 6, 8].includes(atm) && (hydro >= 5 && hydro <= 7), `Siz 6-8, Atm 5,6,8, Hyd 5-7`);
    tc('Hi', pop >= 9, `Pop 9+`);
    tc('Ht', tl >= 12, `TL 12+`);
    tc('Ic', atm <= 1 && hydro >= 1, `Atm 0-1, Hyd 1+`);
    tc('In', [0, 1, 2, 4, 7, 9, 10, 11, 12].includes(atm) && pop >= 9, `Atm 0-2,4,7,9-12, Pop 9+`);
    tc('Lo', pop >= 1 && pop <= 3, `Pop 1-3`);
    tc('Lt', tl <= 5, `TL 5-`);
    tc('Na', atm <= 3 && hydro <= 3 && pop >= 6, `Atm 0-3, Hyd 0-3, Pop 6+`);
    tc('Ni', pop >= 4 && pop <= 6, `Pop 4-6`);
    tc('Po', atm >= 2 && atm <= 5 && hydro <= 3, `Atm 2-5, Hyd 0-3`);
    tc('Ri', [6, 8].includes(atm) && (pop >= 6 && pop <= 8) && (gov >= 4 && gov <= 9), `Atm 6,8, Pop 6-8, Gov 4-9`);
    tc('Va', atm === 0, `Atm 0`);
    tc('Wa', (atm >= 3 && atm <= 9 || atm >= 13) && hydro >= 10, `Atm 3-9/13+, Hyd A+`);

    if (tradeCodes.length === 0) tResult('Trade Codes', 'None');
    else tResult('Final Trade Codes', tradeCodes.join(' '));

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

    if (window.isLoggingEnabled) endTrace();

    return { name, uwp, uwpSecondary: uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, navalBase, scoutBase, militaryBase, corsairBase, gasGiant };
}

// =====================================================================
// MGT2E SOCIOECONOMICS GENERATION
// =====================================================================

function getMgT2EMinSusTL(atmCode) {
    if ([0, 1, 10].includes(atmCode)) return 8;
    if ([2, 3, 13, 14].includes(atmCode)) return 5;
    if ([4, 7, 9].includes(atmCode)) return 3;
    if (atmCode === 11) return 9;
    if (atmCode === 12) return 10;
    if ([16, 17].includes(atmCode)) return 14;
    return 0;
}

function generateMgT2ESubordinateSocial(body, mainworld) {
    if (!body || !mainworld) return;
    tSection(`Subordinate Social: ${body.name || body.type}`);

    // 1. Population (WBH Dependent)
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

    // 2. Government (Dependent)
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
        else body.gov = 6; // Captive
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

    // 4. Spaceport (Subordinate/Spaceports only)
    tSection('Spaceport');
    let spDM = 0;
    if (body.pop >= 6) { tDM('Pop 6+', 2); spDM += 2; }
    if (body.pop === 1) { tDM('Pop 1', -1); spDM -= 1; }
    if (body.pop === 0) { tDM('Pop 0', -3); spDM -= 3; }

    let spRoll = tRoll1D('Spaceport Class');
    let spTotal = spRoll + spDM;

    if (spTotal <= 2) body.starport = 'Y';
    else if (spTotal === 3) body.starport = 'H';
    else if (spTotal <= 5) body.starport = 'G';
    else body.starport = 'F';
    tResult('Spaceport Class', body.starport);

    // 5. Tech Level
    tSection('Tech Level');
    let tlDM = 0;
    if (body.starport === 'F') { tDM('Starport F', 1); tlDM += 1; }
    if (body.size <= 1) { tDM('Size 1-', 2); tlDM += 2; }
    else if (body.size <= 4) { tDM('Size 2-4', 1); tlDM += 1; }
    if (body.atm <= 3 || body.atm >= 10) { tDM('Atmosphere Extreme', 1); tlDM += 1; }
    if (body.hydro === 9) { tDM('Hydro 9', 1); tlDM += 1; }
    else if (body.hydro === 10) { tDM('Hydro A', 2); tlDM += 2; }
    if (body.pop >= 1 && body.pop <= 5) { tDM('Pop 1-5', 1); tlDM += 1; }
    else if (body.pop === 9) { tDM('Pop 9', 2); tlDM += 2; }
    else if (body.pop >= 10) { tDM('Pop 10+', 4); tlDM += 4; }
    if (body.gov === 0 || body.gov === 5) { tDM('Gov 0 or 5', 1); tlDM += 1; }
    else if (body.gov === 7) { tDM('Gov 7', 2); tlDM += 2; }
    else if (body.gov >= 13) { tDM('Gov D+', -2); tlDM -= 2; }

    let tlRoll = tRoll1D('Tech Level');
    body.tl = Math.max(0, tlRoll + tlDM);

    const floor = getMgT2EMinSusTL(body.atm);
    if (body.tl < floor) {
        tOverride('Environmental Floor', body.tl, floor, `Atm ${body.atm} requires TL ${floor}`);
        body.tl = floor;
    }
    tResult('Final Tech Level', body.tl);

    // Clamping & UWP
    body.pop = clampUWP(body.pop || 0, 0, 15);
    body.gov = clampUWP(body.gov || 0, 0, 15);
    body.law = clampUWP(body.law || 0, 0, 15);
    body.tl = clampUWP(body.tl || 0, 0, 33);
    const cSize = clampUWP(body.size || 0, 0, 15);
    const cAtm = clampUWP(body.atm || 0, 0, 15);
    const cHydro = clampUWP(body.hydro || 0, 0, 10);

    const uwp = `${body.starport}${toUWPChar(cSize)}${toUWPChar(cAtm)}${toUWPChar(cHydro)}${toUWPChar(body.pop)}${toUWPChar(body.gov)}${toUWPChar(body.law)}-${toUWPChar(body.tl)}`;
    body.uwp = uwp;
    body.uwpSecondary = uwp;
}

function generateMgT2ESocioeconomics(base, hexId) {
    if (window.isLoggingEnabled) startTrace(hexId, 'MgT2E Socioeconomics', base ? base.name : 'Unknown');
    reseedForHex(hexId);
    if (!base) {
        if (window.isLoggingEnabled) endTrace();
        return null;
    }

    tSection('Socioeconomic Prerequisites');
    // Prerequisite: Minimum Sustainable Tech Level
    let minSusTL = getMgT2EMinSusTL(base.atm);
    tResult('Minimum Sustainable TL', minSusTL);


    // 1. Generate Population P Value and Total Population
    tSection('World Population (P-Value)');
    let pValue = 0;
    let totalWorldPop = 0;
    if (base.pop >= 10) {
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

    // 2. Generate Population Concentration Rating (PCR)
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

    // 6. Government Profile

    // 6. Centralisation Code (C)

    // 6. Centralisation Code (C)
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

    let factionsList = [];
    for (let i = 0; i < numExternalFactions; i++) {
        let fRoll = tRoll2D(`Faction ${i + 1} Roll`);
        let fType = 'P';
        if (fRoll <= 3) fType = 'O';
        else if (fRoll <= 5) fType = 'F';
        else if (fRoll <= 7) fType = 'M';
        else if (fRoll <= 9) fType = 'N';
        else if (fRoll <= 11) fType = 'S';
        factionsList.push(fType);
        tResult(`Faction ${i + 1} Type`, fType);
    }
    let factionsString = factionsList.join('');

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
    let t1DM = 0;
    if (base.hydro === 10) { tDM('Hydro A', -1); t1DM -= 1; }
    if (pcr >= 0 && pcr <= 2) { tDM('High Concentration', 1); t1DM += 1; }
    let T1 = Q1 + tlm('T1: Land Roll') + t1DM;
    let fT1 = Math.max(Q2 - 5, Math.min(Q1, T1));
    if (T1 !== fT1) tClamp('T1 TL', T1, fT1);
    T1 = fT1;
    tResult('T1: Land', T1);

    let t2DM = 0;
    if (base.hydro === 0) { tDM('Hydro 0', -2); t2DM -= 2; }
    if (base.hydro === 8) { tDM('Hydro 8', 1); t2DM += 1; }
    if (base.hydro >= 9) { tDM('Hydro 9+', 2); t2DM += 2; }
    if (pcr >= 0 && pcr <= 2) { tDM('High Concentration', 1); t2DM += 1; }
    let T2 = Q1 + tlm('T2: Water Roll') + t2DM;
    let fT2 = 0;
    if (base.hydro === 0) {
        fT2 = Math.max(0, Math.min(Q1, T2));
    } else {
        fT2 = Math.max(Q2 - 5, Math.min(Q1, T2));
    }
    if (T2 !== fT2) tClamp('T2 TL', T2, fT2);
    T2 = fT2;
    tResult('T2: Water', T2);

    let t3DM = 0;
    if ((base.atm <= 3 || base.atm === 14) && H <= 7) { tDM('Atm Extreme & H<=7', -2); t3DM -= 2; }
    if ((base.atm === 4 || base.atm === 5) && H <= 7) { tDM('Atm Thin & H<=7', -1); t3DM -= 1; }
    let T3 = Q1 + tlm('T3: Air Roll') + t3DM;
    let fT3 = Math.max(Q2 - 5, Math.min(Q1, T3));
    if (base.atm === 0 && H <= 5) fT3 = 0;
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

    // Novelty TL
    tSection('Tech: Novelty (N)');
    let maxOfAll = Math.max(Q1, Q2, Q3, Q4, Q5, T1, T2, T3, T4, M1, M2);
    let N = Math.max(maxOfAll, minSusTL, Math.max(H + 2, 12));
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
    let rRoll = tRoll2D('Resources Roll');
    let resourceRating = rRoll - 7 + base.size;
    let fRR = Math.max(2, Math.min(12, resourceRating));
    if (resourceRating !== fRR) tClamp('Resources Rating', resourceRating, fRR);
    resourceRating = fRR;
    tResult('Base Resource Rating', resourceRating);

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
        case 'F': portMod = 0.9; break;
        case 'G': portMod = 0.7; break;
        case 'H': portMod = 0.4; break;
        case 'Y': portMod = 0.2; break;
        case 'X': portMod = 0.2; break;
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
        // Pop 0 or neutralized
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
    if (base.hydro === 0) { tDM('Hydro 0', -20); wetDM -= 20; }
    if (base.hydro >= 1 && base.hydro <= 3) { tDM('Hydro 1-3', -5); wetDM -= 5; }
    if (base.hydro === 8) { tDM('Hydro 8', 2); wetDM += 2; }
    if (base.hydro === 9) { tDM('Hydro 9', 4); wetDM += 4; }
    if (base.hydro >= 10) { tDM('Hydro A', 8); wetDM += 8; }
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
    if (base.atm <= 1 && base.tl <= 8) { tDM('Thin/No Atm & TL<=8', -20); airDM -= 20; }
    if (([2, 3, 14].includes(base.atm)) && base.tl <= 8) { tDM('Atm 2,3,e & TL<=8', -8); airDM -= 8; }
    if (([4, 5].includes(base.atm)) && base.tl <= 8) { tDM('Atm 4,5 & TL<=8', -2); airDM -= 2; }
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

    if (window.isLoggingEnabled) endTrace();
    return {
        pValue,
        totalWorldPop,
        pcr,
        urbanPercent,
        totalUrbanPop,
        majorCities,
        totalMajorCityPop,
        govProfile,
        factions: factionsString,
        lawProfile,
        techProfile,
        culturalProfile,
        economicProfile,
        starportProfile,
        militaryProfile,
        judicialSystemProfile,
        Im, ecoR, ecoL, ecoI, ecoE, RU, pcGWP, WTN, IR, DR,
        displayString: `Pop: ${pValue}x10^${base.pop} | PCR: ${pcr} | Urb: ${urbanPercent}% | MC: ${majorCities} (${totalMajorCityPop.toLocaleString()})\nGov: ${govProfile} | Fac: ${factionsString} | JSP: ${judicialSystemProfile} | Law: ${lawProfile}\nTech: ${techProfile} | Cul: ${culturalProfile}\nEco: ${economicProfile} | Sp: ${starportProfile}\nMil: ${militaryProfile}`,
        displayStrings: [
            `Pop: ${pValue}x10^${base.pop} | PCR: ${pcr} | Urb: ${urbanPercent}% | MC: ${majorCities} (${totalMajorCityPop.toLocaleString()})`,
            `Gov: ${govProfile} | Fac: ${factionsString} | JSP: ${judicialSystemProfile} | Law: ${lawProfile}`,
            `Tech: ${techProfile} | Cul: ${culturalProfile}`,
            `Eco: ${economicProfile} | Sp: ${starportProfile}`,
            `Mil: ${militaryProfile}`
        ]
    };
}

// =====================================================================
// MGT2E SYSTEM GENERATION - HELPER FUNCTIONS
// =====================================================================

// Note: MGT2E_ORBIT_AU is defined in constants.js

function mgt2e_calculateTerrestrialPhysical(body, label) {
    if (body.size === 0 || body.size === 'R' || body.size === 'S') {
        body.density = 1.0;
        body.gravity = body.size === 'S' ? 0.01 : 0;
        body.mass = body.size === 'S' ? 0.0001 : 0;
        body.escapeVel = 0;
        body.orbitalVelSurface = 0;
        return;
    }

    tSection(`${label} Physical Stats`);
    // 1. Composition
    let compRoll = tRoll2D('Composition Roll');
    let coreType = 'Standard Core';
    let baseDensity = 1.0;
    let varMult = 0.04;

    if (compRoll <= 2) {
        coreType = 'Rare Minerals';
        baseDensity = 1.4;
        varMult = 0.1;
    } else if (compRoll <= 4) {
        coreType = 'Heavy Core';
        baseDensity = 1.1;
        varMult = 0.08;
    } else if (compRoll <= 8) {
        coreType = 'Standard Core';
        baseDensity = 0.9;
        varMult = 0.04;
    } else if (compRoll <= 10) {
        coreType = 'Light Core';
        baseDensity = 0.6;
        varMult = 0.06;
    } else {
        coreType = 'Icy Core';
        baseDensity = 0.3;
        varMult = 0.06;
    }

    let dVarRoll = tRoll1D('Density Variance (1D-1)');
    let density = baseDensity + (dVarRoll - 1) * varMult;
    body.composition = coreType;
    body.density = density;

    tResult('Composition', coreType);
    writeLogLine(`  Density Formula: (${coreType} ${baseDensity} + (Roll(${dVarRoll})-1) * ${varMult}) = ${density.toFixed(3)}`);
    tResult('Density', density.toFixed(3));

    // 2. Gravity
    let sR = body.size / 8;
    let gravity = sR * density;
    body.gravity = gravity;
    writeLogLine(`  Gravity Formula: (Size(${body.size})/8) * Density(${density.toFixed(3)}) = ${gravity.toFixed(3)} G`);
    tResult('Gravity (G)', gravity.toFixed(3));

    // 3. Mass
    let mass = Math.pow(sR, 3) * density;
    body.mass = mass;
    writeLogLine(`  Mass Formula: Density(${density.toFixed(3)}) * (Size(${body.size})/8)^3 = ${mass.toFixed(4)} Earths`);
    tResult('Mass (Earths)', mass.toFixed(4));

    // 4. Escape Velocity
    // formula: sqrt(Mass / (Size / 8)) * 11186
    let ev = Math.sqrt(body.mass / sR) * 11186;
    body.escapeVel = ev;
    writeLogLine(`  Escape Velocity Formula: sqrt(Mass(${body.mass.toFixed(4)}) / (Size(${body.size})/8)) * 11186 = ${ev.toFixed(2)} km/s`);
    tResult('Escape Velocity (km/s)', ev.toFixed(2));

    // 5. Orbital Velocity
    // Strictly derive from escapeVel to ensure consistency
    let ov = body.escapeVel / Math.sqrt(2);
    body.orbitalVelSurface = ov;
    writeLogLine(`  Orbital Velocity Formula: EscapeVel(${ev.toFixed(2)}) / sqrt(2) = ${ov.toFixed(2)} km/s`);
    tResult('Orbital Velocity (km/s)', ov.toFixed(2));
}

function convertAuToOrbit(au) {
    for (let i = 0; i < MGT2E_ORBIT_AU.length - 1; i++) {
        if (au >= MGT2E_ORBIT_AU[i] && au < MGT2E_ORBIT_AU[i + 1]) {
            let fraction = (au - MGT2E_ORBIT_AU[i]) / (MGT2E_ORBIT_AU[i + 1] - MGT2E_ORBIT_AU[i]);
            return i + fraction;
        }
    }
    return 20.0;
}

function getMgT2ESmallStarAge(label = 'Small Star') {
    let r1 = tRoll1D(`${label} Age Base (1D6 * 2)`);
    let r2 = Math.ceil(tRoll1D(`${label} Age Offset (1D3)`) / 2);
    let r3 = (Math.floor(rng() * 10) / 10);
    let age = (r1 * 2) + r2 - 1 + r3;
    return { age, display: `(BaseRoll(${r1}) * 2) + Offset(${r2}) - 1 + Jitter(${r3}) = ${age.toFixed(2)} Gyr` };
}

function getMgT2ELargeStarAge(msLifespan, label = 'Large Star') {
    let r1 = (Math.floor(rng() * 100) + 1) / 100;
    let age = msLifespan * r1;
    return { age, display: `Lifespan(${msLifespan.toFixed(2)}) * RandomFraction(${r1}) = ${age.toFixed(2)} Gyr` };
}

function generateMgT2EWhiteDwarf(label, forceWDTime = null) {
    tSection(`${label} (White Dwarf) Details`);
    let d1 = tRoll2D(`${label} Mass 2D6`);
    let d2 = Math.floor(rng() * 10) + 1; // 1D10
    let mass = (d1 - 1) / 10 + d2 / 100;
    tResult(`${label} Mass (ʘ)`, mass.toFixed(2));

    let diam = (1 / mass) * 0.01;
    tResult(`${label} Diameter (ʘ)`, diam.toFixed(4));

    let wdTime = forceWDTime;
    if (wdTime === null) {
        let ageResult = getMgT2ESmallStarAge(`${label} Cooling Time`);
        wdTime = ageResult.age;
        writeLogLine(`  WD Cooling Age Formula: ${ageResult.display}`);
    } else {
        writeLogLine(`  WD Cooling Age Fixed: ${wdTime.toFixed(2)} Gyr`);
    }

    // Progenitor calc
    let progMod = 2 + (Math.floor(rng() * 3) + 1); // 2 + 1D3
    let progMass = mass * progMod;
    let progMSLifespan = 10 / Math.pow(progMass, 2.5);
    let progTotalLife = progMSLifespan * 1.1; // 10% for giant phase
    let sysAge = progTotalLife + wdTime;

    // Temperature from Aging Table
    const agingTable = [
        { yrs: 0, temp: 100000 },
        { yrs: 0.1, temp: 25000 },
        { yrs: 0.5, temp: 10000 },
        { yrs: 1.0, temp: 8000 },
        { yrs: 1.5, temp: 7000 },
        { yrs: 2.5, temp: 5500 },
        { yrs: 5.0, temp: 5000 },
        { yrs: 10.0, temp: 4000 },
        { yrs: 13.0, temp: 3800 }
    ];

    let baseTemp = 3800;
    if (wdTime <= 0) baseTemp = 100000;
    else if (wdTime >= 13) baseTemp = 3800;
    else {
        for (let i = 0; i < agingTable.length - 1; i++) {
            if (wdTime >= agingTable[i].yrs && wdTime < agingTable[i + 1].yrs) {
                let f = (wdTime - agingTable[i].yrs) / (agingTable[i + 1].yrs - agingTable[i].yrs);
                baseTemp = agingTable[i].temp + f * (agingTable[i + 1].temp - agingTable[i].temp);
                break;
            }
        }
    }
    let temp = baseTemp * (mass / 0.6);
    tResult(`${label} Temperature (K)`, `${Math.round(temp)} (Base: ${Math.round(baseTemp)})`);

    let lum = (diam * diam) * Math.pow(temp / 5772, 4);
    tResult(`${label} Luminosity (ʘ)`, lum.toFixed(6));

    return {
        sType: 'D', subType: 0, sClass: 'D', mass, diam, temp, lum,
        wdTime, progMass, progMSLifespan, progTotalLife, sysAge,
        name: `D0 D`
    };
}

function generateMgT2EBrownDwarf(label, forceAge = null) {
    tSection(`${label} (Brown Dwarf) Details`);
    let d1 = tRoll2D(`${label} Mass 4D6`, 4); // Sum 4D6
    let d2 = tRoll1D(`${label} Mass 1D6`);
    let mass = (d1 - 1) / 1000 + d2 / 100;
    tResult(`${label} Mass (ʘ)`, mass.toFixed(4));

    let diam = 0.1; // baseline

    let age = forceAge;
    if (age === null) {
        let ageResult = getMgT2ESmallStarAge(`${label} Age`);
        age = ageResult.age;
        writeLogLine(`  BD Age Formula: ${ageResult.display}`);
    }

    // Baseline stats from Mass (at 1 Gyr)
    const baselineTypes = [
        { mass: 0.080, type: 'L', sub: 0, temp: 2400 },
        { mass: 0.060, type: 'L', sub: 5, temp: 1850 },
        { mass: 0.050, type: 'T', sub: 0, temp: 1300 },
        { mass: 0.040, type: 'T', sub: 5, temp: 900 },
        { mass: 0.025, type: 'Y', sub: 0, temp: 550 },
        { mass: 0.013, type: 'Y', sub: 5, temp: 300 }
    ];

    let bType = 'Y', bSub = 5, bTemp = 300;
    if (mass >= 0.080) { bType = 'L'; bSub = 0; bTemp = 2400; }
    else if (mass <= 0.013) { bType = 'Y'; bSub = 5; bTemp = 300; }
    else {
        for (let i = 0; i < baselineTypes.length - 1; i++) {
            if (mass <= baselineTypes[i].mass && mass > baselineTypes[i + 1].mass) {
                let f = (mass - baselineTypes[i + 1].mass) / (baselineTypes[i].mass - baselineTypes[i + 1].mass);
                let subTotalLow = (baselineTypes[i + 1].type === 'L' ? 0 : (baselineTypes[i + 1].type === 'T' ? 10 : 20)) + baselineTypes[i + 1].sub;
                let subTotalHigh = (baselineTypes[i].type === 'L' ? 0 : (baselineTypes[i].type === 'T' ? 10 : 20)) + baselineTypes[i].sub;
                let subTotal = subTotalLow + f * (subTotalHigh - subTotalLow);

                bTemp = baselineTypes[i + 1].temp + f * (baselineTypes[i].temp - baselineTypes[i + 1].temp);

                let sIdx = Math.round(subTotal);
                if (sIdx < 10) { bType = 'L'; bSub = sIdx; }
                else if (sIdx < 20) { bType = 'T'; bSub = sIdx - 10; }
                else { bType = 'Y'; bSub = sIdx - 20; }
                break;
            }
        }
    }

    writeLogLine(`  Baseline Type (1 Gyr): ${bType}${bSub} (${Math.round(bTemp)}K)`);

    // Aging/Cooling
    let coolingRate = (mass > 0.05) ? 1 : 2;
    let agePastBaseline = age - 1;
    let totalSubShift = Math.max(0, Math.floor(agePastBaseline * coolingRate));

    let currentSubTotal = (bType === 'L' ? 0 : (bType === 'T' ? 10 : 20)) + bSub + totalSubShift;
    let sType, subType;
    if (currentSubTotal < 10) { sType = 'L'; subType = currentSubTotal; }
    else if (currentSubTotal < 20) { sType = 'T'; subType = currentSubTotal - 10; }
    else { sType = 'Y'; subType = Math.min(9, currentSubTotal - 20); }

    // Final Temperature approx (Logarithmic cooling scale rough mapping)
    // T_final = T_baseline * (Age / Age_baseline)^-0.3 is a common astrophys approx, 
    // but we'll interpolate based on the table's spread for consistency.
    let temp = bTemp * Math.pow(age / 1, -0.4);
    if (age < 1) temp = bTemp * (1 + (1 - age) * 0.5);

    tResult(`${label} Type (Aged)`, `${sType}${subType} (Initial: ${bType}${bSub})`);
    tResult(`${label} Temperature (K)`, Math.round(temp));

    let lum = (diam * diam) * Math.pow(temp / 5772, 4);
    tResult(`${label} Luminosity (ʘ)`, lum.toFixed(6));

    return { sType, subType, sClass: 'V', mass, diam, temp, lum, age, name: `${sType}${toUWPChar(subType)} V` };
}

function generateMgT2EStarObject(sType, subType, sClass, label = 'Star') {
    if (sType === 'D') return generateMgT2EWhiteDwarf(label);
    if (sType === 'BD' || ['L', 'T', 'Y'].includes(sType)) return generateMgT2EBrownDwarf(label);

    let stats = MGT2E_STAR_STATS[sType];
    if (!stats) stats = MGT2E_STAR_STATS['M']; // fallback

    let diam2 = stats.diam * stats.diam;
    let tempRatio = Math.pow(stats.temp / 5772, 4);
    let lum = diam2 * tempRatio;

    let star = { sClass, sType, subType, mass: stats.mass, diam: stats.diam, temp: stats.temp, lum, name: `${sType}${toUWPChar(subType)} ${sClass}` };
    tResult(`${label} Classification`, star.name);
    tResult(`${label} Mass (Sol)`, star.mass);
    tResult(`${label} Temperature (K)`, star.temp);
    tResult(`${label} Diameter (Sol)`, star.diam);
    tResult(`${label} Luminosity (Sol)`, star.lum.toFixed(4));
    return star;
}

function rollMgT2EStar(label = 'Star') {
    let roll = tRoll2D(`${label} Type Roll`);
    let sClass = 'V';
    let sType = '';

    if (roll <= 2) { sType = 'M'; sClass = 'VI'; }
    else if (roll <= 6) sType = 'M';
    else if (roll <= 8) sType = 'K';
    else if (roll <= 10) sType = 'G';
    else if (roll == 11) sType = 'F';
    else {
        // A 12 was rolled, check for even hotter stars
        let hotRoll = tRoll2D(`${label} Hot Star Roll`);
        if (hotRoll <= 9) sType = 'A';
        else if (hotRoll <= 11) sType = 'B';
        else sType = 'O';
    }

    let subType = Math.floor(rng() * 10);
    tResult(`${label} Subtype (0-9)`, subType);

    return generateMgT2EStarObject(sType, subType, sClass, label);
}

// Note: MGT2E_MAO and SCLASS_IDX are defined in constants.js

function getMAO(sType, subType, sClass) {
    const sTypeOrder = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
    const idx = SCLASS_IDX[sClass] !== undefined ? SCLASS_IDX[sClass] : 5;

    let lowSubtype = subType < 5 ? 0 : 5;
    let highSubtype = subType < 5 ? 5 : 10;
    let lowKey = sType + lowSubtype;
    if (sType === 'O' && lowSubtype === 0) lowKey = 'O0';

    let lowRow = MGT2E_MAO[lowKey] || MGT2E_MAO['G0'];
    let lowVal = lowRow[idx];
    if (lowVal === Infinity) lowVal = null;

    if (subType === lowSubtype) return lowVal !== null ? lowVal : 0.01;

    let highVal = null;
    if (subType < 5) {
        let highRow = MGT2E_MAO[sType + '5'] || lowRow;
        let v = highRow[idx];
        highVal = (v === Infinity) ? null : v;
    } else {
        let nextType = sTypeOrder[sTypeOrder.indexOf(sType) + 1];
        if (nextType) {
            let highRow = MGT2E_MAO[nextType + '0'] || lowRow;
            let v = highRow[idx];
            highVal = (v === Infinity) ? null : v;
        }
    }

    if (lowVal === null && highVal === null) return 0.01;
    if (lowVal === null) return highVal;
    if (highVal === null) return lowVal;

    let fraction = (subType - lowSubtype) / (highSubtype - lowSubtype);
    return lowVal + fraction * (highVal - lowVal);
}

function isMgT2EStarHotter(s1, s2) {
    const order = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'BD', 'L', 'T', 'Y', 'D'];
    let idx1 = order.indexOf(s1.sType);
    let idx2 = order.indexOf(s2.sType);
    if (idx1 === -1) idx1 = 99;
    if (idx2 === -1) idx2 = 99;
    if (idx1 < idx2) return true;
    if (idx1 > idx2) return false;
    return s1.subType < s2.subType;
}

function determineMgT2EEccentricity(isStar, orbitsBeyondFirst, sysAgeGyr, orbitNum, isAsteroid, isPType) {
    let roll = tRoll2D('Eccentricity Roll');
    let dm = 0;

    // Step 9 DMs
    if (isPType) { tDM('P-Type (Extra Star)', 2); dm += 2; }
    if (sysAgeGyr > 1.0 && orbitNum < 1.0) { tDM('Old Inner System', 1); dm += 1; }
    if (isAsteroid) { tDM('Belt Body', -1); dm -= 1; }

    let sumRoll = roll + dm;
    let base = 0, fraction = 0;

    if (sumRoll <= 5) {
        base = -0.001;
        fraction = tRoll1D('Ecc Jitter (Result <= 5)') / 10000;
    }
    else if (sumRoll <= 7) {
        base = 0.000;
        fraction = tRoll1D('Ecc Jitter (Result 6-7)') / 200;
    }
    else if (sumRoll <= 9) {
        base = 0.030;
        fraction = tRoll1D('Ecc Jitter (Result 8-9)') / 100;
    }
    else if (sumRoll === 10) {
        base = 0.050;
        fraction = tRoll1D('Ecc Jitter (Result 10)') / 20;
    }
    else if (sumRoll === 11) {
        base = 0.050;
        fraction = tRoll2D('Ecc Jitter (Result 11)') / 20; // user specified 2D/20
    }
    else {
        base = 0.300;
        fraction = tRoll2D('Ecc Jitter (Result 12+)') / 20; // user specified 2D/20
    }

    let finalEcc = Math.max(0, base + fraction);
    return finalEcc;
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 1: STARS & SYSTEM INVENTORY
// =====================================================================

function generateMgT2ESystemChunk1(mainworldBase, hexId) {
    if (window.isLoggingEnabled) {
        let systemName = (mainworldBase && mainworldBase.name) || hexId;
        startTrace(hexId, 'MgT2E System Expansion', systemName);
    }
    reseedForHex(hexId);
    let sys = { stars: [], gasGiants: 0, planetoidBelts: 0, terrestrialPlanets: 0, totalWorlds: 0, hzco: 0, age: 0 };

    tSection('Stellar Generation');
    // =====================================================================
    // Step 1: Primary Star & System Age
    // =====================================================================
    let primary = rollMgT2EStar('Primary');
    primary.role = 'Primary';
    primary.separation = null;
    primary.orbitId = null;
    primary.eccentricity = 0;
    primary.mao = getMAO(primary.sType, primary.subType, primary.sClass);

    tSection('System Age');
    let msLifespan = 10 / Math.pow(primary.mass, 2.5);
    tResult('Main Sequence Lifespan (10 / mass^2.5)', msLifespan.toFixed(2) + " Gyr");

    if (primary.sType === 'D') {
        sys.age = primary.sysAge;
        tResult('System Age (WD Progenitor + Cooling)', sys.age.toFixed(2) + " Gyr");
    } else if (primary.mass < 0.9 || ['BD', 'L', 'T', 'Y'].includes(primary.sType)) {
        let ageResult = getMgT2ESmallStarAge('System');
        sys.age = ageResult.age;
        tResult('Age Formula', ageResult.display);
    } else {
        let ageResult = getMgT2ELargeStarAge(msLifespan, 'System');
        sys.age = ageResult.age;
        tResult('Age Formula', ageResult.display);
    }
    sys.age = Math.max(0.1, sys.age);

    let hzcoAu = Math.sqrt(primary.lum);
    sys.hzco = convertAuToOrbit(hzcoAu);
    tResult('Habitable Zone Center (Orbit)', sys.hzco.toFixed(2));
    sys.stars.push(primary);

    // =====================================================================
    // Step 2: Additional Stars (Close, Near, Far + recursive Companions)
    // =====================================================================
    tSection('Additional Stars');

    // Helper: compute presence roll DM based on a star's type/class
    function getMultiDM(star) {
        let dm = 0;
        if (['Ia', 'Ib', 'II', 'III', 'IV'].includes(star.sClass)) dm += 1;
        if (['V', 'VI'].includes(star.sClass) && ['O', 'B', 'A', 'F'].includes(star.sType)) dm += 1;
        if (['V', 'VI'].includes(star.sClass) && star.sType === 'M') dm -= 1;
        // DM -1 for Brown Dwarfs (L,T,Y), White Dwarfs (D), or other compact objects
        if (star.sClass === 'D' || ['L', 'T', 'Y'].includes(star.sType)) dm -= 1;
        return dm;
    }

    // Helper: generate non-primary star determination from a parent star
    function determineNonPrimaryStar(parentStar, orbitType, label) {
        const column = (orbitType === 'Companion' ? 'Companion' : 'Secondary');
        let dm = 0;
        // DM -1 for Brown Dwarfs (L,T,Y), White Dwarfs (D), or other compact objects
        if (parentStar.sClass === 'D' || ['L', 'T', 'Y'].includes(parentStar.sType)) dm = -1;

        let roll = tRoll2D(`${label} Determination Roll (${column} Column)`);
        if (dm !== 0) tDM('Exotic Parent', dm);
        let total = roll + dm;
        let clampedTotal = Math.max(2, Math.min(12, total));

        // Identify result based on the five types
        let determination = '';
        if (column === 'Secondary') {
            if (clampedTotal <= 3) determination = 'Other';
            else if (clampedTotal <= 6) determination = 'Random';
            else if (clampedTotal <= 8) determination = 'Lesser';
            else if (clampedTotal <= 10) determination = 'Sibling';
            else determination = 'Twin';
        } else {
            // Companion column
            if (clampedTotal <= 3) determination = 'Other';
            else if (clampedTotal <= 5) determination = 'Random';
            else if (clampedTotal <= 7) determination = 'Lesser';
            else if (clampedTotal <= 9) determination = 'Sibling';
            else determination = 'Twin';
        }
        tResult(`${label} Determination Result`, determination);

        // Articulate algorithm before determining
        if (determination === 'Twin') {
            writeLogLine(`  Algorithm (Twin): Class, Type, and Subtype are copied from parent star (${parentStar.name}). Apply optional 1D-1% mass/diameter reduction.`);
        } else if (determination === 'Sibling') {
            writeLogLine(`  Algorithm (Sibling): Slightly cooler than parent. Subtract 1D6 from subtype. If negative, move to cooler type and add 10.`);
        } else if (determination === 'Random') {
            writeLogLine(`  Algorithm (Random): Generate Type and Subtype as a Primary star. If hotter than parent, change result to Lesser.`);
        } else if (determination === 'Lesser') {
            writeLogLine(`  Algorithm (Lesser): Discard results hotter than Parent. Cooler class, one type cooler, reroll Subtype.`);
        } else if (determination === 'Other') {
            writeLogLine(`  Algorithm (Other): Roll 2D6. 2-7: White Dwarf (D), 8-12: Brown Dwarf (BD).`);
        }

        let star;
        if (determination === 'Twin') {
            star = JSON.parse(JSON.stringify(parentStar));
            let varRoll = tRoll1D(`${label} Twin Variation (1D6-1)`);
            let varPct = varRoll - 1;
            if (varPct > 0) {
                let factor = 1 - (varPct / 100);
                star.mass *= factor;
                star.diam *= factor;
                // Update luminosity since diameter changed (lum = diam^2 * tempRatio)
                let stats = MGT2E_STAR_STATS[star.sType] || MGT2E_STAR_STATS['M'];
                let tempRatio = Math.pow(stats.temp / 5772, 4);
                star.lum = (star.diam * star.diam) * tempRatio;
                tResult(`${label} Twin Variation`, `-${varPct}% mass/diameter`);
            }
            // Repopulate with audit results
            star = generateMgT2EStarObject(star.sType, star.subType, star.sClass, label);
            if (varPct > 0) {
                // Manually re-apply and log change since generateMgT2EStarObject uses table defaults
                let factor = 1 - (varPct / 100);
                star.mass *= factor;
                star.diam *= factor;
                let stats = MGT2E_STAR_STATS[star.sType] || MGT2E_STAR_STATS['M'];
                let tempRatio = Math.pow(stats.temp / 5772, 4);
                star.lum = (star.diam * star.diam) * tempRatio;
                tOverride(`${label} Mass (Var)`, star.mass.toFixed(2));
                tOverride(`${label} Diam (Var)`, star.diam.toFixed(2));
                tOverride(`${label} Lum (Var)`, star.lum.toFixed(4));
            }
            tResult(`${label} Selection`, `Twin (${star.name})`);
        } else if (determination === 'Sibling') {
            star = JSON.parse(JSON.stringify(parentStar));
            if (star.sType === 'D') {
                // Post-stellar mass reduction
                let massReductionPct = tRoll1D(`${label} Mass Reduction (1D6 * 10%)`) * 0.1;
                let originalMass = star.mass;
                star.mass = Math.max(0.1, originalMass * (1 - massReductionPct));
                tResult(`${label} Mass Reduction`, `-${(massReductionPct * 100).toFixed(0)}% (${originalMass.toFixed(2)} -> ${star.mass.toFixed(2)})`);
            } else {
                const types = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
                let subRoll = tRoll1D(`${label} Sibling Offset (1D6)`);
                let newSub = star.subType + subRoll; // Adding because a "cooler" star has a HIGHER subtype digit

                if (newSub > 9) {
                    let parentIdx = types.indexOf(star.sType);
                    if (parentIdx !== -1 && parentIdx < types.length - 1) {
                        star.sType = types[parentIdx + 1];
                        star.subType = newSub - 10;
                        writeLogLine(`  Notice: Subtype ${newSub} overflow. Cooling to ${star.sType}${star.subType}`);
                    } else if (star.sType === 'M') {
                        // M already coolest main sequence, stays M9 or becomes BD
                        star.subType = 9;
                        writeLogLine(`  Notice: Subtype ${newSub} capped at M9`);
                    } else {
                        star.subType = 9;
                    }
                } else {
                    star.subType = newSub;
                }
            }
            // Regerate star object with updated type/subtype/mass
            star = generateMgT2EStarObject(star.sType, star.subType, star.sClass, label);
            tResult(`${label} Selection`, `Sibling (${star.name})`);
        } else if (determination === 'Random') {
            let tempStar = rollMgT2EStar(label);
            writeLogLine(`  Random Generation Attempt: ${tempStar.name}`);
            if (isMgT2EStarHotter(tempStar, parentStar)) {
                writeLogLine(`  Notice: ${tempStar.name} is hotter than parent ${parentStar.name}. Changing result to Lesser.`);
                determination = 'Lesser';
                tResult(`${label} Override`, 'Random -> Lesser');
            } else {
                star = tempStar;
                tResult(`${label} Selection`, `Random (${star.name})`);
            }
        }

        // Handle Lesser (potentially changed from Random) or Other
        if (determination === 'Lesser') {
            const types = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
            let parentIdx = types.indexOf(parentStar.sType);
            let sType, sClass, subType;
            sClass = parentStar.sClass;

            if (parentStar.sType === 'M') {
                sType = 'M';
                subType = Math.floor(rng() * 10);
                writeLogLine(`  Lesser Generation (M-Parent): New subtype ${subType}`);
                if (subType > parentStar.subType) {
                    sType = 'BD';
                    writeLogLine(`  Notice: Subtype ${subType} > parent ${parentStar.subType}. Changing to Brown Dwarf (BD).`);
                }
            } else if (parentIdx !== -1 && parentIdx < types.length - 1) {
                sType = types[parentIdx + 1];
                subType = Math.floor(rng() * 10);
                writeLogLine(`  Lesser Generation: parent ${parentStar.sType} -> ${sType}, Subtype: ${subType}`);
            } else {
                sType = parentStar.sType;
                subType = Math.floor(rng() * 10);
                writeLogLine(`  Lesser Generation (Exotic Parent): Keeping Type ${sType}, New Subtype: ${subType}`);
            }
            star = generateMgT2EStarObject(sType, subType, sClass, label);
            tResult(`${label} Selection`, `Lesser (${star.name})`);
        } else if (determination === 'Other') {
            writeLogLine(`  Algorithm (Other): Roll 2D6. 2-7: White Dwarf (D), 8-12: Brown Dwarf (BD).`);
            let otherRoll = tRoll2D(`${label} Other Roll`);
            let sType, sClass, subType = 0;
            if (otherRoll <= 7) {
                sType = 'D';
                sClass = 'D';
                writeLogLine(`  Other Result (${otherRoll}): White Dwarf (D)`);
            } else {
                sType = 'BD';
                sClass = 'V';
                writeLogLine(`  Other Result (${otherRoll}): Brown Dwarf (BD)`);
            }
            star = generateMgT2EStarObject(sType, subType, sClass, label);
            tResult(`${label} Selection`, `Other (${star.name})`);
        }

        star.mao = getMAO(star.sType, star.subType, star.sClass);
        star.name = `${star.sType}${toUWPChar(star.subType)} ${star.sClass}`;
        return star;
    }

    // Helper: roll stellar eccentricity (isStar=true adds +2 DM automatically)
    function rollStellarEcc(orbitId, label) {
        return determineMgT2EEccentricity(true, 0, sys.age, orbitId, false, 0);
    }

    // Class Ia/Ib/II/III primaries cannot have Close companions
    const canHaveClose = !['Ia', 'Ib', 'II', 'III'].includes(primary.sClass);
    const primaryDM = getMultiDM(primary);

    const separationDefs = [
        { sep: 'Close', orbitFn: () => { let r = tRoll1D('Close Orbit Roll') - 1; return r === 0 ? 0.5 : r; }, allowed: canHaveClose },
        { sep: 'Near', orbitFn: () => tRoll1D('Near Orbit Roll') + 5, allowed: true },
        { sep: 'Far', orbitFn: () => tRoll1D('Far Orbit Roll') + 11, allowed: true },
    ];

    for (const def of separationDefs) {
        if (!def.allowed) {
            tSkip(`${def.sep} orbit forbidden by primary class`);
            continue;
        }
        let presRoll = tRoll2D(`${def.sep} Orbit Presence Roll`);
        tDM('Primary MultiDM', primaryDM);
        if (presRoll + primaryDM < 10) {
            tResult(`${def.sep} Orbit`, 'None');
            continue;
        }

        let starInOrbit = determineNonPrimaryStar(primary, def.sep, def.sep);
        starInOrbit.separation = def.sep;
        starInOrbit.role = def.sep;
        starInOrbit.parentStarIdx = 0;
        starInOrbit.orbitId = def.orbitFn();
        tResult(`${def.sep} Orbit`, starInOrbit.orbitId);
        starInOrbit.eccentricity = rollStellarEcc(starInOrbit.orbitId, def.sep);
        tResult(`${def.sep} Eccentricity`, starInOrbit.eccentricity.toFixed(3));
        sys.stars.push(starInOrbit);

        // Each Close/Near/Far star also rolls for its own tight Companion
        let orbitStarDM = getMultiDM(starInOrbit);
        if (tRoll2D(`${def.sep} Star Companion Presence Roll`) + orbitStarDM >= 10) {
            tDM('Stellar MultiDM', orbitStarDM);
            let tightCompanion = determineNonPrimaryStar(starInOrbit, 'Companion', 'Companion');
            tightCompanion.separation = 'Companion';
            tightCompanion.role = 'Companion';
            tightCompanion.parentStarIdx = sys.stars.length - 1;
            // Companion formula: (1d6/10) + ((2d6-7)/100)
            let d1 = tRoll1D(`${def.sep} Comp Orbit D1`);
            let d2 = tRoll2D(`${def.sep} Comp Orbit D2`);
            tightCompanion.orbitId = (d1 / 10) + ((d2 - 7) / 100);
            tResult('Companion Orbit', tightCompanion.orbitId.toFixed(3));
            tightCompanion.eccentricity = rollStellarEcc(tightCompanion.orbitId, 'Companion');
            tResult('Companion Eccentricity', tightCompanion.eccentricity.toFixed(3));
            sys.stars.push(tightCompanion);
        } else {
            tResult(`Companion to ${def.sep}`, 'None');
        }
    }

    // =====================================================================
    // Step 3: Total Worlds Inventory (GG + PB + TP)
    // =====================================================================
    tSection('System Inventory');
    const multiStar = sys.stars.length >= 2;

    // --- Gas Giants ---
    tSection('Gas Giants');
    let existingGG = (mainworldBase && mainworldBase.gasGiant === true);
    let ggExists = false;
    if (existingGG) {
        tResult('Gas Giant Presence', 'Yes (from Mainworld)');
        ggExists = true;
    } else {
        let ggRoll = tRoll2D('Gas Giant Presence Roll (<= 9)');
        ggExists = (ggRoll <= 9);
    }
    if (ggExists) {
        let ggQ = tRoll2D('Gas Giant Quantity Roll');
        if (sys.stars.length === 1 && primary.sClass === 'V') { tDM('Single Class V', 1); ggQ += 1; }
        if (sys.stars.length >= 4) { tDM('4+ Stars', -1); ggQ -= 1; }

        if (ggQ <= 4) sys.gasGiants = 1;
        else if (ggQ <= 6) sys.gasGiants = 2;
        else if (ggQ <= 8) sys.gasGiants = 3;
        else if (ggQ <= 11) sys.gasGiants = 4;
        else if (ggQ === 12) sys.gasGiants = 5;
        else sys.gasGiants = 6;
        tResult('Gas Giants Count', sys.gasGiants);
    } else {
        tResult('Gas Giants Count', 0);
    }

    // --- Planetoid Belts ---
    tSection('Planetoid Belts');
    let pbRoll = tRoll2D('Planetoid Belt Presence Roll (>= 8)');
    let pbExists = (pbRoll >= 8);
    if (pbExists) {
        let pbQ = tRoll2D('Planetoid Belt Quantity Roll');
        if (ggExists) { tDM('Gas Giant Present', 1); pbQ += 1; }
        if (multiStar) { tDM('Multi-Star System', 1); pbQ += 1; }
        if (pbQ <= 6) sys.planetoidBelts = 1;
        else if (pbQ <= 11) sys.planetoidBelts = 2;
        else sys.planetoidBelts = 3;
    }
    // Continuation: mainworld is an asteroid belt → force at least 1 PB
    if (mainworldBase && mainworldBase.size === 0) {
        tResult('Asteroid Mainworld', 'Forcing +1 PB');
        sys.planetoidBelts = Math.max(1, sys.planetoidBelts + 1);
    }
    tResult('Planetoid Belts Count', sys.planetoidBelts);

    // --- Terrestrial Planets ---
    tSection('Terrestrial Planets');
    let tpRoll = tRoll2D('Terrestrial Planet Quantity Roll');
    let tpCount = tpRoll - 2;
    if (tpCount < 3) {
        tDM('Low Roll Reroll', 0);
        let d3 = Math.ceil(tRoll1D('Reroll D3') / 2);
        tpCount = d3 + 2;   // range 3–5
    } else {
        let d3 = Math.ceil(tRoll1D('Additional D3') / 2);
        tpCount += d3 - 1;  // add 0–2 more
    }
    // Continuation: standard terrestrial mainworld counts as one TP
    if (mainworldBase && mainworldBase.size >= 1) {
        tpCount = Math.max(1, tpCount);
    }
    sys.terrestrialPlanets = tpCount;
    tResult('Terrestrial Planets Count', tpCount);

    sys.totalWorlds = sys.gasGiants + sys.planetoidBelts + sys.terrestrialPlanets;

    // --- Step 7: Anomalous Planet Generation ---
    let anomRoll = tRoll2D('Anomalous Orbits Roll');
    let anomCount = anomRoll <= 9 ? 0 : (anomRoll - 9);
    for (let i = 0; i < anomCount; i++) {
        sys.totalWorlds++;
        if (sys.terrestrialPlanets < 13) sys.terrestrialPlanets++;
        else sys.planetoidBelts++;
    }
    tResult('Anomalous Orbits Added', anomCount);
    tResult('Total Worlds in System', sys.totalWorlds);

    // --- Combined HZCO for circumbinary P-type worlds (Item #6) ---
    // Sum all star luminosities → sqrt → convert to Orbit#
    let totalLum = sys.stars.reduce((sum, s) => sum + (s.lum || 0), 0);
    sys.ptypeHzco = sys.stars.length > 1 ? convertAuToOrbit(Math.sqrt(totalLum)) : sys.hzco;
    if (sys.stars.length > 1) tResult('Circumbinary HZCO', sys.ptypeHzco.toFixed(2));

    return sys;
}

function mgt2e_sizeGasGiantBody(w, type) {
    w.ggType = type;
    if (type === 'GS') {
        let d1 = tRoll1D('Small GG Diameter (2D)');
        let d2 = tRoll1D('Small GG Diameter (2D)');
        w.diameterStr = `${d1 + d2} (GS)`;
        w.mass = 5 * (tRoll1D('Small GG Mass (1D+1)') + 1);
        w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
    } else if (type === 'GM') {
        w.diameterStr = `${tRoll1D('Medium GG Diameter (1D+6)') + 6} (GM)`;
        w.mass = 20 * (tRoll3D('Medium GG Mass (3D-1)') - 1);
        w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
    } else {
        w.ggType = 'GL';
        w.diameterStr = `${tRoll2D('Large GG Diameter (2D+6)') + 6} (GL) `;
        let initMass = tRoll3D('Large GG Mass (3D)');
        let d3Multiplier = Math.floor(rng() * 3) + 1;
        w.mass = d3Multiplier * 50 * (initMass + 4);
        if (w.mass >= 3000 || initMass >= 15) {
            w.mass = 4000 - ((tRoll2D('Mass Cap Adjust') - 2) * 200);
        }
        w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
    }
    w.size = 'GG';
    w.composition = `Gas Giant (${w.ggType})`;
    tResult('Type', w.ggType);
    tResult('Diameter', w.diameterStr);
    tResult('Mass (Earths)', w.mass);

    // Physical Stats for UI
    let radiusE = w.diamKm / 12742;
    w.gravity = radiusE > 0 ? (w.mass / (radiusE * radiusE)) : 0;
    w.density = radiusE > 0 ? (w.mass / (radiusE * radiusE * radiusE)) : 0.1;
    tResult('Composition', w.composition);
    tResult('Gravity (G)', w.gravity.toFixed(3));
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 3: WORLD & MOON SIZING
// =====================================================================

function generateMgT2ESystemChunk3(sys, mainworldBase) {
    let primary = sys.stars[0];
    tSection('World & Moon Sizing');

    // 1. Size Terrestrial Planets & Gas Giants
    for (let i = 0; i < sys.worlds.length; i++) {
        let w = sys.worlds[i];
        w.moons = [];
        w.rings = [];

        if (w.type === 'Empty' || w.type === 'Planetoid Belt') continue;

        tSection(`${w.type} Orbit ${w.orbitId.toFixed(2)} Sizing`);
        if (w.type === 'Gas Giant') {
            let catRoll = tRoll1D('Gas Giant Category');
            let gType = (catRoll <= 2) ? 'GS' : (catRoll <= 4 ? 'GM' : 'GL');
            mgt2e_sizeGasGiantBody(w, gType);
        } else if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            if (w.type === 'Mainworld' && mainworldBase && mainworldBase.size !== undefined) {
                w.size = mainworldBase.size;
                tResult('Size', `${w.size} (Mainworld Auth)`);
            } else {
                let sizeCat = tRoll1D('Size Roll Basis (1D)');
                if (sizeCat <= 2) {
                    w.size = tRoll1D('Tiny/Small (1D)');
                } else if (sizeCat <= 4) {
                    w.size = tRoll2D('Standard (2D)');
                } else {
                    w.size = tRoll2D('Large (2D+3)') + 3;
                }
                tResult('Size', w.size);
            }
            w.diamKm = w.size * 1600;
            mgt2e_calculateTerrestrialPhysical(w, w.type);
        } else if (w.type === 'Planetoid Belt') {
            w.bulk = tRoll1D('Belt Bulk');
            w.mType = tRoll1D('M-Type Content') * 10;
            w.cType = tRoll1D('C-Type Content') * 10;
            w.sType = Math.max(0, 100 - w.mType - w.cType);
            w.size = 0;
            w.gravity = 0;
            w.mass = 0;
            w.density = 0;
            w.atmCode = 0;
            w.composition = `M:${w.mType}% C:${w.cType}% S:${w.sType}%`;
            tResult('Composition', w.composition);
        }

        // --- Step 8/9 Precision Orbit Recalculation ---
        if (w.au && w.type !== 'Empty') {
            let Sum_M = 0;
            if (w.orbitType === 'P-Type') {
                Sum_M = sys.stars.reduce((sum, s) => {
                    let sOrbit = (s.orbitId !== null && s.orbitId !== undefined) ? s.orbitId : 0;
                    return sOrbit < w.orbitId ? sum + s.mass : sum;
                }, 0);
            } else {
                let pIdx = (w.parentStarIdx !== undefined) ? w.parentStarIdx : 0;
                Sum_M = (sys.stars[pIdx] || sys.stars[0]).mass;
            }
            let planetSolarMass = (w.mass || 0) * 0.000003;
            w.periodYears = Math.sqrt(Math.pow(w.au, 3) / (Sum_M + planetSolarMass));
            w.periodDays = w.periodYears * 365.25;
            w.periodHours = w.periodYears * 8766;
            tResult('Calibrated Orbital Period', w.periodYears.toFixed(4) + ' yrs (' + w.periodDays.toFixed(1) + ' days)');
        }
    }

    // 2. Determine Moon Quantities & Sizes
    for (let i = 0; i < sys.worlds.length; i++) {
        let w = sys.worlds[i];
        if (w.type === 'Empty' || w.type === 'Planetoid Belt') continue;

        tSection(`${w.type} Orbit ${w.orbitId.toFixed(2)} Moons`);
        let qRoll = 0;
        let qLabel = 'Moon Quantity Roll';
        if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            if (w.size <= 2) qRoll = tRoll1D(qLabel);
            else if (w.size <= 9) qRoll = tRoll2D(qLabel);
            else qRoll = tRoll2D(qLabel);
        } else {
            if (w.ggType === 'GS') qRoll = tRoll3D(qLabel);
            else qRoll = tRoll4D(qLabel);
        }

        let qMod = 0;
        if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            if (w.size <= 2) { tDM('Size 2-', -5); qMod -= 5; }
            else if (w.size <= 9) { tDM('Size 3-9', -8); qMod -= 8; }
            else { tDM('Size 10+', -6); qMod -= 6; }
        } else {
            if (w.ggType === 'GS') { tDM('Small GG', -7); qMod -= 7; }
            else { tDM('Med/Large GG', -6); qMod -= 6; }
        }

        // Step 3: Per-Dice penalties
        let dmDiceCount = (w.size <= 2) ? 1 : (w.size <= 9 ? 2 : (w.size <= 15 ? 2 : (w.ggType === 'GS' ? 3 : 4)));
        let instability = false;
        if (w.orbitId < 1.0) instability = true;
        // Adjacency check
        for (let s of sys.stars) {
            if (s.orbitId !== null && s.orbitId !== undefined && Math.abs(w.orbitId - s.orbitId) <= 1.0) instability = true;
        }
        if (sys.forbiddenZones) {
            for (let fz of sys.forbiddenZones) {
                if (w.orbitId >= fz.min - 1.0 && w.orbitId <= fz.max + 1.0) instability = true;
            }
        }

        if (instability) {
            tDM('System Instability (Per-Dice Penalty)', -dmDiceCount);
            qMod -= dmDiceCount;
        }

        if (sys.primarySpread < 0.1) {
            tDM('Low System Spread', -1);
            qMod -= 1;
        }

        let isDim = ['M', 'L', 'T', 'Y'].includes(primary.sType) && (['V', 'VI'].includes(primary.sClass) || !primary.sClass);
        if (isDim) {
            tDM('Dim/Dwarf Primary', -1);
            qMod -= 1;
        }

        let moonsToGenerate = Math.max(0, qRoll + qMod);
        if (qRoll + qMod === 0) {
            tResult('Result', 'No moons, Adding Ring placeholder');
            w.rings.push({});
        } else {
            tResult('Moons to Generate', moonsToGenerate);
        }

        for (let m = 0; m < moonsToGenerate; m++) {
            let moonSize = '';
            let r1 = tRoll1D(`Satellite ${m + 1} Size Basis`);
            if (r1 <= 3) {
                moonSize = 'S';
            } else if (r1 <= 5) {
                let ms = Math.floor(rng() * 3);
                if (ms === 0) moonSize = 'R'; else moonSize = ms;
            } else {
                if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                    if (w.size === 1) {
                        moonSize = 'S';
                    } else {
                        let msRoll = tRoll1D(`Satellite ${m + 1} Size (MW/TP)`);
                        let trySize = w.size - 1 - msRoll;
                        if (trySize < 0) moonSize = 'S';
                        else if (trySize === 0) moonSize = 'R';
                        else if (trySize === w.size - 2) {
                            let twinRoll = tRoll2D(`Satellite ${m + 1} Twin Chance`);
                            if (twinRoll === 12) { tResult(`Satellite ${m + 1}`, 'Twin World'); moonSize = w.size; }
                            else if (twinRoll === 2) moonSize = trySize - 1;
                            else moonSize = trySize;
                            if (moonSize <= 0) moonSize = 'S';
                        } else {
                            moonSize = trySize;
                        }
                    }
                } else {
                    let specialR = tRoll1D(`Satellite ${m + 1} GG Size Type`);
                    if (specialR <= 3) {
                        moonSize = tRoll1D(`Bracket 1-3 (Tiny)`);
                    } else if (specialR <= 5) {
                        let z = Math.max(0, tRoll2D(`Bracket 4-5 (Standard)`) - 2);
                        moonSize = z === 0 ? 'R' : z;
                    } else {
                        let giantMoon = tRoll2D(`Bracket 6 (Special)`) + 4;
                        if (giantMoon >= 16) {
                            // Extreme Moon Constraint
                            let moonBody = { type: 'Gas Giant', orbitId: w.orbitId, parentStarIdx: w.parentStarIdx, orbitType: w.orbitType };
                            let isGL = w.ggType === 'GL';
                            let upgrade = isGL && tRoll2D('GL Parent Upgrade Check') === 12;
                            tResult(`Satellite ${m + 1} Extreme Result`, upgrade ? 'Medium Gas Giant (GM)' : 'Small Gas Giant (GS)');
                            mgt2e_sizeGasGiantBody(moonBody, upgrade ? 'GM' : 'GS');
                            moonSize = moonBody.ggType;
                            // Add extra properties to moon record
                            w.moons.push({ ...moonBody, isSpecialGG: true });
                            continue;
                        } else {
                            moonSize = giantMoon;
                        }
                    }
                }
            }
            if (moonSize === 'R') {
                tResult(`Satellite ${m + 1}`, 'Ring System');
                w.rings.push({});
            } else {
                tResult(`Satellite ${m + 1} Size`, moonSize);
                let moonObj = { size: moonSize, type: 'Satellite', worldHzco: w.worldHzco, orbitId: w.orbitId, parentStarIdx: w.parentStarIdx, orbitType: w.orbitType };
                mgt2e_calculateTerrestrialPhysical(moonObj, `Satellite ${m + 1}`);
                w.moons.push(moonObj);
            }
        }

        // 3. Hill Sphere & Roche Limit
        if (w.mass > 0 && w.diamKm > 0) {
            let solMass = w.mass * 0.000003;
            let mStar = primary.mass;
            let hsAu = w.au * (1 - w.eccentricity) * Math.pow(solMass / (3 * mStar), 0.3333);
            let hsPd = hsAu * 149597870.9 / w.diamKm;
            let hillLimit = Math.floor(hsPd / 2);
            w.hillSpanPd = hillLimit;
            tResult(`${w.type} Hill Sphere Limit (Diameters/2)`, hillLimit);

            if (hillLimit < 1.5) {
                if (w.moons.length > 0) {
                    w.moons = [];
                    w.rings.push({});
                }
            }
            if (hillLimit < 0.5) {
                w.rings = [];
            }

            let numM = w.moons.length;
            if (numM > 0) {
                let mor = hillLimit - 2;
                if (mor > 200) mor = 200 + numM;

                let placementDMW = mor < 60 ? 1 : 0;
                for (let mn = 0; mn < numM; mn++) {
                    let locRoll = roll1D() + placementDMW;
                    let pdTarget = 0;
                    let locStr = '';
                    if (locRoll <= 3) {
                        pdTarget = ((roll2D() - 2) * mor / 60) + 2; locStr = 'Inner';
                    } else if (locRoll <= 5) {
                        pdTarget = ((roll2D() - 2) * mor / 30) + (mor / 6) + 3; locStr = 'Middle';
                    } else {
                        pdTarget = ((roll2D() - 2) * mor / 20) + (mor / 2) + 4; locStr = 'Outer';
                    }
                    w.moons[mn].pd = pdTarget;
                    w.moons[mn].pos = locStr;

                    let eMod = locStr === 'Inner' ? -1 : (locStr === 'Middle' ? 1 : 4);
                    if (pdTarget > mor) eMod += 6;

                    w.moons[mn].ecc = determineMgT2EEccentricity(false, 0, sys.age, w.orbitId, false, eMod);
                    w.moons[mn].retrograde = (roll2D() + eMod >= 10);

                    let moonKm = pdTarget * w.diamKm;
                    w.moons[mn].periodHrs = Math.sqrt(Math.pow(moonKm, 3) / w.mass) / 361730;
                }

                w.moons.sort((a, b) => a.pd - b.pd);
                for (let m = 1; m < w.moons.length; m++) {
                    if (w.moons[m].pd <= w.moons[m - 1].pd) {
                        w.moons[m].pd = w.moons[m - 1].pd + 1.5;
                    }
                }
            }

            for (let r = 0; r < w.rings.length; r++) {
                w.rings[r].center = 0.4 + (roll2D() / 8);
                w.rings[r].span = (roll3D() / 100) + 0.07;
            }
        }
    }

    return sys;
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 5: TEMPERATURE & ROTATION
// =====================================================================

function getEffectiveHzcoDeviation(orbitId, hzco) {
    if (orbitId < 1.0 || hzco < 1.0) {
        return (orbitId - hzco) / Math.max(0.01, Math.min(orbitId, hzco));
    }
    return orbitId - hzco;
}

function getMgT2EAlbedo(w, hzco) {
    let albedo = 0;
    let diff = getEffectiveHzcoDeviation(w.orbitId, hzco);
    let type = "Rocky";
    if (w.type === 'Gas Giant') type = "Gas Giant";
    else if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
        if (w.tempBand === "Cold" || w.tempBand === "Frozen") type = "Icy";
    }
    if (type === "Rocky") albedo = 0.04 + (roll2D() - 2) * 0.02;
    else if (type === "Gas Giant") albedo = 0.05 + roll2D() * 0.05;
    else if (type === "Icy" && diff <= 2) albedo = 0.2 + (roll2D() - 3) * 0.05;
    else albedo = 0.25 + (roll2D() - 2) * 0.07;

    // Modifiers
    if (w.atmCode >= 1 && w.atmCode <= 3 || w.atmCode === 14) albedo += (roll2D() - 3) * 0.01;
    if (w.atmCode >= 4 && w.atmCode <= 9) albedo += roll2D() * 0.01;
    if (w.atmCode >= 10 && w.atmCode <= 12 || w.atmCode === 15) albedo += (roll2D() - 2) * 0.05;
    if (w.atmCode === 13) albedo += roll2D() * 0.03;

    if (w.hydroCode >= 2 && w.hydroCode <= 5) albedo += (roll2D() - 2) * 0.02;
    if (w.hydroCode >= 6) albedo += (roll2D() - 4) * 0.03;

    if (type === "Icy" && diff > 2 && albedo <= 0.4) {
        albedo -= (roll1D() - 1) * 0.05;
    }
    return Math.max(0.02, Math.min(0.95, albedo));
}

function generateMgT2EAxialTilt() {
    let roll = roll2D();
    let tilt = 0;
    if (roll <= 4) tilt = (roll1D() - 1) / 50;
    else if (roll === 5) tilt = roll1D() / 5;
    else if (roll === 6) tilt = roll1D();
    else if (roll === 7) tilt = 6 + roll1D();
    else if (roll <= 9) tilt = 5 + roll1D() * 5;
    else {
        let ex = roll1D();
        if (ex <= 2) tilt = 10 + roll1D() * 10;
        else if (ex === 3) tilt = 30 + roll1D() * 10;
        else if (ex === 4) tilt = 90 + roll1D();
        else if (ex === 5) tilt = 180 - roll1D();
        else tilt = 120 + roll1D() * 10;
    }
    return tilt;
}

function generateMgT2ESystemChunk5(sys) {
    let primary = sys.stars[0];
    tSection('Temperature & Rotation');

    let processBody = (w, parent, isMoon) => {
        if (w.type === 'Empty') return;

        if (w.type === 'Planetoid Belt') {
            // Planetoid Belts don't have rotation/tidal stats, but need temp
            w.siderealHours = 24.0;
            w.yearHours = (w.periodYears || 1.0) * 8760;
            w.solarDayHours = 24.0;
            w.axialTilt = 0;
            w.tidallyLocked = false;
        } else {
            tSection(`${isMoon ? 'Moon' : w.type} Orbit ${w.orbitId.toFixed(2)} Rotation`);

            // 1. Sidereal Day
            let sRoll1 = tRoll2D('Base Sidereal Day Roll');
            let sRoll2 = tRoll1D('Sidereal Day Adjust');
            w.siderealHours = (sRoll1 - 2) * 4 + 2 + sRoll2 + Math.floor(sys.age / 2);
            if (w.type === 'Gas Giant' || w.size === 0 || w.size === 'S') {
                tResult('Modifier', 'GG/Small/Asteroid x2');
                w.siderealHours *= 2;
            }

            let extRoll = w.siderealHours;
            let extCount = 0;
            while (extRoll >= 40) {
                if (tRoll1D(`Extension ${++extCount} Roll (5+)`) >= 5) {
                    let bonusRoll1 = tRoll2D(`Extension ${extCount} Base`);
                    let bonusRoll2 = tRoll1D(`Extension ${extCount} Adjust`);
                    let bonus = (bonusRoll1 - 2) * 4 + 2 + bonusRoll2 + Math.floor(sys.age / 2);
                    if (w.type === 'Gas Giant' || w.size === 0 || w.size === 'S') bonus *= 2;
                    w.siderealHours += bonus;
                    extRoll = bonus;
                } else {
                    break;
                }
            }
            w.siderealHours += ((tRoll1D('Fractional Adjustment') - 1) / 60) + ((Math.floor(rng() * 10)) / 3600);
            tResult('Sidereal Hours', w.siderealHours.toFixed(4));

            // 2. Solar Day
            let pYears = w.periodYears;
            if (isMoon) {
                if (!w.periodYears) {
                    w.periodYears = (tRoll2D('Moon Period Proxy') + tRoll2D('Moon Period Proxy 2')) / 365.25;
                }
                pYears = w.periodYears;
            }
            w.yearHours = pYears * 8760;

            if (w.siderealHours === w.yearHours) {
                w.solarDaysInYear = 0;
                w.solarDayHours = Infinity;
            } else {
                w.solarDaysInYear = Math.abs((w.yearHours / w.siderealHours) - 1);
                if (w.solarDaysInYear !== 0) {
                    w.solarDayHours = w.yearHours / w.solarDaysInYear;
                } else {
                    w.solarDayHours = Infinity;
                }
            }
            tResult('Solar Day (Hours)', (w.solarDayHours === Infinity || w.solarDayHours > 999999) ? 'Infinity' : w.solarDayHours.toFixed(2));

            // 3. Axial Tilt
            tSection('Axial Tilt');
            w.axialTilt = generateMgT2EAxialTilt();
            tResult('Final Axial Tilt', w.axialTilt + '°');

            // 4. Tidal Lock
            tSection('Tidal Lock Check');
            let lockDM = Math.ceil((w.size === 'GG' ? 10 : w.size) / 3);
            if (w.eccentricity) { tDM('Eccentricity', -Math.floor(w.eccentricity * 10)); lockDM -= Math.floor(w.eccentricity * 10); }
            if (w.pressureBar > 2.5) { tDM('High Pressure', -2); lockDM -= 2; }
            if (sys.age < 1) { tDM('Young System', -2); lockDM -= 2; }
            else if (sys.age >= 5 && sys.age <= 10) { tDM('Old System (5-10)', 2); lockDM += 2; }
            else if (sys.age > 10) { tDM('Ancient System (10+)', 4); lockDM += 4; }

            if (w.axialTilt > 30) { tDM('Tilt > 30', -2); lockDM -= 2; }
            if (w.axialTilt >= 60 && w.axialTilt <= 120) { tDM('Extreme Tilt', -4); lockDM -= 4; }
            if (w.axialTilt >= 80 && w.axialTilt <= 100) { tDM('Side-on Tilt', -4); lockDM -= 4; }

            if (isMoon) { tDM('Satellite', 6); lockDM += 6; }
            else { if (w.orbitId <= 0.5) { tDM('Near-Star Orbit', 4); lockDM += 4; } }

            w.tidallyLocked = false;
            if (lockDM >= 10) {
                let forceLock = true;
                if (tRoll2D('Critical Freedom Check') === 12 && tRoll2D('Freedom Sub-Check') < 12) forceLock = false;
                if (forceLock) {
                    tResult('Result', 'Forced Lock (DM 10+)');
                    w.tidallyLocked = true;
                }
            } else if (lockDM > -10 && !w.tidallyLocked) {
                let lockRoll = tRoll2D('Tidal Lock Roll');
                tDM('Lock DM', lockDM);
                let finalLR = lockRoll + lockDM;
                if (finalLR >= 12) {
                    tResult('Result', 'Tidally Locked');
                    w.tidallyLocked = true;
                } else if (finalLR === 11) {
                    tResult('Result', '2:3 Resonance');
                    w.siderealHours = w.yearHours * (2 / 3);
                } else if (finalLR === 10) { tResult('Result', 'Long Day (50-300)'); w.siderealHours = tRoll1D('Long Day Multiplier') * 50 * 24; }
                else if (finalLR === 9) { tResult('Result', 'Moderate Day (10-60)'); w.siderealHours = tRoll1D('Mod Day Multiplier') * 10 * 24; }
                else if (finalLR === 8) { tResult('Result', 'Deep Day (20-120)'); w.siderealHours = tRoll1D('Deep Day Multiplier') * 20 * 24; }
                else if (finalLR === 7) { tResult('Result', 'Soft Day (5-30)'); w.siderealHours = tRoll1D('Soft Day Multiplier') * 5 * 24; }
                else if (finalLR === 6) { tResult('Result', 'x5 Multiplier'); w.siderealHours *= 5; }
                else if (finalLR === 5) { tResult('Result', 'x3 Multiplier'); w.siderealHours *= 3; }
                else if (finalLR === 4) { tResult('Result', 'x2 Multiplier'); w.siderealHours *= 2; }
                else if (finalLR === 3) { tResult('Result', 'x1.5 Multiplier'); w.siderealHours *= 1.5; }
                else tResult('Result', 'No Lock');
            }

            if (w.tidallyLocked) {
                w.siderealHours = w.yearHours;
                w.axialTilt = Math.max(0, (tRoll2D('Locked Tilt Jitter') - 2) / 10);
                if (w.eccentricity > 0.1) {
                    let newEcc = determineMgT2EEccentricity(false, 0, sys.age, w.orbitId, false, -2);
                    if (newEcc < w.eccentricity) w.eccentricity = newEcc;
                }
            }

            if (w.siderealHours === w.yearHours) {
                w.solarDaysInYear = 0;
                w.solarDayHours = Infinity;
            } else {
                w.solarDaysInYear = Math.abs((w.yearHours / w.siderealHours) - 1);
                if (w.solarDaysInYear !== 0) w.solarDayHours = w.yearHours / w.solarDaysInYear;
                else w.solarDayHours = Infinity;
            }

        }

        // 5. Mean Temperature
        tSection('Mean Temperature');
        w.albedo = getMgT2EAlbedo(w, w.worldHzco || sys.hzco);
        tResult('Bond Albedo', w.albedo.toFixed(3));
        let initialGF = 0.5 * Math.sqrt(w.pressureBar || 0);

        let gfMod = 0;
        if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14].includes(w.atmCode)) {
            gfMod = tRoll3D('Greenhouse Variability (3D*0.01)') * 0.01;
        }
        let gfMult = 1;
        if (w.atmCode === 10 || w.atmCode === 15) {
            gfMult = Math.max(0.5, tRoll1D('Exotic Multiplier (1D-1)') - 1);
        } else if ([11, 12, 16, 17].includes(w.atmCode)) {
            let mx = tRoll1D('Extreme Multiplier Basis');
            if (mx === 6) gfMult = tRoll3D('Extreme GG (3D)');
            else gfMult = mx;
        }
        w.greenhouseFactor = (initialGF + gfMod) * gfMult;
        tResult('GFactor', w.greenhouseFactor.toFixed(3));

        let srcLum = primary.lum || 1.0;
        if (w.au > 0) {
            let term1 = srcLum * (1 - w.albedo) * (1 + w.greenhouseFactor);
            let term2 = (w.au * w.au);
            w.meanTempK = 279 * Math.pow(term1 / term2, 0.25);
        } else {
            w.meanTempK = 3;
        }
        tResult('Mean Temp (K)', w.meanTempK.toFixed(1) + ' K');

        // 6. High/Low Temperatures
        tSection('Temp Diurnals');
        w.highTempK = w.meanTempK;
        w.lowTempK = w.meanTempK;
        let tfactor = Math.abs(Math.sin((w.axialTilt || 0) * Math.PI / 180));
        if (w.yearHours < (36.5 * 24)) { tSkip('Quick Year Adjust'); tfactor /= 2; }
        if (w.yearHours > (2 * 8760)) { tSkip('Slow Year Adjust'); tfactor *= 1.5; }

        let rfactor = w.solarDayHours <= 0 || w.solarDayHours === Infinity ? 1.0 : Math.sqrt(w.solarDayHours / 50);
        if (w.tidallyLocked) { tSkip('Tidal Lock Temp Equalization'); rfactor = 1.0; }
        if (rfactor > 1.0) rfactor = 1.0;

        let gfactor = (10 - (w.hydroCode || 0)) / 20;
        if (w.surfaceDist && w.surfaceDist.includes('Concentrated')) gfactor -= 0.1;
        if (w.surfaceDist && w.surfaceDist.includes('Dispersed')) gfactor += 0.1;

        let afactor = 1 + (w.pressureBar || 0);
        let vfactor = Math.max(0, Math.min(1.0, tfactor + rfactor + gfactor));
        let lumMod = vfactor / afactor;

        let highLum = srcLum * (1 + lumMod);
        let lowLum = srcLum * (1 - lumMod);
        let nearAu = w.au * (1 - (w.eccentricity || 0));
        let farAu = w.au * (1 + (w.eccentricity || 0));

        if (nearAu > 0) w.highTempK = 279 * Math.pow(highLum * (1 - w.albedo) * (1 + w.greenhouseFactor) / (nearAu * nearAu), 0.25);
        if (farAu > 0) w.lowTempK = 279 * Math.pow(lowLum * (1 - w.albedo) * (1 + w.greenhouseFactor) / (farAu * farAu), 0.25);
        tResult('High Temp (K)', w.highTempK.toFixed(1) + ' K');
        tResult('Low Temp (K)', w.lowTempK.toFixed(1) + ' K');
    };

    for (let i = 0; i < sys.worlds.length; i++) {
        processBody(sys.worlds[i], null, false);
        for (let j = 0; j < sys.worlds[i].moons.length; j++) {
            processBody(sys.worlds[i].moons[j], sys.worlds[i], true);
        }
    }

    return sys;
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 6: BIOMASS & RESOURCES
// =====================================================================

function generateMgT2ESystemChunk6(sys) {
    let primary = sys.stars[0];
    let primaryMassEarths = primary.mass * 333000;
    tSection('Biomass & Resources');

    let processBody = (w, parent, isMoon) => {
        if (w.type === 'Empty' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

        tSection(`${isMoon ? 'Moon' : w.type} Orbit ${w.orbitId.toFixed(2)} Geology/Biology`);

        // 1. Seismology and Tectonic Plates
        tSection('Seismology');
        let wSize = w.size === 'S' ? 0 : w.size;
        let resBase = wSize - sys.age;
        if (isMoon) resBase += 1;

        let numLargeMoons = w.moons ? w.moons.filter(m => m.size !== 'S' && m.size > 0).length : 0;
        if (!isMoon && numLargeMoons > 0) resBase += Math.min(12, numLargeMoons);

        let density = w.density || 1.0;
        if (density > 1.0) resBase += 2;
        if (density < 0.5) resBase -= 1;

        resBase = Math.floor(resBase);
        let resStress = resBase < 1 ? 0 : (resBase * resBase);

        let tidalStressFactor = 0;

        let e = w.eccentricity || 0;
        let distMkm = w.orbitRadius || (w.au * 149.6);
        let periodDays = w.yearHours / 24;
        let wMassE = w.mass || 1.0;

        let heatFactor = ((primaryMassEarths * primaryMassEarths) * Math.pow(wSize, 5) * (e * e)) /
            (3000 * Math.pow(distMkm, 5) * periodDays * wMassE);
        if (isNaN(heatFactor) || !isFinite(heatFactor) || heatFactor < 1) heatFactor = 0;

        w.seismicStress = Math.floor(resStress + tidalStressFactor + heatFactor);
        tResult('Seismic Stress', w.seismicStress);

        w.tectonicPlates = 0;
        w.plateInteraction = "None";
        if (w.seismicStress > 0 && w.hydroPercent >= 1) {
            let pRoll = tRoll2D('Tectonic Plate Roll');
            tDM('Size/Hydro Mod', wSize + w.hydroCode - 7);
            let p = wSize + w.hydroCode - pRoll;
            if (w.seismicStress >= 10 && w.seismicStress <= 100) { tDM('Stress 10+', 1); p += 1; }
            else if (w.seismicStress > 100) { tDM('Stress 100+', 2); p += 2; }
            if (p > 1) {
                w.tectonicPlates = p;
                w.plateInteraction = MGT2E_PLATE_INTERACTIONS[tRoll2D('Plate Interaction Roll')] || "None";
                tResult('Tectonic Plates', p);
                tResult('Interaction', w.plateInteraction);
            }
        }

        // 2. Biomass Rating
        tSection('Biomass Rating');
        let biomassBase = 0;
        if (sys.age >= 0.1) {
            let bioRoll = tRoll2D('Biomass Roll');
            let bDm = 0;
            if (w.atmCode === 0) { tDM('Atm 0', -6); bDm -= 6; }
            else if (w.atmCode === 1) { tDM('Atm 1', -4); bDm -= 4; }
            else if ([2, 3, 14].includes(w.atmCode)) { tDM('Thin/Med Binary', -3); bDm -= 3; }
            else if ([4, 5].includes(w.atmCode)) { tDM('Thin/Standard', -2); bDm -= 2; }
            else if ([8, 9, 13].includes(w.atmCode)) { tDM('Dense/Thin Cloud', 2); bDm += 2; }
            else if (w.atmCode === 10) { tDM('Exotic', -3); bDm -= 3; }
            else if (w.atmCode === 11) { tDM('Exotic Corrosive', -5); bDm -= 5; }
            else if (w.atmCode === 12) { tDM('Exotic Insid.', -7); bDm -= 7; }
            else if (w.atmCode >= 15) { tDM('High exotic', -5); bDm -= 5; }

            if (w.hydroCode === 0) { tDM('Desert', -4); bDm -= 4; }
            else if (w.hydroCode >= 1 && w.hydroCode <= 3) { tDM('Dry', -2); bDm -= 2; }
            else if (w.hydroCode >= 6 && w.hydroCode <= 8) { tDM('Wet', 1); bDm += 1; }
            else if (w.hydroCode >= 9) { tDM('Water World', 2); bDm += 2; }

            if (sys.age < 0.2) { tDM('Very Young', -6); bDm -= 6; }
            else if (sys.age < 1) { tDM('Young', -2); bDm -= 2; }
            else if (sys.age > 4) { tDM('Mature', 1); bDm += 1; }

            if (w.highTempK > 353) { tDM('Hot High', -2); bDm -= 2; }
            else if (w.highTempK < 273) { tDM('Cold High', -4); bDm -= 4; }

            if (w.meanTempK > 353) { tDM('Hot Mean', -4); bDm -= 4; }
            else if (w.meanTempK < 273) { tDM('Cold Mean', -2); bDm -= 2; }
            else if (w.meanTempK >= 279 && w.meanTempK <= 303) { tDM('Temperate Mean', 2); bDm += 2; }

            bDm = Math.max(-12, Math.min(4, bDm));
            biomassBase = bioRoll + bDm;

            if (biomassBase <= 0) biomassBase = 0;
            if (w.taints && w.taints.includes("Biologic") && biomassBase === 0) {
                tResult('Biomass (Min)', 1);
                biomassBase = 1;
            }

            if (biomassBase >= 1 && [0, 1, 10, 11, 12, 15].includes(w.atmCode)) {
                let extremophileBonus = 0;
                if (w.atmCode === 0) extremophileBonus = 5;
                else if (w.atmCode === 1) extremophileBonus = 3;
                else if (w.atmCode === 10) extremophileBonus = 2;
                else if (w.atmCode === 11) extremophileBonus = 4;
                else if (w.atmCode === 12) extremophileBonus = 6;
                else if (w.atmCode >= 15) extremophileBonus = 4;
                tResult('Extremophile Bonus', extremophileBonus);
                biomassBase += extremophileBonus;
            }
        }
        w.biomass = biomassBase;
        tResult('Final Biomass', biomassBase);

        // 3. Biocomplexity Rating
        tSection('Biocomplexity');
        w.biocomplexity = 0;
        if (w.biomass >= 1) {
            let cDm = 0;
            if (w.atmCode < 4 || w.atmCode > 9) { tDM('Harsh Atm', -2); cDm -= 2; }
            if (w.taints && w.taints.includes("Low Oxygen")) { tDM('Low O2', -2); cDm -= 2; }
            if (sys.age >= 3 && sys.age < 4) { tDM('Age 3-4', -2); cDm -= 2; }
            else if (sys.age >= 2 && sys.age < 3) { tDM('Age 2-3', -4); cDm -= 4; }
            else if (sys.age >= 1 && sys.age < 2) { tDM('Age 1-2', -8); cDm -= 8; }
            else if (sys.age < 1) { tDM('Age <1', -10); cDm -= 10; }

            let effBiomass = w.biomass >= 10 ? 9 : w.biomass;
            w.biocomplexity = Math.max(1, tRoll2D('Biocomplexity Roll') - 7 + effBiomass + cDm);
            tResult('Final Biocomplexity', w.biocomplexity);
        }

        // 4. Native Sophonts
        tSection('Sophont Check');
        w.nativeSophont = false;
        w.extinctSophont = false;
        if (w.biocomplexity >= 8) {
            let effBiocomp = w.biocomplexity >= 10 ? 9 : w.biocomplexity;
            if ((tRoll2D('Sophont Emergence Roll') + effBiocomp - 7) >= 13) {
                tResult('Sophont', 'Native Living');
                w.nativeSophont = true;
            }

            let exDm = sys.age > 5 ? 1 : 0;
            if ((tRoll2D('Extinct Sophont Roll') + effBiocomp - 7 + exDm) >= 13) {
                tResult('Sophont', 'Extinct Relics');
                w.extinctSophont = true;
            }
        }

        // 5. Biodiversity & Compatibility
        tSection('Biodiversity & Compatibility');
        w.biodiversity = 0;
        w.compatibility = 0;
        if (w.biomass >= 1) {
            w.biodiversity = Math.max(1, Math.ceil(tRoll2D('Biodiversity Roll') - 7 + ((w.biomass + w.biocomplexity) / 2)));

            let compDm = 0;
            if ([0, 1, 11, 16, 17].includes(w.atmCode)) compDm -= 8;
            else if ([2, 4, 7, 9].includes(w.atmCode) || (w.taints && w.taints.length > 0)) compDm -= 2;
            else if ([3, 5, 8].includes(w.atmCode)) compDm += 1;
            else if (w.atmCode === 6) compDm += 2;
            else if ([10, 15].includes(w.atmCode)) compDm -= 6;
            else if (w.atmCode === 12) compDm -= 10;
            else if ([13, 14].includes(w.atmCode)) compDm -= 1;

            if (sys.age > 8) compDm -= 2;

            w.compatibility = Math.max(0, Math.floor(tRoll2D('Compatibility Roll') - (w.biocomplexity / 2) + compDm));
            tResult('Biodiversity', w.biodiversity);
            tResult('Compatibility', w.compatibility);
        }

        w.lifeProfile = `${w.biomass.toString(16).toUpperCase()}${w.biocomplexity.toString(16).toUpperCase()}${w.biodiversity.toString(16).toUpperCase()}${w.compatibility.toString(16).toUpperCase()}`;
        if (w.biomass === 0) w.lifeProfile = "0000";
        tResult('Life Profile', w.lifeProfile);

        // 6. Resource Rating
        tSection('Resources');
        let rDm = 0;
        if (density > 1.12) { tDM('High Density', 2); rDm += 2; }
        if (density < 0.5) { tDM('Low Density', -2); rDm -= 2; }
        if (w.biomass >= 3) { tDM('Biogenic Res', 2); rDm += 2; }
        if (w.biodiversity >= 8 && w.biodiversity <= 10) { tDM('Biodiv 8-10', 1); rDm += 1; }
        else if (w.biodiversity >= 11) { tDM('High Biodiv', 2); rDm += 2; }

        if (w.compatibility >= 0 && w.compatibility <= 3) { tDM('Low Comp', -1); rDm -= 1; }
        else if (w.compatibility >= 8) { tDM('High Comp', 2); rDm += 2; }

        w.resourceRating = Math.max(2, Math.min(12, tRoll2D('Resource Roll') - 7 + wSize + rDm));
        tResult('Resource Rating', w.resourceRating);

        // 7. Habitability Rating
        tSection('Habitability Score');
        let hScore = 10;
        if (wSize >= 0 && wSize <= 4) { tDM('Small', -1); hScore -= 1; }
        if (wSize >= 9) { tDM('Large', 1); hScore += 1; }

        if ([0, 1, 10].includes(w.atmCode)) hScore -= 8;
        else if ([2, 14].includes(w.atmCode)) hScore -= 4;
        else if ([3, 13].includes(w.atmCode)) hScore -= 3;
        else if ([4, 9].includes(w.atmCode)) hScore -= 2;
        else if ([5, 7, 8].includes(w.atmCode)) hScore -= 1;
        else if (w.atmCode === 11) hScore -= 10;
        else if (w.atmCode === 12 || w.atmCode >= 15) hScore -= 12;

        if (w.taints && w.taints.includes("Low Oxygen")) hScore -= 2;

        if (w.hydroCode === 0) hScore -= 4;
        else if (w.hydroCode >= 1 && w.hydroCode <= 3) hScore -= 2;
        else if (w.hydroCode === 9) hScore -= 1;
        else if (w.hydroCode === 10) hScore -= 2;

        if (w.tidallyLocked) hScore -= 2;

        if (w.highTempK > 323) hScore -= 2;
        if (w.highTempK < 279) hScore -= 2;
        if (w.meanTempK > 323) hScore -= 4;
        else if (w.meanTempK >= 304 && w.meanTempK <= 323) hScore -= 2;
        else if (w.meanTempK < 273) hScore -= 2;

        if (w.lowTempK < 200) hScore -= 2;

        let grav = (w.gravity !== undefined) ? w.gravity : (w.size === 'S' ? 0.01 : w.size * 0.125);
        if (grav < 0.2) hScore -= 4;
        else if (grav >= 0.2 && grav < 0.4) hScore -= 2;
        else if (grav >= 0.4 && grav < 0.7) hScore -= 1;
        else if (grav >= 0.7 && grav <= 0.9) hScore += 1;
        else if (grav >= 1.1 && grav < 1.4) hScore -= 1;
        else if (grav >= 1.4 && grav <= 2.0) hScore -= 3;
        else if (grav > 2.0) hScore -= 6;

        w.habitability = Math.max(0, hScore);
        tResult('Habitability Score', w.habitability);
    };

    for (let i = 0; i < sys.worlds.length; i++) {
        processBody(sys.worlds[i], null, false);
        for (let j = 0; j < sys.worlds[i].moons.length; j++) {
            processBody(sys.worlds[i].moons[j], sys.worlds[i], true);
        }
    }

    return sys;
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 7: SECONDARY WORLD UWPs
// =====================================================================

function generateMgT2ESystemChunk7(sys, mainworldBase) {
    if (!sys || !mainworldBase) return sys;
    tSection('Secondary World UWPs');

    const toUWPChar = typeof globalThis.toUWPChar === 'function' ? globalThis.toUWPChar : (val) => val.toString(16).toUpperCase();

    function processBody(body, isMoon = false) {
        if (!body || body.type === 'Empty') return;

        // Skip Mainworld here (handled in main loop)
        if (body.type === 'Mainworld') return;

        tSection(`${isMoon ? 'Moon' : body.type} Orbit ${body.orbitId.toFixed(2)} UWP & Class`);

        // 1. Map properties for the Social helper
        body.size = (body.size === 'S' || body.size === 'R') ? 0 : (typeof body.size === 'number' ? body.size : 0);
        body.atm = body.atmCode !== undefined ? body.atmCode : 0;
        body.hydro = body.hydroCode !== undefined ? body.hydroCode : 0;

        // 2. Call the Subordinate Social Generator
        generateMgT2ESubordinateSocial(body, mainworldBase);

        // 3. Classification Logic (WBH Logic)
        tSection('Classification Logic');
        body.classifications = [];
        const floor = getMgT2EMinSusTL(body.atm);
        const mw = mainworldBase;
        const diff = (body.orbitId !== undefined) ? getEffectiveHzcoDeviation(body.orbitId, body.worldHzco || sys.hzco) : 99;
        const isPoor = (mw.tradeCodes && mw.tradeCodes.includes("Po"));
        const isInd = (mw.tradeCodes && mw.tradeCodes.includes("In"));

        // Farming: HZCO ±1.0, Atm 4–9, Hydro 4–8, Pop 2+
        if (Math.abs(diff) <= 1.0 && (body.atm >= 4 && body.atm <= 9) && (body.hydro >= 4 && body.hydro <= 8) && body.pop >= 2) {
            tResult('Classification', 'Farming');
            body.classifications.push("Farming");
        }

        // Mining: MW Industrial, secondary Pop 2+. DM +4 if Planetoid Belt.
        if (isInd && body.pop >= 2) {
            let mRoll = tRoll2D('Mining Presence Roll');
            if (body.type === 'Planetoid Belt') { tDM('Planetoid Belt', 4); mRoll += 4; }
            if (mRoll >= 8) {
                tResult('Classification', 'Mining');
                body.classifications.push("Mining");
            }
        }

        // Research Base: MW Pop 6+, TL 8+, not "Poor". Occurs on 10+ (DM +2 if MW TL 12+).
        if (mw.pop >= 6 && mw.tl >= 8 && !isPoor) {
            let rRoll = tRoll2D('Research Base Roll');
            if (mw.tl >= 12) { tDM('High TL MW', 2); rRoll += 2; }
            if (rRoll >= 10) {
                tResult('Classification', 'Research Base');
                body.classifications.push("Research Base");
            }
        }

        // Military Base: MW TL 8+, not "Poor", secondary Gov 6. Occurs on 12+.
        if (mw.tl >= 8 && !isPoor && body.gov === 6) {
            if (tRoll2D('Military Base Roll') >= 12) {
                tResult('Classification', 'Military Base');
                body.classifications.push("Military Base");
            }
        }

        // Penal Colony: MW TL 9+, MW Law 8+, secondary Gov 6. Occurs on 10+.
        if (mw.tl >= 9 && mw.law >= 8 && body.gov === 6) {
            if (tRoll2D('Penal Colony Roll') >= 10) {
                tResult('Classification', 'Penal Colony');
                body.classifications.push("Penal Colony");
            }
        }

        // 4. Refine Tech Level (Classification Bonuses)
        tSection('Tech Level Refinement');
        if (body.classifications.includes("Research Base") || body.classifications.includes("Military Base")) {
            tResult('TL Bonus', 'MW TL Match');
            body.tl = mw.tl;
        } else if (body.classifications.includes("Mining")) {
            tResult('TL Bonus', 'Mining Basis');
            body.tl = Math.max(mw.tl, floor);
        } else {
            tResult('TL Bonus', 'Standard (MW TL-1)');
            body.tl = Math.max(mw.tl - 1, floor);
        }
        if (body.tl === floor) tClamp('Tech Level', mw.tl - 1, floor);

        // 5. Final UWP Construction
        // Planetoid Belts usually use size 0
        const cSize = clampUWP(body.size || 0, 0, 15);
        const cAtm = clampUWP(body.atm || 0, 0, 15);
        const cHydro = clampUWP(body.hydro || 0, 0, 10);
        const cPop = clampUWP(body.pop || 0, 0, 15);
        const cGov = clampUWP(body.gov || 0, 0, 15);
        const cLaw = clampUWP(body.law || 0, 0, 15);
        const cTl = clampUWP(body.tl || 0, 0, 33);

        const uwp = `${body.starport}${toUWPChar(cSize)}${toUWPChar(cAtm)}${toUWPChar(cHydro)}${toUWPChar(cPop)}${toUWPChar(cGov)}${toUWPChar(cLaw)}-${toUWPChar(cTl)}`;

        body.uwp = uwp;
        body.uwpSecondary = uwp;
        tResult('Final UWP', uwp);

        // If no classifications, mark as 'Standard'
        if (body.classifications.length === 0) {
            body.classifications.push('Standard');
        }
    }

    // Process all worlds and their moons
    (sys.worlds || []).forEach(w => {
        if (w.type === 'Mainworld') {
            w.classifications = ['Mainworld'];
            w.uwpSecondary = mainworldBase.uwp;
        } else {
            processBody(w, false);
        }

        // Every body can have moons in this engine (even GGs)
        if (w.moons && w.moons.length > 0) {
            w.moons.forEach(m => processBody(m, true));
        }
    });

    runMgT2EHzcoAudit(sys);

    if (window.isLoggingEnabled) endTrace();
    return sys;
}

function runMgT2EHzcoAudit(sys) {
    tSection('HZCO Unit Test Audit');
    let totalTests = 0;
    let passedTests = 0;

    const auditBody = (body, label) => {
        if (!body || body.type === 'Empty' || body.orbitId === undefined) return;
        totalTests++;

        // 1. Expected HZCO calculation
        let expectedLum = 0;
        if (body.orbitType === 'P-Type') {
            expectedLum = sys.stars.reduce((sum, s) => {
                let sOrbit = (s.orbitId !== undefined && s.orbitId !== null) ? s.orbitId : 0;
                return sOrbit < body.orbitId ? sum + (s.lum || 0) : sum;
            }, 0);
        } else {
            let parent = sys.stars[body.parentStarIdx || 0];
            expectedLum = parent ? (parent.lum || 0) : 0;
        }

        let expectedAu = Math.sqrt(expectedLum);
        let expectedHzco = convertAuToOrbit(expectedAu);

        // 2. Expected Deviation
        let expectedDev = 0;
        if (body.orbitId < 1.0 || expectedHzco < 1.0) {
            let minVal = Math.min(body.orbitId, expectedHzco);
            expectedDev = (body.orbitId - expectedHzco) / Math.max(0.01, minVal);
        } else {
            expectedDev = body.orbitId - expectedHzco;
        }

        let hzcoMatch = Math.abs((body.worldHzco || 0) - expectedHzco) < 0.01;
        let runtimeDev = getEffectiveHzcoDeviation(body.orbitId, body.worldHzco || 0);
        let devMatch = Math.abs(runtimeDev - expectedDev) < 0.01;

        if (hzcoMatch && devMatch) {
            passedTests++;
            writeLogLine(`  [PASS] ${label} (Orbit ${body.orbitId.toFixed(2)}): HZCO ${expectedHzco.toFixed(2)}, Dev ${expectedDev.toFixed(2)}`);
        } else {
            writeLogLine(`  [FAIL] ${label} (Orbit ${body.orbitId.toFixed(2)}):`);
            if (!hzcoMatch) writeLogLine(`    - HZCO mismatch: expected ${expectedHzco.toFixed(2)}, found ${(body.worldHzco || 0).toFixed(2)}`);
            if (!devMatch) writeLogLine(`    - Dev mismatch: expected ${expectedDev.toFixed(2)}, found ${runtimeDev.toFixed(2)}`);
        }
    };

    (sys.worlds || []).forEach((w, idx) => {
        auditBody(w, w.type === 'Mainworld' ? 'Mainworld' : `World ${idx}`);
        (w.moons || []).forEach((m, midx) => {
            auditBody(m, `World ${idx} Moon ${midx}`);
        });
    });

    tResult('Audit Summary', `${passedTests} / ${totalTests} Passed`);
}

function runStellarAudit(sys) {
    tSection('Stellar Placement & Orbital Audit');
    let totalErrors = 0;

    // 1. Orbit Sequence Validation
    for (let i = 1; i < sys.worlds.length; i++) {
        let prev = sys.worlds[i - 1];
        let curr = sys.worlds[i];
        if (curr.orbitId <= prev.orbitId) {
            writeLogLine(`  [FAIL] Sequence: World ${i} (Orbit ${curr.orbitId.toFixed(2)}) is not > World ${i - 1} (Orbit ${prev.orbitId.toFixed(2)})`);
            totalErrors++;
        }
    }
    if (totalErrors === 0 && sys.worlds.length > 0) writeLogLine('  [PASS] Orbit Sequence: All worlds in increasing order.');

    // 2. Scenario 1-3 Period Verification
    for (let w of sys.worlds) {
        if (w.type === 'Empty') continue;

        let Sum_M = 0;
        if (w.orbitType === 'P-Type') {
            Sum_M = sys.stars.reduce((sum, s) => {
                let sOrbit = (s.orbitId !== null && s.orbitId !== undefined) ? s.orbitId : 0;
                return sOrbit < w.orbitId ? sum + s.mass : sum;
            }, 0);
        } else {
            let pIdx = (w.parentStarIdx !== undefined) ? w.parentStarIdx : 0;
            Sum_M = (sys.stars[pIdx] || sys.stars[0]).mass;
        }
        let planetSolarMass = (w.mass || 0) * 0.000003;
        let expectedPeriod = Math.sqrt(Math.pow(w.au, 3) / (Sum_M + planetSolarMass));

        if (Math.abs(w.periodYears - expectedPeriod) > 0.01) {
            writeLogLine(`  [FAIL] Period: ${w.type} at Orbit ${w.orbitId.toFixed(2)} variance > 0.01 (Exp: ${expectedPeriod.toFixed(4)}, Found: ${w.periodYears.toFixed(4)})`);
            totalErrors++;
        }
    }

    // 3. Baseline Anchor Check
    let mw = null;
    let effectiveOrbit = 0;

    for (let w of sys.worlds) {
        if (w.type === 'Mainworld') {
            mw = w;
            effectiveOrbit = w.orbitId;
        }
        if (w.moons) {
            let moonMW = w.moons.find(m => m.type === 'Mainworld');
            if (moonMW) {
                mw = moonMW;
                effectiveOrbit = w.orbitId; // Use the Planet's orbit as the anchor
            }
        }
    }

    if (mw) {
        if (Math.abs(effectiveOrbit - sys.baselineOrbit) > 0.01) {
            writeLogLine(`  [FAIL] Baseline Anchor: Mainworld (or Parent) at ${effectiveOrbit.toFixed(2)}, Expected ${sys.baselineOrbit.toFixed(2)}`);
            totalErrors++;
        } else {
            writeLogLine(`  [PASS] Baseline Anchor: Position ${effectiveOrbit.toFixed(2)} matches target.`);
        }
    }

    // 4. Forbidden Zone Compliance
    for (let w of sys.worlds) {
        for (let fz of (sys.forbiddenZones || [])) {
            if (w.orbitId >= fz.min && w.orbitId <= fz.max) {
                writeLogLine(`  [STABILITY ERROR] ${w.type} at Orbit ${w.orbitId.toFixed(2)} is within Forbidden Zone ${fz.min.toFixed(2)}-${fz.max.toFixed(2)}`);
                totalErrors++;
            }
        }
    }

    // 5. Physiological Physics Check
    for (let w of sys.worlds) {
        if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            const sR = w.size / 8;

            // A. Density Mapping Verification
            const densityRanges = {
                'Rare Minerals': { min: 1.4, max: 1.9 },
                'Heavy Core': { min: 1.1, max: 1.5 },
                'Standard Core': { min: 0.9, max: 1.1 },
                'Light Core': { min: 0.6, max: 0.9 },
                'Icy Core': { min: 0.3, max: 0.6 }
            };
            const range = densityRanges[w.composition];
            if (range) {
                if (w.density < range.min - 0.001 || w.density > range.max + 0.001) {
                    writeLogLine(`  [PHYSICS AUDIT] Density Fail: ${w.type} (${w.composition}) density ${w.density.toFixed(3)} outside range ${range.min}-${range.max}`);
                    totalErrors++;
                }
            }

            // B. Gravity Consistency Check
            const calcGrav = sR * w.density;
            if (Math.abs(calcGrav - w.gravity) > 0.01) {
                writeLogLine(`  [PHYSICS AUDIT] [PHYSICS FAIL] Gravity deviation: ${w.type} Exp: ${calcGrav.toFixed(3)}, Found: ${w.gravity.toFixed(3)}`);
                totalErrors++;
            }

            // C. Mass-Gravity Ratio Check
            const calcMass = w.gravity * Math.pow(sR, 2);
            if (Math.abs(calcMass - w.mass) > 0.01) {
                writeLogLine(`  [PHYSICS AUDIT] [MASS FAIL] Mass identity mismatch: ${w.type} Exp: ${calcMass.toFixed(4)}, Found: ${w.mass.toFixed(4)}`);
                totalErrors++;
            }

            // D. Velocity Sanity Check (ev = sqrt(2) * ov)
            if (w.escapeVel && w.orbitalVelSurface) {
                let ratio = w.escapeVel / w.orbitalVelSurface;
                if (Math.abs(ratio - Math.sqrt(2)) > 0.0001) {
                    writeLogLine(`  [PHYSICS AUDIT] [VELOCITY FAIL] Ratio: ${ratio.toFixed(4)}, Expected 1.4142`);
                    totalErrors++;
                }
            }
        }
    }

    // 6. Belt Integrity Audit
    for (let w of sys.worlds) {
        if (w.type === 'Planetoid Belt') {
            // A. Composition Summation Check
            let totalComp = (w.mType || 0) + (w.sType || 0) + (w.cType || 0) + (w.oType || 0);
            if (totalComp !== 100) {
                writeLogLine(`  [BELT COMPOSITION FAIL] Belt at Orbit ${w.orbitId.toFixed(2)} composition sums to ${totalComp}%`);
                totalErrors++;
            }

            // B. Resource Rating Clamp Check
            let rr = w.resourceRating !== undefined ? w.resourceRating : 0;
            if (rr < 2 || rr > 12) {
                writeLogLine(`  [BELT RESOURCE FAIL] Belt at Orbit ${w.orbitId.toFixed(2)} resource rating ${rr} outside 2-12 range`);
                totalErrors++;
            }

            // C. Significant Body Containment Check
            if (w.significantBodies && w.significantBodies.length > 0) {
                let beltInner = w.orbitId - (w.span / 2);
                let beltOuter = w.orbitId + (w.span / 2);
                for (let sb of w.significantBodies) {
                    if (sb.orbitId < (beltInner - 0.05) || sb.orbitId > (beltOuter + 0.05)) {
                        writeLogLine(`  [BELT STABILITY FAIL] Dwarf Planet [Size ${sb.size}] at Orbit ${sb.orbitId.toFixed(3)} is outside Belt Span (${beltInner.toFixed(3)} - ${beltOuter.toFixed(3)})`);
                        totalErrors++;
                    }
                }
            }

            // D. Bulk Integrity Check
            if (w.bulk !== undefined && w.bulk < 1) {
                writeLogLine(`  [BELT BULK FAIL] Belt at Orbit ${w.orbitId.toFixed(2)} bulk is ${w.bulk}, expected >= 1`);
                totalErrors++;
            }
        }
    }

    tResult('Stellar Audit Summary', totalErrors === 0 ? 'ALL CHECKS PASSED' : `${totalErrors} ERRORS FOUND`);
}


// =====================================================================
// MGT2E SYSTEM GENERATION - PLANETOID BELT PROFILE
// =====================================================================
function generateMgT2EBeltProfile(belt, sys, mainworldBase) {
    tSection(`Belt Profile: Orbit ${belt.orbitId.toFixed(2)}`);

    // Helper: Find system spread (max orbit - min orbit)
    let minOrbit = Infinity, maxOrbit = -Infinity;
    let hzco = belt.worldHzco || sys.hzco;
    let adjacentOrbits = [];
    sys.worlds.forEach(w => {
        if (w.orbitId !== null && w.orbitId !== undefined) {
            if (w.orbitId < minOrbit) minOrbit = w.orbitId;
            if (w.orbitId > maxOrbit) maxOrbit = w.orbitId;
            if (w.orbitId !== belt.orbitId && w.parentStarIdx === belt.parentStarIdx) {
                adjacentOrbits.push(w);
            }
        }
    });

    let sysSpread = (minOrbit !== Infinity && maxOrbit !== -Infinity && maxOrbit > minOrbit)
        ? (maxOrbit - minOrbit)
        : (tRoll2D('Fallback System Spread') * 0.1);

    adjacentOrbits.sort((a, b) => a.orbitId - b.orbitId);
    let isOutermost = belt.orbitId >= maxOrbit;

    let nextInner = [...adjacentOrbits].reverse().find(w => w.orbitId < belt.orbitId);
    let nextOuter = adjacentOrbits.find(w => w.orbitId > belt.orbitId);
    let adjacentGG = (nextInner && nextInner.type === 'Gas Giant') || (nextOuter && nextOuter.type === 'Gas Giant');

    // STEP 1: Determine Belt Span
    let spanRoll = tRoll2D('Belt Span Roll');
    let spanDM = 0;
    if (adjacentGG) { tDM('Adjacent Gas Giant', -1); spanDM -= 1; }
    if (isOutermost) { tDM('Outermost Orbit', 3); spanDM += 3; }

    belt.span = (sysSpread * Math.max(0, spanRoll + spanDM)) / 10;
    tResult('System Spread', sysSpread.toFixed(2));
    tResult('Belt Span (Orbit#s)', belt.span.toFixed(3));

    // STEP 2: Determine Belt Composition
    let compRoll = tRoll2D('Belt Composition Roll');
    let compDM = 0;
    if (Math.abs(belt.orbitId - hzco) <= 0.5) {
        tDM('Inside/Near HZCO', -4); compDM -= 4;
    }
    if (belt.orbitId > hzco + 2.0) {
        tDM('Beyond HZCO + 2.0', 4); compDM += 4;
    }

    let cidx = Math.max(0, Math.min(12, compRoll + compDM));
    let mPct = 0, sPct = 0, cPct = 0, oPct = 0;

    switch (cidx) {
        case 0: mPct = 60 + (tRoll1D('M-Type') * 5); sPct = (tRoll1D('S-Type') * 5); cPct = 0; break;
        case 1: mPct = 50 + (tRoll1D('M-Type') * 5); sPct = 5 + (tRoll1D('S-Type') * 5); cPct = Math.ceil(tRoll1D('C-Type') / 2); break;
        case 2: mPct = 40 + (tRoll1D('M-Type') * 5); sPct = 15 + (tRoll1D('S-Type') * 5); cPct = tRoll1D('C-Type'); break;
        case 3: mPct = 25 + (tRoll1D('M-Type') * 5); sPct = 30 + (tRoll1D('S-Type') * 5); cPct = tRoll1D('C-Type'); break;
        case 4: mPct = 15 + (tRoll1D('M-Type') * 5); sPct = 35 + (tRoll1D('S-Type') * 5); cPct = 5 + tRoll1D('C-Type'); break;
        case 5: mPct = 5 + (tRoll1D('M-Type') * 5); sPct = 40 + (tRoll1D('S-Type') * 5); cPct = 5 + (tRoll1D('C-Type') * 2); break;
        case 6: mPct = tRoll1D('M-Type') * 5; sPct = 40 + (tRoll1D('S-Type') * 5); cPct = tRoll1D('C-Type') * 5; break;
        case 7: mPct = 5 + (tRoll1D('M-Type') * 2); sPct = 35 + (tRoll1D('S-Type') * 5); cPct = 10 + (tRoll1D('C-Type') * 5); break;
        case 8: mPct = 5 + tRoll1D('M-Type'); sPct = 30 + (tRoll1D('S-Type') * 5); cPct = 20 + (tRoll1D('C-Type') * 5); break;
        case 9: mPct = tRoll1D('M-Type'); sPct = 15 + (tRoll1D('S-Type') * 5); cPct = 40 + (tRoll1D('C-Type') * 5); break;
        case 10: mPct = tRoll1D('M-Type'); sPct = 5 + (tRoll1D('S-Type') * 5); cPct = 50 + (tRoll1D('C-Type') * 5); break;
        case 11: mPct = Math.ceil(tRoll1D('M-Type') / 2); sPct = 5 + (tRoll1D('M-Type') * 2); cPct = 60 + (tRoll1D('C-Type') * 5); break;
        case 12: default: mPct = 0; sPct = tRoll1D('S-Type'); cPct = 70 + (tRoll1D('C-Type') * 5); break;
    }

    let totalComp = mPct + sPct + cPct;
    if (totalComp > 100) {
        let excess = totalComp - 100;
        let mRemove = Math.min(mPct, excess);
        mPct -= mRemove;
        excess -= mRemove;
        if (excess > 0) {
            let sRemove = Math.min(sPct, excess);
            sPct -= sRemove;
        }
    } else if (totalComp < 100) {
        oPct = 100 - totalComp;
    }

    belt.mType = mPct; belt.sType = sPct; belt.cType = cPct; belt.oType = oPct;
    tResult('Composition', `M: ${mPct}%, S: ${sPct}%, C: ${cPct}%, O: ${oPct}%`);

    // STEP 3: Determine Belt Bulk
    let bulkRoll = tRoll2D('Belt Bulk Roll');
    belt.bulk = Math.max(1, bulkRoll - Math.floor(sys.age / 2) + Math.floor(cPct / 10));
    tResult('Belt Bulk', belt.bulk);

    // STEP 4: Determine Belt Resource Rating
    let sysTL = 0;
    let isIndustrial = false;
    if (mainworldBase) {
        sysTL = typeof mainworldBase.tl === 'string' ? fromEHex(mainworldBase.tl) : mainworldBase.tl;
        isIndustrial = mainworldBase.tradeCodes && mainworldBase.tradeCodes.includes('In');
    }

    let resBase = tRoll2D('Resource Base (2D-7)') - 7;
    let resRating = resBase + belt.bulk + Math.floor(mPct / 10) - Math.floor(cPct / 10);

    if (isIndustrial && sysTL >= 8) {
        let depl = tRoll1D('Depletion Roll');
        tResult('Depletion (In/TL8+)', `-${depl}`);
        resRating -= depl;
    }

    belt.resourceRating = Math.max(2, Math.min(12, resRating));
    tResult('Resource Rating', toUWPChar(belt.resourceRating));

    // STEP 5: Determine Belt Significant Bodies
    let s1Roll = tRoll2D('Size 1 Roll');
    let s1DM = 0;
    if (belt.orbitId > hzco + 3.0) { tDM('Outer System (+3.0+)', 2); s1DM += 2; }
    if (belt.span < 0.1) { tDM('Narrow Belt', -4); s1DM -= 4; }
    let s1Count = s1Roll - 12 + belt.bulk + s1DM;

    let ssRoll = tRoll2D('Size S Roll');
    let ssTotalDM = 0;
    if (belt.orbitId >= hzco + 2.0 && belt.orbitId <= hzco + 3.0) { ssTotalDM += 1; tDM('Outer Orbit (+2.0 to 3.0)', 1); }
    if (belt.orbitId > hzco + 3.0) { ssTotalDM += 3; tDM('Outer System (+3.0+)', 3); }
    if (belt.span > 1.0) { ssTotalDM += 1; tDM('Wide Belt', 1); }

    let ssCount = ssRoll - 10 + (ssTotalDM + 1) * (belt.bulk + 1);

    if (belt.span < 0.1) {
        tDM('Narrow Span S-Size Adj', 'Half (Round Up)');
        ssCount = Math.ceil(ssCount / 2);
    }

    if (ssCount > 50 && isOutermost) {
        let vMult = tRoll1D('Outermost Variance') / Math.ceil(tRoll1D('Variance Divisor') / 2);
        ssCount = Math.floor((ssCount * vMult) + tRoll1D('Variance Base'));
        tResult('Outermost Variance Mod', `Applied`);
    }

    belt.size1Count = Math.max(0, s1Count);
    belt.sizeSCount = Math.max(0, ssCount);
    tResult('Significant Bodies', `Size 1: ${belt.size1Count}, Size S: ${belt.sizeSCount}`);

    // Generate physical objects for Significant Bodies
    belt.significantBodies = [];
    let totSig = belt.size1Count + belt.sizeSCount;
    for (let i = 0; i < totSig; i++) {
        let sSize = i < belt.size1Count ? 1 : 'S';
        let subObRoll = tRoll2D('Sub-Orbit Roll (2D-7)') - 7;
        let sOrb = belt.orbitId + ((subObRoll * belt.span) / 8);

        let eccRoll = tRoll2D('SigBody Ecc Roll');
        tDM('Inside Asteroid Belt', -1);
        let sr = eccRoll - 1;
        let base = 0, frac = 0;
        if (sr <= 5) { base = -0.001; frac = rng() / 10000; }
        else if (sr <= 7) { base = 0.000; frac = rng() / 200; }
        else if (sr <= 9) { base = 0.030; frac = rng() / 100; }
        else if (sr === 10) { base = 0.050; frac = rng() / 20; }
        else { base = 0.050; frac = (rng() + rng()) / 20; }
        let ecc = Math.max(0, base + frac);

        let sb = {
            type: 'Planetoid Belt Body',
            size: sSize,
            orbitId: sOrb,
            eccentricity: ecc
        };
        mgt2e_calculateTerrestrialPhysical(sb, `SigBody [${sSize}]`);
        belt.significantBodies.push(sb);
    }

    belt.significantBodies.sort((a, b) => a.orbitId - b.orbitId);

    // STEP 6: Compile Profile String
    const pad = (num) => num.toString().padStart(2, '0');
    // Format: Span-MM.SS.CC.OO-Bulk-ResourceRating-Size1Count-SizeSCount
    belt.beltProfileString = `${belt.span.toFixed(2)}-${pad(mPct)}.${pad(sPct)}.${pad(cPct)}.${pad(oPct)}-${belt.bulk}-${toUWPChar(belt.resourceRating)}-${belt.size1Count}-${belt.sizeSCount}`;
    tResult('Belt Profile String', belt.beltProfileString);
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 4: ATMOSPHERE & HYDROGRAPHICS
// =====================================================================

function getTempBand(orbitId, hzco) {
    let diff = getEffectiveHzcoDeviation(orbitId, hzco);
    if (diff <= -2.01) return "Boiling";
    if (diff <= -1.01) return "Hot";
    if (diff <= 1.00) return "Temperate";
    if (diff <= 3.00) return "Cold";
    return "Frozen";
}

function generateMgT2ESystemChunk4(sys, mainworldBase) {
    let processWorld = (w) => {
        if (w.type === 'Empty' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

        tSection(`Atmosphere & Hydro: ${w.type} Orbit ${w.orbitId.toFixed(2)}`);
        let tempBand = getTempBand(w.orbitId, w.worldHzco || sys.hzco);
        tResult('Temperature Band', tempBand);

        // Preliminary Temperature Estimation (Module 4)
        if (w.meanTempK === undefined) {
            let pIdx = w.parentStarIdx !== undefined ? w.parentStarIdx : 0;
            let lum = (sys.stars[pIdx] || sys.stars[0]).lum || 1.0;
            if (w.orbitType === 'P-Type') {
                lum = sys.stars.reduce((s, star) => star.orbitId < w.orbitId ? s + (star.lum || 0) : s, 0);
            }
            // Estimate using 0.3 albedo and a small greenhouse factor baseline
            w.meanTempK = 279 * Math.pow(lum / (w.au * w.au), 0.25) * 0.93;
        }

        // Gas Retention Physics
        w.diameterTerra = (w.diamKm || (w.size * 1600)) / 12742;
        let bodyMass = w.mass !== undefined ? w.mass : Math.pow(w.size / 8, 3);
        w.maxEscapeValue = 1000 * (bodyMass / (w.diameterTerra * w.meanTempK));
        tResult('Max Escape Value', w.maxEscapeValue.toFixed(3));

        // 1. Base Atmosphere Code
        if (w.size === 'S' || w.size === 0 || w.size === 1) {
            tSkip('Size 0, 1, S forces Atmosphere 0');
            w.atmCode = 0;
        } else if (w.type === 'Mainworld' && mainworldBase && mainworldBase.atm !== undefined) {
            tSkip('Mainworld Atmosphere Inherited');
            w.atmCode = mainworldBase.atm;
        } else {
            let baseRoll = tRoll2D('Atmosphere Roll');
            tDM('Size Mod', w.size - 7);
            baseRoll = baseRoll - 7 + w.size;
            if (w.size >= 2 && w.size <= 4) {
                tDM('Size Variant (2-4)', -2);
                baseRoll -= 2;
            }
            // 1a. Refined Deviation Logic (Phase 1)
            let diff = getEffectiveHzcoDeviation(w.orbitId, w.worldHzco || sys.hzco);
            let hzco = w.worldHzco || sys.hzco;
            if (hzco < 1.0 && diff < 0) {
                // Scale negative deviation thresholds for inner orbits where bands are physically compressed
                diff = diff * 10;
            }

            // Flags for Phase 4 Checks
            w._atmHazardFlag = false;
            w._atmExtremeHeatFlag = false;

            if (diff >= -1.00 && diff <= 1.00) {
                w.atmCode = Math.max(0, baseRoll);
            } else if (diff < -1.00) {
                // Hot Atmospheres Table (Phase 2)
                tSection('Non-Habitable Zone: Hot Atmospheres');
                let bracketRoll = Math.max(0, Math.min(17, baseRoll));

                if (diff >= -2.0) { // Bracket -1.01 to -2.0
                    let bracket1 = [0, 1, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 11, 12, 15, 16, 17 /*H*/];
                    let hazard1 = [false, false, true, false, true, false, false, true, false, true, "Check", false, false, false, false, false, false, false];

                    w.atmCode = bracket1[bracketRoll];
                    w._atmHazardFlag = hazard1[bracketRoll];
                } else { // Bracket -2.01 or less
                    let bracket2 = [0, 0, 1, 1, 10, 10, 10, 10, 10, 11, 11, 11, 12, 11, 12, 15, 16, 17 /*H*/];
                    let hazard2 = [false, false, false, false, "Check", "Check", "Check", "Check", "Check", false, false, false, false, false, false, false, false, false];

                    w.atmCode = bracket2[bracketRoll];
                    w._atmHazardFlag = hazard2[bracketRoll];
                    w._atmExtremeHeatFlag = (diff <= -3.0 && (w.atmCode === 8 || w.atmCode === 9 || w.atmCode === 10)); // Explicit Dense/Very Dense Exotic check
                }

                // Process Exotic Sub-codes (Pressure ranges mapped back to standard UWP for code 10 bases)
                if (w.atmCode === 10) {
                    if (bracketRoll >= 2 && bracketRoll <= 3) w.atmCode = 10; // Very Thin Exotic (Stays 10 but will generate low p)
                    // (We leave it as 10 since the profile generation handles "A" and dynamically sets pressure in Module 2)
                }
            } else {
                // Cold Atmospheres Table (Phase 3)
                tSection('Non-Habitable Zone: Cold Atmospheres');
                let bracketRoll = Math.max(0, Math.min(17, baseRoll));

                if (diff <= 3.0) { // Bracket +1.01 to +3.0
                    let bracket3 = [0, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 13 /*D*/, 11, 15, 16, 17 /*H*/];
                    let hazard3 = [false, false, false, "Check", true, false, false, true, false, true, "Check", false, false, false, false, false, false, false];

                    w.atmCode = bracket3[bracketRoll];
                    w._atmHazardFlag = hazard3[bracketRoll];
                } else { // Bracket +3.01 or more
                    let bracket4 = [0, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 16 /*G*/, 17 /*H*/, 15, 17 /*H*/, 17 /*H*/];
                    let hazard4 = [false, false, false, "Check", true, false, false, true, false, true, "Check", false, false, false, false, false, false, false];

                    w.atmCode = bracket4[bracketRoll];
                    w._atmHazardFlag = hazard4[bracketRoll];
                }
            }
            // Clamp atmospheric codes to valid UWP max for our generation purposes before hazard checks
            if (w.atmCode > 15 && w.atmCode !== 16 && w.atmCode !== 17) w.atmCode = 15;

            // 4a. Edge Case: Extreme Heat Check
            if (w._atmExtremeHeatFlag) {
                let heatRoll = tRoll1D('Extreme Heat Check') + 1;
                if (heatRoll === 1) { w.atmCode = 1; tResult('Extreme Heat', 'Code 1 (Trace)'); }
                else if (heatRoll >= 3 && heatRoll <= 5) { w.atmCode = 11; tResult('Extreme Heat', 'Code B (Corrosive)'); }
                else if (heatRoll >= 6) { w.atmCode = 12; tResult('Extreme Heat', 'Code C (Insidious)'); }
                else { tResult('Extreme Heat', 'Unchanged'); }
            }
        }

        w.atmCode = Math.max(0, Math.min(15, w.atmCode));
        tResult('Final Atmosphere Code', toUWPChar(w.atmCode));

        // 2. Runaway Greenhouse
        let tempState = w.tempStatus || tempBand;
        if (w.atmCode >= 2 && w.atmCode <= 15 && (tempState === "Hot" || tempState === "Boiling" || tempState === "Temperate")) {
            let rgDM = Math.ceil(sys.ageGyr || sys.age || 0);
            if (w.meanTempK > 303) {
                let preciseDM = Math.floor((w.meanTempK - 303) / 10);
                tDM('Precise Temp', preciseDM);
                rgDM += preciseDM;
            } else if (tempState === "Boiling") {
                tDM('Boiling', 4);
                rgDM += 4;
            }

            let currentOrbit = w.orbit !== undefined ? w.orbit : w.orbitId;
            let hzco = w.worldHzco || sys.hzco;

            if (currentOrbit < hzco && tempState === 'Temperate') {
                tDM('Targeted Temperate Penalty', -2);
                rgDM -= 2;
            }

            tSection('Runaway Greenhouse Check');
            if (tRoll2D('Runaway Greenhouse Roll (12+)') + rgDM >= 12) {
                tResult('Result', 'Runaway Greenhouse Triggered');
                w.runawayGreenhouse = true;
                tempBand = "Boiling";
                if (w.tempStatus) w.tempStatus = "Boiling"; // Force to Boiling immediately

                let isStandardRange = (w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14;
                if (isStandardRange) {
                    let rRoll = tRoll1D('New Atmosphere Type');
                    if (w.size >= 2 && w.size <= 5) { tDM('Size 2-5', -2); rRoll -= 2; }
                    if ([2, 4, 7, 9].includes(w.atmCode)) { tDM('Tainted Atm', 1); rRoll += 1; }

                    if (rRoll <= 1) w.atmCode = 10;
                    else if (rRoll <= 4) w.atmCode = 11;
                    else w.atmCode = 12;

                    tResult('New Atmosphere', toUWPChar(w.atmCode));
                }
            } else {
                tResult('Result', 'Normal');
            }
        }

        if (w.gravity === undefined) {
            w.gravity = (w.size === 0 || w.size === 'S') ? 0 : w.size * 0.125;
        }
        tResult('Gravity (G)', w.gravity.toFixed(3));

        // 3. Seeded Atmospheric Pressure (Step 1)
        if (w.atmCode >= 1 && w.atmCode <= 15) {
            let cdata = MGT2E_ATM_CODES[w.atmCode];
            let seededFraction = rng(); // rng is seeded per hex in mainworld/system generation, but adding pseudo-reseed if requested
            if (sys.hexId) {
                seededFraction = rng();
            }
            w.totalPressureBar = cdata.minP + (cdata.spanP * seededFraction);
            w.pressureBar = w.totalPressureBar; // Keep legacy property for compatibility
            tResult('Total Pressure (Bar)', w.totalPressureBar.toFixed(2));
        } else if (w.atmCode === 0) {
            w.totalPressureBar = 0;
            w.pressureBar = 0;
            tResult('Total Pressure (Bar)', 'Trace/None');
        }

        // 4. Oxygen Fraction & ppo (Step 2)
        if ((w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14) {
            tSection('Composition & Scale Height');

            let ageDM = 0;
            let sysAge = sys.ageGyr || sys.age || 0;
            if (sysAge > 4.0) ageDM = 1;
            else if (sysAge >= 3.0 && sysAge <= 3.5) ageDM = -1;
            else if (sysAge >= 2.0 && sysAge <= 2.99) ageDM = -2;
            else if (sysAge < 2.0) ageDM = -4;

            let o2Roll = tRoll1D('Oxygen Roll') - 1 + ageDM;
            if (ageDM !== 0) tDM('Age DM', ageDM);

            w.oxygenFrac = Math.max(0.01, (o2Roll / 20) + (Math.floor(rng() * 10) / 100));
            w.oxygenFraction = w.oxygenFrac; // Store as requested
            w.ppoBar = w.oxygenFraction * w.totalPressureBar;
            w.ppo = w.ppoBar; // Keep legacy property

            tResult('Oxygen Fraction', (w.oxygenFraction * 100).toFixed(1) + '%');
            tResult('ppo (Bar)', w.ppoBar.toFixed(3));

            // The UWP "Auto-Taint" Loopback
            w.taints = [];
            let isLowO2 = w.ppoBar < 0.1;
            let isHighO2 = w.ppoBar > 0.5;

            if (isLowO2) { tResult('Taint', 'Low Oxygen'); w.taints.push("Low Oxygen"); }
            if (isHighO2) { tResult('Taint', 'High Oxygen'); w.taints.push("High Oxygen"); }

            if (isLowO2 || isHighO2) {
                if (w.atmCode === 5) { tResult('Auto-Taint Loopback', '5 -> 4'); w.atmCode = 4; }
                else if (w.atmCode === 6) { tResult('Auto-Taint Loopback', '6 -> 7'); w.atmCode = 7; }
                else if (w.atmCode === 8) { tResult('Auto-Taint Loopback', '8 -> 9'); w.atmCode = 9; }
            }

            let generateAtmosphericTaints = () => {
                let tRoll = tRoll2D('Taint Subtype Roll');
                if (w.atmCode === 4) { tDM('Atm 4', -2); tRoll -= 2; }
                if (w.atmCode === 9) { tDM('Atm 9', 2); tRoll += 2; }
                let t = MGT2E_TAINT_SUBTYPES[Math.max(2, Math.min(12, tRoll))];

                // Temperature Precision for Sulphur
                if (t === "Sulphur Compounds" && w.meanTempK !== undefined && w.meanTempK < 273) {
                    tResult('Taint Precision', 'Temp < 273K: Sulphur freezes to Particulates');
                    t = "Particulates";
                }

                if (t && !w.taints.includes(t)) {
                    tResult('Atm Taint', t);
                    w.taints.push(t);

                    // ppo Retroactive Recalculation
                    if (t === "Low Oxygen") {
                        w.ppoBar = 0.10 - (tRoll1D('Retroactive Low ppo Roll') / 100);
                        w.ppo = w.ppoBar;
                        tResult('Retro ppoBar (L O2)', w.ppoBar.toFixed(3));
                    } else if (t === "High Oxygen") {
                        w.ppoBar = 0.50 + (tRoll1D('Retroactive High ppo Roll') / 10);
                        w.ppo = w.ppoBar;
                        tResult('Retro ppoBar (H O2)', w.ppoBar.toFixed(3));
                    }
                }

                let sevRoll = tRoll2D('Taint Severity');
                let sevIdx = Math.max(1, Math.min(9, sevRoll));
                w.taintSeverity = MGT2E_TAINT_SEVERITY[sevIdx];
                tResult('Taint Severity', w.taintSeverity);

                // Lethal Persistence Check
                let pRoll = tRoll2D('Taint Persistence');
                let pDM = 0;
                if (sevIdx === 8 || sevIdx === 9) {
                    let hasOxygenTaint = w.taints.includes("Low Oxygen") || w.taints.includes("High Oxygen");
                    if (hasOxygenTaint) {
                        tDM('Lethal L/H Oxygen', 6);
                        pDM = 6;
                    } else {
                        tDM('Lethal Taint', 4);
                        pDM = 4;
                    }
                }
                w.taintPersistence = Math.max(2, pRoll + pDM);
                tResult('Taint Persistence', w.taintPersistence);
            };

            // 4b. Edge Case: Irritant Check
            if (w._atmHazardFlag || w._atmHazardFlag === "Check") {
                tResult('Hazard Flag', 'Irritant/Check Present');
                if (tRoll1D('Irritant Taint Roll') >= 4) {
                    generateAtmosphericTaints();
                }
            } else if ([2, 4, 7, 9].includes(w.atmCode)) {
                generateAtmosphericTaints(); // Legacy standard taint call
            }

            // Advanced Scale Height
            w.scaleHeight = 0;
            if (w.gravity && w.gravity > 0 && w.meanTempK) {
                w.scaleHeight = (8.5 / w.gravity) * (w.meanTempK / 288);
            } else if (w.gravity && w.gravity > 0) {
                w.scaleHeight = (8.5 / w.gravity); // Fallback if meanTempK is not available yet
            }
            tResult('Scale Height (km)', w.scaleHeight.toFixed(2));

            if (w.atmCode === 13) {
                let badRatioO2 = w.oxygenFraction > 0 ? w.ppoBar / 0.5 : 1;
                let badRatioN2 = (w.totalPressureBar - w.ppoBar) / 2.0;
                let badRatio = Math.max(badRatioO2, badRatioN2);
                if (badRatio > 1 && w.scaleHeight > 0) {
                    w.safeAlt = Math.log(badRatio) * w.scaleHeight;
                    tResult('Safe Altitude (km)', w.safeAlt.toFixed(2));

                    // Code D Edge Case
                    let newPressure = w.totalPressureBar / Math.exp(w.safeAlt / w.scaleHeight);
                    let newPpo = w.oxygenFraction * newPressure;
                    if (newPpo < 0.1) {
                        w.noSafeAltitude = true;
                        tResult('No Safe Altitude', 'True');
                        if (tRoll1D('Safe Alt Taint Check') >= 4) {
                            generateAtmosphericTaints();
                        }
                    }
                }
            }
            if (w.atmCode === 14 && w.ppoBar > 0) {
                let badRatio = 0.1 / w.ppoBar;
                if (badRatio > 1 && w.scaleHeight > 0) {
                    w.safeAltBelowMean = Math.log(badRatio) * w.scaleHeight;
                    tResult('Safe Depth (km)', w.safeAltBelowMean.toFixed(2));

                    // Code E Edge Case
                    let newPressure = w.totalPressureBar * Math.exp(w.safeAltBelowMean / w.scaleHeight);
                    let newN2 = (1 - w.oxygenFraction) * newPressure;
                    if (newN2 > 2.0) {
                        w.nitrogenNarcosisDepth = true;
                        tResult('Nitrogen Narcosis', 'True');
                        if (tRoll1D('Narcosis Taint Check') >= 4) {
                            generateAtmosphericTaints();
                        }
                    }
                }
            }

            // Integration & Profile String
            w.atmProfile = `${toUWPChar(w.atmCode)}-${w.totalPressureBar.toFixed(2)}-${w.ppoBar.toFixed(3)}`;
            tResult('Atm Profile', w.atmProfile);

        }
        else if (w.atmCode >= 10 && w.atmCode <= 12) {
            tSection('Exotic Gas Retention');
            let diff = getEffectiveHzcoDeviation(w.orbitId, w.worldHzco || sys.hzco);

            const gasData = [
                { id: "SO2", name: "Sulphur Dioxide", mw: 64, bp: 263 },
                { id: "CO2", name: "Carbon Dioxide", mw: 44, bp: 194 },
                { id: "N2", name: "Nitrogen", mw: 28, bp: 77 },
                { id: "O2", name: "Oxygen", mw: 32, bp: 90 },
                { id: "CH4", name: "Methane", mw: 16, bp: 111 },
                { id: "He", name: "Helium", mw: 4, bp: 4 },
                { id: "H2", name: "Hydrogen", mw: 2, bp: 20 },
                { id: "H2O", name: "Water Vapour", mw: 18, bp: 373 }
            ];

            // Potentially retained list for fallback and context checks
            let potentiallyRetained = gasData.filter(g => w.meanTempK > g.bp && w.maxEscapeValue > (g.mw <= 4 ? 12.0 : 24.0 / g.mw)).map(g => g.name);

            let mix = [];
            if (w.meanTempK >= 453 || diff <= -2.01) {
                tSection('Boiling Atmosphere Mix (453K+)');
                let roll = tRoll2D('Boiling Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -1); dm -= 1; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }
                if (w.meanTempK >= 700 && w.meanTempK <= 2000) { tDM('Temp 700-2000K', -2); dm -= 2; }
                if (w.meanTempK > 2000) { tDM('Temp 2000K+', -5); dm -= 5; }

                let resultRoll = Math.max(-2, Math.min(13, roll + dm));
                const chart1 = {
                    "-2": ["Silicates (SO, SO2)", "Silicates (SO, SO2)", "Metal Vapours"],
                    "-1": ["Sodium", "Sodium", "Silicates (SO, SO2)"],
                    "0": ["Krypton", "Krypton", "Sodium"],
                    "1": ["Argon", "Argon", "Sulphuric Acid"],
                    "2": ["Sulphur Dioxide", "Sulphur Dioxide", "Hydrochloric Acid"],
                    "3": ["Carbon Monoxide", "Hydrogen Cyanide", "Chlorine"],
                    "4": ["Carbon Dioxide", "Formamide", "Fluorine"],
                    "5": ["Nitrogen", "Carbon Dioxide", "Formic Acid"],
                    "6": ["Carbon Dioxide", "Nitrogen", "Water Vapour"],
                    "7": ["Nitrogen", "Carbon Dioxide", "Nitrogen"],
                    "8": ["Water Vapour", "Sulphur Dioxide", "Carbon Dioxide"],
                    "9": ["Sulphur Dioxide", "Water Vapour", "Sulphur Dioxide"],
                    "10": ["Nitrogen", "Nitrogen", "Hydrogen Cyanide"],
                    "11": ["Methane", "Ammonia", "Ammonia"],
                    "12": ["Water Vapour", "Ammonia", "Hydrofluoric Acid"],
                    "13": ["Methane", "Methane", "Methane"]
                };
                let row = chart1[resultRoll.toString()];
                let resGas = row[w.atmCode - 10];
                if (resGas === "Carbon Monoxide" && potentiallyRetained.includes("Water Vapour")) {
                    resGas = "Carbon Dioxide";
                    tResult('CO Constraint', 'Water present -> Carbon Dioxide');
                }
                mix = [resGas];
            } else if (w.meanTempK >= 353 || diff <= -1.01) {
                tSection('Boiling Atmosphere Mix (353-453K)');
                let roll = tRoll2D('Boiling Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -1); dm -= 1; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }

                let resultRoll = Math.max(1, Math.min(13, roll + dm));
                const chart2 = {
                    "1": ["Krypton", "Argon", "Hydrochloric Acid"],
                    "2": ["Argon", "Sulphur Dioxide", "Chlorine"],
                    "3": ["Sulphur Dioxide", "Hydrogen Cyanide", "Fluorine"],
                    "4": ["Ethane", "Ethane", "Formic Acid"],
                    "5": ["Carbon Dioxide", "Carbon Dioxide", "Water Vapour"],
                    "6": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "7": ["Carbon Dioxide", "Carbon Dioxide", "Carbon Dioxide"],
                    "8": ["Nitrogen", "Sulphur Dioxide", "Sulphur Dioxide"],
                    "9": ["Water Vapour", "Water Vapour", "Hydrogen Cyanide"],
                    "10": ["Sulphur Dioxide", "Nitrogen", "Ammonia"],
                    "11": ["Methane", "Ammonia", "Methane"],
                    "12": ["Neon", "Ammonia", "Hydrofluoric Acid"],
                    "13": ["Methane", "Methane", "Methane"]
                };
                let row = chart2[resultRoll.toString()];
                mix = [row[w.atmCode - 10]];
            } else if (w.meanTempK >= 303) {
                tSection('Hot Atmosphere Mix (303-353K)');
                let roll = tRoll2D('Hot Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -1); dm -= 1; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }

                let resultRoll = Math.max(1, Math.min(13, roll + dm));
                const chart3 = {
                    "1": ["Krypton", "Argon", "Hydrochloric Acid"],
                    "2": ["Argon", "Sulphur Dioxide", "Chlorine"],
                    "3": ["Sulphur Dioxide", "Hydrogen Cyanide", "Fluorine"],
                    "4": ["Ethane", "Ethane", "Sulphur Dioxide"],
                    "5": ["Carbon Dioxide", "Carbon Dioxide", "Carbon Monoxide"],
                    "6": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "7": ["Carbon Dioxide", "Carbon Dioxide", "Carbon Dioxide"],
                    "8": ["Nitrogen", "Sulphur Dioxide", "Ethane"],
                    "9": ["Carbon Monoxide", "Carbon Monoxide", "Hydrogen Cyanide"],
                    "10": ["Sulphur Dioxide", "Nitrogen", "Ammonia"],
                    "11": ["Methane", "Ammonia", "Methane"],
                    "12": ["Neon", "Ammonia", "Hydrofluoric Acid"],
                    "13": ["Methane", "Methane", "Helium"]
                };
                let row = chart3[resultRoll.toString()];
                let resGas = row[w.atmCode - 10];
                if (resGas === "Carbon Monoxide" && w.hydroPercent > 0 && w.liquidType === "Water") {
                    resGas = "Carbon Dioxide";
                    tResult('CO Constraint', 'Water present -> Carbon Dioxide');
                }
                mix = [resGas];
            } else if (w.meanTempK >= 273) {
                tSection('Temperate Atmosphere Mix (273-303K)');
                let roll = tRoll2D('Temperate Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -1); dm -= 1; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }

                let resultRoll = Math.max(1, Math.min(13, roll + dm));
                const chart4 = {
                    "1": ["Krypton", "Krypton", "Argon"],
                    "2": ["Argon", "Chlorine", "Chlorine"],
                    "3": ["Sulphur Dioxide", "Argon", "Fluorine"],
                    "4": ["Nitrogen", "Sulphur Dioxide", "Sulphur Dioxide"],
                    "5": ["Carbon Monoxide", "Carbon Monoxide", "Carbon Monoxide"],
                    "6": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "7": ["Carbon Dioxide", "Carbon Dioxide", "Carbon Dioxide"],
                    "8": ["Ethane", "Ethane", "Ethane"],
                    "9": ["Nitrogen", "Ammonia", "Ammonia"],
                    "10": ["Neon", "Ammonia", "Ammonia"],
                    "11": ["Methane", "Methane", "Methane"],
                    "12": ["Methane", "Helium", "Helium"],
                    "13": ["Helium", "Hydrogen", "Hydrogen"]
                };
                let row = chart4[resultRoll.toString()];
                let resGas = row[w.atmCode - 10];
                if (resGas === "Carbon Monoxide" && w.hydroPercent > 0 && w.liquidType === "Water") {
                    resGas = "Carbon Dioxide";
                    tResult('CO Constraint', 'Water present -> Carbon Dioxide');
                }
                mix = [resGas];
            } else if (w.meanTempK >= 223) {
                tSection('Cold Atmosphere Mix (223-273K)');
                let roll = tRoll2D('Cold Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -1); dm -= 1; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }

                let resultRoll = Math.max(1, Math.min(13, roll + dm));
                const chart5 = {
                    "1": ["Krypton", "Krypton", "Argon"],
                    "2": ["Argon", "Chlorine", "Chlorine"],
                    "3": ["Ethane", "Argon", "Fluorine"],
                    "4": ["Nitrogen", "Nitrogen", "Ethane"],
                    "5": ["Carbon Monoxide", "Carbon Monoxide", "Carbon Monoxide"],
                    "6": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "7": ["Carbon Dioxide", "Carbon Dioxide", "Carbon Dioxide"],
                    "8": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "9": ["Ethane", "Ethane", "Ethane"],
                    "10": ["Methane", "Ammonia", "Ammonia"],
                    "11": ["Neon", "Methane", "Methane"],
                    "12": ["Methane", "Helium", "Helium"],
                    "13": ["Helium", "Hydrogen", "Hydrogen"]
                };
                let row = chart5[resultRoll.toString()];
                let resGas = row[w.atmCode - 10];
                if (resGas === "Carbon Monoxide" && w.hydroPercent > 0 && w.liquidType === "Water") {
                    resGas = "Carbon Dioxide";
                    tResult('CO Constraint', 'Water present -> Carbon Dioxide');
                }
                mix = [resGas];
            } else if (w.meanTempK >= 123 || (diff >= 1.01 && diff <= 3.0)) {
                tSection('Frozen Atmosphere Mix (123-223K)');
                let roll = tRoll2D('Frozen Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -2); dm -= 2; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }

                let resultRoll = Math.max(1, Math.min(13, roll + dm));
                const chart6 = {
                    "1": ["Krypton", "Krypton", "Krypton"],
                    "2": ["Argon", "Argon", "Argon"],
                    "3": ["Argon", "Argon", "Fluorine"],
                    "4": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "5": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "6": ["Carbon Monoxide", "Carbon Monoxide", "Carbon Monoxide"],
                    "7": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "8": ["Methane", "Methane", "Methane"],
                    "9": ["Methane", "Methane", "Methane"],
                    "10": ["Methane", "Neon", "Neon"],
                    "11": ["Neon", "Methane", "Helium"],
                    "12": ["Methane", "Helium", "Hydrogen"],
                    "13": ["Helium", "Hydrogen", "Hydrogen"]
                };
                let row = chart6[resultRoll.toString()];
                let resGas = row[w.atmCode - 10];
                if (resGas === "Carbon Monoxide" && w.hydroPercent > 0 && w.liquidType === "Water") {
                    resGas = "Nitrogen";
                    tResult('CO Constraint', 'Water present -> Nitrogen');
                }
                mix = [resGas];
            } else {
                tSection('Deep Frozen Atmosphere Mix (<123K)');
                let roll = tRoll2D('Deep Frozen Mix Roll');
                let dm = 0;
                if (w.size >= 1 && w.size <= 7) { tDM('Size 1-7', -3); dm -= 3; }
                if (w.size >= 10) { tDM('Size A+', 1); dm += 1; }
                if (w.meanTempK >= 70 && w.meanTempK <= 100) { tDM('Temp 70-100K', 3); dm += 3; }
                if (w.meanTempK < 70) { tDM('Temp <70K', 5); dm += 5; }

                let resultRoll = Math.max(1, Math.min(13, roll + dm));
                const chart7 = {
                    "1": ["Krypton", "Krypton", "Krypton"],
                    "2": ["Argon", "Argon", "Argon"],
                    "3": ["Argon", "Argon", "Fluorine"],
                    "4": ["Methane", "Methane", "Methane"],
                    "5": ["Carbon Monoxide", "Carbon Monoxide", "Carbon Monoxide"],
                    "6": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "7": ["Nitrogen", "Nitrogen", "Nitrogen"],
                    "8": ["Neon", "Neon", "Neon"],
                    "9": ["Helium", "Helium", "Helium"],
                    "10": ["Helium", "Helium", "Helium"],
                    "11": ["Hydrogen", "Hydrogen", "Hydrogen"],
                    "12": ["Hydrogen", "Hydrogen", "Hydrogen"],
                    "13": ["Hydrogen", "Hydrogen", "Hydrogen"]
                };
                let row = chart7[resultRoll.toString()];
                let resGas = row[w.atmCode - 10];
                if (resGas === "Carbon Monoxide" && w.hydroPercent > 0 && w.liquidType === "Water") {
                    resGas = "Nitrogen";
                    tResult('CO Constraint', 'Water present -> Nitrogen');
                }
                mix = [resGas];
            }

            if (mix.length === 0) {
                if (w.maxEscapeValue > 0.2) mix = ["Heavy Gases"];
                else mix = ["Trace Gases"];
            }

            w.gases = mix;
            tResult('Gas Mix', w.gases.join(', '));

            w.atmProfile = `${toUWPChar(w.atmCode)}-${w.totalPressureBar.toFixed(2)}-0.000`;
            tResult('Atm Profile', w.atmProfile);
        } else if (w.atmCode === 15) {
            tSection('Unusual Atmosphere (Code F)');

            // D26 Roll (Tens 1-2, Ones 1-6)
            let tens = tRoll1D('First Die (1-2)');
            tens = (tens <= 3) ? 1 : 2; // Split 1-3 -> 1, 4-6 -> 2 to simulate D2
            let ones = tRoll1D('Second Die (1-6)');
            let d26 = (tens * 10) + ones;

            let subtypeName = "Unusual";
            let subtypeCode = "F";

            switch (d26) {
                case 11: subtypeName = "Dense, Extreme"; subtypeCode = "1"; break;
                case 12: subtypeName = "Dense, Very Extreme"; subtypeCode = "2"; break;
                case 13: subtypeName = "Dense, Crushing"; subtypeCode = "3"; break;
                case 14: subtypeName = "Ellipsoid"; subtypeCode = "4"; break;
                case 15: subtypeName = "High Radiation"; subtypeCode = "5"; break;
                case 16: subtypeName = "Layered"; subtypeCode = "6"; break;
                case 21: subtypeName = "Panthalassic"; subtypeCode = "7"; break;
                case 22: subtypeName = "Steam"; subtypeCode = "8"; break;
                case 23: subtypeName = "Variable Pressure"; subtypeCode = "9"; break;
                case 24: subtypeName = "Variable Composition"; subtypeCode = "A"; break;
                case 25: subtypeName = "Combination"; subtypeCode = "-"; break;
                case 26: subtypeName = "Other"; subtypeCode = "F"; break;
            }

            tResult('Unusual Subtype', `${d26} - ${subtypeName}`);

            // Enforce Prerequisites programmatically
            if (subtypeCode === "1") {
                if (w.totalPressureBar < 10) {
                    w.totalPressureBar = 10 + (rng() * 90);
                    tResult('Constraint', 'Dense Extreme forces pressure 10-100 bar');
                }
            } else if (subtypeCode === "2") {
                if (w.totalPressureBar < 100) {
                    w.totalPressureBar = 100 + (rng() * 900);
                    tResult('Constraint', 'Dense Very Extreme forces pressure 100-1000 bar');
                }
            } else if (subtypeCode === "3") {
                if (w.totalPressureBar < 1000) {
                    w.totalPressureBar = 1000 + (rng() * 2000);
                    tResult('Constraint', 'Dense Crushing forces pressure 1000+ bar');
                }
            } else if (subtypeCode === "6") {
                if (w.gravity <= 1.2) {
                    w.gravity = 1.21 + (rng() * 0.5);
                    tResult('Constraint', 'Layered forces Gravity > 1.2');
                }
            } else if (subtypeCode === "7") {
                w.hydroCode = 10;
                tResult('Constraint', 'Panthalassic forces Hydro 10');
                if (w.totalPressureBar < 1.0) {
                    w.totalPressureBar = 1.1 + (rng() * 2.0);
                    tResult('Constraint', 'Panthalassic forces Pressure 1.0+');
                }
            } else if (subtypeCode === "8") {
                if (w.hydroCode < 5) {
                    w.hydroCode = 5 + Math.floor(rng() * 5);
                    tResult('Constraint', 'Steam forces Hydro 5+');
                }
                if (w.totalPressureBar < 2.5) {
                    w.totalPressureBar = 2.5 + (rng() * 5.0);
                    tResult('Constraint', 'Steam forces Pressure 2.5+ bar');
                }
            }

            w.pressureBar = w.totalPressureBar;
            w.atmProfile = `F-St${subtypeCode}`;
            tResult('Atm Profile', w.atmProfile);
        } else if (w.atmCode <= 1) {
            w.atmProfile = `${toUWPChar(w.atmCode)}-None-0.000`;
            tResult('Atm Profile', w.atmProfile);
        }

        // 6. Hydrographics
        tSection('Hydrographics');
        w.hydroCode = 0;
        if (w.type === 'Mainworld' && mainworldBase && mainworldBase.hydro !== undefined) {
            tSkip('Mainworld Hydro Inherited');
            w.hydroCode = mainworldBase.hydro;
        } else if (!['S', 0, 1].includes(w.size)) {
            let hMod = 0;
            if ([0, 1, 10, 11, 12, 15].includes(w.atmCode)) { tDM('Desert Atm', -4); hMod -= 4; }
            if (tempBand === "Hot" && w.atmCode !== 13) { tDM('Hot', -2); hMod -= 2; }
            if (tempBand === "Boiling" && w.atmCode !== 13) { tDM('Boiling', -6); hMod -= 6; }

            w.hydroCode = Math.max(0, Math.min(10, tRoll2D('Hydro Roll') - 7 + w.atmCode + hMod));
            tDM('Atm Mod', w.atmCode);
        }

        w.hydroPercent = MGT2E_HYDRO_RANGES[w.hydroCode] + Math.floor(rng() * 10);
        if (w.hydroCode === 0) w.hydroPercent = Math.floor(rng() * 6);
        tResult('Final Hydro Code', toEHex(w.hydroCode));
        tResult('Hydro Percentage', w.hydroPercent + '%');

        let distRoll = Math.max(0, Math.min(10, tRoll2D('Surface Liquid Distribution (2D-2)') - 2));
        w.surfaceDist = MGT2E_SURFACE_DISTS[distRoll];
        w.liquidType = "Water";

        if (w.atmCode >= 10 && w.atmCode <= 12 && w.hydroPercent > 0) {
            if (tempBand === "Boiling" || tempBand === "Hot") w.liquidType = "Sulphuric Acid";
            if (tempBand === "Cold" || tempBand === "Frozen") w.liquidType = "Methane";
        }
        w.tempBand = tempBand;
        tResult('Surface Distribution', w.surfaceDist);
        tResult('Liquid Type', w.liquidType);
    };

    for (let i = 0; i < sys.worlds.length; i++) {
        let w = sys.worlds[i];

        // 2. Implement Physics Guards (Size 0 and Size R)
        if (w.size === 0 || w.size === 'R' || w.type === 'Empty') {
            w.gravity = 0;
            w.mass = 0;
            w.escapeVel = 0;
            w.orbitalVelSurface = 0;
            continue;
        }

        // 1. Tighten Floating-Point Precision
        if (typeof w.size === 'number' && w.size > 0 && w.mass !== undefined) {
            w.escapeVel = Math.sqrt(w.mass / (w.size / 8)) * 11186;
            w.orbitalVelSurface = w.escapeVel / Math.sqrt(2);
        }

        processWorld(w);

        for (let j = 0; j < w.moons.length; j++) {
            let m = w.moons[j];

            // Apply guards and calibration to moons as well
            if (m.size === 0 || m.size === 'R' || m.type === 'Empty') {
                m.gravity = 0;
                m.mass = 0;
                m.escapeVel = 0;
                m.orbitalVelSurface = 0;
                continue;
            }

            if (typeof m.size === 'number' && m.size > 0 && m.mass !== undefined) {
                m.escapeVel = Math.sqrt(m.mass / (m.size / 8)) * 11186;
                m.orbitalVelSurface = m.escapeVel / Math.sqrt(2);
            }

            let fauxMoon = Object.assign({}, m);
            fauxMoon.orbitId = w.orbitId;
            fauxMoon.worldHzco = w.worldHzco;
            fauxMoon.type = 'Terrestrial Planet';
            // Recursively process moon as a terrestrial body
            processWorld(fauxMoon);

            // Sync processed data back to moon record
            sys.worlds[i].moons[j] = fauxMoon;
        }
    }

    return sys;
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 2: ORBIT ALLOCATION WITH FORBIDDEN ZONES
// =====================================================================

function generateMgT2ESystemChunk2(sys, mainworldBase) {
    sys.worlds = [];
    let primary = sys.stars[0];
    tSection('Orbital Allocation');

    // Helper table for HZ deviation
    const MGT2E_HZ_DEVIATION = {
        2: 1.1, 3: 1.0, 4: 0.5, 5: 0.2, 6: 0.1,
        7: 0.0, 8: -0.1, 9: -0.2, 10: -0.5, 11: -1.0, 12: -1.1
    };

    // =====================================================================
    // Baseline / HZ orbit
    // =====================================================================
    tSection('HZ Baseline');
    let totalWorldsToPlace = sys.gasGiants + sys.planetoidBelts + sys.terrestrialPlanets + 1;
    let blRoll = tRoll2D('Baseline Orbit Roll');
    let secondaryStars = sys.stars.filter(s => s.role !== 'Primary' && s.separation !== 'Companion');
    let secondaryDM = -(secondaryStars.length);
    blRoll += secondaryDM;
    tDM('Secondary Stars (Count)', secondaryDM);

    let primaryHasCompanion = sys.stars.some(s => s.parentStarIdx === 0 && s.separation === 'Companion');
    if (primaryHasCompanion) {
        blRoll -= 2;
        tDM('Primary Companion', -2);
    }

    if (['Ia', 'Ib', 'II'].includes(primary.sClass)) { tDM('Giant/Supergiant', 3); blRoll += 3; }
    else if (primary.sClass === 'III') { tDM('Giant', 2); blRoll += 2; }
    else if (primary.sClass === 'IV') { tDM('Subgiant', 1); blRoll += 1; }
    else if (primary.sClass === 'VI') { tDM('Subdwarf', -1); blRoll -= 1; }

    if (primary.sType === 'D' || primary.sClass === 'D') {
        blRoll -= 2;
        tDM('Post-Stellar Primary', -2);
    }

    if (totalWorldsToPlace < 6) { tDM('Few Worlds', -4); blRoll -= 4; }
    else if (totalWorldsToPlace <= 9) { tDM('Size 6-9 Worlds', -3); blRoll -= 3; }
    else if (totalWorldsToPlace <= 12) { tDM('Size 10-12 Worlds', -2); blRoll -= 2; }
    else if (totalWorldsToPlace <= 15) { tDM('Size 13-15 Worlds', -1); blRoll -= 1; }
    else if (totalWorldsToPlace >= 18 && totalWorldsToPlace <= 20) { tDM('Size 18-20 Worlds', 1); blRoll += 1; }
    else if (totalWorldsToPlace > 20) { tDM('Many Worlds', 2); blRoll += 2; }

    let mwAtm = mainworldBase ? mainworldBase.atm : 0;
    let atmDM = 0;
    if ([2, 3].includes(mwAtm)) atmDM = -2;
    else if ([4, 5, 14].includes(mwAtm)) atmDM = -1;
    else if ([8, 9].includes(mwAtm)) atmDM = 1;
    else if ([10, 13, 15].includes(mwAtm)) atmDM = 2;
    else if ([11, 12].includes(mwAtm)) atmDM = 6;
    tDM(`Atm ${toUWPChar(mwAtm)} Target DM`, -atmDM);

    let rawHzRoll = Math.max(2, Math.min(12, 7 - atmDM));
    let hzDeviation = MGT2E_HZ_DEVIATION[rawHzRoll];
    tResult('HZ Deviation Target', hzDeviation);

    let variance = (Math.floor(rng() * 10)) / 100;
    if (hzDeviation < 0) hzDeviation -= variance;
    else if (hzDeviation > 0) hzDeviation += variance;
    else hzDeviation += (rng() < 0.5 ? 1 : -1) * variance;
    tResult('Final HZ Deviation', hzDeviation.toFixed(2));

    // Step 3: Phase 5 - Calculate Mainworld Orbit# (Baseline Orbit#)
    let baselineOrbit;

    if (sys.hzco >= 1.0 && (sys.hzco + hzDeviation) >= 1.0) {
        // Condition A: Standard Outer Orbits
        baselineOrbit = sys.hzco + hzDeviation;
    }
    else if (sys.hzco < 1.0 && hzDeviation > 0) {
        // Condition B: Inner Orbits, Positive Deviation (Cold)
        baselineOrbit = sys.hzco * (1 + hzDeviation);
    }
    else if (sys.hzco < 1.0 && hzDeviation < 0) {
        // Condition C: Inner Orbits, Negative Deviation (Hot)
        baselineOrbit = sys.hzco / (1 - hzDeviation);
    }
    else {
        // Fallback for HZCO < 1.0 and Deviation 0, or edge transitions
        baselineOrbit = sys.hzco + hzDeviation;
    }

    tResult('Calculated Baseline Orbit', baselineOrbit.toFixed(2));
    sys.baselineOrbit = baselineOrbit;

    let eRoll = tRoll2D('Empty Orbits Roll (10+)');
    let emptyOrbitsCount = (eRoll <= 9) ? 0 : (eRoll - 9);
    if (emptyOrbitsCount > 0) tResult('Empty Orbits to Place', emptyOrbitsCount);

    // =====================================================================
    // Part 2A: Forbidden Zone Calculation
    // =====================================================================
    tSection('Forbidden Zones');
    let mergedFZ = [];
    let primaryMao = getMAO(primary.sType, primary.subType, primary.sClass);
    let primaryInnerLimit = primaryMao;

    let directCompanions = sys.stars.filter(s => s.parentStarIdx === 0 && s.separation !== 'Companion');
    directCompanions.sort((a, b) => a.orbitId - b.orbitId);

    if (directCompanions.length > 0) {
        let dc = directCompanions[0];
        let innerPush = 0.50 + (dc.eccentricity || 0);
        if (primaryMao > 0.2) innerPush += primaryMao;
        primaryInnerLimit = Math.max(primaryInnerLimit, innerPush);
        tResult('Primary Inner Stability Limit', primaryInnerLimit.toFixed(2));
    }

    let rawFZ = [];
    for (let comp of directCompanions) {
        let reasons = [];
        let co = comp.orbitId;
        let cm = comp.mao || 0;
        let ce = comp.eccentricity || 0;
        let isInner = (comp.separation === 'Close' || comp.separation === 'Near');

        let fmin = co - 1.00, fmax = co + 1.00;
        reasons.push(`Base exclusion \u00b11.00 (\u2192 ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`);

        if (cm > 0.2) {
            fmin -= cm; fmax += cm;
            reasons.push(`High MAO (${cm.toFixed(2)} > 0.2) expands by \u00b1${cm.toFixed(2)} (\u2192 ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`);
        }
        if (ce > 0.2) {
            fmin -= 1.00; fmax += 1.00;
            reasons.push(`High Ecc (${ce.toFixed(2)} > 0.2) expands by \u00b11.00 (\u2192 ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`);
        }
        if (isInner && ce > 0.5) {
            fmin -= 1.00; fmax += 1.00;
            reasons.push(`Extreme Ecc (${ce.toFixed(2)} > 0.5) on Inner Orbit expands by \u00b11.00 (\u2192 ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`);
        }
        rawFZ.push({ min: fmin, max: fmax });

        writeLogLine(`  Exclusion Zone for ${comp.name} at Orbit ${co.toFixed(2)}:`);
        for (let reason of reasons) writeLogLine(`    - ${reason}`);
        tResult(`    Final FZ`, `${fmin.toFixed(2)} - ${fmax.toFixed(2)}`);
    }
    rawFZ.sort((a, b) => a.min - b.min);
    for (let fz of rawFZ) {
        if (mergedFZ.length === 0 || fz.min > mergedFZ[mergedFZ.length - 1].max) {
            mergedFZ.push({ ...fz });
        } else {
            mergedFZ[mergedFZ.length - 1].max = Math.max(mergedFZ[mergedFZ.length - 1].max, fz.max);
        }
    }
    sys.forbiddenZones = mergedFZ;

    // =====================================================================
    // Part 2B: Valid Band Calculation
    // =====================================================================
    function calcBands(inner, outer, fzList) {
        let bands = [{ min: inner, max: outer }];
        for (let fz of fzList) {
            let nb = [];
            for (let b of bands) {
                if (fz.max <= b.min || fz.min >= b.max) { nb.push(b); continue; }
                if (fz.min > b.min) nb.push({ min: b.min, max: fz.min });
                if (fz.max < b.max) nb.push({ min: fz.max, max: b.max });
            }
            bands = nb;
        }
        return bands.filter(b => b.max - b.min > 0.01);
    }
    function bw(bands) { return bands.reduce((s, b) => s + b.max - b.min, 0); }

    let primaryBands = calcBands(primaryInnerLimit, 20.0, mergedFZ);
    primaryBands.forEach((b, idx) => tResult(`Primary Band ${idx + 1}`, `${b.min.toFixed(2)} - ${b.max.toFixed(2)}`));

    let primaryTotalOrbits = Math.max(0, Math.floor(bw(primaryBands) + (directCompanions.length === 0 ? 1 : 0)));

    const sepOrder = ['Close', 'Near', 'Far'];
    let secondaryMeta = [];
    for (let si = 1; si < sys.stars.length; si++) {
        let s = sys.stars[si];
        if (s.separation === 'Companion') continue;

        let logLines = [];
        logLines.push(`  Calculating valid bounds for ${s.name}:`);

        let sInner = s.mao || 0.01;
        logLines.push(`    - Base Inner Limit (MAO): ${sInner.toFixed(2)}`);

        let sTight = sys.stars.find(sc => sc.parentStarIdx === si && sc.separation === 'Companion');
        if (sTight) {
            let tightPush = 0.50 + (sTight.eccentricity || 0);
            if (tightPush > sInner) {
                sInner = tightPush;
                logLines.push(`    - Inner Limit extended by Tight Companion (${sTight.name}) Ecc: ${sInner.toFixed(2)}`);
            }
        }

        let sOuter = (s.orbitId || 0) - 3.00;
        logLines.push(`    - Base Outer Limit (Own Orbit - 3): ${sOuter.toFixed(2)}`);

        let sIdx = sepOrder.indexOf(s.separation);
        for (let aj = 1; aj < sys.stars.length; aj++) {
            if (aj === si) continue;
            let ot = sys.stars[aj];
            if (ot.separation === 'Companion') continue;
            let oi = sepOrder.indexOf(ot.separation);
            if (Math.abs(sIdx - oi) === 1) {
                sOuter -= 1.00;
                logLines.push(`    - Outer Limit reduced by adjacent star (${ot.name}): -1.00 (\u2192 ${sOuter.toFixed(2)})`);
                if ((ot.eccentricity || 0) > 0.2) {
                    sOuter -= 1.00;
                    logLines.push(`    - Outer Limit reduced further by ${ot.name}'s high Ecc (${(ot.eccentricity || 0).toFixed(2)}): -1.00 (\u2192 ${sOuter.toFixed(2)})`);
                }
            }
        }

        let sEcc = s.eccentricity || 0;
        if (sEcc > 0.2) {
            sOuter -= 1.00;
            logLines.push(`    - Outer Limit reduced by own high Ecc (${sEcc.toFixed(2)} > 0.2): -1.00 (\u2192 ${sOuter.toFixed(2)})`);
        }
        if (sEcc > 0.5) {
            sOuter -= 1.00;
            logLines.push(`    - Outer Limit reduced by own extreme Ecc (${sEcc.toFixed(2)} > 0.5): -1.00 (\u2192 ${sOuter.toFixed(2)})`);
        }

        for (let l of logLines) writeLogLine(l);

        if (sOuter <= sInner) {
            writeLogLine(`    --> FAILED: Outer Limit (${sOuter.toFixed(2)}) <= Inner Limit (${sInner.toFixed(2)}). Orbits unavailable.`);
            continue;
        }

        let sBands = [{ min: sInner, max: sOuter }];
        let sTotalOrbits = Math.max(0, Math.floor(bw(sBands) + 1));
        secondaryMeta.push({ starIdx: si, star: s, bands: sBands, totalOrbits: sTotalOrbits });
        tResult(`    Valid Bands for ${s.name}`, `${sInner.toFixed(2)} - ${sOuter.toFixed(2)} (${sTotalOrbits} slots)`);
    }

    // Step 4: Distribute the emptyOrbitsCount globally
    let emptyDistribution = new Array(sys.stars.length).fill(0);
    const priorities = ['Close', 'Near', 'Far', 'Primary'];
    let tempEmpty = emptyOrbitsCount;
    while (tempEmpty > 0) {
        let assignedInPass = false;
        for (let pRole of priorities) {
            for (let si = 0; si < sys.stars.length; si++) {
                if (sys.stars[si].role === pRole && tempEmpty > 0) {
                    emptyDistribution[si]++;
                    tempEmpty--;
                    assignedInPass = true;
                }
            }
            if (tempEmpty <= 0) break;
        }
        if (!assignedInPass) {
            emptyDistribution[0] += tempEmpty;
            tempEmpty = 0;
        }
    }

    // =====================================================================
    // Part 2C: World Distribution
    // =====================================================================
    tSection('World Distribution');
    let systemTotalOrbits = Math.max(1, primaryTotalOrbits + secondaryMeta.reduce((s, m) => s + m.totalOrbits, 0));
    let worldsToDistribute = sys.totalWorlds;
    let primaryAssigned = Math.ceil(worldsToDistribute * (primaryTotalOrbits / systemTotalOrbits));
    let distributed = [{
        starIdx: 0,
        bands: primaryBands,
        mao: primaryInnerLimit,
        assigned: primaryAssigned,
        numEmpty: emptyDistribution[0],
        isMainStar: true
    }];
    tResult('Primary assigned', primaryAssigned);
    tResult('Primary empty', emptyDistribution[0]);
    let remaining = worldsToDistribute - primaryAssigned;
    for (let mi = 0; mi < secondaryMeta.length; mi++) {
        let meta = secondaryMeta[mi];
        let assignedCount = mi === secondaryMeta.length - 1 ? remaining :
            Math.floor(worldsToDistribute * (meta.totalOrbits / systemTotalOrbits));
        remaining -= assignedCount;
        distributed.push({
            starIdx: meta.starIdx,
            bands: meta.bands,
            mao: meta.star.mao || 0.01,
            assigned: Math.max(0, assignedCount),
            numEmpty: emptyDistribution[meta.starIdx],
            isMainStar: false
        });
        tResult(`${meta.star.name} assigned`, Math.max(0, assignedCount));
        tResult(`${meta.star.name} empty`, emptyDistribution[meta.starIdx]);
    }

    // =====================================================================
    // Part 2D: Slot Generation (forbidden-zone aware)
    // =====================================================================
    function genSlots(bands, maoInner, numSlots, fzList, label, isMainStar, blNumber, blOrbit) {
        if (!bands.length) return [];
        let targetIdx = Math.round(blNumber) - 1; // 0-indexed position

        // Step 5: Calculate spread
        let spread = (blOrbit - maoInner) / Math.max(1, blNumber);
        if (spread <= 0) spread = 0.5;
        if (isMainStar) sys.primarySpread = spread;

        let slots = [];
        let count = Math.max(numSlots, isMainStar ? targetIdx + 1 : 0);

        // Step 6: Loop for assigned worlds
        for (let i = 0; i < count; i++) {
            let varianceRoll = tRoll2D(`${label} Slot ${i + 1} Step`);
            let variance = (varianceRoll - 7) * 0.1 * spread;
            let currentOrbit = (i === 0) ? (maoInner + spread + variance) : (slots[i - 1].orbit + spread + variance);

            // Exclusion Jumps: Add the width of the zone to 'jump' it
            for (let fz of fzList) {
                if (currentOrbit >= fz.min && currentOrbit <= fz.max) {
                    currentOrbit += (fz.max - fz.min);
                }
            }

            // Step 6 Override: Force baselineOrbit at baselineNumber
            if (isMainStar && i === targetIdx) {
                currentOrbit = blOrbit;
            }

            slots.push({ orbit: currentOrbit, occupant: null, isMainworld: (isMainStar && i === targetIdx) });
        }
        return slots;
    }

    // =====================================================================
    // Part 2E: Place & Tag Worlds (Global Placement Sequence - Step 8)
    // =====================================================================
    tSection('Placement');

    let ptypeInnerLimit = Infinity;
    if (directCompanions.length > 0) {
        let outerComp = directCompanions[directCompanions.length - 1]; // outermost
        ptypeInnerLimit = outerComp.orbitId + 0.50 + (outerComp.eccentricity || 0)
            + (primaryMao > 0.2 ? primaryMao : 0);
    }
    sys.ptypeInnerLimit = ptypeInnerLimit;
    tResult('P-type Inner Limit', ptypeInnerLimit.toFixed(2));

    function getOrbitType(orbitNum, starIdx) {
        if (starIdx !== 0) return 'S-Type';
        return orbitNum >= ptypeInnerLimit ? 'P-Type' : 'S-Type';
    }

    // 1. Generate ALL SLOTS across system
    let allSystemSlots = [];
    for (let de of distributed) {
        let { starIdx, mao: starMao, assigned, numEmpty, isMainStar } = de;
        let sName = sys.stars[starIdx].name;
        let starSlots = genSlots(de.bands, starMao, assigned + numEmpty, starIdx === 0 ? mergedFZ : [], sName, isMainStar, blRoll, baselineOrbit);
        for (let sObj of starSlots) {
            allSystemSlots.push({
                orbitId: sObj.orbit,
                starIdx: starIdx,
                isMainworldPlaceholder: sObj.isMainworld,
                occupant: null
            });
        }
    }
    allSystemSlots.sort((a, b) => a.orbitId - b.orbitId);

    // 2. Prepare Worlds Placement Order
    let worldsQueue = [];
    // Strict Order: 1. Mainworld, 2. Empty Orbits, 3. Gas Giants, 4. Planetoid Belts, 5. Terrestrial Planets.

    // a. Mainworld
    worldsQueue.push({ type: 'Mainworld', isAsteroid: !!(mainworldBase && mainworldBase.size === 0), moons: [] });

    // b. Empty Orbits
    for (let i = 0; i < emptyOrbitsCount; i++) worldsQueue.push({ type: 'Empty', moons: [] });

    // c. Gas Giants
    for (let i = 0; i < sys.gasGiants; i++) worldsQueue.push({ type: 'Gas Giant', moons: [] });

    // d. Planetoid Belts (ensuring we don't double-count mainworld if it's a belt)
    let mwIsBelt = (mainworldBase && mainworldBase.size === 0);
    let pbCount = mwIsBelt ? Math.max(0, sys.planetoidBelts - 1) : sys.planetoidBelts;
    for (let i = 0; i < pbCount; i++) worldsQueue.push({ type: 'Planetoid Belt', isAsteroid: true, moons: [] });

    // e. Terrestrial Planets
    let mwIsTP = !mwIsBelt;
    let tpCount = mwIsTP ? Math.max(0, sys.terrestrialPlanets - 1) : sys.terrestrialPlanets;
    for (let i = 0; i < tpCount; i++) worldsQueue.push({ type: 'Terrestrial Planet', moons: [] });

    // 3. Placing Loop
    let placedWorlds = [];

    for (let wInfo of worldsQueue) {
        let slotIndex = -1;

        if (wInfo.type === 'Mainworld') {
            slotIndex = allSystemSlots.findIndex(s => s.isMainworldPlaceholder);
            if (slotIndex === -1 && allSystemSlots.length > 0) slotIndex = 0; // fallback
        } else {
            // Pick a random slot
            let availableIndices = allSystemSlots.map((s, idx) => s.occupant === null ? idx : -1).filter(idx => idx !== -1);
            if (availableIndices.length > 0) {
                // Check if we already have a preferred distribution from 'distributed' 
                // but Step 8 is global. I'll pick from uniform random indices.
                slotIndex = availableIndices[Math.floor(rng() * availableIndices.length)];
            } else {
                continue;
            }
        }

        let slot = allSystemSlots[slotIndex];
        let collision = slot.occupant;

        if (collision) {
            // Capture Rule: Gas Giant captures Mainworld
            if (wInfo.type === 'Gas Giant' && collision.type === 'Mainworld') {
                collision.isMoon = true;
                collision.parentBody = wInfo;
                wInfo.moons.push(collision);
                // Gas Giant occupies the slot
                wInfo.orbitId = slot.orbitId;
                wInfo.parentStarIdx = slot.starIdx;
                wInfo.orbitType = getOrbitType(wInfo.orbitId, wInfo.parentStarIdx);
                slot.occupant = wInfo;
                placedWorlds.push(wInfo);
                writeLogLine(`  Capture! Mainworld becomes moon of Gas Giant at orbit ${slot.orbitId.toFixed(2)}`);
                continue;
            } else {
                // Move Outward: Find next free slot outward, looping back to the innermost slot if necessary
                let nextIdx = -1;
                for (let j = 1; j < allSystemSlots.length; j++) {
                    let checkIdx = (slotIndex + j) % allSystemSlots.length;
                    if (allSystemSlots[checkIdx].occupant === null) {
                        nextIdx = checkIdx;
                        break;
                    }
                }
                if (nextIdx !== -1) {
                    slotIndex = nextIdx;
                    slot = allSystemSlots[slotIndex];
                } else {
                    continue;
                }
            }
        }

        // Place the body
        let w = {
            ...wInfo,
            orbitId: slot.orbitId,
            parentStarIdx: slot.starIdx,
            orbitType: getOrbitType(slot.orbitId, slot.starIdx)
        };
        slot.occupant = w;

        if (w.type === 'Planetoid Belt') {
            // Apply the detailed belt generation
            generateMgT2EBeltProfile(w, sys, mainworldBase);
        }

        placedWorlds.push(w);
        if (w.type === 'Mainworld') tResult('Placed Mainworld', w.orbitId.toFixed(2));
    }

    // Filter out worlds that became moons from the top-level sys.worlds list
    sys.worlds = placedWorlds.filter(b => !b.isMoon);

    // Sort final world list
    sys.worlds.sort((a, b) => a.orbitId - b.orbitId);

    // =====================================================================
    // Part 2F: Eccentricities, AU, Orbital Period
    // =====================================================================
    for (let w of sys.worlds) {
        if (w.type === 'Empty') continue;

        let baseEcc = determineMgT2EEccentricity(false, 0, sys.age, w.orbitId, w.isAsteroid || false, w.orbitType === 'P-Type');
        w.eccentricity = baseEcc;

        // Convert orbit number to AU
        let auInt = Math.floor(w.orbitId);
        let auFrac = w.orbitId - auInt;
        let maxIdx = MGT2E_ORBIT_AU.length - 1;
        let limitIdx = Math.min(auInt, maxIdx);
        let auTarget = MGT2E_ORBIT_AU[limitIdx];
        let auDiff = limitIdx < maxIdx ? (MGT2E_ORBIT_AU[limitIdx + 1] - MGT2E_ORBIT_AU[limitIdx]) : auTarget;
        w.au = auTarget + (auFrac * auDiff);

        // --- Scenario 2 & 3 Compliance (Initial Pass) ---
        let Sum_M = 0;
        if (w.orbitType === 'P-Type') {
            // Sum all stars interior to this P-type orbit
            Sum_M = sys.stars.reduce((sum, s) => {
                let sOrbit = (s.orbitId !== null && s.orbitId !== undefined) ? s.orbitId : 0;
                return sOrbit < w.orbitId ? sum + s.mass : sum;
            }, 0);
        } else {
            // Single star mass (Scenario 1)
            let pIdx = (w.parentStarIdx !== undefined) ? w.parentStarIdx : 0;
            Sum_M = (sys.stars[pIdx] || sys.stars[0]).mass;
        }

        // Factor in planet mass for precision (Scenario 3)
        let planetSolarMass = (w.mass || 0) * 0.000003;

        // Final Calculation
        w.periodYears = Math.sqrt(Math.pow(w.au, 3) / (Sum_M + planetSolarMass));

        // --- Standard Multipliers for internal engine use ---
        w.periodDays = w.periodYears * 365.25;
        w.periodHours = w.periodYears * 8766;
        // -------------------------------------

        // --- Dynamic HZCO Calculation ---
        if (w.orbitType === 'P-Type') {
            let totalLum = 0;
            for (let i = 0; i < sys.stars.length; i++) {
                let s = sys.stars[i];
                let sOrbitId = s.orbitId !== undefined && s.orbitId !== null ? s.orbitId : 0;
                if (sOrbitId < w.orbitId) {
                    totalLum += (s.lum || 0);
                }
            }
            w.worldHzco = convertAuToOrbit(Math.sqrt(totalLum));
        } else {
            let pIdx = (w.parentStarIdx !== undefined) ? w.parentStarIdx : 0;
            let parentStar = sys.stars[pIdx] || sys.stars[0];
            w.worldHzco = convertAuToOrbit(Math.sqrt(parentStar.lum || 0));
        }
    }

    runStellarAudit(sys);

    return sys;
}
