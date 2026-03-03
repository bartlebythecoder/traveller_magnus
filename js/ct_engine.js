// =====================================================================
// CLASSIC TRAVELLER (CT) GENERATION ENGINE
// =====================================================================

// --- PHYSICAL TABLES ---
const ORBIT_AU = [0.2, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10.0, 19.6, 38.8, 77.2];
const GRAV = { S: 0.024, 1: 0.122, 2: 0.240, 3: 0.377, 4: 0.500, 5: 0.625, 6: 0.840, 7: 0.875, 8: 1.000, 9: 1.120, 10: 1.250 };

const LUM = {
    'Ia': { B0: 560000, B5: 204000, A0: 107000, A5: 81000, F0: 61000, F5: 51000, G0: 67000, G5: 89000, K0: 97000, K5: 107000, M0: 117000, M5: 129000 },
    'Ib': { B0: 270000, B5: 46700, A0: 15000, A5: 11700, F0: 7400, F5: 5100, G0: 6100, G5: 8100, K0: 11700, K5: 20400, M0: 46000, M5: 89000 },
    'II': { B0: 170000, B5: 18600, A0: 2200, A5: 850, F0: 600, F5: 510, G0: 560, G5: 740, K0: 890, K5: 2450, M0: 4600, M5: 14900 },
    'III': { B0: 107000, B5: 6700, A0: 280, A5: 90, F0: 53, F5: 43, G0: 50, G5: 75, K0: 95, K5: 320, M0: 470, M5: 2280 },
    'IV': { B0: 81000, B5: 2000, A0: 156, A5: 37, F0: 19, F5: 12, G0: 6.5, G5: 4.9, K0: 4.67 },
    'V': { B0: 56000, B5: 1400, A0: 90, A5: 16, F0: 8.1, F5: 3.5, G0: 1.21, G5: 0.67, K0: 0.42, K5: 0.08, M0: 0.04, M5: 0.007 },
    'VI': { F0: 0.977, F5: 0.977, G0: 0.322, G5: 0.186, K0: 0.117, K5: 0.025, M0: 0.011, M5: 0.002 },
    'D': { default: 0.001 }
};

const STAR_MASS = {
    'Ia': 50, 'Ib': 30, 'II': 15, 'III': 10, 'IV': 3, 'V': 1.0, 'VI': 0.7, 'D': 0.1
};

const ZONE_H_TABLE = {
    'Ia': { B0: 13, B5: 12, A0: 12, A5: 12, F0: 12, F5: 11, G0: 12, G5: 12, K0: 12, K5: 12, M0: 12, M5: 12 },
    'Ib': { B0: 13, B5: 11, A0: 11, A5: 10, F0: 10, F5: 10, G0: 10, G5: 10, K0: 10, K5: 11, M0: 11, M5: 12 },
    'II': { B0: 12, B5: 11, A0: 10, A5: 9, F0: 9, F5: 8, G0: 8, G5: 8, K0: 9, K5: 9, M0: 10, M5: 11 },
    'III': { B0: 12, B5: 11, A0: 9, A5: 8, F0: 8, F5: 8, G0: 8, G5: 8, K0: 9, K5: 9, M0: 10, M5: 11 },
    'IV': { B0: 7, B5: 6, A0: 5, A5: 5, F0: 5, F5: 5, G0: 5, G5: 5, K0: 4 },
    'V': { B0: 7, B5: 6, A0: 5, A5: 4, F0: 4, F5: 3, G0: 3, G5: 2, K0: 1, K5: 0, M0: 0, M5: 0 },
    'VI': { F0: 3, F5: 2, G0: 2, G5: 1, K0: 1, K5: 0, M0: 0, M5: 0 },
    'D': { default: 0 }
};

function getThermalStats(w, luminosity) {
    if (w.type === 'Planetoid Belt') return { temperature: 100 };
    let cloudBase = 0;
    const h = w.hydro;
    if (h <= 1) cloudBase = 0;
    else if (h <= 3) cloudBase = 10;
    else if (h === 4) cloudBase = 20;
    else if (h === 5) cloudBase = 30;
    else if (h === 6) cloudBase = 40;
    else if (h === 7) cloudBase = 50;
    else if (h === 8) cloudBase = 60;
    else cloudBase = 70;

    let cloudiness = cloudBase;
    if ([10, 11, 12, 13].includes(w.atm)) cloudiness = Math.min(100, cloudiness + 40);
    if ([0, 1, 2, 3].includes(w.atm)) cloudiness = Math.min(20, cloudiness);
    if (w.atm === 14) cloudiness = Math.floor(cloudiness / 2);

    let waterPortion = Math.max(0, w.hydro / 10.0 - 0.05);
    let landPortion = Math.max(0, 1.0 - w.hydro / 10.0 - 0.05);
    let icePortion = 0.10;
    const tc = w.tradeCodes || [];
    if (tc.includes('Ic')) { icePortion = waterPortion + 0.05; waterPortion = 0; }

    let cloudDec = cloudiness / 100.0;
    let unobs = 1.0 - cloudDec;
    let albedo = (waterPortion * unobs * 0.02) + (landPortion * unobs * 0.10) +
        (icePortion * unobs * 0.85) + (cloudDec * 0.50);

    let ghMult = 1.0;
    const atm = w.atm;
    if ([0, 1, 2, 3, 15].includes(atm)) ghMult = 1.00;
    else if ([4, 5].includes(atm)) ghMult = 1.05;
    else if ([6, 7, 14].includes(atm)) ghMult = 1.10;
    else if ([8, 9, 13].includes(atm)) ghMult = 1.15;
    else if (atm === 10) ghMult = 1.0 + (Math.floor(Math.random() * 51) + 20) / 100;
    else if ([11, 12].includes(atm)) ghMult = 1.0 + (Math.floor(Math.random() * 101) + 20) / 100;

    let temperature = Math.round(374.025 * ghMult * (1 - albedo) * Math.pow(luminosity, 0.25) / Math.pow(w.distAU, 0.5));
    return { temperature };
}

