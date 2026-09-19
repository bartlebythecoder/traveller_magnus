'use strict';

// =============================================================================
// TERRAIN_FIELD.JS — Regional heightfield generation (v0.18 spike)
//
// Produces a high-resolution elevation grid for a small lat/lon window on a
// world, by taking the SAME global field planet_renderer.js already uses and
// continuing its octave cascade far past the point where the whole-world view
// stops carrying detail, then running hydraulic erosion over the result.
//
// Three properties this module must guarantee:
//
//   1. CONTINUITY — the low-frequency component is bit-identical to what
//      planet_renderer.js computes for the same seed, so a regional window
//      agrees with the whole-world map on coastlines, ranges and basins.
//      The mirrored constants below MUST stay in sync with that file.
//
//   2. DETERMINISM — every value derives from (masterSeed, hexId) through
//      hashString/mulberry32 and an integer hash. No Math.random anywhere,
//      no dependence on render resolution for the *shape* of the terrain.
//
//   3. NO TILING — the detail cascade uses a hash-based value noise with no
//      lookup table, so it cannot repeat. planet_renderer's 32³ wrapping grid
//      would visibly tile ~37× across a 150 km window at the finest octave;
//      that is why the detail cascade does not reuse it.
//
// Fine detail is INVENTED at zoom time. It does not exist in the whole-world
// view because that view has no resolution to hold it. Coastline and range
// placement match; individual peaks do not. This is expected, not a bug.
//
// Exposes: window.TerrainField
// =============================================================================

