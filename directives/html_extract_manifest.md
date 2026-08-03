# HTML EXTRACT — Feature Manifest

**Version:** 0.17.0 (in progress)
**Status (2026-08-02): RELEASE 1 COMPLETE.** WP1, WP2 and WP3 all done and verified.
`js/html_exporter.js` ships, reachable from the real UI, verified on all five engines,
with a clickable subsector map. HX-6, HX-7.1/7.2, HX-8, HX-9 and Q1 all resolved.
**Next action: Release 2 (fog of war, WP4-6) — blocked on the questions in 5.3.**
**Architecture Standard:** The "Sean Protocol" (Directives -> Orchestration -> Execution)
**Related:** `directives/project_manifest.md` (main manifest), `js/export_core.js` (shared
core, new), `js/obsidian_exporter.js` (the model for this work)

---

## 0. RESUME HERE — cold-session handover

Last updated 2026-08-01, after **WP1, WP2, HX-6, HX-7, HX-8 and Q1**. Nothing is
half-finished; the tree is in a known-good, fully verified state. **No uncommitted work
in progress.**

### 0.1 Where things stand

- `js/export_core.js` (new, 955 lines) — shared, format-agnostic core.
- `js/obsidian_exporter.js` — 1235 -> 618 lines. Output byte-identical to pre-refactor
  **except AoW**, which legitimately gained fields via HX-8 (see 5.7).
- `js/html_exporter.js` (new, 897 lines) — **WP2 + WP3 complete**, reachable from the
  real UI via the Export Wiki modal's FORMAT dropdown. Verified on all five engines.
- `js/renderer.js` — `captureSubsector` gained an **opt-in** 5th argument
  (`opts.withTransform`) for the clickable map. Default behaviour unchanged.
- Version bumped to v0.17.0; changelog + README carry five v0.17.0 entries.
- **Release 1 is complete.** Nothing outstanding for it.
- Release 2 (fog of war, WP4-6) has not started and is blocked on the questions in 5.3.

### 0.2 First three things to do

1. **Read section 2** (locked decisions D1-D6) and **section 4.2** (the WP2 slice plan
   and what it built). Do not re-derive either; both were agreed with Sean.
2. **Confirm the tree is still good** before changing anything:
   ```
   cd .tmp/html_export_harness
   node export_runner.js check fast
   ```
   Compare the `sha256` values in `baseline_check/_summary.json` against
   `baseline_hx8_summary.json` (or the table in 7.1). Expect 6/6 match. If they do not
   match, something changed since the break — find out what before proceeding.
3. **Release 1 is finished — do not start Release 2 code yet.** WP4-6 are blocked on
   the five disclosure questions in 5.3, HX-1 above all (every emitted field needs a
   level assignment). Get those answered first; guessing at them is explicitly out of
   bounds. When they are answered, start at WP4 (the per-hex data model) per 4.
   The harness in `.tmp/html_export_harness/` has eight check scripts covering links,
   orphaned images, field parity, merge, theme/print, the real UI, map geometry, and
   index-header geometry — extend rather than rewrite.

### 0.3 Standing rules for this work

- **Every slice ends with the Obsidian suite at 8/8** against `baseline_hx8_summary.json`.
  Anything touching `export_core.js` can change Markdown output; if it does, that is a
  bug unless deliberately intended and re-baselined (as HX-6 and HX-8 were).
- **`node --check` is not verification** — see 7.2. Test in a real browser.
- **New output has no byte-diff safety net** — use the four substitutes in 7.3, plus the
  orphaned-image sweep added in 2a.
- **Look at the rendered result, not just green checks.** Twice in WP2 every automated
  check passed while the output was visibly wrong: 2c's scrolled-away table header and
  empty column, and 2d's duplicated "System Overview" heading. Screenshot or print the
  page.
- **The export UI is three interactions deep** — splash → cog → section header → button.
  See 4.2.7 before writing any UI test.
