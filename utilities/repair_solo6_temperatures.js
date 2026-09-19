/**
 * repair_solo6_temperatures.js
 * ============================================================================
 * ONE-SHOT DATA REPAIR for sectors/solo_6.json
 *
 * This is NOT a general-purpose conversion tool. Solo 6 is the single universe
 * being carried forward, and this script exists so the repair is reproducible
 * and auditable if it ever has to be run again. See
 * utilities/repair_solo6_temperatures.md for the full diagnosis.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM
 * ---------------------------------------------------------------------------
 * Solo 6's bodies were migrated from the legacy "traveller-universe-creator"
 * pipeline (convert_to_aasb.py) and then run through ASB's MgT2E engines.
 * The legacy source carries exactly ONE temperature per body -- a 2-decimal
 * Kelvin mean (first_in_generation.py get_temperature: blackbody * (1-albedo)^(1/4)
 * * (1+greenhouse)). It has no min and no max.
 *
 * highTempK / lowTempK were produced by ASB's own diurnal step
 * (js/mgt2e_world_engine.js, "Temp Diurnals"). In the v0.11.0 re-import
 * (2026-05-21) the means were replaced with the raw legacy values while the
 * min/max were left as computed from different inputs. Result in the shipped
 * preset:
 *
 *   - 1164 bodies with meanTempK ABOVE highTempK
 *   -  156 bodies with meanTempK BELOW lowTempK (155 of them sitting exactly
 *          on the seismicStress floor)
 *   - 6882 bodies with highTempK > 1000 K, because imported moons carry a
 *          PLANETOCENTRIC `au` (distance from their planet, ~0.003 AU) and the
 *          diurnal step evaluated that against the star's luminosity.
 *
 * ---------------------------------------------------------------------------
 * THE FIX
 * ---------------------------------------------------------------------------
 * Derive high/low FROM the mean by ratio instead of from absolute AU. In the
 * engine's own formula the star luminosity and orbital distance cancel:
 *
 *     mean = 279 * (L * (1-albedo) * (1+gh) / au^2)^(1/4)
 *     high = 279 * (L * (1+lumMod) * (1-albedo) * (1+gh) / nearAu^2)^(1/4)
 *
 *     high / mean = ( (1 + lumMod) / (1 - ecc)^2 ) ^ (1/4)
 *     low  / mean = ( (1 - lumMod) / (1 + ecc)^2 ) ^ (1/4)
 *
 * Because lumMod is clamped to [0,1], low <= mean <= high is STRUCTURAL --
 * the inconsistency cannot recur no matter what the mean is. It also needs no
 * stellar data, so the bad moon `au` never enters the calculation.
 *
 * The internal-heat floor is then folded in exactly as the engine does at
 * mgt2e_world_engine.js:2375 / :2401-2402, using the body's stored
 * seismicStress (gas giants: the stored value is likewise reused):
 *
 *     mean' = ( mean^4 + inh^4 ) ^ (1/4)
 *     high' = ( (mean*rHi)^4 + inh^4 ) ^ (1/4)
 *     low'  = ( (mean*rLo)^4 + inh^4 ) ^ (1/4)
 *
 * This is legitimate rather than an override of the source data: the legacy
 * generator modelled ONLY stellar heating, so its mean is a solar-only figure.
 * Folding in the internal term completes it with the component the legacy
 * generator never had, which is precisely what the engine does for natively
 * generated worlds. Where inh is 0 (6672 bodies + the 2541 with no min/max)
 * the mean is bit-identical afterwards -- the fourth-root round-trip is exact
 * in float64.
 *
 * DECISION RECORD -- deliberate choices, flagged for review:
 *   1. The legacy mean is treated as SOLAR-ONLY, so the seismicStress floor is
 *      folded into it for NON-MOON bodies (1262 of them). This completes the
 *      legacy figure with the internal-heat term its generator never modelled,
 *      exactly as the engine does for natively generated worlds.
 *   2. The bad planetocentric moon `au` is NOT rewritten. The ratio method
 *      sidesteps it, and `au` drives orrery placement.
 *   3. Bodies that never had highTempK/lowTempK (2541 of them) are left alone.
 *      No new fields are introduced anywhere.
 *   4. For MOONS the floor is withheld from the MEAN but retained on the LOW
 *      side, clamped to the mean. seismicStress comes from
 *      calculateTidalEffect(star.mass, sVal, body.au * 149.6)
 *      (mgt2e_world_engine.js:2303), so for imported moons -- whose `au` is the
 *      corrupt planetocentric value -- the stored floor is inflated by the very
 *      bug this repair works around. Folding it into the mean would move 13
 *      moons by more than 200 K (worst: Starrfield A-XII-a, 16.65 K -> 866 K).
 *      On the low side it acts only as a floor and the clamp bounds it at the
 *      mean, so it can never produce an impossible reading -- and retaining it
 *      keeps the repair to what was actually broken. --drop-moon-floor removes
 *      it entirely; that is more internally consistent but sends 3305 further
 *      bodies to 0 K. The stored seismicStress values are left untouched either
 *      way and remain unreliable for moons -- see the .md open issues.
 *   5. VALIDATION: the ratio formulas above were checked against the last
 *      known-good sector file (commit 7428713, v0.10.0.3, 2026-04-30), where
 *      mean and min/max were both engine-written. They reproduce the engine's
 *      highTempK and lowTempK EXACTLY (within 1e-9) on all 6694 testable
 *      bodies. See --validate.
 *
 * ---------------------------------------------------------------------------
 * USAGE
 * ---------------------------------------------------------------------------
 *   node utilities/repair_solo6_temperatures.js --dry-run   # report only
 *   node utilities/repair_solo6_temperatures.js             # write in place
 *   node utilities/repair_solo6_temperatures.js --validate <known-good.json>
 *   node utilities/repair_solo6_temperatures.js --drop-moon-floor   # variant
 *
 * Run from the repository root.
 *
 * NOT IDEMPOTENT -- run it exactly ONCE on an unrepaired file. The internal-heat
 * blend mean' = (mean^4 + inh^4)^(1/4) is not a fixed point: applying it twice
 * yields (mean^4 + 2*inh^4)^(1/4), double-counting the floor for the 1262
 * non-moon bodies that carry one. The script therefore refuses to run on a file
 * that already satisfies low <= mean <= high everywhere (the signature of an
 * already-repaired file). Override with --force only if you know why.
 *
 * After writing, regenerate the derived preset:
 *   node utilities/repair_solo6_temperatures.js --rebuild-js
 * (equivalent to utilities/convert_solo6.ps1, byte-for-byte)
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(REPO_ROOT, 'sectors', 'solo_6.json');
const JS_PATH = path.join(REPO_ROOT, 'js', 'solo_6_data.js');

// ---------------------------------------------------------------------------
// Engine mirror: js/mgt2e_world_engine.js:1762-1782 ("Temp Diurnals").
// Kept deliberately verbose and in the engine's own order so it can be diffed
// against the engine by eye.
// ---------------------------------------------------------------------------
function computeLumMod(w) {
    let tfactor = Math.abs(Math.sin((w.axialTilt || 0) * Math.PI / 180));
    if (w.yearHours < (36.5 * 24)) tfactor /= 2;
    if (w.yearHours > (2 * 8760)) tfactor *= 1.5;

    let rfactor = (w.solarDayHours == null || w.solarDayHours <= 0 || w.solarDayHours === Infinity)
        ? 1.0
        : Math.sqrt(w.solarDayHours / 50);
    if (w.solarDayHours > 2500) rfactor = 1.0;
    if (w.tidallyLocked) rfactor = 1.0;

    let gfactor = (10 - (w.hydroCode || 0)) / 20;
    if (w.surfaceDist && w.surfaceDist.includes('Concentrated')) gfactor -= 0.1;
    if (w.surfaceDist && w.surfaceDist.includes('Dispersed')) gfactor += 0.1;

    const afactor = 1 + (w.pressureBar || 0);
    const vfactor = Math.max(0, Math.min(1.0, tfactor + rfactor + gfactor));
    return vfactor / afactor;
}

function diurnalRatios(w) {
    const lumMod = computeLumMod(w);
    const ecc = w.eccentricity || 0;
    return {
        hi: Math.pow((1 + lumMod) / Math.pow(1 - ecc, 2), 0.25),
        lo: Math.pow(Math.max(0, 1 - lumMod) / Math.pow(1 + ecc, 2), 0.25)
    };
}

// Engine mirror: mgt2e_world_engine.js:2375 -- quadrature blend of a solar
// temperature with an internal-heat floor.
function blend(solarK, inherentK) {
    if (!inherentK) return solarK;
    return Math.pow(Math.pow(solarK, 4) + Math.pow(inherentK, 4), 0.25);
}

/**
 * Collect every body object carrying a meanTempK, in stable document order,
 * tagging each with whether it is a moon.
 *
 * Moon-ness CANNOT be read from document position alone. convert_to_aasb.py
 * assigns the same mainworld object to mgtSystem.mainworld and to mgt2eData,
 * so a lunar mainworld is serialised 2-3 times: once inside a `moons` array
 * and once or twice at system level. Position-only detection would classify
 * those copies differently and let them drift apart after repair.
 *
 * Identity therefore comes from the NAME: any body whose name also appears
 * inside some `moons` array is treated as a moon everywhere it occurs. (For a
 * lunar mainworld the converter names the moon after the system, so the copies
 * share a name by construction -- exactly the link we need.)
 */
