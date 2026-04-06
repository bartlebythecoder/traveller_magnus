# Orbital Allocation and Collision/Demotion (Topic 1.4)

## 1. Classic Traveller (Book 6) Logic
* **Placement Priority**: 1. Gas Giants -> 2. Planetoid Belts -> 3. Mainworld (Last).
* **Collision Protocol**: Random selection with equal probability. If a selected orbit is occupied or unavailable, **Roll Again**. There is no "sliding" or "bumping" to adjacent orbits.
* **Satellite Demotion**: If a pre-existing Mainworld is placed in an orbit already containing a Gas Giant, the Mainworld is automatically demoted to a Satellite of that Gas Giant.
* **HZ Displacement (The Digital Referee)**: If the target Habitable Zone orbit is destroyed by a companion star, the Mainworld is displaced to the numerically closest surviving orbit. However, the engine must never overwrite or vaporize a previously placed Planetoid Belt or Captured Planet. The displacement search must strictly target an **Empty** slot (becoming a standalone planet) or a **Gas Giant** slot (triggering Satellite Demotion).
* **UI State Sync**: Whenever a Mainworld is demoted to a satellite via collision or displacement, the engine must inject universal UI flags (`isLunarMainworld`, `parentBody`) to maintain cross-engine renderer parity.
* **Data Reference**: **Table of Zones** (Determines orbit legality).

## 2. Mongoose 2nd Edition (WBH) Logic
* **Placement Priority**: 1. Mainworld (Anchor) -> 2. Empty Orbits -> 3. Gas Giants -> 4. Planetoid Belts -> 5. Terrestrial Planets.
* **Collision Protocol (The Slide)**: If a slot is occupied, add +1 to the Orbit#. If the result exceeds the last available slot, wrap around to the first available empty slot in the system.
* **Satellite Exceptions**: 
    * Size 1 Mainworlds colliding with a Planetoid Belt become "Subordinate Worlds" within the belt.
    * Mainworlds colliding with Gas Giants become "Subordinate Worlds" (Satellites).
    * In both cases, the original orbit slot is considered "consumed," and the next item in priority moves to a new slot.

## 3. Traveller 5 (T5) Logic
* **Placement Priority**: 1. Mainworld -> 2. Gas Giants -> 3. Belts -> 4. Other Worlds.
* **Satellite Requirement**: If the Mainworld is generated as a Satellite, a Gas Giant (or BigWorld) **must** be placed in that same orbit to act as the parent.
* **Supply Constraint**: If the number of generated worlds exceeds available orbits, excess "Other Worlds" are discarded.
* **Data Reference**: **Orbital Distance Chart 5a** (Identifies precluded/engulfed orbits).

## 4. RTT Engine Logic
* **Placement Priority**: Sequential/Environmental. Orbits are filled from the star outward (Epistellar -> Inner -> Outer).
* **Collision Protocol**: N/A. Objects are generated directly into slots; two objects cannot be rolled for the same slot.
* **Mainworld Election**: Organic/Post-Generation. The "Mainworld" is not placed; it is "Elected" from the completed system based on a **World Desirability/Biosphere Score**.