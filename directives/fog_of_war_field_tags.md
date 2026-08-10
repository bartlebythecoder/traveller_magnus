# FOG OF WAR — Field Disclosure Tagging Table (HX-1)

**Status: COMPLETE AND IN FORCE.** Created 2026-08-03 as a draft; **filled in and closed
the same day** across ~20 sequenced questions with Sean. Implemented in WP5/WP6
(2026-08-03/04). Header corrected 2026-08-06 — it had been left reading "DRAFT AWAITING
SEAN'S MARKUP / blocks WP5" for three days after it stopped being either.

**This is the authoritative answer key.** §3.5 carries the per-category assignments, §12
the WP5 implementation checklist, §9.3a the player-map spec.

> ### ⚠️ This file and `js/export_core.js` are two halves of one thing
> `FIELD_LEVELS` (`export_core.js:550`) is the executable form of this table. **Changing a
> level in one without the other makes them silently disagree** — and the code is what
> ships, so the divergence favours whatever the code says while this file misleads the next
> reader.
>
> **Audited 2026-08-06 by diffing the two mechanically**, not by reading. 91 tagged labels
> in `FIELD_LEVELS` against 58 explicitly-levelled rows here. **One real drift:**
> `Gas Giants`, live since 2026-08-04 — the code was right, this table was not (§8). Two
> apparent mismatches were **correct**: `Mass` and `Eccentricity` legitimately differ
> between the `star` and `world` contexts (b/e and b/d), which is exactly why tagging is
> keyed on **(context, label)** rather than label alone. Everything else agreed.
>
> **When auditing this, compare per context.** A flat label comparison reports the three
> deliberate collisions — `Mass`, `Eccentricity`, `Orbit ID` — as failures, and the
> temptation is then to "fix" one of them, which would leak stellar data at world level or
> hide world data that should show.

**Parent manifest:** `directives/html_extract_manifest.md` — §5.1 (the ladder), §5.2 (the
leak audit, now closed) and §5.3 (the answered questions). Its §0.3 carries the standing
rules; its §4.5-4.7 describe how this table was implemented, including the leaks a
field-by-field pass missed.

---

## 0. How this was filled in — historical, retained for the reasoning

The instructions below were written for Sean's markup pass. **That pass is done; nothing
here is awaiting input.** They are kept because the conventions still govern how the table
reads, and because §11.1's reversed rule must not be silently restored.

| Entry | Meaning |
|---|---|
| `0`–`g` | The **lowest** level at which this field becomes visible. Cumulative — a field marked `d` is visible at d, e, f and g. |
| `never` | Never exported to players at any level. |
| `?` | Was "discuss rather than decide now". **No `?` rows remain.** |

There is deliberately **no `derived` entry** — every field carries its own explicit level.
See §11.1; that rule was proposed, adopted, and reversed on the same day, so check there
before reintroducing it.

**Rows marked ✓ were pre-filled** — the fields the ladder names explicitly, so not guesses.
Everything else was blank on purpose and answered by Sean. Per the Zero-Assumption Policy no
level was inferred for any field the ladder does not name, including ones where an
assignment might seem obvious. **The same applies to any field added from here on:** an
untagged field fails closed to `'g'` and is recorded by
`ExportCore.getUnknownFieldLabels()`, which the harness asserts is empty — so a new field
cannot leak, but it will fail the check until it is tagged here *and* in `FIELD_LEVELS`.

### The ladder, for reference (§5.1, cumulative)

- **(0)** — **ADDED 2026-08-03.** Unknown. The hex renders blank: no dot, no page, no
  index row, nothing. Not in Sean's original list; added because (a) is otherwise an
  unavoidable baseline, which contradicts HX-4.
- **(a)** Just say if there is a star present
- **(b)** Show stellar details
- **(c)** Stellar details and gas giant presence
- **(d)** Stellar details, GG presence, world count and belt presence
- **(e)** As above plus Size, Hydro and Atmosphere of each world
- **(f)** As above plus Pop and Tech Level
- **(g)** Full UWP for each world

### Decisions already made (do not re-open here)

Answered 2026-08-03 unless noted.

- **Per-system only** (HX-3) — one level per hex, no per-body override.
- **Generic world labels until (g)** (HX-2) — "World 1", "Belt 1" below g.
- **Nothing is unconditionally visible** (HX-4) — hence level (0) above.
- **No player notes field** (HX-5) — GM notes never export.
- **Withheld = absent** — no placeholder text, ever.
- **Level (0) "Unknown" exists** — a system can be absent from the player export
  entirely. This is what makes (a) a real positive disclosure.
- **Every field is assigned independently** (§11.1) — no input-inheritance, no `derived`
  fields. A value a player could compute themselves is still withheld unless its own
  level permits it. **This reverses an earlier same-day decision; do not restore it.**
- **Moons: counted at (d), fields inherit the parent world** (§5) — keeps lunar
  mainworlds coherent.
- **Starport = (g)**, strict with the rest of the UWP (§11.2).
- **System name = (d)**; **Hex = (a)** by construction (§1.1, §1.2).

### Filename scheme — a consequence, not a separate decision

