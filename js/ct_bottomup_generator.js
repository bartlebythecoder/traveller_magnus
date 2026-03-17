// =====================================================================
// CLASSIC TRAVELLER: MODULAR BOTTOM-UP GENERATOR (Rule Compliant)
// =====================================================================

// Browser-safe imports
var orbitalAU, luminosityTable, starMassTable, natureTable, priTypeTable, priSizeTable, compTypeTable, compSizeTable, zoneTables, companionOrbitTable, maxOrbitsBase, maxOrbitsModifiers, zoneHTable, placementPriorities, rollSkeleton, satLogic, satOrbitsTable;
var physicalGen, popGen, socialGen, mainworldSocialFin, subordinateSocialFin;
var thermalStatsGetter, rotationStatsGetter, satelliteGenerator;

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
    companionOrbitTable = constants.CT_COMPANION_ORBIT_TABLE;
    maxOrbitsBase = constants.CT_MAX_ORBITS_BASE;
    maxOrbitsModifiers = constants.CT_MAX_ORBITS_MODIFIERS;
    zoneHTable = constants.ZONE_H_TABLE;

    const worldEngine = require('./ct_world_engine');
    physicalGen = worldEngine.generatePhysicals;
    popGen = worldEngine.generatePopulation;
    socialGen = worldEngine.generateSocial;
    mainworldSocialFin = worldEngine.finalizeMainworldSocial;
    subordinateSocialFin = worldEngine.finalizeSubordinateSocial;
    rollSkeleton = worldEngine.rollSystemSkeleton;

    placementPriorities = constants.CT_PLACEMENT_PRIORITIES;
    satLogic = constants.CT_SATELLITE_LOGIC;
    satOrbitsTable = constants.SATELLITE_ORBITS;

    const physLib = require('./ct_physical_library');
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
    companionOrbitTable = typeof CT_COMPANION_ORBIT_TABLE !== 'undefined' ? CT_COMPANION_ORBIT_TABLE : {};
    maxOrbitsBase = typeof CT_MAX_ORBITS_BASE !== 'undefined' ? CT_MAX_ORBITS_BASE : [];
    maxOrbitsModifiers = typeof CT_MAX_ORBITS_MODIFIERS !== 'undefined' ? CT_MAX_ORBITS_MODIFIERS : {};
    zoneHTable = typeof ZONE_H_TABLE !== 'undefined' ? ZONE_H_TABLE : {};

    physicalGen = (window.CT_World_Engine) ? window.CT_World_Engine.generatePhysicals : null;
    popGen = (window.CT_World_Engine) ? window.CT_World_Engine.generatePopulation : null;
    socialGen = (window.CT_World_Engine) ? window.CT_World_Engine.generateSocial : null;
    mainworldSocialFin = (window.CT_World_Engine) ? window.CT_World_Engine.finalizeMainworldSocial : null;
    subordinateSocialFin = (window.CT_World_Engine) ? window.CT_World_Engine.finalizeSubordinateSocial : null;
    rollSkeleton = (window.CT_World_Engine) ? window.CT_World_Engine.rollSystemSkeleton : null;

    placementPriorities = typeof CT_PLACEMENT_PRIORITIES !== 'undefined' ? CT_PLACEMENT_PRIORITIES : {};
    satLogic = typeof CT_SATELLITE_LOGIC !== 'undefined' ? CT_SATELLITE_LOGIC : {};
    satOrbitsTable = typeof SATELLITE_ORBITS !== 'undefined' ? SATELLITE_ORBITS : {};

    thermalStatsGetter = typeof getThermalStats !== 'undefined' ? getThermalStats : null;
    rotationStatsGetter = typeof getRotationStats !== 'undefined' ? getRotationStats : null;
    satelliteGenerator = typeof generateSatellites !== 'undefined' ? generateSatellites : null;
}

/**
 * PHASE 1: SKELETON GENERATION (System-Wide Logic)
 */
