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
        if (SocioEngine && SocioEngine.generateMainworldUWP) {
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
        if (SocioEngine && SocioEngine.generateCoreSocial) {
            SocioEngine.generateCoreSocial(sys, mainworldBase);
        }

        // =================================================================
        // PHASE 3: STELLAR & INVENTORY
        // =================================================================
        
        // Generate stellar system (Primary + companions)
        if (StellarEngine && StellarEngine.generateStellarSystem) {
            StellarEngine.generateStellarSystem(sys, hexId);
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
                console.warn(`[MgT2E Auditor] System ${hexId} failed strict validation. See batch logs for details.`);
            }
        }

        // =================================================================
        // PHASE 8: FINAL POLISH
        // =================================================================
        
        // Ensure all worlds have names and the system itself has a primary name
        let mw = sys.worlds.find(w => w.type === 'Mainworld') || sys.worlds[0];
        
        // Fix potential missing names for all worlds (Physical Engine doesn't set names)
        sys.worlds.forEach(w => {
            if (!w.name) {
                w.name = (typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unnamed';
            }
        });

        // Set the system-level name for the Map Renderer
        if (mw && mw.name) {
            sys.name = mw.name;
        } else if (mainworldBase && mainworldBase.name) {
            sys.name = mainworldBase.name;
        } else {
            sys.name = (typeof getNextSystemName === 'function') ? getNextSystemName(hexId) : 'Unknown';
        }

        // =================================================================
        // PHASE 9: FINALIZATION
        // =================================================================
        
        // Close trace logging
        if (typeof endTrace === 'function' && typeof window !== 'undefined' && window.isLoggingEnabled) {
            endTrace();
        }

        // Return the fully populated system
        return sys;
    }

    // =================================================================
    // PUBLIC API
    // =================================================================
    
    if (typeof window !== 'undefined') {
        window.generateMgT2ESystemTopDown = generateMgT2ESystemTopDown;
    }

    return {
        generateMgT2ESystemTopDown: generateMgT2ESystemTopDown
    };
}));
