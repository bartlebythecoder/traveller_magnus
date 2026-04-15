# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.8
**Target:** Advanced Fitering Options
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
An easy to use Traveller/Cepheus system builder and navigator
For this version: editing system stats

## 2. Architectural Pillars 
* **Directives Layer:** 18 SOPs total. *New:* `directives/statistical_validation_sop.md`.
* **Data Shield:** Centralized tables for engine rules and the new **Expectation Table**.
* **Math Chassis:** Universal logic for survival floors, now strictly table-driven to eliminate logic drift.
* **Trace Logging:** Planet-Centric biographies with a final **Statistical Deviation Report** footer.

## 3. Implementation Plan (v0.9)

### Phase 0.9.0: Political Mapping & Referee Utility (Current)

  Phase 1 — Persistence Infrastructure (small, done once)
  - Define _manualFields as a plain array on body/star objects ([] by default)
  - Write three helper functions: markManual(body, field), isManual(body, field), clearManual(body, field)
  - Add re-expansion warning to the RTT UI handler: if any body in the system has _manualFields.length > 0, confirm before proceeding
  - Verify JSON roundtrip preserves _manualFields (should be automatic)

  Phase 2 — RTT Accordion: Inline Edit Mode
  - Add an Edit toggle button to the RTT system accordion header
  - When toggled on, renderRTTBody re-renders with <input>/<select> elements instead of <strong> display for all in-scope fields
  - Add event delegation listener on editor-rtt-system-root — on change, find body, write value, call markManual
  - Manual fields render in a distinct colour (both in edit mode and view mode)
  - Field-level inline editing of all non-UWP fields displayed in the RTT accordion (click-to-edit)
  - _manualFields persistence and override guards in the engine
  - Re-expansion warning when manual fields exist
  - Visual highlight for manually-set fields

    Deferred to v0.10 (or later):
    - Add/delete orbits and satellites
    - sys._manualStructure flag (no longer needed this version
    - Add Add World / Delete World buttons in edit mode (structural edit, sets sys._manualStructure = true)

  Phase 3 — RTT Engine: Override Guards
  - Create expandRTTBiographerOnly(sys) — new entry point that runs only generateRTTSectorBiographer on an existing sys (no Step 1–3 regeneration)
  - Add isManual guards inside processRTTPhysicalStatsPartA, processRTTPhysicalStatsPartB, processRTTDerivedPhysics, and processRTTSocialStats — before each field write, check if (isManual(body, 'fieldName')) return
  - Wire expandRTTBiographerOnly into the UI so re-expansion uses it instead of generateRTTSectorStep1

  Phase 4 — CT Engine Wiring (same pattern, smaller field set)

  Phase 5 — MgT2E + T5 Engine Wiring (same pattern, larger field set; T5 socio carry-over already handled)



