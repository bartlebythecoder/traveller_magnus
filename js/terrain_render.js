'use strict';

// =============================================================================
// TERRAIN_RENDER.JS — Relief shading for regional terrain (v0.18 spike)
//
// Takes an elevation grid from terrain_field.js and produces a shaded image.
// Deliberately CPU/Canvas-2D only: no WebGL, no dependency, no build step, and
// bit-identical output on every machine (GPU float precision varies by vendor,
// which would break the determinism requirement).
//
// Pipeline, in order:
//   1. normals       — true gradient from metres-per-pixel and metre elevation
//   2. cast shadows  — horizon march toward the light; the single biggest cue
//                      that relief is real rather than embossed
//   3. ambient occl. — multi-directional horizon sampling; darkens valley floors
//   4. classify      — slope + elevation + latitude → terrain material.
//                      Doubles as the legend: the material table IS the key.
//   5. shade         — albedo × (lambert + ambient) × shadow × AO, then haze
//
// Exposes: window.TerrainRender
// =============================================================================

const TerrainRender = (() => {

    const vnoise3 = (x, y, z, s) => TerrainField.vnoise3(x, y, z, s);

    // ── World-type classification ────────────────────────────────────────────
    // Mirrors _buildPalette() in planet_renderer.js so a regional map never
    // disagrees with the whole-world map about what kind of world this is.

    function parseStat(v) {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseInt(v, 16) || 0;
        return 0;
    }

    // Which terrain model is in force. v0.18 rule: every visual improvement is
    // gated to version 2 and version 1 is frozen, so no existing sector shifts.
    function fieldV() {
        return (typeof window !== 'undefined' && window.terrainFieldVersion) || 1;
    }

    // ── Shared climate predicates ────────────────────────────────────────────
    //
    // DUPLICATED IN planet_renderer.js `_buildPalette`, deliberately and with
    // regret. The two modules cannot import one another: the standalone harness
    // (utilities/test_regional_terrain.html) loads terrain_render WITHOUT
    // planet_renderer, and utilities/verify_field_v1.html loads planet_renderer
    // WITHOUT terrain_render. The existing `isIce` test is already duplicated
    // across the same gap for the same reason, so this follows the established
    // pattern rather than inventing a load-order dependency.
    //
    // KEEP THE TWO COPIES IDENTICAL. If one changes, change the other, or a
    // world image and its regional map will disagree about what world it is.

    // Cold enough that a dry surface is frost and ice-bound ground rather than
    // sand. 223 K is REUSED from the ice test below, not a second threshold.
    function isColdDry(worldData) {
        const tempK = worldData.temperatureK || 0;
        const tempStr = (worldData.temperature || '').toLowerCase();
        return (tempK > 0 && tempK < 223) || (tempK === 0 && tempStr.includes('frozen'));
    }

    // Warm, wet and breathable enough to carry plant cover. This is an ART
    // judgement, not a Traveller rule — no edition's tables describe surface
    // vegetation, so nothing here is derived from them. It reads only facts the
    // UWP already states.
    function isVegetated(worldData) {
        const atm   = parseStat(worldData.atmosphere);
        const hydro = parseStat(worldData.hydrographics);
        const tempK = worldData.temperatureK || 0;
        const tempStr = (worldData.temperature || '').toLowerCase();
        if (atm < 2 || atm > 9) return false;      // exotic/corrosive or trace
        if (hydro < 3) return false;               // too dry to green over
        if (tempK > 0) return tempK >= 255 && tempK <= 330;
        return !(tempStr.includes('frozen') || tempStr.includes('cold') ||
                 tempStr.includes('hot'));
    }

    function worldTypeOf(worldData) {
        const atm   = parseStat(worldData.atmosphere);
        const hydro = parseStat(worldData.hydrographics);
        const tempK = worldData.temperatureK || 0;
        const tempStr = (worldData.temperature || '').toLowerCase();

        const isMolten = (hydro === 15) || (hydro === 0 && tempK > 1000);
        const isExotic = (atm >= 10 && atm <= 12);
        if (isMolten) return 'molten';
        if (atm === 0 && hydro === 0) return 'rock';
        if ((atm === 0 && hydro > 0) ||
            (!isExotic && atm > 0 && hydro > 0 &&
             ((tempK > 0 && tempK < 223) || (tempK === 0 && tempStr.includes('frozen')))))
            return 'ice';
        if (isExotic) return hydro === 0 ? 'exotic_dry' : 'exotic_wet';
        // A dry world that is also cold is frost and shattered rock, not dune
        // sea. Version 2 only — at version 1 every dry world stays 'desert',
        // which is what utilities/verify_field_v1.html's 'cold' row protects.
        if (hydro === 0) return (fieldV() >= 2 && isColdDry(worldData))
            ? 'cold_desert' : 'desert';
        return 'standard';
    }

    // ── Material tables ──────────────────────────────────────────────────────
    // Order matters only for the legend. `c` is base albedo before lighting.

    const MATERIALS = {
        ice: [
            { id: 'open_water', label: 'Open Water (Seasonal)',      c: [ 34,  68,  96] },
            { id: 'frozen_sea', label: 'Frozen Sea (Pack Ice)',      c: [108, 142, 168] },
            { id: 'sea_ice',    label: 'Sea Ice (Permanent)',        c: [188, 208, 226] },
            { id: 'ice_sheet',  label: 'Ice Sheet / Glacier',        c: [226, 236, 247] },
            { id: 'crevasse',   label: 'Crevasse Field',             c: [158, 184, 208] },
            { id: 'tundra',     label: 'Tundra / Windswept Plains',  c: [150, 150, 145] },
            { id: 'scree',      label: 'Scree / Talus',              c: [122, 114, 106] },
            { id: 'rock',       label: 'Rocky Highlands',            c: [ 96,  90,  85] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [ 66,  61,  58] },
        ],
        standard: [
            { id: 'abyssal',    label: 'Abyssal Depths',             c: [ 28,  46,  74] },
            { id: 'deep',       label: 'Deep Ocean',                 c: [ 40,  70, 104] },
            { id: 'shelf',      label: 'Continental Shelf',          c: [ 62,  98, 132] },
            { id: 'shallow',    label: 'Shallow Water',              c: [ 92, 128, 158] },
            { id: 'beach',      label: 'Coastal Strand',             c: [168, 158, 132] },
            { id: 'lowland',    label: 'Lowland Plains',             c: [138, 130, 110] },
            { id: 'upland',     label: 'Uplands',                    c: [124, 116, 100] },
            { id: 'highland',   label: 'Rocky Highlands',            c: [112, 106,  98] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [ 94,  90,  87] },
            { id: 'snow',       label: 'Snowfield / Permafrost',     c: [216, 222, 232] },
        ],
        // A cold dry world: no liquid to pool, no heat to drive a dune sea.
        // Ground is frost-bound regolith, wind-stripped pavement and rock
        // broken by freeze-thaw. Deliberately desaturated blue-grey — it must
        // read as neither the warm tan desert nor the bright white ice world.
        cold_desert: [
            { id: 'frostpan',   label: 'Frost Pan',                  c: [201, 206, 211] },
            { id: 'permafrost', label: 'Permafrost Flats',           c: [172, 177, 182] },
            { id: 'icecement',  label: 'Ice-Cemented Regolith',      c: [146, 150, 155] },
            { id: 'pavement',   label: 'Wind-Scoured Pavement',      c: [124, 126, 129] },
            { id: 'shattered',  label: 'Frost-Shattered Rock',       c: [104, 105, 107] },
            { id: 'scree',      label: 'Scree / Talus',              c: [ 88,  88,  90] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [ 74,  75,  78] },
        ],
        desert: [
            { id: 'saltpan',    label: 'Salt Pan / Playa',           c: [196, 190, 176] },
            { id: 'dune',       label: 'Dune Sea',                   c: [182, 158, 114] },
            { id: 'sandflat',   label: 'Sand Flats',                 c: [168, 146, 104] },
            { id: 'rockdesert', label: 'Rocky Desert',               c: [144, 122,  86] },
            { id: 'mesa',       label: 'Mesa / Escarpment',          c: [120, 100,  70] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [ 96,  80,  58] },
        ],
        rock: [
            { id: 'regolith',   label: 'Regolith Plains',            c: [ 62,  59,  58] },
            { id: 'lowland',    label: 'Basin Floor',                c: [ 78,  74,  71] },
            { id: 'upland',     label: 'Rolling Uplands',            c: [ 98,  93,  89] },
            { id: 'highland',   label: 'Rocky Highlands',            c: [118, 112, 106] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [140, 133, 126] },
        ],
        molten: [
            { id: 'lava',       label: 'Molten Lava',                c: [252, 148,  18] },
            { id: 'hotcrust',   label: 'Cooling Crust',              c: [190,  58,  10] },
            { id: 'crust',      label: 'Solidified Crust',           c: [ 74,  20,  10] },
            { id: 'darkcrust',  label: 'Dark Crust',                 c: [ 34,  14,  12] },
        ],
        exotic_dry: [
            { id: 'lowland',    label: 'Volcanic Plains',            c: [ 82,  38,  14] },
            { id: 'upland',     label: 'Corroded Uplands',           c: [112,  58,  20] },
            { id: 'highland',   label: 'Exposed Highlands',          c: [138,  72,  28] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [ 78,  36,  14] },
        ],
        exotic_wet: [
            { id: 'deep',       label: 'Deep Sea',                   c: [ 18,  68,  28] },
            { id: 'shallow',    label: 'Shallow Sea',                c: [ 60, 132,  52] },
            { id: 'shore',      label: 'Shoreline',                  c: [ 82, 100,  48] },
            { id: 'lowland',    label: 'Lowland Plains',             c: [ 98,  78,  36] },
            { id: 'highland',   label: 'Highlands',                  c: [124,  88,  42] },
            { id: 'mountain',   label: 'Mountain Ranges',            c: [148, 118,  62] },
        ],
    };

    // ── Seeded exotic-ocean palettes ─────────────────────────────────────────
    //
    // Transcribed from _buildPalette() in planet_renderer.js, INCLUDING its
    // selection formula. Exotic wet worlds are the only ones in the app whose
    // colours are seeded rather than fixed — atmosphere A, B and C each carry
    // several ocean/land pairings, chosen by the '-oc' RNG draw.
    //
    // Hardcoding the green variant here meant a world whose global image showed
    // a purple ocean got a green regional map. Note C has three variants where
    // A and B have four, so selection must use the real array length.
    const EXOTIC_VARIANTS = {
        10: [
            { deep: [ 18,  68,  28], shallow: [ 60, 132,  52], shore: [ 82, 100,  48],
              coastal: [ 72,  80,  40], lowland: [ 88,  70,  32], highland: [108,  76,  36],
              mountains: [128,  88,  44] },
            { deep: [  8,  10,  15], shallow: [ 25,  28,  38], shore: [ 40,  35,  32],
              coastal: [ 95,  82,  48], lowland: [115,  98,  58], highland: [132, 112,  68],
              mountains: [148, 128,  82] },
            { deep: [ 20,   8,  55], shallow: [ 55,  28, 108], shore: [ 70,  40,  80],
              coastal: [ 88,  42,  28], lowland: [108,  58,  36], highland: [125,  72,  44],
              mountains: [140,  88,  55] },
            { deep: [ 55,   8,  75], shallow: [100,  32, 128], shore: [ 85,  45,  85],
              coastal: [105,  48,  22], lowland: [128,  62,  28], highland: [148,  78,  35],
              mountains: [162,  95,  45] },
        ],
        11: [
            { deep: [ 20,   8,  55], shallow: [ 55,  28, 108], shore: [ 70,  40,  80],
              coastal: [ 88,  42,  28], lowland: [108,  58,  36], highland: [125,  72,  44],
              mountains: [140,  88,  55] },
            { deep: [ 55,   8,  75], shallow: [100,  32, 128], shore: [ 85,  45,  85],
              coastal: [105,  48,  22], lowland: [128,  62,  28], highland: [148,  78,  35],
              mountains: [162,  95,  45] },
            { deep: [ 90,  70,  10], shallow: [158, 122,  28], shore: [140, 110,  55],
              coastal: [ 42,  52,  65], lowland: [ 58,  68,  82], highland: [ 75,  85,  98],
              mountains: [ 95, 102, 115] },
            { deep: [ 55,  95,   8], shallow: [108, 158,  25], shore: [ 95, 130,  45],
              coastal: [ 95,  38,  28], lowland: [118,  52,  35], highland: [138,  65,  42],
              mountains: [155,  82,  52] },
        ],
        12: [
            { deep: [110,  38,   8], shallow: [172,  78,  25], shore: [148,  85,  42],
              coastal: [ 40,  58,  45], lowland: [ 55,  72,  55], highland: [ 70,  85,  65],
              mountains: [ 88,  98,  78] },
            { deep: [ 90,  70,  10], shallow: [158, 122,  28], shore: [140, 110,  55],
              coastal: [ 42,  52,  65], lowland: [ 58,  68,  82], highland: [ 75,  85,  98],
              mountains: [ 95, 102, 115] },
            { deep: [ 55,  95,   8], shallow: [108, 158,  25], shore: [ 95, 130,  45],
              coastal: [ 95,  38,  28], lowland: [118,  52,  35], highland: [138,  65,  42],
              mountains: [155,  82,  52] },
        ],
    };

    function exoticVariant(atm, oceanRng) {
        const list = EXOTIC_VARIANTS[atm] || EXOTIC_VARIANTS[12];
        return list[Math.floor((oceanRng || 0) * list.length) % list.length];
    }

    // Material table for a world, substituting the seeded exotic palette.
    function materialsFor(type, atm, oceanRng) {
        if (type !== 'exotic_wet') return MATERIALS[type] || MATERIALS.standard;
        const v = exoticVariant(atm, oceanRng);
        return [
            { id: 'deep',     label: 'Deep Sea',        c: v.deep      },
            { id: 'shallow',  label: 'Shallow Sea',     c: v.shallow   },
            { id: 'shore',    label: 'Shoreline',       c: v.shore     },
            { id: 'lowland',  label: 'Lowland Plains',  c: v.lowland   },
            { id: 'highland', label: 'Highlands',       c: v.highland  },
            { id: 'mountain', label: 'Mountain Ranges', c: v.mountains },
        ];
    }

    // `worldData` is optional and used only to decide vegetation; callers that
    // omit it get the unvegetated ramp, which is the version-1 behaviour.
    function rampFor(type, atm, oceanRng, worldData) {
        if (type === 'standard' && fieldV() >= 2 && worldData && isVegetated(worldData)) {
            return RAMP.standard_veg;
        }
        if (type !== 'exotic_wet') return RAMP[type];
        const v = exoticVariant(atm, oceanRng);
        return [
            { t: 0.00, c: v.shore    }, { t: 0.18, c: v.coastal },
            { t: 0.50, c: v.lowland  }, { t: 1.00, c: v.highland },
        ];
    }

    // ── Polar caps ───────────────────────────────────────────────────────────
    //
    // Mirrors _buildPalette() in planet_renderer.js. The whole-world map paints
    // a LATITUDE-based cap: beyond a temperature-dependent latitude everything
    // blends toward a fixed ice colour, over an 8-degree fade, regardless of
    // altitude or whether it is land or sea.
    //
    // The regional map previously had only an altitude-based snow line, so at
    // 75N on a Cool world the global map showed solid icecap [212,218,232]
    // while the regional map showed open ocean [30,49,75]. Same world, same
    // coordinate, different planet.
    //
    // Applied to ALBEDO rather than to the final pixel, so relief shading still
    // reads through the ice instead of flattening it to a white sheet.

    const POLAR_COLOR = [212, 218, 232];

    // Thresholds transcribed from PlanetRenderer.tempBandFromKelvin().
    function tempBand(worldData) {
        const s = (worldData.temperature || '').toLowerCase();
        if (s) return s;
        const k = worldData.temperatureK || 0;
        if (!k) return 'temperate';
        if (k < 230) return 'frozen';
        if (k < 265) return 'cold';
        if (k < 290) return 'cool';
        if (k < 330) return 'temperate';
        if (k < 360) return 'warm';
        return 'hot';
    }

    function polarOverlay(type, worldData) {
        // These carry no overlay in planet_renderer — an ice world is already
        // ice everywhere, and molten/rock worlds have no caps.
        //
        // cold_desert joins them for the SAME reason, added 2026-09-14 after a
        // render showed why: below 223 K the frozen temperature band puts the
        // cap edge at 40 degrees, so a survey window anywhere poleward of that
        // came out solid white with a terrain key reading "Polar Ice Cap
        // 100.0%". The whole surface is frost-bound already — that is what the
        // cold_desert palette says — so a cap on top is counting it twice.
        if (type === 'molten' || type === 'rock' || type === 'ice'
            || type === 'cold_desert') return null;
        const s = tempBand(worldData || {});
        let deg;
        if (s.includes('frozen'))    deg = 40;
        else if (s.includes('cold')) deg = 55;
        else if (s.includes('cool')) deg = 68;
        else if (s.includes('warm')) deg = 82;
        else if (s.includes('hot'))  deg = 88;
        else                         deg = 75;   // temperate
        return { angleDeg: deg, fadeDeg: 8, color: POLAR_COLOR };
    }

    // Blend factor in [0,1] for a given absolute latitude in degrees.
    function polarBlend(polar, latAbsDeg) {
        if (!polar) return 0;
        const start = polar.angleDeg - polar.fadeDeg;
        if (latAbsDeg <= start) return 0;
        return Math.min(1, (latAbsDeg - start) / polar.fadeDeg);
    }

    function idxOf(list, id) {
        for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
        return 0;
    }

    // ── Hypsometric ramps ────────────────────────────────────────────────────
    // Lowland / upland / highland are NOT different materials — they are the
    // same ground at different heights. Rendering them as discrete bands
    // invents boundaries the terrain does not have, which show up as large
    // soft-edged tonal patches unrelated to any relief feature. The ids in
    // RAMP_IDS therefore take a continuous gradient instead, and survive as
    // legend entries only (a hypsometric key, exactly as a paper topo map has).
    //
    // Genuinely distinct surfaces — water, snow, ice, dune sand, crevasse,
    // slope-exposed rock — stay discrete, because they really are different
    // materials with hard edges.

    const RAMP = {
        standard: [
            { t: 0.00, c: [168, 158, 132] }, { t: 0.18, c: [142, 133, 112] },
            { t: 0.45, c: [126, 118, 102] }, { t: 0.72, c: [113, 107,  99] },
            { t: 1.00, c: [ 97,  93,  89] },
        ],
        // Vegetated land for a warm, wet, breathable world. Swapping the RAMP
        // is the whole of the vegetation change: this ramp colours exactly the
        // generic-ground band (beach -> lowland -> upland -> highland), while
        // snow, exposed mountain rock and every water material stay discrete
        // and untouched. No new materials, so the legend keeps its labels.
        standard_veg: [
            { t: 0.00, c: [176, 166, 132] },   // strand, unchanged in character
            { t: 0.10, c: [110, 132,  78] },   // coastal green
            { t: 0.34, c: [ 88, 118,  62] },   // lowland vegetation, deepest
            { t: 0.58, c: [104, 116,  76] },   // upland, thinning
            { t: 0.78, c: [114, 114,  95] },   // treeline, going to rock
            { t: 1.00, c: [ 99,  95,  90] },   // bare highland
        ],
        cold_desert: [
            { t: 0.00, c: [193, 198, 203] }, { t: 0.30, c: [158, 162, 167] },
            { t: 0.64, c: [126, 128, 131] }, { t: 1.00, c: [102, 103, 106] },
        ],
        desert: [
            { t: 0.00, c: [190, 182, 164] }, { t: 0.28, c: [170, 148, 106] },
            { t: 0.62, c: [148, 126,  90] }, { t: 1.00, c: [124, 104,  74] },
        ],
        rock: [
            { t: 0.00, c: [ 64,  61,  60] }, { t: 0.32, c: [ 80,  76,  73] },
            { t: 0.64, c: [ 99,  94,  90] }, { t: 1.00, c: [119, 113, 107] },
        ],
        exotic_dry: [
            { t: 0.00, c: [ 84,  40,  16] }, { t: 0.45, c: [112,  58,  20] },
            { t: 1.00, c: [138,  72,  28] },
        ],
        exotic_wet: [
            { t: 0.00, c: [ 86, 100,  50] }, { t: 0.45, c: [ 99,  79,  37] },
            { t: 1.00, c: [124,  88,  42] },
        ],
    };

    const RAMP_IDS = {
        standard:   new Set(['beach', 'lowland', 'upland', 'highland']),
        desert:     new Set(['saltpan', 'sandflat', 'rockdesert']),
        cold_desert: new Set(['frostpan', 'icecement', 'pavement']),
        rock:       new Set(['regolith', 'lowland', 'upland', 'highland']),
        exotic_dry: new Set(['lowland', 'upland', 'highland']),
        exotic_wet: new Set(['shore', 'lowland', 'highland']),
    };

    function colorFromStops(t, stops) {
        if (t <= stops[0].t) return stops[0].c;
        for (let i = 1; i < stops.length; i++) {
            if (t <= stops[i].t) {
                const range = stops[i].t - stops[i - 1].t;
                const b = range > 0 ? (t - stops[i - 1].t) / range : 0;
                const c1 = stops[i - 1].c, c2 = stops[i].c;
                return [c1[0] + (c2[0] - c1[0]) * b,
                        c1[1] + (c2[1] - c1[1]) * b,
                        c1[2] + (c2[2] - c1[2]) * b];
            }
        }
        return stops[stops.length - 1].c;
    }

    // ── Normals ──────────────────────────────────────────────────────────────
    // Central differences in real units. Elevation arrives in METRES and
    // metresPerPx gives the horizontal scale, so slope is a true gradient
    // (metres per metre) — which is what every material rule below is written
    // against, and what lets a 20 km site map and a 150 km regional map share
    // one set of thresholds.

    function computeNormals(f) {
        const { elev, W, H, metresPerPx } = f;
        const nx = new Float32Array(W * H);
        const ny = new Float32Array(W * H);
        const nz = new Float32Array(W * H);
        const slope = new Float32Array(W * H);
        const inv2 = 1 / (2 * metresPerPx);

        for (let y = 0; y < H; y++) {
            const ym = y > 0 ? y - 1 : 0;
            const yp = y < H - 1 ? y + 1 : H - 1;
            for (let x = 0; x < W; x++) {
                const xm = x > 0 ? x - 1 : 0;
                const xp = x < W - 1 ? x + 1 : W - 1;
                const dzdx = (elev[y * W + xp] - elev[y * W + xm]) * inv2;
                const dzdy = (elev[yp * W + x] - elev[ym * W + x]) * inv2;
                const len = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
                const i = y * W + x;
                nx[i] = -dzdx / len;
                ny[i] = -dzdy / len;
                nz[i] = 1 / len;
                slope[i] = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
            }
        }
        return { nx, ny, nz, slope };
    }

    // ── Cast shadows ─────────────────────────────────────────────────────────
    // March toward the light in image space; the ray climbs by tan(altitude)
    // per pixel of ground distance. Anything that rises above the ray occludes.
    // Returns 1 = fully lit, 0 = fully shadowed, with a soft edge.

    function castShadows(f, lightAzDeg, lightAltDeg, maxSteps) {
        const { elev, W, H, metresPerPx } = f;
        const shadow = new Float32Array(W * H).fill(1);
        const az  = lightAzDeg * Math.PI / 180;
        const alt = lightAltDeg * Math.PI / 180;

        // 2-D direction toward the light; +x east, +y south (image down).
        let lx = Math.sin(az);
        let ly = -Math.cos(az);
        const l2 = Math.sqrt(lx * lx + ly * ly);
        if (l2 < 1e-9) return shadow;
        lx /= l2; ly /= l2;

        const riseM = Math.tan(alt) * metresPerPx;  // ray climb per step
        // Penumbra width scales with the window's own relief, so the shadow
        // edge stays similarly soft whether the map spans 20 km or 500 km.
        const soften = Math.max(1, (f.elevMaxM - f.elevMinM) * 0.012);

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const h0 = elev[i];
                let maxExcess = 0;
                let sx = x, sy = y;
                for (let s = 1; s <= maxSteps; s++) {
                    sx += lx; sy += ly;
                    const ix = sx | 0, iy = sy | 0;
                    if (ix < 0 || iy < 0 || ix >= W || iy >= H) break;
                    const excess = elev[iy * W + ix] - (h0 + s * riseM);
                    if (excess > maxExcess) maxExcess = excess;
                }
                if (maxExcess > 0) {
                    const t = Math.min(1, maxExcess / soften);
                    shadow[i] = 1 - t * 0.88;   // never fully black; ambient fills
                }
            }
        }
        return shadow;
    }

    // ── Ambient occlusion ────────────────────────────────────────────────────
    // Horizon-angle sampling in K directions. Cheap approximation: AO is
    // 1 − mean(sin(horizon)). This is what puts darkness in crevasses and
    // valley floors and stops the whole image reading as flat plastic.

    function computeAO(f, dirs, radiusPx) {
        const { elev, W, H, metresPerPx } = f;
        const ao = new Float32Array(W * H).fill(1);
        const K = dirs || 8;
        const steps = 6;
        const dxs = new Float32Array(K), dys = new Float32Array(K);
        for (let k = 0; k < K; k++) {
            const a = (k / K) * Math.PI * 2;
            dxs[k] = Math.cos(a); dys[k] = Math.sin(a);
        }

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                const h0 = elev[i];
                let sum = 0;
                for (let k = 0; k < K; k++) {
                    let maxTan = 0;
                    for (let s = 1; s <= steps; s++) {
                        const d = (s / steps) * radiusPx;
                        const ix = (x + dxs[k] * d) | 0;
                        const iy = (y + dys[k] * d) | 0;
                        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
                        const dh = elev[iy * W + ix] - h0;
                        if (dh <= 0) continue;
                        const t = dh / (d * metresPerPx);
                        if (t > maxTan) maxTan = t;
                    }
                    sum += maxTan / Math.sqrt(1 + maxTan * maxTan);  // sin(atan(t))
                }
                ao[i] = 1 - (sum / K);
            }
        }
        return ao;
    }

    // ── Material classification ──────────────────────────────────────────────
    // e      — elevation relative to sea level, normalised so 0 = shore, 1 ≈ peak
    // slopeT — tan of the surface slope
    // Returns an index into MATERIALS[type].
    //
    // The governing idea across every world type: SLOPE decides material more
    // than elevation does. Snow and sand sit on shallow ground and shed off
    // steep faces, exposing rock. That single rule is most of what makes the
    // reference images read as photographed rather than tinted.

    function classify(type, list, e, slopeT, latAbs, n1, n2, aboveSeaM, snowLineM, n3) {
        const steep = slopeT;

        if (type === 'ice') {
            if (e < 0) {
                const d = -e;
                if (latAbs > 55 || d > 0.35) return idxOf(list, 'sea_ice');
                if (d > 0.12 + n1 * 0.08)    return idxOf(list, 'frozen_sea');
                return idxOf(list, 'open_water');
            }
            // Snow holds below ~17°, sheds entirely by ~37°. n1 perturbs the
            // threshold only slightly — a large perturbation scatters exposed
            // rock as confetti instead of letting it form contiguous faces.
            const hold = 1 - smoothstep(0.30, 0.75, steep);
            if (hold > 0.55 + n1 * 0.06) {
                // Crevasses open where ice is moving under tension — not on
                // level sheet, not on walls too steep to hold ice at all.
                if (n2 > 0.62 && steep > 0.12 && steep < 0.40) return idxOf(list, 'crevasse');
                return idxOf(list, 'ice_sheet');
            }
            if (hold > 0.22 + n1 * 0.06) {
                return e < 0.22 ? idxOf(list, 'tundra') : idxOf(list, 'scree');
            }
            return steep > 0.95 ? idxOf(list, 'mountain') : idxOf(list, 'rock');
        }

        if (type === 'standard') {
            if (e < 0) {
                const d = -e;
                if (d > 0.55) return idxOf(list, 'abyssal');
                if (d > 0.28) return idxOf(list, 'deep');
                if (d > 0.09) return idxOf(list, 'shelf');
                return idxOf(list, 'shallow');
            }
            // Snow line is an ABSOLUTE altitude driven by temperature and
            // latitude, never a fraction of the window's own relief. Expressed
            // as a fraction, any high ground anywhere gets a snow cap — which
            // put permanent snowfields across a third of an equatorial map.
            if (aboveSeaM > snowLineM * (1 + n1 * 0.12) && steep < 0.95)
                return idxOf(list, 'snow');
            if (steep > 1.05) return idxOf(list, 'mountain');
            if (e < 0.03 + n1 * 0.02) return idxOf(list, 'beach');
            if (e < 0.22) return idxOf(list, 'lowland');
            if (e < 0.45) return idxOf(list, 'upland');
            if (e < 0.70) return idxOf(list, 'highland');
            return idxOf(list, 'mountain');
        }

        if (type === 'desert') {
            if (steep > 1.00) return idxOf(list, 'mountain');
            if (steep > 0.55) return idxOf(list, 'mesa');
            if (e < 0.02 + n1 * 0.03) return idxOf(list, 'saltpan');
            // Dune seas are broad regions of deposited sand, so they key off the
            // wide low-frequency field n3. Keying them off n2 — the ridged
            // crevasse line field — scattered them as pale squiggles.
            if (steep < 0.12 && n3 > 0.54) return idxOf(list, 'dune');
            if (e < 0.35) return idxOf(list, 'sandflat');
            return idxOf(list, 'rockdesert');
        }

        if (type === 'cold_desert') {
            // Same governing rule as every other type: slope decides material.
            // Frost and ice-cemented ground hold on shallow terrain and shed off
            // steep faces, exposing rock broken by freeze-thaw.
            if (steep > 1.00) return idxOf(list, 'mountain');
            if (steep > 0.62) return idxOf(list, 'scree');
            if (steep > 0.34) return idxOf(list, 'shattered');
            if (e < 0.02 + n1 * 0.03) return idxOf(list, 'frostpan');
            // Permafrost flats are broad deposited regions, so they key off the
            // wide low-frequency field n3 — same reasoning as the dune sea.
            if (steep < 0.12 && n3 > 0.54) return idxOf(list, 'permafrost');
            if (e < 0.35) return idxOf(list, 'icecement');
            return idxOf(list, 'pavement');
        }

        if (type === 'rock') {
            if (steep > 1.05) return idxOf(list, 'mountain');
            if (e < 0.05) return idxOf(list, 'regolith');
            if (e < 0.30) return idxOf(list, 'lowland');
            if (e < 0.58) return idxOf(list, 'upland');
            return idxOf(list, 'highland');
        }

        if (type === 'molten') {
            if (e < 0.02) return idxOf(list, 'lava');
            if (e < 0.22) return idxOf(list, 'hotcrust');
            if (e < 0.60) return idxOf(list, 'crust');
            return idxOf(list, 'darkcrust');
        }

        if (type === 'exotic_dry') {
            if (steep > 1.05) return idxOf(list, 'mountain');
            if (e < 0.25) return idxOf(list, 'lowland');
            if (e < 0.60) return idxOf(list, 'upland');
            return idxOf(list, 'highland');
        }

        // exotic_wet
        if (e < 0) return (-e > 0.25) ? idxOf(list, 'deep') : idxOf(list, 'shallow');
        if (steep > 1.05) return idxOf(list, 'mountain');
        if (e < 0.04) return idxOf(list, 'shore');
        if (e < 0.40) return idxOf(list, 'lowland');
        return idxOf(list, 'highland');
    }

    function smoothstep(a, b, x) {
        if (x <= a) return 0;
        if (x >= b) return 1;
        const t = (x - a) / (b - a);
        return t * t * (3 - 2 * t);
    }

    // ── Main shade pass ──────────────────────────────────────────────────────
    //
    // opts: { worldData, seaLevelM, lightAzDeg, lightAltDeg,
    //         shadowSteps, aoRadius, microTexture, haze, onProgress }
    function shade(f, ctx, opts) {
        const { elev, W, H, latGrid } = f;
        const type = opts.worldType || worldTypeOf(opts.worldData || {});
        const atmCode = parseStat((opts.worldData || {}).atmosphere);
        const oceanRng = ctx ? ctx.oceanRng : 0;
        const list = materialsFor(type, atmCode, oceanRng);
        const typeRamp = rampFor(type, atmCode, oceanRng, opts.worldData || {});
        const seaLevelM = opts.seaLevelM;

        // ── The water surface ──────────────────────────────────────────────────────
        //
        // WATER IS SHADED AS WATER, NOT AS ITS BED. Lakes were given this
        // treatment when the lake model was built; the sea was left behind, and
        // that only made the sea's version of the same fault easier to see.
        // Normals, slope and micro-texture all describe the ground UNDER the
        // water rather than the shape of it, so an ocean drew its drowned hills
        // as though they were dry land and the sheet read as embossed.
        //
        // `water` marks every pixel classify() will paint as water. It applies
        // the SAME test the albedo pass does — below the per-pixel datum, which
        // is a lake's own surface where there is one and the planetary sea
        // level everywhere else — so the mask and the palette cannot disagree
        // about where the shoreline is. Only the three world types that HAVE a
        // water branch are considered: a desert, cold desert or rock world can
        // carry pixels below its datum with none of them wet, and flat-shading
        // those would drain the relief out of dry ground.
        //
        // `surfF` is the same field with every water cell raised to its own
        // surface, and it is what casts shadows and occludes the sky. That
        // keeps the two facts that belong to the water — a cliff shades the
        // water beside it, and basin walls close the sky over it — while
        // dropping the one that belongs to the bed: a submerged ridge
        // shadowing open ocean from below, which is the bed showing through by
        // another route.
        //
        // THE SEA FILL CANNOT TOUCH LAND, and that is a proof rather than an
        // estimate: land is by definition at or above the planetary datum, so a
        // seabed raised TO that datum never stands above a land pixel, the AO
        // horizon test ignores anything lower than the pixel it samples for,
        // and the shadow ray only ever climbs away from its origin. Measured
        // across ten windows and 1.04 M land pixels: zero moved.
        //
        // A LAKE FILL IS DIFFERENT, because a lake's surface can perch above
        // ground just outside its rim. The rim itself always dominates — it
        // stands at exactly the lake's level and is nearer — but neither
        // sampler visits every cell, so a one-cell rim can be stepped over and
        // the water plane behind it seen instead. Measured: 1.4-9.7% of land
        // pixels move, every one of them within 8 cells of a lake shore, which
        // is the AO radius. That is a correction and not a regression: the
        // water plane is genuinely there, and the old code was occluding from
        // the lake BED, which is not.
        const hasWaterBranch = (type === 'ice' || type === 'standard' ||
                                type === 'exotic_wet');
        const lakeLv = f.lakeLevel || null;
        let water = null, surfF = f;
        if (hasWaterBranch) {
            const mask = new Uint8Array(W * H);
            const surf = elev.slice();
            let wet = 0;
            for (let i = 0; i < W * H; i++) {
                const lv = (lakeLv && lakeLv[i] > 0) ? lakeLv[i] : seaLevelM;
                if (elev[i] < lv) { mask[i] = 1; surf[i] = lv; wet++; }
            }
            if (wet > 0) { water = mask; surfF = Object.assign({}, f, { elev: surf }); }
        }

        const nrm = computeNormals(f);
        if (opts.onProgress) opts.onProgress(0.90);
        const shadow = opts.shadowSteps > 0
            ? castShadows(surfF, opts.lightAzDeg, opts.lightAltDeg, opts.shadowSteps)
            : null;
        if (opts.onProgress) opts.onProgress(0.94);
        const ao = opts.aoRadius > 0
            ? computeAO(surfF, 8, opts.aoRadius)
            : null;
        if (opts.onProgress) opts.onProgress(0.97);

        // Light vector, image space: +x east, +y south, +z up.
        const az  = opts.lightAzDeg * Math.PI / 180;
        const alt = opts.lightAltDeg * Math.PI / 180;
        const Lx = Math.sin(az) * Math.cos(alt);
        const Ly = -Math.cos(az) * Math.cos(alt);
        const Lz = Math.sin(alt);

        const img  = new ImageData(W, H);
        const data = img.data;
        const counts = new Uint32Array(list.length);

        const microSeed = ctx.seeds.smooth ^ 0x5f3a;
        const micro = opts.microTexture !== undefined ? opts.microTexture : 0.10;
        const hazeAmt = opts.haze !== undefined ? opts.haze : 0.0;
        const hazeCol = opts.hazeColor || [190, 205, 220];

        // Elevation reference: how many metres above sea level count as "peak"
        // for the hypsometric bands. Scaling by the window's own local relief
        // means a lowland window stays lowland-coloured instead of tinting its
        // highest bump as a mountain range.
        const reliefRefM = Math.max(300, f.localReliefM || 4500);

        // Albedo is built into its own buffer first, softened, and only then
        // lit. Writing classified band colours straight to pixels makes the map
        // read as a painted contour chart: hard-edged flat regions of colour
        // sitting on top of otherwise good relief. A short blur on albedo ALONE
        // dissolves those edges while leaving the shading perfectly crisp.
        const alb = new Float32Array(W * H * 3);
        const eRange = Math.max(1, (f.elevMaxM - f.elevMinM));
        const polar = polarOverlay(type, opts.worldData || {});
        let polarCount = 0;

        // Equatorial snow line from mean surface temperature. 288 K (Earth-like)
        // gives ~5900 m; at or below ~255 K the whole surface stays frozen.
        const tempK   = (opts.worldData && opts.worldData.temperatureK) || 288;
        const snowEqM = Math.max(0, Math.min(9000, (tempK - 255) * 180));

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                // Per-pixel latitude: under the azimuthal projection an image
                // row is not a line of constant latitude, and a window near a
                // pole can span most of a hemisphere within one row.
                const lat    = latGrid[i];
                const latAbs = Math.abs(lat * 180 / Math.PI);
                // Snow line falls toward the poles, but never to zero, so polar
                // lowlands stay bare ground rather than an unbroken icecap.
                const snowLineM = snowEqM *
                    (0.15 + 0.85 * Math.pow(Math.max(0, Math.cos(lat)), 1.5));
                // WATER HAS A LOCAL DATUM. A lake stands at its own surface
                // level, which the hydrology pass works out from the basin's
                // spill point and its water budget, and that level can be
                // thousands of metres above the planetary one. Measuring depth
                // from the global datum would make a highland lake read as
                // land. Where there is no lake this is exactly the old value,
                // so coasts and seas are untouched.
                const lakeM = f.lakeLevel ? f.lakeLevel[i] : 0;
                const aboveSeaM = elev[i] - (lakeM > 0 ? lakeM : seaLevelM);

                // Hypsometric band position is measured from the LOCAL base
                // level, not from sea level. Once the coastal taper made detail
                // additive inland, absolute height above sea rose by roughly
                // half the local relief everywhere, so an absolute measure
                // saturated at the top band and 71% of a varied landscape came
                // out classified "Mountain Ranges".
                //
                // Below sea level `e` stays absolute, so it still reads as
                // depth; the two definitions meet continuously at the shore
                // because both are ~0 there. Snow line and water remain
                // absolute, which is physically right — those ARE altitude facts.
                //
                // THE LAND BRANCH IS CLAMPED AT ZERO, and that clamp is load
                // bearing. classify() decides land against water on `e < 0`, so
                // any land whose `e` went negative was painted as Shallow Water
                // — and erosion and river incision cut valley floors and basins
                // below their own base level as a matter of course. Measured
                // before the clamp: 6.8% of all LAND pixels in a temperate
                // window rendered as water, roughly twice the area of the real
                // water in the same frame, and 10.1% of every river vertex drawn
                // across the map lay on one of those false lakes. That is what
                // produced rivers apparently running through the middle of a
                // lake — the river was correctly in its valley and the valley
                // was being coloured blue around it. Land and water are told
                // apart by aboveSeaM, which is an absolute fact about the
                // world; `e` only ever chooses a band within one of them.
                const baseElevM = (f.planetReliefM || 12000) * (f.baseH ? f.baseH[i] : 0);
                const e = aboveSeaM < 0
                    ? aboveSeaM / reliefRefM
                    : Math.max(0, (elev[i] - baseElevM) / reliefRefM);
                const slopeT = nrm.slope[i];

                // n1 — mid-frequency perturbation so material boundaries are
                // ragged rather than clean contour lines.
                const n1 = vnoise3(x * 0.022, y * 0.022, 11.3, microSeed);

                // n2 — crevasse field. A single ridged octave thresholded near
                // its maximum traces the noise field's contours, which are
                // CLOSED LOOPS: the result is a uniform maze over the whole
                // map, unrelated to the terrain. Squaring one octave sharpens
                // the lines and multiplying by a second, higher-frequency
                // octave breaks them into discontinuous segments, which is what
                // fractures actually look like.
                const cvA = 1 - Math.abs(2 * vnoise3(x * 0.040, y * 0.040, 71.9, microSeed ^ 0x2b1d) - 1);
                const cvB = 1 - Math.abs(2 * vnoise3(x * 0.115, y * 0.115, 13.3, microSeed ^ 0x77a1) - 1);
                const n2 = cvA * cvA * cvB;

                // n3 — broad low-frequency field for region-scale surfaces
                // (dune seas, sand sheets) that cover wide areas rather
                // than tracing lines.
                const n3 = vnoise3(x * 0.007, y * 0.007, 29.4, microSeed ^ 0x51e9);

                const mi = classify(type, list, e, slopeT, latAbs, n1, n2, aboveSeaM, snowLineM, n3);

                // Continuous ramp for the generic-ground bands; discrete albedo
                // for surfaces that really are a different material.
                const rset = RAMP_IDS[type];
                let base = (rset && typeRamp && rset.has(list[mi].id))
                    ? colorFromStops(e < 0 ? 0 : (e > 1 ? 1 : e), typeRamp)
                    : list[mi].c;

                // Latitude cap, blended over the underlying surface.
                const pb = polarBlend(polar, latAbs);
                if (pb > 0) {
                    base = [base[0] + (POLAR_COLOR[0] - base[0]) * pb,
                            base[1] + (POLAR_COLOR[1] - base[1]) * pb,
                            base[2] + (POLAR_COLOR[2] - base[2]) * pb];
                }
                // Pixels the cap dominates are counted as ice, not as whatever
                // lies beneath, so the terrain key still sums to 100%.
                if (pb > 0.5) polarCount++; else counts[mi]++;

                // Continuous elevation modulation within the band. Without it
                // every pixel of one material carries the identical albedo, and
                // wide bands render as dead flat plates of colour.
                const em = 0.93 + 0.14 * ((elev[i] - f.elevMinM) / eRange);

                const o3 = i * 3;
                alb[o3]     = base[0] * em;
                alb[o3 + 1] = base[1] * em;
                alb[o3 + 2] = base[2] * em;
            }
        }

        // Separable-ish box blur on albedo only (radius 2). Cheap, and it is
        // the difference between "contour map" and "photograph".
        const albS = new Float32Array(W * H * 3);
        const BR = 2;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                let r = 0, g = 0, b = 0, n = 0;
                const y0 = Math.max(0, y - BR), y1 = Math.min(H - 1, y + BR);
                const x0 = Math.max(0, x - BR), x1 = Math.min(W - 1, x + BR);
                for (let yy = y0; yy <= y1; yy++) {
                    for (let xx = x0; xx <= x1; xx++) {
                        const q = (yy * W + xx) * 3;
                        r += alb[q]; g += alb[q + 1]; b += alb[q + 2]; n++;
                    }
                }
                const o3 = (y * W + x) * 3;
                albS[o3] = r / n; albS[o3 + 1] = g / n; albS[o3 + 2] = b / n;
            }
        }

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = y * W + x;
                // A WATER SURFACE IS FLAT, and is lit as one — sea and lake
                // alike. The normals, the slope and the micro-texture all
                // describe the BED, so shading water with them draws the
                // drowned hills as though they were dry. Cast shadows and
                // ambient occlusion are deliberately KEPT, and are taken from
                // `surfF` above so they describe the water's own surroundings
                // rather than its floor: a cliff does shade the water beside
                // it, and basin walls do close the sky over it.
                //
                // Depth still shows, because depth is real — through the
                // hypsometric bands (shallow / shelf / deep / abyssal) and the
                // `em` albedo modulation below, both of which tint rather than
                // light. What is gone is the DIRECTIONAL cue, which was the
                // part claiming the sea had a topography of its own.
                const flat = water ? water[i] === 1 : false;
                const slopeT = flat ? 0 : nrm.slope[i];
                const e = (elev[i] - seaLevelM) / reliefRefM;
                const o3 = i * 3;

                // Lambert with a wrap term — pure Lambert makes shadowed slopes
                // read as dead flat black, which relief maps never do.
                const ndl = flat ? Lz
                          : (nrm.nx[i] * Lx + nrm.ny[i] * Ly + nrm.nz[i] * Lz);
                let lam = (ndl + 0.30) / 1.30;
                if (lam < 0) lam = 0;

                let lit = 0.30 + 0.82 * lam;              // ambient floor + diffuse
                if (shadow) lit *= (0.34 + 0.66 * shadow[i]);
                if (ao)     lit *= (0.42 + 0.58 * ao[i]);

                // Sky-light tint: upward faces pick up a little cold sky, which
                // is what gives snow its blue cast in the reference images.
                const sky = (flat ? 1 : Math.max(0, nrm.nz[i])) * 0.10;

                // Micro-texture: two scales, and scaled DOWN on shallow ground.
                // Applied flat at pixel frequency it reads as paper grain over
                // the whole map; real surfaces are only visibly textured where
                // they are broken, i.e. on slopes.
                const grain = (vnoise3(x * 0.30, y * 0.30, 3.1, microSeed) - 0.5) * 0.65
                            + (vnoise3(x * 0.09, y * 0.09, 8.7, microSeed) - 0.5) * 0.35;
                const mt = flat ? 1
                    : 1 + grain * micro * 2 * (0.35 + 0.65 * Math.min(1, slopeT * 2));

                let r = albS[o3]     * lit * mt + 22 * sky;
                let g = albS[o3 + 1] * lit * mt + 30 * sky;
                let b = albS[o3 + 2] * lit * mt + 42 * sky;

                if (hazeAmt > 0) {
                    const hz = hazeAmt * (1 - Math.min(1, Math.max(0, e)));
                    r = r * (1 - hz) + hazeCol[0] * hz;
                    g = g * (1 - hz) + hazeCol[1] * hz;
                    b = b * (1 - hz) + hazeCol[2] * hz;
                }

                const o = i * 4;
                data[o]     = r > 255 ? 255 : (r < 0 ? 0 : r);
                data[o + 1] = g > 255 ? 255 : (g < 0 ? 0 : g);
                data[o + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
                data[o + 3] = 255;
            }
        }

        // Legend = materials that actually appear, biggest first. This is the
        // terrain key, derived rather than authored.
        const legend = [];
        const totalPx = W * H;
        if (polarCount / totalPx >= 0.002) {
            legend.push({ id: 'polar', label: 'Polar Ice Cap', c: POLAR_COLOR,
                          share: polarCount / totalPx });
        }
        for (let i = 0; i < list.length; i++) {
            if (counts[i] / totalPx < 0.002) continue;   // drop trace amounts
            legend.push({ id: list[i].id, label: list[i].label, c: list[i].c,
                          share: counts[i] / totalPx });
        }
        legend.sort((a, b) => b.share - a.share);

        return { image: img, legend, worldType: type };
    }

    // ── Greyscale elevation debug view ───────────────────────────────────────

    function heightToGrey(f) {
        const { elev, W, H } = f;
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < elev.length; i++) {
            if (elev[i] < lo) lo = elev[i];
            if (elev[i] > hi) hi = elev[i];
        }
        const span = (hi - lo) || 1;
        const img = new ImageData(W, H);
        for (let i = 0; i < elev.length; i++) {
            const v = ((elev[i] - lo) / span) * 255 | 0;
            const o = i * 4;
            img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
            img.data[o + 3] = 255;
        }
        return { image: img, min: lo, max: hi };
    }

    // Colour for a whole-world preview at normalised height h. Exists so the
    // locator inset uses the SAME palette as the map it is locating — a hard-
    // coded blue/tan preview showed an ice world as a temperate one.
    // Which material ids are surfaces you could float on. Needed because the
    // tables have different SHAPES per world type: `standard` opens with four
    // water entries, `exotic_wet` with two, `rock` with none. Slicing by index
    // therefore picked lowland plains as the shallow-water colour on exotic
    // worlds. Look materials up by id, never by position.
    const WATER_IDS = new Set(['abyssal', 'deep', 'shelf', 'shallow',
        'open_water', 'frozen_sea', 'sea_ice', 'lava', 'hotcrust']);

    function previewColor(type, h, seaLevel, atm, oceanRng, polar, latAbsDeg) {
        const list = materialsFor(type, atm, oceanRng);
        const ramp = rampFor(type, atm, oceanRng);
        if (h < seaLevel) {
            const water = list.filter(m => WATER_IDS.has(m.id));
            if (water.length) {
                const d = seaLevel > 0 ? 1 - (h / seaLevel) : 1;   // 0 shore .. 1 deep
                const shallow = water[water.length - 1].c;
                const deep = water[0].c;
                return _applyPolar([shallow[0] + (deep[0] - shallow[0]) * d,
                                    shallow[1] + (deep[1] - shallow[1]) * d,
                                    shallow[2] + (deep[2] - shallow[2]) * d],
                                   polar, latAbsDeg);
            }
        }
        const e = Math.max(0, Math.min(1, (h - seaLevel) / Math.max(0.05, 1 - seaLevel)));
        let c;
        if (ramp) c = colorFromStops(e, ramp);
        else {
            const land = list.filter(m => !WATER_IDS.has(m.id));
            const pool = land.length ? land : list;
            c = pool[Math.min(pool.length - 1, Math.floor(e * pool.length))].c;
        }
        return _applyPolar(c, polar, latAbsDeg);
    }

    // The world's own water tones, for anything that needs to draw water and
    // must match the sea it flows into — rivers above all. Exotic worlds carry
    // seeded amber, violet, chartreuse and black oceans, so a hardcoded blue
    // river would clash with its own coastline.
    //
    // Preference order picks the SHALLOW tone: a river is shallow water, not
    // abyss, and the shallow tone is also what the coast reads as, so the two
    // meet without a seam.
    function waterColors(type, atm, oceanRng) {
        const list = materialsFor(type, atm, oceanRng);
        const by = id => { const m = list.find(x => x.id === id); return m ? m.c : null; };
        const shallow = by('shallow') || by('shelf') || by('open_water')
                     || by('frozen_sea') || by('sea_ice') || by('deep')
                     || by('lava') || [92, 128, 158];
        const deep = by('deep') || by('abyssal') || by('shelf')
                  || by('frozen_sea') || shallow;
        return { shallow, deep };
    }

    function _applyPolar(c, polar, latAbsDeg) {
        const pb = polarBlend(polar, latAbsDeg || 0);
        if (pb <= 0) return c;
        return [c[0] + (POLAR_COLOR[0] - c[0]) * pb,
                c[1] + (POLAR_COLOR[1] - c[1]) * pb,
                c[2] + (POLAR_COLOR[2] - c[2]) * pb];
    }

    return { shade, worldTypeOf, heightToGrey, previewColor, materialsFor, rampFor,
             isColdDry, isVegetated,
             waterColors,
             polarOverlay, polarBlend, tempBand,
             exoticVariant, computeNormals, castShadows,
             computeAO, MATERIALS, parseStat };
})();

window.TerrainRender = TerrainRender;
