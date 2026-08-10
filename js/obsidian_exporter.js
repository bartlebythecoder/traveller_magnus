'use strict';

// =============================================================================
// OBSIDIAN_EXPORTER.JS — Export a subsector as a flat Obsidian wiki
// Produces one markdown file per star, world, and moon, plus a subsector index.
// Optionally embeds a procedurally rendered image for each terrestrial world.
//
// Entry point: ObsidianExporter.startExport(sectorNum, subsectorChar, options)
// options: { includeImages, skipAirless, includeSystemImages,
//            onProgress(done,total,msg), onDone(fileCount), onError(msg) }
// includeSystemImages: true → captures a PNG orrery per system hub page.
// The subsector index page's hex-map snapshot is always captured, independent
// of includeSystemImages.
// =============================================================================

const ObsidianExporter = (() => {

    // ── Shared machinery (js/export_core.js) ──────────────────────────────────
    // Extracted in WP1 (v0.17.0) so the HTML exporter shares one implementation
    // rather than a drifting copy. Aliased under the original private names so
    // every call site below is unchanged.
    // See directives/html_extract_manifest.md.

    const _buildZip          = ExportCore.buildZip;
    const _sanitize          = ExportCore.sanitize;
    const _systemFilename    = ExportCore.systemFilename;
    const _bodyFilename      = ExportCore.bodyFilename;
    const _worldDisplayName  = ExportCore.worldDisplayName;
    const _moonDisplayName   = ExportCore.moonDisplayName;
    const _starDisplayName   = ExportCore.starDisplayName;
    const _resolveSystemName = ExportCore.resolveSystemName;
    const _resolveUWP        = ExportCore.resolveUWP;
    const _kToC              = ExportCore.kToC;
    const _findRawWorld      = ExportCore.findRawWorld;
    const _findRawMoon       = ExportCore.findRawMoon;
    const _findRawStar       = ExportCore.findRawStar;
    const _canRenderImage    = ExportCore.canRenderImage;
    const _isAirless         = ExportCore.isAirless;
    const _renderWorldImage  = ExportCore.renderWorldImage;

    // ── YAML helper (Obsidian-specific, stays here) ───────────────────────────

    function _yamlStr(s) {
        return '"' + String(s || '').replace(/"/g, '\\"') + '"';
    }

    // ── Structured field records ──────────────────────────────────────────────
    //
    // WP1 slice 2 (v0.17.0). The `_format*` functions below no longer emit
    // Markdown strings — they return format-neutral blocks which a per-format
    // renderer turns into output. This is what makes Release 2's fog-of-war
    // possible: a disclosure level filters *fields*, which cannot be done
    // against pre-baked strings. See directives/html_extract_manifest.md.
    //
    //   {t:'h', level, text}   heading  -> '## text' or '### text', then a blank
    //   {t:'f', label, value}  field    -> '**label:** value' + two trailing spaces
    //   {t:'f', ..., code}     field    -> value wrapped in backticks
    //   {t:'gap'}                       -> a single blank line
    //
    // Headings and gaps are deliberately separate blocks. The original code was
    // inconsistent about whether a blank line preceded a heading (compare the
    // '### Orbital Data' push in _formatMgtWorldFields against the one in
    // _formatMgtMoonFields), and that inconsistency is preserved verbatim.

    const _GAP = ExportCore.GAP;
    const _h   = ExportCore.h;
    const _f   = ExportCore.f;
    const _fc  = ExportCore.fc;
    const _txt = ExportCore.txt;

    // The Markdown renderer. Its HTML counterpart lives in html_exporter.js.
    function _mdRender(blocks) {
        const out = [];
        for (const b of blocks) {
            if (b.t === 'gap')      out.push('');
            else if (b.t === 'h')   out.push((b.level === 3 ? '### ' : '## ') + b.text, '');
            else if (b.t === 'txt') out.push(b.text);
            else if (b.t === 'f')   out.push(`**${b.label}:** ${b.code ? '`' + b.value + '`' : b.value}  `);
            else if (b.t === 'tbl') {
                out.push('| ' + b.headers.join(' | ') + ' |');
                out.push('|' + b.headers.map(() => '---').join('|') + '|');
                b.rows.forEach(r => out.push('| ' + r.join(' | ') + ' |'));
            }
        }
        return out;
    }

    // Edition-aware formatters — moved to export_core.js in WP2 slice 2a.
    // Aliased under their original private names so all fifteen call sites below
    // are unchanged.
    const _formatMgtWorldFields = ExportCore.formatMgtWorldFields;
    const _formatMgtMoonFields = ExportCore.formatMgtMoonFields;
    const _formatMgtStarFields = ExportCore.formatMgtStarFields;
    const _formatMgtSocio = ExportCore.formatMgtSocio;
    const _formatCtBodyFields = ExportCore.formatCtBodyFields;
    const _formatCtSatFields = ExportCore.formatCtSatFields;
    const _formatCtStarFields = ExportCore.formatCtStarFields;
    const _formatT5WorldFields = ExportCore.formatT5WorldFields;
    const _formatT5SatFields = ExportCore.formatT5SatFields;
    const _formatT5StarFields = ExportCore.formatT5StarFields;
    const _formatT5Socio = ExportCore.formatT5Socio;
    const _formatRttBodyFields = ExportCore.formatRttBodyFields;

    // Referee notes and system overview now live in export_core.js as
    // notesBlocks() / systemOverviewBlocks() — both are shared with the HTML
    // exporter, and notes are a Release 2 leak gate (see manifest 5.2.4).

    // ── Release 2: fog of war (WP5 slice 5b) ─────────────────────────────────
    // `_playerMode` is false for every existing call, so _levelFor() returns
    // null, ExportCore.filterBlocks() returns its input array unchanged, and the
    // GM export is byte-identical. That is the property the regression guard
    // checks — do not make the null path do work.
    let _playerMode = false;

    function _levelFor(hexId) {
        if (!_playerMode) return null;
        return (typeof window !== 'undefined' && window.DisclosureModel)
            ? window.DisclosureModel.get(hexId)
            : 'g';
    }

    // Shorthand used at every formatter call site below.
    const _F = (blocks, context, lvl) => ExportCore.filterBlocks(blocks, context, lvl);

    // Is a whole block of content permitted? `lvl` null is the GM path.
    // Used for things gated as a unit rather than field by field — the UWP
    // breakdown table, images, whole sections.
    const _show = (lvl, required) =>
        !lvl || (window.DisclosureModel
                 ? window.DisclosureModel.atLeast(lvl, required)
                 : false);

    // Referee notes NEVER appear in a players' export, at any level (HX-5:
    // there is no player-facing notes field either, so nothing replaces them).
    function _notesFor(state) {
        return _playerMode ? [] : ExportCore.notesBlocks(state);
    }

    // A body's Type column. SystemViewer.normalizeSystem overwrites a
    // mainworld's real type with the literal 'Mainworld'
    // (system_viewer.js:265), and mainworld identification is (g) (§1.10).
    // The annotation is therefore dropped for EVERY body below (g), not just
    // the mainworld — blanking one row would single it out just as clearly,
    // and the real type is not recoverable without guessing. The body's own
    // generic name ("World 3", "Giant 1") still carries the category.
    function _typeAnn(body, lvl) {
        return _show(lvl, 'g') ? (body.type || '—') : '—';
    }

    // ── Markdown builders ─────────────────────────────────────────────────────

    function _buildSubsectorIndex(sectorName, subsectorChar, systems, mapImageFilename) {
        const rows = systems.map(s => {
            const lv   = _levelFor(s.hexId);
            const name = _resolveSystemName(s.state, lv, s.hexCode);
            // UWP is (g); below it the column is blank rather than omitted,
            // because a Markdown table must keep its column count.
            const uwp  = _show(lv, 'g') ? _resolveUWP(s.state) : '';
            // `name` is already the disclosed form ("System 1910" below d),
            // and the orchestrator names the file from the same string, so one
            // link shape works at every level.
            const link = `[[${_sanitize(name)} (${s.hexCode})]]`;
            return `| ${s.hexCode} | ${link} | ${uwp} |`;
        });

        const parts = [
            '---',
            `type: subsector-index`,
            `sector: ${_yamlStr(sectorName)}`,
            `subsector: ${_yamlStr(subsectorChar)}`,
            '---',
            '',
            `# ${sectorName} — Subsector ${subsectorChar}`,
            '',
            `**Sector:** ${sectorName}  `,
            `**Subsector:** ${subsectorChar}  `,
            `**Systems:** ${systems.length}`,
        ];

        if (mapImageFilename) {
            parts.push('', `![[${mapImageFilename}]]`);
        }

        parts.push(
            '',
            '## Systems',
            '',
            '| Hex | System | UWP |',
            '|---|---|---|',
            ...rows,
        );

        return parts.join('\n');
    }

    function _buildSystemHub(hexId, hexCode, sectorName, subsectorChar, state, normalized, imageFilename, subsectorLink) {
        const _LV = _levelFor(hexId);
        const systemName = _resolveSystemName(state, _LV, hexCode);
        const edition    = normalized.edition || 'Unknown';
        const allegiance = state.allegiance || '—';
        const stars      = normalized.stars  || [];
        const worlds     = normalized.worlds || [];
        const mainworld  = worlds.find(w => w.type === 'Mainworld');
        const mwUwp      = (mainworld && mainworld.uwp) ? mainworld.uwp : _resolveUWP(state);

        const isMultiStar = stars.length > 1;
        const starRows = stars.map((s, i) => {
            const sName = _starDisplayName(s, i, isMultiStar, _LV);
            const link  = `[[${_sanitize(systemName)} - ${_sanitize(sName)} (${hexCode})]]`;
            const spec = _show(_LV, 'b') ? `${s.sType}${s.subType ?? ''} ${s.sClass}` : '—';
            return `| ${link} | ${spec} | ${_show(_LV, 'b') ? s.role : '—'} |`;
        });

        // Body count is (d): below it the table has no rows at all. Blanking the
        // cells would still disclose how many bodies exist. See manifest 4.7.
        const worldRows = !_show(_LV, 'd') ? [] : worlds.map((w, i) => {
            const wName = _worldDisplayName(w, i, _LV);
            const link  = `[[${_sanitize(systemName)} - ${_sanitize(wName)} (${hexCode})]]`;
            return `| ${link} | ${_typeAnn(w, _LV)} | ${_show(_LV, 'g') ? (w.uwp || '—') : '—'} |`;
        });

        const lines = [
            '---',
            'type: system',
            `hexId: ${_yamlStr(hexId)}`,
            `hexCode: ${_yamlStr(hexCode)}`,
            `sector: ${_yamlStr(sectorName)}`,
            `subsector: ${_yamlStr(subsectorChar)}`,
            `edition: "${edition}"`,
            `mainworldUwp: ${_yamlStr(mwUwp)}`,
            `allegiance: ${_yamlStr(allegiance)}`,
            '---',
            '',
            `# ${systemName}`,
            '',
            `**Sector:** ${sectorName}  `,
            `**Subsector:** ${subsectorLink}  `,
            `**Hex:** ${hexCode}  `,
            `**Edition:** ${edition}  `,
            `**Allegiance:** ${allegiance}`,
        ];

        if (imageFilename) {
            lines.push('', `![[${imageFilename}]]`);
        }

        lines.push(..._mdRender(_F(ExportCore.systemOverviewBlocks(state), 'system', _LV)));

        // Pass 1: mainworld is a top-level world
        let mwLink = null;
        if (mainworld) {
            const mwIdx  = worlds.indexOf(mainworld);
            const mwName = _worldDisplayName(mainworld, mwIdx, _LV);
            mwLink = `[[${_sanitize(systemName)} - ${_sanitize(mwName)} (${hexCode})]]`;
        } else {
            // Pass 2: mainworld is a moon of another body (lunar mainworld)
            outer: for (let wi = 0; wi < worlds.length; wi++) {
                const moons = worlds[wi].moons || [];
                for (let mi = 0; mi < moons.length; mi++) {
                    const moon = moons[mi];
                    if (moon.type === 'Mainworld' || moon.isLunarMainworld) {
                        const parentName = _worldDisplayName(worlds[wi], wi, _LV);
                        const moonName   = _moonDisplayName(moon, mi, _LV);
                        mwLink = `[[${_sanitize(systemName)} - ${_sanitize(parentName)} - ${_sanitize(moonName)} (${hexCode})]]`;
                        break outer;
                    }
                }
            }
        }
        if (mwLink) {
            if (_show(_LV, 'g')) lines.push(`**Mainworld:** ${mwLink}  `);
        }

        lines.push(
            '',
            '## Stars',
            '',
            '| Name | Type | Role |',
            '|---|---|---|',
            ...(starRows.length > 0 ? starRows : ['| — | — | — |']),
            '',
            '## Worlds',
            '',
            '| Name | Type | UWP |',
            '|---|---|---|',
            ...(worldRows.length > 0 ? worldRows : ['| — | — | — |']),
        );

        lines.push(..._mdRender(_notesFor(state)));

        return lines.join('\n');
    }

    function _buildStarFile(star, starIdx, hexId, hexCode, sectorName, systemName, worlds, isMultiStar, state, subsectorLink) {
        const _LV = _levelFor(hexId);
        const starName   = _starDisplayName(star, starIdx, isMultiStar, _LV);
        const systemLink = `[[${_sanitize(systemName)} (${hexCode})]]`;
        const isPrimary  = starIdx === 0;

        // Same (d) gate as the hub: the row count IS the body count.
        const orbitingRows = !_show(_LV, 'd') ? [] : worlds
            .filter(w => (w.parentStarIdx ?? 0) === starIdx)
            .map(w => {
                const wName = _worldDisplayName(w, worlds.indexOf(w), _LV);
                const link  = `[[${_sanitize(systemName)} - ${_sanitize(wName)} (${hexCode})]]`;
                return `| ${link} | ${_typeAnn(w, _LV)} | ${_show(_LV, 'g') ? (w.uwp || '—') : '—'} |`;
            });

        // YAML frontmatter is the Obsidian counterpart of the HTML page's root
        // data-* attributes and leaks exactly the same way — machine-readable
        // metadata that no rendered-text check would ever see. `data-uwp` was
        // this same bug on the HTML side (4.5.4).
        //
        // Spectral type, luminosity class and role are stellar detail, (b), but
        // star PAGES exist from (a). Without these gates a level-(a) export
        // published every star's spectral class, in the frontmatter AND in the
        // body. Found 2026-08-04 by the Obsidian-specific check.
        const lines = [
            '---',
            'type: star',
            `hexId: ${_yamlStr(hexId)}`,
            `hexCode: ${_yamlStr(hexCode)}`,
            `sector: ${_yamlStr(sectorName)}`,
            `system: ${_yamlStr(systemName)}`,
            `name: ${_yamlStr(starName)}`,
        ];
        if (_show(_LV, 'b')) {
            lines.push(`spectralType: "${star.sType}${star.subType ?? ''}"`);
            lines.push(`luminosityClass: "${star.sClass}"`);
            lines.push(`role: "${star.role}"`);
        }
        lines.push(
            '---',
            '',
            `# ${starName}`,
            '',
            `**Subsector:** ${subsectorLink}  `,
            `**System:** ${systemLink}  `,
        );
        // Hand-written lines, NOT block-model output, so filterBlocks() cannot
        // see them — the same trap as the HTML exporter's star <dl>.
        if (_show(_LV, 'b')) {
            lines.push(`**Role:** ${star.role}  `);
            lines.push(`**Type:** ${star.sType}${star.subType ?? ''} ${star.sClass}`);
        }

        // Edition-aware star physical data
        if (state) {
            const rawStar = _findRawStar(state, starIdx);
            if (state.mgtSystem) {
                lines.push(..._mdRender(_F(_formatMgtStarFields(rawStar, isPrimary), 'star', _LV)));
            } else if (state.ctSystem) {
                lines.push(..._mdRender(_F(_formatCtStarFields(rawStar, starIdx), 'star', _LV)));
            } else if (state.t5System) {
                lines.push(..._mdRender(_F(_formatT5StarFields(rawStar, starIdx), 'star', _LV)));
            } else {
                lines.push(..._mdRender(_F(ExportCore.fallbackStarBlocks(star), 'star', _LV)));
            }
        }

        lines.push(
            '',
            '## Orbiting Bodies',
            '',
        );

        if (orbitingRows.length > 0) {
            lines.push('| Name | Type | UWP |', '|---|---|---|', ...orbitingRows);
        } else {
            lines.push('_No bodies recorded for this star._');
        }

        return lines.join('\n');
    }

    function _buildWorldFile(world, worldIdx, hexId, hexCode, sectorName, systemName, stars, starIdx, imageFilename, state, rawWorld, subsectorLink) {
        const _LV = _levelFor(hexId);
        const worldName  = _worldDisplayName(world, worldIdx, _LV);
        const systemLink  = `[[${_sanitize(systemName)} (${hexCode})]]`;
        const isMultiStar = stars.length > 1;
        const star        = stars[starIdx];
        const starName    = star
            ? _starDisplayName(star, starIdx, isMultiStar, _LV)
            : `Star ${starIdx + 1}`;
        const starLink    = `[[${_sanitize(systemName)} - ${_sanitize(starName)} (${hexCode})]]`;
        const travelZone  = ExportCore.travelZone(world);
        const isMainworld = world.type === 'Mainworld';

        const lines = [
            '---',
            `type: ${(isMainworld && _show(_LV, 'g')) ? 'mainworld' : 'world'}`,
            `hexId: ${_yamlStr(hexId)}`,
            `hexCode: ${_yamlStr(hexCode)}`,
            `sector: ${_yamlStr(sectorName)}`,
            `system: ${_yamlStr(systemName)}`,
            `name: ${_yamlStr(worldName)}`,
        ];

        // Frontmatter gates, matching the page body. UWP, starport and trade
        // codes are (g); tech level is (f). Travel zone is (a) and stays.
        if (world.uwp && _show(_LV, 'g'))        lines.push(`uwp: ${_yamlStr(world.uwp)}`);
        if (world.starport && _show(_LV, 'g'))   lines.push(`starport: "${world.starport}"`);
        if (world.tl != null && _show(_LV, 'f')) lines.push(`tl: "${world.tl}"`);
        const tc = _show(_LV, 'g') ? (world.tradeCodes || []) : [];
        lines.push(`tradeCodes: [${tc.map(c => `"${c}"`).join(', ')}]`);
        lines.push(`travelZone: "${travelZone}"`);
        lines.push('---', '');

        lines.push(`# ${worldName}`, '');
        lines.push(`**Subsector:** ${subsectorLink}  `);
        lines.push(`**System:** ${systemLink}  `);
        lines.push(`**Star:** ${starLink}  `);
        if (world.uwp) lines.push(`**UWP:** \`${world.uwp}\``);
        lines.push('');

        if (imageFilename) {
            lines.push(`![[${imageFilename}]]`, '');
        }


        // The whole UWP breakdown table is (g) — never partial. See
        // fog_of_war_field_tags §7.2: a half-filled table advertises how many
        // digits are being withheld, which breaks "withheld = absent".
        if (world.uwp && _show(_LV, 'g')) {
            lines.push(..._mdRender([_h(2, 'UWP Breakdown'), ...ExportCore.uwpTableBlocks(world.uwp), _GAP]));
        }

        lines.push(..._mdRender(_F(ExportCore.detailBlocks(world), 'details', _LV)));

        // Edition-aware physical data
        if (state && rawWorld) {
            if (state.mgtSystem) {
                lines.push(..._mdRender(_F(_formatMgtWorldFields(rawWorld, isMainworld, state), 'world', _LV)));
            } else if (state.ctSystem) {
                lines.push(..._mdRender(_F(_formatCtBodyFields(rawWorld.w, rawWorld.o, isMainworld, state), 'world', _LV)));
            } else if (state.t5System) {
                lines.push(..._mdRender(_F(_formatT5WorldFields(rawWorld.w, rawWorld.o, isMainworld, state), 'world', _LV)));
            } else if (state.rttSystem) {
                lines.push(..._mdRender(_F(_formatRttBodyFields(rawWorld, isMainworld, state), 'world', _LV)));
            } else if (state.aowSystem) {
                lines.push(..._mdRender(_F(ExportCore.formatAoWBodyFields(rawWorld, isMainworld, state), 'world', _LV)));
            }
        } else {
            lines.push(..._mdRender(_F(ExportCore.fallbackPhysicalBlocks(world), 'world', _LV)));
        }

        // Socioeconomics (mainworld only)
        if (isMainworld && state) {
            lines.push(..._mdRender(_F(ExportCore.socioBlocks(state, rawWorld), 'socio', _LV)));
            lines.push(..._mdRender(_notesFor(state)));
        }

        const moons = world.moons || [];
        if (moons.length > 0) {
            lines.push('', '## Moons', '', '| Name | UWP |', '|---|---|');
            moons.forEach((m, mi) => {
                const mName = _moonDisplayName(m, mi, _LV);
                const link  = `[[${_sanitize(systemName)} - ${_sanitize(worldName)} - ${_sanitize(mName)} (${hexCode})]]`;
                lines.push(`| ${link} | ${m.uwp || '—'} |`);
            });
        }

        return lines.join('\n');
    }

    function _buildMoonFile(moon, moonIdx, parentWorldName, hexId, hexCode, sectorName, systemName, imageFilename, state, rawMoon, subsectorLink) {
        const _LV = _levelFor(hexId);
        const moonName    = _moonDisplayName(moon, moonIdx, _LV);
        const systemLink  = `[[${_sanitize(systemName)} (${hexCode})]]`;
        const worldLink   = `[[${_sanitize(systemName)} - ${_sanitize(parentWorldName)} (${hexCode})]]`;
        const isLunarMainworld = moon.type === 'Mainworld' || moon.isLunarMainworld;

        const lines = [
            '---',
            'type: moon',
            `hexId: ${_yamlStr(hexId)}`,
            `hexCode: ${_yamlStr(hexCode)}`,
            `sector: ${_yamlStr(sectorName)}`,
            `system: ${_yamlStr(systemName)}`,
            `name: ${_yamlStr(moonName)}`,
            `parentWorld: ${_yamlStr(parentWorldName)}`,
        ];

        if (moon.uwp && _show(_LV, 'g'))        lines.push(`uwp: ${_yamlStr(moon.uwp)}`);
        if (moon.tl != null && _show(_LV, 'f')) lines.push(`tl: "${moon.tl}"`);
        lines.push('---', '');

        lines.push(`# ${moonName}`, '');
        lines.push(`**Subsector:** ${subsectorLink}  `);
        lines.push(`**System:** ${systemLink}  `);
        lines.push(`**Parent World:** ${worldLink}  `);
        if (moon.uwp) lines.push(`**UWP:** \`${moon.uwp}\``);
        lines.push('');

        if (imageFilename) {
            lines.push(`![[${imageFilename}]]`, '');
        }


        if (moon.uwp && _show(_LV, 'g')) {
            lines.push(..._mdRender([_h(2, 'UWP Breakdown'), ...ExportCore.uwpTableBlocks(moon.uwp), _GAP]));
        }

        lines.push(..._mdRender(_F(ExportCore.detailBlocks(moon), 'details', _LV)));

        // Edition-aware physical data. Context is 'moon' — §5, moons inherit
        // their parent world's levels, plus the one moon-only field.
        if (state && rawMoon) {
            if (state.mgtSystem) {
                lines.push(..._mdRender(_F(_formatMgtMoonFields(rawMoon), 'moon', _LV)));
            } else if (state.ctSystem) {
                lines.push(..._mdRender(_F(_formatCtSatFields(rawMoon, isLunarMainworld, state), 'moon', _LV)));
            } else if (state.t5System) {
                lines.push(..._mdRender(_F(_formatT5SatFields(rawMoon), 'moon', _LV)));
            } else if (state.rttSystem) {
                lines.push(..._mdRender(_F(_formatRttBodyFields(rawMoon, isLunarMainworld, state), 'moon', _LV)));
            } else if (state.aowSystem) {
                lines.push(..._mdRender(_F(ExportCore.formatAoWBodyFields(rawMoon, isLunarMainworld, state), 'moon', _LV)));
            }
        } else {
            lines.push(..._mdRender(_F(ExportCore.fallbackPhysicalBlocks(moon), 'moon', _LV)));
        }

        // Socioeconomics for lunar mainworlds
        if (isLunarMainworld && state) {
            lines.push(..._mdRender(_F(ExportCore.socioBlocks(state, rawMoon), 'socio', _LV)));
        }

        return lines.join('\n');
    }

    // ── Export orchestrator ───────────────────────────────────────────────────

    async function startExport(sectorNum, subsectorChar, options) {
        const { includeImages, imageProjection, skipAirless, includeSystemImages, useSubfolders, playerVersion, onProgress, onDone, onError } = options || {};

        // Release 2. Absent/false keeps every existing call on the GM path, where
        // _levelFor() returns null and filterBlocks() is the identity function.
        _playerMode = !!playerVersion;

        const report = (done, total, msg) => onProgress && onProgress(done, total, msg);

        const systems = [];
        hexStates.forEach((state, hexId) => {
            const parts = hexId.split('-');
            if (parseInt(parts[0]) !== sectorNum) return;
            if (parts[1] !== subsectorChar) return;
            if (!state || state.type === 'EMPTY') return;
            // Level (0) "Unknown": the system does not appear in a players'
            // export AT ALL — no page, no index row, no filename. Filtering its
            // fields would not be enough, because a file called
            // "Regina (1910).md" proves Regina exists (manifest 5.2.2).
            if (_playerMode && _levelFor(hexId) === '0') return;
            systems.push({ hexId, hexCode: parts[2], state });
        });

        if (systems.length === 0) {
            onError && onError(_playerMode
                ? 'No systems in this subsector are disclosed to players.'
                : 'No systems found in this subsector.');
            return;
        }

        const sectorName = (window.sectorNames && window.sectorNames[sectorNum])
            || `Sector ${sectorNum}`;
        const enc           = new TextEncoder();
        const files         = [];
        const prefix        = useSubfolders ? `Subsector ${subsectorChar}/` : '';
        const subsectorLink = `[[${_sanitize(sectorName)} - Subsector ${subsectorChar}]]`;

        // Subsector map image embedded in the index page — independent of the
        // "Include system orrery images" setting, which only controls per-system
        // orrery snapshots.
        let mapImageFilename = null;
        if (typeof captureSubsector !== 'undefined') {
            report(0, systems.length, 'Capturing subsector map image…');
            const mapPng = await captureSubsector(sectorNum, subsectorChar, 900, 1000,
                                                  { disclosure: _playerMode ? _levelFor : null });
            if (mapPng) {
                mapImageFilename = `${_sanitize(sectorName)} - Subsector ${subsectorChar} - Map.png`;
                files.push({ name: prefix + 'images/' + mapImageFilename, data: mapPng });
            }
        }

        const indexMd   = _buildSubsectorIndex(sectorName, subsectorChar, systems, mapImageFilename);
        const indexName = `${_sanitize(sectorName)} - Subsector ${subsectorChar}.md`;
        files.push({ name: indexName, data: enc.encode(indexMd) });

        report(0, systems.length, 'Building subsector index…');

        for (let si = 0; si < systems.length; si++) {
            const { hexId, hexCode, state } = systems[si];
            const _oLV = _levelFor(hexId);
            const systemName = _resolveSystemName(state, _oLV, hexCode);

            report(si, systems.length, `Processing ${systemName}…`);

            const normalized = (typeof SystemViewer !== 'undefined')
                ? SystemViewer.normalizeSystem(state)
                : null;

            if (!normalized) {
                const stub = [
                    '---',
                    'type: system',
                    `hexId: ${_yamlStr(hexId)}`,
                    `hexCode: ${_yamlStr(hexCode)}`,
                    `sector: ${_yamlStr(sectorName)}`,
                    `subsector: ${_yamlStr(subsectorChar)}`,
                    '---',
                    '',
                    `# ${systemName}`,
                    '',
                    '_No system data generated for this hex._',
                ].join('\n');
                files.push({ name: prefix + _systemFilename(systemName, hexCode, 'md'), data: enc.encode(stub) });
                continue;
            }

            const stars  = normalized.stars  || [];
            const worlds = normalized.worlds || [];

            // Optional orrery snapshot image for the system hub page
            let sysImageFilename = null;
            // Orrery gated at (d); re-rendered with generic labels and no
            // mainworld highlight below (g) — the labels are pixels (§9.2a).
            if (includeSystemImages && _show(_oLV, 'd') && typeof SystemViewer !== 'undefined') {
                const imgData = await SystemViewer.renderSnapshot(state, 900, 500, { level: _oLV });
                if (imgData) {
                    sysImageFilename = _systemFilename(systemName, hexCode, 'png');
                    files.push({ name: prefix + 'images/' + sysImageFilename, data: imgData });
                }
            }

            const hubMd = _buildSystemHub(hexId, hexCode, sectorName, subsectorChar, state, normalized, sysImageFilename, subsectorLink);
            files.push({ name: prefix + _systemFilename(systemName, hexCode, 'md'), data: enc.encode(hubMd) });

            // Stars
            const isMultiStar = stars.length > 1;
            for (let starI = 0; starI < stars.length; starI++) {
                const star     = stars[starI];
                const starName = _starDisplayName(star, starI, isMultiStar, _oLV);
                const starMd   = _buildStarFile(star, starI, hexId, hexCode, sectorName, systemName, worlds, isMultiStar, state, subsectorLink);
                files.push({ name: prefix + _bodyFilename(systemName, starName, hexCode, 'md'), data: enc.encode(starMd) });
            }

            // Worlds and moons — NO body files at all below (d). In this
            // exporter each body is its own .md, so the file listing alone
            // discloses the body count and type ("… - Giant 3 (1910).md").
            // Suppressing the file is the only way to withhold that.
            for (let wi = 0; _show(_oLV, 'd') && wi < worlds.length; wi++) {
                const world     = worlds[wi];
                const worldName = _worldDisplayName(world, wi, _oLV);
                const starIdx   = world.parentStarIdx ?? 0;

                // Look up raw world for extended fields
                const rawWorld = _findRawWorld(state, world);

                let imageFilename = null;
                // A rendered world is a picture of its hydrographics and
                // atmosphere — both (e) — so it gates at (e) whatever the
                // "include world images" checkbox says (§5.2.3 / §9.1).
                const wantImage = includeImages && _show(_oLV, 'e') && _canRenderImage(world) &&
                                  !(skipAirless && _isAirless(world));
                if (wantImage) {
                    const imgData = await _renderWorldImage(world, hexId, imageProjection, `w${wi}`);
                    if (imgData) {
                        imageFilename = _bodyFilename(systemName, worldName, hexCode, 'png');
                        files.push({ name: prefix + 'images/' + imageFilename, data: imgData });
                    }
                }

                const worldMd = _buildWorldFile(world, wi, hexId, hexCode, sectorName, systemName, stars, starIdx, imageFilename, state, rawWorld, subsectorLink);
                files.push({ name: prefix + _bodyFilename(systemName, worldName, hexCode, 'md'), data: enc.encode(worldMd) });

                // Moons
                for (let mi = 0; mi < (world.moons || []).length; mi++) {
                    const moon     = world.moons[mi];
                    const moonName = _moonDisplayName(moon, mi, _oLV);

                    // Look up raw moon for extended fields
                    const rawMoon = _findRawMoon(state, rawWorld, moon, mi);

                    let moonImageFilename = null;
                    const wantMoonImage = includeImages && _show(_oLV, 'e') && _canRenderImage(moon) &&
                                         !(skipAirless && _isAirless(moon));
                    if (wantMoonImage) {
                        const imgData = await _renderWorldImage(moon, hexId, imageProjection, `w${wi}-m${mi}`);
                        if (imgData) {
                            moonImageFilename = `${_sanitize(systemName)} - ${_sanitize(worldName)} - ${_sanitize(moonName)} (${hexCode}).png`;
                            files.push({ name: prefix + 'images/' + moonImageFilename, data: imgData });
                        }
                    }

                    const moonMd   = _buildMoonFile(moon, mi, worldName, hexId, hexCode, sectorName, systemName, moonImageFilename, state, rawMoon, subsectorLink);
                    const moonFile = `${_sanitize(systemName)} - ${_sanitize(worldName)} - ${_sanitize(moonName)} (${hexCode}).md`;
                    files.push({ name: prefix + moonFile, data: enc.encode(moonMd) });
                }
            }

            await new Promise(r => setTimeout(r, 0));
        }

        report(systems.length, systems.length, 'Building ZIP…');

        const zipData = _buildZip(files);
        downloadBlob(
            zipData,
            `${_sanitize(sectorName)}_Subsector_${subsectorChar}_Wiki${_playerMode ? '_PLAYERS' : ''}.zip`,
            'application/zip'
        );

        onDone && onDone(files.length);
    }

    return { startExport };

})();

window.ObsidianExporter = ObsidianExporter;
