# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** v0.17.3 — the **routes** series; §0.0 below is the current cold start. v0.17.2
shipped 2026-08-19, v0.17.3 on 2026-08-27. The exports series (v0.17.0 / v0.17.0.1) shipped
2026-08-03 and 08-04.
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 0.0 COLD START — read this first (updated 2026-08-27)

**v0.17.3 is complete.** Both route series — v0.17.2 (eight items) and v0.17.3 (six) — are
written, verified in-browser and documented. Neither this document's System Editor content
(§0.1 onward) nor the exports manifest is in progress.

**Read §0.0.2 before anything else if you are picking this up cold:** route *forcing* was
designed in full and then dropped, and the older parts of this document and of
`route_partial_spec.md` still contain its reasoning. §0.0.2 says plainly what is and is not
being built.

**Nothing is committed.** Everything in the working tree from v0.17.3 is unstaged —
**git is Sean's, never touch it.**

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

### Route directives — the authoritative documents

| Directive | Covers | Status |
|---|---|---|
| `directives/route_file_spec.md` | Saving/loading one route's connections to `.json` | **IMPLEMENTED** in v0.17.2 |
| `directives/route_partial_spec.md` | Point-to-Point routes that keep what they could build when a leg cannot be routed. §13 records route *forcing*, designed and then dropped; §14 holds the wider route-editing design | **IMPLEMENTED** in v0.17.3 |

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

### 0.0.1 Two traps this session paid for — do not rediscover them

- **`backdrop-filter` on `.draggable-palette` makes it the containing block for
  `position:fixed` descendants**, and its `overflow:hidden` then clips them. Any dropdown,
  tooltip or popover placed inside `#route-window`, `#hex-editor`, `#filter-modal`,
  `#border-window` or `#region-window` will be displaced by exactly the palette's top-left
  offset and vanish once the window is dragged. Portal it to `<body>` while open and return
  it home on close. The symptom is "the list never appears" — it IS built, `display:block`,
  correct contents, painted somewhere invisible. Diagnose by measuring the offset: if it
  equals the palette's top-left, it is this.
- **A hex within N of another can be up to ~1.5N away in offset `r`.** Cube coordinates are
  exact, offset coordinates are not. Anything that boxes a neighbourhood in `(q,r)` will
  silently miss real neighbours. `_buildEmptyHexCandidates` in `js/routes.js` still does
  this — it under-collects empty hexes at the fringe. Not fixed, low impact, but real.

### 0.0.2 The next feature — SUPERSEDED, read this first

**Route "forcing" was designed in full on 2026-08-19 and then DROPPED on 2026-08-27.**
Everything below the line in the old version of this section — the filter-relaxing second
pass, the weighted penalty search, `forced: true` segment flags, dashed rendering, the
"Detour outside the filter if needed" checkbox — **is not being built.** Do not resurrect it
without talking to Sean. That spec has been rewritten as `route_partial_spec.md`; its §13
records what forcing was and why it went.

**What replaced it: partial route generation.** From a power user, via Sean:

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

### 0.0.2.1 Progress — v0.17.3 partial routes

| Step | State |
|---|---|
| 1. Waypoint input top clipped by its scroll container | **DONE** — `hex_map.html`, padding on `#route-auto-p2p-waypoints-list` |
| 2. Close v0.17.2 | **DONE** — dated 2026-08-19 |
| 3. `_autoAssignXmlRoutes` + `applyLoadedMapData` undo | **DONE** — both now pass `includeRouteDefinitions` |
| 4. Rebuild test harness into `utilities/` | **DONE** — see §0.0.5 |
| 5. Engine: partial generation | **DONE** — see the contract below |
| 6. Failure message names C | **DONE** — `_p2pFailureMessage`, plus its toast 6s -> 9s |
| 7. The checkbox + persistence + toast | **DONE** — `route-auto-p2p-allow-partial`, "Build as far as possible" |
| 8. Marker at C + the panel line | **DONE** — dashed ring in `renderer.js`, notice + STOPS HERE row in the panel, `getRouteShortfall()` staleness guard in `routes.js`. **Amended 2026-08-27:** the guard now tests C's *degree*, not mere presence — a route manually extended past C used to keep the ring while visibly carrying on through it. No dismiss control, by design: the mark stays purely derived |
| 9. Docs, spec rewrite, changelog | **DONE** — v0.17.3 bumped in all 4 places; 6 changelog entries; `help_routes.md`; spec rewritten as `route_partial_spec.md` |

**The engine contract, as built (step 5):**

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

### 0.0.4 Housekeeping not yet done

- ~~**The v0.17.2 changelog entry is still marked "In Progress"**~~ **DONE 2026-08-27.**
  Dated `2026-08-19` in both `changelog.md` and `README.md` — the date the eight items were
  finished and committed, matching the sibling v0.17.1 entry, rather than the later date the
  series was formally closed. `APP_VERSION`, `APP_BANNER`, the splash screen and the
  shortcut help panel already read `v0.17.2` and needed no change.
