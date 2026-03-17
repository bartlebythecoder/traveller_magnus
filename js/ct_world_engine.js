// =====================================================================
// CLASSIC TRAVELLER: WORLD ENGINE (Atomic Rules)
// =====================================================================
// This module contains the literal rule logic from Book 3 and Book 6.
// It supports both "Continuation" and "Expanded" generation timings.

// Browser-safe imports
var orbitalAU, luminosityTable, starMassTable, zoneTables, satelliteOrbits, skeletonQuantities, anomalyLogic, bodySizes;

if (typeof module !== 'undefined' && module.exports) {
    const { ORBIT_AU, LUM, STAR_MASS, ZONE_TABLES, SATELLITE_ORBITS, CT_SKELETON_QUANTITIES, CT_ANOMALY_LOGIC, CT_BODY_SIZES } = require('./ct_constants');
    orbitalAU = ORBIT_AU;
    luminosityTable = LUM;
    starMassTable = STAR_MASS;
    zoneTables = ZONE_TABLES;
    satelliteOrbits = SATELLITE_ORBITS;
    skeletonQuantities = CT_SKELETON_QUANTITIES;
    anomalyLogic = CT_ANOMALY_LOGIC;
    bodySizes = CT_BODY_SIZES;
} else {
    // In browser, these are globals from ct_constants.js
    orbitalAU = typeof ORBIT_AU !== 'undefined' ? ORBIT_AU : [];
    luminosityTable = typeof LUM !== 'undefined' ? LUM : {};
    starMassTable = typeof STAR_MASS !== 'undefined' ? STAR_MASS : {};
    zoneTables = typeof ZONE_TABLES !== 'undefined' ? ZONE_TABLES : {};
    satelliteOrbits = typeof SATELLITE_ORBITS !== 'undefined' ? SATELLITE_ORBITS : {};
    skeletonQuantities = typeof CT_SKELETON_QUANTITIES !== 'undefined' ? CT_SKELETON_QUANTITIES : {};
    anomalyLogic = typeof CT_ANOMALY_LOGIC !== 'undefined' ? CT_ANOMALY_LOGIC : {};
    bodySizes = typeof CT_BODY_SIZES !== 'undefined' ? CT_BODY_SIZES : {};
}

// Helper: Convert number to UWP Char (0-15 -> 0-F)
function toUWPChar(val) {
    if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return '0';
    if (typeof val === 'string') return val.toUpperCase().substring(0, 1);
    return Math.floor(val).toString(16).toUpperCase();
}

/**
 * 1. PHYSICAL CHARACTERISTICS
 * Rolls Size, Atmosphere, and Hydrographics using legacy algorithms.
 */
function generatePhysicals(body, zone) {
    if (body.type === 'Gas Giant' || body.type === 'Planetoid Belt' || body.type === 'Empty' || body.type === 'Nature') {
        return body;
    }

    // A. SIZE
    if (body.type !== 'Satellite' && body.size === undefined) {
        tSection('Planetary Size');
        tDM('Standard Size', -2);
        let sizeRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Size Roll') : 7) - 2;
        body.size = Math.max(0, sizeRoll);
        tResult('Size Code', body.size);
    }
    const szVal = (body.size === 'S' || body.size === 'R') ? 0 : Number(body.size);

    // B. ATMOSPHERE
    tSection('Planetary Atmosphere');
    if (szVal === 0) {
        body.atm = 0;
        tSkip('Atmosphere (Asteroid/Size 0 forces Atm 0)');
        tResult('Atmosphere Code', 0);
    } else {
        tDM('Size Code', szVal);
        tDM('Standard Atm', -7);
        let atmRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Atmosphere Roll') : 7) - 7 + szVal;
        if (zone === 'I' || zone === 'O') {
            tDM('Zone I/O', -4);
            atmRoll -= 4;
        }
        body.atm = Math.max(0, Math.min(15, atmRoll));
        tResult('Atmosphere Code', body.atm);
    }

    // C. HYDROGRAPHICS
    tSection('Hydrographic Percentage');
    if (szVal === 0 || zone === 'I') {
        body.hydro = 0;
        tSkip(szVal === 0 ? 'Hydrographics (Asteroid/Size 0 forces Hydro 0)' : 'Hydrographics (Zone I is dry)');
        tResult('Hydrographic Code', 0);
    } else {
        tDM('Size Code', szVal);
        tDM('Standard Hyd', -7);
        let hydRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Hydrographics Roll') : 7) - 7 + szVal;
        if (body.atm <= 1 || body.atm >= 10) {
            tDM('Extreme Atmosphere', -4);
            hydRoll -= 4;
        }
        if (zone === 'O') {
            tDM('Zone O', -2);
            hydRoll -= 2;
        }
        body.hydro = Math.max(0, Math.min(10, hydRoll));
        tResult('Hydrographic Code', body.hydro);
    }

    return body;
}

