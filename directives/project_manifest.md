# PROJECT AS ABOVE, SO BELOW - Feature Manifest

## WHAT THIS DOCUMENT IS FOR — read this before you read anything else

**This manifest exists for one reason: to bring an AI agent back up to speed after its context
has been cleared.** It is written for a reader who knows nothing about this project and is
about to change its code.

**It is NOT a project history, a changelog, or a record of work done.** `changelog.md`,
`README.md` and git history are the record. This is not.

It holds exactly **two kinds of item**:

1. **Past items that still matter today.** A design decision that constrains what you are
   allowed to change; a trap that will cost a session if it is rediscovered the hard way; an
   issue that is still open. A closed bug belongs here only if its LESSON still binds.
2. **Future items already agreed.** Work that has been decided on and not yet done, with
   enough context to start it without re-asking.

**Everything else must be deleted.** If an item is closed and has no bearing on any future
decision, remove it — do not strike it through, do not keep it "for the record". Strikethrough
is reserved for the rare case where the crossing-out IS the lesson: a retracted false alarm
that would otherwise be "fixed" again, or a design-spec line marked *do not implement this*.

**The test to apply whenever you are tempted to keep something:** *would an agent who has never
seen this project make a worse decision tomorrow without it?* If no, it goes. Length is a cost
paid by every future session, so prune as you work — leaving stale content in place is a defect
in this document, not a neutral act.

**So: an item still written down here is an item still live.**

---
**Version:** **v0.18.0 SHIPPED 2026-09-20 and is committed** — regional surface maps, five
changelog entries. That closed the terrain work begun 2026-09-11, so §0.0.A is now the RECORD
of a finished release rather than a work-in-progress section, and §0.0.0's candidate list is
retired as a release plan.
**v0.18.1 is OPEN. Its subject is IMAGE EXPORTS — system images and "world on a page" PDFs**
(Sean, 2026-09-21) — plus terrain updates as user feedback on v0.18.0 arrives. **Start at
§0.0.B**, which carries the agreed scope, the approved mockup and everything that mockup
proved. **Nothing is half-finished.**
Earlier: v0.17.2 (2026-08-19), v0.17.3 (08-27), v0.17.4 (09-01) and v0.17.5 (09-11) were the
routes series; v0.17.0 / v0.17.0.1 (08-03 / 08-04) were the exports series.
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 0.0 COLD START — read this first (updated 2026-09-21)

**v0.18.0 shipped on 2026-09-20.** Regional surface maps and the Tectonic/Classic terrain
model. **§0.0.A holds the constraints it left behind — treat them as law, not as history.**
They bind anything that touches a world image.

**IF YOU ARE STARTING FRESH, READ 0.0.C FIRST — it is the handoff written
2026-09-23 and it says exactly what is built, what is unverified, and what to do next.**

**v0.18.1 is open, and the active thread is THE SYSTEM SHEET — a one-page, print-style
reference sheet for a single system.** See **§0.0.B**, which carries the design direction, an
agreed scope, and the findings from a working mockup Sean approved on 2026-09-21
(*"I am very happy with your mockup image so we have an excellent starting place"*).

**Start there, and look at the mockup before writing anything** — it is a real artefact, not a
sketch, and it already answers the questions a fresh session would otherwise spend a day on.

**Every pre-work job from the v0.18.0 review is done.** The terrain directive is now
`directives/terrain_spec.md` — read it before touching any terrain code — and clean circles
list in travel order in the Route Systems panel AND the CSV export.

**Nothing anywhere is half-finished, and every open item has been ruled on.** The whole
outstanding list was worked through with Sean on 2026-09-21: two items were fixed and verified,
five were ruled and closed, and four became pre-work jobs — **all of which are now done or
have been dropped as requirements.** **Closed items were then
DELETED from this document** — so an item still written down here is an item still live.
Neither this document's System Editor content (§0.1 onward) nor the exports manifest is in
progress.

**Three things to know before you touch anything:**

1. **The terrain field version flag is the most dangerous thing in this codebase.** World
   images are never stored — they are recomputed from the seed on every view — so changing the
   field silently redraws every world in every sector anyone has ever saved. **Version 1 is
   frozen for good.** Read §0.0.A's "The terrain field version" before editing anything under
   `js/terrain_*` or `js/planet_renderer.js`, and run `utilities/verify_field_v1.html`
   afterwards.
2. **Route *forcing* was designed in full and then dropped** (2026-08-19 → 08-27). Older
   parts of this document and of `route_partial_spec.md` still carry its reasoning. §0.0.2
   says plainly what was built instead. Do not resurrect forcing without asking Sean.
3. **Git is Sean's — never touch it, not even to read.** He stages and commits everything
   himself. **Do not record commit hashes or the commit position in this document.** That was
   tried twice and was stale within a week both times; the hashes that used to sit here have
   been removed for that reason. If you need to know what is committed, ask him.

### 0.0.C HANDOFF — written 2026-09-23. START HERE.

**The system sheet is BUILT and works across every shape a real sector contains.**
`js/system_sheet.js`, reached from a **System Sheet** button in the orrery toolbar, saving a
PNG. §0.0.B carries the decisions; the census and the six fixes are recorded there in full.
**Do not re-derive any of it.**

#### THE ONE THING THAT MATTERS MOST: THE CORPUS IS ONE ENGINE

**Every system ever tested against this sheet was MgT2E, and every one was fully generated.**
Measured 2026-09-23 over `solo_6.json`: **438 of 438 systems MgT2E**, and **0 hexes that cannot
be charted** — every world has a complete generated system.

**So two whole classes of input have NEVER been run:**

1. **CT, T5, RTT and AoW.** `normalizeSystem` has a separate normaliser per engine returning
   genuinely different shapes — CT and T5 keep moons in `satellites[]`, not `moons[]` — and
   `system_sheet.js` reads `moons[]` throughout via `liveMoons()`. **Expect it to be wrong on
   four of the five engines.** `liveMoons()` is the single place to reconcile that.
2. **A world with a UWP and no generated system.** A TravellerMap import, or a System Editor
   world built as a mainworld and nothing else. `normalizeSystem` returns null, `render()`
   returns null, and the button refuses with "No system data to chart on this hex."

#### SEAN'S RULING, 2026-09-23: BUILD THE REDUCED SHEET

**A world with a UWP and nothing else must still produce a sheet** — mainworld panels and its
table row, with the orbital strip simply absent rather than the whole sheet refused. His words,
on being asked whether to refuse or reduce: *"I think a reduced sheet is a good idea."*
The reasoning that went with it: a referee asking for a handout on a world does not care that
its system was never rolled.

**Note this changes what `render()` returning null means.** Today null means "nothing to draw";
after this it should mean only "no world here at all".

#### NEXT SESSION, IN ORDER

1. **Sean is supplying saves from the other engines and a UWP-only sector.** Ask for the paths
   if they are not already given. Run `node utilities/system_sheet_gallery.js <thatSector>` on
   each — it censuses first, so it reports what the sector actually contains before rendering.
2. **Build the reduced sheet** per the ruling above.
3. **Then the single-body layout**, which is a design question and not a bug: one disc adrift
   in a very wide strip, an empty Satellites panel and a one-row table. See 18-F-1515 Bermarmi,
   the only single-body system in solo_6. *(The one real bug there is fixed: `step` is 0 when
   n === 1, so the label width collapsed to its 26 px floor and the world was captioned
   "M…" for "Mainworld".)*

#### THE HARNESSES ARE IN `utilities/` — they are not in a scratchpad this time

The terrain session lost its whole suite to a session scratchpad and this document still says
so. These were moved into the repo for that reason. **All four take an optional sector path and
default to solo_6 — PASS THE NEW SECTOR:**

| File | What it does |
|---|---|
| `utilities/system_sheet_gallery.js` | **The important one.** Censuses a sector (engine mix, bodies, moons, stars, name lengths, lunar mainworlds), then renders systems chosen by EXTREME — fewest/most bodies, longest name, most moons/giants/stars, lunar mainworld, widest/tightest. **Picking at random would have shown twenty ordinary systems and none of the five failures it actually found.** |
| `utilities/system_sheet_shoot.js` | Renders named hexes: `node utilities/system_sheet_shoot.js 18-E-0313 18-L-2623` |
| `utilities/system_sheet_verify.js` | Corpus assertion: no panel may drop a row; every mainworld is found |
| `utilities/system_sheet_binary.js` | Both companion branches, by stripping/injecting `orbitId` — solo_6 can only exercise one |

**`fetch` is blocked on `file://`.** Every harness reads the sector in node and injects it in
2,000-hex chunks. Do not "fix" that by fetching.

#### THE RULE THIS RELEASE KEEPS RE-LEARNING

**Any panel on the sheet that lays out a variable number of rows must DERIVE its pitch from the
row count, and no row loop may stop without announcing that it did.** Four panels had the same
silent-drop defect — planetary table, System Data, Mainworld Data, mainworld brief — and **two
were introduced while fixing the first.** Three of the four were found by whole-corpus checks,
not by looking at a sheet. **A new panel must be assumed to have this bug until a corpus run
says otherwise.**

#### STILL OPEN AFTER THE ENGINE WORK

