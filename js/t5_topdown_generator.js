/**
 * js/t5_topdown_generator.js
 * 
 * T5 SYSTEM GENERATOR (v2.0 Modular Architecture)
 * Orchestrates Top-Down generation for Traveller 5 systems.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math', './t5_data'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'), require('./t5_data'), require('./t5_world_engine'));
    } else {
        root.T5_TopDown_Generator = factory(root.UniversalMath, root.T5_Data, root.T5_World_Engine);
    }
}(this, function (UniversalMath, T5_Data, T5_World_Engine) {
    const { toUWPChar, fromUWPChar, clampUWP, rollFlux } = UniversalMath;

    // --- Internal Helpers & Tables (Drawn from T5 Logic) ---
    // Note: Uses global rng/roll functions if available (e.g., from core.js), otherwise fallbacks.
    const _rng = (typeof rng === 'function') ? rng : Math.random;
    const _roll1D = (typeof roll1D === 'function') ? roll1D : () => Math.floor(_rng() * 6) + 1;
    const _roll2D = (typeof roll2D === 'function') ? roll2D : () => _roll1D() + _roll1D();
    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;

    const HZ_DATA = {
        'O': { 'Ia': 15, 'Ib': 15, 'II': 14, 'III': 13, 'IV': 12, 'V': 11, 'D': 1 },
        'B': { 'Ia': 13, 'Ib': 13, 'II': 12, 'III': 11, 'IV': 10, 'V': 9, 'D': 0 },
        'A': { 'Ia': 12, 'Ib': 11, 'II': 9, 'III': 7, 'IV': 7, 'V': 7, 'D': 0 },
        'F': { 'Ia': 11, 'Ib': 10, 'II': 9, 'III': 6, 'IV': 6, 'V': 4, 'VI': 3, 'D': 0 },
        'G': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 7, 'IV': 5, 'V': 3, 'VI': 2, 'D': 0 },
        'K': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 8, 'IV': 5, 'V': 2, 'VI': 1, 'D': 0 },
        'M': { 'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'V': 0, 'VI': 0, 'D': 0 }
    };

    /**
     * Determines the Habitable Zone (HZ) orbit for a star based on Spectral Type and Size.
     */
    function getStarHZ(star) {
        if (!star) return 3;
        const type = (star.type || 'G').charAt(0).toUpperCase();
        const size = star.size || 'V';
        const typeMap = HZ_DATA[type] || HZ_DATA['G'];
        let hz = typeMap[size];
        if (hz === undefined) hz = typeMap['V'] || 3;
        return clampUWP(hz, 0, 19);
    }

    /**
     * T5 ORBIT LABEL HELPER
     * Returns a combined label consisting of [Positional / Climate]
     * per Traveller 5 RAW requirements.
     */
    function getT5OrbitLabel(orbit, hzOrbit) {
        let positional = "";
        if (orbit <= hzOrbit - 2) positional = "Inner";
        else if (orbit >= hzOrbit - 1 && orbit <= hzOrbit + 1) positional = "Hospitable";
        else if (orbit >= hzOrbit + 2) positional = "Outer";

        let climate = "";
        // Special Orbit Labels: 0 or 1 get Twilight Zone (Tz)
        if (orbit === 0 || orbit === 1) {
            climate = "Tz";
        } else {
            if (orbit <= hzOrbit - 1) climate = "Hot / Tropic";
            else if (orbit === hzOrbit) climate = "Temperate";
            else if (orbit >= hzOrbit + 1 && orbit <= hzOrbit + 5) climate = "Cold / Tundra";
            else if (orbit >= hzOrbit + 6) climate = "Frozen";
        }

        if (positional && climate) return `${positional} / ${climate}`;
        return positional || climate || "None";
    }

    /**
     * Generates HZ Variance and Climate based on Spectral Type (T5 Table 2B).
     */
    function generateHZAndClimate(spectralType) {
        let hzFlux = rollFlux();
        let dm = 0;
        const type = (spectralType || 'G').charAt(0).toUpperCase();
        if (type === 'M') dm = 2;
        if (type === 'O' || type === 'B') dm = -2;
        
        hzFlux = clampUWP(hzFlux + dm, -6, 6);

        let hzVariance = 0, climate = '', tradeCode = '';
        if (hzFlux === -6) { 
            hzVariance = -2; 
        } else if (hzFlux <= -3) { 
            hzVariance = -1; climate = 'Hot / Tropic'; tradeCode = 'Tr'; 
        } else if (hzFlux <= 2) { 
            hzVariance = 0; climate = 'Temperate'; 
        } else if (hzFlux <= 5) { 
            hzVariance = 1; climate = 'Cold / Tundra'; tradeCode = 'Tu'; 
        } else { 
            hzVariance = 2; climate = 'Frozen'; tradeCode = 'Fr'; 
        }

        return { hzVariance, climate, tradeCode };
    }

    /**
     * Generates Gas Giant Type and Size (T5 Mapping).
     */
    function generateGasGiantStats() {
        let roll = _roll2D();
        let size, type;
        if (roll === 2 || roll === 3) { 
            size = (roll === 2 ? 'M' : 'N'); 
            type = 'Small Gas Giant'; 
        } else {
            type = 'Large Gas Giant';
            const chars = "PQRS TUVWX"; // Mapping for 2D rolls 4-12
            size = chars[roll - 4] || 'S';
        }
        return { size, type };
    }

    /**
     * Finds the closest available orbital slot in a star's private subsystem.
     * Handles Preclusion (Surface Orbit) and Duplication (Occupied Slots).
     */
    function findAvailableOrbit(star, target) {
        const specs = T5_Data.T5_PRECLUDED_ORBITS;
        let surfaceOrbit = -1;

        // 1. Determine Surface Orbit (Preclusion)
        if (star.size && specs[star.size]) {
            const type = star.type ? star.type.charAt(0) : 'G';
            const decimal = star.decimal || 0;
            const sizeMap = specs[star.size];

            // Mapping for O/B stars to A0 values
            const lookupType = (['O', 'B'].includes(type) ? 'A' : type);

            // Find the correct key in the size mapping (e.g., "A0_F5")
            for (const range in sizeMap) {
                if (range === 'LOGIC') continue;
                // Simple parser for ranges like "A0_F5"
                const [start, end] = range.split('_');
                const startType = start.charAt(0);
                const startDec = parseInt(start.slice(1)) || 0;
                const endType = end.charAt(0);
                const endDec = parseInt(end.slice(1)) || 0;

                const starWeight = (lookupType.charCodeAt(0) * 10) + decimal;
                const startWeight = (startType.charCodeAt(0) * 10) + startDec;
                const endWeight = (endType.charCodeAt(0) * 10) + endDec;

                if (starWeight >= startWeight && starWeight <= endWeight) {
                    surfaceOrbit = sizeMap[range];
                    break;
                }
            }
        }

        const preclusionLimit = surfaceOrbit; // Orbits 0 to surfaceOrbit are blocked

        // 2. Adjustment Loop (Closest possible >= surfaceOrbit + 1)
        const check = (o) => (o >= 0 && o < 20 && o > preclusionLimit && !star.orbits[o].contents);

        if (check(target)) return target;

        for (let d = 1; d < 20; d++) {
            let above = target + d;
            let below = target - d;
            if (check(above)) return above;
            if (check(below)) return below;
        }

        return -1;
    }

    // --- PIPELINE IMPLEMENTATION ---

    /**
     * Main T5 Top-Down Generation Orchestrator.
     * Executes the 4-Phase pipeline for system generation.
     */
    function generateT5System(mainworldBase) {
        if (!mainworldBase) throw new Error("Sean Protocol Violation: Phase 1 requires mainworldBase.");

        // Break potential circularity by deep-cloning the stars for the orbital structure
        const sysStars = mainworldBase.stars ? JSON.parse(JSON.stringify(mainworldBase.stars)) : [{ type: 'G', decimal: 2, size: 'V', name: 'Primary' }];

        const sys = {
            mainworld: { ...mainworldBase, type: 'Mainworld' },
            stars: sysStars,
            sggCount: 0
        };

        // Initialize Independent Subsystems for each star
        sys.stars.forEach(star => {
            star.orbits = [];
            for (let i = 0; i < 20; i++) {
                star.orbits.push({ orbit: i, distAU: T5_Data.ORBIT_AU[i], contents: null });
            }
        });

        const primary = sys.stars[0];
        const hzOrbit = getStarHZ(primary);
        const hzResult = generateHZAndClimate(primary.type);

        // PHASE 1: The Anchor (Mainworld)
        let mwTarget = clampUWP(hzOrbit + hzResult.hzVariance, 0, 19);
        sys.mainworld.climateZone = hzResult.climate;
        if (hzResult.tradeCode) {
            if (!sys.mainworld.tradeCodes) sys.mainworld.tradeCodes = [];
            if (!sys.mainworld.tradeCodes.includes(hzResult.tradeCode)) sys.mainworld.tradeCodes.push(hzResult.tradeCode);
        }

        // Injection Constraint: If MW is Satellite, inject parent
        const isSatellite = sys.mainworld.worldType && sys.mainworld.worldType.includes('Satellite');
        if (isSatellite) {
            const ggStats = generateGasGiantStats();
            let parent;
            if (sys.mainworld.parentBody === 'Gas Giant') {
                parent = { ...ggStats, type: ggStats.type, satellites: [sys.mainworld] };
            } else {
                parent = { 
                    type: 'BigWorld', 
                    worldType: 'BigWorld', 
                    size: _roll2D() + 7, 
                    satellites: [sys.mainworld] 
                };
            }
            mwTarget = findAvailableOrbit(primary, mwTarget);
            if (mwTarget >= 0) primary.orbits[mwTarget].contents = parent;
        } else {
            // Mainworld as standalone planet (or belt)
            if (sys.mainworld.size === 0) sys.mainworld.worldType = 'Belt';
            mwTarget = findAvailableOrbit(primary, mwTarget);
            if (mwTarget >= 0) primary.orbits[mwTarget].contents = sys.mainworld;
        }

        // PHASE 2: System Inventory
        const ggCountTotal = Math.max(0, Math.floor(_roll2D() / 2) - 2);
        const beltCountTotal = Math.max(0, _roll1D() - 3);

        // --- NEW: Bases and GG flag for Mainworld ---
        if (T5_World_Engine && T5_World_Engine.generateT5Bases) {
            T5_World_Engine.generateT5Bases(sys.mainworld);
        }
        sys.mainworld.gasGiantsCount = ggCountTotal;
        sys.mainworld.gasGiant = ggCountTotal > 0;
        const roll2D = _roll2D();
        const otherTerrTotal = roll2D; // Inventory = MW + GG + Belt + 2D. "Other" is the 2D roll.

        // Shared helper for Rotating Placement
        function placeCategory(category, count, targetStars, placementLogic) {
            let starIdx = 0;
            for (let i = 0; i < count; i++) {
                const hostStar = targetStars[starIdx];
                const hostHZ = getStarHZ(hostStar);
                
                // Maximum orbit for secondary stars: Primary Orbit - 3
                const maxOrbitLimit = (hostStar === primary) ? 19 : Math.max(0, hostStar.orbitID - 3);

                const targetOrbit = placementLogic(hostHZ, i === count - 1);
                const resolved = findAvailableOrbit(hostStar, targetOrbit);

                if (resolved >= 0 && resolved <= maxOrbitLimit) {
                    const body = createBodyPlaceholder(category);
                    hostStar.orbits[resolved].contents = body;
                }
                
                starIdx = (starIdx + 1) % targetStars.length;
            }
        }

        function createBodyPlaceholder(category) {
            if (category === 'GG') {
                const stats = generateGasGiantStats();
                return { type: stats.type, size: stats.size };
            } else if (category === 'BELT') {
                return { type: 'Planetoid Belt', size: 0, worldType: 'Belt' };
            } else {
                return { type: 'Terrestrial World' };
            }
        }

        // PHASE 3: Place Gas Giants
        placeCategory('GG', ggCountTotal, sys.stars, (hz, isFinal) => {
            const roll = _roll2D();
            const stats = generateGasGiantStats(); // We need a temp roll for type to use correct formula
            if (stats.type === 'Large Gas Giant') return clampUWP(hz + (roll - 5), 0, 19);
            if (stats.type === 'Small Gas Giant') return clampUWP(hz + (roll - 4), 0, 19);
            return clampUWP(hz + (roll - 1), 0, 19); // Ice Giant
        });

        // PHASE 4: Place Belts (Reset Rotation)
        placeCategory('BELT', beltCountTotal, sys.stars, (hz) => clampUWP(hz + (_roll2D() - 3), 0, 19));

        // PHASE 5: Place Other Worlds (Reset Rotation)
        placeCategory('WORLD', otherTerrTotal, sys.stars, (hz, isFinal) => {
            const roll = _roll2D();
            if (isFinal) return clampUWP(19 - roll, 0, 19);
            const arrayIndex = clampUWP(roll - 2, 0, 10);
            return T5_Data.P2_PLACEMENT_CHART.WORLD1[arrayIndex];
        });

        // PHASE 6: Fleshing and Audit
        fleshOutSubordinates(sys);

        return sys;
    }

    /**
     * Generates subordinate satellites (moons) for a body.
     * Uses 2D-2 for Gas Giants, 1D-3 for Terrestrial.
     */
    function generateT5Satellites(parent, orbit, hostHZ, maxSubPop) {
        if (!parent || parent.type === 'Empty' || parent.worldType === 'Belt') return;

        const isGG = (parent.type && (parent.type.includes('Gas Giant') || parent.type === 'Ice Giant'));
        const moonCount = isGG ? Math.max(0, _roll2D() - 2) : Math.max(0, _roll1D() - 3);

        if (!parent.satellites) parent.satellites = [];
        const startIdx = parent.satellites.length;

        if (moonCount > startIdx) {
            _log(`Satellite Generation: Body in Orbit ${orbit} rolling for ${moonCount} satellites (already has ${startIdx}).`);
        }

        for (let i = startIdx; i < moonCount; i++) {
            const moon = { type: 'Moon', parentBody: (isGG ? 'Gas Giant' : 'Planet') };
            generateT5SubordinateUWP(moon, orbit, hostHZ, maxSubPop, true);

            // T5 RAW physics constraint: Moon must be smaller than Parent.
            // Normalize alpha sizes for comparison (e.g., GG Size M = 22).
            let pSize = parent.size;
            if (isGG) {
                pSize = (typeof parent.size === 'string') ? fromUWPChar(parent.size) : parent.size;
            }
            
            if (pSize !== undefined && moon.size >= pSize) {
                _log(`Physics Constraint: Moon size ${moon.size} >= Parent size ${pSize}. Clamping Moon to ${Math.max(0, pSize - 1)}.`);
                moon.size = Math.max(0, pSize - 1);

                // If size is clamped to < 2, we must fix classification and hydrographics to maintain audit integrity
                if (moon.size < 2) {
                    if (moon.size === 0 && ['Hospitable', 'InnerWorld', 'IceWorld', 'StormWorld', 'RadWorld', 'BigWorld'].includes(moon.worldType)) {
                        _log(`Classification Adjustment: ${moon.worldType} size 0 must be Worldlet.`);
                        moon.worldType = 'Worldlet';
                    }
                    if (moon.hydro > 0) {
                        _log(`Hydro Adjustment: Size ${moon.size} world cannot have Hydro ${toUWPChar(moon.hydro)}. Resetting to 0.`);
                        moon.hydro = 0;
                    }
                    if (moon.size === 0 && moon.atm > 0 && moon.worldType !== 'Inferno') {
                        _log(`Atmosphere Adjustment: Size 0 non-inferno cannot have Atm ${toUWPChar(moon.atm)}. Resetting to 0.`);
                        moon.atm = 0;
                    }
                }

                // Re-build UWP string with new size and adjusted stats
                moon.uwp = `${moon.starport}${toUWPChar(moon.size)}${toUWPChar(moon.atm)}${toUWPChar(moon.hydro)}${toUWPChar(moon.pop)}${toUWPChar(moon.gov)}${toUWPChar(moon.law)}-${toUWPChar(moon.tl)}`;
                moon.uwpSecondary = moon.uwp;
            }

            parent.satellites.push(moon);
        }
    }

    /**
     * Iterates through all stars and their orbits to generate UWP data.
     */
    function fleshOutSubordinates(sys) {
        const mwPop = sys.mainworld.pop || 0;
        const maxSubPop = Math.max(0, mwPop - 1);

        sys.stars.forEach(star => {
            const hostHZ = getStarHZ(star);
            star.orbits.forEach(o => {
                const body = o.contents;
                if (!body || body.type === 'Empty') return;

                // Apply Full T5 Orbit Labeling (Positional + Climate)
                body.climateZone = getT5OrbitLabel(o.orbit, hostHZ);

                // 1. Flesh out the parent body (MUST HAPPEN BEFORE SATELLITES for size context)
                if (body !== sys.mainworld) {
                    generateT5SubordinateUWP(body, o.orbit, hostHZ, maxSubPop, false);
                } else {
                    // Final physical stats for Mainworld
                    calculateT5PhysicalStats(sys.mainworld);
                }

                // 2. Generate new satellites (except for belts)
                // Note: generateT5Satellites internally calls generateT5SubordinateUWP for NEW moons
                if (body.worldType !== 'Belt' && body.type !== 'Planetoid Belt') {
                    generateT5Satellites(body, o.orbit, hostHZ, maxSubPop);
                }

                // 3. Flesh out only existing satellites that weren't just created (e.g. injected Mainworld)
                if (body.satellites) {
                    body.satellites.forEach(s => {
                        // Satellites share the climate zone/label of their parent orbit
                        s.climateZone = body.climateZone;
                        if (s !== sys.mainworld && s.uwp === undefined) {
                            generateT5SubordinateUWP(s, o.orbit, hostHZ, maxSubPop, true);
                        } else if (s === sys.mainworld) {
                            calculateT5PhysicalStats(s); // Recalculate mainworld physics
                        }
                    });
                }
            });
        });
    }

    /**
     * Determines world classification based on orbit and habitability.
     */
    function getT5Classification(orbit, hzOrbit, isSatellite) {
        const isZoneA = (orbit <= hzOrbit + 1);
        const limit = hzOrbit + 1;
        
        if (isZoneA) {
            _log(`Zone Detection: Orbit ${orbit} is <= HZ+1 (Orbit ${limit}). Zone A applied.`);
        } else {
            _log(`Zone Detection: Orbit ${orbit} is >= HZ+2 (Orbit ${limit}). Zone B applied.`);
        }

        let roll = Math.floor(_rng() * 6) + 1;
        let type;
        if (isZoneA) {
            const table = ['Inferno', 'InnerWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'Hospitable'];
            type = table[roll - 1];
        } else {
            if (isSatellite) {
                const table = ['Worldlet', 'IceWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'IceWorld'];
                type = table[roll - 1];
            } else {
                const table = ['Worldlet', 'IceWorld', 'BigWorld', 'IceWorld', 'RadWorld', 'IceWorld'];
                type = table[roll - 1];
            }
        }
        _log(`World Type Roll: 1D6 (${roll}) -> ${type}`);
        return type;
    }

    /**
     * Generates a T5 Subordinate UWP.
     */
    function generateT5SubordinateUWP(world, orbit, hzOrbit, maxPop, isSatellite) {
        if (world.type && (world.type.includes('Gas Giant') || world.type === 'Ice Giant')) {
            world.worldType = world.type;
            calculateT5PhysicalStats(world);
            world.uwp = world.size;
            world.uwpSecondary = world.size;
            return;
        }
        
        // Preserve existing classification if already set (e.g. by creation or previous call)
        if (!world.worldType) {
            if (world.type === 'Planetoid Belt') {
                world.worldType = 'Belt';
            } else {
                world.worldType = getT5Classification(orbit, hzOrbit, isSatellite);
            }
        }

        const type = world.worldType;

        // 1. Physical: Size
        if (world.size === undefined) {
            if (type === 'Belt') world.size = 0;
            else if (type === 'Inferno') world.size = _roll1D() + 6;
            else if (type === 'BigWorld') world.size = _roll2D() + 7;
            else if (type === 'Worldlet') world.size = Math.max(0, _roll1D() - 3);
            else if (['RadWorld', 'StormWorld'].includes(type)) world.size = _roll2D();
            else world.size = Math.max(1, _roll2D() - 2);
        }

        // 2. Physical: Atmosphere
        const sizeVal = (typeof world.size === 'string' ? fromUWPChar(world.size) : (world.size || 0));
        
        if (type === 'Inferno') {
            world.atm = fromUWPChar('B');
        } else if (type === 'Belt') {
            world.atm = 0;
        } else if (world.atm === undefined) {
            let dm = (type === 'StormWorld') ? 4 : 0;
            world.atm = clampUWP(sizeVal + rollFlux() + dm, (type === 'StormWorld' ? 4 : 0), 15);
        }

        // 3. Physical: Hydrographics
        if (['Inferno', 'Belt'].includes(type) || sizeVal < 2) {
            world.hydro = 0;
        } else if (world.hydro === undefined) {
            let atmDM = (world.atm < 2 || world.atm > 9) ? -4 : 0;
            let typeDM = (['InnerWorld', 'StormWorld'].includes(type)) ? -4 : 0;
            world.hydro = clampUWP((world.atm || 0) + rollFlux() + atmDM + typeDM, 0, 10);
        }

        // 4. Social: Population (Enforce Constraint)
        let basePop = Math.max(0, _roll2D() - 2);
        let envDM = (type === 'InnerWorld') ? -4 : (['IceWorld', 'StormWorld'].includes(type) ? -6 : 0);
        world.pop = clampUWP(basePop + envDM, 0, maxPop);

        // 5. Social: Spaceport (Enforce Downgrade Constraint)
        const spScore = world.pop - _roll1D();
        if (spScore >= 4) world.starport = 'F';
        else if (spScore === 3) world.starport = 'G';
        else if (spScore === 2) world.starport = 'H';
        else world.starport = 'Y';

        // 6. Social: Gov/Law
        world.gov = clampUWP(world.pop + rollFlux(), 0, 15);
        world.law = clampUWP(world.gov + rollFlux(), 0, 18);
        
        // 7. Social: Tech Level
        let tlDM = (world.starport === 'F') ? 1 : 0;
        if (world.size <= 1) tlDM += 2;
        if (world.atm <= 3 || world.atm >= 10) tlDM += 1;
        world.tl = clampUWP(_roll1D() + tlDM, 0, 33);

        calculateT5PhysicalStats(world);

        // --- 8. Social: Trade Codes ---
        if (T5_World_Engine && T5_World_Engine.calculateT5TradeCodes) {
            const calculated = T5_World_Engine.calculateT5TradeCodes(world);
            if (!world.tradeCodes) world.tradeCodes = [];
            calculated.forEach(code => {
                if (!world.tradeCodes.includes(code)) world.tradeCodes.push(code);
            });
        }

        // --- NEW: Bases and GG flag for Subordinates ---
        if (T5_World_Engine && T5_World_Engine.generateT5Bases && world.starport !== 'Y') {
            T5_World_Engine.generateT5Bases(world);
        }
        if (world.type && (world.type.includes('Gas Giant') || world.type === 'Ice Giant')) {
            world.gasGiant = true;
        }

        world.uwp = `${world.starport}${toUWPChar(world.size)}${toUWPChar(world.atm)}${toUWPChar(world.hydro)}${toUWPChar(world.pop)}${toUWPChar(world.gov)}${toUWPChar(world.law)}-${toUWPChar(world.tl)}`;
        world.uwpSecondary = world.uwp;
    }

    /**
     * Calculates secondary physical characteristics.
     */
    function calculateT5PhysicalStats(world) {
        if (!world || world.size === undefined) return;

        const isGG = (world.type && (world.type.includes('Gas Giant') || world.type === 'Ice Giant'));
        const sizeVal = (world.size === '0' || world.size === 0) ? 0.35 : (typeof world.size === 'string' ? fromUWPChar(world.size) : world.size);
        
        if (isGG) {
            world.diamKm = sizeVal * 10000;
        } else if (sizeVal <= 0.35) {
            world.diamKm = 500;
        } else {
            world.diamKm = sizeVal * 1600;
        }

        if (!isGG) {
            world.density = 1.0; // Default
            world.gravity = parseFloat((world.density * (sizeVal / 8)).toFixed(2));
        } else {
            world.density = 0.1;
            world.gravity = parseFloat((sizeVal / 10).toFixed(2));
        }
    }

    return { generateT5System };
}));
