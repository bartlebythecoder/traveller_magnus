# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Target:** Journey Times & Stellar Masking Integration
**Architecture Standard:** The "Sean Protocol" (Strict Modular Separation, Comprehensive Trace Logging)

## 1. Project Goal
To integrate a "Journey Times" data readout for all generated worlds, calculated universally across all four generation engines. Additionally, introduce an optional "Stellar Masking" modifier. This modifier becomes available strictly when a full system skeleton (including the primary star) is generated, and applies exclusively to worlds that meet specific stellar size and orbital distance mathematical thresholds.

## 2. Architectural Pillars (The "Sean Protocol")
All new code must strictly adhere to the established architecture:
* **Data Shield (`/rules/mgt2e.js`):** Remains untouched for this specific feature update, as no static tables or string arrays are required.
* **Math Chassis (`js/mgt2e_math.js`):** All raw formulas, journey time algorithms, and masking threshold logic must remain isolated here.
* **Core Engines (All Four Generation Systems):** Every engine responsible for generating and packaging world objects across all four systems must be updated to call the unified math functions from the Math Chassis, ensuring universal application without duplicating the core algorithms.
* **Trace Logging:** Every calculation, eligibility check, and modifier application MUST be wrapped in the `tSection`, `tResult`, and `writeLogLine` framework.

## 3. Implementation Plan & File Targets

### Phase 0: Investigation & State Management
* **Target:** GUI/State Modules
* **Action:** Investigate the application's UI transition behavior when moving from a "Mainworld Only" generation state to an expanded "Full System" state. 
    * *Objective:* Determine if expanding a system triggers a full GUI redraw (which would natively render the new checkbox) or if dynamic DOM manipulation is required to unhide the checkbox and update the existing Mainworld's Journey Time readout on the fly.

### Phase 1: Math Chassis
* **Target:** `js/mgt2e_math.js`
* **Action:** * Build the universal base calculator function for Journey Times.
    * Establish the mathematical thresholds for Stellar Masking eligibility (comparing primary star size vs. specific orbital distance).
    * Build the isolated Stellar Masking modifier function.
    * *Constraint:* Ensure all steps utilize the established trace logging framework.

### Phase 2: Core Engines
* **Target:** All Core Engine Object Packagers (across all four generation systems).
* **Action:** Update all existing engines to execute the new Math Chassis functions for the Mainworld and any subordinate worlds. Ensure the computed Journey Times and the boolean maskingEligible flag are accurately packaged into the final generated world objects before they are passed to the UI orchestrators.

### Phase 3: Auditor & UI Integration
* **Target:** `js/input.js`, GUI Rendering Modules
* **Action:** * **Mainworld View:** Inject the Journey Time data at the bottom of the Mainworld display panel.
    * **Accordion View:** Inject the Journey Time data at the bottom of each non-mainworld panel within the system accordion.
    * **Checkbox Implementation:** Add the global "Stellar Masking" checkbox to the primary UI.
        * *Display Logic:* Hide or disable the checkbox entirely if only an isolated Mainworld exists.
        * *Execution Logic:* When toggled on, only apply the math modifier to worlds whose data object explicitly carries a `true` value for the `maskingEligible` flag.