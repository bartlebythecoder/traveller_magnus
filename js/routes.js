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
        window.sectorRoutes.push({ startId: sorted[0], endId: sorted[1], type, ...extras });
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

// ── BFS path finder ───────────────────────────────────────────────────
// Finds the shortest hop path (each hop <= maxJump) between startId and
// endId through any populated world. Returns an array of hex IDs forming
// the path (inclusive of start and end), or null if unreachable.

function _bfsPath(startId, endId, worlds, maxJump, worldById) {
    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = worldById.get(path[path.length - 1]);
        if (!current) continue;

        for (const w of worlds) {
            if (visited.has(w.id)) continue;
            if (getHexDistance(current.q, current.r, w.q, w.r) <= maxJump) {
                const newPath = [...path, w.id];
                if (w.id === endId) return newPath;
                visited.add(w.id);
                queue.push(newPath);
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
function generateXboatRoutes(maxJump = 4, maxRange = 12) {
    // Preserve Filter routes (Auto Routes, Point-to-Point) — only clear Xboat routes.
    window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.type !== 'Xboat');
    const worlds = [];
    const importantWorlds = [];

    // Step 1: Collect worlds and compute Ix
    hexStates.forEach((state, id) => {
        if (state.type !== 'SYSTEM_PRESENT') return;
        const data = state.t5Data || state.mgt2eData || state.ctData;
        if (!data) return;
        const ix = calculateT5Ix(data);
        const coords = getHexCoords(id);
        const worldInfo = { id, q: coords.q, r: coords.r, ix };
        worlds.push(worldInfo);
        if (ix >= 4) importantWorlds.push(worldInfo);
    });

    if (worlds.length === 0) return;

    const worldById = new Map(worlds.map(w => [w.id, w]));
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
                if (!isRedundant) addRoute(w1.id, w2.id, "Xboat", adj);
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

            const path = _bfsPath(w1.id, w2.id, worlds, maxJump, worldById);
            if (!path) continue;

            for (let k = 0; k < path.length - 1; k++) {
                addRoute(path[k], path[k + 1], "Xboat", adj);
                uf.union(path[k], path[k + 1]);
            }
        }
    }

    const uniqueNodes = new Set();
    window.sectorRoutes.forEach(r => { uniqueNodes.add(r.startId); uniqueNodes.add(r.endId); });
    console.log(`Xboat Routes Generated (Jump-${maxJump}, Range-${maxRange}): ${window.sectorRoutes.length} routes. Unique Nodes: ${uniqueNodes.size}.`);
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
function generateAutoRoutes(filteredHexIds, maxJump, maxRange, color, groupId, name) {
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
        const worldInfo = { id, q: coords.q, r: coords.r };
        worlds.push(worldInfo);
        if (filteredSet.has(id)) endpointWorlds.push(worldInfo);
    });

    if (endpointWorlds.length === 0) return 0;

    const worldById = new Map(worlds.map(w => [w.id, w]));
    const adj = new Map();
    const extras = { subtype: 'AutoRoute', color, groupId, name };

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
            const path = _bfsPath(w1.id, w2.id, worlds, maxJump, worldById);
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
 * Generate a single Point-to-Point route from startId to endId via BFS.
 * Does NOT clear existing routes — appends to window.sectorRoutes.
 *
 * @param {string}   startId      - Starting hex ID.
 * @param {string}   endId        - Ending hex ID.
 * @param {number}   maxJump      - Max single-hop distance (hex units).
 * @param {string}   color        - CSS color string for this route.
 * @param {string}   groupId      - Unique ID (used for clearing).
 * @param {string}   name         - Display name shown in the Clear modal.
 * @param {boolean}  filteredOnly - If true, BFS traverses only filtered worlds
 *                                  (start and end are always included regardless).
 * @param {string[]} filteredHexIds - Hex IDs allowed as BFS waypoints (used when filteredOnly=true).
 * @returns {number|null} Number of segments added, or null if no path found.
 */
function generatePointToPointRoute(startId, endId, maxJump, color, groupId, name, filteredOnly = false, filteredHexIds = []) {
    if (!window.sectorRoutes) window.sectorRoutes = [];

    const filteredSet = new Set(filteredHexIds);
    const worlds = [];

    hexStates.forEach((state, id) => {
        if (state.type !== 'SYSTEM_PRESENT') return;
        const data = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
        if (!data) return;
        // In filteredOnly mode, skip worlds that aren't filtered AND aren't start/end.
        if (filteredOnly && !filteredSet.has(id) && id !== startId && id !== endId) return;
        const coords = getHexCoords(id);
        worlds.push({ id, q: coords.q, r: coords.r });
    });

    const worldById = new Map(worlds.map(w => [w.id, w]));

    // Verify both endpoints exist as populated worlds.
    if (!worldById.has(startId) || !worldById.has(endId)) return null;

    const path = _bfsPath(startId, endId, worlds, maxJump, worldById);
    if (!path) return null;

    const extras = { subtype: 'PointToPoint', color, groupId, name };
    for (let k = 0; k < path.length - 1; k++) {
        addRoute(path[k], path[k + 1], 'Filter', null, extras);
    }

    console.log(`Point-to-Point "${name}" (Jump-${maxJump}): ${path.length - 1} segment(s) from ${startId} to ${endId}.`);
    return path.length - 1;
}
