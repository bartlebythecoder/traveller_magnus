# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Target:** Advanced System Filtering, Route Toggles, & Batch Customization Persistence
**Architecture Standard:** The "Sean Protocol" (Strict Modular Separation, Comprehensive Trace Logging)

## 1. Project Goal
To integrate a comprehensive, debounced "Filter Window" that allows users to parse generated systems using 10+ data points (e.g., Starport, Tech Level) alongside global Route Toggles (Green, Red, Yellow). Additionally, introduce a Phase 2 "Filter-to-Action" customization suite to apply and save batch aesthetic changes (custom colors/styles) within the core JSON data structure.

## 2. Architectural Pillars (The "Sean Protocol")
* **Data Shield:** The source of truth for base system data and rules.
* **Math Chassis:** The isolated location for all raw filtering algorithms, numeric operators, and string parsing.
* **Core Engines:** All generation engines must be updated to handle the injection and mapping of user preference objects without duplicating logic.
* **Trace Logging:** Every filter loop and style update MUST be wrapped in the `tSection`, `tResult`, and `writeLogLine` framework.

## 3. Implementation Plan

### Phase 0: Investigation & State Decisions (Completed)
* **Behavior:** Use dynamic DOM manipulation (not full redraws).
* **Performance:** Implement a 300ms debounce on all filter inputs.
* **UI:** Implement a hotkey-toggled modal mirroring the existing CSS design system.
* **Selection Logic:** The filter window acts as a selection tool for defining the scope of batch-styling actions.

### Phase 1: Math Chassis Development
* **Action:** Identify the file serving as the Math Chassis. Implement a universal `applyFilters` function.
* **Logic:** Handle Route Toggles first, followed by numeric operators (`>`, `<`) and comma-separated inclusions.
* **Requirement:** Strictly apply Trace Logging to every calculation and conditional branch.

### Phase 2: UI & Engine Integration
* **Action:** Identify UI Orchestrator and CSS files. Build the Filter Modal using existing styles.
* **Action:** Map inputs to the Math Chassis logic using the 300ms debounce.
* **Visuals:** Position Route Toggles (Green, Red, Yellow) at the top of the modal hierarchy.

### Phase 3: Batch Customization & JSON Persistence
* **Action:** Expand UI to include a "Design/Appearance" tab for color pickers and styling.
* **Action:** Update Save/Load logic to package persistent aesthetic data (e.g., `custom_ui`) within the project JSON.
* **Execution:** Update initialization sequences to read saved preferences and override default paints on map load.