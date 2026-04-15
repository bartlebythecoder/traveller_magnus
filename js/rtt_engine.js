// =============================================================================
// RTT ENGINE - Star System Generation
// =============================================================================
// This engine implements the RTT ruleset for system generation.
// =============================================================================

// -----------------------------------------------------------------------------
// v0.9: MANUAL OVERRIDE HELPERS
// Used by Biographer functions to preserve fields the user has manually set.
// Saves field values before generation runs, restores them after.
// Depends on isManual() from core.js (loaded first in script order).
// -----------------------------------------------------------------------------
function _rttSaveManual(body, fields) {
    const saved = {};
    if (typeof isManual !== 'function') return saved;
    fields.forEach(f => { if (isManual(body, f)) saved[f] = body[f]; });
    return saved;
}
function _rttRestoreManual(body, saved) {
    Object.assign(body, saved);
}

/**
 * DETERMINES SPECTRAL TYPE BASED ON A 2D6 ROLL
 * @param {number} roll 
 * @returns {string} Spectral Type (A, F, G, K, M, L)
 */
function getRTTSpectralType(roll) {
    if (roll <= 2) return 'A';
    if (roll === 3) return 'F';
    if (roll === 4) return 'G';
    if (roll === 5) return 'K';
    if (roll >= 6 && roll <= 13) return 'M';
    return 'L'; // L or larger/smaller per logic
}

/**
 * DETERMINES LUMINOSITY CLASS AND POTENTIAL TYPE SHIFT BASED ON AGE
 * @param {string} starType 
 * @param {number} systemAge 
 * @param {boolean} hasCompanion 
 * @returns {object} Object containing { type, lum }
 */
function determineRTTLuminosity(starType, systemAge, hasCompanion = false) {
    if (starType === 'A') {
        if (systemAge <= 2) return { type: 'A', lum: 'V' };
        if (systemAge === 3) {
            let r = tRoll1D('Luminosity Branch Roll (A)');
            if (r <= 2) return { type: 'F', lum: 'IV' };
            if (r === 3) return { type: 'K', lum: 'III' };
            return { type: 'D', lum: 'D' };
        }
        return { type: 'D', lum: 'D' };
    }

    if (starType === 'F') {
        if (systemAge <= 5) return { type: 'F', lum: 'V' };
        if (systemAge === 6) {
            let r = tRoll1D('Luminosity Branch Roll (F)');
            if (r <= 4) return { type: 'G', lum: 'IV' };
            return { type: 'M', lum: 'III' };
        }
        return { type: 'D', lum: 'D' };
    }

    if (starType === 'G') {
        if (systemAge <= 11) return { type: 'G', lum: 'V' };
        if (systemAge === 12 || systemAge === 13) {
            let r = tRoll1D('Luminosity Branch Roll (G)');
            if (r <= 3) return { type: 'K', lum: 'IV' };
            return { type: 'M', lum: 'III' };
        }
        if (systemAge >= 14) return { type: 'D', lum: 'D' };
        return { type: 'G', lum: 'V' };
    }

    if (starType === 'K') {
        return { type: 'K', lum: 'V' };
    }

    // REQUIRED PHASE 3 FIX:
    if (starType === 'M') {
        let roll = tRoll2D('M-Star Luminosity Roll');
        if (hasCompanion) {
            tDM('Companion Present', 2);
            roll += 2;
        }
        if (roll >= 13) return { type: 'L', lum: 'L' }; // Brown Dwarf
        if (roll >= 10 && roll <= 12) return { type: 'M', lum: 'Ve' }; // Flare Star
        return { type: 'M', lum: 'V' }; // Standard Main Sequence
    }

    return { type: starType, lum: 'V' };
}

/**
 * STEP 1: STELLAR GENERATION
 * Generates the stars, spectral types, age, and orbits.
 */
function generateRTTSectorStep1(hexId, options = {}) {
    let name = options.name || getNextSystemName(hexId);
    if (window.isLoggingEnabled) {
        startTrace(hexId, 'RTT Engine', name);
    }
    reseedForHex(hexId);

    const sys = {
        hexId: hexId,
        name: name,
        stars: [],
        age: 0,
        totalStars: 1
    };

    tSection('STEP 1: STELLAR GENERATION');

    // 1. DETERMINE NUMBER OF STARS
    let rollStars = tRoll3D('Star Count Roll');
    if (options.isOpenCluster) {
        tDM('Open Cluster', 3);
        rollStars += 3;
    }

    if (rollStars <= 10) sys.totalStars = 1;
    else if (rollStars <= 15) sys.totalStars = 2;
    else sys.totalStars = 3;

    tResult('Initial Star Count', sys.totalStars, 'RTT 1.1: Star Count');

    // 2. DETERMINE SPECTRAL TYPES
    let primaryRoll = tRoll2D('Primary Spectral Roll');
    let primaryType = getRTTSpectralType(primaryRoll);

    // Constraint: Brown dwarfs (L) are always solitary
    if (primaryType === 'L' && sys.totalStars > 1) {
        writeLogLine('  Notice: Primary is an L-type dwarf. Forcing Solitary.');
        sys.totalStars = 1;
        tResult('Total Stars (Override)', 1, 'RTT 1.1: Star Count Override');
    }

    sys.stars.push({
        type: primaryType,
        role: 'Primary',
        spectralRoll: primaryRoll,
        orbitType: 'Primary'
    });
    tResult('Primary Spectral Type', primaryType, 'RTT 1.2: Spectral Type');

    // Companion stars
    for (let i = 1; i < sys.totalStars; i++) {
        let d6_1 = tRoll1D(`Companion ${i} Offset (1D6-1)`) - 1;
        let companionRoll = primaryRoll + d6_1;
        let companionType = getRTTSpectralType(companionRoll);

        sys.stars.push({
            type: companionType,
            role: `Companion ${i}`,
            spectralRoll: companionRoll
        });
        tResult(`Companion ${i} Spectral Type`, companionType, 'RTT 1.2: Spectral Type');
    }

    // 3. DETERMINE SYSTEM AGE & LUMINOSITY
    sys.age = tRoll3D('System Age Roll (3D6-3)') - 3;
    if (sys.age < 0.1) sys.age = 0.1;
    tResult('System Age (Gyrs)', sys.age.toFixed(1), 'RTT 1.3: System Age');

    let hasCompanion = sys.totalStars > 1;

    for (let star of sys.stars) {
        let lumData = determineRTTLuminosity(star.type, sys.age, hasCompanion);
        star.type = lumData.type; // Apply any spectral shifts
        star.luminosityClass = lumData.lum;

        // Format classification cleanly for White Dwarfs and Brown Dwarfs
        if (star.luminosityClass === 'D' || star.luminosityClass === 'L') {
            star.classification = star.luminosityClass;
        } else {
            star.classification = `${star.type}-${star.luminosityClass}`;
        }
        tResult(`${star.role} Classification`, star.classification, 'RTT 1.4: Stellar Classification');
    }

    // 4. DETERMINE COMPANION ORBITS
    for (let i = 1; i < sys.stars.length; i++) {
        let star = sys.stars[i];
        let orbitRoll = tRoll1D(`${star.role} Orbit Roll`);
        let orbit = 'Moderate';

        // Mapping 1D6: 1-2: Tight, 3-4: Close (corrected gap), 5: Moderate, 6: Distant
        if (orbitRoll <= 2) orbit = 'Tight';
        else if (orbitRoll <= 4) orbit = 'Close';
        else if (orbitRoll === 5) orbit = 'Moderate';
        else orbit = 'Distant';

        star.orbitType = orbit;
        tResult(`${star.role} Orbit`, orbit, 'RTT 1.5: Stellar Orbits');
    }

    if (window.isLoggingEnabled) {
        endTrace();
    }

    // Proactively run Step 2
    generateRTTSectorStep2(sys, options);

    return sys;
}

/**
 * STEP 4: PHYSICAL WORLD STATS - PART A (DEAD & EXTREME WORLDS)
 */
/**
 * STEPS 4-7: MASTER BIOGRAPHER (UNIFIED PHYSICAL & SOCIAL)
 */
function generateRTTSectorBiographer(sys, options = {}) {
    if (window.isLoggingEnabled) {
        startTrace(sys.hexId, 'RTT Engine - Biographer', sys.name || sys.hexId);
    }

    tSection('STEP 4-7: PHYSICAL & SOCIAL BIOGRAPHY');

    // 1. PHYSICAL ACCUMULATION PASS
    for (let star of sys.stars) {
        if (!star.planetarySystem) continue;
        for (let body of star.planetarySystem.orbits) {
            processRTTPhysicalStatsPartA(body, star, sys);
            processRTTPhysicalStatsPartB(body, star, sys);

            // INJECT PHASE 2.1 METRICS HERE
            processRTTDerivedPhysics(body);

            if (body.satellites) {
                for (let sat of body.satellites) {
                    processRTTPhysicalStatsPartA(sat, star, sys, body);
                    processRTTPhysicalStatsPartB(sat, star, sys, body);

                    // INJECT PHASE 2.1 METRICS FOR SATELLITES HERE
                    processRTTDerivedPhysics(sat);
                }
            }
        }
    }

    // 2. SYSTEM-WIDE FLAGS
    let systemHasHomeworld = false;
    for (let star of sys.stars) {
        if (!star.planetarySystem) continue;
        for (let body of star.planetarySystem.orbits) {
            if (getEHex(body.biosphere) >= 12) systemHasHomeworld = true;
            if (body.satellites) {
                for (let sat of body.satellites) {
                    if (getEHex(sat.biosphere) >= 12) systemHasHomeworld = true;
                }
            }
        }
    }

    // 3. SOCIAL GENERATION & BIOGRAPHY DUMP
    const dominantTL = options.dominantTL || 12;
    const settlementCenturies = options.settlementCenturies || 2;

    for (let star of sys.stars) {
        if (!star.planetarySystem) continue;

        tSection(`Biography for System: ${star.classification} (${star.role})`);

        for (let body of star.planetarySystem.orbits) {
            logBodyBiography(body, star, systemHasHomeworld, dominantTL, settlementCenturies, sys, options);
            if (body.satellites) {
                for (let sat of body.satellites) {
                    logBodyBiography(sat, star, systemHasHomeworld, dominantTL, settlementCenturies, sys, options);
                }
            }
        }
    }

    // Ancients Site (Q): Roll once per system. 12+ assigns to random world.
    if (tRoll2D('Ancients Site Roll') >= 12) {
        let allInhabited = [];
        for (let star of sys.stars) {
            if (!star.planetarySystem) continue;
            for (let body of star.planetarySystem.orbits) {
                allInhabited.push(body);
                if (body.satellites) allInhabited.push(...body.satellites);
            }
        }
        if (allInhabited.length > 0) {
            let target = allInhabited[Math.floor(Math.random() * allInhabited.length)];
            target.bases = target.bases || [];
            target.bases.push('Q');
            tResult('Ancient Site Found', target.orbitNumber ? `Orbit ${target.orbitNumber}` : 'Satellite', 'RTT 7.5: Ancient Sites');
        }
    }

    if (window.isLoggingEnabled) {
        endTrace();
    }
}

