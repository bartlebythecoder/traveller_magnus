# ROUTE FILE — Feature Spec (save and load one route)

**Target version:** v0.17.2 (in progress)
**Status:** IMPLEMENTED 2026-08-19 (WP1-WP4 complete, verified in-browser).
Written as a spec the same day; kept as the record of why it is shaped this way.
**Related:** `js/ui_menus.js` (Route Manager), `js/routes.js` (`addRoute`),
`js/io_manager.js` (`downloadBlob`, `readFileAsText`), `directives/project_manifest.md`

---

## 1. Goal

A user can save the connections of one route slot to a file, and load that file back
into any route slot — on the same map or on another map built on the same sector grid.

This completes the pair. The Route Manager has offered a download (⬇, a CSV of the
*worlds* a route passes through) since v0.16.2.1, with no way back in. That CSV cannot
rebuild a route: outside Point-to-Point its world list is unordered, and the Hex column
is optional.

---

## 2. The model

**Identity lives at the destination; the file carries connections only.**

The user picks a route slot that already has a name and a colour — default or their own —
and imports into it. Nothing about the route's appearance travels in the file, so there
is nothing to reconcile, merge, or overwrite.

This is what makes the feature small. The existing whole-sector XML importer
(`_autoAssignXmlRoutes`, io_manager.js:1991) derives everything from the file: it groups
segments by colour, hunts for a free slot, and renames it. Every failure mode found
during investigation — two routes merging because they shared a colour, names lost,
running out of slots, an import that could not be undone — comes from that derivation.
Here the user has already answered the question by choosing the row.

---

## 3. Decisions taken

| # | Decision | Why |
|---|---|---|
| D1 | **Absolute hex IDs** (`1-D-2904`), not sector-relative codes plus offsets | The offset machinery exists solely to survive a rearranged sector grid, which §4 rules out. A hex ID already names its sector, so cross-sector routes need no special handling at all |
| D2 | **JSON**, not XML | An `.xml` file with absolute IDs in `Start`/`End` would eventually be fed to "Import Metadata (.xml)", which runs every code through `_hexCodeToHexId` → `` `${slot}-${sub}-${code}` `` → `1-?-1-D-2904`. Garbage hex IDs, no error. A different extension makes the two impossible to cross-feed |
| D3 | **Replace**, not append | Makes re-importing the same file idempotent. Appending doubles the route — measured: 12 segments → 24 across 4 slots, with a segment drawn twice |
| D4 | **Grid fingerprint, refused on mismatch** | See §4 |
| D5 | Source route's name recorded, **informational only** | Lets the confirm dialog say what is being loaded where. Never applied to the destination |
| D6 | **No world-existence validation** | Routes legitimately cross empty hexes, and deep-space stops are a supported feature since v0.17.1. The only check is that the hex exists on this grid |

---

## 4. The grid constraint

A route file is valid only on a map whose sector grid matches the one it was saved from.
Moving sectors around invalidates your route files.

This must be **refused, not silently obeyed**. Absolute hex IDs on a resized grid still
resolve to perfectly valid hexes — just the wrong ones — so without a check the failure
mode is a route quietly drawn in the wrong place. The file records `grid.width` and
`grid.height`; a mismatch aborts the import with:

> This route file was saved from a 7×5 map. This map is 8×6. Route files don't survive a
> change to the sector grid.

Nothing is modified when an import is refused.

---

## 5. File format

`asab-route`, version 1. Extension `.json`.

