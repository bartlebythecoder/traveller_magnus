# Composition, Density, and Gravitational Scaling (Topic 2.1)

## 1. Classic Traveller (Book 6) Logic
* **Density Workflow**: Density is treated as a fixed physical constant ($K$) based on the body's category. 
* **Constants**: $K = 1.0$ (Terra-standard); $K \approx 0.2$ (Gas Giants).
* **Mass Formula**: $M = 4.188 \cdot K \cdot (R/8)^3$, where $R$ is the World Size UPP digit.
* **Gravity Formula**: $G = M \cdot (64/R^2)$.
* **Data Reference**: **WORLD DATA Table** (Baseline Volume, Mass, and Gravity for Earth-density worlds).
* **The "4.188" Math Anomaly:** Do NOT use the $4.188$ volume multiplier when calculating relative mass; it is a known legacy typo in the original text that improperly blends absolute geometric volume ($\frac{4}{3}\pi$) with relative ratios.
* **Density Workflow ($K$):** RAW only provides two density constants: $K = 1.0$ (Terra/Standard) and $K = 0.2$ (Gas Giants). Do not invent constants for ice, rock, or other types. Enforce $K = 1.0$ universally for all terrestrial bodies.
* **Mass Formula:** $M = K \cdot (R/8)^3$, where $R$ is the World Size UPP digit.
* **Gravity Formula:** $G = M \cdot (64/R^2)$. Note: Because standard terrestrial $K$ is always 1.0, this mathematically simplifies to exactly $G = \text{Size} \cdot 0.125$.
* **Composition Narratives:**  Do not invent a geological matrix for standard planets. Apply RAW descriptions only where explicitly defined

## 2. Mongoose 2nd Edition (WBH) Logic
* **Composition Workflow**: A two-step process determining structure (Core) then specific density.
* **Orbital Modifiers**: 
    * **HZCO or Closer**: $DM +1$.
    * **Beyond HZCO**: $DM -1$ (Base) AND $DM -1$ per full Orbit# beyond HZCO.
* **Core Types**: Exotic Ice, Mostly Ice, Mostly Rock, Rock and Metal, Mostly Metal, Compressed Metal.
* **Gravity Formula**: $G = \text{Density} \cdot (\text{UWP Size} / 8)$.
* **Mass Formula**: $M = \text{Density} \cdot (\text{Diameter} / \text{Diameter}_{\text{Terra}})^3$.
* **Data References**: 
    * **Terrestrial Composition Table**: Maps 2D roll (modified by Age/Orbit) to Core Type.
    * **Terrestrial Density Table**: Assigns decimal density multiplier to Core Type.

## 3. Traveller 5 (T5) Logic
* **Standard Mapping**: Size UPP digit maps directly to surface gravity for average density worlds.
* **Density Variance**: Gravity is scaled linearly with density (e.g., Size 5 with 1.1 Density = 1.0 G).
* **Default Density**: T5 strictly assumes a baseline "Density similar to Terra" (1.0) for all procedural generation.Gravity Scaling: Surface gravity (G) scales linearly at exactly 0.125 G per Size class (e.g., Size 8 = 1.0 G, Size 10 = 1.25 G).
* **Mass Calculation**: Because density is 1.0, Mass is equivalent to Volume in Earths. Use the formula: $Mass = (Size / 8)^3$.
* **Composition**: T5 does not provide a procedural generator for geological core compositions; therefore, the composition string should be set to null to avoid inventing non-RAW data.
* **Data References**: 
    * **Revised Planetary Profile Codes**: Baseline Diameter/G-force for Size 1–20.
    * **WORLD MAP DIMENSION DETAILS**: Volume/Surface Area tables for Size 1–18.

## 4. RTT Engine Logic
* **Branching Logic**: Bypasses density/mass math in favor of "World Classes" based on Orbital Zone.
* **World Classes**: Acheronian, Arean, Promethean, Jovian, etc.
* **Constraint**: Once a Class is assigned, Size and Atmosphere are pulled from Class-specific dice ranges (e.g., Acheronian Size is always $1D6+4$).
* **Strict Math Bypass:** The RTT ruleset explicitly skips complex density and mass math in favor of "World Classes" based on Orbital Zone.
* **Data Shield Nullification:** For terrestrial bodies, explicitly assign body.mass = null and body.density = null to inform the Universal Data Shield that these metrics are intentionally bypassed.
* **Gravity & Diameter Workflow:** Surface gravity and diameter are determined strictly via a hardcoded table mapping based on the generated UWP Size code
* **Data Reference**: **World Generation Tables** (Logic trees for Class assignment).