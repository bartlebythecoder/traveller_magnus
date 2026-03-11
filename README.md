# As Above, So Below (v0.1.8.12)

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
- **Multi-Era Engine:** Toggle between **Classic Traveller (Book 6)**, **Mongoose Traveller (2nd Edition)** and **Traveller 5 (T5)** expansion logic.
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
    - **Ctrl + Alt + M:** Full Mongoose 2E Generation sequence.
    - **Ctrl + Alt + S:** Full Classic Traveller (Book 6) Generation sequence.
---
## 📜 Changelog

### [v0.1.8.12] - 2026-03-11
1. **Mongoose Socioeconomics:** Updated Resource and PCR formulas to incorporate values from Mongoose System Generation.
2. **Mongoose System Generation:** Updated Tech Level Refinement to incorporate values from Mongoose System Generation.
3. **Mongoose Bulk Macro Overview:** Now runs System Expand before Socioeconomic Expand
4. **Mongoose Mainworld Generation:** Added logic to ensure TL followed Core Rulebook including environmental minimums.
5. **Macros:** Changed bulk macros from Ctrl+Shift to Ctrl+Alt to avoid conflicts with Browser shortcuts.

### [v0.1.8.11] - 2026-03-11
1. **Thermal & Seismic Overhaul:** Implemented the World Builder's Handbook 4th-power temperature addition model, combining solar luminosity with inherent geological/tidal heat.
2. **Advanced Albedo & Greenhouse Logic:** Refactored albedo scaling for Rocky/Icy transitions and implemented atmosphere-specific Greenhouse Factor (GF) variance.
3. **Seismic Stress Model:** Integrated a three-component stress engine (Residual, Tidal Stress, Tidal Heating) to drive planetary volcanism and tectonic activity.
4. **Life Profile Logic Refinement:** 
    - **Biodiversity:** Implemented the strict `2D - 7 + CEILING((Biomass + Biocomplexity) / 2)` formula.
    - **Compatibility:** Refactored DMs to prioritize atmospheric taints and age penalties (8.0+ Gyr), ensuring mandatory floor rounding for final ratings.
    - **UI Integration:** 
        - Added "Native Life" field to the Mongoose system accordion (4-digit ehex profile).
        - Integrated "Res" (Resource) rating for all terrestrial worlds and moons, placed after Habitability for consistent system navigation.


---
*For a full history of changes, see the [Changelog](changelog.md).*

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
