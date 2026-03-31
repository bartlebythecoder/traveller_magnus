# MGT2E Tech Level & Sustainability Logic
## Directive: Sean Protocol - Zero-Assumption RPG Logic

This document defines the authoritative logic for Tech Level (TL) derivation and world sustainability based on the Mongoose Traveller 2nd Edition World Builder's Handbook (WBH).

### 1. Subordinate World TL Derivation
The Tech Level of a colony or secondary world is NOT a static offset. It must be calculated using a "High-Water Mark" approach:
* **Baseline Calculation**: `Mainworld TL - 1`.
* **Environmental Floor**: The `Minimal Sustainable Tech Level` required for the specific atmosphere code (as defined in `rules/mgt2e_data.js`).
* **Final Assignment**: `Math.max(Baseline, Environmental Floor)`.

### 2. The "Dead World" Constraint (Sustainability Check)
Physics and survival requirements take precedence over colonial expansion logic. 
* **Constraint**: If `Environmental Floor > Mainworld TL`, the parent civilization lacks the technology to maintain the colony.
* **Execution Outcome**:
    * Set `Population`, `Government`, `Law`, and `Tech Level` to **0**.
    * Flag world as `isRuin = true`.
    * Assign Trade Code **'Ba'** (Barren).
* **Exception**: Only a "Referee Override" or "Relic Technology" flag can bypass this, allowing for economically unviable outposts prone to life-support failure.

### 3. Auditor Validation Standards
The `MgT2E_UWP_Auditor` must prioritize these survival rules over standard guidelines to prevent false failures:
* **Guideline vs. Requirement**: A TL matching the `Environmental Floor` is a [PASS], even if it exceeds the `MW - 1` guideline.
* **Fatal Failure**: A world with `TL < Environmental Floor` is a [FAIL] (Life Support Failure).
* **Sustainability Failure**: A world with `Pop > 0` and `Environmental Floor > Mainworld TL` is a [FAIL] (Sustainable Logistics Violation).

### 4. Trace Logging Requirements
Every TL derivation must be documented in the Trace Log:
* **tResult**: Must log the `Baseline` vs the `Floor`.
* **tOverride**: Must explicitly log if the `Floor` forced the TL higher than the `Baseline`.
* **tSkip/tClamp**: Must log if the "Dead World" constraint was triggered.