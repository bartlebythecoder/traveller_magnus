# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.6.1.0
**Target:** Statistical Validation & Audit Finalization
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
To complete the Multi-Engine Auditor suite by introducing **Sector-Wide Statistical Validation**. This version ensures the "Math Chassis" produces accurate distributions (e.g., Garden Worlds, Binary Systems) by comparing live results against RPG-specific Expectation Tables.

## 2. Architectural Pillars 
* **Directives Layer:** 18 SOPs total. *New:* `directives/statistical_validation_sop.md`.
* **Data Shield:** Centralized tables for engine rules and the new **Expectation Table**.
* **Math Chassis:** Universal logic for survival floors, now strictly table-driven to eliminate logic drift.
* **Trace Logging:** Planet-Centric biographies with a final **Statistical Deviation Report** footer.

## 3. Implementation Plan (v0.6.1.x - v0.7.x)

### Phase 6.1: The Statistical Integrity Update (Complete)
* **Action 6.1:** Create `directives/statistical_validation_sop.md` to define the Running Tally workflow.
* **Action 6.1:** Populate the Data Shield with the **Expectation Table** (Statistical targets for all engines).
* **Action 6.1:** Implement **Running Tally Logic** in the Orchestration layer to increment counts during generation.
* **Action 6.1:** Append the **Statistical Footer** to all logs, comparing Actual vs. Expected results with [PASS/FAIL] statuses.

### Phase 7.0: Political Mapping & Referee Utility (Current)
* **Action 7.0 (Manual Entry):** Add `Allegiance` and `Notes` fields to the Main World UI for all engines.
* **Action 7.0 (Hex Fill Filter):** Implement the "Hex Background Fill" filter using transparent RGBA colors to highlight Allegiance territories.
* **Action 7.0 (Persistence):** Update TSV import and storage logic to ensure manual data persists across engine swaps by HexID.

### Phase 7.1: Demo Assets & Final Sweep
* **Action 7.1 (Demo Universe):** Add a "Load Official Sector" button in Settings for one-click curated data import.
* **Action 7.1 (Diagnostic Sweep):** Use the v0.6.1 Auditor to verify the Official Sector matches expectations 100%.