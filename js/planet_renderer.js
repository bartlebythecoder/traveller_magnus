'use strict';

// =============================================================================
// PLANET_RENDERER.JS — Procedural hemisphere images for worlds
// Orthographic sphere projection with 3D fBm height map, per-world seeded RNG.
// Uses world-space (x,y,z) coordinates on the unit sphere for all noise, which
// guarantees seamless tiling across both hemisphere views with no seam artefacts.
//
// Entry point: PlanetRenderer.renderPlanetHemispheres(canvas, worldData, hexId)
// Test:        PlanetRenderer.test()  — opens a modal with a hardcoded world
// =============================================================================

const PlanetRenderer = (() => {

    // 3-D noise grid side length. 32³ = 32 768 floats ≈ 128 KB per grid.
    const GRID3 = 32;

    // Base frequency for the coarsest fBm octave.  4 means ≈4 continent-scale
    // features span the full unit sphere in each axis.
    const CONTINENT_FREQ = 4;

    // cos(3°) — angular radius of a city-light cluster on the unit sphere.
    const CITY_THRESH = 0.9986;

    // Fraction of canvas height for each polar lobe zone.
    // The equatorial band fills the remaining (1 − 2·POLE_FRAC) of the height.
    const POLE_FRAC = 1 / 3;

    // Domain-warp + continent-mask parameters (used by _continentHeight).
    const WARP_FREQ = 1.8;  // input frequency for domain warp sampling

    // These two are set at render time from window globals so the settings sliders
    // take effect without rebuilding the noise grids.
    let _maskWeight   = 0.55;  // Continental Definition (0 = pure noise, 1 = pure seeds)
    let _warpStrength = 0.45;  // Coastline Complexity (0 = smooth, 1 = highly irregular)

    // ── 3-D value noise ───────────────────────────────────────────────────────

    function _buildGrid3D(rng) {
        const g = new Float32Array(GRID3 * GRID3 * GRID3);
        for (let i = 0; i < g.length; i++) g[i] = rng();
        return g;
    }

    // Trilinear sample with smoothstep interpolation; all axes wrap.
    function _sample3D(g, x, y, z) {
        x = ((x % GRID3) + GRID3) % GRID3;
        y = ((y % GRID3) + GRID3) % GRID3;
        z = ((z % GRID3) + GRID3) % GRID3;
        const ix = x | 0, iy = y | 0, iz = z | 0;
        const fx = x - ix, fy = y - iy, fz = z - iz;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const sz = fz * fz * (3 - 2 * fz);
        const x1 = (ix + 1) % GRID3, y1 = (iy + 1) % GRID3, z1 = (iz + 1) % GRID3;
        const GG = GRID3 * GRID3, G = GRID3;
        const v000 = g[iz * GG + iy * G + ix];
        const v100 = g[iz * GG + iy * G + x1];
        const v010 = g[iz * GG + y1 * G + ix];
        const v110 = g[iz * GG + y1 * G + x1];
        const v001 = g[z1 * GG + iy * G + ix];
        const v101 = g[z1 * GG + iy * G + x1];
        const v011 = g[z1 * GG + y1 * G + ix];
        const v111 = g[z1 * GG + y1 * G + x1];
        const c00 = v000 + (v100 - v000) * sx;
        const c10 = v010 + (v110 - v010) * sx;
        const c01 = v001 + (v101 - v001) * sx;
        const c11 = v011 + (v111 - v011) * sx;
        const c0  = c00  + (c10  - c00)  * sy;
        const c1  = c01  + (c11  - c01)  * sy;
        return c0 + (c1 - c0) * sz;
    }

    // fBm over 3-D world-space sphere coordinates.
    // wx, wy, wz are the unit-sphere surface point in world space (range [-1, 1]).
    function _fbm3D(g, wx, wy, wz, octaves, persistence) {
        let val = 0, amp = 1, freq = CONTINENT_FREQ, total = 0;
        for (let o = 0; o < octaves; o++) {
            val   += amp * _sample3D(g, wx * freq, wy * freq, wz * freq);
            total += amp;
            amp   *= persistence;
            freq  *= 2;
        }
        return val / total;
    }

    // ── City cluster centres ──────────────────────────────────────────────────

    // Returns an array of unit-sphere points for city-light clusters, or null
    // when population is too low.  count scales exponentially with pop code so
    // that each digit roughly 2.2× the previous tier's cluster density.
    function _buildCityCenters(pop, rng) {
        if (pop < 5) return null;
        const count = Math.min(250, Math.round(8 * Math.pow(2.2, pop - 5)));
        const centres = new Array(count);
        for (let i = 0; i < count; i++) {
            const cosTheta = rng() * 2 - 1;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const phi      = rng() * 2 * Math.PI;
            centres[i] = [sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi)];
        }
        return centres;
    }

    // ── Crater field ─────────────────────────────────────────────────────────

    // Generates a seeded list of craters for airless worlds.  Each crater stores
    // its unit-sphere centre, rim dot-product threshold (cosR), outer ejecta
    // threshold (cosOuter), and a depth scalar [0,1] that scales all modifiers.
    function _buildCraters(rng) {
        const craters = [];
        const add = (minDeg, maxDeg, dMin, dMax) => {
            const angleDeg = minDeg + rng() * (maxDeg - minDeg);
            const depth    = dMin   + rng() * (dMax - dMin);
            const cosTheta = rng() * 2 - 1;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const phi      = rng() * 2 * Math.PI;
            const cosR     = Math.cos(angleDeg * Math.PI / 180);
            craters.push({
                wx: sinTheta * Math.cos(phi), wy: cosTheta, wz: sinTheta * Math.sin(phi),
                cosR,
                cosOuter: cosR - (1 - cosR) * 0.35,  // ejecta blanket outer edge
                depth,
            });
        };
        const nL = 5  + Math.floor(rng() * 6);   // 5-10  large  (10-20°)
        const nM = 15 + Math.floor(rng() * 16);  // 15-30 medium  (4-10°)
        const nS = 40 + Math.floor(rng() * 31);  // 40-70 small   (1.5-4°)
        for (let i = 0; i < nL; i++) add(10, 20, 0.75, 1.00);
        for (let i = 0; i < nM; i++) add( 4, 10, 0.55, 0.90);
        for (let i = 0; i < nS; i++) add(1.5, 4, 0.40, 0.75);
        return craters;
    }

    // ── Continental seeds ─────────────────────────────────────────────────────

    // Generates a seeded list of continent-centre descriptors on the unit sphere.
    // Each seed carries a world-space centre, angular cosR threshold, and strength.
    // Count is seeded-random 3–7 so each world has a distinct number of continents.
    function _buildContinentSeeds(rng) {
        const count = 3 + Math.floor(rng() * 5);
        const seeds = new Array(count);
        for (let i = 0; i < count; i++) {
            const cosTheta = rng() * 2 - 1;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const phi      = rng() * 2 * Math.PI;
            const angRad   = (35 + rng() * 35) * Math.PI / 180;  // 35–70° angular radius
            seeds[i] = {
                sx: sinTheta * Math.cos(phi),
                sy: cosTheta,
                sz: sinTheta * Math.sin(phi),
                cosR:     Math.cos(angRad),
                strength: 0.7 + rng() * 0.3,
            };
        }
        return seeds;
    }

    // Returns a composite height for world-space point (wx, wy, wz) blending:
    //   - a continent mask: max smoothstepped falloff from the nearest seed centre
    //   - a domain-warped detail fBm: reuses heightGrid, so no extra memory
    // Result is not percentile-remapped; that is done downstream by the CDF pipeline.
    function _continentHeight(heightGrid, seeds, wx, wy, wz) {
        // Continent mask — strongest seed contribution at this point.
        let mask = 0;
        for (let i = 0; i < seeds.length; i++) {
            const s   = seeds[i];
            const dot = wx * s.sx + wy * s.sy + wz * s.sz;
            if (dot > s.cosR) {
                const t  = (dot - s.cosR) / (1 - s.cosR);
                const sm = t * t * (3 - 2 * t);  // smoothstep
                const v  = sm * s.strength;
                if (v > mask) mask = v;
            }
        }

        // Domain warp — three independent low-frequency fBm samples used as
        // coordinate offsets.  Large constant biases decorrelate the three
        // channels from each other and from the detail fBm below.
        const f  = WARP_FREQ;
        const dx = _fbm3D(heightGrid, wx * f + 1.7, wy * f + 9.2, wz * f + 3.4, 3, 0.50) - 0.5;
        const dy = _fbm3D(heightGrid, wx * f + 8.3, wy * f + 2.8, wz * f + 5.1, 3, 0.50) - 0.5;
        const dz = _fbm3D(heightGrid, wx * f + 4.6, wy * f + 7.1, wz * f + 0.9, 3, 0.50) - 0.5;
        const detail = _fbm3D(heightGrid,
            wx + dx * _warpStrength,
            wy + dy * _warpStrength,
            wz + dz * _warpStrength,
            6, 0.43);

        return mask * _maskWeight + detail * (1 - _maskWeight);
    }

    // ── Empirical CDF helpers ─────────────────────────────────────────────────

    // Samples the height grid at nSamples uniformly distributed sphere points
    // (Fibonacci lattice) and returns the sorted height values as a Float32Array.
    // Used to remap raw fBm output to true percentile rank so that seaLevel
    // corresponds to the actual fraction of the surface covered by ocean.
    function _buildCDF(heightGrid, seeds, nSamples) {
        const samples     = new Float32Array(nSamples);
        const goldenAngle = Math.PI * (Math.sqrt(5) - 1);
        for (let i = 0; i < nSamples; i++) {
            const cosTheta = 1 - (2 * (i + 0.5)) / nSamples;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const phi = goldenAngle * i;
            samples[i] = _continentHeight(heightGrid, seeds,
                sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi));
        }
        samples.sort();
        return samples;
    }

    // Binary-search the sorted CDF array and return h's percentile rank in [0,1].
    function _remapHeight(h, cdf) {
        let lo = 0, hi = cdf.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cdf[mid] < h) lo = mid + 1; else hi = mid;
        }
        return lo / cdf.length;
    }

    // ── Color helpers ─────────────────────────────────────────────────────────

    function _lerp(a, b, t) { return a + (b - a) * t; }

    function _lerpRGB(c1, c2, t) {
        return [(_lerp(c1[0], c2[0], t)) | 0,
                (_lerp(c1[1], c2[1], t)) | 0,
                (_lerp(c1[2], c2[2], t)) | 0];
    }

    function _colorFromStops(h, stops) {
        if (h <= stops[0].t) return stops[0].c;
        for (let i = 1; i < stops.length; i++) {
            if (h <= stops[i].t) {
                const range = stops[i].t - stops[i - 1].t;
                const blend = range > 0 ? (h - stops[i - 1].t) / range : 0;
                return _lerpRGB(stops[i - 1].c, stops[i].c, blend);
            }
        }
        return stops[stops.length - 1].c;
    }

    function _heightToRGB(h, lat, palette) {
        const { stops, polarColor, polarAngle, polarFade } = palette;
        const absLat = Math.abs(lat);
        const base   = _colorFromStops(h, stops);
        if (absLat > polarAngle - polarFade) {
            const blend = Math.min(1, Math.max(0,
                (absLat - (polarAngle - polarFade)) / polarFade));
            return _lerpRGB(base, polarColor, blend);
        }
        return base;
    }

    // ── Palette builder ───────────────────────────────────────────────────────

    function _parseStat(v) {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseInt(v, 16) || 0;
        return 0;
    }

    function _buildPalette(worldData, oceanRng) {
        const atm   = _parseStat(worldData.atmosphere);    // 0–15 (UWP hex digit)
        const hydro = _parseStat(worldData.hydrographics); // 0–10
        // Guard against zero to prevent degenerate stop thresholds.
        const seaLevel = Math.max(0.05, Math.min(1, hydro / 10));

        // Classify world type from atm + hydro (UWP primary rules).
        // Atmo A/B/C (10/11/12) = exotic/corrosive/insidious.
        // Hydro F (15) = RTT Intense Volcanism (molten surface) — overrides all else.
        const tempK    = worldData.temperatureK || 0;
        const isMolten   = (hydro === 15)                 // RTT Code F — lava world
                       || (hydro === 0 && tempK > 1000); // any engine — rock melts above 1000 K
        const isExotic   = (atm >= 10 && atm <= 12);
        const isRock     = !isMolten && (atm === 0 && hydro === 0);
        const isIce      = !isMolten && ((atm === 0 && hydro > 0)
            || (!isExotic && atm > 0 && hydro > 0        // water ocean frozen solid:
                && ((tempK > 0 && tempK < 223)           //   below -50°C by Kelvin
                    || (tempK === 0 && (worldData.temperature || '').toLowerCase().includes('frozen')))));
        const isExoticDry = !isMolten && (isExotic && hydro === 0);
        const isExoticWet = !isMolten && (isExotic && hydro > 0);
        const isDesert   = !isMolten && (!isRock && !isIce && !isExoticDry && !isExoticWet && hydro === 0);
        // else: standard blue water world (atm 1-9 or D-F, hydro > 0)

        // Polar cap threshold (radians from equator). Math.PI is unreachable from
        // the ±90° lat range, so setting it means "no polar overlay".
        const tempStr = (worldData.temperature || '').toLowerCase();
        let polarAngle;
        if (isMolten || isRock || isIce)     polarAngle = Math.PI;  // no polar overlay
        else if (tempStr.includes('frozen')) polarAngle = Math.PI * 40 / 180;
        else if (tempStr.includes('cold'))   polarAngle = Math.PI * 55 / 180;
        else if (tempStr.includes('cool'))   polarAngle = Math.PI * 68 / 180;
        else if (tempStr.includes('warm'))   polarAngle = Math.PI * 82 / 180;
        else if (tempStr.includes('hot'))    polarAngle = Math.PI * 88 / 180;
        else                                 polarAngle = Math.PI * 75 / 180;  // temperate

        const polarFade  = Math.PI * 8 / 180;
        const polarColor = [212, 218, 232];

        let stops;

        if (isMolten) {
            // Intense volcanism (RTT Code F) — lava pools in lowlands, dark crust at peaks.
            // Clouds remain active (atm > 0) to simulate volcanic haze.
            stops = [
                { t: 0.0, c: [252, 148,  18] },  // bright molten lava
                { t: 0.2, c: [220,  72,  10] },  // hot orange
                { t: 0.4, c: [162,  38,   8] },  // cooling red
                { t: 0.6, c: [ 88,  18,   6] },  // near-solidified
                { t: 0.8, c: [ 38,  10,   8] },  // dark crust
                { t: 1.0, c: [ 18,   6,   6] },  // near-black peaks
            ];
        } else if (isRock) {
            // Bare rock / vacuum world
            stops = [
                { t: 0.0, c: [ 22,  20,  26] },
                { t: 0.3, c: [ 72,  68,  65] },
                { t: 0.6, c: [102,  96,  92] },
                { t: 0.8, c: [130, 124, 118] },
                { t: 1.0, c: [152, 146, 138] },
            ];
        } else if (isIce) {
            // Frozen body: no atmosphere, surface entirely ice
            stops = [
                { t: 0.0, c: [125, 152, 198] },
                { t: 0.4, c: [165, 188, 222] },
                { t: 0.7, c: [196, 212, 232] },
                { t: 1.0, c: [232, 240, 252] },
            ];
        } else if (isExoticDry) {
            // Venus-like: exotic/corrosive atmo, no ocean — dark volcanic rock
            stops = [
                { t: 0.0, c: [ 48,  18,   8] },
                { t: 0.2, c: [ 82,  38,  14] },
                { t: 0.4, c: [112,  58,  20] },
                { t: 0.6, c: [138,  72,  28] },
                { t: 0.8, c: [108,  52,  18] },
                { t: 1.0, c: [ 78,  36,  14] },
            ];
        } else if (isExoticWet) {
            // Exotic non-water ocean — colour varies by atmosphere type, seeded per world.
            // Each variant carries both ocean and land stops so they are designed as a
            // contrasting pair: warm oceans get cool land, yellow/green oceans get
            // red/slate land, dark oceans get pale ochre land, etc.
            const ls = seaLevel;
            const atmVariants = atm === 10 ? [
                // A — green ocean / brownish land (original)
                { deep: [ 18,  68,  28], mid: [ 38, 105,  42], shallow: [ 60, 132,  52], shore: [ 82, 100,  48],
                  coastal: [ 72,  80,  40], lowland: [ 88,  70,  32], highland: [108,  76,  36], mountains: [128,  88,  44], peaks: [158, 118,  62] },
                // A — inky black ocean / pale dusty ochre land
                { deep: [  8,  10,  15], mid: [ 15,  18,  25], shallow: [ 25,  28,  38], shore: [ 40,  35,  32],
                  coastal: [ 95,  82,  48], lowland: [115,  98,  58], highland: [132, 112,  68], mountains: [148, 128,  82], peaks: [195, 182, 148] },
                // A — deep violet ocean / rust-terracotta land
                { deep: [ 20,   8,  55], mid: [ 38,  15,  88], shallow: [ 55,  28, 108], shore: [ 70,  40,  80],
                  coastal: [ 88,  42,  28], lowland: [108,  58,  36], highland: [125,  72,  44], mountains: [140,  88,  55], peaks: [185, 158, 128] },
                // A — royal purple ocean / dark rust-orange land
                { deep: [ 55,   8,  75], mid: [ 80,  18, 108], shallow: [100,  32, 128], shore: [ 85,  45,  85],
                  coastal: [105,  48,  22], lowland: [128,  62,  28], highland: [148,  78,  35], mountains: [162,  95,  45], peaks: [200, 168, 118] },
            ] : atm === 11 ? [
                // B — deep violet ocean / rust-terracotta land
                { deep: [ 20,   8,  55], mid: [ 38,  15,  88], shallow: [ 55,  28, 108], shore: [ 70,  40,  80],
                  coastal: [ 88,  42,  28], lowland: [108,  58,  36], highland: [125,  72,  44], mountains: [140,  88,  55], peaks: [185, 158, 128] },
                // B — royal purple ocean / dark rust-orange land
                { deep: [ 55,   8,  75], mid: [ 80,  18, 108], shallow: [100,  32, 128], shore: [ 85,  45,  85],
                  coastal: [105,  48,  22], lowland: [128,  62,  28], highland: [148,  78,  35], mountains: [162,  95,  45], peaks: [200, 168, 118] },
                // B — amber yellow ocean / dark slate blue-grey land
                { deep: [ 90,  70,  10], mid: [130, 100,  18], shallow: [158, 122,  28], shore: [140, 110,  55],
                  coastal: [ 42,  52,  65], lowland: [ 58,  68,  82], highland: [ 75,  85,  98], mountains: [ 95, 102, 115], peaks: [175, 182, 195] },
                // B — chartreuse ocean / brick red-terracotta land
                { deep: [ 55,  95,   8], mid: [ 85, 135,  15], shallow: [108, 158,  25], shore: [ 95, 130,  45],
                  coastal: [ 95,  38,  28], lowland: [118,  52,  35], highland: [138,  65,  42], mountains: [155,  82,  52], peaks: [195, 162, 135] },
            ] : [
                // C — rust orange ocean / dark sage-olive land
                { deep: [110,  38,   8], mid: [148,  58,  15], shallow: [172,  78,  25], shore: [148,  85,  42],
                  coastal: [ 40,  58,  45], lowland: [ 55,  72,  55], highland: [ 70,  85,  65], mountains: [ 88,  98,  78], peaks: [162, 172, 155] },
                // C — amber yellow ocean / dark slate blue-grey land
                { deep: [ 90,  70,  10], mid: [130, 100,  18], shallow: [158, 122,  28], shore: [140, 110,  55],
                  coastal: [ 42,  52,  65], lowland: [ 58,  68,  82], highland: [ 75,  85,  98], mountains: [ 95, 102, 115], peaks: [175, 182, 195] },
                // C — chartreuse ocean / brick red-terracotta land
                { deep: [ 55,  95,   8], mid: [ 85, 135,  15], shallow: [108, 158,  25], shore: [ 95, 130,  45],
                  coastal: [ 95,  38,  28], lowland: [118,  52,  35], highland: [138,  65,  42], mountains: [155,  82,  52], peaks: [195, 162, 135] },
            ];
            const ov = atmVariants[Math.floor((oceanRng || 0) * atmVariants.length) % atmVariants.length];
            stops = [
                { t: 0.0,                  c: ov.deep      },
                { t: ls * 0.50,            c: ov.mid       },
                { t: ls * 0.90,            c: ov.shallow   },
                { t: ls,                   c: ov.shore     },
                { t: ls + (1-ls) * 0.15,   c: ov.coastal   },
                { t: ls + (1-ls) * 0.40,   c: ov.lowland   },
                { t: ls + (1-ls) * 0.65,   c: ov.highland  },
                { t: ls + (1-ls) * 0.85,   c: ov.mountains },
                { t: 1.0,                  c: ov.peaks     },
            ];
        } else if (isDesert) {
            // Dry world with atmosphere but no ocean
            stops = [
                { t: 0.0, c: [142, 112,  60] },
                { t: 0.2, c: [178, 146,  82] },
                { t: 0.4, c: [202, 165,  88] },
                { t: 0.6, c: [182, 138,  68] },
                { t: 0.8, c: [142, 106,  55] },
                { t: 1.0, c: [112,  82,  46] },
            ];
        } else {
            // Standard blue water ocean (atm 1-9, D-F, hydro > 0)
            // Land uses a pure topographic palette: sandy beach → warm tan lowlands
            // → grey-brown uplands → rocky grey highlands → snow peaks.
            // No vegetation tones — green is reserved for exotic non-water oceans.
            const ls = seaLevel;
            stops = [
                { t: 0.0,                  c: [ 10,  30, 100] },  // abyssal
                { t: ls * 0.35,            c: [ 20,  68, 152] },  // deep
                { t: ls * 0.70,            c: [ 48, 118, 188] },  // mid ocean
                { t: ls * 0.92,            c: [ 85, 158, 212] },  // shallow
                { t: ls,                   c: [194, 172, 112] },  // beach
                { t: ls + (1-ls) * 0.06,   c: [180, 156, 100] },  // coastal lowland
                { t: ls + (1-ls) * 0.28,   c: [158, 136,  88] },  // lowland
                { t: ls + (1-ls) * 0.52,   c: [138, 118,  88] },  // upland
                { t: ls + (1-ls) * 0.70,   c: [124, 110,  98] },  // highland
                { t: ls + (1-ls) * 0.84,   c: [112, 108, 106] },  // mountain rock
                { t: 1.0,                  c: [222, 228, 240] },  // snow peaks
            ];
        }

        // Cloud tinting — world type sets the haze/cloud colour
        let cloudColor;
        if (isMolten)       cloudColor = [ 90,  65,  45];  // volcanic ash/smoke
        else if (isExotic)  cloudColor = [210, 165,  65];  // toxic yellow-orange haze
        else                cloudColor = [240, 244, 250];  // standard white

        // Specular ocean highlight — only worlds with a liquid surface
        const hasSpecular = !isMolten && !isRock && !isIce && !isDesert && hydro > 0;

        // Atmospheric limb haze — coloured glow at disk edge driven by atm type
        let limbColor = null, limbStrength = 0;
        if (isMolten) {
            limbColor    = [140,  90,  50];
            limbStrength = 0.45;
        } else if (isExotic) {
            limbColor    = [235, 155,  55];
            limbStrength = 0.55;
        } else if (atm > 0) {
            const hz     = Math.min(1, atm / 9);
            limbColor    = [Math.round(90 - 10 * hz), Math.round(155 - 25 * hz), 255];
            limbStrength = 0.35 + 0.30 * hz;
        }

        return { seaLevel, stops, polarColor, polarAngle, polarFade,
                 cloudColor, hasSpecular, limbColor, limbStrength,
                 isAirless: isRock || isIce };
    }

    // ── Hemisphere renderer ───────────────────────────────────────────────────
    // Orthographic projection onto a disc.  For each pixel inside the disc, the
    // eye-space normal (nx, ny, nz) is rotated by lonOffset to obtain the world-
    // space point (wx, wy, wz) on the unit sphere.  All noise is sampled in that
    // world space, so both hemisphere views always sample from the same seamless
    // 3-D field — no lat/lon seams, no polar artefacts, guaranteed continuity at
    // the shared 180° anti-meridian limb.

    function _renderHemisphere(imageData, cx, cy, diskR, heightGrid, seeds, cloudGrid,
                                heightCDF, lonOffset, palette, lightDir, cityCenters, craters) {
        const data = imageData.data;
        const W    = imageData.width;
        const H    = imageData.height;
        const lwx  = lightDir[0], lwy = lightDir[1], lwz = lightDir[2];
        const { seaLevel, cloudColor, hasSpecular, limbColor, limbStrength } = palette;

        // Precompute rotation constants for eye→world transform.
        const cosLO = Math.cos(lonOffset);
        const sinLO = Math.sin(lonOffset);
        // Eye-space z-component of the light vector — constant per hemisphere call;
        // derived from world→eye inverse rotation.  Used only for specular.
        const lzEye = lwx * cosLO + lwz * sinLO;

        const x0 = Math.max(0, Math.floor(cx - diskR));
        const x1 = Math.min(W, Math.ceil(cx + diskR));
        const y0 = Math.max(0, Math.floor(cy - diskR));
        const y1 = Math.min(H, Math.ceil(cy + diskR));

        for (let py = y0; py < y1; py++) {
            const ny  = (py - cy) / diskR;  // positive = down (south)
            const ny2 = ny * ny;
            if (ny2 >= 1) continue;

            for (let px = x0; px < x1; px++) {
                const nx = (px - cx) / diskR;
                const d2 = nx * nx + ny2;
                if (d2 >= 1) continue;

                const nz = Math.sqrt(1 - d2);

                // Rotate eye-space normal to world-space sphere point.
                // Derivation: lon_world = atan2(nx,nz) + lonOffset, then expand
                // cos/sin of sum to get wx,wz without trig calls in the hot loop.
                const wx =  nz * cosLO - nx * sinLO;   // cos(lat)*cos(lon_world)
                const wy = -ny;                          // sin(lat)
                const wz =  nx * cosLO + nz * sinLO;   // cos(lat)*sin(lon_world)

                // Geographic latitude — used only for polar ice overlay.
                const lat = Math.asin(wy);

                const h  = _continentHeight(heightGrid, seeds, wx, wy, wz);
                const hN = _remapHeight(h, heightCDF);

                let [r, g, b] = _heightToRGB(hN, lat, palette);

                // Craters — albedo modifier applied before lighting so rim
                // brightness and floor shadow interact with the sun angle.
                // Profile: central hint → dark floor → bright rim → faint ejecta.
                if (craters) {
                    let bestND = 2.0, bestMod = 0;
                    for (let ci = 0; ci < craters.length; ci++) {
                        const c   = craters[ci];
                        const dot = wx * c.wx + wy * c.wy + wz * c.wz;
                        if (dot < c.cosOuter) continue;
                        const nd = dot >= c.cosR
                            ? (1 - dot) / (1 - c.cosR)                              // 0=centre, 1=rim
                            : 1 + (c.cosR - dot) / (c.cosR - c.cosOuter) * 0.3;    // 1–1.3 ejecta
                        if (nd < bestND) {
                            bestND = nd;
                            if      (nd < 0.78) bestMod = -0.20 * c.depth;          // floor
                            else if (nd < 1.00) bestMod =  0.18 * c.depth * Math.sin((nd - 0.78) / 0.22 * Math.PI); // rim
                            else                bestMod =  0.05 * c.depth * (1 - (nd - 1.0) / 0.3);                 // ejecta
                        }
                    }
                    if (bestMod !== 0) {
                        const sc = 1 + bestMod;
                        r = Math.max(0, Math.min(255, (r * sc) | 0));
                        g = Math.max(0, Math.min(255, (g * sc) | 0));
                        b = Math.max(0, Math.min(255, (b * sc) | 0));
                    }
                }

                // Surface micro-texture — high-frequency fBm overlay sampled from the
                // same height grid breaks up solid colour bands without extra memory.
                // Freq 28 sits just below the GRID3=32 Nyquist limit; 2 octaves keep
                // it fast while adding enough fine detail to remove the painted look.
                const texN  = _fbm3D(heightGrid, wx * 28, wy * 28, wz * 28, 2, 0.45);
                const texSc = 1 + (texN - 0.5) * 0.16;
                r = Math.max(0, Math.min(255, (r * texSc) | 0));
                g = Math.max(0, Math.min(255, (g * texSc) | 0));
                b = Math.max(0, Math.min(255, (b * texSc) | 0));

                // World-space diffuse — dot(N_world, L_world).
                // Smooth terminator: transition band spans ±0.0625 of diff.
                const diff  = wx * lwx + wy * lwy + wz * lwz;
                const tRaw  = diff * 8 + 0.5;
                const tSat  = Math.max(0, Math.min(1, tRaw));
                const light = 0.50 + 0.50 * (tSat * tSat * (3 - 2 * tSat));
                r = (r * light) | 0;
                g = (g * light) | 0;
                b = (b * light) | 0;

                // Specular highlight on lit ocean surface (Phong, ~pow 24).
                // Rnz derivation: R·V in world-space collapses to 2*diff*nz − lzEye
                // because V_world = [cosLO, 0, sinLO] and wx*cosLO+wz*sinLO = nz.
                if (hasSpecular && diff > 0 && hN < seaLevel) {
                    const Rnz = 2 * diff * nz - lzEye;
                    if (Rnz > 0) {
                        const s2  = Rnz * Rnz;
                        const s4  = s2  * s2;
                        const s8  = s4  * s4;
                        const spec = s8 * s8 * s8 * 0.55;  // ≈ pow(Rnz, 24) * intensity
                        r = Math.min(255, (r + (255 - r) * spec) | 0);
                        g = Math.min(255, (g + (255 - g) * spec) | 0);
                        b = Math.min(255, (b + (255 - b) * spec) | 0);
                    }
                }

                // Cloud layer — 5 octaves at 2× frequency; smoothstepped alpha over a
                // wider transition zone gives wispy, feathered edges instead of hard cutoffs.
                if (cloudGrid) {
                    const ch = _fbm3D(cloudGrid, wx * 2, wy * 2, wz * 2, 5, 0.52);
                    if (ch > 0.58) {
                        const rawA = (ch - 0.58) / 0.32;
                        const ca   = Math.min(1, rawA * rawA * (3 - 2 * rawA)) * 0.65;
                        r = Math.min(255, (r + (cloudColor[0] - r) * ca * light) | 0);
                        g = Math.min(255, (g + (cloudColor[1] - g) * ca * light) | 0);
                        b = Math.min(255, (b + (cloudColor[2] - b) * ca * light) | 0);
                    }
                }

                // Limb darkening
                const limb = 0.65 + 0.35 * nz;
                r = (r * limb) | 0;
                g = (g * limb) | 0;
                b = (b * limb) | 0;

                // City lights — warm orange clusters on the night side, land only.
                // nightDepth fades lights in over the first ~20% of the dark side
                // so they don't snap on at the terminator.
                if (cityCenters && diff < 0 && hN >= seaLevel) {
                    const nightDepth = Math.min(1, -diff * 5);
                    let bestT = 0;
                    for (let ci = 0; ci < cityCenters.length; ci++) {
                        const c   = cityCenters[ci];
                        const dot = wx * c[0] + wy * c[1] + wz * c[2];
                        if (dot > CITY_THRESH) {
                            const t = (dot - CITY_THRESH) / (1 - CITY_THRESH);
                            if (t > bestT) bestT = t;
                        }
                    }
                    if (bestT > 0) {
                        const glow = bestT * bestT * (3 - 2 * bestT) * nightDepth;
                        r = Math.min(255, (r + (255 - r) * glow * 0.88) | 0);
                        g = Math.min(255, (g + (185 - g) * glow * 0.88) | 0);
                        b = Math.min(255, (b + ( 75 - b) * glow * 0.88) | 0);
                    }
                }

                // Atmospheric limb effects — day-side haze + night-side backscatter
                if (limbColor) {
                    const hazeT = Math.max(0, 1 - nz / 0.28);
                    const hazeA = hazeT * hazeT * limbStrength;
                    if (diff >= 0) {
                        // Day-side: coloured atmospheric rim blended over the surface
                        r = Math.min(255, (r + (limbColor[0] - r) * hazeA) | 0);
                        g = Math.min(255, (g + (limbColor[1] - g) * hazeA) | 0);
                        b = Math.min(255, (b + (limbColor[2] - b) * hazeA) | 0);
                    } else {
                        // Night-side: faint backscatter crescent — additive, dims
                        // toward the night pole and toward the disk centre.
                        const back = hazeA * Math.min(1, -diff * 4) * 0.40;
                        r = Math.min(255, (r + limbColor[0] * back) | 0);
                        g = Math.min(255, (g + limbColor[1] * back) | 0);
                        b = Math.min(255, (b + limbColor[2] * back) | 0);
                    }
                }

                // Desaturation — 12.5% pull toward luminance mutes the palette to
                // match the flatter tones seen in real orbital photography.
                const lum = (r * 77 + g * 150 + b * 29) >> 8;
                r = (r * 7 + lum) >> 3;
                g = (g * 7 + lum) >> 3;
                b = (b * 7 + lum) >> 3;

                const idx = (py * W + px) * 4;
                data[idx]     = Math.max(0, Math.min(255, r));
                data[idx + 1] = Math.max(0, Math.min(255, g));
                data[idx + 2] = Math.max(0, Math.min(255, b));
                data[idx + 3] = 255;
            }
        }
    }

    // ── Flat-map terrain renderer ─────────────────────────────────────────────
    // Renders terrain across the full rectangle. The canvas is divided into
    // numLobes equal columns; each column maps to a 360°/numLobes longitude
    // band using the sinusoidal formula, filling every pixel with terrain.

    function _renderInterruptedSinusoidal(imageData, heightGrid, seeds, heightCDF, palette, numLobes) {
        const data    = imageData.data;
        const W       = imageData.width;
        const H       = imageData.height;
        const lobeW   = W / numLobes;            // equatorial pixel-width per lobe
        const lobeLon = 2 * Math.PI / numLobes;  // longitude span per lobe (rad)

        for (let py = 0; py < H; py++) {
            const lat    = Math.PI / 2 - (py / H) * Math.PI;
            const cosLat = Math.cos(lat);
            const sinLat = Math.sin(lat);

            for (let li = 0; li < numLobes; li++) {
                const lobeCxPx   = (li + 0.5) * lobeW;
                const lobeCenLon = -Math.PI + (li + 0.5) * lobeLon;

                // Sinusoidal clip: lobe width narrows with cos(lat), producing the
                // interrupted sinusoidal diamond shape. Pixels outside this range
                // remain transparent (alpha 0 from createImageData initialisation).
                const halfPx  = (lobeW / 2) * cosLat;
                const pxStart = Math.max(0, Math.ceil(lobeCxPx - halfPx));
                const pxEnd   = Math.min(W - 1, Math.floor(lobeCxPx + halfPx));

                for (let px = pxStart; px <= pxEnd; px++) {
                    // Inverse sinusoidal: lon = lon0 + (x - cx) / (R * cosLat)
                    // where R = W/(2π), so factor simplifies to lobeLon / (lobeW * cosLat).
                    const lon = cosLat > 1e-6
                        ? lobeCenLon + ((px - lobeCxPx) / lobeW) * lobeLon / cosLat
                        : lobeCenLon;

                    const wx = cosLat * Math.cos(lon);
                    const wy = sinLat;
                    const wz = cosLat * Math.sin(lon);

                    const h         = _continentHeight(heightGrid, seeds, wx, wy, wz);
                    const hN        = _remapHeight(h, heightCDF);
                    const [r, g, b] = _heightToRGB(hN, lat, palette);
                    const idx       = (py * W + px) * 4;
                    data[idx]       = r;
                    data[idx + 1]   = g;
                    data[idx + 2]   = b;
                    data[idx + 3]   = 255;
                }
            }
        }
    }

    // ── Mercator renderer ─────────────────────────────────────────────────────
    // Full-rectangle fill. Longitude maps linearly to x; latitude via the
    // inverse Mercator formula. Clipped to ±85.051° (yMax ≈ π) so the canvas
    // exactly matches the standard Web Mercator tile extent.

    function _renderMercator(imageData, heightGrid, seeds, heightCDF, palette) {
        const data = imageData.data;
        const W    = imageData.width;
        const H    = imageData.height;
        for (let py = 0; py < H; py++) {
            const yMerc = Math.PI * (1 - 2 * py / H);
            const lat   = 2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2;
            const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
            for (let px = 0; px < W; px++) {
                const lon = (px / W) * 2 * Math.PI - Math.PI;
                const wx  = cosLat * Math.cos(lon);
                const wy  = sinLat;
                const wz  = cosLat * Math.sin(lon);
                const h   = _continentHeight(heightGrid, seeds, wx, wy, wz);
                const hN  = _remapHeight(h, heightCDF);
                const [r, g, b] = _heightToRGB(hN, lat, palette);
                const idx = (py * W + px) * 4;
                data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
            }
        }
    }

    // ── Mollweide renderer ────────────────────────────────────────────────────
    // Equal-area oval projection. Canvas must be 2:1 (800×400) — R = H/(2√2)
    // makes the oval exactly fill the canvas. Pixels outside the ellipse keep
    // alpha 0 (transparent, showing the panel background through).

    function _renderMollweide(imageData, heightGrid, seeds, heightCDF, palette) {
        const data  = imageData.data;
        const W     = imageData.width;
        const H     = imageData.height;
        const R     = H / (2 * Math.SQRT2);      // ≈ 141.42 for H=400
        const xMax  = 2 * Math.SQRT2 * R;        // = H = 400 (oval half-width)
        const yMax  = Math.SQRT2 * R;            // = H/2 = 200 (oval half-height)
        const cx    = W / 2, cy = H / 2;
        const invX2 = 1 / (xMax * xMax);
        const invY2 = 1 / (yMax * yMax);

        for (let py = 0; py < H; py++) {
            const dy = cy - py;                   // positive = north
            // Outside oval vertically — entire row is transparent
            if (Math.abs(dy) > yMax) continue;
            // θ from y = √2·R·sin(θ)
            const theta    = Math.asin(Math.max(-1, Math.min(1, dy / yMax)));
            const cosTheta = Math.cos(theta);
            // Geographic latitude from Mollweide auxiliary angle
            const sinLat = (2 * theta + Math.sin(2 * theta)) / Math.PI;
            const lat    = Math.asin(Math.max(-1, Math.min(1, sinLat)));
            const cosLat = Math.cos(lat);

            for (let px = 0; px < W; px++) {
                const dx = px - cx;
                // Oval boundary: (dx/xMax)² + (dy/yMax)² ≤ 1
                if (dx * dx * invX2 + dy * dy * invY2 > 1) continue;
                // lon = π·dx / (2√2·R·cosθ)
                const lon = cosTheta > 1e-9
                    ? Math.PI * dx / (xMax * cosTheta)
                    : 0;
                const wx  = cosLat * Math.cos(lon);
                const wy  = Math.sin(lat);
                const wz  = cosLat * Math.sin(lon);
                const h   = _continentHeight(heightGrid, seeds, wx, wy, wz);
                const hN  = _remapHeight(h, heightCDF);
                const [r, g, b] = _heightToRGB(hN, lat, palette);
                const idx = (py * W + px) * 4;
                data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
            }
        }
    }

    // ── Cosmographer Diamond renderer ─────────────────────────────────────────
    // 6 diamond (rhombus) lobes with straight-edge cuts. Each lobe uses a plain
    // equirectangular mapping: x → longitude, y → latitude, diamond clips the
    // corners. Matches the Traveller Cosmographer reference aesthetic.

    function _renderDiamond(imageData, heightGrid, seeds, heightCDF, palette) {
        const data    = imageData.data;
        const W       = imageData.width;
        const H       = imageData.height;
        const N       = 5;
        const hw      = W / (2 * N);
        const lobeLon = 2 * Math.PI / N;

        const bandTop = Math.round(POLE_FRAC * H);
        const bandBot = H - bandTop;
        const cutLat  = Math.PI / 2 - POLE_FRAC * Math.PI;   // 30° at POLE_FRAC=1/3

        // ── Northern lobes: N+1 upward triangles, offset half lobe ───────
        // Tips at y=0 (north pole), bases at y=bandTop.
        // Half-lobes at canvas left and right edges match T5 standard layout.
        for (let py = 0; py < bandTop; py++) {
            const lat    = Math.PI / 2 - (py / bandTop) * (Math.PI / 2 - cutLat);
            const sinLat = Math.sin(lat);
            const cosLat = Math.cos(lat);
            const maxOff = hw * py / bandTop;

            for (let li = 0; li <= N; li++) {
                const cx         = li * W / N;
                const lobeCenLon = -Math.PI + li * lobeLon;
                const pxStart    = Math.max(0,     Math.ceil(cx - maxOff));
                const pxEnd      = Math.min(W - 1, Math.floor(cx + maxOff));
                for (let px = pxStart; px <= pxEnd; px++) {
                    const lonFrac = (px - cx) / hw;
                    const lon     = lobeCenLon + lonFrac * (lobeLon / 2);
                    const wx      = cosLat * Math.cos(lon);
                    const wz      = cosLat * Math.sin(lon);
                    const h       = _continentHeight(heightGrid, seeds, wx, sinLat, wz);
                    const hN      = _remapHeight(h, heightCDF);
                    const [r, g, b] = _heightToRGB(hN, lat, palette);
                    const idx     = (py * W + px) * 4;
                    data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
                }
            }
        }

        // ── Equatorial band: full-width equirectangular strip ─────────────
        // Covers latitudes +cutLat to -cutLat with no longitudinal interruption.
        const bandH = bandBot - bandTop;
        for (let py = bandTop; py < bandBot; py++) {
            const lat    = cutLat - ((py - bandTop) / bandH) * 2 * cutLat;
            const sinLat = Math.sin(lat);
            const cosLat = Math.cos(lat);
            for (let px = 0; px < W; px++) {
                const lon = -Math.PI + (px / W) * 2 * Math.PI;
                const wx  = cosLat * Math.cos(lon);
                const wz  = cosLat * Math.sin(lon);
                const h   = _continentHeight(heightGrid, seeds, wx, sinLat, wz);
                const hN  = _remapHeight(h, heightCDF);
                const [r, g, b] = _heightToRGB(hN, lat, palette);
                const idx = (py * W + px) * 4;
                data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
            }
        }

        // ── Southern lobes: N downward triangles ─────────────────────────
        // Tips at y=H (south pole), bases at y=bandBot.
        // N complete lobes (no edge halves) matches T5 standard layout.
        const southH = H - bandBot;
        for (let py = bandBot; py < H; py++) {
            const lat    = -cutLat - ((py - bandBot) / southH) * (Math.PI / 2 - cutLat);
            const sinLat = Math.sin(lat);
            const cosLat = Math.cos(lat);
            const maxOff = hw * (H - py) / southH;

            for (let li = 0; li < N; li++) {
                const cx         = (li + 0.5) * W / N;
                const lobeCenLon = -Math.PI + (li + 0.5) * lobeLon;
                const pxStart    = Math.max(0,     Math.ceil(cx - maxOff));
                const pxEnd      = Math.min(W - 1, Math.floor(cx + maxOff));
                for (let px = pxStart; px <= pxEnd; px++) {
                    const lonFrac = (px - cx) / hw;
                    const lon     = lobeCenLon + lonFrac * (lobeLon / 2);
                    const wx      = cosLat * Math.cos(lon);
                    const wz      = cosLat * Math.sin(lon);
                    const h       = _continentHeight(heightGrid, seeds, wx, sinLat, wz);
                    const hN      = _remapHeight(h, heightCDF);
                    const [r, g, b] = _heightToRGB(hN, lat, palette);
                    const idx     = (py * W + px) * 4;
                    data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
                }
            }
        }
    }

    // ── Hex grid helpers ──────────────────────────────────────────────────────

    // Traces the sinusoidal outline of each lobe as a closed path and calls
    // ctx.clip(), so that subsequent drawing is confined to the lobe shapes.
    function _applyLobeClip(ctx, W, H, numLobes) {
        const lobeW = W / numLobes;
        ctx.beginPath();
        for (let li = 0; li < numLobes; li++) {
            const cx = (li + 0.5) * lobeW;
            ctx.moveTo(cx, 0);
            for (let py = 1; py <= H; py++) {
                const lat = Math.PI / 2 - (py / H) * Math.PI;
                ctx.lineTo(cx + (lobeW / 2) * Math.cos(lat), py);
            }
            for (let py = H - 1; py >= 0; py--) {
                const lat = Math.PI / 2 - (py / H) * Math.PI;
                ctx.lineTo(cx - (lobeW / 2) * Math.cos(lat), py);
            }
            ctx.closePath();
        }
        ctx.clip();
    }

    // Draws the true sinusoidal outline of each lobe as a closed curved stroke.
    function _drawLobeSeparators(ctx, W, H, numLobes) {
        const lobeW = W / numLobes;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth   = 1.0;
        for (let li = 0; li < numLobes; li++) {
            const cx = (li + 0.5) * lobeW;
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            for (let py = 1; py <= H; py++) {
                const lat = Math.PI / 2 - (py / H) * Math.PI;
                ctx.lineTo(cx + (lobeW / 2) * Math.cos(lat), py);
            }
            for (let py = H - 1; py >= 0; py--) {
                const lat = Math.PI / 2 - (py / H) * Math.PI;
                ctx.lineTo(cx - (lobeW / 2) * Math.cos(lat), py);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }

    function _drawHexGrid(ctx, W, H, size) {
        if (size <= 0) return;
        const hexesAcross = Math.max(1, Math.round(Math.PI * size * 1600 / 1005));
        // Flat-top hex: N columns fill width W, column-to-column spacing = 3R/2.
        const R  = (2 * W) / (3 * hexesAcross);
        const rh = R * Math.sqrt(3);   // row height (flat-to-flat)

        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth   = 0.6;

        const rowCount = Math.ceil(H / rh) + 2;

        for (let c = -1; c <= hexesAcross + 1; c++) {
            const cx     = c * 1.5 * R;
            const offset = (c & 1) ? rh / 2 : 0;   // odd columns shift down by half a row
            for (let r = -1; r <= rowCount; r++) {
                const cy = r * rh + offset;
                ctx.beginPath();
                for (let v = 0; v < 6; v++) {
                    const angle = (v * Math.PI) / 3;   // 0°, 60°, … 300° → flat-top
                    const vx = cx + R * Math.cos(angle);
                    const vy = cy + R * Math.sin(angle);
                    if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    function _drawLatitudeLines(ctx, W, H, size) {
        if (size <= 0) return;
        const hexesAcross = Math.max(1, Math.round(Math.PI * size * 1600 / 1005));
        const R  = (2 * W) / (3 * hexesAcross);
        const rh = R * Math.sqrt(3);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        for (let y = 0; y <= H + rh; y += rh) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();
    }

    // Diamond clip and separator — straight-line equivalents of the sinusoidal
    // lobe helpers above, used by the Cosmographer Diamond projection.

    function _applyDiamondClip(ctx, W, H, N) {
        const hw      = W / (2 * N);
        const bandTop = Math.round(POLE_FRAC * H);
        const bandBot = H - bandTop;
        ctx.beginPath();
        // Northern upward triangles (N+1, half-lobes at edges)
        for (let li = 0; li <= N; li++) {
            const cx = li * W / N;
            ctx.moveTo(cx,      0);
            ctx.lineTo(cx + hw, bandTop);
            ctx.lineTo(cx - hw, bandTop);
            ctx.closePath();
        }
        // Equatorial band — full-width rectangle
        ctx.moveTo(0,      bandTop);
        ctx.lineTo(W,      bandTop);
        ctx.lineTo(W,      bandBot);
        ctx.lineTo(0,      bandBot);
        ctx.closePath();
        // Southern downward triangles (N complete lobes)
        for (let li = 0; li < N; li++) {
            const cx = (li + 0.5) * W / N;
            ctx.moveTo(cx,      H);
            ctx.lineTo(cx + hw, bandBot);
            ctx.lineTo(cx - hw, bandBot);
            ctx.closePath();
        }
        ctx.clip();
    }

    function _drawDiamondSeparators(ctx, W, H, N) {
        const hw      = W / (2 * N);
        const bandTop = Math.round(POLE_FRAC * H);
        const bandBot = H - bandTop;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth   = 1.0;
        // Northern upward triangles — two slanted sides only, no base
        for (let li = 0; li <= N; li++) {
            const cx = li * W / N;
            ctx.beginPath();
            ctx.moveTo(cx - hw, bandTop);
            ctx.lineTo(cx,      0);
            ctx.lineTo(cx + hw, bandTop);
            ctx.stroke();
        }
        // Southern downward triangles — two slanted sides only, no base
        for (let li = 0; li < N; li++) {
            const cx = (li + 0.5) * W / N;
            ctx.beginPath();
            ctx.moveTo(cx - hw, bandBot);
            ctx.lineTo(cx,      H);
            ctx.lineTo(cx + hw, bandBot);
            ctx.stroke();
        }
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    // Convert mean temperature in Kelvin to a tempBand string compatible with
    // _buildPalette.  Used for non-mainworld bodies that lack a stored tempBand.
    function tempBandFromKelvin(k) {
        if (k <  230) return 'Frozen';
        if (k <  265) return 'Cold';
        if (k <  290) return 'Cool';
        if (k <  330) return 'Temperate';
        if (k <  360) return 'Warm';
        return 'Hot';
    }

    // ── Entry point ───────────────────────────────────────────────────────────

    function renderPlanetHemispheres(canvas, worldData, hexId) {
        _maskWeight   = typeof window.planetContinentalDefinition === 'number' ? window.planetContinentalDefinition : 0.55;
        _warpStrength = typeof window.planetCoastlineComplexity   === 'number' ? window.planetCoastlineComplexity   : 0.45;

        // Derive radius from incoming canvas height; resize canvas to fit.
        const diskR = Math.max(60, Math.floor(canvas.height / 2) - 8);
        const gap   = 18;
        canvas.width  = diskR * 4 + gap + 16;
        canvas.height = diskR * 2 + 20;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (window.printMode) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

        // Local seeded RNGs — never touch the global rng.
        const ms        = (typeof masterSeed !== 'undefined') ? masterSeed : 'default';
        const baseSeed  = hashString(ms + '-' + (hexId || '0000') + '-ph');
        const cloudSeed = hashString(ms + '-' + (hexId || '0000') + '-pc');
        const heightGrid    = _buildGrid3D(mulberry32(baseSeed));
        const continentSeed = hashString(ms + '-' + (hexId || '0000') + '-cn');
        const seeds         = _buildContinentSeeds(mulberry32(continentSeed));
        const heightCDF     = _buildCDF(heightGrid, seeds, 2048);

        const hasAtmo   = _parseStat(worldData.atmosphere) > 0;
        const cloudGrid = hasAtmo ? _buildGrid3D(mulberry32(cloudSeed)) : null;

        // City lights — commented out pending further work.
        // const uwpStr      = worldData.uwp || '';
        // const pop         = uwpStr.length >= 5 ? _parseStat(uwpStr[4]) : _parseStat(worldData.population);
        // const citySeed    = hashString(ms + '-' + (hexId || '0000') + '-ci');
        // const cityCenters = _buildCityCenters(pop, mulberry32(citySeed));
        const cityCenters = null;

        const oceanSeed  = hashString(ms + '-' + (hexId || '0000') + '-oc');
        const oceanRng   = mulberry32(oceanSeed)();
        const palette    = _buildPalette(worldData, oceanRng);

        const craterSeed = hashString(ms + '-' + (hexId || '0000') + '-cr');
        const craters    = palette.isAirless ? _buildCraters(mulberry32(craterSeed)) : null;

        // World-space light direction — substellar point at ~135°W, 20°N.
        // Puts the terminator at ~70% from disk-centre to the right edge, so
        // the western hemisphere reads as "afternoon" (mostly lit, shadow on the
        // right/prime-meridian side) and the eastern hemisphere reads as "night"
        // (mostly dark, thin lit crescent on the right near the anti-meridian).
        const lRaw = [-0.665, 0.342, -0.665];
        const lLen = Math.sqrt(lRaw[0] ** 2 + lRaw[1] ** 2 + lRaw[2] ** 2);
        const lightDir = lRaw.map(v => v / lLen);

        const W   = canvas.width;
        const H   = canvas.height;
        const cy  = H / 2;
        const lcx = 8 + diskR;              // western hemisphere centre
        const rcx = 8 + diskR * 3 + gap;   // eastern hemisphere centre

        const imageData = ctx.createImageData(W, H);

        // Western hemisphere centred on 90°W (lonOffset = −π/2)
        _renderHemisphere(imageData, lcx, cy, diskR, heightGrid, seeds, cloudGrid,
                          heightCDF, -Math.PI / 2, palette, lightDir, cityCenters, craters);
        // Eastern hemisphere centred on 90°E (lonOffset = +π/2)
        _renderHemisphere(imageData, rcx, cy, diskR, heightGrid, seeds, cloudGrid,
                          heightCDF,  Math.PI / 2, palette, lightDir, cityCenters, craters);

        ctx.putImageData(imageData, 0, 0);

        // Hemisphere labels
        ctx.font      = '11px "Share Tech Mono", "Courier New", monospace';
        ctx.fillStyle = window.printMode ? '#444444' : '#65706e';
        ctx.textAlign = 'center';
        ctx.fillText('Western', lcx, H - 3);
        ctx.fillText('Eastern', rcx, H - 3);
    }

    // ── Flat map entry point ──────────────────────────────────────────────────

    function renderFlatMap(canvas, worldData, hexId, options) {
        _maskWeight   = typeof window.planetContinentalDefinition === 'number' ? window.planetContinentalDefinition : 0.55;
        _warpStrength = typeof window.planetCoastlineComplexity   === 'number' ? window.planetCoastlineComplexity   : 0.45;

        const numLobes = (options && options.numLobes)   || 5;
        const proj     = (options && options.projection) || 'sinusoidal';
        const W = 800, H = 400;
        canvas.width  = W;
        canvas.height = H;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        if (window.printMode) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }

        // Same seed chain as renderPlanetHemispheres — guarantees terrain match.
        const ms         = (typeof masterSeed !== 'undefined') ? masterSeed : 'default';
        const baseSeed      = hashString(ms + '-' + (hexId || '0000') + '-ph');
        const heightGrid    = _buildGrid3D(mulberry32(baseSeed));
        const continentSeed = hashString(ms + '-' + (hexId || '0000') + '-cn');
        const seeds         = _buildContinentSeeds(mulberry32(continentSeed));
        const heightCDF     = _buildCDF(heightGrid, seeds, 2048);
        const oceanSeed     = hashString(ms + '-' + (hexId || '0000') + '-oc');
        const oceanRng   = mulberry32(oceanSeed)();
        const palette    = _buildPalette(worldData, oceanRng);

        const imageData = ctx.createImageData(W, H);
        const sizeCode  = _parseStat(worldData.size);

        if (proj === 'mercator') {
            _renderMercator(imageData, heightGrid, seeds, heightCDF, palette);
            ctx.putImageData(imageData, 0, 0);
            // No hex grid for Mercator — geographic hex cells are non-rectangular.
        } else if (proj === 'mollweide') {
            _renderMollweide(imageData, heightGrid, seeds, heightCDF, palette);
            ctx.putImageData(imageData, 0, 0);
            // No hex grid for Mollweide — oval boundary makes screen-space grid misleading.
        } else if (proj === 'diamond') {
            _renderDiamond(imageData, heightGrid, seeds, heightCDF, palette);
            ctx.putImageData(imageData, 0, 0);
            if (sizeCode > 0) {
                ctx.save();
                _applyDiamondClip(ctx, W, H, 5);
                _drawHexGrid(ctx, W, H, sizeCode);
                ctx.restore();
            }
            _drawDiamondSeparators(ctx, W, H, 5);
        } else {
            // Default: interrupted sinusoidal
            _renderInterruptedSinusoidal(imageData, heightGrid, seeds, heightCDF, palette, numLobes);
            ctx.putImageData(imageData, 0, 0);
            if (sizeCode > 0) {
                ctx.save();
                _applyLobeClip(ctx, W, H, numLobes);
                _drawHexGrid(ctx, W, H, sizeCode);
                _drawLatitudeLines(ctx, W, H, sizeCode);
                ctx.restore();
            }
            _drawLobeSeparators(ctx, W, H, numLobes);
        }
    }

    // ── Test helpers ──────────────────────────────────────────────────────────

    function _openTestModal(label, worldData, hexId) {
        const existing = document.getElementById('planet-renderer-test-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'planet-renderer-test-modal';
        Object.assign(modal.style, {
            position: 'fixed', inset: '0', zIndex: '9999',
            background: 'rgba(0,0,0,0.90)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
        });

        const title = document.createElement('div');
        title.textContent = label;
        Object.assign(title.style, {
            color: '#66fcf1', fontSize: '13px', marginBottom: '14px', letterSpacing: '0.05em'
        });

        const canvas = document.createElement('canvas');
        canvas.height = 280;
        canvas.width  = 580;
        Object.assign(canvas.style, {
            border: '1px solid #45a29e55', background: '#000011', display: 'block',
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '16px', padding: '6px 24px',
            background: 'transparent', border: '1px solid #45a29e',
            color: '#66fcf1', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '12px',
        });
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        modal.append(title, canvas, closeBtn);
        document.body.appendChild(modal);
        renderPlanetHemispheres(canvas, worldData, hexId);
    }

    function testMolten() {
        _openTestModal('Meltball — Atmo 1  Hydro F  Hot', {
            atmosphere: 1, hydrographics: 15, temperature: 'Hot', temperatureK: 800,
        }, '0102');
    }

    function test() {
        _openTestModal('Planet Renderer — Atmo 6  Hydro 6  Pop 8  Temperate', {
            atmosphere: 6, hydrographics: 6, population: 8, temperature: 'Temperate',
        }, '0101');
    }

    function testFlatMap(projection) {
        const existing = document.getElementById('planet-renderer-test-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'planet-renderer-test-modal';
        Object.assign(modal.style, {
            position: 'fixed', inset: '0', zIndex: '9999',
            background: 'rgba(0,0,0,0.90)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
        });

        const title = document.createElement('div');
        title.textContent = 'Flat Map (' + (projection || 'sinusoidal') + ') — Atmo 6  Hydro 6  Temperate';
        Object.assign(title.style, {
            color: '#66fcf1', fontSize: '13px', marginBottom: '14px', letterSpacing: '0.05em'
        });

        const canvas = document.createElement('canvas');
        canvas.width  = 800;
        canvas.height = 400;
        Object.assign(canvas.style, {
            border: '1px solid #45a29e55', background: '#000011', display: 'block',
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            marginTop: '16px', padding: '6px 24px',
            background: 'transparent', border: '1px solid #45a29e',
            color: '#66fcf1', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '12px',
        });
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        modal.append(title, canvas, closeBtn);
        document.body.appendChild(modal);
        renderFlatMap(canvas, { atmosphere: 6, hydrographics: 6, temperature: 'Temperate', size: 6 }, '0101',
                      { projection: projection || 'sinusoidal' });
    }

    return { renderPlanetHemispheres, renderFlatMap, tempBandFromKelvin, test, testMolten, testFlatMap };

})();

window.PlanetRenderer = PlanetRenderer;
