# PARTIAL ROUTES — Feature Spec (Point-to-Point)

**Target version:** v0.17.3 — **IMPLEMENTED 2026-08-27**, verified in-browser.
**Supersedes:** `route_forcing_spec.md` (this file, renamed). Route *forcing* was designed
in full on 2026-08-19 and **dropped on 2026-08-27** before any of it was built. §13 records
what it was and why it went, so it is not reinvented by accident.
**Scope:** Point-to-Point only. No other generator is touched.
**Related:** `js/routes.js` (`generatePointToPointRoute`, `_bfsPath`, `_bfsPathWithEmpty`,
`getRouteShortfall`), `js/ui_menus.js` (P2P panel, Systems panel), `js/renderer.js`,
`directives/route_file_spec.md`, `directives/project_manifest.md`

---

## 1. The problem

Point-to-Point was built as one-and-done: generate a route, and if you don't like it, delete
it and generate another. That is right for a route inside one sector.

It is wrong for routes across the OTU, dozens of legs long, where the automation's criteria
will not hold over the whole distance. There, "No path found on leg 14" throws away thirteen
good legs and starts a research problem. From the power user this feature exists for:

> "I personally like it to generate as far as it can so I can manually bridge it and tell it
> to continue. That's the least amount of work."

---

## 2. What it does

When a leg cannot be routed, the generator keeps the route **as far as the search actually
reached** — up to **C**, the reachable world closest to the stop it was aiming for — marks
C, and stops. The user adds a waypoint near C and regenerates, which costs 0.2 s at
Imperium scale after WP0 (§9.1).

**Nothing is relaxed.** This is the whole simplification, and the reason it replaced forcing:

| | |
|---|---|
| **Max Jump** | never exceeded. A physical claim about the user's ships |
| **The filter** | obeyed exactly as before. No detouring through excluded worlds |
| **Allow Empty Hexes** | untouched. Off means off |
| **C** | always a **world**, never an empty hex, even in empty-hex mode — it exists to be bridged from, and a route ending in deep space is a jump to nowhere |

**Therefore a route can still stop well short.** A rift wider than Max Jump with nothing in
it cannot be crossed by any of this. What the user gets is the part that works, plus the
exact location and size of the problem.

---

## 3. Decisions taken

Settled with Sean, 2026-08-27.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Stop at the FIRST shortfall.** Later legs are not attempted | Keeps the route one unbroken chain, so `getRouteSystemList` still lists it in travel order. Continuing past a gap gives two chains and four dead ends, and that function silently falls back to alphabetical — degrading the panel exactly when the route is most complicated. It also deleted an entire work package |
| D2 | **C is the reachable world closest to the target**, tie-broken by fewest hops, then world-array order | It is the world the user would pick as a bridging waypoint. The tie-break is the same discipline that made WP0 provably route-identical |
| D3 | **No partial when nothing reachable is closer than the start** | The start is then already the best bridging point. A "partial route" heading away from the target is noise |
| D4 | **A checkbox, default off** | Preserves one-and-done completely. A route that failed before still fails, changes nothing, and reports the same way |
| D5 | **The strict failure message names C too**, whether or not the box is ticked | Pure information, changes no state, and it is most of what the user needs in order to act |
| D6 | **A route that stops short IS a route.** It commits, marked | The explicit request. It does change what a route slot can hold, which is why it is marked everywhere it is shown |
| D7 | **Marks are read through a staleness guard**, never trusted raw | A shortfall describes *that generation*; segments can be hand-edited afterwards |

---

## 4. As built

### 4.1 The search — `js/routes.js`

`_bfsPath(startId, endId, worlds, maxJump, worldById, outBest)` and
`_bfsPathWithEmpty(..., maxEmptyJumps, outBest)` take an **optional** out-parameter. Their
`path | null` return is unchanged.

- When `outBest` is supplied and the search **exhausts**, it is filled with
  `{ id, path, distance, hops }`.
- `bestDist` starts at the START's own distance to the target and only **strictly closer**
  nodes are accepted, which delivers D3 for free and guarantees `C !== start`.
- BFS dequeues in nondecreasing hop order and `_indexNeighbours` returns world-array order,
  so the first node accepted at a given distance is the fewest-hops one — D2, also free.
- **All tracking is behind a null check.** Custom Network, and BTN which calls the search
  once per qualifying world pair, pass nothing and pay nothing.
- In `_bfsPathWithEmpty`, only the **system-neighbour** loop tracks, which is what keeps C a
  world rather than an empty hex.

### 4.2 The generator

