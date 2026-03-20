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
    calculateMeanTemperature: function (lumSolar, au, albedo, greenhouseFactor) {
        if (au <= 0) return 3; // Cosmic background fallback
        let term1 = lumSolar * (1 - albedo) * (1 + greenhouseFactor);
        let term2 = au * au;
        return 279 * Math.pow(term1 / term2, 0.25);
    }
};

// Universal Module Definition (UMD) compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MgT2EMath;
} else if (typeof window !== 'undefined') {
    window.MgT2EMath = MgT2EMath;
}