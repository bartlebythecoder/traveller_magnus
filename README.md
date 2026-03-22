# As Above, So Below (v0.5.1)

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

### [v0.5.1] - 2026-03-21
1. **System Expansion:** Added Times to Jump Point.

### [v0.5] - 2026-03-20
1. **Mongoose 2E Engine:** Implemented New Mongoose Bottom-Up Generation.
2. **Cross-Engine Compatibility:** Implemented cross-engine system expansion, allowing hexes imported or generated in T5 or Classic Traveller to be seamlessly expanded using the Mongoose Top-Down engine (and vice versa) while strictly preserving pre-existing stellar profiles.

### [v0.4.3.1] - 2026-03-20
1. **Mongoose 2E Engine:** Corrected Mongoose hot star bug.

### [v0.4.3] - 2026-03-18
1. **Mongoose 2E Engine:** Successfully refactored the MgT2E legacy generators into a modular Top-Down architecture.
2. **Architecture:** Implemented a new Orchestator (`generateMgT2ESystemTopDown`) to unify stellar, world, and socioeconomic generation.

### [v0.4.2.1] - 2026-03-18
1. **T5 Engine:** Corrected T5 orbit error

### [v0.4.2] - 2026-03-17
1. **T5 Engine:** Refactored T5 engine into modular components.

### [v0.4.1] - 2026-03-17
1. **Classic Traveller Engine:** Fixed Satellite Radius display issue.

### [v0.4] - 2026-03-16
1. **Classic Traveller Engine:** Added Bottom Up Full CT system generation.


---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
