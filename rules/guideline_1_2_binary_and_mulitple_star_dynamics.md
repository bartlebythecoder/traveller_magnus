# Binary and Multiple Star Dynamics (Topic 1.2)

## 1. Classic Traveller (Book 6) Logic
* **Workflow**: Companion stars place specific mathematical restrictions on the available planetary orbits around the primary star.
* **Inner Rule**: Orbits closer to the primary star can be numbered no higher than half of the companion's orbit number, rounding fractions down.
* **Outer Rule**: Orbits farther away from the primary star must be numbered at least two greater than the companion's orbit number.

## 2. Mongoose 2nd Edition (WBH) Logic
* **Workflow**: Defines an "unavailability zone" (exclusion zone) around secondary stars where planets cannot form.
* **Base Exclusion**: Any orbits within ±1.00 Orbit# of a Close, Near, or Far secondary star are unavailable to the primary star.
* **MAO Expansion**: If the secondary star has a Minimum Allowable Orbit (MAO) > 0.2, its MAO value is added to the exclusion zone.
* **Eccentricity Expansion (Tier 1)**: If the secondary star has an orbital eccentricity > 0.2, the unavailability zone expands by one additional Orbit# on either side.
* **Eccentricity Expansion (Tier 2)**: If a Close or Near secondary star has an eccentricity > 0.5, the zone expands by yet another Orbit# on either side.

## 3. Traveller 5 (T5) Logic
* **Workflow**: Restricts the capacity of secondary stars (Close, Near, and Far) to host independent planetary subsystems.
* **Subsystem Limit**: Secondary stars can only have planets in orbits around themselves up to their own Orbit number minus 3.
* **Stellar Engulfment**: Large stars physically occupy and destroy planetary orbits based on their physical diameter.
* **Data Reference**: Specific destruction zones are defined in **Orbital Distance Chart 5a**.

## 4. RTT Engine Logic
* **Workflow**: Uses specific "Companion Interference" triggers to zero out world counts in specific zones, but this interference is strictly asymmetrical.
* **Inner/Outer Elimination**: A "Close" companion zeroes out the Inner Zone. A "Moderate" companion zeroes out the Outer Zone.
* **Epistellar Exception (RAW)**: A "Tight" companion **does not** eliminate the Epistellar Zone (circumbinary planets are permitted). The Epistellar zone is only zeroed out by the nature of the *Primary* star (if it is Type III, D, or L).