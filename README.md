# As Above, So Below (v0.1.10.1)

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
---
## 📜 Changelog

### [v0.1.10.1] - 2026-03-13
1. **T5 System Generation:** Corrected formulas for t5 system generation.
2. **T5 System Generation:** Added world types for non-mainworlds
3. **T5 System Generation:** Removed AI house rules for orbital periods, orbital rotation and temperature.

### [v0.1.10] - 2026-03-13
1. **T5 Mainworld Generation:** Corrected formulas for mainworld generation.
2. **T5 Mainworld Generation:** Added full stellar details and PBG to T5 mainworld generation.

### [v0.1.9.1] - 2026-03-12
1. **RTT Engine:** Removed asteroid symbol from empty stars in the hex map.
2. **RTT Engine:** Now chooses random special base from list instead of providing list
3. **RTT Engine:** World View now shows check boxes for all bases.

### [v0.1.9] - 2026-03-12
1. **Bulk Macros:** Changed CT bulk macro to **Ctrl + Alt + C**.
2. **Dynamic Grid Scaling:** Resized the global map from 8x4 sectors to **7x5 sectors**.
3. **Context Menu:** Added full system generation macros to the context menu.
4. **RTT Generation:** Added RTT system generation and macro.




---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
