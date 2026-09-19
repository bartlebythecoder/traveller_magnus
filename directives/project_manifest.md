# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** v0.17.5 shipped and closed the **routes** series; §0.0 below is the current cold
start. v0.17.2 shipped 2026-08-19, v0.17.3 on 2026-08-27, v0.17.4 on 2026-09-01 and v0.17.5
on 2026-09-11. The exports series (v0.17.0 / v0.17.0.1) shipped 2026-08-03 and 08-04.
**v0.18.0 is IN PROGRESS — regional surface maps.** See §0.0.A, which supersedes §0.0.0.
The newest work is 2026-09-17: **P4 closed — the sea is shaded as water, not as its bed**, a
**crash in the Obsidian wiki export** found and fixed, **circular Point-to-Point routes**
allowed, and **a confirmation before any generation destroys the route already in a slot**.
Start at "FIXED 2026-09-17" and the NEXT STEPS list under it. The day before, 2026-09-16, fixed
four hydrology/classification bugs and added the **lake model**.
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 0.0 COLD START — read this first (updated 2026-09-11)

**v0.17.5 is complete, and it closes the routes series.** Four route releases are written,
verified in-browser and documented: v0.17.2 (eight items), v0.17.3 (six), v0.17.4 (seven)
and v0.17.5 (six). Neither this document's System Editor content (§0.1 onward) nor the
exports manifest is in progress. **Nothing anywhere is half-finished.**

