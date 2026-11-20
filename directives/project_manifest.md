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
**Version:** **v0.19.0 open** (2026-11-16; `APP_VERSION` set, changelog/README entry "In
Progress" with no items yet). Its subject is **published system data from the Traveller wiki**
— §0.0.D. Last release: **v0.18.3, 2026-11-14** (Map Legends; items 1–7: ringed gas giant
icon, Map Legend, styling rule names, symbols on unnamed worlds, movable border and region
names, stale names fixed, L shortcut). Earlier: v0.18.2 (2026-11-10) climate-coded world images, T5 Tz
hemispheres, very large maps, Custom OTU Import; v0.18.1.4.1 / v0.18.1.4 (2026-11-08) export hex
grids, white-background images, subsector names, T5 satellites and climate; v0.18.1.3
(2026-10-19) one System Sheet per star, orrery GIFs, neighbourhood import; v0.18.1.2
(2026-10-01) sheet/orrery/both export choice; v0.18.1.1 (2026-09-25) the System Sheet; v0.18.1
(2026-09-24); v0.18.0 (2026-09-20) regional terrain; v0.17.2–v0.17.5 (08-19 → 09-11) routes;
v0.17.0 / v0.17.0.1 (08-03 / 08-04) exports.
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 0.0 COLD START — read this first (updated 2026-11-16)

**IF YOU ARE STARTING FRESH, READ IN THIS ORDER:**

1. **§0.0.D below** — the handoff: **v0.19.0's wiki-snapshot rulings and next steps**, the
   open items, and the rulings that still bind (v0.18.3, v0.18.2 and Sean's T5 rulings).
2. **§0.0.C / `directives/system_sheet_spec.md`** — before touching the System Sheet or the
   exporters' system images.
3. **§0.0.B** — the design rulings and traps behind the sheet that still bind.
4. **§0.0.A / `directives/terrain_spec.md`** before touching anything that draws a world.
5. **§0–§4 at the end** before touching the System Editor or bringing RTT/AoW online in it.

**ASK QUESTIONS ONE AT A TIME, IN THEIR OWN MESSAGE OR THE QUESTION TOOL.** Sean, 2026-09-23:
*"Please don't ask me questions or things that need clarification in the body of a large
response I will miss them"*, and *"answers to some questions might result in new or different
questions."* **The working pattern that worked all through 2026-09-23/24:** state the problem
with measured numbers, give ONE recommendation, ask with the question tool, build it, verify it
(verify + sweep + a render you actually look at), then present the next decision.

**Three things to know before you touch anything:**

1. **The terrain field version flag is the most dangerous thing in this codebase.** World
   images are never stored — they are recomputed from the seed on every view — so changing the
   field silently redraws every world in every sector anyone has ever saved. **Version 1 is
   frozen for good.** Read §0.0.A's "The terrain field version" before editing anything under
   `js/terrain_*` or `js/planet_renderer.js`, and run `utilities/verify_field_v1.html`
   afterwards. (Changing a renderer INPUT — as the CT temperature ruling did — changes what a
   world looks like without touching the field. It needs Sean's ruling, not a version bump.)
2. **Route *forcing* was designed in full and then dropped** (2026-08-19 → 08-27). Older
   parts of this document and of `route_partial_spec.md` still carry its reasoning. §0.0.2
   says plainly what was built instead. Do not resurrect forcing without asking Sean.
3. **Git is Sean's — never touch it, not even to read.** He stages and commits everything
   himself. **Do not record commit hashes or the commit position in this document.** If you
   need to know what is committed, ask him.

### 0.0.D HANDOFF — v0.19.0 in progress (updated 2026-11-19). START HERE.

**v0.19.0 is built but not released** (changelog "In Progress", not dated). Built: the
wiki-published systems work (fetcher, parser, build step, loader, import checkboxes, menu
button, right-click item and picker, 2026-11-16/17) and four MgT2E System Editor fixes
(2026-11-18), each section below marked BUILT. Still open before release: the wiki's content
licence (question 3 below). Sean commits by hand — ask him what is committed. The rulings
below are **decided; do not re-derive or re-litigate them.**

#### v0.19.0 — PUBLISHED SYSTEM DATA FROM THE TRAVELLER WIKI (rulings, Sean, 2026-11-16)

**The goal.** Give users a way to load the published, hand-written system details (stars,
planets, moons, orbits) that `wiki.travellerrpg.com` holds for canonical OTU systems, on top of
an OTU import. Sean started this earlier and it stalled; what exists is listed under "What is
already there" below.

**Ruling 1 — a snapshot shipped with the app, never a live import.** The wiki is scraped and
cleaned **offline, by the developer**, into a dated snapshot that ships with the app; the
snapshot is refreshed **every 6–12 months**. Wiki edits made in between are the user's to apply
by hand. **The app itself never contacts the wiki.** Why (do not reopen): the wiki's tables are
unformatted and inconsistent, so a cleaner can't be trusted to run unattended — its mistakes
need a person to catch them, and that should be the developer twice a year, not every user;
the wiki should not be hit by every user's import; a fixed snapshot keeps imports reproducible
(same input, same map), like the seeded generator; and a static page may not even be allowed
to read the wiki from the browser.

**Ruling 2 — Python, using the MediaWiki API, with fetching separate from parsing.**
* **Python**, in `utilities/` (it has `sqlite3`/`json` built in and parses text well; the
  existing scraper is Python). Not Node/Playwright — the pages don't need a real browser.
* **The MediaWiki API (`api.php`), not scraping the rendered pages**: `list=categorymembers`
  for the category listing, a revision ID and timestamp per page (what lets a refresh find only
  the pages that changed), up to 50 pages per request, and `maxlag` so the wiki can tell the
  script to back off. Keep the polite delay between requests. *Not yet verified that this wiki
  exposes `api.php`* — the first thing to check.
* **Two separate stages.** *Fetch* only downloads raw page content into `raw/`. *Parse/clean*
  runs offline from `raw/` as often as needed and never contacts the wiki. So a parser fix never
  means re-scraping. (The old scraper did both at once.)

**Ruling 3 — stage in plain JSON files, one per system; not SQLite.** Chosen because it is
the easiest form for the AI agent to work with: the files can be read and searched directly
(a `.db` is binary and needs a query script for every look), every refresh shows up line by
line in Sean's diffs, the data is small (a few hundred systems at most), and nested JSON
matches the app's own system shape. Layout:
```
otu_systems/
  raw/          one file per wiki page exactly as fetched, plus an index: title → revision ID, date
  corrections/  hand fixes, one file per system, keyed by page title + body name
  clean/        one JSON file per system: parser output with the corrections applied
```
A build step then writes `clean/` into the app's data file (today `js/otu_system_data.js`).
* **Corrections are never written by a script** — that is what lets hand fixes survive every
  refresh. The parser applies them; it never edits them.
* **Key everything by wiki page title + body name, never by row IDs.** The old tables linked
  rows by autoincrement IDs that are renumbered on every run (the same unstable-identity trap
  as `orbitId`).
* **Nested:** a system holds its stars, a star its planets, a planet its moons.
* **Scripts must write CRLF** (Python writes LF by default; the repo is CRLF).
* **`otu_systems/traveller_systems.db` is kept as a reference only — not migrated.** The new
  fetch stage replaces it.

**Ruling 4 — what the user gets (Sean, 2026-11-16).**
* **The result is an ordinary T5 system.** Any OTU system on the user's map that is in the
  snapshot can be loaded with its full published details **in T5 system format**
  (`stateObj.t5System`, `t5Data`); once loaded it is like any other T5 system — editable in the
  System Editor and exported as normal. T5 only; no other edition is filled.
* **Two ways in:**
  1. **A checkbox in the OTU import dialogs**, applied to the systems being imported — **in
     four of them** (Sean, 2026-11-16): **Import the Imperium** (`#otu-opt-system-data`, today
     `display:none`), **Import the Universe** (`#universe-opt-system-data`, today hidden),
     **Import a Neighbourhood** and **Custom OTU Import** (both force `importSystemData = false`
     in `js/otu_importer.js` today and have no checkbox yet). **Not Import Sector (.tsv)** — it
     has no options dialog; a file-imported map uses the Import System options instead.
  2. **A separate "Import System" option, in two forms:** a **right-click item for the selected
     hex(es)** and a **menu button for the whole map**.
* **Matching:**
  * **Bulk** (the import checkbox, the whole-map button, a multi-hex selection): load only when
    the **sector name, the hex number and the mainworld's name all match** the snapshot. A hex
    that doesn't match — renamed, or a different world at that location — is skipped and listed
    for the user. **The name compared is TravellerMap's** — the snapshot stores it per system
    (`travellermap.Name`) — **not the wiki body's spelling** (Sean, 2026-11-16), so "Azirr" on
    the wiki still matches an imported "Alzirr". A system marked `single_hex_only` never matches
    in bulk.
  * **The mainworld's UWP on load is TravellerMap's** (the one already on the user's map);
    every other body comes from the wiki (Sean, 2026-11-16). 21 mainworlds differ (e.g. Arkadia:
    wiki E446845-6, TravellerMap E546845-6); the wiki's value stays in the snapshot and the
    differences are listed in the report. Settles the old question 7.
  * **A single hex:** no matching. The user **chooses any snapshot system** to put in that hex.
* **A hex that already has system details** (generated, or edited in the System Editor):
  **ask first.** Hexes with no system details are filled silently; for those that already have
  one, warn the user and let them replace or skip.
* **Loader rulings (Sean, 2026-11-16) — how snapshot bodies become a T5 system:**
  * **Companion star roles by orbit band**, using the wiki's orbit, or the orbit nearest its AU:
    **0–5 Close, 6–11 Near, 12+ Far** (the T5 generator's ranges), at the wiki's distance. Where
    it comes from: an orbit-row star has its orbit + AU; a companion with its own system box
    takes its distance from the star template's notes ("Approximately 120 AU…", Darida "5,000
    AU", Dywosik "In Orbit 11"), matched to the template by position and type (2nd box ↔
    template Secondary) — all 12 have one.
  * **A second star in the primary's own field** (Regina's Speck, Kusyu's Saietaie, Collace's
    Sonor, Corella B, Rovick's Solox, Risek's M3 V) is a **Companion of the primary inside
    orbit 0**, the generator's placement (`T5_COMPANION_AU`, 0.05 AU).
  * **Every size-0 planet** (and companion-star planet) **loads as a Planetoid Belt**; size-0
    moons stay moons.
  * **Rings are kept as ring moons**: size R with their UWP, in the planet's moon list (59: 56
    size-R UWPs + 3 written "Ring"). The views must cope with size R — check each.
  * **Sol's Kuiper Belt objects load as the belt's moons**, keeping their AU distances.
  * **The single-hex option brings the wiki's mainworld** (name and UWP replace whatever the
    hex had). **Bulk loading keeps the map's mainworld** (above).
  * **Star luminosity: loaded stars get the same estimate generated T5 stars get** (Sean,
    2026-11-17). T5 has no official luminosity rule; the figure is a display-only approximation
    from the type letter alone, `T5_Stellar_Engine.estimateT5Luminosity(type)`, which both
    `generateStar()` and the loader's `_newStar()` call. Nothing in T5 generation reads it (HZ
    comes from `HZ_DATA`). Systems loaded before this have no `luminosity` and still show `?`.
* **How the app gets the snapshot: a plain script loaded with every page** (Sean,
  2026-11-16). A build step (not built yet) writes `js/otu_system_data.js` from `clean/` —
  the merged `systems[]` plus sector, hex, subsector, name, `travellermap.Name`,
  `single_hex_only`, snapshot date — with the tracing stripped (`raw`, `name_raw`, `flags`,
  `sources`, `infoboxes`, `star_templates`): **~166 KB minified** (measured 2026-11-16), down
  from today's 547 KB. It keeps its `<script>` tag in `hex_map.html` (~114). No `fetch` —
  that breaks under `file://`; `names.js` (774 KB) already loads the same way.
* **Fields the wiki doesn't give:** **derived fields are filled; everything else is left
  blank.** "Derived" means worked out from the published values by a fixed rule (for example
  trade codes from the UWP); anything T5 would *roll* stays blank. **No bodies are added**
  beyond those the snapshot lists.
* **The field-by-field list for loaded non-mainworld bodies** (Sean, 2026-11-16; the mainworld
  keeps the user's map values). Read from the T5 engines (`t5_world_engine.js`,
  `t5_topdown_generator.js`):
  | Field | On load | How |
  |---|---|---|
  | name, orbit, distance, kind, UWP digits, moons, stars | **from the snapshot** | — |
  | diameter, gravity, mass, density | **blank** (Sean: even though a fixed table could give them) | — |
  | trade codes | **derived** | `calculateT5TradeCodes` from the UWP (+ Re where the snapshot has it) |
  | climate code + climate text | **derived** | Chart D (`applyT5ClimateCode` / `calculateT5Climate`) from orbit − HZ orbit (HZ from the star type, `getStarHZ`); Tz in orbit 0/1 |
  | Rotation | **derived** | "Tidally Locked to Star (no day/night cycle)" for a planet in orbit 0/1, else "Undefined (Referee Discretion)" |
  | world type (Inferno, IceWorld…) | **blank** — rolled (1D) | — |
  | a moon's Close/Far and orbit letter | **blank** — rolled (2D / Flux) | so **no Lk** and no "Tidally Locked to Parent" |
  | gas giant size letter (M–X) | **blank** — rolled (2D) | the wiki's Small/Large and `size_value` are kept as written |
  | bases on non-mainworld bodies | **blank** — rolled | — |

**What the wiki survey found (2026-11-16, ~45 read-only API requests).**
* **`api.php` works** (MediaWiki 1.35.4). The licence page is titled "Traveller Copyright".
* **The detailed data is the pages that use `Template:InfoboxSystem`: 100 in the main
  namespace.** The template itself adds `Category:Systems` (106 members), so the category and
  the template users are the same set — the old scrape missed almost nothing. **The fetcher
  should list pages by `list=embeddedin&eititle=Template:InfoboxSystem`, not by category.**
* **Store wikitext, not HTML** (settles the old question 1). `InfoboxSystem` has named fields:
  `name`, `sector`, `subsector`, `hex`, `star`, `type`, then orbits `P0…P20` / `Dist#` / `UWP#`
  and up to 12 moons per orbit `P#M1…P#M12` / `Dist#M#` / `UWP#M#`. Fields are found by
  brace-matched template parsing (templates and `[[links]]` nest inside values).
* **All 101 pages are saved** in `otu_systems/raw/` (`<title>.wiki`, CRLF; `:` `/` etc. → `_`)
  with `raw/index.json` (title → file, pageid, revid, timestamp; fetched 2026-11-16).
