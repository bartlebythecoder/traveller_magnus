# Version Update Skill

You are executing a version update procedure. Follow these steps exactly and in order.

## Step 1 — Gather Missing Information

Review the arguments provided with this command. The user may have supplied some or all of:
- `new_version` — the target version number (e.g., `0.10.1`)
- `update_mode` — either `init` (starting work on a new version) or `release` (finalizing a completed version)
- `banner_text` — the splash screen banner text for this version

If `update_mode` is not clear, ask: *"Are we starting a new version (init) or finalizing a completed version (release)?"*

If `banner_text` was not provided, ask: *"What should the splashtop banner text be for this version?"*

**Wait for the user's reply before continuing.**

---

## Step 2 — Update README.md Version Header

Locate the title line `# As Above, So Below (vX.X.X)` in `README.md` and update the version number to `new_version`.

---

## Step 3 — Update Scripts & Banner

Make all of the following changes:

1. **`js/core.js`** — update `APP_VERSION` to `"v{new_version}"` and `APP_BANNER` to `"v{new_version}: {banner_text}"`.
2. **`hex_map.html`** — update the text inside `<div class="splash-banner">` to `{banner_text}`.
3. **`hex_map.html`** — update the text inside `<div class="splash-version">` to `"v{new_version}"`.
4. **`hex_map.html`** — update the text inside `<span id="app-version">` to `"v{new_version}"`.

---

## Step 4 — Handle Changelogs (Conditional)

### If `update_mode == init`:

Add a new `### [v{new_version}] - In Progress` header at the top of the changelog section (below the `# Changelog` title) in **both** `changelog.md` and `README.md` changelog section. Leave it empty — no notes yet. Also update the previous "In Progress" entry to today's date if it was still marked "In Progress".

### If `update_mode == release`:

If `changelog_notes` were not provided, ask the user for them now.

Once received, add the following to the top of the changelog section in **both** `changelog.md` and `README.md`:

```
### [v{new_version}] - {today's date}
{changelog_notes}
```

---

## Error Handling

- If `README.md` is missing a recognizable version section, **STOP** and ask the user where to record it.
- If multiple files show differing version numbers before your update, **STOP** and ask the user which file is the source of truth.
