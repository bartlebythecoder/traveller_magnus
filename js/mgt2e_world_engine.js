/**
 * PROJECT AS ABOVE, SO BELOW
 * MGT2E WORLD ENGINE - Planetary Physics & Atmospherics Module
 * 
 * This module contains the core terrestrial world generation functions:
 * - generatePhysicals: Size, mass, gravity, moons (Chunk 3)
 * - generateAtmospherics: Atmosphere, temperature, hydrographics (Chunk 4)
 * 
 * Architectural Compliance:
 * - All RPG mechanics pulled from MgT2EData (Data Shield)
 * - All physics calculations via MgT2EMath (Math Chassis)
 * - State mutation pattern (sys object passed & returned)
 * - Comprehensive trace logging (tSection, tRoll2D, tDM, tResult, tSkip)
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
        factory(exports);
    } else {
        factory((root.MgT2EWorldEngine = {}));
    }
}(typeof self !== 'undefined' ? self : this, function (exports) {
    'use strict';

    // =====================================================================
    // HELPER FUNCTIONS
    // =====================================================================

    /**
     * Calculate terrestrial physical properties (density, gravity, mass, velocities)
     * @param {Object} body - The world or moon object to populate
     * @param {string} label - Label for trace logging
     * @param {Object} sys - System object for context
     */
    function calculateTerrestrialPhysical(body, label, sys) {
        if (body.size === 0 || body.size === 'R') {
            body.density = null;
            body.gravity = null;
            body.mass = null;
            body.escapeVel = null;
            body.orbitalVelSurface = null;
            return;
        }

        tSection(`${label} Physical Stats`);

        // 1. Size 'S' math override
        let mathSize = body.size;
        if (body.size === 'S') mathSize = 0.375;
        else if (typeof body.size === 'string') mathSize = parseInt(body.size, 16);

        // 2. Terrestrial Composition
        let compRoll = tRoll2D('Composition Roll');
        let compDM = 0;

        let sVal = mathSize;
        if (sVal <= 4) { compDM -= 1; tDM('Size 0-4', -1); }
        else if (sVal >= 6 && sVal <= 9) { compDM += 1; tDM('Size 6-9', 1); }
        else if (sVal >= 10) { compDM += 3; tDM('Size A-F', 3); }

        let hzco = body.worldHzco || (sys ? (sys.ptypeHzco || sys.hzco) : 0);
        if (hzco > 0 && body.orbitId !== undefined) {
            let diff = body.orbitId - hzco;
            if (diff <= 0) {
                compDM += 1;
                tDM('At/Closer than HZCO', 1);
            } else {
                let penalty = 1 + Math.floor(diff);
                compDM -= penalty;
                tDM(`Further than HZCO (-${penalty})`, -penalty);
            }
        }

        if (sys && sys.age > 10) {
            compDM -= 1;
            tDM('System Age > 10 Gyr', -1);
        }

        let compModRoll = compRoll + compDM;
        let coreType = 'Mostly Rock';
        if (compModRoll <= -4) coreType = 'Exotic Ice';
        else if (compModRoll <= 2) coreType = 'Mostly Ice';
        else if (compModRoll <= 6) coreType = 'Mostly Rock';
        else if (compModRoll <= 11) coreType = 'Rock and Metal';
        else if (compModRoll <= 14) coreType = 'Mostly Metal';
        else coreType = 'Compressed Metal';

        body.composition = coreType;
        tResult('Composition Result', coreType);

        // 3. Density Lookup from MgT2EData
        let densityRoll = tRoll2D('Density Roll (No DMs)');
        const densityTable = MgT2EData.stellar.densityLookup;
        let baseDensity = densityTable[densityRoll][coreType];
        body.density = parseFloat(baseDensity.toFixed(2));
        tResult('Density', body.density.toFixed(2));

        // 4. Calculate Physics using MgT2EMath
        body.gravity = parseFloat(MgT2EMath.calculateGravity(body.density, mathSize).toFixed(3));
        writeLogLine(`  Gravity Formula: Density(${body.density.toFixed(2)}) * (Size(${mathSize})/8) = ${body.gravity.toFixed(3)} G`);
        tResult('Gravity (G)', body.gravity.toFixed(3));

        body.mass = parseFloat(MgT2EMath.calculateMass(body.density, mathSize).toFixed(4));
        writeLogLine(`  Mass Formula: Density(${body.density.toFixed(2)}) * (Size(${mathSize})/8)^3 = ${body.mass.toFixed(4)} Earths`);
        tResult('Mass (Earths)', body.mass.toFixed(4));

        // 5. Orbital Velocity & Escape Velocity
        body.escapeVel = MgT2EMath.calculateEscapeVelocity(body.mass, mathSize);
        writeLogLine(`  Escape Velocity Formula: sqrt(Mass(${body.mass.toFixed(4)}) / (Size(${mathSize})/8)) * 11186 = ${body.escapeVel.toFixed(2)} km/s`);
        tResult('Escape Velocity (km/s)', body.escapeVel.toFixed(2));

        body.orbitalVelSurface = MgT2EMath.calculateOrbitalVelocity(body.escapeVel);
        writeLogLine(`  Orbital Velocity Formula: EscapeVel(${body.escapeVel.toFixed(2)}) / sqrt(2) = ${body.orbitalVelSurface.toFixed(2)} km/s`);
        tResult('Orbital Velocity (km/s)', body.orbitalVelSurface.toFixed(2));
    }

    /**
     * Size a gas giant body with type-specific math
     * @param {Object} w - World object
     * @param {string} type - 'GS', 'GM', or 'GL'
     */
    function sizeGasGiantBody(w, type) {
        w.ggType = type;
        if (type === 'GS') {
            let d1 = tRoll1D('Small GG Diameter (2D)');
            let d2 = tRoll1D('Small GG Diameter (2D)');
            w.diameterStr = `${d1 + d2} (GS)`;
            w.mass = 5 * (tRoll1D('Small GG Mass (1D+1)') + 1);
            w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
        } else if (type === 'GM') {
            w.diameterStr = `${tRoll1D('Medium GG Diameter (1D+6)') + 6} (GM)`;
            w.mass = 20 * (tRoll3D('Medium GG Mass (3D-1)') - 1);
            w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
        } else {
            w.ggType = 'GL';
            w.diameterStr = `${tRoll2D('Large GG Diameter (2D+6)') + 6} (GL)`;
            let initMass = tRoll3D('Large GG Mass (3D)');
            let d3Multiplier = Math.floor(rng() * 3) + 1;
            w.mass = d3Multiplier * 50 * (initMass + 4);
            if (w.mass >= 3000 || initMass >= 15) {
                w.mass = 4000 - ((tRoll2D('Mass Cap Adjust') - 2) * 200);
            }
            w.diamKm = parseInt(w.diameterStr.split(' ')[0]) * 12800;
        }
        w.size = 'GG';
        w.composition = `Gas Giant (${w.ggType})`;
        tResult('Type', w.ggType);
        tResult('Diameter', w.diameterStr);
        tResult('Mass (Earths)', w.mass);

        // Physical Stats for UI
        let radiusE = w.diamKm / 12742;
        w.gravity = radiusE > 0 ? (w.mass / (radiusE * radiusE)) : 0;
        w.density = radiusE > 0 ? (w.mass / (radiusE * radiusE * radiusE)) : 0.1;
        tResult('Composition', w.composition);
        tResult('Gravity (G)', w.gravity.toFixed(3));
    }

    /**
     * Get effective HZCO deviation for atmospheric table lookup
     * @param {number} orbitId - Orbit number
     * @param {number} hzco - Habitable zone center orbit
     * @returns {number} Deviation value
     */
    function getEffectiveHzcoDeviation(orbitId, hzco) {
        if (orbitId < 1.0 || hzco < 1.0) {
            return (orbitId - hzco) / Math.max(0.01, Math.min(orbitId, hzco));
        }
        return orbitId - hzco;
    }

    /**
     * Get temperature band label
     * @param {number} orbitId - Orbit number
     * @param {number} hzco - Habitable zone center orbit
     * @returns {string} Temperature band
     */
    function getTempBand(orbitId, hzco) {
        let diff = getEffectiveHzcoDeviation(orbitId, hzco);
        if (diff <= -2.01) return "Boiling";
        if (diff <= -1.01) return "Hot";
        if (diff <= 1.00) return "Temperate";
        if (diff <= 3.00) return "Cold";
        return "Frozen";
    }

    // =====================================================================
    // CHUNK 3: WORLD & MOON SIZING (PHYSICAL GENERATION)
    // =====================================================================

    /**
     * Generate physical properties for all worlds and moons in the system.
     * Handles sizing, mass, gravity, moon quantities, and Hill Sphere limits.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object} mainworldBase - Mainworld baseline data (for size locking)
     * @returns {Object} Modified system object
     */
    function generatePhysicals(sys, mainworldBase) {
        let primary = sys.stars[0];
        tSection('World & Moon Sizing');

        // 1. Size Terrestrial Planets & Gas Giants
        for (let i = 0; i < sys.worlds.length; i++) {
            let w = sys.worlds[i];
            w.moons = [];
            w.rings = [];

            if (w.type === 'Empty') continue;

            tSection(`${w.type} Orbit ${w.orbitId.toFixed(2)} Sizing`);
            if (w.type === 'Gas Giant') {
                let catRoll = tRoll1D('Gas Giant Category');
                let gType = (catRoll <= 2) ? 'GS' : (catRoll <= 4 ? 'GM' : 'GL');
                sizeGasGiantBody(w, gType);
            } else if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                if (w.type === 'Mainworld' && mainworldBase && mainworldBase.size !== undefined) {
                    w.size = mainworldBase.size;
                    tResult('Size', `${w.size} (Mainworld Auth)`);
                } else {
                    let sizeCat = tRoll1D('Size Roll Basis (1D)');
                    if (sizeCat <= 2) {
                        w.size = tRoll1D('Tiny/Small (1D)');
                    } else if (sizeCat <= 4) {
                        w.size = tRoll2D('Standard (2D)');
                    } else {
                        w.size = tRoll2D('Large (2D+3)') + 3;
                    }
                    tResult('Size', w.size);
                }

                if (w.size === 0) {
                    w.density = null;
                    w.gravity = null;
                    w.mass = null;
                    w.escapeVel = null;
                    w.orbitalVelSurface = null;
                } else {
                    w.diamKm = w.size * 1600;
                    calculateTerrestrialPhysical(w, w.type, sys);
                }
            } else if (w.type === 'Planetoid Belt') {
                // Nullify all terrestrial physics for the belt itself
                w.size = 0;
                w.gravity = null;
                w.mass = null;
                w.density = null;
                w.escapeVel = null;
                w.orbitalVelSurface = null;
            }

            // Precision Orbit Recalculation
            if (w.au && w.type !== 'Empty') {
                let Sum_M = 0;
                if (w.orbitType === 'P-Type') {
                    Sum_M = sys.stars.reduce((sum, s) => {
                        let sOrbit = (s.orbitId !== null && s.orbitId !== undefined) ? s.orbitId : 0;
                        return sOrbit < w.orbitId ? sum + s.mass : sum;
                    }, 0);
                } else {
                    let pIdx = (w.parentStarIdx !== undefined) ? w.parentStarIdx : 0;
                    Sum_M = (sys.stars[pIdx] || sys.stars[0]).mass;
                }
                let planetSolarMass = (w.mass || 0) * 0.000003;
                w.periodYears = MgT2EMath.calculateOrbitalPeriodYears(w.au, Sum_M, w.mass || 0);
                w.periodDays = w.periodYears * 365.25;
                w.periodHours = w.periodYears * 8766;
                tResult('Calibrated Orbital Period', w.periodYears.toFixed(4) + ' yrs (' + w.periodDays.toFixed(1) + ' days)');
            }

            // Sean Protocol: Distance and 100D Logging
            const worldDistAU = w.au || w.distAU || 0;
            if (worldDistAU && w.type !== 'Empty') {
                const orbitMkm = (worldDistAU * 149597870) / 1000000;
                tResult("Orbit Distance", `${worldDistAU.toFixed(2)} AU (${orbitMkm.toFixed(1)} M km)`);
                
                let worldSize = 0;
                if (w.type === 'Gas Giant') {
                    // Gas Giant 100D is based on its diameter
                    worldSize = (w.diamKm || 0) / 1600;
                } else {
                    worldSize = (typeof w.size === 'string' && w.size !== 'GG') ? parseInt(w.size, 16) : (Number(w.size) || 0);
                }
                
                const world100D = (worldSize * 160000) / 1000000;
                tResult("World 100D Limit", `${world100D.toFixed(2)} M km`);

                // Stellar Masking Eligibility
                if (typeof UniversalMath !== 'undefined' && UniversalMath.isMaskingEligible) {
                    const starDiam = primary ? primary.diam : 1.0;
                    const isEligible = UniversalMath.isMaskingEligible(starDiam, worldDistAU, worldSize);
                    tResult("Stellar Masking", isEligible ? "ELIGIBLE" : "Ineligible");
                }
            }
        }

        // 2. Determine Moon Quantities & Sizes
        for (let i = 0; i < sys.worlds.length; i++) {
            let w = sys.worlds[i];
            if (w.type === 'Empty' || w.type === 'Planetoid Belt') continue;

            tSection(`${w.type} Orbit ${w.orbitId.toFixed(2)} Moons`);
            let qRoll = 0;
            let qLabel = 'Moon Quantity Roll';
            if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                if (w.size <= 2) qRoll = tRoll1D(qLabel);
                else if (w.size <= 9) qRoll = tRoll2D(qLabel);
                else qRoll = tRoll2D(qLabel);
            } else {
                if (w.ggType === 'GS') qRoll = tRoll3D(qLabel);
                else qRoll = tRoll4D(qLabel);
            }

            let qMod = 0;
            if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                if (w.size <= 2) { tDM('Size 2-', -5); qMod -= 5; }
                else if (w.size <= 9) { tDM('Size 3-9', -8); qMod -= 8; }
                else { tDM('Size 10+', -6); qMod -= 6; }
            } else {
                if (w.ggType === 'GS') { tDM('Small GG', -7); qMod -= 7; }
                else { tDM('Med/Large GG', -6); qMod -= 6; }
            }

            // Per-Dice penalties
            let dmDiceCount = (w.size <= 2) ? 1 : (w.size <= 9 ? 2 : (w.size <= 15 ? 2 : (w.ggType === 'GS' ? 3 : 4)));
            let instability = false;
            if (w.orbitId < 1.0) instability = true;

            // Adjacency check
            for (let s of sys.stars) {
                if (s.orbitId !== null && s.orbitId !== undefined && Math.abs(w.orbitId - s.orbitId) <= 1.0) instability = true;
            }
            if (sys.forbiddenZones) {
                for (let fz of sys.forbiddenZones) {
                    if (w.orbitId >= fz.min - 1.0 && w.orbitId <= fz.max + 1.0) instability = true;
                }
            }

            if (instability) {
                tDM('System Instability (Per-Dice Penalty)', -dmDiceCount);
                qMod -= dmDiceCount;
            }

            if (sys.primarySpread < 0.1) {
                tDM('Low System Spread', -1);
                qMod -= 1;
            }

            let isDim = ['M', 'L', 'T', 'Y'].includes(primary.sType) && (['V', 'VI'].includes(primary.sClass) || !primary.sClass);
            if (isDim) {
                tDM('Dim/Dwarf Primary', -1);
                qMod -= 1;
            }

            let moonsToGenerate = Math.max(0, qRoll + qMod);
            if (qRoll + qMod === 0) {
                tResult('Result', 'No moons, Adding Ring placeholder');
                w.rings.push({});
            } else {
                tResult('Moons to Generate', moonsToGenerate);
            }

            for (let m = 0; m < moonsToGenerate; m++) {
                let moonSize = '';
                let r1 = tRoll1D(`Satellite ${m + 1} Size Basis`);
                if (r1 <= 3) {
                    moonSize = 'S';
                } else if (r1 <= 5) {
                    let ms = Math.floor(rng() * 3);
                    if (ms === 0) moonSize = 'R'; else moonSize = ms;
                } else {
                    if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                        if (w.size === 1) {
                            moonSize = 'S';
                        } else {
                            let msRoll = tRoll1D(`Satellite ${m + 1} Size (MW/TP)`);
                            let trySize = w.size - 1 - msRoll;
                            if (trySize < 0) moonSize = 'S';
                            else if (trySize === 0) moonSize = 'R';
                            else if (trySize === w.size - 2) {
                                let twinRoll = tRoll2D(`Satellite ${m + 1} Twin Chance`);
                                if (twinRoll === 12) { tResult(`Satellite ${m + 1}`, 'Twin World'); moonSize = w.size; }
                                else if (twinRoll === 2) moonSize = trySize - 1;
                                else moonSize = trySize;
                                if (moonSize <= 0) moonSize = 'S';
                            } else {
                                moonSize = trySize;
                            }
                        }
                    } else {
                        let specialR = tRoll1D(`Satellite ${m + 1} GG Size Type`);
                        if (specialR <= 3) {
                            moonSize = tRoll1D(`Bracket 1-3 (Tiny)`);
                        } else if (specialR <= 5) {
                            let z = Math.max(0, tRoll2D(`Bracket 4-5 (Standard)`) - 2);
                            moonSize = z === 0 ? 'R' : z;
                        } else {
                            let giantMoon = tRoll2D(`Bracket 6 (Special)`) + 4;
                            if (giantMoon >= 16) {
                                let moonBody = { type: 'Gas Giant', orbitId: w.orbitId, parentStarIdx: w.parentStarIdx, orbitType: w.orbitType };
                                let isGL = w.ggType === 'GL';
                                let upgrade = isGL && tRoll2D('GL Parent Upgrade Check') === 12;
                                tResult(`Satellite ${m + 1} Extreme Result`, upgrade ? 'Medium Gas Giant (GM)' : 'Small Gas Giant (GS)');
                                sizeGasGiantBody(moonBody, upgrade ? 'GM' : 'GS');
                                moonSize = moonBody.ggType;
                                w.moons.push({ ...moonBody, isSpecialGG: true });
                                continue;
                            } else {
                                moonSize = giantMoon;
                            }
                        }
                    }
                }
                if (moonSize === 'R') {
                    tResult(`Satellite ${m + 1}`, 'Ring System');
                    w.rings.push({});
                } else {
                    tResult(`Satellite ${m + 1} Size`, moonSize);
                    let moonObj = {
                        size: moonSize,
                        type: 'Satellite',
                        worldHzco: w.worldHzco,
                        orbitId: w.orbitId,
                        parentStarIdx: w.parentStarIdx,
                        orbitType: w.orbitType,
                        uwpSecondary: `S${toUWPChar(moonSize)}00000-0`
                    };
                    calculateTerrestrialPhysical(moonObj, `Satellite ${m + 1}`, sys);
                    w.moons.push(moonObj);
                }
            }

            // 3. Hill Sphere & Roche Limit
            if (w.mass > 0 && w.diamKm > 0) {
                let hillLimit = MgT2EMath.calculateHillSphereLimit(w.au, w.eccentricity, w.mass, primary.mass, w.diamKm);
                w.hillSpanPd = hillLimit;
                tResult(`${w.type} Hill Sphere Limit (Diameters/2)`, hillLimit);

                if (hillLimit < 1.5) {
                    if (w.moons.length > 0) {
                        w.moons = [];
                        w.rings.push({});
                    }
                }
                if (hillLimit < 0.5) {
                    w.rings = [];
                }

                let numM = w.moons.length;
                if (numM > 0) {
                    let mor = hillLimit - 2;
                    if (mor > 200) mor = 200 + numM;

                    let placementDMW = mor < 60 ? 1 : 0;
                    for (let mn = 0; mn < numM; mn++) {
                        let locRoll = roll1D() + placementDMW;
                        let pdTarget = 0;
                        let locStr = '';
                        if (locRoll <= 3) {
                            pdTarget = ((roll2D() - 2) * mor / 60) + 2; locStr = 'Inner';
                        } else if (locRoll <= 5) {
                            pdTarget = ((roll2D() - 2) * mor / 30) + (mor / 6) + 3; locStr = 'Middle';
                        } else {
                            pdTarget = ((roll2D() - 2) * mor / 20) + (mor / 2) + 4; locStr = 'Outer';
                        }
                        w.moons[mn].pd = pdTarget;
                        w.moons[mn].pos = locStr;

                        let eMod = locStr === 'Inner' ? -1 : (locStr === 'Middle' ? 1 : 4);
                        if (pdTarget > mor) eMod += 6;

                        w.moons[mn].eccentricity = determineMgT2EEccentricity(false, 0, sys.age, w.orbitId, false, eMod);
                        w.moons[mn].retrograde = (roll2D() + eMod >= 10);

                        let moonKm = pdTarget * w.diamKm;
                        w.moons[mn].periodHrs = Math.sqrt(Math.pow(moonKm, 3) / w.mass) / 361730;
                    }

                    w.moons.sort((a, b) => a.pd - b.pd);
                    for (let m = 1; m < w.moons.length; m++) {
                        if (w.moons[m].pd <= w.moons[m - 1].pd) {
                            w.moons[m].pd = w.moons[m - 1].pd + 1.5;
                        }
                    }
                }

                for (let r = 0; r < w.rings.length; r++) {
                    w.rings[r].center = 0.4 + (roll2D() / 8);
                    w.rings[r].span = (roll3D() / 100) + 0.07;
                }
            }
        }

        return sys;
    }

    // =====================================================================
    // CHUNK 4: ATMOSPHERE & HYDROGRAPHICS (ATMOSPHERIC GENERATION)
    // =====================================================================

    /**
     * Generate atmospheric properties and hydrographics for all worlds and moons.
     * Handles temperature bands, runaway greenhouse, atmospheric codes, pressure,
     * oxygen levels, taints, gas retention, and hydrographic percentages.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object|Object} options - Options object or Mainworld baseline data
     * @returns {Object} Modified system object
     */
    function generateAtmospherics(sys, options = {}) {
        let mainworldBase = null;
        let targetWorlds = sys.worlds;

        // Adaptive Signature: (sys, mainworldBase) or (sys, { targetWorlds, mainworldBase })
        if (options && options.type === 'Mainworld') {
            mainworldBase = options;
        } else if (options) {
            mainworldBase = options.mainworldBase;
            targetWorlds = options.targetWorlds || sys.worlds;
        }

        let isBottomUp = (options && options.mode === 'bottom-up');

        let processWorld = (w) => {
            if (w.type === 'Empty' || w.type === 'Gas Giant' || w.type === 'Planetoid Belt') return;

            tSection(`Atmosphere & Hydro: ${w.type} Orbit ${w.orbitId.toFixed(2)}`);
            let tempBand = getTempBand(w.orbitId, w.worldHzco || sys.hzco);
            tResult('Temperature Band', tempBand);

            // Preliminary Temperature Estimation
            if (w.meanTempK === undefined) {
                let pIdx = w.parentStarIdx !== undefined ? w.parentStarIdx : 0;
                let lum = (sys.stars[pIdx] || sys.stars[0]).lum || 1.0;
                if (w.orbitType === 'P-Type') {
                    lum = sys.stars.reduce((s, star) => star.orbitId < w.orbitId ? s + (star.lum || 0) : s, 0);
                }
                w.meanTempK = MgT2EMath.calculateMeanTemperature(lum, w.au, 0.3, 0.1);
            }

            // Gas Retention Physics
            w.diameterTerra = (w.diamKm || (w.size * 1600)) / 12742;
            let bodyMass = w.mass !== undefined ? w.mass : Math.pow(w.size / 8, 3);
            w.maxEscapeValue = MgT2EMath.calculateMaxEscapeValue(bodyMass, w.diamKm || (w.size * 1600), w.meanTempK);
            tResult('Max Escape Value', w.maxEscapeValue.toFixed(3));

            // 1. Base Atmosphere Code
            writeLogLine("--- ATMOSPHERE PHYSICS ---");
            let isMainworldLocked = (w.type === 'Mainworld' && mainworldBase && mainworldBase.atm !== undefined);

            if (w.size === 'S' || w.size === 0 || w.size === 1) {
                tSkip('Size 0, 1, S forces Atmosphere 0');
                w.atmCode = 0;
                writeLogLine(`Base Generation: Size ${w.size} forces Atm 0`);
            } else {
                let baseRoll;
                if (isMainworldLocked) {
                    tResult('Mainworld Atmosphere Inherited', mainworldBase.atm);
                    baseRoll = mainworldBase.atm;
                    writeLogLine(`Base Generation: Inherited Atm ${baseRoll}`);
                } else {
                    let baseRollRaw = tRoll2D('Atmosphere Roll');
                    baseRoll = baseRollRaw - 7 + w.size;
                    tDM('Size Mod', w.size - 7);
                    if (w.size >= 2 && w.size <= 4) {
                        tDM('Size Variant (2-4)', -2);
                        baseRoll -= 2;
                        writeLogLine(`Base Generation: 2D (${baseRollRaw}) - 7 + Size (${w.size}) - Size Variant (2) = Atm ${baseRoll}`);
                    } else {
                        writeLogLine(`Base Generation: 2D (${baseRollRaw}) - 7 + Size (${w.size}) = Atm ${baseRoll}`);
                    }
                }

                // Refined Deviation Logic (Phase 1)
                let diff = getEffectiveHzcoDeviation(w.orbitId, w.worldHzco || sys.hzco);
                let hzco = w.worldHzco || sys.hzco;
                if (hzco < 1.0 && diff < 0) {
                    diff = diff * 10;
                }

                // Flags for Phase 4 Checks
                w._atmHazardFlag = false;
                w._atmExtremeHeatFlag = false;

                if (diff >= -1.00 && diff <= 1.00) {
                    w.atmCode = Math.max(0, baseRoll);
                } else if (diff < -1.00) {
                    // Hot Atmospheres Table
                    tSection('Non-Habitable Zone: Hot Atmospheres');
                    writeLogLine(`Non-HZ Atmosphere: Deviation ${diff.toFixed(2)}, Table: Hot`);
                    let bracketRoll = Math.max(0, Math.min(17, baseRoll));

                    if (diff >= -2.0) {
                        let bracket1 = MgT2EData.atmosphereExtended.hzDeviationTables.hotInner;
                        let hazard1 = [false, false, true, false, true, false, false, true, false, true, "Check", false, false, false, false, false, false, false];
                        w.atmCode = bracket1[bracketRoll];
                        w._atmHazardFlag = hazard1[bracketRoll];
                    } else {
                        let bracket2 = MgT2EData.atmosphereExtended.hzDeviationTables.hotOuter;
                        let hazard2 = [false, false, false, false, "Check", "Check", "Check", "Check", "Check", false, false, false, false, false, false, false, false, false];
                        w.atmCode = bracket2[bracketRoll];
                        w._atmHazardFlag = hazard2[bracketRoll];
                        w._atmExtremeHeatFlag = (diff <= -3.0 && w.atmCode === 10);
                        w._extremeHeatMod = (bracketRoll === 7 || bracketRoll === 8) ? 1 : 0;
                    }
                } else {
                    // Cold Atmospheres Table
                    tSection('Non-Habitable Zone: Cold Atmospheres');
                    writeLogLine(`Non-HZ Atmosphere: Deviation ${diff.toFixed(2)}, Table: Cold`);
                    let bracketRoll = Math.max(0, Math.min(17, baseRoll));

                    if (diff <= 3.0) {
                        let bracket3 = MgT2EData.atmosphereExtended.hzDeviationTables.coldInner;
                        let hazard3 = [false, false, false, "Check", true, false, false, true, false, true, "Check", false, false, false, false, false, false, false];
                        w.atmCode = bracket3[bracketRoll];
                        w._atmHazardFlag = hazard3[bracketRoll];
                    } else {
                        let bracket4 = MgT2EData.atmosphereExtended.hzDeviationTables.coldOuter;
                        let hazard4 = [false, false, false, "Check", true, false, false, true, false, true, "Check", false, false, false, false, false, false, false];
                        w.atmCode = bracket4[bracketRoll];
                        w._atmHazardFlag = hazard4[bracketRoll];
                    }
                }

                let currentMaxAtm = isBottomUp ? 17 : 15;
                if (w.atmCode > currentMaxAtm && w.atmCode !== 16 && w.atmCode !== 17) w.atmCode = currentMaxAtm;

                // Edge Case: Extreme Heat Check
                if (w._atmExtremeHeatFlag) {
                    let heatRoll = tRoll1D('Extreme Heat Check') + w._extremeHeatMod;
                    if (heatRoll === 1) { w.atmCode = 1; tResult('Extreme Heat', 'Code 1 (Trace)'); }
                    else if (heatRoll >= 3 && heatRoll <= 5) { w.atmCode = 11; tResult('Extreme Heat', 'Code B (Corrosive)'); }
                    else if (heatRoll >= 6) { w.atmCode = 12; tResult('Extreme Heat', 'Code C (Insidious)'); }
                    else { tResult('Extreme Heat', 'Unchanged'); }
                }

                if (isMainworldLocked && w.atmCode !== mainworldBase.atm) {
                    writeLogLine(`Expanded Method Simulation: Non-HZ conditions WOULD have forced Atmosphere to ${toUWPChar(w.atmCode)}`);
                    w.atmCode = mainworldBase.atm;
                }
            }

            w.atmCode = Number(w.atmCode);
            let finalMaxAtm = isBottomUp ? 17 : 15;
            w.atmCode = Math.max(0, Math.min(finalMaxAtm, w.atmCode));
            tResult('Final Atmosphere Code', toUWPChar(w.atmCode));

            // 2. Runaway Greenhouse Check
            // GATEWAY: Atm 2-15, Habitable Zone, and Minimum Hot Temperature (313 K+)
            if (w.atmCode >= 2 && w.atmCode <= 15 && tempBand === "Temperate" && w.meanTempK >= 313) {

                // Base DM: +1 per Gyr
                let rgDM = Math.ceil(sys.ageGyr || sys.age || 0);

                // Precise Temperature DM: +1 for every 10 full degrees above 303K
                let preciseDM = Math.floor((w.meanTempK - 303) / 10);
                tDM('Precise Temp', preciseDM);
                rgDM += preciseDM;

                tSection('Runaway Greenhouse Check');
                let rgBaseRoll = tRoll2D('Runaway Greenhouse Roll (12+)');
                let rgTotal = rgBaseRoll + rgDM;

                if (rgTotal >= 12) {
                    tResult('Result', 'Runaway Greenhouse Triggered');
                    writeLogLine(`Runaway Greenhouse Check: Rolled ${rgBaseRoll} + DM ${rgDM}. Result: Success`);
                    w.runawayGreenhouse = true;
                    tempBand = "Boiling";
                    if (w.tempStatus) w.tempStatus = "Boiling";

                    let isStandardRange = (w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14;
                    if (isStandardRange) {
                        let oldCode = w.atmCode;
                        let rRoll = tRoll1D('New Atmosphere Type');
                        if (w.size >= 2 && w.size <= 5) { tDM('Size 2-5', -2); rRoll -= 2; }
                        if ([2, 4, 7, 9].includes(w.atmCode)) { tDM('Tainted Atm', 1); rRoll += 1; }

                        let newAtmCode;
                        if (rRoll <= 1) newAtmCode = 10;
                        else if (rRoll <= 4) newAtmCode = 11;
                        else newAtmCode = 12;

                        if (isMainworldLocked) {
                            tResult('Runaway Shift', `Locked.`);
                            writeLogLine(`Expanded Method Simulation: Runaway Greenhouse WOULD have shifted Atmosphere from ${toUWPChar(oldCode)} to ${toUWPChar(newAtmCode)}`);
                        } else {
                            w.atmCode = newAtmCode;
                            tResult('New Atmosphere', toUWPChar(w.atmCode));
                            writeLogLine(`Runaway Shift: Atm ${toUWPChar(oldCode)} -> ${toUWPChar(w.atmCode)}`);
                        }
                    }
                } else {
                    tResult('Result', 'Normal');
                    writeLogLine(`Runaway Greenhouse Check: Rolled ${rgBaseRoll} + DM ${rgDM}. Result: Failure`);
                }
            }

            if (w.gravity === undefined) {
                w.gravity = (w.size === 0 || w.size === 'S') ? 0 : w.size * 0.125;
            }
            tResult('Gravity (G)', w.gravity.toFixed(3));

            // 3. Seeded Atmospheric Pressure
            if (w.atmCode >= 1 && w.atmCode <= 15) {
                let cdata = MGT2E_ATM_CODES[w.atmCode];
                let seededFraction = rng();
                if (sys.hexId) {
                    seededFraction = rng();
                }
                w.totalPressureBar = cdata.minP + (cdata.spanP * seededFraction);
                w.pressureBar = w.totalPressureBar;
                tResult('Total Pressure (Bar)', w.totalPressureBar.toFixed(2));
                writeLogLine(`Surface Pressure: ${w.totalPressureBar.toFixed(2)} bar (Min ${cdata.minP} + Span ${cdata.spanP} * ${seededFraction.toFixed(3)})`);
            } else if (w.atmCode === 0) {
                w.totalPressureBar = 0;
                w.pressureBar = 0;
                tResult('Total Pressure (Bar)', 'Trace/None');
            }

            // 4. Oxygen Fraction & ppo (Standard Atmospheres)
            if ((w.atmCode >= 2 && w.atmCode <= 9) || w.atmCode === 13 || w.atmCode === 14) {
                tSection('Composition & Scale Height');

                let ageDM = 0;
                let sysAge = sys.ageGyr || sys.age || 0;
                if (sysAge > 4.0) ageDM = 1;
                else if (sysAge >= 3.0 && sysAge <= 3.5) ageDM = -1;
                else if (sysAge >= 2.0 && sysAge <= 2.99) ageDM = -2;
                else if (sysAge < 2.0) ageDM = -4;

                let o2Roll = tRoll1D('Oxygen Base');
                let varRoll = tRoll2D('Oxygen Variance (2D-7)') - 7;
                if (ageDM !== 0) tDM('Age DM', ageDM);

                let oxygenFrac = ((o2Roll + ageDM) / 20) + (varRoll / 100);
                if (oxygenFrac <= 0) {
                    oxygenFrac = Math.max(0.01, (tRoll1D('Oxygen Minimum Reserve') * 0.01) + (Math.floor(rng() * 10) / 100));
                }

                w.oxygenFrac = oxygenFrac;
                w.oxygenFraction = oxygenFrac;
                w.ppoBar = w.oxygenFraction * w.totalPressureBar;
                w.ppo = w.ppoBar;

                let traceFrac = 0.003 + (rng() * 0.017);
                let traceGasChoices = ["Argon", "Carbon Dioxide", "Neon"];
                let traceGasName = traceGasChoices[Math.floor(rng() * traceGasChoices.length)];
                let tracePressure = traceFrac * w.totalPressureBar;

                let n2Frac = Math.max(0, 1.0 - w.oxygenFraction - traceFrac);

                w.taints = w.taints || [];
                if (traceGasName === "Carbon Dioxide" && tracePressure > 0.015) {
                    w.taints.push("High Carbon Dioxide");
                    tResult('Taint', 'High Carbon Dioxide (Gas Mix)');
                    writeLogLine(`Auto-Taint Triggered: Carbon Dioxide trace pressure ${tracePressure.toFixed(3)} bar > 0.015 limit.`);
                }

                tResult('Oxygen Fraction', (w.oxygenFraction * 100).toFixed(1) + '%');
                tResult('Trace Gas', `${traceGasName} ${(traceFrac * 100).toFixed(1)}%`);
                tResult('ppo (Bar)', w.ppoBar.toFixed(3));
                writeLogLine(`Composition: N2 ${(n2Frac * 100).toFixed(1)}% | O2 ${(w.oxygenFraction * 100).toFixed(1)}% | ${traceGasName} ${(traceFrac * 100).toFixed(1)}%`);
                writeLogLine(`Oxygen Partial Pressure: ${w.ppoBar.toFixed(3)} bar`);

                // UWP Auto-Taint Loopback
                w.taints = [];
                let isLowO2 = w.ppoBar < 0.1;
                let isHighO2 = w.ppoBar > 0.5;

                if (isLowO2) { tResult('Taint', 'Low Oxygen'); w.taints.push("Low Oxygen"); }
                if (isHighO2) { tResult('Taint', 'High Oxygen'); w.taints.push("High Oxygen"); }

                if (isLowO2 || isHighO2) {
                    let needsFlip = (w.atmCode === 5 || w.atmCode === 6 || w.atmCode === 8);

                    if (needsFlip) {
                        if (isMainworldLocked) {
                            tResult('Top-Down Gospel', 'Forcing Physics to match UWP Atmosphere');
                            // Remove the taint
                            w.taints = w.taints.filter(t => t !== "Low Oxygen" && t !== "High Oxygen");

                            // Adjust oxygen fraction to force ppo into safe range
                            if (isLowO2) w.ppoBar = 0.10 + (rng() * 0.04);
                            if (isHighO2) w.ppoBar = 0.49 - (rng() * 0.04);
                            w.ppo = w.ppoBar;
                            w.oxygenFraction = w.ppoBar / w.totalPressureBar;

                            // If it pushes oxygen too high or pressure is too low, we adjust pressure instead
                            if (w.oxygenFraction > 0.99 || w.totalPressureBar < 0.1) {
                                w.oxygenFraction = 0.20 + (rng() * 0.10);
                                w.totalPressureBar = w.ppoBar / w.oxygenFraction;
                                w.pressureBar = w.totalPressureBar;
                            }

                            w.oxygenFrac = w.oxygenFraction;
                            writeLogLine(`[PHYSICS ANOMALY] UWP Gospel: Forced ppo to ${w.ppoBar.toFixed(3)} and Pressure to ${w.totalPressureBar.toFixed(2)} to maintain Atm ${w.atmCode.toString(16).toUpperCase()} without taints.`);
                        } else {
                            if (w.atmCode === 5) {
                                tResult('Auto-Taint Loopback', '5 -> 4');
                                w.atmCode = 4;
                            } else if (w.atmCode === 6) {
                                tResult('Auto-Taint Loopback', '6 -> 7');
                                w.atmCode = 7;
                            } else if (w.atmCode === 8) {
                                tResult('Auto-Taint Loopback', '8 -> 9');
                                w.atmCode = 9;
                            }
                            writeLogLine(`Auto-Taint Triggered: ppo ${w.ppoBar.toFixed(3)} is outside safe limits. Atm changed to ${w.atmCode.toString(16).toUpperCase()}.`);
                        }
                    } else if (isMainworldLocked) {
                        writeLogLine(`[PHYSICS VERIFIED] UWP Gospel: Tainted Atm ${w.atmCode.toString(16).toUpperCase()} correctly validated with unsafe ppo ${w.ppoBar.toFixed(3)}.`);
                    }
                }

                // Generate Atmospheric Taints
                let generateAtmosphericTaints = () => {
                    let tRollRaw = tRoll2D('Taint Subtype Roll');
                    let tRoll = tRollRaw;
                    if (w.atmCode === 4) { tDM('Atm 4', -2); tRoll -= 2; }
                    if (w.atmCode === 9) { tDM('Atm 9', 2); tRoll += 2; }
                    let t = MGT2E_TAINT_SUBTYPES[Math.max(2, Math.min(12, tRoll))];

                    let typeRollStr = `Subtype Roll ${tRollRaw}`;
                    if (w.atmCode === 4) typeRollStr += ` - Atm 4 DM (2) = ${tRoll}`;
                    else if (w.atmCode === 9) typeRollStr += ` + Atm 9 DM (2) = ${tRoll}`;
                    typeRollStr += ` -> ${t}`;

                    // Temperature Precision for Sulphur
                    if (t === "Sulphur Compounds" && w.meanTempK !== undefined && w.meanTempK < 273) {
                        tResult('Taint Precision', 'Temp < 273K: Sulphur freezes to Particulates');
                        t = "Particulates";
                        typeRollStr += ` (Sulphur frozen to Particulates <273K)`;
                    }

                    if (t && !w.taints.includes(t)) {
                        tResult('Atm Taint', t);
                        w.taints.push(t);

                        // ppo Retroactive Recalculation
                        if (t === "Low Oxygen") {
                            w.ppoBar = 0.10 - (tRoll1D('Retroactive Low ppo Roll') / 100);
                            w.ppo = w.ppoBar;
                            tResult('Retro ppoBar (L O2)', w.ppoBar.toFixed(3));
                        } else if (t === "High Oxygen") {
                            w.ppoBar = 0.50 + (tRoll1D('Retroactive High ppo Roll') / 10);
                            w.ppo = w.ppoBar;
                            tResult('Retro ppoBar (H O2)', w.ppoBar.toFixed(3));
                        }
                    }

                    let sevRoll = tRoll2D('Taint Severity');
                    let sevIdx = Math.max(1, Math.min(9, sevRoll));
                    w.taintSeverity = MGT2E_TAINT_SEVERITY[sevIdx];
                    tResult('Taint Severity', w.taintSeverity);

                    let sevRollStr = `Severity Roll ${sevRoll} -> ${w.taintSeverity}`;

                    // Lethal Persistence Check
                    let pRoll = tRoll2D('Taint Persistence');
                    let pDM = 0;
                    let pDMStr = "";
                    if (sevIdx === 8 || sevIdx === 9) {
                        let hasOxygenTaint = w.taints.includes("Low Oxygen") || w.taints.includes("High Oxygen");
                        if (hasOxygenTaint) {
                            tDM('Lethal L/H Oxygen', 6);
                            pDM = 6;
                            pDMStr = " + DM 6 (Lethal L/H O2)";
                        } else {
                            tDM('Lethal Taint', 4);
                            pDM = 4;
                            pDMStr = " + DM 4 (Lethal Taint)";
                        }
                    }
                    w.taintPersistence = Math.max(2, pRoll + pDM);
                    tResult('Taint Persistence', w.taintPersistence);

                    let perRollStr = `Persistence Roll ${pRoll}${pDMStr} -> ${w.taintPersistence}`;
                    let taintNum = w.taints.length;
                    writeLogLine(`Taint ${taintNum}: ${typeRollStr}. ${sevRollStr}. ${perRollStr}.`);

                    // Edge Case: Cascading Taints
                    if (tRollRaw === 10) {
                        writeLogLine(`Taint Cascade: Subtype roll was 10, triggering a second taint roll.`);
                        generateAtmosphericTaints();
                    }
                };

                // Edge Case: Irritant Check
                if (w._atmHazardFlag || w._atmHazardFlag === "Check") {
                    tResult('Hazard Flag', 'Irritant/Check Present');
                    if (tRoll1D('Irritant Taint Roll') >= 4) {
                        generateAtmosphericTaints();
                    }
                } else if ([2, 4, 7, 9].includes(w.atmCode)) {
                    generateAtmosphericTaints();
                }

                // Advanced Scale Height
                w.scaleHeight = MgT2EMath.calculateScaleHeight(w.gravity, w.meanTempK);
                tResult('Scale Height (km)', w.scaleHeight.toFixed(2));
                writeLogLine(`Scale Height: ${w.scaleHeight.toFixed(2)} km`);

                // Code D/E Edge Cases
                if (w.atmCode === 13) {
                    let badRatioO2 = w.oxygenFraction > 0 ? w.ppoBar / 0.5 : 1;
                    let badRatioN2 = (w.totalPressureBar - w.ppoBar) / 2.0;
                    let badRatio = Math.max(badRatioO2, badRatioN2);
                    if (badRatio > 1 && w.scaleHeight > 0) {
                        w.safeAlt = Math.log(badRatio) * w.scaleHeight;
                        tResult('Safe Altitude (km)', w.safeAlt.toFixed(2));
                        writeLogLine(`Code D Minimum Safe Altitude: ${w.safeAlt.toFixed(2)} km (O2 Ratio: ${badRatioO2.toFixed(2)}, N2 Ratio: ${badRatioN2.toFixed(2)})`);

                        let newPressure = w.totalPressureBar / Math.exp(w.safeAlt / w.scaleHeight);
                        let newPpo = w.oxygenFraction * newPressure;
                        if (newPpo < 0.1) {
                            w.noSafeAltitude = true;
                            tResult('No Safe Altitude', 'True');
                            if (tRoll1D('Safe Alt Taint Check') >= 4) {
                                generateAtmosphericTaints();
                            }
                        }
                    }
                }
                if (w.atmCode === 14 && w.ppoBar > 0) {
                    let badRatio = 0.1 / w.ppoBar;
                    if (badRatio > 1 && w.scaleHeight > 0) {
                        w.safeAltBelowMean = Math.log(badRatio) * w.scaleHeight;
                        tResult('Safe Depth (km)', w.safeAltBelowMean.toFixed(2));
                        writeLogLine(`Code E Safe Depth: ${w.safeAltBelowMean.toFixed(2)} km below mean`);

                        let newPressure = w.totalPressureBar * Math.exp(w.safeAltBelowMean / w.scaleHeight);
                        let newN2 = (1 - w.oxygenFraction) * newPressure;
                        if (newN2 > 2.0) {
                            w.nitrogenNarcosisDepth = true;
                            tResult('Nitrogen Narcosis', 'True');
                            if (tRoll1D('Narcosis Taint Check') >= 4) {
                                generateAtmosphericTaints();
                            }
                        }
                    }
                }

                // Integration & Profile String
                w.atmProfile = `${toUWPChar(w.atmCode)}-${w.totalPressureBar.toFixed(2)}-${w.ppoBar.toFixed(3)}`;
                tResult('Atm Profile', w.atmProfile);

            } else if (w.atmCode >= 10 && w.atmCode <= 12) {
                // Exotic Gas Retention (DPM)
                tSection('Exotic Gas Retention (DPM)');
                let massTerra = w.mass || 0.001;
                let diamTerra = w.diamKm ? (w.diamKm / 12742) : (w.size * 1600 / 12742) || 0.001;
                w.maxEscapeValue = MgT2EMath.calculateMaxEscapeValue(massTerra, w.diamKm || (w.size * 1600), w.meanTempK);

                const dpmGasData = MgT2EData.atmosphereExtended.gasRetentionData;

                writeLogLine(`Max Escape Value: ${w.maxEscapeValue.toFixed(3)} (1000 * (${massTerra.toFixed(3)} / (${diamTerra.toFixed(2)} * ${w.meanTempK.toFixed(1)})))`);

                let retainedGases = [];
                w.taints = w.taints || [];

                for (let g of dpmGasData) {
                    if (g.weight > 0 && g.ev < w.maxEscapeValue && w.meanTempK > g.bp) {
                        let gasObj = { name: g.name, weight: g.weight, taint: g.taint };

                        // CO -> CO2 constraint
                        if (g.name === "Carbon Monoxide" && w.hydroPercent > 0) {
                            tResult('CO Constraint', 'Water present -> Carbon Dioxide');
                            writeLogLine('Carbon Monoxide converted to Carbon Dioxide due to presence of H2O.');
                            gasObj.name = "Carbon Dioxide";
                        }
                        retainedGases.push(gasObj);
                    }
                }

                if (retainedGases.length === 0) {
                    retainedGases.push({ name: w.maxEscapeValue > 0.2 ? "Heavy Gases" : "Trace Gases", weight: 100, taint: false });
                }

                // Aggregate weights by name
                let aggregatedGases = {};
                let totalWeight = 0;
                for (let g of retainedGases) {
                    if (!aggregatedGases[g.name]) {
                        aggregatedGases[g.name] = { weight: 0, taint: g.taint };
                    }
                    aggregatedGases[g.name].weight += g.weight;
                    aggregatedGases[g.name].taint = aggregatedGases[g.name].taint || g.taint;
                }

                for (let key in aggregatedGases) {
                    totalWeight += aggregatedGases[key].weight;
                    if (aggregatedGases[key].taint && !w.taints.includes(key)) {
                        w.taints.push(key);
                        tResult('Atm Taint', key);
                    }
                }

                let mixStrings = [];
                for (let name in aggregatedGases) {
                    let pct = (aggregatedGases[name].weight / totalWeight) * 100;
                    mixStrings.push(`${name} ${pct.toFixed(1)}%`);
                }

                mixStrings.sort((a, b) => parseFloat(b.split(' ')[b.split(' ').length - 1]) - parseFloat(a.split(' ')[a.split(' ').length - 1]));

                w.gases = mixStrings;
                tResult('Gas Mix', w.gases.join(', '));
                writeLogLine(`Retained Gases: ${w.gases.join(', ')}`);

                w.atmProfile = `${toUWPChar(w.atmCode)}-${w.totalPressureBar.toFixed(2)}-0.000`;
                tResult('Atm Profile', w.atmProfile);
            } else if (w.atmCode === 15) {
                // Unusual Atmosphere (Code F)
                tSection('Unusual Atmosphere (Code F)');

                let tens = tRoll1D('First Die (1-2)');
                tens = (tens <= 3) ? 1 : 2;
                let ones = tRoll1D('Second Die (1-6)');
                let d26 = (tens * 10) + ones;

                let subtypeData = MgT2EData.atmosphereExtended.unusualSubtypes[d26];
                let subtypeName = subtypeData ? subtypeData.name : "Unusual";
                let subtypeCode = subtypeData ? subtypeData.code : "F";

                tResult('Unusual Subtype', `${d26} - ${subtypeName}`);
                writeLogLine(`Code F Roll: D26 ${d26} -> Subtype ${subtypeName}`);

                // Enforce Prerequisites
                if (subtypeData && subtypeData.minPressure) {
                    if (w.totalPressureBar < subtypeData.minPressure) {
                        w.totalPressureBar = subtypeData.minPressure + (rng() * subtypeData.minPressure);
                        tResult('Constraint', `${subtypeName} forces pressure ${subtypeData.minPressure}+ bar`);
                    }
                }
                if (subtypeData && subtypeData.minGravity) {
                    if (w.gravity <= subtypeData.minGravity) {
                        w.gravity = subtypeData.minGravity + (rng() * 0.5);
                        tResult('Constraint', `${subtypeName} forces Gravity > ${subtypeData.minGravity}`);
                    }
                }
                if (subtypeData && subtypeData.minHydro) {
                    w.hydroCode = subtypeData.minHydro;
                    tResult('Constraint', `${subtypeName} forces Hydro ${subtypeData.minHydro}`);
                }

                w.pressureBar = w.totalPressureBar;
                w.gases = [subtypeName];
                w.atmProfile = `F-St${subtypeCode}`;
                tResult('Atm Profile', w.atmProfile);
            } else if (w.atmCode <= 1) {
                w.atmProfile = `${toUWPChar(w.atmCode)}-None-0.000`;
                tResult('Atm Profile', w.atmProfile);
            }

            // 6. Hydrographics
            tSection('Hydrographics');
            w.hydroCode = 0;
            if (w.type === 'Mainworld' && mainworldBase && mainworldBase.hydro !== undefined) {
                tSkip('Mainworld Hydro Inherited');
                w.hydroCode = mainworldBase.hydro;
            } else if (!['S', 0, 1].includes(w.size)) {
                let hMod = 0;
                if ([0, 1, 10, 11, 12, 15].includes(w.atmCode)) { tDM('Desert Atm', -4); hMod -= 4; }
                if (tempBand === "Hot" && w.atmCode !== 13) { tDM('Hot', -2); hMod -= 2; }
                if (tempBand === "Boiling" && w.atmCode !== 13) { tDM('Boiling', -6); hMod -= 6; }

                w.hydroCode = Math.max(0, Math.min(10, tRoll2D('Hydro Roll') - 7 + w.atmCode + hMod));
                tDM('Atm Mod', w.atmCode);
            }

            w.hydroPercent = MGT2E_HYDRO_RANGES[w.hydroCode] + Math.floor(rng() * 10);
            if (w.hydroCode === 0) w.hydroPercent = Math.floor(rng() * 6);
            tResult('Final Hydro Code', toEHex(w.hydroCode));
            tResult('Hydro Percentage', w.hydroPercent + '%');

            let distRoll = Math.max(0, Math.min(10, tRoll2D('Surface Liquid Distribution (2D-2)') - 2));
            w.surfaceDist = MGT2E_SURFACE_DISTS[distRoll];
            w.liquidType = "Water";

            if (w.atmCode >= 10 && w.atmCode <= 12 && w.hydroPercent > 0) {
                if (tempBand === "Boiling" || tempBand === "Hot") w.liquidType = "Sulphuric Acid";
                if (tempBand === "Cold" || tempBand === "Frozen") w.liquidType = "Methane";
            }
            w.tempBand = tempBand;
            tResult('Surface Distribution', w.surfaceDist);
            tResult('Liquid Type', w.liquidType);

            // Sync final physical codes back to UWP strings
            let finalAtmChar = toUWPChar(w.atmCode);
            let finalHydroChar = toUWPChar(w.hydroCode);

            let updateUWPChar = (uwpStr, idx, char) => {
                if (!uwpStr || uwpStr.length <= idx || uwpStr === '-') return uwpStr;
                const chars = uwpStr.split('');
                chars[idx] = char;
                return chars.join('');
            };

            if (w.type === 'Mainworld' && mainworldBase && mainworldBase.uwp && !isMainworldLocked) {
                mainworldBase.uwp = updateUWPChar(mainworldBase.uwp, 2, finalAtmChar);
                mainworldBase.uwp = updateUWPChar(mainworldBase.uwp, 3, finalHydroChar);
                mainworldBase.atm = w.atmCode;
                mainworldBase.hydro = w.hydroCode;
                w.atm = w.atmCode;
                w.hydro = w.hydroCode;
            } else if (w.uwpSecondary) {
                w.uwpSecondary = updateUWPChar(w.uwpSecondary, 2, finalAtmChar);
                w.uwpSecondary = updateUWPChar(w.uwpSecondary, 3, finalHydroChar);
                w.atm = w.atmCode;
                w.hydro = w.hydroCode;
                w.uwpSecondaryAtm = w.atmCode;
                w.uwpSecondaryHydro = w.hydroCode;
            } else {
                w.atm = w.atmCode;
                w.hydro = w.hydroCode;
            }
        };

        for (let i = 0; i < sys.worlds.length; i++) {
            let w = sys.worlds[i];

            // Physics Guards
            if (w.size === 0 || w.size === 'R' || w.type === 'Empty') {
                w.gravity = 0;
                w.mass = 0;
                w.escapeVel = 0;
                w.orbitalVelSurface = 0;
                continue;
            }

            // Tighten Floating-Point Precision
            if (typeof w.size === 'number' && w.size > 0 && w.mass !== undefined) {
                let mathSize = w.size === 'S' ? 0.375 : w.size;
                w.escapeVel = MgT2EMath.calculateEscapeVelocity(w.mass, mathSize);
                w.orbitalVelSurface = MgT2EMath.calculateOrbitalVelocity(w.escapeVel);
            }

            processWorld(w);

            for (let j = 0; j < w.moons.length; j++) {
                let m = w.moons[j];

                // Apply guards to moons
                if (m.size === 0 || m.size === 'R' || m.type === 'Empty') {
                    m.gravity = 0;
                    m.mass = 0;
                    m.escapeVel = 0;
                    m.orbitalVelSurface = 0;
                    continue;
                }

                if (typeof m.size === 'number' && m.size > 0 && m.mass !== undefined) {
                    let mathSize = m.size === 'S' ? 0.375 : m.size;
                    m.escapeVel = MgT2EMath.calculateEscapeVelocity(m.mass, mathSize);
                    m.orbitalVelSurface = MgT2EMath.calculateOrbitalVelocity(m.escapeVel);
                }

                let fauxMoon = Object.assign({}, m);
                fauxMoon.orbitId = w.orbitId;
                fauxMoon.au = w.au; // INHERIT AU FROM PARENT PLANET
                fauxMoon.worldHzco = w.worldHzco;
                fauxMoon.type = 'Satellite'; // Retain type for processWorld
                processWorld(fauxMoon);

                // Sync processed data back to moon record
                let syncRes = Object.assign({}, fauxMoon);
                syncRes.type = 'Satellite'; // Restore type
                w.moons[j] = syncRes;
            }
        }

        return sys;
    }

    // =====================================================================
    // CHUNK 5: ROTATIONAL DYNAMICS (TEMPERATURE & ROTATION)
    // =====================================================================

    /**
     * Generate rotational dynamics for all worlds and moons.
     * Handles sidereal day, axial tilt, solar day, tidal locking, mean temperature,
     * and high/low temperature diurnals.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object|Object} options - Options object or Mainworld baseline data
     * @returns {Object} Modified system object
     */
    function generateRotationalDynamics(sys, options = {}) {
        let mainworldBase = null;
        let targetWorlds = sys.worlds;

        // Adaptive Signature: (sys, mainworldBase) or (sys, { targetWorlds, mainworldBase })
        if (options && options.type === 'Mainworld') {
            mainworldBase = options;
        } else if (options) {
            mainworldBase = options.mainworldBase;
            targetWorlds = options.targetWorlds || sys.worlds;
        }

        let primary = sys.stars[0];
        tSection('Temperature & Rotation');

        let processBody = (w, parent, isMoon) => {
            if (w.type === 'Empty') return;

            if (w.type === 'Planetoid Belt' || w.size === 0 || w.size === 'R') {
                w.siderealHours = null;
                w.solarDayHours = null;
                w.axialTilt = null;
                w.tidallyLocked = false;

                // Calculate only orbital mean temperature, skip diurnals
                let hzco = w.worldHzco || sys.hzco;
                w.albedo = getMgT2EAlbedo(w, hzco);
                let srcLum = primary.lum || 1.0;
                if (w.au > 0) {
                    w.meanTempK = MgT2EMath.calculateMeanTemperature(srcLum, w.au, w.albedo, 0.1);
                } else {
                    w.meanTempK = 3;
                }
                w.highTempK = null;
                w.lowTempK = null;
                return;
            } else {
                tSection(`${isMoon ? 'Moon' : w.type} Orbit ${w.orbitId.toFixed(2)} Rotation`);

                // 1. Sidereal Day
                let sRoll1 = tRoll2D('Base Sidereal Day Roll');
                let sRoll2 = tRoll1D('Sidereal Day Adjust');
                let sMult = (w.type === 'Gas Giant' || w.size === 0 || w.size === 'S') ? 2 : 4;
                tResult('Rotation Multiplier', sMult);
                let ageDm = Math.floor((sys.age || 0) / 2);
                w.siderealHours = ((sRoll1 - 2) * sMult) + 2 + sRoll2 + ageDm;

                // Safety: Ensure siderealHours is a finite number
                if (!Number.isFinite(w.siderealHours)) {
                    console.error(`[MgT2E World Engine] Invalid siderealHours calculated for ${w.type}: ${w.siderealHours}. Age: ${sys.age}, sRoll1: ${sRoll1}, sRoll2: ${sRoll2}, ageDm: ${ageDm}`);
                    w.siderealHours = 24.0; // Fallback to standard day
                }

                let extRoll = w.siderealHours;
                let extCount = 0;
                while (extRoll >= 40) {
                    if (tRoll1D(`Extension ${++extCount} Roll (5+)`) >= 5) {
                        let bonusRoll1 = tRoll2D(`Extension ${extCount} Base`);
                        let bonusRoll2 = tRoll1D(`Extension ${extCount} Adjust`);
                        let bonus = ((bonusRoll1 - 2) * sMult) + 2 + bonusRoll2 + ageDm;
                        w.siderealHours += bonus;
                        extRoll = bonus;
                    } else {
                        break;
                    }
                }
                let minRoll = Math.floor(rng() * 60);
                let secRoll = Math.floor(rng() * 60);
                w.siderealHours += (minRoll / 60) + (secRoll / 3600);
                tResult('Fractional Adjust', `${minRoll}m ${secRoll}s`);
                tResult('Sidereal Hours', w.siderealHours.toFixed(4));

                // 2. Axial Tilt
                tSection('Axial Tilt');
                w.axialTilt = generateMgT2EAxialTilt();
                tResult('Final Axial Tilt', w.axialTilt + '°');

                // 3. Solar Day
                let pYears = w.periodYears;
                if (isMoon) {
                    if (!w.periodYears) {
                        w.periodYears = (w.periodHrs || 24) / 8760;
                    }
                    pYears = w.periodYears;
                }
                w.yearHours = pYears * 8760;

                let effectiveSidereal = w.siderealHours;
                if (w.axialTilt > 90) {
                    effectiveSidereal = -w.siderealHours;
                }

                if (Math.abs(w.siderealHours - w.yearHours) < 0.001) {
                    w.solarDaysInYear = 0;
                    w.solarDayHours = Infinity;
                    w.isTwilightZone = true;
                    writeLogLine(`  Twilight Zone World (Tidally Locked): Sidereal equals Year exactly.`);
                } else {
                    w.solarDaysInYear = (w.yearHours / effectiveSidereal) - 1;
                    if (Math.abs(w.solarDaysInYear) > 0.0001) {
                        w.solarDayHours = Math.abs(w.yearHours / w.solarDaysInYear);
                    } else {
                        w.solarDayHours = Infinity;
                    }
                }
                tResult('Solar Day (Hours)', (w.solarDayHours === Infinity || w.solarDayHours > 999999) ? 'Infinity' : w.solarDayHours.toFixed(2));

                // 4. Tidal Lock
                tSection('Tidal Lock Check');
                let dmResult = calculateTidalLockDMs(w, sys, parent, isMoon);
                let lockDM = dmResult.Total_DM;
                w.Selected_Case = dmResult.Selected_Case;
                tResult('Global DM', dmResult.Global_DM);
                tResult('Total Lock DM', lockDM);
                tResult('Dominant Force', dmResult.Selected_Case);

                executeTidalLockRoll(w, sys, lockDM, dmResult.Selected_Case);
            }

            // 5. Mean Temperature
            tSection('Mean Temperature');
            w.albedo = getMgT2EAlbedo(w, w.worldHzco || sys.hzco);
            tResult('Bond Albedo', w.albedo.toFixed(3));
            let initialGF = 0.5 * Math.sqrt(w.totalPressureBar || w.pressureBar || 0);
            let finalGF = 0;

            if (w.atmCode === 0) {
                finalGF = 0;
            } else if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14].includes(w.atmCode)) {
                finalGF = initialGF + (tRoll3D('Greenhouse Factor Roll (3D*0.01)') * 0.01);
            } else if (w.atmCode === 10 || w.atmCode === 15) {
                let mult = tRoll1D('GF Multiplier (1D-1)') - 1;
                if (mult < 0.5) mult = 0.5;
                finalGF = initialGF * mult;
            } else if ([11, 12, 16, 17].includes(w.atmCode)) {
                let d1 = tRoll1D('GF Basis (1D)');
                if (d1 <= 5) {
                    finalGF = initialGF * tRoll1D('GF Multiplier (1D)');
                } else {
                    finalGF = initialGF * tRoll3D('GF Multiplier (3D)');
                }
            } else {
                finalGF = initialGF;
            }

            w.greenhouseFactor = finalGF;
            tResult('GFactor', w.greenhouseFactor.toFixed(3));

            let srcLum = primary.lum || 1.0;
            let currentAu = w.au || (parent ? parent.au : 0);
            if (currentAu > 0) {
                w.meanTempK = MgT2EMath.calculateMeanTemperature(srcLum, currentAu, w.albedo, w.greenhouseFactor);
            } else {
                w.meanTempK = 3;
            }
            tResult('Mean Temp (K)', w.meanTempK.toFixed(1) + ' K');

            // 6. High/Low Temperatures
            tSection('Temp Diurnals');
            w.highTempK = w.meanTempK;
            w.lowTempK = w.meanTempK;
            let tfactor = Math.abs(Math.sin((w.axialTilt || 0) * Math.PI / 180));
            if (w.yearHours < (36.5 * 24)) { tSkip('Quick Year Adjust'); tfactor /= 2; }
            if (w.yearHours > (2 * 8760)) { tSkip('Slow Year Adjust'); tfactor *= 1.5; }

            let rfactor = w.solarDayHours <= 0 || w.solarDayHours === Infinity ? 1.0 : Math.sqrt(w.solarDayHours / 50);
            if (w.tidallyLocked) { tSkip('Tidal Lock Temp Equalization'); rfactor = 1.0; }
            if (rfactor > 1.0) rfactor = 1.0;

            let gfactor = (10 - (w.hydroCode || 0)) / 20;
            if (w.surfaceDist && w.surfaceDist.includes('Concentrated')) gfactor -= 0.1;
            if (w.surfaceDist && w.surfaceDist.includes('Dispersed')) gfactor += 0.1;

            let afactor = 1 + (w.pressureBar || 0);
            let vfactor = Math.max(0, Math.min(1.0, tfactor + rfactor + gfactor));
            let lumMod = vfactor / afactor;

            let highLum = srcLum * (1 + lumMod);
            let lowLum = srcLum * (1 - lumMod);
            let nearAu = currentAu * (1 - (w.eccentricity || 0));
            let farAu = currentAu * (1 + (w.eccentricity || 0));

            if (nearAu > 0) w.highTempK = MgT2EMath.calculateMeanTemperature(highLum, nearAu, w.albedo, w.greenhouseFactor);
            if (farAu > 0) w.lowTempK = MgT2EMath.calculateMeanTemperature(lowLum, farAu, w.albedo, w.greenhouseFactor);
            tResult('High Temp (K)', w.highTempK.toFixed(1) + ' K');
            tResult('Low Temp (K)', w.lowTempK.toFixed(1) + ' K');
        };

        for (let i = 0; i < targetWorlds.length; i++) {
            let w = targetWorlds[i];
            if (w.moons) {
                for (let j = 0; j < w.moons.length; j++) {
                    processBody(w.moons[j], w, true);
                }
            }
            processBody(w, null, false);
        }

        return sys;
    }

    /**
     * Helper: Generate axial tilt
     */
    function generateMgT2EAxialTilt() {
        let roll = roll2D();
        let tilt = 0;
        if (roll <= 4) tilt = (roll1D() - 1) / 50;
        else if (roll === 5) tilt = roll1D() / 5;
        else if (roll === 6) tilt = roll1D();
        else if (roll === 7) tilt = 6 + roll1D();
        else if (roll <= 9) tilt = 5 + roll1D() * 5;
        else {
            let ex = roll1D();
            if (ex <= 2) tilt = 10 + roll1D() * 10;
            else if (ex === 3) tilt = 30 + roll1D() * 10;
            else if (ex === 4) tilt = 90 + roll1D();
            else if (ex === 5) tilt = 180 - roll1D();
            else tilt = 120 + roll1D() * 10;
        }
        return tilt;
    }

    /**
     * Helper: Get albedo for a world
     */
    function getMgT2EAlbedo(w, hzco) {
        let albedo = 0;
        const orbit = w.orbitId;

        if (w.type === 'Gas Giant') {
            albedo = 0.05 + (tRoll2D('Base Albedo (Gas Giant)') * 0.05);
        } else {
            if (orbit <= hzco + 2) {
                albedo = 0.04 + ((tRoll2D('Base Albedo (Rocky)') - 2) * 0.02);
            } else if (orbit > hzco + 2 && orbit <= hzco + 4) {
                albedo = 0.20 + ((tRoll2D('Base Albedo (Icy Near)') - 3) * 0.05);
            } else {
                albedo = 0.25 + ((tRoll2D('Base Albedo (Icy Far)') - 2) * 0.07);
            }

            if (albedo <= 0.40) {
                albedo -= ((tRoll1D('Albedo Constraint Subtract') - 1) * 0.05);
            }
        }

        if ((w.atmCode >= 1 && w.atmCode <= 3) || w.atmCode === 14) {
            albedo += ((tRoll2D('Albedo Mod (Atm 1-3/E)') - 3) * 0.01);
        }
        else if (w.atmCode >= 4 && w.atmCode <= 9) {
            albedo += (tRoll2D('Albedo Mod (Atm 4-9)') * 0.01);
        }
        else if ((w.atmCode >= 10 && w.atmCode <= 12) || w.atmCode === 15) {
            albedo += ((tRoll2D('Albedo Mod (Atm A-C/F)') - 2) * 0.05);
        }
        else if (w.atmCode === 13) {
            albedo += (tRoll2D('Albedo Mod (Atm D)') * 0.03);
        }

        if (w.hydroCode >= 2 && w.hydroCode <= 5) {
            albedo += ((tRoll2D('Albedo Mod (Hydro 2-5)') - 2) * 0.02);
        }
        else if (w.hydroCode >= 6) {
            albedo += ((tRoll2D('Albedo Mod (Hydro 6+)') - 4) * 0.03);
        }

        return Math.max(0.02, Math.min(0.98, albedo));
    }

    /**
     * Helper: Calculate tidal lock DMs
     */
    function calculateTidalLockDMs(body, sys, parent, isMoon) {
        let globalDM = 0;

        let bSize = body.size === 'GG' ? 10 : (typeof body.size === 'number' ? body.size : 0);
        if (bSize >= 1) globalDM += Math.ceil(bSize / 3);

        let ecc = body.eccentricity || 0;
        if (ecc > 0.1) globalDM -= Math.floor(ecc * 10);

        let tilt = body.axialTilt || 0;
        if (tilt > 30) globalDM -= 2;
        if (tilt >= 60 && tilt <= 120) globalDM -= 4;
        if (tilt >= 80 && tilt <= 100) globalDM -= 4;

        let pressure = body.pressureBar || 0;
        if (pressure > 2.5) globalDM -= 2;

        let age = sys.age || 0;
        if (age < 1.0) globalDM -= 2;
        else if (age >= 5.0 && age <= 10.0) globalDM += 2;
        else if (age > 10.0) globalDM += 4;

        let highestTotalDM = -9999;
        let selectedCase = 'None';

        if (isMoon && parent) {
            let caseBDM = globalDM + 6;
            let pMass = parent.mass || 0;

            let orbitPD = body.pd || 0;
            if (orbitPD > 20) caseBDM -= Math.floor(orbitPD / 20);

            if (body.retrograde) caseBDM -= 2;

            if (pMass > 1000) caseBDM += 8;
            else if (pMass >= 100) caseBDM += 6;
            else if (pMass >= 10) caseBDM += 4;
            else if (pMass >= 1) caseBDM += 2;

            if (caseBDM > highestTotalDM) {
                highestTotalDM = caseBDM;
                selectedCase = 'Case B';
            }
        }

        if (!isMoon) {
            let caseADM = globalDM - 4;

            let oDist = body.orbitId || 0;
            if (oDist < 1.0) caseADM += 4 + Math.floor(10 * (1 - oDist));
            else if (oDist >= 1.0 && oDist <= 2.0) caseADM += 4;
            else if (oDist > 2.0 && oDist <= 3.0) caseADM += 1;
            else if (oDist > 3.0) caseADM -= (Math.floor(oDist) * 2);

            let starMassSum = 0;
            let totalStarsOrbited = 0;
            if (body.orbitType === 'P-Type') {
                for (let s of sys.stars) {
                    let sOrb = (s.orbitId !== null && s.orbitId !== undefined) ? s.orbitId : 0;
                    if (sOrb < oDist) {
                        starMassSum += (s.mass || 0);
                        totalStarsOrbited++;
                    }
                }
                if (totalStarsOrbited === 0) {
                    starMassSum = sys.stars[0].mass || 1;
                    totalStarsOrbited = 1;
                }
            } else {
                let pIdx = (body.parentStarIdx !== undefined) ? body.parentStarIdx : 0;
                starMassSum = (sys.stars[pIdx] || sys.stars[0]).mass || 1;
                totalStarsOrbited = 1;
            }

            if (starMassSum < 0.5) caseADM -= 2;
            else if (starMassSum >= 0.5 && starMassSum <= 1.0) caseADM -= 1;
            else if (starMassSum >= 2.0 && starMassSum <= 5.0) caseADM += 1;
            else if (starMassSum > 5.0) caseADM += 2;

            if (totalStarsOrbited > 1) caseADM -= totalStarsOrbited;

            if (body.moons && body.moons.length > 0) {
                let moonSizeSum = 0;
                for (let m of body.moons) {
                    let mSize = m.size === 'GG' ? 10 : (typeof m.size === 'number' ? m.size : 0);
                    if (mSize >= 1) moonSizeSum += mSize;
                }
                caseADM -= moonSizeSum;
            }

            if (caseADM > highestTotalDM) {
                highestTotalDM = caseADM;
                selectedCase = 'Case A';
            }
        }

        if (!isMoon && ['Terrestrial Planet', 'Mainworld'].includes(body.type)) {
            if (body.moons && body.moons.length > 0) {
                let lockedMoons = body.moons.filter(m => m.tidallyLocked === true);
                if (lockedMoons.length > 0) {
                    let totalSig = body.moons.filter(m => {
                        let mSize = m.size === 'GG' ? 10 : (typeof m.size === 'number' ? m.size : 0);
                        return mSize >= 1;
                    }).length;

                    for (let lm of lockedMoons) {
                        let caseCDM = globalDM - 10;
                        let mSize = lm.size === 'GG' ? 10 : (typeof lm.size === 'number' ? lm.size : 0);
                        caseCDM += mSize;

                        let lmpd = lm.pd || 0;
                        if (lmpd < 5) caseCDM += 5 + Math.ceil((5 - lmpd) * 5);
                        else if (lmpd >= 5 && lmpd <= 10) caseCDM += 4;
                        else if (lmpd > 10 && lmpd <= 20) caseCDM += 2;
                        else if (lmpd > 20 && lmpd <= 40) caseCDM += 1;
                        else if (lmpd > 60) caseCDM -= 6;

                        if (totalSig > 1) caseCDM -= (totalSig - 1) * 2;

                        if (caseCDM > highestTotalDM) {
                            highestTotalDM = caseCDM;
                            selectedCase = 'Case C';
                        }
                    }
                }
            }
        }

        return { Global_DM: globalDM, Total_DM: highestTotalDM, Selected_Case: selectedCase };
    }

    /**
     * Helper: Execute tidal lock roll
     */
    function executeTidalLockRoll(body, sys, totalDM, selectedCase) {
        let resultValue = 0;
        let isMoon = selectedCase === 'Case B';
        let isPlanetToStar = selectedCase === 'Case A';

        if (totalDM <= -10) {
            tResult('Tidal Lock Gate', 'No Effect (DM <= -10)');
        } else if (totalDM >= 10) {
            tResult('Tidal Lock Gate', 'Automatic 1:1 Lock');
            resultValue = 12;
        } else {
            let r = tRoll2D('Tidal Lock Roll');
            resultValue = r + totalDM;
            tResult('Tidal Lock Result', resultValue);
        }

        let finalResult = resultValue;
        body.tidallyLocked = false;

        if (totalDM > -10) {
            if (resultValue >= 12) {
                let breakRoll = tRoll2D('Lock Break Check (12 breaks entirely)');
                if (breakRoll === 12) {
                    let rerollResult = tRoll2D('Tidal Lock Reroll (0 DM)');

                    let tempHrs = body.siderealHours;
                    let broken = true;

                    if (rerollResult <= 2) {
                        tempHrs = body.siderealHours;
                    } else if (rerollResult >= 3 && rerollResult <= 6) {
                        tempHrs = body.siderealHours * [1.5, 2, 3, 5][rerollResult - 3];
                    } else if (rerollResult >= 7 && rerollResult <= 8) {
                        let d = rerollResult === 7 ? 5 : 20;
                        tempHrs = 3.5 * d * 24;
                    } else if (rerollResult >= 9 && rerollResult <= 10) {
                        let d = rerollResult === 9 ? 10 : 50;
                        tempHrs = 3.5 * d * 24;
                    } else if (rerollResult === 11) {
                        tempHrs = body.yearHours * 0.66;
                    } else if (rerollResult >= 12) {
                        tempHrs = body.yearHours;
                    }

                    if (isMoon && tempHrs > body.yearHours) {
                        tResult('Lock Break', 'Ignored (Rotation > Orbital Period for Moon)');
                        broken = false;
                    }

                    if (broken) {
                        tResult('Lock Break', `Broken! Using rerolled result ${rerollResult}`);
                        finalResult = rerollResult;
                    }
                }
            }

            let appliedHrs = null;

            if (finalResult <= 2) {
                tResult('Status', 'No effect');
            } else if (finalResult >= 3 && finalResult <= 6) {
                let mult = [1.5, 2, 3, 5][finalResult - 3];
                appliedHrs = body.siderealHours * mult;
                tResult('Status', `siderealHours * ${mult}`);
            } else if (finalResult >= 7 && finalResult <= 8) {
                let mRoll = tRoll1D('Prograde Days Roll');
                let d = finalResult === 7 ? 5 : 20;
                appliedHrs = mRoll * d * 24;
                tResult('Status', `Prograde: ${appliedHrs} hours`);
            } else if (finalResult >= 9 && finalResult <= 10) {
                let mRoll = tRoll1D('Retrograde Days Roll');
                let d = finalResult === 9 ? 10 : 50;
                appliedHrs = mRoll * d * 24;
                if (body.axialTilt < 90) {
                    body.axialTilt = 180 - body.axialTilt;
                    tResult('Retrograde Tilt', body.axialTilt.toFixed(1) + '°');
                }
                tResult('Status', `Retrograde: ${appliedHrs} hours`);
            } else if (finalResult === 11) {
                appliedHrs = body.yearHours * 0.66;
                tResult('Status', '3:2 Resonance');
                if (body.axialTilt > 3.0) {
                    body.axialTilt = (tRoll2D('Resonance Tilt Jitter') - 2) / 10;
                    tResult('Resonance Tilt Override', body.axialTilt.toFixed(1) + '°');
                }
            } else if (finalResult >= 12) {
                appliedHrs = body.yearHours;
                tResult('Status', '1:1 Lock');
                body.tidallyLocked = true;
                if (body.axialTilt > 3.0) {
                    body.axialTilt = (tRoll2D('Locked Tilt Jitter') - 2) / 10;
                    tResult('Locked Tilt Override', body.axialTilt.toFixed(1) + '°');
                }
                if (body.eccentricity > 0.1) {
                    let currentOrbitType = body.orbitType || 'S-Type';
                    let isPType = currentOrbitType === 'P-Type';
                    body.eccentricity = determineMgT2EEccentricity(false, 0, sys.age, body.orbitId, false, isPType ? -2 : -2);
                    tResult('Locked Ecc Override', body.eccentricity.toFixed(3));
                }
            }

            if (appliedHrs !== null) {
                body.siderealHours = appliedHrs;
            }
        }

        if (body.tidallyLocked && finalResult >= 12) {
            if (isPlanetToStar) {
                body.isTwilightZone = true;
                body.solarDayHours = Infinity;
                writeLogLine(`  Twilight Zone World (1:1 Tidal Lock to Star)`);
            }
        }

        let effectiveSidereal = body.siderealHours;
        if (body.axialTilt > 90) {
            effectiveSidereal = -body.siderealHours;
        }

        if (Math.abs(body.siderealHours - body.yearHours) < 0.001) {
            body.solarDaysInYear = 0;
            body.solarDayHours = Infinity;
            if (body.tidallyLocked && isPlanetToStar) {
                body.isTwilightZone = true;
            }
        } else {
            body.solarDaysInYear = (body.yearHours / effectiveSidereal) - 1;
            if (Math.abs(body.solarDaysInYear) > 0.0001) {
                body.solarDayHours = Math.abs(body.yearHours / body.solarDaysInYear);
            } else {
                body.solarDayHours = Infinity;
            }
            body.isTwilightZone = false;
        }
    }

    /**
     * Helper: Determine eccentricity (simplified for tidal lock context)
     */
    function determineMgT2EEccentricity(isStar, orbitsBeyondFirst, sysAgeGyr, orbitNum, isAsteroid, isPTypeOrDM) {
        let roll = tRoll2D('Eccentricity Roll');
        let dm = typeof isPTypeOrDM === 'number' ? isPTypeOrDM : (isPTypeOrDM ? 2 : 0);

        if (sysAgeGyr > 1.0 && orbitNum < 1.0) { tDM('Old Inner System', 1); dm += 1; }
        if (isAsteroid) { tDM('Belt Body', -1); dm -= 1; }

        let sumRoll = roll + dm;
        let base = 0, fraction = 0;

        if (sumRoll <= 5) {
            base = -0.001;
            fraction = tRoll1D('Ecc Jitter (Result <= 5)') / 10000;
        }
        else if (sumRoll <= 7) {
            base = 0.000;
            fraction = tRoll1D('Ecc Jitter (Result 6-7)') / 200;
        }
        else if (sumRoll <= 9) {
            base = 0.030;
            fraction = tRoll1D('Ecc Jitter (Result 8-9)') / 100;
        }
        else if (sumRoll === 10) {
            base = 0.050;
            fraction = tRoll1D('Ecc Jitter (Result 10)') / 20;
        }
        else if (sumRoll === 11) {
            base = 0.050;
            fraction = tRoll2D('Ecc Jitter (Result 11)') / 20;
        }
        else {
            base = 0.300;
            fraction = tRoll2D('Ecc Jitter (Result 12+)') / 20;
        }

        return Math.max(0, base + fraction);
    }

    // =====================================================================
    // CHUNK 6: BIOSPHERICS (BIOMASS & RESOURCES)
    // =====================================================================

    /**
     * Generate biospheric properties and resource ratings for all worlds and moons.
     * Handles seismic stress, inherent heat, tidal amplitudes, tectonic plates,
     * biomass rating, biocomplexity, biodiversity, compatibility, native sophonts,
     * resource rating, and habitability score.
     * 
     * @param {Object} sys - System object with worlds array
     * @param {Object|Object} options - Options object or Mainworld baseline data
     * @returns {Object} Modified system object
     */
    function generateBiospherics(sys, options = {}) {
        let mainworldBase = null;
        let targetWorlds = sys.worlds;

        // Adaptive Signature: (sys, mainworldBase) or (sys, { targetWorlds, mainworldBase })
        if (options && options.type === 'Mainworld') {
            mainworldBase = options;
        } else if (options) {
            mainworldBase = options.mainworldBase;
            targetWorlds = options.targetWorlds || sys.worlds;
        }

        let primary = sys.stars[0];
        primary.massEarths = (primary.mass || 1.0) * 333000;
        tSection('Biomass & Resources');

        let processBody = (w, parent, isMoon) => {
            if (w.type === 'Empty') return;

            let sizeValue = w.size === 'S' ? 0.375 : (typeof w.size === 'number' ? w.size : 0);
            let wSize = w.size === 'S' ? 0 : (typeof w.size === 'number' ? w.size : 0);
            let density = w.density || 1.0;
            w.massEarths = w.mass || 0.0001;
            w.distMkm = isMoon ? (w.pd * parent.diamKm / 1000000) : (w.au * 149.6);
            w.periodDays = (w.yearHours || 8760) / 24;

            let calculateTidalAmplitudes = (body, sys, parent, isMoon) => {
                let sVal = body.size === 'S' ? 0.375 : (typeof body.size === 'string' ? parseInt(body.size, 16) : body.size);
                let total = 0;
                const star = sys.stars[0];
                const dist = isMoon ? (body.pd * parent.diamKm / 1000000) : (body.au * 149.6);

                if (isMoon) {
                    let StarOnMoonEffect = MgT2EMath.calculateTidalEffect(star.mass, sVal, body.au * 149.6);
                    total += StarOnMoonEffect;

                    if (!body.tidallyLocked || body.Selected_Case !== 'Case B') {
                        let PlanetEffect = MgT2EMath.calculateTidalEffect(parent.mass, sVal, dist);
                        total += PlanetEffect;
                    }

                    if (parent && parent.moons) {
                        parent.moons.forEach(otherMoon => {
                            if (otherMoon === body || otherMoon.size === 0 || otherMoon.size === 'R') return;
                            let otherDistMkm = (otherMoon.pd * parent.diamKm) / 1000000;
                            let Separation_Mkm = Math.abs(dist - otherDistMkm);
                            if (Separation_Mkm > 0) {
                                let MoonToMoonEffect = MgT2EMath.calculateTidalEffect(otherMoon.mass, sVal, Separation_Mkm);
                                total += MoonToMoonEffect;
                            }
                        });
                    }
                } else {
                    if (!body.tidallyLocked || body.Selected_Case !== 'Case A') {
                        let StarEffect = MgT2EMath.calculateTidalEffect(star.mass, sVal, body.au * 149.6);
                        total += StarEffect;
                    }

                    if (!body.tidallyLocked || body.Selected_Case !== 'Case C') {
                        if (body.moons) {
                            body.moons.forEach(moon => {
                                if (moon.size === 0 || moon.size === 'R') return;
                                let moonDistMkm = (moon.pd * body.diamKm) / 1000000;
                                if (moonDistMkm > 0) {
                                    let MoonEffect = MgT2EMath.calculateTidalEffect(moon.mass, sVal, moonDistMkm);
                                    total += MoonEffect;
                                }
                            });
                        }
                    }
                }
                return parseFloat(total.toFixed(2));
            };

            w.totalTidalAmplitude = calculateTidalAmplitudes(w, sys, parent, isMoon);
            tResult('Tidal Amplitude', w.totalTidalAmplitude.toFixed(2));

            tSection('Inherent Heat & Seismology');
            let inherentK = 0;

            if (w.type === 'Gas Giant') {
                inherentK = 80 * Math.sqrt(w.massEarths / sys.age);
                tResult('GG Inherent Heat', inherentK.toFixed(1) + ' K');
            } else if (w.type !== 'Planetoid Belt' && w.size != 0 && w.size !== 'R') {
                let dmResidual = 0;
                if (isMoon) dmResidual += 1;
                let numLargeMoons = w.moons ? w.moons.filter(m => m.size !== 'S' && m.size > 0).length : 0;
                dmResidual += Math.min(12, numLargeMoons);
                if (density > 1.0) dmResidual += 2;
                if (density < 0.5) dmResidual -= 1;

                let aBasis = sizeValue - sys.age + dmResidual;
                let compA = aBasis < 1 ? 0 : Math.pow(aBasis, 2);

                let compB = Math.floor(w.totalTidalAmplitude / 10);

                // Component C: Tidal Heat (Scenario 3)
                // Safety: Ensure division by zero doesn't occur for very close planets or zero period
                let denom = (3000 * Math.pow(Math.max(0.001, w.distMkm), 5) * Math.max(0.001, w.periodDays) * (w.massEarths || 0.0001));
                let compC_val = (Math.pow(primary.massEarths, 2) * Math.pow(sizeValue, 5) * Math.pow(w.eccentricity || 0, 2)) / denom;
                let compC = (compC_val < 1 || isNaN(compC_val)) ? 0 : compC_val;

                w.seismicStress = Math.floor(compA + compB + compC);
                inherentK = w.seismicStress;

                tResult('Comp A (Residual)', compA.toFixed(2));
                tResult('Comp B (Tidal Stress)', compB.toFixed(2));
                tResult('Comp C (Tidal Heat)', compC.toFixed(2));
                tResult('Total Seismic Stress', w.seismicStress);
            }

            let solarK = w.meanTempK || 3;
            w.meanTempK = Math.pow(Math.pow(solarK, 4) + Math.pow(inherentK, 4), 0.25);
            w.meanTempC = w.meanTempK - 273;
            tResult('Final Mean Temp', w.meanTempK.toFixed(1) + ' K (' + w.meanTempC.toFixed(0) + '°C)');

            let srcLum = primary.lum || 1.0;
            let tfactor = Math.abs(Math.sin((w.axialTilt || 0) * Math.PI / 180));
            if (w.yearHours < (36.5 * 24)) tfactor /= 2;
            if (w.yearHours > (2 * 8760)) tfactor *= 1.5;

            let rfactor = w.solarDayHours <= 0 || w.solarDayHours === Infinity ? 1.0 : Math.sqrt(w.solarDayHours / 50);
            if (w.tidallyLocked) rfactor = 1.0;
            if (rfactor > 1.0) rfactor = 1.0;

            let gfactor = (10 - (w.hydroCode || 0)) / 20;
            if (w.surfaceDist && w.surfaceDist.includes('Concentrated')) gfactor -= 0.1;
            if (w.surfaceDist && w.surfaceDist.includes('Dispersed')) gfactor += 0.1;

            let afactor = 1 + (w.pressureBar || 0);
            let vfactor = Math.max(0, Math.min(1.0, tfactor + rfactor + gfactor));
            let lumMod = vfactor / afactor;

            let highLum = srcLum * (1 + lumMod);
            let lowLum = srcLum * (1 - lumMod);
            let nearAu = w.au * (1 - (w.eccentricity || 0));
            let farAu = w.au * (1 + (w.eccentricity || 0));

            if (nearAu > 0) w.highTempK = Math.pow(Math.pow(MgT2EMath.calculateMeanTemperature(highLum, nearAu, w.albedo, w.greenhouseFactor), 4) + Math.pow(inherentK, 4), 0.25);
            if (farAu > 0) w.lowTempK = Math.pow(Math.pow(MgT2EMath.calculateMeanTemperature(lowLum, farAu, w.albedo, w.greenhouseFactor), 4) + Math.pow(inherentK, 4), 0.25);

            tResult('Recalc High Temp', w.highTempK.toFixed(1) + ' K');
            tResult('Recalc Low Temp', w.lowTempK.toFixed(1) + ' K');

            if (w.type === 'Gas Giant' || w.type === 'Planetoid Belt' || w.size === 0 || w.size === 'R') {
                w.habitability = 0;
                w.lifeProfile = "0000";
                w.biomass = 0;
                w.biocomplexity = 0;
                w.biodiversity = 0;
                w.compatibility = 0;
                return;
            }

            tSection(`${isMoon ? 'Moon' : w.type} Orbit ${w.orbitId.toFixed(2)} Biology/Sophonts`);

            w.tectonicPlates = 0;
            w.plateInteraction = "None";
            if (w.seismicStress > 0 && w.hydroPercent >= 1) {
                let pRoll = tRoll2D('Tectonic Plate Roll');
                tDM('Size/Hydro Mod', sizeValue + w.hydroCode - 7);
                let p = sizeValue + w.hydroCode - pRoll;
                if (w.seismicStress >= 10 && w.seismicStress <= 100) { tDM('Stress 10+', 1); p += 1; }
                else if (w.seismicStress > 100) { tDM('Stress 100+', 2); p += 2; }
                if (p > 1) {
                    w.tectonicPlates = p;
                    w.plateInteraction = MGT2E_PLATE_INTERACTIONS[tRoll2D('Plate Interaction Roll')] || "None";
                    tResult('Tectonic Plates', p);
                    tResult('Interaction', w.plateInteraction);
                }
            }

            tSection('Biomass Rating');
            let biomassBase = 0;
            if (sys.age >= 0.1) {
                let bioRoll = tRoll2D('Biomass Roll');
                let bDm = 0;
                if (w.atmCode === 0) { tDM('Atm 0', -6); bDm -= 6; }
                else if (w.atmCode === 1) { tDM('Atm 1', -4); bDm -= 4; }
                else if ([2, 3, 14].includes(w.atmCode)) { tDM('Thin/Med Binary', -3); bDm -= 3; }
                else if ([4, 5].includes(w.atmCode)) { tDM('Thin/Standard', -2); bDm -= 2; }
                else if ([8, 9, 13].includes(w.atmCode)) { tDM('Dense/Thin Cloud', 2); bDm += 2; }
                else if (w.atmCode === 10) { tDM('Exotic', -3); bDm -= 3; }
                else if (w.atmCode === 11) { tDM('Exotic Corrosive', -5); bDm -= 5; }
                else if (w.atmCode === 12) { tDM('Exotic Insid.', -7); bDm -= 7; }
                else if (w.atmCode >= 15) { tDM('High exotic', -5); bDm -= 5; }

                if (w.hydroCode === 0) { tDM('Desert', -4); bDm -= 4; }
                else if (w.hydroCode >= 1 && w.hydroCode <= 3) { tDM('Dry', -2); bDm -= 2; }
                else if (w.hydroCode >= 6 && w.hydroCode <= 8) { tDM('Wet', 1); bDm += 1; }
                else if (w.hydroCode >= 9) { tDM('Water World', 2); bDm += 2; }

                if (sys.age < 0.2) { tDM('Very Young', -6); bDm -= 6; }
                else if (sys.age < 1) { tDM('Young', -2); bDm -= 2; }
                else if (sys.age > 4) { tDM('Mature', 1); bDm += 1; }

                if (w.highTempK > 353) { tDM('Hot High', -2); bDm -= 2; }
                else if (w.highTempK < 273) { tDM('Cold High', -4); bDm -= 4; }

                if (w.meanTempK > 353) { tDM('Hot Mean', -4); bDm -= 4; }
                else if (w.meanTempK < 273) { tDM('Cold Mean', -2); bDm -= 2; }
                else if (w.meanTempK >= 279 && w.meanTempK <= 303) { tDM('Temperate Mean', 2); bDm += 2; }

                bDm = Math.max(-12, Math.min(4, bDm));
                biomassBase = bioRoll + bDm;

                if (biomassBase <= 0) biomassBase = 0;
                if (w.taints && w.taints.includes("Biologic") && biomassBase === 0) {
                    tResult('Biomass (Min)', 1);
                    biomassBase = 1;
                }

                if (biomassBase >= 1 && [0, 1, 10, 11, 12, 15].includes(w.atmCode)) {
                    let extremophileBonus = 0;
                    if (w.atmCode === 0) extremophileBonus = 5;
                    else if (w.atmCode === 1) extremophileBonus = 3;
                    else if (w.atmCode === 10) extremophileBonus = 2;
                    else if (w.atmCode === 11) extremophileBonus = 4;
                    else if (w.atmCode === 12) extremophileBonus = 6;
                    else if (w.atmCode >= 15) extremophileBonus = 4;
                    tResult('Extremophile Bonus', extremophileBonus);
                    biomassBase += extremophileBonus;
                }
            }
            w.biomass = biomassBase;
            tResult('Final Biomass', biomassBase);

            tSection('Biocomplexity');
            w.biocomplexity = 0;
            if (w.biomass >= 1) {
                let cDm = 0;
                if (w.atmCode < 4 || w.atmCode > 9) { tDM('Harsh Atm', -2); cDm -= 2; }
                if (w.taints && w.taints.includes("Low Oxygen")) { tDM('Low O2', -2); cDm -= 2; }
                if (sys.age >= 3 && sys.age < 4) { tDM('Age 3-4', -2); cDm -= 2; }
                else if (sys.age >= 2 && sys.age < 3) { tDM('Age 2-3', -4); cDm -= 4; }
                else if (sys.age >= 1 && sys.age < 2) { tDM('Age 1-2', -8); cDm -= 8; }
                else if (sys.age < 1) { tDM('Age <1', -10); cDm -= 10; }

                let effBiomass = w.biomass >= 10 ? 9 : w.biomass;
                w.biocomplexity = Math.max(1, tRoll2D('Biocomplexity Roll') - 7 + effBiomass + cDm);
                tResult('Final Biocomplexity', w.biocomplexity);
            }

            tSection('Sophont Check');
            w.nativeSophont = false;
            w.extinctSophont = false;
            if (w.biocomplexity >= 8) {
                let effBiocomp = w.biocomplexity >= 10 ? 9 : w.biocomplexity;
                if ((tRoll2D('Sophont Emergence Roll') + effBiocomp - 7) >= 13) {
                    tResult('Sophont', 'Native Living');
                    w.nativeSophont = true;
                }

                let exDm = sys.age > 5 ? 1 : 0;
                if ((tRoll2D('Extinct Sophont Roll') + effBiocomp - 7 + exDm) >= 13) {
                    tResult('Sophont', 'Extinct Relics');
                    w.extinctSophont = true;
                }
            }

            tSection('Biodiversity Rating');
            w.biodiversity = 0;

            if (w.biomass >= 1) {
                let roll = tRoll2D('Biodiversity Roll');
                let baseCalculationAvg = (w.biomass + w.biocomplexity) / 2;
                let baseCalculationRounded = Math.ceil(baseCalculationAvg);
                w.biodiversity = roll - 7 + baseCalculationRounded;

                if (w.biodiversity < 1) {
                    w.biodiversity = 1;
                }

                tResult('Biodiversity', w.biodiversity);
            }

            tSection('Compatibility Rating');
            w.compatibility = 0;

            if (w.biomass > 0) {
                let compDm = 0;

                if (w.atmCode === 12) {
                    compDm -= 10;
                } else if ([0, 1, 11, 16, 17].includes(w.atmCode)) {
                    compDm -= 8;
                } else if ([10, 15].includes(w.atmCode)) {
                    compDm -= 6;
                } else if ([2, 4, 7, 9].includes(w.atmCode) || (w.taints && w.taints.length > 0)) {
                    compDm -= 2;
                } else if ([13, 14].includes(w.atmCode)) {
                    compDm -= 1;
                } else if ([3, 5, 8].includes(w.atmCode)) {
                    compDm += 1;
                } else if (w.atmCode === 6) {
                    compDm += 2;
                }

                if (sys.age > 8.0) {
                    compDm -= 2;
                }

                let roll = tRoll2D('Compatibility Roll');
                let baseTerm = w.biocomplexity / 2;
                w.compatibility = Math.floor(roll - baseTerm + compDm);

                if (w.compatibility <= 0) {
                    w.compatibility = 0;
                }

                tResult('Compatibility', w.compatibility);
            }

            w.lifeProfile = `${w.biomass.toString(16).toUpperCase()}${w.biocomplexity.toString(16).toUpperCase()}${w.biodiversity.toString(16).toUpperCase()}${w.compatibility.toString(16).toUpperCase()}`;
            if (w.biomass === 0) w.lifeProfile = "0000";
            tResult('Life Profile', w.lifeProfile);

            tSection('Resources');
            let rDm = 0;
            if (density > 1.12) { tDM('High Density', 2); rDm += 2; }
            if (density < 0.5) { tDM('Low Density', -2); rDm -= 2; }
            if (w.biomass >= 3) { tDM('Biogenic Res', 2); rDm += 2; }
            if (w.biodiversity >= 8 && w.biodiversity <= 10) { tDM('Biodiv 8-10', 1); rDm += 1; }
            else if (w.biodiversity >= 11) { tDM('High Biodiv', 2); rDm += 2; }

            if (w.compatibility >= 0 && w.compatibility <= 3) { tDM('Low Comp', -1); rDm -= 1; }
            else if (w.compatibility >= 8) { tDM('High Comp', 2); rDm += 2; }

            w.resourceRating = Math.max(2, Math.min(12, tRoll2D('Resource Roll') - 7 + wSize + rDm));
            tResult('Resource Rating', w.resourceRating);

            tSection('Habitability Score');
            let hScore = 10;
            if (wSize >= 0 && wSize <= 4) { tDM('Small', -1); hScore -= 1; }
            if (wSize >= 9) { tDM('Large', 1); hScore += 1; }

            if ([0, 1, 10].includes(w.atmCode)) hScore -= 8;
            else if ([2, 14].includes(w.atmCode)) hScore -= 4;
            else if ([3, 13].includes(w.atmCode)) hScore -= 3;
            else if ([4, 9].includes(w.atmCode)) hScore -= 2;
            else if ([5, 7, 8].includes(w.atmCode)) hScore -= 1;
            else if (w.atmCode === 11) hScore -= 10;
            else if (w.atmCode === 12 || w.atmCode >= 15) hScore -= 12;

            if (w.taints && w.taints.includes("Low Oxygen")) hScore -= 2;

            if (w.hydroCode === 0) hScore -= 4;
            else if (w.hydroCode >= 1 && w.hydroCode <= 3) hScore -= 2;
            else if (w.hydroCode === 9) hScore -= 1;
            else if (w.hydroCode === 10) hScore -= 2;

            if (w.tidallyLocked) hScore -= 2;

            if (w.highTempK > 323) hScore -= 2;
            if (w.highTempK < 279) hScore -= 2;
            if (w.meanTempK > 323) hScore -= 4;
            else if (w.meanTempK >= 304 && w.meanTempK <= 323) hScore -= 2;
            else if (w.meanTempK < 273) hScore -= 2;

            if (w.lowTempK < 200) hScore -= 2;

            let grav = (w.gravity !== undefined) ? w.gravity : (w.size === 'S' ? 0.01 : w.size * 0.125);
            if (grav < 0.2) hScore -= 4;
            else if (grav >= 0.2 && grav < 0.4) hScore -= 2;
            else if (grav >= 0.4 && grav < 0.7) hScore -= 1;
            else if (grav >= 0.7 && grav <= 0.9) hScore += 1;
            else if (grav >= 1.1 && grav < 1.4) hScore -= 1;
            else if (grav >= 1.4 && grav <= 2.0) hScore -= 3;
            else if (grav > 2.0) hScore -= 6;

            w.habitability = Math.max(0, hScore);
            tResult('Habitability Score', w.habitability);
        };

        for (let i = 0; i < targetWorlds.length; i++) {
            let w = targetWorlds[i];
            processBody(w, null, false);
            if (w.moons) {
                for (let j = 0; j < w.moons.length; j++) {
                    processBody(w.moons[j], w, true);
                }
            }
        }

        return sys;
    }

    /**
     * Evaluate candidates for Mainworld status based on World Builder's Handbook criteria.
     * Primary Sort: Habitability (Descending)
     * Tie-Breaker 1: Resource Rating (Descending)
     * Fallback: Size (Descending)
     * 
     * @param {Array} candidates - Array of candidate world objects
     * @returns {Object|null} The winning Mainworld candidate
     */
    function evaluateMainworldCandidates(candidates) {
        if (!candidates || candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (b.habitability !== a.habitability) return (b.habitability || 0) - (a.habitability || 0);
            if (b.resourceRating !== a.resourceRating) return (b.resourceRating || 0) - (a.resourceRating || 0);
            return (b.size || 0) - (a.size || 0);
        });

        return candidates[0];
    }

    // =====================================================================
    // EXPORTS
    // =====================================================================

    exports.generatePhysicals = generatePhysicals;
    exports.generateAtmospherics = generateAtmospherics;
    exports.generateRotationalDynamics = generateRotationalDynamics;
    exports.generateBiospherics = generateBiospherics;
    exports.evaluateMainworldCandidates = evaluateMainworldCandidates;
}));
