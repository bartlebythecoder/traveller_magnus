# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.16.x
**Target:** 
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
An easy to use Traveller/Cepheus system builder and navigator


## 2. Next Update

### Feature: Full System Editor (v0.16.0)

A new full-screen system editor allowing users to create star systems from scratch or structurally edit existing generated systems. The result must be indistinguishable from an engine-generated system in hexStates, JSON export, and map display.

---

#### Entry Points
- Right-click a single selected hex → context menu shows **"Create System"** (empty/unpopulated hex) or **"Edit System"** (populated hex)
- **Edit button** inside the existing System Viewer (same full-screen canvas)

#### Architecture Constraints
- **New script** (`js/system_editor.js` or similar) — minimal changes to existing engines
- The System Viewer is the UI container; Edit Mode is a state within it, not a separate tool
- Always work on a **copy** of hexState data — never mutate live state during editing
- On save, result must land in hexStates as a normal system. ~~with one hidden flag: `manually_edited: true`~~ **Dropped 2026-07-03, see OW-4 in Section 6** — no consumer for this flag exists or is planned; do not implement it.
- No duplication of engine logic

#### Creating vs Editing
- **New system:** Engine selection dialog appears first. **UPDATED 2026-07-04:** MgT2E and CT are both live — in `hex_map.html`'s `#se-engine-dialog`, the MgT2E and CT radio buttons are enabled; AoW, T5, and RTT remain `disabled`, marked "(coming soon)". T5 / RTT / AoW are staged for a controlled rollout per Section 5, same pattern CT just went through — stubs exist in `system_editor.js`, and AoW's generator-level plumbing is further along than T5/RTT (see Supported Engines note below). Editor then opens blank.
- **Existing system:** Engine is locked to whatever generated it. No engine switching in v1.
- Minimum required to unlock Fill & Save: **a primary star must exist** (all its fields can be blank)

#### Body Types — Full Fidelity from Day One
Stars (primary, companion), terrestrial worlds, gas giants, planetoid belts, moons, rings, small moons, worldlets.

#### Structural Operations
- **Add bodies** via contextual buttons within the tree (e.g. "Add World" under a star node)
- **Delete bodies** — cascade delete with warn-and-confirm when a star has orbiting bodies
- **Move bodies** — drag and drop within a single star's orbit tree; typed orbit number as fallback for edge cases
- Cross-star moves are **v2**
- Changing a star's spectral type/class does **not** cascade to worlds
- Zone-inconsistency warnings shown at move time or Fill time; user may proceed consciously

#### Mainworld Rules
- User can flag/unflag any body as mainworld
- Re-designating mainworld on an existing system is a key use case
- ~~If no mainworld at Fill time: warn, offer user the choice to pick one or let engine decide~~ — **CORRECTED 2026-07-03, see OW-2 (CLOSED):** no warning needed. A null mainworld at Fill time already falls through to the generator's normal habitability-based election automatically — this already is "let engine decide," with no dialog required.
- T5 gets a dedicated one-off mainworld selection algorithm (T5 does not designate mainworld the same way as other engines) — **deferred to v0.16.1; see Algorithm 7 and Section 5**

