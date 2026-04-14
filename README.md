# As Above, So Below (v0.8)

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
### [v0.8] - 2026-04-14
1. **Auto Filter Routes:** Added Auto Route generation from the Filter window — connect filtered worlds via shortest-path bridging, with custom color, jump range, and named route groups; rendered as a distinct "Filter" route layer beneath manual routes
2. **Point-to-Point Auto Routes:** Added point-to-point pathfinding between any two hexes, with optional restriction to filtered worlds only
3. **Zoom LOD Rendering:** At zoom levels below 0.3, hex grid lines, text, and icons are suppressed; only background fills and selections are drawn, significantly improving performance when zoomed out to sector or universe scale
4. **IndexedDB Persistence:** Added `db_manager.js` — automatically mirrors `hexStates` and `sectorRoutes` to IndexedDB so work survives browser refresh without a manual JSON save
5. **Route Layering:** Filter routes always render beneath manual (Xboat/Trade/Secondary) routes; all four types have independent visibility toggles in the Filter window
6. **Side-by-Side Route Offset:** Multiple routes sharing a segment are spread apart at zoom ≥ 0.3 so they remain individually visible
7. **Chunked JSON Save:** Workspaces exceeding 250 MB are automatically split into multiple numbered JSON parts on save; loading prompts the user to select all parts together so no data is lost on very large maps

### [v0.7.4] - 2026-04-13
1. **Import the Universe:** Added experimental bulk import of the full 16×8 OTU sector canvas
2. **Numeric Sector IDs:** Refactored hex IDs from letter-based to numeric (legacy JSON auto-migrated on load)
3. **Imperium Data:** Sector list now fetched live from travellermap API with correct OTU coordinates
4. **Canvas Scaling:** Sector and subsector grid lines now span the full canvas at any grid size
5. **Undo Stack:** Capped at 5 snapshots for canvases larger than 35 sectors to protect memory
6. **Zoom:** Extended zoom-out limit from 0.1 to 0.03
7. **API Courtesy:** Enforced 1-second delay after every live travellermap API call; sectors cached for 24 hours


### [v0.7.3] - 2026-04-12
1. **Mongoose Socioeconomic:** Fixed bug that did not check if Ix, Cx, or Ex could be inherited
2. **Mongoose System Expand:** Fixed bug that did not make use of T5 Stellar information and PBG
3. **Import Sector .tsv:** Fixed bug that did not capture Worlds value
4. **Generate Xboat:** Added user options on range and jump distances
5. **Import Imperium:** Added the option to bulk import Imperial Sectors


### [v0.7.2.1] - 2026-04-11
1. **Settings Menu:** Added Solo-6 button to download Solo Sector 6 data

### [v0.7.2] - 2026-04-11
1. **Filter Engine Expansion:** Added Belt and Travel Zone filters
2. **Filter UI:** Created new Filter section for Belts, GG, Zones
3. **All Engines:** Created Belt and GG counts to be used for filters in creation methods of all engines
4. **JSON Load/Save:** Ensured Belt and GG count included in all JSON saves, and added to any legacy JSON being loaded
5. **Sector Import:** Fixed bug that prevented Travel Zones from being imported

### [v0.7.1] - 2026-04-10
1. **Filter Engine Expansion:** Added "Gas Giant" and "Total Population" filters.
2. **Filter Engine Expansion:** Added the ability to use k, m, b as shorthand for thousands, millions, and billions in the total population filter
3. **T5 Pop mod:** Fixed a bug in the T5 engine producing Population mods of 0 when population > 0
4. **Hex Background:** Added as an option outside of filtering.  Hex backgrounds can be placed on selected hexes via the context menu.

### [v0.7] - 2026-04-07
1. **Political Mapping & Referee Utility:** Initiated Phase 7.0 development.
2. **Allegiance & Notes:** Implemented manual entry fields for Allegiance codes and Referee Notes in the Main World UI.
3. **Allegiance Selection:** Implemented a way to mass change Allegiance through selection and right click.
3. **Hex Background:** Added to filter styles
4. **White Background Mode:** Added in settings
5. **Fixed Mongoose World and Moon Temperature:** Orbital WBH errata applied.  Bug tidal locking some worlds to stars corrected.
6. **Fixed Gas Giant Temperature:**  Wrong age exponent fixed.  Age divide by zero corrected (min. Gyr).



---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
