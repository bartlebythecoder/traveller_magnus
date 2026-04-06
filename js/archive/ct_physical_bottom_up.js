// =====================================================================
// CLASSIC TRAVELLER: BOTTOM-UP PHYSICAL ENGINE (MODULAR)
// =====================================================================
// Derived from ct_engine.js logic but stripped of Top-Down biases.

const { roll1D, roll2D, tRoll1D, tRoll2D, tResult, tDM, tSection, tOverride } = require('./dice_proxy'); // Assuming a helper for your logging/dice
const UniversalMath = require('./universal_math'); // Bring in the Math Chassis
const { CT_CONSTANTS } = require('../rules/ct_data'); // Bring in the Data Shield

/**
 * BOTTOM-UP PRIMARY STAR GENERATION
 * No priDM exists here because the Mainworld hasn't been rolled yet.
 */
function generateBottomUpPrimary(hexId) {
    if (typeof tSection === 'function') tSection("Generate Primary Star");

    // 1. Star Type (No DM applied)
    let priTypeRoll = roll2D();
    let rawPriType = CT_CONSTANTS.CT_PRI_TYPE_TABLE[priTypeRoll];

    // 2. Star Size (No DM applied)
    let priSizeRoll = roll2D();
    let rawPriSize = CT_CONSTANTS.CT_PRI_SIZE_TABLE[priSizeRoll];

    // 3. White Dwarf Check (Anomalous retcon)
    // If the roll is exactly 2 or 12, we can check for a White Dwarf 'D'
    if (priSizeRoll === 2 || priSizeRoll === 12) {
        rawPriSize = 'D';
    }

    let decimal = (rawPriSize === 'D' ? null : (roll1D() <= 3 ? 0 : 5));

    // 4. Calculate Stellar Diameter for Masking
    let diam = UniversalMath.estimateStellarDiameter(rawPriType, decimal, rawPriSize);

    if (typeof tResult === 'function') {
        tResult("Primary Class", `${rawPriType}${decimal !== null ? decimal : ''} ${rawPriSize}`);
        tResult("Primary Diameter", `${diam} Solar`);
        const limit100D = (diam * 1392700 * 100) / 1000000;
        tResult("100D Limit", `${limit100D.toFixed(1)} M km`);
    }

    return {
        type: rawPriType,
        size: rawPriSize,
        decimal: decimal,
        diam: diam // <-- Essential for Stellar Masking eligibility
    };
}

/**
 * BLIND ORBIT FILLING
 * Unlike ct_engine.js, this does NOT force a Mainworld into the HZ.
 */
function fillOrbitsBlindly(sys) {
    if (typeof tSection === 'function') tSection("Fill Orbits Blindly");

    sys.orbits.forEach(slot => {
        // Roll for content blindly
        let contentRoll = roll2D();
        let contents = null;

        if (contentRoll >= 9) {
            contents = { type: 'Gas Giant', size: (roll1D() <= 3 ? 'Large' : 'Small') };
        } else if (contentRoll >= 5) {
            contents = { type: 'Terrestrial Planet' };
        } else {
            contents = { type: 'Empty' };
        }

        // Apply Orbital Distance in AU for Journey Time/Masking Calculations
        if (contents.type !== 'Empty') {
            // Cap the lookup index to the max length of the ORBIT_AU array to prevent undefined
            let orbitIndex = Math.min(Math.floor(slot.orbit), CT_CONSTANTS.ORBIT_AU.length - 1);
            contents.distAU = CT_CONSTANTS.ORBIT_AU[orbitIndex];
        }

        slot.contents = contents;
    });

    return sys;
}

module.exports = {
    generateBottomUpPrimary,
    fillOrbitsBlindly
};