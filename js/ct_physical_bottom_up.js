// =====================================================================
// CLASSIC TRAVELLER: BOTTOM-UP PHYSICAL ENGINE (MODULAR)
// =====================================================================
// Derived from ct_engine.js logic but stripped of Top-Down biases.

const { roll1D, roll2D, tRoll1D, tRoll2D, tResult, tDM, tSection, tOverride } = require('./dice_proxy'); // Assuming a helper for your logging/dice

/**
 * BOTTOM-UP PRIMARY STAR GENERATION
 * No priDM exists here because the Mainworld hasn't been rolled yet.
 */
function generateBottomUpPrimary(hexId) {
    // 1. Star Type (No DM applied)
    let priTypeRoll = roll2D();
    let rawPriType = CT_PRI_TYPE_TABLE[priTypeRoll];

    // 2. Star Size (No DM applied)
    let priSizeRoll = roll2D();
    let rawPriSize = CT_PRI_SIZE_TABLE[priSizeRoll];

    // 3. White Dwarf Check (Anomalous retcon)
    // If the roll is exactly 2 or 12, we can check for a White Dwarf 'D'
    if (priSizeRoll === 2 || priSizeRoll === 12) {
        rawPriSize = 'D';
    }

    return {
        type: rawPriType,
        size: rawPriSize,
        decimal: (rawPriSize === 'D' ? null : (roll1D() <= 3 ? 0 : 5))
    };
}

/**
 * BLIND ORBIT FILLING
 * Unlike ct_engine.js, this does NOT force a Mainworld into the HZ.
 */
function fillOrbitsBlindly(sys) {
    sys.orbits.forEach(slot => {
        // Roll for content blindly
        let contentRoll = roll2D();

        if (contentRoll >= 9) {
            slot.contents = { type: 'Gas Giant', size: (roll1D() <= 3 ? 'Large' : 'Small') };
        } else if (contentRoll >= 5) {
            slot.contents = { type: 'Terrestrial Planet' };
        } else {
            slot.contents = { type: 'Empty' };
        }
    });
    return sys;
}