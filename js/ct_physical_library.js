// =====================================================================
// CLASSIC TRAVELLER: SHARED PHYSICAL LIBRARY
// =====================================================================
// Browser-safe imports
var orbitalDistances, gravityTable, luminosityTable, satOrbitsTable;

if (typeof module !== 'undefined' && module.exports) {
    const { ORBIT_AU, GRAV, LUM, SATELLITE_ORBITS, CT_SATELLITE_LOGIC } = require('./ct_constants');
    orbitalDistances = ORBIT_AU;
    gravityTable = GRAV;
    luminosityTable = LUM;
    satOrbitsTable = SATELLITE_ORBITS;
    satLogic = CT_SATELLITE_LOGIC;
} else {
    // In browser, these are globals from ct_constants.js
    orbitalDistances = typeof ORBIT_AU !== 'undefined' ? ORBIT_AU : [];
    gravityTable = typeof GRAV !== 'undefined' ? GRAV : {};
    luminosityTable = typeof LUM !== 'undefined' ? LUM : {};
    satOrbitsTable = typeof SATELLITE_ORBITS !== 'undefined' ? SATELLITE_ORBITS : {};
    satLogic = typeof CT_SATELLITE_LOGIC !== 'undefined' ? CT_SATELLITE_LOGIC : {};
}

/**
 * Calculates planetary temperature based on Albedo, Greenhouse, and Distance.
 * Uses high-fidelity cloudiness and albedo math from legacy ct_engine.js.
 */
function getThermalStats(w, luminosity) {
    if (w.type === 'Planetoid Belt') return { temperature: 100 };

    let cloudBase = 0;
    const h = w.hydro || 0;
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

    let waterPortion = Math.max(0, h / 10.0 - 0.05);
    let landPortion = Math.max(0, 1.0 - h / 10.0 - 0.05);
    let icePortion = 0.10;
    const tc = w.tradeCodes || [];
    if (tc.includes('Ic')) { icePortion = waterPortion + 0.05; waterPortion = 0; }

    let cloudDec = cloudiness / 100.0;
    let unobs = 1.0 - cloudDec;
    let albedo = (waterPortion * unobs * 0.02) + (landPortion * unobs * 0.10) +
                 (icePortion * unobs * 0.85) + (cloudDec * 0.50);

    let ghMult = 1.0;
    const atm = w.atm || 0;
    if ([0, 1, 2, 3, 15].includes(atm)) ghMult = 1.00;
    else if ([4, 5].includes(atm)) ghMult = 1.05;
    else if ([6, 7, 14].includes(atm)) ghMult = 1.10;
    else if ([8, 9, 13].includes(atm)) ghMult = 1.15;
    else if (atm === 10) {
        // Range: +20% to +70% (1.2 to 1.7)
        let roll = tRoll2D('Greenhouse Roll (A)');
        ghMult = 1.20 + (roll - 2) * 0.05; 
    }
    else if ([11, 12].includes(atm)) {
        // Range: +20% to +120% (1.2 to 2.2)
        let roll = tRoll2D('Greenhouse Roll (B/C)');
        ghMult = 1.20 + (roll - 2) * 0.10;
    }

    let temperature = Math.round(374.025 * ghMult * (1 - albedo) * Math.pow(luminosity, 0.25) / Math.pow(w.distAU, 0.5));
    return { temperature };
}

/**
 * Determines a world's Axial Tilt and Rotation Period using Book 6 tables.
 */
function getRotationStats(w) {
    if (w.size === 0 || w.size === 'R') return { axialTilt: 'N/A', rotationPeriod: 'N/A' };
    
    // axialTilt calculation (2D-2)*4
    let axialTilt = (tRoll2D('Axial Tilt') - 2) * 4;
    
    let rotRoll = tRoll2D('Rotation Roll');
    let rotationPeriod = "";
    if (rotRoll <= 7) rotationPeriod = (rotRoll * 3 + tRoll2D('Rot Mod')) + "h";
    else if (rotRoll === 8) rotationPeriod = (tRoll2D('Rot Mod') * 20) + "h";
    else if (rotRoll === 9) rotationPeriod = (tRoll1D('Rot Mod')) + "d";
    else if (rotRoll === 10) rotationPeriod = (tRoll2D('Rot Mod')) + "d";
    else if (rotRoll === 11) rotationPeriod = (tRoll1D('Rot Mod')) + "w";
    else rotationPeriod = "Tidal Locked";

    return { axialTilt, rotationPeriod };
}

