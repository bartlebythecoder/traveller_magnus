# TERRAIN SYSTEM — Feature Spec (world images & regional surface maps)

**Target version:** v0.18.0 — **IMPLEMENTED 2026-09-20**, verified in-browser.
**Status of this document:** written 2026-09-21, after the fact. Every prior series has a
directive; the terrain work had only a session log in `project_manifest.md` §0.0.A. This file
replaces that log as the **contract**. §0.0.A keeps only the handful of traps that are about
not losing a session.
**Scope:** `js/terrain_*.js` and `js/planet_renderer.js`, plus the terrain hooks in
`js/export_core.js`, `js/html_exporter.js`, `js/obsidian_exporter.js`, `js/io_manager.js`,
`js/ui_menus.js` and `js/hex_editor.js`.
**Related:** `directives/fog_of_war_field_tags.md`, `directives/html_extract_manifest.md`,
`directives/project_manifest.md` §0.0.A, `utilities/verify_field_v1.html`,
`utilities/lake_calibration.html`, `utilities/test_regional_terrain.html`

> **READ §3 BEFORE EDITING ANYTHING UNDER `js/terrain_*` OR `js/planet_renderer.js`, AND RUN
> `utilities/verify_field_v1.html` AFTERWARDS.** The field version flag is the most dangerous
> thing in this codebase: world images are never stored, so a change to the field silently
> redraws every world in every sector anyone has ever saved.

---

## 1. What the terrain system is — and what it is not

Two tiers of procedurally generated surface, both derived from the same field:

* **The world image** — a whole planet, drawn by `js/planet_renderer.js`.
* **The regional survey sheet** — a 120–220 km patch of that planet's real surface, rendered
  as a cartographic sheet with shaded relief, coastlines, named landforms, scale bar, compass,
  graticule, globe inset and terrain key.

**Terrain is ART, NOT RULES.** Confirmed under the Zero-Assumption Policy: **no Traveller table
in any edition covers surface topography.** It is invented procedurally and constrained only by
UWP facts — size, atmosphere, hydrographics, temperature. **Do not go looking in `rules/` for a
terrain table, and do not invent one.**

Hard scope limits, all still in force:

| | |
|---|---|
| **No manmade features** | No buildings, roads, ports or anything built. Landscape and physical feature names only |
| **Regional tier only** | ~120–220 km across. The **site tier** (~20 km) is a separate, later job and does not exist |
| **Whole-world sheets** | Not built. The world image is the only whole-planet view |
| **Five site slots per body** | Derived from the seed, individually pinnable. `MAX_PINS = 5`, `terrain_pins.js:28` |
| **The world image draws no rivers or lakes** | By design. Hydrology is a regional-sheet feature only. See §10.4 |

---

## 2. Module map — who owns what

| File | Owns | Public surface |
|---|---|---|
| `js/terrain_field.js` | Heightfield: base field, detail cascade, erosion, **hydrology**, site finding, the shared projector | `buildContext, buildRegional, buildGlobalPreview, findSites, projector, seedsFor, erode, vnoise3, ridgedDetail, smoothDetail, continentHeight, remapHeight` |
| `js/terrain_render.js` | Normals, cast shadows, AO, material classification, polar caps, shading | `shade, worldTypeOf, heightToGrey, previewColor, materialsFor, rampFor, isColdDry, isVegetated, waterColors, polarOverlay, polarBlend, tempBand, exoticVariant, computeNormals, castShadows, computeAO, MATERIALS, parseStat` |
| `js/terrain_names.js` | Feature detection and the seeded name generator | `findFeatures, featuresFor, nameFor, makeWord, MIN_SHARE, CAPS, GRID_W, GRID_H, VOCAB` |
| `js/terrain_pins.js` | Site slots and pinning; persists onto the hex state | `MAX_PINS, bodyKey, bodyNameOf, load, setPin, clearPin, clearAll, pinnedCount, mergeSites` |
| `js/terrain_frame.js` | Cartographic frame **and the shared sheet pipeline** | `sheetSetup, renderSheet, compose, surveyId, THEME, PAD_X, PAD_Y, SIDEBAR, niceDistance, fmtDMS, chooseStep` |
| `js/terrain_rivers.js` | Channel tracing and composited river drawing; **the global drainage network** | `buildNetwork, networkFor, inflowFor, drawLocal, linesFromField, smoothLine, GRID_W, GRID_H, DEFAULT_DRAIN_FRACTION` |
| `js/terrain_tectonics.js` | The plate field — **version 2 only**, shared by both tiers | `buildPlates, sample, detailFbm, BOUNDARY_WIDTH` |
| `js/terrain_panel.js` | The entire in-app UI | `open` |

