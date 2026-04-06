# Gas Giant and Belt Morphology (Topic 4.2)

## 1. Classic Traveller (Book 6) Logic
* **Placement Priority**: Gas Giants are placed first, followed by Planetoid Belts.
* **Quantity Constraint**: 
    * Gas Giants cannot exceed the number of available, non-empty orbits in the Habitable and Outer zones.
    * **Zero Orbit Exception**: If the table calls for a Gas Giant but 0 orbits exist in the system, exactly 1 Gas Giant orbit is created in the outer zone.
* **Size Classification**: Large (Roll 1-3 on 1D); Small (Roll 4-6 on 1D).
* **Belt Suppression**: Each Gas Giant applies a cumulative **-1 DM** to both the Planetoid Belt *Presence* roll and the Planetoid Belt *Quantity* roll. Belts cannot exceed the number of orbits remaining after Gas Giants are placed.

## 2. Mongoose 2nd Edition (WBH) Logic
* **Size Categories**: Replaces "Small/Large" with a three-tier system:
    * **Small (Neptune-class)**: Diam `D3+D3`, Mass `5*(1D+1)`.
    * **Medium (Jupiter-class)**: Diam `1D+6`, Mass `20*(3D-1)`.
    * **Large (Superjovian-class)**: Diam `2D+6`, Mass `D3*50*(3D+4)`. 
        * *Cap Rule*: If initial mass $\ge$ 3000, apply the mass cap: `4000 - ((2D-2)*200)`.
* **Thermal Composition (The Belt Rule)**: Belt makeup is strictly tied to the **HZCO (Habitable Zone Centre Orbit)**:
    * **Inner (Orbit < HZCO)**: Apply DM -4 (Icy bodies sublimate away).
    * **Middle (HZCO to HZCO+2)**: Apply DM +0.
    * **Outer (Orbit > HZCO+2)**: Apply DM +4 (Carbonaceous/Icy bodies predominate).
* **Data Reference**: **Gas Giant Sizing Table** and **Belt Composition Percentages Table**.

## 3. Traveller 5 (T5) Logic
* **The BigWorld Protocol**: If the Mainworld is a Satellite but the system lacks a Gas Giant, the engine **must** create a **BigWorld** (Size 2D+7) to act as the gravitational anchor.
* **Belt Profiles**: Hardcoded to **Size 0**. 
* **Fixed Strings**: All Planetoids are assigned the default string `St000PGL-T`, forcing Atmosphere and Hydrographics to 0 regardless of other rolls.

## 4. RTT Engine Logic
* **Classification**: Distinguishes between **Helian Planets** (Helium-retention subgiants) and **Jovian Planets** (Hydrogen-Helium giants with internal heat).
* **Slot-Based Generation**: Does not use a "Frost Line." Instead, each orbit has a 1D6 probability roll to determine content:
    * **0-1**: Asteroid Belt
    * **2**: Dwarf Planet
    * **3**: Terrestrial Planet
    * **4**: Helian Planet
    * **5-6**: Jovian Planet