**v0.18.0 WAS chosen on 2026-09-11 — regional surface maps — and is in progress.**
**Read §0.0.A, not this paragraph or §0.0.0.** The sentence that used to stand here ("open and
nothing has been chosen") was true only on the day it was written; §0.0.0's candidate list is
kept for reference and none of it is the current plan. `changelog.md` still carries a
`[v0.18.0] - In Progress` heading and is **deliberately not written up yet** — see §0.0.A's
NEXT STEPS item 1.

**Two things to know before you touch anything:**

1. **Route *forcing* was designed in full and then dropped** (2026-08-19 → 08-27). Older
   parts of this document and of `route_partial_spec.md` still carry its reasoning. §0.0.2
   says plainly what was built instead. Do not resurrect forcing without asking Sean.
2. **Git is Sean's — never touch it, not even to read.** He stages and commits everything
   himself. **Do not record commit hashes or the commit position in this document.** That was
   tried twice and was stale within a week both times; the hashes that used to sit here have
   been removed for that reason. If you need to know what is committed, ask him.

### 0.0.A v0.18.0 — REGIONAL SURFACE MAPS (in progress, updated 2026-09-17)

**This supersedes §0.0.0 below.** v0.18.0 was chosen on 2026-09-11: procedurally generated
regional surface maps — zoom into a patch of a world's surface and render it as a survey
sheet. §0.0.0's candidate list is stale; leave it for reference only.

**Nothing here is committed. Ask Sean what is staged.**

#### What it is

Sean supplied three AI-generated reference images (a three-tier zoom of an icy world:
whole-planet, ~150 km regional, ~20 km site). The target agreed was "same family, different
technique" — procedural shaded relief, not photoreal. Scoping decisions Sean made, all of
which still stand:

* **No buildings, roads, ports or anything manmade.** Landscape and physical feature names
  only. The site tier is a separate, later job.
* **Regional tier first** (~100-150 km), not whole-world, not site.
* **Terrain is art, not rules.** Sean confirmed under the Zero-Assumption Policy that no
  Traveller table covers surface topography. It is invented procedurally, constrained only
  by UWP facts (size / atmosphere / hydrographics / temperature).
* **Five site slots per body**, derived from the seed and individually pinnable.

#### Files

**New, all additive:**

| File | Role |
|---|---|
| `js/terrain_field.js` | Heightfield: base field, detail cascade, hydraulic erosion, **hydrology** (fill / route / accumulate / incise), site finding, the shared projector |
| `js/terrain_render.js` | Normals, cast shadows, ambient occlusion, material classification, polar caps, shading |
| `js/terrain_names.js` | Feature detection and the seeded name generator |
| `js/terrain_pins.js` | Site slots and pinning; persists onto the hex state |
| `js/terrain_frame.js` | Cartographic frame — graticule, scale bar, compass, terrain key, globe inset, footer |
| `js/terrain_rivers.js` | Global drainage network, channel tracing, composited river drawing |
| `js/terrain_tectonics.js` | Plate field for terrain **version 2** (shared by both map tiers) |
| `js/terrain_panel.js` | The whole in-app UI, so the hook into shipped code stays one button |
| `utilities/test_regional_terrain.html` | Standalone harness — open directly, no server |
| `utilities/verify_field_v1.html` + `utilities/verify_field_v1_baseline.js` | **Standing gate for terrain field version 1** — open directly, no server |
| `utilities/lake_calibration.html` | **Standing gate for the lake model** (new 2026-09-16) — open directly, no server |

**Shipped files touched (deliberately minimal):**

* `hex_map.html` — script tags only
* `js/hex_editor.js` — ~20 lines: one "Regional Maps ->" button on the flat-map panel,
  guarded by `if (window.TerrainPanel)`
* `js/io_manager.js` — save/load `terrainFieldVersion`
* `js/planet_renderer.js` — the terrain-field-version branch and its v2 implementation
* `js/ui_menus.js` — the **Use Classic World Images** tick-box and `TERRAIN_MODEL_DEFAULT`
* `js/export_core.js` — `pinnedSitesFor`, `canRenderSheet`, `renderRegionalSheet`, `sheetLabel`
  (decision 4, 2026-09-14) — the one definition both exporters call
* `js/html_exporter.js` — the `worldSheets` map and the sheet block in a world's page
* `js/obsidian_exporter.js` — the sheet files and the `## Regional Surveys` embed
  (**and the missing-parameter crash fixed 2026-09-17 — see below**)

#### The terrain field version — READ BEFORE TOUCHING THE FIELD

World images are **never stored**; they are recomputed from the seed on every view. So any
change to the field function silently redraws every world in every existing sector the
moment a user upgrades — same UWP, same name, different planet.

`terrainFieldVersion` exists to make that opt-in. It lives in the save envelope's `settings`
(per sector, correctly), **absent means 1**, and there is deliberately **no localStorage
mirror** — the model is a property of the sector, not a user preference, so a stale browser
value must never outvote a loaded file.

* **Version 1** is the shipped terrain and **MUST NEVER CHANGE.**
* **Version 2** is plate tectonics, and is what a **new sector starts on**. Settings ->
  World Image Generation -> **Use Classic World Images** drops a sector back to version 1.
  (Through v0.18 development this was a Classic/Tectonic dropdown defaulting to Classic; it
  became a single tick-box defaulting to Tectonic before release.)

**Two defaults, deliberately different numbers.** The control was flipped to default to
Tectonic; the *load* fallback was not, and must not be:

* `TERRAIN_MODEL_DEFAULT` in `js/ui_menus.js` is **2** -- the model a NEW sector starts on.
* `s.terrainFieldVersion ?? 1` in `js/io_manager.js` is **1** and stays 1 -- a file with no
  key was written before the flag existed, so its worlds were drawn on the Classic field.

Raising that fallback to match the control would silently redraw every world in every sector
saved before v0.18, which is the precise outcome the version flag exists to prevent. Note that
`utilities/verify_field_v1.html` will **not** catch it: that harness pins
`window.terrainFieldVersion = 1` itself and never loads `ui_menus.js` or `io_manager.js`, so it
proves the v1 *field function* is unchanged, not that old files still *select* v1. The guard for
that is behavioural -- load a pre-v0.18 save and confirm the box comes up ticked.

**The standing guarantee:** the renders are byte-identical between today's default and the
committed `planet_renderer.js`. It started at 25 (5 world types x 4 projections + hemispheres)
and is **30 since 2026-09-14**, when the cold-dry world was added to the baseline. Any change to
the field must re-establish it. It is the reason the branch was built and proven inert *before*
anything went behind it.

**Before believing a FAIL, re-run with `--disable-gpu`.** 18 of the 30 hashes cover
antialiased VECTOR pixels — grid strokes and separators on the sinusoidal and diamond
projections, and the hemisphere labels' `fillText` — which GPU and software rasterisers draw
differently. On 2026-09-17 that produced a full 18-of-30 FAIL with the code completely innocent.
The 12 that never move are the pure `putImageData` renders, mercator and mollweide; **if those
two match on every world, the field and the palette are intact whatever the other rows say.**
See the trap of the same name below.

#### Fixed window and reduced controls — DONE 2026-09-13

The first two open decisions are built, in `js/terrain_panel.js` only. Nothing else was
touched, and **the terrain field was not touched at all** — `verify_field_v1.html` passes
25/25 after the change, as it must.

* **The survey window is fixed** at `suggested().widthKm`, held in `VIEW_WIDTH_KM`. In
  practice that is 120-220 km across every legal size code, so the sheet is always the
  regional tier and always says "Regional Survey".
* **Wheel zoom is gone.** Panning by drag stays, and **the world-anchored field was
  deliberately left intact** — it is what makes a dragged plate the same ground rather than a
  new landscape, and what keeps the regional map agreeing with the world image. `view.s` is
  retained at 1 rather than removed, so the drawImage path and `viewToWindow()` keep one
  scale-aware set of coordinate maths instead of growing a second, subtly different one.
* **Landform size and steepness are now per-world constants** (`LANDFORM_KM`, `STEEPNESS`),
  read once from `suggested()` and not exposed. Both are properties of the planet, not of the
  framing, so a control could only ever contradict the world's own physics.
* **Controls removed:** Width, Landform km, Steepness m/km, and the "Reset to suggested"
  button, which had nothing left to reset. **Kept** (Sean's call, 2026-09-13): Resolution,
  Sun angle, Rivers, Feature labels, Cartographic frame. The sidebar is now VIEW / SHEET /
  LOCATION / SITES.
* A pin's stored `widthKm` is **written but ignored** on Go, so pins recorded before this
  change still load.
* **The Rivers box is disabled when it cannot do anything** (added same day). Hydrology runs
  only at field version >= 2 *and* hydrographics >= 1; previously the box was tickable and
  silently inert in both cases, and on Tectonic + hydro 0 it was even ticked. It now carries
  the reason as a note and a tooltip. `riversWhy` is read once at open, which is safe because
  the panel is modal — the terrain model cannot change underneath it. The redundant guard in
  `renderPass` was deliberately left in place; the field-version stakes justify belt and
  braces. No render output changed: hydrology was already skipped in exactly these cases.

Verified in a real browser: both tiers render with no page errors, the wheel is ignored, the
width holds across a pan, and the pan moves the *right distance* — 40% of an 876 px map at
125 km and latitude -50.56 should shift longitude by 0.70 degrees, and it shifted 0.71.

#### Pins are saved in the map — DONE 2026-09-14

The `*** SWAP POINT ***` in `terrain_pins.js` has been taken; **the marker is gone and so is
the localStorage stopgap** for the app. Pins now live on the hex state:

```
state.terrainPins = { "<body name>": { "0": {...}, "3": {...} } }
```

* **No serialisation code was needed.** `io_manager.js` and `db_manager.js` both persist hex
  states *whole*, so a pin travels with a saved `.json`, rides the IndexedDB autosave, and
  survives a browser change, for free.
* **`terrainPins` must never join `HEX_VIEW_STATE_KEYS`.** That list strips DERIVED view state
  at save time (see R9, §0.0.7); a pin is the opposite — a deliberate human choice, and
  stripping it would throw it away. Verified by test, not by reading.
* **The key dropped `masterSeed`.** The old flat key carried it only because localStorage is
  shared across every sector a browser has ever opened; inside one hex of one file there is
  nothing left to disambiguate. **Consequence Sean should know about:** `masterSeed` is *not*
  in the save envelope at all (it lives in `localStorage` as `traveller_gen_seed`), so a file
  opened under a different seed shows different terrain anyway — pins then point at ground
  that has changed. Judged acceptable because changing the seed on a populated sector is
  already a regenerate-everything act, and the body names change with it so most pins
  self-orphan. Reversible: store the seed on the pin record and filter in `load()`.
* **`bodyKey()` now returns a compound key**, not a string, because the store needs the hex
  and the body separately. It carries a `toString()` returning the old flat form — required,
  not cosmetic: `utilities/test_regional_terrain.html` builds a redraw signature with
  `key + '#' + ...`, and an object would coerce to `"[object Object]"` there, dropping the
  body from the signature and suppressing a redraw when switching bodies.
* **The harness still uses localStorage.** `test_regional_terrain.html` loads the module
  without `core.js`, so there is no `hexStates`; the backend falls back. The app never takes
  that path.
* **Old pins are carried over** on first open of that body, and the localStorage copy is
  removed only once the new one reads back — a failed move leaves the original alone.
* **Pinning takes no undo snapshot, deliberately.** `saveStateForUndo()` deep-clones every hex
  state, which core.js puts at hundreds of MB on a large canvas. It therefore schedules its own
  `dbManager.saveHexes([hexId])`. The trade: an undo of a *later* action restores a snapshot
  taken before the pin and drops it — which is how this application treats every edit that
  takes no snapshot.

Verified in a real browser: 25 assertions covering key shape and string coercion, the write
landing on the hex state, survival of `stripHexViewState`, a full JSON round trip, clearing
leaving no empty container behind, carry-over, a failed carry-over preserving the original,
and the harness still working — plus an end-to-end pass clicking **Pin** in the real panel and
reopening it.

#### Decisions taken 2026-09-14 — NONE OUTSTANDING, all seven ruled

Sean was walked through every open item one at a time. **Nothing is waiting on him.** These
are rulings, not yet implementations — build order and status below.

**The unifying principle he chose: every improvement goes behind Tectonic (v2); Classic (v1)
is frozen.** Decisions 1, 2 and 3 each independently landed on that shape, which makes
"Classic vs Tectonic" a larger visual jump than terrain shape alone. That is accepted and
deliberate — it is the price of never disturbing an existing sector.

| # | Decision | Ruling | v1 safe? |
|---|---|---|---|
| 1 | **Vegetation** — **BUILT 2026-09-14** | Green on warm + wet + breathable worlds; tan where dry or cold. **v2 only.** Exotic non-water oceans keep green under both — a different palette path, never in conflict | yes |
| 2 | **Cold deserts** — **BUILT 2026-09-14** | New `cold_desert` type at `hydro === 0 && tempK < 223`. **v2 only.** Materials: permafrost, frost-shattered rock, ice-cemented regolith, scree, wind-scoured pavement. **223 K is reused from the existing ice branch, not invented** | yes |
| 3 | **`remapHeight` divergence** — **BUILT 2026-09-14** | `planet_renderer` adopts `terrain_field`'s interpolated form **under v2 only**; v1 keeps the raw integer rank verbatim. Closes the drift warning without spending the guarantee | yes |
| 4 | **Regional maps in the export** — **BUILT 2026-09-14** | **Pinned sites only** — volume bounded by deliberate choice, costs nothing until a pin exists | n/a |
| 5 | **`APP_BANNER`** | **Remove it**, and amend `CLAUDE.md` §Version Update Procedure and `.claude/commands/new_version.md` to stop asking for it. Sean approved touching both | n/a |
| 6 | **Pin seed guard** | **Record `masterSeed` on each pin record; show mismatched pins FLAGGED, never hidden.** Sean's reason: *"users might change their seed at any time"* — this is about anyone using the tool, not his own habits | n/a |
| 7 | **Rivers greying** | **Keep both cases** (Classic, and hydrographics 0 under Tectonic). Already built and verified | n/a |

#### How 1, 2 and 3 were built (2026-09-14)

* **Vegetation is a RAMP SWAP, nothing more.** `RAMP.standard_veg` in `terrain_render.js`
  colours exactly the generic-ground band (beach → lowland → upland → highland); snow,
  exposed mountain rock and every water material stay discrete and untouched, so the legend
  keeps its labels and a world does not change its seas when it grows plants.
  `planet_renderer` gets a matching `isVegetated` stop set whose **ocean stops are identical**
  to the arid version.
* **`cold_desert` needed four things, not one:** a `MATERIALS` table, a `RAMP` + `RAMP_IDS`
  entry, a `classify()` branch, and **a `VOCAB` entry in `terrain_names.js`** — without the
  last it falls back to `standard` and a waterless world gets handed "Oceans" and "Great
  Plains".
* **`polarOverlay` had to exclude `cold_desert` too.** Caught by rendering, not by reasoning:
  below 223 K the frozen band puts the cap edge at 40°, so the first Kteiroa sheet came out
  solid white with a terrain key reading **"Polar Ice Cap 100.0%"**. The surface is already
  frost-bound — that is what the palette says — so a cap counts the same ice twice. This is
  the identical reason `ice` was already excluded.
* **The climate predicates are DUPLICATED** in `planet_renderer.js` and `terrain_render.js`,
  deliberately. The two cannot import one another: `test_regional_terrain.html` loads
  terrain_render **without** planet_renderer, and `verify_field_v1.html` loads planet_renderer
  **without** terrain_render. `isIce` was already duplicated across that same gap, so this
  follows the established pattern rather than inventing load-order coupling. **Both copies
  carry a comment naming the other. Keep them identical.**

Verified: `verify_field_v1` **30/30 after every step**, plus 23 assertions on classification,
the vegetation predicate and measured land colour. Measured swing, cloud/snow/cap excluded:
garden median greenness **−18 → +15**, Kteiroa warmth **+94 → −5**, hot desert **−34 → −35**
(unchanged, as intended).

**A measurement trap worth keeping.** The first colour test failed, and the code was right —
a plain mean over non-ocean pixels measures **cloud**, not ground. An atm-6 world draws heavy
cloud, and with snow peaks and polar caps on top every world averaged to near-neutral grey,
hiding a 33-point swing. The fix was a better metric (exclude anything bright enough to be
cloud/snow/cap, take a median), **not a looser threshold**.

#### FIXED 2026-09-14 — plate boundaries rendered as hard-edged wedges (v2 only)

Every Tectonic world image carried large **polygonal wedges with hard straight edges**. It was
**not** caused by the vegetation / cold-desert / remap work — confirmed by swapping the
pre-patch `planet_renderer.js` back in and re-rendering.

**Root cause: the field depended on plate RANK, and rank ties are discontinuities.** The
elevation was a function of the nearest plate A and the second-nearest B. Where the second and
third nearest are equidistant, B's identity flips, and both the base elevation and the boundary
normal flip with it. Those tie loci are arcs radiating from every triple junction — which is
exactly a wedge.

**Two wrong attempts, both worth knowing about.** Neither was a waste; each measured the next
one into view.

1. Crossfading the pairs `(A,B)` and `(A,C)` as B and C tie. Removed the B/C tie, left the A/B
   one: crossing an A-B boundary near a triple junction swaps the SECONDARY pair from `(A,C)`
   to `(B,C)`, which are *different plates*. Residual step 0.277.
2. Making the base a rank-free softmin but leaving the features anchored to A. Same residual,
   because the problem was in the features, not the base.

**The fix that worked** — the field must be invariant under *any* permutation of the ranking,
not merely one of them:

* `_boundaryDelta(I, J)` orders the pair internally so A is always the nearer plate, making it
  **exactly symmetric** in its two arguments.
* `sample()` sums over **unordered pairs** of the nearest plates, weighted by the product of
  their softmin weights — a quantity no permutation can change.
* The base is a **softmin blend** over the nearest plates, weights depending only on distance.
* Every plate's weight is **tapered to zero** before the `NEAR` cut, so the NEAR-th/(NEAR+1)-th
  swap cannot make a weight appear out of nothing. Without this the residual was 0.045.

**How it was measured, which is the transferable part.** Ratio statistics were nearly useless:
a legitimate mountain belt is genuinely steep, so max/median ran to ~76x on a *correct* field
and could not distinguish a cliff from a discontinuity. **The test that worked was bisection** —
find the worst neighbouring step, then halve the interval 14 times and watch what the step
does. A steep gradient shrinks with the interval; a discontinuity does not.

| stage | worst step | after 14 halvings | verdict |
|---|---|---|---|
| original | 0.28-0.30 | unchanged | discontinuity |
| attempt 1 & 2 | 0.036-0.049 | unchanged | discontinuity |
| **fixed** | 0.023-0.091 | **~1/16,200** | **smooth** (2^14 = 16,384) |

Cost: Tectonic flat map **621 ms -> 715 ms** (+15%); Classic unchanged at ~290 ms.
`verify_field_v1` **30/30** — v1 never calls `TerrainTectonics.sample()` at all.

#### How decision 4 was built (2026-09-14) — regional sheets in the export

Pinned sites become full survey sheets in both the HTML and Obsidian exports.

* **The sheet pipeline was EXTRACTED, not copied.** It lived inside `terrain_panel.js`; a
  second copy in `export_core.js` would have drifted exactly as `remapHeight` and `isIce`
  already did. It now lives in `terrain_frame.js`, which already owned sheet composition, as
  two functions the panel and the exporters both call:
  `TerrainFrame.sheetSetup(worldData, seed, masterSeed)` — every per-world parameter,
  including the isostatic steepness derivation — and `TerrainFrame.renderSheet(opts)` —
  field, hydrology, shading, rivers and feature labels.
* **Both extractions were PROVEN INERT.** The panel's composed canvas was hashed for three
  worlds before, after the pipeline move, and again after the `sheetSetup` move: identical all
  three times. Re-use `scratchpad/sheethash.js` if this code is touched again.
* **Fog.** Sheets are generated *inside* the existing `_show(oLV, 'e')` world-image gate in
  both exporters. That is deliberate and load-bearing: a sheet is the world image at finer
  scale, and like any image it is opaque to `filterBlocks()`, which only ever sees blocks.
  **Not generating it is the only way to withhold it.**
* **An identity bug caught before it shipped.** The panel files a nameless body's pins under
  `'Unnamed'`, but the exporter would have looked up `''` and silently found none. Fixed with
  one definition — `TerrainPins.bodyNameOf()` — now used by both. Third time the
  NAME-as-identity rule has bitten here.
* `renderRegionalSheet()` returns **null rather than throwing** when the terrain stack is
  absent, so the export degrades instead of failing.

**Size, corrected.** A sheet is **~1.0 MB**, not the ~400 KB estimated when the decision was
put to Sean — so 30 pins is roughly **30 MB and 60 s**, not 12 MB. Still bounded by intent,
and still nothing at all for a sector with no pins, but the estimate was out by 2.5x. If that
is too heavy the levers are plate resolution (960 wide) or JPEG instead of PNG.

Verified: 16 assertions on the export path, plus every existing suite re-run green — 25 pins,
23 v2 palette, rivers 3/3, and `verify_field_v1` **30/30**.

**Two traps carried by these rulings:**

* **`verify_field_v1` only half polices decisions 1 and 2.** It began with five sample worlds
  — ice, standard, hot desert, airless rock and exotic — and **a cold-dry world was added the
  same day (2026-09-14), taking it to 30 renders.** Cold deserts are therefore covered.
  **A temperate GARDEN world is still missing**, so a v1-breaking change to the vegetation
  palette would pass 30/30 while real sectors changed. The version gate is the real protection
  here; the test is not. See [[feedback-green-suite-can-be-blind]] — a weakened rule leaves every
  old fixture passing. **Add the garden shape to the baseline before touching that palette.**
* **Decision 4 needs its own fog gate.** Images are generated outside `filterBlocks`, which
  only sees blocks, so a fogged world's regional sheet must be suppressed at GENERATION time.
  It cannot inherit fog filtering. See [[feedback-handbuilt-output-bypasses-filter]].

#### FIXED 2026-09-16 — rivers ran through lakes, and there was no lake model at all

Sean reported rivers drawn straight across bodies of water. It was **four defects in a chain**,
each one hidden by the one in front of it, and the last turned out to be the only reason the
sheets had any lakes at all. Read all four before touching hydrology again.

**1. The hydrology pass carved channels into lake and sea beds.** `_hydrology()` seeds every
sub-sea cell as an outlet — correct — and then routed flow straight through them anyway. Its D8
loop had no sea test, `flow` is seeded at 1 on every cell including water, and the incision
floor read `elev[i] >= seaLevelM ? seaLevelM : -Infinity`: the "never cut below sea level" rule
protected land and **exempted anything already submerged**. Measured: **100% of sub-sea pixels
incised**, up to 132 m, with 7,523 cells of accumulation sitting on open water and the depth
bands flipping on 84 pixels of a single window. It rendered as a darker, hillshaded,
river-shaped trench across the lake — made of terrain, not of stroke.

**The smoking gun: the same guard already existed twice elsewhere**, and was missing only in the
copy the sheet uses. `buildNetwork` carries `if (filled[i] < seaLevel) continue;` with the
comment "sea drains nowhere"; `carve()` floors a submerged cell at its own height. `_hydrology`
had neither. All three respects fixed, and `maxFlow` is now taken over **land only** — a shore
cell receives an entire catchment and then stops, so counting it put the whole basin into the
divisor every land river is measured against.

**2. River strokes overshot the waterline.** `linesFromField` pushed the first sub-sea cell's
CENTRE onto the polyline before breaking, and `drawLocal` adds a round cap plus up to
2.6 x widthScale of soft pad on top of that. The trace now interpolates to the sea-level
crossing and stops there. Measured after: mouth vertices sit **0.0 m** below the waterline,
mean and worst, across 35 mouths.

**3. LAND WAS BEING PAINTED AS WATER. This is the one that produced Sean's screenshots**, and
neither of the two fixes above touched it. `shade()` measures the hypsometric band from the
LOCAL base level, and `classify()` then decides land against water on `e < 0` — while erosion
and river incision cut valley floors and basins **below their own base level** as a matter of
course. So `e` went negative on dry land and the pixel was painted `shallow`.

Measured: **6.8% of all land pixels** in a temperate window rendered as water — roughly **twice
the area of the real water in the same frame** — and **10.1% of every river vertex on the map**
lay on one of those false lakes. The river was correctly in its valley; the valley was being
coloured blue around it. The comment directly above the line said "Snow line and water remain
absolute, which is physically right", so the author believed water was decided absolutely and
had not noticed erosion could push `e` under zero. **The land branch is now clamped at zero.**
Land and water are told apart by `aboveSeaM`, which is an absolute fact about the world; `e`
only ever picks a band within one of them.

**4. And that revealed there was no lake model.** The false-water bug had been acting as a crude
one — and positionally a decent one, putting water in incised basins at any altitude, which the
sea-level datum can never do. Removing it took most of the visible water with it:

| Hydrographics | Water bodies per sheet, before | after |
|---|---|---|
| 9 | 2.8 | 2.0 |
| 7 | 2.2 | **0.8** |
| 5 | 2.2 | **0.3** |
| 3 | 1.5 | **0.0** |

A genuine lake could only ever be an enclosed basin that happened to punch below planetary sea
level: **0 of 8 sampled windows below hydrographics 7**. So a lake model was built.

#### The lake model — NEW 2026-09-16, in `_hydrology()` in `js/terrain_field.js`

**A lake is read off the pit-fill.** Where the filled surface stands above the ground, the flood
had to raise that cell to give it an outlet — which is exactly the shape of a basin holding
standing water. Taking lakes from the fill is what lets one sit at 3,000 m; the planetary datum
can only ever put water below itself.

**Not every depression fills, and that is the whole difficulty.** Counting every closed basin
gives a DRY world MORE lakes than a wet one — measured, **119 at hydro 1 against 57 at hydro 9**
— because a dry world simply has more land above the datum. The Sahara has closed basins and no
lakes in them. The governing balance is evaporative: a lake persists while its catchment
delivers more than its own surface loses, i.e. `catchmentArea >= K * lakeArea`, where
`K = LAKE_K0 * 10 ^ ((7 - hydrographics) * LAKE_K_DECADE)`.

A basin that fails at its spill level is **not deleted** — the level is lowered until the smaller
surface balances, which is what a shrinking endorheic lake does. It vanishes only when even its
deepest cells cannot hold.

**Calibration: `LAKE_K0 = 75`, `LAKE_K_DECADE = 0.45`.** Fitted by measurement against **Earth,
which is hydrographics 7 — lakes cover about 2% of land**. Sean set that target after correctly
rejecting an earlier "2 bodies per sheet" figure, which was **a resolution artifact**: the 40-px
threshold behind it meant 7 km2 at one resolution and 0.77 km2 at another. **State lake targets
in km2, never in pixels.**

| Hydro | Lakes % of land | >=10 km2 | 1-10 km2 | 0.25-1 km2 |
|---|---|---|---|---|
| 9 | 7.13% | 12.0 | 26.0 | 43.4 |
| **7** | **1.90%** | 5.0 | 16.4 | 22.8 |
| 5 | 0.29% | 0.0 | 7.0 | 14.0 |
| 3 | 0.02% | 0.0 | 0.0 | 3.0 |
| 1 | 0.00% | 0.0 | 0.0 | 0.0 |

**Three things had to follow from the lake mask, not one:**

* **No incision inside a lake**, or defect 1 reappears inside the new water.
* **Rivers are lake-aware.** `linesFromField` now reads a **per-cell water datum** — a lake is
  water at ITS OWN level, not the planetary one. A channel neither starts in a lake nor crosses
  one, and the outlet stream below a lake is traced as a channel in its own right.
* **Lake surfaces are shaded FLAT.** Normals, slope and micro-texture all describe the BED — the
  shape under the water rather than the shape of it. Cast shadows and AO are deliberately KEPT:
  a cliff does shade the water beside it, and basin walls do close the sky over it.

**The panel control is now "Rivers & lakes"** (`terrain_panel.js`). It governs both, because both
come out of the hydrology pass; the old label would have lied. **Keep the two in step.**

#### Verification of the 2026-09-16 work

* **151,560 river vertices** across 12 windows at hydro 9/7/5: **0 more than one cell inside a
  lake, 0 inside the sea.** 494 rivers terminate at a lake shore. Every shore-adjacent point
  measured at depth exactly 1 — Chaikin and rounding noise, not penetration. **Measure depth
  from the shore; a raw "is this vertex on water" count reads about 1% and looks like a bug.**
* Every lake surface flat to 1e-3 m; every lake cell below its own surface.
* `utilities/lake_calibration.html` **PASS** in Chromium, reproducing the node figures exactly.
* `utilities/verify_field_v1.html` **PASS 30/30** after every step.
* `utilities/test_regional_terrain.html` still renders with no page errors. Note it does **not**
  load `terrain_rivers.js`, so `window.TerrainRivers` is absent there and the sheet degrades —
  pre-existing, not a regression.

#### FIXED 2026-09-17 — P4, the sea was shaded from its bed

**The whole change is in `shade()` in `js/terrain_render.js`, and it is small.** Nothing else was
touched: not the field, not the panel, not the exporters, not `planet_renderer.js`.

The fault was the one the lake model had already fixed for lakes and left standing for the sea.
Normals, slope and micro-texture all describe the ground UNDER the water, so an ocean drew its
drowned hills as though they were dry land — hillshaded seabed ridges, cast shadows between
them, the lot. It is why a mid-ocean sheet looked embossed rather than surveyed.

**Three lines of behaviour changed:**

* `water` — a mask of every pixel `classify()` paints as water, built from the SAME test the
  albedo pass uses (below the per-pixel datum: a lake's own surface where there is one, the
  planetary sea level otherwise). It replaces the lake-only `lakeFlat` flag, so sea and lake now
  take the same path. Only `ice`, `standard` and `exotic_wet` are considered — the three types
  with a water branch. **A dry world can carry pixels below its datum with none of them wet**,
  and flat-shading those would drain the relief out of desert, cold desert and rock worlds.
  Measured: zero pixels change on any of the three dry types.
* `surfF` — the same field with every water cell raised to its own surface, passed to
  `castShadows` and `computeAO` in place of the bed. This is what keeps the two facts that
  belong to the water (a cliff shades the water beside it; basin walls close the sky over it)
  while dropping the one that belongs to the bed (a submerged ridge shadowing open ocean from
  below — the bed showing through by a second route, which flat normals alone would not have
  removed).
* Water pixels are lit flat: `ndl = Lz`, slope 0, sky term 1, micro-texture off. **Depth still
  shows, because depth is real** — through the hypsometric bands and the `em` albedo
  modulation, both of which TINT rather than light. What is gone is the directional cue, which
  was the part claiming the sea had a topography of its own.

**Measured, 36 windows across 9 world types, same field rendered through the pre-patch module
and the patched one:**

| Quantity | before | after |
|---|---|---|
| Interior-water luminance gradient, mean of 21 wet windows | 2.400 | **0.518** |
| Worst single interior-water gradient | 124.35 | **16.72** |
| Interior-water luminance sd, mean | 11.10 | 8.44 |
| Open-ocean window (ice h6), gradient / sd | 15.349 / 44.87 | **0.391 / 6.39** |
| `shade()` cost, mean of 36 | 118 ms | **116 ms** |

**The sea fill cannot touch land, and that is a proof rather than an estimate.** Land is by
definition at or above the planetary datum, so a seabed raised TO that datum never stands above
a land pixel; AO ignores anything lower than the pixel it samples for, and the shadow ray only
climbs. Measured directly against `castShadows`/`computeAO`, which are exported: across ten
windows and **1.04 M land pixels, zero moved.**

**A lake fill is different, and the measurement is what said so — not the reasoning.** A lake's
surface can perch above ground just outside its rim. The rim always dominates in principle, being
at exactly the lake's level and nearer, but **neither sampler visits every cell**, so a one-cell
rim can be stepped over and the water plane behind it seen instead. Measured: **1.4–9.7% of land
pixels move, every one of them within 8 cells of a lake shore**, which is the AO radius. That is
a correction rather than a regression — the water plane is genuinely there, and the old code was
occluding from the lake BED, which is not — but it does mean **lake-adjacent land shifts slightly
against what was verified on 2026-09-14.** Sean's call if that is unwanted; filling sea only is a
one-line narrowing.

**Consequence worth knowing:** a window that is entirely open ocean is now a nearly featureless
blue plate. That is correct — open ocean has no surface features at 130 m/px — but it is a
visible change from a sheet that used to be full of (wrong) detail. Sites come from `findSites()`,
which requires dry land, so the case arises only when the user pans out to sea.

#### FIXED 2026-09-17 — the Obsidian wiki export crashed on EVERY world

Sean reported `Error: sheetFiles is not defined` from Export Wiki after pinning a site.

**One missing parameter.** `_buildWorldFile()` in `js/obsidian_exporter.js` reads `sheetFiles`
at what is now line 425, and the caller passes it as a 13th argument — but the function's
parameter list stopped at `subsectorLink`. Added `sheetFiles` to the signature; that is the
entire fix.

**It was not about pins, and it was not intermittent.** Reading an undeclared identifier throws
a `ReferenceError` whatever its value would have been, and `_buildWorldFile` runs for every world
at disclosure level (d). **So the Obsidian wiki export has aborted on the first world of the
first system since the code was added on 2026-09-14** — pinned or not, images on or off. The
HTML exporter carries the same feature through a `Map` that is passed properly and was never
affected.

**How it was verified, which is the part that matters.** A real sector was generated in the app
(`runMgT2EMacro` over 40 hexes), a pin placed on a mainworld, and `ObsidianExporter.startExport`
run with `downloadBlob` intercepted and the resulting ZIP's local headers parsed:

* **Negative control first.** With the parameter removed again, the run reproduces Sean's exact
  message: `Uncaught (in promise) ReferenceError: sheetFiles is not defined`, and no ZIP is
  produced. A fix that is not watched to fail first is not a tested fix.
* With the parameter present: **889 files**, including `images/Preto - Preto - Test Site
  (0102).png` — the regional sheet — and the world's markdown carrying

  ```
  ## Regional Surveys

  **Test Site**

  ![[Preto - Preto - Test Site (0102).png]]
  ```

**Why 2026-09-14's "16 assertions on the export path" did not catch it.** Those assertions
exercised `pinnedSitesFor`, `renderRegionalSheet` and `sheetLabel` — the pieces — and never
called `startExport`. A ReferenceError in the assembly is invisible to any test that does not
RUN the export. **Exporters must be tested by exporting.** The interception recipe above is
cheap enough that there is no excuse: stub `downloadBlob`, scan the ZIP for `PK\x03\x04`, read
the member names and bodies straight out of the local headers.

#### Verification of the P4 work (2026-09-17)

The wiki-export fix above carries its own verification; this covers the sea shading.

* `utilities/verify_field_v1.html` **PASS 30/30**. Expected, and worth stating plainly: that page
  does not load `terrain_render.js` at all, so this change cannot reach version 1.
* `utilities/lake_calibration.html` **PASS** — hydrographics 7 at 1.90% of land, cover falling
  monotonically to 0.00% at hydrographics 1. Unchanged figures; hydrology was not touched.
* `utilities/test_regional_terrain.html` renders with no page errors.
* **The real app, end to end.** `hex_map.html` loaded in Chromium with its full script set,
  `TerrainPanel.open()` called exactly as the Regional Maps button calls it, Render clicked, the
  survey sheet read back off its canvas: sheet renders, five site slots present, **no page
  errors**, and interior water measures a mean gradient of 1.22 against a terrain key reading
  Shallow Water 11.2% / Abyssal Depths 9.0% / Continental Shelf 7.4% / Deep Ocean 7.2%.
* A before/after pair of the same coastal window confirms by eye what the numbers say: the sea
  loses its drowned hills, the land keeps every ridge, snowfield, lake and river unchanged, and
  an offshore island reads as an island instead of merging into shaded seabed.

#### NEW 2026-09-17 — circular Point-to-Point routes (Start and End may be the same world)

Sean asked for it: same origin and destination, which with waypoints means a round trip.

**The engine already did this.** `generatePointToPointRoute` has always built `stops =
[startId, ...waypointIds, endId]` and resolved each consecutive pair with its own BFS, so
`[A, W, A]` is two ordinary legs and needs no engine change whatsoever. **The only thing
standing in the way was one UI refusal**, `'Start and End must be different worlds.'` in
`js/ui_menus.js`. Three edits, all in that file:

1. **The refusal moved BELOW waypoint resolution and now depends on it.** Same-hex is legal with
   at least one waypoint; with none it is still refused, and not on taste — `stops` becomes
   `[A, A]`, and `_bfsPath` seeds `visited` with its own start, so a leg from a world to itself
   can never match and the search exhausts. The engine would report "no path within Jump-N",
   which is true and useless. The new message names the world and says to add a waypoint.
2. **Map chain-building can close the loop.** `MapPick._deliverChain` refused to set End to the
   Start; it now refuses only while there is no waypoint yet, and says so when the click closes
   the route. (Clicking *past* the start already worked — the standing End is promoted to a
   waypoint — so the chain builder could already put a loop in the fields; only Generate refused.)
3. **The success message reports the shape that was actually built**, read back off the segments
   with `walkRouteChain` rather than guessed from the stop list.

**A ROUND TRIP LANDS IN ONE OF THREE SHAPES, and which one is not predictable.** Every leg is a
shortest path, so the return leg often reuses the way out — and `addRoute` skips pairs the slot
already holds. Measured over 24 trials per row, 81 worlds, Jump-2:

| Waypoints | Out-and-back LINE | Clean CIRCLE | Loop with a TAIL |
|---|---|---|---|
| 1 | **23** | 1 | 0 |
| 2 | 1 | **7** | 16 |
| 3 | 1 | 4 | **19** |
| 4 | 1 | 2 | **21** |
| 5 | 0 | 0 | **24** |

* **One waypoint almost never loops** — the return is the outbound reversed, the second leg
  writes nothing, and the result is a line. The toast says exactly that and what to do.
* **A clean circle is the minority even at 2-3 waypoints**, and by 5 it never happened: the more
  stops, the likelier two legs share a hex. `route_extend_spec.md` §5 C4 already recorded this —
  *"a round trip is close to guaranteed to"* produce a loose third end — so this is the shape the
  design expected, not a defect.

**What the other route features do with a loop, all pre-existing and all correct:**

* **Continue** — `walkRouteEnds` returns `'cycle'` for a clean circle, and the existing message
  already says *"forms a closed loop, so there is no loose end to continue from."* A loop with a
  tail returns `ok` with one loose end and `crosses: true`, so Continue works from the tail tip.
* **Combine** — `getCombineCandidates` uses the stricter `walkRouteChain`, so a circle is not
  offered. Correct: there is no end to join to.
* **Route Systems panel** — a circle lists **unordered** (bullets, every world present) because
  `walkRouteChain` answers "is this one unbroken chain" and a cycle is not. **This is the one
  visible rough edge.** Ordering a circle is easy in principle — start at the stored Start and
  walk round — but a loop WITH A TAIL is genuinely ambiguous, and the traversal order is not
  stored (deliberately: see the shortfall note against storing whole paths). Left alone. If Sean
  wants round trips to list in travel order it is a real piece of design, not a tweak.

**Verified in the real app, driving the panel's own fields and its Generate button** — not the
engine underneath it — on a freshly generated 50-world block at Jump-2:

| Case | Result |
|---|---|
| Same Start/End, no waypoint | **refused**, with the new message naming the world |
| Same Start/End, 1 waypoint | 3 segments, two loose ends, "out-and-back line" message |
| Same Start/End, 3 waypoints | 11 segments, closed with a tail, matching message |
| Ordinary A -> D with a waypoint | 7 segments, travel order, message unchanged |

No page errors in any case. A clean circle was also generated and photographed on the map:
five worlds, five segments, drawn as a closed pentagon.

#### FIXED 2026-09-17 — generating into an occupied slot destroyed the route silently

**Reported by a user.** They had a Custom Network in a slot, opened Point-to-Point to extend it,
**forgot to tick "Continue existing route"**, generated — and the network was gone.

**The clear was never the bug; the silence was.** Every generator except Continue begins by
emptying its slot:

```js
if (!opts.append) window.sectorRoutes = sectorRoutes.filter(r => r.routeId !== routeId);
```

That is `_generateIntoSlot` in `js/ui_menus.js`, and it is correct — a rebuild rebuilds. It is
also **undoable**, because the clear sits behind `saveHistoryState`. But nothing on screen said
anything had been destroyed, so there was no reason to reach for Ctrl+Z, and by the time the
loss was noticed the undo was buried.

**The fix is a confirmation in `_generateIntoSlot`, not in the four generate handlers**, because
the destructive step lives there: one clear, one warning, and it cannot fire for Continue, which
passes `append` and never clears. It therefore covers **XBoat, Custom Network, Point-to-Point and
BTN alike** — the user hit it with P2P, but all four wiped a slot the same way.

* It fires only when the slot **already holds segments**, so a first generation is silent.
* It runs **before `saveHistoryState`**, so declining leaves no undo entry to step through.
* `_generateIntoSlot` now returns `cancelled`, because `produced: false` had come to mean two
  different things. Without it the four callers would report "no path found within Jump-N" at a
  user who had just chosen to keep their route. Each caller gained one line.
* **The advice is tailored**, via `getRouteEnds`: "tick Continue" is wrong for a route that
  cannot be continued, so a closed loop is told it has no loose end and a route in pieces is told
  to join them first.

The message:

```
"XBoat Route" already has 6 connections.

Generating will DELETE them and build a new route in their place.

To ADD to it instead, click Cancel, tick "Continue existing route" in the
Point-to-Point section, and generate again.

OK replaces the route. Cancel keeps it. (Ctrl+Z undoes a replacement.)
```

**Auto-ticking Continue was considered and rejected — the codebase had already rejected it.**
The comment above the checkbox in `hex_map.html` says a silently-ticked box "would append when
the user expected a rebuild", which is the mirror image of this bug. A confirmation asks; a
default guesses.

**Verified in the real app, driving the panel and its Generate button**, with a route seeded into
the slot as hand-written segments so the guard was tested against segments this app did not
generate either:

| Case | Result |
|---|---|
| Occupied slot, user clicks **Cancel** | 6 segments -> **6**. Work kept, no toast, no undo entry |
| Occupied slot, user clicks **OK** | 6 -> 7, replaced, normal success toast |
| **Empty** slot | **no dialog at all**, route generated |
| **Continue ticked** | 3 -> 8 appended, **no dialog** — the append path never asks |
| Replace, then **Ctrl+Z** | 8 -> 2 -> **8**, and the restored segments are **identical** to the originals — so the dialog's own claim about undo is true |

No page errors in any case.

**The one cost, and it is real:** iterating on a Point-to-Point route — generate, add a waypoint,
generate again — now prompts on every pass, and §0.0.A records that building a long route in
passes is a normal workflow. If that grates, the narrowing is one condition: skip the prompt when
`routeDef.automationRef.type` equals the type being generated, which keeps the warning for the
case actually reported (a network replaced by a P2P) and for hand-drawn or imported segments,
which carry no `automationRef` at all. **Not done — ask Sean first**, because it also silences
the warning for a same-type rebuild over hand-edited segments.

#### "I'm not seeing any lakes" — measured, and the model is behaving

Asked on 2026-09-17 after the lake model shipped. Lakes ARE generated on every wet world; below
hydrographics 6 they are simply **very small**. Measured on four sheets per world at the panel's
own size (876 x 584, ~125 km across, ~143 m/px):

| Hydro | Lakes >= 0.25 km2 per sheet | Sheets with any | Lake % of land | Biggest lake |
|---|---|---|---|---|
| 9 | 95.3 | 4 of 4 | 10.25% | 447 km2 |
| 8 | 71.8 | 4 of 4 | 4.71% | 115 km2 |
| 7 | 40.5 | 4 of 4 | 1.33% | 24.9 km2 |
| 6 | 28.5 | 4 of 4 | 0.67% | 18.2 km2 |
| 5 | 20.8 | 4 of 4 | 0.29% | 6.4 km2 |
| 4 | 11.3 | 4 of 4 | 0.09% | 2.3 km2 |
| 3 | 3.8 | 4 of 4 | 0.03% | 1.1 km2 |
| 2 | 0 | 0 of 4 | 0% | — |
| 1 | 0 | 0 of 4 | 0% | — |

**At hydrographics 4 the biggest lake on a sheet is about 2.3 km2 — roughly an 11 x 11 pixel
blob.** It is there, and it is blue, and it is easy to look straight past. At hydrographics 2 and
below there are none at all, which is the evaporative balance doing exactly what it was
calibrated to do (`LAKE_K0 = 75`, `LAKE_K_DECADE = 0.45`, fitted to Earth at hydro 7 = ~2%).

**Before concluding the model is broken, check in this order:** the world's hydrographics digit;
that the Terrain Model is **Tectonic** (hydrology never runs at version 1); that **Rivers & lakes**
is ticked and not greyed out; and that you are looking at the **regional survey sheet** and not
the whole-world flat map — **the world image has no lakes at all, by design.**

#### NEXT STEPS (written 2026-09-17 — nothing is half-finished)

The four 2026-09-16 fixes, the lake model, P4 and the wiki-export crash are all complete and
verified, and **uncommitted — ask Sean what is staged.** In rough priority:

1. **The changelog still owes the terrain work.** The two ROUTE items were written up on
   2026-09-18 — round trips and the replace warning, entries 3 and 4 of v0.18.0, in
   `changelog.md` **and** in README.md's mirrored copy. **There are two changelogs and they must
   stay in step**; README's v0.18.0 block was empty, so the two existing terrain entries were
   copied across to keep the numbering identical. What is still unrecorded is the 2026-09-16 and
   2026-09-17 TERRAIN work: the four hydrology fixes, the lake model, the flat sea, and the wiki
   export crash. Sean deferred those deliberately; write them before the version closes.
   **`changelog.md` and `README.md` are LF-only** while the rest of the repo is CRLF — detect
   per file before writing to either.
2. **`TerrainRivers` exports a `draw` that does not exist** (the return list in
   `js/terrain_rivers.js`). It silently resolves to `renderer.js`'s global `draw()` — the
   whole-map canvas repaint — because the IIFE's scope chain reaches global scope. Harmless
   today, since nothing calls `TerrainRivers.draw`, but anyone who does gets a full map redraw.
   **Delete the word `draw,` from the export list.** Found because the module threw a
   ReferenceError in a node harness, where `renderer.js` is not loaded.
3. **A pin on a MOON is saved and never exported.** `openBodyImagePanel` is reachable for any
   body in the accordion, moons included, so its Open Map -> Regional Maps -> Pin path files a
   pin under the moon's name. But both exporters only ever call `pinnedSitesFor(hexId,
   world.name)` inside the worlds loop — the moons loop does world IMAGES only, in the HTML
   exporter as well as the Obsidian one. So the pin persists, costs nothing, and silently never
   appears in an export. Decide whether moons get sheets or the button gets hidden for them.
4. **No directive exists for the v0.18 terrain work.** Every prior series has one
   (`route_*_spec.md`, `html_extract_manifest.md`); this section and the code comments are the
   only record.
5. `buildNetwork`, `networkFor`, `localNetwork`, `inflowFor` and `carve` in `terrain_rivers.js`
   now have **no callers** — only `linesFromField` and `drawLocal` are used. Decide whether the
   global-network path is still wanted before it rots.

#### Traps, all of them found the hard way

* **`remapHeight` diverges, and half of that is now PERMANENT.** `terrain_field.js`
  interpolates between CDF samples; `planet_renderer.js` returned the raw integer rank, which
  terraced the regional view. Decision 3 (built 2026-09-14) made planet_renderer adopt the
  interpolated form **under v2 only** — **v1 keeps the raw integer rank verbatim, forever**,
  because changing it would redraw every existing sector. So the two forms coexist by design.
  They agree to within 1/2048. **Do not "tidy" the v1 branch away.**
* **Float32 cannot hold a small fill increment.** Pit-filling raises a cell by an epsilon; at
  ~15,000 m elevation float32's step is ~0.001, so 1e-4 rounds to nothing and the fill makes
  ties instead of gradients. All hydrology uses Float64.
* **And the epsilon must then be tiny.** The fill raises each step away from an outlet, which
  is itself a radial gradient. At 1e-3 it accumulates into metres of false slope across a
  flat and channels draw as straight spokes.
* **Never route on two criteria.** Steepest-descent on one surface with a fallback on another
  creates cycles, which strand rivers mid-map. Drainage is acyclic by construction: a cell
  may only drain to one the flood reached earlier.
* **Lookup grids show their own cells.** `planet_renderer`'s 32-cell noise table has ~3 cells
  across a 130 km window on a large world, rendering as rectilinear blocks. Version 2's
  smooth term is table-free hash noise for this reason.
* **Ridged multifractal makes rings.** Its ridges follow the noise's contours, which are
  closed loops, so unwarped it produces circular ranges around circular basins. The detail
  cascade is domain-warped to break them.
* **Flat plate interiors terrace.** A large share of the sphere at one height collapses the
  CDF into a plateau, and a percentile remap with plateaus steps under hillshading.
* **Set input min/max BEFORE value.** A range input clamps `value` against the range in force
  at the time; assigning value first silently pinned a slider to 200 while its label read
  5200.
* **Seeded palettes exist.** Exotic wet worlds carry several seeded ocean/land pairings
  chosen by the `-oc` RNG draw. Anything drawing water must use
  `TerrainRender.waterColors()`, not a constant.
* **Body identity is the NAME.** Keys are `masterSeed | hexId | body name`, matching
  `PlanetRenderer.imageSeed()`. `orbitId` is not unique and list indexes differ per engine.
* **A guard that exists in a sibling function is not a guard.** The "sea drains nowhere" rule
  was present in `buildNetwork` and in `carve()` and absent from `_hydrology()`, which is the
  one the sheet actually runs. Three copies of a rule means two chances to be wrong. When a fix
  reads as "restore the guard", check every copy, and prefer one definition.
* **Land can be classified as water.** Any band measured against a LOCAL reference can go
  negative, and `classify()` reads negative as water. Decide land against water on an absolute
  fact (`aboveSeaM`), and let the relative measure choose a band only within one of them.
* **A pixel threshold is not a size.** "40 px" meant 7 km2 at one resolution and 0.77 km2 at
  another, and a target built on it was meaningless. Terrain targets go in km2.
* **Membership is not penetration.** Counting river vertices that land ON water read about 1%
  and looked like a bug; measuring their distance from the shore showed every one of them at
  exactly one cell — smoothing and rounding noise. Measure the distance, not the membership.
* **A STANDING GATE CAN FAIL FOR THE ENVIRONMENT.** `verify_field_v1.html` FAILED 18 of 30 on
  2026-09-17 — in three separate browser configurations — and the code was completely innocent.
  Launching with **`--disable-gpu` turns it green, 30/30.** The 18 that move are exactly the
  renders containing VECTOR rasterisation (the hex grid strokes and lobe/diamond separators on
  sinusoidal and diamond, and the `fillText` hemisphere labels); the 12 that never move are
  exactly the pure `putImageData` renders, mercator and mollweide. GPU and software rasterisers
  antialias lines and glyphs differently, and the hash covers those pixels. **Before believing a
  FAIL, re-run with `--disable-gpu`** — and note that the field itself is not what is being
  compared in those 18.
* **A MISSING PARAMETER IS INVISIBLE TO EVERY TEST THAT DOES NOT RUN THE WHOLE THING.**
  `_buildWorldFile` read `sheetFiles` while its signature stopped one argument short, and the
  Obsidian wiki export threw on the first world for three days. `node --check` passes — the
  syntax is fine. Unit assertions on `pinnedSitesFor` / `renderRegionalSheet` / `sheetLabel` pass
  — the pieces are fine. Only calling `startExport` fails. **Test an exporter by exporting:** stub
  `downloadBlob`, scan the bytes for `PK\x03\x04`, and read the member names and bodies out of
  the ZIP's local headers. And **watch it fail first** — re-break the fix and confirm the error
  matches the one reported, or you have only proved that today's code runs.
* **A geometric proof is only as good as the sampler.** "The rim is nearer and at least as high,
  therefore it always dominates" is true of the continuous surface and false of
  `computeAO`, which takes 6 samples along each of 8 directions, and of `castShadows`, which
  truncates a float march to integer cells. Both can step over a one-cell ridge. The proof held
  for the sea, where the fill never exceeds any land height, and failed for lakes for exactly
  this reason — **measured, after being argued the other way.**
* **Every source file in this repo is CRLF.** A scripted edit that reads with Python's
  universal newlines and writes back flattens the whole file to LF, which shows up as a
  diff against every line. Read and write bytes, or convert back before finishing.

#### Verification

Everything was verified **in a real browser with Playwright**, not by `node --check` — which
passed clean on every one of the bugs above. Most of that suite lived in the session
scratchpad and is gone, but the piece that matters was preserved:

**`utilities/verify_field_v1.html`** — open it directly, no server. It renders 30 images at
terrain field version 1 and compares them against hashes recorded on 2026-09-13 in
`utilities/verify_field_v1_baseline.js` (extended 2026-09-14 with the cold-dry world). **Run it
after ANY change to the terrain field.** A FAIL means version 1 has been disturbed and every
existing sector's world images will look different after an upgrade. It currently passes 30/30
— **in a software rasteriser. Re-run any FAIL with `--disable-gpu` before believing it**, and
check whether mercator and mollweide are among the failures; if they are not, the field is fine.

**`utilities/lake_calibration.html`** (new 2026-09-16) — the second standing gate. It measures
lake cover across hydrographics and FAILs if hydrographics 7 leaves the 2% ± 0.6 band that
Earth sets, or if cover stops falling monotonically as the world dries. **Run it after changing
`LAKE_K0`, `LAKE_K_DECADE`, the pit-fill or the flow accumulation.** It currently passes.

### 0.0.0 v0.18.0 — open, nothing chosen (2026-09-11)

The threads that already exist in this document, listed so a fresh session is not starting
from a blank page. **None is committed to, and the order is not a recommendation.**

| Candidate | Where to start | What it is |
|---|---|---|
| **RTT and AoW editor bring-up** | §0.3 is the entry point, §5 the inventory | The largest deliberate gap. AoW is the further along — `js/aow_seed_bridge.js` and `js/aow_uwp_auditor.js` exist, but AoW was **never verified in-browser** (OW-9). RTT is slated for a full overhaul rather than incremental fixes |
| **OW-5 layer 2 — the shared commit path** | §6.2 | A `commitEditorSystem()` shared by the editor *and* `macro_orchestrator.js` was never built, so the editor's `_clearSystemData()` and the macro's inline clear-block are still drifting. This document already says to settle it **before** a new engine arrives, which makes it a prerequisite of the row above rather than a rival to it |
| **OW-3 — per-engine UWP auditor** | §6.2 | Same shape: any engine brought online needs its own populated `sys.auditResult` before Fill & Save is trustworthy. Done for MgT2E, CT and T5 only |
| **The two route file icons** | `route_file_spec.md` OQ-1, §0.0.6 | Save and load sit side by side as near-identical file glyphs. v0.17.4 removed the third by turning CSV into a word; the remaining pair is a standing reservation needing Sean's eye in real use |
| **OW-65 — three parked route/filter items** | §6.2 | **Deliberately parked pending user evidence — do not restart without new information.** The single question that settles two of the three at zero cost is written out in OW-65 |

### What shipped in v0.17.5

Six changelog entries. One new feature, one layout fix, four route-logic bugs — all in the
Route Manager and its Point-to-Point panel. **No directive was written for this release**;
these six entries and the code comments are the record.

1. **+ Add Route** — the feature. Routes could be deleted but never created, because the only
   thing that ever made one was a top-up firing solely when *every* slot was in use. A list cut
   down to three, one of them empty, was stuck there permanently. The new button
   (`hex_map.html` `#btn-route-add`, `window.addRouteSlot` in `js/ui_menus.js`) adds one on
   demand, taking the first standard colour **not already on the map** and the lowest free
   **1–9** shortcut, so a rebuilt list is not a column of identical green with no keys.
2. **The Route Manager was too narrow for its own rows.** A row needs 467px to fit and 480px to
   sit naturally — eleven controls and ten gaps — inside a 430px window, so the 50px colour
   swatch had been rendering as a **14px sliver** all along; opening a tall automation panel
   added a vertical scrollbar and turned the squeeze into an overflow. Now 520px
   (`hex_map.html`, `#route-window`), deliberately above the strict minimum because scrollbar
   widths and font metrics differ between machines.
3. **Continue demanded more of a route than it needed.** It required one unbroken chain with
   exactly two ends — but P2P resolves each leg with its own BFS, so a waypointed route
   routinely revisits a world (degree 4) or doubles back and leaves a loose *third* end. Both
   are ordinary results, and a round trip is close to guaranteed to be one of them. Continue now
   asks only that the route is in **one piece** with **at least one loose end**, and offers every
   end it has. Closed loops and disconnected pieces are still refused, for reasons about the
   route rather than the test. **This is the new `walkRouteEnds` / `getRouteEnds` pair in
   `js/routes.js`** — strict `walkRouteChain` is unchanged and still governs Combine and travel
   order. The box also **went stale**: computed once on panel open and never re-tested, so
   drawing segments by hand with the panel open left it greyed out. It is now re-tested on every
   route change, without disturbing a tick already made.
4. **P2P reported more segments than it drew** — it counted path length, not connections
   actually written, so the duplicates a doubling-back leg produces were counted too. Measured:
   9 announced over a map showing 6.
5. **Continuing towards a world the route already reaches** reported "no path found" and named
   the Jump number, sending the user off to raise a limit that was never the problem. It now
   says the two worlds are already connected.
6. **Deleting the last spare route undid itself.** The top-up ran on every render, so the row was
   removed and re-created in the same breath — same number, colour and key, hence invisible.
   With + Add Route providing slots on request the top-up is both unnecessary and opposed to what
   Delete is for, so it no longer runs on render; it still runs after a file or TravellerMap
   import. A new slot also no longer takes a number that orphaned **segments** are still using.


### What shipped in v0.17.4

Seven changelog entries. Two new features, four bug fixes, one cleanup.

1. **Continue an existing route** — the feature. A P2P route can be added to instead of
   rebuilt: tick the box, the Start pre-fills with one of the route's two ends, and the
   rest of the route is never re-searched. Off on every panel open.
2. **Combine two routes** — a 🔗 on each Route Manager row folds another route into this
   one, when the *merged shape* would be a single unbroken line.
3. **R9, open since 2026-07-30: a filter outlived its own form.** The filter's per-hex
   *result* was persisted; its *inputs* were not. See §0.0.7 — it is the most transferable
   thing in this release.
4. **The Systems panel and CSV could omit worlds** — a line plus a separate closed loop
   passed the "exactly two loose ends" test, and the walk then listed 3 of 6 worlds while
   reporting itself ordered. Found by extracting the chain walk, not by looking for it.
5. **The CSV button is now a word**, not a third file-shaped icon.
6. **Multi-sector OTU import undo** — it *looked* like it undid the import while actually
   reverting unrelated earlier work. Now not undoable at all, like the universe import.
7. Two more dead functions removed from `js/routes.js`.


### The route directives — the authoritative documents

*(This heading and its table had drifted apart — the table had ended up below v0.17.3's
entries, under the wrong heading. Rejoined 2026-09-11.)*

| Directive | Covers | Status |
|---|---|---|
| `directives/route_file_spec.md` | Saving/loading one route's connections to `.json` | **IMPLEMENTED** in v0.17.2 |
| `directives/route_partial_spec.md` | Point-to-Point routes that keep what they could build when a leg cannot be routed. §13 records route *forcing*, designed and then dropped; §14 holds the wider route-editing design | **IMPLEMENTED** in v0.17.3 |
| `directives/route_extend_spec.md` | **Continue** an existing P2P route with another leg, and **Combine** two routes that meet end to end. Both keep the route a single chain, which is the rule that governs the whole design | **IMPLEMENTED** in v0.17.4 |

**`route_extend_spec.md` was amended 2026-09-11** to match v0.17.5: C1 and C4 carried the old
eligibility rule ("a clean chain") for ten days after the code stopped using it. The chain
invariant in its §3 still governs **Combine** and travel order — it is only Continue's gate
that was weakened. See §4.1 of that spec.


### What shipped in v0.17.3

Six changelog entries, all verified in a real browser with Playwright.

1. **Build as far as possible** — the feature. A P2P route that cannot reach a stop is kept
   up to the closest world it could reach, which is named and ringed. Off by default.
2. **"No path found" names that world too**, whether or not the option is on.
3. **The completion toast names worlds**, not bare hex IDs, like every other message.
4. **The top of a new waypoint field was clipped** by its own scroll container.
5. **Undo after a TravellerMap XML route import** now restores the slots it created.
6. **Undo after loading a Map JSON** now restores the route slots it replaced.

Also, not user-visible: `utilities/route_corpus.js`, `route_perf.js` and
`route_test_common.js` are new and **committed this time** (§0.0.5).


### What shipped in v0.17.2

Eight changelog entries, all verified in-browser with Playwright. Unstaged in the working
tree — **git is Sean's, never touch it.**

1. **Autocomplete list never appeared.** `.draggable-palette`'s `backdrop-filter` makes it
   the containing block for `position:fixed` children, so the list was displaced by the
   window's own offset and clipped away by `overflow:hidden`. Fixed by portaling it to
   `<body>`. **This trap applies to every palette in the app** — see §0.0.1.
2. **Generation is atomic.** `_generateIntoSlot()` in `js/ui_menus.js`: a run producing
   nothing restores the map, the route and the undo entry. Failure is judged by what landed
   in the slot, not by the count a generator reports — `generateBTNRoutes` measures net
   array growth, which reads zero for a segment that evicted a rival as it was added.
3. **"No path found" names the failing leg**, and names stops the way the builder does.
4. **Phantom route slots** no longer created (`resolveRouteId` returns `extras.routeId`
   before consulting definitions), plus a guarded cleanup for sectors that already have
   them. The guard is a conjunction — `groupId` alone is NOT a phantom marker, because
   `migrateToRouteDefinitions` legitimately stamps one on definitions rebuilt from
   pre-v0.10 save files, and those own segments.
5. **Undo covers route definitions** — `saveHistoryState(name, { includeRouteDefinitions: true })`.
   **Opt-in on purpose**: names, colours, shortcuts and visibility are edited without
   pushing history entries, so an always-on snapshot would let an undo of an unrelated
   action silently revert a rename made afterwards.
6. **Dead duplicate `ensureFreeRouteSlot`** removed from `js/routes.js`. The live one is in
   `js/ui_menus.js`, which loads later and had always overwritten it.
7. **Save/load a single route** — one new column in the Route Manager row. See
   `route_file_spec.md`.
8. **Pathfinder scaling** (WP0 of the forcing spec). Cube-coordinate bucket index plus
   parent pointers. A 19-leg route across ~16,000 worlds went from **25.3 s of frozen
   browser to 0.2 s**; growth is now linear rather than quadratic. Proved route-identical
   across 19 scenarios and 2,603 segments.

### 0.0.1 Two traps the v0.17.2 session paid for — do not rediscover them

- **`backdrop-filter` on `.draggable-palette` makes it the containing block for
  `position:fixed` descendants**, and its `overflow:hidden` then clips them. Any dropdown,
  tooltip or popover placed inside `#route-window`, `#hex-editor`, `#filter-modal`,
  `#border-window` or `#region-window` will be displaced by exactly the palette's top-left
  offset and vanish once the window is dragged. Portal it to `<body>` while open and return
  it home on close. The symptom is "the list never appears" — it IS built, `display:block`,
  correct contents, painted somewhere invisible. Diagnose by measuring the offset: if it
  equals the palette's top-left, it is this.
- ~~**A hex within N of another can be up to ~1.5N away in offset `r`**, so
  `_buildEmptyHexCandidates` under-collects empty hexes at the fringe.~~
  **FALSE ALARM — RETRACTED 2026-09-01. Do not "fix" this.** Measured against the app's own
  `getHexDistance` for N = 1..6, from origin columns of both parities: **max |Δq| = N and
  max |Δr| = N exactly.** In this app's odd-q, flat-top layout the offset `r` coordinate
  absorbs the column shift (`r = z + floor(q/2)`), so a `±N` box in `(q,r)` is precisely
  sufficient — it is the general warning about offset coordinates applied to a layout where
  it does not bite. `_buildEmptyHexCandidates` was then audited directly against an
  exhaustive scan of the whole grid at maxJump 1, 2, 3, 4 and 6 on a 249-world sparse map:
  **0 missed and 0 extra at every range.** The function is exact. The wider caution about
  offset coordinates is still worth holding — it is simply not true of these two axes.

### 0.0.2 Partial routes — what was built, and the forcing design that was dropped

**Route "forcing" was designed in full on 2026-08-19 and DROPPED on 2026-08-27. It was never
built and is not pending.** The filter-relaxing second pass, the weighted penalty search,
`forced: true` segment flags, dashed rendering, the "Detour outside the filter if needed"
checkbox — **none of it exists.** Do not resurrect it without talking to Sean. That spec was
rewritten as `route_partial_spec.md`; its §13 records what forcing was and why it went, and
§14 holds the wider route-editing design.

**What was built instead: partial route generation — shipped in v0.17.3, complete.** What
follows is the design record for behaviour that is live today, not a plan. It began with a
power user, via Sean:

> "I personally like it to generate as far as it can so I can manually bridge it and tell it
> to continue. That's the least amount of work."

So: when a Point-to-Point leg cannot be routed, the generator commits the route as far as
the search actually reached — call that world **C**, the reachable world closest to the
target — names it, and stops. The user bridges with a waypoint and regenerates, which is
0.2 s at Imperium scale post-WP0.

**Decisions, settled 2026-08-27:**

| | |
|---|---|
| Max Jump, the filter, Allow Empty Hexes | all **hard**. Nothing is relaxed, ever. This is the whole simplification |
| Multi-leg | **stop at the first shortfall.** Later legs are not attempted, so the route stays ONE unbroken chain — which is why `getRouteSystemList` needs no change |
| C | the reachable world **closest to the target**, tie-broken by fewest hops then world-array order |
| C must be a **world** | never an empty hex, even in Allow Empty Hexes mode. C exists to be bridged from, and a route ending in deep space is a jump to nowhere |
| No progress | if nothing reachable is closer than the start, there is no partial. Report the plain failure |
| Control | a **checkbox, default off**, so today's one-and-done behaviour is untouched |
| The strict failure message names C too | even with the checkbox off. Pure information, changes no state |
| A route that stops short **is a route** | it commits, with the shortfall marked. This does change what a route slot can hold |


### 0.0.2.1 The partial-route engine contract, as built

*(This subsection used to be a nine-row progress table, every row reading DONE. The table was
removed 2026-09-11; what remains is the part that is still reference.)*

- `_bfsPath(startId, endId, worlds, maxJump, worldById, outBest)` and
  `_bfsPathWithEmpty(..., maxEmptyJumps, outBest)` take an **optional** out-parameter. Their
  `path | null` return is unchanged. When `outBest` is supplied and the search exhausts, it
  is filled with `{ id, path, distance, hops }`. **All tracking is behind a null check**, so
  Custom Network and BTN — which calls the search once per qualifying world pair — pay
  nothing.
- `generatePointToPointRoute(..., maxEmptyJumps, allowPartial = false)` returns
  `{ segments, failure, shortfall }`. `shortfall` is
  `{ legIndex, total, fromId, targetId, reachedId, distance, finalStop }`, non-null only
  when a partial route was committed. `failure.reachedId` / `failure.shortfallDistance` are
  populated on a strict failure so the message can name C; both are null when nothing
  reachable was closer than the leg's own start.
- **`best` is requested on every P2P run**, not only when `allowPartial` is on, because the
  strict failure message wants C as well. Measured cost at 16,000 worlds: full-exhaustion
  leg 31.4 → 32.4 ms, 19-leg route 147 → 151 ms. Long leg unchanged.
- **Proved not to disturb pass 1:** `utilities/route_corpus.js` reports all 38 scenarios and
  18,079 segments identical with `allowPartial` off.


### 0.0.3 Where the code is

| Thing | Where |
|---|---|
| Route generation entry points | `js/routes.js` — `generatePointToPointRoute`, `generateAutoRoutes`, `generateXboatRoutes`, `generateBTNRoutes` |
| The pathfinder + new index | `js/routes.js` — `_bfsPath`, `_bfsPathWithEmpty`, `_buildWorldIndex`, `_getWorldIndex`, `_indexNeighbours` |
| Atomic generation | `js/ui_menus.js` — `_generateIntoSlot` |
| Route Manager UI, rows, panels | `js/ui_menus.js` — `renderRouteWindow`, `openRouteAutoPanel`, `getRouteSystemList` |
| Route files | `js/ui_menus.js` — `exportRouteFile`, `_parseRouteFile`, `importRouteFile`, `_pickRouteFileFor` |
| Autocomplete + its portal | `js/ui_menus.js` — `setupWorldAutocomplete`, `_wacPortalOpen`, `_wacHideActive` |
| Phantom-slot cleanup | `js/ui_menus.js` — `getOrphanRouteDefinitions`, `renderOrphanRouteNotice` |
| P2P panel markup | `hex_map.html` — `#route-auto-config-p2p`, around line 2796 |
| Undo | `js/core.js` `saveHistoryState`, `js/keyboard_shortcuts.js` `_restoreRouteDefinitions` |
| Add Route, and colour/shortcut allocation | `js/ui_menus.js` — `addRouteSlot`, `_nextRouteSlotId`, `_nextRouteColor`, `_nextRouteShortcut`; the button is `#btn-route-add` in `hex_map.html` (v0.17.5) |
| Continue's eligibility test — the **weak** one | `js/routes.js` — `walkRouteEnds`, `getRouteEnds`. One piece, at least one loose end (v0.17.5) |
| Travel order and Combine — the **strict** test | `js/routes.js` — `walkRouteChain`, `getRouteChain`. One unbroken line, exactly two ends. **These two tests are deliberately different; do not merge them** |
| Route Manager width | `hex_map.html` — `#route-window`, `width: 520px`. A row needs 467px to fit at all (v0.17.5) |

### 0.0.4 Housekeeping — open items only (rewritten 2026-09-11)

*(Everything previously listed here was struck through and done: the v0.17.2 changelog dating,
and the note about which commit carried it. Removed rather than kept as strikethrough.)*

- ~~**`route_extend_spec.md` C4 is out of date.**~~ **AMENDED 2026-09-11.** C1 and C4 now
  state the weak rule, §4.1 records the four v0.17.5 behaviours the original decisions did not
  cover, and §3 carries a pointer saying the chain invariant still governs Combine and travel
  order but no longer gates Continue. §10 and §14 were brought in line at the same time.
  **One error corrected in passing:** §14 claimed the Route Manager row "still fits its 430px
  column exactly". v0.17.5 item 2 establishes it never did — a row needs 467px, and the 50px
  colour swatch had been rendering as a 14px sliver.
- ~~**`utilities/route_continue.js` predates v0.17.5** and has no coverage of the weak
  eligibility test, + Add Route, the segment-count fix or the "already connected"
  message.~~ **CLOSED 2026-09-11 — see §0.0.5.** The suite was first re-run unchanged against
  v0.17.5 to settle the question it was flagged for: **15/15 passed**, so it was blind rather
  than broken. It now carries 23 more checks (15 → 38), and `utilities/route_add_slot.js`
  is new, with 11.
- **Unrelated, carried forward:** `html_extract_manifest.md` OPEN-2 (and its §9.1 note) still
  says `changelog.md` reads `[v0.17.0.1] - In Progress`. It does not — that entry is dated
  `2026-08-10`. OPEN-2 is stale on the dating point; its *other* claim, that entry 1 is
  contradicted by entries 2 and 4 in the same section, has still never been checked.


### 0.0.5 The test harness — REBUILT AND COMMITTED 2026-08-27

Last session's Playwright scripts lived in a session temp directory and were lost. They have
now been rebuilt and **committed to `utilities/`**, so this cannot happen again. Sean
approved adding them to the repo.

| File | What |
|---|---|
| `utilities/route_test_common.js` | Shared bootstrap: launches `hex_map.html` past the splash, builds a deterministic map, fingerprints segments |
| `utilities/route_corpus.js` | The corpus differ — 19 scenarios × 2 maps = **38 scenarios, ~18,000 segments** |
| `utilities/route_perf.js` | The performance measure — long leg, full-exhaustion leg, and a 19-leg route at six map sizes |
| `utilities/route_continue.js` | Continue — **38 checks**, drives the real panel. The C-checks are v0.17.4; the **V-checks are v0.17.5's weakened eligibility rule** |
| `utilities/route_add_slot.js` | **+ Add Route — 11 checks** (v0.17.5): colour and shortcut allocation, the cursor landing in the new name, Ctrl+Z, and that the removed render-time top-up no longer undoes a deletion |
| `utilities/route_combine.js` | Combine — 13 checks, including eligibility rejection (v0.17.4) |
| `utilities/filter_persistence.js` | R9 — 11 checks across restart, store, save file and indicator (v0.17.4) |
| `utilities/otu_import_undo.js` | Multi-sector import undo — 6 checks, drives the real modal **offline** by seeding the importer's localStorage cache and stubbing `fetch` to throw (v0.17.4) |

**Coverage reaches v0.17.5 as of 2026-09-11.** The gap and how it was closed, because the
shape of it recurs:

Every C-check in `route_continue.js` lays a clean two-ended chain — a shape **both** the old
eligibility rule and the new one accept. So all fifteen passed against v0.17.5 unchanged, and
all fifteen would still pass if the rule were silently put back. A suite can be green, honest
and blind at the same time; green says nothing about which *version* of the behaviour it
pins. **What was missing was not assertions but shapes.**

Eleven new scenarios (V1–V11, 23 checks) now lay the shapes the C-checks cannot reach — a three-ended Y, a
self-crossing route, a closed loop, and a line beside a detached loop — and each is paired
with `getRouteChain().ok === false` on the same segments as its own control. **That pairing is
the point:** it asserts the shape really is one the old rule refused, so if the eligibility
rule is ever reverted the check fails instead of quietly going vacuous. The
line-beside-a-loop case earns its place separately — it presents exactly **two** loose ends
and must still be refused, which is what makes "count the ends" the wrong test.

Also now covered: the staleness re-test (including that it leaves a user's tick alone, and
that a tick which loses its precondition unticks itself **and restores the form**), the
setup-clearing on a route with more than two ends, the "already connects" message, and the
segment count — the last asserted as *announced equals actually drawn*, at **Jump-1**, because
at Jump-3 the pathfinder shortcuts past the route's own edges and nothing is ever retraced.
The bug is unreproducible at the jump number every other check happens to use.

The corpus differ (`route_corpus.js`) was unaffected throughout: it fingerprints route
*output*, and none of v0.17.5 changes what the generator draws.

**Every suite carries a negative control**, and this is not ceremony. Three of the four
would pass vacuously without one: "nothing is hidden" passes on a map where the filter never
ran; "the route is a chain" passes on an empty slot; "Ctrl+Z changed nothing" passes when the
undo stack is empty *however broken undo is*. Each control removes the behaviour under test
and asserts the check fails. Add one to anything new.

**Usage, from the repo root:**

```
node utilities/route_corpus.js --out tmp/before.json     # before a change
node utilities/route_corpus.js --against tmp/before.json # after — exits 1 if routes moved
node utilities/route_perf.js --json tmp/perf.json
```

`tmp/` is gitignored, which is deliberate: the harnesses are committed, the baselines are
regenerated fresh each time (~30 s) rather than stored.

**Properties that make it worth trusting** — each was verified, not assumed:

- **Deterministic.** Two runs of unchanged code produce byte-identical corpora. The map is
  built by a frozen LCG in `route_test_common.js`, *not* the app's `mulberry32`, so the
  corpus cannot drift when `js/core.js` changes. Fingerprints are sorted and carry nothing
  time-based.
- **Sensitive.** A tampered corpus (2 segments removed from one scenario, 1 fake segment
  added to another) is caught in both directions, naming the exact segments, exit code 1.
- **Not vacuous.** The first draft passed `filteredHexIds: []` while `filteredOnly` was
  true, so the traversal graph held only the stops and **every P2P scenario silently
  produced zero segments**. A corpus of zeroes compares equal to itself forever. The
  scenario segment counts are printed on every run for exactly this reason — read them.
  The only legitimate zeroes are `p2p_island_*` (unreachable by design) and `p2p_j2` on the
  sparse multi map.
- **Exercises every generator.** XBoat needs `starport`/`tl`/`pop`/`tradeCodes`/bases for
  `calculateT5Ix`; BTN needs a finite `data.WTN`. Omitting either does not error — it
  silently yields an empty route. The world generator's `tl` and `pop` ranges are tuned so
  Ix reaches 4+, because a flat spread made the app's default `minIx: 4` find nothing.

**Baseline captured 2026-08-27**, before any partial-route work, in `tmp/perf_baseline.json`
and `tmp/corpus_baseline.json`. The perf numbers independently reproduce the spec's post-WP0
§9.1 table:

|  worlds | long leg | no path (full exhaustion) | 19-leg route |
|--------:|---------:|--------------------------:|-------------:|
|     432 |   1.2 ms |                      1.0 ms |       2.0 ms |
|   1,152 |   2.5 ms |                      2.2 ms |       5.3 ms |
|   2,512 |   4.8 ms |                      4.7 ms |      15.7 ms |
|   5,712 |   8.8 ms |                     10.8 ms |      36.1 ms |
|  10,192 |  13.3 ms |                     19.7 ms |      86.0 ms |
|  15,952 |  19.7 ms |                     31.4 ms |     147.3 ms |

Growth is linear — worlds ×1.57 → time ×1.48 to ×1.71. Compare any future reading on the
same machine; an idle laptop and a busy one differ by more than some changes being measured.

**Bootstrapping note:** open `hex_map.html` via `file://`, click `#btn-launch-app` to get
past the splash, then drive the app through `page.evaluate` — all the generators and
`hexStates` are globals. Note `hexStates` is **empty** on a fresh launch; a harness must
build its own map. Redo is **Ctrl+Shift+Z**, not Ctrl+Y. Escape closes the route panel.

### 0.0.6 Open items — one live, none blocking (rewritten 2026-09-11)

**Live:**

- **The two route file icons.** A save glyph (`fa-file-export`) and a load glyph
  (`fa-file-import`) sit side by side in each Route Manager row, near-identical without
  hovering. v0.17.4 removed the third of the set by turning CSV into a word; the remaining pair
  was left alone on purpose. Standing reservation needing Sean's eye in real use —
  `route_file_spec.md` OQ-1.

**Also open, but recorded elsewhere:** OW-3, OW-5 layer 2 and OW-65 are System Editor and
route/filter items and live in §6.2, summarised in §0.0.0 and §4. **OW-65's three items are
parked pending user evidence — do not restart them without new information.**

**Closed during this series.** Kept as three lines rather than deleted, because the reasoning
transfers; the full accounts are in the changelog entries for the release named.

- `_autoAssignXmlRoutes` and `applyLoadedMapData` (`js/io_manager.js`) both called
  `saveHistoryState` **without** `includeRouteDefinitions`, so an undo restored hexes and
  segments while leaving foreign route slots in place. Fixed 2026-08-27 (v0.17.3), both verified
  in-browser with a negative control that strips the option at runtime to prove the test can
  fail.
- The multi-sector OTU import's `bulkMode` comment described a deferred history snapshot **that
  did not exist**. The real behaviour was worse than "not undoable": Ctrl+Z *looked* like it
  undid the import while actually restoring a much older snapshot and silently reverting
  unrelated earlier work. Fixed 2026-09-01 (v0.17.4) by clearing the undo/redo stacks the way
  the universe import always has — snapshotting was rejected because a pre-import copy of
  `hexStates` is exactly the size the 5-entry undo cap exists to avoid. Test:
  `utilities/otu_import_undo.js`.
- `getAutoRouteGroups()` and `clearAutoRouteGroup()` in `js/routes.js` were verified dead — no
  reference in any `.js`, `.html`, `.md` or `.json`, dynamic-dispatch spellings included — and
  removed 2026-09-01. Corpus re-run after removal: 38 scenarios, 18,079 segments, identical.


### 0.0.7 R9 — the pattern worth carrying forward

A filter survived a browser restart while its input fields did not, so the map reopened
filtered by criteria present nowhere in the UI. Reported 2026-07-30, could not be reproduced,
parked for a year, reported again 2026-09-01 and fixed the same day.

**The pattern: a derived value stored on the thing it describes gets persisted along with
it.** `applyActiveFilters()` writes its verdict onto each hex as `state.isHiddenByFilter`;
`db_manager` persists hex states *whole* (`store.put(state, hexId)`), and so does the Map
JSON save. So the filter's result was saved and its inputs were not.

**The tell: two functions answering the same question from different sources.**
`hasAnyActiveFilter()` reads the DOM; `getFilteredHexIds()` reads the persisted flags. After
a restart they flatly disagreed. That disagreement *is* the bug, stated in one line — worth
grepping for elsewhere.

**Why it hid for a year:** the flag only reached disk if a save ran *while* the filter was
applied. Filtering alone pushes no history entry, so whether it reproduced depended entirely
on what you did next.

**The consequence nobody reported** was the serious one: P2P passes `filteredOnly = true`
with `getFilteredHexIds()`, so route generation was silently restricted to the survivors —
measured, a nine-segment detour where five direct segments existed.

**The fix, three parts:** recompute after `loadFromDB()` (`input_init.js`), which also
self-heals an already-polluted store; `stripHexViewState()` (`core.js`) applied at all five
persistence boundaries; and an always-visible indicator, because the root usability failure
is that **a filtered map is indistinguishable from a sparse one.**


### How this work was verified — reuse the method

Every fix was reproduced in a real browser with Playwright (already in `node_modules`)
before being fixed, and re-verified after. `node --check` alone has repeatedly missed real
bugs in this codebase. The highest-value pattern used here: **capture a corpus of generated
routes before a refactor, re-run after, diff.** That is what made "WP0 changes no routes" a
measurement rather than a claim.

---


**Companion manifest:** `directives/html_extract_manifest.md` — the wiki export, and where
**all recent work has happened**. Read it before touching `js/export_core.js`,
`js/obsidian_exporter.js`, `js/html_exporter.js`, `js/disclosure.js`,
`js/disclosure_grid.js`, or the disclosure gate in `js/renderer.js`. Its section 0 is the
cold-start handover. A third directive,
`directives/fog_of_war_field_tags.md`, is the authoritative per-field disclosure answer key.

**This document covers the v0.16.x System Editor**, which is paused, not abandoned. It is
the reference for resuming RTT and AoW editor support.

---

## 0. Current State (2026-08-06)

> **Superseded by §0.0 above (last refreshed 2026-09-11).** The section below describes the
> project as of the exports series and is kept for the System Editor detail it carries.
> Where the two disagree about what is current, §0.0 is right.

### 0.1 Where the project is

| | |
|---|---|
| **Most recent work** | **v0.17.2–v0.17.5 — routes**, closed 2026-09-11. See §0.0; nothing in *this* document's own subject matter (the System Editor) moved during it. The exports series (v0.17.0 / v0.17.0.1) closed before it — see the companion manifest. |
| **This document** | v0.16.x System Editor. **Paused** after MgT2E, CT and T5 were brought fully online. |
| **Paused** | RTT and AoW editor support — the reason this manifest is retained. |
| **Open here** | Three items only, all in 6.2: OW-3, OW-5 layer 2, OW-65. See section 4. |

**Nothing is currently in progress in either manifest, and v0.18.0 is open with nothing
chosen — see §0.0.0.** The companion's section 9 lists two non-blocking open items (an in-app
number-formatting sweep, and dating the v0.17.0.1 changelog entry — the second of which is
itself stale, see §0.0.4); this document's section 4 lists three. There is no half-finished
work.

