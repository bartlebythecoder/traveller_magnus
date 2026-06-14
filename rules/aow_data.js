/**
 * PROJECT AS ABOVE, SO BELOW
 * Layer 1: The Data Shield (Architect of Worlds Edition)
 * Description: Pure declarative data structure for AoW generation sequences.
 * This file contains zero execution logic.
 */

const primaryStarCategoryTable = {
  name: "Primary Star Category Table",
  diceRoll: "d100",
  categories: [
    {
      minRoll: 1,
      maxRoll: 3,
      category: "Brown Dwarf"
    },
    {
      minRoll: 4,
      maxRoll: 77,
      category: "Low Mass Star"
    },
    {
      minRoll: 78,
      maxRoll: 90,
      category: "Intermediate Mass Star"
    },
    {
      minRoll: 91,
      maxRoll: 100,
      category: "High Mass Star"
    }
  ]
};

const brownDwarfMassTable = {
  name: "Brown Dwarf Mass Table",
  diceRoll: "d100",
  results: [
    { minRoll: 1, maxRoll: 10, mass: 0.015 },
    { minRoll: 11, maxRoll: 29, mass: 0.02 },
    { minRoll: 30, maxRoll: 45, mass: 0.03 },
    { minRoll: 46, maxRoll: 60, mass: 0.04 },
    { minRoll: 61, maxRoll: 74, mass: 0.05 },
    { minRoll: 75, maxRoll: 87, mass: 0.06 },
    { minRoll: 88, maxRoll: 100, mass: 0.07 }
  ]
};

const lowMassStarTable = {
  name: "Low Mass Star Table",
  diceRoll: "d100",
  results: [
    { minRoll: 1, maxRoll: 13, mass: 0.08 },
    { minRoll: 14, maxRoll: 23, mass: 0.10 },
    { minRoll: 24, maxRoll: 34, mass: 0.12 },
    { minRoll: 35, maxRoll: 43, mass: 0.15 },
    { minRoll: 44, maxRoll: 52, mass: 0.18 },
    { minRoll: 53, maxRoll: 59, mass: 0.22 },
    { minRoll: 60, maxRoll: 65, mass: 0.26 },
    { minRoll: 66, maxRoll: 70, mass: 0.30 },
    { minRoll: 71, maxRoll: 74, mass: 0.34 },
    { minRoll: 75, maxRoll: 77, mass: 0.38 },
    { minRoll: 78, maxRoll: 80, mass: 0.42 },
    { minRoll: 81, maxRoll: 83, mass: 0.46 },
    { minRoll: 84, maxRoll: 86, mass: 0.50 },
    { minRoll: 87, maxRoll: 89, mass: 0.53 },
    { minRoll: 90, maxRoll: 92, mass: 0.56 },
    { minRoll: 93, maxRoll: 95, mass: 0.59 },
    { minRoll: 96, maxRoll: 97, mass: 0.62 },
    { minRoll: 98, maxRoll: 99, mass: 0.65 },
    { minRoll: 100, maxRoll: 100, mass: 0.68 }
  ]
};

const intermediateMassStarTable = {
  name: "Intermediate Mass Star Table",
  diceRoll: "d100",
  results: [
    { minRoll: 1, maxRoll: 7, mass: 0.70 },
    { minRoll: 8, maxRoll: 13, mass: 0.72 },
    { minRoll: 14, maxRoll: 19, mass: 0.74 },
    { minRoll: 20, maxRoll: 24, mass: 0.76 },
    { minRoll: 25, maxRoll: 29, mass: 0.78 },
    { minRoll: 30, maxRoll: 34, mass: 0.80 },
    { minRoll: 35, maxRoll: 39, mass: 0.82 },
    { minRoll: 40, maxRoll: 43, mass: 0.84 },
    { minRoll: 44, maxRoll: 47, mass: 0.86 },
    { minRoll: 48, maxRoll: 51, mass: 0.88 },
    { minRoll: 52, maxRoll: 55, mass: 0.90 },
    { minRoll: 56, maxRoll: 59, mass: 0.92 },
    { minRoll: 60, maxRoll: 62, mass: 0.94 },
    { minRoll: 63, maxRoll: 65, mass: 0.96 },
    { minRoll: 66, maxRoll: 68, mass: 0.98 },
    { minRoll: 69, maxRoll: 71, mass: 1.00 },
    { minRoll: 72, maxRoll: 74, mass: 1.02 },
    { minRoll: 75, maxRoll: 78, mass: 1.04 },
    { minRoll: 79, maxRoll: 82, mass: 1.07 },
    { minRoll: 83, maxRoll: 85, mass: 1.10 },
    { minRoll: 86, maxRoll: 89, mass: 1.13 },
    { minRoll: 90, maxRoll: 92, mass: 1.16 },
    { minRoll: 93, maxRoll: 95, mass: 1.19 },
    { minRoll: 96, maxRoll: 97, mass: 1.22 },
    { minRoll: 98, maxRoll: 100, mass: 1.25 }
  ]
};

const highMassStarTable = {
  name: "High Mass Star Table",
  diceRoll: "d100",
  results: [
    { minRoll: 1, maxRoll: 3, mass: 1.28 },
    { minRoll: 4, maxRoll: 6, mass: 1.31 },
    { minRoll: 7, maxRoll: 9, mass: 1.34 },
    { minRoll: 10, maxRoll: 12, mass: 1.37 },
    { minRoll: 13, maxRoll: 16, mass: 1.40 },
    { minRoll: 17, maxRoll: 19, mass: 1.44 },
    { minRoll: 20, maxRoll: 23, mass: 1.48 },
    { minRoll: 24, maxRoll: 27, mass: 1.53 },
    { minRoll: 28, maxRoll: 31, mass: 1.58 },
    { minRoll: 32, maxRoll: 35, mass: 1.64 },
    { minRoll: 36, maxRoll: 38, mass: 1.70 },
    { minRoll: 39, maxRoll: 41, mass: 1.76 },
    { minRoll: 42, maxRoll: 45, mass: 1.82 },
    { minRoll: 46, maxRoll: 49, mass: 1.90 },
    { minRoll: 50, maxRoll: 53, mass: 2.00 },
    { minRoll: 54, maxRoll: 56, mass: 2.10 },
    { minRoll: 57, maxRoll: 59, mass: 2.20 },
    { minRoll: 60, maxRoll: 62, mass: 2.30 },
    { minRoll: 63, maxRoll: 67, mass: 2.40 },
    { minRoll: 68, maxRoll: 71, mass: 2.60 },
    { minRoll: 72, maxRoll: 75, mass: 2.80 },
    { minRoll: 76, maxRoll: 78, mass: 3.00 },
    { minRoll: 79, maxRoll: 82, mass: 3.20 },
    { minRoll: 83, maxRoll: 87, mass: 3.50 },
    { minRoll: 88, maxRoll: 91, mass: 4.00 },
    { minRoll: 92, maxRoll: 94, mass: 4.50 },
    { minRoll: 95, maxRoll: 96, mass: 5.00 },
    { minRoll: 97, maxRoll: 98, mass: 5.50 },
    { minRoll: 99, maxRoll: 100, mass: 6.00 }
  ]
};


