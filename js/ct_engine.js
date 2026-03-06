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
    else if (atm === 10) ghMult = 1.0 + (Math.floor(rng() * 51) + 20) / 100;
    else if ([11, 12].includes(atm)) ghMult = 1.0 + (Math.floor(rng() * 101) + 20) / 100;

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
    tSection('Subordinate Social Stats');

    // Safety: ensure mainworld has basic social data
    const mwPop = (mainworld.pop !== undefined) ? mainworld.pop : 0;
    const mwGov = (mainworld.gov !== undefined) ? mainworld.gov : 0;
    const mwLaw = (mainworld.law !== undefined) ? mainworld.law : 0;
    const mwTL = (mainworld.tl !== undefined) ? mainworld.tl : 0;

    // --- 1. POPULATION LOGIC ---
    if (world.size === 'R' || world.size === 0) {
        world.pop = 0;
        tSkip('Size R or 0 forces Pop 0');
    } else {
        let popRollUnmod = tRoll2D('Population');
        tDM('Standard Pop', -2);
        let popRoll = popRollUnmod - 2;

        // DMs by location/type
        if (world.type === 'Satellite') {
            if (world.zone === 'I') {
                popRoll -= 6;
                tDM('Zone I (Satellite)', -6);
            }
            else if (world.zone === 'O') {
                popRoll -= 1;
                tDM('Zone O (Satellite)', -1);
            }
        } else { // Terrestrial or Captured Planet
            if (world.zone === 'I') {
                popRoll -= 5;
                tDM('Zone I (Terrestrial)', -5);
            }
            else if (world.zone === 'O') {
                popRoll -= 3;
                tDM('Zone O (Terrestrial)', -3);
            }
        }

        // Atmo DM: If Atmo is NOT 0, 5, 6, or 8, apply -2
        if (![0, 5, 6, 8].includes(world.atm)) {
            popRoll -= 2;
            tDM('Atmosphere Penalty', -2);
        }

        let pop = Math.max(0, popRoll);

        // Continuation Cap: If Pop >= Mainworld Pop, set to Mainworld Pop - 1
        if (pop >= mwPop) {
            let capped = Math.max(0, mwPop - 1);
            tOverride('Population Cap', pop, capped, 'Cannot equal/exceed Mainworld Pop');
            pop = capped;
        } else if (pop !== popRoll) {
            tClamp('Population', popRoll, pop);
        }

        world.pop = clampUWP(pop, 0, 15);
        if (world.pop !== pop) tClamp('Population UWP', pop, world.pop);
        tResult('Final Population', world.pop);
    }

    // --- 2. GOVERNMENT LOGIC ---
    let gov = 0;
    if (world.pop > 0) {
        if (mwGov === 6) {
            gov = 6; // Special: Subordinate Gov matches Mainworld if it's 6
            tOverride('Captive Government', 0, 6, 'Mainworld is Gov 6');
        } else {
            let govRoll = tRoll1D('Government');
            if (mwGov >= 7) {
                govRoll += 2;
                tDM('Mainworld Gov 7+', 2);
            }

            // Mapping
            if (govRoll === 1) gov = 1;      // Company
            else if (govRoll === 2) gov = 2; // Participating Democracy
            else if (govRoll === 3) gov = 3; // Self-Perpetuating Oligarchy
            else if (govRoll === 4) gov = 4; // Representative Democracy
            else gov = 6;                    // Captive Government (5+)
        }
    } else {
        tSkip('Pop 0 forces Gov 0');
    }
    world.gov = clampUWP(gov, 0, 15);
    if (world.gov !== gov) tClamp('Government UWP', gov, world.gov);
    tResult('Final Government', world.gov);

    // --- 3. LAW LEVEL LOGIC ---
    let law = 0;
    if (world.pop > 0 && world.gov > 0) {
        let lawRollUnmod = tRoll1D('Law Level');
        tDM('Standard Law', -3);
        tDM('Mainworld Law', mwLaw);
        law = Math.max(0, lawRollUnmod - 3 + mwLaw);
    } else {
        tSkip('Pop 0 or Gov 0 forces Law 0');
    }
    world.law = clampUWP(law, 0, 15);
    if (world.law !== law) tClamp('Law Level UWP', law, world.law);
    tResult('Final Law Level', world.law);

    // --- 4. TECH LEVEL LOGIC ---
    let tl = Math.max(0, mwTL - 1);
    tResult('Initial TL (Mainworld - 1)', tl);

    // Facility: If 'Research' or 'Military' base present, TL = Mainworld TL
    const hasSpecialFacility = (world.militaryBase || world.researchBase ||
        (world.facilities && (world.facilities.includes('Research Laboratory') ||
            world.facilities.includes('Military Base'))));
    if (hasSpecialFacility) {
        tl = mwTL;
        tOverride('Special Facility', tl - Math.max(0, mwTL - 1), mwTL, 'Base matches Mainworld TL');
    }

    // Environmental Floor: If TL < 7 AND Atmo is NOT 5, 6, or 8, set TL to 7
    if (tl < 7 && ![5, 6, 8].includes(world.atm)) {
        tOverride('TL Environmental Floor', tl, 7, 'Low TL in hostile atmo');
        tl = 7;
    }
    world.tl = clampUWP(tl, 0, 33);
    if (world.tl !== tl) tClamp('Tech Level UWP', tl, world.tl);
    tResult('Final Tech Level', world.tl);
}

