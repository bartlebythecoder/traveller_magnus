// =====================================================================
// CLASSIC TRAVELLER: MODULAR BOTTOM-UP GENERATOR (Rule Compliant)
// =====================================================================

// Browser-safe imports
var orbitalAU, luminosityTable, starMassTable, natureTable, priTypeTable, priSizeTable, compTypeTable, compSizeTable, zoneTables;
var physicalGen, popGen, mainworldSocialFin, subordinateSocialFin;
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

    const worldEngine = require('./ct_world_engine');
    physicalGen = worldEngine.generatePhysicals;
    popGen = worldEngine.generatePopulation;
    mainworldSocialFin = worldEngine.finalizeMainworldSocial;
    subordinateSocialFin = worldEngine.finalizeSubordinateSocial;

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

    physicalGen = (window.CT_World_Engine) ? window.CT_World_Engine.generatePhysicals : null;
    popGen = (window.CT_World_Engine) ? window.CT_World_Engine.generatePopulation : null;
    mainworldSocialFin = (window.CT_World_Engine) ? window.CT_World_Engine.finalizeMainworldSocial : null;
    subordinateSocialFin = (window.CT_World_Engine) ? window.CT_World_Engine.finalizeSubordinateSocial : null;

    thermalStatsGetter = typeof getThermalStats !== 'undefined' ? getThermalStats : null;
    rotationStatsGetter = typeof getRotationStats !== 'undefined' ? getRotationStats : null;
    satelliteGenerator = typeof generateSatellites !== 'undefined' ? generateSatellites : null;
}

/**
 * PHASE 1: SKELETON GENERATION (System-Wide Logic)
 */
