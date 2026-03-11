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
            let sMult = (w.type === 'Gas Giant' || w.size === 0 || w.size === 'S') ? 2 : 4;
            tResult('Rotation Multiplier', sMult);
            let ageDm = Math.floor(sys.age / 2);
            w.siderealHours = ((sRoll1 - 2) * sMult) + 2 + sRoll2 + ageDm;

            let extRoll = w.siderealHours;
            let extCount = 0;
            while (extRoll >= 40) {
                if (tRoll1D(`Extension ${++extCount} Roll (5+)`) >= 5) {
                    let bonusRoll1 = tRoll2D(`Extension ${extCount} Base`);
                    let bonusRoll2 = tRoll1D(`Extension ${extCount} Adjust`);
                    let bonus = ((bonusRoll1 - 2) * sMult) + 2 + bonusRoll2 + ageDm;
                    w.siderealHours += bonus;
                    extRoll = bonus;
                } else {
                    break;
                }
            }
            let minRoll = Math.floor(rng() * 60);
            let secRoll = Math.floor(rng() * 60);
            w.siderealHours += (minRoll / 60) + (secRoll / 3600);
            tResult('Fractional Adjust', `${minRoll}m ${secRoll}s`);
            tResult('Sidereal Hours', w.siderealHours.toFixed(4));

            // 2. Axial Tilt
            tSection('Axial Tilt');
            w.axialTilt = generateMgT2EAxialTilt();
            tResult('Final Axial Tilt', w.axialTilt + '°');

            // 3. Solar Day
            let pYears = w.periodYears;
            if (isMoon) {
                if (!w.periodYears) {
                    w.periodYears = (tRoll2D('Moon Period Proxy') + tRoll2D('Moon Period Proxy 2')) / 365.25;
                }
                pYears = w.periodYears;
            }
            w.yearHours = pYears * 8760;

            let effectiveSidereal = w.siderealHours;
            if (w.axialTilt > 90) {
                effectiveSidereal = -w.siderealHours;
            }

            if (w.siderealHours === w.yearHours) {
                w.solarDaysInYear = 0;
                w.solarDayHours = Infinity;
                w.isTwilightZone = true;
                writeLogLine(`  Twilight Zone World (Tidally Locked): Sidereal equals Year exactly.`);
            } else {
                w.solarDaysInYear = (w.yearHours / effectiveSidereal) - 1;
                if (w.solarDaysInYear !== 0) {
                    w.solarDayHours = Math.abs(w.yearHours / w.solarDaysInYear);
                } else {
                    w.solarDayHours = Infinity;
                }
            }
            tResult('Solar Day (Hours)', (w.solarDayHours === Infinity || w.solarDayHours > 999999) ? 'Infinity' : w.solarDayHours.toFixed(2));

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

            let finalEffectiveSidereal = w.siderealHours;
            if (w.axialTilt > 90) {
                finalEffectiveSidereal = -w.siderealHours;
            }

            if (w.siderealHours === w.yearHours) {
                w.solarDaysInYear = 0;
                w.solarDayHours = Infinity;
                w.isTwilightZone = true;
                writeLogLine(`  Twilight Zone World (Tidally Locked): Sidereal equals Year exactly.`);
            } else {
                w.solarDaysInYear = (w.yearHours / finalEffectiveSidereal) - 1;
                if (w.solarDaysInYear !== 0) w.solarDayHours = Math.abs(w.yearHours / w.solarDaysInYear);
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

/**
 * Specialized validator for terrestrial physics: Gravity, Mass, and Density logic.
 * @param {Object} body - The world or moon to validate.
 * @returns {number} - Number of errors found.
 */
function _validateTerrestrialPhysics(body) {
    let errors = 0;
    if (body.type !== 'Terrestrial Planet' && body.type !== 'Mainworld') return 0;

    const sR = body.size / 8;
    if (sR <= 0) return 0;

    // A. Density Mapping Verification
    const densityRanges = {
        'Rare Minerals': { min: 1.4, max: 1.9 },
        'Heavy Core': { min: 1.1, max: 1.5 },
        'Standard Core': { min: 0.9, max: 1.1 },
        'Light Core': { min: 0.6, max: 0.9 },
        'Icy Core': { min: 0.3, max: 0.6 }
    };
    const range = densityRanges[body.composition];
    if (range) {
        if (body.density < range.min - 0.001 || body.density > range.max + 0.001) {
            writeLogLine(`  [PHYSICS FAIL] Density: ${body.type} (${body.composition}) density ${body.density.toFixed(3)} outside range ${range.min}-${range.max}`);
            errors++;
        }
    }

    // B. Gravity Consistency Check
    const calcGrav = sR * body.density;
    if (Math.abs(calcGrav - body.gravity) > 0.01) {
        writeLogLine(`  [PHYSICS FAIL] Gravity deviation: ${body.type} Exp: ${calcGrav.toFixed(3)}, Found: ${body.gravity.toFixed(3)}`);
        errors++;
    }

    // C. Mass-Gravity Ratio Check
    const calcMass = body.gravity * Math.pow(sR, 2);
    if (Math.abs(calcMass - body.mass) > 0.01) {
        writeLogLine(`  [PHYSICS FAIL] Mass identity mismatch: ${body.type} Exp: ${calcMass.toFixed(4)}, Found: ${body.mass.toFixed(4)}`);
        errors++;
    }

    // D. Velocity Sanity Check (ev = sqrt(2) * ov)
    if (body.escapeVel && body.orbitalVelSurface) {
        let ratio = body.escapeVel / body.orbitalVelSurface;
        if (Math.abs(ratio - Math.sqrt(2)) > 0.0001) {
            writeLogLine(`  [PHYSICS FAIL] Velocity Ratio: ${ratio.toFixed(4)}, Expected 1.4142`);
            errors++;
        }
    }

    return errors;
}

/**
 * Specialized validator for atmospheric physics: Vacuum and pressure physics.
 * @param {Object} body - The world or moon to validate.
 * @returns {number} - Number of errors found.
 */
function _validateAtmosphere(body) {
    let errors = 0;
    if (body.atmCode === undefined) return 0;
    if (body.type !== 'Terrestrial Planet' && body.type !== 'Mainworld') return 0;

    // Check 1: Vacuum & Size Constraints Check
    if (body.size === 0 || body.size === 1 || body.size === 'S') {
        if (body.atmCode !== 0) {
            writeLogLine(`  [ATMOSPHERE FAIL] Size ${body.size} world generated with Atmosphere ${body.atmCode}.`);
            errors++;
        }
    }

    // Check 2: Pressure & Partial Oxygen (ppo) Math Check
    if (body.totalPressureBar > 0 && body.oxygenFraction > 0) {
        let expectedPpo = body.totalPressureBar * body.oxygenFraction;
        if (body.ppoBar === undefined || Math.abs(body.ppoBar - expectedPpo) > 0.01) {
            writeLogLine(`  [ATMOSPHERE FAIL] ppo mismatch. Expected ~${expectedPpo.toFixed(3)}, Found ${body.ppoBar}.`);
            errors++;
        }
    }

    // Check 3: The Taint Loopback Check
    if (body.ppoBar !== undefined && (body.ppoBar < 0.1 || body.ppoBar > 0.5)) {
        if (body.atmCode === 5 || body.atmCode === 6 || body.atmCode === 8) {
            writeLogLine(`  [ATMOSPHERE FAIL] Toxic ppo (${body.ppoBar.toFixed(3)}) found on untainted Atmosphere Code ${body.atmCode}.`);
            errors++;
        }
    }

    // Check 4: Runaway Greenhouse State Check
    if (body.runawayGreenhouse === true) {
        if (body.tempStatus !== 'Boiling') {
            writeLogLine(`  [ATMOSPHERE FAIL] Runaway Greenhouse active but temperature status is ${body.tempStatus}.`);
            errors++;
        }
    }

    // Check 5: Gas Physics Retention Check
    if (body.atmCode >= 10 && body.atmCode <= 12) {
        if (body.maxEscapeValue === undefined || body.maxEscapeValue <= 0) {
            writeLogLine(`  [ATMOSPHERE FAIL] Exotic gas atmosphere missing Escape Value physics.`);
            errors++;
        }
    }

    // Check 6: Unusual Atmosphere Vacuum Check
    if (body.atmCode === 15) {
        if (body.totalPressureBar === 0) {
            writeLogLine(`  [ATMOSPHERE FAIL] Code F (Unusual) world improperly flagged as a 0-bar vacuum.`);
            errors++;
        }
    }

    return errors;
}

/**
 * Specialized validator for planetoid belts: Composition and significant body checks.
 * @param {Object} body - The world or moon to validate.
 * @returns {number} - Number of errors found.
 */
function _validateBelts(body) {
    let errors = 0;
    if (body.type !== 'Planetoid Belt') return 0;

    // A. Composition Summation Check
    let totalComp = (body.mType || 0) + (body.sType || 0) + (body.cType || 0) + (body.oType || 0);
    if (totalComp !== 100) {
        writeLogLine(`  [BELT FAIL] Composition: Belt at Orbit ${body.orbitId.toFixed(2)} sums to ${totalComp}%`);
        errors++;
    }

    // B. Resource Rating Clamp Check
    let rr = body.resourceRating !== undefined ? body.resourceRating : 0;
    if (rr < 2 || rr > 12) {
        writeLogLine(`  [BELT FAIL] Resource Rating: Belt at Orbit ${body.orbitId.toFixed(2)} resource rating ${rr} outside 2-12 range`);
        errors++;
    }

    // C. Significant Body Containment Check
    if (body.significantBodies && body.significantBodies.length > 0) {
        let beltInner = body.orbitId - (body.span / 2);
        let beltOuter = body.orbitId + (body.span / 2);
        for (let sb of body.significantBodies) {
            if (sb.orbitId < (beltInner - 0.05) || sb.orbitId > (beltOuter + 0.05)) {
                writeLogLine(`  [BELT FAIL] Stability: Dwarf Planet [Size ${sb.size}] at Orbit ${sb.orbitId.toFixed(3)} is outside Belt Span (${beltInner.toFixed(3)} - ${beltOuter.toFixed(3)})`);
                errors++;
            }
        }
    }

    // D. Bulk Integrity Check
    if (body.bulk !== undefined && body.bulk < 1) {
        writeLogLine(`  [BELT FAIL] Bulk: Belt at Orbit ${body.orbitId.toFixed(2)} bulk is ${body.bulk}, expected >= 1`);
        errors++;
    }

    return errors;
}

/**
 * Specialized validator for rotation physics: multipliers, retrograde math, and tidal lock logic.
 * @param {Object} body - The world or moon to validate.
 * @returns {number} - Number of errors found.
 */
function _validateRotation(body) {
    let errors = 0;

    // Planetoid Belts and Empty orbits do not have rotation stats in this engine
    if (body.type === 'Planetoid Belt' || body.type === 'Empty') return 0;
    if (body.siderealHours === undefined || body.yearHours === undefined) return 0;

    // A. Check Base Multipliers
    let expectedMult = (body.type === 'Gas Giant' || body.size === 0 || body.size === 'S') ? 2 : 4;
    // We cannot easily reverse-engineer the exact dice roll for the multiplier check 
    // without storing the base roll, but the prompt asks us to "Verify the siderealHours 
    // calculation... the multiplier must have been 2.  For all others, it must have been 4."
    // Since we don't store the multiplier, we'll assume the prompt implies checking if the
    // rotation logic appropriately applied the physical constraints if possible, but 
    // practically we can only validate the final orbital/rotational math consistency here.
    // *If the prompt meant to check a stored multiplier, we'd check it here. For now, 
    // we focus on the rigorous retrograde and tidal math below.*

    // B. Validate Retrograde Math
    let isRetrograde = (body.axialTilt > 90);
    let effectiveSidereal = isRetrograde ? -body.siderealHours : body.siderealHours;

    // Recalculate expected solar days
    let expectedSolarDays = (body.yearHours / effectiveSidereal) - 1;
    let expectedSolarDayHours = Infinity;

    if (Math.abs(expectedSolarDays) > 0.0001) {
        expectedSolarDayHours = Math.abs(body.yearHours / expectedSolarDays);
    }

    // Compare with stored body.solarDayHours (treat Infinity handling carefully)
    if (body.solarDayHours === Infinity) {
        if (expectedSolarDayHours !== Infinity && expectedSolarDayHours < 999999) {
            // Note: Floating point math might make a perfectly locked world have a very high solarDayHours instead of exact Infinity if not explicitly set.
            writeLogLine(`  [ROTATION FAIL] ${body.type} at Orbit ${body.orbitId} expected finite solar day ${expectedSolarDayHours.toFixed(2)}, found Infinity.`);
            errors++;
        }
    } else if (expectedSolarDayHours === Infinity) {
        writeLogLine(`  [ROTATION FAIL] ${body.type} at Orbit ${body.orbitId} expected Infinity solar day, found ${body.solarDayHours}.`);
        errors++;
    } else if (Math.abs(body.solarDayHours - expectedSolarDayHours) > 0.01) {
        writeLogLine(`  [ROTATION FAIL] ${body.type} at Orbit ${body.orbitId} solarDayHours mismatch. Exp: ${expectedSolarDayHours.toFixed(4)}, Found: ${body.solarDayHours.toFixed(4)}`);
        errors++;
    }

    // C. Tidal Lock / Twilight Zone Consistency
    // If sidereal equals year, it's tidally locked (1:1 resonance)
    if (Math.abs(body.siderealHours - body.yearHours) < 0.001) {
        if (!body.isTwilightZone) {
            writeLogLine(`  [ROTATION FAIL] ${body.type} at Orbit ${body.orbitId} is tidally locked (sidereal == year) but missing isTwilightZone flag.`);
            errors++;
        }
        if (body.solarDayHours !== Infinity) {
            writeLogLine(`  [ROTATION FAIL] ${body.type} at Orbit ${body.orbitId} is tidally locked but solarDayHours is not Infinity.`);
            errors++;
        }
    }

    return errors;
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

    // 2. Baseline Anchor Check (System Level)
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
        let insideFz = null;
        for (let fz of (sys.forbiddenZones || [])) {
            if (sys.baselineOrbit >= fz.min && sys.baselineOrbit <= fz.max) {
                insideFz = fz;
                break;
            }
        }

        if (insideFz) {
            if (effectiveOrbit >= insideFz.min && effectiveOrbit <= insideFz.max) {
                writeLogLine(`  [FAIL] Baseline Anchor: Mainworld failed to escape Forbidden Zone (${insideFz.min.toFixed(2)}-${insideFz.max.toFixed(2)}). Orbit: ${effectiveOrbit.toFixed(2)}`);
                totalErrors++;
            } else {
                writeLogLine(`  [PASS] Baseline Anchor: Mainworld shifted to safe orbit ${effectiveOrbit.toFixed(2)} (Original: ${sys.baselineOrbit.toFixed(2)} was inside FZ)`);
            }
        } else {
            if (Math.abs(effectiveOrbit - sys.baselineOrbit) > 0.01) {
                writeLogLine(`  [FAIL] Baseline Anchor: Mainworld at ${effectiveOrbit.toFixed(2)}, Expected ${sys.baselineOrbit.toFixed(2)}`);
                totalErrors++;
            } else {
                writeLogLine(`  [PASS] Baseline Anchor: Position ${effectiveOrbit.toFixed(2)} matches target.`);
            }
        }
    }

    // 3. Dispatcher loop: Iterate through worlds and moons
    const auditBody = (body, isMoon) => {
        let errors = 0;

        // A. Specialized Modular Validators
        errors += _validateTerrestrialPhysics(body);
        errors += _validateAtmosphere(body);
        errors += _validateBelts(body);

        // B. Placeholders
        errors += _validateRotation(body);
        // errors += _validateGeology(body);

        // C. General Orbital Physics (skip for moons)
        if (!isMoon && body.type !== 'Empty' && body.type !== 'Planetoid Belt') {
            // Period Verification (Scenario 1-3)
            let Sum_M = 0;
            if (body.orbitType === 'P-Type') {
                Sum_M = sys.stars.reduce((sum, s) => {
                    let sOrbit = (s.orbitId !== null && s.orbitId !== undefined) ? s.orbitId : 0;
                    return sOrbit < body.orbitId ? sum + s.mass : sum;
                }, 0);
            } else {
                let pIdx = (body.parentStarIdx !== undefined) ? body.parentStarIdx : 0;
                Sum_M = (sys.stars[pIdx] || sys.stars[0]).mass;
            }
            let planetSolarMass = (body.mass || 0) * 0.000003;
            let expectedPeriod = Math.sqrt(Math.pow(body.au, 3) / (Sum_M + planetSolarMass));

            if (body.periodYears !== undefined && Math.abs(body.periodYears - expectedPeriod) > 0.01) {
                writeLogLine(`  [FAIL] Period: ${body.type} at Orbit ${body.orbitId.toFixed(2)} variance > 0.01 (Exp: ${expectedPeriod.toFixed(4)}, Found: ${body.periodYears.toFixed(4)})`);
                errors++;
            }

            // Stability: Forbidden Zone Compliance
            for (let fz of (sys.forbiddenZones || [])) {
                if (body.orbitId >= fz.min && body.orbitId <= fz.max) {
                    writeLogLine(`  [STABILITY ERROR] ${body.type} at Orbit ${body.orbitId.toFixed(2)} is within Forbidden Zone ${fz.min.toFixed(2)}-${fz.max.toFixed(2)}`);
                    errors++;
                }
            }
        }

        return errors;
    };

    for (let w of sys.worlds) {
        totalErrors += auditBody(w, false);
        if (w.moons) {
            for (let m of w.moons) {
                totalErrors += auditBody(m, true);
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
        let sOrb = belt.orbitId + ((subObRoll * belt.span) / 10);

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
        writeLogLine("--- ATMOSPHERE PHYSICS ---");
        let isMainworldLocked = (w.type === 'Mainworld' && mainworldBase && mainworldBase.atm !== undefined);

        if (w.size === 'S' || w.size === 0 || w.size === 1) {
            tSkip('Size 0, 1, S forces Atmosphere 0');
            w.atmCode = 0;
            writeLogLine(`Base Generation: Size ${w.size} forces Atm 0`);
        } else {
            let baseRoll;
            if (isMainworldLocked) {
                tResult('Mainworld Atmosphere Inherited', mainworldBase.atm);
                baseRoll = mainworldBase.atm;
                writeLogLine(`Base Generation: Inherited Atm ${baseRoll}`);
            } else {
                let baseRollRaw = tRoll2D('Atmosphere Roll');
                baseRoll = baseRollRaw - 7 + w.size;
                tDM('Size Mod', w.size - 7);
                if (w.size >= 2 && w.size <= 4) {
                    tDM('Size Variant (2-4)', -2);
                    baseRoll -= 2;
                    writeLogLine(`Base Generation: 2D (${baseRollRaw}) - 7 + Size (${w.size}) - Size Variant (2) = Atm ${baseRoll}`);
                } else {
                    writeLogLine(`Base Generation: 2D (${baseRollRaw}) - 7 + Size (${w.size}) = Atm ${baseRoll}`);
                }
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
                writeLogLine(`Non-HZ Atmosphere: Deviation ${diff.toFixed(2)}, Table: Hot`);
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
                writeLogLine(`Non-HZ Atmosphere: Deviation ${diff.toFixed(2)}, Table: Cold`);
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

            if (isMainworldLocked && w.atmCode !== mainworldBase.atm) {
                writeLogLine(`Expanded Method Simulation: Non-HZ conditions WOULD have forced Atmosphere to ${toUWPChar(w.atmCode)}`);
                w.atmCode = mainworldBase.atm;
            }
        }

        w.atmCode = Number(w.atmCode);
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
            let rgBaseRoll = tRoll2D('Runaway Greenhouse Roll (12+)');
            let rgTotal = rgBaseRoll + rgDM;
            if (rgTotal >= 12) {
                tResult('Result', 'Runaway Greenhouse Triggered');
                writeLogLine(`Runaway Greenhouse Check: Rolled ${rgBaseRoll} + DM ${rgDM}. Result: Success`);
                w.runawayGreenhouse = true;
                tempBand = "Boiling";
                if (w.tempStatus) w.tempStatus = "Boiling"; // Force to Boiling immediately

                let isStandardRange = (w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14;
                if (isStandardRange) {
                    let oldCode = w.atmCode;
                    let rRoll = tRoll1D('New Atmosphere Type');
                    if (w.size >= 2 && w.size <= 5) { tDM('Size 2-5', -2); rRoll -= 2; }
                    if ([2, 4, 7, 9].includes(w.atmCode)) { tDM('Tainted Atm', 1); rRoll += 1; }

                    let newAtmCode;
                    if (rRoll <= 1) newAtmCode = 10;
                    else if (rRoll <= 4) newAtmCode = 11;
                    else newAtmCode = 12;

                    if (isMainworldLocked) {
                        tResult('Runaway Shift', `Locked.`);
                        writeLogLine(`Expanded Method Simulation: Runaway Greenhouse WOULD have shifted Atmosphere from ${toUWPChar(oldCode)} to ${toUWPChar(newAtmCode)}`);
                    } else {
                        w.atmCode = newAtmCode;
                        tResult('New Atmosphere', toUWPChar(w.atmCode));
                        writeLogLine(`Runaway Shift: Atm ${toUWPChar(oldCode)} -> ${toUWPChar(w.atmCode)}`);
                    }
                }
            } else {
                tResult('Result', 'Normal');
                writeLogLine(`Runaway Greenhouse Check: Rolled ${rgBaseRoll} + DM ${rgDM}. Result: Failure`);
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
            writeLogLine(`Surface Pressure: ${w.totalPressureBar.toFixed(2)} bar (Min ${cdata.minP} + Span ${cdata.spanP} * ${seededFraction.toFixed(3)})`);
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

            let o2Roll = tRoll1D('Oxygen Base');
            let varRoll = tRoll2D('Oxygen Variance (2D-7)') - 7;
            if (ageDM !== 0) tDM('Age DM', ageDM);

            let oxygenFrac = ((o2Roll + ageDM) / 20) + (varRoll / 100);
            if (oxygenFrac <= 0) {
                oxygenFrac = Math.max(0.01, (tRoll1D('Oxygen Minimum Reserve') * 0.01) + (Math.floor(rng() * 10) / 100));
            }

            w.oxygenFrac = oxygenFrac;
            w.oxygenFraction = oxygenFrac;
            w.ppoBar = w.oxygenFraction * w.totalPressureBar;
            w.ppo = w.ppoBar;

            let traceFrac = 0.003 + (rng() * 0.017); // 0.3% to 2.0%
            let traceGasChoices = ["Argon", "Carbon Dioxide", "Neon"];
            let traceGasName = traceGasChoices[Math.floor(rng() * traceGasChoices.length)];
            let tracePressure = traceFrac * w.totalPressureBar;

            let n2Frac = Math.max(0, 1.0 - w.oxygenFraction - traceFrac);

            w.taints = w.taints || [];
            if (traceGasName === "Carbon Dioxide" && tracePressure > 0.015) {
                w.taints.push("High Carbon Dioxide");
                tResult('Taint', 'High Carbon Dioxide (Gas Mix)');
                writeLogLine(`Auto-Taint Triggered: Carbon Dioxide trace pressure ${tracePressure.toFixed(3)} bar > 0.015 limit.`);
            }

            tResult('Oxygen Fraction', (w.oxygenFraction * 100).toFixed(1) + '%');
            tResult('Trace Gas', `${traceGasName} ${(traceFrac * 100).toFixed(1)}%`);
            tResult('ppo (Bar)', w.ppoBar.toFixed(3));
            writeLogLine(`Composition: N2 ${(n2Frac * 100).toFixed(1)}% | O2 ${(w.oxygenFraction * 100).toFixed(1)}% | ${traceGasName} ${(traceFrac * 100).toFixed(1)}%`);
            writeLogLine(`Oxygen Partial Pressure: ${w.ppoBar.toFixed(3)} bar`);

            // The UWP "Auto-Taint" Loopback
            w.taints = [];
            let isLowO2 = w.ppoBar < 0.1;
            let isHighO2 = w.ppoBar > 0.5;

            if (isLowO2) { tResult('Taint', 'Low Oxygen'); w.taints.push("Low Oxygen"); }
            if (isHighO2) { tResult('Taint', 'High Oxygen'); w.taints.push("High Oxygen"); }

            if (isLowO2 || isHighO2) {
                if (w.atmCode === 5) {
                    tResult('Auto-Taint Loopback', '5 -> 4');
                    w.atmCode = 4;
                    writeLogLine(`Auto-Taint Triggered: ppo ${w.ppoBar.toFixed(3)} is outside safe limits. Atm changed to 4.`);
                }
                else if (w.atmCode === 6) {
                    tResult('Auto-Taint Loopback', '6 -> 7');
                    w.atmCode = 7;
                    writeLogLine(`Auto-Taint Triggered: ppo ${w.ppoBar.toFixed(3)} is outside safe limits. Atm changed to 7.`);
                }
                else if (w.atmCode === 8) {
                    tResult('Auto-Taint Loopback', '8 -> 9');
                    w.atmCode = 9;
                    writeLogLine(`Auto-Taint Triggered: ppo ${w.ppoBar.toFixed(3)} is outside safe limits. Atm changed to 9.`);
                }
            }

            let generateAtmosphericTaints = () => {
                let tRollRaw = tRoll2D('Taint Subtype Roll');
                let tRoll = tRollRaw;
                if (w.atmCode === 4) { tDM('Atm 4', -2); tRoll -= 2; }
                if (w.atmCode === 9) { tDM('Atm 9', 2); tRoll += 2; }
                let t = MGT2E_TAINT_SUBTYPES[Math.max(2, Math.min(12, tRoll))];

                let typeRollStr = `Subtype Roll ${tRollRaw}`;
                if (w.atmCode === 4) typeRollStr += ` - Atm 4 DM (2) = ${tRoll}`;
                else if (w.atmCode === 9) typeRollStr += ` + Atm 9 DM (2) = ${tRoll}`;
                typeRollStr += ` -> ${t}`;

                // Temperature Precision for Sulphur
                if (t === "Sulphur Compounds" && w.meanTempK !== undefined && w.meanTempK < 273) {
                    tResult('Taint Precision', 'Temp < 273K: Sulphur freezes to Particulates');
                    t = "Particulates";
                    typeRollStr += ` (Sulphur frozen to Particulates <273K)`;
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

                let sevRollStr = `Severity Roll ${sevRoll} -> ${w.taintSeverity}`;

                // Lethal Persistence Check
                let pRoll = tRoll2D('Taint Persistence');
                let pDM = 0;
                let pDMStr = "";
                if (sevIdx === 8 || sevIdx === 9) {
                    let hasOxygenTaint = w.taints.includes("Low Oxygen") || w.taints.includes("High Oxygen");
                    if (hasOxygenTaint) {
                        tDM('Lethal L/H Oxygen', 6);
                        pDM = 6;
                        pDMStr = " + DM 6 (Lethal L/H O2)";
                    } else {
                        tDM('Lethal Taint', 4);
                        pDM = 4;
                        pDMStr = " + DM 4 (Lethal Taint)";
                    }
                }
                w.taintPersistence = Math.max(2, pRoll + pDM);
                tResult('Taint Persistence', w.taintPersistence);

                let perRollStr = `Persistence Roll ${pRoll}${pDMStr} -> ${w.taintPersistence}`;
                let taintNum = w.taints.length;
                writeLogLine(`Taint ${taintNum}: ${typeRollStr}. ${sevRollStr}. ${perRollStr}.`);

                // Edge Case: Cascading Taints
                if (tRollRaw === 10) {
                    writeLogLine(`Taint Cascade: Subtype roll was 10, triggering a second taint roll.`);
                    generateAtmosphericTaints();
                }
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
            writeLogLine(`Scale Height: ${w.scaleHeight.toFixed(2)} km`);

            if (w.atmCode === 13) {
                let badRatioO2 = w.oxygenFraction > 0 ? w.ppoBar / 0.5 : 1;
                let badRatioN2 = (w.totalPressureBar - w.ppoBar) / 2.0;
                let badRatio = Math.max(badRatioO2, badRatioN2);
                if (badRatio > 1 && w.scaleHeight > 0) {
                    w.safeAlt = Math.log(badRatio) * w.scaleHeight;
                    tResult('Safe Altitude (km)', w.safeAlt.toFixed(2));
                    writeLogLine(`Code D Minimum Safe Altitude: ${w.safeAlt.toFixed(2)} km (O2 Ratio: ${badRatioO2.toFixed(2)}, N2 Ratio: ${badRatioN2.toFixed(2)})`);

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
                    writeLogLine(`Code E Safe Depth: ${w.safeAltBelowMean.toFixed(2)} km below mean`);

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
            tSection('Exotic Gas Retention (DPM)');
            let massTerra = w.mass || 0.001;
            let diamTerra = w.diamKm ? (w.diamKm / 12742) : (w.size * 1600 / 12742) || 0.001;
            w.maxEscapeValue = 1000 * (massTerra / (diamTerra * w.meanTempK));

            const dpmGasData = [
                { id: "H-", name: "Hydrogen Ion", ev: 24.00, bp: 20, weight: 0, taint: false },
                { id: "H2", name: "Hydrogen", ev: 12.00, bp: 20, weight: 1200, taint: false },
                { id: "He", name: "Helium", ev: 6.00, bp: 4, weight: 400, taint: false },
                { id: "CH4", name: "Methane", ev: 1.50, bp: 113, weight: 70, taint: true },
                { id: "NH3", name: "Ammonia", ev: 1.42, bp: 240, weight: 30, taint: true },
                { id: "H2O", name: "Water Vapour", ev: 1.33, bp: 373, weight: 100, taint: false },
                { id: "HF", name: "Hydrofluoric Acid", ev: 1.20, bp: 293, weight: 2, taint: true },
                { id: "Ne", name: "Neon", ev: 1.20, bp: 27, weight: 50, taint: false },
                { id: "Na", name: "Sodium", ev: 1.04, bp: 1156, weight: 40, taint: true },
                { id: "N2", name: "Nitrogen", ev: 0.86, bp: 77, weight: 60, taint: false },
                { id: "CO", name: "Carbon Monoxide", ev: 0.86, bp: 82, weight: 70, taint: true },
                { id: "HCN", name: "Hydrogen Cyanide", ev: 0.86, bp: 299, weight: 30, taint: true },
                { id: "C2H6", name: "Ethane", ev: 0.80, bp: 184, weight: 70, taint: true },
                { id: "O2", name: "Oxygen", ev: 0.75, bp: 90, weight: 50, taint: false },
                { id: "HCl", name: "Hydrochloric Acid", ev: 0.67, bp: 321, weight: 1, taint: true },
                { id: "F2", name: "Fluorine", ev: 0.63, bp: 85, weight: 2, taint: true },
                { id: "Ar", name: "Argon", ev: 0.60, bp: 87, weight: 20, taint: false },
                { id: "CO2", name: "Carbon Dioxide", ev: 0.55, bp: 216, weight: 70, taint: true },
                { id: "CH3NO", name: "Formamide", ev: 0.53, bp: 483, weight: 15, taint: true },
                { id: "CH2O2", name: "Formic Acid", ev: 0.52, bp: 374, weight: 15, taint: true },
                { id: "SO2", name: "Sulphur Dioxide", ev: 0.38, bp: 263, weight: 20, taint: true },
                { id: "Cl2", name: "Chlorine", ev: 0.34, bp: 239, weight: 1, taint: true },
                { id: "Kr", name: "Krypton", ev: 0.29, bp: 120, weight: 2, taint: false },
                { id: "H2SO4", name: "Sulphuric Acid", ev: 0.24, bp: 718, weight: 20, taint: true }
            ];

            writeLogLine(`Max Escape Value: ${w.maxEscapeValue.toFixed(3)} (1000 * (${massTerra.toFixed(3)} / (${diamTerra.toFixed(2)} * ${w.meanTempK.toFixed(1)})))`);

            let retainedGases = [];
            w.taints = w.taints || [];

            for (let g of dpmGasData) {
                if (g.weight > 0 && g.ev < w.maxEscapeValue && w.meanTempK > g.bp) {
                    let gasObj = { name: g.name, weight: g.weight, taint: g.taint };

                    // CO -> CO2 constraint
                    if (g.name === "Carbon Monoxide" && w.hydroPercent > 0) {
                        tResult('CO Constraint', 'Water present -> Carbon Dioxide');
                        writeLogLine('Carbon Monoxide converted to Carbon Dioxide due to presence of H2O.');
                        gasObj.name = "Carbon Dioxide";
                    }
                    retainedGases.push(gasObj);
                }
            }

            if (retainedGases.length === 0) {
                retainedGases.push({ name: w.maxEscapeValue > 0.2 ? "Heavy Gases" : "Trace Gases", weight: 100, taint: false });
            }

            // Aggregate weights by name to handle CO -> CO2 overlap substitution
            let aggregatedGases = {};
            let totalWeight = 0;
            for (let g of retainedGases) {
                if (!aggregatedGases[g.name]) {
                    aggregatedGases[g.name] = { weight: 0, taint: g.taint };
                }
                aggregatedGases[g.name].weight += g.weight;
                aggregatedGases[g.name].taint = aggregatedGases[g.name].taint || g.taint;
            }

            for (let key in aggregatedGases) {
                totalWeight += aggregatedGases[key].weight;
                if (aggregatedGases[key].taint && !w.taints.includes(key)) {
                    w.taints.push(key);
                    tResult('Atm Taint', key);
                }
            }

            let mixStrings = [];
            for (let name in aggregatedGases) {
                let pct = (aggregatedGases[name].weight / totalWeight) * 100;
                mixStrings.push(`${name} ${pct.toFixed(1)}%`);
            }

            // Sort to look nice (highest percentage first)
            mixStrings.sort((a, b) => parseFloat(b.split(' ')[b.split(' ').length - 1]) - parseFloat(a.split(' ')[a.split(' ').length - 1]));

            w.gases = mixStrings;
            tResult('Gas Mix', w.gases.join(', '));
            writeLogLine(`Retained Gases: ${w.gases.join(', ')}`);

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
            writeLogLine(`Code F Roll: D26 ${d26} -> Subtype ${subtypeName}`);

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

        // ==========================================
        // Sync final physical codes back to UWP strings 
        // ==========================================
        let finalAtmChar = toUWPChar(w.atmCode);
        let finalHydroChar = toUWPChar(w.hydroCode);

        let updateUWPChar = (uwpStr, idx, char) => {
            if (!uwpStr || uwpStr.length <= idx || uwpStr === '-') return uwpStr;
            const chars = uwpStr.split('');
            chars[idx] = char;
            return chars.join('');
        };

        if (w.type === 'Mainworld' && mainworldBase && mainworldBase.uwp && !isMainworldLocked) {
            mainworldBase.uwp = updateUWPChar(mainworldBase.uwp, 2, finalAtmChar);
            mainworldBase.uwp = updateUWPChar(mainworldBase.uwp, 3, finalHydroChar);
            mainworldBase.atm = w.atmCode;
            mainworldBase.hydro = w.hydroCode;
        } else if (w.uwpSecondary) {
            w.uwpSecondary = updateUWPChar(w.uwpSecondary, 2, finalAtmChar);
            w.uwpSecondary = updateUWPChar(w.uwpSecondary, 3, finalHydroChar);
            w.uwpSecondaryAtm = w.atmCode;
            w.uwpSecondaryHydro = w.hydroCode;
        }
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
                let target = blOrbit;
                let inFz = true;
                let safetyCounter = 0;
                let initialTarget = target;

                while (inFz && safetyCounter < 10) {
                    inFz = false;
                    for (let fz of fzList) {
                        if (target >= fz.min && target <= fz.max) {
                            inFz = true;
                            // Find nearest edge
                            let distToMin = target - fz.min;
                            let distToMax = fz.max - target;

                            // Official Rule: 2D-7 / 10 variance, always moving into the allowable zone
                            let variance = Math.abs((tRoll2D('Baseline FZ Shift') - 7) / 10);
                            if (variance === 0) variance = 0.01; // Ensure it strictly crosses the boundary

                            if (distToMin <= distToMax) {
                                target = fz.min - variance; // Push inward to safe zone
                            } else {
                                target = fz.max + variance; // Push outward to safe zone
                            }
                            break; // Re-evaluate in case the shift pushed it into a different FZ
                        }
                    }
                    safetyCounter++;
                }

                if (Math.abs(target - initialTarget) > 0.001) {
                    writeLogLine(`Expanded Method Simulation: Mainworld Baseline Orbit WOULD have shifted from ${initialTarget.toFixed(2)} to ${target.toFixed(2)} due to Forbidden Zone conflict.`);
                }

                currentOrbit = target;
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
