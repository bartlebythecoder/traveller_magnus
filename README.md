# As Above, So Below (v0.7.1)

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
---
## 📜 Changelog

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

### [v0.6.1] - 2026-04-07
1. **Statistical Auditor Integration:** The StatisticalAuditor is now fully integrated into all bulk generation macros (CT, MgT2E, T5, and RTT) within macro_orchestrator.js.
2. **Statistical Auditor Integration:** It now also triggers for single-system regeneration via the Context Menu. When you regenerate a single hex, the console will now output a specific "Subsector-scale" audit for that system, allowing you to see exactly how that system's properties align with expected Traveller distributions.
3. **Refined Thermal Physics (MgT2E):** Patched a significant scaling issue in mgt2e_world_engine.js. Previously, the tidal heat calculation for moons incorrectly used the star's mass instead of the parent planet's mass, leading to nonsensical temperature overflows. Internal heat (inherentK) is now physically capped at 200K to ensure consistent climate modeling.
4. **UI/Console Parity:** The StatisticalAuditor now outputs color-coded [PASS] and [STATISTICAL WARNING] flags directly to the browser console, providing immediate feedback on whether your current sector generation is matching the target RAW (Rules-As-Written) frequency tables.
5. **T5**: Fixed starport distribution; size 0 mainworlds now possible;
6. **CT**: Fixed atmosphere penalty for mainworlds in top down generation

### [v0.6] - 2026-04-06
1. **ALL**: Refactored code to eliminate duplicates and move common functions to data files
2. **ALL**:  Added name to filter window
3. **RTT**: Removed superfluous outerDM = -1; Reduced the number of worldless systems to about 8%
4. **RTT**: Fixed incorrect Flare Star check formula
5. **MGT2E**: Fixed size string parsing showing NaN instead of Size S.  
6. **MGT2E**: Added Culture Quirks to world generation
7. **CT**: Built universal ct_stellar_engine.js to remove duplication between ct_topdown_engine.js and ct_bottomup_engine.js
8. **CT**: Unifying stellar generation fixed bugs in top_down and bottom_up companion generation
9. **CT**: Fixed orbital slot allocation
10. **CT**: Fixed Gas Giant presence in system generation
11. **CT**: Fixed mainworld as satellite frequency
12. **T5**: Refactored social engine (including TL) resolving infrequent systems with high tech levels


---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
