# Stellar Life-Cycles and Classification (Topic 1.1)

### **Project Architectural Standards (The Sean Protocol)**
* **Data Shield**: All stellar logic must reference declarative data structures (e.g., `ct_data.js`, `mgt2e_data.js`) to ensure zero "magic numbers" exist in the execution code.
* **Trace Logging**: Every dice roll, applied DM, and automated correction must be explicitly logged to the trace output via `tResult` and `tDM`.
* **100D Limit**: Every generated star and planetary body must calculate and log its 100-Diameter jump limit in Millions of kilometers.

### **Stellar Generation Modes**
* **Bottom-Up (Unbiased)**: A pure procedural generation path. All astrophysical constraints and random rolls are applied strictly to create a naturalistic distribution.
* **Top-Down (Anchored)**: A biased generation path used to accommodate a pre-defined "Gospel Mainworld".
    * **Habitable Zone (HZ) Forcing**: The engine may re-roll or force the primary star to Size V (Main Sequence) to ensure a stable HZ exists for the Mainworld, unless the Mainworld is an exception (Size 0, Atmosphere 0, 1, or A+).
    * **Manual Overrides**: If a `homestar` string is provided, the engine must parse the manual classification and suspend random generation for those specific stars.

---

## 1. Classic Traveller (Book 6) Logic
* **System Nature**: Determined via the 'Basic Nature' column to establish the count and primary/companion relationship.
* **Spectral Availability**: Types O and B are restricted and require Referee intervention/DMs.
* **Size Constraint (IV)**: Forbidden for Spectral Types K5 through M9. If indicated, the engine **must** default to Size V.
* **Size Constraint (VI)**: Forbidden for Spectral Types B0 through F4. If indicated, the engine **must** default to Size V.
* **Companion Inheritance (Recursive)**: Companion type and size rolls are modified by the results of the parent star (DM +Parent Roll). This applies to all levels of hierarchy, including Far Sub-Companions.
* **Internal Orbit Exception**: If a companion's orbital roll places it within the physical radius of the primary star (indicated by a '-' in the Zone Table), the orbit must be defaulted to "Close".

---

## 2. RTT Engine Logic
* **System Age**: $3D6 - 3$ Gyr.
* **Spectral Shift (Aging)**: Stars shift luminosity class or spectral type based on fixed age thresholds:
    * **A-Type**: Shifts to IV/III/D at Age 3; becomes D (White Dwarf) at Age 4+.
    * **F-Type**: Shifts to IV/III at Age 6; becomes D at Age 7+.
    * **G-Type**: Shifts to IV/III at Age 12; becomes D at Age 14+.
* **M-Type Evolution Exception**: M-Type stars ignore the System Age for evolutionary shifts. Instead, they use a decoupled 2D6 roll (DM +2 if a companion star is present):
    * **2–9**: Remains standard M-V.
    * **10–12**: Becomes M-Ve (Flare Star).
    * **13+**: Evolves into L-Type (Brown Dwarf).

---

## 3. Mongoose 2nd Edition (WBH) Logic
* **Determination Order**: Luminosity Class (Ia–D) is rolled FIRST, then Age is calculated to fit that class using the "Sum of Phases" reverse-evolution math.
* **Class V Age**: Must be a fraction of MS Lifespan ($10 / \text{Mass}^{2.5}$). 
    * If Mass >= 0.9: Age = Lifespan * `((1D - 1 + d10/10) / 6)`.
* **Post-MS Age (III/IV)**: Total Age = MS Lifespan + (Current Phase Lifespan * Phase Variance).
* **Spectral Smoothing**: The numerical subtype (1-9) dictates a linear interpolation of Mass, Temperature, and Diameter, drifting toward the baseline stats of the next cooler spectral class. 
* **White Dwarfs (Class D)**: 
    * No UWP. Treated purely as stars.
    * Diameter = $(1 / \text{Mass}) \times 0.01$ Solar.
    * Temperature/Luminosity: Derived dynamically from "Dead Age" (System Age - Progenitor Lifespan) via the Cooling Table, then adjusted by (Actual Mass / 0.6).

---

## 4. Traveller 5 (T5) Logic
* **HZ Anchor**: The Habitable Zone (HZ) orbit is a fixed index derived from the Spectral Type and Size Class.
* **Spectral Decimal**: Calculated via a 1D10 roll (0–9) to provide sub-type granularity.
* **Data Reference**: **HABITABLE ZONE ORBITS Table**.