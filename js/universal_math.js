/**
 * js/universal_math.js
 * * CORE MATHEMATICAL "CHASSIS" (v2.0 Modular Architecture)
 * Consolidates purely mathematical, edition-agnostic utility functions.
 * * Part of the Traveller Magnus v2.0 refactor.
 */

(function () {
    // Traveller Extended Alphabet (Skips 'I' and 'O' per standard T5/Universal rules)
    // 0-9 = 0-9, A-H = 10-17, J-N = 18-22, P-Z = 23-33
    const UWP_ALPHA = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const KM_PER_AU = 149597870;
    const SUN_DIAMETER_KM = 1392700;

    /**
     * Converts an integer value to its pseudo-hexadecimal UWP character.
     * @param {number|string} val - The numeric value to convert.
     * @returns {string} - The corresponding UWP character (0-9, A-Z).
     */
    function toUWPChar(val) {
        if (val === undefined || val === null) return '0';

        let v;
        if (typeof val === 'string') {
            v = parseInt(val, 10);
            if (isNaN(v)) return val.trim().toUpperCase().charAt(0) || '0';
        } else {
            v = Math.floor(Number(val));
        }

        if (isNaN(v) || v < 0) return '0';
        if (v >= UWP_ALPHA.length) return UWP_ALPHA[UWP_ALPHA.length - 1]; // Cap at Z (33)
        return UWP_ALPHA[v];
    }

    /**
     * Converts a UWP character back to an integer.
     * @param {string} char - The UWP character (0-9, A-Z).
     * @returns {number} - The integer value (0-33).
     */
    function fromUWPChar(char) {
        if (char === undefined || char === null || char === '') return 0;
        const c = String(char).trim().toUpperCase().charAt(0);
        const idx = UWP_ALPHA.indexOf(c);
        return (idx >= 0) ? idx : 0;
    }

    /**
     * Restricts a value within given numerical bounds.
     * @param {number} val - The value to clamp.
     * @param {number} min - The minimum allowed value.
     * @param {number} max - The maximum allowed value.
     * @returns {number} - The clamped value.
     */
    function clampUWP(val, min, max) {
        const v = Number(val);
        if (isNaN(v)) return min;
        return Math.max(min, Math.min(max, v));
    }

    /**
     * The standard generic Flux roll (1D6 + 1D6 - 7).
     * Returns a value from -5 to +5 with a triangular distribution.
     * Respects the project's global roll1D() if available for seeded results.
     * @returns {number}
     */
    function rollFlux() {
        const d1 = (typeof roll1D === 'function') ? roll1D() : (Math.floor(Math.random() * 6) + 1);
        const d2 = (typeof roll1D === 'function') ? roll1D() : (Math.floor(Math.random() * 6) + 1);
        return (d1 + d2) - 7;
    }

    /**
     * Calculates the base journey times for a world to its 100D jump limit.
     * @param {number|string} size - The UWP size digit of the world or moon.
     * @param {number} [forcedDiamKm] - Optional: Explicit diameter in km (bypasses size estimation).
     * @returns {Array<number>} An array of 6 journey times (in hours) for 1G through 6G acceleration.
     */
    function calculateBaseJourneyTimes(size, forcedDiamKm = null) {
        if (typeof tSection === 'function') tSection("Calculate Base Journey Times");

        // Safely parse the size (handles both standard integers and UWP letters like 'A')
        let numericSize = parseInt(size, 10);
        if (isNaN(numericSize)) {
            numericSize = fromUWPChar(size);
        }

        if (isNaN(numericSize) || (numericSize <= 0 && !forcedDiamKm)) {
            if (typeof tResult === 'function') tResult("Invalid or Size 0", "Returning 0 hours");
            return [0.00, 0.00, 0.00, 0.00, 0.00, 0.00];
        }

        const distance = (forcedDiamKm) ? (forcedDiamKm * 100) : (numericSize * 160000);
        if (typeof tResult === 'function') tResult("Jump Distance", distance.toLocaleString() + " km");

        const journeyTimes = [];

        // Loop through 1G to 6G acceleration
        for (let a = 1; a <= 6; a++) {
            // Changed the 2 to a 20 to handle km -> meters and G -> m/s^2 natively
            let rawTime = (20 * Math.sqrt(distance / a)) / 3600;
            let roundedTime = parseFloat(rawTime.toFixed(2));
            journeyTimes.push(roundedTime);
        }

        if (typeof tResult === 'function') tResult("Base Times (1G - 6G)", journeyTimes.join(' | '));
        return journeyTimes;
    }


    /**
     * Determines if a world is close enough to its star to be eligible for Stellar Masking,
     * AND if the stellar mask actually results in a longer jump distance.
     * @param {number} starDiamSolar - The diameter of the parent star in Solar Diameters.
     * @param {number} worldDistanceAU - The distance of the world from the star in AU.
     * @param {number|string} worldSize - The UWP size digit of the world or moon.
     * @param {number} [forcedWorldDiamKm] - Optional: Explicit world diameter in km (bypasses size estimation).
     * @returns {boolean} True if eligible AND the masking distance is greater than planetary distance.
     */
    function isMaskingEligible(starDiamSolar, worldDistanceAU, worldSize, forcedWorldDiamKm = null) {
        if (!starDiamSolar || worldDistanceAU === undefined || worldSize === undefined) return false;

        const starDiamKm = starDiamSolar * SUN_DIAMETER_KM;
        const stellarMaskLimitKm = 100 * starDiamKm;
        const worldDistKm = worldDistanceAU * KM_PER_AU;

        // 1. Is the world physically within the star's 100D limit?
        if (worldDistKm >= stellarMaskLimitKm) return false;

        // 2. Is the star's masking distance actually larger than the planet's own 100D limit?
        let numericSize = parseInt(worldSize, 10);
        if (isNaN(numericSize)) numericSize = fromUWPChar(worldSize);
        
        const standardDistance = (forcedWorldDiamKm) ? (forcedWorldDiamKm * 100) : ((numericSize > 0 && !isNaN(numericSize)) ? numericSize * 160000 : 0);

        const maskedDistance = stellarMaskLimitKm - worldDistKm;

        return maskedDistance > standardDistance;
    }

    /**
     * Calculates the journey times applying the Stellar Masking modifier.
     * Rule: Jump distance = (100 * Star Diameter in km) - (World distance to star in km).
     * Rule: Final distance can never be less than the standard planetary 100D limit.
     * @param {number|string} worldSize - The UWP size digit of the world or moon.
     * @param {number} starDiamSolar - The diameter of the parent star in Solar Diameters.
     * @param {number} worldDistanceAU - The distance of the world from the star in AU.
     * @param {number} [forcedWorldDiamKm] - Optional: Explicit world diameter in km.
     * @returns {Array<number>} An array of 6 masked journey times (in hours) for 1G through 6G.
     */
    function calculateMaskedJourneyTimes(worldSize, starDiamSolar, worldDistanceAU, forcedWorldDiamKm = null) {
        if (typeof tSection === 'function') tSection("Calculate Stellar Masked Journey Times");

        // 1. Calculate Standard Planetary Distance
        let numericSize = parseInt(worldSize, 10);
        if (isNaN(numericSize)) numericSize = fromUWPChar(worldSize);
        
        const standardDistance = (forcedWorldDiamKm) ? (forcedWorldDiamKm * 100) : ((numericSize > 0 && !isNaN(numericSize)) ? numericSize * 160000 : 0);

        // 2. Calculate Stellar Masking Distance
        const starDiamKm = starDiamSolar * SUN_DIAMETER_KM;
        const stellarMaskLimitKm = 100 * starDiamKm;
        const worldDistKm = worldDistanceAU * KM_PER_AU;

        let maskedDistance = stellarMaskLimitKm - worldDistKm;

        // 3. Minimum Distance Override Check
        let finalDistance = Math.max(standardDistance, maskedDistance);

        if (typeof tResult === 'function') {
            tResult("Standard Jump Dist", standardDistance.toLocaleString() + " km");
            tResult("100D Stellar Limit", stellarMaskLimitKm.toLocaleString() + " km");
            tResult("World Orbit Dist", worldDistKm.toLocaleString() + " km");
            tResult("Final Masked Dist", finalDistance.toLocaleString() + " km");
        }

        const journeyTimes = [];

        // 4. Calculate the 6 Acceleration Times
        if (finalDistance <= 0) {
            return [0.00, 0.00, 0.00, 0.00, 0.00, 0.00];
        }

        for (let a = 1; a <= 6; a++) {
            // Changed the 2 to a 20 to handle km -> meters and G -> m/s^2 natively
            let rawTime = (20 * Math.sqrt(finalDistance / a)) / 3600;
            let roundedTime = parseFloat(rawTime.toFixed(2));
            journeyTimes.push(roundedTime);
        }

        if (typeof tResult === 'function') tResult("Masked Times (1G - 6G)", journeyTimes.join(' | '));
        return journeyTimes;
    }


    /**
     * Estimates a star's diameter in Solar Units based on its spectral classification.
     * @param {string} type - Spectral Type (O, B, A, F, G, K, M, D, BD)
     * @param {number} decimal - Spectral Decimal (0-9)
     * @param {string} size - Luminosity Class (Ia, Ib, II, III, IV, V, VI, D)
     * @returns {number} The estimated diameter in Solar Radii/Diameters.
     */
    function estimateStellarDiameter(type, decimal, size) {
        if (size === 'D' || type === 'D') return 0.01; // White Dwarfs are tiny
        if (type === 'BD') return 0.1; // Brown dwarfs are roughly Jupiter-sized

        // Base diameters for Size V (Main Sequence) at decimal 0
        const mainSequenceBase = { 'O': 10.0, 'B': 10.0, 'A': 3.2, 'F': 1.7, 'G': 1.03, 'K': 0.908, 'M': 0.549 };

        // Multipliers based on Luminosity Class (Sizes III, II, Ib, Ia)
        const sizeMultipliers = {
            'VI': 0.8,
            'V': 1.0,
            'IV': 2.5,
            'III': 10.0,
            'II': 30.0,
            'Ib': 100.0,
            'Ia': 300.0
        };

        let baseDiam = mainSequenceBase[type] || 1.0;
        let mult = sizeMultipliers[size] || 1.0;

        // Apply a slight variation based on the decimal (e.g., G5 is slightly smaller than G0)
        let decimalMod = 1 - (decimal * 0.02);

        let finalDiam = baseDiam * mult * decimalMod;

        return parseFloat(finalDiam.toFixed(3));
    }



    const exports = {
        toUWPChar,
        fromUWPChar,
        clampUWP,
        rollFlux,
        calculateBaseJourneyTimes,
        isMaskingEligible,           // <-- ADDED
        calculateMaskedJourneyTimes,
        estimateStellarDiameter  // <-- ADDED
    };

    if (typeof module !== 'undefined' && module.exports) {
        // Node.js environment
        module.exports = exports;
    } else {
        // Browser environment: attach to a global namespace
        window.UniversalMath = exports;
    }
})();