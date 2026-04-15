# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.9
**Target:** Advanced Fitering Options
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
An easy to use Traveller/Cepheus system builder and navigator
For this version: editing system stats

## 2. Architectural Pillars 
* **Directives Layer:** 18 SOPs total. *Newest:* `directives/statistical_validation_sop.md`.
* **Data Shield:** Centralized tables for engine rules including **Expectation Table**.
* **Math Chassis:** Universal logic for survival floors, now strictly table-driven to eliminate logic drift.
* **Trace Logging:** Planet-Centric biographies with a final **Statistical Deviation Report** footer.

## 3. Implementation Plan (v0.9)

### Phase 0.9.0: RTT Editable System Details (Complete)

  Step 1 — Persistence Infrastructure (small, done once)
  - Define _manualFields as a plain array on body/star objects ([] by default)
  - Write three helper functions: markManual(body, field), isManual(body, field), clearManual(body, field)
  - Add re-expansion warning to the RTT UI handler: if any body in the system has _manualFields.length > 0, confirm before proceeding
  - Verify JSON roundtrip preserves _manualFields (should be automatic)

  Step 2 — RTT Accordion: Inline Edit Mode
  - Add an Edit toggle button to the RTT system accordion header
  - When toggled on, renderRTTBody re-renders with <input>/<select> elements instead of <strong> display for all in-scope fields
  - Add event delegation listener on editor-rtt-system-root — on change, find body, write value, call markManual
  - Manual fields render in a distinct colour (both in edit mode and view mode)
  - Field-level inline editing of all non-UWP fields displayed in the RTT accordion (click-to-edit)
  - _manualFields persistence and override guards in the engine
  - Re-expansion warning when manual fields exist
  - Visual highlight for manually-set fields


  Step 3 — RTT Engine: Override Guards
  - Create expandRTTBiographerOnly(sys) — new entry point that runs only generateRTTSectorBiographer on an existing sys (no Step 1–3 regeneration)
  - Add isManual guards inside processRTTPhysicalStatsPartA, processRTTPhysicalStatsPartB, processRTTDerivedPhysics, and processRTTSocialStats — before each field write, check if (isManual(body, 'fieldName')) return
  - Wire expandRTTBiographerOnly into the UI so re-expansion uses it instead of generateRTTSectorStep1


### Phase 0.9.0.1: Sector Name Patch (Current) 
  Step 3.1
  * Add Sector names as a configurable display option
  
### Phase 0.9.1: CT Editable System Details   
  * Step 4 — CT Engine Wiring (like Phase 0.90 same pattern, smaller field set)

### Phase 0.9.2: T5 Editable System Details     

  * Step 5 — T5 Engine Wiring (like Phase 0.90 same pattern, larger field set; T5 socio carry-over already handled)

### Phase 0.9.3: MgT2E Editable System Details

  * Step 6 - MgT2E Engine Wiring (like Phase 0.90 same pattern, larger field set; T5 socio carry-over already handled)

### Phase 0.9.4: Configurable System Details
  * Step 7 - Add/delete stars, worlds, and satellites
    