**The hook into shipped code is deliberately ONE button.** `js/hex_editor.js:2236` guards on
`if (window.TerrainPanel)` and calls `TerrainPanel.open(...)` at 2247. **Keep it that way** —
the panel owns its own UI so that the shipped editor carries no terrain knowledge.

**`buildNetwork`, `networkFor` and `inflowFor` have NO CALLERS and must not be deleted as dead
code.** They are the only whole-world drainage network in the codebase, and the flat world image
draws no rivers yet. The module header carries the same note. Keep both in step.

---

## 3. RULE 1 — the field version contract

**World images are never stored.** They are recomputed from the seed every time they are
viewed. So any change to the field function silently redraws every world in every existing
sector the moment a user upgrades — same UWP, same name, different planet.

`terrainFieldVersion` exists to make that opt-in.

* It lives in the **save envelope's `settings`** — per sector, which is correct, because the
  model is a property of the sector and not a user preference.
* **Absent means 1.**
* There is deliberately **no localStorage mirror**, so a stale browser value can never outvote
  a loaded file.

| Version | What | Status |
|---|---|---|
| **1 — Classic** | The shipped pre-v0.18 terrain | **FROZEN. MUST NEVER CHANGE.** |
| **2 — Tectonic** | Plate tectonics; what a NEW sector starts on | Where every improvement goes (§4) |

Settings → World Image Generation → **Use Classic World Images** drops a sector back to
version 1.

### 3.1 Two defaults, deliberately different numbers — do not reconcile them

| Site | Value | Means |
|---|---|---|
| `TERRAIN_MODEL_DEFAULT`, `js/ui_menus.js:4324` | **2** | The model a NEW sector starts on |
| `s.terrainFieldVersion ?? 1`, `js/io_manager.js:537` (written back at `:110`) | **1** | A LOADED file with no key predates the flag, so its worlds were drawn on the Classic field |

**Raising the load fallback to match the control is forbidden.** It would silently redraw every
world in every sector saved before v0.18 — precisely the outcome the flag exists to prevent.

**`verify_field_v1.html` will NOT catch that mistake.** The harness pins
`window.terrainFieldVersion = 1` itself and never loads `ui_menus.js` or `io_manager.js`, so it
proves the v1 *field function* is unchanged — not that old files still *select* v1. **The guard
for that is behavioural: load a pre-v0.18 save and confirm the tick-box comes up ticked.**

### 3.2 The standing guarantee

Renders are **byte-identical** between the current default and the committed
`planet_renderer.js`, across **30 images** (5 world types × 4 projections + hemispheres, plus
the cold-dry world added 2026-09-14). **Any change to the field must re-establish that.** It is
the reason the v2 branch was built and proven inert before anything went behind it.

---

## 4. RULE 2 — every improvement goes behind version 2

**Classic is frozen; Tectonic is where terrain improves.** This makes Classic vs Tectonic a
larger visual jump than terrain shape alone, and that is accepted: it is the price of never
disturbing an existing sector.

Currently behind v2: **plate tectonics**, **vegetation**, **`cold_desert`**, and
**`remapHeight`'s interpolated form**.

