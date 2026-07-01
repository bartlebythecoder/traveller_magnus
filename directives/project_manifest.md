# PROJECT AS ABOVE, SO BELOW - Feature Manifest
**Version:** 0.16.x
**Target:** 
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)

---

## 1. Project Goal
An easy to use Traveller/Cepheus system builder and navigator
For this version: (1) Routes (2) Borders (3) Small bug fixes

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
- On save, result must land in hexStates as a normal system with one hidden flag: `manually_edited: true`
- No duplication of engine logic

#### Creating vs Editing
- **New system:** Engine selection dialog appears first. v0.16.0.x scope: **MgT2E / AoW** only. CT / T5 / RTT deferred to v0.16.1 — stubs exist in `system_editor.js` (see Section 5). Editor then opens blank.
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
- If no mainworld at Fill time: warn, offer user the choice to pick one or let engine decide
- T5 gets a dedicated one-off mainworld selection algorithm (T5 does not designate mainworld the same way as other engines) — **deferred to v0.16.1; see Algorithm 7 and Section 5**

#### Supported Engines (v0.16.0.x — Edit System scope)
- **MgT2E** (Mongoose Traveller 2nd Ed) — bottom-up fill; `js/mgt2e_bottomup_generator.js`
- **AoW** (Architect of Worlds) — bottom-up fill; uses MgT2E socioeconomics by design; `js/aow_bottomup_generator.js`

#### Deferred Engines (v0.16.1)
- **CT** (Classic Traveller) — bottom-up fill; `js/ct_bottomup_generator.js`. Read/write stubs exist in `system_editor.js` — see Section 5.
- **T5** (Traveller 5) — top-down fill only (strictly enforced in system_driver.js); `js/t5_topdown_generator.js`. Read/write stubs exist in `system_editor.js` — see Section 5.
- **RTT** (Revised Traveller) — 3-step pipeline (Step1 → Biographer → Step2 → Step3); entirely within `js/rtt_engine.js`. Read/write stubs exist in `system_editor.js` — see Section 5. **Already has `_rttSaveManual`/`_rttRestoreManual` — manual override pattern exists and is a head start for the Fill gate.**

#### Fill & Save — The Commit Action
- One-time, whole-system commit — not iterative
- **MgT2E / AoW (v0.16.0.x):** runs bottom-up engine sequence with a "check user first, generate if missing" gate at every decision point. User-set values feed downstream decisions correctly (e.g. user-set spectral type informs habitable zone).
- **CT / T5 / RTT:** deferred to v0.16.1 — stubs exist in `system_editor.js` (see Section 5)
- **Checkbox (unchecked by default):** "Allow engine to add additional bodies" — when unchecked, Fill only fills fields on bodies the user placed; when checked, engine may add bodies per its normal rules
- Physical inconsistencies trigger a warning; user may correct or proceed

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

#### hexStates Structure (per system hex)
Each populated hex carries parallel objects — all must be written correctly on Fill & Save:
- `type: 'SYSTEM_PRESENT'`
- `mgtSystem` / `ctSystem` / `t5System` / `aowSystem` — raw body/orbit data per engine
- `mgt2eData` / `ctData` / `t5Data` — mainworld UWP fields
- `mgtSocio` / `t5Socio` — socioeconomic expansion data
- `name`, `allegiance`, `cluster`, `manually_edited` (new flag)

---

### Phase 2 — Architectural Plan (completed 2026-06-19)

#### Modified Files