* **Exporter wiring**, where the disclosure gate is the whole job — an image can only be
  withheld by not generating it (§0.0.B's traps, `directives/fog_of_war_field_tags.md`).
* **PNG vs JPEG**, still parked. A sheet is ~400 KB–1.1 MB; it matters once a sector-wide
  export multiplies that by the world count. Three `toBlob` call sites.

---

### 0.0.B v0.18.1 — IMAGE EXPORTS (open, written 2026-09-21)

**This supersedes §0.0.0.** Sean named the subject on 2026-09-21: **"more image exports"**,
specifically **"system images and 'world on a page' PDFs"**. Over that day the shape was
settled by building a mockup and ruling on it: **the active work is a SYSTEM SHEET, screen
resolution, PDF deferred, single-star with no gas giants or moons to begin with.** The scope
table, the mockup and its findings are below. **Read them before writing code — most of the
expensive questions are already answered.**

**No v0.18.1 application code has changed yet.** The working tree carries the version bump
(`APP_VERSION` in `js/core.js`, `changelog.md`, `README.md`, `hex_map.html`), the moon-sheet
export fix in `js/html_exporter.js` and `js/obsidian_exporter.js`, and the terrain-rivers
cleanup — all recorded below and in `changelog.md` under v0.18.1.

#### What already exists — established by reading the code 2026-09-21, so nobody re-derives it

* **System images already ship in BOTH exporters.** `SystemViewer.renderSnapshot(state, 900,
  500, { level })` is called at `js/html_exporter.js:1031` and `js/obsidian_exporter.js:639`.
  It draws the orrery to an **off-screen** canvas and returns PNG bytes. It is careful code:
  it saves and restores **seventeen** module-level variables around the draw, forces `T=0` so
  body positions are deterministic, forces dark mode, and **gates the mainworld highlight on
  disclosure level (g)** — a coloured body identifies the mainworld as loudly as a caption
  would. So "more system images" is an EXTENSION of something that already works, which makes
  defining the scope the first job rather than the last.
* **World images and regional survey sheets also already ship**, through
  `ExportCore.canRenderImage` / `pinnedSitesFor` / `renderRegionalSheet` (v0.18.0, §0.0.A
  decision 4).
* **There is no PDF capability anywhere in this repo.** The only match for "pdf" in the whole
  tree is a URL string inside `js/foreven_mixon_data.js`. Both exporters build a **ZIP by
  hand** — `crc32` and `buildZip` at the top of `js/export_core.js` — and hand it to
  `downloadBlob`. A PDF is therefore genuinely new, and this project **has no build step, no
  bundler and no runtime dependencies**: a PDF library would have to be vendored into the repo
  and added as a `<script>` tag in `hex_map.html`, which would be a first. The alternative — a
  print stylesheet and the browser's own "Print to PDF" — costs nothing and adds no dependency,
  but gives up control of pagination and of the file's name.

#### DECIDED 2026-09-21 — the page is built on the BLOCK MODEL

**The first real v0.18.1 ruling, and it settles more than it looks like it does.** "World on a
page" takes its content from **`ExportCore`'s block model** — the same blocks both exporters
already render — and NOT from the on-screen panels.

Two things fall out of it, which is why it was worth deciding before the questions below:

* **Fog of war is inherited rather than re-implemented.** `filterBlocks()` only ever sees
  blocks; a page assembled outside the block model would have to re-derive every disclosure
  decision by hand, and the first trap in this section says what that costs. Building on blocks
  means the page is filtered by the mechanism that already works.
* **Numbers arrive already rounded.** The exporters format every numeric field through
  `ExportCore.fmtNum`, so a page built on blocks inherits consistent precision instead of
  having to impose it.

**This does not answer question 2 below.** Where the page is DELIVERED — an in-app download, a
file inside the existing exports, or a third exporter — is still open. Only its data source is
settled.

#### SCOPE AGREED 2026-09-21 — start here

Sean set the direction after seeing the mockup. **These are decisions, not guesses:**

| | Ruling |
|---|---|
| **What a "system image" is** | A **system sheet**: one system, one page, landscape, dark, dense — an orbital strip of rendered bodies plus data panels. Sean's reference is `C:\Users\sean\Downloads\2.jpg` (a Kteiroa "ORBITAL MAP" sheet, hand-made). **Look at it.** |
| **Resolution** | **Screen first.** Print was explicitly deferred — *"my inclination is to start with just the screen."* This is what makes disc quality tractable; see the supersampling finding below |
| **PDF** | **Not now.** *"We don't have to worry about PDF right now. Let's focus on images."* The routes and their costs are recorded below for when it returns |
| **Multi-star systems** | **Assume none for now.** Sean: *"we're going to have to work together on how to handle multi star systems"* — it is the single biggest layout unknown and he wants to design it jointly |
| **Gas giants and moons** | **Assume none for now.** *"we're gonna have to come up with [an answer] ourselves"* — a design job, not a lookup |
| **Missing stats** | **Ignore them.** *"If they happen to have stats that we don't have I'm not worried about it, we'll just use the stats we have."* Do NOT invent jump shadow, comm range, metallicity or average TL |
| **Data source** | The block model — see the ruling above |

**Still genuinely open:** PNG vs JPEG (parked, and cheap to change — three `toBlob` call sites),
and what fills the space where the reference has hand-written lore.

#### THE MOCKUP — built and approved 2026-09-21. Look at it first.

**Files: `C:\Users\sean\Downloads\system_sheet_mockup\`** — deliberately outside the repo.

| File | What |
|---|---|
| `system_sheet_mock.png` | The approved image, 3440x1756 |
| `system_sheet_mock.html` | **Live source.** Open in a browser and the discs render for real, loading `js/planet_renderer.js` and `js/terrain_tectonics.js` by absolute `file:///` path |
| `mock_data.js` | Real data for **Makarov, hex 18-E-0313**, extracted from `sectors/solo_6.json` |
| `shot.js` | Playwright screenshot driver |

**It is HTML/CSS + canvas.** Edit the CSS, reload, see the change — that is the fastest way to
move the look without rebuilding anything.

#### WHAT THE MOCKUP PROVED — do not re-derive these

* **NO PLUGIN, LIBRARY OR EXTERNAL PROGRAM IS NEEDED.** Sean's opening assumption was that one
  would be. It is not: every disc on that sheet came out of
  `PlanetRenderer.renderApproachFrame(canvas, worldData, hexId, lonOffset)`, which draws a lit
  sphere to **any canvas at any size**. This was demonstrated, not argued.
* **SUPERSAMPLING IS THE TECHNIQUE THAT MAKES SMALL DISCS WORK.** Render each disc at **3x** the
  display size and let the browser downscale (`canvas.width = px*3`, `style.width = px`).
  Terminators and coastlines stay clean at 34-74 px. Rendering at native size does not.
* **DISC SIZE MUST BE LOG-SCALED AND CLAMPED, never true scale.** The mockup maps
  1,600-17,600 km onto 34-74 px logarithmically. A 1,600 km rock reads as a pebble beside a
  17,600 km world without vanishing.
* **ORBIT SPACING IS ORDINAL, not distance-proportional.** 0.72 AU to 26.32 AU sit evenly and
  the AU labels carry the truth. Proportional spacing bunches everything against the left edge.
* **The mainworld needs a highlight** — a green ring plus a coloured name. It is what makes the
  strip scannable.
* **One semantic colour set, reused in three places** — legend, table gutter, and the Band
  column — is what makes the sheet read as systematic rather than decorated.
* **Use OUR temperature bands, not the reference's.** `PlanetRenderer.tempBandFromKelvin` gives
  Frozen <230, Cold <265, Cool <290, Temperate <330, Warm <360, Hot >=360. The reference image
  uses different names and boundaries. Ours are already baked into every world-image palette, so
  a planet's colour dot must agree with how that planet actually looks.

#### THE ARCHITECTURAL FORK — DECIDED 2026-09-21: CANVAS

**Sean ruled CANVAS**, against the lean this document previously recorded toward HTML/CSS.
The reasoning, so it is not re-litigated:

* **He asked for images, and a page is not one.** An HTML page prints well and drops into the
  wiki export, but it cannot go into Obsidian, a VTT or a message to a player as a picture.
* **Canvas REPLACES something; HTML would have ADDED something.** A 900x500 system snapshot
  PNG already ships in both exporters (`html_exporter.js:1040`, `obsidian_exporter.js:651`,
  both calling `SystemViewer.renderSnapshot`). The sheet is that thing done properly. As a page
  it would have sat beside the snapshot rather than superseding it.
* **The canvas text precedent was larger than expected.** `terrain_frame.js:355` already has
  the key/value row the star and mainworld panels use, and `:404` the label-plus-percentage row
  the temperature key uses, plus titles, footers and scale bars. Most of the left and right
  columns were a pattern that already worked.

**What was given up:** free print-to-PDF. Accepted — PDF is deferred, and a canvas PNG on a
print stylesheet reaches it anyway.

**DELIVERY — DECIDED 2026-09-21: in-app download FIRST, exporters second.** This answers
question 2. A **System Sheet** button sits in the orrery toolbar (`system_viewer.js`, guarded on
`window.SystemSheet` exactly as the flat-map panel guards on `window.TerrainPanel`) and saves a
PNG, mirroring the regional map panel's **Download PNG** (`terrain_panel.js:794`). The reason is
the feedback loop: judging the sheet means looking at twenty systems, which costs a click this
way and a full sector export the other way. It also keeps the first pass clear of the fog of
war entirely — an in-app download is the user looking at their own map. **Wiring it into the
exporters is a second step, and the disclosure gate is the whole of that step.**

#### AS BUILT — `js/system_sheet.js`, 2026-09-21

`SystemSheet.render(state, hexId, opts)` returns a canvas; `SystemSheet.download(state, hexId)`
saves it. **1720x878 LOGICAL units drawn through a scale transform**, default scale 2 = the
mockup's 3440x1756. Change `SCALE`, never the layout numbers.

**THE DATA SOURCE IS `SystemViewer.normalizeSystem(state)`, NOT the block model.** This
knowingly departs from the ruling recorded above, and the reason is shape: blocks are
pre-formatted label/value PAIRS (`f('Gravity', '0.47 G')`), and a sheet needs `gravity` as a
NUMBER to scale a disc, sort a column and place a body on an axis. normalizeSystem returns
exactly that, reconciled across all five engines, and **it is what the orrery itself draws
from — so the sheet and the orrery agree about a system by construction.** The ruling's two
justifications both survive anyway: numbers still go through `ExportCore.fmtNum`, so precision
matches the exports to the digit; and fog of war is a GENERATION-TIME gate, which works
whatever the data source. **The block-model ruling still stands for "world on a page"**, which
is a linear document and the shape blocks were built for.

**Two traps in `PlanetRenderer.renderApproachFrame`, both hit, both now commented in place:**

1. **The third parameter is NAMED `hexId` and is actually the whole per-body SEED KEY** — every
   seed inside is `masterSeed + '-' + <that> + '-xx'`. Passing a bare hexId gives **every body
   in the system the same heightfield, continents and craters**: eight identical planets in a
   row, which is exactly what the first render produced. Pass
   `PlanetRenderer.imageSeed(hexId, world, fallback)`, which is keyed on the body's NAME.
2. **It does not accept a normalizeSystem world.** It reads `atmosphere` and `hydrographics` as
   parsed UWP digits plus `temperatureK` — none of which that shape carries — so `_buildPalette`
   classified every body as an airless rock and **the whole strip came out grey.**
   `ExportCore._rendererData` was the existing adapter and was private; it is now **exported as
   `ExportCore.rendererData`** so the sheet uses the same definition as the world images and the
   regional sheets rather than growing a second copy.

**NO HABITABLE ZONE BAND, and do not add one from luminosity.** `normalizeSystem` falls back to
`_orbitToAU(3)` when `sys.hzco` is absent, which it is throughout `solo_6.json` — so **every**
system claims an HZ at 1.00 AU, including Makarov's M0 III at luminosity 330. The mockup's
`sqrt(luminosity)` was invented, not RAW. Real sources are `MGT2E_HZ_DEVIATION`
(`js/constants.js`) and CT's `hasHZ`/`hzOverride`. Until one is wired in the band stays off,
per Sean's ruling that missing stats are simply not shown.

**Belts ARE handled**, though moons and gas giants are not. Without belt support the moonless
single-star test corpus is one system rather than three — Alayor II is a Planetoid Belt. A belt
is drawn as a seeded flattened scatter, never as a sphere, and its diameter/gravity cells read
`—` rather than 0.

**Three layout rules that came out of rendering it, not from the mockup:**

* **Every disc gets a faint radial SEAT.** An airless rock is genuinely very dark and its limb
  vanishes against a near-black panel — magnified, Alayor's 1,600 km mainworld was a perfectly
  good cratered world that read on the sheet as an empty ring.
* **The mainworld ring offset SCALES with the body.** At a fixed +7 px with a 5 px glow it was
  1.5x the width of a 30 px disc and outshouted the world it was pointing at.
* **The table panel is sized to its CONTENT.** A full-height box under an eight-row system
  leaves a quarter of the sheet as an empty bordered rectangle, and a three-body system is far
  worse. This is the content-density finding, addressed for the table; **the mainworld brief
  still has visible slack and is the remaining case.**

**Measured, all three test systems:** 3440x1756, **0.96–1.10 MB**, **2.6–3.6 s** to render, no
page errors. Size is worth watching if the sheet ever enters a sector-wide export — see the
size trap above.

**Still to do:** the ~20-system gallery as the real quality test (one good example proves
nothing); multi-star, gas giants and moons, all of which Sean wants to design jointly; and the
exporter wiring with its disclosure gate.

#### THE GALLERY CENSUS — RUN 2026-09-21 OVER `solo_6.json`. READ THIS BEFORE PLANNING ANYTHING.

**438 systems with body data. TWO of them — 0.5% — fall inside the sheet's agreed scope.**
That single number retires the scope assumption recorded above. "Assume no gas giants or moons
for now" is not a simplification of the problem; it is a description of a system that barely
exists.

| | count | share |
|---|---|---|
| **In current scope** (1 star, 0 gas giants, 0 moons) | **2** | **0.5%** |
| Has gas giant(s) | 431 | **98.4%** |
| Has moon(s) | 432 | **98.6%** |
| **MAINWORLD IS A MOON** | 257 | **58.7%** |
| Multi-star | 79 | 18.0% |
| Has belt(s) | 134 | 30.6% |

Bodies per system: min 1, **median 8, p95 11, max 16.** Longest body name: median 13, **p95 22,
max 25.** All 438 are MgT2E — this sector exercises one engine, so the other four are still
untested against a real corpus.

**The three systems this document nominated as the test corpus are not representative and were
never going to be.** They were selected FOR being unusual.

#### FIVE FAILURES THE GALLERY FOUND — none visible on the three nominated systems

1. ~~**A LUNAR MAINWORLD PRODUCES AN EMPTY SHEET.**~~ **FIXED 2026-09-21.** Both mainworld panels read
   "No mainworld recorded" and a third of the sheet is blank. `system_sheet.js` finds the
   mainworld with `bodies.find(isMainworld)` over `nsys.worlds`, and a mainworld that is a moon
   lives in `world.moons[]`, which that search never visits. `normalizeSystem` deliberately
   re-tags such moons as type `Mainworld`, so **the data is right and the lookup is wrong.**
   This is the recurring shape in this codebase — a secondary list invisible to a function —
   and it is the same one that produced the CT captured-planet and moon-type bugs.
2. ~~**GAS GIANTS ARE DRAWN AS ROCKY TERRESTRIAL WORLDS.**~~ **FIXED 2026-09-21.** Every gas giant goes
   through `renderApproachFrame`, which draws a lit rocky surface, so a 50,000 km gas giant
   renders as a big grey cratered moon. They also carry no UWP, so the UWP column reads `—`,
   and they all share one diameter (50,000 km) so they all clamp to the same disc size.
3. ~~**THE TABLE SILENTLY DROPS ROWS.**~~ **FIXED 2026-09-21.** Nidau (18-P-2632) reports
   "Catalogued Orbits 16" in the System Data panel and lists **12** — the row loop stops at the
   panel edge with `if (rowY > y + h - 12) return;`. **A sheet that quietly omits four worlds is
   worse than one that fails**, and it is the same class of defect as the route panel listing
   3 of 6 worlds in v0.17.4.
4. ~~**THE ORBITAL STRIP COLLAPSES BEYOND ~10 BODIES.**~~ **FIXED 2026-09-21.** At 16 the discs overlap, every name
   truncates to "Nidau …" and the AU labels run together into one unreadable line. The strip
   was laid out against an eight-body system, which is the median — so it breaks on the top
   half of the distribution.
5. ~~**MOONS ARE ABSENT ENTIRELY.**~~ **FIXED 2026-09-21.** Currently silent rather than wrong, which
   was the agreed behaviour — but at that share it means the sheet omits real content almost
   always.

#### FIXES 1 AND 2 — DONE 2026-09-21, VERIFIED OVER ALL 438 SYSTEMS

Both were correctness rather than design, so they were taken without a design pass.

**The lunar-mainworld lookup.** `findMainworld(bodies)` returns `{ body, parent }` and searches
`worlds[]` then every `world.moons[]`. **The rule it establishes, and the one every future
consumer must follow: the ORBIT belongs to the parent, the physical STATS belong to the body.**
Getting that wrong is not hypothetical — the first cut of the fix printed "Orbital Distance
0.005 AU" and "Year Length 0 standard years" in the Mainworld Data panel, which is the moon's
circuit of its own planet rounded away and presented as its orbit of the star. The panel now
labels those rows "Primary's Orbital Distance" / "Primary's Year Length" and adds "Orbits" and
"Distance from Primary". The strip rings the PARENT and names the moon beneath it.
**A second follow-on the fix created and closed:** the populated-bodies count walked only
top-level bodies, so a sheet whose entire subject is a populated lunar mainworld announced
"0 of 16 bodies are populated". It now counts moons too.

**The table pitch.** Derived from the body count, clamped to 16–29 px, with the font following
it down (12/11/10 px). Capacity runs 11 rows at the comfortable pitch to 21 at the tightest.
The `rowY > y + h - 12` guard is kept as belt and braces but now **announces** an omission in
red instead of returning silently — the rule is that the table must be structurally incapable
of dropping a row, and a guard that can only ever shout is how that is proved.

**Verified across the CORPUS, not a sample** (`scratchpad/verify_rows.js`): 438 systems checked,
**0 would drop a row**, **257 mainworlds found via the moon lookup** — matching the census
exactly — and **0 systems left with no mainworld**. Nidau now lists all 16 of 16 rows under a
System Data panel reading "Catalogued Orbits 16".

#### FIXES 3 AND 4 — DONE 2026-09-21. They had to be taken together.

They interact: a gas giant must be drawn LARGER to read as a giant, which makes crowding worse,
so sizing and spacing could not be settled separately.

**Gas giants — `drawGasGiant()` in `js/system_sheet.js`.** Seeded latitudinal bands from one of
five palettes, slight oblateness, a storm oval on about half of them, then limb darkening and a
terminator lit from the upper left — the same direction `planet_renderer` lights everything
else from, so a giant and a rock on one strip agree about where the star is.

* **IT DELIBERATELY DOES NOT LIVE IN `planet_renderer.js`.** That file is behind the frozen
  terrain-field guarantee (`directives/terrain_spec.md` §3) and a gas giant needs none of its
  heightfield machinery. Keeping the banding out of it means `verify_field_v1` is untouched.
* **Gas giants get their OWN size band, 84–108 px, which does not overlap the terrestrial
  34–76.** Sharing one scale is not an option: every gas giant in solo_6 reports exactly
  50,000 km, so on the terrestrial curve they all clamp to the same value as a large rock. The
  non-overlap guarantees the one thing true of all of them — any giant is larger than any rock.
* **It made the sheet much FASTER, which was not the point but is worth knowing.** Giants no
  longer go through the per-pixel sphere renderer: Starrfield (13 giants) fell from **1,653 ms
  to 47 ms**, and Nidau from 1,630 ms to 205 ms.

**The strip — three changes, and the first is worth more than the other two.**

1. **DROP THE SYSTEM NAME FROM THE LABEL.** "Nidau A-I" through "Nidau A-XVI" repeats the
   sheet's own title sixteen times and was the entire reason names truncated to "Nidau …".
   Stripping it takes a label from ~12 characters to 3–5 and costs nothing. **Two guards it
   needs:** never strip to nothing, and — because a mainworld is very often named exactly after
   its system — label that case "Mainworld" rather than falling back to a name that then
   truncates anyway ("Royal Leami…").
2. **Scale the disc SET to the column, not each disc.** Natural sizes are computed first, then
   the whole set is scaled so the largest fits with a gap. Scaling the set preserves the
   relative sizes, which is the only thing the sizes exist to convey.
3. **Stagger the AU labels** onto two interleaved rows when a column is narrower than its label.

**Verified over the same extremes** — Nidau at 16 bodies and 9 giants, Starrfield at 14 bodies
and 13 giants, Gokumenon at 5 stars, Royal Leamington S at a 25-character name. No page errors,
nothing truncated, no overlap.

#### FIX 5 — MOONS, DONE 2026-09-21. The numbers decided the design.

**FULL ENUMERATION IS ARITHMETICALLY IMPOSSIBLE.** Measured over solo_6: moons per system run to
a **median of 19**, p75 27, p95 40 and a **maximum of 64**; **65.5% of systems carry 16 or more**.
Listing every moon needs a median of **27 rows and up to 76**, against a planetary table that
holds **21 at its tightest pitch** — so the MEDIAN system already overflows. Write that down
before anyone proposes indenting moons under their parents.

So the question is never "how do we fit the moons"; it is **"which moons earn a row"**, with
everything else carried as a COUNT. Nothing is hidden — only the detail is rationed:

* **A `Moons` column in the planetary table**, and a **`Satellites` total in System Data**.
* **A moon count under every disc on the strip.**
* **A `Satellites` panel** listing one group in full: the mainworld's siblings when the
  mainworld is a moon, its own moons when it is a planet, and otherwise the richest satellite
  group in the system. Sorted largest first, with "N further satellites not listed — M in
  total" whenever it elides any.

**"Populated" was the obvious filter and it does not work.** MgT2E populates moons freely —
Starrfield reports **33 of 67 bodies populated** — so that filter selects almost everything and
blows the budget. **Proximity to the mainworld** is the filter that does work.

**The Band Key panel was deleted to make room**, and it should have gone anyway: it repeated the
six bands the header legend already listed, adding only the Kelvin ranges. Those ranges moved
into the legend. One definition, stated once.

#### THE SILENT-ROW-DROP DEFECT HAS NOW APPEARED THREE TIMES IN THIS ONE FILE

Worth stating as a rule rather than as three bugs, because the third was found by a
whole-corpus check rather than by looking at a sheet:

1. **The planetary table** — printed "Catalogued Orbits 16" above twelve rows.
2. **System Data** — the moment a `Satellites` row was added, "Outermost Orbit" stopped being
   drawn. Fixed by splitting the panel into two columns.
3. **Mainworld Data** — nine rows of space, and a LUNAR mainworld needs eleven, so **"Liquid"
   and "Trade Codes" were never drawn** and nothing said so. Invisible on any ordinary system;
   it only appears on the 58.7% with a lunar mainworld, and only in the last two rows.

**THE RULE: any panel on this sheet that lays out a variable number of rows must DERIVE its
pitch from the row count. Never assume the count fits, and never `break` out of a row loop
without announcing it.** All three now derive their pitch, and each keeps its edge guard purely
as a loud fallback — a guard that can only ever shout is how "cannot drop a row" is proved.

**Verified over all 438 systems** (`scratchpad/verify_moons.js`): planetary table overflows **0**,
System Data needs 136 px of 140, largest single satellite group is **8** against a Satellites
panel capacity of 5 — so the elision line is exercised and correct.

#### FIX 6 — MULTI-STAR, DONE 2026-09-21. And the data forced the design.

**A COMPANION'S ORBIT MAY SIMPLY NOT BE RECORDED, AND solo_6 IS THE CASE THAT PROVES IT.** The
shipped engine writes `orbitId` and `separation` onto every companion
(`mgt2e_stellar_engine.js` ~815), but `solo_6.json` is a **v0.13.3** file written before those
fields existed: all **86 of its companions carry only a `role` WORD** — "Very Close", "Close",
"Moderate" — plus `mao`. There is **no RAW table in MgT2E mapping those words to a distance**,
so placing such a star on the orbit axis would state an invented figure as fact, exactly as the
mockup's `sqrt(luminosity)` habitable zone did. **Both branches are therefore built:**

| | |
|---|---|
| `orbitId` present (a modern save) | The companion is **placed on the strip** at `SystemViewer.orbitToAU(orbitId)`, interleaved with the bodies by distance, drawn as a gold ✶ with a star glow, its spectral type and role beneath, and its AU below that |
| `orbitId` absent (a legacy save) | The companion is **named in the star panel** with its role word and **no position at all**, and the panel states **"N (orbits not recorded)"** |

**`!= null`, never `!== null`** — legacy saves omit the key entirely, so both null and undefined
occur. This is the trap already recorded under "Legacy saves omit fields"; this is its second
confirmed sighting.

**`SystemViewer.orbitToAU` was EXPORTED for this** rather than copied. Note the deliberate
difference from the private `_starCompanionAU` beside it: that one falls back to
`s.orbitId || 0.5` for a star with no recorded orbit, which is fine for laying out an orrery
and **not** fine for a printed sheet. The export carries a comment saying so.

**ORBIT NUMBERS BELONG TO BODIES ONLY.** A companion on the strip does not consume an index, or
the strip and the planetary table would stop agreeing about which world is orbit 7.

**In the star panel:** the title becomes "Stars", the primary's glyph shrinks and lifts, and the
companions are drawn beneath it as small glyphs with their type and either their AU or their
role. A `Companions` row joins the primary's stats.

**TESTED ON BOTH BRANCHES, because solo_6 can only exercise one**
(`scratchpad/test_binary.js`): Gokumenon (5 stars) and Normannia (2) each rendered twice, once
with `orbitId` stripped and once with the values the shipped engine writes. Legacy placed **0**
companions on the strip and said so; modern placed **4** and **1** respectively, correctly
interleaved. No page errors on any of the four.

#### A FOURTH SILENT ROW-DROP — and the rule now has four instances behind it

`_mainworldBrief`'s bullet loop was the fourth: `if (ly > y + h - 14) break;`, silent. It now
announces. **Four panels on one sheet had the same defect** — planetary table, System Data,
Mainworld Data, mainworld brief — and two of them were introduced *while fixing the first*.
**THE RULE, restated because it keeps earning its place: any panel here that lays out a
variable number of rows must DERIVE its pitch from the count, and no row loop may stop without
saying that it did.**

#### WHAT THE CENSUS CHANGES

**Gas giants and moons are not a later phase; they are the feature.** The order that follows
from the numbers, rather than from the original scope:

1. ~~The lunar-mainworld lookup.~~ **DONE.**
2. ~~The table must never drop a row.~~ **DONE.**
3. ~~Gas giants.~~ **DONE.**
4. ~~The strip must hold 16 bodies.~~ **DONE.**
5. ~~Moons.~~ **DONE** — option B (count everywhere, detail for the mainworld's neighbourhood).
6. ~~Multi-star.~~ **DONE.** Full account above. What follows was the plan before it was built.
   **Multi-star** — was the only item left. **And it is really a BINARY problem:** 75 of the 79
   multi-star systems are exactly two stars; 3+ stars occurs **four times in the whole sector**.
   The data already carries `parentStarIdx` and `orbitType` (S-Type/P-Type) on every body, so
   which star a world orbits is a lookup rather than a derivation. Agreed approach, not yet
   built: **companions listed in the Primary Star panel, AND drawn on the existing strip as a
   star glyph at their own ordinal position**, rather than a second strip — which would pay a
   permanent layout cost for 17% of systems.

**The harness is `scratchpad/gallery.js`** — it censuses a sector, picks systems by EXTREME
(fewest/most bodies, longest name, most moons/gas giants/stars, lunar mainworld, widest and
tightest) rather than at random, and writes `census.json` beside the sheets. **Re-run it after
any layout change.** Picking at random would have shown twenty ordinary eight-body systems and
none of the five failures above.

#### FINDINGS THAT WILL BITE — from actually building it

* **CONTENT DENSITY IS THE REAL PROBLEM, NOT RENDERING.** The reference looks dense because it
  carries **hand-written lore** ("Once known as Stross…") that we cannot generate. The mockup has
  visible empty space in the mainworld panel, and a sparser system will be worse. Either derive
  more content or make the layout adapt to how much there is.
* **FIELD NAMES LIE. VERIFY SEMANTICS, NEVER ASSUME.** The mockup printed "Number of Worlds:
  960" from a field literally called `totalWorlds`. The system has **8**. At sector scale a sheet
  will do this silently on any field nobody checked.
* **A CANVAS BITMAP MUST MATCH ITS DISPLAYED BOX.** A 1990x1180 bitmap in a 1120x330 box squashes
  everything drawn on it by 3.6x vertically — the orbit axis survived, the habitable-zone label
  compressed into invisibility, and it read as "the canvas is not drawing". Size the bitmap from
  `getBoundingClientRect()` after layout.
* **THE HABITABLE ZONE NEEDS REAL ENGINE DATA.** The mockup uses `sqrt(luminosity)`, which is
  **invented and not RAW** — it is why the band lands awkwardly off the right edge. The real
  sources are `MGT2E_HZ_DEVIATION` (`js/constants.js`) and CT's `hasHZ` / `hzOverride`.
* **ONE GOOD EXAMPLE PROVES NOTHING. Render a gallery of ~20 wildly different systems as the
  actual quality test.** The reference was laid out by hand for one system, under no obligation
  to be repeatable. Ours must hold up automatically across a whole universe, with unpredictable
  name lengths and body counts.
* **Makarov is a POOR showcase, and that is itself a finding.** Its M0 III giant puts six of
  eight worlds in the "Hot" band, so the sheet reads very red. It is real, not flattering.
* **`solo_6.json` contains only THREE single-star, no-gas-giant systems**, so the simplified
  scope has a small test corpus: **18-E-0313 Makarov** (8 worlds, 0 moons — the mockup),
  **18-L-2623 Alayor** (8 worlds, 0 moons), **18-B-1402 Waihi** (9 worlds, 3 moons).

#### Three traps this release walks straight into

* **An image is opaque to the fog of war, and a PDF is worse.** `filterBlocks()` only ever sees
  *blocks*; it cannot look inside a PNG, and it cannot look inside a page assembled outside the
  block model either. The only way to withhold an image is **not to generate it**, which is why
  v0.18.0's sheets sit inside the existing `_show(oLV, 'e')` gate. **Every image, and every page
  of a PDF, must be filtered at GENERATION time.** See `directives/fog_of_war_field_tags.md` and
  §0.0.A's decision-4 note.
* **Test an exporter by exporting.** The Obsidian export was broken for three days by one
  missing parameter while `node --check` and every piece-level assertion passed. Stub
  `downloadBlob`, scan the bytes for `PK\x03\x04`, read the member names and bodies out of the
  ZIP's local headers — and **watch it fail first.** Full account in §0.0.A, 2026-09-17.
* **Size.** A regional sheet is **~1.0 MB**; a system snapshot is a 900x500 PNG. A per-world
  page multiplies whatever it embeds by the number of worlds in the sector. The levers are
  plate resolution and JPEG-instead-of-PNG. Decide before, not after, somebody exports a
  1,600-world sector.

#### PRE-WORK — ALL DONE, nothing outstanding

**Every pre-work job from the v0.18.0 review is finished.** The three below are kept only
because each names a contract or a measured consequence that still binds. **The active thread
is the system sheet above.**

1. ~~**Write the terrain directive.**~~ **DONE 2026-09-21 — `directives/terrain_spec.md`.**
   17 sections, every cited line number verified against the code. §0.0.A above is now
   secondary to it. *(Original scope note kept below, because it is also the spec's own
   table of contents.)* Every prior series has one (`route_*_spec.md`,
   `html_extract_manifest.md`); the terrain work has only §0.0.A, which is a session log rather
   than a specification. **Sean chose to write it BEFORE v0.18.1** because v0.18.1 touches
   exactly this code and needs a contract to build against rather than a diary to reconstruct
   one from. Scope: the
   shipped v0.18.0 system, stated as rules — the field-version contract and the v1 freeze, the
   `sheetSetup` / `renderSheet` contract the panel and both exporters share, the pin storage
   shape on the hex state, the deliberately duplicated climate predicates, the guard that must
   stay identical in two places, and the rule that an image can only be withheld by not
   generating it.
2. ~~**Order clean circles in the Route Systems panel.**~~ **DONE 2026-09-21**, extended to
   the CSV export on Sean's instruction (*"circular point to point routes should be in order
   when the destinations are exported"*) — both consumers read the one `getRouteSystemList`,
   so the export came with it. `walkRouteCycle` in `js/routes.js` is the third chain test;
   `directives/route_extend_spec.md` §4 carries the contract. **The consequence stands and is
   not a defect: the panel orders a clean circle and not a loop with a tail, and a user cannot
   tell them apart by eye** — the orderable shape is the RARE one (24 trials per row at
   Jump-2: clean circle 7/24 at two waypoints, 4/24 at three, **0/24 at five**; loop with a
   tail 16, 19 and 24). **Two calls made without Sean, both cheap to reverse:** a circle lists
   each world ONCE, with the return shown as its own panel line rather than a repeated entry
   (repeating it would duplicate a CSV row and inflate every `worlds.length` count); and a
   hand-drawn or imported circle, having no stored Start, is ordered anyway from the lowest
   hex ID rather than left as bullets.
3. ~~Finish the moon-sheet export verification.~~ **DONE AND VERIFIED 2026-09-21.** A pin on a
   moon used to save and then never reach an export — `openBodyImagePanel` is body-agnostic, so
   a moon can hold pins, but both exporters called `pinnedSitesFor` in the **worlds** loop only.
   Moons now get sheets, mirroring the worlds block inside the existing image/disclosure gate in
   `html_exporter.js` (the moons loop, plus the moon section of `_buildSystemPage`) and in
   `obsidian_exporter.js` (the moons loop, plus `_buildMoonFile`, whose new `moonSheetFiles`
   parameter was added to the SIGNATURE first — see the missing-parameter trap).

   **Verified by exporting, with a real negative control** — the pre-edit exporters were swapped
   back in, the run repeated, and the current files restored and hash-checked:

   | | pre-edit | current |
   |---|---|---|
   | HTML export files | 29 | **30** |
   | Obsidian export files | 57 | **58** |
   | Moon sheet PNG | 0 | **1 in each** |
   | HTML page embedding it | 0 | **1** |
   | Moon `.md` with `## Regional Surveys` | absent | **present** |

   **Recipe, because the first attempt took half an hour:** generate a block of hexes, find a
   world with a moon, pin it, then **trim `hexStates` to that one hex** before exporting. The
   export path is unchanged; it simply has one system to walk instead of forty-eight.

#### The v0.18.0 standing decisions — ALL RULED 2026-09-21

Sean was walked through each one. **Nothing here is waiting on him.**

* **Lake-adjacent land shading — KEEP. DO NOT "FIX" THIS.** P4's water fill moves **1.4-9.7%
  of land pixels**, all within 8 cells of a lake shore. That is correct and deliberate: the
  water plane genuinely is there, and the old code occluded from the lake BED, which is not.
  The one-line "fill sea only" narrowing was considered and **rejected** — it re-splits sea
  from lake, the exact inconsistency the 09-16/09-17 work existed to remove.
* **The route-replace prompt — KEEP AS-IS.** It fires on every pass of an iterated P2P route
  and that cost was accepted. The `automationRef` narrowing is **rejected on a fact worth
  keeping: SEGMENTS CARRY NO PROVENANCE.** A segment is `{startId, endId, type, routeId,
  ...extras}`, and `automationRef` lives on the route DEFINITION — so nothing can tell a
  pristine generated route from one generated and then hand-edited, and the narrowing would
  silently wipe hand edits on a same-type rebuild. Third ruling the same way: *"the clear was
  never the bug; the silence was."*
* **Round trips in travel order — BUILT 2026-09-21, clean circles only.** Pre-work job 2
  above carries the measured shape distribution and the consequence that follows from it.

### 0.0.A THE TERRAIN SYSTEM — rules you must not break (shipped v0.18.0)

> **THE CONTRACT NOW LIVES IN `directives/terrain_spec.md` (written 2026-09-21). READ THAT
> FIRST.** It states the shipped system as rules — the field-version contract and the v1
> freeze, the `sheetSetup`/`renderSheet` pipeline, the pin storage shape, the duplicated-
> definition register, the standing gates and the procedure for changing terrain code. Every
> line number in it was verified against the code the day it was written. What remains below
> is the same material in its original session-log form; where the two ever disagree, the
> spec is the authority.

Regional surface maps shipped in v0.18.0 on 2026-09-20: zoom into a patch of a world's surface
and render it as a survey sheet. **What follows is not an account of that release — it is the
set of constraints it left behind.** Every item here either forbids a change, names a contract
two callers share, or records a decision that will otherwise be re-made wrongly. The narrative
of what was fixed on which day was removed on 2026-09-21; `changelog.md` and the code comments
hold it.

**If you change anything under `js/terrain_*` or `js/planet_renderer.js`, read the terrain field
version rules below FIRST, and run `utilities/verify_field_v1.html` after.**

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

#### The regional map panel — the constraints, not the history

* **The survey window is FIXED** at `suggested().widthKm` (`VIEW_WIDTH_KM`), 120-220 km across
  every legal size code, so a sheet is always the regional tier.
* **Wheel zoom was removed deliberately** (Sean, 2026-09-13: slow, and doing almost nothing).
  Landform size is a property of the PLANET, not of the framing, so magnifying the window
  changed very little. **Do not re-add it.**
* **The field is world-anchored and must stay so.** It is what makes a dragged plate the same
  ground rather than a new landscape, and what keeps the regional map agreeing with the world
  image. `view.s` is retained at 1 rather than removed, so the drawImage path and
  `viewToWindow()` keep ONE scale-aware coordinate path instead of growing a second, subtly
  different one.
* `LANDFORM_KM` and `STEEPNESS` are per-world constants read once from `suggested()` and not
  exposed — a control could only ever contradict the world's own physics.
* **The control is "Rivers & lakes" and governs BOTH**, because both come out of the one
  hydrology pass. Keep label and behaviour in step.
* That box is **disabled, with the reason shown**, when hydrology cannot run — field version
  < 2, or hydrographics 0. `riversWhy` is read once at open, which is safe only because the
  panel is modal.
* A pin's stored `widthKm` is written but **ignored** on Go, so pre-2026-09-13 pins still load.

#### Pins — the storage contract

```
state.terrainPins = { "<body name>": { "0": {...}, "3": {...} } }
```

* **No serialisation code exists, and none is needed.** `io_manager.js` and `db_manager.js`
  both persist hex states *whole*, so a pin travels with a saved `.json`, rides the IndexedDB
  autosave and survives a browser change for free.
* **`terrainPins` must NEVER join `HEX_VIEW_STATE_KEYS`.** That list strips DERIVED view state
  at save time (§0.0.7); a pin is the opposite — a deliberate human choice — and stripping it
  would throw it away.
* **`bodyKey()` returns a compound object carrying a `toString()`** that yields the old flat
  form. The `toString` is **required, not cosmetic**: `utilities/test_regional_terrain.html`
  builds a redraw signature with `key + '#' + ...`, and an object would coerce to
  `"[object Object]"`, dropping the body and suppressing a redraw when switching bodies.
* **Body identity is the NAME.** `TerrainPins.bodyNameOf()` is the one definition — a nameless
  body files under `'Unnamed'`, and an exporter looking up `''` silently finds nothing.
* **Pinning takes no undo snapshot, deliberately.** `saveStateForUndo()` deep-clones every hex
  state, which core.js puts at hundreds of MB on a large canvas; pinning schedules its own
  `dbManager.saveHexes([hexId])` instead. An undo of a LATER action therefore drops the pin,
  which is how this app treats every edit that takes no snapshot.
* **`masterSeed` is not in the save envelope at all** (it lives in `localStorage` as
  `traveller_gen_seed`), so a file opened under a different seed shows different terrain and
  its pins point at ground that has changed. Accepted — changing the seed on a populated
  sector is already a regenerate-everything act. Reversible by storing the seed on the pin.
* `test_regional_terrain.html` falls back to localStorage because it loads the module without
  `core.js`, so there is no `hexStates`. **The app never takes that path.**

#### THE RULE THAT GOVERNS EVERY TERRAIN IMPROVEMENT

**Every improvement goes behind Tectonic (v2). Classic (v1) is frozen.** Seven separate
rulings landed on this shape independently, which makes Classic vs Tectonic a larger visual
jump than terrain shape alone. That is accepted and deliberate — it is the price of never
disturbing an existing sector.

Behind v2: vegetation, `cold_desert`, `remapHeight`'s interpolated form, and plate tectonics
itself.

* **Vegetation is a RAMP SWAP and nothing more.** `RAMP.standard_veg` colours exactly the
  generic-ground band (beach → lowland → upland → highland); snow, exposed mountain rock and
  every water material stay discrete and untouched, so a world does not change its seas when
  it grows plants. `planet_renderer`'s matching `isVegetated` stop set has **ocean stops
  identical** to the arid version.
* **`cold_desert` is `hydro === 0 && tempK < 223`.** The 223 K is **reused from the existing
  ice branch, not invented.**
* **A NEW WORLD TYPE NEEDS FOUR THINGS, NOT ONE:** a `MATERIALS` table, a `RAMP` + `RAMP_IDS`
  entry, a `classify()` branch, and **a `VOCAB` entry in `terrain_names.js`** — without the
  last it falls back to `standard` and a waterless world gets handed "Oceans" and "Great
  Plains". It may also need excluding from `polarOverlay`: below 223 K the frozen band puts
  the cap edge at 40°, so a cap counts the same ice twice and the sheet renders solid white
  with a key reading "Polar Ice Cap 100.0%". `ice` and `cold_desert` are both excluded for
  exactly this reason.
* **The climate predicates are DUPLICATED in `planet_renderer.js` and `terrain_render.js`,
  deliberately.** The two cannot import one another: `test_regional_terrain.html` loads
  terrain_render WITHOUT planet_renderer, and `verify_field_v1.html` loads planet_renderer
  WITHOUT terrain_render. Both copies carry a comment naming the other. **Keep them
  identical.**
* **The plate field must be invariant under ANY permutation of the ranking**, not merely one
  of them. `_boundaryDelta(I, J)` orders its pair internally so it is exactly symmetric;
  `sample()` sums over **unordered pairs** of the nearest plates weighted by the product of
  their softmin weights; the base is a softmin blend; and every plate's weight is **tapered to
  zero before the `NEAR` cut**, so the NEAR-th/(NEAR+1)-th swap cannot make a weight appear
  from nothing. Anchoring to nearest/second-nearest instead produces hard-edged polygonal
  wedges radiating from every triple junction. See the rank-ties trap.

#### The sheet pipeline — one definition, three callers

`TerrainFrame.sheetSetup(worldData, seed, masterSeed)` returns every per-world parameter;
`TerrainFrame.renderSheet(opts)` does field, hydrology, shading, rivers and labels. **The panel
and BOTH exporters call these same two functions**, which is what stops an exported sheet
disagreeing with the one the user saw. It was EXTRACTED from `terrain_panel.js` rather than
copied, because `remapHeight` and `isIce` had already drifted exactly that way.

* Sheets are generated INSIDE the exporters' existing `_show(oLV, 'e')` world-image gate.
  **This is load-bearing:** an image is opaque to `filterBlocks()`, so **not generating it is
  the only way to withhold it.**
* `renderRegionalSheet()` returns **null rather than throwing** when the terrain stack is
  absent, so an export degrades instead of failing.
* **Only PINNED sites are exported**, so the volume is bounded by deliberate human choice and
  costs nothing until a pin exists.
* **A sheet is ~1.0 MB** at 960 wide — so 30 pins is roughly 30 MB and 60 s. If that needs
  reducing, the levers are plate resolution first, then JPEG.

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

**Do not trust a lake figure written down here — run `utilities/lake_calibration.html`.**
The table that used to sit in this spot was measured on 2026-09-16 and had already drifted by
2026-09-21 (hydro 9 7.13% -> 8.07%, hydro 7 1.90% -> 1.70%) with the gate still passing. See
the Verification section.

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

#### Water is shaded as water, not as its bed

All of this is in `shade()` in `js/terrain_render.js`.

* **`water`** is a mask of every pixel `classify()` paints as water, built from the SAME test
  the albedo pass uses — below the per-pixel datum, which is a lake's own surface where there
  is one and the planetary sea level otherwise. Sea and lake take the same path.
* **Only `ice`, `standard` and `exotic_wet` are considered** — the three types with a water
  branch. **A dry world can carry pixels below its datum with none of them wet**, and
  flat-shading those would drain the relief out of desert, cold desert and rock worlds.
* **`surfF`** is the same field with every water cell raised to its own surface, passed to
  `castShadows` and `computeAO` in place of the bed. That keeps the two facts belonging to the
  water — a cliff shades the water beside it, basin walls close the sky over it — while
  dropping the one belonging to the bed.
* Water pixels are lit flat: `ndl = Lz`, slope 0, sky term 1, micro-texture off. **Depth still
  shows, because depth is real** — through the hypsometric bands and the `em` albedo
  modulation, which TINT rather than light.

**Consequences to know before "fixing" any of it:** a window that is entirely open ocean is
now a nearly featureless blue plate, which is correct — open ocean has no surface features at
130 m/px. And lake-adjacent land shifts slightly, because a lake's surface can perch above
ground just outside its rim and neither sampler visits every cell. Both are ruled final in
§0.0.B.

#### Round-trip Point-to-Point routes — the behaviour to preserve

`generatePointToPointRoute` builds `stops = [startId, ...waypointIds, endId]` and resolves each
consecutive pair with its own BFS, so `[A, W, A]` is simply two ordinary legs. The engine never
needed changing; the only obstacle was a UI refusal.

* **A round trip REQUIRES at least one waypoint**, and the refusal for zero is not taste:
  `stops` becomes `[A, A]` and `_bfsPath` seeds `visited` with its own start, so the search
  exhausts and reports "no path within Jump-N", which is true and useless.
* **One waypoint almost never loops** — the return leg is the outbound reversed, `addRoute`
  skips pairs the slot already holds, and the result is a line. Two or more is needed for a
  genuine loop, and a loop WITH A TAIL is the commonest outcome. The completion message reports
  the shape actually built, read back with `walkRouteChain` rather than guessed.
* **Continue** returns `'cycle'` for a clean circle and refuses it — there is no loose end.
  A loop with a tail returns `ok` and Continue works from the tail tip.
* **Combine** uses the stricter `walkRouteChain`, so a circle is correctly not offered.

#### Generating into an occupied slot

The clear lives in **`_generateIntoSlot` in `js/ui_menus.js`** — `if (!opts.append)
window.sectorRoutes = sectorRoutes.filter(...)` — and that is the right place for it, so the
confirmation lives there too rather than in the four generate handlers. It therefore covers
XBoat, Custom Network, Point-to-Point and BTN alike, and cannot fire for Continue, which
passes `append` and never clears.

* It fires only when the slot **already holds segments**, and runs **before
  `saveHistoryState`**, so declining leaves no undo entry to step through.
* **`_generateIntoSlot` returns `cancelled`** because `produced: false` had come to mean two
  different things — without it, the callers report "no path found" at a user who just chose
  to keep their route.
* **Auto-ticking Continue was considered and rejected**, and had already been rejected once in
  `hex_map.html`'s own comment: a silently-ticked box "would append when the user expected a
  rebuild". A confirmation asks; a default guesses.

#### Legacy saves omit fields that the engine now always writes

`sectors/solo_6.json` is `"version": "v0.13.3"` and ships bundled with the app. Its MgT2E
companion stars carry only:

    age, diam, eccentricity, lum, mao, mass, massEarths, name, role, sClass, sType, subType

Missing against what `mgt2e_stellar_engine.js` writes today: **`orbitId`, `parentStarIdx`,
`separation`, `distAU`** — across **86 companions in 79 multi-star systems** in that one file.
The engine sets `primary.orbitId = null` but older saves OMIT the key, so **`null` and
`undefined` both occur in the wild**.

**Use `!= null` (loose), never `!== null`, on anything read out of a loaded sector**, and check
any new field read against the list above before assuming it exists. **Verify against a real
old preset, not a freshly generated system** — fresh generation always has every field, so it
can never reproduce this class of bug.

**AND THE DIAGNOSTIC THAT GOES WITH IT: A BLANK EDITOR ACCORDION IS A THROW, NOT MISSING
DATA.** Every engine block in `populateEditorAccordions()` starts with `root.innerHTML = ''`,
so an exception anywhere after that leaves the container emptied and never refilled. The throw
also aborts the rest of `openHexEditor()`, which runs afterwards — so the PBG and Stellar
quick-stat fields never get set and **still show the PREVIOUSLY opened hex's values.** That
mismatch is the fingerprint: a header reading `G5 V` beside a Stellar field reading `K0 V`. No
page error reaches the console, because the click handler swallows it — so the symptom looks
like a data problem and sends you hunting through the sector JSON. Reproduce it in seconds
with `hexStates.set(id, state); try { openHexEditor(id) } catch (e) { e.stack }`.

#### The two river-network paths

* **The LOCAL path is gone** (2026-09-21). `localNetwork` and `carve` were superseded by
  `linesFromField` and `_hydrology()`; `js/terrain_rivers.js` went 763 -> 543 lines.
* **THE GLOBAL PATH IS RETAINED DELIBERATELY — do not delete it as dead code.**
  `buildNetwork`, `networkFor` and `inflowFor` have no callers and stay anyway: it is the only
  whole-world drainage network in the codebase, and the flat world image draws no rivers at
  all yet. The module header carries the same note.
* **The "never cut below sea level" rule now exists in exactly TWO places** — `_hydrology()`
  and `buildNetwork`'s "sea drains nowhere". **Change one, change the other.**

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
* **STUBBING A MODULE'S EXPORT DOES NOT REACH A CONSUMER THAT CAPTURED IT AT LOAD TIME.**
  `obsidian_exporter.js` does `const _pinnedSitesFor = ExportCore.pinnedSitesFor` at module
  load, so replacing `window.ExportCore.pinnedSitesFor` later changes nothing the exporter ever
  calls. A negative control built that way **passes silently and proves nothing** — it reported
  "the test may not reach the code", which reads like a broken test rather than a broken
  control. **To prove an export change really fires, swap the PRE-CHANGE source file back in,
  re-run, and diff the file counts** — then restore and hash-check. Anything less is measuring
  your own stub.
* **AN EXPORTED NAME WITH NO LOCAL DEFINITION RESOLVES TO A GLOBAL.** `terrain_rivers.js`
  exported `draw` and defined no such function, so the IIFE's scope chain reached global scope
  and `TerrainRivers.draw` silently WAS `renderer.js`'s whole-map repaint. No error, no
  warning, and a caller would simply have got the wrong behaviour. Found only because the
  module threw a ReferenceError in a node harness, where `renderer.js` is not loaded. **Check
  every name in a module's return list against a definition in that module.**
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

**THE RECORDED LAKE FIGURES HAVE MOVED, AND NOBODY KNOWS WHY YET (found 2026-09-21).** The
gate still PASSes, but its whole table differs from the one recorded on 2026-09-16 below:
hydro 9 **7.13% -> 8.07%**, hydro 7 **1.90% -> 1.70%**, hydro 5 **0.29% -> 0.27%**. The harness
is fully deterministic — fixed seed `'TravellerMagnus','1105-Demo'`, no RNG — so this is not
sampling noise, and it reproduced exactly on a second run. It is **not** the 2026-09-21
river-path deletion: that changed no code in `terrain_field.js` at all, proven by diffing every
non-comment line. The P4 verification of 2026-09-17 explicitly recorded 1.90% as unchanged, so
the shift happened **between 2026-09-17 and the release**. Two candidates, and they cannot be
told apart without git history, which is Sean's: either the field or hydrology moved slightly
during the v0.18.0 endgame, or the harness's own parameters changed (it now reports **5
windows**; the 2026-09-16 run did not record a window count). **Ask Sean before treating either
table as the baseline.** 1.70% is comfortably inside the 2.0 ± 0.6 band either way.

**`utilities/lake_calibration.html`** (new 2026-09-16) — the second standing gate. It measures
lake cover across hydrographics and FAILs if hydrographics 7 leaves the 2% ± 0.6 band that
Earth sets, or if cover stops falling monotonically as the world dries. **Run it after changing
`LAKE_K0`, `LAKE_K_DECADE`, the pit-fill or the flow accumulation.** It currently passes.

### 0.0.0 Candidate work — RETIRED as a release plan 2026-09-21

**This was the v0.18.0 candidate list and it is no longer a plan for anything.** v0.18.0 went
to regional surface maps (§0.0.A) and v0.18.1 is image exports (§0.0.B). The table is kept
because every row is still a real thread that nobody has picked up. **None is committed to, and
the order is not a recommendation.**

| Candidate | Where to start | What it is |
|---|---|---|
| **RTT and AoW editor bring-up** | §0.3 is the entry point, §5 the inventory | The largest deliberate gap. AoW is the further along — `js/aow_seed_bridge.js` and `js/aow_uwp_auditor.js` exist, but AoW was **never verified in-browser** (OW-9). RTT is slated for a full overhaul rather than incremental fixes |

### What the routes series left behind (v0.17.2 - v0.17.5)

The 27 changelog entries are in `changelog.md` and `README.md`. **Three things from that series
still bind:**

* **The two eligibility tests are deliberately different and must not be merged.**
  `walkRouteEnds` / `getRouteEnds` is the WEAK one — one piece, at least one loose end — and
  gates **Continue**. `walkRouteChain` / `getRouteChain` is the STRICT one — a single unbroken
  line with exactly two ends — and governs **Combine** and travel order. Both in `js/routes.js`.
* **A suite can be green, honest and blind at once.** Every pre-v0.17.5 Continue check laid a
  clean two-ended chain, a shape BOTH the old rule and the new one accept, so all fifteen
  passed unchanged and would still pass if the rule were silently reverted. **What was missing
  was not assertions but SHAPES.**
* **A row in the Route Manager needs 467px** and the window is 520px. It was 430px, which
  rendered the 50px colour swatch as a 14px sliver. Mind this before adding a control.

### The route directives — the authoritative documents

*(This heading and its table had drifted apart — the table had ended up under the wrong
heading, below the v0.17.3 entries. Rejoined 2026-09-11; those entries were themselves
condensed into the table above on 2026-09-21, and this one was deliberately NOT condensed —
the three route specs remain authoritative documents.)*

| Directive | Covers | Status |
|---|---|---|
| `directives/route_file_spec.md` | Saving/loading one route's connections to `.json` | **IMPLEMENTED** in v0.17.2 |
| `directives/route_partial_spec.md` | Point-to-Point routes that keep what they could build when a leg cannot be routed. §13 records route *forcing*, designed and then dropped; §14 holds the wider route-editing design | **IMPLEMENTED** in v0.17.3 |
| `directives/route_extend_spec.md` | **Continue** an existing P2P route with another leg, and **Combine** two routes that meet end to end. Both keep the route a single chain, which is the rule that governs the whole design | **IMPLEMENTED** in v0.17.4 |

**`route_extend_spec.md` was amended 2026-09-11** to match v0.17.5: C1 and C4 carried the old
eligibility rule ("a clean chain") for ten days after the code stopped using it. The chain
invariant in its §3 still governs **Combine** and travel order — it is only Continue's gate
that was weakened. See §4.1 of that spec.


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

### 0.0.2 Route forcing was designed in full and DROPPED

**Designed 2026-08-19, dropped 2026-08-27. It was never built and is not pending.** The
filter-relaxing second pass, the weighted penalty search and the rest of it are still described
in older parts of `route_partial_spec.md` (§13). **Do not resurrect forcing without asking
Sean.**

What was built instead is **partial routes**: a P2P route that cannot reach a stop keeps what it
could build, up to the closest world it reached, which is named and ringed. Off by default. The
engine contract is below.

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

### 0.0.4 Cross-document notes

**Nothing outstanding.** One lesson kept from the last item that stood here: a complaint that
`html_extract_manifest.md` OPEN-2 was stale **outlived by twenty days the thing it complained
about**, because OPEN-2 had been closed and the pointer to it sat here unread. **A pointer into
another document rots faster than the thing it points at** — re-read the target before trusting
any cross-manifest note.

### 0.0.5 The committed test harness

In `utilities/`, committed so they cannot be lost with a session. **Open the `.html` ones
directly — no server.**

| File | What |
|---|---|
| `route_test_common.js` | Shared bootstrap: launches `hex_map.html` past the splash, builds a deterministic map, fingerprints segments |
| `route_corpus.js` | The corpus differ — 19 scenarios x 2 maps, ~18,000 segments. Fingerprints route OUTPUT, so it is the tool for proving a refactor changed nothing |
| `route_perf.js` | Long leg, full-exhaustion leg, and a 19-leg route at six map sizes |
| `route_continue.js` | Continue — 38 checks against the real panel |
| `route_add_slot.js` | + Add Route — 11 checks |
| `route_combine.js` | Combine — 13 checks |
| `filter_persistence.js` | R9 — 11 checks across restart, store, save file and indicator |
| `otu_import_undo.js` | Multi-sector import undo — 6 checks, driven OFFLINE by seeding the importer's localStorage cache and stubbing `fetch` to throw |
| `verify_field_v1.html` | **Standing gate.** 30 renders at terrain field version 1 vs recorded hashes |
| `lake_calibration.html` | **Standing gate.** Lake cover across hydrographics |
| `test_regional_terrain.html` | Terrain harness. Does NOT load `terrain_rivers.js`, so the sheet degrades there — pre-existing, not a regression |

**The coverage lesson, which is the transferable part:** eleven scenarios (V1-V11) had to be
added because every existing check laid a shape both the old and new rules accepted. They lay a
three-ended Y, a self-crossing route, a closed loop, and a line beside a detached loop — each
**paired with `getRouteChain().ok === false` on the same segments**, so if the eligibility rule
is ever reverted the check fails instead of quietly going vacuous. The line-beside-a-loop case
earns its place separately: it presents exactly TWO loose ends and must still be refused, which
is what makes "count the ends" the wrong test.

**Also worth keeping:** the segment-count check must run at **Jump-1**. At Jump-3 the pathfinder
shortcuts past the route's own edges, nothing is ever retraced, and the bug is unreproducible.

### 0.0.6 Open items

**None here.** Everything that stood in this section was ruled on 2026-09-21 and is now
either a closed ruling in §0.0.B or work that has since been done.

**And none anywhere else either.** The System Editor and route/filter residue that used to be
recorded here — OW-3, OW-5 layer 2, OW-65 — was deleted on 2026-09-21.

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


### The method that works here

Every fix in this project's recent history was reproduced **in a real browser with Playwright**
(already in `node_modules`) BEFORE being fixed, and re-verified after. **`node --check` has
repeatedly passed on real bugs in this codebase** — float32 precision, routing cycles, a lookup
grid showing through, a slider pinned to its minimum, a missing function parameter.

The highest-value pattern: **capture a corpus of generated output before a refactor, re-run
after, diff.** That is what made "WP0 changes no routes" a measurement rather than a claim.

**And watch a test fail before believing it passes** — re-break the fix and confirm the error
matches the one reported, or you have only proved that today's code runs.

---

## 0. Current State (2026-08-06)

> **Superseded by §0.0 above (last refreshed 2026-09-11).** The section below describes the
> project as of the exports series and is kept for the System Editor detail it carries.
> Where the two disagree about what is current, §0.0 is right.

### 0.1 Where the project is

| | |
|---|---|
| **Most recent work** | **v0.18.0 — regional surface maps**, shipped 2026-09-20; its constraints are §0.0.A. Before it, v0.17.2–v0.17.5 — routes. Nothing in *this* document's own subject matter (the System Editor) moved during either, apart from one legacy-save bug — see "Legacy saves omit fields" in §0.0.A, which still binds any code reading a loaded sector. |
| **Current release** | **v0.18.1 — image exports**, open, §0.0.B. |
| **This document** | v0.16.x System Editor. **Paused** after MgT2E, CT and T5 were brought fully online. |
| **Paused** | RTT and AoW editor support — the reason this manifest is retained. |
| **Open here** | **None.** The last three were deleted 2026-09-21 — see section 4. |

**Nothing is half-finished in either manifest.** v0.18.1 is open and its subject is named, but
no application code has been written for the system sheet yet — see §0.0.B. Its pre-work is
all done. The companion manifest has **no** open items. This document's section 4 lists three.

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
3. **Section 6.2** — OW-9: AoW's readiness audit and what `aow_seed_bridge.js`
   had to solve. Two things it does NOT record any more, both deleted 2026-09-21 but both
   still true of the code: a new engine needs its own populated `sys.auditResult` before
   Fill & Save is trustworthy, and `commitEditorSystem()` was never built, so the editor's
   `_clearSystemData()` and `macro_orchestrator.js`'s inline clear-block are two copies. Both
   still open and both apply to any new engine.

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
- Physical inconsistencies trigger a warning; user may correct or proceed. **The UWP Auditor gate is DONE for all five engines (MgT2E/CT 2026-07-04, T5/RTT 2026-07-04/05, AoW 2026-07-05).**

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

#### The Commit Path — 🟡 PARTIALLY BUILT, ACCEPTED FINAL STATE
Original plan: after Fill runs, `system_editor.js` would call `commitEditorSystem(hexId, engineResult, engine)` in `macro_orchestrator.js`, writing the completed system to hexStates and triggering a map redraw. **`commitEditorSystem` in `macro_orchestrator.js` does not exist and, per Sean's explicit 2026-07-04 decision, is not planned**. What was built instead: `system_editor.js`'s own internal duplication between `_fillAndSave()`/`_preview()` was extracted into a shared `_generateAndCommit()` (2026-07-04). The separate duplication in `macro_orchestrator.js`'s macro commit blocks remains un-consolidated — a deliberate, accepted scope decision, not an oversight. Also drop the `manually_edited: true` detail from this description — that flag was retired, see OW-4.

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

  5. RUN UWP AUDITOR — ✅ DONE for MgT2E and CT (2026-07-04).
     Each generator attaches its audit result to `sys.auditResult` (`auditMgT2ESystem`/
     `MgT2E_UWP_Auditor.runAndLog` for MgT2E; `auditCTSystem`/`CT_Auditor.runAndLog` for
     CT, wired into `ct_system_driver.js`). `_fillAndSave()` reads `result.newSys.auditResult`
     generically (engine-agnostic check) — if `pass === false`: warn-and-proceed
     [Proceed anyway] [Go back and fix]. Still a no-op for AoW/T5/RTT until each gets
     its own `sys.auditResult` attachment.

  6. COMMIT — 🟡 PARTIALLY EXTRACTED, ACCEPTED FINAL STATE.
     `_generateAndCommit(errorLabel)` (2026-07-04) is now the shared function called by
     both `_preview()` and `_fillAndSave()`: build seedSys → run generator (via
     `_ENGINE_ADAPTERS` for MgT2E/CT) → restore-display-manual-fields → preserve
     mainworld name → `computeSystemCounts` → `hexStates.set()` → redraw → (run UWP
     auditor gate, step 5 above) → close editor → `SystemViewer.open(hexId)`.
     ~~result.manually_edited = true~~ — DROPPED, see OW-4 (CLOSED). Do not implement.
     ~~commitEditorSystem(hexId, result, engine)~~ in `macro_orchestrator.js` — does not
     exist and is not planned (Sean's call, 2026-07-04): only `system_editor.js`'s own
     internal duplication was consolidated; the separate `macro_orchestrator.js` commit
     blocks remain un-consolidated.
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

**Before AoW/RTT is UI-exposed:** finish its remaining gating work above, give it its own `_ENGINE_ADAPTERS` entry (OW-8 pattern), AND give it its own UWP-auditor coverage (per-engine — MgT2E's/CT's/T5's coverage does not extend to other engines). CT's and T5's Phase B work (Section 5, "CT is now fully online" / "T5 is now fully online") are the worked reference implementations for this whole sequence.

---

#### Step 6 — Fill & Save Orchestration — DONE for MgT2E and CT (UPDATED 2026-07-04)
**Files:** `js/system_editor.js`

Fill & Save button exists and works for MgT2E and CT. Actual current sequence (see corrected Algorithm 5): `_buildSeedSys()` → call generator (via `_ENGINE_ADAPTERS` for MgT2E/CT) → `_generateAndCommit()`'s shared commit block (`hexStates.set`/redraw) → **the audit gate** (`result.newSys.auditResult`; warn-and-proceed dialog if `pass === false`) → close editor → `SystemViewer.open(hexId)`. The "validate → mainworld dialog" steps this used to describe are retracted (OW-1/OW-2, closed as unnecessary). The UWP auditor step is implemented and live for MgT2E and CT; still a no-op for AoW/T5/RTT until each gets its own `sys.auditResult` attachment.

`_buildSeedSys()`: deep-clone working copy stars and bodies (preserving `_manualFields`) into seedSys object with `_allowAddBodies` and `_mainworldRef` — confirmed real and matches the corrected Seed Object Schema in Phase 2.

- **Verified working today (MgT2E, in-browser by Sean):** audit errors → warn dialog with go-back option; Create system, fill → appears on map with correct data; user-set fields survive Fill; allowAddBodies checkbox respected; edit existing system, change structure, fill → changes in result
- **CT (2026-07-04):** same code paths, but only `node --check`-verified so far — **not yet exercised in-browser**, since CT's UI exposure (Phase B item 5) just landed this session. First real end-to-end test is up to Sean.
- **Regression:** All existing macros still generate correctly (seedSys=null path untouched)

---

#### Step 7 — Commit Path — 🟡 PARTIALLY DONE, ACCEPTED FINAL STATE (UPDATED 2026-07-04)
**Files:** `js/system_editor.js`, `js/macro_orchestrator.js`

`commitEditorSystem(hexId, sys, engine)` in `macro_orchestrator.js` (shared by macros AND the editor) does **not** exist and is **not planned** — Sean explicitly scoped this down (2026-07-04) to "system_editor.js only." What was built instead: `system_editor.js`'s own internal duplication between `_fillAndSave()`/`_preview()` is extracted into a shared `_generateAndCommit(errorLabel)` (build seedSys → run generator → restore-display-manual-fields → mainworld-name preservation → `computeSystemCounts` → `hexStates.set` → redraw). The `macro_orchestrator.js` commit-block layer (Layer 2) remains a separate, un-consolidated path — revisit only if a future engine's macro and editor commit paths need to agree.

- **Verified (MgT2E, in-browser by Sean):** Committed system on hex map; System Viewer renders it; Hex Editor shows correct fields; macro re-run on same hex overwrites correctly; map-level Ctrl+Z reverts to pre-edit state
- **CT (2026-07-04):** same `_generateAndCommit()` code path (CT's `_ENGINE_ADAPTERS.CT.run()` writes `stateObj.ctSystem`/`ctData` the same way MgT2E's adapter does) — not yet exercised in-browser, see Step 6 above
- **Final regression:** Every macro type generates correctly; open/cancel preserves original; open/edit/fill/save produces correct result

---

### Phase 5 — Implementation Notes & Design Decisions (2026-06-22)

Steps 1–4 of the Phase 4 sequence are fully implemented. **UPDATED 2026-07-04:** Steps 5–6 are done for MgT2E and CT (still open for AoW/T5/RTT); Step 7 is intentionally left partial as an accepted final state rather than "not yet implemented." The following design decisions were made during or after implementation and are not reflected in Phases 2–4.

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

**None.** Everything this document tracked is closed. The last three — OW-3, OW-5 layer 2 and
OW-65 — were deleted on 2026-09-21: each was conditional on resuming the paused RTT/AoW editor
work, and none described a fault anyone had actually seen. The patterns worth carrying forward
are in 6.1, and §6.2 keeps the AoW readiness audit as the worked example.

**v0.18.1 is image exports (§0.0.B), not editor work**, and no recent release has been in this
document's subject matter. Resuming RTT/AoW means starting at section 0.3.

**One editor rule from outside this section still binds:** see "Legacy saves omit fields" in
§0.0.A before touching any code that reads star or world fields off a loaded sector — an editor
bug of exactly that kind reached production in v0.17.5.

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
> 1. **Extract the commit path** (hard prerequisite). **🟡 PARTIALLY DONE 2026-07-04, and that's the accepted final state.** `system_editor.js`'s own internal duplication (`_preview()` vs `_fillAndSave()`) is extracted into a shared `_generateAndCommit()`. The `macro_orchestrator.js` commit-block layer was deliberately scoped out (Sean's call, 2026-07-04) and does not block Phase A sign-off — revisit only if a future engine's macro and editor commit paths need to agree.
> 2. **Implement the UWP Auditor step in Fill & Save.** **✅ DONE for MgT2E, 2026-07-04.** Still needs its own per-engine hookup (a `sys.auditResult` attachment in each generator) before AoW/CT/T5/RTT can rely on it — that per-engine coverage is Phase B work, not a Phase A blocker.
> 3. **OW-8 (✅ DONE 2026-07-04, verified in-browser by Sean)** — the per-engine adapter/config pattern for `js/system_editor.js`. `_buildWorkingCopyFromState()`, `_buildSeedSys()`, and `_runGenerator()` each had a separate near-parallel `if/else if` branch per engine; this was the last item blocking Phase A sign-off. See OW-8 in Section 6 for the full implementation writeup. The same 2026-07-04 audit that raised this also turned up two smaller items, both done: **OW-6 (✅ DONE)** — seed-restoration matching logic that lived inline in `mgt2e_bottomup_generator.js` is now `js/seed_restoration.js`; **OW-7 (✅ DONE)** — the `MgT2EMath` guard-consistency fix and the duplicated auditor-logging cleanup (now `MgT2E_UWP_Auditor.runAndLog()`), see Section 6.
>
> **Phase B — Expand to additional engines (now unblocked):**
> Bring engines online one at a time per the per-engine remaining-work lists in Section 5 below (CT needs field-level `isManual` gating; T5 needs both structural and field-level gating plus Algorithm 7; RTT needs broader field-level gating). Each engine's UI entry point (`canvas_input.js`/`system_viewer.js` gates, `hex_map.html` dialog radio buttons) should only be switched on once that engine's generator work *and* its own UWP-auditor coverage are both complete — Phase A's auditor work does not automatically cover new engines, each needs its own. Per OW-8, bringing each engine online should also mean giving it its own adapter in `_ENGINE_ADAPTERS` (see Section 6) instead of adding another inline branch.
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
> 7. **Age-conflict warn-and-proceed dialog** (design decision 2) — when manually-chosen spectral types across stars imply system-age windows with no overlap, `_fillAndSave()` shows a dialog (`[Proceed Anyway]` / `[Go Back & Fix]`) rather than silently picking an inconsistent age, reusing the same UI pattern as the audit gate.
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
- ✅ **Done.** Added `runAndLog(sys, hexId)` to `ct_uwp_auditor.js`, mirroring `MgT2E_UWP_Auditor.runAndLog` (`mgt2e_uwp_auditor.js:400-423`, added under OW-7) — runs `auditCTSystem`, attaches the result to `sys.auditResult` (the field `system_editor.js`'s Fill & Save audit gate reads — that gate is engine-agnostic, so it required no changes), and on failure `console.warn`s plus pushes each error to `window.auditBacklog` as `{ hexId, orbitId: null, engine: 'CT', message }`. `orbitId` is always `null` for CT since `auditCTSystem`'s `errors` array holds plain strings (not MgT2E's `{orbitId, message}` objects) — irrelevant to the Fill & Save dialog either way, since it only reads `audit.errors.length` for a count.
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

**Age-conflict dialog — NEW, design decision 2.** `_fillAndSave()` now checks `result.newSys.ageConflict` (set by the bridge's `reconcileSystemAge` when manually-chosen spectral types imply non-overlapping age windows) and shows a warn-and-proceed dialog, reusing the same UI pattern as the audit gate, before falling through to the audit check.

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

### 6.1 Recurring patterns to expect when bringing RTT or AoW online

Nine failure modes repeated across MgT2E, CT and T5. Assume they will recur. Each cites
the closed items it was drawn from.

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
`macro_orchestrator.js`'s inline clear-block still differ today, and consolidating them was
deliberately never done.
→ **Derive from the real body list rather than trusting a counter, and check whether the
macro path needs the same change.**

**9. In-browser testing finds what static review cannot — three for three.**
T5 phantom bodies, RTT's missing `star.classification`, AoW's missing `planet.Rmin`: each
found by an actual Create → add bodies → Preview → Fill & Save → reopen → modify → Save
round-trip, and **none** by careful reading, including a deliberate plan-review pass.
`node --check` is not verification.
→ **Budget for at least one real bug per engine found this way. A clean first pass is
suspicious, not reassuring.**

### 6.2 The AoW readiness audit — kept for its findings, not as open work

**Nothing in this section is outstanding.** OW-3 (per-engine UWP auditor), OW-5 layer 2 (the
shared commit path) and OW-65 (three parked route/filter items) were **deleted on 2026-09-21**
at Sean's instruction: all three were conditional on resuming RTT/AoW, none described a fault
anyone had seen, and carrying them was costing every session more than they were worth. **Do
not reinstate them from git history.** What remains below is OW-9, kept because its audit is
the worked example of what bringing an engine online actually involves.

**OW-9 — ✅ CLOSED 2026-07-05 (found and fixed same day, pre-Phase-B AoW readiness audit): AoW's Phase 3 pipeline was architecturally unreachable in the System Editor's seeded path**
**Resolution:** option (a) below was chosen and built — a new module `js/aow_seed_bridge.js` synthesizes real `sys.diskWorksheets` from resolved stars + seeded bodies (reusing `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet`), and `isManual()` guards were threaded into the ~6 functions/points that compute editor-exposed fields (not all 13 — most of the 13 functions' fields are pure internal simulation state the editor never exposes, so those were left fully random by design rather than over-gated). The star-side half of the problem (Phase 1 had no path to accept a user-chosen star at all) also needed new solver logic — a bisection search from spectral type to `initialMass`, age-window reconciliation across multiple stars with conflict detection (warn-and-proceed dialog, not silent averaging), and a hierarchy/orbit mapper — none of which existed before this pass. `js/aow_uwp_auditor.js` was also built from scratch (didn't exist at all), `_ENGINE_ADAPTERS.AoW` was added (OW-8 pattern), and UI exposure was flipped. See the "AoW is now fully online" note under v0.16.1 SEQUENCING (Section 5 header) for the full implementation writeup, and the corrected AoW subsection in Section 5. **Not yet verified in-browser** — per the project's own recorded lesson from T5/RTT verification, an in-browser Playwright pass is the natural next step before treating this as fully proven.
The original finding (kept below for historical context on why this was bigger than a normal Phase B gating pass):
The manifest previously claimed (Section 5 header, "Next up" note) that AoW was "already the furthest along at the generator level (structural **and field-level** `seedSys` gating both present)." That was checked against the actual code on 2026-07-05 and the field-level half is false.
**What's actually true:** `aow_bottomup_generator.js`'s structural gating (star/world substitution, `_allowAddBodies` orbit-count gate, `_mainworldRef` lookup, correctly skipping `populateAoWWorldsList` so seeded worlds aren't clobbered) is genuine and works the same way CT's does. But `aow_world_engine.js` has **zero** `isManual()` calls — there was never an attempt at MgT2E/CT/T5-style per-field manual preservation — and the reason isn't just "not built yet," it's that **Phase 3 of AoW's pipeline can't run on seeded data at all today**: `generatePhysicals`, `generateOrbitalConditions`, `generateThermalAndWater`, `generateGeophysics`, `generateMagneticField`, `generateEarlyAtmosphere`, `generateAlbedo`, `generateCarbonDioxide`, `generatePresenceOfLife`, `generateAverageSurfaceTemp`, `generateFinalizeAtmosphere`, `generateHabitabilityScores`, and `generateUWPPhysicals` are all called unconditionally in `aow_bottomup_generator.js`, but each opens with `if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) return;` — and `sys.diskWorksheets` is populated **only** by `generatePlanetaryDisks`, the exact function `aow_bottomup_generator.js` skips whenever `seedSys` controls body count (`!seedSys._allowAddBodies`, the System Editor's default). AoW's internal planet representation (`diskWorksheets[].planets[]`, its own `planetType` field) has no bridge at all from the flat `sys.worlds[]` list that seeding writes into.
**Consequence:** every System-Editor Fill & Save on an AoW system (with the default checkbox state) would silently skip all physical/atmospheric/hydrographic/thermal/geophysical/UWP generation for every seeded or newly-added body. A brand-new body added via "+World" would end up with none of those fields set by anyone — not even freshly rolled ones, since the roll code never runs.
**Also confirmed, same audit:** `aow_uwp_auditor.js` — required/referenced by `aow_bottomup_generator.js`'s module factory and called in its Phase 6 — does not exist anywhere in the repo (`aow_socio_engine.js` also doesn't exist; AoW deliberately reuses `MgT2ESocioEngine` instead, which is a working design choice, not a gap). The audit call is permanently dead code (`activeAuditor` always resolves to `null`), not merely unwired.
**Decided with Sean (2026-07-05) and implemented same day:** option (a) — synthesize `diskWorksheets` from seeded bodies rather than accepting Phase 3 doesn't run (option b) — with two refinements that emerged during design discussion: (1) never jitter a user-set value (matches every other engine's convention), and (2) system age is derived to fit the chosen spectral type(s) rather than rolled independently, with a warn-and-proceed dialog if multiple stars' implied age windows don't overlap.
*Spec ref: Section 5's "AoW" subsection; supersedes the "field-level gating both present" claim in the v0.16.1 SEQUENCING header and the per-engine table in Section 5.*


## 7. A carve-out that must not be tidied away

`restoreT5ManualFields` and `generateT5SystemPreservingManuals` in `system_driver.js` look like
dead duplicates of the editor's `seedSys` path. **They are not.** They implement
`ui_menus.js`'s right-click "regenerate T5 system" — bulk regeneration across selected hexes
with no System Editor working copy involved — which is a separate and still-valid path. **Do
not consolidate them without checking that use case.**
