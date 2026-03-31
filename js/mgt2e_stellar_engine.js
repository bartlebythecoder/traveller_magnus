/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: MgT2E Stellar Engine
 * Description: Modular star system generator for Traveller MgT2E.
 * Following the "Sean Protocol": Data Shield, Math Chassis, State Mutation, Trace Logging.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['MgT2EData', 'MgT2EMath'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../rules/mgt2e_data'), require('./mgt2e_math'));
    } else {
        root.MgT2EStellarEngine = factory(root.MgT2EData, root.MgT2EMath);
    }
}(typeof self !== 'undefined' ? self : this, function (MgT2EData, MgT2EMath) {
    'use strict';

    // =========================================================================
    // INTERNAL HELPERS (Mapped from Legacy Logic)
    // =========================================================================

    /**
     * Helper to get MAO (Minimum Allowed Orbit) for a star.
     */
    function getMAO(sType, subType, sClass) {
        const sTypeOrder = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
        const idx = MgT2EData.stellar.sClassIdx[sClass] !== undefined ? MgT2EData.stellar.sClassIdx[sClass] : 5;

        let lowSubtype = subType < 5 ? 0 : 5;
        let highSubtype = subType < 5 ? 5 : 10;
        let lowKey = sType + lowSubtype;
        if (sType === 'O' && lowSubtype === 0) lowKey = 'O0';

        let lowRow = MgT2EData.stellar.mao[lowKey] || MgT2EData.stellar.mao['G0'];
        let lowVal = lowRow[idx];
        if (lowVal === Infinity) lowVal = null;

        if (subType === lowSubtype) return lowVal !== null ? lowVal : 0.01;

        let highVal = null;
        if (subType < 5) {
            let highRow = MgT2EData.stellar.mao[sType + '5'] || lowRow;
            let v = highRow[idx];
            highVal = (v === Infinity) ? null : v;
        } else {
            let nextType = sTypeOrder[sTypeOrder.indexOf(sType) + 1];
            if (nextType) {
                let highRow = MgT2EData.stellar.mao[nextType + '0'] || lowRow;
                let v = highRow[idx];
                highVal = (v === Infinity) ? null : v;
            }
        }

        if (lowVal === null && highVal === null) return 0.01;
        if (lowVal === null) return highVal;
        if (highVal === null) return lowVal;

        let fraction = (subType - lowSubtype) / (highSubtype - lowSubtype);
        return lowVal + fraction * (highVal - lowVal);
    }

    /**
     * Helper to generate a star object with mass, diam, temp, lum.
     */
    function generateStarObject(sType, subType, sClass, label = 'Star') {
        let stats = MgT2EData.stellar.starStats[sType] || MgT2EData.stellar.starStats['M'];

        let star = {
            sClass,
            sType,
            subType,
            mass: stats.mass,
            diam: stats.diam,
            temp: stats.temp,
            lum: MgT2EMath.calculateStellarLuminosity(stats.diam, stats.temp),
            name: `${sType}${toUWPChar(subType)} ${sClass}`
        };

        tResult(`${label} Classification`, star.name);
        tResult(`${label} Mass (Sol)`, star.mass);
        tResult(`${label} Temperature (K)`, star.temp);
        tResult(`${label} Diameter (Sol)`, star.diam);
        const limit100D = (star.diam * 1392700 * 100) / 1000000;
        tResult("100D Limit", `${limit100D.toFixed(1)} M km`);
        tResult(`${label} Luminosity (Sol)`, star.lum.toFixed(4));

        return star;
    }

    /**
     * Helper to roll a MgT2E Star type and class.
     */
    function rollStar(label = 'Star') {
        let roll = tRoll2D(`${label} Type Roll`);
        let sType = '';
        let sClass = 'V';

        // Use MgT2EData lookup
        for (let entry of MgT2EData.stellar.primaryType) {
            if (roll <= entry.maxRoll) {
                sType = entry.type;
                sClass = entry.class;
                break;
            }
        }

        if (sType === 'Hot') {
            let hotRoll = tRoll2D(`${label} Hot Star Roll`);
            for (let entry of MgT2EData.stellar.hotType) {
                if (hotRoll <= entry.maxRoll) {
                    sType = entry.type;
                    sClass = entry.class;
                    break;
                }
            }
        }

        let subType = Math.floor(rng() * 10);
        tResult(`${label} Subtype (0-9)`, subType);

        return generateStarObject(sType, subType, sClass, label);
    }

    /**
     * Helper to determine non-primary star.
     */
    function determineNonPrimaryStar(parentStar, orbitType, label) {
        const column = (orbitType === 'Companion' ? 'companion' : 'secondary');
        let dm = 0;
        if (parentStar.sClass === 'D' || ['L', 'T', 'Y'].includes(parentStar.sType)) dm = -1;

        let roll = tRoll2D(`${label} Determination Roll`);
        if (dm !== 0) tDM('Exotic Parent', dm);
        let total = roll + dm;
        let lookupRoll = Math.max(2, Math.min(12, total));

        let determination = '';
        let table = MgT2EData.stellar.companionDetermination[column];
        for (let entry of table) {
            if (lookupRoll <= entry.maxRoll) {
                determination = entry.determination;
                break;
            }
        }
        tResult(`${label} Determination Result`, determination);

        let star;
        if (determination === 'Twin') {
            star = JSON.parse(JSON.stringify(parentStar));
            let varRoll = tRoll1D(`${label} Twin Variation (1D6-1)`);
            let varPct = varRoll - 1;
            if (varPct > 0) {
                let factor = 1 - (varPct / 100);
                star.mass *= factor;
                star.diam *= factor;
                star.lum = MgT2EMath.calculateStellarLuminosity(star.diam, star.temp);
                tResult(`${label} Twin Variation`, `-${varPct}% mass/diameter`);
            }
            star = generateStarObject(star.sType, star.subType, star.sClass, label);
            // Re-apply variation since generateStarObject uses table defaults
            if (varPct > 0) {
                let factor = 1 - (varPct / 100);
                star.mass *= factor;
                star.diam *= factor;
                star.lum = MgT2EMath.calculateStellarLuminosity(star.diam, star.temp);
            }
        } else if (determination === 'Sibling') {
            const types = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
            let subRoll = tRoll1D(`${label} Sibling Offset (1D6)`);
            let newSub = parentStar.subType + subRoll;
            let sType = parentStar.sType;
            let subType = newSub;

            if (newSub > 9) {
                let parentIdx = types.indexOf(sType);
                if (parentIdx !== -1 && parentIdx < types.length - 1) {
                    sType = types[parentIdx + 1];
                    subType = newSub - 10;
                } else {
                    subType = 9;
                }
            }
            star = generateStarObject(sType, subType, parentStar.sClass, label);
        } else if (determination === 'Random') {
            let tempStar = rollStar(label);
            // Check if hotter
            const order = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'BD', 'L', 'T', 'Y', 'D'];
            let idx1 = order.indexOf(tempStar.sType);
            let idx2 = order.indexOf(parentStar.sType);
            let isHotter = (idx1 < idx2) || (idx1 === idx2 && tempStar.subType < parentStar.subType);

            if (isHotter) {
                determination = 'Lesser';
                tResult(`${label} Override`, 'Random -> Lesser');
            } else {
                star = tempStar;
            }
        }

        if (determination === 'Lesser') {
            const types = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
            let parentIdx = types.indexOf(parentStar.sType);
            let sType, subType;
            if (parentStar.sType === 'M') {
                sType = 'M';
                subType = Math.floor(rng() * 10);
                if (subType > parentStar.subType) sType = 'BD';
            } else if (parentIdx !== -1 && parentIdx < types.length - 1) {
                sType = types[parentIdx + 1];
                subType = Math.floor(rng() * 10);
            } else {
                sType = parentStar.sType;
                subType = Math.floor(rng() * 10);
            }
            star = generateStarObject(sType, subType, parentStar.sClass, label);
        } else if (determination === 'Other') {
            let otherRoll = tRoll2D(`${label} Other Roll`);
            let sType = (otherRoll <= 7) ? 'D' : 'BD';
            let sClass = (sType === 'D') ? 'D' : 'V';
            star = generateStarObject(sType, 0, sClass, label);
        }

        star.mao = getMAO(star.sType, star.subType, star.sClass);
        return star;
    }

    /**
     * Helper for eccentricity.
     */
    function determineEccentricity(isStar, orbitsBeyondFirst, sysAgeGyr, orbitNum, isAsteroid, isPType) {
        let roll = tRoll2D('Eccentricity Roll');
        let dm = 0;
        if (isPType) { tDM('P-Type', 2); dm += 2; }
        if (sysAgeGyr > 1.0 && orbitNum < 1.0) { tDM('Old Inner', 1); dm += 1; }
        if (isAsteroid) { tDM('Belt', -1); dm -= 1; }

        let sumRoll = roll + dm;
        let base = 0, fraction = 0;
        if (sumRoll <= 5) { base = -0.001; fraction = tRoll1D('Jitter') / 10000; }
        else if (sumRoll <= 7) { base = 0.000; fraction = tRoll1D('Jitter') / 200; }
        else if (sumRoll <= 9) { base = 0.030; fraction = tRoll1D('Jitter') / 100; }
        else if (sumRoll === 10) { base = 0.050; fraction = tRoll1D('Jitter') / 20; }
        else if (sumRoll === 11) { base = 0.050; fraction = tRoll2D('Jitter') / 20; }
        else { base = 0.300; fraction = tRoll2D('Jitter') / 20; }

        return Math.max(0, base + fraction);
    }

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * Step 1: Primary Star & System Age
     * Step 2: Additional Stars
     */
    function generateStellarSystem(sys, hexId, mainworldBase) {
        if (!sys.worlds) sys.worlds = [];
        sys.stars = [];
        if (window.isLoggingEnabled) {
            startTrace(hexId, 'MgT2E Stellar Generation');
        }
        reseedForHex(hexId);

        sys.age = 0;
        sys.hzco = 0;

        // --- OVERRIDE PARSE LOGIC ---
        let overrideStars = [];
        if (mainworldBase && mainworldBase.homestar && mainworldBase.homestar.trim() !== '') {
            let tokens = mainworldBase.homestar.trim().split(/\s+/);
            for (let i = 0; i < tokens.length; i++) {
                if (i > 0 && /^(Ia|Ib|II|III|IV|V|VI|VII|D|BD)$/i.test(tokens[i]) && !overrideStars[overrideStars.length - 1].includes(" ")) {
                    overrideStars[overrideStars.length - 1] += " " + tokens[i];
                } else {
                    overrideStars.push(tokens[i]);
                }
            }
        }

        let primaryStr = overrideStars.length > 0 ? overrideStars[0] : null;

        tSection('Primary Star');
        let primary;
        if (primaryStr) {
            let typeStr = primaryStr.split(' ')[0] || '';
            let sType = typeStr.length > 0 ? typeStr[0] : 'M';
            let subTypeMatch = typeStr.match(/\d/);
            let subType = subTypeMatch ? parseInt(subTypeMatch[0]) : 0;
            let sClass = primaryStr.split(' ')[1] || 'V';
            if (sType === 'D') { sClass = 'D'; subType = 0; }
            if (typeStr === 'BD') { sType = 'BD'; sClass = 'V'; subType = 0; }
            primary = generateStarObject(sType, subType, sClass, 'Primary');
            tResult('Primary Override', primaryStr);
        } else {
            primary = rollStar('Primary');
        }

        primary.role = 'Primary';
        primary.separation = null;
        primary.orbitId = null;
        primary.eccentricity = 0;
        primary.mao = getMAO(primary.sType, primary.subType, primary.sClass);
        sys.stars.push(primary);

        tSection('System Age');
        let msLifespan = 10 / Math.pow(primary.mass, 2.5);
        tResult('Main Sequence Lifespan', msLifespan.toFixed(2) + " Gyr");

        // Logic for Age based on Primary
        if (primary.sType === 'D') {
            sys.age = 5.0;
        } else if (primary.mass < 0.9 || ['BD', 'L', 'T', 'Y'].includes(primary.sType)) {
            let r1 = tRoll1D('Age Base (1D*2)');
            let r2 = Math.ceil(tRoll1D('Age Offset (1D3)') / 2);
            sys.age = (r1 * 2) + r2 - 1 + (Math.floor(rng() * 10) / 10);
        } else {
            let r1 = (Math.floor(rng() * 100) + 1) / 100;
            sys.age = msLifespan * r1;
        }
        sys.age = Math.max(0.1, sys.age);
        tResult('System Age', sys.age.toFixed(2) + " Gyr");

        // HZCO calculation
        let hzcoAu = Math.sqrt(primary.lum);
        const convertAuToOrbit = (au) => {
            const orbitAuTable = MgT2EData.stellar.orbitAu;
            for (let i = 0; i < orbitAuTable.length - 1; i++) {
                if (au >= orbitAuTable[i] && au < orbitAuTable[i + 1]) {
                    let fraction = (au - orbitAuTable[i]) / (orbitAuTable[i + 1] - orbitAuTable[i]);
                    return i + fraction;
                }
            }
            return 20.0;
        };
        sys.hzco = convertAuToOrbit(hzcoAu);
        tResult('HZCO (Orbit)', sys.hzco.toFixed(2));

        tSection('Additional Stars');
        if (overrideStars.length > 1) {
            for (let i = 1; i < overrideStars.length; i++) {
                let sStr = overrideStars[i];
                let typeStr = sStr.split(' ')[0] || '';
                let sType = typeStr.length > 0 ? typeStr[0] : 'M';
                let subTypeMatch = typeStr.match(/\d/);
                let subType = subTypeMatch ? parseInt(subTypeMatch[0]) : 0;
                let sClass = sStr.split(' ')[1] || 'V';
                if (sType === 'D') { sClass = 'D'; subType = 0; }
                if (typeStr === 'BD') { sType = 'BD'; sClass = 'V'; subType = 0; }

                let repRole = i === 1 ? 'Close' : (i === 2 ? 'Near' : 'Far');
                let star = generateStarObject(sType, subType, sClass, repRole);
                star.separation = repRole;
                star.role = repRole;
                star.parentStarIdx = 0;
                // mock orbits for overrides based on standard ranges
                star.orbitId = i === 1 ? 0.5 : (i === 2 ? 6.0 : 12.0);
                star.eccentricity = 0;
                star.mao = getMAO(star.sType, star.subType, star.sClass);
                sys.stars.push(star);
                tResult(`${repRole} Override`, sStr + " at Orbit " + star.orbitId);
            }
        } else {
            const getMultiDM = (star) => {
                let dm = 0;
                if (['Ia', 'Ib', 'II', 'III', 'IV'].includes(star.sClass)) dm += 1;
                if (['V', 'VI'].includes(star.sClass) && ['O', 'B', 'A', 'F'].includes(star.sType)) dm += 1;
                if (['V', 'VI'].includes(star.sClass) && star.sType === 'M') dm -= 1;
                if (star.sClass === 'D' || ['L', 'T', 'Y'].includes(star.sType)) dm -= 1;
                return dm;
            };

            const primaryDM = getMultiDM(primary);
            const canHaveClose = !['Ia', 'Ib', 'II', 'III'].includes(primary.sClass);
            const definitions = [
                { sep: 'Close', orbitFn: () => { let r = tRoll1D('Close Roll') - 1; return r === 0 ? 0.5 : r; }, allowed: canHaveClose },
                { sep: 'Near', orbitFn: () => tRoll1D('Near Roll') + 5, allowed: true },
                { sep: 'Far', orbitFn: () => tRoll1D('Far Roll') + 11, allowed: true }
            ];

            for (let def of definitions) {
                if (!def.allowed) continue;
                let presRoll = tRoll2D(`${def.sep} Presence`);
                tDM('Primary MultiDM', primaryDM);
                if (presRoll + primaryDM >= 10) {
                    let star = determineNonPrimaryStar(primary, def.sep, def.sep);
                    star.separation = def.sep;
                    star.role = def.sep;
                    star.parentStarIdx = 0;
                    star.orbitId = def.orbitFn();
                    star.eccentricity = determineEccentricity(true, 0, sys.age, star.orbitId, false, 0);
                    sys.stars.push(star);
                    tResult(`${def.sep} Star`, star.name + " at Orbit " + star.orbitId);

                    // Companion Check
                    let orbitDM = getMultiDM(star);
                    if (tRoll2D('Companion Presence') + orbitDM >= 10) {
                        let companion = determineNonPrimaryStar(star, 'Companion', 'Companion');
                        companion.separation = 'Companion';
                        companion.role = 'Companion';
                        companion.parentStarIdx = sys.stars.length - 1;
                        let d1 = tRoll1D('Comp Orbit D1');
                        let d2 = tRoll2D('Comp Orbit D2');
                        companion.orbitId = (d1 / 10) + ((d2 - 7) / 100);
                        companion.eccentricity = determineEccentricity(true, 0, sys.age, companion.orbitId, false, 0);
                        sys.stars.push(companion);
                        tResult('  Companion', companion.name);
                    }
                }
            }
        }

        return sys;
    }

    /**
     * Step 3: Total Worlds Inventory
     */
    function generateSystemInventory(sys, mainworldBase) {
        tSection('System Inventory');

        // Gas Giants - WBH Adjustment: 83% presence (9-) to satisfy the 15-20% Lunar Mainworld statistical requirement
        let ggRoll = tRoll2D('Gas Giant Presence (<= 9)');
        let ggExists = ggRoll <= 9 || (mainworldBase && mainworldBase.gasGiant);
        if (ggExists) {
            let ggQ = tRoll2D('GG Quantity');
            // WBH Math: Systems usually have 3+ GGs if they exist
            if (sys.stars.length === 1 && sys.stars[0].sClass === 'V') { tDM('Single V', 2); ggQ += 2; }
            if (sys.stars.length >= 4) { tDM('4+ Stars', -1); ggQ -= 1; }

            for (let entry of MgT2EData.systemInventory.gasGiants) {
                if (ggQ <= entry.maxRoll) {
                    sys.gasGiants = entry.count;
                    break;
                }
            }
        } else {
            sys.gasGiants = 0;
        }
        tResult('Gas Giants', sys.gasGiants);

        // Planetoid Belts
        let pbRoll = tRoll2D('Planetoid Belt Presence (>= 8)');
        let pbExists = pbRoll >= 8 || (mainworldBase && mainworldBase.size === 0);
        if (pbExists) {
            let pbQ = tRoll2D('PB Quantity');
            if (sys.gasGiants > 0) { tDM('GG Present', 1); pbQ += 1; }
            if (sys.stars.length > 1) { tDM('Multi-star', 1); pbQ += 1; }

            for (let entry of MgT2EData.systemInventory.planetoidBelts) {
                if (pbQ <= entry.maxRoll) {
                    sys.planetoidBelts = entry.count;
                    break;
                }
            }
        } else {
            sys.planetoidBelts = 0;
        }
        tResult('Planetoid Belts', sys.planetoidBelts);

        // Terrestrial Planets
        let tpRoll = tRoll2D('Terrestrial Quantity');
        let tpCount = tpRoll - 2;
        if (tpCount < 3) {
            tpCount = Math.ceil(tRoll1D('Reroll D3') / 2) + 2;
        } else {
            tpCount += Math.ceil(tRoll1D('Add D3') / 2) - 1;
        }
        sys.terrestrialPlanets = tpCount;
        tResult('Terrestrial Planets', sys.terrestrialPlanets);

        sys.totalWorlds = sys.gasGiants + sys.planetoidBelts + sys.terrestrialPlanets;

        // Anomalous Orbits
        let anomRoll = tRoll2D('Anomalous Roll');
        let anomCount = anomRoll <= 9 ? 0 : (anomRoll - 9);
        sys.totalWorlds += anomCount;
        tResult('Total Worlds', sys.totalWorlds);

        return sys;
    }

    /**
     * Legacy Logic: Chunk 2 (Orbit Allocation)
     */
    function allocateOrbits(sys, mainworldBase) {
        tSection('Orbit Allocation');
        sys.worlds = [];
        let primary = sys.stars[0];

        // 1. Baseline Orbit
        let mwAtm = mainworldBase ? mainworldBase.atm : 0;
        let atmDM = 0;
        if ([2, 3].includes(mwAtm)) atmDM = -2;
        else if ([4, 5, 14].includes(mwAtm)) atmDM = -1;
        else if ([8, 9].includes(mwAtm)) atmDM = 1;
        else if ([10, 13, 15].includes(mwAtm)) atmDM = 2;
        else if ([11, 12].includes(mwAtm)) atmDM = 6;

        let rawHzRoll = Math.max(2, Math.min(12, 7 - atmDM));
        let hzDeviation = MgT2EData.stellar.hzDeviation[rawHzRoll];
        let variance = (Math.floor(rng() * 10)) / 100;
        hzDeviation += (hzDeviation >= 0 ? variance : -variance);

        let baselineOrbit;
        if (sys.hzco >= 1.0 && (sys.hzco + hzDeviation) >= 1.0) baselineOrbit = sys.hzco + hzDeviation;
        else if (sys.hzco < 1.0 && hzDeviation > 0) baselineOrbit = sys.hzco * (1 + hzDeviation);
        else if (sys.hzco < 1.0 && hzDeviation < 0) baselineOrbit = sys.hzco / (1 - hzDeviation);
        else baselineOrbit = sys.hzco + hzDeviation;

        sys.baselineOrbit = baselineOrbit;
        tResult('Baseline Orbit', sys.baselineOrbit.toFixed(2));

        // 2. Forbidden Zones
        tSection('Forbidden Zones');
        let rawFZ = [];
        let primaryMao = getMAO(primary.sType, primary.subType, primary.sClass);
        let directCompanions = sys.stars.filter(s => s.parentStarIdx === 0 && s.separation !== 'Companion');

        for (let comp of directCompanions) {
            let co = comp.orbitId;
            let cm = comp.mao || 0;
            let ce = comp.eccentricity || 0;
            let fmin = co - 1.0, fmax = co + 1.0;
            if (cm > 0.2) { fmin -= cm; fmax += cm; }
            if (ce > 0.2) { fmin -= 1.0; fmax += 1.0; }
            rawFZ.push({ min: fmin, max: fmax });
        }
        rawFZ.sort((a, b) => a.min - b.min);
        let mergedFZ = [];
        for (let fz of rawFZ) {
            if (mergedFZ.length === 0 || fz.min > mergedFZ[mergedFZ.length - 1].max) mergedFZ.push({ ...fz });
            else mergedFZ[mergedFZ.length - 1].max = Math.max(mergedFZ[mergedFZ.length - 1].max, fz.max);
        }
        sys.forbiddenZones = mergedFZ;

        // 3. Slot Generation
        let eRoll = tRoll2D('Empty Orbits (10+)');
        let emptyCount = eRoll <= 9 ? 0 : (eRoll - 9);
        let totalSlotsCount = sys.totalWorlds + emptyCount;
        let targetIdx = Math.max(0, Math.min(totalSlotsCount - 1, Math.round(baselineOrbit)));

        let spread = (sys.baselineOrbit - primaryMao) / Math.max(1, targetIdx);
        let maxSpread = (20.0 - primaryMao) / (totalSlotsCount + sys.stars.length);
        spread = Math.min(Math.max(0.1, spread), maxSpread);

        let slots = [];
        let currentPos = primaryMao;
        for (let i = 0; i < totalSlotsCount; i++) {
            let minSep = currentPos * 0.15;
            let nextOrbit = currentPos + Math.max(spread, minSep);

            // FZ Jumping
            for (let fz of mergedFZ) {
                if (nextOrbit >= fz.min && nextOrbit <= fz.max) {
                    nextOrbit = fz.max + (Math.abs(tRoll2D('Resync') - 7) / 10);
                }
            }
            if (i === targetIdx) sys.baselineOrbit = nextOrbit;
            let sEcc = (tRoll2D('Orbit Eccentricity') - 2) * 0.05;
            slots.push({ orbitId: nextOrbit, occupant: null, eccentricity: Math.max(0, sEcc), type: 'S-Type', parentStarIdx: 0 });
            currentPos = nextOrbit;
        }

        // 4. World Queue & Placement
        // WBH Step 8 Order: Mainworld, Empty, Gas Giants, Planetoid Belts, Terrestrials
        // WBH Step 8 Placement Order (STRICT SEQUENCE): 
        // 1. Mainworld (Anchor)
        // 2. Empty Orbits (Obstacles for following worlds)
        // 3. Gas Giants (Dynamic Colliders)
        // 4. Planetoid Belts
        // 5. Terrestrial Planets

        let queue = [];
        if (mainworldBase) {
            const isPreMoon = mainworldBase.isMoon || (mainworldBase.tradeCodes && mainworldBase.tradeCodes.includes('Sa'));
            if (isPreMoon) {
                if (sys.gasGiants === 0) {
                    sys.gasGiants = 1;
                    tResult('WBH Consistency', 'Forced Gas Giant presence for pre-existing Mainworld moon');
                }
                queue.push({ type: 'Mainworld', size: mainworldBase.size || 7, isAnchor: true, isPreMoon: true });
            } else {
                queue.push({ type: 'Mainworld', size: mainworldBase.size || 7, isAnchor: true });
            }
        }
        for (let i = 0; i < emptyCount; i++) queue.push({ type: 'Empty' });
        for (let i = 0; i < sys.gasGiants; i++) queue.push({ type: 'Gas Giant' });
        for (let i = 0; i < sys.planetoidBelts; i++) queue.push({ type: 'Planetoid Belt' });

        let terrToPlace = mainworldBase ? (sys.terrestrialPlanets - 1) : sys.terrestrialPlanets;
        for (let i = 0; i < terrToPlace; i++) {
            queue.push({ type: 'Terrestrial Planet' });
        }
        let mainworldDone = false;
        let mainworldDemoted = false; // Separate flag: only true after the demotion fires, not on normal placement

        // WBH Step 8: Placing Worlds (Refactored for Sliding Collisions)
        while (queue.length > 0) {
            let wInfo = queue.shift();

            // Sean Protocol: Prevent duplicate Mainworld placement if already demoted via anchor collision
            if (wInfo.type === 'Mainworld' && mainworldDone) {
                if (window.isLoggingEnabled) writeLogLine(`[WBH SKIP] Skipping ${wInfo.type} as it was demoted to a moon earlier in the sequence.`);
                continue;
            }

            let startIdx = (wInfo.type === 'Mainworld' && wInfo.isAnchor) ? targetIdx : Math.floor(rng() * slots.length);

            if (window.isLoggingEnabled) {
                writeLogLine(`[WBH PROBE] Placing ${wInfo.type}. Picking Slot ${startIdx}/${slots.length} (TargetHW: ${targetIdx})`);
            }

            let landed = false;
            let currentIdx = startIdx;
            let attempts = 0;

            // WBH While-Loop: Sequential Search & Collision Trap
            while (!landed && attempts < slots.length) {
                let s = slots[currentIdx];

                // 1. WBH ANCHOR EXCEPTION (The Trap)
                // If the slot is the Mainworld's Anchor index, we MUST trigger the demotion rule (Item 4).
                // Guard: only fires ONCE. After the first demotion, subsequent bodies at targetIdx use
                // normal bumping — without this guard, GG2/GG3 wrongly get isLunarMainworld=true.
                if (mainworldBase && currentIdx === targetIdx && wInfo.type !== 'Mainworld' && !mainworldDemoted) {
                    // Logic: GG always overlaps Mainworld. Belt overlaps Size 1 Mainworld.
                    let shouldOverlap = (wInfo.type === 'Gas Giant') || (wInfo.type === 'Planetoid Belt' && (mainworldBase.size || 7) === 1);

                    if (mainworldBase.isPreMoon && wInfo.type === 'Gas Giant') shouldOverlap = true;

                    if (shouldOverlap) {
                        tResult('WBH Overlap Exception', `${wInfo.type} collided with Mainworld Anchor at Slot ${currentIdx}`);
                        if (window.isLoggingEnabled) writeLogLine(`[WBH COLLISION] ${wInfo.type} reached Mainworld Anchor at Slot ${currentIdx}. Demoting.`);


                        // WBH Item 4: Find the actual Mainworld object to demote
                        let oldMW = sys.worlds.find(w => w.type === 'Mainworld') || s.occupant;
                        if (!oldMW) {
                            // Fallback in case MW was not yet pushed to worlds array
                            oldMW = { 
                                type: 'Mainworld', 
                                isAnchor: true,
                                name: mainworldBase.name,
                                uwp: mainworldBase.uwp,
                                uwpSecondary: mainworldBase.uwpSecondary,
                                starport: mainworldBase.starport,
                                travelZone: mainworldBase.travelZone,
                                tradeCodes: mainworldBase.tradeCodes,
                                size: (mainworldBase.size !== undefined) ? mainworldBase.size : 7,
                                atm: mainworldBase.atm,
                                hydro: mainworldBase.hydro,
                                pop: mainworldBase.pop,
                                gov: mainworldBase.gov,
                                law: mainworldBase.law,
                                tl: mainworldBase.tl,
                                hexId: mainworldBase.hexId || sys.hexId
                            };
                        }
                        // Set PG presence/count to survive UI serialisation
                        oldMW.isMoon = true;
                        oldMW.isSatellite = true;
                        oldMW.isLunarMainworld = true;
                        oldMW.orbitId = s.orbitId;

                        // Sync trade codes: 'Sa' (Satellite) is required when mainworld is demoted to a lunar orbit.
                        // The socio engine adds 'Sa' only if isMoon is true at generation time — but isMoon is set here,
                        // after generation. Sync it now to keep the auditor's verifyTradeCodes check consistent.
                        if (oldMW.tradeCodes) {
                            if (!oldMW.tradeCodes.includes('Sa')) oldMW.tradeCodes.push('Sa');
                        } else {
                            oldMW.tradeCodes = ['Sa'];
                        }
                        
                        if (wInfo.type === 'Gas Giant') {
                            oldMW.parentType = 'Gas Giant';
                            oldMW.parentId = (sys.hexId || 'System') + "-GG-" + s.id;
                        } else if (wInfo.type === 'Planetoid Belt') {
                            oldMW.parentType = 'Planetoid Belt';
                            oldMW.parentId = (sys.hexId || 'System') + "-BELT-" + s.id;
                        } else {
                            oldMW.parentType = 'Terrestrial';
                            oldMW.parentId = (sys.hexId || 'System') + "-PLANET-" + s.id;
                        }


                        oldMW.pd = 10.0 + (rng() * 5.0);
                        oldMW.pos = 'Middle';
                        oldMW.retrograde = false;

                        let newPrimary = {
                            ...wInfo,
                            orbitId: s.orbitId,
                            au: oldMW.au,
                            parentStarIdx: s.parentStarIdx,
                            orbitType: s.type,
                            eccentricity: s.eccentricity,
                            moons: (wInfo.moons || []).concat([oldMW])
                        };

                        // Capture the placeholder 'world' previously placed at this anchor slot
                        // before we overwrite s.occupant. This placeholder has type='Mainworld' but
                        // is a ghost — it must be purged from sys.worlds to avoid duplicate Mainworlds.
                        let slotPlaceholder = s.occupant;

                        s.occupant = newPrimary;
                        
                        // WBH Fix: Remove original MW from the top-level list to prevent duplication.
                        // Also remove the placeholder that was placed at this anchor slot in the
                        // standard occupancy pass — it is a ghost Mainworld that causes:
                        //   1. The auditor to find 2 Mainworlds and fail strict validation
                        //   2. findMainworld() to return the wrong object (breaking the hex editor highlight)
                        sys.worlds = sys.worlds.filter(w => w !== oldMW && w !== slotPlaceholder);
                        sys.worlds.push(newPrimary);
                        mainworldDone = true;
                        mainworldDemoted = true;

                        // WBH Item 4: Add replacement Terrestrial to fill the gap (Sequential Expansion)
                        queue.push({ type: 'Terrestrial Planet' });
                        tResult('Replacement Rule', 'Added Terrestrial Planet to queue');

                        landed = true;
                        break;
                    }
                }

                // 2. STANDARD OCCUPANCY CHECK (Empty Slot)
                if (!s.occupant) {
                    if (window.isLoggingEnabled) writeLogLine(`[WBH LANDING] ${wInfo.type} claimed Orbit ${s.orbitId.toFixed(2)} at Slot ${currentIdx}.`);

                    let world = {
                        ...wInfo,
                        orbitId: s.orbitId,
                        // Convert orbit number to AU with interpolation
                        au: (() => {
                            let auInt = Math.floor(s.orbitId);
                            let auFrac = s.orbitId - auInt;
                            let orbitAuTable = MgT2EData.stellar.orbitAu;
                            let maxIdx = orbitAuTable.length - 1;
                            let limitIdx = Math.min(auInt, maxIdx);
                            let auTarget = orbitAuTable[limitIdx];
                            let auDiff = limitIdx < maxIdx ? (orbitAuTable[limitIdx + 1] - orbitAuTable[limitIdx]) : auTarget;
                            return auTarget + (auFrac * auDiff);
                        })(),
                        parentStarIdx: s.parentStarIdx,
                        orbitType: s.type,
                        eccentricity: s.eccentricity
                    };

                    // Sean Protocol: Propagate Mainworld data from mainworldBase if this is the Mainworld
                    if (wInfo.type === 'Mainworld' && mainworldBase) {
                        world.name = mainworldBase.name;
                        world.uwp = mainworldBase.uwp;
                        world.uwpSecondary = mainworldBase.uwpSecondary;
                        world.starport = mainworldBase.starport;
                        world.travelZone = mainworldBase.travelZone;
                        world.tradeCodes = mainworldBase.tradeCodes;
                        world.pop = mainworldBase.pop;
                        world.gov = mainworldBase.gov;
                        world.law = mainworldBase.law;
                        world.tl = mainworldBase.tl;
                        world.hexId = mainworldBase.hexId || sys.hexId;
                        mainworldDone = true;
                    }

                    s.occupant = world;
                    sys.worlds.push(world);
                    landed = true;
                    break;
                }


                // 3. WBH BUMPING (Index + 1 with Wrap-Around)
                if (window.isLoggingEnabled) writeLogLine(`[WBH BUMP] Slot ${currentIdx} occupied. Sliding to next orbit.`);
                currentIdx = (currentIdx + 1) % slots.length;
                attempts++;
            }

            if (!landed && window.isLoggingEnabled) {
                writeLogLine(`[WBH WARNING] Could not place ${wInfo.type} - system full!`);
            }
        }
        sys.worlds.sort((a, b) => a.orbitId - b.orbitId);

        if (window.isLoggingEnabled) endTrace();
        return sys;
    }

    return {
        generateStellarSystem,
        generateSystemInventory,
        allocateOrbits
    };
}));
