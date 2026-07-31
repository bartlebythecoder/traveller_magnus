# Frequently Asked Questions

**As Above, So Below** · General Reference

For a deep dive on routes specifically, see the [Route Manager Help Manual](help_routes.md).

---

## Contents

1. [How do I create systems one at a time?](#1-how-do-i-create-systems-one-at-a-time)
2. [How do I create an entire sector at once?](#2-how-do-i-create-an-entire-sector-at-once)
3. [What rulesets are included?](#3-what-rulesets-are-included)
4. [Can I download OTU systems?](#4-can-i-download-otu-systems)
5. [Can I save my work and load it later?](#5-can-i-save-my-work-and-load-it-later)
6. [Can I share my sectors?](#6-can-i-share-my-sectors)
7. [Can I save and share individual systems?](#7-can-i-save-and-share-individual-systems)
8. [How do I edit mainworld information?](#8-how-do-i-edit-mainworld-information)
9. [How do I see system maps and details?](#9-how-do-i-see-system-maps-and-details)
10. [How do I add or remove worlds?](#10-how-do-i-add-or-remove-worlds)
11. [How do I draw routes manually?](#11-how-do-i-draw-routes-manually)
12. [How do I create automated routes?](#12-how-do-i-create-automated-routes)
13. [How do I get world images?](#13-how-do-i-get-world-images)

---

## 1. How do I create systems one at a time?

Select a single hex, then right-click it. Every generation command in the context menu acts on
whatever is currently selected, so with one hex selected you generate exactly one system.

**Select a hex** with **Shift + Click** (or right-click → SELECT → Toggle Select Hex). Selected
hexes are highlighted; **Esc** clears the selection.

Then pick one of three approaches from the right-click menu:

### The one-shot approach

Use **POPULATE AND GENERATE FULL SYSTEM TOP DOWN** or **POPULATE AND GENERATE FULL SYSTEM
BOTTOM UP** and choose your edition. This rolls whether the hex is occupied, generates the
mainworld, and expands the full system in a single command. This is the fastest route from an
empty hex to a finished system.

### The step-by-step approach

Run the stages yourself, which lets you stop and inspect (or hand-edit) between steps:

1. **POPULATE → Manual: Populate System** — forces the hex to contain a system.
   (**Manual: Set Empty** marks it deliberately empty; **Manual: Reset Clear** wipes it back to
   undetermined.)
2. **GENERATE MAINWORLD →** *CT / MgT2E / T5* — rolls the mainworld UWP only.
3. **EXPAND SYSTEM →** *Book 6 (CT) / MgT2E / T5 / RTT* — builds the stars, planets, belts,
   gas giants, and moons around that mainworld.
4. **EXPAND SOCIOECONOMIC →** *MgT2E / T5* — adds trade codes, importance, and economic
   extensions.

If you want the whole system in one command but the hex is already populated, use
**GENERATE FULL SYSTEM TOP DOWN** or **GENERATE FULL SYSTEM BOTTOM UP** instead — these skip
the population roll and generate into the hex as it stands.

### The hand-built approach

With exactly one *empty* hex selected, the context menu shows **CREATE MANUAL SYSTEM**. This
opens the System Editor on a blank system: you choose the generation engine and the primary
star's type, subtype, and luminosity class up front, then add bodies by hand. See
[question 10](#10-how-do-i-add-or-remove-worlds).

> **Top-down vs. bottom-up:** *Top-down* starts from the mainworld UWP and builds a system
> consistent with it. *Bottom-up* builds the star and its planets first, then decides which body
> is the mainworld. Bottom-up tends to produce more physically varied systems; top-down
> guarantees the mainworld you already had is the mainworld you keep.

---

## 2. How do I create an entire sector at once?

The generation commands don't care how many hexes are selected — select the whole sector and run
the same command you'd run on one hex.

1. **Hover over the sector** you want and press **Ctrl + S** to select all of its hexes.
   (**Ctrl + B** selects just the subsector under the cursor. **Shift + Drag** paints an
   arbitrary block of hexes.) Zooming in first makes the hover target easier to hit.
2. **Right-click → POPULATE AND GENERATE FULL SYSTEM TOP DOWN** (or **BOTTOM UP**) and choose
   your edition.

Four bulk macros have keyboard shortcuts that do the same thing without the menu:

| Shortcut | Macro |
|---|---|
| **Ctrl + Alt + M** | Full Mongoose 2E sequence |
| **Ctrl + Alt + C** | Full Classic Traveller (Book 6) sequence |
| **Ctrl + Alt + 5** | Full Traveller 5 sequence |
| **Ctrl + Alt + R** | Full RTT WorldGen (bottom-up) sequence |

Each macro populates, generates, and expands every selected hex in one pass.

### Controlling how dense the sector is

Before generating, you can set the population frequency from **POPULATE**:

- **Auto: Sparse (2 in 6)** — roughly a third of hexes occupied
- **Auto: Standard (3 in 6)** — the traditional 50% density
- **Auto: Dense (4 in 6)** — a crowded sector

Run one of these on the selection first, then use the **GENERATE FULL SYSTEM** commands (rather
than the **POPULATE AND GENERATE** ones) so the density roll you just made is respected.

### Tuning the results

The **Settings** panel (gear icon, top right) → **Generation** section applies to every
generation run: **Generation Seed** (the same seed always produces the same sector), starport /
population / tech level caps and modifiers, **Pop Check Frequency**, and
**Disable Red/Amber Zone Assignments**. Set these *before* you generate.

> A full sector is 32 × 40 = 1,280 hexes. Bulk generation with system expansion takes a
> noticeable moment —
> the more editions' worth of physical detail you generate, the longer it runs and the more
> memory the result occupies.

---

## 3. What rulesets are included?

Five generation engines, each implementing its own edition's rules end to end:

| Engine | Notes |
|---|---|
| **Classic Traveller (CT)** | Book 6 *Scouts* system generation. Top-down and bottom-up. |
| **Mongoose Traveller 2nd Edition (MgT2E)** | Includes the *World Builder's Handbook* physical model. Top-down and bottom-up. |
| **Traveller 5 (T5)** | Full T5 world and system generation, including the Ix / Ex / Cx extensions. Top-down only. |
| **RTT WorldGen (RTT)** | Revised Traveller. Bottom-up only. |
| **Architect of Worlds (AoW)** | Physical star-and-planet modelling, paired with the MgT2E *World Builder's Handbook* for the socioeconomic layer. Bottom-up only. |

A few engine-specific options live in **Settings → Generation**: *Use Realistic Stellar Variant*
and *Use Min TL* (MgT2E), and *Settlement Centuries*, *Tech Level*, and *Show Industry in UWP*
(RTT).

Each system remembers which engine built it, and that choice is fixed for the life of the
system — the System Editor won't let you convert a T5 system into a Mongoose one, for example.
You can freely mix engines *across* hexes in the same sector.

**System Editor support** currently covers **MgT2E**, **CT**, and **T5**. RTT and AoW systems
generate normally and display normally, but cannot be hand-edited yet — their editor support is
preliminary and awaiting an overhaul.

---

## 4. Can I download OTU systems?

Yes. The app pulls live sector data from [travellermap.com](https://travellermap.com). All of
these live in **Settings** (gear icon, top right) → **Import / Export**:

### Import Sector (.tsv)

Load a single TravellerMap-format sector file from your hard drive into a slot of your choosing.
This is also how you replace one sector of an existing map — note the target slot number, run
**POPULATE → Manual: Reset Clear** on it first, then import into that slot.

### Import the Imperium

Fetches the 35 sectors of the Third Imperium (Spinward Marches through Spica) directly from
travellermap.com. A dialog lets you pick exactly which sectors to bring in and which slot each
one lands in, and which data layers you want: **Sector Data**, **Route Data**, **Border Data**,
and **Region Data**.

### Import the Universe

Marked experimental, and it means it. This resizes the canvas to 16×8 sectors (128 positions),
**erases all existing hex data and routes**, and fetches up to 128 sectors. Cached sectors load
instantly; live fetches are deliberately spaced one second apart to be polite to the server, so
a full run takes a couple of minutes. There is an option to substitute the Terry Mixon version
of Foreven. This cannot be undone.

### Import Metadata (.xml)

Loads a TravellerMap metadata XML file — borders, route networks, region definitions — without
touching world data. Useful for layering community route files onto a map you already have.

### What you actually get

An import gives you each world's **UWP, bases, trade codes, travel zone, allegiance, and stellar
data** — the sector-level record. It does *not* include planet-by-planet system detail, because
that isn't published data. To get moons, belts, gas giants, and orbital positions for an imported
world, select it and run one of the **EXPAND SYSTEM** commands; the expansion is generated to be
consistent with the imported UWP.

> **Import the Universe advice:** save the result to JSON immediately (see
> [question 5](#5-can-i-save-my-work-and-load-it-later)) so you never have to re-import. The map
> is at its most sluggish zoomed all the way out and most responsive zoomed in. Expanding
> systems across many sectors is memory-hungry — 8 GB of RAM handles the fully expanded Imperium;
> the fully expanded Universe wants considerably more.

---

## 5. Can I save my work and load it later?

Yes, two ways — one automatic, one deliberate.

### Automatic (browser storage)

Your map is continuously written to your browser's local database as you work, and reloaded
automatically the next time you open the app in that browser. You do not have to do anything.
This is a convenience, not a backup: clearing your browser data, using a different browser, or
switching machines loses it.

### Manual (JSON file)

**Settings → Map Files → Save Map JSON** writes the entire map — every hex, all generated system
detail, routes, borders, regions, filter rules, aesthetics, and settings — to a file on your
hard drive. **Load Map JSON** reads it back.

This is the real backup, and the only thing that survives a browser reset or moves between
machines. Save often, and always save right after a long import or a big generation run.

### Very large maps are saved in parts

Above roughly 250 MB the save is split into numbered part files
(`traveller_map_Part1of3.json`, and so on). **Every part is required to reload the map** — keep
them together, and check that you actually received all of them before you close the tab. If any
part fails to write, the confirmation message names the missing parts explicitly.

To load a multi-part save, click **Load Map JSON** and **select all of the part files at once**
in the file picker.

> **Clear Canvas** (also under Map Files, and **Ctrl + Delete**) wipes everything. There is no
> undo across a canvas clear.

---

## 6. Can I share my sectors?

Yes, in several formats depending on what the recipient needs.

| Format | Where | What it carries | Good for |
|---|---|---|---|
| **Map JSON** | Settings → Map Files → Save Map JSON | Everything — all hexes, full system detail, routes, borders, regions, filters, settings | Sharing with another user of this app. Nothing is lost. |
| **Sector (.tsv)** | Settings → Import / Export → Export Sector (.tsv) | One sector's world records: UWP, bases, trade codes, zones, allegiance, stellar data, and the Ix / Ex / Cx extensions | TravellerMap, and virtually every other Traveller tool. Universal, but system detail below the mainworld is not represented. |
| **Metadata (.xml)** | Settings → Import / Export → Export Metadata (.xml) | Routes, borders, and regions in TravellerMap's metadata format | Publishing your route network or political boundaries for use with TravellerMap. |
| **Obsidian Wiki (ZIP)** | Settings → Import / Export → Export Obsidian Wiki | A fully cross-linked Markdown vault — a page per system, star, world, and moon, plus a subsector index and map | Handing a subsector to players, or to anyone without the app. Readable as plain Markdown. |

The Obsidian export runs **one subsector at a time**: pick the sector, then the subsector within
it. You choose whether to include **world images** (with a projection selector — see
[question 13](#13-how-do-i-get-world-images)), **system orrery images**, and whether to nest
subsector details in subfolders. The subsector map image is always included.

For a complete, lossless handoff, send the Map JSON. For anything that needs to work outside
this app, send the .tsv (plus the .xml if routes matter).

---

## 7. Can I save and share individual systems?

Yes. Select **exactly one** hex and right-click — an **IMPORT / EXPORT SYSTEM** submenu appears.
(It's hidden unless a single hex is selected, since these commands operate on one system.)

- **Export: ASAB System JSON** — writes the selected system to its own file, complete with stars,
  planets, belts, gas giants, moons, and all generated physical and socioeconomic data. Only
  offered when the hex actually contains a system.
- **Import: ASAB System JSON** — reads one of those files into the selected hex. This is how you
  move a favourite system between sectors, keep a library of set-piece systems, or share a single
  world with another user without shipping an entire sector.
- **Import: Traveller World JSON** — imports a system from a
  [Traveller Worlds](https://travellerworlds.com) export file, translated into this app's data
  model.

Importing into a hex that already has a system replaces it.

---

## 8. How do I edit mainworld information?

**Ctrl + Click** any populated hex to open the **World Details** panel.

The top section holds the editable mainworld fields:

- **System Name**
- The UWP components — **Starport**, **Size**, **Atmosphere**, **Hydrographics**, **Population**,
  **Government**, **Law Level**, **Tech Level**
- **Travel Zone** (Green / Amber / Red)
- **Allegiance** and **Region**
- **Naval Base**, **Scout Base**, and the other base flags
- **Referee Notes** — freeform text, saved with the hex

Type your changes and click **Save**. **Cancel** discards them.

Values you type by hand are respected: the app tracks which fields you edited and won't overwrite
them the next time that system is regenerated or re-expanded.

Below the fields, a set of accordion sections shows the read-only generated detail for that
system — physical data, socioeconomics, and the full body-by-body system inventory, one section
per engine that has generated data for the hex.

### Bulk edits

To change a field across many systems at once, select them (**Shift + Drag**, **Ctrl + B**, or
**Ctrl + S**) and use the right-click **ASSIGN** menu: **Assign Allegiance**, **Assign Border**,
**Assign Region**, or **Assign Background Color**.

> Editing the mainworld UWP does not re-expand the system around it. If you change Size or
> Atmosphere significantly and want the physical system rebuilt to match, re-run
> **EXPAND SYSTEM** on that hex.

---

## 9. How do I see system maps and details?

There are two views, at two different levels of detail.

### World Details — the data view

**Ctrl + Click** a populated hex. Below the editable mainworld fields (see
[question 8](#8-how-do-i-edit-mainworld-information)) are collapsible accordion sections
containing everything the engine generated:

- **Physical** — diameter, mass, gravity, density, mean surface temperature, rotation period,
  axial tilt, orbital distance and period
- **Socioeconomics** — trade codes, the Ix / Ex / Cx extensions, nobility, WTN, GWP
- **System** — the complete inventory: every star with its spectral classification, every planet,
  belt, and gas giant with its orbit, and every moon under its parent body

### The System Viewer — the orrery

Zoom in with the scroll wheel. At maximum map zoom, **one more scroll-in over a populated hex**
opens the **System Viewer**: a live, animated orrery of the whole system.

Inside it:

- **Scroll** to zoom the orbits in and out
- **Drag** to pan
- **Hover** any body for a tooltip of its stats
- **Year / Day** fields set the date; **Speed** controls the animation rate; **⏸** pauses it
- **Linear (true scale)** switches from a readable logarithmic orbit layout to true proportional
  distances
- **Orbit Lines**, **Hide Moons**, **Hide HZ**, and **Hide MW** declutter the display
- **Edit System** opens the System Editor on the system you're looking at
  (MgT2E, CT, and T5 only)
- **Scroll out at full view**, press **Esc**, or click **✕** to return to the hex map

The System Viewer's default opening date is configurable in **Settings → Visual Options →
System Viewer**.

Orrery snapshots can also be exported as images as part of the Obsidian Wiki export.

---

## 10. How do I add or remove worlds?

Through the **System Editor**. Select a single populated hex and right-click → **EDIT SYSTEM**,
or click **Edit System** in the System Viewer's header.

> Available for **MgT2E**, **CT**, and **T5** systems. RTT and AoW systems can't be hand-edited
> yet. For an empty hex, the menu offers **CREATE MANUAL SYSTEM** instead, which starts you from
> a blank system with a star you specify.

The editor shows the system as a tree — stars at the top level, their bodies beneath, moons
beneath those. Each row carries its own controls.

### Adding

On a star's row:

| Button | Adds |
|---|---|
| **+World** | A terrestrial world |
| **+GG** | A gas giant |
| **+Belt** | A planetoid belt |
| **+Comp** | A companion star to that star |
| **+Secondary** | A secondary star (Close / Near / Far) |

On a body's row, **+Moon** adds a satellite. A system supports up to eight stars.

### Removing

**✕** on any body or moon row deletes it. **Del★** on a star row deletes that star *and
everything orbiting it* — you're asked to confirm, and a system must always retain at least one
star.

### Editing what's there

Expand any body to set its orbit number, size, atmosphere, hydrographics, and the rest. You can
type **Seed UWP digits** to force particular values while letting the engine roll the others, set
a gas giant's Large/Small class, drag moons to reorder them, and toggle which body is the
**mainworld**. **↻** re-rolls a single body, leaving the rest of the system alone.

### Committing

- **Preview** — runs the engine over your working copy and updates the orrery so you can see the
  result, without committing.
- **Save** — fills in every value you left blank, validates the system, and commits it to the map.
- **Cancel** — discards the working copy. You'll be asked to confirm if you have unsaved changes.

**Ctrl + Z** / **Ctrl + Shift + Z** undo and redo inside the editor.

---

## 11. How do I draw routes manually?

**Hold a route slot's shortcut key and drag from one hex to an adjacent hex.**

Each of the nine route slots has a shortcut key, assigned **1** through **9** by default:

| Slot | Default name | Default colour | Key |
|---|---|---|---|
| 1 | XBoat Route | Green | **1** |
| 2 | Trading Route | Red | **2** |
| 3 | Secondary Route | Yellow | **3** |
| 4–9 | Route 4 … Route 9 | Orange, cyan, pink, purple, blue, lime | **4**–**9** |

So holding **1** and dragging between two neighbouring hexes lays a green X-boat segment;
holding **2** lays a red trade segment, and so on.

**Doing the same thing again over an existing segment deletes it** — the drag toggles.

Notes:

- Segments connect **adjacent hexes only**. A long route is a chain of individual segments.
- **Ctrl + Z** undoes the last segment; **Ctrl + Shift + Z** redoes it.
- Names, colours, and shortcut keys are all editable in the Route Manager (press **R**). The
  letters **f** and **r** are reserved (Filter and Route Manager) and can't be used as shortcuts.
- Deleting a populated hex removes every route segment attached to it, across all slots.

---

## 12. How do I create automated routes?

Press **R** (or right-click → MANAGERS → Route Manager) to open the **Route Window**, then click
**⚙ Auto** on any route slot. Pick a generation method, set its parameters, and click
**Generate**.

Four methods are available:

| Method | What it does |
|---|---|
| **X-Boat Routes** | Builds a communication backbone across the sector using T5 Importance (Ix). Worlds at or above the **Min Ix** threshold become backbone nodes; pathfinding fills in the hops between them. |
| **Custom Network** | Connects every world currently matching the active **Filter** into a network. You define the selection; the tool does the wiring. Requires a filter to be set — press **f** to open the Filter Manager. |
| **Point-to-Point** | Routes from a named **Start** world to a named **End** world through any number of mandatory **Waypoints**. Fields accept a world name or a hex ID and autocomplete as you type; waypoints can be reordered. |
| **BTN Trade Routes** | Generates an economically-grounded trade web from Basic Trade Numbers (GURPS *Far Trader*). Layer major and minor lanes across two slots using different BTN thresholds. |

Shared parameters worth understanding:

- **Max Jump** — the longest single hop, in hexes. Think of it as the drive rating of the ships
  using the route.
- **Max Range** — how far apart two endpoint worlds can be before the tool stops trying to
  connect them. Always keep Range larger than Jump.
- **Allow Empty Hexes** / **Max Empty Jumps** — let paths bridge gaps through uninhabited hexes.

Routes don't run in straight lines: the tool finds the shortest chain of intermediate worlds
where every hop is within Max Jump, which is why you'll sometimes see a detour. Red-zone worlds
are never used as intermediate hops, though they can be a route's endpoint.

Each generation run **replaces** that slot's existing segments — use **Ctrl + Z** to revert, or a
different slot to experiment. Each slot remembers the setup it was last generated with, so
reopening a route to extend it doesn't start from an empty form, and those setups are saved with
the sector.

Click a slot's **segment count pill** to list every world on that route, and export the list to
CSV.

**The full details** — every parameter, how Ix and BTN are calculated, the partial-promotion and
no-share rules, and a troubleshooting section — are in the
[Route Manager Help Manual](help_routes.md).

---

## 13. How do I get world images?

The app renders a plausible surface for any world with a physical surface, derived from its
atmosphere, hydrographics, size, and temperature. The same world always renders the same way.

### Viewing one world

**Ctrl + Click** a hex to open World Details, then click **◎ VIEW WORLD IMAGE** at the top of the
panel. This shows the world as a pair of hemispheres — a globe view.

The button appears only for worlds with a surface to render (size greater than 0). Bodies other
than the mainworld have their own image buttons inside the **System** accordion, so you can view
any planet or moon in the system the same way.

### Flat maps and downloading

From the globe view, click **Open Map** for a full flat map of the world, with four projections
to choose from:

- **Sinusoidal** (the default)
- **Mercator**
- **Mollweide**
- **Diamond**

Switch freely between them — the terrain is identical, only the projection changes. The map is
captioned with the world's name, hex ID, and UWP.

**Download Map** saves the current view as a JPEG named after the world.

### Bulk export

**Settings → Import / Export → Export Obsidian Wiki** generates images for an entire subsector at
once and packages them into the Markdown vault. Tick **Include world images** and a
**World Image Projection** dropdown appears, offering **Globe (Hemispheres)** plus the same four
flat projections. **Include system orrery images** adds a rendered orrery snapshot per system.

### Tuning the look

**Settings → Visual Options → World Image Generation** has two sliders that affect every world
rendered afterwards:

- **Continental Definition** (default 0.55) — how sharply land masses separate from ocean
- **Coastline Complexity** (default 0.45) — how intricate the coastlines are

---

*This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or
Far Future Enterprises.*
