# Atmospheric Chemistry and the ppo Loopback (Topic 2.2)

## 1. Classic Traveller (Book 6) Logic
* **Retention Workflow**: Atmosphere is directly tied to World Size and distance from the star (2D - 7 + Size).

* **Hard Constraints**:

    * If Size = 0 or S, Atmosphere is automatically 0.
    * Inner Zone worlds receive a -2 DM to retention.
    * Outer Zone worlds receive a -4 DM to retention.

* **Deep Outer Exception**: For worlds at least 2 orbits beyond the Habitable Zone, make an independent 2D roll. On exactly 12, the world bypasses standard retention and automatically becomes Atmosphere A (Exotic).

* **Data Reference**: Atmosphere Table (Maps 0-C digits to equipment requirements).

## 2. Mongoose 2nd Edition (WBH) Logic
* **Pressure Formula**: Total Pressure (bar) = `MinRange + (Span * RandomFraction)`. This is a flat, linear variance, not a bell curve.
* **The ppo Loopback (Oxygen)**: 
    * **Breathable Window**: Partial pressure of oxygen must be between 0.1 and 0.5 bar.
    * **Auto-Taint Override**: If a world is rolled as Breathable (5, 6, 8) but the ppo falls outside the 0.1–0.5 range, the code overrides the Atmosphere to its Tainted equivalent (4, 7, 9).
* **The ppN2 Hazard (Nitrogen)**: Nitrogen Narcosis (ppN2 > 2.0 bar) is an environmental depth hazard, **not** a forced UWP override.
* **Data Reference**: All tables (Atmosphere Codes, Taint Subtypes, Taint Severity) must be housed in the Data Shield.

## 3. Traveller 5 (T5) Logic
* **Hazard-First Logic**: T5 ignores specific chemical formulas in favor of "Hazard Effects."
* **Mechanical Mapping**: UWP digits map to specific damage scales:
    * **Atmosphere A**: Exotic (Poison-1).
    * **Atmosphere B**: Corrosive (Corrode-1, Poison-1).
* **Generation Workflow**: Atmosphere is generated strictly via the RAW T5 formula: `Size + Flux` (modified by specific World Type constraints).
* **Scope Constraint**: This application generates physical/demographic UWP profiles. It explicitly **does not** track T5 Hazard Effects (Damage/Minute) or Survival Gear mappings. Do not build data tables for these elements.
* **Data Reference**: **Atmosphere Types Table** (Maps UWP to Hazard/Minute and Survival Gear).

## 4. RTT Engine Logic
* **Environmental Destruction**: Does not use a dynamic "Gas Escape" formula.
* **The Boiled-Away Rule**: If the primary star is Type III (Giant) or D (White Dwarf), the first 1d6 orbits are scorched and dead. Affected Terrestrial, Helian, and Jovian bodies (Acheronian, Asphodelian, Chthonian) are reduced to Atmosphere 1 (Trace), while affected Dwarf bodies (Stygian) are completely stripped to Atmosphere 0 (Vacuum).
* **World Type Inheritance**: Atmosphere is fixed based on the World Class (e.g., Telluric = C, Chthonian = 1).
* **Data Reference**: **World Generation Tables** (Logic trees for fixed atmosphere assignments).