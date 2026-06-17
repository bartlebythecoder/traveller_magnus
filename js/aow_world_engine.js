/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: AoW World Engine
 * Description: Protoplanetary disk formation and planet placement for Architect of Worlds.
 * Implements Steps 9–12: disk worksheet, disk instability, core accretion, oligarchic collision.
 * Following the "Sean Protocol": Zero Logic beyond spec, Trace Logging, Halt & Challenge.
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
        root.AoWWorldEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // =================================================================
    // PRIVATE HELPERS
    // =================================================================

    function rollD6()   { return Math.floor(rng() * 6) + 1; }
    function rollD100() { return Math.floor(rng() * 100) + 1; }
    function roll2D6()  { return rollD6() + rollD6(); }
    function roll3D6()  { return rollD6() + rollD6() + rollD6(); }

    // Look up a row in a roll table (rows have minRoll / maxRoll, inclusive both ends).
    function lookupByRoll(tableArray, roll) {
        return tableArray.find(row => roll >= row.minRoll && roll <= row.maxRoll) || null;
    }

    // =================================================================
    // STEP 9 HELPER: BUILD NODE LIST FROM HIERARCHY
    //
    // Each "node" is a focal group (one star or a close binary pair) that
    // generates its own protoplanetary disk worksheet.
    //
    // Node fields:
    //   label         — string identifier ('A', 'B-C', 'A-B', …)
    //   type          — 'S' (single-star orbit) or 'P' (circumbinary orbit)
    //   focalStars    — array of star objects belonging to this focal group
    //   pairOrbit     — (P-type only) the inner-pair stellar orbit from sys.orbits[]
    //   companionOrbit— stellar orbit whose Rmin drives the outer forbidden zone;
    //                   null if no external companion exists
    //
    // Orbit labels from aow_stellar_engine.js:
    //   Binary:              orbits[0] = 'A-B'
    //   Trinary (A, B-C):   orbits[0] = 'B-C', orbits[1] = 'A→(B-C)'
    //   Trinary (A-B, C):   orbits[0] = 'A-B', orbits[1] = 'C→(A-B)'
    //   Quaternary (A-B, C-D): orbits[0]='A-B', orbits[1]='C-D', orbits[2]='(A-B)→(C-D)'
    // =================================================================

    function buildNodes(sys) {
        const [sA, sB, sC, sD] = sys.stars;
        const orbs = sys.orbits || [];
        const h = sys.hierarchy;

        if (h === 'Singleton') {
            return [{ label: 'A', type: 'S', focalStars: [sA], companionOrbit: null }];
        }

        if (h === 'Binary') {
            const abOrb = orbs[0];
            return [
                { label: 'A',   type: 'S', focalStars: [sA],     companionOrbit: abOrb },
                { label: 'B',   type: 'S', focalStars: [sB],     companionOrbit: abOrb },
                { label: 'A-B', type: 'P', focalStars: [sA, sB], pairOrbit: abOrb, companionOrbit: null }
            ];
        }

        if (h === 'Trinary (A, B-C)') {
            const bcOrb    = orbs[0]; // inner pair B-C
            const outerOrb = orbs[1]; // A→(B-C)
            return [
                { label: 'A',   type: 'S', focalStars: [sA],     companionOrbit: outerOrb },
                { label: 'B-C', type: 'P', focalStars: [sB, sC], pairOrbit: bcOrb, companionOrbit: outerOrb }
            ];
        }

        if (h === 'Trinary (A-B, C)') {
            const abOrb    = orbs[0]; // inner pair A-B
            const outerOrb = orbs[1]; // C→(A-B)
            return [
                { label: 'A-B', type: 'P', focalStars: [sA, sB], pairOrbit: abOrb, companionOrbit: outerOrb },
                { label: 'C',   type: 'S', focalStars: [sC],     companionOrbit: outerOrb }
            ];
        }

        if (h === 'Quaternary (A-B, C-D)') {
            const abOrb    = orbs[0];
            const cdOrb    = orbs[1];
            const outerOrb = orbs[2];
            return [
                { label: 'A-B', type: 'P', focalStars: [sA, sB], pairOrbit: abOrb, companionOrbit: outerOrb },
                { label: 'C-D', type: 'P', focalStars: [sC, sD], pairOrbit: cdOrb, companionOrbit: outerOrb }
            ];
        }

        return [];
    }

    // =================================================================
    // STEP 9: PROTOPLANETARY DISK WORKSHEET
    //
    // Outputs per worksheet:
    //   orbits[]  — 17 formation-orbit slots (0–16) with flag:
    //               null             = Available
    //               'Disabled'       = inside disk inner edge (Special Case 1)
    //               'Forbidden'      = within companion's forbidden zone (Special Case 3)
    //               'Outside Slow-Accretion' = beyond R_slow
    //               'Occupied-DI'    = holds a disk-instability planet (Step 10)
    //               'Occupied-CA'    = holds a core-accretion planet  (Step 11)
    //               'Occupied-OC'    = holds an oligarchic planet      (Step 12)
    //
    // Special Case 2 (P-type inner edge) is handled by setting Orbit 0 = pairRmax × 3.5;
    // Special Case 1 then naturally disables any Orbits 1–16 inside that radius.
    // =================================================================

    function buildDiskWorksheet(sys, node) {
        tSection(`AoW Step 9: Disk Worksheet — Node ${node.label} (${node.type}-type)`);

        // Focal mass and luminosity (sum over focal-group stars)
        const focalMass       = node.focalStars.reduce((s, star) => s + (star.initialMass       || 0), 0);
        const focalLum        = node.focalStars.reduce((s, star) => s + (star.luminosity        || 0), 0);
        const focalInitialLum = node.focalStars.reduce((s, star) => s + (star.initialLuminosity || star.luminosity || 0), 0);
        tResult('Focal Mass',            `${focalMass.toFixed(4)} M_sun`,      'AoW Step 9');
        tResult('Focal Luminosity',      `${focalLum.toFixed(6)} L_sun`,       'AoW Step 9');
        tResult('Focal Initial Lum (L0)',`${focalInitialLum.toFixed(6)} L_sun`,'AoW Step 9');

        // Disk Mass Factor — 3d6 on diskMassFactorTable
        const dmRoll = roll3D6();
        const dmRow  = lookupByRoll(diskMassFactorTable.results, dmRoll);
        const massFactor   = dmRow.massFactor;
        const massModifier = dmRow.massModifier;
        tResult('Disk Mass Factor', `roll=${dmRoll} → massFactor=${massFactor}, massModifier=${massModifier}`, 'AoW Step 9');

        // Slow-Accretion Line — R_slow = 20 × cbrt(M), rounded to 3 sig figs (spec p.56)
        // Note: rulebook LaTeX renders as sqrt but worked examples confirm cube root.
        const rSlow = roundToSigFigs(20 * Math.pow(focalMass, 1 / 3), 3);
        tResult('Slow-Accretion Line', `20 × ∛${focalMass.toFixed(4)} = ${rSlow} AU`, 'AoW Step 9');

        // Formation Ice Line — R_ice = 4.0 × √L₀, rounded to 3 sig figs (spec p.56)
        const rIce = roundToSigFigs(4.0 * Math.sqrt(focalInitialLum), 3);
        tResult('Formation Ice Line', `4.0 × √${focalInitialLum.toFixed(6)} = ${rIce} AU`, 'AoW Step 9');

        // Formation Orbit 0 — Disk Inner Edge (R_inner)
        // Special Case 2: P-type → R_inner = pairOrbit.Rmax × 3.5
        //                 S-type → R_inner = 2d6 × 0.005 × cbrt(M)
        // Note: rulebook LaTeX renders S-type formula as sqrt; worked examples confirm cube root.
        let rInner;
        if (node.type === 'P') {
            rInner = node.pairOrbit.Rmax * 3.5;
            tResult('Orbit 0 R_inner (P-type)',
                `pairOrbit.Rmax (${node.pairOrbit.Rmax.toFixed(5)}) × 3.5 = ${rInner.toFixed(5)} AU`,
                'AoW Step 9');
        } else {
            const innerRoll = roll2D6();
            rInner = roundToSigFigs(innerRoll * 0.005 * Math.pow(focalMass, 1 / 3), 3);
            tResult('Orbit 0 R_inner (S-type)',
                `roll=${innerRoll} × 0.005 × ∛${focalMass.toFixed(4)} = ${rInner} AU`,
                'AoW Step 9');
        }

        // Outer Forbidden Zone — companion's gravity: any orbit ≥ companionOrbit.Rmin / 3 is Forbidden
        let forbiddenZoneStart = null;
        if (node.companionOrbit) {
            forbiddenZoneStart = node.companionOrbit.Rmin / 3;
            tResult('Forbidden Zone Start',
                `companionOrbit.Rmin (${node.companionOrbit.Rmin.toFixed(5)}) / 3 = ${forbiddenZoneStart.toFixed(5)} AU`,
                'AoW Step 9');
        } else {
            tResult('Forbidden Zone', 'None (no external companion)', 'AoW Step 9');
        }

        // Build 17-orbit worksheet (Orbits 0–16)
        const orbits = [];

        // Orbit 0 = R_inner
        orbits.push({ orbitNumber: 0, radiusAU: rInner, flag: null, depleted: false });

        // Orbits 1–16 = radiusFactor × sqrt(formation luminosity).
        // WD focal stars use focalInitialLum (ZAMS L₀) so planet formation
        // is modelled as if the star were still on the main sequence.
        const isWDNode = node.focalStars.some(s => s.state === 'White Dwarf');
        const formationLum = isWDNode ? focalInitialLum : focalLum;
        for (const row of formationOrbitTable.results) {
            orbits.push({ orbitNumber: row.orbitNumber, radiusAU: row.radiusFactor * Math.sqrt(formationLum), flag: null, depleted: false });
        }

        // Special Case 1: disable Orbits 1–16 whose radius is below R_inner
        for (const orb of orbits) {
            if (orb.orbitNumber >= 1 && orb.radiusAU < rInner) {
                orb.flag = 'Disabled';
            }
        }

        // Special Case 3: flag orbits inside the companion's forbidden zone (radius ≥ forbiddenZoneStart)
        if (forbiddenZoneStart !== null) {
            for (const orb of orbits) {
                if (orb.flag !== 'Disabled' && orb.radiusAU >= forbiddenZoneStart) {
                    orb.flag = 'Forbidden';
                }
            }
        }

        // Flag orbits beyond the slow-accretion line (radius > R_slow)
        for (const orb of orbits) {
            if (orb.flag === null && orb.radiusAU > rSlow) {
                orb.flag = 'Outside Slow-Accretion';
            }
        }

        // Log completed worksheet
        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[WORKSHEET] Node ${node.label}: rInner=${rInner.toFixed(5)} AU | rSlow=${rSlow.toFixed(4)} AU | forbidden≥${forbiddenZoneStart !== null ? forbiddenZoneStart.toFixed(5) : 'n/a'} AU`);
            for (const orb of orbits) {
                writeLogLine(`  Orbit ${String(orb.orbitNumber).padStart(2)}: ${orb.radiusAU.toFixed(5)} AU  [${orb.flag || 'Available'}]`);
            }
        }

        // euvActive: true if any focal star emits EUV (i.e., at least one non-brown-dwarf).
        // Used in Step 22 EUV correction.  False only when all focal stars are brown dwarfs.
        const euvActive = !node.focalStars.every(s => s.state === 'Brown Dwarf');

        // Companion stars and their T_bb contribution (Step 22 multi-source formula).
        // companionSep is the mean orbital separation (orbit.R) between focal group and companion.
        const companionStars = sys.stars.filter(s => !node.focalStars.includes(s));
        const companionLum   = companionStars.reduce((sum, s) => sum + (s.luminosity || 0), 0);
        const companionSep   = node.companionOrbit ? node.companionOrbit.R : null;
        if (companionStars.length > 0) {
            tResult('Companion Stars (T_bb)',
                `${companionStars.map(s => `${s.label}(L=${(s.luminosity||0).toFixed(5)})`).join(', ')} | companionSep=${companionSep !== null ? companionSep.toFixed(4) + ' AU' : 'n/a'}`,
                'AoW Step 9');
        }

        return {
            label:        node.label,
            type:         node.type,
            focalStars:   node.focalStars,
            focalMass,
            focalLum,
            focalInitialLum,
            companionLum,
            companionSep,
            euvActive,
            massFactor,
            massModifier,
            rInner,
            rSlow,
            rIce,
            forbiddenZoneStart,
            orbits,
            planetesimalMassFactor:    1.0,   // updated by core accretion step
            diskInstabilityPlanets:    [],
            coreAccretionPlanets:      [],
            oligarchicCollisionPlanets:[],
            planets:                   []      // populated by stepOrbitalRadii (Step 13)
        };
    }

    // =================================================================
    // STEP 10: DISK INSTABILITY PLANET PLACEMENT
    //
    // Two pre-checks before any placement rolls:
    //   1. focalMass × massFactor ≥ 0.8  (v1.06 errata threshold)
    //   2. 3d6 + massModifier ≥ 12       (instability trigger roll)
    //
    // If both pass, two independent 3d6 rolls on diskInstabilityPlacementTable:
    //   Roll 1 → firstFormationOrbit
    //   Roll 2 → number of planets
    //
    // Planets are placed outward from firstFormationOrbit.
    // Only Forbidden zones stop placement; slow-accretion and occupied orbits
    // are not checked here (disk is empty; DI inherently forms in cold outer disk).
    // If firstFormationOrbit itself is Forbidden, the entire step is aborted.
    // =================================================================

    function stepDiskInstability(worksheet) {
        tSection(`AoW Step 10: Disk Instability — Node ${worksheet.label}`);

        // Pre-check 1: mass threshold
        const massProduct = worksheet.focalMass * worksheet.massFactor;
        if (massProduct < 0.8) {
            tSkip(`Mass threshold not met: ${worksheet.focalMass.toFixed(4)} × ${worksheet.massFactor} = ${massProduct.toFixed(3)} < 0.8`);
            return;
        }
        tResult('Mass Threshold', `${massProduct.toFixed(3)} ≥ 0.8 — pass`, 'AoW Step 10');

        // Pre-check 2: instability trigger roll
        const triggerRaw   = roll3D6();
        const triggerTotal = triggerRaw + worksheet.massModifier;
        if (triggerTotal < 12) {
            tSkip(`Trigger roll failed: ${triggerRaw} + ${worksheet.massModifier} = ${triggerTotal} < 12`);
            return;
        }
        tResult('Trigger Roll', `${triggerRaw} + ${worksheet.massModifier} = ${triggerTotal} ≥ 12 — disk instability occurs`, 'AoW Step 10');

        // Roll 1: first formation orbit
        const r1    = roll3D6();
        const r1Tot = r1 + worksheet.massModifier;
        const row1  = lookupByRoll(diskInstabilityPlacementTable.results, r1Tot);
        const firstOrbit = row1.firstFormationOrbit;
        tResult('Placement Roll 1 (First Orbit)', `${r1} + ${worksheet.massModifier} = ${r1Tot} → Orbit ${firstOrbit}`, 'AoW Step 10');

        // Roll 2: planet count
        const r2    = roll3D6();
        const r2Tot = r2 + worksheet.massModifier;
        const row2  = lookupByRoll(diskInstabilityPlacementTable.results, r2Tot);
        const planetCount = row2.planets;
        tResult('Placement Roll 2 (Planet Count)', `${r2} + ${worksheet.massModifier} = ${r2Tot} → ${planetCount} planet(s)`, 'AoW Step 10');

        // Abort if firstOrbit is Forbidden or Disabled (inside disk inner edge)
        const firstSlot = worksheet.orbits.find(o => o.orbitNumber === firstOrbit);
        if (!firstSlot || firstSlot.flag === 'Forbidden' || firstSlot.flag === 'Disabled') {
            tSkip(`Orbit ${firstOrbit} is ${firstSlot ? firstSlot.flag : 'out of range'} — disk instability aborted`);
            return;
        }

        // Place planets outward from firstOrbit; stop at Forbidden or Disabled orbits
        let placed = 0;
        for (let n = firstOrbit; placed < planetCount && n <= 16; n++) {
            const slot = worksheet.orbits.find(o => o.orbitNumber === n);
            if (!slot) break;
            if (slot.flag === 'Forbidden' || slot.flag === 'Disabled') {
                tResult(`DI Planet ${placed + 1}`, `Orbit ${n} is ${slot.flag} — stop, discard remaining`, 'AoW Step 10');
                break;
            }
            slot.flag = 'Occupied-DI';
            worksheet.diskInstabilityPlanets.push({ orbitNumber: n, radiusAU: slot.radiusAU, type: 'Disk Instability', formationOrbitType: 'DI' });
            tResult(`DI Planet ${placed + 1}`, `Orbit ${n} @ ${slot.radiusAU.toFixed(5)} AU`, 'AoW Step 10');
            placed++;
        }

        tResult('Disk Instability Complete', `${placed} planet(s) placed`, 'AoW Step 10');
    }

    // =================================================================
    // STEP 11: CORE ACCRETION (with Migration and Grand Tack)
    //
    // Sequence:
    //   1. Roll coreAccretionTable → spacing label + modifier
    //   2. Count clear orbits from Orbit 6 outward (stopping orbit excluded)
    //      Stopping conditions: any flagged orbit (Occupied-DI, Forbidden,
    //      Outside Slow-Accretion, Disabled)
    //   3. totalPlanets = max(0, count + modifier)
    //   4. Roll planetaryMigrationTable → arrivalOrbit + planetesimalMassFactor
    //   5. Roll grandTackTable → outward movement (1–3 orbits)
    //      Ceiling: Orbit 7 (planet lands AT 7, not stopped by it)
    //      Obstacles (Occupied-DI, Forbidden): stop one step BEFORE
    //   6. Place migrated planet at Grand Tack final orbit
    //   7. Place remaining (totalPlanets − 1) planets outward from there;
    //      discard any planet that hits a stopping condition
    // =================================================================

    function stepCoreAccretion(worksheet) {
        tSection(`AoW Step 11: Core Accretion — Node ${worksheet.label}`);

        // Roll coreAccretionTable (3d6, no modifier)
        const caRoll = roll3D6();
        const caRow  = lookupByRoll(coreAccretionTable.results, caRoll);
        const spacing  = caRow.spacing;
        const modifier = caRow.modifier;
        tResult('Core Accretion Roll', `${caRoll} → spacing="${spacing}", modifier=${modifier}`, 'AoW Step 11');

        // Count clear orbits from Orbit 6 outward (any flag = stopping condition, exclusive)
        let count = 0;
        for (let n = 6; n <= 16; n++) {
            const slot = worksheet.orbits.find(o => o.orbitNumber === n);
            if (!slot || slot.flag !== null) break;
            count++;
        }
        tResult('Available Orbits (from 6 out)', `${count}`, 'AoW Step 11');

        const totalPlanets = Math.max(0, count + modifier);
        tResult('Total CA Planets', `max(0, ${count} + ${modifier}) = ${totalPlanets}`, 'AoW Step 11');

        if (totalPlanets === 0) {
            tSkip('No core accretion planets (total = 0)');
            return;
        }

        // Migration: 3d6 + massModifier on planetaryMigrationTable
        const migRaw   = roll3D6();
        const migTotal = migRaw + worksheet.massModifier;
        const migRow   = lookupByRoll(planetaryMigrationTable.results, migTotal);
        const arrivalOrbit         = migRow.arrivalOrbit;
        const planetesimalMassFactor = migRow.planetesimalMassFactor;
        tResult('Migration Roll', `${migRaw} + ${worksheet.massModifier} = ${migTotal} → arrivalOrbit=${arrivalOrbit}, massFactor=${planetesimalMassFactor}`, 'AoW Step 11');
        worksheet.planetesimalMassFactor = planetesimalMassFactor;

        // Validate arrival orbit
        const arrSlot = worksheet.orbits.find(o => o.orbitNumber === arrivalOrbit);
        if (!arrSlot || arrSlot.flag === 'Forbidden' || arrSlot.flag === 'Disabled') {
            tResult('Migration', `WARN: arrivalOrbit ${arrivalOrbit} is blocked [${arrSlot ? arrSlot.flag : 'not found'}] — core accretion aborted`, 'AoW Step 11');
            return;
        }

        // Flag depleted orbits: the inward migration sweep covers [arrivalOrbit, 5] inclusive.
        // These represent material cleared as the planet migrated inward; Grand Tack outward does NOT undo this.
        if (arrivalOrbit <= 5) {
            for (let n = arrivalOrbit; n <= 5; n++) {
                const slot = worksheet.orbits.find(o => o.orbitNumber === n);
                if (slot) slot.depleted = true;
            }
            tResult('Depleted Orbits', `Orbits ${arrivalOrbit}–5 flagged (inward migration sweep)`, 'AoW Step 11');
        }

        // Grand Tack: 3d6 on grandTackTable (no modifier)
        const gtRaw = roll3D6();
        const gtRow = lookupByRoll(grandTackTable.results, gtRaw);
        const gtMovement = gtRow.movement;
        tResult('Grand Tack Roll', `${gtRaw} → movement=${gtMovement} orbit(s) outward`, 'AoW Step 11');

        // Resolve Grand Tack position
        //   Ceiling: planet lands AT Orbit 7 (not stopped BY it)
        //   Obstacles (Occupied-DI, Forbidden, Disabled): stop one step BEFORE
        let gtOrbit = arrivalOrbit;
        for (let step = 0; step < gtMovement; step++) {
            const next = gtOrbit + 1;
            if (next > 7) {
                gtOrbit = 7;
                break;
            }
            const nextSlot = worksheet.orbits.find(o => o.orbitNumber === next);
            if (!nextSlot || nextSlot.flag === 'Occupied-DI' || nextSlot.flag === 'Forbidden' || nextSlot.flag === 'Disabled') {
                break; // stop BEFORE obstacle; gtOrbit unchanged
            }
            gtOrbit = next;
            if (gtOrbit === 7) break; // landed at ceiling
        }
        tResult('Grand Tack Final Orbit', `Orbit ${gtOrbit}`, 'AoW Step 11');

        // Place migrated planet at Grand Tack orbit
        const gtSlot = worksheet.orbits.find(o => o.orbitNumber === gtOrbit);
        if (gtSlot) gtSlot.flag = 'Occupied-CA';
        worksheet.coreAccretionPlanets.push({
            orbitNumber: gtOrbit,
            radiusAU:    gtSlot ? gtSlot.radiusAU : null,
            type:        'Core Accretion (Migrated)',
            formationOrbitType: 'CA',
            arrivalOrbit,
            grandTackMovement: gtMovement
        });
        tResult('CA Planet 1 (Migrated)', `Orbit ${gtOrbit} @ ${gtSlot ? gtSlot.radiusAU.toFixed(5) : '?'} AU`, 'AoW Step 11');

        // Place remaining (totalPlanets − 1) planets outward from gtOrbit+1
        let placed = 1;
        for (let n = gtOrbit + 1; placed < totalPlanets && n <= 16; n++) {
            const slot = worksheet.orbits.find(o => o.orbitNumber === n);
            if (!slot || slot.flag !== null) {
                tResult(`CA Planet ${placed + 1}`, `Orbit ${n} [${slot ? slot.flag : 'not found'}] — stop, discard remaining`, 'AoW Step 11');
                break;
            }
            slot.flag = 'Occupied-CA';
            worksheet.coreAccretionPlanets.push({ orbitNumber: n, radiusAU: slot.radiusAU, type: 'Core Accretion', formationOrbitType: 'CA' });
            tResult(`CA Planet ${placed + 1}`, `Orbit ${n} @ ${slot.radiusAU.toFixed(5)} AU`, 'AoW Step 11');
            placed++;
        }

        tResult('Core Accretion Complete', `${placed} planet(s) placed`, 'AoW Step 11');
    }

    // =================================================================
    // STEP 12: OLIGARCHIC COLLISION (rocky inner-system planets)
    //
    // Pre-check: skip entirely if Orbit 0 OR Orbit 1 is occupied or Forbidden.
    //   (Only core-accretion planets can block these; DI planets form at Orbit 7+.)
    //
    // Sequence:
    //   1. Roll oligarchicCollisionTable → spacing label + modifier
    //   2. Determine startOrbit: 0 for Tight/Very Tight, 1 otherwise
    //   3. Count clear orbits from startOrbit up to (but not including) Orbit 6
    //      Stopping conditions: any flagged orbit or reaching Orbit 6
    //   4. totalPlanets = max(0, count + modifier)
    //   5. Place planets sequentially from startOrbit outward;
    //      discard any planet that hits a stopping condition or Orbit 6
    // =================================================================

    function stepOligarchicCollision(worksheet) {
        tSection(`AoW Step 12: Oligarchic Collision — Node ${worksheet.label}`);

        // Pre-check: Orbit 0 and Orbit 1 must be available
        const slot0 = worksheet.orbits.find(o => o.orbitNumber === 0);
        const slot1 = worksheet.orbits.find(o => o.orbitNumber === 1);
        const blocked0 = !slot0 || slot0.flag !== null;
        const blocked1 = !slot1 || slot1.flag !== null;

        if (blocked0 || blocked1) {
            tSkip(`Pre-check failed — Orbit 0: [${slot0 ? (slot0.flag || 'OK') : 'missing'}], Orbit 1: [${slot1 ? (slot1.flag || 'OK') : 'missing'}]`);
            return;
        }

        // Roll oligarchicCollisionTable (3d6, no modifier)
        const ocRoll = roll3D6();
        const ocRow  = lookupByRoll(oligarchicCollisionTable.results, ocRoll);
        const spacing  = ocRow.spacing;
        const modifier = ocRow.modifier;
        tResult('Oligarchic Roll', `${ocRoll} → spacing="${spacing}", modifier=${modifier}`, 'AoW Step 12');

        // Starting orbit: Tight/Very Tight starts at 0, otherwise at 1
        const startOrbit = (spacing === 'Tight' || spacing === 'Very Tight') ? 0 : 1;
        tResult('Start Orbit', `${startOrbit} (${spacing})`, 'AoW Step 12');

        // Count clear orbits from startOrbit up to Orbit 5 inclusive (Orbit 6 = exclusive stop)
        let count = 0;
        for (let n = startOrbit; n < 6; n++) {
            const slot = worksheet.orbits.find(o => o.orbitNumber === n);
            if (!slot || slot.flag !== null) break;
            count++;
        }
        tResult('Available Orbits (from ' + startOrbit + ' inward)', `${count}`, 'AoW Step 12');

        const totalPlanets = Math.max(0, count + modifier);
        tResult('Total OC Planets', `max(0, ${count} + ${modifier}) = ${totalPlanets}`, 'AoW Step 12');

        if (totalPlanets === 0) {
            tSkip('No oligarchic planets (total = 0)');
            return;
        }

        // Place planets sequentially from startOrbit outward
        let placed = 0;
        for (let n = startOrbit; placed < totalPlanets && n <= 16; n++) {
            const slot = worksheet.orbits.find(o => o.orbitNumber === n);
            if (!slot || slot.flag !== null || n >= 6) {
                tResult(`OC Planet ${placed + 1}`, `Orbit ${n} [${slot ? (slot.flag || 'n≥6') : 'not found'}] — stop, discard remaining`, 'AoW Step 12');
                break;
            }
            slot.flag = 'Occupied-OC';
            worksheet.oligarchicCollisionPlanets.push({ orbitNumber: n, radiusAU: slot.radiusAU, type: 'Oligarchic Collision', formationOrbitType: 'OC' });
            tResult(`OC Planet ${placed + 1}`, `Orbit ${n} @ ${slot.radiusAU.toFixed(5)} AU`, 'AoW Step 12');
            placed++;
        }

        tResult('Oligarchic Collision Complete', `${placed} planet(s) placed`, 'AoW Step 12');
    }

    // =================================================================
    // SHARED HELPER: _applyOrbitalRatios
    //
    // Places planets[1..N-1] by rolling 3d6 per pair against orbitalRatioTable,
    // snapping to resonances and propagating Laplace chains.
    // planets[0].orbitalRadius must already be set to R_inner.
    // R_outer_est calibrates the expected ratio S; it is a target, not a hard constraint.
    // Called from stepOrbitalRadii (Step 13) and stepWhiteDwarfMigration.
    // =================================================================

    function _applyOrbitalRatios(planets, R_inner, R_outer_est, stepLabel) {
        const K = planets.length - 2;
        const S = Math.round(Math.pow(R_outer_est / R_inner, 1 / (K + 1)) * 1000) / 1000;
        tResult('Expected Ratio S', `(${R_outer_est.toFixed(5)} / ${R_inner.toFixed(5)})^(1/${K+1}) = ${S.toFixed(3)}`, stepLabel);

        let R_current = R_inner;
        let forcedLaplace = false;

        for (let i = 1; i < planets.length; i++) {
            const planet = planets[i];
            const isLastPair = (i === planets.length - 1);
            let ratio;
            let resonanceTag = null;

            if (forcedLaplace) {
                ratio = 1.587;
                resonanceTag = '2:1 (Laplace forced)';
                forcedLaplace = false;
                tResult(`Pair ${i}`, `Forced 1.587 (Laplace propagation)`, stepLabel);
            } else {
                const roll = roll3D6();
                const ratioRow = lookupByRoll(orbitalRatioTable.results, roll);
                const ratioMultiplier = ratioRow ? ratioRow.ratioMultiplier : 1.0;
                const ratioEst = Math.max(1.0, S * ratioMultiplier);

                const snapRow = resonantOrbitSpacingTable.results.find(
                    row => ratioEst >= row.minRatio && ratioEst <= row.maxRatio
                );

                if (snapRow) {
                    if (snapRow.isLaplace) {
                        if (isLastPair) {
                            ratio = 1.600;
                            resonanceTag = '2:1 (1.600 — last pair)';
                            tResult(`Pair ${i}`, `3d6=${roll} → mult=${ratioMultiplier}, est=${ratioEst.toFixed(4)} → 2:1 snap (last pair → 1.600)`, stepLabel);
                        } else {
                            ratio = 1.587;
                            resonanceTag = '2:1';
                            forcedLaplace = true;
                            tResult(`Pair ${i}`, `3d6=${roll} → mult=${ratioMultiplier}, est=${ratioEst.toFixed(4)} → 2:1 snap (1.587, next pair forced)`, stepLabel);
                        }
                    } else {
                        ratio = snapRow.actualRatio;
                        resonanceTag = snapRow.resonance;
                        tResult(`Pair ${i}`, `3d6=${roll} → mult=${ratioMultiplier}, est=${ratioEst.toFixed(4)} → snap ${resonanceTag} (${ratio})`, stepLabel);
                    }
                } else {
                    ratio = ratioEst;
                    tResult(`Pair ${i}`, `3d6=${roll} → mult=${ratioMultiplier}, est=${ratioEst.toFixed(4)} → no snap, ratio=${ratio.toFixed(4)}`, stepLabel);
                }
            }

            R_current = R_current * ratio;
            planet.orbitalRadius = R_current;
            planet.resonance = resonanceTag;
            tResult(`Planet ${i+1} Orbital Radius`, `${R_current.toFixed(5)} AU (×${ratio.toFixed(4)}${resonanceTag ? ' [' + resonanceTag + ']' : ''})`, stepLabel);
        }
    }

    // =================================================================
    // STEP 13: ORBITAL RADII
    //
    // Assigns actual AU distances to every surviving planet in a worksheet.
    // Combines DI / CA / OC planets into worksheet.planets[] (sorted innermost→outermost).
    //
    // Innermost: R = formationOrbit.radius × (0.72 + 2d6/25), clamped ≥ rInner.
    // Outermost estimate R_outer_est calibrates the expected ratio S.
    //   OC outermost: R_max = min(R_ice, forbiddenZoneStart) × (0.72 + 2d6/50)
    //   DI/CA outermost: formationOrbit.radius × (0.72 + 2d6/25)
    // S = (R_outer_est / R_inner)^(1/(K+1)) where K = planets-2
    // Each pair gets a 3d6 roll → ratioMultiplier from orbitalRatioTable.
    // Ratio snapped to resonantOrbitSpacingTable; 2:1 triggers Laplace Stack propagation.
    // =================================================================

    function stepOrbitalRadii(worksheet) {
        tSection(`AoW Step 13: Orbital Radii — Node ${worksheet.label}`);

        // Build combined planet list (same object references — no copies)
        const planets = [
            ...worksheet.diskInstabilityPlanets,
            ...worksheet.coreAccretionPlanets,
            ...worksheet.oligarchicCollisionPlanets
        ].sort((a, b) => a.orbitNumber - b.orbitNumber);

        worksheet.planets = planets;

        if (planets.length === 0) {
            tSkip('No surviving planets — Step 13 skipped');
            return;
        }

        // ── 13.1: Innermost orbital radius ──────────────────────────────

        const innermost = planets[0];
        let R_inner;

        if (innermost.orbitNumber === 0) {
            R_inner = worksheet.rInner;
            tResult('Innermost (Orbit 0)', `${R_inner.toFixed(5)} AU (= rInner, no roll)`, 'AoW Step 13');
        } else {
            const r2d6 = roll2D6();
            R_inner = innermost.radiusAU * (0.72 + r2d6 / 25);
            R_inner = Math.max(R_inner, worksheet.rInner);
            if (worksheet.forbiddenZoneStart !== null && R_inner >= worksheet.forbiddenZoneStart) {
                R_inner = worksheet.forbiddenZoneStart - 0.001;
            }
            tResult('Innermost Radius', `2d6=${r2d6} → ${innermost.radiusAU.toFixed(5)} × ${(0.72 + r2d6/25).toFixed(3)} = ${R_inner.toFixed(5)} AU`, 'AoW Step 13');
        }
        innermost.orbitalRadius = R_inner;
        innermost.resonance = null;

        if (planets.length === 1) {
            tResult('Step 13 Complete', '1 planet placed', 'AoW Step 13');
            return;
        }

        // ── 13.2: Outermost estimate (calibrates S) ─────────────────────

        const outermost = planets[planets.length - 1];
        let R_outer_est;

        if (outermost.formationOrbitType === 'OC') {
            const R_ice = worksheet.rIce;
            const fzStart = worksheet.forbiddenZoneStart !== null ? worksheet.forbiddenZoneStart : Infinity;
            const R_max = Math.min(R_ice, fzStart);
            const r2d6 = roll2D6();
            R_outer_est = R_max * (0.72 + r2d6 / 50);
            tResult('Outermost Estimate (OC)', `R_ice=${R_ice.toFixed(4)}, R_max=${R_max.toFixed(4)}, 2d6=${r2d6} → ${R_outer_est.toFixed(5)} AU`, 'AoW Step 13');
        } else {
            const r2d6 = roll2D6();
            R_outer_est = outermost.radiusAU * (0.72 + r2d6 / 25);
            if (worksheet.forbiddenZoneStart !== null && R_outer_est >= worksheet.forbiddenZoneStart) {
                R_outer_est = worksheet.forbiddenZoneStart - 0.001;
            }
            tResult('Outermost Estimate (DI/CA)', `2d6=${r2d6} → ${outermost.radiusAU.toFixed(5)} × ${(0.72 + r2d6/25).toFixed(3)} = ${R_outer_est.toFixed(5)} AU`, 'AoW Step 13');
        }

        // ── 13.3: Ratio iteration for all planets after the innermost ───
        _applyOrbitalRatios(planets, R_inner, R_outer_est, 'AoW Step 13');

        tResult('Step 13 Complete', `${planets.length} planet(s) placed`, 'AoW Step 13');
    }

    // =================================================================
    // STEP 14: PLANETARY MASS
    //
    // Planetesimal Mass:  P = massFactor × focalMass × sys.systemMetallicity  (Earth masses)
    //
    // DI planets:    M_P = 3d6 × ((100 × M × D) − 38), clamped [5, 5000] Em  (±10%)
    // CA planets:    M_C = (3d6 + K) × P; K=20/10/4 by sequence.
    //                If M_C < 5 → Failed Core (mass = M_C, no gas)
    //                Else → Gas Giant: M_total = M_C × accretionFactor  (±10%, clamped [5, 5000])
    // OC planets:    Auto-Leftover check for innermost if multiple OC planets.
    //                Base mass = 3d6 × P × 0.15, × planetesimalMassFactor if CA exists,
    //                × 0.1 if orbit is Depleted, ± 10%.
    //                If mass > 0.18 → Terrestrial; else adjacency → Belt or Leftover Oligarch.
    // =================================================================

    function stepPlanetaryMass(worksheet, sys) {
        tSection(`AoW Step 14: Planetary Mass — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 14 skipped');
            return;
        }

        // Planetesimal Mass P
        const P = worksheet.massFactor * worksheet.focalMass * sys.systemMetallicity;
        tResult('Planetesimal Mass P', `${worksheet.massFactor} × ${worksheet.focalMass.toFixed(4)} × ${sys.systemMetallicity} = ${P.toFixed(5)} Em`, 'AoW Step 14');
        worksheet.planetesimalMass = P;

        // ── DI Planets ──────────────────────────────────────────────────
        // Spec: M≤0.5 → M_P = 3d6×M×D;  M>0.5 → M_P = 3d6×((100×M×D)−38)
        // Clamped [5, 5000] Em, varied ±10%.
        for (const planet of worksheet.diskInstabilityPlanets) {
            const roll = roll3D6();
            const M = worksheet.focalMass;
            const D = worksheet.massFactor;
            let base, formula;
            if (M <= 0.5) {
                base = M * D;
                formula = 'M×D';
            } else {
                base = (100 * M * D) - 38;
                formula = '(100×M×D)−38';
            }
            let mass = roll * base * (0.90 + rng() * 0.20);
            mass = Math.max(5, Math.min(5000, mass));
            planet.mass = mass;
            planet.planetType = 'Gas Giant (DI)';
            tResult(`DI Orbit ${planet.orbitNumber}`, `3d6=${roll}, base=${base.toFixed(3)} [${formula}], mass=${mass.toFixed(1)} Em [Gas Giant]`, 'AoW Step 14');
        }

        // ── CA Planets ──────────────────────────────────────────────────
        const caPlanets = [...worksheet.coreAccretionPlanets].sort((a, b) => a.orbitNumber - b.orbitNumber);
        for (let seqIdx = 0; seqIdx < caPlanets.length; seqIdx++) {
            const planet = caPlanets[seqIdx];
            const K = seqIdx === 0 ? 20 : seqIdx === 1 ? 10 : 4;
            const coreRoll = roll3D6();
            const M_C = (coreRoll + K) * P;
            tResult(`CA Orbit ${planet.orbitNumber} (seq ${seqIdx+1})`, `3d6=${coreRoll}, K=${K}, M_C=(${coreRoll}+${K})×${P.toFixed(4)}=${M_C.toFixed(2)} Em`, 'AoW Step 14');

            if (M_C < 5) {
                const mass = Math.min(5, M_C * (0.90 + rng() * 0.20));
                planet.mass = mass;
                planet.planetType = 'Failed Core';
                tResult(`CA Orbit ${planet.orbitNumber}`, `Failed Core (M_C=${M_C.toFixed(2)}, mass=${mass.toFixed(2)} Em, cap 5)`, 'AoW Step 14');
            } else {
                const colKey = seqIdx === 0 ? 'innermostFactor' : seqIdx === 1 ? 'nextInnermostFactor' : 'subsequentFactor';
                const massRoll = roll3D6();
                const massRow = lookupByRoll(coreAccretionMassTable.results, massRoll);
                const af = massRow ? massRow[colKey] : 1;
                let mass = M_C * af * (0.90 + rng() * 0.20);
                mass = Math.max(5, Math.min(5000, mass));
                planet.mass = mass;
                planet.planetType = 'Gas Giant (CA)';
                tResult(`CA Orbit ${planet.orbitNumber}`, `Gas Giant: 3d6=${massRoll}, col=${colKey}, AF=${af}, mass=${mass.toFixed(1)} Em`, 'AoW Step 14');
            }
        }

        // ── OC Planets ──────────────────────────────────────────────────
        const ocPlanets = [...worksheet.oligarchicCollisionPlanets].sort((a, b) => a.orbitNumber - b.orbitNumber);
        const hasCA = worksheet.coreAccretionPlanets.length > 0;
        const pmf = worksheet.planetesimalMassFactor || 1.0;
        const multipleOC = ocPlanets.length > 1;

        for (let ocIdx = 0; ocIdx < ocPlanets.length; ocIdx++) {
            const planet = ocPlanets[ocIdx];

            // Auto-Leftover check: only for innermost OC planet, only if multiple OC planets (Q13)
            if (ocIdx === 0 && multipleOC) {
                const autoRoll = roll3D6();
                if (autoRoll >= 12) {
                    const lRoll = roll3D6();
                    planet.mass = lRoll * 0.01;
                    planet.planetType = 'Leftover Oligarch';
                    tResult(`OC Orbit ${planet.orbitNumber}`, `Auto-Leftover (3d6=${autoRoll} ≥ 12): 3d6=${lRoll} → mass=${planet.mass.toFixed(4)} Em`, 'AoW Step 14');
                    continue;
                }
                tResult(`OC Orbit ${planet.orbitNumber}`, `Auto-Leftover check: 3d6=${autoRoll} < 12 — normal mass roll`, 'AoW Step 14');
            }

            // Base mass computation — spec: M = (3d6 / 5) × P = 3d6 × 0.20 × P
            const baseRoll = roll3D6();
            let mass = baseRoll * P * 0.20;
            if (hasCA) mass *= pmf;

            const orbitSlot = worksheet.orbits.find(o => o.orbitNumber === planet.orbitNumber);
            if (orbitSlot && orbitSlot.depleted) mass *= 0.1;

            mass *= (0.90 + rng() * 0.20);

            tResult(`OC Orbit ${planet.orbitNumber} raw`, `3d6=${baseRoll}, P=${P.toFixed(4)}, hasCA=${hasCA}(pmf=${pmf}), depleted=${!!(orbitSlot && orbitSlot.depleted)}, mass=${mass.toFixed(5)} Em`, 'AoW Step 14');

            if (mass > 0.18) {
                planet.mass = mass;
                planet.planetType = 'Terrestrial';
                tResult(`OC Orbit ${planet.orbitNumber}`, `Terrestrial (${mass.toFixed(4)} Em)`, 'AoW Step 14');
            } else {
                // Adjacency check: next/previous in planet sequence is a gas giant, or next orbit is Forbidden
                const adjGasOrForbidden = isAdjacentToGasOrForbidden(planet, worksheet);
                if (adjGasOrForbidden) {
                    planet.mass = null;
                    planet.planetType = 'Planetoid Belt';
                    tResult(`OC Orbit ${planet.orbitNumber}`, `Planetoid Belt (adjacent to gas giant or forbidden zone)`, 'AoW Step 14');
                } else {
                    const lRoll = roll3D6();
                    planet.mass = lRoll * 0.01;
                    planet.planetType = 'Leftover Oligarch';
                    tResult(`OC Orbit ${planet.orbitNumber}`, `Leftover Oligarch: 3d6=${lRoll} → mass=${planet.mass.toFixed(4)} Em`, 'AoW Step 14');
                }
            }
        }

        tResult('Step 14 Complete', `${worksheet.planets.length} planet(s) assigned`, 'AoW Step 14');
    }

    // Checks whether an OC planet is adjacent (in sorted planet sequence) to a gas giant,
    // or whether its next-outward formation orbit is Forbidden.
    function isAdjacentToGasOrForbidden(planet, worksheet) {
        const GAS_TYPES = new Set(['Gas Giant (DI)', 'Gas Giant (CA)']);
        const sorted = worksheet.planets; // already sorted by orbitNumber from stepOrbitalRadii
        const myIdx = sorted.indexOf(planet);

        if (myIdx > 0 && GAS_TYPES.has(sorted[myIdx - 1].planetType)) return true;
        if (myIdx >= 0 && myIdx < sorted.length - 1 && GAS_TYPES.has(sorted[myIdx + 1].planetType)) return true;

        const nextOrbit = worksheet.orbits.find(o => o.orbitNumber === planet.orbitNumber + 1);
        if (nextOrbit && nextOrbit.flag === 'Forbidden') return true;

        return false;
    }

    // =================================================================
    // STEP 15: ORBITAL ECCENTRICITY
    //
    // Counts non-Belt planets → looks up typicalEccentricity from systemEccentricityTable.
    // Each non-Belt planet rolls 2d6; E = typicalE + (roll - 7) × 0.01, clamped ≥ 0.
    // Belt planets get E = 0.
    // Rmin = R × (1 - E); Rmax = R × (1 + E).
    //
    // Enforcement (per Q11, Q12):
    //   1. Outermost planet: if Rmax ≥ forbiddenZoneStart, reduce E.
    //   2. All adjacent pairs except (second-to-last, outermost):
    //      inner.Rmax > outer.Rmin → reduce outer.E to clear;
    //      if outer.E hits 0 and still violating → reduce inner.E.
    //   The outermost pair is exempt (outermost orbit may be inclined).
    // =================================================================

    function stepOrbitalEccentricity(worksheet) {
        tSection(`AoW Step 15: Orbital Eccentricity — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 15 skipped');
            return;
        }

        // Count non-Belt planets for table lookup
        const nonBelt = worksheet.planets.filter(p => p.planetType !== 'Planetoid Belt');
        const planetCount = nonBelt.length;
        tResult('Non-Belt Planet Count', planetCount, 'AoW Step 15');

        const eccRow = systemEccentricityTable.results.find(
            r => planetCount >= r.minPlanets && planetCount <= r.maxPlanets
        );
        const typicalE = eccRow ? eccRow.typicalEccentricity : 0.23;
        tResult('Typical Eccentricity', typicalE, 'AoW Step 15');

        // Assign eccentricities
        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') {
                planet.eccentricity = 0;
                planet.Rmin = planet.orbitalRadius;
                planet.Rmax = planet.orbitalRadius;
                tResult(`Orbit ${planet.orbitNumber} (Belt)`, 'E=0', 'AoW Step 15');
            } else {
                const r2d6 = roll2D6();
                const E = Math.max(0, typicalE + (r2d6 - 7) * 0.01);
                planet.eccentricity = E;
                planet.Rmin = planet.orbitalRadius * (1 - E);
                planet.Rmax = planet.orbitalRadius * (1 + E);
                tResult(`Orbit ${planet.orbitNumber}`, `2d6=${r2d6}, E=${E.toFixed(3)}, Rmin=${planet.Rmin.toFixed(5)}, Rmax=${planet.Rmax.toFixed(5)} AU`, 'AoW Step 15');
            }
        }

        // Sort by orbital radius for stability enforcement
        const sorted = [...worksheet.planets].sort((a, b) => (a.orbitalRadius || 0) - (b.orbitalRadius || 0));

        // Outermost forbidden-zone constraint (Q12)
        const outermost = sorted[sorted.length - 1];
        if (outermost && outermost.planetType !== 'Planetoid Belt' &&
            worksheet.forbiddenZoneStart !== null && outermost.Rmax >= worksheet.forbiddenZoneStart) {
            const E_new = Math.max(0, (worksheet.forbiddenZoneStart / outermost.orbitalRadius) - 1 - 0.0001);
            tResult('Stability: FZ clamp (outermost)', `E ${outermost.eccentricity.toFixed(3)} → ${E_new.toFixed(3)} (Rmax must be < ${worksheet.forbiddenZoneStart.toFixed(5)})`, 'AoW Step 15');
            outermost.eccentricity = E_new;
            outermost.Rmin = outermost.orbitalRadius * (1 - E_new);
            outermost.Rmax = outermost.orbitalRadius * (1 + E_new);
        }

        // Pairwise stability — skip the last pair (second-to-last, outermost) per spec exception
        const MAX_ITER = 20;
        for (let iter = 0; iter < MAX_ITER; iter++) {
            let anyViolation = false;
            for (let i = 0; i < sorted.length - 2; i++) { // -2: skip last pair
                const inner = sorted[i];
                const outer = sorted[i + 1];
                if (inner.planetType === 'Planetoid Belt' || outer.planetType === 'Planetoid Belt') continue;
                if (!inner.Rmax || !outer.Rmin) continue;

                if (inner.Rmax > outer.Rmin) {
                    // Reduce outer.E first
                    const E_out_new = Math.max(0, 1 - inner.Rmax / outer.orbitalRadius);
                    if (E_out_new < outer.eccentricity) {
                        tResult(`Stability pair (${inner.orbitNumber},${outer.orbitNumber})`, `Outer E ${outer.eccentricity.toFixed(3)} → ${E_out_new.toFixed(3)}`, 'AoW Step 15');
                        outer.eccentricity = E_out_new;
                        outer.Rmin = outer.orbitalRadius * (1 - E_out_new);
                        outer.Rmax = outer.orbitalRadius * (1 + E_out_new);
                        anyViolation = true;
                    }
                    // If still violating (outer.E is 0), reduce inner.E
                    if (inner.Rmax > outer.Rmin) {
                        const E_in_new = Math.max(0, outer.Rmin / inner.orbitalRadius - 1);
                        if (E_in_new < inner.eccentricity) {
                            tResult(`Stability pair (${inner.orbitNumber},${outer.orbitNumber})`, `Inner E ${inner.eccentricity.toFixed(3)} → ${E_in_new.toFixed(3)}`, 'AoW Step 15');
                            inner.eccentricity = E_in_new;
                            inner.Rmin = inner.orbitalRadius * (1 - E_in_new);
                            inner.Rmax = inner.orbitalRadius * (1 + E_in_new);
                            anyViolation = true;
                        }
                    }
                }
            }
            if (!anyViolation) break;
            if (iter === MAX_ITER - 1 && typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[WARN] Step 15: stability enforcement did not converge for node ${worksheet.label}`);
            }
        }

        tResult('Step 15 Complete', 'Eccentricities assigned and stability enforced', 'AoW Step 15');
    }

    // =================================================================
    // STEP 15 (POST-MS): PLANET ABSORPTION BY EXPANDING STAR
    //
    // Only runs when a focal star is Subgiant, Red Giant Branch, or Horizontal
    // Branch. Any planet whose Rmin (Step 15) < the largest expanded focal
    // star's radius has been physically engulfed. Such planets are marked
    // absorbedByStar = true and vaporized = true (all subsequent steps skip them).
    // Satellites of absorbed planets are marked identically.
    // Step 22 must still be consulted for survivors (rock-vaporization threshold).
    // =================================================================

    function stepPostMSAbsorption(worksheet) {
        const POST_MS = new Set(['Subgiant', 'Red Giant Branch', 'Horizontal Branch']);
        const expandedStars = worksheet.focalStars.filter(s => POST_MS.has(s.state));
        if (expandedStars.length === 0) return;

        tSection(`AoW Step 15 (Post-MS Absorption) — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — absorption check skipped');
            return;
        }

        // Use the most expanded (largest radius) post-MS focal star
        const bigStar = expandedStars.reduce((a, b) => (a.radius || 0) >= (b.radius || 0) ? a : b);
        tResult('Expanded Primary',
            `${bigStar.label} | ${bigStar.state} | R=${bigStar.radius.toFixed(4)} AU`,
            'AoW Step 15 Post-MS');

        let absorbed = 0;
        for (const planet of worksheet.planets) {
            const rMin = planet.Rmin !== undefined ? planet.Rmin : planet.orbitalRadius;
            if (rMin < bigStar.radius) {
                planet.absorbedByStar = true;
                planet.vaporized      = true;
                if (planet.satellites) {
                    planet.satellites.forEach(s => { s.absorbedByStar = true; s.vaporized = true; });
                }
                absorbed++;
                tResult(`Orbit ${planet.orbitNumber} ABSORBED`,
                    `Rmin=${rMin.toFixed(5)} AU < star R=${bigStar.radius.toFixed(4)} AU — engulfed by expanding primary`,
                    'AoW Step 15 Post-MS');
            } else {
                tResult(`Orbit ${planet.orbitNumber}`,
                    `Rmin=${rMin.toFixed(5)} AU ≥ R=${bigStar.radius.toFixed(4)} AU — survives`,
                    'AoW Step 15 Post-MS');
            }
        }

        tResult('Post-MS Absorption Complete',
            `${absorbed} planet(s) engulfed; check Step 22 for rock-vaporization in surviving orbits`,
            'AoW Step 15 Post-MS');
    }

    // =================================================================
    // WHITE DWARF / STELLAR REMNANT: PLANET SURVIVAL & MIGRATION
    //
    // Runs between Step 14 and Step 15 for worksheets with a White Dwarf focal star.
    // The AoW rule requires designing the system as if the star were still on the
    // main sequence (Steps 9–14), then applying post-red-giant elimination and
    // inward migration before continuing with Steps 15+.
    //
    // Phase 1 — Elimination:
    //   • Any planet with orbitalRadius < 1.0 AU → wdEliminated=true, vaporized=true
    //   • Any Planetoid Belt → same flags (destroyed during red-giant phase)
    //
    // Phase 2 — Migration of survivors (innermost→outermost→middle):
    //   N=0: nothing to migrate
    //   N=1: lesser of two d% results × original radius; floor = (1d6+1)×0.01 AU
    //   N≥2: innermost uses lesser-of-two d%; outermost uses greater-of-two d%
    //        (or innermost multiplier if larger); middle planets via Step 13 ratios.
    // =================================================================

    function stepWhiteDwarfMigration(worksheet) {
        if (!worksheet.focalStars.some(s => s.state === 'White Dwarf')) return;

        tSection(`AoW WD Migration: Planet Survival — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — WD migration skipped');
            return;
        }

        // ── Phase 1: Elimination ─────────────────────────────────────────
        let eliminated = 0;
        for (const planet of worksheet.planets) {
            const engulfed = planet.orbitalRadius < 1.0;
            const isBelt   = planet.planetType === 'Planetoid Belt';
            if (engulfed || isBelt) {
                planet.wdEliminated = true;
                planet.vaporized    = true;
                if (planet.satellites) {
                    planet.satellites.forEach(s => { s.wdEliminated = true; s.vaporized = true; });
                }
                eliminated++;
                const reason = engulfed
                    ? `orbitalRadius ${planet.orbitalRadius.toFixed(4)} AU < 1.0 AU`
                    : 'Planetoid Belt';
                tResult(`Orbit ${planet.orbitNumber} ELIMINATED`,
                    `${reason} — destroyed during red-giant phase`,
                    'AoW WD Migration');
            }
        }
        tResult('Elimination', `${eliminated} planet(s) eliminated`, 'AoW WD Migration');

        // ── Phase 2: Survivors ───────────────────────────────────────────
        const survivors = worksheet.planets.filter(p => !p.wdEliminated);
        const N = survivors.length;
        tResult('Surviving Planets', N, 'AoW WD Migration');

        if (N === 0) {
            tResult('WD Migration', 'No surviving planets — migration skipped', 'AoW WD Migration');
            return;
        }

        const innermost = survivors[0];
        const outermost = survivors[N - 1];

        // ── Innermost: lesser of two d% rolls ────────────────────────────
        const i_r1 = rollD100() / 100;
        const i_r2 = rollD100() / 100;
        const lesserMult = Math.min(i_r1, i_r2);
        const rawInnerR  = innermost.orbitalRadius * lesserMult;
        const floorR     = (rollD6() + 1) * 0.01;
        const newInnerR  = Math.max(rawInnerR, floorR);
        tResult('Innermost Migration',
            `d%=[${Math.round(i_r1*100)},${Math.round(i_r2*100)}] → mult=${lesserMult.toFixed(2)} | ` +
            `${innermost.orbitalRadius.toFixed(4)} × ${lesserMult.toFixed(2)} = ${rawInnerR.toFixed(4)} AU | ` +
            `floor=(1d6+1)×0.01=${floorR.toFixed(2)} AU | final=${newInnerR.toFixed(4)} AU`,
            'AoW WD Migration');
        innermost.orbitalRadius = newInnerR;
        innermost.resonance = null;

        if (N === 1) {
            tResult('WD Migration Complete', '1 survivor — lesser-of-two treatment applied', 'AoW WD Migration');
            return;
        }

        // ── Outermost: greater of two d% rolls (or lesserMult if larger) ─
        const origOuterR = outermost.orbitalRadius; // save before helper overwrites it
        const o_r1 = rollD100() / 100;
        const o_r2 = rollD100() / 100;
        const greaterMult  = Math.max(o_r1, o_r2);
        const effectiveMult = Math.max(greaterMult, lesserMult);
        const newOuterR = origOuterR * effectiveMult;
        tResult('Outermost Migration',
            `d%=[${Math.round(o_r1*100)},${Math.round(o_r2*100)}] → greaterMult=${greaterMult.toFixed(2)} | ` +
            `effectiveMult=max(${greaterMult.toFixed(2)}, lesserMult=${lesserMult.toFixed(2)})=${effectiveMult.toFixed(2)} | ` +
            `${origOuterR.toFixed(4)} × ${effectiveMult.toFixed(2)} = ${newOuterR.toFixed(4)} AU`,
            'AoW WD Migration');

        if (N === 2) {
            outermost.orbitalRadius = newOuterR;
            outermost.resonance = null;
            tResult('WD Migration Complete', '2 survivors — innermost + outermost placed', 'AoW WD Migration');
            return;
        }

        // ── Middle planets: Step 13 ratio redistribution ─────────────────
        // survivors[0].orbitalRadius = newInnerR (already set above)
        // newOuterR calibrates S; helper places survivors[1..N-1] via ratio rolls
        tResult('Middle Redistribution',
            `${N - 2} middle planet(s) — applying Step 13 ratio procedure between ${newInnerR.toFixed(4)} and ${newOuterR.toFixed(4)} AU`,
            'AoW WD Migration');
        _applyOrbitalRatios(survivors, newInnerR, newOuterR, 'AoW WD Migration');

        tResult('WD Migration Complete', `${N} survivor(s) redistributed`, 'AoW WD Migration');
    }

    // =================================================================
    // PUBLIC FUNCTION: generateOrbitalDynamics
    //
    // Runs Steps 13–15 for every disk worksheet in the system.
    // Reads sys.diskWorksheets[] (populated by generatePlanetaryDisks).
    // Writes orbitalRadius, mass, eccentricity, Rmin, Rmax to each planet.
    // =================================================================

    function generateOrbitalDynamics(sys) {
        tSection('AoW Chunk 5: Orbital Radii, Mass, and Eccentricity');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Chunk 5 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] AoW Chunk 5: Node ${worksheet.label}...`);
            }
            stepOrbitalRadii(worksheet);
            stepPlanetaryMass(worksheet, sys);
            stepWhiteDwarfMigration(worksheet);
            stepOrbitalEccentricity(worksheet);
            stepPostMSAbsorption(worksheet);
        }

        const totalPlanets = sys.diskWorksheets.reduce((sum, ws) => sum + (ws.planets ? ws.planets.length : 0), 0);
        tResult('Chunk 5 Complete', `${sys.diskWorksheets.length} worksheet(s) | ${totalPlanets} total planet(s) with orbits, mass, and eccentricity`, 'AoW Chunk 5');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] AoW Chunk 5 complete. Total planets with dynamics: ${totalPlanets}`);
        }
    }

    // =================================================================
    // PUBLIC FUNCTION: generatePlanetaryDisks
    //
    // Runs Steps 9–12 for every node in the system.
    // Writes results to sys.diskWorksheets[].
    // =================================================================

    function generatePlanetaryDisks(sys) {
        tSection('AoW Chunk 4: Protoplanetary Disk Formation & Planet Placement');

        const nodes = buildNodes(sys);
        tResult('Disk Nodes', `${nodes.length} — [${nodes.map(n => `${n.label}(${n.type})`).join(', ')}]`, 'AoW Chunk 4');

        sys.diskWorksheets = [];

        for (const node of nodes) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] AoW Chunk 4: Processing node ${node.label} (${node.type}-type)...`);
            }

            const worksheet = buildDiskWorksheet(sys, node);
            stepDiskInstability(worksheet);
            stepCoreAccretion(worksheet);
            stepOligarchicCollision(worksheet);

            sys.diskWorksheets.push(worksheet);

            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                const di = worksheet.diskInstabilityPlanets.length;
                const ca = worksheet.coreAccretionPlanets.length;
                const oc = worksheet.oligarchicCollisionPlanets.length;
                writeLogLine(`[PROBE] Node ${worksheet.label} done: DI=${di} CA=${ca} OC=${oc} Total=${di + ca + oc}`);
            }
        }

        // Summary across all nodes
        const totalPlanets = sys.diskWorksheets.reduce((sum, ws) =>
            sum + ws.diskInstabilityPlanets.length + ws.coreAccretionPlanets.length + ws.oligarchicCollisionPlanets.length, 0);

        tResult('Chunk 4 Complete',
            `${sys.diskWorksheets.length} disk worksheet(s) | ${totalPlanets} total planet(s) placed`,
            'AoW Chunk 4');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] AoW Chunk 4 complete. Worksheets: ${sys.diskWorksheets.length} | Total planets: ${totalPlanets}`);
        }
    }

    // =================================================================
    // STEP 16 HELPER: ROUND TO N SIGNIFICANT FIGURES
    // =================================================================

    function roundToSigFigs(n, sigFigs) {
        if (n === 0) return 0;
        const magnitude = Math.floor(Math.log10(Math.abs(n)));
        const factor = Math.pow(10, sigFigs - 1 - magnitude);
        return Math.round(n * factor) / factor;
    }

    // =================================================================
    // STEP 17 HELPER: SATELLITE PHYSICAL PARAMETERS
    //
    // Density:  D_est = M_sat^(1/5); Rocky → D_est+(3d6+10)×0.01,
    //           Icy → D_est+(3d6-20)×0.01; clamped [0.18, 1.43].
    // Radius:   6,370 × (M/D)^(1/3) km, 3 sig figs.
    // Gravity:  (M × D²)^(1/3) g, nearest 0.01.
    // =================================================================

    function calcSatellitePhysicals(M_sat, isRocky) {
        const D_est = Math.round(Math.pow(M_sat, 0.2) * 100) / 100;
        const densRoll = roll3D6();
        let D = isRocky
            ? D_est + ((densRoll + 10) * 0.01)
            : D_est + ((densRoll - 20) * 0.01);
        D = Math.max(0.18, Math.min(1.43, D));
        const radius = roundToSigFigs(6370 * Math.pow(M_sat / D, 1 / 3), 3);
        const surfaceGravity = Math.round(Math.pow(M_sat * D * D, 1 / 3) * 100) / 100;
        return { density: D, radius, surfaceGravity };
    }

    // =================================================================
    // STEP 16: PHYSICAL PARAMETERS
    //
    // Gas Giants:    D = 1/√M (M≤200 Em) or M^1.27/11800 (M>200 Em)
    // Stony Worlds:  D_est = M^(1/5); D = D_est + (3d6-10)×0.01
    //   Failed Core:      D -= 0.1
    //   Leftover Oligarch: 1d6 5-6 → D += 0.4
    //   Clamp: [0.18, 1.43]
    // R = 6,370 × (M/D)^(1/3) km  [3 sig figs]
    // G = (M × D²)^(1/3) g        [nearest 0.01]
    // Planetoid Belts: skipped entirely.
    // =================================================================

    function stepPhysicalParameters(worksheet) {
        tSection(`AoW Step 16: Physical Parameters — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 16 skipped');
            return;
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: Planetoid Belt — skipped`);
                continue;
            }

            let D;
            const isGasGiant = planet.planetType.includes('Gas Giant');

            if (isGasGiant) {
                if (planet.mass <= 200) {
                    D = 1 / Math.sqrt(planet.mass);
                    tResult(`Orbit ${planet.orbitNumber} Density`,
                        `GG ≤200: 1/√${planet.mass.toFixed(1)} = ${D.toFixed(4)}`,
                        'AoW Step 16');
                } else {
                    D = Math.pow(planet.mass, 1.27) / 11800;
                    tResult(`Orbit ${planet.orbitNumber} Density`,
                        `GG >200: ${planet.mass.toFixed(1)}^1.27/11800 = ${D.toFixed(4)}`,
                        'AoW Step 16');
                }
            } else {
                // Stony world: Terrestrial, Failed Core, Leftover Oligarch
                const D_est = Math.round(Math.pow(planet.mass, 0.2) * 100) / 100; // rounded to nearest hundredth (spec)
                const densRoll = roll3D6();
                D = D_est + ((densRoll - 10) * 0.01);
                tResult(`Orbit ${planet.orbitNumber} Density (base)`,
                    `D_est=∜⁵${planet.mass.toFixed(4)}=${D_est.toFixed(4)}, 3d6=${densRoll} → D=${D.toFixed(4)}`,
                    'AoW Step 16');

                if (planet.planetType === 'Failed Core') {
                    D -= 0.1;
                    tResult(`Orbit ${planet.orbitNumber} Density (Failed Core)`,
                        `D -= 0.1 → ${D.toFixed(4)}`,
                        'AoW Step 16');
                }

                if (planet.planetType === 'Leftover Oligarch') {
                    const impactRoll = rollD6();
                    if (impactRoll >= 5) {
                        D += 0.4;
                        tResult(`Orbit ${planet.orbitNumber} Density (Leftover Oligarch)`,
                            `1d6=${impactRoll} ≥5 → massive impact, D += 0.4 → ${D.toFixed(4)}`,
                            'AoW Step 16');
                    } else {
                        tResult(`Orbit ${planet.orbitNumber} Density (Leftover Oligarch)`,
                            `1d6=${impactRoll} <5 → no impact stripping`,
                            'AoW Step 16');
                    }
                }

                D = Math.max(0.18, Math.min(1.43, D));
                tResult(`Orbit ${planet.orbitNumber} Density (clamped)`,
                    `${D.toFixed(4)}`,
                    'AoW Step 16');
            }

            planet.density = D;

            const R = roundToSigFigs(6370 * Math.pow(planet.mass / D, 1 / 3), 3);
            planet.radius = R;
            tResult(`Orbit ${planet.orbitNumber} Radius`,
                `6370 × ∛(${planet.mass.toFixed(3)}/${D.toFixed(4)}) = ${R} km`,
                'AoW Step 16');

            const G = Math.round(Math.pow(planet.mass * D * D, 1 / 3) * 100) / 100;
            planet.surfaceGravity = G;
            tResult(`Orbit ${planet.orbitNumber} Gravity`,
                `∛(${planet.mass.toFixed(3)} × ${D.toFixed(4)}²) = ${G.toFixed(2)} g`,
                'AoW Step 16');
        }

        const physCount = worksheet.planets.filter(p => p.density !== undefined).length;
        tResult('Step 16 Complete',
            `${physCount} planet(s) assigned density/radius/gravity`,
            'AoW Step 16');
    }

    // =================================================================
    // STEP 17: NATURAL SATELLITES
    //
    // Hill Radius: H = 2.17e6 × R_min(AU) × (M_P/M_S)^(1/3)  [km]
    // M_S = worksheet.focalMass (correct for both S-type and P-type nodes).
    //
    // Case 1 — Gas Giants & Failed Cores (DI/CA outer-system formation):
    //   N_raw = ⌊H / (2,000,000 × orbitalRadius_AU)⌋
    //   If N_raw > 0: adjust N by 1d6 (1→-2, 2→-1, 5→+1, 6→+2; min 1, max 8)
    //   Generate N satellites: innermost = R_P×(1d6+2)±10%; subsequent via
    //   majorSatelliteOrbitalRatioTable with Laplace Stack (pair rule).
    //   Ring roll (always): 3d6 ≤5→None | 6-9→Thin | 10-13→Moderate | 14+→Dense
    //
    // Case 2 — Terrestrials & Leftover Oligarchs:
    //   If H ≥ 300×R_P: roll 1d6; on 6 → 1 Rocky impact moon
    //   (r=(2d6+3)×R_P, M=10^-3×3d6×M_P, always Rocky)
    //
    // Case 3 — Terrestrials & Leftover Oligarchs (no Case 2 moon only):
    //   If H ≥ 300×R_P: roll 1d6; on 4-6 → moonlets
    //   count=max(1,1d6-3); radii via majorSatelliteOrbitalRatioTable.
    //   No mass/physicals for moonlets.
    //
    // Planetoid Belts: skipped entirely.
    // =================================================================

    function stepNaturalSatellites(worksheet) {
        tSection(`AoW Step 17: Natural Satellites — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 17 skipped');
            return;
        }

        const R_ice = worksheet.rIce;

        for (const planet of worksheet.planets) {
            planet.satellites = [];
            planet.moonlets   = [];
            planet.ringSystem = null;

            if (planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: Planetoid Belt — skipped`);
                continue;
            }

            // ── Hill Radius ─────────────────────────────────────────────
            const H = 2.17e6 * planet.Rmin * Math.pow(planet.mass / worksheet.focalMass, 1 / 3);
            planet.hillRadius = H;
            tResult(`Orbit ${planet.orbitNumber} Hill Radius`,
                `2.17e6 × ${planet.Rmin.toFixed(5)} AU × ∛(${planet.mass.toFixed(3)}/${worksheet.focalMass.toFixed(4)}) = ${H.toFixed(0)} km`,
                'AoW Step 17');

            const isCase1  = planet.planetType.includes('Gas Giant') || planet.planetType === 'Failed Core';
            const isCase23 = planet.planetType === 'Terrestrial'     || planet.planetType === 'Leftover Oligarch';

            // ── Case 1: Natural Accretion — Gas Giants & Failed Cores ───
            if (isCase1) {
                const N_raw = Math.floor((2e-15) * (H * H) / Math.sqrt(planet.orbitalRadius));
                tResult(`Orbit ${planet.orbitNumber} N_raw`,
                    `⌊2e-15 × ${H.toFixed(0)}² / √${planet.orbitalRadius.toFixed(4)}⌋ = ${N_raw}`,
                    'AoW Step 17');

                if (N_raw > 0) {
                    let N = N_raw;
                    const adjRoll = rollD6();
                    if      (adjRoll === 1) { N = N - 2; }
                    else if (adjRoll === 2) { N = N - 1; }
                    else if (adjRoll === 5) { N = N + 1; }
                    else if (adjRoll === 6) { N = N + 2; }
                    N = Math.min(8, Math.max(1, N));
                    tResult(`Orbit ${planet.orbitNumber} N_adj`,
                        `1d6=${adjRoll} → N=${N}`,
                        'AoW Step 17');

                    // Innermost satellite orbital radius
                    const satRadii      = [];
                    const satResonances = [];  // resonance label for each sat relative to its predecessor
                    const innerMultRoll = rollD6();
                    const innerBase     = planet.radius * (innerMultRoll + 2);
                    const innerVariance = (rng() * 0.20) - 0.10;
                    const innerRadius   = innerBase * (1 + innerVariance);
                    satRadii.push(innerRadius);
                    satResonances.push(null);  // innermost has no predecessor resonance
                    tResult(`Orbit ${planet.orbitNumber} Sat 1 Radius`,
                        `${planet.radius} km × (${innerMultRoll}+2) × ${(1 + innerVariance).toFixed(3)} = ${innerRadius.toFixed(0)} km`,
                        'AoW Step 17');

                    // Subsequent satellite radii via table + Laplace Stack
                    let forcedLaplace = false;
                    for (let i = 1; i < N; i++) {
                        const isLastSat = (i === N - 1);
                        let ratio;
                        let resonance = null;
                        if (forcedLaplace) {
                            ratio     = 1.587;
                            resonance = '2:1';
                            forcedLaplace = false;
                            tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Ratio`,
                                `Forced 1.587 (Laplace propagation)`,
                                'AoW Step 17');
                        } else {
                            const ratioRoll = roll3D6();
                            const ratioRow  = lookupByRoll(majorSatelliteOrbitalRatioTable.results, ratioRoll);
                            if (ratioRow && ratioRow.isLaplace) {
                                if (isLastSat) {
                                    ratio     = 1.60;
                                    resonance = '2:1';
                                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Ratio`,
                                        `3d6=${ratioRoll} → 2:1 snap (last satellite → 1.600)`,
                                        'AoW Step 17');
                                } else {
                                    ratio     = 1.587;
                                    resonance = '2:1';
                                    forcedLaplace = true;
                                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Ratio`,
                                        `3d6=${ratioRoll} → 2:1 snap (1.587, next forced)`,
                                        'AoW Step 17');
                                }
                            } else {
                                ratio     = ratioRow ? ratioRow.ratio : 1.50;
                                resonance = ratioRow ? (ratioRow.resonance || null) : null;
                                tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Ratio`,
                                    `3d6=${ratioRoll} → ratio=${ratio}${resonance ? ' [' + resonance + ']' : ''}`,
                                    'AoW Step 17');
                            }
                        }
                        satRadii.push(satRadii[satRadii.length - 1] * ratio);
                        satResonances.push(resonance);
                    }

                    // Mass and physical parameters for each satellite
                    const insideIceLine = planet.orbitalRadius < R_ice;
                    for (let i = 0; i < N; i++) {
                        const satOrbR  = satRadii[i];
                        const massRoll = roll3D6();
                        const M_sat    = roundToSigFigs(1e-5 * massRoll * planet.mass / N, 2);
                        const isRocky  = insideIceLine || (planet.mass >= 200 && satOrbR <= 600000);
                        const phys     = calcSatellitePhysicals(M_sat, isRocky);

                        planet.satellites.push({
                            orbitalRadius:  satOrbR,
                            eccentricity:   0,
                            mass:           M_sat,
                            type:           isRocky ? 'Rocky' : 'Icy',
                            resonance:      satResonances[i],   // resonance with predecessor (null for innermost)
                            density:        phys.density,
                            radius:         phys.radius,
                            surfaceGravity: phys.surfaceGravity
                        });

                        tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1}`,
                            `r=${satOrbR.toFixed(0)} km | M=${M_sat.toFixed(6)} Em | ${isRocky ? 'Rocky' : 'Icy'} | D=${phys.density.toFixed(3)} | R=${phys.radius} km | G=${phys.surfaceGravity.toFixed(2)} g`,
                            'AoW Step 17');
                    }
                }

                // Ring system roll — always for Case 1 planets
                const ringRoll = roll3D6();
                if      (ringRoll <= 5)  { planet.ringSystem = null; }
                else if (ringRoll <= 9)  { planet.ringSystem = 'Thin'; }
                else if (ringRoll <= 13) { planet.ringSystem = 'Moderate'; }
                else                     { planet.ringSystem = 'Dense'; }
                tResult(`Orbit ${planet.orbitNumber} Ring System`,
                    `3d6=${ringRoll} → ${planet.ringSystem || 'None'}`,
                    'AoW Step 17');
            }

            // ── Cases 2 & 3: Terrestrials & Leftover Oligarchs ──────────
            if (isCase23) {
                const threshold = 300 * planet.radius;

                if (H < threshold) {
                    tSkip(`Orbit ${planet.orbitNumber}: H=${H.toFixed(0)} km < 300×R=${threshold.toFixed(0)} km — no satellites`);
                } else {
                    // Case 2: Massive Impact Moon
                    const case2Roll = rollD6();
                    tResult(`Orbit ${planet.orbitNumber} Case 2`,
                        `H=${H.toFixed(0)} ≥ 300×R=${threshold.toFixed(0)}, 1d6=${case2Roll}`,
                        'AoW Step 17');

                    if (case2Roll >= 5) {
                        const orbitRoll = roll3D6();
                        const satOrbR   = (orbitRoll + 7) * 4 * planet.radius;
                        const massRoll  = roll3D6();
                        const M_sat     = roundToSigFigs(1e-3 * massRoll * planet.mass, 2);
                        const phys      = calcSatellitePhysicals(M_sat, true); // always Rocky

                        planet.satellites.push({
                            orbitalRadius:  satOrbR,
                            eccentricity:   0,
                            mass:           M_sat,
                            type:           'Rocky',
                            density:        phys.density,
                            radius:         phys.radius,
                            surfaceGravity: phys.surfaceGravity
                        });

                        tResult(`Orbit ${planet.orbitNumber} Impact Moon`,
                            `2d6=${orbitRoll} → r=(${orbitRoll}+3)×${planet.radius}=${satOrbR.toFixed(0)} km | 3d6=${massRoll} → M=${M_sat.toFixed(6)} Em | D=${phys.density.toFixed(3)} | R=${phys.radius} km | G=${phys.surfaceGravity.toFixed(2)} g`,
                            'AoW Step 17');
                    }

                    // Case 3: Moonlets — only if no Case 2 moon formed
                    if (planet.satellites.length === 0) {
                        const case3Roll = rollD6();
                        tResult(`Orbit ${planet.orbitNumber} Case 3`,
                            `No major satellite, 1d6=${case3Roll}`,
                            'AoW Step 17');

                        if (case3Roll >= 4) {
                            const countRoll = rollD6();
                            const count     = Math.max(1, countRoll - 3);
                            tResult(`Orbit ${planet.orbitNumber} Moonlet Count`,
                                `1d6=${countRoll} → max(1, ${countRoll}-3) = ${count}`,
                                'AoW Step 17');

                            // Innermost moonlet
                            const m1MultRoll = rollD6();
                            const m1Radius   = planet.radius * (m1MultRoll + 2);
                            planet.moonlets.push({ orbitalRadius: m1Radius, eccentricity: 0 });
                            tResult(`Orbit ${planet.orbitNumber} Moonlet 1`,
                                `${planet.radius} km × (${m1MultRoll}+2) = ${m1Radius.toFixed(0)} km`,
                                'AoW Step 17');

                            // Subsequent moonlets via table + Laplace Stack
                            let forcedLaplace = false;
                            for (let i = 1; i < count; i++) {
                                const isLast = (i === count - 1);
                                let ratio;
                                if (forcedLaplace) {
                                    ratio = 1.587;
                                    forcedLaplace = false;
                                } else {
                                    const ratioRoll = roll3D6();
                                    const ratioRow  = lookupByRoll(majorSatelliteOrbitalRatioTable.results, ratioRoll);
                                    if (ratioRow && ratioRow.isLaplace) {
                                        ratio = isLast ? 1.60 : 1.587;
                                        if (!isLast) forcedLaplace = true;
                                    } else {
                                        ratio = ratioRow ? ratioRow.ratio : 1.50;
                                    }
                                }
                                planet.moonlets.push({
                                    orbitalRadius: planet.moonlets[planet.moonlets.length - 1].orbitalRadius * ratio,
                                    eccentricity: 0
                                });
                            }

                            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                                writeLogLine(`[PROBE] Orbit ${planet.orbitNumber} moonlets: ` +
                                    planet.moonlets.map((m, i) => `M${i + 1}=${m.orbitalRadius.toFixed(0)} km`).join(' | '));
                            }
                        }
                    }
                }
            }
        }

        tResult('Step 17 Complete', `Satellites, moonlets, and ring systems assigned`, 'AoW Step 17');
    }

    // =================================================================
    // PUBLIC FUNCTION: generatePhysicals
    //
    // Runs Steps 16–17 for every disk worksheet in the system.
    // Reads sys.diskWorksheets[] (populated by generateOrbitalDynamics).
    // Writes to each planet: density, radius, surfaceGravity, hillRadius,
    // satellites[], moonlets[], ringSystem.
    // =================================================================

    function generatePhysicals(sys) {
        tSection('AoW Chunk 6: Physical Parameters & Natural Satellites');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Chunk 6 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] AoW Chunk 6: Node ${worksheet.label}...`);
            }
            stepPhysicalParameters(worksheet);
            stepNaturalSatellites(worksheet);
        }

        const totalPhysical = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.density !== undefined).length, 0);
        const totalSatellites = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.reduce((s, p) => s + (p.satellites ? p.satellites.length : 0), 0), 0);
        const totalMoonlets = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.reduce((s, p) => s + (p.moonlets ? p.moonlets.length : 0), 0), 0);

        tResult('Chunk 6 Complete',
            `${sys.diskWorksheets.length} worksheet(s) | ${totalPhysical} planet(s) with physicals | ${totalSatellites} major satellite(s) | ${totalMoonlets} moonlet(s)`,
            'AoW Chunk 6');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] AoW Chunk 6 complete: physicals=${totalPhysical}, satellites=${totalSatellites}, moonlets=${totalMoonlets}`);
        }
    }

    // =================================================================
    // STEP 18: ORBITAL PERIOD
    //
    // Applies to terrestroid worlds only: Terrestrial, Failed Core,
    // Leftover Oligarch. Gas Giants and Planetoid Belts are skipped.
    //
    // Planets:         T = √(D³/M) × 8770        [hours; D in AU, M = focalMass]
    // Major satellites: T = √(D³/(M_P+M_S)) × 2.77e-6  [hours; D in km]
    // Moonlets:         same formula with M_S = 0
    // =================================================================

    function stepOrbitalPeriod(worksheet) {
        tSection(`AoW Step 18: Orbital Periods — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 18 skipped');
            return;
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType.includes('Gas Giant') || planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: ${planet.planetType} — skipped`);
                continue;
            }

            // Planet orbital period
            const T_planet = Math.sqrt(Math.pow(planet.orbitalRadius, 3) / worksheet.focalMass) * 8770;
            planet.orbitalPeriod = T_planet;
            tResult(`Orbit ${planet.orbitNumber} Orbital Period`,
                `√(${planet.orbitalRadius.toFixed(4)}³ / ${worksheet.focalMass.toFixed(4)}) × 8770 = ${T_planet.toFixed(2)} h`,
                'AoW Step 18');

            // Major satellite orbital periods
            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    const T_sat = Math.sqrt(Math.pow(sat.orbitalRadius, 3) / (planet.mass + sat.mass)) * 0.00000277;
                    sat.orbitalPeriod = T_sat;
                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Orbital Period`,
                        `√(${sat.orbitalRadius.toFixed(0)}³ / (${planet.mass.toFixed(3)}+${sat.mass.toFixed(6)})) × 2.77e-6 = ${T_sat.toFixed(4)} h`,
                        'AoW Step 18');
                }
            }

            // Moonlet orbital periods (M_S = 0)
            if (planet.moonlets) {
                for (let i = 0; i < planet.moonlets.length; i++) {
                    const m = planet.moonlets[i];
                    const T_moonlet = Math.sqrt(Math.pow(m.orbitalRadius, 3) / planet.mass) * 0.00000277;
                    m.orbitalPeriod = T_moonlet;
                    tResult(`Orbit ${planet.orbitNumber} Moonlet ${i + 1} Orbital Period`,
                        `√(${m.orbitalRadius.toFixed(0)}³ / ${planet.mass.toFixed(3)}) × 2.77e-6 = ${T_moonlet.toFixed(4)} h`,
                        'AoW Step 18');
                }
            }
        }

        tResult('Step 18 Complete', 'Orbital periods assigned', 'AoW Step 18');
    }

    // =================================================================
    // STEP 19: ROTATION PERIOD
    //
    // Applies to terrestroid worlds only (same scope as Step 18).
    //
    // Case 1 — Major satellites: tide-locked (rotationPeriod = orbitalPeriod)
    //
    // Case 2 — Planets WITH major satellites:
    //   Dominant satellite = max(M_S/D^6) across all major satellites.
    //   T_dec = (A × M_S × R²) / (M_P × D^6) × 1e25
    //   T_dec ≥ 2 → tide-lock (rotationPeriod = satellite orbitalPeriod)
    //   T_dec < 2 → roll 3d6 + round(T_dec×12) on rotationPeriodTable
    //     roll ≥ 24 OR result > satellite orbitalPeriod → tide-lock instead
    //
    // Case 3 — Planets WITHOUT major satellites:
    //   T_dec = (A × M × R²) / (M_P × D^6) × 1e10  [D in AU, M = focalMass]
    //   T_dec ≥ 2 → spin-orbit resonance (periodMultiplier × orbitalPeriod)
    //   T_dec < 2 → roll 3d6 + round(T_dec×12) on rotationPeriodTable
    //     roll ≥ 24 OR result > planet orbitalPeriod → spin-orbit resonance
    // =================================================================

    function stepRotationPeriod(worksheet, sys) {
        tSection(`AoW Step 19: Rotation Periods — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 19 skipped');
            return;
        }

        const A = sys.systemAge || 5;

        for (const planet of worksheet.planets) {
            if (planet.planetType.includes('Gas Giant') || planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: ${planet.planetType} — skipped`);
                continue;
            }

            // Case 1: Major satellites are instantly tide-locked
            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    sat.rotationPeriod = sat.orbitalPeriod;
                    sat.rotationLock = 'tide-locked';
                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Rotation`,
                        `Tide-locked: ${sat.rotationPeriod.toFixed(4)} h`,
                        'AoW Step 19');
                }
            }

            const hasSatellites = planet.satellites && planet.satellites.length > 0;

            if (hasSatellites) {
                // Case 2: Tidal deceleration from dominant satellite
                let dominantSat = planet.satellites[0];
                for (const sat of planet.satellites) {
                    if (sat.mass / Math.pow(sat.orbitalRadius, 6) >
                        dominantSat.mass / Math.pow(dominantSat.orbitalRadius, 6)) {
                        dominantSat = sat;
                    }
                }
                tResult(`Orbit ${planet.orbitNumber} Dominant Satellite`,
                    `Sat r=${dominantSat.orbitalRadius.toFixed(0)} km, M=${dominantSat.mass.toFixed(6)} Em (max M/D^6)`,
                    'AoW Step 19');

                const M_S = dominantSat.mass;
                const D   = dominantSat.orbitalRadius;
                const R   = planet.radius;
                const M_P = planet.mass;
                const T_dec = (A * M_S * M_S * Math.pow(R, 3)) / (M_P * Math.pow(D, 6)) * 1e25;
                planet.tidalModifier = Math.round(T_dec * 12);
                tResult(`Orbit ${planet.orbitNumber} T_dec (Case 2)`,
                    `(${A}×${M_S.toFixed(6)}²×${R}³)/(${M_P.toFixed(3)}×${D.toFixed(0)}^6)×1e25 = ${T_dec.toFixed(6)} → tidalModifier=${planet.tidalModifier}`,
                    'AoW Step 19');

                if (T_dec >= 2) {
                    planet.rotationPeriod = dominantSat.orbitalPeriod;
                    planet.rotationLock   = 'satellite-lock';
                    tResult(`Orbit ${planet.orbitNumber} Rotation`,
                        `T_dec=${T_dec.toFixed(4)} ≥ 2 → tide-locked to satellite: ${planet.rotationPeriod.toFixed(4)} h`,
                        'AoW Step 19');
                } else {
                    const modifier = Math.round(T_dec * 12);
                    const rawRoll  = roll3D6();
                    const roll     = rawRoll + modifier;
                    tResult(`Orbit ${planet.orbitNumber} Rotation Roll`,
                        `modifier=round(${T_dec.toFixed(4)}×12)=${modifier}, 3d6=${rawRoll}, total=${roll}`,
                        'AoW Step 19');

                    const row = lookupByRoll(rotationPeriodTable.results, roll);
                    const tidelock = row && row.resonanceEstablished ||
                        !row || row.rotationPeriodHours > dominantSat.orbitalPeriod;

                    if (tidelock) {
                        planet.rotationPeriod = dominantSat.orbitalPeriod;
                        planet.rotationLock   = 'satellite-lock';
                        tResult(`Orbit ${planet.orbitNumber} Rotation`,
                            `roll ${roll} → tide-lock to satellite: ${planet.rotationPeriod.toFixed(4)} h`,
                            'AoW Step 19');
                    } else {
                        planet.rotationPeriod = row.rotationPeriodHours;
                        planet.rotationLock   = 'free';
                        tResult(`Orbit ${planet.orbitNumber} Rotation`,
                            `roll ${roll} → ${planet.rotationPeriod} h`,
                            'AoW Step 19');
                    }
                }
            } else {
                // Case 3: Tidal deceleration from host star
                const M = worksheet.focalMass;
                const D = planet.orbitalRadius;
                const R = planet.radius;
                const M_P = planet.mass;
                const T_dec = (A * M * M * Math.pow(R, 3)) / (M_P * Math.pow(D, 6)) * 9.6e-14;
                planet.tidalModifier = Math.round(T_dec * 12);
                tResult(`Orbit ${planet.orbitNumber} T_dec (Case 3)`,
                    `(${A}×${M.toFixed(4)}²×${R}³)/(${M_P.toFixed(3)}×${D.toFixed(4)}^6)×9.6e-14 = ${T_dec.toFixed(4)} → tidalModifier=${planet.tidalModifier}`,
                    'AoW Step 19');

                if (T_dec >= 2) {
                    applySpinOrbitResonance(planet, 'T_dec ≥ 2');
                } else {
                    const modifier = Math.round(T_dec * 12);
                    const rawRoll  = roll3D6();
                    const roll     = rawRoll + modifier;
                    tResult(`Orbit ${planet.orbitNumber} Rotation Roll`,
                        `modifier=round(${T_dec.toFixed(4)}×12)=${modifier}, 3d6=${rawRoll}, total=${roll}`,
                        'AoW Step 19');

                    const row = lookupByRoll(rotationPeriodTable.results, roll);
                    const snapToResonance = row && row.resonanceEstablished ||
                        !row || row.rotationPeriodHours > planet.orbitalPeriod;

                    if (snapToResonance) {
                        applySpinOrbitResonance(planet, `roll ${roll} overflow`);
                    } else {
                        planet.rotationPeriod = row.rotationPeriodHours;
                        planet.rotationLock   = 'free';
                        tResult(`Orbit ${planet.orbitNumber} Rotation`,
                            `roll ${roll} → ${planet.rotationPeriod} h`,
                            'AoW Step 19');
                    }
                }
            }
        }

        tResult('Step 19 Complete', 'Rotation periods assigned', 'AoW Step 19');

        // ── Inner helper: apply spin-orbit resonance based on eccentricity ──
        function applySpinOrbitResonance(planet, reason) {
            const ecc = planet.eccentricity || 0;
            const resonanceRow = planetarySpinOrbitResonanceTable.results.find(
                r => ecc >= r.minEccentricity && ecc < r.maxEccentricity
            ) || planetarySpinOrbitResonanceTable.results[planetarySpinOrbitResonanceTable.results.length - 1];

            planet.rotationPeriod    = planet.orbitalPeriod * resonanceRow.periodMultiplier;
            planet.rotationLock      = 'spin-orbit-resonance';
            planet.spinOrbitResonance = resonanceRow.resonance;
            tResult(`Orbit ${planet.orbitNumber} Rotation`,
                `${reason} → spin-orbit ${resonanceRow.resonance} (×${resonanceRow.periodMultiplier.toFixed(4)}): ${planet.rotationPeriod.toFixed(2)} h`,
                'AoW Step 19');
        }
    }

    // =================================================================
    // STEP 20: OBLIQUITY
    //
    // Applies to terrestroid worlds only (same scope as Steps 18–19).
    //
    // Case 1 — Major satellites: 3d6-8, min 0
    // Case 2 — Planets WITH major satellites:
    //   Roll 3d6 + planet.tidalModifier on obliquityTable
    //   isExtreme → roll 1d6 on extremeObliquityTable (roll 6: 98-3d6, max 90)
    //   isMinimal → 3d6-8, min 0
    // Case 3 — Planets WITHOUT major satellites:
    //   Spin-orbit resonance → 3d6-8, min 0 (skip tables)
    //   Otherwise: High Instability test (3d6 ≤7 → -7; ≥14 → +7; flag planet.hasHighInstability)
    //   Roll 3d6 + tidalModifier + hiModifier on obliquityTable
    // =================================================================

    function stepObliquity(worksheet) {
        tSection(`AoW Step 20: Obliquity — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 20 skipped');
            return;
        }

        // Inner helper: resolve an obliquityTable row to a final degree value
        function resolveObliquityRow(row, totalRoll, label) {
            if (!row) {
                tResult(`${label} Obliquity`, `roll ${totalRoll} → table miss (default 0°)`, 'AoW Step 20');
                return 0;
            }
            if (row.isExtreme) {
                const extremeRoll = rollD6();
                const eRow = lookupByRoll(extremeObliquityTable.results, extremeRoll);
                let obliquity;
                if (eRow && eRow.isVariable) {
                    const varRoll = roll3D6();
                    obliquity = Math.min(90, 98 - varRoll);
                    tResult(`${label} Obliquity`,
                        `roll ${totalRoll} → EXTREME | 1d6=${extremeRoll} → variable: 98-3d6(${varRoll})=${98 - varRoll} → ${obliquity}°`,
                        'AoW Step 20');
                } else {
                    obliquity = eRow ? eRow.obliquity : 90;
                    tResult(`${label} Obliquity`,
                        `roll ${totalRoll} → EXTREME | 1d6=${extremeRoll} → ${obliquity}°`,
                        'AoW Step 20');
                }
                return obliquity;
            }
            if (row.isMinimal) {
                const minRoll = roll3D6();
                const obliquity = Math.max(0, minRoll - 8);
                tResult(`${label} Obliquity`,
                    `roll ${totalRoll} → MINIMAL | 3d6=${minRoll} → max(0,${minRoll}-8)=${obliquity}°`,
                    'AoW Step 20');
                return obliquity;
            }
            tResult(`${label} Obliquity`, `roll ${totalRoll} → ${row.obliquity}°`, 'AoW Step 20');
            return row.obliquity;
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType.includes('Gas Giant') || planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: ${planet.planetType} — skipped`);
                continue;
            }

            // Case 1: Major satellites — 3d6-8, min 0
            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    const r = roll3D6();
                    sat.obliquity = Math.max(0, r - 8);
                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Obliquity`,
                        `3d6=${r} → max(0,${r}-8) = ${sat.obliquity}°`,
                        'AoW Step 20');
                }
            }

            const modifier = planet.tidalModifier || 0;
            const hasSatellites = planet.satellites && planet.satellites.length > 0;

            if (hasSatellites) {
                // Case 2: Planet with major satellites
                const rawRoll  = roll3D6();
                const totalRoll = rawRoll + modifier;
                const row = lookupByRoll(obliquityTable.results, totalRoll);
                tResult(`Orbit ${planet.orbitNumber} Obliquity Roll (Case 2)`,
                    `3d6=${rawRoll} + modifier=${modifier} = ${totalRoll}`,
                    'AoW Step 20');
                planet.obliquity = resolveObliquityRow(row, totalRoll, `Orbit ${planet.orbitNumber}`);
            } else {
                // Case 3: Planet without major satellites
                if (planet.rotationLock === 'spin-orbit-resonance') {
                    const r = roll3D6();
                    planet.obliquity = Math.max(0, r - 8);
                    tResult(`Orbit ${planet.orbitNumber} Obliquity (resonance)`,
                        `Spin-orbit resonance → 3d6=${r} → max(0,${r}-8) = ${planet.obliquity}°`,
                        'AoW Step 20');
                } else {
                    // High Instability test
                    const hiRoll = roll3D6();
                    let hiMod = 0;
                    if (hiRoll <= 7) {
                        hiMod = -7;
                        planet.hasHighInstability = true;
                    } else if (hiRoll >= 14) {
                        hiMod = 7;
                        planet.hasHighInstability = true;
                    }
                    tResult(`Orbit ${planet.orbitNumber} High Instability Test`,
                        `3d6=${hiRoll} → hiMod=${hiMod}${planet.hasHighInstability ? ' [HIGH INSTABILITY]' : ''}`,
                        'AoW Step 20');

                    const rawRoll   = roll3D6();
                    const totalRoll = rawRoll + modifier + hiMod;
                    const row = lookupByRoll(obliquityTable.results, totalRoll);
                    tResult(`Orbit ${planet.orbitNumber} Obliquity Roll (Case 3)`,
                        `3d6=${rawRoll} + modifier=${modifier} + hiMod=${hiMod} = ${totalRoll}`,
                        'AoW Step 20');
                    planet.obliquity = resolveObliquityRow(row, totalRoll, `Orbit ${planet.orbitNumber}`);
                }
            }
        }

        tResult('Step 20 Complete', 'Obliquities assigned', 'AoW Step 20');
    }

    // =================================================================
    // STEP 21: LOCAL CALENDAR
    //
    // Applies to terrestroid worlds only.
    //
    // Local Day (planets):    T_day   = |P×R / (P−R)|  [hours]
    //   If P = R (1:1 resonance): T_day = Infinity (sun never moves)
    // Synodic Month (satellites & moonlets):
    //   T_month = |P×R / (P−R)|  [hours; P = planet orbital period, R = satellite period]
    // =================================================================

    function stepLocalCalendar(worksheet) {
        tSection(`AoW Step 21: Local Calendar — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 21 skipped');
            return;
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType.includes('Gas Giant') || planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: ${planet.planetType} — skipped`);
                continue;
            }

            if (planet.orbitalPeriod === undefined || planet.rotationPeriod === undefined) {
                tSkip(`Orbit ${planet.orbitNumber}: missing period data`);
                continue;
            }

            const P = planet.orbitalPeriod;
            const R = planet.rotationPeriod;

            // Local solar day
            const T_day = (P === R) ? Infinity : Math.abs((P * R) / (P - R));
            planet.localDay = T_day;

            if (T_day === Infinity) {
                tResult(`Orbit ${planet.orbitNumber} Local Day`,
                    `P=R=${P.toFixed(2)} h → 1:1 resonance, local day = Infinite`,
                    'AoW Step 21');
            } else {
                tResult(`Orbit ${planet.orbitNumber} Local Day`,
                    `|${P.toFixed(2)}×${R.toFixed(2)}/(${P.toFixed(2)}−${R.toFixed(2)})| = ${T_day.toFixed(2)} h`,
                    'AoW Step 21');
            }

            // Local year (in local days): orbitalPeriod / localDay
            // If localDay is Infinite (1:1 resonance), localYear = 0 by convention.
            planet.localYear = T_day === Infinity ? 0 : P / T_day;
            tResult(`Orbit ${planet.orbitNumber} Local Year`,
                T_day === Infinity
                    ? `1:1 resonance → 0 local days/year`
                    : `${P.toFixed(2)} h / ${T_day.toFixed(2)} h = ${planet.localYear.toFixed(2)} local days`,
                'AoW Step 21');

            // Synodic months and apparent orbital periods — major satellites
            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    if (sat.orbitalPeriod === undefined) continue;
                    const R_s = sat.orbitalPeriod;

                    // Synodic month: P = planet orbital period, R = satellite orbital period
                    const T_month = (P === R_s) ? Infinity : Math.abs((P * R_s) / (P - R_s));
                    sat.synodicMonth = T_month;
                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Synodic Month`,
                        T_month === Infinity
                            ? `P=R_sat → Infinite`
                            : `|${P.toFixed(2)}×${R_s.toFixed(4)}/(${P.toFixed(2)}−${R_s.toFixed(4)})| = ${T_month.toFixed(2)} h`,
                        'AoW Step 21');

                    // Apparent orbital period: P = satellite orbital period, R = planet rotation period
                    // Can be negative when satellite orbits faster than the planet rotates (e.g. Phobos).
                    const T_app = (R_s === R) ? Infinity : (R_s * R) / (R_s - R);
                    sat.apparentOrbitalPeriod = T_app;
                    tResult(`Orbit ${planet.orbitNumber} Sat ${i + 1} Apparent Period`,
                        T_app === Infinity
                            ? `R_sat=R_planet → geostationary, Infinite`
                            : `${R_s.toFixed(4)}×${R.toFixed(2)}/(${R_s.toFixed(4)}−${R.toFixed(2)}) = ${T_app.toFixed(2)} h`,
                        'AoW Step 21');
                }
            }

            // Synodic months — moonlets (same formula)
            if (planet.moonlets) {
                for (let i = 0; i < planet.moonlets.length; i++) {
                    const m = planet.moonlets[i];
                    if (m.orbitalPeriod === undefined) continue;
                    const R_m = m.orbitalPeriod;
                    const T_month = (P === R_m) ? Infinity : Math.abs((P * R_m) / (P - R_m));
                    m.synodicMonth = T_month;
                    tResult(`Orbit ${planet.orbitNumber} Moonlet ${i + 1} Synodic Month`,
                        T_month === Infinity
                            ? `Infinite`
                            : `${T_month.toFixed(2)} h`,
                        'AoW Step 21');
                }
            }
        }

        tResult('Step 21 Complete', 'Local calendars assigned', 'AoW Step 21');
    }

    // =================================================================
    // PUBLIC FUNCTION: generateOrbitalConditions
    //
    // Runs Steps 18–21 for every disk worksheet in the system.
    // Reads sys.diskWorksheets[] (populated by generatePhysicals).
    // Writes to terrestroid planets: orbitalPeriod, rotationPeriod,
    // rotationLock, spinOrbitResonance, tidalModifier, hasHighInstability,
    // obliquity, localDay, localYear.
    // Writes to major satellites: orbitalPeriod, rotationPeriod,
    // rotationLock, obliquity, synodicMonth, apparentOrbitalPeriod.
    // Writes to moonlets: orbitalPeriod, synodicMonth.
    // =================================================================

    function generateOrbitalConditions(sys) {
        tSection('AoW Chunk 7: Orbital Conditions (Steps 18–21)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Chunk 7 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] AoW Chunk 7: Node ${worksheet.label}...`);
            }
            stepOrbitalPeriod(worksheet);
            stepRotationPeriod(worksheet, sys);
            stepObliquity(worksheet);
            stepLocalCalendar(worksheet);
        }

        const totalOrbital  = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.orbitalPeriod  !== undefined).length, 0);
        const totalRotation = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.rotationPeriod !== undefined).length, 0);
        const totalObliquity = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.obliquity      !== undefined).length, 0);

        tResult('Chunk 7 Complete (Steps 18–21)',
            `${sys.diskWorksheets.length} worksheet(s) | ${totalOrbital} orbital periods | ${totalRotation} rotation periods | ${totalObliquity} obliquities`,
            'AoW Chunk 7');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] AoW Chunk 7 complete: orbitalPeriods=${totalOrbital}, rotationPeriods=${totalRotation}, obliquities=${totalObliquity}`);
        }
    }

    // =================================================================
    // STEP 22: BLACKBODY TEMPERATURE & M-NUMBER
    //
    // Applies to terrestroid worlds and major satellites (same scope as
    // Steps 18–21). Gas Giants and Planetoid Belts are skipped.
    // Satellites share the parent planet's orbital radius for T_bb.
    //
    // Multi-source formula (AoW multiple-star rule):
    //   T_bb = round(278 × (Σk Lk/Rk²)^0.25)  [K]
    // where k runs over every star in the system:
    //   focal stars   → Rk = planet.orbitalRadius
    //   companion stars → Rk = worksheet.companionSep (mean orbital separation, orbit.R)
    // For single-star systems this reduces to the original 278 × L^0.25 / √R.
    //   T_bb > 3000 → planet.vaporized = true (all subsequent steps skip it)
    //
    // M_num = ⌈(700000 × T_bb) / (K × R_km²)⌉
    //   EUV correction: 1 < M_num ≤ 4 AND worksheet.euvActive → force M_num = 5
    // =================================================================

    function stepBlackbodyAndMNumber(worksheet) {
        tSection(`AoW Step 22: Blackbody Temperature & M-Number — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 22 skipped');
            return;
        }

        const hasStellarCompanion = worksheet.companionSep !== null && worksheet.companionLum > 0;

        function computeIrradiance(orbitalRadius) {
            const R_p = orbitalRadius;
            let irr = worksheet.focalLum / (R_p * R_p);
            if (hasStellarCompanion) {
                irr += worksheet.companionLum / (worksheet.companionSep * worksheet.companionSep);
            }
            return irr;
        }

        function computeMNum(T_bb, density, radiusKm, label) {
            const raw  = (700000 * T_bb) / (density * radiusKm * radiusKm);
            let M_num  = Math.ceil(raw);
            if (M_num > 1 && M_num <= 4 && worksheet.euvActive) {
                tResult(`${label} EUV Correction`,
                    `M_num=${M_num} ∈ (1,4] AND EUV active → forced to 5`,
                    'AoW Step 22');
                M_num = 5;
            }
            return M_num;
        }

        for (const planet of worksheet.planets) {
            if (planet.absorbedByStar) {
                tSkip(`Orbit ${planet.orbitNumber}: absorbed by expanding primary — skipped`);
                continue;
            }
            if (planet.planetType === 'Planetoid Belt') {
                tSkip(`Orbit ${planet.orbitNumber}: Planetoid Belt — skipped`);
                continue;
            }

            const isGasGiant  = planet.planetType.includes('Gas Giant');
            const irradiance  = computeIrradiance(planet.orbitalRadius);
            const T_bb        = Math.round(278 * Math.pow(irradiance, 0.25));

            // ── Terrestroid planet ───────────────────────────────────────
            if (!isGasGiant) {
                planet.tBb = T_bb;
                if (hasStellarCompanion) {
                    const R_p   = planet.orbitalRadius;
                    const focal = worksheet.focalLum / (R_p * R_p);
                    const comp  = worksheet.companionLum / (worksheet.companionSep * worksheet.companionSep);
                    tResult(`Orbit ${planet.orbitNumber} T_bb`,
                        `278 × (L_focal/${R_p.toFixed(4)}² + L_comp/${worksheet.companionSep.toFixed(4)}²)^0.25 = ` +
                        `278 × (${focal.toFixed(6)} + ${comp.toFixed(6)})^0.25 = ${T_bb} K`,
                        'AoW Step 22');
                } else {
                    tResult(`Orbit ${planet.orbitNumber} T_bb`,
                        `278 × (${worksheet.focalLum.toFixed(6)}/${planet.orbitalRadius.toFixed(4)}²)^0.25 = ${T_bb} K`,
                        'AoW Step 22');
                }

                if (T_bb > 3000) {
                    planet.vaporized = true;
                    tResult(`Orbit ${planet.orbitNumber} VAPORIZED`,
                        `T_bb=${T_bb} K > 3000 — rock vaporized, eliminated from system`,
                        'AoW Step 22');
                } else {
                    const M_num = computeMNum(T_bb, planet.density, planet.radius,
                        `Orbit ${planet.orbitNumber}`);
                    planet.mNum = M_num;
                    tResult(`Orbit ${planet.orbitNumber} M_num`,
                        `⌈(700000×${T_bb})/(${planet.density.toFixed(4)}×${planet.radius}²)⌉ = ${M_num}`,
                        'AoW Step 22');
                }
            } else {
                // Gas giant — no T_bb/M_num for the giant itself, but log the position
                if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                    writeLogLine(`[PROBE] Orbit ${planet.orbitNumber}: Gas Giant at ${planet.orbitalRadius.toFixed(4)} AU, T_bb position = ${T_bb} K (for satellites)`);
                }
            }

            // ── Major satellites — T_bb is the same as the parent orbit ──
            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    const satLabel = `Orbit ${planet.orbitNumber} Sat ${i + 1}`;
                    sat.tBb = T_bb;

                    if (T_bb > 3000 || planet.vaporized) {
                        sat.vaporized = true;
                        tResult(`${satLabel} VAPORIZED`, `T_bb=${T_bb} K > 3000 (parent orbit)`, 'AoW Step 22');
                        continue;
                    }

                    const M_num = computeMNum(T_bb, sat.density, sat.radius, satLabel);
                    sat.mNum = M_num;
                    tResult(`${satLabel} T_bb / M_num`,
                        `T_bb=${T_bb} K (parent orbit) | M_num=${M_num}`,
                        'AoW Step 22');
                }
            }
        }

        const processed = worksheet.planets.filter(p => p.tBb !== undefined).length;
        tResult('Step 22 Complete', `${processed} terrestroid planet(s) processed`, 'AoW Step 22');
    }

    // =================================================================
    // STEP 23: WATER PREVALENCE
    //
    // Applies to terrestroid worlds and major satellites.
    //
    // M_num ≤ 2:          Massive, 100%
    // M_num 3–28:
    //   Outside ice line: Massive, 100%
    //   Inside  ice line: roll 3d6 − M_num (+6 if Grand Tack & CA outside ice
    //                     line; +3 if any planet outside slow-accretion line)
    //                     → initialWaterPrevalenceTable
    // M_num ≥ 29:
    //   T_bb ≥ 125 OR (gas-giant satellite tagged Rocky) → Trace, 0%
    //   Otherwise                                        → Massive, 100%
    //
    // Greenhouse checks (sequential, using final prevalence):
    //   M_num>2 & Minimal  & T_bb≥300: 3d6+T_bb ≥318 → Trace, 0%
    //   M_num>2 & Moderate+ & T_bb≥300: 3d6+T_bb ≥318 → Runaway Dry GH, Trace
    //   M_num≤2 & T_bb≥140:            3d6+T_bb ≥158 → Runaway Wet GH (stays Massive)
    // =================================================================

    function stepWater(worksheet) {
        tSection(`AoW Step 23: Water Prevalence — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 23 skipped');
            return;
        }

        const R_ice = worksheet.rIce;

        // Worksheet-wide flags for water bonus modifiers
        const grandTackOccurred = worksheet.planets.some(p =>
            typeof p.grandTackMovement === 'number' && p.grandTackMovement > 0);
        const anyCaOutsideIceLine = worksheet.planets.some(p =>
            p.formationOrbitType === 'CA' && p.orbitalRadius > R_ice);
        const anyOutsideSlowAccretion = worksheet.planets.some(p =>
            typeof p.orbitalRadius === 'number' && p.orbitalRadius > worksheet.rSlow);

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 23 flags: grandTack=${grandTackOccurred} caOutsideIce=${anyCaOutsideIceLine} outsideSlow=${anyOutsideSlowAccretion} R_ice=${R_ice.toFixed(4)} AU`);
        }

        // ── Per-world water logic ────────────────────────────────────────
        function processWorld(world, orbitalRadius, isGasGiantSat, logLabel) {
            if (world.vaporized || world.mNum === undefined) {
                tSkip(`${logLabel}: vaporized or no M_num`);
                return;
            }

            const M_num = world.mNum;
            const T_bb  = world.tBb;
            let prevalence, coverage;

            // ── 1. Base prevalence ───────────────────────────────────────
            if (M_num <= 2) {
                prevalence = 'Massive'; coverage = 100;
                tResult(`${logLabel} Water (base)`,
                    `M_num=${M_num} ≤ 2 → Massive, 100%`, 'AoW Step 23');

            } else if (M_num <= 28) {
                if (orbitalRadius >= R_ice) {
                    prevalence = 'Massive'; coverage = 100;
                    tResult(`${logLabel} Water (base)`,
                        `M_num=${M_num} ∈ [3,28], outside ice line (${orbitalRadius.toFixed(4)} ≥ ${R_ice.toFixed(4)} AU) → Massive, 100%`,
                        'AoW Step 23');
                } else {
                    let rollMod = -M_num;
                    if (grandTackOccurred && anyCaOutsideIceLine) rollMod += 6;
                    if (anyOutsideSlowAccretion) rollMod += 3;
                    const rawRoll = roll3D6();
                    const total   = rawRoll + rollMod;
                    const row     = lookupByRoll(initialWaterPrevalenceTable.results, total);
                    prevalence = row ? row.prevalence : 'Trace';
                    coverage   = row ? row.baseHydrographicCoverage : 0;
                    tResult(`${logLabel} Water Roll`,
                        `M_num=${M_num} ∈ [3,28], inside ice line | 3d6=${rawRoll} + mod=${rollMod} = ${total} → ${prevalence}, ${coverage}%`,
                        'AoW Step 23');
                }

            } else {
                // M_num >= 29
                const rockyGiantSat = isGasGiantSat && world.type === 'Rocky';
                if (T_bb >= 125 || rockyGiantSat) {
                    prevalence = 'Trace'; coverage = 0;
                    tResult(`${logLabel} Water (base)`,
                        `M_num=${M_num} ≥ 29 | ${T_bb >= 125 ? `T_bb=${T_bb} ≥ 125` : 'Rocky gas-giant satellite'} → Trace, 0%`,
                        'AoW Step 23');
                } else {
                    prevalence = 'Massive'; coverage = 100;
                    tResult(`${logLabel} Water (base)`,
                        `M_num=${M_num} ≥ 29, T_bb=${T_bb} < 125, not Rocky GG sat → Massive, 100%`,
                        'AoW Step 23');
                }
            }

            // ── 2. Greenhouse & water loss checks ────────────────────────
            if (M_num > 2 && prevalence === 'Minimal' && T_bb >= 300) {
                const ghRoll = roll3D6() + T_bb;
                if (ghRoll >= 318) {
                    prevalence = 'Trace'; coverage = 0;
                    tResult(`${logLabel} Dry Loss`,
                        `Minimal & T_bb=${T_bb}≥300 | 3d6+T_bb=${ghRoll}≥318 → Trace, 0%`,
                        'AoW Step 23');
                }
            }

            const moderatePlus = ['Moderate', 'Extensive', 'Massive'];
            if (M_num > 2 && moderatePlus.includes(prevalence) && T_bb >= 300) {
                const ghRoll = roll3D6() + T_bb;
                if (ghRoll >= 318) {
                    world.isRunawayDryGreenhouse = true;
                    prevalence = 'Trace'; coverage = 0;
                    tResult(`${logLabel} Runaway Dry Greenhouse`,
                        `${prevalence} & T_bb=${T_bb}≥300 | 3d6+T_bb=${ghRoll}≥318 → DRY GREENHOUSE, Trace, 0%`,
                        'AoW Step 23');
                }
            }

            if (M_num <= 2 && T_bb >= 140) {
                const ghRoll = roll3D6() + T_bb;
                if (ghRoll >= 158) {
                    world.isRunawayWetGreenhouse = true;
                    tResult(`${logLabel} Runaway Wet Greenhouse`,
                        `M_num≤2 & T_bb=${T_bb}≥140 | 3d6+T_bb=${ghRoll}≥158 → WET GREENHOUSE (water stays Massive)`,
                        'AoW Step 23');
                }
            }

            world.waterPrevalence = prevalence;
            world.waterCoverage   = coverage;
            tResult(`${logLabel} Final Water`, `${prevalence}, ${coverage}%`, 'AoW Step 23');
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') continue;

            const isGasGiant = planet.planetType.includes('Gas Giant');

            if (!isGasGiant) {
                processWorld(planet, planet.orbitalRadius, false,
                    `Orbit ${planet.orbitNumber}`);
            }

            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    processWorld(planet.satellites[i], planet.orbitalRadius, isGasGiant,
                        `Orbit ${planet.orbitNumber} Sat ${i + 1}`);
                }
            }
        }

        tResult('Step 23 Complete', 'Water prevalence assigned', 'AoW Step 23');
    }

    // =================================================================
    // PUBLIC FUNCTION: generateThermalAndWater
    //
    // Runs Steps 22–23 for every disk worksheet in the system.
    // Reads sys.diskWorksheets[] (populated by generateOrbitalConditions).
    // Writes to terrestroid planets and major satellites:
    //   tBb, mNum, vaporized, waterPrevalence, waterCoverage,
    //   isRunawayDryGreenhouse, isRunawayWetGreenhouse.
    // =================================================================

    function generateThermalAndWater(sys) {
        tSection('AoW Chunk 7 (cont.): Blackbody Temperature, M-Number & Water (Steps 22–23)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Steps 22–23 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Steps 22–23: Node ${worksheet.label}...`);
            }
            stepBlackbodyAndMNumber(worksheet);
            stepWater(worksheet);
        }

        const totalTBb = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.tBb !== undefined).length, 0);
        const vaporized = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.vaporized).length, 0);
        const withWater = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.waterPrevalence !== undefined).length, 0);

        tResult('Steps 22–23 Complete',
            `${totalTBb} T_bb assigned | ${vaporized} vaporized | ${withWater} with water prevalence`,
            'AoW Steps 22–23');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Steps 22–23 complete: tBb=${totalTBb}, vaporized=${vaporized}, water=${withWater}`);
        }
    }

    // =================================================================
    // STEP 24: GEOPHYSICS
    // =================================================================

    function stepGeophysics(worksheet, sys) {
        const age         = sys.systemAge || 0;
        const metallicity = sys.systemMetallicity || 1.0;

        const ageMod = Math.round(age * 8);
        const C_R    = Math.round(-10 * Math.log10(metallicity));

        for (const planet of worksheet.planets) {
            if (planet.vaporized) continue;
            if (planet.type === 'Gas Giant (DI)' || planet.type === 'Gas Giant (CA)' || planet.type === 'Planetoid Belt') continue;

            _runGeophysicsOnWorld(planet, planet.type, planet.orbitalRadius, null, null, null, ageMod, C_R, worksheet, sys);

            // Full Step 24 for major satellites of any planet type
            if (planet.satellites && planet.satellites.length > 0) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    if (sat.vaporized) continue;
                    if (sat.type === 'Moonlet') continue;
                    _runGeophysicsOnWorld(sat, sat.type, sat.orbitalRadius, planet, i, planet.satellites, ageMod, C_R, worksheet, sys);
                }
            }
        }
    }

    function _runGeophysicsOnWorld(world, worldType, orbitalRadius, parentPlanet, satIndex, allSibs, ageMod, C_R, worksheet, sys) {
        const label = parentPlanet
            ? `Sat ${satIndex} of ${parentPlanet.type} orbit ${parentPlanet.orbitNumber}`
            : `Planet orbit ${world.orbitNumber}`;

        tSection(`AoW Step 24: Geophysics — ${label}`);

        const G           = world.surfaceGravity || 1.0;
        const C_P         = Math.round(-60 * Math.log10(G));
        const baseRoll    = roll3D6() + ageMod + C_P + C_R;

        tResult('Step 24 Base Roll',
            `3d6 + ageMod(${ageMod}) + C_P(${C_P}) + C_R(${C_R}) = ${baseRoll}`,
            'AoW Step 24');

        // Base lithosphere from table
        const lithoRow = lithosphereTable.results.find(r => baseRoll >= r.minRoll && baseRoll <= r.maxRoll);
        world.lithosphere      = lithoRow ? lithoRow.status       : 'Mature Plate Lithosphere';
        world.activityLevel    = lithoRow ? lithoRow.activityLevel : 3;

        tResult('Step 24 Base Lithosphere',
            `${world.lithosphere} (Activity ${world.activityLevel})`,
            'AoW Step 24');

        // ------------------------------------------------------------------
        // Tidal Heating Override — Case 1: Gas Giant's major satellite in
        // resonance with the next outward sibling
        // ------------------------------------------------------------------
        const isGasGiantSat = parentPlanet &&
            (parentPlanet.type === 'Gas Giant (DI)' || parentPlanet.type === 'Gas Giant (CA)');

        if (isGasGiantSat && allSibs && satIndex !== null) {
            const nextSib = allSibs[satIndex + 1];
            if (nextSib && nextSib.resonance !== null && nextSib.resonance !== undefined) {
                const M_GG = parentPlanet.mass;
                const r    = world.radius;          // physical radius in km  (D in spec)
                const D    = world.orbitalRadius;   // satellite orbital radius in km  (R in spec)
                const F    = (M_GG * r) / Math.pow(D, 3) * 1.59e15;

                const tidalRow = tidalHeatTable.results.find(row => F >= row.minF && F <= row.maxF);
                if (tidalRow && tidalRow.activityLevel > world.activityLevel) {
                    tResult('Step 24 Tidal Override (Case 1)',
                        `F=${F.toExponential(3)} → ${tidalRow.status} (AL ${tidalRow.activityLevel} > base AL ${world.activityLevel})`,
                        'AoW Step 24');
                    world.lithosphere   = tidalRow.status;
                    world.activityLevel = tidalRow.activityLevel;
                } else {
                    tResult('Step 24 Tidal Heating (Case 1)',
                        `F=${F.toExponential(3)} → ${tidalRow ? tidalRow.status : 'n/a'} (no upgrade)`,
                        'AoW Step 24');
                }
            }
        }

        // ------------------------------------------------------------------
        // Tidal Heating Override — Case 2: Terrestroid planet in
        // spin-orbit resonance with its primary star (no major satellites)
        // ------------------------------------------------------------------
        const hasSatellites = parentPlanet === null && world.satellites && world.satellites.length > 0;
        const isTerrestroid = worldType === 'Terrestrial' || worldType === 'Failed Core' || worldType === 'Leftover Oligarch';
        const isSpinOrbitPlanet = isTerrestroid && !hasSatellites && world.rotationLock === 'spin-orbit-resonance';

        if (isSpinOrbitPlanet) {
            const M_star = worksheet.focalMass;
            const r      = world.radius;          // physical radius in km  (D in spec)
            const D      = world.orbitalRadius;   // planet orbital radius in AU  (R in spec — use AU directly)
            const F      = (M_star * r) / Math.pow(D, 3) * 1.57e-4;

            const tidalRow = tidalHeatTable.results.find(row => F >= row.minF && F <= row.maxF);
            if (tidalRow && tidalRow.activityLevel > world.activityLevel) {
                tResult('Step 24 Tidal Override (Case 2)',
                    `F=${F.toExponential(3)} → ${tidalRow.status} (AL ${tidalRow.activityLevel} > base AL ${world.activityLevel})`,
                    'AoW Step 24');
                world.lithosphere   = tidalRow.status;
                world.activityLevel = tidalRow.activityLevel;
            } else {
                tResult('Step 24 Tidal Heating (Case 2)',
                    `F=${F.toExponential(3)} → ${tidalRow ? tidalRow.status : 'n/a'} (no upgrade)`,
                    'AoW Step 24');
            }
        }

        // ------------------------------------------------------------------
        // Plate Tectonics
        // ------------------------------------------------------------------
        const wP = world.waterPrevalence || 'None';

        let plateMod = 0;
        if (wP === 'Extensive' || wP === 'Massive')  plateMod += 6;
        if (wP === 'Minimal'   || wP === 'Trace')    plateMod -= 6;
        if (world.lithosphere === 'Early Plate Lithosphere')   plateMod += 2;
        if (world.lithosphere === 'Ancient Plate Lithosphere') plateMod -= 2;

        const plateRoll = roll3D6() + plateMod;
        world.plateTectonics = plateRoll >= 11 ? 'Mobile' : 'Fixed';

        // Episodic Resurfacing: Fixed + Soft or Early Plate
        if (world.plateTectonics === 'Fixed' &&
            (world.lithosphere === 'Soft Lithosphere' || world.lithosphere === 'Early Plate Lithosphere')) {
            world.isEpisodicResurfacing = true;
        } else {
            world.isEpisodicResurfacing = false;
        }

        tResult('Step 24 Plate Tectonics',
            `3d6+${plateMod}=${plateRoll} → ${world.plateTectonics}${world.isEpisodicResurfacing ? ' (Episodic Resurfacing)' : ''}`,
            'AoW Step 24');

        // ------------------------------------------------------------------
        // Hydrographic Coverage Adjustment
        // ------------------------------------------------------------------

        // Molten Lithosphere + non-Massive → reduce to Trace 0%
        if (world.lithosphere === 'Molten Lithosphere' && world.waterPrevalence !== 'Massive') {
            if (world.waterPrevalence !== 'Trace' && world.waterPrevalence !== undefined) {
                tResult('Step 24 Hydro: Molten Reduction',
                    `${world.waterPrevalence} → Trace 0% (Molten Lithosphere)`,
                    'AoW Step 24');
            }
            world.waterPrevalence = 'Trace';
            world.waterCoverage   = 0;
        }

        // Extensive water coverage bonus by lithosphere type
        if (world.waterPrevalence === 'Extensive') {
            let bonus = 0;
            let bonusDesc = '';
            if (world.lithosphere === 'Soft Lithosphere' || world.lithosphere === 'Solid Lithosphere') {
                bonus     = roll3D6() + 10;
                bonusDesc = `3d6+10=${bonus}%`;
            } else if (world.lithosphere === 'Early Plate Lithosphere' || world.lithosphere === 'Ancient Plate Lithosphere') {
                bonus     = roll3D6();
                bonusDesc = `3d6=${bonus}%`;
            }
            if (bonus > 0) {
                const oldCoverage = world.waterCoverage || 0;
                world.waterCoverage = Math.min(100, oldCoverage + bonus);
                tResult('Step 24 Hydro: Extensive Bonus',
                    `${oldCoverage}% + ${bonusDesc} → ${world.waterCoverage}%`,
                    'AoW Step 24');
            }
        }

        tResult('Step 24 Final',
            `${world.lithosphere} | ${world.plateTectonics}${world.isEpisodicResurfacing ? ' (Episodic)' : ''} | Water: ${world.waterPrevalence || 'None'} ${world.waterCoverage !== undefined ? world.waterCoverage + '%' : ''}`,
            'AoW Step 24');
    }

    function generateGeophysics(sys) {
        tSection('AoW Chunk 7 (cont.): Geophysics (Step 24)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 24 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 24: Node ${worksheet.label}...`);
            }
            stepGeophysics(worksheet, sys);
        }

        const withLitho = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.lithosphere !== undefined).length, 0);
        const mobile = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.plateTectonics === 'Mobile').length, 0);

        tResult('Step 24 Complete',
            `${withLitho} worlds with lithosphere | ${mobile} Mobile plate tectonics`,
            'AoW Step 24');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 24 complete: lithosphere=${withLitho}, mobile=${mobile}`);
        }
    }

    // =================================================================
    // STEP 25: MAGNETIC FIELD
    // =================================================================

    function stepMagneticField(worksheet) {
        for (const planet of worksheet.planets) {
            if (planet.vaporized) continue;
            if (planet.type === 'Gas Giant (DI)' || planet.type === 'Gas Giant (CA)' || planet.type === 'Planetoid Belt') continue;

            _applyMagneticField(planet, `Planet orbit ${planet.orbitNumber}`);

            if (planet.satellites && planet.satellites.length > 0) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    if (sat.vaporized) continue;
                    if (sat.type === 'Moonlet') continue;
                    _applyMagneticField(sat, `Sat ${i} of orbit ${planet.orbitNumber}`);
                }
            }
        }
    }

    function _applyMagneticField(world, label) {
        const litho    = world.lithosphere    || '';
        const tectonics = world.plateTectonics || '';
        const isMobile  = tectonics === 'Mobile';

        let modifier = 0;
        if (litho === 'Soft Lithosphere') {
            modifier = 4;
        } else if ((litho === 'Early Plate Lithosphere' || litho === 'Ancient Plate Lithosphere') && isMobile) {
            modifier = 8;
        } else if (litho === 'Mature Plate Lithosphere' && isMobile) {
            modifier = 12;
        }

        const totalRoll = roll3D6() + modifier;
        const row = magneticFieldTable.results.find(r => totalRoll >= r.minRoll && totalRoll <= r.maxRoll);
        world.magneticField = row ? row.magneticField : 'None';

        tResult(`Step 25 Magnetic Field — ${label}`,
            `3d6+${modifier}=${totalRoll} → ${world.magneticField}`,
            'AoW Step 25');
    }

    function generateMagneticField(sys) {
        tSection('AoW Chunk 7 (cont.): Magnetic Field (Step 25)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 25 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 25: Node ${worksheet.label}...`);
            }
            stepMagneticField(worksheet);
        }

        const counts = { None: 0, Weak: 0, Moderate: 0, Strong: 0 };
        for (const ws of sys.diskWorksheets) {
            for (const p of ws.planets) {
                if (p.magneticField) counts[p.magneticField] = (counts[p.magneticField] || 0) + 1;
            }
        }

        tResult('Step 25 Complete',
            `None=${counts.None} | Weak=${counts.Weak} | Moderate=${counts.Moderate} | Strong=${counts.Strong}`,
            'AoW Step 25');
    }

    // =================================================================
    // STEP 26: EARLY ATMOSPHERE
    // =================================================================

    function stepEarlyAtmosphere(worksheet) {
        for (const planet of worksheet.planets) {
            if (planet.vaporized) continue;
            if (planet.type === 'Gas Giant (DI)' || planet.type === 'Gas Giant (CA)' || planet.type === 'Planetoid Belt') continue;

            _applyEarlyAtmosphere(planet, `Planet orbit ${planet.orbitNumber}`);

            if (planet.satellites && planet.satellites.length > 0) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    const sat = planet.satellites[i];
                    if (sat.vaporized) continue;
                    if (sat.type === 'Moonlet') continue;
                    _applyEarlyAtmosphere(sat, `Sat ${i} of orbit ${planet.orbitNumber}`);
                }
            }
        }
    }

    function _applyEarlyAtmosphere(world, label) {
        const wP      = world.waterPrevalence  || 'None';
        const litho   = world.lithosphere      || '';
        const magF    = world.magneticField    || 'None';
        const T_bb    = world.tBb              || 0;
        const M_num   = world.mNum             || 999;
        const isDryGH = world.isRunawayDryGreenhouse  || false;
        const isWetGH = world.isRunawayWetGreenhouse  || false;

        tSection(`AoW Step 26: Early Atmosphere — ${label}`);

        // R_factor modifier
        let mod = 0;
        if (wP === 'Massive' || isDryGH || isWetGH) mod += 6;

        if      (litho === 'Molten Lithosphere')         mod += 6;
        else if (litho === 'Soft Lithosphere')           mod += 4;
        else if (litho === 'Early Plate Lithosphere')    mod += 2;
        else if (litho === 'Ancient Plate Lithosphere')  mod -= 2;
        else if (litho === 'Solid Lithosphere')          mod -= 4;

        if      (magF === 'Moderate') mod -= 2;
        else if (magF === 'Weak')     mod -= 4;
        else if (magF === 'None')     mod -= 6;

        const rawRoll  = roll3D6() + mod;
        const R_factor = Math.max(0, Math.min(3.0, rawRoll * 0.1));

        tResult(`Step 26 R_factor — ${label}`,
            `3d6+${mod}=${rawRoll} → ${R_factor.toFixed(1)}`,
            'AoW Step 26');

        world.rFactor = R_factor;

        // Atmospheric component masses
        let M_H2 = 0;
        if (R_factor > 0 && M_num <= 2) {
            const base = 7.5 * R_factor;
            M_H2 = roundToSigFigs(base * (1 + (rng() * 0.2 - 0.1)), 2);
        }

        let M_He = 0;
        if (R_factor > 0 && M_num <= 4) {
            const base = 2.5 * R_factor;
            M_He = roundToSigFigs(base * (1 + (rng() * 0.2 - 0.1)), 2);
        }

        let M_N2 = 0;
        if (R_factor > 0 && M_num <= 28 && T_bb >= 80) {
            const mult = (T_bb <= 125 && wP === 'Massive') ? 15 : 1;
            const base = 0.7 * R_factor * mult;
            M_N2 = roundToSigFigs(base * (1 + (rng() * 0.2 - 0.1)), 2);
        }

        world.atmH2 = M_H2;
        world.atmHe = M_He;
        world.atmN2 = M_N2;

        tResult(`Step 26 Components — ${label}`,
            `M_H2=${M_H2} | M_He=${M_He} | M_N2=${M_N2}`,
            'AoW Step 26');

        // World class assignment
        let worldClass;
        if (isDryGH) {
            worldClass = 'Class 1 (Venus-type)';
        } else if (M_H2 > 0) {
            worldClass = 'Class 2 (Dulcinea-type)';
        } else if (M_H2 === 0 && M_N2 > 0 && T_bb >= 80 && T_bb <= 125) {
            worldClass = 'Class 3 (Titan-type)';
        } else if (M_H2 === 0 && M_N2 > 0 && T_bb > 125) {
            worldClass = 'Class 4 (Earth-type)';
        } else if (M_H2 === 0 && M_He === 0 && M_N2 === 0 && M_num <= 44 && T_bb > 195) {
            worldClass = 'Class 5 (Mars-type)';
        } else {
            worldClass = 'Class 6 (Luna-type)';
        }

        world.worldClass = worldClass;

        tResult(`Step 26 World Class — ${label}`, worldClass, 'AoW Step 26');
    }

    function generateEarlyAtmosphere(sys) {
        tSection('AoW Chunk 7 (cont.): Early Atmosphere (Step 26)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 26 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 26: Node ${worksheet.label}...`);
            }
            stepEarlyAtmosphere(worksheet);
        }

        const classCounts = {};
        for (const ws of sys.diskWorksheets) {
            for (const p of ws.planets) {
                if (p.worldClass) classCounts[p.worldClass] = (classCounts[p.worldClass] || 0) + 1;
            }
        }
        tResult('Step 26 Complete', JSON.stringify(classCounts), 'AoW Step 26');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 26 complete: ${JSON.stringify(classCounts)}`);
        }
    }

    // =================================================================
    // STEP 27: ALBEDO
    //
    // Applies to terrestroid worlds and major satellites (same scope as
    // Steps 25–26). Gas Giants and Planetoid Belts are skipped.
    // Requires worldClass (Step 26) and waterPrevalence (Step 23).
    //
    // 1. Look up baseAlbedo from albedoTable by worldClass + waterPrevalence.
    //    worldClass stored as "Class N (Name)" but table keys are "Class N",
    //    so matching uses startsWith.
    //    Classes 1/2/3 → prevalence "Any" → flat baseAlbedo.
    //    Classes 4/5   → same rows in table; looked up by prevalence.
    //    Class 6       → looked up by prevalence.
    // 2. albedo = baseAlbedo + 3d6 × 0.01
    // 3. Class 6 only — apply one of three surface-rock/ice modifiers
    //    (else-if chain; only the first matching condition applies):
    //    A: Molten or Soft lithosphere                          → +0.5
    //    B: Early/Mature Plate, or Ancient Plate + Mobile       → +0.3
    //    C: (Ancient Plate + Fixed) or Solid, AND T_bb < 80     → +0.3
    // =================================================================

    function stepAlbedo(worksheet) {
        tSection(`AoW Step 27: Albedo — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 27 skipped');
            return;
        }

        function computeAlbedo(world, label) {
            if (!world.worldClass) {
                tSkip(`${label}: no worldClass — skipped`);
                return;
            }

            const wClass = world.worldClass;
            const wPrev  = world.waterPrevalence || 'Trace';

            const row = albedoTable.results.find(r => {
                const classMatch = Array.isArray(r.worldClass)
                    ? r.worldClass.some(wc => wClass.startsWith(wc))
                    : wClass.startsWith(r.worldClass);
                const prevMatch = r.prevalence === 'Any' || r.prevalence === wPrev;
                return classMatch && prevMatch;
            });

            if (!row) {
                tSkip(`${label}: no albedoTable row for worldClass="${wClass}" prevalence="${wPrev}"`);
                return;
            }

            const baseAlbedo = row.baseAlbedo;
            const dieRoll    = roll3D6();
            let albedo       = baseAlbedo + dieRoll * 0.01;

            tResult(`${label} Albedo`,
                `baseAlbedo=${baseAlbedo}, 3d6=${dieRoll} → ${albedo.toFixed(4)} (${wClass}, ${wPrev})`,
                'AoW Step 27');

            // Class 6 surface modifier (else-if: only first matching condition applies)
            if (wClass.startsWith('Class 6')) {
                const litho     = world.lithosphere    || '';
                const tectonics = world.plateTectonics || '';
                const T_bb      = world.tBb            || 0;

                if (litho === 'Molten Lithosphere' || litho === 'Soft Lithosphere') {
                    albedo += 0.5;
                    tResult(`${label} Albedo Class 6 mod (A)`,
                        `${litho} → +0.5 → ${albedo.toFixed(4)}`,
                        'AoW Step 27');
                } else if (
                    litho === 'Early Plate Lithosphere' ||
                    litho === 'Mature Plate Lithosphere' ||
                    (litho === 'Ancient Plate Lithosphere' && tectonics === 'Mobile')
                ) {
                    albedo += 0.3;
                    tResult(`${label} Albedo Class 6 mod (B)`,
                        `${litho}${tectonics ? ' / ' + tectonics : ''} → +0.3 → ${albedo.toFixed(4)}`,
                        'AoW Step 27');
                } else if (
                    (litho === 'Ancient Plate Lithosphere' && tectonics === 'Fixed') ||
                    litho === 'Solid Lithosphere'
                ) {
                    if (T_bb < 80) {
                        albedo += 0.3;
                        tResult(`${label} Albedo Class 6 mod (C)`,
                            `${litho}, T_bb=${T_bb} < 80 → +0.3 → ${albedo.toFixed(4)}`,
                            'AoW Step 27');
                    } else {
                        tResult(`${label} Albedo Class 6 mod (C)`,
                            `${litho}, T_bb=${T_bb} ≥ 80 — no modifier`,
                            'AoW Step 27');
                    }
                }
            }

            world.albedo = albedo;
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') continue;
            if (planet.planetType && planet.planetType.includes('Gas Giant')) continue;

            computeAlbedo(planet, `Orbit ${planet.orbitNumber}`);

            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    computeAlbedo(planet.satellites[i], `Orbit ${planet.orbitNumber} Sat ${i + 1}`);
                }
            }
        }

        tResult('Step 27 Complete', 'Albedo assigned', 'AoW Step 27');
    }

    function generateAlbedo(sys) {
        tSection('AoW Chunk 7 (cont.): Albedo (Step 27)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 27 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 27: Node ${worksheet.label}...`);
            }
            stepAlbedo(worksheet);
        }

        const withAlbedo = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.albedo !== undefined).length, 0);

        tResult('Step 27 Complete', `${withAlbedo} world(s) with albedo assigned`, 'AoW Step 27');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 27 complete: albedo=${withAlbedo}`);
        }
    }

    // =================================================================
    // STEP 28: CARBON DIOXIDE
    //
    // Applies to terrestroid worlds and major satellites.
    // Gas Giants and Planetoid Belts are skipped.
    // Requires worldClass (Step 26), rFactor (Step 26), mNum/tBb (Step 22),
    // waterPrevalence (Step 23), albedo (Step 27).
    //
    // Class 6: skipped entirely (no significant atmosphere).
    // Class 1: M_CO2 = 100×R_factor ±10% (2 sig figs); no carbonate cycle (skip to Step 30).
    // Class 2 & 3: M_CO2 = 0; skip to Step 29.
    // Class 4 & 5: require M_num≤44 AND T_bb≥195.
    //   R_factor>0:           M_CO2 = R_factor ±10% (2 sig figs).
    //   R_factor=0, Class 5:  M_CO2 = 1d6×0.01 ±10% (2 sig figs).
    //   Otherwise:            M_CO2 = 0.
    //   Carbonate-silicate cycle test (M_CO2>0, Moderate/Extensive water, not Carbon Planet):
    //     T = B×(1−A)^0.25 + 8×log10(M_CO2) + 36
    //     floor(T) ≥ 260 → world.carbonateSilicateCycle = true
    //
    // NOTE: world.isCarbonPlanet is checked but no prior step currently sets it.
    //       When Carbon Planet determination is implemented it must set world.isCarbonPlanet=true.
    // =================================================================

    function stepCarbonDioxide(worksheet) {
        tSection(`AoW Step 28: Carbon Dioxide — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 28 skipped');
            return;
        }

        function computeCO2(world, label) {
            if (!world.worldClass) {
                tSkip(`${label}: no worldClass — skipped`);
                return;
            }

            const wClass  = world.worldClass;
            const T_bb    = world.tBb     || 0;
            const M_num   = world.mNum    || 999;
            const rFactor = world.rFactor || 0;

            // Class 6: no significant atmosphere
            if (wClass.startsWith('Class 6')) {
                tSkip(`${label}: Class 6 (Luna-type) — no atmosphere, skipping CO2`);
                return;
            }

            // Class 1: M_CO2 = 100 × R_factor ± 10%; no carbonate cycle
            if (wClass.startsWith('Class 1')) {
                const mCO2 = roundToSigFigs(100 * rFactor * (0.9 + rng() * 0.2), 2);
                world.mCO2 = mCO2;
                world.carbonateSilicateCycle = false;
                tResult(`${label} M_CO2 (Class 1)`,
                    `100 × ${rFactor} ± 10% = ${mCO2} | no carbonate cycle (skip to Step 30)`,
                    'AoW Step 28');
                return;
            }

            // Classes 2 & 3: M_CO2 = 0; skip to Step 29
            if (wClass.startsWith('Class 2') || wClass.startsWith('Class 3')) {
                world.mCO2 = 0;
                tResult(`${label} M_CO2 (${wClass})`, `0 (skip to Step 29)`, 'AoW Step 28');
                return;
            }

            // Classes 4 & 5
            let mCO2 = 0;
            if (M_num > 44 || T_bb < 195) {
                tResult(`${label} M_CO2 (Class 4/5)`,
                    `M_num=${M_num}, T_bb=${T_bb} — fails M_num≤44 AND T_bb≥195 → M_CO2=0`,
                    'AoW Step 28');
            } else if (rFactor > 0) {
                mCO2 = roundToSigFigs(rFactor * (0.9 + rng() * 0.2), 2);
                tResult(`${label} M_CO2 (Class 4/5, R>0)`,
                    `R_factor=${rFactor} ± 10% = ${mCO2}`,
                    'AoW Step 28');
            } else if (wClass.startsWith('Class 5')) {
                const dieRoll = rollD6();
                mCO2 = roundToSigFigs(dieRoll * 0.01 * (0.9 + rng() * 0.2), 2);
                tResult(`${label} M_CO2 (Class 5, R=0)`,
                    `1d6=${dieRoll} × 0.01 ± 10% = ${mCO2}`,
                    'AoW Step 28');
            } else {
                tResult(`${label} M_CO2 (Class 4, R=0)`, `R_factor=0 → M_CO2=0`, 'AoW Step 28');
            }

            world.mCO2 = mCO2;

            // Carbonate-silicate cycle test
            if (mCO2 <= 0) {
                world.carbonateSilicateCycle = false;
                tSkip(`${label}: M_CO2=${mCO2} — no carbonate cycle`);
                return;
            }

            const wPrev = world.waterPrevalence || 'None';
            if (wPrev !== 'Moderate' && wPrev !== 'Extensive') {
                world.carbonateSilicateCycle = false;
                tResult(`${label} Carbonate Cycle`,
                    `waterPrevalence=${wPrev} (need Moderate or Extensive) → inactive`,
                    'AoW Step 28');
                return;
            }

            if (world.isCarbonPlanet === true) {
                world.carbonateSilicateCycle = false;
                tResult(`${label} Carbonate Cycle`, `Carbon Planet → inactive`, 'AoW Step 28');
                return;
            }

            const A       = world.albedo || 0;
            const B       = T_bb;
            const T       = B * Math.pow(1 - A, 0.25) + 8.0 * Math.log10(mCO2) + 36.0;
            const T_floor = Math.floor(T);

            world.carbonateSilicateCycle = T_floor >= 260;
            tResult(`${label} Carbonate-Silicate Cycle`,
                `T = ${B}×(1-${A.toFixed(4)})^0.25 + 8×log10(${mCO2}) + 36 = ${T.toFixed(3)} → ⌊T⌋=${T_floor} ${world.carbonateSilicateCycle ? '≥ 260 → ACTIVE' : '< 260 → inactive'}`,
                'AoW Step 28');
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') continue;
            if (planet.planetType && planet.planetType.includes('Gas Giant')) continue;

            computeCO2(planet, `Orbit ${planet.orbitNumber}`);

            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    computeCO2(planet.satellites[i], `Orbit ${planet.orbitNumber} Sat ${i + 1}`);
                }
            }
        }

        tResult('Step 28 Complete', 'CO2 and carbonate-silicate cycle assigned', 'AoW Step 28');
    }

    function generateCarbonDioxide(sys) {
        tSection('AoW Chunk 7 (cont.): Carbon Dioxide (Step 28)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 28 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 28: Node ${worksheet.label}...`);
            }
            stepCarbonDioxide(worksheet);
        }

        const withCO2 = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.mCO2 !== undefined).length, 0);
        const activeCycle = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.carbonateSilicateCycle === true).length, 0);

        tResult('Step 28 Complete',
            `${withCO2} world(s) with M_CO2 | ${activeCycle} with active carbonate-silicate cycle`,
            'AoW Step 28');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 28 complete: mCO2=${withCO2}, activeCycle=${activeCycle}`);
        }
    }

    // =================================================================
    // STEP 29: PRESENCE OF LIFE
    //
    // Applies to terrestroid worlds and major satellites.
    // Gas Giants and Planetoid Belts are skipped.
    // Class 1 (Venus-type) worlds are skipped (Step 28 directed them to Step 30).
    //
    // All time values are in millions of years (Myr).
    // sys.systemAge is in Gyr; comparison uses sys.systemAge × 1000.
    //
    // Photosynthesis star: most luminous focal star capable of driving photosynthesis.
    // For P-type nodes, this is the primary of the binary pair.
    // L-, T-, and Y-class brown dwarfs have cooled to infrared-only emission; they
    // cannot drive photosynthesis. M-class brown dwarfs (hottest/youngest) still emit
    // some visible light and are eligible. If all focal stars are L/T/Y BDs,
    // photosynthesis is impossible; this is flagged on each world as noPhotosynthesisBD.
    // White dwarfs: spectral type is derived from initialMass →
    //   mainSequenceStellarCharacteristicsTable → initialEffectiveTemperature →
    //   spectralTypeTable → original main-sequence classification.
    //
    // Events:
    //   T_deep:       deep hydrothermal abiogenesis (Myr or Infinity)
    //   T_surface:    surface refugia abiogenesis (Myr or Infinity)
    //   T_multi:      multicellular life (always calculated past lifeless check)
    //   T_photo:      photosynthesis (requires T_surface ≤ systemAge, non-L/T/Y-BD star)
    //   T_oxy:        oxygen catastrophe (requires T_photo ≤ systemAge)
    //   T_animal:     animal life (requires T_multi ≤ systemAge; oxygen-accelerated if T_base > T_oxy)
    //   T_presapient: pre-sapient life (requires T_animal ≤ systemAge)
    //   M_O2:         free atmospheric oxygen (Case A/B/C)
    // =================================================================

    function stepPresenceOfLife(worksheet, sys) {
        tSection(`AoW Step 29: Presence of Life — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 29 skipped');
            return;
        }

        const systemAgeMyr = (sys.systemAge || 0) * 1000;
        tResult('System Age (Myr)', `${sys.systemAge || 0} Gyr = ${systemAgeMyr} Myr`, 'AoW Step 29');

        // ── Photosynthesis star selection ─────────────────────────────────
        // Most luminous focal star capable of visible-light photosynthesis.
        // L/T/Y-class BDs emit only infrared; M-class BDs are warm enough to qualify.
        const nonBDStars = worksheet.focalStars.filter(s => {
            if (s.state !== 'Brown Dwarf') return true;
            const bdLetter = (s.spectralClassification || '').charAt(0).toUpperCase();
            return bdLetter === 'M';
        });
        const photosynthesisStar = nonBDStars.length > 0
            ? nonBDStars.reduce((a, b) => (a.luminosity || 0) >= (b.luminosity || 0) ? a : b)
            : null;

        // Flag set when photosynthesis is impossible specifically due to an L/T/Y BD primary.
        const ltyBDPrimary = photosynthesisStar === null &&
            worksheet.focalStars.some(s => {
                if (s.state !== 'Brown Dwarf') return false;
                const l = (s.spectralClassification || '').charAt(0).toUpperCase();
                return l === 'L' || l === 'T' || l === 'Y';
            });

        // Map focal star to photosynthesis timescale (Myr per roll-unit)
        function getPhotosynthesisTimescale(star) {
            let typeStr;
            if (star.state === 'White Dwarf') {
                // Derive original spectral type from initialMass
                const msRows = mainSequenceStellarCharacteristicsTable.results;
                let msEntry = msRows[0];
                for (const row of msRows) {
                    if (Math.abs(row.mass - star.initialMass) < Math.abs(msEntry.mass - star.initialMass)) {
                        msEntry = row;
                    }
                }
                const spRows = spectralTypeTable.results;
                let spEntry = spRows[0];
                for (const sp of spRows) {
                    if (Math.abs(sp.temperature - msEntry.initialEffectiveTemperature) <
                        Math.abs(spEntry.temperature - msEntry.initialEffectiveTemperature)) {
                        spEntry = sp;
                    }
                }
                typeStr = spEntry.type; // e.g. "G2"
                tResult('Photosynthesis Star (WD original type)',
                    `initialMass=${star.initialMass} → T_init=${msEntry.initialEffectiveTemperature} K → ${typeStr}`,
                    'AoW Step 29');
            } else {
                typeStr = star.spectralClassification || '';
            }

            const letter = typeStr.charAt(0).toUpperCase();
            const sub    = typeStr.match(/^[A-Za-z](\d)/);
            const subtype = sub ? parseInt(sub[1]) : 0;

            if (letter === 'A' || letter === 'F') return 100;
            if (letter === 'G') return subtype <= 7 ? 100 : 105;
            if (letter === 'K') {
                const kMap = [110, 115, 120, 130, 145, 160, 180, 210, 240, 270];
                return kMap[subtype] !== undefined ? kMap[subtype] : 270;
            }
            if (letter === 'M') return 300;
            return 100; // fallback for any unlisted class
        }

        const timescale = photosynthesisStar ? getPhotosynthesisTimescale(photosynthesisStar) : null;

        if (photosynthesisStar) {
            tResult('Photosynthesis Star',
                `${photosynthesisStar.label} (${photosynthesisStar.spectralClassification || photosynthesisStar.state}) | timescale=${timescale} Myr/roll`,
                'AoW Step 29');
        } else {
            const noPhotoReason = ltyBDPrimary
                ? `L/T/Y-class brown dwarf primary (${worksheet.focalStars.map(s => s.spectralClassification || s.state).join(', ')}) — no visible light`
                : 'no qualifying focal star';
            tResult('Photosynthesis Star', `None — ${noPhotoReason}; photosynthesis impossible`, 'AoW Step 29');
        }

        const ACTIVE_LITHOS = new Set(['Soft Lithosphere', 'Early Plate Lithosphere', 'Mature Plate Lithosphere', 'Ancient Plate Lithosphere']);
        const WATER_BIOGEN  = new Set(['Moderate', 'Extensive', 'Massive']);

        function processWorld(world, label) {
            if (!world.worldClass) {
                tSkip(`${label}: no worldClass — skipped`);
                return;
            }

            // Class 1 was directed to Step 30 by Step 28
            if (world.worldClass.startsWith('Class 1')) {
                tSkip(`${label}: Class 1 (Venus-type) — skip to Step 30`);
                return;
            }

            tSection(`AoW Step 29: Life Timeline — ${label}`);

            const wClass    = world.worldClass;
            const wPrev     = world.waterPrevalence          || 'None';
            const litho     = world.lithosphere              || '';
            const tectonics = world.plateTectonics           || '';
            const isDryGH   = world.isRunawayDryGreenhouse   || false;
            const isWetGH   = world.isRunawayWetGreenhouse   || false;
            const carbSil   = world.carbonateSilicateCycle   === true;

            // ── 1. DEEP ABIOGENESIS ──────────────────────────────────────
            const deepOk = !isDryGH && !isWetGH &&
                WATER_BIOGEN.has(wPrev) &&
                ACTIVE_LITHOS.has(litho) &&
                tectonics === 'Mobile';

            let tDeep;
            if (deepOk) {
                const r = roll3D6();
                tDeep = r * 30;
                tResult(`${label} T_deep`, `Conditions met | 3d6=${r} × 30 = ${tDeep} Myr`, 'AoW Step 29');
            } else {
                tDeep = Infinity;
                const why = [
                    (isDryGH || isWetGH)          ? 'runaway-GH'            : null,
                    !WATER_BIOGEN.has(wPrev)       ? `water=${wPrev}`        : null,
                    !ACTIVE_LITHOS.has(litho)      ? `litho=${litho}`        : null,
                    tectonics !== 'Mobile'         ? `tectonics=${tectonics}`: null
                ].filter(Boolean).join(', ');
                tResult(`${label} T_deep`, `Conditions not met (${why}) → ∞`, 'AoW Step 29');
            }
            world.tDeep = tDeep;

            // ── 2. SURFACE REFUGIA ───────────────────────────────────────
            const surfaceOk = wClass.startsWith('Class 4') &&
                carbSil &&
                ACTIVE_LITHOS.has(litho);

            let tSurface;
            if (surfaceOk) {
                const useFast  = (litho === 'Soft Lithosphere' || tectonics === 'Mobile');
                const mult     = useFast ? 100 : 200;
                const baseRoll = roll3D6();
                const baseSurface = baseRoll * mult;
                tResult(`${label} Base_Surface`,
                    `3d6=${baseRoll} × ${mult} = ${baseSurface} Myr (${useFast ? 'Soft/Mobile' : 'non-Soft Fixed'})`,
                    'AoW Step 29');

                let altSurface = Infinity;
                if (tDeep !== Infinity) {
                    const altRoll = roll3D6();
                    altSurface = tDeep + altRoll * 75;
                    tResult(`${label} Alt_Surface (Deep Accelerator)`,
                        `T_deep=${tDeep} + 3d6=${altRoll} × 75 = ${altSurface} Myr`,
                        'AoW Step 29');
                }

                tSurface = Math.min(baseSurface, altSurface);
                tResult(`${label} T_surface`,
                    `min(${baseSurface}, ${altSurface === Infinity ? '∞' : altSurface}) = ${tSurface} Myr`,
                    'AoW Step 29');
            } else {
                tSurface = Infinity;
                const why = [
                    !wClass.startsWith('Class 4') ? `class=${wClass}`    : null,
                    !carbSil                       ? 'no-carbSilCycle'   : null,
                    !ACTIVE_LITHOS.has(litho)      ? `litho=${litho}`    : null
                ].filter(Boolean).join(', ');
                tResult(`${label} T_surface`, `Conditions not met (${why}) → ∞`, 'AoW Step 29');
            }
            world.tSurface = tSurface;

            // ── 3. LIFELESS WORLD CHECK ──────────────────────────────────
            const deepOccurred    = tDeep    <= systemAgeMyr;
            const surfaceOccurred = tSurface <= systemAgeMyr;

            if (!deepOccurred && !surfaceOccurred) {
                world.isLifeless = true;
                world.mO2 = 0;
                tResult(`${label} LIFELESS`,
                    `T_deep=${tDeep === Infinity ? '∞' : tDeep} Myr, T_surface=${tSurface === Infinity ? '∞' : tSurface} Myr — both > ${systemAgeMyr} Myr → barren`,
                    'AoW Step 29');
                return;
            }
            world.isLifeless = false;

            // ── 4. MULTICELLULAR LIFE ────────────────────────────────────
            // Condition implicitly satisfied (past lifeless check).
            // Formula uses raw min(T_deep, T_surface); Infinity is handled
            // correctly by Math.min (min(x, Infinity) = x).
            const tLifeOrigin = Math.min(tDeep, tSurface);
            const multiRoll   = roll3D6();
            const tMulti      = tLifeOrigin + multiRoll * 75;
            world.tMulti = tMulti;
            tResult(`${label} T_multi`,
                `min(T_deep, T_surface)=${tLifeOrigin} + 3d6=${multiRoll} × 75 = ${tMulti} Myr`,
                'AoW Step 29');

            // ── 5. PHOTOSYNTHESIS ────────────────────────────────────────
            // Condition: T_surface ≤ systemAge AND a qualifying focal star exists
            let tPhoto = Infinity;
            if (surfaceOccurred && photosynthesisStar !== null) {
                const photoRoll = roll3D6();
                tPhoto = tSurface + photoRoll * timescale;
                tResult(`${label} T_photo`,
                    `T_surface=${tSurface} + 3d6=${photoRoll} × ${timescale} = ${tPhoto} Myr`,
                    'AoW Step 29');
            } else {
                const why = !surfaceOccurred ? 'no surface life yet'
                          : ltyBDPrimary      ? 'L/T/Y-class brown dwarf primary — no visible light'
                          :                     'no qualifying star';
                tResult(`${label} T_photo`, `Conditions not met (${why}) → ∞`, 'AoW Step 29');
            }
            world.tPhoto = tPhoto;
            world.noPhotosynthesisBD = ltyBDPrimary ? true : undefined;

            // ── 6. ADVANCED LIFE ─────────────────────────────────────────

            // Oxygen Catastrophe: condition = photosynthesis occurred (T_photo ≤ systemAge)
            let tOxy = Infinity;
            if (tPhoto <= systemAgeMyr) {
                const oxyRoll = roll3D6();
                tOxy = tPhoto + oxyRoll * 1.5 * timescale;
                tResult(`${label} T_oxy`,
                    `T_photo=${tPhoto} + 3d6=${oxyRoll} × 1.5 × ${timescale} = ${tOxy} Myr`,
                    'AoW Step 29');
            } else {
                tResult(`${label} T_oxy`, `Photosynthesis not yet / not possible → ∞`, 'AoW Step 29');
            }
            world.tOxy = tOxy;

            // Animal Life: condition = multicellular life occurred (T_multi ≤ systemAge)
            // Oxygen Acceleration: if T_animal_base > T_oxy (even if T_oxy > systemAge),
            // subtract half the difference. T_oxy = Infinity makes the condition false.
            let tAnimal = Infinity;
            if (tMulti <= systemAgeMyr) {
                const animalRoll  = roll3D6();
                const tAnimalBase = tMulti + animalRoll * 300;
                tResult(`${label} T_animal_base`,
                    `T_multi=${tMulti} + 3d6=${animalRoll} × 300 = ${tAnimalBase} Myr`,
                    'AoW Step 29');

                if (tAnimalBase > tOxy) {
                    tAnimal = tAnimalBase - (tAnimalBase - tOxy) / 2;
                    tResult(`${label} T_animal`,
                        `Oxygen acceleration: ${tAnimalBase} − (${tAnimalBase}−${tOxy})/2 = ${tAnimal.toFixed(1)} Myr`,
                        'AoW Step 29');
                } else {
                    tAnimal = tAnimalBase;
                    tResult(`${label} T_animal`, `${tAnimal} Myr (no oxygen acceleration)`, 'AoW Step 29');
                }
            } else {
                tResult(`${label} T_animal`,
                    `Multicellular life not yet (T_multi=${tMulti} > ${systemAgeMyr} Myr) → ∞`,
                    'AoW Step 29');
            }
            world.tAnimal = tAnimal;

            // Pre-Sapient Life: condition = animal life occurred (T_animal ≤ systemAge)
            let tPresapient = Infinity;
            if (tAnimal <= systemAgeMyr) {
                const preRoll = roll3D6();
                tPresapient = tAnimal + preRoll * 50;
                tResult(`${label} T_presapient`,
                    `T_animal=${tAnimal.toFixed(1)} + 3d6=${preRoll} × 50 = ${tPresapient.toFixed(1)} Myr`,
                    'AoW Step 29');
            } else {
                tResult(`${label} T_presapient`,
                    `Animal life not yet (T_animal=${tAnimal === Infinity ? '∞' : tAnimal.toFixed(1)} > ${systemAgeMyr} Myr) → ∞`,
                    'AoW Step 29');
            }
            world.tPresapient = tPresapient;

            // ── 7. ATMOSPHERIC FREE OXYGEN ───────────────────────────────
            const photoOccurred = tPhoto <= systemAgeMyr;
            const oxyOccurred   = tOxy   <= systemAgeMyr;
            let mO2 = 0;

            if (!photoOccurred) {
                // Case A: No photosynthesis
                mO2 = 0;
                tResult(`${label} M_O2 (Case A)`, `No photosynthesis → 0`, 'AoW Step 29');
            } else if (!oxyOccurred) {
                // Case B: Photosynthesis, but no oxygen catastrophe yet
                const o2Roll = roll3D6();
                mO2 = roundToSigFigs(o2Roll * 0.002, 2);
                tResult(`${label} M_O2 (Case B)`,
                    `Photosynthesis, no catastrophe | 3d6=${o2Roll} × 0.002 = ${mO2}`,
                    'AoW Step 29');
            } else {
                // Case C: Oxygen catastrophe (core rules: +10)
                const o2Roll = roll3D6();
                mO2 = roundToSigFigs((o2Roll + 10) * 0.01 * (world.rFactor || 0), 2);
                tResult(`${label} M_O2 (Case C)`,
                    `Oxygen catastrophe | (3d6=${o2Roll}+10) × 0.01 × R_factor=${world.rFactor || 0} = ${mO2}`,
                    'AoW Step 29');
            }
            world.mO2 = mO2;

            // Life event summary
            const events = [
                deepOccurred             ? `Deep(${tDeep})`                  : null,
                surfaceOccurred          ? `Surface(${tSurface})`            : null,
                tMulti  <= systemAgeMyr  ? `Multi(${Math.round(tMulti)})`    : null,
                photoOccurred            ? `Photo(${Math.round(tPhoto)})`    : null,
                oxyOccurred              ? `O2Cat(${Math.round(tOxy)})`      : null,
                tAnimal <= systemAgeMyr  ? `Animal(${Math.round(tAnimal)})`  : null,
                tPresapient <= systemAgeMyr ? `PreSapient(${Math.round(tPresapient)})` : null
            ].filter(Boolean);
            tResult(`${label} Life Summary (Myr)`,
                events.length > 0 ? events.join(' → ') : 'Life started, no further events yet',
                'AoW Step 29');
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') continue;
            if (planet.planetType && planet.planetType.includes('Gas Giant')) continue;

            processWorld(planet, `Orbit ${planet.orbitNumber}`);

            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    processWorld(planet.satellites[i], `Orbit ${planet.orbitNumber} Sat ${i + 1}`);
                }
            }
        }

        tResult('Step 29 Complete', 'Life timelines assigned', 'AoW Step 29');
    }

    function generatePresenceOfLife(sys) {
        tSection('AoW Chunk 7 (cont.): Presence of Life (Step 29)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 29 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 29: Node ${worksheet.label}...`);
            }
            stepPresenceOfLife(worksheet, sys);
        }

        const withLife       = sys.diskWorksheets.reduce((sum, ws) => sum + ws.planets.filter(p => p.isLifeless === false).length, 0);
        const lifeless       = sys.diskWorksheets.reduce((sum, ws) => sum + ws.planets.filter(p => p.isLifeless === true).length, 0);
        const withPresapient = sys.diskWorksheets.reduce((sum, ws) => sum + ws.planets.filter(p =>
            p.tPresapient !== undefined && p.tPresapient <= (sys.systemAge || 0) * 1000).length, 0);

        tResult('Step 29 Complete',
            `${withLife} world(s) with life | ${lifeless} lifeless | ${withPresapient} with pre-sapients`,
            'AoW Step 29');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 29 complete: withLife=${withLife}, lifeless=${lifeless}, preSapient=${withPresapient}`);
        }
    }

    // =================================================================
    // STEP 30: AVERAGE SURFACE TEMPERATURE
    //
    // Applies to terrestroid worlds and major satellites.
    // Gas Giants and Planetoid Belts are skipped.
    //
    // Case A: Class 1 (Venus-type):
    //   T = (B*(1-A)^0.25) + (250*log10(M_CO2))   [2 sig figs]
    // Case B: Class 2 (Dulcinea-type):
    //   T = (B*(1-A)^0.25) + (K*log10(M_H2))      [2 sig figs]
    //   K = 500 if runaway wet greenhouse, else 180
    // Case C: Class 6 (Luna-type):
    //   T = B*(1-A)^0.25                           [nearest integer]
    // Case D: Classes 3, 4, 5 — cumulative greenhouse buildup:
    //   T0  = B*(1-A)^0.25              [nearest integer]
    //   G_CH4 — methane (if conditions met)
    //   G_O3  — ozone   (if oxygen catastrophe occurred)
    //   T1  = T0 + G_CH4 + G_O3
    //   G_CO2 — active cycle derives new M_CO2; inactive cycle uses Step 28 value
    //   T2  = T1 + G_CO2
    //   G_H2O — water vapor (if conditions met)
    //   T   = T2 + G_H2O
    //
    // Snowball condition: active carbonate cycle AND T2 < 260 K
    // =================================================================

    function stepAverageSurfaceTemp(worksheet, sys) {
        tSection(`AoW Step 30: Average Surface Temperature — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 30 skipped');
            return;
        }

        const systemAgeMyr = (sys.systemAge || 0) * 1000;

        function computeTemp(world, label) {
            if (world.vaporized || !world.worldClass || world.albedo === undefined) {
                tSkip(`${label}: vaporized or missing worldClass/albedo — skipped`);
                return;
            }

            const B      = world.tBb;
            const A      = world.albedo;
            const wClass = world.worldClass;
            world.hasMethaneTrace = false;
            world.hasOzoneTrace   = false;

            // ── Case A: Class 1 (Venus-type) ──────────────────────────────
            if (wClass.startsWith('Class 1')) {
                const mCO2 = world.mCO2 || 0;
                if (mCO2 <= 0) {
                    tSkip(`${label}: Class 1 but M_CO2=${mCO2} — skipped`);
                    return;
                }
                const T = roundToSigFigs(B * Math.pow(1 - A, 0.25) + 250 * Math.log10(mCO2), 2);
                world.avgSurfaceTemp = T;
                tResult(`${label} Step 30 (Class 1)`,
                    `T = ${B}×(1-${A.toFixed(4)})^0.25 + 250×log10(${mCO2}) = ${T} K`,
                    'AoW Step 30');
                return;
            }

            // ── Case B: Class 2 (Dulcinea-type) ──────────────────────────
            if (wClass.startsWith('Class 2')) {
                const M_H2 = world.atmH2 || 0;
                if (M_H2 <= 0) {
                    tSkip(`${label}: Class 2 but M_H2=${M_H2} — skipped`);
                    return;
                }
                const K = world.isRunawayWetGreenhouse ? 500 : 180;
                const T = roundToSigFigs(B * Math.pow(1 - A, 0.25) + K * Math.log10(M_H2), 2);
                world.avgSurfaceTemp = T;
                tResult(`${label} Step 30 (Class 2)`,
                    `K=${K} | T = ${B}×(1-${A.toFixed(4)})^0.25 + ${K}×log10(${M_H2}) = ${T} K`,
                    'AoW Step 30');
                return;
            }

            // ── Case C: Class 6 (Luna-type) ──────────────────────────────
            if (wClass.startsWith('Class 6')) {
                const T = Math.round(B * Math.pow(1 - A, 0.25));
                world.avgSurfaceTemp = T;
                tResult(`${label} Step 30 (Class 6)`,
                    `T = round(${B}×(1-${A.toFixed(4)})^0.25) = ${T} K`,
                    'AoW Step 30');
                return;
            }

            // ── Case D: Classes 3, 4, 5 ──────────────────────────────────

            // 1. Base Surface Temperature T0
            const T0 = Math.round(B * Math.pow(1 - A, 0.25));
            tResult(`${label} T0`,
                `round(${B}×(1-${A.toFixed(4)})^0.25) = ${T0} K`,
                'AoW Step 30');

            // 2. Methane (CH4)
            const deepAbiogenesis    = world.tDeep    !== undefined && world.tDeep    <= systemAgeMyr;
            const surfaceAbiogenesis = world.tSurface  !== undefined && world.tSurface <= systemAgeMyr;
            const methaneCondition   = world.mNum <= 16 && world.tBb >= 110 &&
                (wClass.startsWith('Class 3') ||
                 (wClass.startsWith('Class 4') && (deepAbiogenesis || surfaceAbiogenesis)));

            let G_CH4 = 0;
            if (methaneCondition) {
                G_CH4 = world.rFactor > 0
                    ? Math.max(0, Math.floor(2.1 + 8 * Math.log10(world.rFactor)))
                    : 0;
                tResult(`${label} G_CH4`,
                    `Condition met | floor(2.1 + 8×log10(${world.rFactor})) = ${G_CH4} K`,
                    'AoW Step 30');
            } else {
                tResult(`${label} G_CH4`, 'Condition not met → 0', 'AoW Step 30');
            }
            world.gCH4 = G_CH4;
            world.hasMethaneTrace = methaneCondition;

            // 3. Ozone (O3)
            const oxygenCatastrophe = world.tOxy !== undefined && world.tOxy <= systemAgeMyr;
            let G_O3 = 0;
            if (oxygenCatastrophe) {
                G_O3 = world.rFactor > 0
                    ? Math.max(0, Math.floor(1.7 + 8 * Math.log10(world.rFactor)))
                    : 0;
                tResult(`${label} G_O3`,
                    `Oxygen catastrophe occurred | floor(1.7 + 8×log10(${world.rFactor})) = ${G_O3} K`,
                    'AoW Step 30');
            } else {
                tResult(`${label} G_O3`, 'No oxygen catastrophe → 0', 'AoW Step 30');
            }
            world.gO3 = G_O3;
            world.hasOzoneTrace = oxygenCatastrophe;

            // 4. T1
            const T1 = T0 + G_CH4 + G_O3;
            tResult(`${label} T1`, `${T0} + ${G_CH4} + ${G_O3} = ${T1} K`, 'AoW Step 30');

            // 5. CO2
            let G_CO2 = 0;
            if (world.carbonateSilicateCycle) {
                const C          = 260 - T1;
                const requiredG  = Math.max(C, 8);
                const dieRoll    = roll2D6() - 7;
                G_CO2            = requiredG + dieRoll;
                const newMCO2    = roundToSigFigs(Math.pow(10, (G_CO2 - 36) / 8.0), 2);
                tResult(`${label} G_CO2 (active cycle)`,
                    `C=260-${T1}=${C}, max(C,8)=${requiredG}, 2d6-7=${dieRoll} → G_CO2=${G_CO2} → M_CO2=${newMCO2}`,
                    'AoW Step 30');
                world.mCO2 = newMCO2;
            } else {
                const mCO2 = world.mCO2 || 0;
                if (mCO2 > 0) {
                    G_CO2 = Math.round(36 + 8.0 * Math.log10(mCO2));
                    tResult(`${label} G_CO2 (no cycle)`,
                        `round(36 + 8×log10(${mCO2})) = ${G_CO2} K`,
                        'AoW Step 30');
                } else {
                    tResult(`${label} G_CO2 (no cycle)`, `M_CO2=${mCO2} → G_CO2=0`, 'AoW Step 30');
                }
            }
            world.gCO2 = G_CO2;

            // 6. T2
            const T2 = T1 + G_CO2;
            tResult(`${label} T2`, `${T1} + ${G_CO2} = ${T2} K`, 'AoW Step 30');

            // Snowball glaciation check
            if (world.carbonateSilicateCycle && T2 < 260) {
                world.isSnowball = true;
                tResult(`${label} SNOWBALL`,
                    `T2=${T2} K < 260 with active carbonate cycle → snowball glaciation era`,
                    'AoW Step 30');
            } else {
                world.isSnowball = false;
            }

            // 7. Water Vapor (H2O)
            const waterCondition = world.mNum <= 18 && world.tBb >= 260 &&
                ['Moderate', 'Extensive', 'Massive'].includes(world.waterPrevalence);

            let G_H2O = 0;
            let M_H2O = 0;

            if (!waterCondition) {
                tResult(`${label} G_H2O`, 'Condition not met → 0', 'AoW Step 30');
            } else {
                const wvRow     = waterVaporGreenhouseTable.results.find(r => T2 >= r.minT2 && T2 <= r.maxT2);
                const Base_GH2O = !wvRow                ? 0
                                : wvRow.isVariable      ? 34 + Math.floor((T2 - 319) / 5)
                                :                         wvRow.baseGH2O;
                const H         = (world.waterCoverage || 0) / 100;

                if (H <= 0) {
                    tSkip(`${label}: water condition met but coverage=0 — G_H2O=0`);
                } else {
                    const K_water = 4 + (10 * Math.log10(H));
                    G_H2O = Math.round(Base_GH2O + K_water);
                    M_H2O = roundToSigFigs(Math.pow(10, (G_H2O - 38.0) / 8.0), 2);
                    tResult(`${label} G_H2O`,
                        `Base_GH2O=${Base_GH2O} (T2=${T2}), H=${H.toFixed(4)}, K=${K_water.toFixed(3)}, G_H2O=round(${(Base_GH2O + K_water).toFixed(3)})=${G_H2O}, M_H2O=${M_H2O}`,
                        'AoW Step 30');
                }
            }
            world.gH2O = G_H2O;
            world.mH2O = M_H2O;

            // 8. Final Temperature
            const T = T2 + G_H2O;
            world.avgSurfaceTemp = T;
            tResult(`${label} Step 30 Final T`, `${T2} + ${G_H2O} = ${T} K`, 'AoW Step 30');
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') continue;
            if (planet.planetType && planet.planetType.includes('Gas Giant')) continue;

            computeTemp(planet, `Orbit ${planet.orbitNumber}`);

            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    computeTemp(planet.satellites[i], `Orbit ${planet.orbitNumber} Sat ${i + 1}`);
                }
            }
        }

        tResult('Step 30 Complete', 'Average surface temperatures assigned', 'AoW Step 30');
    }

    function generateAverageSurfaceTemp(sys) {
        tSection('AoW Chunk 7 (cont.): Average Surface Temperature (Step 30)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 30 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 30: Node ${worksheet.label}...`);
            }
            stepAverageSurfaceTemp(worksheet, sys);
        }

        const withTemp  = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.avgSurfaceTemp !== undefined).length, 0);
        const snowballs = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.isSnowball === true).length, 0);

        tResult('Step 30 Complete',
            `${withTemp} world(s) with average surface temperature | ${snowballs} snowball world(s)`,
            'AoW Step 30');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 30 complete: avgSurfaceTemp=${withTemp}, snowballs=${snowballs}`);
        }
    }

    // =================================================================
    // STEP 31: FINALIZE ATMOSPHERE
    //
    // Applies to terrestroid worlds and major satellites.
    // Class 6 (Luna-type) worlds are skipped — no significant atmosphere.
    // Gas Giants and Planetoid Belts are skipped.
    //
    // 1. M_A = M_H2 + M_He + M_N2 + M_CO2 + M_O2 + M_H2O  [2 sig figs]
    //    CH4 and O3 are trace-only; noted via hasMethaneTrace/hasOzoneTrace
    //    flags set in Step 30 — they do not contribute to M_A.
    // 2. P = M_A × G  [sea-level pressure, 3 sig figs]
    //    Partial pressures pO2, pN2, pCO2 computed the same way.
    // 3. Breathability: O2 ∈ [0.120, 0.300], CO2 ≤ 0.015, N2 ≤ 4.0 atm.
    //    world.breathability is an array of issue strings; empty = breathable.
    // 4. Average molecular mass K_mol = weighted sum / M_A.
    //    Scale height H = 0.856 × T / (K_mol × G)  [km, 3 sig figs]
    // =================================================================

    function stepFinalizeAtmosphere(worksheet) {
        tSection(`AoW Step 31: Finalize Atmosphere — Node ${worksheet.label}`);

        if (!worksheet.planets || worksheet.planets.length === 0) {
            tSkip('No planets — Step 31 skipped');
            return;
        }

        function computeAtmosphere(world, label) {
            if (world.vaporized || !world.worldClass) {
                tSkip(`${label}: vaporized or missing worldClass — skipped`);
                return;
            }

            // Class 6: no significant atmosphere
            if (world.worldClass.startsWith('Class 6')) {
                world.totalAtmMass  = 0;
                world.atmPressure   = 0;
                world.pO2           = 0;
                world.pN2           = 0;
                world.pCO2          = 0;
                world.breathability = ['No Atmosphere'];
                world.isBreathable  = false;
                world.avgMolMass    = null;
                world.scaleHeight   = null;
                tSkip(`${label}: Class 6 (Luna-type) — no significant atmosphere`);
                return;
            }

            // 1. Total Atmospheric Mass
            const M_H2  = world.atmH2  || 0;
            const M_He  = world.atmHe  || 0;
            const M_N2  = world.atmN2  || 0;
            const M_CO2 = world.mCO2   || 0;
            const M_O2  = world.mO2    || 0;
            const M_H2O = world.mH2O   || 0;

            const M_A = roundToSigFigs(M_H2 + M_He + M_N2 + M_CO2 + M_O2 + M_H2O, 2);
            world.totalAtmMass = M_A;

            tResult(`${label} M_A`,
                `H2=${M_H2} + He=${M_He} + N2=${M_N2} + CO2=${M_CO2} + O2=${M_O2} + H2O=${M_H2O} = ${M_A}`,
                'AoW Step 31');
            if (world.hasMethaneTrace) tResult(`${label} Trace CH4`, 'Present in trace amounts', 'AoW Step 31');
            if (world.hasOzoneTrace)   tResult(`${label} Trace O3`,  'Present in trace amounts', 'AoW Step 31');

            // 2. Pressure and Partial Pressures
            const G = world.surfaceGravity || 1;

            const P    = roundToSigFigs(M_A  * G, 3);
            const pO2  = roundToSigFigs(M_O2  * G, 3);
            const pN2  = roundToSigFigs(M_N2  * G, 3);
            const pCO2 = roundToSigFigs(M_CO2 * G, 3);

            world.atmPressure = P;
            world.pO2         = pO2;
            world.pN2         = pN2;
            world.pCO2        = pCO2;

            tResult(`${label} Pressure`,
                `P=${P} atm | pO2=${pO2} | pN2=${pN2} | pCO2=${pCO2} (G=${G})`,
                'AoW Step 31');

            // 3. Breathability
            const issues = [];
            if (pO2 < 0.120) {
                issues.push('Requires Respirator (Low O2)');
            } else if (pO2 > 0.300) {
                issues.push('Requires Filter (High O2, Fire Risk)');
            }
            if (pCO2 > 0.015) {
                issues.push('Requires Filter (High CO2)');
            }
            if (pN2 > 4.0) {
                issues.push('Requires Reducing Respirator (Nitrogen Narcosis)');
            }
            world.breathability = issues;
            world.isBreathable  = issues.length === 0;
            tResult(`${label} Breathability`,
                world.isBreathable ? 'Breathable' : issues.join(' | '),
                'AoW Step 31');

            // 4. Average Molecular Mass and Scale Height
            if (M_A <= 0) {
                world.avgMolMass  = null;
                world.scaleHeight = null;
                tSkip(`${label}: M_A=0 — scale height skipped`);
                return;
            }

            const K_mol = ((2 * M_H2) + (4 * M_He) + (28 * M_N2) + (32 * M_O2) + (44 * M_CO2) + (18 * M_H2O)) / M_A;
            world.avgMolMass = roundToSigFigs(K_mol, 3);

            const T = world.avgSurfaceTemp || 0;
            if (T <= 0 || G <= 0) {
                world.scaleHeight = null;
                tSkip(`${label}: T=${T} or G=${G} ≤ 0 — scale height skipped`);
                return;
            }

            const H = roundToSigFigs(0.856 * (T / (K_mol * G)), 3);
            world.scaleHeight = H;
            tResult(`${label} Scale Height`,
                `K_mol=${world.avgMolMass}, T=${T} K, G=${G} g | H = 0.856 × ${T} / (${world.avgMolMass} × ${G}) = ${H} km`,
                'AoW Step 31');
        }

        for (const planet of worksheet.planets) {
            if (planet.planetType === 'Planetoid Belt') continue;
            if (planet.planetType && planet.planetType.includes('Gas Giant')) continue;

            computeAtmosphere(planet, `Orbit ${planet.orbitNumber}`);

            if (planet.satellites) {
                for (let i = 0; i < planet.satellites.length; i++) {
                    computeAtmosphere(planet.satellites[i], `Orbit ${planet.orbitNumber} Sat ${i + 1}`);
                }
            }
        }

        tResult('Step 31 Complete', 'Atmospheres finalized', 'AoW Step 31');
    }

    function generateFinalizeAtmosphere(sys) {
        tSection('AoW Chunk 7 (cont.): Finalize Atmosphere (Step 31)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — Step 31 skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] Step 31: Node ${worksheet.label}...`);
            }
            stepFinalizeAtmosphere(worksheet);
        }

        const withAtm   = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.totalAtmMass !== undefined && p.totalAtmMass > 0).length, 0);
        const breathable = sys.diskWorksheets.reduce(
            (sum, ws) => sum + ws.planets.filter(p => p.isBreathable === true).length, 0);

        tResult('Step 31 Complete',
            `${withAtm} world(s) with atmosphere | ${breathable} breathable`,
            'AoW Step 31');

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Step 31 complete: withAtmosphere=${withAtm}, breathable=${breathable}`);
        }
    }

    // =================================================================
    // STEP 31 UTILITIES: ALTITUDE / PRESSURE HELPERS
    //
    // These are post-generation query functions for a finalized world.
    // calculatePressureAtAltitude(world, altKm)  → pressure in atm
    // calculateAltitudeForPressure(world, target) → altitude in km
    // =================================================================

    function calculatePressureAtAltitude(world, altKm) {
        if (!world.atmPressure || !world.scaleHeight || world.scaleHeight <= 0) return null;
        return world.atmPressure * Math.exp(-altKm / world.scaleHeight);
    }

    function calculateAltitudeForPressure(world, targetPressure) {
        if (!world.atmPressure || !world.scaleHeight || world.scaleHeight <= 0) return null;
        if (targetPressure <= 0 || world.atmPressure <= 0) return null;
        return world.scaleHeight * (Math.log(world.atmPressure) - Math.log(targetPressure));
    }

    // =================================================================
    // UWP PHYSICAL CODE CLASSIFIERS
    //
    // Each classifier maps AoW physical data to a single MgT2E-style
    // hex digit. generateUWPPhysicals(sys) applies all three to every
    // world and major satellite in one pass.
    // =================================================================

    function classifySizeCode(world) {
        const r    = world.radius || 0;
        const size = Math.min(10, Math.max(0, Math.round(r / 800)));
        return size < 10 ? String(size) : 'A';
    }

    function classifyHydroCode(world) {
        const cov = world.waterCoverage || 0;
        if (cov >= 96) return 10;                               // hydro A: 96–100%
        return Math.max(0, Math.floor(cov / 10));               // hydro 0–9
    }

    function applyUWPPhysicals(world) {
        // String codes — for UWP string building and display
        world.sizeCode       = classifySizeCode(world);
        world.atmosphereCode = classifyAtmosphereCode(world);

        // Integer codes — required by MgT2E social generators
        world.size     = parseInt(world.sizeCode, 16);      // 0-10
        world.atmCode  = parseInt(world.atmosphereCode, 16); // 0-13
        world.hydroCode = classifyHydroCode(world);          // 0-10 (integer; socio reads this field)

        tResult(`UWP Physicals [${world.label || '?'}]`,
            `S=${world.sizeCode} A=${world.atmosphereCode} H=${world.hydroCode}` +
            ` | radius=${world.radius || 0}km P=${world.atmPressure || 0}atm cov=${world.waterCoverage || 0}%`,
            'AoW UWP Physicals');
    }

    function generateUWPPhysicals(sys) {
        tSection('AoW UWP Physical Codes (Size / Atmosphere / Hydro)');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — UWP physicals skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            for (const planet of (worksheet.planets || [])) {
                applyUWPPhysicals(planet);
                for (const sat of (planet.satellites || [])) {
                    applyUWPPhysicals(sat);
                }
            }
        }
    }

    // =================================================================
    // ATMOSPHERE CODE CLASSIFIER
    //
    // Maps AoW physical data to a single MgT2E-style hex digit (0–9, A–D).
    // Branch order: world class first (non-N2/O2 classes escape early),
    // then pressure tiers, then breathability[] taint check.
    // =================================================================

    function classifyAtmosphereCode(world) {
        const wc = world.worldClass;

        if (wc && wc.startsWith('Class 1')) return 'C'; // Venus-type: insidious (acid, extreme pressure)
        if (wc && wc.startsWith('Class 2')) return 'B'; // Dulcinea-type: corrosive (superheated steam)
        if (wc && wc.startsWith('Class 3')) return 'A'; // Titan-type: exotic (unbreathable but inert)

        const p = world.atmPressure || 0;

        if (p < 0.001) return '0'; // Vacuum
        if (p < 0.09)  return '1'; // Trace

        const tainted = Array.isArray(world.breathability) && world.breathability.length > 0;

        if (p < 0.43)  return tainted ? '2' : '3'; // Very Thin
        if (p < 0.71)  return tainted ? '4' : '5'; // Thin
        if (p < 1.50)  return tainted ? '7' : '6'; // Standard
        if (p < 2.50)  return tainted ? '9' : '8'; // Dense
        return 'D';                                  // Dense, High (≥2.50 atm)
    }

    // =================================================================
    // MAINWORLD SELECTION
    //
    // Flattens diskWorksheets into a candidate pool (non-gas-giant planets
    // + all satellites), scores by habitability, tiebreaks by radius.
    // Sets sys.mainworld on the winner.
    // =================================================================

    function selectAoWMainworld(candidates) {
        if (!candidates || candidates.length === 0) return null;
        candidates.sort((a, b) => {
            if (b.habitability !== a.habitability) return (b.habitability || 0) - (a.habitability || 0);
            return (b.radius || 0) - (a.radius || 0); // larger world wins tiebreak
        });
        return candidates[0];
    }

    function generateMainworldSelection(sys) {
        tSection('AoW Mainworld Selection');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — mainworld selection skipped');
            return null;
        }

        const candidates = [];
        for (const worksheet of sys.diskWorksheets) {
            for (const planet of (worksheet.planets || [])) {
                if (!planet.planetType.includes('Gas Giant')) {
                    candidates.push(planet);
                }
                for (const sat of (planet.satellites || [])) {
                    candidates.push(sat);
                }
            }
        }

        // Fallback: if no terrestrial bodies or GG satellites exist, admit gas giants
        // so that gas-giant-only systems still elect a mainworld.
        if (candidates.length === 0) {
            for (const worksheet of sys.diskWorksheets) {
                for (const planet of (worksheet.planets || [])) {
                    candidates.push(planet);
                }
            }
            if (candidates.length > 0) {
                tResult('Mainworld Candidates', 'No terrestrial bodies — falling back to gas giants', 'AoW Mainworld');
            }
        }

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] Mainworld: ${candidates.length} candidate(s) from ${sys.diskWorksheets.length} worksheet(s)`);
        }

        const mainworld = selectAoWMainworld(candidates);

        if (mainworld) {
            mainworld.isMainworld = true;
            mainworld.type = 'Mainworld';
            sys.mainworld = mainworld;
            tResult('Mainworld Selected',
                `${mainworld.label || '?'} | Habitability=${mainworld.habitability}` +
                ` | S${mainworld.sizeCode} A${mainworld.atmosphereCode} H${mainworld.hydroCode}`,
                'AoW Mainworld');
        } else {
            tResult('Mainworld Selected', 'None — no candidates qualified', 'AoW Mainworld');
            if (typeof window !== 'undefined' && window.isLoggingEnabled) {
                writeLogLine(`[PROBE] AoW Mainworld ERROR: no winner elected`);
            }
        }

        return mainworld;
    }

    // =================================================================
    // SYS.WORLDS BRIDGE
    //
    // Flattens diskWorksheets[].planets[].satellites[] into sys.worlds[]
    // so MgT2E social generators and applyMgT2EOrbitalNames can iterate
    // the system using their expected structure. Must be called AFTER
    // mainworld selection so type='Mainworld' is applied correctly.
    // =================================================================

    function populateAoWWorldsList(sys) {
        tSection('AoW: Build sys.worlds from Disk Worksheets');

        sys.worlds = [];

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — sys.worlds left empty');
            return;
        }

        for (let wsIdx = 0; wsIdx < sys.diskWorksheets.length; wsIdx++) {
            const worksheet = sys.diskWorksheets[wsIdx];

            for (const planet of (worksheet.planets || [])) {
                // Map AoW planetType → MgT2E type string
                if (planet.isMainworld) {
                    planet.type = 'Mainworld';
                } else if (planet.planetType && planet.planetType.includes('Gas Giant')) {
                    planet.type = 'Gas Giant';
                } else if (planet.planetType === 'Planetoid Belt') {
                    planet.type = 'Planetoid Belt';
                } else {
                    planet.type = 'Terrestrial Planet';
                }

                // Bridge satellite array → moons (social engine iterates w.moons)
                planet.moons = planet.satellites || [];

                // Bridge surfaceGravity → gravity for system viewer and accordion
                planet.gravity = planet.surfaceGravity ?? null;
                planet.moons.forEach(sat => { sat.gravity = sat.surfaceGravity ?? null; });

                // orbitId used by naming sort; parentStarIdx used by multi-star prefix
                planet.orbitId       = planet.orbitalRadius || 0;
                planet.parentStarIdx = wsIdx;

                sys.worlds.push(planet);
            }
        }

        if (typeof window !== 'undefined' && window.isLoggingEnabled) {
            writeLogLine(`[PROBE] sys.worlds populated: ${sys.worlds.length} body/bodies across ${sys.diskWorksheets.length} worksheet(s)`);
        }

        tResult('sys.worlds Built', `${sys.worlds.length} world(s)`, 'AoW World Bridge');
    }

    // =================================================================
    // HABITABILITY SCORER
    //
    // Produces world.habitability — a simple additive score used by
    // mainworld candidate evaluation. Four factors, each capped:
    //   Atmosphere  0–5  (or negative for hostile world classes)
    //   Temperature 0–3  (isSnowball overrides to -2)
    //   Water       0–3  (waterCoverage 0–100)
    //   Life        0–2  (life timeline fields vs systemAge)
    // =================================================================

    function scoreHabitability(world, sys) {
        const systemAgeMyr = (sys.systemAge || 0) * 1000;

        // --- Factor 1: Atmosphere ---
        let atmScore;
        const wc = world.worldClass;
        if (wc && wc.startsWith('Class 1')) {
            atmScore = -6; // Insidious
        } else if (wc && wc.startsWith('Class 2')) {
            atmScore = -3; // Corrosive
        } else if (wc && wc.startsWith('Class 3')) {
            atmScore = 0;  // Exotic (unbreathable but inert)
        } else {
            const p = world.atmPressure || 0;
            if (p < 0.09) {
                atmScore = 0; // Vacuum or Trace
            } else if (world.isBreathable) {
                atmScore = (Array.isArray(world.breathability) && world.breathability.length === 0) ? 5 : 3;
            } else {
                atmScore = 1; // N2-range pressure but not breathable
            }
        }

        // --- Factor 2: Temperature ---
        let tempScore = 0;
        if (world.isSnowball) {
            tempScore = -2;
        } else {
            const T = world.avgSurfaceTemp || 0;
            if (T >= 270 && T <= 320)      tempScore = 3;
            else if (T >= 250 && T < 270)  tempScore = 2;
            else if (T > 320 && T <= 350)  tempScore = 2;
            else if (T >= 220 && T < 250)  tempScore = 1;
            else if (T > 350 && T <= 400)  tempScore = 1;
        }

        // --- Factor 3: Water ---
        const cov = world.waterCoverage || 0;
        const waterScore = cov >= 50 ? 3 : cov >= 20 ? 2 : cov > 0 ? 1 : 0;

        // --- Factor 4: Life ---
        const hasLife    = world.tDeep    <= systemAgeMyr || world.tSurface  <= systemAgeMyr;
        const hasComplex = world.tAnimal  <= systemAgeMyr;
        const lifeScore  = hasComplex ? 2 : hasLife ? 1 : 0;

        const total = atmScore + tempScore + waterScore + lifeScore;
        world.habitability = total;

        tResult(`Habitability [${world.label || '?'}]`,
            `atm=${atmScore} temp=${tempScore} water=${waterScore} life=${lifeScore} → total=${total}`,
            'AoW Habitability');

        return total;
    }

    function generateHabitabilityScores(sys) {
        tSection('AoW Habitability Scoring');

        if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) {
            tSkip('No disk worksheets — habitability scoring skipped');
            return;
        }

        for (const worksheet of sys.diskWorksheets) {
            for (const planet of (worksheet.planets || [])) {
                scoreHabitability(planet, sys);
                for (const sat of (planet.satellites || [])) {
                    scoreHabitability(sat, sys);
                }
            }
        }
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    if (typeof window !== 'undefined') {
        window.AoWWorldEngine = { generatePlanetaryDisks, generateOrbitalDynamics, generatePhysicals, generateOrbitalConditions, generateThermalAndWater, generateGeophysics, generateMagneticField, generateEarlyAtmosphere, generateAlbedo, generateCarbonDioxide, generatePresenceOfLife, generateAverageSurfaceTemp, generateFinalizeAtmosphere, calculatePressureAtAltitude, calculateAltitudeForPressure, classifySizeCode, classifyAtmosphereCode, classifyHydroCode, generateUWPPhysicals, generateHabitabilityScores, generateMainworldSelection, populateAoWWorldsList };
    }

    return { generatePlanetaryDisks, generateOrbitalDynamics, generatePhysicals, generateOrbitalConditions, generateThermalAndWater, generateGeophysics, generateMagneticField, generateEarlyAtmosphere, generateAlbedo, generateCarbonDioxide, generatePresenceOfLife, generateAverageSurfaceTemp, generateFinalizeAtmosphere, calculatePressureAtAltitude, calculateAltitudeForPressure, classifySizeCode, classifyAtmosphereCode, classifyHydroCode, generateUWPPhysicals, generateHabitabilityScores, generateMainworldSelection, populateAoWWorldsList };
}));
