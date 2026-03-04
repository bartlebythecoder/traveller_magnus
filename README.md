# As Above, So Below (v0.1.4)
### Traveller Magnus Star System Generator — The "Social Parity" Update

**"As Above, So Below"** is a star system generator and sector management tool for the Traveller TTRPG. It provides a seamless transition between sector mapping and the granular physical reality of individual worlds and moons.
---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. 
---

## 📜 Changelog

### [v0.1.4] - 2026-03-04
**Added: Coordinate-Based Seeding & Randomization Controls**
- **Coordinate-Based Seeding (The Gold Standard):** 
    - Implemented a localized seeding system where every world's generation is tied to its specific hex coordinates and a Master Seed.
    - Re-seeding occurs at the top of every generation function, ensuring hex 0101 is always identical for a given seed, regardless of generation order.
- **Randomization Control Panel:**
    - Added a "Generation Seed" field to the Settings menu.
    - Included a "Randomize Seed" button for quick universe variation with full persistence via `localStorage`.
- **Deterministic Name Generation:** Refactored the naming engine to use location-locked hashes, ensuring system names are constant for any given Master Seed.
- **UWP Clamping & Compliance:** Added the `clampUWP` logic to all engines to ensure generated values stay within standard Traveller limits (e.g., Hydrographics 0-A, TL 0-X), ensuring 100% compatibility with external tools like TravellerMap.com.
- **Seeded Bulk Generation:** Integrated `reseedForHex` into the "Auto-Populate" tool for deterministic map layouts.
- **Enhanced TravellerMap XML Export:** Added routes to our export function.


### [v0.1.3] - 2026-03-04
**Added: Trade/X-Boat Routes & History System**
- **Autonomous X-Boat Network:** Implemented calculation and autonomous Jump-4 routing to link high-traffic worlds.
- **Manual Cartography Suite:** Added a dedicated "Hold-to-Draw" system for hand-tailored sector routes:
    - **G Key:** Draw/Toggle **Green (Xboat)** routes.
    - **R Key:** Draw/Toggle **Red (Trade)** routes.
    - **Y Key:** Draw/Toggle **Yellow (Secondary)** routes.
- **History System (Undo/Redo):** Integrated a 50-step state-snapshot system. Users can undo (**Ctrl+Z**) and redo (**Ctrl+Shift+Z**) manual routes, bulk system expansions, or batch hex clears.
- **Data Integrity & Maintenance:**
    - **Orphaned Route Cleanup:** Deleting or resetting a hex now automatically prunes any connected routes to prevent "ghost lines."
    - **JSON Persistence:** Map routes are now fully serialized and saved within the Sector JSON file.
    - **Duplicate Prevention:** Smarter routing logic prevents overlapping or redundant lines between identical nodes.
- **UI & Performance Fixes:**
    - **Help Window (v2):** Redesigned the in-app Help Modal (Esc) with a two-column layout documenting all new shortcuts.
    - **Mongoose Macro:** Unified the `Ctrl+Shift+M` bulk expansion into a single undoable transaction.
    - **Dynamic Route Previews:** Added dashed color-coded previews during manual route creation.

### [v0.1.2] - 2026-03-03
**Added: Unified Travel Zone Utility**
- **Automated Travel Zones:** Implemented automated Travel Zone (Amber/Red) detection for **Mongoose 2e** (Env/Social criteria) and **Traveller 5** (Oppression Score logic).
- **Engine Parity:** Standardized visual highlighting and "Caution" banners across MgT2E, T5, and Classic Traveller system interfaces.

### [v0.1.1] - 2026-03-03
**Added: Subordinate System Socials & Engine Parity**
- **Unified Engine Parity:** Implemented full UWP (Universal World Profile) generation for all secondary planets and moons across **Classic Traveller (CT)**, **Traveller 5 (T5)**, and **Mongoose Traveller (MgT2E)**.
- **MgT2E Dependent Logic:** Added the "Environmental Floor" (Minimal Sustainable TL) and "Dependent World" logic from the *World Builder's Handbook*.

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
5. **Expand:** Select a group of hexes (Shift+Drag) and use the right-click context menu or **Ctrl + Shift + M** to generate full systems.

---
This tool is an unofficial fan project and is not affiliated with Mongoose Publishing or Far Future Enterprises. All Traveller trademarks and copyrights are used under fair use for fan-created content.
---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*
