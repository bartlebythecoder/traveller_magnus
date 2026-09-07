# Route Manager — Help Manual

**As Above, So Below** · Route System Reference

---

## Table of Contents

1. [Quick Orientation](#1-quick-orientation)
2. [Core Concepts](#2-core-concepts)
3. [Route Type Reference](#3-route-type-reference)
   - [3.1 X-Boat Routes](#31-x-boat-routes)
   - [3.2 Custom Network](#32-custom-network)
   - [3.3 Point-to-Point](#33-point-to-point)
     - [Continuing a Route](#continuing-a-route)
     - [Combining Two Routes](#combining-two-routes)
   - [3.4 BTN Trade Routes](#34-btn-trade-routes)
4. [Managing Routes](#4-managing-routes)
5. [FAQ](#5-faq)

---

## 1. Quick Orientation

Open the **Route Window** from the right-click context menu (Route Manager) or press the keyboard shortcut `r`. The window lists nine numbered route slots — **#1 through #9** — each of which can hold an independent network of route segments drawn on the map.

### The Route List at a Glance

Each row in the Route Window represents one route slot:

| Column | What it does |
|---|---|
| **#** | Fixed slot number (1–9). Default shortcuts 1–9 are pre-assigned but can be changed. |
| **Segment count pill** | Shows how many map segments this route currently has. A dash (—) means empty. Click the pill to open the **Systems Panel** listing all worlds on this route. |
| **Name field** | Editable label. Changes are saved automatically. |
| **Colour swatch** | Click to pick the colour routes in this slot are drawn in. |
| **Shortcut key** | A single key you can press anywhere on the map to toggle this route's visibility. Letters `f` and `r` are reserved and cannot be used. |
| **Vis checkbox** | Toggles route visibility on the map without deleting segments. |
| **C (Clear)** | Removes all map segments for this slot. Can be undone with **Ctrl+Z**. |
| **CSV** | Exports a spreadsheet of the **worlds** this route passes through, with a choice of fields. A reference table — it cannot be loaded back in. Labelled with a word rather than an icon precisely because it is *not* one of the two route-file buttons beside it. |
| **Save to file** | Writes this route's **connections** to a `.json` route file. See [Saving and Loading a Route](#saving-and-loading-a-route). |
| **Load from file** | Reads a route file into this row. Available even when the slot is empty. |
| **🔗 (Combine)** | Folds another route into this one. Only lit when a route exists that joins this one end to end. See [Combining Two Routes](#combining-two-routes). |
| **⚙ Auto** | Opens the Automation Panel where you choose a generation method and run it. |
| **× (Delete)** | Deletes the slot and all its segments entirely. Can be undone with **Ctrl+Z**. |

### The Automation Panel

Clicking **⚙ Auto** on any row opens a sub-panel attached to that slot. You pick one of four **automation types** using the radio buttons, configure its parameters, and click **Generate**. Each generation run replaces all existing segments for that slot (use Ctrl+Z to revert) — unless you tick **Continue existing route** in the Point-to-Point builder, which adds to the route instead. See [Continuing a Route](#continuing-a-route).

---

## 2. Core Concepts

Before diving into route types, these terms appear everywhere and are worth understanding clearly.

### Jump

**Jump** (`Max Jump`) is the maximum straight-line hex distance a single hop can cover. Every segment the tool draws between two adjacent worlds must be within this distance. Think of it as the drive rating of the ships using the route — a Jump-2 route will never have a segment longer than 2 hexes.

### Range

**Range** (`Max Range`) is the maximum straight-line distance between two *endpoint* worlds the tool will even attempt to connect. Pairs further apart than Range are simply skipped. Raising Range makes the tool search wider; raising Jump makes individual hops longer.

> **Rule of thumb:** Range should always be larger than Jump, or bridging through intermediate worlds never happens.

### BFS Pathfinding — How Routes Find a Path

The tool does not draw straight lines. When two worlds are further apart than one Jump, it uses **breadth-first search (BFS)** to find the shortest chain of intermediate worlds, where each hop is within the Jump limit. You will therefore sometimes see routes that detour through a third world rather than connecting directly. This is correct behaviour — a direct link longer than Jump is not a valid jump route.

### Travel Zones and Red Worlds

Every world has a Travel Zone: Green, Yellow (Amber), or Red. The route engine **never routes through a Red-zone world as an intermediate hop**, because Red zones are considered too dangerous for scheduled traffic. However, a Red-zone world *can* be the explicit start or end point of a route. Yellow worlds are treated the same as Green.

### Route Slots vs. Route Segments

A **route slot** (#1–#9) is a configuration container with a name, colour, and shortcut key. A **route segment** is a single drawn line between two adjacent worlds. One slot can contain hundreds of segments. Clearing a slot removes all its segments but preserves the slot's name and colour settings.

### Allow Empty Hexes

By default, BFS pathfinding only steps through hexes that contain a populated world. Enabling **Allow Empty Hexes** lets the path hop through uninhabited hexes, bridging gaps that would otherwise be impassable. **Max Empty Jumps** controls how many consecutive empty hops are allowed before the path must land on a system again.

This setting governs only what the router does *on its own initiative*. Choosing an empty hex yourself as a Point-to-Point Start, End, or waypoint is a separate thing and needs no setting — see [Deep Space Stops](#deep-space-stops) under Point-to-Point.

### The Filter Connection

The **Filter** (opened with `f` or via the right-click menu) controls which worlds are currently *visible* on the map. Two route types — Custom Network and Point-to-Point — use the active filter's result set to decide which worlds are eligible as traversal nodes. If the filter matches no worlds, those route types cannot generate.

**Suspending the filter while you work (`Shift+F`).** Plotting a route with a filter on means most of the sector is invisible, which makes it hard to see where a route should go. `Shift+F` brings every world back; `Shift+F` again returns to the filtered view. Your filter settings are never touched — there is nothing to retype — and the bypass is forgotten when you close the app.

The bypass is **display only**. Route generation continues to use the real filter, so a Custom Network built while the map is bypassed still connects your filtered worlds and not the whole sector. The Automation Panel says so while a bypass is active, and its match count keeps reporting the true figure. The filter also restores itself as soon as you open the Filter Manager or edit any filter field.

---

## 3. Route Type Reference

---

### 3.1 X-Boat Routes

**What it does:** Automatically generates an interstellar communication network across all populated worlds in the sector, following the Traveller 5 Importance Extension (Ix) rules. High-importance worlds become the backbone nodes; BFS fills in the connecting hops.

**When to use it:** When you want a canonical, rules-based communication spine for your sector without manually placing any routes.

#### Parameters

| Parameter | Default | Effect |
|---|---|---|
| **Max Jump** | 4 | Maximum single-hop distance in hexes. |
| **Max Range** | 12 | Maximum straight-line distance between two important worlds the tool will try to connect via BFS. |
| **Min Ix** | 4 | Minimum T5 Importance score a world must have to become a backbone node. Lower this to include more worlds; raise it to create a sparser, elite network. |

#### How Importance (Ix) Is Calculated

Ix is computed from a world's UWP data:

- **+1** for Starport A or B; **−1** for D, E, or X
- **+1** for TL 10+; **+1** again for TL 16+; **−1** for TL 8 or below
- **+1** each for trade codes Ag, Hi, In, Ri
- **−1** for Population 6 or below
- **+1** if the world has both a Naval Base and a Scout Base

A world with Ix ≥ 4 (the default threshold) becomes a backbone node. Worlds with lower Ix are used only as intermediate hops.

#### Gotchas

- Worlds without any generated mainworld data are skipped entirely.
- A direct link between two important worlds is skipped if a *third* important world lies exactly on the line between them (redundancy pruning). This keeps the network from double-covering segments.
- Red-zone worlds cannot be intermediate hops, but a Red-zone important world will still be connected as an endpoint.

---

### 3.2 Custom Network

**What it does:** Connects all worlds currently shown by the active Filter into a network, using the same direct-link + BFS-bridging algorithm as X-Boat routes. You define the filter; the tool does the wiring.

**Does not clear other route types** — it only replaces segments belonging to this specific slot.

**When to use it:** When you want to highlight trade corridors, allegiance boundaries, cluster routes, or any other user-defined grouping of worlds.

#### Prerequisites

An active filter must be set before generating. If the filter bar is empty, the button is blocked and a message appears. Open the Filter (`f`) and set at least one criterion — the worlds matching that filter become the route's endpoints.

The filter summary inside the Automation Panel shows how many worlds currently match and provides a direct link to open or edit the filter.

#### Parameters

| Parameter | Effect |
|---|---|
| **Max Jump** | Maximum single-hop distance. |
| **Max Range** | Maximum straight-line distance between two filtered worlds the tool will try to connect. |
| **Allow Empty Hexes** | Permit hops through uninhabited hexes. |
| **Max Empty Jumps** | Max consecutive empty-hex hops before a system is required. |

#### Gotchas

- Only worlds **currently passing the filter** are connected. Changing the filter and re-generating will produce a different network.
- Each re-generation of a Custom Network slot replaces that slot's segments entirely. Use Ctrl+Z to revert.
- If no segments could be generated (all filtered worlds are too far apart), a warning toast appears and the map is not changed.

---

### 3.3 Point-to-Point

**What it does:** Finds the shortest BFS path from a named **Start** world to a named **End** world, with optional mandatory **Waypoints** in between. Each leg (Start→Waypoint1, Waypoint1→Waypoint2, …, LastWaypoint→End) is routed independently.

**When to use it:** Charting a specific trade run, a patron's travel itinerary, a military supply line, or any route with a fixed origin and destination.

#### Entering Worlds

The Start, End, and Waypoint fields accept either:
- A **world name** — type the first few letters; a dropdown autocomplete list appears. Use arrow keys to navigate and Enter to select.
- A **hex ID** directly (e.g. `0304`).
- A **click on the map** — see below.
- An **empty hex**, for referees who allow jumps into deep space — see below.

Names are matched case-insensitively. If more than one world starts with the same letters, the autocomplete will list all matches.

#### Deep Space Stops

Any stop — Start, End, or a waypoint — may be an **empty hex** rather than a world, for tables where players are allowed to jump into deep space. Click one on the map, or type its hex ID; the field then reads **Deep Space (1-A-1910)** in amber so an intentional void stop is never confused with a misclick on blank space.

There is no setting to switch on: deliberately choosing an empty hex *is* the opt-in. In particular this does **not** require **Allow Empty Hexes**, which governs something different — whether the router may *pass through* empty hexes of its own accord while finding a path. The two are independent:

| | Allow Empty Hexes off | Allow Empty Hexes on |
|---|---|---|
| **All stops are worlds** | Route hops world to world (the default) | Route may also slip through empty hexes en route |
| **A stop is deep space** | That stop is reached directly; every hop between stops is still world-to-world | Both apply |

A deep-space stop still has to be *reachable* — the hop to it obeys Max Jump like any other. If it is out of range from every neighbouring stop, the route fails as it always would.

Empty hexes have no name, so the name autocomplete cannot suggest them; they are reached by clicking the map or typing the hex ID. In the route's system list and its CSV export they appear as **Deep Space**, with the physical columns blank.

**Not modelled:** whether such a jump is legal at your table, and what it costs in fuel or risk, is a referee's ruling. The tool draws the route you ask for and takes no position on it.

#### Picking Worlds from the Map

Every world field has a **◎** button beside it. Click it and the field arms: the map cursor becomes a crosshair, a banner appears in the panel, and the next system you click on the map fills that field. The Route Manager stays open throughout — you can still pan and zoom to reach the hex you want, because only a click that doesn't drag counts as a pick.

- Picking **Start** while End is still empty arms End next, so a simple two-stop route is two clicks.
- Clicking an **empty hex** is refused with a message and the pick stays armed — every stop must be a populated world.
- **Esc**, or the **Cancel** button in the banner, ends the pick without closing the Route Manager.

#### Building a Whole Route on the Map

**◎ Build Route on Map** turns the panel into a running route-tracer. Your first click sets Start and the second sets End; from then on, **each further click becomes the new End and the previous End drops into the waypoint list**. Clicking your way A → B → C → D therefore leaves Start = A, End = D, and waypoints B and C in travel order — you trace the route across the map in the order you'd fly it.

Clicking the same system twice in a row is ignored, so a double-click cannot insert a stop twice. Finish with **Done** or **Esc**; the fields are left populated for editing, and nothing is drawn until you press Generate.

Because the mode rewrites End on every click, it starts from an empty route: if Start, End, or any waypoint is already filled, you are asked first whether to clear them.

#### Waypoints

Click **+ Add Waypoint** to insert a mandatory intermediate stop. The route is then broken into legs and each leg is BFS-routed independently. If any single leg has no valid path, the entire route fails and nothing is drawn.

Remove a waypoint with the × button on its row.

#### Parameters

| Parameter | Effect |
|---|---|
| **Max Jump** | Maximum single-hop distance for all legs. |
| **Allow Empty Hexes** | Permit hops *through* uninhabited hexes while pathfinding. Independent of choosing an empty hex as a stop, which needs no setting. |
| **Max Empty Jumps** | Max consecutive empty-hex hops before a system is required. A deep-space *stop* does not count against this — it is a destination, not a hop of convenience — and neither does starting in one. |
| **Build as far as possible** | When a leg cannot be routed, keep the route up to the closest world it *could* reach instead of failing. Off by default. See below. |
| **Continue existing route** | Add to the route already in this slot rather than replacing it. Off every time the panel opens. See [Continuing a Route](#continuing-a-route). |

#### Build As Far As Possible

Normally a Point-to-Point route is all or nothing: if any leg cannot be routed, nothing is
drawn and nothing on the map changes. That is the right behaviour for a short route you can
simply rebuild with different settings.

It is the wrong behaviour for a long route across many sectors, where a single unroutable
leg throws away nineteen good ones and leaves you to work out *why* with no evidence.

Ticking **Build as far as possible** changes only what happens when the search comes up
short. The route is drawn as far as it actually got — up to the closest world it could reach
to the stop it was aiming for — and that world is marked:

- **On the map**, with a dashed ring in the route's own colour.
- **In the Route Systems panel**, with a notice naming the stop that could not be reached
  and how many hexes away it is, and a **STOPS HERE** tag on the world the route ends at.
- **In the panel footer**, which reads `… · incomplete`.

To carry the route on, add a waypoint near where it stopped and generate again.

**The mark looks after itself.** It is not a flag you have to clear — it is simply a
statement that the route ends there, and it disappears as soon as that stops being true.
So it goes away when you regenerate the route, when you extend it past that point by hand
(hold the route's shortcut key and drag), when you connect it through to the stop it
missed, or when you delete the segments. Extending the *other* end of the route leaves it
in place, because the route still stops where it says it does.

**What it does not do.** This is not a "force" option. Nothing about how paths are found
changes:

- **Max Jump is never exceeded.** It is a claim about what your ships can do, and a route
  nobody can fly is worse than no route.
- **The filter is obeyed exactly as before.** The route will not detour through worlds you
  have filtered out.
- **Allow Empty Hexes still means what it says.** If it is off, the route will not enter
  empty hexes to get further, and the world it stops at is always a real world — never a
  point in deep space.

Because all three still hold, **a route may still stop well short of where you wanted it**.
A rift wider than your Max Jump with nothing in it cannot be crossed by any of this. What
you get is the part of the route that works, plus the exact location and size of the
problem.

**On multi-leg routes it stops at the first leg it cannot complete** rather than skipping
ahead to later legs. That keeps the route a single unbroken chain, so the Systems panel can
still list it in travel order.

#### Continuing a Route

A long route is rarely built in one go. **Continue existing route** lets you add to a route
that already exists instead of entering all of its stops again and rebuilding it.

Tick the box and the form changes to describe the *new* piece rather than the whole route:

- **Start** is filled in with the world at the end of the route.
- **End** is left blank, for wherever you want to go next.
- **Waypoints** are cleared, ready for stops belonging to the new piece.

Untick it and the whole setup comes straight back, so there is no cost to looking.

Enter an End, optionally some waypoints, and generate. **The rest of the route is not
touched** — not re-searched, not redrawn — so anything you have adjusted by hand stays as
you left it, and a nineteen-leg route is not rebuilt to add a twentieth.

**The Start must be one of the route's two ends**, and either will do: a route can be
extended backwards from where it begins just as easily as onwards from where it finishes.
Type a world from the middle and the generation is refused, with a message naming the two
ends you can actually continue from. This is not fussiness — a route that forks has more
than two ends, and the Systems panel can only list a route in travel order while it runs
from one end to another.

**The route's saved setup grows with it**, so reopening the builder afterwards still shows
every stop in travel order, and an ordinary Generate later rebuilds the whole route rather
than just the last piece. (A route that was imported, loaded from a file, or drawn by hand
has no saved setup to grow — it can still be continued as often as you like, but the
builder cannot reconstruct stops it never knew about, so it does not pretend to.)

**The box is always off when the panel opens.** Generate therefore always means "replace"
unless you have said otherwise for this press, and can never quietly add to a route when
you meant to rebuild one.

It works on **any** route that runs from one world to another, including imported ones.
Where there is nothing to continue — an empty slot, or a route that branches or forms a
loop — the box is greyed out and its tooltip says which.

If the new leg finds no path, the route is left exactly as it was. If the new leg happens
to route back through the route's own worlds, it is still drawn — the connections are real
— but you are told that the route now branches and will be listed alphabetically rather
than in travel order.

#### Combining Two Routes

Where **Continue** adds a new leg, **Combine** joins a route you already have. Click the
**🔗** button on the row of the route you want to *keep*, and pick from the list of routes
that join it.

- The route you clicked keeps its **name, colour and shortcut key**.
- The other route's connections move across and take on that colour.
- The other route's now-empty slot is **removed**, freeing its shortcut key.

**Only combinations that give a single unbroken route are offered.** Two routes meeting in
the *middle* of one of them are not, because the result forks; nor are two that never touch.
The test is made on **what the combined route would actually look like**, so a pair that
meets at one end but doubles back over itself elsewhere is excluded as well — and a route
that exists in two separate pieces *is* offered, when the route you are combining it into
bridges the gap between them.

The button is only lit when something is available, so which routes can be joined is visible
without clicking anything. You are asked to confirm first — told where the two meet and how
many connections will move — and **Ctrl+Z** undoes the whole thing, bringing the absorbed
route's slot back with its name and shortcut key intact.

**Even with the box off**, a failed route now tells you the closest world it could reach and
how far short that leaves it — which is usually the world you want to add as a waypoint.

#### How the Filter Affects P2P

Unlike Custom Network (which connects *all* filtered worlds), Point-to-Point uses the filter's result set as the **pool of worlds BFS may traverse through**. The Start, End, and all Waypoints are always included regardless of filter state. Worlds hidden by the filter cannot be intermediate hops.

This means you can use the filter to restrict a route to a specific allegiance or trade-code corridor.

#### Gotchas

- If the tool returns **"No path found"**, the most common causes are:
  - Max Jump is too low for the gap between worlds.
  - The active filter excludes all valid intermediate worlds.
  - A stop lies outside the sector grid entirely (an empty hex inside it is fine).
  - The message names the closest world the search *could* reach and how many hexes short
    that leaves it. That world is usually the one to add as a waypoint.
- Start and End must be different stops.
- The Systems Panel displays P2P worlds in **order** (numbered 1, 2, 3…) rather than alphabetically.
- A route built with **Build as far as possible** keeps its mark only for as long as the
  route really does stop there. Regenerate it, extend it past that point by hand, connect it
  through to the missed stop, or delete the segments, and the mark clears itself.

---

### 3.4 BTN Trade Routes

**What it does:** Generates a trade network based on the **Basic Trade Number (BTN)** system, derived from GURPS Traveller Far Trader. It evaluates every pair of worlds within the search range, scores them for trade potential, and draws routes for pairs that clear the configured thresholds.

**When to use it:** When you want an economically-grounded trade web rather than a communication backbone. Different BTN thresholds in different slots let you layer major and minor trade lanes.

#### Key Terms

**WTN (World Trade Number):** A per-world score derived from its population, starport, and tech level. Higher WTN = more trade potential. Worlds without a generated WTN are skipped entirely.

**BTN (Basic Trade Number):** The combined trade score for a *pair* of worlds:  
`BTN = WTN(A) + WTN(B) − distance penalty + trade code bonus`  
A higher BTN means more likely trade.

The **distance penalty** increases with hex distance (small penalty for adjacent worlds, large penalty for distant ones). The **trade code bonus** adds +1 for Ag↔Na pairs and +1 for In↔Ni pairs.

BTN is also capped at `min(WTN_A, WTN_B) + 10` to prevent a very high-WTN world from inflating a pair beyond reason.

#### Parameters

| Parameter | Effect |
|---|---|
| **Lower BTN** | Floor for *partial* route consideration. Pairs below this are ignored entirely. Must be ≤ Min BTN. |
| **Min BTN** | Pairs at or above this score receive a **full route** — segments are drawn regardless of what other routes exist. |
| **Max BTN** | Optional ceiling. Pairs above this are excluded (useful for separating major from minor trade lanes across two slots). Leave blank for no upper cap. |
| **Max Jump** | Maximum single-hop distance for BFS. |
| **Range** | Maximum straight-line distance between a pair before it is skipped. |

#### Full Routes vs. Partial Promotion

This is the most important concept to understand:

- **Full route:** The pair's BTN ≥ Min BTN. Every BFS hop between them is drawn immediately.
- **Partial route:** The pair's BTN is between Lower BTN and Min BTN — not strong enough for a guaranteed route, but not ignored either. The hops are *recorded* as candidates.
- **Promotion:** After all pairs are evaluated, any BFS hop segment that was used by **two or more different partial pairs** is promoted and drawn on the map. The idea: a segment shared by multiple marginal trade routes is busy enough to justify marking.

Setting Lower BTN = Min BTN disables partial promotion entirely — only confirmed trade routes are drawn.

#### The No-Share Rule

When two different BTN route slots cover the same segment, only the slot with the **lower Max BTN** keeps it. If one slot has no Max BTN (unlimited), it wins only if the rival also has no cap; otherwise the capped slot wins. This prevents two overlapping BTN layers from double-drawing the same segment.

#### Gotchas

- Worlds without a computed WTN (no socioeconomic data generated) are **skipped** — the toast after generation reports how many were excluded.
- Lower BTN must be ≤ Min BTN or the generator will reject the configuration.
- Red-zone worlds cannot be BFS intermediaries but can be endpoints if their BTN is high enough.

---

## 4. Managing Routes

### Renaming and Recolouring

Click directly into the **name field** on any route row and type a new name — changes save on blur. Click the **colour swatch** to open a colour picker; the map redraws immediately.

### Shortcut Keys

Each slot can have a single-character shortcut key. Press that key anywhere on the map to toggle the route's visibility. Two keys are reserved by the application and cannot be assigned:

- `f` — opens/closes the Filter
- `r` — opens/closes the Route Window

### Visibility vs. Clear

| Action | Effect |
|---|---|
| **Vis checkbox off** | Hides the route visually. Segments are preserved in memory and will reappear when toggled back on. |
| **C (Clear)** | Permanently removes all segments from the slot. **Ctrl+Z restores them.** The slot's name, colour, and shortcut key are unaffected. |

### The Systems Panel

Click the **segment count pill** on any route row (when it shows a number, not a dash) to open the Systems Panel. This panel lists every world that is a node on that route:

- **Point-to-Point routes** show worlds in path order, numbered 1, 2, 3…
- **All other routes** show worlds sorted alphabetically by name.

The footer shows the total segment count and world count. Click the × button or the pill again to close.

### Saving and Loading a Route

Two buttons on each route row move a single route in and out of a file — useful for keeping a route you may want back later, rebuilding one on a second map, or handing a trade network to another referee.

- **Save** writes that slot's connections to a `.json` file named after the route, e.g. `route_Spinward_Main.json`. Greyed out when the slot has nothing in it.
- **Load** reads a route file into the row you clicked. Always available, including on an empty slot — that is the normal case.

**The file carries connections and nothing else.** No name, no colour, no shortcut key. A loaded route takes on the identity of whichever slot you put it in, which is why there is never anything to reconcile and nothing of yours is overwritten. If you want the route drawn in magenta and called "Spinward Main", set that slot up first and then load into it.

| Situation | What happens |
|---|---|
| Loading into an empty slot | Happens straight away |
| Loading into a slot that already has segments | Asks first, then replaces them. **Ctrl+Z restores what was there.** |
| Loading the same file twice | Leaves one route, not two copies stacked on each other |
| A route crossing several sectors | Saved and loaded whole, however many sectors it spans |

**A route file only works on a map with the same sector grid it was saved from.** A file saved from a 7×5 map will not load into an 8×6 one; it is refused with an explanation rather than being drawn in the wrong place. The same applies to a file that is damaged, was written by a newer version of the application, or refers to a hex your map does not have. In all of these cases nothing is loaded and the map is untouched.

**This is not the ⬇ button beside it.** That exports a spreadsheet of the *worlds* a route passes through — names, UWPs, trade codes and so on — for reading and printing. It records nothing about which hex joins which, so it cannot be loaded back in. The two exist side by side because they answer different questions: ⬇ is *what is on this route*, Save is *what this route is*.

### Clearing on Hex Delete

If you delete a populated hex from the map (right-click → Clear Hex), all route segments connected to that hex are automatically removed from every route slot.

---

## 5. FAQ

**Q: Why won't my Custom Network generate?**  
The Custom Network type requires an active filter. If the filter bar has no criteria set, the generator is blocked. Open the Filter (`f`), enter at least one criterion (e.g. Starport: A), and try again. The filter summary inside the Automation Panel shows how many worlds currently match.

---

**Q: My Custom Network generated but it says "0 segments." What happened?**  
Either the filter matched only one world (you need at least two to draw a segment), or all matching worlds are further apart than your Max Range setting. Try raising Max Range or lowering Max Jump.

---

**Q: My P2P route returned "No path found." How do I fix it?**  
Work through these in order:
1. **Increase Max Jump** — the gap between two worlds may exceed your current hop limit.
2. **Check your waypoints** — each waypoint must be a populated system. An empty hex ID will cause a failure on that leg.
3. **Check the filter** — P2P uses the filter as a traversal whitelist. If the filter is very narrow, intermediate worlds may have been excluded. Loosen the filter or clear it.
4. **Enable Allow Empty Hexes** — if the path must cross a gap with no populated systems, this option allows hops through uninhabited hexes.

---

**Q: Why does a route detour through a world instead of going direct?**  
Two reasons are possible, separately or together:
- The direct distance exceeds Max Jump, so the tool must find a multi-hop path.
- The intermediate world it "avoided" is a Red zone, which is barred from being a relay point.

---

**Q: What's the difference between Lower BTN and Min BTN in BTN Trade Routes?**  
`Min BTN` is the threshold for a guaranteed route — pairs at or above it are always drawn. `Lower BTN` is a softer floor: pairs between Lower and Min are considered *partial* candidates. A partial pair's segments are only drawn if that segment is also used by at least one *other* partial pair (the "promotion" rule). Setting both values equal disables promotion entirely.

---

**Q: Can I run two different trade networks at the same time?**  
Yes. Use different route slots. For example, put a high-BTN "major lanes" network in Slot #2 and a lower-BTN "minor lanes" network in Slot #3, with different colours. The no-share rule between BTN slots prevents double-drawing on segments both would claim.

---

**Q: Re-generating a route overwrites my existing one. Can I stop that?**  
This is intentional — each Automation run replaces segments for that slot. If you want to preserve a network while experimenting, either use a different numbered slot for the experiment, or use **Ctrl+Z** after generating to revert to the previous state.

---

**Q: What does "Allow Empty Hexes" actually do?**  
Normally BFS pathfinding can only step through hexes that contain a populated world. When Allow Empty Hexes is on, the path may also step through uninhabited (EMPTY) hexes as relay points. **Max Empty Jumps** limits how many consecutive empty hops are permitted before the path must reach a system again — this prevents routes from wandering indefinitely through empty space.

---

**Q: Why is the Ix of a world important for X-Boat routes?**  
Ix (Importance Extension) is the T5 scoring system for how significant a world is to interstellar commerce and communication. The X-Boat algorithm uses Ix to identify **backbone nodes** — the worlds the route must connect. Only worlds meeting the Min Ix threshold become backbone nodes; all other worlds are available as intermediate hops but not as required stops.

---

**Q: Why can't I use 'f' or 'r' as shortcut keys?**  
These keys are reserved for the Filter window (`f`) and the Route Window (`r`). If you try to assign them, the field rejects the input and reverts to the previous value.

---

**Q: Some worlds on my BTN route generation were "skipped." Why?**  
BTN generation requires each world to have a pre-computed WTN (World Trade Number), which comes from socioeconomic data. Worlds that only have a basic mainworld UWP but have not had socioeconomics generated will be skipped. The generation toast reports how many were included and how many were skipped.

---

**Q: Can I send a route to another referee?**
Yes. Press **Save** on its row and send them the `.json` file. They load it into any slot in their own Route Manager and it takes on that slot's name and colour — so the route arrives looking however they have that slot set up, not however you had yours. Their map must use the same sector grid as yours, and should have worlds in the hexes the route runs through; the route will draw regardless, but a route through empty space is rarely what was intended.

---

**Q: I loaded a route file and the route is the wrong colour.**
That is intentional. A route file carries no colour — it takes the colour of the slot you loaded it into. Change the slot's colour swatch and the route follows immediately.

---

*End of Route Manager Help Manual*
