# As Above, So Below (v0.1.1)
### Traveller Magnus Star System Generator — The "Social Parity" Update

**"As Above, So Below"** is a star system generator and sector management tool for the Traveller TTRPG. It provides a seamless transition between galactic-scale sector mapping and the granular physical reality of individual worlds and moons.

---

## 📜 Changelog

### [v0.1.1] - 2026-03-03
**Added: Subordinate System Socials & Engine Parity**
- **Unified Engine Parity:** Implemented full UWP (Universal World Profile) generation for all secondary planets and moons across **Classic Traveller (CT)**, **Traveller 5 (T5)**, and **Mongoose Traveller (MgT2E)**.
- **T5 Continuation Cap:** Integrated strict population ceilings for secondary worlds to ensure logical system hierarchy.
- **MgT2E Dependent Logic:** Added the "Environmental Floor" (Minimal Sustainable TL) and "Dependent World" logic from the *World Builder's Handbook*.
- **UI Enhancements:**
    - Standardized UWP display rows across all three expansion engine menus.
    - Implemented visual highlighting for the Mainworld in the Mongoose 2e interface.
    - Automated classification tagging (e.g., Mining, Farming, Research, Penal Colony) for all subordinate bodies.

---

## 🚀 [Launch the Generator (Live Web App)](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html)
*No download required. Runs directly in your browser via GitHub Pages.*

---

## Overview
This workbench allows Game Masters and world-builders to generate, import, and expand star systems using multiple generations of Traveller logic. Whether you are running a Classic Traveller campaign or a high-crunch Traveller 5 (T5) simulation, this tool ensures that your "expanded" systems remain 100% consistent with your sector-level data.

## Key Features
- **Multi-Era Engine:** Toggle between **Classic Traveller (Book 6)**, **Mongoose Traveller (2nd Edition)** and **Traveller 5 (T5)** expansion logic.
- **Full System Generation:**
    - Dynamic stellar classification using Flux-based logic.
    - Gravity derived from granular Size and Density variables.
    - Automated satellite and moon inventory with full UWP social stats.
- **Socioeconomic Integration:** - Full support for T5 and Mongoose 2e WBH Extensions: **Importance {Ix}**, **Economics (Ex)**, and **Culture [Cx]**.
    - Automatic identification of secondary world purposes (Mining Facilities, Research Bases, etc.).
- **Data Portability:**
    - **Import:** Ingest official `.tsv` or `.tab` sector files (e.g., from TravellerMap.com).
    - **Export:** Save your data into T5-compliant tab-delimited formats.

## Usage
1. **Launch the App:** Click the [Live Demo](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html) link above.
2. **Import Data:** Use the "Import Sector" button in the sidebar to load a standard TravellerMap file.
3. **Expand:** Click any hex on the map and select an expansion engine (CT, Mongoose 2e, or T5).
4. **Stellar Preservation:** The engine automatically detects imported stellar data and builds the system around the existing "canon" stars.

---

## Version 0.1.2 Roadmap

### 🛑 Priority One: Markdown & Documentation
The next milestone focuses on the **Export Suite**. We are building a Markdown generator to create Obsidian-ready system reports, allowing GMs to instantly port generated systems into their personal campaign wikis.

### 🚀 Planned Features
- **Atmospheric Detailer:** Deep-dive generation of gas mixes and chemical taints.
- **SQLite Integration:** Permanent browser-side storage for expanded systems.
- **System Summary Tool:** A cross-engine comparison tool to view economic output across different rule variants.

---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*