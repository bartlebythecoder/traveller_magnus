// =====================================================================
// TRAVELLER 5 (T5) GENERATION ENGINE
// =====================================================================

// --- T5 HELPERS ---
function rollFlux() {
    return (Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6) + 1) - 7;
}

function toUWPChar(val) {
    if (val === undefined || val === null) return '0';
    if (typeof val === 'string') return val.toUpperCase();
    if (val >= 10 && val <= 33) {
        // Handle T5 extended alphabet (skipping I and O)
        const alpha = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        return alpha[val] || val.toString(16).toUpperCase();
    }
    return val.toString(16).toUpperCase();
}

function check(val, array) {
    if (typeof val === 'string') {
        // Handle UWP alpha characters
        let num = fromUWPChar(val);
        return array.includes(num);
    }
    return array.includes(val);
}

/**
 * T5 GAS GIANT GENERATION HELPER
 * Rolls 2D for size and type based on alphabetical mapping (skipping 'O').
 * Implements the Ice Giant conversion rule for every 2nd SGG.
 */
function generateGasGiantStats(sys) {
    let roll = tRoll2D('Gas Giant Size Roll');
    let size, type;

    // Mapping 2:M, 3:N (SGG) | 4:P, 5:Q, 6:R, 7:S, 8:T, 9:U, 10:V, 11:W, 12:X (LGG)
    if (roll === 2) { size = 'M'; type = 'Small Gas Giant'; }
    else if (roll === 3) { size = 'N'; type = 'Small Gas Giant'; }
    else {
        type = 'Large Gas Giant';
        if (roll === 4) size = 'P';
        else if (roll === 5) size = 'Q';
        else if (roll === 6) size = 'R';
        else if (roll === 7) size = 'S';
        else if (roll === 8) size = 'T';
        else if (roll === 9) size = 'U';
        else if (roll === 10) size = 'V';
        else if (roll === 11) size = 'W';
        else if (roll === 12) size = 'X';
        else size = 'X'; // Should not happen with 2D roll
    }

    if (type === 'Small Gas Giant') {
        sys.sggCount = (sys.sggCount || 0) + 1;
        if (sys.sggCount % 2 === 0) {
            type = 'Ice Giant';
        }
    }

    return { size, type };
}

/**
 * T5 SUBORDINATE SOCIAL GENERATOR
 * Applies Continuation Cap (Pop < MW Pop) and Spaceport restrictions.
 * Cascades Government and Law from the capped Population.
 */