// CT Mainworld Generation (Fully Instrumented)
function generateCTMainworld(hexId) {
    let name = getNextSystemName(hexId);
    if (window.isLoggingEnabled) startTrace(hexId, 'Classic Traveller Mainworld', name);
    reseedForHex(hexId);

    tSection('Starport Generation');
    let starportRoll = tRoll2D('Starport');
    let starport = 'X';
    if (starportRoll <= 4) starport = 'A';
    else if (starportRoll <= 6) starport = 'B';
    else if (starportRoll <= 8) starport = 'C';
    else if (starportRoll === 9) starport = 'D';
    else if (starportRoll <= 11) starport = 'E';
    tResult('Starport Class', starport);

    tSection('Bases & Gas Giants');
    let navalBase = false;
    if (starport === 'A' || starport === 'B') {
        navalBase = tRoll2D('Naval Base (8+)') >= 8;
        tResult('Naval Base Present', navalBase);
    } else {
        tSkip('Naval Base (Requires Starport A or B)');
    }

    let scoutBase = false;
    if (starport !== 'E' && starport !== 'X') {
        let spRoll = tRoll2D('Scout Base (7+)');
        if (starport === 'A') tDM('Starport A', -3);
        else if (starport === 'B') tDM('Starport B', -2);
        else if (starport === 'C') tDM('Starport C', -1);

        scoutBase = (pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)) >= 7;
        tResult('Scout Base Present', scoutBase);
    } else {
        tSkip('Scout Base (Requires Starport A, B, C, or D)');
    }

    let gasGiant = tRoll2D('Gas Giant (9-)') <= 9;
    tResult('Gas Giant Present', gasGiant);

    tSection('Planetary Size');
    tDM('Standard Size', -2);
    let rawSize = tRoll2D('Size') - 2;
    let size = Math.max(0, rawSize);
    if (rawSize !== size) tClamp('Size', rawSize, size);
    tResult('Size Code', size);

    tSection('Planetary Atmosphere');
    let atm = 0;
    if (size > 0) {
        tRoll2D('Atmosphere');
        tDM('Standard Atmo', -7);
        tDM(`Size Code`, size);
        let rawAtm = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
        atm = Math.max(0, rawAtm);
        if (rawAtm !== atm) tClamp('Atmosphere', rawAtm, atm);
    } else {
        tSkip('Atmosphere (Asteroid/Size 0 forces Atm 0)');
    }
    tResult('Atmosphere Code', atm);

    tSection('Hydrographic Percentage');
    let hydro = 0;
    if (size > 0) {
        tRoll2D('Hydrographics');
        tDM('Standard Hydro', -7);
        tDM(`Atmosphere Code`, atm);
        if (atm <= 1 || atm >= 10) {
            tDM(`Atmosphere Extreme`, -4);
        }
        let rawHydro = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
        hydro = Math.max(0, rawHydro);
        if (rawHydro !== hydro) tClamp('Hydrographics', rawHydro, hydro);
    } else {
        tSkip('Hydrographics (Asteroid/Size 0 forces Hydro 0)');
    }
    tResult('Hydrographic Code', hydro);

    tSection('Population');
    tRoll2D('Population');
    tDM('Standard Pop', -2);
    let rawPop = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
    let pop = Math.max(0, rawPop);
    if (rawPop !== pop) tClamp('Population', rawPop, pop);
    tResult('Population Code', pop);

    tSection('Government');
    tRoll2D('Government');
    tDM('Standard Gov', -7);
    tDM('Population Code', pop);
    let rawGov = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
    let gov = Math.max(0, rawGov);
    if (rawGov !== gov) tClamp('Government', rawGov, gov);
    tResult('Government Code', gov);

    tSection('Law Level');
    tRoll2D('Law Level');
    tDM('Standard Law', -7);
    tDM('Government Code', gov);
    let rawLaw = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
    let law = Math.max(0, rawLaw);
    if (rawLaw !== law) tClamp('Law Level', rawLaw, law);
    tResult('Law Level Code', law);

    tSection('Technological Level');
    tRoll1D('Tech Level');
    // Starport TL DMs
    if (starport === 'A') tDM('Starport A', 6);
    else if (starport === 'B') tDM('Starport B', 4);
    else if (starport === 'C') tDM('Starport C', 2);
    else if (starport === 'X') tDM('Starport X', -4);

    // Size TL DMs
    if (size <= 1) tDM(`Size ${size}`, 2);
    else if (size <= 4) tDM(`Size ${size}`, 1);

    // Atmosphere TL DMs (Fixed to include 15)
    if (atm <= 3 || atm >= 10) tDM(`Atmosphere ${atm}`, 1);

    // Hydrographics TL DMs
    if (hydro === 9) tDM('Hydrographics 9', 1);
    else if (hydro === 10) tDM('Hydrographics A', 2);

    // Population TL DMs
    if (pop >= 1 && pop <= 5) tDM(`Population ${pop}`, 1);
    else if (pop === 9) tDM('Population 9', 2);
    else if (pop === 10) tDM('Population A', 4);

    // Government TL DMs
    if (gov === 0 || gov === 5) tDM(`Government ${gov}`, 1);
    else if (gov === 13) tDM('Government D', -2);

    let rawTl = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
    let tl = Math.max(0, rawTl);
    if (rawTl !== tl) tClamp('Tech Level', rawTl, tl);
    tResult('Tech Level Code', tl);

    // Apply Clamping for final UWP string
    size = clampUWP(size, 0, 15);
    atm = clampUWP(atm, 0, 15);
    hydro = clampUWP(hydro, 0, 10);
    pop = clampUWP(pop, 0, 15);
    gov = clampUWP(gov, 0, 15);
    law = clampUWP(law, 0, 15);
    tl = clampUWP(tl, 0, 33);

    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;

    tSection('Trade Classifications & Zones');
    let tradeCodes = [];
    if (atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7) { tradeCodes.push("Ag"); tTrade("Ag", "Atm 4-9, Hyd 4-8, Pop 5-7"); }
    if (atm <= 3 && hydro <= 3 && pop >= 6) { tradeCodes.push("Na"); tTrade("Na", "Atm 0-3, Hyd 0-3, Pop 6+"); }
    if ([0, 1, 2, 4, 7, 9].includes(atm) && pop >= 9) { tradeCodes.push("In"); tTrade("In", "Atm 0-2,4,7,9, Pop 9+"); }
    if (pop <= 6) { tradeCodes.push("Ni"); tTrade("Ni", "Pop 0-6"); }
    if (gov >= 4 && gov <= 9 && [6, 8].includes(atm) && pop >= 6 && pop <= 8) { tradeCodes.push("Ri"); tTrade("Ri", "Gov 4-9, Atm 6 or 8, Pop 6-8"); }
    if (atm >= 2 && atm <= 5 && hydro <= 3) { tradeCodes.push("Po"); tTrade("Po", "Atm 2-5, Hyd 0-3"); }
    if (hydro === 10) { tradeCodes.push("Wa"); tTrade("Wa", "Hyd A"); }
    if (hydro === 0) { tradeCodes.push("De"); tTrade("De", "Hyd 0"); }
    if (atm === 0) { tradeCodes.push("Va"); tTrade("Va", "Atm 0"); }
    if (size === 0) { tradeCodes.push("As"); tTrade("As", "Size 0"); }
    if ([0, 1].includes(atm) && hydro >= 1) { tradeCodes.push("Ic"); tTrade("Ic", "Atm 0-1, Hyd 1+"); }

    tResult('Final Trade Codes', tradeCodes.length > 0 ? tradeCodes.join(' ') : 'None');

    let travelZone = 'Green';
    if (starport === 'X') {
        travelZone = 'Red';
        tResult('Travel Zone', 'Red (Starport X)');
    } else {
        tResult('Travel Zone', 'Green');
    }



    if (window.isLoggingEnabled) endTrace();

    return { name, uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, navalBase, scoutBase, gasGiant };
}