const redDwarfStellarCharacteristicsTable = {
  name: "Red Dwarf Stellar Characteristics Table",
  results: [
    { mass: 0.08, expectedEffectiveTemperature: 2500, expectedLuminosity: 0.00047 },
    { mass: 0.10, expectedEffectiveTemperature: 2710, expectedLuminosity: 0.00087 },
    { mass: 0.12, expectedEffectiveTemperature: 2930, expectedLuminosity: 0.0016 },
    { mass: 0.15, expectedEffectiveTemperature: 3090, expectedLuminosity: 0.0029 },
    { mass: 0.18, expectedEffectiveTemperature: 3210, expectedLuminosity: 0.0044 },
    { mass: 0.22, expectedEffectiveTemperature: 3370, expectedLuminosity: 0.0070 },
    { mass: 0.26, expectedEffectiveTemperature: 3480, expectedLuminosity: 0.010 },
    { mass: 0.30, expectedEffectiveTemperature: 3550, expectedLuminosity: 0.013 },
    { mass: 0.34, expectedEffectiveTemperature: 3600, expectedLuminosity: 0.017 },
    { mass: 0.38, expectedEffectiveTemperature: 3640, expectedLuminosity: 0.020 },
    { mass: 0.42, expectedEffectiveTemperature: 3680, expectedLuminosity: 0.025 },
    { mass: 0.46, expectedEffectiveTemperature: 3730, expectedLuminosity: 0.031 },
    { mass: 0.50, expectedEffectiveTemperature: 3780, expectedLuminosity: 0.039 }
  ]
};