function collectBodies(root) {
    const raw = [];
    (function walk(node, inMoons) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(n => walk(n, inMoons)); return; }
        if ('meanTempK' in node) raw.push({ body: node, inMoonsArray: inMoons });
        for (const key of Object.keys(node)) walk(node[key], key === 'moons' ? true : inMoons);
    })(root, false);

    const moonNames = new Set();
    for (const e of raw) if (e.inMoonsArray && e.body.name) moonNames.add(e.body.name);

    return raw.map(e => ({
        body: e.body,
        isMoon: e.inMoonsArray || (e.body.name ? moonNames.has(e.body.name) : false)
    }));
}

function repair(root, { apply, keepMoonFloor }) {
    const bodies = collectBodies(root);
    const stats = {
        bodiesTotal: bodies.length,
        bodiesConsidered: 0,
        skippedNoMinMax: 0,
        skippedBadMean: 0,
        meanChanged: 0,
        highChanged: 0,
        lowChanged: 0,
        moonsFloorSkipped: 0,
        before: { meanAboveHigh: 0, meanBelowLow: 0, highOver1000: 0, lowAtZero: 0 },
        after: { meanAboveHigh: 0, meanBelowLow: 0, highOver1000: 0, lowAtZero: 0 },
        largestMeanDelta: { name: null, from: 0, to: 0, delta: 0 }
    };

    for (const entry of bodies) {
        const w = entry.body;
        const hasHigh = w.highTempK != null && isFinite(w.highTempK);
        const hasLow = w.lowTempK != null && isFinite(w.lowTempK);

        // Tally the "before" picture across every body that has min/max at all.
        if (hasHigh && w.meanTempK > w.highTempK) stats.before.meanAboveHigh++;
        if (hasLow && w.meanTempK < w.lowTempK) stats.before.meanBelowLow++;
        if (hasHigh && w.highTempK > 1000) stats.before.highOver1000++;
        if (hasLow && w.lowTempK === 0) stats.before.lowAtZero++;

        // Decision record #3: leave bodies that never carried min/max untouched.
        if (!hasHigh && !hasLow) { stats.skippedNoMinMax++; continue; }
        if (!(typeof w.meanTempK === 'number' && isFinite(w.meanTempK) && w.meanTempK > 0)) {
            stats.skippedBadMean++;
            continue;
        }
        stats.bodiesConsidered++;

        const solarK = w.meanTempK;                 // legacy solar-only mean

        // Decision record #4: the stored seismicStress of an imported moon is
        // contaminated by the same planetocentric-`au` bug, so it is not used.
        let inherentK = w.seismicStress || 0;
        if (entry.isMoon && inherentK) { stats.moonsFloorSkipped++; inherentK = 0; }

        const r = diurnalRatios(w);

        const newMean = blend(solarK, inherentK);
        const newHigh = blend(solarK * r.hi, inherentK);
        let newLow = blend(solarK * r.lo, inherentK);

        // DEFAULT: a moon's seismicStress is withheld from the MEAN (where it
        // would add hundreds of spurious kelvin) but retained on the LOW side,
        // clamped to the mean. The two uses are not equivalent: on the mean the
        // contaminated value distorts the figure outright, whereas on the low
        // side it acts only as a floor and the clamp means it can at worst pull
        // the low up to the mean -- bounded, never impossible. Retaining it
        // keeps the repair to what was actually broken.
        // --drop-moon-floor removes it entirely, which is more internally
        // consistent but sends 3305 additional bodies to 0 K. See the .md.
        if (keepMoonFloor && entry.isMoon && w.seismicStress) {
            newLow = Math.min(blend(solarK * r.lo, w.seismicStress), newMean);
        }

        if (newMean !== w.meanTempK) {
            stats.meanChanged++;
            const delta = Math.abs(newMean - w.meanTempK);
            if (delta > stats.largestMeanDelta.delta) {
                stats.largestMeanDelta = { name: w.name || '(unnamed)', from: w.meanTempK, to: newMean, delta };
            }
        }
        if (hasHigh && newHigh !== w.highTempK) stats.highChanged++;
        if (hasLow && newLow !== w.lowTempK) stats.lowChanged++;

        if (apply) {
            const meanMoved = newMean !== w.meanTempK;
            w.meanTempK = newMean;
            // meanTempC is vestigial -- the engine writes it (mgt2e_world_engine.js:2376)
            // but only a trace line reads it; display and export both derive Celsius
            // from meanTempK. So it is refreshed ONLY where the mean actually moved,
            // and it keeps this file's existing -273.15 convention rather than the
            // engine's -273, to avoid a spurious 0.15 K shift on bodies the repair
            // otherwise leaves alone.
            if (meanMoved && 'meanTempC' in w) w.meanTempC = Number((newMean - 273.15).toFixed(2));
            if (hasHigh) w.highTempK = newHigh;
            if (hasLow) w.lowTempK = newLow;
        }

        // "After" picture, computed from the new values whether or not applied.
        if (hasHigh && newMean > newHigh) stats.after.meanAboveHigh++;
        if (hasLow && newMean < newLow) stats.after.meanBelowLow++;
        if (hasHigh && newHigh > 1000) stats.after.highOver1000++;
        if (hasLow && newLow === 0) stats.after.lowAtZero++;
    }

    return stats;
}

