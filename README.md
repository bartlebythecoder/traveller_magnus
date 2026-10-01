# As Above, So Below (v0.18.1.2)

**"As Above, So Below"** is a star system generator and sector management tool for the Traveller TTRPG. It provides a seamless transition between sector mapping and the granular physical reality of individual worlds and moons.
---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. 
---

## 🚀 [Launch the Generator (Live Web App)](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html)
*No download required. Runs directly in your browser via GitHub Pages.*

## 📖 Documentation
- **[FAQ](faq.md)** — creating systems and sectors, saving and sharing, editing worlds, images, and routes. Start here.
- **[Route Manager Manual](help_routes.md)** — every route type, parameter, and troubleshooting step in detail.

---

## Overview
This workbench allows Game Masters and world-builders to generate, import, and expand star systems using multiple generations of Traveller logic. Whether you are running a Classic Traveller campaign or a high-crunch Traveller 5 (T5) simulation, this tool ensures that your "expanded" systems remain 100% consistent with your sector-level data.

## Key Features
- **Multi-Era Engine:** Toggle between **Classic Traveller (Book 6)**, **Mongoose Traveller (2nd Edition)**, **Traveller 5 (T5)**, **RTT WorldGen** and **Architect of Worlds** expansion logic.
- **System Editor:** Build a system by hand or reshape a generated one — add and delete stars, worlds, gas giants, belts, and moons, seed individual UWP digits, and let the engine fill in the rest. Available for MgT2E, CT, and T5 systems.
- **Interstellar Connectivity:** Automatic generation of X-boat trade lanes based on world Importance {Ix} scores.
- **Manual Routing:** Draw and color-code custom routes directly on the hex map across nine independent route slots — XBoat, Trade, and Secondary are pre-configured; the rest are yours to name, colour, and key however you like.
- **Point-to-Point Route Builder:** Chart a route through any number of mandatory waypoints — reorder stops freely, see each one's name and hex ID, and have every route slot remember its setup so you can reopen and extend a route later instead of rebuilding it. Stops can be **clicked straight off the map** rather than typed, either one field at a time or by tracing the whole route: each click extends it, with the previous destination becoming a waypoint. Stops may also be **empty hexes**, for referees who let players jump into deep space.
- **TravellerMap XML Integration:** Import and export TravellerMap-format metadata XML files — load route networks from community sector files directly into your route manager, or export your routes for use with TravellerMap and other tools.
- **Full TSV Export Fidelity:** Sector exports now correctly populate Ix, Ex, and Cx extension fields for Mongoose-generated worlds, using the engine's own computed socioeconomic values.
- **Regions:** Define named regions in the Region Manager (**G**), then assign them per-system in World Details or in bulk via right-click → Assign Region. Regions can be outlined and labelled on the map, and filtered on across all engines.
- **Cross-Engine Stellar Filtering:** Filter worlds by star class, spectral type, and subtype across all five generation engines (Classic Traveller, Mongoose 2E, Traveller 5, RTT, and AoW).
- **Full System Generation:** Dynamic stellar classification, gravity derivation, and automated moon/satellite inventory.
- **Regional Surface Maps:** Zoom from a world image down to one patch of the ground — a printable survey sheet with shaded relief, coastlines, named landforms, a graticule, scale bar, compass rose, globe locator and a terrain key giving each material's share of the sheet. The window is fixed at the world's own scale (roughly 120–220 km across), drag to pan or click the locator to jump, and every world carries five site slots you can **pin** to places worth surveying. Terrain is derived from the world's UWP and map seed, so the same world always renders the same landscape. Choose between two terrain models in **Settings → Visual Options → World Image Generation**: **Tectonic** (a plate model with linear ranges, trenches, rifts, rivers and lakes) or **Classic** (the original terrain, unchanged).
- **Wiki Export (Obsidian or HTML):** Package a subsector as a cross-linked **Obsidian** Markdown vault — a page per system, star, world, and moon — or as a standalone **HTML website** with one page per system, a sortable and filterable system index, light/dark themes, and print-ready pages. The HTML version needs no server or software beyond a browser; unzip and double-click. Both include the subsector map and world images, with a choice of projection — Globe (Hemispheres), Sinusoidal, Mercator, Mollweide, or Diamond. Worlds with pinned sites also get a **Regional Surveys** section carrying a full survey sheet per pin.
- **Players' Version (Fog of War):** Give each system a disclosure level — from *Unknown* (it does not appear at all) up through star presence, stellar details, gas giants, system layout, physical data and population, to the full UWP — then export a players' wiki trimmed to exactly that. Worlds stay unnamed until fully surveyed, orrery images are redrawn to match, and referee notes are never included. Set levels in bulk via right-click → **Assign Player Disclosure**, or open the **Player Disclosure** window (**D**) to see every system's level at a glance, with unreviewed systems flagged. The subsector map is drawn to match — undisclosed systems simply are not on it.

## Usage
1. **Launch the App:** Click the [Live Demo](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html) link above.
2. **Import Data:** Click the settings gear (top right) → **Import / Export** → **Import Sector (.tsv)** to load a standard TravellerMap file. The same panel offers **Import the Imperium** (35 sectors) and **Import the Universe** (experimental, 128 sectors), both fetched live from travellermap.com.
    - **Save your work:** settings gear → **Map Files** → **Save Map JSON**. The browser keeps an automatic copy between sessions, but only the JSON survives a browser reset or moves between machines.
