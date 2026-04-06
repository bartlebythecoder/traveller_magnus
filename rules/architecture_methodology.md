# ARCHITECTURE METHODOLOGY: AS ABOVE, SO BELOW

## 1. The "Sean Protocol" Framework
This project utilizes a three-layer architectural standard to ensure logic separation and multi-engine compatibility.
* **Directives Layer (The Requirements)**: Immutable Markdown files provided by the User/Referee that act as the "Source of Truth" for engine behavior.
* **Orchestration Layer (The Controllers)**: Pure JavaScript orchestrators that manage state and call engine functions in a strict sequence with **Zero Logic**.
* **Execution Layer (The Engines)**: Specialized modules (Stellar, World, Socio) that perform the actual math and RPG rolls based on the Directives.

---

## 2. Generation Flow Methodologies
The generator operates in two distinct modes depending on the selected engine and user intent.

### A. Top-Down Generation (The "Anchor" Model)
* **Definition**: Generation begins with a pre-defined Mainworld UWP (The Gospel) provided by the user.
* **Logic**: The star system is reverse-engineered to physically justify that specific UWP.
* **Constraint**: The Mainworld UWP is immutable; physics must be generated to support it.
* **Engines**: Classic Traveller (Top-Down), Mongoose 2E (Top-Down), and T5 (Top-Down Only).

### B. Bottom-Up Generation (The "Discovery" Model)
* **Definition**: Generation begins with the physical environment (The Star) and procedurally populates all orbits.
* **Logic**: The "Mainworld" is a discovered result, elected via an engine-specific habitability scoring matrix after the system is built.
* **Constraint**: No pre-defined UWP is allowed; the final UWP is a product of the generated environment.
* **Engines**: RTT (Bottom-Up Only), Classic Traveller (Bottom-Up), and Mongoose 2E (Bottom-Up).

---

## 3. Engine-Specific Logic Anchors
Each engine follows the ruleset dictated by its specific Directives. The AI must never assume a rule from one engine applies to another unless explicitly stated in the User's Requirements.

* **RTT**: Strictly physics-first discovery using spectral-shift and luminosity branch logic.
* **Classic Traveller**: Follows Book 3/6 logic including Orbit Destruction and the "Skeleton" placement sequence.
* **Mongoose 2E**: Implements World Builder's Handbook (WBH) mechanics such as Orbital Collisions, Demotion, and Sustainability Tech Floors.
* **T5**: Uses Flux-based variability for UWP cascades and scientific scaling for physical diameters.

---

## 4. Auditor & Logging Standards

### I. Auditor Supremacy
The `System Auditor` is the final check for "legal" generation within a specific ruleset. Any result that violates the physics-to-UWP coupling defined for that engine must be flagged.

### II. Trace Logging (The "Sean Protocol" Guard)
All trace logs must follow a hierarchical, planet-by-planet structure. This allows for the immediate identification of "Suspicious Results" by grouping physical, social, and orbital data into a single human-readable audit trail.