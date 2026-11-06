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
    const { toEHex, fromEHex, clampUWP, rollFlux } = UniversalMath;

    // Safe Fallback Utilities
    // Read rng at each call: reseedForHex replaces it, so a copy taken at load never re-seeds.
    const _rng = () => (typeof rng === 'function') ? rng() : Math.random();
    const _roll1D = (typeof tRoll1D === 'function') ? tRoll1D : (label) => Math.floor(_rng() * 6) + 1;
    const _roll2D = (typeof tRoll2D === 'function') ? tRoll2D : (label) => Math.floor(_rng() * 6) + 1 + Math.floor(_rng() * 6) + 1;
    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;
    const _reseedForHex = (typeof reseedForHex === 'function') ? reseedForHex : (id) => { _log(`Warning: reseedForHex not found. Generation for ${id} may not be deterministic.`); };
    const _isManual = (typeof isManual === 'function') ? isManual : () => false;

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
            // Mainworld 2D-2 can legitimately produce 0 (asteroid belt mainworld).
            // Subordinate world types (InnerWorld, IceWorld, Hospitable, etc.) keep minimum 1.
            const minSize = (worldType === 'Mainworld') ? 0 : 1;
            size = Math.max(minSize, tempSize);
            let logMsg = `Size Formula (${worldType}): 2D - 2. Rolled ${roll}. Final Size: ${size}`;
            if (tempSize < minSize) logMsg += ` Clamped to minimum ${minSize}.`;
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
        const sizeVal = (typeof world.size === 'string' ? fromEHex(world.size) : (world.size || 0));
        
        if (worldType === 'Inferno') {
            world.atm = fromEHex('B'); // 11
            _log(`Atmosphere Calc (Inferno): Fixed to B.`);
            if (typeof tResult !== 'undefined' && world.atm !== undefined) {
                tResult('Atmosphere Code', world.atm, 'T5 2.2: Atmospheric Chemistry');
            }
            return;
        }
        if (worldType === 'Belt' || worldType === 'Planetoid Belt') {
            world.atm = 0;
            _log(`Atmosphere Calc (Belt): Automatically 0.`);
            if (typeof tResult !== 'undefined' && world.atm !== undefined) {
                tResult('Atmosphere Code', world.atm, 'T5 2.2: Atmospheric Chemistry');
            }
            return;
        }

        let flux = rollFlux();
        let dm = (worldType === 'StormWorld') ? 4 : 0;

        let rawAtm = sizeVal + flux + dm;
        let minAtm = (worldType === 'StormWorld') ? 4 : 0;
        world.atm = Math.min(15, Math.max(minAtm, rawAtm));

        let logMsg = `Atmosphere Calc (${worldType}): Size ${world.size} + Flux (${flux >= 0 ? '+' : ''}${flux})`;
        if (dm !== 0) logMsg += ` + DM ${dm}`;
        logMsg += ` = ${rawAtm} -> Final: ${toEHex(world.atm)}.`;
        _log(logMsg);

        if (typeof tResult !== 'undefined' && world.atm !== undefined) {
            tResult('Atmosphere Code', world.atm, 'T5 2.2: Atmospheric Chemistry');
        }
    }

    /**
     * T5 HYDROGRAPHICS BY WORLD TYPE
     */
    function generateT5HydrographicsByWorldType(world, worldType) {
        if (worldType === 'Inferno' || worldType === 'Belt' || worldType === 'Planetoid Belt') {
            world.hydro = 0;
            _log(`Hydro Calc (${worldType}): Fixed to 0.`);
            if (typeof tResult !== 'undefined' && world.hydro !== undefined) { tResult('Hydrographic Code', world.hydro, 'T5 2.3: Hydrographics'); }
            return;
        }

        const sizeVal = (typeof world.size === 'string' ? fromEHex(world.size) : (world.size || 0));
        if (sizeVal < 2) {
            world.hydro = 0;
            _log(`Hydro Calc (${worldType}): Size < 2. Fixed to 0.`);
            if (typeof tResult !== 'undefined' && world.hydro !== undefined) { tResult('Hydrographic Code', world.hydro, 'T5 2.3: Hydrographics'); }
            return;
        }

        let flux = rollFlux();
        let base = flux + (world.atm || 0);
        let atmDM = (world.atm < 2 || world.atm > 9) ? -4 : 0;
        let typeDM = (worldType !== 'Mainworld' && ['InnerWorld', 'StormWorld'].includes(worldType)) ? -4 : 0;

        let rawHydro = base + atmDM + typeDM;
        world.hydro = Math.min(10, Math.max(0, rawHydro));

        let logMsg = `Hydro Calc (${worldType}): Base (Flux+Atm) ${base}`;
        if (atmDM !== 0) logMsg += ` - DM 4 (Atm)`;
        if (typeDM !== 0) logMsg += ` - DM 4 (${worldType})`;
        logMsg += ` = ${rawHydro}. Clamped to ${toEHex(world.hydro)}.`;
        _log(logMsg);

        if (typeof tResult !== 'undefined' && world.hydro !== undefined) { tResult('Hydrographic Code', world.hydro, 'T5 2.3: Hydrographics'); }
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
        if (rollValue === 10) {
            let explodeRoll = _roll2D('Population Explosion (2D+3)');
            rollValue = explodeRoll + 3;
            _log(`Population Explosion triggered! Rerolled as 2D+3 = ${rollValue}`);
        }
        let rawPop = rollValue + dm;

        // Settings: Pop Mod (mainworld only)
        if (worldType === 'Mainworld') {
            const settingsPopMod = (typeof window !== 'undefined' && window.generationPopMod !== undefined) ? window.generationPopMod : 0;
            if (settingsPopMod !== 0) {
                rawPop += settingsPopMod;
                _log(`Settings Pop Modifier: ${settingsPopMod > 0 ? '+' : ''}${settingsPopMod}`);
                if (typeof tResult !== 'undefined') tResult('Settings Pop Modifier', `${settingsPopMod > 0 ? '+' : ''}${settingsPopMod}`, 'T5 3.1: Social Stats');
            } else {
                if (typeof tResult !== 'undefined') tResult('Settings Pop Modifier', 'None (0)', 'T5 3.1: Social Stats');
            }
        }

        let generatedPop = Math.max(0, rawPop);
        if (worldType === 'Mainworld' && !(window._currentSystemHasPop ?? true)) {
            generatedPop = 0;
            _log('Pop Check Frequency: system is uninhabited (forced 0)');
        }

        // Settings: Pop Max cap (mainworld only — subordinates use mainworld-derived maxSubordinatePop)
        const effectiveCap = (worldType === 'Mainworld')
            ? Math.min(maxSubordinatePop, (typeof window !== 'undefined' && window.generationPopMax !== undefined) ? window.generationPopMax : maxSubordinatePop)
            : maxSubordinatePop;
        if (worldType === 'Mainworld' && typeof tResult !== 'undefined') {
            const settingsPopMax = (typeof window !== 'undefined' && window.generationPopMax !== undefined) ? window.generationPopMax : maxSubordinatePop;
            if (generatedPop > settingsPopMax) {
                tResult('Settings Pop Max', `Cap applied: ${generatedPop} → ${settingsPopMax}`);
            } else {
                tResult('Settings Pop Max', `No cap (${generatedPop} ≤ ${settingsPopMax})`);
            }
        }

        let finalPop = Math.min(generatedPop, effectiveCap);

        _log(`Pop Calc (${worldType}): Roll (${rollValue + 2}) - 2 DM ${dm} = ${rawPop}. Cap ${effectiveCap}. Final ${finalPop}`);

        world.pop = finalPop;
        if (typeof world.popDigit !== 'undefined') {
            world.popDigit = world.pop > 0 ? Math.floor(_rng() * 9) + 1 : 0;
        }

        if (typeof tResult !== 'undefined' && world.pop !== undefined) {
            tResult('Population Code', world.pop, 'T5 3.1: Social Stats');
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

        _log(`Gov Calc (${worldType}): Flux (${flux >= 0 ? '+' : ''}${flux}) + Pop (${world.pop || 0}) = ${rawGov} -> Final: ${toEHex(world.gov)}`);

        if (typeof tResult !== 'undefined' && world.gov !== undefined) {
            tResult('Government Code', world.gov, 'T5 3.1: Social Stats');
        }
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

        _log(`Law Level Calc (${worldType}): Flux (${flux >= 0 ? '+' : ''}${flux}) + Gov (${world.gov || 0}) = ${rawLaw} -> Final: ${toEHex(world.law)}`);

        if (typeof tResult !== 'undefined' && world.law !== undefined) {
            tResult('Law Level Code', world.law, 'T5 3.1: Social Stats');
        }
    }

    /**
     * T5 TECH LEVEL BY WORLD TYPE
     */
    function generateT5TechLevelByWorldType(world, worldType) {
        if (['RadWorld', 'Inferno'].includes(worldType)) {
            world.tl = 0;
            _log(`TL Calc (${worldType}): Fixed to 0 per profile rules.`);
            if (typeof tResult !== 'undefined') tResult('Tech Level Code', world.tl, 'T5 3.2: Tech Level');
            return;
        }

        let roll = _roll1D('TL Roll');
        let tlDM = 0;
        let mods = [];

        const data = (typeof T5_Data !== 'undefined') ? T5_Data.TECH_LEVEL_MODIFIERS : null;
        if (!data) {
            _log("WARNING: T5_Data.TECH_LEVEL_MODIFIERS not found. Base roll used.");
            world.tl = Math.max(0, roll);
            return;
        }

        const sp = world.starport || 'C';
        if (data.starport[sp] !== undefined) {
            tlDM += data.starport[sp];
            mods.push(`Port ${sp} (${data.starport[sp] > 0 ? '+' : ''}${data.starport[sp]})`);
        }

        const size = typeof world.size === 'number' ? world.size : fromEHex(world.size);
        if (data.size[size] !== undefined) {
            tlDM += data.size[size];
            mods.push(`Size ${toEHex(size)} (${data.size[size] > 0 ? '+' : ''}${data.size[size]})`);
        }

        const atm = world.atm || 0;
        if (data.atm[atm] !== undefined) {
            tlDM += data.atm[atm];
            mods.push(`Atm ${toEHex(atm)} (${data.atm[atm] > 0 ? '+' : ''}${data.atm[atm]})`);
        }

        const hydro = world.hydro || 0;
        if (data.hydro[hydro] !== undefined) {
            tlDM += data.hydro[hydro];
            mods.push(`Hydro ${toEHex(hydro)} (${data.hydro[hydro] > 0 ? '+' : ''}${data.hydro[hydro]})`);
        }

        const pop = world.pop || 0;
        if (data.pop[pop] !== undefined) {
            tlDM += data.pop[pop];
            mods.push(`Pop ${toEHex(pop)} (${data.pop[pop] > 0 ? '+' : ''}${data.pop[pop]})`);
        }

        const gov = world.gov || 0;
        if (data.gov[gov] !== undefined) {
            tlDM += data.gov[gov];
            mods.push(`Gov ${toEHex(gov)} (${data.gov[gov] > 0 ? '+' : ''}${data.gov[gov]})`);
        }

        // Settings: TL Modifier
        const settingsTlMod = (typeof window !== 'undefined' && window.generationTlMod !== undefined) ? window.generationTlMod : 0;
        const settingsTlMax = (typeof window !== 'undefined' && window.generationTlMax !== undefined) ? window.generationTlMax : 20;
        if (settingsTlMod !== 0) {
            tlDM += settingsTlMod;
            mods.push(`Settings Mod (${settingsTlMod > 0 ? '+' : ''}${settingsTlMod})`);
        }

        let finalTL = Math.max(0, roll + tlDM);

        // Settings: TL Max cap
        world.tl = Math.min(finalTL, settingsTlMax);

        let logMsg = `TL Calc (${worldType}): Roll (${roll})`;
        if (mods.length > 0) logMsg += " + " + mods.join(" + ");
        logMsg += ` = ${finalTL}`;
        if (world.tl < finalTL) logMsg += ` → capped to ${world.tl} (TL Max ${settingsTlMax})`;
        else logMsg += ` (TL Max ${settingsTlMax}: no cap)`;
        logMsg += '.';
        _log(logMsg);

        if (typeof tResult !== 'undefined' && world.tl !== undefined) {
            tResult('Settings TL Modifier', settingsTlMod !== 0 ? `${settingsTlMod > 0 ? '+' : ''}${settingsTlMod}` : 'None (0)', 'T5 3.2: Tech Level');
            tResult('Settings TL Max', world.tl < finalTL ? `Cap applied: ${finalTL} → ${world.tl}` : `No cap (${finalTL} ≤ ${settingsTlMax})`, 'T5 3.2: Tech Level');
            tResult('Tech Level Code', world.tl, 'T5 3.2: Tech Level');
        }
    }

    function calculateT5PhysicalStats(world) {
        if (!world || world.size === undefined) return;

        const isGG = (world.type && (world.type.includes('Gas Giant') || world.type === 'Ice Giant'));
        // Gas Giant size letters are T5's own tier code (M/N Small; P/Q/R/S/T/U/V/W/X Large —
        // generateGasGiantStats, t5_topdown_generator.js), a standard eHex digit, except 'R'/'S'
        // specifically collide with fromEHex's CT-specific Ring/Small-moon sentinels (0.1/0.5).
        // Resolve those two to their real eHex value (R=25, S=26) directly instead of falling
        // through fromEHex's CT-flavored intercept — same collision already worked around in
        // this file's own moon-size clamp (see generateT5Satellites, t5_topdown_generator.js).
        let sizeVal;
        if (world.size === '0' || world.size === 0) {
            sizeVal = 0.35;
        } else if (isGG && world.size === 'R') {
            sizeVal = 25;
        } else if (isGG && world.size === 'S') {
            sizeVal = 26;
        } else {
            sizeVal = (typeof world.size === 'string') ? fromEHex(world.size) : world.size;
        }

        // 1. Diameter Calculation
        if (!_isManual(world, 'diamKm')) {
            if (isGG) {
                world.diamKm = sizeVal * 10000;
            } else if (sizeVal <= 0.35) {
                world.diamKm = 500;
            } else {
                world.diamKm = sizeVal * 1600;
            }
        }

        // 2. Physics Lookup (Unified Mass Assignment)
        if (!isGG) {
            const stats = T5_Data.WORLD_DIMENSIONS[sizeVal] || { gravity: 0, mass: 0 };
            world.density = 1.0;
            if (!_isManual(world, 'gravity')) world.gravity = stats.gravity;
            if (!_isManual(world, 'mass')) {
                world.mass = stats.mass;
                world.massEarths = stats.mass;
            }
            world.composition = null;
        } else {
            world.density = 0.1;
            if (!_isManual(world, 'gravity')) world.gravity = parseFloat((sizeVal / 10).toFixed(2));
            if (!_isManual(world, 'mass')) {
                world.mass = 'Variable (Giant)';
                world.massEarths = 317.8;
            }
        }

        // 3. Trace Logging
        if (typeof tResult !== 'undefined' && !isGG) {
            tResult(`Size ${world.size} Gravity`, `${world.gravity.toFixed(3)} G`, 'T5 2.1: Composition & Gravity');
            tResult(`Size ${world.size} Mass`, `${world.mass.toFixed(4)} Earths`, 'T5 2.1: Composition & Gravity');
        }
    }

    /**
     * T5_Data.TIDAL_LOCK.LOGIC.STAR_LOCK: a planet (not a satellite) in Orbit 0 or 1 is
     * tidally locked to its star.
     */
    function isT5StarLocked(world) {
        const isSatellite = world.isMoon || world.isSatellite || world.type === 'Satellite';
        return !isSatellite && T5_Data.TIDAL_LOCK.STAR_LOCK_ORBITS.includes(world.orbitId);
    }

    /**
     * A gas giant or belt, by either field the engines set. Ruling (Sean, 2026-11-01): neither
     * takes Tz, and neither has a climate label.
     */
    function isT5GGorBelt(world) {
        if (!world) return false;
        const isGiant = t => typeof t === 'string' && (t.includes('Gas Giant') || t === 'Ice Giant');
        return world.worldType === 'Belt' || world.type === 'Planetoid Belt' ||
            isGiant(world.type) || isGiant(world.worldType);
    }

    /**
     * T5_Data.TIDAL_LOCK.LOGIC.PARENT_LOCK: a Close Satellite is locked to its planet; a Far
     * Satellite is not. isCloseSatellite is set by t5_topdown_generator.js: the mainworld's
     * lunar trigger (Chart 2C Satellite?), or the 2D Close/Far roll for every other satellite.
     */
    function isT5CloseSatellite(world) {
        const isSatellite = world.isMoon || world.isSatellite || world.type === 'Satellite';
        return isSatellite && (world.worldType === 'Close Satellite' || world.isCloseSatellite === true);
    }

    /**
     * T5_Data.TIDAL_LOCK.CHART_2C: a satellite's orbit as { letter, name, isClose }, e.g.
     * { letter: 'D', name: 'Dee', isClose: true }. Returns null when the body has no letter, or
     * when its letter is in the wrong column for its Close/Far status (saves made before Chart
     * 2C gave Far mainworlds a Close letter) — a wrong orbit is never shown.
     */
    function getT5SatelliteOrbit(world) {
        if (!world || !world.orbitLetter) return null;
        // A mainworld moved off a moon in the System Editor can keep its old letter.
        if (!(world.isMoon || world.isSatellite || world.type === 'Satellite' || world.type === 'Moon')) return null;
        const letter = String(world.orbitLetter).toUpperCase();
        // Saves made before isCloseSatellite existed record a Close mainworld only by its Lk code.
        const isClose = world.isCloseSatellite === true || world.worldType === 'Close Satellite' ||
            (Array.isArray(world.tradeCodes) && world.tradeCodes.includes(T5_Data.TIDAL_LOCK.CODES.PARENT_LOCKED));
        const column = T5_Data.TIDAL_LOCK.CHART_2C.ORBITS[isClose ? 'CLOSE' : 'FAR'];
        const row = Object.values(column).find(r => r.letter === letter);
        return row ? { letter: row.letter, name: row.name, isClose } : null;
    }

    // Rotation text. T5_Data.TIDAL_LOCK.LOGIC.TZ_DAY_LENGTH / LK_DAY_LENGTH: a star-locked world
    // has no day/night cycle; a Close satellite's day equals its orbit length. T5 gives no orbit
    // periods, so no hours are shown.
    const ROTATION_TEXT = {
        STAR: 'Tidally Locked to Star (no day/night cycle)',
        PARENT: 'Tidally Locked to Parent (day = orbit length)',
        FREE: 'Undefined (Referee Discretion)'
    };
    // Saves made before 2026-11-01 carry the old wording.
    const LEGACY_ROTATION_TEXT = {
        'Tidally Locked (1:1 to Star)': ROTATION_TEXT.STAR,
        'Tidally Locked (1:1 to Parent)': ROTATION_TEXT.PARENT
    };

    /**
     * T5 2.5: ROTATIONAL DYNAMICS
     * Evaluates tidal locking for planets in inner orbits and close satellites.
     * Standard day length is undefined in T5 and left to Referee Discretion.
     */
    function calculateT5RotationalDynamics(world) {
        let isLocked = false;
        let lockType = "Free";
        let rotationState = ROTATION_TEXT.FREE;

        if (isT5StarLocked(world)) {
            isLocked = true;
            lockType = "Locked (Star)";
            rotationState = ROTATION_TEXT.STAR;
        }

        if (isT5CloseSatellite(world)) {
            isLocked = true;
            lockType = "Locked (Parent)";
            rotationState = ROTATION_TEXT.PARENT;
        }

        if (!_isManual(world, 'isTidallyLocked')) world.isTidallyLocked = isLocked;
        if (!_isManual(world, 'rotationState')) world.rotationState = rotationState;

        if (typeof tResult !== 'undefined') {
            tResult('Tidal Lock Status', lockType, 'T5 2.5: Rotational Dynamics');
            tResult('Rotation State', world.rotationState, 'T5 2.5: Rotational Dynamics');
        }
    }

    /**
      * T5 TRADE CODES (Data-Driven)
      */
    function calculateT5TradeCodes(world) {
        let codes = [];
        const tcData = T5_Data.TRADE_CODES;

        // Normalize values for comparison
        const wSize = typeof world.size === 'number' ? world.size : fromEHex(world.size);
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

        // (These remain hardcoded as they depend on the world's physical relationship to the system)
        // T5_Data.TIDAL_LOCK.LOGIC.SATELLITE_CODES (house rule): Sa only for a satellite
        // mainworld, and any Close Satellite adds Lk (LOGIC.CODES) — a star-locked planet gets
        // Tz, never Lk.
        const isMainworld = world.type === 'Mainworld' || world.isLunarMainworld === true || world.isMainworld === true;
        const isSatellite = world.worldType === 'Far Satellite' || world.isMoon || world.isSatellite || world.type === 'Satellite';
        if (isMainworld && isSatellite) codes.push(T5_Data.TIDAL_LOCK.CODES.SATELLITE);
        // Gas giants and belts never take Tz (Sean, 2026-11-01).
        if (isT5CloseSatellite(world)) codes.push(T5_Data.TIDAL_LOCK.CODES.PARENT_LOCKED);
        if (isT5StarLocked(world) && !isT5GGorBelt(world)) codes.push(T5_Data.TIDAL_LOCK.CODES.STAR_LOCKED);

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
     *
     * `editorSeed` (optional) — System Editor support (OW-44, directives/project_manifest.md):
     * when supplied (an object carrying any pre-filled fields plus `_manualFields`, built via
     * the shared `applyUwpSeed()` from a working-copy body's typed "Seed UWP digits"), every
     * roll step below is gated the same way generateT5SubordinateUWP already gates subordinate
     * bodies' fields — `!_isManual(world, field)` — instead of rolling unconditionally. The
     * stellar-constellation roll (step 0) is skipped entirely in this mode: generateT5System()
     * never reads a seeded mainworldBase.stars when seedSys.stars is present (always true from
     * the System Editor), and none of this function's own fields depend on star type, so rolling
     * one here would only waste seeded dice and log a "System Constellation" entry unrelated to
     * the system's real, user-built stars. Existing (non-editor) callers pass no second argument,
     * so editorSeed is undefined, every _isManual check returns false, and generation is
     * identical to before this change — same safety guarantee this codebase relies on everywhere
     * a seedSys/editorSeed parameter gates a generator (see Algorithm 6).
     */
    function generateT5Mainworld(hexId, editorSeed) {
        if (hexId) {
            _reseedForHex(hexId);
            _log(`T5 Mainworld Generation: Hex ${hexId}`);
            if (typeof shouldGeneratePopulation === 'function') {
                window._currentSystemHasPop = shouldGeneratePopulation(hexId);
            }
        }

        // --- 0. Stellar Situation ---
        // Skipped when editor-seeded — see the editorSeed doc comment above.
        const stars = [];
        if (!editorSeed) {
            // Note: In UI context, we often roll fresh unless imported.
            // We'll use a simplified version that integrates with the existing Stellar Engine.
            const stellarEngine = (typeof T5_Stellar_Engine !== 'undefined') ? T5_Stellar_Engine : (typeof window !== 'undefined' ? window.T5_Stellar_Engine : null);

            if (stellarEngine) {
                const constellation = stellarEngine.determineStellarConstellation();
                stars.push(...constellation.stars);
            } else {
                stars.push({ type: 'G', size: 'V', name: 'Primary', decimal: 2 });
            }

            _log(`System Constellation: [${stars.map(s => s.name).join(' ')}]`);
        }

        const world = Object.assign({
            hexId,
            stars,
            worldType: 'Mainworld', // Default for this entry point
            _manualFields: [],
        }, editorSeed || {});

        // --- 1. Basic Stats ---
        if (!_isManual(world, 'starport')) {
            const _starportTable = ['A', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'E', 'E', 'X'];
            const _starportRoll = _roll2D('Starport Roll');
            const _starportMod = (typeof window !== 'undefined' && window.generationStarportMod !== undefined) ? window.generationStarportMod : 0;
            if (_starportMod !== 0) _log(`Settings Starport Modifier: ${_starportMod > 0 ? '+' : ''}${_starportMod}`);
            const _starportIdx = Math.max(0, Math.min(10, (_starportRoll + _starportMod) - 2));
            let starport = _starportTable[_starportIdx] || 'X';
            _log(`Starport Roll: ${_starportRoll}${_starportMod !== 0 ? ` (mod ${_starportMod > 0 ? '+' : ''}${_starportMod})` : ''} → ${starport}`);

            // Settings: Starport Max cap
            const _starportOrder = ['A', 'B', 'C', 'D', 'E', 'X'];
            const _starportMax = (typeof window !== 'undefined' && window.generationStarportMax !== undefined) ? window.generationStarportMax : 'A';
            const _spMaxIdx = _starportOrder.indexOf(_starportMax);
            const _spCurIdx = _starportOrder.indexOf(starport);
            if (_spMaxIdx !== -1 && _spCurIdx !== -1 && _spCurIdx < _spMaxIdx) {
                _log(`Settings Starport Max: Cap applied ${starport} → ${_starportMax}`);
                starport = _starportMax;
            } else {
                _log(`Settings Starport Max: No cap (${starport} ≤ ${_starportMax})`);
            }
            if (!(window._currentSystemHasPop ?? true) && _starportOrder.indexOf(starport) < _starportOrder.indexOf('E')) {
                _log(`Pop Check Frequency: Starport cap applied ${starport} → E`);
                starport = 'E';
            }
            world.starport = starport;
        }

        // --- 2. UWP Parameters ---
        // Size: 2D-2 (with 10 variant)
        if (!_isManual(world, 'size') && world.size === undefined) {
            world.size = generateT5SizeByWorldType('Mainworld');
        }

        // Atmosphere: Size + Flux
        if (!_isManual(world, 'atm')) generateT5AtmosphereByWorldType(world, 'Mainworld');

        // Hydrographics: Atm + Flux
        if (!_isManual(world, 'hydro')) generateT5HydrographicsByWorldType(world, 'Mainworld');

        // Population: 2D-2
        if (!_isManual(world, 'pop')) generateT5PopulationByWorldType(world, 'Mainworld', 12); // Mainworlds usually not capped below 12

        // Government: Pop + Flux
        if (!_isManual(world, 'gov')) generateT5GovernmentByWorldType(world, 'Mainworld');

        // Law: Gov + Flux
        if (!_isManual(world, 'law')) generateT5LawLevelByWorldType(world, 'Mainworld');

        // Tech Level: Standard modifiers
        if (!_isManual(world, 'tl')) generateT5TechLevelByWorldType(world, 'Mainworld');

        // Rotational Dynamics deliberately NOT run here: this entry point generates the
        // mainworld before it has been placed into a star orbit, so world.orbitId does not
        // exist yet and the tidal-lock-to-star check could never fire. t5_topdown_generator.js's
        // fleshOutSubordinates() runs it once the body's real orbit is known.

        // --- 2.5. Travel Zone ---
        world.travelZone = (!window.generationNoTravelZones && world.law >= 15) ? 'Amber' : 'Green';

        // --- 3. Trade Codes ---
        world.tradeCodes = calculateT5TradeCodes(world);

        // --- 4. Finalize ---
        world.uwp = `${world.starport}${toEHex(world.size)}${toEHex(world.atm)}${toEHex(world.hydro)}${toEHex(world.pop)}${toEHex(world.gov)}${toEHex(world.law)}-${toEHex(world.tl)}`;

        // Socioeconomic placeholders for display
        world.popDigit = world.pop > 0 ? Math.floor(_rng() * 9) + 1 : 0;
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
        let wayStation = false;

        const starport = world.starport;
        const baseData = (typeof T5_Data !== 'undefined') ? T5_Data.BASES : null;

        if (baseData) {
            // Dynamic Base Pull from Data Shield
            if (baseData.NAVAL && baseData.NAVAL.ALLOWED_PORTS.includes(starport)) {
                navalBase = _roll2D('Naval Base Check') <= baseData.NAVAL.TARGETS[starport];
            }
            if (baseData.SCOUT && baseData.SCOUT.ALLOWED_PORTS.includes(starport)) {
                scoutBase = _roll2D('Scout Base Check') <= baseData.SCOUT.TARGETS[starport];
            }
            if (baseData.DEPOT && baseData.DEPOT.ALLOWED_PORTS.includes(starport)) {
                if (_rng() < baseData.DEPOT.PROBABILITY) navalBase = true; // Depot proxy
            }
        } else {
            // Legacy Fallback if Data Shield missing
            if (starport === 'A') {
                if (_roll2D('Naval Base Check') <= 6) navalBase = true;
                if (_roll2D('Scout Base Check') <= 4) scoutBase = true;
                if (_rng() < 0.001) navalBase = true;
            } else if (starport === 'B') {
                if (_roll2D('Naval Base Check') <= 5) navalBase = true;
                if (_roll2D('Scout Base Check') <= 5) scoutBase = true;
            } else if (starport === 'C') {
                if (_roll2D('Scout Base Check') <= 6) scoutBase = true;
            } else if (starport === 'D') {
                if (_roll2D('Scout Base Check') <= 7) scoutBase = true;
            }
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

    // The CLIMATE_MAPPING position whose words name each climate code's text.
    const CLIMATE_TEXT_POSITION = { Tr: '-1', Ho: '-1', Tu: '1', Co: '1', Fr: '2' };

    /**
     * T5 2.4: THERMAL LOGIC — the Climate Zone text. Ruling (Sean, 2026-11-01): the text follows
     * the world's climate code (Tz, Tr/Ho, Tu/Co, Fr), and a world with none of them — every
     * gas giant and belt included — has no climate text.
     */
    function getT5ClimateText(world) {
        if (!world || isT5GGorBelt(world)) return '';
        const codes = Array.isArray(world.tradeCodes) ? world.tradeCodes
            : String(world.tradeCodes || '').split(/\s+/);
        if (codes.includes(T5_Data.TIDAL_LOCK.CODES.STAR_LOCKED)) return 'Twilight Zone (Tz)';
        const code = codes.find(c => CLIMATE_TEXT_POSITION[c]);
        return code ? (T5_Data.CLIMATE_MAPPING[CLIMATE_TEXT_POSITION[code]] || '') : '';
    }

    // The Climate Zone to show: a hand-typed one as typed, otherwise the text for the world's
    // codes — so a save made before 2026-11-01 shows what a fresh generation would.
    function getT5ClimateDisplay(world) {
        if (!world || isT5GGorBelt(world)) return '';
        return _isManual(world, 'climateZone') ? (world.climateZone || '') : getT5ClimateText(world);
    }

    // The Rotation to show: a hand-typed one as typed, otherwise the stored text with the
    // pre-2026-11-01 wording brought up to date. The lock itself is not re-worked out here.
    function getT5RotationDisplay(world) {
        if (!world || world.rotationState == null) return '';
        if (_isManual(world, 'rotationState')) return world.rotationState;
        return LEGACY_ROTATION_TEXT[world.rotationState] || world.rotationState;
    }

    /**
     * T5_Data.CLIMATE_TRADE_CODES (Chart D, Book 3 p.26): the world's one climate code, or ''.
     * hzPosition = orbit - HZ orbit (a satellite uses its planet's orbit). Tr/Tu/Fr need the
     * right UWP as well as the right position; the first entry that fits wins, so a world at
     * HZ -1/+1 that misses Tr/Tu falls through to Ho/Co. isTz: the world is star-locked and
     * takes Tz instead (left out = isT5StarLocked). A gas giant or belt takes no climate code at
     * all (Sean, 2026-11-01). Applies to every world, not only the mainworld (Sean, 2026-11-02).
     */
    function getT5ClimateCode(world, hzPosition, isTz) {
        if (!world || isT5GGorBelt(world)) return '';
        if (isTz === undefined) isTz = isT5StarLocked(world);
        if (isTz) return T5_Data.TIDAL_LOCK.CODES.STAR_LOCKED;
        const size = typeof world.size === 'string' ? fromEHex(world.size) : (world.size || 0);
        const tc = T5_Data.CLIMATE_TRADE_CODES.find(c =>
            hzPosition >= c.hzMin && (c.hzMax === undefined || hzPosition <= c.hzMax) &&
            (!c.reqs.size || c.reqs.size.includes(size)) &&
            (!c.reqs.atm || c.reqs.atm.includes(world.atm || 0)) &&
            (!c.reqs.hydro || c.reqs.hydro.includes(world.hydro || 0)));
        return tc ? tc.code : '';
    }

    // Replaces any climate code (Tz, Tr, Tu, Fr, Ho, Co) in world.tradeCodes with getT5ClimateCode's
    // one, so a world never carries two.
    function applyT5ClimateCode(world, hzPosition, isTz) {
        const code = getT5ClimateCode(world, hzPosition, isTz);
        if (!code && !world.tradeCodes) return '';   // a gas giant has no trade code list
        const climateCodes = [T5_Data.TIDAL_LOCK.CODES.STAR_LOCKED, ...T5_Data.CLIMATE_TRADE_CODES.map(tc => tc.code)];
        world.tradeCodes = (world.tradeCodes || []).filter(c => !climateCodes.includes(c));
        if (code) world.tradeCodes.push(code);
        return code;
    }

    // Call after the world's trade codes are final.
    function calculateT5Climate(world) {
        if (!_isManual(world, 'climateZone')) world.climateZone = getT5ClimateText(world);
        tResult('Climate Zone', world.climateZone || 'None (no climate code)', 'T5 2.4: Thermal Logic');
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
        calculateT5RotationalDynamics,
        getT5RotationDisplay,
        getT5SatelliteOrbit,
        calculateT5PhysicalStats,
        calculateT5Climate,
        getT5ClimateCode,
        applyT5ClimateCode,
        getT5ClimateText,
        getT5ClimateDisplay,
        isT5GGorBelt,
        generateT5Bases,
        generateT5Mainworld
    };
}));