- The eight shipped items are committed as `aeeb884`; only directives were outstanding
  after that.
- **Unrelated, noticed while closing this out:** `html_extract_manifest.md` OPEN-2 (and its
  §9.1 note) still says `changelog.md` reads `[v0.17.0.1] - In Progress`. It does not — that
  entry is dated `2026-08-10`. OPEN-2 is stale on the dating point; whether its *other*
  claim holds — that entry 1 is contradicted by entries 2 and 4 in the same section — was
  not checked here.

### 0.0.5 The test harness — REBUILT AND COMMITTED 2026-08-27

Last session's Playwright scripts lived in a session temp directory and were lost. They have
now been rebuilt and **committed to `utilities/`**, so this cannot happen again. Sean
approved adding them to the repo.

| File | What |
|---|---|
| `utilities/route_test_common.js` | Shared bootstrap: launches `hex_map.html` past the splash, builds a deterministic map, fingerprints segments |
| `utilities/route_corpus.js` | The corpus differ — 19 scenarios × 2 maps = **38 scenarios, ~18,000 segments** |
| `utilities/route_perf.js` | The performance measure — long leg, full-exhaustion leg, and a 19-leg route at six map sizes |

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

### 0.0.6 Open items, none blocking

- ~~`_autoAssignXmlRoutes` (`js/io_manager.js`) calls `saveHistoryState` **without**
  `includeRouteDefinitions`~~ **FIXED 2026-08-27.** Now passes
  `{ includeRouteDefinitions: true }`. Verified in-browser: an import that renames and
  recolours two slots and adds 3 segments is fully reverted by Ctrl+Z and fully restored by
  Ctrl+Shift+Z. A negative control — stripping the option at runtime — confirms the test
  detects the bug rather than passing vacuously.
- **Two findings from the "check `js/otu_importer.js` for the same" sweep:**
  - `js/otu_importer.js` contains **no `saveHistoryState` call at all**, so the option does
    not apply there. The *universe* import (~line 476) deliberately clears `undoStack` and
    `redoStack` — it wipes IndexedDB and rebuilds a 16×8 grid, so it is a new-document
    operation, correctly not undoable. But the **multi-sector** import's `bulkMode` comment
    ("skip per-sector saveHistoryState … all done once after the loop") describes a
    deferred snapshot that **does not exist** in the post-loop block — that block does
    `reapplyAllRules`, `applyActiveFilters`, `syncAllHexes`, `saveSectorNames` and no
    history save. So either the comment is wrong or a multi-sector OTU import is silently
    not undoable. Not investigated further; needs Sean's call on whether an import that
    large should be undoable at all.
  - ~~**`applyLoadedMapData` (`js/io_manager.js`, "Load Map JSON") has the identical
    bug**~~ **FIXED 2026-08-27** on Sean's go-ahead. It called plain
    `saveHistoryState('Load Map JSON')` and then replaced `window.routeDefinitions`
    wholesale from the file, so Ctrl+Z restored hexes and segments but left the loaded
    file's route slots in place — segments came back belonging to slots that were no longer
    theirs. Verified in-browser: loading a file carrying two foreign slots over a map with a
    renamed, recoloured slot 1 is fully reverted by Ctrl+Z (all 9 slots and 24 hexes back,
    the custom name and colour intact) and restored by Ctrl+Shift+Z.
- Three file-shaped icons now sit in each Route Manager row (⬇ CSV, save, load), hard to
  tell apart without hovering. Standing reservation needing Sean's eye in real use —
  `route_file_spec.md` OQ-1.
- `getAutoRouteGroups()` and `clearAutoRouteGroup()` in `js/routes.js` appear to have no
  callers. Not exhaustively verified; check before assuming they are dead.

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

> **Superseded by §0.0 above (2026-08-19).** The section below describes the project as
> of the exports series and is kept for the System Editor detail it carries. Where the two
> disagree about what is current, §0.0 is right.

### 0.1 Where the project is

| | |
|---|---|
| **Most recent work** | **v0.17.x — exports.** Both releases of the wiki exporter are complete and committed (HEAD `9971e99`). See the companion manifest; nothing in *this* document is in progress. |
| **This document** | v0.16.x System Editor. **Paused** after MgT2E, CT and T5 were brought fully online. |
| **Paused** | RTT and AoW editor support — the reason this manifest is retained. |
| **Open here** | Three items only, all in 6.2: OW-3, OW-5 layer 2, OW-65. See section 4. |

**Nothing is currently in progress in either manifest.** The companion's section 9 lists
two non-blocking open items (an in-app number-formatting sweep, and dating the v0.17.0.1
changelog entry); this document's section 4 lists three. There is no half-finished work.

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

**All recent work has been in `directives/html_extract_manifest.md`, not here** — and as of
2026-08-04 that work is complete too, so **nothing anywhere is currently in progress.** The
three items above are the System Editor's own residue; picking any of them up means
resuming the paused RTT/AoW work, for which section 0.3 is the entry point.

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