function generateT5SubordinateSocial(world, mainworld) {
    if (!world) return;

    tSection('Subordinate Social Stats (T5)');

    // 1. Identification: System Cap
    const mwPop = (mainworld && mainworld.pop !== undefined) ? mainworld.pop : 0;
    const maxSubordinatePop = Math.max(0, mwPop - 1);
    tResult('System Pop Capacity', maxSubordinatePop);

    // 2. Population Generation (World Type logic)
    generateT5PopulationByWorldType(world, world.worldType || 'Planet', maxSubordinatePop);
    tResult('Final Population', toUWPChar(world.pop));
    tResult('Pop Multiplier', world.popDigit);

    // 3. Spaceport
    generateT5SpaceportByWorldType(world, world.worldType || 'Planet');
    tResult('Spaceport', world.starport);

    // 4. Cascading Socials
    generateT5GovernmentByWorldType(world, world.worldType || 'Planet');
    generateT5LawLevelByWorldType(world, world.worldType || 'Planet');

    // 5. Tech Level Roll
    generateT5TechLevelByWorldType(world, world.worldType || 'Planet');
    tResult('Final TL', world.tl);

    // Clamping
    world.pop = Math.max(0, Math.min(15, world.pop || 0));
    world.gov = Math.max(0, Math.min(15, world.gov || 0));
    world.law = Math.max(0, Math.min(18, world.law || 0));
    world.tl = Math.max(0, Math.min(33, world.tl || 0));

    // Size, Atm, Hydro
    let cSize = (typeof world.size === 'number') ? clampUWP(world.size, 0, 15) : world.size;
    let cAtm = clampUWP(world.atm || 0, 0, 15);
    let cHydro = clampUWP(world.hydro || 0, 0, 10);

    // Full UWP construction
    // Full UWP construction
    const uwp = `${world.starport}${toUWPChar(cSize)}${toUWPChar(cAtm)}${toUWPChar(cHydro)}${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;

    world.uwp = uwp;
    world.uwpSecondary = uwp;
    tResult('Final Subordinate UWP', uwp);
}

function getT5OrbitAU(orbit) {
    const table = [0.2, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10, 20, 40, 77, 154, 308, 615, 1230, 2500, 4900, 9800, 19500, 39500];
    return table[orbit] || 0;
}

function parseT5Stellar(name) {
    if (!name) return { type: 'G', decimal: 2, size: 'V' };
    const parts = name.trim().split(/\s+/);
    let typePart = parts[0] || "G2";
    let sizePart = parts[1] || "V";

    let type = typePart[0].toUpperCase();
    let decimal = parseInt(typePart.slice(1)) || 0;
    let size = sizePart;

    if (typePart === 'BD' || typePart === 'Brown Dwarf') {
        return { type: 'BD', decimal: 0, size: 'V' };
    }
    if (typePart === 'D' || typePart === 'White Dwarf' || typePart.startsWith('WD')) {
        return { type: 'D', decimal: 0, size: 'D' };
    }
    return { type, decimal, size };
}

function generateT5StellarProfile(isSecondary = false, pTypeFlux = 0, pSizeFlux = 0) {
    // 1. Spectral Type Roll
    let tFlux;
    if (isSecondary) {
        let roll = Math.floor(rng() * 6) + 1; // 1D
        tFlux = pTypeFlux + (roll - 1);
        writeLogLine(`Secondary Spectral Flux: Primary(${pTypeFlux}) + 1D(${roll}) - 1 = ${tFlux}`);
    } else {
        tFlux = rollFlux();
        writeLogLine(`Primary Spectral Flux Roll: ${tFlux >= 0 ? '+' : ''}${tFlux}`);
    }

    // Chart 2 Exact Mapping
    let type = 'G';
    if (tFlux <= -6) type = rng() < 0.5 ? 'O' : 'B';
    else if (tFlux === -5 || tFlux === -4) type = 'A';
    else if (tFlux === -3 || tFlux === -2) type = 'F';
    else if (tFlux === -1 || tFlux === 0) type = 'G';
    else if (tFlux === 1 || tFlux === 2) type = 'K';
    else if (tFlux >= 3 && tFlux <= 5) type = 'M';
    else type = 'BD'; // +6, +7, +8

    let decimal = Math.floor(rng() * 10);

    // 2. Size Roll
    let sFlux;
    if (isSecondary) {
        let roll = Math.floor(rng() * 6) + 1; // 1D
        sFlux = pSizeFlux + (roll + 2);
        writeLogLine(`Secondary Size Flux: Primary(${pSizeFlux}) + 1D(${roll}) + 2 = ${sFlux}`);
    } else {
        sFlux = rollFlux();
        writeLogLine(`Primary Size Flux Roll: ${sFlux >= 0 ? '+' : ''}${sFlux}`);
    }

    let size = 'V';
    const isOBA = ['O', 'B', 'A'].includes(type);
    const isOB = ['O', 'B'].includes(type);
    const isFGK = ['F', 'G', 'K'].includes(type);

    if (sFlux <= -5) size = isOBA ? 'Ia' : 'II';
    else if (sFlux === -4) {
        if (isOBA) size = 'Ib';
        else if (isFGK) size = 'III';
        else if (type === 'M') size = 'II';
    }
    else if (sFlux === -3) {
        if (isOBA) size = 'II';
        else if (isFGK) size = 'IV';
        else if (type === 'M') size = 'II';
    }
    else if (sFlux === -2) {
        if (isOBA) size = 'III';
        else if (isFGK) size = 'V';
        else if (type === 'M') size = 'III';
    }
    else if (sFlux === -1) {
        if (isOB) size = 'III';
        else if (type === 'A') size = 'IV';
        else size = 'V';
    }
    else if (sFlux === 0) {
        if (isOB) size = 'III';
        else size = 'V';
    }
    else if (sFlux === 1) {
        if (type === 'B') size = 'III';
        else size = 'V';
    }
    else if (sFlux === 2 || sFlux === 3) size = 'V';
    else if (sFlux === 4) {
        if (isOB) size = 'IV';
        else if (type === 'A') size = 'V';
        else size = 'VI';
    }
    else if (sFlux >= 5) size = 'D';

    // 3. Impossibility Constraints (Force to V)
    let originalSize = size;
    if (size === 'IV' && ((type === 'K' && decimal >= 5) || type === 'M')) size = 'V';
    if (size === 'VI' && (['O', 'B', 'A'].includes(type) || (type === 'F' && decimal <= 4))) size = 'V';

    if (size !== originalSize) {
        writeLogLine(`Constraint Applied: Size ${originalSize} not possible for ${type}${decimal}. Forced to Size V.`);
    }

    let name = (size === 'D') ? 'D' : (type === 'BD') ? 'BD' : `${type}${decimal} ${size}`;

    return { type, decimal, size, name, tFlux, sFlux };
}

function generateStar(role, orbitID, importedName = null, isSecondary = false, pTypeFlux = 0, pSizeFlux = 0) {
    let type, decimal, size, tFlux, sFlux;

    tSection(`Generating ${role} Star`);

    if (importedName) {
        tResult('Imported Stellar', importedName);
        const parsed = parseT5Stellar(importedName);
        type = parsed.type;
        decimal = parsed.decimal;
        size = parsed.size;
        tFlux = 0; sFlux = 0; // Default for imports
    } else {
        const profile = generateT5StellarProfile(isSecondary, pTypeFlux, pSizeFlux);
        type = profile.type;
        decimal = profile.decimal;
        size = profile.size;
        tFlux = profile.tFlux;
        sFlux = profile.sFlux;
    }

    // Stellar stats approximation for luminosity
    const TYPE_MAP = { 'O': 50, 'B': 10, 'A': 2, 'F': 1.5, 'G': 1.0, 'K': 0.7, 'M': 0.2, 'BD': 0.05, 'D': 1.0 };
    let luminosity = Math.pow(TYPE_MAP[type] || 1.0, 3.5);

    tResult('Luminosity', luminosity.toFixed(3) + ' L_Sol');

    let starName = (size === 'D') ? 'D' : (type === 'BD') ? 'BD' : `${type}${decimal} ${size}`;
    tResult('Final Stellar', starName);

    return {
        type,
        size,
        decimal,
        orbitID,
        distAU: getT5OrbitAU(orbitID),
        role,
        luminosity,
        name: starName,
        tFlux,
        sFlux
    };
}

function determineStellarConstellation(importedString = null) {
    let stars = [];
    let status = "Generated";

    if (importedString) {
        writeLogLine(`[IMPORT ATTEMPT] Processing stellar string: "${importedString}"`);
        // Attempt to split and parse multiple stars
        const starStrings = typeof importedString === 'string' ? importedString.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
        if (starStrings.length > 0) {
            starStrings.forEach((s, idx) => {
                let role = idx === 0 ? 'Primary' : (idx === 1 ? 'Primary Companion' : 'Star');
                let orbitID = 0;
                if (idx === 2) orbitID = 2; // Close default
                if (idx === 3) orbitID = 8; // Near default
                if (idx === 4) orbitID = 14; // Far default
                stars.push(generateStar(role, orbitID, s));
            });
            status = "Imported";
            writeLogLine(`[SUCCESS] Imported ${stars.length} stars.`);
        } else if (typeof importedString === 'object' && importedString.stars) {
            // Object format support
            stars = importedString.stars.map(s => generateStar(s.role, s.orbitID, s.name));
            status = "Imported";
            writeLogLine(`[SUCCESS] Imported ${stars.length} stars from object.`);
        } else {
            writeLogLine(`[FAILED IMPORT] Malformed or empty stellar string. Falling back to Table 1 Flux rolls.`);
            status = "Fallback";
        }
    }

    if (stars.length === 0) {
        tSection('Generating System Stars (Table 1, 2 & 3)');

        const primary = generateStar('Primary', 0);
        const pTFlux = primary.tFlux;
        const pSFlux = primary.sFlux;
        stars.push(primary);
        writeLogLine(`Primary Star: ${primary.name} (Always Present)`);

        // Helper for Table 1 Flux checks
        const checkStar = (role, orbitFormula) => {
            const flux = rollFlux();
            writeLogLine(`${role} Star Flux Roll: ${flux >= 0 ? '+' : ''}${flux}`);
            if (flux >= 3) {
                const orbit = orbitFormula();
                // Pass true and the primary's fluxes to generate a mathematically linked secondary
                const star = generateStar(role, orbit, null, true, pTFlux, pSFlux);
                writeLogLine(`  [YES] ${role} Star present: ${star.name} at Orbit ${orbit}`);
                return star;
            }
            writeLogLine(`  [NO] No ${role} star present.`);
            return null;
        };

        // Chart 3 Orbit Placement Formulas
        const close = checkStar('Close', () => (Math.floor(rng() * 6) + 1) - 1);         // 1D - 1
        const near = checkStar('Near', () => 5 + (Math.floor(rng() * 6) + 1));           // 5 + 1D
        const far = checkStar('Far', () => 11 + (Math.floor(rng() * 6) + 1));            // 11 + 1D

        if (close) stars.push(close);
        if (near) stars.push(near);
        if (far) stars.push(far);

        // Companions
        const currentStars = [...stars];
        currentStars.forEach(parent => {
            const cFlux = rollFlux();
            writeLogLine(`Companion check for ${parent.role} (${parent.name}) Flux Roll: ${cFlux >= 0 ? '+' : ''}${cFlux}`);
            if (cFlux >= 3) {
                const compProfile = generateStar(`${parent.role} Companion`, 0, null, true, pTFlux, pSFlux);
                // Chart 3: Companions are inside Orbit 0 (represented here as parent orbit + 0.1 for sorting/clarity)
                const compOrbit = parent.orbitID + 0.1;
                compProfile.orbitID = compOrbit;

                writeLogLine(`  [YES] Companion present for ${parent.role}: ${compProfile.name} at Orbit ${compOrbit}`);
                stars.push(compProfile);
            } else {
                writeLogLine(`  [NO] No companion for ${parent.role}.`);
            }
        });
    }

    return { stars, status };
}

// --- T5 HABITABLE ZONE DATA & HELPERS ---
const HZ_DATA = {
    'O': { 'Ia': 15, 'Ib': 15, 'II': 14, 'III': 13, 'IV': 12, 'V': 11, 'D': 1 },
    'B': { 'Ia': 13, 'Ib': 13, 'II': 12, 'III': 11, 'IV': 10, 'V': 9, 'D': 0 },
    'A': { 'Ia': 12, 'Ib': 11, 'II': 9, 'III': 7, 'IV': 7, 'V': 7, 'D': 0 },
    'F': { 'Ia': 11, 'Ib': 10, 'II': 9, 'III': 6, 'IV': 6, 'V': 4, 'VI': 3, 'D': 0 },
    'G': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 7, 'IV': 5, 'V': 3, 'VI': 2, 'D': 0 },
    'K': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 8, 'IV': 5, 'V': 2, 'VI': 1, 'D': 0 },
    'M': { 'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'V': 0, 'VI': 0, 'D': 0 }
};

function getStarHZ(star) {
    if (!star) return 3;

    // Impossible Combinations (Constraint Errors)
    const isImpossible = 
        (['O', 'B', 'A'].includes(star.type) && star.size === 'VI') ||
        (star.type === 'M' && star.size === 'IV');

    if (isImpossible) {
        writeLogLine(`Constraint Error: Spectral Type ${star.type} and Size ${star.size} is impossible. Forcing Size to V.`);
        star.size = 'V';
    }

    const typeMap = HZ_DATA[star.type] || HZ_DATA['G'];
    let hz = typeMap[star.size];

    if (hz === undefined) {
        writeLogLine(`[ERROR] Invalid Star: ${star.type}${star.size} has no HZ defined. Defaulting to Size V.`);
        hz = typeMap['V'] || 3;
    }

    return Math.max(0, Math.min(19, hz));
}

/**
 * T5 ORBIT LABEL HELPER
 * Returns a combined label consisting of [Positional / Climate]
 * per Traveller 5 RAW requirements.
 */
function getT5OrbitLabel(orbit, hzOrbit) {
    let positional = "";
    if (orbit <= hzOrbit - 2) positional = "Inner";
    else if (orbit >= hzOrbit - 1 && orbit <= hzOrbit + 1) positional = "Hospitable";
    else if (orbit >= hzOrbit + 2) positional = "Outer";

    let climate = "";
    // Special Orbit Labels: 0 or 1 get Twilight Zone (Tz)
    if (orbit === 0 || orbit === 1) {
        climate = "Tz";
    } else {
        if (orbit <= hzOrbit - 1) climate = "Hot / Tropic";
        else if (orbit === hzOrbit) climate = "Temperate";
        else if (orbit >= hzOrbit + 1 && orbit <= hzOrbit + 5) climate = "Cold / Tundra";
        else if (orbit >= hzOrbit + 6) climate = "Frozen";
    }

    if (positional && climate) return `${positional} / ${climate}`;
    return positional || climate || "None";
}

function generateT5SizeByWorldType(worldType) {
    if (worldType === 'Belt') {
        writeLogLine(`Size Formula (Belt): Always 0.`);
        return 0;
    }
    
    let size, roll, formula;
    
    if (worldType === 'Inferno') {
        formula = "1D + 6";
        roll = tRoll1D('Inferno Size Roll');
        size = roll + 6;
    } else if (worldType === 'BigWorld') {
        formula = "2D + 7";
        roll = tRoll2D('BigWorld Size Roll');
        size = roll + 7;
    } else if (worldType === 'Worldlet') {
        formula = "1D - 3";
        roll = tRoll1D('Worldlet Size Roll');
        size = roll - 3;
        let final = Math.max(0, size);
        let logMsg = `Size Formula (Worldlet): 1D - 3. Rolled ${roll}. Final Size: ${final}`;
        if (size < 0) logMsg += " Clamped to minimum 0.";
        writeLogLine(logMsg);
        return final;
    } else if (['RadWorld', 'StormWorld'].includes(worldType)) {
        formula = "2D";
        roll = tRoll2D(worldType + ' Size Roll');
        size = roll;
    } else {
        // Hospitable, IceWorld, InnerWorld
        formula = "2D - 2";
        roll = tRoll2D(worldType + ' Size Roll');
        let tempSize = roll - 2;
        if (tempSize === 10) {
            let variantRoll = tRoll1D('Size Roll (10 variant)');
            let final = 9 + variantRoll;
            writeLogLine(`Size Formula (${worldType}): 2D - 2. Rolled 12 (Result 10). Applying 10 variant (9 + 1D). Rolled ${variantRoll}. Final Size: ${final}.`);
            return Math.max(1, final);
        }
        size = Math.max(1, tempSize);
        let logMsg = `Size Formula (${worldType}): 2D - 2. Rolled ${roll}. Final Size: ${size}`;
        if (tempSize < 1) logMsg += " Clamped to minimum 1.";
        writeLogLine(logMsg);
        return size;
    }
    
    writeLogLine(`Size Formula (${worldType}): ${formula}. Rolled ${roll}. Final Size: ${size}.`);
    return size;
}

function generateT5BeltSocial(world, mainworld) {
    if (!world) return;

    // 1. System Cap
    const mwPop = (mainworld && mainworld.pop !== undefined) ? mainworld.pop : 0;
    const maxSubordinatePop = Math.max(0, mwPop - 1);

    // 2. Population (World Type: Belt)
    generateT5PopulationByWorldType(world, 'Belt', maxSubordinatePop);

    // 3. Spaceport
    generateT5SpaceportByWorldType(world, 'Belt');

    // 4. Cascading Socials
    generateT5GovernmentByWorldType(world, 'Belt');
    generateT5LawLevelByWorldType(world, 'Belt');

    // 5. Tech Level
    generateT5TechLevelByWorldType(world, 'Belt');

    // Clamping
    world.pop = Math.max(0, Math.min(15, world.pop));
    world.gov = Math.max(0, Math.min(15, world.gov));
    world.law = Math.max(0, Math.min(18, world.law));
    world.tl = Math.max(0, Math.min(33, world.tl));

    // Strict Formatting: St000PGL-T
    const uwp = `${world.starport}000${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;
    world.uwp = uwp;
    world.uwpSecondary = uwp;
}

function generateT5AtmosphereByWorldType(world, worldType) {
    if (worldType === 'Inferno') {
        world.atm = 11; // B
        writeLogLine(`Atmosphere Calc (Inferno): Fixed to B.`);
        return;
    }
    if (worldType === 'Belt' || worldType === 'Planetoid Belt') {
        world.atm = 0;
        writeLogLine(`Atmosphere Calc (Belt): Automatically 0.`);
        return;
    }

    let flux = rollFlux();
    let dm = (worldType === 'StormWorld') ? 4 : 0;
    
    let rawAtm = (world.size || 0) + flux + dm;
    let minAtm = (worldType === 'StormWorld') ? 4 : 0;
    world.atm = Math.min(15, Math.max(minAtm, rawAtm));

    let logMsg = `Atmosphere Calc (${worldType}): Size ${world.size} + Flux (${flux >= 0 ? '+' : ''}${flux})`;
    if (dm !== 0) logMsg += ` + DM ${dm}`;
    logMsg += ` = ${rawAtm} -> Final: ${toUWPChar(world.atm)}.`;
    writeLogLine(logMsg);
}

function generateT5HydrographicsByWorldType(world, worldType) {
    if (worldType === 'Inferno' || worldType === 'Belt' || worldType === 'Planetoid Belt') {
        world.hydro = 0;
        writeLogLine(`Hydro Calc (${worldType}): Fixed to 0.`);
        return;
    }

    // Small World Limit
    if ((world.size || 0) < 2) {
        world.hydro = 0;
        writeLogLine(`Hydro Calc (${worldType}): Size < 2. Fixed to 0.`);
        return;
    }

    let flux = rollFlux();
    let base = flux + (world.atm || 0);
    
    // Atmospheric Modifier
    let atmDM = (world.atm < 2 || world.atm > 9) ? -4 : 0;
    
    // Type Modifiers (Chart G)
    let typeDM = (['InnerWorld', 'StormWorld'].includes(worldType)) ? -4 : 0;
    
    let rawHydro = base + atmDM + typeDM;
    // Global Bounds 0-10
    world.hydro = Math.min(10, Math.max(0, rawHydro));

    let logMsg = `Hydro Calc (${worldType}): Base (Flux+Atm) ${base}`;
    if (atmDM !== 0) logMsg += ` - DM 4 (Atm)`;
    if (typeDM !== 0) logMsg += ` - DM 4 (${worldType})`;
    logMsg += ` = ${rawHydro}. Clamped to ${toUWPChar(world.hydro)}.`;
    writeLogLine(logMsg);
}

function generateT5PopulationByWorldType(world, worldType, maxSubordinatePop) {
    if (['RadWorld', 'Inferno'].includes(worldType)) {
        world.pop = 0;
        writeLogLine(`Pop Calc (${worldType}): Hardcoded to 0.`);
        world.popDigit = 0;
        return;
    }

    let dm = 0;
    if (worldType === 'InnerWorld') dm = -4;
    else if (['IceWorld', 'StormWorld'].includes(worldType)) dm = -6;

    let rollValue = tRoll2D('Population Roll') - 2;
    let rawPop = rollValue + dm;
    let generatedPop = Math.max(0, rawPop);
    
    let finalPop = Math.min(generatedPop, maxSubordinatePop);
    
    let logMsg = `Pop Calc (${worldType}): Roll (${rollValue + 2}) - 2`;
    if (dm !== 0) logMsg += ` - DM ${Math.abs(dm)}`;
    logMsg += ` = ${rawPop}. Cap is ${maxSubordinatePop}. Final Pop: ${finalPop}`;
    if (finalPop < generatedPop) logMsg += " (Capped).";
    
    writeLogLine(logMsg);
    world.pop = finalPop;
    world.popDigit = world.pop > 0 ? Math.floor(rng() * 10) : 0;
}

function generateT5SpaceportByWorldType(world, worldType) {
    if (['RadWorld', 'Inferno'].includes(worldType)) {
        world.starport = 'Y';
        writeLogLine(`Spaceport Calc (${worldType}): Hardcoded to Type Y.`);
        return;
    }

    const roll = Math.floor(rng() * 6) + 1; // 1D6
    world.spRollValue = roll; // Store for audit
    const score = (world.pop || 0) - roll;
    
    let type = 'Y';
    if (score >= 4) type = 'F';
    else if (score === 3) type = 'G';
    else if (score === 2) type = 'H';
    else type = 'Y';

    world.starport = type;
    writeLogLine(`Spaceport Calc (${worldType}): Pop (${world.pop || 0}) - 1D (${roll}) = ${score} -> Type ${type}.`);
}

function generateT5GovernmentByWorldType(world, worldType) {
    if (['RadWorld', 'Inferno'].includes(worldType)) {
        world.gov = 0;
        world.govFlux = 0;
        writeLogLine(`Gov Calc (${worldType}): Fixed to 0 per profile rules.`);
        return;
    }

    let flux = rollFlux();
    world.govFlux = flux;
    let rawGov = flux + (world.pop || 0);
    world.gov = Math.max(0, Math.min(15, rawGov));

    writeLogLine(`Gov Calc (${worldType}): Flux (${flux >= 0 ? '+' : ''}${flux}) + Pop (${world.pop || 0}) = ${rawGov} -> Final: ${toUWPChar(world.gov)}`);
}

function generateT5LawLevelByWorldType(world, worldType) {
    if (['RadWorld', 'Inferno'].includes(worldType)) {
        world.law = 0;
        writeLogLine(`Law Level Calc (${worldType}): Fixed to 0 per profile rules.`);
        return;
    }

    let flux = rollFlux();
    let rawLaw = flux + (world.gov || 0);
    world.law = Math.max(0, Math.min(18, rawLaw));

    writeLogLine(`Law Level Calc (${worldType}): Flux (${flux >= 0 ? '+' : ''}${flux}) + Gov (${world.gov || 0}) = ${rawLaw} -> Final: ${toUWPChar(world.law)}`);
}

function generateT5TechLevelByWorldType(world, worldType) {
    if (['RadWorld', 'Inferno'].includes(worldType)) {
        world.tl = 0;
        writeLogLine(`TL Calc (${worldType}): Fixed to 0 per profile rules.`);
        return;
    }

    let roll = Math.floor(rng() * 6) + 1; // 1D6
    let mods = [];
    let tlDM = 0;

    // Spaceport
    if (world.starport === 'F') { tlDM += 1; mods.push("Port F (+1)"); }

    // Physical
    const size = typeof world.size === 'number' ? world.size : fromUWPChar(world.size);
    if (size <= 1) { tlDM += 2; mods.push("Size 0-1 (+2)"); }
    else if (size <= 4) { tlDM += 1; mods.push("Size 2-4 (+1)"); }

    const atm = world.atm || 0;
    if (atm <= 3) { tlDM += 1; mods.push("Atm 0-3 (+1)"); }
    else if (atm >= 10 && atm <= 15) { tlDM += 1; mods.push("Atm A-F (+1)"); }

    const hydro = world.hydro || 0;
    if (hydro === 9) { tlDM += 1; mods.push("Hydro 9 (+1)"); }
    else if (hydro === 10) { tlDM += 2; mods.push("Hydro A (+2)"); }

    // Social
    const pop = world.pop || 0;
    if (pop >= 1 && pop <= 5) { tlDM += 1; mods.push("Pop 1-5 (+1)"); }
    else if (pop === 9) { tlDM += 2; mods.push("Pop 9 (+2)"); }
    else if (pop >= 10) { tlDM += 4; mods.push("Pop A+ (+4)"); }

    const gov = world.gov || 0;
    if (gov === 0 || gov === 5) { tlDM += 1; mods.push("Gov 0/5 (+1)"); }
    else if (gov === 13) { tlDM -= 2; mods.push("Gov D (-2)"); }

    let finalTL = Math.max(0, roll + tlDM);
    world.tl = finalTL;

    let logMsg = `TL Calc (${worldType}): Roll (${roll})`;
    if (mods.length > 0) logMsg += " + " + mods.join(" + ");
    logMsg += ` = ${finalTL}.`;
    writeLogLine(logMsg);
}

function getT5Classification(orbit, hzOrbit, isSatellite) {
    const isZoneA = (orbit <= hzOrbit + 1);
    const limit = hzOrbit + 1;
    
    if (isZoneA) {
        writeLogLine(`Zone Detection: Orbit ${orbit} is <= HZ+1 (Orbit ${limit}). Zone A applied.`);
    } else {
        writeLogLine(`Zone Detection: Orbit ${orbit} is >= HZ+2 (Orbit ${limit}). Zone B applied.`);
    }

    let roll = Math.floor(rng() * 6) + 1; // 1D6
    let type;
    if (isZoneA) { // Zone A
        const table = ['Inferno', 'InnerWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'Hospitable'];
        type = table[roll - 1];
    } else { // Zone B
        if (isSatellite) {
            const table = ['Worldlet', 'IceWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'IceWorld'];
            type = table[roll - 1];
        } else {
            const table = ['Worldlet', 'IceWorld', 'BigWorld', 'IceWorld', 'RadWorld', 'IceWorld'];
            type = table[roll - 1];
        }
    }
    writeLogLine(`World Type Roll: 1D6 (${roll}) -> ${type}`);
    return type;
}

function generateT5SystemChunk1(mainworldBase, existingSystem, hexId) {
    reseedForHex(hexId);
    const constellation = determineStellarConstellation(existingSystem);
    let sys = { stars: constellation.stars };
    return sys;
}

function generateT5SystemChunk2(sys, mainworldBase) {
    if (!sys || !mainworldBase) return sys;

    tSection('System Inventory & Placement');
    sys.sggCount = 0; // Initialize global tracker for Small Gas Giants

    // --- ROUND ROBIN HELPERS ---
    let starIndex = 0;
    function getNextStar() {
        let star = sys.stars[starIndex];
        starIndex = (starIndex + 1) % sys.stars.length;
        return star;
    }

    // --- STEP 5A: INVENTORY ---
    let ggCount;
    if (mainworldBase.gasGiantsCount !== undefined) {
        ggCount = mainworldBase.gasGiantsCount;
        tResult('Gas Giants (Imported)', ggCount);
    } else {
        ggCount = Math.max(0, Math.floor(tRoll2D('Gas Giant Count (2D/2 - 2)') / 2) - 2);
        if (mainworldBase.gasGiant && ggCount === 0) {
            ggCount = 1;
            tOverride('Gas Giant forced by Mainworld', 1);
        }
        tResult('Gas Giants', ggCount);
    }

    let beltCount;
    if (mainworldBase.planetoidBelts !== undefined) {
        beltCount = mainworldBase.planetoidBelts;
        tResult('Planetoid Belts (Imported)', beltCount);
    } else {
        let beltRoll = tRoll1D('Belt Count Roll');
        beltCount = Math.max(0, beltRoll - 3);
        if (mainworldBase.size === 0 && beltCount === 0) {
            beltCount = 1;
            tOverride('Belt forced by Mainworld', 1);
        }
        tResult('Planetoid Belts', beltCount);
    }

    let worldCount = tRoll2D('World Count (2D)');
    tResult('Other Worlds', worldCount);

    // --- STEP 4: PRECLUSION & SLOTS ---
    sys.orbits = [];
    for (let i = 0; i < 20; i++) {
        sys.orbits.push({ orbit: i, distAU: getT5OrbitAU(i), contents: null });
    }

    // Mark Star Orbits as Blocked
    sys.stars.forEach(star => {
        if (star.orbitID !== null) {
            let slot = sys.orbits.find(o => o.orbit === star.orbitID);
            if (slot) {
                slot.blocked = true;
                writeLogLine(`Orbit ${star.orbitID} blocked by ${star.role} star.`);
            }
        }
    });

    // Handle Preclusion (Step 4)
    sys.stars.forEach(star => {
        let preclusionLimit = -1;
        if (star.size === 'Ia') preclusionLimit = 5;
        else if (star.size === 'Ib') preclusionLimit = 4;
        else if (star.size === 'II') preclusionLimit = 3;
        else if (star.size === 'III') preclusionLimit = 2;
        else if (star.size === 'IV') preclusionLimit = 0;
        else if (star.size === 'V' && ['O', 'B', 'A'].includes(star.type)) preclusionLimit = 0;

        if (preclusionLimit >= 0) {
            writeLogLine(`Stellar Preclusion for ${star.name}: Orbits 0-${preclusionLimit} blocked.`);
            for (let i = 0; i <= preclusionLimit; i++) {
                let slot = sys.orbits.find(o => o.orbit === i);
                if (slot) slot.blocked = true;
            }
        }
    });

    // --- STEP 5B: PLACEMENT ---

    // Helper: find the closest non-blocked, non-occupied orbit to a target,
    // expanding outward (+1) then inward (-1) alternately.
    function findClosestFreeOrbit(target) {
        if (target >= 0 && target < 20 && !sys.orbits[target].blocked && !sys.orbits[target].contents) {
            return target;
        }
        for (let delta = 1; delta < 20; delta++) {
            let above = target + delta;
            let below = target - delta;
            if (above < 20 && !sys.orbits[above].blocked && !sys.orbits[above].contents) return above;
            if (below >= 0 && !sys.orbits[below].blocked && !sys.orbits[below].contents) return below;
        }
        return -1; // no free orbit found
    }

    // 1. Determine Habitable Zone (HZ) for Primary
    let hzOrbit = getStarHZ(sys.stars[0]);
    tResult('Primary Habitable Zone', `Orbit ${hzOrbit}`);

    // 2. Place Mainworld — shift outward past stellar preclusion, never into a blocked orbit
    let hzResult = generateHZAndClimate(sys.stars[0].type);
    let mwOrbit = Math.max(0, Math.min(19, hzOrbit + hzResult.hzVariance));

    // Shift outward first past blocked (precluded) orbits, then past occupied ones
    while (mwOrbit < 20 && sys.orbits[mwOrbit].blocked) mwOrbit++;
    while (mwOrbit < 20 && sys.orbits[mwOrbit].contents) mwOrbit++;
    // Fallback: search inward if we overshot the array
    if (mwOrbit >= 20) {
        mwOrbit = hzOrbit + hzResult.hzVariance;
        while (mwOrbit >= 0 && (sys.orbits[mwOrbit].blocked || sys.orbits[mwOrbit].contents)) {
            mwOrbit--;
        }
    }

    if (mwOrbit >= 0 && mwOrbit < 20) {
        // --- DEFENSIVE SELF-CORRECTION: infer satellite status from trade codes ---
        const codes = mainworldBase.tradeCodes || [];
        const hasLk = codes.includes('Lk');
        const hasSa = codes.includes('Sa');
        const hasSatelliteWorldType = mainworldBase.worldType && mainworldBase.worldType.includes('Satellite');

        if ((hasLk || hasSa) && !hasSatelliteWorldType) {
            writeLogLine(`DEBUG: Satellite Trade Code (${hasLk ? 'Lk' : 'Sa'}) detected, but ParentBody data is missing. Current WorldType: ${mainworldBase.worldType}`);
            if (!mainworldBase.parentBody || mainworldBase.parentBody === 'Planet') {
                mainworldBase.worldType = hasLk ? 'Close Satellite' : 'Far Satellite';
                mainworldBase.parentBody = 'Planet';
                writeLogLine(`DEBUG: Self-corrected WorldType to '${mainworldBase.worldType}' and ParentBody to 'Planet'`);
            }
        }

        if (mainworldBase.worldType && mainworldBase.worldType.includes('Satellite') && mainworldBase.parentBody === 'Gas Giant') {
            const ggStats = generateGasGiantStats(sys);
            sys.orbits[mwOrbit].contents = {
                type: ggStats.type,
                size: ggStats.size,
                hostStar: sys.stars[0].name,
                satellites: [{
                    ...mainworldBase,
                    type: 'Mainworld',
                    climateZone: hzResult.climate,
                    t5TradeCode: hzResult.tradeCode
                }]
            };
            ggCount = Math.max(0, ggCount - 1);
            writeLogLine(`Mainworld Placement: Orbit ${mwOrbit} | Parent: ${ggStats.type} (Size ${ggStats.size})`);
        } else if (mainworldBase.worldType && mainworldBase.worldType.includes('Satellite') && mainworldBase.parentBody === 'Planet') {
            sys.orbits[mwOrbit].contents = {
                type: 'Terrestrial World',
                hostStar: sys.stars[0].name,
                satellites: [{
                    ...mainworldBase,
                    type: 'Mainworld',
                    climateZone: hzResult.climate,
                    t5TradeCode: hzResult.tradeCode
                }]
            };
            writeLogLine(`Mainworld Placement: Orbit ${mwOrbit} | Type: ${mainworldBase.worldType} | Parent: ${mainworldBase.parentBody}`);
        } else {
            sys.orbits[mwOrbit].contents = {
                ...mainworldBase,
                type: 'Mainworld',
                hostStar: sys.stars[0].name,
                climateZone: hzResult.climate,
                t5TradeCode: hzResult.tradeCode
            };
        }
        writeLogLine(`Mainworld Placement: Orbit ${mwOrbit} | Type: ${mainworldBase.worldType || 'Planet'} | Parent: ${mainworldBase.parentBody || 'None'}`);
        tResult('Mainworld Placement', `Orbit ${mwOrbit} (HZ ${hzResult.hzVariance >= 0 ? '+' : ''}${hzResult.hzVariance})`);
    }

    // 3. Place Gas Giants (Round-Robin)
    for (let i = 0; i < ggCount; i++) {
        let targetStar = getNextStar();
        let starHZ = getStarHZ(targetStar);
        let ggStats = generateGasGiantStats(sys);
        let roll = tRoll2D('GG Orbit Target Roll');
        let preferredTarget = 0;

        if (ggStats.type === 'Large Gas Giant') {
            preferredTarget = starHZ + (roll - 5);
        } else if (ggStats.type === 'Small Gas Giant') {
            preferredTarget = starHZ + (roll - 4);
        } else if (ggStats.type === 'Ice Giant') {
            preferredTarget = starHZ + (roll - 1);
        }

        preferredTarget = Math.max(0, Math.min(19, preferredTarget));
        let resolved = findClosestFreeOrbit(preferredTarget);

        if (resolved >= 0) {
            sys.orbits[resolved].contents = {
                type: ggStats.type,
                size: ggStats.size,
                hostStar: targetStar.name
            };
            writeLogLine(`Placed ${ggStats.type} (Size ${ggStats.size}) at Orbit ${resolved} around ${targetStar.name} (Target: ${preferredTarget})`);
        } else {
            writeLogLine(`No free orbit for Gas Giant ${i + 1}`);
        }
    }

    // 4. Place Belts (Round-Robin)
    for (let i = 0; i < beltCount; i++) {
        let targetStar = getNextStar();
        let starHZ = getStarHZ(targetStar);
        let roll = tRoll2D('Belt Orbit Target Roll');

        let preferredTarget = Math.max(0, Math.min(19, starHZ + (roll - 3)));
        let resolved = findClosestFreeOrbit(preferredTarget);

        if (resolved >= 0) {
            sys.orbits[resolved].contents = { type: 'Planetoid Belt', hostStar: targetStar.name };
            writeLogLine(`Placed Planetoid Belt at Orbit ${resolved} around ${targetStar.name} (Target: ${preferredTarget})`);
        } else {
            writeLogLine(`No free orbit for Planetoid Belt ${i + 1}`);
        }
    }

    // 5. Place Terrestrial Worlds (Round-Robin)
    const standardTerrestrialArray = [10, 8, 6, 4, 2, 0, 1, 3, 5, 7, 9];

    for (let i = 0; i < worldCount; i++) {
        let targetStar = getNextStar();
        let roll = tRoll2D('Terrestrial Orbit Target Roll');
        let preferredTarget = 0;

        if (i === worldCount - 1) {
            // Final Terrestrial World Case
            preferredTarget = Math.max(0, Math.min(19, 19 - roll));
            writeLogLine(`Final Terrestrial Math triggered: 19 - ${roll} = ${preferredTarget}`);
        } else {
            // Standard Terrestrial Case
            let arrayIndex = Math.max(0, Math.min(10, roll - 2));
            preferredTarget = standardTerrestrialArray[arrayIndex];
        }

        let resolved = findClosestFreeOrbit(preferredTarget);
        if (resolved >= 0) {
            sys.orbits[resolved].contents = { type: 'Terrestrial World', hostStar: targetStar.name };
            writeLogLine(`Placed Terrestrial World at Orbit ${resolved} around ${targetStar.name} (Target: ${preferredTarget})`);
        } else {
            writeLogLine(`No free orbit for Terrestrial World ${i + 1}`);
        }
    }

    // 6. Flag Empty Orbits
    sys.orbits.forEach(o => {
        if (!o.blocked && !o.contents) {
            o.contents = { type: 'Empty' };
        }
    });

    // 7. Calculate Total Worlds (for Export)
    sys.totalWorlds = sys.orbits.filter(o => o.contents && o.contents.type !== 'Empty').length;

    return sys;
}

function generateT5SystemChunk3(sys, mainworldBase) {
    if (!sys || !sys.orbits) return sys;

    // Safety: ensure we have mainworld population for the continuation cap
    if (!mainworldBase) {
        sys.orbits.forEach(o => {
            if (o.contents) {
                if (o.contents.type === 'Mainworld') mainworldBase = o.contents;
                else if (o.contents.satellites) {
                    let found = o.contents.satellites.find(s => s.type === 'Mainworld');
                    if (found) mainworldBase = found;
                }
            }
        });
    }

    // Determine HZ Orbit for Primary
    let hzOrbit = getStarHZ(sys.stars[0]);

    // --- STEP 0: CLASSIFICATION ---
    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty') return;

        // Contents
        if (w.type !== 'Mainworld') {
            if (w.type.includes('Gas Giant') || w.type === 'Ice Giant') {
                w.worldType = w.type;
            } else if (w.type === 'Planetoid Belt') {
                w.worldType = 'Belt';
            } else if (w.type === 'Terrestrial World' || w.type === 'Double Planet') {
                w.worldType = getT5Classification(o.orbit, hzOrbit, false);
                writeLogLine(`Classified Orbit ${o.orbit} (${w.type}) as ${w.worldType}`);
            }
        }

        // Satellites
        if (w.satellites) {
            w.satellites.forEach(s => {
                if (s.type !== 'Mainworld') {
                    s.worldType = getT5Classification(o.orbit, hzOrbit, true);
                    writeLogLine(`Classified Satellite in Orbit ${o.orbit} as ${s.worldType}`);
                }
            });
        }
    });

    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty') return;

        tSection(`Fleshing out Orbit ${o.orbit}: ${w.type} (${w.worldType})`);

        // Planetoid Belt Case
        if (w.type === 'Planetoid Belt') {
            w.size = 0;
            w.atm = 0;
            w.hydro = 0;
            generateT5BeltSocial(w, mainworldBase);
            tResult('UWP (Strict Belt Format)', w.uwp);
        }
        // Terrestrial World / Double Planet Case
        else if (w.type === 'Terrestrial World' || w.type === 'Double Planet') {
            let isMWParent = w.satellites && w.satellites.some(s => s.type === 'Mainworld');

            if (isMWParent) {
                let mw = w.satellites.find(s => s.type === 'Mainworld');
                let mwSize = typeof mw.size === 'number' ? mw.size : (mw.size === 'S' ? 0 : parseInt(mw.size, 16) || 0);

                w.size = generateT5SizeByWorldType('BigWorld');
                tResult('BigWorld Base Size', w.size);

                if (w.size === mwSize) {
                    w.type = 'Double Planet';
                    tOverride('Double Planet Detected (Equal Size)', w.size);
                } else if (mwSize > w.size) {
                    w.size = mwSize + 1;
                    tOverride('Parent Size Adjusted (> MW Size)', w.size);
                }
            } else {
                w.size = generateT5SizeByWorldType(w.worldType);
            }
            tResult('Final Size', w.size);

            // T5 Atmosphere
            generateT5AtmosphereByWorldType(w, w.worldType);

            // T5 Hydrographics
            generateT5HydrographicsByWorldType(w, w.worldType);

            // Social & Continuation Cap
            generateT5SubordinateSocial(w, mainworldBase);

            // Post-Social Fixes for Inferno
            if (w.worldType === 'Inferno') {
                w.starport = 'Y';
                w.pop = 0;
                w.gov = 0;
                w.law = 0;
                w.tl = 0;
                w.uwp = `Y${toUWPChar(w.size)}B0000-0`;
                w.uwpSecondary = w.uwp;
                writeLogLine(`Inferno UWP Forced to ${w.uwp}`);
            }
        }

        if (w.size !== undefined) {
            let sizeVal;
            let isGG = w.type.includes('Gas Giant') || w.type === 'Ice Giant';
            let isRing = (w.size === 'R' && !isGG);
            let isSmall = (w.size === 'S' && !isGG);

            if (isSmall) {
                sizeVal = 0.4;
                w.diamKm = 600;
            } else if (isRing) {
                sizeVal = 0;
                w.diamKm = 0;
            } else {
                sizeVal = (w.size === '0' || w.size === 0) ? 0.3 : (typeof w.size === 'string' ? fromUWPChar(w.size) : w.size);
                w.diamKm = (sizeVal <= 0.3) ? 500 : isGG ? sizeVal * 10000 : sizeVal * 1600;
            }

            // Density & Gravity
            let dRoll = tRoll1D('Density Roll');
            w.density = dRoll <= 2 ? 0.8 : (dRoll <= 5 ? 1.0 : 1.2);
            tResult('Density', w.density);

            w.gravity = parseFloat((w.density * (sizeVal / 8)).toFixed(2));
            tResult('Gravity', w.gravity + ' G');

        }

        // Apply Full T5 Orbit Labeling (Positional + Climate)
        w.climateZone = getT5OrbitLabel(o.orbit, hzOrbit);
        writeLogLine(`Orbit ${o.orbit} Label: ${w.climateZone}`);

        if (w.type === 'Mainworld') {
            // Append the T5 Table 2B Trade Code if one was generated
            if (w.t5TradeCode) {
                if (!w.tradeCodes) w.tradeCodes = [];
                if (!w.tradeCodes.includes(w.t5TradeCode)) w.tradeCodes.push(w.t5TradeCode);
            }
        }


        // Gas Giant defaults
        if (w.type.includes('Gas Giant') || w.type === 'Ice Giant') {
            let sizeNum = fromUWPChar(w.size);
            w.gravity = (sizeNum >= 24) ? 2.5 : 0.8; // Proxy: LGG (P+) gets 2.5G, SGG/IG (M,N) gets 0.8G
            w.diamKm = sizeNum * 10000;
            w.density = 1.0;
        }

        // Secondary Satellites (Moons)
        if (w.type === 'Mainworld' || w.type === 'Terrestrial World' || w.type.includes('Gas Giant') || w.type === 'Ice Giant') {
            let moonCount = 0;
            if (w.type.includes('Gas Giant') || w.type === 'Ice Giant') {
                moonCount = Math.max(0, tRoll2D('GG Moon Count Roll') - 2);
            } else {
                moonCount = Math.max(0, tRoll1D('Moon Count Roll') - 3);
            }
            tResult('Satellite Count', moonCount);

            if (!w.satellites) w.satellites = [];
            // Flesh out existing satellites (e.g. Mainworld)
            w.satellites.forEach(s => {
                if (s.type === 'Mainworld') {
                    let sSizeVal = (s.size === 'S' || s.size === '0' || s.size === 0) ? 0.3 : s.size;
                    s.diamKm = (s.size === 0 || s.size === 'S') ? 500 : s.size * 1600;
                    s.density = w.density || 1.0;
                    s.gravity = parseFloat((s.density * (sSizeVal / 8)).toFixed(2));
                }
            });
            // If the Mainworld is already a satellite, we only generate the REMAINDER of the moon count
            let startIdx = w.satellites.length;
            for (let i = startIdx; i < moonCount; i++) {
                let m = { 
                    type: 'Moon',
                    worldType: getT5Classification(o.orbit, hzOrbit, true)
                };
                tSection(`Moon ${i + 1} for Orbit ${o.orbit} (${m.worldType})`);

                // 1. Size Roll based on worldType
                let rawSize = generateT5SizeByWorldType(m.worldType);

                // 2. Parent-Satellite Size Constraint (Moon < Parent)
                // GGs have proxies 15 or 12, Terrestrial 0-10+
                if (rawSize >= w.size) {
                    m.size = Math.max(0, w.size - 1);
                    tOverride('Moon size restricted (< parent)', m.size);
                    if (m.size === 0 && !['Worldlet', 'Belt'].includes(m.worldType)) {
                        let oldType = m.worldType;
                        m.worldType = 'Worldlet';
                        writeLogLine(`Physics Constraint: Re-classified ${oldType} as Worldlet due to Size 0 restriction.`);
                    }
                } else {
                    m.size = rawSize;
                }
                tResult('Final Moon Size', m.size);

                // 3. Atmosphere
                generateT5AtmosphereByWorldType(m, m.worldType);

                // 4. Hydrographics
                generateT5HydrographicsByWorldType(m, m.worldType);

                // 5. Social Generation & UWP construction
                generateT5SubordinateSocial(m, mainworldBase);

                // Post-Social Fixes for Inferno
                if (m.worldType === 'Inferno') {
                    m.starport = 'Y';
                    m.pop = 0;
                    m.gov = 0;
                    m.law = 0;
                    m.tl = 0;
                    m.uwp = `Y${toUWPChar(m.size)}B0000-0`;
                    m.uwpSecondary = m.uwp;
                }

                let mSizeVal = m.size === 0 ? 0.3 : m.size;
                m.diamKm = m.size === 0 ? 500 : m.size * 1600;
                m.density = w.density || 1.0;
                m.gravity = parseFloat((m.density * (mSizeVal / 8)).toFixed(2));
                w.satellites.push(m);
            }
        }
    });

    // Populate a flat worlds array for the audit tool (include nested satellites)
    sys.worlds = [];
    sys.orbits.forEach(o => {
        if (o.contents && o.contents.type !== 'Empty') {
            sys.worlds.push(o.contents);
            if (o.contents.satellites) {
                o.contents.satellites.forEach(s => sys.worlds.push(s));
            }
        }
    });

    // Run the final system audit
    runT5SystemAudit(sys, hzOrbit);


    return sys;
}

