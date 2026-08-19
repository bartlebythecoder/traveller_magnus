# ROUTE FORCING — Feature Spec (Point-to-Point)

**Target version:** v0.17.3 or later — not scheduled
**Status:** SPEC — forcing itself not implemented. WP0 (the pathfinder scaling fix, §9.1)
was split out and shipped on its own in v0.17.2. Written 2026-08-19.
**Scope:** Point-to-Point routes only. No other generator is touched.
**Related:** `js/routes.js` (`generatePointToPointRoute`, `_bfsPath`,
`_bfsPathWithEmpty`), `js/ui_menus.js` (P2P panel, Systems panel),
`directives/route_file_spec.md`, `directives/project_manifest.md`

---

## 1. The problem

Point-to-Point was built as a one-and-done tool: generate a route, and if you don't like
it, delete it and generate another. That is the right model for a route inside one
sector.

It is the wrong model for the users this spec exists for — people building routes across
the OTU universe, dozens of legs long, where the automation's criteria will not hold over
the whole distance. For them, "No path found on leg 14" starts a research problem: why did
that leg fail, was it the jump range or the filter, and what would fix it? The expensive
part of their day is **finding** the problem, not solving it.

Forcing inverts that. Instead of failing, the generator produces the whole route and marks
every place it had to compromise. The user gets an answer rather than a search.

This also shrinks the editing problem. A general-purpose route editor is open-ended;
"fix these four marked spots" is bounded. Forcing first makes the editing work smaller and
better aimed, which is why it is specified first.

---

## 2. Decisions taken

Settled with Sean, 2026-08-19.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Jump is inviolable.** Forcing never exceeds Max Jump | It is a physical claim about the user's ships. A route nobody can fly is worse than no route |
| D2 | **The filter is the only soft criterion.** Forcing may route through worlds that do not match the active filter | A preference, not a physical limit. Detouring through a backwater is what a real trade route does |
| D3 | **Allow Empty Hexes is untouched by forcing.** Off means off, even when forcing | That checkbox is a table ruling about jumping into deep space. Forcing must not overrule a ruling |
| D4 | **An impassable leg becomes a visible gap** and the route continues past it | A gap is information. A fabricated jump is a lie. The user still gets a complete artifact to work from |
| D5 | **Two passes.** The strict search runs first, unchanged; the permissive search runs only when it fails *and* the box is ticked | Existing behaviour then *cannot* change, rather than merely *shouldn't* |
| D6 | Forcing applies **per leg**, not per route | Legs that succeed strictly stay strict |
| D7 | A route that ends up with **zero segments is still a failure** | A two-stop route whose only leg is impassable rolls back and reports, rather than creating an empty route |
| D8 | The control **defaults off** | Preserves the one-and-done workflow completely |

### 2.1 What D1–D3 mean together

Forcing **cannot guarantee a route always connects**. If a rift wider than Max Jump has no
worlds in it, relaxing the filter changes nothing — there is no world of any kind to hop
through, and empty hexes are off. That case is D4's gap.

"A route is always created" therefore means: *you always get a complete, inspectable
artifact with every problem marked*, not *every route connects end to end*. This
distinction must survive into the UI wording (§8).

---

## 3. Assumptions awaiting sign-off

These were proposed and not explicitly confirmed. Each is cheap to change now and
expensive later; none blocks drafting.

- **A1 — Scope includes the worklist.** This spec covers forcing (Stage 1) *and* acting on
  the marks (Stage 2), as separate work packages. Stage 2 can be dropped without
  invalidating Stage 1. Rationale: marks are worthless without a good way to act on them.
- **A2 — Flags are ephemeral.** A compromise is a fresh read-out of what this generation
  did. There is no "acknowledge this detour" state that survives regeneration. Rationale:
  acknowledgement is user state that must persist, be invalidated when the route changes
  beneath it, and travel with the sector. If Sean wants a user working a 100-leg route down
  to zero outstanding problems, this flips, and §11.2 changes with it.
- **A3 — Route files do not carry flags.** Saving and loading a forced route (see
  `route_file_spec.md`) drops the marks, because they describe a *generation*, not a route.
  The format is versioned, so this is additive later. Reverses if A2 reverses.

---

## 4. The relaxation model

One relaxation, not a ladder. A hop is **compromised** when it arrives at a world that is
not in the active filter and is not one of the route's own stops (stops are already exempt
from the filter today).

Never relaxed, in any circumstance:

- Max Jump.
- Empty-hex traversal, whether the hex may be entered at all and the Max Empty Jumps
  budget — these stay exactly as the existing checkbox sets them.
