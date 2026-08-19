// =====================================================================
// ROUTES.JS — Interstellar Route Generation (X-Boat & Trade)
// Depends on: core.js (hexStates, getHexDistance, getHexCoords,
//             window.sectorRoutes)
// =====================================================================

/**
 * Calculate the T5 Importance Extension (Ix) for a world.
 * Used by route generators to identify high-value nodes.
 */
function calculateT5Ix(base) {
    if (!base) return -1;
    let Ix = 0;
    const starport = base.starport || 'X';
    const tl = base.tl || 0;
    const pop = base.pop || 0;
    const tradeCodes = base.tradeCodes || [];
    const hasNaval = base.navalBase || false;
    const hasScout = base.scoutBase || false;

    if (['A', 'B'].includes(starport)) Ix += 1;
    if (['D', 'E', 'X'].includes(starport)) Ix -= 1;
    if (tl >= 10) Ix += 1;
    if (tl >= 16) Ix += 1;
    if (tl <= 8) Ix -= 1;
    if (tradeCodes.includes("Ag")) Ix += 1;
    if (tradeCodes.includes("Hi")) Ix += 1;
    if (tradeCodes.includes("In")) Ix += 1;
    if (tradeCodes.includes("Ri")) Ix += 1;
    if (pop <= 6) Ix -= 1;
    if (hasNaval && hasScout) Ix += 1;
    return Ix;
}

// Maps legacy type strings to their default route definition IDs.
const ROUTE_TYPE_TO_ID = { 'Xboat': 1, 'Trade': 2, 'Secondary': 3 };

/**
 * Resolves the routeId for a segment being added.
 * An explicit extras.routeId always wins. Otherwise standard types map to fixed
 * IDs 1-3, and Filter routes look up their groupId in routeDefinitions, creating
 * a definition if there is none.
 */
function resolveRouteId(type, extras) {
    // The caller already knows which slot these segments belong to, and every
    // live caller supplies one. Consulting the definitions anyway was not merely
    // redundant, it was destructive: an unrecognised groupId sent us down the
    // branch below, which *creates* a definition — so the first Point-to-Point,
    // Custom Network or BTN generation on a slot silently added an empty
    // duplicate slot to the Route Manager, named after the very route being
    // generated. The id it returned was then discarded by the spread in
    // addRoute, so the phantom was pure side effect.
    if (extras.routeId != null) return extras.routeId;

    if (type !== 'Filter') return ROUTE_TYPE_TO_ID[type] || 1;

    const defs = window.routeDefinitions || [];
    const groupId = extras.groupId;
    if (!groupId) return 4;

    const existing = defs.find(d => d.groupId === groupId);
    if (existing) return existing.id;

    // Create a new route definition for this Filter group
    const newId = defs.length > 0 ? Math.max(...defs.map(d => d.id)) + 1 : 4;
    defs.push({
        id: newId,
        name: extras.name || groupId,
        color: extras.color || '#ffffff',
        shortcut: null,
        visible: true,
        automationRef: null,
        groupId
    });
    window.routeDefinitions = defs;
    return newId;
}

// ensureFreeRouteSlot() lives in ui_menus.js, beside the Route Manager UI that
// is the reason a free slot has to exist. A second copy lived here and was dead
// on arrival — ui_menus.js assigns the same global and loads after this file,
// so this one was overwritten before anything could call it.

/**
 * Global helper to add a route with duplicate prevention.
 * @param {string}   id1    - First hex ID (will be sorted with id2)
 * @param {string}   id2    - Second hex ID
 * @param {string}   type   - 'Xboat', 'Trade', 'Secondary', or 'Filter'
 * @param {Map|null} adjMap - optional adjacency map to update in-place
 * @param {Object}   extras - additional fields spread into the route object
 *                            (e.g. { subtype, color, groupId, name } for Filter routes)
 */
function addRoute(id1, id2, type = "Trade", adjMap = null, extras = {}) {
    if (!window.sectorRoutes) window.sectorRoutes = [];
    const sorted = [id1, id2].sort();

    // Filter routes only block duplicates within the same group.
    // Standard routes block any duplicate on the same segment + type.
    const exists = window.sectorRoutes.some(r => {
        if (r.startId !== sorted[0] || r.endId !== sorted[1]) return false;
        if (type === 'Filter' && extras.groupId) return r.groupId === extras.groupId;
        return r.type === type;
    });

    if (!exists) {
        const routeId = resolveRouteId(type, extras);
        window.sectorRoutes.push({ startId: sorted[0], endId: sorted[1], type, routeId, ...extras });
        if (adjMap) {
            if (!adjMap.has(id1)) adjMap.set(id1, []);
            if (!adjMap.has(id2)) adjMap.set(id2, []);
            adjMap.get(id1).push(id2);
            adjMap.get(id2).push(id1);
        }
    }
}

// ── Union-Find ────────────────────────────────────────────────────────
// Used to track which worlds are already in the same connected component
// so BFS bridging skips pairs that are already reachable.

function _ufBuild(routes) {
    const parent = new Map();

    function find(x) {
        if (!parent.has(x)) parent.set(x, x);
        if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
        return parent.get(x);
    }

    function union(x, y) {
        parent.set(find(x), find(y));
    }

    function connected(x, y) {
        return find(x) === find(y);
    }

    for (const r of routes) {
        union(r.startId, r.endId);
    }

    return { find, union, connected };
}