// ---------------------------------------------------------------------------
// --validate : prove the ratio formulas reproduce engine output exactly on a
// file where mean AND min/max were both written by the engine.
// ---------------------------------------------------------------------------
function validate(referencePath) {
    const root = JSON.parse(fs.readFileSync(referencePath, 'utf8').replace(/^﻿/, ''));
    let tested = 0, highExact = 0, lowExact = 0;
    for (const { body: w } of collectBodies(root)) {
        if (!(w.meanTempK > 0) || w.seismicStress) continue;   // isolate the pure solar case
        if (w.highTempK == null || w.lowTempK == null) continue;
        const r = diurnalRatios(w);
        tested++;
        if (Math.abs(w.meanTempK * r.hi - w.highTempK) < 1e-9) highExact++;
        if (Math.abs(w.meanTempK * r.lo - w.lowTempK) < 1e-9) lowExact++;
    }
    console.log(`Validation against ${path.basename(referencePath)}`);
    console.log(`  bodies tested : ${tested}`);
    console.log(`  highTempK exact: ${highExact}/${tested}`);
    console.log(`  lowTempK  exact: ${lowExact}/${tested}`);
    const ok = tested > 0 && highExact === tested && lowExact === tested;
    console.log(ok ? '  RESULT: PASS' : '  RESULT: FAIL');
    return ok;
}

