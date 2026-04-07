# Statistical Validation and Sector Auditing (Topic 5.1)

### **Project Architectural Standards (The Sean Protocol)**
* **Data Shield (Expectations)**: All target percentages and statistical distributions must be referenced from a declarative **Expectation Table** (e.g., `expectations_data.js`). Agents must never hardcode target percentages or tolerances directly into the execution scripts.
* **Memory-Resident Tally**: To ensure speed and accuracy, the system must maintain a running tally (e.g., a `sectorStatistics` object) in memory during the generation phase. The system must **never** scrape or parse the generated text logs to calculate totals.
* **The Statistical Footer**: Every sector generation run must conclude by appending a standardized Deviation Report to the trace log, explicitly flagging metrics with `[PASS]` or `[STATISTICAL WARNING]` based on predefined tolerances.

---

## 1. The Expectation Table (Data Schema)
Before validation can occur, the Orchestration layer must load the correct Expectation Table from the Data Shield based on the active engine (MgT2E, CT, T5, CE). 

The table must define the following for each tracked metric:
* **Target Percentage**: The mathematically expected outcome (e.g., Binary Systems: 33%).
* **Tolerance/Variance**: The acceptable +/- deviation before triggering a warning (e.g., 5%).

**Core Metrics to Track:**
* **System Typology**: Solo, Binary, Trinary, and Complex system distribution.
* **World Ecology**: Frequency of Garden Worlds, Desert Worlds, Asteroid Belts, and "Dead Worlds" (as reclassified by the Math Chassis).
* **Socio-Economic Caps**: Validation of Tech Level ceilings (e.g., verifying T5 reaches appropriate maximums) and Population concentrations.

---

## 2. Orchestration Layer (The Running Tally)
* **Initialization**: At the start of a sector or subsector generation, the agent must initialize empty counters within a `sectorStatistics` state object.
* **The Biography Pass**: As the engine completes the Planet-Centric generation for an individual body, it must immediately increment the relevant tally counters based on the final, audited `tResult` values.
* **Persistence**: This tally must remain active across the entire generation loop until the final hex is resolved.

---

## 3. The Deviation Report (Trace Logging & Console Output)
Once generation is complete, the agent must calculate the final **Actual Percentages** by comparing the running tally against the total number of systems/worlds generated.

**Console Output (Immediate Feedback):**
* In addition to writing to the log file, the engine must print a summary of the Deviation Report directly to the terminal/console.
* Any metric that fails must trigger a standard `console.warn` or equivalent alert so the user is immediately notified of statistical drift without opening the log file.

**Trace Log Footer:**
The agent must append a Markdown table to the end of the trace log with the following columns:
* **Metric**: The data point being tracked (e.g., "Garden Worlds").
* **Actual**: The generated result percentage.
* **Expected**: The target percentage pulled from the Data Shield.
* **Deviation**: The calculated difference (e.g., "+4.2%" or "-1.5%").
* **Status**: 
    * `[PASS]`: If the Deviation falls within the acceptable Tolerance.
    * `[STATISTICAL WARNING]`: If the Deviation exceeds the acceptable Tolerance.