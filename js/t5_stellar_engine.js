/**
 * js/t5_stellar_engine.js
 * 
 * T5 STELLAR ENGINE (v2.0 Modular Architecture)
 * Handles star and constellation generation for Traveller 5.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math', '../rules/t5_data'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'), require('../rules/t5_data'));
    } else {
        root.T5_Stellar_Engine = factory(root.UniversalMath, root.T5_Data);
    }
}(this, function (UniversalMath, T5_Data) {
    const { rollFlux } = UniversalMath;
    const { HZ_DATA, ORBIT_AU } = T5_Data;

    // Safe Fallback Utilities
    const _rng = (typeof rng === 'function') ? rng : Math.random;
    const _roll1D = (typeof tRoll1D === 'function') ? tRoll1D : (label) => Math.floor(_rng() * 6) + 1;
    const _roll2D = (typeof tRoll2D === 'function') ? tRoll2D : (label) => Math.floor(_rng() * 6) + 1 + Math.floor(_rng() * 6) + 1;
    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;
    const _tSection = (typeof tSection === 'function') ? tSection : () => {};
    const _tResult = (typeof tResult === 'function') ? tResult : () => {};

    /**
     * Parses a T5 stellar string (e.g., "G2 V").
     */
    function parseT5Stellar(name) {
        if (!name) return { type: 'G', decimal: 2, size: 'V' };
        const parts = name.trim().split(/\s+/);
        let typePart = parts[0] || "G2";
        let sizePart = parts[1] || "V";

        let type = typePart[0].toUpperCase();
        let decimal = parseInt(typePart.slice(1)) || 0;
        let size = sizePart;

        if (typePart === 'BD' || typePart === 'Brown Dwarf') {
            return { type: 'BD', decimal: 0, size: 'V' };
        }
        if (typePart === 'D' || typePart === 'White Dwarf' || typePart.startsWith('WD')) {
            return { type: 'D', decimal: 0, size: 'D' };
        }
        return { type, decimal, size };
    }

    /**
     * Generates a T5 stellar profile using Flux rolls.
     */
    function generateT5StellarProfile(isSecondary = false, pTypeFlux = 0, pSizeFlux = 0) {
        let tFlux;
        if (isSecondary) {
            let roll = _roll1D('Spectral Flux Roll');
            tFlux = pTypeFlux + (roll - 1);
            _log(`Secondary Spectral Flux: Primary(${pTypeFlux}) + 1D(${roll}) - 1 = ${tFlux}`);
        } else {
            tFlux = rollFlux();
            _log(`Primary Spectral Flux Roll: ${tFlux >= 0 ? '+' : ''}${tFlux}`);
        }

        let type = 'G';
        if (tFlux <= -6) type = _rng() < 0.5 ? 'O' : 'B';
        else if (tFlux === -5 || tFlux === -4) type = 'A';
        else if (tFlux === -3 || tFlux === -2) type = 'F';
        else if (tFlux === -1 || tFlux === 0) type = 'G';
        else if (tFlux === 1 || tFlux === 2) type = 'K';
        else if (tFlux >= 3 && tFlux <= 5) type = 'M';
        else type = 'BD';

        let decimal = Math.floor(_rng() * 10);

        let sFlux;
        if (isSecondary) {
            let roll = _roll1D('Size Flux Roll');
            sFlux = pSizeFlux + (roll + 2);
            _log(`Secondary Size Flux: Primary(${pSizeFlux}) + 1D(${roll}) + 2 = ${sFlux}`);
        } else {
            sFlux = rollFlux();
            _log(`Primary Size Flux Roll: ${sFlux >= 0 ? '+' : ''}${sFlux}`);
        }

        let size = 'V';
        const isOBA = ['O', 'B', 'A'].includes(type);
        const isOB = ['O', 'B'].includes(type);
        const isFGK = ['F', 'G', 'K'].includes(type);

        if (sFlux <= -5) size = isOBA ? 'Ia' : 'II';
        else if (sFlux === -4) {
            if (isOBA) size = 'Ib';
            else if (isFGK) size = 'III';
            else if (type === 'M') size = 'II';
        }
        else if (sFlux === -3) {
            if (isOBA) size = 'II';
            else if (isFGK) size = 'IV';
            else if (type === 'M') size = 'II';
        }
        else if (sFlux === -2) {
            if (isOBA) size = 'III';
            else if (isFGK) size = 'V';
            else if (type === 'M') size = 'III';
        }
        else if (sFlux === -1) {
            if (isOB) size = 'III';
            else if (type === 'A') size = 'IV';
            else size = 'V';
        }
        else if (sFlux === 0) {
            if (isOB) size = 'III';
            else size = 'V';
        }
        else if (sFlux === 1) {
            if (type === 'B') size = 'III';
            else size = 'V';
        }
        else if (sFlux === 2 || sFlux === 3) size = 'V';
        else if (sFlux === 4) {
            if (isOB) size = 'IV';
            else if (type === 'A') size = 'V';
            else size = 'VI';
        }
        else if (sFlux >= 5) size = 'D';

        let originalSize = size;
        if (size === 'IV' && ((type === 'K' && decimal >= 5) || type === 'M')) size = 'V';
        if (size === 'VI' && (['O', 'B', 'A'].includes(type) || (type === 'F' && decimal <= 4))) size = 'V';

        if (size !== originalSize) {
            _log(`Constraint Applied: Size ${originalSize} not possible for ${type}${decimal}. Forced to Size V.`);
        }

        let name = (size === 'D') ? 'D' : (type === 'BD') ? 'BD' : `${type}${decimal} ${size}`;
        return { type, decimal, size, name, tFlux, sFlux };
    }

    /**
     * Generates a single star.
     */
    function generateStar(role, orbitID, importedName = null, isSecondary = false, pTypeFlux = 0, pSizeFlux = 0) {
        let type, decimal, size, tFlux, sFlux;
        _tSection(`Generating ${role} Star`);

        if (importedName) {
            _tResult('Imported Stellar', importedName);
            const parsed = parseT5Stellar(importedName);
            type = parsed.type;
            decimal = parsed.decimal;
            size = parsed.size;
            tFlux = 0; sFlux = 0;
        } else {
            const profile = generateT5StellarProfile(isSecondary, pTypeFlux, pSizeFlux);
            type = profile.type;
            decimal = profile.decimal;
            size = profile.size;
            tFlux = profile.tFlux;
            sFlux = profile.sFlux;
        }

        const TYPE_MAP = { 'O': 50, 'B': 10, 'A': 2, 'F': 1.5, 'G': 1.0, 'K': 0.7, 'M': 0.2, 'BD': 0.05, 'D': 1.0 };
        let luminosity = Math.pow(TYPE_MAP[type] || 1.0, 3.5);
        _tResult('Luminosity', luminosity.toFixed(3) + ' L_Sol');

        let starName = (size === 'D') ? 'D' : (type === 'BD') ? 'BD' : `${type}${decimal} ${size}`;
        _tResult('Final Stellar', starName);

        return {
            type, size, decimal, orbitID,
            distAU: ORBIT_AU[orbitID] || 0,
            role, luminosity, name: starName, tFlux, sFlux
        };
    }

    /**
     * Determines the constellation of stars in the system.
     */
    function determineStellarConstellation(importedString = null) {
        let stars = [];
        let status = "Generated";

        if (importedString) {
            _log(`[IMPORT ATTEMPT] Processing stellar string: "${importedString}"`);
            const starStrings = typeof importedString === 'string' ? importedString.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
            if (starStrings.length > 0) {
                starStrings.forEach((s, idx) => {
                    let role = idx === 0 ? 'Primary' : (idx === 1 ? 'Primary Companion' : 'Star');
                    let orbitID = 0;
                    if (idx === 2) orbitID = 2;
                    if (idx === 3) orbitID = 8;
                    if (idx === 4) orbitID = 14;
                    stars.push(generateStar(role, orbitID, s));
                });
                status = "Imported";
                _log(`[SUCCESS] Imported ${stars.length} stars.`);
            } else if (typeof importedString === 'object' && importedString.stars) {
                stars = importedString.stars.map(s => generateStar(s.role, s.orbitID, s.name));
                status = "Imported";
                _log(`[SUCCESS] Imported ${stars.length} stars from object.`);
            } else {
                _log(`[FAILED IMPORT] Malformed or empty stellar string. Falling back to Table 1 Flux rolls.`);
                status = "Fallback";
            }
        }

        if (stars.length === 0) {
            _tSection('Generating System Stars (Table 1, 2 & 3)');
            const primary = generateStar('Primary', 0);
            const pTFlux = primary.tFlux;
            const pSFlux = primary.sFlux;
            stars.push(primary);

            const checkStar = (role, orbitFormula) => {
                const flux = rollFlux();
                _log(`${role} Star Flux Roll: ${flux >= 0 ? '+' : ''}${flux}`);
                if (flux >= 3) {
                    const orbit = orbitFormula();
                    const star = generateStar(role, orbit, null, true, pTFlux, pSFlux);
                    _log(`  [YES] ${role} Star present: ${star.name} at Orbit ${orbit}`);
                    return star;
                }
                _log(`  [NO] No ${role} star present.`);
                return null;
            };

            const close = checkStar('Close', () => (_roll1D('Close Orbit Roll')) - 1);
            const near = checkStar('Near', () => 5 + (_roll1D('Near Orbit Roll')));
            const far = checkStar('Far', () => 11 + (_roll1D('Far Orbit Roll')));

            if (close) stars.push(close);
            if (near) stars.push(near);
            if (far) stars.push(far);

            const currentStars = [...stars];
            currentStars.forEach(parent => {
                const cFlux = rollFlux();
                _log(`Companion check for ${parent.role} (${parent.name}) Flux Roll: ${cFlux >= 0 ? '+' : ''}${cFlux}`);
                if (cFlux >= 3) {
                    const compProfile = generateStar(`${parent.role} Companion`, 0, null, true, pTFlux, pSFlux);
                    const compOrbit = parent.orbitID + 0.1;
                    compProfile.orbitID = compOrbit;
                    _log(`  [YES] Companion present for ${parent.role}: ${compProfile.name} at Orbit ${compOrbit}`);
                    stars.push(compProfile);
                } else {
                    _log(`  [NO] No companion for ${parent.role}.`);
                }
            });
        }
        return { stars, status };
    }

    /**
     * Returns the Habitable Zone orbit for a star.
     */
    function getStarHZ(star) {
        if (!star) return 3;
        const isImpossible = (['O', 'B', 'A'].includes(star.type) && star.size === 'VI') || (star.type === 'M' && star.size === 'IV');
        if (isImpossible) {
            _log(`Constraint Error: Spectral Type ${star.type} and Size ${star.size} is impossible. Forcing Size to V.`);
            star.size = 'V';
        }
        const typeMap = HZ_DATA[star.type] || HZ_DATA['G'];
        let hz = typeMap[star.size];
        if (hz === undefined) {
            _log(`[ERROR] Invalid Star: ${star.type}${star.size} has no HZ defined. Defaulting to Size V.`);
            hz = typeMap['V'] || 3;
        }
        return Math.max(0, Math.min(19, hz));
    }

    return {
        parseT5Stellar,
        generateT5StellarProfile,
        generateStar,
        determineStellarConstellation,
        getStarHZ
    };
}));
