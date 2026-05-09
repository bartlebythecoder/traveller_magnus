# As Above, So Below (v0.10.1.3)

**"As Above, So Below"** is a star system generator and sector management tool for the Traveller TTRPG. It provides a seamless transition between sector mapping and the granular physical reality of individual worlds and moons.
---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. 
---

## 🚀 [Launch the Generator (Live Web App)](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html)
*No download required. Runs directly in your browser via GitHub Pages.*

---

## Overview
This workbench allows Game Masters and world-builders to generate, import, and expand star systems using multiple generations of Traveller logic. Whether you are running a Classic Traveller campaign or a high-crunch Traveller 5 (T5) simulation, this tool ensures that your "expanded" systems remain 100% consistent with your sector-level data.

## Key Features
- **Multi-Era Engine:** Toggle between **Classic Traveller (Book 6)**, **Mongoose Traveller (2nd Edition)**, **Traveller 5 (T5)**  and **RTT** expansion logic.
- **Interstellar Connectivity:** Automatic generation of X-boat trade lanes based on world Importance {Ix} scores.
- **Manual Routing:** Draw and color-code custom routes (Xboat, Trade, Secondary) directly on the hex map.
- **TravellerMap XML Integration:** Import and export TravellerMap-format metadata XML files — load route networks from community sector files directly into your route manager, or export your routes for use with TravellerMap and other tools.
- **Full TSV Export Fidelity:** Sector exports now correctly populate Ix, Ex, and Cx extension fields for Mongoose-generated worlds, using the engine's own computed socioeconomic values.
- **Cluster Field:** A freeform Cluster field is available on every system — assign individually, bulk-assign via right-click, and filter by cluster name across all engines.
- **Full System Generation:** Dynamic stellar classification, gravity derivation, and automated moon/satellite inventory.

## Usage
1. **Launch the App:** Click the [Live Demo](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html) link above.
2. **Import Data:** Use the "Import Sector" button in the sidebar to load a standard TravellerMap file.
3. **Advanced Manual Routing:**
    - **Hold G + Drag:** Draw/Delete Green Routes.
    - **Hold R + Drag:** Draw/Delete Red Routes.
    - **Hold Y + Drag:** Draw/Delete Yellow Routes.
    - **Ctrl + Z / Ctrl + Shift + Z:** Undo and Redo cartography or expansion actions.
4. **View Details:** Use **Ctrl + Click** on any populated hex to open the **World Details** panel, which provides deep physical and socioeconomic breakdowns for the entire star system.
5. **Bulk Macros:** Select a group of hexes (Shift+Drag) and use the right-click context menu or:
    - **Ctrl + Alt + M:** Full Mongoose 2E Generation sequence (includes system population).
    - **Ctrl + Alt + C:** Full Classic Traveller (Book 6) Generation sequence (includes system population).
    - **Ctrl + Alt + R:** Full RTT Generation sequence (includes system population).
    - **Ctrl + Alt + 5:** Full Traveller 5 (T5) Generation sequence (includes system population).
6. **Filter Control:** Use the **F Key** to **Open Filter Window** for advanced filtering and custom styling rules.

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

### [v0.10.1.3] - In Progress
1. **Routes, Borders, Regions:** Added options in menu to clear values for selected hexes
2. **Import Sector (tsv):** Fixed bug retaining previous sector selection in cache

### [v0.10.1.2] - 2026-05-09
1. **Borders:** Corrected border fills expanding to sector borders
2. **Regions:** Corrected errors that were not properly import/exporting region colors

### [v0.10.1.1] - 2026-05-08
1. **Changelogs:** Updated (had been incomplete)
2. **Mongoose Engine:**  Adjusted boiling and frozen temperature bands to align with atmosphere tables (which disagree with page 47 table)

