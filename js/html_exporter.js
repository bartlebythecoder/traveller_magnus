'use strict';

// =============================================================================
// HTML_EXPORTER.JS — Export a subsector as a static, browsable HTML wiki
//
// The HTML counterpart to obsidian_exporter.js. Both share js/export_core.js;
// this file supplies only what is HTML-specific — the renderer, the page shell,
// link resolution, escaping, and anchor IDs.
//
// Entry point: HtmlExporter.startExport(sectorNum, subsectorChar, options)
// options: { includeImages, imageProjection, skipAirless, includeSystemImages,
//            onProgress(done,total,msg), onDone(fileCount), onError(msg) }
//
// Structural differences from the Obsidian export, both deliberate (D2/D3 in
// directives/html_extract_manifest.md):
//   - ONE page per system. Stars, worlds and moons are anchored sections of it,
//     not separate files. Obsidian's per-body files suit its graph view; several
//     hundred three-fact pages browse badly over file://.
//   - Links are real relative paths. Obsidian resolves [[Name]] globally by name;
//     HTML has no such resolver, so every href/src is computed against the page's
//     own location. Getting this wrong fails SILENTLY — the page still renders,
//     the image is just missing.
//
// Output layout — each ZIP extracts into one shared sector folder so that
// separately-exported subsectors interlock rather than becoming islands:
//
//   <Sector>/
//     style.css                 shared, one copy
//     Subsector C/
//       index.html
//       <System> (1910).html
//       images/
//
// Everything is static and file://-openable. No server, no fetch.
// =============================================================================

