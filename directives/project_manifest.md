# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.7.2.0
**Target:** Advanced Fitering Options
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
The best traveller map generator and browser ever created, with functions for all types of players.
For this version: an updated filtering technique incorporated gas giants, planetoid belts and total population

## 2. Architectural Pillars 
* **Directives Layer:** 18 SOPs total. *New:* `directives/statistical_validation_sop.md`.
* **Data Shield:** Centralized tables for engine rules and the new **Expectation Table**.
* **Math Chassis:** Universal logic for survival floors, now strictly table-driven to eliminate logic drift.
* **Trace Logging:** Planet-Centric biographies with a final **Statistical Deviation Report** footer.

## 3. Implementation Plan (v0.6.1.x - v0.7.x)


### Phase 7.0: Political Mapping & Referee Utility (Complete)
* **Action 7.0 (Manual Entry):** Add `Allegiance` and `Notes` fields to the Main World UI for all engines.
* **Action 7.0 (Hex Fill Filter):** Implement the "Hex Background Fill" filter using transparent RGBA colors to highlight Allegiance territories.
* **Action 7.0 (Persistence):** Update TSV import and storage logic to ensure manual data persists across engine swaps by HexID.

### Phase 7.1: Filter Upgrade (Complete)
* Replace incorrect Gas Giant checkbox with a field to allow for a number filter.  Should be placed after Allegiance
* Replace broken Total Pop logic with working Total Pop field
* Notes on population.  
    * Every system, regardless of engine, will have a Population Code (0-15).  This code represents the rough population using the formula 10^x where X is the population code.  So a population code of 3 means the rough population is 10^3 which is 1,000.   A population code of 6 is 1,000,000
    * Some engines (like T5) provide a PBG value where the first value in PBG is a population mod.  This provides a slightly more accurate total population by providing the first digit of the population.  So a population code of 7, and a population mod of 4, would mean a total population of 40,000,000.
    * The mongoose engine generates a pop mod called a p-value in the socioeconomic extension
    * Some engines (like Classic Traveller) do not create a pop mod or p-value and leave the total population as 10^the population code
* We have created a total population filter that does not currently produce expected results
    * The total population filter field should filter out all systems with mainworlds that do not meet its critera.  The field should use real numbers, not codes.  So if a user wants to filter for planets with populations greater than a million people, it should say > 1,000,000 (or >1m)
    * This means all population codes need to be converted to rough population before being filtered, and any pop-mods or p-values need to be applied.

### Phase 7.2: Filter Upgrade (Current)
* Filter window change to save space: group the Route Visibility and Layer Visibility sections into one section with one heading called "Visibility Options"
* Add a new expandable section to the filter window called "Zones Belts GG" 
* Move the Gas Giant filter into the "Zones Belts GG" section
* Add a filter for Belts (second digit in PBG) into the "Zones Belts GG" section
* Add a filter for Travel Zones (G, A, R) for Green, Amber, Red into the "Zones Belts GG" section

