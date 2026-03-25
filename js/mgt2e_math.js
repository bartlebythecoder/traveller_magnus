/**
 * PROJECT AS ABOVE, SO BELOW
 * Layer 2: The Math Chassis (Mongoose 2nd Edition)
 * Description: Pure mathematical formulas and physics approximations specific to MgT2E.
 * These functions take raw numbers and return raw numbers. No RPG objects are mutated here.
 */

const MgT2EMath = {
    // -------------------------------------------------------------------------
    // PLANETARY PHYSICS
    // -------------------------------------------------------------------------

    /**
     * Calculates planetary gravity in Gs.
     * @param {number} density - Density relative to Earth (1.0).
     * @param {number} mathSize - The mathematical size value (UWP Size, or 0.375 for 'S').
     * @returns {number} Gravity in Gs.
     */
    calculateGravity: function (density, mathSize) {
        return density * (mathSize / 8);
    },

    /**
     * Calculates planetary mass in Earth masses.
     * @param {number} density - Density relative to Earth.
     * @param {number} mathSize - The mathematical size value.
     * @returns {number} Mass in Earths.
     */
    calculateMass: function (density, mathSize) {
        return density * Math.pow(mathSize / 8, 3);
    },

    /**
     * Calculates planetary escape velocity.
     * @param {number} massEarths - Mass in Earths.
     * @param {number} mathSize - The mathematical size value.
     * @returns {number} Escape velocity in km/s.
     */
    calculateEscapeVelocity: function (massEarths, mathSize) {
        if (mathSize === 0) return 0;
        return Math.sqrt(massEarths / (mathSize / 8)) * 11186;
    },

    /**
     * Calculates surface orbital velocity.
     * @param {number} escapeVelocity - Escape velocity in km/s.
     * @returns {number} Orbital velocity in km/s.
     */
    calculateOrbitalVelocity: function (escapeVelocity) {
        return escapeVelocity / Math.sqrt(2);
    },

    /**
     * Calculates the atmospheric scale height.
     * @param {number} gravity - Gravity in Gs.
     * @param {number} meanTempK - Mean temperature in Kelvin.
     * @returns {number} Scale height in km.
     */
    calculateScaleHeight: function (gravity, meanTempK) {
        if (gravity <= 0) return 0;
        return (8.5 / gravity) * (meanTempK / 288);
    },

    /**
     * Calculates the gas retention escape value threshold.
     * @param {number} massEarths - Mass in Earths.
     * @param {number} diamKm - Diameter in km.
     * @param {number} meanTempK - Mean temperature in Kelvin.
     * @returns {number} Max escape value.
     */
    calculateMaxEscapeValue: function (massEarths, diamKm, meanTempK) {
        let diamTerra = diamKm / 12742;
        if (diamTerra <= 0 || meanTempK <= 0) return 0;
        return 1000 * (massEarths / (diamTerra * meanTempK));
    },

    // -------------------------------------------------------------------------
    // ORBITAL & STELLAR PHYSICS
    // -------------------------------------------------------------------------

    /**
     * Calculates stellar luminosity based on diameter and temperature.
     * @param {number} diamSolar - Diameter in Solar radii.
     * @param {number} tempK - Temperature in Kelvin.
     * @returns {number} Luminosity in Solar units.
     */
    calculateStellarLuminosity: function (diamSolar, tempK) {
        let diam2 = diamSolar * diamSolar;
        let tempRatio = Math.pow(tempK / 5772, 4);
        return diam2 * tempRatio;
    },

    /**
     * Calculates orbital period in years.
     * @param {number} au - Orbital distance in AU.
     * @param {number} sumMassSolar - Sum of all interior stellar masses in Solar units.
     * @param {number} planetMassEarths - Mass of the orbiting body in Earths.
     * @returns {number} Period in Earth years.
     */
    calculateOrbitalPeriodYears: function (au, sumMassSolar, planetMassEarths) {
        let planetSolarMass = planetMassEarths * 0.000003;
        return Math.sqrt(Math.pow(au, 3) / (sumMassSolar + planetSolarMass));
    },

    /**
     * Calculates the Hill Sphere limit (in planetary diameters / 2).
     * @param {number} au - Orbital distance in AU.
     * @param {number} eccentricity - Orbital eccentricity.
     * @param {number} planetMassEarths - Mass of the planet in Earths.
     * @param {number} starMassSolar - Mass of the parent star in Solar units.
     * @param {number} diamKm - Diameter of the planet in km.
     * @returns {number} Hill sphere limit index.
     */
    calculateHillSphereLimit: function (au, eccentricity, planetMassEarths, starMassSolar, diamKm) {
        if (diamKm <= 0 || starMassSolar <= 0) return 0;
        let planetSolarMass = planetMassEarths * 0.000003;
        let hsAu = au * (1 - eccentricity) * Math.pow(planetSolarMass / (3 * starMassSolar), 0.3333);
        let hsPd = hsAu * 149597870.9 / diamKm;
        return Math.floor(hsPd / 2);
    },

    /**
     * Calculates the tidal effect of one body upon another.
     * @param {number} actingMassEarths - Mass of the body exerting the pull (Earths).
     * @param {number} targetMathSize - Mathematical size of the body feeling the pull.
     * @param {number} separationMkm - Distance between bodies in millions of km.
     * @returns {number} Tidal effect amplitude.
     */
    calculateTidalEffect: function (actingMassEarths, targetMathSize, separationMkm) {
        if (separationMkm <= 0) return 0;
        return (actingMassEarths * targetMathSize) / (3.2 * Math.pow(separationMkm, 3));
    },

    // -------------------------------------------------------------------------
    // THERMODYNAMICS
    // -------------------------------------------------------------------------

    /**
     * Calculates blackbody mean temperature including greenhouse and albedo.
     * @param {number} lumSolar - Luminosity of the illuminating star(s).
     * @param {number} au - Distance from the star in AU.
     * @param {number} albedo - Bond albedo fraction (0 to 1).
     * @param {number} greenhouseFactor - Greenhouse multiplier.
     * @returns {number} Mean temperature in Kelvin.
     */
    /**
     * Calculates blackbody mean temperature including greenhouse and albedo.
     * @param {number} lumSolar - Luminosity of the illuminating star(s).
     * @param {number} au - Distance from the star in AU.
     * @param {number} albedo - Bond albedo fraction (0 to 1).
     * @param {number} greenhouseFactor - Greenhouse multiplier.
     * @returns {number} Mean temperature in Kelvin.
     */
    calculateMeanTemperature: function (lumSolar, au, albedo, greenhouseFactor) {
        if (au <= 0) return 3; // Cosmic background fallback
        let term1 = lumSolar * (1 - albedo) * (1 + greenhouseFactor);
        let term2 = au * au;
        return 279 * Math.pow(term1 / term2, 0.25);
    },

    // -------------------------------------------------------------------------
    // JOURNEY TIMES & STELLAR MASKING (Sean Protocol Phase 1)
    // -------------------------------------------------------------------------

    /**
     * Calculates the base journey times to a world's 100D jump limit.
     * @param {number|string} size - UWP size digit.
     * @param {number} [forcedDiamKm] - Optional: Explicit diameter in km.
     * @returns {Array<number>} 1G-6G times in hours.
     */
    calculateBaseJourneyTimes: function(size, forcedDiamKm = null) {
        if (typeof tSection === 'function') tSection("Math: Base Journey Times");
        
        // Use UniversalMath for UWP parsing if available
        let numericSize = (typeof UniversalMath !== 'undefined') ? UniversalMath.fromUWPChar(size) : parseInt(size, 16);
        if (isNaN(numericSize)) numericSize = 0;

        const distance = forcedDiamKm ? (forcedDiamKm * 100) : (numericSize * 160000);
        if (typeof tResult === 'function') tResult("Jump Distance", `${distance.toLocaleString()} km`);

        const times = [];
        for (let a = 1; a <= 6; a++) {
            // Formula: t = 2 * sqrt(d/a)
            // Units: d(km) -> 1000m, a(G) -> 9.8m/s^2. 
            // Simplified: (2 * sqrt(d*1000 / a*9.8)) / 3600 -> (2 * sqrt(102.04 * d / a)) / 3600 -> (20.2 * sqrt(d/a)) / 3600
            // We'll use the '20' constant as established in previous modules for consistency.
            let rawTime = (20 * Math.sqrt(distance / a)) / 3600;
            times.push(parseFloat(rawTime.toFixed(2)));
        }

        if (typeof tResult === 'function') tResult("1G-6G Times", times.join(' | '));
        return times;
    },

    /**
     * Determines if a world meets masking thresholds.
     */
    isMaskingEligible: function(starDiamSolar, worldDistAU, worldSize, forcedWorldDiamKm = null) {
        if (!starDiamSolar || worldDistAU === undefined || worldSize === undefined) return false;
        
        const SUN_DIAMETER_KM = 1392700;
        const KM_PER_AU = 149597870;
        
        const maskLimitKm = 100 * (starDiamSolar * SUN_DIAMETER_KM);
        const worldDistKm = worldDistAU * KM_PER_AU;
        
        // Eligible if world is inside the star's 100D limit
        if (worldDistKm >= maskLimitKm) return false;

        // And if the masked distance is greater than the world's own 100D limit
        let numericSize = (typeof UniversalMath !== 'undefined') ? UniversalMath.fromUWPChar(worldSize) : parseInt(worldSize, 16);
        const standardDist = forcedWorldDiamKm ? (forcedWorldDiamKm * 100) : (numericSize * 160000);
        const maskedDist = maskLimitKm - worldDistKm;

        return maskedDist > standardDist;
    },

    /**
     * Calculates journey times with the Stellar Masking modifier.
     */
    calculateMaskedJourneyTimes: function(worldSize, starDiamSolar, worldDistAU, forcedWorldDiamKm = null) {
        if (typeof tSection === 'function') tSection("Math: Masked Journey Times");
        
        const SUN_DIAMETER_KM = 1392700;
        const KM_PER_AU = 149597870;

        const starDiamKm = starDiamSolar * SUN_DIAMETER_KM;
        const maskLimitKm = 100 * starDiamKm;
        const worldDistKm = worldDistAU * KM_PER_AU;
        
        let numericSize = (typeof UniversalMath !== 'undefined') ? UniversalMath.fromUWPChar(worldSize) : parseInt(worldSize, 16);
        const standardDist = forcedWorldDiamKm ? (forcedWorldDiamKm * 100) : (numericSize * 160000);
        
        const maskedDist = maskLimitKm - worldDistKm;
        const finalDist = Math.max(standardDist, maskedDist);

        if (typeof tResult === 'function') {
            tResult("100D Stellar Limit", `${maskLimitKm.toLocaleString()} km`);
            tResult("Final Calculation Distance", `${finalDist.toLocaleString()} km`);
        }

        const times = [];
        for (let a = 1; a <= 6; a++) {
            let rawTime = (20 * Math.sqrt(finalDist / a)) / 3600;
            times.push(parseFloat(rawTime.toFixed(2)));
        }

        if (typeof tResult === 'function') tResult("Masked Times", times.join(' | '));
        return times;
    },

    /**
     * System-Wide Orchestrator Helper:
     * Iterates through a full system skeleton and enriches every body (mainworld,
     * subordinate planet, or satellite) with journey time data and masking flags.
     * @param {Object} sys - The system object.
     */
    performJourneyMathSweep: function(sys) {
        if (!sys || !sys.worlds) return;
        if (typeof tSection === 'function') tSection("Math Sweep: Journey Times & Masking Eligibility");

        const primaryStar = sys.stars ? sys.stars[0] : null;
        if (!primaryStar) {
            if (typeof writeLogLine === 'function') writeLogLine("Math Sweep Aborted: No primary star found.");
            return;
        }

        const starDiam = this.estimateStellarDiameter(primaryStar.type, primaryStar.decimal, primaryStar.size);

        sys.worlds.forEach(w => {
            // 1. Process World
            const wDist = (w.au !== undefined) ? w.au : (w.distAU !== undefined ? w.distAU : 0);
            w.maskingEligible = this.isMaskingEligible(starDiam, wDist, w.size, w.diamKm);
            w.journeyTimes = this.calculateBaseJourneyTimes(w.size, w.diamKm);
            
            // 2. Process Moons / Significant Bodies
            const subBodies = (w.moons || []).concat(w.significantBodies || []).concat(w.satellites || []);
            subBodies.forEach(sb => {
                const sbDist = (sb.au !== undefined) ? sb.au : (sb.distAU !== undefined ? sb.distAU : wDist); // Inherit distance if not specified (moons)
                sb.maskingEligible = this.isMaskingEligible(starDiam, sbDist, sb.size, sb.diamKm);
                sb.journeyTimes = this.calculateBaseJourneyTimes(sb.size, sb.diamKm);
            });
        });

        if (typeof writeLogLine === 'function') writeLogLine("System-wide Journey Math Sweep complete.");
    },

    /**
     * Estimates a star's diameter in Solar Units.
     * Note: This is an internal helper used by the sweep.
     */
    estimateStellarDiameter: function(type, decimal, size) {
        if (size === 'D' || type === 'D') return 0.01;
        if (type === 'BD') return 0.1;
        const mainSequenceBase = { 'O': 10.0, 'B': 10.0, 'A': 3.2, 'F': 1.7, 'G': 1.03, 'K': 0.908, 'M': 0.549 };
        const sizeMultipliers = { 'VI': 0.8, 'V': 1.0, 'IV': 2.5, 'III': 10.0, 'II': 30.0, 'Ib': 100.0, 'Ia': 300.0 };
        let baseDiam = mainSequenceBase[type] || 1.0;
        let mult = sizeMultipliers[size] || 1.0;
        let decimalMod = 1 - (decimal * 0.02);
        return parseFloat((baseDiam * mult * decimalMod).toFixed(3));
    }
};

// Universal Module Definition (UMD) compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MgT2EMath;
} else if (typeof window !== 'undefined') {
    window.MgT2EMath = MgT2EMath;
}