* **Vegetation is a RAMP SWAP and nothing more.** `RAMP.standard_veg` colours exactly the
  generic-ground band (beach → lowland → upland → highland). Snow, exposed mountain rock and
  **every water material stay discrete and untouched**, so a world does not change its seas when
  it grows plants. `planet_renderer.js`'s matching `isVegetated` stop set has **ocean stops
  identical** to the arid version. Keep it that way.
* **`cold_desert` is `hydro === 0 && tempK < 223`.** The 223 K is **reused from the existing ice
  branch, not invented** (`terrain_render.js:61`, `planet_renderer.js:349`).
* **`remapHeight` diverges, and half of that divergence is PERMANENT.** `terrain_field.js`
  interpolates between CDF samples; `planet_renderer.js` returned the raw integer rank, which
  terraced the regional view. Under **v2 only**, planet_renderer adopts the interpolated form;
  **v1 keeps the raw integer rank verbatim, forever** (`planet_renderer.js:283`). The two forms
  coexist by design and agree to within 1/2048. **Do not "tidy" the v1 branch away.**

### 4.1 A new world type needs FOUR things, not one

1. a `MATERIALS` table
2. a `RAMP` + `RAMP_IDS` entry
3. a `classify()` branch
4. **a `VOCAB` entry in `terrain_names.js`**

Without (4) it falls back to `standard` and **a waterless world gets handed "Oceans" and "Great
Plains".**

**It may also need excluding from `polarOverlay`** (`terrain_render.js:296`). Below 223 K the
frozen temperature band puts the cap edge at 40°, so a cap counts the same ice twice and the
sheet renders solid white under a key reading "Polar Ice Cap 100.0%". `molten`, `rock`, `ice`
and `cold_desert` are all excluded for exactly this reason.

---

## 5. The duplicated-definition register — change one, change the other

Three copies of a rule means two chances to be wrong. These duplications are **deliberate and
necessary**; each pair carries a comment naming its twin. **Keep them identical.**

| Rule | Copy A | Copy B | Why it cannot be one definition |
|---|---|---|---|
| `isColdDry` | `terrain_render.js:58` | `planet_renderer.js:346` | The two modules cannot import one another: `test_regional_terrain.html` loads terrain_render **without** planet_renderer, and `verify_field_v1.html` loads planet_renderer **without** terrain_render |
| `isVegetated` | `terrain_render.js:68` | `planet_renderer.js:355` | as above |
| "sea drains nowhere" | `_hydrology()`, `terrain_field.js:725` | `buildNetwork`, `terrain_rivers.js:207` | Two independent drainage passes — the regional one and the whole-world one |

**A GUARD THAT EXISTS IN A SIBLING FUNCTION IS NOT A GUARD.** The "sea drains nowhere" rule was
present in `buildNetwork` and in the now-deleted `carve()`, and absent from `_hydrology()` —
which is the one the sheet actually runs. **When a fix reads as "restore the guard", check every
copy, and prefer one definition wherever the harnesses allow one.**

---

## 6. The sheet pipeline — one definition, three callers

```
TerrainFrame.sheetSetup(worldData, seed, masterSeedStr)  -> every per-world parameter
TerrainFrame.renderSheet(opts)                           -> field, hydrology, shading, rivers, labels
```

`terrain_frame.js:492` and `:634`. **The in-app panel and BOTH exporters call these same two
functions.** That is what stops an exported sheet disagreeing with the one the user saw.

It was **EXTRACTED from `terrain_panel.js`, not copied**, because `remapHeight` and `isIce` had
already drifted in exactly that way. **Any future caller calls these two — it does not
re-implement them.**

The exporters reach it through one definition in `js/export_core.js`:

| Function | Line | Role |
|---|---|---|
| `pinnedSitesFor(hexId, bodyName)` | 1263 | The pins for one body |
| `canRenderSheet()` | 1287 | Is the terrain stack present |
| `renderRegionalSheet(worldData, hexId, bodyName, pin, seedFallback)` | 1297 | Render to PNG bytes |
| `sheetLabel(pin)` | 1350 | The caption |