/**
 * 2. BASE POPULATION (Physical Characteristic)
 * Rolls base population based on location and atmosphere.
 * @param {Object} world - The world object.
 * @param {Object} [ctx] - Context object { mode: 'topdown'|'bottomup', mwPop: number }.
 */
function generatePopulation(world, ctx = { mode: 'bottomup' }) {
    tSection('Population');
    if (world.size === 'R' || world.size === 0 || world.type === 'Empty' || world.type === 'Gas Giant') {
        world.pop = 0;
        tSkip('Population (Asteroid/Rings/GG/Empty cannot have baseline population)');
        tResult('Population Code', 0);
        return world;
    }

    tDM('Standard Pop', -2);
    let popRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Population Roll') : 7) - 2;

    // Location DMs (Book 6 Tables)
    if (world.type === 'Satellite') {
        if (world.zone === 'I') { tDM('Zone I (Satellite)', -6); popRoll -= 6; }
        else if (world.zone === 'O') { tDM('Zone O (Satellite)', -1); popRoll -= 1; }
    } else { // Terrestrial/Captured
        if (world.zone === 'I') { tDM('Zone I', -5); popRoll -= 5; }
        else if (world.zone === 'O') { tDM('Zone O', -3); popRoll -= 3; }
    }

    // Atmosphere Penalty: If Atmo is NOT 0, 5, 6, 8, subtract 2.
    if (![0, 5, 6, 8].includes(world.atm)) {
        tDM(`Atmosphere ${toUWPChar(world.atm)} Penalty`, -2);
        popRoll -= 2;
    }

    world.pop = Math.max(0, popRoll);

    // Mode-Aware Population Clamp (Top-Down only)
    if (ctx.mode === 'topdown' && ctx.mwPop !== undefined && ctx.mwPop !== null) {
        if (world.pop >= ctx.mwPop) {
            const oldPop = world.pop;
            world.pop = Math.max(0, ctx.mwPop - 1);
            if (typeof tOverride !== 'undefined' && oldPop !== world.pop) {
                tOverride('Subordinate Pop Cap', oldPop, world.pop, 'Cannot exceed Mainworld Pop');
            }
        }
    }

    tResult('Population Code', world.pop);
    return world;
}

/**
 * 3. MASTER MAINWORLD GENERATOR
 * Replicates the full Book 3 sequence: Starport -> Bases -> GG -> UWP
 */