* **The template holds ONE star.** Companions appear three ways: (a) a **second `InfoboxSystem`
  call** on the same page for a companion's own subsystem (13 pages; named "Far Companion:
  Darida", "X Secondary", "Companion: …"); (b) a **star written into an orbit row** — the UWP
  field holds a spectral type (19 rows, e.g. Caladbolg `P10 = Companion 1`, `UWP10 = M0 V`);
  (c) a **close pair in the primary's own fields** (`star = Lusor/Speck`, `type = F7 V / BD`).
  Separately, 30 pages carry a `BinaryStarSystem` / `TrinaryStarSystem` template (61
  `MonostellarSystem`, 10 none) that gives every star's name, type and free-text notes.
* **The UWP field is often not a UWP** — 271 values: gas giants written ~15 ways (`Large GG`,
  `LGG`, `Small GG`, `SGG (Size 52)`, `LGG (Size=140)`, `GS4`, `GLG`, `Gas Giant`, `Ice Giant`,
  `Hot GG`, `GG`…), `(Empty Orbit)` (44), `Ring`, `?`, `(Variable)`, descriptions (Antares'
  "Chromosphere Radius"), and malformed UWPs (`G2200269-9`, `E000000B` with no dash,
  `H500000-C RE`). Valid UWPs are often wrapped in `<small>`, `''`, `'''`.
* **Distances use mixed units:** plain numbers (AU for orbits, 921), `N Diam` (249, moons),
  `R= N` and `N Radii` (moons), `N<small>AU</small>`, `?` (73), `~N`, `<N`, `N-N`.
* **Some systems are split across pages; some pages duplicate others.** Sol (Solomani Rim 1827)
  is spread over `Jupiter (world)`, `Neptune (world)`, `Kuiper Belt (world)` and
  `Terra (system)` — each holding only its own orbits — so **pages must merge by sector + hex.**
  Duplicates of one system: Deneb/Gashimuu, Dril/Home, Kuzu/Kusyu, Pax Rulin/WIllbo, and five
  pages for Massilia 0402 (one "ca 1200"). Mire and Rydem both claim Spinward Marches 0527.
  Not real systems: `Sandbox`, `Lair (system)/secret` ("Pocket Universe"),
  `Antares (system)/meta`, `Whanga (world)/landgrab` (no infobox).
* **Coverage:** 7 pages fill only one orbit (mostly split or partial systems); most fill 5–12.
  23 pages list no moons.
* **Also on the wiki, not yet used:** the six star templates are on ~14,000+ world pages
  (`MonostellarSystem` and `BinaryStarSystem` each over 6,500, `TrinaryStarSystem` 1,009) —
  stars only, no planets.

**As built — the offline parser (2026-11-16): `utilities/wiki_parse.py`.** Run
`python utilities/wiki_parse.py` (set `PYTHONIOENCODING=utf-8` in Git Bash). Reads `raw/` +
`corrections/`, rebuilds `otu_systems/clean/` from scratch (85 systems from 101 pages) and
writes `otu_systems/parse_report.md`. Never contacts the wiki; all output CRLF.
* **It invents no game facts.** Every body keeps its `raw` wiki value beside the reading
  (`kind`: world / gas_giant / ring / empty / star / unknown; `uwp`; gas giant `size_class` from
  the words Small/Large and `size_value` from "Size N"). Anything that is a guess about
  notation is **flagged** and listed in the report (e.g. `gg-code-notation`: `GS4` read as
  Small). Units: `InfoboxSystem` prints " AU" after every orbit distance, so a bare orbit
  number is AU; **a bare moon number is planetary diameters** (Sean, 2026-11-16 — the same as
  the moons written "N Diam"), stored as `unit: "Diam"` with `unit_assumed: true`; **"R= N"
  and "N Radii" are planetary radii** (Sean, 2026-11-16), stored as `unit: "Radii"`.
* **Several pages for one system: keep all of them and merge (Sean, 2026-11-16).** One file
  per sector + hex. Infoboxes naming the same primary star are merged into one entry in
  `systems[]`: one body per orbit number, moons matched by name within an orbit (the nth
  "Moon" or "Ring" matches the nth on the other page); each merged body lists its `sources`.
  **Where pages disagree, the higher-priority page's value is kept provisionally** — a
  `page_priority` correction, else "(system)" pages first, then alphabetical — and **every
  disagreement is listed** in the report ("Where merged pages disagree", 48 on 2026-11-16).
  **Two infoboxes on the same page are never merged** (Kwan names both stars "Primary", Grille
  names neither); a companion's own subsystem is its own entry. `infoboxes[]` keeps each page's
  box as read, for tracing. The name comes from a correction, else the first infobox on a
  "(system)" page, else the first infobox.
* **Sector spelling:** "Trojan Reaches" → **"Trojan Reach"** (Sean, 2026-11-16; the app's
  sector lists use "Trojan Reach"). Done as `corrections/Trojan Reaches 2204.json` (Pax Rulin).
* **A star written into a planet row is a companion star occupying that orbit, at that
  distance, and the bodies listed under it are its planets** (Sean, 2026-11-16). 19 such rows in
  16 systems. The parser stores them as `kind: "star"` with `planets[]` (not `moons[]`). The
  wiki nests one level deeper inside those rows, so **a following body in diameters/radii, or
  marked "»»", is a moon of the planet above it** (Porozlo: Glint → Czaczezhnia at 0.2 AU →
  rings and moons at R= 1–55); each is flagged `companion-moon-nested` (6). "»"/"»»" indent
  markers are stripped from names.
