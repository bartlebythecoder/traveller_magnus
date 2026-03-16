// =====================================================================
// CLASSIC TRAVELLER: MODULAR TOP-DOWN GENERATOR
// =====================================================================

// Browser-safe imports
var orbitalAU, luminosityTable, starMassTable, zoneTables, natureTable, priTypeTable, priSizeTable, compTypeTable, compSizeTable, satOrbitsTable;
var physicalGen, popGen, mainworldSocialFin, subordinateSocialFin, tradeCodesGen;
var thermalStatsGetter, rotationStatsGetter, satelliteGenerator, systemWalker;

if (typeof module !== 'undefined' && module.exports) {
    const constants = require('./ct_constants');
    orbitalAU = constants.ORBIT_AU;
    luminosityTable = constants.LUM;
    starMassTable = constants.STAR_MASS;
    natureTable = constants.CT_BASIC_NATURE_TABLE;
    priTypeTable = constants.CT_PRI_TYPE_TABLE;
    priSizeTable = constants.CT_PRI_SIZE_TABLE;
    compTypeTable = constants.CT_COMP_TYPE_TABLE;
    compSizeTable = constants.CT_COMP_SIZE_TABLE;
    zoneTables = constants.ZONE_TABLES;
    satOrbitsTable = constants.SATELLITE_ORBITS;

    const worldEngine = require('./ct_world_engine.js');
    physicalGen = worldEngine.generatePhysicals;
    popGen = worldEngine.generatePopulation;
    mainworldSocialFin = worldEngine.finalizeMainworldSocial;
    subordinateSocialFin = worldEngine.finalizeSubordinateSocial;
    tradeCodesGen = worldEngine.generateTradeCodes;

    const bottomUp = require('./ct_bottomup_generator.js');
    systemWalker = bottomUp.walkSystem;

    const physLib = require('./ct_physical_library.js');
    thermalStatsGetter = physLib.getThermalStats;
    rotationStatsGetter = physLib.getRotationStats;
    satelliteGenerator = physLib.generateSatellites;
} else {
    // In browser, these are globals or on window namespaces
    orbitalAU = typeof ORBIT_AU !== 'undefined' ? ORBIT_AU : [];
    luminosityTable = typeof LUM !== 'undefined' ? LUM : {};
    starMassTable = typeof STAR_MASS !== 'undefined' ? STAR_MASS : {};
    natureTable = typeof CT_BASIC_NATURE_TABLE !== 'undefined' ? CT_BASIC_NATURE_TABLE : [];
    priTypeTable = typeof CT_PRI_TYPE_TABLE !== 'undefined' ? CT_PRI_TYPE_TABLE : [];
    priSizeTable = typeof CT_PRI_SIZE_TABLE !== 'undefined' ? CT_PRI_SIZE_TABLE : [];
    compTypeTable = typeof CT_COMP_TYPE_TABLE !== 'undefined' ? CT_COMP_TYPE_TABLE : [];
    compSizeTable = typeof CT_COMP_SIZE_TABLE !== 'undefined' ? CT_COMP_SIZE_TABLE : [];
    zoneTables = typeof ZONE_TABLES !== 'undefined' ? ZONE_TABLES : {};
    satOrbitsTable = typeof SATELLITE_ORBITS !== 'undefined' ? SATELLITE_ORBITS : {};

    physicalGen = (window.CT_World_Engine) ? window.CT_World_Engine.generatePhysicals : null;
    popGen = (window.CT_World_Engine) ? window.CT_World_Engine.generatePopulation : null;
    mainworldSocialFin = (window.CT_World_Engine) ? window.CT_World_Engine.finalizeMainworldSocial : null;
    subordinateSocialFin = (window.CT_World_Engine) ? window.CT_World_Engine.finalizeSubordinateSocial : null;
    tradeCodesGen = (window.CT_World_Engine) ? window.CT_World_Engine.generateTradeCodes : null;

    systemWalker = typeof walkSystem !== 'undefined' ? walkSystem : null;

    thermalStatsGetter = typeof getThermalStats !== 'undefined' ? getThermalStats : null;
    rotationStatsGetter = typeof getRotationStats !== 'undefined' ? getRotationStats : null;
    satelliteGenerator = typeof generateSatellites !== 'undefined' ? generateSatellites : null;
}

