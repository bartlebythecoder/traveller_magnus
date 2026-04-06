# PROJECT AS ABOVE, SO BELOW - Feature Manifest

**Evergreen Context:** This is an ongoing, long-term project for a **Multi-Engine Traveller RPG Generator and Mapping Tool**. The system is designed to support and audit procedural generation across various Traveller rulesets (e.g., MgT2E, CT, T5, CE) using a unified architectural framework.

**Version:** 0.6.0.0  
**Target:** Auditor Logic Alignment, Failure Persistence, & Multi-Engine Diagnostic Logging  
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
To eliminate logical drift across multiple RPG engines and ensure human-readable transparency in generation output. This version centralizes cross-engine "laws" into Markdown guidelines, upgrades the Auditor to handle multi-engine environmental checks, and refactors Trace Logging into a standardized, planet-by-planet hierarchy to resolve "suspicious results".

## 2. Architectural Pillars (The "Sean Protocol")
* **Directives Layer:** Rule-specific Markdown files (e.g., `rules/mgt2e_logic.md`, `rules/ct_logic.md`) act as the "Source of Truth" for AI agents.
* **Data Shield:** Centralized tables for environmental Tech Level minimums and asset paths, partitioned by engine type.
* **Math Chassis:** Universal logic for survival floors and "Dead World" reclassification that applies across engine boundaries.
* **Trace Logging:** A standardized, object-oriented reporting framework that prioritizes human-readability.

## 3. Implementation Plan (v0.6.0.0)

### Phase 6: Multi-Engine Audit & Diagnostic Sweep
* **Action 6.1 (Directive Documentation):** Populate the `rules/` directory with Markdown guidelines for all active engines. These files enable agents to compare code execution against specific RPG rulesets (e.g., WBH vs. Classic).
* **Action 6.2 (Multi-Engine Auditor Refactor):** Align the Auditor to detect which engine is active and pull the correct environmental TL lookups from the Data Shield. It must [PASS] results that meet engine-specific survival requirements even if they violate generic guidelines.
* **Action 6.3 (Reporting & Backlog Persistence):** Implement a global `window.auditBacklog`. Every audit failure must be pushed here with its **HexID**, **OrbitID**, and **Engine Source** to track "suspicious results" across different rulesets.
* **Action 6.4 (Hierarchical Planet-by-Planet Logging):**
    * **Object-Centricity:** Refactor all logging (Stellar, World, Socio) to group all data by **Planet/Body**. Users should see the full physical and social "biography" of a world in one section rather than seeing stats grouped by generation phase.
    * **Standardization:** Harmonize the `tSection` and `tResult` usage across all engines to ensure identical detail levels and human-readability.
    * **Source Labeling:** Every `tResult` must explicitly label the logic source (e.g., "WBH Requirement," "CT Baseline," or "Physics Floor").
* **Action 6.5 (Diagnostic Sweep):** Use the new Planet-Centric Logs and Auditor Backlog to identify, isolate, and resolve the two specific groups of "suspicious results" currently appearing in multi-engine output.