function runT5SystemAudit(sys, hzOrbit) {
    if (!sys || !sys.orbits) return;
    if (hzOrbit === undefined) hzOrbit = getStarHZ(sys.stars[0]);

    let mainworldBase = null;
    sys.orbits.forEach(o => {
        if (o.contents) {
            if (o.contents.type === 'Mainworld') mainworldBase = o.contents;
            else if (o.contents.satellites) {
                let found = o.contents.satellites.find(s => s.type === 'Mainworld');
                if (found) mainworldBase = found;
            }
        }
    });

    tSection('T5 System Audit');
    let totalErrors = 0;


    // --- 1. Orbit Integrity ---
    let mwCount = 0;
    sys.orbits.forEach(o => {
        if (o.contents && o.contents.type === 'Mainworld') mwCount++;
        if (o.contents && o.contents.satellites) {
            o.contents.satellites.forEach(s => { if (s.type === 'Mainworld') mwCount++; });
        }
    });
    if (mwCount === 0) {
        writeLogLine('[FAIL] Structure: No Mainworld found in system.');
        totalErrors++;
    } else if (mwCount > 1) {
        writeLogLine(`[FAIL] Structure: Multiple Mainworlds found (${mwCount}).`);
        totalErrors++;
    } else {
        writeLogLine('[PASS] Structure: Exactly 1 Mainworld present.');
    }

    // --- 2. Inventory Check ---
    let ggCount = sys.orbits.filter(o => o.contents && (o.contents.type.includes('Gas Giant') || o.contents.type === 'Ice Giant')).length;
    let beltCount = sys.orbits.filter(o => o.contents && o.contents.type === 'Planetoid Belt').length;
    writeLogLine(`[INFO] Inventory: ${ggCount} Gas Giants, ${beltCount} Belts, ${sys.worlds.length} total bodies.`);

    // --- 3. Planetary Physics & Satellite Audit ---
    tSection('Planetary Physics & Satellite Audit');
    let physErrors = 0;

    // Helper: normalize size to a number
    function normSize(size, type = '') {
        const isGG = type.includes('Gas Giant') || type === 'Ice Giant';
        if (size === 'S' && !isGG) return 0.4; // dwarf planet/moonlet
        if (size === 'R' && !isGG) return 0;   // Ring (Size 0)
        if (typeof size === 'number') return size;
        if (typeof size === 'string') return fromUWPChar(size);
        return 0;
    }

    // Rule 1 & 2: Satellite size constraints and Double Planet validation
    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || !w.satellites || w.satellites.length === 0) return;

        let parentSize = normSize(w.size, w.type);

        w.satellites.forEach((sat, idx) => {
            let satSize = normSize(sat.size, sat.type);

            // Rule 1: Satellite must not exceed parent size
            if (satSize > parentSize) {
                writeLogLine(`[FAIL] Physics: Orbit ${o.orbit} Satellite ${idx + 1} Size (${satSize}) exceeds Parent Size (${parentSize})`);
                physErrors++;
            }

            // Rule 2: Equal sized bodies must be Double Planet
            if (satSize === parentSize && satSize > 0 && sat.type !== 'Mainworld') {
                // Only flag if the parent is not classified as Double Planet
                if (w.type !== 'Double Planet') {
                    writeLogLine(`[FAIL] Physics: Orbit ${o.orbit} equal sized bodies without 'Double Planet' classification (Size ${parentSize})`);
                    physErrors++;
                }
            }
            // If it's the Mainworld satellite at equal size, also check
            if (satSize === parentSize && satSize > 0 && sat.type === 'Mainworld') {
                if (w.type !== 'Double Planet') {
                    writeLogLine(`[FAIL] Physics: Orbit ${o.orbit} Mainworld and Parent are equal size (${parentSize}) but Parent is '${w.type}' not 'Double Planet'`);
                    physErrors++;
                }
            }
        });
    });

    // --- 4. World Type & Size Audit ---
    tSection('World Type & Size Audit');
    let typeErrors = 0;

    const checkConstraints = (body, orbit, isSat) => {
        let errs = 0;
        if (!body.worldType) {
            writeLogLine(`[FAIL] Missing Data: Body in Orbit ${orbit} is missing worldType.`);
            errs++;
        }
        if (['Hospitable', 'InnerWorld', 'IceWorld'].includes(body.worldType) && (body.size || 0) < 1) {
            writeLogLine(`[FAIL] Size Clamping Check: ${body.worldType} in Orbit ${orbit} has Size ${body.size}. Must be >= 1.`);
            errs++;
        }
        if (body.worldType === 'Belt' && (body.size || 0) !== 0) {
            writeLogLine(`[FAIL] Belt Check: Belt in Orbit ${orbit} has Size ${body.size}. Must be 0.`);
            errs++;
        }
        if (body.worldType === 'Inferno' && body.atm !== 11) {
            writeLogLine(`[FAIL] Atmosphere Check: Inferno in Orbit ${orbit} has Atm ${toUWPChar(body.atm)}. Must be B (11).`);
            errs++;
        }
        if (body.worldType === 'Belt' && body.atm !== 0) {
            writeLogLine(`[FAIL] Atmosphere Check: Belt in Orbit ${orbit} has Atm ${toUWPChar(body.atm)}. Must be 0.`);
            errs++;
        }
        if (body.worldType === 'StormWorld' && (body.atm || 0) < 4) {
            writeLogLine(`[FAIL] Atmosphere Check: StormWorld in Orbit ${orbit} has Atm ${toUWPChar(body.atm)}. Must be >= 4.`);
            errs++;
        }
        if (['Inferno', 'Belt'].includes(body.worldType) && (body.hydro || 0) !== 0) {
            writeLogLine(`[FAIL] Hydro Check: ${body.worldType} in Orbit ${orbit} has Hydro ${toUWPChar(body.hydro)}. Must be 0.`);
            errs++;
        }
        if ((body.size || 0) < 2 && (body.hydro || 0) !== 0) {
            writeLogLine(`[FAIL] Hydro Check: World with Size ${body.size} in Orbit ${orbit} has Hydro ${toUWPChar(body.hydro)}. Must be 0.`);
            errs++;
        }
        // Zone A Integrity
        if (orbit <= hzOrbit + 1) {
            if (body.worldType === 'IceWorld' || (body.worldType === 'Worldlet' && normSize(body.size) >= 1)) {
                writeLogLine(`[FAIL] Zone A Integrity: ${body.worldType} in Orbit ${orbit} is in Zone A (Orbit <= ${hzOrbit + 1}).`);
                errs++;
            }
        }
        // Zone B Integrity
        if (orbit >= hzOrbit + 2) {
            if (isSat) {
                if (['Inferno', 'InnerWorld', 'Hospitable'].includes(body.worldType)) {
                    writeLogLine(`[FAIL] Zone B Integrity (Satellite): ${body.worldType} in Orbit ${orbit} is in Zone B (Orbit >= ${hzOrbit + 2}).`);
                    errs++;
                }
            } else {
                if (['Inferno', 'InnerWorld', 'StormWorld', 'Hospitable'].includes(body.worldType)) {
                    writeLogLine(`[FAIL] Zone B Integrity (Planet): ${body.worldType} in Orbit ${orbit} is in Zone B (Orbit >= ${hzOrbit + 2}).`);
                    errs++;
                }
            }
        }
        return errs;
    };

    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty') return;
        if (w.type !== 'Mainworld') {
            typeErrors += checkConstraints(w, o.orbit, false);
        }
        if (w.satellites) {
            w.satellites.forEach(s => {
                if (s.type !== 'Mainworld') {
                    typeErrors += checkConstraints(s, o.orbit, true);
                }
            });
        }
    });

    totalErrors += typeErrors;

    // --- 5. Population Cap Audit ---
    tSection('Population Cap Audit');
    let popErrors = 0;
    const mwPop = (mainworldBase && mainworldBase.pop !== undefined) ? mainworldBase.pop : 0;

    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty' || w.type === 'Mainworld') return;
        
        if (w.pop > 0 && w.pop >= mwPop && mwPop < 15) {
            writeLogLine(`[FAIL] Pop Cap: ${w.type} in Orbit ${o.orbit} has Pop ${toUWPChar(w.pop)}, which is >= Mainworld Pop ${toUWPChar(mwPop)}.`);
            popErrors++;
        }

        if (w.satellites) {
            w.satellites.forEach(s => {
                if (s.pop > 0 && s.type !== 'Mainworld' && s.pop >= mwPop && mwPop < 15) {
                    writeLogLine(`[FAIL] Pop Cap: Moon of Orbit ${o.orbit} has Pop ${toUWPChar(s.pop)}, which is >= Mainworld Pop ${toUWPChar(mwPop)}.`);
                    popErrors++;
                }
            });
        }
    });
    
    totalErrors += popErrors;
    if (popErrors === 0) {
        writeLogLine('[PASS] Population: No subordinate world exceeds or equals the Mainworld population.');
    }

    // --- 6. Government Logic Audit ---
    tSection('Government Logic Audit');
    let govErrors = 0;
    
    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty' || w.type === 'Mainworld') return;
        
        const checkGov = (body, name) => {
            let errs = 0;
            if (['RadWorld', 'Inferno'].includes(body.worldType) && (body.gov || 0) !== 0) {
                writeLogLine(`[FAIL] Gov Logic: ${body.worldType} in ${name} has Gov ${toUWPChar(body.gov)}. Must be 0.`);
                errs++;
            }
            if ((body.pop || 0) === 0 && body.gov > Math.max(0, body.govFlux || 0) && body.govFlux !== undefined) {
                writeLogLine(`[FAIL] Gov Logic: Pop 0 world in ${name} has Gov ${toUWPChar(body.gov)} exceeding expected ${toUWPChar(Math.max(0, body.govFlux))}.`);
                errs++;
            }
            return errs;
        };

        govErrors += checkGov(w, `Orbit ${o.orbit}`);
        if (w.satellites) {
            w.satellites.forEach((s, idx) => {
                if (s.type !== 'Mainworld') {
                    govErrors += checkGov(s, `Orbit ${o.orbit} Moon ${idx + 1}`);
                }
            });
        }
    });

    totalErrors += govErrors;
    if (govErrors === 0) {
        writeLogLine('[PASS] Government: All non-mainworld government rules followed.');
    }

    // --- 7. Law Level Logic Audit ---
    tSection('Law Level Logic Audit');
    let lawErrors = 0;

    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty' || w.type === 'Mainworld') return;

        const checkLaw = (body, name) => {
            let errs = 0;
            if (['RadWorld', 'Inferno'].includes(body.worldType) && (body.law || 0) !== 0) {
                writeLogLine(`[FAIL] Law Logic: ${body.worldType} in ${name} has Law ${toUWPChar(body.law)}. Must be 0.`);
                errs++;
            }
            if (body.law > 18) {
                writeLogLine(`[FAIL] Law Logic: World in ${name} has Law ${toUWPChar(body.law)} (>${body.law}). Max is J (18).`);
                errs++;
            }
            return errs;
        };

        lawErrors += checkLaw(w, `Orbit ${o.orbit}`);
        if (w.satellites) {
            w.satellites.forEach((s, idx) => {
                if (s.type !== 'Mainworld') {
                    lawErrors += checkLaw(s, `Orbit ${o.orbit} Moon ${idx + 1}`);
                }
            });
        }
    });

    totalErrors += lawErrors;
    if (lawErrors === 0) {
        writeLogLine('[PASS] Law Level: All non-mainworld law level rules followed.');
    }

    // --- 8. Tech Level & Starport Audit ---
    tSection('Tech Level & Starport Audit');
    let tlErrors = 0;

    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty' || w.type === 'Mainworld') return;

        const checkTL = (body, name) => {
            let errs = 0;
            // Skip Gas Giant physical bodies (they don't have social stats/ports)
            if (body.type && (body.type.includes('Gas Giant') || body.type === 'Ice Giant')) return 0;

            if (['RadWorld', 'Inferno'].includes(body.worldType) && (body.tl || 0) !== 0) {
                writeLogLine(`[FAIL] TL Logic: ${body.worldType} in ${name} has TL ${toUWPChar(body.tl)}. Must be 0.`);
                errs++;
            }
            if (!['F', 'G', 'H', 'Y'].includes(body.starport)) {
                writeLogLine(`[FAIL] Starport Restriction: ${body.worldType} in ${name} has Starport ${body.starport}. Must be Spaceport (F-Y).`);
                errs++;
            }
            if (body.spRollValue !== undefined) {
                const score = (body.pop || 0) - body.spRollValue;
                let expected = 'Y';
                if (score >= 4) expected = 'F';
                else if (score === 3) expected = 'G';
                else if (score === 2) expected = 'H';
                
                if (['RadWorld', 'Inferno'].includes(body.worldType)) expected = 'Y';
                
                if (body.starport !== expected) {
                    writeLogLine(`[FAIL] Spaceport Logic: ${body.worldType} in ${name} has Type ${body.starport}, but (Pop ${body.pop} - Roll ${body.spRollValue}) = ${score} implies Type ${expected}.`);
                    errs++;
                }
            }
            return errs;
        };

        tlErrors += checkTL(w, `Orbit ${o.orbit}`);
        if (w.satellites) {
            w.satellites.forEach((s, idx) => {
                if (s.type !== 'Mainworld') {
                    tlErrors += checkTL(s, `Orbit ${o.orbit} Moon ${idx + 1}`);
                }
            });
        }
    });

    totalErrors += tlErrors;
    if (tlErrors === 0) {
        writeLogLine('[PASS] Tech Level: All non-mainworld tech level and starport rules followed.');
    }

    if (typeErrors === 0) {
        writeLogLine('[PASS] World Type & Size: All classification and size rules followed.');
    }

    // Rule 3: Trade Code Integrity (Lk / Sa)
    // Build a set of satellite references for membership testing
    let nestedSatSet = new Set();
    sys.orbits.forEach(o => {
        if (o.contents && o.contents.satellites) {
            o.contents.satellites.forEach(s => nestedSatSet.add(s));
        }
    });

    (sys.worlds || []).forEach(w => {
        let codes = w.tradeCodes || [];
        let hasLk = codes.includes('Lk');
        let hasSa = codes.includes('Sa');


        if (hasLk || hasSa) {
            // Check physical nesting: the world must be in a satellites array, not a top-level orbit
            if (!nestedSatSet.has(w)) {
                // Also check if parentBody was set (data-level indicator)
                if (!w.parentBody) {
                    writeLogLine(`[FAIL] Logic: '${hasLk ? 'Lk' : 'Sa'}' world is not orbiting a parent body (top-level standalone planet)`);
                    physErrors++;
                }
            }
        }
    });

    totalErrors += physErrors;
    if (physErrors === 0) {
        writeLogLine('[PASS] Physics & Orbits: All satellite constraints and trade codes align.');
    }

    // --- T5 Audit Summary ---
    tResult('T5 Audit Summary', totalErrors === 0 ? 'ALL CLEAR' : `${totalErrors} error(s) detected`);
}

