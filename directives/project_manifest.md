# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.7.2.1
**Target:** Advanced Fitering Options
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
The best traveller map generator and browser ever created, with functions for all types of players.
For this version: better integration with the OTU T5 sectors

## 2. Architectural Pillars 
* **Directives Layer:** 18 SOPs total. *New:* `directives/statistical_validation_sop.md`.
* **Data Shield:** Centralized tables for engine rules and the new **Expectation Table**.
* **Math Chassis:** Universal logic for survival floors, now strictly table-driven to eliminate logic drift.
* **Trace Logging:** Planet-Centric biographies with a final **Statistical Deviation Report** footer.

## 3. Implementation Plan (v0.7.x)


### Phase 0.7.0: Political Mapping & Referee Utility (Complete)

### Phase 0.7.1: Filter Upgrade (Complete)

### Phase 0.7.2: Filter Upgrade (Complete)

### Phase 0.7.2.1: Filter Upgrade (Complete)
* Add a pre-populated sector that is available via JSON through a new button on the bottom of the Settings bar
    * Add a separator bar at the bottom of the Settings Menu
    * Add a button that says Load Sector Solo 6 after the separator bar
    * When pressed, automatically load in a JSON in the sector directory called 'solo_6.json'
* Add settings to Generate XBoat functions to allow user to control jump and range sizes
* Ensure Mongoose Socioeconomic Expansion function re-uses T5 Ix, Cs, Ex if available

### Phase 0.7.3: Improved OTU integration (Current)
* When expanding a T5 or OTU system using Mongoose System Expansion ensure to pull the stellar details and PBG details from the T5 system rather than regenerating
* Add a the functionality to use the travellermmap API to bulk import OTU sectors