const TerrainField = (() => {

    // ── Constants mirrored from planet_renderer.js ────────────────────────────
    // Changing any of these breaks continuity with the whole-world map.
    const GRID3          = 32;
    const CONTINENT_FREQ = 4;
    const WARP_FREQ      = 1.8;
    const BASE_OCTAVES   = 6;
    const BASE_PERSIST   = 0.43;
    const WARP_OCTAVES   = 3;
    const WARP_PERSIST   = 0.50;

    // ── Base field: 32³ wrapping value noise (planet_renderer parity) ─────────

    function buildGrid3D(rng) {
        const g = new Float32Array(GRID3 * GRID3 * GRID3);
        for (let i = 0; i < g.length; i++) g[i] = rng();
        return g;
    }

    function sample3D(g, x, y, z) {
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

    function fbm3D(g, wx, wy, wz, octaves, persistence) {
        let val = 0, amp = 1, freq = CONTINENT_FREQ, total = 0;
        for (let o = 0; o < octaves; o++) {
            val   += amp * sample3D(g, wx * freq, wy * freq, wz * freq);
            total += amp;
            amp   *= persistence;
            freq  *= 2;
        }
        return val / total;
    }

    function buildContinentSeeds(rng) {
        const count = 3 + Math.floor(rng() * 5);
        const seeds = new Array(count);
        for (let i = 0; i < count; i++) {
            const cosTheta = rng() * 2 - 1;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const phi      = rng() * 2 * Math.PI;
            const angRad   = (35 + rng() * 35) * Math.PI / 180;
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

    function continentHeight(grid, seeds, wx, wy, wz, maskWeight, warpStrength, fieldVersion, plates) {
        const v2 = (fieldVersion >= 2 && plates && typeof TerrainTectonics !== 'undefined');
        let mask = 0;
        if (!v2)
        for (let i = 0; i < seeds.length; i++) {  // v1 only — seed-blob mask
            const s   = seeds[i];
            const dot = wx * s.sx + wy * s.sy + wz * s.sz;
            if (dot > s.cosR) {
                const t  = (dot - s.cosR) / (1 - s.cosR);
                const sm = t * t * (3 - 2 * t);
                const v  = sm * s.strength;
                if (v > mask) mask = v;
            }
        }
        const f  = WARP_FREQ;
        const dx = fbm3D(grid, wx * f + 1.7, wy * f + 9.2, wz * f + 3.4, WARP_OCTAVES, WARP_PERSIST) - 0.5;
        const dy = fbm3D(grid, wx * f + 8.3, wy * f + 2.8, wz * f + 5.1, WARP_OCTAVES, WARP_PERSIST) - 0.5;
        const dz = fbm3D(grid, wx * f + 4.6, wy * f + 7.1, wz * f + 0.9, WARP_OCTAVES, WARP_PERSIST) - 0.5;
        const detail = fbm3D(grid,
            wx + dx * warpStrength,
            wy + dy * warpStrength,
            wz + dz * warpStrength,
            BASE_OCTAVES, BASE_PERSIST);
        if (fieldVersion >= 2 && plates && typeof TerrainTectonics !== 'undefined') {
            // Version 2: plate structure replaces the seed-blob mask. Same
            // shape as _continentHeightV2 in planet_renderer.js — both call the
            // shared module rather than each keeping a copy, so the world image
            // and the regional map cannot drift apart. The smooth term is
            // table-free for the same reason it is there: a 32-cell lookup grid
            // shows its own cells once the window is only a few across.
            const d2 = TerrainTectonics.detailFbm(
                wx + dx * warpStrength, wy + dy * warpStrength, wz + dz * warpStrength,
                (plates.warpSeed || 0) ^ 0x9e37, 5, 0.45, CONTINENT_FREQ);
            return TerrainTectonics.sample(plates, wx, wy, wz) * maskWeight
                 + d2 * (1 - maskWeight);
        }
        return mask * maskWeight + detail * (1 - maskWeight);
    }

    // Empirical CDF over the WHOLE SPHERE. A regional render must always use
    // this global CDF — rebuilding it from local samples would re-normalise sea
    // level per region, so a mountain window would invent its own sea.
    function buildCDF(grid, seeds, nSamples, maskWeight, warpStrength, fieldVersion, plates) {
        const samples     = new Float32Array(nSamples);
        const goldenAngle = Math.PI * (Math.sqrt(5) - 1);
        for (let i = 0; i < nSamples; i++) {
            const cosTheta = 1 - (2 * (i + 0.5)) / nSamples;
            const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
            const phi = goldenAngle * i;
            samples[i] = continentHeight(grid, seeds,
                sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi),
                maskWeight, warpStrength, fieldVersion, plates);
        }
        samples.sort();
        return samples;
    }

    // Percentile rank of h, INTERPOLATED between the bracketing samples.
    //
    // planet_renderer.js returns the raw integer rank (lo / cdf.length), which
    // quantises elevation to 1/2048 of the planetary range. At whole-world zoom
    // that is invisible; at 150 km the base field only moves ~0.02 across the
    // window, so those 40-odd steps render as hard contour terracing over the
    // entire map. Interpolating makes the field continuous.
    //
    // This is a deliberate divergence from planet_renderer. The two agree to
    // within 1/2048 of the height range, far below a pixel at global zoom, so
    // coastlines do not move — but planet_renderer should adopt this too when
    // the spike graduates, so the two are bit-identical again.
    function remapHeight(h, cdf) {
        let lo = 0, hi = cdf.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cdf[mid] < h) lo = mid + 1; else hi = mid;
        }
        if (lo === 0) return 0;
        const a = cdf[lo - 1], b = cdf[lo];
        let t = (b > a) ? (h - a) / (b - a) : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        return (lo - 1 + t) / cdf.length;
    }

    // ── Detail cascade: hash-based value noise, no lookup table ───────────────
    // Table-free so the field cannot tile. Integer-hash → [0,1).

    function vhash(x, y, z, s) {
        let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841)
              ^ Math.imul(z | 0, 0xcb1ab31f) ^ (s | 0);
        h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
        h ^= h >>> 15;
        return (h >>> 0) * 2.3283064365386963e-10;
    }

    function vnoise3(x, y, z, s) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        const fx = x - ix, fy = y - iy, fz = z - iz;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const sz = fz * fz * (3 - 2 * fz);
        const x1 = ix + 1, y1 = iy + 1, z1 = iz + 1;
        const v000 = vhash(ix, iy, iz, s), v100 = vhash(x1, iy, iz, s);
        const v010 = vhash(ix, y1, iz, s), v110 = vhash(x1, y1, iz, s);
        const v001 = vhash(ix, iy, z1, s), v101 = vhash(x1, iy, z1, s);
        const v011 = vhash(ix, y1, z1, s), v111 = vhash(x1, y1, z1, s);
        const c00 = v000 + (v100 - v000) * sx;
        const c10 = v010 + (v110 - v010) * sx;
        const c01 = v001 + (v101 - v001) * sx;
        const c11 = v011 + (v111 - v011) * sx;
        const c0  = c00 + (c10 - c00) * sy;
        const c1  = c01 + (c11 - c01) * sy;
        return c0 + (c1 - c0) * sz;
    }

    // Ridged multifractal. 1-|2v-1| squared turns noise peaks into creases, and
    // the running weight suppresses detail in valleys so ridgelines stay sharp.
    // This is what separates "mountains" from "lumps" before erosion runs.
    // NOTE ON NORMALISATION — both cascades divide by the limit of the geometric
    // series, 1/(1-persistence), NOT by the running total of the octaves they
    // actually evaluated.
    //
    // Dividing by the running total rescales the entire result whenever the
    // octave count changes. Octave count is chosen from pixel size, so a zoomed
    // view evaluates more octaves — and every coarse feature would shift, even
    // though the extra octaves only carry ~0.4% of the amplitude. With a fixed
    // divisor, adding octaves adds fine detail ON TOP of an unchanged base,
    // which is what makes zoom a magnification rather than a regeneration.

    function ridgedDetail(wx, wy, wz, seed, f0, octaves, persistence, lacunarity, gain) {
        const norm = 1 / (1 - persistence);
        let sum = 0, amp = 1, freq = f0, weight = 1;
        for (let o = 0; o < octaves; o++) {
            let n = 1 - Math.abs(2 * vnoise3(wx * freq, wy * freq, wz * freq, seed + o * 7919) - 1);
            n = n * n;
            n *= weight;
            weight = Math.min(1, n * gain);
            sum   += n * amp;
            amp   *= persistence;
            freq  *= lacunarity;
        }
        return sum / norm;
    }

    // Plain (non-ridged) fBm on the same table-free noise — used for softer
    // worlds (ice sheets, dunes) where ridgelines would read as wrong.
    function smoothDetail(wx, wy, wz, seed, f0, octaves, persistence, lacunarity) {
        const norm = 1 / (1 - persistence);
        let sum = 0, amp = 1, freq = f0;
        for (let o = 0; o < octaves; o++) {
            sum  += amp * vnoise3(wx * freq, wy * freq, wz * freq, seed + o * 6577);
            amp  *= persistence;
            freq *= lacunarity;
        }
        return sum / norm;
    }

    // Combined detail value at a sphere point. Single definition so the
    // per-world statistics below and the per-window render can never diverge.
    function detailAt(wx, wy, wz, ctx, f0, octaves, useRidged, ridgeMix) {
        // Domain-warp the detail cascade.
        //
        // Ridged multifractal puts its ridges along the CONTOURS of the
        // underlying noise, and contours are closed loops — so unwarped it
        // produces clean circular ranges enclosing circular basins, which read
        // as impact craters rather than as terrain. Warping the input breaks
        // those loops into irregular shapes, exactly as it does for the plate
        // boundaries.
        const wf = f0 * 0.55;
        const a = 0.45 / f0;
        const ox = wx + a * (vnoise3(wx * wf + 19.3, wy * wf + 4.1, wz * wf + 7.7, ctx.seeds.ridge ^ 0x11) - 0.5);
        const oy = wy + a * (vnoise3(wx * wf + 2.9, wy * wf + 15.6, wz * wf + 3.2, ctx.seeds.ridge ^ 0x27) - 0.5);
        const oz = wz + a * (vnoise3(wx * wf + 8.4, wy * wf + 6.3, wz * wf + 21.8, ctx.seeds.ridge ^ 0x3d) - 0.5);

        if (!useRidged) {
            return smoothDetail(ox, oy, oz, ctx.seeds.smooth, f0, octaves, 0.50, 2.0);
        }
        return ridgeMix * ridgedDetail(ox, oy, oz, ctx.seeds.ridge, f0, octaves, 0.50, 2.0, 2.0)
             + (1 - ridgeMix) * smoothDetail(ox, oy, oz, ctx.seeds.smooth, f0, octaves, 0.50, 2.0);
    }

    // ── Per-world detail statistics ──────────────────────────────────────────
    // Centre and spread of the detail field, measured over the WHOLE SPHERE.
    //
    // These were previously taken from the window's own min/max/mean, which is
    // the second reason zoom changed the terrain: a smaller window sees a
    // narrower spread, so the same raw value mapped to a different elevation.
    // Sampling globally makes the mapping a property of the world.
    //
    // A useful consequence: a genuinely flat region now renders flat, instead
    // of being stretched to fill the full relief range just because it is the
    // only thing in frame.
    //
    // Percentiles rather than raw min/max — extremes from a finite sample are
    // unstable, and one outlier would rescale the whole world.
    function detailStats(ctx, f0, useRidged, ridgeMix) {
        const key = `${f0.toFixed(5)}|${useRidged ? 1 : 0}|${ridgeMix.toFixed(3)}`;
        if (ctx._detailStats && ctx._detailStats.key === key) return ctx._detailStats.val;

        const N = 2048;
        // Fixed octave count, independent of any window, so the statistics do
        // not drift with render resolution.
        const OCT = 12;
        const samples = new Float32Array(N);
        const golden = Math.PI * (Math.sqrt(5) - 1);
        let sum = 0;
        for (let i = 0; i < N; i++) {
            const cosT = 1 - (2 * (i + 0.5)) / N;
            const sinT = Math.sqrt(1 - cosT * cosT);
            const phi = golden * i;
            const v = detailAt(sinT * Math.cos(phi), cosT, sinT * Math.sin(phi),
                               ctx, f0, OCT, useRidged, ridgeMix);
            samples[i] = v;
            sum += v;
        }
        const mean = sum / N;
        const sorted = Float32Array.from(samples).sort();
        const lo = sorted[Math.floor(N * 0.01)];
        const hi = sorted[Math.floor(N * 0.99)];
        const val = { mean, span: (hi - lo) || 1 };
        ctx._detailStats = { key, val };
        return val;
    }

    // ── Hydraulic erosion ────────────────────────────────────────────────────
    // Droplet simulation (Beyer / Lague formulation). Noise alone reads as
    // lumpy because real mountains are noise that water has carved. This pass
    // is the single largest realism gain in the module: it produces dendritic
    // valley networks, sharpened ridgelines, alluvial deposition on flats and
    // flattened valley floors.
    //
    // Fully deterministic: droplet start positions come from a seeded mulberry32.

    function buildBrush(radius, W) {
        const offsets = [];
        const weights = [];
        let total = 0;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const d2 = dx * dx + dy * dy;
                if (d2 > radius * radius) continue;
                const w = 1 - Math.sqrt(d2) / radius;
                offsets.push(dy * W + dx);
                weights.push(w);
                total += w;
            }
        }
        for (let i = 0; i < weights.length; i++) weights[i] /= total;
        return { offsets, weights, radius };
    }

    function erode(height, W, H, opts, rng) {
        const iterations   = opts.iterations;
        const maxLifetime  = opts.maxLifetime   || 34;
        const inertia      = opts.inertia       || 0.05;
        const capacityF    = opts.capacity      || 4.0;
        const minCapacity  = opts.minCapacity   || 0.01;
        const erodeSpeed   = opts.erodeSpeed    || 0.30;
        const depositSpeed = opts.depositSpeed  || 0.30;
        const evaporation  = opts.evaporation   || 0.015;
        const gravity      = opts.gravity       || 4.0;
        const startSpeed   = opts.startSpeed    || 1.0;
        const startWater   = opts.startWater    || 1.0;
        const brush        = buildBrush(opts.brushRadius || 2, W);
        const bOff = brush.offsets, bW = brush.weights, bR = brush.radius;

        // Height and gradient by bilinear interpolation of the cell corners.
        function heightAndGrad(px, py) {
            const cx = px | 0, cy = py | 0;
            const fx = px - cx, fy = py - cy;
            const i  = cy * W + cx;
            const h00 = height[i], h10 = height[i + 1];
            const h01 = height[i + W], h11 = height[i + W + 1];
            const gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
            const gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
            const h  = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy)
                     + h01 * (1 - fx) * fy       + h11 * fx * fy;
            return { h, gx, gy, i, fx, fy };
        }

        for (let it = 0; it < iterations; it++) {
            let px = rng() * (W - bR * 2 - 3) + bR + 1;
            let py = rng() * (H - bR * 2 - 3) + bR + 1;
            let dx = 0, dy = 0;
            let speed = startSpeed, water = startWater, sediment = 0;

            for (let life = 0; life < maxLifetime; life++) {
                const node = heightAndGrad(px, py);
                const cx = px | 0, cy = py | 0;
                const cellIdx = cy * W + cx;

                // Blend previous direction with the downhill gradient.
                dx = dx * inertia - node.gx * (1 - inertia);
                dy = dy * inertia - node.gy * (1 - inertia);
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len !== 0) { dx /= len; dy /= len; }
                px += dx;
                py += dy;

                // Stopped moving, or wandered into the brush margin.
                if ((dx === 0 && dy === 0) ||
                    px < bR + 1 || px >= W - bR - 2 ||
                    py < bR + 1 || py >= H - bR - 2) break;

                const newH  = heightAndGrad(px, py).h;
                const dH    = newH - node.h;
                const cap   = Math.max(-dH * speed * water * capacityF, minCapacity);

                if (sediment > cap || dH > 0) {
                    // Deposit. Uphill moves drop at most enough to fill the pit,
                    // which is what forms flat valley floors and alluvial fans.
                    const amount = (dH > 0) ? Math.min(dH, sediment)
                                            : (sediment - cap) * depositSpeed;
                    sediment -= amount;
                    // Bilinear deposit onto the four cells of the current node.
                    const f = node.fx, g = node.fy, i = node.i;
                    height[i]         += amount * (1 - f) * (1 - g);
                    height[i + 1]     += amount * f       * (1 - g);
                    height[i + W]     += amount * (1 - f) * g;
                    height[i + W + 1] += amount * f       * g;
                } else {
                    // Erode, spread over the brush so channels are smooth rather
                    // than single-pixel scratches. Never cut deeper than dH.
                    const amount = Math.min((cap - sediment) * erodeSpeed, -dH);
                    for (let b = 0; b < bOff.length; b++) {
                        const bi = cellIdx + bOff[b];
                        if (bi < 0 || bi >= height.length) continue;
                        const w = amount * bW[b];
                        const take = height[bi] < w ? height[bi] : w;
                        height[bi] -= take;
                        sediment   += take;
                    }
                }

                speed = Math.sqrt(Math.max(0, speed * speed + -dH * gravity));
                water *= (1 - evaporation);
                if (water < 0.01) break;
            }
        }
        return height;
    }

    // ── Seed chain ───────────────────────────────────────────────────────────
    // Suffixes -ph / -cn / -oc match planet_renderer.js exactly so the base
    // field is identical. -rd / -sd / -er are new and only affect detail.

    function seedsFor(masterSeedStr, hexId) {
        const ms = masterSeedStr || 'default';
        const hx = hexId || '0000';
        return {
            base:    hashString(ms + '-' + hx + '-ph'),
            cont:    hashString(ms + '-' + hx + '-cn'),
            ocean:   hashString(ms + '-' + hx + '-oc'),
            ridge:   hashString(ms + '-' + hx + '-rd'),
            smooth:  hashString(ms + '-' + hx + '-sd'),
            erosion: hashString(ms + '-' + hx + '-er'),
        };
    }

    // Build the shared global context once; reused by both the regional field
    // and the whole-world locator preview so they cannot disagree.
    function buildContext(masterSeedStr, hexId, maskWeight, warpStrength, fieldVersion) {
        const fv    = (typeof fieldVersion === 'number') ? fieldVersion
                    : ((typeof window !== 'undefined' &&
                        typeof window.terrainFieldVersion === 'number')
                        ? window.terrainFieldVersion : 1);
        const sd    = seedsFor(masterSeedStr, hexId);
        const grid  = buildGrid3D(mulberry32(sd.base));
        const cseed = buildContinentSeeds(mulberry32(sd.cont));
        const plates = (fv >= 2 && typeof TerrainTectonics !== 'undefined')
            ? TerrainTectonics.buildPlates(mulberry32(sd.cont)) : null;
        const cdf   = buildCDF(grid, cseed, 2048, maskWeight, warpStrength, fv, plates);
        return {
            seeds: sd, grid, continentSeeds: cseed, cdf, plates,
            maskWeight, warpStrength, fieldVersion: fv,
            oceanRng: mulberry32(sd.ocean)(),
        };
    }

    // ── Hydrology ────────────────────────────────────────────────────────────
    //
    // Fill depressions, route flow, and INCISE the channels into the field
    // itself. This runs as part of terrain generation, immediately after
    // erosion — not as an overlay computed from a finished surface.
    //
    // That distinction is the whole point. Treating drainage as an overlay
    // meant the routing surface and the rendered surface were different
    // objects: erosion left pits, filling them created flats, and channels
    // traced across those flats followed fill order rather than topography —
    // long dead-straight lines over ridges. Every fix moved the symptom.
    //
    // Done here, the terrain genuinely HAS valleys, rivers lie in them because
    // the same flow field cut them, and the artifacts cannot arise because
    // there is only one surface.
    //
    // Returns { flow, down } so a caller can trace the channels it just carved.

    function _heap(cap) {
        const key = new Float64Array(cap), val = new Int32Array(cap);
        let n = 0;
        return {
            get size() { return n; },
            push(k, v) {
                let i = n++; key[i] = k; val[i] = v;
                while (i > 0) {
                    const p = (i - 1) >> 1;
                    if (key[p] <= key[i]) break;
                    const tk = key[p]; key[p] = key[i]; key[i] = tk;
                    const tv = val[p]; val[p] = val[i]; val[i] = tv;
                    i = p;
                }
            },
            pop() {
                const top = val[0]; n--;
                if (n > 0) {
                    key[0] = key[n]; val[0] = val[n];
                    let i = 0;
                    for (;;) {
                        const l = i * 2 + 1, r = l + 1; let m = i;
                        if (l < n && key[l] < key[m]) m = l;
                        if (r < n && key[r] < key[m]) m = r;
                        if (m === i) break;
                        const tk = key[m]; key[m] = key[i]; key[i] = tk;
                        const tv = val[m]; val[m] = val[i]; val[i] = tv;
                        i = m;
                    }
                }
                return top;
            },
        };
    }

    // Lake aridity constants. K is the km2 of catchment one km2 of lake
    // surface needs in order to survive its own evaporation:
    //
    //     K = LAKE_K0 * 10 ^ ((7 - hydrographics) * LAKE_K_DECADE)
    //
    // LAKE_K0 is the value at hydrographics 7 — Earth — and LAKE_K_DECADE is how
    // many orders of magnitude harder each step of drying makes it. Both were
    // calibrated by measurement, not taste: the target was Earth's own figure of
    // about 2% of land under lakes at hydro 7, with the count falling to nothing
    // by hydro 1 rather than rising, which is what an ungated depression count
    // does. Re-run utilities/lake_calibration if either is touched.
    const LAKE_K0       = 75;
    const LAKE_K_DECADE = 0.45;

    function _hydrology(elev, W, H, seaLevelM, localReliefM, opts) {
        const N = W * H;

        // Float64 throughout. Elevations here are METRES and reach five
        // figures, where float32's step is ~0.001 — a 1e-4 fill increment
        // rounds away entirely, leaving ties instead of gradients and killing
        // flow within a few cells.
        const filled = new Float64Array(elev);
        const seen = new Uint8Array(N);
        const heap = _heap(N);
        const popOrder = new Int32Array(N);
        let popN = 0;

        for (let i = 0; i < N; i++) {
            const y = (i / W) | 0, x = i - y * W;
            if (elev[i] < seaLevelM || x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                seen[i] = 1; heap.push(elev[i], i);
            }
        }
        let eLo = Infinity, eHi = -Infinity;
        for (let i = 0; i < N; i++) {
            if (elev[i] < eLo) eLo = elev[i];
            if (elev[i] > eHi) eHi = elev[i];
        }
        // As small as Float64 allows. The fill raises each step away from an
        // outlet by EPS, which is itself a gradient — a radial one, pointing
        // back the way the flood came. Make it large (1e-3 was) and over a long
        // flat it accumulates into metres of artificial slope that swamps the
        // real micro-relief, so channels follow the flood's radial pattern and
        // draw as straight spokes. At 1e-9 it is just enough to break exact
        // ties and the terrain decides everything else.
        const EPS = Math.max(1e-9, Math.abs(eHi) * 1e-12);

        while (heap.size > 0) {
            const i = heap.pop();
            popOrder[popN++] = i;
            const y = (i / W) | 0, x = i - y * W;
            for (let dy = -1; dy <= 1; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= H) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nx = x + dx;
                    if (nx < 0 || nx >= W) continue;
                    const j = ny * W + nx;
                    if (seen[j]) continue;
                    seen[j] = 1;
                    if (filled[j] <= filled[i]) filled[j] = filled[i] + EPS;
                    heap.push(filled[j], j);
                }
            }
        }

        // ── Flat resolution (Garbrecht & Martz) ─────────────────────────────
        //
        // Pit-filling makes a depression perfectly level, so steepest descent
        // has nothing to follow and ends up tracing whatever order the flood
        // happened to visit cells in — which radiates from the outlets and
        // draws as long dead-straight spokes across low ground. No amount of
        // tie-breaking on the source terrain fixes it, because inside a filled
        // flat the source terrain carries no usable signal either.
        //
        // The standard remedy builds an artificial gradient over each flat from
        // two distance fields:
        //
        //   towardLower — hops to the nearest cell that DOES drain. Rises away
        //                 from the outlet, so water runs toward it.
        //   awayHigher  — hops from the nearest cell of higher ground. Inverted,
        //                 it rises toward the flat's upslope rim, so water runs
        //                 off the edges instead of along them.
        //
        // Summed, the two produce the convergent, branching pattern real
        // drainage has across a plain, instead of parallel spokes.
        const FLAT = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            const y = (i / W) | 0, x = i - y * W;
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
            let hasLower = false;
            for (let dy = -1; dy <= 1 && !hasLower; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    if (filled[(y + dy) * W + (x + dx)] < filled[i]) { hasLower = true; break; }
                }
            }
            if (!hasLower) FLAT[i] = 1;
        }

        const distLow  = new Int32Array(N).fill(-1);
        const distHigh = new Int32Array(N).fill(-1);
        const queue = new Int32Array(N);

        function bfs(dist, seedTest) {
            let qh = 0, qt = 0;
            for (let i = 0; i < N; i++) {
                if (!FLAT[i]) continue;
                const y = (i / W) | 0, x = i - y * W;
                if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
                let seed = false;
                for (let dy = -1; dy <= 1 && !seed; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        if (seedTest(filled[(y + dy) * W + (x + dx)], filled[i])) { seed = true; break; }
                    }
                }
                if (seed) { dist[i] = 1; queue[qt++] = i; }
            }
            let maxD = 1;
            while (qh < qt) {
                const i = queue[qh++];
                const y = (i / W) | 0, x = i - y * W;
                for (let dy = -1; dy <= 1; dy++) {
                    const ny = y + dy;
                    if (ny < 1 || ny >= H - 1) continue;
                    for (let dx = -1; dx <= 1; dx++) {
                        if (!dx && !dy) continue;
                        const nx = x + dx;
                        if (nx < 1 || nx >= W - 1) continue;
                        const j = ny * W + nx;
                        if (!FLAT[j] || dist[j] >= 0) continue;
                        if (filled[j] !== filled[i]) continue;   // same flat only
                        dist[j] = dist[i] + 1;
                        if (dist[j] > maxD) maxD = dist[j];
                        queue[qt++] = j;
                    }
                }
            }
            return maxD;
        }

        bfs(distLow,  (nb, me) => nb < me);
        const maxHigh = bfs(distHigh, (nb, me) => nb > me);

        const flatInc = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            if (!FLAT[i]) continue;
            const a = distLow[i]  >= 0 ? distLow[i] : 0;
            const b = distHigh[i] >= 0 ? (maxHigh - distHigh[i]) : 0;
            flatInc[i] = a + b;
        }

        // Routing surface: the filled terrain, plus the flat gradient, plus a
        // whisper of true elevation to separate cells the flat gradient ties.
        // Both additions stay far below any genuine drop, so they decide only
        // where the filled surface is level.
        const EPSF = 1e-4;
        const tie = 3e-5 / Math.max(1, eHi - eLo);
        const route = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            route[i] = filled[i] + flatInc[i] * EPSF + (elev[i] - eLo) * tie;
        }

        // Rank = position in the flood's visit order. Lower means nearer an
        // outlet.
        const rank = new Int32Array(N);
        for (let k = 0; k < popN; k++) rank[popOrder[k]] = k;

        const down = new Int32Array(N).fill(-1);
        for (let i = 0; i < N; i++) {
            const y = (i / W) | 0, x = i - y * W;
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
            // WATER DOES NOT FLOW ACROSS A LAKE OR SEA BED. A submerged cell is
            // an outlet: flow arrives there and stops. Without this the router
            // carried whole catchments across a lake floor to its deepest cell
            // — measured at 7,523 cells of accumulation sitting on water — and
            // the incision below then cut that path into the bed, which the
            // depth bands and the hillshade both rendered as a river running
            // inside the lake. The global pass has always carried this guard
            // (TerrainRivers.buildNetwork, "sea drains nowhere"); this one did
            // not.
            if (elev[i] < seaLevelM) continue;
            // Only ever drain to a cell the flood reached EARLIER. Priority-
            // Flood expands outward from the outlets, so its visit order is a
            // topological order: a lower rank is strictly nearer an outlet.
            // Restricting to lower ranks makes the drainage graph acyclic by
            // construction, so every path terminates at the sea or the frame
            // edge and no river can strand in open country.
            //
            // Routing on two different criteria — steepest descent on the
            // tie-broken surface, with a fallback on the filled surface — is
            // what produced the strandings: A could point to B by one measure
            // while B pointed back to A by the other, and the cycle guard then
            // cut the river dead. One ordering, one graph, no cycles.
            let best = -1, bestGrad = 0;
            let fallback = -1, fbRank = rank[i];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const j = (y + dy) * W + (x + dx);
                    if (rank[j] >= rank[i]) continue;      // never drain uphill
                    const drop = route[i] - route[j];
                    if (drop > 0) {
                        const g = drop / ((dx && dy) ? 1.41421356 : 1);
                        if (g > bestGrad) { bestGrad = g; best = j; }
                    }
                    if (rank[j] < fbRank) { fbRank = rank[j]; fallback = j; }
                }
            }
            down[i] = (best >= 0) ? best : fallback;
        }

        // Accumulation. Priority-Flood popped low to high, so walking that
        // record backwards is high to low and no sort is needed.
        const flow = new Float32Array(N).fill(1);
        for (let k = popN - 1; k >= 0; k--) {
            const i = popOrder[k], d = down[i];
            if (d >= 0) flow[d] += flow[i];
        }
        // LAND ONLY. A shore cell receives an entire catchment and then stops,
        // so counting water put the whole basin's accumulation into the divisor
        // every land river is measured against, and every valley was therefore
        // incised shallower than the tuning below intends.
        let maxFlow = 1;
        for (let i = 0; i < N; i++) {
            if (elev[i] >= seaLevelM && flow[i] > maxFlow) maxFlow = flow[i];
        }

        // ── LAKES ───────────────────────────────────────────────────────────
        //
        // A lake is where the FILLED surface stands above the ground: the flood
        // had to raise that cell to give it an outlet, which is precisely the
        // shape of a basin holding standing water. Reading lakes off the fill is
        // what lets one sit at 3,000 m. The global sea-level datum can only ever
        // put water BELOW itself, so before this the only lake a sheet could
        // draw was a basin that happened to punch under planetary sea level —
        // measured at 0 of 8 sampled windows below hydrographics 7.
        //
        // NOT every depression fills, and that is the whole difficulty. Counting
        // every closed basin as a lake gives a DRY world MORE lakes than a wet
        // one (measured: 119 at hydro 1 against 57 at hydro 9), because a dry
        // world simply has more land above the datum. The Sahara has closed
        // basins and no lakes in them.
        //
        // The governing balance is evaporative: a lake persists while its
        // catchment delivers more water than its own surface loses, i.e.
        //
        //     catchmentArea >= K * lakeArea
        //
        // K is an aridity number — a few on a wet world, enormous on a desert
        // one. Hydrographics is the only water budget Traveller gives us and it
        // is a statement about surface water, so K is driven from it. This is
        // invented physics, not a Traveller rule; no edition describes surface
        // hydrology (see the terrain directive's art-not-rules note).
        //
        // A basin that fails at its spill level is NOT simply deleted. The level
        // is lowered until the smaller surface does balance, which is what a
        // shrinking endorheic lake does in life — Chad and the Aral are the same
        // basins they always were, holding less. It vanishes only when even its
        // deepest cells cannot balance.
        const lakeLevel = new Float32Array(N);       // 0 = dry, else surface in m
        {
            const cellKm2 = (opts && opts.cellKm2) || 1;
            const hydro = Math.max(0, Math.min(10,
                (opts && opts.hydrographics !== undefined) ? opts.hydrographics : 7));
            // Calibrated against Earth, which is hydrographics 7: lakes cover
            // about 2% of land, and a 10,400 km2 sheet carries roughly two
            // bodies over 10 km2 with a tail of ten to fifteen between 1 and 10.
            const K = LAKE_K0 * Math.pow(10, (7 - hydro) * LAKE_K_DECADE);
            // Below this a lake is a puddle that reads as a speck of noise at
            // any sane sheet resolution.
            const minLakeKm2 = 0.25;

            const comp = new Int32Array(N).fill(-1);
            const stack = [];
            for (let seed = 0; seed < N; seed++) {
                if (comp[seed] >= 0) continue;
                if (elev[seed] < seaLevelM) continue;          // already sea
                if (filled[seed] - elev[seed] <= 0) continue;  // not a depression
                // Collect one basin.
                const cells = [];
                comp[seed] = seed; stack.length = 0; stack.push(seed);
                let catchCells = 0;
                while (stack.length) {
                    const i = stack.pop();
                    cells.push(i);
                    if (flow[i] > catchCells) catchCells = flow[i];
                    const y = (i / W) | 0, x = i - y * W;
                    for (let dy = -1; dy <= 1; dy++) {
                        const ny = y + dy;
                        if (ny < 0 || ny >= H) continue;
                        for (let dx = -1; dx <= 1; dx++) {
                            if (!dx && !dy) continue;
                            const nx = x + dx;
                            if (nx < 0 || nx >= W) continue;
                            const j = ny * W + nx;
                            if (comp[j] >= 0) continue;
                            if (elev[j] < seaLevelM) continue;
                            if (filled[j] - elev[j] <= 0) continue;
                            comp[j] = seed; stack.push(j);
                        }
                    }
                }
                // Catchment is measured in CELLS by the accumulation pass, which
                // seeds every cell with 1.
                const catchKm2 = catchCells * cellKm2;
                // Deepest cell first, so taking the first m of them is the lake
                // at the level of the m-th.
                cells.sort((a, b) => elev[a] - elev[b]);
                let spill = 0;
                for (const i of cells) if (filled[i] > spill) spill = filled[i];
                // Largest surface this catchment can sustain.
                let keep = 0;
                for (let m = cells.length; m >= 1; m--) {
                    if (catchKm2 >= K * m * cellKm2) { keep = m; break; }
                }
                if (keep * cellKm2 < minLakeKm2) continue;
                const level = Math.min(spill, elev[cells[keep - 1]]);
                for (let m = 0; m < keep; m++) {
                    const i = cells[m];
                    if (elev[i] < level) lakeLevel[i] = level;
                }
            }
        }

        // INCISION. Depth follows flow with a fractional exponent, so trunks cut
        // deep valleys and headwaters still register. Blurring the incision
        // before subtracting is what widens a one-pixel notch into a valley with
        // sloping sides.
        const inc = new Float32Array(N);
        const maxInc = Math.max(30, localReliefM * 0.16);
        for (let i = 0; i < N; i++) {
            inc[i] = maxInc * Math.pow(flow[i] / maxFlow, 0.42);
        }
        const tmp = new Float32Array(N);
        for (let pass = 0; pass < 2; pass++) {
            const src = pass === 0 ? inc : tmp, dst = pass === 0 ? tmp : inc;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    let sum = 0, n = 0;
                    for (let dy = -2; dy <= 2; dy++) {
                        const ny = y + dy; if (ny < 0 || ny >= H) continue;
                        for (let dx = -2; dx <= 2; dx++) {
                            const nx = x + dx; if (nx < 0 || nx >= W) continue;
                            sum += src[ny * W + nx]; n++;
                        }
                    }
                    dst[y * W + x] = sum / n;
                }
            }
        }
        for (let i = 0; i < N; i++) {
            // A lake bed is never cut. The channel that feeds the lake stops at
            // its shore, and carving the floor underneath would put a trench
            // across the water exactly as the missing sub-sea guard used to.
            if (lakeLevel[i] > 0) continue;
            // Land is never cut below sea level; that would open false inlets
            // along the whole course instead of only at the mouth. And a cell
            // that is ALREADY submerged is never cut at all — it is floored at
            // its own height, so Math.max leaves it exactly as it was. This is
            // the same guard TerrainRivers.carve() has always used. The
            // -Infinity that used to sit here exempted lake and sea beds from
            // the rule entirely, and the incision carved a channel across them.
            const floor = elev[i] >= seaLevelM ? seaLevelM : elev[i];
            elev[i] = Math.max(floor, elev[i] - inc[i]);
        }
        return { flow, down, maxFlow, lakeLevel };
    }

    // ── Regional field ───────────────────────────────────────────────────────
    //
    // Local equirectangular window. At 150 km on an 8000 km world the angular
    // extent is ~2°, so distortion is negligible and a cos(lat0) correction on
    // longitude is enough to keep the graticule honest.
    //
    // ELEVATION IS IN METRES. An earlier revision kept the field in the base
    // field's normalised percentile units, which made both the vertical scale
    // and the erosion parameters meaningless: 150 km of window held ~600 m of
    // relief (a 0.4% grade, shading to flat grey), and every droplet hit
    // minCapacity and deposited instead of cutting. Metres fix both and make
    // the tuning parameters physically readable.
    //
    //   elev = planetReliefM · baseH  +  localReliefM · (normalised detail)
    //
    // The base term carries the planetary trend across the window (small, a few
    // hundred metres at this scale — correct, a 150 km window should be nearly
    // level on the planetary curve). The local term carries the mountains.
    //
    // opts: { ctx, latDeg, lonDeg, widthKm, planetRadiusKm, W, H,
    //         planetReliefM, localReliefM, featuresAcross, ridged,
    //         erosionIterations, onProgress }
    function buildRegional(opts) {
        const ctx   = opts.ctx;
        const W     = opts.W, H = opts.H;
        const lat0  = opts.latDeg * Math.PI / 180;
        const lon0  = opts.lonDeg * Math.PI / 180;
        const R     = opts.planetRadiusKm;
        const wKm   = opts.widthKm;
        const hKm   = wKm * (H / W);

        // ── Local projection ─────────────────────────────────────────────────
        // Azimuthal equidistant, centred on the site, built on an orthonormal
        // frame (centre, east, north) tangent to the sphere there.
        //
        // The obvious alternative — a lat/lon window with a fixed cos(lat0)
        // correction on longitude — is fine near the equator and wrong
        // everywhere else, because the correct correction varies across the
        // window's own height. Above ~70° the image visibly shears, and a
        // window straddling a pole is nonsense. The frame below has no
        // singularity: at lat ±90° it stays perfectly orthonormal, so any
        // location on the world is renderable.
        //
        // Equidistant also means distance from the centre is true in every
        // direction, so a scale bar drawn on this map is honest.
        const cosLat0 = Math.cos(lat0), sinLat0 = Math.sin(lat0);
        const cosLon0 = Math.cos(lon0), sinLon0 = Math.sin(lon0);
        const cX =  cosLat0 * cosLon0, cY = sinLat0,  cZ =  cosLat0 * sinLon0;
        const eX = -sinLon0,           eY = 0,        eZ =  cosLon0;
        const nX = -sinLat0 * cosLon0, nY = cosLat0,  nZ = -sinLat0 * sinLon0;

        // Angular half-extents (radians) — no latitude correction needed, the
        // frame accounts for it.
        const halfW = (wKm / 2) / R;
        const halfH = (hKm / 2) / R;

        const planetReliefM = opts.planetReliefM || 12000;
        const localReliefM  = opts.localReliefM !== undefined ? opts.localReliefM : 4500;

        // Landform size in KILOMETRES — a property of the world, not of the view.
        //
        // This previously derived from the window ("fit N landforms across
        // whatever width was asked for"), which meant every zoom level built a
        // different landscape: ask for 150 km and mountains were 21 km wide, ask
        // for 75 km and they were 10 km wide — different mountains, not a closer
        // look at the same ones. Anchoring to the world means a 75 km window
        // simply shows fewer of the same landforms, larger in frame.
        const landformKm = opts.landformKm || 20;

        // Detail cascade band. The coarsest octave has wavelength landformKm on
        // the ground; the finest runs down to ~2 px so nothing aliases — so
        // resolution controls how much fine detail resolves, and nothing else.
        // Persistence 0.5 against lacunarity 2 halves amplitude as it halves
        // wavelength, which keeps slope roughly constant across scales — that
        // self-similarity is what makes the result read as terrain.
        const mPerPx  = (wKm * 1000) / W;
        const f0      = R / landformKm;
        const fMax    = R / ((mPerPx * 2) / 1000);
        const octaves = Math.max(3, Math.min(16,
            Math.ceil(Math.log2(Math.max(2, fMax / f0))) + 1));

        const useRidged = opts.ridged !== false;
        const ridgeMix  = opts.ridgeMix !== undefined ? opts.ridgeMix : 0.62;
        // Per-world, window-independent centre and spread for the detail field.
        const dStats    = detailStats(ctx, f0, useRidged, ridgeMix);

        const elev   = new Float32Array(W * H);
        const baseH  = new Float32Array(W * H);
        const detail = new Float32Array(W * H);
        // Latitude is stored PER PIXEL, not per row. Under this projection a
        // single image row is not a line of constant latitude, and near a pole
        // one row can span a huge latitude range — so a per-row value would be
        // meaningless exactly where the snow line matters most.
        const latGrid = new Float32Array(W * H);

        for (let py = 0; py < H; py++) {
            const dy = halfH * (1 - 2 * (py + 0.5) / H);   // + = north

            for (let px = 0; px < W; px++) {
                const dx = halfW * (2 * (px + 0.5) / W - 1);   // + = east

                // p = c·cos(r) + (e·dx + n·dy)·sin(r)/r  — exactly unit length,
                // since e and n are orthonormal and orthogonal to c.
                const r = Math.sqrt(dx * dx + dy * dy);
                let wx, wy, wz;
                if (r < 1e-12) {
                    wx = cX; wy = cY; wz = cZ;
                } else {
                    const cr = Math.cos(r), sr = Math.sin(r) / r;
                    wx = cX * cr + (eX * dx + nX * dy) * sr;
                    wy = cY * cr + (eY * dx + nY * dy) * sr;
                    wz = cZ * cr + (eZ * dx + nZ * dy) * sr;
                }
                latGrid[py * W + px] = Math.asin(wy < -1 ? -1 : (wy > 1 ? 1 : wy));

                const raw = continentHeight(ctx.grid, ctx.continentSeeds, wx, wy, wz,
                                            ctx.maskWeight, ctx.warpStrength, ctx.fieldVersion, ctx.plates);

                // Ridged and plain fBm are MIXED inside detailAt(), never used
                // neat. Pure ridged multifractal gives excellent sharp
                // ridgelines but pathological valleys: 1-|2v-1| squared is very
                // flat across its whole low end, so basins come out as broad
                // level floors that flood into smooth circular lakes. Plain fBm
                // restores variation down there without softening the ridges.
                const d = detailAt(wx, wy, wz, ctx, f0, octaves, useRidged, ridgeMix);

                const i   = py * W + px;
                baseH[i]  = remapHeight(raw, ctx.cdf);
                detail[i] = d;
            }
            if (opts.onProgress && (py & 63) === 0) opts.onProgress(py / H * 0.55);
        }

        // Map detail to metres using the WORLD's centre and spread, never the
        // window's. localReliefM is therefore the planet-wide peak-to-trough
        // relief of the detail layer; a given window shows whatever share of
        // that its own ground actually spans.
        //
        // COASTAL TAPER — local relief fades out approaching sea level, so the
        // PLANETARY field keeps ownership of where the coastline is.
        //
        // Without this the detail layer decides land-versus-sea outright. At
        // 150 km on a 12,800 km world the base field varies by only ~1,200 m
        // across the whole window — it is nearly flat at that scale by
        // construction, which is the entire reason the detail cascade exists —
        // while the detail contributes 6,000-7,000 m. So the coastline was being
        // drawn by the detail field, and since changing landformKm regenerates
        // that field completely, adjusting a texture control moved the sea.
        // Water coverage swung between 0.1% and 7.6% on one fixed window.
        //
        // Relief does not fade to nothing at the shore: it drops to a small
        // absolute floor, so the coast still crenellates instead of becoming a
        // glassy curve, but not nearly enough to relocate it. Coastal plains and
        // continental shelves being flat is also what real ones do.
        //
        // Both the taper distance and the floor derive only from world-anchored
        // quantities, so zoom consistency is unaffected.
        const seaPct = opts.seaLevel;
        const useTaper = (typeof seaPct === 'number');
        const seaLevelM = useTaper ? planetReliefM * seaPct : 0;
        const taperM = opts.coastTaperM !== undefined ? opts.coastTaperM
                     : Math.max(300, localReliefM * 0.12);
        const floorM = Math.min(
            opts.coastFloorM !== undefined ? opts.coastFloorM : 250, localReliefM);

        for (let i = 0; i < elev.length; i++) {
            const baseM = planetReliefM * baseH[i];
            const d = (detail[i] - dStats.mean) / dStats.span;

            if (!useTaper) { elev[i] = baseM + localReliefM * d; continue; }

            const signed = (baseM - seaLevelM) / taperM;    // <0 sea, >0 land
            const t = Math.min(1, Math.abs(signed));
            const amp = floorM + (localReliefM - floorM) * (t * t * (3 - 2 * t));

            // Detail is centred on the base only AT the shoreline. Inland it
            // becomes purely additive, so valley floors bottom out at the base
            // elevation instead of being cut below it; offshore it becomes
            // purely subtractive, so seabed relief cannot breach the surface.
            //
            // Centring it everywhere is what let a window sitting 1,600 m above
            // sea level fill 7.6% of its area with sea: detail swung +/-2,600 m
            // about that base and the low tail crossed the global datum. The
            // shoreline is a planetary fact and belongs to the base field.
            const w = Math.max(-1, Math.min(1, signed));
            elev[i] = baseM + amp * (d + 0.5 * w);
        }

        // Erosion. Iterations scale with area so droplet *density* — and so the
        // look — stays constant across resolutions.
        const iters = opts.erosionIterations !== undefined
            ? opts.erosionIterations
            : Math.round(W * H * 0.18);

        if (iters > 0) {
            // The droplet parameters are calibrated for a field spanning [0,1],
            // so normalise in, erode, restore — otherwise minCapacity swamps the
            // real height deltas and every droplet deposits instead of cutting.
            //
            // The DIVISOR is localReliefM, a world property — not the window's
            // own max-minus-min. Using the window's range makes erosion strength
            // depend on what happens to be in frame, so a flat window would be
            // carved as aggressively as a mountain range. Only the offset is
            // taken from the window, and erosion is translation-invariant, so
            // that part is harmless.
            let lo = Infinity;
            for (let i = 0; i < elev.length; i++) if (elev[i] < lo) lo = elev[i];
            const span = Math.max(1, localReliefM);
            for (let i = 0; i < elev.length; i++) elev[i] = (elev[i] - lo) / span;

            erode(elev, W, H, {
                iterations:   iters,
                brushRadius:  opts.brushRadius || 2,
                erodeSpeed:   opts.erodeSpeed,
                depositSpeed: opts.depositSpeed,
                maxLifetime:  opts.maxLifetime,
            }, mulberry32(ctx.seeds.erosion));

            for (let i = 0; i < elev.length; i++) elev[i] = elev[i] * span + lo;
        }
        if (opts.onProgress) opts.onProgress(0.85);

        // Hydrology is part of TERRAIN GENERATION, not a later overlay: it
        // cuts the valleys that the rivers will then be drawn along.
        let hydro = null;
        if (opts.hydrology && typeof seaPct === 'number') {
            hydro = _hydrology(elev, W, H, planetReliefM * seaPct, localReliefM, {
                cellKm2: Math.pow(mPerPx / 1000, 2),
                // seaPct IS hydrographics/10 (sheetSetup derives it that way),
                // clamped at 0.05 for hydro 0 — a case hydrology never runs in,
                // because the panel and the exporters both gate it on hydro >= 1.
                hydrographics: seaPct * 10,
            });
        }

        let eMin = Infinity, eMax = -Infinity;
        for (let i = 0; i < elev.length; i++) {
            if (elev[i] < eMin) eMin = elev[i];
            if (elev[i] > eMax) eMax = elev[i];
        }

        return {
            elev, height: elev, baseH, latGrid, W, H,
            flow: hydro ? hydro.flow : null,
            // Per-pixel lake surface elevation in metres, 0 where there is no
            // lake. The renderer and the river tracer both need it: a lake is
            // water, but at its OWN level rather than the planetary datum.
            lakeLevel: hydro ? hydro.lakeLevel : null,
            flowDown: hydro ? hydro.down : null,
            maxFlow: hydro ? hydro.maxFlow : 0,
            lat0Deg: opts.latDeg, lon0Deg: opts.lonDeg,
            halfWidthRad: halfW, halfHeightRad: halfH,
            halfWidthDeg: halfW * 180 / Math.PI,
            halfHeightDeg: halfH * 180 / Math.PI,
            widthKm: wKm, heightKm: hKm,
            metresPerPx: mPerPx,
            planetReliefM, localReliefM, landformKm,
            seaLevelM: useTaper ? seaLevelM : null, coastTaperM: useTaper ? taperM : 0,
            elevMinM: eMin, elevMaxM: eMax,
            detailOctaves: octaves,
            erosionIterations: iters,
        };
    }

    // ── Site selection ───────────────────────────────────────────────────────
    // Picks N land locations worth rendering. Pure function of the field — no
    // RNG — so the same world always yields the same N sites in the same order.
    // This is the prototype of the "five buttons" feature: sites are DERIVED,
    // not random, because random lat/lon on a wet world returns five pictures
    // of open water.
    //
    // Score favours local base-field relief (interesting ground) and penalises
    // sites close to one already chosen, so the set spreads over the world.
    function findSites(ctx, seaLevel, count, sampleN) {
        const N = sampleN || 3000;
        const golden = Math.PI * (Math.sqrt(5) - 1);
        const cands = [];
        const probe = 0.035;   // ~2° offset for the local relief estimate

        const sample = (wx, wy, wz) => remapHeight(
            continentHeight(ctx.grid, ctx.continentSeeds, wx, wy, wz,
                            ctx.maskWeight, ctx.warpStrength, ctx.fieldVersion, ctx.plates), ctx.cdf);

        for (let i = 0; i < N; i++) {
            const cosT = 1 - (2 * (i + 0.5)) / N;
            const sinT = Math.sqrt(1 - cosT * cosT);
            const phi  = golden * i;
            const wx = sinT * Math.cos(phi), wy = cosT, wz = sinT * Math.sin(phi);

            const h = sample(wx, wy, wz);
            if (h <= seaLevel + 0.015) continue;        // must be dry land

            // Local relief from four tangential probes.
            let vmin = h, vmax = h;
            for (let k = 0; k < 4; k++) {
                const a = k * Math.PI / 2;
                const ox = wx + probe * Math.cos(a);
                const oy = wy + probe * Math.sin(a);
                const oz = wz + probe * Math.cos(a + 1.1);
                const L = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
                const v = sample(ox / L, oy / L, oz / L);
                if (v < vmin) vmin = v;
                if (v > vmax) vmax = v;
            }

            const lat = Math.asin(Math.max(-1, Math.min(1, wy))) * 180 / Math.PI;
            const lon = Math.atan2(wz, wx) * 180 / Math.PI;
            cands.push({ lat, lon, h,
                         relief: vmax - vmin,
                         score: (vmax - vmin) * 3 + (h - seaLevel) });
        }

        cands.sort((a, b) => b.score - a.score);

        // Greedy spread — reject anything within 25° of an accepted site.
        const picked = [];
        const minSep = 25;
        for (const c of cands) {
            if (picked.length >= count) break;
            let ok = true;
            for (const p of picked) {
                const dLat = c.lat - p.lat;
                let dLon = Math.abs(c.lon - p.lon);
                if (dLon > 180) dLon = 360 - dLon;
                if (Math.sqrt(dLat * dLat + dLon * dLon) < minSep) { ok = false; break; }
            }
            if (ok) picked.push(c);
        }
        // Relax separation if the world is too small/dry to spread that far.
        for (let i = 0; picked.length < count && i < cands.length; i++) {
            if (!picked.includes(cands[i])) picked.push(cands[i]);
        }
        return picked.slice(0, count);
    }

    // ── Projector ────────────────────────────────────────────────────────────
    // Forward and inverse of the window's azimuthal-equidistant projection,
    // derived from the field itself. Shared so the graticule, the feature
    // labels and any future overlay cannot disagree about where a coordinate
    // lands — a tick drifting off its own gridline is exactly the kind of bug
    // two separate copies of this maths would produce.
    function projector(f) {
        const lat0 = f.lat0Deg * Math.PI / 180;
        const lon0 = f.lon0Deg * Math.PI / 180;
        const cl0 = Math.cos(lat0), sl0 = Math.sin(lat0);
        const cn0 = Math.cos(lon0), sn0 = Math.sin(lon0);
        const cX =  cl0 * cn0, cY = sl0,  cZ =  cl0 * sn0;
        const eX = -sn0,       eY = 0,    eZ =  cn0;
        const nX = -sl0 * cn0, nY = cl0,  nZ = -sl0 * sn0;
        const halfW = f.halfWidthRad, halfH = f.halfHeightRad;
        const W = f.W, H = f.H;

        return {
            halfW, halfH, W, H,

            // lat/lon (degrees) -> pixel. `front` is false for points on the
            // far side of the world, which must not be drawn.
            toScreen(latDeg, lonDeg) {
                const la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180;
                const cl = Math.cos(la);
                const px = cl * Math.cos(lo), py = Math.sin(la), pz = cl * Math.sin(lo);
                const dot = Math.max(-1, Math.min(1, px * cX + py * cY + pz * cZ));
                const r = Math.acos(dot);
                const k = (r < 1e-9) ? 1 : r / Math.sin(r);
                const dx = (px * eX + py * eY + pz * eZ) * k;
                const dy = (px * nX + py * nY + pz * nZ) * k;
                return {
                    x: ((dx / halfW) + 1) / 2 * W,
                    y: (1 - (dy / halfH)) / 2 * H,
                    front: r < Math.PI / 2,
                };
            },

            // pixel -> lat/lon (degrees)
            toLatLon(x, y) {
                const dx = halfW * (2 * (x / W) - 1);
                const dy = halfH * (1 - 2 * (y / H));
                const r = Math.sqrt(dx * dx + dy * dy);
                let wx, wy, wz;
                if (r < 1e-12) { wx = cX; wy = cY; wz = cZ; }
                else {
                    const cr = Math.cos(r), sr = Math.sin(r) / r;
                    wx = cX * cr + (eX * dx + nX * dy) * sr;
                    wy = cY * cr + (eY * dx + nY * dy) * sr;
                    wz = cZ * cr + (eZ * dx + nZ * dy) * sr;
                }
                return {
                    latDeg: Math.asin(Math.max(-1, Math.min(1, wy))) * 180 / Math.PI,
                    lonDeg: Math.atan2(wz, wx) * 180 / Math.PI,
                };
            },
        };
    }

    // ── Whole-world locator preview ──────────────────────────────────────────
    // Equirectangular, base field only — this is exactly what the whole-world
    // map sees, so overlaying the region box on it is a direct continuity test.
    function buildGlobalPreview(ctx, W, H) {
        const out = new Float32Array(W * H);
        for (let py = 0; py < H; py++) {
            const lat = Math.PI / 2 - ((py + 0.5) / H) * Math.PI;
            const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
            for (let px = 0; px < W; px++) {
                const lon = ((px + 0.5) / W) * 2 * Math.PI - Math.PI;
                const raw = continentHeight(ctx.grid, ctx.continentSeeds,
                    cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon),
                    ctx.maskWeight, ctx.warpStrength, ctx.fieldVersion, ctx.plates);
                out[py * W + px] = remapHeight(raw, ctx.cdf);
            }
        }
        return { height: out, W, H };
    }

    return {
        buildContext, buildRegional, buildGlobalPreview, findSites, projector,
        seedsFor, erode, vnoise3, ridgedDetail, smoothDetail,
        continentHeight, remapHeight,
    };
})();

window.TerrainField = TerrainField;