/**
 * TOP-DOWN GENERATION
 * Starts with a pre-defined Mainworld and builds a system around it.
 * Placement Order: GGs -> Belts -> Anomalies -> Mainworld
 */
function generateTopDownSystem(mainworldUWP, primaryStar = null) {
    // 1. Determine/Roll Primary Star that supports life
    tSection('Primary Star Generation');
    if (!primaryStar) {
        let attempts = 0;
        while (!primaryStar && attempts < 50) {
            attempts++;
            let typeIdx = tRoll2D('Primary Type Roll');
            let sizeIdx = tRoll2D('Primary Size Roll');
            let rawType = priTypeTable[typeIdx];
            let rawSize = priSizeTable[sizeIdx];
            const decimal = (tRoll1D('Primary Decimal Roll') <= 3 ? 0 : 5);
            const specKey = rawType + decimal;
            
            const zones = (zoneTables[rawSize] && zoneTables[rawSize][specKey]);
            if (zones && zones.includes('H')) {
                primaryStar = {
                    role: 'Primary',
                    type: rawType,
                    size: rawSize,
                    decimal: decimal,
                    specKey: specKey,
                    name: `${rawType}${decimal} ${rawSize}`,
                    maxOrbits: tRoll2D('Primary Max Orbits'),
                    mass: (starMassTable[rawSize] && starMassTable[rawSize][specKey]) || 1.0,
                    luminosity: (luminosityTable[rawSize] && luminosityTable[rawSize][specKey]) || 1.0
                };
                tResult('Primary Selection', `${primaryStar.name} (${primaryStar.specKey})`);
                tResult('Star Mass', `${primaryStar.mass} M☉`);
                tResult('Star Luminosity', `${primaryStar.luminosity} L☉`);
            }
        }
    }

    if (!primaryStar) throw new Error("Could not roll a primary star with a Habitable Zone.");

    // 2. Identify the Habitable Zone (Target Orbit)
    const zones = zoneTables[primaryStar.size][primaryStar.specKey];
    const hOrbits = zones.reduce((acc, z, idx) => (z === 'H' ? acc.concat(idx) : acc), []);
    const targetOrbit = hOrbits[Math.floor(Math.random() * hOrbits.length)];
    tResult('Ideal Habitable Orbit', targetOrbit);

    const sys = {
        nature: natureTable[tRoll2D('System Nature Roll')],
        stars: [primaryStar],
        maxOrbits: Math.max(primaryStar.maxOrbits, targetOrbit),
        orbits: []
    };
    tResult('System Nature', sys.nature);
    tResult('Baseline Orbits', sys.maxOrbits);

    // 3. System-Wide Feature Counts (Initial Pass)
    // 3a. Gas Giants
    tSection('Gas Giant Presence');
    let ggCount = 0;
    if (tRoll2D('Presence Check') >= 8) {
        let ggQtyRoll = tRoll2D('Quantity Roll');
        ggCount = Math.max(1, Math.floor(ggQtyRoll / 2));
    }
    const sysGGs = [];
    for (let i = 0; i < ggCount; i++) {
        sysGGs.push({ type: 'Gas Giant', size: (tRoll1D(`GG ${i+1} Size Roll`) <= 3 ? 'Large' : 'Small') });
    }
    tResult('Gas Giants Rolled', ggCount);

    // 3b. Planetoid Belts
    tSection('Planetoid Belt Presence');
    let beltQty = 0;
    if (tRoll2D('Presence Check') <= 7) {
        let pbRoll = tRoll2D('Quantity Roll');
        if (pbRoll <= 0) beltQty = 3;
        else if (pbRoll <= 6) beltQty = 2;
        else beltQty = 1;
    }
    const totalBelts = Math.min(beltQty, sys.maxOrbits);
    tResult('Planetoid Belts Rolled', totalBelts);

    // 4. Initialize Orbits
    for (let i = 0; i <= sys.maxOrbits; i++) {
        sys.orbits.push({
            orbit: i,
            zone: zones[i] || 'O',
            contents: null
        });
    }

    // 5. PLACEMENT ORCHESTRATION (Rule Compliant Order)
    
    // Determine if Mainworld needs the HZ spot
    const mwAtm = (mainworldUWP.atm !== undefined) ? mainworldUWP.atm : 0;
    const mwSize = (mainworldUWP.size !== undefined) ? mainworldUWP.size : 0;
    const isAsteroidMW = (mwSize === 0);
    const mainworldNeedsHZ = (!isAsteroidMW && ![0, 1, 10, 11, 12, 13, 14, 15].includes(mwAtm));

    // 5a. Gas Giant Placement (First)
    sysGGs.forEach(gg => {
        let slot = sys.orbits.find(o => (o.zone === 'H' || o.zone === 'O') && !o.contents);
        if (slot) {
            slot.contents = {
                type: 'Gas Giant',
                size: gg.size,
                gravity: (gg.size === 'Large' ? 2.5 : 0.8),
                mass: (gg.size === 'Large' ? 300 : 50)
            };
        }
    });

    // 5b. Planetoid Belt Placement (Second)
    let placedBelts = 0;
    if (isAsteroidMW) {
        // Force the Mainworld into the first available belt spot later, but count it
        placedBelts = 1; 
    }
    for (let i = placedBelts; i < totalBelts; i++) {
        let slot = sys.orbits.find(o => !o.contents && o.orbit !== targetOrbit);
        if (slot) {
            slot.contents = { type: 'Planetoid Belt', size: 0, gravity: 0, temperature: 100 };
        }
    }

    // 5c. Anomaly Placement (Third)
    tSection('Empty Orbits');
    let empDM = (['B', 'A'].includes(primaryStar.type)) ? 1 : 0;
    if (empDM !== 0) tDM(`Primary Star ${primaryStar.type}`, empDM);
    if (tRoll1D('Presence Check') + empDM >= 5) {
        let qtyRoll = tRoll1D('Quantity Roll');
        let qty = [0, 1, 1, 2, 3, 3, 3][qtyRoll];
        tResult('Empty Orbits Rolled', qty);
        for (let i = 0; i < qty; i++) {
            let target = tRoll2D('Placement Slot Roll');
            let slot = sys.orbits.find(o => o.orbit === target);
            // Skip the targetOrbit if the mainworld needs it
            if (slot && !slot.contents && (!mainworldNeedsHZ || slot.orbit !== targetOrbit)) {
                slot.contents = { type: 'Empty' };
                tResult(`Orbit ${target}`, 'Empty Orbit');
            } else {
                tSkip(`Orbit ${target} (Occupied or HZ Slot)`);
            }
        }
    } else {
        tResult('Empty Orbits', 'None');
    }

    tSection('Captured Planets');
    let capDM = (['B', 'A'].includes(primaryStar.type)) ? 1 : 0;
    if (capDM !== 0) tDM(`Primary Star ${primaryStar.type}`, capDM);
    if (tRoll1D('Presence Check') + capDM >= 5) {
        let qtyRoll = tRoll1D('Quantity Roll');
        let qty = [0, 1, 1, 2, 2, 3, 3][qtyRoll];
        tResult('Captured Planets Rolled', qty);
        sys.capturedPlanets = [];
        for (let i = 0; i < qty; i++) {
            let baseline = tRoll2D('Baseline Orbit Roll');
            let deviation = (tRoll2D('Orbit Deviation Roll') - 7) * 0.1;
            let finalOrbit = Number((baseline + deviation).toFixed(1));
            
            sys.capturedPlanets.push({
                type: 'Captured Planet',
                orbit: finalOrbit,
                zone: zones[Math.floor(finalOrbit)] || 'O'
            });
            tResult(`Captured Planet ${i+1}`, `Orbit ${finalOrbit} (Zone ${zones[Math.floor(finalOrbit)] || 'O'})`);
        }
    } else {
        tResult('Captured Planets', 'None');
    }

    // 5d. Mainworld Placement (Last)
    const mainworld = Object.assign({}, mainworldUWP, { type: 'Mainworld' });
    let mwOrbit = targetOrbit;
    let mwZone = 'H';

    if (!mainworldNeedsHZ) {
        // Can be anywhere. Find a random open terrestrial slot or belt slot if asteroid.
        if (isAsteroidMW) {
            let slot = sys.orbits.find(o => o.contents && o.contents.type === 'Planetoid Belt');
            if (slot) {
                Object.assign(slot.contents, mainworld);
                slot.contents.type = 'Mainworld'; // Overwrite
            } else {
                // If everything is full, extend the system by one orbit
                const newOrbit = sys.orbits.length;
                const slot = { orbit: newOrbit, zone: zones[newOrbit] || 'O', contents: mainworld };
                sys.orbits.push(slot);
                mwOrbit = newOrbit;
                mwZone = slot.zone;
            }
        } else {
            let slot = sys.orbits.find(o => !o.contents);
            if (slot) {
                slot.contents = mainworld;
                mwOrbit = slot.orbit;
                mwZone = slot.zone;
            } else {
                const newOrbit = sys.orbits.length;
                const nSlot = { orbit: newOrbit, zone: zones[newOrbit] || 'O', contents: mainworld };
                sys.orbits.push(nSlot);
                mwOrbit = newOrbit;
                mwZone = nSlot.zone;
            }
        }
        // In this case, mwOrbit is wherever it landed
        let finalSlot = sys.orbits.find(o => o.contents && o.contents.type === 'Mainworld');
        if (finalSlot) {
            mwOrbit = finalSlot.orbit;
            mwZone = finalSlot.zone;
        }
    } else {
        // MUST be in HZ. Check priority.
        let slot = sys.orbits[targetOrbit];
        if (slot.contents && slot.contents.type === 'Gas Giant') {
            // Satellite logic
            if (!slot.contents.satellites) slot.contents.satellites = [];
            slot.contents.satellites.push(mainworld);
            mainworld.orbit = targetOrbit;
            mainworld.zone = 'H';
            mainworld.distAU = orbitalAU[Math.min(targetOrbit, orbitalAU.length - 1)] || 1.0;
            
            // Assign a planetary distance (radii) for the UI, using a 'Close' orbit by default for Mainworlds
            if (satOrbitsTable && satOrbitsTable.Close) {
                const roll = tRoll2D('Mainworld Satellite Orbit Roll');
                const distIdx = Math.min(roll, satOrbitsTable.Close.length - 1);
                mainworld.pd = satOrbitsTable.Close[distIdx] || 10;
                tResult('Mainworld Distance', `${mainworld.pd}r`);
            } else {
                mainworld.pd = 10;
                tResult('Mainworld Distance', '10r (default)');
            }
        } else {
            // Terrestrial HZ Slot
            slot.contents = mainworld;
            mainworld.orbit = targetOrbit;
            mainworld.zone = 'H';
            mainworld.distAU = orbitalAU[Math.min(targetOrbit, orbitalAU.length - 1)] || 1.0;
        }
    }

    // 6. Mandatory Fill
    sys.orbits.forEach(slot => {
        if (!slot.contents) {
            slot.contents = { type: 'Terrestrial Planet' };
        }
    });

    // 7. Social & Physical Processing (Multi-Pass)
    // Pass 1: Physical Parameters for top-level bodies (Terrestrial/Captured/GG)
    if (systemWalker) {
        systemWalker(sys, (body, orbit) => {
            body.distAU = orbitalAU[Math.min(Math.floor(orbit), orbitalAU.length - 1)] || 1.0;
            
            if (body.type === 'Mainworld') {
                if (thermalStatsGetter) {
                    const thermal = thermalStatsGetter(body, primaryStar.luminosity);
                    body.temperature = thermal.temperature;
                }
                if (rotationStatsGetter) {
                    const rot = rotationStatsGetter(body);
                    body.axialTilt = rot.axialTilt;
                    body.rotationPeriod = rot.rotationPeriod;
                }
                body.gravity = body.size === 0 ? 0 : (body.size * 0.125);
                // Orbital Period: sqrt(AU^3 / Mass_star)
                if (body.distAU) {
                    body.orbitalPeriod = Math.sqrt(Math.pow(body.distAU, 3) / (primaryStar.mass || 1.0));
                }
                return;
            }

            if (['Terrestrial Planet', 'Captured Planet'].includes(body.type)) {
                if (physicalGen) physicalGen(body, body.zone);
            }

            if (body.type === 'Gas Giant') {
                 body.temperature = 100; // GC baseline
            }

            // Sync AU and orbital period for all base bodies
            if (body.distAU) {
                body.orbitalPeriod = Math.sqrt(Math.pow(body.distAU, 3) / (primaryStar.mass || 1.0));
            }
        });

        // Step 6b: Satellite Generation (Book 6 — Now that parent sizes are known)
        sys.orbits.forEach(slot => {
            const body = slot.contents;
            if (!body || body.type === 'Mainworld' || body.type === 'Empty') return;
            if (satelliteGenerator) satelliteGenerator(body, slot.zone, mainworld.pop);
        });

        // Pass 2: Physical Parameters for everyone (including newly created Moons)
        systemWalker(sys, (body, orbit) => {
            if (body.type === 'Mainworld') return; // Already handled

            if (['Satellite'].includes(body.type)) {
                // Determine physical scale for new moons
                body.gravity = (body.size === 0 || body.size === 'R' || body.size === 'S') ? 0 : (body.size * 0.125);
                body.diamKm = (body.size === 'R') ? 0 : (body.size === 'S' ? 500 : body.size * 1600);
            }

            if (thermalStatsGetter && !body.temperature) {
                const th = thermalStatsGetter(body, primaryStar.luminosity);
                body.temperature = th.temperature;
            }
            if (rotationStatsGetter && !body.rotationPeriod) {
                const ro = rotationStatsGetter(body);
                body.axialTilt = ro.axialTilt;
                body.rotationPeriod = ro.rotationPeriod;
            }
        });

        // Pass 3: Social
        const mwRef = mainworld;
        systemWalker(sys, (body) => {
            if (body.type === 'Mainworld') {
                if (tradeCodesGen) body.tradeCodes = tradeCodesGen(body);
                return;
            }
            if (['Terrestrial Planet', 'Captured Planet'].includes(body.type)) {
                // These bodies need a fresh pop roll from generatePopulation
                if (popGen) popGen(body);
                if (subordinateSocialFin) subordinateSocialFin(body, mwRef);
            }
            if (body.type === 'Satellite') {
                // Pop/Atm/Hydro already set by generateSatellites (Book 6 Step 4)
                // — only run Gov/Law/TL finalization
                if (subordinateSocialFin) subordinateSocialFin(body, mwRef);
            }
            if (body.type === 'Planetoid Belt') {
                if (subordinateSocialFin) subordinateSocialFin(body, mwRef);
            }
        });
    }

    if (typeof endTrace !== 'undefined') endTrace();
    return sys;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateTopDownSystem };
} else {
    window.generateTopDownSystem = generateTopDownSystem;
}