```json
{
  "format": "asab-route",
  "version": 1,
  "grid": { "width": 7, "height": 5 },
  "savedAs": "Cross Border Run",
  "savedAt": "2026-08-19T00:00:00.000Z",
  "subtype": "PointToPoint",
  "segments": [
    ["1-D-2705", "1-D-2904"],
    ["1-D-2904", "1-D-3104"],
    ["1-D-3104", "2-A-0104"]
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Must be `"asab-route"`. Anything else is rejected |
| `version` | yes | Must be `1` |
| `grid` | yes | Sector grid the file was saved from — see §4 |
| `savedAs` | no | The source route's name. **Display only** |
| `savedAt` | no | ISO timestamp. Display only |
| `subtype` | no | Present when every segment in the source shared one (in practice `"PointToPoint"`). See §6.3 |
| `segments` | yes | Array of `[startHexId, endHexId]` pairs |

Colour is deliberately absent. So is any route or group id.

**Filename:** `route_<Name>.json`, sanitised exactly as the CSV export already does
(`_routeCsvFilename`, ui_menus.js:1431) — `route_Cross_Border_Run.json` beside
`route_Cross_Border_Run.csv`.

---

## 6. Behaviour

### 6.1 Export

Triggered by ⬆'s partner — a new **save** control on the route row (§7).

1. Collect `window.sectorRoutes.filter(r => r.routeId === def.id)`.
2. If empty, the control is disabled; nothing to do.
3. Write each as `[r.startId, r.endId]`, preserving the array's existing order.
4. Set `subtype` if every segment agrees on one; otherwise omit it.
5. Hand off via `downloadBlob(json, filename, 'application/json')` — the shared routine
   from v0.16.2.1 item 12, which defers blob-URL cleanup. **Do not roll a new download
   path.** It returns a success flag; report it the way the CSV export does, naming the
   file in both the success and failure toast.

### 6.2 Import

Triggered by the ⬆ on a route row. The row identifies the destination — no picker, no
prompt for a sector.

Order of operations, strictly:

1. Read via `readFileAsText` (io_manager.js:32).
2. `JSON.parse` inside a `try`. A parse failure is a clean "that isn't a route file"
   message, not a console trace.
3. Validate `format`, `version`, `grid`, `segments` — reject with a specific message per
   §8.
4. Validate every hex ID: it must round-trip through `getHexCoords` → `getHexId` to
   itself, the same guard `isVacantHex` uses (core.js). One bad ID fails the whole import;
   a partly-loaded route is exactly the state item 2 of v0.17.2 was written to prevent.
5. Confirm with the user (§7.2). Cancelling changes nothing.
6. `saveHistoryState('Import route: <destination name>')` — **plain, no
   `includeRouteDefinitions`**. Route definitions are not touched by this feature, so the
   default snapshot is correct and sufficient.
7. Remove the destination slot's existing segments:
   `window.sectorRoutes = window.sectorRoutes.filter(r => r.routeId !== routeId)`.
8. Add each pair via `addRoute` (§6.3).
9. `dbManager.saveRoutes()`, `requestAnimationFrame(draw)`, `refreshRouteWindowCounts()`.
10. Toast: `Loaded 18 segment(s) into "Merchant Circuit".`

### 6.3 How segments are added

```js
const typeMap = { 1: 'Xboat', 2: 'Trade', 3: 'Secondary' };
const type    = typeMap[routeId] || 'Filter';
const extras  = { routeId };
if (type === 'Filter') extras.groupId = `import_${routeId}`;
if (fileSubtype)       extras.subtype = fileSubtype;
addRoute(startId, endId, type, null, extras);
```

Three points, each load-bearing:

- **The same `typeMap` as `canvas_input.js` and `_applyXmlRoutesForGroup`.** An imported
  segment must be indistinguishable from a hand-drawn one on that slot, or the renderer
  will draw it on a different layer and the alt-drag toggle will behave inconsistently.
- **No `color` on the segment.** The renderer prefers the definition's colour and only
  falls back to `r.color`, so leaving it off is what makes the route wear the
  destination's colour. Verified by prototype: after importing a magenta route into an
  orange slot, the canvas held 402 pixels of the destination orange and **zero** of the
  original magenta.
- **`groupId` is required for Filter-type slots.** `addRoute`'s duplicate check consults
  `groupId` for Filter routes; without one, a file containing a repeated pair would be
  silently deduplicated against the wrong thing.

`subtype` is restored because it is topology, not decoration: `getRouteSystemList`
(ui_menus.js:1220) lists a route in travel order only when `segments[0].subtype ===
'PointToPoint'`. Drop it and an imported route lists its worlds alphabetically instead of
in the order you'd fly them. Restoring it is safe — that function independently checks
the segments form a clean chain and falls back to unordered when they don't.

---

## 7. UI

### 7.1 The route row

The row already carries `⬇` (`.route-export-btn`, CSV). Add **`⬆`** (`.route-import-btn`)
immediately after it, and make the existing ⬇ open a small menu — or, simpler and
preferred, add the JSON save as a **second icon** so the three read left to right:
`⬇ CSV` (worlds, for reading) · `💾 save route` · `⬆ load route`.

Enablement:

- **save** — disabled when the slot has no segments, styled exactly as the CSV button
  already is when empty (`opacity 0.3`, `cursor default`, explanatory `title`).
- **load** — **always enabled**, including on an empty slot. Loading into an empty slot is
  the normal case.

Wiring note: `refreshRouteWindowCounts` reassigns `.route-export-btn.onclick` on every
count refresh, which is why that button uses `.onclick` rather than `addEventListener`
(ui_menus.js:2702). The new buttons are not touched by that function, so they may use
`addEventListener` inside `renderRouteWindow` — rows are rebuilt wholesale there, so
listeners cannot stack.

### 7.2 The confirm

Loading into an **empty** slot — no confirm, just do it.

Loading into a slot that **already has segments**:

> Load "Cross Border Run" (18 segments) into "Merchant Circuit"?
>
> This replaces the 6 segment(s) currently in "Merchant Circuit".
> It keeps that route's name and colour, and can be undone with Ctrl+Z.

`savedAs` supplies the quoted source name; when the file has none, it reads
"Load 18 segments into …".

---

## 8. Error cases

Every one of these leaves the map, the slot and the undo history untouched.

| Condition | Message |
|---|---|
| Not JSON / parse error | `That file isn't a route file — it could not be read as JSON.` |
| `format` missing or wrong | `That isn't a route file. Route files are saved from the Route Manager.` |
| `version` unrecognised | `This route file was saved by a newer version of the app (format v2). Update to load it.` |
| Grid mismatch | See §4 |
| `segments` missing/empty | `That route file contains no connections.` |
| A hex ID is malformed or off-grid | `This route file refers to a hex that doesn't exist on this map (1-Z-9999). Nothing was loaded.` |
| Download fails on save | Mirror the CSV export's failure toast, naming the file |

