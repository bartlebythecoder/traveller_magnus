# As Above, So Below (v0.1)
### Traveller Magnus Star System Generator

**"As Above, So Below"** is a star system generator and sector management tool for the Traveller TTRPG. It provides a seamless transition between galactic-scale sector mapping and the granular physical reality of individual worlds and moons.

Well, that is the goal.  It is still in development has a ton of bugs and missing features.  Use at your own risk.

## 🚀 [Launch the Generator (Live Web App)](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html)
*No download required. Runs directly in your browser via GitHub Pages.*

---

## Overview
This workbench allows Game Masters and world-builders to generate, import, and expand star systems using multiple generations of Traveller logic. Whether you are running a Classic Traveller campaign or a high-crunch Traveller 5 (T5) simulation, this tool ensures that your "expanded" systems remain 100% consistent with your sector-level data.


## Key Features (Version 0.1)
- **Multi-Era Engine:** Toggle between **Classic Traveller (Book 6)**, **Mongoose Traveller (2nd Edition)** and **Traveller 5 (T5)** expansion logic.
- **Full System Generation:**
    - Dynamic stellar classification using Flux-based logic.
    - Gravity derived from granular Size and Density variables.
    - Climate Zone modeling based on Habitable Zone (HZ) distance.
    - Automated satellite and moon inventory generation.
- **Data Portability:**
    - **Import:** Ingest official `.tsv` or `.tab` sector files (e.g., from TravellerMap.com).
    - **Export:** Save your data into T5-compliant tab-delimited formats.
- **Socioeconomic Integration:** Full support for T5 and Mongoose 2e WBH Extensions: **Importance {Ix}**, **Economics (Ex)**, and **Culture [Cx]**.


## Usage
1. **Launch the App:** Click the [Live Demo](https://bartlebythecoder.github.io/traveller_magnus/hex_map.html) link above.
2. **Import Data:** Use the "Import Sector" button in the sidebar to load a standard TravellerMap file.
3. **Expand:** Click any hex on the map and select an expansion engine (CT, Mongoose 2e, or T5).
4. **Stellar Preservation:** The engine automatically detects imported stellar data and builds the system around the existing "canon" stars.

## Version 0.1 Roadmap

### 🛑 Priority One: Mathematical Validation
The immediate goal for the next iteration is a comprehensive **Stellar Audit**. We will systematically validate every formula across all engines to ensure perfect alignment with core T5 and CT rulebooks.

### 🚀 Planned Features
- **Markdown Export:** Generate Obsidian-ready system reports.
- **Atmospheric Detailer:** Deep-dive generation of gas mixes and chemical taints.
- **SQLite Integration:** Permanent browser-side storage for expanded systems.

---
*Created by BIAS-CCR. Dedicated to the explorers of the Third Imperium and beyond.*