function generateT5Mainworld(hexId, wtResult, hzResult, stellarImport = null) {
    if (hexId) {
        reseedForHex(hexId);
        tSection(`T5 Mainworld Generation: Hex ${hexId}`);
    } else {
        tSection(`T5 Mainworld Generation`);
    }

    // --- 0. Stellar Situation (Table 1 & 2A) ---
    const constellationResult = determineStellarConstellation(stellarImport);
    const stars = constellationResult.stars;
    const stellarImportStatus = constellationResult.status;
    const primary = stars[0];

    writeLogLine(`System Constellation: [${stars.map(s => s.name).join(' ')}]`);

    // Handle Stellar Preclusion (Table 2A)
    let blockedOrbits = [];
    stars.forEach(star => {
        let preclusionLimit = -1;
        if (star.size === 'Ia') preclusionLimit = 5;
        else if (star.size === 'Ib') preclusionLimit = 4;
        else if (star.size === 'II') preclusionLimit = 3;
        else if (star.size === 'III') preclusionLimit = 2;
        else if (star.size === 'IV') preclusionLimit = 0;
        else if (star.size === 'V' && ['O', 'B', 'A'].includes(star.type)) preclusionLimit = 0;

        if (preclusionLimit >= 0) {
            for (let i = 0; i <= preclusionLimit; i++) {
                if (!blockedOrbits.includes(i)) blockedOrbits.push(i);
            }
        }
        // Also block the orbit the star actually sits in if it's not the primary
        if (star.orbitID !== 0 && star.orbitID !== null) {
            if (!blockedOrbits.includes(star.orbitID)) blockedOrbits.push(star.orbitID);
        }
    });

    let spRoll = tRoll2D('Starport Roll');
    let starport = 'X';
    if (spRoll <= 4) starport = 'A';
    else if (spRoll <= 7) starport = 'B';
    else if (spRoll <= 9) starport = 'C';
    else if (spRoll === 10) starport = 'D';
    else if (spRoll === 11) starport = 'E';
    else starport = 'X';
    tResult('Final Starport', starport);

    // --- 1. PLANETARY SIZE (Table 3) ---
    tSection('Planetary Size');
    let sizeRoll = tRoll2D('Size Roll') - 2;
    let size = sizeRoll;

    // Apply 9 + 1D rule for rolls of 10
    if (sizeRoll >= 10) {
        let extendedRoll = tRoll1D('Size Extended Roll (9 + 1D)');
        size = 9 + extendedRoll;
        writeLogLine(`Size rolled 10+. Applying T5 Rule: 9 + 1D(${extendedRoll}) = ${size}`);
    } else {
        size = Math.max(0, size);
    }
    tResult('Size Code', size);

    // --- 2. PLANETARY ATMOSPHERE (Table 3) ---
    tSection('Planetary Atmosphere');
    let atm = 0;
    if (size === 0) {
        tSkip('Size 0 (Asteroid) forces Atmosphere 0');
        atm = 0;
    } else {
        let atmFlux = rollFlux();
        writeLogLine(`Atmosphere Base Flux: ${atmFlux >= 0 ? '+' : ''}${atmFlux}`);

        // Apply Table 3 DM: -1 if Size is 0-4
        let atmDm = 0;
        if (size >= 0 && size <= 4) {
            atmDm = -1;
            tDM('Size 0-4 Penalty', -1);
        }

        let rawAtm = atmFlux + size + atmDm;
        atm = Math.max(0, Math.min(15, rawAtm)); // Clamp to valid UWP codes 0-F

        writeLogLine(`Atmosphere Calculation: Flux(${atmFlux}) + Size(${size}) + DM(${atmDm}) = ${rawAtm}`);
        if (rawAtm !== atm) tClamp('Atmosphere', rawAtm, atm);
    }
    tResult('Atmosphere Code', atm);

    // --- 3. PLANETARY HYDROGRAPHICS (Table 3) ---
    tSection('Planetary Hydrographics');
    let hydro = 0;

    // Constraint: If Size is 0 or 1, Hydrographics is 0
    if (size <= 1) {
        tSkip(`Size ${size} forces Hydrographics 0`);
        hydro = 0;
    } else {
        let hFlux = rollFlux();
        writeLogLine(`Hydrographics Base Flux: ${hFlux >= 0 ? '+' : ''}${hFlux}`);

        // Apply Table 3 DM: -4 if Atmosphere is 0, 1, A, B, or C
        let hDm = 0;
        const desertAtmospheres = [0, 1, 10, 11, 12]; // Codes: 0, 1, A, B, C
        if (desertAtmospheres.includes(atm)) {
            hDm = -4;
            tDM('Desert Atmosphere Penalty', -4);
        }

        let rawHydro = hFlux + atm + hDm;
        hydro = Math.max(0, Math.min(10, rawHydro)); // Clamp to 0-10 (A)

        writeLogLine(`Hydrographics Calculation: Flux(${hFlux}) + Atm(${atm}) + DM(${hDm}) = ${rawHydro}`);
        if (rawHydro !== hydro) tClamp('Hydrographics', rawHydro, hydro);
    }
    tResult('Hydrographic Code', toUWPChar(hydro));

    let rawPop = tRoll2D('Population Roll (Standard)') - 2;
    if (rawPop === 10) {
        rawPop = tRoll2D('Population Roll (10 variant)') + 3;
        tOverride('Extended Population Roll', rawPop);
    }
    let pop = Math.max(0, rawPop);
    tResult('Final Population', toUWPChar(pop));

    let popDigit = pop > 0 ? Math.floor(rng() * 9) + 1 : 0;
    tResult('Pop Multiplier', popDigit);

    let govFlux = rollFlux();
    let gov = Math.min(15, Math.max(0, govFlux + pop));
    writeLogLine(`Government Roll: Pop(${pop}) + Flux(${govFlux >= 0 ? '+' : ''}${govFlux}) = ${gov}`);
    tResult('Final Government', toUWPChar(gov));

    let lawFlux = rollFlux();
    let law = Math.min(17, Math.max(0, lawFlux + gov));
    writeLogLine(`Law Roll: Gov(${gov}) + Flux(${lawFlux >= 0 ? '+' : ''}${lawFlux}) = ${law}`);
    tResult('Final Law Level', toUWPChar(law));

    let tlDM = 0;
    if (starport === 'A') { tlDM += 6; tDM('Port A', 6); }
    else if (starport === 'B') { tlDM += 4; tDM('Port B', 4); }
    else if (starport === 'C') { tlDM += 2; tDM('Port C', 2); }
    else if (starport === 'X') { tlDM -= 4; tDM('Port X', -4); }

    if (size <= 1) { tlDM += 2; tDM('Size 0-1', 2); }
    else if (size <= 4) { tlDM += 1; tDM('Size 2-4', 1); }

    if (atm <= 3 || (atm >= 10 && atm <= 15)) { tlDM += 1; tDM('Extreme Atm', 1); }

    if (hydro === 9) { tlDM += 1; tDM('Hydro 9', 1); }
    else if (hydro === 10) { tlDM += 2; tDM('Hydro 10', 2); }

    if (pop >= 1 && pop <= 5) { tlDM += 1; tDM('Low Pop', 1); }
    else if (pop === 9) { tlDM += 2; tDM('High Pop (9)', 2); }
    else if (pop >= 10) { tlDM += 4; tDM('High Pop (A+)', 4); }

    if (gov === 0 || gov === 5) { tlDM += 1; tDM('Anarchy/Feudal', 1); }
    else if (gov === 13) { tlDM -= 2; tDM('Bureaucracy', -2); }

    let rawTLRoll = tRoll1D('TL Roll');
    let tl = Math.max(0, rawTLRoll + tlDM);
    tResult('Final Tech Level', toUWPChar(tl));

    let navalBase = false;
    let scoutBase = false;
    let navalDepot = false;
    let wayStation = false;

    // Placeholder for trade route logic (can be expanded later)
    const isOnTradeRoute = false;

    if (starport === 'A') {
        if (tRoll2D('Naval Base Check') <= 6) navalBase = true;
        if (tRoll2D('Scout Base Check') <= 4) scoutBase = true;

        // Special T5 High-End Bases
        if (Math.random() < 0.001) {
            navalDepot = true;
            tResult('Special Base', 'Naval Depot');
        }
        if (isOnTradeRoute && Math.random() < 0.02) {
            wayStation = true;
            tResult('Special Base', 'Way Station');
        }
    } else if (starport === 'B') {
        if (tRoll2D('Naval Base Check') <= 5) navalBase = true;
        if (tRoll2D('Scout Base Check') <= 5) scoutBase = true; // Updated from 6 to 5
    } else if (starport === 'C') {
        if (tRoll2D('Scout Base Check') <= 6) scoutBase = true;
    } else if (starport === 'D') {
        if (tRoll2D('Scout Base Check') <= 7) scoutBase = true;
    }

    if (navalBase) tResult('Bases', 'Naval');
    if (scoutBase) tResult('Bases', 'Scout');

    // --- System Inventory (Gas Giants & Belts) ---
    let rawGG = tRoll2D('GG Inventory Roll');
    let gasGiantsCount = Math.max(0, Math.floor(rawGG / 2) - 2);

    // Constraint: If the mainworld orbits a Gas Giant, there must be at least 1
    if (wtResult && wtResult.parentBody === 'Gas Giant' && gasGiantsCount === 0) {
        gasGiantsCount = 1;
        tOverride('Gas Giant forced by Mainworld Satellite status', 1);
    }
    tResult('Gas Giants Count', gasGiantsCount);
    let gasGiant = gasGiantsCount > 0; // Boolean flag

    let rawBelts = tRoll1D('Belt Inventory Roll');
    let planetoidBelts = Math.max(0, rawBelts - 3);

    // Constraint: If the mainworld is Size 0 (Asteroid), there must be at least 1 Belt
    if (size === 0 && planetoidBelts === 0) {
        planetoidBelts = 1;
        tOverride('Planetoid Belt forced by Mainworld Size 0', 1);
    }
    tResult('Planetoid Belts Count', planetoidBelts);

    // Apply Clamping
    size = clampUWP(size, 0, 15);
    atm = clampUWP(atm, 0, 15);
    hydro = clampUWP(hydro, 0, 10);
    pop = clampUWP(pop, 0, 15);
    gov = clampUWP(gov, 0, 15);
    law = clampUWP(law, 0, 17);
    tl = clampUWP(tl, 0, 33);

    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;
    tResult('Final UWP', uwp);

    // --- Connect Physical & Stellar Data (Tables 2A, 2B, 2C) ---
    let homestar = primary.name;
    // If physical data wasn't passed in from a higher macro, generate it now
    if (!wtResult || !hzResult) {
        const physResult = generateT5Physical({ size: size }, hexId);
        wtResult = physResult; // Maps worldType, parentBody, satOrbit
        hzResult = physResult; // Maps hzVariance, climate
        // Note: we've already established the constellation above
    }

    let tradeCodes = [];
    // --- 1. Planetary Trade Classes (Table D Updated) ---
    const atmList = [3, 4, 5, 6, 7, 8, 9, 13, 14, 15]; // T5 Codes: 3-9, D, E, F

    if (size === 0 && atm === 0 && hydro === 0) tradeCodes.push("As");
    if (check(atm, [2, 3, 4, 5, 6, 7, 8, 9]) && hydro === 0) tradeCodes.push("De");
    if (check(atm, [10, 11, 12]) && hydro >= 1) tradeCodes.push("Fl");
    if (check(size, [6, 7, 8]) && check(atm, [5, 6, 8]) && check(hydro, [5, 6, 7])) tradeCodes.push("Ga");
    if (size >= 3 && size <= 12 && check(atm, [2, 4, 7, 9, 10, 11, 12]) && hydro <= 2) tradeCodes.push("He");
    if (check(atm, [0, 1]) && hydro >= 1) tradeCodes.push("Ic");
    if (size >= 10 && check(atm, atmList) && hydro === 10) tradeCodes.push("Oc");
    if (atm === 0) tradeCodes.push("Va");
    if (size >= 3 && size <= 9 && check(atm, atmList) && hydro === 10) tradeCodes.push("Wa");

    if (pop === 0 && tl > 0) tradeCodes.push("Di");
    if (pop === 0 && gov === 0 && law === 0) tradeCodes.push("Ba");
    if (pop >= 1 && pop <= 3) tradeCodes.push("Lo");
    if (pop >= 4 && pop <= 6) tradeCodes.push("Ni");
    if (pop === 8) tradeCodes.push("Ph");
    if (pop >= 9) tradeCodes.push("Hi");

    if (atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && (pop === 4 || pop === 8)) tradeCodes.push("Pa");
    if (atm >= 4 && atm <= 9 && hydro >= 4 && hydro <= 8 && pop >= 5 && pop <= 7) tradeCodes.push("Ag");
    if (atm <= 3 && hydro <= 3 && pop >= 6) tradeCodes.push("Na");

    if ([2, 3, 10, 11].includes(atm) && hydro >= 1 && hydro <= 5 && pop >= 3 && pop <= 6 && law >= 6 && law <= 9) tradeCodes.push("Px");
    if ([0, 1, 2, 4, 7, 9].includes(atm) && (pop === 7 || pop === 8)) tradeCodes.push("Pi");
    if ([0, 1, 2, 4, 7, 9, 10, 11, 12].includes(atm) && pop >= 9) tradeCodes.push("In");

    if (atm >= 2 && atm <= 5 && hydro <= 3) tradeCodes.push("Po");
    if ([6, 8].includes(atm) && (pop === 5 || pop === 9)) tradeCodes.push("Pr");
    if ([6, 8].includes(atm) && pop >= 6 && pop <= 8) tradeCodes.push("Ri");

    // --- Status & Climate Codes (From Steps 2B & 2C) ---
    // These variables should be derived from the wtResult and hzResult objects in the calling function
    if (typeof wtResult !== 'undefined' && wtResult !== null) {
        if (wtResult.worldType === 'Far Satellite') tradeCodes.push("Sa");
        if (wtResult.worldType === 'Close Satellite' || wtResult.isTidallyLocked) tradeCodes.push("Lk");
    }
    // --- Climate Trade Codes (Table D Validation) ---
    // These require both the correct HZ Variance AND the UWP digits
    if (typeof hzResult !== 'undefined' && hzResult !== null) {
        // Tr: HZ -1 AND Size 6-9, Atm 4-9, Hyd 3-7
        if (hzResult.hzVariance === -1 &&
            check(size, [6, 7, 8, 9]) &&
            check(atm, [4, 5, 6, 7, 8, 9]) &&
            check(hydro, [3, 4, 5, 6, 7])) {
            if (!tradeCodes.includes("Tr")) tradeCodes.push("Tr");
        }

        // Tu: HZ +1 AND Size 6-9, Atm 4-9, Hyd 3-7
        if (hzResult.hzVariance === 1 &&
            check(size, [6, 7, 8, 9]) &&
            check(atm, [4, 5, 6, 7, 8, 9]) &&
            check(hydro, [3, 4, 5, 6, 7])) {
            if (!tradeCodes.includes("Tu")) tradeCodes.push("Tu");
        }

        // Fr: HZ +2 or Outer AND Size 2-9, Hyd 1-10
        if (hzResult.hzVariance >= 2 &&
            check(size, [2, 3, 4, 5, 6, 7, 8, 9]) &&
            hydro >= 1) {
            if (!tradeCodes.includes("Fr")) tradeCodes.push("Fr");
        }
    }

    // --- Travel Zone & Associated Special Codes ---
    // (Based strictly on Oppression Score: Gov + Law)
    const oppressionScore = gov + law;
    let travelZone = "Green";

    if (oppressionScore >= 22 || starport === 'X') {
        travelZone = "Red";
        if (!tradeCodes.includes("Fo")) tradeCodes.push("Fo");
    } else if (oppressionScore >= 20) {
        travelZone = "Amber";
        if (pop <= 6) {
            if (!tradeCodes.includes("Da")) tradeCodes.push("Da");
        } else {
            if (!tradeCodes.includes("Pz")) tradeCodes.push("Pz");
        }
    }
    // Note: Political codes (Cp, Cs, Cx, Cy) and other Specials (Ab, An) 
    // are assigned manually by the referee and excluded from auto-gen.

    return {
        name: getNextSystemName(hexId),
        homestar, // From Primary Star
        stars,
        stellarImportStatus,
        blockedOrbits,
        // NEW: Capture parentage for Lk/Sa codes
        parentBody: wtResult ? wtResult.parentBody : null,
        worldType: wtResult ? wtResult.worldType : 'Planet',
        wtFlux: wtResult ? wtResult.wtFlux : null,
        uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, popDigit,
        gov, law, tl, navalBase, scoutBase, navalDepot, wayStation,
        gasGiant, gasGiantsCount, planetoidBelts
    };
}

