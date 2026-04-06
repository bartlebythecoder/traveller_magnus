# Thermal Models, Albedo, and Greenhouse Feedback (Topic 2.4)

## 1. Classic Traveller (Book 6) Logic
* **Thermal Baseline**: Derived from Terran constants: $K = 374.025$. 
* **Terran Standard**: Albedo of 0.3 and Greenhouse effect of 10% (1.1 multiplier).
* **The Ratio-Based Albedo**: Calculated by summing four components:
    * **Water**: Hydrographics percentage.
    * **Land**: 100% - Hydrographics.
    * **Snow/Ice**: Default 10% of Land surface.
    * **Clouds**: Determined via the **Cloudiness Table** (Atmosphere/Hydro dependent).
* **Greenhouse Logic**: A flat percentage increase applied to average temperature based on the Atmosphere Code.
* **Data Reference**: **Albedo Table** (Provides reflectivity constants for Forest, Desert, Water, etc.).

## 2. Mongoose 2nd Edition (WBH) Logic
* **The Thermal Formula**: Mean Temperature is a function of $\sqrt{\text{Luminosity}} / \text{Distance}^2$, modified by Albedo and Greenhouse.
* **Dynamic Greenhouse**: The factor is equal to $0.5 \cdot \sqrt{\text{Atmospheric Pressure (bar)}}$.
* **The Runaway Threshold**: Any world with Atmosphere 2-F and a mean temperature above **303 K** must be checked for Runaway Greenhouse.
* **Runaway Modifier**: Use $DM +1$ per full 10° above 303 K (replaces the boiling temperature DM).
* **Data Reference**: **Albedo Range Table** (Base albedo by world type: Rocky, Icy, Gas Giant).

## 3. Traveller 5 (T5) Logic
* **Zone-Locked Climate**: T5 uses a descriptive, orbit-based climate system that bypasses exact Kelvin, Albedo, and Greenhouse calculations.
* **Climate Scale (HZ Variance)**: Climate is determined by the world's orbital offset (Variance) from the Habitable Zone (HZ):
    * **HZ - 2 (or closer)**: Inferno (Too hot for routine occupation).
    * **HZ - 1**: Hot / Tropic (Assigns Trade Code: **Tr**).
    * **HZ 0**: Temperate (Standard human comfort range).
    * **HZ + 1**: Cold / Tundra (Assigns Trade Code: **Tu**).
    * **HZ + 2 (or farther)**: Frozen (Assigns Trade Code: **Fr**).
* **The Twilight Zone (Tz) Exception**: Regardless of HZ Variance, any world located in **Orbit 0 or Orbit 1** is tidally locked. These worlds are designated as **Twilight Zone (Tz)**, indicating hospitable conditions exist only in the narrow band between hemispheres.
    * **Satellite Sub-Exception**: Satellites (specifically Close Satellites) are exempt from the Twilight Zone rule; they are instead designated as **Locked (Lk)** to their parent body.
* **Hydrographics & Atmospheric Coupling**:
    * **Mainworld Coupling**: The Mainworld hydrographics roll receives a **DM -4** only if the Atmosphere is extreme (**Atm < 2 or Atm > 9**).
    * **Inner World Logic**: The blanket **DM -4** for "Inner World" hydrographics applies strictly to the generation of **Other Worlds** (non-mainworlds) in the system.
* **Trade Code Enforcement**:
    * **Desert (De)**: Strictly limited to Atmosphere codes **2 through 9** and Hydrographics **0**.
    * **Exotic Exclusion**: Atmospheres **A, B, C, and D** (Exotic, Corrosive, Insidious, and Dense High) are ineligible for the Desert (De) code.
* **Data Reference**: **Mainworld Orbit Table** and **Trade Classifications Table**.

## 4. RTT Engine Logic
* **Archetype Modeling**: Bypasses thermodynamic math in favor of narrative temperature states.
* **Meltballs**: Inner worlds driven by tidal flexing or stellar proximity.
* **Snowballs**: Outer worlds (mostly ice/rock) with potential cryo-volcanism.
* **Constraint**: Temperature is a descriptive property of the procedurally determined **World Class**.