* **`renderRegionalSheet()` returns `null` rather than throwing** when the terrain stack is
  absent, so an export **degrades instead of failing**.
* **Only PINNED sites are exported.** Volume is bounded by deliberate human choice and costs
  nothing until a pin exists.
* **A sheet is ~1.0 MB at 960 wide** — 30 pins is roughly 30 MB and 60 s. If that ever needs
  reducing, **the levers are plate resolution first, then JPEG.**

---

## 7. Fog of war — an image can only be withheld by NOT GENERATING IT

**This is load-bearing.** `filterBlocks()` only ever sees **blocks**. It cannot look inside a
PNG, and it cannot look inside a page assembled outside the block model either.

**Therefore every image must be filtered at GENERATION time.** Sheets are generated *inside*
the exporters' existing world-image disclosure gate:

| Exporter | Worlds | Moons |
|---|---|---|
| `js/html_exporter.js` | `_show(oLV, 'e')` at `:1053`, pins at `:1065` | `:1080`, pins at `:1096` |
| `js/obsidian_exporter.js` | pins at `:703` | pins at `:740` |

**A new image of any kind — system sheet, world page, anything — obeys the same rule.** Put it
inside a disclosure gate at the point of generation, or it leaks. See
`directives/fog_of_war_field_tags.md`.

---

## 8. Pins — the storage contract

```
state.terrainPins = { "<body name>": { "0": {...}, "3": {...} } }
```

Sparse, keyed by slot index; a slot holds `{lat, lon, widthKm, label, pinnedAt}`.

* **No serialisation code exists, and none is needed.** `io_manager.js` and `db_manager.js` both
  persist hex states **whole**, so a pin travels with a saved `.json`, rides the IndexedDB
  autosave and survives a browser change for free. **Do not add a serialiser.**
* **`terrainPins` must NEVER join `HEX_VIEW_STATE_KEYS`** (`js/core.js:308`). That list strips
  **derived view state** at save time; a pin is the opposite — a deliberate human choice — and
  stripping it would throw it away.
* **Body identity is the NAME.** `TerrainPins.bodyNameOf()` is the one definition; a nameless
  body files under `'Unnamed'`. Keys are `masterSeed | hexId | body name`, matching
  `PlanetRenderer.imageSeed()`. **`orbitId` is not unique and list indexes differ per engine** —
  both have already caused shipped export bugs.
* **`bodyKey()` returns a compound object carrying a `toString()`** that yields the old flat
  form (`terrain_pins.js:153`). **The `toString` is required, not cosmetic:**
  `test_regional_terrain.html` builds a redraw signature with `key + '#' + ...`, and an object
  would coerce to `"[object Object]"`, dropping the body and suppressing a redraw when switching
  bodies.
* **Pinning takes no undo snapshot, deliberately.** `saveStateForUndo()` deep-clones every hex
  state — hundreds of MB on a large canvas — so pinning schedules its own
  `dbManager.saveHexes([hexId])` instead. **Consequence to accept: an undo of a LATER action
  drops the pin**, which is how this app treats every edit that takes no snapshot.
* **`masterSeed` is not in the save envelope at all** — it lives in `localStorage` as
  `traveller_gen_seed`. A file opened under a different seed shows different terrain, and its
  pins point at ground that has changed. `mergeSites(derived, pinMap, count, currentSeed)`
  returns such a pin with **`staleSeed: true`** and **still shows it** — a pin that silently
  vanished is the worse failure. A pin with no recorded seed predates the field and is never
  flagged. Reversible later by storing the seed on the pin.
* `test_regional_terrain.html` falls back to localStorage because it loads the module without
  `core.js`, so there is no `hexStates`. **The app never takes that path.**

---

## 9. The regional map panel — the constraints