// ── Spatial index ─────────────────────────────────────────────────────
// The searches below used to answer "what is within one jump of here?" by
// walking the entire world list and measuring the distance to every world in
// the sector — an O(worlds) scan inside an O(worlds) loop. Invisible on one
// sector (~1,300 worlds, 0.1s for a long route); crippling on an OTU import
// (~16,000 worlds, 25s of frozen browser for the same route, measured
// 2026-08-19 — see directives/route_forcing_spec.md §9).
//
// Worlds are bucketed by position so a neighbour lookup costs the size of the
// neighbourhood instead of the size of the sector.
//
// Buckets are keyed in CUBE coordinates, not the (q,r) offset coordinates the
// rest of the app uses. That matters for correctness: a hex within N of another
// can be up to ~1.5N away in offset r, so an offset-space box of ±N would miss
// real neighbours and silently change routes. In cube space the ±N box is
// exact. The conversion is the same one getHexDistance performs internally.

function _cubeX(q)      { return q; }
function _cubeZ(q, r)   { return r - (q - (q & 1)) / 2; }

function _buildWorldIndex(worlds, maxJump) {
    const size = Math.max(1, maxJump);
    const buckets = new Map();
    for (let i = 0; i < worlds.length; i++) {
        const w = worlds[i];
        const key = `${Math.floor(_cubeX(w.q) / size)},${Math.floor(_cubeZ(w.q, w.r) / size)}`;
        let b = buckets.get(key);
        if (!b) { b = []; buckets.set(key, b); }
        b.push(i);   // ascending by construction — we walk `worlds` in order
    }
    return { size, buckets, worlds };
}

// Cached per world-array identity. generateBTNRoutes calls the search once per
// qualifying world pair with the same array, so rebuilding per call would cost
// more than the scan it replaces. Length is part of the validity check because
// generatePointToPointRoute appends vacant stops to its list before searching.
const _worldIndexCache = new WeakMap();

function _getWorldIndex(worlds, maxJump) {
    const hit = _worldIndexCache.get(worlds);
    if (hit && hit.maxJump === maxJump && hit.count === worlds.length) return hit.index;
    const index = _buildWorldIndex(worlds, maxJump);
    _worldIndexCache.set(worlds, { maxJump, count: worlds.length, index });
    return index;
}

/**
 * Indices into index.worlds of every world that MIGHT be within maxJump of
 * (q,r). Over-collects — the caller still measures the real distance — but
 * never under-collects, which is the property that keeps routes identical.
 *
 * Returned in ascending index order, i.e. exactly the order a
 * plain "for (const w of worlds)" loop produced. BFS returns whichever equal-length
 * path it reaches first, so neighbour order decides which of several equally
 * short routes comes back; preserving it is what makes this refactor invisible.
 */
function _indexNeighbours(index, q, r, maxJump) {
    const x = _cubeX(q), z = _cubeZ(q, r);
    const bx0 = Math.floor((x - maxJump) / index.size);
    const bx1 = Math.floor((x + maxJump) / index.size);
    const bz0 = Math.floor((z - maxJump) / index.size);
    const bz1 = Math.floor((z + maxJump) / index.size);

    const out = [];
    for (let bx = bx0; bx <= bx1; bx++) {
        for (let bz = bz0; bz <= bz1; bz++) {
            const b = index.buckets.get(`${bx},${bz}`);
            if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
        }
    }
    out.sort((a, b) => a - b);
    return out;
}

// ── BFS path finder ───────────────────────────────────────────────────
// Finds the shortest hop path (each hop <= maxJump) between startId and
// endId through any populated world. Returns an array of hex IDs forming
// the path (inclusive of start and end), or null if unreachable.

function _bfsPath(startId, endId, worlds, maxJump, worldById) {
    const index = _getWorldIndex(worlds, maxJump);
    const queue = [startId];
    let head = 0;                                  // index cursor, not shift()
    const visited = new Set([startId]);
    const parent = new Map();

    while (head < queue.length) {
        const currentId = queue[head++];
        const current = worldById.get(currentId);
        if (!current) continue;

        const near = _indexNeighbours(index, current.q, current.r, maxJump);
        for (let n = 0; n < near.length; n++) {
            const w = index.worlds[near[n]];
            if (visited.has(w.id)) continue;
            if (getHexDistance(current.q, current.r, w.q, w.r) <= maxJump) {
                if (w.id === endId) {
                    const path = [w.id];
                    let step = currentId;
                    while (step !== undefined) { path.push(step); step = parent.get(step); }
                    return path.reverse();
                }
                parent.set(w.id, currentId);
                visited.add(w.id);
                queue.push(w.id);
            }
        }
    }
    return null;
}

// ── BFS path finder with empty hex traversal ─────────────────────────────────
// Returns a Map<hexId, {id, q, r}> of empty hexes within maxJump of any world
// in traversalWorlds. Used to pre-filter the empty hex candidate set.

