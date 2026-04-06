// =====================================================================
// CLASSIC TRAVELLER: MODULAR TOP-DOWN GENERATOR
// =====================================================================

// Browser-safe imports
// Stellar table variables (natureTable, priTypeTable, priSizeTable, compTypeTable,
// compSizeTable) are now owned exclusively by CT_StellarEngine.
var orbitalAU, luminosityTable, starMassTable, zoneTables, satOrbitsTable, placementPriorities, rollSkeleton;
var physicalGen, popGen, mainworldSocialFin, subordinateSocialFin, tradeCodesGen;
var thermalStatsGetter, rotationStatsGetter, satelliteGenerator, systemWalker, processSubordinates, derivedPhysicsProcessor;

if (typeof module !== 'undefined' && module.exports) {
    const constants = require('./ct_constants');
    orbitalAU = constants.ORBIT_AU;
    luminosityTable = constants.LUM;
    starMassTable = constants.STAR_MASS;
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
    derivedPhysicsProcessor = physLib.processCTDerivedPhysics;
} else {
    // In browser, these are globals or on window namespaces
    // Note: stellar tables (priTypeTable, compTypeTable, etc.) are resolved
    // internally by CT_StellarEngine and are not needed here.
    orbitalAU = typeof ORBIT_AU !== 'undefined' ? ORBIT_AU : [];
    luminosityTable = typeof LUM !== 'undefined' ? LUM : {};
    starMassTable = typeof STAR_MASS !== 'undefined' ? STAR_MASS : {};
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
    derivedPhysicsProcessor = typeof processCTDerivedPhysics !== 'undefined' ? processCTDerivedPhysics : null;
}

/**
 * TOP-DOWN GENERATION
 * Starts with a pre-defined Mainworld and builds a system around it.
 * Placement Order: GGs -> Belts -> Anomalies -> Mainworld
 */
