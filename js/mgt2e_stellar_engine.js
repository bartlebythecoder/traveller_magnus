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
     * Uses per-luminosity-class tables (starStats_V, starStats_Ia, etc.) with
     * subtype-key interpolation between x0/x5/x9 anchors.
     */
    const _SPECTRAL_TYPE_OFFSET = { O: 0, B: 10, A: 20, F: 30, G: 40, K: 50, M: 60 };

    function _spectralPos(key) {
        const type = key.slice(0, -1);
        const sub  = parseInt(key.slice(-1));
        return (_SPECTRAL_TYPE_OFFSET[type] || 0) + sub;
    }

    function generateStarObject(sType, subType, sClass, label = 'Star') {
        const stellar = MgT2EData.stellar;

        // BD and D bypass the spectral interpolation entirely
        if (sType === 'BD' || sType === 'D') {
            const bdStats = stellar.starStats_BD[sType] || stellar.starStats_BD['BD'];
            const lum = MgT2EMath.calculateStellarLuminosity(bdStats.diam, bdStats.temp);
            const star = { sClass, sType, subType, mass: bdStats.mass, diam: bdStats.diam, temp: bdStats.temp, lum,
                           name: `${sType} ${sClass}` };
            tResult(`${label} Classification`, star.name, 'MgT2E 1.1: Stellar Generation');
            tResult(`${label} Mass (Sol)`, star.mass, 'MgT2E 1.1: Stellar Generation');
            tResult(`${label} Temperature (K)`, star.temp, 'MgT2E 1.1: Stellar Generation');
            tResult(`${label} Diameter (Sol)`, star.diam, 'MgT2E 1.1: Stellar Generation');
            tResult(`${label} Luminosity (Sol)`, star.lum.toFixed(4), 'MgT2E 1.1: Stellar Generation');
            return star;
        }

        // Select per-class table; fall back to V if class is unrecognised
        const table = stellar['starStats_' + sClass] || stellar.starStats_V;

        // Class VI: B-type has no A/F anchor beyond B5 — clamp to prevent cross-type bleed
        let effectiveSubType = subType;
        if (sClass === 'VI' && sType === 'B' && subType > 5) effectiveSubType = 5;

        // Build sorted key list by spectral position
        const sortedKeys = Object.keys(table).sort((a, b) => _spectralPos(a) - _spectralPos(b));

        const targetPos = (_SPECTRAL_TYPE_OFFSET[sType] || 0) + effectiveSubType;

        // Find bracketing anchors
        let loKey = sortedKeys[0];
        let hiKey = null;
        for (const k of sortedKeys) {
            if (_spectralPos(k) <= targetPos) { loKey = k; }
            else { hiKey = k; break; }
        }

        const loStats = table[loKey];
        let mass, diam, temp;

        if (!hiKey) {
            // At or beyond last anchor — clamp
            mass = loStats.mass;
            diam = loStats.diam;
            temp = loStats.temp;
            tResult('Subtype Interpolation', `Clamped to ${loKey} (terminal anchor)`, 'MgT2E 1.1: Stellar Generation');
        } else {
            const hiStats = table[hiKey];
            const loPos   = _spectralPos(loKey);
            const hiPos   = _spectralPos(hiKey);
            const fraction = (targetPos - loPos) / (hiPos - loPos);
            mass = loStats.mass + (hiStats.mass - loStats.mass) * fraction;
            diam = loStats.diam + (hiStats.diam - loStats.diam) * fraction;
            temp = loStats.temp + (hiStats.temp - loStats.temp) * fraction;
            tResult('Subtype Interpolation', `${loKey}→${hiKey} at ${(fraction * 100).toFixed(0)}%`, 'MgT2E 1.1: Stellar Generation');
        }

        const lum = MgT2EMath.calculateStellarLuminosity(diam, temp);

        const star = {
            sClass, sType, subType,
            mass, diam, temp, lum,
            name: `${sType}${toEHex(subType)} ${sClass}`
        };

        tResult(`${label} Classification`, star.name, 'MgT2E 1.1: Stellar Generation');
        tResult(`${label} Mass (Sol)`, star.mass.toFixed(3), 'MgT2E 1.1: Stellar Generation');
        tResult(`${label} Temperature (K)`, star.temp.toFixed(0), 'MgT2E 1.1: Stellar Generation');
        tResult(`${label} Diameter (Sol)`, star.diam.toFixed(3), 'MgT2E 1.1: Stellar Generation');
        const limit100D = (star.diam * 1392700 * 100) / 1000000;
        tResult("100D Limit", `${limit100D.toFixed(1)} M km`, 'MgT2E 1.1: Stellar Generation');
        tResult(`${label} Luminosity (Sol)`, star.lum.toFixed(4), 'MgT2E 1.1: Stellar Generation');

        return star;
    }

    /**
     * Applies WBH White Dwarf mass, diameter, and cooling-table physics to a star.
     * Called after sys.age is finalised so deadAge can be derived from it.
     */
    function applyWhiteDwarfPhysics(star, sysAge) {
        tSection('White Dwarf Physics');

        // Mass: 2D roll + D10 fractional
        let d2Roll  = tRoll2D('WD Mass Roll (2D)');
        let d10Roll = Math.floor(rng() * 10) + 1;
        star.mass = ((d2Roll - 1) / 10) + (d10Roll / 100);
        tResult('WD Mass (Sol)', star.mass.toFixed(3), 'MgT2E 1.1: Stellar Life Cycles');

        // Diameter from mass (inverse relationship)
        star.diam = (1 / star.mass) * 0.01;

        // Dead age: random fraction of system age
        let deadFrac = (Math.floor(rng() * 100) + 1) / 100;
        let deadAge  = sysAge * deadFrac;
        tResult('WD Dead Age (Gyr)', deadAge.toFixed(2), 'MgT2E 1.1: Stellar Life Cycles');

        // Interpolate temperature from cooling table
        const table = MgT2EData.stellar.whiteDwarfAging;
        let baseTemp = table[table.length - 1].temp; // clamp to coldest
        for (let i = 0; i < table.length - 1; i++) {
            if (deadAge >= table[i].gyr && deadAge < table[i + 1].gyr) {
                let span     = table[i + 1].gyr  - table[i].gyr;
                let fraction = (deadAge - table[i].gyr) / span;
                baseTemp     = table[i].temp + fraction * (table[i + 1].temp - table[i].temp);
                break;
            }
        }

        // Mass-adjusted temperature and updated luminosity
        star.temp = baseTemp * (star.mass / 0.6);
        tResult('WD Temperature (K)', star.temp.toFixed(0), 'MgT2E 1.1: Stellar Life Cycles');
        star.lum  = MgT2EMath.calculateStellarLuminosity(star.diam, star.temp);
        tResult('WD Luminosity (Sol)', star.lum.toFixed(6), 'MgT2E 1.1: Stellar Life Cycles');
    }

    /**
     * Converts an AU distance to a Traveller orbit number using the standard orbit table.
     * Module-scope so both generateStellarSystem and allocateOrbits can call it.
     */
    function convertAuToOrbit(au) {
        const orbitAuTable = MgT2EData.stellar.orbitAu;
        for (let i = 0; i < orbitAuTable.length - 1; i++) {
            if (au >= orbitAuTable[i] && au < orbitAuTable[i + 1]) {
                let fraction = (au - orbitAuTable[i]) / (orbitAuTable[i + 1] - orbitAuTable[i]);
                return i + fraction;
            }
        }
        return 20.0;
    }

    /**
     * Computes the effective HZCO for a specific world based on all stars interior to its orbit.
     * Secondary-subsystem worlds use only their host star's luminosity.
     * Primary-subsystem worlds accumulate: primary + primary companion + any Close/Near/Far
     * secondary whose orbitId is less than the world's orbit.
     */
    function computeWorldHzco(orbitId, parentStarIdx, sys) {
        if (parentStarIdx !== 0) {
            const hostStar = sys.stars[parentStarIdx];
            return convertAuToOrbit(Math.sqrt(hostStar.lum));
        }
        let effectiveLum = 0;
        for (const star of sys.stars) {
            if (star.role === 'Primary') {
                effectiveLum += star.lum;
            } else if (star.separation === 'Companion' && star.parentStarIdx === 0) {
                effectiveLum += star.lum;
            } else if (star.parentStarIdx === 0 && star.separation !== 'Companion') {
                if (star.orbitId < orbitId) effectiveLum += star.lum;
            }
        }
        return convertAuToOrbit(Math.sqrt(effectiveLum));
    }

    /**
     * Resolves a 'Special' primary star result from bottomUpPrimaryType.
     * Rolls luminosity class (bottomUpSpecialType → bottomUpGiantsType),
     * then spectral type (2d6+1 on primaryType) with class-specific adjustments.
     */
    function resolveBottomUpSpecial(label) {
        tSection(`${label} Special Star Resolution`);
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Entering Special resolution — bottom-up primary roll was 2 (Special trigger)`);

        // -----------------------------------------------------------------
        // STEP 1: Luminosity Class (bottomUpSpecialType table)
        // -----------------------------------------------------------------
        tSection(`${label} Step 1 — Luminosity Class`);
        let specialRoll = tRoll2D(`${label} Special Class Roll (2D6)`);
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Special Class roll = ${specialRoll} → looking up bottomUpSpecialType`);

        let sClass = '';
        for (let entry of MgT2EData.stellar.bottomUpSpecialType) {
            if (specialRoll <= entry.maxRoll) {
                sClass = entry.sClass;
                break;
            }
        }
        tResult(`${label} Initial Class Result`, sClass, 'MgT2E 1.1: bottomUpSpecialType table');

        if (sClass === 'Giants') {
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Class result is 'Giants' — rolling on bottomUpGiantsType sub-table`);
            tSection(`${label} Step 1a — Giants Sub-class`);
            let giantsRoll = tRoll2D(`${label} Giants Sub-class Roll (2D6)`);
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Giants sub-class roll = ${giantsRoll} → looking up bottomUpGiantsType`);
            for (let entry of MgT2EData.stellar.bottomUpGiantsType) {
                if (giantsRoll <= entry.maxRoll) {
                    sClass = entry.sClass;
                    break;
                }
            }
            tResult(`${label} Giants Sub-class Result`, sClass, 'MgT2E 1.1: bottomUpGiantsType table');
        }

        tResult(`${label} Final Luminosity Class`, sClass, 'MgT2E 1.1: Stellar Generation');
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Luminosity class resolved → ${sClass}`);

        // -----------------------------------------------------------------
        // STEP 2: Spectral Type (2d6+1 on primaryType table)
        // -----------------------------------------------------------------
        tSection(`${label} Step 2 — Spectral Type`);
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Rolling 2D6+1 on primaryType table for spectral type`);
        let typeRollBase = tRoll2D(`${label} Spectral Type Roll (2D6)`);
        tDM('+1 Special Type DM', 1);
        let typeRoll = typeRollBase + 1;
        tResult(`${label} Adjusted Type Roll`, typeRoll, 'MgT2E 1.1: Special Type = 2D6+1');

        let sType = '';
        for (let entry of MgT2EData.stellar.primaryType) {
            if (typeRoll <= entry.maxRoll) {
                sType = entry.type;
                break;
            }
        }
        tResult(`${label} Initial Spectral Type`, sType, 'MgT2E 1.1: primaryType table lookup');
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Initial spectral type = ${sType} (roll ${typeRoll}, class ${sClass}) — checking for class-specific adjustments`);

        // -----------------------------------------------------------------
        // STEP 3a: Class IV Adjustments
        // Sub-giants cannot be M-type; O-type is capped at B
        // -----------------------------------------------------------------
        if (sClass === 'IV') {
            tSection(`${label} Step 3 — Class IV Adjustments`);
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Class IV (Sub-giant) — checking M-type suppression rule`);

            if (typeRoll <= 6) {
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Roll ${typeRoll} ≤ 6 → M-type result suppressed for Class IV; applying +5 DM`);
                tDM('+5 Class IV M-type suppression', 5);
                typeRoll += 5;
                tResult(`${label} Adjusted Type Roll (post M-suppression)`, typeRoll, 'MgT2E 1.1: Class IV cannot be M-type');
                sType = '';
                for (let entry of MgT2EData.stellar.primaryType) {
                    if (typeRoll <= entry.maxRoll) {
                        sType = entry.type;
                        break;
                    }
                }
                tResult(`${label} Re-looked Spectral Type`, sType, 'MgT2E 1.1: primaryType table re-lookup after M-suppression');
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Post M-suppression type = ${sType} (adjusted roll ${typeRoll})`);
            } else {
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Roll ${typeRoll} > 6 — no M-suppression needed`);
            }

            if (sType === 'Hot') {
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Type is Hot — rolling hotType sub-table (O will be capped to B for Class IV)`);
                tSection(`${label} Step 3 — Class IV Hot Resolution`);
                let hotRoll = tRoll2D(`${label} Hot Type Roll (2D6)`);
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Hot type roll = ${hotRoll}`);
                let hotType = '';
                for (let entry of MgT2EData.stellar.hotType) {
                    if (hotRoll <= entry.maxRoll) {
                        hotType = entry.type;
                        break;
                    }
                }
                tResult(`${label} Hot Table Result`, hotType, 'MgT2E 1.1: hotType table lookup');
                if (hotType === 'O') {
                    sType = 'B';
                    tResult(`${label} O→B Cap Applied`, `O changed to B (Class IV sub-giants cannot be O-type)`, 'MgT2E 1.1: Class IV O cap');
                    if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: O-type capped to B for Class IV sub-giant`);
                } else {
                    sType = hotType;
                    if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Hot type resolved to ${sType} — no cap needed`);
                }
            }

            tResult(`${label} Class IV Final Spectral Type`, sType, 'MgT2E 1.1: Stellar Generation');
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Class IV adjustments complete → final type = ${sType}`);
        }

        // -----------------------------------------------------------------
        // STEP 3b: Class VI Adjustments
        // Sub-dwarfs cannot be F-type (→G) or A-type (→B)
        // -----------------------------------------------------------------
        if (sClass === 'VI') {
            tSection(`${label} Step 3 — Class VI Adjustments`);
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Class VI (Sub-dwarf) — checking F→G and A→B restriction rules`);

            if (sType === 'Hot') {
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Type is Hot — resolving hotType first, then applying Class VI restrictions`);
                tSection(`${label} Step 3 — Class VI Hot Resolution`);
                let hotRoll = tRoll2D(`${label} Hot Type Roll (2D6)`);
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Hot type roll = ${hotRoll}`);
                let hotType = '';
                for (let entry of MgT2EData.stellar.hotType) {
                    if (hotRoll <= entry.maxRoll) {
                        hotType = entry.type;
                        break;
                    }
                }
                sType = hotType;
                tResult(`${label} Hot Table Result`, sType, 'MgT2E 1.1: hotType table lookup');
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Hot resolved to ${sType} — now applying Class VI restrictions`);
            }

            if (sType === 'F') {
                tResult(`${label} F→G Restriction`, `F changed to G (Class VI sub-dwarfs cannot be F-type)`, 'MgT2E 1.1: Class VI F restriction');
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: F-type restricted to G for Class VI sub-dwarf`);
                sType = 'G';
            }
            if (sType === 'A') {
                tResult(`${label} A→B Restriction`, `A changed to B (Class VI sub-dwarfs cannot be A-type)`, 'MgT2E 1.1: Class VI A restriction');
                if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: A-type restricted to B for Class VI sub-dwarf`);
                sType = 'B';
            }

            tResult(`${label} Class VI Final Spectral Type`, sType, 'MgT2E 1.1: Stellar Generation');
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Class VI adjustments complete → final type = ${sType}`);
        }

        // -----------------------------------------------------------------
        // STEP 3c: Hot Resolution for Giant/Supergiant classes (III, II, Ib, Ia)
        // No spectral type restrictions apply
        // -----------------------------------------------------------------
        if (sType === 'Hot') {
            tSection(`${label} Step 3 — Hot Resolution (${sClass})`);
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Type is Hot for class ${sClass} — rolling hotType sub-table (no restrictions)`);
            let hotRoll = tRoll2D(`${label} Hot Type Roll (2D6)`);
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Hot type roll = ${hotRoll}`);
            for (let entry of MgT2EData.stellar.hotType) {
                if (hotRoll <= entry.maxRoll) {
                    sType = entry.type;
                    break;
                }
            }
            tResult(`${label} Hot Table Result`, sType, 'MgT2E 1.1: hotType table lookup');
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Hot type resolved to ${sType} for ${sClass} class`);
        }

        // -----------------------------------------------------------------
        // STEP 4: Subtype
        // Class IV K-type restricted to 0-4 (cooler end of K band only)
        // All others: 0-9
        // -----------------------------------------------------------------
        tSection(`${label} Step 4 — Subtype`);
        let subType;
        if (sClass === 'IV' && sType === 'K') {
            subType = Math.floor(rng() * 5);
            tResult(`${label} Subtype`, subType, 'MgT2E 1.1: Class IV K restricted to subtype 0-4');
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Class IV K-type — subtype restricted to 0-4, rolled ${subType}`);
        } else {
            subType = Math.floor(rng() * 10);
            tResult(`${label} Subtype`, subType, 'MgT2E 1.1: Subtype 0-9');
            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Subtype roll 0-9 = ${subType}`);
        }

        // -----------------------------------------------------------------
        // FINAL RESULT
        // -----------------------------------------------------------------
        tResult(`${label} Special Star Final`, `${sType}${subType} ${sClass}`, 'MgT2E 1.1: Bottom-Up Special Star');
        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${label}: Special resolution complete → ${sType}${subType} ${sClass}`);

        return generateStarObject(sType, subType, sClass, label);
    }

    /**
     * Helper to roll a MgT2E Star type and class.
     * tableKey selects which primary type table to use (primaryType or bottomUpPrimaryType).
     */
    function rollStar(label = 'Star', tableKey = 'primaryType') {
        let roll = tRoll2D(`${label} Type Roll`);
        let sType = '';
        let sClass = 'V';

        for (let entry of MgT2EData.stellar[tableKey]) {
            if (roll <= entry.maxRoll) {
                sType = entry.type;
                sClass = entry.class || sClass;
                break;
            }
        }

        if (sType === 'Special') {
            return resolveBottomUpSpecial(label);
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
        tResult(`${label} Subtype (0-9)`, subType, 'MgT2E 1.1: Stellar Generation');

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
        tResult(`${label} Determination Result`, determination, 'MgT2E 1.2: Binary/Multiple Stars');

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
                tResult(`${label} Twin Variation`, `-${varPct}% mass/diameter`, 'MgT2E 1.2: Binary/Multiple Stars');
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
                tResult(`${label} Override`, 'Random -> Lesser', 'MgT2E 1.2: Binary/Multiple Stars');
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
     * Eccentricity for regular planets (size > 0). Belts always get 0 and must not call this.
     */
    function determinePlanetEccentricity(orbitId, sysAge, orbitType, extraDM = 0) {
        let roll = tRoll2D('Planet Eccentricity Roll');
        let dm = 0;
        if (extraDM !== 0) { tDM('Anomaly Type', extraDM); dm += extraDM; }
        if (orbitType === 'P-Type') { tDM('P-Type Orbit', 1); dm += 1; }
        if (sysAge > 1.0 && orbitId < 1.0) { tDM('Old Inner System', 1); dm += 1; }

        let sumRoll = roll + dm;
        let base = 0, fraction = 0;
        if (sumRoll <= 5) { base = -0.001; fraction = tRoll1D('Ecc Jitter') / 1000; }
        else if (sumRoll <= 7) { base = 0.000; fraction = tRoll1D('Ecc Jitter') / 200; }
        else if (sumRoll <= 9) { base = 0.030; fraction = tRoll1D('Ecc Jitter') / 100; }
        else if (sumRoll === 10) { base = 0.050; fraction = tRoll1D('Ecc Jitter') / 20; }
        else if (sumRoll === 11) { base = 0.050; fraction = tRoll2D('Ecc Jitter') / 20; }
        else { base = 0.300; fraction = tRoll2D('Ecc Jitter') / 20; }

        const ecc = Math.max(0, base + fraction);
        tResult('Planet Eccentricity', ecc.toFixed(3));
        return ecc;
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
    function generateStellarSystem(sys, hexId, mainworldBase, mode = 'topdown') {
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
            tResult('Primary Override', primaryStr, 'MgT2E 1.1: Stellar Generation');
        } else {
            const bottomUpTable = window.generationUseRealisticStellar
                ? 'bottomUpRealisticPrimaryType'
                : 'bottomUpPrimaryType';
            primary = rollStar('Primary', mode === 'bottom-up' ? bottomUpTable : 'primaryType');
        }

        primary.role = 'Primary';
        primary.separation = null;
        primary.orbitId = null;
        primary.eccentricity = 0;
        primary.mao = getMAO(primary.sType, primary.subType, primary.sClass);
        sys.stars.push(primary);

        tSection('System Age');
        let msLifespan      = 10 / Math.pow(primary.mass, 2.5);
        let subgiantLifespan = msLifespan / (4 + primary.mass);
        let giantLifespan    = msLifespan / (10 * Math.pow(primary.mass, 3));
        tResult('Main Sequence Lifespan', msLifespan.toFixed(2) + " Gyr", 'MgT2E 1.1: Stellar Life Cycles');

        // Phase Variance — how far along the star is in its current phase
        let phaseVariance;
        if (primary.mass >= 0.9 && !['BD', 'L', 'T', 'Y'].includes(primary.sType)) {
            let d6Roll  = tRoll1D('Age Variance (1D6)');
            let d10Roll = Math.floor(rng() * 10) + 1;
            phaseVariance = ((d6Roll - 1) + (d10Roll / 10)) / 6;
            tResult('Phase Variance (High-Mass)', phaseVariance.toFixed(3), 'MgT2E 1.1: Stellar Life Cycles');
        } else {
            phaseVariance = (Math.floor(rng() * 100) + 1) / 100;
            tResult('Phase Variance (Standard)', phaseVariance.toFixed(3), 'MgT2E 1.1: Stellar Life Cycles');
        }

        // Age by Luminosity Class
        if (primary.sType === 'D') {
            let r1 = tRoll1D('Age Base (1D*2)');
            let r2 = Math.ceil(tRoll1D('Age Offset (1D3)') / 2);
            sys.age = (r1 * 2) + r2 - 1 + (Math.floor(rng() * 10) / 10);
        } else if (primary.sClass === 'IV') {
            tResult('Subgiant Lifespan', subgiantLifespan.toFixed(3) + " Gyr", 'MgT2E 1.1: Stellar Life Cycles');
            sys.age = msLifespan + (subgiantLifespan * phaseVariance);
        } else if (['III', 'II', 'Ib', 'Ia'].includes(primary.sClass)) {
            tResult('Subgiant Lifespan', subgiantLifespan.toFixed(3) + " Gyr", 'MgT2E 1.1: Stellar Life Cycles');
            tResult('Giant Lifespan', giantLifespan.toFixed(3) + " Gyr", 'MgT2E 1.1: Stellar Life Cycles');
            sys.age = msLifespan + subgiantLifespan + (giantLifespan * phaseVariance);
        } else if (primary.mass < 0.9 || ['BD', 'L', 'T', 'Y'].includes(primary.sType)) {
            let r1 = tRoll1D('Age Base (1D*2)');
            let r2 = Math.ceil(tRoll1D('Age Offset (1D3)') / 2);
            sys.age = (r1 * 2) + r2 - 1 + (Math.floor(rng() * 10) / 10);
        } else {
            // Class V/VI high-mass main sequence
            sys.age = msLifespan * phaseVariance;
        }
        sys.age = Math.max(0.1, sys.age);
        tResult('System Age', sys.age.toFixed(2) + " Gyr", 'MgT2E 1.1: Stellar Life Cycles');

        if (primary.sType === 'D') { applyWhiteDwarfPhysics(primary, sys.age); }

        // HZCO calculation (module-scope convertAuToOrbit used here and in allocateOrbits)
        let hzcoAu = Math.sqrt(primary.lum);
        sys.hzco = convertAuToOrbit(hzcoAu);
        tResult('HZCO (Orbit)', sys.hzco.toFixed(3), 'MgT2E 1.3: HZCO Formula');

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
                if (star.sType === 'D') { applyWhiteDwarfPhysics(star, sys.age); }
                tResult(`${repRole} Override`, sStr + " at Orbit " + star.orbitId, 'MgT2E 1.2: Binary/Multiple Stars');
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
                    if (star.sType === 'D') { applyWhiteDwarfPhysics(star, sys.age); }
                    tResult(`${def.sep} Star`, star.name + " at Orbit " + star.orbitId, 'MgT2E 1.2: Binary/Multiple Stars');

                    // Companion Check for this secondary star
                    let secCompDM = getMultiDM(star);
                    tDM(`${def.sep} Companion DM`, secCompDM);
                    if (tRoll2D(`${def.sep} Star: Companion Presence`) + secCompDM >= 10) {
                        let companion = determineNonPrimaryStar(star, 'Companion', `${def.sep} Star Companion`);
                        companion.separation = 'Companion';
                        companion.role = 'Companion';
                        companion.parentStarIdx = sys.stars.length - 1;
                        let d1 = tRoll1D(`${def.sep} Comp Orbit D1`);
                        let d2 = tRoll2D(`${def.sep} Comp Orbit D2`);
                        companion.orbitId = (d1 / 10) + ((d2 - 7) / 100);
                        companion.eccentricity = determineEccentricity(true, 0, sys.age, companion.orbitId, false, 0);
                        sys.stars.push(companion);
                        if (companion.sType === 'D') { applyWhiteDwarfPhysics(companion, sys.age); }
                        tResult(`${def.sep} Star Companion`, companion.name + ' at Orbit ' + companion.orbitId.toFixed(3), 'MgT2E 1.2: Binary/Multiple Stars');
                    }
                }
            }

            // Primary Companion Check — every system rolls for this
            tSection('Primary Companion Check');
            let primaryCompDM = getMultiDM(primary);
            tDM('Primary Companion DM', primaryCompDM);
            if (tRoll2D('Primary: Companion Presence') + primaryCompDM >= 10) {
                let primaryCompanion = determineNonPrimaryStar(primary, 'Companion', 'Primary Companion');
                primaryCompanion.separation = 'Companion';
                primaryCompanion.role = 'Companion';
                primaryCompanion.parentStarIdx = 0;
                let d1 = tRoll1D('Primary Comp Orbit D1');
                let d2 = tRoll2D('Primary Comp Orbit D2');
                primaryCompanion.orbitId = (d1 / 10) + ((d2 - 7) / 100);
                primaryCompanion.eccentricity = determineEccentricity(true, 0, sys.age, primaryCompanion.orbitId, false, 0);
                sys.stars.push(primaryCompanion);
                if (primaryCompanion.sType === 'D') { applyWhiteDwarfPhysics(primaryCompanion, sys.age); }
                tResult('Primary Companion', primaryCompanion.name + ' at Orbit ' + primaryCompanion.orbitId.toFixed(3), 'MgT2E 1.2: Binary/Multiple Stars');

                // Recalculate HZCO: all primary-subsystem worlds orbit both stars, so use combined luminosity
                const combinedLum = primary.lum + primaryCompanion.lum;
                const newHzcoAu = Math.sqrt(combinedLum);
                sys.hzco = convertAuToOrbit(newHzcoAu);
                tResult('HZCO Recalculated (Circumbinary)', `${primary.lum.toFixed(4)} + ${primaryCompanion.lum.toFixed(4)} = ${combinedLum.toFixed(4)} L☉ → Orbit ${sys.hzco.toFixed(3)}`, 'MgT2E 1.3: HZCO Formula');
            }
        }

        return sys;
    }

    /**
     * Step 3: Total Worlds Inventory
     */
    function generateSystemInventory(sys, mainworldBase) {
        tSection('System Inventory');

        // worldCount must be a finite positive number — NaN (from '?' UWP fields on XXXX/unknown
        // systems) and 0 both fall back to random generation so the mainworld can always be placed.
        const hasT5Override = mainworldBase &&
            mainworldBase.gasGiantsCount !== undefined &&
            mainworldBase.planetoidBelts !== undefined &&
            Number.isFinite(mainworldBase.worldCount) &&
            mainworldBase.worldCount > 0;

        if (hasT5Override) {
            // T5/OTU Import Override: use PBG and W. field directly instead of rolling.
            sys.gasGiants = mainworldBase.gasGiantsCount;
            tResult('Gas Giants (T5 Override)', sys.gasGiants, 'MgT2E 1.3: System Inventory');

            sys.planetoidBelts = mainworldBase.planetoidBelts;
            tResult('Planetoid Belts (T5 Override)', sys.planetoidBelts, 'MgT2E 1.3: System Inventory');

            sys.terrestrialPlanets = Math.max(0, mainworldBase.worldCount - sys.gasGiants - sys.planetoidBelts);
            tResult('Terrestrial Planets (T5 Derived)', sys.terrestrialPlanets, 'MgT2E 1.3: System Inventory');

            sys.totalWorlds = mainworldBase.worldCount;
            tResult('Total Worlds (T5 Override)', sys.totalWorlds, 'MgT2E 1.3: System Inventory');

            return sys;
        }

        // Gas Giants - WBH Adjustment: 83% presence (9-) to satisfy the 15-20% Lunar Mainworld statistical requirement
        let ggRoll = tRoll2D('Gas Giant Presence (<= 9)');
        let ggExists = ggRoll <= 9 || (mainworldBase && mainworldBase.gasGiant);
        if (ggExists) {
            let ggQ = tRoll2D('GG Quantity');
            const ggDMs = MgT2EData.systemInventory.gasGiantDMs;
            const primary = sys.stars[0];
            if (sys.stars.length === 1 && primary.sClass === 'V') { tDM('Single V', ggDMs.singleClassV); ggQ += ggDMs.singleClassV; }
            if (['BD', 'L', 'T', 'Y'].includes(primary.sType)) { tDM('Primary Brown Dwarf', ggDMs.primaryBrownDwarf); ggQ += ggDMs.primaryBrownDwarf; }
            if (primary.sType === 'D') { tDM('Primary Post-Stellar', ggDMs.primaryPostStellar); ggQ += ggDMs.primaryPostStellar; }
            const postStellarCount = sys.stars.filter(s => s.sType === 'D').length;
            if (postStellarCount > 0) { tDM('Post-Stellar Stars', ggDMs.perPostStellar * postStellarCount); ggQ += ggDMs.perPostStellar * postStellarCount; }
            if (sys.stars.length >= 4) { tDM('4+ Stars', ggDMs.fourOrMoreStars); ggQ += ggDMs.fourOrMoreStars; }

            for (let entry of MgT2EData.systemInventory.gasGiants) {
                if (ggQ <= entry.maxRoll) {
                    sys.gasGiants = entry.count;
                    break;
                }
            }
        } else {
            sys.gasGiants = 0;
        }
        tResult('Gas Giants', sys.gasGiants, 'MgT2E 1.3: System Inventory');

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
        tResult('Planetoid Belts', sys.planetoidBelts, 'MgT2E 1.3: System Inventory');

        // Terrestrial Planets
        let tpRoll = tRoll2D('Terrestrial Quantity');
        tDM('Fixed', -2);
        let tpCount = tpRoll - 2;
        if (tpCount < 3) {
            writeLogLine(`  Base count: ${tpCount} (< 3, result is too low — applying D3+2 floor)`);
            const d3Raw = rollD3();
            writeLogLine(`Low Result Floor (D3+2): Rolled 1D3 for ${d3Raw} + 2 = ${d3Raw + 2}`);
            tpCount = d3Raw + 2;
        } else {
            writeLogLine(`  Base count: ${tpCount} (>= 3, adding D3-1 bonus worlds)`);
            const d3Raw = rollD3();
            writeLogLine(`Bonus Worlds (D3-1): Rolled 1D3 for ${d3Raw} - 1 = ${d3Raw - 1}`);
            tpCount += d3Raw - 1;
        }
        sys.terrestrialPlanets = tpCount;
        tResult('Terrestrial Planets', sys.terrestrialPlanets, 'MgT2E 1.3: System Inventory');

        sys.totalWorlds = sys.gasGiants + sys.planetoidBelts + sys.terrestrialPlanets;
        tResult('Total Worlds', sys.totalWorlds, 'MgT2E 1.3: System Inventory');
        // Anomalous worlds are rolled and placed in Step 7 (allocateOrbits),
        // after regular slot allocation, per MgT2E rules sequence.

        return sys;
    }

    /**
     * Legacy Logic: Chunk 2 (Orbit Allocation)
     */
    function allocateOrbits(sys, mainworldBase) {
        tSection('Orbit Allocation');
        sys.worlds = [];
        let primary = sys.stars[0];
        const eligibleStars = sys.stars.filter(s => s.separation !== 'Companion');

        // Step 1: Roll Baseline Number (2D + DMs)
        // Must be determined before Baseline Orbit so the correct method (1/2/3/4) can be selected.
        {
            const bnDMs = MgT2EData.systemInventory.baselineNumberDMs;
            let bnRoll = tRoll2D('Baseline Number');

            const hasPrimaryCompanion = sys.stars.some(s => s.separation === 'Companion' && s.parentStarIdx === 0);
            if (hasPrimaryCompanion)                           { tDM('Primary has Companion', bnDMs.primaryHasCompanion); bnRoll += bnDMs.primaryHasCompanion; }
            if (['Ia', 'Ib', 'II'].includes(primary.sClass))  { tDM(`Primary ${primary.sClass}`, bnDMs.primaryClassIaIbII); bnRoll += bnDMs.primaryClassIaIbII; }
            else if (primary.sClass === 'III')                 { tDM('Primary III', bnDMs.primaryClassIII); bnRoll += bnDMs.primaryClassIII; }
            else if (primary.sClass === 'IV')                  { tDM('Primary IV', bnDMs.primaryClassIV); bnRoll += bnDMs.primaryClassIV; }
            else if (primary.sClass === 'VI')                  { tDM('Primary VI', bnDMs.primaryClassVI); bnRoll += bnDMs.primaryClassVI; }
            if (primary.sType === 'D')                         { tDM('Primary Post-Stellar', bnDMs.primaryPostStellar); bnRoll += bnDMs.primaryPostStellar; }

            const tw = sys.totalWorlds;
            let worldsDM = 0;
            if (tw < 6)                    worldsDM = bnDMs.totalWorldsLt6;
            else if (tw <= 9)              worldsDM = bnDMs.totalWorlds6to9;
            else if (tw <= 12)             worldsDM = bnDMs.totalWorlds10to12;
            else if (tw <= 15)             worldsDM = bnDMs.totalWorlds13to15;
            else if (tw >= 18 && tw <= 20) worldsDM = bnDMs.totalWorlds18to20;
            else if (tw > 20)              worldsDM = bnDMs.totalWorldsGt20;
            if (worldsDM !== 0) { tDM(`Total Worlds (${tw})`, worldsDM); bnRoll += worldsDM; }

            const secondaryEligible = eligibleStars.filter(s => s.role !== 'Primary');
            if (secondaryEligible.length > 0) {
                const secDM = bnDMs.perSecondaryStar * secondaryEligible.length;
                tDM(`Secondary Stars (×${secondaryEligible.length})`, secDM);
                bnRoll += secDM;
            }

            // Allow BN < 1: Cold Systems (Method 2) require BN < 1 to be preserved.
            // The clamp to min 1 is applied only in the System Spread denominator below.
            sys.baselineNumber = bnRoll;
            tResult('Baseline Number', sys.baselineNumber, 'MgT2E 1.3: Orbital Allocation (unclamped)');
        }
        const baselineNumber = sys.baselineNumber;

        // 1. Baseline Orbit — method dispatch
        // Helper: compute atmosphere DM for temperature reverse-engineering
        function getAtmDM(atm) {
            if ([2, 3].includes(atm)) return -2;
            if ([4, 5, 14].includes(atm)) return -1;
            if ([8, 9].includes(atm)) return 1;
            if ([10, 13, 15].includes(atm)) return 2;
            if ([11, 12].includes(atm)) return 6;
            return 0;
        }

        // Helper: apply HZCO deviation using the 3-branch formula
        function applyHzcoDeviation(hzco, deviation) {
            if (hzco >= 1.0) {
                return { orbit: hzco + deviation, formula: `HZCO (${hzco.toFixed(3)}) + dev (${deviation.toFixed(3)}) [HZCO≥1]` };
            } else if (deviation > 0) {
                return { orbit: hzco * (1 + deviation), formula: `HZCO (${hzco.toFixed(3)}) × (1 + dev (${deviation.toFixed(3)})) [HZCO<1, dev+]` };
            } else if (deviation < 0) {
                return { orbit: hzco / (1 - deviation), formula: `HZCO (${hzco.toFixed(3)}) / (1 - dev (${deviation.toFixed(3)})) [HZCO<1, dev-]` };
            } else {
                return { orbit: hzco, formula: `HZCO (${hzco.toFixed(3)}) [zero deviation]` };
            }
        }

        // Helper: determine if a top-down mainworld resides in the habitable zone
        function isMainworldInHZ(mw) {
            const tempModMap = { 'Frozen': 2, 'Cold': 4, 'Temperate': 7, 'Hot': 10, 'Boiling': 12 };
            const modifiedRoll = tempModMap[mw.tempBand] ?? 7;
            const rawRoll = modifiedRoll - getAtmDM(mw.atm || 0);
            tResult('HZ Check', `tempBand=${mw.tempBand ?? 'unknown (defaulting Temperate)'}, modRoll=${modifiedRoll}, atmDM=${getAtmDM(mw.atm || 0)}, rawRoll=${rawRoll} → ${rawRoll >= 3 && rawRoll <= 11 ? 'IN HZ (Method 4)' : 'OUTSIDE HZ (Methods 1/2/3)'}`, 'MgT2E Step 1');
            return rawRoll >= 3 && rawRoll <= 11;
        }

        const tw = sys.totalWorlds;
        const primaryMAOEarly = primary.mao || 0.01;
        const useMethod4 = mainworldBase != null && isMainworldInHZ(mainworldBase);
        tSection('Baseline Orbit Calculation');

        let baselineOrbit;

        if (useMethod4) {
            // Method 4: Continuation — top-down mainworld in HZ.
            // Reverse-engineer the world's temperature to get its orbit deviation from HZCO.
            tResult('Method Selected', '4 — Continuation (top-down mainworld in habitable zone)', 'MgT2E Step 1');
            const tempModMap = { 'Frozen': 2, 'Cold': 4, 'Temperate': 7, 'Hot': 10, 'Boiling': 12 };
            const modifiedRoll = tempModMap[mainworldBase.tempBand] ?? 7;
            const atmDM = getAtmDM(mainworldBase.atm || 0);
            const rawHzRoll = Math.max(2, Math.min(12, modifiedRoll - atmDM));
            let hzDeviation = MgT2EData.stellar.hzDeviation[rawHzRoll];
            const hzDeviationBase = hzDeviation;
            const variance = (Math.floor(rng() * 10)) / 100;
            hzDeviation += (hzDeviation >= 0 ? variance : -variance);
            writeLogLine(`Method 4: modRoll=${modifiedRoll}, atmDM=${atmDM}, rawHzRoll=${rawHzRoll} → base dev ${hzDeviationBase.toFixed(2)}, variance +${variance.toFixed(2)} → final dev ${hzDeviation.toFixed(2)}`);
            const result = applyHzcoDeviation(sys.hzco, hzDeviation);
            baselineOrbit = result.orbit;
            writeLogLine(`Baseline Orbit Formula: ${result.formula} = ${baselineOrbit.toFixed(3)}`);

        } else if (baselineNumber >= 1 && baselineNumber <= tw) {
            // Method 1: Standard — BN is between 1 and Total Worlds.
            tResult('Method Selected', `1 — Standard (BN ${baselineNumber} between 1 and TW ${tw})`, 'MgT2E Step 1');
            const devRoll = tRoll2D('Method 1 Variance (2D-7)');
            if (sys.hzco >= 1.0) {
                const deviation = (devRoll - 7) / 10;
                baselineOrbit = sys.hzco + deviation;
                writeLogLine(`Method 1 (HZCO≥1): HZCO (${sys.hzco.toFixed(3)}) + (${devRoll}-7)/10 (${deviation.toFixed(3)}) = ${baselineOrbit.toFixed(3)}`);
            } else {
                const deviation = (devRoll - 7) / 100;
                baselineOrbit = sys.hzco + deviation;
                writeLogLine(`Method 1 (HZCO<1): HZCO (${sys.hzco.toFixed(3)}) + (${devRoll}-7)/100 (${deviation.toFixed(3)}) = ${baselineOrbit.toFixed(3)}`);
            }

        } else if (baselineNumber < 1) {
            // Method 2: Cold System — all worlds are beyond HZCO.
            tResult('Method Selected', `2 — Cold System (BN ${baselineNumber} < 1)`, 'MgT2E Step 1');
            const devRoll = tRoll2D('Method 2 Variance (2D-7)');
            const deviation = (devRoll - 7) / 5;
            if (primaryMAOEarly >= 1.0) {
                baselineOrbit = sys.hzco - baselineNumber + tw + deviation;
                writeLogLine(`Method 2 (MAO≥1): HZCO (${sys.hzco.toFixed(3)}) - BN (${baselineNumber}) + TW (${tw}) + dev (${deviation.toFixed(3)}) = ${baselineOrbit.toFixed(3)}`);
            } else {
                baselineOrbit = primaryMAOEarly - (baselineNumber / 10) + (tw / 10) + deviation;
                writeLogLine(`Method 2 (MAO<1): MAO (${primaryMAOEarly.toFixed(3)}) - BN/10 (${(baselineNumber/10).toFixed(3)}) + TW/10 (${(tw/10).toFixed(3)}) + dev (${deviation.toFixed(3)}) = ${baselineOrbit.toFixed(3)}`);
            }

        } else {
            // Method 3: Hot System — BN > Total Worlds; all worlds orbit inside HZCO.
            tResult('Method Selected', `3 — Hot System (BN ${baselineNumber} > TW ${tw})`, 'MgT2E Step 1');
            const baseCalc = sys.hzco - baselineNumber + tw;
            tResult('Base Calc (HZCO - BN + TW)', baseCalc.toFixed(3), 'MgT2E Step 1');
            if (baseCalc >= 1.0) {
                const devRoll = tRoll2D('Method 3 Variance (2D-7)/5');
                const deviation = (devRoll - 7) / 5;
                baselineOrbit = baseCalc + deviation;
                writeLogLine(`Method 3a (base≥1): (${baseCalc.toFixed(3)}) + dev (${deviation.toFixed(3)}) = ${baselineOrbit.toFixed(3)}`);
            } else {
                const devRoll = tRoll2D('Method 3 Variance (2D-2)/100');
                const deviation = (devRoll - 2) / 100;
                baselineOrbit = sys.hzco - (baselineNumber / 10) + (tw / 10) + deviation;
                writeLogLine(`Method 3b (base<1): HZCO (${sys.hzco.toFixed(3)}) - BN/10 (${(baselineNumber/10).toFixed(3)}) + TW/10 (${(tw/10).toFixed(3)}) + dev (${deviation.toFixed(3)}) = ${baselineOrbit.toFixed(3)}`);
                if (baselineOrbit < 0) {
                    baselineOrbit = Math.max(sys.hzco - 0.1, primaryMAOEarly + tw * 0.01);
                    writeLogLine(`Method 3b edge case: result negative, clamped to max(HZCO-0.1, MAO+TW×0.01) = ${baselineOrbit.toFixed(3)}`);
                }
            }
        }

        sys.baselineOrbit = baselineOrbit;
        tResult('Baseline Orbit', sys.baselineOrbit.toFixed(3), 'MgT2E Step 1');

        // 1b. Mainworld Target Orbit override (top-down mainworld outside HZ)
        // When Methods 1/2/3 drive the baseline orbit (for system spread), the mainworld itself
        // must still anchor at its temperature-appropriate orbit — not at the baseline orbit.
        let mainworldTargetOrbit = null;
        if (mainworldBase != null && !useMethod4) {
            tSection('Mainworld Target Orbit (out-of-HZ override)');
            const tempModMap = { 'Frozen': 2, 'Cold': 4, 'Temperate': 7, 'Hot': 10, 'Boiling': 12 };
            const modifiedRoll = tempModMap[mainworldBase.tempBand] ?? 7;
            const atmDM = getAtmDM(mainworldBase.atm || 0);
            const rawHzRoll = Math.max(2, Math.min(12, modifiedRoll - atmDM));
            let mwDeviation = MgT2EData.stellar.hzDeviation[rawHzRoll];
            const mwVariance = (Math.floor(rng() * 10)) / 100;
            mwDeviation += (mwDeviation >= 0 ? mwVariance : -mwVariance);
            writeLogLine(`MW Target: modRoll=${modifiedRoll}, atmDM=${atmDM}, rawHzRoll=${rawHzRoll} → dev ${mwDeviation.toFixed(3)}`);
            const mwResult = applyHzcoDeviation(sys.hzco, mwDeviation);
            mainworldTargetOrbit = mwResult.orbit;
            tResult('Mainworld Target Orbit', mainworldTargetOrbit.toFixed(3), `${mwResult.formula} — WBH anchor overrides baseline`);
        }

        // 2. Forbidden Zones
        tSection('Forbidden Zones');
        let rawFZ = [];
        let primaryMao = getMAO(primary.sType, primary.subType, primary.sClass);
        let directCompanions = sys.stars.filter(s => s.parentStarIdx === 0 && s.separation !== 'Companion');

        for (let comp of directCompanions) {
            let co = comp.orbitId;
            let cm = comp.mao || 0;
            let ce = comp.eccentricity || 0;
            
            // WBH Base Exclusion: +/- 1.0 Orbit#
            let fmin = co - 1.0; 
            let fmax = co + 1.0;
            tResult('Base Exclusion Zone', `Orbit ${fmin.toFixed(2)} to ${fmax.toFixed(2)} (Star at ${co.toFixed(2)})`, 'MgT2E 1.3: Forbidden Zones');

            // WBH MAO Expansion
            if (cm > 0.2) { 
                fmin -= cm; 
                fmax += cm; 
                tResult('FZ Expansion (MAO > 0.2)', `Added ±${cm.toFixed(2)} (New: ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`, 'MgT2E 1.3: Forbidden Zones');
            }

            // WBH Rule 6: Tier 1 Eccentricity Expansion
            if (ce > 0.2) { 
                fmin -= 1.0; 
                fmax += 1.0; 
                tResult('FZ Expansion (Ecc > 0.2)', `Added ±1.0 (New: ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`, 'MgT2E 1.3: Forbidden Zones');
            }

            // WBH Rule 7: Tier 2 Eccentricity Expansion
            if (ce > 0.5 && (comp.separation === 'Close' || comp.separation === 'Near')) {
                fmin -= 1.0;
                fmax += 1.0;
                tResult('FZ Expansion (Ecc > 0.5 & Close/Near)', `Added ±1.0 (New: ${fmin.toFixed(2)} to ${fmax.toFixed(2)})`, 'MgT2E 1.3: Forbidden Zones');
            }

            rawFZ.push({ min: fmin, max: fmax });
        }
        rawFZ.sort((a, b) => a.min - b.min);
        let mergedFZ = [];
        for (let fz of rawFZ) {
            if (mergedFZ.length === 0 || fz.min > mergedFZ[mergedFZ.length - 1].max) mergedFZ.push({ ...fz });
            else mergedFZ[mergedFZ.length - 1].max = Math.max(mergedFZ[mergedFZ.length - 1].max, fz.max);
        }
        sys.forbiddenZones = mergedFZ;

        // 2b. Forbidden Zone baseline check
        // If the computed baseline orbit falls inside a FZ, move it to the nearest clear boundary
        // and apply a (2D-7)/10 variance directed INTO the available zone.
        if (mergedFZ.length > 0) {
            const inFZ = mergedFZ.find(fz => sys.baselineOrbit >= fz.min && sys.baselineOrbit <= fz.max);
            if (inFZ) {
                tSection('Baseline Orbit FZ Adjustment');
                tResult('Baseline Orbit in FZ', `${sys.baselineOrbit.toFixed(3)} is inside [${inFZ.min.toFixed(2)}, ${inFZ.max.toFixed(2)}]`, 'MgT2E Step 1');
                // Find the nearest clear boundary across all merged FZs
                const distToInner = Math.abs(sys.baselineOrbit - inFZ.min);
                const distToOuter = Math.abs(sys.baselineOrbit - inFZ.max);
                let clearBoundary, direction;
                if (distToInner <= distToOuter) {
                    clearBoundary = inFZ.min;
                    direction = -1; // variance pushes further inward (away from FZ)
                } else {
                    clearBoundary = inFZ.max;
                    direction = 1;  // variance pushes further outward
                }
                const adjRoll = tRoll2D('FZ Baseline Adjustment (2D-7)/10');
                const adjVariance = Math.abs((adjRoll - 7) / 10); // always positive; direction applied below
                sys.baselineOrbit = clearBoundary + (direction * adjVariance);
                tResult('Baseline Orbit Adjusted', sys.baselineOrbit.toFixed(3), `nearest boundary ${clearBoundary.toFixed(3)}, direction ${direction > 0 ? 'outward' : 'inward'}, variance ${adjVariance.toFixed(3)}`);
            }
        }

        // 3. Slot Generation (RAW System Spread - WBH)
        let eRoll = tRoll2D('Empty Orbits (10+)');
        let emptyCount = eRoll <= 9 ? 0 : (eRoll - 9);
        let totalSlotsCount = sys.totalWorlds + emptyCount;

        let slots = [];

        // RAW World Apportionment (WBH Proportional Formula)
        const ADJACENCY = { 'Close': ['Near'], 'Near': ['Close', 'Far'], 'Far': ['Near'] };
        const primaryMAO = primary.mao || 0.01;

        // Phase A: Compute each eligible star's allowable orbit width
        const starAllowable = eligibleStars.map(star => {
            if (star.role === 'Primary') {
                // Primary: [primaryMAO, 20] minus any FZ overlap within that range
                let allowable = 20 - primaryMAO;
                if (mergedFZ) {
                    for (const fz of mergedFZ) {
                        const overlapMin = Math.max(fz.min, primaryMAO);
                        const overlapMax = Math.min(fz.max, 20);
                        if (overlapMax > overlapMin) allowable -= (overlapMax - overlapMin);
                    }
                }
                return Math.max(0, allowable);
            } else {
                // Secondary: orbitId - 3 minus reductions, clipped to max(0, outermost - secMao)
                const adjSeps = ADJACENCY[star.separation] || [];
                const adjStars = sys.stars.filter(s => adjSeps.includes(s.separation));
                let outermost = star.orbitId - 3;
                if (adjStars.length > 0) outermost -= 1;
                if (star.eccentricity > 0.2 || adjStars.some(s => s.eccentricity > 0.2)) outermost -= 1;
                if (star.eccentricity > 0.5) outermost -= 1;
                return Math.max(0, outermost - (star.mao || 0.01));
            }
        });

        // Phase B: +1 if star has > 0 allowable orbits AND no companion
        const starTotals = starAllowable.map((allowable, sIdx) => {
            const actualIdx = sys.stars.indexOf(eligibleStars[sIdx]);
            const hasCompanion = sys.stars.some(s => s.separation === 'Companion' && s.parentStarIdx === actualIdx);
            return allowable + (allowable > 0 && !hasCompanion ? 1 : 0);
        });

        // Phase C: Floor each star's total → Total Star Orbits
        const starTotalOrbits = starTotals.map(t => Math.floor(t));

        // Phase D: Sum → Total System Orbits
        const totalSystemOrbits = starTotalOrbits.reduce((a, b) => a + b, 0);

        eligibleStars.forEach((star, i) => {
            writeLogLine(`  ${star.role || 'Primary'}: Allowable=${starAllowable[i].toFixed(2)}, Total Star Orbits=${starTotalOrbits[i]}`);
        });
        writeLogLine(`  Total System Orbits: ${totalSystemOrbits}`);

        // Phase E: Allocate — ceil(Primary), floor(Intermediates), remainder(Outermost)
        // outermostIdx = last eligible star that has > 0 total orbits
        let starSlotCounts = new Array(eligibleStars.length).fill(0);
        let outermostIdx = 0;
        for (let i = eligibleStars.length - 1; i >= 0; i--) {
            if (starTotalOrbits[i] > 0) { outermostIdx = i; break; }
        }

        if (totalSystemOrbits === 0) {
            starSlotCounts[0] = totalSlotsCount;
            writeLogLine(`  Apportionment: No valid orbital space anywhere — all ${totalSlotsCount} slots assigned to Primary`);
        } else {
            let allocated = 0;
            for (let i = 0; i < eligibleStars.length; i++) {
                if (starTotalOrbits[i] === 0) {
                    starSlotCounts[i] = 0;
                } else if (i === outermostIdx) {
                    starSlotCounts[i] = totalSlotsCount - allocated;
                    allocated += starSlotCounts[i];
                } else if (i === 0) {
                    starSlotCounts[i] = Math.ceil(totalSlotsCount * starTotalOrbits[i] / totalSystemOrbits);
                    allocated += starSlotCounts[i];
                } else {
                    starSlotCounts[i] = Math.floor(totalSlotsCount * starTotalOrbits[i] / totalSystemOrbits);
                    allocated += starSlotCounts[i];
                }
                writeLogLine(`  ${eligibleStars[i].role || 'Primary'}: ${starSlotCounts[i]} slots allocated`);
            }
        }

        // Step 2: Compute System Spread
        const bnForSpread = Math.max(1, baselineNumber);
        let systemSpread = (sys.baselineOrbit - primaryMAO) / bnForSpread;
        if (systemSpread <= 0) systemSpread = 0.1;
        tResult('System Spread', systemSpread.toFixed(4), `(${sys.baselineOrbit.toFixed(2)} - ${primaryMAO.toFixed(2)}) / ${bnForSpread}${baselineNumber < 1 ? ` (BN ${baselineNumber} clamped to 1 for spread)` : ''}`);

        // Step 3: Cap Check — project outermost primary orbit; replace spread with 2D/8 if > Orbit# 20
        const primarySlotCount = starSlotCounts[0];
        const projectedOuter = primaryMAO + systemSpread * primarySlotCount;
        tResult('Projected Outermost Primary Orbit', projectedOuter.toFixed(2), `${primaryMAO.toFixed(2)} + ${systemSpread.toFixed(4)} × ${primarySlotCount} slots`);
        if (projectedOuter > 20) {
            const capRoll = roll2D();
            systemSpread = capRoll / 8;
            writeLogLine(`Max Spread Cap Triggered: 2D6=${capRoll} / 8 = ${systemSpread.toFixed(4)}`);
        }

        // Steps 4 & 5: Per-star spread assignment and slot placement

        for (let sIdx = 0; sIdx < eligibleStars.length; sIdx++) {
            const hostStar = eligibleStars[sIdx];
            const actualStarIdx = sys.stars.indexOf(hostStar);
            const sCount = starSlotCounts[sIdx];
            if (sCount === 0) continue;

            tSection(`Orbital Slots: ${hostStar.role || 'Primary'}`);

            let spread;
            let outermost;

            if (hostStar.role === 'Primary') {
                spread = systemSpread;
                outermost = 20;
                tResult('Spread', spread.toFixed(4), 'System spread (primary)');
            } else {
                // Compute secondary outermost allowable orbit (WBH: OrbitId - 3, then reductions)
                outermost = hostStar.orbitId - 3;
                tResult('Outermost Base (OrbitId - 3)', outermost.toFixed(2));

                const adjSeps = ADJACENCY[hostStar.separation] || [];
                const adjStars = sys.stars.filter(s => adjSeps.includes(s.separation));

                // Reduction 1: flat -1 if any adjacent-zone star exists (applied once)
                if (adjStars.length > 0) {
                    outermost -= 1;
                    tResult('Neighbour Reduction (-1)', outermost.toFixed(2), `Adjacent: ${adjStars.map(s => s.separation).join(', ')}`);
                }

                // Reduction 2: -1 if secondary or any adjacent star has ecc > 0.2
                const hasHighEcc = hostStar.eccentricity > 0.2 || adjStars.some(s => s.eccentricity > 0.2);
                if (hasHighEcc) {
                    outermost -= 1;
                    tResult('High Eccentricity Reduction (-1, ecc > 0.2)', outermost.toFixed(2));
                }

                // Reduction 3: -1 if secondary itself has ecc > 0.5 (stacks)
                if (hostStar.eccentricity > 0.5) {
                    outermost -= 1;
                    tResult('Extreme Eccentricity Reduction (-1, ecc > 0.5)', outermost.toFixed(2));
                }

                const secMao = hostStar.mao || 0.01;

                // Guard: Close stars with small orbitId produce outermost ≤ 0 — no centred orbits possible
                if (outermost <= secMao) {
                    tResult(`${hostStar.role} Orbital Space`, `None — outermost (${outermost.toFixed(2)}) ≤ MAO (${secMao.toFixed(2)}). Secondary too close to primary for centred orbits.`, 'WBH: Centred Orbits');
                    continue;
                }

                const secSpread = (outermost - secMao) / (sCount + 1);
                tResult('Secondary Spread Formula', secSpread.toFixed(4), `(${outermost.toFixed(2)} - ${secMao.toFixed(2)}) / (${sCount} + 1)`);

                if (secSpread > systemSpread) {
                    spread = secSpread;
                    tResult('Spread', spread.toFixed(4), 'Secondary override (> system spread)');
                } else {
                    spread = systemSpread;
                    tResult('Spread', spread.toFixed(4), 'System spread used');
                }
            }

            // WBH Rule #11: ecc > 0.5 on secondary shifts inner boundary out by 1.0 Orbit#
            let currentPos = hostStar.mao || 0.01;
            if (hostStar.role !== 'Primary' && hostStar.eccentricity > 0.5) {
                currentPos += 1.0;
                tResult('Rule #11 Inner Boundary Shift', currentPos.toFixed(2), 'Ecc > 0.5 on secondary');
            }

            for (let i = 0; i < sCount; i++) {
                const varRoll = roll2D();
                const variance = (varRoll - 7) * spread / 10;
                let nextOrbit = currentPos + spread + variance;
                writeLogLine(`  Slot ${i + 1}: ${currentPos.toFixed(3)} + ${spread.toFixed(4)} (spread) + (${varRoll}-7)×${spread.toFixed(4)}/10 (variance) = ${nextOrbit.toFixed(3)}`);

                // Forbidden zone: one-time zone-width offset per zone hit
                if (mergedFZ && mergedFZ.length > 0) {
                    for (const fz of mergedFZ) {
                        if (nextOrbit >= fz.min && nextOrbit <= fz.max) {
                            const zoneWidth = fz.max - fz.min;
                            nextOrbit += zoneWidth;
                            writeLogLine(`    FZ Jump (+${zoneWidth.toFixed(2)}): zone ${fz.min.toFixed(2)}–${fz.max.toFixed(2)} → ${nextOrbit.toFixed(3)}`);
                        }
                    }
                }

                // Clamp to boundary
                if (nextOrbit > outermost) {
                    writeLogLine(`    Clamped to boundary: ${nextOrbit.toFixed(3)} → ${outermost.toFixed(2)}`);
                    nextOrbit = outermost;
                }

                const sEcc = determinePlanetEccentricity(nextOrbit, sys.age, 'S-Type');

                slots.push({
                    orbitId: nextOrbit,
                    occupant: null,
                    eccentricity: sEcc,
                    type: 'S-Type',
                    parentStarIdx: actualStarIdx
                });
                currentPos = nextOrbit;
            }
        }

        // Sort all slots globally by orbitId to maintain sequence for the World Queue
        slots.sort((a, b) => a.orbitId - b.orbitId);
        
        // Re-establish targetIdx to point to the Primary's closest slot to the baseline orbit
        let targetIdx = 0;
        let bestDist = Infinity;
        for(let i = 0; i < slots.length; i++) {
            if (slots[i].parentStarIdx === 0) {
                let dist = Math.abs(slots[i].orbitId - baselineOrbit);
                if (dist < bestDist) {
                    bestDist = dist;
                    targetIdx = i;
                }
            }
        }

        // Override targetIdx for out-of-HZ top-down mainworlds: anchor the mainworld at its
        // temperature-appropriate orbit rather than the baseline orbit used for system spread.
        if (mainworldTargetOrbit !== null && slots.length > 0) {
            let mwBestDist = Infinity;
            for (let i = 0; i < slots.length; i++) {
                if (slots[i].parentStarIdx === 0) {
                    const dist = Math.abs(slots[i].orbitId - mainworldTargetOrbit);
                    if (dist < mwBestDist) { mwBestDist = dist; targetIdx = i; }
                }
            }
            tResult('targetIdx Override', `Slot ${targetIdx} at Orbit ${slots[targetIdx]?.orbitId.toFixed(3)}`, `mainworld anchored at temperature orbit ${mainworldTargetOrbit.toFixed(3)}, not baseline ${baselineOrbit.toFixed(3)}`);
        }

        // 7. Anomalous Worlds (MgT2E Step 7 — after slot allocation, before world placement)
        tSection('Step 7: Anomalous Worlds');
        const anomalousPending = [];
        {
            const anomQtyTable = MgT2EData.systemInventory.anomalousOrbitQuantity;
            const anomTypeTable = MgT2EData.systemInventory.anomalousOrbitType;
            const anomRoll = tRoll2D('Anomalous Quantity Roll');
            const anomEntry = anomQtyTable.find(e => anomRoll <= e.maxRoll);
            const anomCount = anomEntry ? anomEntry.count : 0;
            tResult('Anomalous Worlds', anomCount, 'MgT2E Step 7');

            for (let ai = 0; ai < anomCount; ai++) {
                tSection(`Anomalous World ${ai + 1}`);

                // Roll type
                const typeRoll = tRoll2D(`Anomalous Type Roll (world ${ai + 1})`);
                const typeEntry = anomTypeTable.find(e => typeRoll <= e.maxRoll);
                const anomType = typeEntry ? typeEntry.type : 'Random';
                const eccentricityDM = typeEntry ? typeEntry.eccentricityDM : 2;
                tResult('Anomalous Type', anomType, 'MgT2E Step 7 Type Table');
                tResult('Eccentricity DM', eccentricityDM != null ? eccentricityDM : 'N/A', 'MgT2E Step 7');

                if (anomType === 'Trojan') {
                    // Trojan: reserves a primary orbit slot to share with whatever world WBH places there.
                    // At Step 7, no worlds are placed yet — pick from all primary slots.
                    const primarySlotsForTrojan = slots.filter(s => s.parentStarIdx === 0);
                    if (primarySlotsForTrojan.length === 0) {
                        tResult('Trojan Placement', 'SKIPPED — no primary slots available', 'MgT2E Step 7');
                    } else {
                        const pickedIdx = Math.floor(rng() * primarySlotsForTrojan.length);
                        const trojanOrbit = primarySlotsForTrojan[pickedIdx].orbitId;
                        primarySlotsForTrojan[pickedIdx].hasTrojan = true;
                        tResult('Trojan Orbit', trojanOrbit, 'MgT2E Step 7 — shares orbit with existing world');
                        anomalousPending.push({
                            type: anomType,
                            orbitId: trojanOrbit,
                            eccentricityDM: null,
                            inclination: null,
                            retrograde: false,
                            isTrojan: true,
                            trojanPartnerOrbit: trojanOrbit
                        });
                    }
                } else {
                    // Random orbit procedure: pick a random orbit from the primary's slots
                    const primarySlots = slots.filter(s => s.parentStarIdx === 0);
                    let anomOrbit;
                    if (primarySlots.length === 0) {
                        // Fallback: place at MAO if no primary slots
                        anomOrbit = primaryMAO;
                        tResult('Anomalous Orbit', anomOrbit, 'MgT2E Step 7 — fallback to MAO (no primary slots)');
                    } else {
                        const pickedSlot = primarySlots[Math.floor(rng() * primarySlots.length)];
                        anomOrbit = pickedSlot.orbitId;
                        tResult('Anomalous Orbit', anomOrbit, 'MgT2E Step 7 — randomly selected primary slot');
                    }

                    // Inclination (only for Inclined type)
                    let inclination = null;
                    if (anomType === 'Inclined') {
                        const inclineDie = Math.floor(rng() * 6) + 1;
                        inclination = (inclineDie + 2) * 10;
                        tResult('Inclination', inclination + '°', 'MgT2E Step 7 — (1D+2)x10');
                    }

                    // Retrograde flag
                    const retrograde = (anomType === 'Retrograde');
                    tResult('Retrograde', retrograde, 'MgT2E Step 7');

                    anomalousPending.push({
                        type: anomType,
                        orbitId: anomOrbit,
                        eccentricityDM: eccentricityDM,
                        inclination: inclination,
                        retrograde: retrograde,
                        isTrojan: false,
                        trojanPartnerOrbit: null
                    });
                }
            }
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
                    tResult('WBH Consistency', 'Forced Gas Giant presence for pre-existing Mainworld moon', 'MgT2E 1.3: Top-Down Lunar Rule');
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

        // ─── MgT2E 1.3: PRE-ALLOCATION INTERCEPT ─────────────────────────────
        // For pre-defined lunar mainworlds (isPreMoon flag or 'Sa' trade code),
        // guarantee the parent body occupies the baseline orbit BEFORE random
        // placement begins. This removes reliance on probabilistic GG collision.
        const interceptNeeded = mainworldBase && (
            mainworldBase.isPreMoon === true ||
            (mainworldBase.tradeCodes && mainworldBase.tradeCodes.includes('Sa'))
        );

        if (interceptNeeded && slots.length > 0) {
            // Locate a parent first — only dequeue the Mainworld if a valid parent exists
            let parentQueueIdx = queue.findIndex(w => w.type === 'Gas Giant');
            if (parentQueueIdx === -1) {
                parentQueueIdx = queue.findIndex(w => w.type === 'Terrestrial Planet' && (w.size || 0) >= 6);
            }

            if (parentQueueIdx !== -1) {
                // Remove the Mainworld entry from the queue — placed as a moon below.
                // Adjust parentQueueIdx if the Mainworld sits ahead of the parent in the queue.
                let mwQueueIdx = queue.findIndex(w => w.type === 'Mainworld');
                if (mwQueueIdx !== -1) {
                    queue.splice(mwQueueIdx, 1);
                    if (mwQueueIdx < parentQueueIdx) parentQueueIdx--;
                }
                let parentInfo = queue.splice(parentQueueIdx, 1)[0];
                let targetSlot = slots[targetIdx];

                // Build the demoted Mainworld object from mainworldBase
                let interceptMW = {
                    type: 'Mainworld',
                    isAnchor: true,
                    isMoon: true,
                    isSatellite: true,
                    isLunarMainworld: true,
                    name: mainworldBase.name,
                    uwp: mainworldBase.uwp,
                    uwpSecondary: mainworldBase.uwpSecondary,
                    starport: mainworldBase.starport,
                    travelZone: mainworldBase.travelZone,
                    tradeCodes: mainworldBase.tradeCodes ? [...mainworldBase.tradeCodes] : ['Sa'],
                    size: mainworldBase.size !== undefined ? mainworldBase.size : 7,
                    atm: mainworldBase.atm,
                    hydro: mainworldBase.hydro,
                    pop: mainworldBase.pop,
                    gov: mainworldBase.gov,
                    law: mainworldBase.law,
                    tl: mainworldBase.tl,
                    hexId: mainworldBase.hexId || sys.hexId,
                    orbitId: targetSlot.orbitId,
                    pd: 10.0 + (rng() * 5.0),
                    pos: 'Middle',
                    retrograde: false
                };

                // Ensure 'Sa' is present in trade codes
                if (!interceptMW.tradeCodes.includes('Sa')) interceptMW.tradeCodes.push('Sa');

                // Parent linkage
                if (parentInfo.type === 'Gas Giant') {
                    interceptMW.parentType = 'Gas Giant';
                    interceptMW.parentId = (sys.hexId || 'System') + '-GG-pre';
                } else {
                    interceptMW.parentType = 'Terrestrial';
                    interceptMW.parentId = (sys.hexId || 'System') + '-PLANET-pre';
                }

                // AU computation for the target slot (mirrors standard occupancy logic)
                let _auInt   = Math.floor(targetSlot.orbitId);
                let _auFrac  = targetSlot.orbitId - _auInt;
                let _auTable = MgT2EData.stellar.orbitAu;
                let _maxIdx  = _auTable.length - 1;
                let _limIdx  = Math.min(_auInt, _maxIdx);
                let _auBase  = _auTable[_limIdx];
                let _auDiff  = _limIdx < _maxIdx ? (_auTable[_limIdx + 1] - _auTable[_limIdx]) : _auBase;
                let _computedAU = _auBase + (_auFrac * _auDiff);

                let interceptParent = {
                    ...parentInfo,
                    orbitId: targetSlot.orbitId,
                    au: _computedAU,
                    parentStarIdx: targetSlot.parentStarIdx,
                    orbitType: targetSlot.type,
                    eccentricity: targetSlot.eccentricity,
                    worldHzco: computeWorldHzco(targetSlot.orbitId, targetSlot.parentStarIdx, sys),
                    moons: [interceptMW]
                };

                targetSlot.occupant = interceptParent;
                sys.worlds.push(interceptParent);
                sys.mainworld = interceptMW;
                mainworldDone = true;
                mainworldDemoted = true;

                tResult('Pre-Allocation Intercept', 'Mainworld anchored to parent at Baseline Orbit', 'MgT2E 1.3: Top-Down Lunar Rule');
                // Replacement rule — keep total world count consistent
                queue.push({ type: 'Terrestrial Planet' });
                tResult('Replacement Rule', 'Added Terrestrial Planet to queue', 'MgT2E 1.3: Orbital Allocation');
            }
        }
        // ─────────────────────────────────────────────────────────────────────

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
                        tResult('WBH Overlap Exception', `${wInfo.type} collided with Mainworld Anchor at Slot ${currentIdx}`, 'MgT2E 1.3: Orbital Allocation');
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
                            oldMW.parentId = (sys.hexId || 'System') + "-GG-" + s.orbitId;
                        } else if (wInfo.type === 'Planetoid Belt') {
                            oldMW.parentType = 'Planetoid Belt';
                            oldMW.parentId = (sys.hexId || 'System') + "-BELT-" + s.orbitId;
                        } else {
                            oldMW.parentType = 'Terrestrial';
                            oldMW.parentId = (sys.hexId || 'System') + "-PLANET-" + s.orbitId;
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
                            worldHzco: computeWorldHzco(s.orbitId, s.parentStarIdx, sys),
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
                        sys.mainworld = oldMW;
                        mainworldDone = true;
                        mainworldDemoted = true;

                        // WBH Item 4: Add replacement Terrestrial to fill the gap (Sequential Expansion)
                        queue.push({ type: 'Terrestrial Planet' });
                        tResult('Replacement Rule', 'Added Terrestrial Planet to queue', 'MgT2E 1.3: Orbital Allocation');

                        landed = true;
                        break;
                    }
                }

                // 2. STANDARD OCCUPANCY CHECK (Empty Slot)
                if (!s.occupant) {
                    // Trojan guard: don't fill trojan-reserved slots with Empty orbit markers —
                    // the slot must be claimed by a real world so the trojan has a companion.
                    if (wInfo.type === 'Empty' && s.hasTrojan) {
                        if (window.isLoggingEnabled) writeLogLine(`[WBH TROJAN GUARD] Skipping Empty at Orbit ${s.orbitId.toFixed(2)} — reserved for Trojan companion.`);
                        currentIdx = (currentIdx + 1) % slots.length;
                        attempts++;
                        continue;
                    }
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
                        eccentricity: s.eccentricity,
                        worldHzco: computeWorldHzco(s.orbitId, s.parentStarIdx, sys)
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
                        sys.mainworld = world;
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
        // 7b. Anomalous World Finalisation — build world objects from anomalousPending
        if (anomalousPending.length > 0) {
            tSection('Step 7b: Anomalous World Finalisation');
            const orbitAuTable = MgT2EData.stellar.orbitAu;

            function computeAnomalousAu(orbitId) {
                const auInt = Math.floor(orbitId);
                const auFrac = orbitId - auInt;
                const maxIdx = orbitAuTable.length - 1;
                const limitIdx = Math.min(auInt, maxIdx);
                const auTarget = orbitAuTable[limitIdx];
                const auDiff = limitIdx < maxIdx ? (orbitAuTable[limitIdx + 1] - orbitAuTable[limitIdx]) : auTarget;
                return auTarget + (auFrac * auDiff);
            }

            for (const ap of anomalousPending) {
                tSection(`Finalise Anomalous: ${ap.type} at Orbit ${ap.orbitId}`);

                let eccentricity = 0;
                if (ap.eccentricityDM != null) {
                    eccentricity = determinePlanetEccentricity(ap.orbitId, sys.age, 'P-Type', ap.eccentricityDM);
                } else {
                    tResult('Eccentricity', 'N/A (Trojan)', 'MgT2E Step 7');
                }

                // For Trojan: find the companion world already placed at the shared orbit
                let trojanPartner = null;
                if (ap.isTrojan) {
                    trojanPartner = sys.worlds.find(w => Math.abs(w.orbitId - ap.trojanPartnerOrbit) < 0.01) || null;
                    tResult('Trojan Partner', trojanPartner ? (trojanPartner.type + ' at ' + ap.trojanPartnerOrbit) : 'NOT FOUND — no world placed at reserved orbit', 'MgT2E Step 7');
                    if (!trojanPartner) {
                        tResult('Trojan Skipped', 'Cannot finalise trojan with no companion', 'MgT2E Step 7');
                        continue;
                    }
                }

                const anomWorld = {
                    type: 'Terrestrial Planet',
                    anomalousType: ap.type,
                    orbitId: ap.orbitId,
                    au: computeAnomalousAu(ap.orbitId),
                    parentStarIdx: 0,
                    orbitType: 'P-Type',
                    eccentricity: eccentricity,
                    inclination: ap.inclination,
                    retrograde: ap.retrograde,
                    isTrojan: ap.isTrojan,
                    trojanPartner: trojanPartner ? trojanPartner.type : null,
                    worldHzco: computeWorldHzco(ap.orbitId, 0, sys)
                };

                sys.worlds.push(anomWorld);
                tResult('Anomalous World Added', `${ap.type} at Orbit ${ap.orbitId.toFixed(2)}, AU ${anomWorld.au.toFixed(3)}, Ecc ${eccentricity.toFixed(3)}`, 'MgT2E Step 7');
            }
        }

        sys.worlds.sort((a, b) => a.orbitId - b.orbitId);

        if (window.isLoggingEnabled) endTrace();
        return sys;
    }

    /**
     * UTILITY: MgT2E SYSTEM WALKER (Helper for sweeping all bodies)
     * Following the "Sean Protocol": Recursive state discovery.
     */
    function walkMgT2ESystem(sys, callback) {
        if (!sys) return;
        
        const processBody = (body) => {
            if (!body) return;
            callback(body);
            if (body.moons && body.moons.length > 0) {
                body.moons.forEach(moon => processBody(moon));
            }
        };

        // 1. Process Stars (Physical Bodies)
        if (sys.stars) {
            sys.stars.forEach(star => callback(star));
        }

        // 2. Process Worlds & Nested Moons
        if (sys.worlds) {
            sys.worlds.forEach(world => processBody(world));
        }
    }

    /**
     * ACTION 6.4: Log a single MgT2E body's complete physical + social biography
     * in one contiguous trace block.
     *
     * @param {Object} body - Any system body (star, planet, moon, etc.)
     */
    function logMgT2EBodyBiography(body) {
        if (!body || body.type === 'Empty' || body.role === 'Empty') return;
        if (typeof tSection === 'undefined' || typeof tResult === 'undefined') return;

        const name = body.name || body.role || 'Unnamed Body';
        const typeStr = body.sClass ? "Stellar Orbit" : (body.type || 'World');
        
        tSection(`Biography: ${name} [${typeStr}]`);

        // --- PHYSICAL PROFILE ---
        if (body.sClass) {
            // Star Results
            tResult('Star Classification', body.name || 'Unknown', 'MgT2E 1.1: Stellar Generation');
            if (body.mass != null) tResult('Mass (Sol)', body.mass.toFixed(3), 'MgT2E 1.1: Stellar Generation');
            if (body.lum  != null) tResult('Luminosity (Sol)', body.lum.toFixed(4), 'MgT2E 1.1: Stellar Generation');
            if (body.temp != null) tResult('Temperature (K)', body.temp.toFixed(0), 'MgT2E 1.1: Stellar Generation');
            if (body.orbitId !== null && body.orbitId !== undefined) {
                tResult('Stellar Orbit', body.orbitId.toFixed(2), 'MgT2E 1.2: Binary/Multiple Stars');
            }
        } else {
            // World Results
            if (body.orbitId != null) tResult('Orbit', body.orbitId.toFixed(2), 'MgT2E 1.3: Orbital Allocation');
            if (body.au != null) tResult('Distance (AU)', body.au.toFixed(3), 'MgT2E 2.1: Physical Foundations');

            tResult('Physical Class', body.type, 'MgT2E 2.1: Physical Foundations');
            if (body.size !== undefined) tResult('Size', body.size, 'MgT2E 2.1: Physical Foundations');
            if (body.gravity != null) tResult('Gravity', body.gravity.toFixed(2) + "g", 'MgT2E 2.1: Physical Foundations');
            if (body.atm !== undefined) tResult('Atmosphere', body.atm, 'MgT2E 2.2: Atmospherics');
            if (body.hydro !== undefined) tResult('Hydrographics', body.hydro, 'MgT2E 2.3: Hydrographics');

            if (body.tempK != null) tResult('Surface Temp (K)', body.tempK.toFixed(0), 'MgT2E 3.2: Tech Level & Environment');
            if (body.siderealHours != null) tResult('Rotation (Hours)', body.siderealHours.toFixed(1), 'MgT2E 2.4: Rotational Dynamics');
        }

        // --- SOCIAL PROFILE ---
        if (body.uwp) {
            tResult('UWP String', body.uwp, 'MgT2E 3.1: Social Finalization');
        }
        if (body.starport) tResult('Starport', body.starport, 'MgT2E 4.1: Starports & Bases');
        if (body.pop !== undefined) tResult('Population', body.pop, 'MgT2E 3.1: Core Social');
        if (body.gov !== undefined) tResult('Government', body.gov, 'MgT2E 3.1: Core Social');
        if (body.law !== undefined) tResult('Law Level', body.law, 'MgT2E 3.1: Core Social');
        if (body.tl !== undefined) tResult('Tech Level', body.tl, 'MgT2E 3.2: Tech Level & Environment');
        
        if (body.tradeCodes && body.tradeCodes.length > 0) {
            tResult('Trade Codes', body.tradeCodes.join(' '), 'MgT2E 4.1: Starports & Bases');
        }

        // --- STATUS FLAGS ---
        if (body.isLunarMainworld) tResult('Status', 'LUNAR MAINWORLD', 'MgT2E 6.4: Planet-Centric Biographies');
        if (body.isMoon) tResult('Parentage', `${body.parentType || 'World'} Moon`, 'MgT2E 6.4: Planet-Centric Biographies');
    }

    return {
        generateStellarSystem,
        generateSystemInventory,
        allocateOrbits,
        walkMgT2ESystem,
        logMgT2EBodyBiography
    };
}));