System name is (d), so at levels **(a)–(c) page filenames must be hex-only**
(`1910.html`) and switch to `Regina (1910).html` at (d)+. Per HX-2, **body image
filenames use the generic label** ("World 2") until (g). Getting this wrong reproduces
the §5.2.2 leak through the folder listing rather than the page.

---

## 1. System-level identity and map presence

These are the rows HX-4 created. They are not fields in a formatter — they decide whether
a system page can exist at all, and what it can be called.

| # | Item | Where it lives | Lvl | Note |
|---|---|---|---|---|
| 1.1 | System name | `resolveSystemName` | ✓ **d** | Answered 2026-08-03. Filenames are hex-only below (d) — see the filename note in §0 |
| 1.2 | Hex ID | hex key | ✓ **a** | By construction, not a choice: if a system appears on the map at all its position is disclosed. Level (0) is what hides it |
| 1.3 | Star present (the dot on the map) | `renderer.js` `draw()` | ✓ **a** | This *is* level (a) |
| 1.4 | Allegiance | 6 formatters | ✓ **a** | Chart data — printed on any commercial star map regardless of survey status |
| 1.5 | Region | 6 formatters | ✓ **a** | As 1.4 |
| 1.6 | Travel Zone (Amber/Red ring + field) | `detailBlocks`, `systemOverviewBlocks` ×3 | ✓ **a** | A warning that is withheld is not a warning. See the misreporting note below. CT records no travel zone at all |
| 1.7 | Sector / subsector name | breadcrumbs, folder layout | ✓ **a** | By construction, like Hex — D3's merge model *is* the folder layout `Sector/Subsector X/`. Not a free choice |
| 1.8 | Edition (MgT2E / CT / T5 / RTT / AoW) | metadata block, `data-*` | ✓ **a** | Out-of-fiction metadata — names the ruleset, not anything in the setting. Keeps pages self-describing |

### 1.6a — Why Travel Zone had to be (a), not merely why it should be

`export_core.js:433` emits this field **only when it is not Green**. Absence therefore
already encodes "Green". Under the "withheld = absent" rule, gating a Red zone would not
have hidden it — it would have **misreported the system as safe**, which is worse than
either showing or hiding it.

Putting Travel Zone at (a) avoids this entirely. **If it is ever moved to a higher level,
WP5 must first change the exporter to emit an explicit `Zone: Green`,** or the same
false-negative returns. Do not move this field without doing that first.
| 1.9 | Referee notes | `notesBlocks` | ✓ **never** | HX-5 — resolved |
| 1.10 | **Mainworld identification** | metadata block, `Mainworld UWP`, body marker | ✓ **g** | Answered 2026-08-03. Fully consistent with HX-2 — nothing singles out a specific world until (g). See the consequence note below |

### 1.10a — Consequence: the index is deliberately sparse below (g)

Mainworld identification at (g) plus Starport at (g) plus UWP at (g) means the subsector
index's UWP, Starport, TL, Trade Codes and Bases columns are **all** (g) data — they
describe the mainworld. Below (g) a player index carries little more than Hex, System name
(from d) and Gas Giant (from c).

Combined with the existing "drop columns with no data anywhere in the subsector" rule
(§4.2.5 of the parent manifest), a level (b) subsector index renders as a bare list of
hexes. **This is intended, not a defect** — Sean chose the strict reading at every one of
these questions. Do not "fix" it by promoting fields.

### 1.10b — Why the mainworld's name does not leak at (d)

`resolveSystemName` (`export_core.js:127-132`) falls back to `sys.mainworld.name`, and by
Traveller convention a system is named for its mainworld — so the (d) system name does
imply *a* world is called Regina. It does not say **which** one, because 1.10 holds
mainworld identification to (g) and HX-2 holds world names to (g). The inference stops
there, which is why (d) for the system name and (g) for the mainworld are consistent
rather than contradictory.

---

## 2. System overview (`systemOverviewBlocks`)

**CLOSED 2026-08-03.** Split on what the data describes: age and habitable-zone geometry
follow from the stars disclosed at (b); Nature and Total Orbits describe the system's
contents and architecture, which is (d).

| # | Field | Lvl | Note |
|---|---|---|---|
| 2.1 | Age | ✓ **b** | Gyr. MgT2E branch |
| 2.2 | HZco (Primary) | ✓ **b** | |
| 2.3 | P-Type HZco | ✓ **b** | |
| 2.4 | P-Type Inner Limit | ✓ **b** | |
| 2.5 | Nature | ✓ **d** | CT branch |
| 2.6 | Total Orbits | ✓ **d** | CT branch. Held to (d) precisely because it approximates the world count |
| 2.7 | Gas giant **presence** (yes/no) | ✓ **c** | Ladder names it. A yes/no line only — see 2.10 |
| 2.8 | Gas giant **count** | ✓ **d** | The ladder grants presence at (c), not a number |
| 2.9 | Belt presence **and** count | ✓ **d** | Sean 2026-08-04: belts appear as bodies at (d) like worlds |
| 2.10 | World count | ✓ **d** | Ladder names it |