function generateT5Socioeconomics(base, hexId) {
    if (hexId) reseedForHex(hexId);
    if (!base) return null;

    tSection('T5 Socioeconomics Expansion');

    // 1. Importance (Ix)
    tSection('Importance {Ix}');
    let Ix = 0;
    if (['A', 'B'].includes(base.starport)) { Ix += 1; tDM('Port A/B', 1); }
    if (['D', 'E', 'X'].includes(base.starport)) { Ix -= 1; tDM('Port D/E/X', -1); }

    if (base.tl >= 16) { Ix += 1; tDM('TL 16+', 1); }
    if (base.tl >= 10) { Ix += 1; tDM('TL 10+', 1); }
    if (base.tl <= 8) { Ix -= 1; tDM('TL 8-', -1); }

    if (base.tradeCodes) {
        if (base.tradeCodes.includes("Ag")) { Ix += 1; tDM('Agricultural', 1); }
        if (base.tradeCodes.includes("Hi")) { Ix += 1; tDM('High Pop', 1); }
        if (base.tradeCodes.includes("In")) { Ix += 1; tDM('Industrial', 1); }
        if (base.tradeCodes.includes("Ri")) { Ix += 1; tDM('Rich', 1); }
    }

    if (base.pop <= 6) { Ix -= 1; tDM('Low Pop (6-)', -1); }
    if (base.navalBase && base.scoutBase) { Ix += 1; tDM('Naval & Scout', 1); }

    // NEW: T5 rule adds +1 for a Way Station
    if (base.wayStation) { Ix += 1; tDM('Way Station', 1); }

    tResult('Final Importance', `{${Ix >= 0 ? '+' : ''}${Ix}}`);

    // 2. Economic (Ex)
    tSection('Economic (Ex)');
    let rawR = tRoll2D('Resources Roll');
    let R = rawR;
    if (base.tl >= 8) {
        let rMod = (base.gasGiantsCount || 0) + (base.planetoidBelts || 0);
        R += rMod;
        tDM('Gas Giants + Belts (TL 8+)', rMod);
    }
    R = Math.max(0, R);
    tResult('Resources (R)', toUWPChar(R));

    let L = Math.max(0, base.pop - 1);
    tResult('Labor (L)', toUWPChar(L));

    let I = 0;
    if (base.pop > 0) {
        if (base.pop <= 3) {
            I = Ix;
            tResult('Infrastructure (Low Pop)', I);
        } else if (base.pop <= 6) {
            let iRoll = tRoll1D('Infra Roll (1D)');
            I = iRoll + Ix;
        } else {
            let iRoll = tRoll2D('Infra Roll (2D)');
            I = iRoll + Ix;
        }
    }
    I = Math.max(0, I);
    tResult('Infrastructure (I)', toUWPChar(I));

    let E = rollFlux();
    if (E === 0) {
        E = 1;
        writeLogLine(`Efficiency Roll: Flux (0) Forced to 1`);
    } else {
        writeLogLine(`Efficiency Roll: Flux (${E >= 0 ? '+' : ''}${E})`);
    }
    tResult('Efficiency (E)', E >= 0 ? `+${E}` : E);

    // 3. Resource Units (RU)
    tSection('Resource Units (RU)');
    let calcR = R === 0 ? 1 : R;
    let calcL = L === 0 ? 1 : L;
    let calcI = I === 0 ? 1 : I;
    let calcE = E; // Already non-zero
    let RU = calcR * calcL * calcI * calcE;
    writeLogLine(`Calculation: (R:${calcR} * L:${calcL} * I:${calcI} * E:${calcE})`);
    tResult('RU', RU);

    // 4. Cultural (Cx)
    tSection('Cultural [Cx]');
    let H = 0, A = 0, S = 0, Sym = 0;
    if (base.pop > 0) {
        let hFlux = rollFlux();
        H = Math.max(1, base.pop + hFlux);
        writeLogLine(`Homogeneity Roll: Pop(${base.pop}) + Flux(${hFlux >= 0 ? '+' : ''}${hFlux}) = ${H}`);

        A = Math.max(1, base.pop + Ix);
        writeLogLine(`Acceptance Roll: Pop(${base.pop}) + Ix(${Ix}) = ${A}`);

        let sFlux = rollFlux();
        S = Math.max(1, sFlux + 5);
        writeLogLine(`Strangeness Roll: Flux(${sFlux >= 0 ? '+' : ''}${sFlux}) + 5 = ${S}`);

        let symFlux = rollFlux();
        Sym = Math.max(1, symFlux + base.tl);
        writeLogLine(`Symbols Roll: Flux(${symFlux >= 0 ? '+' : ''}${symFlux}) + TL(${base.tl}) = ${Sym}`);
    }

    let ixStr = `{${Ix >= 0 ? '+' : ''}${Ix}}`;
    let exStr = `(${toUWPChar(R)}${toUWPChar(L)}${toUWPChar(I)}${E >= 0 ? '+' : ''}${E})`;
    let cxStr = `[${toUWPChar(H)}${toUWPChar(A)}${toUWPChar(S)}${toUWPChar(Sym)}]`;

    tResult('T5 Extension Line', `${ixStr} ${exStr} ${cxStr}`);

    return {
        Ix, R, L, I, E, RU, H, A, S, Sym,
        ixString: ixStr, exString: exStr, cxString: cxStr,
        displayString: `${ixStr} ${exStr} ${cxStr} RU:${RU}`,
        popMultiplier: base.popDigit,
        belts: base.planetoidBelts,
        gasGiants: base.gasGiantsCount,
        worlds: 0,
        importance: Ix,
        resourceUnits: RU,
        ecoResources: R,
        ecoLabor: L,
        ecoInfrastructure: I,
        ecoEfficiency: E,
        culturalProfile: `${toUWPChar(H)}${toUWPChar(A)}${toUWPChar(S)}${toUWPChar(Sym)}`
    };
}


