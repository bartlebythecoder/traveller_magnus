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
            'M': { 'Ia': 12, 'Ib': 11, 'II': 10, 'III': 9, 'V': 0, 'VI': 0, 'D': 0 },
            // Brown Dwarf: HZ at Orbit 0, with the dwarf end of the scale (Charts H1/J1/K1;
            // confirmed by Sean, 2026-11-01). BDs are stored with size 'V', 'VI' or 'D'.
            'BD': { 'V': 0, 'VI': 0, 'D': 0 }
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

        // T5 World Map Dimension Details (Baseline 1.0 Density)
        // Maps Size -> { gravity: G, mass: Earth-relative }
        // Gravity = Size * 0.125 | Mass = (Size / 8)^3
        WORLD_DIMENSIONS: {
            1:  { gravity: 0.125, mass: 0.0020 },
            2:  { gravity: 0.250, mass: 0.0156 },
            3:  { gravity: 0.375, mass: 0.0527 },
            4:  { gravity: 0.500, mass: 0.1250 },
            5:  { gravity: 0.625, mass: 0.2441 },
            6:  { gravity: 0.750, mass: 0.4219 },
            7:  { gravity: 0.875, mass: 0.6699 },
            8:  { gravity: 1.000, mass: 1.0000 },
            9:  { gravity: 1.125, mass: 1.4238 },
            10: { gravity: 1.250, mass: 1.9531 },
            11: { gravity: 1.375, mass: 2.5967 },
            12: { gravity: 1.500, mass: 3.3750 },
            13: { gravity: 1.625, mass: 4.2988 },
            14: { gravity: 1.750, mass: 5.3789 },
            15: { gravity: 1.875, mass: 6.6270 },
            16: { gravity: 2.000, mass: 8.0566 },
            17: { gravity: 2.125, mass: 9.6802 },
            18: { gravity: 2.250, mass: 11.510 },
            19: { gravity: 2.375, mass: 13.561 },
            20: { gravity: 2.500, mass: 15.842 }
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

        // T5 Starport Base Generation Targets (Roll <= Target)
        BASES: {
            NAVAL: {
                ALLOWED_PORTS: ['A', 'B'],
                TARGETS: { 'A': 6, 'B': 5 }
            },
            SCOUT: {
                ALLOWED_PORTS: ['A', 'B', 'C', 'D'],
                TARGETS: { 'A': 4, 'B': 5, 'C': 6, 'D': 7 }
            },
            DEPOT: {
                ALLOWED_PORTS: ['A'],
                PROBABILITY: 0.001 // 1 in 1,000 worlds
            }
        },

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
        ],

        // Climate Trade Classifications (Chart D, Book 3 p.26): UWP requirements plus a position
        // relative to the HZ (orbit - HZ orbit). hzMin/hzMax bound that position; no hzMax = any
        // orbit further out. A req left out (Fr atm) means any value.
        // ORDER MATTERS: the first entry that fits is the world's one climate code. Ho and Co are
        // climate remarks, not properly TCs (p.26), with no UWP requirements — listed after Tr and
        // Tu so a world gets Tr instead of Ho (Tu instead of Co), and Ho/Co only when it misses
        // Tr/Tu's UWP (ruling confirmed by Sean, 2026-11-01).
        CLIMATE_TRADE_CODES: [
            { code: "Tr", reqs: { size: range(6, 9), atm: range(4, 9), hydro: range(3, 7) }, hzMin: -1, hzMax: -1 },
            { code: "Tu", reqs: { size: range(6, 9), atm: range(4, 9), hydro: range(3, 7) }, hzMin: 1, hzMax: 1 },
            { code: "Fr", reqs: { size: range(2, 9), hydro: range(1, 10) }, hzMin: 2 },
            { code: "Ho", reqs: {}, hzMin: -1, hzMax: -1 },
            { code: "Co", reqs: {}, hzMin: 1, hzMax: 1 }
        ],

        CLIMATE_MAPPING: {
            "-2": "Inferno",
            "-1": "Hot / Tropic",
             "0": "Temperate",
             "1": "Cold / Tundra",
             "2": "Frozen"
        },

        // T5 Tidal Locking, Twilight Zone & Locked Satellites (Book 3: Worlds and Adventures)
        // Page refs — p.17 (Orbit 0/1 rule), p.226 (Lk day length), p.24 (Chart 2C satellite tables), p.49 (Tz world maps)
        TIDAL_LOCK: {
            LOGIC: {
                STAR_LOCK: "A Planet in Orbit 0 or Orbit 1 is tidally locked to its star. Although the world may be in the HZ, hospitable conditions are present only in a narrow Twilight Zone.",
                STAR_LOCK_SCOPE: "Applies to the Mainworld and to other worlds in the system. Fixed at Orbits 0-1; does not vary with spectral type or size.",
                PARENT_LOCK: "A Satellite in Close Orbit to its planet is Locked to it. Far Satellites are not locked.",
                SATELLITE_NO_TZ: "Satellites do not have Twilight Zones.",
                CODES: "Tz = star-locked planet (Orbit 0-1). Lk = Close Satellite locked to its planet. A star-locked planet receives Tz, never Lk. Lk, Tz, Ho, and Co refer to climate but are not properly TCs.",
                SATELLITE_CODES: "House rule: Sa is used only for a satellite mainworld, which always carries it (Close or Far); Lk is used for any satellite in a Close orbit, mainworld or not, so a Close satellite mainworld carries Sa + Lk. RAW (Chart 2C) heads the Close column =LK and the Far column =SA.",
                CHART_2C_SATELLITE: "Satellite? Is Mainworld Planet or Close or Far Satellite?",
                CHART_2C_GG: "GG? If Satellite, is parent world Gas Giant or Planet?",
                CHART_2C_ORBIT_LETTER: "Note Satellite Orbit Letter.",
                CHART_2C_CLOSE: "Close is Tidally Locked to Primary.",
                MAINWORLD_PARENT: "Ruling (Sean, 2026-11-01): the GG? column is read from a separate Flux roll, made only when the mainworld is a satellite. GG = the parent is a Gas Giant; if the system has no Gas Giant, the parent is a new BigWorld. no = the parent is a new BigWorld (Planet) in the mainworld's orbit.",
                OTHER_SATELLITES: "Ruling (Sean, 2026-11-01): Chart 2C is a mainworld chart. A satellite that is not the mainworld rolls 2D for Close (7-) or Far (8+), then Flux on the Close or Far column of Chart 2C for its orbit letter.",
                CLIMATE: "Orbit 0 or 1 is a Tz Twilight Zone World. Tz = Twilight Zone. Tidally locked with Twilight Zone, plus Hot and Cold Hemispheres.",  // Book 3 p.226, quoted
                LK_DAY_LENGTH: "For an Lk satellite, day length equals satellite orbit length.",  // Book 3 p.226, quoted
                TZ_DAY_LENGTH: "A Tz world has no day/night cycle; one hemisphere always faces the star."
            },
            STAR_LOCK_ORBITS: [0, 1],
            CLOSE_SATELLITE_MAX_ROLL: 7,   // 2D: 7- = Close (Lk), 8+ = Far
            CODES: { STAR_LOCKED: 'Tz', PARENT_LOCKED: 'Lk', SATELLITE: 'Sa' },

            // Chart 2C (Book 3 p.24): Satellite? (mainworld only), GG? (separate Flux roll) and Satellite Orbit Letter.
            // Each column is read with Flux; rows -6 and +6 are reachable only with a modifier.
            CHART_2C: {
                FLUX_MIN: -6,
                FLUX_MAX: 6,
                // Satellite? — any Flux not listed means the mainworld is a Planet
                MAINWORLD_SATELLITE: { '-5': 'Far', '-4': 'Far', '-3': 'Close' },
                // GG? — Flux at or below this = Gas Giant parent; above = Planet parent
                PARENT_GAS_GIANT_MAX_FLUX: 0,
                ORBITS: {
                    CLOSE: {
                        '-6': { letter: 'A', name: 'Ay' },
                        '-5': { letter: 'B', name: 'Bee' },
                        '-4': { letter: 'C', name: 'Cee' },
                        '-3': { letter: 'D', name: 'Dee' },
                        '-2': { letter: 'E', name: 'Ee' },
                        '-1': { letter: 'F', name: 'Eff' },
                        '0':  { letter: 'G', name: 'Gee' },
                        '1':  { letter: 'H', name: 'Aitch' },
                        '2':  { letter: 'I', name: 'Eye' },
                        '3':  { letter: 'J', name: 'Jay' },
                        '4':  { letter: 'K', name: 'Kay' },
                        '5':  { letter: 'L', name: 'Ell' },
                        '6':  { letter: 'M', name: 'Em' }
                    },
                    FAR: {
                        '-6': { letter: 'N', name: 'En' },
                        '-5': { letter: 'O', name: 'Oh' },
                        '-4': { letter: 'P', name: 'Pee' },
                        '-3': { letter: 'Q', name: 'Que' },
                        '-2': { letter: 'R', name: 'Arr' },
                        '-1': { letter: 'S', name: 'Ess' },
                        '0':  { letter: 'T', name: 'Tee' },
                        '1':  { letter: 'U', name: 'Yu' },
                        '2':  { letter: 'V', name: 'Vee' },
                        '3':  { letter: 'W', name: 'Dub' },
                        '4':  { letter: 'X', name: 'Ex' },
                        '5':  { letter: 'Y', name: 'Wye' },
                        '6':  { letter: 'Z', name: 'Zee' }
                    }
                }
            },

            // Tz world map: day side, night side, and a twilight strip between them
            MAP: {
                TWILIGHT_WIDTH_WORLD_HEXES: 1,   // 1,000 km
                ZONES: {
                    BAKED:    { code: 41, side: 'star-facing', oceanBecomes: 'Desert' },
                    TWILIGHT: { code: 42, side: 'terminator',  oceanBecomes: null },  // normal terrain and liquid water
                    FROZEN:   { code: 43, side: 'dark-facing', oceanBecomes: 'Ice Fields' }
                },
                TERMINATOR: "The boundary between day and night sides is drawn as a vertical line between the poles."
            }
        }
    };
}));