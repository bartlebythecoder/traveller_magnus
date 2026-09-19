# ROUTE EXTENSION — Feature Spec (Continue and Combine)

**Target version:** v0.17.4 (settled 2026-09-01).
**Status:** **COMPLETE — shipped in v0.17.4, 2026-09-01.** All six work packages built,
verified in-browser and documented. Every decision below was settled with Sean on 2026-09-01, one question
at a time, before any code was written. See §14 for what is done.
**Scope:** Point-to-Point only. No other generator is touched.
**Related:** `js/routes.js` (`generatePointToPointRoute`, `addRoute`, `getRouteShortfall`),
`js/ui_menus.js` (Route Manager, P2P panel, `getRouteSystemList`, `_generateIntoSlot`,
`_saveAutomationConfig`), `hex_map.html` (`#route-auto-config-p2p`, the route row),
`directives/route_partial_spec.md`, `directives/route_file_spec.md`,
`directives/project_manifest.md`

---

## 1. The problem

Point-to-Point is one-and-done: press Generate and you get a route, all of it, from nothing.
Every route is built in a single act, and the only way to change one is to build it again.

That is right for a route inside one sector. It is wrong for the users this series exists
for — the ones maintaining routes across the whole OTU, dozens of legs long. For them a
route is not a thing you generate, it is a thing you *grow*, over sessions, as the map fills
in. Today growing one means retyping the entire stop list and regenerating from scratch,
which discards any hand-editing and re-searches nineteen legs that were already correct.

v0.17.3 delivered half the answer: a route that cannot reach a stop now keeps what it could
build and names the world it stopped at. But the user still cannot *carry on from there*
without rebuilding the whole thing. These two features close that gap:

- **Continue** — add a leg to the end of a route that already exists.
- **Combine** — join two routes that meet, end to end, into one.

---

## 2. What it does

**Continue.** A tick-box in the Point-to-Point builder. With it on, Generate **adds to** the
route in the slot instead of replacing it. The Start must be one of the route's two current
end worlds; the new stops are appended; the existing segments are never re-searched.

**Combine.** A control on each Route Manager row. It offers the routes that meet this one
end to end, and folds the one you choose into it. The route you clicked keeps its name,
colour and shortcut; the other is absorbed and its slot removed.

**They are one feature wearing two hats.** Both take a route that already exists and make it
longer without rebuilding it; both must leave the result a single unbroken chain; both need
the same four pieces of machinery (§5). Built together, the second is much smaller than it
looks.

---

## 3. The chain invariant — the rule that governs both

`getRouteSystemList` (`ui_menus.js:1220`) lists a Point-to-Point route **in travel order
only when its segments form a clean chain — an adjacency graph with exactly two degree-1
nodes.** Anything else falls back to listing worlds alphabetically, silently, in both the
Route Systems panel and the CSV export.

So a route with three ends, or two disconnected pieces, degrades exactly when it is longest
and most complicated — the moment the ordering matters most. This is the same reasoning that
produced D1 of the partial-routes spec ("stop at the first shortfall"), and it is why both
features here refuse or warn rather than quietly producing a shape the rest of the app
cannot describe.

**Everything below follows from wanting that invariant to survive.**

> **AMENDED v0.17.5 (2026-09-11).** Everything above is still true of
> `getRouteSystemList`, and the invariant still **gates Combine** (M1) and still decides
> whether a route lists in travel order. What changed is that it no longer gates
> **Continue**. Requiring it there refused routes Point-to-Point produces as a matter of
> course, which is a different question from whether the result can be listed in order —
> that one is answered by warning, per C9. See C1, C4 and §4.1.

---

## 4. Decisions — Continue

Settled with Sean, 2026-09-01.