| File | Risk | What Changes |
|---|---|---|
| `hex_map.html` | LOW | Add context menu items, engine-selection dialog, warning dialog HTML, script tag for system_editor.js |
| `js/canvas_input.js` | LOW | Show/hide `ctx-create-system` and `ctx-edit-system` per selection state; add click handlers |
| `js/system_viewer.js` | MEDIUM | `open()` accepts optional explicit hexId; add `_editMode` flag; add Edit button to `_buildOverlay()` |
| `js/macro_orchestrator.js` | LOW-MEDIUM | Extract commit block to shared `_commitSystemToHex()`; add `commitEditorSystem()` for Fill & Save |
| `js/mgt2e_bottomup_generator.js` | HIGH | Add optional `userOverrides = null` parameter; thread override gate through all 5 phases |
| `js/aow_bottomup_generator.js` | HIGH | Same pattern as MgT2E |
| ~~`js/ct_bottomup_generator.js`~~ | — | **Deferred (v0.16.1)** — stubs in `system_editor.js` Section 5 |
| ~~`js/t5_topdown_generator.js`~~ | — | **Deferred (v0.16.1)** — stubs in `system_editor.js` Section 5 |
| ~~`js/rtt_engine.js`~~ | — | **Deferred (v0.16.1)** — stubs in `system_editor.js` Section 5 |

---

#### The Override Gate Pattern (applied to all 5 generators)

```javascript
// Existing macro callers pass no second argument → userOverrides is null → identical behavior
function generateMgT2ESystemBottomUp(hexId, userOverrides = null) {

    // At each decision point:
    const starType = _getOverride(userOverrides, 'stars', 0, 'type') ?? generateStarType();
}
```

**Critical safety rule:** When `userOverrides` is null (all existing macro calls), the gate is a no-op. Zero regression risk to existing generation — provided the gate check itself is correct. Each generator must be tested in isolation before the editor UI calls it.

#### The Override Object Schema (consistent across all engines)
```javascript
{
  stars: [],            // user-placed star objects with partial or full fields
  bodies: [],           // user-placed body objects (worlds, belts, etc.)
  mainworldRef: null,   // reference to the body flagged as mainworld by the user
  allowAddBodies: false // mirrors the "Allow engine to add additional bodies" checkbox
}
```

#### The Commit Path
After Fill runs, `system_editor.js` calls `commitEditorSystem(hexId, engineResult, engine)` in `macro_orchestrator.js`, which writes the completed system to hexStates — setting `manually_edited: true` — then triggers a map redraw. Identical to what macros do today.

---

### Phase 3 — Algorithm Design (completed 2026-06-19)

#### Key Discovery: `markManual` / `isManual` / `clearManual` (core.js)
These three functions already exist and are the native mechanism for tracking user-set fields on body objects. The `_manualFields` array on each body/star object is how generators know which fields to skip. The System Editor plugs directly into this — no new tracking mechanism needed.
- `markManual(obj, field)` — call when user sets a field in the editor
- `isManual(obj, field)` — generators call before each field assignment
- `clearManual(obj, field)` — call when a body moves to a new orbit (clears zone-dependent fields)

---

#### Algorithm 1: Editor Working Copy State

```
WorkingCopy {
  hexId, engine, isNewSystem, allowAddBodies, mainworldRef

  stars: [StarObject]   — each has _editorId, _manualFields[], role, parentStarId, and all star fields (undefined = engine fills)
  bodies: [BodyObject]  — flat list; each has _editorId, _manualFields[], parentStarId, type, orbitId, isMainworld, moons[]
}
```
- **Open existing system:** Deep-clone raw engine system (e.g. `stateObj.mgtSystem`) into working copy. All fields present, none manual — user edits call `markManual`.
- **Open new system:** Single blank StarObject (Primary, all fields undefined). Engine selection must have occurred first.
- **Original copy:** Second deep-clone taken at open, never modified. Used by Cancel to detect changes.

---

#### Algorithm 2: Local Undo/Redo Stack

Separate from global `saveHistoryState` (which is called once at Fill & Save for map-level undo).

