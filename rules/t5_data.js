/**
 * rules/t5_data.js
 * * T5 STATIC DATA REPOSITORY (v2.0 Modular Architecture)
 * Contains declarative data structures and constant mappings for Traveller 5.
 * * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.T5_Data = factory();
    }
}(this, function () {

    // Helper array for continuous ranges (0-15) to keep trade code definitions clean
    const range = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

    return {
        // Traveller Extended Alphabet (Skips 'I' and 'O')
        UWP_ALPHA: "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ",

        // Habitable Zone Data (HZ by Spectral Type and Size)
        HZ_DATA: {
            'O': { 'Ia': 15, 'Ib': 15, 'II': 14, 'III': 13, 'IV': 12, 'V': 11, 'D': 1 },
            'B': { 'Ia': 13, 'Ib': 13, 'II': 12, 'III': 11, 'IV': 10, 'V': 9, 'D': 0 },
            'A': { 'Ia': 12, 'Ib': 11, 'II': 9, 'III': 7, 'IV': 7, 'V': 7, 'D': 0 },
            'F': { 'Ia': 11, 'Ib': 10, 'II': 9, 'III': 6, 'IV': 6, 'V': 4, 'VI': 3, 'D': 0 },
            'G': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 7, 'IV': 5, 'V': 3, 'VI': 2, 'D': 0 },
            'K': { 'Ia': 12, 'Ib': 10, 'II': 9, 'III': 8, 'IV': 5, 'V': 2, 'VI': 1, 'D': 0 },
            'M': { 'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'V': 0, 'VI': 0, 'D': 0 }
        },

        // Orbit distances in AU
        ORBIT_AU: [0.2, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10, 20, 40, 77, 154, 308, 615, 1230, 2500, 4900, 9800, 19500, 39500],

        // World Type Tables (Zone A and Zone B)
        WORLD_TYPE_TABLES: {
            ZONE_A: ['Inferno', 'InnerWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'Hospitable'],
            ZONE_B_SAT: ['Worldlet', 'IceWorld', 'BigWorld', 'StormWorld', 'RadWorld', 'IceWorld'],
            ZONE_B_PLANET: ['Worldlet', 'IceWorld', 'BigWorld', 'IceWorld', 'RadWorld', 'IceWorld']
        },

        // Stellar Spectral Type Mappings (Flux to Type)
        SPECTRAL_FLUX_MAP: [
            { threshold: -6, type: 'O/B' },
            { threshold: -4, type: 'A' },
            { threshold: -2, type: 'F' },
            { threshold: 0, type: 'G' },
            { threshold: 2, type: 'K' },
            { threshold: 5, type: 'M' }
        ],

        // T5 Precluded Orbits (RAW Surface Orbits)
        T5_PRECLUDED_ORBITS: {
            LOGIC: {
                RULE: "Orbits 0 through the listed Surface Orbit are blocked. The first available orbit is Surface Orbit + 1.",
                UNLISTED_SIZES: "Sizes IV, V, VI, and D have surfaces inside Orbit 0. They block no standard orbits. First available is Orbit 0.",
                O_AND_B_STARS: "O and B spectral classes use the A0 values."
            },
            "Ia": {
                "A0_F5": 4, "G0_G4": 5, "G5_K4": 6, "K5_K9": 7, "M0_M4": 8, "M5_M9": 9
            },
            "Ib": {
                "A0_A4": 1, "A5_G0": 2, "G1_G4": 3, "G5_G9": 4, "K0_K4": 5, "K5_K9": 6, "M0_M4": 7, "M5_M9": 8
            },
            "II": {
                "A0_F5": 0, "G0_G5": 1, "K0_K4": 2, "K5_K9": 4, "M0_M4": 5, "M5_M8": 6, "M9": 7
            },
            "III": {
                "A0_K4": 0, "K5_K9": 1, "M0_M4": 2, "M5_M8": 5, "M9": 6
            }
        },

        // P2 Basic Placement Chart (Relative to HZ)
        P2_PLACEMENT_CHART: {
            GG_LG: (roll) => roll - 5,
            GG_SM: (roll) => roll - 4,
            GG_ICE: (roll) => roll - 1,
            BELT: (roll) => roll - 3,
            WORLD1: [10, 8, 6, 4, 2, 0, 1, 3, 5, 7, 9],
            WORLD2: (roll) => 19 - roll
        },

        // =====================================================================
        // EXTRACTED RPG LOGIC (NEW v2.0 DATA SHIELD)
        // =====================================================================

        // T5 Tech Level Dice Modifiers (DMs)
        TECH_LEVEL_MODIFIERS: {
            starport: {
                'A': 6, 'B': 4, 'C': 2, 'X': -4,
                'F': 1 // Spaceport F
            },
            size: {
                0: 2, 1: 2, 2: 1, 3: 1, 4: 1
            },
            atm: {
                0: 1, 1: 1, 2: 1, 3: 1,
                10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1
            },
            hydro: {
                9: 1, 10: 2
            },
            pop: {
                1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
                9: 2, 10: 4, 11: 4, 12: 4, 13: 4, 14: 4, 15: 4
            },
            gov: {
                0: 1, 5: 1, 13: -2
            }
        },

        // World Type Fixed Stats & Modifiers
        WORLD_TYPE_RULES: {
            'Belt': { sizeFixed: 0, atmFixed: 0, hydroFixed: 0 },
            'Planetoid Belt': { sizeFixed: 0, atmFixed: 0, hydroFixed: 0 },
            'Inferno': {
                sizeFormula: '1D+6',
                atmFixed: 11, hydroFixed: 0, popFixed: 0, govFixed: 0, lawFixed: 0, tlFixed: 0, portFixed: 'Y'
            },
            'RadWorld': {
                sizeFormula: '2D',
                popFixed: 0, govFixed: 0, lawFixed: 0, tlFixed: 0, portFixed: 'Y'
            },
            'StormWorld': {
                sizeFormula: '2D',
                atmDM: 4, atmMin: 4, hydroDM: -4, popDM: -6
            },
            'BigWorld': { sizeFormula: '2D+7' },
            'Worldlet': { sizeFormula: '1D-3' },
            'InnerWorld': { hydroDM: -4, popDM: -4 },
            'IceWorld': { popDM: -6 },
            'Hospitable': { sizeFormula: '2D-2' }
        },

        // Standardized T5 Trade Classifications (Table D)
        TRADE_CODES: [
            { code: "As", reqs: { size: [0], atm: [0], hydro: [0] } },
            { code: "De", reqs: { atm: range(2, 9), hydro: [0] } },
            { code: "Fl", reqs: { atm: [10, 11, 12], hydro: range(1, 10) } },
            { code: "Ga", reqs: { size: [6, 7, 8], atm: [5, 6, 8], hydro: [5, 6, 7] } },
            { code: "He", reqs: { size: range(3, 12), atm: [2, 4, 7, 9, 10, 11, 12], hydro: [0, 1, 2] } },
            { code: "Ic", reqs: { atm: [0, 1], hydro: range(1, 10) } },
            { code: "Oc", reqs: { size: range(10, 15), atm: [3, 4, 5, 6, 7, 8, 9, 13, 14, 15], hydro: [10] } },
            { code: "Va", reqs: { atm: [0] } },
            { code: "Wa", reqs: { size: range(3, 9), atm: [3, 4, 5, 6, 7, 8, 9, 13, 14, 15], hydro: [10] } },

            { code: "Di", reqs: { pop: [0], tl: range(1, 33) } },
            { code: "Ba", reqs: { pop: [0], gov: [0], law: [0] } },
            { code: "Lo", reqs: { pop: [1, 2, 3] } },
            { code: "Ni", reqs: { pop: [4, 5, 6] } },
            { code: "Ph", reqs: { pop: [8] } },
            { code: "Hi", reqs: { pop: range(9, 15) } },

            { code: "Pa", reqs: { atm: range(4, 9), hydro: range(4, 8), pop: [4, 8] } },
            { code: "Ag", reqs: { atm: range(4, 9), hydro: range(4, 8), pop: [5, 6, 7] } },
            { code: "Na", reqs: { atm: [0, 1, 2, 3], hydro: [0, 1, 2, 3], pop: range(6, 15) } },
            { code: "Px", reqs: { atm: [2, 3, 10, 11], hydro: [1, 2, 3, 4, 5], pop: [3, 4, 5, 6], law: [6, 7, 8, 9] } },
            { code: "Pi", reqs: { atm: [0, 1, 2, 4, 7, 9], pop: [7, 8] } },
            { code: "In", reqs: { atm: [0, 1, 2, 4, 7, 9, 10, 11, 12], pop: range(9, 15) } },
            { code: "Po", reqs: { atm: [2, 3, 4, 5], hydro: [0, 1, 2, 3] } },
            { code: "Pr", reqs: { atm: [6, 8], pop: [5, 9] } },
            { code: "Ri", reqs: { atm: [6, 8], pop: [6, 7, 8] } }
        ]
    };
}));