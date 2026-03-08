// =====================================================================
// TRAVELLER 5 (T5) GENERATION ENGINE
// =====================================================================

// --- T5 HELPERS ---
function rollFlux() {
    return (Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6) + 1) - 7;
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

    if (typePart === 'BD') {
        type = 'BD'; decimal = 0; size = 'V';
    } else if (typePart === 'D' || typePart.startsWith('WD')) {
        type = 'D'; decimal = 0; size = 'D';
    }
    return { type, decimal, size };
}

function generateT5SystemChunk1(mainworldBase, existingSystem, hexId) {
    reseedForHex(hexId);
    let sys = { stars: [] };

    function generateStar(role, orbitID, importedName = null) {
        let type, decimal, size;

        tSection(`Generating ${role} Star`);

        if (importedName) {
            tResult('Imported Stellar', importedName);
            const parsed = parseT5Stellar(importedName);
            type = parsed.type;
            decimal = parsed.decimal;
            size = parsed.size;
        } else {
            // Classification Logic: Spectral Class
            let f = rollFlux();
            type = 'G';
            if (f <= -6) type = (rng() < 0.5) ? 'O' : 'B';
            else if (f <= -4) type = 'A';
            else if (f <= -2) type = 'F';
            else if (f <= 0) type = 'G';
            else if (f <= 2) type = 'K';
            else if (f <= 5) type = 'M';
            else type = 'BD';

            writeLogLine(`Spectral Class Flux: ${f >= 0 ? '+' : ''}${f} -> ${type}`);

            decimal = Math.floor(rng() * 10);
            tResult('Spectral Decimal', decimal);

            // Classification Logic: Size
            let sf = rollFlux();
            size = 'V';
            if (sf <= -5) size = 'Ia';
            else if (sf === -4) size = 'Ib';
            else if (sf === -3) size = 'II';
            else if (sf === -2) size = 'III';
            else if (sf === -1) size = 'IV';
            else if (sf === 0) size = 'V';
            else if (sf === 1) size = 'VI';
            else size = 'D';

            writeLogLine(`Size Flux: ${sf >= 0 ? '+' : ''}${sf} -> ${size}`);

            // Size Constraints
            if (size === 'IV' && ((type === 'K' && decimal >= 5) || type === 'M' || type === 'BD')) {
                size = 'V';
                tOverride('Size restricted (IV -> V)', size);
            }
            if (size === 'VI' && (type === 'O' || type === 'B' || type === 'A' || (type === 'F' && decimal <= 4))) {
                size = 'V';
                tOverride('Size restricted (VI -> V)', size);
            }
        }

        // Mass/Lum Approximate (T5)
        const TYPE_MAP = { 'O': 50, 'B': 10, 'A': 2, 'F': 1.5, 'G': 1.0, 'K': 0.7, 'M': 0.2, 'BD': 0.05, 'D': 1.0 };
        let mass = TYPE_MAP[type] || 1.0;
        let luminosity = Math.pow(mass, 3.5);

        tResult('Mass', mass.toFixed(2) + ' M_Sol');
        tResult('Luminosity', luminosity.toFixed(3) + ' L_Sol');

        let starName = (size === 'D' || type === 'BD') ? `${type} ${size}` : `${type}${decimal} ${size}`;
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
            name: starName
        };
    }

    // Stellar Presence Logic
    const importedStars = existingSystem && existingSystem.stars ? existingSystem.stars : null;

    if (importedStars && importedStars.length > 0) {
        // Use imported constellation
        sys.stars.push(generateStar('Primary', 0, importedStars[0].name));

        if (importedStars.length > 1) {
            sys.stars.push(generateStar('Primary Companion', 0, importedStars[1].name));
        }
        if (importedStars.length > 2) {
            sys.stars.push(generateStar('Close', Math.floor(rng() * 6), importedStars[2].name));
        }
        if (importedStars.length > 3) {
            sys.stars.push(generateStar('Near', 5 + (Math.floor(rng() * 6) + 1), importedStars[3].name));
        }
        if (importedStars.length > 4) {
            sys.stars.push(generateStar('Far', 11 + (Math.floor(rng() * 6) + 1), importedStars[4].name));
        }
    } else {
        // Standard Flux Logic (No import found)
        sys.stars.push(generateStar('Primary', 0));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Primary Companion', 0));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Close', Math.floor(rng() * 6)));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Near', 5 + (Math.floor(rng() * 6) + 1)));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Far', 11 + (Math.floor(rng() * 6) + 1)));

        let currentStars = [...sys.stars];
        currentStars.forEach((s, idx) => {
            if (idx === 0) return;
            if (rollFlux() >= 3) {
                sys.stars.push(generateStar('Secondary Companion', s.orbitID));
            }
        });
    }

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
    let mwOrbit = hzOrbit;
    while (mwOrbit < 20 && (sys.orbits[mwOrbit].blocked || sys.orbits[mwOrbit].contents)) {
        mwOrbit++;
    }
    if (mwOrbit >= 20) {
        mwOrbit = hzOrbit;
        while (mwOrbit >= 0 && (sys.orbits[mwOrbit].blocked || sys.orbits[mwOrbit].contents)) {
            mwOrbit--;
        }
    }
    if (mwOrbit >= 0 && mwOrbit < 20) {
        sys.orbits[mwOrbit].contents = { ...mainworldBase, type: 'Mainworld' };
        tResult('Mainworld Placement', `Orbit ${mwOrbit}`);
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

    return sys;
}