3. **Advanced Manual Routing:** Hold a route slot's shortcut key and drag between two adjacent hexes to draw a segment; repeating the drag over an existing segment deletes it. Slots are assigned keys **1–9** by default — **1** = XBoat (green), **2** = Trading (red), **3** = Secondary (yellow), **4–9** = spare slots. Names, colours, and shortcut keys are all editable in the Route Manager (**R**).
    - **Ctrl + Z / Ctrl + Shift + Z:** Undo and Redo cartography or expansion actions.
4. **View Details:** Use **Ctrl + Click** on any populated hex to open the **World Details** panel, which provides deep physical and socioeconomic breakdowns for the entire star system.
5. **System Viewer:** Zoom in with the scroll wheel; at maximum map zoom, one more scroll-in over a populated hex opens the animated orrery. Scroll out at full view or press **Escape** to return to the map.
6. **Bulk Macros:** Select a group of hexes (Shift+Drag) and use the right-click context menu or:
    - **Ctrl + Alt + M:** Full Mongoose 2E Generation sequence (includes system population).
    - **Ctrl + Alt + C:** Full Classic Traveller (Book 6) Generation sequence (includes system population).
    - **Ctrl + Alt + R:** Full RTT Generation sequence (includes system population).
    - **Ctrl + Alt + 5:** Full Traveller 5 (T5) Generation sequence (includes system population).
7. **Filter Control:** Use the **F Key** to **Open Filter Window** for advanced filtering and custom styling rules.
    - **Shift + F:** Temporarily suspend the filter so every world reappears, and press again to restore it. Your filter settings are untouched, and route generation keeps using the real filter regardless.

**Some quick notes on Importing the Universe**:
1) I have a one second wait time for each sector - so it takes a bit to load everything
2) Make sure to Save the JSON once you load it, so you never have to import it again - just load from your hard drive
3) It will be its most sluggish when zoomed out, and most responsive when zoomed in.
4) As of v0.8 this should be useable, though maybe sluggish, with older systems
5) Having all of these sectors loaded at once was not the intention of this program. I do, however, appreciate a challenge. So if you think you would enjoy working like this and have the right system for it, be my guest.

**Replacing Foreven**:
Want to replace any of these sectors with your own file?
1)  Mouse over the sector you want to replace (zoom in for smoother and better response results)
2)  Press Control + S to select the Sector (you should see it highlighted)
3)  Right Click->Populate->Manual Reset Clear (Note the sector # in the Clear Hex; 36 for Foreven)
4)  Click the settings gear in the top right and choose Import Sector .tsv
5)  Select your file - choose the sector number you noted (#36 for Foreven)

**Notes on Size Limits as of v0.8**:
1) 4GB RAM: Import the Universe freely. Expand systems via WBH for 8-10 sectors before risk. Ideal use case: full OTU political/astrographic view (T5 only) with a handful of deep-dived WBH sectors.
2) 8GB RAM: The Imperium (35 sectors) fully expanded is viable. The full Universe expanded is not.
3) 16GB RAM: Half the Universe expanded is realistic for a patient user.
4) 32-64GB RAM: The full Universe expanded is theoretically possible.

---
## 📜 Changelog

### [v0.18.1.2] - 2026-10-01
1. **New — choose your system images on export:** HTML and Obsidian exports can include the system sheet, the orrery, both or neither; players' exports still show the sheet only at *Full UWP*.

### [v0.18.1.1] - 2026-09-25
1. **New — System Sheet:** **System Sheet** in the system view opens a one-page image of the whole system (rendered bodies in orbit order, star details, planetary table, mainworld called out) with **Download PNG**; all five engines.
2. **New — System Sheet in exports:** HTML and Obsidian exports use the sheet (JPEG) in place of the orrery; players' exports show it only at *Full UWP* and keep the orrery below that.
3. **Changed — CT world images now use each world's temperature** in every view; about two in three will look different.
4. **Fixed — RTT:** gas giant hover no longer fails, moons show UWPs, Red-zone lunar mainworlds read Red.
5. **Improved — T5:** hovering a body shows its Orbit #.

### [v0.18.1] - 2026-09-24
1. **Fixed — survey sites pinned on a moon now reach your exports**, under **Regional Surveys**, withheld from players' exports exactly as the moon's own image is.
2. **Housekeeping — about 220 lines of unused river code removed** from the terrain engine; nothing you see changes.
3. **Improved — round-trip routes list and export in travel order:** a clean circular Point-to-Point route is numbered from your Start in the Route Systems panel and the CSV export, and a straight route now lists from the Start you typed.

### [v0.18.0] - 2026-09-20
1. **New — regional surface maps:** **Open Map → Regional Maps** renders a printable survey sheet of any patch of a world's surface, with five pinnable sites per world that save with the sector and appear in the HTML and Obsidian exports.
2. **New — Tectonic or Classic terrain:** **Settings → World Image Generation** chooses between plate-tectonic continents and the classic model; the choice saves with the sector, and older files load as Classic so nothing you have changes.
3. **New — round-trip Point-to-Point routes:** Start and End may be the same world; use two or more waypoints for a genuine loop.
4. **Improved — generating a route now asks before replacing the route already in that slot.**
5. **Fixed — the MgT2E System accordion no longer opens blank** on multi-star systems from pre-v0.14 sector files.

---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