function generateT5Physical(base, hexId) {
    if (!base) return null;
    reseedForHex(hexId);

    const profile = generateT5StellarProfile();
    let homestar = profile.name;
    let spectralType = profile.type;

    if (spectralType === 'BD') {
        let homestar = 'BD Y';
        let hzResult = generateHZAndClimate(spectralType);
        let wtResult = generateWorldType(base);
        return {
            homestar,
            hzVariance: hzResult.hzVariance,
            climate: hzResult.climate,
            worldType: wtResult.worldType,
            parentBody: wtResult.parentBody,
            satOrbit: wtResult.satOrbit,
            wtFlux: wtResult.wtFlux,
            displayString: `${homestar} | HZ:${hzResult.hzVariance >= 0 ? '+' : ''}${hzResult.hzVariance} ${hzResult.climate} | ${wtResult.worldType}${wtResult.parentBody ? ' (' + wtResult.parentBody + ')' : ''}${wtResult.satOrbit ? ' Orbit: ' + wtResult.satOrbit : ''}`
        };
    }

    let hzResult = generateHZAndClimate(spectralType);
    let wtResult = generateWorldType(base);

    return {
        homestar,
        hzVariance: hzResult.hzVariance,
        climate: hzResult.climate,
        worldType: wtResult.worldType,
        parentBody: wtResult.parentBody,
        satOrbit: wtResult.satOrbit,
        wtFlux: wtResult.wtFlux,
        displayString: `${homestar} | HZ:${hzResult.hzVariance >= 0 ? '+' : ''}${hzResult.hzVariance} ${hzResult.climate} | ${wtResult.worldType}${wtResult.parentBody ? ' (' + wtResult.parentBody + ')' : ''}${wtResult.satOrbit ? ' Orbit: ' + wtResult.satOrbit : ''}`
    };
}

