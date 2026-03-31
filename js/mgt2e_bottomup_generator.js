/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: MgT2E Bottom-Up Generator (Orchestrator)
 * Description: Master controller for Mongoose Traveller 2E bottom-up system generation.
 * Following the "Sean Protocol": Zero Logic, Pure Orchestration, Trace Logging.
 * 
 * Architectural Constraint: This module contains ZERO generation logic.
 * It only manages state and calls engine functions in the correct sequence.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./mgt2e_stellar_engine', './mgt2e_world_engine', './mgt2e_socio_engine', './mgt2e_uwp_auditor'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./mgt2e_stellar_engine'),
            require('./mgt2e_world_engine'),
            require('./mgt2e_socio_engine'),
            require('./mgt2e_uwp_auditor')
        );
    } else {
        root.MgT2EBottomUpGenerator = factory(
            root.MgT2EStellarEngine,
            root.MgT2EWorldEngine,
            root.MgT2ESocioEngine,
            root.MgT2E_UWP_Auditor
        );
    }
}(typeof self !== 'undefined' ? self : this, function (StellarEngine, WorldEngine, SocioEngine, Auditor) {
    'use strict';

    if (!StellarEngine || !WorldEngine || !SocioEngine) {
        console.error("MgT2EBottomUpGenerator DI Failure: Critical engines missing!", { StellarEngine, WorldEngine, SocioEngine });
    }


    /**
     * Main MgT2E Bottom-Up Generation Orchestrator.
     * Executes the complete pipeline for system generation.
     * 
     * @param {string} hexId - The hex identifier for this system
     * @returns {Object} sys - The fully populated system object
     */
    function generateMgT2ESystemBottomUp(hexId) {
        // =================================================================
        // PHASE 1: INITIALIZATION & SKELETON
        // =================================================================
        
        // Initialize trace logging
        if (typeof startTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            startTrace(hexId, 'MgT2E Bottom-Up System');
        }

        // Reseed RNG for this hex
        if (typeof reseedForHex === 'function') {
            reseedForHex(hexId);
        }

        // Create base system object
        const sys = {
            hexId: hexId,
            worlds: [],
            stars: [],
            age: 0,
            hzco: 0,
            gasGiants: 0,
            planetoidBelts: 0,
            terrestrialPlanets: 0,
            totalWorlds: 0,
            baselineOrbit: 0,
            forbiddenZones: []
        };

        // 1. Generate stellar system (Primary + companions)
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Stellar Generation...`);
        if (StellarEngine && StellarEngine.generateStellarSystem) {
            StellarEngine.generateStellarSystem(sys, hexId);
        }

        // 2. Generate system inventory (GG count, belts, terrestrials)
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Inventory... (Terrestrials: ${sys.terrestrialPlanets})`);
        if (StellarEngine && StellarEngine.generateSystemInventory) {
            StellarEngine.generateSystemInventory(sys);
        }

        // 3. Allocate Orbits (Places skeleton bodies into orbits)
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Allocation... (Total Worlds: ${sys.totalWorlds})`);
        if (StellarEngine && StellarEngine.allocateOrbits) {
            StellarEngine.allocateOrbits(sys);
        }

        // 4. Initial Physical Sizing (Size, Mass, Gravity)
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Physics... (Found ${sys.worlds.length} worlds)`);
        if (WorldEngine && WorldEngine.generatePhysicals) {
            WorldEngine.generatePhysicals(sys);
        }

        // =================================================================
        // PHASE 2: CANDIDATE FLESHING
        // =================================================================
        
        tSection('Phase 2: Candidate Fleshing');
        
        // --- SEAN PROTOCOL: Candidate Expansion ---
        // We must flatten nested moons into the candidate pool so they can be considered for Mainworld status.
        let candidatesToAdd = [];
        sys.worlds.forEach(w => {
            if (w.moons && w.moons.length > 0) {
                w.moons.forEach(m => {
                    if (m.type === 'Satellite') {
                        m.isMoon = true;
                        m.isSatellite = true;
                        m.parentType = w.type;
                        m.isMoonOfGG = (w.type === 'Gas Giant');
                        candidatesToAdd.push(m);
                    }
                });
            }
        });

        // Step A: Identification of candidates for Mainworld eligibility
        let candidates = sys.worlds.filter(w => 
            w.type === 'Terrestrial Planet' || 
            w.type === 'Satellite' || 
            w.type === 'Planetoid Belt'
        );

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 2: Found ${candidates.length} top-level candidates and ${candidatesToAdd.length} moons.`);

        if (WorldEngine) {
            // Generate atmospherics for candidates (restricted to targetWorlds)
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 2: Generating Atmospherics...`);
            if (WorldEngine.generateAtmospherics) {
                WorldEngine.generateAtmospherics(sys, { 
                    targetWorlds: candidates, 
                    mode: 'bottom-up' 
                });
            }

            // Generate rotational dynamics for candidates
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 2: Generating Rotational...`);
            if (WorldEngine.generateRotationalDynamics) {
                WorldEngine.generateRotationalDynamics(sys, { 
                    targetWorlds: candidates, 
                    mode: 'bottom-up' 
                });
            }

            // Generate biospherics for candidates
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 2: Generating Biospherics...`);
            if (WorldEngine.generateBiospherics) {
                WorldEngine.generateBiospherics(sys, { 
                    targetWorlds: candidates, 
                    mode: 'bottom-up' 
                });
            }

            // =================================================================
            // PHASE 3: MAINWORLD SELECTION (CROWNING)
            // =================================================================
            
            tSection('Phase 3: Mainworld Selection');
            
            // SEAN PROTOCOL: Inject moons into the candidate pool for Mainworld consideration
            // This happens *after* physics generation to preserve engine iteration constraints
            candidates = candidates.concat(candidatesToAdd);
            
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 3: Selection from ${candidates.length} candidates...`);
            let mainworld = WorldEngine.evaluateMainworldCandidates(candidates);

            if (mainworld) {
                mainworld.type = 'Mainworld';
                sys.mainworld = mainworld;
                
                // SEAN PROTOCOL: Moon-Mainworld Selection Logging
                if (mainworld.isMoon) {
                    tResult('Mainworld Status', 'LUNAR SELECTION');
                    writeLogLine(`[MAINWORLD LOG] Hex ${sys.hexId}: Mainworld is a MOON at Orbit ${mainworld.orbitId.toFixed(2)}`);
                }

                tResult('Winning Mainworld', `${mainworld.name || 'Body'} at Orbit ${mainworld.orbitId.toFixed(2)} [Score: ${mainworld.habitability}]`);
            } else {
                tResult('Winning Mainworld', 'None');
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 3 ERROR: No winning mainworld elected!`);
            }
        }

        // =================================================================
        // PHASE 4: FULL SYSTEM POPULATION
        // =================================================================
        
        tSection('Phase 4: Full System Population');

        // Flesh out remaining worlds that weren't candidates (Gas Giants, etc.)
        let remainingWorlds = sys.worlds.filter(w => !candidates.includes(w));
        
        if (WorldEngine) {
            WorldEngine.generateAtmospherics(sys, { 
                targetWorlds: remainingWorlds, 
                mainworldBase: sys.mainworld, 
                mode: 'bottom-up' 
            });
            WorldEngine.generateRotationalDynamics(sys, { 
                targetWorlds: remainingWorlds, 
                mainworldBase: sys.mainworld, 
                mode: 'bottom-up' 
            });
            WorldEngine.generateBiospherics(sys, { 
                targetWorlds: remainingWorlds, 
                mainworldBase: sys.mainworld, 
                mode: 'bottom-up' 
            });
        }

        // =================================================================
        // PHASE 5: SOCIAL SWEEPS
        // =================================================================
        
        if (SocioEngine) {
            // 1. Generate Mainworld social baseline (UWP) from its physicals
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 5: Socio baseline...`);
            if (sys.mainworld && SocioEngine.generateMainworldUWP) {
                SocioEngine.generateMainworldUWP(hexId, sys.mainworld);
            }

            // 2. Generate/Refresh core social for all worlds (Mainworld + Subordinates)
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 5: Core Social...`);
            if (SocioEngine.generateCoreSocial) {
                SocioEngine.generateCoreSocial(sys, sys.mainworld);
            }

            // Extended Socioeconomics
            // Only generate extended socioeconomic details if there are people
            if (sys.mainworld && sys.mainworld.pop > 0) {
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 5: Extended Socio...`);
                if (SocioEngine.generateExtendedSocioeconomics) {
                    SocioEngine.generateExtendedSocioeconomics(sys, sys.mainworld);
                }
            } else {
                if (typeof tSkip === 'function') {
                    tSkip('Population 0: Bypassing Extended Socioeconomics');
                }
            }

            // Finalize Subordinate Social
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 5: Finalizing Subordinates...`);
            if (SocioEngine.finalizeSubordinateSocial) {
                SocioEngine.finalizeSubordinateSocial(sys, sys.mainworld);
            }
        }

        // =================================================================
        // PHASE 6: JOURNEY MATH SWEEP (Phase 2 Integration)
        // =================================================================
        if (MgT2EMath && MgT2EMath.performJourneyMathSweep) {
            MgT2EMath.performJourneyMathSweep(sys);
        }

        // =================================================================
        // PHASE 7: FINALIZATION & AUDIT
        // =================================================================
        
        // Final name check
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 7: Naming...`);
        sys.worlds.forEach(w => {
            if (!w.name) {
                w.name = (typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unnamed';
            }
        });

        if (sys.mainworld && sys.mainworld.name) {
            sys.name = sys.mainworld.name;
        }

        // System Audit
        const activeAuditor = Auditor || (typeof MgT2E_UWP_Auditor !== 'undefined' ? MgT2E_UWP_Auditor : null);
        if (activeAuditor) {
            activeAuditor.auditMgT2ESystem(sys, { mode: 'bottom-up' });
        }

        // Close trace logging
        if (typeof endTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            endTrace();
        }

        return sys;
    }

    // =================================================================
    // PUBLIC API
    // =================================================================
    
    if (typeof window !== 'undefined') {
        window.generateMgT2ESystemBottomUp = generateMgT2ESystemBottomUp;
    }

    return {
        generateSystem: generateMgT2ESystemBottomUp,
        generateMgT2ESystemBottomUp: generateMgT2ESystemBottomUp
    };
}));
