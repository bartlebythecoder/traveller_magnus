# As Above, So Below (v0.9.1)

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
### [v0.9.1] - 2026-04-16
1. **CT Editable System Details:** All fields in the Classic Traveller System Details accordion are now inline-editable — star classifications, physical properties (diameter, gravity, mass, temperature, rotation, axial tilt, distance, orbital period), and UWP for non-mainworld bodies. Edited fields are highlighted and persist in the workspace JSON. Manual edits survive regeneration where orbit positions match; only an explicit hex clear removes them.
2. **CT Body & Satellite Names:** Every planet, captured planet, and satellite in a CT system now has an editable name field in the accordion header, defaulting to Roman-numeral position names (e.g. *Regina III*, *Regina III-a*).
3. **Auto Route Jump Limit:** Maximum jump size for Auto Filter Routes increased from 8 to 20.

### [v0.9.0.2] - 2026-04-15
1. **MgT2E Life Roll Fix:** Corrected a bug where the biospherics engine rolled individually for life on every solid world in the system. Per WBH rules, only the mainworld (top-down) and habitable-zone worlds receive a full biomass evaluation; all remaining inhospitable worlds are resolved with a single collective 2D roll — a natural 12 means trace life exists on one randomly chosen body.
2. **MgT2E Audit Update:** Includes % of worlds and % of systems with life
3. **MgT2E Mainworld Selection:** Fixed bug that removed belts from Mainworld consideration

### [v0.9.0.1] - 2026-04-15
1. **Sector Name Display:** Added configurable sector name labels to the map. Names appear at zoom levels below 0.3 (when hex detail is suppressed), rendered at a 30° angle across each sector in the TravellerMap style. Names are auto-populated from Imperium and Universe imports, editable manually via a new "Edit Sector Names" grid dialog in the Settings panel, and persisted in the workspace JSON.

### [v0.9] - 2026-04-15
1. **RTT World Details Sync:** Edits made to a mainworld's UWP in the World Details panel now correctly propagate into the RTT System Details accordion — the two views stay in sync after every save.
2. **RTT World Naming:** Every body in an RTT system (planets, moons, gas giants, satellites) now has an editable name field directly in the System Details accordion header. Bodies default to auto-generated names derived from the system name and orbital position (e.g. *Regina III*, *Regina III-a* for its first moon). Custom names are saved per-body, persist with the system JSON, and are shown in italic to distinguish them from defaults. The mainworld name is also independently editable without changing the system name.
3. **RTT System Details:** Fields in the RTT System Details can be edited.

### [v0.8] - 2026-04-14
1. **Auto Filter Routes:** Added Auto Route generation from the Filter window — connect filtered worlds via shortest-path bridging, with custom color, jump range, and named route groups; rendered as a distinct "Filter" route layer beneath manual routes
2. **Point-to-Point Auto Routes:** Added point-to-point pathfinding between any two hexes, with optional restriction to filtered worlds only
3. **Zoom LOD Rendering:** At zoom levels below 0.3, hex grid lines, text, and icons are suppressed; only background fills and selections are drawn, significantly improving performance when zoomed out to sector or universe scale
4. **IndexedDB Persistence:** Added `db_manager.js` — automatically mirrors `hexStates` and `sectorRoutes` to IndexedDB so work survives browser refresh without a manual JSON save
5. **Route Layering:** Filter routes always render beneath manual (Xboat/Trade/Secondary) routes; all four types have independent visibility toggles in the Filter window
6. **Side-by-Side Route Offset:** Multiple routes sharing a segment are spread apart at zoom ≥ 0.3 so they remain individually visible
7. **Chunked JSON Save:** Workspaces exceeding 250 MB are automatically split into multiple numbered JSON parts on save; loading prompts the user to select all parts together so no data is lost on very large maps

---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
