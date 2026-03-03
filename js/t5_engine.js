// =====================================================================
// TRAVELLER 5 (T5) GENERATION ENGINE
// =====================================================================

// --- T5 HELPERS ---
function rollFlux() {
    return (Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1) - 7;
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

function generateT5SystemChunk1(mainworldBase, existingSystem) {
    let sys = { stars: [] };

    function generateStar(role, orbitID, importedName = null) {
        let type, decimal, size;

        if (importedName) {
            const parsed = parseT5Stellar(importedName);
            type = parsed.type;
            decimal = parsed.decimal;
            size = parsed.size;
        } else {
            // Classification Logic: Spectral Class
            let f = rollFlux();
            type = 'G';
            if (f <= -6) type = (Math.random() < 0.5) ? 'O' : 'B';
            else if (f <= -4) type = 'A';
            else if (f <= -2) type = 'F';
            else if (f <= 0) type = 'G';
            else if (f <= 2) type = 'K';
            else if (f <= 5) type = 'M';
            else type = 'BD';

            decimal = Math.floor(Math.random() * 10);

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

            // Size Constraints
            if (size === 'IV' && ((type === 'K' && decimal >= 5) || type === 'M' || type === 'BD')) {
                size = 'V';
            }
            if (size === 'VI' && (type === 'O' || type === 'B' || type === 'A' || (type === 'F' && decimal <= 4))) {
                size = 'V';
            }
        }

        // Mass/Lum Approximate (T5)
        const TYPE_MAP = { 'O': 50, 'B': 10, 'A': 2, 'F': 1.5, 'G': 1.0, 'K': 0.7, 'M': 0.2, 'BD': 0.05, 'D': 1.0 };
        let mass = TYPE_MAP[type] || 1.0;
        let luminosity = Math.pow(mass, 3.5);

        return {
            type,
            size,
            decimal,
            orbitID,
            distAU: getT5OrbitAU(orbitID),
            role,
            mass,
            luminosity,
            name: (size === 'D' || type === 'BD') ? `${type} ${size}` : `${type}${decimal} ${size}`
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
            sys.stars.push(generateStar('Close', Math.floor(Math.random() * 6), importedStars[2].name));
        }
        if (importedStars.length > 3) {
            sys.stars.push(generateStar('Near', 5 + (Math.floor(Math.random() * 6) + 1), importedStars[3].name));
        }
        if (importedStars.length > 4) {
            sys.stars.push(generateStar('Far', 11 + (Math.floor(Math.random() * 6) + 1), importedStars[4].name));
        }
    } else {
        // Standard Flux Logic (No import found)
        sys.stars.push(generateStar('Primary', 0));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Primary Companion', 0));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Close', Math.floor(Math.random() * 6)));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Near', 5 + (Math.floor(Math.random() * 6) + 1)));
        if (rollFlux() >= 3) sys.stars.push(generateStar('Far', 11 + (Math.floor(Math.random() * 6) + 1)));

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

    // --- STEP 5A: INVENTORY ---
    let ggCount = Math.max(0, Math.floor(roll2D() / 2) - 2);
    if (mainworldBase.gasGiant && ggCount === 0) ggCount = 1;

    let beltCount = Math.max(0, roll1D() - 3);
    if (mainworldBase.size === 0 && beltCount === 0) beltCount = 1;

    let worldCount = roll2D();

    // --- STEP 4: PRECLUSION & SLOTS ---
    sys.orbits = [];
    for (let i = 0; i < 20; i++) {
        sys.orbits.push({ orbit: i, distAU: getT5OrbitAU(i), contents: null });
    }

    // Mark Star Orbits as Blocked
    sys.stars.forEach(star => {
        if (star.orbitID !== null) {
            let slot = sys.orbits.find(o => o.orbit === star.orbitID);
            if (slot) slot.blocked = true;
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
    }

    // 3. Place Gas Giants (Outside HZ preferred)
    for (let i = 0; i < ggCount; i++) {
        let targets = sys.orbits.filter(o => !o.blocked && !o.contents && o.orbit > hzOrbit);
        if (targets.length === 0) targets = sys.orbits.filter(o => !o.blocked && !o.contents);
        if (targets.length > 0) {
            let slot = targets[Math.floor(Math.random() * targets.length)];
            slot.contents = { type: 'Gas Giant', size: (roll1D() <= 3 ? 'Large' : 'Small') };
        }
    }

    // 4. Place Belts
    for (let i = 0; i < beltCount; i++) {
        let targets = sys.orbits.filter(o => !o.blocked && !o.contents);
        if (targets.length > 0) {
            let slot = targets[Math.floor(Math.random() * targets.length)];
            slot.contents = { type: 'Planetoid Belt' };
        }
    }

    // 5. Place Other Worlds
    for (let i = 0; i < worldCount; i++) {
        let targets = sys.orbits.filter(o => !o.blocked && !o.contents);
        if (targets.length > 0) {
            let slot = targets[Math.floor(Math.random() * targets.length)];
            slot.contents = { type: 'Terrestrial World' };
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

function generateT5SystemChunk3(sys) {
    if (!sys || !sys.orbits) return sys;

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

        // Size & Diameter
        if (w.type === 'Terrestrial World') {
            let sRoll = roll2D() - 2;
            if (sRoll === 10) sRoll = roll1D() + 9;
            w.size = Math.max(0, sRoll);
        }

        if (w.size !== undefined) {
            let sizeVal = (w.size === 'S' || w.size === '0' || w.size === 0) ? 0.3 : w.size;
            w.diamKm = (w.size === 0 || w.size === 'S') ? 500 : w.size * 1600;

            // Density & Gravity
            let dRoll = roll1D();
            w.density = dRoll <= 2 ? 0.8 : (dRoll <= 5 ? 1.0 : 1.2);
            w.gravity = parseFloat((w.density * (sizeVal / 8)).toFixed(2));

            // Mass
            w.mass = parseFloat((w.gravity * Math.pow(sizeVal / 8, 2)).toFixed(3));
        }

        // Climate & Temperature
        let diff = o.orbit - hzOrbit;
        if (diff < 0) {
            w.climateZone = 'Hot';
            w.temperature = 350 + (rollFlux() * 10);
        } else if (diff === 0) {
            w.climateZone = 'Temperate';
            w.temperature = 288 + (rollFlux() * 10);
        } else if (diff === 1) {
            w.climateZone = 'Cold';
            w.temperature = 230 + (rollFlux() * 10);
        } else {
            w.climateZone = 'Frozen';
            w.temperature = 100 + (rollFlux() * 5);
        }

        // Rotation & Day Length
        if (o.orbit <= 1) {
            w.rotationPeriod = 'Tidally Locked';
        } else {
            let rRoll = roll1D();
            if (rRoll <= 2) w.rotationPeriod = (4 + roll1D()) + ' hours';
            else if (rRoll <= 5) w.rotationPeriod = (12 + roll2D()) + ' hours';
            else w.rotationPeriod = (36 + roll2D() * 2) + ' hours';
        }

        // Orbital Period (Year Length)
        let starMass = sys.stars[0].mass || 1.0;
        w.orbitalPeriod = Math.sqrt(Math.pow(o.distAU, 3) / starMass);

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
            if (w.type === 'Gas Giant') moonCount = roll2D() - 2;
            else moonCount = Math.max(0, roll1D() - 3);

            w.satellites = [];
            for (let i = 0; i < moonCount; i++) {
                let m = { type: 'Moon' };
                m.size = Math.max(0, roll1D() - 1);
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

function generateT5Mainworld() {
    let spRoll = roll2D();
    let starport = 'X';
    if (spRoll === 2) starport = 'A';
    else if (spRoll <= 5) starport = 'B';
    else if (spRoll <= 8) starport = 'C';
    else if (spRoll === 9) starport = 'D';
    else if (spRoll <= 11) starport = 'E';
    else starport = 'X';

    let size = roll2D() - 2;
    if (size === 10) size = roll1D() + 9;
    size = Math.max(0, size);

    let atm = 0;
    if (size > 0) atm = Math.min(15, Math.max(0, rollFlux() + size));

    let hydro = 0;
    if (size > 1) {
        let hydroDM = (atm <= 1 || atm >= 10) ? -4 : 0;
        hydro = Math.min(10, Math.max(0, rollFlux() + atm + hydroDM));
    }

    let pop = roll2D() - 2;
    if (pop === 10) pop = roll2D() + 3;
    pop = Math.max(0, pop);

    let popDigit = pop > 0 ? Math.floor(Math.random() * 9) + 1 : 0;

    let gov = Math.min(15, Math.max(0, rollFlux() + pop));

    let law = Math.max(0, rollFlux() + gov);

    let tlDM = 0;
    if (starport === 'A') tlDM += 6;
    else if (starport === 'B') tlDM += 4;
    else if (starport === 'C') tlDM += 2;
    else if (starport === 'X') tlDM -= 4;

    if (size <= 1) tlDM += 2;
    else if (size <= 4) tlDM += 1;

    if (atm <= 3 || (atm >= 10 && atm <= 15)) tlDM += 1;

    if (hydro === 9) tlDM += 1;
    else if (hydro === 10) tlDM += 2;

    if (pop >= 1 && pop <= 5) tlDM += 1;
    else if (pop === 9) tlDM += 2;
    else if (pop >= 10) tlDM += 4;

    if (gov === 0 || gov === 5) tlDM += 1;
    else if (gov === 13) tlDM -= 2;

    let tl = Math.max(0, roll1D() + tlDM);

    let navalBase = false;
    let scoutBase = false;
    if (starport === 'A') {
        if (roll2D() <= 6 && pop >= 7) navalBase = true;
        if (roll2D() <= 4) scoutBase = true;
    } else if (starport === 'B') {
        if (roll2D() <= 5 && pop >= 8) navalBase = true;
        let sRoll = roll2D();
        if (sRoll === 5 || sRoll === 6) scoutBase = true;
    } else if (starport === 'C') {
        let sRoll = roll2D();
        if (sRoll >= 6 && sRoll <= 8) scoutBase = true;
    } else if (starport === 'D') {
        if (roll2D() <= 7) scoutBase = true;
    }

    let gasGiantsCount = Math.max(0, Math.floor(roll2D() / 2) - 2);
    let planetoidBelts = Math.max(0, roll1D() - 3);
    let gasGiant = gasGiantsCount > 0;

    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;

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

    return { name: getNextSystemName(), uwp, tradeCodes, starport, size, atm, hydro, pop, popDigit, gov, law, tl, navalBase, scoutBase, gasGiant, gasGiantsCount, planetoidBelts };
}

function generateT5Socioeconomics(base) {
    if (!base) return null;

    // 1. Importance (Ix)
    let Ix = 0;
    if (['A', 'B'].includes(base.starport)) Ix += 1;
    if (['D', 'E', 'X'].includes(base.starport)) Ix -= 1;

    if (base.tl >= 16) Ix += 1;
    if (base.tl >= 10) Ix += 1;
    if (base.tl <= 8) Ix -= 1;

    if (base.tradeCodes) {
        if (base.tradeCodes.includes("Ag")) Ix += 1;
        if (base.tradeCodes.includes("Hi")) Ix += 1;
        if (base.tradeCodes.includes("In")) Ix += 1;
        if (base.tradeCodes.includes("Ri")) Ix += 1;
    }

    if (base.pop <= 6) Ix -= 1;
    if (base.navalBase && base.scoutBase) Ix += 1;

    // 2. Economic (Ex)
    let R = roll2D();
    if (base.tl >= 8) R += (base.gasGiantsCount || 0) + (base.planetoidBelts || 0);
    R = Math.max(0, R);

    let L = Math.max(0, base.pop - 1);

    let I = 0;
    if (base.pop > 0) {
        if (base.pop <= 3) I = Ix;
        else if (base.pop <= 6) I = roll1D() + Ix;
        else I = roll2D() + Ix;
    }
    I = Math.max(0, I);

    let E = rollFlux();

    // 3. Resource Units (RU)
    let calcR = R === 0 ? 1 : R;
    let calcL = L === 0 ? 1 : L;
    let calcI = I === 0 ? 1 : I;
    let calcE = E === 0 ? 1 : E;
    let RU = calcR * calcL * calcI * calcE;

    // 4. Cultural (Cx)
    let H = 0, A = 0, S = 0, Sym = 0;
    if (base.pop > 0) {
        H = Math.max(1, base.pop + rollFlux());
        A = Math.max(1, base.pop + Ix);
        S = Math.max(1, rollFlux() + 5);
        Sym = Math.max(1, rollFlux() + base.tl);
    }

    let ixStr = `{${Ix >= 0 ? '+' : ''}${Ix}}`;
    let exStr = `(${toUWPChar(R)}${toUWPChar(L)}${toUWPChar(I)}${E >= 0 ? '+' : ''}${E})`;
    let cxStr = `[${toUWPChar(H)}${toUWPChar(A)}${toUWPChar(S)}${toUWPChar(Sym)}]`;

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

function generateHZAndClimate() {
    let hzFlux = rollFlux();
    let hzVariance = 0;
    if (hzFlux <= -6) hzVariance = -2;
    else if (hzFlux <= -3) hzVariance = -1;
    else if (hzFlux <= 2) hzVariance = 0;
    else if (hzFlux <= 5) hzVariance = 1;
    else hzVariance = 2;

    let climate = '';
    if (hzVariance <= -1) climate = 'Hot. Tropic. (Tr)';
    else if (hzVariance === 0) climate = 'Temperate.';
    else if (hzVariance === 1) climate = 'Cold. Tundra. (Tu)';
    else climate = 'Frozen. (Fr)';

    return { hzVariance, climate };
}

function generateWorldType(base) {
    let wtFlux = rollFlux();
    let worldType = 'Planet';
    if (wtFlux <= -4) worldType = 'Far Satellite';
    else if (wtFlux === -3) worldType = 'Close Satellite';

    if (worldType === 'Planet') {
        return { worldType, parentBody: null, satOrbit: null };
    }

    let parentBody = 'Planet';
    let hasGasGiants = true;
    if (base && base.gasGiant === false) {
        hasGasGiants = false;
    }
    if (hasGasGiants) {
        let pbFlux = rollFlux();
        parentBody = (pbFlux <= 0) ? 'Gas Giant' : 'Planet';
    }

    let soFlux = rollFlux();
    let satOrbit = '';
    if (worldType === 'Close Satellite') {
        const closeOrbits = ['Ay', 'Bee', 'Cee', 'Dee', 'Ee', 'Eff', 'Gee', 'Aitch', 'Eye', 'Jay', 'Kay', 'Ell', 'Em'];
        satOrbit = closeOrbits[soFlux + 6] || 'Gee';
    } else {
        const farOrbits = ['En', 'Oh', 'Pee', 'Que', 'Arr', 'Ess', 'Tee', 'Yu', 'Vee', 'Dub', 'Ex', 'Wye', 'Zee'];
        satOrbit = farOrbits[soFlux + 6] || 'Tee';
    }

    return { worldType, parentBody, satOrbit };
}

function generateT5Physical(base) {
    if (!base) return null;

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

    let spectralDecimal = Math.floor(Math.random() * 10);

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