const mainSequenceStellarCharacteristicsTable = {
  name: "Main Sequence Stellar Characteristics Table",
  results: [
    { mass: 0.50, initialEffectiveTemperature: 3780, finalEffectiveTemperature: 4330, initialLuminosity: 0.039, luminosityGrowthRate: 1.010, mainSequenceLifespanGyr: 131 },
    { mass: 0.53, initialEffectiveTemperature: 3820, finalEffectiveTemperature: 4410, initialLuminosity: 0.046, luminosityGrowthRate: 1.012, mainSequenceLifespanGyr: 111 },
    { mass: 0.56, initialEffectiveTemperature: 3870, finalEffectiveTemperature: 4510, initialLuminosity: 0.054, luminosityGrowthRate: 1.014, mainSequenceLifespanGyr: 94.1 },
    { mass: 0.59, initialEffectiveTemperature: 3920, finalEffectiveTemperature: 4610, initialLuminosity: 0.065, luminosityGrowthRate: 1.016, mainSequenceLifespanGyr: 79.3 },
    { mass: 0.62, initialEffectiveTemperature: 4000, finalEffectiveTemperature: 4720, initialLuminosity: 0.079, luminosityGrowthRate: 1.019, mainSequenceLifespanGyr: 66.8 },
    { mass: 0.65, initialEffectiveTemperature: 4090, finalEffectiveTemperature: 4810, initialLuminosity: 0.095, luminosityGrowthRate: 1.022, mainSequenceLifespanGyr: 56.3 },
    { mass: 0.68, initialEffectiveTemperature: 4200, finalEffectiveTemperature: 4870, initialLuminosity: 0.12, luminosityGrowthRate: 1.025, mainSequenceLifespanGyr: 47.4 },
    { mass: 0.70, initialEffectiveTemperature: 4290, finalEffectiveTemperature: 4930, initialLuminosity: 0.13, luminosityGrowthRate: 1.028, mainSequenceLifespanGyr: 42.5 },
    { mass: 0.72, initialEffectiveTemperature: 4390, finalEffectiveTemperature: 5000, initialLuminosity: 0.15, luminosityGrowthRate: 1.030, mainSequenceLifespanGyr: 38.1 },
    { mass: 0.74, initialEffectiveTemperature: 4490, finalEffectiveTemperature: 5060, initialLuminosity: 0.17, luminosityGrowthRate: 1.032, mainSequenceLifespanGyr: 34.3 },
    { mass: 0.76, initialEffectiveTemperature: 4590, finalEffectiveTemperature: 5130, initialLuminosity: 0.20, luminosityGrowthRate: 1.034, mainSequenceLifespanGyr: 30.9 },
    { mass: 0.78, initialEffectiveTemperature: 4690, finalEffectiveTemperature: 5190, initialLuminosity: 0.22, luminosityGrowthRate: 1.037, mainSequenceLifespanGyr: 28.0 },
    { mass: 0.80, initialEffectiveTemperature: 4790, finalEffectiveTemperature: 5260, initialLuminosity: 0.25, luminosityGrowthRate: 1.040, mainSequenceLifespanGyr: 25.4 },
    { mass: 0.82, initialEffectiveTemperature: 4880, finalEffectiveTemperature: 5320, initialLuminosity: 0.28, luminosityGrowthRate: 1.043, mainSequenceLifespanGyr: 23.1 },
    { mass: 0.84, initialEffectiveTemperature: 4970, finalEffectiveTemperature: 5370, initialLuminosity: 0.32, luminosityGrowthRate: 1.046, mainSequenceLifespanGyr: 20.9 },
    { mass: 0.86, initialEffectiveTemperature: 5070, finalEffectiveTemperature: 5420, initialLuminosity: 0.35, luminosityGrowthRate: 1.050, mainSequenceLifespanGyr: 19.1 },
    { mass: 0.88, initialEffectiveTemperature: 5150, finalEffectiveTemperature: 5470, initialLuminosity: 0.39, luminosityGrowthRate: 1.054, mainSequenceLifespanGyr: 17.5 },
    { mass: 0.90, initialEffectiveTemperature: 5240, finalEffectiveTemperature: 5520, initialLuminosity: 0.44, luminosityGrowthRate: 1.056, mainSequenceLifespanGyr: 16.0 },
    { mass: 0.92, initialEffectiveTemperature: 5320, finalEffectiveTemperature: 5560, initialLuminosity: 0.48, luminosityGrowthRate: 1.060, mainSequenceLifespanGyr: 14.7 },
    { mass: 0.94, initialEffectiveTemperature: 5390, finalEffectiveTemperature: 5590, initialLuminosity: 0.53, luminosityGrowthRate: 1.064, mainSequenceLifespanGyr: 13.5 },
    { mass: 0.96, initialEffectiveTemperature: 5470, finalEffectiveTemperature: 5620, initialLuminosity: 0.59, luminosityGrowthRate: 1.066, mainSequenceLifespanGyr: 12.4 },
    { mass: 0.98, initialEffectiveTemperature: 5540, finalEffectiveTemperature: 5650, initialLuminosity: 0.65, luminosityGrowthRate: 1.073, mainSequenceLifespanGyr: 11.4 },
    { mass: 1.00, initialEffectiveTemperature: 5600, finalEffectiveTemperature: 5670, initialLuminosity: 0.71, luminosityGrowthRate: 1.076, mainSequenceLifespanGyr: 10.5 },
    { mass: 1.02, initialEffectiveTemperature: 5660, finalEffectiveTemperature: 5690, initialLuminosity: 0.78, luminosityGrowthRate: 1.083, mainSequenceLifespanGyr: 9.71 },
    { mass: 1.04, initialEffectiveTemperature: 5730, finalEffectiveTemperature: 5710, initialLuminosity: 0.85, luminosityGrowthRate: 1.086, mainSequenceLifespanGyr: 8.94 },
    { mass: 1.07, initialEffectiveTemperature: 5810, finalEffectiveTemperature: 5730, initialLuminosity: 0.97, luminosityGrowthRate: 1.096, mainSequenceLifespanGyr: 7.98 },
    { mass: 1.10, initialEffectiveTemperature: 5900, finalEffectiveTemperature: 5750, initialLuminosity: 1.10, luminosityGrowthRate: 1.100, mainSequenceLifespanGyr: 7.12 },
    { mass: 1.13, initialEffectiveTemperature: 5970, finalEffectiveTemperature: 5760, initialLuminosity: 1.30, luminosityGrowthRate: 1.104, mainSequenceLifespanGyr: 6.80 },
    { mass: 1.16, initialEffectiveTemperature: 6070, finalEffectiveTemperature: 5800, initialLuminosity: 1.50, luminosityGrowthRate: 1.108, mainSequenceLifespanGyr: 6.12 },
    { mass: 1.19, initialEffectiveTemperature: 6140, finalEffectiveTemperature: 5810, initialLuminosity: 1.70, luminosityGrowthRate: 1.110, mainSequenceLifespanGyr: 5.68 },
    { mass: 1.22, initialEffectiveTemperature: 6210, finalEffectiveTemperature: 5830, initialLuminosity: 1.90, luminosityGrowthRate: 1.120, mainSequenceLifespanGyr: 5.16 },
    { mass: 1.25, initialEffectiveTemperature: 6300, finalEffectiveTemperature: 5850, initialLuminosity: 2.10, luminosityGrowthRate: 1.136, mainSequenceLifespanGyr: 4.74 },
    { mass: 1.28, initialEffectiveTemperature: 6370, finalEffectiveTemperature: 5860, initialLuminosity: 2.40, luminosityGrowthRate: 1.140, mainSequenceLifespanGyr: 4.65 },
    { mass: 1.31, initialEffectiveTemperature: 6470, finalEffectiveTemperature: 5890, initialLuminosity: 2.70, luminosityGrowthRate: 1.145, mainSequenceLifespanGyr: 4.14 },
    { mass: 1.34, initialEffectiveTemperature: 6550, finalEffectiveTemperature: 5910, initialLuminosity: 3.00, luminosityGrowthRate: 1.150, mainSequenceLifespanGyr: 3.96 },
    { mass: 1.37, initialEffectiveTemperature: 6630, finalEffectiveTemperature: 5930, initialLuminosity: 3.30, luminosityGrowthRate: 1.167, mainSequenceLifespanGyr: 3.55 },
    { mass: 1.40, initialEffectiveTemperature: 6730, finalEffectiveTemperature: 5980, initialLuminosity: 3.50, luminosityGrowthRate: 1.183, mainSequenceLifespanGyr: 3.29 },
    { mass: 1.44, initialEffectiveTemperature: 6880, finalEffectiveTemperature: 6040, initialLuminosity: 4.10, luminosityGrowthRate: 1.204, mainSequenceLifespanGyr: 2.94 },
    { mass: 1.48, initialEffectiveTemperature: 7060, finalEffectiveTemperature: 6140, initialLuminosity: 4.70, luminosityGrowthRate: 1.219, mainSequenceLifespanGyr: 2.69 },
    { mass: 1.53, initialEffectiveTemperature: 7290, finalEffectiveTemperature: 6260, initialLuminosity: 5.40, luminosityGrowthRate: 1.223, mainSequenceLifespanGyr: 2.53 },
    { mass: 1.58, initialEffectiveTemperature: 7530, finalEffectiveTemperature: 6390, initialLuminosity: 6.30, luminosityGrowthRate: 1.241, mainSequenceLifespanGyr: 2.40 },
    { mass: 1.64, initialEffectiveTemperature: 7800, finalEffectiveTemperature: 6540, initialLuminosity: 7.30, luminosityGrowthRate: 1.296, mainSequenceLifespanGyr: 1.99 },
    { mass: 1.70, initialEffectiveTemperature: 8050, finalEffectiveTemperature: 6670, initialLuminosity: 8.60, luminosityGrowthRate: 1.332, mainSequenceLifespanGyr: 1.84 },
    { mass: 1.76, initialEffectiveTemperature: 8300, finalEffectiveTemperature: 6800, initialLuminosity: 9.90, luminosityGrowthRate: 1.395, mainSequenceLifespanGyr: 1.61 },
    { mass: 1.82, initialEffectiveTemperature: 8530, finalEffectiveTemperature: 6920, initialLuminosity: 11.0, luminosityGrowthRate: 1.467, mainSequenceLifespanGyr: 1.45 },
    { mass: 1.90, initialEffectiveTemperature: 8840, finalEffectiveTemperature: 7090, initialLuminosity: 14.0, luminosityGrowthRate: 1.496, mainSequenceLifespanGyr: 1.29 },
    { mass: 2.00, initialEffectiveTemperature: 9200, finalEffectiveTemperature: 7280, initialLuminosity: 17.0, luminosityGrowthRate: 1.617, mainSequenceLifespanGyr: 1.12 },
    { mass: 2.10, initialEffectiveTemperature: 9550, finalEffectiveTemperature: 7480, initialLuminosity: 20.0, luminosityGrowthRate: 1.785, mainSequenceLifespanGyr: 0.972 },
    { mass: 2.20, initialEffectiveTemperature: 9870, finalEffectiveTemperature: 7670, initialLuminosity: 24.0, luminosityGrowthRate: 1.975, mainSequenceLifespanGyr: 0.851 },
    { mass: 2.30, initialEffectiveTemperature: 10200, finalEffectiveTemperature: 7880, initialLuminosity: 29.0, luminosityGrowthRate: 2.156, mainSequenceLifespanGyr: 0.750 },
    { mass: 2.40, initialEffectiveTemperature: 10500, finalEffectiveTemperature: 8090, initialLuminosity: 34.0, luminosityGrowthRate: 2.427, mainSequenceLifespanGyr: 0.669 },
    { mass: 2.60, initialEffectiveTemperature: 11100, finalEffectiveTemperature: 8510, initialLuminosity: 47.0, luminosityGrowthRate: 3.114, mainSequenceLifespanGyr: 0.535 },
    { mass: 2.80, initialEffectiveTemperature: 11700, finalEffectiveTemperature: 8970, initialLuminosity: 62.0, luminosityGrowthRate: 4.246, mainSequenceLifespanGyr: 0.436 },
    { mass: 3.00, initialEffectiveTemperature: 12200, finalEffectiveTemperature: 9430, initialLuminosity: 81.0, luminosityGrowthRate: 5.943, mainSequenceLifespanGyr: 0.362 },
    { mass: 3.20, initialEffectiveTemperature: 12800, finalEffectiveTemperature: 9910, initialLuminosity: 100.0, luminosityGrowthRate: 10.23, mainSequenceLifespanGyr: 0.305 },
    { mass: 3.50, initialEffectiveTemperature: 13500, finalEffectiveTemperature: 10600, initialLuminosity: 150.0, luminosityGrowthRate: 15.70, mainSequenceLifespanGyr: 0.241 },
    { mass: 4.00, initialEffectiveTemperature: 14700, finalEffectiveTemperature: 11800, initialLuminosity: 240.0, luminosityGrowthRate: 64.08, mainSequenceLifespanGyr: 0.171 },
    { mass: 4.50, initialEffectiveTemperature: 15800, finalEffectiveTemperature: 12900, initialLuminosity: 370.0, luminosityGrowthRate: 263.5, mainSequenceLifespanGyr: 0.127 },
    { mass: 5.00, initialEffectiveTemperature: 16900, finalEffectiveTemperature: 13800, initialLuminosity: 540.0, luminosityGrowthRate: 1620.0, mainSequenceLifespanGyr: 0.0987 },
    { mass: 5.50, initialEffectiveTemperature: 17800, finalEffectiveTemperature: 14500, initialLuminosity: 760.0, luminosityGrowthRate: 15090.0, mainSequenceLifespanGyr: 0.0789 },
    { mass: 6.00, initialEffectiveTemperature: 18800, finalEffectiveTemperature: 15300, initialLuminosity: 1000.0, luminosityGrowthRate: 185800.0, mainSequenceLifespanGyr: 0.0647 }
  ]
};