#### Supported Engines (UPDATED 2026-07-05 — Edit System scope)
- **MgT2E** (Mongoose Traveller 2nd Ed) — bottom-up fill; `js/mgt2e_bottomup_generator.js`. Both entry points (`canvas_input.js` right-click gate, `system_viewer.js`'s "Edit System" button) recognize `mgt2eData`/`mgtSystem` or `edition === 'MgT2E'` respectively.
- **CT** (Classic Traveller) — bottom-up fill; `js/ct_bottomup_generator.js`. **UI-exposed 2026-07-04** — the same two entry points now also recognize `ctData`/`ctSystem` or `edition === 'CT'`. Has its own `_ENGINE_ADAPTERS.CT` entry, `sys.auditResult` coverage, and `capturedPlanets` support — see the "CT is now fully online" note under v0.16.1 SEQUENCING above and the corrected CT subsection in Section 5.
- **T5 / RTT** — both UI-exposed (2026-07-05 / 2026-07-04 respectively) via the same pattern; see Section 5's "T5 is now fully online" / "RTT is now fully online" notes. (This section's header historically read "Deferred Engines (AoW / T5 / RTT)" — stale as of both engines going live; not corrected in full here, see Section 5 for the authoritative per-engine status.)
- **AoW (Architect of Worlds) — UI-exposed 2026-07-05.** Both entry points now recognize `aowSystem` / `edition === 'AoW'`. Has its own `_ENGINE_ADAPTERS.AoW` entry, `sys.auditResult` coverage (`js/aow_uwp_auditor.js`, newly built — didn't exist before this pass), and a dedicated new module `js/aow_seed_bridge.js` handling the star-physics/hierarchy/disk-worksheet work OW-9 found was needed beyond a normal gating pass. See the "AoW" subsection in Section 5 and OW-9 (Section 6) for the full writeup.

#### Fill & Save — The Commit Action
- One-time, whole-system commit — not iterative
- **MgT2E, CT, T5, RTT, and AoW (all UI-exposed as of 2026-07-05):** all run their bottom-up (or top-down, for T5) engine sequence with a "check user first, generate if missing" gate at every decision point. User-set values feed downstream decisions correctly (e.g. user-set spectral type informs habitable zone; for AoW, a user-set spectral type is resolved to concrete star physics by `js/aow_seed_bridge.js`'s solver — see the AoW subsection in Section 5).
- **Checkbox (unchecked by default):** "Allow engine to add additional bodies" — when unchecked, Fill only fills fields on bodies the user placed; when checked, engine may add bodies per its normal rules
- Physical inconsistencies trigger a warning; user may correct or proceed. **This is OW-3 (UWP Auditor) — DONE for all five engines (MgT2E/CT 2026-07-04, T5/RTT 2026-07-04/05, AoW 2026-07-05), see Section 6.**

#### UX & Safety
- Cancel → warn-and-confirm → discard copy (original untouched)
- **Undo/redo** within editor session (Ctrl+Z / Ctrl+Y); history stack discarded on exit
- Pre-load existing system fully into editor with body detail panels collapsed by default
- Never silently break physics rules — always warn first, always let user override consciously

#### Out of Scope for v1
- Engine switching on existing systems
- Cross-star body moves
- CSV import (v2)
- Right-click within editor tree for add-body (v2)

---

#### hexStates Structure (per system hex) — CORRECTED 2026-07-03 (RTT was omitted from this list; it is a fully live 5th engine, confirmed via `macro_orchestrator.js`)
Each populated hex carries parallel objects — all must be written correctly on Fill & Save:
- `type: 'SYSTEM_PRESENT'`
- `mgtSystem` / `ctSystem` / `t5System` / `aowSystem` / `rttSystem` — raw body/orbit data per engine
- `mgt2eData` / `ctData` / `t5Data` / `rttData` — mainworld UWP fields
- `mgtSocio` / `t5Socio` — socioeconomic expansion data
- `name`, `allegiance`, `cluster`
- `manually_edited` — **dropped as a requirement, see OW-4 in Section 6.** Not currently set anywhere; do not assume it's present on editor-produced systems.

---

### Phase 2 — Architectural Plan (completed 2026-06-19)

#### Modified Files

| File | Risk | What Changes |
|---|---|---|
| `hex_map.html` | LOW | Add context menu items, engine-selection dialog, warning dialog HTML, script tag for system_editor.js |
| `js/canvas_input.js` | LOW | Show/hide `ctx-create-system` and `ctx-edit-system` per selection state; add click handlers |
| `js/system_viewer.js` | MEDIUM | `open()` accepts optional explicit hexId; add `_editMode` flag; add Edit button to `_buildOverlay()` |
| `js/macro_orchestrator.js` | LOW-MEDIUM | Extract commit block to shared `_commitSystemToHex()`; add `commitEditorSystem()` for Fill & Save |
| `js/mgt2e_bottomup_generator.js` | HIGH | Add optional `seedSys = null` parameter; thread override gate through all 5 phases |
| `js/aow_bottomup_generator.js` | HIGH | Same pattern as MgT2E |
| `js/ct_bottomup_generator.js` / `js/ct_world_engine.js` | — | **UPDATED 2026-07-04: structural AND field-level (size/atm/hydro/pop) gating both done; CT is UI-exposed** — see Section 5. |
| `js/t5_topdown_generator.js` | — | **Deferred (v0.16.1) — still accurate.** No structural or field-level gating exists yet — see Section 5. |
| `js/rtt_engine.js` | — | **CORRECTED 2026-07-03: structural gate + full pipeline threading already done, not deferred.** Broader field-level `isManual` coverage still outstanding — see Section 5. |

---

#### The Override Gate Pattern (CORRECTED 2026-07-03 — this was originally a design sketch that was never built this way; see Algorithm 6 for the actual mechanism, which this now matches)

The real mechanism uses a `seedSys` parameter (not `userOverrides`) plus the pre-existing `isManual()`/`_manualFields` tracking from `core.js` — there is no `_getOverride()` helper anywhere in the codebase.

```javascript
// Existing macro callers pass no second argument → seedSys is null → identical behavior
function generateMgT2ESystemBottomUp(hexId, seedSys = null) {

    // Star fields are NOT gated field-by-field in the generator — _buildSeedSys() (system_editor.js)
    // always resolves a concrete value before the generator ever sees it (e.g. `s.sType || 'G'`),
    // so seeded stars are simply used as-is rather than rerolled-unless-manual.

    // Body/world fields ARE gated field-by-field, e.g. in mgt2e_world_engine.js:
    if (!isManual(body, 'density')) body.density = finalDensity;
}
```

**Critical safety rule:** When `seedSys` is null (all existing macro calls), every `isManual` check returns false and all gates pass — generation is identical to today. This is confirmed real in `mgt2e_world_engine.js` (e.g. lines 98, 117, 121, 140, 144) and CT/RTT's structural (not field-level) equivalents — see corrected Section 5.

#### The Seed Object Schema (CORRECTED 2026-07-03 — field names below are the real ones; the version previously here — `{ stars, bodies, mainworldRef, allowAddBodies }` — does not match `_buildSeedSys()`'s actual output)
```javascript
{
  stars: [],             // seeded star objects, always fully resolved (no undefined fields)
  worlds: [],            // MgT2E/AoW/T5: seeded body list (CT uses `orbits`; RTT uses `rttBodies`, a per-star 2D array)
  _mainworldRef: null,   // underscore-prefixed — _id of the body flagged as mainworld by the user
  _allowAddBodies: false // underscore-prefixed — mirrors the "Allow engine to add additional bodies" checkbox
}
```

#### The Commit Path — 🟡 PARTIALLY BUILT, ACCEPTED FINAL STATE (see OW-5, Section 6)
Original plan: after Fill runs, `system_editor.js` would call `commitEditorSystem(hexId, engineResult, engine)` in `macro_orchestrator.js`, writing the completed system to hexStates and triggering a map redraw. **`commitEditorSystem` in `macro_orchestrator.js` does not exist and, per Sean's explicit 2026-07-04 decision, is not planned** — see OW-5 in Section 6. What was built instead: `system_editor.js`'s own internal duplication between `_fillAndSave()`/`_preview()` was extracted into a shared `_generateAndCommit()` (2026-07-04). The separate duplication in `macro_orchestrator.js`'s macro commit blocks remains un-consolidated — a deliberate, accepted scope decision, not an oversight. Also drop the `manually_edited: true` detail from this description — that flag was retired, see OW-4.

---

### Phase 3 — Algorithm Design (completed 2026-06-19)

#### Key Discovery: `markManual` / `isManual` / `clearManual` (core.js)
These three functions already exist and are the native mechanism for tracking user-set fields on body objects. The `_manualFields` array on each body/star object is how generators know which fields to skip. The System Editor plugs directly into this — no new tracking mechanism needed.
- `markManual(obj, field)` — call when user sets a field in the editor
- `isManual(obj, field)` — generators call before each field assignment
- `clearManual(obj, field)` — call when a body moves to a new orbit (clears zone-dependent fields)

---

#### Algorithm 1: Editor Working Copy State — CORRECTED 2026-07-03

```
WorkingCopy {
  hexId, engine, allowAddBodies, mainworldRef, age, hzco

  stars: [StarObject]   — each has _id (NOT _editorId), _manualFields[], role, parentStarId, and all star fields, always fully resolved (never undefined — see Algorithm 6)
  bodies: [BodyObject]  — flat list; each has _id, _manualFields[], parentStarId, type, orbitId, isMainworld, moons[]
}
```
- There is **no `isNewSystem` field.** New-vs-edit is tracked separately via a module-level `_pendingCreateHexId` variable, not a property on the working copy itself.
- **Open existing system:** Deep-clone raw engine system (e.g. `stateObj.mgtSystem`) into working copy via `_buildWorkingCopyFromState()`. All fields present, none manual — user edits mark `_manualFields` inline (there is no `markManual` helper function despite `core.js` exposing one — the editor pushes directly to the array).
- **Open new system:** Single blank StarObject (Primary, all fields undefined) via `_buildBlankWorkingCopy()`. Engine selection must have occurred first.
- **Original copy:** `_originalCopy` — confirmed real, a second deep-clone (`JSON.parse(JSON.stringify(wc))`) taken once at open and never reassigned except to `null` on close. Used by `_isDirty()` (`JSON.stringify(_workingCopy) !== JSON.stringify(_originalCopy)`) to detect changes — see corrected Algorithm 8, which also depends on a second condition beyond this comparison.

---

#### Algorithm 2: Local Undo/Redo Stack — CORRECTED 2026-07-03 (variable names only; behavior confirmed accurate)

Separate from global `saveHistoryState` (which is called once at Fill & Save for map-level undo).

```
_history []   — JSON-serialized WorkingCopy snapshots (NOT _editorHistory)
_histIdx -1   — current position (NOT _editorHistIdx)

_pushHistory():
  Truncate array above _histIdx
  Push JSON.stringify(_workingCopy)
  _histIdx = length - 1
  Cap at HISTORY_CAP = 50 entries — confirmed real constant, enforced with .shift() when exceeded

undo() [Ctrl+Z]:  _histIdx--; restore; _renderEditorTree()
redo() [Ctrl+Y]:  _histIdx++; restore; _renderEditorTree()
```
Push on every structural operation (before the change, confirmed) and on field-edit **`change` event** (not literally a `blur` listener, though functionally similar — not per keystroke).
Initial state pushed at editor open (position 0 = "before any edits").

---

#### Algorithm 3: Structural Operations — CORRECTED 2026-07-03

**`_addStar(separation, parentStarId)`** (not `addStar(role)`) → `_pushHistory()` fires **first**, then create StarObject (`_manualFields: []`), push to stars, `_renderAndPreview()`.

**`_addBody(parentStarId, bodyType)`** → `_pushHistory()` fires **first**, then create BodyObject with `_manualFields: ['type']` set inline (there is no `markManual` function — despite `core.js` exposing one, the editor pushes to `_manualFields` directly everywhere), `orbitId: _nextOrbitId(parentStarId)` computed inline, render.

**`_deleteBody(bodyId)`**
```
If body has moons → warn-and-confirm "This body has N moon(s) that will also be deleted."
_pushHistory → remove body + moons → if was mainworld: clear mainworldRef → render
```
Confirmed accurate in substance; only the exact dialog wording differs from the paraphrase above.

**`_deleteStar(starId)`** — broader in scope than previously documented:
```
If only star → show error "A system must have at least one star." (NOT "Cannot delete the only star")
Collect the target star PLUS any sub-companion stars orbiting it (not just bodies)
Count all bodies on this star (and its sub-companions) → warn-and-confirm
  "This star (and its companion) and N orbiting bodies will be permanently removed."
_pushHistory → remove star + sub-companions + all their bodies → clear mainworldRef if affected → render
```

**moveBody(bodyId, newOrbitId)** — implemented as `_insertAtOrbit(draggedObj, targetOrbitId)`
```
INSERT at targetOrbitId — do not swap.
Build unified pool: all bodies + non-primary companion stars (excluding the dragged item).
If moving inward:  pool items in [targetOrbitId, oldOrbitId - 1] shift out by +1
If moving outward: pool items in (oldOrbitId, targetOrbitId] shift in by -1
draggedObj.orbitId = targetOrbitId
All shifted items + draggedObj: mark orbitId as manual
_pushHistory (pushed before the change)
render + auto-preview
```
Note: typed orbit# changes that would cross a neighbor are blocked with a popup directing the user to drag-and-drop instead (`_wouldReorder` guard) — confirmed real, invoked at both the primary-body and companion-star orbit inputs.

**`_setMainworld(bodyId, isMoon, parentBodyId)`** (two more parameters than previously documented)
```
_pushHistory
All bodies AND moons: isMainworld = false (also restores true Belt type via _restoreBeltType() — an undocumented side effect: mainworld bodies display as type 'World' regardless of physical type, so un-designating one must restore its real type)
Target: isMainworld = true; _manualFields push 'isMainworld' inline (no markManual function — see Algorithm 1)
mainworldRef = bodyId → render
```

---

#### Algorithm 4: Drag-and-Drop — CORRECTED 2026-07-03

There are actually **two separate draggable-object models**, not one — the original single "single star orbit tree only" header was incomplete rather than wrong:

**Body drags** (`_dragBodyId` + `_dragStarId` — two variables set together, not one) — genuinely restricted to a single star's tree:
```
dragstart(bodyId):  _dragBodyId = bodyId; _dragStarId = <that body's parent star>; bodyEl.style.opacity = '0.4' (no 'se-dragging' CSS class exists anywhere in the file)

dragover(event):
  If body.parentStarId !== _dragStarId → dropEffect = 'none'; return   (cross-star block, confirmed real)
  Target orbit is simply the hovered body's own orbitId — no separate drop-indicator/insertion-point calculation

drop():
  Calls _insertAtOrbit(dragBody, body.orbitId) directly — there is no moveBody() wrapper function
  Invalid drops simply no-op via the guard conditions above — there is no dragCancel() function

dragend:  _dragBodyId = null; _dragStarId = null; no history push (opacity style cleared)
```

**Companion-star drags** (`_dragCompanionId` — a third, separate variable) — CAN cross star boundaries, confirmed real:
```
A companion star can be dropped onto primary-level bodies or onto other companions,
via the same _insertAtOrbit(draggedObj, targetOrbitId) used for body drags.
This is what "Interleaved Companion Stars" (Phase 5, below) describes — it is not a
contradiction with the body-drag restriction above, they are different draggable types.
```

---

#### Algorithm 5: Fill Sequence — CORRECTED 2026-07-03 to match Section 6 decisions (this is the master sequence; keep it in sync whenever an OW item's status changes)

```
_fillAndSave():

  1. ~~VALIDATE PRIMARY STAR~~ — RETRACTED, see OW-1 (CLOSED).
     Structurally unreachable: the UI has no way to delete the primary or leave
     the stars array empty. Not implemented, not needed.

  2. ~~VALIDATE MAINWORLD~~ — RETRACTED, see OW-2 (CLOSED).
     A null mainworldRef already falls through to the generator's normal
     habitability-based election (WorldEngine.evaluateMainworldCandidates) —
     this already IS "Let engine decide," automatically, no dialog needed.

  3. BUILD SEED SYS
     seedSys = _buildSeedSys() — engine-specific shape, see corrected "Seed Object
     Schema" in Phase 2 above (_mainworldRef / _allowAddBodies, underscore-prefixed)
     ← _manualFields arrays are preserved in the clone

  4. CALL GENERATOR (switch on engine — UPDATED 2026-07-05: all five engines are now
     UI-exposed, see Supported Engines note)
     MgT2E → MgT2EBottomUpGenerator.generateSystem(hexId, seedSys)
     CT    → CT_Generator.generateSystem({ mode: 'bottom-up', hexId, seedSys })
     AoW   → AoWBottomUpGenerator.generateAoWSystemBottomUp(hexId, seedSys) — Phase 1/2 now
             call js/aow_seed_bridge.js for star-physics resolution and disk-worksheet
             synthesis when seeded (see the AoW subsection in Section 5)
     T5    → System_Driver.generateSystem({ edition: 'T5', ... })
     RTT   → generateRTTSectorStep1(hexId, { seedSys })

  5. RUN UWP AUDITOR — ✅ DONE for MgT2E and CT (2026-07-04). See OW-3 (Section 6).
     Each generator attaches its audit result to `sys.auditResult` (`auditMgT2ESystem`/
     `MgT2E_UWP_Auditor.runAndLog` for MgT2E; `auditCTSystem`/`CT_Auditor.runAndLog` for
     CT, wired into `ct_system_driver.js`). `_fillAndSave()` reads `result.newSys.auditResult`
     generically (engine-agnostic check) — if `pass === false`: warn-and-proceed
     [Proceed anyway] [Go back and fix]. Still a no-op for AoW/T5/RTT until each gets
     its own `sys.auditResult` attachment.

  6. COMMIT — 🟡 PARTIALLY EXTRACTED, ACCEPTED FINAL STATE. See OW-5 (Section 6).
     `_generateAndCommit(errorLabel)` (2026-07-04) is now the shared function called by
     both `_preview()` and `_fillAndSave()`: build seedSys → run generator (via
     `_ENGINE_ADAPTERS` for MgT2E/CT) → restore-display-manual-fields → preserve
     mainworld name → `computeSystemCounts` → `hexStates.set()` → redraw → (run UWP
     auditor gate, step 5 above) → close editor → `SystemViewer.open(hexId)`.
     ~~result.manually_edited = true~~ — DROPPED, see OW-4 (CLOSED). Do not implement.
     ~~commitEditorSystem(hexId, result, engine)~~ in `macro_orchestrator.js` — does not
     exist and is not planned (Sean's call, 2026-07-04): only `system_editor.js`'s own
     internal duplication was consolidated; the separate `macro_orchestrator.js` commit
     blocks remain un-consolidated. See OW-5's scope note in Section 6.
```

---

#### Algorithm 6: Generator Override Mechanism — CORRECTED 2026-07-03 (nuance added, mechanism itself confirmed accurate)

`_buildSeedSys` passes working copy bodies (with `_manualFields`) to the generator as its starting `sys`. Inside each generator, **body/world field assignments** are gated exactly like this — confirmed real and extensive in `mgt2e_world_engine.js` (e.g. lines 98, 117, 121, 140, 144):

```javascript
// Before: body.density = finalDensity;
// After:
if (!isManual(body, 'density')) body.density = finalDensity;

// allowAddBodies gate (inventory/allocation phases):
if (!seedSys || seedSys._allowAddBodies) {
    StellarEngine.generateSystemInventory(sys);
    StellarEngine.allocateOrbits(sys);
}
```

**Star fields do NOT use this pattern.** No generator calls `isManual(star, 'type')` or rerolls star fields — `_buildSeedSys()` always resolves every star field to a concrete value before the generator sees it (e.g. `type: s.sType || 'G'`), so seeded stars are simply used as-is. The `star.type = rollStarType()` example previously shown here described a mechanism that doesn't exist for stars; it's been replaced with the real body-field example above.

**Safety guarantee:** When `seedSys` is null (all existing macro calls), every `isManual` check returns false and all gates pass — generation is 100% identical to today.

---

#### Algorithm 7: T5 Mainworld Selection (confirmed 2026-06-19)

When the user has not designated a mainworld and engine is T5:

```
1. Collect all eligible bodies: all worlds + all moons (moons inherit parent's orbitId)
2. Determine hzOrbit for the primary star via getStarHZ(primaryStar)
3. For each body: distance = Math.abs(body.orbitId - hzOrbit)
4. Select body with smallest distance
5. If tied: random selection among tied candidates (use seeded rng)
6. If no eligible bodies exist: proceed with no mainworld (no error)
7. Designate winner: body.type = 'Mainworld'; body.isMainworld = true
```

---

#### Algorithm 8: Cancel Sequence — CORRECTED 2026-07-03

The actual function is `close()`, not `cancel()`. More importantly, the trigger condition is **not just `_isDirty()`** as previously documented — there's a second, undocumented condition:

```
close():
  If _isDirty() [= JSON.stringify(_workingCopy) !== JSON.stringify(_originalCopy)] OR _previewOriginalState is set:
    warn-and-confirm ('Discard Changes?', 'You have unsaved changes. Discard them and close the editor?')
      [Discard]      → _restorePreview() (reverts hexStates if a Preview snapshot exists, no-op otherwise) → _forceClose()
      [Keep Editing] → return
  Else → _forceClose() immediately
```

**The `_previewOriginalState` condition matters in practice:** `_preview()` doesn't touch `_workingCopy`, only `hexStates` — so a user who clicks Preview and then Close, with zero further edits, still gets the "unsaved changes" warning, because `_previewOriginalState` is set even though `_isDirty()` alone would be `false`. This is real and reachable: the "Create New" flow auto-previews once immediately on open (see `_openWithWorkingCopy`) to render a starter system, so closing a freshly-created system without touching anything still triggers this dialog.

---

### Phase 4 — Implementation Sequence

**Steps 1–4 complete** — HTML structure (`hex_map.html`), context menu entry points (`js/canvas_input.js`, `js/system_viewer.js`), `system_editor.js` scaffold, and structural operations + drag-and-drop are all implemented. **Reconfirmed 2026-07-03**: `system_editor.js` is a substantial 2500+ line implementation, not a stub; context menu wiring, HTML dialog markup, and structural-op/DnD handlers were all directly verified present and functional (see corrected Algorithms 1-4, 8 above for the accurate behavioral detail).

---

#### Step 5 — Generator Override Gates (one engine at a time)
**Files:** `js/mgt2e_bottomup_generator.js`, `js/ct_bottomup_generator.js`, `js/aow_bottomup_generator.js`, `js/t5_topdown_generator.js`, `js/rtt_engine.js`

Pattern applied identically across generators (CORRECTED 2026-07-03 — see Algorithm 6 for the accurate body-vs-star distinction; star fields are seeded wholesale, not field-gated):
```javascript
function generateMgT2ESystemBottomUp(hexId, seedSys = null) {
    const sys = seedSys || { hexId, worlds: [], stars: [], ... };
    if (!seedSys || seedSys._allowAddBodies) {
        StellarEngine.generateSystemInventory(sys);
        StellarEngine.allocateOrbits(sys);
    }
    if (!isManual(body, 'density')) body.density = finalDensity;  // body/world fields, at every field
    // mainworld: use seedSys._mainworldRef if set, else run normal election
}
```

Sub-steps and regression status (UPDATED 2026-07-05 — CT and T5 have both completed the full Phase B sequence; see corrected Section 5 for full evidence):
- **5a MgT2E:** ✅ Done — structural + field-level gating complete, UI-exposed.
- **5b CT:** ✅ Done (2026-07-04) — structural + field-level (size/atm/hydro/pop) gating complete, own `_ENGINE_ADAPTERS` entry, own UWP-auditor coverage, **UI-exposed**. Gov/law/tl/starport gating is a known, deliberately-deferred follow-up (not a blocker).
- **5c AoW:** ✅ Done (2026-07-05, last through the Phase B sequence, closing OW-9) — structural + field-level gating complete, own `js/aow_seed_bridge.js` module for star-physics/hierarchy/disk-worksheet resolution, own `_ENGINE_ADAPTERS.AoW` entry, own `js/aow_uwp_auditor.js` (built from scratch), **UI-exposed**. **Verified end-to-end in-browser via Playwright (2026-07-05)** — found and fixed one real bug in the process (see below).
- **5d T5:** ✅ Done (2026-07-05) — structural + field-level (worldType/size/atm/hydro/pop) gating complete, Algorithm 7 mainworld election implemented, own `_ENGINE_ADAPTERS` entry, own UWP-auditor coverage, **UI-exposed**. Gov/law/tl/starport gating deliberately deferred (not a blocker, same as CT). Verified end-to-end in-browser via Playwright.
- **5e RTT:** ✅ Done (2026-07-04) — this bullet was left stale after RTT actually went live; see the RTT subsection in Section 5 for the accurate, current writeup (structural + full field-level gating, own adapter, own auditor coverage, UI-exposed, verified in-browser).

**Before AoW/RTT is UI-exposed:** finish its remaining gating work above, give it its own `_ENGINE_ADAPTERS` entry (OW-8 pattern), AND give it its own UWP-auditor coverage (OW-3 pattern, per-engine — MgT2E's/CT's/T5's coverage does not extend to other engines). CT's and T5's Phase B work (Section 5, "CT is now fully online" / "T5 is now fully online") are the worked reference implementations for this whole sequence.

---

#### Step 6 — Fill & Save Orchestration — DONE for MgT2E and CT (UPDATED 2026-07-04)
**Files:** `js/system_editor.js`

Fill & Save button exists and works for MgT2E and CT. Actual current sequence (see corrected Algorithm 5): `_buildSeedSys()` → call generator (via `_ENGINE_ADAPTERS` for MgT2E/CT) → `_generateAndCommit()`'s shared commit block (`hexStates.set`/redraw) → **OW-3 audit gate** (`result.newSys.auditResult`; warn-and-proceed dialog if `pass === false`) → close editor → `SystemViewer.open(hexId)`. The "validate → mainworld dialog" steps this used to describe are retracted (OW-1/OW-2, closed as unnecessary). The UWP auditor step is implemented and live for MgT2E and CT; still a no-op for AoW/T5/RTT until each gets its own `sys.auditResult` attachment (see OW-3 in Section 6).

`_buildSeedSys()`: deep-clone working copy stars and bodies (preserving `_manualFields`) into seedSys object with `_allowAddBodies` and `_mainworldRef` — confirmed real and matches the corrected Seed Object Schema in Phase 2.

- **Verified working today (MgT2E, in-browser by Sean):** audit errors → warn dialog with go-back option; Create system, fill → appears on map with correct data; user-set fields survive Fill; allowAddBodies checkbox respected; edit existing system, change structure, fill → changes in result
- **CT (2026-07-04):** same code paths, but only `node --check`-verified so far — **not yet exercised in-browser**, since CT's UI exposure (Phase B item 5) just landed this session. First real end-to-end test is up to Sean.
- **Regression:** All existing macros still generate correctly (seedSys=null path untouched)

---

#### Step 7 — Commit Path — 🟡 PARTIALLY DONE, ACCEPTED FINAL STATE (UPDATED 2026-07-04, see OW-5 in Section 6)
**Files:** `js/system_editor.js`, `js/macro_orchestrator.js`

`commitEditorSystem(hexId, sys, engine)` in `macro_orchestrator.js` (shared by macros AND the editor) does **not** exist and is **not planned** — Sean explicitly scoped this down (2026-07-04) to "system_editor.js only." What was built instead: `system_editor.js`'s own internal duplication between `_fillAndSave()`/`_preview()` is extracted into a shared `_generateAndCommit(errorLabel)` — see OW-5 Layer 1 in Section 6 for the full method list (build seedSys → run generator → restore-display-manual-fields → mainworld-name preservation → `computeSystemCounts` → `hexStates.set` → redraw). The `macro_orchestrator.js` commit-block layer (Layer 2) remains a separate, un-consolidated path — revisit only if a future engine's macro and editor commit paths need to agree, per OW-5's note.

- **Verified (MgT2E, in-browser by Sean):** Committed system on hex map; System Viewer renders it; Hex Editor shows correct fields; macro re-run on same hex overwrites correctly; map-level Ctrl+Z reverts to pre-edit state
- **CT (2026-07-04):** same `_generateAndCommit()` code path (CT's `_ENGINE_ADAPTERS.CT.run()` writes `stateObj.ctSystem`/`ctData` the same way MgT2E's adapter does) — not yet exercised in-browser, see Step 6 above
- **Final regression:** Every macro type generates correctly; open/cancel preserves original; open/edit/fill/save produces correct result

---

### Phase 5 — Implementation Notes & Design Decisions (2026-06-22)

Steps 1–4 of the Phase 4 sequence are fully implemented. **UPDATED 2026-07-04:** Steps 5–6 are done for MgT2E and CT (still open for AoW/T5/RTT); Step 7 is intentionally left partial as an accepted final state (see OW-5, Section 6) rather than "not yet implemented." See Section 6 for current per-item status. The following design decisions were made during or after implementation and are not reflected in Phases 2–4.

#### Preview Button & Auto-Preview (updated 2026-06-24)

Most user actions in the editor **auto-preview** immediately — they call `_renderAndPreview()` which runs `_renderEditorTree()` then `_preview()`. Auto-preview fires on: drag-and-drop, add/delete body or star, set/clear mainworld, star type/subtype/class change, orbit# change (typed), and setting a derived field value.

**Exception — clearing a derived field does NOT auto-preview.** The `_derivedRow` clear button (`×`) and blanking a derived field input only call `onSet(null)` — no preview. This lets users clear multiple fields in sequence (e.g. blank mass, lum, temp after changing star type) and batch the re-derivation by clicking **Preview** manually.

The **Preview button** (`[Cancel] [Preview] [Fill & Save]`) is therefore the explicit trigger after clearing operations. It calls `_preview()` directly.

`_preview()` runs `_buildSeedSys()` → generator → commit to `hexStates` → `SystemViewer.refresh()`. On first call it snapshots `_previewOriginalState`; Cancel after a Preview restores that snapshot. Fill & Save commits permanently and closes the editor.

---

#### Visual Hierarchy: Indented Connector Lines

The body tree uses left-border connector lines to show ownership at a glance:
- **Primary section** (`borderLeft: 2px solid`): bodies and companions under the primary
- **Companion sub-section** (`borderLeft: 1px solid`, indented): bodies orbiting that companion
- **Moon sub-section** (`borderLeft: 1px solid`, inside a body's `<details>` panel): moons of a world

---

#### Interleaved Companion Stars (2026-06-22)

The original implementation rendered all stars first — primary then companions as separate sections — with each star's bodies listed beneath it. This obscured the orbital physics: a companion occupies an orbit slot in the primary sequence. Bodies at orbits *inside* the companion are circumbinary; bodies *outside* orbit only the companion's star.

**New approach:** `_renderEditorTree()` builds a single merged list for the primary:

```
mergedItems = [
  ...primaryBodies.map(b => ({ kind:'body',      item:b, sortKey: _sortAU(b) })),
  ...companions.map(s    => ({ kind:'companion',  item:s, sortKey: _sortAU(s) }))
].sort((a,b) => a.sortKey - b.sortKey)

_sortAU(obj) = _orbitIdToAU(obj.orbitId) ?? obj.au ?? obj.orbitAU ?? Infinity
```

`orbitId` is the primary sort key so the list reflects the current orbit even after a DnD move (before `au` is recalculated by the generator). AU is the universal sort key across all three surfaces (system editor, system viewer, hex editor accordion) and all engines.

Each companion renders as a draggable header row inside the primary's `bodyContainer`, followed by an indented sub-container for its own bodies:

```
★ Primary: G2V  [+World][+GG][+Belt][+Comp]
│  ≡ World "Agidda" ·2
│  ⊙ Companion: M0V ·3  [+World][+GG][+Belt][Del★]
│  │  ≡ World "Arken" ·1
│  ≡ Gas Giant ·5
```

**Data model — `orbitId` on companion stars in `_workingCopy.stars`:**
- MgT2E companions: read from `s.orbitId` (float, e.g. `3.5`) — was previously dropped entirely
- CT companions: read from `s.orbit` if numeric; string values ("Close"/"Near"/"Far") → `null` → sort key 9999 (appear at end)
- New companions via `_addStar()`: assigned `orbitId = maxOccupiedOrbit + 1`
- Forwarded to generator in `_buildSeedSys()` engStars map as `orbitId: s.orbitId != null ? s.orbitId : undefined`

**Drag-and-drop for companions:**
- All three drop combinations (body→body, companion→body, companion→companion) use INSERT via `_insertAtOrbit(draggedObj, targetOrbitId)` — shifts the pool of bodies + non-primary stars by ±1 in the affected range; marks all shifted items' `orbitId` as manual; auto-previews after drop
- Body drag within a companion's sub-container → same logic as primary bodies
- `_swapBodies` / `_swapStars` removed; all moves go through `_insertAtOrbit`

---

#### Additional Implementation Decisions (2026-06-24)

**AU display in detail pads**
Each body's orbit row shows a read-only AU distance derived from `orbitId` via `_orbitIdToAU()`: `→ X.XX AU`. Displayed in dim text alongside the editable Orbit # field. Stars (companions) show the same. AU fields in the MgT2E hex editor accordion are **read-only** (shown as `<strong>` text, not editable inputs) since orbit is now managed in the system editor. **Caveat confirmed 2026-07-03:** true for MgT2E (body and companion rows) and for AoW's companion row, but AoW's *body* row AU is plain text in the `<summary>` line, not `<strong>`-wrapped like the others — still non-editable in substance, just a minor markup inconsistency worth knowing about if AoW's accordion gets touched.

**Orbit # — decimal support & reorder guard**
Orbit number inputs use `step="0.001"` and `parseFloat` (not `parseInt`). Typing an orbit# that would cross a neighbor in the sorted list is blocked by `_wouldReorder(item, isStar, newOrbitId)`: shows a popup "Use Drag & Drop — reorder orbital bodies by dragging and dropping." and reverts the field. Orbit# changes that stay within the current slot range auto-preview normally.

**`_buildSeedSys` AU derivation fix**
When a body's `orbitId` is set (by user or DnD), `_buildSeedSys` derives AU from `orbitId` rather than the stale stored `b.au`:
```javascript
au: b.orbitId != null ? (_orbitIdToAU(b.orbitId) ?? b.au ?? 1.0) : (b.au ?? 1.0)
```
Previously the orrery did not update after orbit changes because the stale `b.au` was fed to the generator.

**Gas Giant mainworld block**
The `☆MW` / `★MW` button is suppressed for bodies with `type === 'Gas Giant'`. Only the moons of a gas giant can be designated mainworld.

**Lunar mainworld type corruption — root cause and two-layer fix**

Root cause: `generateAtmospherics` in `mgt2e_world_engine.js` processes each Gas Giant's moons by creating a `fauxMoon` copy, forcing `fauxMoon.type = 'Satellite'` (so `processWorld` handles it generically), then rebuilding `syncRes = Object.assign({}, fauxMoon)` with `syncRes.type = 'Satellite'` hardcoded and replacing `w.moons[j] = syncRes`. This stamps every GG moon — including a designated lunar mainworld — as `type:'Satellite'` in the live system tree.

Two surfaces were broken by this:
- **Orrery** (`js/system_viewer.js`): reads `sys.worlds[n].moons` — was patched 2026-06-24 by making `_normalizeMgT2E` restore `type:'Mainworld'` on any moon whose `_id` matches `sys.mainworld._id` (defense-in-depth; this is still in place):
```javascript
const moons = (w.moons || []).map(m => {
    const moonIsMainworld = (mwId && m._id === mwId) || m.type === 'Mainworld';
    return moonIsMainworld ? Object.assign({}, m, { type: 'Mainworld' }) : m;
});
```
- **Hex editor accordion** (`js/hex_editor.js`): uses raw `m.type` directly with no normalization — was not fixed by the orrery patch and remained broken until the root-cause fix below.

Root-cause fix (2026-06-25, `js/mgt2e_world_engine.js`): restore the original type instead of hardcoding `'Satellite'`:
```javascript
syncRes.type = m.type; // was: syncRes.type = 'Satellite'
```
Both the orrery and accordion now correctly highlight a lunar mainworld. The `_normalizeMgT2E` patch in `system_viewer.js` is retained as defense-in-depth.

---

## 4. Known Issues / To Do

*See **Section 6** at the end of this document for the full outstanding work item and bug tracker.*

---

## 5. Deferred Engine Stub Inventory (v0.16.1 Handoff)

> ## ✅ PHASE A COMPLETE (signed off 2026-07-04) — v0.16.1 SEQUENCING (decided 2026-07-03; progress updated through 2026-07-04)
>
> Work on the next version happens in two strict phases. Phase A is now fully signed off — **Phase B (new engines) may begin.**
>
> **Phase A — Clean up and architect the System Editor, MgT2E only, no new engines touched: — ✅ ALL ITEMS DONE**
> 1. **OW-5** (Section 6, hard prerequisite): extract the commit path. **🟡 PARTIALLY DONE 2026-07-04, and that's the accepted final state** — see corrected OW-5 status in Section 6. `system_editor.js`'s own internal duplication (`_preview()` vs `_fillAndSave()`) is extracted into a shared `_generateAndCommit()`. The `macro_orchestrator.js` commit-block layer was deliberately scoped out (Sean's call, 2026-07-04) and does not block Phase A sign-off — revisit only if a future engine's macro and editor commit paths need to agree.
> 2. **OW-3** (Section 6, open, prioritized): implement the UWP Auditor step in Fill & Save. **✅ DONE for MgT2E, 2026-07-04** — see corrected OW-3 status in Section 6. Still needs its own per-engine hookup (a `sys.auditResult` attachment in each generator) before AoW/CT/T5/RTT can rely on it — that per-engine coverage is Phase B work, not a Phase A blocker.
> 3. **OW-8 (✅ DONE 2026-07-04, verified in-browser by Sean)** — the per-engine adapter/config pattern for `js/system_editor.js`. `_buildWorkingCopyFromState()`, `_buildSeedSys()`, and `_runGenerator()` each had a separate near-parallel `if/else if` branch per engine; this was the last item blocking Phase A sign-off. See OW-8 in Section 6 for the full implementation writeup. The same 2026-07-04 audit that raised this also turned up two smaller items, both done: **OW-6 (✅ DONE)** — seed-restoration matching logic that lived inline in `mgt2e_bottomup_generator.js` is now `js/seed_restoration.js`; **OW-7 (✅ DONE)** — the `MgT2EMath` guard-consistency fix and the duplicated auditor-logging cleanup (now `MgT2E_UWP_Auditor.runAndLog()`), see Section 6.
>
> **Phase B — Expand to additional engines (now unblocked):**
> Bring engines online one at a time per the per-engine remaining-work lists in Section 5 below (CT needs field-level `isManual` gating; T5 needs both structural and field-level gating plus Algorithm 7; RTT needs broader field-level gating). Each engine's UI entry point (`canvas_input.js`/`system_viewer.js` gates, `hex_map.html` dialog radio buttons) should only be switched on once that engine's generator work *and* its own UWP-auditor coverage are both complete — OW-3's auditor work from Phase A does not automatically cover new engines, each needs its own. Per OW-8, bringing each engine online should also mean giving it its own adapter in `_ENGINE_ADAPTERS` (see Section 6) instead of adding another inline branch.
>
> **CT is now fully online (2026-07-04) — first engine through the full Phase B sequence:**
> 1. Field-level `isManual` gating for size/atm/hydro/pop (`ct_world_engine.js` + `system_editor.js`'s `_ctUwpLockFor`)
> 2. `capturedPlanets` write-stub gap closed (`system_editor.js`)
> 3. UWP-auditor coverage (`sys.auditResult`, `ct_uwp_auditor.js`'s new `runAndLog`, wired into `ct_system_driver.js`)
> 4. `_ENGINE_ADAPTERS.CT` entry (OW-8 pattern) — CT's old inline branches deleted from all four call sites
> 5. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` CT radio button all now include/enable CT
>
> **Companion fix found while flipping item 5:** `_restoreDisplayManualFields()` (`system_editor.js`) was `MgT2E`-only — without a CT branch, every pre-existing CT body's `atm`/`hydro`/`pop` (marked manual purely for seed-preservation by `_ctUwpLockFor`, item 1) would have displayed as "manually edited" in the accordion after every Fill & Save, even on bodies the user never touched. Added a CT branch reading `newSys.orbits[].contents` + `newSys.capturedPlanets[]` (CT's shape, vs. MgT2E's flat `.worlds[]`) and matching moons via `.satellites` (not `.moons`). `_regenerateBody()`'s per-body regenerate feature and the Hill-sphere/moon-orbital-data backfills remain MgT2E-only by design (CT doesn't model moon pd/pos/eccentricity, and `_regenerateBody` already warn-and-refuses gracefully on non-MgT2E systems) — not gaps, not touched.
>
> **T5 is now fully online (2026-07-05) — second engine through the full Phase B sequence:**
> 1. Structural `seedSys` gating in `js/t5_topdown_generator.js`: `generateT5System(mainworldBase, seedSys)` now accepts a second parameter — seeded stars skip the homestar-string-parsing/default-star fallback; seeded bodies are placed at their own orbits in a dedicated pass that runs *before* Phase 1 (the mainworld anchor placement), not after Phases 3-5 like a naive port of CT's pattern would suggest — this ordering is required so a moon-mainworld's parent body is already sitting in `orbits[].contents` by the time Phase 1 looks for it via the new `mainworldBase.parentBodyId`/`parentStarIdx` fields (avoids re-synthesizing a fresh GG/BigWorld parent on every save). `ggCountTotal`/`beltCountTotal`/`otherTerrTotal` dice rolls and moon-count rolls (`generateT5Satellites`'s new `capToExisting` param) are all gated to 0/capped when seeded and `_allowAddBodies` is false.
> 2. Field-level manual preservation via a new `_t5UwpLockFor` helper (`system_editor.js`, mirrors `_ctUwpLockFor`'s exact scope: worldType/size seeded unmarked, atm/hydro/pop locked via `_manualFields` since T5's Inferno/Belt/small-size branches force-overwrite those regardless of presence). T5's world engine already had full `_isManual` gating for worldType/size/atm/hydro/pop/starport/gov/law/tl/tradeCodes going in — gov/law/tl/starport left deliberately unlocked this pass, matching CT's own deferred scope, but extending later is low-risk since the engine-side guards already exist.
> 3. **Algorithm 7 implemented** (`_t5ElectMainworldIfNeeded`, `system_editor.js`) — adapted from the manifest's original spec to run over **working-copy** bodies rather than post-generation candidates, since T5 needs its mainworld anchor *before* generation starts (unlike CT/MgT2E's post-roll election). Excludes only top-level Gas Giants from candidacy (moons of anything remain eligible), uses the global seeded `rng` for tie-breaks, and deliberately does not mark the auto-elected body `_manualFields: ['isMainworld']` (contrast the explicit `_setMainworld()` toggle) so it doesn't paint as user-edited in the accordion.
> 4. UWP-auditor coverage: `t5_uwp_auditor.js`'s `runT5SystemAudit` now returns `{ pass, errors }` (previously returned nothing — a real, if dormant, pre-existing gap) plus a new `runAndLog(sys, hexId)` mirroring CT's/MgT2E's, wired into `system_driver.js`'s T5 finalization block. The dead `T5_Auditor.auditT5System` reference inside `t5_topdown_generator.js` (referred to a method that never existed anywhere in the codebase, always a silent no-op) was removed in favor of the single real call site in `system_driver.js`.
> 5. `_ENGINE_ADAPTERS.T5` entry (OW-8 pattern) — T5's old inline branches deleted from all four call sites (`_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, `_runGenerator`); new `_restoreDisplayManualFields` T5 branch added (T5's generated shape: `newSys.stars[].orbits[].contents`, moons keyed `.satellites` like CT, not `.moons` like MgT2E).
> 6. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` T5 radio button all now include/enable T5.
>
> **Real bug found and fixed during in-browser verification (2026-07-05):** `T5.readBodies()`'s per-star fallback (`raw.stars[].orbits[].contents`, used whenever the generated system has no flat `raw.worlds[]`) built each working-copy body via `Object.assign({}, slot.contents, {...})` without first checking `slot.contents` was non-null. For an **empty** orbit slot (`contents: null`, ~18 of 20 orbits in a typical 2-body system), `Object.assign({}, null, {...})` still produces a plain object with no `type` field, and the old filter (`w.type !== 'Empty'`) let it through since `undefined !== 'Empty'` is true — every empty orbit silently became a phantom body on re-edit. This is a genuinely pre-existing gap (the exact same unguarded pattern was already in the original inline branch before this pass), just never reachable before because Fill & Save didn't actually work for T5 until this session. Fixed by filtering out null-content slots before the `Object.assign`. Found via an end-to-end Playwright browser test (create → add bodies → Preview → Fill & Save → re-edit → move a body → Fill & Save again), not by static reading — re-editing a freshly-saved T5 system was the reproduction case.
>
> **Verified in-browser (Playwright, 2026-07-05):** Create New (T5) with a Terrestrial World + Gas Giant and no mainworld flagged → Algorithm 7 correctly elected the World (never the GG) → Preview succeeded → Fill & Save committed exactly the 2 seeded bodies with no extra rolled bodies (`_allowAddBodies` unchecked) → System Viewer rendered the system correctly (habitable-zone ring, mainworld highlighted) → re-opened Edit System → moved the Gas Giant to a new orbit via a realistic click+type+Tab interaction → Fill & Save again → new orbit position persisted correctly, mainworld undisturbed. Zero console/page errors throughout.
>
> **RTT is now fully online (2026-07-04) — third engine through the full Phase B sequence:**
> 1. Field-level manual preservation extended in `js/rtt_engine.js`. The file already had more save/restore coverage than this manifest previously documented (`processRTTPhysicalStatsPartA`/`PartB` already gated `size`/`atmosphere`/`hydrosphere`/`chemistry`/`biosphere`; `calculateRTTDesirability`/`checkRTTTerraforming`/`determineRTTHabitation` already gated their own fields) — the real gaps were `worldClass` (no guard at all in `classifyRTTBody`, now fixed with an `isManual(body,'worldClass')` early-return, plus a matching guard on Step3's "boiled-away" star-expansion override) and `processRTTSocialStats`'s social fields: `population`/`government`/`lawLevel`/`starport`/`tl` are now added to the existing `_rttSaveManual`/`_rttRestoreManual` field list, **and** given their own inline `isManual` guards inside the Uninhabited early-`return` branch specifically — that branch returns before the outer restore call ever runs, so a field added only to the outer save/restore list would have silently lost its manual value on every Uninhabited body. `applyRTTOrbitalNames` (`js/core.js`) now checks `isManual(b, 'name')` instead of an implicit `!b.name` truthy check.
> 2. UWP synthesis gap closed: RTT bodies never carried their own `.uwp` field (only the flat mainworld summary did). Extracted the UWP-string formula out of `extractRTTMainworld` into a new reusable `computeRTTBodyUWP(body)` (`js/rtt_engine.js`), used both by `extractRTTMainworld` (no behavior change) and by the System Editor's RTT `readBodies` (previously hardcoded `uwp: null` for every body).
> 3. UWP-auditor coverage: `auditRTTSystem(sys)` (already existed, already auto-called inside `extractRTTMainworld`) now returns `{ pass, errors }` instead of nothing, and the result is attached as `sys.auditResult` at its call site — no new file needed (unlike CT/T5's separate `*_uwp_auditor.js` modules), since RTT has no separate driver file to wire a second module into; all of RTT's generation logic already lives in the one `rtt_engine.js` file.
> 4. `_ENGINE_ADAPTERS.RTT` entry (OW-8 pattern) — RTT's old inline branches deleted from all four call sites. New `_rttUwpLockFor` helper mirrors `_ctUwpLockFor`/`_t5UwpLockFor` but — unlike either — must mark **every** locked field (`worldClass`/`size`/`atmosphere`/`hydrosphere`/`population`/`government`/`lawLevel`/`starport`/`tl`) manual, not just a size-is-presence-gated subset: RTT's preservation mechanism is purely `isManual()`-based everywhere, with no CT/T5-style `field === undefined` fallback guard to lean on. New `_restoreDisplayManualFields` RTT branch added (RTT's generated shape: `newSys.stars[].planetarySystem.orbits[]`, moons keyed `.satellites`).
> 5. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` RTT radio button all now include/enable RTT.
>
> **Real bug found and fixed during in-browser verification (2026-07-04):** two, actually. First, the adapter's `write()` (seed-building) was hardcoding `zone: 'Inner'` for every body regardless of its actual zone — RTT's seeded path (`generateRTTSectorStep2`) uses the seed's zone verbatim rather than recalculating it from orbit position the way CT does, so this would have silently reclassified e.g. an Outer-zone body as Inner on every Fill & Save, changing which physical-stat roll branches applied to it. Fixed by reading the real zone from `_raw.zone`. Second and more serious: `generateRTTSectorStep1`'s seeded-star branch never set `star.classification`/`star.luminosityClass` on a brand-new star (no prior `_raw` to inherit them from) — several functions (`calculateRTTDesirability`, `checkRTTTerraforming`, others) read `star.classification.includes(...)` unconditionally, throwing `TypeError: Cannot read properties of undefined (reading 'includes')` the instant any body was added to a newly-created RTT system, blocking Preview and Fill & Save entirely. Found via an end-to-end Playwright browser test (create → add bodies → Preview → Fill & Save → re-edit → move a body → Fill & Save again) — 100% reproducible, not an edge case. Fixed by backfilling both fields on the seeded star using the same string-formatting convention already used a few lines below in the non-seeded roll path (`${type}-${luminosityClass}`, or the luminosity class alone for `'D'`/`'L'`) — deliberately *not* running the dice-driven evolution roll itself, since a seeded/user-picked star must be used as-is, never rerolled (same principle as Algorithm 6).
>
> **Verified in-browser (Playwright, 2026-07-04):** Create New (RTT) with a Terrestrial World + Gas Giant and no mainworld flagged → Preview succeeded (previously crashed here) → `extractRTTMainworld`'s own scoring election ran automatically, no dialog → Fill & Save committed with a valid UWP (`E9CF200-F` in the verification run) and `auditResult.pass: true` → re-opened Edit System → same 2 bodies shown, no phantom entries, UWP preserved → moved a body to a different orbit (typed-field reorder correctly redirected to drag-and-drop via the existing `_wouldReorder` guard, then via drag-and-drop) → Fill & Save again → no errors. Zero console/page errors throughout both verification passes (the second pass confirmed 0 errors against the same script that had produced 10 identical TypeErrors before the fix).
>
> **AoW is now fully online (2026-07-05) — the last engine through the full Phase B sequence, closing OW-9.** The 2026-07-05 pre-implementation audit found AoW's gap was architectural rather than a normal gating pass (see the OW-9 summary retained below for the full evidence trail), which changed the plan from CT/T5/RTT's 5-item sequence into a larger build:
> 1. **New module `js/aow_seed_bridge.js`** (didn't exist before this pass) — a star-physics solver (bisection-searches `initialMass` from a chosen spectral type against the existing Red Dwarf/Main Sequence tables, no jitter applied per design decision, Brown Dwarf/White Dwarf collapse to a representative mass since AoW's own Step 7 displays both as fixed labels regardless of exact temperature), system-age window reconciliation across multiple stars (returns a conflict descriptor rather than silently picking an inconsistent age), a hierarchy/orbit mapper (editor's flat `stars[]`+`parentStarId` → AoW's hierarchy string + per-pair orbit records), and a disk-worksheet synthesizer that reuses `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet` (newly exposed on its public API) rather than duplicating that math.
> 2. **`js/aow_world_engine.js`** — `isManual()` guards threaded into the ~6 functions/single points that actually compute the fields the editor exposes (`stepPhysicalParameters`'s density/radius/surfaceGravity, `generateAlbedo`, `applyUWPPhysicals`'s size/atm/hydro digit classifiers). The other ~20 fields across the 13 Phase-3 functions (M-number, blackbody temp, grand-tack flags, etc.) are pure internal simulation state the editor never exposes — left fully random, no gating added, matching the same principle CT/T5 used for their own internal-only fields.
> 3. **`js/aow_bottomup_generator.js`** — Phase 1 now calls the bridge's solver/hierarchy-mapper when seeded (instead of unconditionally skipping); Phase 2 synthesizes disk worksheets from the resolved stars + seeded bodies before Phase 3 runs; Phase 3's 13 functions were already called unconditionally in the old code (the bug was never a skip-guard, it was that `sys.diskWorksheets` was simply never populated) and now have real worksheets to operate on. Also fixed, found during this wiring: `populateAoWWorldsList` was gated to skip whenever seeding controlled body count (correct in the old code where nothing would have been there to flatten, but now strands all of Phase 3's computed physics inside `diskWorksheets` if left skipped) — now runs whenever worksheets exist; a `sys.mainworld` gap where the `seedSys._mainworldRef` direct-lookup branch never set `isMainworld`/`type`/`sys.mainworld` itself (only `generateMainworldSelection` did), silently skipping all of Phase 5's Social Sweeps for any AoW system with a user-designated mainworld — never triggered before since AoW wasn't UI-exposed, but real; and the `age`/`systemAge` field-name mismatch (the seed carried `age`, every formula reads `systemAge`) is now fixed by having the bridge write directly to `sys.systemAge`.
> 4. **New file `js/aow_uwp_auditor.js`** — didn't exist at all before this pass, despite being `require()`d by `aow_bottomup_generator.js`'s own module wiring (the audit call was permanently dead code). Built mirroring `t5_uwp_auditor.js`'s `runAndLog` shape: mainworld-count structure check, belt-size integrity, satellite-vs-parent size, population cap — all wired through `sys.auditResult` the same way CT/T5 already work.
> 5. **`_ENGINE_ADAPTERS.AoW` entry** (OW-8 pattern) — AoW's old inline `else if (engine === 'AoW')` branches deleted from all four call sites (`_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, `_runGenerator`). Deliberately thin per design decision 5 — the adapter's `write()` just carries working-copy bodies through with the fields the bridge needs; the actual field-locking logic lives in `aow_seed_bridge.js`, not `system_editor.js`.
> 6. **Companion topology restricted at build time, not just Fill time** (design decision 3) — `_addStar()` now caps AoW systems at 4 stars and requires a 4th star to pair with the most recently added companion, matching the 5 hierarchy shapes `mapHierarchy()` actually supports. A flat 3+-companion arrangement is also generally astrophysically unstable, so this is a fidelity fix, not just a UI restriction.
> 7. **Age-conflict warn-and-proceed dialog** (design decision 2) — when manually-chosen spectral types across stars imply system-age windows with no overlap, `_fillAndSave()` shows a dialog (`[Proceed Anyway]` / `[Go Back & Fix]`) rather than silently picking an inconsistent age, reusing the same UI pattern as the OW-3 audit gate.
> 8. UI switches flipped: `canvas_input.js`'s `_seCanEdit` gate, `system_viewer.js`'s Edit-button gate, and `hex_map.html`'s `#se-engine-dialog` AoW radio button all now include/enable AoW.
>
> **Real bug found and fixed during in-browser verification (2026-07-05), same pattern as T5/RTT's own verification passes:** `stepNaturalSatellites` (Step 17, called immediately after `stepPhysicalParameters` inside `generatePhysicals` — one of the 13 Phase-3 functions already confirmed to run unconditionally) requires `planet.Rmin` for its Hill Radius calculation, but `Rmin`/`Rmax` are normally set by `generateOrbitalDynamics` (Chunk 5) — which stays deliberately skipped for seeded systems (eccentricity isn't an editor-exposed field for a body's own orbit). This dependency was missed during the original 13-function trace (which focused on `stepPhysicalParameters`'s need for `planet.mass`) because it's a same-function-call cross-dependency, not an isManual-gating question. Reproduced 100% of the time: create an AoW system, add any body via "+World"/"+GG", Preview → `TypeError: Cannot read properties of undefined (reading 'toFixed')` at `aow_world_engine.js:1398`, caught and shown as a "Preview Error" dialog (not a silent failure, but blocking). Fixed in `aow_seed_bridge.js`'s `synthesizeDiskWorksheets()` by seeding `Rmin: orbitalRadius, Rmax: orbitalRadius` on each synthesized planet (zero-eccentricity default) — matching the exact convention `aow_world_engine.js` itself already uses for its own no-eccentricity case (`generateOrbitalDynamics` line ~885-886).
>
> **Verified in-browser (Playwright, 2026-07-05):** Create New (AoW) with a G2V primary → added a K5V companion (Main Sequence, no age conflict) → added a Terrestrial World + Gas Giant under the primary → Preview succeeded (previously crashed here before the fix above) → Fill & Save committed with a valid UWP (`E9C0273-9` in the verification run) → System Viewer rendered correctly → re-opened Edit System → mainworld correctly shows as elected (★MW filled) with the same UWP, no phantom bodies, companion's spectral type preserved → dragged a body via drag-and-drop → Fill & Save again → no errors. Separately verified: (1) age-conflict path — G2V primary + White Dwarf companion → "Star Ages Conflict" dialog appeared with the exact expected per-star age windows, instead of a silent/incorrect result; (2) topology restriction — adding 2 companions directly to the primary succeeded (valid Trinary A-B,C shape), adding a 3rd companion the same way was correctly blocked with "Unsupported Star Arrangement", directing the user to the most-recently-added companion's own "+Comp" button. Zero console/page errors throughout all three passes after the Rmin/Rmax fix.
>
> **One UX gap noted, not fixed (minor, not a blocker):** after Preview auto-elects a mainworld, the editor's own tree still shows the unfilled "☆MW" icon on the winning body until the editor is closed and reopened — the underlying election is correct (confirmed via re-opening Edit System, which shows the filled "★MW" and correct UWP), but the live Preview pass doesn't refresh that specific icon in place. Cosmetic; worth a follow-up if it's ever confusing in practice.

T5 and RTT are both fully online (see their own "is now fully online" notes above/below) — the earlier text here calling them stub-only was stale by the time this note was last touched.

> **⚠️ Verify before trusting a "Known gap" claim in this section.** A manifest-vs-code review on 2026-07-03 found that CT and RTT had both progressed further than this section documented — CT's structural `seedSys` gate was already implemented despite this section claiming otherwise, and RTT's full Step1→Step2→Step3→Biographer pipeline was already threaded and auto-chaining despite this section claiming only Step1 ran. Line-number citations (`lines ~XXX–YYY`) also drift as the file is edited and should not be trusted at face value. Each "Known gap" bullet below that has been re-verified carries a **Confirmed** line with the exact command/grep used and a date — re-run it before relying on the claim. Bullets without a **Confirmed** line have not been re-checked since original authoring and should be treated as unverified.

---

### CT (Classic Traveller)

**Read stub — `_buildWorkingCopyFromState()`, CT branch (search for `engine === 'CT'` in `system_editor.js`; cited line numbers drift — do not trust `~177–206` at face value)**
- Reads bodies from `raw.orbits[]` (each slot: `{ orbit, zone, distAU, contents }`) — skips `type === 'Empty'`
- Gas Giant size: `contents.size === 'S'` → `ggType: 'GS'`, else `'GL'`
- Also reads `raw.capturedPlanets[]` as orbitless bodies (no `orbitId`, no moons)
- All bodies assigned `parentStarId` of the primary star (index 0) — CT does not use multi-star parentage in the bottom-up generator
- CT companion orbit strings ("Close"/"Near"/"Far") produce `orbitId: null` and sort to end of merged list

**Write stub — `_buildSeedSys()`, CT branch — UPDATED 2026-07-04 (Phase B, items 1 & 2, DONE)**
- Produces `seed.orbits[]`: each entry `{ orbit, zone: 'H', distAU, contents }`
- `contents` format: `{ _id, type, size, atm?, hydro?, pop?, name, uwp, travelZone, satellites[], _manualFields[] }`
- Type mapping: `'Gas Giant'` → `'Gas Giant'`; `'Belt'` → `'Planetoid Belt'`; else `'Terrestrial Planet'`
- GG size: `ggType === 'GS'` → `size: 'Small'`; else `size: 'Large'` (unchanged; unrelated to the physical-digit lock below, and left as-is — see note under Bug tracker about a pre-existing `'S'`-vs-`'Small'` mismatch between this and the read stub that was noticed but not touched)
- Zone field hardcoded to `'H'` — the generator will recalculate zones from orbit position
- **`_ctUwpLockFor(body)`** (function-scoped inside the CT branch, mirrors `_mgt2eUwpLockFor`'s role) — reads the body's previous generated values off `b._raw` (`size`/`atm`/`hydro`/`pop`) and seeds them into `contents`. `atm`/`hydro`/`pop` are also pushed into `_manualFields` so the generator won't reroll them; `size` is seeded but **not** marked manual — `generatePhysicals`'s existing `body.size === undefined` guard already skips rerolling it, same reasoning as MgT2E's own `size` field. Brand-new bodies (no `_raw`/`uwp` yet) get `{}` back and roll fresh, same as before.
- ✅ **Done (Phase B item 2, 2026-07-04): `capturedPlanets` now populated.** `wc.bodies` is split by `orbitId != null` (regular orbit-slot bodies → `seed.orbits`, unchanged) vs. `orbitId == null` (captured planets — the only way a CT body ends up with a null `orbitId`, since `_addBody` always assigns a real one) → new `seed.capturedPlanets` array. Each entry: `{ _id, type: 'Captured', orbit, zone, size?, atm?, hydro?, pop?, name, uwp, _manualFields[] }`, with `orbit`/`zone` carried forward unchanged from `b._raw` (no UI exists to move a captured planet — drag-and-drop and the typed orbit# field both operate on `orbitId`, which captured planets don't have). `_id` is required: `ct_system_driver.js`'s mainworld-by-`_id` lookup (~line 69-71) already searches `seedSys.capturedPlanets` when `_mainworldRef` points at one — that lookup was ready and waiting, only the write stub wasn't producing the array. Both `generateSystemSkeleton` (`ct_bottomup_generator.js` ~line 135, `if (seedSys.capturedPlanets) sys.capturedPlanets = seedSys.capturedPlanets.slice();`) and the mainworld lookup were already ready to consume this — only the write stub had the gap.
  **Companion fix, same pass:** the read stub (`_buildWorkingCopyFromState`, CT capturedPlanets branch) was hardcoding `_manualFields: []` instead of reading `w._manualFields` like its sibling `raw.orbits` loop does — fixed to match, since without it a captured planet's manual fields wouldn't survive a close-and-reopen of the editor.
  **Known edge case, not fixed (pre-existing, out of scope):** `generateSystemSkeleton`'s seeded-body branch only activates `if ((seedSys.orbits || []).length > 0)` — a CT system consisting *solely* of captured planets (zero regular orbit bodies) would fall through to full stochastic regeneration, discarding the seeded captured planets too. Rare in practice; not addressed here.
  **Confirmed:** `node --check js/system_editor.js` passes.

**Dispatch stub — `_runGenerator()`, CT branch**
- Calls `window.CT_Generator.generateSystem({ mode: 'bottom-up', hexId, seedSys })`
- Writes `stateObj.ctSystem = newSys` and `stateObj.ctData = newSys.mainworld || null`

**Generator gate status — `js/ct_bottomup_generator.js` / `js/ct_world_engine.js` — UPDATED 2026-07-04 (Phase B, item 1, DONE):**
- ✅ **Done — structural seeding.** `generateSystemSkeleton(hexId, seedSys)` already consumes `seedSys.stars` (uses them directly, skips the stellar dice roll) and `seedSys.orbits` (uses the seeded body list directly, skips skeleton placement, when `_allowAddBodies` is false). User-placed/moved/deleted bodies already survive Fill & Save structurally.
  **Confirmed:** read `generateSystemSkeleton()` in full — the `if (seedSys && ...)` branches are real and functional, not stubs.
- ✅ **Done — field-level manual preservation for size/atm/hydro/pop.** `ct_world_engine.js`'s `generatePhysicals()` and `generatePopulation()` now check a new `_ctFieldIsManual(obj, field)` helper (a safe wrapper around core.js's `isManual`, following the same `typeof`-guard convention already used for `tRoll2D`/`MgT2EMath` elsewhere in this file) before rolling `atm`/`hydro`/`pop`. Style note: unlike `mgt2e_world_engine.js` (which always rolls, then conditionally assigns, because GG mass/gravity chains need the rolled diameter regardless of which field is manual), CT skips the roll entirely when a field is manual — mirroring `t5_topdown_generator.js`'s `_isManual` pattern instead, since CT's atm/hydro/pop each only feed forward as *already-resolved* values (`body.atm`, `body.size`), not as intermediate roll results other fields depend on. The pre-existing `body.size === undefined` guard was left as the sole size gate (no `isManual` needed, matching MgT2E's own reasoning for `size`). The Vacuum World Exception (`liquidType`) check was hoisted out of the hydro roll's `else` branch so it still evaluates correctly when hydro is manual.
  **Not gated (deliberately, this pass):** government/law/tech-level/starport — those roll in a separate pass (`finalizeMainworldSocial`/`generateSocial`), not `internalPhysicalPass()`. Treated as a follow-up item, not folded into this one.
  **Confirmed:** `node --check js/ct_world_engine.js` and `node --check js/system_editor.js` both pass.
- **CT is fully editor-ready as of 2026-07-04.** All five Phase B items (field-level gating, `capturedPlanets`, UWP-auditor coverage, `_ENGINE_ADAPTERS` entry, UI exposure) are done — see the "CT is now fully online" note under v0.16.1 SEQUENCING above for the full rundown. Gov/law/tech-level/starport gating remains a known, deliberately-deferred follow-up (not a blocker — see the field-level note just above).

**UI exposure — `js/canvas_input.js` / `js/system_viewer.js` / `hex_map.html` — DONE 2026-07-04 (Phase B, item 5):**
- `canvas_input.js`'s `_seCanEdit` right-click gate now includes `_seState.ctData || _seState.ctSystem` alongside the existing MgT2E check.
- `system_viewer.js`'s "Edit System" button now renders `if (edition === 'MgT2E' || edition === 'CT')`.
- `hex_map.html`'s `#se-engine-dialog` CT radio button is no longer `disabled`, and the "(coming soon)" label is removed — matching the MgT2E option's styling. T5/AoW/RTT radios remain disabled.
- The dialog's confirm handler (`system_editor.js` ~line 2790) and `_buildBlankWorkingCopy()` were already fully engine-agnostic (read whichever radio is checked, no hardcoded engine name) — no changes needed there for "Create New" to work with CT.
- **Confirmed:** `node --check` passes on all three touched JS files. Cannot verify in-browser this session — first real end-to-end test (Create System, Edit System, Fill & Save, Preview, undo/redo) is now unblocked and up to Sean.

**UWP-auditor coverage — `js/ct_uwp_auditor.js` / `js/ct_system_driver.js` — DONE 2026-07-04 (Phase B, item 3):**
- ✅ **Done.** Added `runAndLog(sys, hexId)` to `ct_uwp_auditor.js`, mirroring `MgT2E_UWP_Auditor.runAndLog` (`mgt2e_uwp_auditor.js:400-423`, added under OW-7) — runs `auditCTSystem`, attaches the result to `sys.auditResult` (the field `system_editor.js`'s Fill & Save OW-3 gate reads — that gate is engine-agnostic, so it required no changes), and on failure `console.warn`s plus pushes each error to `window.auditBacklog` as `{ hexId, orbitId: null, engine: 'CT', message }`. `orbitId` is always `null` for CT since `auditCTSystem`'s `errors` array holds plain strings (not MgT2E's `{orbitId, message}` objects) — irrelevant to the Fill & Save dialog either way, since it only reads `audit.errors.length` for a count.
- `ct_system_driver.js`'s `generateSystem()` (the function CT's System Editor dispatch always calls, both bottom-up and top-down) now does `sys.audit = auditRunAndLog ? auditRunAndLog(sys, hexId) : auditor(sys);` in place of the old bare `auditor(sys)` call — `sys.audit` keeps working for existing consumers (same result object), `sys.auditResult` is now also set as a side effect. The existing `writeLogLine`-based trace logging right below this line is untouched (a different, complementary consumer — in-app trace log vs. `runAndLog`'s console/backlog).
- **Not done, deliberately out of scope:** `ct_bottomup_generator.js`/`ct_topdown_generator.js` still don't call the full auditor themselves (only a couple of narrow hand-written edge cases go straight to `auditBacklog`) — no duplication existed to consolidate here (unlike MgT2E's OW-7, which had two call sites), so no `runAndLog` call was added to either generator file. `system_driver.js` (the separate "Universal" driver used for T5 and some MgT2E regen paths) has its own CT-audit-attaching code but is never reached by CT's System-Editor dispatch — left untouched.
- **Confirmed:** `node --check js/ct_uwp_auditor.js` and `node --check js/ct_system_driver.js` both pass. CT is now UI-exposed (item 5, done later the same session) — the Fill & Save dialog itself still hasn't been exercised in-browser; that's the first real end-to-end test, up to Sean.

**`_ENGINE_ADAPTERS` entry — `js/system_editor.js` — DONE 2026-07-04 (Phase B, item 4, per the OW-8 pattern):**
- ✅ **Done.** CT now has its own adapter (`_ENGINE_ADAPTERS.CT`, added right after `MgT2E` in the registry) with all four methods — `detect`, `readBodies`, `write`, `run` — moved verbatim from CT's old inline `else if (engine === 'CT')` branches in `_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, and `_runGenerator`, which were then deleted (all four call sites already had the generic `if (adapter) { ...delegate... }` check from OW-8, so no call-site changes were needed beyond adding `_ENGINE_ADAPTERS.CT.detect(stateObj)` to `_detectEngine`, mirroring its existing `_ENGINE_ADAPTERS.MgT2E.detect(stateObj)` line).
- `_ctUwpLockFor` (added under item 1) was hoisted from `write`'s function body up to module scope, alongside `_mgt2eUwpLockFor` — matching OW-8's "define once, not per-call" optimization for MgT2E's equivalent helpers.
- `write(wc, starIdxById)` keeps the two-parameter shape documented in the adapter interface comment even though CT's `starIdxById` argument goes unused (CT bodies are always parented to the primary star in the bottom-up generator) — kept for signature consistency with MgT2E's adapter, not because CT needs it.
- AoW's copy of the old shared `MgT2E`/`AoW` inline branches (untouched by Phase A) is unaffected — CT and AoW were always separate branches, this pass didn't touch AoW.
- **Confirmed:** `node --check js/system_editor.js` passes; `grep "'CT'" js/system_editor.js` shows only the new adapter's `detect()` and the pre-existing, unrelated CT-specific companion-star `orbitAU` branch in the shared star-building loop (not part of the adapter interface, correctly left alone since only MgT2E's star-building was ever centralized the same way).

---

### T5 (Traveller 5)

**T5 is fully editor-ready as of 2026-07-05.** All items below are DONE — `_ENGINE_ADAPTERS.T5` in `system_editor.js` now owns `detect`/`readBodies`/`write`/`run` (the old inline branches this subsection originally documented were deleted). Kept below as historical context on what was built and why; see "T5 is now fully online" under v0.16.1 SEQUENCING (Section 5 header) for the full rundown.

**Read stub → `_ENGINE_ADAPTERS.T5.readBodies()`**
- Reads from `raw.worlds[]` (flat list) if present; falls back to iterating `raw.stars[].orbits[]` slots
- `parentStarIdx` preserved from world objects or inferred from the star index when iterating slots
- `au` resolved as `w.au ?? w.distAU ?? _orbitIdToAU(w.orbitId)` in that priority order; `orbitId` falls back to the slot's own index (`slot.orbit`) when the body itself doesn't carry one
- UWP preserved from body objects
- **Bug fixed (2026-07-05):** the per-star fallback path built each body via `Object.assign({}, slot.contents, {...})` without first checking `slot.contents` was non-null — an empty orbit slot (`contents: null`) still produced a typeless object that the old `type !== 'Empty'` filter let through, turning every empty orbit into a phantom body on re-edit. Fixed by filtering out null-content slots before the `Object.assign`. Found via in-browser testing (create → save → re-edit), not static review.
- Moon-level mainworld detection also fixed: a moon flagged as the system's mainworld doesn't reliably carry `isMainworld: true` from the generator (`t5_topdown_generator.js` never sets it explicitly on `sys.mainworld`) — now detected the same way top-level bodies are (`_isMW`/`type === 'Mainworld'`) before handing off to the shared `_buildMoon` helper.

**Write stub → `_ENGINE_ADAPTERS.T5.write()`**
- Runs Algorithm 7 (`_t5ElectMainworldIfNeeded`) first, so an unflagged mainworld gets auto-elected before the seed is built
- Builds `seed.mainworldUWP`: extracts UWP, name, travelZone from the resolved mainworld body/moon, plus `isPreMoon`/`orbitId`/`parentBodyId`/`parentStarIdx` (so the generator can place a moon-mainworld under its actual seeded parent instead of a fresh roll) and locked physical fields via `_t5UwpLockFor`. Retains the `'A788899-9'` fallback UWP for a body with no UWP yet (brand new, not a gap — the generator rolls a fresh one)
- Produces `seed.worlds[]` via `_t5BodySeed()`, now including moons and locked fields (previously a bare `{_id, type, name, uwp, orbitId, parentStarIdx, _manualFields}` with no moons array at all — seeded moons used to be silently dropped before ever reaching the generator)

**Dispatch stub → `_ENGINE_ADAPTERS.T5.run()`**
- Calls `window.System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: seedSys.mainworldUWP, hexId, seedSys })`
- Guard: skips if `seedSys.mainworldUWP` is null — now correctly reachable only when the working copy has zero eligible bodies (Algorithm 7 step 6), not effectively-always-null as before
- Writes `stateObj.t5System = newSys` and `stateObj.t5Data = newSys.mainworld || null`
- ✅ **Done:** `js/t5_topdown_generator.js`'s `generateT5System(mainworldBase, seedSys)` now accepts and fully consults `seedSys` — structural seeding, `_allowAddBodies` gating, and Algorithm 7 are all implemented; see Section 5 header for the full writeup.

---

### RTT (RTT Worldgen)

**RTT is fully editor-ready as of 2026-07-04.** All items below are DONE — `_ENGINE_ADAPTERS.RTT` in `system_editor.js` now owns `detect`/`readBodies`/`write`/`run` (the old inline branches this subsection originally documented were deleted). Kept below as historical context on what was built and why; see "RTT is now fully online" under v0.16.1 SEQUENCING (Section 5 header) for the full rundown.

**Read stub → `_ENGINE_ADAPTERS.RTT.readBodies()`**
- Reads from `raw.stars[].planetarySystem.orbits[]` — iterates per star, sorted by `orbitNumber`
- AU is approximated from zone: Epistellar (base 0.10AU, step 0.10), Inner (base 0.50AU, step 0.70), Outer (base 5.00AU, step 8.00), via a shared `_rttOrbitAU()` helper. These are estimates for display order only — RTT does not use AU natively.
- ✅ **Done:** UWP is now synthesized per-body via `computeRTTBodyUWP()` (`rtt_engine.js`, extracted from `extractRTTMainworld`'s formula) instead of the old hardcoded `uwp: null`.
- Travel zone: `'Red'` if body has a `'Z'` base; else `'G'`

**Write stub → `_ENGINE_ADAPTERS.RTT.write()`**
- Produces `seed.rttBodies`: a 2D array indexed by star (`rttBodies[starIdx][]`)
- Per-body format: `{ _id, orbitNumber, zone, type, satellites[], name, _manualFields[] }`
- Type mapping: `'Gas Giant'` → `'Jovian Planet'`; `'Belt'` → `'Asteroid Belt'`; else `'Terrestrial Planet'`
- ✅ **Fixed:** `zone` is now read from `_raw.zone` (falling back to `'Inner'` only for brand-new bodies) instead of being hardcoded to `'Inner'` for every body — RTT's seeded path uses the seed's zone verbatim rather than recalculating it from orbit position, so the old hardcode would have silently reclassified e.g. an Outer-zone body as Inner on every Fill & Save.
- New `_rttUwpLockFor(body)` helper seeds and marks manual: `worldClass`/`size`/`atmosphere`/`hydrosphere`/`population`/`government`/`lawLevel`/`starport`/`tl` — all of them, unlike CT/T5's lock helpers, since RTT's preservation mechanism has no presence-based fallback guard to lean on for any field.

**Dispatch stub → `_ENGINE_ADAPTERS.RTT.run()`**
- Calls `generateRTTSectorStep1(hexId, { seedSys })`
- Writes `stateObj.rttSystem = newSys`
- Calls `extractRTTMainworld(newSys, seedSys._mainworldRef)` for `stateObj.rttData` — uses the generic `seedSys._mainworldRef` field (set for every engine in `_buildSeedSys`) rather than a `workingCopy` parameter, so the adapter `run()` contract didn't need to grow a 4th argument just for RTT.

**Pipeline threading status — `js/rtt_engine.js`:**
- ✅ **Done — full pipeline already auto-chains and threads `seedSys`.** `generateRTTSectorStep1(hexId, options)` proactively calls `generateRTTSectorStep2(sys, options)` at its end; `generateRTTSectorStep2` proactively calls `generateRTTSectorStep3(sys, options)`; `generateRTTSectorStep3` proactively calls `generateRTTSectorBiographer(sys, options)`. `options` (containing `seedSys`) is passed at every hop.
- ✅ **Done — structural body seeding.** `generateRTTSectorStep2` reads `seedSys.rttBodies[starIdx]` and uses it directly (skipping the dice-rolled orbit layout) whenever `seedSys._allowAddBodies` is false.
- ✅ **Done — field-level manual preservation.** `processRTTSocialStats()`'s existing `_rttSaveManual`/`_rttRestoreManual` wrapper now covers `industry`/`tradeCodes`/`bases`/`population`/`government`/`lawLevel`/`starport`/`tl` (extended from just the first 3), with the Uninhabited early-return branch given its own inline guards since it bypasses the outer restore entirely. `classifyRTTBody` gained a `worldClass` guard it never had. The physical-stat functions (`processRTTPhysicalStatsPartA`/`PartB`, `calculateRTTDesirability`, `checkRTTTerraforming`, `determineRTTHabitation`) turned out to already have their own save/restore wrappers — a correction to what this manifest previously claimed. Gov/law/tl/starport gating is **not** deferred for RTT the way it was for CT/T5 — it was folded in here since extending the existing save/restore array cost nothing extra.
- ✅ **Done — real bug fixed.** `generateRTTSectorStep1`'s seeded-star branch never set `star.classification`/`star.luminosityClass`, which several functions read unconditionally — see the "Real bug found and fixed" note under v0.16.1 SEQUENCING above.

---

### AoW (Architect of Worlds)

**AoW is fully editor-ready as of 2026-07-05.** The gap analysis below (written earlier the same day, before implementation) is kept as historical context on *why* the work was bigger than a normal gating pass — see the "AoW is now fully online" note under v0.16.1 SEQUENCING (Section 5 header) for the full implementation writeup, and OW-9 (Section 6) for the closed writeup. The specific things this section originally flagged as missing are now true: `_ENGINE_ADAPTERS.AoW` exists (old inline branches deleted from all four call sites), `js/aow_uwp_auditor.js` exists and is wired through `sys.auditResult`, and `js/aow_seed_bridge.js` (new module) resolves star physics/hierarchy/disk-worksheets for the seeded path. **Not yet verified in-browser** — see the caveat in the v0.16.1 SEQUENCING note.

**Read stub — now `_ENGINE_ADAPTERS.AoW.readBodies()`** (moved verbatim from the old inline `else if (engine === 'AoW')` branch in `_buildWorkingCopyFromState()` — behavior unchanged, only the location moved)
- Detected via `_ENGINE_ADAPTERS.AoW.detect()`, now routed through the adapter registry like every other engine (previously a special-cased first check in `_detectEngine()`, ahead of the adapter dispatch — that inconsistency is also fixed)
- Reads bodies from `raw.worlds[]` (flat list, same shape MgT2E uses) — skips `type === 'Empty'`
- Mainworld identified via `_isMW(w, raw.mainworld)` (matches by object identity or by `uwp`+`name` pair) or `w.type === 'Mainworld'`
- Type canonicalized via the shared `_canonType()`/`_ggTypeFrom()` helpers (same ones CT/T5/RTT's older inline branches use) — maps AoW's raw type strings (containing "jovian"/"helian"/"ice giant"/"belt"/"asteroid"/"planetoid"/"ring") down to the editor's three-way `Gas Giant`/`Belt`/`World` vocabulary
- Moons read from `w.moons || w.satellites`
- **Confirmed:** read `system_editor.js` lines 72-85 (`_detectEngine`) and 850-871 (AoW body-reading branch) directly.

**Write stub — now `_ENGINE_ADAPTERS.AoW.write()` — REWRITTEN 2026-07-05, no longer MgT2E's borrowed logic**
The old inline branch (described in the paragraph above the "fully editor-ready" banner as "literally MgT2E's old write-stub logic, reused verbatim") is gone. The new adapter's `write()` is deliberately thin: it carries each working-copy body through with `_id`/`name`/`type` (editor vocabulary)/`uwp`/`orbitId`/`au`/`parentStarId` (a star `_id`, not an index)/`isMainworld`/`moons`/`_raw`/`_manualFields`. It does **not** do CT/MgT2E-style field-locking itself — that logic (`aowUwpLockFor`/`aowPhysSeed`) lives in `js/aow_seed_bridge.js` and runs inside `synthesizeDiskWorksheets()` when each worksheet planet is built, per design decision 5 (all new AoW logic stays out of `system_editor.js`).
- Body type is NOT remapped to MgT2E's vocabulary anymore — the bridge's `toAowPlanetType()` maps the editor's `Gas Giant`/`Belt`/`World` vocabulary directly to AoW's own `planetType` values (`'Gas Giant (CA)'`/`'Planetoid Belt'`/`'Terrestrial'`) at worksheet-build time.
- Brand-new bodies (no `_raw`) now get real values instead of empty locks: `defaultMassFor()` (bridge) assigns a representative Earth-mass value by type, so Phase 3's density/radius/gravity formulas have something to compute from instead of `NaN`.

**Dispatch stub — now `_ENGINE_ADAPTERS.AoW.run()`** (moved verbatim from the old inline branch — behavior unchanged)
- Calls `window.AoWBottomUpGenerator.generateAoWSystemBottomUp(hexId, seedSys)`
- Writes `stateObj.aowSystem = newSys`, `stateObj.mgt2eData = newSys.mainworld || null`, and `stateObj.mgtSocio = newSys.mainworld || null` (AoW deliberately reuses MgT2E's socio display fields — a real, working design choice, not a bug, per the inline comment citing `macro_orchestrator.js:1128`)

**Generator gate status — `js/aow_bottomup_generator.js` / `js/aow_world_engine.js` — DONE 2026-07-05, closing OW-9's core finding:**
- ✅ **Structural seeding, unchanged from before this pass and still correct.** `generateAoWSystemBottomUp(hexId, seedSys)` substitutes `seedSys.stars`/`seedSys.worlds` and gates disk/orbital rolls off `_allowAddBodies`.
- ✅ **Field-level manual preservation and field-level generation for seeded bodies — both done.** `js/aow_seed_bridge.js`'s `synthesizeDiskWorksheets()` builds real `sys.diskWorksheets` from the resolved stars + seeded bodies (reusing `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet`, newly exposed on its public API, rather than duplicating that math), called from a new step in Phase 2. Phase 3's 13 functions were already called unconditionally in the old code — the actual bug was never a skip-guard around Phase 3 itself, it was that `sys.diskWorksheets` was simply never populated when seeded. They now run for real, with `isManual()` guards threaded into the ~6 functions/points that compute fields the editor exposes (`stepPhysicalParameters`'s density/radius/surfaceGravity, `generateAlbedo`, `applyUWPPhysicals`'s size/atm/hydro digit classifiers) — the other ~20 fields across those 13 functions are pure internal simulation state (M-number, blackbody temp, grand-tack flags, etc.) the editor never exposes, left fully random by design, same principle CT/T5 used for their own internal-only fields.
- ✅ **Star-side physics resolution — genuinely new work, not a mechanical port.** Phase 1 now calls `aow_seed_bridge.js`'s solver (bisection-searches `initialMass` from a chosen spectral type, no jitter applied), age-window reconciliation across stars (conflict detection, not silent averaging), and hierarchy/orbit mapping — none of which existed anywhere before this pass, since AoW's own `generateStarHierarchyAndMasses` has no path to accept a pre-chosen star at all.
- ✅ **Two real bugs found and fixed while wiring this, both pre-existing and never triggered before (AoW wasn't UI-exposed until this pass):** `populateAoWWorldsList` was gated to skip whenever seeding controlled body count (correct in the old code — nothing would have been there to flatten — but would have stranded all of Phase 3's now-real computed physics inside `diskWorksheets` if left skipped); and the `seedSys._mainworldRef` direct-lookup branch in Phase 4 never set `sys.mainworld`/`isMainworld`/`type` itself (only `generateMainworldSelection` did), silently skipping all of Phase 5's Social Sweeps for any AoW system with a user-designated mainworld.
- ✅ **`age`/`systemAge` field-name mismatch fixed** — the seed carried `age`, every formula reads `systemAge`; the bridge now writes `sys.systemAge` directly. `sys.systemMetallicity` is also now resolved for the seeded path (previously silently defaulted via `|| 1.0`) via a small reimplementation of `aow_stellar_engine.js`'s own Step 5 formula (kept in sync; only reimplemented because that step lives bundled inside a monolithic function the seeded path doesn't call as a whole).
- Phase 5 (Social Sweeps) works correctly on seeded data, unaffected by anything above: `generateMainworldUWP` detects `world.size !== undefined` and uses pre-set physical integers rather than rerolling, consistent with the bridge's seeding.

**UWP-auditor coverage — `js/aow_uwp_auditor.js` — BUILT 2026-07-05, didn't exist before this pass:**
Mirrors `ct_uwp_auditor.js`/`t5_uwp_auditor.js`'s `runAndLog` shape exactly: `auditAoWSystem(sys, options)` (mainworld-count structure check — including the barren-system placeholder case, belt-size integrity, satellite-vs-parent size, population cap) and `runAndLog(sys, hexId)` (sets `sys.auditResult`, logs/backlogs failures). `aow_bottomup_generator.js`'s Phase 6 now calls `runAndLog` instead of the old inline `auditAoWSystem`-then-manually-backlog block, so `sys.auditResult` is actually set — previously `activeAuditor` always resolved to `null` since the required file didn't exist, making the whole audit block permanently dead code.

**`_ENGINE_ADAPTERS` entry — DONE 2026-07-05.** `_ENGINE_ADAPTERS.AoW` now exists with all four methods (`detect`/`readBodies`/`write`/`run`); the old inline `else if (engine === 'AoW')` branches are deleted from all four call sites (`_detectEngine`, `_buildWorkingCopyFromState`, `_buildSeedSys`, `_runGenerator`).

**UI exposure — DONE 2026-07-05.** `hex_map.html`'s `#se-engine-dialog` AoW radio is enabled (no longer `disabled`, "(coming soon)" removed); `canvas_input.js`'s `_seCanEdit` gate now includes `_seState.aowSystem`; `system_viewer.js`'s Edit-button gate now includes `edition === 'AoW'`. Script loading: `js/aow_uwp_auditor.js` and `js/aow_seed_bridge.js` both added to `hex_map.html`, loaded before `js/aow_bottomup_generator.js` (which depends on both).

**Companion topology restriction — NEW, design decision 3.** `system_editor.js`'s `_addStar()` now caps AoW systems at 4 stars and requires a 4th star to pair with the most recently added companion — enforced at build time in the editor, not just at Fill time, matching the 5 hierarchy shapes `aow_seed_bridge.js`'s `mapHierarchy()` actually supports.

**Age-conflict dialog — NEW, design decision 2.** `_fillAndSave()` now checks `result.newSys.ageConflict` (set by the bridge's `reconcileSystemAge` when manually-chosen spectral types imply non-overlapping age windows) and shows a warn-and-proceed dialog, reusing the same UI pattern as the OW-3 audit gate, before falling through to the audit check.

---

### What v0.16.1 Must Do (per engine) — CORRECTED 2026-07-03

Superseded the version of this table dated before 2026-07-03, which assumed no generator gating existed for CT or RTT. See the per-engine sections above for the full evidence trail.

| Engine | Structural seeding (stars/bodies survive Fill) | Field-level manual preservation | Remaining work |
|---|---|---|---|
| CT | ✅ Done (`generateSystemSkeleton` consumes `seedSys.stars`/`seedSys.orbits`/`seedSys.capturedPlanets`) | ⚠️ Partial — **UPDATED 2026-07-04:** `size`/`atm`/`hydro`/`pop` gated via `_ctFieldIsManual` in `ct_world_engine.js`, seeded via `_ctUwpLockFor` in `system_editor.js`'s write stub (covers both orbit bodies and captured planets). Gov/law/tl/starport (a separate pass) still unguarded. | **✅ UI-exposed 2026-07-04 — CT is fully live in the System Editor.** Only remaining item: gate gov/law/tl/starport (optional follow-up, not a blocker) |
| T5 | ✅ Done (2026-07-05) — `generateT5System(mainworldBase, seedSys)` places seeded stars/bodies before Phase 1, gates all inventory/moon rolls off `_allowAddBodies` | ✅ Done (worldType/size/atm/hydro/pop via `_t5UwpLockFor`; gov/law/tl/starport deliberately deferred, same as CT) | **✅ UI-exposed 2026-07-05 — T5 is fully live in the System Editor.** Algorithm 7 implemented; only remaining item: gate gov/law/tl/starport (optional follow-up, not a blocker) |
| RTT | ✅ Done (2026-07-04) — `generateRTTSectorStep2` consumes `seedSys.rttBodies`, full pipeline already auto-chains Step1→2→3→Biographer with `seedSys` threaded throughout; seeded-star `classification`/`luminosityClass` backfill bug found and fixed | ✅ Done (industry/tradeCodes/bases/population/government/lawLevel/starport/tl via the extended `_rttSaveManual`/`_rttRestoreManual` list, plus a new `worldClass` guard in `classifyRTTBody`; gov/law/tl/starport gating included, not deferred — see RTT subsection above) | **✅ UI-exposed 2026-07-04 — RTT is fully live in the System Editor.** No remaining gating follow-up (unlike CT/T5, gov/law/tl/starport is already gated) |

| AoW | ✅ Done (2026-07-05) — `generateAoWSystemBottomUp` substitutes `seedSys.stars`/`seedSys.worlds`; Phase 1 resolves star physics from chosen spectral types via `aow_seed_bridge.js`; Phase 2 synthesizes real disk worksheets for the seeded path | ✅ Done — `isManual()` guards in the ~6 functions/points that compute editor-exposed fields (density/radius/surfaceGravity/albedo/size/atm/hydro digits); internal-only simulation fields (M-number, blackbody temp, etc.) left random by design | **✅ UI-exposed 2026-07-05 — AoW is fully live in the System Editor**, closing OW-9. New module `js/aow_seed_bridge.js` (star-physics solver, age reconciliation, hierarchy/orbit mapper, disk-worksheet synthesis) and new file `js/aow_uwp_auditor.js` (didn't exist before). **Not yet verified in-browser** — see the caveat under the "AoW is now fully online" note above. |

**Status as of 2026-07-05:** CT, T5, RTT, and AoW are all fully online — AoW was last through the Phase B queue and needed materially more design/implementation work than CT/T5/RTT (a new seed-bridge module, not just a gating pass), per OW-9. **Verified end-to-end in-browser via Playwright (2026-07-05)** — see the real bug found and fixed during that pass, noted under the "AoW is now fully online" note above.

The engine selection dialog HTML (`#se-engine-dialog`, in `hex_map.html`) has MgT2E / CT / T5 / AoW / RTT radio buttons present. **UPDATED 2026-07-05:** all five are now enabled (no longer `disabled`, "(coming soon)" label removed).

---

## 6. Outstanding Work Items & Bugs

### Spec Gaps — implemented in the manifest but not yet in the code

**OW-1 — CLOSED (2026-07-03): Primary star validation gate deemed unnecessary**
Reviewed against the actual UI and found the scenario the gate was meant to catch is structurally unreachable: the Primary star row (`system_editor.js` ~line 1510) has no delete button — only companion rows get `Del★` — and `_deleteStar()` (line 511) independently refuses to delete the last remaining star regardless. Separately, `_workingCopy.stars[0]` is treated as "the primary" by array position throughout the editor (`_addStar` always `.push()`es to the end, `_deleteStar` only filters, `_insertAtOrbit` explicitly excludes index 0 via `.slice(1)`), so no editor operation can ever displace the primary from index 0 or leave the array empty. A Fill-time check would be dead code. No implementation needed; Algorithm 5 Step 1 is retracted.

**OW-2 — CLOSED (2026-07-03): Mainworld validation dialog deemed unnecessary**
Traced what actually happens when `_workingCopy.mainworldRef === null` at Fill time: both `mgt2e_bottomup_generator.js` (~line 264) and `aow_bottomup_generator.js` (~line 274) already fall through to `WorldEngine.evaluateMainworldCandidates(candidates)` whenever `seedSys._mainworldRef` is absent or not found — this **is** option [B] "Let engine decide," running automatically with no prompt needed. The election uses the same habitability → resourceRating → GG-presence → size tiebreak order as normal generation, over whatever Terrestrial/Satellite/Belt bodies exist in the working copy. [A] "Let me pick one" is redundant with existing UX (the user can just click ☆MW before Fill), and [C] "Cancel" is already available via the Cancel button. No dialog needed; Algorithm 5 Step 2 is retracted.
Known edge case (not addressed, considered rare enough to defer): if the working copy has zero eligible candidates (e.g. a system consisting solely of a moonless Gas Giant), `evaluateMainworldCandidates([])` returns `null` and `sys.mainworld` is left unset after Fill & Save. Pre-existing generator behavior, not introduced by the System Editor.

**OW-3 — ✅ DONE for MgT2E (2026-07-04) and CT (2026-07-04, Phase B item 3); still open per-engine for AoW/T5/RTT: UWP Auditor step (Fill & Save)**
After the generator runs, the UWP Auditor should be called. If it returns errors, show a warn-and-proceed dialog: [Proceed anyway] / [Go back and fix].
**Implementation (2026-07-04):** `mgt2e_bottomup_generator.js` already computed a full `auditMgT2ESystem()` result internally on every run but discarded it after logging/backlog-pushing; it now also attaches it to the returned system as `sys.auditResult`, so callers can read it without re-running the (recursive, trace-logging) audit a second time. `system_editor.js`'s `_fillAndSave()` checks `result.newSys.auditResult` after `_generateAndCommit()` runs; on `pass === false` it shows a warn-and-proceed dialog (`Proceed Anyway` / `Go Back & Fix`) instead of silently closing the editor. The close-editor/reopen-viewer tail was split into `_finishFillAndSave(hexId)` so "Proceed Anyway" can run it without redoing generation; "Go Back & Fix" is a no-op that just leaves the editor open.
**Known limitation, accepted as out of scope for this pass:** by the time the audit result is available, `_generateAndCommit()` has already written the (possibly failing) system into `hexStates` — `_runGenerator` mutates the live `stateObj` mid-generation rather than staging to a copy, so "Go Back & Fix" cannot literally un-commit the write. It only keeps the editor open for further edits; the map-level `Ctrl+Z` undo (already saved via `saveHistoryState()` before generation) remains the actual rollback path if the user wants one. A true "nothing touched until Fill & Save confirms" would require `_runGenerator`/the generators to stage writes rather than mutate live state — a bigger change, not attempted here.
**Gate is engine-agnostic and opt-in:** `_fillAndSave()` checks `audit && audit.pass === false` generically, so it's silently inert for AoW/T5/RTT until each of those generators gets the same one-line `sys.auditResult = ...` attachment once their own `seedSys` gating work is done (Section 5) — CT already got this (`ct_uwp_auditor.js`'s new `runAndLog`, wired into `ct_system_driver.js`). **Sequencing still applies going forward:** each new engine needs its own auditor coverage (its own populated `sys.auditResult`) before it's trustworthy to Fill & Save against — OW-3's MgT2E/CT work does not automatically cover them.
*Spec ref: Algorithm 5, Step 5*

**OW-4 — CLOSED (2026-07-03): `manually_edited: true` flag dropped as a requirement**
Neither `_fillAndSave()` nor `_preview()` sets `stateObj.manually_edited = true`, and nothing in `js/` currently reads that field either. Intent was to flag editor-produced systems for possible future use (e.g. excluding them from bulk re-generation, or visually marking them), but there's no active consumer today and no near-term plan for one. Deprioritized to low-priority/someday rather than an outstanding requirement — revisit if a concrete use for the flag comes up. Not implementing now.
*Spec ref: Algorithm 5 Step 6; Architecture Constraints*

**OW-5 — 🟡 PARTIALLY DONE (decided 2026-07-03; layer 1 completed 2026-07-04): Extract commit path before any new-engine work begins**
The spec calls for a `commitEditorSystem(hexId, sys, engine)` function in `macro_orchestrator.js` as the shared commit gate. The full commit (clear old data, write new engine data, `computeSystemCounts`, `hexStates.set`, redraw) was duplicated inline between `_fillAndSave()` and `_preview()` in `system_editor.js`, and diverges from the separate commit blocks already living in `macro_orchestrator.js`'s macro functions.
**Decision:** Sean does not want to compound this duplication by adding CT/T5/RTT/AoW branches on top of it. This must be resolved — for MgT2E only, no new engines involved — **before** any engine-expansion work starts, not deferred to "whenever we touch the next engine."
**Scope note:** the duplication is two-layered — (1) `_fillAndSave()` vs `_preview()` duplicated the same name-preservation/`computeSystemCounts`/`hexStates.set`/redraw block inside `system_editor.js` itself, and (2) that block also duplicates logic already present in `macro_orchestrator.js`'s existing macro commit blocks (~lines 499-555 as of Phase 2). A full fix consolidates both layers into one shared function used by all three call sites (macros, Fill & Save, Preview) — extracting only the editor's own duplication without touching the macro commit blocks leaves a second parallel path exactly like the one that caused Bug #6 (the gas-giant-sync fix needing to be applied in two places).
**✅ Layer 1 DONE (2026-07-04):** `system_editor.js`'s internal duplication is extracted into a shared `_generateAndCommit(errorLabel)` (private to the module, ~line 2196), called by both `_preview()` and `_fillAndSave()`. It owns: build seedSys → `_resolveStarPhysics` → resolve/create `stateObj` → run generator (try/catch, parameterized error-dialog text) → `_restoreDisplayManualFields` → `_forceGreenTravelZone` → mainworld-name preservation across `mgt2eData`/`ctData`/`t5Data`/`rttData` → `stateObj.type` → `computeSystemCounts` → `hexStates.set` → `requestAnimationFrame(draw)` → `populateEditorAccordions`. Returns `{ hexId, stateObj, newSys }` or `null` (dialog already shown) on failure.
Per the design-care note below, the two behavioral differences were deliberately kept in the callers rather than folded into the shared function: `_preview()` still takes its own `_previewOriginalState` snapshot before calling it, and still does its own post-commit viewer-refresh + derived-property backfill; `_fillAndSave()` still calls `saveHistoryState()` before calling it, and still does its own post-commit editor-close + viewer-reopen. Net change: `system_editor.js` shrank by ~31 lines (79 deleted, 48 added); `node --check js/system_editor.js` passes.
**❌ Layer 2 NOT DONE — explicit scope decision (2026-07-04):** Sean chose "system_editor.js only" for this pass over "full consolidation" when asked directly, given the added risk of reconciling `macro_orchestrator.js`'s batch-macro commit block (which carries extra logic — `StatisticalAuditor` hooks, its own mainworld-lookup-including-lunar-search, its own old-data-clearing field list that already differs from `system_editor.js`'s `_clearSystemData()`) with the editor's per-hex preview/undo semantics. **The macro_orchestrator.js layer remains open** — a `commitEditorSystem()` shared by macros AND the editor has not been built, and the drift between the editor's `_clearSystemData()` and the macro's inline clear-block (Bug #6/#7's root cause pattern) is still live. Revisit before or during Phase B if a new engine's macro and editor commit paths need to agree.
*Spec ref: Phase 2 Modified Files table; Phase 4 Step 7*

**OW-6 — ✅ DONE (found 2026-07-04; fixed 2026-07-04): Seed-restoration matching logic lives in the MgT2E orchestrator, not an engine**
`mgt2e_bottomup_generator.js`'s own header states "This module contains ZERO generation logic. It only manages state and calls engine functions in the correct sequence" — but two blocks violated that: the seed-world-to-generated-body nearest-orbit matching/restoration logic and the post-`generatePhysicals` moon-trim-back logic were real matching algorithms, not sequencing.
**Implementation:** extracted both into a new standalone, engine-agnostic module `js/seed_restoration.js` (UMD-wrapped, same pattern as `mgt2e_uwp_auditor.js` etc.), exposing `SeedRestoration.restoreSeedWorldsIntoGenerated(sys, seedSys)`, `SeedRestoration.captureSeededMoonCaps(sys, seedSys)`, and `SeedRestoration.trimGeneratedMoonsToSeededCaps(sys, seedSys, caps)`. `mgt2e_bottomup_generator.js` now calls these three (each guarded `typeof SeedRestoration !== 'undefined'` — the safe pattern, not the bare-global style flagged in OW-7) instead of carrying ~75 lines of matching logic inline. `hex_map.html` loads `js/seed_restoration.js` before the per-edition engine block so it's available to any bottom-up generator.
**Checked but not touched:** `aow_bottomup_generator.js` has no equivalent seed-restoration block at all today — not a second copy to consolidate, and adding the behavior to AoW would be new functionality, not extraction, so it was left alone.
**Still to do when RTT reaches this point (Phase B):** wire its bottom-up generator to call the same `SeedRestoration` functions once it gains broader field-level `seedSys` gating, rather than re-inlining this logic.
**CT update (2026-07-04):** CT's own Phase B pass (field-level gating, item 1) did **not** wire in `SeedRestoration` — worth flagging as an open question, not a confirmed gap. MgT2E needed nearest-orbit matching because its seeded bodies can still be reconciled against a fresh roll; CT's seeded path (`generateSystemSkeleton`, `ct_bottomup_generator.js` ~line 135) substitutes `seedSys.orbits`/`seedSys.capturedPlanets` directly by reference when `_allowAddBodies` is false, with no separate reconciliation pass — so it may simply not need this module the same way. Not verified either way; check before assuming CT needs the same wiring RTT will.
*Spec ref: found during the pre-Phase-B `system_editor.js`/MgT2E cleanup audit requested 2026-07-04.*

**OW-7 — ✅ DONE (found 2026-07-04; fixed 2026-07-04): `MgT2EMath` guard inconsistency + duplicated auditor-logging block**
`mgt2e_bottomup_generator.js:369` and `mgt2e_topdown_generator.js:203,372` guarded with a bare `if (MgT2EMath && MgT2EMath.performJourneyMathSweep)`, while every other generator (`ct_bottomup_generator.js`, `ct_topdown_generator.js`, `t5_topdown_generator.js`) used the safer `typeof MgT2EMath !== 'undefined' && MgT2EMath.performJourneyMathSweep`. Harmless in practice (fixed script load order in `hex_map.html`) but inconsistent with the `typeof`-guard style used for every other optional dependency in the same files, and one load-order change away from a `ReferenceError`.
**Fix 1:** both files (all three call sites — bottom-up's one, top-down's two, the second inside `expandLoadedSocioeconomics`) now use `typeof MgT2EMath !== 'undefined' && ...`.
**Fix 2:** the audit-and-push-to-`window.auditBacklog` block, previously duplicated verbatim between `mgt2e_bottomup_generator.js` and `mgt2e_topdown_generator.js` (with a minor console-message format difference between the two), is now one shared `MgT2E_UWP_Auditor.runAndLog(sys, hexId, options)` in `js/mgt2e_uwp_auditor.js`. It runs `auditMgT2ESystem`, attaches `sys.auditResult` (previously only the bottom-up generator did this, for OW-3), and on failure logs + backlogs using the bottom-up generator's more readable bulleted message format for both. Both generators now call `activeAuditor.runAndLog(sys, hexId, { mode: '...' })` instead of carrying the ~20-line block inline. Net: bottom-up generator −60 lines, top-down generator −16 lines, auditor +37 lines (one reusable function instead of two divergent copies).
**Not touched:** CT's equivalent duplication (`ct_bottomup_generator.js`/`ct_topdown_generator.js` use their own `ct_uwp_auditor.js`) — consolidating across engine boundaries wasn't part of this pass; CT can adopt the same `runAndLog` pattern in its own auditor module independently, whenever convenient.
*Spec ref: found during the pre-Phase-B `system_editor.js`/MgT2E cleanup audit requested 2026-07-04.*

**OW-8 — ✅ DONE (found 2026-07-04; fixed 2026-07-04; verified in-browser by Sean 2026-07-04): Per-engine adapter pattern for `js/system_editor.js`**
`_buildWorkingCopyFromState()`, `_buildSeedSys()`, and `_runGenerator()` each had a separate near-parallel `if/else if engine === '...'` branch — adding CT/T5/RTT meant editing the same four places (those three plus `_detectEngine()`) again. This was the last item blocking Phase A sign-off.
**Decision (asked directly, 2026-07-04):** adapters live inline in `system_editor.js` (not split into separate per-engine files), and this pass covers **MgT2E only** — AoW/CT/T5/RTT get their own adapters later, in Phase B, as each engine's editor support is actually built out.
**Implementation:** added a module-level `_ENGINE_ADAPTERS` registry (`system_editor.js`, right before `_buildWorkingCopyFromState`). Each adapter implements four methods:
```js
{
  detect(stateObj)              -> { raw, engine } | null
  readBodies(raw, starIdByIdx)  -> bodies[]   // working-copy body list
  write(wc, starIdxById)        -> partial seedSys fields to merge in (e.g. { worlds })
  run(hexId, seedSys, stateObj) -> newSys | null
}
```
Only `MgT2E` is registered. All four call sites (`_detectEngine`, the body-building section of `_buildWorkingCopyFromState`, the per-engine section of `_buildSeedSys`, and `_runGenerator`) now do `const adapter = _ENGINE_ADAPTERS[engine]; if (adapter) { ...delegate... }` — falling through to the **exact original inline branches, untouched**, for AoW/CT/T5/RTT when no adapter is registered. MgT2E's four branch-bodies were moved verbatim into the adapter (including hoisting its `_uwpLockFor`/`_physSeed`/`_extSocioSeedFor` helpers, previously redefined on every single `_buildSeedSys()` call, up to module scope as `_mgt2eUwpLockFor`/`_mgt2ePhysSeed`/`_mgt2eExtSocioSeedFor` — defined once now instead of per-call).
**AoW wrinkle:** MgT2E and AoW previously shared one literal branch (`if (engine === 'MgT2E' || engine === 'AoW')`) in both `_buildWorkingCopyFromState` and `_buildSeedSys`. Rather than route AoW through the new MgT2E adapter (coupling AoW's behavior to MgT2E's future changes) or duplicate the adapter's logic under an `AoW` key (moving the duplication rather than removing it), AoW's copy was left exactly where it was, now reached via `else if (engine === 'AoW')` in the same two functions. AoW becomes a genuine adapter of its own, independently, whenever its Phase B work happens — this is a deliberate, documented, temporary duplication, not an oversight.
**Also normalized:** `_buildSeedSys()` and `_runGenerator()` previously read `_workingCopy` via closure; both now take it as an explicit `workingCopy` parameter (both call sites — `_regenerateBody` and `_generateAndCommit` — updated to pass `_workingCopy`). Required for the adapter's `write()`/`run()` to be pure functions of their inputs; also fixed the one non-MgT2E branch that referenced `_workingCopy` directly (RTT's `extractRTTMainworld(newSys, workingCopy.mainworldRef)` in `_runGenerator`) to use the parameter instead — mechanical, zero behavior change.
**Verified:** `node --check js/system_editor.js` passes; Sean manually tested Create System (MgT2E) → add world → Preview → Fill & Save, and Edit System → change a body → Fill & Save, on a real hex map — "everything works fine."
*Spec ref: v0.16.1 SEQUENCING Phase A item 3; found during the pre-Phase-B `system_editor.js`/MgT2E cleanup audit requested 2026-07-04.*

**OW-9 — ✅ CLOSED 2026-07-05 (found and fixed same day, pre-Phase-B AoW readiness audit): AoW's Phase 3 pipeline was architecturally unreachable in the System Editor's seeded path**
**Resolution:** option (a) below was chosen and built — a new module `js/aow_seed_bridge.js` synthesizes real `sys.diskWorksheets` from resolved stars + seeded bodies (reusing `aow_world_engine.js`'s own `buildNodes`/`buildDiskWorksheet`), and `isManual()` guards were threaded into the ~6 functions/points that compute editor-exposed fields (not all 13 — most of the 13 functions' fields are pure internal simulation state the editor never exposes, so those were left fully random by design rather than over-gated). The star-side half of the problem (Phase 1 had no path to accept a user-chosen star at all) also needed new solver logic — a bisection search from spectral type to `initialMass`, age-window reconciliation across multiple stars with conflict detection (warn-and-proceed dialog, not silent averaging), and a hierarchy/orbit mapper — none of which existed before this pass. `js/aow_uwp_auditor.js` was also built from scratch (didn't exist at all), `_ENGINE_ADAPTERS.AoW` was added (OW-8 pattern), and UI exposure was flipped. See the "AoW is now fully online" note under v0.16.1 SEQUENCING (Section 5 header) for the full implementation writeup, and the corrected AoW subsection in Section 5. **Not yet verified in-browser** — per the project's own recorded lesson from T5/RTT verification, an in-browser Playwright pass is the natural next step before treating this as fully proven.
The original finding (kept below for historical context on why this was bigger than a normal Phase B gating pass):
The manifest previously claimed (Section 5 header, "Next up" note) that AoW was "already the furthest along at the generator level (structural **and field-level** `seedSys` gating both present)." That was checked against the actual code on 2026-07-05 and the field-level half is false.
**What's actually true:** `aow_bottomup_generator.js`'s structural gating (star/world substitution, `_allowAddBodies` orbit-count gate, `_mainworldRef` lookup, correctly skipping `populateAoWWorldsList` so seeded worlds aren't clobbered) is genuine and works the same way CT's does. But `aow_world_engine.js` has **zero** `isManual()` calls — there was never an attempt at MgT2E/CT/T5-style per-field manual preservation — and the reason isn't just "not built yet," it's that **Phase 3 of AoW's pipeline can't run on seeded data at all today**: `generatePhysicals`, `generateOrbitalConditions`, `generateThermalAndWater`, `generateGeophysics`, `generateMagneticField`, `generateEarlyAtmosphere`, `generateAlbedo`, `generateCarbonDioxide`, `generatePresenceOfLife`, `generateAverageSurfaceTemp`, `generateFinalizeAtmosphere`, `generateHabitabilityScores`, and `generateUWPPhysicals` are all called unconditionally in `aow_bottomup_generator.js`, but each opens with `if (!sys.diskWorksheets || sys.diskWorksheets.length === 0) return;` — and `sys.diskWorksheets` is populated **only** by `generatePlanetaryDisks`, the exact function `aow_bottomup_generator.js` skips whenever `seedSys` controls body count (`!seedSys._allowAddBodies`, the System Editor's default). AoW's internal planet representation (`diskWorksheets[].planets[]`, its own `planetType` field) has no bridge at all from the flat `sys.worlds[]` list that seeding writes into.
**Consequence:** every System-Editor Fill & Save on an AoW system (with the default checkbox state) would silently skip all physical/atmospheric/hydrographic/thermal/geophysical/UWP generation for every seeded or newly-added body. A brand-new body added via "+World" would end up with none of those fields set by anyone — not even freshly rolled ones, since the roll code never runs.
**Also confirmed, same audit:** `aow_uwp_auditor.js` — required/referenced by `aow_bottomup_generator.js`'s module factory and called in its Phase 6 — does not exist anywhere in the repo (`aow_socio_engine.js` also doesn't exist; AoW deliberately reuses `MgT2ESocioEngine` instead, which is a working design choice, not a gap). The audit call is permanently dead code (`activeAuditor` always resolves to `null`), not merely unwired.
**Decided with Sean (2026-07-05) and implemented same day:** option (a) — synthesize `diskWorksheets` from seeded bodies rather than accepting Phase 3 doesn't run (option b) — with two refinements that emerged during design discussion: (1) never jitter a user-set value (matches every other engine's convention), and (2) system age is derived to fit the chosen spectral type(s) rather than rolled independently, with a warn-and-proceed dialog if multiple stars' implied age windows don't overlap.
*Spec ref: Section 5's "AoW" subsection; supersedes the "field-level gating both present" claim in the v0.16.1 SEQUENCING header and the per-engine table in Section 5.*

---

### Fixed bugs (for reference)

**Bug #1 — CLOSED (2026-06-24): Fill & Save causes hex map dot to disappear**
Could not be reproduced after the exhaustive rework of `_buildSeedSys`, `_runGenerator`, and the commit path. Considered resolved by the cumulative fixes in this version.

**Bug #2 — FIXED (2026-06-22): Double mainworld after adding Companion + Preview (MgT2E)**
`_buildWorkingCopyFromState` returned `mainworldRef: null` even when one body had `isMainworld: true`. Fix: now scans all bodies and moons for `isMainworld: true` before returning.

**Bug #3 — FIXED (2026-06-22): MgT2E companion `orbitId` lost on editor load**
`_buildWorkingCopyFromState` read companion position as `s.distAU ?? s.orbitAU ?? null`, missing `s.orbitId`. Fix: reads `s.orbitId ?? (typeof s.orbit === 'number' ? s.orbit : null)`. CT string orbits ("Close"/"Near"/"Far") correctly produce `null`.

**Bug #4 — FIXED (2026-06-24): Orrery not updating after orbit# change + Preview**
`_buildSeedSys` used stale `b.au` (captured at editor-open time) as the AU for bodies even after the user changed `orbitId`. The generator received the old AU, so the orrery showed orbits in their original positions. Fix: `_buildSeedSys` now derives AU from `orbitId` when set (`_orbitIdToAU(b.orbitId) ?? b.au ?? 1.0`).

**Bug #5 — FULLY FIXED (2026-06-25): Gas giant moon mainworld not highlighted in orrery or accordion**
Root cause: `generateAtmospherics` in `mgt2e_world_engine.js` hardcoded `syncRes.type = 'Satellite'` when rebuilding each GG moon after `processWorld`, stamping the lunar mainworld's type field.
- 2026-06-24: Orrery patched via `_normalizeMgT2E` in `js/system_viewer.js` — identifies lunar mainworld by `_id` match and restores `type:'Mainworld'` before rendering. Accordion still broken.
- 2026-06-25: Root-cause fix in `js/mgt2e_world_engine.js`: `syncRes.type = m.type` (was `'Satellite'`). Accordion now works. `_normalizeMgT2E` retained as defense-in-depth.

**Bug #6 — FIXED (2026-06-25): MgT2E bottom-up sector shows GG symbol on systems with no gas giant**
Root cause: `generateMainworldUWP` in `mgt2e_socio_engine.js` independently rolls 2d6 for gas giant presence (≤9 = true, ~83% hit rate) and writes to `existingWorld.gasGiant`. In top-down this roll is authoritative. In bottom-up, `sys.gasGiants` from the stellar engine is authoritative, but the socio roll was overwriting it. Fix: in `mgt2e_bottomup_generator.js`, after `SocioEngine.generateMainworldUWP`, override with `sys.mainworld.gasGiant = sys.gasGiants > 0`. Defense-in-depth: same override added in `macro_orchestrator.js` `runMgT2EBottomUpMacro` before `stateObj.mgt2eData` is set.

**Bug #7 — FIXED (2026-07-01): System Editor — adding/removing a Gas Giant via "+GG"/delete didn't toggle the map/orrery GG symbol (MgT2E, CT)**
Root cause: the Bug #6 fix (`sys.mainworld.gasGiant = sys.gasGiants > 0`) assumed `sys.gasGiants` is always authoritative, but `sys.gasGiants` is only populated by `StellarEngine.generateSystemInventory()` — which the System Editor's Fill/Preview path explicitly skips whenever `_allowAddBodies` is false (the "Allow engine to add additional bodies" checkbox default). So a Gas Giant added by hand in the editor landed correctly in `sys.worlds`, but `sys.gasGiants` stayed 0 and the flag never flipped on.
- **MgT2E fix** (`js/mgt2e_bottomup_generator.js`): `sys.mainworld.gasGiant` now derives directly from the actual world list — `sys.worlds.some(w => w.type === 'Gas Giant')` — instead of the `sys.gasGiants` counter. Self-corrects on both add and remove regardless of whether the inventory phase ran.
- **CT fix** (`js/ct_bottomup_generator.js`, `processBottomUpDesignation`): had the same stale-counter issue (`sys.gasGiant`, singular, only set when the skeleton-roll phase runs), plus a second bug — the "Fixed Anchor" branch (hit whenever the System Editor pre-designates a mainworld via `_mainworldRef`, i.e. essentially every editor Fill/Preview on an existing system) returned early and never assigned `winner.gasGiant` at all. Fix: derive `hasGasGiant` once from `sys.orbits.some(o => o.contents && o.contents.type === 'Gas Giant')` and assign it to `winner.gasGiant` in both the Fixed Anchor branch and the normal-election branch.
- **RTT** — audited, no fix needed. `extractRTTMainworld` in `js/rtt_engine.js` already derives the flag live from `sys.stars[].planetarySystem.orbits[].worldClass === 'Jovian'` at extraction time, and Step 3's classification pass reclassifies every body (seeded or rolled) on every run.
- **T5** — not fixed; see Section 7, "T5 — Gas Giant / Body-List Sync Gap."
- Neither the CT fix nor the T5 gap were reachable by users at the time of this investigation — System Editor editing is currently enabled for MgT2E only (not AoW — see the Supported Engines note in Section 3/Phase 5), per Section 5. The CT fix was applied anyway since it was low-risk and self-contained; it will already be correct whenever CT editing ships in v0.16.1.

---

## 7. Future Release Notes

### T5 — Gas Giant / Body-List Sync Gap (found 2026-07-01) — ✅ CLOSED 2026-07-05

`t5_topdown_generator.js`'s `generateT5System()` now takes a `seedSys` second parameter and fully consults it — seeded bodies are placed at their own orbits in a pass that runs before Phase 1, `_allowAddBodies` gates whether the dice-rolled GG/Belt/Terrestrial inventory rolls at all, and moon counts are capped to what was seeded via `generateT5Satellites`'s new `capToExisting` param. Adding or removing a body via the System Editor's "+GG"/"+World"/"+Belt" buttons on a T5 system now has full effect on Fill & Save's output — see "T5 is now fully online" under Section 5's v0.16.1 SEQUENCING header for the complete implementation writeup, and Section 4/6 for the phantom-body bug found and fixed during verification.

`restoreT5ManualFields` / `generateT5SystemPreservingManuals` in `system_driver.js` were left untouched, per the original plan — they remain the working implementation behind `ui_menus.js`'s right-click "regenerate T5 system" action, a separate, still-valid use case (bulk regen across selected hexes, no System Editor working copy involved), distinct from the new structural `seedSys` gating used by the System Editor's Fill & Save path.