function getRotationStats(w) {
    let axialTilt = (roll2D() - 2) * 4;
    let rotRoll = roll2D();
    let rotationPeriod = "";
    if (rotRoll <= 7) rotationPeriod = (rotRoll * 3 + roll2D()) + "h";
    else if (rotRoll === 8) rotationPeriod = (roll2D() * 20) + "h";
    else if (rotRoll === 9) rotationPeriod = (roll1D()) + "d";
    else if (rotRoll === 10) rotationPeriod = (roll2D()) + "d";
    else if (rotRoll === 11) rotationPeriod = (roll1D()) + "w";
    else rotationPeriod = "Tidal Locked";
    return { axialTilt, rotationPeriod };
}

/**
 * BOOK 6: SCOUT SOCIAL GENERATION
 * Calculates social UPP for subordinate worlds/moons.
 */
function generateSubordinateSocial(world, mainworld) {
    if (!world || !mainworld) return;

    // Safety: ensure mainworld has basic social data
    const mwPop = (mainworld.pop !== undefined) ? mainworld.pop : 0;
    const mwGov = (mainworld.gov !== undefined) ? mainworld.gov : 0;
    const mwLaw = (mainworld.law !== undefined) ? mainworld.law : 0;
    const mwTL = (mainworld.tl !== undefined) ? mainworld.tl : 0;

    // --- 1. POPULATION LOGIC ---
    if (world.size === 'R' || world.size === 0) {
        world.pop = 0;
    } else {
        let popRoll = roll2D() - 2;

        // DMs by location/type
        if (world.type === 'Satellite') {
            if (world.zone === 'I') popRoll -= 6;
            else if (world.zone === 'O') popRoll -= 1;
        } else { // Terrestrial or Captured Planet
            if (world.zone === 'I') popRoll -= 5;
            else if (world.zone === 'O') popRoll -= 3;
        }

        // Atmo DM: If Atmo is NOT 0, 5, 6, or 8, apply -2
        if (![0, 5, 6, 8].includes(world.atm)) {
            popRoll -= 2;
        }

        let pop = Math.max(0, popRoll);

        // Continuation Cap: If Pop >= Mainworld Pop, set to Mainworld Pop - 1
        if (pop >= mwPop) {
            pop = Math.max(0, mwPop - 1);
        }
        world.pop = pop;
    }

    // --- 2. GOVERNMENT LOGIC ---
    let gov = 0;
    if (world.pop > 0) {
        if (mwGov === 6) {
            gov = 6; // Special: Subordinate Gov matches Mainworld if it's 6
        } else {
            let govRoll = roll1D();
            if (mwGov >= 7) govRoll += 2;

            // Mapping
            if (govRoll === 1) gov = 1;      // Company
            else if (govRoll === 2) gov = 2; // Participating Democracy
            else if (govRoll === 3) gov = 3; // Self-Perpetuating Oligarchy
            else if (govRoll === 4) gov = 4; // Representative Democracy
            else gov = 6;                    // Captive Government (5+)
        }
    }
    world.gov = gov;

    // --- 3. LAW LEVEL LOGIC ---
    let law = 0;
    if (world.pop > 0 && world.gov > 0) {
        law = Math.max(0, roll1D() - 3 + mwLaw);
    }
    world.law = law;

    // --- 4. TECH LEVEL LOGIC ---
    let tl = Math.max(0, mwTL - 1);

    // Facility: If 'Research' or 'Military' base present, TL = Mainworld TL
    const hasSpecialFacility = (world.militaryBase || world.researchBase ||
        (world.facilities && (world.facilities.includes('Research Laboratory') ||
            world.facilities.includes('Military Base'))));
    if (hasSpecialFacility) {
        tl = mwTL;
    }

    // Environmental Floor: If TL < 7 AND Atmo is NOT 5, 6, or 8, set TL to 7
    if (tl < 7 && ![5, 6, 8].includes(world.atm)) {
        tl = 7;
    }
    world.tl = tl;
}

