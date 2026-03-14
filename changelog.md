# Changelog

### [v0.1.10.2] - 2026-03-13
1. 

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

### [v0.1.8.12] - 2026-03-11
1. **Mongoose Socioeconomics:** Updated Resource and PCR formulas to incorporate values from Mongoose System Generation.
2. **Mongoose System Generation:** Updated Tech Level Refinement to incorporate values from Mongoose System Generation.
3. **Geological & Thermal Integration:** Finalized the integration of Inherent Heat from tidal and radioactive sources.
4. **Mongoose Mainworld Generation:** Added logic to ensure TL followed Core Rulebook including environmental minimums.

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

### [v0.1.8.10] - 2026-03-11
1. **Physical Generation Formulas:** Adjusted `mgt2e_calculateTerrestrialPhysical` and corresponding validators to conform exactly to the Continuation Method's strict dimensional formulas (0.001 tolerance testing).
2. **Tidal Lock Logic Integration:** Implemented an overarching celestial orbit gate checking for primary tidal locking and subsequent spin state overwrites for moons and mainworlds within tight binary orbits.
3. **Tidal Amplitude Engine:** Implemented comprehensive tidal effect calculations (Scenarios A-E) and integrated "Tidal Amp" readouts into the star system accordion UI.

### [v0.1.8.9] - 2026-03-10
1. **Day Length Refinement:** Fully integrated World Builder's Handbooks rules for computing rotation multipliers (x2 for small/gas giants vs x4) and added secure processing for >90 degree retrograde solar day fractions.
2. **Atmosphere Composition Interface:** Clamped accordion atmospheric gas readouts to explicitly display the top 3 dominant planetary gases out of consideration for UI space.

### [v0.1.8.8] - 2026-03-10
1. **Refactored Mongoose System Build:** Subdivided the 5000+ line `mgt2e_engine.js` into targeted modules (Mainworld, Socioeconomics, and System physics) for easier maintainability and read state initialization.

### [v0.1.8.7] - 2026-03-09
1. **Atmosphere Physics Logging:** Implemented comprehensive structural logging for terrestrial world atmosphere generation (Modules 1-6), covering pressure math, oxygen fraction/ppo, scale height, and detailed taint subtype/severity/persistence rolls.
2. **Forbidden Zone Resolution:** Refactored the Baseline Orbit (Mainworld) conflict resolution logic to use official tabletop variance rules (`2D-7 / 10`) when an anchor falls within a gas giant's Forbidden Zone.
3. **Stability Bug Fixes:** Fixed a physical boundary error in Planetoid Belt Significant Body placement where orbits were incorrectly calculated at 8x instead of 10x span.
4. **Stellar Audit Enhancements:** Updated the system audit to account for randomized atmospheric mechanics and dynamic orbital shifting for mainworld anchors.
5. **Atmosphere Generation:** Implemented automated audit checks for physical constraint validation (Vacuum/Size, ppo math, Taint loopbacks, and Gas physics).

### [v0.1.8.6] - 2026-03-09
1. **System Interface:** Updated Atmosphere logic.
2. **Non-Habitable Atmosphere Refinement:** Refactored the base atmosphere generation logic to fully implement official Hot and Cold Atmosphere tables, including deviation scaling for inner orbits and automated hazard/taint flags for extreme environments.
3. **Atmosphere Audit Logic:** Added post-roll checks for Extreme Heat and Irritant edge cases during system expansion.

### [v0.1.8.5] - 2026-03-09
1. **Mongoose System Generation:** Enhanced terrestrial planet logging to include full formulas for composition, density, gravity, mass, and escape/orbital velocity, as well as a physics audit and planetoid belt generation.
2. **System Interface:** Added Gravity, Mass, and Temperature fields to the Star System accordion view for all worlds and moons.
3. **System Interface:** Added composition and density to the Star System accordion view for all worlds and moons.
4. **Mongoose System Generation:** Added physics audit to the Star System accordion view for all worlds and moons.
5. **Mongoose System Generation:** Added planetoid belt generation to the Star System accordion view for all worlds and moons and associated automated testing.

### [v0.1.8.4] - 2026-03-09
1. **Mongoose System Generation:** Updated automated testing for mainworlds as moons.

### [v0.1.8.3] - 2026-03-09
1. **Moon Quantity Refactor (Step 3):** Implemented "Per Dice" penalties for worlds in unstable environments (Orbit < 1.0, star adjacency, forbidden zones).
2. **System Spread & Dim Primary DMs:** Added global quantity modifiers for low-spread systems and dim M-Type/Brown Dwarf primaries.
3. **Gas Giant Special Sizing (Step 4):** Implemented the Scenario B Special Sizing table for Gas Giant moons (Tiny, Standard, and Special brackets).
4. **Extreme Moon Constraint:** Implemented the "Sub-Stellar Companion" rule where moons resulting in Size G (16) are automatically converted into Small Gas Giants (GS), with potential Medium Gas Giant (GM) upgrades for Large Gas Giant parents.

