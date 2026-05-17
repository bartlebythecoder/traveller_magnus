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
| **⚙ Auto** | Opens the Automation Panel where you choose a generation method and run it. |
| **× (Delete)** | Deletes the slot and all its segments entirely. Can be undone with **Ctrl+Z**. |

### The Automation Panel

Clicking **⚙ Auto** on any row opens a sub-panel attached to that slot. You pick one of four **automation types** using the radio buttons, configure its parameters, and click **Generate**. Each generation run replaces all existing segments for that slot (use Ctrl+Z to revert).

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

### The Filter Connection

The **Filter** (opened with `f` or via the right-click menu) controls which worlds are currently *visible* on the map. Two route types — Custom Network and Point-to-Point — use the active filter's result set to decide which worlds are eligible as traversal nodes. If the filter matches no worlds, those route types cannot generate.

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

Names are matched case-insensitively. If more than one world starts with the same letters, the autocomplete will list all matches.

#### Waypoints

Click **+ Add Waypoint** to insert a mandatory intermediate stop. The route is then broken into legs and each leg is BFS-routed independently. If any single leg has no valid path, the entire route fails and nothing is drawn.

Remove a waypoint with the × button on its row.

#### Parameters

| Parameter | Effect |
|---|---|
| **Max Jump** | Maximum single-hop distance for all legs. |
| **Allow Empty Hexes** | Permit hops through uninhabited hexes. |
| **Max Empty Jumps** | Max consecutive empty-hex hops before a system is required. |

#### How the Filter Affects P2P

Unlike Custom Network (which connects *all* filtered worlds), Point-to-Point uses the filter's result set as the **pool of worlds BFS may traverse through**. The Start, End, and all Waypoints are always included regardless of filter state. Worlds hidden by the filter cannot be intermediate hops.

This means you can use the filter to restrict a route to a specific allegiance or trade-code corridor.

#### Gotchas

- If the tool returns **"No path found"**, the most common causes are:
  - Max Jump is too low for the gap between worlds.
  - A waypoint hex doesn't contain a populated system.
  - The active filter excludes all valid intermediate worlds.
- Start and End must be different worlds.
- The Systems Panel displays P2P worlds in **order** (numbered 1, 2, 3…) rather than alphabetically.

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

*End of Route Manager Help Manual*
