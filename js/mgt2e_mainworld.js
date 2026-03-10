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
