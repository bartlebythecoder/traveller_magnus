/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: AoW Bottom-Up Generator (Orchestrator)
 * Description: Master controller for Architect of Worlds bottom-up system generation.
 * Following the "Sean Protocol": Zero Logic, Pure Orchestration, Trace Logging.
 *
 * Architectural Constraint: This module contains ZERO generation logic.
 * It only manages state and calls engine functions in the correct sequence.
 *
 * Data source: rules/aow_data.js (read-only)
 * Engines: aow_stellar_engine.js | aow_world_engine.js | aow_socio_engine.js | aow_uwp_auditor.js
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./aow_stellar_engine', './aow_world_engine', './aow_socio_engine', './aow_uwp_auditor'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./aow_stellar_engine'),
            require('./aow_world_engine'),
            require('./aow_socio_engine'),
            require('./aow_uwp_auditor')
        );
    } else {
        root.AoWBottomUpGenerator = factory(
            root.AoWStellarEngine,
            root.AoWWorldEngine,
            root.MgT2ESocioEngine,   // AoW uses MgT2E socioeconomics by design
            root.AoW_UWP_Auditor
        );
    }
}(typeof self !== 'undefined' ? self : this, function (StellarEngine, WorldEngine, SocioEngine, Auditor) {
    'use strict';

    if (!StellarEngine || !WorldEngine || !SocioEngine) {
        console.error("AoWBottomUpGenerator DI Failure: Critical engines missing!", { StellarEngine, WorldEngine, SocioEngine });
    }


    /**
     * Main AoW Bottom-Up Generation Orchestrator.
     * Executes the complete pipeline for system generation per Architect of Worlds rules.
     *
     * @param {string} hexId - The hex identifier for this system
     * @param {Object} [seedSys=null] - Optional seed from the System Editor. When null,
     *   generation is fully stochastic (all existing macro calls). When provided:
     *   - seedSys.stars: star objects to use instead of rolling
     *   - seedSys.worlds: body objects to use instead of disk/orbital generation
     *   - seedSys._allowAddBodies: when false, disk/orbital phases are skipped
     *   - seedSys._mainworldRef: _id of the body to designate as mainworld
     * @returns {Object} sys - The fully populated system object
     */
    function generateAoWSystemBottomUp(hexId, seedSys = null) {

        // =================================================================
        // INITIALIZATION
        // =================================================================

        if (typeof startTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            startTrace(hexId, 'AoW Bottom-Up System');
        }

        if (typeof reseedForHex === 'function') {
            reseedForHex(hexId);
        }
        window._currentSystemHasPop = (typeof shouldGeneratePopulation === 'function') ? shouldGeneratePopulation(hexId) : true;

        if (window.isLoggingEnabled) {
            writeLogLine(`\n${'═'.repeat(72)}`);
            writeLogLine(`  HEX: ${hexId}  —  AoW Bottom-Up Generation`);
            writeLogLine(`${'═'.repeat(72)}`);
        }

        // Base system object — seed from seedSys if provided, otherwise start fresh
        const sys = seedSys ? {
            hexId:              hexId,
            worlds:             (seedSys.worlds || []).map(b => Object.assign({}, b)),
            stars:              (seedSys.stars  || []).map(s => Object.assign({}, s)),
            age:                seedSys.age  || 0,
            hzco:               seedSys.hzco || 0,
            gasGiants:          0,
            planetoidBelts:     0,
            terrestrialPlanets: 0,
            totalWorlds:        0,
            forbiddenZones:     []
        } : {
            hexId:              hexId,
            worlds:             [],
            stars:              [],
            age:                0,
            hzco:               0,
            gasGiants:          0,
            planetoidBelts:     0,
            terrestrialPlanets: 0,
            totalWorlds:        0,
            forbiddenZones:     []
        };

        // =================================================================
        // PHASE 1: STELLAR GENERATION
        // =================================================================
        // Chunk 1 (Steps 1–3) — Primary star category, mass, multiplicity, hierarchy.
        // Chunk 2 (Steps 4–7) — Age, metallicity, stellar evolution, classification.
        // Chunk 3 (Step 8)    — Stellar orbital parameters (skipped for Singletons).

        tSection(`[${hexId}] Phase 1: Stellar Generation`);

        if (seedSys && sys.stars.length > 0) {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 1: Stellar skipped — seed provides ${sys.stars.length} star(s).`);
        } else {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 1: Chunk 1 — Star Hierarchy & Masses...`);

            // Chunk 1: System Hierarchy and Masses (Steps 1–3)
            if (StellarEngine && StellarEngine.generateStarHierarchyAndMasses) {
                StellarEngine.generateStarHierarchyAndMasses(sys, { forceEarthlike: false });
            }

            // Chunk 2: Age, Metallicity, and Stellar Evolution (Steps 4–7)
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 1: Chunk 2 — Age, Metallicity, Evolution... (Hierarchy: ${sys.hierarchy}, Stars: ${sys.stars.length})`);
            if (StellarEngine && StellarEngine.generateAgeMetallicityAndEvolution) {
                StellarEngine.generateAgeMetallicityAndEvolution(sys, { forceEarthlike: false });
            }

            // Chunk 3: Stellar Orbital Parameters (Step 8) — skipped for Singletons
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 1: Chunk 3 — Stellar Orbits... (Age: ${sys.systemAge} Gyr, Metallicity: ${sys.systemMetallicity})`);
            if (StellarEngine && StellarEngine.generateStellarOrbits) {
                StellarEngine.generateStellarOrbits(sys);
            }

            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 1 complete. Hierarchy: ${sys.hierarchy} | Stars: ${sys.stars.length} | Orbits: ${(sys.orbits || []).length} | Classifications: ${sys.stars.map(s => s.spectralClassification).join(', ')}`);
        }

        // =================================================================
        // PHASE 2: SYSTEM STRUCTURE
        // =================================================================
        // AoW Step 5 — Determine system structure (forbidden zones, habitable zone).
        // AoW Step 6 — Generate system inventory (GG count, belts, terrestrials).
        // AoW Step 7 — Allocate orbital slots.

        tSection(`[${hexId}] Phase 2: System Structure`);
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 2: System Structure...`);

        // Chunk 4 (Steps 9–12): Protoplanetary disk worksheets + planet placement
        // Skip if seedSys controls body count (worlds already in sys.worlds)
        if (!seedSys || seedSys._allowAddBodies) {
            if (WorldEngine && WorldEngine.generatePlanetaryDisks) {
                WorldEngine.generatePlanetaryDisks(sys);
            }
        } else {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 2: Disk/orbital skipped — seed provides ${sys.worlds.length} world(s).`);
        }

        if (!seedSys || seedSys._allowAddBodies) {
            if (window.isLoggingEnabled) {
                const totalPlanets = (sys.diskWorksheets || []).reduce((sum, ws) =>
                    sum + ws.diskInstabilityPlanets.length + ws.coreAccretionPlanets.length + ws.oligarchicCollisionPlanets.length, 0);
                writeLogLine(`[PROBE] AoW Chunk 4 complete. Worksheets: ${(sys.diskWorksheets || []).length} | Total planets placed: ${totalPlanets}`);
            }

            // Chunk 5 (Steps 13–15): Orbital radii, planetary mass, orbital eccentricity
            if (WorldEngine && WorldEngine.generateOrbitalDynamics) {
                WorldEngine.generateOrbitalDynamics(sys);
            }

            if (window.isLoggingEnabled) {
                const totalWithDynamics = (sys.diskWorksheets || []).reduce((sum, ws) => sum + (ws.planets ? ws.planets.length : 0), 0);
                writeLogLine(`[PROBE] AoW Phase 2 complete. Planets with orbital dynamics: ${totalWithDynamics}`);
            }
        }

        // TODO: StellarEngine.generateHabitableZone(sys)
        // TODO: StellarEngine.generateSystemInventory(sys)

        // =================================================================
        // PHASE 3: WORLD FORMATION
        // =================================================================
        // AoW Step 8 — Generate physical properties for all world bodies.
        // AoW Step 9 — Generate atmospherics for candidate worlds.
        // AoW Step 10 — Generate hydrographics and surface temperature.
        // AoW Step 11 — Generate biospheric potential.

        tSection(`[${hexId}] Phase 3: World Formation`);

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Physicals...`);
        const _seededMoonCaps = (seedSys && !seedSys._allowAddBodies)
            ? sys.worlds.map(w => (w.moons || []).length)
            : null;

        if (WorldEngine && WorldEngine.generatePhysicals) {
            WorldEngine.generatePhysicals(sys);
        }

        if (_seededMoonCaps) {
            sys.worlds.forEach((w, i) => {
                const cap = _seededMoonCaps[i] ?? 0;
                if (w.moons && w.moons.length > cap) w.moons = w.moons.slice(0, cap);
            });
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Orbital Conditions...`);
        if (WorldEngine && WorldEngine.generateOrbitalConditions) {
            WorldEngine.generateOrbitalConditions(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Thermal & Water...`);
        if (WorldEngine && WorldEngine.generateThermalAndWater) {
            WorldEngine.generateThermalAndWater(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Geophysics...`);
        if (WorldEngine && WorldEngine.generateGeophysics) {
            WorldEngine.generateGeophysics(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Magnetic Field...`);
        if (WorldEngine && WorldEngine.generateMagneticField) {
            WorldEngine.generateMagneticField(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Early Atmosphere...`);
        if (WorldEngine && WorldEngine.generateEarlyAtmosphere) {
            WorldEngine.generateEarlyAtmosphere(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Albedo...`);
        if (WorldEngine && WorldEngine.generateAlbedo) {
            WorldEngine.generateAlbedo(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Carbon Dioxide...`);
        if (WorldEngine && WorldEngine.generateCarbonDioxide) {
            WorldEngine.generateCarbonDioxide(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Presence of Life...`);
        if (WorldEngine && WorldEngine.generatePresenceOfLife) {
            WorldEngine.generatePresenceOfLife(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Average Surface Temperature...`);
        if (WorldEngine && WorldEngine.generateAverageSurfaceTemp) {
            WorldEngine.generateAverageSurfaceTemp(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Finalize Atmosphere...`);
        if (WorldEngine && WorldEngine.generateFinalizeAtmosphere) {
            WorldEngine.generateFinalizeAtmosphere(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: Habitability Scores...`);
        if (WorldEngine && WorldEngine.generateHabitabilityScores) {
            WorldEngine.generateHabitabilityScores(sys);
        }

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 3: UWP Physicals...`);
        if (WorldEngine && WorldEngine.generateUWPPhysicals) {
            WorldEngine.generateUWPPhysicals(sys);
        }
        // TODO: WorldEngine.generateAtmospherics(sys)
        // TODO: WorldEngine.generateHydrographics(sys)
        // TODO: WorldEngine.generateBiospherics(sys)

        // =================================================================
        // PHASE 4: MAINWORLD SELECTION (CROWNING)
        // =================================================================
        // AoW Step 12 — Evaluate candidates and elect the Mainworld.

        tSection(`[${hexId}] Phase 4: Mainworld Selection`);
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 4: Mainworld Selection...`);

        let mainworld = null;

        // If seedSys designates a mainworld, find it by _id; otherwise run normal election
        if (seedSys && seedSys._mainworldRef) {
            mainworld = sys.worlds.find(w => w._id === seedSys._mainworldRef);
            if (!mainworld) {
                for (const w of sys.worlds) {
                    const moon = (w.moons || w.satellites || []).find(m => m._id === seedSys._mainworldRef);
                    if (moon) { mainworld = moon; break; }
                }
            }
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 4: Mainworld from seed ref: ${mainworld ? mainworld._id : 'NOT FOUND'}`);
        }
        if (!mainworld && WorldEngine && WorldEngine.generateMainworldSelection) {
            mainworld = WorldEngine.generateMainworldSelection(sys);
        }

        if (mainworld) {
            const orbitLabel = mainworld.orbitId !== undefined ? mainworld.orbitId.toFixed(2) : 'N/A';
            const scoreLabel = mainworld.habitabilityScore ?? mainworld.habitability ?? 'N/A';
            tResult('Winning Mainworld', `${mainworld.name || 'Body'} at Orbit ${orbitLabel} [Score: ${scoreLabel}]`, 'AoW: Mainworld Selection');
        } else {
            // No planets formed (disk formation produced nothing — Brown Dwarf, failed disk, etc.).
            // Synthesize a barren placeholder so sys.mainworld is never null.
            mainworld = {
                label:           'Barren System',
                isBarrenSystem:  true,
                type:            'Mainworld',
                atmCode:         0,
                hydroCode:       0,
                size:            0,
                sizeCode:        '0',
                atmosphereCode:  '0',
                habitability:    0
            };
            sys.mainworld = mainworld;
            tResult('Winning Mainworld', 'None — barren system placeholder used (no planets formed)', 'AoW: Mainworld Selection');
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 4: barren system — no disk planets`);
        }

        // Build sys.worlds[] from diskWorksheets after mainworld is elected.
        // Skip if seedSys already provides worlds (they're already in sys.worlds).
        if (!seedSys || seedSys._allowAddBodies) {
            if (WorldEngine && WorldEngine.populateAoWWorldsList) {
                WorldEngine.populateAoWWorldsList(sys);
            }
        }

        // =================================================================
        // PHASE 5: SOCIAL SWEEPS
        // =================================================================
        // AoW Step 13 — Generate Mainworld UWP from physical characteristics.
        // AoW Step 14 — Generate extended socioeconomics if populated.
        // AoW Step 15 — Finalize subordinate world social profiles.

        tSection(`[${hexId}] Phase 5: Social Sweeps`);

        if (SocioEngine && sys.mainworld && !sys.mainworld.isBarrenSystem) {
            // Step 1: Generate full mainworld UWP (Pop/Gov/Law/TL/Starport/Trade Codes).
            // generateMainworldUWP detects world.size !== undefined and uses our pre-set
            // physical integers (size, atmCode, hydroCode) rather than re-rolling physicals.
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 5: Mainworld UWP...`);
            if (SocioEngine.generateMainworldUWP) {
                SocioEngine.generateMainworldUWP(hexId, sys.mainworld);
            }

            // Step 2: Core social sweep over all worlds in sys.worlds.
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 5: Core Social...`);
            if (SocioEngine.generateCoreSocial) {
                SocioEngine.generateCoreSocial(sys, sys.mainworld);
            }

            // Step 3: Extended socioeconomics for populated mainworlds.
            if (sys.mainworld.pop > 0) {
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 5: Extended Socio (pop=${sys.mainworld.pop})...`);
                if (SocioEngine.generateExtendedSocioeconomics) {
                    SocioEngine.generateExtendedSocioeconomics(sys, sys.mainworld);
                }
            } else {
                if (typeof tSkip === 'function') {
                    tSkip('Population 0: Bypassing Extended Socioeconomics');
                }
            }

            // Step 4: Subordinate social finalization.
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 5: Finalizing Subordinates...`);
            if (SocioEngine.finalizeSubordinateSocial) {
                SocioEngine.finalizeSubordinateSocial(sys, sys.mainworld);
            }
        }

        // =================================================================
        // PHASE 6: FINALIZATION & AUDIT
        // =================================================================

        tSection(`[${hexId}] Phase 6: Finalization & Audit`);

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] AoW Phase 6: Orbital Naming...`);
        applyMgT2EOrbitalNames(sys);

        const activeAuditor = Auditor || (typeof AoW_UWP_Auditor !== 'undefined' ? AoW_UWP_Auditor : null);
        if (activeAuditor) {
            const auditResults = activeAuditor.auditAoWSystem(sys, { mode: 'bottom-up' });
            if (!auditResults.pass) {
                const errorSummary = auditResults.errors.map(e => `  • ${e.message}`).join('\n');
                console.warn(`[AoW Auditor] System ${hexId} — ${auditResults.errors.length} violation(s):\n${errorSummary}`);

                if (typeof window !== 'undefined') {
                    window.auditBacklog = window.auditBacklog || [];
                    auditResults.errors.forEach(err => {
                        window.auditBacklog.push({
                            hexId: hexId,
                            orbitId: err.orbitId !== undefined ? err.orbitId : null,
                            engine: "AoW",
                            message: err.message || err
                        });
                    });
                }
            }
        }

        if (typeof endTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            endTrace();
        }

        return sys;
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    if (typeof window !== 'undefined') {
        window.generateAoWSystemBottomUp = generateAoWSystemBottomUp;
    }

    return {
        generateSystem: generateAoWSystemBottomUp,
        generateAoWSystemBottomUp: generateAoWSystemBottomUp
    };
}));