function generateSystemSkeleton() {
    const sys = { stars: [], gasGiants: [], planetoidBelts: 0, orbits: [] };

    // 1. Primary Star Configuration
    const priTypeIdx = tRoll2D('Pri Type');
    const priSizeIdx = tRoll2D('Pri Size');
    const primary = {
        role: 'Primary',
        type: priTypeTable[priTypeIdx],
        size: priSizeTable[priSizeIdx],
        decimal: (tRoll1D('Pri Dec') <= 3 ? 0 : 5),
        maxOrbits: tRoll2D('Primary Max Orbits')
    };
    primary.name = `${primary.type}${primary.decimal} ${primary.size}`;
    const specKey = primary.type + primary.decimal;
    primary.luminosity = (luminosityTable[primary.size] && luminosityTable[primary.size][specKey]) || 1.0;
    primary.mass = (starMassTable[primary.size] && starMassTable[primary.size][specKey]) || 1.0;
    sys.stars.push(primary);

    // 2. Determine System-Level Counts (Gas Giants & Planetoid Belts)
    let ggCount = 0;
    if (tRoll2D('GG Presence') >= 8) {
        ggCount = Math.max(1, Math.floor(tRoll2D('GG Qty') / 2));
    }
    for (let i = 0; i < ggCount; i++) {
        sys.gasGiants.push({ type: 'Gas Giant', size: (tRoll1D('GG Size') <= 3 ? 'Large' : 'Small') });
    }

    let beltQty = 0;
    if (tRoll2D('Planetoid Presence') <= 7) {
        let pbRoll = tRoll2D('Planetoid Qty');
        if (pbRoll <= 0) beltQty = 3;
        else if (pbRoll <= 6) beltQty = 2;
        else beltQty = 1;
    }
    sys.planetoidBelts = Math.min(beltQty, primary.maxOrbits);

    // 3. Initialize Orbits
    for (let i = 0; i <= primary.maxOrbits; i++) {
        sys.orbits.push({
            orbit: i,
            zone: getZoneForOrbit(primary.size, specKey, i),
            contents: null
        });
    }

    // 4. Anomaly Placement: Captured Planets and Empty Orbits
    // 4a. Empty Orbits (System-Wide)
    let empDM = (['B', 'A'].includes(primary.type)) ? 1 : 0;
    if (tRoll1D('Empty Presence') + empDM >= 5) {
        let qty = [0, 1, 1, 2, 3, 3, 3][tRoll1D('Empty Qty')];
        for (let i = 0; i < qty; i++) {
            let target = tRoll2D('Empty Placement');
            let slot = sys.orbits.find(o => o.orbit === target);
            if (slot && !slot.contents) slot.contents = { type: 'Empty' };
        }
    }

    // 4b. Captured Planets
    let capDM = (['B', 'A'].includes(primary.type)) ? 1 : 0;
    if (tRoll1D('Captured Presence') + capDM >= 5) {
        let qty = [0, 1, 1, 2, 2, 3, 3][tRoll1D('Captured Qty')];
        sys.capturedPlanets = [];
        for (let i = 0; i < qty; i++) {
            let baseline = tRoll2D('Captured Baseline');
            let deviation = (tRoll2D('Captured Deviation') - 7) * 0.1;
            let finalOrbit = Number((baseline + deviation).toFixed(1));
            
            sys.capturedPlanets.push({
                type: 'Captured Planet',
                orbit: finalOrbit,
                zone: getZoneForOrbit(primary.size, specKey, Math.floor(finalOrbit))
            });
        }
    }

    // 5. Feature Placement
    // GGs (H or O zones)
    sys.gasGiants.forEach(gg => {
        let slot = sys.orbits.find(o => (o.zone === 'H' || o.zone === 'O') && !o.contents);
        if (slot) slot.contents = gg;
    });
    // Belts
    for (let i = 0; i < sys.planetoidBelts; i++) {
        let slot = sys.orbits.find(o => !o.contents);
        if (slot) slot.contents = { type: 'Planetoid Belt', size: 0, gravity: 0 };
    }

    // 6. Final Mandatory Fill (Rule of Book 6)
    sys.orbits.forEach(slot => {
        if (!slot.contents) {
            slot.contents = { type: 'Terrestrial Planet' };
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

    // A. Generate Satellites (Book 6 Rule)
    walkSystem(sys, (body) => {
        if (satelliteGenerator) satelliteGenerator(body);
    });

    // B. Physical Pass: (Size, Atmo, Hydro, POPULATION)
    // No population caps are applied in this pass.
    walkSystem(sys, (body, orbit) => {
        body.distAU = orbitalAU[Math.min(Math.floor(orbit), orbitalAU.length - 1)] || 1.0;

        if (['Terrestrial Planet', 'Captured Planet', 'Satellite'].includes(body.type)) {
            if (physicalGen) physicalGen(body, body.zone);
            if (popGen) popGen(body);
            
            if (thermalStatsGetter) {
                const thermal = thermalStatsGetter(body, sys.stars[0].luminosity);
                body.temperature = thermal.temperature;
            }
            if (rotationStatsGetter) {
                const rot = rotationStatsGetter(body);
                body.axialTilt = rot.axialTilt;
                body.rotationPeriod = rot.rotationPeriod;
            }
            body.gravity = (body.size === 0 || body.size === 'R' || body.size === 'S') ? 0 : (body.size * 0.125);
            // Orbital Period: sqrt(AU^3 / Mass_star)
            if (body.distAU) {
                body.orbitalPeriod = Math.sqrt(Math.pow(body.distAU, 3) / (sys.stars[0].mass || 1.0));
            }
        }

        if (body.type === 'Gas Giant') {
             body.temperature = 100; // GC baseline
             if (body.distAU) {
                body.orbitalPeriod = Math.sqrt(Math.pow(body.distAU, 3) / (sys.stars[0].mass || 1.0));
            }
        }
    });

    // C. Designation & Social Pass
    let mainworld = designateMainworld(sys);
    if (mainworld) {
        mainworld.type = 'Mainworld';
        if (mainworldSocialFin) mainworldSocialFin(mainworld);
        
        // Finalize Subordinates (Apply Pop Cap relative to the newly crowned Mainworld)
        walkSystem(sys, (body) => {
            if (body !== mainworld && (['Terrestrial Planet', 'Planetoid Belt', 'Captured Planet', 'Satellite'].includes(body.type))) {
                if (subordinateSocialFin) subordinateSocialFin(body, mainworld);
            }
        });
    }

    return sys;
}

/**
 * UTILITY: SYSTEM WALKER
 */
function walkSystem(sys, callback) {
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
}

/**
 * UTILITY: MAINWORLD DESIGNATOR
 */
function designateMainworld(sys) {
    let candidates = [];
    walkSystem(sys, (body) => {
        if (['Terrestrial Planet', 'Planetoid Belt'].includes(body.type)) {
            candidates.push(body);
        }
    });
    if (candidates.length === 0) return null;
    candidates.sort((a,b) => (b.pop || 0) - (a.pop || 0));
    return candidates[0];
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
    module.exports = { generateSystemSkeleton, processBottomUpSocial, walkSystem };
} else {
    window.generateSystemSkeleton = generateSystemSkeleton;
    window.processBottomUpSocial = processBottomUpSocial;
    window.walkSystem = walkSystem;
}