function constructCTUPP(w) {
    if (!w) return "-------";
    if (w.type === 'Empty') return "-------";
    const sp = w.spaceport || 'S';

    // Size clamping (handle 'S' and 'R')
    let sChar = w.size;
    if (typeof w.size === 'number') {
        sChar = toUWPChar(clampUWP(w.size, 0, 15));
    } else if (w.size === 'S' || w.size === 'R') {
        sChar = w.size;
    } else {
        sChar = toUWPChar(0);
    }

    const atm = clampUWP(w.atm || 0, 0, 15);
    const hydro = clampUWP(w.hydro || 0, 0, 10);
    const pop = clampUWP(w.pop || 0, 0, 15);
    const gov = clampUWP(w.gov || 0, 0, 15);
    const law = clampUWP(w.law || 0, 0, 15);
    const tl = clampUWP(w.tl || 0, 0, 33);

    return `${sp}${sChar}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;
}

function applyStarSizeOverrides(type, size, decimal) {
    if (size === 'IV' && (type === 'M' || (type === 'K' && decimal === 5))) {
        return 'V';
    }
    if (size === 'VI' && (['B', 'A'].includes(type) || (type === 'F' && decimal === 0))) {
        return 'V';
    }
    return size;
}

// =====================================================================
// BOOK 6 (CT) SYSTEM GENERATION
// =====================================================================

function generateCTSystemChunk1(mainworldBase, hexId) {
    if (!mainworldBase) return null;
    reseedForHex(hexId);

    tSection('CT System: Basic Nature & Primary Star');

    function rollOrbit(trinaryDM) {
        tRoll2D('Companion Orbit Base');
        if (trinaryDM > 0) tDM('Trinary Orbit DM', trinaryDM);
        let rollVal = Math.max(0, Math.min(12, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)));

        let o = { orbit: 0, label: 'Close' };
        if (rollVal <= 3) o = { orbit: 0, label: 'Close' };
        else if (rollVal >= 12) o = { orbit: 14, label: 'Far' };
        else {
            let baseOrbitNum = rollVal - 3;
            let die = rollVal >= 7;
            let orbitNum = baseOrbitNum + (die ? tRoll1D('Orbit Modifier (+1D)') : 0);
            o = { orbit: orbitNum, label: String(orbitNum) };
        }
        if (o.orbit <= 0) o = { orbit: 0, label: 'Close' };
        return o;
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

    // Step 1: Basic Nature
    tRoll2D('Basic Nature');
    let natureRoll = Math.max(0, Math.min(12, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)));
    let nature = CT_BASIC_NATURE_TABLE[natureRoll];
    tResult('Basic Nature', nature);

    // Step 2: Primary Type and Size
    let priDM = 0;
    if ((mainworldBase.atm >= 4 && mainworldBase.atm <= 9) || mainworldBase.pop >= 8) {
        priDM = 4;
    }

    tRoll2D('Primary Type');
    if (priDM > 0) tDM('High Pop/Ag Atmo', priDM);
    let priTypeRollUnmodified = pendingRoll.val;
    let priTypeIdx = Math.max(0, Math.min(12, priTypeRollUnmodified + priDM));
    let rawPriType = CT_PRI_TYPE_TABLE[priTypeIdx];

    tRoll2D('Primary Size');
    if (priDM > 0) tDM('High Pop/Ag Atmo', priDM);
    let priSizeRollUnmodified = pendingRoll.val;
    let priSizeIdx = Math.max(0, Math.min(12, priSizeRollUnmodified + priDM));
    let rawPriSize = CT_PRI_SIZE_TABLE[priSizeIdx];

    let priDecimal = spectralDecimal(rawPriSize);

    // Apply Physical Overrides
    let finalPriSize = applyStarSizeOverrides(rawPriType, rawPriSize, priDecimal);
    if (finalPriSize !== rawPriSize) {
        tOverride('Primary Star Size', rawPriSize, finalPriSize, 'Rule Override');
    }

    tResult('Primary Star Type', rawPriType);
    tResult('Primary Star Size', finalPriSize);
    tResult('Primary Star Name', starName(rawPriType, finalPriSize, priDecimal));

    tRoll2D('Primary Max Orbits Base');
    let priMaxOrbitsBaseRoll = Math.max(0, Math.min(12, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)));
    tResult('Primary Base Max Orbits', priMaxOrbitsBaseRoll);

    let primary = {
        type: rawPriType,
        size: finalPriSize,
        decimal: priDecimal,
        name: starName(rawPriType, finalPriSize, priDecimal),
        role: 'Primary',
        orbit: null,
        orbitLabel: null,
        maxOrbits: calcMaxOrbits(priMaxOrbitsBaseRoll, rawPriType, finalPriSize),
    };

    let specKey = rawPriType + (priDecimal === null ? '' : priDecimal);
    primary.luminosity = (LUM[finalPriSize] && LUM[finalPriSize][specKey] !== undefined) ? LUM[finalPriSize][specKey] : (LUM[finalPriSize] ? LUM[finalPriSize].default : 1.0);
    primary.mass = STAR_MASS[finalPriSize] || 1.0;

    let sys = {
        nature: nature,
        stars: [primary],
        gasGiants: [],
        planetoidBelts: 0,
        worlds: [],
        _priIdx: priTypeIdx,
        _priRawIdx: priTypeRollUnmodified,
        _priDM: priDM,
    };

    function generateCompanion(role, trinaryDM) {
        logIndentIn();
        tSection('Companion Star');
        tRoll2D('Companion Type');
        if (priTypeRollUnmodified !== 0) tDM('Primary Type DM', priTypeRollUnmodified);
        let typeIdx = Math.max(0, Math.min(12, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)));

        tRoll2D('Companion Size');
        if (priSizeRollUnmodified !== 0) tDM('Primary Size DM', priSizeRollUnmodified);
        let sizeIdx = Math.max(0, Math.min(12, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)));

        let cType = CT_COMP_TYPE_TABLE[typeIdx];
        let rawCSize = CT_COMP_SIZE_TABLE[sizeIdx];
        let cDec = spectralDecimal(rawCSize);

        let cSize = applyStarSizeOverrides(cType, rawCSize, cDec);
        if (cSize !== rawCSize) {
            tOverride('Companion Star Size', rawCSize, cSize, 'Rule Override');
        }

        tResult('Companion Type', cType);
        tResult('Companion Size', cSize);

        let o = rollOrbit(trinaryDM);
        tResult('Companion Orbit', o.label);

        tRoll2D('Companion Max Orbits Base');
        let compMaxOrbitsBaseRoll = Math.max(0, Math.min(12, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0)));
        tResult('Companion Base Max Orbits', compMaxOrbitsBaseRoll);

        let cObj = {
            type: cType,
            size: cSize,
            decimal: cDec,
            name: starName(cType, cSize, cDec),
            role,
            orbit: o.orbit,
            orbitLabel: o.label,
            maxOrbits: calcMaxOrbits(compMaxOrbitsBaseRoll, cType, cSize),
        };
        logIndentOut();
        return cObj;
    }

    if (nature === 'Binary' || nature === 'Trinary') {
        sys.stars.push(generateCompanion('Companion', 0));
        if (nature === 'Trinary') {
            sys.stars.push(generateCompanion('Companion 2', 4));
        }
    }

    sys.maxOrbits = primary.maxOrbits;
    sys.totalOrbits = sys.stars.reduce((s, st) => s + st.maxOrbits, 0);

    let ggCount = 0;
    if (mainworldBase.gasGiant) {
        tRoll2D('Gas Giant Quantity');
        let ggRoll = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
        ggCount = Math.max(1, Math.floor(ggRoll / 2));
        tResult('Gas Giants Generated', ggCount);
    } else {
        ggCount = 0;
        tResult('Gas Giants Generated', 0);
    }

    ggCount = Math.min(ggCount, sys.maxOrbits);
    for (let i = 0; i < ggCount; i++) {
        sys.gasGiants.push({ size: roll1D() <= 3 ? 'Large' : 'Small' });
    }

    tRoll2D('Planetoid Belt Presence (6-)');
    if (ggCount > 0) tDM('Gas Giants DM', -ggCount);
    let pbPresRoll = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);
    let pbPresent = pbPresRoll <= 6;
    tResult('Planetoid Belts Present', pbPresent);

    let beltQty = 0;
    if (pbPresent) {
        tRoll2D('Planetoid Belt Quantity');
        if (ggCount > 0) tDM('Gas Giants DM', -ggCount);
        let pbQtyRoll = pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0);

        if (pbQtyRoll <= 0) beltQty = 3;
        else if (pbQtyRoll <= 6) beltQty = 2;
        else beltQty = 1;

        tResult('Planetoid Belts Rolled', beltQty);
    } else {
        tSkip('Planetoid Belt Quantity (None Present)');
    }

    let maxBelts = Math.max(0, sys.maxOrbits - ggCount);
    sys.planetoidBelts = Math.min(beltQty, maxBelts);
    tResult('Planetoid Belts Added', sys.planetoidBelts);

    if (mainworldBase && mainworldBase.size === 0) {
        if (sys.planetoidBelts === 0) {
            sys.planetoidBelts = 1;
            tOverride('Mainworld Forcing', 0, 1, 'Mainworld is an Asteroid Belt');
        }
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

    tSection('Orbital Zones & Companion Checks');
    for (let i = 1; i < sys.stars.length; i++) {
        let comp = sys.stars[i];
        let zone = getZoneForOrbit(pSize, pType, pDec, comp.orbit);

        if (zone === '-') {
            tOverride('Swallowed Companion', comp.orbitLabel, 'Close (Orbit 0)', 'Orbit falls inside primary');
            comp.orbit = 0;
            comp.orbitLabel = 'Close';
        }

        if (comp.orbitLabel === 'Far') {
            let distMult = tRoll1D('Far Orbit Distance Multiplier');
            comp.distAU = distMult * 1000;
            tResult(`${comp.role} Distance`, `${comp.distAU} AU`);

            let farSubCheck = tRoll2D('Far Sub-Companion Nature');
            if (farSubCheck >= 8 && farSubCheck <= 11) {
                logIndentIn();
                tSection(`Sub-Companion for ${comp.role}`);
                let subTypeRoll = tRoll2D('Sub-Companion Type');
                if (sys._priRawIdx !== 0) tDM('Primary Type DM', sys._priRawIdx);
                let typeIdx = Math.max(0, Math.min(12, subTypeRoll + sys._priRawIdx));

                let subSizeRoll = tRoll2D('Sub-Companion Size');
                if (sys._priRawIdx !== 0) tDM('Primary Size DM', sys._priRawIdx);
                let sizeIdx = Math.max(0, Math.min(12, subSizeRoll + sys._priRawIdx));

                let sType = CT_COMP_TYPE_TABLE[typeIdx];
                let rawSSize = CT_COMP_SIZE_TABLE[sizeIdx];
                let sDec = sType === 'D' ? null : (roll1D() <= 3 ? 0 : 5);

                let sSize = applyStarSizeOverrides(sType, rawSSize, sDec);
                if (sSize !== rawSSize) {
                    tOverride('Sub-Companion Size', rawSSize, sSize, 'Rule Override');
                }

                let subOrbit = tRoll2D('Sub-Companion Orbit') - 4;
                let subOrbitLabel = String(subOrbit);
                if (subOrbit <= 0) {
                    subOrbit = 0;
                    subOrbitLabel = 'Close';
                }

                tResult('Sub-Companion Type', sType);
                tResult('Sub-Companion Size', sSize);
                tResult('Sub-Companion Orbit', subOrbitLabel);

                let subComp = {
                    type: sType,
                    size: sSize,
                    decimal: sDec,
                    name: (sSize === 'D' ? `${sType} D` : `${sType}${sDec} ${sSize}`),
                    role: `${comp.role} Sub-Companion`,
                    orbit: subOrbit,
                    orbitLabel: subOrbitLabel,
                    maxOrbits: 0
                };

                sys.stars.push(subComp);
                logIndentOut();
            }
        }
    }

    sys.orbits = [];
    for (let i = 0; i <= sys.maxOrbits; i++) {
        let z = getZoneForOrbit(pSize, pType, pDec, i);
        sys.orbits.push({
            orbit: i,
            zone: z,
            contents: null
        });
    }

    const hOrbits = sys.orbits.filter(o => o.zone === 'H').map(o => o.orbit);
    if (hOrbits.length > 0) {
        tResult('Habitable Zone Determined', `Orbit(s): ${hOrbits.join(', ')}`);
    } else {
        tResult('Habitable Zone Determined', 'None');
    }

    // Separate Anomaly Checks: Empty Orbits and Captured Planets
    const anomalyTables = {
        emp: [null, false, false, false, false, true, true, true],
        cap: [null, false, false, false, false, true, true, true]
    };

    // 1. Empty Orbits Roll
    tRoll1D('Empty Orbit Presence Check');
    if (['B', 'A'].includes(pType)) tDM('B/A Star', 1);
    const empRoll = Math.min(7, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0));
    const empVac = anomalyTables.emp[empRoll];

    if (empVac) {
        const qtyTable = [0, 1, 1, 2, 3, 3, 3];
        tRoll1D('Empty Orbit Quantity');
        const actualQty = qtyTable[pendingRoll.val];
        tResult('Empty Orbits Rolled', actualQty);
        let placed = [];
        for (let i = 0; i < actualQty; i++) {
            let attempts = 0;
            while (attempts < 20) {
                const orbNum = roll2D();
                const slot = sys.orbits.find(o => o.orbit === orbNum);
                if (slot && !slot.contents) {
                    slot.contents = { type: 'Empty' };
                    placed.push(orbNum);
                    break;
                }
                attempts++;
            }
        }
        if (placed.length > 0) {
            tResult('Empty Orbit Locations', placed.join(', '));
        }
    } else {
        tResult('Empty Orbits', 'None');
    }

    // 2. Captured Planet Roll
    tRoll1D('Captured Planet Presence Check');
    if (['B', 'A'].includes(pType)) tDM('B/A Star', 1);
    const capRoll = Math.min(7, pendingRoll.val + pendingRoll.dms.reduce((a, d) => a + d.val, 0));
    const capPres = anomalyTables.cap[capRoll];

    if (capPres) {
        const qtyTable = [0, 1, 1, 2, 2, 3, 3];
        tRoll1D('Captured Planet Quantity');
        const actualQty = qtyTable[pendingRoll.val];
        tResult('Captured Planets Rolled', actualQty);
        let placed = [];
        for (let i = 0; i < actualQty; i++) {
            const baseline = roll2D();
            const deviation = (roll2D() - 7) * 0.1;
            const finalOrbit = Number((baseline + deviation).toFixed(1));
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
            placed.push(finalOrbit);
        }
        if (placed.length > 0) {
            tResult('Captured Planet Locations', placed.join(', '));
        }
    } else {
        tResult('Captured Planets', 'None');
    }

    tSection('Gas Giant & Planetoid Placement');
    const placeGG = (gg) => {
        let candidateSlots = sys.orbits.filter(o => (o.zone === 'H' || o.zone === 'O') && !o.contents);
        let target;

        if (candidateSlots.length > 0) {
            const idx = Math.floor(rng() * candidateSlots.length);
            target = candidateSlots[idx];
            tResult('Gas Giant Placement', `Orbit ${target.orbit} (Zone ${target.zone})`);
        } else {
            let insideSlots = sys.orbits.filter(o => o.zone === 'I' && !o.contents);
            if (insideSlots.length > 0) {
                const idx = Math.floor(rng() * insideSlots.length);
                target = insideSlots[idx];
                tResult('Gas Giant Orbit', `Fallback to inside orbit ${target.orbit} (Zone ${target.zone})`);
            } else {
                const newOrbitNum = sys.maxOrbits + 1;
                sys.maxOrbits = newOrbitNum;
                tOverride('Gas Giant Orbit', 'N/A', newOrbitNum, 'System full, adding outer orbit');
                const newSlot = {
                    orbit: newOrbitNum,
                    zone: 'O',
                    contents: null
                };
                sys.orbits.push(newSlot);
                target = newSlot;
            }
        }

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
        return target;
    };
    sys.gasGiants.forEach(gg => placeGG(gg));

    // Place Mainworld Second
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
            const target = hCandidates[Math.floor(rng() * hCandidates.length)];
            tResult('Mainworld Orbit', `Orbit ${target.orbit} (Selected from habitable candidate orbits: ${hCandidates.map(c => c.orbit).join(', ')})`);
            let mwDist = ORBIT_AU[Math.min(Math.floor(target.orbit), ORBIT_AU.length - 1)];
            if (target.contents && target.contents.type === 'Gas Giant') {
                if (!target.contents.satellites) target.contents.satellites = [];
                let mwThermal = getThermalStats({ hydro: mainworldBase.hydro, atm: mainworldBase.atm, distAU: mwDist, tradeCodes: mainworldBase.tradeCodes || [] }, sys.stars[0].luminosity || 1.0);
                let mwRot = getRotationStats({ size: mainworldBase.size });
                target.contents.satellites.push({
                    type: 'Mainworld',
                    distAU: mwDist,
                    pd: 10, // Assigned a default 'Close' satellite orbit to fix UI rendering
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
        let availableSlotsInner = sys.orbits.filter(o => o.zone !== '-' && !o.contents);
        if (availableSlotsInner.length > 0) {
            const target = availableSlotsInner[Math.floor(rng() * availableSlotsInner.length)];
            tResult('Mainworld Orbit', `Orbit ${target.orbit} (Available slot selected)`);
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
            tResult('Mainworld Orbit', `Orbit ${newOrbitNum} (Forced outer orbit)`);
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

    // Place Planetoids Third
    let availableSlots = sys.orbits.filter(o => o.zone !== '-' && !o.contents);
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
            target = availableSlots[Math.floor(rng() * availableSlots.length)];
        }

        if (target) {
            tResult('Planetoid Belt Placement', `Orbit ${target.orbit} (Zone ${target.zone})`);
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

    return sys;
}

function generateCTSystemChunk3(sys, mainworldBase) {
    if (!sys) return null;

    const mwPop = mainworldBase.pop;
    const primary = sys.stars[0];
    const pType = primary.type;

    const generateWorld = (world, orbitNum, zone) => {
        logIndentIn();

        if (world.type === 'Mainworld') {
            tResult('World Type', 'Mainworld (Stats pre-generated)');
        } else if (world.type === 'Planetoid Belt') {
            tResult('World Type', 'Planetoid Belt');
        } else {
            tResult('World Type', 'Standard World');
        }

        let sizeRollUnmodified = tRoll2D('Standard Size');
        if (orbitNum === 0) tDM('Orbit 0', -5);
        else if (orbitNum === 1) tDM('Orbit 1', -4);
        else if (orbitNum === 2) tDM('Orbit 2', -2);

        if (pType === 'M') tDM('M-Class Primary', -2);

        let sizeRoll = sizeRollUnmodified - 2;
        if (orbitNum === 0) sizeRoll -= 5;
        else if (orbitNum === 1) sizeRoll -= 4;
        else if (orbitNum === 2) sizeRoll -= 2;

        if (pType === 'M') sizeRoll -= 2;

        let size;
        if (sizeRoll <= 0) {
            size = 'S';
            if (sizeRoll !== 0) tClamp('Size', sizeRoll, 'S');
        } else {
            size = Math.min(10, sizeRoll);
            if (sizeRoll > 10) tClamp('Size', sizeRoll, 10);
        }
        world.size = size;
        tResult('Final Size', size);
        world.gravity = GRAV[size] !== undefined ? GRAV[size] : 1.0;
        world.diamKm = (size === 'S' ? 500 : size * 1600);

        let atmSizeVal = (size === 'S' ? 0 : size);
        let atmRollUnmodified = tRoll2D('Standard Atmosphere');
        tDM('Size Code', atmSizeVal);
        tDM('Standard Atm', -7);
        if (zone === 'I' || zone === 'O') tDM('Zone I/O', -2);

        let atmRoll = atmRollUnmodified - 7 + atmSizeVal;
        if (zone === 'I' || zone === 'O') atmRoll -= 2;

        let atm = Math.max(0, Math.min(15, atmRoll));
        if (atm !== atmRoll) tClamp('Atmosphere', atmRoll, atm);

        if (size === 0 || size === 'S') {
            atm = 0;
            tOverride('Atmosphere', atmRoll, 0, 'Size 0/S forces Atm 0');
        }

        const hOrbits = sys.orbits.filter(o => o.zone === 'H').map(o => o.orbit);
        if (hOrbits.length > 0) {
            const maxH = Math.max(...hOrbits);
            if (orbitNum >= maxH + 2) {
                let extremeRoll = tRoll2D('Extreme Orbit Atm Check (12)');
                if (extremeRoll === 12) {
                    atm = 10;
                    tOverride('Atmosphere', atmRoll, 10, 'Rolled 12 in extreme outer orbit');
                }
            }
        }
        world.atm = atm;
        tResult('Final Atmosphere', atm);

        let hydroRollUnmodified = tRoll2D('Standard Hydrographics');
        tDM('Atm/Size', atmSizeVal);
        tDM('Standard Hydro', -7);
        let hydroRoll = hydroRollUnmodified - 7 + atmSizeVal;

        if (atm === 0 || atm === 1 || atm >= 10) {
            hydroRoll -= 4;
            tDM('Atmosphere Extreme', -4);
        }
        if (zone === 'O') {
            hydroRoll -= 4;
            tDM('Zone O', -4);
        }

        let hydro = Math.max(0, Math.min(10, hydroRoll));
        if (hydro !== hydroRoll) tClamp('Hydrographics', hydroRoll, hydro);

        if (zone === 'I' || size === 1 || size === 'S') {
            hydro = 0;
            tOverride('Hydrographics', hydroRoll, 0, 'Zone I or Size 1/S forces Hydro 0');
        }
        world.hydro = hydro;
        tResult('Final Hydrographics', hydro);

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

        logIndentOut();
    };

    tSection('System Orbits & World Placement');
    sys.orbits.forEach(slot => {
        writeLogLine(`\nEvaluating Orbit: ${slot.orbit}`);

        if (!slot.contents) {
            let emptyCheck = tRoll1D('Empty Orbit Check (Orbital Zone DM)');
            let emptyMod = 0;
            if (slot.zone === 'O') emptyMod = 1;
            else if (slot.zone === 'H') emptyMod = -1;
            else if (slot.zone === 'I') emptyMod = -2;

            if (emptyMod !== 0) tDM(`Zone ${slot.zone} DM`, emptyMod);

            // Replicating baseline standard empty logic for standard empty orbits in chunk 3
            // In typical Book 6, roll 1D + DM. 5+ is empty.
            if ((emptyCheck + emptyMod) >= 5) {
                slot.contents = { type: 'Empty' };
            } else {
                slot.contents = { type: 'Terrestrial Planet' };
            }
        }

        if (slot.contents.type === 'Empty' || slot.contents.type === 'Captured Planet' || slot.contents.type === 'Gas Giant') {
            tResult('Status', slot.contents.type === 'Empty' ? 'Empty' : 'World/Belt Present');
        } else {
            tResult('Status', 'World/Belt Present');
            generateWorld(slot.contents, slot.orbit, slot.zone);
        }
    });

    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(cp => {
            writeLogLine(`\nEvaluating Captured Orbit: ${cp.orbit}`);
            tResult('Status', 'World/Belt Present');
            generateWorld(cp, cp.orbit, cp.zone);
        });
    }

    return sys;
}

function generateCTSystemChunk4(sys, mainworldBase) {
    if (!sys) return null;
    tSection('Satellite Generation');

    const mwPop = mainworldBase.pop;

    const SATELLITE_ORBITS = {
        Ring: [0, 1, 1, 1, 2, 2, 3],
        Close: [0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        Far: [0, 0, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
        Extreme: [0, 0, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325]
    };

    const generateMoons = (parent, orbitNum, zone) => {
        writeLogLine(`\nEvaluating Satellites for: ${parent.type} (Orbit ${orbitNum})`);

        if (parent.size === 0 || parent.size === 'S') {
            tSkip('Parent size 0 or S cannot have satellites');
            return;
        }

        let qty = 0;
        if (parent.type === 'Gas Giant') {
            if (['LGG', 'Large'].includes(parent.size)) {
                qty = tRoll2D('Moon Qty (LGG)');
            } else {
                qty = tRoll2D('Moon Qty (Gas Giant)') - 4;
                tDM('Standard GG', -4);
            }
        } else if (parent.type === 'Mainworld' || parent.type === 'Terrestrial Planet') {
            qty = tRoll1D('Moon Qty (Terrestrial)') - 3;
            tDM('Terrestrial', -3);
        }
        qty = Math.max(0, qty);
        tResult('Moons to Generate', qty);
        if (qty <= 0) return;

        if (!parent.satellites) parent.satellites = [];
        const startingSatQty = parent.satellites.length;
        let usedDistances = new Set();
        parent.satellites.forEach(s => { if (s.pd) usedDistances.add(s.pd); });

        for (let i = startingSatQty; i < qty; i++) {
            logIndentIn();
            writeLogLine(`--- Satellite ${i + 1} ---`);
            let moon = { type: 'Satellite' };

            let sizeRoll;
            if (parent.type === 'Gas Giant') {
                let ggMoonsizeUnmod = tRoll2D('Satellite Size Roll');
                if (['LGG', 'Large'].includes(parent.size)) {
                    sizeRoll = ggMoonsizeUnmod - 4;
                    tDM('Large GG', -4);
                } else {
                    sizeRoll = ggMoonsizeUnmod - 6;
                    tDM('Small GG', -6);
                }
            } else {
                let pSize = parent.size;
                if (parent.type === 'Mainworld' && mainworldBase.size !== undefined) {
                    pSize = mainworldBase.size;
                }
                let terrMoonsizeUnmod = tRoll1D('Satellite Size Roll');
                tDM('Parent Size', pSize);
                sizeRoll = pSize - terrMoonsizeUnmod;
            }

            if (sizeRoll === 0) moon.size = 'R';
            else if (sizeRoll < 0) moon.size = 'S';
            else moon.size = Math.min(10, sizeRoll);
            tResult('Satellite Size', moon.size);

            moon.gravity = (moon.size === 'R' ? 0 : (GRAV[moon.size] !== undefined ? GRAV[moon.size] : 1.0));
            moon.diamKm = (moon.size === 'R' ? 0 : (moon.size === 'S' ? 500 : moon.size * 1600));

            let dist = null;
            let attempt = 0;
            while (dist === null && attempt < 15) {
                attempt++;
                if (moon.size === 'R') {
                    let ringRoll = typeof tRoll1D !== "undefined" ? tRoll1D('Ring Orbit Roll') : roll1D(); // safety fallback
                    dist = SATELLITE_ORBITS.Ring[ringRoll];
                } else {
                    let catRoll = tRoll2D('Orbit Category');
                    if (i !== 0) tDM('Prior Satellites', -i);
                    catRoll -= i;
                    let cat = 'Close';
                    if (catRoll >= 12 && parent.type === 'Gas Giant') cat = 'Extreme';
                    else if (catRoll >= 8) cat = 'Far';

                    let distRoll = tRoll2D('Orbit Distance Roll');
                    dist = SATELLITE_ORBITS[cat][distRoll];
                }
                if (usedDistances.has(dist)) dist = null;
            }
            if (dist === null) {
                logIndentOut();
                continue;
            }
            usedDistances.add(dist);
            moon.pd = dist;
            tResult('Orbital Radii', dist);

            let szVal = (moon.size === 'S' || moon.size === 'R') ? 0 : moon.size;
            let atmRollUnmod = tRoll2D('Satellite Atmosphere');
            tDM('Size Code', szVal);
            tDM('Standard Atm', -7);
            if (zone === 'I' || zone === 'O') tDM('Zone I/O', -4);

            let atmRoll = atmRollUnmod - 7 + szVal;
            if (zone === 'I' || zone === 'O') atmRoll -= 4;
            let atm = Math.max(0, Math.min(15, atmRoll));
            if (atm !== atmRoll) tClamp('Atmosphere', atmRoll, atm);
            if (szVal <= 1) {
                atm = 0;
                tOverride('Atmosphere', atmRoll, 0, 'Size 0/S/R forces Atm 0');
            }

            const hOrbits = sys.orbits.filter(o => o.zone === 'H').map(o => o.orbit);
            if (hOrbits.length > 0) {
                const maxH = Math.max(...hOrbits);
                if (orbitNum >= maxH + 2) {
                    let extremeRoll = tRoll2D('Extreme Orbit Atm Check (12)');
                    if (extremeRoll === 12) {
                        atm = 10;
                        tOverride('Atmosphere', atmRoll, 10, 'Rolled 12 in extreme outer orbit');
                    }
                }
            }
            moon.atm = atm;
            tResult('Final Atmosphere', atm);

            let hydroRollUnmod = tRoll2D('Satellite Hydrographics');
            tDM('Atm/Size', szVal);
            tDM('Standard Hydro', -7);
            let hydroRoll = hydroRollUnmod - 7 + szVal;

            if (atm <= 1 || atm >= 10) {
                hydroRoll -= 4;
                tDM('Atmosphere Extreme', -4);
            }
            if (zone === 'O') {
                hydroRoll -= 2;
                tDM('Zone O', -2);
            }
            let hydro = Math.max(0, Math.min(10, hydroRoll));
            if (hydro !== hydroRoll) tClamp('Hydrographics', hydroRoll, hydro);

            if (zone === 'I' || szVal <= 1) {
                hydro = 0;
                tOverride('Hydrographics', hydroRoll, 0, 'Zone I or Size 0/S/R forces Hydro 0');
            }
            moon.hydro = hydro;
            tResult('Final Hydrographics', hydro);

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
            logIndentOut();
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
        writeLogLine(`\n--- Fleshing out: ${w.type} (Orbit ${orbitNum}) ---`);
        if (w.type === 'Empty' || w.size === 0 || w.size === 'R' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') {
            tSkip('Non-habitable/Empty body (Gov 0, Law 0, Port Y)');
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
            tResult('Facility Added', 'Farming');
        }
        if (isIndustrial && w.pop >= 2) {
            w.facilities.push('Mining');
            tResult('Facility Added', 'Mining');
        }
        if (w.gov === 6 && w.pop >= 5) {
            w.facilities.push('Colony');
            tResult('Facility Added', 'Colony');
        }
        if (mwTL >= 9 && w.pop > 0) {
            let labRollUnmod = tRoll2D('Research Lab (11+)');
            let labRoll = labRollUnmod;
            if (mwTL >= 10) {
                labRoll += 2;
                tDM('High Tech', 2);
            }
            if (labRoll >= 11) {
                w.facilities.push('Research Laboratory');
                tResult('Facility Added', 'Research Laboratory');
            }
        }
        if (w.pop > 0 && !isPoor) {
            let milRollUnmod = tRoll2D('Military Base (12+)');
            let milRoll = milRollUnmod;
            if (mwPop >= 8) {
                milRoll += 1;
                tDM('High Pop', 1);
            }
            if (w.atm === mwAtm) {
                milRoll += 2;
                tDM('Matching Atmosphere', 2);
            }
            if (hasBase) {
                milRoll += 1;
                tDM('Mainworld Base', 1);
            }
            if (milRoll >= 12) {
                w.facilities.push('Military Base');
                tResult('Facility Added', 'Military Base');
            }
        }

        // 4. Re-Apply Facility TL Bonuses (if added after helper)
        if (w.facilities.includes('Research Laboratory') || w.facilities.includes('Military Base')) {
            if (w.tl !== mwTL) tOverride('Special Facility', w.tl, mwTL, 'Base matches Mainworld TL');
            w.tl = mwTL;
        }

        let spRollUnmod = tRoll1D('Spaceport');
        let spRoll = spRollUnmod;
        if (w.pop >= 6) {
            spRoll += 2;
            tDM('Pop 6+', 2);
        }
        else if (w.pop === 1) {
            spRoll -= 2;
            tDM('Pop 1', -2);
        }
        else if (w.pop === 0) {
            spRoll -= 3;
            tDM('Pop 0', -3);
        }

        let sp = 'Y';
        if (spRoll <= 2) sp = 'Y';
        else if (spRoll === 3) sp = 'H';
        else if (spRoll <= 5) sp = 'G';
        else sp = 'F';
        w.spaceport = sp;
        tResult('Spaceport Class', sp);

        const sChar = (w.size === 'S' ? 'S' : toUWPChar(w.size));
        w.uwpSecondary = constructCTUPP(w);
        tResult('Subordinate UWP', w.uwpSecondary);
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
function generateCTPhysical(base, hexId) {
    if (!base) return null;
    reseedForHex(hexId);

    let roll = roll2D();
    let dm = 0;
    if ((base.atm >= 4 && base.atm <= 9) || base.pop >= 8) dm = 4;
    let modRoll = Math.max(0, Math.min(12, (roll + dm) - 2));
    let stellarSize = CT_PRI_SIZE_TABLE[modRoll];
    let spectralLetter = CT_PRI_TYPE_TABLE[modRoll];

    let decimal = stellarSize === 'D' ? '' : (roll1D() <= 3 ? '0' : '5');
    let spectralKey = spectralLetter + decimal;
    let homestar = stellarSize === 'D' ? `${spectralLetter} D` : `${spectralKey} ${stellarSize}`;

    let hzOrbit = 2;
    let zoneRow = ZONE_H_TABLE[stellarSize];
    if (zoneRow) {
        hzOrbit = (zoneRow[spectralKey] !== undefined) ? zoneRow[spectralKey] : (zoneRow.default !== undefined ? zoneRow.default : 2);
    }
    tResult('Habitable Zone Orbit', hzOrbit);

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