// ---------------------------------------------------------------------------
// --rebuild-js : reproduce utilities/convert_solo6.ps1 byte-for-byte.
// PowerShell's Set-Content -Encoding UTF8 (5.1) emits a BOM and CRLF endings.
// ---------------------------------------------------------------------------
function rebuildJs() {
    const json = fs.readFileSync(JSON_PATH, 'utf8');
    const body =
        '// Auto-generated by convert_solo6.ps1 - do not edit manually.\r\n' +
        '// Re-run the script whenever sectors/solo_6.json changes.\r\n' +
        'window.SOLO_6_DATA = ' + json + ';\r\n';
    fs.writeFileSync(JS_PATH, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(body, 'utf8')]));
    console.log(`Wrote ${path.relative(REPO_ROOT, JS_PATH)} (${fs.statSync(JS_PATH).size} bytes)`);
}

// ---------------------------------------------------------------------------

function main() {
    const args = process.argv.slice(2);

    if (args.includes('--validate')) {
        const ref = args[args.indexOf('--validate') + 1];
        if (!ref) { console.error('--validate requires a path to a known-good sector file'); process.exit(2); }
        process.exit(validate(ref) ? 0 : 1);
    }

    if (args.includes('--rebuild-js')) { rebuildJs(); return; }

    const dryRun = args.includes('--dry-run');
    const keepMoonFloor = !args.includes('--drop-moon-floor');
    const force = args.includes('--force');
    const original = fs.readFileSync(JSON_PATH, 'utf8');
    const root = JSON.parse(original);

    // Re-run guard. See "NOT IDEMPOTENT" above: a second pass would double-count
    // the internal-heat floor. An unrepaired file has 1320 invariant violations;
    // a repaired one has none, which is the signature we refuse on.
    if (!force) {
        let violations = 0, withMinMax = 0;
        for (const { body: w } of collectBodies(root)) {
            const H = w.highTempK != null && isFinite(w.highTempK);
            const L = w.lowTempK != null && isFinite(w.lowTempK);
            if (!H && !L) continue;
            withMinMax++;
            if (H && w.meanTempK > w.highTempK + 1e-9) violations++;
            if (L && w.meanTempK < w.lowTempK - 1e-9) violations++;
        }
        if (withMinMax > 0 && violations === 0) {
            console.error('REFUSING TO RUN: sectors/solo_6.json already satisfies');
            console.error('low <= mean <= high on all ' + withMinMax + ' bodies that carry min/max.');
            console.error('This file looks already-repaired. Running again would double-count');
            console.error('the internal-heat floor. Restore the pre-repair file first, or pass');
            console.error('--force if you are certain this is what you want.');
            process.exit(3);
        }
    }

    const stats = repair(root, { apply: !dryRun, keepMoonFloor });
    console.log(keepMoonFloor
        ? '(default: moon low-side floors retained, withheld from the mean)'
        : '(--drop-moon-floor: moon seismicStress floors removed entirely)');

    console.log(dryRun ? '=== DRY RUN (no files written) ===' : '=== APPLYING REPAIR ===');
    console.log(`bodies in file           : ${stats.bodiesTotal}`);
    console.log(`  repaired               : ${stats.bodiesConsidered}`);
    console.log(`  skipped (no min/max)   : ${stats.skippedNoMinMax}`);
    console.log(`  skipped (unusable mean): ${stats.skippedBadMean}`);
    console.log('');
    console.log('                          before ->  after');
    console.log(`  mean above high        : ${String(stats.before.meanAboveHigh).padStart(6)} -> ${String(stats.after.meanAboveHigh).padStart(6)}`);
    console.log(`  mean below low         : ${String(stats.before.meanBelowLow).padStart(6)} -> ${String(stats.after.meanBelowLow).padStart(6)}`);
    console.log(`  high above 1000 K      : ${String(stats.before.highOver1000).padStart(6)} -> ${String(stats.after.highOver1000).padStart(6)}`);
    console.log(`  low at absolute zero   : ${String(stats.before.lowAtZero).padStart(6)} -> ${String(stats.after.lowAtZero).padStart(6)}`);
    console.log('');
    console.log(`fields rewritten: meanTempK ${stats.meanChanged}, highTempK ${stats.highChanged}, lowTempK ${stats.lowChanged}`);
    console.log(`moons whose contaminated seismicStress floor was withheld from the mean: ${stats.moonsFloorSkipped}`);
    const d = stats.largestMeanDelta;
    if (d.name) {
        console.log(`largest mean change: ${d.name}  ${d.from.toFixed(2)} K -> ${d.to.toFixed(2)} K  (+${d.delta.toFixed(2)} K, internal-heat floor)`);
    }

    if (!dryRun) {
        fs.writeFileSync(JSON_PATH, JSON.stringify(root), 'utf8');
        console.log(`\nWrote ${path.relative(REPO_ROOT, JSON_PATH)} (${fs.statSync(JSON_PATH).size} bytes)`);
        console.log('Now run with --rebuild-js to regenerate js/solo_6_data.js');
    }
}

main();