function generateSystemSkeleton() {
    tSection('Stellar Generation');
    const sys = { stars: [], orbits: [] };

    // 1. Determine System Nature (Step 2A)
    const natureRoll = tRoll2D('System Nature Roll');
    sys.nature = natureTable[natureRoll] || 'Solo';
    tResult('System Nature', sys.nature);

    // 2. Generate Primary Star (Step 2B)
    const priTypeRoll = tRoll2D('Primary Type Roll');
    const priSizeRoll = tRoll2D('Primary Size Roll');
    const priDecimalRoll = tRoll1D('Primary Decimal Roll');
    
    let priType = priTypeTable[priTypeRoll];
    let priSize = priSizeTable[priSizeRoll];
    let priDecimal = (priDecimalRoll <= 3 ? 0 : 5);

    // Mandatory Size Corrections
    if ((priType === 'M' || (priType === 'K' && priDecimal === 5)) && priSize === 'IV') {
        priSize = 'V';
        tResult('Correction', 'K5-M IV to V');
    }
    if ((['B', 'A'].includes(priType) || (priType === 'F' && priDecimal === 0)) && priSize === 'VI') {
        priSize = 'V';
        tResult('Correction', 'B-F0 VI to V');
    }

    const primary = {
        role: 'Primary',
        type: priType,
        size: priSize,
        decimal: priDecimal,
        specKey: priType + priDecimal,
        name: `${priType}${priDecimal} ${priSize}`,
        mass: 1.0,
        luminosity: 1.0
    };
    primary.mass = (starMassTable[primary.size] && starMassTable[primary.size][primary.specKey]) || 1.0;
    primary.luminosity = (luminosityTable[primary.size] && luminosityTable[primary.size][primary.specKey]) || 1.0;
    
    sys.stars.push(primary);
    tResult('Primary Selection', `${primary.name} (${primary.specKey})`);

    // 3. Generate Companion Stars (Step 2C)
    if (sys.nature === 'Binary' || sys.nature === 'Trinary') {
        const companionsToGen = (sys.nature === 'Trinary' ? 2 : 1);
        
        for (let i = 0; i < companionsToGen; i++) {
            tSection(`${i === 0 ? 'First' : 'Second'} Companion Generation`);
            
            // Primary's natural die rolls as DMs
            const compTypeRoll = tRoll2D('Companion Type Roll') + priTypeRoll;
            const compSizeRoll = tRoll2D('Companion Size Roll') + priSizeRoll;
            const compDecimalRoll = tRoll1D('Companion Decimal Roll');

            let compType = compTypeTable[Math.min(compTypeRoll, compTypeTable.length - 1)];
            let compSize = compSizeTable[Math.min(compSizeRoll, compSizeTable.length - 1)];
            let compDecimal = (compDecimalRoll <= 3 ? 0 : 5);

            // Mandatory Size Corrections
            if ((compType === 'M' || (compType === 'K' && compDecimal === 5)) && compSize === 'IV') {
                compSize = 'V';
            }
            if ((['B', 'A'].includes(compType) || (compType === 'F' && compDecimal === 0)) && compSize === 'VI') {
                compSize = 'V';
            }

            const companion = {
                role: (i === 0 ? 'Secondary' : 'Tertiary'),
                type: compType,
                size: compSize,
                decimal: compDecimal,
                specKey: compType + compDecimal,
                name: `${compType}${compDecimal} ${compSize}`
            };
            companion.mass = (starMassTable[companion.size] && starMassTable[companion.size][companion.specKey]) || 1.0;
            companion.luminosity = (luminosityTable[companion.size] && luminosityTable[companion.size][companion.specKey]) || 1.0;
            
            // 4. Companion Orbit Placement (Step 2D)
            const orbitRoll = tRoll2D('Orbit Placement Roll') + (i === 1 ? 4 : 0);
            let orbitResult = companionOrbitTable[Math.min(orbitRoll, 12)];

            // Resolve numeric rolls like "4+1D"
            if (typeof orbitResult === 'string' && orbitResult.includes('+1D')) {
                const b = parseInt(orbitResult.split('+')[0]);
                orbitResult = b + tRoll1D('Numeric Orbit DM');
            }

            // Internal Orbit Exception
            if (typeof orbitResult === 'number') {
                const zone = getZoneForOrbit(primary.size, primary.specKey, orbitResult);
                if (zone === '-') {
                    orbitResult = 'Close';
                    tResult('Orbit Shift', 'Close (Internal Orbit)');
                }
            }

            if (orbitResult === 'Far') {
                companion.orbit = 'Far';
                companion.distAU = tRoll1D('Far Distance Roll') * 1000;
                tResult('Orbit', `Far (${companion.distAU} AU)`);
                
                // Far Exception: Roll for Far companion nature
                const farNatureRoll = tRoll2D('Far Companion Nature Roll');
                const farNature = natureTable[farNatureRoll] || 'Solo';
                if (farNature === 'Binary') {
                    // Generate its own companion normally, DM -4 to orbit
                    tSection('Far Tier-2 Companion');
                    const subtRoll = tRoll2D('Sub-Type Roll');
                    const subsRoll = tRoll2D('Sub-Size Roll');
                    const subdRoll = tRoll1D('Sub-Decimal Roll');
                    
                    let subt = compTypeTable[Math.min(subtRoll, compTypeTable.length - 1)];
                    let subs = compSizeTable[Math.min(subsRoll, compSizeTable.length - 1)];
                    let subdec = (subdRoll <= 3 ? 0 : 5);
                    
                    const subComp = {
                        role: 'Far Companion',
                        type: subt,
                        size: subs,
                        decimal: subdec,
                        specKey: subt + subdec,
                        name: `${subt}${subdec} ${subs}`,
                        orbitRoll: tRoll2D('Sub-Orbit Roll') - 4
                    };

                    let subOrbit = companionOrbitTable[Math.max(0, Math.min(subComp.orbitRoll, 12))];
                    if (typeof subOrbit === 'string' && subOrbit.includes('+1D')) {
                        const subBase = parseInt(subOrbit.split('+')[0]);
                        subOrbit = subBase + tRoll1D('Sub-Numeric Orbit DM');
                    }
                    subComp.orbit = subOrbit;

                    subComp.mass = (starMassTable[subs] && starMassTable[subs][subComp.specKey]) || 1.0;
                    subComp.luminosity = (luminosityTable[subs] && luminosityTable[subs][subComp.specKey]) || 1.0;
                    
                    companion.subCompanion = subComp;
                    tResult('Far Sub-Companion', subComp.name);
                    tResult('Far Sub-Orbit', subComp.orbit);
                }
            } else {
                companion.orbit = orbitResult;
                tResult('Orbit', orbitResult);
            }

            sys.stars.push(companion);
        }
    }

    // Step 2E & 2F: Max Orbits & Zones
    generateSystemOrbits(sys);

    // Step 2G: Skeleton Placement (GAS GIANTS, BELTS, EMPTY, CAPTURED)
    if (rollSkeleton) {
        const skeleton = rollSkeleton(sys.stars[0]);
        if (skeleton) {
            // A. Captured Planets
            sys.capturedPlanets = skeleton.capturedPlanets.map(cap => ({
                ...cap,
                zone: getZoneForOrbit(sys.stars[0].size, sys.stars[0].specKey, Math.floor(cap.orbit))
            }));

            // B. Empty Orbits
            skeleton.emptyOrbits.forEach(target => {
                const slot = sys.orbits.find(o => o.orbit === target);
                if (slot && !slot.contents) {
                    slot.contents = { type: 'Empty' };
                    tResult(`Orbit ${target}`, 'Empty Orbit');
                }
            });

            // C. Gas Giants (Priority O, then H)
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
                    tResult(`Orbit ${slot.orbit}`, `${gg.size} Gas Giant`);
                }
            });

            // D. Planetoid Belts (Priority I, then H, then O)
            const pbPriorities = placementPriorities.PLANETOID_BELT || ['I', 'H', 'O'];
            for (let i = 0; i < skeleton.belts; i++) {
                let slot = null;
                for (const p of pbPriorities) {
                    slot = sys.orbits.find(o => o.zone === p && !o.contents);
                    if (slot) break;
                }
                if (slot) {
                    slot.contents = { type: 'Planetoid Belt', size: 0, gravity: 0, temperature: 100 };
                    tResult(`Orbit ${slot.orbit}`, 'Planetoid Belt');
                }
            }

            // E. Fill Remaining (Terrestrial)
            const starOrbits = sys.stars.filter(s => typeof s.orbit === 'number').map(s => s.orbit);
            sys.orbits.forEach(slot => {
                const isStarOrbit = starOrbits.includes(slot.orbit);
                if (!slot.contents && !isStarOrbit) {
                    slot.contents = { type: 'Terrestrial Planet' };
                }
            });
        }
    }

    return sys;
}