---

## 9. Implementation plan

Four work packages, each independently verifiable.

**WP1 — Export.** `js/ui_menus.js`. Add `_routeFileFilename(routeName)` beside
`_routeCsvFilename`, and `exportRouteFile(routeId, routeName)`. Reuses `downloadBlob`.
~40 lines. No other file changes.

**WP2 — Import.** `js/ui_menus.js`. Add `_parseRouteFile(text)` returning
`{ ok, error, data }` — pure, no side effects, the whole of §8 lives here and it is the
piece worth testing hardest — and `importRouteFile(routeId, routeName, file)` performing
§6.2 steps 5-10. ~90 lines.

**WP3 — UI.** `js/ui_menus.js` `renderRouteWindow` row template + listeners; one hidden
`<input type="file" accept=".json">` in `hex_map.html`, reused by every row (set
`value = ''` after each use, as `setupXmlMetadataImporter` does); CSS for the two icons
alongside the existing `.route-export-btn` rules.

**WP4 — Docs.** `changelog.md` + README changelog entry under v0.17.2;
`help_routes.md` gains a "Saving and loading a route" section; note the new format in
`directives/project_manifest.md`.

Nothing in `js/routes.js`, `js/io_manager.js` or `js/core.js` changes. `addRoute`,
`downloadBlob`, `readFileAsText` and `saveHistoryState` are all used as they stand.

