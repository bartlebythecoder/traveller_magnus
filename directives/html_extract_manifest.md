# HTML EXTRACT — Feature Manifest

**Version:** v0.17.0 shipped 2026-08-03; **v0.17.0.1 — the fog-of-war release — code
complete 2026-08-04, changelog still marked "In Progress"**
**Status (2026-08-06): RELEASE 1 AND RELEASE 2 BOTH COMPLETE AND COMMITTED.**

- **Release 1** (GM HTML wiki) — WP1, WP2, WP3. `js/html_exporter.js` ships, reachable
  from the real UI, verified on all five engines, with a clickable subsector map.
- **Release 2** (players' fog of war) — WP4, WP5, WP6, plus five post-WP6 items Sean
  raised: the body-count leak (4.7), the Player Disclosure grid (4.8), numeric display
  rounding (4.9), submenu clamping (4.10 — shipped 2026-08-04, written up 2026-08-06), the
  world-image seed mismatch (4.11) and the raw-body mis-pairing (4.12). **Neither 4.11 nor
  4.12 was a fog-of-war bug** — both were reported against a players' export but affected
  referee exports identically.
- **Every design question is closed.** HX-1 to HX-9 and Q1 all resolved; HX-1a cancelled.
  The field-level answer key is `directives/fog_of_war_field_tags.md` §3.5, its WP5
  implementation checklist §12, the player-map spec §9.3a.

**Open items: two, neither blocking — see section 9.** The in-app numeric rounding sweep
(~350 sites, parked for Sean's judgement) and the changelog/README release housekeeping.

**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)
**Related:** `directives/project_manifest.md` (main manifest, v0.16.x System Editor —
paused), `directives/fog_of_war_field_tags.md` (the disclosure answer key),
`js/export_core.js` (shared core), `js/obsidian_exporter.js` / `js/html_exporter.js`
(the two renderers), `js/disclosure.js` + `js/disclosure_grid.js` (the model and its UI)

---

## 0. RESUME HERE — cold-session handover

Last updated **2026-08-06**, after the full Release 1 + Release 2 build. Nothing is
half-finished; the tree is in a known-good, fully verified state. **No uncommitted work
in progress** — HEAD is `9971e99 v0.17.0.1 player FOW`, working tree clean.

### 0.1 Where things stand — verified against the code 2026-08-06

Both releases are **built, verified and committed**. The line counts below were re-read
from disk, not copied forward from an earlier session.

| File | Lines | Role |
|---|---|---|
| `js/export_core.js` | 1243 | Shared format-agnostic core — ZIP, filenames, raw lookup, the twelve `format*` functions, the block model, **and the disclosure filter** (`FIELD_LEVELS`, `filterBlocks`) |
| `js/obsidian_exporter.js` | 720 | Markdown renderer (was 1235 pre-WP1) |
| `js/html_exporter.js` | 1082 | HTML renderer, page shell, index tables, clickable map |
| `js/disclosure.js` | 198 | Per-hex `state.disclosure` model + assign modal (WP4, 4.4) |
| `js/disclosure_grid.js` | 455 | The **D** status/edit window (4.8) |
| `js/renderer.js` | 1604 | Gained `setMapDisclosure`/`_mapShow` for the fogged map (WP6) |

Script tags in `hex_map.html`: `disclosure.js` line 50, `disclosure_grid.js` 51,
`export_core.js` 85, `obsidian_exporter.js` 86, `html_exporter.js` 87. **`export_core.js`
must precede both exporters.** `APP_VERSION` is `v0.17.0.1` (`js/core.js:8`).

**Everything in section 4 is DONE.** WP1-WP6 plus 4.7 (body-count leak), 4.8 (disclosure
grid), 4.9 (numeric rounding), 4.10 (submenu clamping), 4.11 (world-image seed) and 4.12
(raw-body mis-pairing). Section 9 carries the only two open items, neither of which blocks
anything.

`js/planet_renderer.js` gained `imageSeed()` (4.11) — **the single definition of a body's
image seed**, shared by `hex_editor.js` and both exporters. Anything that renders a world
must build its seed through it.

### 0.2 First three things to do

1. **Confirm the tree is still good** before changing anything:
   ```
   cd .tmp/html_export_harness
   node export_runner.js check fast
   ```
   Compare the `sha256` values in `baseline_check/_summary.json` against
   `baseline_fmt_summary.json` (or the table in 7.1). Expect 6/6 match. **These hashes
   were re-baselined 2026-08-04** after the numeric rounding change (4.9) — an older
   session's numbers will not match. If they do not match, find out what changed before
   proceeding.
2. **Read section 2** (locked decisions D1-D6). Do not re-litigate them; each was put to
   Sean as an explicit either/or and answered. Then read **0.3** — the standing rules are
   the distilled cost of everything that went wrong in this work.
3. **Do not re-derive the disclosure ladder.** Every field, image, map element and index
   column already carries an explicit level. The authority is
   `directives/fog_of_war_field_tags.md` — **§3.5** is the answer key, **§12** the WP5
   checklist, **§9.3a** the player-map spec — and `export_core.js`'s `FIELD_LEVELS` is its
   executable form. **Change a level in one without the other and they silently diverge.**
   They already did once (`Gas Giants`, live two days, found 2026-08-06 — see section 8).
   **If you touch either, diff them, and diff them per context**: `Mass`, `Eccentricity`
   and `Orbit ID` legitimately hold different levels on a star and on a world, so a flat
   label comparison reports three false failures.

The harness in `.tmp/html_export_harness/` now has **fourteen** check scripts (inventory
in 7.4) — extend rather than rewrite.

### 0.3 Standing rules for this work

These are not general advice. Each one was paid for by a specific failure in this feature.

**Verification**

- **Every change ends with the Obsidian suite at 8/8** against `baseline_fmt_summary.json`.
  Anything touching `export_core.js` can change Markdown output; if it does, that is a bug
  unless deliberately intended and re-baselined (as HX-6, HX-8 and 4.9 were — three
  deliberate re-baselines, no more).
- **`node --check` is not verification** — see 7.2. Test in a real browser.
- **Look at the rendered result, not just green checks.** This found what every automated
  check missed **eight** times: 2c's scrolled-away header and empty column, 2d's duplicated
  heading, HX-9's sticky row, WP4's ragged-staircase modal, 5c's "World 2 Mainworld", 5d's
  over-restricted orrery labels, WP6's mixed-level map, and 4.8.3's wrong-subsector window.
  **Screenshot or print the page. Do not skip it.**
- **Confirm a check is measuring the right thing before trusting its result — pass or
  fail.** Ten recorded incidents of a check that reported confidently while looking at
  nothing (4.4's `r.name`/`r.id`, 5a's `resolveWorldData` sweep over 0 bodies, three false
  failures in 2b, three more in 5b, 5e's level-0 hex count, 4.11's wrong raw array, and
  **4.12's field diff that reported "0 of 67052 changed" because its subsector list omitted
  the one subsector containing the bug**). A red result is not evidence either.
  **Check a tool's scope before trusting a zero.**
- **Say which runs should move before you look.** A re-baseline that changes runs it has no
  business changing is a bug, not a re-baseline — see 5.6.
- **The export UI is three interactions deep** — splash → cog → section header → button.
  See 4.2.7 before writing any UI test.

**Fog of war**

- **Emptying a container is not withholding it.** The field filter cannot see structure:
  a blanked section still discloses that a body exists, and a per-body file discloses it
  from the file listing alone. See 4.7 — this shipped as a real leak.
- **Whenever output is assembled by hand rather than through the block model, it bypasses
  `filterBlocks` entirely.** Both formats had the same two classes of this leak, found
  months apart: HTML's `data-*` attributes and SVG `<title>`, Obsidian's YAML frontmatter.
  None appears in rendered body copy, so no DOM sweep or parity check will find them.
  **Grep for template literals building output when auditing any new surface.**
- **The leak check searches raw ZIP bytes** — pages, filenames and attributes together.
  Keep it that way; that is why it caught the two above.
- **Pixels are a disclosure surface.** The orrery and the subsector map carry names and
  UWPs as drawn text. Both are re-rendered at the disclosure level (5d, WP6), not filtered.
- **`fog_of_war_field_tags.md` and `FIELD_LEVELS` must change together** (0.2 item 3).

**Rules and data**

- **Do not "fix" the RTT starport/Outpost behaviour** — it is correct Rules As Written,
  see 5.5. Do not suppress RTT's `None` values either — 5.5 again.
- **Do not add the deferred AoW fields by guessing** their units or meaning — see 5.7.
- **Display-time rounding only.** 4.9 deliberately left all ~570 engine-side `toFixed`
  calls untouched; rounding at generation would change generated worlds and invalidate the
  frozen fixture.
- **One seed, one definition.** Every surface that renders a world builds its seed through
  `PlanetRenderer.imageSeed()`. Do not reconstruct a seed string anywhere — that is exactly
  how the app and the exporters drifted into drawing different planets (4.11). It is keyed
  on the body **name**, not a list index, because CT/T5/RTT give the app and the exporters
  no shared index; do not "simplify" it back to an index without reading 4.11.
- **A players' export and a referee export of the same world must be pixel-identical.**
  Seeds read raw body data, never a disclosed name. Fog of war withholds *what is shown
  about* a world, never *which world it is*.
- Zero-Assumption Policy applies to every disclosure decision in 5.3 and to the tagging
  table. Nothing in either was inferred; all of it was answered by Sean.

### 0.4 Read-me-first ordering

1. Section 2 — the six locked decisions. Do not re-litigate.
2. Section 9 — the two open items, and what is explicitly closed so it is not reopened.
3. Section 7 — verification protocol, baseline hashes, and the harness inventory (7.4).
4. Sections 4.4-4.10 — the Release 2 build, in order. 4.7 is the one that shipped broken.
5. Sections 4.0-4.3 — Release 1, if you are touching the GM path or the shared core.

**Do not trust Section 3.1's line numbers** — they describe `obsidian_exporter.js` as it
was *before* WP1 and are kept only as a record of the original split. Section 3.2's line
numbers were re-verified 2026-08-06 and are current. **Section 5.2's leak audit describes
the pre-Release-2 state** and is kept as the reasoning behind the design; each finding now
carries a pointer to where it was closed.

---

## 1. Goal

Provide an HTML equivalent of the existing Obsidian wiki export, for users who do not
use Obsidian or Markdown. Origin: a user request relayed by Sean, 2026-08-01.

Two releases:

- **Release 1 (this version)** — GM-facing HTML wiki. Full detail, no filtering.
- **Release 2 (later)** — "Players' version": per-system fog-of-war disclosure levels.

Release 2's requirements are recorded here from the outset because they materially
constrain Release 1's architecture. Do not build Release 1 in a way that forecloses them.

---

## 2. Decisions Locked (2026-08-01)

All six were put to Sean as explicit either/or choices and answered. Rationale is
recorded so a later session does not silently re-litigate them.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Sequencing: GM export first.** WP1 -> WP2 -> WP3 ship as Release 1. Fog-of-war is Release 2. | WP1 is a prerequisite either way, so nothing is wasted, and the user gets something usable sooner. |
| D2 | **One HTML page per system.** Stars, worlds and moons are anchored sections within it (`#prometheus`, `#prometheus-luna`), not separate files. ~40 files per subsector. | One-file-per-body is right for Obsidian (backlinks, graph view) but produces 300-500 three-fact pages, which browse badly on `file://`. Also simplifies Release 2 page-suppression: omit a section, not a file. |
| D3 | **Per-subsector ZIP, merge-friendly.** Each ZIP extracts into a shared sector folder. `style.css` and a sector-level `index.html` at root; `Subsector X/` beneath. | HTML has no name-based link resolver, so 16 independent exports would be 16 disconnected islands. Sector index lists every subsector with data in the app; links to un-exported subsectors are dead until exported. Accepted. |
| D4 | **Light JS.** Sortable + text-filterable index tables; hex-map hover tooltips. Inline per page, no `fetch`, degrades to plain tables with JS off. | Wiki-wide search was rejected: it needs a generated `search-index.js` merged across ZIPs, which reintroduces exactly the cross-export staleness D3 avoids. A stale search index gives confidently wrong answers. |
| D5 | **Dual theme.** One `style.css` on CSS custom properties. Dark default (matches app palette), light via `prefers-color-scheme`, toggle persisted to `localStorage`, print styles force light and hide nav/map overlay. | ~40 lines of CSS over a single theme. Dark-only prints badly; light-only reads harshly in a dim room. |
| D6 | **One modal, FORMAT dropdown.** Existing modal renamed "Export Wiki"; format selector at top; subfolder checkbox hidden when HTML is selected. | All existing options apply to both formats, and Release 2's disclosure controls will too. Avoids duplicating ~130 lines of `io_manager.js` wiring and building fog-of-war UI twice. |

### 2.1 Consequence of D3 — subfolders become mandatory

`hex_map.html`'s `obs-use-subfolders` checkbox is currently optional and defaults off.
For HTML it **must** be on, because relative `<a href>` and `<img src>` paths depend on
the folder layout. The checkbox stays optional for Obsidian (Obsidian resolves by name
regardless) and is hidden when HTML is selected. **Two UI states must stay in sync** —
this is the same class of bug as the editor's two edit-gates; see
`project_editor_mgt2e_ct_only` in memory.

---

## 3. Codebase Facts (3.2, 3.3 and 3.4 re-verified 2026-08-06)

Recorded so a cold session does not re-derive them. **3.1 is deliberately historical** —
everything else here was re-read from the source on 2026-08-06, and two of the three had
drifted.

### 3.1 The original split — HISTORICAL, line numbers no longer valid

This is the analysis that justified WP1, recorded against `js/obsidian_exporter.js` as it
stood at 1235 lines **before** the refactor. WP1 has since executed this split, so the
line numbers below are stale by design — kept because the *shape* of the split (what is
format-agnostic vs Markdown-specific) is the reasoning WP2 inherits. For current
structure see section 4.0.

**Format-agnostic, reusable as-is (~500 lines):**

| Component | Lines |
|---|---|
| CRC-32 + ZIP builder | 18-86 |
| Filename helpers (already take an `ext` param) | 98-123 |
| Name/UWP resolvers | 145-160 |
| Raw body finders (`_findMgtRawWorld` etc., per-edition) | 166-258 |
| Image rendering | 1015-1065 |
| Export orchestrator (~95% reusable) | 1069-1228 |

**Markdown-specific, needs a renderer split (~720 lines):**

| Component | Lines |
|---|---|
| `_uwpTable` | 127-141 |
| Twelve edition-aware `_format*` functions | 262-600 |
| Notes + system overview helpers | 604-645 |
| Five page builders (index, hub, star, world, moon) | 649-1011 |

Markdown idioms in use: `**Label:** value` with trailing two-space line breaks,
`[[wikilinks]]` / `![[embeds]]`, pipe tables, YAML frontmatter.

### 3.2 UI wiring (re-verified against the code 2026-08-06)

| Site | What |
|---|---|
| `hex_map.html:50` | `js/disclosure.js` script tag |
| `hex_map.html:51` | `js/disclosure_grid.js` script tag |
| `hex_map.html:85` | `js/export_core.js` script tag — **must precede both exporters** |
| `hex_map.html:86` | `js/obsidian_exporter.js` script tag |
| `hex_map.html:87` | `js/html_exporter.js` script tag |
| `hex_map.html:1059` | menu button `#btn-export-obsidian` — labelled **"Export Wiki"** since 2e |
| `hex_map.html:1622` | modal `#obsidian-export-modal` |
| `hex_map.html:1632` | `#obs-format` — Obsidian / HTML (D6) |
| `hex_map.html:1642` | `#obs-version` — Referee / Players (5e) |
| `hex_map.html:1647` | `#obs-version-warning` — shown for the players' version only |
| `hex_map.html:1705` | `#obs-use-subfolders-row` — hidden when HTML is selected (2.1) |
| `js/io_manager.js:851` | `setupObsidianExport()` — modal wiring, dispatches on format + version |
| `js/io_manager.js:58` | `downloadBlob()`, shared download routine |
| `js/input_init.js:94` | `setupObsidianExport()` called from init |
| `js/input_init.js:101` | `setupDisclosureUI()` called from init |

**Element ids keep their historic `obs-` / `btn-export-obsidian` prefix** even though the
user-visible labels all say "Wiki" now. `io_manager.js` and `hex_map.html` must agree —
do not rename them casually.

### 3.3 Map capture is deterministic — clickable overlay is cheap

**Line numbers re-verified 2026-08-06** (they had drifted ~50 lines as `renderer.js` gained
the WP6 disclosure gate at the top of the file).

`captureSubsector()` at `js/renderer.js:1475` computes its own transform: `baseHexSize`
(1494), `capZoom` (1508), `capCamX`/`capCamY` (1509-1510), and grid bounds `q0/q1/r0/r1`
(1488-1491). It optionally **returns** that transform alongside the PNG
(`opts.withTransform`, WP3), so the exporter computes every hex's polygon in output-pixel
space and lays a transparent SVG overlay over the image. No new coordinate math was needed;
`pixelToHex()` at `js/core.js:225` confirms the math is already shared.

**`capZoom` is computed to fit the subsector and is independent of the GM's live zoom** —
about 1.09. That is what made the WP6 map leak unconditional rather than toggle-dependent;
see 4.6.1.

### 3.4 Where the disclosure machinery lives (added 2026-08-06)

| Site | What |
|---|---|
| `js/export_core.js:550` | `FIELD_LEVELS` — the tag table, executable form of `fog_of_war_field_tags.md` §3.5 |
| `js/export_core.js:577` | `blockLevel()` — per-block `lvl` override (needed for T5's role-labelled lines, 4.5.2) |
| `js/export_core.js:581` | `fieldLevel(context, label)` — keyed on **(context, label)**, not label alone |
| `js/export_core.js:595` | `getUnknownFieldLabels()` — the fail-closed audit trail; the harness asserts it is empty |
| `js/export_core.js:637` | `filterBlocks(blocks, ctx, lvl)` — identity when `lvl` is null/`'g'` |
| `js/export_core.js:414` | `fmtNum(v, maxDp)` — display rounding (4.9) |
| `js/disclosure.js:184-195` | `DisclosureModel` — `LEVELS`, `get`, `set`, `def`, `atLeast`, `isHexDisclosed`, `isSet`, `getRaw`, `clear` |
| `js/renderer.js:23-34` | `_mapDisclosure`, `setMapDisclosure()`, `_mapShow()` — null for every normal call |
| `js/renderer.js:476` | the level-`0` skip at the top of the per-hex draw loop |
| `js/renderer.js:1534-1539` | `captureSubsector` installs and restores the gate in a `try/finally` |

---

## 4. Work Packages

| # | Package | Status | Notes |
|---|---|---|---|
| **WP1** | `js/export_core.js` — extract format-agnostic code; convert `_format*` to structured `{label, value}` records | **DONE 2026-08-01** | 3 slices, 3 full-suite diffs, all 8/8 byte-identical. See 4.0. |
| **WP2** | `js/html_exporter.js` — GM version | **DONE 2026-08-01** | All five slices; 823 lines. See 4.2.3-4.2.7. |
| **WP3** | Clickable subsector map | **DONE 2026-08-01** | SVG overlay, geometry verified to 1e-13 px. See 4.3. **Release 1 complete.** |
| **WP4** | Disclosure data model | **DONE 2026-08-03** | `js/disclosure.js` (new). Save/load needed **no work** — see 4.4. 38/38 in-browser checks. |
| **WP5** | Players' export + leak audit | **DONE 2026-08-03** | All five slices, see 4.5. Guard 8/8 throughout. (Left the map PNG leaking; closed by WP6.) |
| **WP6** | Fogged map rendering | **DONE 2026-08-04** | `draw()` learns per-hex disclosure. See 4.6. **Release 2 complete.** |

WP4 and WP5 deliver a fogged **Obsidian** wiki for free, since the filter sits in the
shared core.

**Post-WP6 work, all Sean's requests, all complete.** These are not a WP7 — they are
separate items that landed after Release 2 was declared complete:

| # | Item | Status | Notes |
|---|---|---|---|
| **4.7** | Body-count leak | **FIXED 2026-08-04** | Sections/files survived below (d) with every field blanked. A real shipped leak. |
| **4.8** | Player Disclosure grid (**D**) | **ADDED 2026-08-04** | `js/disclosure_grid.js` (new). Surfaces "never set", which is the point of the screen. |
| **4.9** | Numeric display rounding | **DONE 2026-08-04** | `ExportCore.fmtNum`. Re-baselined. In-app panels still outstanding — section 9. |
| **4.10** | Context-menu submenu clamping | **FIXED 2026-08-04** | Assign Player Disclosure was unreachable on short windows. Written up 2026-08-06. |
| **4.11** | World-image seed mismatch | **FIXED 2026-08-06** | Exported worlds were different planets from the app's. **Not a fog-of-war bug** — referee exports too. Fourth re-baseline. |
| **4.12** | Bodies took their neighbour's physical stats | **FIXED 2026-08-06** | `orbitId` is not unique; co-orbital bodies mis-paired. MgT2E only, 14 of 688 worlds. Fifth re-baseline. |

### 4.0 WP1 — COMPLETE 2026-08-01

WP1 was done in three verifiable slices, each ending with a full before/after diff
(per [[feedback_incremental_refactor_workflow]] — one item at a time, verify, then move).
Net effect: **zero user-visible change**, `js/obsidian_exporter.js` 1235 -> 954 lines,
and a 433-line shared `js/export_core.js` that WP2 builds on.

| Slice | Scope | Status |
|---|---|---|
| **1** | Extract format-agnostic machinery into `js/export_core.js`; alias it back into `obsidian_exporter.js` under the original private names so no call site changes | **DONE 2026-08-01 — 8/8 byte-identical** |
| **2** | Convert the twelve `_format*` functions to return `{label, value}` records; add a Markdown renderer over them | **DONE 2026-08-01 — 8/8 byte-identical** |
| **3** | Extract shared per-entity content; add table/text block types | **DONE 2026-08-01 — 8/8 byte-identical** |

**Slice 1 detail.** Moved: CRC-32, ZIP builder, `sanitize`/`systemFilename`/
`bodyFilename`, the three display-name helpers, `resolveSystemName`/`resolveUWP`,
`kToC`, all four raw body finders plus `findRawWorld`/`findRawMoon`/`findRawStar`, and
`canRenderImage`/`isAirless`/`renderWorldImage`. `_yamlStr` stayed behind as
Obsidian-specific. `js/obsidian_exporter.js` 1235 -> 985 lines;
`js/export_core.js` 313 lines. Script tag added at `hex_map.html:83`, before the
exporter — load order matters.

Verified: all 8 runs byte-identical by SHA-256 (6879 files, ~108 MB), zero console
errors.

**Slice 2 detail.** All twelve `_format*` functions now return format-neutral blocks
instead of Markdown strings — 160 field records in total. Block model, declared in
`js/obsidian_exporter.js` and moving to `export_core.js` in slice 3:

```
{t:'h', level, text}   heading -> '## text' / '### text', then a blank line
{t:'f', label, value}  field   -> '**label:** value' + two trailing spaces
{t:'f', ..., code}     field   -> value wrapped in backticks
{t:'gap'}                      -> a single blank line
```

**Headings and gaps are separate block types on purpose.** The original code was
inconsistent about whether a blank line preceded a heading — `_formatMgtWorldFields`
pushes `'', '### Orbital Data', ''` while `_formatMgtMoonFields` pushes
`'### Orbital Data', ''` with no leading blank. A renderer that emitted a uniform
leading blank would have broken the diff. The inconsistency is reproduced verbatim and
commented at the site; do not "tidy" it without re-running the diff.

The fifteen call sites are wrapped as `lines.push(..._mdRender(_formatX(...)))`, so the
page builders are otherwise untouched — they are slice 3's job.

`js/obsidian_exporter.js` 985 -> 1022 lines (the block model and renderer add more than
the formatters lose).

A `fast` argument was added to `export_runner.js` to skip the two image-heavy runs
during iteration. **The full 8-run suite is still required before a slice is called
done** — `fast` is for the edit/check loop only.

**Slice 3 detail — SCOPE DELIBERATELY NARROWED, read this before WP2.**

Slice 3 was originally scoped as "convert the five page builders to a renderer-agnostic
shape". That was reduced on inspection, and the reduction is a design finding, not a
shortcut:

Per D2 the HTML exporter has **no per-body pages** — stars, worlds and moons become
anchored sections of a single system page — and it resolves links to same-page anchors
rather than by name. So the page builders' *assembly* (YAML frontmatter, `[[wikilinks]]`,
`![[embeds]]`, per-body file naming, link-bearing tables) has no HTML counterpart to
share. Converting it to blocks would have been busywork that WP2 never calls, while
carrying real diff risk.

What slice 3 **did** extract into `js/export_core.js`, because both formats genuinely
need it:

| Function | Replaces |
|---|---|
| `uwpTableBlocks(uwp)` | `_uwpTable` — now a `tbl` block, not a pre-joined string |
| `notesBlocks(state)` | `_buildNotesSection` (Release 2 leak gate, manifest 5.2.4) |
| `systemOverviewBlocks(state)` | `_buildSystemOverview`, all three edition branches |
| `detailBlocks(body)` | the inline Trade Codes / Travel Zone / Tech Level group, which was duplicated verbatim in the world and moon builders |
| `fallbackPhysicalBlocks(body)` | the inline gravity/diameter/temp fallback, also duplicated |
| `fallbackStarBlocks(star)` | the inline star luminosity/mass fallback |
| `travelZone(body)` | the Red/Amber/Green ternary, duplicated in both builders |

Block model moved to `export_core.js` and gained two types: `{t:'txt'}` (verbatim line)
and `{t:'tbl', headers, rows}`. `_mdRender` stays in `obsidian_exporter.js` — it is the
Markdown renderer; `html_exporter.js` supplies its own.

**Left for WP2, on purpose:** table cells are plain strings, so a cell containing a link
is still format-specific. A neutral link descriptor (system/body/subsector -> path +
anchor) should be designed in WP2 when the HTML anchor scheme is concrete. Designing it
now would be guesswork.

`js/export_core.js` 313 -> 433 lines; `js/obsidian_exporter.js` 1022 -> 954.
Net across WP1: obsidian_exporter 1235 -> 954 lines, with 433 lines of shared core.

**Still outstanding after slices 2 and 3** (unchanged from section 7 caveat): a byte-identical
Markdown diff proves the *renderer* is faithful. It does not prove the records carry
everything the HTML renderer will want — a field the Markdown path never used could be
absent and nothing here would notice. That gets caught in WP2 by field-parity
spot-checks against the Markdown twin.

### 4.2 WP2 — the GM HTML exporter. COMPLETE 2026-08-01.

Sliced the same way WP1 was, for the same reason: small verifiable steps beat one large
change. **After every slice, re-run the Obsidian suite and require 8/8 against the
recorded hashes in 7.1** — WP2 touches `export_core.js`, so a Markdown change is a bug.

| Slice | Scope | Done when |
|---|---|---|
| **2a** | ✅ **DONE 2026-08-01.** `js/html_exporter.js` (677 lines) — HTML renderer, page shell, link descriptors, anchors, stylesheet, orchestrator. Verified on MgT2E. | ✅ all checks passed — see 4.2.3 |
| **2b** | ✅ **DONE 2026-08-01.** All five engines + the stub path verified; parity run over **every** page, not a sample. | ✅ 6/6 clean — see 4.2.4 |
| **2c** | ✅ **DONE 2026-08-01.** Sortable/filterable subsector index, sector index, first real merge test. | ✅ merged-tree sweep 0 broken — see 4.2.5 |
| **2d** | ✅ **DONE 2026-08-01.** Theme verified in both directions on all three page types, persistence, and print actually exercised. | ✅ see 4.2.6 |
| **2e** | ✅ **DONE 2026-08-01.** FORMAT dropdown, subfolder gating, both formats driven end-to-end through the real UI. | ✅ see 4.2.7 |

Then **WP3** (clickable map) which is small — see 3.3.

#### 4.2.1 Target output shape (agreed, D2 + D3)

```
Regina Sector/
  index.html                <- sector index: all 16 subsectors
  style.css                 <- shared, one copy, at sector root
  Subsector C/
    index.html              <- subsector map + sortable system table
    Regina (1910).html      <- ONE page, all bodies as sections
    Efate (1705).html
    images/
      Regina (1910) - orrery.png
      Regina - Prometheus (1910).png
```

A system page carries, in order: metadata block (see section 6), system overview,
then one anchored section per star -> world -> moon, then referee notes.
Anchors: `#star-a`, `#prometheus`, `#prometheus-luna`.

#### 4.2.3 Slice 2a — completed 2026-08-01

**Formatter move done first, while a byte-diff still protected it.** The twelve
`_format*` functions moved from `obsidian_exporter.js` into `export_core.js` and are
aliased back under their original private names, so all fifteen Obsidian call sites are
unchanged. Verified 8/8 byte-identical *before* any new code was written — deliberately
sequenced that way, because once WP2 output exists the diff no longer isolates the cause.
`obsidian_exporter.js` 954 -> 624 lines; `export_core.js` 433 -> 803.

**`js/html_exporter.js`** (677 lines, script tag at `hex_map.html:85`). Contains only what
is HTML-specific: `_render` (the block-model renderer, counterpart to `_mdRender`),
`_esc`, `_slugify`/`_uniqueSlug`, the page shell, link resolution, `STYLE_CSS`, and the
orchestrator.

**Link descriptor — the piece deferred from WP1 slice 3, now designed.**
`linkSystem(name, hex, anchor?)`, `linkSubsector(char)`, `linkSector()` describe *what* is
being linked; `_href(target, from)` resolves to a real relative path, where `from` is
either `'sector'` (sector root) or `'subsector'` (inside a `Subsector X/` folder). Only
those two contexts exist, because D2 gives every body a home on its system page. Paths are
`encodeURIComponent`-ed per segment on top of `export_core`'s filename sanitising.

**Renderer decisions.** `{t:'gap'}` is dropped — blank-line spacing is Markdown's
concern, CSS's job in HTML. Consecutive `{t:'f'}` blocks coalesce into one `<dl>`.
Headings map `h2 -> <h3>`, `h3 -> <h4>`, leaving `<h1>` for the page and `<h2>` for body
sections. Table cells accept `raw(html)` for anchor links.

**Verified per 7.3, all four:**

| Check | Result |
|---|---|
| Link integrity sweep | **271 links, 0 broken** |
| Obsidian regression guard (full 8) | **8/8 byte-identical** |
| Real browser, `file://` | 0 console errors; 47 sections, **0 duplicate ids**, 0 broken images, 46 TOC links all resolving, no horizontal scroll; theme toggle works both directions |
| Field parity vs Markdown twin | **clean** — see below |

**Field parity detail (the check that closes the standing caveat, for MgT2E).** For system
Aoba (2513): 282 Markdown pairs vs 254 HTML pairs. All 29 differences explained and none
are data loss — 9 are wikilink fields HTML replaces with breadcrumbs and anchors
(`System`, `Star`, `Parent World`, `Subsector`, `Sector`, `Mainworld`), and 20 are `UWP`
entries that HTML renders as `<p class="uwp"><code>` rather than a `<dt>`. Verified
separately: **32 UWPs in Markdown, 32 in HTML, identical sets, and 32 UWP breakdown
tables**. The one HTML-only pair is the metadata block's `Mainworld UWP`.

**Also checked, and worth keeping in the harness:** an *orphaned image* sweep. The link
sweep only proves links→files; it cannot see a file generated into the ZIP that no page
references. Result: 115 PNGs, 115 referenced, **0 orphans**.

Harness: `.tmp/html_export_harness/html_check.js`.

#### 4.2.4 Slice 2b — completed 2026-08-01

All five engines plus the UWP-only stub path, via
`.tmp/html_export_harness/html_check_all.js`. **Parity was run over every system page,
not a sample** — a per-engine quirk can easily sit in a system you did not happen to pick.

| Engine | Sub | Files | Links | Images | Pages | md/html pairs | Lost | UWP mismatch |
|---|---|---|---|---|---|---|---|---|
| MgT2E | 18-H | 156 | 266 ✓ | 115, 0 orphan | 38 | 6640 / 5330 | **0** | **0** |
| CT | 1-A | 493 | 619 ✓ | 448, 0 orphan | 42 | — | **0** | **0** |
| T5 | 1-B | 663 | 786 ✓ | 619, 0 orphan | 41 | 5371 / 4168 | **0** | **0** |
| RTT | 1-C | 144 | 279 ✓ | 96, 0 orphan | 45 | 2685 / 2179 | **0** | **0** |
| AoW | 1-D | 454 | 559 ✓ | 416, 0 orphan | 35 | 2810 / 2297 | **0** | **0** |
| stub | 25-H | 44 | 164 ✓ | 1, 0 orphan | 40 | 0 / 0 | **0** | **0** |

Zero console errors anywhere; no duplicate ids, no missing anchors, no horizontal scroll,
no broken images. Obsidian regression guard: **8/8 byte-identical**.

**UWP parity was verified exactly and separately** (it is excluded from the pair
comparison because HTML renders it as `<p class="uwp"><code>` rather than a `<dt>`):
**3294 UWP values across all five engines, 0 mismatched pages.**

##### Three false failures the first run produced — all defects in the *check*

Recorded because each would have been easy to "fix" in the exporter by mistake.

1. **"27 broken images."** Images carry `loading="lazy"`, so below-the-fold ones report
   `naturalWidth === 0` until scrolled into view. The probe measured too early. Fix: force
   `loading="eager"` and await every image before judging. The ZIP contained no missing or
   zero-byte PNGs at any point.
2. **"4 broken links."** The sector index deliberately links **every** subsector that has
   data in the app, not just the exported one — that is exactly what lets separately
   exported ZIPs interlock (D3), and the page says so in plain text. Dead until the other
   ZIP is extracted; expected, not a defect. The check now skips sector-index →
   subsector links.
3. **`Factions = **Judicial Profile:** AT-N-N`.** The Markdown extractor used `\s*`,
   which matches newlines — so a field with an empty value swallowed the following line
   and reported it as that field's value. HTML was correct; the regex was not. Now
   `[ \t]*`.

##### One real (if cosmetic) fix

`Type = BD0 ` carried a trailing space where a brown dwarf has no luminosity class.
Invisible once rendered, but it pollutes the value and any `data-*` attribute built from
it. Now composed with `.trim()` and an `?? ''` guard on `sClass`.

##### Deliberate, documented differences from the Markdown output

- **Navigation fields.** Markdown's `System`, `Star`, `Parent World`, `Subsector`,
  `Sector`, `Mainworld` wikilinks become breadcrumbs and same-page anchors in HTML.
- **Empty values.** Markdown prints an em-dash placeholder for absent data; HTML omits
  the row entirely. Confirmed not to be data loss: the generated CT/T5/RTT/AoW fixtures
  carry no allegiance at all, while MgT2E — where all 38 systems do — shows zero
  unexplained differences. **Revisit for Release 2:** an omitted row and a
  withheld row look identical to a player, which may matter for fog of war.

#### 4.2.5 Slice 2c — completed 2026-08-01

**Subsector index.** Sortable, filterable table via `TABLE_JS` inlined per page — no
fetch, nothing external (D4). Click or keyboard (Enter/Space) on any header sorts and sets
`aria-sort`; a search box filters on the row's full text with a live "N of M" count.

**Columns — decided 2026-08-01 (Q1, now closed).** Hex, System, UWP, Starport, TL,
Trade Codes, GG, Bases, Zone; hex ascending. Gas Giant and Bases were added because they
are the only two operational facts *not* already inside the UWP; Starport and TL are
deliberate UWP duplicates kept for sorting. Changing the set means editing the `COLUMNS`
array in `html_exporter.js` and nothing else.

**Two details worth keeping:**
- **TL sorts on `parseInt(tl, 36)`, not its glyph.** Traveller tech levels run 0-9 then A+,
  so a plain string sort puts 'A' before '9'.
- **Columns with no data anywhere in the subsector are dropped.** CT records no travel
  zone at all, so its index has no Zone column while T5's does. Verified. The column set
  therefore varies by subsector, which honestly reflects the data.

**No-JS fallback verified**, not assumed: with JavaScript disabled the table still renders
all 42 rows in hex order, and the filter/sort controls stay `hidden` — they are revealed by
the script, so a reader without JS is never shown controls that cannot work.

**The merge test — the actual point of D3, and never previously exercised.** Three
subsectors of sector 1 (A/CT, B/T5, C/RTT) exported *separately*, then all three ZIPs
extracted into one folder:

| | |
|---|---|
| Merged tree | 136 files |
| Links checked across the merged tree | **522, 0 broken** |
| Sector index reaches all three | **yes** |
| Files written by more than one export | **no conflict** — `style.css` and the sector index were byte-identical each time |

That last row settles a real design worry: because the sector index lists every subsector
that has data *in the app* rather than only the exported one, it is identical no matter
which export writes it. Extracting a second ZIP therefore cannot flip which links work.

**Two UX problems the automated checks could not see**, both found by looking at a
screenshot and both fixed: the table header scrolled out of view on a 42-row list (now
`position:sticky`, offset below the breadcrumb bar), and the empty Zone column described
above.

Harness: `.tmp/html_export_harness/html_check_merge.js`.
All-engine checks re-run after: 6/6 clean. Obsidian regression guard: **8/8**.
`html_exporter.js` 677 -> 796 lines; `export_core.js` 803 -> 837 (`indexRowData`,
`resolveWorldData`).

#### 4.2.6 Slice 2d — completed 2026-08-01

The stylesheet itself largely landed in 2a/2c. What 2d actually did was **verify the D5
claims that had never been exercised**, and fix what that exposed.

**Theme — 18 assertions, all passing** (`html_check_style.js`):

| | sector index | subsector index | system page |
|---|---|---|---|
| `prefers-color-scheme: dark` → dark | ✓ | ✓ | ✓ |
| `prefers-color-scheme: light` → light | ✓ | ✓ | ✓ |
| toggle flips it | ✓ | ✓ | ✓ |
| choice survives reload (`localStorage`) | ✓ | ✓ | ✓ |
| toggle is reversible | ✓ | ✓ | ✓ |

Dark-as-default had only ever been observed in headless Chromium, which reports a *light*
preference — so "dark by default" was untested until now. It is correct.

**Print — exercised, not assumed.** Under `media: print` all three page types force a
white background and black ink, and hide breadcrumbs, the contents nav and the filter
controls. `thead` is `table-header-group` (headers repeat across pages) and
`section.body` is `break-inside: avoid`. Real PDFs were generated and read.

##### The bug reading the print output found

**"System Overview" printed twice** — once as the section's own `<h2>`, once as an `<h3>`
from `systemOverviewBlocks`. The same duplication affected **"Details"** on every world
and moon section.

Cause: the shared `export_core` block builders open with their own heading, because
Markdown has no sectioning element to carry a title. HTML puts the title on the section's
`<h2>`, so rendering the block's heading too printed it twice. Fixed with
`_stripHeading()` at the three sites that supply their own heading (overview, details,
notes); `notes` also gained a proper `<h2>` for consistency.

**No automated check could have caught this** — ids stay unique, links resolve, and field
parity is unaffected because a heading is not a field. Verified after the fix: 39 pages,
**0 duplicated headings**. That is the second time in WP2 that looking at rendered output
found something every green check had missed (the first was 2c's sticky header and empty
column).

##### Polish applied

- **`color-mix()` fallbacks.** Both uses now declare a plain colour first, so a browser
  without support keeps a solid background instead of falling through to transparent.
  Supported in the test browser — this is insurance for whatever a user opens the export in.
- **Subsector map capped at `78vh`.** At ~900x1000 it pushed the systems table — the
  reason the index page exists — entirely below the fold. The full-size PNG is still in
  `images/`.
- **Keyboard focus ring** (`:focus-visible`) on links, buttons, sortable headers and the
  filter input; the sortable headers are keyboard-operable and previously had no visible
  focus state.

Re-verified after: all-engine 6/6, merge checks passed, Obsidian regression **8/8**.
`html_exporter.js` 796 -> 823 lines.

#### 4.2.7 Slice 2e — completed 2026-08-01. **WP2 COMPLETE.**

**UI changes.** Menu entry relabelled **Export Wiki**; modal heading likewise. A `FORMAT`
dropdown at the top of the modal (`#obs-format`) offers "Obsidian Wiki (Markdown)" or
"HTML Website", with a one-line hint under it. `setupObsidianExport()` in
`js/io_manager.js` dispatches on it. **Element ids keep their historic `obs-` /
`btn-export-obsidian` prefix** — only user-visible labels changed — so this stayed a small
diff; do not rename them casually, `io_manager.js` and `hex_map.html` must agree.

**Subfolder gating (2.1).** `#obs-use-subfolders-row` is hidden when HTML is selected and
restored when switching back, and the option is forced `true` for HTML regardless of the
checkbox — its relative hrefs depend on that layout. Hiding beats leaving a control that
silently does nothing. The dispatch passes an otherwise identical options object to both
exporters, so a future format, and Release 2's disclosure controls, are added once.

**Verified by driving the real UI**, not by calling `startExport` — every earlier check
called the exporter directly, so until now nothing proved a user could reach any of it:

| | |
|---|---|
| Menu button label | "Export Wiki" ✓ |
| Modal opens | ✓ |
| Subfolder row: Obsidian / HTML / back | `flex` / `none` / `flex` ✓ |
| Export button relabels for HTML | "Export HTML ZIP" ✓ |
| Obsidian export via modal | 1193 files, 1192 `.md`, 0 `.html` ✓ |
| HTML export via modal | 42 files, 40 `.html`, 1 `.css`, 0 `.md` ✓ |
| Distinct ZIP names | `..._Wiki.zip` vs `..._HTML.zip` ✓ |
| Progress text / Close button | correct for both ✓ |
| Console errors | 0 |

##### The UI test took three attempts, and each failure was informative

Recorded because anyone writing a UI test here will hit the same wall. The export button
is **three interactions deep**, and faking any of them breaks the test:

1. **Forcing `display` on ancestors** — button ends up *outside the viewport*; every click
   times out.
2. **Clicking the section header first** — the settings panel is translated off-canvas
   (`transform: translateX(422px)`) until `#settings-toggle` (the cog) is clicked.
3. **Opening the panel** — the splash screen still overlays everything and swallows
   clicks until `#btn-launch-app` is pressed.

Correct sequence: `#btn-launch-app` → `#settings-toggle` → the
`.settings-section-header` reading "Import / Export" → `#btn-export-obsidian`.

**Full regression after 2e:** all-engine 6/6, merge checks pass, style/print checks pass,
Obsidian regression guard **8/8 byte-identical**.

Changelog and README updated — WP2 is user-visible, unlike WP1.

#### 4.2.2 What WP2 must reuse rather than reinvent

All of this already exists in `js/export_core.js` and is proven by WP1's diffs:

- `buildZip`, `crc32` — ZIP assembly
- `sanitize`, `systemFilename`, `bodyFilename` (pass `'html'` as `ext`)
- `worldDisplayName`, `moonDisplayName`, `starDisplayName`
- `resolveSystemName`, `resolveUWP`, `travelZone`, `kToC`
- `findRawWorld`, `findRawMoon`, `findRawStar` — per-edition raw lookup
- `canRenderImage`, `isAirless`, `renderWorldImage`
- Block constructors `GAP/h/f/fc/txt/tbl` and the shared content builders
  `uwpTableBlocks`, `notesBlocks`, `detailBlocks`, `systemOverviewBlocks`,
  `fallbackPhysicalBlocks`, `fallbackStarBlocks`

~~**The twelve `_format*` functions are still private to `obsidian_exporter.js`.**~~
**DONE in slice 2a** — moved to `export_core.js` and exported as
`formatMgtWorldFields`, `formatMgtMoonFields`, `formatMgtStarFields`, `formatMgtSocio`,
`formatCtBodyFields`, `formatCtSatFields`, `formatCtStarFields`, `formatT5WorldFields`,
`formatT5SatFields`, `formatT5StarFields`, `formatT5Socio`, `formatRttBodyFields`.

`html_exporter.js` supplies its own renderer, the counterpart to `_mdRender`
(`obsidian_exporter.js`). Do not put HTML rendering in `export_core.js`.

### 4.3 WP3 — clickable subsector map. COMPLETE 2026-08-01. **Release 1 done.**

**`captureSubsector` gained an optional 5th argument.** `opts.withTransform` makes it
resolve `{ png, transform, hexPoly }` instead of bare PNG bytes; without it the old
contract is unchanged, which is why the Obsidian exporter needed no edit at all.

**`hexPoly(q, r)` deliberately lives in `js/renderer.js`, not the exporter.** It reuses
that file's own hex geometry — centre `(1.5·size·q, √3·size·(r + (q&1 ? 0.5 : 0)))`,
vertices at `60°·i` per `getHexPath`, then `(world − cam) × zoom` matching the
`ctx.scale/translate` at renderer.js:73-74. Putting the math beside the drawing code
means the overlay cannot drift away from what was actually drawn; duplicating it in the
exporter would have been a silent-divergence bug waiting to happen.

**The PNG goes INSIDE the `<svg>`, not beside it.** Polygons then share the image's
coordinate system by construction, so alignment survives any scaling — including the
`78vh` cap added in 2d. An absolutely-positioned overlay on a separate `<img>` would have
had to track that cap and re-derive the scale factor.

Hover text is an SVG `<title>` per hotspot, so **tooltips need no JavaScript** (D4).
Only hexes that actually have a page get a hotspot. If the transform is unavailable the
map still renders, just without hotspots — degrade, never omit.

**Verified** (`html_check_map.js`) — alignment was checked independently rather than
trusted, because a polygon over the *wrong* hex looks perfectly fine:

| Check | Result |
|---|---|
| Polygon centroid vs independently recomputed hex centre | **max error 1.14e-13 px** across 80 hexes |
| Polygons in image bounds / plausible size | 80/80, radius 47.3px |
| Polygons vs system pages | 38 = 38, all wrapped in titled links |
| Overlay links resolving | 38/38 |
| DOM hit-test (`elementFromPoint` at each centre) | **38/38 topmost** |
| Clicking a hotspot navigates | ✓ to that system's page |
| Console errors | 0 |

Visually confirmed too: hovering highlights exactly the drawn hex.

**One check gap this exposed.** The orphaned-image sweep matched only `src="..."`, so
moving the map into `<image href="...">` made it report the map as orphaned on all six
engines. The image was correctly referenced throughout — the *check* was blind to SVG.
Now matches both. Worth remembering: a sweep that only knows one reference syntax gives
false confidence in both directions.

**Full regression:** all-engine 6/6, merge, style/print, real-UI all pass; Obsidian
regression guard **8/8 byte-identical** (the new argument is opt-in, so Markdown output
is untouched). `js/html_exporter.js` 830 -> 897 lines.

### 4.4 WP4 — disclosure data model. COMPLETE 2026-08-03.

**`js/disclosure.js`** (new, 155 lines; script tag at `hex_map.html:50`, after
`regions.js`; `setupDisclosureUI()` called from `input_init.js`). Built to mirror
`regions.js` deliberately — same per-hex-field shape, same bulk-assign-over-`selectedHexes`
modal, same `saveHistoryState`/`showToast` bookends — so there is one pattern to learn
rather than two.

**The model is export-agnostic on purpose.** It stores and edits a value and exposes
`DisclosureModel.atLeast(current, required)`; it knows nothing about pages or drawing.
WP5 and WP6 both consume that one primitive.

| Piece | Detail |
|---|---|
| Field | `state.disclosure`, a level id `'0'`–`'g'` |
| Default | **`'g'`** — an absent field means *full* disclosure |
| API | `get`, `set`, `def`, `atLeast`, `isHexDisclosed` on `window.DisclosureModel` |
| UI | ASSIGN → **Assign Player Disclosure**, `#disclosure-assign-modal` |
| Undo | `saveHistoryState('Assign Disclosure')`, verified via a real Ctrl+Z |

**Why the default is `g` and not `0`.** Absent ⇒ full disclosure means every sector saved
before this feature behaves exactly as it did, and a player export can never silently omit
data the GM never chose to hide. The opposite default would have retroactively fogged every
existing map. A GM who wants everything hidden selects the sector and assigns *Unknown*
once — two clicks — so the convenience is symmetrical while the risk is not.

`get()` also normalises: an absent, unknown, or hand-edited-to-garbage value reads as `g`
rather than throwing or returning `undefined`.

#### Save/load needed no work at all

`io_manager.js:121` serialises each hex state **verbatim** (`hexObj[key] = value`), and the
load path at 620-621 does the same in reverse; the chunked save at 193 stores
`[hexId, state]` pairs unchanged. **A new field on the state object therefore persists for
free** — no schema, no migration, no version bump. Verified by round-tripping through the
real serialisation shape rather than assumed. The WP table's "save/load in `io_manager.js`"
was a prediction that turned out to be unnecessary; `io_manager.js` was not modified.

#### Verification — `.tmp/html_export_harness/disclosure_check.js`, 38/38

In-browser per 7.2, not `node --check`. Drives the **real** right-click → hover ASSIGN →
menu item → level button path; the only thing faked is the hex *selection*, because
selection mechanics are pre-existing and `regions.js` reads the same global.

Covers: API shape and ladder order; `atLeast` cumulative, blocking, and rejecting bad
input; absent/corrupt/unknown-hex normalisation; the real UI path end to end; unselected
hexes untouched; mixed-selection reporting; cancel; save→load round trip; a real Ctrl+Z
undo labelled `Assign Disclosure`; zero console errors; and modal layout geometry.

**Obsidian regression guard: 6/6 byte-identical** against `baseline_fmt_summary.json`
(fast set). `hex_map.html` changed, `export_core.js` did not.

##### The bug the screenshot found — fifth time, same lesson

All 36 checks passed while the modal rendered as a **ragged staircase**: the grid rule at
`hex_map.html:720` names `#border-assign-grid, #region-assign-grid` only, so
`#disclosure-assign-grid` fell back to shrink-to-fit and every button sized to its own
label. Computed styles, ids, links and behaviour were all correct — nothing automated could
see it.

Fixed with a dedicated 2-column rule (the ladder's labels are full phrases, and 8 rungs
4-up would wrap mid-label; it also cut the modal from 696px to 492px tall, clearing the
bottom of a 720px viewport). **New assertion added: all level buttons must share one
distinct width.** That is the check that catches this class of bug.

This is the fifth time in this work that looking at rendered output found what green checks
missed — 2c's scrolled-away header and empty column, 2d's duplicated heading, HX-9's sticky
row, now this. **The standing rule in 0.3 holds; do not skip the screenshot.**

##### One methodology note worth keeping

The first baseline comparison script reported "1 match, 0 differ" and was **wrong** — it
keyed on `r.name` where the summary uses `r.id`, so every lookup collapsed to `undefined`
and one bogus row compared clean. A passing result from a check you just wrote is not
evidence until you have confirmed the check is looking at the right thing. Same lesson as
`project_ct_gas_giant_size_editor` and `project_ct_uwp_seed_size_codes` in memory.

### 4.5 WP5 — players' export. COMPLETE 2026-08-03 (all five slices).

Sliced like WP1/WP2, for the same reason: small verifiable steps, and **every slice ends
with the Obsidian guard at 6/6/8/8**.

| Slice | Scope | Status |
|---|---|---|
| **5a** | Field disclosure tag table + `filterBlocks()` in `export_core.js` | ✅ **DONE 2026-08-03** — 24/24, guard 6/6 |
| **5b** | Wire the filter into both exporters; suppress notes, sections and level-0 systems | ✅ **DONE 2026-08-03** — 40/40 leak check, guard 6/6, all-engine 6/6 |
| **5c** | Generic body/star/system labels; filenames follow the disclosed name | ✅ **DONE 2026-08-03** — 54/54 leak check, guard 6/6 |
| **5d** | Image gating + orrery re-render | ✅ **DONE 2026-08-03** — 67/67 leak check, guard **8/8** (full run) |
| **5e** | Export-modal UI (Referee vs Players' version) | ✅ **DONE 2026-08-03** — 17/17 real-UI check, guard **8/8** |

#### 4.5.1 Slice 5a — the tag table

`export_core.js` gained `FIELD_LEVELS`, `fieldLevel`, `blockLevel`, `filterBlocks`,
`getUnknownFieldLabels`. It is the executable form of
`directives/fog_of_war_field_tags.md` §3.5 — **that file stays the authority; do not change
a level in one without the other.**

**Tagging is keyed on (context, label), not label alone.** This is not defensive
over-engineering — three labels genuinely collide:

| Label | star | world |
|---|---|---|
| `Mass` | **b** | **e** |
| `Eccentricity` | **b** | **d** |
| `Orbit ID` | **b** | **d** |

A flat label map would have leaked stellar data at world level or hidden world data that
should show. Seven contexts: `star`, `world` (belt and gas-giant labels fold in here, being
unique), `moon` (= world + the one moon-only field), `socio`, `system`, `details`,
`identity`.

**Fail-closed.** An untagged field returns `'g'`, so a field added later can never leak
into a low-level players' export. Because that failure is silent, every omission is
recorded in `getUnknownFieldLabels()` and the harness asserts the set is empty.

**GM path is identity.** `filterBlocks(blocks, ctx, 'g'|null)` returns the *same array
object* — no copy, no allocation, no behaviour change. That is what keeps the guard at 6/6.

#### 4.5.2 Two gaps closed before writing, one found by the sweep

- **`Rings` (RTT)** matched none of the eight groups — not classification, geology,
  atmosphere or development. Raised with Sean, assigned **(d)** with body classification
  (a ring system is remotely observable).
- **`Orbit (⌀)`** is moon-only with no world counterpart to inherit from. §5 requires such
  fields to be *flagged, not defaulted*, so it was raised rather than silently assigned:
  **(d)**, Group 1.
- **T5 role labels — found by the completeness sweep, not by reading the code.** The T5
  branch of `systemOverviewBlocks` emits `f(s.role, …)`, so the *label is data*:
  `Primary`, `Close`, `Far`, `Near`, `Primary Companion`, `Close Companion`,
  `Far Companion`, `Near Companion`. No static map can enumerate that, and all eight were
  failing closed to `'g'` — i.e. every T5 star line would have vanished from a players'
  export at every level below full. Fixed with an optional per-block `lvl` override
  (`blockLevel()`), set to `'b'` at that site. **Adding a property to the block does not
  change either renderer's output — guard still 6/6.**

  That site also carries the star's *name* in its value, which is (d) data. Filtering
  cannot fix that; slice 5c must substitute a generic label. Comment left at the site.

#### 4.5.3 The check, and the bug in the check

`.tmp/html_export_harness/disclosure_tags_check.js` — 24 assertions covering ladder
plumbing, context sensitivity, fail-closed behaviour, `filterBlocks` semantics (including
that an `h2` whose content sits under an `h3` is not wrongly pruned), and completeness.

**The first version of the completeness sweep was worthless and looked fine.** It used
`ExportCore.resolveWorldData(state, hexId)` expecting a normalised system; that function
actually returns the mainworld UWP object (`export_core.js:160`), so `wd.worlds` was always
`undefined` and the sweep reported **0 bodies, 0 moons** while asserting completeness —
i.e. the world and moon contexts, which carry most of the 111 labels, were never exercised.
Fixed to use `SystemViewer.normalizeSystem` (what the exporters themselves use,
`html_exporter.js:841`); coverage went to **1979 bodies and 2620 moons across 279 systems,
356 stars**. The assertion now requires non-zero counts in every category, so this cannot
recur silently.

Third methodology incident of this work — after the `r.name`/`r.id` baseline comparison in
4.4 — of a check that passes while measuring nothing. Same lesson as
`project_ct_gas_giant_size_editor` in memory: **confirm the check is looking at the right
thing before trusting a pass.**

#### 4.5.4 Slice 5b — wiring the filter in. COMPLETE 2026-08-03.

Both exporters gained the same four-piece shim, deliberately identical so there is one
pattern rather than two:

```
let _playerMode = false;                  // set from options.playerVersion
_levelFor(hexId)  -> null on the GM path, else DisclosureModel.get(hexId)
_F(blocks, ctx, lvl)                      // ExportCore.filterBlocks
_show(lvl, required)                      // for content gated as a unit
_notesFor(state)                          // [] in player mode
```

**The GM path is the identity function.** `playerVersion` absent/false ⇒ `_levelFor()`
returns null ⇒ `filterBlocks` returns *the same array object*. That is what keeps the
Obsidian guard at 6/6 and the all-engine HTML checks at 6/6.

**Level (0) systems are dropped in `startExport`**, before any page or index row exists —
not filtered afterwards. A file named `Regina (1910).html` proves Regina exists whatever
the page says (5.2.2). An all-(0) subsector returns an explicit "No systems in this
subsector are disclosed to players" rather than the generic empty-subsector error.

**Referee notes: the section AND its contents-nav link.** Gating the section alone left
`<li><a href="#notes">Referee Notes</a></li>` in the table of contents, which tells a
player notes exist. Found by the leak check.

##### Four leaks that were NOT block-model output

`filterBlocks` only sees blocks. These four emit HTML directly and every one of them
carried gated data:

| Site | Leaked | Now |
|---|---|---|
| Star `Role`/`Type` `<dl>` | spectral type at level (a) | gated to (b) |
| Orbiting-bodies table | body names (d) + **UWP (g)** | table gated (d), UWP column (g) |
| Page metadata `<dl class="meta">` | **Mainworld UWP** on every page | UWP gated (g) |
| Root `data-*` attributes | **`data-uwp` with the full UWP** | UWP gated (g) |
| Map hotspot SVG `<title>` | `Name (hex) — UWP` on every hotspot | name (d), UWP (g) |

The last two are the ones worth remembering: `data-uwp` is the §6 frontmatter-replacement
convention, and the tooltip is SVG `<title>` text. **Neither appears in any rendered body
copy**, so a DOM sweep or a field-parity check would have walked straight past both. They
were caught only because the leak check searches **raw ZIP bytes** — pages, filenames and
attributes together. Keep it that way.

##### The check: `.tmp/html_export_harness/disclosure_leak_check.js`, 40/40

Exports the same subsector at every level 0–g and asserts forbidden strings are absent and
permitted ones present, including monotonic growth a→g. Index columns are gated **per
cell**, not per table, because rows in one subsector can sit at different levels; the
pre-existing "drop columns with no data" pass then removes wholly-withheld columns with no
new machinery. Corsair bases are stripped from the index at every level (§7.13).

**Three of the first run's four failures were defects in the CHECK, not the code** —
recorded because each looked exactly like a leak:

1. *"Socioeconomics absent below g"* failed at c–f. **Correct behaviour**: the T5 socio
   block legitimately carries Belts (d), Gas Giants (c) and Worlds (d), the three
   documented system-inventory exceptions, so its heading rightly survives. The assertion
   now targets real socio *fields* (`Government Profile`, `Cultural Quirks`,
   `World Trade Number`) and separately asserts the exceptions are **not** over-filtered.
2. *"Hydrographics present at e"* failed because that label appears **zero times even in
   the GM export** of this subsector. The paired "absent below e" was therefore passing
   while proving nothing. Now every such pair is preceded by a **GM-control assertion**
   that the label exists at all — a vacuous test must fail loudly.
3. *"Index has no System-name column at b"* failed because `/<th[^>]*>System/` also matches
   the **sector** index's `<th>Systems</th>` count column. Now anchored with a trailing `<`.

That is the fourth, fifth and sixth time in this work that a check passed or failed while
measuring the wrong thing. **A red result is not evidence either** — confirm what the
check is actually looking at before changing code.

##### Known and deliberate at the time: the map PNG still leaked. **Closed by WP6 (4.6).**

`disclosure_leak_check.js` searches `.html`/`.css` and filenames. As WP5 closed, the
**subsector map image was still the live `draw()` output**, carrying UWP strings, trade
codes, starport class and zone rings as pixels (5.2.1) — so a players' export was not
leak-free, and the export modal said so.

**Resolved by WP6 (4.6), 2026-08-04.** Two corrections to the paragraph as originally
written: the leak was **not** nondeterministic — see 4.6.1, the labels gate only on
`zoom > 0.4` and `captureSubsector` sets its own zoom — and the leak check now compares the
map PNG's **bytes** across levels, so it no longer stops at `.html`/`.css`/filenames.

#### 4.5.5 Slice 5c — names and filenames. COMPLETE 2026-08-03.

Four helpers in `export_core.js` gained an **optional trailing `lvl`**; null/absent is the
GM path and behaves exactly as before.

| Helper | Name disclosed at | Falls back to |
|---|---|---|
| `worldDisplayName` | **g** (HX-2) | `World 3` / `Giant 1` / `Belt 2` |
| `moonDisplayName` | **g** (HX-2) | `Moon 4` |
| `starDisplayName` | **d** (§3.11a) | `Star A` / `Star` |
| `resolveSystemName` | **d** (§1.1) | `System 1910` |

**The fallbacks are the labels the exporter already used for genuinely unnamed bodies.**
That is deliberate: a player cannot distinguish a withheld name from a body that never had
one, which is the "withheld = absent" rule applied to names.

`starDisplayName` deliberately does **not** use the star's role in its generic form, even
though role is (b) data — stars are visible from (a), so a role-based label would leak role
one level early. A fixed vocabulary avoids a label whose wording shifts with the level.

##### Filenames are NOT gated separately — and that was a real design correction

The first attempt gave `systemFilename` and `bodyFilename` their own `lvl` parameter,
emitting `1910.md` below (d). **That would have broken every wikilink in the Obsidian
export**: Obsidian resolves `[[Name]]` by name, so the link text and the filename stem must
be the same string, and the links were still being built from `[[Regina (1910)]]`.

The fix was to remove the gate from the filename helpers entirely and gate **the name
instead**. Callers already pass the disclosed name, so filenames, wikilinks, hrefs and
headings all derive from one string and cannot drift apart. `indexRowData` gained an
optional `lvl` for the same reason, and the HTML index keeps the disclosed name on
`d.__pageName` for link building *before* the column gate blanks the display cell.

**One gate, at the name.** Anything that names a file or a link must read from it.

##### The leak the SCREENSHOT found — mainworld identification

54 text assertions passed while the rendered contents list read **"World 2  Mainworld"**.
Mainworld identification is **(g)** (§1.10), and it reached the page three ways, none of
them a field:

- `w.type` — `SystemViewer.normalizeSystem` overwrites a mainworld's real type with the
  literal string `'Mainworld'` (`system_viewer.js:265`)
- `<p class="tag">Mainworld</p>`
- the section's `mainworld` CSS class, which the stylesheet highlights

**The type annotation is now dropped wholesale below (g), for every body — not just the
mainworld.** Blanking only that row would single it out just as effectively, and the real
type is unrecoverable without guessing. Little is lost: `worldDisplayName` already encodes
the category as `World N` / `Giant N` / `Belt N`.

Obsidian needed the same treatment in three places: both world tables' Type column, the
hub's `**Mainworld:**` pointer line, and the world file's `type: mainworld` frontmatter.

**The first fix was incomplete** and the check caught it: the star section's
orbiting-bodies table has its own Type column, which still read `Mainworld`. Gating one
site is not gating the concept.

##### Check additions

`disclosure_leak_check.js` 40 → **54 assertions**: every real system and body name in the
subsector is now collected from the app and searched for across pages *and* filenames, plus
mainworld/CSS-class assertions and a **link-integrity sweep at four levels** — the specific
risk 5c introduces, since filenames now derive from disclosed names.

One more check defect worth recording: the body-name assertion initially failed at d/e/f.
**It was correct behaviour** — a mainworld normally shares its system's name, and the
system name is legitimately disclosed at (d). §1.10b already covers this: the export says
*a* world is called Regina but never *which*. The check now excludes body names that match
a system name. Also, collecting names from `state.name` found only **1** system in the
fixture; it uses `ExportCore.resolveSystemName` and finds **38**.

`player_page_shot.js` renders a real player page to PNG — keep using it, per 0.3.

#### 4.5.6 Slice 5d — images and the orrery re-render. COMPLETE 2026-08-03.

| Surface | Gate | Notes |
|---|---|---|
| World images | **(e)** | A rendered planet *is* a picture of its hydrographics and atmosphere — both (e). Gated regardless of the "include world images" checkbox |
| Orrery images | **(d)** | One glance gives world count, belts and gas giants |
| Orrery labels | re-rendered | Below (g) the body names are absent and the mainworld highlight is off |
| Image filenames | (from 5c) | Derived from the disclosed name, so no separate gate |

##### `SystemViewer.renderSnapshot` gained an optional 4th argument

`renderSnapshot(state, w, h, { level })`. Absent = GM, unchanged — which is why the
**full 8-run guard, including both image-heavy runs, is still byte-identical**.

The orrery is the one leak no downstream filter can touch: **body names are drawn as
pixels**. A players' export cannot reuse the GM image, it has to be drawn again. The
existing `_hideMainworldHighlight` module flag turned out to be exactly what mainworld
suppression needed.

**Policy stays in the exporter; mechanics stay in the viewer** — the same split that put
`hexPoly()` in `renderer.js` for WP3. `renderSnapshot` copies the normalised system rather
than mutating it, because that object can share references with the live `hexState` and
must never alter the GM's own data.

##### One level, not two booleans — found by looking at the PNG

The first version took `{ genericNames, hideMainworld }`, both driven off `< (g)`. Every
assertion passed. But the rendered image drew **"Star A" at levels (d)–(f) while the page
said "K0 V A"** — star names are (d), so the image was over-restricted and the two
disagreed. Not a leak, but wrong.

Replaced with a single `{ level }`, which `renderSnapshot` feeds straight into ExportCore's
display-name helpers. Those already encode the per-entity rules (worlds and moons (g),
stars (d)), so **the image and the page cannot diverge by construction**. Verified by eye:
at (d) the star label is the real `W D`, the world name is gone, the highlight is gone.

That is the **seventh** time in this work that looking at rendered output found what green
checks missed. It is also the second time the fix was to delete a parameter rather than add
one.

##### Check additions — `disclosure_leak_check.js` 54 → **67**

Image assertions need their own runs (everything before them runs with images off).
Covers: no orrery below (d), present from (d); no world image below (e), present from (e);
image filenames carry no real body name; **no page references a withheld image** (a broken
`<img>` would itself advertise the removal); and the two that matter most —

- the orrery at **(d) differs in bytes** from the GM render, proving the re-render actually
  ran rather than the gate silently reusing the cached image;
- the orrery at **(g) matches the GM render byte-for-byte**, proving the re-render path is
  a no-op at full disclosure.

A byte difference alone does not prove the labels are generic, so `player_page_shot.js` is
joined by a manual orrery comparison — keep looking at the images.

#### 4.5.7 Slice 5e — the UI. COMPLETE 2026-08-03. **WP5 COMPLETE.**

A **VERSION** dropdown in the existing Export Wiki modal (`#obs-version`), directly under
FORMAT: *Referee — everything* (default) or *Players — fog of war*. It applies to **both
formats**, because the filter lives in `export_core` — the Obsidian wiki gets fog of war
for free, exactly as 4.1 predicted.

Per D6 this reuses the one modal rather than building a second. Element ids keep the
historic `obs-` prefix; `io_manager.js` and `hex_map.html` must agree, so do not rename
them casually.

**Three places say which version you are holding**, because sharing the wrong ZIP cannot
be undone:

| | Referee | Players |
|---|---|---|
| Export button | `Export ZIP` | `Export ZIP (Players)` |
| ZIP filename | `..._Wiki.zip` | `..._Wiki_PLAYERS.zip` |
| Completion text | `Done — N files exported.` | `… PLAYERS' VERSION — check the map image before sharing.` |

**The amber warning is deliberate and load-bearing.** It appears only for the players'
version and states plainly that **the subsector map image is not yet filtered and still
shows full UWPs**, with the workaround (turn map display options off before exporting, or
delete the image from the ZIP). Until WP6 lands this is the honest description of what the
feature does. **Do not soften or remove it before WP6.** It also names where the level is
set, since the export modal is where a GM will first wonder.

##### Verification — `disclosure_ui_check.js`, 17/17

Driven through the **real** UI: splash → cog → "Import / Export" → Export Wiki → the
dropdowns → the export button. Every earlier disclosure check called `startExport()`
directly, so until this one nothing proved a user could reach the feature at all.

Uses a **deliberately heterogeneous** subsector — hexes cycled through levels 0/b/d/g —
rather than a uniform one, since a real map is mixed and per-hex resolution is the whole
point. Asserts the warning shows and hides in step with the dropdown (two UI states that
must stay in sync — the same class of bug as 2.1's subfolder row), that both ZIP names are
distinct, that no Referee Notes survive, and that **exactly** the level-0 systems produced
no page: 27 pages = 38 exportable − 11 hidden.

One more check defect: that last assertion first read "27 pages, 20 hidden" and failed. The
level loop stamps **every** 18-H hex including empty ones, so counting level-0 *hexes*
massively overstates the pages suppressed. It now counts exportable hexes using the same
filter `startExport` uses. Eighth instance in this work of a check measuring the wrong
thing.

##### WP5 closed with one honest caveat — since resolved by WP6

All five slices done; the Obsidian guard is **8/8 byte-identical** at every step, so the
GM export is provably unchanged. But at that point **`draw()` still rendered the subsector
map with full UWPs, trade codes and starport classes**, and the players' export embedded
it. The UI said so, in amber. WP6 was therefore not optional polish — it was the last real
leak, and it landed the next day (4.6). **The amber warning has been rewritten** (4.6.3);
do not reinstate it.

### 4.6 WP6 — the fogged map. COMPLETE 2026-08-04. **RELEASE 2 COMPLETE.**

The last real leak. `captureSubsector()` produces the map by calling the live `draw()`, so
a players' export shipped a picture of every UWP, trade code and starport class in the
subsector — **as pixels**, which no text filter, parity check or DOM sweep can reach.

**`renderer.js` gained a per-hex gate**: `setMapDisclosure(fn)` where `fn(hexId)` returns a
level, plus `_mapShow(hexId, required)`. `_mapDisclosure` is null for every normal call, so
the on-screen map and the referee export are untouched — every gate short-circuits to true.
`captureSubsector` installs it **for one frame inside a `try/finally`**, so a throw
mid-draw can never leave the live map fogged.

| Element | Level | Site |
|---|---|---|
| whole hex (skip entirely) | **0** | top of the per-hex loop |
| dot, travel-zone ring, allegiance colour | **a** | ungated |
| gas giant marker | **c** | presentation view |
| system name | **d** | presentation + dev view |
| UWP, trade codes, socio strings | **g** | presentation + dev view |
| starport class | **g** | presentation + dev view |
| naval / scout base | **g** | presentation view |

Corsair bases are never drawn by this renderer at all, so §7.13 needs nothing here.

**The development view is gated too.** `devView` is a user toggle and `captureSubsector`
inherits whatever it is set to; leaving that branch open would have made the leak depend on
a checkbox rather than on the disclosure level. This also corrects the claim in 5.2.1 —
see below.

#### 4.6.1 Correction to §5.2.1: the leak was NOT toggle-dependent

5.2.1 said the export "inherits whatever display toggles the GM had switched on, so the
leak is nondeterministic." **That was wrong about the part that mattered.** Verified
2026-08-04:

- The name/UWP/trade-code/starport labels are gated only on `zoom > 0.4`
  (`renderer.js:904` in the dev branch; the presentation branch draws them unconditionally).
- `captureSubsector` computes its own `capZoom` to fit the subsector
  (`renderer.js:1462`) — about **1.09**, independent of the GM's live zoom.

So the core leak was **unconditional and deterministic**, not toggle-dependent. Some *other*
elements (borders, region names, print mode, `rttShowIndustry`) do follow toggles, but not
the ones carrying the data. **There was never a "turn the labels off" setting** — Visual
Options has no such control. Any interim advice to that effect was incorrect; the only
manual remedy would have been deleting the map from the ZIP, which is why WP6 was done
rather than shipped around.

#### 4.6.2 Verification

`disclosure_leak_check.js` 67 → **77**. The map is a PNG, so the assertions mirror the
orrery's: it must **differ in bytes** from the GM render at every level below (g), **match
byte-for-byte** at (g), be **never omitted**, and grow monotonically (b ≤ d ≤ g). Measured:
236,882 → 289,274 → 336,577 bytes.

Confirmed by eye on a **deliberately mixed** subsector (levels cycled 0/a/c/d/g), which
shows the whole ladder in one image: level-0 hexes absent entirely, (a) a bare dot with its
travel-zone ring, (c) gaining a gas-giant marker, (d) gaining the name, (g) full detail.
That image is the clearest single artefact of what Release 2 does — regenerate it if the
map rendering is ever touched.

**Obsidian guard 8/8 byte-identical**, both image-heavy runs included; WP3 map geometry
checks pass; all-engine 6/6; UI 17/17.

#### 4.6.3 The export-modal note was rewritten

It previously warned that the map was unfiltered and told the user to delete it. That is no
longer true and would now be actively misleading. It states plainly that the map and
orreries are drawn at their own disclosure level, and suggests a look over the result —
which is advice, not a workaround.

### 4.7 Body-count leak — FIXED 2026-08-04. Reported by Sean.

**A players' export at (a) still carried one section per body.** Every field was filtered
out, but the section, its heading, its contents entry and its anchor all remained. Measured
on one fixture system at level (a): **45 body sections — 7 gas giants and 36 moons.** So a
player learned the number, the ordering and the *type* of every body in the system. In
Obsidian it was worse: one `.md` **per body**, so the file listing alone disclosed the same
thing even with every page blank.

Body count is **(d)**. This was a straight miss on my part — 5.2.2 had specified it in
plain words ("pages and sections must **not be generated**, not merely blanked") and slice
5b implemented only the page half, not the section half.

**Emptying a container is not withholding it.** That is the general lesson; the field
filter was never going to catch this because the leak is in the *structure*, not the values.

#### What changed

- **No body sections below (d)** — HTML: no contents entries, no `<section>`s, no anchors.
  Obsidian: no per-body `.md` files at all, and no rows in the hub or star-page tables
  (a row count *is* a body count).
- **Gas giant presence at (c)** is now a single `Gas Giants: Present` line, no number, no
  sections. It drops away at (d) where the bodies themselves appear. Reads the same boolean
  the map marker and the index column use, so the three cannot disagree.
- **`Gas Giants` socio field retagged (c) → (d).** It is a COUNT, and the ladder grants
  only presence at (c) — an inconsistency in my own 5a tagging that this exposed.

#### Two more leaks the Obsidian-specific check then found

Writing `disclosure_obsidian_check.js` (this exporter had never had its own check — every
other one drives the HTML side) immediately turned up two more, both in hand-written output
that `filterBlocks` cannot see:

1. **`**Role:**` and `**Type:**` on star pages** — star pages exist from (a), spectral type
   is (b), so a level-(a) export published every star's spectral class. Exact twin of the
   HTML star `<dl>` fixed in 4.5.4.
2. **YAML frontmatter** — `spectralType`, `luminosityClass`, `role` on stars; `uwp`,
   `starport`, `tl`, `tradeCodes` on worlds and moons. **This is the Obsidian counterpart
   of the `data-uwp` leak**: machine-readable metadata that appears in no rendered text, so
   no body-copy assertion would ever notice it.

That both formats had the same two classes of leak, found months apart, says the pattern is
the thing to watch: **whenever output is assembled by hand rather than through the block
model, it bypasses the filter entirely.** Grep for template literals building output when
auditing a new surface.

#### Verification

`disclosure_leak_check.js` 77 → **85** (no body named or listed at a/b/c; bodies present at
d; presence line at c only; no GG count at c). New **`disclosure_obsidian_check.js`, 22
assertions**, covering per-body files, frontmatter and the star header at four levels.

Obsidian guard **8/8 byte-identical**; all-engine 6/6; tags 24/24 (one assertion updated —
it required the old `Gas Giants: c`); model 38/38; UI 17/17; context menu 53/53.

### 4.8 Player Disclosure grid — ADDED 2026-08-04. Sean's request.

There was no way to see what each system was set to; the only view was the assign modal,
one selection at a time. **`js/disclosure_grid.js`** (new) is a status-and-edit window:
systems down the left, one radio per level across, live counts per column, sortable by hex,
name or level, with a search box and a bulk "set all shown" action. Shortcut **D**;
also under MANAGERS in the right-click menu.

**Radios, not checkboxes.** Sean proposed checkboxes; a system has exactly one level, so
checkboxes could express "two levels" or "none" — states the model cannot hold. Radios keep
the same visual scan and one-click editing while making an invalid state unrepresentable.

#### 4.8.1 "Never set" is the point of the screen

The default is **full disclosure**, so a system nobody has reviewed exports *everything*.
The most useful number is therefore not the distribution but **how many systems have never
been touched** — and until now an untouched system and one deliberately set to Full UWP
were indistinguishable, both reading `'g'`.

`js/disclosure.js` gained `isSet()`, `getRaw()` and `clear()`. **`get()`'s contract is
deliberately unchanged** — absent or corrupt still reads `'g'` — because every exporter
depends on it. The new state is purely additive and changes no export output. That is why
the 38 pre-existing model assertions passed untouched, and the Obsidian guard stayed 8/8.

#### 4.8.2 Kept out of the existing files, on request

Sean asked that this not bloat `hex_map.html` or the working modules. The module owns its
own markup (built at runtime), its own stylesheet (injected once, namespaced under
`#disclosure-grid-window`), its own `keydown` listener, and self-initialises. Outside it:

- **`hex_map.html`** — two lines: a `<script>` tag and one MANAGERS menu entry.
- **`js/disclosure.js`** — the additive functions above.

Nothing else changed. `keyboard_shortcuts.js` and `input_init.js` were not touched at all;
the typing guard from `keyboard_shortcuts.js:8` is **duplicated on purpose** rather than
edited in — a few repeated lines are cheaper than a change to a working file.

Free shortcut letters were checked first: F, R, B, G, A and 1-9 were taken. (`A` still
calls `toggleAllegianceWindow`, removed in 2026-05 — likely dead, not touched here.)

#### 4.8.3 The bug the screenshot found

24 assertions passed while the window opened on **the wrong subsector**. `_defaultScope()`
re-derived scope on every open and fell back to "first sector with data" whenever
`selectedHexes` was empty — which it normally is, since assigning clears the selection. On
a Universe import that means it always opened on sector 1, never where the referee was
working. A stale search filter also survived, so it could open looking empty for no visible
reason.

Fixed by remembering the last scope between openings and clearing the filter on open. Both
now asserted. **Eighth time in this feature that looking at the render found what the
assertions could not** — the checks were all measuring the window's internals, and none of
them asked "is this the subsector I asked for".

#### 4.8.4 Verification

`.tmp/html_export_harness/disclosure_grid_check.js`, **27 assertions**: the additive model
(never-set vs explicit `g` vs corrupt vs cleared, with `get()` unchanged throughout), the
real **D** shortcut, nine radios per row sharing one group, the warning text naming the
actual risk, a real radio click writing to `hexStates` and **Ctrl+Z reverting it**, counts
tracking edits without a rebuild, bulk apply, the search filter, Escape, the typing guard,
and scope memory.

Full regression: Obsidian guard **8/8 byte-identical**; model 38/38, leak 85/85, Obsidian
22/22, tags 24/24, UI 17/17, context menu 53/53.

### 4.9 Numeric display rounding — 2026-08-04. Sean's request.

AoW stores raw floats and the formatters interpolated them directly, so an export read
`5.980074992877245 M⊕` and `3.1104000000000003 AU` — the latter a float artifact of 3.1104.

**`ExportCore.fmtNum(v, maxDp = 2)`** now formats every numeric field at render time.
`f()` applies it automatically to any value passed as a **number**, which covered ~40 call
sites without touching them; the ~58 sites that build a template string with a unit
(`` `${x} AU` ``) were wrapped individually.

#### 4.9.1 The rule is significant figures, not decimal places

Sean's ask was "never more than two decimal places". Taken literally that **corrupts data**:
eccentricity `0.0043`, a small moon at `0.0032 M⊕` and a trace atmosphere at `0.004 bar`
all render `0.00`. The agreed rule is therefore **at most two decimals, but always at least
two significant figures** — below 0.1, `toPrecision(2)` takes over.

```
5.980074992877245        -> 5.98
3.1104000000000003       -> 3.11
0.13999999999999999      -> 0.14
0.0131                   -> 0.013
0.0000040901847192818184 -> 0.0000041
7                        -> 7        (integers gain no ".00")
```

**Both thresholds were wrong before the data corrected them**, and each was caught only by
diffing real values:

1. The first version applied the fallback **only when a value rounded to exactly zero** —
   narrower than what had been agreed. Result: `0.0072`, `0.0089` and `0.0096 M⊕`, three
   different moons, all rendered `0.01`.
2. The second used a 0.01 threshold, matching the agreed wording. But two decimals cannot
   carry two significant figures until 0.1, so **454 values in the 0.01–0.099 band were
   distorted by more than 5%** — worst case `0.0131 -> 0.01`, a 23.7% error. Raised with
   Sean, who chose to extend the rule to 0.1.

#### 4.9.2 Engine values are untouched — deliberately

~570 of the codebase's 695 `toFixed` calls live inside engines. **None were touched.**
Rounding at generation would change generated worlds, invalidate the frozen fixture and
stray into rules territory. This is display-time only, so it is fully reversible and cannot
alter a saved sector.

#### 4.9.3 Verification — a field diff replaces the byte guard

The byte-identical guard cannot protect a change whose whole purpose is to change output,
so `.tmp/html_export_harness/fieldvals.js` was written to replace it: it captures every
`**Label:** value` pair from a GM export across all five engines and diffs before/after.

| | |
|---|---|
| Field values compared | **67,052** across MgT2E, CT, T5, RTT, AoW |
| Changed | 3,677 (5.5%) |
| **Values collapsed to zero** | **0** |
| **Values distorted by >5%** | **0** |
| Field counts before/after | **identical** — nothing gained or lost |
| File counts in all 8 runs | **identical** — formatting only, no structural change |

`05_rtt` and `08_uwponly_stub` are byte-identical to the old baseline, which is a useful
cross-check: RTT's physical fields are all categorical (World Class, Chemistry, Biosphere)
and the stub path has no bodies, so neither *should* have moved. `06_aow` shrank most
(−17.6 KB), consistent with it having had the longest decimals.

**Baseline re-captured as `baseline_fmt_summary.json`** — a deliberate re-baseline, the
third in this work after HX-6 and HX-8. Hashes are in 7.1. All other checks pass unchanged:
leak 85/85, Obsidian 22/22, tags 24/24, model 38/38, grid 27/27, all-engine 6/6 (field
parity included, confirming no field was lost).

**Still outstanding — the one open item from this work, see section 9:** the in-app panels
(World Details, system viewer, surface viewer, menus) — roughly 350 sites — were **not**
touched. Sean wanted to judge whether the formatter pass was enough before committing to
that sweep. `fmtNum` is exported and ready to reuse; if it is wanted in-app it should
probably move to `js/universal_math.js`, which loads before everything that would need it.

### 4.10 Context-menu submenu clamping — FIXED 2026-08-04. Reported by Sean.

**Written up 2026-08-06.** This shipped in v0.17.0.1 (changelog item 3) but had no manifest
section — recorded now because the failure mode generalises well beyond this menu.

**Assign Player Disclosure was unreachable.** It is the last entry of ASSIGN, the longest
submenu, so on a short window it fell off the bottom of the screen. The pre-existing remedy
was a `flip-up` class swapping `top: 0` for `bottom: 0` — which **only moves the overflow**:
flipped near the bottom of the window, the submenu then ran off the *top* and hid its last
entries just as completely. A newly-added last item is the natural victim of both.

**Fixed by clamping instead of flipping** (`js/canvas_input.js:131-172`). `_positionSubmenu`
measures the submenu unshifted, computes the range it may occupy
(`MARGIN … innerHeight − height − MARGIN`), clamps its viewport top into that range, and
converts back to an offset from the item. A submenu genuinely taller than the window
scrolls via the CSS `max-height`. No entry is ever unreachable.

**Two listener bugs fixed in the same pass**, both pre-existing:

- The old code attached a `{ once: true }` `mouseenter` listener **per item on every
  right-click**. `once` meant hovering the same item twice never re-evaluated position —
  so opening a submenu, moving away and coming back left it mispositioned.
- Those listeners accumulated on every menu opening that was never hovered.

Now a **single delegated `mouseover`** on `#context-menu`, attached once at setup, with
inline offsets cleared at each opening (`canvas_input.js:125-128`) so every submenu is
re-measured at its natural position.

**Do not set `overflow` on `#context-menu` to solve a variant of this** — see
[[feedback_overflow_clips_submenus]] in memory. Clipped elements keep valid bounding rects,
so computed styles, positions and link targets all still look correct; only a hit-test or a
real click reveals the problem. Verified by `ctxmenu_check.js`, which drives real
right-clicks at **four viewport sizes** (1280×900, 1280×720, 1280×600, 1024×520) and
asserts every submenu entry is both on screen and the topmost element at its own centre —
**53 assertions passed**. Geometry alone is not enough here; the hit-test is the check that
matters.

### 4.11 World images did not match the app — FIXED 2026-08-06. Reported by Sean.

Noticed against a players' export at level (f), but **not a fog-of-war bug at all**: player
mode passes the world object to the renderer untouched and only changes the *filename*, so
referee exports had the identical mismatch. (f) is above the (e) image gate, so images were
emitted normally — they were simply different planets from the ones the app draws.

#### The cause: two different seeds for the same body

`PlanetRenderer` derives every terrain seed — heightmap, continents, oceans, clouds,
craters — from one string: `hashString(masterSeed + '-' + hexId + '-ph'|'-cn'|'-oc'|…)`
(`planet_renderer.js:1099-1120`). The UWP only drives the **palette and sea level**, which
is why exported worlds looked like a plausible world of the right type while being visibly
a different planet.

| | Seed passed |
|---|---|
| App (`hex_editor.js`, all three panels) | `editingHexId` — the bare hex id |
| Exporters | `` `${hexId}-w${wi}` `` — hex id + body index |

Proved by rendering, not inferred: same UWP `A867949-C`, same `masterSeed`, two completely
different planets.

#### Why the obvious fix does not work — read this before "simplifying" it

The natural repair is to make the app pass the exporter's `w${wi}`. **There is no shared
index to pass.** The exporters walk the flattened `SystemViewer.normalizeSystem().worlds`;
the accordion walks a per-star tree sorted by AU. Measured on the fixture:

| Engine | Accordion source | Index matches exporter? |
|---|---|---|
| MgT2E | `mgtSystem.worlds` | ✅ 76/76 systems |
| AoW | `aowSystem.worlds` | ✅ 35/35 systems |
| CT | `allBodies` via `.contents`, AU-sorted | ❌ **no `sys.worlds` at all** |
| T5 | `star.orbits[]` per star, AU-sorted | ❌ **no `sys.worlds` at all** |
| RTT | `star.planetarySystem.orbits[]`, re-sorted by `orbitNumber` | ❌ **no `sys.worlds` at all** |

Reconciling them would mean reimplementing all five normalizers inside `hex_editor.js` —
the parallel-path pattern System Viewer Rule 3 exists to prevent, and the direct cause of
OW-13/15/17 in the project manifest.

#### The fix: seed on the body's NAME

**`PlanetRenderer.imageSeed(hexId, body, fallback)`** is now the one definition, and lives
beside the renderer that consumes it — the same reasoning that put `hexPoly()` in
`renderer.js` for WP3. Every surface builds its seed through it; nothing reconstructs a
seed string.

Names were verified unique **within a system** before committing to this: **4599 bodies,
239 systems, all five engines, zero duplicates.** Only 10 bodies (MgT2E worlds) were
unnamed, which is what `fallback` covers — and MgT2E is the one engine whose accordion
index provably matches the exporter, so those 10 fall back to a matching positional
suffix. `seedname_check.js` re-measures this if the assumption is ever in doubt.

Seeds read **raw** body data, never a disclosed display name, so a players' export and the
referee's export of the same world stay byte-identical at every level.

#### The bug the check found — RTT mainworlds, 0 of 19

`openWorldImagePanel` seeded from `stateObj.<eng>Data.name`. For four engines that equals
the mainworld body's name; **for RTT it never does** — the body is `West Odessa VI` while
`rttData.name` is the bare system name `West Odessa`. Every RTT mainworld image would still
have mismatched. Fixed by seeding from the normalized mainworld body — the exporter's own
source of truth — with `<eng>Data.name` as fallback.

This is the highest-traffic image in the app, and a name-equality assumption that held for
80% of engines. **Check the mainworld separately from ordinary bodies**; it travels a
different code path in both the app and the exporters.

#### Also fixed, for free

Because the app seeded *every* body in a hex with the bare hex id, all worlds and moons in
one system shared a single heightmap — the same continents, re-flooded per world's
hydrographics. Now each body has its own surface.

#### Verification — `seedmatch_check.js`, 23 assertions

Seed agreement over **1979 bodies**; mainworld name equality per engine (36/24/38/19/31);
and a real **byte comparison** of an app-path render against an export-path render for one
body in each of the five engines — all identical.

**Obsidian guard: the 6 text runs stayed byte-identical; the 2 image runs changed with
identical file counts** (1307 and 1217 — nothing gained or lost, only redrawn). That is the
correct signature for a pixels-only change, and the **fourth deliberate re-baseline** (5.6).
Full suite re-run: leak 85/85, Obsidian 22/22, all-engine 6/6, tags 24/24, model 38/38,
grid 27/27, UI 17/17, map, style, sticky, ctxmenu 53/53.

### 4.12 Bodies took their neighbour's physical stats — FIXED 2026-08-06. Reported by Sean.

Found while answering "did the image bug cause the physical characteristics to disagree
too?" **It did not** — that was a third, independent bug, and a worse one: the export
printed *another world's* mass, density, gravity, diameter, tilt, temperature, pressure and
hydrographics under the right world's name.

#### Cause: `orbitId` is not unique

`_findMgtRawWorld` matched a normalized body to its raw physical data by **`orbitId` first**
and only fell back to name. Two bodies legitimately share an orbit slot:

```
w0 "Maracaibo A-I"    orbitId=0.28400000000000003  parentStar=0
w1 "Maracaibo A-II"   orbitId=0.28400000000000003  parentStar=0   <- same orbit
w5 "Maracaibo C-II"   orbitId=12                   parentStar=2
w6 "Maracaibo C-III"  orbitId=12                   parentStar=2   <- same orbit
```

`.find()` returns the first match, so the second body of every co-orbital pair silently
inherited the first's stats, and the name check below could never run to correct it. It was
always the *preceding* body, which is why the page looked plausible instead of broken.

**MgT2E only** — CT, T5, RTT and AoW all match by name first. Measured before the fix:
**14 of 688 worlds took another body's stats; 2 moons resolved to null and 1 to the wrong
moon** (knock-on from the wrong parent). Affects both exporters and both referee and
players' versions. The app was always right — the accordion reads the raw body directly,
which is exactly why the two disagreed.

#### Fix

Name first, `orbitId` as the fallback for unnamed bodies. Safe because names are unique
*within a system* — verified 4599 bodies / 239 systems / five engines, zero duplicates
(`seedname_check.js`, the same measurement 4.11 rests on).

After: **688/688 exact object identity, 0 null, 0 mismatches, and the 3 moon problems
cleared** — confirming they were knock-on.

#### The check that nearly passed while measuring nothing — 10th instance

The first field-value diff reported **"0 of 67052 changed"** and looked like a clean pass.
`fieldvals.js`'s `RUNS` list was `[18-H, 1-A, 1-B, 1-C, 1-D]` — **it had never included
1-E**, the second MgT2E subsector, which is where all 14 affected systems live. The tool
claimed to cover "all five engines" while being blind to the only subsector that could show
the bug.

`RUNS` now includes `1-E` (88,712 values, up from 67,052) with a comment saying not to trim
it. **A tool that samples subsectors will eventually be pointed at the wrong one; check its
scope before trusting a zero.**

#### Verification — the containment argument

| | |
|---|---|
| Field values compared | **88,712** across six subsectors |
| Changed | **189** — every one in **1-E**, zero elsewhere |
| `.md` files touched | 15 |
| Added / removed fields | 64 / 15 — the correct body has a different field set |
| Export runs differing | **exactly 1 of 8** — `07_mgt2e_gen_mercator`, which *is* 1-E |
| File counts | unchanged in every run |

Sample: `Maracaibo A-II` — Mass `0.95 → 1.46 M⊕`, Diameter `11,702 → 14,534 km`,
Hydrographics `0% → 28%`, i.e. it stops reporting A-I's body and reports its own.

Fifth deliberate re-baseline (5.6); previous set kept as
`baseline_fmt_summary_pre_rawmatch.json`. Whole suite re-run: leak 85/85, Obsidian 22/22,
seedmatch 23/23, tags 24/24, model 38/38, grid 27/27, UI 17/17, all-engine 6/6.

New check **`rawmatch_check.js`** asserts every body pairs with its own raw data, on all
five engines, including object identity where an index-aligned array exists.

### 4.1 Why WP1 is not optional

Release 2's disclosure ladder is a filter over **fields**. Level (e) discloses
Size/Hydro/Atmosphere but not Population — a per-field decision. The current formatters
emit pre-baked strings, and a string cannot be filtered without regex-ing markdown that
was just generated. Structured records make the filter one `.filter()` call, working
identically for both exporters.

A clone-and-convert `html_exporter.js` was **considered and rejected** for this reason:
it would mean building fog-of-war twice in two 1200-line near-duplicate files, and the
near-certain outcome is a players' export that leaks in one format but not the other.

---

## 5. Release 2 — Fog of War

### 5.1 Sean's disclosure ladder (verbatim, cumulative)

- **(a)** Just say if there is a star present
- **(b)** Show stellar details
- **(c)** Stellar details and gas giant presence
- **(d)** Stellar details, GG presence, world count and belt presence
- **(e)** As above plus Size, Hydro and Atmosphere of each world
- **(f)** As above plus Pop and Tech Level
- **(g)** Full UWP for each world

**Zero-Assumption note:** this ladder is Sean's own presentation filter. Do **not** map
it onto any published Traveller survey-level system from training data, and do not infer
where unlisted fields sit. The exporter emits well over a hundred fields; every one needs
an explicit level assignment from Sean. See HX-1.

### 5.2 Leak audit — VERIFIED FINDINGS. **All four closed; kept as the design rationale.**

These are the reason a players' export cannot be built by filtering page bodies alone.
**This section describes the pre-Release-2 state.** Each finding below now carries a
pointer to where it was closed — none is an outstanding leak.

| Finding | Closed by |
|---|---|
| 5.2.1 subsector map PNG | **WP6** (4.6) — per-hex gate in `renderer.js` |
| 5.2.2 filenames and structure | **5b/5c** (4.5.4, 4.5.5) for pages and names; **4.7** for body sections, which 5b missed |
| 5.2.3 world and orrery images | **5d** (4.5.6) — gated at (e)/(d), orrery re-rendered |
| 5.2.4 referee notes | **5b** (4.5.4) — section *and* its contents-nav link |

**5.2.1 The subsector map PNG leaks nearly everything.** `captureSubsector` works by
swapping in an off-screen canvas and calling the live `draw()`. Verified in
`js/renderer.js`, that renders per hex:

| Leak | Line |
|---|---|
| Full UWP string | 744, 913 |
| Trade codes | 914 |
| Starport class | 503 |
| Gas giant marker | 797 |
| Travel zone ring | 459, 883 |
| Stellar data strings | 927, 932 |

There is no filter hook in `draw()`. ~~Worse, the export inherits whatever display toggles
the GM had switched on at export time, so the leak is **nondeterministic**.~~ **CORRECTED
2026-08-04 — see 4.6.1: the leak was unconditional and deterministic.** The labels gate
only on `zoom > 0.4` and `captureSubsector` computes its own `capZoom` (~1.09) regardless
of the GM's live zoom, so there was never a display setting that suppressed them. **Closed
by WP6** — `draw()` now has a filter hook (`setMapDisclosure`).

**5.2.2 Filenames leak.** A folder containing `Regina - Prometheus (1910).html` tells a
player Prometheus exists even if the page says "no data". At levels (a)-(d), pages and
sections must **not be generated**, not merely blanked. D2 (sections not files) reduces
but does not eliminate this — the sector/subsector index tables leak the same way.

> **This paragraph was right and was only half-implemented.** Slice 5b built the *page*
> half and not the *section* half, so a players' export shipped with one blank section per
> body — 45 of them on one fixture system at level (a). See **4.7**. The words "not merely
> blanked" were already here; read them.

**5.2.3 World images leak visually.** A rendered planet is a picture of its
hydrographics and atmosphere. Images must be gated at **(e)+** regardless of the
"include world images" checkbox. Orrery snapshots reveal world count, belts and gas
giants — gate at **(d)+**.

**5.2.4 Referee notes must never export.** `state.notes` lands on the system hub and
every mainworld page. Since WP1 slice 3 this is `ExportCore.notesBlocks()`
(`js/export_core.js:318`) — a single shared chokepoint, which is where the Release 2
gate should go. Called from two sites in `obsidian_exporter.js`; `html_exporter.js` will
be a third.

### 5.3 Release 2 disclosure questions — **ALL ANSWERED 2026-08-03. Nothing open.**

HX-2 to HX-5 and the withheld-vs-absent question were put to Sean on 2026-08-03 and
answered; HX-1 was closed the same day across roughly twenty sequenced questions. These are
recorded as decisions, not as questions. **Do not re-ask any of them.**

- **HX-1 — CLOSED 2026-08-03.** Every emitted field carries a level. Sized against the
  code rather than estimated: **194 field emissions, 111 distinct labels** across the
  twelve `format*` functions plus the six shared block builders in `js/export_core.js`.
  The answer key is `directives/fog_of_war_field_tags.md` **§3.5**; per-body fields were
  assigned **by category rather than field** (eight groups across all five engines), which
  is what made ~111 labels tractable in one session. Its executable form is `FIELD_LEVELS`
  in `export_core.js:550` — **the two must change together.** Sean took the strict option
  at nearly every UWP-adjacent question, so low-level exports are deliberately sparse (a
  level (b) subsector index is two columns wide); §1.10a records that this is intended.
  **Do not fill in or revise a level by inference** — Zero-Assumption Policy, §5.1.
- **HX-2 — ANSWERED: generic labels until (g).** Worlds are "World 1", "World 2",
  "Belt 1" at every level below (g); real names appear only at full-UWP disclosure. Sean's
  reasoning matches the framing in this manifest: a name implies someone has *been* there
  and named it, which reveals more than a physical stat does.
  **Consequence for WP5 — image filenames.** World images are gated at (e)+ per 5.2.3, so
  at (e) and (f) an image is emitted for a world whose name is withheld. The current
  `bodyFilename` scheme (`Regina - Prometheus (1910).png`) would leak the name through the
  filesystem, exactly the 5.2.2 failure. Player exports must name body images by their
  generic label at (e)/(f), and only use real names at (g).
- **HX-3 — ANSWERED: per-system only.** One level per hex; no per-body override, and no
  mainworld exception. WP4's data model is therefore a single field on the hex state,
  bulk-settable through the existing `selectedHexes` machinery.
- **HX-4 — ANSWERED: nothing is unconditionally visible.** Sean explicitly rejected all
  four candidates (system name, hex, travel zone, allegiance, region). **There is no
  always-visible set.** This is a stronger answer than the manifest previously assumed
  and has three consequences:
  1. `System Name`, `Hex`, `Travel Zone`, `Allegiance` and `Region` are ordinary rows in
     the HX-1 tagging table like any other field, and each needs its own level.
  2. **Page filenames cannot carry the system name** below whatever level discloses it —
     the 5.2.2 leak applies to system pages, not just body pages. Hex-based filenames
     (`1910.html`) are the likely answer, pending HX-1.
  3. The subsector and sector **index tables** are themselves disclosure surfaces. The
     Q1 column set (Hex, System, UWP, Starport, TL, Trade Codes, GG, Bases, Zone) is
     almost entirely gated data; a player index may legitimately be near-empty at low
     levels.
- **HX-5 — ANSWERED: no.** No player-facing notes field. GM notes are suppressed outright
  and nothing replaces them, so the `ExportCore.notesBlocks()` gate (5.2.4) is a plain
  on/off for the player export rather than a swap. Simplifies WP4 — no new state field,
  no save/load change, no editor UI.
- **Withheld vs absent — ANSWERED 2026-08-03: show nothing.** A withheld field is simply
  omitted, indistinguishable from a field that has no data. No "Unsurveyed" placeholder,
  not even for a wholly withheld section. This resolves the concern parked in 4.2.4
  ("an omitted row and a withheld row look identical to a player") **in favour of that
  being the desired behaviour**, and means HTML's existing empty-row omission needs no
  change. Do not add a placeholder later without asking.

### 5.4 HX-6 — RTT rich formatter was dead code — **FIXED 2026-08-01, after WP1**

**Was** not introduced by this work, and deliberately **not** fixed inside WP1 — the
refactor had to preserve behaviour bug-for-bug or the verification diff would have been
meaningless. Fixed immediately after WP1 closed, as its own change with its own diff.

**Fix:** `_findRttRawBody` in `js/export_core.js` now traverses
`sys.stars[].planetarySystem.orbits[]`, sorted by `orbitNumber`, mirroring
`SystemViewer._normalizeRTT` (`js/system_viewer.js:613-625`) so raw bodies line up with
the normalized worlds they are matched against. The two legacy shapes (`sys.worlds`,
`star.orbits[].contents`) are retained as defensive fallbacks.

**Verified.** Full 8-run suite: 7 of 8 byte-identical, only `05_rtt` changed
(+91,862 bytes), file count unchanged at 566 and the file-name set identical — so
content got richer with no structural change. Field counts across the RTT export:

| Field | Before | After |
|---|---|---|
| World Class / Chemistry / Biosphere / Rings / Habitation / Desirability / Industry / Starport | 0 | 453 |
| Terraforming Potential | 0 | 49 |

453 = 206 worlds + 247 satellites, so moons pick up the fields too (`findRawMoon`'s
`rawWorld.satellites` path now resolves because `rawWorld` does).

### 5.5 HX-7 — two display questions the HX-6 fix exposed — **BOTH RESOLVED 2026-08-01**

Neither was a regression; both were pre-existing formatter/engine behaviour that was
simply invisible while `_formatRttBodyFields` never ran. **Both resolved as
"current behaviour is correct" — no code change was made for either.**

#### HX-7.1 — `**Rings:** None` / `**Chemistry:** None` — KEEP (Sean, 2026-08-01)

`_formatRttBodyFields` guards on truthiness (`if (raw.rings)`), and RTT stores the
*string* `'None'`, which is truthy — so 146 of 206 bodies print "Rings: None" and 145
print "Chemistry: None".

**Decision: keep the explicit "None", so there is no confusion** between "this value was
rolled and is genuinely none" and "this value is missing/unknown". Applies to both the
Obsidian and HTML exports.

**Do not** add a `&& raw.rings !== 'None'` guard. This is a deliberate choice, not an
oversight.

#### HX-7.2 — starports on every RTT body — CORRECT, Rules As Written (2026-08-01)

Confirmed via Sean's requirements review: the generation engine is faithfully executing
the *Galactic System and World Generation Manual*. **This is not a bug and must not be
"fixed".** The rules contain a mathematical design quirk that eliminates uninhabited
worlds entirely at high tech levels.

**Why 195 of 206 bodies are Outposts and none are Uninhabited.** Any world that is not a
homeworld or colony rolls for outpost placement: roll 1d6 (−1 in a culture's home
system); an outpost is placed if the roll is **≤ (TL − 9)**.

At the Third Imperium's dominant TL15: target = 15 − 9 = **6**. A 1d6 can never exceed 6,
so the check succeeds **100% of the time** — "Uninhabited" is mathematically unreachable.
At TL10 the target is 1, so only a natural 1 succeeds and ~83% of eligible worlds stay
uninhabited. The outcome is therefore a function of the setting's dominant TL, not of
the code.

**Why every body then has a starport.** With zero uninhabited worlds, every body is a
Homeworld, Colony or Outpost:

- **Outpost, Population 0** → automatically E-class, representing an unmanned navigation
  beacon and emergency supply cache. This is the source of the 139 E-class starports on
  tiny airless rocks and moons.
- **Population 1+** → rolls 2d6 + Industry − 7 on the starport table, with a **+2 DM at
  TL15+**. "X" (no starport) requires a modified result ≤ 2; a natural 2 already yields 4
  (E-class), so "X" is effectively unrollable.

**Consequence for the exporter:** the guard `raw.habitationType !== 'Uninhabited'` in
`_formatRttBodyFields` is *correct* — it simply has no uninhabited worlds to suppress at
TL15. It would begin firing in a sector generated at a lower dominant TL. Leave it in.

**House-rule option, NOT pursued.** If uninhabited worlds are ever wanted, the change
belongs in the **generation engine**, never the exporter — e.g. treating a natural 6 on
the outpost check as an automatic failure, or capping the TL used in that calculation at
TL12 for a ~50% wild-world baseline. Sean has not asked for this. Do not implement it
speculatively.

### 5.7 HX-8 — AoW rich body fields — **PARTIALLY FIXED 2026-08-01** (safe subset)

Found during slice 2b, fixed the same day as its own change. **This was HX-6's twin.**
The investigation reversed the original framing: **AoW is the richest engine in the
codebase, not the poorest** — its bodies carry ~90 fields of planetary simulation.

**What was fixed (Sean's scope choice: plumbing + safe subset + socio + bases):**

1. **Plumbing.** `_findAoWRawWorld` added to `findRawWorld`, matching on `name` then
   `au`, mirroring `SystemViewer._normalizeAoW`. `findRawMoon` gained an AoW branch using
   **`.satellites`** — AoW bodies carry both `.moons` and `.satellites`, and the
   normaliser builds from `.satellites`, so index alignment requires the same one.
2. **`formatAoWBodyFields`** — 15 fields whose quantity *and* unit are unambiguous and
   already labelled identically for another engine: distance, eccentricity, mass,
   density, gravity, diameter, axial tilt, albedo, mean temperature, pressure, water
   coverage, breathability, world class, lithosphere, magnetic field.
3. **Socioeconomics.** AoW stores these on the mainworld **body**, not on the hex state
   where `state.mgtSocio` lives — but under MgT2E's own field names, so
   `formatMgtSocio` renders them unchanged. Both exporters now call a shared
   `ExportCore.socioBlocks(state, raw)`, replacing two inlined copies.
4. **Bases.** AoW records `navalBase`/`scoutBase`/`corsairBase` as **booleans**, not the
   code array every other engine uses — which is why the Q1 Bases column read empty for
   AoW. Now mapped using **the app's own existing convention** from
   `js/hex_editor.js:159-162`: naval → `N`, scout → `S`, **corsair → `P` (not C)**.

**`militaryBase` is deliberately NOT emitted.** `hex_editor.js:161` records that `M`
already means *Merchant* in RTT, so there is no unambiguous letter. Inventing one would
have produced a code that reads as something else in another engine.

**Deliberately still deferred**, needing a ruling against the Architect of Worlds manual:

- `habitability` — runs **-6..8** here, where MgT2E's formatter prints `X/15`. Reusing
  that label would render a nonsense scale.
- `orbitalPeriod` (24.79 - 2,758,542) and `rotationPeriod` (5 - 4,816) — **no stated
  unit**. Days? Hours? A wrong unit is worse than a missing field.
- ~40 AoW-specific terms: `tBb`, `mNum`, `rFactor`, `Rmin`/`Rmax`, `tidalModifier`,
  `tDeep`, `tMulti`, `tPhoto`, `tOxy`, `tAnimal`, `tPresapient`, `grandTackMovement`,
  `arrivalOrbit`, `formationOrbitType`, `scaleHeight`, `avgMolMass`, per-gas partial
  pressures. Meaning and label both unknown — **do not guess**.

**Verified.** Full 8-run suite: 7 of 8 byte-identical, only `06_aow` changed
(+204,809 bytes), file count unchanged at 594. Across the AoW export: World Class,
Lithosphere, Magnetic Field on 503 files; Mass 543; Density/Gravity/Diameter 491;
Albedo/Pressure/Water Coverage/Breathability 307; socioeconomics on 32 mainworlds.
Index table stayed well-formed (9 columns, 35 rows, 0 malformed), 9 rows now carry base
codes. **All-engine parity still 6/6** — as expected, since both exporters received the
same change. Merge, style/print and real-UI checks all still pass.

**Baseline recaptured**: `baseline_fmt_summary.json` supersedes the HX-6 one; only
`06_aow` differs between them.

#### Original finding (kept for context)

`findRawWorld` in `js/export_core.js` dispatches on `mgtSystem`, `ctSystem`, `t5System`
and `rttSystem`. There is **no AoW branch** — `aowSystem` appears zero times in the whole
file. Every AoW body therefore resolves to `null` and falls through to
`fallbackPhysicalBlocks`, which emits only gravity, diameter and mean temperature.

**What is being missed.** `aowSystem.worlds[]` exists and is richly populated —
`mass`, `density`, `surfaceGravity`, `radius`, `orbitalRadius`, `orbitalPeriod`,
`rotationPeriod`, `rotationLock`, `obliquity`, `eccentricity`, `hillRadius`, `Rmin`/`Rmax`,
`planetType`, `satellites`, `ringSystem`, `localDay`, `localYear`, and more.

**Why parity did not catch it.** It cannot: parity compares HTML against Markdown, and
**both** exporters are equally thin for AoW. An AoW page carries ~225 fields where CT
carries ~481 and MgT2E ~940. Parity proves the two formats agree, not that either is
complete — worth remembering as a limit of that check.

**Scope if fixed:** an AoW branch in `findRawWorld` (and possibly `findRawMoon` /
`findRawStar`), plus a `formatAoWBodyFields` formatter, which does not exist —
`_formatRttBodyFields` is the closest model. Expect the Obsidian output to change for AoW,
so a fresh baseline would be needed afterwards, exactly as with HX-6.

### 5.8 HX-9 — sticky index header hid the first system row — **FIXED 2026-08-02**

Reported by Sean against the shipped v0.17.0 export: the top row of the subsector
system table (San Francisco, in his sector) was hidden behind the column headers.

**One cause, two bugs.** `position: sticky` resolves against the nearest **scroll
container**, and `.tw { overflow-x: auto }` — the wrapper that keeps wide tables from
scrolling the page sideways — silently *was* that container. So the header from 2c was
never sticking to the viewport at all:

1. Its `top: 2.95rem` was applied against the wrapper, which never scrolls vertically,
   displacing the header **47.2px downward permanently** — over the first data row, at
   every scroll position including `scrollY: 0`. That is what Sean saw.
2. The header **never pinned**. Measured at `scrollY: 1600` it sat at `thTop: -488.8`,
   i.e. scrolled off the top of the window — the exact problem 2c was written to solve.

**Fix.** The index table's wrapper carries its own class (`tw tw-index`) and drops its
overflow at `min-width: 60rem`, where the table is known to fit: intrinsic minimum width
~661px against a content column that caps at ~889px (`body` is `max-width: 60rem` with
`box-sizing: border-box`), so there is a fixed ~228px of headroom that does not shrink as
the viewport grows. Only there does the header pin, at `top: 3.3rem` to clear the
breadcrumb bar's measured 52.6px. Below 60rem the wrapper still scrolls sideways and
`top: 0` keeps the header harmlessly in its own row — degraded, but never corrupted.
Print resets `position: static`, since `table-header-group` already repeats the labels.

**Ruled out by measurement, not reasoning:** `border-collapse: collapse` (separate gives
22.8px overlap instead of 21.3), moving sticky to `thead tr` (identical), and giving the
wrapper a `max-height` (still 21.3 — the wrapper remains the scrollport).

**Why no existing check caught it.** Every one of the seven harness scripts passed
throughout, including the 2d style check that explicitly asserts the sticky header. They
check computed styles, links, ids, parity and images — none compares *rectangles*. Both
failure modes render as a perfectly plausible table: a displaced header just looks like a
table whose first row starts high, and a header that fails to pin looks like a table with
no sticky header. **A computed `position: sticky` is not evidence that anything sticks.**

New check `html_check_stickyrow.js` measures th-vs-row1 rects and per-pixel
`elementFromPoint` occlusion across seven viewport widths, and asserts pinning happens at
≥60rem and does not below it. Verified after the fix: all-engine 6/6, merge, style/print,
map and real-UI all pass; Obsidian regression guard **8/8 byte-identical**.

This is the **fourth** time in this work that looking at rendered output found what green
checks missed (2c's scrolled-away header and empty column, 2d's duplicated heading, now
this). The standing rule in 0.3 holds.

### 5.6 Baseline note — three deliberate re-baselines, in order

The Obsidian byte-diff guard is only meaningful if the reference moves *deliberately*.
It has moved exactly three times, each time for a change whose whole purpose was to alter
Markdown output:

| # | Cause | Runs affected | File |
|---|---|---|---|
| 1 | **HX-6** — RTT rich formatter was dead code (5.4) | `05_rtt` only | superseded |
| 2 | **HX-8** — AoW rich body fields (5.7) | `06_aow` only | `baseline_hx8_summary.json` (superseded) |
| 3 | **4.9** — numeric display rounding | 6 of 8; `05_rtt` and `08_uwponly_stub` unchanged | `baseline_fmt_summary_pre_seed.json` (superseded) |
| 4 | **4.11** — world-image seed | **only** `01` and `07`, the two image runs | `baseline_fmt_summary_pre_rawmatch.json` (superseded) |
| 5 | **4.12** — raw-body mis-pairing | **only** `07`, the one run covering subsector 1-E | **`baseline_fmt_summary.json` — CURRENT** |

**The current reference is `baseline_fmt_summary.json` (2026-08-06)**; its hashes are
transcribed into 7.1 so they survive `.tmp/` being cleared. The earlier files are kept only
for provenance — do not compare against them.

**Re-baselines 3, 4 and 5 are cleanly separable**, which is worth keeping: 3 moved text and
left `05_rtt`/`08_uwponly_stub` alone; 4 moved *only* the two image runs and left all six
text hashes byte-identical to 3; 5 moved *only* `07`, the single run covering the subsector
that held the bug. A re-baseline that changes runs it has no business changing is a bug, not
a re-baseline — **state which runs should move before you look, then check.**

Everything else in this work held the guard at **8/8 byte-identical**, including the whole
of Release 2: the GM export is provably unchanged by fog of war, because the GM path
through `filterBlocks` returns the same array object.

---

## 6. Implementation Conventions (agent's calls, Sean did not object)

- **Frontmatter replacement.** YAML has no HTML equivalent. Each page gets a visible
  metadata block (hex, sector, edition, mainworld UWP, allegiance) plus `data-*`
  attributes on the root element carrying the same values.
- **Escaping.** An `_esc()` for `& < > "` on every interpolated value. `state.notes` is
  free text and would corrupt a page the moment someone types `<`.
- **Anchor IDs.** Slugified from body name plus index, so duplicate names within a
  system cannot collide.
- **Link paths.** Every `<a href>` and `<img src>` needs a real computed relative path.
  Obsidian's name-based resolution does not exist here — this is where a naive port
  breaks, and it breaks *silently* (pages render, images just missing).
- Static and `file://`-openable throughout. No server, no `fetch`.

---

## 7. Verification Requirements

**This code modifies working files that a user's whole sector passes through.** It requires
proof, not assurance. The protocol below is what the whole of Release 1 and Release 2 was
built against, and it is what any future change here must clear.

### 7.0 The standing protocol — what "done" means

1. **Obsidian regression guard, 8/8 byte-identical** against `baseline_fmt_summary.json`
   (7.1). `fast` (6 runs) is for the edit/check loop; **the full 8 are required before
   calling anything done**, because two runs are image-heavy and nothing else exercises
   them. Any Markdown change is a bug unless it is a deliberate re-baseline — there have
   been exactly three, all in 5.6.
2. **Whatever checks in 7.4 cover the surface you touched**, re-run to green. Touching
   `export_core.js` means all of them: it is shared by both exporters.
3. **Look at the rendered output.** Screenshot, print to PDF, or open the image. This is
   not optional — 0.3 lists the eight separate occasions it caught what nothing else did.
4. **Confirm the check is measuring what you think** before trusting pass *or* fail. Eight
   recorded incidents of the opposite; see 0.3.

**The original WP1 caveat, now closed.** A byte-identical Markdown diff proves the
*renderer* is faithful; it does not prove the structured records carry everything the HTML
renderer wants. That gap was closed in slice 2b by field parity across all five engines,
every page — plus 3294 UWP values compared exactly. **Zero unexplained differences.**

### 7.1 Baseline — CAPTURED 2026-08-01, harness preserved for future sessions

**Harness location: `.tmp/html_export_harness/`** (gitignored; `.tmp/` is where this
repo already keeps test harnesses). Moved out of the session scratchpad on 2026-08-01
**specifically so a new session can still verify** — scratchpad paths are session-scoped
and would otherwise be lost. Paths inside the scripts are now relative to the harness
folder, so it runs from anywhere in the repo. Re-verified after the move: 6/6 fast runs
reproduced the recorded hashes.

| File | Purpose |
|---|---|
| `fixture_sector.json` | The frozen 7.0 MB / 560-hex test sector. **Do not regenerate** — see below |
| `export_runner.js` | Runs the Obsidian exporter against the fixture, writes ZIPs + `_summary.json` |
| `build_fixture.js` | Rebuilds the fixture from scratch. Only needed if the fixture is lost |
| `zipread.js` | Minimal reader for the exporter's stored ZIPs; also a CLI (`node zipread.js <zip> [pattern] [cat]`) |
| `baseline_fmt_summary.json` | The reference hashes (the ZIPs themselves were not kept — 109 MB) |

**To verify nothing has changed:**

```
cd .tmp/html_export_harness
node export_runner.js check          # or: node export_runner.js check fast
```

then compare each run's `sha256` in `baseline_check/_summary.json` against
`baseline_fmt_summary.json`. `fast` skips the two image-heavy runs (~4 min saved) and is
for iteration only — **the full 8 are required before calling a slice done**.

**Reference hashes — RE-BASELINED TWICE on 2026-08-06**, for 4.11 (world-image seed, moved
runs `01` and `07`) and then 4.12 (raw-body mis-pairing, moved `07` only). Prior sets are
preserved as `baseline_fmt_summary_pre_seed.json` and
`baseline_fmt_summary_pre_rawmatch.json`. Six of the eight runs still carry the hashes they
had on 2026-08-04, which is the proof that both fixes were contained.

| Run | Files | Bytes | SHA-256 |
|---|---|---|---|
| `01_mgt2e_real_images` | 1307 | 24585781 | `6498cee7f420949a355251b8b018efdc6c1dc35ef421ecc3b5f6a6f25a7bcf34` |
| `02_mgt2e_real_nosub` | 1193 | 1856258 | `22e99f4e8439396d6334ac0950d5e7cd8e702b902bb3f4178643510907ad537c` |
| `03_ct` | 1054 | 1372227 | `25036da93409c8c98d75ffd7cfc4de2e1e529afe2a041cc441414d6888bc73f8` |
| `04_t5` | 906 | 1298196 | `5377f14329ecf6d39f20aabc73136d6a6278667398d9f40f751497226269ed74` |
| `05_rtt` | 566 | 877887 | `28ca7a184c3da26ece3833f021ad6444c1bb224e44c86eb17b75b27326315d47` |
| `06_aow` | 594 | 1025528 | `1d0e0198718aae0c0a1249d6caf21bec4382844c5133449cc86982b1819c7403` |
| `07_mgt2e_gen_mercator` | 1217 | 83406630 | `3f4377995a6e6694360d0e33929780d01e12191e799d413c11fc4d1a7358ee2c` |
| `08_uwponly_stub` | 42 | 256350 | `a5b886a461cd2c8416e1c58f10499fc17df8f4a9882be842cc469e55654f8034` |

**`fast` cannot see an image change.** It skips runs 01 and 07 — precisely the two that
4.11 moved. Any change touching image rendering **must** be verified with the full 8.

These hashes are also duplicated here in the manifest on purpose: if `.tmp/` is ever
cleared, the numbers survive even though the harness would need rebuilding.

**Why the fixture is frozen and must not be casually regenerated.** The before/after
diff is only meaningful if the *input* is byte-identical. `build_fixture.js` generates
from `sectors/solo_6.json` plus live engine macros; generation determinism across runs
was never proven (freezing the fixture is what made proving it unnecessary). If the
fixture is ever rebuilt, **every hash above becomes invalid** and a fresh baseline must
be captured from known-good code before any further refactoring.

| Subsector | Content | Coverage |
|---|---|---|
| 18-H | 38 real MgT2E systems from `sectors/solo_6.json` | 23 lunar mainworlds, 8 multi-star, 791 moons, socio |
| 1-A | 42 generated CT | 15 multi-star, 18 lunar MW, 629 moons, 31 belts, 100 GGs |
| 1-B | 41 generated T5 | 26 multi-star, 414 moons, 30 belts, T5 socio |
| 1-C | 45 generated RTT | 20 multi-star, 206 bodies + 247 satellites (all rich-field bearing since HX-6) |
| 1-D | 35 generated AoW | 13 multi-star, 117 moons, 14 belts |
| 1-E | 38 generated MgT2E | 14 multi-star, 17 lunar MW, 422 moons |
| 25-H | 40 UWP-only hexes | exporter's no-system stub path |

**Eight runs**, varying `includeImages`, `imageProjection` (globe + mercator),
`skipAirless`, `includeSystemImages` and `useSubfolders` so a change cannot alter one
option branch undetected. Run definitions are the `RUNS` array at the top of
`export_runner.js`. Zero console errors throughout.

**Determinism proven.** The full suite was run twice and compared by SHA-256:
8 of 8 ZIPs byte-identical, including the 79 MB mercator image run. Without this the
diff plan would have been worthless, so it is a required step, not a nicety.

### 7.2 Trap found while building the baseline

The generation macros (`runCTNewMacro`, `runT5Macro`, ...) are declared `async` but defer
their real work into a bare `setTimeout` they never await — see
`js/macro_orchestrator.js:702`. `await runCTNewMacro(false)` therefore returns in ~2 ms
having generated nothing, leaving hexes as bare `{type:'SYSTEM_PRESENT'}` markers.

The first fixture build hit exactly this and **reported success** (plausible-looking
system counts, 0.0 s per edition, no errors) while producing no system data at all. Any
harness driving these macros must poll `hexStates` until the deferred work settles, and
must **assert** non-zero results rather than merely reporting them.

**Test in a real browser, not `node --check`.** Per `feedback_t5_editor_verification`
in memory, in-browser Playwright testing found real bugs 3-for-3 where syntax checking
found none. Also note two logged incidents of test scripts grabbing the wrong
same-type DOM element (`project_ct_gas_giant_size_editor`,
`project_ct_uwp_seed_size_codes`) — verify the selector actually targets the intended
element before trusting a failure.

### 7.3 New output has no byte-diff — the four substitutes

Every WP1 slice could lean on "output must not change". Everything after it *creates*
output, so that safety net is gone. These four replaced it and are still the right tools
for any new surface:

1. **Field parity against the Markdown twin.** Extract every `label: value` pair from the
   HTML page and from the corresponding Markdown page(s), and diff the sets. Catches a
   field one renderer uses and the other drops. Run over **every** page, not a sample — a
   per-engine quirk sits in the system you did not happen to pick (4.2.4).
2. **Regression guard on Obsidian.** The full 8-run suite against
   **`baseline_fmt_summary.json`** (not the superseded `baseline_hx6`/`baseline_hx8` files
   — see 5.6), 8/8 byte-identical.
3. **Actually open the pages.** Load the generated `index.html` from `file://` in a real
   browser: no console errors, images resolve, every internal link resolves, the theme
   toggle works both ways, no horizontal scroll. Broken relative paths render as a
   *silently* missing image — see section 6.
4. **Link integrity sweep + orphaned-image sweep.** Parse every `href`/`src` and assert the
   target exists as a ZIP entry; then the reverse — assert no file in the ZIP is
   unreferenced. The forward sweep cannot see a generated file nothing points at. **Match
   both `src="…"` and SVG `<image href="…">`** — WP3 broke this sweep by moving the map
   into an `<image>`, and it reported a correctly-referenced file as orphaned on all six
   engines. A sweep that knows one reference syntax gives false confidence in both
   directions.

**For a players' export, add a fifth: search the raw ZIP bytes.** Pages, filenames and
attributes together, at every level 0–g, asserting forbidden strings absent and permitted
ones present with monotonic growth a→g. A DOM sweep walks straight past `data-uwp`, YAML
frontmatter and SVG `<title>` — all three were real leaks (4.5.4, 4.7).

### 7.4 Harness inventory — `.tmp/html_export_harness/`, 19 scripts

Extend these rather than writing a new one. All are in-browser (Playwright) except
`export_runner.js`, `fieldvals.js` and `zipread.js`.

**Infrastructure**

| Script | Purpose |
|---|---|
| `export_runner.js` | Drives the Obsidian exporter over the fixture; `check` / `check fast`. The byte guard. |
| `build_fixture.js` | Rebuilds the frozen fixture. **Invalidates every hash in 7.1** — see 7.1. |
| `zipread.js` | Minimal ZIP reader; also a CLI (`node zipread.js <zip> [pattern] [cat]`) |
| `fieldvals.js` | Captures every `**Label:** value` pair and diffs before/after. **The replacement for the byte guard when a change is *meant* to alter output** — 4.9 over 67,052 values, 4.12 over 88,712. Its `RUNS` list gained **1-E** in 4.12 after a diff reported a false "0 changed"; do not trim it. |
| `rawmatch_check.js` | Every body pairs with **its own** raw physical data, all five engines — null lookups and wrong-body lookups, plus object identity where an index-aligned array exists (4.12) |

**Release 1 — the GM export**

| Script | Covers |
|---|---|
| `html_check.js` | Single-engine: links, orphaned images, field parity, duplicate ids |
| `html_check_all.js` | All five engines + the UWP-only stub path (**6/6**) |
| `html_check_merge.js` | D3's separate-ZIPs-into-one-folder merge |
| `html_check_style.js` | Theme both directions, persistence, print (18 assertions) |
| `html_check_map.js` | WP3 overlay geometry vs independently recomputed hex centres |
| `html_check_stickyrow.js` | HX-9 — header/row **rectangles** and occlusion at 7 viewport widths |
| `html_check_ui.js` | The real three-deep export UI |

**Release 2 — fog of war**

| Script | Covers | Count |
|---|---|---|
| `disclosure_check.js` | WP4 model + assign modal, incl. a real Ctrl+Z | **38** |
| `disclosure_tags_check.js` | `FIELD_LEVELS` plumbing, context sensitivity, fail-closed, completeness | **24** |
| `disclosure_leak_check.js` | **The main one.** Raw-ZIP search at every level; images and map by byte comparison | **85** |
| `disclosure_obsidian_check.js` | Per-body files, YAML frontmatter, star headers — the Obsidian-only leaks | **22** |
| `disclosure_ui_check.js` | Real UI on a deliberately **mixed-level** subsector | **17** |
| `disclosure_grid_check.js` | The **D** window, incl. scope memory and never-set counts | **27** |
| `ctxmenu_check.js` | Submenu reachability at 4 viewport sizes, by hit-test (4.10) | **53** |
| `player_page_shot.js` | Renders a real player page to PNG. **Not an assertion — the eyes.** | — |

**World images (4.11)**

| Script | Covers | Count |
|---|---|---|
| `seedmatch_check.js` | App-path vs export-path seed agreement over 1979 bodies; mainworld name equality per engine; **byte comparison** of a real render both ways, all five engines | **23** |
| `seedname_check.js` | The assumption `imageSeed` rests on: body names unique **within a system**. Re-run before changing the seed scheme | — |
| `seedcheck.js` | Renders one world under two seeds. The diagnostic that found 4.11 | — |

**Use a heterogeneous fixture for anything disclosure-related.** Uniform levels hide
per-hex bugs, and per-hex resolution is the entire point of the feature.

---

## 8. Change Log

- **2026-08-01 (1)** — File created. Design agreed with Sean across six sequenced
  questions (D1-D6). Codebase facts in Section 3 and the leak audit in Section 5.2
  verified against source. No code written.
- **2026-08-01 (2)** — Baseline captured (7.1): mixed-edition fixture, 8 runs,
  determinism proven by running the suite twice. Trap 7.2 found and worked around.
- **2026-08-01 (3)** — **WP1 complete.** Slices 1-3, each verified 8/8 byte-identical
  over 6879 files. `js/export_core.js` created (433 lines);
  `js/obsidian_exporter.js` 1235 -> 954 lines. Zero user-visible change.
- **2026-08-01 (4)** — **HX-6 fixed** (RTT raw-body lookup). 7/8 byte-identical, only
  `05_rtt` changed; 453 bodies gained their rich fields. HX-7 opened for two display
  questions the fix exposed.
- **2026-08-01 (6)** — **HX-7.1 and HX-7.2 both resolved as "current behaviour is
  correct"; no code changed.** 7.1: keep explicit "None". 7.2: confirmed Rules As
  Written via requirements review — the TL15 outpost formula makes "Uninhabited"
  mathematically unreachable, so every body legitimately carries a starport. Rules
  rationale recorded in 5.5 specifically to stop a future session "fixing" it.
- **2026-08-01 (5)** — Manifest audited for staleness: header status, 3.1 marked
  historical, 3.2 line numbers re-verified, WP table updated, 5.2.4 repointed at
  `ExportCore.notesBlocks`, an orphaned block of superseded HX-6 text removed from 5.6,
  section 9 added.
- **2026-08-01 (7)** — **Break handover.** Section 0 added (resume instructions).
  Section 4.2 added: the WP2 slice plan (2a-2e), target folder/page shape, and the list
  of `export_core.js` functions WP2 must reuse — including the note that the twelve
  `_format*` functions still need moving into the core. Harness moved from the
  session-scoped scratchpad to **`.tmp/html_export_harness/`** so a future session can
  still verify; its paths made relative and the move re-verified (6/6 hashes reproduced).
  Reference SHA-256s transcribed into 7.1 so they survive even if `.tmp/` is cleared.
- **2026-08-02 (1)** — **HX-9 fixed**: the subsector index's sticky column headers were
  displaced permanently over the first system row and never pinned at all, both because
  `.tw`'s `overflow-x` made the wrapper the sticky scroll container. See 5.8. New
  `html_check_stickyrow.js` measures header/row rectangles and occlusion across seven
  viewport widths — no previous check compared geometry. Full regression re-run:
  all-engine 6/6, merge, style/print, map, real-UI, Obsidian guard 8/8 byte-identical.

- **2026-08-03** — **Release 2 planning opened.** Version bumped to v0.17.0.1
  ("Player Fog of War Exports"). HX-2, HX-3, HX-4 and HX-5 put to Sean and answered, plus
  the withheld-vs-absent question parked in 4.2.4 — all five recorded in 5.3. HX-4 came
  back stronger than assumed (**nothing** is unconditionally visible), which makes page
  filenames and the index tables disclosure surfaces in their own right. HX-1 sized
  against the code rather than estimated: **194 field emissions, 111 distinct labels**.
  Draft tagging table created at `directives/fog_of_war_field_tags.md` — only the ~8
  fields the ladder names explicitly are pre-filled. No code written.
- **2026-08-03 (2)** — **HX-1 CLOSED; Release 2 fully unblocked.** Roughly twenty
  sequenced questions, one at a time at Sean's request so each answer could shape the
  next. Per-body fields were assigned by **category rather than field** (eight groups
  across all five engines) — see §3.5 of the tagging table, the authoritative answer key.
  Sean took the strict option at nearly every UWP-adjacent question, so low-level exports
  are deliberately sparse (a level (b) subsector index is two columns wide); §1.10a records
  that this is intended. Sequencing surfaced **four leaks a field-by-field pass would have
  missed**: star names embed the system name (§3.11a); orrery images carry body labels as
  pixels (§9.2a); Travel Zone's absence already encodes "Green", so gating it would have
  *misreported* Red systems as safe (§1.6a); and the mainworld's name leaks via
  `resolveSystemName`'s fallback (§1.10b). One new ladder rung was added — **level (0)
  "Unknown"** — because (a) was otherwise an unavoidable baseline, contradicting HX-4.
  No code written.
- **2026-08-03 (3)** — **Derived-value rule reversed; HX-1a cancelled.** The
  input-inheritance rule adopted earlier the same day (derived fields auto-appear once all
  their inputs are visible) was replaced by **every field assigned independently** — a
  derived value is shown only when explicitly called out. Sean's call, made before any
  code was written. Consequences: WP5 needs no dependency graph, just a flat lookup;
  HX-1a (extracting a per-engine derivation map from ~15,000 lines of engine code) was
  started and immediately stopped, producing no findings and needing none; Gravity, Mass
  and Density were assigned **(e)** explicitly; Trade Codes became an explicit **(g)**,
  same outcome as before; and the Habitability conflict dissolved, leaving Group 6's
  **(f)** standing. §11.1 carries the revision history so the rule is not silently
  restored. **Release 2 now has nothing outstanding.** No code written.
- **2026-08-03 (4)** — **WP4 complete.** `js/disclosure.js` (new, 155 lines) — per-hex
  `state.disclosure`, `DisclosureModel.atLeast()` as the primitive WP5/WP6 build on, and a
  bulk-assign modal reached from ASSIGN → Assign Player Disclosure. Modelled on
  `regions.js` throughout. **Save/load required no changes** — `io_manager.js` serialises
  hex states verbatim, so the field persists for free (verified, not assumed). Default is
  `'g'` so existing sectors are unaffected. 38/38 in-browser checks
  (`.tmp/html_export_harness/disclosure_check.js`), including a real Ctrl+Z undo; Obsidian
  guard 6/6 byte-identical. A screenshot caught a ragged-staircase layout bug that all 36
  prior checks passed — see 4.4. **Next: WP5.**
- **2026-08-03 (5)** — **WP5 slices 5a and 5b complete.** 5a: the field disclosure tag
  table and `filterBlocks()` in `export_core.js`, keyed on (context, label) because `Mass`,
  `Eccentricity` and `Orbit ID` genuinely differ between star and world. Fails closed, with
  every omission recorded so the harness can assert none exist; completeness proven over
  1979 bodies and 2620 moons. `Rings` and `Orbit (⌀)` were raised with Sean rather than
  defaulted; T5's role-labelled overview lines needed a per-block `lvl` override. 5b: both
  exporters wired, notes and level-0 systems suppressed, and **five non-block leaks** found
  and closed — including `data-uwp` on the root element and the map hotspot's SVG `<title>`,
  neither of which appears in rendered body copy. 24/24 + 40/40 in-browser; Obsidian guard
  6/6 byte-identical; all-engine 6/6. **The map PNG still leaks — that is WP6.**
  **Next: 5c (generic labels and filenames).**
- **2026-08-03 (6)** — **WP5 slice 5c complete.** Generic labels for worlds/moons (g),
  stars (d) and systems (d), falling back to the exporter's existing unnamed-body
  vocabulary so a withheld name is indistinguishable from an absent one. **Filenames are
  gated at the NAME, not separately** — the first attempt gave the filename helpers their
  own level and would have broken every Obsidian wikilink, since Obsidian resolves
  `[[Name]]` by name. A screenshot then found mainworld identification leaking three ways
  (`w.type` = literal 'Mainworld', a `<p class="tag">`, and a highlighted CSS class), none
  of them a field; the first fix for it missed the star section's own Type column. Leak
  check 40 → **54 assertions**, now including real-name sweeps over 38 systems / 1069 body
  names and link integrity at four levels. Obsidian guard 6/6 byte-identical; all-engine
  6/6; tags 24/24; WP4 model 38/38. **Next: 5d (image gating + orrery re-render).**
- **2026-08-03 (7)** — **WP5 slice 5d complete.** World images gated at (e), orreries at
  (d), and the orrery **re-rendered** below (g) with generic labels and no mainworld
  highlight — the one leak no filter can reach, since those labels are pixels.
  `SystemViewer.renderSnapshot` took an optional `{ level }`; the first attempt used two
  booleans and drew "Star A" at (d)-(f) while the page said "K0 V A", found by looking at
  the PNG. Passing the level instead makes image and page share ExportCore's display-name
  helpers, so they cannot diverge. Leak check 54 → **67**, including that the (d) orrery
  differs in bytes from GM and the (g) one matches it exactly. **Full 8-run Obsidian guard
  8/8 byte-identical**, both image-heavy runs included; all-engine 6/6; WP3 map checks
  pass. **Next: 5e (export-modal UI) — the last slice of WP5.**
- **2026-08-03 (8)** — **WP5 COMPLETE (slice 5e).** A VERSION dropdown in the existing
  Export Wiki modal (D6, one modal not two), applying to **both** formats — the Obsidian
  wiki gains fog of war for free, as 4.1 predicted. Referee is the default; the players'
  version is announced three ways (button label, `_PLAYERS` in the ZIP name, completion
  text) because sharing the wrong ZIP is unrecoverable. An amber warning names the
  **unfiltered map image** and its workaround — leave it until WP6. 17/17 through the real
  three-deep UI on a deliberately mixed-level subsector; exactly the level-0 systems
  produced no page. **Obsidian guard 8/8 byte-identical**; leak 67/67, tags 24/24, model
  38/38, all-engine 6/6, slice-2e UI checks pass. **Next: WP6 — the fogged map, the last
  real leak.**
- **2026-08-04** — **WP6 complete. RELEASE 2 COMPLETE.** `renderer.js` gained a per-hex
  disclosure gate (`setMapDisclosure`/`_mapShow`), installed by `captureSubsector` for one
  frame inside a try/finally; null for every normal call, so the on-screen map and referee
  export are untouched. Hexes at (0) are skipped entirely; gas giant at (c), name at (d),
  UWP/trade codes/starport/bases at (g). The **development view is gated too**, since
  `devView` is a toggle the capture inherits. **Corrected 5.2.1**: the leak was *not*
  toggle-dependent — the labels gate only on `zoom > 0.4` and `capZoom` is ~1.09
  regardless of the GM's zoom, so it was unconditional; there was never a setting that
  suppressed them. Leak check 67 → **77** with byte-comparison assertions mirroring the
  orrery's, plus a mixed-level map confirmed by eye. Obsidian guard **8/8**; WP3 map
  checks, all-engine 6/6, UI 17/17 all pass. The modal note was rewritten — it no longer
  warns about an unfiltered map, because there isn't one.
- **2026-08-04 (2)** — **Body-count leak fixed** (4.7). Reported by Sean: a players' export
  at (a) still carried one section per body — 45 on one fixture system — with every field
  filtered out but the section, heading, contents entry and anchor intact, so the number,
  ordering and type of every body leaked. In Obsidian it was one **file** per body. A
  straight miss: 5.2.2 had specified "not generated, not merely blanked" in plain words and
  slice 5b implemented only the page half. **Emptying a container is not withholding it.**
  Gas giant presence at (c) became a single `Gas Giants: Present` line, and the `Gas Giants`
  socio field was retagged (c)→(d) — it is a count, and the ladder grants only presence at
  (c). Writing `disclosure_obsidian_check.js` (new, 22 assertions — that exporter had never
  had its own check) immediately found two more hand-built leaks: `**Role:**`/`**Type:**` on
  star pages, and **YAML frontmatter** carrying `uwp`/`starport`/`tl`/`tradeCodes` — the
  Obsidian twin of the `data-uwp` leak. Leak check 77 → **85**. Guard 8/8.
- **2026-08-04 (3)** — **Player Disclosure grid added** (4.8). Sean's request: there was no
  way to see what each system was set to. New `js/disclosure_grid.js` — systems down the
  left, one **radio** per level across (not checkboxes, as proposed: a system has exactly
  one level, so checkboxes could express states the model cannot hold), live counts,
  sortable, searchable, bulk apply. Shortcut **D**. `js/disclosure.js` gained `isSet()`,
  `getRaw()` and `clear()` so a **never-set** system is distinguishable from one explicitly
  set to Full — `get()`'s contract deliberately unchanged, so no export output moved. Kept
  out of `hex_map.html` (two lines) and the working modules on request. A screenshot found
  the window opening on the **wrong subsector** while 24 assertions passed. 27 assertions.
- **2026-08-04 (4)** — **Numeric display rounding** (4.9). Sean's request. AoW stored raw
  floats, so an export read `5.980074992877245 M⊕`. New `ExportCore.fmtNum`. The rule is
  **at most two decimals but always at least two significant figures** — "never more than
  two decimal places" taken literally collapses eccentricity `0.0043` and a trace atmosphere
  to `0.00`. Both thresholds were wrong before real data corrected them; the second put
  **454 values in the 0.01–0.099 band off by more than 5%**, worst case 23.7%, which is why
  the rule extends to 0.1. Engine-side `toFixed` untouched — display only. Verified by a new
  field diff (`fieldvals.js`) over **67,052 values**: 3,677 changed, **0 collapsed to zero,
  0 distorted >5%**, field counts identical. Third and current re-baseline.
- **2026-08-04 (5)** — **Context-menu submenus clamped** (4.10, written up 2026-08-06).
  Assign Player Disclosure — last entry of the longest submenu — was unreachable on a short
  window. The existing `flip-up` remedy only moved the overflow to the top edge. Replaced
  with clamping into the viewport, plus two pre-existing listener bugs: a `{ once: true }`
  per-item listener that never re-evaluated on a second hover and accumulated on every
  opening, now one delegated listener attached at setup. 53 assertions across 4 viewports.
- **2026-08-06** — **All three directives audited against the code and brought up to date.**
  No code changed. `html_extract_manifest.md`: section 0 still said "Release 2 has not
  started and is blocked" and section 5.3 still called HX-1 the one blocker — both were
  ~three days stale; section 0 rewritten with line counts and wiring re-read from disk,
  0.3's standing rules restructured around the lessons Release 2 actually produced, new
  **3.4** (where the disclosure machinery lives), **4.10** (the previously undocumented
  submenu fix), **7.0** (the standing protocol) and **7.4** (the 19-script harness
  inventory); 5.2 and 5.6 marked as closed history with pointers; section 9 reduced to the
  two genuinely open items. `project_manifest.md`: header and section 0 refreshed, gate 3's
  line numbers corrected (drifted ~25 lines as `hex_map.html` gained the export dropdowns),
  and its own note that section 2 was stale retired — that cleanup had already happened.

  **One real defect found, in the documentation rather than the code.**
  `fog_of_war_field_tags.md` still declared itself "DRAFT AWAITING SEAN'S MARKUP / blocks
  WP5" three days after it became the implemented answer key. Diffing it mechanically
  against `FIELD_LEVELS` — 91 tagged labels vs 58 explicitly-levelled rows — found
  **`Gas Giants` tagged (c) in the table and `'d'` in the code**, divergent since the 4.7
  retag on 2026-08-04. The code was correct; the table was not. **The rule in 0.2 item 3
  had already been broken once, within two days of being written**, which is the argument
  for diffing the two rather than trusting either. Two further mismatches were correct
  behaviour — `Mass` and `Eccentricity` differ by context — and are now flagged in that
  file so the next audit does not "fix" them.

  **The 7.1 baseline was re-verified, not assumed.** `node export_runner.js check fast`
  reproduced **6/6 byte-identical** against `baseline_fmt_summary.json` — file counts and
  byte counts matching exactly, zero console errors — so the hashes a cold session is told
  to trust in 0.2 are known good as of this date, and the harness still runs.

- **2026-08-06 (2)** — **World-image seed unified (4.11).** Sean reported that world images
  in a players' export did not match the app. Diagnosed as **not a fog-of-war bug** — player
  mode changes only the image *filename*, so referee exports were equally affected, in both
  formats and all five engines. Root cause: the app seeded `PlanetRenderer` on the bare
  `hexId` while the exporters seeded on `` `${hexId}-w${wi}` ``, and that string determines
  every terrain layer. The obvious repair was **measured and rejected** — CT, T5 and RTT do
  not populate `sys.worlds` at all, so the accordion and the exporters share no index.
  Replaced with **`PlanetRenderer.imageSeed()`**, keyed on the body's name, verified unique
  within a system across 4599 bodies / 239 systems / 5 engines with zero duplicates. The
  new check immediately found a second bug: **RTT mainworlds matched 0 of 19**, because
  `rttData.name` is the system name while the body is `West Odessa VI`. Also fixed, for
  free: every body in a system had been sharing one heightmap in the app. `seedmatch_check.js`
  23/23 including a byte comparison per engine; **6 text runs byte-identical, only the 2
  image runs moved with identical file counts** — fourth deliberate re-baseline. Whole suite
  re-run green.

- **2026-08-06 (3)** — **Raw-body mis-pairing fixed (4.12).** Sean asked whether the image
  bug also explained physical characteristics disagreeing between the app and the export.
  **It did not** — a third, independent and more serious bug: `_findMgtRawWorld` matched on
  `orbitId` before name, and `orbitId` is **not unique** (co-orbital bodies share a slot),
  so `.find()` returned the first match and **14 of 688 MgT2E worlds printed their
  neighbour's mass, density, gravity, diameter, tilt, temperature and hydrographics** under
  their own name. Two moons resolved to null and one to the wrong moon as knock-on. MgT2E
  only; the other four finders match by name first. The app was always correct, which is
  precisely why the two disagreed. Fixed by matching name first — safe because names are
  unique within a system, the same measurement 4.11 rests on. After: 688/688 object
  identity, 0 null, 0 mismatch, moons clear. **The first field diff falsely reported "0 of
  67052 changed"** because `fieldvals.js` had never included subsector 1-E, where every
  affected system lives — tenth instance of a check measuring nothing, and the reason its
  `RUNS` list now covers 1-E. Real diff: **189 values changed, all in 1-E, 15 files**, and
  **exactly 1 of 8 export runs moved** with unchanged file counts. Fifth deliberate
  re-baseline. New `rawmatch_check.js`. Whole suite re-run green.

---

## 9. Consolidated Open Items

**Two open items as of 2026-08-06. Neither blocks anything; neither is a defect.**

| ID | Item | Needs | Blocks |
|---|---|---|---|
| **OPEN-1** | **In-app numeric rounding.** 4.9 covered the exporters only. World Details, the system viewer, the surface viewer and menus — roughly 350 sites — still print raw floats, so the app shows `5.980074992877245 M⊕` where the export now shows `5.98`. `ExportCore.fmtNum` is exported and ready to reuse; if wanted in-app it should move to `js/universal_math.js`, which loads before everything that needs it. **Parked deliberately** — Sean wanted to judge the exporter pass first. | Sean's call | nothing |
| **OPEN-2** | **Release housekeeping for v0.17.0.1.** `changelog.md` still reads `[v0.17.0.1] - In Progress` with six entries. Entry 1 ends "This release stores and edits the setting only — it does not yet change any export", which was true on 08-03 and is now contradicted by entries 2 and 4 in the same section. Reconcile and date it when the release is cut. See 9.1. | a release decision | nothing |

**Closed:**

- **CAVEAT** — ~~Records may not carry everything HTML needs~~ **CLOSED 2026-08-01 (slice
  2b)** — parity verified across all five engines, every page, plus 3294 UWP values
  exactly. No data loss.

- **HX-1a** — **CANCELLED 2026-08-03, do not do this work.** It existed only to support
  the input-inheritance rule for derived fields; Sean reversed that rule the same day, so
  nothing consults a derivation map. Started and stopped immediately; no findings
  produced, none needed. Reopen only if input-inheritance is ever reinstated — see §11.1a
  of the tagging table for the two traps that still apply if so.

- **HX-1** — **CLOSED 2026-08-03.** Every field, image, map element and index column now
  carries a level. Agreed with Sean across ~20 sequenced questions in one session; the
  answer key is §3.5 of `directives/fog_of_war_field_tags.md`, with §12 carrying the
  WP5 implementation checklist. **WP5 is unblocked, with nothing outstanding** — HX-1a
  was cancelled the same day when the derived-value rule was reversed.

- **HX-2** — worlds have **generic labels until (g)**. Answered 2026-08-03, see 5.3.
  Carries a filename consequence for world images at (e)/(f).
- **HX-3** — **per-system only**, no per-body override. Answered 2026-08-03, see 5.3.
  **WP4 is unblocked** and can start independently of HX-1.
- **HX-4** — **nothing is unconditionally visible.** Answered 2026-08-03, see 5.3. Sean
  rejected all four candidates; system name, hex, travel zone, allegiance and region are
  all ordinary gated fields. Do not reintroduce an always-visible set.
- **HX-5** — **no player-facing notes field.** Answered 2026-08-03, see 5.3.
- **Withheld vs absent** — **show nothing, no placeholder.** Answered 2026-08-03, see 5.3.
  This closes the "revisit for Release 2" note parked in 4.2.4.

- **Q1 — index table columns.** Decided 2026-08-01: **Hex, System, UWP, Starport, TL,
  Trade Codes, GG, Bases, Zone**, sorted by hex ascending, with empty columns dropped
  per subsector. Starport and TL are deliberate duplicates of UWP digits 1 and 9 —
  they exist so those values can be *sorted and filtered on*, not because the UWP
  lacks them. Gas Giant and Bases were added because they are the two operational
  facts **not** derivable from the UWP. Observed result: CT shows 7 columns (no bases
  or travel-zone data in that engine), T5 and RTT show all 9. To change: edit the
  `COLUMNS` array in `js/html_exporter.js`; nothing else depends on it.
- **HX-6** — RTT rich formatter was dead code. Fixed 2026-08-01, see 5.4.
- **HX-8 (partial)** — AoW rich body fields reached neither exporter. Safe subset fixed
  2026-08-01 (plumbing, 15 physical fields, socioeconomics, bases) — see 5.7. The
  ambiguous-unit and AoW-jargon fields remain deferred and are listed there; reopen only
  with a ruling from the Architect of Worlds manual.
- **HX-7.1** — RTT "None" values. Resolved 2026-08-01: **keep the explicit "None"**, so
  a rolled-and-genuinely-none value is never confused with a missing one. No code
  change; do not add a suppression guard later. See 5.5.
- **HX-7.2** — starports on every RTT body. Resolved 2026-08-01: **correct Rules As
  Written**, a consequence of the TL15 outpost formula rather than a code defect. No
  code change. The full rules rationale is in 5.5 — read it before touching anything
  that looks like it needs "fixing" here.
- **HX-9** — sticky index header hid the first system row, and never actually pinned.
  Fixed 2026-08-02, see 5.8. `.tw`'s `overflow-x` was the sticky scroll container.
  New harness check `html_check_stickyrow.js`; do not re-tune the `top` offset without
  running it.

### 9.1 Housekeeping not owned by this manifest

- ~~`changelog.md` / `README.md` have an **empty `[v0.17.0] - In Progress` section**.~~
  **DONE 2026-08-01**, and **v0.17.0 was dated 2026-08-03 with five entries.**
- **`[v0.17.0.1] - In Progress` — OPEN-2 in section 9.** Six entries are written and
  accurate individually, but entry 1 (the WP4 groundwork) still carries its
  "does not yet change any export" caveat, which entries 2 and 4 now contradict. It was
  written when WP4 shipped alone. Fold it into entry 2 or drop the caveat when the release
  is dated. `APP_VERSION`/`APP_BANNER` (`js/core.js:8-9`) already read `v0.17.0.1`; per
  `directives/update_version.md` the splash and shortcut-help screens in `hex_map.html`
  are the other two sites to check.
- ~~`directives/project_manifest.md` is stale — its section 2 "Next Update" still
  describes the v0.16.0 System Editor.~~ **RESOLVED.** Section 2 is now explicitly
  "System Editor — Design Reference (v0.16.x, delivered)", the document was condensed
  2026-08-01, and its section 0 was refreshed 2026-08-06. It remains the reference for
  resuming **RTT and AoW** editor support, which is paused, not abandoned.
