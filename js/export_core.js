'use strict';

// =============================================================================
// EXPORT_CORE.JS — Format-agnostic machinery shared by the wiki exporters
//
// Extracted from js/obsidian_exporter.js (WP1, v0.17.0) so that the Obsidian
// (Markdown) and HTML exporters can share one implementation instead of two
// drifting copies. See directives/html_extract_manifest.md.
//
// Nothing in this file knows about Markdown or HTML. It covers:
//   - CRC-32 and the stored-entry ZIP builder
//   - filename / display-name helpers
//   - system name + UWP resolvers
//   - per-edition raw body finders (data lookup only, no formatting)
//   - world image rendering
//
// Load order: must come BEFORE obsidian_exporter.js / html_exporter.js.
// =============================================================================

const ExportCore = (() => {

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

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = _CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // ── ZIP builder (stored / uncompressed entries) ───────────────────────────

    function buildZip(entries) {
        const enc = new TextEncoder();

        const processed = entries.map(e => ({
            nameBytes: enc.encode(e.name),
            data:      e.data,
            crc:       crc32(e.data),
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

    // ── Filename / display-name helpers ───────────────────────────────────────

    function sanitize(str) {
        return (str || 'Unknown').replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    }

    // ── Release 2: name disclosure (WP5 slice 5c) ─────────────────────────────
    //
    // Every helper below takes an OPTIONAL trailing `lvl`. Null/absent is the GM
    // path and behaves exactly as before — that is what keeps the guard at 6/6.
    //
    // When a name is withheld the helper falls back to the SAME generic label
    // the exporter already used for genuinely unnamed bodies ("World 3",
    // "Belt 1"). That is deliberate: a player then cannot tell a withheld name
    // from a body that never had one, which is the "withheld = absent" rule.
    //
    //   worlds, moons — names at (g), HX-2
    //   stars         — names at (d), §3.11a: a star name embeds the system name
    //   system        — name  at (d), §1.1
    function _nameOk(lvl, required) { return !lvl || _atLeast(lvl, required); }

    // Filenames take NO level argument, deliberately. They are built from the
    // names their callers already resolved, and those callers pass the DISCLOSED
    // name — "System 1910" below (d), "World 3" below (g). So the §5.2.2
    // filename leak is closed at the source, in resolveSystemName() and the
    // display-name helpers, rather than by a second gate here.
    //
    // This matters because Obsidian wikilinks resolve BY NAME: the link text and
    // the filename stem must be the same string. An earlier version of this
    // slice gave these two functions their own level parameter and produced
    // "1910.md" while every link still said "[[Regina (1910)]]" — every link
    // below (d) would have broken. One gate, at the name, keeps them in step.
    function systemFilename(systemName, hexCode, ext) {
        return `${sanitize(systemName)} (${hexCode}).${ext}`;
    }

    function bodyFilename(systemName, bodyName, hexCode, ext) {
        return `${sanitize(systemName)} - ${sanitize(bodyName)} (${hexCode}).${ext}`;
    }

    function worldDisplayName(world, idx, lvl) {
        if (world.name && _nameOk(lvl, 'g')) return world.name;
        const t = world.type || 'Body';
        if (t === 'Gas Giant')      return `Giant ${idx + 1}`;
        if (t === 'Planetoid Belt') return `Belt ${idx + 1}`;
        return `World ${idx + 1}`;
    }

    function moonDisplayName(moon, idx, lvl) {
        return (moon.name && _nameOk(lvl, 'g')) ? moon.name : `Moon ${idx + 1}`;
    }

    // In multi-star systems append the conventional letter (A, B, C …) so that
    // two stars of identical spectral type never produce the same filename/link.
    function starDisplayName(star, starIdx, isMultiStar, lvl) {
        if (!_nameOk(lvl, 'd')) {
            // Deliberately NOT the star's role, even though role is (b) data:
            // stars are visible from (a), so a role-based label would leak role
            // one level early. A fixed vocabulary avoids a label whose wording
            // changes with the level.
            return isMultiStar ? `Star ${String.fromCharCode(65 + starIdx)}` : 'Star';
        }
        const base = star.name || `Star ${starIdx + 1}`;
        return isMultiStar ? `${base} ${String.fromCharCode(65 + starIdx)}` : base;
    }

    // ── System name / UWP resolvers ───────────────────────────────────────────

    // `hexCode` and `lvl` are optional and used only by the players' export:
    // below (d) the system is identified by its hex, since the hex is (a) and
    // inherently disclosed by any map dot anyway.
    function resolveSystemName(state, lvl, hexCode) {
        if (!_nameOk(lvl, 'd')) return hexCode ? `System ${hexCode}` : 'Unsurveyed';
        if (state.name) return state.name;
        const sys = state.mgtSystem || state.ctSystem || state.t5System || state.rttSystem;
        if (sys && sys.name) return sys.name;
        if (sys && sys.mainworld && sys.mainworld.name) return sys.mainworld.name;
        return 'Unnamed';
    }

    function resolveUWP(state) {
        if (state.uwp) return state.uwp;
        const src = state.mgt2eData || state.ctData || state.t5Data || state.rttData;
        if (src && src.uwp) return src.uwp;
        const sys = state.mgtSystem || state.ctSystem || state.t5System || state.rttSystem;
        if (sys && sys.mainworld && sys.mainworld.uwp) return sys.mainworld.uwp;
        return '???????-?';
    }

    // ── Temperature helper ────────────────────────────────────────────────────

    function kToC(k) { return (k - 273).toFixed(0); }

    // ── Index row data ────────────────────────────────────────────────────────
    //
    // One system's summary, for the subsector index table. Kept here rather than
    // in the HTML exporter because it is pure data extraction, and because
    // Release 2 has to gate these columns per disclosure level — the index leaks
    // exactly as readily as a body page does (manifest 5.2.2).
    //
    // NOTE the `||` chain: a hex state can carry several `*Data` keys at once,
    // left null by whichever macro last ran. The chain skips the nulls; this is
    // the same resolution order resolveUWP uses, which the WP2 parity checks
    // proved correct across all five engines. Do not "simplify" it to a lookup.

    function resolveWorldData(state) {
        return state.mgt2eData || state.ctData || state.t5Data || state.rttData || null;
    }

    function indexRowData(state, hexCode, lvl) {
        const d = resolveWorldData(state) || {};
        const uwp = resolveUWP(state);
        const tc = Array.isArray(d.tradeCodes) ? d.tradeCodes : [];
        // Bases are stored as an array of single letters (N, S, K, V, G, T, R…);
        // an empty array means "surveyed, none present", which is not the same as
        // the field being absent — but both render blank.
        let bs = Array.isArray(d.bases) ? d.bases : (d.bases ? [d.bases] : []);
        // AoW records bases as booleans on the body rather than as a code array.
        // Letters follow the app's own existing mapping in hex_editor.js:159-162 —
        // note corsair is P (pirate), NOT C. `militaryBase` is deliberately omitted:
        // that file's comment records that M already means Merchant in RTT, so there
        // is no unambiguous letter for it. See HX-8 in the manifest.
        if (!bs.length && state.aowSystem) {
            const mw = state.aowSystem.mainworld || {};
            bs = [[mw.navalBase, 'N'], [mw.scoutBase, 'S'], [mw.corsairBase, 'P']]
                .filter(([on]) => on).map(([, ltr]) => ltr);
        }
        return {
            hex:        hexCode,
            name:       resolveSystemName(state, lvl, hexCode),
            uwp,
            starport:   d.starport || (uwp && uwp[0]) || '',
            tl:         d.tl != null ? String(d.tl) : (uwp && uwp.length >= 9 ? uwp[8] : ''),
            tradeCodes: tc.join(' '),
            bases:      bs.join(' '),
            zone:       d.travelZone || d.travelCode || '',
            gasGiant:   !!d.gasGiant,
            allegiance: state.allegiance || '',
        };
    }

    // ── Raw body finders ──────────────────────────────────────────────────────
    //
    // NOTE (HX-6): the RTT finder below cannot match anything as written — RTT
    // stores bodies flat in star.planetarySystem.orbits[], not in sys.worlds or
    // star.orbits[].contents. This is a PRE-EXISTING bug carried over verbatim
    // during the WP1 extraction so that the before/after diff stays meaningful.
    // Do not "fix" it here without agreeing it as separate work first.

    function _findMgtRawWorld(state, nw) {
        const worlds = (state.mgtSystem && state.mgtSystem.worlds) || [];
        // NAME FIRST — orbitId is NOT unique. Two bodies legitimately share an
        // orbit slot (e.g. Maracaibo A-I and A-II both at orbitId 0.284 under
        // the same star), and matching on it made `.find()` return whichever
        // came first, so the page described one world while printing its
        // neighbour's mass, density, gravity, diameter, tilt and temperature.
        // The name check below it could never be reached to correct this.
        // Measured before the fix: 14 of 688 fixture worlds took another
        // body's physical stats. MgT2E was the only engine ordered this way.
        //
        // Names are safe to lead with: verified unique WITHIN a system across
        // 4599 bodies / 239 systems / all five engines, zero duplicates
        // (.tmp/html_export_harness/seedname_check.js). orbitId remains the
        // fallback for the handful of bodies with no name.
        if (nw.name) {
            const byName = worlds.find(w => w.name === nw.name);
            if (byName) return byName;
        }
        if (nw.orbitId != null) {
            const m = worlds.find(w =>
                Math.abs((w.orbitId || 0) - nw.orbitId) < 0.001 &&
                (w.parentStarIdx ?? 0) === (nw.parentStarIdx ?? 0)
            );
            if (m) return m;
        }
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

    // HX-6 fix (2026-08-01). RTT stores each body FLAT in
    // star.planetarySystem.orbits[] — the orbit entry *is* the body, with no
    // `.contents` wrapper. This function previously looked only in sys.worlds
    // (undefined on RTT) and star.orbits[] (RTT stars have no `.orbits`), so it
    // returned null for every RTT body and _formatRttBodyFields never ran —
    // RTT worlds silently fell back to generic normalized fields.
    //
    // Traversal and sort order deliberately mirror SystemViewer._normalizeRTT
    // so raw bodies line up with the normalized worlds they are matched against.
    function _findRttRawBody(state, nw) {
        const sys = state.rttSystem;
        if (!sys) return null;
        const all = [];

        (sys.stars || []).forEach(s => {
            if (!s.planetarySystem) return;
            [...(s.planetarySystem.orbits || [])]
                .sort((a, b) => (a.orbitNumber || 0) - (b.orbitNumber || 0))
                .forEach(body => { if (body) all.push(body); });
        });

        // Legacy/defensive shapes, kept so an engine change that reintroduces
        // either layout still resolves.
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

    // HX-8 (2026-08-01). AoW keeps a flat sys.worlds[] and SystemViewer._normalizeAoW
    // maps it one-to-one, carrying `name` and `au` (from orbitalRadius) onto the
    // normalized world — so match on those, in that order, mirroring that traversal.
    function _findAoWRawWorld(state, nw) {
        const worlds = (state.aowSystem && state.aowSystem.worlds) || [];
        if (nw.name) {
            const byName = worlds.find(w => w.name === nw.name);
            if (byName) return byName;
        }
        if (nw.au != null) {
            const byAu = worlds.find(w =>
                Math.abs((w.orbitalRadius ?? w.orbitId ?? -1) - nw.au) < 0.0001);
            if (byAu) return byAu;
        }
        if (nw.type === 'Mainworld') {
            return worlds.find(w => w.isMainworld || w === state.aowSystem.mainworld) || null;
        }
        return null;
    }

    function findRawWorld(state, nw) {
        if (state.mgtSystem) return _findMgtRawWorld(state, nw);
        if (state.ctSystem)  return _findCtRawBody(state, nw);
        if (state.t5System)  return _findT5RawWorld(state, nw);
        if (state.rttSystem) return _findRttRawBody(state, nw);
        if (state.aowSystem) return _findAoWRawWorld(state, nw);
        return null;
    }

    function findRawMoon(state, rawWorld, normalizedMoon, moonIdx) {
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
        // AoW bodies carry both `.moons` and `.satellites`; _normalizeAoW builds the
        // normalized moon list from `.satellites`, so index alignment requires the same.
        if (state.aowSystem) {
            const sats = rawWorld.satellites || [];
            return moonIdx < sats.length ? sats[moonIdx] : null;
        }
        return null;
    }

    function findRawStar(state, starIdx) {
        if (state.mgtSystem) return (state.mgtSystem.stars || [])[starIdx] || null;
        if (state.ctSystem)  return (state.ctSystem.stars  || [])[starIdx] || null;
        if (state.t5System)  return (state.t5System.stars  || [])[starIdx] || null;
        return null;
    }

    // ── Block model ───────────────────────────────────────────────────────────
    //
    // Format-neutral document blocks. Each exporter supplies its own renderer
    // (Markdown: _mdRender in obsidian_exporter.js). Introduced in WP1 so that
    // Release 2's disclosure levels can filter *fields* — impossible against
    // pre-baked Markdown strings. See directives/html_extract_manifest.md.
    //
    //   {t:'gap'}                     a single blank line
    //   {t:'h', level, text}          heading
    //   {t:'f', label, value, code?}  labelled field; `code` marks monospace
    //   {t:'txt', text}               a raw line, emitted verbatim
    //   {t:'tbl', headers, rows}      table; cells are already-formatted strings
    //
    // NOTE: cells are strings, so a table cell carrying a link is currently
    // format-specific and stays in the calling exporter. A neutral link
    // descriptor lands in WP2, once the HTML anchor/path scheme is concrete —
    // designing it before then would be guesswork.

    // ── Numeric display formatting (2026-08-04) ───────────────────────────────
    //
    // Sean: "there is never a need for more than two decimal places". True for
    // almost everything, but a flat toFixed(2) turns real values into zero —
    // eccentricity 0.0043, a small moon's mass 0.0032 M⊕, a trace atmosphere at
    // 0.004 bar would all render "0.00", which is wrong rather than merely
    // coarse. So: AT MOST two decimals, but never round a non-zero value away.
    //
    //   5.980074992877245 -> "5.98"      (AoW stores raw floats)
    //   3.1104000000000003 -> "3.11"     (a float artifact of 3.1104)
    //   0.0032            -> "0.0032"    (kept: 2 significant figures)
    //   7                 -> "7"         (integers gain no ".00")
    //
    // DISPLAY ONLY. Engine values are untouched — rounding at generation would
    // change generated worlds, invalidate the frozen fixture and stray into
    // rules territory. This runs at render time and nowhere else.
    function fmtNum(v, maxDp) {
        const dp = (maxDp == null) ? 2 : maxDp;
        const num = (typeof v === 'number') ? v : parseFloat(v);
        if (!isFinite(num)) return v;                 // strings, NaN, ±Infinity pass through
        if (Number.isInteger(num)) return String(num);

        // Below 0.01, two decimals cannot carry two significant figures, so use
        // significant figures instead. Without this, 0.0072, 0.0089 and 0.0096
        // M⊕ — three different moons — all render "0.01", and anything under
        // 0.005 renders "0.00". An earlier version applied this only when the
        // result was exactly zero, which missed the flattening case entirely;
        // the before/after field diff caught it.
        // Guarantee two significant figures. Two DECIMALS only carry two
        // significant figures once a value reaches 0.1 — below that, toFixed(2)
        // leaves one figure or none, so 0.0131 renders "0.01" (a 23.7% error)
        // and 0.0032 renders "0.00". Switch to significant figures there.
        //
        // Confirmed against real data: this affects 454 values in the fixture
        // and eliminates every distortion over 5%. Values at 0.1 and above are
        // untouched and still show at most two decimals — 5.98, 0.23, 3.11.
        const mag = Math.abs(num);
        if (mag > 0 && mag < 0.1) return String(Number(num.toPrecision(2)));
        return String(Number(num.toFixed(dp)));
    }

    // `n` is the shorthand used at the formatter call sites below.
    const n = fmtNum;

    const GAP = { t: 'gap' };
    const h   = (level, text)  => ({ t: 'h', level, text });
    // A bare number passed as a value is formatted here, which covers the ~40
    // call sites that hand over a raw field with no unit. Sites that build a
    // template string ("`${x} AU`") produce a string and so must call n()
    // themselves — those are wrapped individually below.
    const f   = (label, value) =>
        ({ t: 'f', label, value: (typeof value === 'number') ? fmtNum(value) : value });
    const fc  = (label, value) => ({ t: 'f', label, value, code: true });
    const txt = (text)         => ({ t: 'txt', text });
    const tbl = (headers, rows) => ({ t: 'tbl', headers, rows });

    // ── Release 2: field disclosure tagging (WP5 slice 5a) ────────────────────
    //
    // Every level below is Sean's, agreed 2026-08-03 and recorded in
    // directives/fog_of_war_field_tags.md §3.5. That file is the authority; this
    // is its executable form. DO NOT change a level here without changing it
    // there, and do not invent a level for a new field — see the fail-closed
    // note below.
    //
    // Tagging is by (context, label), NOT by label alone. The same label means
    // different things in different places and carries different levels:
    //   'Mass'         — (b) on a star, (e) on a world
    //   'Eccentricity' — (b) on a star, (d) on a world
    //   'Orbit ID'     — (b) on a star, (d) on a world
    // A flat label map would have leaked stellar data at world level, or hidden
    // world data that should show. Contexts are supplied by the call sites,
    // which always know whether they are formatting a star, world, moon, etc.
    //
    // Belt and gas-giant fields live in the `world` context: they are emitted
    // from inside the world formatters, and their labels (Span, Bulk, M-Type,
    // SAH Code, …) are unique, so there is no collision to disambiguate.

    const _LVL_STAR = {                                   // §3 — all stellar detail is (b)
        'Spectral Type': 'b', 'Luminosity Class': 'b', 'Decimal': 'b',
        'Luminosity': 'b', 'Mass': 'b', 'Separation': 'b',
        'Orbit ID': 'b', 'Eccentricity': 'b', 'MAO': 'b', 'Orbit': 'b',
    };

    const _LVL_WORLD = {
        // Group 1 — orbital position & motion (d)
        'Distance': 'd', 'Orbit': 'd', 'Orbit ID': 'd', 'Orbit Type': 'd',
        'Period': 'd', 'Orbital Period': 'd', 'Eccentricity': 'd',
        'Axial Tilt': 'd', 'Rotation': 'd', 'Rotation Period': 'd',
        'Solar Day': 'd', 'Zone': 'd',
        // Group 5 — body classification (d), plus Rings (assigned 2026-08-03)
        'Classification': 'd', 'World Type': 'd', 'World Class': 'd',
        'Type': 'd', 'Chemistry': 'd', 'Rings': 'd',
        // Group 2 — bulk physical & geology (e)
        'Composition': 'e', 'Lithosphere': 'e', 'Magnetic Field': 'e', 'Albedo': 'e',
        // Group 3 — atmosphere detail (e)
        'Gases': 'e', 'O₂ Fraction': 'e', 'Pressure': 'e', 'Taints': 'e',
        'Breathability': 'e',
        // Group 4 — temperature (e)
        'Mean': 'e', 'Low': 'e', 'High': 'e', 'Temperature': 'e',
        'Mean Temperature': 'e', 'Mean Temp': 'e', 'Climate Zone': 'e',
        // Explicitly fixed outside the groups (e)
        'Diameter': 'e', 'Hydrographics': 'e', 'Atmosphere': 'e',
        'Water Coverage': 'e', 'Gravity': 'e', 'Mass': 'e', 'Density': 'e',
        // Group 6 — biology & habitability (f)
        'Native Life': 'f', 'Biosphere': 'f', 'Habitability': 'f',
        // Group 7 — development & economy (f)
        'Resource Rating': 'f', 'Secondary RU': 'f', 'Desirability': 'f',
        'Industry': 'f', 'Habitation': 'f', 'Terraforming Potential': 'f',
        // Group 8b — belt profile (f)
        'Profile': 'f', 'Span': 'f', 'Bulk': 'f',
        'M-Type': 'f', 'S-Type': 'f', 'C-Type': 'f', 'O-Type': 'f',
        // Group 8a — gas giant profile (g), and the UWP's own digit 1
        'SAH Code': 'g', 'Starport': 'g',
        // Chart data (a)
        'Allegiance': 'a', 'Region': 'a',
    };

    // §5 — moons inherit their parent world's levels wholesale. 'Orbit (⌀)' is
    // the one moon-only field with no world counterpart; assigned (d) as Group 1
    // orbital position, raised with Sean rather than defaulted (2026-08-03).
    const _LVL_MOON = Object.assign({}, _LVL_WORLD, { 'Orbit (⌀)': 'd' });

    // §8 — the whole socioeconomic block is (g). The three exceptions are
    // system-inventory facts that merely happen to live in the T5 socio object.
    const _LVL_SOCIO_EXCEPTIONS = {
        'Total Population': 'f',      // the ladder's own Pop
        // NOTE these three are COUNTS. The ladder grants gas giant *presence*
        // at (c), not a number, so the count moves to (d) where the bodies
        // themselves become visible; presence at (c) is expressed as a separate
        // yes/no line by the exporters. Belts and Worlds are (d) either way.
        // Corrected 2026-08-04 — see manifest 4.7.
        'Belts': 'd', 'Gas Giants': 'd', 'Worlds': 'd',
    };

    const _LVL_SYSTEM = {            // §2 — system overview
        'Age': 'b', 'HZco (Primary)': 'b', 'P-Type HZco': 'b',
        'P-Type Inner Limit': 'b', 'Nature': 'd', 'Total Orbits': 'd',
        'Travel Zone': 'a',
    };

    const _LVL_DETAILS = {           // detailBlocks
        'Trade Codes': 'g', 'Travel Zone': 'a', 'Tech Level': 'f',
    };

    const _LVL_IDENTITY = {          // page metadata, index columns
        'Hex': 'a', 'Sector': 'a', 'Subsector': 'a', 'Edition': 'a',
        'Allegiance': 'a', 'Region': 'a', 'Travel Zone': 'a',
        'System Name': 'd', 'System': 'd',
        'UWP': 'g', 'Mainworld UWP': 'g', 'Starport': 'g', 'TL': 'g',
        'Trade Codes': 'g', 'Bases': 'g', 'GG': 'c',
    };

    const FIELD_LEVELS = {
        star:     _LVL_STAR,
        world:    _LVL_WORLD,
        moon:     _LVL_MOON,
        socio:    _LVL_SOCIO_EXCEPTIONS,   // everything else in this context is 'g'
        system:   _LVL_SYSTEM,
        details:  _LVL_DETAILS,
        identity: _LVL_IDENTITY,
    };

    // Contexts whose unlisted labels default to something other than fail-closed
    // 'g'. Only `socio`, because §8 assigns that entire block to (g) — an
    // unlisted socio label is therefore correctly (g), not a gap.
    const _CONTEXT_DEFAULT = { socio: 'g' };

    // Labels asked for but not tagged. Purely diagnostic: the harness asserts
    // this is empty after a full export, so a field added later cannot quietly
    // acquire a fail-closed level and vanish from every players' export without
    // anyone noticing.
    const _unknownFieldLabels = new Set();

    // A block may carry its own `lvl`, which wins over the (context, label)
    // lookup. This exists for fields whose LABEL is data rather than a fixed
    // string — T5's system overview emits one line per star labelled with the
    // star's role ('Primary', 'Close Companion', …), so no static map can
    // enumerate them and every one would otherwise fail closed to 'g'.
    // Found by the completeness sweep, not by reading the code.
    function blockLevel(block, context) {
        return block.lvl || fieldLevel(context, block.label);
    }

    function fieldLevel(context, label) {
        const map = FIELD_LEVELS[context];
        if (!map) { _unknownFieldLabels.add(`<bad context:${context}>`); return 'g'; }
        const lvl = map[label];
        if (lvl !== undefined) return lvl;
        const dflt = _CONTEXT_DEFAULT[context];
        if (dflt) return dflt;
        // FAIL CLOSED. An untagged field is treated as maximally restricted, so
        // a new field can never leak into a low-level players' export. It is
        // recorded above so the omission surfaces as a check failure instead.
        _unknownFieldLabels.add(`${context}:${label}`);
        return 'g';
    }

    function getUnknownFieldLabels() { return [..._unknownFieldLabels]; }
    function clearUnknownFieldLabels() { _unknownFieldLabels.clear(); }

    // Level comparison lives in js/disclosure.js (WP4) — the single definition
    // of the ladder. If that module did not load, fail closed rather than
    // silently disclosing everything. The GM path never reaches here: `level`
    // is null/'g' and filterBlocks returns early.
    function _atLeast(current, required) {
        const M = (typeof window !== 'undefined') && window.DisclosureModel;
        return (M && typeof M.atLeast === 'function') ? M.atLeast(current, required) : false;
    }

    // Drop `f` blocks the level does not permit, then remove headings left with
    // nothing under them. A heading is empty only if no content precedes the
    // next heading at the SAME OR SHALLOWER depth — otherwise an h2 whose
    // content sits under an h3 would be wrongly discarded.
    function _pruneEmptySections(blocks) {
        const out = [];
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.t === 'h') {
                let hasContent = false;
                for (let j = i + 1; j < blocks.length; j++) {
                    const n = blocks[j];
                    if (n.t === 'h' && n.level <= b.level) break;
                    if (n.t === 'f' || n.t === 'tbl' || (n.t === 'txt' && n.text)) {
                        hasContent = true; break;
                    }
                }
                if (!hasContent) continue;
            }
            // Collapse runs of blank lines left behind by dropped fields.
            if (b.t === 'gap' && out.length && out[out.length - 1].t === 'gap') continue;
            out.push(b);
        }
        while (out.length && out[out.length - 1].t === 'gap') out.pop();
        return out;
    }

    // THE filter. `level` null or 'g' is the GM path and returns the input
    // untouched — no allocation, no behaviour change, which is what keeps the
    // existing exports byte-identical.
    function filterBlocks(blocks, context, level) {
        if (!level || level === 'g') return blocks;
        const kept = blocks.filter(b =>
            b.t !== 'f' || _atLeast(level, blockLevel(b, context)));
        return _pruneEmptySections(kept);
    }

    // ── Shared content builders ───────────────────────────────────────────────
    // Per-entity content both exporters need, as blocks.

    function travelZone(body) {
        return body.travelZone === 'Red' ? 'Red'
             : body.travelZone === 'Amber' ? 'Amber'
             : 'Green';
    }

    // The eight UWP digits, broken out. Returns a single blank line for a UWP
    // too short to decode — matching the empty string the original emitted.
    function uwpTableBlocks(uwp) {
        if (!uwp || uwp.length < 9) return [txt('')];
        return [tbl(['Attribute', 'Code'], [
            ['Starport',      uwp[0]],
            ['Size',          uwp[1]],
            ['Atmosphere',    uwp[2]],
            ['Hydrographics', uwp[3]],
            ['Population',    uwp[4]],
            ['Government',    uwp[5]],
            ['Law Level',     uwp[6]],
            ['Tech Level',    uwp[8]],
        ])];
    }

    function notesBlocks(state) {
        const text = (state.notes || '').trim();
        return [GAP, h(2, 'Referee Notes'), txt(text || '_(none)_')];
    }

    // Trade codes / travel zone / tech level — identical for worlds and moons.
    function detailBlocks(body) {
        const codes = (body.tradeCodes || []).join(' ') || '—';
        const b = [h(2, 'Details'), f('Trade Codes', codes), f('Travel Zone', travelZone(body))];
        if (body.tl != null) b.push(f('Tech Level', body.tl));
        return b;
    }

    // Used when no raw body could be resolved for an edition-aware formatter.
    function fallbackPhysicalBlocks(body) {
        const b = [];
        if (body.gravity != null)   b.push(f('Gravity', `${n(body.gravity)} G`));
        if (body.diamKm != null)    b.push(f('Diameter', `${body.diamKm.toLocaleString()} km`));
        if (body.meanTempK != null) b.push(f('Mean Temp', `${n(body.meanTempK)} K`));
        return b;
    }

    function fallbackStarBlocks(star) {
        const b = [];
        if (star.lum  != null) b.push(f('Luminosity', `${n(star.lum)} L☉`));
        if (star.mass != null) b.push(f('Mass', `${n(star.mass)} M☉`));
        return b;
    }

    function systemOverviewBlocks(state) {
        const b = [];
        if (state.mgtSystem) {
            const sys = state.mgtSystem;
            b.push(GAP, h(2, 'System Overview'));
            if (sys.age  != null) b.push(f('Age', `${sys.age.toFixed(2)} Gyr`));
            if (sys.hzco != null) b.push(f('HZco (Primary)', sys.hzco.toFixed(2)));
            if (sys.ptypeHzco != null) b.push(f('P-Type HZco', sys.ptypeHzco.toFixed(2)));
            if (sys.ptypeInnerLimit != null && sys.ptypeInnerLimit !== Infinity)
                b.push(f('P-Type Inner Limit', `${sys.ptypeInnerLimit.toFixed(2)} AU`));
            const mwb = state.mgt2eData || state.t5Data || state.ctData;
            if (mwb && mwb.travelZone && mwb.travelZone !== 'Green')
                b.push(f('Travel Zone', mwb.travelZone));
        } else if (state.ctSystem) {
            const sys = state.ctSystem;
            b.push(GAP, h(2, 'System Overview'));
            if (sys.nature)            b.push(f('Nature', sys.nature));
            if (sys.maxOrbits != null) b.push(f('Total Orbits', sys.maxOrbits));
            const mwb = state.ctData || state.mgt2eData;
            if (mwb && mwb.travelZone && mwb.travelZone !== 'Green')
                b.push(f('Travel Zone', mwb.travelZone));
        } else if (state.t5System) {
            const sys = state.t5System;
            b.push(GAP, h(2, 'System Overview'));
            if (sys.stars) {
                sys.stars.forEach(s => {
                    // The LABEL here is the star's role — data, not a fixed
                    // string — so it cannot be tagged in FIELD_LEVELS. Carry an
                    // explicit level instead: this is stellar detail, (b).
                    // NOTE for WP5 slice 5b: the VALUE carries the star's name,
                    // which is gated to (d) per fog_of_war_field_tags §3.11a.
                    // Filtering alone does not fix that — the name must be
                    // replaced with a generic label below (d).
                    b.push(Object.assign(
                        f(s.role, `${s.name} (Lum: ${s.luminosity ? s.luminosity.toFixed(3) : '?'})`),
                        { lvl: 'b' }));
                });
            }
            const mwb = state.t5Data || state.mgt2eData;
            if (mwb && mwb.travelZone && mwb.travelZone !== 'Green')
                b.push(f('Travel Zone', mwb.travelZone));
        }
        return b;
    }

    // ── Edition-aware field formatters ────────────────────────────────────────
    // Moved from obsidian_exporter.js in WP2 slice 2a, now that a second consumer
    // exists. Already format-neutral since WP1 slice 2 — they return blocks.

    function formatMgtWorldFields(raw, isMainworld, state) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];

        if (raw.classifications && raw.classifications.length > 0)
            b.push(f('Classification', raw.classifications.join(', ')));

        b.push(GAP, h(3, 'Orbital Data'));
        if (raw.orbitId  != null) b.push(f('Orbit ID', raw.orbitId.toFixed(2)));
        if (raw.orbitType)        b.push(f('Orbit Type', raw.orbitType));
        if (raw.au != null)       b.push(f('Distance', `${n(raw.au)} AU`));
        if (raw.eccentricity != null) b.push(f('Eccentricity', raw.eccentricity));
        if (raw.periodYears != null) {
            const ps = raw.periodYears < 1
                ? `${(raw.periodYears * 365.25).toFixed(1)} days`
                : `${raw.periodYears.toFixed(2)} years`;
            b.push(f('Period', ps));
        }

        const isBelt = raw.type === 'Planetoid Belt';
        const isGG   = raw.type === 'Gas Giant';
        const noBody = raw.size == 0 || raw.size === 'R';

        if (!isBelt && !noBody) {
            b.push(GAP, h(3, 'Physical Properties'));
            if (raw.composition != null) b.push(f('Composition', raw.composition));
            if (raw.density != null)     b.push(f('Density', `${Number(raw.density).toFixed(3)} ρ⊕`));
            if (raw.gravity != null)     b.push(f('Gravity', `${n(raw.gravity)} G`));
            if (raw.mass != null)        b.push(f('Mass', `${n(raw.mass)} M⊕`));
            if (!isGG && raw.diamKm != null)   b.push(f('Diameter', `${Math.round(raw.diamKm).toLocaleString()} km`));
            if (isGG && raw.diamTerra != null) b.push(f('Diameter', `${n(raw.diamTerra)} T⊕`));
            if (raw.hydroPercent != null) b.push(f('Hydrographics', `${n(raw.hydroPercent)}%`));

            if (raw.meanTempK != null) {
                b.push(GAP, h(3, 'Temperature'));
                b.push(f('Mean', `${n(kToC(raw.meanTempK))} °C`));
                if (raw.lowTempK  != null && !isNaN(raw.lowTempK))  b.push(f('Low', `${n(kToC(raw.lowTempK))} °C`));
                if (raw.highTempK != null && !isNaN(raw.highTempK)) b.push(f('High', `${n(kToC(raw.highTempK))} °C`));
            }

            b.push(GAP, h(3, 'Atmosphere'));
            if (raw.gases && raw.gases.length > 0)
                b.push(f('Gases', raw.gases.join(', ')));
            else if (raw.oxygenFraction != null)
                b.push(f('O₂ Fraction', raw.oxygenFraction));
            else
                b.push(f('Atmosphere', 'None'));
            if (raw.totalPressureBar != null) b.push(f('Pressure', `${n(raw.totalPressureBar)} bar`));
            if (raw.taints) {
                const arr = Array.isArray(raw.taints) ? raw.taints : [raw.taints];
                if (arr.length) b.push(f('Taints', arr.join(', ')));
            }

            b.push(GAP, h(3, 'Rotation'));
            if (raw.solarDayHours != null) {
                if (raw.solarDayHours === Infinity || raw.isTwilightZone)
                    b.push(f('Solar Day', 'Twilight Zone'));
                else
                    b.push(f('Solar Day', `${n(raw.solarDayHours)} hrs`));
            }
            if (raw.axialTilt != null) b.push(f('Axial Tilt', `${n(raw.axialTilt)}°`));
        }

        if (isGG && raw.uwpGG) {
            b.push(GAP, h(3, 'Gas Giant Profile'));
            b.push(fc('SAH Code', raw.uwpGG));
        }

        if (isBelt) {
            b.push(GAP, h(3, 'Belt Profile'));
            if (raw.beltProfileString) b.push(fc('Profile', raw.beltProfileString));
            if (raw.span != null)           b.push(f('Span', raw.span));
            if (raw.bulk != null)           b.push(f('Bulk', raw.bulk));
            if (raw.resourceRating != null) b.push(f('Resource Rating', raw.resourceRating));
            if (raw.mType != null)          b.push(f('M-Type', `${n(raw.mType)}%`));
            if (raw.sType != null)          b.push(f('S-Type', `${n(raw.sType)}%`));
            if (raw.cType != null)          b.push(f('C-Type', `${n(raw.cType)}%`));
            if (raw.oType != null)          b.push(f('O-Type', `${n(raw.oType)}%`));
        }

        if (!isBelt && !noBody) {
            if (raw.lifeProfile != null || raw.habitability != null || raw.resourceRating != null) {
                b.push(GAP, h(3, 'Habitability'));
                if (raw.lifeProfile != null)    b.push(f('Native Life', raw.lifeProfile));
                if (raw.habitability != null)   b.push(f('Habitability', `${n(raw.habitability)}/15`));
                if (raw.resourceRating != null) b.push(f('Resource Rating', raw.resourceRating));
                if (raw.secRU != null && raw.secPop > 0) b.push(f('Secondary RU', raw.secRU));
            }
        }

        if (isMainworld) {
            b.push(GAP);
            if (state.allegiance) b.push(f('Allegiance', state.allegiance));
            if (state.cluster)    b.push(f('Region', state.cluster));
        }

        return b;
    }

    function formatMgtMoonFields(raw) {
        if (!raw) return [];
        // NOTE: no GAP before this '### Orbital Data' — the original pushed it
        // without a leading blank line, unlike formatMgtWorldFields. Preserved.
        const b = [GAP, h(2, 'Physical Data'), h(3, 'Orbital Data')];

        if (raw.pd != null)           b.push(f('Orbit (⌀)', raw.pd));
        if (raw.eccentricity != null) b.push(f('Eccentricity', raw.eccentricity));
        if (raw.periodHrs != null)    b.push(f('Period', `${n(raw.periodHrs)} hrs`));

        const noBody = raw.size == 0 || raw.size === 'R';
        if (!noBody) {
            b.push(GAP, h(3, 'Physical Properties'));
            if (raw.composition != null) b.push(f('Composition', raw.composition));
            if (raw.density != null)     b.push(f('Density', `${Number(raw.density).toFixed(3)} ρ⊕`));
            if (raw.gravity != null)     b.push(f('Gravity', `${n(raw.gravity)} G`));
            if (raw.mass != null)        b.push(f('Mass', `${n(raw.mass)} M⊕`));
            if (raw.diamKm != null)      b.push(f('Diameter', `${Math.round(raw.diamKm).toLocaleString()} km`));
            if (raw.hydroPercent != null) b.push(f('Hydrographics', `${n(raw.hydroPercent)}%`));

            if (raw.meanTempK != null) {
                b.push(GAP, h(3, 'Temperature'));
                b.push(f('Mean', `${n(kToC(raw.meanTempK))} °C`));
                if (raw.lowTempK  != null && !isNaN(raw.lowTempK))  b.push(f('Low', `${n(kToC(raw.lowTempK))} °C`));
                if (raw.highTempK != null && !isNaN(raw.highTempK)) b.push(f('High', `${n(kToC(raw.highTempK))} °C`));
            }

            b.push(GAP, h(3, 'Atmosphere'));
            if (raw.gases && raw.gases.length > 0)
                b.push(f('Gases', raw.gases.join(', ')));
            else if (raw.oxygenFraction != null)
                b.push(f('O₂ Fraction', raw.oxygenFraction));
            else
                b.push(f('Atmosphere', 'None'));
            if (raw.totalPressureBar != null) b.push(f('Pressure', `${n(raw.totalPressureBar)} bar`));
            if (raw.taints) {
                const arr = Array.isArray(raw.taints) ? raw.taints : [raw.taints];
                if (arr.length) b.push(f('Taints', arr.join(', ')));
            }

            b.push(GAP, h(3, 'Rotation'));
            if (raw.solarDayHours != null) {
                if (raw.solarDayHours === Infinity || raw.isTwilightZone)
                    b.push(f('Solar Day', 'Twilight Zone'));
                else
                    b.push(f('Solar Day', `${n(raw.solarDayHours)} hrs`));
            }
            if (raw.axialTilt != null) b.push(f('Axial Tilt', `${n(raw.axialTilt)}°`));

            if (raw.lifeProfile != null || raw.habitability != null || raw.resourceRating != null) {
                b.push(GAP, h(3, 'Habitability'));
                if (raw.lifeProfile != null)    b.push(f('Native Life', raw.lifeProfile));
                if (raw.habitability != null)   b.push(f('Habitability', `${n(raw.habitability)}/15`));
                if (raw.resourceRating != null) b.push(f('Resource Rating', raw.resourceRating));
            }
        }
        return b;
    }

    function formatMgtStarFields(raw, isPrimary) {
        if (!raw) return [];
        const b = [];
        if (raw.mass != null) b.push(f('Mass', `${n(raw.mass)} M☉`));
        if (raw.lum  != null) b.push(f('Luminosity', `${n(raw.lum)} L☉`));
        if (!isPrimary) {
            if (raw.separation)           b.push(f('Separation', raw.separation));
            if (raw.orbitId != null)      b.push(f('Orbit ID', raw.orbitId));
            if (raw.eccentricity != null) b.push(f('Eccentricity', raw.eccentricity));
            if (raw.mao != null)          b.push(f('MAO', raw.mao));
        }
        return b;
    }

    function formatMgtSocio(s) {
        if (!s || s.pValue === undefined) return [];
        const b = [GAP, h(2, 'Socioeconomics')];
        if (s.pValue != null)       b.push(f('pValue', s.pValue));
        if (s.totalWorldPop)        b.push(f('Total Population', s.totalWorldPop.toLocaleString()));
        if (s.pcr != null)          b.push(f('PCR', s.pcr));
        if (s.urbanPercent != null) b.push(f('Urban %', `${n(s.urbanPercent)}%`));
        if (s.totalUrbanPop)        b.push(f('Urban Population', s.totalUrbanPop.toLocaleString()));
        if (s.majorCities != null)  b.push(f('Major Cities', s.majorCities));
        if (s.totalMajorCityPop)    b.push(f('Major City Population', s.totalMajorCityPop.toLocaleString()));
        b.push(GAP);
        if (s.govProfile)            b.push(f('Government Profile', s.govProfile));
        if (s.factions != null)      b.push(f('Factions', s.factions));
        if (s.judicialSystemProfile) b.push(f('Judicial Profile', s.judicialSystemProfile));
        if (s.lawProfile)            b.push(f('Law Profile', s.lawProfile));
        if (s.techProfile)           b.push(f('Tech Profile', s.techProfile));
        if (s.culturalProfile)       b.push(f('Cultural Profile', s.culturalProfile));
        if (s.culturalQuirks && s.culturalQuirks.length > 0)
            b.push(f('Cultural Quirks', s.culturalQuirks.join(', ')));
        b.push(GAP);
        if (s.Im != null)            b.push(f('Importance (Im)', s.Im));
        if (s.economicProfile)       b.push(f('Economic Profile', s.economicProfile));
        if (s.RU != null)            b.push(f('Resource Units (RU)', s.RU));
        if (s.pcGWP != null)         b.push(f('Per-Capita GWP', s.pcGWP));
        if (s.WTN != null)           b.push(f('World Trade Number (WTN)', s.WTN));
        if (s.IR != null)            b.push(f('Import Rating (IR)', s.IR));
        if (s.DR != null)            b.push(f('Discount Rate (DR)', s.DR));
        if (s.starportProfile)       b.push(f('Starport Profile', s.starportProfile));
        if (s.militaryProfile)       b.push(f('Military Profile', s.militaryProfile));
        return b;
    }

    function formatCtBodyFields(raw, orb, isMainworld, state) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];
        if (orb) {
            b.push(f('Orbit', orb.orbit));
            if (orb.zone) b.push(f('Zone', orb.zone));
        }
        if (raw.distAU != null)         b.push(f('Distance', `${n(raw.distAU)} AU`));
        if (raw.orbitalPeriod != null)  b.push(f('Orbital Period', `${n(raw.orbitalPeriod)} yr`));
        if (raw.diamKm != null)         b.push(f('Diameter', `${Math.round(raw.diamKm).toLocaleString()} km`));
        if (raw.gravity != null)        b.push(f('Gravity', `${n(raw.gravity)} G`));
        if (raw.mass != null)           b.push(f('Mass', `${n(raw.mass)} M⊕`));
        if (raw.temperature != null)    b.push(f('Temperature', `${n(raw.temperature)} K`));
        if (raw.rotationPeriod != null) b.push(f('Rotation Period', raw.rotationPeriod));
        if (raw.axialTilt != null)      b.push(f('Axial Tilt', `${n(raw.axialTilt)}°`));
        if (isMainworld) {
            if (state.allegiance) b.push(f('Allegiance', state.allegiance));
            if (state.cluster)    b.push(f('Region', state.cluster));
        }
        return b;
    }

    function formatCtSatFields(raw, isMainworld, state) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];
        if (raw.distAU != null)         b.push(f('Distance', `${n(raw.distAU)} AU`));
        if (raw.gravity != null)        b.push(f('Gravity', `${n(raw.gravity)} G`));
        if (raw.mass != null)           b.push(f('Mass', `${n(raw.mass)} M⊕`));
        if (raw.temperature != null)    b.push(f('Temperature', `${n(raw.temperature)} K`));
        if (raw.rotationPeriod != null) b.push(f('Rotation Period', raw.rotationPeriod));
        if (raw.axialTilt != null)      b.push(f('Axial Tilt', `${n(raw.axialTilt)}°`));
        if (isMainworld) {
            if (state.allegiance) b.push(f('Allegiance', state.allegiance));
            if (state.cluster)    b.push(f('Region', state.cluster));
        }
        return b;
    }

    function formatCtStarFields(raw, starIdx) {
        if (!raw) return [];
        const b = [];
        if (raw.type) b.push(f('Spectral Type', raw.type));
        if (raw.size) b.push(f('Luminosity Class', raw.size));
        if (starIdx > 0 && raw.orbitLabel) b.push(f('Orbit', raw.orbitLabel));
        return b;
    }

    function formatT5WorldFields(raw, orb, isMainworld, state) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];
        if (orb && orb.distAU != null) b.push(f('Distance', `${orb.distAU.toFixed(2)} AU`));
        if (raw.worldType)             b.push(f('World Type', raw.worldType));
        if (raw.climateZone)           b.push(f('Climate Zone', raw.climateZone));
        if (raw.diamKm != null)        b.push(f('Diameter', `${Math.round(raw.diamKm).toLocaleString()} km`));
        if (raw.gravity !== undefined) b.push(f('Gravity', `${n(raw.gravity)} G`));
        const mv = raw.massEarths ?? raw.mass;
        if (mv != null)                b.push(f('Mass', `${n(mv)} M⊕`));
        if (raw.rotationState !== undefined) b.push(f('Rotation', raw.rotationState));
        if (isMainworld) {
            if (state.allegiance) b.push(f('Allegiance', state.allegiance));
            if (state.cluster)    b.push(f('Region', state.cluster));
        }
        return b;
    }

    function formatT5SatFields(raw) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];
        if (raw.worldType)             b.push(f('World Type', raw.worldType));
        if (raw.climateZone)           b.push(f('Climate Zone', raw.climateZone));
        if (raw.diamKm != null)        b.push(f('Diameter', `${Math.round(raw.diamKm).toLocaleString()} km`));
        if (raw.gravity !== undefined) b.push(f('Gravity', `${n(raw.gravity)} G`));
        const mv = raw.massEarths ?? raw.mass;
        if (mv != null)                b.push(f('Mass', `${n(mv)} M⊕`));
        if (raw.rotationState !== undefined) b.push(f('Rotation', raw.rotationState));
        return b;
    }

    function formatT5StarFields(raw, starIdx) {
        if (!raw) return [];
        const b = [];
        if (raw.type)     b.push(f('Spectral Type', raw.type));
        if (raw.decimal != null) b.push(f('Decimal', raw.decimal));
        if (raw.size)     b.push(f('Luminosity Class', raw.size));
        if (raw.luminosity != null) b.push(f('Luminosity', `${raw.luminosity.toFixed(3)} L☉`));
        if (starIdx > 0 && raw.orbitLabel) b.push(f('Orbit', raw.orbitLabel));
        return b;
    }

    function formatT5Socio(s) {
        if (!s) return [];
        const b = [GAP, h(2, 'Socioeconomics (T5)')];
        if (s.popMultiplier != null) b.push(f('Pop Multiplier', s.popMultiplier));
        if (s.belts != null)         b.push(f('Belts', s.belts));
        if (s.gasGiants != null)     b.push(f('Gas Giants', s.gasGiants));
        if (s.worlds != null)        b.push(f('Worlds', s.worlds));
        const ix = s.Importance ?? s.Ix;
        if (ix != null)              b.push(f('Importance (Ix)', ix));
        const ru = s.ResourceUnits ?? s.RU;
        if (ru != null)              b.push(f('Resource Units (RU)', ru));
        const r = s.ecoResources ?? s.R;
        if (r != null)               b.push(f('R (Resources)', r));
        const l = s.ecoLabor ?? s.L;
        if (l != null)               b.push(f('L (Labor)', l));
        const inf = s.ecoInfrastructure ?? s.I;
        if (inf != null)             b.push(f('I (Infrastructure)', inf));
        const e = s.ecoEfficiency ?? s.E;
        if (e != null)               b.push(f('E (Efficiency)', e));
        if (s.H != null)             b.push(f('H', s.H));
        if (s.A != null)             b.push(f('A', s.A));
        if (s.S != null)             b.push(f('S', s.S));
        if (s.Sym != null)           b.push(f('Sym', s.Sym));
        return b;
    }

    // HX-8 (2026-08-01). AoW is the richest engine in the codebase — its bodies carry
    // roughly ninety fields of planetary simulation. This formatter deliberately
    // surfaces only the subset whose quantity AND unit are unambiguous and already
    // labelled the same way for another engine.
    //
    // DELIBERATELY OMITTED, pending a ruling against the Architect of Worlds manual:
    //   - `habitability` — runs -6..8 here, where MgT2E's formatter prints "X/15".
    //     Reusing that label would render a nonsense scale.
    //   - `orbitalPeriod` (24.79 - 2,758,542) and `rotationPeriod` (5 - 4,816) —
    //     no stated unit. Days? Hours? A wrong unit is worse than a missing field.
    //   - AoW-specific terms: tBb, mNum, rFactor, Rmin/Rmax, tidalModifier, tDeep,
    //     tMulti, tPhoto, tOxy, tAnimal, tPresapient, grandTackMovement, arrivalOrbit,
    //     formationOrbitType, scaleHeight, avgMolMass, and the per-gas partial
    //     pressures. Meaning and label both unknown — do not guess.
    // See HX-8 in directives/html_extract_manifest.md.
    function formatAoWBodyFields(raw, isMainworld, state) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];

        const au = raw.orbitalRadius ?? raw.orbitId;
        if (au != null)                b.push(f('Distance', `${n(au)} AU`));
        if (raw.eccentricity != null)  b.push(f('Eccentricity', raw.eccentricity));

        b.push(GAP, h(3, 'Physical Properties'));
        if (raw.mass != null)          b.push(f('Mass', `${n(raw.mass)} M⊕`));
        if (raw.density != null)       b.push(f('Density', `${n(raw.density)} ρ⊕`));
        const g = raw.surfaceGravity ?? raw.gravity;
        if (g != null)                 b.push(f('Gravity', `${n(g)} G`));
        if (raw.radius != null)        b.push(f('Diameter', `${Math.round(raw.radius * 2).toLocaleString()} km`));
        if (raw.obliquity != null)     b.push(f('Axial Tilt', `${n(raw.obliquity)}°`));
        if (raw.albedo != null)        b.push(f('Albedo', raw.albedo));

        if (raw.avgSurfaceTemp != null || raw.atmPressure != null) {
            b.push(GAP, h(3, 'Surface'));
            if (raw.avgSurfaceTemp != null) b.push(f('Mean Temperature', `${n(raw.avgSurfaceTemp)} K`));
            if (raw.atmPressure != null)    b.push(f('Pressure', `${n(raw.atmPressure)} bar`));
            if (raw.waterCoverage != null)  b.push(f('Water Coverage', `${n(raw.waterCoverage)}%`));
            if (raw.breathability) {
                const arr = Array.isArray(raw.breathability) ? raw.breathability : [raw.breathability];
                if (arr.length) b.push(f('Breathability', arr.join(', ')));
            }
        }

        if (raw.worldClass || raw.lithosphere || raw.magneticField) {
            b.push(GAP, h(3, 'Geophysics'));
            if (raw.worldClass)    b.push(f('World Class', raw.worldClass));
            if (raw.lithosphere)   b.push(f('Lithosphere', raw.lithosphere));
            if (raw.magneticField) b.push(f('Magnetic Field', raw.magneticField));
        }

        if (isMainworld && state) {
            b.push(GAP);
            if (state.allegiance) b.push(f('Allegiance', state.allegiance));
            if (state.cluster)    b.push(f('Region', state.cluster));
        }
        return b;
    }

    // Socioeconomics, resolved per engine. Shared so both exporters agree — they
    // previously each inlined the same two checks.
    //
    // AoW stores its socioeconomics on the mainworld BODY rather than on the hex
    // state, but under MgT2E's own field names, so the MgT2E formatter renders it
    // unchanged. `else if` so nothing changes for an engine that has state.mgtSocio.
    function socioBlocks(state, raw) {
        const out = [];
        if (state.mgtSocio && state.mgtSocio.pValue !== undefined) {
            out.push(...formatMgtSocio(state.mgtSocio));
        } else if (state.aowSystem && raw && raw.pValue !== undefined) {
            out.push(...formatMgtSocio(raw));
        }
        if (state.t5Socio) out.push(...formatT5Socio(state.t5Socio));
        return out;
    }

    // NOTE (HX-6): never reached today — _findRttRawBody cannot match RTT's
    // flat star.planetarySystem.orbits[] layout, so this returns for a raw that
    // is always null. Converted anyway so the shape is ready when that is fixed.
    function formatRttBodyFields(raw, isMainworld, state) {
        if (!raw) return [];
        const b = [GAP, h(2, 'Physical Data')];
        if (raw.type)               b.push(f('Type', raw.type));
        if (raw.worldClass)         b.push(f('World Class', raw.worldClass));
        if (raw.chemistry)          b.push(f('Chemistry', raw.chemistry));
        if (raw.biosphere != null)  b.push(f('Biosphere', raw.biosphere));
        if (raw.rings)              b.push(f('Rings', raw.rings));
        if (raw.habitationType)     b.push(f('Habitation', raw.habitationType));
        if (raw.desirability != null) b.push(f('Desirability', raw.desirability));
        if (raw.industry != null)   b.push(f('Industry', raw.industry));
        if (raw.starport && raw.habitationType !== 'Uninhabited')
            b.push(f('Starport', raw.starport));
        if (raw.canBeTerraformed && raw.terraformPoints != null)
            b.push(f('Terraforming Potential', `${n(raw.terraformPoints)} pts`));
        if (isMainworld) {
            if (state.allegiance) b.push(f('Allegiance', state.allegiance));
            if (state.cluster)    b.push(f('Region', state.cluster));
        }
        return b;
    }

    // ── Image rendering ───────────────────────────────────────────────────────

    function canRenderImage(world) {
        return !!(world.uwp &&
            world.type !== 'Gas Giant' &&
            world.type !== 'Planetoid Belt' &&
            world.type !== 'Empty');
    }

    function isAirless(world) {
        const uwp = world.uwp || '';
        const atm = uwp.length >= 3 ? (parseInt(uwp[2], 16) || 0) : 0;
        const hyd = uwp.length >= 4 ? (parseInt(uwp[3], 16) || 0) : 0;
        return atm === 0 && hyd === 0;
    }

    // `hexId` is the bare hex id; `seedFallback` is a positional suffix used
    // only for a body with no name. The seed itself is built by
    // PlanetRenderer.imageSeed — the one definition shared with the in-app
    // viewers, so an exported world and the same world on screen are the same
    // planet. Do not reconstruct a seed string here.
    async function renderWorldImage(worldData, hexId, projection, seedFallback) {
        if (!canRenderImage(worldData)) return null;
        if (typeof PlanetRenderer === 'undefined') return null;
        const seedHexId = PlanetRenderer.imageSeed(hexId, worldData, seedFallback);

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
            size:          worldData.size ?? 0,
            uwp,
        };

        const canvas = document.createElement('canvas');
        if (!projection || projection === 'globe') {
            canvas.height = 300;
            canvas.width  = 700;
            PlanetRenderer.renderPlanetHemispheres(canvas, rendererData, seedHexId);
        } else {
            PlanetRenderer.renderFlatMap(canvas, rendererData, seedHexId, { projection });
        }

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) { resolve(null); return; }
                blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            }, 'image/png');
        });
    }

    return {
        crc32, buildZip,
        sanitize, systemFilename, bodyFilename,
        worldDisplayName, moonDisplayName, starDisplayName,
        resolveSystemName, resolveUWP, kToC,
        findRawWorld, findRawMoon, findRawStar,
        canRenderImage, isAirless, renderWorldImage,
        // block model
        GAP, h, f, fc, txt, tbl,
        // shared content
        travelZone, uwpTableBlocks, notesBlocks, detailBlocks,
        fallbackPhysicalBlocks, fallbackStarBlocks, systemOverviewBlocks,
        resolveWorldData, indexRowData, fmtNum,
        // Release 2 disclosure (WP5)
        FIELD_LEVELS, fieldLevel, blockLevel, filterBlocks,
        getUnknownFieldLabels, clearUnknownFieldLabels,
        // edition-aware formatters
        formatMgtWorldFields, formatMgtMoonFields, formatMgtStarFields, formatMgtSocio, formatCtBodyFields, formatCtSatFields, formatCtStarFields, formatT5WorldFields, formatT5SatFields, formatT5StarFields, formatT5Socio, formatRttBodyFields,
        formatAoWBodyFields, socioBlocks,
    };

})();

window.ExportCore = ExportCore;