---

## 10. Test plan

In-browser Playwright, as used throughout the v0.17.2 route work — `node --check` alone
has repeatedly missed real bugs in this codebase.

1. **Round trip, one sector.** Build a P2P route, save, wipe, load into a *differently
   named and coloured* slot. Assert: same segment set; destination name and colour
   unchanged; segments carry no `color` of their own.
2. **Round trip, crossing a sector boundary.** The case that defeats the per-sector XML
   export. Assert all segments return, both sectors present.
3. **Rendered colour.** Sample the canvas: destination colour present, source colour
   absent. (Prototype result: 402 px vs 0 px.)
4. **Idempotence.** Load the same file twice. Assert the segment count is identical after
   the second load — this is D3's whole purpose.
5. **Replace.** Load into a slot holding a different route. Assert the old segments are
   gone and the count is right.
6. **Undo.** Ctrl+Z after a load restores the previous segments exactly; the slot's name
   and colour are untouched throughout.
7. **Travel order.** Save and load a P2P route, then open the Route Systems panel and
   assert it still lists in travel order — the `subtype` check of §6.3.
8. **Every §8 error**, each asserting `sectorRoutes` is byte-identical afterwards.
9. **Grid mismatch**, by saving a file then changing `gridWidth` before loading.

---

## 11. Non-goals

- Preserving colour, name, or shortcut key. §2.
- Any multi-route or whole-sector file. One file, one route. Whole-map transfer is what
  the sector `.json` save is for.
- TravellerMap interoperability. That is what Export/Import Metadata (.xml) is for, and
  keeping these formats separate is decision D2.
- Restoring the Point-to-Point *setup* (`automationRef` — the Start/End/waypoint list), so
  an imported route cannot be reopened in the P2P builder and regenerated. It could be
  added to the format later as an optional field; it is deliberately out of scope for v1.

---

## 12. Open questions — both resolved

- **OQ-1 — Icon or menu? RESOLVED: one new column holding two icons.** Sean chose to try
  the extra column rather than a menu. Implemented as a single `.route-file-cell` holding
  `fa-file-export` (save) and `fa-file-import` (load), so the row gains one column rather
  than two. Nothing overflows the 430px window. Standing reservation: three file-shaped
  icons in one row (⬇ CSV, save, load) are hard to tell apart without hovering, and the
  CSV button may want relabelling if that proves annoying in use.
- **OQ-2 — Save inside the CSV modal? RESOLVED: no, kept separate.** They answer different
  questions — the CSV is *what is on this route* (worlds, richly, unreadable back in), the
  route file is *what this route is* (connections, nothing else). Merging them would have
  put two unrelated outputs behind one control.

### Deviation from this spec, as built

§9 said no file outside `js/ui_menus.js` and the markup would change, and that held. The
hex-id validation is a private `_isRealHexId` in `ui_menus.js` rather than a shared helper
in `core.js` alongside `isVacantHex`: two copies of a three-line round-trip idiom did not
justify editing working generation code. Revisit if a third appears.

---

## 13. Evidence behind this spec

All measured in-browser on v0.17.2, 2026-08-19:

- Importing into an explicitly chosen slot works today via `_applyXmlRoutesForGroup`'s
  existing `targetRouteId` parameter — prototyped, 6 cross-sector segments into slot 5,
  destination identity untouched, drawn in the destination's colour.
- The current per-sector XML export splits a 6-segment cross-border route into a 3-segment
  file and a 4-segment file; importing one gives a route truncated at the border, and
  importing both gives 7 segments across two slots with one drawn twice.
- Re-importing an unchanged file appends rather than replaces: 12 segments → 24.
- `_autoAssignXmlRoutes` calls `saveHistoryState` without `includeRouteDefinitions`, so
  the *existing* whole-sector import is not fully undoable. Out of scope here — this
  feature never touches definitions — but worth fixing separately, now that the option
  exists (see v0.17.2 changelog item 5).