- **Do not "fix" the RTT starport/Outpost behaviour** — it is correct Rules As Written,
  see 5.5. Do not suppress RTT's `None` values either — 5.5 again.
- **Do not add the deferred AoW fields by guessing** their units or meaning — see 5.7.
- Zero-Assumption Policy applies to every Release 2 disclosure question in 5.3.

### 0.4 Read-me-first ordering

1. Section 2 — the six locked decisions. Do not re-litigate.
2. Section 4.2 — the WP2 plan and target output shape.
3. Section 4.0 — what WP1 actually did, and the one scope narrowing in slice 3.
4. Section 9 — consolidated open items and the standing caveat.
5. Section 7 — verification protocol and the harness location.

**Do not trust Section 3.1's line numbers** — they describe `obsidian_exporter.js` as it
was *before* WP1 and are kept only as a record of the original split. Section 3.2's line
numbers were re-verified post-WP1 and are current.

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

## 3. Codebase Facts (verified 2026-08-01)

Recorded so a cold session does not re-derive them.

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

### 3.2 UI wiring (re-verified 2026-08-01, post-WP1)

- `hex_map.html:83` — `js/export_core.js` script tag (**must precede** the exporter)
- `hex_map.html:84` — `js/obsidian_exporter.js` script tag
- `hex_map.html:1044` — menu button `#btn-export-obsidian` (becomes "Export Wiki" in WP2)
- `hex_map.html:1589` — modal `#obsidian-export-modal` (gains the FORMAT dropdown, D6)
- `js/io_manager.js:846` — `setupObsidianExport()`, ~130 lines of modal wiring
- `js/input_init.js:94` — called from init
- `js/io_manager.js:58` — `downloadBlob()`, shared download routine

### 3.3 Map capture is deterministic — clickable overlay is cheap

`captureSubsector()` at `js/renderer.js:1424` computes its own transform:
`baseHexSize` (1443), `capZoom` (1457), `capCamX`/`capCamY` (1458-1459), and grid
bounds `q0/q1/r0/r1` (1437-1440). If it optionally **returns** that transform alongside
the PNG, the exporter can compute every hex's polygon in output-pixel space and lay a
transparent SVG overlay over the image. No new coordinate math needed;
`pixelToHex()` at `js/core.js:225` confirms the math is already shared.

---

## 4. Work Packages

| # | Package | Status | Notes |
|---|---|---|---|
| **WP1** | `js/export_core.js` — extract format-agnostic code; convert `_format*` to structured `{label, value}` records | **DONE 2026-08-01** | 3 slices, 3 full-suite diffs, all 8/8 byte-identical. See 4.0. |
| **WP2** | `js/html_exporter.js` — GM version | **DONE 2026-08-01** | All five slices; 823 lines. See 4.2.3-4.2.7. |
| **WP3** | Clickable subsector map | **DONE 2026-08-01** | SVG overlay, geometry verified to 1e-13 px. See 4.3. **Release 1 complete.** |
| **WP4** | Disclosure data model | Release 2 | Per-hex level field, save/load in `io_manager.js`, bulk-set UI via existing `selectedHexes`. Export-agnostic. |
| **WP5** | Players' export + leak audit | Release 2 | Apply filter in core; gate pages, images, index, notes. |
| **WP6** | Fogged map rendering | Release 2 | `draw()` learns per-hex disclosure. Needs `renderer.js` surgery. |

WP4 and WP5 deliver a fogged **Obsidian** wiki for free, since the filter sits in the
shared core.

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

### 4.2 WP2 plan — THE NEXT THING TO BUILD

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

### 5.2 Leak audit — VERIFIED FINDINGS

These are the reason a players' export cannot be built by filtering page bodies alone.

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

There is no filter hook in `draw()`. Worse, the export inherits whatever display toggles
the GM had switched on at export time, so the leak is **nondeterministic**. This is WP6.