`generatePointToPointRoute(..., maxEmptyJumps, allowPartial = false)` returns
`{ segments, failure, shortfall }`.

- `shortfall` = `{ legIndex, total, fromId, targetId, reachedId, distance, finalStop }`,
  non-null only when a partial route was committed.
- `failure.reachedId` / `failure.shortfallDistance` are populated on a strict failure, and
  are null when nothing reachable was closer than the leg's own start.
- **`best` is requested on every P2P run**, not only when `allowPartial` is on, because D5
  wants C as well. Measured cost at 16,000 worlds: full-exhaustion leg 31.4 → 32.4 ms;
  19-leg route 147 → 151 ms; long leg unchanged.

### 4.3 The staleness guard

`getRouteShortfall(routeId)` in `js/routes.js` — the only supported way to read a shortfall.

The mark asserts exactly one thing: **the route stops here.** So the test is not "is C still
on the route" but "is it still an **end** of it", which is a degree count. Three ways the
assertion goes false:

| Condition | Meaning |
|---|---|
| `degree(reachedId) === 0` | C is no longer on the route |
| `degree(reachedId) > 1` | the route now runs **through** C — the user extended it past where it gave up, so it demonstrably does not stop there |
| `targetId` present | the user bridged all the way to the stop that could not be reached |

Extending the **other** end of the route leaves C at degree 1, and the mark correctly stays.

The degree test replaced a plain "is C present" test, which left the ring showing on a route
the user had manually extended past C — the ring said "stops here" while the route visibly
carried on. Found by walking all seven ways a user can edit such a route.

**There is deliberately no way to dismiss a mark that is still true.** Keeping it purely
derived means it never has to be maintained, invalidated, or saved with the sector — and if
a ring is on screen, the route really does end there. This is the same reasoning that
rejected acknowledgeable flags when this was still forcing (§13). Revisit only if a
truthful ring proves annoying in real use.

Lives in `routes.js` because both `renderer.js` and `ui_menus.js` need it and both already
depend on that file for route semantics.

### 4.4 UI

| Where | What |
|---|---|
| P2P accordion | `#route-auto-p2p-allow-partial`, "Build as far as possible", below Allow Empty Hexes, default off, with an explanatory `title` |
| Persistence | `allowPartial` and `shortfall` join the `p2p` branch of `_saveAutomationConfig` / `_restoreAutomationConfig` |
| Map | dashed ring in the route's colour at C, drawn after all route lines. Dashed survives any user palette where a fixed warning colour would collide |
| Systems panel | amber notice above the list, `STOPS HERE` tag on C's row, `· incomplete` in the footer |
| Toasts | the shortfall toast never says "from X to Y" — Y is the End it did not reach |

---

## 5. Verification

`utilities/route_corpus.js` — **38 scenarios, 18,079 segments identical** with `allowPartial`
off, before and after. Pass 1 is measurably untouched, not merely believed to be. It was
re-run after every subsequent change in this series; all stayed identical.

Behaviour was checked on a purpose-built map (a corridor of 11 worlds, a gap, an unreachable
target) with C computed **independently by the test** rather than read back from the code:
strict failure names C; partial commits and ends at C; exactly two dead ends; multi-leg stops
at the first shortfall; no-progress refuses; empty-hex mode keeps C a world; undo and redo
round-trip; both staleness paths clear the mark.

**A trap worth keeping.** The corpus differ's first draft passed `filteredHexIds: []` with
`filteredOnly: true`, so every P2P scenario silently produced **zero** segments — and a
corpus of zeroes compares equal to itself forever. Per-scenario counts now print on every
run. Read them.

---

## 6. Non-goals

- Any generator other than Point-to-Point.
- Relaxing Max Jump, the filter, or empty-hex traversal — see §13.
- Continuing past a gap to later legs (D1).
- A general drag-and-drop route editor. §14 records that design space.
- Automatic re-routing. This reports; it does not decide the user's criteria were wrong.

---

> **A note on the numbering.** Sections jump 6 → 9 → 13 → 14. The gaps are deliberate:
> §§9 and 14 are retained verbatim from the forcing spec this file replaces, and keeping
> their original numbers keeps existing cross-references to "§9.1" — in
> `project_manifest.md`, in code comments, and inside these sections themselves — pointing
> at the right place. The sections that are gone (7, 8, 10, 11, 12) described forcing's
> gap handling, UI, work packages and interactions; §13 summarises them.

## 9. Performance — measured, and the reason this matters

