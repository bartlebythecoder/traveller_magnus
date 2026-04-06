# Detailed Satellite Generation (Topic 4.3)

## 1. Classic Traveller (Book 6) Logic
* **Quantity Rolls**:
    * **Terrestrial (Size 1+)**: $1D - 3$.
    * **Small Gas Giant (SGG)**: $2D - 4$.
    * **Large Gas Giant (LGG)**: $2D$.
* **Size Scaling**: Satellite Size = $\text{Parent Size} - 1D$. 
    * **For LGG**: $2D - 4$.
    * **For SGG**: $2D - 6$.
    * **Result 0**: Ring (R). **Result < 0**: Small World (S).
* **Placement**: Thrown via the **Satellite Orbits Table** into Close, Far, or Extreme slots.

## 2. Mongoose 2nd Edition (WBH) Logic
* **The Hill Sphere Constraint**: Moons are placed using Planetary Diameters (PD) within the Roche Limit and Hill Sphere limits.
* **The Demotion Protocol (Critical)**: If a Mainworld's orbital slot is subsequently occupied by a Gas Giant, the Mainworld is demoted to a **Subordinate World** (Moon). An additional terrestrial world is then placed in the vacated slot.
* **Proximity Logic**: If two moons overlap, move the outer moon further or treat the smaller as a **Trojan Moon**.
* **Data Reference**: **Significant Moon Quantity Table** (Size-dependent quantity).

## 3. Traveller 5 (T5) Logic
* **The BigWorld Rule**: If a Mainworld is a Satellite but no Gas Giant exists in that orbit, the engine **must** generate a **BigWorld** (Size $-2D+7$) to act as its parent.
* **Satellite Indexing**: Moons are identified by an alphabetic sequence (Ay, Bee, Cee...) appended to the planetary orbit.
* **The Lk Tag**: "Close" satellites are automatically assigned the **Lk (Tidally Locked)** tag.

## 4. RTT Engine Logic
* **Class-Based Rolls**:
    * **Dwarf Planet**: Generates a binary companion strictly on a roll of **6** (1D6).
    * **Terrestrial Planet**: Generates a major satellite on a roll of **5 or 6** (1D6).
    * **Helian/Jovian**: Generates multiple satellites ($1D6-3$ or $1D6$).
* **Nesting Logic**: A Jovian planet's satellite array consists primarily of Dwarf planets, but on a Type Roll of 6, the first satellite is upgraded. A sub-roll of 1-5 makes it a **Terrestrial Planet**, and a 6 makes it a **Helian Planet**.