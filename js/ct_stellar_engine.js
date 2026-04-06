// =====================================================================
// CLASSIC TRAVELLER: UNIFIED STELLAR ENGINE
// =====================================================================
// Single source of truth for all CT stellar generation:
//   - System Nature determination
//   - Primary Star generation (with astrophysical corrections)
//   - Companion Star generation (recursive, with inheritance)
//   - Manual override parsing
//
// Replaces duplicated logic in ct_bottomup_generator.js and
// ct_topdown_generator.js. Both generators will eventually call
// CT_StellarEngine.generateStars(params) instead of inline rolling.
// =====================================================================

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CT_StellarEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // =================================================================
    // DATA SHIELD — Resolve table references at call time
    // =================================================================
    // Tables live in constants.js (browser globals) or ct_constants.js
    // (Node require). We resolve lazily to tolerate script load order.

    function _table(name) {
        if (typeof window !== 'undefined' && window[name] !== undefined) return window[name];
        if (typeof global !== 'undefined' && global[name] !== undefined) return global[name];
        return null;
    }

    function natureTable()        { return _table('CT_BASIC_NATURE_TABLE')    || []; }
    function priTypeTable()       { return _table('CT_PRI_TYPE_TABLE')        || []; }
    function priSizeTable()       { return _table('CT_PRI_SIZE_TABLE')        || []; }
    function compTypeTable()      { return _table('CT_COMP_TYPE_TABLE')       || []; }
    function compSizeTable()      { return _table('CT_COMP_SIZE_TABLE')       || []; }
    function starMassLookup()     { return _table('STAR_MASS')                || {}; }
    function lumLookup()          { return _table('LUM')                      || {}; }
    function companionOrbitTbl()  { return _table('CT_COMPANION_ORBIT_TABLE') || {}; }
    function zoneTables()         { return _table('ZONE_TABLES')              || {}; }
    function maxOrbitsBaseTbl()   { return _table('CT_MAX_ORBITS_BASE')       || []; }
    function maxOrbitsModsTbl()   { return _table('CT_MAX_ORBITS_MODIFIERS')  || {}; }

    // =================================================================
    // INTERNAL HELPERS
    // =================================================================

    /**
     * Estimate stellar diameter via UniversalMath (if available).
     */
    function _stellarDiam(type, decimal, size) {
        if (typeof UniversalMath !== 'undefined' && UniversalMath.estimateStellarDiameter) {
            return UniversalMath.estimateStellarDiameter(type, decimal, size);
        }
        return 1.0;
    }

    /**
     * Look up a star's mass from the STAR_MASS table.
     */
    function _starMass(size, specKey) {
        const t = starMassLookup();
        return (t[size] && t[size][specKey]) || 1.0;
    }

    /**
     * Look up a star's luminosity from the LUM table.
     */
    function _starLum(size, specKey) {
        const t = lumLookup();
        return (t[size] && t[size][specKey]) || 1.0;
    }

    /**
     * Build the specKey (e.g. "G0", "K5") from type + decimal.
     */
    function _specKey(type, decimal) {
        return type + decimal;
    }

    /**
     * Log the 100-Diameter limit for a star (Sean Protocol).
     */
    function _log100D(diam) {
        const limit = (diam * 1392700 * 100) / 1000000;
        if (typeof tResult !== 'undefined') tResult('100D Limit', `${limit.toFixed(1)} M km`, 'CT 1.1: Stellar Generation');
    }

    // =================================================================
    // ASTROPHYSICAL CORRECTIONS
    // =================================================================
    // These are mandatory Book 6 reality checks that prevent
    // nonsensical spectral classifications from surviving generation.

    /**
     * Apply mandatory size corrections to a star classification.
     * Mutates the provided object's `size` field.
     *
     * Rules:
     *   - K5–M9 at Size IV → default to Size V
     *     (Sub-giants don't exist below ~F5 on the main sequence)
     *   - B0–F4 at Size VI → default to Size V
     *     (Sub-dwarfs don't exist above ~F5)
     *
     * @param {Object} star  - Must have { type, decimal, size }
     * @returns {boolean} true if a correction was applied
     */
    function applySizeCorrections(star) {
        let corrected = false;

        // Rule 1: K5–M9 cannot be Sub-Giants (IV)
        const isLateK = (star.type === 'K' && star.decimal >= 5);
        const isM     = (star.type === 'M');
        if ((isLateK || isM) && star.size === 'IV') {
            star.size = 'V';
            corrected = true;
            if (typeof tResult !== 'undefined') tResult('Correction', `${star.type}${star.decimal} IV → V (late-type sub-giant)`, 'CT 1.1: Astrophysical Corrections');
        }

        // Rule 2: B0–F4 cannot be Sub-Dwarfs (VI)
        const isHotStar   = ['B', 'A'].includes(star.type);
        const isEarlyF    = (star.type === 'F' && star.decimal <= 4);
        if ((isHotStar || isEarlyF) && star.size === 'VI') {
            star.size = 'V';
            corrected = true;
            if (typeof tResult !== 'undefined') tResult('Correction', `${star.type}${star.decimal} VI → V (hot sub-dwarf)`, 'CT 1.1: Astrophysical Corrections');
        }

        return corrected;
    }

    // =================================================================
    // MANUAL OVERRIDE PARSER
    // =================================================================

    /**
     * Parse a homestar string (e.g. "G2 V K5 V") into an array of
     * star objects. Handles spectral types B A F G K M, luminosity
     * classes Ia Ib II III IV V VI D BD, and numeric sub-types.
     *
     * @param {string} rawStr - Space-separated stellar classification(s)
     * @returns {Array<Object>} Array of { type, decimal, size, specKey, name, ... }
     */
    function parseManualStars(rawStr) {
        if (!rawStr || rawStr.trim() === '') return [];

        // Tokenize and recombine luminosity classes that follow type tokens
        const tokens = rawStr.trim().split(/\s+/);
        const starStrings = [];

        for (let i = 0; i < tokens.length; i++) {
            if (i > 0 && /^(Ia|Ib|II|III|IV|V|VI|VII|D|BD)$/i.test(tokens[i]) &&
                starStrings.length > 0 && !starStrings[starStrings.length - 1].includes(' ')) {
                starStrings[starStrings.length - 1] += ' ' + tokens[i];
            } else {
                starStrings.push(tokens[i]);
            }
        }

        return starStrings.map((str, idx) => {
            const parts = str.split(' ');
            const rawType = parts[0] || '';
            let sType   = rawType.length > 0 ? rawType[0] : 'M';
            let decimal = 0;
            let sClass  = parts[1] || 'V';

            // Special cases
            if (sType === 'D')      { sClass = 'D'; decimal = 0; }
            if (rawType === 'BD')   { sType = 'BD'; sClass = 'V'; decimal = 0; }

            // Extract numeric sub-type
            const subMatch = rawType.match(/\d/);
            if (subMatch && sType !== 'D' && sType !== 'BD') {
                decimal = parseInt(subMatch[0]);
            }

            const specKey = _specKey(sType, decimal);
            const name    = `${sType}${(sType !== 'D' && sType !== 'BD') ? decimal : ''} ${sClass}`;

            const star = {
                role:       idx === 0 ? 'Primary' : (idx === 1 ? 'Close' : (idx === 2 ? 'Near' : 'Far')),
                type:       sType,
                size:       sClass,
                decimal:    decimal,
                specKey:    specKey,
                name:       name,
                mass:       _starMass(sClass, specKey),
                luminosity: _starLum(sClass, specKey),
                diam:       _stellarDiam(sType, decimal, sClass),
                isOverride: true
            };

            return star;
        });
    }

    // =================================================================
    // PRIMARY STAR GENERATION
    // =================================================================

    /**
     * Generate a single primary star via dice rolls against the CT tables.
     *
     * @param {Object} params
     * @param {boolean} [params.forceSizeV=false] - Force Size V (used by
     *        Top-Down to guarantee a Habitable Zone exists). If true, the
     *        engine re-rolls until it gets a star whose zone table contains
     *        an 'H' entry.
     * @returns {Object} The primary star object.
     * @returns {number} .priTypeRoll  - The natural 2D6 type roll (used as
     *          companion DM).
     * @returns {number} .priSizeRoll  - The natural 2D6 size roll (used as
     *          companion DM).
     */
    function rollPrimary(params = {}) {
        const pType = priTypeTable();
        const pSize = priSizeTable();
        const zt    = zoneTables();

        if (params.forceSizeV) {
            // Top-Down mode: keep rolling until we hit a classification
            // whose zone table has at least one 'H' orbit.
            let attempts = 0;
            while (attempts < 50) {
                attempts++;
                const typeRoll    = tRoll2D('Primary Type Roll');
                const sizeRoll    = tRoll2D('Primary Size Roll');
                const decRoll     = tRoll1D('Primary Decimal Roll');
                const rawType     = pType[typeRoll];
                const rawSize     = pSize[sizeRoll];
                const decimal     = (decRoll <= 3 ? 0 : 5);
                const specKey     = _specKey(rawType, decimal);

                const zones = zt[rawSize] && zt[rawSize][specKey];
                if (zones && zones.includes('H')) {
                    const star = _buildStarObject('Primary', rawType, rawSize, decimal);
                    applySizeCorrections(star);
                    // Re-derive after possible correction
                    star.specKey    = _specKey(star.type, star.decimal);
                    star.name       = `${star.type}${star.decimal} ${star.size}`;
                    star.mass       = _starMass(star.size, star.specKey);
                    star.luminosity = _starLum(star.size, star.specKey);
                    star.diam       = _stellarDiam(star.type, star.decimal, star.size);

                    _logStar(star, 'Primary Selection');
                    return { star, priTypeRoll: typeRoll, priSizeRoll: sizeRoll };
                }
            }
            throw new Error('Could not roll a primary star with a Habitable Zone after 50 attempts.');
        }

        // Standard mode (Bottom-Up): single roll, accept as-is after corrections
        const typeRoll  = tRoll2D('Primary Type Roll');
        const sizeRoll  = tRoll2D('Primary Size Roll');
        const decRoll   = tRoll1D('Primary Decimal Roll');
        const rawType   = pType[typeRoll];
        const rawSize   = pSize[sizeRoll];
        const decimal   = (decRoll <= 3 ? 0 : 5);

        const star = _buildStarObject('Primary', rawType, rawSize, decimal);
        applySizeCorrections(star);

        // Re-derive after possible correction
        star.specKey    = _specKey(star.type, star.decimal);
        star.name       = `${star.type}${star.decimal} ${star.size}`;
        star.mass       = _starMass(star.size, star.specKey);
        star.luminosity = _starLum(star.size, star.specKey);
        star.diam       = _stellarDiam(star.type, star.decimal, star.size);

        _logStar(star, 'Primary Selection');
        return { star, priTypeRoll: typeRoll, priSizeRoll: sizeRoll };
    }

    // =================================================================
    // COMPANION STAR GENERATION (RECURSIVE)
    // =================================================================

    /**
     * Generate a single companion star.
     *
     * THE INHERITANCE FIX:
     * Book 6 companion generation adds the parent's *natural die rolls*
     * as DMs to the companion's type and size rolls. This means:
     *   - A Secondary inherits the Primary's rolls.
     *   - A Tertiary inherits the Primary's rolls.
     *   - A Far Sub-Companion inherits its *parent companion's* rolls
     *     (which are already DM-shifted), guaranteeing it trends cooler
     *     and smaller than its parent.
     *
     * @param {string} role             - 'Secondary', 'Tertiary', or 'Far Companion'
     * @param {number} parentTypeRoll   - Parent's natural 2D6 type roll (DM)
     * @param {number} parentSizeRoll   - Parent's natural 2D6 size roll (DM)
     * @returns {Object} The companion star object, plus its natural rolls.
     */
    function rollCompanion(role, parentTypeRoll, parentSizeRoll) {
        const cType = compTypeTable();
        const cSize = compSizeTable();

        if (typeof tSection !== 'undefined') tSection(`${role} Generation`);

        // Roll with inherited DMs from parent
        const rawTypeRoll = tRoll2D(`${role} Type Roll`);
        const rawSizeRoll = tRoll2D(`${role} Size Roll`);
        const decRoll     = tRoll1D(`${role} Decimal Roll`);

        // Apply parent DMs
        if (typeof tDM !== 'undefined') {
            tDM('Parent Type DM', parentTypeRoll);
            tDM('Parent Size DM', parentSizeRoll);
        }

        const compTypeRoll = rawTypeRoll + parentTypeRoll;
        const compSizeRoll = rawSizeRoll + parentSizeRoll;

        // Clamp to table bounds
        const typeIdx = Math.min(compTypeRoll, cType.length - 1);
        const sizeIdx = Math.min(compSizeRoll, cSize.length - 1);
        const decimal = (decRoll <= 3 ? 0 : 5);

        const rawType = cType[typeIdx];
        const rawSize = cSize[sizeIdx];

        const star = _buildStarObject(role, rawType, rawSize, decimal);
        applySizeCorrections(star);

        // Re-derive after possible correction
        star.specKey    = _specKey(star.type, star.decimal);
        star.name       = `${star.type}${star.decimal} ${star.size}`;
        star.mass       = _starMass(star.size, star.specKey);
        star.luminosity = _starLum(star.size, star.specKey);
        star.diam       = _stellarDiam(star.type, star.decimal, star.size);

        _logStar(star, `${role}`);

        return {
            star,
            // Expose raw (un-shifted) rolls so sub-companions inherit correctly
            compTypeRoll: rawTypeRoll,
            compSizeRoll: rawSizeRoll
        };
    }

    /**
     * Resolve a companion's orbit placement using the CT_COMPANION_ORBIT_TABLE.
     *
     * @param {Object}  companion    - The companion star object (mutated with orbit)
     * @param {boolean} isTertiary   - If true, apply +4 DM to orbit roll
     * @param {Object}  primaryStar  - The primary star (for zone lookups on orbit validation)
     * @returns {void}  Mutates companion.orbit and companion.distAU
     */
    function resolveCompanionOrbit(companion, isTertiary, primaryStar) {
        const orbitTable = companionOrbitTbl();
        const orbitDM    = isTertiary ? 4 : 0;
        const orbitRoll  = tRoll2D('Orbit Placement Roll') + orbitDM;

        let orbitResult = orbitTable[Math.min(orbitRoll, 12)];

        // Resolve dynamic orbit expressions like "4+1D"
        if (typeof orbitResult === 'string' && orbitResult.includes('+1D')) {
            const base = parseInt(orbitResult.split('+')[0]);
            orbitResult = base + tRoll1D('Numeric Orbit DM');
        }

        // Internal Orbit Exception: if orbit falls inside the star, default to Close
        if (typeof orbitResult === 'number' && primaryStar) {
            const zone = _getZoneForOrbit(primaryStar.size, primaryStar.specKey, orbitResult);
            if (zone === '-') {
                orbitResult = 'Close';
                if (typeof tResult !== 'undefined') tResult('Orbit Shift', 'Close (Internal Orbit)', 'CT 1.2: Companion Orbits');
            }
        }

        if (orbitResult === 'Far') {
            companion.orbit  = 'Far';
            companion.distAU = tRoll1D('Far Distance Roll') * 1000;
            if (typeof tResult !== 'undefined') tResult('Orbit', `Far (${companion.distAU} AU)`, 'CT 1.2: Companion Orbits');
        } else {
            companion.orbit = orbitResult;
            if (typeof tResult !== 'undefined') tResult('Orbit', orbitResult, 'CT 1.2: Companion Orbits');
        }
    }

    /**
     * Check if a Far companion has its own sub-companion (Binary nature check).
     * If so, recursively generate the sub-companion using the parent companion's
     * roll DMs (The Inheritance Fix).
     *
     * @param {Object} parentCompanion   - The Far companion star
     * @param {number} parentTypeRoll    - The parent's *raw* type roll
     * @param {number} parentSizeRoll    - The parent's *raw* size roll
     * @returns {void}  Mutates parentCompanion.subCompanion if applicable
     */
    function checkFarSubCompanion(parentCompanion, parentTypeRoll, parentSizeRoll) {
        const farNatureRoll = tRoll2D('Far Companion Nature Roll');
        const nature = natureTable();
        const farNature = nature[farNatureRoll] || 'Solo';

        if (farNature === 'Binary') {
            if (typeof tSection !== 'undefined') tSection('Far Sub-Companion Generation');

            // THE INHERITANCE FIX:
            // The sub-companion inherits the parent companion's roll DMs.
            // parentTypeRoll and parentSizeRoll here are the companion's
            // *raw* dice values, which become the DMs for this sub-companion.
            const result = rollCompanion('Far Sub-Companion', parentTypeRoll, parentSizeRoll);
            const subComp = result.star;

            // Sub-companion orbit (DM -4 per Book 6)
            const orbitTable = companionOrbitTbl();
            const subOrbitRoll = tRoll2D('Sub-Orbit Roll') - 4;
            let subOrbit = orbitTable[Math.max(0, Math.min(subOrbitRoll, 12))];

            if (typeof subOrbit === 'string' && subOrbit.includes('+1D')) {
                const base = parseInt(subOrbit.split('+')[0]);
                subOrbit = base + tRoll1D('Sub-Numeric Orbit DM');
            }
            subComp.orbit = subOrbit;
            _rollMaxOrbits(subComp); // rolls, applies DMs, then clamps to floor(orbit/2)

            parentCompanion.subCompanion = subComp;
            if (typeof tResult !== 'undefined') {
                tResult('Far Sub-Companion', subComp.name, 'CT 1.2: Binary/Multiple Stars');
                tResult('Far Sub-Orbit', subComp.orbit, 'CT 1.2: Binary/Multiple Stars');
            }
        }
    }

    // =================================================================
    // MAIN PUBLIC API
    // =================================================================

    /**
     * Generate the complete stellar configuration for a CT system.
     *
     * @param {Object} params
     * @param {boolean} [params.forceSizeV=false]
     *        If true, re-roll primary until it has a Habitable Zone.
     *        Used by Top-Down generator to guarantee HZ placement.
     *
     * @param {string}  [params.manualOverrides=null]
     *        A homestar string (e.g. "G2 V M0 V"). If provided, the
     *        engine parses these instead of rolling. Useful when the
     *        user has pre-specified stars in their sector data.
     *
     * @returns {Object} result
     * @returns {string}        result.nature  - 'Solo', 'Binary', or 'Trinary'
     * @returns {Array<Object>} result.stars   - Array of star objects
     *   Each star: { role, type, size, decimal, specKey, name, mass,
     *                luminosity, diam, orbit?, distAU?, subCompanion? }
     */
    function generateStars(params = {}) {
        if (typeof tSection !== 'undefined') tSection('Stellar Generation');

        // ─── MANUAL OVERRIDE PATH ───────────────────────────────────
        if (params.manualOverrides && params.manualOverrides.trim() !== '') {
            const overrideStars = parseManualStars(params.manualOverrides);

            if (overrideStars.length > 0) {
                // Log override stars
                overrideStars.forEach(star => {
                    _logStar(star, `${star.role} Override`);
                });

                // Determine nature from star count
                let nature = 'Solo';
                if (overrideStars.length === 2) nature = 'Binary';
                if (overrideStars.length >= 3)  nature = 'Trinary';

                if (typeof tResult !== 'undefined') tResult('System Nature', nature + ' (Override)', 'CT 1.1: System Nature');

                return {
                    nature: nature,
                    stars: overrideStars
                };
            }
        }

        // ─── ROLLED GENERATION PATH ─────────────────────────────────

        const stars = [];

        // 1. System Nature
        const natureRoll = tRoll2D('System Nature Roll');
        const nature = natureTable()[natureRoll] || 'Solo';
        if (typeof tResult !== 'undefined') tResult('System Nature', nature, 'CT 1.1: System Nature');

        // 2. Primary Star
        const primaryResult = rollPrimary({
            forceSizeV: params.forceSizeV || false
        });
        const primary = primaryResult.star;
        _rollMaxOrbits(primary);
        stars.push(primary);

        // 3. Companion Stars
        if (nature === 'Binary' || nature === 'Trinary') {
            const companionsToGen = (nature === 'Trinary' ? 2 : 1);

            for (let i = 0; i < companionsToGen; i++) {
                const role = (i === 0) ? 'Secondary' : 'Tertiary';

                // THE INHERITANCE FIX:
                // Companions inherit the Primary's natural die rolls as DMs.
                const compResult = rollCompanion(
                    role,
                    primaryResult.priTypeRoll,
                    primaryResult.priSizeRoll
                );
                const companion = compResult.star;

                // Orbit Placement (must happen before maxOrbits roll so the limit can be applied)
                resolveCompanionOrbit(companion, (i === 1), primary);
                _rollMaxOrbits(companion); // rolls, applies DMs, then clamps to floor(orbit/2)

                // Far Exception: check for sub-companion
                if (companion.orbit === 'Far') {
                    checkFarSubCompanion(
                        companion,
                        compResult.compTypeRoll,
                        compResult.compSizeRoll
                    );
                }

                stars.push(companion);
            }
        }

        return {
            nature: nature,
            stars:  stars
        };
    }

    // =================================================================
    // INTERNAL BUILDERS
    // =================================================================

    /**
     * Build a minimal star object from raw components.
     * Does NOT apply corrections — caller must do that.
     */
    function _buildStarObject(role, type, size, decimal) {
        const specKey = _specKey(type, decimal);
        return {
            role:       role,
            type:       type,
            size:       size,
            decimal:    decimal,
            specKey:    specKey,
            name:       `${type}${decimal} ${size}`,
            mass:       _starMass(size, specKey),
            luminosity: _starLum(size, specKey),
            diam:       _stellarDiam(type, decimal, size)
        };
    }

    /**
     * Standard star logging (Sean Protocol).
     */
    function _logStar(star, label) {
        if (typeof tResult === 'undefined') return;
        tResult(label, `${star.name} (${star.specKey})`, 'CT 1.1: Stellar Generation');
        tResult(`${star.role} Diameter`, `${star.diam} Solar`, 'CT 1.1: Stellar Generation');
        _log100D(star.diam);
    }

    /**
     * Roll and assign maxOrbits for a star, then apply the Book 6 companion
     * subsystem limit (floor(orbit/2)) if the star is not the Primary.
     */
    function _rollMaxOrbits(star) {
        const base = maxOrbitsBaseTbl();
        const mods = maxOrbitsModsTbl();

        const roll = tRoll2D('Max Orbits Roll');
        let max = base[roll] || 0;

        const sizeDM = (mods.SIZES && mods.SIZES[star.size]) || 0;
        const typeDM = (mods.TYPES && mods.TYPES[star.type]) || 0;
        if (sizeDM && typeof tDM !== 'undefined') tDM(`Size ${star.size}`, sizeDM);
        if (typeDM && typeof tDM !== 'undefined') tDM(`Type ${star.type}`, typeDM);

        max = Math.max(0, max + sizeDM + typeDM);

        // Book 6: companions may not exceed floor(orbit / 2)
        if (star.role !== 'Primary' && typeof star.orbit === 'number') {
            const limit = Math.floor(star.orbit / 2);
            if (max > limit) {
                max = limit;
                if (typeof tResult !== 'undefined') tResult(`${star.role} Orbit Limit`, max, 'CT 1.1: Orbital Configuration');
            }
        }

        star.maxOrbits = max;
        if (typeof tResult !== 'undefined') tResult('Max Orbits', max, 'CT 1.1: Orbital Configuration');
    }

    /**
     * Zone lookup helper (duplicated from bottomup for self-containment).
     * Will be consolidated when orbital logic is unified.
     */
    function _getZoneForOrbit(size, spectralKey, orbitNum) {
        const zt = zoneTables();
        const table = zt[size];
        if (!table) return 'O';
        const zoneList = table[spectralKey] || table.default || [];
        if (orbitNum < 0) return '-';
        if (orbitNum >= zoneList.length) return 'O';
        return zoneList[orbitNum] || 'O';
    }

    // =================================================================
    // PUBLIC INTERFACE
    // =================================================================

    /**
     * Book 6 Failsafe: creates a new outer-zone orbit when no eligible slot
     * remains for a required gas giant. Mutates sysOrbits in place and returns
     * the new orbit object so the caller can use it immediately.
     *
     * @param {Array} sysOrbits - sys.orbits array (objects with .orbit property).
     * @returns {Object} The new orbit slot { orbit, zone, contents }.
     */
    function spawnFailsafeOrbit(sysOrbits) {
        const newNumber = sysOrbits.length > 0
            ? Math.max(...sysOrbits.map(o => o.orbit)) + 1
            : 0;
        const slot = { orbit: newNumber, zone: 'O', contents: null };
        sysOrbits.push(slot);
        if (typeof tResult !== 'undefined') {
            tResult('Failsafe Orbit Created', 'Orbit ' + newNumber + ' added for Gas Giant', 'CT 1.3: Zone Classification');
        }
        return slot;
    }

    /**
     * Resolves skeleton anomalies (Empty Orbits + Captured Planets) against
     * companion destruction rules. Called by both generators so the logic is
     * never duplicated.
     *
     * @param {Object} skeleton  - Output of rollSystemSkeleton (emptyOrbits, capturedPlanets).
     * @param {Array}  stars     - Full sys.stars array.
     * @returns {{ emptyOrbits: Array, capturedPlanets: Array }}
     *   emptyOrbits     — each entry: { orbit, type: 'Empty' | 'Ghost Empty' }
     *   capturedPlanets — each entry: original cap object + { type: 'Captured' }
     */
    function resolveAnomalies(skeleton, stars) {
        const emptyOrbits = (skeleton.emptyOrbits || []).map(orbit => {
            const valid = isOrbitValid(orbit, stars);
            if (typeof tResult !== 'undefined') {
                tResult(`Empty Orbit ${orbit}`, valid ? 'Empty' : 'Ghost Empty (destroyed)', 'CT 1.3: Orbital Allocation');
            }
            return { orbit, type: valid ? 'Empty' : 'Ghost Empty' };
        });

        const capturedPlanets = (skeleton.capturedPlanets || []).map(cap => ({
            ...cap,
            type: 'Captured'   // always preserved — captured planets ignore destruction rules
        }));

        return { emptyOrbits, capturedPlanets };
    }

    /**
     * Book 6 orbital validity check.
     * Returns true if orbitNumber survives the inner/outer destruction rules
     * for every non-Primary star that has a numeric orbit.
     *
     * @param {number} orbitNumber  - The candidate orbit to test.
     * @param {Array}  stars        - Full sys.stars array.
     */
    function isOrbitValid(orbitNumber, stars) {
        for (const star of stars) {
            if (star.role === 'Primary') continue;
            if (typeof star.orbit !== 'number') continue;

            if (orbitNumber === star.orbit) continue; // companion's own slot — always valid

            if (orbitNumber < star.orbit) {
                // Inner Rule: valid only if <= floor(orbit / 2)
                if (orbitNumber > Math.floor(star.orbit / 2)) return false;
            } else {
                // Outer Rule: valid only if >= orbit + 2
                if (orbitNumber < star.orbit + 2) return false;
            }
        }
        return true;
    }

    return {
        generateStars,
        rollPrimary,
        rollCompanion,
        resolveCompanionOrbit,
        checkFarSubCompanion,
        parseManualStars,
        applySizeCorrections,
        isOrbitValid,
        resolveAnomalies,
        spawnFailsafeOrbit
    };

}));