/**
 * HELPER: CONSOLIDATED BODY BIOGRAPHY
 */
function logBodyBiography(body, star, systemHasHomeworld, dominantTL, settlementCenturies, sys, options) {
    const loc = body.isSatellite ? `Satellite ${body.orbitNumber}` : `Orbit ${body.orbitNumber}`;
    writeLogLine(`  --- Biography: ${loc} (${body.worldClass || body.type}) ---`);

    // 1. Social Calculations
    calculateRTTDesirability(body, star);
    checkRTTTerraforming(body, star, dominantTL, settlementCenturies);
    determineRTTHabitation(body, systemHasHomeworld, dominantTL);
    processRTTSocialStats(body, star, dominantTL, settlementCenturies, options);

    // 2. Final Logging
    const physStr = `S=${body.size} A=${body.atmosphere} H=${body.hydrosphere} B=${body.biosphere} (${body.chemistry})`;
    const socialStr = `Pop=${body.population} Gov=${body.government} Law=${body.lawLevel} Port=${body.starport || 'X'}`;
    const habitationStr = `Habitation=${body.habitationType} Desirability=${body.desirability}`;

    writeLogLine(`    Physical: ${physStr}`);
    writeLogLine(`    Social: ${socialStr}`);
    writeLogLine(`    Habitation: ${habitationStr}`);
    if (body.tradeCodes && body.tradeCodes.length > 0) writeLogLine(`    Trade: ${body.tradeCodes.join(', ')}`);
    if (body.bases && body.bases.length > 0) writeLogLine(`    Bases: ${body.bases.join(', ')}`);
    writeLogLine(`  ----------------------------------------`);
}

/**
 * PHASE 2.1: RTT DERIVED PHYSICAL METRICS
 * Maps hardcoded surface gravity, diameter, and composition narratives.
 * Skips mass and density per RAW constraints.
 */
function processRTTDerivedPhysics(body) {
    if (body.size === undefined) return;

    // 1. Gravity and Diameter Table Mapping
    let sHex = getEHex(body.size);
    let g = 0;
    let diam = 0;

    // Handle Jovians and Gas Giants separately
    if (body.worldClass === 'Jovian' || body.size === 'G' || body.worldClass === 'Chthonian') {
        g = 'Variable (Giant)';
        diam = 'Variable (Giant)';
    } else {
        switch (sHex) {
            case 0: g = 0; diam = 800; break;      // <= 800km, neg. gravity
            case 1: g = 0.05; diam = 1600; break;
            case 2: g = 0.15; diam = 3200; break;
            case 3: g = 0.25; diam = 4800; break;
            case 4: g = 0.35; diam = 6400; break;
            case 5: g = 0.45; diam = 8000; break;
            case 6: g = 0.70; diam = 9600; break;
            case 7: g = 0.90; diam = 11200; break;
            case 8: g = 1.00; diam = 12800; break;
            case 9: g = 1.25; diam = 14400; break;
            default: g = 1.40; diam = 16000; break; // Size A+ (>=16,000 km, >=1.4 G)
        }
    }

    // Universal Data Layer Assignment
    body.gravity = g;
    body.diameter = diam;

    if (typeof tResult !== 'undefined') {
        tResult('Surface Gravity', typeof g === 'number' ? g + ' G' : g, 'RTT 2.1: Derived Physics');
        tResult('Planetary Diameter', typeof diam === 'number' ? diam + ' km' : diam, 'RTT 2.1: Derived Physics');
    }

    // 2. Narrative Composition Mapping
    let comp = "Standard planetary mix";
    switch (body.worldClass) {
        case 'Snowball': comp = "Mostly ice and some rock"; break;
        case 'Panthalassic': comp = "Largely water and hydrogen"; break;
        case 'Oceanic': comp = "Silicates, rock, and significant surface liquid"; break;
        case 'Rockball': comp = "Barren rock and metals"; break;
        case 'Meltball': comp = "Molten rock and magma"; break;
        case 'Arean': comp = "Rock and silicates"; break;
        case 'Asteroid Belt': comp = "Loose rocky and metallic debris"; break;
        case 'Small Body': comp = "Loose rock and ice"; break;
        case 'Jovian': comp = "Hydrogen, helium, and complex volatile layers"; break;
        case 'Chthonian': comp = "Exposed metallic or rocky core of a stripped gas giant"; break;
        case 'Telluric': comp = "Standard silicate rock and iron core"; break;
        case 'Promethean': comp = "Rock, ice, and volatile cryomagma"; break;
        default: comp = `Narrative defined by ${body.worldClass} metrics`; break;
    }

    // Universal Data Layer Assignment
    body.composition = comp;

    if (typeof tResult !== 'undefined') {
        tResult('Planetary Composition', comp, 'RTT 2.1: Derived Physics');
    }

    // 3. Phase 2.5 Rotational Dynamics
    // worldClass is the absolute authority. No T5 bleed.
    if (body.worldClass === 'JaniLithic') {
        body.isTidallyLocked = true;
        body.rotationState = "Tidally Locked (Rocky, dry, geologically active)";
    } else if (body.worldClass === 'Vesperian') {
        body.isTidallyLocked = true;
        body.rotationState = "Tidally Locked (Stable twilight band allows liquids/life)";
    } else {
        body.isTidallyLocked = false;
        body.rotationState = "Undefined (Narrative day length)";
    }

    if (typeof tResult !== 'undefined') {
        tResult('Tidal Lock Status', body.isTidallyLocked ? 'Locked' : 'Free', 'RTT 2.5: Rotational Dynamics');
        tResult('Rotation State', body.rotationState, 'RTT 2.5: Rotational Dynamics');
    }

    // 4. Explicit Nullification for Data Shield
    body.mass = null;
    body.density = null;
}

/**
 * HELPER: CALCULATE PHYSICAL STATS FOR A BODY (PART A)
 */
