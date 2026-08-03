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

    // ── Markdown builders ─────────────────────────────────────────────────────

    function _buildSubsectorIndex(sectorName, subsectorChar, systems, mapImageFilename) {
        const rows = systems.map(s => {
            const name = _resolveSystemName(s.state);
            const uwp  = _resolveUWP(s.state);
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
        const systemName = _resolveSystemName(state);
        const edition    = normalized.edition || 'Unknown';
        const allegiance = state.allegiance || '—';
        const stars      = normalized.stars  || [];
        const worlds     = normalized.worlds || [];
        const mainworld  = worlds.find(w => w.type === 'Mainworld');
        const mwUwp      = (mainworld && mainworld.uwp) ? mainworld.uwp : _resolveUWP(state);

        const isMultiStar = stars.length > 1;
        const starRows = stars.map((s, i) => {
            const sName = _starDisplayName(s, i, isMultiStar);
            const link  = `[[${_sanitize(systemName)} - ${_sanitize(sName)} (${hexCode})]]`;
            return `| ${link} | ${s.sType}${s.subType ?? ''} ${s.sClass} | ${s.role} |`;
        });

        const worldRows = worlds.map((w, i) => {
            const wName = _worldDisplayName(w, i);
            const link  = `[[${_sanitize(systemName)} - ${_sanitize(wName)} (${hexCode})]]`;
            return `| ${link} | ${w.type} | ${w.uwp || '—'} |`;
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

        lines.push(..._mdRender(ExportCore.systemOverviewBlocks(state)));

        // Pass 1: mainworld is a top-level world
        let mwLink = null;
        if (mainworld) {
            const mwIdx  = worlds.indexOf(mainworld);
            const mwName = _worldDisplayName(mainworld, mwIdx);
            mwLink = `[[${_sanitize(systemName)} - ${_sanitize(mwName)} (${hexCode})]]`;
        } else {
            // Pass 2: mainworld is a moon of another body (lunar mainworld)
            outer: for (let wi = 0; wi < worlds.length; wi++) {
                const moons = worlds[wi].moons || [];
                for (let mi = 0; mi < moons.length; mi++) {
                    const moon = moons[mi];
                    if (moon.type === 'Mainworld' || moon.isLunarMainworld) {
                        const parentName = _worldDisplayName(worlds[wi], wi);
                        const moonName   = _moonDisplayName(moon, mi);
                        mwLink = `[[${_sanitize(systemName)} - ${_sanitize(parentName)} - ${_sanitize(moonName)} (${hexCode})]]`;
                        break outer;
                    }
                }
            }
        }
        if (mwLink) {
            lines.push(`**Mainworld:** ${mwLink}  `);
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

        lines.push(..._mdRender(ExportCore.notesBlocks(state)));

        return lines.join('\n');
    }

    function _buildStarFile(star, starIdx, hexId, hexCode, sectorName, systemName, worlds, isMultiStar, state, subsectorLink) {
        const starName   = _starDisplayName(star, starIdx, isMultiStar);
        const systemLink = `[[${_sanitize(systemName)} (${hexCode})]]`;
        const isPrimary  = starIdx === 0;

        const orbitingRows = worlds
            .filter(w => (w.parentStarIdx ?? 0) === starIdx)
            .map(w => {
                const wName = _worldDisplayName(w, worlds.indexOf(w));
                const link  = `[[${_sanitize(systemName)} - ${_sanitize(wName)} (${hexCode})]]`;
                return `| ${link} | ${w.type} | ${w.uwp || '—'} |`;
            });

        const lines = [
            '---',
            'type: star',
            `hexId: ${_yamlStr(hexId)}`,
            `hexCode: ${_yamlStr(hexCode)}`,
            `sector: ${_yamlStr(sectorName)}`,
            `system: ${_yamlStr(systemName)}`,
            `name: ${_yamlStr(starName)}`,
            `spectralType: "${star.sType}${star.subType ?? ''}"`,
            `luminosityClass: "${star.sClass}"`,
            `role: "${star.role}"`,
            '---',
            '',
            `# ${starName}`,
            '',
            `**Subsector:** ${subsectorLink}  `,
            `**System:** ${systemLink}  `,
            `**Role:** ${star.role}  `,
            `**Type:** ${star.sType}${star.subType ?? ''} ${star.sClass}`,
        ];

        // Edition-aware star physical data
        if (state) {
            const rawStar = _findRawStar(state, starIdx);
            if (state.mgtSystem) {
                lines.push(..._mdRender(_formatMgtStarFields(rawStar, isPrimary)));
            } else if (state.ctSystem) {
                lines.push(..._mdRender(_formatCtStarFields(rawStar, starIdx)));
            } else if (state.t5System) {
                lines.push(..._mdRender(_formatT5StarFields(rawStar, starIdx)));
            } else {
                lines.push(..._mdRender(ExportCore.fallbackStarBlocks(star)));
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
        const worldName  = _worldDisplayName(world, worldIdx);
        const systemLink  = `[[${_sanitize(systemName)} (${hexCode})]]`;
        const isMultiStar = stars.length > 1;
        const star        = stars[starIdx];
        const starName    = star
            ? _starDisplayName(star, starIdx, isMultiStar)
            : `Star ${starIdx + 1}`;
        const starLink    = `[[${_sanitize(systemName)} - ${_sanitize(starName)} (${hexCode})]]`;
        const travelZone  = ExportCore.travelZone(world);
        const isMainworld = world.type === 'Mainworld';

        const lines = [
            '---',
            `type: ${isMainworld ? 'mainworld' : 'world'}`,
            `hexId: ${_yamlStr(hexId)}`,
            `hexCode: ${_yamlStr(hexCode)}`,
            `sector: ${_yamlStr(sectorName)}`,
            `system: ${_yamlStr(systemName)}`,
            `name: ${_yamlStr(worldName)}`,
        ];

        if (world.uwp)        lines.push(`uwp: ${_yamlStr(world.uwp)}`);
        if (world.starport)   lines.push(`starport: "${world.starport}"`);
        if (world.tl != null) lines.push(`tl: "${world.tl}"`);
        const tc = world.tradeCodes || [];
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

        if (world.uwp) {
            lines.push(..._mdRender([_h(2, 'UWP Breakdown'), ...ExportCore.uwpTableBlocks(world.uwp), _GAP]));
        }

        lines.push(..._mdRender(ExportCore.detailBlocks(world)));

        // Edition-aware physical data
        if (state && rawWorld) {
            if (state.mgtSystem) {
                lines.push(..._mdRender(_formatMgtWorldFields(rawWorld, isMainworld, state)));
            } else if (state.ctSystem) {
                lines.push(..._mdRender(_formatCtBodyFields(rawWorld.w, rawWorld.o, isMainworld, state)));
            } else if (state.t5System) {
                lines.push(..._mdRender(_formatT5WorldFields(rawWorld.w, rawWorld.o, isMainworld, state)));
            } else if (state.rttSystem) {
                lines.push(..._mdRender(_formatRttBodyFields(rawWorld, isMainworld, state)));
            } else if (state.aowSystem) {
                lines.push(..._mdRender(ExportCore.formatAoWBodyFields(rawWorld, isMainworld, state)));
            }
        } else {
            lines.push(..._mdRender(ExportCore.fallbackPhysicalBlocks(world)));
        }

        // Socioeconomics (mainworld only)
        if (isMainworld && state) {
            lines.push(..._mdRender(ExportCore.socioBlocks(state, rawWorld)));
            lines.push(..._mdRender(ExportCore.notesBlocks(state)));
        }

        const moons = world.moons || [];
        if (moons.length > 0) {
            lines.push('', '## Moons', '', '| Name | UWP |', '|---|---|');
            moons.forEach((m, mi) => {
                const mName = _moonDisplayName(m, mi);
                const link  = `[[${_sanitize(systemName)} - ${_sanitize(worldName)} - ${_sanitize(mName)} (${hexCode})]]`;
                lines.push(`| ${link} | ${m.uwp || '—'} |`);
            });
        }

        return lines.join('\n');
    }

    function _buildMoonFile(moon, moonIdx, parentWorldName, hexId, hexCode, sectorName, systemName, imageFilename, state, rawMoon, subsectorLink) {
        const moonName    = _moonDisplayName(moon, moonIdx);
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

        if (moon.uwp)        lines.push(`uwp: ${_yamlStr(moon.uwp)}`);
        if (moon.tl != null) lines.push(`tl: "${moon.tl}"`);
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

        if (moon.uwp) {
            lines.push(..._mdRender([_h(2, 'UWP Breakdown'), ...ExportCore.uwpTableBlocks(moon.uwp), _GAP]));
        }

        lines.push(..._mdRender(ExportCore.detailBlocks(moon)));

        // Edition-aware physical data
        if (state && rawMoon) {
            if (state.mgtSystem) {
                lines.push(..._mdRender(_formatMgtMoonFields(rawMoon)));
            } else if (state.ctSystem) {
                lines.push(..._mdRender(_formatCtSatFields(rawMoon, isLunarMainworld, state)));
            } else if (state.t5System) {
                lines.push(..._mdRender(_formatT5SatFields(rawMoon)));
            } else if (state.rttSystem) {
                lines.push(..._mdRender(_formatRttBodyFields(rawMoon, isLunarMainworld, state)));
            } else if (state.aowSystem) {
                lines.push(..._mdRender(ExportCore.formatAoWBodyFields(rawMoon, isLunarMainworld, state)));
            }
        } else {
            lines.push(..._mdRender(ExportCore.fallbackPhysicalBlocks(moon)));
        }

        // Socioeconomics for lunar mainworlds
        if (isLunarMainworld && state) {
            lines.push(..._mdRender(ExportCore.socioBlocks(state, rawMoon)));
        }

        return lines.join('\n');
    }

    // ── Export orchestrator ───────────────────────────────────────────────────

    async function startExport(sectorNum, subsectorChar, options) {
        const { includeImages, imageProjection, skipAirless, includeSystemImages, useSubfolders, onProgress, onDone, onError } = options || {};

        const report = (done, total, msg) => onProgress && onProgress(done, total, msg);

        const systems = [];
        hexStates.forEach((state, hexId) => {
            const parts = hexId.split('-');
            if (parseInt(parts[0]) !== sectorNum) return;
            if (parts[1] !== subsectorChar) return;
            if (!state || state.type === 'EMPTY') return;
            systems.push({ hexId, hexCode: parts[2], state });
        });

        if (systems.length === 0) {
            onError && onError('No systems found in this subsector.');
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
            const mapPng = await captureSubsector(sectorNum, subsectorChar, 900, 1000);
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
            const systemName = _resolveSystemName(state);

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
            if (includeSystemImages && typeof SystemViewer !== 'undefined') {
                const imgData = await SystemViewer.renderSnapshot(state, 900, 500);
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
                const starName = _starDisplayName(star, starI, isMultiStar);
                const starMd   = _buildStarFile(star, starI, hexId, hexCode, sectorName, systemName, worlds, isMultiStar, state, subsectorLink);
                files.push({ name: prefix + _bodyFilename(systemName, starName, hexCode, 'md'), data: enc.encode(starMd) });
            }

            // Worlds and moons
            for (let wi = 0; wi < worlds.length; wi++) {
                const world     = worlds[wi];
                const worldName = _worldDisplayName(world, wi);
                const starIdx   = world.parentStarIdx ?? 0;

                // Look up raw world for extended fields
                const rawWorld = _findRawWorld(state, world);

                let imageFilename = null;
                const wantImage = includeImages && _canRenderImage(world) &&
                                  !(skipAirless && _isAirless(world));
                if (wantImage) {
                    const imgData = await _renderWorldImage(world, `${hexId}-w${wi}`, imageProjection);
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
                    const moonName = _moonDisplayName(moon, mi);

                    // Look up raw moon for extended fields
                    const rawMoon = _findRawMoon(state, rawWorld, moon, mi);

                    let moonImageFilename = null;
                    const wantMoonImage = includeImages && _canRenderImage(moon) &&
                                         !(skipAirless && _isAirless(moon));
                    if (wantMoonImage) {
                        const imgData = await _renderWorldImage(moon, `${hexId}-w${wi}-m${mi}`, imageProjection);
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
            `${_sanitize(sectorName)}_Subsector_${subsectorChar}_Wiki.zip`,
            'application/zip'
        );

        onDone && onDone(files.length);
    }

    return { startExport };

})();

window.ObsidianExporter = ObsidianExporter;