// CT Mainworld Generation
function generateCTMainworld() {
    let starportRoll = roll2D();
    let starport = 'X';
    if (starportRoll <= 4) starport = 'A';
    else if (starportRoll <= 6) starport = 'B';
    else if (starportRoll <= 8) starport = 'C';
    else if (starportRoll === 9) starport = 'D';
    else if (starportRoll <= 11) starport = 'E';

    let navalBase = false;
    if (starport === 'A' || starport === 'B') {
        navalBase = roll2D() >= 8;
    }

    let scoutBase = false;
    if (starport !== 'E' && starport !== 'X') {
        let dm = 0;
        if (starport === 'A') dm = -3;
        else if (starport === 'B') dm = -2;
        else if (starport === 'C') dm = -1;
        scoutBase = (roll2D() + dm) >= 7;
    }

    let gasGiant = roll2D() <= 9;

    let size = Math.max(0, roll2D() - 2);

    let atm = 0;
    if (size > 0) atm = Math.max(0, roll2D() - 7 + size);

    let hydro = 0;
    if (size > 0) {
        let hydroDM = 0;
        if (atm <= 1 || atm >= 10) hydroDM = -4;
        hydro = Math.max(0, roll2D() - 7 + atm + hydroDM);
    }

    let pop = Math.max(0, roll2D() - 2);

    let gov = Math.max(0, roll2D() - 7 + pop);

    let law = Math.max(0, roll2D() - 7 + gov);

    let tlDM = 0;
    // Starport TL DMs
    if (starport === 'A') tlDM += 6;
    else if (starport === 'B') tlDM += 4;
    else if (starport === 'C') tlDM += 2;
    else if (starport === 'X') tlDM -= 4;
    // Size TL DMs
    if (size <= 1) tlDM += 2;
    else if (size <= 4) tlDM += 1;
    // Atmosphere TL DMs
    if (atm <= 3 || (atm >= 10 && atm <= 14)) tlDM += 1;
    // Hydrographics TL DMs
    if (hydro === 9) tlDM += 1;
    else if (hydro === 10) tlDM += 2;
    // Population TL DMs
    if (pop >= 1 && pop <= 5) tlDM += 1;
    else if (pop === 9) tlDM += 2;
    else if (pop === 10) tlDM += 4;
    // Government TL DMs
    if (gov === 0 || gov === 5) tlDM += 1;
    else if (gov === 13) tlDM -= 2;

    let tl = Math.max(0, Math.floor(Math.random() * 6) + 1 + tlDM);

    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;

    let tradeCodes = [];
    if (atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7) tradeCodes.push("Ag");
    if (atm <= 3 && hydro <= 3 && pop >= 6) tradeCodes.push("Na");
    if ([0, 1, 2, 4, 7, 9].includes(atm) && pop >= 9) tradeCodes.push("In");
    if (pop <= 6) tradeCodes.push("Ni");
    if (gov >= 4 && gov <= 9 && [6, 8].includes(atm) && pop >= 6 && pop <= 8) tradeCodes.push("Ri");
    if (atm >= 2 && atm <= 5 && hydro <= 3) tradeCodes.push("Po");
    if (hydro === 10) tradeCodes.push("Wa");
    if (hydro === 0) tradeCodes.push("De");
    if (atm === 0) tradeCodes.push("Va");
    if (size === 0) tradeCodes.push("As");
    if ([0, 1].includes(atm) && hydro >= 1) tradeCodes.push("Ic");

    return { name: getNextSystemName(), uwp, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, navalBase, scoutBase, gasGiant };
}

function constructCTUPP(w) {
    if (!w) return "-------";
    if (w.type === 'Empty') return "-------";
    const sp = w.spaceport || 'S';
    const sChar = (w.size === 'S' ? 'S' : (w.size === 'R' ? 'R' : toUWPChar(w.size)));
    return `${sp}${sChar}${toUWPChar(w.atm)}${toUWPChar(w.hydro)}${toUWPChar(w.pop)}${toUWPChar(w.gov)}${toUWPChar(w.law)}-${toUWPChar(w.tl)}`;
}

// =====================================================================
// BOOK 6 (CT) SYSTEM GENERATION
// =====================================================================

function generateCTSystemChunk1(mainworldBase) {
    if (!mainworldBase) return null;

    function rollOrbit(orbitData, trinaryDM) {
        let od = orbitData;
        if (trinaryDM > 0) {
            let reIdx = Math.max(0, Math.min(12, (roll2D() - 2) + trinaryDM));
            od = CT_SYS_FEATURES[reIdx].orbit;
        }
        if (od.base === 'Close') return { orbit: 0, label: 'Close' };
        if (od.base === 'Far') return { orbit: 14, label: 'Far' };
        let num = od.base + (od.die ? roll1D() : 0);
        return { orbit: num, label: String(num) };
    }

    function calcMaxOrbits(tableBase, type, size) {
        let mo = tableBase;
        if (['Ia', 'Ib', 'II'].includes(size)) mo += 8;
        else if (size === 'III') mo += 4;
        if (type === 'M') mo -= 4;
        else if (type === 'K') mo -= 2;
        return Math.max(0, mo);
    }

    function spectralDecimal(size) {
        return size === 'D' ? null : (roll1D() <= 3 ? 0 : 5);
    }

    function starName(type, size, decimal) {
        return size === 'D' ? `${type} D` : `${type}${decimal} ${size}`;
    }

    let priRoll2D = roll2D();
    let priRawIdx = priRoll2D - 2;
    let priDM = 0;
    if ((mainworldBase.atm >= 4 && mainworldBase.atm <= 9) || mainworldBase.pop >= 8) priDM = 4;
    let priIdx = Math.max(0, Math.min(12, priRawIdx + priDM));
    let row = CT_SYS_FEATURES[priIdx];

    let priDecimal = spectralDecimal(row.priSize);
    let primary = {
        type: row.priType,
        size: row.priSize,
        decimal: priDecimal,
        name: starName(row.priType, row.priSize, priDecimal),
        role: 'Primary',
        orbit: null,
        orbitLabel: null,
        maxOrbits: calcMaxOrbits(row.maxOrbits, row.priType, row.priSize),
    };

    let specKey = row.priType + (priDecimal === null ? '' : priDecimal);
    primary.luminosity = (LUM[row.priSize] && LUM[row.priSize][specKey] !== undefined) ? LUM[row.priSize][specKey] : (LUM[row.priSize] ? LUM[row.priSize].default : 1.0);
    primary.mass = STAR_MASS[row.priSize] || 1.0;

    let sys = {
        nature: row.nature,
        stars: [primary],
        gasGiants: [],
        planetoidBelts: 0,
        worlds: [],
        _priIdx: priIdx,
        _priRawIdx: priRawIdx,
        _priDM: priDM,
    };

    function generateCompanion(role, trinaryDM) {
        let typeIdx = Math.max(0, Math.min(12, (roll2D() - 2) + priRawIdx));
        let sizeIdx = Math.max(0, Math.min(12, (roll2D() - 2) + priRawIdx));
        let cType = CT_SYS_FEATURES[typeIdx].compType || 'M';
        let cSize = CT_SYS_FEATURES[sizeIdx].compSize || 'D';
        let cDec = spectralDecimal(cSize);
        let o = rollOrbit(row.orbit, trinaryDM);
        if (typeof o.orbit === 'number' && o.orbit <= 0) o = { orbit: 0, label: 'Close' };
        return {
            type: cType,
            size: cSize,
            decimal: cDec,
            name: starName(cType, cSize, cDec),
            role,
            orbit: o.orbit,
            orbitLabel: o.label,
            maxOrbits: calcMaxOrbits(row.maxOrbits, cType, cSize),
        };
    }

    if (row.nature === 'Binary' || row.nature === 'Trinary') {
        sys.stars.push(generateCompanion('Companion', 0));
        if (row.nature === 'Trinary') {
            sys.stars.push(generateCompanion('Companion 2', 4));
        }
    }

    sys.maxOrbits = primary.maxOrbits;
    sys.totalOrbits = sys.stars.reduce((s, st) => s + st.maxOrbits, 0);

    let ggCount = 0;
    if (mainworldBase.gasGiant) {
        ggCount = row.ggPres ? row.ggQty : 1;
    } else {
        ggCount = 0;
    }

    ggCount = Math.min(ggCount, sys.maxOrbits);
    for (let i = 0; i < ggCount; i++) {
        sys.gasGiants.push({ size: roll1D() <= 3 ? 'Large' : 'Small' });
    }

    if (row.beltPres) {
        let beltQty = Math.max(0, row.beltQty - sys.gasGiants.length);
        let remaining = Math.max(0, sys.maxOrbits - sys.gasGiants.length);
        sys.planetoidBelts = Math.min(beltQty, remaining);
    }
    if (mainworldBase && mainworldBase.size === 0) {
        sys.planetoidBelts = Math.max(1, sys.planetoidBelts + 1);
    }

    return sys;
}

