'use strict';

// =============================================================================
// TERRAIN_NAMES.JS — Named surface features (v0.18 spike)
//
// Two jobs:
//   1. FIND features — connected regions of the global base field big enough to
//      deserve a name.
//   2. NAME them — a seeded syllable generator, NOT `names.js`.
//
// Why not names.js: it is a finite curated list, and it belongs to WORLDS. A
// 400-world sector wanting ~20 features each needs 8,000 names, so drawing from
// that list would exhaust it and would repeat the same name across unrelated
// planets. A generator is unlimited and collision-free, which removes budget as
// a design constraint entirely — the size cutoff below is therefore about map
// legibility and referee usefulness, nothing else.
//
// DETECTION IS WORLD-ANCHORED, NEVER VIEW-ANCHORED. Features are found once, on
// the global base field at a FIXED canonical grid, independent of render
// resolution or window width. A view-relative cutoff ("label anything covering
// >5% of frame") would name a mountain at one zoom and not at another, and
// could give it a different name each time — the same mistake the landform
// scaling had before it was anchored to the world.
//
// Names are STATELESS: name = f(seed, hexId, body, centroid, class). Nothing is
// stored, and the same feature always resolves to the same name.
//
// Exposes: window.TerrainNames
// =============================================================================

const TerrainNames = (() => {

    // Canonical detection grid. Fixed forever — changing it moves centroids,
    // which changes the name hash, which renames every feature on every world.
    const GRID_W = 480;
    const GRID_H = 240;

    // A feature must cover at least this share of the world's surface to be
    // named at all. Calibration against Earth: Mediterranean 0.5%, Sahara 1.8%,
    // Himalaya 0.12%, Caspian 0.07%.
    const MIN_SHARE = 0.001;

    // Per-class ceilings. These exist to bound work and keep a world's set of
    // names memorable — NOT to prevent map clutter. Clutter is handled entirely
    // by the display rule (coverage threshold and max-labels-per-map), so the
    // caps can afford to be generous.
    //
    // They were half this, and splitting the world ocean into six consumed the
    // whole sea budget, which then crowded out genuinely distinct mid-size land
    // features. Windows landed on unnamed ground and drew no labels at all.
    const CAPS = { sea: 10, range: 10, upland: 10, lowland: 10 };

    // ── Name generator ───────────────────────────────────────────────────────
    // Tuned to the consonant clusters and vowel runs of Traveller place names
    // (Kteiroa, Ulkaodhianeak, Ftearl, Khrang, Stross, Oaiftau, Drinax).

    // Only the FIRST onset may be a heavy cluster and carry a capital. Reusing
    // this set for interior syllables produced capitals mid-word and 17-letter
    // monsters like "NyieStreinSkuerth".
    const ONSET_FIRST = ['', 'B', 'D', 'F', 'G', 'H', 'K', 'L', 'M', 'N', 'P',
        'R', 'S', 'T', 'V', 'Z', 'Br', 'Dr', 'Fr', 'Gr', 'Kr', 'Pr', 'Tr', 'Vr',
        'Bl', 'Fl', 'Gl', 'Kl', 'Sl', 'Kh', 'Th', 'Sh', 'Ch', 'St', 'Sp', 'Sk',
        'Ft', 'Kt', 'Str', 'Thr', 'Zh', 'Ts', 'Ny'];

    // Interior onsets are light and lower-case — one or two letters only.
    const ONSET_MID = ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'r', 's', 't', 'v', 'z',
        'th', 'sh', 'kh', 'ch', 'dr', 'br', 'tr', 'gr', 'st', 'nd', 'ng', 'rr'];

    // Diphthongs are used sparingly — one vowel run per word reads as a name,
    // three in a row reads as noise ("Xaausfluilstaourl").
    const VOWEL = ['a', 'e', 'i', 'o', 'u'];
    const DIPH  = ['ae', 'ai', 'au', 'ea', 'ei', 'eo', 'ia', 'ie', 'io', 'oa',
                   'oi', 'ou', 'ua', 'ui'];

    const CODA_END = ['', '', 'n', 'r', 'l', 's', 'th', 'sh', 'ng', 'rn', 'rl',
        'st', 'sk', 'nd', 'rk', 'ss', 'gh', 'kh', 'x', 'z', 'm'];

    function pick(arr, rng) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

    // Target 5-10 characters, matching the register of Traveller place names
    // (Kteiroa, Ftearl, Khrang, Stross, Saegh, Drinax).
    function makeWord(rng) {
        const syllables = rng() < 0.62 ? 2 : 3;
        let w = pick(ONSET_FIRST, rng);
        let usedDiph = false;
        for (let i = 0; i < syllables; i++) {
            if (i > 0) w += pick(ONSET_MID, rng);
            if (!usedDiph && rng() < 0.42) { w += pick(DIPH, rng); usedDiph = true; }
            else                           { w += pick(VOWEL, rng); }
        }
        w += pick(CODA_END, rng);
        w = w.charAt(0).toUpperCase() + w.slice(1);
        // Collapse any accidental run of three identical letters.
        return w.replace(/(.)\1\1+/g, '$1$1');
    }

    // ── Feature vocabulary ───────────────────────────────────────────────────
    // Classes are STRUCTURAL (sea / range / upland / lowland) and world-type
    // independent; only the wording changes. That keeps detection uniform while
    // an ice world still reads as ice and a desert reads as desert.

    // Each list is ordered GRANDEST FIRST and split in half by feature size:
    // something covering half a world should not be called a "Pack" or a "Vale".
    const VOCAB = {
        standard: {
            sea:     ['Ocean', 'Sea', 'Great Deep', 'Gulf', 'Reach', 'Sound'],
            range:   ['Range', 'Mountains', 'Great Massif', 'Ridge', 'Spine', 'Crags'],
            upland:  ['Highlands', 'Plateau', 'Great Uplands', 'Heights', 'Tableland', 'Rise'],
            lowland: ['Great Plains', 'Basin', 'Lowlands', 'Flats', 'Vale', 'Downs'],
        },
        ice: {
            sea:     ['Frozen Ocean', 'Frozen Sea', 'Ice Sea', 'Pack', 'Frozen Reach', 'Ice Gulf'],
            range:   ['Range', 'Mountains', 'Great Massif', 'Ridge', 'Spine', 'Crags'],
            upland:  ['Icefields', 'Glacier', 'Great Heights', 'Plateau', 'Rise', 'Shelf'],
            lowland: ['Great Ice Sheet', 'Ice Sheet', 'Wastes', 'Barrens', 'Flats', 'Hollow'],
        },
        desert: {
            sea:     ['Great Dry Sea', 'Dry Sea', 'Salt Sea', 'Salt Flats', 'Pan', 'Sink'],
            range:   ['Range', 'Mountains', 'Great Escarpment', 'Ridge', 'Scarp', 'Crags'],
            upland:  ['Highlands', 'Plateau', 'Great Mesas', 'Tableland', 'Bench', 'Rise'],
            lowland: ['Great Sands', 'Sands', 'Erg', 'Waste', 'Depression', 'Pan'],
        },
        // Cold dry world (terrain model 2). Without an entry here it would fall
        // back to `standard` and be handed Oceans and Great Plains, which is
        // wrong twice over on a world with no liquid and no vegetation.
        cold_desert: {
            sea:     ['Great Frozen Basin', 'Frozen Basin', 'Ice Pan', 'Sink', 'Hollow', 'Trough'],
            range:   ['Range', 'Mountains', 'Great Scarp', 'Ridge', 'Scarp', 'Crags'],
            upland:  ['Highlands', 'Frost Plateau', 'Great Tableland', 'Bench', 'Rise', 'Heights'],
            lowland: ['Great Barrens', 'Barrens', 'Frost Flats', 'Waste', 'Pan', 'Hollow'],
        },
        rock: {
            sea:     ['Great Basin', 'Mare', 'Deep Basin', 'Depression', 'Sink', 'Hollow'],
            range:   ['Range', 'Mountains', 'Great Rupes', 'Massif', 'Ridge', 'Scarp'],
            upland:  ['Terra', 'Highlands', 'Great Plateau', 'Bench', 'Rise', 'Dorsa'],
            lowland: ['Planitia', 'Great Plains', 'Mare', 'Plains', 'Basin', 'Hollow'],
        },
        molten: {
            sea:     ['Lava Ocean', 'Lava Sea', 'Magma Basin', 'Fire Reach', 'Sink', 'Pool'],
            range:   ['Range', 'Great Ridge', 'Spine', 'Ridge', 'Crags', 'Scarp'],
            upland:  ['Great Shield', 'Shield', 'Heights', 'Dome', 'Rise', 'Bench'],
            lowland: ['Great Flows', 'Flows', 'Caldera Field', 'Plains', 'Sink', 'Hollow'],
        },
        exotic_dry: {
            sea:     ['Great Sink', 'Dry Basin', 'Sink', 'Pan', 'Hollow', 'Trough'],
            range:   ['Range', 'Mountains', 'Great Ridge', 'Ridge', 'Scarp', 'Crags'],
            upland:  ['Highlands', 'Great Plateau', 'Plateau', 'Heights', 'Rise', 'Bench'],
            lowland: ['Great Barrens', 'Plains', 'Barrens', 'Waste', 'Flats', 'Hollow'],
        },
        exotic_wet: {
            sea:     ['Ocean', 'Sea', 'Great Mere', 'Mere', 'Reach', 'Sound'],
            range:   ['Range', 'Mountains', 'Great Spine', 'Spine', 'Ridge', 'Crags'],
            upland:  ['Highlands', 'Great Plateau', 'Plateau', 'Heights', 'Rise', 'Bench'],
            lowland: ['Great Basin', 'Basin', 'Lowlands', 'Plains', 'Flats', 'Vale'],
        },
    };

    // Name is derived, never stored. The centroid is quantised so that tiny
    // numerical drift cannot rename a feature.
    function nameFor(masterSeed, hexId, bodyName, cls, latDeg, lonDeg, worldType, grand) {
        const key = [masterSeed || 'default', hexId || '0000', bodyName || 'w0', cls,
                     latDeg.toFixed(1), lonDeg.toFixed(1)].join('|');
        const rng = mulberry32(hashString(key));
        const full = (VOCAB[worldType] || VOCAB.standard)[cls] || ['Region'];
        // Tier by RANK within class, set by the caller — not by an absolute
        // share. Splitting large regions makes nearly every feature 4-8% of the
        // world, so a fixed threshold put almost everything in the lesser tier
        // and the grand words were never used at all.
        const half = Math.max(1, Math.ceil(full.length / 2));
        let vocab = grand ? full.slice(0, half) : full.slice(half);
        if (!vocab.length) vocab = full;
        const word = makeWord(rng);
        const suffix = vocab[Math.floor(rng() * vocab.length) % vocab.length];
        return `${word} ${suffix}`;
    }

    // ── Feature detection ────────────────────────────────────────────────────

    // Connected-component labelling with longitude wraparound. Rows 0 and H-1
    // wrap in x, so a polar cap comes out as a single connected ring rather
    // than a string of separate slivers.
    function _components(cls, GW, GH) {
        const label = new Int32Array(GW * GH).fill(-1);
        const stack = new Int32Array(GW * GH);
        const regions = [];
        for (let start = 0; start < cls.length; start++) {
            if (label[start] !== -1 || cls[start] < 0) continue;
            const id = regions.length;
            const want = cls[start];
            let sp = 0, count = 0;
            stack[sp++] = start;
            label[start] = id;
            const cells = [];
            while (sp > 0) {
                const i = stack[--sp];
                cells.push(i);
                count++;
                const y = (i / GW) | 0, x = i - y * GW;
                const nb = [
                    y * GW + ((x + 1) % GW),
                    y * GW + ((x - 1 + GW) % GW),
                    (y > 0      ? (y - 1) * GW + x : -1),
                    (y < GH - 1 ? (y + 1) * GW + x : -1),
                ];
                for (const j of nb) {
                    if (j < 0) continue;
                    if (label[j] === -1 && cls[j] === want) {
                        label[j] = id;
                        stack[sp++] = j;
                    }
                }
            }
            regions.push({ cls: want, cells, count });
        }
        return regions;
    }

    // ── Splitting oversized regions ──────────────────────────────────────────
    //
    // Flood-fill on a binary class yields a few enormous blobs, not many named
    // features: an ocean comes back as ONE region 20,000 km across. Earth does
    // not work that way — one connected world ocean carries five names. So any
    // region above SPLIT_ABOVE is divided into k parts, each of which is named
    // separately.
    //
    // k-means over the region's cells as unit vectors, weighted by true cell
    // area so polar cells do not drag the result. Seeding is farthest-point and
    // fully deterministic — no RNG — so the same world always splits the same
    // way and therefore always produces the same names.

    const SPLIT_ABOVE  = 0.05;   // split anything over 5% of the world
    const TARGET_SHARE = 0.035;  // aim each part at roughly this size

    function _splitRegion(cells, k, GW, dLat, dLon, areaByRow) {
        const n = cells.length;
        if (k <= 1 || n <= k) return [cells];

        const vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
        const wt = new Float64Array(n);
        for (let t = 0; t < n; t++) {
            const i = cells[t];
            const y = (i / GW) | 0, x = i - y * GW;
            const lat = Math.PI / 2 - (y + 0.5) * dLat;
            const lon = (x + 0.5) * dLon - Math.PI;
            const cl = Math.cos(lat);
            vx[t] = cl * Math.cos(lon);
            vy[t] = Math.sin(lat);
            vz[t] = cl * Math.sin(lon);
            wt[t] = areaByRow[y];
        }

        // Seed 0: the cell farthest from the region's own centre. Subsequent
        // seeds: farthest from every seed chosen so far.
        let mx = 0, my = 0, mz = 0;
        for (let t = 0; t < n; t++) { mx += vx[t] * wt[t]; my += vy[t] * wt[t]; mz += vz[t] * wt[t]; }
        let ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
        mx /= ml; my /= ml; mz /= ml;

        const sx = new Float64Array(k), sy = new Float64Array(k), sz = new Float64Array(k);
        const best = new Float64Array(n).fill(Infinity);
        let worst = -1, worstDot = 2;
        for (let t = 0; t < n; t++) {
            const d = vx[t] * mx + vy[t] * my + vz[t] * mz;
            if (d < worstDot) { worstDot = d; worst = t; }
        }
        sx[0] = vx[worst]; sy[0] = vy[worst]; sz[0] = vz[worst];
        for (let j = 1; j < k; j++) {
            let pick = 0, pickVal = -Infinity;
            for (let t = 0; t < n; t++) {
                const d = 1 - (vx[t] * sx[j - 1] + vy[t] * sy[j - 1] + vz[t] * sz[j - 1]);
                if (d < best[t]) best[t] = d;
                if (best[t] > pickVal) { pickVal = best[t]; pick = t; }
            }
            sx[j] = vx[pick]; sy[j] = vy[pick]; sz[j] = vz[pick];
        }

        // Lloyd iterations. Nearest centre by greatest dot product.
        const assign = new Int32Array(n);
        for (let iter = 0; iter < 12; iter++) {
            for (let t = 0; t < n; t++) {
                let bestJ = 0, bestD = -Infinity;
                for (let j = 0; j < k; j++) {
                    const d = vx[t] * sx[j] + vy[t] * sy[j] + vz[t] * sz[j];
                    if (d > bestD) { bestD = d; bestJ = j; }
                }
                assign[t] = bestJ;
            }
            const ax = new Float64Array(k), ay = new Float64Array(k), az = new Float64Array(k);
            for (let t = 0; t < n; t++) {
                const j = assign[t], w = wt[t];
                ax[j] += vx[t] * w; ay[j] += vy[t] * w; az[j] += vz[t] * w;
            }
            for (let j = 0; j < k; j++) {
                const L = Math.sqrt(ax[j] * ax[j] + ay[j] * ay[j] + az[j] * az[j]);
                if (L > 1e-12) { sx[j] = ax[j] / L; sy[j] = ay[j] / L; sz[j] = az[j] / L; }
            }
        }

        const parts = [];
        for (let j = 0; j < k; j++) parts.push([]);
        for (let t = 0; t < n; t++) parts[assign[t]].push(cells[t]);
        return parts.filter(p => p.length > 0);
    }

    // opts: { worldType, seaLevel, planetRadiusKm, masterSeed, hexId, bodyName,
    //         minShare, caps }
    function findFeatures(ctx, opts) {
        const GW = GRID_W, GH = GRID_H;
        const R  = opts.planetRadiusKm || 4000;
        const seaLevel = opts.seaLevel;
        const worldType = opts.worldType || 'standard';
        const minShare = opts.minShare !== undefined ? opts.minShare : MIN_SHARE;
        const caps = Object.assign({}, CAPS, opts.caps || {});

        // Sample the global base field — identical to what the whole-world map
        // draws, so a named range is a range you can see on that map too.
        const h    = new Float32Array(GW * GH);
        const area = new Float32Array(GH);          // cell area by row, km²
        const dLon = 2 * Math.PI / GW, dLat = Math.PI / GH;
        for (let y = 0; y < GH; y++) {
            const lat = Math.PI / 2 - (y + 0.5) * dLat;
            const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
            area[y] = R * R * dLon * dLat * Math.max(0, cosLat);
            for (let x = 0; x < GW; x++) {
                const lon = (x + 0.5) * dLon - Math.PI;
                h[y * GW + x] = TerrainField.remapHeight(
                    TerrainField.continentHeight(ctx.grid, ctx.continentSeeds,
                        cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon),
                        ctx.maskWeight, ctx.warpStrength, ctx.fieldVersion, ctx.plates), ctx.cdf);
            }
        }

        // Base-field slope, in height-units per km, for range detection.
        const slope = new Float32Array(GW * GH);
        for (let y = 0; y < GH; y++) {
            const lat = Math.PI / 2 - (y + 0.5) * dLat;
            const kmPerCellX = Math.max(1, R * dLon * Math.cos(lat));
            const kmPerCellY = R * dLat;
            for (let x = 0; x < GW; x++) {
                const xp = y * GW + ((x + 1) % GW), xm = y * GW + ((x - 1 + GW) % GW);
                const yp = Math.min(GH - 1, y + 1) * GW + x;
                const ym = Math.max(0, y - 1) * GW + x;
                const gx = (h[xp] - h[xm]) / (2 * kmPerCellX);
                const gy = (h[yp] - h[ym]) / (2 * kmPerCellY);
                slope[y * GW + x] = Math.sqrt(gx * gx + gy * gy);
            }
        }

        // Adaptive thresholds from the world's own distributions. An absolute
        // cut-off would give a smooth world no ranges at all and a rugged one
        // nothing but ranges; percentiles guarantee every world has some of each.
        const landSlopes = [], landHeights = [];
        for (let i = 0; i < h.length; i++) {
            if (h[i] >= seaLevel) { landSlopes.push(slope[i]); landHeights.push(h[i]); }
        }
        landSlopes.sort((a, b) => a - b);
        landHeights.sort((a, b) => a - b);
        const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1,
            Math.floor(arr.length * p))] : 0;
        const slopeCut  = pct(landSlopes, 0.82);
        const heightCut = pct(landHeights, 0.65);

        // Structural class per cell.
        const CLS = { sea: 0, range: 1, upland: 2, lowland: 3 };
        const NAMES_BY_ID = ['sea', 'range', 'upland', 'lowland'];
        const cls = new Int8Array(GW * GH);
        for (let i = 0; i < h.length; i++) {
            if (h[i] < seaLevel)            cls[i] = CLS.sea;
            else if (slope[i] > slopeCut)   cls[i] = CLS.range;
            else if (h[i] > heightCut)      cls[i] = CLS.upland;
            else                            cls[i] = CLS.lowland;
        }

        const totalArea = 4 * Math.PI * R * R;
        const rawRegions = _components(cls, GW, GH);

        // Expand oversized regions into parts. Sizing k by the class cap means a
        // world ocean fills its naming budget with real subdivisions rather than
        // consuming one slot and leaving the rest idle.
        const regions = [];
        for (const reg of rawRegions) {
            let a = 0;
            for (const i of reg.cells) a += area[(i / GW) | 0];
            const share = a / totalArea;
            // Only reject specks here. The real qualification needs EXTENT,
            // which is not known until the centroid is computed below.
            if (reg.cells.length < 20) continue;
            if (share > SPLIT_ABOVE) {
                const clsName0 = ['sea', 'range', 'upland', 'lowland'][reg.cls];
                const k = Math.max(2, Math.min(caps[clsName0] || 6,
                                               Math.ceil(share / TARGET_SHARE)));
                for (const part of _splitRegion(reg.cells, k, GW, dLat, dLon, area)) {
                    regions.push({ cls: reg.cls, cells: part });
                }
            } else {
                regions.push(reg);
            }
        }

        const out = [];

        for (const reg of regions) {
            // Area-weighted centroid in 3-D, then back to lat/lon. Averaging
            // longitude directly breaks for anything crossing the antimeridian.
            let ax = 0, ay = 0, az = 0, aSum = 0;
            for (const i of reg.cells) {
                const y = (i / GW) | 0, x = i - y * GW;
                const lat = Math.PI / 2 - (y + 0.5) * dLat;
                const lon = (x + 0.5) * dLon - Math.PI;
                const w = area[y];
                const cl = Math.cos(lat);
                ax += cl * Math.cos(lon) * w;
                ay += Math.sin(lat) * w;
                az += cl * Math.sin(lon) * w;
                aSum += w;
            }
            if (aSum <= 0) continue;
            const share = aSum / totalArea;

            const L = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
            const cx = ax / L, cy = ay / L, cz = az / L;
            const latDeg = Math.asin(Math.max(-1, Math.min(1, cy))) * 180 / Math.PI;
            const lonDeg = Math.atan2(cz, cx) * 180 / Math.PI;

            // Extent = greatest angular distance from the centroid, doubled.
            let maxAng = 0;
            for (const i of reg.cells) {
                const y = (i / GW) | 0, x = i - y * GW;
                const lat = Math.PI / 2 - (y + 0.5) * dLat;
                const lon = (x + 0.5) * dLon - Math.PI;
                const cl = Math.cos(lat);
                const d = cx * cl * Math.cos(lon) + cy * Math.sin(lat) + cz * cl * Math.sin(lon);
                const ang = Math.acos(Math.max(-1, Math.min(1, d)));
                if (ang > maxAng) maxAng = ang;
            }

            const extentKm = 2 * maxAng * R;

            // Qualify on AREA or on LENGTH. Area alone systematically excludes
            // mountain ranges, which are inherently thin: a 700 km range 80 km
            // wide is 0.03% of an 8,000 km world, far under any sensible area
            // floor, yet it is the most recognisable landmark on the map. This
            // was not hypothetical — the site-finder targets high-relief ground,
            // i.e. precisely those ranges, so the best locations were reliably
            // the unnamed ones.
            const circumferenceKm = 2 * Math.PI * R;
            const extentFloorKm = 0.035 * circumferenceKm;
            if (share < minShare && extentKm < extentFloorKm) continue;

            const clsName = NAMES_BY_ID[reg.cls];
            out.push({
                cells: reg.cells,
                cls: clsName,
                latDeg, lonDeg,
                areaKm2: aSum,
                share,
                extentKm,
                angularRadius: maxAng,
            });
        }

        // Largest first, then apply the per-class ceiling.
        out.sort((a, b) => b.share - a.share);
        const used = {};
        const kept = [];
        for (const f of out) {
            used[f.cls] = (used[f.cls] || 0);
            if (used[f.cls] >= (caps[f.cls] || 99)) continue;
            used[f.cls]++;
            kept.push(f);
        }

        // Name only once ranks are known: within each class the larger half take
        // grand terms, the smaller half lesser ones.
        const byCls = {};
        for (const f of kept) (byCls[f.cls] = byCls[f.cls] || []).push(f);
        for (const cn in byCls) {
            const list = byCls[cn];                 // already sorted largest first
            const halfN = Math.ceil(list.length / 2);
            list.forEach((f, i) => {
                f.label = nameFor(opts.masterSeed, opts.hexId, opts.bodyName,
                                  f.cls, f.latDeg, f.lonDeg, worldType, i < halfN);
            });
        }

        // Membership map over the canonical grid: cell -> index into `kept`.
        //
        // Callers need this to ask "does this feature actually appear in my
        // window?". Comparing bounding circles instead is wrong for anything
        // sprawling: an ocean wrapping most of a world has a bounding radius
        // covering the whole sphere, so it would be labelled on maps of inland
        // terrain it never touches.
        const membership = new Int32Array(GW * GH).fill(-1);
        for (let k = 0; k < kept.length; k++) {
            for (const i of kept[k].cells) membership[i] = k;
            delete kept[k].cells;          // drop the bulk once mapped
        }
        kept.membership = membership;
        return kept;
    }

    // Cached per world+body, since detection is a pure function of the seed.
    function featuresFor(ctx, opts) {
        const key = [opts.masterSeed, opts.hexId, opts.bodyName, opts.worldType,
                     opts.seaLevel, opts.planetRadiusKm, opts.minShare].join('|');
        if (ctx._featureCache && ctx._featureCache.key === key) return ctx._featureCache.val;
        const val = findFeatures(ctx, opts);
        ctx._featureCache = { key, val };
        return val;
    }

    return { findFeatures, featuresFor, nameFor, makeWord,
             MIN_SHARE, CAPS, GRID_W, GRID_H, VOCAB };
})();

window.TerrainNames = TerrainNames;