function generateHZAndClimate(spectralType) {
    tSection('Mainworld Orbit & Climate (Table 2B)');
    let hzFlux = rollFlux();
    writeLogLine(`Base HZ Flux Roll: ${hzFlux >= 0 ? '+' : ''}${hzFlux}`);

    // Apply Table 2B DMs
    let dm = 0;
    if (spectralType === 'M') { dm = 2; tDM('Spectral M', 2); }
    if (spectralType === 'O' || spectralType === 'B') { dm = -2; tDM('Spectral O/B', -2); }

    hzFlux += dm;
    hzFlux = Math.max(-6, Math.min(6, hzFlux));
    writeLogLine(`Modified HZ Flux: ${hzFlux >= 0 ? '+' : ''}${hzFlux}`);

    let hzVariance = 0;
    let climate = '';
    let tradeCode = '';

    if (hzFlux === -6) {
        hzVariance = -2;
        climate = '';
        tradeCode = '';
    } else if (hzFlux <= -3) {
        hzVariance = -1;
        climate = 'Hot / Tropic';
        tradeCode = 'Tr';
    } else if (hzFlux <= 2) {
        hzVariance = 0;
        climate = 'Temperate';
        tradeCode = '';
    } else if (hzFlux <= 5) {
        hzVariance = 1;
        climate = 'Cold / Tundra';
        tradeCode = 'Tu';
    } else { // +6
        hzVariance = 2;
        climate = 'Frozen';
        tradeCode = 'Fr';
    }

    tResult('HZ Variance', hzVariance >= 0 ? `+${hzVariance}` : hzVariance);
    tResult('Climate', climate || 'None');
    if (tradeCode) tResult('Trade Code', tradeCode);

    return { hzVariance, climate, tradeCode };
}

