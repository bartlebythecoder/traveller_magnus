/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: MgT2E Top-Down Generator (Orchestrator)
 * Description: Master controller for Mongoose Traveller 2E system generation.
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
        root.MgT2ETopDownGenerator = factory(
            root.MgT2EStellarEngine,
            root.MgT2EWorldEngine,
            root.MgT2ESocioEngine,
            root.MgT2E_UWP_Auditor
        );
    }
}(typeof self !== 'undefined' ? self : this, function (StellarEngine, WorldEngine, SocioEngine, Auditor) {
    'use strict';

    /**
     * Main MgT2E Top-Down Generation Orchestrator.
     * Executes the complete pipeline for system generation.
     * 
     * @param {string} hexId - The hex identifier for this system
     * @returns {Object} sys - The fully populated system object
     */
    function generateMgT2ESystemTopDown(hexId, mwOverride = null) {
        // =================================================================
        // PHASE 1: INITIALIZATION
        // =================================================================
        
        // Initialize trace logging
        if (typeof startTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            startTrace(hexId, 'MgT2E Top-Down System');
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

        // Create mainworld base object
        let mainworldBase = null;
        if (mwOverride) {
            mainworldBase = mwOverride;
        } else if (SocioEngine && SocioEngine.generateMainworldUWP) {
            mainworldBase = SocioEngine.generateMainworldUWP(hexId);
        } else {
            mainworldBase = {
                type: 'Mainworld',
                name: (typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unnamed',
                hexId: hexId
            };
        }

        // Add mainworld to system
        sys.worlds.push(mainworldBase);

        // =================================================================
        // PHASE 2: MAINWORLD UPFRONT
        // =================================================================
        
        // Generate Mainworld UWP before stars exist (legacy flow parity)
        if (SocioEngine && SocioEngine.generateCoreSocial && !mwOverride) {
            SocioEngine.generateCoreSocial(sys, mainworldBase);
        }

        // =================================================================
        // PHASE 3: STELLAR & INVENTORY
        // =================================================================
        
        // Generate stellar system (Primary + companions)
        if (StellarEngine && StellarEngine.generateStellarSystem) {
            StellarEngine.generateStellarSystem(sys, hexId, mainworldBase);
        }

        // Generate system inventory (GG count, belts, terrestrials)
        if (StellarEngine && StellarEngine.generateSystemInventory) {
            StellarEngine.generateSystemInventory(sys, mainworldBase);
        }

        // =================================================================
        // PHASE 4: ORBIT ALLOCATION
        // =================================================================
        
        // Allocate orbits (places Mainworld and generates subordinate bodies)
        if (StellarEngine && StellarEngine.allocateOrbits) {
            StellarEngine.allocateOrbits(sys, mainworldBase);
        }

        // =================================================================
        // PHASE 5: PHYSICAL & ENVIRONMENTAL SWEEPS
        // =================================================================
        
        // Generate physical characteristics for all worlds
        if (WorldEngine && WorldEngine.generatePhysicals) {
            WorldEngine.generatePhysicals(sys, mainworldBase);
        }

        // Generate atmospheric properties
        if (WorldEngine && WorldEngine.generateAtmospherics) {
            WorldEngine.generateAtmospherics(sys, mainworldBase);
        }

        // Generate rotational dynamics (day length, axial tilt)
        if (WorldEngine && WorldEngine.generateRotationalDynamics) {
            WorldEngine.generateRotationalDynamics(sys, mainworldBase);
        }

        // Generate biosphere and native life
        if (WorldEngine && WorldEngine.generateBiospherics) {
            WorldEngine.generateBiospherics(sys, mainworldBase);
        }

        // =================================================================
        // PHASE 6: SUBORDINATE SOCIAL SWEEP
        // =================================================================
        
        // Generate core social stats for subordinate worlds
        // (Engine should skip Mainworld since it already has UWP)
        if (SocioEngine && SocioEngine.generateCoreSocial) {
            SocioEngine.generateCoreSocial(sys, mainworldBase);
        }

        // =================================================================
        // PHASE 7: EXTENDED SOCIAL SWEEPS
        // =================================================================
        
        // Generate extended socioeconomic data
        if (SocioEngine && SocioEngine.generateExtendedSocioeconomics) {
            SocioEngine.generateExtendedSocioeconomics(sys, mainworldBase);
        }

        // Finalize subordinate social characteristics
        if (SocioEngine && SocioEngine.finalizeSubordinateSocial) {
            SocioEngine.finalizeSubordinateSocial(sys, mainworldBase);
        }

        // --- PHASE 8: SYSTEM AUDIT ---
        const activeAuditor = Auditor || (typeof MgT2E_UWP_Auditor !== 'undefined' ? MgT2E_UWP_Auditor : null);
        if (activeAuditor) {
            const auditResults = activeAuditor.auditMgT2ESystem(sys, { mode: 'top-down' });
            if (!auditResults.pass) {
                const errSummary = auditResults.errors.map(e => e.message || e).join(' | ');
                console.warn(`[MgT2E Auditor] System ${hexId} failed strict validation (${auditResults.errors.length} error(s)): ${errSummary}`);

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

        // =================================================================
        // PHASE 8: FINAL POLISH
        // =================================================================
        
        // Ensure all worlds have names and the system itself has a primary name
        // RECURSIVE SEARCH: Find the Mainworld even if it is a moon (Lunar Mainworld)
        const findMainworld = (worlds) => {
            for (const w of worlds) {
                if (w.type === 'Mainworld' || w.isLunarMainworld) return w;
                if (w.moons && w.moons.length > 0) {
                    const mw = findMainworld(w.moons);
                    if (mw) return mw;
                }
            }
            return null;
        };

        let mw = findMainworld(sys.worlds) || sys.worlds[0];
        
        // Fix potential missing names for all worlds (Physical Engine doesn't set names)
        // RECURSIVE POLISH: Ensure moons also get names
        const polishNames = (worlds) => {
            worlds.forEach(w => {
                if (!w.name) {
                    w.name = (typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unnamed';
                }
                if (w.moons && w.moons.length > 0) polishNames(w.moons);
            });
        };
        polishNames(sys.worlds);

        // Set the system-level name for the Map Renderer
        if (mw && mw.name) {
            sys.name = mw.name;
        } else if (mainworldBase && mainworldBase.name) {
            sys.name = mainworldBase.name;
        } else {
            sys.name = (typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unknown';
        }

        // =================================================================
        // PHASE 9: JOURNEY MATH SWEEP (Phase 2 Integration)
        // =================================================================
        if (MgT2EMath && MgT2EMath.performJourneyMathSweep) {
            MgT2EMath.performJourneyMathSweep(sys);
        }

        // =================================================================
        // PHASE 10: FINALIZATION
        // =================================================================
        
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

        // Return the fully populated system
        return sys;
    }

    /**
     * Developer Expansion Orchestrator:
     * Expands an existing system object with socioeconomic data without regenerating the system structure.
     * Following the "Audit & Repair" pattern to satisfy social engine dependencies.
     * 
     * @param {string} hexId - Hex identifier
     * @param {Object} stateObj - Current world state object from hexStates
     * @returns {Object} Modified system object
     */
    function expandLoadedSocioeconomics(hexId, stateObj) {
        if (!stateObj || !stateObj.mgtSystem) {
            console.error("[MgT2E Generator] No existing system data found for expansion.");
            return null;
        }

        const sys = stateObj.mgtSystem;
        // Search all potential data objects for the manual/loaded source of truth, strictly matching Hex Editor priority.
        const mainworldBase = stateObj.rttData || stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData || sys.worlds.find(w => w.type === 'Mainworld') || sys.worlds[0];

        if (!mainworldBase) {
            console.error("[MgT2E Generator] No mainworld data found for expansion.");
            return null;
        }

        // Initialize trace logging if enabled
        if (typeof startTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            startTrace(hexId, 'MgT2E Dev Expansion (No Regen)');
        }

        // --- PHASE 0: DATA SYNC ---
        // Ensure the system's internal mainworld reference matches our manual/loaded source of truth.
        const findMW = (wList) => {
            for (let w of wList) {
                if (w.type === 'Mainworld' || w.isLunarMainworld || w.targetWorld === 'Mainworld') return w;
                if (w.moons) {
                    let res = findMW(w.moons);
                    if (res) return res;
                }
            }
            return null;
        };

        let internalMW = findMW(sys.worlds) || sys.worlds[0];
        if (internalMW && mainworldBase && internalMW !== mainworldBase) {
            // Transfer core properties required for the SocioEngine checks
            internalMW.pop = (mainworldBase.pop !== undefined) ? mainworldBase.pop : internalMW.pop;
            internalMW.popDigit = (mainworldBase.popDigit !== undefined) ? mainworldBase.popDigit : internalMW.popDigit;
            internalMW.pValue = (mainworldBase.pValue !== undefined) ? mainworldBase.pValue : (mainworldBase.popDigit !== undefined ? mainworldBase.popDigit : internalMW.pValue);
            internalMW.pbg = mainworldBase.pbg || internalMW.pbg;
            internalMW.uwp = mainworldBase.uwp || internalMW.uwp;
            
            // Sync all other UWP fields
            internalMW.starport = mainworldBase.starport || internalMW.starport;
            internalMW.size = mainworldBase.size !== undefined ? mainworldBase.size : internalMW.size;
            internalMW.atm = (mainworldBase.atm !== undefined) ? mainworldBase.atm : (mainworldBase.atmCode !== undefined ? mainworldBase.atmCode : internalMW.atm);
            internalMW.hydro = (mainworldBase.hydro !== undefined) ? mainworldBase.hydro : (mainworldBase.hydroCode !== undefined ? mainworldBase.hydroCode : internalMW.hydro);
            internalMW.gov = (mainworldBase.gov !== undefined) ? mainworldBase.gov : internalMW.gov;
            internalMW.law = (mainworldBase.law !== undefined) ? mainworldBase.law : internalMW.law;
            internalMW.tl = (mainworldBase.tl !== undefined) ? mainworldBase.tl : internalMW.tl;
            
            // Critical: Ensure flags match
            if (mainworldBase.isLunarMainworld) internalMW.isLunarMainworld = true;
            if (mainworldBase.isMoon) internalMW.isMoon = true;
        }


        // --- PHASE 1: PHYSICAL AUDIT & REPAIR ---
        // Socio-economic engines require certain physical foundations (Resource Rating, Habitability, Day Length).
        // We surgery repair these ONLY if they are missing, preserving existing manual edits.
        if (WorldEngine) {
            let rootsToRepairRot = [];
            let rootsToRepairBio = [];

            sys.worlds.forEach(w => {
                 let needsRot = false;
                 let needsBio = false;
                 const check = (node) => {
                     if (node.type !== 'Empty') {
                         if (node.siderealHours === undefined || node.axialTilt === undefined) needsRot = true;
                         if (node.habitability === undefined || node.resourceRating === undefined) needsBio = true;
                     }
                     if (node.moons) node.moons.forEach(check);
                     if (node.significantBodies) node.significantBodies.forEach(check);
                 };
                 check(w);
                 if (needsRot) rootsToRepairRot.push(w);
                 if (needsBio) rootsToRepairBio.push(w);
            });

            // 1. Rotational Dynamics (Day Length, Axial Tilt)
            if (rootsToRepairRot.length > 0 && WorldEngine.generateRotationalDynamics) {
                WorldEngine.generateRotationalDynamics(sys, { targetWorlds: rootsToRepairRot });
            }

            // 2. Biospherics & Resources (Resource Rating, Habitability, Seismic)
            if (rootsToRepairBio.length > 0 && WorldEngine.generateBiospherics) {
                WorldEngine.generateBiospherics(sys, { targetWorlds: rootsToRepairBio, mainworldBase: mainworldBase });
            }
        }

        // --- PHASE 2: GENERATION CALLS ---
        if (SocioEngine && SocioEngine.generateExtendedSocioeconomics) {
            SocioEngine.generateExtendedSocioeconomics(sys, mainworldBase);
        }

        if (SocioEngine && SocioEngine.finalizeSubordinateSocial) {
            SocioEngine.finalizeSubordinateSocial(sys, mainworldBase);
        }

        if (internalMW && mainworldBase && internalMW !== mainworldBase) {
            Object.assign(internalMW, mainworldBase);
        }

        // --- PHASE 4: JOURNEY MATH SWEEP ---
        if (MgT2EMath && MgT2EMath.performJourneyMathSweep) {
            MgT2EMath.performJourneyMathSweep(sys);
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
        window.generateMgT2ESystemTopDown = generateMgT2ESystemTopDown;
        window.expandLoadedSocioeconomicsMgT2E = expandLoadedSocioeconomics;
    }

    return {
        generateMgT2ESystemTopDown: generateMgT2ESystemTopDown,
        expandLoadedSocioeconomicsMgT2E: expandLoadedSocioeconomics
    };
}));