### 0.2 System Editor engine support — verified against code 2026-08-06

**MgT2E, CT and T5 are operational for both Create and Edit. RTT and AoW are neither.**

| Engine | Create | Edit | Notes |
|---|---|---|---|
| MgT2E | ✅ | ✅ | first engine online |
| CT | ✅ | ✅ | online 2026-07-04 |
| T5 | ✅ | ✅ | closed out 2026-07-16 (see index: OW-19, 42-49) |
| RTT | ❌ | ❌ | **paused** — radio `disabled`, "(coming soon)" |
| AoW | ❌ | ❌ | **paused** — radio `disabled`; generator groundwork exists, see OW-9 in 6.2 |

The three gates that must be changed together to enable an engine — they have drifted
before, see pattern 4 in 6.1. **Line numbers re-verified 2026-08-06:**

1. `js/system_viewer.js:1125` — orrery "Edit System" button:
   `if (edition === 'MgT2E' || edition === 'CT' || edition === 'T5')`
2. `js/canvas_input.js:84-86` — `_seCanEdit`, the right-click gate: checks
   `mgt2eData/mgtSystem`, `ctData/ctSystem`, `t5Data/t5System`
3. `hex_map.html:1444-1466` — `#se-engine-dialog` Create radios. MgT2E (1452), CT (1455)
   and T5 (1458) are enabled; **AoW (1461) and RTT (1464) carry `disabled`** plus a
   "(coming soon)" label and a `not-allowed` cursor on their wrapping `<label>` — four
   things to change per engine, not one.

> **Gate 3's line numbers had drifted by ~25 lines** between 2026-08-01 and 2026-08-06 —
> `hex_map.html` gained the export modal's FORMAT/VERSION controls above it. Gates 1 and 2
> did not move. Re-check all three before trusting them; they are the exact kind of
> reference that rots silently.

### 0.3 Resuming RTT or AoW

1. **Section 5** — the per-engine stub inventory. This is the actual handoff document and
   was left at full detail deliberately.
2. **Section 6.1** — nine recurring failure patterns drawn from the MgT2E/CT/T5 work.
   Expect them to recur; pattern 1 (seeded bodies skipping generation steps) and
   pattern 6 (RTT's flat body layout) are the two most likely to bite.
3. **Section 6.2** — OW-9 in particular: AoW's readiness audit and what `aow_seed_bridge.js`
   had to solve. OW-3 (per-engine UWP auditor) and OW-5 (commit-path layer 2) are both
   still open and both apply to any new engine.

### 0.4 Document history

Condensed 2026-08-01 from ~356 KB to ~159 KB. Section 6 previously carried 65 work items
and 7 bugs in full forensic detail; closed items are now a one-line index (6.3) with the
transferable lessons distilled into 6.1. Sections 2 and 5 were kept at full detail because
they are the RTT/AoW handoff.

**Refreshed 2026-09-11** for v0.17.5, the release that closed the routes series. No code
changed. The header, §0.0 and §0.1 were brought up to date; a new §0.0.0 lists the v0.18.0
candidates (nothing is chosen); §0.0.2 was retitled and its nine-row all-DONE progress table
removed, keeping the engine contract; §0.0.4 and §0.0.6 were rewritten to drop items that were
struck through and done; §0.0.6 was moved back above §0.0.7, where it belongs. Three pieces of
drift were found and corrected in passing: the route-directives table had ended up under the
wrong heading, §0.0.6 still described **three** file-shaped icons in a Route Manager row when
v0.17.4 had turned one of them into a word, and the commit hashes §0.0 was told not to keep
were being kept anyway. Two new pieces of drift are now **recorded rather than fixed**, both
in §0.0.4: `route_extend_spec.md` C4 no longer matches the code, and
`utilities/route_continue.js` has no coverage of v0.17.5.

**Audited 2026-08-06** against the code, alongside the companion manifest. No code changed.
Header and section 0 refreshed; gate 3's line numbers corrected (they had drifted ~25
lines); the companion manifest's standing complaint that "section 2 still describes the
v0.16.0 System Editor" was **retired** — that cleanup happened in the 2026-08-01
condensation, and section 2 is now explicitly labelled a delivered design reference.

---

## 1. Project Goal
An easy to use Traveller/Cepheus system builder and navigator


## 2. System Editor — Design Reference (v0.16.x, delivered)

**Status: delivered for MgT2E, CT and T5; paused for RTT and AoW.** This section is no
longer a forward plan — it is the design reference for the editor as built, retained
because RTT/AoW work will need it. "Next Update" framing below has been left in place
where it still describes real behaviour.

A full-screen system editor allowing users to create star systems from scratch or structurally edit existing generated systems. The result must be indistinguishable from an engine-generated system in hexStates, JSON export, and map display.

---

#### Entry Points
- Right-click a single selected hex → context menu shows **"Create System"** (empty/unpopulated hex) or **"Edit System"** (populated hex)
- **Edit button** inside the existing System Viewer (same full-screen canvas)

#### Architecture Constraints
- **New script** (`js/system_editor.js` or similar) — minimal changes to existing engines
- The System Viewer is the UI container; Edit Mode is a state within it, not a separate tool
- Always work on a **copy** of hexState data — never mutate live state during editing
- On save, result must land in hexStates as a normal system. ~~with one hidden flag: `manually_edited: true`~~ **Dropped 2026-07-03, see OW-4 in Section 6** — no consumer for this flag exists or is planned; do not implement it.
- No duplication of engine logic

#### Creating vs Editing
- **New system:** Engine selection dialog appears first, then the editor opens blank. **Current as of 2026-08-01:** in `hex_map.html`'s `#se-engine-dialog` (lines 1419-1431) the MgT2E, CT and T5 radios are enabled; **AoW and RTT carry `disabled` and are marked "(coming soon)"**. Create and Edit therefore support the same three engines — see section 0.2. (This bullet previously accumulated four layers of superseded corrections, including a claim that Create allowed all five engines; that was untrue by 2026-08-01 and has been replaced with the verified state.)
- **Existing system:** Engine is locked to whatever generated it. No engine switching in v1. **As of 2026-07-11, "existing system" only reaches the editor at all for MgT2E/CT** — see the Supported Engines note above.
- Minimum required to unlock Fill & Save: **a primary star must exist** (all its fields can be blank)