function generateCTSystemChunk2(sys, mainworldBase) {
    if (!sys) return null;

    const primary = sys.stars[0];
    const pType = primary.type;
    const pSize = primary.size;
    const pDec = primary.decimal;

    function getZoneForOrbit(size, type, decimal, orbitNum) {
        const table = ZONE_TABLES[size];
        if (!table) return 'O';
        const key = size === 'D' ? type : (type + (decimal === null ? '' : decimal));
        const zoneList = table[key] || table[type + '0'] || table[type + '5'] || Object.values(table)[0];
        const roundedOrbit = Math.floor(orbitNum);
        if (roundedOrbit < 0) return '-';
        if (roundedOrbit >= zoneList.length) return 'O';
        return zoneList[roundedOrbit] || 'O';
    }

    sys.orbits = [];
    for (let i = 0; i <= sys.maxOrbits; i++) {
        sys.orbits.push({
            orbit: i,
            zone: getZoneForOrbit(pSize, pType, pDec, i),
            contents: null
        });
    }

    const anomalyRoll = roll1D() + (['B', 'A'].includes(pType) ? 1 : 0);
    const anomalyTable = [
        null,
        { capPres: false, capQty: 1, empVac: false, empQty: 1 },
        { capPres: false, capQty: 1, empVac: false, empQty: 1 },
        { capPres: false, capQty: 2, empVac: false, empQty: 2 },
        { capPres: false, capQty: 2, empVac: false, empQty: 3 },
        { capPres: true, capQty: 3, empVac: true, empQty: 3 },
        { capPres: true, capQty: 3, empVac: true, empQty: 3 },
        { capPres: true, capQty: 3, empVac: true, empQty: 3 }
    ];
    const resultRow = anomalyTable[Math.min(7, anomalyRoll)];

    if (resultRow.empVac) {
        const qtyTable = [0, 1, 1, 2, 3, 3, 3];
        const actualQty = qtyTable[roll1D()];
        for (let i = 0; i < actualQty; i++) {
            let attempts = 0;
            while (attempts < 20) {
                const orbNum = roll2D();
                const slot = sys.orbits.find(o => o.orbit === orbNum);
                if (slot && !slot.contents) {
                    slot.contents = { type: 'Empty' };
                    break;
                }
                attempts++;
            }
        }
    }

    if (resultRow.capPres) {
        const qtyTable = [0, 1, 1, 2, 2, 3, 3];
        const actualQty = qtyTable[roll1D()];
        for (let i = 0; i < actualQty; i++) {
            const baseline = roll2D();
            const deviation = (roll2D() - 7) * 0.1;
            const finalOrbit = baseline + deviation;
            if (!sys.capturedPlanets) sys.capturedPlanets = [];
            let cpDist = ORBIT_AU[Math.min(Math.floor(finalOrbit), ORBIT_AU.length - 1)];
            sys.capturedPlanets.push({
                orbit: finalOrbit,
                zone: getZoneForOrbit(pSize, pType, pDec, finalOrbit),
                type: 'Captured Planet',
                distAU: cpDist,
                mass: 0.1, // Captured planets are small terrestrial proxies
                orbitalPeriod: Math.sqrt(Math.pow(cpDist, 3) / (sys.stars[0].mass || 1.0))
            });
        }
    }

    let availableSlots = sys.orbits.filter(o => o.zone !== '-' && !o.contents);
    const placeGG = (gg) => {
        let targets = availableSlots.filter(s => ['H', 'O'].includes(s.zone));
        if (targets.length === 0) {
            targets = availableSlots.filter(s => s.zone === 'I');
        }

        if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            let ggDist = ORBIT_AU[Math.min(Math.floor(target.orbit), ORBIT_AU.length - 1)];
            let ggThermal = { temperature: 150 }; // GG baseline
            let ggRot = getRotationStats({ size: gg.size });
            target.contents = {
                type: 'Gas Giant',
                size: gg.size,
                distAU: ggDist,
                gravity: (gg.size === 'Large' ? 2.5 : 0.8),
                diamKm: (gg.size === 'Large' ? 140000 : 50000),
                mass: (gg.size === 'Large' ? 300 : 50),
                orbitalPeriod: Math.sqrt(Math.pow(ggDist, 3) / (sys.stars[0].mass || 1.0)),
                temperature: ggThermal.temperature,
                axialTilt: ggRot.axialTilt,
                rotationPeriod: ggRot.rotationPeriod
            };
            availableSlots = availableSlots.filter(s => s !== target);
            return target;
        } else {
            const newOrbitNum = sys.maxOrbits + 1;
            sys.maxOrbits = newOrbitNum;
            let ggDist = ORBIT_AU[Math.min(Math.floor(newOrbitNum), ORBIT_AU.length - 1)];
            let ggThermal = { temperature: 150 };
            let ggRot = getRotationStats({ size: gg.size });
            const newSlot = {
                orbit: newOrbitNum,
                zone: 'O',
                contents: {
                    type: 'Gas Giant',
                    size: gg.size,
                    distAU: ggDist,
                    gravity: (gg.size === 'Large' ? 2.5 : 0.8),
                    diamKm: (gg.size === 'Large' ? 140000 : 50000),
                    mass: (gg.size === 'Large' ? 300 : 50),
                    orbitalPeriod: Math.sqrt(Math.pow(ggDist, 3) / (sys.stars[0].mass || 1.0)),
                    temperature: ggThermal.temperature,
                    axialTilt: ggRot.axialTilt,
                    rotationPeriod: ggRot.rotationPeriod
                }
            };
            sys.orbits.push(newSlot);
            return newSlot;
        }
    };
    sys.gasGiants.forEach(gg => placeGG(gg));

    availableSlots = sys.orbits.filter(o => o.zone !== '-' && !o.contents);
    for (let i = 0; i < sys.planetoidBelts; i++) {
        const ggSlots = sys.orbits.filter(s => s.contents && s.contents.type === 'Gas Giant');
        let target = null;
        for (let ggS of ggSlots) {
            const prefOrb = ggS.orbit - 1;
            const prefSlot = availableSlots.find(s => s.orbit === prefOrb);
            if (prefSlot) {
                target = prefSlot;
                break;
            }
        }

        if (!target && availableSlots.length > 0) {
            target = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        }

        if (target) {
            let bDist = ORBIT_AU[Math.min(Math.floor(target.orbit), ORBIT_AU.length - 1)];
            let bThermal = getThermalStats({ type: 'Planetoid Belt', distAU: bDist, hydro: 0, atm: 0 }, sys.stars[0].luminosity || 1.0);
            let bRot = getRotationStats({ size: 0 });
            target.contents = {
                type: 'Planetoid Belt',
                distAU: bDist,
                gravity: 0,
                diamKm: 0,
                mass: 0,
                orbitalPeriod: Math.sqrt(Math.pow(bDist, 3) / (sys.stars[0].mass || 1.0)),
                temperature: bThermal.temperature,
                axialTilt: bRot.axialTilt,
                rotationPeriod: bRot.rotationPeriod
            };
            availableSlots = availableSlots.filter(s => s !== target);
        }
    }

    const mwSize = mainworldBase.size;
    const mwAtm = mainworldBase.atm;
    const mwIsAsteroid = (mwSize === 0);
    const mwCanBeAnywhere = mwIsAsteroid || ([0, 1].includes(mwAtm)) || (mwAtm >= 10);

    let mwPlaced = false;
    let mwGrav = (GRAV[mainworldBase.size] !== undefined ? GRAV[mainworldBase.size] : 1.0);
    let mwMassProxy = (mainworldBase.size === 'S' ? 0.3 : mainworldBase.size);

    if (!mwCanBeAnywhere) {
        const hCandidates = sys.orbits.filter(o => o.zone === 'H');
        if (hCandidates.length > 0) {
            const target = hCandidates[Math.floor(Math.random() * hCandidates.length)];
            let mwDist = ORBIT_AU[Math.min(Math.floor(target.orbit), ORBIT_AU.length - 1)];
            if (target.contents && target.contents.type === 'Gas Giant') {
                if (!target.contents.satellites) target.contents.satellites = [];
                let mwThermal = getThermalStats({ hydro: mainworldBase.hydro, atm: mainworldBase.atm, distAU: mwDist, tradeCodes: mainworldBase.tradeCodes || [] }, sys.stars[0].luminosity || 1.0);
                let mwRot = getRotationStats({ size: mainworldBase.size });
                target.contents.satellites.push({
                    type: 'Mainworld',
                    distAU: mwDist,
                    gravity: mwGrav,
                    diamKm: (mainworldBase.size === 'S' ? 500 : mainworldBase.size * 1600),
                    mass: mwGrav * Math.pow(mwMassProxy / 8, 2),
                    orbitalPeriod: Math.sqrt(Math.pow(mwDist, 3) / (sys.stars[0].mass || 1.0)),
                    temperature: mwThermal.temperature,
                    axialTilt: mwRot.axialTilt,
                    rotationPeriod: mwRot.rotationPeriod
                });
                mwPlaced = true;
            } else if (!target.contents) {
                let mwThermal = getThermalStats({ hydro: mainworldBase.hydro, atm: mainworldBase.atm, distAU: mwDist, tradeCodes: mainworldBase.tradeCodes || [] }, sys.stars[0].luminosity || 1.0);
                let mwRot = getRotationStats({ size: mainworldBase.size });
                target.contents = {
                    type: 'Mainworld',
                    distAU: mwDist,
                    gravity: mwGrav,
                    diamKm: (mainworldBase.size === 'S' ? 500 : mainworldBase.size * 1600),
                    mass: mwGrav * Math.pow(mwMassProxy / 8, 2),
                    orbitalPeriod: Math.sqrt(Math.pow(mwDist, 3) / (sys.stars[0].mass || 1.0)),
                    temperature: mwThermal.temperature,
                    axialTilt: mwRot.axialTilt,
                    rotationPeriod: mwRot.rotationPeriod
                };
                mwPlaced = true;
            }
        }
    }

    if (!mwPlaced) {
        availableSlots = sys.orbits.filter(o => o.zone !== '-' && !o.contents);
        if (availableSlots.length > 0) {
            const target = availableSlots[Math.floor(Math.random() * availableSlots.length)];
            let mwDist = ORBIT_AU[Math.min(Math.floor(target.orbit), ORBIT_AU.length - 1)];
            let mwThermal = getThermalStats({ hydro: mainworldBase.hydro, atm: mainworldBase.atm, distAU: mwDist, tradeCodes: mainworldBase.tradeCodes || [] }, sys.stars[0].luminosity || 1.0);
            let mwRot = getRotationStats({ size: mainworldBase.size });
            target.contents = {
                type: 'Mainworld',
                distAU: mwDist,
                gravity: mwGrav,
                diamKm: (mainworldBase.size === 'S' ? 500 : mainworldBase.size * 1600),
                mass: mwGrav * Math.pow(mwMassProxy / 8, 2),
                orbitalPeriod: Math.sqrt(Math.pow(mwDist, 3) / (sys.stars[0].mass || 1.0)),
                temperature: mwThermal.temperature,
                axialTilt: mwRot.axialTilt,
                rotationPeriod: mwRot.rotationPeriod
            };
            mwPlaced = true;
        } else {
            const newOrbitNum = sys.maxOrbits + 1;
            sys.maxOrbits = newOrbitNum;
            let mwDist = ORBIT_AU[Math.min(Math.floor(newOrbitNum), ORBIT_AU.length - 1)];
            let mwThermal = getThermalStats({ hydro: mainworldBase.hydro, atm: mainworldBase.atm, distAU: mwDist, tradeCodes: mainworldBase.tradeCodes || [] }, sys.stars[0].luminosity || 1.0);
            let mwRot = getRotationStats({ size: mainworldBase.size });
            const newSlot = {
                orbit: newOrbitNum,
                zone: 'O',
                contents: {
                    type: 'Mainworld',
                    distAU: mwDist,
                    gravity: mwGrav,
                    diamKm: (mainworldBase.size === 'S' ? 500 : mainworldBase.size * 1600),
                    mass: mwGrav * Math.pow(mwMassProxy / 8, 2),
                    orbitalPeriod: Math.sqrt(Math.pow(mwDist, 3) / (sys.stars[0].mass || 1.0)),
                    temperature: mwThermal.temperature,
                    axialTilt: mwRot.axialTilt,
                    rotationPeriod: mwRot.rotationPeriod
                }
            };
            sys.orbits.push(newSlot);
            mwPlaced = true;
        }
    }

    return sys;
}