const spectralTypeTable = {
  name: "Spectral Type Table",
  results: [
    { temperature: 17000, type: "B3" },
    { temperature: 16000, type: "B4" },
    { temperature: 15000, type: "B5" },
    { temperature: 14000, type: "B6" },
    { temperature: 13000, type: "B7" },
    { temperature: 11900, type: "B8" },
    { temperature: 10800, type: "B9" },
    { temperature: 9700, type: "A0" },
    { temperature: 9450, type: "A1" },
    { temperature: 9200, type: "A2" },
    { temperature: 8950, type: "A3" },
    { temperature: 8700, type: "A4" },
    { temperature: 8450, type: "A5" },
    { temperature: 8200, type: "A6" },
    { temperature: 7950, type: "A7" },
    { temperature: 7700, type: "A8" },
    { temperature: 7460, type: "A9" },
    { temperature: 7220, type: "F0" },
    { temperature: 7090, type: "F1" },
    { temperature: 6890, type: "F2" },
    { temperature: 6760, type: "F3" },
    { temperature: 6630, type: "F4" },
    { temperature: 6500, type: "F5" },
    { temperature: 6370, type: "F6" },
    { temperature: 6240, type: "F7" },
    { temperature: 6110, type: "F8" },
    { temperature: 6020, type: "F9" },
    { temperature: 5930, type: "G0" },
    { temperature: 5850, type: "G1" },
    { temperature: 5770, type: "G2" },
    { temperature: 5700, type: "G3" },
    { temperature: 5630, type: "G4" },
    { temperature: 5570, type: "G5" },
    { temperature: 5510, type: "G6" },
    { temperature: 5450, type: "G7" },
    { temperature: 5390, type: "G8" },
    { temperature: 5330, type: "G9" },
    { temperature: 5270, type: "K0" },
    { temperature: 5130, type: "K1" },
    { temperature: 4990, type: "K2" },
    { temperature: 4850, type: "K3" },
    { temperature: 4710, type: "K4" },
    { temperature: 4560, type: "K5" },
    { temperature: 4410, type: "K6" },
    { temperature: 4270, type: "K7" },
    { temperature: 4130, type: "K8" },
    { temperature: 3990, type: "K9" },
    { temperature: 3850, type: "M0" },
    { temperature: 3700, type: "M1" },
    { temperature: 3540, type: "M2" },
    { temperature: 3380, type: "M3" },
    { temperature: 3220, type: "M4" },
    { temperature: 3060, type: "M5" },
    { temperature: 2900, type: "M6" },
    { temperature: 2740, type: "M7" },
    { temperature: 2580, type: "M8" },
    { temperature: 2420, type: "M9" },
    { temperature: 2270, type: "L0" },
    { temperature: 2170, type: "L1" },
    { temperature: 2070, type: "L2" },
    { temperature: 1970, type: "L3" },
    { temperature: 1870, type: "L4" },
    { temperature: 1770, type: "L5" },
    { temperature: 1660, type: "L6" },
    { temperature: 1560, type: "L7" },
    { temperature: 1460, type: "L8" },
    { temperature: 1360, type: "L9" },
    { temperature: 1260, type: "T0" },
    { temperature: 1190, type: "T1" },
    { temperature: 1120, type: "T2" },
    { temperature: 1040, type: "T3" },
    { temperature: 960, type: "T4" },
    { temperature: 880, type: "T5" },
    { temperature: 800, type: "T6" },
    { temperature: 720, type: "T7" },
    { temperature: 640, type: "T8" },
    { temperature: 570, type: "T9" },
    { temperature: 500, type: "Y0" }
  ]
};

const multiplicityThresholdTable = {
  name: "Multiplicity Threshold Table",
  diceRoll: "3d6",
  description: "Determines the target number on 3d6 required for a star to be a multiple star system based on its mass.",
  results: [
    {
      minMass: 0.00,
      maxMass: 0.08,
      threshold: 14
    },
    {
      minMass: 0.08,
      maxMass: 0.70,
      threshold: 13
    },
    {
      minMass: 0.70,
      maxMass: 1.00,
      threshold: 12
    },
    {
      minMass: 1.00,
      maxMass: 1.30,
      threshold: 11
    },
    {
      minMass: 1.30,
      maxMass: Infinity,
      threshold: 10
    }
  ]
};

const stellarMultiplicityTable = {
  name: "Stellar Multiplicity Table",
  diceRoll: "d100",
  results: [
    {
      minRoll: 1,
      maxRoll: 75,
      numberOfStars: 2
    },
    {
      minRoll: 76,
      maxRoll: 95,
      numberOfStars: 3
    },
    {
      minRoll: 96,
      maxRoll: 100,
      numberOfStars: 4
    }
  ]
};
const companionStarMassTable = {
  name: "Companion Star Mass Table",
  diceRoll: "d100",
  results: [
    { minRoll: 1, maxRoll: 4, massRatio: 0.05 },
    { minRoll: 5, maxRoll: 8, massRatio: 0.10 },
    { minRoll: 9, maxRoll: 12, massRatio: 0.15 },
    { minRoll: 13, maxRoll: 16, massRatio: 0.20 },
    { minRoll: 17, maxRoll: 20, massRatio: 0.25 },
    { minRoll: 21, maxRoll: 24, massRatio: 0.30 },
    { minRoll: 25, maxRoll: 28, massRatio: 0.35 },
    { minRoll: 29, maxRoll: 31, massRatio: 0.40 },
    { minRoll: 32, maxRoll: 34, massRatio: 0.45 },
    { minRoll: 35, maxRoll: 38, massRatio: 0.50 },
    { minRoll: 39, maxRoll: 43, massRatio: 0.55 },
    { minRoll: 44, maxRoll: 48, massRatio: 0.60 },
    { minRoll: 49, maxRoll: 53, massRatio: 0.65 },
    { minRoll: 54, maxRoll: 58, massRatio: 0.70 },
    { minRoll: 59, maxRoll: 63, massRatio: 0.75 },
    { minRoll: 64, maxRoll: 69, massRatio: 0.80 },
    { minRoll: 70, maxRoll: 76, massRatio: 0.85 },
    { minRoll: 77, maxRoll: 86, massRatio: 0.90 },
    { minRoll: 87, maxRoll: 100, massRatio: 0.95 }
  ]
};

const stellarSeparationTable = {
  name: "Stellar Separation Table",
  diceRoll: "3d6",
  description: "Determines the average distance between stars in a multiple star system.",
  results: [
    {
      minRoll: -Infinity,
      maxRoll: 3,
      separation: "Extremely Close",
      baseDistanceAU: 0.015
    },
    {
      minRoll: 4,
      maxRoll: 5,
      separation: "Very Close",
      baseDistanceAU: 0.15
    },
    {
      minRoll: 6,
      maxRoll: 8,
      separation: "Close",
      baseDistanceAU: 1.5
    },
    {
      minRoll: 9,
      maxRoll: 12,
      separation: "Moderate",
      baseDistanceAU: 15.0
    },
    {
      minRoll: 13,
      maxRoll: 15,
      separation: "Wide",
      baseDistanceAU: 150.0
    },
    {
      minRoll: 16,
      maxRoll: Infinity,
      separation: "Very Wide",
      baseDistanceAU: 1500.0
    }
  ]
};