function _buildEmptyHexCandidates(traversalWorlds, maxJump) {
    const result = new Map();
    for (const world of traversalWorlds) {
        for (let dq = -maxJump; dq <= maxJump; dq++) {
            for (let dr = -maxJump; dr <= maxJump; dr++) {
                const nq = world.q + dq;
                const nr = world.r + dr;
                if (getHexDistance(world.q, world.r, nq, nr) > maxJump) continue;
                const hexId = getHexId(nq, nr);
                if (!hexId || result.has(hexId)) continue;
                // isVacantHex, not a bare type === 'EMPTY' test: a hex that was
                // never touched, or that became 'BLANK' when it was tagged with
                // a region, is just as empty as one marked EMPTY by hand. The
                // old check made this feature work on imported sectors (which
                // back-fill EMPTY everywhere) and quietly do nothing on
                // hand-built ones.
                if (isVacantHex(hexId)) {
                    result.set(hexId, { id: hexId, q: nq, r: nr });
                }
            }
        }
    }
    return result;
}

// Cached per Map identity: generatePointToPointRoute builds emptyById once and
// searches it once per leg, so this array is built once rather than per leg.
const _emptyListCache = new WeakMap();

function _getEmptyList(emptyById) {
    const hit = _emptyListCache.get(emptyById);
    if (hit && hit.count === emptyById.size) return hit.list;
    const list = [...emptyById.values()];
    _emptyListCache.set(emptyById, { count: emptyById.size, list });
    return list;
}

// Like _bfsPath but allows intermediate hops through EMPTY hexes.
// emptyById: Map<hexId, {id,q,r}> of candidate empty hexes.
// maxEmptyJumps: max consecutive empty hops before a system is required.