function generateT5Mainworld(hexId) {
    if (hexId) {
        reseedForHex(hexId);
        tSection(`T5 Mainworld Generation: Hex ${hexId}`);
    } else {
        tSection(`T5 Mainworld Generation`);
    }

    let spRoll = tRoll2D('Starport Roll');
    let starport = 'X';
    if (spRoll === 2) starport = 'A';
    else if (spRoll <= 5) starport = 'B';
    else if (spRoll <= 8) starport = 'C';
    else if (spRoll === 9) starport = 'D';
    else if (spRoll <= 11) starport = 'E';
    else starport = 'X';
    tResult('Final Starport', starport);

    let sRoll = tRoll2D('Size Roll (Standard)') - 2;
    if (sRoll === 10) {
        sRoll = tRoll1D('Size Roll (10 variant)') + 9;
        tOverride('Extended Size Roll', sRoll);
    }
    let size = Math.max(0, sRoll);
    tResult('Final Size', size);

    let atm = 0;
    if (size > 0) {
        let atmFlux = rollFlux();
        atm = Math.min(15, Math.max(0, atmFlux + size));
        writeLogLine(`Atmosphere Roll: Size(${size}) + Flux(${atmFlux >= 0 ? '+' : ''}${atmFlux}) = ${atm}`);
    }
    tResult('Final Atmosphere', toUWPChar(atm));

    let hydro = 0;
    if (size > 1) {
        let hFlux = rollFlux();
        let hydroDM = (atm <= 1 || atm >= 10) ? -4 : 0;
        if (hydroDM !== 0) tDM('Hydro DM (Atm)', hydroDM);
        hydro = Math.min(10, Math.max(0, hFlux + atm + hydroDM));
        writeLogLine(`Hydrographics Roll: Flux(${hFlux >= 0 ? '+' : ''}${hFlux}) + Atm(${atm}) + DM(${hydroDM}) = ${hydro}`);
    }
    tResult('Final Hydrographics', toUWPChar(hydro));

    let rawPop = tRoll2D('Population Roll (Standard)') - 2;
    if (rawPop === 10) {
        rawPop = tRoll2D('Population Roll (10 variant)') + 3;
        tOverride('Extended Population Roll', rawPop);
    }
    let pop = Math.max(0, rawPop);
    tResult('Final Population', toUWPChar(pop));

    let popDigit = pop > 0 ? Math.floor(rng() * 10) : 0;
    tResult('Pop Multiplier', popDigit);

    let govFlux = rollFlux();
    let gov = Math.min(15, Math.max(0, govFlux + pop));
    writeLogLine(`Government Roll: Pop(${pop}) + Flux(${govFlux >= 0 ? '+' : ''}${govFlux}) = ${gov}`);
    tResult('Final Government', toUWPChar(gov));

    let lawFlux = rollFlux();
    let law = Math.min(15, Math.max(0, lawFlux + gov));
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
    if (starport === 'A') {
        if (tRoll2D('Naval Base Check') <= 6 && pop >= 7) navalBase = true;
        if (tRoll2D('Scout Base Check') <= 4) scoutBase = true;
    } else if (starport === 'B') {
        if (tRoll2D('Naval Base Check') <= 5 && pop >= 8) navalBase = true;
        let sRoll = tRoll2D('Scout Base Check');
        if (sRoll === 5 || sRoll === 6) scoutBase = true;
    } else if (starport === 'C') {
        let sRoll = tRoll2D('Scout Check');
        if (sRoll >= 6 && sRoll <= 8) scoutBase = true;
    } else if (starport === 'D') {
        if (tRoll2D('Scout Check') <= 7) scoutBase = true;
    }
    if (navalBase) tResult('Bases', 'Naval');
    if (scoutBase) tResult('Bases', 'Scout');

    let rawGG = tRoll2D('GG Inventory Roll');
    let gasGiantsCount = Math.max(0, Math.floor(rawGG / 2) - 2);
    tResult('Gas Giants Count', gasGiantsCount);

    let rawBelts = tRoll1D('Belt Inventory Roll');
    let planetoidBelts = Math.max(0, rawBelts - 3);
    tResult('Planetoid Belts Count', planetoidBelts);

    let gasGiant = gasGiantsCount > 0;

    // Apply Clamping
    size = clampUWP(size, 0, 15);
    atm = clampUWP(atm, 0, 15);
    hydro = clampUWP(hydro, 0, 10);
    pop = clampUWP(pop, 0, 15);
    gov = clampUWP(gov, 0, 15);
    law = clampUWP(law, 0, 15);
    tl = clampUWP(tl, 0, 33);

    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;
    tResult('Final UWP', uwp);

    let tradeCodes = [];
    if (size === 0 && atm === 0 && hydro === 0) tradeCodes.push("As");
    if (atm >= 2 && atm <= 9 && hydro === 0) tradeCodes.push("De");
    if (atm >= 10 && atm <= 12 && hydro >= 1 && hydro <= 10) tradeCodes.push("Fl");
    if (size >= 6 && size <= 8 && [5, 6, 8].includes(atm) && hydro >= 5 && hydro <= 7) tradeCodes.push("Ga");
    if (size >= 3 && [2, 4, 7, 9, 10, 11, 12].includes(atm) && hydro <= 2) tradeCodes.push("He");
    if (atm <= 1 && hydro >= 1 && hydro <= 10) tradeCodes.push("Ic");
    if (size >= 10 && atm >= 3 && hydro === 10) tradeCodes.push("Oc");
    if (atm === 0) tradeCodes.push("Va");
    if (size >= 3 && size <= 9 && atm >= 3 && hydro === 10) tradeCodes.push("Wa");

    if (pop === 0 && gov === 0 && law === 0) { tradeCodes.push("Di"); tradeCodes.push("Ba"); }
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

    // --- TRAVEL ZONE & OPPRESSION SCORE (T5 Logic) ---
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
    tResult('Travel Zone', travelZone);

    return { name: getNextSystemName(hexId), uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, popDigit, gov, law, tl, navalBase, scoutBase, gasGiant, gasGiantsCount, planetoidBelts };
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
    writeLogLine(`Efficiency Roll: Flux (${E >= 0 ? '+' : ''}${E})`);
    tResult('Efficiency (E)', E >= 0 ? `+${E}` : E);

    // 3. Resource Units (RU)
    tSection('Resource Units (RU)');
    let calcR = R === 0 ? 1 : R;
    let calcL = L === 0 ? 1 : L;
    let calcI = I === 0 ? 1 : I;
    let calcE = E === 0 ? 1 : E;
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

    let spFlux = rollFlux();
    let spectralType = '';
    if (spFlux <= -6) {
        spectralType = (roll1D() <= 3) ? 'O' : 'B';
    } else if (spFlux <= -4) {
        spectralType = 'A';
    } else if (spFlux <= -2) {
        spectralType = 'F';
    } else if (spFlux <= 0) {
        spectralType = 'G';
    } else if (spFlux <= 2) {
        spectralType = 'K';
    } else if (spFlux <= 5) {
        spectralType = 'M';
    } else {
        spectralType = 'BD';
    }

    if (spectralType === 'BD') {
        let homestar = 'BD Y';
        let hzResult = generateHZAndClimate();
        let wtResult = generateWorldType(base);
        return {
            homestar,
            hzVariance: hzResult.hzVariance,
            climate: hzResult.climate,
            worldType: wtResult.worldType,
            parentBody: wtResult.parentBody,
            satOrbit: wtResult.satOrbit,
            displayString: `${homestar} | HZ:${hzResult.hzVariance} ${hzResult.climate} | ${wtResult.worldType}${wtResult.parentBody ? ' (' + wtResult.parentBody + ')' : ''}${wtResult.satOrbit ? ' Orbit: ' + wtResult.satOrbit : ''}`
        };
    }

    let spectralDecimal = Math.floor(rng() * 10);

    let sizeFlux = rollFlux();
    let stellarSize = 'V';
    let isOB = (spectralType === 'O' || spectralType === 'B');
    let isA = (spectralType === 'A');
    let isFGK = (spectralType === 'F' || spectralType === 'G' || spectralType === 'K');
    let isM = (spectralType === 'M');

    if (sizeFlux <= -5) {
        stellarSize = (isOB || isA) ? 'Ia' : 'II';
    } else if (sizeFlux === -4) {
        if (isOB || isA) stellarSize = 'Ib';
        else if (isFGK) stellarSize = 'III';
        else if (isM) stellarSize = 'II';
    } else if (sizeFlux === -3) {
        if (isOB || isA) stellarSize = 'II';
        else if (isFGK) stellarSize = 'IV';
        else if (isM) stellarSize = 'II';
    } else if (sizeFlux === -2) {
        if (isOB || isA || isM) stellarSize = 'III';
        else if (isFGK) stellarSize = 'V';
    } else if (sizeFlux === -1) {
        if (isOB) stellarSize = 'III';
        else if (isA) stellarSize = 'IV';
        else stellarSize = 'V';
    } else if (sizeFlux === 0) {
        if (isOB) stellarSize = 'III';
        else stellarSize = 'V';
    } else if (sizeFlux === 1) {
        if (spectralType === 'B') stellarSize = 'III';
        else stellarSize = 'V';
    } else if (sizeFlux <= 3) {
        stellarSize = 'V';
    } else if (sizeFlux === 4) {
        if (isOB) stellarSize = 'IV';
        else if (isA) stellarSize = 'V';
        else stellarSize = 'VI';
    } else if (sizeFlux === 5) {
        stellarSize = 'D';
    } else {
        if (isOB) stellarSize = 'IV';
        else if (isA) stellarSize = 'V';
        else stellarSize = 'VI';
    }

    if (stellarSize === 'IV') {
        if ((spectralType === 'K' && spectralDecimal >= 5) || spectralType === 'M') {
            stellarSize = 'V';
        }
    }
    if (stellarSize === 'VI') {
        if (spectralType === 'A' || (spectralType === 'F' && spectralDecimal <= 4)) {
            stellarSize = 'V';
        }
    }

    let homestar = '';
    if (stellarSize === 'D') {
        homestar = `${spectralType} D`;
    } else {
        homestar = `${spectralType}${spectralDecimal} ${stellarSize}`;
    }

    let hzResult = generateHZAndClimate();
    let wtResult = generateWorldType(base);

    return {
        homestar,
        hzVariance: hzResult.hzVariance,
        climate: hzResult.climate,
        worldType: wtResult.worldType,
        parentBody: wtResult.parentBody,
        satOrbit: wtResult.satOrbit,
        displayString: `${homestar} | HZ:${hzResult.hzVariance} ${hzResult.climate} | ${wtResult.worldType}${wtResult.parentBody ? ' (' + wtResult.parentBody + ')' : ''}${wtResult.satOrbit ? ' Orbit: ' + wtResult.satOrbit : ''}`
    };
}

