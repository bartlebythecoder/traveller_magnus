# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project Overview

**"As Above, So Below"** is a browser-based hex map tool that generates star systems for five
Traveller-family rule sets: Classic Traveller (**CT**), Mongoose Traveller 2nd Edition
(**MgT2E**), Traveller 5 (**T5**), Revised Traveller (**RTT**) and Architect of Worlds (**AoW**).
It is a single page, `hex_map.html`, running vanilla JavaScript: no framework, no bundler, no
build step.

**Start every session with `directives/project_manifest.md` §0.0.D.** It is the live handoff:
what the current release holds, what is left to do, and the rulings Sean has already made. Those
rulings are settled. Don't re-derive them or reopen them.

## The Sean Protocol

1. **`rules/` is read-only.** Everything in it (the `*_data.js` tables and the guideline `.md`
   files) is the authoritative RPG source. Sean sometimes grants a one-time edit. It covers
   that one change only.
2. **Zero-Assumption Policy.** Don't fill in Traveller rules from training data, even when you
   are confident. Editions differ in small ways and the code must follow *these* tables. If a
   rule is missing or ambiguous in `rules/`, it is a question for Sean.
   *Where the line is:* a question about what the game says (a die roll, a result of 0 or less,
   who gets a trade code) goes to Sean. An engineering choice that invents no game fact doesn't,
   for example a display-only stand-in such as the orrery's `drawPd` or `drawMass`, which is
   never printed or exported.
3. **Halt & Challenge.** When you hit a rules ambiguity, stop work on that path and put one
   specific question to Sean. Ask questions **one at a time**, never buried in a long reply.
   Record his answer in the manifest (§0.0.D) so it's never asked again.
4. **Extend before you create.** Check `js/` for an existing module before adding a file.
5. **No git at all.** Don't run any git command, not even `status`, `log` or `diff`. Sean does
   all staging and committing by hand. To know what is committed, ask him.

## Running and Verifying

- **Run:** serve the folder over HTTP and open `hex_map.html`.
  `.claude/launch.json` defines `hex-map` (`python -m http.server 8765`). The Claude browser
  pane shows `file://` pages as a static snapshot with **no scripts running**, so it is useless
  for testing.
- **There are no build, lint or unit-test commands, so verify in the running app.**
  `node --check` only proves the syntax is valid. Several shipped bugs passed it and were caught
  only in the browser. Drive the page from JS in the browser pane, or with Playwright (it's in
  `node_modules`).
- **Prove a new check can fail.** Switch the fix off for one run (with the Edit tool, not
  `sed`), confirm the check fails, then switch the fix back on.
- **Test exporters by exporting**, and check the export dialog's defaults first. For example,
  "Skip airless worlds" is ticked by default.
- Generated maps are deterministic. `reseedForHex(hexId)` reseeds the `mulberry32` RNG from
  `masterSeed`, so the same hex and seed must always produce the same system. Never keep a
  load-time copy of `rng`.

## Architecture

- `rules/`: read-only RPG data and guidelines (see rule 1).
- `directives/`: SOPs and specs. `project_manifest.md` is the handoff (see above).
- `js/`: the deterministic generation engines and the UI. `js/archive/` is dead code; don't
  extend it.
- `utilities/`: one-off PowerShell converters and repair scripts. `names.js` is produced by
  `utilities/convert_names.ps1`.

**Load order:** the `<script>` tags in `hex_map.html` are the source of truth. Files share
globals rather than imports, so a new file must be added there after everything it depends
on. Each edition's `rules/*_data.js` loads before that edition's engines.

**Per-edition modules** (names vary; check `js/`):

| Edition | Main files |
|---|---|
| CT | `ct_stellar_engine`, `ct_world_engine`, `ct_social_engine`, `ct_physical_library`, `ct_topdown_generator`, `ct_bottomup_generator`, `ct_uwp_auditor`, `ct_system_driver` |
| MgT2E | `mgt2e_stellar_engine`, `mgt2e_world_engine`, `mgt2e_socio_engine`, `mgt2e_math`, `mgt2e_topdown_generator`, `mgt2e_bottomup_generator`, `mgt2e_uwp_auditor` |
| T5 | `t5_stellar_engine`, `t5_world_engine`, `t5_socio_engine`, `t5_topdown_generator` (top-down only), `t5_uwp_auditor` |
| RTT | `rtt_engine` (one file) |
| AoW | `aow_stellar_engine`, `aow_world_engine`, `aow_bottomup_generator`, `aow_uwp_auditor`, `aow_seed_bridge` |

Each edition also has an `*_editor_adapter.js` for the System Editor (`system_editor.js`).
`system_driver.js` routes CT and T5 generation. Shared views: `system_viewer.js` (orrery),
`system_sheet.js`, `planet_renderer.js` and the `terrain_*` modules. Exports go through
`export_core.js` → `html_exporter.js` / `obsidian_exporter.js`.

**Key global state** (`js/core.js`): `hexStates` (a Map of hexId → state), `selectedHexes`
(a Set), `masterSeed`/`rng`, `window.sectorRoutes`, `window.activeFilterRules`.

## Known Traps

- **Identify a body by its name.** `orbitId` is not unique, and list indexes differ between
  engines. Both mistakes have shipped export bugs.
- **An empty hex has three shapes:** no entry, `BLANK`, or `EMPTY`. Use `isVacantHex()`, not
  `type === 'EMPTY'`.
- **Old saves omit fields.** Test with `!= null`, never `!== null`/`!== undefined`.
- **A blank accordion means a thrown error, not missing data.** Stale fields left over from the
  previous hex are the giveaway. Check the console.
- **Seeded and manually added bodies tend to skip generation steps.** When something is fixed
  for generated bodies, check bodies added in the System Editor too.
- **World images are derived, not stored.** Changing any renderer input redraws every existing
  world. See the field-versioning rules in the manifest §0.0.A.
- Never set `overflow` on `#context-menu`, because it clips the submenus.

## Conventions

- **Trace logging:** every significant generation step logs through `tSection("…")`,
  `tResult("label", value)` or `writeLogLine(text)` (all in `core.js`), gated on
  `window.isLoggingEnabled`.
- **Line endings:** the repo is **CRLF** throughout. `sed -i` in Git Bash silently rewrites a
  file as LF. After editing, check that `tr -cd '\r' < file | wc -c` equals the line count.
- **Changelog:** one sentence per item, written for the user. `README.md`'s entry for the
  release is an identical copy of `changelog.md`'s.

## Version Update Procedure

Use the `new_version` skill, or follow `directives/update_version.md`. Update:
1. `js/core.js`: the `APP_VERSION` constant
2. `README.md`: the version header
3. `changelog.md`: a new dated entry at the top
4. `hex_map.html`: the splash screen and the shortcut help screen
