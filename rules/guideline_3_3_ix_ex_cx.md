# Economic (Ex), Importance (Ix), and Cultural (Cx) Extensions (Topic 3.3)

## 1. Traveller 5 (T5) Logic
* **Importance (Ix)**: A ranking digit calculated by summing modifiers for Starport, Tech Level, Bases, and Trade Codes.
* **Economic (Ex)**: Measured in Resource Units (RU).
    * **Formula**: $RU = R \times L \times I \times E$ (Resources, Labor, Infrastructure, Efficiency).
    * **The "Zero" Rule**: If any factor (R, L, or I) is 0, use 1.
    * **The Efficiency Variable**: $E = \text{Flux}$. A negative Flux makes the total RU negative.
* **Cultural (Cx)**: A 4-digit hex string (HASS):
    * **Heterogeneity**: $Pop + \text{Flux}$.
    * **Acceptance**: $Pop + Ix$.
    * **Strangeness**: $\text{Flux} + 5$.
    * **Symbols**: $\text{Flux} + TL$.
* **Data Reference**: **IMPORTANCE EXTENSION Table** and **ECONOMIC EXTENSION Table**.

## 2. Mongoose 2nd Edition (WBH) Logic
* **Economic Formula**: Virtually identical to T5: $RU = R \times L \times I \times E$.
* **Efficiency Difference**: Calculated via $2D - 7$ or $2D3 - 4$ (Pop-dependent) rather than a simple Flux roll.
* **Cultural Extension**: Uses an 8-character string (DXUS-CPEM).
    * **HASS Mapping**: The first four digits (DXUS) correspond directly to T5's Cx (HASS) codes.
* **Data Reference**: **Gross World Product (GWP) per capita formula**.

## 3. RTT Engine Logic
* **Industry Override**: Bypasses Ex/Ix math in favor of an **Industry Level** ($2D - 7 + \text{Population} + \text{Atmosphere DMs}$).
* **The Retroactive Industry Bonus**: If a world generates a High Industry score ($A+$ / 10+), the local industrial base triggers a population boom.
    * **RAW Options**: The Referee may choose between Population +1 (No side effects) OR Population +2 (Causes atmospheric pollution/degradation).
    * **Project Scope Decision**: To prevent automated atmospheric degradation from retroactively invalidating earlier Habitation and Desirability checks, the engine strictly defaults to the **Population +1** option. A distribution setting for the +2 (Pollution) option is deferred to a future phase.
* **Desirability Cap**: Population generation for colonies is strictly capped by the **Desirability Score** ($+ 1D3 - 1D3$) *before* the retroactive Industry bonus is applied.

## 4. Classic Traveller Logic
* **Legacy State**: No formal mathematical extensions. 
* **Trade Classifications**: Socio-economic standing is strictly defined by the presence of core Trade Codes (Ag, In, Ri, etc.).