# Orbital Zone Mechanics and HZCO Deviation (Topic 1.3)

## 1. Classic Traveller (Book 6) Logic
* **Habitable Zone Baseline**: Calculated based on a world albedo of 0.3 and a greenhouse effect of 10% (Terran standard).
* **Mainworld Placement**: 
    * If a mainworld is pre-defined, it should be placed in the habitable zone.
    * **Exception**: Mainworlds with Atmosphere 1- (Trace/Vacuum) or A+ (Exotic/High Pressure) are NOT required to be in the habitable zone.
* **Climate Deviation**: If calculations for greenhouse effect or albedo shift a world's temperature, the referee/generator may place the world in an orbit outside the standard habitable zone.
* **Top-Down HZ Displacement (The Climate Deviation Exception)**: 
    * If a pre-defined Mainworld requires the Habitable Zone (e.g., Atm 4-9), but the HZ orbit is destroyed by a companion star's orbital exclusion zone, **do not** re-roll the star system or force the orbit to survive. Gravity wins.
    * **Displacement**: The engine must displace the Mainworld to the closest surviving orbit (Inner or Outer).
    * **Audit & Logging**: The engine must explicitly flag this event in the Trace Logs as a **"Climate Deviation Exception"**. This justifies the world maintaining a temperate atmosphere outside the HZ strictly through extreme Greenhouse effects (if Outer) or extreme Albedo effects (if Inner), perfectly satisfying RAW without triggering Auditor failures.
* **Data References**: 
    * **TABLE OF ZONES**: Cross-references Star Type/Size to identify "Inner," "Habitable," and "Outer" slots.
    * **HABITABLE ZONE DISTANCE**: Provides optimum AU distance for a 15°C average temperature.

## 2. Mongoose 2nd Edition (WBH) Logic
* **HZCO Formula**: The Habitable Zone Center Orbit (HZCO) is mathematically defined as the **Square Root of Stellar Luminosity** ($\sqrt{L}$).
* **Baseline Orbit Deviation**: The ideal orbit for a world shifts based on its Atmosphere code.
* **The Greenhouse Shift**: Modifiers (DMs) from Atmosphere codes (especially 10-15) Skew surface temperature, requiring the world to be moved inward or outward to maintain temperate conditions.
* **Top-Down Reverse Engineering**: For a pre-existing UWP, the generator must reverse-engineer the "raw temperature roll" by removing atmosphere DMs to find the system's true "Baseline Orbit."
* **Top-Down Lunar Mainworld (The Pre-Allocation Rule)**:
    * **Constraint**: If a Top-Down Mainworld is pre-defined as a moon (Trade Code 'Sa' or `isPreMoon == true`), it MUST NOT rely on random orbital collision for capture.
    * **Pre-Allocation**: Before the random placement loop (Step 8), the engine must consume one available Gas Giant (or a large terrestrial world if no GGs exist) and hard-code it into the Baseline Orbit slot with the Mainworld.
    * **Random Capture (Standard)**: If the Mainworld is NOT pre-defined as a moon, its capture depends entirely on the blind random roll of Gas Giant placement. A low capture rate (~5-8%) is RAW-compliant behavior.
    * **Audit & Logging**: The engine must explicitly flag the "Pre-Allocation Intercept" in the Trace Logs to differentiate it from a standard "Random Absorption Exception."
* **Data References**: 
    * **Habitable Zone Regions Table**: Maps the reverse-engineered roll to a positive or negative Orbit# modifier.

## 3. Traveller 5 (T5) Logic
* **Orbital Labeling**: 
    * **Inner**: Orbit $\le$ (HZ - 2).
    * **Hospitable**: Orbit (HZ - 1) to (HZ + 1).
    * **Outer**: Orbit $\ge$ (HZ + 2).
* **Twilight Zones (Tz)**: Any planet in Orbit 0 or Orbit 1 is tidally locked. Even if the math places it in the HZ, hospitable conditions are * **Top-Down Lunar Mainworlds (The Continuation Method)**:
    * **The Lunar Trigger**: A predefined Top-Down Mainworld is definitively identified as a moon if its UWP Trade Classifications contain **'Sa'** (Satellite) or **'Lk'** (Locked Satellite). The engine must use these codes (or an explicit `isPreMoon` flag) to trigger the intercept, rather than relying on localized string matching (e.g., checking if the physical `worldType` equals "Satellite").
    * **Inventory Pre-Requisite**: The engine must generate the system's total inventory (Gas Giants and Belts) *before* attempting to place the Mainworld Anchor. 
    * **Parent Allocation & Consumption**: 
        * **Standard Capture**: If the generated Gas Giant inventory is > 0, the engine must consume exactly 1 Gas Giant from the pool to serve as the Mainworld's parent.
        * **The BigWorld Exception**: If the generated Gas Giant inventory is 0, the engine does not deduct from the inventory. Instead, it generates a "free" BigWorld (Size = 2D+7) to serve as the parent body.
    * **Spatial Hierarchy & Sub-Orbits**: The injected parent body (Gas Giant or BigWorld) physically claims the target integer orbit (e.g., Orbit 4). The Mainworld is then placed as a satellite orbiting that parent at a specific lettered sub-orbit (Ay through Zee, typically determined by a Flux roll).restricted to a narrow "Twilight Zone."

* **Data Reference**: **HZ HABITABLE ZONE ORBITS Matrix**.

## 4. RTT Engine Logic
* **Zone Definition**: Zones are defined by a generated **quantity** of orbital slots rather than absolute distances.
* **Default Counts**: 
    * **Epistellar**: 1d6-3 (Max 2).
    * **Inner**: 1d6-1.
    * **Outer**: 1d6-1.
* **Companion Interference**: 
    * Close Companions reduce Inner Zone counts to 0.
    * Moderate Companions reduce Outer Zone counts to 0.
* **Stellar Expansion**: For Star Types III (Giants) or D (White Dwarfs), the first 1d6 orbits are considered "affected by expansion" (destroyed or transformed).