function generateCTSystemChunk3(sys, mainworldBase) {
    if (!sys) return null;

    const mwPop = mainworldBase.pop;
    const primary = sys.stars[0];
    const pType = primary.type;

    const generateWorld = (world, orbitNum, zone) => {
        let sizeRoll = roll2D() - 2;
        if (orbitNum === 0) sizeRoll -= 5;
        else if (orbitNum === 1) sizeRoll -= 4;
        else if (orbitNum === 2) sizeRoll -= 2;

        if (pType === 'M') sizeRoll -= 2;

        let size;
        if (sizeRoll <= 0) {
            size = 'S';
        } else {
            size = Math.min(10, sizeRoll);
        }
        world.size = size;
        world.gravity = GRAV[size] !== undefined ? GRAV[size] : 1.0;
        world.diamKm = (size === 'S' ? 500 : size * 1600);

        let atmSizeVal = (size === 'S' ? 0 : size);
        let atmRoll = roll2D() - 7 + atmSizeVal;
        if (zone === 'I' || zone === 'O') atmRoll -= 2;

        let atm = Math.max(0, Math.min(15, atmRoll));
        if (size === 0 || size === 'S') atm = 0;

        const hOrbits = sys.orbits.filter(o => o.zone === 'H').map(o => o.orbit);
        if (hOrbits.length > 0) {
            const maxH = Math.max(...hOrbits);
            if (orbitNum >= maxH + 2) {
                if (roll2D() === 12) atm = 10;
            }
        }
        world.atm = atm;

        let hydroRoll = roll2D() - 7 + atmSizeVal;
        if (atm === 0 || atm === 1 || atm >= 10) hydroRoll -= 4;
        if (zone === 'O') hydroRoll -= 4;

        let hydro = Math.max(0, Math.min(10, hydroRoll));
        if (zone === 'I' || size === 1 || size === 'S') hydro = 0;
        world.hydro = hydro;

        world.zone = zone; // Ensure zone is set for helper
        generateSubordinateSocial(world, mainworldBase);

        world.uwpSecondary = constructCTUPP(world);
        world.distAU = ORBIT_AU[Math.min(Math.floor(orbitNum), ORBIT_AU.length - 1)];
        world.mass = world.gravity * Math.pow((size === 'S' ? 0.3 : size) / 8, 2);
        world.orbitalPeriod = Math.sqrt(Math.pow(world.distAU, 3) / (sys.stars[0].mass || 1.0));

        let luminosity = sys.stars[0].luminosity || 1.0;
        let thermal = getThermalStats(world, luminosity);
        world.temperature = thermal.temperature;
        let rot = getRotationStats(world);
        world.axialTilt = rot.axialTilt;
        world.rotationPeriod = rot.rotationPeriod;
    };

    sys.orbits.forEach(slot => {
        if (!slot.contents) return;
        const type = slot.contents.type;
        if (['Gas Giant', 'Planetoid Belt', 'Mainworld', 'Empty'].includes(type) || type === 'Captured Planet') return;
        generateWorld(slot.contents, slot.orbit, slot.zone);
    });

    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(cp => {
            generateWorld(cp, cp.orbit, cp.zone);
        });
    }

    return sys;
}