function generateModularMainworld(hexId) {
    if (typeof reseedForHex !== 'undefined') reseedForHex(hexId);
    
    let mwName = (typeof getNextSystemName !== 'undefined') ? getNextSystemName(hexId) : 'Unknown';
    if (typeof startTrace !== 'undefined') startTrace(hexId, 'Modular CT Generation', mwName);

    let mw = { 
        type: 'Mainworld',
        name: mwName
    };

    // A. Starport
    tSection('Starport Generation');
    let spRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Mainworld Starport') : 7);
    if (spRoll <= 4) mw.starport = 'A';
    else if (spRoll <= 6) mw.starport = 'B';
    else if (spRoll <= 8) mw.starport = 'C';
    else if (spRoll === 9) mw.starport = 'D';
    else if (spRoll <= 11) mw.starport = 'E';
    else mw.starport = 'X';
    tResult('Starport Class', mw.starport);

    // B. Bases
    tSection('Bases & Gas Giants');
    mw.navalBase = false;
    mw.scoutBase = false;
    if (['A', 'B'].includes(mw.starport)) {
        if ((typeof tRoll2D !== 'undefined' ? tRoll2D('Naval Base Check') : 7) >= 8) mw.navalBase = true;
        tResult('Naval Base Present', mw.navalBase);
    } else {
        tSkip('Naval Base (Requires Starport A or B)');
    }

    let sbDM = 0;
    if (mw.starport === 'A') sbDM = -3;
    else if (mw.starport === 'B') sbDM = -2;
    else if (mw.starport === 'C') sbDM = -1;
    
    if (['A', 'B', 'C', 'D'].includes(mw.starport)) {
        tDM(`Starport ${mw.starport}`, sbDM);
        if ((typeof tRoll2D !== 'undefined' ? tRoll2D('Scout Base Check') : 7) + sbDM >= 7) mw.scoutBase = true;
        tResult('Scout Base Present', mw.scoutBase);
    } else {
        tSkip('Scout Base (Requires Starport A-D)');
    }

    // C. Gas Giant Presence
    mw.gasGiant = (typeof tRoll2D !== 'undefined' ? tRoll2D('Gas Giant Presence') : 7) >= 10;
    tResult('Gas Giant Present', mw.gasGiant);

    // D. Physicals -> Physical pass will handle sections
    generatePhysicals(mw, 'H');

    // E. Population -> Population pass will handle sections
    generatePopulation(mw);

    // F. Finalize Social
    finalizeMainworldSocial(mw);

    if (typeof endTrace !== 'undefined') endTrace();
    return mw;
}

/**
 * 4. SOCIETAL: MAINWORLD SOCIAL FINALIZATION
 * Generates Govt, Law, TL for a designated Mainworld.
 */
