// ============================================================================
// TRAVELLER MAGNUS - CONSTANTS
// ============================================================================
// Large data objects for world generation across multiple Traveller editions.
// These constants preserve the exact logic for CT, MgT2E, and T5 rulesets.
// ============================================================================

// --- CT (Classic Traveller) Book 6 Scouts Constants ---

const ZONE_TABLES = {
    'V': {
        'B0': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'H', 'O', 'O'],
        'B5': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'O', 'O', 'O', 'O', 'O', 'H', 'O'],
        'A0': ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
        'A5': ['I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O'],
        'F0': ['I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'F5': ['I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'G0': ['I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'G5': ['I', 'I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'K0': ['I', 'H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'K5': ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'M0': ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'M5': ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        'M9': ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O', 'O']
    },
    'IV': {
        'B0': ['-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'I'],
        'B5': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I'],
        'A0': ['-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I'],
        'A5': ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I'],
        'F0': ['I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I'],
        'F5': ['I', 'I', 'I', 'I', 'I', 'H', 'H', 'H', 'O'],
        'G0': ['I', 'I', 'I', 'I', 'I', 'H', 'H', 'H', 'O'],
        'G5': ['I', 'I', 'I', 'I', 'I', 'H', 'H', 'H', 'O'],
        'K0': ['I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O']
    },
    'III': {
        'B0': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', '-'],
        'B5': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', '-'],
        'A0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'O', 'O', 'O'],
        'A5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'F0': [null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
        'F5': [null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
        'G0': [null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O', 'O'],
        'G5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'K0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'K5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'M0': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'M5': [null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'M9': [null, '-', '-', '-', '-', '-', '-', '-', 'I', 'H', 'O', 'O']
    },
    'II': {
        'B0': [null, '-', '-', '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H'],
        'B5': [null, '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'A0': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'A5': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'F0': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'F5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'G0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'G5': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O', 'O'],
        'K0': [null, 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'K5': [null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'M0': [null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'M5': [null, '-', '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'M9': [null, '-', '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O']
    },
    'Ib': {
        'B0': [null, null, null, null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'I', 'H'],
        'B5': [null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'A0': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'A5': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'F0': [null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'F5': [null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'G0': [null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'G5': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'K0': [null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O', 'O'],
        'K5': [null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'M0': [null, null, null, null, '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'M5': [null, null, null, null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O'],
        'M9': [null, null, null, null, '-', '-', '-', '-', 'I', 'I', 'I', 'I', 'H', 'O']
    },
    'Ia': {
        'B0': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'I', 'H'],
        'B5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'A0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'A5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'F0': [null, null, null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'F5': [null, null, null, null, null, null, 'I', 'I', 'I', 'I', 'I', 'H', 'O', 'O'],
        'G0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'G5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'K0': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'K5': [null, null, null, null, null, null, '-', 'I', 'I', 'I', 'I', 'I', 'H', 'O'],
        'M0': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'H', 'O'],
        'M5': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'H', 'O'],
        'M9': [null, null, null, null, null, null, '-', '-', 'I', 'I', 'I', 'I', 'H', 'O']
    },
    'VI': {
        'F5': ['I', 'I', 'I', 'H', 'O'],
        'G0': ['I', 'I', 'H', 'O', 'O'],
        'G5': ['I', 'H', 'O', 'O', 'O'],
        'K0': ['I', 'H', 'O', 'O', 'O'],
        'K5': ['O', 'O', 'O', 'O', 'O'],
        'M0': ['O', 'O', 'O', 'O', 'O'],
        'M5': ['O', 'O', 'O', 'O', 'O'],
        'M9': ['O', 'O', 'O', 'O', 'O']
    },
    'D': {
        'DB': ['H', 'O', 'O', 'O', 'O'],
        'DA': ['O', 'O', 'O', 'O', 'O'],
        'DF': ['O', 'O', 'O', 'O', 'O'],
        'DG': ['O', 'O', 'O', 'O', 'O'],
        'DK': ['O', 'O', 'O', 'O', 'O'],
        'DM': ['O', 'O', 'O', 'O', 'O']
    }
};

const CT_BASIC_NATURE_TABLE = ['Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Solo', 'Binary', 'Binary', 'Binary', 'Binary', 'Trinary'];
const CT_PRI_TYPE_TABLE = ['B', 'B', 'A', 'M', 'M', 'M', 'M', 'M', 'K', 'G', 'F', 'F', 'F'];
const CT_PRI_SIZE_TABLE = ['Ia', 'Ib', 'II', 'III', 'IV', 'V', 'V', 'V', 'V', 'V', 'V', 'VI', 'D'];
const CT_COMP_TYPE_TABLE = ['M', 'B', 'A', 'F', 'F', 'G', 'G', 'K', 'K', 'M', 'M', 'M', 'M'];
const CT_COMP_SIZE_TABLE = ['Ia', 'Ib', 'II', 'III', 'IV', 'D', 'D', 'V', 'V', 'VI', 'D', 'D', 'D'];

// --- MgT2E (Mongoose Traveller 2nd Edition) Constants ---

const MGT2E_ORBIT_AU = [
    0, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10, 20, 40, 77, 154, 308, 615, 1230, 2500, 4900, 9800, 19500, 39500, 78700
];

const MGT2E_STAR_STATS = {
    'O': { mass: 60, diam: 12, lum: 330000, temp: 40000 },
    'B': { mass: 10, diam: 3.5, lum: 550, temp: 15000 },
    'A': { mass: 2.3, diam: 2, lum: 15, temp: 8000 },
    'F': { mass: 1.5, diam: 1.5, lum: 3.5, temp: 6500 },
    'G': { mass: 1.1, diam: 1.0, lum: 1.0, temp: 5800 },
    'K': { mass: 0.7, diam: 0.8, lum: 0.2, temp: 4400 },
    'M': { mass: 0.3, diam: 0.4, lum: 0.05, temp: 3000 },
    'BD': { mass: 0.05, diam: 0.1, lum: 0.0001, temp: 1500 },
    'D': { mass: 0.6, diam: 0.01, lum: 0.001, temp: 10000 }
};

const MGT2E_HZ_DEVIATION = {
    2: 1.1, 3: 1.0, 4: 0.5, 5: 0.2, 6: 0.1,
    7: 0.0, 8: -0.1, 9: -0.2, 10: -0.5, 11: -1.0, 12: -1.1
};

const MGT2E_MAO = {
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
};

const MGT2E_ATM_CODES = {
    0: { pressStr: "0.00-0.0009", minP: 0.00, spanP: 0.00, gear: "Vacc Suit" },
    1: { pressStr: "0.001-0.09", minP: 0.001, spanP: 0.089, gear: "Vacc Suit" },
    2: { pressStr: "0.1-0.42", minP: 0.1, spanP: 0.32, gear: "Respirator and Filter" },
    3: { pressStr: "0.1-0.42", minP: 0.1, spanP: 0.32, gear: "Respirator" },
    4: { pressStr: "0.43-0.70", minP: 0.43, spanP: 0.27, gear: "Filter" },
    5: { pressStr: "0.43-0.70", minP: 0.43, spanP: 0.27, gear: "None" },
    6: { pressStr: "0.70-1.49", minP: 0.70, spanP: 0.79, gear: "None" },
    7: { pressStr: "0.70-1.49", minP: 0.70, spanP: 0.79, gear: "Filter" },
    8: { pressStr: "1.50-2.49", minP: 1.50, spanP: 0.99, gear: "None" },
    9: { pressStr: "1.50-2.49", minP: 1.50, spanP: 0.99, gear: "Filter" },
    10: { pressStr: "Varies", minP: 0.0, spanP: 0.0, gear: "Air Supply" },
    11: { pressStr: "Varies", minP: 0.0, spanP: 0.0, gear: "Vacc Suit" },
    12: { pressStr: "Varies", minP: 0.0, spanP: 0.0, gear: "Vacc Suit" },
    13: { pressStr: "2.50-10.0+", minP: 2.50, spanP: 7.50, gear: "Varies" },
    14: { pressStr: "0.10-0.42", minP: 0.10, spanP: 0.32, gear: "Varies" },
    15: { pressStr: "Varies", minP: 0.0, spanP: 0.0, gear: "Varies" }
};

const MGT2E_TAINT_SUBTYPES = {
    2: "Low Oxygen", 3: "Radioactivity", 4: "Biologic", 5: "Gas Mix", 6: "Particulates", 7: "Gas Mix",
    8: "Sulphur Compounds", 9: "Biologic", 10: "Particulates", 11: "Radioactivity", 12: "High Oxygen"
};

const MGT2E_TAINT_SEVERITY = {
    1: "Trivial irritant", 2: "Surmountable irritant", 3: "Minor irritant", 4: "Major irritant",
    5: "Serious irritant", 6: "Hazardous irritant", 7: "Long term lethal", 8: "Inevitably lethal", 9: "Rapidly lethal"
};

const MGT2E_HYDRO_RANGES = {
    0: 0, 1: 6, 2: 16, 3: 26, 4: 36, 5: 46, 6: 56, 7: 66, 8: 76, 9: 86, 10: 96
};

const MGT2E_SURFACE_DISTS = [
    "Extremely Dispersed", "Very Dispersed", "Dispersed", "Scattered", "Slightly Scattered", "Mixed",
    "Slightly Skewed", "Skewed", "Concentrated", "Very Concentrated", "Extremely Concentrated"
];

const MGT2E_PLATE_INTERACTIONS = {
    2: "Converging", 3: "Converging", 4: "Converging", 5: "Converging",
    6: "Transversing", 7: "Transversing", 8: "Transversing",
    9: "Diverging", 10: "Diverging", 11: "Diverging", 12: "Diverging"
};

const MGT2E_BIOCOMPLEXITY_RATINGS = {
    1: "Primitive single-cell organisms", 2: "Advanced cellular organisms",
    3: "Primitive multicellular organisms", 4: "Differentiated multicellular organisms",
    5: "Complex multicellular organisms", 6: "Advanced multicellular organisms",
    7: "Socially advanced organisms", 8: "Mentally advanced organisms",
    9: "Extant or extinct sophonts", 10: "Ecosystem-wide superorganisms"
};

const MGT2E_RESOURCE_REMARKS = {
    2: "No economically extractable resources", 3: "Marginal at best", 4: "Marginal at best", 5: "Marginal at best",
    6: "Worthwhile with considerable effort", 7: "Worthwhile with considerable effort", 8: "Worthwhile with considerable effort",
    9: "Priority targets", 10: "Priority targets", 11: "Liable to experience a resource rush", 12: "Liable to experience a resource rush"
};

const SCLASS_IDX = { 'Ia': 0, 'Ib': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6 };