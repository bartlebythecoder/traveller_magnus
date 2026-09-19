# Solo 6 Temperature Repair — 2026-09-18

One-shot data repair of `sectors/solo_6.json`. Solo 6 is the single universe
being carried forward, so this document records the diagnosis, the decisions,
and the verification in enough detail to redo or reverse the work later.

Two scripts, run **in this order**:

1. `utilities/restore_solo6_pressure.js` — recovers the `atmos_pressure` that
   conversion dropped (§9)
2. `utilities/repair_solo6_temperatures.js` — rebuilds mean/min/max (§4)

Order matters: pressure feeds `afactor`, which feeds `lumMod`, which determines
high and low. Both must run on a file that has not already been transformed.

---

## 1. The symptom

Bodies in the Solo 6 preset showed a **mean temperature above their maximum**.
Across the file:

| Condition | Count |
|---|---|
| `meanTempK` above `highTempK` | 1164 |
| `meanTempK` below `lowTempK` | 156 |
| `highTempK` above 1000 K | 6882 |
| bodies carrying min/max at all | 11239 of 13780 |

## 2. Where the min/max came from

Not from `convert_to_aasb.py`. That script never writes `highTempK` or
`lowTempK`, and the legacy source has nothing to write from — bodies in
`new_ss6_orbital_bodies.json` carry exactly one temperature field,
`"temperature": 279.18`, produced by `first_in_generation.py:875-883` as
`blackbody × (1−albedo)^¼ × (1+greenhouse)` and rounded to 2 decimals.

The min/max were produced by **ASB itself** — the diurnal step in
`js/mgt2e_world_engine.js:1759-1791`. The fingerprint is precision: legacy
values are 2-decimal, engine values are full float (`143.50885958873016`).

## 3. How it broke

`convert_to_aasb.py` is a *merge* step, not the origin. Its three inputs are
`ss6_stellar_bodies.json`, `new_ss6_orbital_bodies.json`, and `ss6_aasb.json` —
and that third file is already an ASB save (`hexStates` + `t5Data` + `t5Socio`),
which the script calls the "Gold Standard". It injects the legacy stars and
bodies into that save and deletes `mgtSocio`/`t5System` on the way out.

Git history of `sectors/solo_6.json` pins the regression exactly:

| Date | Version | Bodies | mean > high | `meanTempK` |
|---|---|---|---|---|
| 2026-04-15 | v0.9 | 0 | — | no bodies yet (the `ss6_aasb.json` stage) |
| 2026-04-30 | v0.10.0.3 | 13780 | **0** | full float (engine-written) |
| 2026-05-21 | v0.11.0 | 13780 | **1164** | 2-dp (legacy) |

Between v0.10.0.3 and v0.11.0 the sector was re-imported: the legacy scalars
(`meanTempK`, `meanTempC`, `mass`, `density`, `gravity`, `solarDayHours`,
`periodDays`) were written back over engine values, while `highTempK`/`lowTempK`
were left as computed from the *previous* inputs. The mean was replaced
underneath the min/max.

Because `high/mean = ((1+lumMod)/(1−ecc)²)^¼ ≥ 1` by construction, any body with
mean > high is positive proof the mean was written by something other than the
engine.

## 4. The fix

Derive high/low **from** the mean by ratio rather than from absolute AU. In the
engine's formula the stellar luminosity and orbital distance cancel:

```
high / mean = ( (1 + lumMod) / (1 − ecc)² ) ^ ¼
low  / mean = ( (1 − lumMod) / (1 + ecc)² ) ^ ¼
```

`lumMod` is clamped to `[0,1]`, so **`low ≤ mean ≤ high` is structural** — the
inconsistency cannot recur regardless of what the mean says. The method needs no
stellar data, so the corrupt moon `au` never enters the calculation.

The internal-heat floor is folded in as the engine does
(`mgt2e_world_engine.js:2375, 2401-2402`): `x' = (x⁴ + inh⁴)^¼`.

### Decisions

1. **The legacy mean is treated as solar-only**, so the `seismicStress` floor is
   folded into it for non-moon bodies (1262). The legacy generator modelled only
   stellar heating, so this completes the figure with a term it never had —
   which is what the engine does for natively generated worlds.
2. **The corrupt moon `au` is not rewritten.** The ratio method sidesteps it and
   `au` drives orrery placement.
3. **Bodies that never carried min/max (2541) keep their temperatures
   untouched.** The temperature repair introduces no new fields; the pressure
   restore (§9) deliberately does, on every body.
