/**
 * js/universal_math.js
 * 
 * CORE MATHEMATICAL "CHASSIS" (v2.0 Modular Architecture)
 * Consolidates purely mathematical, edition-agnostic utility functions.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function () {
    // Traveller Extended Alphabet (Skips 'I' and 'O' per standard T5/Universal rules)
    // 0-9 = 0-9, A-H = 10-17, J-N = 18-22, P-Z = 23-33
    const UWP_ALPHA = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

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

    // Export Logic (Universal Module Definition for Browser and Node.js)
    const exports = {
        toUWPChar,
        fromUWPChar,
        clampUWP,
        rollFlux
    };

    if (typeof module !== 'undefined' && module.exports) {
        // Node.js environment
        module.exports = exports;
    } else {
        // Browser environment: attach to a global namespace
        window.UniversalMath = exports;
    }
})();
