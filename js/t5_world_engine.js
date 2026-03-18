/**
 * js/t5_world_engine.js
 * 
 * T5 WORLD ENGINE (v2.0 Modular Architecture)
 * Contains functional logic for generating specific T5 UWP characteristics.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math', '../rules/t5_data'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'), require('../rules/t5_data'));
    } else {
        root.T5_World_Engine = factory(root.UniversalMath, root.T5_Data);
    }
}(this, function (UniversalMath, T5_Data) {
    const { toUWPChar, fromUWPChar, clampUWP, rollFlux } = UniversalMath;

    // Safe Fallback Utilities
    const _rng = (typeof rng === 'function') ? rng : Math.random;
    const _roll1D = (typeof tRoll1D === 'function') ? tRoll1D : (label) => Math.floor(_rng() * 6) + 1;
    const _roll2D = (typeof tRoll2D === 'function') ? tRoll2D : (label) => Math.floor(_rng() * 6) + 1 + Math.floor(_rng() * 6) + 1;
    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;
    const _reseedForHex = (typeof reseedForHex === 'function') ? reseedForHex : (id) => { _log(`Warning: reseedForHex not found. Generation for ${id} may not be deterministic.`); };

    /**
     * T5 SIZE BY WORLD TYPE
     */
    function generateT5SizeByWorldType(worldType) {
        if (worldType === 'Belt') {
            _log(`Size Formula (Belt): Always 0.`);
            return 0;
        }

        let size, roll, formula;

        if (worldType === 'Inferno') {
            formula = "1D + 6";
            roll = _roll1D('Inferno Size Roll');
            size = roll + 6;
        } else if (worldType === 'BigWorld') {
            formula = "2D + 7";
            roll = _roll2D('BigWorld Size Roll');
            size = roll + 7;
        } else if (worldType === 'Worldlet') {
            formula = "1D - 3";
            roll = _roll1D('Worldlet Size Roll');
            size = roll - 3;
            let final = Math.max(0, size);
            let logMsg = `Size Formula (Worldlet): 1D - 3. Rolled ${roll}. Final Size: ${final}`;
            if (size < 0) logMsg += " Clamped to minimum 0.";
            _log(logMsg);
            return final;
        } else if (['RadWorld', 'StormWorld'].includes(worldType)) {
            formula = "2D";
            roll = _roll2D(worldType + ' Size Roll');
            size = roll;
        } else {
            formula = "2D - 2";
            roll = _roll2D(worldType + ' Size Roll');
            let tempSize = roll - 2;
            if (tempSize === 10) {
                let variantRoll = _roll1D('Size Roll (10 variant)');
                let final = 9 + variantRoll;
                _log(`Size Formula (${worldType}): 2D - 2. Rolled 12 (Result 10). Applying 10 variant (9 + 1D). Rolled ${variantRoll}. Final Size: ${final}.`);
                return Math.max(1, final);
            }
            size = Math.max(1, tempSize);
            let logMsg = `Size Formula (${worldType}): 2D - 2. Rolled ${roll}. Final Size: ${size}`;
            if (tempSize < 1) logMsg += " Clamped to minimum 1.";
            _log(logMsg);
            return size;
        }

        _log(`Size Formula (${worldType}): ${formula}. Rolled ${roll}. Final Size: ${size}.`);
        return size;
    }

    /**
     * T5 ATMOSPHERE BY WORLD TYPE
     */
    function generateT5AtmosphereByWorldType(world, worldType) {
        const sizeVal = (typeof world.size === 'string' ? fromUWPChar(world.size) : (world.size || 0));
        
        if (worldType === 'Inferno') {
            world.atm = fromUWPChar('B'); // 11
            _log(`Atmosphere Calc (Inferno): Fixed to B.`);
            return;
        }
        if (worldType === 'Belt' || worldType === 'Planetoid Belt') {
            world.atm = 0;
            _log(`Atmosphere Calc (Belt): Automatically 0.`);
            return;
        }

        let flux = rollFlux();
        let dm = (worldType === 'StormWorld') ? 4 : 0;

        let rawAtm = sizeVal + flux + dm;
        let minAtm = (worldType === 'StormWorld') ? 4 : 0;
        world.atm = Math.min(15, Math.max(minAtm, rawAtm));

        let logMsg = `Atmosphere Calc (${worldType}): Size ${world.size} + Flux (${flux >= 0 ? '+' : ''}${flux})`;
        if (dm !== 0) logMsg += ` + DM ${dm}`;
        logMsg += ` = ${rawAtm} -> Final: ${toUWPChar(world.atm)}.`;
        _log(logMsg);
    }

    /**
     * T5 HYDROGRAPHICS BY WORLD TYPE
     */
    function generateT5HydrographicsByWorldType(world, worldType) {
        if (worldType === 'Inferno' || worldType === 'Belt' || worldType === 'Planetoid Belt') {
            world.hydro = 0;
            _log(`Hydro Calc (${worldType}): Fixed to 0.`);
            return;
        }

        const sizeVal = (typeof world.size === 'string' ? fromUWPChar(world.size) : (world.size || 0));
        if (sizeVal < 2) {
            world.hydro = 0;
            _log(`Hydro Calc (${worldType}): Size < 2. Fixed to 0.`);
            return;
        }

        let flux = rollFlux();
        let base = flux + (world.atm || 0);
        let atmDM = (world.atm < 2 || world.atm > 9) ? -4 : 0;
        let typeDM = (['InnerWorld', 'StormWorld'].includes(worldType)) ? -4 : 0;

        let rawHydro = base + atmDM + typeDM;
        world.hydro = Math.min(10, Math.max(0, rawHydro));

        let logMsg = `Hydro Calc (${worldType}): Base (Flux+Atm) ${base}`;
        if (atmDM !== 0) logMsg += ` - DM 4 (Atm)`;
        if (typeDM !== 0) logMsg += ` - DM 4 (${worldType})`;
        logMsg += ` = ${rawHydro}. Clamped to ${toUWPChar(world.hydro)}.`;
        _log(logMsg);
    }

    /**
     * T5 POPULATION BY WORLD TYPE
     */
    function generateT5PopulationByWorldType(world, worldType, maxSubordinatePop) {
        if (['RadWorld', 'Inferno'].includes(worldType)) {
            world.pop = 0;
            _log(`Pop Calc (${worldType}): Hardcoded to 0.`);
            if (typeof world.popDigit !== 'undefined') world.popDigit = 0;
            return;
        }

        let dm = 0;
        if (worldType === 'InnerWorld') dm = -4;
        else if (['IceWorld', 'StormWorld'].includes(worldType)) dm = -6;

        let rollValue = _roll2D('Pop Roll') - 2;
        let rawPop = rollValue + dm;
        let generatedPop = Math.max(0, rawPop);
        let finalPop = Math.min(generatedPop, maxSubordinatePop);

        _log(`Pop Calc (${worldType}): Roll (${rollValue + 2}) - 2 DM ${dm} = ${rawPop}. Cap ${maxSubordinatePop}. Final ${finalPop}`);

        world.pop = finalPop;
        if (typeof world.popDigit !== 'undefined') {
            world.popDigit = world.pop > 0 ? Math.floor(_rng() * 10) : 0;
        }
    }

    /**
     * T5 SPACEPORT BY WORLD TYPE
     */
    function generateT5SpaceportByWorldType(world, worldType) {
        if (['RadWorld', 'Inferno'].includes(worldType)) {
            world.starport = 'Y';
            _log(`Spaceport Calc (${worldType}): Hardcoded to Type Y.`);
            return;
        }

        const roll = _roll1D('Spaceport Roll');
        if (typeof world.spRollValue !== 'undefined') world.spRollValue = roll;
        const score = (world.pop || 0) - roll;

        let type = 'Y';
        if (score >= 4) type = 'F';
        else if (score === 3) type = 'G';
        else if (score === 2) type = 'H';
        else type = 'Y';

        world.starport = type;
        _log(`Spaceport Calc (${worldType}): Pop (${world.pop || 0}) - 1D (${roll}) = ${score} -> Type ${type}.`);
    }

    /**
     * T5 GOVERNMENT BY WORLD TYPE
     */
    function generateT5GovernmentByWorldType(world, worldType) {
        if (['RadWorld', 'Inferno'].includes(worldType)) {
            world.gov = 0;
            if (typeof world.govFlux !== 'undefined') world.govFlux = 0;
            _log(`Gov Calc (${worldType}): Fixed to 0 per profile rules.`);
            return;
        }

        let flux = rollFlux();
        if (typeof world.govFlux !== 'undefined') world.govFlux = flux;
        let rawGov = flux + (world.pop || 0);
        world.gov = Math.max(0, Math.min(15, rawGov));

        _log(`Gov Calc (${worldType}): Flux (${flux >= 0 ? '+' : ''}${flux}) + Pop (${world.pop || 0}) = ${rawGov} -> Final: ${toUWPChar(world.gov)}`);
    }

    /**
     * T5 LAW LEVEL BY WORLD TYPE
     */
    function generateT5LawLevelByWorldType(world, worldType) {
        if (['RadWorld', 'Inferno'].includes(worldType)) {
            world.law = 0;
            _log(`Law Level Calc (${worldType}): Fixed to 0 per profile rules.`);
            return;
        }

        let flux = rollFlux();
        let rawLaw = flux + (world.gov || 0);
        world.law = Math.max(0, Math.min(18, rawLaw));

        _log(`Law Level Calc (${worldType}): Flux (${flux >= 0 ? '+' : ''}${flux}) + Gov (${world.gov || 0}) = ${rawLaw} -> Final: ${toUWPChar(world.law)}`);
    }

    /**
     * T5 TECH LEVEL BY WORLD TYPE
     */
    function generateT5TechLevelByWorldType(world, worldType) {
        if (['RadWorld', 'Inferno'].includes(worldType)) {
            world.tl = 0;
            _log(`TL Calc (${worldType}): Fixed to 0 per profile rules.`);
            return;
        }

        let roll = _roll1D('TL Roll');
        let mods = [];
        let tlDM = 0;

        if (world.starport === 'F') { tlDM += 1; mods.push("Port F (+1)"); }

        const size = typeof world.size === 'number' ? world.size : fromUWPChar(world.size);
        if (size <= 1) { tlDM += 2; mods.push("Size 0-1 (+2)"); }
        else if (size <= 4) { tlDM += 1; mods.push("Size 2-4 (+1)"); }

        const atm = world.atm || 0;
        if (atm <= 3) { tlDM += 1; mods.push("Atm 0-3 (+1)"); }
        else if (atm >= 10 && atm <= 15) { tlDM += 1; mods.push("Atm A-F (+1)"); }

        const hydro = world.hydro || 0;
        if (hydro === 9) { tlDM += 1; mods.push("Hydro 9 (+1)"); }
        else if (hydro === 10) { tlDM += 2; mods.push("Hydro A (+2)"); }

        const pop = world.pop || 0;
        if (pop >= 1 && pop <= 5) { tlDM += 1; mods.push("Pop 1-5 (+1)"); }
        else if (pop === 9) { tlDM += 2; mods.push("Pop 9 (+2)"); }
        else if (pop >= 10) { tlDM += 4; mods.push("Pop A+ (+4)"); }

        const gov = world.gov || 0;
        if (gov === 0 || gov === 5) { tlDM += 1; mods.push("Gov 0/5 (+1)"); }
        else if (gov === 13) { tlDM -= 2; mods.push("Gov D (-2)"); }

        let finalTL = Math.max(0, roll + tlDM);
        world.tl = finalTL;

        let logMsg = `TL Calc (${worldType}): Roll (${roll})`;
        if (mods.length > 0) logMsg += " + " + mods.join(" + ");
        logMsg += ` = ${finalTL}.`;
        _log(logMsg);
    }

    /**
      * T5 TRADE CODES (Data-Driven)
      */
    function calculateT5TradeCodes(world) {
        let codes = [];
        const tcData = T5_Data.TRADE_CODES;

        // Normalize values for comparison
        const wSize = typeof world.size === 'number' ? world.size : fromUWPChar(world.size);
        const wAtm = world.atm || 0;
        const wHydro = world.hydro || 0;
        const wPop = world.pop || 0;
        const wGov = world.gov || 0;
        const wLaw = world.law || 0;
        const wTl = world.tl || 0;

        // 1. Standard Trade Codes from Data Shield
        tcData.forEach(tc => {
            let match = true;
            if (tc.reqs.size && !tc.reqs.size.includes(wSize)) match = false;
            if (tc.reqs.atm && !tc.reqs.atm.includes(wAtm)) match = false;
            if (tc.reqs.hydro && !tc.reqs.hydro.includes(wHydro)) match = false;
            if (tc.reqs.pop && !tc.reqs.pop.includes(wPop)) match = false;
            if (tc.reqs.gov && !tc.reqs.gov.includes(wGov)) match = false;
            if (tc.reqs.law && !tc.reqs.law.includes(wLaw)) match = false;
            if (tc.reqs.tl && !tc.reqs.tl.includes(wTl)) match = false;

            if (match) codes.push(tc.code);
        });

        // 2. Situational / Relative Codes 
        // (These remain hardcoded as they depend on the world's physical relationship to the system)
        if (world.worldType === 'Far Satellite') codes.push("Sa");
        if (world.worldType === 'Close Satellite' || world.isTidallyLocked) codes.push("Lk");

        // Travel Zone Specials
        if (world.travelZone === 'Red' && !codes.includes("Fo")) codes.push("Fo");
        if (world.travelZone === 'Amber') {
            if (wPop <= 6 && !codes.includes("Da")) codes.push("Da");
            else if (wPop > 6 && !codes.includes("Pz")) codes.push("Pz");
        }

        return codes;
    }


    /**
     * T5 MAINWORLD GENERATION (UI Entry Point)
     * Generates a basic UWP for a mainworld in a hex.
     * Includes Stellar Situation, Starport, and all UWP stats.
     */
    function generateT5Mainworld(hexId) {
        if (hexId) {
            _reseedForHex(hexId);
            _log(`T5 Mainworld Generation: Hex ${hexId}`);
        }

        // --- 0. Stellar Situation ---
        // Note: In UI context, we often roll fresh unless imported.
        // We'll use a simplified version that integrates with the existing Stellar Engine.
        const stars = [];
        const stellarEngine = (typeof T5_Stellar_Engine !== 'undefined') ? T5_Stellar_Engine : (typeof window !== 'undefined' ? window.T5_Stellar_Engine : null);

        if (stellarEngine) {
            const constellation = stellarEngine.determineStellarConstellation();
            stars.push(...constellation.stars);
        } else {
            stars.push({ type: 'G', size: 'V', name: 'Primary', decimal: 2 });
        }

        const primary = stars[0];
        _log(`System Constellation: [${stars.map(s => s.name).join(' ')}]`);

        // --- 1. Basic Stats ---
        const starport = ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'E', 'X'][_roll2D('Starport Roll') - 2] || 'X';

        const world = {
            hexId,
            stars,
            starport,
            worldType: 'Mainworld' // Default for this entry point
        };

        // --- 2. UWP Parameters ---
        // Size: 2D-2 (with 10 variant)
        world.size = generateT5SizeByWorldType('Mainworld');

        // Atmosphere: Size + Flux
        generateT5AtmosphereByWorldType(world, 'Mainworld');

        // Hydrographics: Atm + Flux
        generateT5HydrographicsByWorldType(world, 'Mainworld');

        // Population: 2D-2
        generateT5PopulationByWorldType(world, 'Mainworld', 12); // Mainworlds usually not capped below 12

        // Government: Pop + Flux
        generateT5GovernmentByWorldType(world, 'Mainworld');

        // Law: Gov + Flux
        generateT5LawLevelByWorldType(world, 'Mainworld');

        // Tech Level: Standard modifiers
        generateT5TechLevelByWorldType(world, 'Mainworld');

        // --- 2.5. Travel Zone ---
        world.travelZone = (world.law >= 15) ? 'Amber' : 'Green';

        // --- 3. Trade Codes ---
        world.tradeCodes = calculateT5TradeCodes(world);

        // --- 4. Finalize ---
        world.uwp = `${world.starport}${toUWPChar(world.size)}${toUWPChar(world.atm)}${toUWPChar(world.hydro)}${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;

        // Socioeconomic placeholders for display
        world.popDigit = world.pop > 0 ? Math.floor(_rng() * 10) : 0;
        world.planetoidBelts = Math.max(0, _roll1D('Belts Roll') - 3);
        world.gasGiantsCount = Math.max(0, Math.floor(_roll2D('Gas Giants Roll') / 2) - 2);
        world.gasGiant = world.gasGiantsCount > 0;

        // --- 5. Bases ---
        generateT5Bases(world);

        return world;
    }

    /**
     * T5 BASE GENERATION
     */
    function generateT5Bases(world) {
        let navalBase = false;
        let scoutBase = false;
        let navalDepot = false;
        let wayStation = false;

        const starport = world.starport;

        if (starport === 'A') {
            if (_roll2D('Naval Base Check') <= 6) navalBase = true;
            if (_roll2D('Scout Base Check') <= 4) scoutBase = true;
            if (_rng() < 0.001) navalBase = true; // Naval Depot proxy or roll
        } else if (starport === 'B') {
            if (_roll2D('Naval Base Check') <= 5) navalBase = true;
            if (_roll2D('Scout Base Check') <= 5) scoutBase = true;
        } else if (starport === 'C') {
            if (_roll2D('Scout Base Check') <= 6) scoutBase = true;
        } else if (starport === 'D') {
            if (_roll2D('Scout Base Check') <= 7) scoutBase = true;
        }

        world.navalBase = navalBase;
        world.scoutBase = scoutBase;
        world.wayStation = wayStation;

        // Legacy compatibility: bases array
        world.bases = [];
        if (navalBase) world.bases.push('N');
        if (scoutBase) world.bases.push('S');
        if (wayStation) world.bases.push('W');
    }

    return {
        generateT5SizeByWorldType,
        generateT5AtmosphereByWorldType,
        generateT5HydrographicsByWorldType,
        generateT5PopulationByWorldType,
        generateT5SpaceportByWorldType,
        generateT5GovernmentByWorldType,
        generateT5LawLevelByWorldType,
        generateT5TechLevelByWorldType,
        calculateT5TradeCodes,
        generateT5Bases,
        generateT5Mainworld
    };
}));
