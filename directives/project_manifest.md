# PROJECT AS ABOVE, SO BELOW - Phase 2 Manifest
**Target:** Mongoose Traveller 2nd Edition (MgT2E) World Generation Refactor
**Current Phase:** Phase 2 (Bottom-Up Expansion)
**Architecture Standard:** The "Sean Protocol" (Strict Modular Separation, Comprehensive Trace Logging)

## 1. Project Goal
Phase 1 successfully decoupled the legacy MgT2E monolith into isolated, stateless modules (Data, Math, Engines, Orchestrator) for Top-Down generation. Phase 2 will introduce the **Bottom-Up Generation** sequence utilizing these exact same core engines. 

The Bottom-Up sequence generates the UWP Mainworld *first*, designs a star system to support it, and then populates the remaining orbits.

## 2. Architectural Pillars (The "Sean Protocol")
All new code must strictly adhere to the established Phase 1 architecture:
* **Data Shield (`/rules/mgt2e.js`):** All new bottom-up RPG tables, strings, and constants must live here. No hardcoded arrays in the logic files.
* **Math Chassis (`js/mgt2e_math.js`):** All raw formulas remain isolated here.
* **Core Engines (`js/mgt2e_world_engine.js`, `js/mgt2e_socio_engine.js`):** These engines must be reused. They should accept a `mode: 'bottom-up'` context to alter their flow if necessary, rather than duplicating logic.
* **Trace Logging:** Every calculation, DM, and table lookup MUST be wrapped in the `tSection`, `tRoll2D`, `tDM`, `tResult`, and `writeLogLine` framework.

## 3. Phase 2 Execution Plan & File Targets

### Step 1: Requirements & Data Injection
* **Target:** `/rules/mgt2e.js`
* **Action:** Query the Requirements Agent for the Bottom-Up specific generation tables (e.g., Mainworld Orbital Placement, System Skeleton generation based on Mainworld presence). Inject these into the Data Shield.

### Step 2: The Bottom-Up Orchestrator
* **Target:** `js/mgt2e_bottomup_generator.js` (NEW FILE)
* **Action:** Build the new orchestrator sequence.
    * Generate Mainworld UWP first.
    * Determine Primary Star based on Mainworld needs.
    * Place Mainworld in specific orbit.
    * Generate System Skeleton (Gas Giants, Belts, Empty Orbits).
    * Pass the system through the existing Core Engines to populate physicals and socioeconomics for the rest of the system.

### Step 3: Engine Adaptation
* **Target:** `js/mgt2e_world_engine.js`, `js/mgt2e_socio_engine.js`
* **Action:** Ensure the existing engines can accept a pre-generated Mainworld object and correctly size/populate the rest of the system without overwriting the established Mainworld data.

### Step 4: Auditor & UI Integration
* **Target:** `js/mgt2e_uwp_auditor.js`, `js/input.js`
* **Action:** Update the auditor to accept and validate `{ mode: 'bottom-up' }` rulesets. Wire the frontend UI buttons to fire the new `generateMgT2ESystemBottomUp()` orchestrator.

## 4. Current Directive
**STANDING ORDER:** Await the new Bottom-Up data structures from the Requirements Agent. Once provided, begin mapping them into `/rules/mgt2e.js` as the first technical step of Phase 2.