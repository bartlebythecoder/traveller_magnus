'use strict';

// =============================================================================
// TERRAIN_RIVERS.JS — Drainage networks (terrain field version 2)
//
// Rivers are a VECTOR OVERLAY, not terrain carving. That choice is what keeps
// the whole architecture intact: carving would require a global simulation
// baked into the height field, which would cost the pure-function property and
// with it zoom consistency, instant determinism and per-window evaluation.
//
// It is also what real maps do. At 150 m/px a river is sub-pixel, so it has to
// be drawn symbolically no matter how it was derived.
//
// The pipeline is the standard one, run once per world and cached in memory —
// never saved, because it is a pure function of the seed and recomputing is
// cheaper than storing:
//
//   1. sample the global field onto an equirectangular grid
//   2. PIT-FILL it, so every land cell has somewhere to drain
//   3. D8 flow directions
//   4. flow accumulation, weighted by true cell area
//   5. extract channels above a drainage threshold and trace them to the sea
//
// Output is polylines in lat/lon with a flow value per vertex, so they project
// into any window at any zoom and the world map and a regional map cannot
// disagree about where a river runs.
//
// Exposes: window.TerrainRivers
// =============================================================================

const TerrainRivers = (() => {

    const GRID_W = 1024;
    const GRID_H = 512;

    // A channel appears where drainage area exceeds this SHARE of the world's
    // surface. A fraction rather than absolute km2 so it ports across world
    // sizes: 60,000 km2 is a major river on an Earth-sized world and an
    // implausibly common one on a small moon.
    //
    // Earth for scale: the Thames drains ~16,000 km2 (0.003% of the surface),
    // the Rhine ~185,000 (0.036%), the Amazon ~7,000,000 (1.4%). At 0.012% a
    // world map carries its major rivers and not much else.
    const DEFAULT_DRAIN_FRACTION = 0.00012;

    // ── Minimal binary heap over (key, value) ────────────────────────────────
    function makeHeap(cap) {
        const key = new Float64Array(cap);
        const val = new Int32Array(cap);
        let n = 0;
        return {
            get size() { return n; },
            push(k, v) {
                let i = n++;
                key[i] = k; val[i] = v;
                while (i > 0) {
                    const p = (i - 1) >> 1;
                    if (key[p] <= key[i]) break;
                    const tk = key[p]; key[p] = key[i]; key[i] = tk;
                    const tv = val[p]; val[p] = val[i]; val[i] = tv;
                    i = p;
                }
            },
            pop() {
                const top = val[0];
                n--;
                if (n > 0) {
                    key[0] = key[n]; val[0] = val[n];
                    let i = 0;
                    for (;;) {
                        const l = i * 2 + 1, r = l + 1;
                        let m = i;
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

    // ── Network construction ────────────────────────────────────────────────
    //
    // opts: { seaLevel, planetRadiusKm, minDrainageKm2 }
    function buildNetwork(ctx, opts) {
        const GW = GRID_W, GH = GRID_H;
        const N = GW * GH;
        const seaLevel = opts.seaLevel;
        const R = opts.planetRadiusKm || 6400;
        const surfaceKm2 = 4 * Math.PI * R * R;
        const minDrain = opts.minDrainageKm2 ||
            surfaceKm2 * (opts.drainFraction || DEFAULT_DRAIN_FRACTION);

        // A world with no surface water has no rivers. Gate on HYDROGRAPHICS,
        // not on seaLevel: seaLevel is clamped to a 0.05 floor so the palette
        // has a low anchor, which is a rendering convenience and not a claim
        // that 5% of a desert world is ocean. Gating on the clamped value
        // produced a thousand rivers on a hydrographics-0 desert.
        const hydro = (opts.hydrographics !== undefined) ? opts.hydrographics : 10;
        if (hydro < 1) return { rivers: [], cells: 0, note: 'no surface water' };
        if (seaLevel <= 0.06) return { rivers: [], cells: 0, note: 'no sea' };

        const dLon = 2 * Math.PI / GW, dLat = Math.PI / GH;
        const h    = new Float32Array(N);
        const area = new Float32Array(GH);

        for (let y = 0; y < GH; y++) {
            const lat = Math.PI / 2 - (y + 0.5) * dLat;
            const cl = Math.cos(lat), sl = Math.sin(lat);
            area[y] = R * R * dLon * dLat * Math.max(0, cl);
            for (let x = 0; x < GW; x++) {
                const lon = (x + 0.5) * dLon - Math.PI;
                h[y * GW + x] = TerrainField.remapHeight(
                    TerrainField.continentHeight(ctx.grid, ctx.continentSeeds,
                        cl * Math.cos(lon), sl, cl * Math.sin(lon),
                        ctx.maskWeight, ctx.warpStrength, ctx.fieldVersion, ctx.plates),
                    ctx.cdf);
            }
        }

        // ── Pit fill (Priority-Flood) ───────────────────────────────────────
        // Without it noise terrain is riddled with local minima and rivers stop
        // in the middle of nowhere. Every sea cell is an outlet; land is raised
        // just enough to guarantee a downhill path to one.
        const filled = new Float32Array(h);
        const seen   = new Uint8Array(N);
        const heap   = makeHeap(N);
        let seaCells = 0;
        for (let i = 0; i < N; i++) {
            if (h[i] < seaLevel) { seen[i] = 1; seaCells++; heap.push(h[i], i); }
        }
        if (seaCells === 0) return { rivers: [], cells: 0, note: 'no sea cells' };

        const EPS = 1e-6;
        const nbr = new Int32Array(8);
        const nbrDist = new Float64Array(8);       // real ground distance, km
        // Row height is constant; row width shrinks with cos(lat).
        const rowKm = R * dLat;
        const colKm = new Float64Array(GH);
        for (let y = 0; y < GH; y++) {
            const raw = R * dLon * Math.cos(Math.PI / 2 - (y + 0.5) * dLat);
            // FLOOR the east-west spacing. Near a pole an equirectangular grid
            // packs columns arbitrarily close, so two neighbours are almost the
            // same place and the height difference between them is noise.
            // Dividing that noise by a near-zero distance yields a huge phantom
            // gradient, and every polar river runs dead east-west along a row.
            // Clamping keeps mid-latitudes exact and stops the degeneracy.
            colKm[y] = Math.max(raw, rowKm * 0.35);
        }

        function neighbours(i) {
            const y = (i / GW) | 0, x = i - y * GW;
            let c = 0;
            for (let dy = -1; dy <= 1; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= GH) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    nbr[c] = ny * GW + ((x + dx + GW) % GW);
                    // TRUE distance, not cell counts. On an equirectangular
                    // grid an east-west step near the pole is a tiny fraction
                    // of a north-south one, so ranking by raw drop sends every
                    // river racing along a row. That is what produced long
                    // axis-aligned channels across the polar regions.
                    const ex = dx * (colKm[y] + colKm[ny]) * 0.5;
                    const ey = dy * rowKm;
                    nbrDist[c] = Math.sqrt(ex * ex + ey * ey) || 1e-6;
                    c++;
                }
            }
            return c;
        }

        while (heap.size > 0) {
            const i = heap.pop();
            const c = neighbours(i);
            for (let k = 0; k < c; k++) {
                const j = nbr[k];
                if (seen[j]) continue;
                seen[j] = 1;
                if (filled[j] <= filled[i]) filled[j] = filled[i] + EPS;
                heap.push(filled[j], j);
            }
        }

        // ── D8 flow directions ──────────────────────────────────────────────
        const down = new Int32Array(N).fill(-1);
        for (let i = 0; i < N; i++) {
            if (filled[i] < seaLevel) continue;              // sea drains nowhere
            const c = neighbours(i);
            let best = -1, bestGrad = 0;
            for (let k = 0; k < c; k++) {
                const j = nbr[k];
                const drop = filled[i] - filled[j];
                if (drop <= 0) continue;
                const grad = drop / nbrDist[k];        // steepest GRADIENT
                if (grad > bestGrad) { bestGrad = grad; best = j; }
            }
            down[i] = best;
        }

        // ── Flow accumulation ───────────────────────────────────────────────
        // Process high to low so every cell's own catchment is complete before
        // it passes water on. Area-weighted, or polar cells would count for as
        // much as equatorial ones.
        const order = new Int32Array(N);
        for (let i = 0; i < N; i++) order[i] = i;
        const ordArr = Array.from(order);
        ordArr.sort((a, b) => filled[b] - filled[a]);

        const acc = new Float32Array(N);
        for (let i = 0; i < N; i++) acc[i] = area[(i / GW) | 0];
        for (const i of ordArr) {
            const d = down[i];
            if (d >= 0) acc[d] += acc[i];
        }

        // ── Channel extraction + tracing ────────────────────────────────────
        // Latitude beyond which channels are suppressed. The grid is most
        // distorted there, and on any world cold enough to matter those
        // regions are ice cap rather than running water.
        const maxLat = (opts.maxRiverLat !== undefined) ? opts.maxRiverLat : 78;
        const latOfRow = y => 90 - (y + 0.5) * (180 / GH);

        // How far each cell had to be RAISED to drain. A large value means the
        // cell sits inside a filled depression or flat, where the original
        // terrain carried no gradient at all and the path chosen across it is
        // an artefact of the fill order rather than of the landscape. Those
        // show up as long dead-straight channels marching across low ground.
        // A lake is not a river, so they are excluded.
        const maxFill = (opts.maxFillDepth !== undefined) ? opts.maxFillDepth : 0.003;

        const isChannel = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (filled[i] < seaLevel || acc[i] < minDrain) continue;
            if (Math.abs(latOfRow((i / GW) | 0)) > maxLat) continue;
            if (filled[i] - h[i] > maxFill) continue;
            isChannel[i] = 1;
        }

        // A head is a channel cell with no channel flowing into it.
        const hasUpstream = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (!isChannel[i]) continue;
            const d = down[i];
            if (d >= 0 && isChannel[d]) hasUpstream[d] = 1;
        }

        const cellLL = i => {
            const y = (i / GW) | 0, x = i - y * GW;
            return [90 - (y + 0.5) * (180 / GH), (x + 0.5) * (360 / GW) - 180];
        };

        const rivers = [];
        const visited = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (!isChannel[i] || hasUpstream[i]) continue;
            const pts = [];
            let cur = i, guard = 0;
            while (cur >= 0 && guard++ < GW * 4) {
                const [la, lo] = cellLL(cur);
                pts.push({ lat: la, lon: lo, flow: acc[cur] });
                // Stop once the water has reached the sea — but include that
                // cell so the river visibly meets the coast.
                if (filled[cur] < seaLevel) break;
                const already = visited[cur];
                visited[cur] = 1;
                // Joining a trunk that is already drawn: stop, the rest exists.
                if (already && pts.length > 1) break;
                cur = down[cur];
            }
            if (pts.length >= 3) rivers.push(pts);
        }

        // Longest and largest first, so a capped draw keeps the important ones.
        rivers.sort((a, b) => b[b.length - 1].flow - a[a.length - 1].flow);
        return {
            rivers,
            cells: N,
            gridW: GW, gridH: GH,
            minDrainageKm2: minDrain,
            maxFlow: rivers.length ? rivers[0][rivers[0].length - 1].flow : 0,
        };
    }

    // Cached per world: deterministic, so recomputing is the only cost of not
    // storing it, and storing it would put a derived artefact in the save file.
    function networkFor(ctx, opts) {
        const key = [opts.seaLevel, opts.planetRadiusKm, opts.minDrainageKm2,
                     opts.drainFraction, opts.hydrographics, ctx.fieldVersion].join('|');
        if (ctx._riverCache && ctx._riverCache.key === key) return ctx._riverCache.val;
        const val = buildNetwork(ctx, opts);
        ctx._riverCache = { key, val };
        return val;
    }

    // ── Local re-trace ───────────────────────────────────────────────────────
    //
    // The global network is ~39 km per cell. Projected into a 600 km window
    // that is 15 cells across, so it draws as a right-angle staircase that cuts
    // straight over ridges — the terrain beneath it is 600x finer. Unusable.
    //
    // So a regional window runs the same pipeline again on its OWN high
    // resolution elevation, and the global network contributes only what it is
    // good for: how much water enters the frame and where. The trunk therefore
    // stays where the world map put it while following the real valleys.
    //
    // A window is also free of the equirectangular distortion that plagues the
    // global pass: cells are square and uniform, so D8 behaves properly here.
    //
    // f    — a field from TerrainField.buildRegional
    // opts — { seaLevelM, inflow: [{x, y, flowKm2}], minShare }
    function localNetwork(f, opts) {
        const W = f.W, H = f.H, N = W * H;
        const elev = f.elev;
        const seaM = opts.seaLevelM;
        const cellKm = f.metresPerPx / 1000;
        const cellKm2 = cellKm * cellKm;

        // Float64, and an epsilon scaled to the data — NOT Float32 with a fixed
        // 1e-4. Local elevations are METRES and can reach ~15,000, where
        // float32's ULP is about 0.001: adding 1e-4 rounds to no change at all.
        // The fill then produced exact ties rather than a gradient, every
        // neighbour tested as "not lower", and flow died within a few cells.
        // Largest catchment in a 240,000 km2 window came out at 454 km2.
        //
        // The global pass is unaffected because it works in percentile units
        // near 1.0, where its 1e-6 epsilon is comfortably representable.
        const filled = new Float64Array(elev);
        const seen = new Uint8Array(N);
        const heap = makeHeap(N);
        const popOrder = new Int32Array(N);
        let popN = 0;

        // Outlets: anything below sea level, plus the whole border — water is
        // entitled to leave the frame, and an inland window has no sea at all.
        for (let i = 0; i < N; i++) {
            const y = (i / W) | 0, x = i - y * W;
            if (elev[i] < seaM || x === 0 || y === 0 || x === W - 1 || y === H - 1) {
                seen[i] = 1; heap.push(elev[i], i);
            }
        }
        // Scale-aware: always above the representable step at this magnitude.
        let maxAbs = 0;
        for (let i = 0; i < N; i++) { const a = Math.abs(elev[i]); if (a > maxAbs) maxAbs = a; }
        const EPS = Math.max(1e-4, maxAbs * 1e-9);
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

        // Routing surface = filled terrain plus a WHISPER of the original.
        //
        // Pit-filling makes a depression exactly level, so D8 has no gradient to
        // follow and ends up tracing the order the fill happened to visit cells
        // in. That is what draws long dead-straight channels marching across
        // low ground and over ridges.
        //
        // Adding a scaled copy of the true elevation breaks those ties using the
        // real micro-relief, so a channel crossing a flat follows the ground's
        // own shape. The term is deliberately tiny — larger than the fill's
        // epsilon, far smaller than any genuine drop — so it decides only where
        // the filled surface is otherwise flat.
        let eLo = Infinity, eHi = -Infinity;
        for (let i = 0; i < N; i++) {
            if (elev[i] < eLo) eLo = elev[i];
            if (elev[i] > eHi) eHi = elev[i];
        }
        const tie = (EPS * 50) / Math.max(1, eHi - eLo);
        const route = new Float64Array(N);
        for (let i = 0; i < N; i++) route[i] = filled[i] + (elev[i] - eLo) * tie;

        // D8. Cells are square here, so the only correction is the diagonal.
        const down = new Int32Array(N).fill(-1);
        for (let i = 0; i < N; i++) {
            const y = (i / W) | 0, x = i - y * W;
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
            let best = -1, bestGrad = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const j = (y + dy) * W + (x + dx);
                    const drop = route[i] - route[j];
                    if (drop <= 0) continue;
                    const g = drop / ((dx && dy) ? 1.41421356 : 1);
                    if (g > bestGrad) { bestGrad = g; best = j; }
                }
            }
            down[i] = best;
        }

        // Accumulation. The pit-fill popped cells low-to-high, so walking that
        // record backwards is high-to-low — no sort needed.
        const acc = new Float32Array(N).fill(cellKm2);
        const IN = 4;                        // keep clear of the outlet ring
        for (const inj of (opts.inflow || [])) {
            const x = Math.max(IN, Math.min(W - 1 - IN, Math.round(inj.x)));
            const y = Math.max(IN, Math.min(H - 1 - IN, Math.round(inj.y)));
            acc[y * W + x] += inj.flowKm2;      // water arriving from off-frame
        }
        for (let k = popN - 1; k >= 0; k--) {
            const i = popOrder[k], d = down[i];
            if (d >= 0) acc[d] += acc[i];
        }

        // Threshold as a share of the window, so density reads the same at any
        // zoom and finer tributaries appear as you close in — as on a real map.
        const winKm2 = N * cellKm2;
        const minAcc = Math.max(cellKm2 * 24, winKm2 * (opts.minShare || 0.012));
        // Depression tolerance relative to the window's own relief. A fixed
        // metre value is meaningless across worlds whose windows range from a
        // few hundred metres of relief to nearly twenty kilometres.
        const fillTol = Math.max(40, (f.elevMaxM - f.elevMinM) * 0.02);

        const isCh = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (elev[i] >= seaM && acc[i] >= minAcc && filled[i] - elev[i] < fillTol) isCh[i] = 1;
        }
        const hasUp = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (!isCh[i]) continue;
            const d = down[i];
            if (d >= 0 && isCh[d]) hasUp[d] = 1;
        }

        const lines = [];
        const visited = new Uint8Array(N);
        let maxFlow = 1;
        for (let i = 0; i < N; i++) {
            if (!isCh[i] || hasUp[i]) continue;
            const pts = [];
            let cur = i, guard = 0;
            while (cur >= 0 && guard++ < N) {
                const y = (cur / W) | 0, x = cur - y * W;
                pts.push({ x, y, flow: acc[cur] });
                if (acc[cur] > maxFlow) maxFlow = acc[cur];
                if (elev[cur] < seaM) break;
                const was = visited[cur];
                visited[cur] = 1;
                if (was && pts.length > 1) break;
                cur = down[cur];
            }
            if (pts.length >= 4) lines.push(smoothLine(pts, 2));
        }
        return { lines, maxFlow };
    }

    // Chaikin corner-cutting. A traced channel steps cell to cell, so raw it is
    // a pixel staircase; two rounds turn it into a curve without moving it far
    // enough to leave its own valley. Applied inside localNetwork so the carve
    // and the stroke use exactly the same geometry.
    function smoothLine(pts, iters) {
        let cur = pts;
        for (let n = 0; n < (iters || 2); n++) {
            if (cur.length < 3) break;
            const next = [cur[0]];
            for (let i = 0; i < cur.length - 1; i++) {
                const a = cur[i], b = cur[i + 1];
                next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25,
                            flow: a.flow * 0.75 + b.flow * 0.25 });
                next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75,
                            flow: a.flow * 0.25 + b.flow * 0.75 });
            }
            next.push(cur[cur.length - 1]);
            cur = next;
        }
        return cur;
    }

    // ── Carving ──────────────────────────────────────────────────────────────
    //
    // THE reason rivers otherwise read as lines painted over a picture: the
    // terrain has no idea they are there. Hillshading, cast shadows and ambient
    // occlusion are all computed from a surface with no channel in it, and a
    // blue stroke is laid on afterwards.
    //
    // Incising the channel BEFORE shading gives the river banks that catch the
    // light, a floor that ambient occlusion darkens, and ground low enough for
    // the material classifier to call it lowland. It is also honest: real
    // rivers carve their valleys, and this stands in for the erosion history
    // the field does not simulate.
    //
    // Must be called after localNetwork and before TerrainRender.shade.
    function carve(f, local, opts) {
        if (!local || !local.lines.length) return f;
        const W = f.W, H = f.H, elev = f.elev;
        const seaM = opts.seaLevelM;
        const relief = Math.max(50, f.elevMaxM - f.elevMinM);
        // Valley depth scales with the window's own relief, bounded so a
        // gentle world does not get canyons and a rugged one does not get a
        // scratch. Width follows flow, so trunks cut broader valleys.
        const maxDepth = Math.min(420, Math.max(25, relief * 0.020));
        const maxRad   = Math.max(2.5, Math.min(9, W / 190));

        // Deepest cut wins rather than accumulating, or confluences would dig
        // a pit where two channels overlap.
        const cut = new Float32Array(W * H);
        for (const ln of local.lines) {
            for (const pt of ln) {
                const t = Math.sqrt(Math.min(1, pt.flow / local.maxFlow));
                const depth = maxDepth * (0.30 + 0.70 * t);
                const rad = Math.max(1.2, maxRad * (0.35 + 0.65 * t));
                const r2 = rad * rad;
                const x0 = Math.max(0, Math.floor(pt.x - rad));
                const x1 = Math.min(W - 1, Math.ceil(pt.x + rad));
                const y0 = Math.max(0, Math.floor(pt.y - rad));
                const y1 = Math.min(H - 1, Math.ceil(pt.y + rad));
                for (let y = y0; y <= y1; y++) {
                    for (let x = x0; x <= x1; x++) {
                        const dx = x - pt.x, dy = y - pt.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 > r2) continue;
                        // Smooth profile: flat-ish floor, sloping banks.
                        const u = 1 - Math.sqrt(d2) / rad;
                        const w = u * u * (3 - 2 * u);
                        const v = depth * w;
                        const i = y * W + x;
                        if (v > cut[i]) cut[i] = v;
                    }
                }
            }
        }

        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < elev.length; i++) {
            if (cut[i] > 0) {
                // Never cut land below sea level: that would open fake inlets
                // all along the course instead of only at the mouth.
                elev[i] = Math.max(elev[i] >= seaM ? seaM : elev[i], elev[i] - cut[i]);
            }
            if (elev[i] < lo) lo = elev[i];
            if (elev[i] > hi) hi = elev[i];
        }
        f.elevMinM = lo; f.elevMaxM = hi;
        return f;
    }

    // Where does the global network enter this window, and carrying how much?
    function inflowFor(net, proj, W, H) {
        const out = [];
        if (!net || !net.rivers) return out;
        const inside = p => p.front && p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
        for (const riv of net.rivers) {
            let prevIn = false, prevPt = null;
            for (let i = 0; i < riv.length; i++) {
                const sp = proj.toScreen(riv[i].lat, riv[i].lon);
                const isIn = inside(sp);
                if (isIn && !prevIn && prevPt) {
                    // Crossed the frame edge. Inject WELL INSIDE it: the border
                    // ring is an outlet with no downstream, so water dropped
                    // exactly on the edge drains straight back out and never
                    // enters the window at all.
                    out.push({ x: sp.x, y: sp.y, flowKm2: riv[i].flow, margin: true });
                }
                prevIn = isIn; prevPt = sp;
            }
        }
        return out;
    }

    // Trace channels from the flow field the TERRAIN ITSELF was carved with.
    // Because it is the same field, a river is guaranteed to lie in its own
    // valley — which is exactly what a separately-computed overlay could not
    // promise.
    function linesFromField(f, opts) {
        if (!f.flow || !f.flowDown) return { lines: [], maxFlow: 1 };
        const W = f.W, H = f.H, N = W * H;
        const flow = f.flow, down = f.flowDown, elev = f.elev;
        const seaM = opts.seaLevelM;
        // A lake is water at ITS OWN level, not the planetary datum, so the
        // waterline varies per cell. Everything below treats "water" as this
        // local datum: a channel neither starts in a lake nor crosses one, and
        // a river that reaches one ends at its shore — the outlet stream below
        // the lake is traced separately, as a channel in its own right, which
        // is what it is.
        const lake = f.lakeLevel || null;
        const waterM = i => (lake && lake[i] > 0) ? lake[i] : seaM;
        const o = opts || {};
        // Threshold as a share of the window's cells, so channel density reads
        // the same at every zoom and finer tributaries appear as you close in.
        // Higher than it looks: at 0.6% of the window's cells a 960x640 frame
        // needs ~3,700 cells upstream before a channel is drawn, which keeps
        // the map to rivers rather than every rivulet.
        const minFlow = Math.max(60, N * (o.minShare || 0.006));

        const isCh = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (elev[i] >= waterM(i) && flow[i] >= minFlow) isCh[i] = 1;
        }
        const hasUp = new Uint8Array(N);
        for (let i = 0; i < N; i++) {
            if (!isCh[i]) continue;
            const d = down[i];
            if (d >= 0 && isCh[d]) hasUp[d] = 1;
        }
        // Every channel is traced to its OUTLET — the sea, or off the frame —
        // and never stopped early.
        //
        // Stopping a line when it met a cell another line had already used was
        // meant to end a tributary at its confluence. But whichever line was
        // traced first claimed the entire shared trunk down to the sea, so the
        // real trunk, traced later, was cut off at the point some minor
        // tributary joined it. The visible result was rivers that simply ended
        // in the middle of open ground — which water cannot do, and which is
        // what made the whole network read as drawn-on lines.
        //
        // Overlapping strokes along a shared trunk are invisible (identical
        // pixels, identical widths, since flow is read per cell), so the
        // redundancy costs nothing but a little drawing.
        const lines = [];
        let maxF = 1;
        for (let i = 0; i < N; i++) {
            if (!isCh[i] || hasUp[i]) continue;
            const pts = [];
            let cur = i, guard = 0;
            const onPath = new Set();
            while (cur >= 0 && guard++ < N) {
                if (onPath.has(cur)) break;          // cycle guard only
                onPath.add(cur);
                const y = (cur / W) | 0, x = cur - y * W;
                if (elev[cur] < waterM(cur)) {
                    // REACHED THE SEA. Ending on this cell's centre overshoots
                    // the waterline by up to a whole cell, and drawLocal's round
                    // cap and soft pad then push the stroke further still, so a
                    // river visibly ran a short way into its own estuary or lake.
                    // Interpolate to where the surface actually crosses sea level
                    // and stop there, so the line meets the coast exactly.
                    const p = pts[pts.length - 1];
                    if (p) {
                        const eHi = elev[p.y * W + p.x];
                        const span = eHi - elev[cur];
                        const u = span > 0
                            ? Math.max(0, Math.min(1, (eHi - waterM(cur)) / span)) : 1;
                        pts.push({ x: p.x + (x - p.x) * u,
                                   y: p.y + (y - p.y) * u,
                                   flow: flow[cur] });
                        if (flow[cur] > maxF) maxF = flow[cur];
                    }
                    break;
                }
                pts.push({ x, y, flow: flow[cur] });
                if (flow[cur] > maxF) maxF = flow[cur];
                cur = down[cur];
            }
            if (pts.length >= 4) lines.push(smoothLine(pts, 2));
        }
        return { lines, maxFlow: maxF };
    }

    // Draw a local network, which is already in pixel space.
    //
    // NOT a stroke laid over the finished image. The channels are rendered to
    // an offscreen mask with soft edges, then COMPOSITED into the plate while
    // picking up the terrain's own lighting at each pixel. That is what stops
    // them looking drawn on afterwards:
    //
    //   * colour comes from the world's shallow-water tone, so a river meets
    //     its own coastline without a seam — and an amber or violet sea gets
    //     amber or violet rivers
    //   * the water is multiplied by the local hillshade, so a river darkens
    //     in shadow and brightens in sun exactly as the ground around it does
    //   * coverage falls off across the width rather than ending at a hard
    //     edge, so the bank blends instead of cutting
    //   * tone runs shallow at the headwaters toward deep on the trunk
    function drawLocal(ctx2d, local, opts) {
        if (!local || !local.lines.length) return 0;
        const o = opts || {};
        const shallow = o.shallow || [92, 128, 158];
        const deep = o.deep || shallow;
        const scale = o.widthScale || 1;
        const W = ctx2d.canvas.width, H = ctx2d.canvas.height;

        const off = document.createElement('canvas');
        off.width = W; off.height = H;
        const g = off.getContext('2d');
        g.lineCap = 'round';
        g.lineJoin = 'round';

        // Three passes, widest and faintest first: a cheap soft edge without
        // needing a blur.
        const passes = [
            { pad: 2.6 * scale, alpha: 0.22 },
            { pad: 1.3 * scale, alpha: 0.45 },
            { pad: 0.0,         alpha: 1.00 },
        ];
        let n = 0;
        for (const ps of passes) {
            g.globalAlpha = ps.alpha;
            for (const ln of local.lines) {
                for (let k = 1; k < ln.length; k++) {
                    const a = ln[k - 1], b = ln[k];
                    const t = Math.sqrt(Math.min(1, ((a.flow + b.flow) * 0.5) / local.maxFlow));
                    // Headwater -> trunk runs shallow -> deep.
                    const m = Math.min(1, t * 1.3);
                    g.strokeStyle = 'rgb(' +
                        Math.round(shallow[0] + (deep[0] - shallow[0]) * m) + ',' +
                        Math.round(shallow[1] + (deep[1] - shallow[1]) * m) + ',' +
                        Math.round(shallow[2] + (deep[2] - shallow[2]) * m) + ')';
                    g.lineWidth = Math.max(0.6, t * 2.8 * scale) + ps.pad;
                    g.beginPath();
                    g.moveTo(a.x, a.y);
                    g.lineTo(b.x, b.y);
                    g.stroke();
                }
                if (ps.alpha === 1) n++;
            }
        }
        g.globalAlpha = 1;

        // Composite, carrying the terrain's shading into the water.
        const plate = ctx2d.getImageData(0, 0, W, H);
        const riv = g.getImageData(0, 0, W, H);
        const pd = plate.data, rd = riv.data;
        // Mean luminance of the plate gives the shading a neutral point, so a
        // dark icy map and a bright desert one both read correctly.
        let sum = 0;
        for (let i = 0; i < pd.length; i += 4) sum += (pd[i] + pd[i+1] + pd[i+2]) / 3;
        const mean = Math.max(1, sum / (pd.length / 4));

        const strength = o.strength !== undefined ? o.strength : 0.92;
        for (let i = 0; i < pd.length; i += 4) {
            const a = rd[i + 3] / 255;
            if (a <= 0.002) continue;
            const lum = (pd[i] + pd[i+1] + pd[i+2]) / 3;
            // Local lighting, bounded so deep shade does not turn water black
            // and a snowfield does not blow it out.
            const shade = Math.max(0.45, Math.min(1.35, lum / mean));
            const k = a * strength;
            pd[i]     = pd[i]     * (1 - k) + rd[i]     * shade * k;
            pd[i + 1] = pd[i + 1] * (1 - k) + rd[i + 1] * shade * k;
            pd[i + 2] = pd[i + 2] * (1 - k) + rd[i + 2] * shade * k;
        }
        ctx2d.putImageData(plate, 0, 0);
        return n;
    }

    return { buildNetwork, networkFor, draw, localNetwork, inflowFor, drawLocal,
             linesFromField,
             carve, smoothLine,
             GRID_W, GRID_H,
             DEFAULT_DRAIN_FRACTION };
})();

if (typeof window !== 'undefined') window.TerrainRivers = TerrainRivers;
