/**
 * restore_solo6_pressure.js
 * ============================================================================
 * ONE-SHOT DATA REPAIR for sectors/solo_6.json -- STEP 1 OF 2
 *
 * Companion to utilities/repair_solo6_temperatures.js. Run this FIRST, then the
 * temperature repair. See utilities/repair_solo6_temperatures.md.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM
 * ---------------------------------------------------------------------------
 * convert_to_aasb.py never mapped the legacy `atmos_pressure` field. Every one
 * of the 13780 bodies in solo_6.json is missing `pressureBar` /
 * `totalPressureBar`, while the legacy source carries atmos_pressure on all
 * 12394 bodies (3211 of them non-zero).
 *
 * Two consequences:
 *
 *   1. The diurnal step computes `afactor = 1 + (w.pressureBar || 0)`
 *      (mgt2e_world_engine.js:1781), so afactor is always 1. lumMod is then
 *      vfactor alone, which clamps to 1.0 for most bodies, which drives
 *      lowTempK to 279 * 0^(1/4) = 0 K. That is the root cause of ~6700 bodies
 *      reading -273 C. An atmosphere is exactly what damps the day/night swing,
 *      and the field carrying it was dropped in conversion.
 *
 *   2. `totalPressureBar` is the field the UI displays -- hex_editor.js:666,803
 *      ("Pressure (bar)") and export_core.js:810,896 ("Pressure") -- each
 *      guarded on the field being defined. With it absent the row is silently
 *      omitted everywhere. Restoring it makes real data visible again.
 *
 * ---------------------------------------------------------------------------
 * THE JOIN
 * ---------------------------------------------------------------------------
 * Bodies were renamed between v0.10.0.3 and v0.11.0, so names cannot carry the
 * join. Hexes map to legacy `location` the same way convert_to_aasb.py did
 * (clean_id: keep the digits of the last hexId segment). Within a hex, bodies
 * match on five fields that neither conversion nor the temperature repair ever
 * rewrote:
 *
 *     orbital_radius <-> au
 *     mass           <-> mass
 *     density        <-> density
 *     gravity        <-> gravity
 *     day            <-> solarDayHours
 *
 * Measured result: 438/438 systems, 13780/13780 bodies, 0 ambiguous, 0
 * unmatched. The first four fields alone leave 5 ambiguities, all in the binary
 * system 18-C-2205 where both stars have a near-identical third orbit;
 * `day` (13 vs 18) separates them. `hydrographics` is NOT usable as a
 * discriminator -- the sector's `hydroCode` is the engine's field and is absent
 * on most bodies, so it matches as NaN.
 *
 * Bodies serialised more than once (convert_to_aasb.py assigns the same
 * mainworld object to mgtSystem.mainworld and mgt2eData, so a lunar mainworld
 * appears 2-3 times) share a signature by construction and therefore all
 * resolve to the same legacy record -- copies cannot diverge.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WRITES
 * ---------------------------------------------------------------------------
 * `totalPressureBar` and `pressureBar`, both set to the legacy atmos_pressure.
 * The engine keeps the pair equal (mgt2e_world_engine.js:988, 1010, 1018, 1410)
 * -- totalPressureBar is canonical and displayed, pressureBar is the working
 * copy the thermal math reads -- so writing only one would leave the body in a
 * state the engine never produces.
 *
 * Zero values ARE written. A vacuum body genuinely has 0 bar, and recording it
 * is what distinguishes "no atmosphere" from "unknown".
 *
 * This script is idempotent: it assigns measured values rather than deriving
 * new ones from current state, so re-running assigns the same numbers.
 *
 * ---------------------------------------------------------------------------
 * USAGE -- ORDER MATTERS
 * ---------------------------------------------------------------------------
 *   1. Start from a PRE-TEMPERATURE-REPAIR solo_6.json (git HEAD, or the
 *      scratchpad backup). Pressure changes afactor, which changes lumMod,
 *      which changes high/low -- so the temperature repair must run AFTER this,
 *      and it must run on data it has not already transformed.
 *   2. node utilities/restore_solo6_pressure.js
 *   3. node utilities/repair_solo6_temperatures.js
 *   4. node utilities/repair_solo6_temperatures.js --rebuild-js
 *
 *   node utilities/restore_solo6_pressure.js --dry-run   # report only
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(REPO_ROOT, 'sectors', 'solo_6.json');
const LEGACY_PATH = path.resolve(
    REPO_ROOT, '..', 'traveller-universe-creator', 'new_ss6_orbital_bodies.json'
);

/** convert_to_aasb.py clean_id(): keep only the digits. */
const cleanId = v => String(v).replace(/\D/g, '');