const HtmlExporter = (() => {

    const EC = ExportCore;

    // ── Escaping ──────────────────────────────────────────────────────────────
    // Applied to every interpolated value. System names and especially
    // state.notes are free text — one '<' would otherwise corrupt the document.

    function _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Path segments go in href/src, so they need URI encoding on top of the
    // filename sanitising export_core already does.
    function _encPath(p) {
        return p.split('/').map(encodeURIComponent).join('/');
    }

    // ── Anchor IDs ────────────────────────────────────────────────────────────
    // Slugified from the display name. A `used` set guarantees uniqueness within
    // a page, so two identically-named bodies cannot collide.

    function _slugify(name) {
        return String(name || 'body')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'body';
    }

    function _uniqueSlug(base, used) {
        let s = _slugify(base);
        if (!used.has(s)) { used.add(s); return s; }
        let n = 2;
        while (used.has(`${s}-${n}`)) n++;
        used.add(`${s}-${n}`);
        return `${s}-${n}`;
    }

    // ── Link descriptors ──────────────────────────────────────────────────────
    //
    // Deferred from WP1 slice 3 until the anchor scheme was concrete (see LINK in
    // the manifest's open items). A descriptor says WHAT is being linked to; this
    // module resolves it to a path relative to the page doing the linking.
    //
    // `from` is the linking page's location:
    //   'sector'    — the sector index, at the sector root
    //   'subsector' — anything inside a Subsector X/ folder
    //
    // Only these two exist, because D2 gives every body a home on its system page.

    // `systemName` must be the DISCLOSED name — the same string the
    // orchestrator names the file from. Passing the real name here while the
    // file is written under the disclosed one 404s every link.
    const linkSystem    = (systemName, hexCode, anchor) =>
        ({ kind: 'system', systemName, hexCode, anchor: anchor || null });
    const linkSubsector = (subsectorChar) => ({ kind: 'subsector', subsectorChar });
    const linkSector    = () => ({ kind: 'sector' });

    function _href(target, from) {
        const up = from === 'subsector' ? '../' : '';
        switch (target.kind) {
            case 'sector':
                return _encPath(up + 'index.html');
            case 'subsector': {
                const dir = `Subsector ${target.subsectorChar}/index.html`;
                return _encPath(from === 'subsector' ? 'index.html' : dir);
            }
            case 'system': {
                const file = EC.systemFilename(target.systemName, target.hexCode, 'html');
                const path = from === 'subsector' ? file : file; // same folder by construction
                return _encPath(path) + (target.anchor ? '#' + target.anchor : '');
            }
            default:
                return '#';
        }
    }

    function _a(target, from, text) {
        return `<a href="${_href(target, from)}">${_esc(text)}</a>`;
    }

    // ── Block renderer ────────────────────────────────────────────────────────
    // The HTML counterpart to _mdRender in obsidian_exporter.js. Same block
    // model from export_core; different output.
    //
    // Markdown's 'gap' block carries no meaning in HTML — spacing is CSS's job —
    // so it is dropped rather than emitted as an empty element.

    function _render(blocks) {
        const out = [];
        let openDl = false;
        const closeDl = () => { if (openDl) { out.push('</dl>'); openDl = false; } };

        for (const b of blocks) {
            if (b.t === 'gap') continue;

            if (b.t === 'h') {
                closeDl();
                const tag = b.level === 3 ? 'h4' : 'h3';   // h1 = page, h2 = section
                out.push(`<${tag}>${_esc(b.text)}</${tag}>`);
            } else if (b.t === 'f') {
                if (!openDl) { out.push('<dl class="fields">'); openDl = true; }
                const v = b.code ? `<code>${_esc(b.value)}</code>` : _esc(b.value);
                out.push(`<dt>${_esc(b.label)}</dt><dd>${v}</dd>`);
            } else if (b.t === 'txt') {
                closeDl();
                if (String(b.text).trim()) out.push(`<p>${_esc(b.text)}</p>`);
            } else if (b.t === 'tbl') {
                closeDl();
                out.push('<div class="tw"><table>');
                out.push('<thead><tr>' + b.headers.map(h => `<th>${_esc(h)}</th>`).join('') + '</tr></thead>');
                out.push('<tbody>');
                for (const r of b.rows) {
                    out.push('<tr>' + r.map(c =>
                        `<td>${c && c.__html ? c.__html : _esc(c)}</td>`).join('') + '</tr>');
                }
                out.push('</tbody></table></div>');
            }
        }
        closeDl();
        return out.join('\n');
    }

    // A table cell carrying markup rather than plain text (used for anchor links).
    const raw = html => ({ __html: html });

    // Several export_core block builders open with their own heading — Markdown needs
    // it, because it has no sectioning element to carry the title. HTML puts that title
    // on the section's own <h2>, so rendering the block's heading as well prints it
    // twice ("System Overview / System Overview"). Strip the leading heading, and any
    // gap before it, wherever the page supplies its own.
    //
    // Found by reading the print output. No automated check caught it: the ids are
    // unique, the links resolve, and field parity is unaffected because a heading is
    // not a field.
    function _stripHeading(blocks) {
        const out = blocks.slice();
        while (out.length && out[0].t === 'gap') out.shift();
        if (out.length && out[0].t === 'h') out.shift();
        return out;
    }

    // ── Page shell ────────────────────────────────────────────────────────────

    // Sorting and filtering for the index tables (D4). Inline per page — no fetch,
    // nothing external. With JS off the table stays a plain, readable, sorted-by-hex
    // table; only the controls become inert, so they are hidden until JS confirms.
    const TABLE_JS = `
(function () {
  var t = document.getElementById('systems'); if (!t || !t.tHead) return;
  var tb = t.tBodies[0], rows = [].slice.call(tb.rows);
  var ctrl = document.getElementById('controls'); if (ctrl) ctrl.hidden = false;
  var count = document.getElementById('count');
  var f = document.getElementById('filter');
  function tally(n) { if (count) count.textContent = n + ' of ' + rows.length; }
  tally(rows.length);
  if (f) f.addEventListener('input', function () {
    var q = f.value.trim().toLowerCase(), n = 0;
    rows.forEach(function (r) {
      var hit = !q || r.textContent.toLowerCase().indexOf(q) >= 0;
      r.hidden = !hit; if (hit) n++;
    });
    tally(n);
  });
  var dirs = {};
  [].forEach.call(t.tHead.rows[0].cells, function (th, i) {
    if (th.dataset.nosort !== undefined) return;
    th.classList.add('sortable'); th.tabIndex = 0;
    function go() {
      var dir = dirs[i] = (dirs[i] === 1 ? -1 : 1);
      var num = th.dataset.type === 'num';
      rows.sort(function (a, b) {
        var ca = a.cells[i], cb = b.cells[i];
        var x = ca.dataset.s !== undefined ? ca.dataset.s : ca.textContent;
        var y = cb.dataset.s !== undefined ? cb.dataset.s : cb.textContent;
        if (num) { return ((parseFloat(x) || -1) - (parseFloat(y) || -1)) * dir; }
        return String(x).localeCompare(String(y)) * dir;
      });
      rows.forEach(function (r) { tb.appendChild(r); });
      [].forEach.call(t.tHead.rows[0].cells, function (o) { o.removeAttribute('aria-sort'); });
      th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
    }
    th.addEventListener('click', go);
    th.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
})();`;

    function _shell(title, cssHref, dataAttrs, bodyHtml, extraJs) {
        const attrs = Object.entries(dataAttrs || {})
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => ` data-${k}="${_esc(v)}"`).join('');
        return `<!doctype html>
<html lang="en"${attrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${_esc(title)}</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${bodyHtml}
<script>
// Theme toggle. Defaults to the OS preference via CSS; this only stores an override.
(function () {
  var K = 'aasb-theme';
  try { var s = localStorage.getItem(K); if (s) document.documentElement.dataset.theme = s; } catch (e) {}
  var b = document.getElementById('theme-toggle');
  if (!b) return;
  b.addEventListener('click', function () {
    var cur = document.documentElement.dataset.theme;
    if (!cur) cur = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(K, next); } catch (e) {}
  });
})();
${extraJs || ''}
</script>
</body>
</html>`;
    }

    // ── Section builders ──────────────────────────────────────────────────────

    function _sectionOpen(id, title, kind) {
        return `<section id="${_esc(id)}" class="body ${_esc(kind)}">\n` +
               `<h2>${_esc(title)} <a class="ph" href="#${_esc(id)}" aria-label="Link to this section">#</a></h2>`;
    }

    function _imageFigure(src, alt, cls) {
        return `<figure${cls ? ' class="' + cls + '"' : ''}><img src="${_encPath(src)}" alt="${_esc(alt)}" loading="lazy"></figure>`;
    }

    // ── Release 2: fog of war (WP5 slice 5b) ─────────────────────────────────
    // Mirrors obsidian_exporter.js exactly. `_playerMode` false => _levelFor()
    // returns null => filterBlocks() is the identity function => GM output is
    // byte-identical.
    let _playerMode = false;

    function _levelFor(hexId) {
        if (!_playerMode) return null;
        return (typeof window !== 'undefined' && window.DisclosureModel)
            ? window.DisclosureModel.get(hexId)
            : 'g';
    }

    const _F = (blocks, context, lvl) => EC.filterBlocks(blocks, context, lvl);

    const _show = (lvl, required) =>
        !lvl || (window.DisclosureModel
                 ? window.DisclosureModel.atLeast(lvl, required)
                 : false);

    // Referee notes never appear in a players' export (HX-5).
    function _notesFor(state) {
        return _playerMode ? [] : EC.notesBlocks(state);
    }

    // Edition-aware physical data for a world, mirroring obsidian_exporter's
    // dispatch. Written for all five engines now because the shape is identical
    // and already proven; only MgT2E is verified in slice 2a (see manifest 4.2).
    function _worldPhysBlocks(state, rawWorld, world, isMainworld) {
        if (!state || !rawWorld) return EC.fallbackPhysicalBlocks(world);
        if (state.mgtSystem) return EC.formatMgtWorldFields(rawWorld, isMainworld, state);
        if (state.ctSystem)  return EC.formatCtBodyFields(rawWorld.w, rawWorld.o, isMainworld, state);
        if (state.t5System)  return EC.formatT5WorldFields(rawWorld.w, rawWorld.o, isMainworld, state);
        if (state.rttSystem) return EC.formatRttBodyFields(rawWorld, isMainworld, state);
        if (state.aowSystem) return EC.formatAoWBodyFields(rawWorld, isMainworld, state);
        return EC.fallbackPhysicalBlocks(world);
    }

    function _moonPhysBlocks(state, rawMoon, moon, isLunarMainworld) {
        if (!state || !rawMoon) return EC.fallbackPhysicalBlocks(moon);
        if (state.mgtSystem) return EC.formatMgtMoonFields(rawMoon);
        if (state.ctSystem)  return EC.formatCtSatFields(rawMoon, isLunarMainworld, state);
        if (state.t5System)  return EC.formatT5SatFields(rawMoon);
        if (state.rttSystem) return EC.formatRttBodyFields(rawMoon, isLunarMainworld, state);
        if (state.aowSystem) return EC.formatAoWBodyFields(rawMoon, isLunarMainworld, state);
        return EC.fallbackPhysicalBlocks(moon);
    }

    function _starPhysBlocks(state, starIdx, star, isPrimary) {
        const rawStar = state ? EC.findRawStar(state, starIdx) : null;
        if (!state || !rawStar) return EC.fallbackStarBlocks(star);
        if (state.mgtSystem) return EC.formatMgtStarFields(rawStar, isPrimary);
        if (state.ctSystem)  return EC.formatCtStarFields(rawStar, starIdx);
        if (state.t5System)  return EC.formatT5StarFields(rawStar, starIdx);
        return EC.fallbackStarBlocks(star);
    }


    // ── System page ───────────────────────────────────────────────────────────

    function _buildSystemPage(ctx) {
        const { hexId, hexCode, sectorName, subsectorChar, state, normalized,
                sysImage, worldImages } = ctx;

        const LV         = _levelFor(hexId);   // null on the GM path
        const systemName = EC.resolveSystemName(state, LV, hexCode);
        const edition    = normalized.edition || 'Unknown';
        const stars      = normalized.stars  || [];
        const worlds     = normalized.worlds || [];
        const isMulti    = stars.length > 1;
        const mainworld  = worlds.find(w => w.type === 'Mainworld');
        const mwUwp      = (mainworld && mainworld.uwp) ? mainworld.uwp : EC.resolveUWP(state);

        // Assign every anchor up front so the contents list and the sections agree.
        const used = new Set(['overview', 'notes', 'contents']);
        // Anchor slugs are built from the DISCLOSED name, not the real one —
        // an id="prometheus" would leak the body's name straight into the URL
        // bar and the contents list even when the heading says "World 3".
        const starIds  = stars.map((s, i) => _uniqueSlug(EC.starDisplayName(s, i, isMulti, LV), used));
        const worldIds = worlds.map((w, i) => _uniqueSlug(EC.worldDisplayName(w, i, LV), used));
        const moonIds  = worlds.map((w, wi) =>
            (w.moons || []).map((m, mi) =>
                _uniqueSlug(`${EC.worldDisplayName(w, wi, LV)}-${EC.moonDisplayName(m, mi, LV)}`, used)));

        const H = [];

        // Breadcrumb + theme toggle
        H.push('<nav class="crumbs">',
            _a(linkSector(), 'subsector', sectorName),
            '<span>›</span>',
            _a(linkSubsector(subsectorChar), 'subsector', `Subsector ${subsectorChar}`),
            `<span>›</span><strong>${_esc(systemName)}</strong>`,
            '<button id="theme-toggle" type="button" title="Toggle light/dark">◐</button>',
            '</nav>');

        // Header + metadata block (the visible replacement for YAML frontmatter)
        H.push('<header class="page">');
        H.push(`<h1>${_esc(systemName)}</h1>`);
        // Hand-rolled metadata, not block-model output — filterBlocks() cannot
        // see it, so each row is gated explicitly against the `identity`
        // context. Mainworld UWP is (g): this block was the reason a full UWP
        // still reached level (a) in the first leak run.
        H.push('<dl class="meta">');
        if (_show(LV, 'a')) H.push(`<dt>Hex</dt><dd>${_esc(hexCode)}</dd>`);
        if (_show(LV, 'a')) H.push(`<dt>Edition</dt><dd>${_esc(edition)}</dd>`);
        if (mwUwp && _show(LV, 'g'))
            H.push(`<dt>Mainworld UWP</dt><dd><code>${_esc(mwUwp)}</code></dd>`);
        if (state.allegiance && _show(LV, 'a'))
            H.push(`<dt>Allegiance</dt><dd>${_esc(state.allegiance)}</dd>`);
        H.push('</dl>');
        H.push('</header>');

        if (sysImage) H.push(_imageFigure('images/' + sysImage, `${systemName} orrery`));

        // Contents — the substitute for Obsidian's per-file navigation
        H.push('<nav id="contents" class="toc"><h2>Contents</h2><ul>');
        H.push('<li><a href="#overview">System Overview</a></li>');
        stars.forEach((s, i) =>
            H.push(`<li><a href="#${starIds[i]}">${_esc(EC.starDisplayName(s, i, isMulti, LV))}</a> <span class="dim">star</span></li>`));
        // Body count is (d). Below it NO body appears in the contents list, gets
        // a section, or gets an anchor — emptying the sections is not enough,
        // because their number and type still show. Manifest 5.2.2 asked for
        // exactly this ("sections must not be generated, not merely blanked");
        // reported by Sean 2026-08-04 after seeing 45 empty bodies listed at (a).
        const showBodies = _show(LV, 'd');
        if (showBodies) worlds.forEach((w, i) => {
            // The type annotation is dropped WHOLESALE below (g), not just for
            // the mainworld. SystemViewer.normalizeSystem overwrites a
            // mainworld's real type with the literal 'Mainworld'
            // (system_viewer.js:265), and mainworld identification is (g)
            // (§1.10). Blanking only that one body would single it out just as
            // effectively, and the real type cannot be recovered without
            // guessing. Little is lost: worldDisplayName already encodes the
            // category as "World N" / "Giant N" / "Belt N".
            const _tAnn = _show(LV, 'g') ? _esc(w.type || '') : '';
            H.push(`<li><a href="#${worldIds[i]}">${_esc(EC.worldDisplayName(w, i, LV))}</a> <span class="dim">${_tAnn}</span>`);
            const ms = w.moons || [];
            if (ms.length) {
                H.push('<ul>');
                ms.forEach((m, mi) =>
                    H.push(`<li><a href="#${moonIds[i][mi]}">${_esc(EC.moonDisplayName(m, mi, LV))}</a></li>`));
                H.push('</ul>');
            }
            H.push('</li>');
        });
        // The nav link must go with the section — an entry reading "Referee
        // Notes" tells a player notes exist even though the section is gone.
        if (!_playerMode) H.push('<li><a href="#notes">Referee Notes</a></li>');
        H.push('</ul></nav>');

        // System overview
        H.push('<section id="overview" class="body">');
        H.push('<h2>System Overview</h2>');
        const ov = _F(EC.systemOverviewBlocks(state), 'system', LV);
        // Gas giant PRESENCE is (c); the count is (d). In the (c) window the
        // bodies are still withheld, so say only that some exist. Uses the same
        // boolean the subsector map's single GG marker and the index column
        // read, so page, map and index cannot disagree.
        const ggOnly = _playerMode && _show(LV, 'c') && !_show(LV, 'd')
                       && EC.indexRowData(state, hexCode, LV).gasGiant;
        const ovHtml = ov.length ? _render(_stripHeading(ov)) : '';
        const ggHtml = ggOnly
            ? '<dl class="fields"><dt>Gas Giants</dt><dd>Present</dd></dl>' : '';
        H.push((ovHtml + ggHtml) || '<p class="dim">No system-level data recorded.</p>');
        H.push('</section>');

        // Stars
        stars.forEach((s, i) => {
            const name = EC.starDisplayName(s, i, isMulti, LV);
            H.push(_sectionOpen(starIds[i], name, 'star'));
            // NOT block-model output — these two are hand-rolled <dl> rows, so
            // filterBlocks() cannot see them. Both are stellar detail, (b).
            // Missing this would have leaked a star's spectral type at level (a).
            if (_show(LV, 'b')) {
                H.push('<dl class="fields">');
                H.push(`<dt>Role</dt><dd>${_esc(s.role)}</dd>`);
                // .trim() because a brown dwarf has no luminosity class, which would
                // otherwise leave a trailing space in the value and in any data-* attribute.
                H.push(`<dt>Type</dt><dd>${_esc(`${s.sType}${s.subType ?? ''} ${s.sClass ?? ''}`.trim())}</dd>`);
                H.push('</dl>');
            }
            H.push(_render(_F(_starPhysBlocks(state, i, s, i === 0), 'star', LV)));

            // Also not block-model: a hand-built table whose third column is the
            // body's UWP — (g) — and whose first is its NAME — (d). The body
            // list itself is the (d) world count. Columns are dropped
            // individually rather than the table as a whole, so a player at (d)
            // still sees which bodies orbit which star.
            const orbiting = worlds
                .map((w, wi) => ({ w, wi }))
                .filter(({ w }) => (w.parentStarIdx ?? 0) === i);
            if (orbiting.length && _show(LV, 'd')) {
                const cols = ['Body', 'Type'];
                if (_show(LV, 'g')) cols.push('UWP');
                H.push(_render([EC.tbl(cols, orbiting.map(({ w, wi }) => {
                    const row = [
                        raw(`<a href="#${worldIds[wi]}">${_esc(EC.worldDisplayName(w, wi, LV))}</a>`),
                        // Same (g) gate as the contents list: a mainworld's
                        // type reads literally 'Mainworld'. Missing this here
                        // is why the first fix left the leak in place.
                        _show(LV, 'g') ? (w.type || '—') : '—',
                    ];
                    if (_show(LV, 'g')) row.push(w.uwp || '—');
                    return row;
                }))]));
            } else if (!orbiting.length) {
                H.push('<p class="dim">No bodies recorded for this star.</p>');
            }
            // Below (d) the orbiting-body list is withheld and NOTHING is
            // printed in its place — "withheld = absent", so a player must not
            // be able to tell a withheld list from a star with no bodies.
            H.push('</section>');
        });

        // Worlds, each followed by its moons — omitted entirely below (d).
        if (showBodies) worlds.forEach((w, wi) => {
            const name = EC.worldDisplayName(w, wi, LV);
            const isMainworldBody = w.type === 'Mainworld';
            const rawWorld = EC.findRawWorld(state, w);

            // Both the CSS class and the tag identify the mainworld, which is
            // (g). The class matters as much as the tag — the stylesheet
            // highlights .mainworld, so leaving it would mark the body visually.
            const _mwOk = _show(LV, 'g');
            H.push(_sectionOpen(worldIds[wi], name,
                (isMainworldBody && _mwOk) ? 'world mainworld' : 'world'));
            if (isMainworldBody && _mwOk) H.push('<p class="tag">Mainworld</p>');

            const img = worldImages.get(`w${wi}`);
            if (img) H.push(_imageFigure('images/' + img, name));

            // UWP string and its breakdown are both (g), never partial — §7.2.
            if (w.uwp && _show(LV, 'g')) {
                H.push('<h3>UWP Breakdown</h3>');
                H.push(`<p class="uwp"><code>${_esc(w.uwp)}</code></p>`);
                H.push(_render(EC.uwpTableBlocks(w.uwp)));
            }

            const detailB = _F(_stripHeading(EC.detailBlocks(w)), 'details', LV);
            const physB   = _F(_worldPhysBlocks(state, rawWorld, w, isMainworldBody), 'world', LV);
            if (detailB.length) { H.push('<h3>Details</h3>'); H.push(_render(detailB)); }
            H.push(_render(physB));
            if (isMainworldBody) H.push(_render(_F(EC.socioBlocks(state, rawWorld), 'socio', LV)));
            H.push('</section>');

            (w.moons || []).forEach((m, mi) => {
                const mName = EC.moonDisplayName(m, mi, LV);
                const isLunarMw = m.type === 'Mainworld' || m.isLunarMainworld;
                const rawMoon = EC.findRawMoon(state, rawWorld, m, mi);

                H.push(_sectionOpen(moonIds[wi][mi], `${name} — ${mName}`,
                    (isLunarMw && _mwOk) ? 'moon mainworld' : 'moon'));
                if (isLunarMw && _mwOk) H.push('<p class="tag">Mainworld</p>');
                H.push(`<p class="dim">Moon of <a href="#${worldIds[wi]}">${_esc(name)}</a></p>`);

                const mImg = worldImages.get(`w${wi}m${mi}`);
                if (mImg) H.push(_imageFigure('images/' + mImg, mName));

                if (m.uwp && _show(LV, 'g')) {
                    H.push('<h3>UWP Breakdown</h3>');
                    H.push(`<p class="uwp"><code>${_esc(m.uwp)}</code></p>`);
                    H.push(_render(EC.uwpTableBlocks(m.uwp)));
                }

                const mDetailB = _F(_stripHeading(EC.detailBlocks(m)), 'details', LV);
                const mPhysB   = _F(_moonPhysBlocks(state, rawMoon, m, isLunarMw), 'moon', LV);
                if (mDetailB.length) { H.push('<h3>Details</h3>'); H.push(_render(mDetailB)); }
                H.push(_render(mPhysB));
                if (isLunarMw) H.push(_render(_F(EC.socioBlocks(state, rawMoon), 'socio', LV)));
                H.push('</section>');
            });
        });

        // Referee notes — GM-facing, and NEVER exported to players at any level
        // (manifest 5.2.4, HX-5). The whole section goes, not just its text:
        // an empty "Referee Notes" heading advertises that notes exist.
        if (!_playerMode) {
            H.push('<section id="notes" class="body notes">');
            H.push('<h2>Referee Notes</h2>');
            H.push(_render(_stripHeading(EC.notesBlocks(state))));
            H.push('</section>');
        }

        // The root data-* attributes are the §6 replacement for Obsidian's YAML
        // frontmatter, and they carry the SAME values as the visible metadata —
        // so they need the same gates. `data-uwp` in particular held a full UWP
        // on every page at every level until the leak check found it: invisible
        // to any rendered-text search, which is why that check reads raw ZIP
        // bytes rather than the DOM.
        const dataAttrs = { hex: hexCode, hexid: hexId, sector: sectorName,
                            subsector: subsectorChar, edition };
        if (mwUwp && _show(LV, 'g'))            dataAttrs.uwp = mwUwp;
        if (state.allegiance && _show(LV, 'a')) dataAttrs.allegiance = state.allegiance;

        return _shell(`${systemName} (${hexCode})`, '../style.css', dataAttrs, H.join('\n'));
    }

    // ── Subsector index ───────────────────────────────────────────────────────
    // Minimal in slice 2a — it exists so system pages have somewhere to link back
    // to and the export is navigable. The sortable/filterable version is slice 2c.

    // Columns per Q1's stated assumption — that question was never returned by the
    // requirements review, so this is an assumption, not a ruling. Changing it means
    // editing COLUMNS and the row builder below; nothing else depends on it.
    // Starport and TL duplicate UWP digits 1 and 9 on purpose — they exist so those
    // values can be sorted and filtered on, not because the UWP lacks them. Gas Giant
    // and Bases are the two operational facts that are NOT in the UWP.
    // `lvl` is the Release 2 disclosure level each column inherits from the
    // field it displays (fog_of_war_field_tags §10 — columns inherit, they are
    // not decided separately). UWP, Starport, TL, Trade Codes and Bases are all
    // (g) because they describe the MAINWORLD, and mainworld identification is
    // itself (g). A level (b) index is therefore two columns wide, which is
    // intended — see §1.10a, do not "fix" it by promoting columns.
    const COLUMNS = [
        { key: 'hex',        label: 'Hex',                       lvl: 'a' },
        { key: 'name',       label: 'System',      nosort: false, lvl: 'd' },
        { key: 'uwp',        label: 'UWP',                       lvl: 'g' },
        { key: 'starport',   label: 'Starport',                  lvl: 'g' },
        { key: 'tl',         label: 'TL',          num: true,    lvl: 'g' },
        { key: 'tradeCodes', label: 'Trade Codes',               lvl: 'g' },
        { key: 'gasGiant',   label: 'GG',          num: true,    lvl: 'c' },
        { key: 'bases',      label: 'Bases',                     lvl: 'g' },
        { key: 'zone',       label: 'Zone',                      lvl: 'a' },
    ];

    // ── Clickable map overlay (WP3) ───────────────────────────────────────────
    //
    // The PNG is placed INSIDE an <svg> rather than beside it, so the polygons share
    // the image's coordinate system by construction — no CSS coupling, and it stays
    // aligned however the browser scales it. Laying an absolutely-positioned overlay
    // over a separate <img> would have to track the 78vh cap from 2d and re-derive
    // the scale factor; this cannot drift.
    //
    // Hover text comes from SVG <title>, so tooltips need no JavaScript (D4).
    function _mapSvg(mapImage, alt, cap, systems) {
        const t = cap.transform;
        const parts = [];
        parts.push(`<svg class="hexmap" viewBox="0 0 ${t.width} ${t.height}" ` +
                   `role="img" aria-label="${_esc(alt)}">`);
        parts.push(`<image href="${_encPath('images/' + mapImage)}" x="0" y="0" ` +
                   `width="${t.width}" height="${t.height}"/>`);

        // Only hexes that actually have a page get a hotspot.
        const byHex = new Map(systems.map(s => [s.hexId, s]));
        let hits = 0;
        for (let q = t.q0; q <= t.q1; q++) {
            for (let r = t.r0; r <= t.r1; r++) {
                const hexId = (typeof getHexId === 'function') ? getHexId(q, r) : null;
                if (!hexId || !byHex.has(hexId)) continue;
                const s = byHex.get(hexId);
                const mlv = _levelFor(hexId);
                const d = EC.indexRowData(s.state, s.hexCode, mlv);
                const pts = cap.hexPoly(q, r)
                    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
                // Hover tooltips inherit their fields' levels (§9.4). This
                // carried "Name (hex) — UWP" unconditionally and was the last
                // place a full UWP survived at level (a): it is SVG <title>
                // text, so it appears in no rendered body copy and no <dt>/<dd>
                // sweep would have found it.
                const label = `${d.name} (${d.hex})`
                            + (d.uwp && _show(mlv, 'g') ? ` — ${d.uwp}` : '');
                parts.push(
                    `<a href="${_href(linkSystem(d.name, d.hex), 'subsector')}">` +
                    `<title>${_esc(label)}</title>` +
                    `<polygon points="${pts}"/></a>`);
                hits++;
            }
        }
        parts.push('</svg>');
        return { html: `<figure class="map">${parts.join('')}</figure>`, hits };
    }

    function _buildSubsectorIndex(sectorName, subsectorChar, systems, mapImage, mapCap) {
        const H = [];
        H.push('<nav class="crumbs">',
            _a(linkSector(), 'subsector', sectorName),
            `<span>›</span><strong>Subsector ${_esc(subsectorChar)}</strong>`,
            '<button id="theme-toggle" type="button" title="Toggle light/dark">◐</button>',
            '</nav>');
        H.push('<header class="page">');
        H.push(`<h1>${_esc(sectorName)} — Subsector ${_esc(subsectorChar)}</h1>`);
        H.push(`<p class="dim">${systems.length} system${systems.length === 1 ? '' : 's'}</p>`);
        H.push('</header>');

        if (mapImage && mapCap && mapCap.transform && typeof mapCap.hexPoly === 'function') {
            const m = _mapSvg(mapImage, `Subsector ${subsectorChar} map`, mapCap, systems);
            H.push(m.html);
            H.push(`<p class="dim maphint">Click a system on the map to open its page. ` +
                   `${m.hits} of ${systems.length} shown as links.</p>`);
        } else if (mapImage) {
            // Transform unavailable (older renderer, or capture failed) — the map still
            // shows, just without hotspots. Degrade, do not omit.
            H.push(_imageFigure('images/' + mapImage, `Subsector ${subsectorChar} map`, 'map'));
        }

        H.push('<section class="body"><h2>Systems</h2>');
        // hidden until the script un-hides it, so a JS-off reader is not shown
        // controls that cannot work
        H.push('<div id="controls" class="controls" hidden>');
        H.push('<label for="filter">Filter</label>');
        H.push('<input id="filter" type="search" placeholder="name, UWP, trade code…" autocomplete="off">');
        H.push('<span id="count" class="dim"></span>');
        H.push('</div>');

        // Sorted by hex ascending — the default a reader expects, and the order the
        // table falls back to when JS is unavailable.
        const rows = systems
            .map(s => {
                const lv = _levelFor(s.hexId);
                const d = EC.indexRowData(s.state, s.hexCode, lv);
                // Keep the disclosed name for LINK building before the column
                // gate blanks the display cell — the href must still resolve to
                // the page, which is named from this same string.
                d.__pageName = d.name;
                if (lv) {
                    // Blank each cell this system's level does not permit. Rows
                    // in one subsector can sit at different levels, so gating is
                    // per CELL; the "drop empty columns" pass below then removes
                    // any column no system discloses, with no extra machinery.
                    COLUMNS.forEach(c => { if (!_show(lv, c.lvl)) d[c.key] = ''; });
                    // Corsair bases are 'never', at any level (§7.13).
                    if (d.bases) d.bases = d.bases.split(/\s+/).filter(x => x !== 'P').join(' ');
                }
                return { s, d };
            })
            .sort((a, b) => a.d.hex.localeCompare(b.d.hex));

        // Drop columns no system in this subsector has any value for — CT, for
        // instance, records no travel zone at all, and an entirely blank column is
        // just noise. `false` counts as empty so a subsector with no gas giants
        // anywhere loses the GG column rather than showing a row of dashes.
        // Which columns survive therefore varies by subsector, which is honest:
        // it reflects what that data actually contains.
        const cols = COLUMNS.filter(c =>
            rows.some(({ d }) => d[c.key] !== '' && d[c.key] != null && d[c.key] !== false));

        // tw-index, not plain tw — the sticky column headers depend on this wrapper
        // dropping its overflow at wide widths. See the #systems thead rule in STYLE_CSS.
        H.push('<div class="tw tw-index"><table id="systems">');
        H.push('<thead><tr>' + cols.map(c =>
            `<th scope="col"${c.num ? ' data-type="num"' : ''}>${_esc(c.label)}</th>`).join('') + '</tr></thead>');
        H.push('<tbody>');

        for (const { s: sysRef, d } of rows) {
            const rlv = _levelFor(sysRef.hexId);
            const tds = cols.map(c => {
                if (c.key === 'name')
                    return `<td>${_a(linkSystem(d.__pageName, d.hex), 'subsector', d.name)}</td>`;
                // Below (d) the System column is blank and usually dropped, which
                // would leave the index with no route to the system page at all.
                // The hex is (a) and the page exists, so link from the hex instead
                // — navigation, disclosing nothing the reader does not already have.
                if (c.key === 'hex' && rlv && !_show(rlv, 'd'))
                    return `<td>${_a(linkSystem(d.__pageName, d.hex), 'subsector', d.hex)}</td>`;
                if (c.key === 'uwp')
                    return `<td><code>${_esc(d.uwp)}</code></td>`;
                if (c.key === 'tl') {
                    // TL runs 0-9 then A+. Sort on its numeric value, not its glyph,
                    // or 'A' would sort before '9'.
                    const n = parseInt(d.tl, 36);
                    return `<td data-s="${isNaN(n) ? -1 : n}">${_esc(d.tl)}</td>`;
                }
                if (c.key === 'gasGiant') {
                    // Sort on 1/0 rather than the glyph, so "has a gas giant" groups
                    // together regardless of what symbol is displayed.
                    return `<td data-s="${d.gasGiant ? 1 : 0}">${d.gasGiant ? 'Y' : '<span class="dim">—</span>'}</td>`;
                }
                if (c.key === 'zone' && d.zone)
                    return `<td><span class="zone z-${_esc(String(d.zone).toLowerCase())}">${_esc(d.zone)}</span></td>`;
                return `<td>${_esc(d[c.key] ?? '')}</td>`;
            });
            H.push('<tr>' + tds.join('') + '</tr>');
        }
        H.push('</tbody></table></div></section>');

        return _shell(`${sectorName} — Subsector ${subsectorChar}`, '../style.css',
            { sector: sectorName, subsector: subsectorChar }, H.join('\n'), TABLE_JS);
    }

    // ── Sector index ──────────────────────────────────────────────────────────
    // Lists every subsector that has data in the app, not merely the one being
    // exported — that is what lets separately-exported ZIPs interlock (D3). A
    // link to a subsector you have not exported yet is dead until you do; that
    // is the accepted trade-off for not forcing one enormous export.

    function _buildSectorIndex(sectorName, sectorNum, presentSubs) {
        const H = [];
        H.push('<nav class="crumbs">',
            `<strong>${_esc(sectorName)}</strong>`,
            '<button id="theme-toggle" type="button" title="Toggle light/dark">◐</button>',
            '</nav>');
        H.push('<header class="page">');
        H.push(`<h1>${_esc(sectorName)}</h1>`);
        H.push('</header>');
        H.push('<section class="body"><h2>Subsectors</h2>');
        H.push('<div class="tw"><table><thead><tr><th>Subsector</th><th>Systems</th></tr></thead><tbody>');
        for (const s of presentSubs) {
            H.push('<tr>' +
                `<td>${_a(linkSubsector(s.char), 'sector', 'Subsector ' + s.char)}</td>` +
                `<td>${s.count}</td></tr>`);
        }
        H.push('</tbody></table></div>');
        H.push('<p class="dim">Subsectors you have not exported yet will not open until their ZIP is extracted here.</p>');
        H.push('</section>');
        return _shell(sectorName, 'style.css', { sector: sectorName }, H.join('\n'));
    }

    // ── Stylesheet ────────────────────────────────────────────────────────────
    // One copy at the sector root, shared by every page. Dark by default to match
    // the app, light via prefers-color-scheme, and data-theme (set by the toggle)
    // overrides both. Print forces light and drops navigation.

    const STYLE_CSS = `:root {
  --bg:#0d1b2a; --panel:#12243a; --ink:#cdd6e3; --dim:#8fa0b5;
  --line:#1f3a57; --accent:#66fcf1; --link:#66fcf1; --tag:#45a29e;
}
@media (prefers-color-scheme: light) {
  :root { --bg:#f7f8fa; --panel:#fff; --ink:#1b2430; --dim:#5c6b7f;
          --line:#d8dee7; --accent:#0f766e; --link:#0b6b78; --tag:#0f766e; }
}
:root[data-theme="dark"] {
  --bg:#0d1b2a; --panel:#12243a; --ink:#cdd6e3; --dim:#8fa0b5;
  --line:#1f3a57; --accent:#66fcf1; --link:#66fcf1; --tag:#45a29e;
}
:root[data-theme="light"] {
  --bg:#f7f8fa; --panel:#fff; --ink:#1b2430; --dim:#5c6b7f;
  --line:#d8dee7; --accent:#0f766e; --link:#0b6b78; --tag:#0f766e;
}
* { box-sizing:border-box; }
body { margin:0; padding:0 1rem 4rem; background:var(--bg); color:var(--ink);
  font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  max-width:60rem; margin-inline:auto; overflow-wrap:break-word; }
a { color:var(--link); }
/* color-mix is declared second so a browser that does not support it keeps the
   plain fallback above rather than falling back to transparent. */
code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
  background:var(--panel);
  background:color-mix(in srgb, var(--panel) 80%, transparent);
  border:1px solid var(--line); border-radius:3px; padding:0 .3em; }
.crumbs { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;
  padding:.75rem 0; border-bottom:1px solid var(--line); font-size:.9rem;
  position:sticky; top:0; background:var(--bg); z-index:5; }
.crumbs span { color:var(--dim); }
.crumbs button { margin-left:auto; background:transparent; color:var(--ink);
  border:1px solid var(--line); border-radius:4px; cursor:pointer;
  font-size:1rem; line-height:1; padding:.3rem .5rem; }
header.page { padding:1.5rem 0 .5rem; }
h1 { margin:0 0 .5rem; font-size:1.9rem; letter-spacing:.01em; }
h2 { font-size:1.25rem; margin:0 0 .6rem; }
h3 { font-size:1rem; margin:1.1rem 0 .3rem; color:var(--accent); }
h4 { font-size:.9rem; margin:.9rem 0 .2rem; color:var(--dim);
  text-transform:uppercase; letter-spacing:.06em; }
.dim { color:var(--dim); }
.tag { display:inline-block; margin:0 0 .5rem; padding:.1rem .5rem;
  border:1px solid var(--tag); color:var(--tag); border-radius:999px;
  font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; }
section.body { background:var(--panel); border:1px solid var(--line);
  border-radius:8px; padding:1rem 1.15rem; margin:1rem 0; }
section.body.mainworld { border-color:var(--tag); }
section.body h2 .ph { opacity:0; text-decoration:none; font-weight:400; }
section.body h2:hover .ph { opacity:.5; }
dl.meta, dl.fields { display:grid; grid-template-columns:minmax(8rem,auto) 1fr;
  gap:.15rem .9rem; margin:.4rem 0; }
dl.meta dt, dl.fields dt { color:var(--dim); font-size:.85rem; }
dl.meta dd, dl.fields dd { margin:0; }
nav.toc { background:var(--panel); border:1px solid var(--line);
  border-radius:8px; padding:1rem 1.15rem; margin:1rem 0; }
nav.toc ul { margin:.3rem 0; padding-left:1.1rem; }
nav.toc li { margin:.1rem 0; }
figure { margin:1rem 0; }
img { max-width:100%; height:auto; display:block; border-radius:6px;
  border:1px solid var(--line); }
/* The subsector map is ~900x1000 and would otherwise push the systems table — the
   reason the index page exists — entirely below the fold. Capped to most of the
   viewport; the full-size PNG is still in images/ for anyone who wants it. */
figure.map img { max-height:78vh; width:auto; margin-inline:auto; }
/* Clickable map. The PNG lives inside the SVG, so hotspots scale with it. */
svg.hexmap { display:block; width:100%; height:auto; max-height:78vh;
  margin-inline:auto; border:1px solid var(--line); border-radius:6px; }
svg.hexmap polygon { fill:transparent; stroke:transparent; stroke-width:2;
  transition:fill .12s, stroke .12s; }
svg.hexmap a:hover polygon,
svg.hexmap a:focus polygon { fill:var(--accent); fill-opacity:.22;
  stroke:var(--accent); }
svg.hexmap a { cursor:pointer; }
.maphint { margin:.35rem 0 0; font-size:.82em; }
.tw { overflow-x:auto; }
table { border-collapse:collapse; width:100%; font-size:.92rem; }
th, td { border:1px solid var(--line); padding:.35rem .6rem; text-align:left;
  vertical-align:top; }
th { color:var(--dim); font-weight:600; font-size:.8rem;
  text-transform:uppercase; letter-spacing:.05em; }
.uwp code { font-size:1.05rem; }
.controls { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap;
  margin:0 0 .75rem; }
.controls label { color:var(--dim); font-size:.85rem; }
.controls input { flex:1 1 14rem; min-width:0; padding:.35rem .55rem;
  background:var(--bg); color:var(--ink); border:1px solid var(--line);
  border-radius:4px; font:inherit; font-size:.9rem; }
/* Keep column labels visible while scrolling a long system list.
   position:sticky resolves against the nearest SCROLL CONTAINER, and .tw's
   overflow-x makes this wrapper exactly that. Inside .tw the header therefore
   cannot pin to the viewport at all, and a non-zero top offset instead displaces it
   permanently downward over the first data row — which is how the top system
   ended up hidden behind the header. So the wrapper drops its overflow at the
   width where the table is known to fit (intrinsic minimum ~661px against a
   ~889px content column), and only there does the header pin below the
   breadcrumb bar. Narrower than that the wrapper keeps scrolling horizontally
   and top:0 leaves the header harmlessly in its own row.
   Verify any change to this by measuring th vs first-row rects, not by eye:
   both failure modes render as a perfectly plausible-looking table. */
#systems thead th { position:sticky; top:0; background:var(--panel);
  box-shadow:inset 0 -1px 0 var(--line); }
@media (min-width:60rem) {
  .tw-index { overflow-x:visible; }
  /* matches the breadcrumb bar's measured height (52.6px) */
  #systems thead th { top:3.3rem; }
}
th.sortable { cursor:pointer; user-select:none; white-space:nowrap; }
th.sortable:hover { color:var(--accent); }
th.sortable::after { content:'  ⇅'; opacity:.35; }
th[aria-sort="ascending"]::after  { content:'  ↑'; opacity:1; color:var(--accent); }
th[aria-sort="descending"]::after { content:'  ↓'; opacity:1; color:var(--accent); }
tbody tr:nth-child(even) { background:var(--panel);
  background:color-mix(in srgb, var(--line) 22%, transparent); }
:where(a, button, th.sortable, input):focus-visible {
  outline:2px solid var(--accent); outline-offset:2px; }
.zone { padding:.05rem .45rem; border-radius:999px; font-size:.78rem;
  border:1px solid currentColor; }
.zone.z-amber { color:#d99b1c; }
.zone.z-red   { color:#d9534f; }
.zone.z-green { color:var(--tag); }
@media print {
  :root { --bg:#fff; --panel:#fff; --ink:#000; --dim:#444; --line:#bbb;
          --accent:#000; --link:#000; --tag:#444; }
  .crumbs, nav.toc, .controls, .maphint { display:none; }
  /* the map itself still prints; only its interactive affordances go */
  svg.hexmap polygon { display:none; }
  section.body { break-inside:avoid; border-radius:0; }
  body { max-width:none; }
  thead { display:table-header-group; }
  /* table-header-group already repeats the labels on each page; leaving them
     sticky as well makes paginated output place them unpredictably */
  #systems thead th { position:static; }
  .tw-index { overflow-x:visible; }
  tbody tr { break-inside:avoid; background:none !important; }
}
`;

    // ── Export orchestrator ───────────────────────────────────────────────────

    async function startExport(sectorNum, subsectorChar, options) {
        const { includeImages, imageProjection, skipAirless, includeSystemImages,
                playerVersion, onProgress, onDone, onError } = options || {};

        // Release 2. Absent/false keeps every existing call on the GM path.
        _playerMode = !!playerVersion;

        const report = (d, t, m) => onProgress && onProgress(d, t, m);

        const systems = [];
        const subCounts = new Map();
        hexStates.forEach((state, hexId) => {
            const p = hexId.split('-');
            if (parseInt(p[0]) !== sectorNum) return;
            if (!state || state.type === 'EMPTY') return;
            // Level (0): no page, no index row, no filename, and no hex counted
            // towards the sector index either — the system is absent entirely.
            if (_playerMode && _levelFor(hexId) === '0') return;
            subCounts.set(p[1], (subCounts.get(p[1]) || 0) + 1);
            if (p[1] === subsectorChar) systems.push({ hexId, hexCode: p[2], state });
        });

        if (systems.length === 0) {
            onError && onError(_playerMode
                ? 'No systems in this subsector are disclosed to players.'
                : 'No systems found in this subsector.');
            return;
        }

        const sectorName = (window.sectorNames && window.sectorNames[sectorNum]) || `Sector ${sectorNum}`;
        const enc   = new TextEncoder();
        const files = [];
        const root  = EC.sanitize(sectorName);
        const sub   = `${root}/Subsector ${subsectorChar}`;
        const put   = (name, text) => files.push({ name, data: enc.encode(text) });

        put(`${root}/style.css`, STYLE_CSS);

        const presentSubs = [...subCounts.entries()].sort()
            .map(([char, count]) => ({ char, count }));
        put(`${root}/index.html`, _buildSectorIndex(sectorName, sectorNum, presentSubs));

        let mapImage = null, mapCap = null;
        if (typeof captureSubsector !== 'undefined') {
            report(0, systems.length, 'Capturing subsector map…');
            // withTransform gives back the hex geometry needed for the clickable
            // overlay. Older renderers return bare bytes; handle both.
            // WP6: the map is drawn at each hex's disclosure level, so a
            // players' export no longer ships a picture of every UWP.
            const cap = await captureSubsector(sectorNum, subsectorChar, 900, 1000,
                                               { withTransform: true,
                                                 disclosure: _playerMode ? _levelFor : null });
            const png = (cap && cap.png) ? cap.png : cap;
            if (cap && cap.png) mapCap = cap;
            if (png) {
                mapImage = `Subsector ${subsectorChar} map.png`;
                files.push({ name: `${sub}/images/${mapImage}`, data: png });
            }
        }

        put(`${sub}/index.html`,
            _buildSubsectorIndex(sectorName, subsectorChar, systems, mapImage, mapCap));

        for (let si = 0; si < systems.length; si++) {
            const { hexId, hexCode, state } = systems[si];
            const oLV = _levelFor(hexId);
            const systemName = EC.resolveSystemName(state, oLV, hexCode);
            report(si, systems.length, `Processing ${systemName}…`);

            const normalized = (typeof SystemViewer !== 'undefined')
                ? SystemViewer.normalizeSystem(state) : null;

            const pageFile = `${sub}/${EC.systemFilename(systemName, hexCode, 'html')}`;

            if (!normalized) {
                put(pageFile, _shell(`${systemName} (${hexCode})`, '../style.css',
                    { hex: hexCode, sector: sectorName, subsector: subsectorChar },
                    `<nav class="crumbs">${_a(linkSector(), 'subsector', sectorName)}` +
                    `<span>›</span>${_a(linkSubsector(subsectorChar), 'subsector', 'Subsector ' + subsectorChar)}` +
                    `<span>›</span><strong>${_esc(systemName)}</strong>` +
                    '<button id="theme-toggle" type="button">◐</button></nav>' +
                    `<header class="page"><h1>${_esc(systemName)}</h1></header>` +
                    '<section class="body"><p class="dim">No system data generated for this hex.</p></section>'));
                continue;
            }

            // Images, keyed so the page builder can look them up without re-deriving.
            const worldImages = new Map();
            let sysImage = null;
            // Orrery images are gated at (d): one glance gives world count,
            // belts and gas giants (§5.2.3). Below (g) they are RE-RENDERED with
            // generic body labels and no mainworld highlight — the labels are
            // pixels, so no downstream filter could remove them (§9.2a).
            if (includeSystemImages && _show(oLV, 'd') && typeof SystemViewer !== 'undefined') {
                const img = await SystemViewer.renderSnapshot(state, 900, 500, { level: oLV });
                if (img) {
                    sysImage = EC.systemFilename(systemName, hexCode, 'png');
                    files.push({ name: `${sub}/images/${sysImage}`, data: img });
                }
            }

            const worlds = normalized.worlds || [];
            for (let wi = 0; wi < worlds.length; wi++) {
                const w = worlds[wi];
                // A rendered world IS a picture of its hydrographics and
                // atmosphere, both (e) — so the image gates at (e) regardless of
                // the "include world images" checkbox (§5.2.3 / §9.1).
                if (includeImages && _show(oLV, 'e') && EC.canRenderImage(w) && !(skipAirless && EC.isAirless(w))) {
                    const img = await EC.renderWorldImage(w, hexId, imageProjection, `w${wi}`);
                    if (img) {
                        const fn = EC.bodyFilename(systemName, EC.worldDisplayName(w, wi, oLV), hexCode, 'png');
                        files.push({ name: `${sub}/images/${fn}`, data: img });
                        worldImages.set(`w${wi}`, fn);
                    }
                }
                const moons = w.moons || [];
                for (let mi = 0; mi < moons.length; mi++) {
                    const m = moons[mi];
                    if (includeImages && _show(oLV, 'e') && EC.canRenderImage(m) && !(skipAirless && EC.isAirless(m))) {
                        const img = await EC.renderWorldImage(m, hexId, imageProjection, `w${wi}-m${mi}`);
                        if (img) {
                            const fn = EC.bodyFilename(systemName,
                                `${EC.worldDisplayName(w, wi, oLV)} - ${EC.moonDisplayName(m, mi, oLV)}`,
                                hexCode, 'png');
                            files.push({ name: `${sub}/images/${fn}`, data: img });
                            worldImages.set(`w${wi}m${mi}`, fn);
                        }
                    }
                }
            }

            put(pageFile, _buildSystemPage({
                hexId, hexCode, sectorName, subsectorChar, state, normalized,
                sysImage, worldImages,
            }));

            await new Promise(r => setTimeout(r, 0));
        }

        report(systems.length, systems.length, 'Building ZIP…');
        downloadBlob(EC.buildZip(files),
            `${root}_Subsector_${subsectorChar}_HTML${_playerMode ? '_PLAYERS' : ''}.zip`, 'application/zip');
        onDone && onDone(files.length);
    }

    return {
        startExport,
        // exposed for testing and for slices 2b-2e
        _esc, _slugify, _uniqueSlug, _render, _href, STYLE_CSS,
        linkSystem, linkSubsector, linkSector, raw,
        _buildSystemPage, _buildSubsectorIndex, _buildSectorIndex, _shell,
    };

})();

window.HtmlExporter = HtmlExporter;