* **The survey window is FIXED** at `suggested().widthKm` (`VIEW_WIDTH_KM`,
  `terrain_panel.js:128`) — 120–220 km across every legal size code, so a sheet is always the
  regional tier.
* **Wheel zoom was removed deliberately. Do not re-add it.** Landform size is a property of the
  PLANET, not of the framing, so magnifying the window changed almost nothing while costing
  noticeable time.
* **The field is world-anchored and must stay so.** It is what makes a dragged plate the same
  ground rather than a new landscape, and what keeps the regional map agreeing with the world
  image. `view.s` is **retained at 1 rather than removed**, so the `drawImage` path and
  `viewToWindow()` keep ONE scale-aware coordinate path instead of growing a second, subtly
  different one.
* **`LANDFORM_KM` and `STEEPNESS` are per-world constants**, read once from `suggested()` and
  **not exposed**. A control could only ever contradict the world's own physics.
* **The control is "Rivers & lakes" and governs BOTH**, because both come out of the one
  hydrology pass. **Keep label and behaviour in step.**
* That box is **disabled, with the reason shown**, when hydrology cannot run — field version < 2,
  or hydrographics 0. `riversWhy` is read once at open, **which is safe only because the panel
  is modal.**
* A pin's stored `widthKm` is **written but ignored** on Go, so pre-2026-09-13 pins still load.

---

## 10. Hydrology and the lake model

All of this is `_hydrology()` in `js/terrain_field.js`.

### 10.1 A lake is read off the pit-fill

Where the filled surface stands **above** the ground, the flood had to raise that cell to give
it an outlet — which is exactly the shape of a basin holding standing water. **Taking lakes from
the fill is what lets one sit at 3,000 m;** the planetary datum can only ever put water below
itself.

### 10.2 Not every depression fills — the evaporative balance

Counting every closed basin gives a **DRY world MORE lakes than a wet one** — measured, **119 at
hydrographics 1 against 57 at hydrographics 9** — because a dry world simply has more land above
the datum. The Sahara has closed basins and no lakes in them.

A lake persists while its catchment delivers more than its own surface loses:

```
catchmentArea >= K * lakeArea
K = LAKE_K0 * 10 ^ ((7 - hydrographics) * LAKE_K_DECADE)
```

**`LAKE_K0 = 75` (`terrain_field.js:553`), `LAKE_K_DECADE = 0.45` (`:554`)**, applied at `:812`.
Fitted by measurement against **Earth, which is hydrographics 7 — lakes cover about 2% of land.**

A basin that fails at its spill level is **NOT deleted** — the level is lowered until the
smaller surface balances, which is what a shrinking endorheic lake does. It vanishes only when
even its deepest cells cannot hold.

**STATE LAKE TARGETS IN km², NEVER IN PIXELS.** An earlier "2 bodies per sheet" figure was a
resolution artifact: the 40-px threshold behind it meant 7 km² at one resolution and 0.77 km² at
another, so the target meant nothing.

### 10.3 Three things follow from the lake mask, not one

* **No incision inside a lake**, or a river reappears inside the new water.
* **Rivers are lake-aware.** `linesFromField` reads a **per-cell water datum** — a lake is water
  at ITS OWN level, not the planetary one. A channel neither starts in a lake nor crosses one,
  and the outlet stream below a lake is traced as a channel in its own right.
* **Lake surfaces are shaded FLAT** (§11).

### 10.4 What to expect before concluding the model is broken

Lakes are generated on every wet world, but **below hydrographics 6 they are very small** — at
hydrographics 4 the biggest lake on a sheet is about 2.3 km², roughly an 11×11 px blob. **At
hydrographics 2 and below there are none at all**, which is the evaporative balance doing what
it was calibrated to do.

**Check in this order:** the world's hydrographics digit; that the Terrain Model is **Tectonic**
(hydrology never runs at version 1); that **Rivers & lakes** is ticked and not greyed out; and
that you are looking at the **regional survey sheet** and not the whole-world flat map — **the
world image has no lakes at all, by design.**

