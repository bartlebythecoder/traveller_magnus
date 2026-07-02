# As Above, So Below (v0.16.0.5)

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

### [v0.16.0.5] - In Progress
1. **System Editor (Mongoose):** Fixed bug where editing an already-generated system caused its socioeconomic data (Importance, RU, GWP, WTN, IR/DR, and all profile strings) to be silently rerolled instead of preserved
2. **System Editor (Mongoose):** Fixed bug where editing a system with existing socioeconomic data could cause that data to disappear from the display entirely

### [v0.16.0.4] - 2026-07-01
1. **System Details:** Fixed a bug where entire system details were marked as changed when one or more bodies were added

### [v0.16.0.3] - 2026-07-01
1. **System Editor:** Fixed bug where re-previewing a system could re-roll and re-sort moon orbital positions, making manually named/added moons appear shuffled or mismatched in the accordion view

### [v0.16.0.2] - 2026-07-01
1. **System Editor:** Allow user to override Atmosphere rules for size 0/S/1 worlds

### [v0.16.0.1] - 2026-07-01
1. **System Import/Export:** Can now import and export individual systems
2. **System Editor:** New worlds created in system editor allow for manual UWPs
3. **Travel Zones:** Setting to disable automatice Travel Zone setting
4. **Traveller World Import:** Gravity added to worlds imported from Traveller World JSON 
5. **Hex Map:** Fixed bug that sometimes incorrectly showed Gas Giant symbol in systems without Gas Giants

### [v0.16.0] - 2026-06-26
1. **Mongoose Engine - System Editor:** Added Mongoose edit system window.  Mongoose orbital bodies can now be added. removed or changed.
2. **Mongoose Engine - Atmosphere Editor:** Added Atmosphere edit system window.  Mongoose world atmospheres can now be edited.
3. **Mongoose Engine - Solar Days Editor:** Added Atmosphere edit solar days window.  Mongoose world solar days can now be edited.
4. **System Overview:*** - Reorganized the overview to show all orbital bodies in order of their distance from primary.  All engines now use the same method.

### [v0.15.2.4] - 2026-06-19
1. **Import Traveller World Systems:** Fixed import error not reading mainworlds as satellites

### [v0.15.2.3] - 2026-06-17
1. **Import Traveller World Systems:** Fixed import slot error resulting in system viewer mis-aligning orbits
2. **System Viewer:** Now distinguishes between Size 0 belts and Size 0 worldlets
3. **System Viewer:** Options added to hide moons, habitable zone, mainworld highlights

### [v0.15.2.2] - 2026-06-16
1. **Import Traveller World Systems:** Fixed import error changing Orbit #

### [v0.15.2.1] - 2026-06-16
1. **System Viewer:** Fixed bug where over-written system appears on System Viewer

### [v0.15.2] - 2026-06-15
1. **System Viewer:** Fixed bug that incorrectly showed some worlds in same orbit as companion stars
2. **All Engines:** Harmonized system naming conventions across engines
3. **Context Menu:** Redesigned Right-click context menu
4. **Import Traveller World Systems:** Added feature to import Traveller World System JSON

### [v0.15.1] - 2026-06-15
1. **World Details:** Fixed bug that did not propagate names to mainworld moons in some systems

### [v0.15.0] - 2026-06-13
1. **AoW Engine:** Added 'Architect of Worlds' stellar and planetary generation option. Generation is matched with Mongoose Socioeconomic expansion.
2. **System Viewer:**  System Viewer now includes pause/play button, and the option of entering a date.  Default start date can be set in Settings.
3. **World Details:** Changing a mainworld/system name in the World Details window gives the option of propogating the name change throughout the system.
4. **All Engines:** Added sub-phase reseeding to isolate their RNG phase from main generation.   For example, population rolls during auto-populate use reseedForHex(hexId + "-pop") so they don't interfere with system generation even if called in a different order.

### [v0.14.0] - 2026-06-05
1. **Filter:** Added ability to filter stellar information
2. **Mongoose:** Added Class III, Class IV, Class VI and Giants to bottom up generation (Special table)
3. **Mongoose:** Added Setting to use Optional Variant adding the realism of more colder M-type (red dwarf) systems


---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