4. **For moons the floor is withheld from the mean but kept on the low side**,
   clamped to the mean. `seismicStress` derives from
   `calculateTidalEffect(star.mass, sVal, body.au × 149.6)`, so for imported
   moons it is inflated by the same `au` bug. Folding it into the mean would
   move 13 moons by >200 K (worst: `Starrfield A-XII-a`, 16.65 K → 866 K). On
   the low side it only acts as a floor, and the clamp means it can never exceed
   the mean. `--drop-moon-floor` removes it entirely — more internally
   consistent, but it sends 3305 further bodies to 0 K.
5. **`meanTempC` is refreshed only where the mean moved**, keeping this file's
   existing −273.15 convention (the engine uses −273). The field is vestigial:
   only a trace line reads it; display and export derive Celsius from
   `meanTempK`.

### Identity: use the NAME

`convert_to_aasb.py` assigns the same mainworld object to `mgtSystem.mainworld`
and `mgt2eData`, so a lunar mainworld is serialised 2–3 times — once inside a
`moons` array, once or twice at system level. Detecting moons by document
position alone would classify those copies differently and let them drift apart.
Moon-ness is therefore resolved by **name**: any body whose name appears inside
some `moons` array is treated as a moon everywhere it occurs.

## 5. Results

```
bodies in file           : 13780
  repaired               : 11239
  skipped (no min/max)   : 2541

                          before ->  after
  mean above high        :   1164 ->      0
  mean below low         :    156 ->      0
  high above 1000 K      :   6882 ->     17
  low at absolute zero   :   6672 ->   6358

fields rewritten: meanTempK 1262, highTempK 11239, lowTempK 1854, meanTempC 772
                  totalPressureBar 13780, pressureBar 13780
```

The 17 remaining bodies above 1000 K are legitimately hot worlds.

The absolute-zero count is the wrong measure of the pressure fix; the right one
is that **all 1754 bodies with pressure > 0 that carry a low now have a physical
one — none is left at 0 K**. The 6358 still at absolute zero are all genuine
vacuum bodies (pressure = 0), where 0 K is the engine's correct answer for an
airless night side. Only 1754 of the 3847 pressurised bodies carry min/max at
all, and many of the rest were previously masked by the tidal floor rather than
being correct.

Example: `Stratton Saint Mar I` (0.6 bar) went from a 0 K low to
218.5 / 279.2 / 315.2 K (low / mean / high).

## 6. Verification

1. **Formula validated against known-good engine output.** The ratio formulas
   reproduce `highTempK` and `lowTempK` exactly (within 1e-9) on all **6694**
   testable bodies of the last self-consistent sector file (commit `7428713`,
   v0.10.0.3), where mean and min/max were both engine-written.
   `node utilities/repair_solo6_temperatures.js --validate <file>`
2. **Lossless serialisation.** `JSON.parse` → `JSON.stringify` of the original
   file reproduces it byte-for-byte (17,212,869 bytes both ways), so the write
   differs *only* in the intended numbers.
3. **Field-level diff.** Everything in the file except the four temperature
   fields and the two pressure fields is byte-identical before and after.
4. **Invariant.** `low ≤ mean ≤ high` holds on all 11239 bodies, 0 violations.
5. **Duplicate copies.** 0 divergences among bodies serialised more than once.
6. **No non-finite values** introduced.
7. **Derived preset.** The rebuilder was first proved to reproduce the existing
   PowerShell-generated `js/solo_6_data.js` byte-for-byte from the pre-repair
   JSON, then used for real. The shipped preset parses and its payload is
   identical to `sectors/solo_6.json`.
8. **Pressure join is complete.** 438/438 systems, 13780/13780 bodies, 0
   ambiguous, 0 unmatched. The script refuses to write a partial join.
9. **Pressure distribution matches the legacy source independently of the join
   code** — gas giants at 10 bar number exactly 1865 in both files — and
   `pressureBar === totalPressureBar` on every body, the engine's own invariant.
10. **Every pressurised body has a physical low**: of 1754 bodies with
    pressure > 0 carrying a low, 0 remain at absolute zero.

Pre-repair backups (this session's scratchpad):
`solo_6.PRE_REPAIR.json`, `solo_6_data.PRE_REPAIR.js`. Git also holds the
original at `bf8bf24`.

## 7. Re-running

**The script is NOT idempotent — run it once on an unrepaired file.** The blend
`(mean⁴ + inh⁴)^¼` is not a fixed point; a second pass yields
`(mean⁴ + 2·inh⁴)^¼` and double-counts the floor for the 1262 bodies carrying
one. The script refuses to run on a file that already satisfies the invariant
everywhere, exiting 3. Restore the pre-repair file first, or pass `--force`.

```
node utilities/repair_solo6_temperatures.js --dry-run     # report only
node utilities/repair_solo6_temperatures.js               # write in place
node utilities/repair_solo6_temperatures.js --rebuild-js  # regenerate the preset
```

## 8. Open issues — NOT fixed here

1. ~~`pressureBar` was never mapped during conversion.~~ **FIXED** — see §9.
2. **Moon `au` is planetocentric.** Imported moons store their distance from
   their planet (~0.001–0.016 AU) in `au`, where natively generated moons
   inherit the parent's heliocentric AU (`mgt2e_world_engine.js:1556`,
   "INHERIT AU FROM PARENT PLANET"). This repair routes around it; anything else
   reading moon `au` against stellar values is still affected — including
   `seismicStress`, `totalTidalAmplitude`, and the orrery.