```
_editorHistory []   — JSON-serialized WorkingCopy snapshots
_editorHistIdx -1   — current position

_pushHistory():
  Truncate array above _editorHistIdx
  Push JSON.stringify(_workingCopy)
  _editorHistIdx = length - 1
  Cap at 50 entries

undo() [Ctrl+Z]:  _editorHistIdx--; restore; _renderEditorTree()
redo() [Ctrl+Y]:  _editorHistIdx++; restore; _renderEditorTree()
```
Push on every structural operation (before the change) and on field-edit blur (not per keystroke).
Initial state pushed at editor open (position 0 = "before any edits").

---

#### Algorithm 3: Structural Operations

**addStar(role)**  → create StarObject (_manualFields:[]), push to stars, _pushHistory, render

**addBody(parentStarId, bodyType)**  → create BodyObject, markManual(body,'type'), assign next available orbitId, _pushHistory, push to bodies, render

**deleteBody(bodyId)**
```
If body has moons → warn-and-confirm "N moons will also be deleted"
_pushHistory → remove body + moons → if was mainworld: clear mainworldRef → render
```

**deleteStar(starId)**
```
If only star → show error "Cannot delete the only star"
Count all bodies on this star → warn-and-confirm "N bodies will be deleted"
_pushHistory → remove star + all its bodies → clear mainworldRef if affected → render
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
Note: typed orbit# changes that would cross a neighbor are blocked with a popup directing the user to drag-and-drop instead (`_wouldReorder` guard).

**setMainworld(bodyId)**
```
_pushHistory
All bodies: isMainworld = false
Target: isMainworld = true; markManual(body, 'isMainworld')
mainworldRef = bodyId → render
```

---

#### Algorithm 4: Drag-and-Drop (single star orbit tree only)

```
dragStart(bodyId):  _dragBodyId = bodyId; add 'se-dragging' CSS class

dragOver(event):
  If cursor over body in DIFFERENT star tree → show no-drop cursor; return
  Show drop-indicator at insertion point; compute targetOrbitId

dragDrop():
  If no valid target → dragCancel(); return
  Call moveBody(_dragBodyId, targetOrbitId)  ← handles history + warnings
  Clear drag state

dragCancel():  clear _dragBodyId; remove CSS classes; no history push
```

---

#### Algorithm 5: Fill Sequence

```
fillAndSave():

  1. VALIDATE PRIMARY STAR
     If no Primary star → error "A primary star is required" → return

  2. VALIDATE MAINWORLD (skip for T5)
     If mainworldRef === null AND engine !== 'T5':
       Dialog: [A] Let me pick one  [B] Let engine decide  [C] Cancel

  3. BUILD SEED SYS
     seedSys = { hexId, stars: deep-clone, worlds: deep-clone of bodies,
                 _allowAddBodies, _mainworldRef }
     ← _manualFields arrays are preserved in the clone

  4. CALL GENERATOR (switch on engine — v0.16.0.x scope: MgT2E and AoW only)
     MgT2E → MgT2EBottomUpGenerator.generateMgT2ESystemBottomUp(hexId, seedSys)
     AoW   → AoWBottomUpGenerator.generateAoWSystemBottomUp(hexId, seedSys)
     CT    → [deferred post-v0.16.0.x]
     T5    → [deferred post-v0.16.0.x]
     RTT   → [deferred post-v0.16.0.x]

  5. RUN UWP AUDITOR
     If errors → warn-and-proceed: [Proceed anyway] [Go back and fix]

  6. COMMIT
     saveHistoryState('System Editor: Fill & Save')  ← global map undo
     result.manually_edited = true
     commitEditorSystem(hexId, result, engine)
     Close editor → SystemViewer.open(hexId)
```

---

#### Algorithm 6: Generator Override Mechanism

`_buildSeedSys` passes working copy bodies (with `_manualFields`) to the generator as its starting `sys`. Inside each generator, every field assignment is gated:

```javascript
// Before: star.type = rollStarType();
// After:
if (!isManual(star, 'type')) star.type = rollStarType();

