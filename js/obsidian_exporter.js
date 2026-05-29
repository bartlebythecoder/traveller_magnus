'use strict';

// =============================================================================
// OBSIDIAN_EXPORTER.JS — Export a subsector as a flat Obsidian wiki
// Produces one markdown file per star, world, and moon, plus a subsector index.
// Optionally embeds a procedurally rendered image for each terrestrial world.
//
// Entry point: ObsidianExporter.startExport(sectorNum, subsectorChar, options)
// options: { includeImages, skipAirless, includeSystemImages,
//            onProgress(done,total,msg), onDone(fileCount), onError(msg) }
// includeSystemImages: true → captures a PNG orrery per system hub page AND
//                             a PNG hex-map snapshot for the subsector index page.
// =============================================================================

const ObsidianExporter = (() => {

    // ── CRC-32 ────────────────────────────────────────────────────────────────

    const _CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c;
        }
        return t;
    })();

    function _crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = _CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // ── ZIP builder (stored / uncompressed entries) ───────────────────────────

    function _buildZip(entries) {
        const enc = new TextEncoder();

        const processed = entries.map(e => ({
            nameBytes: enc.encode(e.name),
            data:      e.data,
            crc:       _crc32(e.data),
        }));

        const localOffsets = [];
        let localSize = 0;
        processed.forEach(e => {
            localOffsets.push(localSize);
            localSize += 30 + e.nameBytes.length + e.data.length;
        });

        const centralSize = processed.reduce((s, e) => s + 46 + e.nameBytes.length, 0);
        const buf  = new Uint8Array(localSize + centralSize + 22);
        const view = new DataView(buf.buffer);
        let pos = 0;

        const w16 = v => { view.setUint16(pos, v, true);      pos += 2; };
        const w32 = v => { view.setUint32(pos, v >>> 0, true); pos += 4; };
        const wb  = b => { buf.set(b, pos);                    pos += b.length; };

        processed.forEach(e => {
            w32(0x04034b50); w16(20); w16(0x0800); w16(0);
            w16(0); w16(0);
            w32(e.crc); w32(e.data.length); w32(e.data.length);
            w16(e.nameBytes.length); w16(0);
            wb(e.nameBytes); wb(e.data);
        });

        processed.forEach((e, i) => {
            w32(0x02014b50); w16(20); w16(20); w16(0x0800); w16(0);
            w16(0); w16(0);
            w32(e.crc); w32(e.data.length); w32(e.data.length);
            w16(e.nameBytes.length); w16(0); w16(0); w16(0); w16(0);
            w32(0); w32(localOffsets[i]);
            wb(e.nameBytes);
        });

        w32(0x06054b50); w16(0); w16(0);
        w16(processed.length); w16(processed.length);
        w32(centralSize); w32(localSize);
        w16(0);

        return buf;
    }

    // ── Filename / YAML helpers ───────────────────────────────────────────────

    function _sanitize(str) {
        return (str || 'Unknown').replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    }

    function _yamlStr(s) {
        return '"' + String(s || '').replace(/"/g, '\\"') + '"';
    }

    function _systemFilename(systemName, hexCode, ext) {
        return `${_sanitize(systemName)} (${hexCode}).${ext}`;
    }

    function _bodyFilename(systemName, bodyName, hexCode, ext) {
        return `${_sanitize(systemName)} - ${_sanitize(bodyName)} (${hexCode}).${ext}`;
    }

    function _worldDisplayName(world, idx) {
        if (world.name) return world.name;
        const t = world.type || 'Body';
        if (t === 'Gas Giant')      return `Giant ${idx + 1}`;
        if (t === 'Planetoid Belt') return `Belt ${idx + 1}`;
        return `World ${idx + 1}`;
    }

    function _moonDisplayName(moon, idx) {
        return moon.name || `Moon ${idx + 1}`;
    }

    // In multi-star systems append the conventional letter (A, B, C …) so that
    // two stars of identical spectral type never produce the same filename/link.
    function _starDisplayName(star, starIdx, isMultiStar) {
        const base = star.name || `Star ${starIdx + 1}`;
        return isMultiStar ? `${base} ${String.fromCharCode(65 + starIdx)}` : base;
    }

    // ── UWP breakdown table ───────────────────────────────────────────────────

    function _uwpTable(uwp) {
        if (!uwp || uwp.length < 9) return '';
        const rows = [
            ['Starport',      uwp[0]],
            ['Size',          uwp[1]],
            ['Atmosphere',    uwp[2]],
            ['Hydrographics', uwp[3]],
            ['Population',    uwp[4]],
            ['Government',    uwp[5]],
            ['Law Level',     uwp[6]],
            ['Tech Level',    uwp[8]],
        ];
        return '| Attribute | Code |\n|---|---|\n' +
            rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n');
    }

    // ── System name / UWP resolvers ───────────────────────────────────────────

    function _resolveSystemName(state) {
        if (state.name) return state.name;
        const sys = state.mgtSystem || state.ctSystem || state.t5System || state.rttSystem;
        if (sys && sys.name) return sys.name;
        if (sys && sys.mainworld && sys.mainworld.name) return sys.mainworld.name;
        return 'Unnamed';
    }

    function _resolveUWP(state) {
        if (state.uwp) return state.uwp;
        const src = state.mgt2eData || state.ctData || state.t5Data || state.rttData;
        if (src && src.uwp) return src.uwp;
        const sys = state.mgtSystem || state.ctSystem || state.t5System || state.rttSystem;
        if (sys && sys.mainworld && sys.mainworld.uwp) return sys.mainworld.uwp;
        return '???????-?';
    }

    // ── Temperature helper ────────────────────────────────────────────────────

    function _kToC(k) { return (k - 273).toFixed(0); }

    // ── Raw body finders ──────────────────────────────────────────────────────

    function _findMgtRawWorld(state, nw) {
        const worlds = (state.mgtSystem && state.mgtSystem.worlds) || [];
        if (nw.orbitId != null) {
            const m = worlds.find(w =>
                Math.abs((w.orbitId || 0) - nw.orbitId) < 0.001 &&
                (w.parentStarIdx ?? 0) === (nw.parentStarIdx ?? 0)
            );
            if (m) return m;
        }
        if (nw.name) return worlds.find(w => w.name === nw.name) || null;
        if (nw.type === 'Mainworld') return worlds.find(w => w.type === 'Mainworld' || w.isLunarMainworld) || null;
        return null;
    }

    function _findCtRawBody(state, nw) {
        const sys = state.ctSystem;
        if (!sys) return null;
        const all = [];
        (sys.orbits || []).forEach(o => { if (o.contents) all.push({ w: o.contents, o }); });
        (sys.capturedPlanets || []).forEach(p => all.push({ w: p, o: { orbit: p.orbit, zone: p.zone } }));
        if (nw.name) { const f = all.find(b => b.w.name === nw.name); if (f) return f; }
        if (nw.type === 'Mainworld') return all.find(b => b.w.type === 'Mainworld') || null;
        return null;
    }

    function _findT5RawWorld(state, nw) {
        const sys = state.t5System;
        if (!sys || !sys.stars) return null;
        for (const star of sys.stars) {
            for (const o of (star.orbits || [])) {
                const w = o.contents;
                if (!w || w.type === 'Empty') continue;
                if (nw.name && w.name === nw.name) return { w, o };
                if (!nw.name && nw.type === 'Mainworld' && w.type === 'Mainworld') return { w, o };
            }
        }
        return null;
    }

    function _findRttRawBody(state, nw) {
        const sys = state.rttSystem;
        if (!sys) return null;
        const all = [];
        (sys.worlds || []).forEach(b => { if (b) all.push(b); });
        (sys.stars || []).forEach(s => {
            (s.orbits || []).forEach(o => {
                const body = (o && o.contents) ? o.contents : null;
                if (body) all.push(body);
            });
        });
        if (nw.name) return all.find(b => b.name === nw.name) || null;
        if (nw.type === 'Mainworld') return all.find(b => b.isMainworld || b.habitationType === 'Homeworld') || null;
        return null;
    }

    function _findRawWorld(state, nw) {
        if (state.mgtSystem) return _findMgtRawWorld(state, nw);
        if (state.ctSystem)  return _findCtRawBody(state, nw);
        if (state.t5System)  return _findT5RawWorld(state, nw);
        if (state.rttSystem) return _findRttRawBody(state, nw);
        return null;
    }

    function _findRawMoon(state, rawWorld, normalizedMoon, moonIdx) {
        if (!rawWorld) return null;
        if (state.mgtSystem) {
            const moons = rawWorld.moons || [];
            if (moonIdx < moons.length) return moons[moonIdx];
            return normalizedMoon.name ? (moons.find(m => m.name === normalizedMoon.name) || null) : null;
        }
        if (state.ctSystem) {
            const sats = (rawWorld.w && rawWorld.w.satellites) || [];
            return moonIdx < sats.length ? sats[moonIdx] : null;
        }
        if (state.t5System) {
            const sats = (rawWorld.w && rawWorld.w.satellites) || [];
            return moonIdx < sats.length ? sats[moonIdx] : null;
        }
        if (state.rttSystem) {
            const sats = rawWorld.satellites || [];
            return moonIdx < sats.length ? sats[moonIdx] : null;
        }
        return null;
    }

    function _findRawStar(state, starIdx) {
        if (state.mgtSystem) return (state.mgtSystem.stars || [])[starIdx] || null;
        if (state.ctSystem)  return (state.ctSystem.stars  || [])[starIdx] || null;
        if (state.t5System)  return (state.t5System.stars  || [])[starIdx] || null;
        return null;
    }

    // ── Edition-aware field formatters ────────────────────────────────────────

    function _formatMgtWorldFields(raw, isMainworld, state) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];

        if (raw.classifications && raw.classifications.length > 0)
            lines.push(`**Classification:** ${raw.classifications.join(', ')}  `);

        lines.push('', '### Orbital Data', '');
        if (raw.orbitId  != null) lines.push(`**Orbit ID:** ${raw.orbitId.toFixed(2)}  `);
        if (raw.orbitType)        lines.push(`**Orbit Type:** ${raw.orbitType}  `);
        if (raw.au != null)       lines.push(`**Distance:** ${raw.au} AU  `);
        if (raw.eccentricity != null) lines.push(`**Eccentricity:** ${raw.eccentricity}  `);
        if (raw.periodYears != null) {
            const ps = raw.periodYears < 1
                ? `${(raw.periodYears * 365.25).toFixed(1)} days`
                : `${raw.periodYears.toFixed(2)} years`;
            lines.push(`**Period:** ${ps}  `);
        }

        const isBelt = raw.type === 'Planetoid Belt';
        const isGG   = raw.type === 'Gas Giant';
        const noBody = raw.size == 0 || raw.size === 'R';

        if (!isBelt && !noBody) {
            lines.push('', '### Physical Properties', '');
            if (raw.composition != null) lines.push(`**Composition:** ${raw.composition}  `);
            if (raw.density != null)     lines.push(`**Density:** ${Number(raw.density).toFixed(3)} ρ⊕  `);
            if (raw.gravity != null)     lines.push(`**Gravity:** ${raw.gravity} G  `);
            if (raw.mass != null)        lines.push(`**Mass:** ${raw.mass} M⊕  `);
            if (!isGG && raw.diamKm != null)   lines.push(`**Diameter:** ${Math.round(raw.diamKm).toLocaleString()} km  `);
            if (isGG && raw.diamTerra != null) lines.push(`**Diameter:** ${raw.diamTerra} T⊕  `);
            if (raw.hydroPercent != null) lines.push(`**Hydrographics:** ${raw.hydroPercent}%  `);

            if (raw.meanTempK != null) {
                lines.push('', '### Temperature', '');
                lines.push(`**Mean:** ${_kToC(raw.meanTempK)} °C  `);
                if (raw.lowTempK  != null && !isNaN(raw.lowTempK))  lines.push(`**Low:** ${_kToC(raw.lowTempK)} °C  `);
                if (raw.highTempK != null && !isNaN(raw.highTempK)) lines.push(`**High:** ${_kToC(raw.highTempK)} °C  `);
            }

            lines.push('', '### Atmosphere', '');
            if (raw.gases && raw.gases.length > 0)
                lines.push(`**Gases:** ${raw.gases.join(', ')}  `);
            else if (raw.oxygenFraction != null)
                lines.push(`**O₂ Fraction:** ${raw.oxygenFraction}  `);
            else
                lines.push(`**Atmosphere:** None  `);
            if (raw.totalPressureBar != null) lines.push(`**Pressure:** ${raw.totalPressureBar} bar  `);
            if (raw.taints) {
                const arr = Array.isArray(raw.taints) ? raw.taints : [raw.taints];
                if (arr.length) lines.push(`**Taints:** ${arr.join(', ')}  `);
            }

            lines.push('', '### Rotation', '');
            if (raw.solarDayHours != null) {
                if (raw.solarDayHours === Infinity || raw.isTwilightZone)
                    lines.push(`**Solar Day:** Twilight Zone  `);
                else
                    lines.push(`**Solar Day:** ${raw.solarDayHours} hrs  `);
            }
            if (raw.axialTilt != null) lines.push(`**Axial Tilt:** ${raw.axialTilt}°  `);
        }

        if (isGG && raw.uwpGG) {
            lines.push('', '### Gas Giant Profile', '');
            lines.push(`**SAH Code:** \`${raw.uwpGG}\`  `);
        }

        if (isBelt) {
            lines.push('', '### Belt Profile', '');
            if (raw.beltProfileString) lines.push(`**Profile:** \`${raw.beltProfileString}\`  `);
            if (raw.span != null)           lines.push(`**Span:** ${raw.span}  `);
            if (raw.bulk != null)           lines.push(`**Bulk:** ${raw.bulk}  `);
            if (raw.resourceRating != null) lines.push(`**Resource Rating:** ${raw.resourceRating}  `);
            if (raw.mType != null)          lines.push(`**M-Type:** ${raw.mType}%  `);
            if (raw.sType != null)          lines.push(`**S-Type:** ${raw.sType}%  `);
            if (raw.cType != null)          lines.push(`**C-Type:** ${raw.cType}%  `);
            if (raw.oType != null)          lines.push(`**O-Type:** ${raw.oType}%  `);
        }

        if (!isBelt && !noBody) {
            if (raw.lifeProfile != null || raw.habitability != null || raw.resourceRating != null) {
                lines.push('', '### Habitability', '');
                if (raw.lifeProfile != null)    lines.push(`**Native Life:** ${raw.lifeProfile}  `);
                if (raw.habitability != null)   lines.push(`**Habitability:** ${raw.habitability}/15  `);
                if (raw.resourceRating != null) lines.push(`**Resource Rating:** ${raw.resourceRating}  `);
                if (raw.secRU != null && raw.secPop > 0) lines.push(`**Secondary RU:** ${raw.secRU}  `);
            }
        }

        if (isMainworld) {
            lines.push('');
            if (state.allegiance) lines.push(`**Allegiance:** ${state.allegiance}  `);
            if (state.cluster)    lines.push(`**Region:** ${state.cluster}  `);
        }

        return lines;
    }

    function _formatMgtMoonFields(raw) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];

        lines.push('### Orbital Data', '');
        if (raw.pd != null)           lines.push(`**Orbit (⌀):** ${raw.pd}  `);
        if (raw.eccentricity != null) lines.push(`**Eccentricity:** ${raw.eccentricity}  `);
        if (raw.periodHrs != null)    lines.push(`**Period:** ${raw.periodHrs} hrs  `);

        const noBody = raw.size == 0 || raw.size === 'R';
        if (!noBody) {
            lines.push('', '### Physical Properties', '');
            if (raw.composition != null) lines.push(`**Composition:** ${raw.composition}  `);
            if (raw.density != null)     lines.push(`**Density:** ${Number(raw.density).toFixed(3)} ρ⊕  `);
            if (raw.gravity != null)     lines.push(`**Gravity:** ${raw.gravity} G  `);
            if (raw.mass != null)        lines.push(`**Mass:** ${raw.mass} M⊕  `);
            if (raw.diamKm != null)      lines.push(`**Diameter:** ${Math.round(raw.diamKm).toLocaleString()} km  `);
            if (raw.hydroPercent != null) lines.push(`**Hydrographics:** ${raw.hydroPercent}%  `);

            if (raw.meanTempK != null) {
                lines.push('', '### Temperature', '');
                lines.push(`**Mean:** ${_kToC(raw.meanTempK)} °C  `);
                if (raw.lowTempK  != null && !isNaN(raw.lowTempK))  lines.push(`**Low:** ${_kToC(raw.lowTempK)} °C  `);
                if (raw.highTempK != null && !isNaN(raw.highTempK)) lines.push(`**High:** ${_kToC(raw.highTempK)} °C  `);
            }

            lines.push('', '### Atmosphere', '');
            if (raw.gases && raw.gases.length > 0)
                lines.push(`**Gases:** ${raw.gases.join(', ')}  `);
            else if (raw.oxygenFraction != null)
                lines.push(`**O₂ Fraction:** ${raw.oxygenFraction}  `);
            else
                lines.push(`**Atmosphere:** None  `);
            if (raw.totalPressureBar != null) lines.push(`**Pressure:** ${raw.totalPressureBar} bar  `);
            if (raw.taints) {
                const arr = Array.isArray(raw.taints) ? raw.taints : [raw.taints];
                if (arr.length) lines.push(`**Taints:** ${arr.join(', ')}  `);
            }

            lines.push('', '### Rotation', '');
            if (raw.solarDayHours != null) {
                if (raw.solarDayHours === Infinity || raw.isTwilightZone)
                    lines.push(`**Solar Day:** Twilight Zone  `);
                else
                    lines.push(`**Solar Day:** ${raw.solarDayHours} hrs  `);
            }
            if (raw.axialTilt != null) lines.push(`**Axial Tilt:** ${raw.axialTilt}°  `);

            if (raw.lifeProfile != null || raw.habitability != null || raw.resourceRating != null) {
                lines.push('', '### Habitability', '');
                if (raw.lifeProfile != null)    lines.push(`**Native Life:** ${raw.lifeProfile}  `);
                if (raw.habitability != null)   lines.push(`**Habitability:** ${raw.habitability}/15  `);
                if (raw.resourceRating != null) lines.push(`**Resource Rating:** ${raw.resourceRating}  `);
            }
        }
        return lines;
    }

    function _formatMgtStarFields(raw, isPrimary) {
        if (!raw) return [];
        const lines = [];
        if (raw.mass != null) lines.push(`**Mass:** ${raw.mass} M☉  `);
        if (raw.lum  != null) lines.push(`**Luminosity:** ${raw.lum} L☉  `);
        if (!isPrimary) {
            if (raw.separation)           lines.push(`**Separation:** ${raw.separation}  `);
            if (raw.orbitId != null)      lines.push(`**Orbit ID:** ${raw.orbitId}  `);
            if (raw.eccentricity != null) lines.push(`**Eccentricity:** ${raw.eccentricity}  `);
            if (raw.mao != null)          lines.push(`**MAO:** ${raw.mao}  `);
        }
        return lines;
    }

    function _formatMgtSocio(s) {
        if (!s || s.pValue === undefined) return [];
        const lines = ['', '## Socioeconomics', ''];
        if (s.pValue != null)       lines.push(`**pValue:** ${s.pValue}  `);
        if (s.totalWorldPop)        lines.push(`**Total Population:** ${s.totalWorldPop.toLocaleString()}  `);
        if (s.pcr != null)          lines.push(`**PCR:** ${s.pcr}  `);
        if (s.urbanPercent != null) lines.push(`**Urban %:** ${s.urbanPercent}%  `);
        if (s.totalUrbanPop)        lines.push(`**Urban Population:** ${s.totalUrbanPop.toLocaleString()}  `);
        if (s.majorCities != null)  lines.push(`**Major Cities:** ${s.majorCities}  `);
        if (s.totalMajorCityPop)    lines.push(`**Major City Population:** ${s.totalMajorCityPop.toLocaleString()}  `);
        lines.push('');
        if (s.govProfile)            lines.push(`**Government Profile:** ${s.govProfile}  `);
        if (s.factions != null)      lines.push(`**Factions:** ${s.factions}  `);
        if (s.judicialSystemProfile) lines.push(`**Judicial Profile:** ${s.judicialSystemProfile}  `);
        if (s.lawProfile)            lines.push(`**Law Profile:** ${s.lawProfile}  `);
        if (s.techProfile)           lines.push(`**Tech Profile:** ${s.techProfile}  `);
        if (s.culturalProfile)       lines.push(`**Cultural Profile:** ${s.culturalProfile}  `);
        if (s.culturalQuirks && s.culturalQuirks.length > 0)
            lines.push(`**Cultural Quirks:** ${s.culturalQuirks.join(', ')}  `);
        lines.push('');
        if (s.Im != null)            lines.push(`**Importance (Im):** ${s.Im}  `);
        if (s.economicProfile)       lines.push(`**Economic Profile:** ${s.economicProfile}  `);
        if (s.RU != null)            lines.push(`**Resource Units (RU):** ${s.RU}  `);
        if (s.pcGWP != null)         lines.push(`**Per-Capita GWP:** ${s.pcGWP}  `);
        if (s.WTN != null)           lines.push(`**World Trade Number (WTN):** ${s.WTN}  `);
        if (s.IR != null)            lines.push(`**Import Rating (IR):** ${s.IR}  `);
        if (s.DR != null)            lines.push(`**Discount Rate (DR):** ${s.DR}  `);
        if (s.starportProfile)       lines.push(`**Starport Profile:** ${s.starportProfile}  `);
        if (s.militaryProfile)       lines.push(`**Military Profile:** ${s.militaryProfile}  `);
        return lines;
    }

    function _formatCtBodyFields(raw, orb, isMainworld, state) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];
        if (orb) {
            lines.push(`**Orbit:** ${orb.orbit}  `);
            if (orb.zone) lines.push(`**Zone:** ${orb.zone}  `);
        }
        if (raw.distAU != null)         lines.push(`**Distance:** ${raw.distAU} AU  `);
        if (raw.orbitalPeriod != null)  lines.push(`**Orbital Period:** ${raw.orbitalPeriod} yr  `);
        if (raw.diamKm != null)         lines.push(`**Diameter:** ${Math.round(raw.diamKm).toLocaleString()} km  `);
        if (raw.gravity != null)        lines.push(`**Gravity:** ${raw.gravity} G  `);
        if (raw.mass != null)           lines.push(`**Mass:** ${raw.mass} M⊕  `);
        if (raw.temperature != null)    lines.push(`**Temperature:** ${raw.temperature} K  `);
        if (raw.rotationPeriod != null) lines.push(`**Rotation Period:** ${raw.rotationPeriod}  `);
        if (raw.axialTilt != null)      lines.push(`**Axial Tilt:** ${raw.axialTilt}°  `);
        if (isMainworld) {
            if (state.allegiance) lines.push(`**Allegiance:** ${state.allegiance}  `);
            if (state.cluster)    lines.push(`**Region:** ${state.cluster}  `);
        }
        return lines;
    }

    function _formatCtSatFields(raw, isMainworld, state) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];
        if (raw.distAU != null)         lines.push(`**Distance:** ${raw.distAU} AU  `);
        if (raw.gravity != null)        lines.push(`**Gravity:** ${raw.gravity} G  `);
        if (raw.mass != null)           lines.push(`**Mass:** ${raw.mass} M⊕  `);
        if (raw.temperature != null)    lines.push(`**Temperature:** ${raw.temperature} K  `);
        if (raw.rotationPeriod != null) lines.push(`**Rotation Period:** ${raw.rotationPeriod}  `);
        if (raw.axialTilt != null)      lines.push(`**Axial Tilt:** ${raw.axialTilt}°  `);
        if (isMainworld) {
            if (state.allegiance) lines.push(`**Allegiance:** ${state.allegiance}  `);
            if (state.cluster)    lines.push(`**Region:** ${state.cluster}  `);
        }
        return lines;
    }

    function _formatCtStarFields(raw, starIdx) {
        if (!raw) return [];
        const lines = [];
        if (raw.type) lines.push(`**Spectral Type:** ${raw.type}  `);
        if (raw.size) lines.push(`**Luminosity Class:** ${raw.size}  `);
        if (starIdx > 0 && raw.orbitLabel) lines.push(`**Orbit:** ${raw.orbitLabel}  `);
        return lines;
    }

    function _formatT5WorldFields(raw, orb, isMainworld, state) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];
        if (orb && orb.distAU != null) lines.push(`**Distance:** ${orb.distAU.toFixed(2)} AU  `);
        if (raw.worldType)             lines.push(`**World Type:** ${raw.worldType}  `);
        if (raw.climateZone)           lines.push(`**Climate Zone:** ${raw.climateZone}  `);
        if (raw.diamKm != null)        lines.push(`**Diameter:** ${Math.round(raw.diamKm).toLocaleString()} km  `);
        if (raw.gravity !== undefined) lines.push(`**Gravity:** ${raw.gravity} G  `);
        const mv = raw.massEarths ?? raw.mass;
        if (mv != null)                lines.push(`**Mass:** ${mv} M⊕  `);
        if (raw.rotationState !== undefined) lines.push(`**Rotation:** ${raw.rotationState}  `);
        if (isMainworld) {
            if (state.allegiance) lines.push(`**Allegiance:** ${state.allegiance}  `);
            if (state.cluster)    lines.push(`**Region:** ${state.cluster}  `);
        }
        return lines;
    }

    function _formatT5SatFields(raw) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];
        if (raw.worldType)             lines.push(`**World Type:** ${raw.worldType}  `);
        if (raw.climateZone)           lines.push(`**Climate Zone:** ${raw.climateZone}  `);
        if (raw.diamKm != null)        lines.push(`**Diameter:** ${Math.round(raw.diamKm).toLocaleString()} km  `);
        if (raw.gravity !== undefined) lines.push(`**Gravity:** ${raw.gravity} G  `);
        const mv = raw.massEarths ?? raw.mass;
        if (mv != null)                lines.push(`**Mass:** ${mv} M⊕  `);
        if (raw.rotationState !== undefined) lines.push(`**Rotation:** ${raw.rotationState}  `);
        return lines;
    }

    function _formatT5StarFields(raw, starIdx) {
        if (!raw) return [];
        const lines = [];
        if (raw.type)     lines.push(`**Spectral Type:** ${raw.type}  `);
        if (raw.decimal != null) lines.push(`**Decimal:** ${raw.decimal}  `);
        if (raw.size)     lines.push(`**Luminosity Class:** ${raw.size}  `);
        if (raw.luminosity != null) lines.push(`**Luminosity:** ${raw.luminosity.toFixed(3)} L☉  `);
        if (starIdx > 0 && raw.orbitLabel) lines.push(`**Orbit:** ${raw.orbitLabel}  `);
        return lines;
    }

    function _formatT5Socio(s) {
        if (!s) return [];
        const lines = ['', '## Socioeconomics (T5)', ''];
        if (s.popMultiplier != null) lines.push(`**Pop Multiplier:** ${s.popMultiplier}  `);
        if (s.belts != null)         lines.push(`**Belts:** ${s.belts}  `);
        if (s.gasGiants != null)     lines.push(`**Gas Giants:** ${s.gasGiants}  `);
        if (s.worlds != null)        lines.push(`**Worlds:** ${s.worlds}  `);
        const ix = s.Importance ?? s.Ix;
        if (ix != null)              lines.push(`**Importance (Ix):** ${ix}  `);
        const ru = s.ResourceUnits ?? s.RU;
        if (ru != null)              lines.push(`**Resource Units (RU):** ${ru}  `);
        const r = s.ecoResources ?? s.R;
        if (r != null)               lines.push(`**R (Resources):** ${r}  `);
        const l = s.ecoLabor ?? s.L;
        if (l != null)               lines.push(`**L (Labor):** ${l}  `);
        const inf = s.ecoInfrastructure ?? s.I;
        if (inf != null)             lines.push(`**I (Infrastructure):** ${inf}  `);
        const e = s.ecoEfficiency ?? s.E;
        if (e != null)               lines.push(`**E (Efficiency):** ${e}  `);
        if (s.H != null)             lines.push(`**H:** ${s.H}  `);
        if (s.A != null)             lines.push(`**A:** ${s.A}  `);
        if (s.S != null)             lines.push(`**S:** ${s.S}  `);
        if (s.Sym != null)           lines.push(`**Sym:** ${s.Sym}  `);
        return lines;
    }

    function _formatRttBodyFields(raw, isMainworld, state) {
        if (!raw) return [];
        const lines = ['', '## Physical Data', ''];
        if (raw.type)               lines.push(`**Type:** ${raw.type}  `);
        if (raw.worldClass)         lines.push(`**World Class:** ${raw.worldClass}  `);
        if (raw.chemistry)          lines.push(`**Chemistry:** ${raw.chemistry}  `);
        if (raw.biosphere != null)  lines.push(`**Biosphere:** ${raw.biosphere}  `);
        if (raw.rings)              lines.push(`**Rings:** ${raw.rings}  `);
        if (raw.habitationType)     lines.push(`**Habitation:** ${raw.habitationType}  `);
        if (raw.desirability != null) lines.push(`**Desirability:** ${raw.desirability}  `);
        if (raw.industry != null)   lines.push(`**Industry:** ${raw.industry}  `);
        if (raw.starport && raw.habitationType !== 'Uninhabited')
            lines.push(`**Starport:** ${raw.starport}  `);
        if (raw.canBeTerraformed && raw.terraformPoints != null)
            lines.push(`**Terraforming Potential:** ${raw.terraformPoints} pts  `);
        if (isMainworld) {
            if (state.allegiance) lines.push(`**Allegiance:** ${state.allegiance}  `);
            if (state.cluster)    lines.push(`**Region:** ${state.cluster}  `);
        }
        return lines;
    }

    // ── Referee notes ────────────────────────────────────────────────────────

    function _buildNotesSection(state) {
        const text = (state.notes || '').trim();
        return ['', '## Referee Notes', '', text || '_(none)_'];
    }

    // ── System overview ───────────────────────────────────────────────────────

    function _buildSystemOverview(state) {
        const lines = [];
        if (state.mgtSystem) {
            const sys = state.mgtSystem;
            lines.push('', '## System Overview', '');
            if (sys.age  != null) lines.push(`**Age:** ${sys.age.toFixed(2)} Gyr  `);
            if (sys.hzco != null) lines.push(`**HZco (Primary):** ${sys.hzco.toFixed(2)}  `);
            if (sys.ptypeHzco != null) lines.push(`**P-Type HZco:** ${sys.ptypeHzco.toFixed(2)}  `);
            if (sys.ptypeInnerLimit != null && sys.ptypeInnerLimit !== Infinity)
                lines.push(`**P-Type Inner Limit:** ${sys.ptypeInnerLimit.toFixed(2)} AU  `);
            const mwb = state.mgt2eData || state.t5Data || state.ctData;
            if (mwb && mwb.travelZone && mwb.travelZone !== 'Green')
                lines.push(`**Travel Zone:** ${mwb.travelZone}  `);
        } else if (state.ctSystem) {
            const sys = state.ctSystem;
            lines.push('', '## System Overview', '');
            if (sys.nature)            lines.push(`**Nature:** ${sys.nature}  `);
            if (sys.maxOrbits != null) lines.push(`**Total Orbits:** ${sys.maxOrbits}  `);
            const mwb = state.ctData || state.mgt2eData;
            if (mwb && mwb.travelZone && mwb.travelZone !== 'Green')
                lines.push(`**Travel Zone:** ${mwb.travelZone}  `);
        } else if (state.t5System) {
            const sys = state.t5System;
            lines.push('', '## System Overview', '');
            if (sys.stars) {
                sys.stars.forEach(s => {
                    lines.push(`**${s.role}:** ${s.name} (Lum: ${s.luminosity ? s.luminosity.toFixed(3) : '?'})  `);
                });
            }
            const mwb = state.t5Data || state.mgt2eData;
            if (mwb && mwb.travelZone && mwb.travelZone !== 'Green')
                lines.push(`**Travel Zone:** ${mwb.travelZone}  `);
        }
        return lines;
    }

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

        lines.push(..._buildSystemOverview(state));

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

        lines.push(..._buildNotesSection(state));

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
                lines.push(..._formatMgtStarFields(rawStar, isPrimary));
            } else if (state.ctSystem) {
                lines.push(..._formatCtStarFields(rawStar, starIdx));
            } else if (state.t5System) {
                lines.push(..._formatT5StarFields(rawStar, starIdx));
            } else {
                // Fallback: use normalized fields
                if (star.lum  != null) lines.push(`**Luminosity:** ${star.lum} L☉  `);
                if (star.mass != null) lines.push(`**Mass:** ${star.mass} M☉  `);
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
        const travelZone = world.travelZone === 'Red' ? 'Red' : world.travelZone === 'Amber' ? 'Amber' : 'Green';
        const tradeCodes = (world.tradeCodes || []).join(' ') || '—';
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
            lines.push('## UWP Breakdown', '', _uwpTable(world.uwp), '');
        }

        lines.push('## Details', '');
        lines.push(`**Trade Codes:** ${tradeCodes}  `);
        lines.push(`**Travel Zone:** ${travelZone}  `);
        if (world.tl != null) lines.push(`**Tech Level:** ${world.tl}  `);

        // Edition-aware physical data
        if (state && rawWorld) {
            if (state.mgtSystem) {
                lines.push(..._formatMgtWorldFields(rawWorld, isMainworld, state));
            } else if (state.ctSystem) {
                lines.push(..._formatCtBodyFields(rawWorld.w, rawWorld.o, isMainworld, state));
            } else if (state.t5System) {
                lines.push(..._formatT5WorldFields(rawWorld.w, rawWorld.o, isMainworld, state));
            } else if (state.rttSystem) {
                lines.push(..._formatRttBodyFields(rawWorld, isMainworld, state));
            }
        } else {
            // Fallback to normalized fields
            if (world.gravity != null)   lines.push(`**Gravity:** ${world.gravity} G  `);
            if (world.diamKm != null)    lines.push(`**Diameter:** ${world.diamKm.toLocaleString()} km  `);
            if (world.meanTempK != null) lines.push(`**Mean Temp:** ${world.meanTempK} K  `);
        }

        // Socioeconomics (mainworld only)
        if (isMainworld && state) {
            if (state.mgtSocio && state.mgtSocio.pValue !== undefined) {
                lines.push(..._formatMgtSocio(state.mgtSocio));
            }
            if (state.t5Socio) {
                lines.push(..._formatT5Socio(state.t5Socio));
            }
            lines.push(..._buildNotesSection(state));
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
        const travelZone  = moon.travelZone === 'Red' ? 'Red' : moon.travelZone === 'Amber' ? 'Amber' : 'Green';
        const tradeCodes  = (moon.tradeCodes || []).join(' ') || '—';
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
            lines.push('## UWP Breakdown', '', _uwpTable(moon.uwp), '');
        }

        lines.push('## Details', '');
        lines.push(`**Trade Codes:** ${tradeCodes}  `);
        lines.push(`**Travel Zone:** ${travelZone}  `);
        if (moon.tl != null) lines.push(`**Tech Level:** ${moon.tl}  `);

        // Edition-aware physical data
        if (state && rawMoon) {
            if (state.mgtSystem) {
                lines.push(..._formatMgtMoonFields(rawMoon));
            } else if (state.ctSystem) {
                lines.push(..._formatCtSatFields(rawMoon, isLunarMainworld, state));
            } else if (state.t5System) {
                lines.push(..._formatT5SatFields(rawMoon));
            } else if (state.rttSystem) {
                lines.push(..._formatRttBodyFields(rawMoon, isLunarMainworld, state));
            }
        } else {
            // Fallback to normalized fields
            if (moon.gravity != null)   lines.push(`**Gravity:** ${moon.gravity} G  `);
            if (moon.diamKm != null)    lines.push(`**Diameter:** ${moon.diamKm.toLocaleString()} km  `);
            if (moon.meanTempK != null) lines.push(`**Mean Temp:** ${moon.meanTempK} K  `);
        }

        // Socioeconomics for lunar mainworlds
        if (isLunarMainworld && state) {
            if (state.mgtSocio && state.mgtSocio.pValue !== undefined) {
                lines.push(..._formatMgtSocio(state.mgtSocio));
            }
            if (state.t5Socio) {
                lines.push(..._formatT5Socio(state.t5Socio));
            }
        }

        return lines.join('\n');
    }

    // ── Image rendering ───────────────────────────────────────────────────────

    function _canRenderImage(world) {
        return !!(world.uwp &&
            world.type !== 'Gas Giant' &&
            world.type !== 'Planetoid Belt' &&
            world.type !== 'Empty');
    }

    function _isAirless(world) {
        const uwp = world.uwp || '';
        const atm = uwp.length >= 3 ? (parseInt(uwp[2], 16) || 0) : 0;
        const hyd = uwp.length >= 4 ? (parseInt(uwp[3], 16) || 0) : 0;
        return atm === 0 && hyd === 0;
    }

    async function _renderWorldImage(worldData, seedHexId) {
        if (!_canRenderImage(worldData)) return null;
        if (typeof PlanetRenderer === 'undefined') return null;

        const uwp  = worldData.uwp || '';
        const atm  = uwp.length >= 3 ? (parseInt(uwp[2], 16) || 0) : 0;
        const hyd  = uwp.length >= 4 ? (parseInt(uwp[3], 16) || 0) : 0;
        const tempK = worldData.meanTempK || 0;
        const tempBand = (tempK > 0 && typeof PlanetRenderer.tempBandFromKelvin === 'function')
            ? PlanetRenderer.tempBandFromKelvin(tempK)
            : (worldData.temperature || '');

        const rendererData = {
            atmosphere:    atm,
            hydrographics: hyd,
            temperature:   tempBand,
            temperatureK:  tempK,
            uwp,
        };

        const canvas  = document.createElement('canvas');
        canvas.height = 300;
        canvas.width  = 700;
        PlanetRenderer.renderPlanetHemispheres(canvas, rendererData, seedHexId);

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) { resolve(null); return; }
                blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            }, 'image/png');
        });
    }

    // ── Export orchestrator ───────────────────────────────────────────────────

    async function startExport(sectorNum, subsectorChar, options) {
        const { includeImages, skipAirless, includeSystemImages, useSubfolders, onProgress, onDone, onError } = options || {};

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

        // Optional subsector map image embedded in the index page
        let mapImageFilename = null;
        if (includeSystemImages && typeof captureSubsector !== 'undefined') {
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
                    const imgData = await _renderWorldImage(world, `${hexId}-w${wi}`);
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
                        const imgData = await _renderWorldImage(moon, `${hexId}-w${wi}-m${mi}`);
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
        const blob    = new Blob([zipData], { type: 'application/zip' });
        const url     = URL.createObjectURL(blob);
        const a       = document.createElement('a');
        a.href        = url;
        a.download    = `${_sanitize(sectorName)}_Subsector_${subsectorChar}_Wiki.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onDone && onDone(files.length);
    }

    return { startExport };

})();

window.ObsidianExporter = ObsidianExporter;