3. **`seismicStress` is unreliable for moons**, for the reason above. The stored
   values were left untouched.
4. **The engine can still desync a mean from its min/max.** `processBody`
   (`mgt2e_world_engine.js:1750-1791`) recomputes high/low from absolute AU, so
   an imported or hand-edited mean can once again fall outside them. Deriving
   high/low from the mean by ratio — algebraically identical to the current
   formula when the mean is engine-derived — would make the invariant structural
   in the app itself. Not done: it is an engine change, not a data repair.
5. **`utilities/convert_solo6.ps1` has a broken path.** It resolves
   `$PSScriptRoot\sectors\solo_6.json`, i.e. `utilities/sectors/...`, which does
   not exist — the script evidently used to live at the repository root. Use
   `--rebuild-js` (byte-for-byte equivalent) until it is fixed.

---

## 9. Pressure restore (step 1)

Script: `utilities/restore_solo6_pressure.js`

### The problem

`convert_to_aasb.py` never mapped the legacy `atmos_pressure` field. All 13780
bodies were missing `pressureBar` / `totalPressureBar`, while the legacy source
carries `atmos_pressure` on all 12394 bodies. Two consequences:

1. `afactor = 1 + (w.pressureBar || 0)` (`mgt2e_world_engine.js:1781`) was always
   1, so `lumMod` reduced to `vfactor`, which clamps to 1.0 for most bodies,
   driving `lowTempK` to `279 × 0^¼ = 0 K`. An atmosphere is precisely what damps
   the day/night swing, and the field carrying it had been dropped.
2. `totalPressureBar` is the field the UI displays — `hex_editor.js:666,803`
   ("Pressure (bar)") and `export_core.js:810,896` ("Pressure") — each guarded on
   the field being defined, so the row was silently omitted everywhere.
   **Restoring it makes a Pressure row appear in the System Editor and in
   exports for bodies that previously showed none.**

### The join

Names cannot carry the join — bodies were renamed between v0.10.0.3 and v0.11.0.
Hexes map to legacy `location` exactly as `convert_to_aasb.py` did (`clean_id`:
keep the digits of the last hexId segment). Within a hex, bodies match on five
fields that neither conversion nor the temperature repair ever rewrote:

| legacy | sector |
|---|---|
| `orbital_radius` | `au` |
| `mass` | `mass` |
| `density` | `density` |
| `gravity` | `gravity` |
| `day` | `solarDayHours` |

Result: **438/438 systems, 13780/13780 bodies, 0 ambiguous, 0 unmatched.**

The first four fields alone leave 5 ambiguities, all in the binary system
`18-C-2205`, where both stars have a near-identical third orbit (same au, mass,
density, gravity, size, atmosphere code) differing only in hydrographics and day
length. `day` (13 vs 18) separates them. **`hydrographics` is not usable** as a
discriminator: the sector's `hydroCode` is the engine's field, absent on most
bodies, so it compares as `NaN` and collapses the match rate to 2659/13780.

Bodies serialised more than once share a signature by construction and therefore
resolve to the same legacy record — copies cannot diverge.

### What it writes

`totalPressureBar` and `pressureBar`, both set to the legacy `atmos_pressure`.
The engine keeps the pair equal (`mgt2e_world_engine.js:988, 1010, 1018, 1410`),
so writing only one would leave bodies in a state the engine never produces.
Zero values are written too: a vacuum body genuinely has 0 bar, and recording it
distinguishes "no atmosphere" from "unknown".

3847 bodies received a non-zero pressure, 9933 a zero. The distribution matches
the legacy source — gas giants at 10 bar number exactly 1865 in both files.

Unlike the temperature repair, this script **is** idempotent: it assigns measured
values rather than deriving new ones from current state. It refuses to write a
partial join, since a half-restored sector would have some bodies damping their
diurnal swing and their neighbours not.

### Dependency

It reads `../traveller-universe-creator/new_ss6_orbital_bodies.json` and exits 2
if that repo is not alongside this one. That file is the only surviving source of
this data — **it cannot be regenerated from anything in this repository.**
