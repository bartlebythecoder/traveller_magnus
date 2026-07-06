/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: AoW Seed Bridge
 * Description: Bridges the System Editor's flat, engine-agnostic working-copy shape into
 * Architect of Worlds' internal simulation model (per-star evolution physics + disk worksheets),
 * so a user-built/edited AoW system can actually be generated instead of silently no-op'ing.
 * See directives/project_manifest.md, Section 5 "AoW" subsection and OW-9 for the background.
 *
 * Following the "Sean Protocol": Zero Logic beyond spec, Trace Logging.
 * This module does not duplicate aow_stellar_engine.js / aow_world_engine.js's formulas —
 * it resolves inputs (mass, age, hierarchy, worksheets) that those engines' own functions
 * then run against normally.
 *
 * Data source: rules/aow_data.js (must be loaded before this file)
 * Called by: js/aow_bottomup_generator.js, js/system_editor.js (_ENGINE_ADAPTERS.AoW)
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AoWSeedBridge = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SEPARATION_ORDER = ['Extremely Close', 'Very Close', 'Close', 'Moderate', 'Wide', 'Very Wide'];
    const UNIVERSE_AGE_GYR = 13.5; // matches the reference age used elsewhere in aow_stellar_engine.js (metallicity formula)

    // =================================================================
    // SPECTRAL TYPE -> TARGET TEMPERATURE
    // =================================================================

    // spectralTypeTable.results rows are {temperature, type} where type is already
    // letter+digit (e.g. "G2") — no luminosity class. Direct lookup, not interpolation.
    function findSpectralTemp(sType, subType) {
        const wantType = `${sType}${subType}`;
        const exact = spectralTypeTable.results.find(r => r.type === wantType);
        if (exact) return { temperature: exact.temperature, exact: true };

        const sameLetter = spectralTypeTable.results.filter(r => r.type.charAt(0) === sType);
        if (sameLetter.length === 0) return null;

        let best = sameLetter[0];
        let bestDiff = Infinity;
        for (const r of sameLetter) {
            const rSub = parseInt(r.type.slice(1), 10);
            const diff = Math.abs(rSub - subType);
            if (diff < bestDiff) { bestDiff = diff; best = r; }
        }
        return { temperature: best.temperature, exact: false };
    }

    // =================================================================
    // MASS SOLVERS — one per luminosity-class regime
    // =================================================================

    // Class V, mass >= 0.50 (Main Sequence table). Both mass AND age-within-lifespan affect
    // temperature (T0 at age 0 -> Tf at age S), so this scans table rows for one whose
    // [T0,Tf] range contains the target, returning the age fraction (0-1) needed to hit it.
    function solveMainSequence(targetTemp) {
        const rows = mainSequenceStellarCharacteristicsTable.results;
        for (const row of rows) {
            const lo = Math.min(row.initialEffectiveTemperature, row.finalEffectiveTemperature);
            const hi = Math.max(row.initialEffectiveTemperature, row.finalEffectiveTemperature);
            if (targetTemp >= lo && targetTemp <= hi) {
                const span = row.finalEffectiveTemperature - row.initialEffectiveTemperature;
                const frac = span === 0 ? 0 : (targetTemp - row.initialEffectiveTemperature) / span;
                return { mass: row.mass, ageFraction: Math.max(0, Math.min(1, frac)), row, exact: true };
            }
        }
        // No row's [T0,Tf] window reaches the target — pick the closest row by midpoint and
        // clamp the age fraction to whichever end is nearest. Approximate but bounded; this is
        // a game-generation tool, not a research-grade stellar model.
        let best = rows[0];
        let bestDiff = Infinity;
        for (const row of rows) {
            const mid = (row.initialEffectiveTemperature + row.finalEffectiveTemperature) / 2;
            const diff = Math.abs(mid - targetTemp);
            if (diff < bestDiff) { bestDiff = diff; best = row; }
        }
        const frac = Math.abs(targetTemp - best.initialEffectiveTemperature) <= Math.abs(targetTemp - best.finalEffectiveTemperature) ? 0 : 1;
        return { mass: best.mass, ageFraction: frac, row: best, exact: false };
    }

    // Class V, 0.08 <= mass < 0.50 (Red Dwarf table). No age dependence in AoW's own model —
    // temperature is a pure function of mass — so this is a direct table inversion.
    function solveRedDwarfMass(targetTemp) {
        const rows = redDwarfStellarCharacteristicsTable.results;
        if (targetTemp <= rows[0].expectedEffectiveTemperature) return rows[0].mass;
        if (targetTemp >= rows[rows.length - 1].expectedEffectiveTemperature) return rows[rows.length - 1].mass;
        for (let i = 0; i < rows.length - 1; i++) {
            const lo = rows[i], hi = rows[i + 1];
            if (targetTemp >= lo.expectedEffectiveTemperature && targetTemp <= hi.expectedEffectiveTemperature) {
                const span = hi.expectedEffectiveTemperature - lo.expectedEffectiveTemperature;
                const t = span === 0 ? 0 : (targetTemp - lo.expectedEffectiveTemperature) / span;
                return lo.mass + t * (hi.mass - lo.mass);
            }
        }
        return rows[rows.length - 1].mass;
    }

    // =================================================================
    // PER-STAR AGE WINDOW (valid [minAge, maxAge] for the chosen spectral type)
    //
    // sType/sClass/subType come straight off the editor's star fields. Two classes
    // (Brown Dwarf 'BD' and White Dwarf 'D') collapse to a fixed display label in
    // aow_stellar_engine.js's own Step 7 regardless of exact temperature — confirmed by
    // reading that classification code — so those two don't need precise temp-matching;
    // any age within a broad, physically sane window is fine.
    // =================================================================

    function getValidAgeWindow(star) {
        // NOTE: the seed's subtype field is named 'decimal' (matching _buildSeedSys's shared
        // star-building loop in system_editor.js), not 'subType' — confirmed against that code.
        const sType = star.sType, sClass = star.sClass, subType = star.decimal != null ? star.decimal : 0;

        if (sType === 'BD') {
            // Brown Dwarfs display as 'BD' regardless of effectiveTemperature (Step 7 override) —
            // any age works; mass is picked (not solved) below in resolveStarPhysics.
            return { minAge: 0.01, maxAge: UNIVERSE_AGE_GYR, massHint: null, regime: 'BrownDwarf' };
        }
        if (sType === 'D') {
            // White Dwarfs also display as 'D' regardless of exact temp/mass (Step 7 override).
            // Requires age > progenitor's S*1.15 — use a representative 1.0 Msun progenitor
            // (main sequence lifespan ~10-11 Gyr per the table) as a reasonable default.
            const progenitorRow = mainSequenceStellarCharacteristicsTable.results
                .reduce((a, b) => Math.abs(a.mass - 1.0) <= Math.abs(b.mass - 1.0) ? a : b);
            const minAge = progenitorRow.mainSequenceLifespanGyr * 1.15;
            return { minAge, maxAge: UNIVERSE_AGE_GYR, massHint: progenitorRow.mass, regime: 'WhiteDwarf' };
        }

        const found = findSpectralTemp(sType, subType);
        const targetTemp = found ? found.temperature : null;

        if (sClass === 'V') {
            if (targetTemp !== null && targetTemp <= redDwarfStellarCharacteristicsTable.results[redDwarfStellarCharacteristicsTable.results.length - 1].expectedEffectiveTemperature) {
                // Red Dwarf regime — no age dependence, any age in the universe's lifetime works.
                return { minAge: 0.01, maxAge: UNIVERSE_AGE_GYR, massHint: solveRedDwarfMass(targetTemp), regime: 'RedDwarf' };
            }
            const solved = targetTemp !== null ? solveMainSequence(targetTemp) : null;
            if (solved) {
                const S = solved.row.mainSequenceLifespanGyr;
                return { minAge: 0, maxAge: S, massHint: solved.mass, regime: 'MainSequence', solved };
            }
            return { minAge: 0, maxAge: UNIVERSE_AGE_GYR, massHint: null, regime: 'MainSequence' };
        }

        if (sClass === 'IV') {
            // Subgiant window: (S, 1.15S] for whichever mass's [T0,Tf] would otherwise have
            // reached this temperature on the main sequence — reuse the same table scan.
            const solved = targetTemp !== null ? solveMainSequence(targetTemp) : null;
            const S = solved ? solved.row.mainSequenceLifespanGyr : mainSequenceStellarCharacteristicsTable.results[0].mainSequenceLifespanGyr;
            return { minAge: S, maxAge: S * 1.15, massHint: solved ? solved.mass : null, regime: 'Subgiant' };
        }

        if (sClass === 'III') {
            // Red Giant Branch / Horizontal Branch both live in the same (S, 1.15S] window as
            // Subgiant — AoW rolls which of the three sub-states a post-MS star lands in, so
            // the window itself doesn't depend on RGB vs HB, only the mass estimate does.
            const solved = targetTemp !== null ? solveMainSequence(targetTemp) : null;
            const S = solved ? solved.row.mainSequenceLifespanGyr : mainSequenceStellarCharacteristicsTable.results[0].mainSequenceLifespanGyr;
            return { minAge: S, maxAge: S * 1.15, massHint: solved ? solved.mass : null, regime: 'Giant' };
        }

        // Unknown/unsupported sClass — fall back to a permissive window rather than blocking.
        return { minAge: 0, maxAge: UNIVERSE_AGE_GYR, massHint: null, regime: 'Unknown' };
    }

    // =================================================================
    // SYSTEM-AGE RECONCILIATION — intersect every manually-set star's window
    // =================================================================

    function reconcileSystemAge(stars) {
        let lo = 0, hi = UNIVERSE_AGE_GYR;
        const windows = [];
        for (const star of stars) {
            const w = getValidAgeWindow(star);
            windows.push({ star, window: w });
            lo = Math.max(lo, w.minAge);
            hi = Math.min(hi, w.maxAge);
        }
        if (lo > hi) {
            return {
                conflict: true,
                stars: windows.map(w => ({ label: w.star.name || w.star.sType, minAge: w.window.minAge, maxAge: w.window.maxAge })),
            };
        }
        const age = lo + rng() * (hi - lo);
        return { conflict: false, systemAge: age, windows };
    }

    // =================================================================
    // RESOLVE A STAR'S FULL PHYSICS from its chosen spectral type + the reconciled system age
    // No jitter is applied — a manually-chosen star gets exact deterministic values.
    // =================================================================

    function resolveStarPhysics(star, systemAge, precomputedWindow) {
        const w = precomputedWindow || getValidAgeWindow(star);
        const decimal = star.decimal != null ? star.decimal : 0;
        // sType/sClass/decimal are already the user's chosen input, not something to derive —
        // mirrors aow_stellar_engine.js's own Step 7 formatting ("G2V") and its 'BD'/'D' overrides.
        const spectralClassification = (w.regime === 'BrownDwarf') ? 'BD'
            : (w.regime === 'WhiteDwarf') ? 'D'
            : `${star.sType}${decimal}${star.sClass}`;
        const out = {
            initialMass: null, luminosity: null, initialLuminosity: null,
            effectiveTemperature: null, radius: null, state: null,
            spectralClassification,
        };

        if (w.regime === 'BrownDwarf') {
            const M = 0.02 + rng() * 0.059; // representative Brown Dwarf mass, display is fixed to 'BD' anyway
            const safeAge = Math.max(0.01, systemAge);
            out.initialMass = M;
            out.effectiveTemperature = Math.round(Math.min(3000, (18600 * Math.pow(M, 0.8)) / Math.pow(safeAge, 0.3)));
            out.radius = 0.00047;
            out.luminosity = Math.pow(out.effectiveTemperature, 4) / 1.1e17;
            out.initialLuminosity = 0.00075;
            out.state = 'Brown Dwarf';
            return out;
        }

        if (w.regime === 'WhiteDwarf') {
            const M = w.massHint || 1.0;
            const wdMassRaw = (0.43 * M) + 0.10;
            const A_WD = Math.max(0.01, systemAge - w.minAge); // w.minAge is S*1.15 for the White Dwarf regime
            out.initialMass = M;
            out.wdMass = wdMassRaw;
            out.wdCoolingAge = A_WD;
            out.effectiveTemperature = Math.round((13500 * Math.pow(wdMassRaw, 0.25)) / Math.pow(A_WD, 0.35));
            out.radiusKm = 5500 / Math.pow(wdMassRaw, 1 / 3);
            out.radius = out.radiusKm / 150000000;
            out.luminosity = (out.radiusKm * out.radiusKm * Math.pow(out.effectiveTemperature, 4)) / 5.4e26;
            out.initialLuminosity = out.luminosity;
            out.state = 'White Dwarf';
            return out;
        }

        if (w.regime === 'RedDwarf') {
            const M = w.massHint;
            const row = interpolateRedDwarf(M);
            out.initialMass = M;
            out.effectiveTemperature = Math.round(row.expectedEffectiveTemperature);
            out.luminosity = row.expectedLuminosity;
            out.initialLuminosity = out.luminosity;
            out.radius = calcRadiusAU(out.luminosity, out.effectiveTemperature);
            out.state = 'Main Sequence';
            return out;
        }

        // MainSequence / Subgiant / Giant — all driven by a (mass, ageFraction-or-evolutionRoll) pair
        const ownTemp = findSpectralTemp(star.sType, decimal);
        const solved = w.solved || (ownTemp && solveMainSequence(ownTemp.temperature));
        const row = solved ? solved.row : mainSequenceStellarCharacteristicsTable.results[0];
        out.initialMass = row.mass;
        out.initialLuminosity = row.initialLuminosity;

        if (w.regime === 'MainSequence') {
            const A = systemAge, S = row.mainSequenceLifespanGyr;
            const rawT = row.initialEffectiveTemperature + (row.finalEffectiveTemperature - row.initialEffectiveTemperature) * (A / S);
            const rawL = (A <= 0.8 * S) ? row.initialLuminosity * Math.pow(row.luminosityGrowthRate, A)
                                         : row.initialLuminosity * Math.pow(row.luminosityGrowthRate, (3 * A) - (1.6 * S));
            out.effectiveTemperature = Math.round(rawT);
            out.luminosity = rawL;
            out.radius = calcRadiusAU(out.luminosity, out.effectiveTemperature);
            out.state = 'Main Sequence';
        } else if (w.regime === 'Subgiant') {
            const baseL = row.initialLuminosity * Math.pow(row.luminosityGrowthRate, 1.4 * row.mainSequenceLifespanGyr);
            out.luminosity = baseL;
            out.effectiveTemperature = Math.round(Math.min(5000, row.finalEffectiveTemperature));
            out.radius = calcRadiusAU(out.luminosity, out.effectiveTemperature);
            out.state = 'Subgiant';
        } else if (w.regime === 'Giant') {
            // Prefer Red Giant Branch (has a free parameter to hit an arbitrary target temperature)
            // over Horizontal Branch (fixed at 5000K) unless the target itself is ~5000K.
            const targetTemp = ownTemp ? ownTemp.temperature : undefined;
            if (targetTemp !== undefined && Math.abs(targetTemp - 5000) <= 150) {
                out.luminosity = 50 + rng() * 50;
                out.effectiveTemperature = 5000;
                out.state = 'Horizontal Branch';
            } else {
                const rawT = targetTemp != null ? targetTemp : (5000 - rng() * 2000);
                const Kval = Math.max(0, Math.min(1, (5000 - rawT) / 2000));
                out.luminosity = roundToSigFigs3(Math.pow(50, 1 + Kval));
                out.effectiveTemperature = Math.round(rawT);
                out.state = 'Red Giant Branch';
            }
            out.radius = calcRadiusAU(out.luminosity, out.effectiveTemperature);
        }

        return out;
    }

    function interpolateRedDwarf(mass) {
        const rows = redDwarfStellarCharacteristicsTable.results;
        if (mass <= rows[0].mass) return rows[0];
        if (mass >= rows[rows.length - 1].mass) return rows[rows.length - 1];
        for (let i = 0; i < rows.length - 1; i++) {
            const lo = rows[i], hi = rows[i + 1];
            if (mass >= lo.mass && mass <= hi.mass) {
                const t = (mass - lo.mass) / (hi.mass - lo.mass);
                return {
                    expectedEffectiveTemperature: lo.expectedEffectiveTemperature + t * (hi.expectedEffectiveTemperature - lo.expectedEffectiveTemperature),
                    expectedLuminosity: lo.expectedLuminosity + t * (hi.expectedLuminosity - lo.expectedLuminosity),
                };
            }
        }
        return rows[rows.length - 1];
    }

    function calcRadiusAU(luminosity, temperature) {
        return 155000 * Math.sqrt(luminosity) / (temperature * temperature);
    }

    function roundToSigFigs3(v) {
        if (v === 0) return 0;
        const d = Math.ceil(Math.log10(Math.abs(v)));
        const mag = Math.pow(10, 3 - d);
        return Math.round(v * mag) / mag;
    }

    // System metallicity is a pure function of system age (plus a couple of dice rolls) — no
    // star dependency at all, so it can just be computed directly for the seeded path, mirroring
    // aow_stellar_engine.js's own Step 5 formula exactly (kept in sync with that file; only
    // reimplemented here because Step 5 lives bundled inside the monolithic
    // generateAgeMetallicityAndEvolution(), which the seeded path doesn't call as a whole).
    function resolveSystemMetallicity(systemAge) {
        const metalRoll = roll3D6();
        let K = (metalRoll / 10) * (1.2 - (systemAge / 13.5));
        if (systemAge >= 8.0) K = Math.max(0, K - 0.2);
        if (rollD6() === 1) K = Math.min(3.0, K + roll3D6() * 0.1);
        return Math.round(Math.min(3.0, Math.max(0, K)) * 100) / 100;
    }

    // =================================================================
    // HIERARCHY / ORBIT MAPPER — editor's flat stars[] + parentStarId -> AoW hierarchy string
    //
    // Assumes the editor UI has already restricted the shape to one AoW supports (system_editor.js
    // change, plan step 5) — this function maps, it does not itself validate/reject.
    // =================================================================

    function mapHierarchy(stars) {
        const primary = stars.find(s => s.role === 'Primary') || stars[0];
        const companions = stars.filter(s => s !== primary);

        if (companions.length === 0) {
            return { hierarchy: 'Singleton', orbits: [], nodeStars: { A: primary } };
        }
        if (companions.length === 1) {
            return { hierarchy: 'Binary', orbits: [buildOrbitRecord('A-B', companions[0], [primary, companions[0]])], nodeStars: { A: primary, B: companions[0] } };
        }

        // 2 companions: distinguish "both pair with the primary's group" (handled by parentStarId
        // pointing at a companion vs. the primary) to pick one of the two Trinary shapes.
        if (companions.length === 2) {
            const [c1, c2] = companions;
            if (c2.parentStarId === c1._id) {
                // A, (B-C): c2 pairs with c1, and c1's own parent is the primary
                const inner = buildOrbitRecord('B-C', c2, [c1, c2]);
                const outer = buildOrbitRecord('A→(B-C)', c1, [primary, c1, c2]);
                return { hierarchy: 'Trinary (A, B-C)', orbits: [inner, outer], nodeStars: { A: primary, B: c1, C: c2 } };
            }
            // (A-B), C: both companions pair directly with the primary group
            const inner = buildOrbitRecord('A-B', c1, [primary, c1]);
            const outer = buildOrbitRecord('C→(A-B)', c2, [primary, c1, c2]);
            return { hierarchy: 'Trinary (A-B, C)', orbits: [inner, outer], nodeStars: { A: primary, B: c1, C: c2 } };
        }

        // 3 companions -> Quaternary (A-B, C-D): first companion pairs with primary, the other
        // two form their own inner pair and orbit the (A-B) group as a unit.
        const [c1, c2, c3] = companions;
        const inner1 = buildOrbitRecord('A-B', c1, [primary, c1]);
        const inner2 = buildOrbitRecord('C-D', c3, [c2, c3]);
        const outer = buildOrbitRecord('(A-B)→(C-D)', c2, [primary, c1, c2, c3]);
        return { hierarchy: 'Quaternary (A-B, C-D)', orbits: [inner1, inner2, outer], nodeStars: { A: primary, B: c1, C: c2, D: c3 } };
    }

    // Builds an AoW-shaped orbit record { label, R, E, Rmin, Rmax, P, mTotal } from the editor's
    // orbitAU value (already resolved by _orbitIdToAU elsewhere) instead of rolling a separation.
    // Eccentricity isn't an editor-exposed field for companion stars, so it's still rolled normally.
    function buildOrbitRecord(label, companionStar, groupStars) {
        const R = (companionStar.orbitAU != null && companionStar.orbitAU > 0) ? companionStar.orbitAU : 10.0;
        const mTotal = groupStars.reduce((s, st) => s + (starMassForOrbit(st) || 0), 0) || 1.0;
        const E = rollEccentricityForSeparation(bucketSeparation(R));
        const Rmin = R * (1 - E);
        const Rmax = R * (1 + E);
        const P = Math.sqrt(Math.pow(R, 3) / mTotal);
        return { label, R, E, Rmin, Rmax, P, mTotal, stabilityAdjusted: false, separation: bucketSeparation(R).separation };
    }

    function starMassForOrbit(star) {
        return star.wdMass || star.initialMass || star.mass || 1.0;
    }

    function bucketSeparation(auValue) {
        const rows = stellarSeparationTable.results;
        let best = rows[0], bestDiff = Infinity;
        for (const row of rows) {
            const diff = Math.abs(Math.log10(row.baseDistanceAU) - Math.log10(Math.max(auValue, 0.001)));
            if (diff < bestDiff) { bestDiff = diff; best = row; }
        }
        return best;
    }

    const ECCENTRICITY_MODIFIER = { 'Extremely Close': -8, 'Very Close': -6, 'Close': -4, 'Moderate': -2, 'Wide': 0, 'Very Wide': 0 };

    function rollEccentricityForSeparation(sepRow) {
        const raw = roll3D6();
        const modifier = ECCENTRICITY_MODIFIER[sepRow.separation] || 0;
        const row = stellarOrbitalEccentricityTable.results.find(r => (raw + modifier) >= r.minRoll && (raw + modifier) <= r.maxRoll);
        return row ? row.eccentricity : 0;
    }

    function roll3D6() { return rollD6() + rollD6() + rollD6(); }
    function rollD6() { return Math.floor(rng() * 6) + 1; }

    // =================================================================
    // DISK-WORKSHEET SYNTHESIS — reuses AoWWorldEngine.buildNodes/buildDiskWorksheet
    // (must be exposed on the public API — see aow_world_engine.js changes, plan step 2)
    // =================================================================

    // Maps the editor's 3-way body vocabulary (Gas Giant / Belt / World) to an AoW planetType.
    function toAowPlanetType(editorType, isMainworld) {
        if (editorType === 'Gas Giant') return 'Gas Giant (CA)';
        if (editorType === 'Belt') return 'Planetoid Belt';
        return 'Terrestrial';
    }

    // stepPhysicalParameters (aow_world_engine.js) requires planet.mass as an INPUT — it's not
    // something the 13 Phase-3 functions compute, it comes from the disk-formation steps
    // (stepDiskInstability/stepCoreAccretion/stepOligarchicCollision), which are full per-orbit
    // disk simulations that don't reduce to "give me a mass for this one already-placed body".
    // For a body with no manually-seeded mass, use a simple representative default by type
    // (Earth masses) rather than reconstructing that simulation for a single body — same
    // approximation spirit as the Brown/White Dwarf representative-mass fallback above.
    function defaultMassFor(planetType) {
        if (planetType.includes('Gas Giant')) return 50 + rng() * 250;      // roughly Neptune-to-superjovian range
        if (planetType === 'Planetoid Belt') return 0;                      // stepPhysicalParameters skips belts entirely
        return 0.1 + rng() * 2.5;                                          // roughly Mars-to-super-Earth range
    }

    // bodies: flat working-copy body list (each with parentStarId, orbitId/au, type, _raw, etc.)
    // sys must already have .stars/.hierarchy/.orbits resolved (mapHierarchy's output) —
    // WorldEngine.buildNodes(sys) derives the node/focal-star structure from those directly.
    function synthesizeDiskWorksheets(sys, bodies, WorldEngine) {
        const nodes = WorldEngine.buildNodes(sys);
        sys.diskWorksheets = nodes.map(node => WorldEngine.buildDiskWorksheet(sys, node));

        // Determine which worksheet a body belongs to via its parentStarId -> node label.
        const starIdToNodeIdx = {};
        nodes.forEach((node, idx) => {
            node.focalStars.forEach(s => { if (s) starIdToNodeIdx[s._id] = idx; });
        });

        for (const body of bodies) {
            const idx = starIdToNodeIdx[body.parentStarId] != null ? starIdToNodeIdx[body.parentStarId] : 0;
            const worksheet = sys.diskWorksheets[idx];
            if (!worksheet) continue;
            const planetType = toAowPlanetType(body.type, body.isMainworld);

            // Seed real values (not just the _manualFields flag) for every field a gated
            // Phase-3 function checks isManual() against — without this, a field could be
            // flagged manual while its value stayed undefined, so "preserved" would silently
            // preserve nothing.
            const uwpLock = aowUwpLockFor(body);
            const physSeed = aowPhysSeed(body._raw);
            const rawMass = body._raw && body._raw.mass;
            const orbitalRadius = body.au != null ? body.au : 1.0;

            worksheet.planets = worksheet.planets || [];
            worksheet.planets.push(Object.assign({
                _id: body._id,
                label: body.name || `Orbit ${body.orbitId}`,
                orbitNumber: body.orbitId,
                orbitalRadius,
                // Rmin/Rmax are normally set by generateOrbitalDynamics (Chunk 5), which stays
                // skipped for seeded systems (eccentricity isn't an editor-exposed field for a
                // body's own orbit). Zero-eccentricity default (Rmin=Rmax=orbitalRadius) matches
                // the same convention aow_world_engine.js itself uses for its own no-eccentricity
                // case — stepNaturalSatellites (Step 17) requires Rmin to be present.
                Rmin: orbitalRadius,
                Rmax: orbitalRadius,
                planetType,
                mass: rawMass !== undefined ? rawMass : defaultMassFor(planetType),
                satellites: (body.moons || []).map(m => {
                    const mRawMass = m._raw && m._raw.mass;
                    const mUwpLock = aowUwpLockFor(m);
                    const mPhysSeed = aowPhysSeed(m._raw);
                    return Object.assign({
                        _id: m._id,
                        label: m.name || 'Moon',
                        mass: mRawMass !== undefined ? mRawMass : (0.001 + rng() * 0.05),
                        isMainworld: !!m.isMainworld,
                        _manualFields: Array.from(new Set([...(m._manualFields || []), ...mUwpLock.mf, ...mPhysSeed.mf])),
                    }, mUwpLock.fields, mPhysSeed.fields);
                }),
                isMainworld: !!body.isMainworld,
            }, uwpLock.fields, physSeed.fields, {
                // _manualFields last so it isn't clobbered by the Object.assign field spreads above
                _manualFields: Array.from(new Set([...(body._manualFields || []), ...uwpLock.mf, ...physSeed.mf])),
            }));
        }
        return sys.diskWorksheets;
    }

    // =================================================================
    // FIELD-LOCK HELPERS — mirrors CT's/T5's _xUwpLockFor pattern, scoped to the fields the
    // System Editor actually exposes as editable for an AoW body.
    // =================================================================

    const AOW_UWP_FIELDS = ['size', 'atmCode', 'hydroCode', 'pop', 'gov', 'law', 'tl', 'starport'];
    // NOTE: 'surfaceGravity' (not 'gravity') — matches aow_world_engine.js's own planet field.
    // populateAoWWorldsList() aliases it to `gravity` for the viewer/accordion after generation;
    // the editor-facing adapter (system_editor.js, plan step 5) is responsible for reading either
    // name off a previously-generated body, same pattern CT's write-stub already uses for atm/atmCode.
    //
    // This list was originally copied from MgT2E's own field list and had to be corrected after
    // checking against the real code: AoW has no 'greenhouseFactor' field at all (it uses boolean
    // isRunawayDryGreenhouse/isRunawayWetGreenhouse flags instead), 'eccentricity' is set only by
    // generateOrbitalDynamics — which stays skipped for seeded systems (see aow_bottomup_generator.js
    // changes) so nothing ever overwrites a seeded value, no gating needed — and rotation/tilt are
    // named rotationPeriod/obliquity (not siderealHours/axialTilt) and are set across many
    // satellite-tide-lock/resonance-dependent branches, not one clean assignment — left as pure
    // internal simulation state (never user-editable) rather than risk mis-threading guards through
    // logic that wasn't fully read.
    const AOW_PHYS_FIELDS = ['density', 'radius', 'mass', 'surfaceGravity', 'albedo'];

    function aowUwpLockFor(body) {
        const raw = body._raw || {};
        const fields = {}; const mf = [];
        AOW_UWP_FIELDS.forEach(f => { if (raw[f] !== undefined) { fields[f] = raw[f]; mf.push(f); } });
        return { fields, mf };
    }

    function aowPhysSeed(raw) {
        const fields = {}; const mf = [];
        AOW_PHYS_FIELDS.forEach(f => { if (raw && raw[f] !== undefined) { fields[f] = raw[f]; mf.push(f); } });
        return { fields, mf };
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    const api = {
        findSpectralTemp,
        getValidAgeWindow,
        reconcileSystemAge,
        resolveSystemMetallicity,
        resolveStarPhysics,
        mapHierarchy,
        synthesizeDiskWorksheets,
        aowUwpLockFor,
        aowPhysSeed,
        AOW_UWP_FIELDS,
        AOW_PHYS_FIELDS,
    };

    if (typeof window !== 'undefined') {
        window.AoWSeedBridge = api;
    }

    return api;
}));