### 2.10a — Presence is not a count, and a section is a count

**Decided 2026-08-04, after Sean found the leak.** Below (d) a system page carries **no
body sections at all** — no headings, no contents entries, no anchors, and in Obsidian no
per-body files. Emptying a section is not withholding it: the *number*, *order* and *type*
of bodies remain visible, and body count is (d).

Gas giant presence at (c) is therefore expressed as a single **`Gas Giants: Present`** line
in the system overview — no number, no sections. It disappears at (d), where the gas giants
appear as bodies and the count follows naturally. This matches the subsector map, which has
always drawn **one** marker per system regardless of how many gas giants there are, and the
index's GG column, which is a boolean.

**Not a field, but emitted here:** the **T5** branch of `systemOverviewBlocks`
(`export_core.js:443-450`) prints one line per star as `role → name (Lum: x)`. That line
carries a **star name**, so it is governed by §3.11 below, not by this table.

---

## 3. Stellar fields

**CLOSED 2026-08-03. Every star field is (b)** — "stellar details" means the whole star
block, orbital geometry included.

| # | Field | Formatter | Lvl | Note |
|---|---|---|---|---|
| 3.1 | Spectral Type | CT, T5 star | ✓ **b** | |
| 3.2 | Luminosity Class | CT, T5 star | ✓ **b** | |
| 3.3 | Decimal (subtype) | T5 star | ✓ **b** | |
| 3.4 | Luminosity | T5 star, `fallbackStarBlocks` | ✓ **b** | |
| 3.5 | Mass | MgT2E star, `fallbackStarBlocks` | ✓ **b** | |
| 3.6 | Separation | MgT2E star | ✓ **b** | |
| 3.7 | Orbit / Orbit ID | MgT2E, CT, T5 star | ✓ **b** | |
| 3.8 | Eccentricity | MgT2E star | ✓ **b** | |
| 3.9 | MAO (min allowable orbit) | MgT2E star | ✓ **b** | |
| 3.10 | **Star count** (is it binary/trinary?) | map + section count | ✓ **a** | A companion is resolvable at the same range as the primary. Level (a) therefore means "what stars are here", not "is anything here" |
| 3.11 | **Star names** | `starDisplayName` | ✓ **d**, generic below | See the leak note directly below |

### 3.11a — Star names leak the system name. Handle in WP5.

`starDisplayName` (`export_core.js:120-123`) returns `star.name` plus an A/B/C suffix for
multi-star systems, and `star.name` is normally **the system's own name**. Since stellar
details arrive at (b) but the system name is (d), rendering "Regina A" as a section
heading at level (b) discloses "Regina" two levels early.

**Decision: stars show generic role labels ("Primary", "Companion B") below (d) and real
names at (d)+.** Consistent with HX-2's treatment of world names, and it reuses the same
generic-label branch WP5 needs anyway.

Affects three sites, all of which must use the gated name: section headings, the page
contents list, and the **T5 System Overview lines** noted at the end of §2.

---

## 3.5 GROUP ASSIGNMENTS — THE ANSWER KEY (agreed 2026-08-03)

**This section supersedes the per-field tables in §4, §6 and parts of §7/§8.** Those were
the blank form; this is the filled-in answer. Where they disagree, this wins.

Sean assigned per-body fields by **category rather than field**, cutting across all five
engines. Assigning ~100 fields individually was not a good use of anyone's time, and the
categories are what the levels actually track.

| G | Category | Fields | **Lvl** |
|---|---|---|---|
| **1** | **Orbital position & motion** | Distance, Orbit, Orbit ID, Orbit Type, Orbit (⌀), Period, Orbital Period, Eccentricity, Axial Tilt, Rotation, Rotation Period, Solar Day, CT's orbital Zone | **d** |
| **2** | **Bulk physical & geology** | Composition, Lithosphere, Magnetic Field, Albedo | **e** |
| **3** | **Atmosphere detail** | Gases, O₂ Fraction, Pressure, Taints, Breathability | **e** |
| **4** | **Temperature** | Mean, Low, High, Temperature, Mean Temperature, Mean Temp (fallback), Climate Zone | **e** |
| **5** | **Body classification** | Classification, World Type, World Class, Type, Chemistry | **d** |
| **6** | **Biology & habitability** | Native Life, Biosphere, Habitability* | **f** |
| **7** | **Development & economy** | Resource Rating, Secondary RU, Desirability, Industry, Habitation, Terraforming Potential | **f** |
| **8a** | **Gas giant profile** | SAH Code | **g** |
| **8b** | **Belt profile** | Profile, Span, Bulk, M-Type, S-Type, C-Type, O-Type | **f** |

Already fixed outside the groups: **Diameter/Size = e**, **Hydrographics = e**,
**Atmosphere = e**, **Water Coverage = e**, **Gravity = e**, **Mass = e**, **Density = e**,
**Population = f**, **Tech Level = f**, **Starport = g**, **Trade Codes = g**,
**Allegiance = a**, **Region = a**, **Travel Zone = a**.