Measured 2026-08-19 against the real `_bfsPath`, density held constant so only world
count varies. A "long leg" runs corner to corner; "no path" targets an unreachable node,
forcing full exhaustion — **which is precisely the case pass 2 runs after**.

|  worlds | long leg, path found | leg with no path (full exhaustion) |
|--------:|---------------------:|-----------------------------------:|
|     480 |    5 ms  (16 hops)   |                               1 ms |
|   1,200 |    9 ms  (25 hops)   |                              16 ms |
|   2,560 |   64 ms  (36 hops)   |                             101 ms |
|   5,760 |  536 ms  (54 hops)   |                             353 ms |
|  10,240 | 1,279 ms (72 hops)   |                           1,254 ms |
|  16,000 | 3,644 ms (90 hops)   |                           3,699 ms |

Growth is slightly worse than quadratic (worlds ×1.56 → time ×2.95; quadratic would be
×2.44).

### 9.1 After WP0 — implemented 2026-08-19

|  worlds | long leg, path found | leg with no path (full exhaustion) |
|--------:|---------------------:|-----------------------------------:|
|     480 |                 2 ms |                               1 ms |
|   1,200 |                 2 ms |                               2 ms |
|   2,560 |                 5 ms |                               4 ms |
|   5,760 |                11 ms |                              11 ms |
|  10,240 |                18 ms |                              18 ms |
|  16,000 |                29 ms |                              28 ms |

Growth is now linear (worlds ×1.56 → time ×1.56). The felt measure — a nineteen-leg route,
the whole app frozen while it runs — went from **25.3 s to 0.2 s** at 16,000 worlds, and
from 9.8 s to 0.1 s at 10,240.

Verified unchanged, not merely assumed: 19 scenarios across all four generators, both
search functions, empty-hex traversal, filtered searches, cross-sector routes and
unreachable destinations were captured before and after. All **2,603 segments are
byte-for-byte identical**. The tie-break ordering described below is what makes that
possible, and is the reason the neighbour list is re-sorted into world-array order.

**A single sector is invisible. The Imperium is not.** At ~16,000 worlds one leg costs
~3.6 seconds, so a twenty-leg route is over a minute **today, before forcing**. Forcing
adds a second full-exhaustion pass on exactly the legs that already cost the most.

So the optimisation is not premature; it is a prerequisite for the users this spec is
written for. Two independent causes, both self-contained:

1. **`_bfsPath` rescans every world in the sector for every node it dequeues** — an O(V)
   neighbour scan inside an O(V) loop. A spatial bucket index (hex → bucket, scan only
   buckets within Max Jump) makes the scan O(k). This is the dominant term.
2. **Every enqueue copies the whole path so far** (`[...path, w.id]`). At 90 hops and many
   thousands of enqueues that is significant churn. Parent pointers with one
   reconstruction at the end remove it.

Both are pure refactors — identical paths out, faster — and both are testable by asserting
the routes produced are unchanged. **WP0 shipped on its own in v0.17.2** — see §9.1;
the work-package table that this sentence originally pointed at belonged to forcing
and is gone with it (§13).

---

---

## 13. Route forcing — designed, then dropped

Recorded so it is not reinvented by accident. Designed in full 2026-08-19; dropped
2026-08-27 before any of it was built. **WP0, the pathfinder scaling fix, was the one piece
that shipped** — independently, as v0.17.2 changelog item 8. §9.1 records its result.

**What it was.** A second, permissive pass that ran only when the strict search failed *and*
a box was ticked, allowed to route through worlds the filter excluded, weighted so it
minimised filter breaks first and hop count second. Compromised segments would carry
`forced: true` and draw dashed. An impassable leg became a visible gap and the route
continued past it. Max Jump and Allow Empty Hexes were never to be relaxed.

**Why it went.** Power-user feedback reframed the problem. What they wanted was not a route
that bends its criteria to get through — it was *the part of the route that works, plus the
location of the problem*. Partial generation delivers that, and the filter stays a hard
constraint, which is arguably better: a user whose filter is too tight finds out, rather than
being quietly routed around it.

**What went with it:** the weighted penalty search, `forced: true`, dashed forced segments,
the "Detour outside the filter if needed" checkbox, the greyed-out-when-no-filter state, the
gap model, and the component-aware travel-order rewrite that gaps would have forced
(`getRouteSystemList` needs no change under D1).

**Questions it left, now moot:** whether flags should be acknowledgeable and persist (there
are no flags — only a derived mark read through `getRouteShortfall`), and whether route
files should carry them (`route_file_spec.md` is unchanged by this work).