function generateTopDownSystem(mainworldUWP, primaryStar = null) {
    tSection('Primary Star Generation');

    // --- Steps 2A–2D: Stellar Generation (delegated to CT_StellarEngine) ---
    // Handles manual override parsing, the forceSizeV HZ-guarantee loop,
    // astrophysical corrections, companion DM inheritance, orbit placement,
    // and Far sub-companion recursion. See js/ct_stellar_engine.js.
    if (typeof CT_StellarEngine === 'undefined') {
        throw new Error('CT_StellarEngine not loaded. Ensure ct_stellar_engine.js is included before ct_topdown_generator.js.');
    }

    // If a primaryStar was passed in (e.g. from a test harness), skip stellar gen.
    let stellarStars;
    let sysNature;
    if (primaryStar) {
        // Caller supplied a pre-built primary — wrap it as-is, treat as Solo.
        stellarStars = [primaryStar];
        sysNature = 'Solo';
        tResult('Primary Override', `${primaryStar.name} (pre-supplied)`, 'CT 1.1: Stellar Generation');
    } else {
        const stellarResult = CT_StellarEngine.generateStars({
            forceSizeV:      true,
            manualOverrides: (mainworldUWP && mainworldUWP.homestar) ? mainworldUWP.homestar : null
        });
        stellarStars = stellarResult.stars;
        sysNature    = stellarResult.nature;
        primaryStar  = stellarStars[0];
    }

    // Top-Down also needs a maxOrbits count for the primary (not part of stellar gen).
    if (!primaryStar.maxOrbits) {
        primaryStar.maxOrbits = tRoll2D('Primary Max Orbits');
    }

    // 2. Identify the Habitable Zone (Target Orbit)
    let lookupSize = primaryStar.size;
    if (typeof zoneTables !== 'undefined' && !zoneTables[lookupSize]) lookupSize = 'V';

    let zones = (typeof zoneTables !== 'undefined' && zoneTables[lookupSize] && zoneTables[lookupSize][primaryStar.specKey])
        ? zoneTables[lookupSize][primaryStar.specKey]
        : ['I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'];

    const hOrbits = zones.reduce((acc, z, idx) => (z === 'H' ? acc.concat(idx) : acc), []);
    let targetOrbit = hOrbits.length > 0 ? hOrbits[Math.floor(Math.random() * hOrbits.length)] : 2;
    tResult('Ideal Habitable Orbit', targetOrbit, 'CT 1.3: Zone Classification');

    const sys = {
        nature:    sysNature,
        stars:     stellarStars,
        maxOrbits: Math.max(primaryStar.maxOrbits, targetOrbit),
        orbits:    []
    };

    tResult('System Nature', sys.nature, 'CT 1.1: System Nature');
    tResult('Baseline Orbits', sys.maxOrbits, 'CT 1.3: Orbital Allocation');

    // 3. System-Wide Feature Skeleton
    const skeleton = (rollSkeleton) ? rollSkeleton(primaryStar, mainworldUWP.gasGiant) : { ggs: [], belts: 0, emptyOrbits: [], capturedPlanets: [] };
    const totalBelts = Math.min(skeleton.belts, sys.maxOrbits);

    // 4. Initialize Orbits
    for (let i = 0; i <= sys.maxOrbits; i++) {
        sys.orbits.push({
            orbit: i,
            zone: zones[i] || 'O',
            contents: null
        });
    }

    // 4b. Companion Orbit Destruction (Book 6 inner/outer rules)
    if (typeof CT_StellarEngine !== 'undefined') {
        const beforeDestruction = sys.orbits.length;
        sys.orbits = sys.orbits.filter(o => CT_StellarEngine.isOrbitValid(o.orbit, sys.stars));
        const destroyed = beforeDestruction - sys.orbits.length;
        if (destroyed > 0 && typeof tResult !== 'undefined') tResult('Orbits Destroyed', destroyed, 'CT 1.3: Orbital Allocation');
    }

    // 5. PLACEMENT ORCHESTRATION (Rule Compliant Order)

    // Determine if Mainworld needs the HZ spot
    const mwAtm = (mainworldUWP.atm !== undefined) ? mainworldUWP.atm : 0;
    const mwSize = (mainworldUWP.size !== undefined) ? mainworldUWP.size : 0;
    const isAsteroidMW = (mwSize === 0);
    const mainworldNeedsHZ = (!isAsteroidMW && ![0, 1, 10, 11, 12, 13, 14, 15].includes(mwAtm));

    // 5a. Gas Giant Placement (First) - Normalized H/O Priority
    const eligibleSlots = sys.orbits.filter(o => ['H', 'O'].includes(o.zone) && !o.contents);
    skeleton.ggs.forEach(gg => {
        let slot;
        if (eligibleSlots.length > 0) {
            const index = Math.floor(Math.random() * eligibleSlots.length);
            slot = eligibleSlots.splice(index, 1)[0];
        } else if (typeof CT_StellarEngine !== 'undefined') {
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
        }
    });

    // 5b. Planetoid Belt Placement (Second) - Tiered Proximity Rule
    let beltsToPlace = totalBelts;
    if (isAsteroidMW) beltsToPlace = Math.max(0, beltsToPlace - 1); // Mainworld will be placed in Step 5d

    const ggOrbits = sys.orbits.filter(o => o.contents && o.contents.type === 'Gas Giant').map(o => o.orbit);
    
    // Tier 1: Proximity Slots - Exactly one orbit inside a Gas Giant
    let proximitySlots = sys.orbits.filter(o => {
        const isEligible = ['I', 'H', 'O'].includes(o.zone) && !o.contents;
        const isNearGG = ggOrbits.includes(o.orbit + 1);
        const isNotTarget = (!mainworldNeedsHZ || o.orbit !== targetOrbit);
        return isEligible && isNearGG && isNotTarget;
    });

    // Tier 2: General Slots - All other eligible slots (I, H, O are equal)
    let generalSlots = sys.orbits.filter(o => {
        const isEligible = ['I', 'H', 'O'].includes(o.zone) && !o.contents;
        const isNotTarget = (!mainworldNeedsHZ || o.orbit !== targetOrbit);
        return isEligible && isNotTarget && !proximitySlots.some(p => p.orbit === o.orbit);
    });

    for (let i = 0; i < beltsToPlace; i++) {
        let slot = null;
        if (proximitySlots.length > 0) {
            const index = Math.floor(Math.random() * proximitySlots.length);
            slot = proximitySlots.splice(index, 1)[0];
        } else if (generalSlots.length > 0) {
            const index = Math.floor(Math.random() * generalSlots.length);
            slot = generalSlots.splice(index, 1)[0];
        }
        
        if (slot) {
            slot.contents = { type: 'Planetoid Belt', size: 0, gravity: 0, temperature: 100 };
        }
    }

    // 5c. Anomaly Placement (Third) — resolved via engine
    const anomalies = (typeof CT_StellarEngine !== 'undefined')
        ? CT_StellarEngine.resolveAnomalies(skeleton, sys.stars)
        : { emptyOrbits: skeleton.emptyOrbits.map(o => ({ orbit: o, type: 'Empty' })), capturedPlanets: skeleton.capturedPlanets.map(c => ({ ...c, type: 'Captured' })) };

    anomalies.emptyOrbits.forEach(({ orbit, type }) => {
        if (type === 'Ghost Empty') return;
        const slot = sys.orbits.find(o => o.orbit === orbit);
        if (slot && !slot.contents && (!mainworldNeedsHZ || slot.orbit !== targetOrbit)) {
            slot.contents = { type: 'Empty' };
        } else if (slot) {
            tSkip(`Orbit ${orbit} (Occupied or HZ Slot)`);
        }
    });

    sys.capturedPlanets = anomalies.capturedPlanets.map(cap => ({
        ...cap,
        zone: zones[Math.floor(cap.orbit)] || 'O'
    }));
    sys.capturedPlanets.forEach((p, i) => {
        tResult(`Captured Planet ${i + 1}`, `Orbit ${p.orbit} (Zone ${p.zone})`, 'CT 1.3: Orbital Allocation');
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
        let slot = sys.orbits.find(o => o.orbit === targetOrbit);

        // HZ Displacement: if companion destruction removed the target orbit, find the closest survivor
        if (!slot) {
            let closest = null;
            let closestDist = Infinity;
            for (const o of sys.orbits) {
                const canDisplace = !o.contents || o.contents.type === 'Gas Giant';
                if (!canDisplace) continue;
                const dist = Math.abs(o.orbit - targetOrbit);
                if (dist < closestDist) { closestDist = dist; closest = o; }
            }
            slot = closest;
            if (slot) {
                targetOrbit = slot.orbit;
                tResult('HZ Destroyed', 'Mainworld displaced to Orbit ' + targetOrbit + ' (Referee Discretion)', 'CT 1.3: Zone Classification');
                // Climate Deviation Exception: temperate-classified world in a non-HZ orbit is
                // an intentional Book 6 edge-case, not a math bug. Flag for the universal Auditor.
                tResult('Climate Deviation Exception', 'Extreme Greenhouse/Albedo', 'CT 1.3: RAW Edge-Case');
                if (typeof window !== 'undefined') {
                    window.auditBacklog = window.auditBacklog || [];
                    window.auditBacklog.push({ hexId: sys.hexId || 'unknown', orbitId: targetOrbit, engine: 'CT', message: 'HZ destroyed by companion; mainworld displaced to Orbit ' + targetOrbit + ' — Climate Deviation Exception active' });
                }
            }
        }

        if (slot && slot.contents && slot.contents.type === 'Gas Giant') {
            // Satellite logic
            if (!slot.contents.satellites) slot.contents.satellites = [];
            slot.contents.satellites.push(mainworld);

            mainworld.isSatellite = true;
            mainworld.isMoon = true; // Extra flag for robustness
            mainworld.isLunarMainworld = true;
            mainworld.parentBody = 'Gas Giant';
            mainworld.parentType = 'Gas Giant';

            // --- NEW LOGGING CODE ---
            if (typeof tResult !== 'undefined') tResult('Mainworld Status', 'LUNAR SELECTION', 'CT 1.3: Satellite Hierarchy');
            if (typeof writeLogLine !== 'undefined') writeLogLine(`[MAINWORLD LOG]: Mainworld placed as a MOON of Gas Giant at Orbit ${targetOrbit}`);
            // ------------------------

            mainworld.orbit = targetOrbit;
            mainworld.zone = 'H';
            mainworld.distAU = orbitalAU[Math.min(targetOrbit, orbitalAU.length - 1)] || 1.0;

            // Assign a planetary distance (radii) for the UI, using a 'Close' orbit by default for Mainworlds
            if (satOrbitsTable && satOrbitsTable.Close) {
                const roll = tRoll2D('Mainworld Satellite Orbit Roll');
                const distIdx = Math.min(roll, satOrbitsTable.Close.length - 1);
                mainworld.pd = satOrbitsTable.Close[distIdx] || 10;
                tResult('Mainworld Distance', `${mainworld.pd}r`, 'CT 1.3: Satellite Hierarchy');
            } else {
                mainworld.pd = 10;
                tResult('Mainworld Distance', '10r (default)', 'CT 1.3: Satellite Hierarchy');
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
                if (derivedPhysicsProcessor) derivedPhysicsProcessor(body, primaryStar);
                return;
            }

            if (['Terrestrial Planet', 'Captured Planet'].includes(body.type)) {
                if (physicalGen) physicalGen(body, body.zone);
            }

            if (derivedPhysicsProcessor) derivedPhysicsProcessor(body, primaryStar);

            // Sync AU and orbital period for all base bodies
            if (body.distAU) {
                // Sean Protocol: Distance and 100D Logging
                const orbitMkm = (body.distAU * 149597870) / 1000000;
                tResult("Orbit Distance", `${body.distAU.toFixed(2)} AU (${orbitMkm.toFixed(1)} M km)`, 'CT 1.3: Zone Classification');

                const worldSize = (typeof body.size === 'string') ? UniversalMath.fromUWPChar(body.size) : (body.size || 0);
                const world100D = (worldSize * 160000) / 1000000;
                tResult("World 100D Limit", `${world100D.toFixed(2)} M km`, 'CT 1.3: Zone Classification');

                // Stellar Masking Eligibility
                if (typeof UniversalMath !== 'undefined' && UniversalMath.isMaskingEligible) {
                    const isEligible = UniversalMath.isMaskingEligible(primaryStar.diam, body.distAU, worldSize);
                    tResult("Stellar Masking", isEligible ? "ELIGIBLE" : "Ineligible", 'CT 1.3: Zone Classification');
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

            if (derivedPhysicsProcessor) derivedPhysicsProcessor(body, primaryStar);
        });

        // Pass 3: Social Sweeping (Task 3 Mirroring)
        systemWalker(sys, (body) => {
            if (body.type === 'Mainworld') {
                if (tradeCodesGen) {
                    body.tradeCodes = tradeCodesGen(body);
                    // Sean Protocol: Explicitly log the final codes to verify Sa flag
                    if (typeof tResult !== 'undefined' && (body.isMoon || body.isSatellite)) {
                        tResult('Final Lunar Trade Codes', body.tradeCodes.join(' '), 'CT 4.1: Starports & Bases');
                    }
                }
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

        // --- PHASE 8: JOURNEY MATH SWEEP (Phase 2 Integration) ---
        if (typeof MgT2EMath !== 'undefined' && MgT2EMath.performJourneyMathSweep) {
            MgT2EMath.performJourneyMathSweep(sys);
        }

        // Action 6.4: Planet-Centric Biographies — one contiguous block per body
        if (typeof logCTBodyBiography !== 'undefined' && typeof tSection !== 'undefined') {
            tSection('System Biographies');
            systemWalker(sys, (body) => { logCTBodyBiography(body, sys.hexId); });
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
