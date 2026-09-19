'use strict';

// =============================================================================
// TERRAIN_TECTONICS.JS — Plate-derived continental structure (field version 2)
//
// Version 1 builds continents from a handful of round seed blobs blended with
// noise. The result has no GRAIN: mountains come out as isotropic lumps, because
// nothing in the model knows that real ranges are linear, run along plate
// margins, and are paired with trenches on one side and rifts elsewhere. That
// arrangement is most of what makes a real planet look real.
//
// This module supplies the same thing a tectonic history would, as a PURE
// FUNCTION of position — no simulation, no iteration, no stored state:
//
//   * plates as a spherical Voronoi over seeded centres
//   * each plate continental or oceanic, which is what draws the coastlines
//   * each plate carrying a motion vector
//   * boundaries classified by relative motion into convergent / divergent /
//     transform, and shaped accordingly
//
// Being a pure function is what lets it live inside the existing architecture:
// evaluable per window, identical at every zoom, nothing to cache.
//
// SHARED DELIBERATELY. planet_renderer.js and terrain_field.js both call it, so
// a world image and a regional map of the same world cannot disagree. Copying
// this logic into both would guarantee they eventually drift.
//
// Exposes: window.TerrainTectonics
// =============================================================================

const TerrainTectonics = (() => {

    // Angular width over which a boundary's influence decays (radians).
    // ~0.10 rad is about 6 degrees, or 640 km on an Earth-sized world — the
    // right order for a mountain belt's width.
    const BOUNDARY_WIDTH = 0.10;

    // Elevation offsets, in the same arbitrary units as version 1's output.
    // Absolute scale does not matter: everything downstream is percentile-
    // remapped through the CDF, so hydrographics still sets sea level exactly.
    const CONTINENT_BASE = 0.58;
    const OCEAN_BASE     = 0.30;

    const UPLIFT_COLLISION = 0.34;   // continent meets continent — plateau
    const UPLIFT_ARC       = 0.30;   // ocean dives under continent — arc
    const TRENCH_DEPTH     = 0.20;   // the oceanic side of the same boundary
    const RIFT_DEPTH       = 0.12;   // continental plates pulling apart
    const RIDGE_HEIGHT     = 0.10;   // oceanic plates pulling apart

    // CONTINENTAL MARGIN TAPER — continental crust thins toward its own edges,
    // so the outer part of every continental plate sits below sea level as
    // shelf and epicontinental sea. Without this the plate field is piecewise
    // FLAT: a plate's interior is one height, so the sea level either floods
    // the whole plate or none of it, and because ~45% of the sphere is
    // continental and the continental plates almost always touch, every world
    // came out as a single landmass. Measured at hydrographics 6 (40% land),
    // 14 worlds: the largest landmass held 86% of all land before this and 63%
    // after, against 64% for the version-1 field and 57% for Earth. Distinct
    // landmasses over the same run: 2.4 before, 4.7 after.
    //
    // The taper is keyed to distance from the NEAREST BOUNDARY, not from the
    // plate centre. A centre-keyed dome was tried first and does not work: the
    // saddle between two adjacent continental plates stays well above sea level,
    // so the pair still emerges as one mass (measured 84% largest, i.e. no
    // improvement at all). Keying it to the boundary floods the seam between
    // neighbouring continental plates, which is what actually separates them —
    // and it is also where a real passive margin sits. Convergent margins are
    // pushed back up by the boundary features below, so seams do not all read
    // the same way.
    const SHELF_DROP  = 0.22;   // how far the margin falls below plate interior
    const SHELF_WIDTH = 0.18;   // radians over which it climbs back to interior

    // Overall amplitude of the plate field, relative to the DETAIL NOISE the
    // callers mix it with (planet_renderer._continentHeightV2 and
    // terrain_field.continentHeight, both as tect*ContDef + noise*(1-ContDef)).
    //
    // This exists because the Continental Definition slider is shared with the
    // version-1 field and its default was calibrated there. Measured as the
    // ratio of the two terms' standard deviations at the default 0.55: version
    // 1's seed-blob mask runs 3.43x its noise term, but the raw plate field ran
    // only 1.11x, so nearly half of every coastline was unstructured fBm rather
    // than plate structure. That is what produced ragged coasts and worlds
    // peppered with inland seas — 3.1 per world at hydrographics 6, against 0.3
    // for version 1. At 3.0 the ratio is 3.34, i.e. the plate field now carries
    // the same authority over the coastline that the blobs carried in version 1,
    // and inland seas fall to 1.0 per world.
    //
    // Scaling here rather than in the constants above keeps their proportions —
    // a mountain belt stays the same height RELATIVE to the continental step.
    const RELIEF_GAIN = 3.0;

    // ── Self-contained hash noise ────────────────────────────────────────────
    // Used only to warp the plate lookup. Kept local so this module has no load
    // -order dependency on the other terrain files.
    function _vhash(x, y, z, s) {
        let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841)
              ^ Math.imul(z | 0, 0xcb1ab31f) ^ (s | 0);
        h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
        h ^= h >>> 15;
        return (h >>> 0) * 2.3283064365386963e-10;
    }

    function _noise(x, y, z, s) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        const fx = x - ix, fy = y - iy, fz = z - iz;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
        const x1 = ix + 1, y1 = iy + 1, z1 = iz + 1;
        const c00 = _vhash(ix,iy,iz,s) + (_vhash(x1,iy,iz,s) - _vhash(ix,iy,iz,s)) * sx;
        const c10 = _vhash(ix,y1,iz,s) + (_vhash(x1,y1,iz,s) - _vhash(ix,y1,iz,s)) * sx;
        const c01 = _vhash(ix,iy,z1,s) + (_vhash(x1,iy,z1,s) - _vhash(ix,iy,z1,s)) * sx;
        const c11 = _vhash(ix,y1,z1,s) + (_vhash(x1,y1,z1,s) - _vhash(ix,y1,z1,s)) * sx;
        const c0 = c00 + (c10 - c00) * sy, c1 = c01 + (c11 - c01) * sy;
        return c0 + (c1 - c0) * sz;
    }

    // Two octaves of warp, applied to the position BEFORE the plate lookup.
    // Without it every plate boundary is an exact great-circle arc and the
    // Voronoi diagram is plainly visible as straight-edged wedges.
    const WARP = 0.26;
    function _warp(wx, wy, wz, seed, out) {
        const f = 1.7;
        let ox = wx, oy = wy, oz = wz;
        for (let o = 0; o < 2; o++) {
            const g = f * (1 << o), a = WARP / (1 << o);
            ox += a * (_noise(wx*g + 11.3, wy*g + 2.7, wz*g + 5.1, seed) - 0.5);
            oy += a * (_noise(wx*g + 4.9, wy*g + 8.2, wz*g + 1.4, seed ^ 0x1f) - 0.5);
            oz += a * (_noise(wx*g + 7.6, wy*g + 3.3, wz*g + 9.8, seed ^ 0x3b) - 0.5);
        }
        const L = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
        out[0] = ox / L; out[1] = oy / L; out[2] = oz / L;
    }

    // Table-free fBm, for field version 2's smooth component.
    //
    // planet_renderer's base field samples a 32-cell lookup grid. On a whole
    // world that is invisible; at 130 km on an 11,200 km world the finest
    // octave has about THREE grid cells across the entire frame, so the table's
    // own cells appear as rectilinear blocks with trilinear edges. Hash noise
    // has no table and therefore no grid structure at any zoom.
    // Five octaves is plenty here: this is the PLANETARY component, and a
    // regional window gets its fine structure from the separate detail cascade.
    // Hash noise costs more per sample than a table lookup, and this runs per
    // pixel and 2,048 times again for the CDF, so depth is not free.
    function detailFbm(wx, wy, wz, seed, octaves, persistence, baseFreq) {
        const norm = 1 / (1 - persistence);
        let sum = 0, amp = 1, f = baseFreq || 4;
        for (let o = 0; o < octaves; o++) {
            sum += amp * _noise(wx * f, wy * f, wz * f, seed + o * 6091);
            amp *= persistence;
            f *= 2;
        }
        return sum / norm;
    }

    function _norm(v) {
        const L = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
        return [v[0] / L, v[1] / L, v[2] / L];
    }

    // ── Plate construction ───────────────────────────────────────────────────
    //
    // rng must be a seeded generator. Called once per world, from the same
    // '-cn' seed version 1 used for its continent seeds, so a world's plates
    // are as reproducible as everything else.
    function buildPlates(rng) {
        const count = 9 + Math.floor(rng() * 7);      // 9-15 plates
        const plates = [];
        plates.warpSeed = (rng() * 0x7fffffff) | 0;
        for (let i = 0; i < count; i++) {
            // Uniform on the sphere.
            const cosT = rng() * 2 - 1;
            const sinT = Math.sqrt(1 - cosT * cosT);
            const phi  = rng() * 2 * Math.PI;
            const c = [sinT * Math.cos(phi), cosT, sinT * Math.sin(phi)];

            // Motion: a random direction, made tangential at the plate's own
            // centre so it represents movement ACROSS the surface rather than
            // into it.
            const m = _norm([rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1]);
            const dot = m[0] * c[0] + m[1] * c[1] + m[2] * c[2];
            const v = _norm([m[0] - c[0] * dot, m[1] - c[1] * dot, m[2] - c[2] * dot]);

            plates.push({
                cx: c[0], cy: c[1], cz: c[2],
                vx: v[0], vy: v[1], vz: v[2],
                speed: 0.4 + rng() * 0.6,
                // Roughly 45% continental. Hydrographics still decides how much
                // of the surface is sea — the CDF remap guarantees that — so
                // this governs the SHAPE of the land, not its area.
                continental: rng() < 0.45,
                // Per-plate bias so same-type plates are not all identical.
                bias: (rng() - 0.5) * 0.10,
            });
        }
        return plates;
    }

    // ── Sampling ─────────────────────────────────────────────────────────────────────────
    //
    // Hot path: called for every pixel of every render, plus 2,048 times again
    // for the CDF. Avoids allocation and keeps to a handful of dot products.
    const _tmp = [0, 0, 0];

    // How wide the rank-free base blend is, in radians. At 0.145 two plates sit
    // about 90/10 some 0.16 rad inside a boundary, which matches the crossfade
    // width the old pairwise mix had — so the look is preserved.
    const SOFTMIN_K = 0.145;

    // How many nearest plates enter the blend, and the window over which a
    // plate's weight is TAPERED TO ZERO as it gets far away.
    //
    // The taper is what makes the truncation safe. Without it the NEAR-th and
    // (NEAR+1)-th plates swapping makes a small weight appear out of nothing,
    // which is the same class of discontinuity as the original wedge bug, just
    // smaller — measured at 0.045 before this was added. With it, any plate
    // beyond ANG_TAPER1 contributes exactly zero and arrives smoothly, so the
    // cut is invisible as long as the (NEAR+1)-th plate is reliably outside
    // ANG_TAPER1.
    //
    // NEAR WAS 6, AND 6 WAS NOT ENOUGH. The claim it rested on — that at 9-15
    // plates a seventh plate within 0.65 rad of the nearest does not occur —
    // is false, and the field was still discontinuous because of it. Found by
    // walking great circles at 60,000 samples, taking the largest step between
    // adjacent samples and bisecting it 30 times: a step that SURVIVES
    // bisection is a jump, one that shrinks with the interval is only a steep
    // gradient. The surviving jump measured 9.5e-3, and at the worst site the
    // seventh and eighth plates sat at da = 0.447 and 0.534 — both inside the
    // taper window, exactly the case the old comment ruled out.
    //
    // Raising NEAR: 8 gives 6.0e-4, 10 gives 4.4e-4, and 12 and 16 also give
    // 4.4e-4 — so 10 is converged, and costs 19% more per sample than 6.
    //
    // The 4.4e-4 that remains is the two early-outs below (`w <= 0.002` in
    // _boundaryDelta and `ww < 1e-5` here); removing both makes the field
    // continuous to 3.9e-13, but doubles the cost of a function that runs per
    // pixel and 2,048 more times per world for the CDF. 4.4e-4 is 0.16% of the
    // continental step, far below one shade in the render, so the cutoffs stay.
    const NEAR = 10;
    const ANG_TAPER0 = 0.45, ANG_TAPER1 = 0.65;
    const _idx = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const _ang = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const _wgt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // The BOUNDARY FEATURES contributed by one pair: the nearest plate A
    // against one other plate X. Returns a DELTA, added to the base that
    // sample() computes separately and rank-free.
    // SYMMETRIC IN I AND J. It orders the pair internally so that A is always
    // the nearer plate, which means _boundaryDelta(I,J) === _boundaryDelta(J,I)
    // exactly. That is what lets sample() sum over unordered pairs and get a
    // result no permutation of the ranking can change — the property the wedge
    // artefact came from lacking.
    function _boundaryDelta(I, J, angI, angJ, qx, qy, qz) {
        // Half the angular gap between the two centres is the distance to the
        // boundary between them; signed, so its sign says which side we are on.
        const signed = (angJ - angI) * 0.5;
        const dist = signed < 0 ? -signed : signed;

        // Boundary influence falls off as a Gaussian in angular distance.
        const t = dist / BOUNDARY_WIDTH;
        const w = Math.exp(-t * t);
        if (w <= 0.002) return 0;

        const A = signed >= 0 ? I : J;       // the nearer plate
        const X = signed >= 0 ? J : I;
        let d = 0;

        // Boundary normal: the tangential direction from A's centre toward
        // X's, taken at the sample point.
        let nx = X.cx - A.cx, ny = X.cy - A.cy, nz = X.cz - A.cz;
        const rad = nx * qx + ny * qy + nz * qz;
        nx -= qx * rad; ny -= qy * rad; nz -= qz * rad;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        // Relative motion across that normal. Positive means the plates are
        // closing; negative means they are separating. A relative motion that
        // is mostly ALONG the boundary leaves conv near zero, which is exactly
        // a transform fault — little vertical expression. Note conv is
        // unchanged by swapping A and X: both the velocity difference and the
        // normal reverse, so their dot product does not.
        const rvx = A.vx * A.speed - X.vx * X.speed;
        const rvy = A.vy * A.speed - X.vy * X.speed;
        const rvz = A.vz * A.speed - X.vz * X.speed;
        const conv = rvx * nx + rvy * ny + rvz * nz;

        // CONTINUITY. Crossing a boundary swaps which plate is A, so any term
        // that differs by side flips sign there. Weighting such a term by w
        // (which PEAKS at the boundary) therefore puts a cliff exactly along
        // every plate edge — which is what the first attempt did.
        //
        // Side-dependent features are instead weighted by `asym`, which is zero
        // at the boundary and rises into each plate's interior. That is
        // continuous across the swap, and it is also where those features
        // actually sit: a trench just off the margin, a volcanic arc just
        // inland of it.
        //
        // Pair-dependent features (both continental, both oceanic) are the same
        // viewed from either side, so they keep the symmetric weight and are
        // allowed to peak on the boundary itself.
        const at = dist / (BOUNDARY_WIDTH * 0.55);
        const asym = w * (at < 1 ? at * at * (3 - 2 * at) : 1);

        if (conv > 0) {
            if (A.continental && X.continental) {
                d += conv * UPLIFT_COLLISION * w;        // Himalayan plateau
            } else if (!A.continental && !X.continental) {
                d += conv * UPLIFT_ARC * 0.45 * w;       // island arc
            } else if (A.continental) {
                d += conv * UPLIFT_ARC * asym;           // arc, inland side
            } else {
                d -= conv * TRENCH_DEPTH * asym;         // trench, ocean side
            }
        } else {
            if (A.continental && X.continental) {
                d += conv * RIFT_DEPTH * w;              // conv<0 -> rift down
            } else if (!A.continental && !X.continental) {
                d -= conv * RIDGE_HEIGHT * w;            // conv<0 -> ridge up
            } else {
                d += conv * RIFT_DEPTH * 0.4 * asym;     // passive margin
            }
        }
        return d;
    }

    // Returns an elevation for a unit-sphere point.
    //
    // WHY THE BASE IS RANK-FREE (fixed 2026-09-14). The field used to be a
    // function of the nearest plate A and the SECOND-nearest plate B. That is
    // discontinuous: on the locus where the second- and third-nearest plates
    // are equidistant, B's identity flips, and with it both the base elevation
    // and the boundary normal — so the whole term jumps. Those loci are arcs
    // radiating out of every triple junction, which is exactly why the artefact
    // appeared as hard-edged WEDGES cutting across plate interiors on every
    // version-2 world image.
    //
    // Measured before the fix, on a 14-plate world at 1400x700 samples: the
    // largest step between adjacent samples was 1879x the median step. A smooth
    // field does not exceed roughly 50x.
    //
    // The base elevation — the term that colours whole regions, and so the one
    // that drew the wedges — is now a SOFTMIN blend over the nearest few plates
    // with weights depending only on distance, never on rank. Swapping two
    // plates' ranks cannot change a sum taken over both of them.
    //
    // The boundary FEATURES still use the (A, B) pair, because an arc and its
    // trench genuinely belong to one named pair of plates. They carry a
    // Gaussian that is ~0 away from a boundary, so their rank dependence can
    // only bite near a triple junction; there, the pair (A, C) is evaluated too
    // and the two are crossfaded as B and C approach a tie, which is symmetric
    // in B and C and therefore continuous.
    function sample(plates, wx, wy, wz) {
        _warp(wx, wy, wz, plates.warpSeed || 0, _tmp);
        const qx = _tmp[0], qy = _tmp[1], qz = _tmp[2];

        const n = plates.length;
        const k = n < NEAR ? n : NEAR;
        for (let a = 0; a < k; a++) { _idx[a] = 0; _ang[a] = -2; }
        for (let i = 0; i < n; i++) {
            const p = plates[i];
            const dot = qx * p.cx + qy * p.cy + qz * p.cz;
            for (let a = 0; a < k; a++) {
                if (dot > _ang[a]) {
                    for (let b = k - 1; b > a; b--) { _ang[b] = _ang[b - 1]; _idx[b] = _idx[b - 1]; }
                    _ang[a] = dot; _idx[a] = i;
                    break;
                }
            }
        }
        for (let a = 0; a < k; a++) {
            const c = _ang[a];
            _ang[a] = Math.acos(c < -1 ? -1 : (c > 1 ? 1 : c));
        }

        // Intra-plate relief. A plate interior of one flat value makes a large
        // share of the sphere share a near-identical height, which collapses
        // that part of the CDF into a plateau — and a percentile remap with
        // plateaus renders as stepped contour terracing under hillshading.
        // Real plate interiors carry cratons, basins and swells anyway.
        const swell = (_noise(wx * 2.6 + 31.7, wy * 2.6 + 12.4, wz * 2.6 + 55.1,
                              (plates.warpSeed || 0) ^ 0x5ab3) - 0.5) * 0.13;

        // Rank-free base. Offsetting by the nearest angle only keeps exp() in
        // range; it cancels in the normalisation.
        const angA = _ang[0];
        let wsum = 0, bsum = 0;
        for (let a = 0; a < k; a++) {
            const p = plates[_idx[a]];
            const da = _ang[a] - angA;
            let u = Math.exp(-da / SOFTMIN_K);
            if (da >= ANG_TAPER1) u = 0;
            else if (da > ANG_TAPER0) {
                const q = 1 - (da - ANG_TAPER0) / (ANG_TAPER1 - ANG_TAPER0);
                u *= q * q * (3 - 2 * q);
            }
            _wgt[a] = u;
            wsum += u;
            bsum += u * ((p.continental ? CONTINENT_BASE : OCEAN_BASE) + p.bias);
        }
        for (let a = 0; a < k; a++) _wgt[a] /= wsum;      // normalised, so the
        let h = bsum / wsum + swell;                      // pair weights are too

        // Continental margin taper (see SHELF_DROP). Two details matter:
        //
        // It is weighted by `cont`, the blended continental fraction, rather
        // than by a hard test on the nearest plate's own flag. A hard test
        // would switch off the moment the nearest plate changed, putting a
        // SHELF_DROP-sized cliff along every continent-ocean boundary — the
        // same mistake the side-dependent boundary features document below.
        // `cont` is built from the softmin weights, so it crosses a boundary
        // smoothly and the taper fades out with it.
        //
        // The distance used is the gap to the nearest boundary, half the
        // angular difference between the first and second nearest centres.
        // That is rank-free in the way that matters: the second-nearest ANGLE
        // is continuous even where the second and third nearest plates trade
        // places, because at the tie the two angles are equal.
        if (k > 1) {
            let cont = 0;
            for (let a = 0; a < k; a++) if (plates[_idx[a]].continental) cont += _wgt[a];
            let s = (_ang[1] - _ang[0]) * 0.5 / SHELF_WIDTH;
            if (s > 1) s = 1;
            h -= SHELF_DROP * cont * (1 - s * s * (3 - 2 * s));
        }

        if (k < 2) return h * RELIEF_GAIN;

        // Boundary features, summed over UNORDERED PAIRS of the nearest few
        // plates and weighted by the product of their own softmin weights. That
        // product peaks on the pair's shared boundary and falls to nothing when
        // some third plate is closer, and — crucially — it does not care which
        // plate is "first". Combined with _boundaryDelta being symmetric in its
        // arguments, the total is invariant under any permutation of the
        // ranking, so no tie anywhere can make it jump.
        //
        // The earlier attempt anchored every pair to the nearest plate A and
        // crossfaded (A,B) against (A,C). That removed the B/C tie but left the
        // A/B one: crossing an A-B boundary near a triple junction swapped the
        // SECONDARY pair from (A,C) to (B,C), which are different plates.
        // Measured: a 0.277 step surviving 14 bisections down to 5.5e-7 rad.
        let dsum = 0, dwsum = 0;
        for (let a = 0; a < k; a++) {
            for (let c = a + 1; c < k; c++) {
                const ww = _wgt[a] * _wgt[c];
                if (ww < 1e-5) continue;
                dwsum += ww;
                dsum += ww * _boundaryDelta(plates[_idx[a]], plates[_idx[c]],
                                            _ang[a], _ang[c], qx, qy, qz);
            }
        }
        return (dwsum > 0 ? h + dsum / dwsum : h) * RELIEF_GAIN;
    }

    return { buildPlates, sample, detailFbm, BOUNDARY_WIDTH };
})();

if (typeof window !== 'undefined') window.TerrainTectonics = TerrainTectonics;