const stellarOrbitalEccentricityTable = {
  name: "Stellar Orbital Eccentricity Table",
  diceRoll: "3d6",
  description: "Determines the orbital eccentricity for components of a multiple star system.",
  results: [
    {
      minRoll: -Infinity,
      maxRoll: 3,
      eccentricity: 0.0
    },
    {
      minRoll: 4,
      maxRoll: 4,
      eccentricity: 0.1
    },
    {
      minRoll: 5,
      maxRoll: 6,
      eccentricity: 0.2
    },
    {
      minRoll: 7,
      maxRoll: 8,
      eccentricity: 0.3
    },
    {
      minRoll: 9,
      maxRoll: 11,
      eccentricity: 0.4
    },
    {
      minRoll: 12,
      maxRoll: 13,
      eccentricity: 0.5
    },
    {
      minRoll: 14,
      maxRoll: 15,
      eccentricity: 0.6
    },
    {
      minRoll: 16,
      maxRoll: 16,
      eccentricity: 0.7
    },
    {
      minRoll: 17,
      maxRoll: 17,
      eccentricity: 0.8
    },
    {
      minRoll: 18,
      maxRoll: Infinity,
      eccentricity: 0.9
    }
  ]
};

const stellarAgeTable = {
  name: "Stellar Age Table",
  diceRoll: "d100",
  results: [
    {
      minRoll: 1,
      maxRoll: 42,
      population: "Young Population I",
      baseAge: 0.0,
      ageRange: 2.0
    },
    {
      minRoll: 43,
      maxRoll: 76,
      population: "Intermediate Population I",
      baseAge: 2.0,
      ageRange: 3.0
    },
    {
      minRoll: 77,
      maxRoll: 95,
      population: "Old Population I",
      baseAge: 5.0,
      ageRange: 3.0
    },
    {
      minRoll: 96,
      maxRoll: 99,
      population: "Disk Population II",
      baseAge: 8.0,
      ageRange: 1.5
    },
    {
      minRoll: 100,
      maxRoll: 100,
      population: "Halo Population II",
      baseAge: 9.5,
      ageRange: 3.0
    }
  ]
};

const diskMassFactorTable = {
  name: "Disk Mass Factor Table",
  diceRoll: "3d6",
  description: "Determines the mass factor and modifier for a protoplanetary disk.",
  results: [
    { minRoll: 3, maxRoll: 3, massFactor: 0.25, massModifier: -6 },
    { minRoll: 4, maxRoll: 4, massFactor: 0.32, massModifier: -5 },
    { minRoll: 5, maxRoll: 5, massFactor: 0.40, massModifier: -4 },
    { minRoll: 6, maxRoll: 6, massFactor: 0.50, massModifier: -3 },
    { minRoll: 7, maxRoll: 7, massFactor: 0.60, massModifier: -2 },
    { minRoll: 8, maxRoll: 8, massFactor: 0.70, massModifier: -1 },
    { minRoll: 9, maxRoll: 9, massFactor: 0.80, massModifier: 0 },
    { minRoll: 10, maxRoll: 11, massFactor: 1.00, massModifier: 0 },
    { minRoll: 12, maxRoll: 12, massFactor: 1.20, massModifier: 0 },
    { minRoll: 13, maxRoll: 13, massFactor: 1.40, massModifier: 1 },
    { minRoll: 14, maxRoll: 14, massFactor: 1.70, massModifier: 2 },
    { minRoll: 15, maxRoll: 15, massFactor: 2.00, massModifier: 3 },
    { minRoll: 16, maxRoll: 16, massFactor: 2.50, massModifier: 4 },
    { minRoll: 17, maxRoll: 17, massFactor: 3.20, massModifier: 5 },
    { minRoll: 18, maxRoll: 18, massFactor: 4.00, massModifier: 6 }
  ]
};

const formationOrbitTable = {
  name: "Formation Orbit Table",
  description: "Provides the radius factor for formation orbits 1 through 16.",
  results: [
    { orbitNumber: 1, radiusFactor: 0.6 },
    { orbitNumber: 2, radiusFactor: 0.8 },
    { orbitNumber: 3, radiusFactor: 1.2 },
    { orbitNumber: 4, radiusFactor: 1.8 },
    { orbitNumber: 5, radiusFactor: 2.7 },
    { orbitNumber: 6, radiusFactor: 4.0 },
    { orbitNumber: 7, radiusFactor: 6.0 },
    { orbitNumber: 8, radiusFactor: 9.0 },
    { orbitNumber: 9, radiusFactor: 13.5 },
    { orbitNumber: 10, radiusFactor: 20.0 },
    { orbitNumber: 11, radiusFactor: 30.0 },
    { orbitNumber: 12, radiusFactor: 45.0 },
    { orbitNumber: 13, radiusFactor: 68.0 },
    { orbitNumber: 14, radiusFactor: 100.0 },
    { orbitNumber: 15, radiusFactor: 150.0 },
    { orbitNumber: 16, radiusFactor: 220.0 }
  ]
};

const diskInstabilityPlacementTable = {
  name: "Disk Instability Placement Table",
  diceRoll: "3d6 + diskMassModifier",
  description: "Determines the starting formation orbit and number of planets formed via disk instability.",
  results: [
    { minRoll: -Infinity, maxRoll: 5, firstFormationOrbit: 13, planets: 1 },
    { minRoll: 6, maxRoll: 7, firstFormationOrbit: 12, planets: 1 },
    { minRoll: 8, maxRoll: 9, firstFormationOrbit: 11, planets: 1 },
    { minRoll: 10, maxRoll: 11, firstFormationOrbit: 10, planets: 1 },
    { minRoll: 12, maxRoll: 13, firstFormationOrbit: 9, planets: 2 },
    { minRoll: 14, maxRoll: 15, firstFormationOrbit: 8, planets: 3 },
    { minRoll: 16, maxRoll: Infinity, firstFormationOrbit: 7, planets: 4 }
  ]
};

const coreAccretionTable = {
  name: "Core Accretion Table",
  diceRoll: "3d6",
  description: "Determines the orbital spacing and modifier for the number of core accretion planets.",
  results: [
    { minRoll: -Infinity, maxRoll: 5, spacing: "Very Loose", modifier: -2 },
    { minRoll: 6, maxRoll: 8, spacing: "Loose", modifier: -1 },
    { minRoll: 9, maxRoll: 12, spacing: "Moderate", modifier: 0 },
    { minRoll: 13, maxRoll: 15, spacing: "Tight", modifier: 1 },
    { minRoll: 16, maxRoll: Infinity, spacing: "Very Tight", modifier: 2 }
  ]
};

const planetaryMigrationTable = {
  name: "Planetary Migration Table",
  diceRoll: "3d6 + diskMassModifier",
  description: "Determines the arrival orbit after inward migration and the remaining planetesimal mass factor.",
  results: [
    { minRoll: -Infinity, maxRoll: 8, arrivalOrbit: 6, planetesimalMassFactor: 1.0 },
    { minRoll: 9, maxRoll: 11, arrivalOrbit: 5, planetesimalMassFactor: 0.75 },
    { minRoll: 12, maxRoll: 13, arrivalOrbit: 4, planetesimalMassFactor: 0.5 },
    { minRoll: 14, maxRoll: 14, arrivalOrbit: 3, planetesimalMassFactor: 0.25 },
    { minRoll: 15, maxRoll: 15, arrivalOrbit: 2, planetesimalMassFactor: 0.25 },
    { minRoll: 16, maxRoll: 16, arrivalOrbit: 1, planetesimalMassFactor: 0.25 },
    { minRoll: 17, maxRoll: Infinity, arrivalOrbit: 0, planetesimalMassFactor: 0.25 }
  ]
};


const grandTackTable = {
  name: "Grand Tack Table",
  diceRoll: "3d6",
  description: "Determines the outward movement (in formation orbits) of a migrating planet during a Grand Tack.",
  results: [
    { minRoll: -Infinity, maxRoll: 8, movement: 1 },
    { minRoll: 9, maxRoll: 16, movement: 2 },
    { minRoll: 17, maxRoll: Infinity, movement: 3 }
  ]
};

