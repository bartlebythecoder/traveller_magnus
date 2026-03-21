/**
 * PROJECT AS ABOVE, SO BELOW
 * Layer 1: The Data Shield (Mongoose 2nd Edition)
 * Description: Pure declarative data structure for MgT2E generation sequences.
 * This file contains zero execution logic.
 */

const MgT2EData = {
    // =========================================================================
    // MAINWORLD / BASIC PROFILE
    // =========================================================================
    rollModifiers: {
        size: -2,
        atmosphere: -7, // Adds Size automatically in engine
        hydrographics: -7, // Adds Atmo automatically in engine
        population: -2,
        government: -7, // Adds Pop automatically in engine
        lawLevel: -7 // Adds Gov automatically in engine
    },

    extremeAtmosphereHydroDM: {
        triggerAtmospheres: [0, 1, 10, 11, 12, 13, 14, 15],
        modifier: -4
    },

    starport: {
        populationDMs: [
            { minPop: 10, maxPop: 15, dm: 2 },
            { minPop: 8, maxPop: 9, dm: 1 },
            { minPop: 3, maxPop: 4, dm: -1 },
            { minPop: 0, maxPop: 2, dm: -2 }
        ],
        classMap: [
            { maxRoll: 2, class: 'X' },
            { maxRoll: 4, class: 'E' },
            { maxRoll: 6, class: 'D' },
            { maxRoll: 8, class: 'C' },
            { maxRoll: 10, class: 'B' },
            { maxRoll: 99, class: 'A' } // Catch-all for 11+
        ],
        nativeSophontDM: -2,
        regionalDMs: { frontier: -1, core: 1 }
    },

    techLevel: {
        modifiers: {
            starport: { "A": 6, "B": 4, "C": 2, "D": 1, "E": 1, "X": -4, "F": 1 },
            size: { "0": 2, "1": 2, "2": 1, "3": 1, "4": 1 },
            atm: { "0": 1, "1": 1, "2": 1, "3": 1, "10": 1, "11": 1, "12": 1, "13": 1, "14": 1, "15": 1, "16": 1, "17": 1 },
            hydro: { "0": 1, "9": 1, "10": 2 },
            pop: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "8": 1, "9": 2, "10": 4, "11": 4, "12": 4, "13": 4, "14": 4, "15": 4 },
            gov: { "0": 1, "5": 1, "7": 2, "13": -2, "14": -2, "15": -2 }
        },
        environmentalMinimums: {
            "0": 8, "1": 8, "2": 5, "3": 5, "4": 3, "7": 3, "9": 3,
            "10": 8, "11": 9, "12": 10, "13": 5, "14": 5, "15": 8, "16": 14, "17": 14
        },
        nativeSophontExceptions: {
            ignoreDMs: ['size', 'atm', 'hydro'],
            ignoreEnvironmentalMinimums: true
        }
    },

    bases: {
        military: [
            { starports: ["A", "B"], target: 8 },
            { starports: ["C"], target: 10 }
        ],
        naval: [
            { starports: ["A", "B"], target: 8 }
        ],
        scout: [
            { starports: ["A"], target: 10 },
            { starports: ["B", "C"], target: 9 },
            { starports: ["D"], target: 8 }
        ],
        corsair: [
            { starports: ["D"], target: 12 },
            { starports: ["E", "X"], target: 10 }
        ],
        corsairLawDMs: [
            { law: 0, dm: 2 },
            { minLaw: 2, maxLaw: 15, dm: -2 }
        ]
    },

    systemFeatures: {
        gasGiantTarget: 9
    },

    travelZones: {
        amberConditions: {
            minAtm: 10,
            govList: [0, 7, 10],
            lawConditions: { lawZero: true, minLaw: 9 }
        },
        redConditions: {
            starport: "X"
        },
        emergentRules: {
            amberThreshold: 12,
            redThreshold: 12,
            amberDMs: {
                hostileAtmo: { types: ['B', 'C', 'F'], dm: 2 }, // Example DM for hostility
                gov0_7: 1,
                law0: 1
            },
            redDMs: {
                magnetar: 10,
                pulsar: 8,
                protostar: 6,
                primitiveSophonts: 4 // TL 0-3
            }
        }
    },

    tradeCodes: {
        Ag: { minAtm: 4, maxAtm: 9, minHydro: 4, maxHydro: 8, minPop: 5, maxPop: 7 },
        As: { minSize: 0, maxSize: 0, minAtm: 0, maxAtm: 0, minHydro: 0, maxHydro: 0 },
        Ba: { minPop: 0, maxPop: 0, minGov: 0, maxGov: 0, minLaw: 0, maxLaw: 0 },
        De: { minAtm: 2, maxAtm: 9, minHydro: 0, maxHydro: 0 },
        Fl: { minAtm: 10, maxAtm: 17, minHydro: 1, maxHydro: 10 },
        Ga: { minSize: 6, maxSize: 8, validAtms: [5, 6, 8], minHydro: 5, maxHydro: 7 },
        Hi: { minPop: 9, maxPop: 15 },
        Ht: { minTl: 12, maxTl: 33 },
        Ic: { minAtm: 0, maxAtm: 1, minHydro: 1, maxHydro: 10 },
        In: { validAtms: [0, 1, 2, 4, 7, 9, 10, 11, 12], minPop: 9, maxPop: 15 },
        Lo: { minPop: 1, maxPop: 3 },
        Lt: { minTl: 0, maxTl: 5 },
        Na: { minAtm: 0, maxAtm: 3, minHydro: 0, maxHydro: 3, minPop: 6, maxPop: 15 },
        Ni: { minPop: 4, maxPop: 6 },
        Po: { minAtm: 2, maxAtm: 5, minHydro: 0, maxHydro: 3 },
        Ri: { validAtms: [6, 8], minPop: 6, maxPop: 8, minGov: 4, maxGov: 9 },
        Va: { minAtm: 0, maxAtm: 0 },
        Wa: { complexAtmHydro: true, atmRanges: [[3, 9], [13, 17]], minHydro: 10, maxHydro: 10 }
    },

    // =========================================================================
    // STELLAR & ORBITAL GENERATION
    // =========================================================================
    stellar: {
        primaryType: [
            { maxRoll: 2, type: 'M', class: 'VI' },
            { maxRoll: 6, type: 'M', class: 'V' },
            { maxRoll: 8, type: 'K', class: 'V' },
            { maxRoll: 10, type: 'G', class: 'V' },
            { maxRoll: 11, type: 'F', class: 'V' },
            { maxRoll: 99, type: 'Hot' }
        ],
        bottomUpPrimaryType: [
            { maxRoll: 2, type: 'Special' },
            { maxRoll: 6, type: 'M', class: 'V' },
            { maxRoll: 8, type: 'K', class: 'V' },
            { maxRoll: 10, type: 'G', class: 'V' },
            { maxRoll: 11, type: 'F', class: 'V' },
            { maxRoll: 99, type: 'Hot' }
        ],
        hotType: [
            { maxRoll: 9, type: 'A', class: 'V' },
            { maxRoll: 11, type: 'B', class: 'V' },
            { maxRoll: 99, type: 'O', class: 'V' }
        ],
        bottomUpSpecialType: [
            { maxRoll: 5, sClass: 'VI' },
            { maxRoll: 8, sClass: 'IV' },
            { maxRoll: 10, sClass: 'III' },
            { maxRoll: 99, sClass: 'Giants' } // Keeping this as a string to trigger the next table
        ],
        bottomUpGiantsType: [
            { maxRoll: 8, sClass: 'III' }, // 2, 3, 4, 5, 6, 7, 8 -> Giant
            { maxRoll: 10, sClass: 'II' }, // 9, 10 -> Bright Giant
            { maxRoll: 11, sClass: 'Ib' }, // 11 -> Less Luminous Supergiant
            { maxRoll: 99, sClass: 'Ia' }  // 12 -> Luminous Supergiant
        ],
        bottomUpUnusualType: [
            { maxRoll: 2, result: 'Peculiar' }, // 2 -> Peculiar Sub-table
            { maxRoll: 3, sClass: 'VI' },       // 3 -> Sub-Dwarf
            { maxRoll: 4, sClass: 'IV' },       // 4 -> Sub-Giant
            { maxRoll: 7, sType: 'BD' },       // 5, 6, 7 -> Brown Dwarf
            { maxRoll: 10, sType: 'D' },        // 8, 9, 10 -> White Dwarf
            { maxRoll: 11, sClass: 'III' },     // 11 -> Giant
            { maxRoll: 99, result: 'Giants' }   // 12 -> Giants Sub-table
        ],
        bottomUpPeculiarType: [
            { maxRoll: 2, result: 'Black Hole' },
            { maxRoll: 3, result: 'Pulsar' },
            { maxRoll: 4, result: 'Neutron Star' },
            { maxRoll: 6, result: 'Nebula' },      // 5, 6
            { maxRoll: 9, result: 'Protostar' },   // 7, 8, 9
            { maxRoll: 10, result: 'Star Cluster' },
            { maxRoll: 99, result: 'Anomaly' }     // 11, 12
        ],
        bottomUpRealisticPrimaryType: [
            { maxRoll: 2, type: 'Special' },
            { maxRoll: 8, type: 'M', class: 'V' },
            { maxRoll: 9, type: 'K', class: 'V' },
            { maxRoll: 10, type: 'G', class: 'V' },
            { maxRoll: 11, type: 'F', class: 'V' },
            { maxRoll: 99, type: 'Hot' }
        ],
        companionDetermination: {
            secondary: [
                { maxRoll: 3, determination: 'Other' },
                { maxRoll: 6, determination: 'Random' },
                { maxRoll: 8, determination: 'Lesser' },
                { maxRoll: 10, determination: 'Sibling' },
                { maxRoll: 99, determination: 'Twin' }
            ],
            companion: [
                { maxRoll: 3, determination: 'Other' },
                { maxRoll: 5, determination: 'Random' },
                { maxRoll: 7, determination: 'Lesser' },
                { maxRoll: 9, determination: 'Sibling' },
                { maxRoll: 99, determination: 'Twin' }
            ]
        },
        starStats: {
            'O': { mass: 60, diam: 12, lum: 330000, temp: 40000 },
            'B': { mass: 10, diam: 3.5, lum: 550, temp: 15000 },
            'A': { mass: 2.3, diam: 2, lum: 15, temp: 8000 },
            'F': { mass: 1.5, diam: 1.5, lum: 3.5, temp: 6500 },
            'G': { mass: 1.1, diam: 1.0, lum: 1.0, temp: 5800 },
            'K': { mass: 0.7, diam: 0.8, lum: 0.2, temp: 4400 },
            'M': { mass: 0.3, diam: 0.4, lum: 0.05, temp: 3000 },
            'BD': { mass: 0.05, diam: 0.1, lum: 0.0001, temp: 1500 },
            'D': { mass: 0.6, diam: 0.01, lum: 0.001, temp: 10000 }
        },
        mao: {
            'O0': [0.63, 0.60, 0.55, 0.53, Infinity, 0.5, 0.01],
            'O5': [0.55, 0.50, 0.45, 0.38, Infinity, 0.3, 0.01],
            'B0': [0.50, 0.35, 0.30, 0.25, 0.20, 0.18, 0.01],
            'B5': [1.67, 0.63, 0.35, 0.15, 0.13, 0.09, 0.01],
            'A0': [3.34, 1.40, 0.75, 0.13, 0.10, 0.06, Infinity],
            'A5': [4.17, 2.17, 1.17, 0.13, 0.07, 0.05, Infinity],
            'F0': [4.42, 2.50, 1.33, 0.13, 0.07, 0.04, Infinity],
            'F5': [5.00, 3.25, 1.87, 0.13, 0.06, 0.03, Infinity],
            'G0': [5.21, 3.59, 2.24, 0.25, 0.07, 0.03, 0.02],
            'G5': [5.34, 3.84, 2.67, 0.38, 0.10, 0.02, 0.02],
            'K0': [5.59, 4.17, 3.17, 0.50, 0.15, 0.02, 0.02],
            'K5': [6.17, 4.84, 4.00, 1.00, Infinity, 0.02, 0.01],
            'M0': [6.80, 5.42, 4.59, 1.68, Infinity, 0.02, 0.01],
            'M5': [7.20, 6.17, 5.30, 3.00, Infinity, 0.01, 0.01],
            'M9': [7.80, 6.59, 5.92, 4.34, Infinity, 0.01, 0.01],
        },
        orbitAu: [
            0, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10, 20, 40, 77, 154, 308, 615, 1230, 2500, 4900, 9800, 19500, 39500, 78700
        ],
        hzDeviation: {
            2: 1.1, 3: 1.0, 4: 0.5, 5: 0.2, 6: 0.1,
            7: 0.0, 8: -0.1, 9: -0.2, 10: -0.5, 11: -1.0, 12: -1.1
        },
        sClassIdx: { 'Ia': 0, 'Ib': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6 },
        densityLookup: {
            "2": { "Exotic Ice": 0.03, "Mostly Ice": 0.18, "Mostly Rock": 0.50, "Rock and Metal": 0.82, "Mostly Metal": 1.15, "Compressed Metal": 1.50 },
            "3": { "Exotic Ice": 0.06, "Mostly Ice": 0.21, "Mostly Rock": 0.53, "Rock and Metal": 0.85, "Mostly Metal": 1.18, "Compressed Metal": 1.55 },
            "4": { "Exotic Ice": 0.09, "Mostly Ice": 0.24, "Mostly Rock": 0.56, "Rock and Metal": 0.88, "Mostly Metal": 1.21, "Compressed Metal": 1.60 },
            "5": { "Exotic Ice": 0.12, "Mostly Ice": 0.27, "Mostly Rock": 0.59, "Rock and Metal": 0.91, "Mostly Metal": 1.24, "Compressed Metal": 1.65 },
            "6": { "Exotic Ice": 0.15, "Mostly Ice": 0.30, "Mostly Rock": 0.62, "Rock and Metal": 0.94, "Mostly Metal": 1.27, "Compressed Metal": 1.70 },
            "7": { "Exotic Ice": 0.18, "Mostly Ice": 0.33, "Mostly Rock": 0.65, "Rock and Metal": 0.97, "Mostly Metal": 1.30, "Compressed Metal": 1.75 },
            "8": { "Exotic Ice": 0.21, "Mostly Ice": 0.36, "Mostly Rock": 0.68, "Rock and Metal": 1.00, "Mostly Metal": 1.33, "Compressed Metal": 1.80 },
            "9": { "Exotic Ice": 0.24, "Mostly Ice": 0.39, "Mostly Rock": 0.71, "Rock and Metal": 1.03, "Mostly Metal": 1.36, "Compressed Metal": 1.85 },
            "10": { "Exotic Ice": 0.27, "Mostly Ice": 0.41, "Mostly Rock": 0.74, "Rock and Metal": 1.06, "Mostly Metal": 1.39, "Compressed Metal": 1.90 },
            "11": { "Exotic Ice": 0.30, "Mostly Ice": 0.44, "Mostly Rock": 0.77, "Rock and Metal": 1.09, "Mostly Metal": 1.42, "Compressed Metal": 1.95 },
            "12": { "Exotic Ice": 0.33, "Mostly Ice": 0.47, "Mostly Rock": 0.80, "Rock and Metal": 1.12, "Mostly Metal": 1.45, "Compressed Metal": 2.00 }
        }
    },

    systemInventory: {
        gasGiants: [
            { maxRoll: 4, count: 1 },
            { maxRoll: 6, count: 2 },
            { maxRoll: 8, count: 3 },
            { maxRoll: 11, count: 4 },
            { maxRoll: 12, count: 5 },
            { maxRoll: 99, count: 6 }
        ],
        gasGiantDMs: {
            singleClassV: 1,
            primaryBrownDwarf: -2,
            primaryPostStellar: -2,
            perPostStellar: -1,
            fourOrMoreStars: -1
        },
        planetoidBelts: [
            { maxRoll: 6, count: 1 },
            { maxRoll: 11, count: 2 },
            { maxRoll: 99, count: 3 }
        ],
        planetoidBeltDMs: {
            gasGiantsPresent: 1,
            primaryProtostar: 3,
            primaryPrimordial: 2,
            primaryPostStellar: 1,
            perPostStellar: 1,
            multiStar: 1
        },
        terrestrialPlanets: {
            baseFormula: "2D-2",
            threshold: 3,
            belowThresholdFormula: "D3+2",
            aboveThresholdModifier: "D3-1",
            dms: {
                perPostStellar: -1
            }
        }
    },

    // =========================================================================
    // ATMOSPHERICS & PLANETARY PHYSICS
    // =========================================================================
    atmosphereExtended: {
        hzDeviationTables: {
            hotInner: [0, 1, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 11, 12, 15, 16, 17],
            hotOuter: [0, 0, 1, 1, 10, 10, 10, 10, 10, 11, 11, 11, 12, 11, 12, 15, 16, 17],
            coldInner: [0, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 13, 11, 15, 16, 17],
            coldOuter: [0, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 16, 17, 15, 17, 17]
        },
        gasRetentionData: [
            { id: "H-", name: "Hydrogen Ion", ev: 24.00, bp: 20, weight: 0, taint: false },
            { id: "H2", name: "Hydrogen", ev: 12.00, bp: 20, weight: 1200, taint: false },
            { id: "He", name: "Helium", ev: 6.00, bp: 4, weight: 400, taint: false },
            { id: "CH4", name: "Methane", ev: 1.50, bp: 113, weight: 70, taint: true },
            { id: "NH3", name: "Ammonia", ev: 1.42, bp: 240, weight: 30, taint: true },
            { id: "H2O", name: "Water Vapour", ev: 1.33, bp: 373, weight: 100, taint: false },
            { id: "HF", name: "Hydrofluoric Acid", ev: 1.20, bp: 293, weight: 2, taint: true },
            { id: "Ne", name: "Neon", ev: 1.20, bp: 27, weight: 50, taint: false },
            { id: "Na", name: "Sodium", ev: 1.04, bp: 1156, weight: 40, taint: true },
            { id: "N2", name: "Nitrogen", ev: 0.86, bp: 77, weight: 60, taint: false },
            { id: "CO", name: "Carbon Monoxide", ev: 0.86, bp: 82, weight: 70, taint: true },
            { id: "HCN", name: "Hydrogen Cyanide", ev: 0.86, bp: 299, weight: 30, taint: true },
            { id: "C2H6", name: "Ethane", ev: 0.80, bp: 184, weight: 70, taint: true },
            { id: "O2", name: "Oxygen", ev: 0.75, bp: 90, weight: 50, taint: false },
            { id: "HCl", name: "Hydrochloric Acid", ev: 0.67, bp: 321, weight: 1, taint: true },
            { id: "F2", name: "Fluorine", ev: 0.63, bp: 85, weight: 2, taint: true },
            { id: "Ar", name: "Argon", ev: 0.60, bp: 87, weight: 20, taint: false },
            { id: "CO2", name: "Carbon Dioxide", ev: 0.55, bp: 216, weight: 70, taint: true },
            { id: "CH3NO", name: "Formamide", ev: 0.53, bp: 483, weight: 15, taint: true },
            { id: "CH2O2", name: "Formic Acid", ev: 0.52, bp: 374, weight: 15, taint: true },
            { id: "SO2", name: "Sulphur Dioxide", ev: 0.38, bp: 263, weight: 20, taint: true },
            { id: "Cl2", name: "Chlorine", ev: 0.34, bp: 239, weight: 1, taint: true },
            { id: "Kr", name: "Krypton", ev: 0.29, bp: 120, weight: 2, taint: false },
            { id: "H2SO4", name: "Sulphuric Acid", ev: 0.24, bp: 718, weight: 20, taint: true }
        ],
        unusualSubtypes: {
            "11": { name: "Dense, Extreme", code: "1", minPressure: 10 },
            "12": { name: "Dense, Very Extreme", code: "2", minPressure: 100 },
            "13": { name: "Dense, Crushing", code: "3", minPressure: 1000 },
            "14": { name: "Ellipsoid", code: "4" },
            "15": { name: "High Radiation", code: "5" },
            "16": { name: "Layered", code: "6", minGravity: 1.21 },
            "21": { name: "Panthalassic", code: "7", minHydro: 10, minPressure: 1.1 },
            "22": { name: "Steam", code: "8", minHydro: 5, minPressure: 2.5 },
            "23": { name: "Variable Pressure", code: "9" },
            "24": { name: "Variable Composition", code: "A" },
            "25": { name: "Combination", code: "-" },
            "26": { name: "Unusual", code: "F" }
        }
    },

    // =========================================================================
    // PLANETOID BELTS
    // =========================================================================
    belts: {
        compositionTable: [
            { m: 65, s: 35, c: 0 },  // 0 or less
            { m: 55, s: 40, c: 5 },  // 1
            { m: 45, s: 45, c: 10 }, // 2
            { m: 35, s: 55, c: 10 }, // 3
            { m: 25, s: 65, c: 10 }, // 4
            { m: 15, s: 75, c: 10 }, // 5
            { m: 5, s: 45, c: 50 }, // 6
            { m: 5, s: 35, c: 60 }, // 7
            { m: 5, s: 25, c: 70 }, // 8
            { m: 2, s: 18, c: 80 }, // 9
            { m: 1, s: 9, c: 90 }, // 10
            { m: 0, s: 5, c: 95 }, // 11
            { m: 0, s: 0, c: 100 } // 12+
        ]
    },

    // =========================================================================
    // SECONDARY CLASSIFICATIONS
    // =========================================================================
    secondaryClassifications: {
        farming: { maxHzcoDeviation: 1.0, minAtm: 4, maxAtm: 9, minHydro: 4, maxHydro: 8, minPop: 2 },
        mining: { requiresMwTradeCode: "In", minPop: 2, beltDm: 4, targetRoll: 8 },
        researchBase: { minMwPop: 6, minMwTl: 8, prohibitsMwTradeCode: "Po", targetRoll: 10, mwTl12Dm: 2 },
        militaryBase: { minMwTl: 8, prohibitsMwTradeCode: "Po", requiredGov: 6, targetRoll: 12 },
        penalColony: { minMwTl: 9, minMwLaw: 8, requiredGov: 6, targetRoll: 10 }
    },

    // =========================================================================
    // SOCIOECONOMICS & PROFILES
    // =========================================================================
    socioeconomics: {
        governmentProfile: {
            centralisation: [
                { maxRoll: 5, code: "C" },
                { maxRoll: 8, code: "F" },
                { maxRoll: 99, code: "U" }
            ],
            authority: [
                { match: [4, 8], code: "L" },
                { match: [6, 11], code: "J" },
                { match: [7, 9], code: "B" },
                { default: "E" }
            ],
            structureFallback: [
                { maxRoll: 3, code: "D" },
                { maxRoll: 4, code: "S" },
                { maxRoll: 6, code: "M" },
                { maxRoll: 8, code: "R" },
                { maxRoll: 9, code: "M" },
                { maxRoll: 10, code: "S" },
                { maxRoll: 11, code: "M" },
                { maxRoll: 99, code: "S" }
            ]
        },
        lawProfile: {
            justice: [{ maxRoll: 5, code: "I" }, { maxRoll: 99, code: "A" }],
            presumptionOfInnocence: [{ minTotal: 0, code: "Y" }, { maxTotal: -1, code: "N" }],
            deathPenalty: [{ minTotal: 8, code: "Y" }, { maxTotal: 7, code: "N" }]
        },
        techProfile: {
            tlmTable: { "2": -3, "3": -2, "4": -1, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 1, "11": 2, "12": 3 }
        },
        economicProfile: {
            gwpMultipliers: {
                starport: { "A": 1.5, "B": 1.2, "C": 1.0, "D": 0.8, "E": 0.5, "F": 0.9, "G": 0.7, "H": 0.4, "Y": 0.2, "X": 0.2 },
                gov: { "1": 1.5, "2": 1.2, "3": 0.8, "4": 1.2, "5": 1.3, "6": 0.6, "7": 1.0, "8": 0.9, "9": 0.8, "11": 0.7, "13": 0.6, "14": 0.5, "15": 0.8 },
                tradeCodes: { "Ag": 0.9, "As": 1.2, "Ga": 1.2, "In": 1.1, "Na": 0.9, "Ni": 0.9, "Po": 0.8, "Ri": 1.2 }
            },
            wtnStarportModifiers: [
                { maxWtnBase: 1, mods: { A: 3, B: 2, C: 2, D: 1, E: 1, X: 0 } },
                { maxWtnBase: 3, mods: { A: 2, B: 2, C: 1, D: 1, E: 0, X: 0 } },
                { maxWtnBase: 5, mods: { A: 2, B: 1, C: 1, D: 0, E: 0, X: -5 } },
                { maxWtnBase: 7, mods: { A: 1, B: 1, C: 0, D: 0, E: -1, X: -6 } },
                { maxWtnBase: 9, mods: { A: 1, B: 0, C: 0, D: -1, E: -2, X: -7 } },
                { maxWtnBase: 11, mods: { A: 0, B: 0, C: -1, D: -2, E: -3, X: -8 } },
                { maxWtnBase: 13, mods: { A: 0, B: -1, C: -2, D: -3, E: -4, X: -9 } },
                { maxWtnBase: 99, mods: { A: 0, B: -2, C: -3, D: -4, E: -5, X: -10 } }
            ]
        }
    },

    // =========================================================================
    // WBH SECONDARY WORLD GUIDELINES (Rule Zero Compliance)
    // =========================================================================
    secondaryWorldGuidelines: {
        "Colony": {
            baselineTl: (mwTl, floor) => Math.max(mwTl - 1, floor),
            subcategoryUpperBound: "Mainworld"
        },
        "Farming": {
            baselineTl: (mwTl, floor) => Math.max(mwTl - 1, floor),
            subcategoryUpperBound: "Mainworld"
        },
        "Penal Colony": {
            baselineTl: (mwTl, floor) => Math.max(mwTl - 1, floor),
            subcategoryUpperBound: "Mainworld"
        },
        "All Others": {
            baselineTl: (mwTl, floor) => Math.max(mwTl - 1, floor),
            subcategoryUpperBound: "Mainworld"
        },
        "Military Base": {
            baselineTl: (mwTl, floor) => mwTl,
            subcategoryUpperBound: "Mainworld"
        },
        "Research Base": {
            baselineTl: (mwTl, floor) => mwTl,
            subcategoryUpperBound: "Mainworld"
        },
        "Mining": {
            baselineTl: (mwTl, floor) => Math.max(mwTl, floor),
            subcategoryUpperBound: "Mainworld"
        }
    },

    auditorRules: {
        strictFailure: true, // Overridden by USER: Keep as strict [FAIL]
        reason: "Rule Zero allows Referee fiat, but project maintains strict consistency for audit trails."
    }
};

// Universal Module Definition (UMD) compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MgT2EData;
} else if (typeof window !== 'undefined') {
    window.MgT2EData = MgT2EData;
}