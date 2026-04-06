// =====================================================================
// CLASSIC TRAVELLER: MODULAR BOTTOM-UP GENERATOR (Rule Compliant)
// =====================================================================

// Browser-safe imports
// Stellar table variables (priTypeTable, priSizeTable, compTypeTable, compSizeTable,
// companionOrbitTable) are now owned exclusively by CT_StellarEngine.
var orbitalAU, luminosityTable, starMassTable, zoneTables, maxOrbitsBase, maxOrbitsModifiers, zoneHTable, placementPriorities, rollSkeleton, satLogic, satOrbitsTable;
var physicalGen, popGen, socialGen, mainworldSocialFin, subordinateSocialFin;
var thermalStatsGetter, rotationStatsGetter, satelliteGenerator, derivedPhysicsProcessor;

if (typeof module !== 'undefined' && module.exports) {
    const constants = require('./ct_constants');
    orbitalAU = constants.ORBIT_AU;
    luminosityTable = constants.LUM;
    starMassTable = constants.STAR_MASS;
    zoneTables = constants.ZONE_TABLES;
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
    derivedPhysicsProcessor = physLib.processCTDerivedPhysics;
} else {
    // In browser, these are globals or on window namespaces
    // Note: stellar tables (priTypeTable, compTypeTable, etc.) are resolved
    // internally by CT_StellarEngine and are not needed here.
    orbitalAU = typeof ORBIT_AU !== 'undefined' ? ORBIT_AU : [];
    luminosityTable = typeof LUM !== 'undefined' ? LUM : {};
    starMassTable = typeof STAR_MASS !== 'undefined' ? STAR_MASS : {};
    zoneTables = typeof ZONE_TABLES !== 'undefined' ? ZONE_TABLES : {};
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
    derivedPhysicsProcessor = typeof processCTDerivedPhysics !== 'undefined' ? processCTDerivedPhysics : null;
}

// Action 6.3: Audit Backlog — ensure global array exists
if (typeof window !== 'undefined') window.auditBacklog = window.auditBacklog || [];

/**
 * ACTION 6.4: Log a single body's complete physical + social biography
 * in one contiguous trace block. Called by the biography sweep in both
 * top-down and bottom-up generators.
 *
 * @param {Object} body   - Any system body (mainworld, terrestrial, satellite, etc.)
 * @param {string} hexId  - Parent system hexId for audit backlog references
 */
function logCTBodyBiography(body, hexId) {
    if (typeof tSection === 'undefined' || typeof tResult === 'undefined') return;
    const orbitLabel = body.orbit !== undefined ? `Orbit ${body.orbit}` : 'Satellite';
    tSection(`Biography: ${body.type} (${orbitLabel})`);
    // Physical
    if (body.size  !== undefined) tResult('Size',          body.size,                                        'CT 2.1: Composition & Gravity');
    if (body.atm   !== undefined) tResult('Atmosphere',    body.atm,                                         'CT 2.2: Atmospheric Chemistry');
    if (body.hydro !== undefined) tResult('Hydrographics', body.hydro,                                        'CT 2.3: Hydrographic Distribution');
    if (body.gravity     !== undefined) tResult('Gravity',        `${body.gravity}g`,                        'CT 2.1: Composition & Gravity');
    if (body.temperature !== undefined) tResult('Temperature',    `${body.temperature}K`,                    'CT 2.4: Thermal Logic');
    if (body.rotationPeriod !== undefined) tResult('Rotation',    body.rotationPeriod,                       'CT 2.5: Rotational Dynamics');
    if (body.axialTilt   !== undefined) tResult('Axial Tilt',     body.axialTilt,                            'CT 2.5: Rotational Dynamics');
    // Social
    if (body.pop !== undefined) tResult('Population', body.pop,                                              'CT 3.1: Population & Government');
    if (body.gov !== undefined) tResult('Government',  body.gov,                                             'CT 3.1: Population & Government');
    if (body.law !== undefined) tResult('Law Level',   body.law,                                             'CT 3.1: Population & Government');
    const port = body.starport || body.spaceport;
    if (port  !== undefined) tResult('Port',            port,                                                'CT 4.1: Starports & Bases');
    if (body.tl !== undefined) tResult('Tech Level',   body.tl,                                              'CT 3.2: Tech Level & Environment');
    if (body.tradeCodes  !== undefined) tResult('Trade Codes',
        Array.isArray(body.tradeCodes) ? body.tradeCodes.join(' ') : body.tradeCodes,                        'CT 4.1: Starports & Bases');
    if (body.uwp !== undefined) tResult('UWP',          body.uwp,                                            'CT 3.1: Social Finalization');
}

