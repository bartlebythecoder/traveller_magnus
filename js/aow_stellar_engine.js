/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: AoW Stellar Engine
 * Description: Stellar generation for Architect of Worlds.
 * Following the "Sean Protocol": Zero Logic beyond spec, Trace Logging.
 *
 * Data source: rules/aow_data.js (must be loaded before this file)
 * Called by: js/aow_bottomup_generator.js
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AoWStellarEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Module-level luminosity class tally — accumulates across all calls (this engine only).
    const _lumClassTally = {};

    // =================================================================
    // PRIVATE HELPERS
    // =================================================================

    function rollD6()  { return Math.floor(rng() * 6)   + 1; }
    function rollD100() { return Math.floor(rng() * 100) + 1; }
    function roll3D6() { return rollD6() + rollD6() + rollD6(); }

    // Look up a row in a roll table (rows have minRoll / maxRoll).
    function lookupByRoll(tableArray, roll) {
        return tableArray.find(row => roll >= row.minRoll && roll <= row.maxRoll) || null;
    }

    // Look up a row in a mass-range table (rows have minMass / maxMass).
    // Boundary convention: minMass <= mass < maxMass (exclusive upper bound).
    // The last row has maxMass: Infinity, so it always catches the ceiling value.
    function lookupByMass(tableArray, mass) {
        return tableArray.find(row => mass >= row.minMass && mass < row.maxMass)
            || tableArray[tableArray.length - 1];
    }

    function createStar(label) {
        return { label: label, initialMass: 0 };
    }

    // Round to N significant figures.
    function roundToSigFigs(value, sigFigs) {
        if (value === 0) return 0;
        const d = Math.ceil(Math.log10(Math.abs(value)));
        const power = sigFigs - d;
        const magnitude = Math.pow(10, power);
        return Math.round(value * magnitude) / magnitude;
    }

    // Linear interpolation between adjacent rows in a mass-indexed table.
    // tableResults must be an array of objects each with a 'mass' property.
    function interpolateByMass(tableResults, mass) {
        if (mass <= tableResults[0].mass) return Object.assign({}, tableResults[0]);
        if (mass >= tableResults[tableResults.length - 1].mass) return Object.assign({}, tableResults[tableResults.length - 1]);
        for (let i = 0; i < tableResults.length - 1; i++) {
            const lo = tableResults[i];
            const hi = tableResults[i + 1];
            if (mass >= lo.mass && mass <= hi.mass) {
                const t = (mass - lo.mass) / (hi.mass - lo.mass);
                const result = {};
                for (const key of Object.keys(lo)) {
                    result[key] = typeof lo[key] === 'number' ? lo[key] + t * (hi[key] - lo[key]) : lo[key];
                }
                return result;
            }
        }
        return Object.assign({}, tableResults[tableResults.length - 1]);
    }

    // Find the spectralTypeTable entry whose temperature is closest to the given value.
    function lookupClosestSpectralType(temperature) {
        const results = spectralTypeTable.results;
        let closest = results[0];
        let minDiff = Math.abs(temperature - results[0].temperature);
        for (let i = 1; i < results.length; i++) {
            const diff = Math.abs(temperature - results[i].temperature);
            if (diff < minDiff) { minDiff = diff; closest = results[i]; }
        }
        return closest;
    }

    // AoW Stefan-Boltzmann radius formula — result in AU.
    // R_AU = 155,000 * sqrt(L) / T^2   (L in solar units, T in Kelvin)
    function calcRadiusAU(luminosity, temperature) {
        return 155000 * Math.sqrt(luminosity) / (temperature * temperature);
    }

    // =================================================================
    // ALGORITHM CHUNK 1: SYSTEM HIERARCHY AND MASSES
    // AoW Steps 1–3
    // Outputs: sys.stars (array of Star objects A–D), sys.hierarchy (string)
    // =================================================================

    function generateStarHierarchyAndMasses(sys, options) {

        // forceEarthlike defaults to false; wire to UI input when ready
        const forceEarthlike = (options && options.forceEarthlike === true) ? true : false;

        // --- STEP 1: PRIMARY STAR MASS ---
        tSection('AoW Step 1: Primary Star Mass');

        // Determine category
        let category;
        if (forceEarthlike) {
            category = 'Intermediate Mass Star';
            tResult('Primary Category', category, 'AoW: forceEarthlike override');
        } else {
            const categoryRoll = rollD100();
            // Note: primaryStarCategoryTable uses 'categories', not 'results'
            const categoryRow = lookupByRoll(primaryStarCategoryTable.categories, categoryRoll);
            category = categoryRow ? categoryRow.category : 'NULL';
            tResult('Primary Category', `${category} (roll: ${categoryRoll})`, 'AoW Table: Primary Star Category');
        }

        // Select the mass table for this category
        const massTableMap = {
            'Brown Dwarf':             brownDwarfMassTable,
            'Low Mass Star':           lowMassStarTable,
            'Intermediate Mass Star':  intermediateMassStarTable,
            'High Mass Star':          highMassStarTable
        };
        const massTable = massTableMap[category];

        const massRoll = rollD100();
        const massRow = lookupByRoll(massTable.results, massRoll);

        const starA = createStar('A');
        starA.initialMass = massRow.mass;
        tResult('StarA initialMass', `${starA.initialMass} M☉ (roll: ${massRoll})`, `AoW Table: ${massTable.name}`);

        // --- STEP 2: STELLAR MULTIPLICITY ---
        tSection('AoW Step 2: Stellar Multiplicity');

        const multiplicityRow = lookupByMass(multiplicityThresholdTable.results, starA.initialMass);
        const threshold = multiplicityRow.threshold;
        tResult('Multiplicity Threshold (need ≥ on 3d6)', threshold, 'AoW Table: Multiplicity Threshold');

        const multiplicityRoll = roll3D6();
        tResult('3d6 Roll', multiplicityRoll, 'AoW: Multiplicity Check');

        if (multiplicityRoll < threshold) {
            sys.stars = [starA];
            sys.hierarchy = 'Singleton';
            tResult('System Type', 'Singleton', 'AoW: Roll below threshold — Chunk 1 complete');
            return;
        }

        const componentRoll = rollD100();
        const componentRow = lookupByRoll(stellarMultiplicityTable.results, componentRoll);
        const totalStars = componentRow.numberOfStars;
        tResult('Total Stars', `${totalStars} (roll: ${componentRoll})`, 'AoW Table: Stellar Multiplicity');

        // --- STEP 3: ARRANGE COMPONENTS ---
        tSection('AoW Step 3: Arrange Components');

        if (totalStars === 2) {
            // Binary
            const ratioRoll = rollD100();
            const massRatio = lookupByRoll(companionStarMassTable.results, ratioRoll).massRatio;
            const starB = createStar('B');
            starB.initialMass = Math.max(0.015, starA.initialMass * massRatio);

            sys.stars = [starA, starB];
            sys.hierarchy = 'Binary';
            tResult('StarB initialMass', `${starB.initialMass} M☉ (ratio: ${massRatio}, roll: ${ratioRoll})`, 'AoW: Binary');

        } else if (totalStars === 3) {
            // Trinary — 50/50 configuration selection
            const configRoll = rollD100();
            const starB = createStar('B');
            const starC = createStar('C');

            if (configRoll <= 50) {
                // Configuration 1: A single, B-C pair
                sys.hierarchy = 'Trinary (A, B-C)';

                const ratioBRoll = rollD100();
                const ratioB = lookupByRoll(companionStarMassTable.results, ratioBRoll).massRatio;
                starB.initialMass = Math.max(0.015, starA.initialMass * ratioB);

                const ratioCRaw = rollD100();
                const ratioCRoll = Math.min(100, ratioCRaw + 30);
                const ratioC = lookupByRoll(companionStarMassTable.results, ratioCRoll).massRatio;
                starC.initialMass = Math.max(0.015, starB.initialMass * ratioC);

                tResult('Config', '1: A, (B-C)', 'AoW: Trinary');
                tResult('StarB initialMass', `${starB.initialMass} M☉ (ratio: ${ratioB}, roll: ${ratioBRoll})`, 'AoW: Trinary (A, B-C)');
                tResult('StarC initialMass', `${starC.initialMass} M☉ (ratio: ${ratioC}, roll+30: ${ratioCRoll})`, 'AoW: Trinary (A, B-C)');

            } else {
                // Configuration 2: A-B pair, C single
                sys.hierarchy = 'Trinary (A-B, C)';

                const ratioBRaw = rollD100();
                const ratioBRoll = Math.min(100, ratioBRaw + 30);
                const ratioB = lookupByRoll(companionStarMassTable.results, ratioBRoll).massRatio;
                starB.initialMass = Math.max(0.015, starA.initialMass * ratioB);

                const ratioCRoll = rollD100();
                const ratioC = lookupByRoll(companionStarMassTable.results, ratioCRoll).massRatio;
                starC.initialMass = Math.max(0.015, starA.initialMass * ratioC);

                tResult('Config', '2: (A-B), C', 'AoW: Trinary');
                tResult('StarB initialMass', `${starB.initialMass} M☉ (ratio: ${ratioB}, roll+30: ${ratioBRoll})`, 'AoW: Trinary (A-B, C)');
                tResult('StarC initialMass', `${starC.initialMass} M☉ (ratio: ${ratioC}, roll: ${ratioCRoll})`, 'AoW: Trinary (A-B, C)');
            }

            sys.stars = [starA, starB, starC];

        } else if (totalStars === 4) {
            // Quaternary: A-B pair, C-D pair
            sys.hierarchy = 'Quaternary (A-B, C-D)';

            const starB = createStar('B');
            const starC = createStar('C');
            const starD = createStar('D');

            const ratioBRaw = rollD100();
            const ratioBRoll = Math.min(100, ratioBRaw + 30);
            const ratioB = lookupByRoll(companionStarMassTable.results, ratioBRoll).massRatio;
            starB.initialMass = Math.max(0.015, starA.initialMass * ratioB);

            const ratioCRoll = rollD100();
            const ratioC = lookupByRoll(companionStarMassTable.results, ratioCRoll).massRatio;
            starC.initialMass = Math.max(0.015, starA.initialMass * ratioC);

            const ratioDRaw = rollD100();
            const ratioDRoll = Math.min(100, ratioDRaw + 30);
            const ratioD = lookupByRoll(companionStarMassTable.results, ratioDRoll).massRatio;
            starD.initialMass = Math.max(0.015, starC.initialMass * ratioD);

            tResult('StarB initialMass', `${starB.initialMass} M☉ (ratio: ${ratioB}, roll+30: ${ratioBRoll})`, 'AoW: Quaternary');
            tResult('StarC initialMass', `${starC.initialMass} M☉ (ratio: ${ratioC}, roll: ${ratioCRoll})`, 'AoW: Quaternary');
            tResult('StarD initialMass', `${starD.initialMass} M☉ (ratio: ${ratioD}, roll+30: ${ratioDRoll})`, 'AoW: Quaternary');

            sys.stars = [starA, starB, starC, starD];
        }

        tResult('System Hierarchy', sys.hierarchy, 'AoW: Chunk 1 complete');
    }

    // =================================================================
    // ALGORITHM CHUNK 2: AGE, METALLICITY, AND STELLAR EVOLUTION
    // AoW Steps 4–7
    // Outputs: sys.systemAge, sys.systemMetallicity, sys.population,
    //          and evolved star properties on each Star object.
    // =================================================================

    function generateAgeMetallicityAndEvolution(sys, options) {
        const forceEarthlike = (options && options.forceEarthlike === true) ? true : false;

        // --- STEP 4: STAR SYSTEM AGE ---
        tSection('AoW Step 4: Star System Age');

        let ageRow;
        if (forceEarthlike) {
            const d6 = rollD6();
            const population = d6 <= 4 ? 'Intermediate Population I' : 'Old Population I';
            ageRow = stellarAgeTable.results.find(r => r.population === population);
            tResult('Population (forceEarthlike)', `${population} (d6: ${d6})`, 'AoW: forceEarthlike age override');
        } else {
            const ageRoll = rollD100();
            ageRow = lookupByRoll(stellarAgeTable.results, ageRoll);
            tResult('Population', `${ageRow.population} (roll: ${ageRoll})`, 'AoW Table: Stellar Age');
        }

        const ageFraction = rng(); // represents d% as 0.0–1.0
        sys.systemAge = roundToSigFigs(ageRow.baseAge + ageFraction * ageRow.ageRange, 2);
        sys.population = ageRow.population;
        tResult('System Age', `${sys.systemAge} Gyr (base: ${ageRow.baseAge}, range: ${ageRow.ageRange})`, 'AoW: Step 4 complete');

        // --- STEP 5: STAR SYSTEM METALLICITY ---
        tSection('AoW Step 5: Star System Metallicity');

        const metalRoll = roll3D6();
        let K = (metalRoll / 10) * (1.2 - (sys.systemAge / 13.5));
        tResult('K base', `${K.toFixed(4)} (3d6: ${metalRoll})`, 'AoW: K = (3d6/10) × (1.2 - Age/13.5)');

        if (sys.systemAge >= 8.0) {
            K = Math.max(0, K - 0.2);
            tResult('K (Pop II -0.2 applied)', K.toFixed(4), `AoW: Population II modifier (age ${sys.systemAge} ≥ 8.0 Gyr)`);
        } else {
            tResult('K (Pop II check)', 'skipped', `AoW: Age ${sys.systemAge} Gyr < 8.0 — not Population II`);
        }

        const enrichD6 = rollD6();
        if (enrichD6 === 1) {
            const bonus = roll3D6() * 0.1;
            K = Math.min(3.0, K + bonus);
            tResult('K (enrichment d6=1)', `${K.toFixed(4)} (+${bonus.toFixed(1)})`, 'AoW: Rare enrichment triggered');
        } else {
            tResult('K (enrichment d6)', `${enrichD6} — no bonus`, 'AoW: Enrichment roll did not trigger');
        }

        if (forceEarthlike) {
            if (K < 0.3) {
                K = 0.3;
                tResult('K (forceEarthlike floor applied)', K, 'AoW: K raised to minimum 0.3');
            } else {
                tResult('K (forceEarthlike floor)', 'skipped', `AoW: K=${K.toFixed(2)} already ≥ 0.3`);
            }
        }

        K = Math.min(3.0, Math.max(0, K));
        sys.systemMetallicity = roundToSigFigs(K, 2);
        tResult('System Metallicity', sys.systemMetallicity, 'AoW: Step 5 complete');

        // --- STEP 6: STELLAR EVOLUTION ---
        tSection('AoW Step 6: Stellar Evolution');

        sys.stars.forEach(star => {
            const M = star.initialMass;
            tSection(`AoW Step 6: Star ${star.label} (${M} M☉)`);

            if (M < 0.08) {
                // CASE 1: BROWN DWARF
                // Guard against division by zero on age; age < 0.01 Gyr is astrophysically unrealistic.
                const safeAge = Math.max(0.01, sys.systemAge);
                const rawT = (18600 * Math.pow(M, 0.8)) / Math.pow(safeAge, 0.3);
                const variedT = rawT * (0.90 + rng() * 0.20);
                star.effectiveTemperature = Math.round(Math.min(3000, variedT));
                star.radius = 0.00047; // AU — fixed constant for all brown dwarfs
                star.luminosity = Math.pow(star.effectiveTemperature, 4) / 1.1e17;
                star.initialLuminosity = 0.00075; // fixed formation luminosity per AoW rules; current L is always lower
                star.state = 'Brown Dwarf';
                tResult(`Star ${star.label}`, `${star.state} | T=${star.effectiveTemperature} K | L0=${star.initialLuminosity} | L=${star.luminosity.toExponential(3)} | R=${star.radius} AU`, 'AoW: Brown Dwarf formulas');

            } else if (M < 0.50) {
                // CASE 2: RED DWARF (0.08 ≤ mass < 0.50)
                const row = interpolateByMass(redDwarfStellarCharacteristicsTable.results, M);
                star.effectiveTemperature = Math.round(row.expectedEffectiveTemperature * (0.90 + rng() * 0.20));
                star.luminosity = row.expectedLuminosity * (0.90 + rng() * 0.20);
                star.initialLuminosity = star.luminosity;
                star.radius = calcRadiusAU(star.luminosity, star.effectiveTemperature);
                star.state = 'Main Sequence';
                tResult(`Star ${star.label}`, `${star.state} | T=${star.effectiveTemperature} K | L=${star.luminosity.toFixed(5)} | R=${star.radius.toFixed(6)} AU`, 'AoW: Red Dwarf (±10%)');

            } else {
                // CASE 3: MAIN SEQUENCE (mass ≥ 0.50)
                const row = interpolateByMass(mainSequenceStellarCharacteristicsTable.results, M);
                const L0 = row.initialLuminosity;
                star.initialLuminosity = L0;
                const GR = row.luminosityGrowthRate;
                const T0 = row.initialEffectiveTemperature;
                const Tf = row.finalEffectiveTemperature;
                const S  = row.mainSequenceLifespanGyr;
                const A  = sys.systemAge;

                if (A <= S) {
                    // SUB-CASE A: STILL ON MAIN SEQUENCE
                    const tRatio = A / S;
                    const rawT = T0 + (Tf - T0) * tRatio;
                    const rawL = (A <= 0.8 * S)
                        ? L0 * Math.pow(GR, A)
                        : L0 * Math.pow(GR, (3 * A) - (1.6 * S));

                    star.effectiveTemperature = Math.round(rawT * (0.95 + rng() * 0.10));
                    star.luminosity = rawL * (0.95 + rng() * 0.10);
                    star.radius = calcRadiusAU(star.luminosity, star.effectiveTemperature);
                    star.state = 'Main Sequence';
                    const formula = A <= 0.8 * S ? 'L=L0·GR^A' : 'L=L0·GR^(3A-1.6S)';
                    tResult(`Star ${star.label}`, `${star.state} | T=${star.effectiveTemperature} K | L=${star.luminosity.toFixed(4)} | R=${star.radius.toFixed(6)} AU | ${formula}`, 'AoW: MS Sub-case A');

                } else if (A <= S * 1.15) {
                    // SUB-CASE B: POST-MAIN SEQUENCE (Subgiant / Red Giant / Horizontal Branch)
                    const evolutionRoll = rollD100();
                    tResult(`Star ${star.label} post-MS roll`, evolutionRoll, 'AoW: MS Sub-case B state roll');

                    if (evolutionRoll <= 60) {
                        // SUBGIANT
                        const baseL = L0 * Math.pow(GR, 1.4 * S);
                        star.luminosity = baseL * (1.0 + rng() * 0.10);
                        // Select T between 5000 K and finalEffectiveTemperature
                        const tLow  = Math.min(5000, Tf);
                        const tHigh = Math.max(5000, Tf);
                        star.effectiveTemperature = Math.round(tLow + rng() * (tHigh - tLow));
                        star.radius = calcRadiusAU(star.luminosity, star.effectiveTemperature);
                        star.state = 'Subgiant';
                        tResult(`Star ${star.label}`, `${star.state} | T=${star.effectiveTemperature} K | L=${star.luminosity.toFixed(4)} | R=${star.radius.toFixed(6)} AU`, 'AoW: Subgiant formulas');

                    } else if (evolutionRoll <= 90) {
                        // RED GIANT BRANCH
                        const Kval = rng(); // 0.0–1.0 evolution position
                        const rawT  = 5000 - (Kval * 2000);
                        const rawL  = Math.pow(50, 1 + Kval);
                        star.effectiveTemperature = Math.round(rawT * (0.95 + rng() * 0.10));
                        star.luminosity = roundToSigFigs(rawL * (0.95 + rng() * 0.10), 3);
                        star.radius = calcRadiusAU(star.luminosity, star.effectiveTemperature);
                        star.state = 'Red Giant Branch';
                        tResult(`Star ${star.label}`, `${star.state} | K=${Kval.toFixed(3)} | T=${star.effectiveTemperature} K | L=${star.luminosity} | R=${star.radius.toFixed(4)} AU`, 'AoW: Red Giant formulas');

                    } else {
                        // HORIZONTAL BRANCH
                        star.luminosity = 50 + rng() * 50;
                        star.effectiveTemperature = 5000;
                        star.radius = calcRadiusAU(star.luminosity, star.effectiveTemperature);
                        star.state = 'Horizontal Branch';
                        tResult(`Star ${star.label}`, `${star.state} | T=${star.effectiveTemperature} K (fixed) | L=${star.luminosity.toFixed(2)} | R=${star.radius.toFixed(4)} AU`, 'AoW: Horizontal Branch');
                    }

                } else {
                    // SUB-CASE C: WHITE DWARF
                    const wdMassRaw = (0.43 * M) + 0.10;
                    star.wdMass = wdMassRaw * (0.95 + rng() * 0.10);
                    const A_WD = A - (S * 1.15); // time spent cooling since end of fusing lifespan
                    star.wdCoolingAge = A_WD;
                    const wdTRaw = (13500 * Math.pow(star.wdMass, 0.25)) / Math.pow(A_WD, 0.35);
                    star.effectiveTemperature = Math.round(roundToSigFigs(wdTRaw * (0.90 + rng() * 0.20), 3));
                    star.radiusKm = 5500 / Math.pow(star.wdMass, 1 / 3);
                    star.radius = star.radiusKm / 150000000; // AU — for cross-system consistency
                    star.luminosity = (star.radiusKm * star.radiusKm * Math.pow(star.effectiveTemperature, 4)) / 5.4e26;
                    star.state = 'White Dwarf';
                    tResult(`Star ${star.label}`, `${star.state} | M_WD=${star.wdMass.toFixed(3)} M☉ | A_WD=${A_WD.toFixed(3)} Gyr | T=${star.effectiveTemperature} K | R=${star.radiusKm.toFixed(0)} km | L=${star.luminosity.toExponential(3)}`, 'AoW: White Dwarf formulas');
                }
            }
        });

        // --- STEP 7: STELLAR CLASSIFICATION ---
        tSection('AoW Step 7: Stellar Classification');

        sys.stars.forEach(star => {
            if (star.state === 'White Dwarf') {
                star.spectralClassification = 'D';
            } else {
                const spectralEntry = lookupClosestSpectralType(star.effectiveTemperature);

                let luminosityClass;
                switch (star.state) {
                    case 'Brown Dwarf':
                    case 'Main Sequence':   luminosityClass = 'V';   break;
                    case 'Subgiant':        luminosityClass = 'IV';  break;
                    case 'Red Giant Branch':
                    case 'Horizontal Branch': luminosityClass = 'III'; break;
                    default:                luminosityClass = 'V';
                }

                star.spectralClassification = spectralEntry.type + luminosityClass;
            }
            tResult(`Star ${star.label} classification`, star.spectralClassification, 'AoW: Step 7 complete');

            // Populate split fields consumed by the filter engine
            if (star.state === 'White Dwarf') {
                star.sType = 'D';  star.sClass = 'D';  star.subType = 0;
            } else if (star.state === 'Brown Dwarf') {
                star.sType = 'BD'; star.sClass = 'BD'; star.subType = 0;
            } else {
                const _m = star.spectralClassification.match(/^([OBAFGKML])(\d+)\s*(Ia|Ib|II|III|IV|V)$/i);
                if (_m) {
                    star.sType   = _m[1].toUpperCase();
                    star.subType = parseInt(_m[2], 10);
                    star.sClass  = _m[3];
                }
            }

            // Tally this star's luminosity class (module-level running total)
            const tallyKey = star.sClass !== undefined ? star.sClass : 'unknown';
            _lumClassTally[tallyKey] = (_lumClassTally[tallyKey] || 0) + 1;

            // Log Class III, IV, and D (White Dwarf) at the moment of classification — excludes V and BD
            if (star.sClass !== 'V' && star.sClass !== 'BD') {
                const massLabel = star.state === 'White Dwarf'
                    ? (star.wdMass || 0).toFixed(3)
                    : (star.initialMass || 0).toFixed(3);
                console.log(
                    `[AoW Non-V Star] Hex ${sys.hexId} | Star ${star.label}: ${star.spectralClassification}` +
                    ` (${star.state}) | sClass: ${star.sClass}` +
                    ` | Mass: ${massLabel} M☉` +
                    ` | Lum: ${(star.luminosity || 0).toFixed(4)} L☉` +
                    ` | Teff: ${Math.round(star.effectiveTemperature || 0)} K` +
                    ` | Age: ${(sys.systemAge || 0).toFixed(2)} Gyr`
                );
            }
        });

    }

    // =================================================================
    // ALGORITHM CHUNK 3: STELLAR ORBITAL PARAMETERS
    // AoW Step 8
    // Outputs: sys.orbits — array of orbit records for each pair/grouping.
    // Skipped entirely for Singleton systems.
    // =================================================================

    function generateStellarOrbits(sys) {
        if (sys.hierarchy === 'Singleton') {
            if (typeof tSkip === 'function') tSkip('Singleton: no stellar orbits to calculate');
            return;
        }

        tSection('AoW Chunk 3: Stellar Orbital Parameters');

        // ---------------------------------------------------------------
        // LOCAL HELPERS
        // ---------------------------------------------------------------

        const SEPARATION_ORDER = [
            'Extremely Close', 'Very Close', 'Close', 'Moderate', 'Wide', 'Very Wide'
        ];

        function categoryIndex(cat) { return SEPARATION_ORDER.indexOf(cat); }

        function nextHigherCategory(cat) {
            const idx = categoryIndex(cat);
            return SEPARATION_ORDER[Math.min(idx + 1, SEPARATION_ORDER.length - 1)];
        }

        // Eccentricity roll modifiers by separation category (Wide and Very Wide = 0)
        const ECCENTRICITY_MODIFIER = {
            'Extremely Close': -8,
            'Very Close':      -6,
            'Close':           -4,
            'Moderate':        -2,
            'Wide':             0,
            'Very Wide':        0
        };

        // Roll 3d6 + modifier on stellarSeparationTable
        function rollSeparation(modifier) {
            const raw = roll3D6();
            const modified = raw + modifier;
            const row = lookupByRoll(stellarSeparationTable.results, modified);
            tResult('Separation roll', `3d6=${raw} mod=${modifier} → ${row.separation} (base ${row.baseDistanceAU} AU)`, 'AoW Table: Stellar Separation');
            return { separation: row.separation, baseDistanceAU: row.baseDistanceAU };
        }

        // Bump a separation to the category immediately above a given reference
        function bumpToNextAbove(referenceCat) {
            const bumped = nextHigherCategory(referenceCat);
            const row = stellarSeparationTable.results.find(r => r.separation === bumped);
            return { separation: bumped, baseDistanceAU: row.baseDistanceAU };
        }

        // Roll 3d6 + separation modifier on stellarOrbitalEccentricityTable
        function rollEccentricity(separation) {
            const raw = roll3D6();
            const modifier = ECCENTRICITY_MODIFIER[separation] || 0;
            const modified = raw + modifier;
            const row = lookupByRoll(stellarOrbitalEccentricityTable.results, modified);
            tResult('Eccentricity roll', `3d6=${raw} mod=${modifier} → E=${row.eccentricity}`, 'AoW Table: Stellar Orbital Eccentricity');
            return row.eccentricity;
        }

        // R = baseDistance × 10^(rng()*0.99), then ±5%, rounded to 3 sig figs (spec p.51)
        function calcAverageDistance(baseDistanceAU) {
            const rndFloat = rng() * 0.99;
            const raw = baseDistanceAU * Math.pow(10, rndFloat);
            return roundToSigFigs(raw * (0.95 + rng() * 0.10), 3);
        }

        // Build a complete orbit record
        function buildOrbit(label, R, E, mTotal) {
            const Rmin = R * (1 - E);
            const Rmax = R * (1 + E);
            const P    = Math.sqrt(Math.pow(R, 3) / mTotal);
            return { label, R, E, Rmin, Rmax, P, mTotal, stabilityAdjusted: false };
        }

        // Use wdMass for white dwarfs; initialMass otherwise
        function starMass(star) {
            return star.state === 'White Dwarf' ? star.wdMass : star.initialMass;
        }

        // Direct-solve stability enforcement: outer R_min must be ≥ 3 × inner R_max
        function enforceStability(outerOrbit, innerRmax) {
            if (outerOrbit.Rmin < 3 * innerRmax) {
                const minR = (3 * innerRmax) / (1 - outerOrbit.E);
                outerOrbit.R    = minR;
                outerOrbit.Rmin = minR * (1 - outerOrbit.E);
                outerOrbit.Rmax = minR * (1 + outerOrbit.E);
                outerOrbit.P    = Math.sqrt(Math.pow(minR, 3) / outerOrbit.mTotal);
                outerOrbit.stabilityAdjusted = true;
                tResult(`${outerOrbit.label} stability enforced`,
                    `R set to ${minR.toFixed(4)} AU (R_min now ${outerOrbit.Rmin.toFixed(4)} ≥ 3×${innerRmax.toFixed(4)})`,
                    'AoW: Direct-solve stability constraint');
            }
        }

        // Roche lobe check for a star pair; returns status string and lobe radii
        function rocheCheck(orbit, starSelf, starOther) {
            const mSelf  = starMass(starSelf);
            const mOther = starMass(starOther);
            const rLobeSelf  = orbit.Rmin * Math.max(0, 0.38 + 0.2 * Math.log10(mSelf  / mOther));
            const rLobeOther = orbit.Rmin * Math.max(0, 0.38 + 0.2 * Math.log10(mOther / mSelf));
            const selfOver  = starSelf.radius  > rLobeSelf;
            const otherOver = starOther.radius > rLobeOther;
            const status = (selfOver && otherOver) ? 'Contact Binary'
                         : (selfOver || otherOver) ? 'Semi-Detached Binary'
                         : 'Normal';
            tResult(`${orbit.label} Roche`, `${status} | R_lobe_self=${rLobeSelf.toExponential(3)} AU | R_lobe_other=${rLobeOther.toExponential(3)} AU`, 'AoW: Roche Lobe Check');
            return { status, rLobeSelf, rLobeOther };
        }

        // Roche check is needed for Extremely Close pairs, or Very Close/Close when a Red Giant is present
        function needsRocheCheck(separation, starX, starY) {
            if (separation === 'Extremely Close') return true;
            if (['Very Close', 'Close'].includes(separation)) {
                return starX.state === 'Red Giant Branch' || starY.state === 'Red Giant Branch';
            }
            return false;
        }

        function logOrbit(o) {
            tResult(`Orbit ${o.label}`,
                `sep=${o.separation} | R=${o.R.toFixed(4)} AU | E=${o.E} | Rmin=${o.Rmin.toFixed(4)} | Rmax=${o.Rmax.toFixed(4)} | P=${o.P.toFixed(4)} yr${o.stabilityAdjusted ? ' [STABILITY ADJUSTED]' : ''}`,
                'AoW: Orbital Parameters');
        }

        // ---------------------------------------------------------------
        // MAIN ORBITAL CALCULATION BY HIERARCHY
        // ---------------------------------------------------------------

        sys.orbits = [];
        const [sA, sB, sC, sD] = sys.stars;

        // --- BINARY ---
        if (sys.hierarchy === 'Binary') {
            const sep = rollSeparation(0);
            const E   = rollEccentricity(sep.separation);
            const R   = calcAverageDistance(sep.baseDistanceAU);
            const orb = buildOrbit('A-B', R, E, starMass(sA) + starMass(sB));
            orb.separation = sep.separation;
            if (needsRocheCheck(sep.separation, sA, sB)) orb.roche = rocheCheck(orb, sA, sB);
            logOrbit(orb);
            sys.orbits.push(orb);

        // --- TRINARY (A-B, C) ---
        } else if (sys.hierarchy === 'Trinary (A-B, C)') {
            // Inner pair A-B
            const innerSep = rollSeparation(-3);
            const innerE   = rollEccentricity(innerSep.separation);
            const innerR   = calcAverageDistance(innerSep.baseDistanceAU);
            const innerOrb = buildOrbit('A-B', innerR, innerE, starMass(sA) + starMass(sB));
            innerOrb.separation = innerSep.separation;
            if (needsRocheCheck(innerSep.separation, sA, sB)) innerOrb.roche = rocheCheck(innerOrb, sA, sB);
            logOrbit(innerOrb);
            sys.orbits.push(innerOrb);

            // Outer orbit: C orbiting A-B
            let outerSep = rollSeparation(0);
            if (categoryIndex(outerSep.separation) <= categoryIndex(innerSep.separation)) {
                tResult('Outer tier bump', `${outerSep.separation} → next above ${innerSep.separation}`, 'AoW: Outer must exceed inner tier');
                outerSep = bumpToNextAbove(innerSep.separation);
            }
            const outerE   = rollEccentricity(outerSep.separation);
            const outerR   = calcAverageDistance(outerSep.baseDistanceAU);
            const outerOrb = buildOrbit('C→(A-B)', outerR, outerE, starMass(sA) + starMass(sB) + starMass(sC));
            outerOrb.separation = outerSep.separation;
            enforceStability(outerOrb, innerOrb.Rmax);
            logOrbit(outerOrb);
            sys.orbits.push(outerOrb);

        // --- TRINARY (A, B-C) ---
        } else if (sys.hierarchy === 'Trinary (A, B-C)') {
            // Inner pair B-C
            const innerSep = rollSeparation(-3);
            const innerE   = rollEccentricity(innerSep.separation);
            const innerR   = calcAverageDistance(innerSep.baseDistanceAU);
            const innerOrb = buildOrbit('B-C', innerR, innerE, starMass(sB) + starMass(sC));
            innerOrb.separation = innerSep.separation;
            if (needsRocheCheck(innerSep.separation, sB, sC)) innerOrb.roche = rocheCheck(innerOrb, sB, sC);
            logOrbit(innerOrb);
            sys.orbits.push(innerOrb);

            // Outer orbit: A orbiting B-C
            let outerSep = rollSeparation(0);
            if (categoryIndex(outerSep.separation) <= categoryIndex(innerSep.separation)) {
                tResult('Outer tier bump', `${outerSep.separation} → next above ${innerSep.separation}`, 'AoW: Outer must exceed inner tier');
                outerSep = bumpToNextAbove(innerSep.separation);
            }
            const outerE   = rollEccentricity(outerSep.separation);
            const outerR   = calcAverageDistance(outerSep.baseDistanceAU);
            const outerOrb = buildOrbit('A→(B-C)', outerR, outerE, starMass(sA) + starMass(sB) + starMass(sC));
            outerOrb.separation = outerSep.separation;
            enforceStability(outerOrb, innerOrb.Rmax);
            logOrbit(outerOrb);
            sys.orbits.push(outerOrb);

        // --- QUATERNARY (A-B, C-D) ---
        } else if (sys.hierarchy === 'Quaternary (A-B, C-D)') {
            // Inner pair A-B
            const inner1Sep = rollSeparation(-3);
            const inner1E   = rollEccentricity(inner1Sep.separation);
            const inner1R   = calcAverageDistance(inner1Sep.baseDistanceAU);
            const inner1Orb = buildOrbit('A-B', inner1R, inner1E, starMass(sA) + starMass(sB));
            inner1Orb.separation = inner1Sep.separation;
            if (needsRocheCheck(inner1Sep.separation, sA, sB)) inner1Orb.roche = rocheCheck(inner1Orb, sA, sB);
            logOrbit(inner1Orb);
            sys.orbits.push(inner1Orb);

            // Inner pair C-D
            const inner2Sep = rollSeparation(-3);
            const inner2E   = rollEccentricity(inner2Sep.separation);
            const inner2R   = calcAverageDistance(inner2Sep.baseDistanceAU);
            const inner2Orb = buildOrbit('C-D', inner2R, inner2E, starMass(sC) + starMass(sD));
            inner2Orb.separation = inner2Sep.separation;
            if (needsRocheCheck(inner2Sep.separation, sC, sD)) inner2Orb.roche = rocheCheck(inner2Orb, sC, sD);
            logOrbit(inner2Orb);
            sys.orbits.push(inner2Orb);

            // Outer orbit: A-B orbiting C-D; must exceed widest inner tier
            const widestInnerSep = categoryIndex(inner1Sep.separation) >= categoryIndex(inner2Sep.separation)
                ? inner1Sep.separation : inner2Sep.separation;
            let outerSep = rollSeparation(0);
            if (categoryIndex(outerSep.separation) <= categoryIndex(widestInnerSep)) {
                tResult('Outer tier bump', `${outerSep.separation} → next above widest inner (${widestInnerSep})`, 'AoW: Quaternary outer must exceed widest inner');
                outerSep = bumpToNextAbove(widestInnerSep);
            }
            const outerE   = rollEccentricity(outerSep.separation);
            const outerR   = calcAverageDistance(outerSep.baseDistanceAU);
            const outerOrb = buildOrbit('(A-B)→(C-D)', outerR, outerE,
                starMass(sA) + starMass(sB) + starMass(sC) + starMass(sD));
            outerOrb.separation = outerSep.separation;
            enforceStability(outerOrb, Math.max(inner1Orb.Rmax, inner2Orb.Rmax));
            logOrbit(outerOrb);
            sys.orbits.push(outerOrb);
        }

        tResult('Chunk 3 complete', `${sys.orbits.length} orbit(s) for ${sys.hierarchy}`, 'AoW: Stellar Orbital Parameters');
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    function resetLumTally() {
        Object.keys(_lumClassTally).forEach(k => delete _lumClassTally[k]);
    }

    function printLumTally() {
        const tallyStr = Object.keys(_lumClassTally).sort()
            .map(k => `${k}: ${_lumClassTally[k]}`).join(' | ');
        console.log(`[AoW Lum Tally] ${tallyStr}`);
    }

    if (typeof window !== 'undefined') {
        window.AoWStellarEngine = {
            generateStarHierarchyAndMasses:       generateStarHierarchyAndMasses,
            generateAgeMetallicityAndEvolution:   generateAgeMetallicityAndEvolution,
            generateStellarOrbits:                generateStellarOrbits,
            resetLumTally:                        resetLumTally,
            printLumTally:                        printLumTally
        };
    }

    return {
        generateStarHierarchyAndMasses:       generateStarHierarchyAndMasses,
        generateAgeMetallicityAndEvolution:   generateAgeMetallicityAndEvolution,
        generateStellarOrbits:                generateStellarOrbits,
        resetLumTally:                        resetLumTally,
        printLumTally:                        printLumTally
    };
}));