function generateWorldType(base) {
    tSection('World Type & Satellites (Table 2C)');
    let baseFlux = rollFlux();
    writeLogLine(`Base World Type Flux Roll: ${baseFlux >= 0 ? '+' : ''}${baseFlux}`);

    // Apply Table 2C DMs
    let dm = 0;
    if (base && base.size === 0) {
        dm = -1;
        tDM('Mainworld is Asteroid (Size 0)', -1);
    }

    let wtFlux = baseFlux + dm;
    wtFlux = Math.max(-6, Math.min(6, wtFlux)); // Clamp to table bounds
    writeLogLine(`Modified World Type Flux: ${wtFlux >= 0 ? '+' : ''}${wtFlux}`);

    let worldType = 'Planet';
    let parentBody = null;
    let satOrbit = null;
    // Table 2C Exact Row Mapping (REWRITTEN per USER Request)
    if (wtFlux <= -4) {
        worldType = 'Far Satellite';
        parentBody = 'Gas Giant';
        if (wtFlux === -6) satOrbit = 'N'; // En
        else if (wtFlux === -5) satOrbit = 'O'; // Oh
        else if (wtFlux === -4) satOrbit = 'P'; // Pee
    } else if (wtFlux === -3) {
        worldType = 'Close Satellite';
        parentBody = 'Gas Giant';
        satOrbit = 'D'; // Dee
    } else {
        // -2 through 6: Planets
        worldType = 'Planet';
        parentBody = null;
        satOrbit = null;
    }

    tResult('World Type', worldType);
    if (parentBody) tResult('Parent Body', parentBody);
    if (satOrbit) {
        tResult('Satellite Orbit (Alpha)', satOrbit);
    }

    return { worldType, parentBody, satOrbit, wtFlux };
}