const oligarchicCollisionTable = {
  name: "Oligarchic Collision Table",
  diceRoll: "3d6",
  description: "Determines the orbital spacing and modifier for the number of terrestrial planets formed via oligarchic collision.",
  results: [
    { minRoll: -Infinity, maxRoll: 5, spacing: "Very Loose", modifier: -2 },
    { minRoll: 6, maxRoll: 8, spacing: "Loose", modifier: -1 },
    { minRoll: 9, maxRoll: 12, spacing: "Moderate", modifier: 0 },
    { minRoll: 13, maxRoll: 15, spacing: "Tight", modifier: 1 },
    { minRoll: 16, maxRoll: Infinity, spacing: "Very Tight", modifier: 2 }
  ]
};

const orbitalRatioTable = {
  name: "Orbital Ratio Table",
  diceRoll: "3d6",
  description: "Provides the ratio multiplier used to determine the estimated spacing between adjacent planetary orbits.",
  results: [
    { minRoll: 3, maxRoll: 3, ratioMultiplier: 0.71 },
    { minRoll: 4, maxRoll: 4, ratioMultiplier: 0.75 },
    { minRoll: 5, maxRoll: 5, ratioMultiplier: 0.78 },
    { minRoll: 6, maxRoll: 6, ratioMultiplier: 0.82 },
    { minRoll: 7, maxRoll: 7, ratioMultiplier: 0.86 },
    { minRoll: 8, maxRoll: 8, ratioMultiplier: 0.91 },
    { minRoll: 9, maxRoll: 9, ratioMultiplier: 0.95 },
    { minRoll: 10, maxRoll: 10, ratioMultiplier: 1.00 },
    { minRoll: 11, maxRoll: 11, ratioMultiplier: 1.05 },
    { minRoll: 12, maxRoll: 12, ratioMultiplier: 1.10 },
    { minRoll: 13, maxRoll: 13, ratioMultiplier: 1.16 },
    { minRoll: 14, maxRoll: 14, ratioMultiplier: 1.22 },
    { minRoll: 15, maxRoll: 15, ratioMultiplier: 1.28 },
    { minRoll: 16, maxRoll: 16, ratioMultiplier: 1.34 },
    { minRoll: 17, maxRoll: 17, ratioMultiplier: 1.41 },
    { minRoll: 18, maxRoll: 18, ratioMultiplier: 1.48 }
  ]
};

const resonantOrbitSpacingTable = {
  name: "Resonant Orbit Spacing Table",
  description: "Determines if adjacent planetary orbits snap into a stable orbital resonance based on their estimated ratio.",
  results: [
    { minRatio: 1.000, maxRatio: 1.221, actualRatio: 1.211, resonance: "4:3" },
    { minRatio: 1.227, maxRatio: 1.244, actualRatio: 1.237, resonance: "11:8" },
    { minRatio: 1.245, maxRatio: 1.260, actualRatio: 1.251, resonance: "7:5" },
    { minRatio: 1.261, maxRatio: 1.278, actualRatio: 1.268, resonance: "10:7" },
    { minRatio: 1.300, maxRatio: 1.320, actualRatio: 1.310, resonance: "3:2" },
    { minRatio: 1.342, maxRatio: 1.360, actualRatio: 1.352, resonance: "11:7" },
    { minRatio: 1.361, maxRatio: 1.375, actualRatio: 1.368, resonance: "8:5" },
    { minRatio: 1.376, maxRatio: 1.392, actualRatio: 1.382, resonance: "13:8" },
    { minRatio: 1.397, maxRatio: 1.416, actualRatio: 1.406, resonance: "5:3" },
    { minRatio: 1.422, maxRatio: 1.442, actualRatio: 1.432, resonance: "12:7" },
    { minRatio: 1.443, maxRatio: 1.462, actualRatio: 1.452, resonance: "7:4" },
    { minRatio: 1.470, maxRatio: 1.490, actualRatio: 1.480, resonance: "9:5" },
    { minRatio: 1.577, maxRatio: 1.597, actualRatio: 1.587, resonance: "2:1", isLaplace: true }
  ]
};

const coreAccretionMassTable = {
  name: "Core Accretion Mass Table",
  diceRoll: "3d6",
  description: "Determines the mass accretion factor for gas giants formed via core accretion.",
  results: [
    { minRoll: 3, maxRoll: 4, innermostFactor: 5.0, nextInnermostFactor: 2.5, subsequentFactor: 1.1 },
    { minRoll: 5, maxRoll: 6, innermostFactor: 6.0, nextInnermostFactor: 3.0, subsequentFactor: 1.1 },
    { minRoll: 7, maxRoll: 8, innermostFactor: 7.5, nextInnermostFactor: 4.0, subsequentFactor: 1.1 },
    { minRoll: 9, maxRoll: 12, innermostFactor: 10.0, nextInnermostFactor: 5.0, subsequentFactor: 1.2 },
    { minRoll: 13, maxRoll: 14, innermostFactor: 12.0, nextInnermostFactor: 6.0, subsequentFactor: 1.3 },
    { minRoll: 15, maxRoll: 16, innermostFactor: 15.0, nextInnermostFactor: 7.5, subsequentFactor: 1.5 },
    { minRoll: 17, maxRoll: 18, innermostFactor: 20.0, nextInnermostFactor: 10.0, subsequentFactor: 2.0 }
  ]
};

const systemEccentricityTable = {
  name: "System Eccentricity Table",
  description: "Provides the typical orbital eccentricity for planets in a system based on the total number of surviving planets.",
  results: [
    { minPlanets: -Infinity, maxPlanets: 2, typicalEccentricity: 0.23 },
    { minPlanets: 3, maxPlanets: 3, typicalEccentricity: 0.15 },
    { minPlanets: 4, maxPlanets: 4, typicalEccentricity: 0.12 },
    { minPlanets: 5, maxPlanets: 5, typicalEccentricity: 0.10 },
    { minPlanets: 6, maxPlanets: 6, typicalEccentricity: 0.08 },
    { minPlanets: 7, maxPlanets: 7, typicalEccentricity: 0.07 },
    { minPlanets: 8, maxPlanets: 9, typicalEccentricity: 0.06 },
    { minPlanets: 10, maxPlanets: Infinity, typicalEccentricity: 0.05 }
  ]
};

const majorSatelliteOrbitalRatioTable = {
  name: "Major Satellite Orbital Ratio Table",
  diceRoll: "3d6",
  description: "Determines the ratio multiplier used to calculate the orbital spacing between adjacent major satellites.",
  results: [
    { minRoll: 3, maxRoll: 3, ratio: 1.406, resonance: "5:3" },
    { minRoll: 4, maxRoll: 4, ratio: 1.432, resonance: "12:7" },
    { minRoll: 5, maxRoll: 5, ratio: 1.452, resonance: "7:4" },
    { minRoll: 6, maxRoll: 6, ratio: 1.480, resonance: "9:5" },
    { minRoll: 7, maxRoll: 7, ratio: 1.50 },
    { minRoll: 8, maxRoll: 8, ratio: 1.55 },
    { minRoll: 9, maxRoll: 12, ratio: 1.587, resonance: "2:1", isLaplace: true },
    { minRoll: 13, maxRoll: 13, ratio: 1.60 },
    { minRoll: 14, maxRoll: 14, ratio: 1.65 },
    { minRoll: 15, maxRoll: 15, ratio: 1.70 },
    { minRoll: 16, maxRoll: 16, ratio: 1.75 },
    { minRoll: 17, maxRoll: 17, ratio: 1.80 },
    { minRoll: 18, maxRoll: 18, ratio: 1.85 }
  ]
};