**There are no `derived` fields.** Every field carries its own explicit level — see §11.1,
and note that rule was reversed once, so do not reintroduce input-inheritance.

### The reasoning, so it is not re-litigated

- **(d) is the "distant survey" tier** — where bodies are, how they move, and what kind of
  thing each one is. Groups 1 and 5 are what you measure before you know anything about a
  surface, which is why putting them later would have been backwards.
- **(e) is the "what is it like to stand there" tier** — size, air, water, temperature,
  makeup. Groups 2, 3 and 4 are all facets of the same close-pass characterisation.
- **(f) is the "who and what lives here" tier** — population, tech, biosphere, economy.
  Groups 6, 7 and 8b. RTT's `Habitation` is a population statement in all but name.
- **(g) is the headline stat string** — the UWP and its gas-giant equivalent, plus
  anything that identifies a specific body by name.

### * Habitability — RESOLVED, no conflict

Briefly contested: Group 6 puts `Habitability` at **(f)**, and under the short-lived
input-inheritance rule it would have been forced to (e) by its inputs. **That rule was
reversed** (§11.1), so **Group 6's (f) simply stands** for all three fields —
`Native Life`, `Biosphere` and `Habitability`. No exception, no per-field carve-out.

---

## 4. World physical data — MgT2E (`formatMgtWorldFields`, 39 emissions)

> **SUPERSEDED by §3.5.** Retained as the field inventory — it is the accurate list of
> what the formatter emits — but the blank `Lvl` cells below are answered by the group
> table above. Do not fill these in individually.

| # | Field | Lvl | Note |
|---|---|---|---|
| 4.1 | Classification | | |
| 4.2 | Orbit ID | | |
| 4.3 | Orbit Type | | |
| 4.4 | Distance | | |
| 4.5 | Eccentricity | | |
| 4.6 | Period | | |
| 4.7 | Composition | | |
| 4.8 | Density | | |
| 4.9 | Gravity | | Derivable from Size — see §11.1 |
| 4.10 | Mass | | Derivable from Size — see §11.1 |
| 4.11 | Diameter (×2 emissions) | ✓ **e** | This is UWP "Size" |
| 4.12 | Hydrographics | ✓ **e** | Ladder names it |
| 4.13 | Temperature — Mean | | |
| 4.14 | Temperature — Low | | |
| 4.15 | Temperature — High | | |
| 4.16 | Gases | | |
| 4.17 | O₂ Fraction | | |
| 4.18 | Atmosphere | ✓ **e** | Ladder names it |
| 4.19 | Pressure | | Closely implies Atmosphere |
| 4.20 | Taints | | |
| 4.21 | Solar Day (×2) | | |
| 4.22 | Axial Tilt | | |
| 4.23 | SAH Code | | |
| 4.24 | Profile | | |
| 4.25 | Span | | |
| 4.26 | Bulk | | |
| 4.27 | Resource Rating (×2) | | |
| 4.28 | M-Type | | |
| 4.29 | S-Type | | |
| 4.30 | C-Type | | |
| 4.31 | O-Type | | |
| 4.32 | Native Life | | Arguably a major reveal |
| 4.33 | Habitability | | |
| 4.34 | Secondary RU | | |

---

## 5. Moon / satellite data — CLOSED 2026-08-03

**Moon existence is part of (d)'s world count, and every moon field inherits whatever
level the same field carries on a full world.** No separate moon assignments are needed —
this section requires no markup.

Chosen partly to keep **lunar mainworlds** coherent: this codebase supports a moon *being*
the mainworld (23 of 38 MgT2E systems in the test fixture have one, see
[[project-lunar-mainworld-pattern]]), so a rule that hid moons would have shown a
mainworld with no body to sit on.

Covered by the inheritance rule, for reference:

- **MgT2E moons** (`formatMgtMoonFields`, 23) — Orbit (⌀), Eccentricity, Period,
  Composition, Density, Gravity, Mass, Diameter, Hydrographics, Mean/Low/High temp, Gases,
  O₂ Fraction, Atmosphere, Pressure, Taints, Solar Day ×2, Axial Tilt, Native Life,
  Habitability, Resource Rating
- **CT satellites** (`formatCtSatFields`, 8) — Distance, Gravity, Mass, Temperature,
  Rotation Period, Axial Tilt, Allegiance, Region
- **T5 satellites** (`formatT5SatFields`, 6) — World Type, Climate Zone, Diameter,
  Gravity, Mass, Rotation

**Implementation note for WP5 — RESOLVED 2026-08-03.** A moon field with no world
counterpart has nothing to inherit from. Audited during slice 5a: **`Orbit (⌀)` is the only
one**, and it was raised with Sean rather than defaulted → **(d)**, Group 1 orbital
position. The CT/T5 satellite formatters emit a narrower set than their world formatters,
but every label they use also exists on a world, so inheritance covers them. Verified by
sweeping 2620 moons with zero untagged labels.

---

## 6. World physical data — other engines

> **SUPERSEDED by §3.5**, same as §4 — inventory kept, levels answered by the group table.

**CT** (`formatCtBodyFields`, 12)