**5.2.2 Filenames leak.** A folder containing `Regina - Prometheus (1910).html` tells a
player Prometheus exists even if the page says "no data". At levels (a)-(d), pages and
sections must **not be generated**, not merely blanked. D2 (sections not files) reduces
but does not eliminate this — the sector/subsector index tables leak the same way.

**5.2.3 World images leak visually.** A rendered planet is a picture of its
hydrographics and atmosphere. Images must be gated at **(e)+** regardless of the
"include world images" checkbox. Orrery snapshots reveal world count, belts and gas
giants — gate at **(d)+**.

**5.2.4 Referee notes must never export.** `state.notes` lands on the system hub and
every mainworld page. Since WP1 slice 3 this is `ExportCore.notesBlocks()`
(`js/export_core.js:318`) — a single shared chokepoint, which is where the Release 2
gate should go. Called from two sites in `obsidian_exporter.js`; `html_exporter.js` will
be a third.

### 5.3 Release 2 open questions — NOT YET ANSWERED

Deliberately deferred on 2026-08-01 so Release 1 could start. Do not guess at these.

- **HX-1** — Every emitted field needs a level assignment (gravity, density, axial tilt,
  orbital period, composition, taints, habitability, RU, WTN, government profile,
  cultural quirks, ...). Sean was offered a draft tagging table for markup; not yet
  produced or agreed.
- **HX-2** — Do worlds have **names** before they have stats? At (e) each world gets
  Size/Hydro/Atm — are names revealed too, or "World 1, World 2"? A name arguably reveals
  more than a stat, as it implies someone has been there.
- **HX-3** — Is the level per-system only, or can the GM override per-body? Per-system is
  assumed (matches how Sean described it) but unconfirmed. Affects WP4's data model.
- **HX-4** — Which fields are always visible regardless of level? Assumed: system name,
  hex, travel zone (the point of an Amber zone is that travellers know). Allegiance
  unconfirmed.
- **HX-5** — Is a separate **player-facing notes** field wanted, distinct from GM notes
  and always exported? Cheap now, awkward to retrofit.

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

**Baseline recaptured**: `baseline_hx8_summary.json` supersedes the HX-6 one; only
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

### 5.6 Baseline note

The post-HX-6 output is the current reference. Its hashes are recorded in 7.1 and in
`.tmp/html_export_harness/baseline_hx8_summary.json`. It differs from the pre-HX-6
baseline **only** in `05_rtt`; the other seven runs were unaffected by the fix.

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

**WP1 modifies a working file.** It requires proof, not assurance.

1. **Before touching any code**, export 2-3 subsectors and keep the ZIPs. Cover
   different editions; include at least one lunar mainworld and one multi-star system.
2. After the refactor, re-export the same subsectors with the same options and diff
   **byte-for-byte**. Any difference is a bug, not an improvement, and is fixed before
   WP2 starts.
3. **Caveat:** the diff proves the *markdown* is unchanged. It does **not** prove the
   structured records carry everything the HTML renderer needs — the markdown renderer
   could quietly drop a field HTML wants. Catch this in WP2 by spot-checking a system's
   HTML page against its markdown twin for field parity.

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
| `baseline_hx8_summary.json` | The reference hashes (the ZIPs themselves were not kept — 109 MB) |

**To verify nothing has changed:**

```
cd .tmp/html_export_harness
node export_runner.js check          # or: node export_runner.js check fast
```

then compare each run's `sha256` in `baseline_check/_summary.json` against
`baseline_hx8_summary.json`. `fast` skips the two image-heavy runs (~4 min saved) and is
for iteration only — **the full 8 are required before calling a slice done**.

**Reference hashes (post-WP1, post-HX-6, post-HX-8 — the current correct output):**