### [v0.1.8.2] - 2026-03-09
1. **HZCO Calculation:** Implemented star-specific HZCO for S-Type worlds and summed luminosity derivation for P-Type circumbinary worlds.
2. **Effective Deviation:** Implemented non-linear "Effective Deviation" formulas for inner system orbits ($HZCO < 1.0$) to ensure realistic orbital crowding.
3. **Baseline Orbit Refinement:** Updated Step 3 logic with dynamic DMs for system complexity and branching formulas (multiplication/division) for dim-star habitable zones.
4. **Orbital Placement Refactor:** Implemented global empty orbit distribution and dynamic spread calculation based on baseline density.
5. **Slot Generation Loop:** Unified placement logic using a slot generation loop with a `baselineNumber` override to anchor the Mainworld.
6. **Forbidden Zone Jumps:** Replaced static forbidden zone logic with a dynamic "jump" method that preserves orbital spacing across gravitational gaps.
7. **Anomalous Planets (Step 7):** Added 2D-roll-based generation of anomalous orbits (up to $+3$ worlds) during system inventory.
8. **Global Placement Sequence (Step 8):** Implemented strict ordering (Mainworld -> Empty -> GG -> Belt -> TP) with specific Capture rules for Mainworlds being taken as Gas Giant moons.
9. **Updated Eccentricity (Step 9):** Implemented the 2D-roll-based eccentricity table with modifiers for P-Type orbits, old inner systems, and planetoid belts.
10. **Precision Orbital Periods:** Implemented high-precision period calculations factoring in interior stellar mass (P-Type) and planetary bulk (Solar unit conversion).
11. **Stellar & Orbital Audit:** Added an automated system-wide validation function (`runStellarAudit`) to verify orbital sequence, period accuracy, baseline anchoring, and gravity stability.
12. **Audit Capture Rule:** Updated anchor validation to correctly account for Mainworlds captured as moons by using parent body orbits.

### [v0.1.8.1] - 2026-03-09
1. **Mongoose Stellar Generation:** Implemented specialized generation for White Dwarfs (D) including progenitor mass/lifespan and Mass-adjusted interpolation from official aging tables.
2. **Mongoose Stellar Generation:** Implemented specialized generation for Brown Dwarfs (BD) featuring baseline L/T/Y type determination and mass-dependent cooling/aging logic (1-2 subtypes per Gyr).
3. **Mongoose System Generation:** Refined Non-Primary Star algorithms (Twin, Sibling, Random, Lesser, Other) with distinct logic paths and detailed audit logging.
4. **Mongoose System Generation:** Improved Age logic for post-stellar and substellar primary objects.
5. **Mongoose System Generation:** Added detailed logging for allowable orbit calculation.

### [v0.1.8] - 2026-03-08
1. **Mongoose Stellar Generation:** Added Hot Star types
2. **Mongoose Stellar Generation:** Subtypes now random 0-9
3. **Mongoose Stellar Generation:** Added stellar details (Mass, Temp, Diam, Lum) to generation log
4. **Mongoose System Generation:** Detailed logging for Age, Eccentricity, and all die rolls
5. **Mongoose System Generation:** Refactored stellar orbit classes to distinguish Close, Near, Far, and Companion stars
6. **Mongoose System Generation:** Implemented official Non-Primary Star Determination rules with separate Secondary and Companion columns and accurate DMs.

### [v0.1.7.6] - 2026-03-08
1. **Mongoose Socioeconomics:** Updated Downport logic - all starports except 'X' now have downports present.
2. **Mongoose Socioeconomics:** Removed Military Risk and Factional Conflict rolls and associated modifiers.
3. **Mongoose Socioeconomics:** Removed Military Readiness rolls and its impact on the final military budget.
4. **Mongoose Socioeconomics:** Renamed "Efficiency" to "Effect" for all military branches and expanded Enforcement calculation logs.
5. **Mongoose Socioeconomics:** Clamped minimum Marines Effect to 0 (previously 1).

### [v0.1.7.5] - 2026-03-08
1. **Mongoose Socioeconomics:** Expanded "Development Rating" (DR) logging to show full formula and intermediate math.