/**
 * HELPER: Roll Max Orbits for a Star / Subsystem
 */
function calculateMaxOrbits(star) {
    tSection(`Max Orbits for ${star.role} (${star.name})`);
    const roll = tRoll2D('Max Orbits Roll');
    let max = maxOrbitsBase[roll] || 0;
    
    // Apply DMs
    const sizeDM = maxOrbitsModifiers.SIZES[star.size] || 0;
    const typeDM = maxOrbitsModifiers.TYPES[star.type] || 0;
    
    if (sizeDM) tDM(`Size ${star.size}`, sizeDM);
    if (typeDM) tDM(`Type ${star.type}`, typeDM);
    
    max = Math.max(0, max + sizeDM + typeDM);
    tResult('Max Orbits', max);
    return max;
}

/**
 * PHASE 1.5: ORBIT GENERATION & ZONE CLASSIFICATION (Step 2E, 2F)
 */
function generateSystemOrbits(sys) {
    const primary = sys.stars[0];
    const max = calculateMaxOrbits(primary);
    
    // 1. Create Baseline Orbits (0 to max)
    let orbitNumbers = [];
    for (let i = 0; i <= max; i++) orbitNumbers.push(i);

    // 2. Companion Orbit Destruction (Step 2E)
    // Applies to companions in numeric orbits (1-8), NOT "Close" or "Far".
    sys.stars.forEach(star => {
        if (typeof star.orbit === 'number' && star.orbit >= 1 && star.orbit <= 8) {
            const compOrbit = star.orbit;
            tSection(`Orbit Destruction by ${star.role} at Orbit ${compOrbit}`);
            
            const beforeCount = orbitNumbers.length;
            orbitNumbers = orbitNumbers.filter(o => {
                if (o === compOrbit) return true; // Keep the companion's orbit slot
                if (o < compOrbit) {
                    // Inner Rule: must be <= half
                    return o <= Math.floor(compOrbit / 2);
                } else {
                    // Outer Rule: must be >= +2
                    return o >= compOrbit + 2;
                }
            });
            const destroyed = beforeCount - orbitNumbers.length;
            if (destroyed > 0) tResult('Orbits Destroyed', destroyed);
        }
    });

    // 3. Zone Classification (Step 2F)
    sys.orbits = orbitNumbers.map(o => {
        const zone = getZoneForOrbit(primary.size, primary.specKey, o);
        
        // Re-classify based on Habitable Zone table if needed
        let finalZone = zone;
        if (zone !== '-') {
            const hz = zoneHTable[primary.size] ? zoneHTable[primary.size][primary.specKey] : -99;
            // NOTE: Book 6 Habitable Zone is a single orbit. 
            // Often treated as a range, but CT_CONSTANTS has a single value.
            if (o === hz) {
                finalZone = 'H';
            } else if (o < hz) {
                finalZone = 'I';
            } else {
                finalZone = 'O';
            }
        }
        
        return { orbit: o, zone: finalZone, contents: null };
    });

    // Handle "Far" Companions as nested systems
    sys.stars.forEach((star, idx) => {
        if (idx > 0 && star.orbit === 'Far') {
            tSection(`Generating Nested System for Far Companion: ${star.name}`);
            
            // Break circularity for JSON stringification and recursive walking
            const starCopy = { ...star };
            delete starCopy.nestedSystem;

            const nestedSys = { stars: [starCopy], orbits: [] };
            if (star.subCompanion) {
                nestedSys.stars.push({ ...star.subCompanion });
            }
            generateSystemOrbits(nestedSys);
            star.nestedSystem = nestedSys;
        }
    });

    return sys;
}