/**
 * Generates satellites for a parent body using the full Book 6 algorithm.
 * @param {Object} parent - The Gas Giant or Terrestrial Planet object.
 * @param {string} zone   - Orbital zone of parent ('H', 'I', 'O').
 * @param {number} [mwPop] - If provided (top-down), cap satellite pop below this value.
 */
function generateSatellites(parent, zone, mwPop) {
    // Step 1: Quantity — skip ineligible body types
    if (parent.size === 0 || parent.size === 'S' || parent.size === 'R' ||
        parent.type === 'Planetoid Belt' || parent.type === 'Empty') return;

    let qty = 0;
    tSection(`Satellite Generation for ${parent.name || parent.type}`);
    if (parent.type === 'Gas Giant') {
        if (parent.size === 'Large') qty = tRoll2D('Moon Qty (LGG)');
        else {
            tDM('Small Gas Giant', -4);
            qty = Math.max(0, tRoll2D('Moon Qty (SGG)') - 4);
        }
    } else {
        tDM('Terrestrial Planet', -3);
        qty = Math.max(0, tRoll1D('Moon Qty (Terr)') - 3);
    }
    tResult('Satellites Rolled', qty);

    if (qty <= 0) return;
    if (!parent.satellites) parent.satellites = [];

        // Track existing occupied radii for collision detection
        const occupiedRadii = new Set(parent.satellites.map(s => s.pd).filter(r => r != null));

        // Cumulative DM for orbit type roll (starts at 0, increases each satellite)
        let cumulativeDM = 0;

        for (let i = 0; i < qty; i++) {
            tSection(`${parent.name || parent.type} - Satellite ${i+1}`);
            // Step 2: Size (Task 2 Mirroring)
            let sizeCode;
            if (parent.type === 'Gas Giant') {
                if (parent.size === 'Large') {
                    tDM('Large Gas Giant', -4);
                    const roll = tRoll2D('Moon Size (LGG)');
                    const result = roll - 4; // LGG Formula: 2D-4
                    if (result === 0) sizeCode = 'R';
                    else if (result < 0) sizeCode = 'S';
                    else sizeCode = result;
                } else {
                    tDM('Small Gas Giant', -6);
                    const roll = tRoll2D('Moon Size (SGG)');
                    const result = roll - 6; // SGG Formula: 2D-6
                    if (result === 0) sizeCode = 'R';
                    else if (result < 0) sizeCode = 'S';
                    else sizeCode = result;
                }
            } else {
                const pSize = (parent.size !== undefined && !isNaN(Number(parent.size))) ? Number(parent.size) : 0;
                tDM(`Parent Size ${pSize}`, pSize);
                tDM('Standard Moon Size', 'Subtract 1D');
                const roll = tRoll1D('Moon Size (Terr)');
                const result = pSize - roll; // Terr Formula: Parent Size - 1D
                if (result === 0) sizeCode = 'R';
                else if (result < 0) sizeCode = 'S';
                else sizeCode = result;
            }
            tResult('Size Code', sizeCode);

            // Step 3: Orbital Location
            let pd = null;
            let orbitType = '';
            let attempts = 0;

            while (attempts < 5) {
                attempts++;
                if (sizeCode === 'R') {
                    orbitType = 'Ring';
                    const idx = tRoll1D('Ring Orbit Roll (1D)');
                    pd = (satOrbitsTable.Ring && satOrbitsTable.Ring[idx]) || 1;
                } else {
                    if (cumulativeDM !== 0) tDM('Cumulative Orbit DM', -cumulativeDM);
                    const orbitRoll = Math.max(2, tRoll2D('Orbit Type Roll') - cumulativeDM);
                    if (orbitRoll >= 12 && parent.type === 'Gas Giant') {
                        orbitType = 'Extreme';
                    } else if (orbitRoll >= 8) {
                        orbitType = 'Far';
                    } else {
                        orbitType = 'Close';
                    }
                    const distIdx = Math.min(tRoll2D(`Orbit Distance (${orbitType})`), (satOrbitsTable[orbitType] || []).length - 1);
                    pd = (satOrbitsTable[orbitType] && satOrbitsTable[orbitType][distIdx]) || 3;
                }

                if (!occupiedRadii.has(pd)) break; // No collision
                tSkip(`Orbit ${pd}r (Collision — retrying)`);
                pd = null; 
            }

            if (pd === null) {
                tSkip('Failed to find unique orbit after 5 attempts.');
                cumulativeDM++;
                continue;
            }
            occupiedRadii.add(pd);
            cumulativeDM++;
            tResult('Orbit Type', orbitType);
            tResult('Distance', `${pd} radii`);

            // Step 4: Physical Characteristics
            const numericSize = (sizeCode === 'S') ? 0.5 : (sizeCode === 'R') ? 0 : Number(sizeCode);
            const isRing = (sizeCode === 'R');
            const isTinyOrRing = isRing || numericSize <= 1;

            // Atmosphere
            let atm = 0;
            if (!isTinyOrRing) {
                tDM('Standard Atm', -7);
                tDM('Size Code', Math.floor(numericSize));
                let atmRoll = tRoll2D('Atmosphere Roll') - 7 + Math.floor(numericSize);
                if (zone === 'I' || zone === 'O') {
                    tDM(`Zone ${zone}`, -4);
                    atmRoll -= 4;
                }
                atm = Math.max(0, Math.min(15, atmRoll));
            } else {
                tSkip('Atmosphere (Trivial Size)');
            }
            tResult('Atmosphere Code', atm);

            // Hydrographics
            let hydro = 0;
            if (!isRing && numericSize > 0) {
                if (zone === 'I') {
                    tSkip('Hydrographics (Zone I is dry)');
                } else {
                    tDM('Standard Hyd', -7);
                    tDM('Size Code', Math.floor(numericSize));
                    let hydroRoll = tRoll2D('Hydrographics Roll') - 7 + Math.floor(numericSize);
                    if (zone === 'O') { tDM('Zone O', -4); hydroRoll -= 4; }
                    if (atm <= 1 || atm >= 10) { tDM('Extreme Atmosphere', -4); hydroRoll -= 4; }
                    hydro = Math.max(0, Math.min(10, hydroRoll));
                }
            } else {
                tSkip('Hydrographics (Rings/Trivial Size)');
            }
            tResult('Hydrographic Code', hydro);

            // Population
            let pop = 0;
            if (!isRing) {
                tDM('Standard Pop', -2);
                let popRoll = tRoll2D('Population Roll') - 2;
                if (zone === 'I') { tDM('Zone I', -5); popRoll -= 5; }
                if (zone === 'O') { tDM('Zone O', -4); popRoll -= 4; }
                if (numericSize <= 4) { tDM('Small Size (<=4)', -2); popRoll -= 2; }
                if (![5, 6, 8].includes(atm)) { tDM('Hostile Atmosphere', -2); popRoll -= 2; }
                pop = Math.max(0, popRoll);

                if (mwPop !== undefined && mwPop !== null && pop >= mwPop) {
                    const oldPop = pop;
                    pop = Math.max(0, mwPop - 1);
                    tOverride('Satellite Pop Cap', oldPop, pop, 'Cannot exceed Mainworld Pop');
                }
            } else {
                tSkip('Population (Rings)');
            }
            tResult('Population Code', pop);

            parent.satellites.push({
                type: 'Satellite',
                size: sizeCode,
                atm,
                hydro,
                pop,
                zone: zone || 'H',
                pd,
                orbitType,
                parentType: parent.type
            });
        }
    }


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getThermalStats, getRotationStats, generateSatellites };
}