**Do not trust any lake figure written in a document — run `utilities/lake_calibration.html`.**
See §14 and §16.

---

## 11. Water is shaded as water, not as its bed

All of this is `shade()` in `js/terrain_render.js`.

* **`water`** is a mask of every pixel `classify()` paints as water, built from the **SAME test
  the albedo pass uses** — below the per-pixel datum, which is a lake's own surface where there
  is one and the planetary sea level otherwise. **Sea and lake take the same path.**
* **Only `ice`, `standard` and `exotic_wet` are considered** — the three types with a water
  branch. **A dry world can carry pixels below its datum with none of them wet**, and
  flat-shading those would drain the relief out of desert, cold desert and rock worlds.
* **`surfF`** is the same field with every water cell raised to its own surface, passed to
  `castShadows` and `computeAO` **in place of the bed**. That keeps the two facts belonging to
  the water — a cliff shades the water beside it, basin walls close the sky over it — while
  dropping the one belonging to the bed.
* Water pixels are lit flat: `ndl = Lz`, slope 0, sky term 1, micro-texture off. **Depth still
  shows, because depth is real** — through the hypsometric bands and the `em` albedo modulation,
  which **tint** rather than light.

### 11.1 Two consequences that are RULED FINAL — do not "fix" either

* **A window that is entirely open ocean is a nearly featureless blue plate.** That is correct:
  open ocean has no surface features at 130 m/px.
* **Lake-adjacent land shading shifts by 1.4–9.7% of land pixels, all within 8 cells of a lake
  shore. KEEP IT.** The water plane genuinely is there, and the old code occluded from the lake
  **bed**, which is not. The one-line "fill sea only" narrowing was considered and **rejected** —
  it re-splits sea from lake, the exact inconsistency this work existed to remove.

---

## 12. Numerical rules — every one of these was found the hard way

* **All hydrology uses Float64.** Pit-filling raises a cell by an epsilon; at ~15,000 m
  elevation **float32's step is ~0.001**, so 1e-4 rounds to nothing and the fill makes **ties
  instead of gradients**.
* **And the epsilon must then be tiny.** The fill raises each step away from an outlet, which is
  itself a radial gradient. At 1e-3 it accumulates into **metres of false slope** across a flat,
  and channels draw as **straight spokes**.
* **NEVER ROUTE ON TWO CRITERIA.** Steepest-descent on one surface with a fallback on another
  creates **cycles**, which strand rivers mid-map. Drainage is **acyclic by construction**: a
  cell may only drain to one the flood reached **earlier**, and Priority-Flood's visit order is a
  topological order.
* **Lookup grids show their own cells.** `planet_renderer`'s 32-cell noise table has ~3 cells
  across a 130 km window on a large world, rendering as rectilinear blocks. **Version 2's smooth
  term is table-free hash noise for this reason.**
* **Ridged multifractal makes rings.** Its ridges follow the noise's contours, which are closed
  loops, so unwarped it produces circular ranges around circular basins. **The detail cascade is
  domain-warped to break them.**
* **Flat plate interiors terrace.** A large share of the sphere at one height collapses the CDF
  into a plateau, and a percentile remap with plateaus steps under hillshading.
* **THE PLATE FIELD MUST BE INVARIANT UNDER ANY PERMUTATION OF THE RANKING**, not merely one of
  them. `_boundaryDelta(I, J)` orders its pair internally so it is exactly symmetric; `sample()`
  sums over **unordered pairs** of the nearest plates weighted by the product of their softmin
  weights; the base is a softmin blend; and **every plate's weight is tapered to zero before the
  `NEAR` cut**, so the NEAR-th/(NEAR+1)-th swap cannot make a weight appear from nothing.
  Anchoring to nearest/second-nearest instead produces **hard-edged polygonal wedges radiating
  from every triple junction**. Rank ties are discontinuities: ratios cannot detect them,
  bisection can.
