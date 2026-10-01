# SYSTEM SHEET — SPECIFICATION (AS BUILT)

**Status (2026-09-25):** v0.18.1.1, open (moved from v0.18.1 by Sean, 2026-09-24). **R1–R8 and every follow-on ruling below are BUILT
and verified.** **Sean's gallery review passed 2026-09-24** (§8) — the sheet is accepted. **The
exporter wiring is built and verified by exporting** (2026-09-25, §9).

**This document is the contract for `js/system_sheet.js`.** `project_manifest.md` §0.0.B
carries the standing traps and the design history that still binds; **this document does not
repeat it.** Every ruling here is Sean's — do not re-litigate one without asking him.

---

## 1. WHAT THE SHEET IS

`SystemSheet.render(state, hexId, opts)` returns a canvas; `SystemSheet.download(state, hexId)`
saves it as PNG; `SystemSheet.open(state, hexId)` shows it in a pop-up (`isOpen()`, `close()`). Layout is **1720x878 LOGICAL units through a scale transform**, default
scale 2. **Change `SCALE`, never the layout numbers.**

**The page height FITS ITS CONTENT (D2).** Layout is computed on the full 878 so a dense
sheet's capacity is unchanged, then `_finish()` crops the canvas to just below the lowest panel
and draws the footer there. A full sheet with satellites is 3440x1756; Bermarmi (1 body) is
3440x1404; a stars-only sheet ~3440x880.

Reached from a **System Sheet** button in the orrery toolbar (`system_viewer.js`, guarded on
`window.SystemSheet`). The button opens **a pop-up** styled like the world image panel: the
full-resolution canvas shrunk by CSS to fit, **Download PNG** (saves that same canvas, not a
re-render) and **Close**; Esc and a backdrop click close it, and the orrery's own Esc handler
defers to `SystemSheet.isOpen()` so the orrery stays open (Sean, 2026-09-24). **The sheet is
also in the HTML and Obsidian exports** (built 2026-09-25), see §9. The footer prints no version, deliberately (Sean, 2026-09-24).

The data source is **`SystemViewer.normalizeSystem(state)`**, not the block model: the sheet
needs `gravity` as a NUMBER to size a disc and sort a column, and blocks are pre-formatted
label/value pairs. **The block-model ruling still governs "world on a page".**

**THE SHEET DRAWS FROM DISPLAY COPIES — `displayBodies(nsys)`.** Every presentation rule
(R4, R8, the CT placeholders) nulls fields on COPIES of the normalised bodies, never on the
originals, so nothing the sheet suppresses can leak into the orrery or the exporters that share
`normalizeSystem`. A new suppression rule belongs in `displayBodies`, not in a panel.

---

## 2. THE CORPUS — six sectors

| File | Engine | Sheets | Shape |
|---|---|---|---|
| `sectors/solo_6.json` | MgT2E | 438 | full (plus 3,119 bare stubs, no sheet) |
| `.tmp/ct_bu.json` | CT | 659 | full |
| `.tmp/t5_top_down.json` | T5 | 659 | full |
| `.tmp/rtt_bu.json` | RTT | 659 | 598 full, **61 stars-only** |
| `.tmp/aow_bu.json` | AoW | 659 | 625 full, **34 stars-only** |
| `.tmp/spinward marches.json` | T5 (TravellerMap import) | 439 | **439 reduced** |

**3,513 sheets; all render with zero exceptions** (`system_sheet_sweep.js`, 2026-09-24).
`.tmp/` is gitignored — **if these files are gone, ask Sean for them again.**