function processRTTPhysicalStatsPartA(body, star, sys, parent = null) {
    const wc = body.worldClass;
    let processed = false;
    const _savedPartA = _rttSaveManual(body, ['size', 'atmosphere', 'hydrosphere']);

    // Initialize common fields if they don't exist
    if (body.biosphere === undefined) body.biosphere = 0;
    if (body.chemistry === undefined) body.chemistry = 'None';

    // --- STELLAR EXPANSION CASUALTIES (PART A) ---
    if (wc === 'Acheronian') {
        body.size = tRoll1D('Size Roll (1D6+4)') + 4;
        body.atmosphere = 1;
        body.hydrosphere = 0;
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Asphodelian') {
        body.size = tRoll1D('Size Roll (1D6+9)') + 9;
        body.atmosphere = 1;
        body.hydrosphere = 0;
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Chthonian') {
        body.size = 'G';
        body.atmosphere = 1;
        body.hydrosphere = 0;
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Stygian') {
        body.size = Math.max(0, tRoll1D('Size Roll (1D6-1)') - 1);
        body.atmosphere = 0;
        body.hydrosphere = 0;
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }

    // --- DWARF AND SMALL BODIES (PART A) ---
    else if (wc === 'Small Body' || wc === 'Asteroid Belt') {
        body.size = (body.type === 'Asteroid Belt') ? 'Y' : 0;
        body.atmosphere = 0;
        body.hydrosphere = 0;
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Rockball') {
        body.size = Math.max(0, tRoll1D('Size Roll (1D6-1)') - 1);
        body.atmosphere = 0;
        let hydroDM = 0;
        if (star.type === 'L') hydroDM += 1;
        if (body.zone === 'Epistellar') hydroDM -= 2;
        if (body.zone === 'Outer') hydroDM += 2;
        body.hydrosphere = Math.max(0, tRoll2D('Hydrosphere Roll') + (typeof body.size === 'number' ? body.size : 0) - 11 + hydroDM);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Meltball') {
        body.size = Math.max(0, tRoll1D('Size Roll (1D6-1)') - 1);
        body.atmosphere = 1;
        body.hydrosphere = 'F';
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Hebean') {
        body.size = Math.max(0, tRoll1D('Size Roll (1D6-1)') - 1);
        let sVal = (typeof body.size === 'number' ? body.size : 0);
        let atmosRoll = tRoll1D('Atmosphere Roll') + sVal - 6;
        if (atmosRoll >= 2) body.atmosphere = 'A';
        else body.atmosphere = Math.max(0, atmosRoll);
        body.hydrosphere = Math.max(0, tRoll2D('Hydrosphere Roll') + sVal - 11);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }

    // --- JANI-LITHIC & TELLURIC (PART A) ---
    else if (wc === 'JaniLithic') {
        body.size = tRoll1D('Size Roll') + 4;
        let atmosRoll = tRoll1D('Atmosphere Roll');
        body.atmosphere = (atmosRoll <= 3) ? 1 : 'A';
        body.hydrosphere = 0;
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    else if (wc === 'Telluric') {
        body.size = tRoll1D('Size Roll') + 4;
        body.atmosphere = 'C';
        let hydroRoll = tRoll1D('Hydrosphere Roll');
        body.hydrosphere = (hydroRoll <= 4) ? 0 : 'F';
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }

    // --- HELIAN (PART A) ---
    else if (wc === 'Helian') {
        body.size = tRoll1D('Size Roll') + 9;
        body.atmosphere = 'D';
        let hydroRoll = tRoll1D('Hydrosphere Roll');

        if (hydroRoll <= 2) {
            body.hydrosphere = 0;
        } else if (hydroRoll >= 3 && hydroRoll <= 4) {
            body.hydrosphere = Math.max(0, tRoll2D('Hydrosphere Roll') - 1);
        } else if (hydroRoll >= 5) {
            body.hydrosphere = 'F';
        }
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');
        processed = true;
    }
    // PHASE 2.2 TRACE LOGGING
    if (processed && body.atmosphere !== undefined && typeof tResult !== 'undefined') {
        tResult(`${body.worldClass} Atmosphere`, body.atmosphere, 'RTT 2.2: Atmospheric Chemistry');
    }

    _rttRestoreManual(body, _savedPartA);
    return processed;
}

/**
 * HELPER: CALCULATE PHYSICAL STATS FOR A BODY (PART B)
 */
function processRTTPhysicalStatsPartB(body, star, sys, parent = null) {
    const wc = body.worldClass;
    const starClass = star.luminosityClass;
    const sysAge = sys.age;
    let processed = false;

    // Initialize common fields if they don't exist
    if (body.biosphere === undefined) body.biosphere = 0;
    if (body.chemistry === undefined) body.chemistry = 'None';
    let chemMod = 0;
    const _savedPartB = _rttSaveManual(body, ['size', 'atmosphere', 'hydrosphere', 'chemistry', 'biosphere']);

    // --- PART B: ACTIVE & LIFE-BEARING WORLDS ---

    // AREAN
    if (wc === 'Arean') {
        body.size = Math.max(0, tRoll1D('Size Roll') - 1);
        let atmosRoll = tRoll1D('Atmosphere Roll');
        if (starClass === 'D') { tDM('White Dwarf', -2); atmosRoll -= 2; }
        body.atmosphere = (atmosRoll <= 3) ? 1 : 'A';

        let hydroDM = (body.atmosphere === 1) ? -4 : 0;
        if (hydroDM !== 0) tDM('Trace Atmos', hydroDM);
        body.hydrosphere = Math.max(0, tRoll2D('Hydrosphere Roll') + body.size - 7 + hydroDM);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chemistry Roll');
        if (star.type === 'L') { tDM('L-Star', 2); chemRoll += 2; }
        if (body.zone === 'Outer') { tDM('Outer Zone', 2); chemRoll += 2; }

        if (chemRoll <= 4) { body.chemistry = 'Water'; chemMod = 0; }
        else if (chemRoll <= 6) { body.chemistry = 'Ammonia'; chemMod = 1; }
        else { body.chemistry = 'Methane'; chemMod = 3; }

        if (sysAge >= (tRoll1D('Life Evol 1') + chemMod) && body.atmosphere === 1) body.biosphere = Math.max(0, tRoll1D('Bio Roll Low') - 4);
        else if (sysAge >= (tRoll1D('Life Evol 2') + chemMod) && body.atmosphere === 'A') body.biosphere = tRoll1D('Bio Roll Mid');
        else if (sysAge >= (4 + chemMod) && body.atmosphere === 'A') body.biosphere = Math.max(0, tRoll1D('Bio Roll High') + body.size - 2);
        processed = true;
    }

    // ARID
    else if (wc === 'Arid') {
        body.size = tRoll1D('Size Roll') + 4;
        body.hydrosphere = tRollD3('Hydrosphere Roll');
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chemistry Roll');
        if (star.classification === 'K-V') chemRoll += 2;
        else if (star.classification === 'M-V') chemRoll += 4;
        else if (star.type === 'L') chemRoll += 5;
        if (body.zone === 'Outer') chemRoll += 2;

        if (chemRoll <= 6) { body.chemistry = 'Water'; chemMod = 0; }
        else if (chemRoll <= 8) { body.chemistry = 'Ammonia'; chemMod = 1; }
        else { body.chemistry = 'Methane'; chemMod = 3; }

        if (sysAge >= (tRoll1D('Life Evol 1') + chemMod)) body.biosphere = tRollD3('Bio Roll Low');
        if (sysAge >= (4 + chemMod)) {
            let bioRoll = tRoll2D('Bio Roll High');
            if (starClass === 'D') { tDM('White Dwarf', -3); bioRoll -= 3; }
            body.biosphere = Math.max(0, bioRoll);
        }

        if (body.biosphere >= 3 && body.chemistry === 'Water') {
            body.atmosphere = Math.max(2, Math.min(9, tRoll2D('Live Atmos') - 7 + body.size));
        } else {
            body.atmosphere = 'A';
        }
        processed = true;
    }

    // JOVIAN
    else if (wc === 'Jovian') {
        body.size = 'G';
        body.atmosphere = 'G';
        body.hydrosphere = 'G';
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let lifeRoll = tRoll1D('Jovian Life Chance');
        if (body.zone === 'Inner') { tDM('Inner Zone', 2); lifeRoll += 2; }
        if (lifeRoll >= 6) {
            let chemRoll = tRoll1D('Chemistry Roll');
            if (star.type === 'L') chemRoll += 1;
            if (body.zone === 'Epistellar') chemRoll -= 2;
            if (body.zone === 'Outer') chemRoll += 2;
            body.chemistry = (chemRoll <= 3) ? 'Water' : 'Ammonia';

            if (sysAge >= tRoll1D('Life Evol 1')) body.biosphere = tRollD3('Bio Roll Low');
            if (sysAge >= 7) {
                let bioRoll = tRoll2D('Bio Roll High');
                if (starClass === 'D') bioRoll -= 3;
                body.biosphere = Math.max(0, bioRoll);
            }
        }
        processed = true;
    }

    // OCEANIC
    else if (wc === 'Oceanic') {
        body.size = tRoll1D('Size Roll') + 4;
        body.hydrosphere = 'B';
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chemistry Roll');
        if (star.classification === 'K-V') chemRoll += 2;
        else if (star.classification === 'M-V') chemRoll += 4;
        else if (star.type === 'L') chemRoll += 5;
        if (body.zone === 'Outer') chemRoll += 2;

        if (chemRoll <= 6) { body.chemistry = 'Water'; chemMod = 0; }
        else if (chemRoll <= 8) { body.chemistry = 'Ammonia'; chemMod = 1; }
        else { body.chemistry = 'Methane'; chemMod = 3; }

        if (sysAge >= (tRoll1D('Life Evol 1') + chemMod)) body.biosphere = tRollD3('Bio Roll Low');
        if (sysAge >= (4 + chemMod)) {
            let bioRoll = tRoll2D('Bio Roll High');
            if (starClass === 'D') bioRoll -= 3;
            body.biosphere = Math.max(0, bioRoll);
        }

        if (body.chemistry === 'Water') {
            let atmosDM = 0;
            if (star.classification === 'K-V') atmosDM = -1;
            else if (star.classification === 'M-V') atmosDM = -2;
            else if (star.type === 'L') atmosDM = -3;
            else if (starClass === 'IV') atmosDM = -1;
            let aVal = tRoll2D('Oceanic Atmos') + body.size - 6 + atmosDM;
            body.atmosphere = Math.max(1, Math.min(12, aVal));
            if (body.atmosphere === 12) body.atmosphere = 'C';
        } else {
            let aRoll = tRoll1D('Oceanic Exotic Atmos');
            if (aRoll === 1) body.atmosphere = 1;
            else if (aRoll <= 4) body.atmosphere = 'A';
            else body.atmosphere = 'C';
        }
        processed = true;
    }

    // PANTHALASSIC
    else if (wc === 'Panthalassic') {
        body.size = tRoll1D('Size Roll') + 9;
        body.atmosphere = Math.min(13, tRoll1D('Atmos Roll') + 8); // Max D
        body.hydrosphere = 'B';
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chemistry Roll');
        if (star.classification === 'K-V') chemRoll += 2;
        else if (star.classification === 'M-V') chemRoll += 4;
        else if (star.type === 'L') chemRoll += 5;

        if (chemRoll <= 6) {
            let sub = tRoll2D('Sub-Chem');
            if (sub <= 8) body.chemistry = 'Water';
            else if (sub <= 11) body.chemistry = 'Sulfur';
            else body.chemistry = 'Chlorine';
            chemMod = 0;
        } else if (chemRoll <= 8) {
            body.chemistry = 'Methane'; chemMod = 1;
        } else {
            body.chemistry = 'Methane'; chemMod = 3;
        }

        if (sysAge >= (tRoll1D('Life Evol 1') + chemMod)) body.biosphere = tRollD3('Bio Roll Low');
        if (sysAge >= (4 + chemMod)) body.biosphere = tRoll2D('Bio Roll High');
        processed = true;
    }

    // PROMETHEAN
    else if (wc === 'Promethean') {
        body.size = Math.max(0, tRoll1D('Size Roll') - 1);
        body.hydrosphere = Math.max(0, tRoll2D('Hydro Roll') - 2);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chemistry Roll');
        if (star.type === 'L') chemRoll += 2;
        if (body.zone === 'Epistellar') chemRoll -= 2;
        if (body.zone === 'Outer') chemRoll += 2;

        if (chemRoll <= 4) { body.chemistry = 'Water'; chemMod = 0; }
        else if (chemRoll <= 6) { body.chemistry = 'Ammonia'; chemMod = 1; }
        else { body.chemistry = 'Methane'; chemMod = 3; }

        if (sysAge >= (tRoll1D('Life Evol 1') + chemMod)) body.biosphere = tRollD3('Bio Roll Low');
        if (sysAge >= (4 + chemMod)) {
            let bioRoll = tRoll2D('Bio Roll High');
            if (starClass === 'D') bioRoll -= 3;
            body.biosphere = Math.max(0, bioRoll);
        }

        if (body.biosphere >= 3 && body.chemistry === 'Water') {
            body.atmosphere = Math.max(2, Math.min(9, tRoll2D('Atmos Roll') + body.size - 7));
        } else {
            body.atmosphere = 'A';
        }
        processed = true;
    }

    // SNOWBALL
    else if (wc === 'Snowball') {
        body.size = Math.max(0, tRoll1D('Size Roll') - 1);
        body.atmosphere = (tRoll1D('Atmos Roll') <= 4) ? 0 : 1;

        let hydroRoll = tRoll1D('Hydro Roll');
        if (hydroRoll <= 3) body.hydrosphere = 'A';
        else body.hydrosphere = Math.max(0, tRoll2D('Hydro Subsurface') - 2);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chem Roll');
        if (star.type === 'L') chemRoll += 2;
        if (body.zone === 'Outer') chemRoll += 2;

        if (chemRoll <= 4) { body.chemistry = 'Water'; chemMod = 0; }
        else if (chemRoll <= 6) { body.chemistry = 'Ammonia'; chemMod = 1; }
        else { body.chemistry = 'Methane'; chemMod = 3; }

        if (body.hydrosphere !== 'A') {
            if (sysAge >= tRoll1D('Life Evol 1')) body.biosphere = Math.max(0, tRoll1D('Bio Roll Low') - 3);
            if (sysAge >= (6 + chemMod)) body.biosphere = Math.max(0, tRoll1D('Bio Roll High') + body.size - 2);
        }
        processed = true;
    }

    // TECTONIC
    else if (wc === 'Tectonic') {
        body.size = tRoll1D('Size Roll') + 4;
        body.hydrosphere = Math.max(0, tRoll2D('Hydro Roll') - 2);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll1D('Chem Roll');
        if (star.classification === 'K-V') chemRoll += 2;
        else if (star.classification === 'M-V') chemRoll += 4;
        else if (star.type === 'L') chemRoll += 5;
        if (body.zone === 'Outer') chemRoll += 2;

        if (chemRoll <= 6) {
            let sub = tRoll2D('Sub-Chem');
            if (sub <= 8) body.chemistry = 'Water';
            else if (sub <= 11) body.chemistry = 'Sulfur';
            else body.chemistry = 'Chlorine';
            chemMod = 0;
        } else if (chemRoll <= 8) {
            body.chemistry = 'Ammonia'; chemMod = 1;
        } else {
            body.chemistry = 'Methane'; chemMod = 3;
        }

        if (sysAge >= (tRoll1D('Life Evol 1') + chemMod)) body.biosphere = tRollD3('Bio Roll Low');
        if (sysAge >= (4 + chemMod)) {
            let bioRoll = tRoll2D('Bio Roll High');
            if (starClass === 'D') bioRoll -= 3;
            body.biosphere = Math.max(0, bioRoll);
        }

        if (body.biosphere >= 3) {
            if (body.chemistry === 'Water') body.atmosphere = Math.max(2, Math.min(9, tRoll2D('Atmos Roll') + body.size - 7));
            else if (['Sulfur', 'Chlorine'].includes(body.chemistry)) body.atmosphere = 'B';
            else body.atmosphere = 'A';
        } else {
            body.atmosphere = 'A';
        }
        processed = true;
    }

    // VESPERIAN
    else if (wc === 'Vesperian') {
        body.size = tRoll1D('Size Roll') + 4;
        body.hydrosphere = Math.max(0, tRoll2D('Hydro Roll') - 2);
        tResult(`${body.worldClass} Hydrosphere`, body.hydrosphere, 'RTT 2.3: Hydrographics');

        let chemRoll = tRoll2D('Chem Roll');
        body.chemistry = (chemRoll <= 11) ? 'Water' : 'Chlorine';

        if (sysAge >= tRoll1D('Life Evol 1')) body.biosphere = tRollD3('Bio Roll Low');
        if (sysAge >= 4) body.biosphere = tRoll2D('Bio Roll High');

        if (body.biosphere >= 3) {
            if (body.chemistry === 'Water') body.atmosphere = Math.max(2, Math.min(9, tRoll2D('Atmos Roll') + body.size - 7));
            else if (body.chemistry === 'Chlorine') body.atmosphere = 'B';
            else body.atmosphere = 'A';
        } else {
            body.atmosphere = 'A';
        }
        processed = true;
    }
    // PHASE 2.2 TRACE LOGGING
    if (processed && body.atmosphere !== undefined && typeof tResult !== 'undefined') {
        tResult(`${body.worldClass} Atmosphere`, body.atmosphere, 'RTT 2.2: Atmospheric Chemistry');
    }

    _rttRestoreManual(body, _savedPartB);
    return processed;
}

/**
 * STEP 3: SPECIFIC WORLD CLASSIFICATION
 */
function generateRTTSectorStep3(sys, options = {}) {
    if (window.isLoggingEnabled) {
        startTrace(sys.hexId, 'RTT Engine - Step 3', sys.name || sys.hexId);
    }

    tSection('STEP 3: SPECIFIC WORLD CLASSIFICATION');

    for (let star of sys.stars) {
        if (!star.planetarySystem) continue;

        tSection(`Classification for System: ${star.classification} (${star.role})`);

        // 1. CHECK FOR EXPANDED STAR OVERRIDES (Giant/White Dwarf phases)
        let affectedOrbits = 0;
        if (['III', 'D'].includes(star.luminosityClass)) {
            affectedOrbits = tRoll1D('Star Expansion Affected Orbits Roll');
            tResult(`${star.role} Expansion Impact`, `${affectedOrbits} orbits affected`, 'RTT 3.1: Stellar Expansion');
        }

        // Apply classification to each orbit
        for (let body of star.planetarySystem.orbits) {
            // Check for bake override
            let overrideTriggered = false;
            if (body.orbitNumber <= affectedOrbits) {
                if (body.type === 'Dwarf Planet') {
                    body.worldClass = 'Stygian';
                    overrideTriggered = true;
                }
                else if (body.type === 'Terrestrial Planet') {
                    body.worldClass = 'Acheronian';
                    overrideTriggered = true;
                }
                else if (body.type === 'Helian Planet') {
                    body.worldClass = 'Asphodelian';
                    overrideTriggered = true;
                }
                else if (body.type === 'Jovian Planet') {
                    body.worldClass = 'Chthonian';
                    overrideTriggered = true;
                }
            }

            if (overrideTriggered) {
                body.overrideApplied = true;
                writeLogLine(`  Orbit ${body.orbitNumber}: Star Expansion Override -> ${body.worldClass}`);
                tResult('Boiled-Away Rule', 'Hydro 0 (Stellar Expansion)', 'RTT 2.3: Hydrographics');
            } else {
                body.overrideApplied = false;
            }

            // 2. STANDARD CLASSIFICATION
            if (!body.overrideApplied) {
                classifyRTTBody(body, star, body.zone);
            }

            // Recursive classification for satellites
            if (body.satellites && body.satellites.length > 0) {
                for (let sat of body.satellites) {
                    // Satellites follow the zone of their parent
                    classifyRTTBody(sat, star, body.zone, body);
                }
            }
        }
    }

    // Proactively run Biographer (Steps 4-7)
    generateRTTSectorBiographer(sys, options);

    if (window.isLoggingEnabled) {
        endTrace();
    }
}

/**
 * HELPER: CLASSIFY INDIVIDUAL BODY
 */
function classifyRTTBody(body, star, zone, parent = null) {
    let type = body.type;
    let roll = 0;

    // --- DWARF PLANETS ---
    if (type === 'Dwarf Planet') {
        roll = tRoll1D(`Dwarf Planet (${zone}) Class Roll`);

        if (zone === 'Epistellar') {
            if (body.isInAsteroidBelt) { tDM('In Belt', -2); roll -= 2; }
            if (roll <= 3) body.worldClass = 'Rockball';
            else if (roll === 5 || roll === 6) body.worldClass = 'Meltball';
            else if (roll >= 4) { // Logic fix: prompt has gaps/overlap, using standard mapping
                let subRoll = tRoll1D('Dwarf Planet Sub-Class Roll');
                body.worldClass = (subRoll <= 4) ? 'Hebean' : 'Promethean';
            } else body.worldClass = 'Rockball';
        }
        else if (zone === 'Inner') {
            if (body.isInAsteroidBelt) { tDM('In Belt', -2); roll -= 2; }
            if (parent && parent.type === 'Helian Planet') { tDM('Helian Moon', 1); roll += 1; }
            if (parent && parent.type === 'Jovian Planet') { tDM('Jovian Moon', 2); roll += 2; }

            if (roll <= 4) body.worldClass = 'Rockball';
            if (roll === 1 || roll === 6) body.worldClass = 'Arean';
            if (roll === 7) body.worldClass = 'Meltball';
            if (roll >= 8) {
                let subRoll = tRoll1D('Dwarf Planet Sub-Class Roll');
                body.worldClass = (subRoll <= 4) ? 'Hebean' : 'Promethean';
            }
        }
        else if (zone === 'Outer') {
            if (body.isInAsteroidBelt) { tDM('In Belt', -1); roll -= 1; }
            if (parent && parent.type === 'Helian Planet') { tDM('Helian Moon', 1); roll += 1; }
            if (parent && parent.type === 'Jovian Planet') { tDM('Jovian Moon', 2); roll += 2; }

            if (roll <= 0) body.worldClass = 'Rockball';
            else if (roll >= 1 && roll <= 4) body.worldClass = 'Snowball';
            // Note: Prompt has overlapping logic (Roll 1/6 Rockball), prioritizing Snowball for core range
            if (roll === 5 || roll === 6) body.worldClass = 'Rockball';
            if (roll === 7) body.worldClass = 'Meltball';
            if (roll >= 8) {
                let subRoll = tRoll1D('Dwarf Planet Sub-Class Roll');
                if (subRoll <= 3) body.worldClass = 'Hebean';
                else if (subRoll === 4 || subRoll === 5) body.worldClass = 'Arean';
                else body.worldClass = 'Promethean';
            }
        }
    }

    // --- TERRESTRIAL PLANETS ---
    if (type === 'Terrestrial Planet') {
        if (zone === 'Epistellar') {
            roll = tRoll1D('Terrestrial Epistellar Class Roll');
            if (roll <= 4) body.worldClass = 'JaniLithic';
            else if (roll === 5) body.worldClass = 'Vesperian';
            else body.worldClass = 'Telluric';
        }
        else if (zone === 'Inner') {
            roll = tRoll2D('Terrestrial Inner Class Roll');
            if (roll >= 2 && roll <= 4) body.worldClass = 'Telluric';
            else if (roll >= 5 && roll <= 6) body.worldClass = 'Arid';
            else if (roll === 7 || roll === 10) body.worldClass = 'Tectonic';
            else if (roll >= 8 && roll <= 9) body.worldClass = 'Oceanic';
            else if (roll >= 11 && roll <= 12) body.worldClass = 'Telluric';
        }
        else if (zone === 'Outer') {
            roll = tRoll1D('Terrestrial Outer Class Roll');
            if (parent) { tDM('Is Satellite', 2); roll += 2; }
            if (roll <= 4) body.worldClass = 'Arid';
            else if (roll >= 5 && roll <= 6) body.worldClass = 'Tectonic';
            else body.worldClass = 'Oceanic';
        }
    }

    // --- HELIAN PLANETS ---
    if (type === 'Helian Planet') {
        if (zone === 'Epistellar') {
            roll = tRoll1D('Helian Epistellar Class Roll');
            body.worldClass = (roll <= 5) ? 'Helian' : 'Asphodelian';
        } else if (zone === 'Inner') {
            roll = tRoll1D('Helian Inner Class Roll');
            body.worldClass = (roll <= 4) ? 'Helian' : 'Panthalassic';
        } else {
            body.worldClass = 'Helian';
        }
    }

    // --- JOVIAN PLANETS ---
    if (type === 'Jovian Planet') {
        if (zone === 'Epistellar') {
            roll = tRoll1D('Jovian Epistellar Class Roll');
            body.worldClass = (roll <= 5) ? 'Jovian' : 'Chthonian';
        } else {
            body.worldClass = 'Jovian';
        }
    }

    // --- SMALL BODIES ---
    if (type === 'Asteroid Belt' || type === 'Small Body') {
        body.worldClass = 'Small Body';
    }

    if (!body.worldClass) body.worldClass = 'Unknown';

    if (parent) {
        writeLogLine(`    Satellite (${type}): Classified as ${body.worldClass}`);
    } else {
        writeLogLine(`  Orbit ${body.orbitNumber} (${type}): Classified as ${body.worldClass}`);
    }
    if (typeof tResult !== 'undefined') { tResult('Thermal Archetype', body.worldClass, 'RTT 2.4: Thermal Logic'); }
}

/**
 * STEP 6: DESIRABILITY & HABITATION
 */


/**
 * HELPER: DESIRABILITY CALCULATION
 */
function calculateRTTDesirability(body, star, parent = null) {
    writeLogLine('  --- Desirability Calc: ' + (body.worldClass || body.type) + ' ---');
    const _savedDesirability = _rttSaveManual(body, ['desirability']);
    let desirability = 0;
    const starClass = star.luminosityClass;

    if (body.worldClass === 'Asteroid Belt') {
        let r1 = tRoll1D('Desirability Roll (+)');
        let r2 = tRoll1D('Desirability Counter (-)');
        desirability = r1 - r2;
        writeLogLine(`  Base Roll (1D6 - 1D6): ${r1} - ${r2} = ${desirability}`);

        if (starClass === 'Ve') {
            let penalty = Math.ceil(tRoll1D('Flare Star Penalty (1D3)') / 2);
            tDM('Flare Star (M-Ve)', -penalty);
            desirability -= penalty;
        }

        if (['III', 'D', 'L'].includes(starClass)) {
            writeLogLine('  Star Type Modifier: +0 (Class III, D, or L)');
        } else if (star.classification.includes('M-V')) {
            tDM('Star Type (M-V)', 1);
            desirability += 1;
        } else {
            tDM('Star Type (Other)', 2);
            desirability += 2;
        }
    } else {
        // Base Environment Penalties
        if (body.hydrosphere === 0) {
            tDM('Dry World (Hydro 0)', -1);
            desirability -= 1;
        }

        let sHex = getEHex(body.size);
        let aHex = getEHex(body.atmosphere);
        let hHex = getEHex(body.hydrosphere);

        if (sHex >= 13 || aHex >= 12 || body.hydrosphere === 'F') {
            tDM('Extreme Environment (Size D+, Atmos C+, or Hydro F)', -2);
            desirability -= 2;
        }

        if (starClass === 'Ve') {
            let penalty = Math.ceil(tRoll1D('Flare Star Penalty') / 2);
            tDM('Flare Star Penalty', -penalty);
            desirability -= penalty;
        }

        if (sHex === 0) {
            tDM('Tiny World (Size 0)', -1);
            desirability -= 1;
        }

        // High Gravity Check
        if (body.worldClass !== 'Jovian') {
            if (sHex >= 10 && aHex <= 15) { // Size A+ and Atmos F-
                tDM('High Gravity (Size A+ and Atmos F-)', -1);
                desirability -= 1;
            }
        }

        // Habitable World Matrix (Size 1-B, Atmos 2-9, Hydro 0-B)
        if (sHex >= 1 && sHex <= 11 && aHex >= 2 && aHex <= 9 && hHex >= 0 && hHex <= 11) {
            // Garden World (Size 5-A, Atmos 4-9, Hydro 4-8)
            if (sHex >= 5 && sHex <= 10 && aHex >= 4 && aHex <= 9 && hHex >= 4 && hHex <= 8) {
                tDM('Garden World Tier', 5);
                desirability += 5;
            } else if (hHex >= 10 && hHex <= 11) {
                tDM('Water World Tier', 3);
                desirability += 3;
            } else if (aHex >= 2 && aHex <= 6 && hHex >= 0 && hHex <= 3) {
                tDM('Pre-Garden World Tier', 2);
                desirability += 2;
            } else {
                tDM('Habitable World Matrix', 4);
                desirability += 4;
            }
        }

        // Star Type Modifiers
        if (['III', 'D', 'L'].includes(starClass)) {
            writeLogLine('  Star Type Modifier: +0 (Class III, D, or L)');
        } else if (star.classification.includes('M-V')) {
            tDM('Star Type (M-V)', 1);
            desirability += 1;
        } else {
            tDM('Star Type (Other)', 2);
            desirability += 2;
        }
    }

    body.desirability = desirability;
    _rttRestoreManual(body, _savedDesirability);
    tResult('Final Desirability', body.desirability, 'RTT 6.1: Desirability Matrix');
}

/**
 * HELPER: TERRAFORMING CHECK
 */
function checkRTTTerraforming(body, star, dominantTL, settlementCenturies) {
    const _savedTerraform = _rttSaveManual(body, ['canBeTerraformed', 'terraformPoints']);
    body.canBeTerraformed = false;
    let sHex = getEHex(body.size);
    let aHex = getEHex(body.atmosphere);

    if (dominantTL >= 10 && body.zone === 'Inner') {
        if (sHex >= 1 && sHex <= 11 && aHex >= 1 && aHex <= 13) {
            if (body.hydrosphere !== 'F') {
                body.canBeTerraformed = true;
                let pointsA = dominantTL + settlementCenturies - 15;
                let pointsB = dominantTL + tRoll1D('Terraform Roll') - 15;
                body.terraformPoints = Math.max(pointsA, pointsB);
            }
        }
    }
    _rttRestoreManual(body, _savedTerraform);
}

/**
 * HELPER: HABITATION TYPE
 */
function determineRTTHabitation(body, systemHasHomeworld, dominantTL) {
    const _savedHabitation = _rttSaveManual(body, ['habitationType']);
    body.habitationType = 'Uninhabited';
    let bHex = getEHex(body.biosphere);

    if (bHex >= 12) {
        body.habitationType = 'Homeworld';
    } else if (body.desirability >= 0) {
        let colonyRoll = tRoll2D('Colony Check') - 2;
        if (colonyRoll <= body.desirability) {
            body.habitationType = 'Colony';
        }
    }

    if (body.habitationType === 'Uninhabited') {
        let outpostRoll = tRoll1D('Outpost Check');
        if (systemHasHomeworld) {
            tDM('Home System', -1);
            outpostRoll -= 1;
        }

        if (outpostRoll <= (dominantTL - 9)) {
            body.habitationType = 'Outpost';
        }
    }

    _rttRestoreManual(body, _savedHabitation);
    let loc = body.orbitNumber ? `Orbit ${body.orbitNumber}` : 'Satellite';
    writeLogLine(`  ${loc}: Desirability=${body.desirability}, Habitation=${body.habitationType}${body.canBeTerraformed ? ' (Can Terraform: ' + body.terraformPoints + ' pts)' : ''}`);

    if (typeof tResult !== 'undefined') {
        tResult('Habitation Type', body.habitationType, 'RTT 3.1: Habitation');
    }
}

/**
 * HELPER: CONVERT E-HEX TO RANK
 */
function getEHex(val) {
    if (typeof val === 'number') return val;
    if (val === 'A') return 10;
    if (val === 'B') return 11;
    if (val === 'C') return 12;
    if (val === 'D') return 13;
    if (val === 'E') return 14;
    if (val === 'F') return 15;
    if (val === 'G') return 16;
    if (val === 'Y') return 0; // Asteroid belt size
    return 0;
}

/**
 * STEP 2: ORBITAL ZONES & PLANETARY SYSTEM LAYOUT
 */
function generateRTTSectorStep2(sys, options = {}) {
    if (window.isLoggingEnabled) {
        startTrace(sys.hexId, 'RTT Engine - Step 2', sys.name || sys.hexId);
    }

    tSection('STEP 2: ORBITAL ZONES & PLANETARY SYSTEM LAYOUT');

    for (let star of sys.stars) {
        // Each Primary and Distant Companion star has its own planetary system
        if (star.role === 'Primary' || star.orbitType === 'Distant') {
            tSection(`Orbital Generation for ${star.classification} (${star.role})`);

            star.planetarySystem = {
                orbits: []
            };

            // DMs for orbit counts
            let epistellarDM = 0;
            let innerDM = 0;
            let outerDM = 0;

            if (star.classification === 'M-V') {
                epistellarDM = -1;
                innerDM = -1;
                // outerDM handled by inline star.type === 'M' check below (same -1 applies to L too)
            }

            // Companion interference (applicable to Primary star focus)
            let hasClose = false;
            let hasModerate = false;
            if (star.role === 'Primary') {
                hasClose = sys.stars.some(s => s.orbitType === 'Close');
                hasModerate = sys.stars.some(s => s.orbitType === 'Moderate');
            }

            // 1. GENERATE ORBIT ZONES AND COUNTS

            // Epistellar Orbits
            let epistellarCount = 0;
            if (['III', 'D', 'L'].includes(star.luminosityClass)) {
                epistellarCount = 0;
                tResult('Epistellar Count (Forbidden)', 0, 'RTT 2.1: Zone Quantity');
            } else {
                let eRoll = tRoll1D('Epistellar Count Roll (1D6-3)');
                epistellarCount = Math.max(0, Math.min(2, eRoll - 3 + epistellarDM));
                if (epistellarDM !== 0) tDM('Star Type M-V', epistellarDM);
                tResult('Epistellar Count', epistellarCount, 'RTT 2.1: Zone Quantity');
            }

            // Inner Zone Orbits
            let innerCount = 0;
            if (hasClose) {
                innerCount = 0;
                tResult('Inner Count (Close Companion Interference)', 0, 'RTT 2.1: Zone Quantity');
            } else if (star.type === 'L') {
                innerCount = Math.max(0, rollD3() - 1);
                tResult('Inner Count (L-Type 1D3-1)', innerCount, 'RTT 2.1: Zone Quantity');
            } else {
                let iRoll = tRoll1D('Inner Count Roll (1D6-1)');
                innerCount = Math.max(0, iRoll - 1 + innerDM);
                if (innerDM !== 0) tDM('Star Type M-V', innerDM);
                tResult('Inner Count', innerCount, 'RTT 2.1: Zone Quantity');
            }

            // Outer Zone Orbits
            let outerCount = 0;
            if (hasModerate) {
                outerCount = 0;
                tResult('Outer Count (Moderate Companion Interference)', 0, 'RTT 2.1: Zone Quantity');
            } else {
                let oRoll = tRoll1D('Outer Count Roll (1D6-1)');
                outerCount = Math.max(0, oRoll - 1 + outerDM);
                if (star.type === 'M' || star.type === 'L') {
                    tDM('Star Type M or L', -1);
                    outerCount = Math.max(0, outerCount - 1);
                }
                tResult('Outer Count', outerCount, 'RTT 2.1: Zone Quantity');
            }

            // Combine into orbits list
            const totalOrbits = epistellarCount + innerCount + outerCount;
            const orbitZones = [];
            for (let i = 0; i < epistellarCount; i++) orbitZones.push('Epistellar');
            for (let i = 0; i < innerCount; i++) orbitZones.push('Inner');
            for (let i = 0; i < outerCount; i++) orbitZones.push('Outer');

            // 2. DETERMINE ORBIT CONTENTS
            for (let i = 0; i < totalOrbits; i++) {
                let zone = orbitZones[i];
                let roll = tRoll1D(`Orbit ${i + 1} (${zone}) Content Roll`);
                if (star.type === 'L') {
                    tDM('L-Type Star', -1);
                    roll -= 1;
                }

                let bodyType = 'Jovian Planet';
                if (roll <= 1) bodyType = 'Asteroid Belt';
                else if (roll === 2) bodyType = 'Dwarf Planet';
                else if (roll === 3) bodyType = 'Terrestrial Planet';
                else if (roll === 4) bodyType = 'Helian Planet';
                else bodyType = 'Jovian Planet';

                let body = {
                    orbitNumber: i + 1,
                    zone: zone,
                    type: bodyType,
                    satellites: [],
                    rings: 'None'
                };

                // 3. DETERMINE SATELLITES AND RINGS
                processRTTSatellites(body);

                star.planetarySystem.orbits.push(body);
                tResult(`Orbit ${i + 1} Result`, `${body.type} (${body.rings !== 'None' ? body.rings + ', ' : ''}${body.satellites.length} sats)`, 'RTT 2.2: Orbit Content');
            }
        }
    }

    // Proactively run Step 3
    generateRTTSectorStep3(sys, options);

    if (window.isLoggingEnabled) {
        endTrace();
    }
}

/**
 * HELPER: PROCESS SATELLITES AND RINGS
 */
function processRTTSatellites(body) {
    let satCount = 0; // Tracks number of satellites to assign letters (a, b, c...)

    // Helper function to build a fully initialized satellite object
    const createSat = (typeStr, roleStr = 'Satellite') => {
        satCount++;
        return {
            type: typeStr,
            role: roleStr,
            zone: body.zone, // CRITICAL: Inherit the parent's orbital zone
            parentOrbit: body.orbitNumber,
            orbitNumber: `${body.orbitNumber}${String.fromCharCode(96 + satCount)}`, // e.g., '3a', '3b'
            isSatellite: true, // Flags for Step 3 logic
            isInAsteroidBelt: false,
            satellites: [],
            rings: 'None'
        };
    };

    if (body.type === 'Asteroid Belt') {
        let roll = tRoll1D('Asteroid Belt Contents Roll');
        body.contents = (roll <= 4) ? 'All Small Bodies' : 'Most Small Bodies + 1 Dwarf Planet';
    }

    if (body.type === 'Dwarf Planet') {
        let roll = tRoll1D('Dwarf Planet Satellite Roll');
        if (roll === 6) {
            body.satellites.push(createSat('Dwarf Planet', 'Binary Companion'));
        }
    }

    if (body.type === 'Terrestrial Planet') {
        let roll = tRoll1D('Terrestrial Planet Satellite Roll');
        if (roll >= 5) {
            body.satellites.push(createSat('Dwarf Planet'));
        }
    }

    if (body.type === 'Helian Planet') {
        let count = Math.max(0, tRoll1D('Helian Satellite Count (1D6-3)') - 3);
        if (count > 0) {
            let typeRoll = tRoll1D('Helian Satellite Type Roll');
            for (let i = 0; i < count; i++) {
                if (typeRoll === 6 && i === 0) {
                    body.satellites.push(createSat('Terrestrial Planet'));
                } else {
                    body.satellites.push(createSat('Dwarf Planet'));
                }
            }
        }
    }

    if (body.type === 'Jovian Planet') {
        let count = tRoll1D('Jovian Satellite Count (1D6)');
        let typeRoll = tRoll1D('Jovian Satellite Type Roll');

        for (let i = 0; i < count; i++) {
            if (typeRoll === 6 && i === 0) {
                let subRoll = tRoll1D('Jovian Major Satellite Sub-Roll');
                if (subRoll <= 5) {
                    body.satellites.push(createSat('Terrestrial Planet'));
                } else {
                    body.satellites.push(createSat('Helian Planet'));
                }
            } else {
                body.satellites.push(createSat('Dwarf Planet'));
            }
        }

        // Determine Jovian Rings
        let ringRoll = tRoll1D('Jovian Ring Roll');
        body.rings = (ringRoll <= 4) ? 'Minor ring system' : 'Complex ring system';
    }
}



/**
 * HELPER: PROCESS SOCIAL AND ECONOMIC STATS
 */
function processRTTSocialStats(body, star, dominantTL, settlementCenturies, options = {}) {
    const _savedSocial = _rttSaveManual(body, ['industry', 'tradeCodes', 'bases']);
    if (body.habitationType === 'Uninhabited') {
        body.population = 0;
        body.government = 0;
        body.lawLevel = 0;
        if (!isManual(body, 'industry')) body.industry = 0;
        body.tl = 0;
        body.tradeCodes = isManual(body, 'tradeCodes') ? body.tradeCodes : [];
        body.starport = 'X';
        body.bases = isManual(body, 'bases') ? body.bases : [];
        return;
    }

    // 1. POPULATION AND GOVERNMENT
    if (body.habitationType === 'Homeworld') {
        if (body.chemistry === 'Water') {
            body.population = Math.max(0, (body.desirability || 0) + (tRollD3('Pop Var') - tRollD3('Pop Var')));
        } else {
            body.population = tRoll2D('Homeworld Population');
        }

        let nativeTL = typeof options.nativeTL !== 'undefined' ? options.nativeTL : tRoll1D('Native TL Base') + 4;
        if (nativeTL === 0) {
            body.government = 0;
        } else {
            if (tRoll1D('Government Type Roll') <= (nativeTL - 9)) {
                body.government = 7; // Balkanized
            } else {
                body.government = Math.max(0, body.population + tRoll2D('Gov Roll') - 7);
            }
        }
    } else if (body.habitationType === 'Colony') {
        let maxPop = Math.max(0, (body.desirability || 0) + (tRollD3('Pop Var') - tRollD3('Pop Var')));
        let pop = dominantTL + settlementCenturies - 9;
        body.population = Math.max(0, Math.min(pop, maxPop));
        body.population = Math.max(4, body.population); // CLAMP(pop, 4, Max_Pop)
        if (body.population > maxPop) body.population = Math.max(0, maxPop);

        body.government = Math.max(0, body.population + tRoll2D('Gov Roll') - 7);

        // Seeding Friendly Lifeforms
        let sHex = getEHex(body.size);
        let aHex = getEHex(body.atmosphere);
        if (sHex >= 1 && sHex <= 11 && aHex >= 2 && aHex <= 9) {
            if (getEHex(body.biosphere) <= 2) {
                body.biosphere = tRoll1D('Biosphere Seed') + 5;
            }
        }
    } else if (body.habitationType === 'Outpost') {
        body.population = Math.max(0, Math.min(4, tRollD3('Outpost Pop Base') + (body.desirability || 0)));
        if (body.population === 0) {
            body.government = 0;
        } else {
            body.government = Math.max(0, Math.min(6, body.population + tRoll2D('Gov Roll') - 7));
        }
    }

    if (typeof tResult !== 'undefined' && body.habitationType !== 'Uninhabited') {
        tResult('Population Code', body.population, 'RTT 3.1: Social Stats');
        tResult('Government Code', body.government, 'RTT 3.1: Social Stats');
    }

    // 2. LAW LEVEL AND INDUSTRY
    body.lawLevel = (body.government === 0) ? 0 : Math.max(0, body.government + tRoll2D('Law Roll') - 7);

    // Calculate Industry Base
    if (body.population === 0) {
        body.industry = 0;
    } else {
        let indDM = 0;
        let l = body.lawLevel;
        if (l >= 1 && l <= 3) indDM += 1;
        else if (l >= 6 && l <= 9) indDM -= 1;
        else if (l >= 10 && l <= 12) indDM -= 2;
        else if (l >= 13) indDM -= 3;

        let a = getEHex(body.atmosphere);
        if (a >= 10 || a >= 9 || body.hydrosphere === 'F') indDM += 1; // Unsafe environment

        if (dominantTL >= 12 && dominantTL <= 14) indDM += 1;
        else if (dominantTL >= 15) indDM += 2;

        body.industry = Math.max(0, body.population + tRoll2D('Industry Roll') - 7 + indDM);
    }

        // --- Phase 3.3: High Industry Population Bonus (RAW Retroactive) ---
        if (body.industry >= 10) {
            body.population += 1; // Defaulting to the +1 choice (no pollution) per design decision
            body.population = Math.min(15, body.population); // Cap at max UWP F
            if (typeof tResult !== 'undefined') {
                tResult('Industry Bonus', 'Pop +1 (High Industry A+)', 'RTT 3.3: Industry Bonus');
                tResult('Adjusted Population Code', body.population, 'RTT 3.3: Industry Bonus');
            }
        }
    body.population = Math.max(0, body.population);

    if (typeof tResult !== 'undefined' && body.habitationType !== 'Uninhabited') {
        tResult('Law Level Code', body.lawLevel, 'RTT 3.1: Social Stats');
        tResult('Industry Code', body.industry, 'RTT 3.1: Social Stats');
    }

    // 3. TRADE CODES
    assignRTTTradeCodes(body, dominantTL);

    // 4. STARPORT
    body.starport = determineRTTStarport(body, dominantTL);

    // 5. BASES
    assignRTTBases(body, star);

    // 6. TECH LEVEL (Standard Era Assignment)
    body.tl = dominantTL;
    if (typeof tResult !== 'undefined') {
        tResult('Tech Level Code', body.tl, 'RTT 3.2: Tech Level');
    }

    _rttRestoreManual(body, _savedSocial);
}

/**
 * HELPER: ASSIGN TRADE CODES
 */
function assignRTTTradeCodes(body, dominantTL) {
    let codes = [];
    let s = getEHex(body.size);
    let a = getEHex(body.atmosphere);
    let h = getEHex(body.hydrosphere);
    let p = body.population;
    let i = body.industry;
    let b = getEHex(body.biosphere);

    if (a >= 4 && a <= 9 && h >= 4 && h <= 8 && p >= 5 && p <= 7) codes.push('Ag');
    if (body.worldClass === 'Asteroid Belt') codes.push('As');
    if (a >= 2 && a <= 13 && h === 0) codes.push('De');
    if ((a >= 10 || body.chemistry !== 'Water') && h >= 1 && h <= 11) codes.push('Fl');
    if (s >= 5 && s <= 10 && a >= 4 && a <= 9 && h >= 4 && h <= 8) codes.push('Ga');
    if (p >= 9) codes.push('Hi');
    if (i >= (dominantTL - 3)) codes.push('Ht');
    if (a <= 1 && h >= 1) codes.push('Ic');
    if (p >= 9 && i >= 6) codes.push('In');
    if (p >= 1 && p <= 3) codes.push('Lo');
    if (i <= 5) codes.push('Lt');
    if ((a <= 3 || a >= 11) && (h <= 3 || h >= 11) && p >= 6) codes.push('Na');
    if (p >= 4 && p <= 6) codes.push('Ni');
    if (a >= 2 && a <= 5 && h <= 3) codes.push('Po');
    if ((a === 6 || a === 8) && p >= 6 && p <= 8) codes.push('Ri');
    if (b === 0) codes.push('St');
    if (a >= 2 && h >= 10 && h <= 11) codes.push('Wa');
    if (a === 0) codes.push('Va');
    if (b >= 7) codes.push('Zo');
    if (body.isMoon || body.isSatellite || body.type === 'Satellite' || (body.parentType === 'Gas Giant' || body.parentBody === 'Gas Giant')) codes.push('Sa');

    body.tradeCodes = codes;
}

/**
 * HELPER: DETERMINE STARPORT
 */
function determineRTTStarport(body, dominantTL) {
    let portDM = 0;
    const codes = body.tradeCodes;
    if (codes.includes('Ag')) portDM += 1;
    if (codes.includes('Ga')) portDM += 1;
    if (codes.includes('Hi')) portDM += 1;
    if (codes.includes('Ht')) portDM += 1;
    if (codes.includes('In')) portDM += 1;
    if (codes.includes('Na')) portDM += 1;
    if (codes.includes('Ri')) portDM += 1;

    if (dominantTL >= 12 && dominantTL <= 14) portDM += 1;
    else if (dominantTL >= 15) portDM += 2;

    if (codes.includes('Lo')) portDM -= 1;
    if (codes.includes('Po')) portDM -= 1;
    if (dominantTL <= 9) portDM -= 1;

    let roll = tRoll2D('Starport Roll') + body.industry - 7 + portDM;
    let port = 'X';
    if (roll <= 2) port = 'X';
    else if (roll <= 4) port = 'E';
    else if (roll <= 6) port = 'D';
    else if (roll <= 8) port = 'C';
    else if (roll <= 10) port = 'B';
    else port = 'A';

    // Overrides
    if (body.habitationType === 'Outpost' && body.population === 0) port = 'E';
    if (body.industry >= 5 && port === 'X') port = 'E';
    let a = getEHex(body.atmosphere);
    let h = getEHex(body.hydrosphere);
    if ((a <= 3 || a >= 10 || h >= 12) && body.population >= 1 && port === 'X') port = 'E';

    return port;
}

/**
 * HELPER: ASSIGN BASES
 */
function assignRTTBases(body, star) {
    let bases = [];
    let port = body.starport;
    let roll;

    if (port === 'A') {
        if (tRoll2D('Gov Estate Roll') >= 6) {
            bases.push('G');
            roll = tRoll2D('Embassy Check');
            if (roll >= 9) bases.push('F');
            if (roll >= 12) bases.push('Moot');
        }
        if (tRoll2D('Merchant Roll') >= 6) {
            bases.push('M');
            roll = tRoll2D('Shipyard Check');
            if (roll >= 9) bases.push('Y');
            if (roll >= 12) bases.push('MegaCorp HQ');
        }
        if (tRoll2D('Naval Roll') >= 8) {
            bases.push('N');
            if (tRoll2D('Naval Special') >= 11) bases.push('Y or H');
        }
        if (tRoll2D('Research Roll') >= 8) {
            bases.push('R');
            if (tRoll2D('Research Special') >= 11) bases.push('H, U, or L');
        }
        if (tRoll2D('Scout Roll') >= 10) bases.push('S');
        if (tRoll2D('TAS Roll') >= 4) bases.push('T');
    }
    else if (port === 'B') {
        if (tRoll2D('Gov Estate Roll') >= 8) {
            bases.push('G');
            if (tRoll2D('Embassy Check') >= 11) bases.push('F');
        }
        if (tRoll2D('Merchant Roll') >= 8) {
            bases.push('M');
            if (tRoll2D('Shipyard Check') >= 11) bases.push('Y');
        }
        if (tRoll2D('Naval Roll') >= 8) {
            bases.push('N');
            if (tRoll2D('Naval Special') >= 11) bases.push('Y or H');
        }
        if (tRoll2D('Pirate Roll') >= 12) bases.push('P');
        if (tRoll2D('Research Roll') >= 10) bases.push('R');
        if (tRoll2D('Scout Roll') >= 8) {
            bases.push('S');
            if (tRoll2D('Scout Special') >= 11) bases.push('Scout Hostel');
        }
        if (tRoll2D('TAS Roll') >= 6) bases.push('T');
    }
    else if (port === 'C') {
        if (tRoll2D('Gov Estate Roll') >= 10) bases.push('G');
        if (tRoll2D('Merchant Roll') >= 10) bases.push('M');
        if (tRoll2D('Naval Roll') >= 8) {
            bases.push('N');
            if (tRoll2D('Naval Special') >= 11) bases.push('Y or H');
        }
        if (tRoll2D('Pirate Roll') >= 10) bases.push('P');
        if (tRoll2D('Research Roll') >= 10) bases.push('R');
        if (tRoll2D('Scout Roll') >= 8) {
            bases.push('S');
            if (tRoll2D('Scout Special') >= 11) bases.push('Scout Hostel');
        }
        if (tRoll2D('TAS Roll') >= 10) bases.push('T');
    }
    else if (port === 'D') {
        if (tRoll2D('Pirate Roll') >= 12) bases.push('P');
        if (tRoll2D('Scout Roll') >= 7) {
            bases.push('S');
            if (tRoll2D('Scout Special') >= 10) bases.push('Scout Hostel');
        }
    }
    else if (port === 'E') {
        if (tRoll2D('Pirate Roll') >= 12) bases.push('P');
    }

    // Special Condition Bases
    if (body.population >= 1) {
        if (tRoll2D('Psionics Roll') >= 12) bases.push('Z');
        if (tRoll2D('Sacred Site Roll') <= body.population) bases.push('K');
    }

    if (body.habitationType === 'Outpost') {
        if (tRoll2D('Outpost Research Roll') >= 9) {
            bases.push('R');
            if (tRoll2D('Research Special') >= 12) bases.push('L');
        }
    }

    if (body.population >= 1 || getEHex(body.biosphere) >= 1) {
        if (tRoll2D('Special Enclave Roll') >= 10) bases.push('V');
    }

    if (body.canBeTerraformed) {
        bases.push('W');
    }

    body.bases = bases;
}


/**
 * HELPER: EXTRACT MAINWORLD DATA
 * Finds the most populated world (or highest starport) in the RTT system
 * to populate the main hex editor window.
 */
function extractRTTMainworld(sys) {
    let bestWorld = null;
    let bestScore = -1;
    let bestWorldParent = null; // Track parent for Lunar Mainworlds

    tSection('STEP 8: MAINWORLD SELECTION');

    // 1. Clear existing isMainworld flags and Find Best Candidate
    for (let star of sys.stars) {
        if (!star.planetarySystem) continue;
        for (let body of star.planetarySystem.orbits) {
            delete body.isMainworld;
            let score = evaluateRTTMainworldCandidate(body);
            writeLogLine('  Evaluating Candidate: Orbit ' + body.orbitNumber + ' (Pop ' + getEHexLetter(body.population) + ', Port ' + (body.starport || 'X') + ') - Score: ' + score);
            if (score > bestScore) {
                bestScore = score;
                bestWorld = body;
                bestWorldParent = null; // Planets have no parent to track here
            }
            if (body.satellites) {
                for (let sat of body.satellites) {
                    delete sat.isMainworld;
                    let satScore = evaluateRTTMainworldCandidate(sat);
                    writeLogLine('  Evaluating Candidate: Satellite ' + sat.orbitNumber + ' (Pop ' + getEHexLetter(sat.population) + ', Port ' + (sat.starport || 'X') + ') - Score: ' + satScore);
                    if (satScore > bestScore) {
                        bestScore = satScore;
                        bestWorld = sat;
                        bestWorldParent = body; // Capture the parent body
                    }
                }
            }
        }
    }

    if (!bestWorld) {
        // FALLBACK: The system generated 0 planetary bodies (Stellar-Only system)
        return {
            name: sys.name || sys.hexId,
            hex: sys.hexId,
            uwp: 'X000000-0',
            starport: 'X',
            size: 0, atm: 0, hydro: 0, pop: 0, gov: 0, law: 0, tl: 0,
            tradeCodes: ['Va'], // Vacuum
            bases: [],
            navalBase: false,
            scoutBase: false,
            gasGiant: false,
            travelZone: 'Red', // Navigational hazard, no safe harbor
            isMainworld: true,
            isStellarOnly: true
        };
    }

    tResult('Selected Mainworld', (bestWorld.isSatellite ? 'Satellite ' : 'Orbit ') + bestWorld.orbitNumber, 'RTT 8.1: Mainworld Selection');

    // Tag the body so the UI accordion knows this is the system's Mainworld
    bestWorld.isMainworld = true;

    // SEAN PROTOCOL: Moon-Mainworld Selection Logging
    if (bestWorld.isSatellite) {
        tResult('Mainworld Status', 'LUNAR SELECTION', 'RTT 8.1: Mainworld Selection');
        writeLogLine(`[MAINWORLD LOG] Hex ${sys.hexId}: Mainworld is a MOON at Orbit ${bestWorld.orbitNumber}`);

        // Add Universal UI flags (Objective 2)
        bestWorld.isMoon = true;
        bestWorld.isSatellite = true;
        bestWorld.isLunarMainworld = true;
        bestWorld.parentType = bestWorldParent ? (bestWorldParent.worldClass || bestWorldParent.type) : 'Planet';
        bestWorld.parentBody = bestWorld.parentType;
    }

    let port = bestWorld.starport || 'X';
    let size = getEHexLetter(bestWorld.size);
    let atm = getEHexLetter(bestWorld.atmosphere);
    let hydro = getEHexLetter(bestWorld.hydrosphere);
    let pop = getEHexLetter(bestWorld.population);
    let gov = getEHexLetter(bestWorld.government);
    let law = getEHexLetter(bestWorld.lawLevel);

    // RTT doesn't strictly generate TL for all worlds exactly the same way (or at all if pop 0),
    // but we can infer or pass a default. We'll set it to 0 and let socioeconomics/etc handle it or 
    // assign a default based on population.
    let tl = getEHexLetter(bestWorld.population > 0 ? (sys.dominantTL || 12) : 0);

    let uwp = `${port}${size}${atm}${hydro}${pop}${gov}${law}-${tl}`;
    tResult('Final Hex UWP', uwp, 'RTT 8.2: UWP Finalization');

    const result = {
        name: sys.name || sys.hexId,
        hex: sys.hexId,
        uwp: uwp,
        starport: port,
        isLunarMainworld: bestWorld.isSatellite || false,
        isMoon: bestWorld.isSatellite || false,
        size: typeof bestWorld.size === 'number' ? bestWorld.size : getEHex(bestWorld.size),
        atm: typeof bestWorld.atmosphere === 'number' ? bestWorld.atmosphere : getEHex(bestWorld.atmosphere),
        hydro: typeof bestWorld.hydrosphere === 'number' ? bestWorld.hydrosphere : getEHex(bestWorld.hydrosphere),
        pop: typeof bestWorld.population === 'number' ? bestWorld.population : getEHex(bestWorld.population),
        gov: typeof bestWorld.government === 'number' ? bestWorld.government : getEHex(bestWorld.government),
        law: typeof bestWorld.lawLevel === 'number' ? bestWorld.lawLevel : getEHex(bestWorld.lawLevel),
        tl: getEHex(tl),
        tradeCodes: bestWorld.tradeCodes || [],
        bases: bestWorld.bases || [],
        navalBase: (bestWorld.bases || []).includes('N'),
        scoutBase: (bestWorld.bases || []).includes('S'),
        gasGiant: sys.stars.some(s => s.planetarySystem && s.planetarySystem.orbits.some(o => o.worldClass === 'Jovian')),
        travelZone: (bestWorld.bases || []).includes('Z') ? 'Red' : 'Green' // Simplified
    };

    // Run Audit before final return
    auditRTTSystem(sys);

    return result;
}

function evaluateRTTMainworldCandidate(body) {
    if (!body) return -1;
    let score = 0;

    // Priority 1: Population
    let pop = typeof body.population === 'number' ? body.population : getEHex(body.population);
    if (pop === undefined || isNaN(pop)) pop = 0;
    score += pop * 1000;

    // Priority 2: Starport
    let portStr = body.starport || 'X';
    let portScore = 0;
    if (portStr === 'A') portScore = 600;
    else if (portStr === 'B') portScore = 500;
    else if (portStr === 'C') portScore = 400;
    else if (portStr === 'D') portScore = 300;
    else if (portStr === 'E') portScore = 200;
    else if (portStr === 'X') portScore = 100;
    score += portScore;

    // Priority 3: Biosphere
    let bio = typeof body.biosphere === 'number' ? body.biosphere : getEHex(body.biosphere);
    if (bio === undefined || isNaN(bio)) bio = 0;
    score += bio * 10;

    return score;
}

function getEHexLetter(val) {
    if (val === undefined || val === null) return '0';
    if (typeof val === 'string') return val.toUpperCase();
    if (val < 0) return '0';
    if (val < 10) return val.toString();
    // Use the shared eHex lookup (skips I and O)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    return chars[val - 10] || 'Z';
}

function getEHex(char) {
    if (char === undefined || char === null) return 0;
    if (typeof char === 'number') return char;
    const str = char.toString().toUpperCase();
    const code = str.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48; // 0-9
    if (code >= 65 && code <= 72) return code - 55; // A-H (A=10, H=17)
    // Traveller eHex often skips I and O, but for these calculations,
    // we just need the raw value. Using the standard A=10, B=11 sequence.
    if (code >= 74 && code <= 78) return code - 56; // J-N (J=18)
    if (code >= 80) return code - 57; // P...
    return fromUWPChar(str); // Fallback to core helper
}

function tRollD3(label) {
    return tRoll1D3(label);
}

/**
 * RTT SYSTEM AUDIT
 * Verifies that the generated system follows core RTT rules.
 */
function auditRTTSystem(sys) {
    let errors = 0;
    tSection('RTT SYSTEM AUDIT');

    let mainworldCount = 0;
    let bodyFound = false;

    // Iterate through all bodies
    for (let star of sys.stars) {
        if (!star.planetarySystem) continue;
        for (let body of star.planetarySystem.orbits) {
            bodyFound = true;
            errors += checkBodyRules(body);
            if (body.isMainworld) mainworldCount++;

            if (body.satellites) {
                for (let sat of body.satellites) {
                    errors += checkBodyRules(sat);
                    if (sat.isMainworld) mainworldCount++;
                }
            }
        }
    }

    // Helper for Rule Checks

    function checkBodyRules(body) {
        let e = 0;
        let loc = (body.orbitNumber !== undefined) ? `Orbit ${body.orbitNumber}` : (body.role || 'Satellite');

        function rttFail(msg) {
            writeLogLine(`  [FAIL] ${msg}`);
            if (!window.auditBacklog) window.auditBacklog = [];
            window.auditBacklog.push({
                hexId: sys.hexId,
                orbitId: body.orbitNumber || 'Satellite',
                engine: "RTT",
                message: msg
            });
            e++;
        }

        // Rule 1: Homeworlds (Bio C+)
        if (getEHex(body.biosphere) >= 12) {
            if (body.habitationType === 'Homeworld') {
                writeLogLine(`  [PASS] Rule 1: ${loc} matches Bio C+ to Homeworld status`);
            } else {
                rttFail(`Rule 1: ${loc} has Bio C+ but is Habitation='${body.habitationType}'`);
            }
        }

        // Rule 2: Uninhabited
        if (body.habitationType === 'Uninhabited') {
            if (body.population === 0 && body.government === 0 && body.lawLevel === 0) {
                // Common case, skip log to avoid clutter unless error
            } else {
                rttFail(`Rule 2: ${loc} is Uninhabited but has Pop=${body.population} Gov=${body.government} Law=${body.lawLevel}`);
            }
        }

        // Rule 3: Extreme Hydro (F)
        if (body.hydrosphere === 'F') {
            if (body.canBeTerraformed === false) {
                writeLogLine(`  [PASS] Rule 3: ${loc} with Hydro F is non-terraformable`);
            } else {
                rttFail(`Rule 3: ${loc} with Hydro F is marked as Terraformable`);
            }
        }

        // Rule 4: Asteroids
        if (body.type === 'Asteroid Belt') {
            if (body.size === 0 || body.size === 'Y') {
                writeLogLine(`  [PASS] Rule 4: ${loc} Asteroid Belt has valid Size (${body.size})`);
            } else {
                rttFail(`Rule 4: ${loc} is an Asteroid Belt but has Size ${body.size}`);
            }
        }

        return e;
    }

    // Rule 5: Mainworld Check (Exactly one if planets exist)
    if (!sys.isStellarOnly && bodyFound) {
        if (mainworldCount === 1) {
            writeLogLine('  [PASS] Rule 5: Exactly one Mainworld flag detected in system');
        } else {
            let msg = `Rule 5: Expected 1 Mainworld, but found ${mainworldCount}`;
            writeLogLine(`  [FAIL] ${msg}`);
            if (!window.auditBacklog) window.auditBacklog = [];
            window.auditBacklog.push({
                hexId: sys.hexId,
                orbitId: 'System',
                engine: "RTT",
                message: msg
            });
            errors++;
        }
    }

    tResult('RTT Audit Summary', errors + ' error(s) detected', 'RTT Audit');
}

// -----------------------------------------------------------------------------
// v0.9: EXPAND BIOGRAPHER ONLY
// Re-runs only the Biographer (Steps 4-7) on an existing RTT system, preserving
// any manually-set fields. Stars and orbital layout are NOT regenerated.
// -----------------------------------------------------------------------------
window.expandRTTBiographerOnly = function(hexId) {
    const stateObj = hexStates.get(hexId);
    if (!stateObj || !stateObj.rttSystem) return;
    const sys = stateObj.rttSystem;
    generateRTTSectorBiographer(sys);
};