* **Gas giant codes** (Corella's `GS3` / `GS4` / `GLG`): **GS = Small, GL = Large, a trailing
  digit kept as `size_value`** as written (Sean, 2026-11-16). Gas giants written without
  Small/Large ("Gas Giant", "GG", "Hot GG", "Ice Giant" — 14) have no `size_class`.
* **Malformed UWPs are fixed one by one by Sean** (2026-11-16), as `bodies` corrections with
  `uwp_source`: Regina / Diuur lmar `G2200269-9` → **G200269-9** (from travellermap.com);
  Masiruu's two "UN"s → **X100000-0** (orbit 2) / **X200000-0** (orbit 3); Zivije Myshka →
  **E200101-B**, Dun → **E300209-C**; Jae Tellona's four Uunkida Gar moons → **Y???000-0**.
  None are left. **Sean's pointer: travellermap.com is where to look for a final answer on an
  ambiguous UWP** — but its data API (`/data/<sector>/<hex>`) holds only the **mainworld**
  (UWP, `Stellar`, PBG, bases…), checked 2026-11-16 on Regina, so it can settle mainworld
  UWPs and star lists, not other bodies.
* **Sol's Kuiper Belt is a planetoid belt in orbit 10, no UWP, 30–100 AU, with its 13 objects
  inside it** (Sean, 2026-11-16): `kind: "belt"`, `distance {min: 30, max: 100, unit: "AU"}`,
  objects in `objects[]` (a belt's listed bodies are moved from `moons[]` to `objects[]`). The
  Kuiper page's "Ultima Thule (Arrokoth)" is dropped as the same object as Terra's "Ultima
  Thule" (44.58 AU; the names differ, so the merge couldn't pair them).
* **Emerald's Ashakha "2,8" is 2.8 AU** (a comma for a decimal point; Sean, 2026-11-16).
* **Antares rows 6 and 8 are dropped** — they give Antares A's chromosphere and pulsation
  radii, not bodies (Sean, 2026-11-16).
* **Which page wins where merged pages disagree** (Sean, 2026-11-16, as `page_priority`
  corrections; a stated priority marks those disagreements settled, so the report lists 0 open):
  Sol → **Terra (system)** (Neptune 30.1 AU and its moon distances; the Jupiter/Neptune pages'
  "Rings" dropped as Terra's "Ring System"); Dril → **Dril (system)**; Massilia 0402 →
  **Kaggushus (world)** (name forced to "Kaggushus", not its "(ca 1200)" label); Kusyu →
  **Kuzu (system)** (Kusyu (world)'s "Tehkuhiye Ring" dropped as the same ring as Kuzu's "Ring").
* **"Re" after a UWP is the trade code Re** (Sean, 2026-11-16; Massilia 0402's Gamma and
  Ishdaga) — a parser rule, stored as `trade_codes: ["Re"]`. Other text after a UWP ("Worldlet",
  "Size=0.5AU") stays a `remark` the loader ignores.
* **Star types: where the wiki's system box and its star template disagree, TravellerMap's
  `Stellar` is the final answer** (Sean, 2026-11-16). Checked 8 hexes on travellermap.com:
  Dywosik → G5 V, Ziruushda → M1 V, Gateway's Gagamshuu → M9 V, Kusyu → G4 V + D, Kaggushus →
  M1 V, Risek gains its M3 V "Secondary", Jae Tellona → F9 V; Algol's data already had
  TravellerMap's K2 IV. Done with the `infobox_stars` correction (`"<page>"` or `"<page>#<n>"` →
  the star list, applied before merging) and `stars_settled: true`, which drops the system from
  the report's star-mismatch section. Space-joined pairs ("Gorie Sonor" / "F1 V M3 V") are now
  split by the parser, taking names from the star template; "A & B" names split on " & ".
* **Parser matching rules added 2026-11-16:** a trailing "(SR 1827)"-style link tag is dropped
  from body names; moons match across pages ignoring a trailing bracketed alternate name
  ("Kaleal (Kihyo)" = "Kaleal").
* **The mainworld is marked `mainworld: true`** on one body per system. The parser finds it by
  TravellerMap's name for the hex, read from **`otu_systems/travellermap_mainworlds.json`**
  (TravellerMap's mainworld Name/UWP/Stellar/PBG/Bases/Remarks for every snapshot hex, fetched
  2026-11-16 with 21 sector requests to `/api/sec?type=TabDelimited`; refresh it with the
  snapshot), so the parser stays offline. A `mainworld: "<name>@<orbit>"` correction overrides
  the match: 9 systems spell their mainworld differently on the wiki (Algol's is literally
  "Mainworld"; Azirr, Nova P., Antares Belt, Kasigi, Fomalhaut Prime, Daryen, Pallique,
  Roikhoi), each picked as the one body with TravellerMap's UWP (Sean, 2026-11-16). 85 of 85
  are marked; the report's "No mainworld found" is 0.
* **Hiemalis is at Aldebaran 0425**, not the wiki's Massilia 0425 (TravellerMap has it there,
  same UWP; Massilia 0425 is Zaibeth) — a `sector` correction (Sean, 2026-11-16).
* **Dynam (wiki: Lishun 1219) is kept for single-hex loading only** — TravellerMap has Depot
  at that hex and no world named Dynam (Sean, 2026-11-16): correction `single_hex_only: true`,
  written to the clean file.
* **Correction keys can carry `@<orbit>`** — `"<page>|<name>@<orbit>"` — for a page with two
  bodies of the same name (Masiruu has four "UN"s); for a moon or a companion's planet it is
  the orbit of the row above. A plain key matching several bodies is reported as AMBIGUOUS
  (proved: a plain `Masiruu (world)|UN` hit 4). The report leaves out flags on corrected bodies
  and excluded pages.
* **Pages that aren't systems are excluded** (Sean, 2026-11-16): `Sandbox` (Sol test copy),
  `Lair (system)/secret` (a "Pocket Universe"), `Antares (system)/meta` — `exclude_pages`
  corrections in `Solomani Rim 1827.json`, `Provence 2402.json`, `Antares 2421.json`.
* **Corrections** (`otu_systems/corrections/<Sector as the wiki writes it> <hex>.json`):
  `exclude_pages` [titles], `page_priority` [titles, winner first], `name`, `sector` (renames;
  the clean file then takes the new sector name), and `bodies` keyed `"<page title>|<body name>"` → field overrides or
  `{"drop": true}`. A key that matches nothing is reported. Tested 2026-11-16 with temporary
  files (excluding Sandbox cut Sol's orbit collisions 13 → 3; a drop, an override, a sector
  rename and an unmatched key all behaved), then removed.
* **Known as of the first run:** 22 sector names, including both "Trojan Reach" and "Trojan
  Reaches"; 3 unreadable distances (`30-100` twice, `2,8`); 22 stars written into orbit rows;
  254 moon distances with no unit, 64 in `R=`/Radii; Sol spread over 5 pages (one of them
  `Sandbox`). The report holds the full lists. **Every one of these is Sean's to rule on, one
  question at a time** — they become corrections or parser rules.
* **As built — the build step (2026-11-16): `utilities/wiki_build.py`.** Run it after
  `wiki_parse.py`. It writes **`js/otu_system_data.js`** (GENERATED — never hand-edit):
  `window.OTU_SNAPSHOT = { snapshot, parserVersion, buildVersion, systems: [...] }`, one system
  per line (a refresh diffs as the changed systems' lines), CRLF, 167,492 bytes for 85 systems.
  Each system: `sector`, `hex`, `subsector`, `name`, `single_hex_only` (when set),
  `travellermap_name` (what bulk loading matches on), `travellermap_uwp`, and the merged
  `systems[]` (star groups → `orbits[]` → `moons[]` / `planets[]` / `objects[]`; one body per
  system has `mainworld: true`). Stripped: `raw`, `name_raw`, `flags`, `sources`, the per-page
  `infoboxes` and `star_templates`, and the corrections' `*_source` notes. It refuses to build
  from clean files of mixed snapshot dates or parser versions. A rebuild is byte-identical.
  **Verified in the running app 2026-11-16:** the page loads it with no console errors
  (85 systems, 85 mainworlds; Regina A788899-C marked; Dynam `single_hex_only`).
  **The old constants `OTU_LOCATIONS` / `OTU_STARS` / `OTU_WORLDS` are gone**, so the old
  loader `applyOtuSystemData()` now logs "Constants not loaded — skipping enrichment." and does
  nothing (checked: no throw). It is unreachable from the UI anyway, and the new loader
  replaces it. (The built-in browser pane served the old file after the first reload; a
  `{cache:'reload'}` fetch plus a second reload fixed it — the known pane trap.)
* **More rulings from building the loader (Sean, 2026-11-16):**
  * **A row named "… Belt" with no UWP gets Y000000-0** (so it loads as a belt) — a parser rule,
    flagged `belt-uwp-assumed` (5). **A row with no name, or only dashes, and no UWP is an empty
    orbit** (layout filler), flagged `placeholder-row-empty` (17).
  * **A gas giant the wiki gives no Small/Large defaults to Small** (14) — the loader sets
    `wikiClassDefaulted`, and the System Editor now saves an unclassed one (`ggType` 'GM') as
    Small, matching its Size dropdown (it used to save it as Large).
  * **On a System Editor Save, a gas giant with no size letter rolls one within its own class**
    (Small M–N, Large P–X): `createBodyPlaceholder` (`t5_topdown_generator.js`) rerolls the
    same 2D table until the class matches. It used to roll from the whole table (Regina's Small
    Burgund got "U").
  * **The System Editor keeps a star's name and a T5 companion's own distance** —
    `_buildSeedSys` (`system_editor.js`) keeps a real name (`_keepStarName`: not empty, not just a
    spectral type, not a bare role word; such names are still rebuilt from the type), and sets
    `keepDistAU` while a star's orbit is unchanged, which `_initStars` honours. **This applies to
    every edition's star names** (they are only kept, never invented); checked unchanged on a
    generated T5 and an MgT2E system. It used to rename Lusor "F7 V" and move Darida from its
    published 5,000 AU to orbit 16's table 4,900 AU.
  * **A body whose UWP has a '?' digit, or no UWP, gets no trade or climate codes** — the
    engine reads a missing digit as 0, so they would be invented (Porozlo's `???????-?` got
    "As Va Ba"). Rotation still applies (it depends only on position).
* **As built — the loader (2026-11-16): `js/add_otu_system_info.js`**, rewritten (it is the
  existing module for this; the old code is gone). API on `window.PublishedSystems`:
  `list()`, `find("<Sector> <hex>")`, `match(hexId, state)`, `build(snap, {mapMainworld})`,
  `hasSystemDetails(state)`, `applyToHexes(hexIds|null, {confirm, quiet})` (bulk; null = whole
  map), `loadIntoHex(hexId, key, {confirm})` (single hex). `window.applyOtuSystemData()` is still
  the importers' hook and now runs `applyToHexes(null)`.
  * **Bulk:** a `SYSTEM_PRESENT` hex matches when its sector name (`window.sectorNames[slot]`),
    hex number and name equal a snapshot system's sector, hex and `travellermap_name`
    (punctuation/case ignored); `single_hex_only` never matches. Hexes already holding this
    snapshot's system are skipped silently; hexes with other system details trigger ONE
    `confirm()` for the batch (OK replaces them, Cancel keeps them while the rest load). One
    `saveHistoryState('Load Published Systems')` per run (Ctrl+Z works); then
    `dbManager.scheduleSyncAll()`, `reapplyAllRules()`, redraw, and a toast (unmatched hexes are
    counted there and listed in the trace log). The map's `t5Data` and `t5Socio` are kept; other
    editions' system fields are cleared.
  * **Single hex:** the wiki's mainworld becomes `t5Data` (PBG from the placed bodies,
    `homestar` from the stars), `t5Socio` cleared, `name` = the mainworld's.
  * **What it writes:** `t5System = { mainworld, stars, sggCount: 0, hzOrbit, wikiSnapshot }`.
    `wikiSnapshot {snapshot, sector, hex, name}` is a new **optional** field (absent on every
    other system; the System Editor drops it on Save). Bodies carry optional `wikiPublished`,
    `wikiDistance {value|min,max, unit}`, `wikiSize`, `wikiRemark`, `wikiTradeCodes`,
    `wikiClassDefaulted`. Orbit slots take the wiki's AU as `distAU`. Companion-star planets go
    to the orbit nearest their AU. Rings are `type: 'Ring'`, size 'R'; size-S worlds keep 'S'.
  * **Verified in the running app 2026-11-16** (Spinward Marches imported from TravellerMap,
    all 29 snapshot systems there): every one renders in the orrery, hex accordion and System
    Sheet with no console errors; Regina, Porozlo (companion planet + ring moons) and Sol
    (single hex, 13 Kuiper objects) read correctly field by field; "ask first" both ways; undo;
    single hex onto an occupied hex asks; System Editor Save twice keeps all 25 Regina bodies,
    star names, Darida's 5,000 AU and in-class GG letters; a saved map with loaded systems
    reloads byte-identical through `applyLoadedMapData`; `sectors/solo_6.json` still loads
    (3,557 systems) and renders; Obsidian (144 files) and HTML (69) exports of subsector C
    contain the loaded system. **Test trap:** a TSV loaded with `importT5Tab` names the sector
    by its short code ("Spin"), so bulk matching finds nothing until `sectorNames` holds the
    full name — the Imperium/Universe importers set the full name; check that the Import
    Sector (.tsv) path does before relying on it.
* **As built — the UI (2026-11-16):**
  * **Import checkboxes** "Published System Data (planets & moons)", unticked by default, in
    Import the Imperium (`#otu-opt-system-data`), Import the Universe
    (`#universe-opt-system-data`) — both were `display:none` — and Import a Neighbourhood /
    Custom OTU Import (`#neighbourhood-opt-system-data`, `#custom-otu-opt-system-data`, new; the
    two `importSystemData = false` lines in `otu_importer.js` now read them). **The hook loads
    only into the sectors just imported**: `applyOtuSystemData(slotNums)` (both call sites pass
    the imported slots; no argument = whole map).
  * **Import menu → "Import Published Systems"** (`#btn-import-published-systems`, after Custom
    OTU Import): bulk over the whole map.
  * **Right-click → "LOAD PUBLISHED SYSTEM…"** (`#ctx-load-published`, after WORLD DETAILS;
    visibility set in `canvas_input.js` beside WORLD DETAILS): shown when any hex is selected.
    One hex → the picker; several → "LOAD PUBLISHED SYSTEMS", bulk over the selection.
  * **The picker** (`#published-system-modal` in `hex_map.html`; logic in
    `add_otu_system_info.js`): all 85 systems by name ("Name — Sector hex"; Dynam marked "not
    on TravellerMap"), a filter box, Enter / double-click to load, Esc to cancel; it preselects
    the hex's own published system when there is one.
  * **Sector short codes:** `travellermap_mainworlds.json` now holds `sector_abbreviations`
    (TravellerMap's codes for the 21 sectors, from one `/api/universe?requireData=1` request);
    the parser writes `sector_abbreviation` per system and the build carries it, so **bulk
    matching accepts "Spin" as well as "Spinward Marches"** — a sector imported from a .tsv file
    is named by its code (this closes the test trap noted above).
  * The toast says what happened: loaded N; "nothing new to load" when all already have it;
    kept as they were; not matched (see the log).
  * **Verified in the running app 2026-11-16:** all four checkboxes show, unticked; a real Import
    the Imperium of Spinward Marches with the box ticked loaded 29 systems, only into slot 1; a
    real Neighbourhood import centred on Spinward Marches (sector data only) loaded 34 (Spinward
    Marches 29, Deneb 2, Trojan Reach 2, The Beyond 1) inside the 3×3 block and left the existing
    slot 1 alone; the whole-map button matched Regina under the code "Spin"; the right-click
    item is hidden with nothing selected, singular for one hex (picker opens, filter, load
    Caladbolg into an empty hex, preselects Regina on Regina's hex, Cancel closes), plural for
    several. No console errors.
* **As built — the fetcher (2026-11-17): `utilities/wiki_fetch.py`.** Lists every
  main-namespace page using `Template:InfoboxSystem` (`generator=embeddedin`, 500 per request),
  compares each page's latest revision with `raw/index.json`, and downloads only new or changed
  pages (50 per request). Polite: generic User-Agent naming no person or project, 2 s between
  requests, `maxlag=5` with the server's Retry-After honoured, retries with a growing wait.
  `--dry-run` reports NEW / CHANGED / GONE and writes nothing; `--prune` drops pages the wiki no
  longer has (default: reported and kept); `--travellermap` rewrites
  `travellermap_mainworlds.json` (one TSV request per snapshot sector + one `/api/universe` for
  the short codes; the TSV's star column is called `Stars`, stored as `Stellar` — it was empty
  in the first hand-made file, filled for all 85 since).
  * **`index.json` dates:** `fetched` is the snapshot date and **moves only when a downloaded
    page's text actually differs** (a new revision can leave the text the same), or when pages
    are pruned; `checked` records every run. So a refresh that finds nothing keeps the snapshot
    date, and loaded systems' `wikiSnapshot.snapshot` stays current.
  * **Verified 2026-11-17:** dry run — 100 pages on the wiki, none new or changed;
    `Whanga (world)/landgrab` reported GONE (it is in Category:Systems but never used the
    template; kept unless `--prune`). A faked older revision for one page → exactly that page
    re-downloaded, identical text, snapshot date unchanged; the same with the saved text altered
    → 1 page "with different text", snapshot date moved; then everything restored (`fetched`
    2026-11-16, `checked` 2026-11-17). The full sequence below rebuilt `js/otu_system_data.js`
    byte-identical.
* **The refresh procedure (every 6–12 months, developer only):**
  1. `python utilities/wiki_fetch.py --dry-run` — see what changed.
  2. `python utilities/wiki_fetch.py` (add `--prune` to drop pages the wiki removed).
  3. `python utilities/wiki_parse.py` — read `otu_systems/parse_report.md`; every new item is a
     question for Sean, one at a time; rulings go into `otu_systems/corrections/`.
  4. `python utilities/wiki_fetch.py --travellermap`
  5. `python utilities/wiki_parse.py` again (mainworld marking uses the fresh TravellerMap data).
  6. `python utilities/wiki_build.py` — writes `js/otu_system_data.js`; load it in the running
     app and spot-check a few systems.
  Set `PYTHONIOENCODING=utf-8` in Git Bash. Needs `requests` (`python -m pip install requests`).
* **Changelog (updated 2026-11-18): v0.19.0 items 1–13** in `changelog.md` and `README.md`
  (identical copies; still "In Progress", not dated): items 1–7 (2026-11-17) are published
  system data, the import checkbox, Import Published Systems, Load Published System
  (right-click), the two System Editor fixes (star names / companion distance; T5 gas giant
  size class) and the Import/Export hover text; item 8 is wiki star luminosity; items 9–12 are
  the 2026-11-18 MgT2E editor fixes (typed atmospheres, added moons, tidally locked Hill
  Sphere, typed TLs); item 13 is MgT2E rings in the System Editor. The developer tools (fetcher, parser, build) have no items — they are
  not user-facing.
* **Import/Export hover text (2026-11-17), changelog item 7:** every Import / Export button in
  Settings has a `title=` hover sentence, checked against each handler (Universe and Custom OTU
  erase the map; Export Sector also writes the .xml). Import Published Systems uses Sean's
  wording. Kept the whole-map button (Sean, 2026-11-17): it is for maps already imported.
* **Renamed (Sean, 2026-11-17):** "Import the Universe" → **Import the OTU Universe**, "Import a
  Neighbourhood" → **Import an OTU Neighbourhood**, "Import Published Systems" → **Import
  Wiki-Published Systems** (button, modal titles, warnings, the Custom OTU map legend and size
  warnings, README usage guide, v0.19.0 changelog). Element ids are unchanged. Released
  changelog entries keep the old names. Older notes in this manifest use the old names.
  The import dialogs' checkbox is now **Wiki-Published System Data (planets & moons)**
  (Sean: "published" means in a book; ours come from the wiki).
  Likewise the right-click item (**LOAD WIKI-PUBLISHED SYSTEM…** / **…SYSTEMS**), the picker
  title (**Load Wiki-Published System**), the undo labels and the loader's confirm and toasts.
  Function names, ids and log tags (`[Published Systems]`) are unchanged.

**Not decided yet — ask Sean, one at a time, when each comes up:**
3. **The wiki's content licence** — shipping a snapshot redistributes its text. Sean's call.

**What is already there (found 2026-11-16; the old pipeline, to be replaced or reused):**
* `utilities/scrape_wiki.py` — scrapes the rendered pages of `Category:Systems` into SQLite,
  cleaning as it goes (drops `??`/`—`, tidies spectral types like `F9 IV-V` → `F9 V` and
  `G2V` → `G2 V`, splits `Lusor/Speck`-style star pairs, links moons to planets). It **drops
  every table on each run** and writes `traveller_systems.db` into whatever folder it is run
  from.
* `otu_systems/traveller_systems.db` (tables `locations` 91, `stellar_details` 130,
  `system_details` 1,527 — 663 moons, 79 with no UWP) and its JSON exports `locations.json`,
  `stellar_details.json`, `system_details.json` (same counts; the `.db` is dated 4 days later
  than the JSON, so they may differ).
* `js/otu_system_data.js` — was the three JSON files embedded as `window.OTU_LOCATIONS`,
  `OTU_STARS`, `OTU_WORLDS`; **replaced 2026-11-16 by the build step's `OTU_SNAPSHOT`**
  (above). Still loaded at `hex_map.html` ~114.
* `js/add_otu_system_info.js` — **rewritten 2026-11-16 as the new loader** (above).
  `applyOtuSystemData()` is still called from `js/otu_importer.js` (sector import ~452,
  `executeBulkImport` ~732) when `opts.importSystemData` is set.
* **Switched off in the UI:** the "Published System Data (planets & moons)" checkboxes
  `#otu-opt-system-data` and `#universe-opt-system-data` (`hex_map.html` ~1423 / ~1491) are
  `display:none`, and the Neighbourhood and Custom OTU imports set `importSystemData = false`
  outright. A comment at `js/io_manager.js` ~1911 notes that the T5 star-name reconstruction
  for D/BD stars can't be parsed back by the loader's `parseStarType()`.

#### v0.19.0 — TYPED MgT2E ATMOSPHERES (bug fix, ruling Sean, 2026-11-18) — BUILT

**The bug (production report, reproduced in dev).** MgT2E System Editor: +World, type
`X860000-0` into the UWP seed boxes, Save → the atmosphere sometimes changed (6→7, or 6→A/B/C).
15 of 43 Bottom-Up systems failed on the first Save, more on each re-save. It looked fixed in dev
only because it is dice-dependent. Moons typed the same way failed too.

**Cause.** `generateAtmospherics` (`js/mgt2e_world_engine.js`) honoured a typed atmosphere
(`isAtmSeeded`) in the base roll and the non-HZ shift, but **Runaway Greenhouse** and the
**Auto-Taint loopback** guarded only `isMainworldLocked`.

**Ruling — do not reopen.** A typed atmosphere code is **never changed by generation**. It is
treated **exactly like a locked mainworld's**: Runaway Greenhouse still rolls and still flags the
world `runawayGreenhouse` / Boiling but keeps the code; Auto-Taint moves ppo into the safe range
and drops the Low/High Oxygen taint instead of flipping 5/6/8 → 4/7/9. Built as one flag,
`isAtmFixed = isMainworldLocked || isAtmSeeded`, used at those checks.

**Verified in-browser (2026-11-18):** 43/43 worlds and 25/25 surviving moons keep the typed UWP
through Save and two re-saves; with the fix switched off the same 15 worlds fail again; unseeded
generation of the 43 systems is byte-identical to before the fix.

**Not addressed — two separate items, unscheduled:**
* **The TL change** in the same report — resolved, see "TYPED MgT2E TECH LEVELS" below.
* **A moon added with +Moon could vanish on Save** — now fixed, see the next section.

#### v0.19.0 — MOONS ADDED IN THE MgT2E EDITOR (bug fix, ruling Sean, 2026-11-18) — BUILT

**The bug.** A moon added with +Moon was lost on Save in 18 of 43 Bottom-Up systems. Three causes:
1. **Hill Sphere rules** (`mgt2e_world_engine.js`, "3. Hill Sphere & Roche Limit"): Hill Sphere
   Wipe (limit < 1.5 pd), Moon Discarded and Roche Shred deleted it — only the mainworld moon was
   protected.
2. **Placement:** `_addMoon` (`system_editor.js`) always put the moon 5 pd beyond the outermost
   moon, often outside the limit, so Roche Shred destroyed it.
3. **Trim bug:** `SeedRestoration.trimGeneratedMoonsToSeededCaps` sliced the orbit-sorted list
   to the seeded count, so a seeded outer moon was cut and a newly rolled inner one kept.

**Ruling — do not reopen.** A moon the user adds in the editor is **protected like the mainworld
moon** from all three destruction rules. An added moon does **not** trigger the gas giant upscale
(GS→GM→GL) that a mainworld moon does — it never resizes its parent (Sean, 2026-11-18).

**As built.**
* New optional saved field **`editorAdded: true`** on the moon (MgT2E `mgtSystem` moons only).
  Set by `_addMoon`, carried by `_buildMoon` and the MgT2E adapter's `write()` (only written when
  true). Absent in older saves = not protected, as before. `solo_6.json` loads and edits cleanly.
* The engine's `_isProtectedMoon` = mainworld moon, `isMoon`, or `editorAdded`.
* Trim keeps the seed's moons (they carry the editor's `_id`) ahead of rolled ones, then re-sorts.
* Placement: +5 pd if that fits the Hill Sphere; else halfway to the limit if ≥ 2.5 pd room;
  else 1.25 pd beyond the outermost moon, or max(1, 0.9 × limit) with no moons, plus a reworded
  "Hill Sphere Crowded" warning. Never placed inward of an existing moon. MgT2E-only in effect
  (`hillSpanPd` exists only there).
* `_assignMoonNames` (`core.js`, shared) skips letters already taken, so an unnamed moon can't
  take a named one's name. Fresh generation names are unchanged; existing names never change.

**Verified in-browser (2026-11-18):** 43/43 added moons kept with their typed UWP through Save and
a re-save, flagged, none inward, none closer than 1 pd, no duplicate names. With protection and
the trim fix switched off, 9 are lost again. Unseeded generation is unchanged (same fingerprint).

**Found and fixed — see the next section:** the Hill Sphere limit of the same world differed
between the map generator and an editor Save.

#### v0.19.0 — HILL SPHERE USES THE FINAL ECCENTRICITY (bug fix, ruling Sean, 2026-11-18) — BUILT

**The bug.** A world's stored `hillSpanPd` differed between map generation and an editor Save
(0608 "Chapelhall I": 2 vs 13 pd). 22 of 387 worlds on the test map, every one tidally locked.
**Not** the star mass. `generatePhysicals` computes the limit (and places moons) with the rolled
eccentricity (0.8); later `executeTidalLockRoll` re-rolls a 1:1-locked world's eccentricity when
it is > 0.1 (→ 0), and the limit was never recomputed. An editor Save seeds the final eccentricity,
so it got the true figure. The formula's (1 − ecc) made the map's figure 5× too small.

**Ruling — do not reopen.** The Hill Sphere limit uses the world's **final** eccentricity, after
the tidal-lock re-roll. (The rules files say nothing on the order.) Moving the re-roll ahead of
moon generation is not an option: the lock roll depends on the moons.

**As built.** `executeTidalLockRoll` (`mgt2e_world_engine.js`, "Locked Ecc Override") recomputes
`hillSpanPd` with the same formula and star (`sys.stars[0]`) as `generatePhysicals`. Moons already
placed are left alone — a lower eccentricity only widens the limit. Only the editor (`_addMoon`
placement and its warning) reads `hillSpanPd`; nothing in generation, display or export does.

**Verified in-browser (2026-11-18):** fresh map 0/387 stale (was 22); a no-edit editor Save of
all 43 systems changes no world's limit; every other field of all 43 systems is byte-identical
with the fix on or off; with it off the 22 come back. `solo_6.json` loads and saves cleanly;
the +Moon test still keeps 43/43.

#### v0.19.0 — TYPED MgT2E TECH LEVELS (bug fix, ruling Sean, 2026-11-18) — BUILT

**Investigation.** With the reported X860000-0 (pop 0) the TL **cannot** change and never did:
860 checks over 172 systems (world + moon, three saves each), all unchanged; every TL writer for a
subordinate needs pop > 0 or sets TL 0. Sean was not sure he saw it. **With pop > 0 it does
change:** in `processSecondaryClassifications` (`mgt2e_socio_engine.js`) the **Mining**,
**Research Base** and **Military Base** rules set TL (to max(MW TL, atm floor) or MW TL) without
checking a typed TL. Rare by dice, so it looked intermittent.

**Ruling — do not reopen.** A typed TL stays as typed; the world **still gets the
classification**. The dice are still rolled, so no other roll in the system shifts.

**As built.** `_tlTyped` (= `_manualFields` includes `'tl'`) guards all three overrides; a kept
TL is logged ("Kept typed TL …"). Note the MgT2E adapter marks every existing body's TL as manual
on an editor Save, so an editor Save never changes an existing world's TL through these rules
either.

**Verified in-browser (2026-11-18), rolls forced to succeed:** X866665-5 (gov 6) on 43 systems →
fix off 22 TLs changed (8 Research, 22 Military, 2 Mining); fix on 0 changed, same
classifications. Unseeded generation byte-identical with the fix on or off. `solo_6.json` loads
and saves with no UWP changes and no errors.

#### MgT2E RINGS IN THE SYSTEM EDITOR (user request; rulings Sean, 2026-11-18) — BUILT

**The request.** A user asked to add a ring to a planet in the MgT2E System Editor. Today it
can't be done: MgT2E keeps rings on the planet as `worlds[].rings` (`{center, span}`), not as
size-R moons as CT does. The editor neither shows nor edits them, and the Size box strips 'R'
for every engine but CT. Generation rolls them (moon-size result R, `mgt2e_world_engine.js`
~514/526/543; Hill Sphere Wipe ~629); only the orrery draws them.

**Rulings — do not reopen.**
* **A ring added in the editor is protected** from the "Hill Sphere < 0.5 pd → rings destroyed"
  rule (~636), the same as added moons (Sean, 2026-11-18).
* **Where rings show:** the editor lists and edits each world's rings, the hex accordion gets a
  "Rings: N" line for MgT2E worlds, and the orrery tooltip names a hovered ring. The System
  Sheet and the exports are unchanged (Sean, 2026-11-18).

**Found while investigating (not yet built, for the builder):**
* No new top-level saved field: `rings` already saves and the adapter carries it
  (`mgt2e_editor_adapter.js` ~194); the seeded ring cap (`SeedRestoration.captureSeededRingCaps`)
  keeps an added ring and drops a removed one. A protection flag on the ring object
  (e.g. `editorAdded`) is optional; absent = not protected, as before.
* `center`/`span` are re-rolled on every Save (~730). Nothing displays them today.
* Each ring costs two dice per Save, so adding one shifts later rolls in that system, the same
  as +Moon; typed/manual fields are unaffected.
* Engine gives rings only to terrestrial worlds and gas giants (skips belts and empty slots);
  the editor button should follow that. No cap on rings per world (the engine has none).
* Orrery hover: `hit.kind === 'ring'` has no tooltip branch (`system_viewer.js` ~1922).

**As built (2026-11-18), changelog item 13.**
* **Engine** (`mgt2e_world_engine.js`, Hill Sphere < 0.5): `w.rings` keeps rings with
  `editorAdded`, logs "WBH Protection"; rolled rings are still wiped.
* **Adapter** (`mgt2e_editor_adapter.js`): `readBodies` copies `w.rings` onto the working-copy
  body as `rings`; `write()` sends fresh copies of `b.rings` (fallback `_raw.rings`; `[]` for a
  belt). Before this, `write()` passed the saved map's own `_raw.rings` array to the engine, which
  could `push()` into it during a Preview. No backfill of rings after Preview (with "Allow
  engine to add additional bodies" ticked, rolled rings would otherwise be locked in).
* **Editor** (`system_editor.js`): **+Ring** on every MgT2E non-belt body (`_addRing` pushes
  `{editorAdded: true}`), a "Rings (N)" list after the moons with ✕ (`_deleteRing`, by index —
  rings have no ids). Undo works (`_pushHistory`).
* **Accordion** (`hex_editor.js`): "Rings: N" in each MgT2E world's stats block.
* **Orrery** (`system_viewer.js`): ring tooltip "Ring [n of N] (Ring System) / Around: <world>";
  world tooltip gains "Rings: N". Ring hit areas are now pushed **after** the world's (the hover
  test runs last-pushed first and the world's r + 9 covered ring 1); the planet disc (within
  r + 3) still hovers the world.
* **Verified in-browser 2026-11-18** (fresh MgT2E bottom-up map, 481 systems, 83 rolled rings):
  +Ring on 43 systems → kept with `editorAdded` through Save and a re-save, no other world's ring
  count changed; ✕ removed one ring on 12/12; Cancel/Discard left the saved map unchanged; on
  worlds with Hill Sphere 0 the added ring is kept, and **with the protection switched off the
  same 2 rings are lost**; accordion and orrery tooltips checked (all three rings of a 3-ring gas
  giant and the planet each hoverable). `sectors/solo_6.json` (no `rings` field anywhere): +Ring
  on 8 systems kept, no-edit Save of 12 adds none, save → `applyLoadedMapData` round trip keeps
  all 8; no console errors.

#### USER BUG REPORT 2026-11-19 — MgT2E System Editor (K7 V system, hex 0708) — NOT STARTED

The user rebuilt a World Builder's Handbook system by hand on the **live site**
(`bartlebythecoder.github.io/traveller_magnus/hex_map.html`), MgT2E. Two reports.

**Bug A — "Derived Properties" collapses after every star field edit.** Typing a value (mass,
luminosity …) and clicking the next box closes the group; values do persist.
* Likely cause (read, not yet proven): `_derivedRow`'s `change` handler (`system_editor.js`
  ~1070) calls `_preview()`, which backfills and re-renders the tree via `_renderEditorTree`
  (~969). That function saves the open state of body, companion-star and primary-star
  `<details>` but **not** the `<details>` built by `_buildDerivedGroup` (~1157), so it is
  rebuilt closed. The click on the next box also lands on an element that is then destroyed,
  so focus is lost too.
**BUILT 2026-11-19 (v0.19.0.1 changelog item 1).** Cause confirmed: `_preview()` backfills and
calls `_renderEditorTree()`, which rebuilt the group closed. As built, all in `system_editor.js`:
* The group carries `data-derived-star-id`; `_renderEditorTree` records open groups with the
  other open sets and reopens them.
* Each derived input carries `data-se-key` (`<starId>:<field>`); the rebuild refocuses the
  input that had focus. Generic: any input given a `data-se-key` gets the same.
* `_derivedRow`'s change handler runs `setTimeout(_preview, 0)`, not `_preview()`: `change` fires
  as focus leaves, *before* the click/Tab lands in the next box, so a synchronous rebuild saw no
  new focus. If Save is clicked first, the deferred Preview is a no-op (`_workingCopy` null).
* The × clear buttons are `tabIndex = -1`, so Tab goes field to field (emptying a field also
  clears it). Without this, Tab landed on the × and focus was lost on the rebuild.
* Only this `<details>` lacked open-state handling (body, companion, primary already had it).
  No saved field touched.
**Verified (Playwright, real clicks/keys):** MgT2E primary: type Mass → click Lum → group open,
focus Lum; type + Tab → Diam; Tab → Temp; Shift+Tab back. Every star group in 8 systems each of
MgT2E/CT/T5: 35 groups (11 companions), all stay open with focus on the clicked field, value
kept, no page errors. With the fix switched off: group closed, focus on `<body>` — as reported.

**FOUND WHILE TESTING — FIXED 2026-11-19 (v0.19.0.1 changelog item 2), Sean approved:** after an edit, Cancel → Discard
shows "Discard Changes?" a **second** time (editor already closed; the dialog just sits there).
Cause: the Discard handler runs `_restorePreview()`, which calls `SystemViewer.close()`, which
calls `SystemEditor.close()` re-entrantly *before* `_forceClose()` has cleared `_workingCopy`, so
`_isDirty()` is still true. `_finishFillAndSave` already avoids this (comment at ~2701) by force-
closing first. **As built:** the Discard onClick saves `_previewOriginalState`, calls
`_forceClose()`, then `_restorePreview(snapshot)` (which now takes the snapshot as an argument;
it has no other caller). **Verified, real clicks:** Cancel → Discard: one dialog, map restored,
orrery reopened; closing the orrery with unsaved edits → Discard: one dialog, map restored,
orrery closed; Cancel → Keep Editing: editor stays open with the edit. With the old order the
stray dialog returns and blocks the next editor's buttons. No page errors.

**Test-harness trap (cost this session one false result):** `SystemEditor.openEdit()` is a
silent no-op while an editor is already open, and the second Discard dialog above covers the
next editor. A loop over systems must close the editor (and the orrery) and check the panel
shows the new hexId, or it re-tests the first system over and over and reports clean.

**Bug B — adding moons to any planet puts rings round the first gas giant (0708-III, GS, which
has no moons).** Screenshot: ~12 concentric rings on 0708-III; its orrery tooltip has **no
"Rings: N" line**, so the live site predates the 2026-11-18 ring work above.
* Strong hypothesis: this is the bug fixed in that work — the MgT2E adapter's `write()` passed
  the saved map's own `_raw.rings` array to the engine, which `push()`ed rolled rings into it on
  every Preview, so rings accumulate with each +Moon/Preview. Moons shift the dice, so where a
  ring roll lands moves around, which fits "any planet's moons → the first GG".
Next steps:
1. [x] **Asked Sean 2026-11-19:** the live site is **older** than the 2026-11-18 ring/adapter
   work: the user runs **v0.18.3**. So the user's build has the `_raw.rings` aliasing bug, and
   the unreleased v0.19.0 fix (adapter `write()` sends fresh ring copies) may already cure it.
   Step 2 tests current code to confirm; if clean, Bug B closes as "fixed in v0.19.0".
2. [x] **Current code is clean (2026-11-19).** Playwright, real MgT2E bottom-up map (8×10
   block, 42 systems): on 40 systems (each confirmed open in the editor), two rounds of +Moon on
   every body (814 clicks, each an auto-Preview), ring totals in `hexStates` after each →
   **0 systems grew**; Cancel → Discard restored every ring count; on 20 systems +Moon ×3 →
   Save, then Preview + Save twice → ring counts stable. No page errors. (A first run reported
   1,040 clean clicks but had silently re-tested system 0102 only — see the harness trap under
   Bug A.) Script: session scratchpad only (not committed).
3. [x] **Cause proven.** With the adapter's `write()` switched back to passing `_raw.rings`
   directly: system 0102 climbed 3 → 13 rings across the +Moon clicks, and **Cancel → Discard
   did not undo it** (Preto VII 2 → 7, Preto XIII 0 → 5 stayed in the map). Only 1 of 40
   systems did it: the bug needs a world that already has rolled rings. Fix restored, re-run.
   **So Bug B = fixed in v0.19.0, by the 2026-11-18 adapter change. Ships with v0.19.0.**
4. [—] Not needed: current code does not grow rings.
5. [ ] Check a **saved map already damaged** on the old build: do the extra rings now persist
   in the user's save? (Step 3 says yes: the extra rings land in the map itself, even after
   Discard, so any later map save keeps them. v0.19.0 will not remove them.)
   **Ruling, Sean 2026-11-19 — do not reopen: no repair.** Extra rings already saved by
   v0.18.3 are left as they are; the user can delete them in the editor (✕ on each ring). Decide with Sean whether to offer a repair (rings beyond what one
   generation can roll) or leave it. Ruling needed — don't build a repair unasked.