// allowAddBodies gate (inventory/allocation phases):
if (!seedSys || seedSys._allowAddBodies) {
    StellarEngine.generateSystemInventory(sys);
    StellarEngine.allocateOrbits(sys);
}
```

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

#### Algorithm 8: Cancel Sequence

```
cancel():
  hasChanges = JSON.stringify(_workingCopy) !== JSON.stringify(_originalCopy)
  If hasChanges → warn-and-confirm "Discard all unsaved changes?"
    [Discard] → close editor (map state unchanged)
    [Keep Editing] → return
  If no changes → close immediately
```

---

### Phase 4 — Implementation Sequence

**Steps 1–4 complete** — HTML structure (`hex_map.html`), context menu entry points (`js/canvas_input.js`, `js/system_viewer.js`), `system_editor.js` scaffold, and structural operations + drag-and-drop are all implemented.

---

#### Step 5 — Generator Override Gates (one engine at a time)
**Files:** `js/mgt2e_bottomup_generator.js`, `js/ct_bottomup_generator.js`, `js/aow_bottomup_generator.js`, `js/t5_topdown_generator.js`, `js/rtt_engine.js`

Pattern applied identically to all 5 generators:
```javascript
function generateMgT2ESystemBottomUp(hexId, seedSys = null) {
    const sys = seedSys || { hexId, worlds: [], stars: [], ... };
    if (!seedSys || seedSys._allowAddBodies) {
        StellarEngine.generateSystemInventory(sys);
        StellarEngine.allocateOrbits(sys);
    }
    if (!isManual(star, 'type')) star.type = rollStarType();  // at every field
    // mainworld: use seedSys._mainworldRef if set, else run normal election
}
```

Sub-steps and regression tests (⚠️ do not proceed to next engine until regression passes):
- **5a MgT2E:** Add seedSys param; gate stellar/inventory/world fields/mainworld. Regression: run MgT2E BU macro on 5 hexes, output identical to pre-change.
- **5b AoW:** Same pattern. Regression: AoW macro on 5 hexes.
- ~~**5c CT:**~~ **Deferred (post-v0.16.0.x)**
- ~~**5d T5:**~~ **Deferred (post-v0.16.0.x)**
- ~~**5e RTT:**~~ **Deferred (post-v0.16.0.x)**

**⚠️ Do not proceed to Step 6 until regressions for MgT2E and AoW pass.**

---

#### Step 6 — Fill & Save Orchestration
**Files:** `js/system_editor.js`

Add Fill & Save button to editor toolbar. Implement `_fillAndSave()` (Algorithm 5): validate → mainworld dialog → `_buildSeedSys()` → call generator → run UWP auditor → warn-and-proceed → `saveHistoryState()` → commit → close editor → `SystemViewer.open(hexId)`.

`_buildSeedSys()`: deep-clone working copy stars and bodies (preserving `_manualFields`) into seedSys object with `_allowAddBodies` and `_mainworldRef`.

- **Verify (each engine):** Create system, fill → appears on map with correct data; user-set fields survive Fill; allowAddBodies checkbox respected; audit errors → warn dialog with go-back option; edit existing system, change structure, fill → changes in result
- **Regression:** All existing macros still generate correctly (seedSys=null path untouched)

---

#### Step 7 — Commit Path
**Files:** `js/macro_orchestrator.js`

Add `commitEditorSystem(hexId, sys, engine)` — based directly on existing macro commit blocks (lines ~499–555). Nulls all competing engine data, writes engine-specific fields, sets `manually_edited: true`, calls `computeSystemCounts()`, `hexStates.set()`, `requestAnimationFrame(draw)`.

- **Verify (full round-trip, each engine):** Committed system on hex map; System Viewer renders it; Hex Editor shows correct fields; JSON export/re-import round-trips correctly; `manually_edited: true` in raw JSON; macro re-run on same hex overwrites correctly; map-level Ctrl+Z reverts to pre-edit state
- **Final regression:** Every macro type generates correctly; open/cancel preserves original; open/edit/fill/save produces correct result

---

### Phase 5 — Implementation Notes & Design Decisions (2026-06-22)

Steps 1–4 of the Phase 4 sequence are fully implemented. Steps 5–7 (generator override gates, Fill & Save validation, commit path) are partially implemented — see Section 6 for outstanding items. The following design decisions were made during or after implementation and are not reflected in Phases 2–4.

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
Each body's orbit row shows a read-only AU distance derived from `orbitId` via `_orbitIdToAU()`: `→ X.XX AU`. Displayed in dim text alongside the editable Orbit # field. Stars (companions) show the same. AU fields in the MgT2E/AoW hex editor accordion are **read-only** (shown as `<strong>` text, not editable inputs) since orbit is now managed in the system editor.

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

All three deferred engines have complete read/write/dispatch stubs in `js/system_editor.js`. The stubs are live code paths — they run if those engines are ever selected — but the underlying **generators have not been modified** with `isManual` override gates (Step 5 in Phase 4). Once the generators are gated, the stubs become fully functional.

---

### CT (Classic Traveller)

**Read stub — `_buildWorkingCopyFromState()`, lines ~177–206**
- Reads bodies from `raw.orbits[]` (each slot: `{ orbit, zone, distAU, contents }`) — skips `type === 'Empty'`
- Gas Giant size: `contents.size === 'S'` → `ggType: 'GS'`, else `'GL'`
- Also reads `raw.capturedPlanets[]` as orbitless bodies (no `orbitId`, no moons)
- All bodies assigned `parentStarId` of the primary star (index 0) — CT does not use multi-star parentage in the bottom-up generator
- CT companion orbit strings ("Close"/"Near"/"Far") produce `orbitId: null` and sort to end of merged list

**Write stub — `_buildSeedSys()`, lines ~1369–1400**
- Produces `seed.orbits[]`: each entry `{ orbit, zone: 'H', distAU, contents }`
- `contents` format: `{ _id, type, size, name, uwp, travelZone, satellites[], _manualFields[] }`
- Type mapping: `'Gas Giant'` → `'Gas Giant'`; `'Belt'` → `'Planetoid Belt'`; else `'Terrestrial Planet'`
- GG size: `ggType === 'GS'` → `size: 'Small'`; else `size: 'Large'`
- Zone field hardcoded to `'H'` — the generator will recalculate zones from orbit position
- **Known gap:** `_buildSeedSys` does not populate `capturedPlanets` — only `orbits`. Captured planet support needs to be added in v0.16.1.

**Dispatch stub — `_runGenerator()`, lines ~1484–1492**
- Calls `window.CT_Generator.generateSystem({ mode: 'bottom-up', hexId, seedSys })`
- Writes `stateObj.ctSystem = newSys` and `stateObj.ctData = newSys.mainworld || null`
- **Known gap:** The generator override gate (Step 5b in Phase 4) has **not** been applied to `js/ct_bottomup_generator.js`. Until that is done, `seedSys` is passed but ignored by the generator.

---

### T5 (Traveller 5)

**Read stub — `_buildWorkingCopyFromState()`, lines ~207–231**
- Reads from `raw.worlds[]` (flat list) if present; falls back to iterating `raw.stars[].orbits[]` slots
- `parentStarIdx` preserved from world objects or inferred from the star index when iterating slots
- `au` resolved as `w.au ?? w.distAU ?? _orbitIdToAU(w.orbitId)` in that priority order
- UWP preserved from body objects

**Write stub — `_buildSeedSys()`, lines ~1401–1420**
- Builds `seed.mainworldUWP`: extracts UWP, name, travelZone from the flagged mainworld body. Falls back to `'A788899-9'` if no UWP set — this placeholder needs replacing with a proper "no UWP" signal in v0.16.1
- Produces `seed.worlds[]` as a flat list with `{ _id, type, name, uwp, orbitId, parentStarIdx, _manualFields[] }`
- T5 is top-down: `seed.mainworldUWP` is the anchor; the generator ignores most of `seed.worlds`

**Dispatch stub — `_runGenerator()`, lines ~1493–1504**
- Calls `window.System_Driver.generateSystem({ edition: 'T5', mode: 'top-down', mainworldUWP: seedSys.mainworldUWP, hexId, seedSys })`
- Guard: skips if `seedSys.mainworldUWP` is null (generator cannot run without a mainworld UWP)
- Writes `stateObj.t5System = newSys` and `stateObj.t5Data = newSys.mainworld || null`
- **Known gap:** T5 top-down generator does not accept or consult `seedSys` today. The override gate (Step 5d in Phase 4) must be applied to `js/t5_topdown_generator.js` before user-placed bodies survive Fill.
- **Known gap:** Algorithm 7 (HZ-proximity mainworld selection when no mainworld designated) is not implemented in the stub. It must be added in v0.16.1 before the T5 mainworld validation dialog can function.

---

### RTT (RTT Worldgen)

**Read stub — `_buildWorkingCopyFromState()`, lines ~232–265**
- Reads from `raw.stars[].planetarySystem.orbits[]` — iterates per star, sorted by `orbitNumber`
- AU is approximated from zone: Epistellar (base 0.10AU, step 0.10), Inner (base 0.50AU, step 0.70), Outer (base 5.00AU, step 8.00). These are estimates for display order only — RTT does not use AU natively.
- UWP is not read (RTT mainworld UWP is in `rttData`, not in orbit entries) — bodies load with `uwp: null`
- Travel zone: `'Red'` if body has a `'Z'` base; else `'G'`
- **Known gap:** UWP is not transferred from `rttData.uwp` to the mainworld body. In v0.16.1, the read stub should look up `raw.mainworld.uwp` (or the equivalent rttData field) and assign it to the mainworld body.

**Write stub — `_buildSeedSys()`, lines ~1421–1444**
- Produces `seed.rttBodies`: a 2D array indexed by star (`rttBodies[starIdx][]`)
- Per-body format: `{ _id, orbitNumber, zone: 'Inner', type, satellites[], name, _manualFields[] }`
- Type mapping: `'Gas Giant'` → `'Jovian Planet'`; `'Belt'` → `'Asteroid Belt'`; else `'Terrestrial Planet'`
- Zone is hardcoded to `'Inner'` — the RTT generator will recalculate zone from orbit position
- **Known gap:** The full RTT pipeline is Step1 → Biographer → Step2 → Step3. The dispatch stub only calls Step1. Biographer + Steps 2 and 3 must be threaded in v0.16.1.

**Dispatch stub — `_runGenerator()`, lines ~1505–1515**
- Calls `generateRTTSectorStep1(hexId, { seedSys })`
- Writes `stateObj.rttSystem = newSys`
- Calls `extractRTTMainworld(newSys, _workingCopy.mainworldRef)` for `stateObj.rttData` if that function exists
- **Known gap:** Only Step1 is called. The existing `_rttSaveManual`/`_rttRestoreManual` pattern in `js/rtt_engine.js` is the head start for threading `seedSys` through the full pipeline — see the existing RTT engine code before designing the v0.16.1 override gate.

---

### What v0.16.1 Must Do (per engine)

| Engine | Generator gate needed | Additional stub gaps |
|---|---|---|
| CT | `js/ct_bottomup_generator.js` Step 5b | `capturedPlanets` in write stub |
| T5 | `js/t5_topdown_generator.js` Step 5d | Algorithm 7 (HZ mainworld); UWP fallback |
| RTT | `js/rtt_engine.js` Step 5e | Full pipeline (Step1→Bio→Step2→Step3); UWP read in load stub |

The engine selection dialog HTML (`#se-engine-dialog`) must also add CT / T5 / RTT radio buttons when v0.16.1 work begins.