### [v0.1.7.4] - 2026-03-08
1. **Mongoose Socioeconomics:** Renamed "Income Rating (IR)" to "Inequality Rating" and expanded calculation logs.
2. **Mongoose Socioeconomics:** Expanded details in log for GWP and DR calculations.

### [v0.1.7.3] - 2026-03-08
1. **Mongoose Socioeconomics:** Added logging clarifications to MgT2E Socioeconomic Expansion

### [v0.1.7.1] - 2026-03-07
1. **T5 System Generation:** Added detailed logging for T5 system generation.
2. **Mongoose Socioeconomics:** Corrected errors and updated logging in Expanded TL calculations

### [v0.1.7.0] - 2026-03-07
1. **Expanded System Logging:** Added detailed logging for T5 and CT system generation.
2. **Mongoose Socioeconomics:** Now available for T5 and CT generation.
3. **CT System Generation:** Fixed bug that re-rolled mainworld generation details in expanded system.
4. **CT System Generation:** Enforced Tech Level 0 for any subordinate world with Population 0.
5. **CT System Generation:** Enforced Spaceport Y for any world or moon with Size 0 or R.
6. **CT System Generation:** Restored population rolls for Size 0 (Planetoid Belts) while retaining Size R (Rings) at Population 0.
7. **CT System Generation:** Instrumented detailed gravity, mass, and orbital period logging for all bodies.
8. **CT System Generation:** Refactored engine to a "Single-Calculation, Two-Pass Update" model for stable demographics and clear facility logging.

### [v0.1.6] - 2026-03-06
1. **Mongoose Trade Classification Corrections:** Mainworld Generation Trade Codes Ga, In, Ni, Ri, Wa codes had inconsistencies with Core Rulebook.
2. **Mongoose System Generation:** P-value changed to random 1-9, with high population (10+) using the Mongoose "Population A" variant (starting at 1 and incrementing on 1D6 5+).
3. **Mongoose System Generation:** Fixed bug in PCR calculation where Pop 9+ penalty was accidentally added instead of subtracted.
4. **Mongoose Socioeconomics:** Updated Major Cities formula for worlds with Pop 6+ and PCR 1-8 to use the new urbanization-weighted calculation.
5. **Mongoose Socioeconomics:** Added "Judicial System Profile" field to Mongoose expansion logic and UI, including automated generation and logging of judicial codes.

### [v0.1.5] - 2026-03-05
**Updated: CT Mainworld and Book 6 Generation**
- **Bulk CT Macro:** Added **Ctrl + Alt + S** to automate the full Classic Traveller population, mainworld, and Book 6 system expansion sequence for selected hexes.
- **Improved Book 6 Anomaly Logic:** Refactored system anomalies to use separate independent rolls for "Empty Orbits" and "Captured Planets" with specific DMs for B/A type stars.
- **Enhanced System Generation Logging:** Instrumented the entire CT generation pipeline with the new Batch Logging Architecture, providing detailed traces of orbital placement, Gas Giant/Planetoid assignments, and subordinate world stats.
- **CT Tech Level Generation Fix:** Aligned Classic Traveller TL logic with Book 6 rules by including Atmosphere 15 (F) in modifiers and standardizing the 1D roll helper.
- **Starport X Red Zone Logic:** Updated all three generation engines (CT, MgT2E, T5) to automatically assign a **Red Travel Zone** if the generated mainworld has a Starport of 'X'.
- **Optional Development System Level Logging:** Incorporated a new Batch Logging Architecture that allows for capturing deterministic plaintext generation traces (including system names and coordinates) via a settings toggle.

### [v0.1.4.1.2] - 2026-03-04
**Added: Machine-Agnostic Naming Determinism**
- **Eliminated LocalStorage Bias:** The `usedNames` tracking is no longer persisted in `localStorage`. This ensures that a fresh load of the app always produces the same naming sequence for a given seed, regardless of the machine's history.
- **Strict Order Independence:** Removed the name-splicing logic that made results dependent on the order in which hexes were generated. Naming is now strictly tied to the `masterSeed + hexId` hash.
- **Alphabetical Pool Standardization:** Added an automatic sort to the name pool on load to ensure cross-browser and cross-environment consistency even if the source `names.js` is modified.

### [v0.1.4.1.1] - 2026-03-04
**Fixed: Keyboard Shortcut Input Collision**
- **Input Focus Guard:** Implemented a global guard for the `keydown` event listener to prevent routing shortcuts (G, R, Y) from triggering while typing in `input` or `textarea` elements. This fixes a literal "can't type the letter 'r'" bug in the settings panel.
- **Escape Key Exception:** Refined the logic to ensure the **Escape** key remains functional even when a text field is focused, allowing users to still close modals via the keyboard.

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