6. [ ] Reply to the user once both are understood (Sean sends it).

#### USER BUG REPORT 2026-11-19 — EXPAND DROPS TYPED TRADE CODES (rulings, Sean, 2026-11-19) — BUILT (v0.19.0.1 items 3–8)

**The report.** A user generated an MgT2E mainworld, edited its UWP, name and trade codes in
the hex editor, then ran MgT2E Expand System and Expand Social. The typed codes were lost and
some of the original generated codes came back.

**Reproduced 2026-11-19 (browser, v0.19.0.1).** MgT2E: generated `B330ABC-G` "De Hi Ht Na Po",
edited to `B36554C-G` "Ag Ri" → after Expand System "De Hi Ht Na Po Sa". CT: typed codes lost
on 6/6 hexes; a typed Sa never made a moon. T5: typed codes mostly kept, but 5/30 typed "Ag Ri"
worlds became moons and had their codes recalculated, and climate codes were added.

**Causes found (read and reproduced):**
1. **Stale UWP copies.** A generated MgT2E mainworld stores each digit twice (`atm`/`atmCode`,
   `hydro`/`hydroCode`, `pop`/`popCode`, `gov`/`govCode`, `law`/`lawCode`, `tl`/`tlCode`;
   `mgt2e_socio_engine.js` ~2683). `saveHexEditorChanges` (`hex_editor.js` ~3154) updates only
   the plain digits. `generateExtendedSocioeconomics` copies the old copies onto the placed
   mainworld (`Object.assign(mainworld, base)`, ~2050) and `calculateMgT2ETradeCodes` reads the
   `*Code` fields first (~56) → the pre-edit codes return. It also leaves `atm` 6 / `atmCode` 3.
