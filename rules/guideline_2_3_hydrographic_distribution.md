# Hydrographic Distribution and Environmental Coupling (Topic 2.3)

## 1. Classic Traveller (Book 6) Logic
* **Hydrographic Formula**: $2D - 7 + \text{Size}$.
* **Zone Restrictions**:
    * **Inner Zone**: Automatically Hydro 0.
    * **Outer Zone**: $DM -2$.
* **Atmospheric Coupling**: If Atmosphere $\le 1$ or $\ge A$, apply $DM -4$.
* **Vacuum World Exception**: Hydro > 0 is permitted for Atmosphere 0, but represents **Ice-Caps** only; no free-standing liquid is allowed.
* **Satellite Logic**: Hydro = $2D - 7 + \text{SatSize}$.Inner Zone: Automatically Hydro 0.Outer Zone: $DM -2$.

## 2. Mongoose 2nd Edition (WBH) Logic
* **Hydrographic Formula**: $2D - 7 + \text{Atmosphere Code}$.
* **Physical Restrictions**: 
    * Size 0 or 1: Automatically Hydro 0.
    * Atmosphere 0, 1, or $\ge A$: Apply $DM -4$.
* **Thermal Coupling**:
    * **Hot World**: $DM -2$.
    * **Boiling World**: $DM -6$.
    * **Magma Clause**: If Temp $> 1,000$K, liquid may be Magma.
* **The Ice Distinction**: Permanently ice-covered *water* counts toward the Hydro percentage; permanently ice-covered *land* does not.
* **Exotic Liquids**: For non-temperate worlds, liquids are determined by the **Possible Exotic Liquids Table** (Methane, Ammonia, etc.).

## 3. Traveller 5 (T5) Logic
* **Zone Coupling**: Inner Worlds (starward of HZ) apply a strict **DM -4** to Hydrographics.
* **Trade Code Enforcement**:
    * **Desert (De)**: Mandatory for Atmos 2-D and Hydro 0.
    * **Ice-Capped (Ic)**: Mandatory for Atmos 0-1 and Hydro 1+.
* **Zone-Locked Climate**: Climate is a fixed tag based on the HZ Variance (orbital offset from Habitable Zone).
* **The Scale**:
    * **HZ-2 (or closer)**: Inferno (Too hot for routine occupation).
    * **HZ-1**: Hot / Tropic.
    * **HZ (0)**: Temperate.
    * **HZ+1**: Cold / Tundra.
    * **HZ+2 (or farther)**: Frozen.
* **Twilight Zone Exception**: If a world is in Orbit 0 or 1 (and thus HZ-2 or closer), it becomes a **Twilight Zone (Tz)** world instead of an Inferno.
    * *Satellite Sub-Exception*: Satellites (specifically Close Satellites) do not receive the Twilight Zone tag. They remain Infernos but are designated as Locked (Lk) to their parent planet.
* **Data Reference**: **Mainworld Orbit Table** (The definitive mapping for HZ Var to Climate tags).
* **Data Reference**: **Trade Codes Table** (couples Hyd/Atmos to specific environments).

## 4. RTT Engine Logic
* **Class-Based Fixed Results**: Hydrographics are determined by the procedurally selected World Class.
* **Telluric World**: $1D6$: 1-4 (Hydro 0); 5-6 (Hydro F/150%).
* **Oceanic World**: Automatically Hydro B (110%).
* **Boiled-Away Rule**: If the star is Type III or D, orbits in the expansion zone have Hydro boiled away (Hydro 0).