/**
 * PHASE 2 - 4: SOCIAL & INFRASTRUCTURE
 * Implements the full two-pass orchestration.
 */
function processBottomUpSocial(sys) {
    if (!sys) return null;

    // 1. Recursive Physical/Population Pass
    internalPhysicalPass(sys);

    // 2. Recursive Satellite Pass
    processBottomUpSatellites(sys);

    // 3. Mainworld Designation (ROOT ONLY - should be called on the root sys)
    // We assume the caller calls this on the top-level system.
    processBottomUpDesignation(sys);

    // 4. Subordinate Finalization (Recursive via walkSystem)
    processBottomUpSubordinates(sys);

    return sys;
}

/**
 * INTERNAL: Recursive Physical & Population Generator
 */
function internalPhysicalPass(sys) {
    tSection(`Planetary Physical Pass - Star: ${sys.stars[0].name}`);

    const starOrbits = sys.stars.filter(s => typeof s.orbit === 'number').map(s => s.orbit);

    // 1. Primary Orbit Pass
    sys.orbits.forEach(slot => {
        const body = slot.contents;
        if (!body || body.type === 'Empty') return;

        // Skip Companion Star orbits
        if (starOrbits.includes(slot.orbit)) {
            tSkip(`Orbit ${slot.orbit} (Companion Star)`);
            return;
        }

        tSection(`Orbit ${slot.orbit} - ${body.type}`);
        
        // Basic Physics Setup
        body.distAU = orbitalAU[Math.min(slot.orbit, orbitalAU.length - 1)] || 1.0;
        body.orbitalPeriod = Math.sqrt(Math.pow(body.distAU, 3) / (sys.stars[0].mass || 1.0));

        // Generate Physicals (Size, Atmo, Hydro)
        if (physicalGen) physicalGen(body, slot.zone);

        // Generate Population (2D-2, No Caps)
        if (popGen) popGen(body);

        // Finalize Base Stats
        if (['Terrestrial Planet', 'Planetoid Belt'].includes(body.type)) {
            body.gravity = (body.size === 0) ? 0 : (body.size * 0.125);
            if (thermalStatsGetter) {
                const thermal = thermalStatsGetter(body, sys.stars[0].luminosity);
                body.temperature = thermal.temperature;
            }
            if (rotationStatsGetter) {
                const rot = rotationStatsGetter(body);
                body.axialTilt = rot.axialTilt;
                body.rotationPeriod = rot.rotationPeriod;
            }
        }
        
        if (body.type === 'Gas Giant') {
            body.temperature = 100; // GC Baseline
        }
    });

    // 2. Captured Planets Pass
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach((p, idx) => {
            tSection(`Captured Planet ${idx + 1} - Orbit ${p.orbit}`);
            if (physicalGen) physicalGen(p, p.zone);
            if (popGen) popGen(p);
            
            p.distAU = orbitalAU[Math.min(Math.floor(p.orbit), orbitalAU.length - 1)] || 1.0;
            p.orbitalPeriod = Math.sqrt(Math.pow(p.distAU, 3) / (sys.stars[0].mass || 1.0));
            p.gravity = (p.size === 0) ? 0 : (p.size * 0.125);
        });
    }

    // 3. RECURSE into nested systems
    sys.stars.forEach(star => {
        if (star.nestedSystem) {
            internalPhysicalPass(star.nestedSystem);
        }
    });
}