---

## 6. Outstanding Work Items & Bugs

### Spec Gaps — implemented in the manifest but not yet in the code

**OW-1 — Primary star validation gate (Fill & Save)**
`_fillAndSave()` should check that a Primary star exists before proceeding. If none: show error dialog "A primary star is required" and return. Currently the function calls `_buildSeedSys()` unconditionally.
*Spec ref: Algorithm 5, Step 1*

**OW-2 — Mainworld validation dialog (Fill & Save)**
If `_workingCopy.mainworldRef === null` at Fill time (and engine is not T5), show a three-option dialog: [A] Let me pick one / [B] Let engine decide / [C] Cancel. Currently the code skips this check entirely.
*Spec ref: Algorithm 5, Step 2*

**OW-3 — UWP Auditor step (Fill & Save)**
After the generator runs, the UWP Auditor should be called. If it returns errors, show a warn-and-proceed dialog: [Proceed anyway] / [Go back and fix]. No auditor call exists in the current code.
*Spec ref: Algorithm 5, Step 5*

**OW-4 — `manually_edited: true` flag not set on commit**
Both `_fillAndSave()` and `_preview()` write to `hexStates` without setting `stateObj.manually_edited = true`. This flag is required so the rest of the app can identify editor-produced systems.
*Spec ref: Algorithm 5 Step 6; Architecture Constraints*