* **Land can be classified as water.** Any band measured against a **local** reference can go
  negative, and `classify()` reads negative as water. **Decide land against water on an absolute
  fact (`aboveSeaM`)**, and let the relative measure choose a band only *within* one of them.
* **Seeded palettes exist.** Exotic wet worlds carry several seeded ocean/land pairings chosen by
  the `-oc` RNG draw. **Anything drawing water must use `TerrainRender.waterColors()`, never a
  constant.**
* **Set an input's `min`/`max` BEFORE its `value`.** A range input clamps `value` against the
  range in force at the time; assigning value first silently pinned a slider to 200 while its
  label read 5200.
* **A canvas bitmap must match its displayed box.** Size the bitmap from
  `getBoundingClientRect()` **after layout** — a 1990×1180 bitmap in a 1120×330 box squashes
  everything drawn on it by 3.6× vertically, which reads as "the canvas is not drawing".

---

## 13. Verification standard

**Everything is verified in a real browser with Playwright** (already in `node_modules`), **not
by `node --check`** — which passed clean on every bug listed in this document: float32
precision, routing cycles, a lookup grid showing through, a slider pinned to its minimum, a
missing function parameter.

* **Watch it fail first.** Re-break the fix and confirm the error matches the one reported, or
  you have only proved that today's code runs.
* **TEST AN EXPORTER BY EXPORTING.** Stub `downloadBlob`, scan the bytes for `PK\x03\x04`, and
  read the member names and bodies out of the ZIP's local headers. `_buildWorldFile` read
  `sheetFiles` while its signature stopped one argument short, and the Obsidian export threw on
  the first world **for three days** — `node --check` passed, and unit assertions on
  `pinnedSitesFor` / `renderRegionalSheet` / `sheetLabel` all passed. **Only calling
  `startExport` fails.** When adding a parameter, add it to the SIGNATURE first.
* **STUBBING A MODULE'S EXPORT DOES NOT REACH A CONSUMER THAT CAPTURED IT AT LOAD TIME.**
  `obsidian_exporter.js:40-41` does `const _pinnedSitesFor = ExportCore.pinnedSitesFor` at module
  load, so replacing `window.ExportCore.pinnedSitesFor` later changes nothing the exporter ever
  calls. **A negative control built that way passes silently and proves nothing.** To prove an
  export change really fires: **swap the PRE-CHANGE source file back in, re-run, diff the file
  counts, then restore and hash-check.**
* **CHECK EVERY NAME IN A MODULE'S RETURN LIST AGAINST A DEFINITION IN THAT MODULE.**
  `terrain_rivers.js` exported `draw` and defined no such function, so the IIFE's scope chain
  reached global scope and `TerrainRivers.draw` silently **was `renderer.js`'s whole-map
  repaint**. No error, no warning; a caller would simply have got the wrong behaviour.
* **A geometric proof is only as good as the sampler.** "The rim is nearer and at least as high,
  therefore it always dominates" is true of the continuous surface and false of `computeAO`
  (6 samples along each of 8 directions) and `castShadows` (a float march truncated to integer
  cells). Both can step over a one-cell ridge. The proof held for the sea and **failed for
  lakes** for exactly this reason.
* **Membership is not penetration.** Counting river vertices landing ON water read ~1% and looked
  like a bug; measuring their **distance** from the shore showed every one at exactly one cell —
  smoothing and rounding noise. **Measure the distance, not the membership.**
* **Every source file in this repo is CRLF**, including `changelog.md` and `README.md` (verified
  byte-level 2026-09-21: zero bare LFs anywhere checked). A scripted edit that reads with
  Python's universal newlines and writes back flattens the file to LF and diffs against every
  line. **Read and write bytes, or convert back before finishing.**

---

## 14. The standing gates — run these

All three open **directly in a browser. No server.**