/**
 * PHASE 3: SATELLITES (Step 5 & 6)
 */
function processBottomUpSatellites(sys) {
    if (!sys || !satLogic) return sys;

    tSection(`Step 5 & 6: Satellite Presence & Generation - Star: ${sys.stars[0].name}`);

    const parents = [];
    sys.orbits.forEach(slot => {
        if (slot.contents && slot.contents.type !== 'Empty') {
             parents.push(slot.contents);
        }
    });
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(p => parents.push(p));
    }

    parents.forEach(parent => {
        // Exclusion Rule
        if (satLogic.EXCLUSIONS.includes(parent.type) || satLogic.EXCLUSIONS.includes(parent.size.toString())) {
            return;
        }

        // Determine Quantity
        let count = 0;
        if (parent.type === 'Gas Giant') {
            if (parent.size === 'Large') {
                count = tRoll2D('LGG Satellite Qty (2D)');
            } else {
                count = Math.max(0, tRoll2D('SGG Satellite Qty (2D-4)') - 4);
            }
        } else {
             count = Math.max(0, tRoll1D('Terrestrial Satellite Qty (1D-3)') - 3);
        }

        if (count > 0) {
            tSection(`${parent.type} at Orbit ${parent.orbit} - ${count} Satellites`);
            if (!parent.satellites) parent.satellites = [];
            
            const occupiedRadii = new Set();
            let cumulativeDM = 0;

            for (let i = 0; i < count; i++) {
                let sizeCode;
                if (parent.type === 'Gas Giant') {
                    if (parent.size === 'Large') {
                        const roll = tRoll2D('LGG Sat Size Roll (2D-4)');
                        const result = roll - 4;
                        if (result === 0) sizeCode = 'R';
                        else if (result < 0) sizeCode = 'S';
                        else sizeCode = result;
                    } else {
                        const roll = tRoll2D('SGG Sat Size Roll (2D-6)');
                        const result = roll - 6;
                        if (result === 0) sizeCode = 'R';
                        else if (result < 0) sizeCode = 'S';
                        else sizeCode = result;
                    }
                } else {
                    const pSize = (typeof parent.size === 'number') ? parent.size : 0;
                    const roll = tRoll1D('Terrestrial Sat Size Roll (1D)');
                    const result = pSize - roll;
                    if (result === 0) sizeCode = 'R';
                    else if (result < 0) sizeCode = 'S';
                    else sizeCode = result;
                }

                let finalType = 'Satellite';
                let finalSize = sizeCode;

                if (sizeCode === 'R') {
                    finalType = 'Ring';
                }

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
                        const orbitRoll = Math.max(2, tRoll2D('Orbit Type Roll') - cumulativeDM);
                        if (orbitRoll >= 12 && parent.type === 'Gas Giant') {
                            orbitType = 'Extreme';
                        } else if (orbitRoll >= 8) {
                            orbitType = 'Far';
                        } else {
                            orbitType = 'Close';
                        }
                        const distRoll = tRoll2D(`Orbit Distance (${orbitType})`);
                        const distIdx = Math.min(distRoll, (satOrbitsTable[orbitType] || []).length - 1);
                        pd = (satOrbitsTable[orbitType] && satOrbitsTable[orbitType][distIdx]) || 3;
                    }

                    if (!occupiedRadii.has(pd)) break;
                    pd = null; 
                }

                if (pd === null) {
                    pd = 3 + i; // Fallback
                }
                occupiedRadii.add(pd);
                cumulativeDM++;

                const sat = {
                    type: finalType,
                    size: finalSize,
                    parentType: parent.type,
                    orbit: parent.orbit,
                    zone: parent.zone,
                    pd: pd,
                    orbitType: orbitType
                };

                // Generate Physicals & Population
                if (finalType === 'Ring') {
                    sat.atm = 0;
                    sat.hydro = 0;
                    sat.pop = 0;
                } else {
                    if (physicalGen) physicalGen(sat, sat.zone);
                    if (popGen) popGen(sat);
                }

                parent.satellites.push(sat);
                tResult(`Satellite ${i+1}`, `${finalSize} ${finalType}`);
            }
        }
    });

    // RECURSE into nested systems
    sys.stars.forEach(star => {
        if (star.nestedSystem) {
            processBottomUpSatellites(star.nestedSystem);
        }
    });

    return sys;
}