| # | Decision | Rationale |
|---|---|---|
| C1 | ~~**The Start must be one of the route's two end worlds.**~~ **AMENDED v0.17.5: the Start must be one of the route's loose ends — of which there may be more than two.** Pre-filled with one, editable; anything else is refused with a message that **names every end** | Joining anywhere else adds a branch the route did not have, which changes its shape rather than continuing it. Editable rather than locked so the route can be extended *backwards* from another end, which a locked field would make impossible without rebuilding. `_formatEndList` exists to render "A, B or C" for the refusal message |
| C2 | **Ticking the box rewrites the form**: Start := the route's end, End := blank, waypoints cleared. Unticking restores the full saved setup | The form otherwise shows the old route's stops while meaning something entirely different, and Generate straight after ticking would try to re-add legs the route already has. The clear waypoint list is then free for stops belonging to the *new* leg |
| C3 | **The saved setup accumulates.** The old End slides into the waypoint list; the new target becomes the End | Keeps the stored setup describing the whole route, so reopening the panel shows every stop in travel order and a later plain Generate rebuilds all of it — valuable after changing Max Jump or the filter. The alternative, storing only the last leg, is the `automationRef`-becomes-a-lie bug class that shipped and was fixed in v0.17.2 item 2 |
| C4 | ~~**Any slot whose segments form a clean chain is eligible.**~~ **AMENDED v0.17.5: a slot is eligible when its segments form ONE CONNECTED PIECE with AT LEAST ONE LOOSE END** — whether or not this app generated it. Still refused: a **closed loop** (no end to grow from) and a route in **disconnected pieces** (continuing it would grow one piece and silently leave the rest behind; the message points at Combine instead). A route with no stored setup still gets none manufactured — see OQ-4 | Routes long enough to be worth extending are exactly the ones people import or load from a route file, so restricting to app-generated routes would exclude the main case. **The clean-chain test was strictly stronger than Continue needs**, and Point-to-Point violates it routinely: it resolves every leg with its own BFS, so a leg routed back through a world an earlier leg used gives that world degree 4, and a leg that doubles back hands `addRoute` pairs the slot already holds — they are skipped, leaving the turnaround world as a loose **third** end. A waypoint behind you produces exactly that, and a round trip is close to guaranteed to. All of them were refused, above a tooltip claiming the route had no end when it had three |
| C5 | **On a route that stopped short, the Start pre-fills with C** — the ringed world — and the End is left blank. The unreached target drops out of the setup | C is the world to bridge from; this is the workflow v0.17.3's ring was built to enable. Pre-filling the End with the unreached target instead would invite an immediate second failure, since that is precisely the leg that just failed |
| C6 | **The box always resets to off when the panel opens** | It modifies one action; it is not a property of the route. Left silently ticked, a later Generate appends when the user expected a rebuild. Contrast `allowPartial`, which *is* persisted, because it describes how the route should be built rather than what this press will do |
| C7 | **Existing legs are never re-searched.** Only the new leg is | The whole point: a nineteen-leg route must not be rebuilt to add a twentieth, and any hand-editing of the existing segments must survive |
| C8 | **Atomic.** If the new leg finds nothing, the existing route is completely unchanged | Extends the guarantee `_generateIntoSlot` already gives. A continuation that fails must never cost the user the route they had — that was v0.17.2 item 2 |
| C9 | **A path that crosses the route is committed, with a warning** that it now branches and will list alphabetically | The crossing is the pathfinder's choice, not user error, and the segments are real and draw correctly. Refusing would block a legal path; saying nothing would leave the ordering silently degraded |

**Also settled, following from the above:**

- Continue **composes with "Build as far as possible"**: both on, and a continuation that
  falls short commits what it reached and rings that world, exactly as a fresh partial does.
- Continuing from the **other** end **prepends** — the new target becomes the Start and the
  old Start slides to waypoint 1. C3 read symmetrically.
- The box is **disabled on an empty slot**, with a title saying why.
- **One Ctrl+Z** undoes an entire continuation.
- Label: **"Continue existing route"**.
- **Point-to-Point only.**

### 4.1 Amended in v0.17.5 (2026-09-11)

C1 and C4 above are struck and restated. Four behaviours follow from the weaker rule that
the original decisions had no reason to cover:

| # | Decision | Rationale |
|---|---|---|
| C10 | **A continuation that leaves the route with more than two loose ends CLEARS its saved setup**, and the toast says so | C3's accumulation writes a single run of stops — Start, waypoints, End. A route with three ends is not one run, so the world grown from is neither the Start nor the End and the accumulated setup would no longer describe the route. Keeping it is worse than having none: the panel would show stops that do not match the map, and a later plain Generate would silently rebuild from them. Continue itself is unaffected — it walks the ends from the segments every time. This is OQ-4's position, reached again |
| C11 | **The tick-box is re-tested whenever the slot's segments change**, without disturbing a tick the user has already made | It was computed once, on panel open, and never again — so every way of changing a slot with the panel open left it describing the route as it used to be. Drawing segments by hand is the case that bites, and it is the natural thing to do when a route stops short: open the panel on an empty slot, draw the route, and the box stayed greyed out insisting there were no segments. `refreshRouteWindowCounts` is the funnel every such path already goes through — the same wiring note §8.2 makes for Combine |
| C12 | **A tick cannot outlive its own precondition.** If the route stops being continuable while the box is ticked, the box unticks itself **and the form Continue rewrote is put back** | Leaving it ticked-but-disabled would send C2's rewritten fields — Start = an end, End blank — into a plain rebuild, which is a route the user never asked for. C2 already stashes the original form for unticking; this reuses it |
| C13 | **A continuation that adds nothing because the two worlds are ALREADY CONNECTED says so**, rather than reporting no path | The path is found and every connection on it turns out to be one the route already has, so `addRoute` skips them all. Reporting that as "no path found within Jump-N" sent the user off to raise a jump limit that was never the problem. Distinct from C8: nothing is changed either way, but the reason differs |

**Two tests now exist, deliberately, and must not be merged.** `walkRouteChain` /
`getRouteChain` is the strict one — one unbroken line, exactly two ends — and still governs
travel order (§3) and Combine (M1). `walkRouteEnds` / `getRouteEnds` is the weak one and
governs Continue alone. They build their adjacency identically, on purpose, so the two can
never disagree about the *shape* of a route, only about which shapes they accept.

---

## 5. Decisions — Combine

| # | Decision | Rationale |
|---|---|---|
| M1 | **Eligibility is tested on the merged shape**: the union of both routes' segments must form one unbroken chain with exactly two ends | One rule, testing the actual outcome rather than a proxy for it. "The ends meet" is *not* sufficient — two routes can meet end to end and still branch, if they also overlap somewhere else. Testing the union catches that, plus shared mid-route worlds and disconnected pairs, in a single check |
| M2 | **The picker lists only routes that pass**, so an invalid combine is never offered | An absent option needs no explanation. The rule is enforced by what is on offer rather than by an error after the fact |
| M3 | **You click the icon on the route you are keeping** and pick the one to absorb | Makes direction unambiguous without a second prompt. The survivor keeps its name, colour and shortcut |
| M4 | **The absorbed slot is deleted**, freeing its shortcut key | "Combine" means one route where there were two. An emptied-but-present row reads as a route that still exists. Matches the existing Delete path, which already removes definitions and is undoable |
| M5 | **Every segment in the merged route is stamped `PointToPoint`** | See §6 — without it the listing depends on array order |

**Also settled:**

- Absorbed segments **take the survivor's identity**: `routeId` reassigned, `type` and
  `groupId` derived from the destination slot, and **their own `color` dropped** so they
  wear the destination's colour. This is exactly the pattern route-file import already uses
  (`route_file_spec.md` §6.3), and the reason a loaded route correctly wears its slot's
  colour.
- The merged setup is **rebuilt by walking the merged chain** (§5 machinery), so a combined
  route is still regenerable as a whole.
- **A confirm before committing**, naming both routes, the junction world, and how many
  segments move.
- Undo passes **`includeRouteDefinitions: true`** — a definition is being removed, and
  without it the absorbed slot would not come back.
- Identical segment pairs are not added twice.
- The control is **disabled with an explanatory title** when nothing is eligible.

---

## 6. The subtype trap — found while specifying, applies to both

`getRouteSystemList` decides whether to list in travel order by checking
**`segments[0].subtype === 'PointToPoint'`** — the first segment *in the array*. Hand-drawn,
imported and XML-loaded segments do not carry that subtype.

So both features can produce a perfectly clean chain that still lists alphabetically, purely
because of which segment happens to sit first — continuing a hand-drawn route (C4 allows
it), or combining a P2P route with an imported one. Combining the same two routes in the
opposite order would give a different answer.