const rotationPeriodTable = {
  name: "Rotation Period Table",
  diceRoll: "3d6 + modifier",
  description: "Determines the base rotation period in hours for a world not initially in a spin-orbital resonance.",
  results: [
    { minRoll: -Infinity, maxRoll: 3, rotationPeriodHours: 4 },
    { minRoll: 4, maxRoll: 4, rotationPeriodHours: 5 },
    { minRoll: 5, maxRoll: 5, rotationPeriodHours: 6 },
    { minRoll: 6, maxRoll: 6, rotationPeriodHours: 8 },
    { minRoll: 7, maxRoll: 7, rotationPeriodHours: 10 },
    { minRoll: 8, maxRoll: 8, rotationPeriodHours: 12 },
    { minRoll: 9, maxRoll: 9, rotationPeriodHours: 16 },
    { minRoll: 10, maxRoll: 10, rotationPeriodHours: 20 },
    { minRoll: 11, maxRoll: 11, rotationPeriodHours: 24 },
    { minRoll: 12, maxRoll: 12, rotationPeriodHours: 32 },
    { minRoll: 13, maxRoll: 13, rotationPeriodHours: 40 },
    { minRoll: 14, maxRoll: 14, rotationPeriodHours: 48 },
    { minRoll: 15, maxRoll: 15, rotationPeriodHours: 64 },
    { minRoll: 16, maxRoll: 16, rotationPeriodHours: 80 },
    { minRoll: 17, maxRoll: 17, rotationPeriodHours: 96 },
    { minRoll: 18, maxRoll: 18, rotationPeriodHours: 128 },
    { minRoll: 19, maxRoll: 19, rotationPeriodHours: 160 },
    { minRoll: 20, maxRoll: 20, rotationPeriodHours: 192 },
    { minRoll: 21, maxRoll: 21, rotationPeriodHours: 256 },
    { minRoll: 22, maxRoll: 22, rotationPeriodHours: 320 },
    { minRoll: 23, maxRoll: 23, rotationPeriodHours: 384 },
    { minRoll: 24, maxRoll: Infinity, resonanceEstablished: true }
  ]
};

const planetarySpinOrbitResonanceTable = {
  name: "Planetary Spin-Orbit Resonance Table",
  description: "Determines the most probable spin-orbit resonance and resulting rotation period for a planet based on its orbital eccentricity.",
  results: [
    { minEccentricity: 0.00, maxEccentricity: 0.12, resonance: "1:1", periodMultiplier: 1, description: "Equal to orbital period" },
    { minEccentricity: 0.12, maxEccentricity: 0.25, resonance: "3:2", periodMultiplier: 2/3, description: "Exactly 2/3 of orbital period" },
    { minEccentricity: 0.25, maxEccentricity: 0.35, resonance: "2:1", periodMultiplier: 1/2, description: "Exactly 1/2 of orbital period" },
    { minEccentricity: 0.35, maxEccentricity: 0.45, resonance: "5:2", periodMultiplier: 2/5, description: "Exactly 2/5 of orbital period" },
    { minEccentricity: 0.45, maxEccentricity: Infinity, resonance: "3:1", periodMultiplier: 1/3, description: "Exactly 1/3 of orbital period" }
  ]
};

const obliquityTable = {
  name: "Obliquity Table",
  diceRoll: "3d6 + modifiers",
  description: "Determines the current obliquity (axial tilt) of a planet.",
  results: [
    { minRoll: -Infinity, maxRoll: 4, isExtreme: true, description: "Extreme (see Extreme Obliquity Table)" },
    { minRoll: 5, maxRoll: 5, obliquity: 48 },
    { minRoll: 6, maxRoll: 6, obliquity: 46 },
    { minRoll: 7, maxRoll: 7, obliquity: 44 },
    { minRoll: 8, maxRoll: 8, obliquity: 42 },
    { minRoll: 9, maxRoll: 9, obliquity: 40 },
    { minRoll: 10, maxRoll: 10, obliquity: 38 },
    { minRoll: 11, maxRoll: 11, obliquity: 36 },
    { minRoll: 12, maxRoll: 12, obliquity: 34 },
    { minRoll: 13, maxRoll: 13, obliquity: 32 },
    { minRoll: 14, maxRoll: 14, obliquity: 30 },
    { minRoll: 15, maxRoll: 15, obliquity: 28 },
    { minRoll: 16, maxRoll: 16, obliquity: 26 },
    { minRoll: 17, maxRoll: 17, obliquity: 24 },
    { minRoll: 18, maxRoll: 18, obliquity: 22 },
    { minRoll: 19, maxRoll: 19, obliquity: 20 },
    { minRoll: 20, maxRoll: 20, obliquity: 18 },
    { minRoll: 21, maxRoll: 21, obliquity: 16 },
    { minRoll: 22, maxRoll: 22, obliquity: 14 },
    { minRoll: 23, maxRoll: 23, obliquity: 12 },
    { minRoll: 24, maxRoll: 24, obliquity: 10 },
    { minRoll: 25, maxRoll: Infinity, isMinimal: true, description: "Minimal (roll 3d6-8 degrees, minimum 0)" }
  ]
};

const extremeObliquityTable = {
  name: "Extreme Obliquity Table",
  diceRoll: "1d6",
  description: "Determines the exact obliquity for worlds with extreme axial tilt.",
  results: [
    { minRoll: 1, maxRoll: 2, obliquity: 50 },
    { minRoll: 3, maxRoll: 3, obliquity: 60 },
    { minRoll: 4, maxRoll: 4, obliquity: 70 },
    { minRoll: 5, maxRoll: 5, obliquity: 80 },
    { minRoll: 6, maxRoll: 6, isVariable: true, description: "98 - 3d6 degrees (maximum 90)" }
  ]
};

const initialWaterPrevalenceTable = {
  name: "Initial Water Prevalence Table",
  diceRoll: "3d6 + modifiers",
  description: "Determines the initial prevalence of water and base hydrographic coverage for a world.",
  results: [
    { minRoll: -Infinity, maxRoll: -5, prevalence: "Trace", baseHydrographicCoverage: 0 },
    { minRoll: -4, maxRoll: -1, prevalence: "Minimal", baseHydrographicCoverage: 0 },
    { minRoll: 0, maxRoll: 0, prevalence: "Minimal", baseHydrographicCoverage: 1 },
    { minRoll: 1, maxRoll: 1, prevalence: "Minimal", baseHydrographicCoverage: 2 },
    { minRoll: 2, maxRoll: 2, prevalence: "Minimal", baseHydrographicCoverage: 3 },
    { minRoll: 3, maxRoll: 3, prevalence: "Minimal", baseHydrographicCoverage: 5 },
    { minRoll: 4, maxRoll: 4, prevalence: "Moderate", baseHydrographicCoverage: 7.5 },
    { minRoll: 5, maxRoll: 5, prevalence: "Moderate", baseHydrographicCoverage: 10 },
    { minRoll: 6, maxRoll: 6, prevalence: "Moderate", baseHydrographicCoverage: 20 },
    { minRoll: 7, maxRoll: 7, prevalence: "Moderate", baseHydrographicCoverage: 30 },
    { minRoll: 8, maxRoll: 8, prevalence: "Moderate", baseHydrographicCoverage: 40 },
    { minRoll: 9, maxRoll: 9, prevalence: "Moderate", baseHydrographicCoverage: 50 },
    { minRoll: 10, maxRoll: 10, prevalence: "Moderate", baseHydrographicCoverage: 55 },
    { minRoll: 11, maxRoll: 11, prevalence: "Moderate", baseHydrographicCoverage: 60 },
    { minRoll: 12, maxRoll: 12, prevalence: "Extensive", baseHydrographicCoverage: 65 },
    { minRoll: 13, maxRoll: 13, prevalence: "Extensive", baseHydrographicCoverage: 70 },
    { minRoll: 14, maxRoll: 14, prevalence: "Extensive", baseHydrographicCoverage: 75 },
    { minRoll: 15, maxRoll: 15, prevalence: "Extensive", baseHydrographicCoverage: 80 },
    { minRoll: 16, maxRoll: 16, prevalence: "Extensive", baseHydrographicCoverage: 85 },
    { minRoll: 17, maxRoll: 17, prevalence: "Extensive", baseHydrographicCoverage: 90 },
    { minRoll: 18, maxRoll: 18, prevalence: "Extensive", baseHydrographicCoverage: 95 },
    { minRoll: 19, maxRoll: 19, prevalence: "Extensive", baseHydrographicCoverage: 97.5 },
    { minRoll: 20, maxRoll: Infinity, prevalence: "Massive", baseHydrographicCoverage: 100 }
  ]
};