function _bfsPathWithEmpty(startId, endId, worlds, maxJump, worldById, emptyById, maxEmptyJumps) {
    const worldIndex = _getWorldIndex(worlds, maxJump);
    // emptyById is a Map; the index needs positional order, and Map iteration
    // order is insertion order, so this array matches the old `for...of` exactly.
    const emptyList  = _getEmptyList(emptyById);
    const emptyIndex = _getWorldIndex(emptyList, maxJump);

    const queue = [{ id: startId, streak: 0 }];
    let head = 0;
    const visited = new Set([`${startId}:0`]);
    const parent = new Map();   // "id:streak" -> { id, streak } it was reached from

    const rebuild = (endHexId, endStreak) => {
        const path = [endHexId];
        let step = parent.get(`${endHexId}:${endStreak}`);
        while (step) {
            path.push(step.id);
            step = parent.get(`${step.id}:${step.streak}`);
        }
        return path.reverse();
    };

    while (head < queue.length) {
        const { id: currentId, streak } = queue[head++];
        const current = worldById.get(currentId) || emptyById.get(currentId);
        if (!current) continue;

        // System neighbors — landing on a system resets the consecutive empty streak
        const nearW = _indexNeighbours(worldIndex, current.q, current.r, maxJump);
        for (let n = 0; n < nearW.length; n++) {
            const w = worldIndex.worlds[nearW[n]];
            const dist = getHexDistance(current.q, current.r, w.q, w.r);
            if (dist === 0 || dist > maxJump) continue;
            const vKey = `${w.id}:0`;
            if (visited.has(vKey)) continue;
            parent.set(vKey, { id: currentId, streak });
            if (w.id === endId) return rebuild(w.id, 0);
            visited.add(vKey);
            queue.push({ id: w.id, streak: 0 });
        }

        // Empty hex neighbors — only if the streak budget allows another empty hop
        if (streak < maxEmptyJumps) {
            const nearE = _indexNeighbours(emptyIndex, current.q, current.r, maxJump);
            for (let n = 0; n < nearE.length; n++) {
                const e = emptyIndex.worlds[nearE[n]];
                const dist = getHexDistance(current.q, current.r, e.q, e.r);
                if (dist === 0 || dist > maxJump) continue;
                const newStreak = streak + 1;
                const vKey = `${e.id}:${newStreak}`;
                if (visited.has(vKey)) continue;
                parent.set(vKey, { id: currentId, streak });
                // Terminate on an empty destination too. The system-neighbour
                // loop above owns the only other endId check, so a leg ending
                // on an empty hex used to run to exhaustion and report "no
                // path" even when the hex was one hop away.
                if (e.id === endId) return rebuild(e.id, newStreak);
                visited.add(vKey);
                queue.push({ id: e.id, streak: newStreak });
            }
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────
/**
 * Generate X-Boat routes across all populated hexes.
 * Clears existing sectorRoutes and rebuilds from scratch.
 *
 * @param {number} maxJump  - Maximum hex distance for a single hop (default 4).
 * @param {number} maxRange - Straight-line distance within which two Ix 4+ worlds
 *                            will be connected. If > maxJump, BFS paths of shorter
 *                            hops bridge the gap through any populated worlds.
 *
 * Algorithm:
 *  1. Collect all populated worlds; identify Ix 4+ ("important") worlds.
 *  2. Direct links: for each Ix 4+ pair within maxJump, add a link unless
 *     another important world lies exactly on the straight-line path (redundancy).
 *  3. BFS bridging: for each Ix 4+ pair within maxRange (but beyond maxJump),
 *     skip if already connected; otherwise BFS through any world with hops <=
 *     maxJump. Pairs are processed nearest-first so shorter bridges are laid
 *     before longer ones, reducing redundant hops. Each found path's hops are
 *     added; addRoute() prevents duplicate edges.
 */
function generateXboatRoutes(maxJump = 4, maxRange = 12, minIx = 4, routeId = 1, groupId = null) {
    // Clear only Xboat segments belonging to this slot; leave all other slots untouched.
    window.sectorRoutes = (window.sectorRoutes || []).filter(r => !(r.type === 'Xboat' && r.routeId === routeId));
    const worlds = [];
    const importantWorlds = [];

    // Step 1: Collect worlds and compute Ix
    hexStates.forEach((state, id) => {
        if (state.type !== 'SYSTEM_PRESENT') return;
        const data = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
        if (!data) return;
        const ix = calculateT5Ix(data);
        const coords = getHexCoords(id);
        const worldInfo = { id, q: coords.q, r: coords.r, ix, travelZone: data.travelZone || 'Green' };
        worlds.push(worldInfo);
        if (ix >= minIx) importantWorlds.push(worldInfo);
    });

    if (worlds.length === 0) return;

    const worldById = new Map(worlds.map(w => [w.id, w]));
    const nonRedWorlds = worlds.filter(w => w.travelZone !== 'Red');
    const nonRedById   = new Map(nonRedWorlds.map(w => [w.id, w]));
    const adj = new Map();

    // Step 2: Direct links between Ix 4+ worlds within maxJump
    for (let i = 0; i < importantWorlds.length; i++) {
        for (let j = i + 1; j < importantWorlds.length; j++) {
            const w1 = importantWorlds[i];
            const w2 = importantWorlds[j];
            const dist = getHexDistance(w1.q, w1.r, w2.q, w2.r);

            if (dist <= maxJump && dist > 0) {
                // Skip if another important world lies exactly on the line w1-w2
                let isRedundant = false;
                for (const mid of importantWorlds) {
                    if (mid.id === w1.id || mid.id === w2.id) continue;
                    const d1 = getHexDistance(w1.q, w1.r, mid.q, mid.r);
                    const d2 = getHexDistance(w2.q, w2.r, mid.q, mid.r);
                    if (d1 + d2 === dist) { isRedundant = true; break; }
                }
                if (!isRedundant) addRoute(w1.id, w2.id, "Xboat", adj, { routeId, groupId });
            }
        }
    }

    // Step 3: BFS bridging for Ix 4+ pairs beyond maxJump but within maxRange
    if (maxRange > maxJump) {
        const uf = _ufBuild(window.sectorRoutes);

        // Collect candidate pairs sorted nearest-first
        const pairs = [];
        for (let i = 0; i < importantWorlds.length; i++) {
            for (let j = i + 1; j < importantWorlds.length; j++) {
                const w1 = importantWorlds[i];
                const w2 = importantWorlds[j];
                const dist = getHexDistance(w1.q, w1.r, w2.q, w2.r);
                if (dist > maxJump && dist <= maxRange) {
                    pairs.push({ w1, w2, dist });
                }
            }
        }
        pairs.sort((a, b) => a.dist - b.dist);

        for (const { w1, w2 } of pairs) {
            // Skip if already reachable via existing routes
            if (uf.connected(w1.id, w2.id)) continue;

            // Avoid Red-zone intermediaries; allow Red endpoints
            const needW1 = w1.travelZone === 'Red';
            const needW2 = w2.travelZone === 'Red';
            let bfsW, bfsMap;
            if (needW1 || needW2) {
                bfsW = [...nonRedWorlds];
                if (needW1) bfsW.push(w1);
                if (needW2) bfsW.push(w2);
                bfsMap = new Map(bfsW.map(w => [w.id, w]));
            } else {
                bfsW = nonRedWorlds; bfsMap = nonRedById;
            }

            const path = _bfsPath(w1.id, w2.id, bfsW, maxJump, bfsMap);
            if (!path) continue;

            for (let k = 0; k < path.length - 1; k++) {
                addRoute(path[k], path[k + 1], "Xboat", adj, { routeId, groupId });
                uf.union(path[k], path[k + 1]);
            }
        }
    }

    const myRoutes = window.sectorRoutes.filter(r => r.type === 'Xboat' && r.routeId === routeId);
    const uniqueNodes = new Set();
    myRoutes.forEach(r => { uniqueNodes.add(r.startId); uniqueNodes.add(r.endId); });
    console.log(`Xboat Routes Generated (Jump-${maxJump}, Range-${maxRange}, Route #${routeId}): ${myRoutes.length} routes. Unique Nodes: ${uniqueNodes.size}.`);
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generate Auto Routes connecting a user-defined filtered set of worlds.
 * Uses the same direct-link + BFS-bridging algorithm as generateXboatRoutes.
 * Does NOT clear existing routes — appends a new group to window.sectorRoutes.
 *
 * @param {string[]} filteredHexIds - Hex IDs of the worlds to connect.
 * @param {number}   maxJump        - Max single-hop distance (hex units).
 * @param {number}   maxRange       - Max straight-line distance for connection.
 * @param {string}   color          - CSS color string for this route group.
 * @param {string}   groupId        - Unique ID for the group (used for clearing).
 * @param {string}   name           - Display name shown in the Clear modal.
 * @returns {number} Number of route segments added.
 */
function generateAutoRoutes(filteredHexIds, maxJump, maxRange, color, groupId, name, routeIdOverride = null, allowEmptyHexes = false, maxEmptyJumps = 1) {
    if (!window.sectorRoutes) window.sectorRoutes = [];

    const filteredSet = new Set(filteredHexIds);
    const worlds = [];
    const endpointWorlds = [];

    // Collect all populated worlds; filtered worlds become the endpoints.
    hexStates.forEach((state, id) => {
        if (state.type !== 'SYSTEM_PRESENT') return;
        const data = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
        if (!data) return;
        const coords = getHexCoords(id);
        const worldInfo = { id, q: coords.q, r: coords.r, travelZone: data.travelZone || 'Green' };
        worlds.push(worldInfo);
        if (filteredSet.has(id)) endpointWorlds.push(worldInfo);
    });

    if (endpointWorlds.length === 0) return 0;

    const worldById   = new Map(worlds.map(w => [w.id, w]));
    const nonRedWorlds = worlds.filter(w => w.travelZone !== 'Red');
    const nonRedById   = new Map(nonRedWorlds.map(w => [w.id, w]));
    const adj = new Map();
    const extras = { subtype: 'AutoRoute', color, groupId, name };
    if (routeIdOverride != null) extras.routeId = routeIdOverride;

    // Pre-build empty hex candidates if the option is enabled
    const emptyById = allowEmptyHexes ? _buildEmptyHexCandidates(worlds, maxJump) : new Map();

    // Step 1: Direct links between filtered worlds within maxJump
    for (let i = 0; i < endpointWorlds.length; i++) {
        for (let j = i + 1; j < endpointWorlds.length; j++) {
            const w1 = endpointWorlds[i];
            const w2 = endpointWorlds[j];
            const dist = getHexDistance(w1.q, w1.r, w2.q, w2.r);

            if (dist <= maxJump && dist > 0) {
                let isRedundant = false;
                for (const mid of endpointWorlds) {
                    if (mid.id === w1.id || mid.id === w2.id) continue;
                    const d1 = getHexDistance(w1.q, w1.r, mid.q, mid.r);
                    const d2 = getHexDistance(w2.q, w2.r, mid.q, mid.r);
                    if (d1 + d2 === dist) { isRedundant = true; break; }
                }
                if (!isRedundant) addRoute(w1.id, w2.id, 'Filter', adj, extras);
            }
        }
    }

    // Step 2: BFS bridging for filtered pairs beyond maxJump but within maxRange
    if (maxRange > maxJump) {
        const filterRoutes = window.sectorRoutes.filter(r => r.groupId === groupId);
        const uf = _ufBuild(filterRoutes);

        const pairs = [];
        for (let i = 0; i < endpointWorlds.length; i++) {
            for (let j = i + 1; j < endpointWorlds.length; j++) {
                const w1 = endpointWorlds[i];
                const w2 = endpointWorlds[j];
                const dist = getHexDistance(w1.q, w1.r, w2.q, w2.r);
                if (dist > maxJump && dist <= maxRange) pairs.push({ w1, w2, dist });
            }
        }
        pairs.sort((a, b) => a.dist - b.dist);

        for (const { w1, w2 } of pairs) {
            if (uf.connected(w1.id, w2.id)) continue;

            // Avoid Red-zone intermediaries; allow Red endpoints
            const needW1 = w1.travelZone === 'Red';
            const needW2 = w2.travelZone === 'Red';
            let bfsW, bfsMap;
            if (needW1 || needW2) {
                bfsW = [...nonRedWorlds];
                if (needW1) bfsW.push(w1);
                if (needW2) bfsW.push(w2);
                bfsMap = new Map(bfsW.map(w => [w.id, w]));
            } else {
                bfsW = nonRedWorlds; bfsMap = nonRedById;
            }

            const path = allowEmptyHexes
                ? _bfsPathWithEmpty(w1.id, w2.id, bfsW, maxJump, bfsMap, emptyById, maxEmptyJumps)
                : _bfsPath(w1.id, w2.id, bfsW, maxJump, bfsMap);
            if (!path) continue;
            for (let k = 0; k < path.length - 1; k++) {
                addRoute(path[k], path[k + 1], 'Filter', adj, { ...extras });
                uf.union(path[k], path[k + 1]);
            }
        }
    }

    const addedRoutes = window.sectorRoutes.filter(r => r.groupId === groupId);
    console.log(`Auto Routes "${name}" (Jump-${maxJump}, Range-${maxRange}): ${addedRoutes.length} routes added.`);
    return addedRoutes.length;
}

/**
 * Returns an array of Auto Route group descriptors for the Clear modal.
 * Each entry: { groupId, name, color, count }
 */
function getAutoRouteGroups() {
    if (!window.sectorRoutes) return [];
    const groups = new Map();
    window.sectorRoutes.forEach(r => {
        if (r.type !== 'Filter' || !r.groupId) return;
        if (!groups.has(r.groupId)) {
            groups.set(r.groupId, { groupId: r.groupId, name: r.name || r.groupId, color: r.color || '#ffffff', count: 0 });
        }
        groups.get(r.groupId).count++;
    });
    return Array.from(groups.values());
}

/**
 * Removes all routes belonging to a specific Auto Route group.
 */
function clearAutoRouteGroup(groupId) {
    if (!window.sectorRoutes) return;
    window.sectorRoutes = window.sectorRoutes.filter(r => r.groupId !== groupId);
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generate a Point-to-Point route from startId to endId via BFS, with optional waypoints.
 * Waypoints are mandatory intermediate stops; BFS runs independently on each leg.
 * Does NOT clear existing routes — appends to window.sectorRoutes.
 *
 * All or nothing: if any leg has no path this commits nothing at all, so a
 * failed call never leaves a partial route behind.
 *
 * Any stop may be a vacant hex (deep space) as well as a populated world —
 * see the note beside the stop-injection loop. Vacant stops are independent of
 * allowEmptyHexes, which governs only opportunistic empty hops along the way.
 *
 * @param {string}   startId        - Starting hex ID.
 * @param {string}   endId          - Ending hex ID.
 * @param {number}   maxJump        - Max single-hop distance (hex units).
 * @param {string}   color          - CSS color string for this route.
 * @param {string}   groupId        - Unique ID (used for clearing).
 * @param {string}   name           - Display name shown in the Clear modal.
 * @param {boolean}  filteredOnly   - If true, BFS traverses only filtered worlds.
 * @param {string[]} filteredHexIds - Hex IDs allowed as BFS traversal nodes (filteredOnly mode).
 * @param {number|null} routeIdOverride - If set, overrides computed routeId on all segments.
 * @param {string[]} waypointIds    - Ordered mandatory intermediate stops (default empty).
 * @returns {{ segments: number|null, failure: Object|null }}
 *          On success, segments is the total added and failure is null.
 *          On failure, segments is null and failure names what went wrong:
 *            { kind: 'stop', stopId }                        — that stop cannot be
 *              used at all: it is neither vacant space nor a system with data.
 *            { kind: 'leg', index, total, fromId, toId }     — that one leg has no
 *              path (index is 1-based).
 *          The caller needs this to say where the problem is: naming the route's
 *          own Start and End is actively misleading on a long route, since those
 *          two stops are usually the ones that were fine.
 */
function generatePointToPointRoute(startId, endId, maxJump, color, groupId, name, filteredOnly = false, filteredHexIds = [], routeIdOverride = null, waypointIds = [], allowEmptyHexes = false, maxEmptyJumps = 1) {
    if (!window.sectorRoutes) window.sectorRoutes = [];

    const filteredSet = new Set(filteredHexIds);
    // All mandatory stops are exempt from the filter requirement.
    const allStops = new Set([startId, endId, ...waypointIds]);
    const worlds = [];

    hexStates.forEach((state, id) => {
        if (state.type !== 'SYSTEM_PRESENT') return;
        const data = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
        if (!data) return;
        if (filteredOnly && !filteredSet.has(id) && !allStops.has(id)) return;
        const coords = getHexCoords(id);
        worlds.push({ id, q: coords.q, r: coords.r });
    });

    const worldById = new Map(worlds.map(w => [w.id, w]));

    // Vacant stops are nodes too.
    //
    // `worlds` here means "hexes a ship may occupy", not "populated worlds":
    // some referees let players jump into empty space, so a vacant hex the user
    // deliberately chose as a Start, End, or Waypoint belongs in the graph even
    // though the generator would never route through it on its own.
    //
    // They go in here rather than into the empty-traversal candidate set below
    // so that choosing one does NOT require Allow Empty Hexes, and so
    // maxEmptyJumps keeps meaning exactly what it always has — a deliberate
    // stop is not an opportunistic hop and must not consume that budget.
    for (const stopId of allStops) {
        if (worldById.has(stopId)) continue;
        if (!isVacantHex(stopId)) continue;   // neither a world nor valid vacant space
        const coords = getHexCoords(stopId);
        const node = { id: stopId, q: coords.q, r: coords.r };
        worlds.push(node);
        worldById.set(stopId, node);
    }

    // Verify all stops exist as reachable nodes. A stop can survive the UI's own
    // check and still fail here: a hex marked SYSTEM_PRESENT that carries no
    // edition data is a world by type but has nothing to route through.
    for (const stopId of allStops) {
        if (!worldById.has(stopId)) return { segments: null, failure: { kind: 'stop', stopId } };
    }

    // Pre-build empty hex candidates if the option is enabled
    const emptyById = allowEmptyHexes ? _buildEmptyHexCandidates(worlds, maxJump) : new Map();

    // A chosen stop is already a node in `worlds`; leaving it in the empty set
    // as well would let BFS expand it a second time under a streak it should
    // never consume.
    for (const stopId of allStops) emptyById.delete(stopId);

    const stops = [startId, ...waypointIds, endId];
    const extras = { subtype: 'PointToPoint', color, groupId, name };
    if (routeIdOverride != null) extras.routeId = routeIdOverride;

    // Two passes, deliberately: every leg is resolved before any of it is
    // committed. Legs used to be written to the map as they were found, so a
    // route that failed on its third leg left the first two drawn — segments
    // belonging to a route the user never got, described by no configuration
    // the Route Manager would ever show, and indistinguishable from the real
    // thing. Deleting a waypoint is exactly what stretches a leg past maxJump,
    // so editing a route was the common way to hit it.
    const legs = [];
    for (let i = 0; i < stops.length - 1; i++) {
        const path = allowEmptyHexes
            ? _bfsPathWithEmpty(stops[i], stops[i + 1], worlds, maxJump, worldById, emptyById, maxEmptyJumps)
            : _bfsPath(stops[i], stops[i + 1], worlds, maxJump, worldById);
        if (!path) {
            return { segments: null, failure: {
                kind:  'leg',
                index: i + 1,
                total: stops.length - 1,
                fromId: stops[i],
                toId:   stops[i + 1]
            } };
        }
        legs.push(path);
    }

    let totalSegments = 0;
    for (const path of legs) {
        for (let k = 0; k < path.length - 1; k++) {
            addRoute(path[k], path[k + 1], 'Filter', null, extras);
        }
        totalSegments += path.length - 1;
    }

    const legDesc = waypointIds.length > 0 ? `, ${stops.length - 1} leg(s)` : '';
    console.log(`Point-to-Point "${name}" (Jump-${maxJump}): ${totalSegments} segment(s) from ${startId} to ${endId}${legDesc}.`);
    return { segments: totalSegments, failure: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// BTN (Basic Trade Number) Route Generation
// Inspired by GURPS Traveller Far Trader.
// ─────────────────────────────────────────────────────────────────────────────

function _btnDistancePenalty(d) {
    if (d <= 1)   return 0;
    if (d <= 2)   return 1;
    if (d <= 5)   return 2;
    if (d <= 9)   return 3;
    if (d <= 19)  return 4;
    if (d <= 29)  return 5;
    if (d <= 59)  return 6;
    if (d <= 99)  return 7;
    if (d <= 199) return 8;
    if (d <= 299) return 9;
    if (d <= 599) return 10;
    if (d <= 999) return 11;
    return 12;
}

function _btnTradeBonus(tcA, tcB) {
    let bonus = 0;
    if ((tcA.includes('Ag') && tcB.includes('Na')) || (tcB.includes('Ag') && tcA.includes('Na'))) bonus += 1;
    if ((tcA.includes('In') && tcB.includes('Ni')) || (tcB.includes('In') && tcA.includes('Ni'))) bonus += 1;
    return bonus;
}

/**
 * Attempt to add a BTN route segment, enforcing the no-share rule across
 * different BTN route groups. Null btnMax is treated as +Infinity.
 */
function _btnAddSegment(id1, id2, extras) {
    const sorted = [id1, id2].sort();
    const [s, e] = sorted;
    const myMax = extras.btnMax === null ? Infinity : extras.btnMax;

    const conflictIdx = (window.sectorRoutes || []).findIndex(r =>
        r.startId === s && r.endId === e &&
        r.subtype === 'BTN' &&
        r.groupId !== extras.groupId
    );

    if (conflictIdx !== -1) {
        const rival = window.sectorRoutes[conflictIdx];
        const rivalMax = rival.btnMax === null ? Infinity : rival.btnMax;
        if (rivalMax > myMax) return; // rival wins outright
        if (rivalMax === myMax) {
            // Tiebreak: route with higher minBTN (more selective) owns the segment.
            // Prevents a lower-minBTN route from claiming high-WTN hops just because
            // it was generated first, which would hide the higher route's coverage.
            const myMin = extras.minBTN ?? 0;
            const rivalMin = rival.minBTN ?? 0;
            if (rivalMin >= myMin) return; // rival wins or true tie — first placed stands
        }
        window.sectorRoutes.splice(conflictIdx, 1); // we win — evict rival
    }

    addRoute(id1, id2, 'Filter', null, extras);
}

/**
 * Generate BTN Trade Routes for a given route slot.
 *
 * @param {Object} cfg
 * @param {number}      cfg.lowerBTN  - Partial-success floor (inclusive).
 * @param {number}      cfg.minBTN    - Full-route floor (inclusive).
 * @param {number|null} cfg.maxBTN    - Full-route ceiling (null = no cap).
 * @param {number}      cfg.maxJump   - Max single-hop distance for BFS.
 * @param {number}      cfg.range     - Straight-line pair-filter distance.
 * @param {string}      cfg.color     - CSS colour for segments.
 * @param {string}      cfg.groupId   - Unique group ID (e.g. "btn_2").
 * @param {string}      cfg.name      - Display name.
 * @param {number}      cfg.routeId   - Route definition ID for rendering.
 * @returns {{ segments, fullRoutes, promoted, included, skipped }}
 */
function generateBTNRoutes({ lowerBTN, minBTN, maxBTN, maxJump, range, color, groupId, name, routeId }) {
    if (!window.sectorRoutes) window.sectorRoutes = [];

    // ── 1. Collect worlds with a valid WTN ──────────────────────────────────
    const worlds = [];
    let included = 0, skipped = 0;

    hexStates.forEach((state, id) => {
        if (state.type !== 'SYSTEM_PRESENT') return;
        const data = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
        if (!data) { skipped++; return; }
        const wtn = data.WTN;
        if (wtn === undefined || wtn === null || !Number.isFinite(wtn)) { skipped++; return; }
        const coords = getHexCoords(id);
        worlds.push({
            id, q: coords.q, r: coords.r,
            name: data.name || id,
            WTN: wtn,
            tradeCodes: data.tradeCodes || [],
            travelZone: data.travelZone || 'Green'
        });
        included++;
    });

    // ── 2. Sort descending by WTN ────────────────────────────────────────────
    worlds.sort((a, b) => b.WTN - a.WTN);

    const worldById = new Map(worlds.map(w => [w.id, w]));

    // BFS candidate list that allows Red-zone endpoints but bars Red intermediaries.
    const nonRedWorlds = worlds.filter(w => w.travelZone !== 'Red');

    const extras = { subtype: 'BTN', color, groupId, name, btnMax: maxBTN, minBTN, routeId };

    const partials = [];
    let fullRoutes = 0;
    let segments = 0;

    const logging = !!window.isLoggingEnabled;
    const wLabel = w => `${w.name} [${w.id}] WTN:${w.WTN}`;

    if (logging) {
        const maxLabel = maxBTN !== null ? maxBTN : 'none';
        tSection(`BTN Route Generation: ${name}`);
        writeLogLine(`Thresholds: Lower ${lowerBTN} / Min ${minBTN} / Max ${maxLabel} | Jump ${maxJump} | Range ${range}`);
        writeLogLine(`Worlds eligible: ${included} | Skipped (no WTN): ${skipped}`);
        tSection('Full Routes');
    }

    // ── 3 & 4. Pair iteration ────────────────────────────────────────────────
    for (let i = 0; i < worlds.length; i++) {
        const wa = worlds[i];
        for (let j = i + 1; j < worlds.length; j++) {
            const wb = worlds[j];
            const d = getHexDistance(wa.q, wa.r, wb.q, wb.r);
            if (d === 0 || d > range) continue;

            const pen     = _btnDistancePenalty(d);
            const bon     = _btnTradeBonus(wa.tradeCodes, wb.tradeCodes);
            const rawBTN  = wa.WTN + wb.WTN - pen + bon;
            const btnCap  = Math.min(wa.WTN, wb.WTN) + 10;
            const btn     = Math.min(rawBTN, btnCap);

            const isFull    = btn >= minBTN && (maxBTN === null || btn <= maxBTN);
            const isPartial = !isFull && btn >= lowerBTN;

            if (!isFull && !isPartial) continue;

            // ── 5. BFS — bar Red intermediaries, but allow Red endpoints ────
            const needA = wa.travelZone === 'Red';
            const needB = wb.travelZone === 'Red';
            let bfsWorlds, bfsById;
            if (needA || needB) {
                bfsWorlds = [...nonRedWorlds];
                if (needA) bfsWorlds.push(wa);
                if (needB) bfsWorlds.push(wb);
                bfsById = new Map(bfsWorlds.map(w => [w.id, w]));
            } else {
                bfsWorlds = nonRedWorlds;
                bfsById = worldById;
            }

            const path = _bfsPath(wa.id, wb.id, bfsWorlds, maxJump, bfsById);
            if (!path) continue;

            if (isFull) {
                if (logging) {
                    const capNote = rawBTN > btnCap ? ` (capped from ${rawBTN})` : '';
                    writeLogLine(`  ${wLabel(wa)} + ${wLabel(wb)} | dist:${d} pen:${pen} bon:${bon} | raw:${rawBTN} cap:${btnCap} BTN:${btn}${capNote} → ROUTE`);
                }
                for (let k = 0; k < path.length - 1; k++) {
                    const before = window.sectorRoutes.length;
                    _btnAddSegment(path[k], path[k + 1], extras);
                    if (window.sectorRoutes.length > before) segments++;
                }
                fullRoutes++;
            } else {
                partials.push({ path, wa, wb, pen, bon, rawBTN, btnCap, btn });
            }
        }
    }

    // ── 7. Partial-success promotion ─────────────────────────────────────────
    // Map each segment key → indices into partials[]
    const segToPartials = new Map();
    for (let pi = 0; pi < partials.length; pi++) {
        const { path } = partials[pi];
        for (let k = 0; k < path.length - 1; k++) {
            const key = [path[k], path[k + 1]].sort().join('|');
            if (!segToPartials.has(key)) segToPartials.set(key, []);
            segToPartials.get(key).push(pi);
        }
    }

    // Draw only segments that appear in 2+ partial paths (segment-level promotion)
    if (logging) tSection('Promoted Segments');

    let promoted = 0;
    for (const [key, indices] of segToPartials) {
        if (indices.length < 2) continue;
        const [id1, id2] = key.split('|');

        if (logging) {
            const hopA = worldById.get(id1);
            const hopB = worldById.get(id2);
            const hopLabel = `${hopA ? hopA.name : id1} [${id1}] ↔ ${hopB ? hopB.name : id2} [${id2}]`;
            const sharers = indices
                .map(pi => `${partials[pi].wa.name} [${partials[pi].wa.id}] ↔ ${partials[pi].wb.name} [${partials[pi].wb.id}]`)
                .join(', ');
            writeLogLine(`  ${hopLabel}  (shared by: ${sharers})`);
        }

        const before = window.sectorRoutes.length;
        _btnAddSegment(id1, id2, extras);
        if (window.sectorRoutes.length > before) {
            segments++;
            promoted++;
        }
    }


    if (logging) {
        tSection('BTN Generation Summary');
        writeLogLine(`Full routes: ${fullRoutes} | Promoted: ${promoted} | Total segments: ${segments}`);
        writeLogLine(`Worlds included: ${included} | Skipped (no WTN): ${skipped}`);
    }

    console.log(`BTN Routes "${name}": ${segments} segments, ${fullRoutes} full + ${promoted} promoted, ${included} worlds included, ${skipped} skipped.`);
    return { segments, fullRoutes, promoted, included, skipped };
}