2. **Expands always recalculate the mainworld's codes.** MgT2E: `refreshMainworldSocialInPlace`
   (~408), the frozen-snapshot branch (~565) and ~2055; Sa is also pushed at
   `mgt2e_stellar_engine.js` ~1623 and ~1741. CT: `ct_topdown_generator.js` ~418, and the
   handler copies the result over `ctData` (`ui_menus.js` ~620). T5: the lunar recompute
   (`t5_topdown_generator.js` ~537) and the ungated climate step (~586–594).
   MgT2E Expand Social on its own keeps them (`mgt2e_topdown_generator.js` ~353 copies back).
3. **Hex editor saves a lunar mainworld's edits onto the wrong body.** It looks only in the
   top-level list (`hex_editor.js` ~3295) and falls back to `worlds[0]` (a gas giant was
   renamed "Testworld" and given the UWP and codes).
4. **MgT2E lunar mainworld skips the atmosphere and hydrographics locks.** The moon pass
   relabels it `type = 'Satellite'` (`mgt2e_world_engine.js` ~1571); the locks test
   `type === 'Mainworld'` (~804, ~1436). Atmosphere was rolled 0 instead of 6 and only patched
   later, so values derived from it in between may be wrong. Not yet traced further.
5. **Placement ignores the codes.** MgT2E: a gas giant landing on the mainworld's anchor slot
   demotes it to a moon whatever the codes say (`mgt2e_stellar_engine.js` ~1697); `isMoon` left
   over from an earlier expand also forces a moon (~1546). CT: never reads Sa; the mainworld
   is a moon only if it needs the HZ orbit and a gas giant sits there (`ct_topdown_generator.js`
   ~314). T5: Sa/Lk place a moon (~426), but a Flux roll can make a world with no Sa/Lk a moon
   (~451).
6. **T5 Expand System never writes back to `t5Data`** (`ui_menus.js` ~765), so the hex and its
   `t5System.mainworld` can disagree.

**The conundrum (why a dialog).** A newly generated mainworld never carries Sa, Lk, Tz or a
climate code in any edition: those describe placement, which isn't decided until the expand.
Treating every code as fixed would mean an expanded generated mainworld is never a moon and a
T5 one is nearly always temperate. So the user chooses, per expand.

**Rulings (Sean, 2026-11-19) — decided; do not reopen:**
1. **Every expand asks how to treat trade codes**, in a dialog shown once per expand action for
   all selected hexes: CT, MgT2E and T5 Expand System, and MgT2E Expand Social when the hex
   has no system yet (it runs a full top-down expand). Last choice remembered for the session.
   1. **Keep codes, add placement codes — the default.** The mainworld's existing codes are
      never removed or changed. Existing placement codes are obeyed: Sa (T5: Sa or Lk) makes it
      a moon; T5 Tz puts it in orbit 0 or 1; a T5 climate code moves its orbit to fit. If it
      has none, placement is rolled as today and the codes that placement produces are added.
   2. **Keep codes exactly.** Nothing added or removed. Placement must fit the codes: no Sa →
      never a moon; a T5 world with no climate code stays off HZ ±1 and off orbits 0–1.
   3. **Recalculate all codes.** Today's behaviour: rebuilt from the UWP and the new placement.
2. **Codes that contradict the UWP:** warn, then accept the user's codes (e.g. Ag on a world
   with no water). The same applies where a code can't be reached (Ho/Tr when the HZ is orbit 0).
   The audit logs a warning, not a FAIL (`mgt2e_uwp_auditor.js` ~335 and the CT/T5 auditors).
3. **Mongoose expanding a T5 world: only Sa controls placement.** T5-only codes (Lk, Fr, Co,
   Ho, Tz …) are kept as written but don't shape the system; the dialog warns that results may
   look unusual. In T5's own expand, Lk keeps forcing a Close satellite as it does today.
4. **T5 expand: a climate code moves the orbit to match Chart D** (`rules/t5_data.js` ~222:
   Tr/Ho at HZ −1, Tu/Co at HZ +1, Fr at HZ +2 or beyond; Tz orbit 0/1, standalone only).
   This narrows the 2026-11-01 ruling "the climate code follows the world's position" for
   expands that keep codes; option 3 keeps the old behaviour.
5. **Where a code allows several orbits (Fr, Tz), take the nearest valid orbit** to the rolled
   target (HZ + variance). If it is taken, the next-free-orbit search stays within valid orbits.
6. **CT: Sa in a system with no gas giant adds one** and makes the mainworld its moon, as
   MgT2E already does (`mgt2e_stellar_engine.js` ~1548). The hex's gas giant flag follows.
7. **Scope:** all three editions. Not affected: full Generate System (top-down and bottom-up),
   the System Editor, and codes on bodies other than the mainworld.
8. **Only for a hex with a mainworld already** (entered manually or from Generate Mainworld).

**Engineering decisions (no ruling needed):**
* No new saved field: the dialog's choice covers all of a world's codes, whoever set them, so
  the hex editor need not mark typed codes and older saves load as before.
* One warning list in the dialog (UWP contradictions; Mongoose-on-T5), not separate pop-ups.
* Fix causes 1, 3, 4 and 6 in the same change: the hex editor writes the `*Code` copies with
  the plain digits and finds a lunar mainworld recursively; the MgT2E locks cover a lunar
  mainworld; T5 Expand System writes its mainworld back to `t5Data`.
* Placement codes must be judged from the codes, not from leftover `isMoon`/`isLunarMainworld`.

**Next steps:**
1. [x] Build the dialog and the three modes in all three editions (2026-11-19).
2. [x] Verify (2026-11-19, below).
3. [x] Changelog v0.19.0.1 items 3–8 and the identical README copy.
4. [x] **RULED (Sean, 2026-11-19): Recalculate rerolls moons.** T5 Expand System writes its
   final codes back to `t5Data`, and T5's engine reads Sa/Lk there as "make it a moon" with no
   session, so a Recalculate expand would have kept every earlier moon. BUILT: in recalc mode the
   `ctx-expand-physical-t5` handler hands the generator a copy of the base with Sa/Lk removed
   (`genBase`); the hex's own `t5Data` is untouched until the final codes are written back.
   Only the Expand handler does this: Generate System and the System Editor still read Sa/Lk.
   Verified: 40 hexes typed "Ag Ri Sa", expanded 'add' (40/40 moons, Sa saved), then 'recalc'
   → 8/40 moons (the lunar Flux rate), 0 Sa-without-moon, 0 moon-without-Sa, hex = system 40/40.
   Fix off → 40/40 stayed moons. Full harness re-run unchanged, no page errors.