#### Body Types — Full Fidelity from Day One
Stars (primary, companion), terrestrial worlds, gas giants, planetoid belts, moons, rings, small moons, worldlets.

#### Structural Operations
- **Add bodies** via contextual buttons within the tree (e.g. "Add World" under a star node)
- **Delete bodies** — cascade delete with warn-and-confirm when a star has orbiting bodies
- **Move bodies** — drag and drop within a single star's orbit tree; typed orbit number as fallback for edge cases
- Cross-star moves are **v2**
- Changing a star's spectral type/class does **not** cascade to worlds
- Zone-inconsistency warnings shown at move time or Fill time; user may proceed consciously

#### Mainworld Rules
- User can flag/unflag any body as mainworld
- Re-designating mainworld on an existing system is a key use case
- ~~If no mainworld at Fill time: warn, offer user the choice to pick one or let engine decide~~ — **CORRECTED 2026-07-03, see OW-2 (CLOSED):** no warning needed. A null mainworld at Fill time already falls through to the generator's normal habitability-based election automatically — this already is "let engine decide," with no dialog required.
- T5 gets a dedicated one-off mainworld selection algorithm (T5 does not designate mainworld the same way as other engines) — **deferred to v0.16.1; see Algorithm 7 and Section 5**

#### Supported Engines — CURRENT as of 2026-08-01 (verified against code)

**MgT2E, CT and T5 support both Create and Edit. RTT and AoW support neither — paused.**
The authoritative summary, with the three gate locations, is in **section 0.2**; this
subsection covers per-engine implementation detail only.

The history is worth one line because Section 5 still reflects it: all five engines were
briefly UI-exposed on 2026-07-05; T5/RTT/AoW were pulled back on 2026-07-11 as
preliminary and needing overhaul; **T5 was overhauled and re-enabled 2026-07-16**
(index items OW-19, OW-42 to OW-49). RTT and AoW never came back. Treat any
"UI-exposed"/"fully online" claim for RTT or AoW in Section 5 as describing the
2026-07-05 state, not today.

