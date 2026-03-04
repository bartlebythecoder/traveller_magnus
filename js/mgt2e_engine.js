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
    return roll1D() + roll1D() + roll1D() + roll1D();
}

// =====================================================================
// MGT2E MAINWORLD GENERATION
// =====================================================================

function generateMgT2EMainworld(hexId) {
    startTrace(hexId || '??', 'MgT2E');
    const tracing = genTraceCount < MAX_GEN_TRACES || activeTrace !== null;

    // ── Size ──────────────────────────────────────────────────────
    tSection('SIZE');
    let sRaw = tracing ? tRoll2D('Raw') : roll2D();
    let size = Math.max(0, sRaw - 2);
    tResult('Size', `${sRaw} − 2 = ${size}`);

    // ── Atmosphere ────────────────────────────────────────────────
    tSection('ATMOSPHERE');
    let atmRaw = tracing ? tRoll2D('Raw') : roll2D();
    let atm = size > 0 ? Math.max(0, atmRaw - 7 + size) : 0;
    if (size > 0) {
        tDM('Size', size);
        tResult('Atm', `${atmRaw} − 7 + ${size} = ${atmRaw - 7 + size} → clamped = ${atm}`);
    } else {
        tSkip('size = 0, atmosphere = 0');
    }

    // ── Hydrographics ─────────────────────────────────────────────
    tSection('HYDROGRAPHICS');
    let hydro = 0;
    if (size > 1) {
        let hydroDM = 0;
        if (atm <= 1 || atm >= 10) { hydroDM = -4; tDM('Atm ≤1 or ≥10', -4); }
        let hydroRaw = tracing ? tRoll2D('Raw') : roll2D();
        hydro = Math.max(0, hydroRaw - 7 + atm + hydroDM);
        tResult('Hydro', `${hydroRaw} − 7 + Atm(${atm}) + DM(${hydroDM}) = ${hydroRaw - 7 + atm + hydroDM} → clamped = ${hydro}`);
    } else {
        tSkip('size ≤ 1, hydrographics = 0');
    }

    // ── Population ────────────────────────────────────────────────
    tSection('POPULATION');
    let popRaw = tracing ? tRoll2D('Raw') : roll2D();
    let pop = Math.max(0, popRaw - 2);
    tResult('Pop', `${popRaw} − 2 = ${pop}`);

    // ── Starport ──────────────────────────────────────────────────
    tSection('STARPORT');
    let starportDM = 0;
    if (pop >= 10) { starportDM = 2; tDM('Pop ≥10', 2); }
    else if (pop === 8 || pop === 9) { starportDM = 1; tDM('Pop 8–9', 1); }
    else if (pop === 3 || pop === 4) { starportDM = -1; tDM('Pop 3–4', -1); }
    else if (pop <= 2) { starportDM = -2; tDM('Pop ≤2', -2); }
    let spRaw = tracing ? tRoll2D('Raw') : roll2D();
    let spTotal = spRaw + starportDM;
    let starport = spTotal <= 2 ? 'X' : spTotal <= 4 ? 'E' : spTotal <= 6 ? 'D'
        : spTotal <= 8 ? 'C' : spTotal <= 10 ? 'B' : 'A';
    tResult('Starport', `${spRaw} + DM(${starportDM}) = ${spTotal}  →  ${starport}`);

    // ── Government & Law ──────────────────────────────────────────
    let gov = 0, law = 0, tl = 0;
    if (pop > 0) {
        tSection('GOVERNMENT');
        let govRaw = tracing ? tRoll2D('Raw') : roll2D();
        gov = Math.max(0, govRaw - 7 + pop);
        tDM('Pop', pop);
        tResult('Gov', `${govRaw} − 7 + ${pop} = ${govRaw - 7 + pop} → clamped = ${gov}`);

        tSection('LAW LEVEL');
        let lawRaw = tracing ? tRoll2D('Raw') : roll2D();
        law = Math.max(0, lawRaw - 7 + gov);
        tDM('Gov', gov);
        tResult('Law', `${lawRaw} − 7 + ${gov} = ${lawRaw - 7 + gov} → clamped = ${law}`);

        // ── Tech Level ────────────────────────────────────────────
        tSection('TECH LEVEL');
        let tlDM = 0;
        if (starport === 'A') { tlDM += 6; tDM('Starport A', 6); }
        else if (starport === 'B') { tlDM += 4; tDM('Starport B', 4); }
        else if (starport === 'C') { tlDM += 2; tDM('Starport C', 2); }
        else if (starport === 'X') { tlDM -= 4; tDM('Starport X', -4); }

        if (size <= 1) { tlDM += 2; tDM('Size ≤1', 2); }
        else if (size <= 4) { tlDM += 1; tDM('Size 2–4', 1); }

        if (atm >= 0 && atm <= 3) { tlDM += 1; tDM('Atm 0–3', 1); }
        else if (atm >= 10) { tlDM += 1; tDM('Atm ≥10', 1); }

        if (hydro === 9) { tlDM += 1; tDM('Hydro 9', 1); }
        else if (hydro === 10) { tlDM += 2; tDM('Hydro A', 2); }

        if (pop >= 1 && pop <= 5) { tlDM += 1; tDM('Pop 1–5', 1); }
        else if (pop === 9) { tlDM += 2; tDM('Pop 9', 2); }
        else if (pop >= 10) { tlDM += 4; tDM('Pop ≥10', 4); }

        if (gov === 0 || gov === 5) { tlDM += 1; tDM('Gov 0 or 5', 1); }
        else if (gov === 7) { tlDM += 2; tDM('Gov 7', 2); }
        else if (gov >= 13) { tlDM -= 2; tDM('Gov ≥13', -2); }

        let tlD = tracing ? tRoll1D('Roll 1D') : roll1D();
        tl = Math.max(0, tlD + tlDM);
        tResult('TL', `${tlD} + total DM(${tlDM}) = ${tlD + tlDM} → clamped = ${tl}`);
    } else {
        tSection('GOVERNMENT / LAW / TL');
        tSkip('Pop = 0 — Gov, Law, TL all set to 0');
    }

    // ── Bases ─────────────────────────────────────────────────────
    tSection('BASES');
    let navalBase = false, scoutBase = false, militaryBase = false, corsairBase = false;

    if (starport === 'A' || starport === 'B') {
        let mr = tracing ? tRoll2D('Military Base 2D') : roll2D();
        militaryBase = mr >= 8; tResult('Military Base', `${mr} ≥ 8?  ${militaryBase}`);
        let nr = tracing ? tRoll2D('Naval Base 2D') : roll2D();
        navalBase = nr >= 8; tResult('Naval Base', `${nr} ≥ 8?  ${navalBase}`);
    } else if (starport === 'C') {
        let mr = tracing ? tRoll2D('Military Base 2D') : roll2D();
        militaryBase = mr >= 10; tResult('Military Base', `${mr} ≥ 10?  ${militaryBase}`);
    } else { tSkip('Starport D/E/X — no military or naval base possible'); }

    if (starport === 'A') {
        let sr = tracing ? tRoll2D('Scout Base 2D') : roll2D();
        scoutBase = sr >= 10; tResult('Scout Base', `${sr} ≥ 10?  ${scoutBase}`);
    } else if (starport === 'B' || starport === 'C') {
        let sr = tracing ? tRoll2D('Scout Base 2D') : roll2D();
        scoutBase = sr >= 9; tResult('Scout Base', `${sr} ≥ 9?  ${scoutBase}`);
    } else if (starport === 'D') {
        let sr = tracing ? tRoll2D('Scout Base 2D') : roll2D();
        scoutBase = sr >= 8; tResult('Scout Base', `${sr} ≥ 8?  ${scoutBase}`);
    } else { tSkip('Starport E/X — no scout base possible'); }

    if (starport === 'D' || starport === 'E' || starport === 'X') {
        let corsairDM = 0;
        if (law === 0) { corsairDM = 2; tDM('Law 0', 2); }
        else if (law >= 2) { corsairDM = -2; tDM('Law ≥2', -2); }
        let cr = tracing ? tRoll2D('Corsair Base 2D') : roll2D();
        let threshold = starport === 'D' ? 12 : 10;
        corsairBase = (cr + corsairDM) >= threshold;
        tResult('Corsair Base', `${cr} + DM(${corsairDM}) = ${cr + corsairDM} ≥ ${threshold}?  ${corsairBase}`);
    } else { tSkip(`Starport ${starport} — corsair base not possible`); }

    // ── Gas Giant ─────────────────────────────────────────────────
    tSection('GAS GIANT');
    let ggRoll = tracing ? tRoll2D('2D') : roll2D();
    let gasGiant = ggRoll <= 9;
    tResult('Gas Giant Present', `${ggRoll} ≤ 9?  ${gasGiant}`);

    // ── UWP ───────────────────────────────────────────────────────
    tSection('UWP');
    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;
    tResult('UWP', uwp);

    // ── Trade Codes ───────────────────────────────────────────────
    tSection('TRADE CODES');
    let tradeCodes = [];
    const tc = (code, cond, reason) => { if (cond) { tradeCodes.push(code); tTrade(code, reason); } };
    tc('Ag', atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7, `Atm4-9(${atm}) Hyd4-8(${hydro}) Pop5-7(${pop})`);
    tc('As', size === 0 && atm === 0 && hydro === 0, `Size0 Atm0 Hyd0`);
    tc('Ba', pop === 0 && gov === 0 && law === 0, `Pop0 Gov0 Law0`);
    tc('De', atm >= 2 && atm <= 9 && hydro === 0, `Atm2-9(${atm}) Hyd0`);
    tc('Fl', atm >= 10 && hydro >= 1, `Atm≥10(${atm}) Hyd≥1(${hydro})`);
    tc('Ga', size >= 5 && atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8, `Siz5+(${size}) Atm4-9(${atm}) Hyd4-8(${hydro})`);
    tc('Hi', pop >= 9, `Pop≥9(${pop})`);
    tc('Ht', tl >= 12, `TL≥12(${tl})`);
    tc('Ic', atm <= 1 && hydro >= 1, `Atm≤1(${atm}) Hyd≥1(${hydro})`);
    tc('In', [0, 1, 2, 4, 7, 9].includes(atm) && pop >= 9, `Atm∈{0,1,2,4,7,9}(${atm}) Pop≥9(${pop})`);
    tc('Lo', pop >= 1 && pop <= 3, `Pop1-3(${pop})`);
    tc('Lt', tl <= 5, `TL≤5(${tl})`);
    tc('Na', atm <= 3 && hydro <= 3 && pop >= 6, `Atm≤3(${atm}) Hyd≤3(${hydro}) Pop≥6(${pop})`);
    tc('Ni', pop <= 6, `Pop≤6(${pop})`);
    tc('Po', atm >= 2 && atm <= 5 && hydro <= 3, `Atm2-5(${atm}) Hyd≤3(${hydro})`);
    tc('Ri', [6, 8].includes(atm) && pop >= 6 && pop <= 8, `Atm6or8(${atm}) Pop6-8(${pop})`);
    tc('Va', atm === 0, `Atm=0`);
    tc('Wa', atm >= 3 && atm <= 9 && hydro >= 10, `Atm3-9(${atm}) Hyd10(${hydro})`);
    if (tradeCodes.length === 0) tSkip('No trade codes qualify');

    // ── Travel Zone ───────────────────────────────────────────────
    tSection('TRAVEL ZONE');
    let travelZone = "Green";

    // Amber Zone Criteria (WBH/Core):
    // 1. Atmosphere 10 (A) or higher
    // 2. Government 0, 7, or 10
    // 3. Law Level 0 or 9+
    const isAmber = (atm >= 10) && ([0, 7, 10].includes(gov)) && (law === 0 || law >= 9);

    if (isAmber) {
        travelZone = "Amber";
        tResult('Zone', 'Amber (Dangerous environment/social/legal combo)');
    } else {
        tResult('Zone', 'Green');
    }
    // Note: Red Zones remain placeholder for referee discretion / manual override.

    // ── Finalise ──────────────────────────────────────────────────
    const name = getNextSystemName();
    tSection('NAME');
    tResult('Assigned', name || '(none — pool empty)');
    endTrace();

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

/**
 * MGT2E SUBORDINATE SOCIAL GENERATOR
 * Implementation from World Builder's Handbook logic.
 */
function generateMgT2ESubordinateSocial(body, mainworld) {
    if (!body || !mainworld) return;

    // 1. Population (WBH Dependent)
    const systemLimit = Math.max(0, mainworld.pop - roll1D());
    const popTypeRoll = roll1D();
    if (popTypeRoll >= 5) {
        body.pop = 0;
    } else {
        body.pop = Math.min(systemLimit, roll1D());
    }

    // 2. Government (Dependent)
    let govRoll = roll1D();
    if (mainworld.gov === 0) govRoll -= 2;
    if (mainworld.gov === 6) govRoll += mainworld.pop;

    if (govRoll <= 1) body.gov = 0;
    else if (govRoll === 2) body.gov = 1;
    else if (govRoll === 3) body.gov = 2;
    else if (govRoll === 4) body.gov = 3;
    else body.gov = 6; // Captive

    // 3. Law Level
    if (body.gov === 6) {
        let lRoll = roll1D();
        if (lRoll <= 2) body.law = mainworld.law; // actually prompt says 3-4 is MW Law. 1-2? Assuming match. 
        else if (lRoll <= 4) body.law = mainworld.law;
        else if (lRoll === 5) body.law = mainworld.law + 1;
        else body.law = mainworld.law + roll1D();
    } else if (body.gov >= 1 && body.gov <= 3) {
        let lRoll = roll2D() - mainworld.gov;
        if (lRoll <= 0) {
            body.law = mainworld.law;
        } else {
            let lawType = roll1D();
            if (lawType <= 3) body.law = roll1D();
            else body.law = Math.max(0, roll2D() - 7 + body.gov);
        }
    } else {
        // Fallback for Gov 0 or others not explicitly defined in prompt
        body.law = Math.max(0, roll2D() - 7 + body.gov);
    }
    body.law = Math.max(0, Math.min(18, body.law));

    // 4. Spaceport (Subordinate/Spaceports only)
    let spDM = 0;
    if (body.pop >= 6) spDM += 2;
    if (body.pop === 1) spDM -= 1;
    if (body.pop === 0) spDM -= 3;
    let spRoll = roll1D() + spDM;

    if (spRoll <= 2) body.starport = 'Y';
    else if (spRoll === 3) body.starport = 'H';
    else if (spRoll <= 5) body.starport = 'G';
    else body.starport = 'F';

    // 5. Tech Level (Standard T5 Roll as per instructions)
    let tlDM = 0;
    // Spaceport DM
    if (body.starport === 'F') tlDM += 1;
    // Physical/Social DMs (Mgt2e standard but 1D roll)
    if (body.size <= 1) tlDM += 2;
    else if (body.size <= 4) tlDM += 1;
    if (body.atm <= 3 || body.atm >= 10) tlDM += 1;
    if (body.hydro === 9) tlDM += 1;
    else if (body.hydro === 10) tlDM += 2;
    if (body.pop >= 1 && body.pop <= 5) tlDM += 1;
    else if (body.pop === 9) tlDM += 2;
    else if (body.pop >= 10) tlDM += 4;
    if (body.gov === 0 || body.gov === 5) tlDM += 1;
    else if (body.gov === 7) tlDM += 2;
    else if (body.gov >= 13) tlDM -= 2;

    body.tl = Math.max(0, roll1D() + tlDM);

    // Safety check for environmental floor
    const floor = getMgT2EMinSusTL(body.atm);
    if (body.tl < floor) body.tl = floor;

    // Final UWP construction
    const uwp = `${body.starport}${toUWPChar(body.size)}${toUWPChar(body.atm)}${toUWPChar(body.hydro)}${toUWPChar(body.pop)}${toUWPChar(body.gov)}${toUWPChar(body.law)}-${toUWPChar(body.tl)}`;
    body.uwp = uwp;
    body.uwpSecondary = uwp;
}

function generateMgT2ESocioeconomics(base) {
    if (!base) return null;

    // Prerequisite: Minimum Sustainable Tech Level
    let minSusTL = getMgT2EMinSusTL(base.atm);
    function roll2D3() {
        return (Math.floor(Math.random() * 3) + 1) + (Math.floor(Math.random() * 3) + 1);
    }

    // 1. Generate Population P Value and Total Population
    let pValue = 0;
    let totalWorldPop = 0;
    if (base.pop > 0) {
        pValue = roll1D() + Math.floor(Math.random() * 3); // random 1-9
        totalWorldPop = pValue * Math.pow(10, base.pop);
    }

    // 2. Generate Population Concentration Rating (PCR)
    let pcr = 0;
    let pcrOverride = false;
    if (base.pop < 6) {
        if (roll1D() > base.pop) {
            pcr = 9;
            pcrOverride = true;
        }
    }

    if (!pcrOverride && base.pop > 0) {
        let pcrRoll = roll1D();
        let pcrDM = 0;

        if (base.size === 1) pcrDM += 2;
        else if ([2, 3].includes(base.size)) pcrDM += 1;

        if (minSusTL >= 8) pcrDM += 3;
        else if (minSusTL >= 3 && minSusTL <= 7) pcrDM += 1;

        if (base.pop === 8) pcrDM -= 1;
        else if (base.pop >= 9) pcrDM -= 2;

        if (base.gov === 7) pcrDM -= 2;

        if ([0, 1].includes(base.tl)) pcrDM -= 2;
        else if ([2, 3].includes(base.tl)) pcrDM -= 1;
        else if (base.tl >= 4 && base.tl <= 9) pcrDM += 1;

        const tcs = base.tradeCodes || [];
        if (tcs.includes("Ag")) pcrDM -= 2;
        if (tcs.includes("In")) pcrDM += 1;
        if (tcs.includes("Na")) pcrDM -= 1;
        if (tcs.includes("Ri")) pcrDM += 1;

        pcr = pcrRoll + pcrDM;
        let minPCR = base.pop >= 9 ? 1 : 0;
        pcr = Math.max(minPCR, Math.min(9, pcr));
    }

    // 3. Generate Urbanisation Percentage
    let urbanPercent = 0;
    if (base.pop > 0) {
        let uRoll = roll2D();
        let uDM = 0;

        if ([0, 1, 2].includes(pcr)) uDM += (-3 + pcr);
        else if ([7, 8, 9].includes(pcr)) uDM += (-6 + pcr);

        if (minSusTL >= 0 && minSusTL <= 3) uDM -= 1;

        if (base.size === 0) uDM += 2;
        if (base.pop === 8) uDM += 1;
        else if (base.pop === 9) uDM += 2;
        else if (base.pop >= 10) uDM += 4;

        if (base.gov === 0) uDM -= 2;
        if (base.law >= 9) uDM += 1;

        if ([0, 1, 2].includes(base.tl)) uDM -= 2;
        else if (base.tl === 3) uDM -= 1;
        else if (base.tl === 4) uDM += 1;
        else if (base.tl >= 5 && base.tl <= 9) uDM += 2;
        else if (base.tl >= 10) uDM += 1;

        const tcs = base.tradeCodes || [];
        if (tcs.includes("Ag")) uDM -= 2;
        if (tcs.includes("Na")) uDM += 2;

        let modURoll = uRoll + uDM;

        // Base Percentage mapping
        let rolledPercent = 0;
        if (modURoll <= 0) rolledPercent = 0;
        else if (modURoll === 1) rolledPercent = roll1D();
        else if (modURoll === 2) rolledPercent = 6 + roll1D();
        else if (modURoll === 3) rolledPercent = 12 + roll1D();
        else if (modURoll === 4) rolledPercent = 18 + roll1D();
        else if (modURoll === 5) rolledPercent = 22 + (roll1D() * 2) + (Math.floor(Math.random() * 2) + 1);
        else if (modURoll === 6) rolledPercent = 34 + (roll1D() * 2) + (Math.floor(Math.random() * 2) + 1);
        else if (modURoll === 7) rolledPercent = 46 + (roll1D() * 2) + (Math.floor(Math.random() * 2) + 1);
        else if (modURoll === 8) rolledPercent = 58 + (roll1D() * 2) + (Math.floor(Math.random() * 2) + 1);
        else if (modURoll === 9) rolledPercent = 70 + (roll1D() * 2) + (Math.floor(Math.random() * 2) + 1);
        else if (modURoll === 10) rolledPercent = 84 + roll1D();
        else if (modURoll === 11) rolledPercent = 90 + roll1D();
        else if (modURoll === 12) rolledPercent = 96 + (Math.floor(Math.random() * 3) + 1);
        else if (modURoll >= 13) rolledPercent = 100;

        // Constraints
        let minLimit = -1;
        if (base.pop >= 10) minLimit = 50 + roll1D();
        else if (base.pop === 9) minLimit = 18 + roll1D();

        let maxLimit = 101;
        if ([0, 1, 2].includes(base.tl)) maxLimit = Math.min(maxLimit, 20 + roll1D());
        else if (base.tl === 3) maxLimit = Math.min(maxLimit, 30 + roll1D());
        else if (base.tl === 4) maxLimit = Math.min(maxLimit, 60 + roll1D());
        else if (base.tl >= 5 && base.tl <= 9) maxLimit = Math.min(maxLimit, 90 + roll1D());

        if (tcs.includes("Ag")) maxLimit = Math.min(maxLimit, 90 + roll1D());

        if (minLimit !== -1 && rolledPercent < minLimit) urbanPercent = minLimit;
        else if (maxLimit !== 101 && rolledPercent > maxLimit) urbanPercent = maxLimit;
        else urbanPercent = rolledPercent;

        urbanPercent = Math.max(0, Math.min(100, urbanPercent));
    }

    // 4. Calculate Total Urban Population
    let totalUrbanPop = Math.round(totalWorldPop * (urbanPercent / 100));

    // 5. Determine Major Cities and Total Major City Population
    let majorCities = 0;
    let totalMajorCityPop = 0;

    if (pcr === 0) {
        majorCities = 0;
        totalMajorCityPop = 0;
    } else if (base.pop <= 5 && pcr === 9) {
        majorCities = 1;
        totalMajorCityPop = totalUrbanPop;
    } else if (base.pop <= 5 && pcr >= 1 && pcr <= 8) {
        majorCities = Math.min(9 - pcr, base.pop);
        totalMajorCityPop = totalUrbanPop;
    } else if (base.pop >= 6 && pcr === 9) {
        let mCRoll = roll2D();
        majorCities = Math.max(base.pop - mCRoll, 1);
        totalMajorCityPop = totalUrbanPop;
    } else { // Population >= 6 AND PCR 1-8 (or fallback)
        let mCRoll = roll2D();
        let urbanDecimal = urbanPercent / 100;
        let rawCities = mCRoll - pcr + ((urbanDecimal * 20) / pcr);
        majorCities = Math.ceil(rawCities);

        if (majorCities < 1) majorCities = 1;
        if (base.pop < 6 && majorCities > base.pop) majorCities = base.pop;

        let popRoll = roll1D();
        let calcTotalMCPop = (pcr / (popRoll + 7)) * totalUrbanPop;
        totalMajorCityPop = Math.ceil(calcTotalMCPop);
    }

    if (majorCities === 1) {
        totalMajorCityPop = totalUrbanPop;
    }

    // 6. Centralisation Code (C)
    let cRoll = roll2D();
    let cDM = 0;
    if (base.gov >= 2 && base.gov <= 5) cDM -= 1;
    if ([6, 8, 9, 10, 11].includes(base.gov)) cDM += 1;
    if (base.gov === 7) cDM += 1;
    if (base.gov >= 12) cDM += 2;
    if (pcr >= 0 && pcr <= 3) cDM -= 1;
    if (pcr === 7 || pcr === 8) cDM += 1;
    if (pcr === 9) cDM += 3;

    let cScore = cRoll + cDM;
    let centralisation = 'U';
    if (cScore <= 5) centralisation = 'C';
    else if (cScore <= 8) centralisation = 'F';

    // 7. Primary Authority Code (A)
    let aRoll = roll2D();
    let aDM = 0;
    if ([1, 6, 10, 13, 14].includes(base.gov)) aDM += 6;
    if (base.gov === 2) aDM -= 4;
    if ([3, 5, 12].includes(base.gov)) aDM -= 2;
    if (base.gov === 11 || base.gov === 15) aDM += 4;
    if (centralisation === 'C') aDM -= 2;
    if (centralisation === 'U') aDM += 2;

    let aScore = aRoll + aDM;
    let authority = 'E';
    if (aScore <= 4 || aScore === 8) authority = 'L';
    else if (aScore === 6 || aScore === 11) authority = 'J';
    else if (aScore === 7 || aScore === 9) authority = 'B';

    // 8. Structure Code (S)
    function getStructure(gov, auth, branch, isSecondary) {
        if (gov === 2) return 'D';
        if (gov === 8 || gov === 9) return 'M';
        if ([3, 12, 15].includes(gov)) return roll1D() <= 4 ? 'S' : 'M';
        if ([10, 11, 13, 14].includes(gov)) {
            if (!isSecondary) return roll1D() <= 5 ? 'R' : 'S';
            // if secondary, fall through to fallback with DM +2
        } else if (auth === 'L' && !isSecondary) {
            let sRoll = roll2D();
            if (sRoll <= 3) return 'D';
            if (sRoll <= 8) return 'M';
            return 'S';
        }

        let fallbackRoll = roll2D() + (isSecondary && [10, 11, 13, 14].includes(gov) ? 2 : 0);
        if (fallbackRoll <= 3) return 'D';
        if (fallbackRoll === 4) return 'S';
        if (fallbackRoll <= 6) return 'M';
        if (fallbackRoll <= 8) return 'R';
        if (fallbackRoll === 9) return 'M';
        if (fallbackRoll === 10) return 'S';
        if (fallbackRoll === 11) return 'M';
        return 'S';
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

    // 9. Factions
    let baseFactions = Math.floor(Math.random() * 3) + 1; // 1 to 3
    let fDM = 0;
    if (base.gov === 0 || base.gov === 7) fDM += 1;
    if (base.gov >= 10) fDM -= 1;

    let totalFactions = baseFactions + fDM;
    let numExternalFactions = 0;
    if (totalFactions > 1) {
        numExternalFactions = totalFactions - 1;
    }

    let factionsList = [];
    for (let i = 0; i < numExternalFactions; i++) {
        let fRoll = roll2D();
        if (fRoll <= 3) factionsList.push('O');
        else if (fRoll <= 5) factionsList.push('F');
        else if (fRoll <= 7) factionsList.push('M');
        else if (fRoll <= 9) factionsList.push('N');
        else if (fRoll <= 11) factionsList.push('S');
        else factionsList.push('P');
    }
    let factionsString = factionsList.join('');

    // 10. Law Profile (O-WECPR)
    let overallLaw = base.law;
    let judRoll = roll2D();
    let isInquisitorial = judRoll <= 5;

    // Weapons and Armour (W)
    let wDM = 0;
    if (pcr >= 0 && pcr <= 3) wDM -= 1;
    if (pcr === 8 || pcr === 9) wDM += 1;
    let lawW = overallLaw + roll2D3() - 4 + wDM;
    lawW = Math.max(0, Math.min(18, lawW));

    // Economic Law (E)
    let eDM = 0;
    if (base.gov === 0) eDM -= 2;
    if (base.gov === 1) eDM += 2;
    if (base.gov === 2) eDM -= 1;
    if (base.gov === 9) eDM += 1;
    let lawE = overallLaw + roll2D3() - 4 + eDM;
    lawE = Math.max(0, Math.min(18, lawE));

    // Criminal Law (C)
    let cLawDM = 0;
    if (isInquisitorial) cLawDM += 1;
    let lawC = overallLaw + roll2D3() - 4 + cLawDM;
    lawC = Math.max(0, Math.min(18, lawC));

    // Private Law (P)
    let pLawDM = 0;
    if (base.gov === 12) pLawDM -= 1;
    let lawP = overallLaw + roll2D3() - 4 + pLawDM;
    lawP = Math.max(0, Math.min(18, lawP));

    // Personal Rights (R)
    let rDM = 0;
    if (base.gov === 0 || base.gov === 2) rDM -= 1;
    if (base.gov === 1) rDM += 2;
    let lawR = overallLaw + roll2D3() - 4 + rDM;
    lawR = Math.max(0, Math.min(18, lawR));

    // Convert to eHex
    function toEHex(val) {
        if (val <= 9) return val.toString();
        const hexChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skip I and O
        return hexChars[val - 10] || '0';
    }

    let lawProfile = `${toEHex(overallLaw)}-${toEHex(lawW)}${toEHex(lawE)}${toEHex(lawC)}${toEHex(lawP)}${toEHex(lawR)}`;

    // 11. Tech Profile (H-L-QQQQQ-TTTT-MM-N)
    function tlm() {
        let roll = roll2D();
        if (roll === 2) return -3;
        if (roll === 3) return -2;
        if (roll === 4) return -1;
        if (roll >= 5 && roll <= 9) return 0;
        if (roll === 10) return 1;
        if (roll === 11) return 2;
        if (roll === 12) return 3;
        return 0;
    }

    let tcs = base.tradeCodes || [];
    let isInd = tcs.includes("In");
    let isRich = tcs.includes("Ri");
    let isPoor = tcs.includes("Po");
    let habRating = 8; // placeholder

    // Common TL
    let H = base.tl;
    let lDM = 0;
    if (base.pop >= 1 && base.pop <= 5) lDM += 1;
    if (base.pop >= 9) lDM -= 1;
    if ([0, 6, 13, 14].includes(base.gov)) lDM -= 1;
    if (base.gov === 5) lDM += 1;
    if (base.gov === 7) lDM -= 2;
    if (pcr >= 0 && pcr <= 2) lDM -= 1;
    if (pcr >= 7) lDM += 1;

    let L = H + tlm() + lDM;
    L = Math.max(Math.floor(H / 2), Math.min(H, L));

    // Quality of Life TLs
    let q1DM = 0;
    if (base.pop >= 9) q1DM += 1;
    if (isInd) q1DM += 1;
    let Q1 = H + tlm() + q1DM;
    Q1 = Math.max(Math.floor(H / 2), Math.min(Math.floor(H * 1.2), Q1));

    let q2DM = 0;
    if (base.pop >= 1 && base.pop <= 5) q2DM += 1;
    if (base.pop >= 9) q2DM -= 1;
    if (isInd) q2DM += 1;
    let Q2 = H + tlm() + q2DM;
    Q2 = Math.max(Q1 - 3, Math.min(Q1 + 1, Q2));

    let q3DM = 0;
    if (base.pop >= 1 && base.pop <= 6) q3DM -= 1;
    if (base.pop >= 8) q3DM += 1;
    if (isInd) q3DM += 1;
    let Q3 = H + tlm() + q3DM;
    Q3 = Math.max(Q2 - 2, Math.min(Math.max(Q1, Q2), Q3));

    let q4DM = 0;
    if (isRich) q4DM += 1;
    if (isPoor) q4DM -= 1;
    let spDM = 0;
    if (base.starport === 'A') spDM = 6;
    else if (base.starport === 'B') spDM = 4;
    else if (base.starport === 'C') spDM = 2;
    let Q4 = Q2 + tlm() + q4DM;
    Q4 = Math.max(Math.max(0, spDM), Math.min(Q2, Q4));

    let q5DM = 0;
    if (habRating < 8) q5DM += (8 - habRating);
    let Q5 = Q3 + tlm() + q5DM;
    Q5 = Math.max(Q1 - 5, Math.min(Q1, Q5));

    // Transportation TLs
    let t1DM = 0;
    if (base.hydro === 10) t1DM -= 1;
    if (pcr >= 0 && pcr <= 2) t1DM += 1;
    let T1 = Q1 + tlm() + t1DM;
    T1 = Math.max(Q2 - 5, Math.min(Q1, T1));

    let t2DM = 0;
    if (base.hydro === 0) t2DM -= 2;
    if (base.hydro === 8) t2DM += 1;
    if (base.hydro >= 9) t2DM += 2;
    if (pcr >= 0 && pcr <= 2) t2DM += 1;
    let T2 = Q1 + tlm() + t2DM;
    if (base.hydro === 0) {
        T2 = Math.max(0, Math.min(Q1, T2));
    } else {
        T2 = Math.max(Q2 - 5, Math.min(Q1, T2));
    }

    let t3DM = 0;
    if ((base.atm <= 3 || base.atm === 14) && H <= 7) t3DM -= 2;
    if ((base.atm === 4 || base.atm === 5) && H <= 7) t3DM -= 1;
    let T3 = Q1 + tlm() + t3DM;
    T3 = Math.max(Q2 - 5, Math.min(Q1, T3));
    if (base.atm === 0 && H <= 5) {
        T3 = 0;
    }

    let t4DM = 0;
    if (base.size === 0 || base.size === 1) t4DM += 2;
    if (base.pop >= 1 && base.pop <= 5) t4DM -= 1;
    if (base.pop >= 9) t4DM += 1;
    if (base.starport === 'A') t4DM += 2;
    if (base.starport === 'B') t4DM += 1;
    let T4 = Q3 + tlm() + t4DM;
    T4 = Math.max(Math.min(Q1 - 3, Q3 - 3), Math.min(Math.min(Q1, Q3), T4));

    // Military TLs
    let m1DM = 0;
    if (base.gov === 0 || base.gov === 7) m1DM += 2;
    if (overallLaw === 0 || overallLaw >= 13) m1DM += 2;
    if ((overallLaw >= 1 && overallLaw <= 4) || (overallLaw >= 9 && overallLaw <= 12)) m1DM += 1;
    let M1 = Q3 + tlm() + m1DM;
    M1 = Math.max((lawW === 0 ? Q3 : 0), Math.min(Q2, M1));

    let m2DM = 0;
    if (base.pop >= 1 && base.pop <= 6) m2DM -= 1;
    if (base.pop >= 8) m2DM += 1;
    if ([7, 10, 11, 15].includes(base.gov)) m2DM += 2;
    if (overallLaw >= 13) m2DM += 2;
    if (isInd) m2DM += 1;
    let M2 = Q3 + tlm() + m2DM;
    M2 = Math.max(0, Math.min(Q3, M2));

    // Novelty TL
    let maxOfAll = Math.max(Q1, Q2, Q3, Q4, Q5, T1, T2, T3, T4, M1, M2);
    let N = Math.max(maxOfAll, minSusTL, Math.max(H + 2, 12));

    let techProfile = `${toEHex(H)}-${toEHex(L)}-${toEHex(Q1)}${toEHex(Q2)}${toEHex(Q3)}${toEHex(Q4)}${toEHex(Q5)}-${toEHex(T1)}${toEHex(T2)}${toEHex(T3)}${toEHex(T4)}-${toEHex(M1)}${toEHex(M2)}-${toEHex(N)}`;

    // 12. Cultural Profile (DXUS-CPEM)
    let culD = 0, culX = 0, culU = 0, culS = 0;
    let culC = 0, culP = 0, culE = 0, culM = 0;
    let culturalProfile = "0000-0000";

    if (base.pop > 0) {
        // Diversity
        let cD_DM = 0;
        if (base.pop >= 1 && base.pop <= 5) cD_DM -= 2;
        if (base.pop >= 9) cD_DM += 2;
        if ([0, 1, 2].includes(base.gov)) cD_DM += 1;
        if (base.gov === 7) cD_DM += 4;
        if ([13, 14, 15].includes(base.gov)) cD_DM -= 4;
        if (overallLaw >= 0 && overallLaw <= 4) cD_DM += 1;
        if (overallLaw >= 10) cD_DM -= 1;
        if (pcr >= 0 && pcr <= 3) cD_DM += 1;
        if (pcr >= 7 && pcr <= 9) cD_DM -= 2;
        culD = Math.max(1, roll2D() + cD_DM);

        // Xenophilia
        let cX_DM = 0;
        if (base.pop >= 1 && base.pop <= 5) cX_DM -= 1;
        if (base.pop >= 9) cX_DM += 2;
        if (base.gov === 13 || base.gov === 14) cX_DM -= 2;
        if (overallLaw >= 10) cX_DM -= 2;
        if (base.starport === 'A') cX_DM += 2;
        if (base.starport === 'B') cX_DM += 1;
        if (base.starport === 'D') cX_DM -= 1;
        if (base.starport === 'E') cX_DM -= 2;
        if (base.starport === 'X') cX_DM -= 4;
        if (culD >= 1 && culD <= 3) cX_DM -= 2;
        if (culD >= 12) cX_DM += 1;
        culX = Math.max(1, roll2D() + cX_DM);

        // Uniqueness
        let cU_DM = 0;
        if (base.starport === 'A') cU_DM -= 2;
        if (base.starport === 'B') cU_DM -= 1;
        if (base.starport === 'D') cU_DM += 1;
        if (base.starport === 'E') cU_DM += 2;
        if (base.starport === 'X') cU_DM += 4;
        if (culD >= 1 && culD <= 3) cU_DM += 2;
        if ([9, 10, 11].includes(culX)) cU_DM -= 1;
        if (culX >= 12) cU_DM -= 2;
        culU = Math.max(1, roll2D() + cU_DM);

        // Symbology
        let cS_DM = 0;
        if (base.gov === 13 || base.gov === 14) cS_DM += 2;
        if (H === 0 || H === 1) cS_DM -= 3;
        if (H === 2 || H === 3) cS_DM -= 1;
        if ([9, 10, 11].includes(H)) cS_DM += 2;
        if (H >= 12) cS_DM += 4;
        if ([9, 10, 11].includes(culU)) cS_DM += 1;
        if (culU >= 12) cS_DM += 3;
        culS = Math.max(1, roll2D() + cS_DM);

        // Cohesion
        let cC_DM = 0;
        if (base.gov === 3 || base.gov === 12) cC_DM += 2;
        if ([5, 6, 9].includes(base.gov)) cC_DM += 1;
        if (overallLaw >= 0 && overallLaw <= 2) cC_DM -= 2;
        if (overallLaw >= 10) cC_DM += 2;
        if (pcr >= 0 && pcr <= 3) cC_DM -= 2;
        if (pcr >= 7) cC_DM += 2;
        if (culD === 1 || culD === 2) cC_DM += 4;
        if ([3, 4, 5].includes(culD)) cC_DM += 2;
        if ([9, 10, 11].includes(culD)) cC_DM -= 2;
        if (culD >= 12) cC_DM -= 4;
        culC = Math.max(1, roll2D() + cC_DM);

        // Progressiveness
        let cP_DM = 0;
        if ([6, 7, 8].includes(base.pop)) cP_DM -= 1;
        if (base.pop >= 9) cP_DM -= 2;
        if (base.gov === 5) cP_DM += 1;
        if (base.gov === 11) cP_DM -= 2;
        if (base.gov === 13 || base.gov === 14) cP_DM -= 6;
        if ([9, 10, 11].includes(overallLaw)) cP_DM -= 1;
        if (overallLaw >= 12) cP_DM -= 4;
        if (culD >= 1 && culD <= 3) cP_DM -= 2;
        if (culD >= 12) cP_DM += 1;
        if (culX >= 1 && culX <= 5) cP_DM -= 1;
        if (culX >= 9) cP_DM += 2;
        if (culC >= 1 && culC <= 5) cP_DM += 2;
        if (culC >= 9) cP_DM -= 2;
        culP = Math.max(1, roll2D() + cP_DM);

        // Expansionism
        let cE_DM = 0;
        if (base.gov === 10 || base.gov >= 12) cE_DM += 2;
        if (culD >= 1 && culD <= 3) cE_DM += 3;
        if (culD >= 12) cE_DM -= 3;
        if (culX >= 1 && culX <= 5) cE_DM += 1;
        if (culX >= 9) cE_DM -= 2;
        culE = Math.max(1, roll2D() + cE_DM);

        // Militancy
        let cM_DM = 0;
        if (base.gov >= 10) cM_DM += 3;
        if ([9, 10, 11].includes(overallLaw)) cM_DM += 1;
        if (overallLaw >= 12) cM_DM += 2;
        if (culX >= 1 && culX <= 5) cM_DM += 1;
        if (culX >= 9) cM_DM -= 2;
        if (culE >= 1 && culE <= 5) cM_DM -= 1;
        if ([9, 10, 11].includes(culE)) cM_DM += 1;
        if (culE >= 12) cM_DM += 2;
        culM = Math.max(1, roll2D() + cM_DM);

        culturalProfile = `${toEHex(culD)}${toEHex(culX)}${toEHex(culU)}${toEHex(culS)}-${toEHex(culC)}${toEHex(culP)}${toEHex(culE)}${toEHex(culM)}`;
    }

    // 13. Economic Profile
    let ggCount = base.gasGiant ? 1 : 0;
    let beltCount = base.size === 0 ? 1 : 0;
    let basesCount = 0;
    if (base.navalBase) basesCount++;
    if (base.scoutBase) basesCount++;
    if (base.militaryBase) basesCount++;

    let resourceRating = roll2D() - 7 + base.size;
    resourceRating = Math.max(2, Math.min(12, resourceRating));

    let tcArr = tcs;
    let Im = 0;
    if (['A', 'B'].includes(base.starport)) Im += 1;
    if (['D', 'E', 'X'].includes(base.starport)) Im -= 1;
    if (base.tl <= 8) Im -= 1;
    if (base.tl >= 10 && base.tl <= 15) Im += 1;
    if (base.tl >= 16) Im += 2;
    if (base.pop <= 6) Im -= 1;
    if (base.pop >= 9) Im += 1;
    if (tcArr.includes('Ag')) Im += 1;
    if (tcArr.includes('In')) Im += 1;
    if (tcArr.includes('Ri')) Im += 1;
    if (basesCount >= 2) Im += 1;

    let ecoR = resourceRating;
    if (tcArr.includes('In') || tcArr.includes('Ag')) {
        ecoR -= Math.floor(Math.random() * 6);
        ecoR = Math.max(2, ecoR);
    }
    if (base.tl >= 8) {
        ecoR += ggCount + beltCount;
    }
    if (ecoR < 2) {
        ecoR = 2 + ggCount + beltCount;
    }

    let ecoL = base.pop <= 1 ? 0 : base.pop - 1;

    let ecoI = Im;
    if (base.pop >= 4 && base.pop <= 6) ecoI += Math.floor(Math.random() * 6) + 1;
    if (base.pop >= 7) ecoI += roll2D();
    if (base.pop === 0 || ecoI < 0) ecoI = 0;

    let ecoE = 0;
    if (base.pop === 0) ecoE = -5;
    else if (base.pop >= 1 && base.pop <= 6) ecoE = roll2D() - 7;
    else if (base.pop >= 7) ecoE = roll2D3() - 4;

    let ecoE_DM = 0;
    if ([0, 3, 6, 9, 11, 12, 15].includes(base.gov)) ecoE_DM -= 1;
    if ([1, 2, 4, 5, 8].includes(base.gov)) ecoE_DM += 1;
    if (overallLaw >= 0 && overallLaw <= 4) ecoE_DM += 1;
    if (overallLaw >= 10) ecoE_DM -= 1;
    if (pcr >= 0 && pcr <= 3) ecoE_DM -= 1;
    if (pcr >= 8) ecoE_DM += 1;
    if (culP >= 1 && culP <= 3) ecoE_DM -= 1;
    if (culP >= 9) ecoE_DM += 1;
    if (culE >= 1 && culE <= 3) ecoE_DM -= 1;
    if (culE >= 9) ecoE_DM += 1;

    if (base.pop > 0) {
        ecoE += ecoE_DM;
        ecoE = Math.max(-5, Math.min(5, ecoE));
        if (ecoE === 0) ecoE = 1;
    }

    let calcR = ecoR === 0 ? 1 : ecoR;
    let calcL = ecoL === 0 ? 1 : ecoL;
    let calcI = ecoI === 0 ? 1 : ecoI;
    let calcE = ecoE === 0 ? 1 : ecoE;
    let RU = calcR * calcL * calcI * calcE;

    let gwpBase = Math.max(1, ecoI) + Math.max(1, ecoR);
    if (base.pop === 0) gwpBase = ecoI + ecoR;
    let maxGwpBase = Math.max(2, 2 * ecoI);
    gwpBase = Math.max(2, Math.min(maxGwpBase, gwpBase));

    let tlMod = base.tl === 0 ? 0.05 : base.tl / 10;
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
    let tcMod = 1.0;
    if (tcArr.includes('Ag')) tcMod *= 0.9;
    if (tcArr.includes('As')) tcMod *= 1.2;
    if (tcArr.includes('Ga')) tcMod *= 1.2;
    if (tcArr.includes('In')) tcMod *= 1.1;
    if (tcArr.includes('Na')) tcMod *= 0.9;
    if (tcArr.includes('Ni')) tcMod *= 0.9;
    if (tcArr.includes('Po')) tcMod *= 0.8;
    if (tcArr.includes('Ri')) tcMod *= 1.2;

    let totalMods = tlMod * portMod * govMod * tcMod;
    let pcGWP = 0;
    if (ecoE > 0) {
        pcGWP = 1000 * gwpBase * totalMods * ecoE;
    } else if (ecoE < 0) {
        pcGWP = (1000 * gwpBase * totalMods) / (-(ecoE - 1));
    }
    pcGWP = Math.round(pcGWP);

    let wtnBase = base.pop;
    if (base.tl <= 1) wtnBase -= 1;
    else if (base.tl >= 5 && base.tl <= 8) wtnBase += 1;
    else if (base.tl >= 9 && base.tl <= 14) wtnBase += 2;
    else if (base.tl >= 15) wtnBase += 3;

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

    let WTN = Math.max(0, wtnBase + portWtnMod);

    let IR = 50 - (ecoE * 5) + ((roll2D() - 7) * 2);
    if ([6, 11, 15].includes(base.gov)) IR += 10;
    if ([0, 1, 3, 9, 12].includes(base.gov)) IR += 5;
    if ([4, 8].includes(base.gov)) IR -= 5;
    if (base.gov === 2) IR -= 10;
    if (overallLaw >= 9) IR += (overallLaw - 8);
    IR += pcr;
    IR -= ecoI;

    let DR = (pcGWP / 1000) * (1 - (IR / 100));
    DR = DR.toFixed(2);

    let formatIm = Im >= 0 ? "+" + Im : Im.toString();
    let formatE = ecoE >= 0 ? "+" + ecoE : ecoE.toString();
    let rlie = `${toEHex(ecoR)}${toEHex(ecoL)}${toEHex(ecoI)}${formatE}`;
    let wtnChar = toEHex(WTN);

    let economicProfile = `${formatIm}, ${rlie}, ${RU}, Cr${pcGWP}, ${wtnChar}, ${IR}, ${DR}`;

    // 14. Starport Profile
    let spClass = base.starport || 'X';
    let hxObj = 'HN';
    if (['A', 'B', 'C', 'D'].includes(spClass)) {
        let target = 12;
        if (spClass === 'A') target = 6;
        if (spClass === 'B') target = 8;
        if (spClass === 'C') target = 10;

        let hxScore = roll2D();
        if (base.pop >= 9) hxScore += 1;
        if ([9, 10, 11].includes(base.tl)) hxScore += 1;
        if (base.tl >= 12) hxScore += 2;

        if (hxScore >= target) hxObj = 'HY';
    }

    let dxObj = base.gasGiant ? 'DN' : 'DY';

    let spIm = Im;
    if (WTN >= 10) spIm += 1;
    if (WTN <= 4) spIm -= 1;

    let formatSpIm = spIm >= 0 ? "+" + spIm : spIm.toString();
    let starportProfile = `${spClass}-${hxObj}:${dxObj}:${formatSpIm}`;

    // 15. Military Profile
    let milRisk = roll2D() >= 10;
    let milFactional = roll2D() >= 11;
    let milReadinessRoll = roll2D();
    let milReadiness = 'Normal';
    let readinessMultiplier = 1.0;
    let milConflictGlobalDM = 0;
    if (milReadinessRoll <= 2) { milReadiness = 'Complacent'; readinessMultiplier = 0.5; }
    else if (milReadinessRoll <= 5) { milReadiness = 'Low'; readinessMultiplier = 0.75; }
    else if (milReadinessRoll <= 8) { milReadiness = 'Normal'; readinessMultiplier = 1.0; }
    else if (milReadinessRoll <= 10) { milReadiness = 'Heightened'; readinessMultiplier = 1.2; milConflictGlobalDM = 1; }
    else if (milReadinessRoll === 11) { milReadiness = 'War'; readinessMultiplier = 2.0; milConflictGlobalDM = 4; }
    else { milReadiness = 'Total War'; readinessMultiplier = 5.0; milConflictGlobalDM = 8; }
    if (milFactional && readinessMultiplier < 2.0) { readinessMultiplier = 1.2; milConflictGlobalDM = 2; }

    let globalMilitancyDM = 0;
    if (culM >= 1 && culM <= 2) globalMilitancyDM = -4;
    else if (culM >= 3 && culM <= 5) globalMilitancyDM = -1;
    else if (culM >= 6 && culM <= 8) globalMilitancyDM = 1;
    else if (culM >= 9 && culM <= 11) globalMilitancyDM = 2;
    else if (culM >= 12) globalMilitancyDM = 4;

    let globalDM = globalMilitancyDM + milConflictGlobalDM;

    // Enforcement
    let enfDM = 0;
    if (base.gov === 0) enfDM -= 5;
    if (base.gov === 11) enfDM += 2;
    if (overallLaw === 0) enfDM -= 4;
    if (overallLaw === 1) enfDM -= 2;
    if (overallLaw === 2) enfDM -= 1;
    if (overallLaw >= 9 && overallLaw <= 11) enfDM += 2;
    if (overallLaw >= 12) enfDM += 4;
    if (pcr >= 0 && pcr <= 4) enfDM += 2;
    if (milFactional) enfDM += 2;
    let enfEff = 3 + globalDM + enfDM;
    if (enfEff < 1) enfEff = 1;
    if (enfEff > 18) enfEff = 18;
    let bE = toEHex(enfEff);

    // Militia
    let milM_DM = 0;
    if (base.gov === 1) milM_DM -= 4;
    if (base.gov === 2) milM_DM += 2;
    if (base.gov === 6) milM_DM -= 6;
    milM_DM -= overallLaw;
    if (pcr >= 0 && pcr <= 2) milM_DM += 2;
    if (pcr === 3 || pcr === 4) milM_DM += 1;
    if (pcr >= 6) milM_DM -= 1;
    let milMRoll = roll2D() + globalDM + milM_DM;
    let bM = "0";
    if (milMRoll >= 4) {
        let eff = milMRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bM = toEHex(eff);
    }

    // Army
    let armyDM = 0;
    if (bM !== "0") armyDM -= 2;
    if (base.gov === 0) armyDM -= 6;
    if (base.gov === 7) armyDM += 4;
    if (base.gov >= 10) armyDM += 4;
    if (base.tl <= 7) armyDM += 4;
    if (base.tl >= 8) armyDM -= 2;
    if (base.militaryBase) armyDM += 6;
    if (milRisk) armyDM += 2;
    if (milFactional) armyDM += 2;
    let armyRoll = roll2D() + globalDM + armyDM;
    let bA = "0";
    if (armyRoll >= 4) {
        let eff = armyRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bA = toEHex(eff);
    }

    // Wet Navy
    let wetDM = 0;
    if (base.hydro === 0) wetDM -= 20;
    if (base.hydro >= 1 && base.hydro <= 3) wetDM -= 5;
    if (base.hydro === 8) wetDM += 2;
    if (base.hydro === 9) wetDM += 4;
    if (base.hydro >= 10) wetDM += 8;
    if (base.gov === 7) wetDM += 4;
    if (base.tl === 0) wetDM -= 8;
    if (base.tl === 8 || base.tl === 9) wetDM -= 2;
    if (base.tl >= 10) wetDM -= base.tl;
    let wetRoll = roll2D() + globalDM + wetDM;
    let bW = "0";
    if (wetRoll >= 4) {
        let eff = wetRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bW = toEHex(eff);
    }

    // Air Force
    let airDM = 0;
    if (base.atm <= 1 && base.tl <= 8) airDM -= 20;
    if (([2, 3, 14].includes(base.atm)) && base.tl <= 8) airDM -= 8;
    if (([4, 5].includes(base.atm)) && base.tl <= 8) airDM -= 2;
    if (base.gov === 7) airDM += 4;
    if (base.tl >= 0 && base.tl <= 2) airDM -= 20;
    if (base.tl === 3) airDM -= 10;
    if (base.tl >= 10 && base.tl <= 12) airDM -= 4;
    if (base.tl >= 13) airDM -= 6;
    let airRoll = roll2D() + globalDM + airDM;
    let bF = "0";
    if (airRoll >= 4) {
        let eff = airRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bF = toEHex(eff);
    }

    // System Defence
    let sysDM = 0;
    if (base.pop <= 3) sysDM -= 6;
    if (base.pop === 4 || base.pop === 5) sysDM -= 2;
    if (base.tl <= 5) sysDM -= 20;
    if (base.tl === 6) sysDM -= 8;
    if (base.tl === 7) sysDM -= 6;
    if (base.tl === 8) sysDM -= 2;
    if (base.starport === 'A') sysDM += 4;
    if (base.starport === 'B') sysDM += 2;
    if (base.starport === 'C') sysDM += 1;
    if (base.starport === 'E') sysDM -= 2;
    if (base.starport === 'X') sysDM -= 8;
    if (hxObj === 'HY') sysDM += 2;
    if (base.navalBase) sysDM += 4;
    if (base.militaryBase) sysDM += 2;
    if (milRisk) sysDM += 2;
    let sysRoll = roll2D() + globalDM + sysDM;
    let bS = "0";
    if (sysRoll >= 4) {
        let eff = sysRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bS = toEHex(eff);
    }

    // Navy
    let navDM = 0;
    if (base.pop <= 3) navDM -= 6;
    if (base.pop >= 4 && base.pop <= 6) navDM -= 3;
    if (base.tl <= 5) navDM -= 20;
    if (base.tl === 6) navDM -= 12;
    if (base.tl === 7) navDM -= 8;
    if (base.tl === 8) navDM -= 6;
    if (base.starport === 'A') navDM += 4;
    if (base.starport === 'B') navDM += 1;
    if (base.starport === 'E') navDM -= 2;
    if (base.starport === 'X') navDM -= 8;
    if (hxObj === 'HY') navDM += 2;
    if (base.navalBase) navDM += 4;
    if (base.militaryBase) navDM += 2;
    if (culE >= 1 && culE <= 5) navDM -= 2;
    if (culE >= 9 && culE <= 11) navDM += 2;
    if (culE >= 12) navDM += 4;
    if (milRisk) navDM += 2;
    let navRoll = roll2D() + globalDM + navDM;
    let bN = "0";
    if (navRoll >= 4) {
        let eff = navRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bN = toEHex(eff);
    }

    // Marines
    let marDM = 0;
    if (base.pop <= 5) marDM -= 4;
    if (base.tl <= 8) marDM -= 6;
    if (base.navalBase) marDM += 2;
    if (base.militaryBase) marDM += 2;
    if (bN === "0") marDM -= 6;
    if (bS === "0") marDM -= 6;
    if (culE >= 1 && culE <= 5) marDM -= 4;
    if (culE >= 9 && culE <= 11) marDM += 1;
    if (culE >= 12) marDM += 2;
    if (milRisk) marDM += 2;
    let marRoll = roll2D() + globalDM + marDM;
    let bMar = "0";
    if (marRoll >= 4) {
        let eff = marRoll - 4;
        if (eff < 1) eff = 1;
        if (eff > 18) eff = 18;
        bMar = toEHex(eff);
    }

    // Budget
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
    if ([0, 2, 4].includes(base.gov)) budDM -= 2;
    if (base.gov === 5) budDM += 1;
    if (base.gov === 9) budDM -= 1;
    if (base.gov === 10 || base.gov === 15) budDM += 3;
    if ([11, 12, 14].includes(base.gov)) budDM += 2;
    if (overallLaw >= 12) budDM += 2;
    if (base.militaryBase) budDM += 4;
    if (base.navalBase) budDM += 2;
    budDM += (culM - 5);
    budDM += (-4 + branchDrain);

    let rollFactor = roll2D() - 7 + budDM;
    if (rollFactor < -9) rollFactor = -9;

    let basicBudget = 2.0 * (1 + (ecoE / 10)) * (1 + (rollFactor / 10));
    let totalBudget = basicBudget * readinessMultiplier;
    let formatBudget = totalBudget.toFixed(2) + "%";

    let militaryProfile = `${bE}${bM}${bA}${bW}${bF}-${bS}${bN}${bMar}:${formatBudget}`;

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
        Im, ecoR, ecoL, ecoI, ecoE, RU, pcGWP, WTN, IR, DR,
        displayString: `Pop: ${pValue}x10^${base.pop} | PCR: ${pcr} | Urb: ${urbanPercent}% | MC: ${majorCities} (${totalMajorCityPop.toLocaleString()})\nGov: ${govProfile} | Fac: ${factionsString} | Law: ${lawProfile}\nTech: ${techProfile} | Cul: ${culturalProfile}\nEco: ${economicProfile} | Sp: ${starportProfile}\nMil: ${militaryProfile}`,
        displayStrings: [
            `Pop: ${pValue}x10^${base.pop} | PCR: ${pcr} | Urb: ${urbanPercent}% | MC: ${majorCities} (${totalMajorCityPop.toLocaleString()})`,
            `Gov: ${govProfile} | Fac: ${factionsString} | Law: ${lawProfile}`,
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

function convertAuToOrbit(au) {
    for (let i = 0; i < MGT2E_ORBIT_AU.length - 1; i++) {
        if (au >= MGT2E_ORBIT_AU[i] && au < MGT2E_ORBIT_AU[i + 1]) {
            let fraction = (au - MGT2E_ORBIT_AU[i]) / (MGT2E_ORBIT_AU[i + 1] - MGT2E_ORBIT_AU[i]);
            return i + fraction;
        }
    }
    return 20.0;
}

// Note: MGT2E_STAR_STATS is defined in constants.js

function rollMgT2EStar() {
    let roll = roll2D();
    let sClass = 'V';
    let sType = '';

    if (roll <= 2) { sType = 'M'; sClass = 'VI'; }
    else if (roll <= 6) sType = 'M';
    else if (roll <= 8) sType = 'K';
    else if (roll <= 10) sType = 'G';
    else if (roll == 11) sType = 'F';
    else { sType = 'A'; }

    let subType = roll1D() + roll1D() - 2;
    if (subType > 9) subType = 9;

    let stats = MGT2E_STAR_STATS[sType];
    let diam2 = stats.diam * stats.diam;
    let tempRatio = Math.pow(stats.temp / 5772, 4);
    let lum = diam2 * tempRatio;

    return { sClass, sType, subType, mass: stats.mass, diam: stats.diam, temp: stats.temp, lum, name: `${sType}${subType} ${sClass}` };
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

function determineMgT2EEccentricity(isStar, orbitsBeyondFirst, sysAgeGyr, orbitNum, isSignificantBody, anomalousEccMod) {
    let roll = roll2D();
    let sumRoll = roll;
    if (isStar) sumRoll += 2;
    sumRoll += orbitsBeyondFirst;
    if (sysAgeGyr > 1 && orbitNum < 1.0) sumRoll -= 1;
    if (isSignificantBody) sumRoll += 1;
    sumRoll += anomalousEccMod;

    let base = 0, fraction = 0;
    if (sumRoll <= 5) { base = -0.001; fraction = roll1D() / 1000; }
    else if (sumRoll <= 7) { base = 0.00; fraction = roll1D() / 200; }
    else if (sumRoll <= 9) { base = 0.03; fraction = roll1D() / 100; }
    else if (sumRoll === 10) { base = 0.05; fraction = roll1D() / 20; }
    else if (sumRoll === 11) { base = 0.05; fraction = roll2D() / 20; }
    else { base = 0.30; fraction = roll2D() / 20; }

    return Math.max(0, base + fraction);
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 1: STARS & SYSTEM INVENTORY
// =====================================================================

function generateMgT2ESystemChunk1(mainworldBase) {
    let sys = { stars: [], gasGiants: 0, planetoidBelts: 0, terrestrialPlanets: 0, totalWorlds: 0, hzco: 0, age: 0 };

    // =====================================================================
    // Step 1: Primary Star & System Age
    // =====================================================================
    let primary = rollMgT2EStar();
    primary.role = 'Primary';
    primary.separation = null;
    primary.orbitId = null;
    primary.eccentricity = 0;
    primary.mao = getMAO(primary.sType, primary.subType, primary.sClass);

    let msLifespan = 10 / Math.pow(primary.mass, 2.5);
    if (primary.mass < 0.9) {
        sys.age = (Math.floor(Math.random() * 6) + 1) * 2 + (Math.floor(Math.random() * 3) + 1) - 1 + (Math.floor(Math.random() * 10) / 10);
    } else {
        sys.age = msLifespan * ((Math.floor(Math.random() * 100) + 1) / 100);
    }
    sys.age = Math.max(0.1, sys.age);

    let hzcoAu = Math.sqrt(primary.lum);
    sys.hzco = convertAuToOrbit(hzcoAu);
    sys.stars.push(primary);

    // =====================================================================
    // Step 2: Companion Stars (Close, Near, Far + recursive Companions)
    // =====================================================================

    // Helper: compute presence roll DM based on a star's type/class
    function getMultiDM(star) {
        let dm = 0;
        if (['Ia', 'Ib', 'II', 'III', 'IV'].includes(star.sClass)) dm += 1;
        if (['V', 'VI'].includes(star.sClass) && ['O', 'B', 'A', 'F'].includes(star.sType)) dm += 1;
        if (['V', 'VI'].includes(star.sClass) && star.sType === 'M') dm -= 1;
        return dm;
    }

    // Helper: generate companion star quality from a parent star
    function rollCompanionQuality(parentStar) {
        let secRoll = roll2D();
        let companion;
        if (secRoll >= 10) {
            // Twin
            companion = JSON.parse(JSON.stringify(parentStar));
        } else if (secRoll >= 8) {
            // Sibling
            companion = JSON.parse(JSON.stringify(parentStar));
            companion.subType = Math.min(9, companion.subType + (Math.floor(Math.random() * 6) + 1));
        } else {
            // Lesser / Random / Other
            companion = rollMgT2EStar();
        }
        companion.mao = getMAO(companion.sType, companion.subType, companion.sClass);
        companion.name = `${companion.sType}${companion.subType} ${companion.sClass}`;
        return companion;
    }

    // Helper: roll stellar eccentricity (isStar=true adds +2 DM automatically)
    function rollStellarEcc(orbitId) {
        return determineMgT2EEccentricity(true, 0, sys.age, orbitId, false, 0);
    }

    // Class Ia/Ib/II/III primaries cannot have Close companions
    const canHaveClose = !['Ia', 'Ib', 'II', 'III'].includes(primary.sClass);
    const primaryDM = getMultiDM(primary);

    // Roll for Close, Near, and Far companion presence independently
    const separationDefs = [
        { sep: 'Close', orbitFn: () => { let r = roll1D() - 1; return r === 0 ? 0.5 : r; }, allowed: canHaveClose },
        { sep: 'Near', orbitFn: () => roll1D() + 5, allowed: true },
        { sep: 'Far', orbitFn: () => roll1D() + 11, allowed: true },
    ];

    for (const def of separationDefs) {
        if (!def.allowed) continue;
        if (roll2D() + primaryDM < 10) continue; // not present

        let companion = rollCompanionQuality(primary);
        companion.separation = def.sep;
        companion.role = `${def.sep} Companion`;
        companion.parentStarIdx = 0;
        companion.orbitId = def.orbitFn();
        companion.eccentricity = rollStellarEcc(companion.orbitId);
        sys.stars.push(companion);

        // Each Close/Near/Far star also rolls for its own tight Companion
        let compDM = getMultiDM(companion);
        if (roll2D() + compDM >= 10) {
            let tertiary = rollCompanionQuality(companion);
            tertiary.separation = 'Companion';
            tertiary.role = `${def.sep} Star's Companion`;
            tertiary.parentStarIdx = sys.stars.length - 1;
            // Companion formula: (1d6/10) + ((2d6-7)/100)
            tertiary.orbitId = (roll1D() / 10) + ((roll2D() - 7) / 100);
            tertiary.eccentricity = rollStellarEcc(tertiary.orbitId);
            sys.stars.push(tertiary);
        }
    }

    // =====================================================================
    // Step 3: Total Worlds Inventory (GG + PB + TP)
    // =====================================================================
    const multiStar = sys.stars.length >= 2;
    function rollD3() { return Math.ceil(roll1D() / 2); }

    // --- Gas Giants ---
    let existingGG = (mainworldBase && mainworldBase.gasGiant === true);
    let ggExists = existingGG || (roll2D() <= 9);
    if (ggExists) {
        let ggQ = roll2D();
        if (sys.stars.length === 1 && primary.sClass === 'V') ggQ += 1; // single Class V
        if (sys.stars.length >= 4) ggQ -= 1;
        if (ggQ <= 4) sys.gasGiants = 1;
        else if (ggQ <= 6) sys.gasGiants = 2;
        else if (ggQ <= 8) sys.gasGiants = 3;
        else if (ggQ <= 11) sys.gasGiants = 4;
        else if (ggQ === 12) sys.gasGiants = 5;
        else sys.gasGiants = 6;
    }

    // --- Planetoid Belts ---
    let pbExists = (roll2D() >= 8);
    if (pbExists) {
        let pbQ = roll2D();
        if (ggExists) pbQ += 1; // has gas giants
        if (multiStar) pbQ += 1; // two or more stars
        if (pbQ <= 6) sys.planetoidBelts = 1;
        else if (pbQ <= 11) sys.planetoidBelts = 2;
        else sys.planetoidBelts = 3;
    }
    // Continuation: mainworld is an asteroid belt → force at least 1 PB
    if (mainworldBase && mainworldBase.size === 0) {
        sys.planetoidBelts = Math.max(1, sys.planetoidBelts + 1);
    }

    // --- Terrestrial Planets ---
    let tpCount = roll2D() - 2;
    if (tpCount < 3) {
        tpCount = rollD3() + 2;   // reroll as D3+2 (range 3–5)
    } else {
        tpCount += rollD3() - 1;  // add D3-1 (0–2 more)
    }
    // Continuation: standard terrestrial mainworld counts as one TP
    if (mainworldBase && mainworldBase.size >= 1) {
        tpCount = Math.max(1, tpCount);
    }
    sys.terrestrialPlanets = tpCount;

    // --- Total Worlds ---
    sys.totalWorlds = sys.gasGiants + sys.planetoidBelts + sys.terrestrialPlanets;

    // --- Combined HZCO for circumbinary P-type worlds (Item #6) ---
    // Sum all star luminosities → sqrt → convert to Orbit#
    // For single-star systems this equals sys.hzco.
    let totalLum = sys.stars.reduce((sum, s) => sum + (s.lum || 0), 0);
    sys.ptypeHzco = sys.stars.length > 1 ? convertAuToOrbit(Math.sqrt(totalLum)) : sys.hzco;

    return sys;
}

// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 3: WORLD & MOON SIZING
// =====================================================================

function generateMgT2ESystemChunk3(sys, mainworldBase) {
    let primary = sys.stars[0];

    // 1. Size Terrestrial Planets & Gas Giants
    for (let i = 0; i < sys.worlds.length; i++) {
        let w = sys.worlds[i];
        w.moons = [];
        w.rings = [];

        if (w.type === 'Empty' || w.type === 'Planetoid Belt') continue;

        if (w.type === 'Gas Giant') {
            let catRoll = roll1D();
            if (catRoll <= 2) {
                w.ggType = 'GS';
                w.diameterStr = `${roll1D() + roll1D()} (GS)`;
                w.mass = 5 * (roll1D() + 1);
                w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
            } else if (catRoll <= 4) {
                w.ggType = 'GM';
                w.diameterStr = `${roll1D() + 6} (GM)`;
                w.mass = 20 * (roll3D() - 1);
                w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
            } else {
                w.ggType = 'GL';
                w.diameterStr = `${roll2D() + 6} (GL)`;
                let initMass = roll3D();
                let d3Multiplier = Math.floor(Math.random() * 3) + 1;
                w.mass = d3Multiplier * 50 * (initMass + 4);
                if (w.mass >= 3000 || initMass >= 15) {
                    w.mass = 4000 - ((roll2D() - 2) * 200);
                }
                w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
            }
            w.size = 'GG';
        } else if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            if (w.type === 'Mainworld' && mainworldBase && mainworldBase.size !== undefined) {
                w.size = mainworldBase.size;
            } else {
                let sizeCat = roll1D();
                if (sizeCat <= 2) w.size = roll1D();
                else if (sizeCat <= 4) w.size = roll2D();
                else w.size = roll2D() + 3;
            }
            w.diamKm = w.size * 1600;
            w.mass = w.size === 0 ? 0.0001 : Math.pow(w.size / 8, 3);
        } else if (w.type === 'Planetoid Belt') {
            w.bulk = roll1D();
            w.mType = roll1D() * 10;
            w.cType = roll1D() * 10;
            w.sType = Math.max(0, 100 - w.mType - w.cType);
            w.size = 0;
        }
    }

    // 2. Determine Moon Quantities & Sizes
    for (let i = 0; i < sys.worlds.length; i++) {
        let w = sys.worlds[i];
        if (w.type === 'Empty' || w.type === 'Planetoid Belt') continue;

        let qRoll = 0;
        if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            if (w.size <= 2) qRoll = roll1D();
            else if (w.size <= 9) qRoll = roll2D();
            else qRoll = roll2D();
        } else {
            if (w.ggType === 'GS') qRoll = roll3D();
            else qRoll = roll4D();
        }

        let qMod = 0;
        if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
            if (w.size <= 2) qMod -= 5;
            else if (w.size <= 9) qMod -= 8;
            else qMod -= 6;
        } else {
            if (w.ggType === 'GS') qMod -= 7;
            else qMod -= 6;
        }

        let dmDiceCount = (w.size <= 2) ? 1 : (w.size <= 9 ? 2 : (w.size <= 15 ? 2 : (w.ggType === 'GS' ? 3 : 4)));
        let hasPlacementDM = false;
        if (w.orbitId < 1.0) hasPlacementDM = true;
        if (hasPlacementDM) qMod -= dmDiceCount;

        if (['M', 'L', 'T', 'Y'].includes(primary.sType) && ['V', 'VI'].includes(primary.sClass)) qMod -= 1;

        let moonsToGenerate = qRoll + qMod;
        if (moonsToGenerate === 0) {
            w.rings.push({});
            moonsToGenerate = 0;
        } else if (moonsToGenerate < 0) {
            moonsToGenerate = 0;
        }

        for (let m = 0; m < moonsToGenerate; m++) {
            let moonSize = '';
            let r1 = roll1D();
            if (r1 <= 3) moonSize = 'S';
            else if (r1 <= 5) {
                let ms = Math.floor(Math.random() * 3);
                if (ms === 0) moonSize = 'R'; else moonSize = ms;
            } else {
                if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                    if (w.size === 1) moonSize = 'S';
                    else {
                        let trySize = w.size - 1 - roll1D();
                        if (trySize < 0) moonSize = 'S';
                        else if (trySize === 0) moonSize = 'R';
                        else if (trySize === w.size - 2) {
                            let twinRoll = roll2D();
                            if (twinRoll === 12) moonSize = w.size;
                            else if (twinRoll === 2) moonSize = trySize - 1;
                            else moonSize = trySize;
                            if (moonSize <= 0) moonSize = 'S';
                        } else {
                            moonSize = trySize;
                        }
                    }
                } else {
                    let specialR = roll1D();
                    if (specialR <= 3) moonSize = roll1D();
                    else if (specialR <= 5) {
                        let z = roll2D() - 2;
                        moonSize = z === 0 ? 'R' : z;
                    } else {
                        let giantMoon = roll2D() + 4;
                        if (giantMoon >= 16) {
                            moonSize = 'GS';
                            if (w.ggType === 'GL' && roll2D() === 12) moonSize = 'GM';
                        } else {
                            moonSize = giantMoon;
                        }
                    }
                }
            }

            if (moonSize === 'R') w.rings.push({});
            else w.moons.push({ size: moonSize });
        }

        // 3. Hill Sphere & Roche Limit
        if (w.mass > 0 && w.diamKm > 0) {
            let solMass = w.mass * 0.000003;
            let mStar = primary.mass;
            let hsAu = w.au * (1 - w.eccentricity) * Math.pow(solMass / (3 * mStar), 0.3333);
            let hsPd = hsAu * 149597870.9 / w.diamKm;
            let hillLimit = Math.floor(hsPd / 2);

            w.hillSpanPd = hillLimit;

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

function getMgT2EAlbedo(w, hzco) {
    let albedo = 0;
    let diff = w.orbitId - hzco;
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
    let processBody = (w, parent, isMoon) => {
        if (w.type === 'Empty' || w.type === 'Planetoid Belt') return;

        // 1. Sidereal Day
        w.siderealHours = (roll2D() - 2) * 4 + 2 + roll1D() + Math.floor(sys.age / 2);
        if (w.type === 'Gas Giant' || w.size === 0 || w.size === 'S') w.siderealHours *= 2;

        let extRoll = w.siderealHours;
        while (extRoll >= 40) {
            if (roll1D() >= 5) {
                let bonus = (roll2D() - 2) * 4 + 2 + roll1D() + Math.floor(sys.age / 2);
                if (w.type === 'Gas Giant' || w.size === 0 || w.size === 'S') bonus *= 2;
                w.siderealHours += bonus;
                extRoll = bonus;
            } else {
                break;
            }
        }
        w.siderealHours += ((roll1D() - 1) / 60) + ((Math.floor(Math.random() * 10)) / 3600);

        // 2. Solar Day
        let pYears = w.periodYears;
        if (isMoon) {
            if (!w.periodYears) {
                w.periodYears = (roll2D() + roll2D()) / 365.25;
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

        // 3. Axial Tilt
        w.axialTilt = generateMgT2EAxialTilt();

        // 4. Tidal Lock
        let lockDM = Math.ceil((w.size === 'GG' ? 10 : w.size) / 3);
        if (w.eccentricity) lockDM -= Math.floor(w.eccentricity * 10);
        if (w.pressureBar > 2.5) lockDM -= 2;
        if (sys.age < 1) lockDM -= 2;
        else if (sys.age >= 5 && sys.age <= 10) lockDM += 2;
        else if (sys.age > 10) lockDM += 4;

        if (w.axialTilt > 30) lockDM -= 2;
        if (w.axialTilt >= 60 && w.axialTilt <= 120) lockDM -= 4;
        if (w.axialTilt >= 80 && w.axialTilt <= 100) lockDM -= 4;

        if (isMoon) lockDM += 6;
        else lockDM += (w.orbitId <= 0.5 ? 4 : 0);

        w.tidallyLocked = false;
        if (lockDM >= 10) {
            let forceLock = true;
            if (roll2D() === 12 && roll2D() < 12) forceLock = false;
            if (forceLock) w.tidallyLocked = true;
        } else if (lockDM > -10 && !w.tidallyLocked) {
            let lockRoll = roll2D() + lockDM;
            if (lockRoll >= 12) w.tidallyLocked = true;
            else if (lockRoll === 11) w.siderealHours = w.yearHours * (2 / 3);
            else if (lockRoll === 10) w.siderealHours = roll1D() * 50 * 24;
            else if (lockRoll === 9) w.siderealHours = roll1D() * 10 * 24;
            else if (lockRoll === 8) w.siderealHours = roll1D() * 20 * 24;
            else if (lockRoll === 7) w.siderealHours = roll1D() * 5 * 24;
            else if (lockRoll === 6) w.siderealHours *= 5;
            else if (lockRoll === 5) w.siderealHours *= 3;
            else if (lockRoll === 4) w.siderealHours *= 2;
            else if (lockRoll === 3) w.siderealHours *= 1.5;
        }

        if (w.tidallyLocked) {
            w.siderealHours = w.yearHours;
            w.axialTilt = Math.max(0, (roll2D() - 2) / 10);
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

        // 5. Mean Temperature
        w.albedo = getMgT2EAlbedo(w, sys.hzco);
        let initialGF = 0.5 * Math.sqrt(w.pressureBar || 0);

        let gfMod = 0;
        if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14].includes(w.atmCode)) gfMod = roll3D() * 0.01;
        let gfMult = 1;
        if (w.atmCode === 10 || w.atmCode === 15) gfMult = Math.max(0.5, roll1D() - 1);
        else if ([11, 12, 16, 17].includes(w.atmCode)) {
            let mx = roll1D();
            if (mx === 6) gfMult = roll3D();
            else gfMult = mx;
        }
        w.greenhouseFactor = (initialGF + gfMod) * gfMult;

        let srcLum = primary.lum || 1.0;
        if (w.au > 0) {
            let term1 = srcLum * (1 - w.albedo) * (1 + w.greenhouseFactor);
            let term2 = (w.au * w.au);
            w.meanTempK = 279 * Math.pow(term1 / term2, 0.25);
        } else {
            w.meanTempK = 3;
        }

        // 6. High/Low Temperatures
        let tfactor = Math.abs(Math.sin((w.axialTilt || 0) * Math.PI / 180));
        if (w.yearHours < (36.5 * 24)) tfactor /= 2;
        if (w.yearHours > (2 * 8760)) tfactor *= 1.5;

        let rfactor = w.solarDayHours <= 0 || w.solarDayHours === Infinity ? 1.0 : Math.sqrt(w.solarDayHours / 50);
        if (w.tidallyLocked) rfactor = 1.0;
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

    let processBody = (w, parent, isMoon) => {
        if (w.type === 'Empty' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

        // 1. Seismology and Tectonic Plates
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

        w.tectonicPlates = 0;
        w.plateInteraction = "None";
        if (w.seismicStress > 0 && w.hydroPercent >= 1) {
            let p = wSize + w.hydroCode - roll2D();
            if (w.seismicStress >= 10 && w.seismicStress <= 100) p += 1;
            else if (w.seismicStress > 100) p += 2;
            if (p > 1) {
                w.tectonicPlates = p;
                w.plateInteraction = MGT2E_PLATE_INTERACTIONS[roll2D()] || "None";
            }
        }

        // 2. Biomass Rating
        let biomassBase = 0;
        if (sys.age >= 0.1) {
            biomassBase = roll2D();
            let bDm = 0;
            if (w.atmCode === 0) bDm -= 6;
            else if (w.atmCode === 1) bDm -= 4;
            else if ([2, 3, 14].includes(w.atmCode)) bDm -= 3;
            else if ([4, 5].includes(w.atmCode)) bDm -= 2;
            else if ([8, 9, 13].includes(w.atmCode)) bDm += 2;
            else if (w.atmCode === 10) bDm -= 3;
            else if (w.atmCode === 11) bDm -= 5;
            else if (w.atmCode === 12) bDm -= 7;
            else if (w.atmCode >= 15) bDm -= 5;

            if (w.hydroCode === 0) bDm -= 4;
            else if (w.hydroCode >= 1 && w.hydroCode <= 3) bDm -= 2;
            else if (w.hydroCode >= 6 && w.hydroCode <= 8) bDm += 1;
            else if (w.hydroCode >= 9) bDm += 2;

            if (sys.age < 0.2) bDm -= 6;
            else if (sys.age < 1) bDm -= 2;
            else if (sys.age > 4) bDm += 1;

            if (w.highTempK > 353) bDm -= 2;
            else if (w.highTempK < 273) bDm -= 4;

            if (w.meanTempK > 353) bDm -= 4;
            else if (w.meanTempK < 273) bDm -= 2;
            else if (w.meanTempK >= 279 && w.meanTempK <= 303) bDm += 2;

            bDm = Math.max(-12, Math.min(4, bDm));
            biomassBase += bDm;

            if (biomassBase <= 0) biomassBase = 0;
            if (w.taints && w.taints.includes("Biologic") && biomassBase === 0) biomassBase = 1;

            if (biomassBase >= 1 && [0, 1, 10, 11, 12, 15].includes(w.atmCode)) {
                let extremophileBonus = 0;
                if (w.atmCode === 0) extremophileBonus = 5;
                else if (w.atmCode === 1) extremophileBonus = 3;
                else if (w.atmCode === 10) extremophileBonus = 2;
                else if (w.atmCode === 11) extremophileBonus = 4;
                else if (w.atmCode === 12) extremophileBonus = 6;
                else if (w.atmCode >= 15) extremophileBonus = 4;
                biomassBase += extremophileBonus;
            }
        }
        w.biomass = biomassBase;

        // 3. Biocomplexity Rating
        w.biocomplexity = 0;
        if (w.biomass >= 1) {
            let cDm = 0;
            if (w.atmCode < 4 || w.atmCode > 9) cDm -= 2;
            if (w.taints && w.taints.includes("Low Oxygen")) cDm -= 2;
            if (sys.age >= 3 && sys.age < 4) cDm -= 2;
            else if (sys.age >= 2 && sys.age < 3) cDm -= 4;
            else if (sys.age >= 1 && sys.age < 2) cDm -= 8;
            else if (sys.age < 1) cDm -= 10;

            let effBiomass = w.biomass >= 10 ? 9 : w.biomass;
            w.biocomplexity = Math.max(1, roll2D() - 7 + effBiomass + cDm);
        }

        // 4. Native Sophonts
        w.nativeSophont = false;
        w.extinctSophont = false;
        if (w.biocomplexity >= 8) {
            let effBiocomp = w.biocomplexity >= 10 ? 9 : w.biocomplexity;
            if ((roll2D() + effBiocomp - 7) >= 13) w.nativeSophont = true;

            let exDm = sys.age > 5 ? 1 : 0;
            if ((roll2D() + effBiocomp - 7 + exDm) >= 13) w.extinctSophont = true;
        }

        // 5. Biodiversity & Compatibility
        w.biodiversity = 0;
        w.compatibility = 0;
        if (w.biomass >= 1) {
            w.biodiversity = Math.max(1, Math.ceil(roll2D() - 7 + ((w.biomass + w.biocomplexity) / 2)));

            let compDm = 0;
            if ([0, 1, 11, 16, 17].includes(w.atmCode)) compDm -= 8;
            else if ([2, 4, 7, 9].includes(w.atmCode) || (w.taints && w.taints.length > 0)) compDm -= 2;
            else if ([3, 5, 8].includes(w.atmCode)) compDm += 1;
            else if (w.atmCode === 6) compDm += 2;
            else if ([10, 15].includes(w.atmCode)) compDm -= 6;
            else if (w.atmCode === 12) compDm -= 10;
            else if ([13, 14].includes(w.atmCode)) compDm -= 1;

            if (sys.age > 8) compDm -= 2;

            w.compatibility = Math.max(0, Math.floor(roll2D() - (w.biocomplexity / 2) + compDm));
        }

        w.lifeProfile = `${w.biomass.toString(16).toUpperCase()}${w.biocomplexity.toString(16).toUpperCase()}${w.biodiversity.toString(16).toUpperCase()}${w.compatibility.toString(16).toUpperCase()}`;
        if (w.biomass === 0) w.lifeProfile = "0000";

        // 6. Resource Rating
        let rDm = 0;
        if (density > 1.12) rDm += 2;
        if (density < 0.5) rDm -= 2;
        if (w.biomass >= 3) rDm += 2;
        if (w.biodiversity >= 8 && w.biodiversity <= 10) rDm += 1;
        else if (w.biodiversity >= 11) rDm += 2;

        if (w.compatibility >= 0 && w.compatibility <= 3) rDm -= 1;
        else if (w.compatibility >= 8) rDm += 2;

        w.resourceRating = Math.max(2, Math.min(12, roll2D() - 7 + wSize + rDm));

        // 7. Habitability Rating
        let hScore = 10;
        if (wSize >= 0 && wSize <= 4) hScore -= 1;
        if (wSize >= 9) hScore += 1;

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

        let grav = w.size === 'S' ? 0 : w.size * 0.125;
        w.gravity = grav;
        if (grav < 0.2) hScore -= 4;
        else if (grav >= 0.2 && grav < 0.4) hScore -= 2;
        else if (grav >= 0.4 && grav < 0.7) hScore -= 1;
        else if (grav >= 0.7 && grav <= 0.9) hScore += 1;
        else if (grav >= 1.1 && grav < 1.4) hScore -= 1;
        else if (grav >= 1.4 && grav <= 2.0) hScore -= 3;
        else if (grav > 2.0) hScore -= 6;

        w.habitability = Math.max(0, hScore);
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

    const toUWPChar = typeof globalThis.toUWPChar === 'function' ? globalThis.toUWPChar : (val) => val.toString(16).toUpperCase();

    function processBody(body, isMoon = false) {
        if (!body || body.type === 'Empty') return;

        // Skip Mainworld here (handled in main loop)
        if (body.type === 'Mainworld') return;

        // 1. Map properties for the Social helper
        body.size = (body.size === 'S' || body.size === 'R') ? 0 : (typeof body.size === 'number' ? body.size : 0);
        body.atm = body.atmCode !== undefined ? body.atmCode : 0;
        body.hydro = body.hydroCode !== undefined ? body.hydroCode : 0;

        // 2. Call the Subordinate Social Generator
        generateMgT2ESubordinateSocial(body, mainworldBase);

        // 3. Classification Logic (WBH Logic)
        body.classifications = [];
        const floor = getMgT2EMinSusTL(body.atm);
        const mw = mainworldBase;
        const diff = (body.orbitId !== undefined) ? (body.orbitId - sys.hzco) : 99;
        const isPoor = (mw.tradeCodes && mw.tradeCodes.includes("Po"));
        const isInd = (mw.tradeCodes && mw.tradeCodes.includes("In"));

        // Farming: HZCO ±1.0, Atm 4–9, Hydro 4–8, Pop 2+
        if (Math.abs(diff) <= 1.0 && (body.atm >= 4 && body.atm <= 9) && (body.hydro >= 4 && body.hydro <= 8) && body.pop >= 2) {
            body.classifications.push("Farming");
        }

        // Mining: MW Industrial, secondary Pop 2+. DM +4 if Planetoid Belt.
        if (isInd && body.pop >= 2) {
            let roll = roll2D();
            if (body.type === 'Planetoid Belt') roll += 4;
            if (roll >= 8) body.classifications.push("Mining");
        }

        // Research Base: MW Pop 6+, TL 8+, not "Poor". Occurs on 10+ (DM +2 if MW TL 12+).
        if (mw.pop >= 6 && mw.tl >= 8 && !isPoor) {
            let roll = roll2D() + (mw.tl >= 12 ? 2 : 0);
            if (roll >= 10) body.classifications.push("Research Base");
        }

        // Military Base: MW TL 8+, not "Poor", secondary Gov 6. Occurs on 12+.
        if (mw.tl >= 8 && !isPoor && body.gov === 6) {
            if (roll2D() >= 12) body.classifications.push("Military Base");
        }

        // Penal Colony: MW TL 9+, MW Law 8+, secondary Gov 6. Occurs on 10+.
        if (mw.tl >= 9 && mw.law >= 8 && body.gov === 6) {
            if (roll2D() >= 10) body.classifications.push("Penal Colony");
        }

        // 4. Refine Tech Level (Classification Bonuses)
        if (body.classifications.includes("Research Base") || body.classifications.includes("Military Base")) {
            body.tl = mw.tl;
        } else if (body.classifications.includes("Mining")) {
            body.tl = Math.max(mw.tl, floor);
        } else {
            body.tl = Math.max(mw.tl - 1, floor);
        }

        // 5. Final UWP Construction
        // Planetoid Belts usually use size 0
        const charSize = toUWPChar(body.size);
        const uwp = `${body.starport}${charSize}${toUWPChar(body.atm)}${toUWPChar(body.hydro)}${toUWPChar(body.pop)}${toUWPChar(body.gov)}${toUWPChar(body.law)}-${toUWPChar(body.tl)}`;

        body.uwp = uwp;
        body.uwpSecondary = uwp;

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

    return sys;
}


// =====================================================================
// MGT2E SYSTEM GENERATION - CHUNK 4: ATMOSPHERE & HYDROGRAPHICS
// =====================================================================

function getTempBand(orbitId, hzco) {
    let diff = orbitId - hzco;
    if (diff <= -2.01) return "Boiling";
    if (diff <= -1.01) return "Hot";
    if (diff <= 1.00) return "Temperate";
    if (diff <= 3.00) return "Cold";
    return "Frozen";
}

function generateMgT2ESystemChunk4(sys, mainworldBase) {
    let processWorld = (w) => {
        if (w.type === 'Empty' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

        let tempBand = getTempBand(w.orbitId, sys.hzco);

        // 1. Base Atmosphere Code
        if (w.size === 'S' || w.size <= 1) {
            w.atmCode = 0;
        } else if (w.type === 'Mainworld' && mainworldBase && mainworldBase.atm !== undefined) {
            w.atmCode = mainworldBase.atm;
        } else {
            let baseRoll = roll2D() - 7 + w.size;
            let diff = w.orbitId - sys.hzco;

            if (diff >= -1.00 && diff <= 1.00) {
                w.atmCode = Math.max(0, baseRoll);
            } else if (diff < -1.00) {
                w.atmCode = tempBand === "Boiling" ? (baseRoll <= 1 ? 0 : baseRoll <= 3 ? 1 : baseRoll <= 8 ? 10 : baseRoll <= 11 ? 11 : 12)
                    : (baseRoll <= 0 ? 0 : baseRoll <= 1 ? 1 : baseRoll <= 10 ? 10 : baseRoll <= 11 ? 11 : 12);
            } else {
                w.atmCode = tempBand === "Cold" ? (baseRoll <= 2 ? 1 : baseRoll <= 10 ? 10 : baseRoll <= 11 ? 11 : 12)
                    : (baseRoll <= 2 ? 1 : baseRoll <= 10 ? 10 : baseRoll <= 11 ? 11 : 12);
            }
        }

        if (w.atmCode > 15) w.atmCode = 15;
        if (w.atmCode < 0) w.atmCode = 0;

        // 2. Runaway Greenhouse
        if (w.atmCode >= 2 && w.atmCode <= 15 && (tempBand === "Hot" || tempBand === "Boiling")) {
            let rgDM = Math.ceil(sys.age);
            if (tempBand === "Boiling") rgDM += 4;
            if ((roll2D() + rgDM) >= 12) {
                w.runawayGreenhouse = true;
                tempBand = "Boiling";
                if ((w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14) {
                    let rRoll = roll1D();
                    if (w.size >= 2 && w.size <= 5) rRoll -= 2;
                    if ([2, 4, 7, 9].includes(w.atmCode)) rRoll += 1;
                    w.atmCode = rRoll <= 1 ? 10 : (rRoll <= 4 ? 11 : 12);
                }
            }
        }

        let gravity = w.size === 0 ? 0 : w.size * 0.125;

        // 3 & 4. Standard Atmospheres (2-9, D, E)
        if ((w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14) {
            let cdata = MGT2E_ATM_CODES[w.atmCode];
            w.pressureBar = cdata.minP + (cdata.spanP * (Math.random()));

            let o2Roll = roll1D() - 1 + (sys.age > 4 ? 1 : 0);
            w.oxygenFrac = Math.max(0.01, (o2Roll / 20) + (Math.floor(Math.random() * 10) / 100));
            w.ppo = w.oxygenFrac * w.pressureBar;
            w.scaleHeight = gravity > 0 ? 8.5 / gravity : 0;

            w.taints = [];
            if (w.ppo < 0.1) w.taints.push("Low Oxygen");
            if (w.ppo > 0.5) w.taints.push("High Oxygen");

            if ([2, 4, 7, 9].includes(w.atmCode)) {
                let tRoll = roll2D();
                if (w.atmCode === 4) tRoll -= 2;
                if (w.atmCode === 9) tRoll += 2;
                let t = MGT2E_TAINT_SUBTYPES[Math.max(2, Math.min(12, tRoll))];
                if (t && !w.taints.includes(t)) w.taints.push(t);
            }

            if (w.taints.length > 0) {
                w.taintSeverity = MGT2E_TAINT_SEVERITY[Math.max(1, Math.min(9, roll2D()))];
            }

            if (w.atmCode === 13) {
                let badRatioO2 = w.oxygenFrac > 0 ? w.ppo / 0.5 : 1;
                let badRatioN2 = (w.pressureBar - w.ppo) / 2.0;
                let badRatio = Math.max(badRatioO2, badRatioN2);
                if (badRatio > 1 && w.scaleHeight > 0) w.safeAlt = Math.log(badRatio) * w.scaleHeight;
            }
            if (w.atmCode === 14 && w.ppo > 0) {
                let badRatio = 0.1 / w.ppo;
                if (badRatio > 1 && w.scaleHeight > 0) w.safeAltBelowMean = Math.log(badRatio) * w.scaleHeight;
            }
        }
        else if (w.atmCode >= 10 && w.atmCode <= 12) {
            let cdata = MGT2E_ATM_CODES[w.atmCode];
            w.pressureBar = (roll2D() / 2);
            w.gases = ["Carbon Dioxide", "Sulphur Dioxide"];
        } else if (w.atmCode <= 1) {
            w.pressureBar = MGT2E_ATM_CODES[w.atmCode].minP;
        }

        // 6. Hydrographics
        w.hydroCode = 0;
        if (w.type === 'Mainworld' && mainworldBase && mainworldBase.hydro !== undefined) {
            w.hydroCode = mainworldBase.hydro;
        } else if (!['S', 0, 1].includes(w.size)) {
            let hMod = 0;
            if ([0, 1, 10, 11, 12, 15].includes(w.atmCode)) hMod -= 4;
            if (tempBand === "Hot" && w.atmCode !== 13) hMod -= 2;
            if (tempBand === "Boiling" && w.atmCode !== 13) hMod -= 6;

            w.hydroCode = Math.max(0, Math.min(10, roll2D() - 7 + w.atmCode + hMod));
        }

        w.hydroPercent = MGT2E_HYDRO_RANGES[w.hydroCode] + Math.floor(Math.random() * 10);
        if (w.hydroCode === 0) w.hydroPercent = Math.floor(Math.random() * 6);

        let distRoll = Math.max(0, Math.min(10, roll2D() - 2));
        w.surfaceDist = MGT2E_SURFACE_DISTS[distRoll];
        w.liquidType = "Water";

        if (w.atmCode >= 10 && w.atmCode <= 12 && w.hydroPercent > 0) {
            if (tempBand === "Boiling" || tempBand === "Hot") w.liquidType = "Sulphuric Acid";
            if (tempBand === "Cold" || tempBand === "Frozen") w.liquidType = "Methane";
        }
        w.tempBand = tempBand;
    };

    for (let i = 0; i < sys.worlds.length; i++) {
        processWorld(sys.worlds[i]);
        for (let j = 0; j < sys.worlds[i].moons.length; j++) {
            let fauxMoon = Object.assign({}, sys.worlds[i].moons[j]);
            fauxMoon.orbitId = sys.worlds[i].orbitId;
            fauxMoon.type = 'Terrestrial Planet';
            processWorld(fauxMoon);
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

    // Helper table for HZ deviation
    const MGT2E_HZ_DEVIATION = {
        2: 1.1, 3: 1.0, 4: 0.5, 5: 0.2, 6: 0.1,
        7: 0.0, 8: -0.1, 9: -0.2, 10: -0.5, 11: -1.0, 12: -1.1
    };

    // =====================================================================
    // Baseline / HZ orbit (same logic as before)
    // =====================================================================
    let totalWorldsToPlace = sys.gasGiants + sys.planetoidBelts + sys.terrestrialPlanets + 1;

    let blRoll = roll2D();
    if (sys.stars.length > 1) blRoll -= 2;
    if (['Ia', 'Ib', 'II'].includes(primary.sClass)) blRoll += 3;
    else if (primary.sClass === 'III') blRoll += 2;
    else if (primary.sClass === 'IV') blRoll += 1;
    else if (primary.sClass === 'VI') blRoll -= 1;

    if (totalWorldsToPlace < 6) blRoll -= 4;
    else if (totalWorldsToPlace <= 9) blRoll -= 3;
    else if (totalWorldsToPlace <= 12) blRoll -= 2;
    else if (totalWorldsToPlace <= 15) blRoll -= 1;
    else if (totalWorldsToPlace <= 20) blRoll += 1;
    else blRoll += 2;

    let mwAtm = mainworldBase ? mainworldBase.atm : 0;
    let atmDM = 0;
    if ([2, 3].includes(mwAtm)) atmDM = -2;
    else if ([4, 5, 14].includes(mwAtm)) atmDM = -1;
    else if ([8, 9].includes(mwAtm)) atmDM = 1;
    else if ([10, 13, 15].includes(mwAtm)) atmDM = 2;
    else if ([11, 12].includes(mwAtm)) atmDM = 6;

    let rawHzRoll = Math.max(2, Math.min(12, 7 - atmDM));
    let hzDeviation = MGT2E_HZ_DEVIATION[rawHzRoll];

    let variance = (Math.floor(Math.random() * 10)) / 100;
    if (hzDeviation < 0) hzDeviation -= variance;
    else if (hzDeviation > 0) hzDeviation += variance;
    else hzDeviation += (Math.random() < 0.5 ? 1 : -1) * variance;

    let baselineOrbit = sys.hzco + hzDeviation;

    let eRoll = roll2D();
    let emptyOrbitsCount = (eRoll <= 9) ? 0 : (eRoll - 9);

    // =====================================================================
    // Part 2A: Forbidden Zone Calculation
    // =====================================================================
    let mergedFZ = [];
    let primaryMao = getMAO(primary.sType, primary.subType, primary.sClass);
    let primaryInnerLimit = primaryMao;

    // Close/Near/Far companions that directly orbit the primary
    let directCompanions = sys.stars.filter(s => s.parentStarIdx === 0 && s.separation !== 'Companion');
    directCompanions.sort((a, b) => a.orbitId - b.orbitId);

    if (directCompanions.length > 0) {
        let innerPush = 0.50 + (directCompanions[0].eccentricity || 0);
        if (primaryMao > 0.2) innerPush += primaryMao;
        primaryInnerLimit = Math.max(primaryInnerLimit, innerPush);
    }

    let rawFZ = [];
    for (let comp of directCompanions) {
        let co = comp.orbitId;
        let cm = comp.mao || 0;
        let ce = comp.eccentricity || 0;
        let isInner = (comp.separation === 'Close' || comp.separation === 'Near');
        let fmin = co - 1.00, fmax = co + 1.00;
        if (cm > 0.2) { fmin -= cm; fmax += cm; }
        if (ce > 0.2) { fmin -= 1.00; fmax += 1.00; }
        if (isInner && ce > 0.5) { fmin -= 1.00; fmax += 1.00; }
        rawFZ.push({ min: fmin, max: fmax });
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
    let primaryTotalOrbits = Math.max(0, Math.floor(bw(primaryBands) + (directCompanions.length === 0 ? 1 : 0)));

    const sepOrder = ['Close', 'Near', 'Far'];
    let secondaryMeta = [];
    for (let si = 1; si < sys.stars.length; si++) {
        let s = sys.stars[si];
        if (s.separation === 'Companion') continue;
        let sInner = s.mao || 0.01;
        let sTight = sys.stars.find(sc => sc.parentStarIdx === si && sc.separation === 'Companion');
        if (sTight) sInner = Math.max(sInner, 0.50 + (sTight.eccentricity || 0));
        let sOuter = (s.orbitId || 0) - 3.00;
        let sIdx = sepOrder.indexOf(s.separation);
        for (let aj = 1; aj < sys.stars.length; aj++) {
            if (aj === si) continue;
            let ot = sys.stars[aj];
            if (ot.separation === 'Companion') continue;
            let oi = sepOrder.indexOf(ot.separation);
            if (Math.abs(sIdx - oi) === 1) {
                sOuter -= 1.00;
                if ((ot.eccentricity || 0) > 0.2) sOuter -= 1.00;
            }
        }
        let sEcc = s.eccentricity || 0;
        if (sEcc > 0.2) sOuter -= 1.00;
        if (sEcc > 0.5) sOuter -= 1.00;
        if (sOuter <= sInner) continue;
        let sBands = [{ min: sInner, max: sOuter }];
        let sTotalOrbits = Math.max(0, Math.floor(bw(sBands) + 1));
        secondaryMeta.push({ starIdx: si, star: s, bands: sBands, totalOrbits: sTotalOrbits });
    }

    // =====================================================================
    // Part 2C: World Distribution
    // =====================================================================
    let systemTotalOrbits = Math.max(1, primaryTotalOrbits + secondaryMeta.reduce((s, m) => s + m.totalOrbits, 0));
    let worldsToDistribute = sys.totalWorlds;
    let primaryAssigned = Math.ceil(worldsToDistribute * (primaryTotalOrbits / systemTotalOrbits));
    let distributed = [{ starIdx: 0, bands: primaryBands, mao: primaryInnerLimit, assigned: primaryAssigned, isMainStar: true }];
    let remaining = worldsToDistribute - primaryAssigned;
    for (let mi = 0; mi < secondaryMeta.length; mi++) {
        let meta = secondaryMeta[mi];
        let assigned = mi === secondaryMeta.length - 1 ? remaining :
            Math.floor(worldsToDistribute * (meta.totalOrbits / systemTotalOrbits));
        remaining -= assigned;
        distributed.push({ starIdx: meta.starIdx, bands: meta.bands, mao: meta.star.mao || 0.01, assigned: Math.max(0, assigned), isMainStar: false });
    }

    // =====================================================================
    // Part 2D: Slot Generation (forbidden-zone aware)
    // =====================================================================
    function skipFZ(orbit, fzList) {
        for (let pass = 0; pass < 10; pass++) {
            let ok = true;
            for (let fz of fzList) {
                if (orbit >= fz.min && orbit <= fz.max) { orbit = fz.max + 0.01; ok = false; }
            }
            if (ok) break;
        }
        return orbit;
    }

    function genSlots(bands, maoInner, numSlots, fzList) {
        if (!bands.length || numSlots <= 0) return [];
        let outer = bands[bands.length - 1].max;
        let spread = Math.max(0.1, bw(bands) / Math.max(1, numSlots));
        let slots = [];
        let cur = skipFZ(maoInner + spread * 0.5 + ((roll2D() - 7) * 0.05 * spread), fzList);
        for (let i = 0; i < numSlots * 3 && slots.length < numSlots; i++) {
            if (bands.some(b => cur >= b.min && cur <= b.max) && cur <= outer) slots.push(cur);
            cur = skipFZ(cur + spread + ((roll2D() - 7) * 0.1 * spread), fzList);
            if (cur > outer) break;
        }
        return slots;
    }

    // =====================================================================
    // Part 2E: Place & Tag Worlds
    // =====================================================================
    let allPlacedWorlds = [];

    // P-type inner stability limit (WBH formula, Item #5):
    let ptypeInnerLimit = Infinity;
    if (directCompanions.length > 0) {
        let outerComp = directCompanions[directCompanions.length - 1]; // outermost
        ptypeInnerLimit = outerComp.orbitId + 0.50 + (outerComp.eccentricity || 0)
            + (primaryMao > 0.2 ? primaryMao : 0);
    }
    sys.ptypeInnerLimit = ptypeInnerLimit;

    function getOrbitType(orbitNum, starIdx) {
        if (starIdx !== 0) return 'S-Type'; // secondary worlds are always S-Type
        return orbitNum >= ptypeInnerLimit ? 'P-Type' : 'S-Type';
    }

    for (let de of distributed) {
        let { starIdx, bands, mao: starMao, assigned, isMainStar } = de;
        if (assigned <= 0 && !isMainStar) continue;

        let ggBudget = starIdx === 0 ? sys.gasGiants : Math.min(sys.gasGiants, Math.round(sys.gasGiants * assigned / Math.max(1, worldsToDistribute)));
        let pbBudget = starIdx === 0 ? sys.planetoidBelts : Math.min(sys.planetoidBelts, Math.round(sys.planetoidBelts * assigned / Math.max(1, worldsToDistribute)));
        let tpBudget = Math.max(0, assigned - ggBudget - pbBudget);

        let slots = genSlots(bands, starMao, assigned, starIdx === 0 ? mergedFZ : []);
        let pool = [...slots];
        function pullSlot() {
            if (!pool.length) return bands.length ? bands[bands.length - 1].max + 1 : 99;
            return pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        }

        // Mainworld (primary star only)
        if (isMainStar) {
            let mwSlot = skipFZ(baselineOrbit, mergedFZ);
            if (!primaryBands.some(b => mwSlot >= b.min && mwSlot <= b.max) && primaryBands.length > 0) {
                mwSlot = primaryBands.reduce((best, b) => {
                    let mid = (b.min + b.max) / 2;
                    return Math.abs(mid - baselineOrbit) < Math.abs(best - baselineOrbit) ? mid : best;
                }, (primaryBands[0].min + primaryBands[0].max) / 2);
            }
            allPlacedWorlds.push({
                type: 'Mainworld', orbitId: mwSlot,
                isAsteroid: !!(mainworldBase && mainworldBase.size === 0),
                parentStarIdx: 0, orbitType: getOrbitType(mwSlot, 0), moons: []
            });
            let ci = pool.reduce((bi, s, i) => Math.abs(s - mwSlot) < Math.abs(pool[bi] - mwSlot) ? i : bi, 0);
            if (pool.length) pool.splice(ci, 1);
        }

        for (let i = 0; i < emptyOrbitsCount; i++)
            allPlacedWorlds.push({ type: 'Empty', orbitId: pullSlot(), parentStarIdx: starIdx, orbitType: 'S-Type', moons: [] });

        for (let i = 0; i < ggBudget; i++) {
            let ob = pullSlot();
            allPlacedWorlds.push({ type: 'Gas Giant', orbitId: ob, parentStarIdx: starIdx, orbitType: getOrbitType(ob, starIdx), moons: [] });
        }
        let finalPBBudget = isMainStar && mainworldBase && mainworldBase.size === 0 ? Math.max(1, pbBudget) : pbBudget;
        for (let i = 0; i < finalPBBudget; i++) {
            let ob = pullSlot();
            allPlacedWorlds.push({ type: 'Planetoid Belt', orbitId: ob, isAsteroid: true, parentStarIdx: starIdx, orbitType: getOrbitType(ob, starIdx), moons: [] });
        }
        let actualTPs = tpBudget;
        if (isMainStar && mainworldBase && mainworldBase.size >= 1) actualTPs = Math.max(0, actualTPs - 1);
        for (let i = 0; i < actualTPs; i++) {
            let ob = pullSlot();
            allPlacedWorlds.push({ type: 'Terrestrial Planet', orbitId: ob, parentStarIdx: starIdx, orbitType: getOrbitType(ob, starIdx), moons: [] });
        }
    }

    // =====================================================================
    // Part 2F: Eccentricities, AU, Orbital Period
    // =====================================================================
    allPlacedWorlds.sort((a, b) => a.orbitId - b.orbitId);
    for (let w of allPlacedWorlds) {
        if (w.type === 'Empty') { sys.worlds.push(w); continue; }

        let baseEcc = w.isAsteroid ? 0 : determineMgT2EEccentricity(false, 0, sys.age, w.orbitId, false, 0);
        w.eccentricity = baseEcc;

        // Convert orbit number to AU
        let auInt = Math.floor(w.orbitId);
        let auFrac = w.orbitId - auInt;
        let maxIdx = MGT2E_ORBIT_AU.length - 1;
        let limitIdx = Math.min(auInt, maxIdx);
        let auTarget = MGT2E_ORBIT_AU[limitIdx];
        let auDiff = limitIdx < maxIdx ? (MGT2E_ORBIT_AU[limitIdx + 1] - MGT2E_ORBIT_AU[limitIdx]) : auTarget;
        w.au = auTarget + (auFrac * auDiff);

        let parentStar = sys.stars[w.parentStarIdx] || primary;
        w.periodYears = Math.sqrt(Math.pow(w.au, 3) / parentStar.mass);
        sys.worlds.push(w);
    }

    return sys;
}