function generateCTSystemChunk4(sys, mainworldBase) {
    if (!sys) return null;

    const mwPop = mainworldBase.pop;

    const SATELLITE_ORBITS = {
        Ring: [0, 1, 1, 1, 2, 2, 3],
        Close: [0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        Far: [0, 0, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
        Extreme: [0, 0, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325]
    };

    const generateMoons = (parent, orbitNum, zone) => {
        if (parent.size === 0 || parent.size === 'S') return;

        let qty = 0;
        if (parent.type === 'Gas Giant') {
            if (['LGG', 'Large'].includes(parent.size)) qty = roll2D();
            else qty = roll2D() - 4;
        } else if (parent.type === 'Mainworld' || parent.type === 'Terrestrial Planet') {
            qty = roll1D() - 3;
        }
        qty = Math.max(0, qty);
        if (qty <= 0) return;

        if (!parent.satellites) parent.satellites = [];
        const startingSatQty = parent.satellites.length;
        let usedDistances = new Set();
        parent.satellites.forEach(s => { if (s.pd) usedDistances.add(s.pd); });

        for (let i = startingSatQty; i < qty; i++) {
            let moon = { type: 'Satellite' };

            let sizeRoll;
            if (parent.type === 'Gas Giant') {
                sizeRoll = (['LGG', 'Large'].includes(parent.size) ? roll2D() - 4 : roll2D() - 6);
            } else {
                let pSize = parent.size;
                if (parent.type === 'Mainworld' && mainworldBase.size !== undefined) {
                    pSize = mainworldBase.size;
                }
                sizeRoll = pSize - roll1D();
            }

            if (sizeRoll === 0) moon.size = 'R';
            else if (sizeRoll < 0) moon.size = 'S';
            else moon.size = Math.min(10, sizeRoll);

            moon.gravity = (moon.size === 'R' ? 0 : (GRAV[moon.size] !== undefined ? GRAV[moon.size] : 1.0));
            moon.diamKm = (moon.size === 'R' ? 0 : (moon.size === 'S' ? 500 : moon.size * 1600));

            let dist = null;
            let attempt = 0;
            while (dist === null && attempt < 15) {
                attempt++;
                if (moon.size === 'R') {
                    dist = SATELLITE_ORBITS.Ring[roll1D()];
                } else {
                    let catRoll = roll2D() - i;
                    let cat = 'Close';
                    if (catRoll >= 12 && parent.type === 'Gas Giant') cat = 'Extreme';
                    else if (catRoll >= 8) cat = 'Far';

                    let distRoll = roll2D();
                    dist = SATELLITE_ORBITS[cat][distRoll];
                }
                if (usedDistances.has(dist)) dist = null;
            }
            if (dist === null) continue;
            usedDistances.add(dist);
            moon.pd = dist;

            let szVal = (moon.size === 'S' || moon.size === 'R') ? 0 : moon.size;
            let atmRoll = roll2D() - 7 + szVal;
            if (zone === 'I' || zone === 'O') atmRoll -= 4;
            let atm = Math.max(0, Math.min(15, atmRoll));
            if (szVal <= 1) atm = 0;

            const hOrbits = sys.orbits.filter(o => o.zone === 'H').map(o => o.orbit);
            if (hOrbits.length > 0) {
                const maxH = Math.max(...hOrbits);
                if (orbitNum >= maxH + 2 && roll2D() === 12) {
                    atm = 10;
                }
            }
            moon.atm = atm;

            let hydroRoll = roll2D() - 7 + szVal;
            if (atm <= 1 || atm >= 10) hydroRoll -= 4;
            if (zone === 'O') hydroRoll -= 2;
            let hydro = Math.max(0, Math.min(10, hydroRoll));
            if (zone === 'I' || szVal <= 1) hydro = 0;
            moon.hydro = hydro;

            moon.zone = zone; // Ensure zone is set for helper
            generateSubordinateSocial(moon, mainworldBase);

            moon.uwpSecondary = constructCTUPP(moon);
            moon.distAU = ORBIT_AU[Math.min(Math.floor(orbitNum), ORBIT_AU.length - 1)];
            moon.mass = moon.gravity * Math.pow((moon.size === 'S' ? 0.3 : moon.size) / 8, 2);
            moon.orbitalPeriod = Math.sqrt(Math.pow(moon.distAU, 3) / (sys.stars[0].mass || 1.0));

            let luminosity = sys.stars[0].luminosity || 1.0;
            let thermal = getThermalStats(moon, luminosity);
            moon.temperature = thermal.temperature;
            let rot = getRotationStats(moon);
            moon.axialTilt = rot.axialTilt;
            moon.rotationPeriod = rot.rotationPeriod;

            parent.satellites.push(moon);
        }
    };

    sys.orbits.forEach(slot => {
        if (slot.contents) {
            generateMoons(slot.contents, slot.orbit, slot.zone);
        }
    });
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(p => {
            generateMoons(p, p.orbit, p.zone);
        });
    }

    return sys;
}

function generateCTSystemChunk5(sys, mainworldBase) {
    if (!sys) return null;

    const mwGov = mainworldBase.gov;
    const mwLaw = mainworldBase.law;
    const mwTL = mainworldBase.tl;
    const mwAtm = mainworldBase.atm;
    const mwPop = mainworldBase.pop;
    const isIndustrial = (mainworldBase.tradeCodes && (mainworldBase.tradeCodes.includes('In') || mainworldBase.tradeCodes.includes('IND')));
    const isPoor = (mainworldBase.tradeCodes && (mainworldBase.tradeCodes.includes('Po') || mainworldBase.tradeCodes.includes('POR')));
    const hasBase = (mainworldBase.navalBase || mainworldBase.scoutBase);

    const fleshOutWorld = (w, orbitNum, zone) => {
        if (w.type === 'Empty' || w.size === 0 || w.size === 'R' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') {
            w.gov = 0; w.law = 0; w.spaceport = 'Y';
            return;
        }

        // 1. Prepare world object for social helper
        w.zone = zone;

        // 2. Initial Social Generation (Pop, Gov, Law, TL)
        generateSubordinateSocial(w, mainworldBase);

        // 3. Post-Social Facilities Generation
        w.facilities = [];
        if (zone === 'H' && w.atm >= 4 && w.atm <= 9 && w.hydro >= 4 && w.hydro <= 8 && w.pop >= 2) {
            w.facilities.push('Farming');
        }
        if (isIndustrial && w.pop >= 2) {
            w.facilities.push('Mining');
        }
        if (w.gov === 6 && w.pop >= 5) {
            w.facilities.push('Colony');
        }
        if (mwTL >= 9 && w.pop > 0) {
            let labRoll = roll2D();
            if (mwTL >= 10) labRoll += 2;
            if (labRoll >= 11) w.facilities.push('Research Laboratory');
        }
        if (w.pop > 0 && !isPoor) {
            let milRoll = roll2D();
            if (mwPop >= 8) milRoll += 1;
            if (w.atm === mwAtm) milRoll += 2;
            if (hasBase) milRoll += 1;
            if (milRoll >= 12) w.facilities.push('Military Base');
        }

        // 4. Re-Apply Facility TL Bonuses (if added after helper)
        if (w.facilities.includes('Research Laboratory') || w.facilities.includes('Military Base')) {
            w.tl = mwTL;
        }

        let spRoll = roll1D();
        if (w.pop >= 6) spRoll += 2;
        else if (w.pop === 1) spRoll -= 2;
        else if (w.pop === 0) spRoll -= 3;

        let sp = 'Y';
        if (spRoll <= 2) sp = 'Y';
        else if (spRoll === 3) sp = 'H';
        else if (spRoll <= 5) sp = 'G';
        else sp = 'F';
        w.spaceport = sp;

        const sChar = (w.size === 'S' ? 'S' : toUWPChar(w.size));
        w.uwpSecondary = constructCTUPP(w);
        if (w.facilities.length > 0) {
            w.classifications = w.facilities;
        }
    };

    const processNode = (node, orbitNum, zone) => {
        if (!node) return;
        fleshOutWorld(node, orbitNum, zone);
        if (node.satellites) {
            node.satellites.forEach(s => fleshOutWorld(s, orbitNum, zone));
        }
    };

    sys.orbits.forEach(slot => {
        if (slot.contents && slot.contents.type !== 'Mainworld') {
            processNode(slot.contents, slot.orbit, slot.zone);
        }
    });
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(p => {
            processNode(p, p.orbit, p.zone);
        });
    }

    return sys;
}