| # | Field | Lvl |
|---|---|---|
| 6.1 | Orbit | |
| 6.2 | Zone | |
| 6.3 | Distance | |
| 6.4 | Orbital Period | |
| 6.5 | Diameter | ✓ **e** (UWP Size) |
| 6.6 | Gravity | |
| 6.7 | Mass | |
| 6.8 | Temperature | |
| 6.9 | Rotation Period | |
| 6.10 | Axial Tilt | |

**T5** (`formatT5WorldFields`, 9)

| # | Field | Lvl |
|---|---|---|
| 6.11 | Distance | |
| 6.12 | World Type | |
| 6.13 | Climate Zone | |
| 6.14 | Diameter | ✓ **e** (UWP Size) |
| 6.15 | Gravity | |
| 6.16 | Mass | |
| 6.17 | Rotation | |

**AoW** (`formatAoWBodyFields`, 17)

| # | Field | Lvl |
|---|---|---|
| 6.18 | Distance | |
| 6.19 | Eccentricity | |
| 6.20 | Mass | |
| 6.21 | Density | |
| 6.22 | Gravity | |
| 6.23 | Diameter | ✓ **e** (UWP Size) |
| 6.24 | Axial Tilt | |
| 6.25 | Albedo | |
| 6.26 | Mean Temperature | |
| 6.27 | Pressure | |
| 6.28 | Water Coverage | ✓ **e** (this is Hydrographics) |
| 6.29 | Breathability | |
| 6.30 | World Class | |
| 6.31 | Lithosphere | |
| 6.32 | Magnetic Field | |

**RTT** (`formatRttBodyFields`, 12)

| # | Field | Lvl | Note |
|---|---|---|---|
| 6.33 | Type | | |
| 6.34 | World Class | | |
| 6.35 | Chemistry | | Prints explicit "None" — HX-7.1, keep |
| 6.36 | Biosphere | | |
| 6.37 | Rings | ✓ **d** | **Assigned 2026-08-03**, outside the eight groups — it is neither classification, geology, atmosphere nor development. Grouped with body classification because a ring system is remotely observable. Prints explicit "None" — HX-7.1, keep |
| 6.38 | Habitation | | |
| 6.39 | Desirability | | |
| 6.40 | Industry | | |
| 6.41 | Starport | | UWP digit 1 — see §11.2; RTT gives nearly every body one (HX-7.2) |
| 6.42 | Terraforming Potential | | |

**Fallback physical** (`fallbackPhysicalBlocks`, used when no raw body resolves):
Gravity, Diameter, Mean Temp.

| # | Field | Lvl |
|---|---|---|
| 6.43 | Gravity (fallback) | |
| 6.44 | Diameter (fallback) | ✓ **e** |
| 6.45 | Mean Temp (fallback) | |

---

## 7. The UWP itself

The ladder ends at **(g) full UWP**, but (e) and (f) disclose individual digits, so the
UWP string and its breakdown table need explicit handling.

| # | Item | Lvl | Note |
|---|---|---|---|
| 7.1 | UWP **string** (e.g. `A867949-C`) | ✓ **g** | Ladder's top rung |
| 7.2 | UWP breakdown table (`uwpTableBlocks`) | ✓ **g** | Never partial. The disclosed digits appear as ordinary prose fields at their own levels; the table itself arrives whole at (g). A partially filled table would advertise how many digits are withheld, against "withheld = absent" |
| 7.3 | Starport (digit 1) | ✓ **g** | Answered 2026-08-03 — strict reading, the UWP arrives whole. Governs hundreds of rows in RTT (HX-7.2) |
| 7.4 | Size (digit 2) | ✓ **e** | |
| 7.5 | Atmosphere (digit 3) | ✓ **e** | |
| 7.6 | Hydrographics (digit 4) | ✓ **e** | |
| 7.7 | Population (digit 5) | ✓ **f** | |
| 7.8 | Government (digit 6) | ✓ **g** | Not named in the ladder; assigned 2026-08-03 |
| 7.9 | Law Level (digit 7) | ✓ **g** | As 7.8 |
| 7.10 | Tech Level (digit 9) | ✓ **f** | |
| 7.11 | Trade Codes (`detailBlocks`) | ✓ **g** | Explicitly assigned, consistent with every other UWP-adjacent field. (Was briefly recorded as `derived → g` under the reversed rule; same outcome) |
| 7.12 | Bases — Naval (N), Scout (S) | ✓ **g** | Published infrastructure, on charts |
| 7.13 | Bases — **Corsair (P)** | ✓ **never** | A pirate base is not survey data. Once exported it cannot be un-revealed; this stays a discovery made in play. **Do not "restore" it for consistency with N/S** |

**Open sub-question (7.2):** at level (e), is the breakdown table shown with only
Size/Atm/Hydro populated and the rest blank, or is the table withheld entirely until (g)
with the three digits appearing as ordinary prose fields?

---

## 8. Socioeconomics — CLOSED 2026-08-03: **the entire block is (g)**

**Every socioeconomic field is (g)**, both engines, no exceptions. This is the deep detail
behind the UWP — faction politics, judicial profiles, trade ratings, military strength —
and Government, Law and Starport are already (g), so their expanded profiles belong with
them. **(f) stays limited to the headline Population and Tech Level the ladder names.**

