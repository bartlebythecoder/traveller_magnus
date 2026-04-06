# Population, Government, and Law Level (Topic 3.1)

## 1. Classic Traveller (Book 6) Logic
* **Mainworld Population Formula**: $2D - 2$. 
    * **Zone Modifiers**: Inner Zone: $DM -5$, Outer Zone: $DM -3$.
    * **Atmospheric Modifier**: If Atmosphere is NOT (0, 5, 6, or 8), apply $DM -2$.
    * **Satellite Modifier**: If the body is a satellite with Size $\le 4$, apply an additional $DM -2$.
* **Mainworld Social Drift**:
    * **Government**: $2D - 7 + \text{Population}$.
    * **Law Level**: $2D - 7 + \text{Government}$.
* **Subordinate Socials** (Requires Mainworld Reference):
    * **Government**: If Mainworld Gov is 6, Subordinate Gov = 6. Otherwise, roll $1D$ (apply $DM +2$ if Mainworld Gov $\ge 7$).
    * **Law Level**: $1D - 3 + \text{Mainworld Law Level}$.
* **Constraint**: All results are capped at a minimum of 0.

## 2. Mongoose 2nd Edition (WBH) Logic
* **Population Formula**: $2D - 2$. 
    * **Constraint**: Minimum 0. If Native Sophonts are present, minimum is 6.
    * **Strategic Modifiers**: Intentionally omitted at this scope level (no DMs for trade routes or frontier regions).
* **Social Drift**: Standard $2D - 7 + \text{Population}$ for Government, and $2D - 7 + \text{Government}$ for Law Level.
* **Balkanization (Gov 7)**: If a 7 is rolled, the world has no central authority. Multiple factions are generated with relative "Strength" ratings (e.g., Fringe, Minor, Significant), but distinct Government codes for individual factions are intentionally omitted at this scope level.
* **Law Level Exception**: On Balkanized worlds, the UWP Law Level typically only applies to the Starport's immediate jurisdiction.

## 3. Traveller 5 (T5) Logic
* **The Population Explosion**: $2D - 2$. **Critical Exception**: If the result is exactly 10, reroll as $2D + 3$.
* **Flux-Based Socials**:
    * **Government**: $\text{Flux} + \text{Population}$.
    * **Law Level**: $\text{Flux} + \text{Government}$.
* **Importance Extension (Ix)**: A calculated value (+5 to -3) based on Starport, TL, Trade Codes, and Bases.
* **Economic Extension (Ex)**: Calculates Resource Units (RU) by combining Resources, Labor (Pop-1), Infrastructure, and Efficiency (Flux). 
    * *Constraint*: If Efficiency Flux evaluates exactly to 0, it is forcefully treated as 1.

## 4. RTT Engine Logic
* **The Desirability Filter**: Population is not a random 2D roll; it is gated by the **World Desirability Score** (derived from physical Category 2 stats).
* **Habitation Types**:
    * **Homeworld**: (If Biosphere C+). 
        * **Water Chemistry**: Pop = $\text{Desirability} + 1D3 - 1D3$.
        * **Other Chemistry**: Pop = $2D6$.
    * **Colony**: (Roll $2D6 - 2 \le \text{Desirability}$). Pop = $\text{TL} + \text{SettlementAge} - 9$.
        * **Constraint**: Colony Pop is clamped between a minimum of 4 and a maximum of $\text{Desirability} + 1D3 - 1D3$.
    * **Outpost**: Pop = $1D3 + \text{Desirability}$ (Max 4).
* **Social Scale**: 
    * **Homeworld Government Override**: If Native TL is 0, Gov = 0. If Native TL $\ge$ 1, roll 1D6. If $1D6 \le (\text{Native TL} - 9)$, Gov = 7 (Balkanized).
    * **Standard Government**: $\text{Population} + 2D6 - 7$.
    * **Standard Law Level**: $\text{Government} + 2D6 - 7$.