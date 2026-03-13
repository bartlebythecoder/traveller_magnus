// =====================================================================
// TRAVELLER 5 (T5) GENERATION ENGINE
// =====================================================================

// --- T5 HELPERS ---
function rollFlux() {
    return (Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6) + 1) - 7;
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
 * T5 SUBORDINATE SOCIAL GENERATOR
 * Applies Continuation Cap (Pop < MW Pop) and Spaceport restrictions.
 * Cascades Government and Law from the capped Population.
 */
function generateT5SubordinateSocial(world, mainworld) {
    if (!world) return;

    tSection('Subordinate Social Stats (T5)');

    // 1. Identification: If we don't have a mainworld reference, default to safe ceiling
    const mwPop = (mainworld && mainworld.pop !== undefined) ? mainworld.pop : 15;
    tResult('Mainworld Pop ceiling', mwPop);

    // 2. Population Continuation Cap (2D-2, results >= MW result are lowered)
    let popRoll = tRoll2D('Population Roll') - 2;
    if (popRoll >= mwPop) {
        world.pop = Math.max(0, mwPop - 1);
        tOverride('Pop capped', world.pop);
    } else {
        world.pop = popRoll;
        tResult('Population', world.pop);
    }
    world.popDigit = world.pop > 0 ? Math.floor(rng() * 10) : 0;
    tResult('Pop Multiplier', world.popDigit);

    // 3. Spaceport Restrictions (1-2: Y, 3-4: H, 5: G, 6: F)
    const spRoll = tRoll1D('Spaceport Roll');
    if (spRoll <= 2) world.starport = 'Y';
    else if (spRoll <= 4) world.starport = 'H';
    else if (spRoll === 5) world.starport = 'G';
    else world.starport = 'F';
    tResult('Spaceport', world.starport);

    // 4. Cascading Socials (T5 standard formulas)
    let govFlux = rollFlux();
    world.gov = Math.max(0, Math.min(15, govFlux + world.pop));
    writeLogLine(`Government Roll: Flux (${govFlux >= 0 ? '+' : ''}${govFlux}) + Pop(${world.pop}) = ${world.gov}`);

    let lawFlux = rollFlux();
    world.law = Math.max(0, Math.min(15, lawFlux + world.gov));
    writeLogLine(`Law Roll: Flux (${lawFlux >= 0 ? '+' : ''}${lawFlux}) + Gov(${world.gov}) = ${world.law}`);

    // 5. Tech Level Roll (1D + Modifiers)
    let tlDM = 0;
    // Spaceport DMs
    if (world.starport === 'F') { tlDM += 1; tDM('Port F', 1); }
    if (world.starport === 'Y') { tlDM -= 4; tDM('Port Y', -4); }

    // Physical/Social DMs (T5)
    if (world.size <= 1) { tlDM += 2; tDM('Small Size', 2); }
    else if (world.size <= 4) { tlDM += 1; tDM('Size 2-4', 1); }

    const atm = world.atm || 0;
    if (atm <= 3 || (atm >= 10 && atm <= 15)) { tlDM += 1; tDM('Extreme Atm', 1); }

    const hydro = world.hydro || 0;
    if (hydro === 9) { tlDM += 1; tDM('Hydro 9', 1); }
    else if (hydro === 10) { tlDM += 2; tDM('Hydro 10', 2); }

    if (world.pop >= 1 && world.pop <= 5) { tlDM += 1; tDM('Low Pop', 1); }
    else if (world.pop === 9) { tlDM += 2; tDM('High Pop (9)', 2); }
    else if (world.pop >= 10) { tlDM += 4; tDM('High Pop (A+)', 4); }

    if (world.gov === 0 || world.gov === 5) { tlDM += 1; tDM('Anarchy/Feudal', 1); }
    else if (world.gov === 13) { tlDM -= 2; tDM('Bureaucracy', -2); }

    let rawTL = tRoll1D('TL Roll');
    world.tl = Math.max(0, rawTL + tlDM);
    tResult('Final TL', world.tl);

    // Clamping
    world.pop = clampUWP(world.pop || 0, 0, 15);
    world.gov = clampUWP(world.gov || 0, 0, 15);
    world.law = clampUWP(world.law || 0, 0, 15);
    world.tl = clampUWP(world.tl || 0, 0, 33); // max 33 (X)

    // Size, Atm, Hydro
    let cSize = (typeof world.size === 'number') ? clampUWP(world.size, 0, 15) : world.size;
    let cAtm = clampUWP(world.atm || 0, 0, 15);
    let cHydro = clampUWP(world.hydro || 0, 0, 10);

    // Full UWP construction
    const toUWPChar = typeof globalThis.toUWPChar === 'function' ? globalThis.toUWPChar : (val) => val.toString(16).toUpperCase();
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
    if (size === 'VI' && (type === 'A' || (type === 'F' && decimal <= 4))) size = 'V';
    
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

    // Mass/Lum Approximate (T5)
    const TYPE_MAP = { 'O': 50, 'B': 10, 'A': 2, 'F': 1.5, 'G': 1.0, 'K': 0.7, 'M': 0.2, 'BD': 0.05, 'D': 1.0 };
    let mass = TYPE_MAP[type] || 1.0;
    let luminosity = Math.pow(mass, 3.5);

    tResult('Mass', mass.toFixed(2) + ' M_Sol');
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
        mass,
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

function generateT5SystemChunk1(mainworldBase, existingSystem, hexId) {
    reseedForHex(hexId);
    const constellation = determineStellarConstellation(existingSystem);
    let sys = { stars: constellation.stars };
    return sys;
}

function generateT5SystemChunk2(sys, mainworldBase) {
    if (!sys || !mainworldBase) return sys;

    tSection('System Inventory & Placement');

    // --- STEP 5A: INVENTORY ---
    let ggCount = Math.max(0, Math.floor(tRoll2D('Gas Giant Count (2D/2 - 2)') / 2) - 2);
    if (mainworldBase.gasGiant && ggCount === 0) {
        ggCount = 1;
        tOverride('Gas Giant forced by Mainworld', 1);
    }
    tResult('Gas Giants', ggCount);

    let beltRoll = tRoll1D('Belt Count Roll');
    let beltCount = Math.max(0, beltRoll - 3);
    if (mainworldBase.size === 0 && beltCount === 0) {
        beltCount = 1;
        tOverride('Belt forced by Mainworld', 1);
    }
    tResult('Planetoid Belts', beltCount);

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

    // 1. Determine Habitable Zone (HZ) for Primary
    // Simple T5 HZ lookup (Sol = 3)
    const HZ_TABLE = {
        'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'IV': 5, 'V': 3, 'VI': 1, 'D': 0
    };
    let hzOrbit = HZ_TABLE[sys.stars[0].size] || 3;
    // Tweak based on spectral type
    if (['O', 'B'].includes(sys.stars[0].type)) hzOrbit += 2;
    if (['K', 'M'].includes(sys.stars[0].type)) hzOrbit -= 1;
    hzOrbit = Math.max(0, Math.min(19, hzOrbit));
    tResult('Primary Habitable Zone', `Orbit ${hzOrbit}`);

    // 2. Place Mainworld
    let hzResult = generateHZAndClimate(sys.stars[0].type);
    let mwOrbit = Math.max(0, Math.min(19, hzOrbit + hzResult.hzVariance));
    
    // Ensure the target orbit is not blocked, shift outward if necessary
    while (mwOrbit < 20 && (sys.orbits[mwOrbit].blocked || sys.orbits[mwOrbit].contents)) {
        mwOrbit++;
    }
    // If we hit the outer edge, search inward instead
    if (mwOrbit >= 20) {
        mwOrbit = hzOrbit + hzResult.hzVariance;
        while (mwOrbit >= 0 && (sys.orbits[mwOrbit].blocked || sys.orbits[mwOrbit].contents)) {
            mwOrbit--;
        }
    }
    
    if (mwOrbit >= 0 && mwOrbit < 20) {
        sys.orbits[mwOrbit].contents = { 
            ...mainworldBase, 
            type: 'Mainworld',
            climateZone: hzResult.climate,
            t5TradeCode: hzResult.tradeCode
        };
        tResult('Mainworld Placement', `Orbit ${mwOrbit} (HZ ${hzResult.hzVariance >= 0 ? '+' : ''}${hzResult.hzVariance})`);
    }

    // 3. Place Gas Giants (Outside HZ preferred)
    for (let i = 0; i < ggCount; i++) {
        let targets = sys.orbits.filter(o => !o.blocked && !o.contents && o.orbit > hzOrbit);
        if (targets.length === 0) targets = sys.orbits.filter(o => !o.blocked && !o.contents);
        if (targets.length > 0) {
            let slot = targets[Math.floor(rng() * targets.length)];
            slot.contents = { type: 'Gas Giant', size: (roll1D() <= 3 ? 'Large' : 'Small') };
            writeLogLine(`Placed ${slot.contents.size} Gas Giant at Orbit ${slot.orbit}`);
        }
    }

    // 4. Place Belts
    for (let i = 0; i < beltCount; i++) {
        let targets = sys.orbits.filter(o => !o.blocked && !o.contents);
        if (targets.length > 0) {
            let slot = targets[Math.floor(rng() * targets.length)];
            slot.contents = { type: 'Planetoid Belt' };
            writeLogLine(`Placed Planetoid Belt at Orbit ${slot.orbit}`);
        }
    }

    // 5. Place Other Worlds
    for (let i = 0; i < worldCount; i++) {
        let targets = sys.orbits.filter(o => !o.blocked && !o.contents);
        if (targets.length > 0) {
            let slot = targets[Math.floor(rng() * targets.length)];
            slot.contents = { type: 'Terrestrial World' };
            writeLogLine(`Placed Terrestrial World at Orbit ${slot.orbit}`);
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
        let mwOrb = sys.orbits.find(o => o.contents && o.contents.type === 'Mainworld');
        if (mwOrb) mainworldBase = mwOrb.contents;
    }

    // Determine HZ Orbit for Primary
    const HZ_TABLE = {
        'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'IV': 5, 'V': 3, 'VI': 1, 'D': 0
    };
    let primary = sys.stars[0];
    let hzOrbit = HZ_TABLE[primary.size] || 3;
    if (['O', 'B'].includes(primary.type)) hzOrbit += 2;
    if (['K', 'M'].includes(primary.type)) hzOrbit -= 1;

    sys.orbits.forEach(o => {
        let w = o.contents;
        if (!w || w.type === 'Empty' || w.type === 'Planetoid Belt') return;

        tSection(`Fleshing out Orbit ${o.orbit}: ${w.type}`);

        // Size, Atmosphere, Hydrographics
        if (w.type === 'Terrestrial World') {
            let sRoll = tRoll2D('Size Roll') - 2;
            if (sRoll === 10) {
                sRoll = tRoll1D('Size Roll (10 variant)') + 9;
                tOverride('Extended Size Roll', sRoll);
            }
            w.size = Math.max(0, sRoll);
            tResult('Final Size', w.size);

            // T5 Atmosphere
            w.atm = 0;
            if (w.size > 0) {
                let atmFlux = rollFlux();
                w.atm = Math.min(15, Math.max(0, atmFlux + w.size));
                writeLogLine(`Atmosphere Roll: Size(${w.size}) + Flux(${atmFlux >= 0 ? '+' : ''}${atmFlux}) = ${w.atm}`);
            }

            // T5 Hydrographics
            w.hydro = 0;
            if (w.size > 1) {
                let hFlux = rollFlux();
                let hDM = (w.atm <= 1 || w.atm >= 10) ? -4 : 0;
                if (hDM !== 0) tDM('Hydro DM (Atm)', hDM);
                w.hydro = Math.min(10, Math.max(0, hFlux + w.atm + hDM));
                writeLogLine(`Hydrographics Roll: Flux(${hFlux >= 0 ? '+' : ''}${hFlux}) + Atm(${w.atm}) + DM(${hDM}) = ${w.hydro}`);
            }

            // Social & Continuation Cap
            generateT5SubordinateSocial(w, mainworldBase);
        }

        if (w.size !== undefined) {
            let sizeVal = (w.size === 'S' || w.size === '0' || w.size === 0) ? 0.3 : w.size;
            w.diamKm = (w.size === 0 || w.size === 'S') ? 500 : w.size * 1600;

            // Density & Gravity
            let dRoll = tRoll1D('Density Roll');
            w.density = dRoll <= 2 ? 0.8 : (dRoll <= 5 ? 1.0 : 1.2);
            tResult('Density', w.density);

            w.gravity = parseFloat((w.density * (sizeVal / 8)).toFixed(2));
            tResult('Gravity', w.gravity + ' G');

            // Mass
            w.mass = parseFloat((w.gravity * Math.pow(sizeVal / 8, 2)).toFixed(3));
            tResult('Mass', w.mass.toFixed(4) + ' M_Earth');
        }

        // Climate & Temperature
        if (w.type === 'Mainworld' && w.climateZone) {
            // Keep Table 2B Climate, just generate a matching temperature
            let tFlux = rollFlux();
            if (w.climateZone.includes('Hot')) w.temperature = 350 + (tFlux * 10);
            else if (w.climateZone.includes('Temperate')) w.temperature = 288 + (tFlux * 10);
            else if (w.climateZone.includes('Cold')) w.temperature = 230 + (tFlux * 10);
            else w.temperature = 100 + (tFlux * 5); // Frozen or blank
            
            // Append the T5 Table 2B Trade Code if one was generated
            if (w.t5TradeCode) {
                if (!w.tradeCodes) w.tradeCodes = [];
                if (!w.tradeCodes.includes(w.t5TradeCode)) w.tradeCodes.push(w.t5TradeCode);
            }
            writeLogLine(`Mainworld Climate: ${w.climateZone} | Temp: ${w.temperature}K`);
        } else {
            // Standard T5 placement logic for non-Mainworlds
            let diff = o.orbit - hzOrbit;
            if (diff < 0) {
                w.climateZone = 'Hot';
                let tFlux = rollFlux();
                w.temperature = 350 + (tFlux * 10);
                writeLogLine(`Climate: Hot | Temp: 350 + Flux(${tFlux})*10 = ${w.temperature}K`);
            } else if (diff === 0) {
                w.climateZone = 'Temperate';
                let tFlux = rollFlux();
                w.temperature = 288 + (tFlux * 10);
                writeLogLine(`Climate: Temperate | Temp: 288 + Flux(${tFlux})*10 = ${w.temperature}K`);
            } else if (diff === 1) {
                w.climateZone = 'Cold';
                let tFlux = rollFlux();
                w.temperature = 230 + (tFlux * 10);
                writeLogLine(`Climate: Cold | Temp: 230 + Flux(${tFlux})*10 = ${w.temperature}K`);
            } else {
                w.climateZone = 'Frozen';
                let tFlux = rollFlux();
                w.temperature = 100 + (tFlux * 5);
                writeLogLine(`Climate: Frozen | Temp: 100 + Flux(${tFlux})*5 = ${w.temperature}K`);
            }
        }

        // Rotation & Day Length
        if (o.orbit <= 1) {
            w.rotationPeriod = 'Tidally Locked';
            tResult('Rotation', 'Tidally Locked');
        } else {
            let rRoll = tRoll1D('Rotation Type Roll');
            if (rRoll <= 2) {
                let rr = tRoll1D('Fast Day');
                w.rotationPeriod = (4 + rr) + ' hours';
            } else if (rRoll <= 5) {
                let rr = tRoll2D('Standard Day');
                w.rotationPeriod = (12 + rr) + ' hours';
            } else {
                let rr = tRoll2D('Slow Day');
                w.rotationPeriod = (36 + rr * 2) + ' hours';
            }
            tResult('Final Rotation', w.rotationPeriod);
        }

        // Orbital Period (Year Length)
        let starMass = sys.stars[0].mass || 1.0;
        w.orbitalPeriod = Math.sqrt(Math.pow(o.distAU, 3) / starMass);
        tResult('Year Length', w.orbitalPeriod.toFixed(2) + ' terrestrial years');

        // Gas Giant defaults
        if (w.type === 'Gas Giant') {
            w.gravity = (w.size === 'Large' ? 2.5 : 0.8);
            w.mass = (w.size === 'Large' ? 300 : 50);
            w.size = (w.size === 'Large' ? 15 : 12); // T5 Size proxies
            w.diamKm = w.size * 10000; // GG scale
        }

        // Secondary Satellites (Moons)
        if (w.type === 'Mainworld' || w.type === 'Terrestrial World' || w.type === 'Gas Giant') {
            let moonCount = 0;
            if (w.type === 'Gas Giant') {
                moonCount = Math.max(0, tRoll2D('GG Moon Count Roll') - 2);
            } else {
                moonCount = Math.max(0, tRoll1D('Moon Count Roll') - 3);
            }
            tResult('Satellite Count', moonCount);

            w.satellites = [];
            for (let i = 0; i < moonCount; i++) {
                tSection(`Moon ${i + 1} for Orbit ${o.orbit}`);
                let m = { type: 'Moon' };

                // 1. Initial Size Roll (1D-1)
                let rawSize = Math.max(0, tRoll1D('Moon Size Roll') - 1);

                // 2. Parent-Satellite Size Constraint (Moon < Parent)
                // GGs have proxies 15 or 12, Terrestrial 0-10+
                if (rawSize >= w.size) {
                    m.size = Math.max(0, w.size - 1);
                    tOverride('Moon size restricted (< parent)', m.size);
                } else {
                    m.size = rawSize;
                }
                tResult('Final Moon Size', m.size);

                // 3. Atmosphere
                m.atm = 0;
                if (m.size > 0) {
                    let mAtmFlux = rollFlux();
                    m.atm = Math.min(15, Math.max(0, mAtmFlux + m.size));
                    writeLogLine(`Moon Atmosphere: Size(${m.size}) + Flux(${mAtmFlux >= 0 ? '+' : ''}${mAtmFlux}) = ${m.atm}`);
                }

                // 4. Hydrographics
                m.hydro = 0;
                if (m.size > 1) {
                    let mhFlux = rollFlux();
                    let mhDM = (m.atm <= 1 || m.atm >= 10) ? -4 : 0;
                    if (mhDM !== 0) tDM('Moon Hydro DM', mhDM);
                    m.hydro = Math.min(10, Math.max(0, mhFlux + m.atm + mhDM));
                    writeLogLine(`Moon Hydro: Flux(${mhFlux >= 0 ? '+' : ''}${mhFlux}) + Atm(${m.atm}) + DM(${mhDM}) = ${m.hydro}`);
                }

                // 5. Social Generation & UWP construction
                generateT5SubordinateSocial(m, mainworldBase);

                let mSizeVal = m.size === 0 ? 0.3 : m.size;
                m.diamKm = m.size === 0 ? 500 : m.size * 1600;
                m.density = w.density || 1.0;
                m.gravity = parseFloat((m.density * (mSizeVal / 8)).toFixed(2));
                m.mass = parseFloat((m.gravity * Math.pow(mSizeVal / 8, 2)).toFixed(5));
                m.temperature = w.temperature;
                m.rotationPeriod = 'Tidally Locked';
                w.satellites.push(m);
            }
        }
    });

    // Populate a flat worlds array for the audit tool
    sys.worlds = sys.orbits.filter(o => o.contents && o.contents.type !== 'Empty').map(o => o.contents);

    // Run the final system audit
    runT5SystemAudit(sys);

    return sys;
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
            check(size, [6,7,8,9]) && 
            check(atm, [4,5,6,7,8,9]) && 
            check(hydro, [3,4,5,6,7])) {
            if (!tradeCodes.includes("Tr")) tradeCodes.push("Tr");
        }

        // Tu: HZ +1 AND Size 6-9, Atm 4-9, Hyd 3-7
        if (hzResult.hzVariance === 1 && 
            check(size, [6,7,8,9]) && 
            check(atm, [4,5,6,7,8,9]) && 
            check(hydro, [3,4,5,6,7])) {
            if (!tradeCodes.includes("Tu")) tradeCodes.push("Tu");
        }

        // Fr: HZ +2 or Outer AND Size 2-9, Hyd 1-10
        if (hzResult.hzVariance >= 2 && 
            check(size, [2,3,4,5,6,7,8,9]) && 
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
            displayString: `${homestar} | HZ:${hzResult.hzVariance >= 0 ? '+' : ''}${hzResult.hzVariance} ${hzResult.climate} | ${wtResult.worldType}${wtResult.parentBody ? ' (' + wtResult.parentBody + ')' : ''}${wtResult.satOrbit ? ' Orbit: ' + wtResult.satOrbit : ''}${wtResult.isTidallyLocked ? ' [Tidally Locked]' : ''}`
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
        displayString: `${homestar} | HZ:${hzResult.hzVariance >= 0 ? '+' : ''}${hzResult.hzVariance} ${hzResult.climate} | ${wtResult.worldType}${wtResult.parentBody ? ' (' + wtResult.parentBody + ')' : ''}${wtResult.satOrbit ? ' Orbit: ' + wtResult.satOrbit : ''}${wtResult.isTidallyLocked ? ' [Tidally Locked]' : ''}`
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
        climate = 'Hot. Tropic.';
        tradeCode = 'Tr';
    } else if (hzFlux <= 2) {
        hzVariance = 0;
        climate = 'Temperate.';
        tradeCode = '';
    } else if (hzFlux <= 5) {
        hzVariance = 1;
        climate = 'Cold. Tundra.';
        tradeCode = 'Tu';
    } else { // +6
        hzVariance = 2;
        climate = 'Frozen.';
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
    let isTidallyLocked = false;

    // Table 2C Exact Row Mapping
    if (wtFlux === -6) { worldType = 'Far Satellite'; parentBody = 'Gas Giant'; satOrbit = 'H'; }
    else if (wtFlux === -5) { worldType = 'Far Satellite'; parentBody = 'Gas Giant'; satOrbit = 'J'; }
    else if (wtFlux === -4) { worldType = 'Far Satellite'; parentBody = 'Gas Giant'; satOrbit = 'K'; }
    else if (wtFlux === -3) { worldType = 'Close Satellite'; parentBody = 'Gas Giant'; satOrbit = 'U'; isTidallyLocked = true; }
    else if (wtFlux === -2) { worldType = 'Close Satellite'; parentBody = 'Planet'; satOrbit = 'T'; isTidallyLocked = true; }
    else if (wtFlux === -1) { worldType = 'Close Satellite'; parentBody = 'Planet'; satOrbit = 'S'; isTidallyLocked = true; }
    else if (wtFlux >= 0 && wtFlux <= 2) { worldType = 'Planet'; }
    else if (wtFlux === 3) { worldType = 'Close Satellite'; parentBody = 'Planet'; satOrbit = 'R'; isTidallyLocked = true; }
    else if (wtFlux === 4) { worldType = 'Close Satellite'; parentBody = 'Planet'; satOrbit = 'Q'; isTidallyLocked = true; }
    else if (wtFlux === 5) { worldType = 'Close Satellite'; parentBody = 'Planet'; satOrbit = 'P'; isTidallyLocked = true; }
    else if (wtFlux >= 6) { worldType = 'Far Satellite'; parentBody = 'Planet'; satOrbit = 'N'; }

    tResult('World Type', worldType);
    if (parentBody) tResult('Parent Body', parentBody);
    if (satOrbit) {
        tResult('Satellite Orbit (Alpha)', satOrbit);
        if (isTidallyLocked) tResult('Tidal Lock', 'Yes (Close Satellite)');
    }

    return { worldType, parentBody, satOrbit, isTidallyLocked };
}

/**
 * T5 SYSTEM POST-GENERATION AUDIT
 * Scans the final system data for compliance with Tables 1A, 2A, and 2B.
 */
function runT5SystemAudit(sys) {
    tSection('T5 System Post-Generation Audit');
    let totalErrors = 0;

    const primary = sys.stars && sys.stars[0];
    const mw = sys.worlds && sys.worlds.find(w => w.type === 'Mainworld');

    // 1. Stellar Constraint Audit (Table 2A)
    if (primary) {
        let { type, decimal, size } = primary;
        let sErr = false;
        if (size === 'IV' && ((type === 'K' && decimal >= 5) || type === 'M')) {
            writeLogLine(`  [FAIL] Stellar: ${type}${decimal} cannot be Size IV.`);
            sErr = true; totalErrors++;
        }
        if (size === 'VI' && (type === 'A' || (type === 'F' && decimal <= 4))) {
            writeLogLine(`  [FAIL] Stellar: ${type}${decimal} cannot be Size VI.`);
            sErr = true; totalErrors++;
        }
        if (!sErr) writeLogLine(`  [PASS] Stellar: ${type}${decimal} ${size} is a valid T5 constraint combination.`);
    }

    // 2. Mainworld Bases & Climate Audit (Tables 1A & 2B)
    if (mw) {
        let sp = mw.starport;
        let bErr = false;
        if (mw.navalBase && !['A', 'B'].includes(sp)) {
            writeLogLine(`  [FAIL] Bases: Starport ${sp} cannot support a Naval Base.`);
            bErr = true; totalErrors++;
        }
        if (mw.scoutBase && !['A', 'B', 'C', 'D'].includes(sp)) {
            writeLogLine(`  [FAIL] Bases: Starport ${sp} cannot support a Scout Base.`);
            bErr = true; totalErrors++;
        }
        if ((mw.navalDepot || mw.wayStation) && sp !== 'A') {
            writeLogLine(`  [FAIL] Special Bases: Depot/Way Station requires Starport A (Found ${sp}).`);
            bErr = true; totalErrors++;
        }
        if (!bErr) writeLogLine(`  [PASS] Bases: Valid base distribution for Starport ${sp}.`);

        let climate = mw.climateZone || '';
        let tCodes = mw.tradeCodes || [];
        let cErr = false;
        if (climate.includes('Hot') && !tCodes.includes('Tr')) { 
            writeLogLine(`  [FAIL] Climate: Hot world missing 'Tr' trade code.`); 
            cErr = true; totalErrors++; 
        }
        if (climate.includes('Cold') && !tCodes.includes('Tu')) { 
            writeLogLine(`  [FAIL] Climate: Cold world missing 'Tu' trade code.`); 
            cErr = true; totalErrors++; 
        }
        if (climate.includes('Frozen') && !tCodes.includes('Fr')) { 
            writeLogLine(`  [FAIL] Climate: Frozen world missing 'Fr' trade code.`); 
            cErr = true; totalErrors++; 
        }
        if (!cErr) writeLogLine(`  [PASS] Climate: Trade codes match climate zone (${climate || 'Temperate/None'}).`);
    }

    tResult('T5 Audit Summary', totalErrors === 0 ? 'ALL CHECKS PASSED' : `${totalErrors} ERRORS FOUND`);
}