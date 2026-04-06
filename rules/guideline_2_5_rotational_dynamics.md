# Rotational Dynamics and Tidal Locking (Topic 2.5)

## 1. Classic Traveller (Book 6) Logic
* **Logic State**: Rotational dynamics (day length, tidal locking) are completely absent from the CT ruleset.
* **Audit Default**: Day length and rotational state are mathematically **undefined**. The engine must not apply a standard 24-hour baseline or roll any dice for rotation.
* **Tidal Locking**: Do not apply proximity rules (e.g., Orbit 0/1). Tidal locking mechanics do not exist in CT generation.
* **Constraint**: Determination of rotational period is strictly a narrative/Referee decision, identical to Book 6's handling of Axial Tilt and Orbital Eccentricity. No rotation tables should be added to the Data Shield.

## 2. Mongoose 2nd Edition (WBH) Logic
* **Sidereal vs. Solar Day**: 
    * **Formula**: $SolarDaysPerYear = (YearHours / SiderealHours) - 1$.
    * **Final Day Length**: $SolarDay (hours) = YearHours / SolarDaysPerYear$.
* **Retrograde Rule**: If Axial Tilt $> 90^\circ$, the Sidereal Day is treated as a **negative number** in all calculations.
* **Tidal Locking (2D Roll + DMs)**:
    * **2 or less**: No effect on day length.
    * **3 to 6**: Multiply day length by 1.5 (Roll 3), 2 (Roll 4), 3 (Roll 5), or 5 (Roll 6).
    * **7 to 8**: Prograde rotation. Day = 1D × 5 × 24 (Roll 7) or 1D × 20 × 24 (Roll 8).
    * **9 to 10**: Retrograde rotation. Day = 1D × 10 × 24 (Roll 9) or 1D × 50 × 24 (Roll 10). Axial tilt flipped if < 90° (180 - tilt).
    * **11**: 3:2 Resonance. 
    * **12+**: 1:1 Lock. 
* **Thermal Rotation Factor**: 
    * **Formula**: $Factor = \sqrt{|SolarDay (hours)| / 50}$.
    * **Constraint**: Do not artificially cap the raw output of this formula (allow factors > 1.0).
    * **Overrides**: Any solar day $> 2,500$ hours results in a fixed factor of 1.0. All worlds in a 1:1 tidal lock to their sun(s) also have a fixed factor of 1.0.
* **Data Reference**: **Tidal Lock Status Table** (Modifiers and Roll Outcomes must reside in `mgt2e_data.js`).

## 3. Traveller 5 (T5) Logic
* **Logic State (Standard)**: Standard day length is mathematically **undefined**. The engine must not apply a standard 24-hour baseline or roll any dice for rotation (Referee fiat).
* **The Orbit 0/1 Rule**: Any planet located in Orbit 0 or Orbit 1 is automatically **Tidally Locked** to the star. Day length equals orbital period.
* **Twilight Zone (Tz)**: Forced climate tag for Orbit 0/1 planets; represents narrow habitable bands between permanent day/night sides.
* **Satellite Locking (Lk)**: Satellites in a "Close" orbital slot are automatically **Tidally Locked** to their parent planet. Day length equals satellite orbital period.

## 4. RTT Engine Logic
* **Archetype Assignment**: Rotational states are a fixed property of the procedurally determined World Class.
* **Proximity Override (No T5 Bleed)**: The RTT World Class strictly overrides physical proximity. Planets generated in the Epistellar zone are **not** automatically tidally locked. The T5 Orbit 0/1 proximity rule must be completely ignored during RTT generation.
* **Tidally Locked Classes**:
    * **JaniLithic**: Automatically tide-locked; rocky, dry, and geologically active.
    * **Vesperian**: Automatically tide-locked; allows for surface liquids and life in the stable band.
* **Undefined Rotations**: All other World Classes (e.g., Telluric, Oceanic, Arean, Snowball) intentionally omit rotational physics. Their day length is mathematically **undefined** and left entirely to narrative interpretation. The engine must not apply a standard 24-hour baseline.
* **Constraint**: Day length is never rolled; it is solely a narrative consequence of the world’s physical type.