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
    const _tSection = (typeof tSection === 'function') ? tSection : () => { };
    const _tResult = (typeof tResult === 'function') ? tResult : (label, value, source) => { };

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
            _tResult('Imported Stellar', importedName, 'T5 1.1: Stellar Generation');
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
        _tResult('Luminosity', luminosity.toFixed(3) + ' L_Sol', 'T5 1.1: Stellar Generation');

        // NEW: Calculate the physical diameter using the Universal Math Chassis
        let diam = UniversalMath.estimateStellarDiameter(type, decimal, size);
        _tResult('Diameter', diam + ' Solar', 'T5 1.1: Stellar Generation');
        const limit100D = (diam * 1392700 * 100) / 1000000;
        _tResult("100D Limit", `${limit100D.toFixed(1)} M km`, 'T5 1.1: Stellar Generation');

        let starName = (size === 'D') ? 'D' : (type === 'BD') ? 'BD' : `${type}${decimal} ${size}`;
        _tResult('Final Stellar', starName, 'T5 1.1: Stellar Generation');

        return {
            type, size, decimal, orbitID,
            distAU: ORBIT_AU[orbitID] || 0,
            role, luminosity,
            diam, // <-- ADDED: Now available for Stellar Masking!
            name: starName, tFlux, sFlux
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

    /**
     * Calculates maximum subsystem capacity and orbit masking (engulfment)
     * per Traveller 5 RAW (Topic 1.2).
     */
    function calculateOrbitalConstraints(sys) {
        _tSection('Stellar Orbital Constraints (Topic 1.2)');
        
        sys.stars.forEach(star => {
            star.maskedOrbits = [];
            star.maxOrbit = 20; // Default max T5 orbit
            
            // 1. Stellar Engulfment (Masking via Chart 5a / T5_PRECLUDED_ORBITS)
            let surfaceOrbit = -1; 
            
            if (['Ia', 'Ib', 'II', 'III'].includes(star.size)) {
                const sizeData = T5_Data.T5_PRECLUDED_ORBITS[star.size];
                if (sizeData) {
                    // Find matching spectral range
                    for (const [rangeKey, orbitVal] of Object.entries(sizeData)) {
                        const [startStr, endStr] = rangeKey.split('_');
                        const startType = startStr[0];
                        const startDec = parseInt(startStr.slice(1)) || 0;
                        const endType = endStr ? endStr[0] : startType;
                        const endDec = endStr ? (parseInt(endStr.slice(1)) || 0) : startDec;

                        const types = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
                        const starIdx = types.indexOf(star.type);
                        const startIdx = types.indexOf(startType);
                        const endIdx = types.indexOf(endType);

                        // Normalize to a 0-69 scale for easy range checking (e.g., G2 -> 4*10 + 2 = 42)
                        const starScore = starIdx * 10 + star.decimal;
                        const startScore = startIdx * 10 + startDec;
                        const endScore = endIdx * 10 + endDec;

                        if (starScore >= startScore && starScore <= endScore) {
                            surfaceOrbit = orbitVal;
                            break;
                        }
                    }
                }
            }

            if (surfaceOrbit >= 0) {
                for (let i = 0; i <= surfaceOrbit; i++) {
                    star.maskedOrbits.push(i);
                }
                _tResult(`${star.name} Engulfment`, `Masked Orbits 0 to ${surfaceOrbit} (Chart 5a)`, 'T5 1.2: Orbital Constraints');
            } else if (['IV', 'V', 'VI', 'D', 'BD'].includes(star.size) || star.type === 'BD') {
                _tResult(`${star.name} Engulfment`, `No standard orbits blocked (Size ${star.size})`, 'T5 1.2: Orbital Constraints');
            }

            // 2. Subsystem Limit (Secondary Stars)
            if (star.role !== 'Primary' && star.orbitID > 0) {
                star.maxOrbit = Math.max(0, Math.floor(star.orbitID) - 3);
                _tResult(`${star.name} Subsystem Limit`, `Max Orbit: ${star.maxOrbit} (Orbit ${Math.floor(star.orbitID)} - 3)`, 'T5 1.2: Orbital Constraints');
                
                if (star.maxOrbit <= 0) {
                    _tResult(`${star.name} Capacity`, `Too close to primary to host planetary subsystem.`, 'T5 1.2: Orbital Constraints');
                }
            }
        });
        
        return sys;
    }

    /**
     * UTILITY: T5 SYSTEM WALKER (Recursive state discovery)
     */
    function walkT5System(sys, callback) {
        if (!sys || !sys.stars) return;
        
        const processBody = (body) => {
            if (!body) return;
            callback(body);
            if (body.satellites && body.satellites.length > 0) {
                body.satellites.forEach(sat => processBody(sat));
            }
        };

        sys.stars.forEach(star => {
            callback(star);
            if (star.orbits) {
                star.orbits.forEach(o => {
                    if (o.contents) processBody(o.contents);
                });
            }
        });
    }

    /**
     * ACTION 6.4: Log a single T5 body's complete physical + social biography
     * in one contiguous trace block.
     */
    function logT5BodyBiography(body) {
        if (!body || body.type === 'Empty' || body.role === 'Empty') return;
        
        const name = body.name || body.role || 'Unnamed Body';
        // Distinguish between stars and worlds
        const isStar = body.decimal !== undefined && body.size && !body.uwp;
        const typeStr = isStar ? "Stellar Orbit" : (body.type || 'World');

        _tSection(`Biography: ${name} [${typeStr}]`);
        
        // --- PHYSICAL PROFILE ---
        if (isStar) {
            if (body.luminosity !== undefined) _tResult('Luminosity', body.luminosity.toFixed(3) + ' L_Sol', 'T5 1.1: Stellar Generation');
            if (body.diam !== undefined) _tResult('Diameter', body.diam.toFixed(2) + ' Solar', 'T5 1.1: Stellar Generation');
        } else {
            if (body.orbitID !== undefined) _tResult('Orbit', body.orbitID.toFixed(2), 'T5 1.3: Orbit Allocation');
            if (body.distAU !== undefined) _tResult('Distance (AU)', body.distAU.toFixed(3), 'T5 2.1: Physical Foundations');
            
            if (body.size !== undefined) _tResult('Size', body.size, 'T5 2.1: Physical Foundations');
            if (body.gravity !== undefined) _tResult('Gravity', body.gravity.toFixed(2) + "g", 'T5 2.1: Physical Foundations');
            if (body.atm !== undefined) _tResult('Atmosphere', body.atm, 'T5 2.2: Atmospherics');
            if (body.hydro !== undefined) _tResult('Hydrographics', body.hydro, 'T5 2.3: Hydrographics');
            
            if (body.climateZone) _tResult('Climate Zone', body.climateZone, 'T5 2.1: Physical Foundations');
        }

        // --- SOCIAL PROFILE ---
        if (body.uwp) {
            _tResult('UWP String', body.uwp, 'T5 3.1: Social Finalization');
        }
        if (body.starport) _tResult('Starport', body.starport, 'T5 4.1: Starports & Bases');
        if (body.pop !== undefined) _tResult('Population', body.pop, 'T5 3.1: Core Social');
        if (body.gov !== undefined) _tResult('Government', body.gov, 'T5 3.1: Core Social');
        if (body.law !== undefined) _tResult('Law Level', body.law, 'T5 3.1: Core Social');
        if (body.tl !== undefined) _tResult('Tech Level', body.tl, 'T5 3.2: Tech Level & Environment');
        
        if (body.tradeCodes && body.tradeCodes.length > 0) {
            _tResult('Trade Codes', body.tradeCodes.join(' '), 'T5 3.1: Social Finalization');
        }

        // --- STATUS FLAGS ---
        if (body.orbitLetter) _tResult('Satellite Orbit', body.orbitLetter, 'T5 1.3: Orbit Allocation');
        if (body.parentBody) _tResult('Parentage', `${body.parentBody} Satellite`, 'T5 1.3: Orbit Allocation');
    }

    return {
        parseT5Stellar,
        generateT5StellarProfile,
        generateStar,
        determineStellarConstellation,
        getStarHZ,
        calculateOrbitalConstraints,
        walkT5System,
        logT5BodyBiography
    };
}));