/**
 * PHASE 1: SKELETON GENERATION (System-Wide Logic)
 */
function generateSystemSkeleton() {
    const sys = { stars: [], orbits: [] };

    // --- Steps 2A–2D: Stellar Generation (delegated to CT_StellarEngine) ---
    // Nature roll, primary roll + astrophysical corrections, companion rolls
    // with DM inheritance, orbit placement, and Far sub-companion recursion
    // are all handled centrally. See js/ct_stellar_engine.js.
    if (typeof CT_StellarEngine === 'undefined') {
        throw new Error('CT_StellarEngine not loaded. Ensure ct_stellar_engine.js is included before ct_bottomup_generator.js.');
    }
    const stellarResult = CT_StellarEngine.generateStars({});
    sys.nature = stellarResult.nature;
    sys.stars  = stellarResult.stars;

    // Step 2E & 2F: Max Orbits & Zones
    generateSystemOrbits(sys);

    // Step 2G: Skeleton Placement (GAS GIANTS, BELTS, EMPTY, CAPTURED)
    if (rollSkeleton) {
        const skeleton = rollSkeleton(sys.stars[0]);
        if (skeleton) {
            sys.gasGiant = skeleton.ggs.length > 0;

            // A+B. Resolve anomalies (Empty Orbits + Captured Planets) via engine
            const anomalies = CT_StellarEngine.resolveAnomalies(skeleton, sys.stars);

            // A. Captured Planets — add generator-specific zone, push to array
            sys.capturedPlanets = anomalies.capturedPlanets.map(cap => ({
                ...cap,
                zone: getZoneForOrbit(sys.stars[0].size, sys.stars[0].specKey, Math.floor(cap.orbit))
            }));

            // B. Empty Orbits — place valid ones; log but skip Ghost Empties
            anomalies.emptyOrbits.forEach(({ orbit, type }) => {
                if (type === 'Ghost Empty') return;
                const slot = sys.orbits.find(o => o.orbit === orbit);
                if (slot && !slot.contents) slot.contents = { type: 'Empty' };
            });

            // C. Gas Giants (Normalized H/O Priority)
            const eligibleSlots = sys.orbits.filter(o => ['H', 'O'].includes(o.zone) && !o.contents);
            skeleton.ggs.forEach(gg => {
                let slot;
                if (eligibleSlots.length > 0) {
                    const index = Math.floor(Math.random() * eligibleSlots.length);
                    slot = eligibleSlots.splice(index, 1)[0];
                } else {
                    // Book 6 Failsafe: no eligible slot — create one in the outer zone
                    slot = CT_StellarEngine.spawnFailsafeOrbit(sys.orbits);
                }
                if (slot) {
                    slot.contents = {
                        type: 'Gas Giant',
                        size: gg.size,
                        gravity: (gg.size === 'Large' ? 2.5 : 0.8),
                        mass: (gg.size === 'Large' ? 300 : 50)
                    };
                    tResult(`Orbit ${slot.orbit}`, `${gg.size} Gas Giant`, 'CT 1.3: Orbital Allocation');
                }
            });

            // D. Planetoid Belts (Tiered Proximity Rule)
            const ggInOrbits = sys.orbits.filter(o => o.contents && o.contents.type === 'Gas Giant').map(o => o.orbit);
            
            // Tier 1: Proximity Slots - Exactly one orbit inside a Gas Giant
            let proximitySlots = sys.orbits.filter(o => {
                const isEligible = ['I', 'H', 'O'].includes(o.zone) && !o.contents;
                return isEligible && ggInOrbits.includes(o.orbit + 1);
            });

            // Tier 2: General Slots - All other eligible slots (I, H, O are equal)
            let generalSlots = sys.orbits.filter(o => {
                const isEligible = ['I', 'H', 'O'].includes(o.zone) && !o.contents;
                return isEligible && !proximitySlots.some(p => p.orbit === o.orbit);
            });

            for (let i = 0; i < skeleton.belts; i++) {
                let slot = null;
                if (proximitySlots.length > 0) {
                    const idx = Math.floor(Math.random() * proximitySlots.length);
                    slot = proximitySlots.splice(idx, 1)[0];
                } else if (generalSlots.length > 0) {
                    const idx = Math.floor(Math.random() * generalSlots.length);
                    slot = generalSlots.splice(idx, 1)[0];
                }

                if (slot) {
                    slot.contents = { type: 'Planetoid Belt', size: 0, gravity: 0, temperature: 100 };
                    tResult(`Orbit ${slot.orbit}`, 'Planetoid Belt', 'CT 1.3: Orbital Allocation');
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
 * HELPER: Return maxOrbits for a star.
 * Rolling and clamping are now owned by CT_StellarEngine._rollMaxOrbits.
 * This function is retained for call-site compatibility.
 */
function calculateMaxOrbits(star) {
    return star.maxOrbits || 0;
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
    tSection('Companion Orbit Destruction');
    const beforeDestruction = orbitNumbers.length;
    orbitNumbers = orbitNumbers.filter(o => CT_StellarEngine.isOrbitValid(o, sys.stars));
    const destroyed = beforeDestruction - orbitNumbers.length;
    if (destroyed > 0) tResult('Orbits Destroyed', destroyed, 'CT 1.3: Orbital Allocation');

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

    // Action 6.4: Planet-Centric Biographies — one contiguous block per body
    if (typeof tSection !== 'undefined') tSection('System Biographies');
    walkSystem(sys, (body) => { logCTBodyBiography(body, sys.hexId); });

    // --- PHASE 6: JOURNEY MATH SWEEP (Phase 2 Integration) ---
    if (typeof MgT2EMath !== 'undefined' && MgT2EMath.performJourneyMathSweep) {
        MgT2EMath.performJourneyMathSweep(sys);
    }

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

        // Generate Physicals (Size, Atmo, Hydro)
        if (physicalGen) physicalGen(body, slot.zone);

        // Generate Population (2D-2, No Caps)
        if (popGen) popGen(body);

        // Finalize Derived Physics (Mass, Gravity, OrbitalPeriod, Thermal, Rotation)
        if (derivedPhysicsProcessor) derivedPhysicsProcessor(body, sys.stars[0]);

        // Sean Protocol: Distance and 100D Logging
        if (body.distAU) {
            const orbitMkm = (body.distAU * 149597870) / 1000000;
            tResult("Orbit Distance", `${body.distAU.toFixed(2)} AU (${orbitMkm.toFixed(1)} M km)`, 'CT 1.3: Zone Classification');

            const worldSize = (typeof body.size === 'string') ? UniversalMath.fromUWPChar(body.size) : (body.size || 0);
            const world100D = (worldSize * 160000) / 1000000;
            tResult("World 100D Limit", `${world100D.toFixed(2)} M km`, 'CT 1.3: Zone Classification');

            // Stellar Masking Eligibility
            if (typeof UniversalMath !== 'undefined' && UniversalMath.isMaskingEligible) {
                const isEligible = UniversalMath.isMaskingEligible(sys.stars[0].diam, body.distAU, worldSize);
                tResult("Stellar Masking", isEligible ? "ELIGIBLE" : "Ineligible", 'CT 1.3: Zone Classification');
            }
        }
    });

    // 2. Captured Planets Pass
    if (sys.capturedPlanets) {
        sys.capturedPlanets.forEach((p, idx) => {
            tSection(`Captured Planet ${idx + 1} - Orbit ${p.orbit}`);
            if (physicalGen) physicalGen(p, p.zone);
            if (popGen) popGen(p);

            p.distAU = orbitalAU[Math.min(Math.floor(p.orbit), orbitalAU.length - 1)] || 1.0;
            if (derivedPhysicsProcessor) derivedPhysicsProcessor(p, sys.stars[0]);

            // Sean Protocol: Distance and 100D Logging
            if (p.distAU) {
                const orbitMkm = (p.distAU * 149597870) / 1000000;
                tResult("Orbit Distance", `${p.distAU.toFixed(2)} AU (${orbitMkm.toFixed(1)} M km)`, 'CT 1.3: Zone Classification');

                const worldSize = (typeof p.size === 'string') ? UniversalMath.fromUWPChar(p.size) : (p.size || 0);
                const world100D = (worldSize * 160000) / 1000000;
                tResult("World 100D Limit", `${world100D.toFixed(2)} M km`, 'CT 1.3: Zone Classification');

                // Stellar Masking Eligibility
                if (typeof UniversalMath !== 'undefined' && UniversalMath.isMaskingEligible) {
                    const isEligible = UniversalMath.isMaskingEligible(sys.stars[0].diam, p.distAU, worldSize);
                    tResult("Stellar Masking", isEligible ? "ELIGIBLE" : "Ineligible", 'CT 1.3: Zone Classification');
                }
            }
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
                    if (derivedPhysicsProcessor) derivedPhysicsProcessor(sat, sys.stars[0]);
                }

                parent.satellites.push(sat);
                tResult(`Satellite ${i+1}`, `${finalSize} ${finalType}`, 'CT 1.3: Satellite Hierarchy');
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

        tResult('Final UWP', body.uwp, 'CT 3.1: Social Finalization');
    });

    sys.state = 'Complete';
    tSection('System Generation Finished');
    tResult('Final State', sys.state, 'CT 3.1: Social Finalization');

    return sys;
}

/**
 * PHASE 4: MAINWORLD DESIGNATION (Step 7)
 */
function processBottomUpDesignation(sys) {
    tSection('Step 7: Mainworld Designation');
    
    // Task 4 Critical: Fixed Anchor Check
    if (sys.mainworld) {
        tResult('Fixed Anchor', 'Using pre-designated Mainworld (Top-Down mode)', 'CT 3.1: Social Finalization');
        const winner = sys.mainworld;
        // Role Designation (Ensure it is marked as Mainworld)
        winner.type = 'Mainworld';

        // Generate Social ONLY if missing (manual or incomplete anchor)
        if (socialGen && !winner.uwp) socialGen(winner);

        tResult('Final Mainworld UWP', winner.uwp, 'CT 3.1: Social Finalization');
        return sys;
    }

    const winner = designateMainworld(sys);
    sys.mainworld = winner;

    if (winner) {
        tResult('Designated Mainworld', `${winner.type} at Orbit ${winner.orbit}`, 'CT 3.1: Social Finalization');
        // Role Designation
        winner.type = 'Mainworld';

        // SEAN PROTOCOL: Moon-Mainworld Selection Logging
        if (winner.isMoon || winner.isSatellite) {
            winner.isLunarMainworld = true;
            winner.parentBody = winner.parentType || 'Gas Giant';
            tResult('Mainworld Status', 'LUNAR SELECTION', 'CT 1.3: Satellite Hierarchy');
            writeLogLine(`[MAINWORLD LOG] Hex ${sys.hexId}: Mainworld is a MOON at Orbit ${winner.orbit}`);
        }

        // Generate Social (Starport, Gov, Law, TL, Trade)
        if (socialGen) socialGen(winner);

        // Map Gas Giant presence from system to mainworld for UI renderer
        winner.gasGiant = sys.gasGiant;

        tResult('Final Mainworld UWP', winner.uwp, 'CT 3.1: Social Finalization');
    } else {
        tResult('Designated Mainworld', 'NONE (Empty System)', 'CT 3.1: Social Finalization');
        // Action 6.3: Audit Backlog — empty system is a RAW edge case worth tracking
        if (typeof window !== 'undefined') {
            window.auditBacklog = window.auditBacklog || [];
            window.auditBacklog.push({ hexId: sys.hexId || 'unknown', orbitId: null, engine: 'CT', message: 'No viable mainworld candidate found — system is empty' });
        }
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
        walkSystem,
        logCTBodyBiography
    };
} else {
    window.generateSystemSkeleton = generateSystemSkeleton;
    window.processBottomUpSocial = processBottomUpSocial;
    window.processBottomUpSatellites = processBottomUpSatellites;
    window.processBottomUpDesignation = processBottomUpDesignation;
    window.processBottomUpSubordinates = processBottomUpSubordinates;
    window.walkSystem = walkSystem;
    window.logCTBodyBiography = logCTBodyBiography;
}