- Hex validity. A stop that is neither a world nor vacant space still fails as it does now.

**Forcing is inert when no filter is active.** `getFilteredHexIds()` returns every world
when nothing is filtered, so there is nothing to relax. The control must say so rather
than sit there doing nothing — the app already has this pattern, in how the Stellar Info
filters grey out with an explanation (v0.16.2.1 item 11).

Note the interaction with **Shift+F**: suspending the filter hides it on screen but
deliberately leaves it applying to generation. A forced route generated while the filter
is suspended is still measured against the real filter. The P2P panel already warns about
this; the warning should mention forcing too.

---

## 5. Search design

### 5.1 Pass 1 — strict, unchanged

Exactly today's call: `_bfsPath`, or `_bfsPathWithEmpty` when Allow Empty Hexes is on.
Succeeds → that leg is done, no flags, no second pass. **Every route that generates today
takes this path and only this path.**

### 5.2 Pass 2 — permissive, weighted

Runs only when pass 1 returned null *and* forcing is ticked.

A plain BFS over the unfiltered world set would minimise *hop count*, and would happily
step outside the filter three times where once would do. For the users this feature is
for, that is a real annoyance. So pass 2 is a **weighted shortest-path search**:

```
cost(hop to world W) = 1 + (W is filtered or a stop ? 0 : PENALTY)
PENALTY = a value larger than any achievable hop count (e.g. 10_000)
```

which is lexicographic in practice: minimise compromised hops first, hop count second.

State is `(worldId, emptyStreak)` — the same state `_bfsPathWithEmpty` already keys its
visited set on — so the empty-hex budget carries over unchanged. Max Jump remains a hard
filter on which neighbours are considered at all.

This is one new function. `_bfsPath` and `_bfsPathWithEmpty` are **not** modified or
unified. Consolidating all three into one weighted search is an obvious later cleanup and
is deliberately not attempted here: it would put the risk back into the path every
existing route takes.

### 5.3 Gaps

If pass 2 also fails, the leg is recorded as a gap: no segments, both its stops noted, and
generation **continues with the next leg**. The route becomes two or more disconnected
chains, which is intended and must be handled everywhere (§7).

---

## 6. Marking and reporting

### 6.1 On the segments

Segments already carry arbitrary fields. A compromised hop gains:

```js
{ ...segment, forced: true }
```

A segment is flagged when either endpoint is a compromised world. The list of compromised
*worlds* — which is what the user actually reasons about — is derived from the flagged
segments for reporting.

Flags persist in the sector save automatically, because segments are saved wholesale.
That is acceptable under A2: they describe the last generation, and the next generation
rewrites them.

### 6.2 On the map

Forced segments draw differently — dashed is the obvious candidate, since it survives any
route colour, where a warning colour would collide with the user's own palette. Gaps draw
as nothing at all, with both stops marked; drawing a line across a gap would imply
passage.

The renderer change is confined to `drawRouteSegment` and its caller in renderer.js.

### 6.3 In the panel and the log

The Systems panel gains a summary line and a per-compromise list:

> **3 compromises, 1 gap**
> · leg 7 — via Karrhan (1-C-1804), not in filter
> · leg 7 — via Dsuna (1-C-2003), not in filter
> · leg 12 — via Mirriam (2-A-0410), not in filter
> · leg 18 — **no route** from Regina to Rhylanor within Jump-2

Clicking an entry centres the map on it. For a hundred-leg route the generation log
(`tSection` / `writeLogLine`) carries the full account, as it already does for BTN.

The completion toast reports counts, not detail: *"Silk Road generated: 214 segments,
3 compromises, 1 gap."*

---

## 7. Gapped routes break travel order — and the fix

`getRouteSystemList` (ui_menus.js:1220) derives travel order by walking the segment graph
and only trusts the result when it finds **exactly two** dead ends. A route with one gap is
two disjoint chains — four dead ends — so it silently falls back to listing worlds
alphabetically.

That degrades the panel exactly when the route is most complicated, for exactly the users
this feature serves. It must be fixed as part of this work, not after.

**Approach:** walk each connected component into a chain using the existing logic, then
order the components by where their stops appear in the slot's `automationRef` stop list
(`[startId, ...waypointIds, endId]` — the true order, already stored). Fall back to
today's behaviour when there is no `automationRef`, so hand-built and imported routes are
unaffected.

Deliberately **not** storing the generated path on the definition: it would go stale the
moment a segment is hand-edited, and we would have to detect that.