Three rows are **not** governed by this and keep their earlier, lower assignments, because
they are system-inventory facts that happen to be stored in the T5 socio object rather
than socioeconomics at all: **Belts (d)**, **Gas Giants (d)**, **Worlds (d)**. Do not
sweep them to (g) when implementing.

> **`Gas Giants` was corrected (c) → (d) on 2026-08-04**, during the body-count leak fix
> (manifest §4.7). It is a **count**, and the ladder grants only *presence* at (c) — so (c)
> was an inconsistency in this table's own reasoning, not a deliberate exception. Gas giant
> presence at (c) is a separate, numberless `Gas Giants: Present` line (§4 below / manifest
> §4.7); the count arrives at (d) with the bodies themselves. `export_core.js:529` reads
> `'Gas Giants': 'd'` and is the executable authority — **these two must always agree.**

`Total Population` is **(f)**, not (g) — it is the ladder's own Pop.

### 8a — `H`, `A`, `S`, `Sym` are undocumented. Not a disclosure problem.

`formatT5Socio` (`export_core.js:774-777`) emits these as **bare single-letter labels**
straight from `s.H`/`s.A`/`s.S`/`s.Sym`. Nothing in the codebase expands them, and their
meaning was **not** guessed — same treatment as HX-8's deferred AoW terms.

Since the whole socio block is (g), they are disclosed only at full disclosure, so the
unknown meaning creates no leak risk. It is a **documentation gap, not a fog-of-war
gap** — worth fixing one day against the T5 rules, out of scope for Release 2.

### The inventory (all (g) unless noted above)

**MgT2E** (`formatMgtSocio`, 23)

| # | Field | Lvl |
|---|---|---|
| 8.1 | pValue | |
| 8.2 | Total Population | ✓ **f** |
| 8.3 | PCR | |
| 8.4 | Urban % | |
| 8.5 | Urban Population | |
| 8.6 | Major Cities | |
| 8.7 | Major City Population | |
| 8.8 | Government Profile | |
| 8.9 | Factions | |
| 8.10 | Judicial Profile | |
| 8.11 | Law Profile | |
| 8.12 | Tech Profile | |
| 8.13 | Cultural Profile | |
| 8.14 | Cultural Quirks | |
| 8.15 | Importance (Im) | |
| 8.16 | Economic Profile | |
| 8.17 | Resource Units (RU) | |
| 8.18 | Per-Capita GWP | |
| 8.19 | World Trade Number (WTN) | |
| 8.20 | Import Rating (IR) | |
| 8.21 | Discount Rate (DR) | |
| 8.22 | Starport Profile | |
| 8.23 | Military Profile | |

**T5** (`formatT5Socio`, 14)

| # | Field | Lvl |
|---|---|---|
| 8.24 | Pop Multiplier | |
| 8.25 | Belts | ✓ **d** (belt presence) |
| 8.26 | Gas Giants | ✓ **d** (GG **count**) — corrected from `c` 2026-08-04, see §8 note |
| 8.27 | Worlds | ✓ **d** (world count) |
| 8.28 | Importance (Ix) | |
| 8.29 | Resource Units (RU) | |
| 8.30 | R (Resources) | |
| 8.31 | L (Labor) | |
| 8.32 | I (Infrastructure) | |
| 8.33 | E (Efficiency) | |
| 8.34 | H | |
| 8.35 | A | |
| 8.36 | S | |
| 8.37 | Sym | |

**Tech Level** appears via `detailBlocks` (§7.10, pre-filled **f**).

---

## 9. Images and the map — the non-text leak surfaces

These leak *visually* and cannot be handled by the field filter. See §5.2 of the parent
manifest. Provisional levels from §5.2.3 are marked ⚠ — they were the agent's reasoning,
**not your decision**, so please confirm or change them.

| # | Surface | Lvl | Why it leaks |
|---|---|---|---|
| 9.1 | World images (globe / flat-map) | ✓ **e** | A rendered planet *is* a picture of its hydrographics and atmosphere — so it gates at the level of the data it depicts, the same principle as §11.1 |
| 9.2 | Orrery / system images | ✓ **d** | Reveals world count, belts and gas giants at a glance. **Must re-render with generic body labels below (g)** — see 9.2a |
| 9.3 | Subsector map PNG | ✓ **inherit** | Each drawn element gates at its own field's level — see 9.3a. This is WP6 |
| 9.4 | Hex-map hover tooltips (SVG `<title>`) | ✓ **inherit** | Carries the system name, so it follows §1.1 — no label below (d) |
| 9.5 | Map hotspot *existence* | ✓ **a** | Automatic: a hotspot means the hex has a page, and only level (0) has no page |

### 9.3a — What the player map draws, by level

**Every rendered element inherits the level of the field it displays.** One rule, and it
makes the map auditable against the same assignments as the pages, rather than being a
separate policy nobody can check.