/**
 * PHASE 5: SUBORDINATE FINALIZATION (Step 8)
 */
function processBottomUpSubordinates(sys) {
    if (!sys || !sys.mainworld) return sys;

    tSection('Step 8: Subordinate Finalization');

    walkSystem(sys, (body) => {
        // Skip the Mainworld
        if (body === sys.mainworld) return;

        // Skip non-physical types (Empty, Nature)
        if (body.type === 'Empty' || body.type === 'Nature') return;

        tSection(`${body.type} at Orbit ${body.orbit} Social Finalization`);

        // Zero-Pop Consistency (Task 3)
        if (body.pop === 0) {
            body.starport = 'Y';
            body.spaceport = 'Y';
            body.gov = 0;
            body.law = 0;
            body.tl = 0;
        }

        // Call Social Finalization (Gov, Law, TL, Spaceport, Trade)
        if (subordinateSocialFin) {
            subordinateSocialFin(body, sys.mainworld);
        }


        // Final UWP Refresh (Syncing Starport/Spaceport and Char representation)
        const spChar = body.starport || body.spaceport || 'Y';
        const szChar = toUWPChar(body.size);
        const atChar = toUWPChar(body.atm);
        const hyChar = toUWPChar(body.hydro);
        const poChar = toUWPChar(body.pop);
        const gvChar = toUWPChar(body.gov);
        const lwChar = toUWPChar(body.law);
        const tlChar = toUWPChar(body.tl);
        
        body.uwp = `${spChar}${szChar}${atChar}${hyChar}${poChar}${gvChar}${lwChar}-${tlChar}`;
        body.uwpSecondary = body.uwp;

        tResult('Final UWP', body.uwp);
    });

    sys.state = 'Complete';
    tSection('System Generation Finished');
    tResult('Final State', sys.state);

    return sys;
}

/**
 * PHASE 4: MAINWORLD DESIGNATION (Step 7)
 */