| Gate | Run it after | Passes when |
|---|---|---|
| **`utilities/verify_field_v1.html`** | **ANY change to the terrain field** | 30/30 against `verify_field_v1_baseline.js` |
| **`utilities/lake_calibration.html`** | Changing `LAKE_K0`, `LAKE_K_DECADE`, the pit-fill or the flow accumulation | Hydrographics 7 inside the **2% ± 0.6** band Earth sets, **and** cover falls monotonically as the world dries |
| **`utilities/test_regional_terrain.html`** | Any regional-sheet change | Standalone harness — visual |

**A FAIL on `verify_field_v1` means version 1 has been disturbed and every existing sector's
world images will look different after an upgrade.**

### 14.1 BEFORE BELIEVING A FAIL, RE-RUN WITH `--disable-gpu`

On 2026-09-17 `verify_field_v1.html` FAILED **18 of 30** in three separate browser
configurations **with the code completely innocent.** Launching with `--disable-gpu` turns it
green, 30/30.

* **The 18 that move are exactly the renders containing VECTOR rasterisation** — hex-grid strokes
  and lobe/diamond separators on the sinusoidal and diamond projections, and the `fillText`
  hemisphere labels. GPU and software rasterisers antialias lines and glyphs differently, and
  the hash covers those pixels.
* **The 12 that never move are exactly the pure `putImageData` renders — mercator and
  mollweide.** **If those two match on every world, the field and the palette are intact
  whatever the other rows say.**

---

## 15. Procedure — changing anything under `js/terrain_*` or `js/planet_renderer.js`

1. **Read §3.** Decide whether the change touches the **field**. If it does, it goes behind
   **version 2** (§4) unless it is provably inert.
2. **Check §5** — is the thing you are changing one of the duplicated definitions? Change both.
3. Make the change.
4. **Run `utilities/verify_field_v1.html`.** On a FAIL, re-run with `--disable-gpu` (§14.1) and
   check whether mercator and mollweide are among the failures before concluding anything.
5. **If hydrology or the lake constants moved, run `utilities/lake_calibration.html`.**
6. **If anything an exporter touches moved, export** — really export, per §13.
7. **If a pin field changed**, confirm it still round-trips through a saved `.json` **and** the
   IndexedDB autosave, and that it has not been added to `HEX_VIEW_STATE_KEYS`.
8. Update this directive. It is a living document.

---

## 16. Open question — the recorded lake figures moved, and nobody knows why

**Found 2026-09-21. Ask Sean before treating either table as the baseline.**

`lake_calibration.html` still **PASSes**, but its whole table differs from the one recorded on
2026-09-16: hydrographics 9 **7.13% → 8.07%**, hydrographics 7 **1.90% → 1.70%**, hydrographics 5
**0.29% → 0.27%**.

The harness is fully deterministic — fixed seed `'TravellerMagnus','1105-Demo'`, no RNG — so
**this is not sampling noise**, and it reproduced exactly on a second run. It is **not** the
2026-09-21 river-path deletion: that changed no non-comment line in `terrain_field.js`, proven by
diff. The P4 verification of 2026-09-17 explicitly recorded 1.90% as unchanged, so **the shift
happened between 2026-09-17 and release.**

Two candidates, and they cannot be told apart without git history, which is Sean's: either the
field or the hydrology moved slightly during the v0.18.0 endgame, or **the harness's own
parameters changed** — it now reports **5 windows**, and the 2026-09-16 run did not record a
window count. 1.70% is comfortably inside the 2.0 ± 0.6 band either way.

---

## 17. Non-goals

* **The site tier (~20 km).** Designed as a later job; nothing exists.
* **Whole-world survey sheets.** The world image is the only whole-planet view.
* **Rivers or lakes on the world image.** Deliberate — see §1 and §10.4.
* **Anything manmade.** No buildings, roads or ports, at any tier.
* **A terrain rules table.** Terrain is art; the Zero-Assumption Policy applies to RPG rules, and
  there are none here to assume.
* **Exposing `LANDFORM_KM` or `STEEPNESS` as controls.** §9.
* **Re-adding wheel zoom.** §9.