// =====================================================================
// BOOK 6 (CT) MAINWORLD PHYSICAL GENERATION
// =====================================================================
function generateCTPhysical(base) {
    if (!base) return null;

    let roll = roll2D();
    let dm = 0;
    if ((base.atm >= 4 && base.atm <= 9) || base.pop >= 8) dm = 4;
    let modRoll = Math.max(0, Math.min(12, (roll + dm) - 2));
    const sysFeatRow = CT_SYS_FEATURES[modRoll];
    let stellarSize = sysFeatRow.priSize;
    let spectralLetter = sysFeatRow.priType;

    let decimal = stellarSize === 'D' ? '' : (roll1D() <= 3 ? '0' : '5');
    let spectralKey = spectralLetter + decimal;
    let homestar = stellarSize === 'D' ? `${spectralLetter} D` : `${spectralKey} ${stellarSize}`;

    let hzOrbit = 2;
    let zoneRow = ZONE_H_TABLE[stellarSize];
    if (zoneRow) {
        hzOrbit = (zoneRow[spectralKey] !== undefined) ? zoneRow[spectralKey] : (zoneRow.default !== undefined ? zoneRow.default : 2);
    }

    let satellites = Math.max(0, roll1D() - 3);
    let gravity = GRAV[base.size] !== undefined ? GRAV[base.size] : 1.0;
    let distAU = ORBIT_AU[Math.min(hzOrbit, ORBIT_AU.length - 1)];

    let luminosity = (LUM[stellarSize] && LUM[stellarSize][spectralKey] !== undefined) ? LUM[stellarSize][spectralKey] : (LUM[stellarSize] ? LUM[stellarSize].default : 1.0);

    // Use Helpers
    let tempBody = { hydro: base.hydro, atm: base.atm, distAU: distAU, tradeCodes: base.tradeCodes || [] };
    let thermal = getThermalStats(tempBody, luminosity);
    let rot = getRotationStats({ size: base.size });

    return {
        homestar, spectralKey, stellarSize,
        hzOrbit, distAU, satellites, gravity,
        temperature: thermal.temperature,
        axialTilt: rot.axialTilt,
        rotationPeriod: rot.rotationPeriod,
        worldType: 'Planet',
        displayString: `${homestar} | Orbit ${hzOrbit} (${distAU}AU) | ${satellites} moons | G:${gravity}g | ${thermal.temperature}K | Tilt:${rot.axialTilt}° | Day:${rot.rotationPeriod}`
    };
}