### [v0.10.1] - 2026-05-08
1. **Routes:** X-Boat generation now writes to the selected route slot instead of always forcing to Slot #1 — each generation only clears and replaces segments in its own slot, leaving all other slots untouched
2. **Mongoose Engine:** Fixed missing HZCO deviation log entry for temperate (habitable-zone) planets — deviation and table selection are now recorded in the generation log for every planet regardless of temperature band
3. **Canvas:** Clear Canvas now also resets all sector names
4. **Routes:** Raised Max Empty Jumps cap for Point-to-Point routes from 3 to 10; Custom Network remains capped at 3
5. **Borders:** New Border functionality including Border Window, import borders from metadatafiles or add them manually via right-click context menu.  
6. **Import:** Added selective import options to Import Imperium and Import Universe — a checkbox panel lets you choose which data to import independently: Sector Data, Route Data, Border Data, and Region Data (all enabled by default)
7. **Import:** Region Data import from TravellerMap metadata XML — parses `<Regions>` polygon boundaries using the same flood-fill algorithm as borders, assigns region names to each hex's Region (cluster) field, and automatically creates a background-highlight filter rule using the region's defined color
8. **Import:** Region name field expanded from 10 to 20 characters to accommodate longer TravellerMap region names
9. **Import:** TSV sector import now accepts 3-digit hex codes by automatically padding a leading zero, preventing rows from being silently dropped when the leading zero is missing
10. **Regions:** New Region functionality including Region Window, import regions from metadatafiles or add them manually via right-click context menu.
11. **Advanced Filter Rules:** Now have visibility checkboxes
12. **Mongoose Engine:** Updated temperature band calculation to match chart on Page 47
13. **Mongoose Engine:** Updated atmosphere gas mix for exotic atmospheres to limit gases to reasonable amount
14. **Routes:** Removed limit of routs to match the new metadata Borders and Regions

### [v0.10.0.3] - 2026-05-02
1. **Routes:** Removed legacy Xboat and Auto Routes modals and their event handlers; all route operations now go through the Route Manager
2. **Routes:** Increased jump range limit from 6 to 20 across all Route Manager panels (BTN, P2P, Network, Xboat)
3. **Mongoose Engine:** Rewrote HZCO deviation formula to use a continuous linear scale (sub-1 orbits scaled ×10) giving physically correct temperature classifications for inner-system worlds
4. **Routes:** Implemented BTN Trade Route generation (GURPS Far Trader inspired) — computes Basic Trade Number for all world pairs within range, draws routes for pairs meeting Min/Max BTN thresholds, promotes partial-success pairs whose BFS paths share a segment, and enforces no-shared-segment priority between competing BTN route slots
5. **Routes:** Xboat, Network, and BTN route generators now avoid Red travel zones and X starport worlds as intermediate routing hops (endpoints may still be Red)
6. **Routes:** Added Import Metadata (.xml) and Export Metadata (.xml) buttons for TravellerMap-format sector XML files — import routes grouped by color into chosen route slots; export all routes for a sector with route definition colors and cross-sector offset attributes for round-trip compatibility
7. **Export:** Fixed Ix, Ex, and Cx not being populated when exporting a Mongoose-generated sector — the exporter now reads Im/ecoR/L/I/E directly from the Mongoose engine output and uses the cultural profile D/X/U/S dimensions for Cx; also fixed a broken global reference that prevented the T5 socio fallback from firing for CT/RTT worlds
8. **Routes:** Added "Allow Empty Hexes" option to Custom Network and Point-to-Point route generators — when enabled, BFS can traverse hexes marked as EMPTY, subject to a configurable Max Empty Jumps (1–3) consecutive-hop limit before a populated system must be reached
9. **All Engines:** Added freeform **Cluster** field to all systems — displayed in the world info panel below Allegiance, editable inline (up to 10 characters), bulk-assignable via right-click context menu, and filterable in the Filter Control window using the same prefix-match OR logic as Allegiance; persists in JSON saves

### [v0.10.0.2] - 2026-04-25
1. **Route Manager:** Fixed bugs preventing system names being used properly in filters and reports for OTU imports and JSONs
2. **Mongoose Engine:** Density: Added randomized linear results between table results to three decimals to increase variability
3. **Mongoose Engine:** Density: Corrected UI units to Earth-relative
4. **Mongoose Engine:** Escape Velocity:  Corrected units in logs to m/s

### [v0.10.0.1] - 2026-04-24
1. **Shortcut Menu:** Removed legacy shortcuts from help menu

### [v0.10.0] - 2026-04-24
1. **Mongoose Engine:** Calculate precide diameter and hydrographic measurements and added to UI
2. **Mongoose Engine:** Updated mass, gravity, escape velocity calculations with new diameter meaasurements
3. **Routes:** Completely revamped routs including:
    * Custom names and colors
    * All routes can be autogenerated or manually created or edited
    * Easy access to route details including # jumps, # systems, list of systems


---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