**OW-5 — Commit path is inline, not in `macro_orchestrator.js`**
The spec calls for a `commitEditorSystem(hexId, sys, engine)` function in `macro_orchestrator.js` as the shared commit gate. Currently the full commit (clear old data, write new engine data, `computeSystemCounts`, `hexStates.set`, redraw) is handled inline inside `system_editor.js`. Functionally equivalent for now, but diverges from the planned architecture. Decide before v0.16.1 whether to extract or accept inline as the permanent pattern.
*Spec ref: Phase 2 Modified Files table; Phase 4 Step 7*

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
- Neither the CT fix nor the T5 gap were reachable by users at the time of this investigation — System Editor editing is currently enabled for MgT2E (and AoW) only, per Section 5. The CT fix was applied anyway since it was low-risk and self-contained; it will already be correct whenever CT editing ships in v0.16.1.

---

## 7. Future Release Notes

### T5 — Gas Giant / Body-List Sync Gap (found 2026-07-01, deferred to v0.16.1)

Investigating Bug #7 (System Editor GG symbol not updating) confirmed T5's issue is broader than a display flag, and sharpens the "Known gap" already logged in Section 5's T5 subsection: `t5_topdown_generator.js`'s `generateT5System(mainworldBase)` takes only the mainworld's UWP as an anchor and always independently re-rolls its own gas giant / belt / terrestrial inventory from dice. `system_driver.js`'s T5 branch (`generateSystem({ edition: 'T5', mode: 'top-down', ... })`) never threads `seedSys.worlds` into that call — it's only consulted to look up the mainworld's own UWP when `_mainworldRef` is set.

Practical effect once T5 editing is enabled: adding or removing **any** body (not just a Gas Giant — belts and terrestrials too) via the System Editor's "+GG"/"+World"/"+Belt" buttons on a T5 system will have no effect on the generated result. The body silently fails to appear (or disappear) after Fill & Save / Preview, because the generator never sees the edited body list.

A real fix requires applying Step 5d (the generator override gate) to `js/t5_topdown_generator.js` — teaching it to accept a seeded body list, match bodies by `_id`, preserve/add/remove per the seed, and only roll fresh bodies for anything not seeded — mirroring the pattern already applied to MgT2E and CT. There's an existing but unused `restoreT5ManualFields` / `generateT5SystemPreservingManuals` pair in `system_driver.js` that only patches field-level edits onto matching existing bodies by index; it does not add or remove bodies, so it would not close this gap on its own.

No code changes were made for this — T5 editing is not yet enabled for users (Section 5), so there is no way to exercise or verify a fix in the UI today. Queue alongside Step 5d and Algorithm 7 in v0.16.1.