function generateHZAndClimate() {
    let hzFlux = rollFlux();
    let hzVariance = hzFlux <= -6 ? -2 : hzFlux <= -3 ? -1 : hzFlux <= 2 ? 0 : hzFlux <= 5 ? 1 : 2;
    let climate = hzVariance <= -1 ? 'Hot. Tropic. (Tr)' : hzVariance === 0 ? 'Temperate.' : hzVariance === 1 ? 'Cold. Tundra. (Tu)' : 'Frozen. (Fr)';
    return { hzVariance, climate };
}

function generateWorldType(base) {
    let wtFlux = rollFlux();
    let worldType = wtFlux <= -4 ? 'Far Satellite' : wtFlux === -3 ? 'Close Satellite' : 'Planet';
    if (worldType === 'Planet') return { worldType, parentBody: null, satOrbit: null };

    let parentBody = (base?.gasGiant === false) ? 'Planet' : (rollFlux() <= 0 ? 'Gas Giant' : 'Planet');
    let soFlux = rollFlux();
    let orbits = worldType === 'Close Satellite'
        ? ['Ay', 'Bee', 'Cee', 'Dee', 'Ee', 'Eff', 'Gee', 'Aitch', 'Eye', 'Jay', 'Kay', 'Ell', 'Em']
        : ['En', 'Oh', 'Pee', 'Que', 'Arr', 'Ess', 'Tee', 'Yu', 'Vee', 'Dub', 'Ex', 'Wye', 'Zee'];
    return { worldType, parentBody, satOrbit: orbits[soFlux + 6] || 'Gee' };
}