| Run | Files | Bytes | SHA-256 |
|---|---|---|---|
| `01_mgt2e_real_images` | 1307 | 24636912 | `d7776e6da43712b1d6013617032a0241aca474866e94e7c92a624a32a15a7c70` |
| `02_mgt2e_real_nosub` | 1193 | 1856566 | `0d5eea51abfc7ee368495791821f6b88c7213bf0d615619c6219a571ed2d82c7` |
| `03_ct` | 1054 | 1377939 | `46e5ec7f4d8789a36a75356b1f10ebf9383a818528b9b58e2c4d9a8d651aefa5` |
| `04_t5` | 906 | 1299370 | `03360de8e8c1e3a246f2c2f6b006d789a223e812fd6ebba3c51588eacd7deaec` |
| `05_rtt` | 566 | 877887 | `28ca7a184c3da26ece3833f021ad6444c1bb224e44c86eb17b75b27326315d47` |
| `06_aow` | 594 | 1043119 | `84b313eceb7e04fc0c70e97843f47589c05a58e15f0907431dc85bbc04d93845` |
| `07_mgt2e_gen_mercator` | 1217 | 82918743 | `eebc457aad1451b2d1e90fab00703d05bf49fefaa832c62d18a9dacba98abd53` |
| `08_uwponly_stub` | 42 | 256350 | `a5b886a461cd2c8416e1c58f10499fc17df8f4a9882be842cc469e55654f8034` |

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

### 7.3 WP2 has no byte-diff — how to verify it instead

Every WP1 slice could lean on "output must not change". WP2 *creates* output, so that
safety net is gone. Replace it with:

1. **Field parity against the Markdown twin.** For a sample system in each of the five
   engines, extract every `label: value` pair from the HTML page and from the
   corresponding Markdown page(s), and diff the sets. This is the check that catches the
   standing caveat — a field the Markdown renderer happened to use but the HTML renderer
   drops, or vice versa.
2. **Regression guard on Obsidian.** WP2 touches `export_core.js`, so re-run the full
   8-run suite against `baseline_hx6/` and require 8/8 byte-identical. Any change to the
   Markdown output during WP2 is a bug.
3. **Actually open the pages.** Load the generated `index.html` from `file://` in a real
   browser and confirm: no console errors, images resolve, every internal link resolves
   (no 404s), the theme toggle works both ways, and the page does not scroll
   horizontally. Broken relative paths render as a *silently* missing image — see
   section 6.
4. **Link integrity sweep.** Parse every `href`/`src` in the generated ZIP and assert the
   target exists as a ZIP entry. Cheap, and catches the D3 merge-layout mistakes that
   are invisible on a single-subsector export.

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

---

## 9. Consolidated Open Items

Nothing here is a blocker for WP2 unless marked. Ordered by when it needs answering.

| ID | Item | Needs | Blocks |
|---|---|---|---|
| **CAVEAT** | ~~Records may not carry everything HTML needs~~ **CLOSED 2026-08-01 (slice 2b)** — parity verified across all five engines, every page, plus 3294 UWP values exactly. No data loss | — | — |
| **HX-3** | Disclosure level per-system, or per-body override? | Sean | **WP4** data model |
| **HX-2** | Do worlds have names before they have stats? | Sean | WP5 |
| **HX-4** | Which fields are always visible regardless of level? | Sean | WP5 |
| **HX-5** | Separate player-facing notes field, distinct from GM notes? | Sean — cheap now, awkward later | WP4/WP5 |
| **HX-1** | Every emitted field needs a disclosure-level assignment (100+ fields) | Sean to mark up a draft tagging table | **WP5** — the largest single unknown |

**Closed:**

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
  **DONE 2026-08-01** — two entries added to both files: item 1 the RTT fix (HX-6,
  user-visible), item 2 the WP1 shared-core refactor (marked "internal cleanup, no
  behavior change", matching the v0.16.2.0 convention). Add WP2/WP3 entries as they land.
- `directives/project_manifest.md` is stale — its section 2 "Next Update" still
  describes the v0.16.0 System Editor. Sean has acknowledged this and deferred the
  cleanup; not in scope here.