Body counts: MgT2E max 16, CT 20, T5 18, RTT 18, **AoW median 13, max 32** — AoW alone
exceeds one table column (48 sheets use R6's two-column table).

### 2.1 FOUR SHAPES OF HEX — each has its own answer

1. **Full** — a charted system. The sheet as designed.
2. **Reduced (R5)** — real stars and a UWP-bearing mainworld, no orbits. Every Spinward hex.
3. **Stars-only** — real stars, no world of any kind: RTT's `X000000-0` stellar-only systems,
   AoW's barren-system stubs. **Sean, 2026-09-23: an empty star system is real data** — it gets
   a sheet that says so, not a refusal and not a hollow one.
4. **Bare stub** — no system at all (solo_6's 3,119). `render()` returns **null** and the
   button refuses. **`null` now means only "no world here at all".**

---

## 3. THE NORMALISER — the facts that bind

**`_normalizeMgT2E` inherits the whole raw system (`Object.assign({}, sys, …)`); the other four
return a fresh literal.** So any top-level field beyond `edition, age, hzAU, stars, worlds` is
MgT2E-only by construction — the root cause of most defects this release fixed. Read a field
from the RAW save before concluding an engine lacks it (§6.2).

**The `invented` list (R4).** Normalisers keep their defaults (`mass || 1`, `age || 0`,
synthesised RTT AU, CT's 100 K, CT's 'G' zone) because the ORRERY needs numbers to animate — but
list the defaulted field names in `invented`: top-level (`age`, RTT `au`), per star
(`mass`/`diam`/`lum`, RTT companion `orbitAU`) and per body (CT `meanTempK`, `travelZone`). The
sheet prints a dash for anything listed. **A new default in a normaliser must be listed.**

**Field wiring done this release** (`system_viewer.js`), each checked against the raw save:

| Engine | Raw field | Normalised | Note |
|---|---|---|---|
| CT | `temperature` (K) | `meanTempK` | Sean ruled; changes ~69% of CT world-image palettes in exports — accepted |
| CT | `orbitalPeriod` (years) | `periodYears` | verified against Kepler |
| T5 | `orbitId` | `orbitId` | was hardcoded null |
| RTT | `diameter` | `diamKm` | **numbers only** — Jovians store `"Variable (Giant)"` |
| RTT | `composition` | `composition` | worlds and moons |
| RTT moons | starport/size/… | `uwp` | same construction as planets |
| RTT moons | `bases` Z | `travelZone` Red | was hardcoded 'G' — hid 12 Red lunar mainworlds |
| AoW | `orbitalPeriod` (HOURS) | `periodYears` = ÷ 8770 | the engine's own constant; `localYear` is local days — never use it |
| AoW | `worldClass` | `composition` | **null for gas giants and belts** (their class is a fall-through "Luna-type") |

`normalizeSystem` also attaches **`reportedMainworld`** and **`reported`** counts to a hex with
no bodies and a UWP-bearing raw mainworld (CT and T5 only). `worlds` stays empty, so the
orrery and exporters see nothing new.

---

## 4. REQUIREMENTS R1–R8 — ALL BUILT

| | Ruling | How it is built | Checked by |
|---|---|---|---|
| **R1** | Title from `nsys.name`, `state.name`, raw system `name`, mainworld, hexId — never "UNNAMED" | `resolveSystemName()`, also names the download | verify: 0 bad titles, per-source counts |
| **R2** | Drop a column no body on the sheet has; reflow; drop the legend with Band | `tableLayout()`; Composition kept by FIELD, not by the "Belt" fallback cell | verify: 0 all-dash columns |
| **R3** | Wire the plain field-name bugs | §3 table | coverage harness |
| **R4** | No invented value printed as fact | the `invented` list + `displayBodies`; RTT strip is ordinal with no AU labels; RTT companions named by separation word | verify: raw-save check, with examined counts |
| **R5** | Reduced sheet | `reduced` mode: no strip, brief spans centre+right, "System Data — Reported", one table row, Travel Zone row, "Satellites not charted" omitted per D2 | verify: 439 reduced, 0 without UWP |
| **R6** | Two-column table past one column's capacity | `splitCols`; pitch from rows PER COLUMN; `fixed` columns (gutter, #) never scaled; short headers when a label won't fit | verify: 0 rows that do not fit, 48 split |
| **R7** | **No band fallback for T5/RTT** — mapping `climateZone`/`zone` onto Kelvin bands is interpretation | nothing drawn | — |
| **R8** | Non-numeric gravity is a dash | `displayBodies` | verify: 0 non-numeric cells |

---

## 5. FURTHER RULINGS — Sean, 2026-09-23/24. All built.

1. **CT temperature** wired (§3). Exports/sheet now agree with the in-app body viewer.
2. **AoW year and class** wired (§3), class dashed for gas giants and belts.
3. **RTT moon UWPs** built with the planet construction.
4. **CT's fixed 100 K on gas giants and belts is a PLACEHOLDER** — flagged invented, printed as a
   dash with no band. (A belt MAINWORLD is typed 'Mainworld' and gets a real calculation.)
5. **D1 — T5 companions are NEVER placed from an `orbitID`.** `orbitToAU` reads MgT2E's table and
   is not assumed valid for T5. Placed only from a recorded `distAU`; otherwise named by role.
6. **Stars-only sheet** (§2.1).
7. **Liquid row only when recorded.** Only MgT2E records `liquidType`; the old `|| 'None'` told
   every T5 world it was dry.
8. **T5 socio line** (Importance, Economic, Cultural, RU) on **T5 sheets only**, full and reduced.
   solo_6 (MgT2E) also carries `t5Socio` on every hex — never print it there.
9. **CT mainworld image button** (`hex_editor.js` `openWorldImagePanel`) reads CT `temperature`,
   scoped to `ctData`. All four views of a CT world now agree.
10. **Orrery tooltip** prints a string gravity as stored ("Variable (Giant)") — it used to throw.
11. **D2 — sparse sheets:** page fits content; **no empty panels** (no Satellites panel when the
    system has none); **a lone body is a 150 px hero disc.**
12. **Crowded strips label what fits:** "0.72 AU" → staggered → bare "0.72" → every other label;
    a name that would truncate is omitted (6 px air required); **"Mainworld" is always drawn in
    full** and neighbouring names are cleared for it. Sheets up to ~16 bodies are unchanged.
13. **Two-column table drops the Band TEXT** — the gutter dot carries it — and gives its width to
    Composition.
14. **Mainworld Data has no dash rows.** UWP and Trade Codes always stay.
15. **The brief's "Zone" is the TRAVEL zone**, Amber/Red in colour, by the project convention
    (`ExportCore.travelZone`, the editor's `_normTz`): anything recorded that is not Red or Amber
    is Green, including MgT2E's legacy "-". CT records none → dash. The temperature band is
    stated in the brief's temperature line.
16. **D3 — the sheet ships in-app first** (a pop-up with a PNG download), exporters second.
    Both are in v0.18.1.1 — Sean moved the exporter wiring and PNG vs JPEG there from v0.18.2
    on 2026-09-24. Exporters built 2026-09-25 (§9).

---

## 6. STANDING RULES — each paid for more than once

### 6.1 NO PANEL MAY DROP A ROW SILENTLY

Any panel with a variable number of rows must **derive its pitch from the count**, and no row
loop may stop without announcing it. Four panels had this defect, two introduced while fixing
the first. When a drop is unavoidable, **give up a row slot to the warning** — it used to be
drawn over the last row it was warning about.

### 6.2 VERIFY AGAINST THE RAW SAVE, NOT THE NORMALISED OUTPUT

Field names lie (`totalWorlds` read 960 for a system of 8; RTT `diameter` was read as `diamKm`;
AoW `orbitalPeriod` is hours). **Check units in the engine source before wiring a field.**

### 6.3 EXTREMES, NOT SAMPLES — AND EVERY SHAPE

The gallery picks by extreme. **It also had a blind spot until 2026-09-24:** it only censused
hexes with bodies, so it rendered ZERO Spinward sheets. A coverage gap is a missing SHAPE, not a
missing assertion.

### 6.4 ONLY RENDERING PROVES A SHEET CAN BE DRAWN

After R3 wired RTT `diameter`, **every assertion in `system_sheet_verify.js` passed and the sheet
crashed** (a string reached `createRadialGradient` as NaN). The verifier checks what the sheet
WOULD print; `system_sheet_sweep.js` renders every hex. **Run both after any change.**

### 6.5 AN IMAGE CAN ONLY BE WITHHELD BY NOT GENERATING IT

`filterBlocks()` cannot see inside a PNG. This is the whole of the exporter job (§9).

### 6.6 ENGINE DETECTION IS PRIORITY-BASED — latent risk

Saves carry shells for all five engines; `_detectSystem` picks **AoW > MgT2E > CT > T5 > RTT**
on `stars.length > 0`. If an empty shell ever acquired a star, a sector would chart as the wrong
engine. Not a live defect today.

---

## 7. THE HARNESSES — `utilities/`. PASS THE SECTOR PATH.

| File | What it does |
|---|---|
| `system_sheet_verify.js` | Corpus assertions: R1 titles, R2 no all-dash column, R8 no text in a number cell, R4 raw-save `invented` check (reports how many it examined), R5 reduced/stars-only counts, R6 capacity. **Every line should read PASS or a count.** |
| `system_sheet_sweep.js` | **Renders every hex** in one or more sectors at scale 0.2 and reports exceptions. 1–2 min a sector. |
| `system_sheet_gallery.js` | Censuses, then renders by extreme **including reduced and stars-only picks**. Writes to `.tmp/galleries/<sector>/`. |
| `system_sheet_coverage.js` | Per-engine field coverage of `normalizeSystem`. Several sectors per run. |
| `system_sheet_shoot.js` | Renders named hexes to `.tmp/_sheet_out/`. |
| `system_sheet_binary.js` | Both companion branches, by stripping/injecting `orbitId` (MgT2E). |
| `system_sheet_export_check.js` | **Exports** (HTML + Obsidian, GM and levels g/f/d/c) five one-hex cases and reads the ZIP: sheet JPEG 3440 wide at GM/(g), 900x500 orrery PNG at (d)–(f), nothing at (c), every embedded image present. No sector argument — the cases name their own. Also asserts the HTML sheet links to itself at full size. **Failed 20/181 before the wiring, as intended** (2026-09-24); **191/191 after** (2026-09-25). |

Run from the repo root, e.g. `node utilities/system_sheet_verify.js "$PWD/.tmp/aow_bu.json"`.
**`fetch` is blocked on `file://`** — harnesses inject the sector in 2,000-hex chunks; do not
"fix" that. **Renders go to `.tmp/`, never `utilities/`** (not gitignored). Launch with
`--disable-gpu`.

---

## 8. ACCEPTANCE

Done and passing 2026-09-24, all six sectors: coverage run; verify with zero FAILs; sweep with
zero exceptions over 3,513 sheets; no "UNNAMED" title; no all-dash column; no invented value
(raw-checked); 439 reduced sheets; AoW 32 rows with no warning.

**DONE 2026-09-24: Sean reviewed sheets in `.tmp/galleries/` by hand — "looking good"** (109 sheets:
`solo_6`, `ct_bu`, `t5_top_down`, `rtt_bu`, `aow_bu`, `spinward_marches`). The AoW overflow was
invisible to every assertion and obvious in the image within a second — this gate is not a
formality.

---

## 9. THE SHEET IN THE EXPORTERS — built 2026-09-25

**Which image, by level (Sean, 2026-09-24):**

| Export | System image |
|---|---|
| GM, or player at **(g)** | **the sheet** — `ExportCore.renderSystemSheet(state, hexId)` |
| player at **(d)–(f)** | the existing level-aware 900x500 orrery (`SystemViewer.renderSnapshot(…, { level })`) |
| player below (d) | none |

**Why (g) only (§6.5):** the sheet names every body, prints UWPs and (e)/(f) columns, and has
whole panels that single out the mainworld. Audited panel by panel: everything on it is at or
below (g) and nothing is `never` (no bases, no referee notes) — so at (g) it is exactly right,
and below (g) it cannot be shown. A level-aware sheet was offered and declined. **Do not pass a
level into `SystemSheet.render` to "fix" this without asking Sean** — it would duplicate
`FIELD_LEVELS` by hand, in pixels, where no filter or parity check can see it.

**Built as:**

* **`ExportCore.renderSystemSheet`** is the one render path for both exporters. **JPEG 0.85 at
  scale 2** (`SHEET_EXPORT`), filename `.jpg`. Measured on 27 sheets across all six sectors:
  mean 303 KB vs 819 KB as PNG (max 512 vs 1207), no visible loss at 6x zoom; scale 1 JPEG rang
  round text. Exports only — the in-app download stays full-resolution PNG. World images and
  regional survey sheets stay PNG (Sean: sheet only).
* **The caller gates it** at `_show(level, 'g')` inside the existing `(d)` gate, in
  `html_exporter.js` and `obsidian_exporter.js`. If the sheet fails to render at (g) the
  orrery is drawn instead (safe: at (g) everything it shows is disclosed).
* **HTML:** caption "`<System>` system sheet" (orrery keeps "orrery"); the sheet is wrapped in a
  link to itself, opening full size in a new tab — 3440 px in a ~926 px column is unreadable
  (Sean, 2026-09-25). Obsidian already opens an image on click.
* Export dialog checkbox reads "Include system images (system sheet / orrery)"; the players'
  help text says the full sheet appears only at Full UWP.
* **Render cost:** ~0.2–1.6 s a sheet at scale 2 (one outlier 3.4 s).

**Verified by exporting** — `utilities/system_sheet_export_check.js`, 191/191 (§7), after
failing 20/181 against the unwired code. The Release 2 scratch harness
`.tmp/html_export_harness/disclosure_leak_check.js` had two assertions that assumed the GM
image was an orrery PNG; they were re-pointed, not dropped: the (d) orrery is now compared
against an un-levelled orrery rendered in-page (still differs: re-render proven), and the GM
control counts sheets and asserts no orrery.

### 9.1 Sheet, orrery or both — built 2026-10-01

The dialog checkbox became a **System images** dropdown (`#obs-system-images`), passed to both
exporters as `options.systemImages`:

| Choice | GM / (g) | (d)–(f) | below (d) |
|---|---|---|---|
| **System sheet** (default) | sheet | orrery | none |
| **Orrery** | orrery | orrery | none |
| **System sheet and orrery** | sheet, then orrery | orrery | none |
| **None** | none | none | none |

* **The choice can only REMOVE an image** — it never moves the (d) or (g) gate. Below (g),
  *Sheet* and *Both* fall back to the level-aware orrery, exactly as before. A sheet that fails
  to render falls back to the orrery under any choice except *Orrery*/*None*.
* **One decision path:** `ExportCore.renderSystemImages(state, hexId, { mode, sheetAllowed,
  level, systemName, hexCode })` returns the images in page order; both exporters only embed
  them. `ExportCore.systemImageMode(options)` normalises the option; the legacy boolean
  `includeSystemImages: true` still means *sheet* (the harnesses use it).
* **The orrery file is `<System> (<hex>) Orrery.png`** (`ExportCore.orreryFilename`) at every
  level, so it can never share a stem with the sheet's `<System> (<hex>).jpg`. It deliberately
  has **no `" - "`**: that separator marks a body image, and `disclosure_leak_check.js` tells
  orreries from world images by it.
* HTML: each image is its own figure; the sheet keeps its full-size link and "system sheet"
  caption, the orrery keeps "orrery". Obsidian: one `![[…]]` per image on the hub page.
* **Verified by exporting:** `system_sheet_export_check.js` now runs every choice at every
  level (plus the legacy boolean at GM and (d)) and asserts the image set, the page order and
  the captions — 1256/1256. `disclosure_leak_check.js` (dCode regex re-pointed to the new
  orrery name) 86/86. The dialog was driven in-browser: default *System sheet*, and the
  selected value reaches both exporters.

Known cosmetic residue, accepted: AoW's longest class "Class 2 (Dulcinea-type)" clips in the
two-column table; long trade-code strings clip in the narrow Mainworld Data panel (the brief
carries them in full).