**AS BUILT (2026-11-19):**
* `core.js` (beside `markManual`): `beginExpandTradeCodes(mode, base)` / `endExpandTradeCodes()`
  open a per-hex session; `expandTradeCodeMode()` ('add'|'exact'|null), `expandOriginalHas(code)`,
  `resolveExpandTradeCodes(calculated, placementGroups)` (exact → original; add → original plus
  a placement group's codes only when the world had none of that group), `normalizeTradeCodeList`.
  No session or 'recalc' = every engine exactly as before; a mainworld with no trade-code list
  falls back to 'recalc'. Nothing is saved: no new field.
* `ui_menus.js`: `askExpandTradeCodeMode(edition, items, note)` (modal `#expand-tc-modal`,
  default 'add', last choice remembered for the session, Esc/Cancel/backdrop cancels, Enter
  expands), warnings via `_expandTradeCodeWarnings` (codes vs the expanding edition's own
  UWP codes, compared within that edition's code list; T5-only placement codes under CT/MgT2E).
  Wired into CT/MgT2E/T5 Expand System and MgT2E Expand Socioeconomics (asked only when a
  selected hex has no `mgtSystem`). The T5 handler's old `confirm()` (stars regenerate /
  manual overrides kept) is now a note inside the dialog, so there is one prompt.
* MgT2E: `allocateOrbits` takes moon status from Sa only while a session is open, and 'exact'
  without Sa skips the anchor-collision demotion (the gas giant bumps instead); the mainworld's
  `tradeCodes` copies are now real copies. `mainworldTradeCodes()` in `mgt2e_socio_engine.js`
  replaces the three recalcs; `calculateMgT2ETradeCodes` is exported for the dialog. The
  auditor logs `[WARN]`, not FAIL, for a kept mismatch. `generateMgT2ESystemTopDown` syncs each
  `*Code` copy to its plain digit (repairs maps already saved with stale copies).
  `generateAtmospherics` locks atmosphere and hydrographics for `isLunarMainworld` too.
* CT (`ct_topdown_generator.js` 5a-ii): Sa → a gas giant is added if none (rolled 1D ≤3 Large,
  as `rollSystemSkeleton` does), the nearest gas giant moves into the HZ target orbit when the
  world needs it, and the mainworld becomes its moon (`attachAsMoon`); 'exact' without Sa moves
  a gas giant out of the HZ target orbit and never displaces onto one. Moon flags carried in from
  an earlier expand are stripped before placement (all modes).
* T5 (`t5_topdown_generator.js`): Sa/Lk decide moon status while a session is open; 'exact'
  skips the lunar Flux roll; `_climateFitOrbit` places the mainworld (or its parent) at the
  nearest free orbit whose Chart D code matches the kept climate code ('' in 'exact' when it has
  none), else by the code's position alone, else normally (all logged with `_tResult`).
  `findAvailableOrbit` gained an optional `allowOrbit` filter. The handler copies the final
  codes back to `t5Data` (T5 mainworlds only).
* Hex editor: writes `atmCode … tlCode` with the plain digits on the MgT2E objects, and finds a
  lunar mainworld recursively.

**Found while building (fixed, outside the rulings — tell Sean):**
* **CT asteroid mainworld** (`ct_topdown_generator.js` 5d): the mainworld was copied onto the
  belt object, so `sys.mainworld` (→ `ctData`) was a second object the later passes never
  touched and kept its old codes. Now one object, same fields (changelog item 7).

**Things that behave differently now (deliberate, tell Sean):**
* The lunar-mainworld atmosphere lock changes **fresh** MgT2E generation too: a lunar
  mainworld no longer rolls its atmosphere, so the dice after that point shift and such a hex
  generates a different system than v0.19.0 did from the same seed. Saved maps are unaffected
  until re-expanded. Same seed + same version is still deterministic.
* T5 'exact' with no climate code can be impossible (HZ at orbit 0 and a world that qualifies
  for Fr: orbits 0–1 give Tz, 2+ give Fr). The codes are kept as ruled and the trace says why;
  the dialog does not warn about it in advance (placement isn't known yet).

**Verified 2026-11-19 (Playwright, fresh browser; harness in the session scratchpad only):**
* MgT2E: the user's case (`B330ABC-G` "De Hi Ht Na Po" edited to `B36554C-G` "Ag Ri") → "Ag Ri
  Sa" (it rolled a moon), `atmCode` 6 = `atm`, Expand Socioeconomics keeps it and asks nothing.
  40 hexes typed "Ag Ri": add 40/40 kept, 13 moons, only Sa added; exact 40/40 exactly, 0
  moons; recalc 40/40 match the UWP. Typed Sa: 15/15 moons in add and exact. Lunar-mainworld
  hex-editor save lands on the moon; `worlds[0]` untouched. Expand Socioeconomics on a hex with
  no system shows the dialog and honours 'exact'.
* CT (30 hexes each): add/exact keep codes (exact: 0 moons), recalc 30/30 match; typed Sa 30/30
  moons, every system has a gas giant, Sa ⇔ moon everywhere.
* T5 (30 hexes each): codes kept in add/exact; exact 0 moons without Sa; typed Sa 30/30 moons;
  hex codes = system codes 180/180; every orbit that doesn't give the kept climate code is a
  ruled case (UWP can't give it, or its HZ ±1 orbit is star-locked orbit 1).
* Cross-edition: MgT2E on T5 worlds warns for Fr/Lk; CT on MgT2E worlds keeps "Ht Ri Sa" and
  makes the moon. Cancel changes nothing; the remembered choice preselects.
* `sectors/solo_6.json` (v0.13.3): MgT2E expand of 25 hexes keeps all codes; T5 expand of 25;
  CT expand of 20 MgT2E hexes; no page errors. Full Generate System (MgT2E top-down and
  bottom-up, 30 hexes each): no dialog, no errors, 9/9 lunar mainworlds `atm` = `atmCode`.
* **Fix-off runs** (each switched off with Edit, run, restored, re-run green): no
  `resolveExpandTradeCodes` in MgT2E → typed codes kept 4/40; flat hex-editor search → edits
  land on `worlds[0]`; T5 lunar roll not gated → 7 moons without Sa in 'exact'; CT `attachAsMoon`
  off → Sa without a moon on 10/30 and 8/30.

#### OPEN ITEMS — none scheduled; ask Sean before starting any, one question at a time

1. [ ] **Hand-check, v0.18.3:** on Windows Chrome, does releasing Alt after an Alt + drag of a
   border/region name move focus to Chrome's menu button? A headless browser cannot show it.
2. [ ] **Hand-checks from v0.18.1.4 — never confirmed done** (it was dated 2026-11-08 without
   saying). Orrery: hovering a moon shows "Orbit: Dee (D)"; Close moons ring inside Far ones and
   T5 tooltips show no "PD from parent" line; a moon of a size-0 planet orbits at Earth-size
   pace. T5 hex accordion: Rotation text for Tz / Close moons; Climate Zone on non-mainworlds
   follows each body's code (gas giants and belts blank). System Editor: +Moon → ☆MW gets a
   Close/Far letter, Sa (+Lk when Close) and keeps them through a second Save; ☆MW on an
   existing moon keeps its place; a new T5 system's size-0 planets have no moons. Exports: CT /
   T5 / RTT planets show hex grids in Diamond/Sinusoidal. Right-click → WORLD DETAILS opens the
   Ctrl+click panel. Subsector names: long names shrink then ellipsis; White Background Mode.
3. [ ] **World images ignore tidal lock outside T5** (deferred by Sean 2026-11-02). T5 Tz worlds
   got split hemispheres in v0.18.2 behind Use Climate Codes; `TIDAL_LOCK.MAP` is drawn by
   nothing else. It changes a renderer input, so §0.0.A applies and it needs his ruling first.
4. [ ] **CT, RTT and AoW repeatability is unchecked** (deferred 2026-11-02). T5 was fixed (trap
   9 below) and MgT2E is clean. Test: generate a hex, generate it again, generate 3 other hexes,
   generate it a third time; compare `JSON.stringify` with `name`/`names`/`_*` keys dropped.
5. [ ] **Undo memory on huge maps.** Undo keeps up to 5 whole-map copies, so a ~500 MB map
   needs ~3 GB of heap. Not a string cap (R12 fixed those) — the next ceiling.
6. [ ] **Suspected, not verified:** undo snapshots hold hexes, routes and (opt-in) route
   definitions and name positions — not `hexBorderAssignments` or the border/region definitions —
   yet the Border Manager's delete prompt says "can be undone with Ctrl+Z". Check before relying
   on it.
7. [ ] **Not exercised:** System Editor-built satellite mainworlds (ringed gas giant, legend).
   CT bottom-up and MgT2E bottom-up produced 0 Sa mainworlds in 640 hexes each (pre-existing,
   not investigated). The Map Legend is not drawn into exports.
8. [ ] **Worth a second opinion from Sean:** on Mercator/flat maps the T5 Tz twilight ring widens
   toward the poles (correct for a constant-km ring through the poles).

#### v0.18.3 — RULINGS AND AS-BUILT (Sean, 2026-11-14)

**Ringed gas giant icon** (`#toggle-ringed-gg`, `window.ringedGasGiantSatellites`, settings key
`ringedGasGiantSatellites`, localStorage `traveller_ringed_gg_satellites`).
* **On:** gas giant present + mainworld not Sa → plain; Sa around a gas giant → ringed; Sa
  around a non-GG ("big world") → plain; no gas giant → no icon. **Off:** never ringed.
* **Sa with an unknown parent** (TravellerMap imports, Hex Editor worlds, mainworld-only hexes)
  → plain, even with the option on. **RTT: Jovian only** — a Chthonian parent is not a gas
  giant (matches RTT's own `gasGiant` flag; `_isGasGiantBody` decides by `worldClass`).
* **Default ON**, and a missing key on load means ON (unlike `terrainClimateCodes`).
* One helper, `mainworldOrbitsGasGiant(mw, stateObj)` in `core.js` (walks the system for the
  mainworld's parent — identity, then name, then a moon flagged `isMainworld`, which RTT needs
  because `rttData` is named after the system — else `parentType`/`parentBody`; WeakMap cache).
  Parent names differ per edition: CT/MgT2E `'Gas Giant'`, T5 `'Large/Small Gas Giant'`, RTT
  worldClass `'Jovian'`. Keep the two log-only copies (`io_manager.js` ~1855,
  `mgt2e_socio_engine.js` ~467) in step.

**Map Legend** (`js/map_legend.js`; `#map-legend`, `#toggle-map-legend`).
* **Whole map**, not the viewport; recomputed on change, never per frame (Universe = 163,840
  hexes; scan ≈ 16 ms). **World symbols and styling rules only** — no routes, borders, regions
  or manual fills. A rule is listed only if it matched AND part of its style shows on that hex.
* **Optional rule `name`** (Legend Name field, ledger pencil); without one, the description.
  Old saves and rule files have no `name`.
* **On/off saved with the map** (`mapLegendEnabled`) + localStorage mirror; **off** for new maps
  and when the key is missing. Window position is browser-only (localStorage).
* `reapplyAllRules` publishes `window.ruleMatchesByHex` — derived, never on hex states or rules
  (both are saved). An autosave reopen has no rule pass, so the legend runs one once.

**Map symbols** are drawn by shared functions at the top of `renderer.js` (`drawWorldIcon`,
`drawWorldRing`, `drawGasGiantSymbol`, `drawScoutBaseSymbol`, `drawNavalBaseSymbol`,
`drawTravelZoneHalo`), used by `draw()` and the legend. They are no longer inside the system-name
block: an unnamed world shows its gas giant (gate (c)) and bases (gate (g)), and a players'
export at (c) shows the gas giant as `html_extract_manifest.md` §4.6 says. **Any change to them:
rerun `utilities/map_symbols_pixels.js` against a baseline taken on the same machine.**

**Movable border and region names.**
* **Alt + drag** on a name moves it; plain drag (and Alt + drag elsewhere) pans. **Exports:** a
  placed name prints **once**, on its own subsector's map (`captureSubsector` sets
  `_labelCaptureSub`); an unplaced one prints on every subsector map its area touches, as before.
  **Both** border and region names.
* Stored as `def.labelPos = { hex, dx, dy }` on the border/region definition (saved with the map
  and the autosave, kept through renames); absent or unusable → automatic placement, exactly as
  before. A placed name stays put when panning. Undoable (`saveHistoryState(…, {
  includeLabelPositions })`; regions keyed by name, borders by id); right-click → RESET NAME
  POSITION.
* **The name caches are keyed on hex counts**, which an assignment, clear or rename can leave
  unchanged. Every `saveHistoryState` invalidates them (the mutation runs synchronously after
  it), and the paths with no history entry call `invalidateMapLabelCaches()` themselves.
  **New code that changes `state.cluster` or `hexBorderAssignments` without a history entry
  must call it too.**

**Harnesses** (`utilities/`, Playwright): `map_symbols_pixels.js` (`--named`, `--labels`),
`map_legend_check.js` (44), `map_labels_check.js` (31). Older saves to load after any save/load
change: `sectors/solo_6.json` (v0.13.3), `.tmp/*.json` (v0.18.1),
`.tmp/html_export_harness/fixture_sector.json` (no version, settings or rules).

#### v0.18.2 — RULINGS THAT STILL BIND (Sean, 2026-11-09)

* **Use Climate Codes** (Tectonic only; under World Image Generation): T5 climate code → the
  world image's temperature band when it has no Kelvin — Tr/Ho Hot, Tu/Co Cold, Fr Frozen (seas
  render as solid ice), none Temperate. **Climate codes only** — not Ga/Ag vegetation, not
  social codes. **RTT stays Temperate.** Saved with the map (no localStorage mirror): **a save
  without the key loads OFF, a new map starts ON.** Greyed and inert under Classic (v1), and v2
  with the box off renders byte-identical. The band test lives in BOTH copies
  (`planet_renderer.js`, `terrain_render.js`).
* **T5 Tz worlds with air** (atm 1-9 or D-F; box on) split by longitude: Baked (desert palette)
  centred on the lit side (~135°W), Frozen (ice palette, former seas by depth) on the dark side,
  a full **1,000 km Twilight ring** along both terminators keeping the normal look; no polar
  caps. Airless, all-ice, molten and exotic A-C worlds unchanged. Lk changes nothing.
* **Craters on ice worlds with air are removed only with the box on**, every edition.
* **Custom OTU Import** (`js/otu_importer.js`): OTU + ZCR sectors with data only
  (`requireData=1`, 400 = the cap); always a fresh canvas; warn above 128.
* **Very large maps (R12):** never build one string of the whole map — `cloneHexStateEntries()`
  for undo, per-hex Blob parts for Save; chunked saves close by size.

**eHex sizes:** `_parseStat` (`planet_renderer.js`) and `parseStat` (`terrain_render.js`) read a
single character as eHex (G and up; S/R = 0). **Keep the two identical.**

**Test traps still worth knowing:** the splash screen fades out over the map and swallows mouse
events — wait until `document.elementFromPoint(…)` is `map-canvas`; the Launch button's handler
is attached only after `loadFromDB` resolves; a context menu left open covers the next click
point, so close `#context-menu` before each forced right-click; the built-in browser pane can
serve cached copies of edited scripts after a reload — fetch each with `{cache:'reload'}` first.

#### SEAN'S T5 RULINGS — binding

* **Sa only on a satellite mainworld, always** (Close or Far) — a house rule; RAW pairs Sa with
  Far only. **Lk on every Close satellite**, mainworld or not, so a Close mainworld carries
  Sa + Lk. No other moon ever carries Sa. Close satellites are tidally locked to their planet.
* **Chart 2C (Book 3 p.24) is a mainworld chart.** Satellite? = the existing lunar trigger
  (Flux −5/−4 Far, −3 Close, else a planet). **GG? is a separate Flux roll, made only when the
  mainworld is a satellite** and its parent isn't already seeded: 0 or less = a gas giant taken
  from the inventory; above 0, or no gas giant in the system = a **new BigWorld** in the
  mainworld's orbit.
* **Orbit letters:** Flux −6..+6 on the Close column A (Ay) … M (Em) or the Far column
  N (En) … Z (Zee), stored as an uppercase letter in `orbitLetter`; plain Flux never reaches
  the ±6 rows. **Other moons** (a house rule — 2C itself is mainworld-only): 2D 7- Close /
  8+ Far, then Flux on the same columns. **A brand-new moon made mainworld in the System Editor
  rolls the same 2D 7-** (2026-11-01). Shown as **"Orbit: Dee (D)"** in the orrery hover,
  the hex accordion, the System Sheet and the export moon field `Orbit` (fog level (d), like a
  world's Orbit).
* **PBG gas giants and belts = the bodies actually placed in orbits** — a belt mainworld and a
  mainworld's parent gas giant included, a rolled body with no orbit to fit into left out.
* **Mainworld climate code (Chart D p.26), exactly one or none:** Tz in Orbit 0/1 (not belts,
  gas giants or satellites); otherwise the **first** entry of `rules/` `CLIMATE_TRADE_CODES`
  that fits — Tr / Tu (size 6–9, atm 4–9, hydro 3–7, at HZ −1 / +1), Fr (size 2–9, hydro 1–A,
  any atm, at HZ +2 or beyond), then Ho / Co (position only, HZ −1 / +1). **Tr instead of Ho,
  Tu instead of Co — the array's ORDER is the rule.**
* **Every world gets a Chart D climate code, not only the mainworld** (2026-11-02), by the same
  rule; a satellite measures its HZ position from its planet's orbit.
* **Brown dwarf habitable zone = Orbit 0** (`HZ_DATA.BD`, sizes V/VI/D).
* **Gas giants and belts: no Tz code and no climate label**, in any orbit, and **a belt
  mainworld takes no climate code at all** — Ho/Co dropped too (2026-11-01).
* **Climate Zone text follows the climate code** (2026-11-01): Tz → "Twilight Zone (Tz)",
  Tr/Ho → "Hot / Tropic", Tu/Co → "Cold / Tundra", Fr → "Frozen" (the words are
  `CLIMATE_MAPPING`'s at that code's HZ position). **No code, no text** — "Temperate" and
  "Inferno" are no longer shown. A hand-typed Climate Zone is kept as typed.
* **Day length (Book 3, Sean's check 2026-11-01):** T5 gives one only for Lk (day = satellite
  orbit length, p.226, quoted in `LK_DAY_LENGTH`) and Tz (no day/night cycle, p.17); everything
  else is referee discretion. **Text only, never hours** — T5 has no orbit periods. Rotation
  reads "Tidally Locked to Star (no day/night cycle)" / "Tidally Locked to Parent (day = orbit
  length)" / "Undefined (Referee Discretion)".
* **Book 3 pages** (in the `TIDAL_LOCK` comment): p.17 Orbit 0/1 rule, p.226 Lk day length,
  p.24 Chart 2C, p.49 Tz world maps.
* **Each `rules/` edit was its own one-time permission** (eight, 10-24 → 11-02). None carries
  forward: ask again for the next one.

#### AS BUILT — where it lives

* **`rules/t5_data.js`:** `HZ_DATA.BD`; `CLIMATE_TRADE_CODES`; `TIDAL_LOCK` — `LOGIC` (quoted
  footnotes, the rulings marked as rulings), `STAR_LOCK_ORBITS`, `CLOSE_SATELLITE_MAX_ROLL`,
  `CODES`, `CHART_2C`, `MAP`.
* **`js/t5_world_engine.js`:** `isT5StarLocked`, `isT5CloseSatellite`, `getT5SatelliteOrbit`
  (null for a letter in the wrong column — pre-2C saves gave Far mainworlds a Close letter, and
  a wrong orbit is never shown), `calculateT5TradeCodes` (Sa/Lk/Tz), `isT5GGorBelt`,
  `getT5ClimateText` (text from codes), `getT5ClimateDisplay` (what the accordion and exports
  show — re-derived, so old saves' stale text is hidden; manual kept), `calculateT5Climate(world)`
  (call only after the trade codes are final), `getT5ClimateCode` / `applyT5ClimateCode` (Chart D,
  every world — 2026-11-02), `calculateT5RotationalDynamics` (Rotation text
  from `ROTATION_TEXT`), `getT5RotationDisplay` (maps old saves' "1:1 to Star/Parent" wording to
  the new text; manual kept — it does NOT re-work-out the lock).
* **`js/t5_topdown_generator.js`:** `getStarHZ` (reads `rules/` `HZ_DATA`; `BD` read whole);
  Phase 1 lunar trigger (its Far branch stores `isCloseSatellite = false`), the System Editor
  moon-mainworld 2D roll (only `isPreMoon` with no stored Close/Far and no Sa — a Sa-only one is
  stored Far), GG? roll, `assignT5SatelliteOrbit` (keeps a right-column letter, re-rolls a wrong
  one); the mainworld climate step; the PBG count after Phase 5;
  `fleshOutSubordinates` (other moons' Close/Far and letter, their trade codes recomputed after
  `isMoon` is set, climate text after those codes). `getT5OrbitLabel` is gone.
* **`js/t5_editor_adapter.js`:** `_t5SatelliteOrbitSeed` + `backfillFromGenerated` carry
  `orbitLetter` / `isCloseSatellite` so Preview and Save never re-roll them.
* **Display:** `system_viewer.js` (`_normT5World` → `moons[].satelliteOrbit`, moon tooltip;
  `_t5MoonRings` → `moons[].ring` / `drawPd`, read by `_drawWorld` and `_moonPeriodYears`),
  `hex_editor.js` (T5 accordion — `_t5ClimateDisplay`, and `_t5WithMwCodes` because a
  mainworld's codes live on `mwBase`; no `[climate]` bracket in the summary when there is no
  text), `system_sheet.js` (the "A moon of …" line, a Satellite Orbit row, an ORBIT column in the
  Satellites panel), `export_core.js` (`formatT5SatFields`; `_t5Climate`, with the mainworld's
  codes taken from `state.t5Data`; `_t5Rotation`). `hex_editor.js` also has `_t5RotationDisplay`.
  The System Sheet and orrery never show Climate Zone or Rotation.
* **All four T5 engines** (`t5_world_engine.js`, `t5_topdown_generator.js`,
  `t5_stellar_engine.js`, `t5_socio_engine.js`): `const _rng = () => rng()` (reads the global at
  each call — trap 9).
* **Harness:** `node utilities/t5_satellite_climate_check.js` (needs Playwright — set
  `NODE_PATH` to a `node_modules` that has it) — 49 checks (49/49 on 2026-11-02): 1,280 systems, Rotation text, a
  System Editor round trip, and section 3 (brand-new moon made mainworld via the real +Moon/☆MW
  buttons; an old-save Far mainworld stays Far); 44/44 on 2026-11-01. Its two repeatability
  checks fingerprint the whole system (names aside) and were shown to FAIL with the old `_rng`
  line restored.
  Measured before the fixes: 91 of 94 gas-giant-parent systems under-counted PBG, 291 of 345
  Tr/Tu/Fr codes broke Chart D, and 299 of 327 mainworlds' climate text contradicted their code.

#### TRAPS THIS WORK PAID FOR

1. **Git Bash `sed -i` strips CRLF** — it flattened three files in one session. Use the Edit
   tool or `sed -b`, and recount with `tr` afterwards.
2. **`x || 3` turns a real 0 into 3.** HZ Orbit 0 silently became Orbit 3; both `getStarHZ`
   fallbacks now use `??`.
3. **T5 has two `getStarHZ`s** (generator and `t5_stellar_engine.js`); the generator kept its own
   copy of the HZ table and read `BD` as a B star. It now reads `rules/`; keep the two
   functions agreeing.
4. **Climate Zone text was written three times** (Phase 1, `getT5OrbitLabel`,
   `calculateT5Climate`) and the last one won; it had used a literal HZ of 1.0, so every moon
   read "Hot / Tropic". Now it is derived from the codes only, and `getT5OrbitLabel` is removed.
5. **A moon's trade codes are first computed before it is flagged a moon** — anything that
   depends on `isMoon` / `isCloseSatellite` needs the recompute after the flags.
6. **Every new roll shifts the RNG stream**: the same seed now gives a different T5 system
   (the `_rng` fix shifted it again). Saved maps are unaffected (hexes are stored); changelog
   item 17 tells users.
7. **`universal_math.js` will not load under plain Node** — test T5 in the browser.
8. **Anything the generator rolls for a seeded body must be carried by the editor adapter**
   (seed + backfill), or every Preview/Save re-rolls it.
9. **Never keep a load-time copy of `rng`.** `reseedForHex` (`core.js`) *replaces* the global
   `rng`, so `const _rng = rng` keeps the original stream forever: T5 subordinate worlds changed
   with whatever had been generated earlier in the session, while the mainworld (rolled through
   the `core.js` dice, which read `rng` at call time) stayed put — so a mainworld-only
   "same seed" check passed for months. Copying the dice *functions* (`tRoll2D` etc.) is fine.
10. **Climate Zone text is derived, not stored truth.** It must be (re)computed *after* the
   body's trade codes are final (`calculateT5Climate` runs after the moon trade-code recompute
   and after `generateT5SubordinateUWP`'s code step), and the displays re-derive it so stale text
   in old saves never shows. Nothing in generation reads `climateZone`.
11. **"Not stored" is not "false".** Random Far satellite mainworlds never stored
   `isCloseSatellite`, so a rule "roll when it isn't a boolean" would have re-rolled every old
   Far mainworld (58% to Close) on its next editor save. Gate on the old evidence too (Sa without
   Lk = Far) and store `false` explicitly from now on.
12. **Text in `rules/` is not proof of a rule.** The two `DAY_LENGTH` lines were copied on
   2026-10-24 from the v0.6 `rules/guideline_2_5_rotational_dynamics.md` (pre-Zero-Assumption)
   and read like book quotes; Sean was surprised by them. Check a `rules/` line's source with
   Sean before building on it.

### 0.0.C v0.18.1.1 – v0.18.1.2 — THE SYSTEM SHEET IN-APP AND IN EXPORTS (shipped)

* **Part 1, the sheet in-app** (2026-09-23/24): the System Sheet button opens
  `SystemSheet.open()`, a modal with **Download PNG** (full resolution) and **Close**; Esc and a
  backdrop click close it, and the orrery's Esc handler defers to `SystemSheet.isOpen()`. R1–R8,
  D1–D3 and the further rulings are built; `system_sheet_verify.js` zero FAILs,
  `system_sheet_sweep.js` renders all 3,513 sheets with zero exceptions; Sean's gallery review
  passed (*"they are looking good"*). Detail: `system_sheet_spec.md` §4–§5, §8.
* **Part 2, the sheet in the exporters** (2026-09-25): **the SHEET on GM exports and at (g);
  the existing level-aware 900x500 ORRERY at (d)–(f); nothing below (d)** (Sean, 2026-09-24 —
  a level-aware sheet was offered and declined). **JPEG 0.85 at scale 2**, sheet only (world
  images and regional sheets stay PNG). One render path, `ExportCore.renderSystemSheet`; the
  HTML sheet links to itself at full size (Sean, 2026-09-25). Detail and measurements:
  `system_sheet_spec.md` §9; the disclosure ruling is `fog_of_war_field_tags.md` §9.2b.
  **Verified by exporting:** `utilities/system_sheet_export_check.js` failed 20/181 before the
  wiring and passes 191/191 after; the Release 2 scratch harnesses in
  `.tmp/html_export_harness/` (disclosure_check, disclosure_leak_check,
  disclosure_obsidian_check, html_check, html_check_all) all pass. `disclosure_leak_check.js`
  had two assertions that assumed the GM image was an orrery PNG — **re-pointed, not dropped**
  (spec §9 says how). An exported page was opened and looked at.
* **Part 3, sheet / orrery / both** (released as **v0.18.1.2**, 2026-10-01): the export dialog's
  checkbox became a **System images** dropdown — *System sheet* (default, the old behaviour),
  *Orrery*, *System sheet and orrery* (sheet first, then orrery) or *None*. **The choice can
  only remove an image**: below (g) *Sheet* and *Both* still give only the orrery. This
  revises the "replaces rather than sits beside" ruling below (Sean, 2026-10-01). One decision
  path, `ExportCore.renderSystemImages`; the orrery file is now `<System> (<hex>) Orrery.png`.
  Detail: `system_sheet_spec.md` §9.1. `system_sheet_export_check.js` 1256/1256 (every mode at
  every level, plus the legacy boolean); `disclosure_leak_check.js` 86/86.

**Changelog style (Sean, 2026-09-25):** one sentence per item; the `README.md` entry is an
identical copy of `changelog.md`'s.

#### STILL OPEN FROM THE SYSTEM SHEET WORK (not scheduled)

* **"World on a page"** — the other half of the image-exports subject, **nothing designed.** It
  is a linear document, so **the block-model ruling (§0.0.B) governs it** — the sheet departed
  from that ruling only because it needs numbers. Do not carry `normalizeSystem` across to it by
  habit.
* **Multi-star beyond binaries, and the habitable-zone band** — both deliberately absent (§0.0.B).

#### THE TWO RULES THIS RELEASE KEPT RE-LEARNING

1. **A panel that lays out a variable number of rows must DERIVE its pitch from the count, and
   no row loop may stop without announcing it.** Four panels had the silent-drop defect; two
   were introduced while fixing the first. Assume a new panel has it until a corpus run says not.
2. **Assertions check what a sheet would print; only rendering proves it can be drawn.** Wiring
   RTT `diameter` passed every check in `system_sheet_verify.js` and crashed the sheet (the
   Jovians store a string). And the gallery rendered **zero** Spinward sheets for a day because
   it only censused hexes with bodies. **After any change: verify, sweep, and look at renders.**

---

### 0.0.B v0.18.1.1 — THE SYSTEM SHEET: rulings and traps that still bind

The requirements and as-built detail are in **`directives/system_sheet_spec.md`**. What follows
is the design ground under it — **decided with Sean; do not re-derive or re-litigate.**

#### SCOPE AND FORM — decided 2026-09-21

| | Ruling |
|---|---|
| **What it is** | One system, one page, landscape, dark, dense: an orbital strip of rendered bodies plus data panels. Sean's reference: `C:\Users\sean\Downloads\2.jpg` (a hand-made Kteiroa "ORBITAL MAP"). |
| **Canvas, not HTML** | Sean ruled CANVAS: *he asked for images, and a page is not one* — a PNG goes into Obsidian, a VTT or a message; and it REPLACES the existing orrery snapshot rather than sitting beside it. Free print-to-PDF was given up knowingly. **Revised 2026-10-01:** the exporters now let the user choose sheet, orrery or both — `system_sheet_spec.md` §9.1. |
| **Resolution** | **Screen first**; print deferred. |
| **PDF** | **Not now.** There is no PDF capability anywhere in the repo, and no build step — a library would have to be vendored, a first. |
| **Missing stats** | **Ignore them.** Never invent jump shadow, comm range, metallicity or average TL. This is the root of R4. |
| **Delivery** | **In-app download FIRST, exporters second** — judging the sheet means looking at twenty systems, which costs a click this way. |

**The approved mockup** is at `C:\Users\sean\Downloads\system_sheet_mockup\` (outside the repo):
`system_sheet_mock.png` (Makarov, 18-E-0313), the live `system_sheet_mock.html`, and its data.
Sean: *"I am very happy with your mockup image so we have an excellent starting place."*

#### WHAT THE MOCKUP PROVED — do not re-derive

* **No plugin or external program is needed.** `PlanetRenderer.renderApproachFrame` draws a lit
  sphere to any canvas at any size.
* **SUPERSAMPLE small discs 3x** and let the browser downscale; native-size discs lose their
  terminators and coastlines.
* **Disc size is LOG-SCALED and CLAMPED**, never true scale: terrestrial 34–76 px, gas giants
  their own 84–108 px band (every solo_6 giant reports 50,000 km, so a shared curve cannot tell
  them apart — the non-overlap guarantees any giant is larger than any rock).
* **Orbit spacing is ORDINAL**, with AU labels carrying the truth.
* **Use OUR temperature bands** (`PlanetRenderer.tempBandFromKelvin`: Frozen <230, Cold <265,
  Cool <290, Temperate <330, Warm <360, Hot), not the reference's — they are baked into every
  world-image palette, so a dot must agree with how the planet looks.

#### AS-BUILT TRAPS — each hit once, each commented in place

* **`renderApproachFrame`'s third parameter is NAMED `hexId` and is the whole per-body SEED
  KEY.** Pass `PlanetRenderer.imageSeed(hexId, world, fallback)` (keyed on the body's NAME —
  orbitId is not unique), or every body in the system gets the same terrain.
* **It does not accept a `normalizeSystem` world** — it wants parsed UWP digits and
  `temperatureK`. Go through **`ExportCore.rendererData`**, the one adapter shared with world
  images and regional sheets, or the whole strip renders grey.
* **Gas giants are drawn by `drawGasGiant()` in `system_sheet.js`, deliberately NOT in
  `planet_renderer.js`**, which is behind the frozen terrain-field guarantee. (It also made the
  sheet fast: Starrfield 1,653 ms → 47 ms.)
* **NO HABITABLE-ZONE BAND, and do not derive one from luminosity.** `normalizeSystem` falls back
  to `_orbitToAU(3)` when `hzco` is absent — throughout solo_6 — so every system would claim an
  HZ at 1.00 AU. The mockup's `sqrt(luminosity)` was invented. Real sources, if ever wired:
  `MGT2E_HZ_DEVIATION` (`js/constants.js`), CT `hasHZ`/`hzOverride`.
* **A LUNAR MAINWORLD: the ORBIT belongs to the parent, the physical STATS to the body.**
  58.7% of solo_6 mainworlds are moons. `findMainworld()` searches `moons[]`; the strip rings
  the PARENT; Mainworld Data labels "Primary's Orbital Distance". Getting it backwards printed
  "Year Length 0 standard years".
* **COMPANION STARS:** placed on the strip only from a recorded position. MgT2E: `orbitId`
  present (modern save) → placed via `SystemViewer.orbitToAU`; absent (solo_6 is v0.13.3 — all
  86 companions carry only a role WORD) → named by role, "N (orbits not recorded)". **`!= null`,
  never `!== null`** — legacy saves omit the key. T5: only a recorded `distAU` (D1). RTT: never
  (its AU is synthesised). `orbitToAU` is exported deliberately; the private
  `_starCompanionAU` falls back to `orbitId || 0.5`, fine for an orrery, wrong for a printed sheet.
* **Orbit numbers belong to BODIES only** — a companion never consumes an index, or the strip
  and table disagree about which world is orbit 7.
* **MOONS CANNOT BE ENUMERATED.** solo_6: median 19 moons a system, max 64; listing them needs up
  to 76 rows against a table of ~21. Moons are a COUNT (table column, strip glyph, System Data
  total) plus one Satellites panel for the mainworld's neighbourhood. "Populated" does not work
  as a filter (Starrfield: 33 of 67 bodies populated); **proximity to the mainworld** does.
* **FIELD NAMES LIE.** `totalWorlds` read 960 for a system of 8. Check the raw save and the
  engine's units (spec §6.2).

#### THE BLOCK-MODEL RULING — 2026-09-21, still governs "world on a page"

A linear page takes its content from **`ExportCore`'s block model**, not the on-screen panels:
fog of war is then inherited (`filterBlocks()` only ever sees blocks) and numbers arrive through
`ExportCore.fmtNum`. The system sheet departed from it **only** because it needs numbers; its
numbers still go through `fmtNum`.

#### TWO EXPORTER TRAPS — honoured by the v0.18.1.1 wiring, still binding for any new image

* **An image is opaque to the fog of war.** Withhold it by not generating it — v0.18.0's
  regional sheets sit inside `_show(oLV, 'e')`, and the system sheet inside `_show(level, 'g')`,
  for this reason. See §0.0.A decision 4.
* **Test an exporter by exporting.** The Obsidian export was broken for three days by one
  missing parameter while `node --check` passed. Stub `downloadBlob`, scan for `PK\x03\x04`,
  read members out of the ZIP, and **watch it fail first.** Recipe for a small export: load a
  sector, **trim `hexStates` to one hex**, export — `utilities/system_sheet_export_check.js` is
  a working example.

#### v0.18.0 DECISIONS THAT STILL BIND — ruled 2026-09-21

* **Lake-adjacent land shading — KEEP. DO NOT "FIX" THIS.** P4's water fill moves 1.4–9.7% of
  land pixels within 8 cells of a lake shore, correctly: the old code occluded from the lake
  BED. "Fill sea only" was rejected — it re-splits sea from lake.
* **The route-replace prompt — KEEP AS-IS.** **Segments carry no provenance** (`{startId, endId,
  type, routeId, …}`; `automationRef` lives on the route definition), so nothing can tell a
  pristine generated route from a hand-edited one. *"The clear was never the bug; the silence
  was."*
* **Round trips list in travel order for CLEAN CIRCLES only** (`walkRouteCycle` in
  `js/routes.js`, contract in `route_extend_spec.md` §4), in the Route Systems panel and the CSV
  export. A loop with a tail is not ordered, and a user cannot tell the two apart by eye — not a
  defect. A circle lists each world once; an imported circle with no Start is ordered from the
  lowest hex ID.
* **Moons get regional sheets in both exporters** (verified by exporting with a negative
  control, 2026-09-21).

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

**A pointer into another document rots faster than the thing it points at** — re-read the
target before trusting any cross-manifest note.

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
| `map_symbols_pixels.js` | Pixel fingerprint of the hex map's symbols (live canvas, `captureSubsector`, and players' export maps at each disclosure level). `--out before.json`, change, `--compare before.json`; `--named` names every world. Same-machine baselines only |
| `map_legend_check.js` | Map Legend — 44 checks (`--perf` adds a Universe-sized scan timing) |
| `map_labels_check.js` | Movable border/region names — 31 checks (drag, pan, undo, reset, exports, save/load, autosave, old saves). `map_symbols_pixels.js --labels` is its pixel companion |
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

## 0. The System Editor — reference for the paused RTT/AoW work

> **What is current lives in §0.0 above.** What follows is only what still binds when you touch
> the System Editor (`js/system_editor.js` + the `*_editor_adapter.js` files) or bring RTT or
> AoW online in it. Pruned 2026-11-16 from ~1,000 lines of 2026-06/07 build history; the dated
> per-bug writeups (OW-1 … OW-65) are gone on purpose — **do not reinstate them from git.**
> Where this part and §0.0 disagree, §0.0 is right.

### 0.1 Where it stands

* **MgT2E, CT and T5: Create and Edit both work. RTT and AoW: neither** (paused). All five were
  briefly switched on 2026-07-05; T5/RTT/AoW were pulled back 2026-07-11 as preliminary; T5 was
  overhauled and re-enabled 2026-07-16. **RTT and AoW have not been re-verified since
  2026-07-05** (AoW had one clean round trip on 2026-07-11) — treat any older "fully online"
  claim about them as unproven. RTT is meant to get a full overhaul, not incremental fixes.
* **Three gates switch an engine on, and they have drifted apart before** (line numbers checked
  2026-11-16 — re-check, they move):
  1. `js/system_viewer.js` ~1277 — the orrery's Edit System button
     (`edition === 'MgT2E' || edition === 'CT' || edition === 'T5'`).
  2. `js/canvas_input.js` ~111 — `_seCanEdit`, the right-click menu.
  3. `hex_map.html` `#se-engine-dialog` (AoW ~1946, RTT ~1949) — the Create radios. Each
     disabled one carries `disabled`, a "(coming soon)" label and a `not-allowed` cursor on its
     `<label>`: four things to change per engine.
  Change all three together and grep for the engine name to confirm.
* **Each engine's adapter is its own file**, `js/<edition>_editor_adapter.js`, registered on
  `window.SystemEditorAdapters`; `system_editor.js`'s `_ENGINE_ADAPTERS` only points at them.
  Interface: `detect`, `readBodies`, `write`, `run`.

### 0.2 Bringing RTT or AoW online — the checklist

For each engine, in order: (1) the generator honours `seedSys`, structurally and per field;
(2) its adapter; (3) **its own `sys.auditResult`** — the Fill & Save audit gate reads
`result.newSys.auditResult` for any engine and is a silent no-op without it; (4) the three gates
in §0.1; (5) an in-browser round trip — Create → add bodies → Preview → Fill & Save → reopen →
move a body → Fill & Save — **plus** a zero-edit Preview/Save loop in which nothing may change.

**Known gaps never checked for RTT or AoW** (each was a real bug in CT or T5):
* Moon counts **append instead of lock** on a re-save of an already-generated body.
* A blank Create (zero bodies, "Allow engine to add additional bodies" unticked) must stay
  blank, not roll a random system.
* A brand-new body's **first** moon roll must be capped to the moons the user gave it (zero by
  default). MgT2E: `SeedRestoration` capture/trim; CT: `captureCTSatelliteCaps` /
  `trimCTSatellitesToSeededCaps`; T5: `generateT5Satellites`' `capToExisting`.
* **Lunar mainworld flag:** RTT's and AoW's `readBodies` use a bare `.map(_buildMoon)` (CT and
  MgT2E needed a guard there); RTT's top-level check also lacks a `type === 'Mainworld'`
  fallback. Test with a system whose mainworld is a moon: ★ shown, mainworld count stable.
* **RTT companion drag position** doesn't reach the orrery — its normaliser has no
  `orbitId`/`orbitAU` fallback (CT's and T5's do).
* **AoW:** whether its guarded fields cover the gov/law/starport/TL equivalents.

**RTT's shape, which every traversal must handle:**
* Bodies are **flat** in `star.planetarySystem.orbits[]` — no `.contents` wrapper, no
  `sys.worlds`. (This kept the RTT branch of the Obsidian exporter dead unnoticed.)
* The seed is `seedSys.rttBodies[starIdx][]`. `generateRTTSectorStep1(hexId, { seedSys })`
  auto-chains Step 2 → Step 3 → Biographer with `seedSys` passed at every hop; the mainworld is
  picked by `extractRTTMainworld(newSys, seedSys._mainworldRef)`.
* RTT uses the seed's **zone verbatim** (it does not recompute it from the orbit), so `write()`
  must read `_raw.zone`; a hard-coded zone reclassifies bodies on every save.
* **`_rttUwpLockFor` must mark every locked field manual** — RTT has no "skip if already set"
  fallback for any field. `processRTTSocialStats`' Uninhabited branch returns before the outer
  restore runs, so it needs its own inline `isManual` guards.
* A seeded brand-new star must get `classification` / `luminosityClass` (several functions read
  `star.classification.includes(…)` unconditionally) — formatted, never re-rolled.
* Per-body UWP: `computeRTTBodyUWP(body)`. AU in the editor is only a display approximation
  from zone (`_rttOrbitAU`); RTT has no AU.

**AoW's shape — the seeded path runs through `js/aow_seed_bridge.js`:**
* AoW's Phase 3 functions all early-return when `sys.diskWorksheets` is empty, and only
  `generatePlanetaryDisks` (which seeding skips) fills it. The bridge's
  `synthesizeDiskWorksheets()` builds them from the seeded stars and bodies (reusing
  `aow_world_engine.js`'s `buildNodes`/`buildDiskWorksheet`) and must seed `Rmin = Rmax =
  orbitalRadius` (Step 17 reads `Rmin`).
* Stars: a bisection solver from spectral type to `initialMass` (no jitter); age windows
  reconciled across stars — a non-overlap sets `ageConflict` and Fill & Save shows a
  warn-and-proceed dialog; the hierarchy mapper supports 5 shapes, so `_addStar()` caps AoW at
  4 stars with the 4th paired to the latest companion.
* Field locking lives in the bridge, not the adapter (`write()` is deliberately thin).
  `isManual` guards cover only the ~6 editor-exposed fields; internal simulation fields stay
  random by design.
* The bridge writes `sys.systemAge` (formulas read that, not `age`) and computes metallicity
  with a copy of `aow_stellar_engine.js`'s Step 5 formula — keep the two in step.
* AoW stores its mainworld in `mgt2eData` / `mgtSocio` — a deliberate reuse, not a bug.

### 0.3 Not decided

* **Should CT bottom-up roll a planetary system for Far companions?** `star.nestedSystem` is
  always empty today. Until Sean rules, `+Secondary`'s Far option is safe; a "yes" means
  extending the editor, accordion and orrery.

## 1. How the editor works — the contracts that bind

* **The goal:** a system created or edited here must be indistinguishable from a generated one
  — in `hexStates`, the JSON save and the map. The editor works on a deep copy; Cancel leaves
  the original untouched. Entry points: right-click → Create System / Edit System, and the
  orrery's Edit System button.
* **How a generator is steered — `seedSys`:** `{ stars, worlds | orbits + capturedPlanets (CT) |
  rttBodies (RTT), _mainworldRef, _allowAddBodies }`. **Body fields** are gated per field with
  `isManual(body, field)` (`core.js`: `markManual` / `isManual` / `clearManual` over
  `_manualFields`). **Star fields are not gated** — `_buildSeedSys()` resolves every star field
  to a concrete value and the generator uses it as-is. **With `seedSys` null (every macro
  call), generation must be identical to a plain run** — the safety rule.
* **"Allow engine to add additional bodies"** (unticked by default) gates the inventory and
  orbit-allocation rolls. Unticked, nothing is added that the user didn't place.
* **Anything the generator rolls for a seeded body must be carried back by the adapter** (seed +
  backfill into `_raw`), or every Preview/Save re-rolls it.
* **Mainworld:** none flagged at Fill → the engine's own election runs, no dialog. **T5 elects
  before generating** (`_t5ElectMainworldIfNeeded`: the eligible body closest to the HZ orbit,
  top-level gas giants excluded, ties by the seeded `rng`, not marked manual). A gas giant can't
  be made mainworld; its moons can.
* **Commit:** `_generateAndCommit()` is shared by Preview and Fill & Save. **There is no shared
  `commitEditorSystem()` and none is planned** (Sean, 2026-07-04): the editor's
  `_clearSystemData()` and `macro_orchestrator.js`'s inline clear-block are two copies, by
  choice — check whether a change needs both. **No `manually_edited` flag** — dropped, do not
  add one.
* **Preview:** most actions auto-preview (`_renderAndPreview()`); **clearing a derived field
  does not**, so several can be cleared and re-derived in one Preview. `_preview()` snapshots
  `_previewOriginalState`; `close()` warns if the copy is dirty **or** a preview happened — so a
  freshly created system closed untouched still warns (Create auto-previews once). Intended.
* **Undo:** the editor's own stack (`_history`, `HISTORY_CAP` 50), separate from the map's
  `saveHistoryState`, which runs once at Fill & Save.
* **Moving bodies:** `_insertAtOrbit()` inserts (never swaps), shifts the neighbours ±1 and
  marks every shifted `orbitId` manual. Bodies drag only within one star; companion stars can
  drag across. A typed Orbit # that would cross a neighbour is refused by `_wouldReorder()`
  (drag instead). Orbit # is decimal. `_buildSeedSys()` derives AU from `orbitId`, not a stored
  `au`. **T5 moons have no distance** — order is the array order, reordered by drag
  (`_reorderMoon()`).
* **What a system hex holds:** `type: 'SYSTEM_PRESENT'`; raw system `mgtSystem` / `ctSystem` /
  `t5System` / `aowSystem` / `rttSystem`; mainworld `mgt2eData` / `ctData` / `t5Data` /
  `rttData`; socio `mgtSocio` / `t5Socio`; `name`, `allegiance`, `cluster`. **Old saves omit
  fields** — see "Legacy saves omit fields" in §0.0.A before reading star or world fields off a
  loaded sector.
* **Not supported, by design:** switching an existing system's engine; moving a body to another
  star; CSV import.

## 2. Display rules — every surface that lists a system's bodies

The Edit System panel, the hex accordion's System Details and the orrery, in all five editions:

1. **Siblings are ordered by distance from what they directly orbit** — the primary's list from
   the primary, a companion's from that companion, a moon list from its planet (CT `pd`; T5 by
   array order). Companion stars sit **in** the primary's list at their orbit (`_sortAU()`),
   so bodies inside a companion's orbit read as circumbinary.
2. **Indentation follows the true parent chain**, however deep.
3. **The orrery must match the list.** Each surface works out position on its own, so a change
   can land in one and not the others — check all three.

CT companion Role is **Close / Far only** (`CT_COMPANION_ORBIT_TABLE`).

## 3. Recurring patterns — expect them when bringing RTT or AoW online

Drawn from the MgT2E, CT and T5 work. Assume they recur.

1. **Seeded and manually added bodies skip generation steps entirely.** A body created in the
   editor bypasses the phase that normally sets a field, so nobody sets it (CT moons got no
   gravity or temperature, CT belts no size, a new T5 mainworld no UWP, all of AoW's Phase 3).
   → For each editor-exposed field, ask what sets it when the body was seeded, not rolled.
2. **Already-generated data re-rolls on a no-edit Preview/Save** (CT gas giants and companion
   worlds, T5 moon counts and subordinate gov/law/starport/TL, an MgT2E ring).
   → Open, Preview, Fill & Save, reopen, repeat — zero edits, nothing may change.
3. **A "fixed" manual-field guard is usually partial** — starport was guarded, gov/law/TL were
   not, and a comment said it was fixed. → Check every field a fix claims, not just one.
4. **The three gates must agree** (§0.1).
5. **Null orbit slots become phantom bodies.** `Object.assign({}, null, {...})` gives an object
   with no `type`, and `w.type !== 'Empty'` lets it through. → Guard the null before spreading.
6. **A secondary body list is invisible to a function that walks only the primary one** — CT's
   `capturedPlanets`, a CT Far companion's `nestedSystem`, RTT's flat layout.
7. **The three surfaces disagree** (§2) — e.g. a cached `au` never refreshed when Orbit #
   changed. → Verify every structural change on all three.
8. **The same fix is needed in two places** — derive from the real body list rather than a
   counter like `sys.gasGiants` (filled only by an inventory phase the editor skips), and check
   whether the macro path needs the change too.
9. **In-browser testing finds what reading cannot — three for three** (T5 phantom bodies, RTT's
   missing `star.classification`, AoW's missing `Rmin`, none found by review). `node --check` is
   not verification. → Budget for at least one real bug per engine; a clean first pass is
   suspicious.

## 4. A carve-out that must not be tidied away

`restoreT5ManualFields` and `generateT5SystemPreservingManuals` in `system_driver.js` look like
dead duplicates of the editor's `seedSys` path. **They are not.** They implement
`ui_menus.js`'s right-click "regenerate T5 system" — bulk regeneration across selected hexes
with no System Editor working copy involved — which is a separate and still-valid path. **Do
not consolidate them without checking that use case.**
