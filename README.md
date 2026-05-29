# As Above, So Below (v0.13.1)

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

### [v0.13.1] - In Progress

### [v0.13.0] - 2026-05-28
1. **Exports:** Added markdown file exports (Obsidian Export)
2. **CT Engine/Filter Menu:** Adjusted filter menus to treat size of S and R as between 0 and 1
3. **Refactor:** Code refactor, harmonizing to_eHex and from_eHex functions
4. **RTT Engine:** Fixed bug that was not pulling TL from Settings
5. **System Viewer:** Reduced overall speeds on orbits
5. **System Viewer:** Added stellar body orbit speed slider
5. **System Viewer:** Removed dependencies between sliders

### [v0.12.0] - 2026-05-24
1. **World Images:** World hemisphere images and maps generated for all terrestrial bodies
2. **Borders:** Fixed bug impacting manual border fills

### [v0.11.1] - 2026-05-22
1. **Borders and Regions:** Setting option available to see Border and Region names on map
2. **Borders and Import OTU:** Fixed a bug incorrectly importing the Solomani Rim
2. **Import Universe:** Added Terry Mixon xml file for Foreven Sector
3. **Import Imperium/Universe:** Fixed bug that would not expand System in non-aligned worlds
4. **Download Routes:** Added options for more fields to include in Route csv download
5. **Settings:** Improved look and feel of headings on white background
6. **System Viewer:** Added option to scale size of orbit lines in system viewer
7. **System Viewer:** When white background setting enabled, system viewer shows white background

### [v0.11.0] - 2026-05-21
1. **System Viewer:** Zoom into system with details and see orbiting worlds and moons
2. **RTT World Gen:**  Enable RTT World Gen exports; can now be imported into travellermap
3. **RTT World Gen:**  Add settings to change default Settlement, TL value and use Industry instead of TL in UWP
4. **Mongoose Engine:** Added setting to force Minimal Sustainable Tech levels
5. **All Engines:** Added Mod and Max settings for Starport, Pop, and TL for customizing builds for colonies, frontiers etc
6. **Import TSV:** Fixed bug that did not clear sector chosen for import before importing
7. **Import Universe:** Added option to include Terry Mixon Foreven sector in Universe Import


---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
