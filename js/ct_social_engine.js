// =====================================================================
// CLASSIC TRAVELLER: MODULAR SOCIAL ENGINE
// =====================================================================
// Implements the two-pass social generation logic from Book 6: Scouts.

/**
 * PHASE 2: BASELINE POPULATION SWEEP
 * Roll base population for a world based on location and atmosphere.
 */
function rollPopulation(world) {
    if (world.size === 'R') {
        world.pop = 0;
        return world;
    }

    let popRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Population') : 7) - 2;

    // Location DMs
    if (world.type === 'Satellite') {
        if (world.zone === 'I') popRoll -= 6;
        else if (world.zone === 'O') popRoll -= 1;
    } else { // Terrestrial
        if (world.zone === 'I') popRoll -= 5;
        else if (world.zone === 'O') popRoll -= 3;
    }

    // Atmosphere Penalty
    if (![0, 5, 6, 8].includes(world.atm)) {
        popRoll -= 2;
    }

    world.pop = Math.max(0, popRoll);
    return world;
}

/**
 * PHASE 3 & 4: SOCIAL BASELINE (PASS ONE)
 * Establishes Gov, Law, and TL baseline.
 */
function finalizeSocial(world, mainworldRef, isMainworld = false) {
    if (world.pop === 0) {
        world.gov = 0; world.law = 0; world.tl = 0;
        return world;
    }

    if (isMainworld) {
        let govRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Government') : 7);
        world.gov = Math.max(0, Math.min(15, govRoll - 7 + world.pop));

        let lawRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Law Level') : 7);
        world.law = Math.max(0, Math.min(15, lawRoll - 7 + world.gov));

        world.tl = calculateMainworldTL(world);
    } else {
        // Subordinate Pop Cap
        if (world.pop >= mainworldRef.pop) {
            world.pop = Math.max(0, mainworldRef.pop - 1);
            if (world.pop === 0) { world.gov = 0; world.law = 0; world.tl = 0; return world; }
        }

        // Subordinate Gov (6 if MW Gov 6, otherwise 1D roll)
        if (mainworldRef.gov === 6) {
            world.gov = 6;
        } else {
            let govRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('Government') : 3);
            if (mainworldRef.gov >= 7) govRoll += 2;
            world.gov = (govRoll >= 5) ? 6 : govRoll;
        }

        // Subordinate Law: 1D-3 + MW Law
        let subLawRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('Law Level') : 3);
        world.law = Math.max(0, Math.min(15, subLawRoll - 3 + mainworldRef.law));

        // Subordinate TL Baseline: MW TL - 1
        world.tl = Math.max(0, mainworldRef.tl - 1);
    }

    return world;
}

/**
 * PASS TWO: FACILITIES & INFRASTRUCTURE REFINEMENT
 * Generates secondary infrastructure and retroactively boosts TL.
 */
function refineSocialInfrastructure(world, mainworldRef) {
    if (world.pop === 0 || world.type === 'Gas Giant' || world.size === 'R') {
        world.spaceport = 'Y';
        return world;
    }

    world.facilities = world.facilities || [];
    const isMainworld = (world.type === 'Mainworld');
    const mwTL = mainworldRef.tl;

    if (!isMainworld) {
        // Farming
        if (world.zone === 'H' && world.atm >= 4 && world.atm <= 9 && world.hydro >= 4 && world.hydro <= 8 && world.pop >= 2) {
            world.facilities.push('Farming');
        }
        // Mining
        const isIndustrial = (mainworldRef.tradeCodes && (mainworldRef.tradeCodes.includes('In') || mainworldRef.tradeCodes.includes('IND')));
        if (isIndustrial && world.pop >= 2) {
            world.facilities.push('Mining');
        }
        // Colony
        if (world.gov === 6 && world.pop >= 5) {
            world.facilities.push('Colony');
        }
        // Research Lab
        if (mwTL >= 9) {
            let labRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Lab Roll') : 7);
            if (mwTL >= 10) labRoll += 2;
            if (labRoll >= 12) world.facilities.push('Research Laboratory');
        }
        // Military Base
        if (mwTL >= 8) {
            let milRoll = (typeof tRoll2D !== 'undefined' ? tRoll2D('Mil Roll') : 7);
            if (mainworldRef.navalBase || mainworldRef.scoutBase) milRoll += 1;
            if (milRoll >= 12) world.facilities.push('Military Base');
        }

        // Special Facility TL Override
        if (world.facilities.includes('Research Laboratory') || world.facilities.includes('Military Base')) {
            world.tl = mainworldRef.tl;
        }

        // Final Subordinate Spaceport
        let spRoll = (typeof tRoll1D !== 'undefined' ? tRoll1D('Spaceport') : 3);
        if (world.pop >= 6) spRoll += 2;
        else if (world.pop === 1) spRoll -= 2;
        else if (world.pop === 0) spRoll -= 3;

        if (spRoll <= 2) world.spaceport = 'Y';
        else if (spRoll === 3) world.spaceport = 'H';
        else if (spRoll <= 5) world.spaceport = 'G';
        else world.spaceport = 'F';
    } else {
        world.spaceport = mainworldRef.port || 'C'; // Mainworlds keep their starport
    }

    // Environmental TL Floor (Book 6) - Applies ONLY to Subordinate Worlds
    if (!isMainworld && world.pop > 0 && world.tl < 7 && ![5, 6, 8].includes(world.atm)) {
        world.tl = 7;
        if (typeof tResult !== 'undefined') tResult('TL Floor', 'Bumped to 7 (Subordinate Habitat)', 'CT 3.2: Tech Level');
    }

    return world;
}

/**
 * HELPER: Mainworld TL Calculation
 */
function calculateMainworldTL(world, tlModifiers) {
    let tl = (typeof tRoll1D !== 'undefined' ? tRoll1D('TL Base') : 3);
    
    // Fallback to global if not passed explicitly
    const mods = tlModifiers || (typeof CT_CONSTANTS !== 'undefined' ? CT_CONSTANTS.TECH_LEVEL_MODIFIERS : null);
    
    if (!mods) {
        if (typeof writeLogLine !== 'undefined') writeLogLine("WARNING: Tech Level Modifiers not found in Data Shield. Base TL used.");
        return tl;
    }

    // Dynamically apply DMs from the Data Shield
    const sp = world.starport || 'C';
    if (mods.STARPORT[sp]) tl += mods.STARPORT[sp];
    if (mods.SIZE[world.size]) tl += mods.SIZE[world.size];
    if (mods.ATMOSPHERE[world.atm]) tl += mods.ATMOSPHERE[world.atm];
    if (mods.HYDROGRAPHICS[world.hydro]) tl += mods.HYDROGRAPHICS[world.hydro];
    if (mods.POPULATION[world.pop]) tl += mods.POPULATION[world.pop];
    if (mods.GOVERNMENT[world.gov]) tl += mods.GOVERNMENT[world.gov];

    return Math.max(0, tl); // Tech Levels do not go below 0
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rollPopulation, finalizeSocial, refineSocialInfrastructure };
} else {
    window.rollPopulation = rollPopulation;
    window.finalizeSocial = finalizeSocial;
    window.refineSocialInfrastructure = refineSocialInfrastructure;
}