| Level | Map shows |
|---|---|
| **(0)** | nothing — blank hex |
| **(a)** | star dot (incl. multi-star count, §3.10), travel-zone ring, allegiance colour, region |
| **(c)** | + gas giant marker |
| **(d)** | + system name label |
| **(g)** | + UWP string, trade codes, starport class, base codes (naval/scout only — **never corsair**) |

This settles the §5.2.1 nondeterminism as a side effect: the player map is driven by the
disclosure level, **not** by whatever display toggles the GM happened to have switched on
at export time. WP6 must ignore the live toggles for player exports rather than inherit
them.

### 9.2a — Orrery labels are a rendered leak, and the hardest single item in WP5

Confirmed 2026-08-03: orrery snapshots are rendered **with body labels drawn onto the
image**. Releasing an orrery at (d) while world names are held to (g) would leak every
name in the system as pixels — invisible to any text-based filter or parity check.

**Decision: orreries re-render with generic labels ("World 1", "Belt 1") below (g), real
names at (g)+.** This is not a filter, it is a second rendering path, and it is the one
place in Release 2 where the fog cannot be applied downstream of the exporter.

Note this is the *same class of bug* as §5.2.1's subsector map — a picture that bypasses
the field filter — and the reason WP6 exists. Budget for it accordingly.

**Note on 9.1 under HX-2:** at (e) and (f) an image is emitted for a world whose *name* is
withheld. Image filenames must therefore use the generic label ("World 2"), not the real
name, or the filesystem leaks what the page withholds.

---

## 10. Index tables

Per HX-4 nothing is unconditionally visible, so the index is a disclosure surface in its
own right. Current Q1 column set:

| # | Column | Lvl | Note |
|---|---|---|---|
| 10.1 | Hex | | = §1.2 |
| 10.2 | System | | = §1.1 |
| 10.3 | UWP | | = §7.1 |
| 10.4 | Starport | | = §7.3 |
| 10.5 | TL | | = §7.10 |
| 10.6 | Trade Codes | | = §7.11 |
| 10.7 | GG | | = §2.7 |
| 10.8 | Bases | | = §7.12 |
| 10.9 | Zone | | = §1.6 |

**CONFIRMED 2026-08-03: every column inherits its field's level.** The existing "drop
columns with no data anywhere in the subsector" rule (§4.2.5 of the parent manifest) then
handles low-level exports with no extra machinery.

Resulting column availability:

| Level | Index columns present |
|---|---|
| (a)–(b) | Hex, Zone |
| (c) | + GG |
| (d)–(f) | + System |
| (g) | + UWP, Starport, TL, Trade Codes, Bases |

**A level (b) subsector index is therefore two columns wide.** That is intended, not a
defect — see §1.10a. Sean took the strict option at every UWP-adjacent question, and a
sparse index is the direct consequence. **Do not add a placeholder row or an explanatory
message**; that would break the "withheld = absent" rule.

---

## 11. Cross-cutting questions the table cannot express

These are not per-field decisions and need separate answers.

**11.1 — Derived values — FINAL ANSWER 2026-08-03 (revised): every field is assigned
independently. A derived value is shown only when it is explicitly called out.**

There is **no automatic inheritance from inputs**. `level(field)` is whatever the tables in
this document say it is, full stop. A field the player could work out for themselves from
data already on the page is still withheld unless its own level permits it.

**This is a deliberate acceptance that fog of war is a presentation filter, not a
guarantee.** A player at (e) who has Size can compute gravity with a calculator; the page
simply will not print it unless gravity's own level allows. That redundancy is fine and is
not a leak to be closed.

### Revision history — read this before "restoring" anything

An earlier answer the same day chose the opposite rule (derived fields auto-appear once
all their inputs are visible). **Sean reversed it before any code was written.** The
reversal is the current decision. Two things it bought:

1. **WP5 needs no dependency graph.** Under the old rule every derived field needed its
   inputs' levels resolved at render time; now the filter is a flat lookup.
2. **HX-1a is cancelled** — see below.

Do not reintroduce input-inheritance on the grounds that a page "coyly hides a computable
number". That is the known, accepted consequence.

### Fields the reversal put back in play, and where they landed

| Field | Level | Note |
|---|---|---|
| Gravity, Mass, Density | **e** | Assigned 2026-08-03 with the physical tier — the same level the old rule would have produced, so nothing shifted |
| Trade Codes | **g** | Bookkeeping change only: previously recorded as `derived → g`, now explicit **g**. Same outcome |
| Water Coverage (AoW) | **e** | Already explicit |
| Habitability | **f** | **Conflict resolved.** Group 6's (f) now simply stands; the old rule would have overridden it to (e). See §3.5 |
| HZco, P-Type HZco, P-Type Inner Limit | **b** | The "likely also derived" caveats on §2.2-2.4 are void — (b) stands as assigned |
| Temperature group, Pressure | **e** | Same — the derived caveats on Groups 3 and 4 are void |

**11.1a — CANCELLED 2026-08-03. Do not do this work.**