function bodiesOf(node) {
    const out = [];
    (function walk(n) {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if ('meanTempK' in n) out.push(n);
        for (const k in n) walk(n[k]);
    })(node);
    return out;
}

/** The five fields neither conversion nor the temperature repair rewrote. */
function matches(legacyBody, sectorBody) {
    return Number(legacyBody.orbital_radius) === Number(sectorBody.au)
        && Number(legacyBody.mass) === Number(sectorBody.mass)
        && Number(legacyBody.density) === Number(sectorBody.density)
        && Number(legacyBody.gravity) === Number(sectorBody.gravity)
        && Number(legacyBody.day) === Number(sectorBody.solarDayHours);
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');

    if (!fs.existsSync(LEGACY_PATH)) {
        console.error('Legacy source not found:\n  ' + LEGACY_PATH);
        console.error('This repair needs the traveller-universe-creator repo alongside this one.');
        process.exit(2);
    }

    const sector = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf8'));

    const byLoc = {};
    for (const b of legacy) (byLoc[cleanId(b.location)] = byLoc[cleanId(b.location)] || []).push(b);

    const stats = {
        legacyBodies: legacy.length,
        sectorBodies: 0,
        resolved: 0,
        ambiguousConflicting: 0,
        unmatched: 0,
        alreadyHadField: 0,
        written: 0,
        nonZero: 0
    };
    const problems = [];

    for (const [hexId, state] of Object.entries(sector.hexStates)) {
        const bodies = bodiesOf(state);
        if (!bodies.length) continue;
        const candidates = byLoc[cleanId(hexId.split('-').pop())];

        for (const b of bodies) {
            stats.sectorBodies++;
            if ('totalPressureBar' in b || 'pressureBar' in b) stats.alreadyHadField++;

            const hits = candidates ? candidates.filter(L => matches(L, b)) : [];
            let pressure = null;

            if (hits.length === 1) {
                pressure = Number(hits[0].atmos_pressure);
            } else if (hits.length > 1) {
                // Several legacy twins matched. Harmless as long as they agree
                // on pressure, which is the only value being copied.
                const distinct = new Set(hits.map(h => Number(h.atmos_pressure)));
                if (distinct.size === 1) pressure = [...distinct][0];
                else {
                    stats.ambiguousConflicting++;
                    problems.push(`${hexId} ${b.name || '(unnamed)'}: ${hits.length} legacy matches disagree on pressure (${[...distinct].join(', ')})`);
                    continue;
                }
            } else {
                stats.unmatched++;
                problems.push(`${hexId} ${b.name || '(unnamed)'}: no legacy match`);
                continue;
            }

            if (pressure == null || !isFinite(pressure)) {
                stats.unmatched++;
                problems.push(`${hexId} ${b.name || '(unnamed)'}: legacy atmos_pressure unusable`);
                continue;
            }

            stats.resolved++;
            if (pressure > 0) stats.nonZero++;
            if (!dryRun) {
                b.totalPressureBar = pressure;   // canonical + displayed
                b.pressureBar = pressure;        // working copy the thermal math reads
            }
            stats.written++;
        }
    }

    console.log(dryRun ? '=== DRY RUN (no files written) ===' : '=== RESTORING PRESSURE ===');
    console.log(`legacy bodies available : ${stats.legacyBodies}`);
    console.log(`sector bodies           : ${stats.sectorBodies}`);
    console.log(`  resolved              : ${stats.resolved}`);
    console.log(`  unmatched             : ${stats.unmatched}`);
    console.log(`  conflicting matches   : ${stats.ambiguousConflicting}`);
    console.log(`already had the field   : ${stats.alreadyHadField}`);
    console.log(`pressure written        : ${stats.written}  (${stats.nonZero} non-zero, ${stats.written - stats.nonZero} vacuum)`);

    if (problems.length) {
        console.log(`\n${problems.length} problem(s):`);
        problems.slice(0, 20).forEach(p => console.log('  ' + p));
        if (problems.length > 20) console.log(`  ... and ${problems.length - 20} more`);
    }

    // A partial join would leave the sector in a mixed state, where some bodies
    // damp their diurnal swing and their neighbours do not. Refuse it.
    if (stats.unmatched || stats.ambiguousConflicting) {
        console.error('\nREFUSING TO WRITE: the join must be complete and unambiguous.');
        process.exit(1);
    }

    if (!dryRun) {
        fs.writeFileSync(JSON_PATH, JSON.stringify(sector), 'utf8');
        console.log(`\nWrote ${path.relative(REPO_ROOT, JSON_PATH)} (${fs.statSync(JSON_PATH).size} bytes)`);
        console.log('Next: node utilities/repair_solo6_temperatures.js');
    }
}

main();