**If it is ever revived**, the one idea worth carrying over is the weighted cost:
`cost(hop) = 1 + (W filtered or a stop ? 0 : PENALTY)` with PENALTY larger than any
achievable hop count, which is lexicographic in practice. And the constraint that made it
safe: build it as a *separate* function, never by modifying `_bfsPath`, so the path every
existing route takes carries no new risk.

---

## 14. Route editing — the wider design space

Recorded because it was worked through in full on 2026-08-19 and then deliberately
narrowed. The "worklist" it refers to was forcing's §8.3 — clicking a mark to jump to it
and offering the fix it calls for — which went with forcing (§13). Partial routes deliver
the useful half of it directly: the Systems panel names the stop that was missed and tells
you to add a waypoint near where the route stopped. This section is the wider design space, and what
survives if that turns out to be too little.

### 14.1 The problem

The thing being edited is a *shape on a map*; the surface it is edited through is a *form*.
A twenty-stop route is twenty text rows, and the work is holding "row 7" and "that hex over
there" in mind at once. Every specific complaint — ▲▼ reordering one step at a time,
◎-per-field picking, retyping names — is a symptom of that mismatch rather than its own
problem.

### 14.2 The gesture model, if a full editor is ever built

A P2P route is already **stops + independently generated legs**, which is exactly the model
Google Maps route editing uses. The gestures map onto existing code:

- **Drag a waypoint** to another hex → the two legs touching it regenerate. Two searches.
- **Drag the middle of a leg** onto a hex → inserts a waypoint there, splitting that leg.
  This is the valuable one: it says "go via here" without thinking about list positions.
- **Click a waypoint → delete** → its two legs merge and regenerate.
- **Drag an endpoint** to extend or trim.

Freezing the map is the cheap part: dimming everything but the route is render-only state,
and `window.filterSuspended` (Shift+F) is the precedent for a "look at the map differently"
flag that is deliberately never saved. Restricting clicks to the route is one mode check in
`canvas_input.js`. Panning and zooming must keep working while a drag is armed, which
MapPick already solved (delivery on mouseup, 4px slop) — reuse it rather than reinvent it.

### 14.3 The three real obstacles

1. **`automationRef` must follow the map.** Drag a waypoint and
   `automationRef.params.waypointIds` has to change with it, or reopening the Auto panel
   shows a stale form and regenerating silently discards the edits. This exact class of bug
   shipped and was fixed in v0.17.2 item 2. A route hand-edited beyond what any generation
   would produce also makes `automationRef` a lie, so it likely needs an "edited by hand"
   flag that makes regeneration warn first.
2. **Undo granularity.** One drag should be one undo step, but `saveHistoryState` snapshots
   all of `hexStates` plus all routes — which is why the undo limit already drops to 5
   snapshots on large grids. A mode pushing one of those per drag would be punishing on a
   big map. It probably needs a lighter route-only history, which is a design decision, not
   a detail.
3. **Hit-testing a line, not a hex.** All map interaction today is hex-based. Dragging the
   middle of a segment needs point-to-line-segment distance in screen space, and must cope
   with the renderer's side-by-side offsetting where routes share a corridor.

### 14.4 What WP0 changed about this

Live preview while dragging — recompute the affected leg on each hex change and draw it as
a ghost — was impractical before: a single leg cost 3.6 s at Imperium scale. After WP0 it
is 11–29 ms (§9.1). Per-drag regeneration is now viable at any map size, which materially
improves the case for the full editor if it is ever wanted.

### 14.5 Stage 0 — worth doing whether or not any of the above happens

Neither a new mode nor new concepts, and it removes most of the "which row is which hex"
pain:

- Hover a waypoint row → its hex pulses on the map. Hover a hex → its row highlights.
- Click a row → the map centres on that hex.
- **Drag to reorder the waypoint rows**, replacing ▲▼. The System Editor already does
  drag-and-drop reordering for T5 moons (v0.16.2.0 item 13) — copy that pattern.

None of this is wasted if the full editor is later built.

### 14.6 Structural opinion

Make any editing mode **a mode of the Route Manager, not a second floating window.** A new
palette brings z-order, focus and "which palette owns the canvas" questions that a mode
toggle does not — and see the palette positioning trap that cost most of v0.17.2 item 1.

### 14.7 Out of scope, decided

Editing for the graph route types (XBoat, BTN, Custom Network) is **not** pursued: they
have no ordered stop list to drag. Segment-level editing there already exists as alt-drag,
and the complaint that motivated it — orphaned segments with "no way of deleting just
them" — was the v0.17.2 item 2 bug, now fixed.