---

## 8. UI

### 8.1 The control

A checkbox in the P2P accordion, beside Allow Empty Hexes.

**Label it for what it does, not "force".** "Force route" promises it will break anything
to get through, and after D1 it breaks exactly one thing. Proposed:

> ☐ **Detour outside the filter if needed**
> Uses worlds that don't match the filter when there is no other way through, and marks
> where it did. Never exceeds Max Jump.

Greyed with an explanation when no filter is active (§4).

### 8.2 Persistence

`_saveAutomationConfig` / `_restoreAutomationConfig` already have a `p2p` branch carrying
`allowEmptyHexes` and `maxEmptyJumps`; the new flag joins them. One line each side.

### 8.3 Stage 2 — the worklist (see A1)

Each entry in the compromise list offers the fixes that entry actually calls for:

- **A compromised hop** — *Add a waypoint here* (opens the map pick armed for a new
  waypoint inserted at that position in the list) · *Accept* (dismiss for this session).
- **A gap** — *Add a waypoint between these stops* · *Raise Max Jump to N* (the smallest
  value that would close it, computed from the two stops' distance) · *Accept*.

This is far smaller than a general drag-and-drop route editor, and solves most of the same
problem, because the marks tell it exactly where to act. The drag-a-leg-to-bend-it gesture
remains a possible later feature, not a prerequisite.

---

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
the routes produced are unchanged. **WP0 (§10) should land before or alongside Stage 1.**

---

## 10. Work packages

| WP | What | Notes |
|---|---|---|
| ~~**WP0**~~ | ~~Spatial index + parent pointers~~ — **DONE 2026-08-19**, shipped independently of forcing as v0.17.2 changelog item 8. See §9.1 | |
| **WP1** | The weighted pass-2 search, gap recording, per-leg flags | `js/routes.js`. `generatePointToPointRoute` returns compromises and gaps alongside `segments`, extending the `{ segments, failure }` contract added in v0.17.2 |
| **WP2** | The checkbox, persistence, toast, and the inert-with-no-filter state | `js/ui_menus.js`, `hex_map.html` |
| **WP3** | Dashed rendering for forced segments | `js/renderer.js`, confined to `drawRouteSegment` |
| **WP4** | Component-aware travel order (§7) + the compromise list in the Systems panel | `js/ui_menus.js` |
| **WP5** | *(Stage 2, per A1)* the worklist's inline fixes | `js/ui_menus.js` |
| **WP6** | Changelog, `help_routes.md`, manifest | |

---

## 11. Interactions with existing features

### 11.1 Atomic generation (v0.17.2 item 2)

`_generateIntoSlot` judges failure by whether the slot ended up with segments. A forced
route with gaps still produces segments, so it commits normally. A route where *every*
leg is impassable produces none and rolls back — which is D7, and needs no special code.

### 11.2 Undo

Unchanged: forcing produces a normal generation, one history entry, rolled back atomically
on failure. If A2 reverses and acknowledgement becomes persistent user state, it must join
the snapshot — and the `includeRouteDefinitions` mechanism added in v0.17.2 item 5 is
where it would go.

### 11.3 Route files (`route_file_spec.md`)

Per A3, flags do not travel. If that reverses, the format gains an optional per-segment
field and a `version` bump is not required — unknown fields are already tolerated on
read... **verify this before relying on it**; `_parseRouteFile` validates the fields it
knows and ignores others, but that should be confirmed rather than assumed.

### 11.4 The failure message (v0.17.2 item 3)

With forcing off, unchanged. With forcing on, a leg that fails both passes no longer
produces the "no path for leg N" toast — it becomes a gap in the completed route, reported
in the summary instead. Both messages must stay accurate for their own mode.

---

## 12. Non-goals

- Any generator other than Point-to-Point.
- Exceeding Max Jump under any circumstance (D1).
- Turning on empty-hex traversal (D3).
- A general drag-and-drop route editor. §8.3 is deliberately the narrow version.
- Automatic re-routing. Forcing reports; it does not decide the user's criteria were wrong.

---

## 13. Open questions

- **OQ-1** — A1, A2 and A3 in §3 need explicit sign-off.
- **OQ-2** — Dashed is proposed for forced segments (§6.2). Confirm that reads clearly
  against the existing side-by-side offsetting when several routes share a hex corridor.
- ~~**OQ-3** — Should WP0 ship on its own first?~~ **RESOLVED: yes, and it has.** Shipped
  as v0.17.2 item 8, independently of forcing. §9.1 records the result.