**Decision (M5, and the same for Continue): whenever a continuation or a combine leaves the
route a clean chain, stamp `subtype: 'PointToPoint'` on every one of its segments.** The
route file spec already treats `subtype` as topology rather than decoration — "is this a
chain worth ordering" — so this is consistent with how the field is read everywhere else.

Rejected: changing `getRouteSystemList` to decide from the shape alone. It is the better
fix in isolation, but it would change ordering for every existing route in the app,
including imported and hand-drawn ones that list alphabetically today. Far wider blast
radius than these two features justify. **Worth revisiting on its own merits.**

---

## 7. Shared machinery

Four pieces, all needed by both features. Build them once, in `js/routes.js` beside the
route semantics that already live there.

| Piece | What it does |
|---|---|
| **Chain walk** | Given a set of segments, return `{ ok, path }` — the worlds in travel order, or `ok:false` if the segments are not a clean chain. `getRouteSystemList` already contains exactly this logic; extract it rather than write a second copy that can drift |
| **Clean-chain test** | `ok` from the above, applied to a *hypothetical* segment set. This is what M1 tests on the union and what Continue tests to decide whether the box is enabled |
| **Setup manufacture** | Turn a walked chain into a `{ startId, endId, waypointIds }` setup, for routes that have none (C4) and for the merged route (M-also) |
| **Subtype stamping** | Set `subtype: 'PointToPoint'` across a route's segments when the result is a chain (§6) |

**Extract, do not duplicate.** The duplicate `ensureFreeRouteSlot` removed in v0.17.2 item
6, and the two dead functions removed in v0.17.4, are both cautionary: a second copy of
route logic in this codebase drifts and then silently absorbs a fix meant for the other one.

---

## 8. UI

### 8.1 The Continue tick-box

In `#route-auto-config-p2p`, below **Build as far as possible**
(`#route-auto-p2p-allow-partial` is the precedent for markup, wiring and persistence shape —
though this one is deliberately *not* persisted, C6).

### 8.2 The Combine control

A new icon on the Route Manager row, opening a picker of eligible partners.

**The row is already crowded.** It carries six controls today — eye, `C` (clear), ⬇ (CSV),
💾 (save), ⬆ (load), ⚙ Auto, ✕ — of which three are file-shaped and, per `route_file_spec.md`
OQ-1, already hard to tell apart without hovering. This adds a seventh.

**Therefore a legibility pass ships with this feature, not after it** (WP5). The likely
answer is a short text label on the CSV button, which is the one whose shape misdescribes it
— it exports *worlds*, not the route.

**Wiring note.** `refreshRouteWindowCounts` (`ui_menus.js:2951`) re-styles and reassigns
`.onclick` for the save and export buttons on **every** count refresh. The Combine control's
enabled state depends on whether any eligible partner exists, which changes whenever
segments change — so it must be refreshed there too, not only in `renderRouteWindow`. Set it
in one place and it goes stale the moment a route is generated.

### 8.3 The picker

Must be portalled to `<body>` while open, like the world autocomplete. `.draggable-palette`
carries `backdrop-filter`, which makes it the containing block for `position:fixed`
descendants; its `overflow:hidden` then clips them. A dropdown built inside `#route-window`
will be displaced by exactly the palette's top-left offset and vanish once the window is
dragged. This cost most of v0.17.2 item 1 — see `project_manifest.md` §0.0.1.

---

## 9. Implementation plan

| WP | What | Files |
|---|---|---|
| **WP1** | Shared machinery (§7), with no caller yet | `js/routes.js` |
| **WP2** | Continue: the box, form rewrite, endpoint validation, partial pre-fill | `hex_map.html`, `js/ui_menus.js` |
| **WP3** | Continue: append semantics, setup accumulation, crossing warning, atomicity | `js/ui_menus.js` |
| **WP4** | Combine: icon, picker, eligibility, merge, slot deletion, undo | `js/ui_menus.js`, `hex_map.html` |
| **WP5** | Row legibility pass (§8.2) | `js/ui_menus.js`, `hex_map.html`, `style.css` |
| **WP6** | Docs: changelog, README, `help_routes.md`, manifest | — |

WP1 is independently testable and route-neutral; WP2–WP3 and WP4 are each independently
verifiable.

---

## 10. Test plan

