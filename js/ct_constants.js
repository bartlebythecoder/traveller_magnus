// =====================================================================
// CLASSIC TRAVELLER: UNIVERSAL PHYSICAL CONSTANTS
// =====================================================================
// These are the "Laws of Physics" for the CT Book 6 universe.

const CT_CONSTANTS = {
    // Distance of orbits from the star in AU
    ORBIT_AU: [0.2, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10.0, 19.6, 38.8, 77.2, 154, 307.4, 614.8, 1229.2, 2458, 4915.6, 9830.8, 19661.2, 39322],

    // Gravity multipliers based on Size Code
    GRAV: { 0: 0, S: 0.024, 1: 0.122, 2: 0.240, 3: 0.377, 4: 0.500, 5: 0.625, 6: 0.840, 7: 0.875, 8: 1.000, 9: 1.120, 10: 1.250 },

    // Luminosity values based on Star Size and Spectral Type
    LUM: {
        'Ia': { B0: 560000, B5: 204000, A0: 107000, A5: 81000, F0: 61000, F5: 51000, G0: 67000, G5: 89000, K0: 97000, K5: 107000, M0: 117000, M5: 129000, M9: 141000 },
        'Ib': { B0: 270000, B5: 46700, A0: 15000, A5: 11700, F0: 7400, F5: 5100, G0: 6100, G5: 8100, K0: 11700, K5: 20400, M0: 46000, M5: 89000, M9: 117000 },
        'II': { B0: 170000, B5: 18600, A0: 2200, A5: 850, F0: 600, F5: 510, G0: 560, G5: 740, K0: 890, K5: 2450, M0: 4600, M5: 14900, M9: 16200 },
        'III': { B0: 107000, B5: 6700, A0: 280, A5: 90, F0: 53, F5: 43, G0: 50, G5: 75, K0: 95, K5: 320, M0: 470, M5: 2280, M9: 2690 },
        'IV': { B0: 81000, B5: 2000, A0: 156, A5: 37, F0: 19, F5: 12, G0: 6.5, G5: 4.9, K0: 4.67 },
        'V': { B0: 56000, B5: 1400, A0: 90, A5: 16, F0: 8.1, F5: 3.5, G0: 1.21, G5: 0.67, K0: 0.42, K5: 0.08, M0: 0.04, M5: 0.007, M9: 0.001 },
        'VI': { F5: 0.977, G0: 0.322, G5: 0.186, K0: 0.117, K5: 0.025, M0: 0.011, M5: 0.002, M9: 0.00006 },
        'D': { DB: 0.046, DA: 0.005, DF: 0.0003, DG: 0.00006, DK: 0.00004, DM: 0.00003 }
    },

    // Mass multipliers for stars based on Size
    STAR_MASS: {
        'Ia': { B0: 60, B5: 30, A0: 18, A5: 15, F0: 13, F5: 12, G0: 12, G5: 13, K0: 14, K5: 18, M0: 20, M5: 25, M9: 30 },
        'Ib': { B0: 50, B5: 25, A0: 16, A5: 13, F0: 12, F5: 10, G0: 10, G5: 12, K0: 13, K5: 16, M0: 16, M5: 20, M9: 25 },
        'II': { B0: 30, B5: 20, A0: 14, A5: 11, F0: 10, F5: 8.1, G0: 8.1, G5: 10, K0: 11, K5: 14, M0: 14, M5: 16, M9: 18 },
        'III': { B0: 25, B5: 15, A0: 12, A5: 9, F0: 8, F5: 5, G0: 2.5, G5: 3.2, K0: 4, K5: 5, M0: 6.3, M5: 7.4, M9: 9.2 },
        'IV': { B0: 20, B5: 10, A0: 6, A5: 4, F0: 2.5, F5: 2, G0: 1.75, G5: 2, K0: 2.3 },
        'V': { B0: 18, B5: 6.5, A0: 3.2, A5: 2.1, F0: 1.7, F5: 1.3, G0: 1.04, G5: 0.94, K0: 0.825, K5: 0.570, M0: 0.489, M5: 0.331, M9: 0.215 },
        'VI': { F5: 0.8, G0: 0.6, G5: 0.528, K0: 0.430, K5: 0.330, M0: 0.154, M5: 0.104, M9: 0.058 },
        'D': { DB: 0.26, DA: 0.36, DF: 0.42, DG: 0.63, DK: 0.83, DM: 1.11 }
    },

    // Habitable Zone (Orbit Number) based on Star Type and Size
 ZONE_H_TABLE: {
        'Ia': { B0: 13, B5: 12, A0: 12, A5: 12, F0: 12, F5: 11, G0: 12, G5: 12, K0: 12, K5: 12, M0: 12, M5: 12, M9: 12 },
        'Ib': { B0: 13, B5: 11, A0: 11, A5: 10, F0: 10, F5: 10, G0: 10, G5: 10, K0: 10, K5: 11, M0: 11, M5: 12, M9: 12 },
        'II': { B0: 12, B5: 11, A0: 9, A5: 8, F0: 8, F5: 8, G0: 8, G5: 8, K0: 9, K5: 9, M0: 10, M5: 11, M9: 11 },
        'III': { B0: 12, B5: 10, A0: 8, A5: 7, F0: 6, F5: 6, G0: 6, G5: 7, K0: 7, K5: 8, M0: 8, M5: 9, M9: 9 },
        'IV': { B0: 12, B5: 9, A0: 7, A5: 6, F0: 6, F5: 7, G0: 5, G5: 5, K0: 4 },
        'V': { B0: 12, B5: 9, A0: 7, A5: 6, F0: 5, F5: 4, G0: 3, G5: 2, K0: 2, K5: 0, M0: 0, M5: -1, M9: -1 },
        'VI': { F0: -1, F5: 3, G0: 2, G5: 1, K0: 1, K5: -1, M0: -1, M5: -1, M9: -1 },
        'D': { DB: 0, DA: -1, DF: -1, DG: -1, DK: -1, DM: -1 }
    },

    // Zone Lookup Tables (I=Inner, H=Habitable, O=Outer)
    ZONE_TABLES: {
        'Ia': {
            'B0': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
            'B5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'A0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'A5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'F0': [null, null, null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'F5': [null, null, null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'G0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'G5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'K0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'G5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'K0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'K5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'M0': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'M5': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'M9': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O']
        },
        'Ib': {
            'B0': [null, null, null, null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
            'B5': [null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'A0': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'A5': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'F0': [null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'F5': [null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'G0': [null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'G5': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'K0': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'K5': [null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'M0': [null, null, null, null, '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'M5': [null, null, null, null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'M9': [null, null, null, null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O']
        },
        'II': {
            'B0': [null, '-', '-', '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'B5': [null, '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'A0': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O'],
            'A5': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F0': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K5': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M0': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'M5': [null, '-', '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
            'M9': [null, '-', '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O']
        },
        'III': {
            'B0': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
            'B5': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'A0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'A5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F0': [null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F5': [null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G0': [null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M0': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M5': [null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M9': [null, '-', '-', '-', '-', '-', '-', '-', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O']
        },
        'IV': {
            'B0': ['-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
            'B5': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'A0': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'A5': ['I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F0': ['I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F5': ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G0': ['I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G5': ['I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K0': ['I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O']
        },
        'V': {
            'B0': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
            'B5': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'A0': ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
            'A5': ['I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F0': ['I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'F5': ['I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G0': ['I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'G5': ['I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K0': ['I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'K5': ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M0': ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M5': ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
            'M9': ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O']
        },
        'VI': {
            'F5': ['I', 'I', 'I', 'H', 'O', 'O'],
            'G0': ['I', 'I', 'H', 'O', 'O', 'O'],
            'G5': ['I', 'H', 'O', 'O', 'O', 'O'],
            'K0': ['I', 'H', 'O', 'O', 'O', 'O'],
            'K5': ['O', 'O', 'O', 'O', 'O', 'O'],
            'M0': ['O', 'O', 'O', 'O', 'O', 'O'],
            'M5': ['O', 'O', 'O', 'O', 'O', 'O'],
            'M9': ['O', 'O', 'O', 'O', 'O', 'O']
        },
        'D': {
            'DB': ['H', 'O', 'O', 'O', 'O'],
            'DA': ['O', 'O', 'O', 'O', 'O'],
            'DF': ['O', 'O', 'O', 'O', 'O'],
            'DG': ['O', 'O', 'O', 'O', 'O'],
            'DK': ['O', 'O', 'O', 'O', 'O'],
            'DM': ['O', 'O', 'O', 'O', 'O']
        }
    },

    // Stellar Classification Tables (Mapping 2D rolls)
    CT_BASIC_NATURE_TABLE: ['Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Binary', 'Binary', 'Binary', 'Binary', 'Trinary'],
    CT_PRI_TYPE_TABLE: ['B', 'B', 'A', 'M', 'M', 'M', 'M', 'M', 'K', 'G', 'F', 'F', 'F'],
    CT_PRI_SIZE_TABLE: ['Ia', 'Ib', 'II', 'III', 'IV', 'V', 'V', 'V', 'V', 'V', 'V', 'VI', 'D'],
    CT_COMP_TYPE_TABLE: ['M', 'B', 'A', 'F', 'F', 'G', 'G', 'K', 'K', 'M', 'M', 'M', 'M'],
    CT_COMP_SIZE_TABLE: ['Ia', 'Ib', 'II', 'III', 'IV', 'D', 'D', 'V', 'V', 'VI', 'D', 'D', 'D'],

    // Book 6 Satellite Orbits (Distance in planetary radii)
    SATELLITE_ORBITS: {
        Ring: [0, 1, 1, 1, 2, 2, 3],
        Close: [0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        Far: [0, 0, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
        Extreme: [0, 0, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CT_CONSTANTS;
} else {
    // In browser, spread into global scope
    Object.assign(window, CT_CONSTANTS);
}