# Technology Level and Environmental Caps (Topic 3.2)

## 1. Classic Traveller (Book 6) Logic
* **TL Formula**: $1D + \text{Modifiers}$.
* **Dependencies**: Starport, Size, Atmosphere, Hydrographics, Population, and Government.
* **Data Reference**: **TECH LEVEL TABLE** (The primary matrix for all TL DMs; the engine must pull from `CT_CONSTANTS.TECH_LEVEL_MODIFIERS`, not hardcode the logic).
* **The "Survival Floor" (Subordinates ONLY)**: 
    * **Mainworlds**: Have NO survival floor. They strictly use the generated TL, even if it results in TL 0 on a hostile world.
    * **Subordinate Worlds**: If a subordinate world has an atmosphere other than 5, 6, or 8, and its generated TL is less than 7, its TL is automatically bumped to **7** to represent the minimum technology required to maintain habitats.

## 2. Mongoose 2nd Edition (WBH) Logic
* **The TL Baseline**: Generated via $1D + \text{Modifiers}$ (High Common TL). The engine **MUST NOT** clamp or bump this base UWP TL to meet environmental floors.
* **The "Jury-Rigged" Survival Mechanism**: 
    * If a world's generated TL is below the environmental minimum for its atmosphere, the world survives using relic or prototype technology.
    * The UWP TL remains as rolled (low).
    * The **Novelty TL (N)** in the Extended Tech Profile acts as the safety net. It must be generated at either the exact environmental minimum, or up to 2 levels below it (representing failing prototypes).
    * The world should be flagged in traces as "Jury-Rigged / Economically Unviable".
* **Secondary World Failure State (Ruin)**: A subordinate world cannot rely on jury-rigged safety nets if the environmental minimum is strictly greater than the **Mainworld's TL**. In this case, the colony fails entirely and is classified as an uninhabited Ruin (Pop 0, Gov 0, Law 0, TL 0).
* **Data Reference**: **Tech Level and Environment Table** (Defines the `minSusTL`).

## 3. Traveller 5 (T5) Logic
* **TL Formula**: Standard $1D + \text{Modifiers}$ calculation.
* **The "No-Floor" Rule**: Unlike Mongoose, T5 does not force a minimum TL based on hazards. Hazards (Corrode, Poison) are applied mechanically regardless of TL.
* **Stage Logic**: Note that "Stage" in T5 refers to equipment life cycles, not the planetary Tech Level itself.
* **Flux Independence**: The TL roll does not interact with the Importance (Ix) extension.

## 4. RTT Engine Logic
* **The Fixed Baseline**: Tech Level is typically fixed to the `dominantTL` of the sector (representing the overarching civilization, e.g., the Imperium). 
* **Standard Era Survival (No Floor)**: Because the engine simulates an interconnected galaxy (and explicitly NOT a "Hard Times/Long Night" scenario), there are no absolute local Industry floors for survival. Even on extremely hostile worlds (e.g., Atmosphere B or D), populations survive via galactic trade and imported technology.
* **Industry Interactions**: Instead of acting as a survival cull, local Industry dynamically impacts population growth and terraforming/pollution events (e.g., high Industry can pollute or clear atmospheres).