function finalizeMainworldSocial(world) {
    tSection('Government');
    if (world.pop === 0) {
        world.gov = 0; world.law = 0; world.tl = 0;
        tSkip('Social stats (Population 0 forces Gov 0, Law 0, TL 0)');
        const uwp = `${world.starport || '?'}${toUWPChar(world.size)}${toUWPChar(world.atm)}${toUWPChar(world.hydro)}${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;
        world.uwp = uwp;
        world.uwpSecondary = uwp;
        return world;
    }

    // Govt: 2D-7 + Pop
    tDM('Standard Gov', -7);
    tDM('Population Code', world.pop);
    let govRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Government Roll') : 7);
    world.gov = Math.max(0, Math.min(15, govRoll - 7 + world.pop));
    tResult('Government Code', world.gov);

    // Law: 2D-7 + Govt
    tSection('Law Level');
    tDM('Standard Law', -7);
    tDM('Government Code', world.gov);
    let lawRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Law Level Roll') : 7);
    world.law = Math.max(0, Math.min(15, lawRoll - 7 + world.gov));
    tResult('Law Level Code', world.law);

    // TL: Starport + Size + Atmo + Hydro + Pop + Gov bonuses
    tSection('Technological Level');
    world.tl = calculateTLModular(world, true);
    tResult('Tech Level Code', world.tl);
    
    // Trade Codes
    tSection('Trade Classifications & Zones');
    world.tradeCodes = generateTradeCodes(world);
    tResult('Final Trade Codes', world.tradeCodes.join(' '));

    // Final UWP String
    world.uwp = `${world.starport}${toUWPChar(world.size)}${toUWPChar(world.atm)}${toUWPChar(world.hydro)}${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;

    return world;
}

/**
 * MASTER SOCIAL GENERATOR (For Bottom-Up Designation)
 * Rolls Starport, then calls Social Finalization.
 */
function generateSocial(world) {
    tSection('Mainworld Social Generation');
    
    // A. Starport
    tSection('Starport Generation');
    let spRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Mainworld Starport') : 7);
    if (spRoll <= 4) world.starport = 'A';
    else if (spRoll <= 6) world.starport = 'B';
    else if (spRoll <= 8) world.starport = 'C';
    else if (spRoll === 9) world.starport = 'D';
    else if (spRoll <= 11) world.starport = 'E';
    else world.starport = 'X';
    tResult('Starport Class', world.starport);

    // B. Finalize Social (Gov, Law, TL, Trade)
    finalizeMainworldSocial(world);
    
    return world;
}

/**
 * HELPER: TRADE CLASSIFICATIONS
 */
function generateTradeCodes(w) {
    let codes = [];
    const { atm, hydro, pop, gov, size } = w;

    if (atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7) codes.push("Ag");
    if (atm <= 3 && hydro <= 3 && pop >= 6) codes.push("Na");
    if ([0, 1, 2, 4, 7, 9].includes(atm) && pop >= 9) codes.push("In");
    if (pop <= 6) codes.push("Ni");
    if (gov >= 4 && gov <= 9 && [6, 8].includes(atm) && pop >= 6 && pop <= 8) codes.push("Ri");
    if (atm >= 2 && atm <= 5 && hydro <= 3) codes.push("Po");
    if (hydro === 10) codes.push("Wa");
    if (hydro === 0) codes.push("De");
    if (atm === 0) codes.push("Va");
    if (size === 0) codes.push("As");
    if ([0, 1].includes(atm) && hydro >= 1) codes.push("Ic");

    return codes;
}

/**
 * 4. SOCIETAL: SUBORDINATE GENERATION
 * Generates Govt, Law, TL, and Spaceport for a subordinate world.
 * Requires a reference to the already-finalized Mainworld.
 */
function finalizeSubordinateSocial(world, mwRef) {
    // A. Population Cap (Safety redundancy, generatePopulation handles this now in Top-Down)
    if (world.pop >= mwRef.pop) {
        const oldPop = world.pop;
        world.pop = Math.max(0, mwRef.pop - 1);
        if (typeof tOverride !== 'undefined' && oldPop !== world.pop) {
            tOverride('Subordinate Pop Cap', oldPop, world.pop, 'Cannot exceed Mainworld Pop');
        }
    }

    if (world.pop === 0) {
        world.starport = 'Y';
        world.spaceport = 'Y';
        world.gov = 0; 
        world.law = 0; 
        world.tl = 0;
        
        const uwp = `${world.starport || world.spaceport}${toUWPChar(world.size)}${toUWPChar(world.atm)}${toUWPChar(world.hydro)}${toUWPChar(world.pop)}00-0`;
        world.uwp = uwp;
        world.uwpSecondary = uwp;
        return world;
    }

    // Subordinate Govt
    if (mwRef.gov === 6) {
        world.gov = 6;
    } else {
        let govDM = 0;
        if (mwRef.gov >= 7) govDM = 2;
        if (govDM !== 0) tDM('Mainworld Gov 7+', govDM);
        let govRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('Subordinate Gov') : 3);
        world.gov = (govRoll + govDM >= 5) ? 6 : (govRoll + govDM);
    }

    // Subordinate Law: 1D-3 + MW Law
    tDM('Mainworld Law', mwRef.law);
    tDM('Standard Law', -3);
    let lawRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('Subordinate Law') : 3);
    world.law = Math.max(0, Math.min(15, lawRoll - 3 + mwRef.law));

    // Spaceport
    let spDM = 0;
    if (world.pop >= 6) spDM = 2;
    else if (world.pop === 1) spDM = -2;
    if (spDM !== 0) tDM(`Population ${world.pop}`, spDM);
    let spRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('Subordinate Spaceport') : 3);
    let finalSP = spRoll + spDM;
    if (finalSP <= 2) { world.spaceport = 'Y'; world.starport = 'Y'; }
    else if (finalSP === 3) { world.spaceport = 'H'; world.starport = 'H'; }
    else if (finalSP <= 5) { world.spaceport = 'G'; world.starport = 'G'; }
    else { world.spaceport = 'F'; world.starport = 'F'; }

    // TL Baseline (Rule: MW TL - 1, or equal if special facility present)
    const hasSpecialFacility = (world.militaryBase || world.researchBase || 
                               (world.facilities && (world.facilities.includes('Research Laboratory') || 
                                                     world.facilities.includes('Military Base'))));
    
    if (hasSpecialFacility) {
        world.tl = mwRef.tl;
        if (typeof tResult !== 'undefined') tResult('TL (Facility Bonus)', world.tl);
    } else {
        world.tl = Math.max(0, mwRef.tl - 1);
        if (typeof tResult !== 'undefined') tResult('TL (Baseline MW-1)', world.tl);
    }

    // Book 6 Environmental Floor (Corrosive, Vacuum, etc. requires TL 7)
    if (world.tl < 7 && ![5, 6, 8].includes(world.atm)) {
        if (typeof tOverride !== 'undefined') {
            tOverride('TL Environmental Floor', world.tl, 7, 'Hostile atmosphere requires life-support tech');
        }
        world.tl = 7;
    }

    // Trade Codes
    world.tradeCodes = generateTradeCodes(world);

    // Final UWP String
    const uwp = `${world.starport || world.spaceport}${toUWPChar(world.size)}${toUWPChar(world.atm)}${toUWPChar(world.hydro)}${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;
    world.uwp = uwp;
    world.uwpSecondary = uwp;

    return world;
}

/**
 * HELPER: TECH LEVEL CALCULATION
 */
function calculateTLModular(w, isMainworld) {
    let tlBaseRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('TL Base Roll') : 3);
    let tl = tlBaseRoll;
    
    // Starport
    const sp = isMainworld ? w.starport : (w.spaceport || 'F'); 
    if (sp === 'A') { tDM('Starport A', 6); tl += 6; }
    else if (sp === 'B') { tDM('Starport B', 4); tl += 4; }
    else if (sp === 'C') { tDM('Starport C', 2); tl += 2; }
    else if (sp === 'F') { tDM('Starport F', 1); tl += 1; }
    else if (sp === 'X' || sp === 'Y') { tDM(`Starport ${sp}`, -4); tl -= 4; }

    // Size
    if (w.size <= 1) { tDM('Size 0-1', 2); tl += 2; }
    else if (w.size <= 4) { tDM('Size 2-4', 1); tl += 1; }

    // Atmo
    if (w.atm <= 3 || w.atm >= 10) { tDM(`Atmosphere ${toUWPChar(w.atm)}`, 1); tl += 1; }

    // Hydro
    if (w.hydro === 9) { tDM('Hydro 9', 1); tl += 1; }
    else if (w.hydro === 10) { tDM('Hydro 10', 2); tl += 2; }

    // Pop
    if (w.pop >= 1 && w.pop <= 5) { tDM('Population 1-5', 1); tl += 1; }
    else if (w.pop === 9) { tDM('Population 9', 2); tl += 2; }
    else if (w.pop === 10) { tDM('Population 10', 4); tl += 4; }

    // Gov
    if (w.gov === 0 || w.gov === 5) { tDM('Government 0/5', 1); tl += 1; }
    else if (w.gov === 13) { tDM('Government 13', -2); tl -= 2; }

    return Math.max(0, tl);
}

/**
 * 5. SYSTEM SKELETON ROLLING
 * Centralized rolling for Gas Giants, Planetoid Belts, and Anomalies.
 */
function rollSystemSkeleton(primaryStar) {
    if (!skeletonQuantities || !anomalyLogic) return null;

    const skeleton = {
        ggs: [],
        belts: 0,
        capturedPlanets: [],
        emptyOrbits: []
    };

    // A. Gas Giants
    tSection('Gas Giant Presence');
    const ggPresenceRoll = tRoll2D('GG Presence Roll');
    if (ggPresenceRoll >= skeletonQuantities.GG_PRESENCE_MAX) {
        const ggQtyRoll = tRoll2D('GG Quantity Roll');
        const count = skeletonQuantities.GG_QTY[ggQtyRoll] || 0;
        tResult('Gas Giants Rolled', count);
        for (let i = 0; i < count; i++) {
            const sizeRoll = tRoll1D(`GG ${i + 1} Size Roll`);
            const ggSize = (sizeRoll <= 3) ? 'Large' : 'Small';
            skeleton.ggs.push({ type: 'Gas Giant', size: ggSize });
        }
    } else {
        tResult('Gas Giants', 'None');
    }

    // B. Planetoid Belts
    tSection('Planetoid Belt Presence');
    const pbPresenceRoll = tRoll2D('PB Presence Roll');
    if (pbPresenceRoll >= skeletonQuantities.PB_PRESENCE_MAX) {
        const pbQtyRoll = tRoll2D('PB Quantity Roll');
        skeleton.belts = skeletonQuantities.PB_QTY[pbQtyRoll] || 0;
        tResult('Planetoid Belts Rolled', skeleton.belts);
    } else {
        tResult('Planetoid Belts', 'None');
    }

    // C. Empty Orbits (Anomaly 1)
    const starTypeGroup = (['B', 'A'].includes(primaryStar.type)) ? 'ANOMALY_DM_STARS' : null;
    let anomalyDM = (starTypeGroup) ? 1 : 0;
    if (anomalyDM) tDM(`Star Type ${primaryStar.type}`, anomalyDM);

    tSection('Empty Orbits');
    if (tRoll1D('Empty Orbit Presence Roll') + anomalyDM >= anomalyLogic.EMPTY.threshold) {
        const qtyRoll = tRoll1D('Quantity Roll');
        const qty = anomalyLogic.EMPTY.qty[qtyRoll] || 0;
        tResult('Empty Orbits Rolled', qty);
        for (let i = 0; i < qty; i++) {
            skeleton.emptyOrbits.push(tRoll2D('Empty Orbit Slot Roll'));
        }
    } else {
        tResult('Empty Orbits', 'None');
    }

    // D. Captured Planets (Anomaly 2)
    tSection('Captured Planets');
    if (tRoll1D('Captured Planet Presence Roll') + anomalyDM >= anomalyLogic.CAPTURED.threshold) {
        const qtyRoll = tRoll1D('Quantity Roll');
        const qty = anomalyLogic.CAPTURED.qty[qtyRoll] || 0;
        tResult('Captured Planets Rolled', qty);
        for (let i = 0; i < qty; i++) {
            const baseline = tRoll2D('Baseline Orbit Roll');
            const deviation = (tRoll2D('Orbit Deviation Roll') - 7) * 0.1;
            const finalOrbit = Number((baseline + deviation).toFixed(1));
            skeleton.capturedPlanets.push({ type: 'Captured Planet', orbit: finalOrbit });
        }
    } else {
        tResult('Captured Planets', 'None');
    }

    return skeleton;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generatePhysicals,
        generatePopulation,
        generateModularMainworld,
        finalizeMainworldSocial,
        finalizeSubordinateSocial,
        generateTradeCodes,
        rollSystemSkeleton,
        generateSocial
    };
} else {
    window.CT_World_Engine = {
        generatePhysicals,
        generatePopulation,
        generateModularMainworld,
        finalizeMainworldSocial,
        finalizeSubordinateSocial,
        generateTradeCodes,
        rollSystemSkeleton,
        generateSocial
    };
}