function processBottomUpDesignation(sys) {
    tSection('Step 7: Mainworld Designation');
    
    // Task 4 Critical: Fixed Anchor Check
    if (sys.mainworld) {
        tResult('Fixed Anchor', 'Using pre-designated Mainworld (Top-Down mode)');
        const winner = sys.mainworld;
        // Role Designation (Ensure it is marked as Mainworld)
        winner.type = 'Mainworld';
        
        // Generate Social ONLY if missing (manual or incomplete anchor)
        if (socialGen && !winner.uwp) socialGen(winner);
        
        tResult('Final Mainworld UWP', winner.uwp);
        return sys;
    }

    const winner = designateMainworld(sys);
    sys.mainworld = winner;

    if (winner) {
        tResult('Designated Mainworld', `${winner.type} at Orbit ${winner.orbit}`);
        // Role Designation
        winner.type = 'Mainworld';
        
        // Generate Social (Starport, Gov, Law, TL, Trade)
        if (socialGen) socialGen(winner);
        
        tResult('Final Mainworld UWP', winner.uwp);
    } else {
        tResult('Designated Mainworld', 'NONE (Empty System)');
    }

    return sys;
}

/**
 * UTILITY: SYSTEM WALKER (Helper for sweeping all bodies)
 */
function walkSystem(sys, callback) {
    if (!sys.orbits) return;
    sys.orbits.forEach(slot => {
        if (slot.contents) {
            callback(slot.contents, slot.orbit);
            if (slot.contents.satellites) {
                slot.contents.satellites.forEach(sat => callback(sat, slot.orbit));
            }
        }
    });
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach(p => callback(p, p.orbit));
    }
    // RECURSE into nested systems (Far Companions)
    if (sys.stars) {
        sys.stars.forEach(star => {
            if (star.nestedSystem) {
                walkSystem(star.nestedSystem, callback);
            }
        });
    }
}

/**
 * UTILITY: MAINWORLD DESIGNATOR (Step 7 Selection Algorithm)
 */
function designateMainworld(sys) {
    let candidates = [];
    walkSystem(sys, (body, orbit) => {
        if (['Terrestrial Planet', 'Planetoid Belt', 'Captured Planet', 'Satellite'].includes(body.type)) {
            candidates.push({
                body: body,
                orbit: orbit,
                hasHZ: body.zone === 'H',
                isSatellite: (body.type === 'Satellite' || (body.parentType && body.parentType !== 'Gas Giant'))
            });
        }
    });

    if (candidates.length === 0) return null;

    // Selection Priority (Tie-Breakers):
    // 1. Highest Pop Code
    // 2. Habitable Zone
    // 3. Lowest Orbit
    // 4. Planet vs Satellite (Planet wins)
    candidates.sort((a, b) => {
        // 1. Pop
        const popA = a.body.pop || 0;
        const popB = b.body.pop || 0;
        if (popB !== popA) return popB - popA;

        // 2. HZ
        if (a.hasHZ !== b.hasHZ) return b.hasHZ ? 1 : -1;

        // 3. Lowest Orbit
        if (a.orbit !== b.orbit) return a.orbit - b.orbit;

        // 4. Hierarchy (Planet wins if tied)
        if (a.isSatellite !== b.isSatellite) return a.isSatellite ? 1 : -1;

        return 0;
    });

    return candidates[0].body;
}

/**
 * HELPER: Zone Lookup
 */
function getZoneForOrbit(size, spectralKey, orbitNum) {
    const table = zoneTables[size];
    if (!table) return 'O';
    const zoneList = table[spectralKey] || table.default || [];
    if (orbitNum < 0) return '-';
    if (orbitNum >= zoneList.length) return 'O';
    return zoneList[orbitNum] || 'O';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        generateSystemSkeleton, 
        processBottomUpSocial, 
        processBottomUpSatellites, 
        processBottomUpDesignation, 
        processBottomUpSubordinates,
        walkSystem 
    };
} else {
    window.generateSystemSkeleton = generateSystemSkeleton;
    window.processBottomUpSocial = processBottomUpSocial;
    window.processBottomUpSatellites = processBottomUpSatellites;
    window.processBottomUpDesignation = processBottomUpDesignation;
    window.processBottomUpSubordinates = processBottomUpSubordinates;
    window.walkSystem = walkSystem;
}