This required extracting a per-engine derivation map from `mgt2e_world_engine.js`,
`ct_world_engine.js`, the T5/RTT/AoW engines and `universal_math.js` — roughly 15,000
lines — to establish which fields are genuinely computed and from what. **With
input-inheritance gone, nothing consults that map.** The task was started and stopped
immediately on the rule reversal; no findings were produced and none are needed.

Reopen **only** if the input-inheritance rule is ever reinstated. If it is, the two traps
identified before the work stopped still apply: "Pressure ≈ Atmosphere" was an unverified
assumption rather than an established fact, and derivations may **differ per engine** —
AoW computes physical properties from a disk worksheet where MgT2E rolls and then derives,
so the same label can be derived in one engine and independently rolled in another.

**11.2 — Starport — ANSWERED 2026-08-03: (g), with the rest of the UWP.** Strict reading
of the ladder — the UWP is one thing and it arrives whole. Sean declined the earlier
options despite the argument that a starport is public infrastructure. **Do not revisit
this on the grounds that it makes low-level exports sparse; that is the intended effect.**

**11.3 — Belts and gas giants — ANSWERED 2026-08-03 by Group 8.** Yes, they get physical
detail: a gas giant's `SAH Code` (its UWP equivalent) at **(g)**, and a belt's
`Profile`/`Span`/`Bulk`/M-S-C-O composition at **(f)**. Their shared orbital and
classification fields follow Groups 1 and 5 like any other body, so both appear as typed
bodies in real orbits from **(d)**.

**11.4 — Mainworld vs the rest of the system — SETTLED by HX-3, no separate decision.**
There is no per-body override, so at level (e) *every* world in the system shows
Size/Hydro/Atm, not just the mainworld. Note this compounds with §1.10: at (e) and (f) the
export shows a set of equally-detailed unnamed worlds and does not say which one matters.

---

## 12. Sign-off

| | |
|---|---|
| Table produced | 2026-08-03 |
| Levels agreed with Sean | **2026-08-03 — COMPLETE** |
| Cross-cutting §11 answered | **2026-08-03 — COMPLETE** |
| **HX-1 status** | **CLOSED. Nothing outstanding.** |

**Every field, image, map element and index column carries an explicit level.** There are
no pending questions, no `?` entries and no verification tasks. **WP4, WP5 and WP6 are all
unblocked**; WP6's spec is §9.3a and WP5's checklist is below.

### Implementation checklist for WP5 — **ALL DELIVERED. Retained as the audit list.**

These are the items with no text-filter equivalent: field filtering, parity checks and link
sweeps cannot catch any of them. All seven were implemented and verified in WP5/WP6
(2026-08-03/04). **Re-check this list against any new export surface** — it is the set of
things that leak through a filter that only sees blocks.

| # | Item | Delivered |
|---|---|---|
| 1 | **Generic body labels** below (g) — worlds, belts, and **stars** (§3.11a) | 5c. Fallbacks reuse the exporter's existing unnamed-body vocabulary, so withheld is indistinguishable from absent |
| 2 | **Page filenames** hex-only below (d) (§0); **image filenames** generic below (g) (§9.1) | 5c — but **gated at the name, not the filename**. Giving the filename helpers their own level broke every Obsidian wikilink, since Obsidian resolves `[[Name]]` by name. One gate, at the name; everything that names a file or link reads from it |
| 3 | **Orrery re-render** below (g) (§9.2a) — "the hardest single item in WP5" | 5d. `SystemViewer.renderSnapshot(state, w, h, { level })`. It took **one level, not two booleans** — the first version drew "Star A" at (d)–(f) while the page said "K0 V A" |
| 4 | **Subsector map** driven by disclosure level (§9.3a) | WP6. `setMapDisclosure`/`_mapShow` in `renderer.js`, installed for one frame in a `try/finally` |
| 5 | **Corsair bases suppressed** at every level (§7.13) | 5b, index included. The map renderer never draws them at all |
| 6 | **Travel Zone must not be gated** without an explicit `Zone: Green` (§1.6a) | Honoured — absence already encodes Green, so gating it alone would have **misreported Red systems as safe** |
| 7 | **Moon fields with no world counterpart** — flag, do not default (§5) | `Orbit (⌀)` was raised with Sean rather than assigned: **(d)**, Group 1 |

**Correction to item 4's original wording.** It said the map should ignore "live display
toggles", on the assumption that the leak was toggle-dependent. It was not — see manifest
§4.6.1: the labels gate only on `zoom > 0.4`, and `captureSubsector` computes its own
`capZoom` (~1.09) regardless of the GM's zoom, so the leak was unconditional and there was
never a setting that suppressed it. The *implementation* is right either way — the
development view is gated too, precisely because `devView` is a toggle the capture inherits.

**Two things this checklist did not anticipate**, both real leaks found later:

- **Structure, not values.** Below (d) the *sections themselves* had to go, not just their
  fields — a blank section still discloses that a body exists, and Obsidian's per-body files
  disclose it from the file listing alone. See manifest §4.7.
- **Hand-assembled output.** Anything built with template literals rather than through the
  block model bypasses `filterBlocks` entirely: HTML's `data-uwp` and SVG `<title>`,
  Obsidian's YAML frontmatter. None appears in rendered body copy.