const lithosphereTable = {
  name: "Lithosphere Table",
  diceRoll: "3d6 + modifiers",
  description: "Determines the base lithosphere status of a world based on primordial and radiogenic heat.",
  results: [
    { minRoll: -Infinity, maxRoll: 15, status: "Molten Lithosphere", activityLevel: 6 },
    { minRoll: 16, maxRoll: 23, status: "Soft Lithosphere", activityLevel: 5 },
    { minRoll: 24, maxRoll: 31, status: "Early Plate Lithosphere", activityLevel: 4 },
    { minRoll: 32, maxRoll: 63, status: "Mature Plate Lithosphere", activityLevel: 3 },
    { minRoll: 64, maxRoll: 87, status: "Ancient Plate Lithosphere", activityLevel: 2 },
    { minRoll: 88, maxRoll: Infinity, status: "Solid Lithosphere", activityLevel: 1 }
  ]
};

const tidalHeatTable = {
  name: "Tidal Heat Table",
  description: "Determines if tidal heating overrides the base lithosphere status, making it more active.",
  results: [
    { minF: 20001, maxF: Infinity, status: "Molten Lithosphere", activityLevel: 6 },
    { minF: 6301, maxF: 20000, status: "Soft Lithosphere", activityLevel: 5 },
    { minF: 2001, maxF: 6300, status: "Early Plate Lithosphere", activityLevel: 4 },
    { minF: 631, maxF: 2000, status: "Mature Plate Lithosphere", activityLevel: 3 },
    { minF: 201, maxF: 630, status: "Ancient Plate Lithosphere", activityLevel: 2 },
    { minF: -Infinity, maxF: 200, status: "Solid Lithosphere", activityLevel: 1 }
  ]
};

const magneticFieldTable = {
  name: "Magnetic Field Table",
  diceRoll: "3d6 + modifiers",
  description: "Determines the strength of a world's magnetic field based on its internal heat and tectonic activity.",
  results: [
    { minRoll: -Infinity, maxRoll: 14, magneticField: "None" },
    { minRoll: 15, maxRoll: 17, magneticField: "Weak" },
    { minRoll: 18, maxRoll: 19, magneticField: "Moderate" },
    { minRoll: 20, maxRoll: Infinity, magneticField: "Strong" }
  ]
};

const albedoTable = {
  name: "Albedo Table",
  description: "Determines the base albedo (reflectivity) of a world based on its World Class and Water Prevalence.",
  results: [
    { worldClass: "Class 1", prevalence: "Any", baseAlbedo: 0.65 },
    { worldClass: "Class 2", prevalence: "Any", baseAlbedo: 0.20 },
    { worldClass: "Class 3", prevalence: "Any", baseAlbedo: 0.10 },
    
    // Class 4 (Earth-type) and Class 5 (Mars-type) share the same albedo values
    { worldClass: ["Class 4", "Class 5"], prevalence: "Trace", baseAlbedo: 0.15 },
    { worldClass: ["Class 4", "Class 5"], prevalence: "Minimal", baseAlbedo: 0.16 },
    { worldClass: ["Class 4", "Class 5"], prevalence: "Moderate", baseAlbedo: 0.19 },
    { worldClass: ["Class 4", "Class 5"], prevalence: "Extensive", baseAlbedo: 0.22 },
    { worldClass: ["Class 4", "Class 5"], prevalence: "Massive", baseAlbedo: 0.25 },
    
    // Class 6 (Luna-type)
    { worldClass: "Class 6", prevalence: "Trace", baseAlbedo: 0.01 },
    { worldClass: "Class 6", prevalence: "Minimal", baseAlbedo: 0.02 },
    { worldClass: "Class 6", prevalence: "Moderate", baseAlbedo: 0.08 },
    { worldClass: "Class 6", prevalence: "Extensive", baseAlbedo: 0.14 },
    { worldClass: "Class 6", prevalence: "Massive", baseAlbedo: 0.20 }
  ]
};

const photosynthesisTable = {
  name: "Photosynthesis Table",
  description: "Determines the base timescale factor for the development of photosynthesis based on the spectral type of the world's primary star.",
  results: [
    { spectralType: "A, F, or G0-G7", timescale: 100 },
    { spectralType: "G8-G9", timescale: 105 },
    { spectralType: "K0", timescale: 110 },
    { spectralType: "K1", timescale: 115 },
    { spectralType: "K2", timescale: 120 },
    { spectralType: "K3", timescale: 130 },
    { spectralType: "K4", timescale: 145 },
    { spectralType: "K5", timescale: 160 },
    { spectralType: "K6", timescale: 180 },
    { spectralType: "K7", timescale: 210 },
    { spectralType: "K8", timescale: 240 },
    { spectralType: "K9", timescale: 270 },
    { spectralType: "M0-M9", timescale: 300 }
  ]
};

const waterVaporGreenhouseTable = {
  name: "Water Vapor Greenhouse Table",
  description: "Determines the base greenhouse effect (in kelvins) due to water vapor based on the T2 surface temperature (temperature after CO2 warming).",
  results: [
    { minT2: -Infinity, maxT2: 259, baseGH2O: 0 },
    { minT2: 260, maxT2: 260, baseGH2O: 16 },
    { minT2: 261, maxT2: 262, baseGH2O: 17 },
    { minT2: 263, maxT2: 265, baseGH2O: 18 },
    { minT2: 266, maxT2: 268, baseGH2O: 19 },
    { minT2: 269, maxT2: 270, baseGH2O: 20 },
    { minT2: 271, maxT2: 273, baseGH2O: 21 },
    { minT2: 274, maxT2: 276, baseGH2O: 22 },
    { minT2: 277, maxT2: 279, baseGH2O: 23 },
    { minT2: 280, maxT2: 282, baseGH2O: 24 },
    { minT2: 283, maxT2: 286, baseGH2O: 25 },
    { minT2: 287, maxT2: 289, baseGH2O: 26 },
    { minT2: 290, maxT2: 293, baseGH2O: 27 },
    { minT2: 294, maxT2: 296, baseGH2O: 28 },
    { minT2: 297, maxT2: 300, baseGH2O: 29 },
    { minT2: 301, maxT2: 304, baseGH2O: 30 },
    { minT2: 305, maxT2: 309, baseGH2O: 31 },
    { minT2: 310, maxT2: 313, baseGH2O: 32 },
    { minT2: 314, maxT2: 318, baseGH2O: 33 },
    { minT2: 319, maxT2: Infinity, isVariable: true, description: "33 K + 1 K for every 5 K above 318 K" }
  ]
};