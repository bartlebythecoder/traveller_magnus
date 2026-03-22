// =====================================================================
// CLASSIC TRAVELLER: MODULAR TOP-DOWN GENERATOR
// =====================================================================

// Browser-safe imports
var orbitalAU, luminosityTable, starMassTable, zoneTables, natureTable, priTypeTable, priSizeTable, compTypeTable, compSizeTable, satOrbitsTable, placementPriorities, rollSkeleton;
var physicalGen, popGen, mainworldSocialFin, subordinateSocialFin, tradeCodesGen;
var thermalStatsGetter, rotationStatsGetter, satelliteGenerator, systemWalker, processSubordinates;

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
    rollSkeleton = worldEngine.rollSystemSkeleton;

    placementPriorities = constants.CT_PLACEMENT_PRIORITIES;

    const bottomUp = require('./ct_bottomup_generator.js');
    systemWalker = bottomUp.walkSystem;
    processSubordinates = bottomUp.processBottomUpSubordinates;

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
    rollSkeleton = (window.CT_World_Engine) ? window.CT_World_Engine.rollSystemSkeleton : null;

    placementPriorities = typeof CT_PLACEMENT_PRIORITIES !== 'undefined' ? CT_PLACEMENT_PRIORITIES : {};

    systemWalker = typeof walkSystem !== 'undefined' ? walkSystem : null;
    processSubordinates = typeof processBottomUpSubordinates !== 'undefined' ? processBottomUpSubordinates : null;

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
    tSection('Primary Star Generation');
    let overrideStars = [];
    if (mainworldUWP && mainworldUWP.homestar && mainworldUWP.homestar.trim() !== '') {
        let tokens = mainworldUWP.homestar.trim().split(/\s+/);
        for (let i = 0; i < tokens.length; i++) {
            if (i > 0 && /^(Ia|Ib|II|III|IV|V|VI|VII|D|BD)$/i.test(tokens[i]) && !overrideStars[overrideStars.length - 1].includes(" ")) {
                overrideStars[overrideStars.length - 1] += " " + tokens[i];
            } else {
                overrideStars.push(tokens[i]);
            }
        }
    }
    
    if (overrideStars.length > 0 && !primaryStar) {
        let primaryStr = overrideStars[0];
        let rawType = primaryStr.split(' ')[0] || '';
        let sType = rawType.length > 0 ? rawType[0] : 'M';
        let subTypeMatch = rawType.match(/\d/);
        let decimal = subTypeMatch ? parseInt(subTypeMatch[0]) : 0;
        let sClass = primaryStr.split(' ')[1] || 'V';
        if (sType === 'D') { sClass = 'D'; decimal = 0; }
        if (rawType === 'BD') { sType = 'BD'; sClass = 'V'; decimal = 0; }
        
        let specKey = sType + decimal;
        
        primaryStar = {
            role: 'Primary',
            type: sType,
            size: sClass,
            decimal: decimal,
            specKey: specKey,
            name: `${sType}${rawType !== 'D' && rawType !== 'BD' ? decimal : ''} ${sClass}`,
            maxOrbits: typeof tRoll2D !== 'undefined' ? tRoll2D('Primary Max Orbits') : 10,
            mass: (typeof starMassTable !== 'undefined' && starMassTable[sClass] && starMassTable[sClass][specKey]) || 1.0,
            luminosity: (typeof luminosityTable !== 'undefined' && luminosityTable[sClass] && luminosityTable[sClass][specKey]) || 1.0
        };
        primaryStar.diam = (typeof UniversalMath !== 'undefined' && UniversalMath.estimateStellarDiameter) 
                            ? UniversalMath.estimateStellarDiameter(sType, decimal, sClass) 
                            : 1.0;
        tResult('Primary Override', primaryStr);
        tResult('Primary Diameter', `${primaryStar.diam} Solar`);
        const limit100D = (primaryStar.diam * 1392700 * 100) / 1000000;
        tResult("100D Limit", `${limit100D.toFixed(1)} M km`);
    }

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
                primaryStar.diam = (typeof UniversalMath !== 'undefined' && UniversalMath.estimateStellarDiameter) 
                                    ? UniversalMath.estimateStellarDiameter(rawType, decimal, rawSize) 
                                    : 1.0;
                tResult('Primary Selection', `${primaryStar.name} (${primaryStar.specKey})`);
                tResult('Star Mass', `${primaryStar.mass} M☉`);
                tResult('Star Luminosity', `${primaryStar.luminosity} L☉`);
                tResult('Primary Diameter', `${primaryStar.diam} Solar`);
                const limit100D = (primaryStar.diam * 1392700 * 100) / 1000000;
                tResult("100D Limit", `${limit100D.toFixed(1)} M km`);
            }
        }
    }

    if (!primaryStar) throw new Error("Could not roll a primary star with a Habitable Zone.");

    // 2. Identify the Habitable Zone (Target Orbit)
    let lookupSize = primaryStar.size;
    if (typeof zoneTables !== 'undefined' && !zoneTables[lookupSize]) lookupSize = 'V';
    
    let zones = (typeof zoneTables !== 'undefined' && zoneTables[lookupSize] && zoneTables[lookupSize][primaryStar.specKey]) 
                ? zoneTables[lookupSize][primaryStar.specKey] 
                : ['I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'];

    const hOrbits = zones.reduce((acc, z, idx) => (z === 'H' ? acc.concat(idx) : acc), []);
    const targetOrbit = hOrbits.length > 0 ? hOrbits[Math.floor(Math.random() * hOrbits.length)] : 2; // Fallback to 2 if no H zone
    tResult('Ideal Habitable Orbit', targetOrbit);

    const sys = {
        nature: natureTable[tRoll2D('System Nature Roll')],
        stars: [primaryStar],
        maxOrbits: Math.max(primaryStar.maxOrbits, targetOrbit),
        orbits: []
    };
    
    if (overrideStars.length > 1) {
        for (let i = 1; i < overrideStars.length; i++) {
            let sStr = overrideStars[i];
            let rawType = sStr.split(' ')[0] || '';
            let sType = rawType.length > 0 ? rawType[0] : 'M';
            let subTypeMatch = rawType.match(/\d/);
            let decimal = subTypeMatch ? parseInt(subTypeMatch[0]) : 0;
            let sClass = sStr.split(' ')[1] || 'V';
            if (sType === 'D') { sClass = 'D'; decimal = 0; }
            if (rawType === 'BD') { sType = 'BD'; sClass = 'V'; decimal = 0; }
            
            let lookupType = sType;
            if (sType === 'O') lookupType = 'B';
            if (['D', 'BD', 'L', 'T', 'Y'].includes(sType)) lookupType = 'M';
            let lookupDec = decimal >= 5 ? 5 : 0;
            if (lookupType === 'M' && decimal >= 9) lookupDec = 9;
            
            let specKey = lookupType + lookupDec;
            
            // Check fallback for missing size tables
            let lookupSize = sClass;
            if (typeof zoneTables !== 'undefined' && !zoneTables[lookupSize]) {
                lookupSize = 'V'; // Fallback for D, BD
            }

            let companion = {
                role: i === 1 ? 'Close' : (i === 2 ? 'Near' : 'Far'),
                type: sType,
                size: sClass,
                decimal: decimal,
                specKey: specKey, // Keep lookup key
                name: `${sType}${rawType !== 'D' && rawType !== 'BD' ? decimal : ''} ${sClass}`,
                mass: (typeof starMassTable !== 'undefined' && starMassTable[lookupSize] && starMassTable[lookupSize][specKey]) || 1.0,
                luminosity: (typeof luminosityTable !== 'undefined' && luminosityTable[lookupSize] && luminosityTable[lookupSize][specKey]) || 1.0
            };
            companion.diam = (typeof UniversalMath !== 'undefined' && UniversalMath.estimateStellarDiameter) 
                            ? UniversalMath.estimateStellarDiameter(sType, decimal, sClass) 
                            : 1.0;
            sys.stars.push(companion);
            tResult(`${companion.role} Override`, sStr);
            tResult(`${companion.role} Diameter`, `${companion.diam} Solar`);
            const limit100D = (companion.diam * 1392700 * 100) / 1000000;
            tResult("100D Limit", `${limit100D.toFixed(1)} M km`);
        }
    }
    
    tResult('System Nature', sys.nature);
    tResult('Baseline Orbits', sys.maxOrbits);

    // 3. System-Wide Feature Skeleton
    const skeleton = (rollSkeleton) ? rollSkeleton(primaryStar) : { ggs: [], belts: 0, emptyOrbits: [], capturedPlanets: [] };
    const totalBelts = Math.min(skeleton.belts, sys.maxOrbits);

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
    const ggPriorities = placementPriorities.GAS_GIANT || ['O', 'H'];
    skeleton.ggs.forEach(gg => {
        let slot = null;
        for (const p of ggPriorities) {
            slot = sys.orbits.find(o => o.zone === p && !o.contents);
            if (slot) break;
        }
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
    if (isAsteroidMW) placedBelts = 1; 
    
    const pbPriorities = placementPriorities.PLANETOID_BELT || ['I', 'H', 'O'];
    for (let i = placedBelts; i < totalBelts; i++) {
        let slot = null;
        // Prioritize away from Target Orbit if possible
        for (const p of pbPriorities) {
            slot = sys.orbits.find(o => o.zone === p && !o.contents && o.orbit !== targetOrbit);
            if (slot) break;
        }
        if (!slot) {
            // Fallback to any slot
            slot = sys.orbits.find(o => !o.contents && o.orbit !== targetOrbit);
        }
        if (slot) {
            slot.contents = { type: 'Planetoid Belt', size: 0, gravity: 0, temperature: 100 };
        }
    }

    // 5c. Anomaly Placement (Third)
    skeleton.emptyOrbits.forEach(target => {
        const slot = sys.orbits.find(o => o.orbit === target);
        // Skip the targetOrbit if the mainworld needs it
        if (slot && !slot.contents && (!mainworldNeedsHZ || slot.orbit !== targetOrbit)) {
            slot.contents = { type: 'Empty' };
            tResult(`Orbit ${target}`, 'Empty Orbit');
        } else {
            tSkip(`Orbit ${target} (Occupied or HZ Slot)`);
        }
    });

    sys.capturedPlanets = skeleton.capturedPlanets.map(cap => ({
        ...cap,
        zone: zones[Math.floor(cap.orbit)] || 'O'
    }));
    sys.capturedPlanets.forEach((p, i) => {
        tResult(`Captured Planet ${i+1}`, `Orbit ${p.orbit} (Zone ${p.zone})`);
    });

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
    sys.mainworld = mainworld; // Anchor Task 4
    const populationContext = { mode: 'topdown', mwPop: mainworld.pop };

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

                // Sean Protocol: Distance and 100D Logging
                const orbitMkm = (body.distAU * 149597870) / 1000000;
                tResult("Orbit Distance", `${body.distAU.toFixed(2)} AU (${orbitMkm.toFixed(1)} M km)`);
                
                const worldSize = (typeof body.size === 'string') ? UniversalMath.fromUWPChar(body.size) : (body.size || 0);
                const world100D = (worldSize * 160000) / 1000000;
                tResult("World 100D Limit", `${world100D.toFixed(2)} M km`);

                // Stellar Masking Eligibility
                if (typeof UniversalMath !== 'undefined' && UniversalMath.isMaskingEligible) {
                    const isEligible = UniversalMath.isMaskingEligible(primaryStar.diam, body.distAU, worldSize);
                    tResult("Stellar Masking", isEligible ? "ELIGIBLE" : "Ineligible");
                }
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

            if (body.type === 'Satellite' || body.type === 'Ring') {
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

        // Pass 3: Social Sweeping (Task 3 Mirroring)
        systemWalker(sys, (body) => {
            if (body.type === 'Mainworld') {
                if (tradeCodesGen) body.tradeCodes = tradeCodesGen(body);
                return;
            }
            // All physical bodies need population rolls
            if (body.type !== 'Empty' && body.type !== 'Nature') {
                if (popGen) popGen(body, populationContext);
            }
        });

        // Final Subordinate Sweep ( المركزي - Centralized)
        if (processSubordinates) {
            processSubordinates(sys);
        }
    }

    if (typeof endTrace !== 'undefined') endTrace();
    return sys;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateTopDownSystem };
} else {
    window.generateTopDownSystem = generateTopDownSystem;
}
