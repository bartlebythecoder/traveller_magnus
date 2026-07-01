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
     * @param {string} hexId   - The hex identifier for this system
     * @param {Object} [seedSys=null] - Optional seed from the System Editor. When null,
     *   generation is fully stochastic (all existing macro calls). When provided:
     *   - Stars/worlds are taken from seedSys instead of being rolled
     *   - seedSys._allowAddBodies: if false, inventory/allocation phases are skipped
     *   - seedSys._mainworldRef: _id of the body to designate as mainworld (skips election)
     * @returns {Object} sys - The fully populated system object
     */
    function generateMgT2ESystemBottomUp(hexId, seedSys = null) {
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
        window._currentSystemHasPop = (typeof shouldGeneratePopulation === 'function') ? shouldGeneratePopulation(hexId) : true;

        // Create base system object — seed from seedSys if provided, otherwise start fresh
        const sys = seedSys ? {
            hexId: hexId,
            worlds: (seedSys.worlds || []).map(b => Object.assign({}, b)),
            stars:  (seedSys.stars  || []).map(s => Object.assign({}, s)),
            age:              seedSys.age  || 0,
            hzco:             seedSys.hzco || 0,
            gasGiants:        0,
            planetoidBelts:   0,
            terrestrialPlanets: 0,
            totalWorlds:      0,
            baselineOrbit:    0,
            forbiddenZones:   []
        } : {
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

        // 1. Generate stellar system (Primary + companions) — skip if seedSys provides stars
        if (!seedSys || !sys.stars.length) {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Stellar Generation...`);
            if (StellarEngine && StellarEngine.generateStellarSystem) {
                StellarEngine.generateStellarSystem(sys, hexId, null, 'bottom-up');
            }
        } else {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Stellar skipped — seed provides ${sys.stars.length} star(s).`);
        }

        // 2 & 3. Generate inventory + allocate orbits — skip if seedSys controls body count
        if (!seedSys || seedSys._allowAddBodies) {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Inventory... (Terrestrials: ${sys.terrestrialPlanets})`);
            if (StellarEngine && StellarEngine.generateSystemInventory) {
                StellarEngine.generateSystemInventory(sys);
            }
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Allocation... (Total Worlds: ${sys.totalWorlds})`);
            if (StellarEngine && StellarEngine.allocateOrbits) {
                StellarEngine.allocateOrbits(sys);
            }
            // After allocateOrbits wipes and rebuilds sys.worlds, restore each seed
            // world's user data (name, UWP, _id, locked fields) to the nearest-orbit
            // generated world of the same body category. Must run before generatePhysicals
            // so the locked fields are honoured by the physics engines.
            if (seedSys && (seedSys.worlds || []).length > 0) {
                const _normCat = t => t === 'Gas Giant' ? 'GG' : t === 'Planetoid Belt' ? 'Belt' : 'Rocky';
                const _restored = new Set();
                const _moonHasUserData = m => !!(m.name || m.uwp || (m._manualFields && m._manualFields.length > 0));
                for (const sw of seedSys.worlds) {
                    const hasUserData = sw.name || sw.uwp || (sw._manualFields && sw._manualFields.length > 0)
                        || (sw.moons && sw.moons.some(_moonHasUserData));
                    if (!hasUserData) continue;
                    const swCat   = _normCat(sw.type);
                    const swOrbit = sw.orbitId != null ? sw.orbitId : 1;
                    let best = null, bestDist = Infinity;
                    for (const gw of sys.worlds) {
                        if (_restored.has(gw)) continue;
                        if (_normCat(gw.type) !== swCat) continue;
                        const d = Math.abs((gw.orbitId || 0) - swOrbit);
                        if (d < bestDist) { bestDist = d; best = gw; }
                    }
                    if (!best) continue;
                    _restored.add(best);
                    if (sw._id)  best._id  = sw._id;
                    if (sw.name) best.name = sw.name;
                    if (sw.uwp)  best.uwp  = sw.uwp;
                    ['size', 'atmCode', 'hydroCode', 'pop', 'popCode', 'gov', 'govCode', 'law', 'tl', 'starport'].forEach(f => {
                        if (sw[f] != null) best[f] = sw[f];
                    });
                    if (sw._manualFields && sw._manualFields.length) {
                        const mfSet = new Set(best._manualFields || []);
                        sw._manualFields.forEach(f => mfSet.add(f));
                        best._manualFields = [...mfSet];
                    }
                    // Restore any user-authored moons (named/detailed) from the seed world.
                    // generatePhysicals counts these as existingMoons and will add more if
                    // the dice roll exceeds the count; moons with pd already set are kept as-is.
                    if (sw.moons && sw.moons.length > 0) {
                        best.moons = sw.moons.map(m => Object.assign({}, m));
                    }
                    if (window.isLoggingEnabled) writeLogLine(`[SEED RESTORE] Seed "${sw.name || sw._id}" → generated ${best.type} at orbit ${best.orbitId != null ? best.orbitId.toFixed(2) : '?'} (dist ${bestDist.toFixed(2)}, moons restored: ${(sw.moons || []).length})`);
                }
            }
        } else {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Inventory/Allocation skipped — seed provides ${sys.worlds.length} world(s), _allowAddBodies=false.`);
        }

        // 4. Initial Physical Sizing (Size, Mass, Gravity)
        // When seeded and not allowing new bodies, capture moon counts before generatePhysicals
        // runs so we can trim any dice-rolled additions back out. The seed's moons array is a
        // shared reference (Object.assign shallow copy), so generatePhysicals can extend it.
        const _seededMoonCaps = (seedSys && !seedSys._allowAddBodies)
            ? sys.worlds.map(w => (w.moons || []).length)
            : null;

        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 1: Physics... (Found ${sys.worlds.length} worlds)`);
        if (WorldEngine && WorldEngine.generatePhysicals) {
            WorldEngine.generatePhysicals(sys);
        }

        // Trim back any moons generatePhysicals added beyond the seeded count.
        // Before slicing, move the mainworld moon to index 0 so the sort-by-pd reordering
        // cannot push it beyond the cap and lose it.
        if (_seededMoonCaps) {
            const mwId = seedSys && seedSys._mainworldRef ? seedSys._mainworldRef : null;
            sys.worlds.forEach((w, i) => {
                const cap = _seededMoonCaps[i] ?? 0;
                if (w.moons && w.moons.length > cap) {
                    if (mwId) {
                        const mwIdx = w.moons.findIndex(m => m._id === mwId);
                        if (mwIdx >= cap) {
                            const mwMoon = w.moons.splice(mwIdx, 1)[0];
                            w.moons.unshift(mwMoon);
                        }
                    }
                    w.moons = w.moons.slice(0, cap);
                }
            });
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

            // If seedSys designates a mainworld, find it by _id; otherwise run normal election
            let mainworld = null;
            if (seedSys && seedSys._mainworldRef) {
                mainworld = sys.worlds.find(w => w._id === seedSys._mainworldRef);
                if (!mainworld) {
                    for (const w of sys.worlds) {
                        const moon = (w.moons || []).find(m => m._id === seedSys._mainworldRef);
                        if (moon) { mainworld = moon; break; }
                    }
                }
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 3: Mainworld from seed ref: ${mainworld ? mainworld._id : 'NOT FOUND'}`);
            }
            if (!mainworld) {
                mainworld = WorldEngine.evaluateMainworldCandidates(candidates);
            }

            if (mainworld) {
                mainworld.type = 'Mainworld';
                sys.mainworld = mainworld;
                
                // SEAN PROTOCOL: Moon-Mainworld Selection Logging
                if (mainworld.isMoon) {
                    tResult('Mainworld Status', 'LUNAR SELECTION', 'MgT2E 1.3: Top-Down Lunar Rule');
                    writeLogLine(`[MAINWORLD LOG] Hex ${sys.hexId}: Mainworld is a MOON at Orbit ${mainworld.orbitId != null ? mainworld.orbitId.toFixed(2) : '?'}`);
                }

                tResult('Winning Mainworld', `${mainworld.name || 'Body'} at Orbit ${mainworld.orbitId != null ? mainworld.orbitId.toFixed(2) : '?'} [Score: ${mainworld.habitability}]`, 'MgT2E 1.3: Orbital Allocation');
            } else {
                tResult('Winning Mainworld', 'None', 'MgT2E 1.3: Orbital Allocation');
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
                // The socio engine rolls gasGiant independently; override with the actual
                // world list. sys.gasGiants (rolled inventory count) is NOT reliable here —
                // it stays 0 whenever the System Editor locks body count (_allowAddBodies
                // false), even though sys.worlds may contain a user-added Gas Giant body.
                sys.mainworld.gasGiant = sys.worlds.some(w => w.type === 'Gas Giant');
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
        
        // Assign systematic orbital names now that the world tree is fully assembled
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Bottom-Up Phase 7: Orbital Naming...`);
        applyMgT2EOrbitalNames(sys);

        // System Audit
        const activeAuditor = Auditor || (typeof MgT2E_UWP_Auditor !== 'undefined' ? MgT2E_UWP_Auditor : null);
        if (activeAuditor) {
            const auditResults = activeAuditor.auditMgT2ESystem(sys, { mode: 'bottom-up' });
            if (!auditResults.pass) {
                const errorSummary = auditResults.errors.map(e => `  • ${e.message}`).join('\n');
                console.warn(`[MgT2E Auditor] System ${hexId} — ${auditResults.errors.length} violation(s):\n${errorSummary}`);
                
                // Action 6.3: Audit Persistence — push all strict [FAIL] to global backlog
                if (typeof window !== 'undefined') {
                    window.auditBacklog = window.auditBacklog || [];
                    auditResults.errors.forEach(err => {
                        window.auditBacklog.push({
                            hexId: hexId,
                            orbitId: err.orbitId !== undefined ? err.orbitId : null,
                            engine: "MgT2E",
                            message: err.message || err 
                        });
                    });
                }
            }
        }

        // Action 6.4: Planet-Centric Biographies (v0.6.0.0)
        // Groups all disparate generation data into a human-readable biography per world.
        if (StellarEngine && StellarEngine.walkMgT2ESystem && StellarEngine.logMgT2EBodyBiography) {
            tSection('System Biographies');
            StellarEngine.walkMgT2ESystem(sys, (body) => {
                StellarEngine.logMgT2EBodyBiography(body);
            });
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