- **MgT2E** (Mongoose Traveller 2nd Ed) — bottom-up fill; `js/mgt2e_bottomup_generator.js`. Both entry points (`canvas_input.js` right-click gate, `system_viewer.js`'s "Edit System" button) recognize `mgt2eData`/`mgtSystem` or `edition === 'MgT2E'` respectively.
- **CT** (Classic Traveller) — bottom-up fill; `js/ct_bottomup_generator.js`. **Online 2026-07-04** — the same two entry points also recognize `ctData`/`ctSystem` or `edition === 'CT'`. Has its own `_ENGINE_ADAPTERS.CT` entry, `sys.auditResult` coverage, and `capturedPlanets` support — see the corrected CT subsection in Section 5.
- **T5** (Traveller 5) — **online 2026-07-16** after a dedicated overhaul pass. `t5_topdown_generator.js`'s `generateT5System()` takes and fully consults `seedSys`; moon counts cap via `generateT5Satellites`'s `capToExisting`. Closed items OW-19, OW-42 to OW-49 cover that pass; OW-50 to OW-60 cover the OTU-import and companion-star follow-ups.
- **RTT (RTT Worldgen) — PAUSED, not online.** Editor support is preliminary and slated for a full overhaul rather than incremental fixes. See Section 5's RTT subsection for the stub inventory. **Note pattern 6 in 6.1 before starting**: RTT stores bodies flat in `star.planetarySystem.orbits[]` with no `.contents` wrapper, and has no `sys.worlds` — a layout that has already caused one silent, long-lived bug elsewhere in the codebase.
- **AoW (Architect of Worlds) — PAUSED, not online.** Further along at the generator level than RTT: `js/aow_seed_bridge.js` (star-physics solver, disk-worksheet synthesis) and `js/aow_uwp_auditor.js` were both built 2026-07-05, and an `_ENGINE_ADAPTERS.AoW` entry exists. **Never verified in-browser** — see OW-9 in 6.2 for the full readiness audit and what remains.

#### Fill & Save — The Commit Action
- One-time, whole-system commit — not iterative
- **MgT2E, CT, T5, RTT, and AoW (all UI-exposed as of 2026-07-05):** all run their bottom-up (or top-down, for T5) engine sequence with a "check user first, generate if missing" gate at every decision point. User-set values feed downstream decisions correctly (e.g. user-set spectral type informs habitable zone; for AoW, a user-set spectral type is resolved to concrete star physics by `js/aow_seed_bridge.js`'s solver — see the AoW subsection in Section 5).
- **Checkbox (unchecked by default):** "Allow engine to add additional bodies" — when unchecked, Fill only fills fields on bodies the user placed; when checked, engine may add bodies per its normal rules
- Physical inconsistencies trigger a warning; user may correct or proceed. **This is OW-3 (UWP Auditor) — DONE for all five engines (MgT2E/CT 2026-07-04, T5/RTT 2026-07-04/05, AoW 2026-07-05), see Section 6.**

#### UX & Safety
- Cancel → warn-and-confirm → discard copy (original untouched)
- **Undo/redo** within editor session (Ctrl+Z / Ctrl+Y); history stack discarded on exit
- Pre-load existing system fully into editor with body detail panels collapsed by default
- Never silently break physics rules — always warn first, always let user override consciously

#### Out of Scope for v1
- Engine switching on existing systems
- Cross-star body moves
- CSV import (v2)
- Right-click within editor tree for add-body (v2)

---

#### hexStates Structure (per system hex) — CORRECTED 2026-07-03 (RTT was omitted from this list; it is a fully live 5th engine, confirmed via `macro_orchestrator.js`)
Each populated hex carries parallel objects — all must be written correctly on Fill & Save:
- `type: 'SYSTEM_PRESENT'`
- `mgtSystem` / `ctSystem` / `t5System` / `aowSystem` / `rttSystem` — raw body/orbit data per engine
- `mgt2eData` / `ctData` / `t5Data` / `rttData` — mainworld UWP fields
- `mgtSocio` / `t5Socio` — socioeconomic expansion data
- `name`, `allegiance`, `cluster`
- `manually_edited` — **dropped as a requirement, see OW-4 in Section 6.** Not currently set anywhere; do not assume it's present on editor-produced systems.

---

### Phase 2 — Architectural Plan (completed 2026-06-19)

#### Modified Files

| File | Risk | What Changes |
|---|---|---|
| `hex_map.html` | LOW | Add context menu items, engine-selection dialog, warning dialog HTML, script tag for system_editor.js |
| `js/canvas_input.js` | LOW | Show/hide `ctx-create-system` and `ctx-edit-system` per selection state; add click handlers |
| `js/system_viewer.js` | MEDIUM | `open()` accepts optional explicit hexId; add `_editMode` flag; add Edit button to `_buildOverlay()` |
| `js/macro_orchestrator.js` | LOW-MEDIUM | Extract commit block to shared `_commitSystemToHex()`; add `commitEditorSystem()` for Fill & Save |
| `js/mgt2e_bottomup_generator.js` | HIGH | Add optional `seedSys = null` parameter; thread override gate through all 5 phases |
| `js/aow_bottomup_generator.js` | HIGH | Same pattern as MgT2E |
| `js/ct_bottomup_generator.js` / `js/ct_world_engine.js` | — | **UPDATED 2026-07-04: structural AND field-level (size/atm/hydro/pop) gating both done; CT is UI-exposed** — see Section 5. |
| `js/t5_topdown_generator.js` | — | **Deferred (v0.16.1) — still accurate.** No structural or field-level gating exists yet — see Section 5. |
| `js/rtt_engine.js` | — | **CORRECTED 2026-07-03: structural gate + full pipeline threading already done, not deferred.** Broader field-level `isManual` coverage still outstanding — see Section 5. |

---

#### The Override Gate Pattern (CORRECTED 2026-07-03 — this was originally a design sketch that was never built this way; see Algorithm 6 for the actual mechanism, which this now matches)

The real mechanism uses a `seedSys` parameter (not `userOverrides`) plus the pre-existing `isManual()`/`_manualFields` tracking from `core.js` — there is no `_getOverride()` helper anywhere in the codebase.

```javascript
// Existing macro callers pass no second argument → seedSys is null → identical behavior
function generateMgT2ESystemBottomUp(hexId, seedSys = null) {

    // Star fields are NOT gated field-by-field in the generator — _buildSeedSys() (system_editor.js)
    // always resolves a concrete value before the generator ever sees it (e.g. `s.sType || 'G'`),
    // so seeded stars are simply used as-is rather than rerolled-unless-manual.

    // Body/world fields ARE gated field-by-field, e.g. in mgt2e_world_engine.js:
    if (!isManual(body, 'density')) body.density = finalDensity;
}
```

**Critical safety rule:** When `seedSys` is null (all existing macro calls), every `isManual` check returns false and all gates pass — generation is identical to today. This is confirmed real in `mgt2e_world_engine.js` (e.g. lines 98, 117, 121, 140, 144) and CT/RTT's structural (not field-level) equivalents — see corrected Section 5.

#### The Seed Object Schema (CORRECTED 2026-07-03 — field names below are the real ones; the version previously here — `{ stars, bodies, mainworldRef, allowAddBodies }` — does not match `_buildSeedSys()`'s actual output)
```javascript
{
  stars: [],             // seeded star objects, always fully resolved (no undefined fields)
  worlds: [],            // MgT2E/AoW/T5: seeded body list (CT uses `orbits`; RTT uses `rttBodies`, a per-star 2D array)
  _mainworldRef: null,   // underscore-prefixed — _id of the body flagged as mainworld by the user
  _allowAddBodies: false // underscore-prefixed — mirrors the "Allow engine to add additional bodies" checkbox
}
```

#### The Commit Path — 🟡 PARTIALLY BUILT, ACCEPTED FINAL STATE (see OW-5, Section 6)
Original plan: after Fill runs, `system_editor.js` would call `commitEditorSystem(hexId, engineResult, engine)` in `macro_orchestrator.js`, writing the completed system to hexStates and triggering a map redraw. **`commitEditorSystem` in `macro_orchestrator.js` does not exist and, per Sean's explicit 2026-07-04 decision, is not planned** — see OW-5 in Section 6. What was built instead: `system_editor.js`'s own internal duplication between `_fillAndSave()`/`_preview()` was extracted into a shared `_generateAndCommit()` (2026-07-04). The separate duplication in `macro_orchestrator.js`'s macro commit blocks remains un-consolidated — a deliberate, accepted scope decision, not an oversight. Also drop the `manually_edited: true` detail from this description — that flag was retired, see OW-4.

---

### Phase 3 — Algorithm Design (completed 2026-06-19)

#### Key Discovery: `markManual` / `isManual` / `clearManual` (core.js)
These three functions already exist and are the native mechanism for tracking user-set fields on body objects. The `_manualFields` array on each body/star object is how generators know which fields to skip. The System Editor plugs directly into this — no new tracking mechanism needed.
- `markManual(obj, field)` — call when user sets a field in the editor
- `isManual(obj, field)` — generators call before each field assignment
- `clearManual(obj, field)` — call when a body moves to a new orbit (clears zone-dependent fields)

---

#### Algorithm 1: Editor Working Copy State — CORRECTED 2026-07-03

```
WorkingCopy {
  hexId, engine, allowAddBodies, mainworldRef, age, hzco

  stars: [StarObject]   — each has _id (NOT _editorId), _manualFields[], role, parentStarId, and all star fields, always fully resolved (never undefined — see Algorithm 6)
  bodies: [BodyObject]  — flat list; each has _id, _manualFields[], parentStarId, type, orbitId, isMainworld, moons[]
}
```
- There is **no `isNewSystem` field.** New-vs-edit is tracked separately via a module-level `_pendingCreateHexId` variable, not a property on the working copy itself.
- **Open existing system:** Deep-clone raw engine system (e.g. `stateObj.mgtSystem`) into working copy via `_buildWorkingCopyFromState()`. All fields present, none manual — user edits mark `_manualFields`. **CORRECTED 2026-07-16, see OW-39 (Section 6):** this note previously said the editor pushed to `_manualFields` inline instead of using `core.js`'s `markManual`/`clearManual` — that gap is now closed; all mark/clear call sites use the real global functions. Object-creation-time literals (e.g. a freshly built body's `_manualFields: []`) are unaffected — they were never a duplication site, just initial state.
- **Open new system:** Single blank StarObject (Primary, all fields undefined) via `_buildBlankWorkingCopy()`. Engine selection must have occurred first.
- **Original copy:** `_originalCopy` — confirmed real, a second deep-clone (`JSON.parse(JSON.stringify(wc))`) taken once at open and never reassigned except to `null` on close. Used by `_isDirty()` (`JSON.stringify(_workingCopy) !== JSON.stringify(_originalCopy)`) to detect changes — see corrected Algorithm 8, which also depends on a second condition beyond this comparison.

---

#### Algorithm 2: Local Undo/Redo Stack — CORRECTED 2026-07-03 (variable names only; behavior confirmed accurate)

Separate from global `saveHistoryState` (which is called once at Fill & Save for map-level undo).

```
_history []   — JSON-serialized WorkingCopy snapshots (NOT _editorHistory)
_histIdx -1   — current position (NOT _editorHistIdx)

_pushHistory():
  Truncate array above _histIdx
  Push JSON.stringify(_workingCopy)
  _histIdx = length - 1
  Cap at HISTORY_CAP = 50 entries — confirmed real constant, enforced with .shift() when exceeded

undo() [Ctrl+Z]:  _histIdx--; restore; _renderEditorTree()
redo() [Ctrl+Y]:  _histIdx++; restore; _renderEditorTree()
```
Push on every structural operation (before the change, confirmed) and on field-edit **`change` event** (not literally a `blur` listener, though functionally similar — not per keystroke).
Initial state pushed at editor open (position 0 = "before any edits").

---

#### Algorithm 3: Structural Operations — CORRECTED 2026-07-03

**`_addStar(separation, parentStarId)`** (not `addStar(role)`) → `_pushHistory()` fires **first**, then create StarObject (`_manualFields: []`), push to stars, `_renderAndPreview()`.

**`_addBody(parentStarId, bodyType)`** → `_pushHistory()` fires **first**, then create BodyObject with `_manualFields: ['type']` set inline as a literal at construction time (unchanged — this was never a duplication site; **CORRECTED 2026-07-16, see OW-39:** every *later* mark/clear of a field now calls `core.js`'s real `markManual`/`clearManual` instead of pushing/filtering `_manualFields` inline), `orbitId: _nextOrbitId(parentStarId)` computed inline, render.

**`_deleteBody(bodyId)`**
```
If body has moons → warn-and-confirm "This body has N moon(s) that will also be deleted."
_pushHistory → remove body + moons → if was mainworld: clear mainworldRef → render
```
Confirmed accurate in substance; only the exact dialog wording differs from the paraphrase above.

**`_deleteStar(starId)`** — broader in scope than previously documented:
```
If only star → show error "A system must have at least one star." (NOT "Cannot delete the only star")
Collect the target star PLUS any sub-companion stars orbiting it (not just bodies)
Count all bodies on this star (and its sub-companions) → warn-and-confirm
  "This star (and its companion) and N orbiting bodies will be permanently removed."
_pushHistory → remove star + sub-companions + all their bodies → clear mainworldRef if affected → render
```

**moveBody(bodyId, newOrbitId)** — implemented as `_insertAtOrbit(draggedObj, targetOrbitId)`
```
INSERT at targetOrbitId — do not swap.
Build unified pool: all bodies + non-primary companion stars (excluding the dragged item).
If moving inward:  pool items in [targetOrbitId, oldOrbitId - 1] shift out by +1
If moving outward: pool items in (oldOrbitId, targetOrbitId] shift in by -1
draggedObj.orbitId = targetOrbitId
All shifted items + draggedObj: mark orbitId as manual
_pushHistory (pushed before the change)
render + auto-preview
```
Note: typed orbit# changes that would cross a neighbor are blocked with a popup directing the user to drag-and-drop instead (`_wouldReorder` guard) — confirmed real, invoked at both the primary-body and companion-star orbit inputs.

**`_setMainworld(bodyId, isMoon, parentBodyId)`** (two more parameters than previously documented)
```
_pushHistory
All bodies AND moons: isMainworld = false (also restores true Belt type via _restoreBeltType() — an undocumented side effect: mainworld bodies display as type 'World' regardless of physical type, so un-designating one must restore its real type)
Target: isMainworld = true; markManual(target, 'isMainworld') — **CORRECTED 2026-07-16, see OW-39:** previously pushed to `_manualFields` inline; now calls the real `core.js` global, see Algorithm 1
mainworldRef = bodyId → render
```

---

#### Algorithm 4: Drag-and-Drop — CORRECTED 2026-07-03

There are actually **two separate draggable-object models**, not one — the original single "single star orbit tree only" header was incomplete rather than wrong:

**Body drags** (`_dragBodyId` + `_dragStarId` — two variables set together, not one) — genuinely restricted to a single star's tree:
```
dragstart(bodyId):  _dragBodyId = bodyId; _dragStarId = <that body's parent star>; bodyEl.style.opacity = '0.4' (no 'se-dragging' CSS class exists anywhere in the file)

dragover(event):
  If body.parentStarId !== _dragStarId → dropEffect = 'none'; return   (cross-star block, confirmed real)
  Target orbit is simply the hovered body's own orbitId — no separate drop-indicator/insertion-point calculation

drop():
  Calls _insertAtOrbit(dragBody, body.orbitId) directly — there is no moveBody() wrapper function
  Invalid drops simply no-op via the guard conditions above — there is no dragCancel() function

dragend:  _dragBodyId = null; _dragStarId = null; no history push (opacity style cleared)
```

**Companion-star drags** (`_dragCompanionId` — a third, separate variable) — CAN cross star boundaries, confirmed real:
```
A companion star can be dropped onto primary-level bodies or onto other companions,
via the same _insertAtOrbit(draggedObj, targetOrbitId) used for body drags.
This is what "Interleaved Companion Stars" (Phase 5, below) describes — it is not a
contradiction with the body-drag restriction above, they are different draggable types.
```

---

#### Algorithm 5: Fill Sequence — CORRECTED 2026-07-03 to match Section 6 decisions (this is the master sequence; keep it in sync whenever an OW item's status changes)

```
_fillAndSave():

  1. ~~VALIDATE PRIMARY STAR~~ — RETRACTED, see OW-1 (CLOSED).
     Structurally unreachable: the UI has no way to delete the primary or leave
     the stars array empty. Not implemented, not needed.

  2. ~~VALIDATE MAINWORLD~~ — RETRACTED, see OW-2 (CLOSED).
     A null mainworldRef already falls through to the generator's normal
     habitability-based election (WorldEngine.evaluateMainworldCandidates) —
     this already IS "Let engine decide," automatically, no dialog needed.

  3. BUILD SEED SYS
     seedSys = _buildSeedSys() — engine-specific shape, see corrected "Seed Object
     Schema" in Phase 2 above (_mainworldRef / _allowAddBodies, underscore-prefixed)
     ← _manualFields arrays are preserved in the clone

  4. CALL GENERATOR (switch on engine — UPDATED 2026-07-05: all five engines are now
     UI-exposed, see Supported Engines note)
     MgT2E → MgT2EBottomUpGenerator.generateSystem(hexId, seedSys)
     CT    → CT_Generator.generateSystem({ mode: 'bottom-up', hexId, seedSys })
     AoW   → AoWBottomUpGenerator.generateAoWSystemBottomUp(hexId, seedSys) — Phase 1/2 now
             call js/aow_seed_bridge.js for star-physics resolution and disk-worksheet
             synthesis when seeded (see the AoW subsection in Section 5)
     T5    → System_Driver.generateSystem({ edition: 'T5', ... })
     RTT   → generateRTTSectorStep1(hexId, { seedSys })

  5. RUN UWP AUDITOR — ✅ DONE for MgT2E and CT (2026-07-04). See OW-3 (Section 6).
     Each generator attaches its audit result to `sys.auditResult` (`auditMgT2ESystem`/
     `MgT2E_UWP_Auditor.runAndLog` for MgT2E; `auditCTSystem`/`CT_Auditor.runAndLog` for
     CT, wired into `ct_system_driver.js`). `_fillAndSave()` reads `result.newSys.auditResult`
     generically (engine-agnostic check) — if `pass === false`: warn-and-proceed
     [Proceed anyway] [Go back and fix]. Still a no-op for AoW/T5/RTT until each gets
     its own `sys.auditResult` attachment.

  6. COMMIT — 🟡 PARTIALLY EXTRACTED, ACCEPTED FINAL STATE. See OW-5 (Section 6).
     `_generateAndCommit(errorLabel)` (2026-07-04) is now the shared function called by
     both `_preview()` and `_fillAndSave()`: build seedSys → run generator (via
     `_ENGINE_ADAPTERS` for MgT2E/CT) → restore-display-manual-fields → preserve
     mainworld name → `computeSystemCounts` → `hexStates.set()` → redraw → (run UWP
     auditor gate, step 5 above) → close editor → `SystemViewer.open(hexId)`.
     ~~result.manually_edited = true~~ — DROPPED, see OW-4 (CLOSED). Do not implement.
     ~~commitEditorSystem(hexId, result, engine)~~ in `macro_orchestrator.js` — does not
     exist and is not planned (Sean's call, 2026-07-04): only `system_editor.js`'s own
     internal duplication was consolidated; the separate `macro_orchestrator.js` commit
     blocks remain un-consolidated. See OW-5's scope note in Section 6.
```

---

#### Algorithm 6: Generator Override Mechanism — CORRECTED 2026-07-03 (nuance added, mechanism itself confirmed accurate)

`_buildSeedSys` passes working copy bodies (with `_manualFields`) to the generator as its starting `sys`. Inside each generator, **body/world field assignments** are gated exactly like this — confirmed real and extensive in `mgt2e_world_engine.js` (e.g. lines 98, 117, 121, 140, 144):

```javascript
// Before: body.density = finalDensity;
// After:
if (!isManual(body, 'density')) body.density = finalDensity;

// allowAddBodies gate (inventory/allocation phases):
if (!seedSys || seedSys._allowAddBodies) {
    StellarEngine.generateSystemInventory(sys);
    StellarEngine.allocateOrbits(sys);
}
```

**Star fields do NOT use this pattern.** No generator calls `isManual(star, 'type')` or rerolls star fields — `_buildSeedSys()` always resolves every star field to a concrete value before the generator sees it (e.g. `type: s.sType || 'G'`), so seeded stars are simply used as-is. The `star.type = rollStarType()` example previously shown here described a mechanism that doesn't exist for stars; it's been replaced with the real body-field example above.

**Safety guarantee:** When `seedSys` is null (all existing macro calls), every `isManual` check returns false and all gates pass — generation is 100% identical to today.

---

#### Algorithm 7: T5 Mainworld Selection (confirmed 2026-06-19)

When the user has not designated a mainworld and engine is T5:

```
1. Collect all eligible bodies: all worlds + all moons (moons inherit parent's orbitId)
2. Determine hzOrbit for the primary star via getStarHZ(primaryStar)
3. For each body: distance = Math.abs(body.orbitId - hzOrbit)
4. Select body with smallest distance
5. If tied: random selection among tied candidates (use seeded rng)
6. If no eligible bodies exist: proceed with no mainworld (no error)
7. Designate winner: body.type = 'Mainworld'; body.isMainworld = true
```

---

#### Algorithm 8: Cancel Sequence — CORRECTED 2026-07-03

The actual function is `close()`, not `cancel()`. More importantly, the trigger condition is **not just `_isDirty()`** as previously documented — there's a second, undocumented condition:

```
close():
  If _isDirty() [= JSON.stringify(_workingCopy) !== JSON.stringify(_originalCopy)] OR _previewOriginalState is set:
    warn-and-confirm ('Discard Changes?', 'You have unsaved changes. Discard them and close the editor?')
      [Discard]      → _restorePreview() (reverts hexStates if a Preview snapshot exists, no-op otherwise) → _forceClose()
      [Keep Editing] → return
  Else → _forceClose() immediately
```

**The `_previewOriginalState` condition matters in practice:** `_preview()` doesn't touch `_workingCopy`, only `hexStates` — so a user who clicks Preview and then Close, with zero further edits, still gets the "unsaved changes" warning, because `_previewOriginalState` is set even though `_isDirty()` alone would be `false`. This is real and reachable: the "Create New" flow auto-previews once immediately on open (see `_openWithWorkingCopy`) to render a starter system, so closing a freshly-created system without touching anything still triggers this dialog.

---

### Phase 4 — Implementation Sequence

**Steps 1–4 complete** — HTML structure (`hex_map.html`), context menu entry points (`js/canvas_input.js`, `js/system_viewer.js`), `system_editor.js` scaffold, and structural operations + drag-and-drop are all implemented. **Reconfirmed 2026-07-03**: `system_editor.js` is a substantial 2500+ line implementation, not a stub; context menu wiring, HTML dialog markup, and structural-op/DnD handlers were all directly verified present and functional (see corrected Algorithms 1-4, 8 above for the accurate behavioral detail).

---

#### Step 5 — Generator Override Gates (one engine at a time)
**Files:** `js/mgt2e_bottomup_generator.js`, `js/ct_bottomup_generator.js`, `js/aow_bottomup_generator.js`, `js/t5_topdown_generator.js`, `js/rtt_engine.js`

Pattern applied identically across generators (CORRECTED 2026-07-03 — see Algorithm 6 for the accurate body-vs-star distinction; star fields are seeded wholesale, not field-gated):
```javascript
function generateMgT2ESystemBottomUp(hexId, seedSys = null) {
    const sys = seedSys || { hexId, worlds: [], stars: [], ... };
    if (!seedSys || seedSys._allowAddBodies) {
        StellarEngine.generateSystemInventory(sys);
        StellarEngine.allocateOrbits(sys);
    }
    if (!isManual(body, 'density')) body.density = finalDensity;  // body/world fields, at every field
    // mainworld: use seedSys._mainworldRef if set, else run normal election
}
```

Sub-steps and regression status (UPDATED 2026-07-05 — CT and T5 have both completed the full Phase B sequence; see corrected Section 5 for full evidence):
- **5a MgT2E:** ✅ Done — structural + field-level gating complete, UI-exposed.
- **5b CT:** ✅ Done (2026-07-04) — structural + field-level (size/atm/hydro/pop/gov/law/starport/tl) gating complete, satellite/moon quantity locked once generated, own `_ENGINE_ADAPTERS` entry, own UWP-auditor coverage, **UI-exposed**. Gov/law/tl/starport and satellite-quantity gating folded in as part of this same item, not a deferred follow-up — see OW-10 (Section 6).
- **5c AoW:** ✅ Done (2026-07-05, last through the Phase B sequence, closing OW-9) — structural + field-level gating complete, own `js/aow_seed_bridge.js` module for star-physics/hierarchy/disk-worksheet resolution, own `_ENGINE_ADAPTERS.AoW` entry, own `js/aow_uwp_auditor.js` (built from scratch), **UI-exposed**. **Verified end-to-end in-browser via Playwright (2026-07-05)** — found and fixed one real bug in the process (see below).
- **5d T5:** ✅ Done (2026-07-05) — structural + field-level (worldType/size/atm/hydro/pop) gating complete, Algorithm 7 mainworld election implemented, own `_ENGINE_ADAPTERS` entry, own UWP-auditor coverage, **UI-exposed**. Gov/law/tl/starport gating deliberately deferred (not a blocker, same as CT was — CT's has since been closed, see 5b above). Verified end-to-end in-browser via Playwright. **Not yet checked: satellite/moon-quantity locking (OW-10) — T5 was never audited for the append-instead-of-lock pattern CT had; verify before/when this deferred item is next picked up.**
- **5e RTT:** ✅ Done (2026-07-04) — this bullet was left stale after RTT actually went live; see the RTT subsection in Section 5 for the accurate, current writeup (structural + full field-level gating, own adapter, own auditor coverage, UI-exposed, verified in-browser).

**Before AoW/RTT is UI-exposed:** finish its remaining gating work above, give it its own `_ENGINE_ADAPTERS` entry (OW-8 pattern), AND give it its own UWP-auditor coverage (OW-3 pattern, per-engine — MgT2E's/CT's/T5's coverage does not extend to other engines). CT's and T5's Phase B work (Section 5, "CT is now fully online" / "T5 is now fully online") are the worked reference implementations for this whole sequence.

---

#### Step 6 — Fill & Save Orchestration — DONE for MgT2E and CT (UPDATED 2026-07-04)
**Files:** `js/system_editor.js`

Fill & Save button exists and works for MgT2E and CT. Actual current sequence (see corrected Algorithm 5): `_buildSeedSys()` → call generator (via `_ENGINE_ADAPTERS` for MgT2E/CT) → `_generateAndCommit()`'s shared commit block (`hexStates.set`/redraw) → **OW-3 audit gate** (`result.newSys.auditResult`; warn-and-proceed dialog if `pass === false`) → close editor → `SystemViewer.open(hexId)`. The "validate → mainworld dialog" steps this used to describe are retracted (OW-1/OW-2, closed as unnecessary). The UWP auditor step is implemented and live for MgT2E and CT; still a no-op for AoW/T5/RTT until each gets its own `sys.auditResult` attachment (see OW-3 in Section 6).

`_buildSeedSys()`: deep-clone working copy stars and bodies (preserving `_manualFields`) into seedSys object with `_allowAddBodies` and `_mainworldRef` — confirmed real and matches the corrected Seed Object Schema in Phase 2.

- **Verified working today (MgT2E, in-browser by Sean):** audit errors → warn dialog with go-back option; Create system, fill → appears on map with correct data; user-set fields survive Fill; allowAddBodies checkbox respected; edit existing system, change structure, fill → changes in result
- **CT (2026-07-04):** same code paths, but only `node --check`-verified so far — **not yet exercised in-browser**, since CT's UI exposure (Phase B item 5) just landed this session. First real end-to-end test is up to Sean.
- **Regression:** All existing macros still generate correctly (seedSys=null path untouched)

---

#### Step 7 — Commit Path — 🟡 PARTIALLY DONE, ACCEPTED FINAL STATE (UPDATED 2026-07-04, see OW-5 in Section 6)
**Files:** `js/system_editor.js`, `js/macro_orchestrator.js`

`commitEditorSystem(hexId, sys, engine)` in `macro_orchestrator.js` (shared by macros AND the editor) does **not** exist and is **not planned** — Sean explicitly scoped this down (2026-07-04) to "system_editor.js only." What was built instead: `system_editor.js`'s own internal duplication between `_fillAndSave()`/`_preview()` is extracted into a shared `_generateAndCommit(errorLabel)` — see OW-5 Layer 1 in Section 6 for the full method list (build seedSys → run generator → restore-display-manual-fields → mainworld-name preservation → `computeSystemCounts` → `hexStates.set` → redraw). The `macro_orchestrator.js` commit-block layer (Layer 2) remains a separate, un-consolidated path — revisit only if a future engine's macro and editor commit paths need to agree, per OW-5's note.

- **Verified (MgT2E, in-browser by Sean):** Committed system on hex map; System Viewer renders it; Hex Editor shows correct fields; macro re-run on same hex overwrites correctly; map-level Ctrl+Z reverts to pre-edit state
- **CT (2026-07-04):** same `_generateAndCommit()` code path (CT's `_ENGINE_ADAPTERS.CT.run()` writes `stateObj.ctSystem`/`ctData` the same way MgT2E's adapter does) — not yet exercised in-browser, see Step 6 above
- **Final regression:** Every macro type generates correctly; open/cancel preserves original; open/edit/fill/save produces correct result

---

### Phase 5 — Implementation Notes & Design Decisions (2026-06-22)

Steps 1–4 of the Phase 4 sequence are fully implemented. **UPDATED 2026-07-04:** Steps 5–6 are done for MgT2E and CT (still open for AoW/T5/RTT); Step 7 is intentionally left partial as an accepted final state (see OW-5, Section 6) rather than "not yet implemented." See Section 6 for current per-item status. The following design decisions were made during or after implementation and are not reflected in Phases 2–4.

#### Preview Button & Auto-Preview (updated 2026-06-24)

Most user actions in the editor **auto-preview** immediately — they call `_renderAndPreview()` which runs `_renderEditorTree()` then `_preview()`. Auto-preview fires on: drag-and-drop, add/delete body or star, set/clear mainworld, star type/subtype/class change, orbit# change (typed), and setting a derived field value.

**Exception — clearing a derived field does NOT auto-preview.** The `_derivedRow` clear button (`×`) and blanking a derived field input only call `onSet(null)` — no preview. This lets users clear multiple fields in sequence (e.g. blank mass, lum, temp after changing star type) and batch the re-derivation by clicking **Preview** manually.

The **Preview button** (`[Cancel] [Preview] [Fill & Save]`) is therefore the explicit trigger after clearing operations. It calls `_preview()` directly.

`_preview()` runs `_buildSeedSys()` → generator → commit to `hexStates` → `SystemViewer.refresh()`. On first call it snapshots `_previewOriginalState`; Cancel after a Preview restores that snapshot. Fill & Save commits permanently and closes the editor.

---

#### Visual Hierarchy: Indented Connector Lines

The body tree uses left-border connector lines to show ownership at a glance:
- **Primary section** (`borderLeft: 2px solid`): bodies and companions under the primary
- **Companion sub-section** (`borderLeft: 1px solid`, indented): bodies orbiting that companion
- **Moon sub-section** (`borderLeft: 1px solid`, inside a body's `<details>` panel): moons of a world

---

#### Interleaved Companion Stars (2026-06-22)

The original implementation rendered all stars first — primary then companions as separate sections — with each star's bodies listed beneath it. This obscured the orbital physics: a companion occupies an orbit slot in the primary sequence. Bodies at orbits *inside* the companion are circumbinary; bodies *outside* orbit only the companion's star.

**New approach:** `_renderEditorTree()` builds a single merged list for the primary:

```
mergedItems = [
  ...primaryBodies.map(b => ({ kind:'body',      item:b, sortKey: _sortAU(b) })),
  ...companions.map(s    => ({ kind:'companion',  item:s, sortKey: _sortAU(s) }))
].sort((a,b) => a.sortKey - b.sortKey)

_sortAU(obj) = _orbitIdToAU(obj.orbitId) ?? obj.au ?? obj.orbitAU ?? Infinity
```

`orbitId` is the primary sort key so the list reflects the current orbit even after a DnD move (before `au` is recalculated by the generator). AU is the universal sort key across all three surfaces (system editor, system viewer, hex editor accordion) and all engines.

Each companion renders as a draggable header row inside the primary's `bodyContainer`, followed by an indented sub-container for its own bodies:

```
★ Primary: G2V  [+World][+GG][+Belt][+Comp]
│  ≡ World "Agidda" ·2
│  ⊙ Companion: M0V ·3  [+World][+GG][+Belt][Del★]
│  │  ≡ World "Arken" ·1
│  ≡ Gas Giant ·5
```

**Data model — `orbitId` on companion stars in `_workingCopy.stars`:**
- MgT2E companions: read from `s.orbitId` (float, e.g. `3.5`) — was previously dropped entirely
- CT companions: read from `s.orbit` if numeric; string values ("Close"/"Near"/"Far") → `null` → sort key 9999 (appear at end)
- New companions via `_addStar()`: assigned `orbitId = maxOccupiedOrbit + 1`
- Forwarded to generator in `_buildSeedSys()` engStars map as `orbitId: s.orbitId != null ? s.orbitId : undefined`

**Drag-and-drop for companions:**
- All three drop combinations (body→body, companion→body, companion→companion) use INSERT via `_insertAtOrbit(draggedObj, targetOrbitId)` — shifts the pool of bodies + non-primary stars by ±1 in the affected range; marks all shifted items' `orbitId` as manual; auto-previews after drop
- Body drag within a companion's sub-container → same logic as primary bodies
- `_swapBodies` / `_swapStars` removed; all moves go through `_insertAtOrbit`

---

#### Moon/Satellite Ordering (2026-07-07)

The "AU is the universal sort key across all three surfaces" rule stated above for the primary's merged bodies/companions list **also applies one level down: a body's moon/satellite list must be ordered by distance from its parent (`pd` for CT/T5), consistently across the System Editor, System Viewer (orrery), and hex editor accordion.** This was never written down explicitly before this pass, and the code confirmed it wasn't reliably true in practice — found while chasing a report of moons visibly speeding up/slowing down in the orrery between saves. Three separate bugs, all rooted in this rule being implicit rather than enforced:

1. **`system_editor.js`'s CT `write()` adapter dropped moon data on every Preview/Fill & Save.** Satellites were rebuilt with only `_id`/`type`/`name`/`uwp` — `pd`, `size`, `diamKm`, `mass`, `gravity`, `distAU`, `zone`, `orbitType`, etc. were silently discarded. Invisible because CT only re-rolls a parent's satellite count/positions when the parent lacks a `.uwp` (a moon-count-growth fix from the same week) — every terrestrial/mainworld parent already has one after its first generation, so the gutted satellites were carried straight through untouched rather than re-rolled. `system_viewer.js`'s `_moonPeriodYears` falls back to a default `pd` of 20 when missing, which is what made orbits visibly change speed after a no-op Preview. **Fixed:** new `_ctMoonLockFor()` helper (mirrors the existing `_ctUwpLockFor` pattern) carries a satellite's full physical/orbital field set forward from `_raw`, unconditionally — not gated on the moon having its own UWP, since the reroll-or-not decision is made per-parent, not per-moon. Also closed the same gap for captured-planet satellites, which had no `satellites` field in `write()` at all.
2. **`system_editor.js`'s post-Preview backfill only re-sorted the working copy's moon list for MgT2E.** The existing MgT2E code says outright: "re-sort each body's moon list to match the engine's final (orbital-distance-sorted) order — otherwise the editor's own list silently drifts out of sync with the order shown in the accordion after Save." CT (whose generator, `ct_bottomup_generator.js`, sorts `parent.satellites` by `pd` at the end of every generation pass, and whose `applyCTOrbitalNames` in `core.js` assigns closest-first alphabetical moon names based on that order) had no equivalent — the open editor's tree could show one order while the engine's freshly-regenerated/renamed system used another. **Fixed:** added a CT branch to the same backfill block, reading `newSys.orbits[].contents`/`newSys.capturedPlanets[]` (CT's shape) and `.satellites` (not `.moons`), matching MgT2E's pattern.
3. **`hex_editor.js`'s CT accordion render/write-back mismatch — the most serious of the three.** The render (`sortedSats = [...w.satellites].sort((a,b) => (a.pd||0)-(b.pd||0))`) builds each moon's input fields with `data-ct-satidx` set to its position in the **sorted** copy — but the write-back handler resolved edits via `body.satellites[satIdx]`, indexing the **raw, potentially-unsorted** array. Whenever the two orders diverged (e.g. an older save from before CT's generator started sorting satellites by `pd`), editing what looked like "moon B" in the UI could silently mutate a different physical moon's data. **Fixed:** the write-back handler now re-derives the same pd-sorted view before indexing, so it always resolves to the moon the user actually clicked.

**Note (2026-07-07, superseded 2026-07-16 by OW-47 — see Section 6):** at the time this pass was written, T5's accordion satellite render and write-back were assumed to have the same kind of gap as CT (no `pd`-sort applied), just not yet fixed. OW-47 later established via Sean's Requirements Agent that this assumption was wrong: **T5 has no per-moon orbital-distance (`pd`) concept at all** — T5 RAW defines only a broad location band plus an ordinal sequence, not a physical distance formula. So "sort by `pd`" was never the correct target for T5; ordinal array position is the correct and intended model. T5's accordion (`Satellite ${satIdx+1}` labels, no distance field) and orrery (radial spacing by array index) were already consistent with this. The one real gap OW-47 fixed was in the System Editor: the `pd`-based "Orbit (⌀)" input was shown for T5 moons despite doing nothing, and there was no way to manually reorder a T5 moon — fixed by gating that input off for T5 and adding drag-to-reorder (`_reorderMoon`).

---

#### Additional Implementation Decisions (2026-06-24)

**AU display in detail pads**
Each body's orbit row shows a read-only AU distance derived from `orbitId` via `_orbitIdToAU()`: `→ X.XX AU`. Displayed in dim text alongside the editable Orbit # field. Stars (companions) show the same. AU fields in the MgT2E hex editor accordion are **read-only** (shown as `<strong>` text, not editable inputs) since orbit is now managed in the system editor. **Caveat confirmed 2026-07-03:** true for MgT2E (body and companion rows) and for AoW's companion row, but AoW's *body* row AU is plain text in the `<summary>` line, not `<strong>`-wrapped like the others — still non-editable in substance, just a minor markup inconsistency worth knowing about if AoW's accordion gets touched.

**Orbit # — decimal support & reorder guard**
Orbit number inputs use `step="0.001"` and `parseFloat` (not `parseInt`). Typing an orbit# that would cross a neighbor in the sorted list is blocked by `_wouldReorder(item, isStar, newOrbitId)`: shows a popup "Use Drag & Drop — reorder orbital bodies by dragging and dropping." and reverts the field. Orbit# changes that stay within the current slot range auto-preview normally.

**`_buildSeedSys` AU derivation fix**
When a body's `orbitId` is set (by user or DnD), `_buildSeedSys` derives AU from `orbitId` rather than the stale stored `b.au`:
```javascript
au: b.orbitId != null ? (_orbitIdToAU(b.orbitId) ?? b.au ?? 1.0) : (b.au ?? 1.0)
```
Previously the orrery did not update after orbit changes because the stale `b.au` was fed to the generator.

**Gas Giant mainworld block**
The `☆MW` / `★MW` button is suppressed for bodies with `type === 'Gas Giant'`. Only the moons of a gas giant can be designated mainworld.

**Lunar mainworld type corruption — root cause and two-layer fix**

Root cause: `generateAtmospherics` in `mgt2e_world_engine.js` processes each Gas Giant's moons by creating a `fauxMoon` copy, forcing `fauxMoon.type = 'Satellite'` (so `processWorld` handles it generically), then rebuilding `syncRes = Object.assign({}, fauxMoon)` with `syncRes.type = 'Satellite'` hardcoded and replacing `w.moons[j] = syncRes`. This stamps every GG moon — including a designated lunar mainworld — as `type:'Satellite'` in the live system tree.

Two surfaces were broken by this:
- **Orrery** (`js/system_viewer.js`): reads `sys.worlds[n].moons` — was patched 2026-06-24 by making `_normalizeMgT2E` restore `type:'Mainworld'` on any moon whose `_id` matches `sys.mainworld._id` (defense-in-depth; this is still in place):
```javascript
const moons = (w.moons || []).map(m => {
    const moonIsMainworld = (mwId && m._id === mwId) || m.type === 'Mainworld';
    return moonIsMainworld ? Object.assign({}, m, { type: 'Mainworld' }) : m;
});
```
- **Hex editor accordion** (`js/hex_editor.js`): uses raw `m.type` directly with no normalization — was not fixed by the orrery patch and remained broken until the root-cause fix below.

Root-cause fix (2026-06-25, `js/mgt2e_world_engine.js`): restore the original type instead of hardcoding `'Satellite'`:
```javascript
syncRes.type = m.type; // was: syncRes.type = 'Satellite'
```
Both the orrery and accordion now correctly highlight a lunar mainworld. The `_normalizeMgT2E` patch in `system_viewer.js` is retained as defense-in-depth.

---

## 3. System Viewer Rules

**Canonical rule set (2026-07-09) — applies everywhere a system's body list is displayed:** the System Editor's Edit System panel, the hex editor's System Details accordion, the System Viewer orrery, and any future surface — across all five engines (MgT2E, CT, T5, RTT, AoW). The detailed per-feature implementation notes below (Interleaved Companion Stars, Moon/Satellite Ordering) predate this canonical statement and remain the authoritative *how*; this section is the authoritative *what*, written down explicitly after a companion-star ordering bug (OW-17) showed the rule had never been stated as a single cross-cutting requirement.

1. **Distance ordering.** Within any single list of siblings, bodies are ordered by orbital distance from whatever they directly orbit — not from the root primary. At the primary level that's distance from the primary; inside a companion star's own body list, it's distance from that companion; inside a body's moon list, it's distance from that body. This is a per-level rule, matching Rule 2's nesting model, not one flat sort by distance-from-root-primary. Implemented via `_sortAU()` for the System Editor's merged primary/companion lists, the equivalent pd-based sort for moon lists (see "Moon/Satellite Ordering" below), and the accordion's own merge/sort in `hex_editor.js`.

2. **Indentation reflects orbital nesting.** One indent = orbits the primary directly. A second indent = orbits the body immediately above it at one indent less — never the primary directly. Indentation depth is recursive and must always match the true parent chain, however deep (companion → that companion's own companion → their bodies → those bodies' moons).

3. **The orrery must always match the list.** Whatever order and nesting the Edit System panel and accordion show, the orrery's rendered positions must agree with it — a body listed second (by distance) must never render closer-in than the body listed first. This has been the most fragile of the three rules in practice: OW-13, OW-15, and OW-17 are all live instances of one rendering surface understanding a body's position data while another silently didn't, producing the same body in a different relative position depending which surface you looked at. When touching any orbit-position code, check the surface you're changing against the *other two*, not just against itself.

**Follow-up (2026-07-09, OW-18, same day as OW-17):** a gap audit of the CT Edit System against CT rules and this section found the `+Secondary` residual gap noted here was worse than first scoped — the Role dropdown still offered `Companion`/`Near` for CT stars, letting a user reopen OW-17's exact bug by adding via `+Secondary` (defaults to `Far`) and switching Role to `Companion`. Both closed same day: the Role dropdown is now restricted to `Close`/`Far` for CT (`CT_COMPANION_ORBIT_TABLE`'s only two non-numeric categories), and `hex_editor.js`'s `_ctCompAU()` now carries the same `orbitId`/`orbitAU` fallback OW-15 already gave the orrery's `_normalizeCT`, so the accordion no longer falls through to a hardcoded `10 AU` for an editor-placed companion regardless of role. See OW-18 for full detail, including why literal orbit-slot collision validation was considered and rejected as unnecessary once Role is restricted to Close/Far.

**Still open, pending Requirements Agent input:** whether CT bottom-up generation should actually roll a planetary system for `Far` companions (`star.nestedSystem` — currently always empty; see OW-18). Until answered, `+Secondary`'s `Far` option is safe (there's no nested content yet to be inconsistent about), but the System Editor/accordion/orrery would all need extending if the answer is "yes."

---

## 4. Known Issues / To Do

**Open items in this document (all in 6.2):**

- **OW-3** — per-engine UWP auditor coverage at Fill & Save. Done for MgT2E/CT/T5; each
  new engine needs its own populated `sys.auditResult` before Fill & Save is trustworthy.
- **OW-5 layer 2** — `commitEditorSystem()` shared by the macros *and* the editor was
  never built. The editor's `_clearSystemData()` and `macro_orchestrator.js`'s inline
  clear-block are still drifting. Revisit before a new engine's macro and editor commit
  paths need to agree.
- **OW-65** — three route/filter items deliberately parked pending user evidence. Not
  editor work; do not restart without new information.

Everything else is closed — see the 6.3 index.

**No recent work has been in this document's subject matter.** v0.17.0/0.17.0.1 were the
exports series (`directives/html_extract_manifest.md`, complete 2026-08-04) and
v0.17.2–v0.17.5 were the routes series (§0.0, complete 2026-09-11), so **nothing anywhere is
currently in progress** and v0.18.0 is open with nothing chosen. The three items above are
the System Editor's own residue; picking any of them up means resuming the paused RTT/AoW
work, for which section 0.3 is the entry point. §0.0.0 lists them alongside the other
candidates.

---

## 5. Deferred Engine Stub Inventory (v0.16.1 Handoff)

> ### ⚠️ READ FIRST — 2026-07-11: Edit System scope pulled back to MgT2E/CT; T5/RTT/AoW slated for a full overhaul
> ### ⚠️ UPDATED 2026-07-16 — do not read the per-engine "fully online"/"fully editor-ready" language below as "currently works." See the correction at the very bottom of this banner before touching T5/RTT/AoW.
> ### ✅ SUPERSEDED (T5 only) 2026-07-16, later same day — T5 Create AND Edit are back on. Once the punch-list items above closed out (OW-19/42–49), Sean re-enabled T5 in production: `hex_map.html`'s `#se-engine-dialog` T5 radio no longer carries `disabled`, and both `canvas_input.js`'s `_seCanEdit` gate and `system_viewer.js`'s Edit-button gate now check `MgT2E || CT || T5`. Every "cannot reach T5 ... today" sentence below and in the T5 subsection describes a state that only held for part of 2026-07-16 — **T5 is a normal, user-reachable engine again, on the same footing as MgT2E/CT.** RTT and AoW remain fully off (Create disabled, Edit disabled) and are unaffected by this — the overhaul is still pending for those two only.
>
> Everything below this banner (the Phase A/B sequencing, each per-engine "is now fully online" note, the per-engine table, and every "UI-exposed"/"✅ Done" claim) describes the state **as it stood on 2026-07-05**, when all five engines were live and editable in the System Editor. **That is no longer the current state — see the ✅ SUPERSEDED note above for T5's own correction.** Per Sean's 2026-07-11 direction: T5, RTT, and AoW's System Editor support was only at a preliminary stage and was getting a full overhaul, not another round of incremental gap-fixes — so **Edit System access for those three engines was switched back off** (`system_viewer.js`'s Edit button and `canvas_input.js`'s `_seCanEdit` gate both checked only `MgT2E`/`CT`). ~~**Create System is unaffected** — all five engine radios in `hex_map.html`'s `#se-engine-dialog` remain enabled~~ — **CORRECTED 2026-07-16: this was not true for a portion of that day, and may never have been re-verified after being written.** Direct inspection of `hex_map.html`'s `#se-engine-dialog` at that point in the day showed the T5, AoW, and RTT radio inputs all carrying `disabled` and a "(coming soon)" label, identical to the Edit-side restriction. **As of later the same day, per the ✅ SUPERSEDED note above, this is true for RTT/AoW only — T5's radio is enabled again.**
>
> **Also as of 2026-07-11: each engine's adapter now lives in its own file, not inline in `system_editor.js`.** See OW-8's "REVERSED 2026-07-11" note (Section 6) for the full writeup. When resuming T5/RTT/AoW work, the file to open is `js/t5_editor_adapter.js`, `js/rtt_editor_adapter.js`, or `js/aow_editor_adapter.js` — **not** `system_editor.js`'s `_ENGINE_ADAPTERS` object, which is now just a one-line pointer (`T5: window.SystemEditorAdapters.T5`, etc.) into that file. Every per-engine subsection below that cites `_ENGINE_ADAPTERS.<Engine>` as living "in `system_editor.js`" is describing where the logic used to be, not where it is now.
>
> **T5/RTT/AoW Overhaul Punch List** — every known, not-yet-verified-for-these-three-engines gap scattered across Section 6's OW items, pulled into one place so the overhaul doesn't have to start by re-reading the whole bug tracker:
> 1. **Satellite/moon-quantity locking (OW-10 Gap 1).** T5 audited and fixed 2026-07-16 — see **OW-43**: same `hasSeedWorlds`-vs-`isEditorSeeded` bug as OW-42, at the `fleshOutSubordinates`/`capToExisting` call site. RTT/AoW still unaudited.
> 2. **Gov/law/tl/starport gating (OW-10 Gap 2).** T5 subordinate-body case fixed 2026-07-16 — see **OW-45** (two-layer fix: `_t5UwpLockFor` plus a separate `createBodyPlaceholder` gap that dropped the values even once marked locked). The mainworld's own separate, bigger problem (never actually generated at all via the editor) is also now closed — see item 11/OW-44. RTT/AoW still unaudited against the *append-not-lock* failure mode.
> 3. **Blank-creation body-count gate (OW-11 Gap 1).** T5 verified clean 2026-07-16 — a genuinely blank Create correctly produces no system at all (structural guarantee via Algorithm 7 step 6 + `T5.run()`'s existing `mainworldUWP` guard), not a stochastic-roll fallback. **T5's separate mainworld-only case (one body: the mainworld itself) was a real gap — see item 10/OW-42, now closed.** The blank-create case's own UX rough edge (auto-preview failing immediately, making the editor look closed) was also confirmed and fixed the same day — see **OW-48**. RTT/AoW still unverified for this item.
> 4. **Moon-cap capture/trim on a body's first roll (OW-11 Gap 2).** T5 verified 2026-07-16 — `generateT5Satellites`'s `capToExisting` mechanism (`moonCount = capToExisting ? startIdx : <roll>`) *is* T5's equivalent of MgT2E's capture/trim, and with OW-43's gating fix in place it correctly caps a brand-new body (zero pre-existing moons) to zero on its first roll too — confirmed via Playwright: added a fresh Gas Giant to an existing system, `_allowAddBodies` unchecked, came back with 0 moons, not a dice-rolled count. No separate fix needed beyond OW-43. RTT/AoW still unverified.
> 5. **Lunar-mainworld moon flag (OW-12).** RTT's `readBodies` has the same unguarded `.map(_buildMoon)` pattern CT/MgT2E had before their fix, plus a weaker top-level check with no `type === 'Mainworld'` fallback. AoW's `readBodies` has the identical bare `.map(_buildMoon)` gap. Neither confirmed as a *live* bug yet — reproduce by generating a system whose mainworld is a moon, opening Edit System, and checking for the ★ highlight plus a stable mainworld count across a no-edit Preview/Fill & Save.
> 6. **Gas-Giant-equivalent "already generated" lock signal (OW-14).** T5 verified clean 2026-07-16 — T5 never used `.uwp` presence as its lock signal in the first place (unlike CT), so it doesn't share CT's specific blind spot. Satellite-count locking is the uniform `capToExisting` flag (OW-43); physical-stat locking (`calculateT5PhysicalStats`) uses ordinary `isManual()` checks on `diamKm`/`gravity`/`mass` regardless of body type, and `createBodyPlaceholder`'s seed-override already takes precedence over a freshly-rolled `size` for a GG. Verified via Playwright: a Gas Giant's `type`/`size`/`diamKm`/`gravity`/`mass` all identical across 3 consecutive no-edit saves. No fix needed. RTT/AoW still unverified.
> 7. **Companion-star drag position not reaching the orrery (OW-15).** **T5 checked and fixed 2026-07-16 — see OW-46**, a distinct and more severe mechanism than RTT's: a star-seed field-name mismatch (`orbitId` from the shared engine-agnostic seed-builder vs. `orbitID` T5's own generator code expects for stars) corrupted a companion's `distAU` to `NaN` *inside the generator itself*, not just in a display-layer normalizer. RTT's own version of this gap (no `orbitId`/`orbitAU` fallback in its normalizer) is still unfixed. AoW not checked at all.
> 8. **T5 moon ordering (Moon/Satellite Ordering section, Phase 5).** **Investigated 2026-07-16 — bigger than originally scoped, see item 12/OW-47.** T5 doesn't just fail to *sort* satellites by `pd` — it has no per-moon `pd`/orbital-distance concept anywhere in the codebase. No cross-surface mismatch (orrery/editor/accordion all consistently use array order), but every T5 moon shares an identical synthetic orbital period in the orrery. Deliberately deferred pending a rules decision on how T5 should model moon distance, not patched with a guessed formula.
> 9. **OW-19 — RESOLVED 2026-07-16.** Originally filed as "T5 Gas Giant not persisting to `t5System.worlds`"; re-investigated and found to be a false-alarm framing (`.worlds` is never populated for T5 by design) masking a much bigger real bug — every T5 Preview/Fill & Save on a freshly-created system was throwing an uncaught exception and failing to commit anything at all, a regression introduced 2026-07-13 (two days *after* this item was first filed). Root-caused and fixed — see OW-19's full writeup (Section 6) for the mechanism.
> 10. **OW-42 — CLOSED 2026-07-16, same day as found.** A T5 system with only a mainworld was ignoring "Allow engine to add additional bodies" and rolling a full random inventory anyway, because the mainworld is deliberately excluded from `seed.worlds` by `T5.write()`, making a mainworld-only system look seed-empty to the generator's zero-lock gate. Fixed by gating on "was this call editor-driven at all" (mirrors MgT2E's own established pattern) instead of "did the editor seed a non-mainworld body." See OW-42 (Section 6) for full detail.
> 11. **OW-44 — CLOSED 2026-07-16.** The System Editor now generates a real UWP for a brand-new T5 mainworld — `generateT5Mainworld` (`t5_world_engine.js`) gained an optional seed-aware mode (gated per-field via `isManual`, mirroring `generateT5SubordinateUWP`), and `t5_editor_adapter.js`'s `write()` calls it (plus wires up `applyUwpSeed`, fixing "Seed UWP digits do nothing" as a side effect) whenever the mainworld has no prior `.uwp`. See OW-44 (Section 6) for full detail.
> 12. **OW-47 — CLOSED 2026-07-16.** T5 has no per-moon orbital-distance concept at all (confirmed via Sean's Requirements Agent: T5 RAW uses an ordinal sequence, not a physical formula). Fixed: the System Editor's pd-based moon orbit field is now skipped for T5, replaced with manual drag-to-reorder support (`_reorderMoon`, `system_editor.js`) — moon array order already round-tripped correctly everywhere else. See OW-47 (Section 6) for full detail.
>
> This banner supersedes the "UI-exposed"/"fully online" framing everywhere below it for T5/RTT/AoW specifically. MgT2E and CT's own status is unaffected by any of this.
>
> **⚠️ CORRECTION, 2026-07-16 — this section's "fully online"/"fully editor-ready" language, even read as historical fact about 2026-07-04/05, should not be mistaken for "safe to build on top of today."** A routine pre-overhaul cleanup pass this session found T5 completely non-functional from a fresh Create (OW-19's real bug, above) via a one-line regression that had been sitting undetected since 2026-07-13, plus a second, independent gating bug (OW-42) the instant the first was fixed. Neither RTT nor AoW have been re-verified at all since 2026-07-05 — their own "is now fully online" sections below carry exactly the same risk of hiding an equally-broken current state behind stale success language. **Treat every claim below as "true on the date stated, not independently reconfirmed since," not as a current status report**, until each engine actually goes through the overhaul this banner describes.

> ## ✅ PHASE A COMPLETE (signed off 2026-07-04) — v0.16.1 SEQUENCING (decided 2026-07-03; progress updated through 2026-07-04)
>
> Work on the next version happens in two strict phases. Phase A is now fully signed off — **Phase B (new engines) may begin.**
>
> **Phase A — Clean up and architect the System Editor, MgT2E only, no new engines touched: — ✅ ALL ITEMS DONE**
> 1. **OW-5** (Section 6, hard prerequisite): extract the commit path. **🟡 PARTIALLY DONE 2026-07-04, and that's the accepted final state** — see corrected OW-5 status in Section 6. `system_editor.js`'s own internal duplication (`_preview()` vs `_fillAndSave()`) is extracted into a shared `_generateAndCommit()`. The `macro_orchestrator.js` commit-block layer was deliberately scoped out (Sean's call, 2026-07-04) and does not block Phase A sign-off — revisit only if a future engine's macro and editor commit paths need to agree.
> 2. **OW-3** (Section 6, open, prioritized): implement the UWP Auditor step in Fill & Save. **✅ DONE for MgT2E, 2026-07-04** — see corrected OW-3 status in Section 6. Still needs its own per-engine hookup (a `sys.auditResult` attachment in each generator) before AoW/CT/T5/RTT can rely on it — that per-engine coverage is Phase B work, not a Phase A blocker.
> 3. **OW-8 (✅ DONE 2026-07-04, verified in-browser by Sean)** — the per-engine adapter/config pattern for `js/system_editor.js`. `_buildWorkingCopyFromState()`, `_buildSeedSys()`, and `_runGenerator()` each had a separate near-parallel `if/else if` branch per engine; this was the last item blocking Phase A sign-off. See OW-8 in Section 6 for the full implementation writeup. The same 2026-07-04 audit that raised this also turned up two smaller items, both done: **OW-6 (✅ DONE)** — seed-restoration matching logic that lived inline in `mgt2e_bottomup_generator.js` is now `js/seed_restoration.js`; **OW-7 (✅ DONE)** — the `MgT2EMath` guard-consistency fix and the duplicated auditor-logging cleanup (now `MgT2E_UWP_Auditor.runAndLog()`), see Section 6.
>
> **Phase B — Expand to additional engines (now unblocked):**
> Bring engines online one at a time per the per-engine remaining-work lists in Section 5 below (CT needs field-level `isManual` gating; T5 needs both structural and field-level gating plus Algorithm 7; RTT needs broader field-level gating). Each engine's UI entry point (`canvas_input.js`/`system_viewer.js` gates, `hex_map.html` dialog radio buttons) should only be switched on once that engine's generator work *and* its own UWP-auditor coverage are both complete — OW-3's auditor work from Phase A does not automatically cover new engines, each needs its own. Per OW-8, bringing each engine online should also mean giving it its own adapter in `_ENGINE_ADAPTERS` (see Section 6) instead of adding another inline branch.
>
> **CT is now fully online (2026-07-04) — first engine through the full Phase B sequence:**
> 1. Field-level `isManual` gating for size/atm/hydro/pop (`ct_world_engine.js` + `system_editor.js`'s `_ctUwpLockFor`)
> 2. `capturedPlanets` write-stub gap closed (`system_editor.js`)
> 3. UWP-auditor coverage (`sys.auditResult`, `ct_uwp_auditor.js`'s new `runAndLog`, wired into `ct_system_driver.js`)
> 4. `_ENGINE_ADAPTERS.CT` entry (OW-8 pattern) — CT's old inline branches deleted from all four call sites
> 5. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` CT radio button all now include/enable CT
>
> **Companion fix found while flipping item 5:** `_restoreDisplayManualFields()` (`system_editor.js`) was `MgT2E`-only — without a CT branch, every pre-existing CT body's `atm`/`hydro`/`pop` (marked manual purely for seed-preservation by `_ctUwpLockFor`, item 1) would have displayed as "manually edited" in the accordion after every Fill & Save, even on bodies the user never touched. Added a CT branch reading `newSys.orbits[].contents` + `newSys.capturedPlanets[]` (CT's shape, vs. MgT2E's flat `.worlds[]`) and matching moons via `.satellites` (not `.moons`). `_regenerateBody()`'s per-body regenerate feature and the Hill-sphere/moon-orbital-data backfills remain MgT2E-only by design (CT doesn't model moon pd/pos/eccentricity, and `_regenerateBody` already warn-and-refuses gracefully on non-MgT2E systems) — not gaps, not touched.
>
> **Correction, 2026-07-14 (OW-34):** this same shared flattening logic (by the time of the fix, extracted into `ct_editor_adapter.js`'s `_ctFlattenBodies()`) never recursed into a Far companion's `nestedSystem` — so a companion star's own worlds were invisible to this matching logic, their `_raw` never got backfilled, `_ctUwpLockFor`'s lock never engaged, and a companion-star world's entire UWP re-rolled from scratch on every single Preview/Fill & Save. Fixed 2026-07-14; see OW-34 in Section 6.
>
> **T5 is now fully online (2026-07-05) — second engine through the full Phase B sequence:**
> 1. Structural `seedSys` gating in `js/t5_topdown_generator.js`: `generateT5System(mainworldBase, seedSys)` now accepts a second parameter — seeded stars skip the homestar-string-parsing/default-star fallback; seeded bodies are placed at their own orbits in a dedicated pass that runs *before* Phase 1 (the mainworld anchor placement), not after Phases 3-5 like a naive port of CT's pattern would suggest — this ordering is required so a moon-mainworld's parent body is already sitting in `orbits[].contents` by the time Phase 1 looks for it via the new `mainworldBase.parentBodyId`/`parentStarIdx` fields (avoids re-synthesizing a fresh GG/BigWorld parent on every save). `ggCountTotal`/`beltCountTotal`/`otherTerrTotal` dice rolls and moon-count rolls (`generateT5Satellites`'s new `capToExisting` param) are all gated to 0/capped when seeded and `_allowAddBodies` is false.
> 2. Field-level manual preservation via a new `_t5UwpLockFor` helper (`system_editor.js`, mirrors `_ctUwpLockFor`'s exact scope: worldType/size seeded unmarked, atm/hydro/pop locked via `_manualFields` since T5's Inferno/Belt/small-size branches force-overwrite those regardless of presence). T5's world engine already had full `_isManual` gating for worldType/size/atm/hydro/pop/starport/gov/law/tl/tradeCodes going in — gov/law/tl/starport left deliberately unlocked this pass, matching CT's own deferred scope, but extending later is low-risk since the engine-side guards already exist.
> 3. **Algorithm 7 implemented** (`_t5ElectMainworldIfNeeded`, `system_editor.js`) — adapted from the manifest's original spec to run over **working-copy** bodies rather than post-generation candidates, since T5 needs its mainworld anchor *before* generation starts (unlike CT/MgT2E's post-roll election). Excludes only top-level Gas Giants from candidacy (moons of anything remain eligible), uses the global seeded `rng` for tie-breaks, and deliberately does not mark the auto-elected body `_manualFields: ['isMainworld']` (contrast the explicit `_setMainworld()` toggle) so it doesn't paint as user-edited in the accordion.
> 4. UWP-auditor coverage: `t5_uwp_auditor.js`'s `runT5SystemAudit` now returns `{ pass, errors }` (previously returned nothing — a real, if dormant, pre-existing gap) plus a new `runAndLog(sys, hexId)` mirroring CT's/MgT2E's, wired into `system_driver.js`'s T5 finalization block. The dead `T5_Auditor.auditT5System` reference inside `t5_topdown_generator.js` (referred to a method that never existed anywhere in the codebase, always a silent no-op) was removed in favor of the single real call site in `system_driver.js`.
> 5. `_ENGINE_ADAPTERS.T5` entry (OW-8 pattern) — T5's old inline branches deleted from all four call sites (`_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, `_runGenerator`); new `_restoreDisplayManualFields` T5 branch added (T5's generated shape: `newSys.stars[].orbits[].contents`, moons keyed `.satellites` like CT, not `.moons` like MgT2E).
> 6. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` T5 radio button all now include/enable T5.
>
> **Real bug found and fixed during in-browser verification (2026-07-05):** `T5.readBodies()`'s per-star fallback (`raw.stars[].orbits[].contents`, used whenever the generated system has no flat `raw.worlds[]`) built each working-copy body via `Object.assign({}, slot.contents, {...})` without first checking `slot.contents` was non-null. For an **empty** orbit slot (`contents: null`, ~18 of 20 orbits in a typical 2-body system), `Object.assign({}, null, {...})` still produces a plain object with no `type` field, and the old filter (`w.type !== 'Empty'`) let it through since `undefined !== 'Empty'` is true — every empty orbit silently became a phantom body on re-edit. This is a genuinely pre-existing gap (the exact same unguarded pattern was already in the original inline branch before this pass), just never reachable before because Fill & Save didn't actually work for T5 until this session. Fixed by filtering out null-content slots before the `Object.assign`. Found via an end-to-end Playwright browser test (create → add bodies → Preview → Fill & Save → re-edit → move a body → Fill & Save again), not by static reading — re-editing a freshly-saved T5 system was the reproduction case.
>
> **Verified in-browser (Playwright, 2026-07-05):** Create New (T5) with a Terrestrial World + Gas Giant and no mainworld flagged → Algorithm 7 correctly elected the World (never the GG) → Preview succeeded → Fill & Save committed exactly the 2 seeded bodies with no extra rolled bodies (`_allowAddBodies` unchecked) → System Viewer rendered the system correctly (habitable-zone ring, mainworld highlighted) → re-opened Edit System → moved the Gas Giant to a new orbit via a realistic click+type+Tab interaction → Fill & Save again → new orbit position persisted correctly, mainworld undisturbed. Zero console/page errors throughout.
>
> **RTT is now fully online (2026-07-04) — third engine through the full Phase B sequence:**
> 1. Field-level manual preservation extended in `js/rtt_engine.js`. The file already had more save/restore coverage than this manifest previously documented (`processRTTPhysicalStatsPartA`/`PartB` already gated `size`/`atmosphere`/`hydrosphere`/`chemistry`/`biosphere`; `calculateRTTDesirability`/`checkRTTTerraforming`/`determineRTTHabitation` already gated their own fields) — the real gaps were `worldClass` (no guard at all in `classifyRTTBody`, now fixed with an `isManual(body,'worldClass')` early-return, plus a matching guard on Step3's "boiled-away" star-expansion override) and `processRTTSocialStats`'s social fields: `population`/`government`/`lawLevel`/`starport`/`tl` are now added to the existing `_rttSaveManual`/`_rttRestoreManual` field list, **and** given their own inline `isManual` guards inside the Uninhabited early-`return` branch specifically — that branch returns before the outer restore call ever runs, so a field added only to the outer save/restore list would have silently lost its manual value on every Uninhabited body. `applyRTTOrbitalNames` (`js/core.js`) now checks `isManual(b, 'name')` instead of an implicit `!b.name` truthy check.
> 2. UWP synthesis gap closed: RTT bodies never carried their own `.uwp` field (only the flat mainworld summary did). Extracted the UWP-string formula out of `extractRTTMainworld` into a new reusable `computeRTTBodyUWP(body)` (`js/rtt_engine.js`), used both by `extractRTTMainworld` (no behavior change) and by the System Editor's RTT `readBodies` (previously hardcoded `uwp: null` for every body).
> 3. UWP-auditor coverage: `auditRTTSystem(sys)` (already existed, already auto-called inside `extractRTTMainworld`) now returns `{ pass, errors }` instead of nothing, and the result is attached as `sys.auditResult` at its call site — no new file needed (unlike CT/T5's separate `*_uwp_auditor.js` modules), since RTT has no separate driver file to wire a second module into; all of RTT's generation logic already lives in the one `rtt_engine.js` file.
> 4. `_ENGINE_ADAPTERS.RTT` entry (OW-8 pattern) — RTT's old inline branches deleted from all four call sites. New `_rttUwpLockFor` helper mirrors `_ctUwpLockFor`/`_t5UwpLockFor` but — unlike either — must mark **every** locked field (`worldClass`/`size`/`atmosphere`/`hydrosphere`/`population`/`government`/`lawLevel`/`starport`/`tl`) manual, not just a size-is-presence-gated subset: RTT's preservation mechanism is purely `isManual()`-based everywhere, with no CT/T5-style `field === undefined` fallback guard to lean on. New `_restoreDisplayManualFields` RTT branch added (RTT's generated shape: `newSys.stars[].planetarySystem.orbits[]`, moons keyed `.satellites`).
> 5. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` RTT radio button all now include/enable RTT.
>
> **Real bug found and fixed during in-browser verification (2026-07-04):** two, actually. First, the adapter's `write()` (seed-building) was hardcoding `zone: 'Inner'` for every body regardless of its actual zone — RTT's seeded path (`generateRTTSectorStep2`) uses the seed's zone verbatim rather than recalculating it from orbit position the way CT does, so this would have silently reclassified e.g. an Outer-zone body as Inner on every Fill & Save, changing which physical-stat roll branches applied to it. Fixed by reading the real zone from `_raw.zone`. Second and more serious: `generateRTTSectorStep1`'s seeded-star branch never set `star.classification`/`star.luminosityClass` on a brand-new star (no prior `_raw` to inherit them from) — several functions (`calculateRTTDesirability`, `checkRTTTerraforming`, others) read `star.classification.includes(...)` unconditionally, throwing `TypeError: Cannot read properties of undefined (reading 'includes')` the instant any body was added to a newly-created RTT system, blocking Preview and Fill & Save entirely. Found via an end-to-end Playwright browser test (create → add bodies → Preview → Fill & Save → re-edit → move a body → Fill & Save again) — 100% reproducible, not an edge case. Fixed by backfilling both fields on the seeded star using the same string-formatting convention already used a few lines below in the non-seeded roll path (`${type}-${luminosityClass}`, or the luminosity class alone for `'D'`/`'L'`) — deliberately *not* running the dice-driven evolution roll itself, since a seeded/user-picked star must be used as-is, never rerolled (same principle as Algorithm 6).
>
> **Verified in-browser (Playwright, 2026-07-04):** Create New (RTT) with a Terrestrial World + Gas Giant and no mainworld flagged → Preview succeeded (previously crashed here) → `extractRTTMainworld`'s own scoring election ran automatically, no dialog → Fill & Save committed with a valid UWP (`E9CF200-F` in the verification run) and `auditResult.pass: true` → re-opened Edit System → same 2 bodies shown, no phantom entries, UWP preserved → moved a body to a different orbit (typed-field reorder correctly redirected to drag-and-drop via the existing `_wouldReorder` guard, then via drag-and-drop) → Fill & Save again → no errors. Zero console/page errors throughout both verification passes (the second pass confirmed 0 errors against the same script that had produced 10 identical TypeErrors before the fix).
>
> **AoW is now fully online (2026-07-05) — the last engine through the full Phase B sequence, closing OW-9.** The 2026-07-05 pre-implementation audit found AoW's gap was architectural rather than a normal gating pass (see the OW-9 summary retained below for the full evidence trail), which changed the plan from CT/T5/RTT's 5-item sequence into a larger build:
> 1. **New module `js/aow_seed_bridge.js`** (didn't exist before this pass) — a star-physics solver (bisection-searches `initialMass` from a chosen spectral type against the existing Red Dwarf/Main Sequence tables, no jitter applied per design decision, Brown Dwarf/White Dwarf collapse to a representative mass since AoW's own Step 7 displays both as fixed labels regardless of exact temperature), system-age window reconciliation across multiple stars (returns a conflict descriptor rather than silently picking an inconsistent age), a hierarchy/orbit mapper (editor's flat `stars[]`+`parentStarId` → AoW's hierarchy string + per-pair orbit records), and a disk-worksheet synthesizer that reuses `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet` (newly exposed on its public API) rather than duplicating that math.
> 2. **`js/aow_world_engine.js`** — `isManual()` guards threaded into the ~6 functions/single points that actually compute the fields the editor exposes (`stepPhysicalParameters`'s density/radius/surfaceGravity, `generateAlbedo`, `applyUWPPhysicals`'s size/atm/hydro digit classifiers). The other ~20 fields across the 13 Phase-3 functions (M-number, blackbody temp, grand-tack flags, etc.) are pure internal simulation state the editor never exposes — left fully random, no gating added, matching the same principle CT/T5 used for their own internal-only fields.
> 3. **`js/aow_bottomup_generator.js`** — Phase 1 now calls the bridge's solver/hierarchy-mapper when seeded (instead of unconditionally skipping); Phase 2 synthesizes disk worksheets from the resolved stars + seeded bodies before Phase 3 runs; Phase 3's 13 functions were already called unconditionally in the old code (the bug was never a skip-guard, it was that `sys.diskWorksheets` was simply never populated) and now have real worksheets to operate on. Also fixed, found during this wiring: `populateAoWWorldsList` was gated to skip whenever seeding controlled body count (correct in the old code where nothing would have been there to flatten, but now strands all of Phase 3's computed physics inside `diskWorksheets` if left skipped) — now runs whenever worksheets exist; a `sys.mainworld` gap where the `seedSys._mainworldRef` direct-lookup branch never set `isMainworld`/`type`/`sys.mainworld` itself (only `generateMainworldSelection` did), silently skipping all of Phase 5's Social Sweeps for any AoW system with a user-designated mainworld — never triggered before since AoW wasn't UI-exposed, but real; and the `age`/`systemAge` field-name mismatch (the seed carried `age`, every formula reads `systemAge`) is now fixed by having the bridge write directly to `sys.systemAge`.
> 4. **New file `js/aow_uwp_auditor.js`** — didn't exist at all before this pass, despite being `require()`d by `aow_bottomup_generator.js`'s own module wiring (the audit call was permanently dead code). Built mirroring `t5_uwp_auditor.js`'s `runAndLog` shape: mainworld-count structure check, belt-size integrity, satellite-vs-parent size, population cap — all wired through `sys.auditResult` the same way CT/T5 already work.
> 5. **`_ENGINE_ADAPTERS.AoW` entry** (OW-8 pattern) — AoW's old inline `else if (engine === 'AoW')` branches deleted from all four call sites (`_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, `_runGenerator`). Deliberately thin per design decision 5 — the adapter's `write()` just carries working-copy bodies through with the fields the bridge needs; the actual field-locking logic lives in `aow_seed_bridge.js`, not `system_editor.js`.
> 6. **Companion topology restricted at build time, not just Fill time** (design decision 3) — `_addStar()` now caps AoW systems at 4 stars and requires a 4th star to pair with the most recently added companion, matching the 5 hierarchy shapes `mapHierarchy()` actually supports. A flat 3+-companion arrangement is also generally astrophysically unstable, so this is a fidelity fix, not just a UI restriction.
> 7. **Age-conflict warn-and-proceed dialog** (design decision 2) — when manually-chosen spectral types across stars imply system-age windows with no overlap, `_fillAndSave()` shows a dialog (`[Proceed Anyway]` / `[Go Back & Fix]`) rather than silently picking an inconsistent age, reusing the same UI pattern as the OW-3 audit gate.
> 8. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` AoW radio button all now include/enable AoW.
>
> **Real bug found and fixed during in-browser verification (2026-07-05), same pattern as T5/RTT's own verification passes:** `stepNaturalSatellites` (Step 17, called immediately after `stepPhysicalParameters` inside `generatePhysicals` — one of the 13 Phase-3 functions already confirmed to run unconditionally) requires `planet.Rmin` for its Hill Radius calculation, but `Rmin`/`Rmax` are normally set by `generateOrbitalDynamics` (Chunk 5) — which stays deliberately skipped for seeded systems (eccentricity isn't an editor-exposed field for a body's own orbit). This dependency was missed during the original 13-function trace (which focused on `stepPhysicalParameters`'s need for `planet.mass`) because it's a same-function-call cross-dependency, not an isManual-gating question. Reproduced 100% of the time: create an AoW system, add any body via "+World"/"+GG", Preview → `TypeError: Cannot read properties of undefined (reading 'toFixed')` at `aow_world_engine.js:1398`, caught and shown as a "Preview Error" dialog (not a silent failure, but blocking). Fixed in `aow_seed_bridge.js`'s `synthesizeDiskWorksheets()` by seeding `Rmin: orbitalRadius, Rmax: orbitalRadius` on each synthesized planet (zero-eccentricity default) — matching the exact convention `aow_world_engine.js` itself already uses for its own no-eccentricity case (`generateOrbitalDynamics` line ~885-886).
>
> **Verified in-browser (Playwright, 2026-07-05):** Create New (AoW) with a G2V primary → added a K5V companion (Main Sequence, no age conflict) → added a Terrestrial World + Gas Giant under the primary → Preview succeeded (previously crashed here before the fix above) → Fill & Save committed with a valid UWP (`E9C0273-9` in the verification run) → System Viewer rendered correctly → re-opened Edit System → mainworld correctly shows as elected (★MW filled) with the same UWP, no phantom bodies, companion's spectral type preserved → dragged a body via drag-and-drop → Fill & Save again → no errors. Separately verified: (1) age-conflict path — G2V primary + White Dwarf companion → "Star Ages Conflict" dialog appeared with the exact expected per-star age windows, instead of a silent/incorrect result; (2) topology restriction — adding 2 companions directly to the primary succeeded (valid Trinary A-B,C shape), adding a 3rd companion the same way was correctly blocked with "Unsupported Star Arrangement", directing the user to the most-recently-added companion's own "+Comp" button. Zero console/page errors throughout all three passes after the Rmin/Rmax fix.
>
> **One UX gap noted, not fixed (minor, not a blocker):** after Preview auto-elects a mainworld, the editor's own tree still shows the unfilled "☆MW" icon on the winning body until the editor is closed and reopened — the underlying election is correct (confirmed via re-opening Edit System, which shows the filled "★MW" and correct UWP), but the live Preview pass doesn't refresh that specific icon in place. Cosmetic; worth a follow-up if it's ever confusing in practice.

T5 and RTT are both fully online (see their own "is now fully online" notes above/below) — the earlier text here calling them stub-only was stale by the time this note was last touched.

> **⚠️ Verify before trusting a "Known gap" claim in this section.** A manifest-vs-code review on 2026-07-03 found that CT and RTT had both progressed further than this section documented — CT's structural `seedSys` gate was already implemented despite this section claiming otherwise, and RTT's full Step1→Step2→Step3→Biographer pipeline was already threaded and auto-chaining despite this section claiming only Step1 ran. Line-number citations (`lines ~XXX–YYY`) also drift as the file is edited and should not be trusted at face value. Each "Known gap" bullet below that has been re-verified carries a **Confirmed** line with the exact command/grep used and a date — re-run it before relying on the claim. Bullets without a **Confirmed** line have not been re-checked since original authoring and should be treated as unverified.

---

### CT (Classic Traveller)

**Read stub — `_buildWorkingCopyFromState()`, CT branch (search for `engine === 'CT'` in `system_editor.js`; cited line numbers drift — do not trust `~177–206` at face value)**
- Reads bodies from `raw.orbits[]` (each slot: `{ orbit, zone, distAU, contents }`) — skips `type === 'Empty'`
- Gas Giant size: `contents.size === 'S'` → `ggType: 'GS'`, else `'GL'`
- Also reads `raw.capturedPlanets[]` as orbitless bodies (no `orbitId`, no moons)
- All bodies assigned `parentStarId` of the primary star (index 0) — CT does not use multi-star parentage in the bottom-up generator
- CT companion orbit strings ("Close"/"Near"/"Far") produce `orbitId: null` and sort to end of merged list

**Write stub — `_buildSeedSys()`, CT branch — UPDATED 2026-07-04 (Phase B, items 1 & 2, DONE)**
- Produces `seed.orbits[]`: each entry `{ orbit, zone: 'H', distAU, contents }`
- `contents` format: `{ _id, type, size, atm?, hydro?, pop?, name, uwp, travelZone, satellites[], _manualFields[] }`
- Type mapping: `'Gas Giant'` → `'Gas Giant'`; `'Belt'` → `'Planetoid Belt'`; else `'Terrestrial Planet'`
- GG size: `ggType === 'GS'` → `size: 'Small'`; else `size: 'Large'` (unchanged; unrelated to the physical-digit lock below, and left as-is — see note under Bug tracker about a pre-existing `'S'`-vs-`'Small'` mismatch between this and the read stub that was noticed but not touched)
- Zone field hardcoded to `'H'` — the generator will recalculate zones from orbit position
- **`_ctUwpLockFor(body)`** (function-scoped inside the CT branch, mirrors `_mgt2eUwpLockFor`'s role) — reads the body's previous generated values off `b._raw` (`size`/`atm`/`hydro`/`pop`) and seeds them into `contents`. `atm`/`hydro`/`pop` are also pushed into `_manualFields` so the generator won't reroll them; `size` is seeded but **not** marked manual — `generatePhysicals`'s existing `body.size === undefined` guard already skips rerolling it, same reasoning as MgT2E's own `size` field. Brand-new bodies (no `_raw`/`uwp` yet) get `{}` back and roll fresh, same as before.
- ✅ **Done (Phase B item 2, 2026-07-04): `capturedPlanets` now populated.** `wc.bodies` is split by `orbitId != null` (regular orbit-slot bodies → `seed.orbits`, unchanged) vs. `orbitId == null` (captured planets — the only way a CT body ends up with a null `orbitId`, since `_addBody` always assigns a real one) → new `seed.capturedPlanets` array. Each entry: `{ _id, type: 'Captured', orbit, zone, size?, atm?, hydro?, pop?, name, uwp, _manualFields[] }`, with `orbit`/`zone` carried forward unchanged from `b._raw` (no UI exists to move a captured planet — drag-and-drop and the typed orbit# field both operate on `orbitId`, which captured planets don't have). `_id` is required: `ct_system_driver.js`'s mainworld-by-`_id` lookup (~line 69-71) already searches `seedSys.capturedPlanets` when `_mainworldRef` points at one — that lookup was ready and waiting, only the write stub wasn't producing the array. Both `generateSystemSkeleton` (`ct_bottomup_generator.js` ~line 135, `if (seedSys.capturedPlanets) sys.capturedPlanets = seedSys.capturedPlanets.slice();`) and the mainworld lookup were already ready to consume this — only the write stub had the gap.
  **Companion fix, same pass:** the read stub (`_buildWorkingCopyFromState`, CT capturedPlanets branch) was hardcoding `_manualFields: []` instead of reading `w._manualFields` like its sibling `raw.orbits` loop does — fixed to match, since without it a captured planet's manual fields wouldn't survive a close-and-reopen of the editor.
  **Known edge case, not fixed (pre-existing, out of scope):** `generateSystemSkeleton`'s seeded-body branch only activates `if ((seedSys.orbits || []).length > 0)` — a CT system consisting *solely* of captured planets (zero regular orbit bodies) would fall through to full stochastic regeneration, discarding the seeded captured planets too. Rare in practice; not addressed here.
  **Confirmed:** `node --check js/system_editor.js` passes.

**Dispatch stub — `_runGenerator()`, CT branch**
- Calls `window.CT_Generator.generateSystem({ mode: 'bottom-up', hexId, seedSys })`
- Writes `stateObj.ctSystem = newSys` and `stateObj.ctData = newSys.mainworld || null`

**Generator gate status — `js/ct_bottomup_generator.js` / `js/ct_world_engine.js` — UPDATED 2026-07-04 (Phase B, item 1, DONE):**
- ✅ **Done — structural seeding.** `generateSystemSkeleton(hexId, seedSys)` already consumes `seedSys.stars` (uses them directly, skips the stellar dice roll) and `seedSys.orbits` (uses the seeded body list directly, skips skeleton placement, when `_allowAddBodies` is false). User-placed/moved/deleted bodies already survive Fill & Save structurally.
  **Confirmed:** read `generateSystemSkeleton()` in full — the `if (seedSys && ...)` branches are real and functional, not stubs.
  **Blank-creation edge case fixed (2026-07-06).** The orbit-skeleton skip gate required `(seedSys.orbits || []).length > 0` in addition to `_allowAddBodies` being false — meaning a genuinely blank "Create System" (zero bodies) always failed that check regardless of the checkbox, falling through to a full stochastic skeleton roll (gas giants/belts/terrestrials) instead of staying blank like MgT2E. Fixed by splitting the gate: orbit/zone classification (`generateSystemOrbits(sys)`) still runs whenever the seed has no bodies yet, but the random-content roll (Step 2G) is now gated purely on `_allowAddBodies`, matching MgT2E's `if (!seedSys || seedSys._allowAddBodies)` exactly. Folded into CT's original structural-seeding scope, not a dated bug fix. See OW-11 (Section 6).
  **Moon-cap capture/trim parity gap fixed (2026-07-06).** MgT2E has always had a safety net CT never did: `SeedRestoration.captureSeededMoonCaps()`/`trimGeneratedMoonsToSeededCaps()` snapshot each world's moon count before generation and trim back to it afterward whenever `_allowAddBodies` is false — so a brand-new body always comes back moonless in MgT2E, only gaining moons if the user explicitly adds them. This was flagged as an open, unverified question under OW-6 and is now confirmed real and fixed: CT-shape-aware equivalents `captureCTSatelliteCaps`/`trimCTSatellitesToSeededCaps` (`ct_bottomup_generator.js`, using parallel positional arrays over CT's `sys.orbits[].contents.satellites`/`sys.capturedPlanets[].satellites` rather than `SeedRestoration`'s flat `sys.worlds[].moons` shape) are now wired into `ct_system_driver.js`'s `generateSystem()` around the bottom-up call. See OW-11.
- ✅ **Done — field-level manual preservation for size/atm/hydro/pop.** `ct_world_engine.js`'s `generatePhysicals()` and `generatePopulation()` now check a new `_ctFieldIsManual(obj, field)` helper (a safe wrapper around core.js's `isManual`, following the same `typeof`-guard convention already used for `tRoll2D`/`MgT2EMath` elsewhere in this file) before rolling `atm`/`hydro`/`pop`. Style note: unlike `mgt2e_world_engine.js` (which always rolls, then conditionally assigns, because GG mass/gravity chains need the rolled diameter regardless of which field is manual), CT skips the roll entirely when a field is manual — mirroring `t5_topdown_generator.js`'s `_isManual` pattern instead, since CT's atm/hydro/pop each only feed forward as *already-resolved* values (`body.atm`, `body.size`), not as intermediate roll results other fields depend on. The pre-existing `body.size === undefined` guard was left as the sole size gate (no `isManual` needed, matching MgT2E's own reasoning for `size`). The Vacuum World Exception (`liquidType`) check was hoisted out of the hydro roll's `else` branch so it still evaluates correctly when hydro is manual.
  **Government/law/tech-level/starport now also gated, folded into this same item (not a separate follow-up).** These roll in a separate pass (`finalizeSubordinateSocial` in `ct_world_engine.js`, for every subordinate world) that was missed by the original field-level pass above — it had no manual-field guard at all, so every non-mainworld world's government, law level, starport, and tech level were fully re-rolled from scratch on every Preview/Fill & Save regardless of what the user actually touched. `_ctFieldIsManual` guards now wrap all four rolls (mirroring the atm/hydro/pop pattern exactly), and `_ctUwpLockFor` (`system_editor.js`) now seeds/marks `gov`/`law`/`starport`/`tl` as manual alongside `atm`/`hydro`/`pop` — matching what `_mgt2eUwpLockFor` already does for MgT2E. Treated as part of CT's original field-level gating work, not a dated bug fix — see OW-10 (Section 6) for the fuller writeup and why this matters for T5/RTT/AoW too.
  **Satellite/moon quantity also now locked, same underlying gap.** `processBottomUpSatellites()` (`ct_bottomup_generator.js`) and `generateSatellites()` (`ct_physical_library.js`) had no manual/already-generated guard at all — every gas giant/terrestrial's moon *count* was re-rolled and **appended** to whatever satellites already existed (not replaced) on every Preview/Fill & Save, since `if (!parent.satellites) parent.satellites = []` only initializes an absent array, never clears an existing one. Both now check `if (parent.uwp) return;` before rolling — a body that has already completed one full generation pass (signaled by already having a `uwp`, the same signal `processBottomUpDesignation`'s mainworld fixed-anchor branch already used) has its satellite family locked, not re-rolled. See OW-10.
  **Confirmed:** `node --check js/ct_world_engine.js`, `node --check js/ct_bottomup_generator.js`, `node --check js/ct_physical_library.js`, and `node --check js/system_editor.js` all pass.
- **CT is fully editor-ready as of 2026-07-04.** All five Phase B items (field-level gating, `capturedPlanets`, UWP-auditor coverage, `_ENGINE_ADAPTERS` entry, UI exposure) are done — see the "CT is now fully online" note under v0.16.1 SEQUENCING above for the full rundown. Gov/law/tech-level/starport gating and satellite-quantity locking are now both done too (see just above) — no remaining deferred item for CT.

**UI exposure — `js/canvas_input.js` / `js/system_viewer.js` / `hex_map.html` — DONE 2026-07-04 (Phase B, item 5):**
- `canvas_input.js`'s `_seCanEdit` right-click gate now includes `_seState.ctData || _seState.ctSystem` alongside the existing MgT2E check.
- `system_viewer.js`'s "Edit System" button now renders `if (edition === 'MgT2E' || edition === 'CT')`.
- `hex_map.html`'s `#se-engine-dialog` CT radio button is no longer `disabled`, and the "(coming soon)" label is removed — matching the MgT2E option's styling. T5/AoW/RTT radios remain disabled.
- The dialog's confirm handler (`system_editor.js` ~line 2790) and `_buildBlankWorkingCopy()` were already fully engine-agnostic (read whichever radio is checked, no hardcoded engine name) — no changes needed there for "Create New" to work with CT.
- **Confirmed:** `node --check` passes on all three touched JS files. Cannot verify in-browser this session — first real end-to-end test (Create System, Edit System, Fill & Save, Preview, undo/redo) is now unblocked and up to Sean.

**UWP-auditor coverage — `js/ct_uwp_auditor.js` / `js/ct_system_driver.js` — DONE 2026-07-04 (Phase B, item 3):**
- ✅ **Done.** Added `runAndLog(sys, hexId)` to `ct_uwp_auditor.js`, mirroring `MgT2E_UWP_Auditor.runAndLog` (`mgt2e_uwp_auditor.js:400-423`, added under OW-7) — runs `auditCTSystem`, attaches the result to `sys.auditResult` (the field `system_editor.js`'s Fill & Save OW-3 gate reads — that gate is engine-agnostic, so it required no changes), and on failure `console.warn`s plus pushes each error to `window.auditBacklog` as `{ hexId, orbitId: null, engine: 'CT', message }`. `orbitId` is always `null` for CT since `auditCTSystem`'s `errors` array holds plain strings (not MgT2E's `{orbitId, message}` objects) — irrelevant to the Fill & Save dialog either way, since it only reads `audit.errors.length` for a count.
- `ct_system_driver.js`'s `generateSystem()` (the function CT's System Editor dispatch always calls, both bottom-up and top-down) now does `sys.audit = auditRunAndLog ? auditRunAndLog(sys, hexId) : auditor(sys);` in place of the old bare `auditor(sys)` call — `sys.audit` keeps working for existing consumers (same result object), `sys.auditResult` is now also set as a side effect. The existing `writeLogLine`-based trace logging right below this line is untouched (a different, complementary consumer — in-app trace log vs. `runAndLog`'s console/backlog).
- **Not done, deliberately out of scope:** `ct_bottomup_generator.js`/`ct_topdown_generator.js` still don't call the full auditor themselves (only a couple of narrow hand-written edge cases go straight to `auditBacklog`) — no duplication existed to consolidate here (unlike MgT2E's OW-7, which had two call sites), so no `runAndLog` call was added to either generator file. `system_driver.js` (the separate "Universal" driver used for T5 and some MgT2E regen paths) has its own CT-audit-attaching code but is never reached by CT's System-Editor dispatch — left untouched.
- **Confirmed:** `node --check js/ct_uwp_auditor.js` and `node --check js/ct_system_driver.js` both pass. CT is now UI-exposed (item 5, done later the same session) — the Fill & Save dialog itself still hasn't been exercised in-browser; that's the first real end-to-end test, up to Sean.

**`_ENGINE_ADAPTERS` entry — `js/system_editor.js` — DONE 2026-07-04 (Phase B, item 4, per the OW-8 pattern):**
- ✅ **Done.** CT now has its own adapter (`_ENGINE_ADAPTERS.CT`, added right after `MgT2E` in the registry) with all four methods — `detect`, `readBodies`, `write`, `run` — moved verbatim from CT's old inline `else if (engine === 'CT')` branches in `_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, and `_runGenerator`, which were then deleted (all four call sites already had the generic `if (adapter) { ...delegate... }` check from OW-8, so no call-site changes were needed beyond adding `_ENGINE_ADAPTERS.CT.detect(stateObj)` to `_detectEngine`, mirroring its existing `_ENGINE_ADAPTERS.MgT2E.detect(stateObj)` line).
- `_ctUwpLockFor` (added under item 1) was hoisted from `write`'s function body up to module scope, alongside `_mgt2eUwpLockFor` — matching OW-8's "define once, not per-call" optimization for MgT2E's equivalent helpers.
- `write(wc, starIdxById)` keeps the two-parameter shape documented in the adapter interface comment even though CT's `starIdxById` argument goes unused (CT bodies are always parented to the primary star in the bottom-up generator) — kept for signature consistency with MgT2E's adapter, not because CT needs it.
- AoW's copy of the old shared `MgT2E`/`AoW` inline branches (untouched by Phase A) is unaffected — CT and AoW were always separate branches, this pass didn't touch AoW.
- **Confirmed:** `node --check js/system_editor.js` passes; `grep "'CT'" js/system_editor.js` shows only the new adapter's `detect()` and the pre-existing, unrelated CT-specific companion-star `orbitAU` branch in the shared star-building loop (not part of the adapter interface, correctly left alone since only MgT2E's star-building was ever centralized the same way).

---

### T5 (Traveller 5)

**T5 was fully editor-ready as of 2026-07-05, then pulled back 2026-07-11–2026-07-16, then RE-ENABLED 2026-07-16 — see the ✅ SUPERSEDED note in the Section 5 banner.** All items below were DONE as of 2026-07-05 — `_ENGINE_ADAPTERS.T5` in `system_editor.js` now owns `detect`/`readBodies`/`write`/`run` (the old inline branches this subsection originally documented were deleted). Kept below as historical context on what was built and why; see "T5 is now fully online" under v0.16.1 SEQUENCING (Section 5 header) for the full rundown.

**✅ CURRENT STATUS (2026-07-16 onward): T5 Create and Edit are both live again in production**, on the same footing as MgT2E/CT — `hex_map.html`'s T5 radio in `#se-engine-dialog` is enabled, and `canvas_input.js`'s `_seCanEdit`/`system_viewer.js`'s Edit-button gates both include `T5`. This followed a same-day punch-list pass that closed OW-19 (a fresh-Create-breaking regression, not the originally-filed bug) plus OW-42 through OW-49 (mainworld-only body-count gate, moon-count locking, gov/law/starport/tl locking, mainworld UWP generation, companion orbital position, moon ordering/reordering, and a blank-create UX gap) — see Section 6 for each item's full writeup. The adapter logic described below as "`_ENGINE_ADAPTERS.T5` in `system_editor.js`" now actually lives in `js/t5_editor_adapter.js` (registered on `window.SystemEditorAdapters.T5`) — see OW-8's "REVERSED 2026-07-11" note. **RTT and AoW are unaffected by this — both remain fully disabled (Create and Edit) pending their own overhaul.**

**History (kept for context, no longer the current state):** T5 Edit access was switched off 2026-07-11 pending a full overhaul, and Create access followed it offline for part of 2026-07-16 (confirmed via direct inspection of `hex_map.html`'s `#se-engine-dialog`, which briefly showed the T5 radio as `disabled`) before both were restored later the same day once the punch-list items above closed. Also that day: OW-19 (originally filed as "a Gas Giant doesn't persist into `t5System.worlds`") turned out to be a false-alarm framing over a much bigger regression — every single T5 Preview/Fill & Save on a freshly-created system was throwing an uncaught exception (a `luminosity`/`lum` field-sync gap introduced 2026-07-13, two days after OW-19 was first filed) and failing to commit anything at all. Root-caused and fixed — see OW-19's full writeup (Section 6). **Bottom line for anyone resuming T5 work: this subsection's "DONE"/"fully online" claims are now considered re-verified as of the 2026-07-16 punch-list pass (OW-19/42–49) — still confirm in-browser before building further on top of it, but it is no longer presumed broken.**

**Read stub → `_ENGINE_ADAPTERS.T5.readBodies()`**
- Reads from `raw.worlds[]` (flat list) if present; falls back to iterating `raw.stars[].orbits[]` slots
- `parentStarIdx` preserved from world objects or inferred from the star index when iterating slots
- `au` resolved as `w.au ?? w.distAU ?? _orbitIdToAU(w.orbitId)` in that priority order; `orbitId` falls back to the slot's own index (`slot.orbit`) when the body itself doesn't carry one
- UWP preserved from body objects
- **Bug fixed (2026-07-05):** the per-star fallback path built each body via `Object.assign({}, slot.contents, {...})` without first checking `slot.contents` was non-null — an empty orbit slot (`contents: null`) still produced a typeless object that the old `type !== 'Empty'` filter let through, turning every empty orbit into a phantom body on re-edit. Fixed by filtering out null-content slots before the `Object.assign`. Found via in-browser testing (create → save → re-edit), not static review.
- Moon-level mainworld detection also fixed: a moon flagged as the system's mainworld doesn't reliably carry `isMainworld: true` from the generator (`t5_topdown_generator.js` never sets it explicitly on `sys.mainworld`) — now detected the same way top-level bodies are (`_isMW`/`type === 'Mainworld'`) before handing off to the shared `_buildMoon` helper.

**Write stub → `_ENGINE_ADAPTERS.T5.write()`**
- Runs Algorithm 7 (`_t5ElectMainworldIfNeeded`) first, so an unflagged mainworld gets auto-elected before the seed is built
- Builds `seed.mainworldUWP`: extracts UWP, name, travelZone from the resolved mainworld body/moon, plus `isPreMoon`/`orbitId`/`parentBodyId`/`parentStarIdx` (so the generator can place a moon-mainworld under its actual seeded parent instead of a fresh roll) and locked physical fields via `_t5UwpLockFor`. Retains the `'A788899-9'` fallback UWP for a body with no UWP yet (brand new, not a gap — the generator rolls a fresh one)
- Produces `seed.worlds[]` via `_t5BodySeed()`, now including moons and locked fields (previously a bare `{_id, type, name, uwp, orbitId, parentStarIdx, _manualFields}` with no moons array at all — seeded moons used to be silently dropped before ever reaching the generator)

**Dispatch stub → `_ENGINE_ADAPTERS.T5.run()`**
- Calls `window.System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: seedSys.mainworldUWP, hexId, seedSys })`
- Guard: skips if `seedSys.mainworldUWP` is null — now correctly reachable only when the working copy has zero eligible bodies (Algorithm 7 step 6), not effectively-always-null as before
- Writes `stateObj.t5System = newSys` and `stateObj.t5Data = newSys.mainworld || null`
- ✅ **Done:** `js/t5_topdown_generator.js`'s `generateT5System(mainworldBase, seedSys)` now accepts and fully consults `seedSys` — structural seeding, `_allowAddBodies` gating, and Algorithm 7 are all implemented; see Section 5 header for the full writeup.

---

### RTT (RTT Worldgen)

**RTT is fully editor-ready as of 2026-07-04.** All items below are DONE — `_ENGINE_ADAPTERS.RTT` in `system_editor.js` now owns `detect`/`readBodies`/`write`/`run` (the old inline branches this subsection originally documented were deleted). Kept below as historical context on what was built and why; see "RTT is now fully online" under v0.16.1 SEQUENCING (Section 5 header) for the full rundown.

**⚠️ UPDATED 2026-07-11 — read the Section 5 top banner before resuming work here.** Edit System access for RTT is currently switched off (Create still works) pending a full overhaul, not incremental fixes. The adapter logic described below as "`_ENGINE_ADAPTERS.RTT` in `system_editor.js`" now actually lives in `js/rtt_editor_adapter.js` (registered on `window.SystemEditorAdapters.RTT`) — see OW-8's "REVERSED 2026-07-11" note. Extracted cleanly with zero pre-existing quirks surfaced during verification (unlike T5) — see the punch list's OW-15 item (companion drag position) as the one known open gap specific to RTT.

**Read stub → `_ENGINE_ADAPTERS.RTT.readBodies()`**
- Reads from `raw.stars[].planetarySystem.orbits[]` — iterates per star, sorted by `orbitNumber`
- AU is approximated from zone: Epistellar (base 0.10AU, step 0.10), Inner (base 0.50AU, step 0.70), Outer (base 5.00AU, step 8.00), via a shared `_rttOrbitAU()` helper. These are estimates for display order only — RTT does not use AU natively.
- ✅ **Done:** UWP is now synthesized per-body via `computeRTTBodyUWP()` (`rtt_engine.js`, extracted from `extractRTTMainworld`'s formula) instead of the old hardcoded `uwp: null`.
- Travel zone: `'Red'` if body has a `'Z'` base; else `'G'`

**Write stub → `_ENGINE_ADAPTERS.RTT.write()`**
- Produces `seed.rttBodies`: a 2D array indexed by star (`rttBodies[starIdx][]`)
- Per-body format: `{ _id, orbitNumber, zone, type, satellites[], name, _manualFields[] }`
- Type mapping: `'Gas Giant'` → `'Jovian Planet'`; `'Belt'` → `'Asteroid Belt'`; else `'Terrestrial Planet'`
- ✅ **Fixed:** `zone` is now read from `_raw.zone` (falling back to `'Inner'` only for brand-new bodies) instead of being hardcoded to `'Inner'` for every body — RTT's seeded path uses the seed's zone verbatim rather than recalculating it from orbit position, so the old hardcode would have silently reclassified e.g. an Outer-zone body as Inner on every Fill & Save.
- New `_rttUwpLockFor(body)` helper seeds and marks manual: `worldClass`/`size`/`atmosphere`/`hydrosphere`/`population`/`government`/`lawLevel`/`starport`/`tl` — all of them, unlike CT/T5's lock helpers, since RTT's preservation mechanism has no presence-based fallback guard to lean on for any field.

**Dispatch stub → `_ENGINE_ADAPTERS.RTT.run()`**
- Calls `generateRTTSectorStep1(hexId, { seedSys })`
- Writes `stateObj.rttSystem = newSys`
- Calls `extractRTTMainworld(newSys, seedSys._mainworldRef)` for `stateObj.rttData` — uses the generic `seedSys._mainworldRef` field (set for every engine in `_buildSeedSys`) rather than a `workingCopy` parameter, so the adapter `run()` contract didn't need to grow a 4th argument just for RTT.

**Pipeline threading status — `js/rtt_engine.js`:**
- ✅ **Done — full pipeline already auto-chains and threads `seedSys`.** `generateRTTSectorStep1(hexId, options)` proactively calls `generateRTTSectorStep2(sys, options)` at its end; `generateRTTSectorStep2` proactively calls `generateRTTSectorStep3(sys, options)`; `generateRTTSectorStep3` proactively calls `generateRTTSectorBiographer(sys, options)`. `options` (containing `seedSys`) is passed at every hop.
- ✅ **Done — structural body seeding.** `generateRTTSectorStep2` reads `seedSys.rttBodies[starIdx]` and uses it directly (skipping the dice-rolled orbit layout) whenever `seedSys._allowAddBodies` is false.
- ✅ **Done — field-level manual preservation.** `processRTTSocialStats()`'s existing `_rttSaveManual`/`_rttRestoreManual` wrapper now covers `industry`/`tradeCodes`/`bases`/`population`/`government`/`lawLevel`/`starport`/`tl` (extended from just the first 3), with the Uninhabited early-return branch given its own inline guards since it bypasses the outer restore entirely. `classifyRTTBody` gained a `worldClass` guard it never had. The physical-stat functions (`processRTTPhysicalStatsPartA`/`PartB`, `calculateRTTDesirability`, `checkRTTTerraforming`, `determineRTTHabitation`) turned out to already have their own save/restore wrappers — a correction to what this manifest previously claimed. Gov/law/tl/starport gating is **not** deferred for RTT the way it was for CT/T5 — it was folded in here since extending the existing save/restore array cost nothing extra.
- ✅ **Done — real bug fixed.** `generateRTTSectorStep1`'s seeded-star branch never set `star.classification`/`star.luminosityClass`, which several functions read unconditionally — see the "Real bug found and fixed" note under v0.16.1 SEQUENCING above.

---

### AoW (Architect of Worlds)

**AoW is fully editor-ready as of 2026-07-05.** The gap analysis below (written earlier the same day, before implementation) is kept as historical context on *why* the work was bigger than a normal gating pass — see the "AoW is now fully online" note under v0.16.1 SEQUENCING (Section 5 header) for the full implementation writeup, and OW-9 (Section 6) for the closed writeup. The specific things this section originally flagged as missing are now true: `_ENGINE_ADAPTERS.AoW` exists (old inline branches deleted from all four call sites), `js/aow_uwp_auditor.js` exists and is wired through `sys.auditResult`, and `js/aow_seed_bridge.js` (new module) resolves star physics/hierarchy/disk-worksheets for the seeded path. **Not yet verified in-browser** — see the caveat in the v0.16.1 SEQUENCING note.

**⚠️ UPDATED 2026-07-11 — read the Section 5 top banner before resuming work here.** Edit System access for AoW is currently switched off (Create still works) pending a full overhaul, not incremental fixes. The adapter logic described above as "`_ENGINE_ADAPTERS.AoW`" now actually lives in `js/aow_editor_adapter.js` (registered on `window.SystemEditorAdapters.AoW`) — see OW-8's "REVERSED 2026-07-11" note. Since AoW's adapter was always deliberately thin (no AoW-only lock/seed helpers — that logic lives in `js/aow_seed_bridge.js`, untouched by this move), this was the simplest of the five extractions; it was also the one **finally verified in-browser** this session (2026-07-11), closing the "Not yet verified in-browser" caveat above — clean Playwright round trip, zero console errors, no pre-existing quirks surfaced (AoW is bottom-up like MgT2E/RTT, no mainworld-anchor requirement before Preview).

**Read stub — now `_ENGINE_ADAPTERS.AoW.readBodies()`** (moved verbatim from the old inline `else if (engine === 'AoW')` branch in `_buildWorkingCopyFromState()` — behavior unchanged, only the location moved)
- Detected via `_ENGINE_ADAPTERS.AoW.detect()`, now routed through the adapter registry like every other engine (previously a special-cased first check in `_detectEngine()`, ahead of the adapter dispatch — that inconsistency is also fixed)
- Reads bodies from `raw.worlds[]` (flat list, same shape MgT2E uses) — skips `type === 'Empty'`
- Mainworld identified via `_isMW(w, raw.mainworld)` (matches by object identity or by `uwp`+`name` pair) or `w.type === 'Mainworld'`
- Type canonicalized via the shared `_canonType()`/`_ggTypeFrom()` helpers (same ones CT/T5/RTT's older inline branches use) — maps AoW's raw type strings (containing "jovian"/"helian"/"ice giant"/"belt"/"asteroid"/"planetoid"/"ring") down to the editor's three-way `Gas Giant`/`Belt`/`World` vocabulary
- Moons read from `w.moons || w.satellites`
- **Confirmed:** read `system_editor.js` lines 72-85 (`_detectEngine`) and 850-871 (AoW body-reading branch) directly.

**Write stub — now `_ENGINE_ADAPTERS.AoW.write()` — REWRITTEN 2026-07-05, no longer MgT2E's borrowed logic**
The old inline branch (described in the paragraph above the "fully editor-ready" banner as "literally MgT2E's old write-stub logic, reused verbatim") is gone. The new adapter's `write()` is deliberately thin: it carries each working-copy body through with `_id`/`name`/`type` (editor vocabulary)/`uwp`/`orbitId`/`au`/`parentStarId` (a star `_id`, not an index)/`isMainworld`/`moons`/`_raw`/`_manualFields`. It does **not** do CT/MgT2E-style field-locking itself — that logic (`aowUwpLockFor`/`aowPhysSeed`) lives in `js/aow_seed_bridge.js` and runs inside `synthesizeDiskWorksheets()` when each worksheet planet is built, per design decision 5 (all new AoW logic stays out of `system_editor.js`).
- Body type is NOT remapped to MgT2E's vocabulary anymore — the bridge's `toAowPlanetType()` maps the editor's `Gas Giant`/`Belt`/`World` vocabulary directly to AoW's own `planetType` values (`'Gas Giant (CA)'`/`'Planetoid Belt'`/`'Terrestrial'`) at worksheet-build time.
- Brand-new bodies (no `_raw`) now get real values instead of empty locks: `defaultMassFor()` (bridge) assigns a representative Earth-mass value by type, so Phase 3's density/radius/gravity formulas have something to compute from instead of `NaN`.

**Dispatch stub — now `_ENGINE_ADAPTERS.AoW.run()`** (moved verbatim from the old inline branch — behavior unchanged)
- Calls `window.AoWBottomUpGenerator.generateAoWSystemBottomUp(hexId, seedSys)`
- Writes `stateObj.aowSystem = newSys`, `stateObj.mgt2eData = newSys.mainworld || null`, and `stateObj.mgtSocio = newSys.mainworld || null` (AoW deliberately reuses MgT2E's socio display fields — a real, working design choice, not a bug, per the inline comment citing `macro_orchestrator.js:1128`)

**Generator gate status — `js/aow_bottomup_generator.js` / `js/aow_world_engine.js` — DONE 2026-07-05, closing OW-9's core finding:**
- ✅ **Structural seeding, unchanged from before this pass and still correct.** `generateAoWSystemBottomUp(hexId, seedSys)` substitutes `seedSys.stars`/`seedSys.worlds` and gates disk/orbital rolls off `_allowAddBodies`.
- ✅ **Field-level manual preservation and field-level generation for seeded bodies — both done.** `js/aow_seed_bridge.js`'s `synthesizeDiskWorksheets()` builds real `sys.diskWorksheets` from the resolved stars + seeded bodies (reusing `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet`, newly exposed on its public API, rather than duplicating that math), called from a new step in Phase 2. Phase 3's 13 functions were already called unconditionally in the old code — the actual bug was never a skip-guard around Phase 3 itself, it was that `sys.diskWorksheets` was simply never populated when seeded. They now run for real, with `isManual()` guards threaded into the ~6 functions/points that compute fields the editor exposes (`stepPhysicalParameters`'s density/radius/surfaceGravity, `generateAlbedo`, `applyUWPPhysicals`'s size/atm/hydro digit classifiers) — the other ~20 fields across those 13 functions are pure internal simulation state (M-number, blackbody temp, grand-tack flags, etc.) the editor never exposes, left fully random by design, same principle CT/T5 used for their own internal-only fields.
- ✅ **Star-side physics resolution — genuinely new work, not a mechanical port.** Phase 1 now calls `aow_seed_bridge.js`'s solver (bisection-searches `initialMass` from a chosen spectral type, no jitter applied), age-window reconciliation across stars (conflict detection, not silent averaging), and hierarchy/orbit mapping — none of which existed anywhere before this pass, since AoW's own `generateStarHierarchyAndMasses` has no path to accept a pre-chosen star at all.
- ✅ **Two real bugs found and fixed while wiring this, both pre-existing and never triggered before (AoW wasn't UI-exposed until this pass):** `populateAoWWorldsList` was gated to skip whenever seeding controlled body count (correct in the old code — nothing would have been there to flatten — but would have stranded all of Phase 3's now-real computed physics inside `diskWorksheets` if left skipped); and the `seedSys._mainworldRef` direct-lookup branch in Phase 4 never set `sys.mainworld`/`isMainworld`/`type` itself (only `generateMainworldSelection` did), silently skipping all of Phase 5's Social Sweeps for any AoW system with a user-designated mainworld.
- ✅ **`age`/`systemAge` field-name mismatch fixed** — the seed carried `age`, every formula reads `systemAge`; the bridge now writes `sys.systemAge` directly. `sys.systemMetallicity` is also now resolved for the seeded path (previously silently defaulted via `|| 1.0`) via a small reimplementation of `aow_stellar_engine.js`'s own Step 5 formula (kept in sync; only reimplemented because that step lives bundled inside a monolithic function the seeded path doesn't call as a whole).
- Phase 5 (Social Sweeps) works correctly on seeded data, unaffected by anything above: `generateMainworldUWP` detects `world.size !== undefined` and uses pre-set physical integers rather than rerolling, consistent with the bridge's seeding.

**UWP-auditor coverage — `js/aow_uwp_auditor.js` — BUILT 2026-07-05, didn't exist before this pass:**
Mirrors `ct_uwp_auditor.js`/`t5_uwp_auditor.js`'s `runAndLog` shape exactly: `auditAoWSystem(sys, options)` (mainworld-count structure check — including the barren-system placeholder case, belt-size integrity, satellite-vs-parent size, population cap) and `runAndLog(sys, hexId)` (sets `sys.auditResult`, logs/backlogs failures). `aow_bottomup_generator.js`'s Phase 6 now calls `runAndLog` instead of the old inline `auditAoWSystem`-then-manually-backlog block, so `sys.auditResult` is actually set — previously `activeAuditor` always resolved to `null` since the required file didn't exist, making the whole audit block permanently dead code.

**`_ENGINE_ADAPTERS` entry — DONE 2026-07-05.** `_ENGINE_ADAPTERS.AoW` now exists with all four methods (`detect`/`readBodies`/`write`/`run`); the old inline `else if (engine === 'AoW')` branches are deleted from all four call sites (`_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, `_runGenerator`).

**UI exposure — DONE 2026-07-05.** `hex_map.html`'s `#se-engine-dialog` AoW radio is enabled (no longer `disabled`, "(coming soon)" removed); `canvas_input.js`'s `_seCanEdit` gate now includes `_seState.aowSystem`; `system_viewer.js`'s Edit-button gate now includes `edition === 'AoW'`. Script loading: `js/aow_uwp_auditor.js` and `js/aow_seed_bridge.js` both added to `hex_map.html`, loaded before `js/aow_bottomup_generator.js` (which depends on both).

**Companion topology restriction — NEW, design decision 3.** `system_editor.js`'s `_addStar()` now caps AoW systems at 4 stars and requires a 4th star to pair with the most recently added companion — enforced at build time in the editor, not just at Fill time, matching the 5 hierarchy shapes `aow_seed_bridge.js`'s `mapHierarchy()` actually supports.

**Age-conflict dialog — NEW, design decision 2.** `_fillAndSave()` now checks `result.newSys.ageConflict` (set by the bridge's `reconcileSystemAge` when manually-chosen spectral types imply non-overlapping age windows) and shows a warn-and-proceed dialog, reusing the same UI pattern as the OW-3 audit gate, before falling through to the audit check.

---

### What v0.16.1 Must Do (per engine) — CORRECTED 2026-07-03

Superseded the version of this table dated before 2026-07-03, which assumed no generator gating existed for CT or RTT. See the per-engine sections above for the full evidence trail.

| Engine | Structural seeding (stars/bodies survive Fill) | Field-level manual preservation | Remaining work |
|---|---|---|---|
| CT | ✅ Done (`generateSystemSkeleton` consumes `seedSys.stars`/`seedSys.orbits`/`seedSys.capturedPlanets`; blank-creation gate fixed 2026-07-06 so a genuinely empty seed with `_allowAddBodies` false stays blank instead of rolling a full random system — OW-11 Gap 1) | ✅ Done — `size`/`atm`/`hydro`/`pop`/`gov`/`law`/`starport`/`tl` all gated via `_ctFieldIsManual` in `ct_world_engine.js`, seeded via `_ctUwpLockFor` in `system_editor.js`'s write stub (covers both orbit bodies and captured planets). Satellite/moon quantity also locked once generated (`processBottomUpSatellites`/`generateSatellites` check `parent.uwp` before rolling — OW-10), and a brand-new body's *first* moon roll is now capped back to its pre-generation count via `captureCTSatelliteCaps`/`trimCTSatellitesToSeededCaps`, matching MgT2E's `SeedRestoration` pair (OW-11 Gap 2). | **✅ UI-exposed 2026-07-04 — CT is fully live in the System Editor.** No remaining gating follow-up. |
| T5 | ✅ Done (2026-07-05) — `generateT5System(mainworldBase, seedSys)` places seeded stars/bodies before Phase 1, gates all inventory/moon rolls off `_allowAddBodies`. **Not verified: does a genuinely blank Create System (zero bodies) actually stay blank, or does it have the same "requires non-empty seed" trap CT had until 2026-07-06 (OW-11 Gap 1)?** | ⚠️ Partial (worldType/size/atm/hydro/pop via `_t5UwpLockFor`; gov/law/tl/starport deliberately deferred, same gap CT had until 2026-07-06 — see OW-10) | **✅ UI-exposed 2026-07-05 — T5 is fully live in the System Editor.** Remaining items: gate gov/law/tl/starport (same fix as CT, optional follow-up, not a blocker); **verify satellite/moon-quantity locking (OW-10) and moon-cap capture/trim on a brand-new body's first roll (OW-11 Gap 2) — neither has ever been audited for T5** |
| RTT | ✅ Done (2026-07-04) — `generateRTTSectorStep2` consumes `seedSys.rttBodies`, full pipeline already auto-chains Step1→2→3→Biographer with `seedSys` threaded throughout; seeded-star `classification`/`luminosityClass` backfill bug found and fixed. **Not verified against OW-11 Gap 1** (blank-creation body-count trap). | ✅ Done (industry/tradeCodes/bases/population/government/lawLevel/starport/tl via the extended `_rttSaveManual`/`_rttRestoreManual` list, plus a new `worldClass` guard in `classifyRTTBody`; gov/law/tl/starport gating included, not deferred — see RTT subsection above) | **✅ UI-exposed 2026-07-04 — RTT is fully live in the System Editor.** No known gating follow-up for gov/law/tl/starport. **Not verified: satellite/moon-quantity locking (OW-10), or moon-cap capture/trim on a brand-new body's first roll (OW-11 Gap 2)** — RTT's "full field-level gating" claim predates both findings and was never specifically checked against either; spot-check before assuming it's clean. |

| AoW | ✅ Done (2026-07-05) — `generateAoWSystemBottomUp` substitutes `seedSys.stars`/`seedSys.worlds`; Phase 1 resolves star physics from chosen spectral types via `aow_seed_bridge.js`; Phase 2 synthesizes real disk worksheets for the seeded path. **Not verified against OW-11 Gap 1** (blank-creation body-count trap). | ✅ Done — `isManual()` guards in the ~6 functions/points that compute editor-exposed fields (density/radius/surfaceGravity/albedo/size/atm/hydro digits); internal-only simulation fields (M-number, blackbody temp, etc.) left random by design | **✅ UI-exposed 2026-07-05 — AoW is fully live in the System Editor**, closing OW-9. New module `js/aow_seed_bridge.js` (star-physics solver, age reconciliation, hierarchy/orbit mapper, disk-worksheet synthesis) and new file `js/aow_uwp_auditor.js` (didn't exist before). **Not yet verified in-browser** — see the caveat under the "AoW is now fully online" note above. **Also not verified: satellite/moon-quantity locking, moon-cap capture/trim on a brand-new body's first roll (OW-11 Gap 2), and whether gov/law/tl/starport-equivalent fields are actually covered by the ~6-function guard list (OW-10)** — same caveat as RTT. |

**Status as of 2026-07-05:** CT, T5, RTT, and AoW are all fully online — AoW was last through the Phase B queue and needed materially more design/implementation work than CT/T5/RTT (a new seed-bridge module, not just a gating pass), per OW-9. **Verified end-to-end in-browser via Playwright (2026-07-05)** — see the real bug found and fixed during that pass, noted under the "AoW is now fully online" note above.

**Status update, 2026-07-11 — Edit access, not Create, pulled back for three of the four:** "fully online" above meant both Create *and* Edit worked for all five engines as of 2026-07-05. As of 2026-07-11, **Edit** is switched back off for T5/RTT/AoW pending a full overhaul (see the banner at the top of Section 5) — CT remains fully online exactly as described, MgT2E was never affected. **Create is not affected by this change for any engine** — see the next paragraph, still accurate as written.

The engine selection dialog HTML (`#se-engine-dialog`, in `hex_map.html`) has MgT2E / CT / T5 / AoW / RTT radio buttons present. **UPDATED 2026-07-05:** all five are now enabled (no longer `disabled`, "(coming soon)" label removed). **Still true as of 2026-07-11** — this paragraph describes Create only, which the 2026-07-11 Edit-scope pullback did not touch.

---

## 6. Outstanding Work Items & Bugs

**Condensed 2026-08-01.** This section previously held 65 OW items plus 7 numbered bugs
in full forensic detail — about 223 KB, 63% of this document. With the v0.16.x editor
work closed for MgT2E/CT/T5 and RTT/AoW paused, per-bug narrative no longer earns that
space. What survives, and why:

- **6.1** — the recurring failure patterns distilled from those items. This is the part
  that actually transfers to RTT/AoW, and the reason the detail was read rather than
  simply deleted.
- **6.2** — items still open or partially done, kept **verbatim**.
- **6.3** — a one-line index of every closed item, so any of them is still findable.

### 6.1 Recurring patterns to expect when bringing RTT or AoW online

Nine failure modes repeated across MgT2E, CT and T5. Assume they will recur. Each cites
the closed items it was drawn from (see 6.3).

**1. Seeded and manually-added bodies skip generation steps entirely.**
The single most common failure. A body created in the editor bypasses whatever phase
normally populates a field, so the field is never set by *anyone* — not even freshly
rolled, because the roll code never runs. OW-9 (AoW's whole Phase 3 physical pipeline was
unreachable: every function early-returns on empty `sys.diskWorksheets`, and only
`generatePlanetaryDisks` populates it — the exact function seeding skips), OW-24 / OW-31
(CT moons never got distance, gravity, mass, temperature, rotation or tilt), OW-28 (CT
belts never got `size`), OW-44 (a new T5 mainworld never got a UWP at all).
→ **For RTT/AoW: enumerate every generation phase and ask, per editor-exposed field,
what populates it when the body was seeded rather than rolled.**

**2. Already-generated data silently re-rolls on a no-edit Preview/Save.**
OW-10 and OW-14 (CT — gas giants have no natural "already generated" signal), OW-34 (a CT
companion's worlds re-rolled their entire UWP every time), OW-43 (T5 moon counts
fluctuated, not just grew), OW-45 (T5 subordinate gov/law/starport/TL), OW-38 (an MgT2E
ring vanished on the very first Preview).
→ **Test: open, Preview, Fill & Save, reopen, repeat — with zero edits. Nothing may
change.**

**3. A "fixed" manual-field guard is usually only partial.**
OW-26: starport had a guard, gov/law/TL did not, and a comment claimed the field was
already fixed.
→ **Check every field a fix claims to cover, not just the one it names.**

**4. Two UI gates must agree.**
Edit availability is gated in **both** `js/system_viewer.js` (the orrery's Edit button)
and `js/canvas_input.js` (`_seCanEdit`, right-click). Enabling an engine means changing
both, and a third gate — `hex_map.html`'s `#se-engine-dialog` radios — controls Create.
These have drifted before.
→ **Change all three together; grep for the engine name to confirm.**

**5. Null or empty orbit slots become phantom bodies.**
`Object.assign({}, null, {...})` yields a plain object with no `type`, and a filter like
`w.type !== 'Empty'` passes it straight through because `undefined !== 'Empty'`. Found in
T5's per-star fallback.
→ **Guard the null before spreading, not after filtering.**

**6. A secondary body list is invisible to a function that walks only the primary one.**
CT's `capturedPlanets` live outside `orbits`. RTT stores bodies **flat** in
`star.planetarySystem.orbits[]` with no `.contents` wrapper — which is precisely how the
RTT branch of the Obsidian exporter stayed dead code unnoticed (HX-6 in
`directives/html_extract_manifest.md`). OW-20, OW-58.
→ **For RTT especially: every traversal must handle the flat layout, and `sys.worlds` /
`star.orbits` do not exist on it.**

**7. The three surfaces disagree.**
Edit panel, accordion and orrery each derive position independently, so a change can land
in one and not the others. OW-15 and OW-17 (companion stars), OW-25 (a cached `au` never
refreshed when Orbit # changed), OW-56, OW-59, OW-60.
→ **Verify every structural change on all three surfaces, not just the one you edited.**

**8. The same fix is needed in two places.**
Bug #6/#7: the gas-giant flag had to be derived from the actual body list in both MgT2E
and CT, because the counter it previously trusted (`sys.gasGiants`) is only populated by
an inventory phase the editor skips. The editor's `_clearSystemData()` and
`macro_orchestrator.js`'s inline clear-block still differ today — see OW-5 layer 2, which
remains open.
→ **Derive from the real body list rather than trusting a counter, and check whether the
macro path needs the same change.**

**9. In-browser testing finds what static review cannot — three for three.**
T5 phantom bodies, RTT's missing `star.classification`, AoW's missing `planet.Rmin`: each
found by an actual Create → add bodies → Preview → Fill & Save → reopen → modify → Save
round-trip, and **none** by careful reading, including a deliberate plan-review pass.
`node --check` is not verification.
→ **Budget for at least one real bug per engine found this way. A clean first pass is
suspicious, not reassuring.**

### 6.2 Open / partial items — full text retained

**OW-3 — ✅ DONE for MgT2E (2026-07-04) and CT (2026-07-04, Phase B item 3); still open per-engine for AoW/T5/RTT: UWP Auditor step (Fill & Save)**
After the generator runs, the UWP Auditor should be called. If it returns errors, show a warn-and-proceed dialog: [Proceed anyway] / [Go back and fix].
**Implementation (2026-07-04):** `mgt2e_bottomup_generator.js` already computed a full `auditMgT2ESystem()` result internally on every run but discarded it after logging/backlog-pushing; it now also attaches it to the returned system as `sys.auditResult`, so callers can read it without re-running the (recursive, trace-logging) audit a second time. `system_editor.js`'s `_fillAndSave()` checks `result.newSys.auditResult` after `_generateAndCommit()` runs; on `pass === false` it shows a warn-and-proceed dialog (`Proceed Anyway` / `Go Back & Fix`) instead of silently closing the editor. The close-editor/reopen-viewer tail was split into `_finishFillAndSave(hexId)` so "Proceed Anyway" can run it without redoing generation; "Go Back & Fix" is a no-op that just leaves the editor open.
**Known limitation, accepted as out of scope for this pass:** by the time the audit result is available, `_generateAndCommit()` has already written the (possibly failing) system into `hexStates` — `_runGenerator` mutates the live `stateObj` mid-generation rather than staging to a copy, so "Go Back & Fix" cannot literally un-commit the write. It only keeps the editor open for further edits; the map-level `Ctrl+Z` undo (already saved via `saveHistoryState()` before generation) remains the actual rollback path if the user wants one. A true "nothing touched until Fill & Save confirms" would require `_runGenerator`/the generators to stage writes rather than mutate live state — a bigger change, not attempted here.
**Gate is engine-agnostic and opt-in:** `_fillAndSave()` checks `audit && audit.pass === false` generically, so it's silently inert for AoW/T5/RTT until each of those generators gets the same one-line `sys.auditResult = ...` attachment once their own `seedSys` gating work is done (Section 5) — CT already got this (`ct_uwp_auditor.js`'s new `runAndLog`, wired into `ct_system_driver.js`). **Sequencing still applies going forward:** each new engine needs its own auditor coverage (its own populated `sys.auditResult`) before it's trustworthy to Fill & Save against — OW-3's MgT2E/CT work does not automatically cover them.
*Spec ref: Algorithm 5, Step 5*


**OW-5 — 🟡 PARTIALLY DONE (decided 2026-07-03; layer 1 completed 2026-07-04): Extract commit path before any new-engine work begins**
The spec calls for a `commitEditorSystem(hexId, sys, engine)` function in `macro_orchestrator.js` as the shared commit gate. The full commit (clear old data, write new engine data, `computeSystemCounts`, `hexStates.set`, redraw) was duplicated inline between `_fillAndSave()` and `_preview()` in `system_editor.js`, and diverges from the separate commit blocks already living in `macro_orchestrator.js`'s macro functions.
**Decision:** Sean does not want to compound this duplication by adding CT/T5/RTT/AoW branches on top of it. This must be resolved — for MgT2E only, no new engines involved — **before** any engine-expansion work starts, not deferred to "whenever we touch the next engine."
**Scope note:** the duplication is two-layered — (1) `_fillAndSave()` vs `_preview()` duplicated the same name-preservation/`computeSystemCounts`/`hexStates.set`/redraw block inside `system_editor.js` itself, and (2) that block also duplicates logic already present in `macro_orchestrator.js`'s existing macro commit blocks (~lines 499-555 as of Phase 2). A full fix consolidates both layers into one shared function used by all three call sites (macros, Fill & Save, Preview) — extracting only the editor's own duplication without touching the macro commit blocks leaves a second parallel path exactly like the one that caused Bug #6 (the gas-giant-sync fix needing to be applied in two places).
**✅ Layer 1 DONE (2026-07-04):** `system_editor.js`'s internal duplication is extracted into a shared `_generateAndCommit(errorLabel)` (private to the module, ~line 2196), called by both `_preview()` and `_fillAndSave()`. It owns: build seedSys → `_resolveStarPhysics` → resolve/create `stateObj` → run generator (try/catch, parameterized error-dialog text) → `_restoreDisplayManualFields` → `_forceGreenTravelZone` → mainworld-name preservation across `mgt2eData`/`ctData`/`t5Data`/`rttData` → `stateObj.type` → `computeSystemCounts` → `hexStates.set` → `requestAnimationFrame(draw)` → `populateEditorAccordions`. Returns `{ hexId, stateObj, newSys }` or `null` (dialog already shown) on failure.
Per the design-care note below, the two behavioral differences were deliberately kept in the callers rather than folded into the shared function: `_preview()` still takes its own `_previewOriginalState` snapshot before calling it, and still does its own post-commit viewer-refresh + derived-property backfill; `_fillAndSave()` still calls `saveHistoryState()` before calling it, and still does its own post-commit editor-close + viewer-reopen. Net change: `system_editor.js` shrank by ~31 lines (79 deleted, 48 added); `node --check js/system_editor.js` passes.
**❌ Layer 2 NOT DONE — explicit scope decision (2026-07-04):** Sean chose "system_editor.js only" for this pass over "full consolidation" when asked directly, given the added risk of reconciling `macro_orchestrator.js`'s batch-macro commit block (which carries extra logic — `StatisticalAuditor` hooks, its own mainworld-lookup-including-lunar-search, its own old-data-clearing field list that already differs from `system_editor.js`'s `_clearSystemData()`) with the editor's per-hex preview/undo semantics. **The macro_orchestrator.js layer remains open** — a `commitEditorSystem()` shared by macros AND the editor has not been built, and the drift between the editor's `_clearSystemData()` and the macro's inline clear-block (Bug #6/#7's root cause pattern) is still live. Revisit before or during Phase B if a new engine's macro and editor commit paths need to agree.
*Spec ref: Phase 2 Modified Files table; Phase 4 Step 7*


**OW-9 — ✅ CLOSED 2026-07-05 (found and fixed same day, pre-Phase-B AoW readiness audit): AoW's Phase 3 pipeline was architecturally unreachable in the System Editor's seeded path**
**Resolution:** option (a) below was chosen and built — a new module `js/aow_seed_bridge.js` synthesizes real `sys.diskWorksheets` from resolved stars + seeded bodies (reusing `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet`), and `isManual()` guards were threaded into the ~6 functions/points that compute editor-exposed fields (not all 13 — most of the 13 functions' fields are pure internal simulation state the editor never exposes, so those were left fully random by design rather than over-gated). The star-side half of the problem (Phase 1 had no path to accept a user-chosen star at all) also needed new solver logic — a bisection search from spectral type to `initialMass`, age-window reconciliation across multiple stars with conflict detection (warn-and-proceed dialog, not silent averaging), and a hierarchy/orbit mapper — none of which existed before this pass. `js/aow_uwp_auditor.js` was also built from scratch (didn't exist at all), `_ENGINE_ADAPTERS.AoW` was added (OW-8 pattern), and UI exposure was flipped. See the "AoW is now fully online" note under v0.16.1 SEQUENCING (Section 5 header) for the full implementation writeup, and the corrected AoW subsection in Section 5. **Not yet verified in-browser** — per the project's own recorded lesson from T5/RTT verification, an in-browser Playwright pass is the natural next step before treating this as fully proven.
The original finding (kept below for historical context on why this was bigger than a normal Phase B gating pass):
The manifest previously claimed (Section 5 header, "Next up" note) that AoW was "already the furthest along at the generator level (structural **and field-level** `seedSys` gating both present)." That was checked against the actual code on 2026-07-05 and the field-level half is false.
**What's actually true:** `aow_bottomup_generator.js`'s structural gating (star/world substitution, `_allowAddBodies` orbit-count gate, `_mainworldRef` lookup, correctly skipping `populateAoWWorldsList` so seeded worlds aren't clobbered) is genuine and works the same way CT's does. But `aow_world_engine.js` has **zero** `isManual()` calls — there was never an attempt at MgT2E/CT/T5-style per-field manual preservation — and the reason isn't just "not built yet," it's that **Phase 3 of AoW's pipeline can't run on seeded data at all today**: `generatePhysicals`, `generateOrbitalConditions`, `generateThermalAndWater`, `generateGeophysics`, `generateMagneticField`, `generateEarlyAtmosphere`, `generateAlbedo`, `generateCarbonDioxide`, `generatePresenceOfLife`, `generateAverageSurfaceTemp`, `generateFinalizeAtmosphere`, `generateHabitabilityScores`, and `generateUWPPhysicals` are all called unconditionally in `aow_bottomup_generator.js`, but each opens with `if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) return;` — and `sys.diskWorksheets` is populated **only** by `generatePlanetaryDisks`, the exact function `aow_bottomup_generator.js` skips whenever `seedSys` controls body count (`!seedSys._allowAddBodies`, the System Editor's default). AoW's internal planet representation (`diskWorksheets[].planets[]`, its own `planetType` field) has no bridge at all from the flat `sys.worlds[]` list that seeding writes into.
**Consequence:** every System-Editor Fill & Save on an AoW system (with the default checkbox state) would silently skip all physical/atmospheric/hydrographic/thermal/geophysical/UWP generation for every seeded or newly-added body. A brand-new body added via "+World" would end up with none of those fields set by anyone — not even freshly rolled ones, since the roll code never runs.
**Also confirmed, same audit:** `aow_uwp_auditor.js` — required/referenced by `aow_bottomup_generator.js`'s module factory and called in its Phase 6 — does not exist anywhere in the repo (`aow_socio_engine.js` also doesn't exist; AoW deliberately reuses `MgT2ESocioEngine` instead, which is a working design choice, not a gap). The audit call is permanently dead code (`activeAuditor` always resolves to `null`), not merely unwired.
**Decided with Sean (2026-07-05) and implemented same day:** option (a) — synthesize `diskWorksheets` from seeded bodies rather than accepting Phase 3 doesn't run (option b) — with two refinements that emerged during design discussion: (1) never jitter a user-set value (matches every other engine's convention), and (2) system age is derived to fit the chosen spectral type(s) rather than rolled independently, with a warn-and-proceed dialog if multiple stars' implied age windows don't overlap.
*Spec ref: Section 5's "AoW" subsection; supersedes the "field-level gating both present" claim in the v0.16.1 SEQUENCING header and the per-engine table in Section 5.*


**OW-65 — 🟡 OPEN / DEFERRED 2026-07-30 (three items deliberately parked pending evidence — do not restart these without new information)**

1. **Filter state appears stale across sessions — awaiting user retest.** Reported as "it holds filter rules across sessions, and you have to change something in the filter to get things to populate." **Could not reproduce.** The obvious hypothesis (browser form-restoration on reload leaving criteria displayed but unapplied) was tested and ruled out — headless Chromium did not restore the multi-select on `page.reload()`. Note the term is ambiguous between two subsystems: the transient filter **bar** (pure DOM, no persistence) and the **Rules Ledger** `window.activeFilterRules` (persisted by design into the sector JSON, reapplied via `reapplyAllRules()` on load). **Strong likelihood this was OW-64's invisible-criterion trap all along** — "you have to change something to get things to populate" is exactly what a stale hidden criterion produces. Parked for the reporting user to retest against the OW-64 build before any further work.

2. **File System Access API for saves — deferred.** Would replace anchor downloads with `showDirectoryPicker` for the chunked path, upgrading OW-62's honest-but-hedged reporting to real write confirmation (`await writable.close()` resolving means bytes landed). **Key design constraint if this is ever built:** `showSaveFilePicker` requires transient user activation, consumed by the first call — so N pickers for N chunks is *not* viable; it must be one `showDirectoryPicker` plus N writes through that handle. Verified that both APIs exist and `isSecureContext` is true on **both** `file://` and localhost in Chromium. Chromium-only, so the anchor fallback would be **permanent** — every FSA feature is two code paths forever, which is a high bar. Also unresolved: writing into a chosen directory silently overwrites same-named files, where the anchor path produces `(1)` suffixes. Playwright cannot drive native dialogs, so this needs manual verification. **Revisit trigger:** a user actually hitting the >250 MB chunked path.

3. **`JSON.stringify` size ceiling — deferred, but higher priority than item 2 if it ever bites.** `io_manager.js` builds the *entire* map as one string purely to compare its length against `SAVE_CHUNK_THRESHOLD`. V8 caps strings near ~512 M chars, so a large enough map throws `RangeError` **before** chunking can help — the feature that exists to handle huge maps is gated behind an operation huge maps break. Affects **all browsers**; a hard failure, not degraded reporting. **Symptom to recognise:** save silently does nothing on a very large map, console shows `RangeError: Invalid string length`. **Fix does not need FSA:** `new Blob([...])` accepts an **array** of parts and concatenates internally, so serialise in fragments, size-check by summing fragment lengths (or reading `blob.size`), and hand the array to `new Blob(fragments)` — one code path, every browser. Needs its own design pass to preserve the exact save format for backward compatibility.

**The one question that settles items 2 and 3 at zero cost:** ask the heavy user whether they have ever seen the *"your map is approximately N MB — it will be saved in N parts"* prompt, and how large their `traveller_map.json` actually is. Under ~250 MB, both stay parked indefinitely.

*Spec ref: Sean's explicit direction 2026-07-30 — "leave this until more users try it."*

### 6.3 Closed items index

Sixty-one closed items, one line each. Engine column is a hint parsed from the original
title, not authoritative. Full forensic detail was removed 2026-08-01; the patterns worth
carrying forward are in 6.1.

| Item | Engine | Closed | Summary |
|---|---|---|---|
| OW-1 | — | 2026-07-03 | Primary star validation gate deemed unnecessary |
| OW-2 | — | 2026-07-03 | Mainworld validation dialog deemed unnecessary |
| OW-4 | — | 2026-07-03 | `manually_edited: true` flag dropped as a requirement |
| OW-6 | MgT2E | 2026-07-04 | Seed-restoration matching logic lives in the MgT2E orchestrator, not an engine |
| OW-7 | MgT2E | 2026-07-04 | `MgT2EMath` guard inconsistency + duplicated auditor-logging block |
| OW-8 | — | 2026-07-04 | Per-engine adapter pattern for `js/system_editor.js` |
| OW-10 | CT | 2026-07-06 | two more places CT re-rolled already-generated data — satellite quantity, and the entire gov/law/starport/tl pass |
| OW-11 | CT/MgT2E | 2026-07-06 | blank "Create System" wasn't blank, and CT had no equivalent of MgT2E's moon-cap trim safety net |
| OW-12 | CT/MgT2E | 2026-07-07 | lunar mainworld's `isMainworld` flag never reached the System Editor, causing a second mainworld to be elected on Preview/Save |
| OW-13 | CT | 2026-07-07 | a Captured Planet could roll the exact same orbit number as a companion star, and even after that was fixed the two still rendered at the same radius in the orrery |
| OW-14 | CT | 2026-07-07 | Gas Giants have no natural "already generated" signal, so a no-edit Preview/Fill & Save silently mutated them — refines OW-10 Gap 1 |
| OW-15 | CT | 2026-07-09 | dragging a companion star in the System Editor moved it in the body list but not in the orrery |
| OW-16 | MgT2E | 2026-07-09 | editing a Belt's type/size away from Belt could crash Preview/Fill & Save with `Cannot read properties of null (reading 'toFixed')` |
| OW-17 | CT | 2026-07-09 | a companion star added via the System Editor's `+Comp` rendered in a different relative position on all three surfaces (Edit panel, accordion, orrery) |
| OW-18 | CT | 2026-07-09 | CT Edit System gap audit — `+Secondary`'s residual gap was worse than scoped, plus a rejected fix idea worth recording |
| OW-19 | — | 2026-07-16 | ✅ ROOT-CAUSED AND CLOSED 2026-07-16 (original framing was a false alarm; the real bug was a separate, more severe regression) — see OW-42 below for a second, genuinely new bug found during the same re-verification |
| OW-20 | CT | 2026-07-12 | a CT Captured Planet's name and moons weren't round-tripping through the System Editor, and its orbit field misleadingly read "auto" |
| OW-21 | — | 2026-07-12 | "+World"/"+GG"/"+Belt" could insert the new body in the middle of the orbit list instead of appending it at the true end |
| OW-22 | CT | 2026-07-12 | CT's "Seed UWP digits" Size box couldn't accept 'S' (Small) or 'R' (Ring) |
| OW-23 | CT | 2026-07-12 | CT's Gas Giant size (Large/Small) had no editor control, and existing bodies' size was misread on open |
| OW-24 | CT | 2026-07-12 | a manually-created CT moon (e.g. a Gas Giant's moon set as mainworld) never received physical stats — distance, gravity, mass, temperature, rotation, tilt all permanently blank |
| OW-25 | CT | 2026-07-12 | the orrery kept showing two CT bodies at the same orbit after one was moved via the System Editor, even after Preview/Save/close/reopen |
| OW-26 | CT | 2026-07-12 | a manually-typed CT mainworld UWP changed after Save |
| OW-27 | CT | 2026-07-13 | filling in several blank CT worlds out of order made the mainworld pick and rolled stats jump between bodies before Save |
| OW-28 | CT | 2026-07-13 | CT's +Belt gave no way to enter a UWP, and Fill & Save failed the UWP auditor |
| OW-29 | CT | 2026-07-14 | editing a CT companion star's Orbit # silently hid its own +World/+GG/+Belt buttons |
| OW-30 | CT | 2026-07-14 | a manually-created body orbiting a CT companion star got dice-rolled moons that were never trimmed back down |
| OW-31 | CT | 2026-07-14 | moons added to an already-generated CT parent never received physical stats |
| OW-32 | CT | 2026-07-14 | CT orrery now renders a Ring (moon size 'R') as a thin static ring instead of an orbiting dot |
| OW-33 | CT | 2026-07-14 | CT drag-and-drop reordering could silently corrupt an unrelated companion-star body's orbit |
| OW-34 | CT | 2026-07-14 | a CT companion star's own worlds re-rolled their entire UWP from scratch on every single Preview/Fill & Save |
| OW-35 | CT | 2026-07-14 | a CT moon's typed orbit distance reverted after every Preview, and the "Clear" button never actually triggered a re-roll |
| OW-36 | CT/MgT2E | 2026-07-14 | MgT2E Planetoid Belts can now have their Starport/Pop/Gov/Law/TL seeded, matching CT (OW-28) |
| OW-37 | CT/MgT2E | 2026-07-14 | MgT2E orrery now renders rings too, matching CT (OW-32) |
| OW-38 | MgT2E | 2026-07-14 | an already-generated MgT2E world's ring silently vanished on the very first Preview/Fill & Save, even with zero edits |
| OW-39 | — | 2026-07-16 | `system_editor.js`'s `_manualFields` mark/clear logic de-duplicated onto `core.js`'s real `markManual`/`clearManual` |
| OW-40 | — | 2026-07-16 | three more `system_editor.js` duplications collapsed — mainworld-name/commit tail, companion-orbit-by-separation constant, and the D/BD exotic-star rule |
| OW-41 | — | 2026-07-16 | shared UWP-seed-digit box builder and data-driven star "Derived Properties" panel |
| OW-42 | T5 | 2026-07-16 | a T5 system with only a mainworld (the minimal, most common case) ignored "Allow engine to add additional bodies" and rolled a full random inventory anyway |
| OW-43 | T5 | 2026-07-16 | a T5 body's moon count fluctuated randomly (not just grew) across repeated no-edit Preview/Fill & Saves |
| OW-44 | T5 | 2026-07-16 | the System Editor never actually generated a real UWP for a brand-new T5 mainworld at all |
| OW-45 | T5 | 2026-07-16 | a subordinate (non-mainworld) T5 body's government, law level, starport, and tech level re-rolled from scratch on every Preview/Fill & Save |
| OW-46 | T5 | 2026-07-16 | a System-Editor-placed or repositioned T5 companion star got a corrupted (`NaN`) `distAU` baked directly into the generated system |
| OW-47 | T5 | 2026-07-16 | T5 has no per-moon orbital-distance concept at all |
| OW-48 | T5 | 2026-07-16 | confirming a T5 "Create System" with zero bodies made it look like the editor had closed entirely |
| OW-49 | CT/T5/MgT2E | 2026-07-16 | the T5 System Editor now shows the star in the orrery immediately after Create, before any body is added — matching MgT2E/CT parity |
| OW-50 | T5 | 2026-07-22 | T5 systems with 5+ stars silently collapsed every star past the 4th onto "Far", and the OTU importer never decomposed spectral type at all |
| OW-51 | MgT2E | 2026-07-22 | MgT2E's cross-engine expansion of a 5+ star OTU import had the identical "Far" collision, plus no Companion concept at all in that path |
| OW-52 | T5 | 2026-07-23 | a T5 companion star's distance was calculated as *more* than Orbit 0 (0.2 AU) instead of "well inside" it |
| OW-53 | T5 | 2026-07-23 | changing a T5 star's Role to Companion rejected Orbit 0 for other bodies, and the companion rendered farther from the primary than the mainworld |
| OW-54 | — | 2026-07-23 | ⤺ reverted — gap-filling for a newly-added world on a non-primary star |
| OW-55 | — | 2026-07-23 | `+World`'s auto-placement now ignores companion/secondary stars entirely — a new world always goes right after the last WORLD, never detours past a star |
| OW-56 | T5 | 2026-07-23 | hovering a T5 Gas Giant in the orrery showed no tooltip at all, and none of its moons rendered |
| OW-57 | T5 | 2026-07-23 | re-saving a T5 system with a moon-mainworld spawned a phantom second Gas Giant, and the orrery showed the mainworld twice |
| OW-58 | T5 | 2026-07-23 | manually-added bodies on a star that also had OTU-imported bodies were silently dropped during generation — no error beyond a downstream "No Mainworld found" audit message when the dropped body happened to be the mainworld |
| OW-59 | — | 2026-07-24 | flagging a moon as mainworld on an already-placed Gas Giant duplicated that Gas Giant and its entire moon tree |
| OW-60 | — | 2026-07-24 | a Gas Giant's moons visibly sped up then abruptly slowed down in the orrery right after adding it, even though the end state was always correct |
| OW-61 | — | 2026-07-30 | the P2P waypoint builder was unusable at scale — list clipped, no memory, hex-only labels, no reordering |
| OW-62 | — | 2026-07-30 | route CSV export "extremely flaky"; investigation widened to every download in the app — all now share one routine |
| OW-63 | CT/T5/RTT | 2026-07-30 | the Stellar Info filter matched nothing at all in CT, T5, and RTT sectors — three of the five engines |
| OW-64 | — | 2026-07-30 | a filter criterion whose control had become unavailable kept filtering invisibly, hiding worlds with no visible cause |

**Bugs #1–#7 (2026-06-22 → 2026-07-01)** — the pre-OW numbering, all closed. #1 hex dot
vanishing after Fill & Save (not reproducible after the `_buildSeedSys` rework); #2 double
mainworld after adding a companion; #3 MgT2E companion `orbitId` lost on editor load; #4
orrery not updating after an orbit change (stale `b.au`); #5 gas-giant moon mainworld not
highlighted — root-caused to `generateAtmospherics` stamping `type = 'Satellite'`; #6 GG
symbol on systems with no gas giant; #7 "+GG"/delete not toggling the GG symbol. #6 and #7
are the source of pattern 8 above; #5 is the origin of the moon-type-preservation rule.

---

## 7. Future Release Notes

Nothing outstanding. The former contents — the T5 Gas Giant / body-list sync gap found
2026-07-01 — closed 2026-07-05 when `generateT5System()` gained its `seedSys` parameter
(seeded bodies placed before Phase 1, `_allowAddBodies` gating the rolled inventory, moon
counts capped via `generateT5Satellites`'s `capToExisting`).

**One deliberate carve-out worth remembering:** `restoreT5ManualFields` and
`generateT5SystemPreservingManuals` in `system_driver.js` were left untouched by that
work. They remain the implementation behind `ui_menus.js`'s right-click "regenerate T5
system" — a separate, still-valid path (bulk regeneration across selected hexes, no
System Editor working copy involved), distinct from the structural `seedSys` gating the
editor's Fill & Save uses. Do not consolidate them without checking that use case.
