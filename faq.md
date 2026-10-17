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
14. [How do I get regional surface maps?](#14-how-do-i-get-regional-surface-maps)
15. [How do I draw borders and regions?](#15-how-do-i-draw-borders-and-regions)
16. [How do I filter and colour the map?](#16-how-do-i-filter-and-colour-the-map)
17. [How do I make a players' version?](#17-how-do-i-make-a-players-version)
18. [How do I change how the map looks?](#18-how-do-i-change-how-the-map-looks)

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
3. **EXPAND SYSTEM →** *Book 6 (CT) / MgT2E / T5* — builds the stars, planets, belts, gas
   giants, and moons around that mainworld. (The fourth entry, **RTT (Re-run Biographer Only)**,
   is different: on a system RTT has already built, it re-rolls each body's physical biography
   and social stats while leaving the stars and orbits alone. RTT systems themselves come from
   the **BOTTOM UP** commands.)
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

> **Want to see a finished sector first?** **Settings → Presets → Load Sector Solo 6** loads a
> complete sample sector. It replaces whatever is on the canvas (you're asked to confirm first),
> so save your own map before you try it.

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
and **Region Data**. Only the slots you import into are replaced; the rest of your map is left
alone.

### Import the Universe

Marked experimental, and it means it. This resizes the canvas to 16×8 sectors (128 positions),
**erases all existing hex data and routes**, and fetches up to 128 sectors with all four data
layers. Live fetches are deliberately spaced one second apart to be polite to the server, and
each sector takes two (world data, then metadata), so a first run takes around five minutes.
Downloaded sectors are cached for 24 hours, so a repeat import within that window is much
faster. There is an option to substitute the Terry Mixon version of Foreven. This cannot be
undone.

### Import a Neighbourhood

Pick any one sector and get a 3×3 map: that sector in the middle (slot 5) and its eight
neighbours around it. For example, Spinward Marches brings in Foreven, Deneb, Trojan Reach and
the rest of its ring. The dialog shows a 3×3 preview of the sector names before anything is
downloaded, and has the same **Sector / Route / Border / Region Data** choices as Import the
Imperium, plus the Terry Mixon Foreven option.

Like Import the Universe, this resizes the canvas (to 3×3) and **erases all existing hex data and
routes**, and it cannot be undone. Xboat routes and borders that cross between the nine sectors
join up; routes that lead out of the 3×3 block are dropped. If you pick a sector on the outer edge
of the 16×8 block that Import the Universe covers, neighbours that don't exist show as *(none)* in the preview and those slots are
left blank. A first run takes about 20 seconds; within 24 hours a repeat is near-instant.

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
| **Wiki (ZIP)** | Settings → Import / Export → Export Wiki | Either an **Obsidian** vault (one cross-linked Markdown file per star, world, and moon) or an **HTML website** (one page per system), plus a subsector index and map | Handing a subsector to players, or to anyone without the app. Obsidian reads as plain Markdown; the HTML version opens in any browser. |

**Export Wiki** runs **one subsector at a time**. The dialog asks for:

- **Format**: *Obsidian Wiki (Markdown)* or *HTML Website*. For HTML, extract every subsector of
  a sector into the same folder so the links between them work.
- **Version**: *Referee* (everything) or *Players* (fog of war; see
  [question 17](#17-how-do-i-make-a-players-version))
- **Sector** and **Subsector**
- **Include world images**, with a **World Image Projection** choice (see
  [question 13](#13-how-do-i-get-world-images)) and **Skip airless worlds** (atmosphere 0,
  hydrographics 0), which is on by default
- **System Images**: the *System sheet* (default; see
  [question 9](#9-how-do-i-see-system-maps-and-details)), the *Orrery*, *both*, or *None*
- **Subsector details in subfolders** (Obsidian only; HTML always uses subfolders)

The subsector map image is always included.

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
- **Naval Base**, **Scout Base**, and the other base and facility flags, plus **Gas Giant**
- **Trade Codes**, space-separated
- **Referee Notes** — freeform text, saved with the hex. Drag the bottom-right corner of the box to make it taller if you write at length; the size you choose is remembered between sessions. Notes appear in the referee wiki export and are never shown to players

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

### The System Sheet

Click **System Sheet** in the System Viewer's header for a one-page reference sheet for the
system. A strip of rendered bodies runs across the top, data panels surround it, and a table of
planets sits below. **Download PNG** saves it.

Each star with bodies of its own gets its own sheet. When there's more than one, buttons above
the sheet switch between them (**Home** is the primary star). You can also click a companion on
the strip; it's marked with how many bodies it has.

The System Sheet is also the default system image in **Export Wiki** (see
[question 6](#6-can-i-share-my-sectors)), which can include the orrery instead or as well.

### Recording the orrery as an animated GIF

Click **GIF** in the System Viewer's header. The GIF records exactly what you're looking at: the
current zoom and pan, speed, and display options (moons, HZ, log or linear scale). So set the
view up first, then open the dialog. The dialog sums up those settings at the top as a reminder.

- **Length** — a number of seconds (default 6, up to 60), or click **One orbit of *mainworld*** to
  make the GIF exactly one orbit long so it loops seamlessly. For a moon mainworld, the loop
  follows its parent planet around the star.
- **Frame rate** — 10, 15, 20 or 25 fps (default 15)
- **Size** — 480 up to 1280 pixels wide, limited to what fits your current window

Below the options, a line shows the frame count, length, size and how many days each frame
covers. The dialog warns you if you chose **One orbit** but that orbit takes longer than 60 seconds at
your current speed (the GIF is cut off and won't loop cleanly; raise the speed), or if moons are
shown and each frame jumps more than a day (fast moons will appear to hop; hide moons or slow
down).

**Record** shows a progress bar and then downloads the file as
*SystemName_hex_orrery.gif*. **Cancel** stops a recording in progress. The same settings always
produce the same GIF. GIFs are made in the app only; the wiki and HTML exports still use still
images.

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
| **+Comp** | A companion star to that star (not offered for CT systems, where companions only come from the generation roll) |
| **+Secondary** | A secondary star (Close / Near / Far) |

On a body's row, **+Moon** adds a satellite.

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
  letters **f**, **r**, **b**, **g** and **d** open windows (Filter, Route, Border, Region and
  Player Disclosure), so they can't be used as route shortcuts.
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
| **Custom Network** | Connects every world currently matching the active **Filter** into a network. You define the selection; the tool does the wiring. Requires a filter to be set — press **f** to open the Filter Manager, or **Shift+F** to suspend an active filter on screen without disturbing it. |
| **Point-to-Point** | Routes from a named **Start** world to a named **End** world through any number of mandatory **Waypoints**. Press **Shift+F** at any time to suspend the filter and see the whole map while you plot, then again to restore it — route generation keeps using the real filter either way. Fields accept a world name or a hex ID and autocomplete as you type; waypoints can be reordered. Stops can also be clicked directly on the map — a **◎** button beside any field arms it for the next map click, and **Build Route on Map** traces a whole route click by click, each new stop becoming the End and pushing the previous one into the waypoint list. Any stop may be an **empty hex** for referees who allow jumps into deep space; no setting is needed, and such stops show as "Deep Space" in amber. |
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

**Settings → Import / Export → Export Wiki** generates images for an entire subsector at once and
packages them into the Obsidian vault or HTML website. Tick **Include world images** and a
**World Image Projection** dropdown appears, offering **Globe (Hemispheres)** plus the same four
flat projections. **Skip airless worlds** (on by default) leaves out worlds with atmosphere 0 and
hydrographics 0. Separately, **System Images** adds a System Sheet, an orrery, or both for each
system.

### Tuning the look

**Settings → Visual Options → World Image Generation** affects every world rendered afterwards:

- **Use Classic World Images** — off by default, which is **Tectonic**; tick it for **Classic**.
  See [Classic vs Tectonic](#classic-vs-tectonic) below.
- **Continental Definition** (default 0.55) — how sharply land masses separate from ocean
- **Coastline Complexity** (default 0.45) — how intricate the coastlines are

### Going closer

For a zoomed-in view of a patch of the surface rather than the whole globe, see
[regional surface maps](#14-how-do-i-get-regional-surface-maps).

---

## 14. How do I get regional surface maps?

A regional map zooms in on one patch of a world's surface and draws it as a survey sheet — shaded
relief inside a graticule, with a scale bar, compass rose, terrain key, a globe locator inset and a
survey ID in the footer. The window is fixed at roughly 120–220 km across depending on the size of
the world, so a sheet is always at the same regional scale.

Like the world image, the terrain is derived from the world's UWP and the map seed, so the same
world always produces the same landscape.

### Opening one

**Ctrl + Click** a hex to open World Details → **◎ VIEW WORLD IMAGE** → **Open Map** → **Regional
Maps →**, at the right-hand end of the projection row.

This works from any body's world image, not only the mainworld — open a moon or an outer planet from
the **System** accordion and its flat map carries the same button.

### Moving around

- **Drag the sheet** to pan. The terrain is anchored to the world, so the ground under the cursor is
  the same ground wherever you drag it — panning reframes the view, it does not generate a new
  landscape.
- **Click the small world map** under **LOCATION** to open the full-world locator. This is a large
  map of the whole planet showing a 30° graticule, your five site slots, and the current survey
  window as a red reticle. Latitude and longitude are read out at the bottom right as you move the
  cursor. Click to place the survey window there and close the locator; **Esc** or **Cancel** backs
  out without moving anything.

The small map is a preview, not a picker. At 200 pixels for 360° of longitude, one of its pixels is
roughly the width of the entire survey window — which is why clicking it opens the large map rather
than jumping straight to a location.

There is no zoom, deliberately. Landform size and steepness are properties of the planet rather than
of the framing, so magnifying the window changed almost nothing you could see.

### Sites and pins

**SITES** lists five slots. An unpinned slot holds an automatically chosen location — the five most
dramatic stretches of dry land on the world, kept at least 25° apart, as a starting shortlist of
places worth surveying.

- **Go** jumps the sheet to that slot.
- **Pin** overwrites the slot with wherever the sheet is now, and names it.
- **×** clears a pin and hands the slot back to its automatic location.

Five pins per body is the limit. **Pins are saved inside the map**, so they travel with a saved
`.json` file, ride the automatic browser save, and survive moving to another machine.

### What the controls do

| Control | Effect |
|---|---|
| **Resolution** | Fast / Balanced / Detailed. Sharpness and render time only — the terrain is the same. |
| **Sun angle °** | Height of the sun, 5 to 85. A low sun throws long shadows and exaggerates relief. |
| **Rivers & lakes** | Traces a drainage network, cuts channels into the terrain, and fills the basins that hold standing water. One box governs both — switching it off takes the lakes away with the rivers. |
| **Feature labels** | Names the landforms on the sheet. |
| **Cartographic frame** | The survey-sheet furniture. Untick it for the bare terrain plate. |

### Why is Rivers & lakes greyed out?

Because it could not do anything, and the box says which reason applies:

- **"Not available on Classic world images"** — the hydrology pass only runs on Tectonic terrain,
  so untick **Use Classic World Images**.
- **"This world has no surface water"** — hydrographics 0. There is nothing to drain.

### Where are the cities, roads and starports?

Deliberately absent. A regional map shows landscape and physical features only, and names only
natural ones. Anything built is a job for a finer, site-scale tier that does not exist yet.

### Classic vs Tectonic

**Settings → Visual Options → World Image Generation → Use Classic World Images** picks how
terrain is generated, and applies to world images and regional maps alike:

- **Classic** — the original terrain. Every world looks exactly as it always has.
- **Tectonic** — a plate model, producing linear mountain ranges, trenches and rift valleys. It also
  brings green vegetation to warm, wet, breathable worlds and a distinct cold-desert palette to
  frozen dry ones, and it is the only model on which rivers and lakes can be drawn.

World images are never stored — they are recomputed from the seed every time you look at one — so
changing the model changes every world in the sector. That is exactly why the setting exists:
**Classic is frozen**, so a sector built before this feature arrived looks identical until you
choose otherwise — such a file reopens with the box already ticked, whatever your default. The
choice is saved with the sector rather than with the browser, so a file always reopens under the
model it was saved with, and a new sector starts on Tectonic.

### Do regional maps appear in exports?

Yes, for **pinned sites only**; an unpinned slot exports nothing. **Export Wiki**, in both its
Obsidian and HTML formats, adds a **Regional Surveys** section to any world that has pins, with
one full sheet per pin.

Sheets follow the **Include world images** toggle, and obey fog of war on exactly the same terms: a
sheet is the world image at a finer scale, so a world hidden from the reader does not get one.

### Saving a single sheet

**Download PNG** saves the sheet as displayed, named after the world and its coordinates.

### One of my sites has turned amber

That pin was made under a different map seed. A pin stores a latitude and longitude, not a picture,
and the surface is rebuilt from the seed every time you view it — so under a new seed the
coordinates are still valid but the ground beneath them is not the ground you pinned. The pin is
flagged rather than hidden; hover it for the details, then re-pin or clear it.

### Is any of this from a rulebook?

No. No Traveller edition publishes tables for surface topography, so the terrain is invented rather
than rolled. What constrains it is the world's own UWP — size, atmosphere, hydrographics and
temperature all steer the result, and the sheet's data block quotes them.

---

## 15. How do I draw borders and regions?

There are two kinds of map overlay, and both work the same way: select hexes, then assign them.

- **Borders** are political boundaries, drawn as a coloured outline around the hexes in them.
- **Regions** are named areas (clusters, reaches, provinces) shaded in behind the hexes.

### Assigning hexes

Select the hexes (**Shift + Drag**, **Ctrl + B** for a subsector, **Ctrl + S** for a sector),
then right-click → **ASSIGN**:

- **Assign Border**: pick a border slot, or **Clear Border** to take the hexes out of whatever
  border they're in. There's always one unused slot at the end of the list; assign to it to start
  a new border.
- **Assign Region**: works the same way for regions. A single world's region can also be set from
  the **Region** dropdown in World Details.
- **Assign Allegiance** sets the allegiance code (for example *ImDd*) on every selected system.
- **Assign Background Color** tints the selected hexes. It obeys the **Hex Background Fill**
  toggle in the Filter Manager.

Every assignment can be undone with **Ctrl + Z**.

### The Border and Region Managers

**B** opens the **Border Manager** and **G** the **Region Manager** (also under right-click →
**MANAGERS**). Each row is one slot, showing how many hexes it covers. You can:

- type a new **name**
- pick a **colour**
- use the **eye** to show or hide it (**Show All** toggles every slot at once)
- use **C** to remove every hex from it while keeping the slot
- use **×** to delete it (you're asked to confirm, and Ctrl + Z brings it back)

OTU imports bring in travellermap's borders and regions automatically (see
[question 4](#4-can-i-download-otu-systems)), and **Import Metadata (.xml)** adds them to a map you
already have. **Settings → Visual Options** controls how they look: **Fill Border Territories**,
**Show Border Names**, and **Show Region Names**.

---

## 16. How do I filter and colour the map?

Press **F** (or right-click → **MANAGERS → Filter Manager**) to open the **Filter Manager**.

### Filtering

Set criteria in the accordion sections:

- **Physical & Social (UWP)**: system name, each UWP digit, total population, trade codes
- **Stellar Info**: class, type and subtype, optionally for the primary star only
- **Polities**: allegiance and region
- **Zones Belts GG**: belts, gas giants, travel zone
- **Advanced Data**: T5 Importance, WTN, GWP, gravity, temperature

Systems that don't match are hidden, and the footer shows how many match. **Clear** removes the
filter. **Shift + F** hides the filter for a moment without losing it, then brings it back. The
filter also decides which worlds the **Custom Network** route generator connects (see
[question 12](#12-how-do-i-create-automated-routes)).

### Styling rules

The **Advanced Styling Rules** panel turns a filter into a lasting style: a primary colour, a ring
colour, an icon shape, the name in italic or underlined, and an optional hex background fill.
**Apply as New Rule** adds it to **Active Styling Rules**, which are applied in order. For
example, you can draw every high-population world in red with a ring. Use **Export** and
**Import** to save a rule set to a file and reuse it on another map.

---

## 17. How do I make a players' version?

Give each system a **disclosure level**, then export with **Version: Players**. The export then
holds exactly what the players' characters know, and nothing more.

### The levels

From least to most disclosed:

| Level | Players see |
|---|---|
| **0: Unknown** | Nothing. The hex is blank, with no dot, no page, and no index row. |
| **A: Star Present** | The star(s), travel zone, allegiance, and region |
| **B: Stellar Details** | + spectral type, luminosity, mass, and star orbits |
| **C: Gas Giants** | + whether there are gas giants |
| **D: System Layout** | + world count, belts, orbits, body types, and the name |
| **E: Physical Data** | + size, hydrographics, atmosphere, and temperature |
| **F: Population & TL** | + population, tech level, biosphere, and economy |
| **G: Full UWP** | Everything: UWP, starport, government, socioeconomics |

A system that has never been set counts as **Full UWP**. That way, maps made before this feature
existed export exactly as they did, but it also means **an unreviewed system gives everything
away**. To start from the other end, select the whole sector and set it to **Unknown** first.

### Setting levels

- **In bulk**: select hexes, then right-click → **ASSIGN → Assign Player Disclosure**.
- **System by system**: press **D** for the **Player Disclosure** window. It lists every system in
  the chosen sector and subsector with one column per level; click to set each one. A search box
  narrows the list, **Set all shown to** changes everything listed at once, and a warning counts
  the systems you have never set.

Changes can be undone with **Ctrl + Z**. Levels only affect the players' export; the map on your
screen always shows everything.

### The players' export

**Settings → Import / Export → Export Wiki → Version: Players** works with both the Obsidian and
HTML formats. Systems set to *Unknown* are left out entirely. Everything else, including the
subsector map and the system images, is drawn at that system's own level. The system's name
appears from **System Layout**, but its individual worlds keep generic labels ("World 2") until
**Full UWP**. The full System Sheet appears only at **Full UWP** (the orrery
is used below that), and **referee notes are never included**. Look through the result before you
hand it out.

---

## 18. How do I change how the map looks?

**Settings → Visual Options** covers the map display:

| Option | Effect |
|---|---|
| **Hide systems without planets** | Hides star-only systems so only systems with worlds are drawn |
| **Show Subsector Borders** | The subsector grid lines |
| **Fill Border Territories** / **Show Border Names** | How borders are drawn (see [question 15](#15-how-do-i-draw-borders-and-regions)) |
| **Show Region Names** | Labels the regions |
| **White Background Mode** | Draws the map on a white background instead of the dark one |
| **Show Sector Names** / **Edit Sector Names** | Labels each sector, and lets you rename them on a grid laid out like the map |
| **Default World Color** | The colour of a world dot when no styling rule applies |

The same section holds the **World Image Generation** settings (see
[question 13](#13-how-do-i-get-world-images)) and the **System Viewer** default start date.

---

*This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or
Far Future Enterprises.*
