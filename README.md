# As Above, So Below (v0.16.1.0)

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

### [v0.16.1.0] - In Progress
1. **Classic Traveller Engine:** Moons of gas giants and terrestrial worlds are now generated and stored in orbital-distance order, so a moon's name/letter always matches its actual distance from its parent (previously only the displayed name reflected distance — the underlying list order did not, so the System Editor and accordion could show them out of sequence)
2. **Classic Traveller Engine:** Fixed a bug where moons had no Distance (AU) or Temperature (K) shown in the accordion — moons never inherited a distance-to-star value, silently breaking the temperature calculation
3. **Classic Traveller Engine:** Fixed a bug where a moon's Mass could display with excessive decimal places and overflow its field in the accordion
4. **Accordion (Classic Traveller):** Reworked the star/body/moon stat layout to a label/value grid so values line up consistently instead of long labels crowding out their values and short labels leaving unused space
5. **Accordion (Classic Traveller):** Removed a redundant "Satellite" label and index number from each moon's summary row that could run together with the moon's type (e.g. "SatelliteMoon"); added consistent spacing between items in all accordion summary rows
6. **Classic Traveller Engine:** Fixed a bug where moons of gas giants orbited far too fast in the System Viewer's orrery — gas giants (and terrestrial worlds/mainworlds) never had a real diameter recorded, so the moon-orbit calculation silently substituted Earth's diameter for the parent regardless of its actual size. Gas giant diameter is a placeholder pending an authoritative source; terrestrial/mainworld diameter now uses the same formula already trusted for moons, and is also now shown correctly in the accordion's Diameter (km) field, which was previously always blank for these bodies
7. **System Editor (Mongoose):** Fixed a bug where a system whose mainworld is a moon (e.g. of a gas giant) showed no mainworld highlighted in the System Editor's body list, and pressing Preview or Fill & Save would incorrectly elect a second mainworld instead of recognizing the existing one
8. **System Viewer:** Fixed a bug where enabling "Hide Mainworld" did not hide the highlighted ring and name label for a mainworld that is itself a Planetoid Belt, even though it correctly hid the highlight for all other mainworld types
9. **Traveller 5 Engine:** Fixed a bug where almost every T5 world showed Rotation as "Undefined (Referee Discretion)" — the tidal-lock check ran before the world had been placed into a star orbit, so it could never detect an orbit 0/1 world; rotational dynamics are now calculated after system expansion, once each body's real orbit is known
10. **System Editor (Classic Traveller):** Fixed a bug where changing a system's mainworld to a different body, then saving, could fail the auditor with "Mainworld count error: found 2, expected 1" — demoting a moon that had been the mainworld only cleared its mainworld flag, not its type, so the stale designation was carried into the next save alongside the newly chosen mainworld
11. **Classic Traveller Engine:** Fixed a bug where regenerating a Bottom-Up or Top-Down sector with the same seed could produce different systems each time — gas giant, planetoid belt, and (Top-Down) habitable-zone orbit placement were rolled with an unseeded random number generator instead of the seeded one used everywhere else, breaking reproducibility
12. **Revised Traveller Engine:** Fixed a bug where Ancients Site placement used an unseeded random number generator instead of the seeded one used everywhere else, so it wasn't reproducible when regenerating with the same seed
13. **System Viewer**: Added ring visuals for CT and MgT2E
14. **System Editor (Mongoose):** Updated belt input to allow user to include UWP

### [v0.16.0.6] - 2026-07-04
1. **System Editor:** Unified the Fill & Save and Preview commit logic into a single internal function, removing duplicated code that could drift out of sync between the two
2. **System Editor (Mongoose):** Fill & Save now runs the UWP Auditor after generating the system; if it finds issues you'll get a warning with the choice to proceed anyway or go back and fix the system first
3. **Mongoose Engine:** Moved the seed-restoration logic (used when regenerating a System-Editor-authored system) out of the bottom-up generator into a shared helper module, so other engines can reuse it without duplicating the logic
4. **Mongoose Engine:** Consolidated duplicated audit-logging code between the two Mongoose generators (bottom-up and top-down) into one shared function, and fixed a fragile dependency check that could break if script load order ever changed — internal cleanup, no behavior change
5. **System Editor:** Replaced the scattered per-engine branches in the System Editor's internals with a single per-engine lookup, starting with Mongoose — internal architecture groundwork for adding more engines to the System Editor, no behavior change
6. **System Editor (Classic Traveller):** Classic Traveller systems can now be created and edited in the System Editor, matching functionality already available for Mongoose — add, remove, and edit stars, worlds, gas giants, belts, moons, and captured planets, then Fill & Save to regenerate
7. **System Editor (Classic Traveller):** User-set values (size, atmosphere, hydrographics, population) on Classic Traveller bodies are now preserved on Fill & Save instead of being silently rerolled
8. **System Editor (Classic Traveller):** Fill & Save now runs the UWP Auditor for Classic Traveller systems too; if it finds issues you'll get the same warning with the choice to proceed anyway or go back and fix, already available for Mongoose systems
9. **System Editor:** Extended the shared per-engine lookup (item 5 above) to Classic Traveller — internal architecture groundwork, no behavior change beyond enabling item 6

### [v0.16.0.5] - 2026-07-04
1. **System Editor (Mongoose):** Fixed bug where editing an already-generated system caused its socioeconomic data (Importance, RU, GWP, WTN, IR/DR, and all profile strings) to be silently rerolled instead of preserved
2. **System Editor (Mongoose):** Fixed bug where editing a system with existing socioeconomic data could cause that data to disappear from the display entirely
3. **Hex Map Rendering:** Fixed a graphical corruption bug where the map canvas could become visually garbled after a browser page-zoom change (e.g. Ctrl+Mousewheel) went unsynced from the canvas; the canvas now automatically resyncs whenever the browser's zoom/DPI changes

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




---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
