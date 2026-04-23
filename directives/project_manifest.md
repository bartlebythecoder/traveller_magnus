# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.10.x
**Target:** MgT2E Editable System Details
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
An easy to use Traveller/Cepheus system builder and navigator
For this version: (1) Routes (2) Borders (3) Small bug fixes

## 2. Architectural Pillars 
* **Directives Layer:** 18 SOPs total. *Newest:* `directives/statistical_validation_sop.md`.
* **Data Shield:** Centralized tables for engine rules including **Expectation Table**.
* **Math Chassis:** Universal logic for survival floors, now strictly table-driven to eliminate logic drift.
* **Trace Logging:** Planet-Centric biographies with a final **Statistical Deviation Report** footer.

## 3. Implementation Plan (v0.10.x)

### Phase 0.10.0.x: Revamp Route Functionality (Current)

#### Bug Fixes and small enhancements:
* update diameter calculation to include diameters more specific than 1,600km (complete)
* update gravity calculation to use new diameter calculation (complete)
* update world displays after system expansions to display stellar configurations (complete)

#### Routes:
1. Allow for different specific routs with customizable colours and labels. Sure I can make the default Route #1 Green and call it Xboat, but the colour and the label should be allowed to be changed by the user (complete)
2. Add as many routes as I want (complete)
3. Routes can be automatic (using the filter rules to set them) or manual or any combination thereof (i.e. I should be able to manually change a route that was generated automatically) (complete)
4. I should be able to change the colour of each or any route later if I want to (complete)
5. I should be able to hide/unhide each route individually (complete)
6. Bring all route generation and modification into one simple menu (it is scattered right now) (complete)
7. Routes that overlap should be displayed side by side. One should never cover the other. I may actually decide on a different offset for each route #. E.g. Route #1 is always down the middle. Route #2 always to one side etc.  (complete)
8. OTU routes should be downloaded into Route #1/XBoat by default. (complete)
9. Integrate Generate XBoat automation into Route Management (complete)
10. Build special BTN Routes from GURPS Traveller into Route Management (outstanding)
11. Integrate filter automatic routes into Route Management (complete)
10. Look to include waypoints in point to point routes (outstanding)

### Phase 0.10.1.x: Build Out Border Functionality 
Borders:
1. Allow for automatic highlighting sections and build a simple border
2. NOT going to worry about including or dealing with blank hexes right now - if you want to have an area automatically bordered you have to select the blank hexes to include them
3. Not going to allow drawing individual borders for now - just a simple highlight the section and the border will draw around your highlight
4. Borders will always be on one side of the hexside or the other, so two borders can be against one another
5. Be able to change border colours
6. Be able to delete borders
7. OTU borders will be automatically downloaded with OTU imports
8. Borders should be able to be hidden/unhidden - probably not individually. Just borders on or off (unlike routes which I want to have individual choice of)
9. Need to be saved in the JSON save (just like routes)

#### Bug Fixes and small enhancements:
1.  Add advanced filter rule toggle for rules to be either hidden or displayed