In-browser Playwright throughout — `node --check` alone has repeatedly missed real bugs
here. **Capture a route corpus before WP1 and re-diff after every WP**: none of this work
may change a route generated by any existing path.

**Continue**

1. Continue from the End; segments appended, existing segments byte-identical.
2. Continue from the **Start**; new stop prepended, still one chain.
3. Start that is neither end → refused, nothing changed.
4. Ticking rewrites the form; unticking restores it exactly.
5. Setup accumulates; a later plain Generate reproduces the whole route.
6. Continue an imported route with no stored setup (C4). **Corrected 2026-09-11:** this
   item said "setup manufactured correctly", which is C4 as originally drafted. **OQ-4
   reversed that and the code follows OQ-4** — no setup is invented for a route that had
   none, and the suite asserts exactly that.
7. Continue a route that stopped short; Start pre-fills with C; **the ring clears** once C
   gains a second connection.
8. Continuation that finds no path leaves the route completely unchanged (C8).
9. Continue + Build as far as possible together.
10. A crossing path commits and warns.
11. One Ctrl+Z undoes the whole continuation; Ctrl+Shift+Z restores it.
12. The box is off on every panel open (C6) — including immediately after a continuation.

**Combine**

13. Two routes meeting end to end; merged, one chain, travel order preserved.
14. Routes meeting mid-route → **not offered**.
15. Routes meeting end to end **but also overlapping** → not offered (M1, the case "the ends
    meet" would wrongly admit).
16. Non-touching routes → not offered.
17. Merged route wears the survivor's colour; **zero pixels of the absorbed route's colour**
    on the canvas — the measurement route-file import used.
18. Absorbed slot gone, shortcut key free.
19. One Ctrl+Z restores both routes, both slots, both names and colours.
20. Combining a P2P route with an **imported** one lists in travel order — §6, and it must
    pass **in both directions**, which is the assertion that catches the array-order trap.

**Continue — added v0.17.5, for the weakened rule (C1, C4, C10–C13)**

Each of the first four **must be paired with the strict test refusing the same segments**
(`getRouteChain().ok === false`). Without that pairing the check cannot tell the new rule
from the old one, and would go vacuous the moment the rule were reverted.

21. A **three-ended Y** is eligible; the tooltip names all three ends and warns the setup
    will be dropped.
22. A **self-crossing route with two ends** is eligible, and says travel order is lost.
23. A **closed loop** is refused, for that reason.
24. A **line beside a detached loop** is refused as more than one piece — and it presents
    exactly **two** loose ends, which is what makes "count the ends" the wrong test. Same
    shape as the §14.1 bug; it must be checked here too.
25. A bad Start on a three-ended route is refused naming **all three**, in English, with no
    stray indexes (`_formatEndList` hands `.map` the index if called carelessly).
26. C11: drawing segments under an open panel enables the box; a re-test leaves an existing
    tick alone.
27. C12: a tick that loses its precondition unticks itself **and restores the form**.
28. C10: continuing past two ends clears the saved setup, and the toast says so. Aim the new
    leg at a **fresh** world — aiming it at one of the route's own ends joins two ends to each
    other, leaves one end, and the setup is then correctly kept.
29. C13: "already connects", not "no path found", and nothing changes on the map.
30. The announced segment count equals the number actually drawn. **At Jump-1.** At Jump-3
    the pathfinder shortcuts past the route's own edges, nothing is retraced, and the
    miscount cannot be reproduced — the suite's helper hardcoded Jump-3.


**Negative control.** At least one test must be shown to fail when the behaviour it checks
is removed. A suite asserting "the route is a clean chain" passes just as happily on an
empty slot — see the corpus differ's zero-segment trap (`route_partial_spec.md` §5) and the
R9 regression test, which carries an explicit negative control for this reason.

---

## 11. Non-goals

- Any generator other than Point-to-Point. XBoat, BTN and Custom Network have no ordered
  stop list; `route_partial_spec.md` §14.7 already decided against editing them.
- Combining more than two routes in one action. Do it twice.
- Bridging two routes that do **not** touch by generating a connecting leg. That is
  Continue's job, done deliberately, with the user choosing the stop.
- Relaxing Max Jump, the filter, or empty-hex traversal. Unchanged from
  `route_partial_spec.md` §2 — nothing about how paths are *found* changes here.
- A general drag-and-drop route editor. `route_partial_spec.md` §14 records that design
  space; §14.5 "Stage 0" remains the cheap next step if these two prove insufficient.

---

## 12. Open questions

- **OQ-1 — Which end is "the end" on a route with no stored setup?** For an imported or
  hand-drawn route the chain walk's `path[0]` and `path[last]` are decided by segment array
  order, so "the far end" is arbitrary. Low stakes, because C1 makes the field editable and
  both ends are valid. **Proposed:** pre-fill `path[last]` and name the other endpoint in
  the field's title, so switching ends is discoverable. Confirm during WP2 with the real UI
  in front of us.
- **OQ-4 — A route with no stored setup does not get one invented. NEEDS SEAN'S REVIEW.**
  Raised while building WP3; not anticipated when this spec was written. C3 says the saved
  setup accumulates, and C4 says a route with no setup at all — imported, loaded from a
  route file, hand-drawn — is still eligible. The two meet awkwardly: **there is nothing to
  accumulate onto, and no honest way to invent it.** Such a route's *path* is known but its
  *stops* are not, and the two available guesses are both bad:

  | Guess | What goes wrong |
  |---|---|
  | `waypointIds: []`, just the two ends | A later plain Generate silently replaces a carefully imported route with a direct line between its endpoints |
  | Every intermediate world becomes a waypoint | Truthful and regenerable, but a 60-world route becomes a 60-row waypoint form, which is unusable |

  **As built: no setup is created for a route that had none.** Continue keeps working on it
  regardless, because the chain is walked fresh from the segments on every use — the stored
  setup was never what made it eligible. The cost is that such a route never becomes
  regenerable-as-a-whole, which is correct: the app genuinely does not know its stops.
  Verified by test (`OQ-4: no setup is invented for a route that had none`).

  Change this only if being able to regenerate an imported route matters more than the two
  costs above.

- ~~**OQ-2 — What exactly the row legibility pass does**~~ **RESOLVED 2026-09-01: the CSV
  control became a text button.** Decided with all seven controls on screen, as intended.
  The row now reads `👁 · C · CSV · [💾 ⬆] · 🔗 · ⚙ Auto · ✕`: one word, then the two icons
  that really are route files paired in `.route-file-cell`, then the link. Two file-shaped
  icons side by side read as a pair rather than as three near-identical glyphs, and the word
  also fixes the mislabelling — that control exports the *worlds a route passes through*,
  not the route. A useful side effect: the 🔗 is drawn in the accent colour only when a
  partner actually exists, so which routes can be combined is visible without hovering
  anything.
- ~~**OQ-3 — Version number.**~~ **RESOLVED 2026-09-01: v0.17.4.** Consistent with the rest
  of the series — v0.17.1 shipped four "New —" entries as a point release, v0.17.2 and
  v0.17.3 one each — so features in `.x` is the established pattern here rather than an
  exception, and it keeps the whole routes arc legible as one series of v0.17.x.

---

## 14. Progress

| WP | State |
|---|---|
| **WP1** — shared machinery | **DONE.** `walkRouteChain`, `getRouteChain`, `stampRouteSubtype` in `js/routes.js`. `getRouteSystemList` now calls the shared walk instead of carrying its own copy |
| **WP2** — Continue control + form | **DONE.** `#route-auto-p2p-continue`, `_syncContinueControl`, `_applyContinueMode`, `_storedP2pParams` |
| **WP3** — Continue semantics | **DONE.** `_generateIntoSlot(..., { append: true })`, endpoint validation, setup accumulation, subtype stamping, crossing warning |
| **WP4** — Combine | **DONE.** `getCombineCandidates` in `js/routes.js`; `_openCombinePicker`, `_combineRoutes` in `js/ui_menus.js`; the 🔗 row control, refreshed in `refreshRouteWindowCounts` as well as `renderRouteWindow` |
| **WP5** — row legibility | **DONE.** The CSV control is now a text button rather than a third file-shaped icon — see §8.2 and OQ-2 |
| **WP6** — docs | **DONE.** v0.17.4 bumped in all four sites per `update_version.md`; seven changelog entries in `changelog.md` and `README.md`; `help_routes.md` gains *Continuing a Route* and *Combining Two Routes* plus a corrected row table; manifest §0.0 rewritten as the v0.17.4 cold start |

**Verification:** three suites (two at v0.17.4, a third added in v0.17.5), all driving the
real UI rather than the generators, all carrying a **negative control** — without one, a
suite asserting "the route is a chain" passes just as happily on an empty slot.

| Suite | Checks | Negative control |
|---|---|---|
| `utilities/route_continue.js` | 15 → **38** (v0.17.5) | With the box off, Generate must still *replace* — otherwise every "it appended" assertion proves nothing. **Each V-check additionally pairs with the strict test refusing the same shape**, so a reverted rule fails rather than passing vacuously |
| `utilities/route_combine.js` | 13 | Of three candidate routes (one eligible, one non-touching, one joining mid-route) exactly **one** is offered — otherwise the eligibility checks pass vacuously |
| `utilities/route_add_slot.js` | 11 (v0.17.5) | Two added slots must differ from each other in colour **and** key — otherwise every allocation assertion would pass on the old behaviour, which was always green with no key |

Route corpus re-run after every work package: 38 scenarios, 18,079 segments, identical
throughout.

**Measured, not assumed:** the picker renders on `<body>` at the icon's own coordinates —
explicitly asserted *not* to be displaced by the palette's top-left offset, which is the
signature of the `backdrop-filter` trap in §8.3.

> **CORRECTED 2026-09-11.** This paragraph also claimed the row "still fits its 430px
> column exactly (scrollWidth === clientWidth)". **It never fitted.** v0.17.5 item 2
> establishes that a row needs **467px** to fit at all and 480px to sit at its natural size
> — eleven controls and ten gaps — so every row was already squeezed below its own minimum,
> and the 50px colour swatch was rendering as a **14px sliver**. Opening a tall automation
> panel added a vertical scrollbar and turned the squeeze into a horizontal overflow. The
> window is now **520px** (`hex_map.html`, `#route-window`).
>
> **The lesson is in the assertion, not the number.** `scrollWidth === clientWidth` cannot
> detect this: flex children absorb a shortfall by *shrinking*, so the equality holds
> precisely **because** the row was compressed. The check passed for the reason it should
> have failed. Measuring a control against its own specified width — the swatch against its
> 50px — would have caught it; measuring for overflow never could.

### 14.1 A bug found and fixed on the way

Extracting the chain walk (WP1) exposed a live defect in `getRouteSystemList`. Its test for
"is this one chain" was **exactly two degree-1 nodes**, which a chain plus a *separate closed
loop* satisfies — the loop contributes no ends at all. The walk then stopped at the end of
the chain and returned `ordered: true` having silently omitted every world in the loop.

Measured on 2026-09-01: a 3-world chain and a 3-world triangle in one slot reported
`ordered: true` and listed **3 of the 6 worlds**, in the Route Systems panel and the CSV
export alike. `walkRouteChain` additionally requires that the walk cover every node, so such
a route now lists unordered with **every world present** — honest rather than tidy.

Reachable by hand: alt-drag segments into a slot that already holds a route.

---

## 13. Evidence behind this spec

Verified against the code on 2026-09-01, not assumed:

- `getRouteSystemList` (`ui_menus.js:1220`) requires exactly two degree-1 endpoints and
  otherwise returns `{ ordered: false }` with worlds sorted by name — §3.
- It gates travel order on `segments[0].subtype` — §6. The trap is real, not theoretical.
- `_generateIntoSlot` (`ui_menus.js:2328`) clears the slot with
  `filter(r => r.routeId !== routeId)` *before* generating. Continue is precisely "do not do
  that", which is why C8's atomicity comes almost free.
- `getRouteShortfall` (`routes.js:878`) already tests C's **degree**, so a route continued
  past its ring clears the mark with no new work — C5's ring behaviour is inherited, not
  built.
- `refreshRouteWindowCounts` (`ui_menus.js:2951`) reassigns row button state on every
  refresh — §8.2's wiring note.
- The route row markup (`ui_menus.js`, `renderRouteWindow`) carries six controls today, not
  the five previously recorded — §8.2.
