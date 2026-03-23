// =============================================================================
// CORE.JS - Application State & Coordinate Math
// =============================================================================

// -----------------------------------------------------------------------------
// Global Constants
// -----------------------------------------------------------------------------
const APP_VERSION = "v0.5.2";
const APP_BANNER = "v0.5.2 - Refactored input.js";

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------

// Camera state (Centered on Sector R by default for fresh instances)
cameraX = 8400 - (window.innerWidth / 2);
cameraY = 8660 - (window.innerHeight / 2);
zoom = 1.0;

// Mouse tracking
currentMouseX = 0;
currentMouseY = 0;

// Alt+Drag Route Creation State
isAltDragging = false;
altDragStartId = null;
altDragType = 'Trade';

// Key state tracking
keysDown = new Set();

// Selection state
selectedHexes = new Set();

// UI Display state
showSubsectorBorders = true;
devView = false;

// Hex state (Map of hexId -> STATE)
hexStates = new Map();

// Route state (Global array of route objects)
window.sectorRoutes = [];

// System Naming State
namePool = [];
usedNames = new Set(); // Reset every load for machine-agnostic determinism

// Hex properties - Renderer needs this immediately
baseHexSize = 50;

// Generation Trace State
const MAX_GEN_TRACES = 5;
let genTraces = [];
let currentTrace = null;
let genTraceCount = 0;
let activeTrace = null;

// Seeded Random Generation
let masterSeed = localStorage.getItem('traveller_gen_seed') || "TravellerMagnus";
let rng = mulberry32(hashString(masterSeed));

function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return h >>> 0;
}

function mulberry32(a) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function setRandomSeed(seedString) {
    masterSeed = seedString || "TravellerMagnus";
    localStorage.setItem('traveller_gen_seed', masterSeed);
    rng = mulberry32(hashString(masterSeed));
    usedNames.clear(); // Important: reset used names on seed change
    console.log(`Master Seed set to: "${masterSeed}" (RNG and Names Reset)`);
}

function reseedForHex(hexId) {
    const hexSeed = hashString(masterSeed + "-" + (hexId || "0000"));
    rng = mulberry32(hexSeed);
    // console.log(`RNG re-seeded for Hex ${hexId} (Hash: ${hexSeed})`);
}

function clampUWP(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// History state
window.undoStack = [];
window.redoStack = [];

function saveHistoryState(actionName) {
    const stateSnapshot = {
        action: actionName,
        routes: JSON.parse(JSON.stringify(window.sectorRoutes || [])),
        hexStates: JSON.parse(JSON.stringify(Array.from(hexStates.entries())))
    };
    window.undoStack.push(stateSnapshot);
    if (window.undoStack.length > 50) window.undoStack.shift();
    window.redoStack = []; // Clear redo stack on new action
}

// -----------------------------------------------------------------------------
// Coordinate Math Functions
// -----------------------------------------------------------------------------

function getHexId(q, r) {
    if (q < 0 || q > 223 || r < 0 || r > 199) return null;
    const sectorX = Math.floor(q / 32);
    const sectorY = Math.floor(r / 40);
    const sectorIndex = sectorY * 7 + sectorX;
    let sectorChar = sectorIndex < 26 ? String.fromCharCode(65 + sectorIndex) :
        String.fromCharCode(65 + (sectorIndex - 26)) + String.fromCharCode(65 + (sectorIndex - 26));
    const subsectorX = Math.floor((q % 32) / 8);
    const subsectorY = Math.floor((r % 40) / 10);
    const subsectorChar = String.fromCharCode(65 + (subsectorY * 4 + subsectorX));
    const localQ = (q % 32) + 1;
    const localR = (r % 40) + 1;
    return `${sectorChar}-${subsectorChar}-${localQ.toString().padStart(2, '0')}${localR.toString().padStart(2, '0')}`;
}

function pixelToHex(x, y, size) {
    const q_frac = (2.0 / 3.0 * x) / size;
    const r_frac = (-1.0 / 3.0 * x + Math.sqrt(3) / 3.0 * y) / size;
    let q = Math.round(q_frac), r = Math.round(r_frac), s = Math.round(-q_frac - r_frac);
    const q_diff = Math.abs(q - q_frac), r_diff = Math.abs(r - r_frac), s_diff = Math.abs(s - (-q_frac - r_frac));
    if (q_diff > r_diff && q_diff > s_diff) q = -r - s; else if (r_diff > s_diff) r = -q - s;
    return { q: q, r: r + (q - (q & 1)) / 2 };
}

function getHexCoords(hexId) {
    if (!hexId) return null;
    const parts = hexId.split('-');
    if (parts.length < 3) return null;
    const sChar = parts[0];
    const sIdx = sChar.length === 1 ? sChar.charCodeAt(0) - 65 : (sChar.charCodeAt(0) - 65) + 26;
    const sectorX = sIdx % 7;
    const sectorY = Math.floor(sIdx / 7);
    const localQ = parseInt(parts[2].substring(0, 2)) - 1;
    const localR = parseInt(parts[2].substring(2, 4)) - 1;
    return { q: sectorX * 32 + localQ, r: sectorY * 40 + localR };
}

function getHexDistance(q1, r1, q2, r2) {
    const x1 = q1;
    const z1 = r1 - (q1 - (q1 & 1)) / 2;
    const y1 = -x1 - z1;
    const x2 = q2;
    const z2 = r2 - (q2 - (q2 & 1)) / 2;
    const y2 = -x2 - z2;
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

function getHexPixel(q, r) {
    const size = baseHexSize;
    const widthStep = (3 / 2) * size;
    const heightStep = Math.sqrt(3) * size;
    const offset = (q & 1) ? 0.5 : 0;
    return { x: widthStep * q, y: heightStep * (r + offset) };
}

function getMouseWorldCoords(e) {
    return { x: cameraX + e.clientX / zoom, y: cameraY + e.clientY / zoom };
}

// ============================================================================
// AUDITED UTILITIES & LOGGING (FINAL VERSION)
// ============================================================================

// --- Core Math & Dice ---
async function ensureNamesLoaded() { return true; }
function roll1D() { return Math.floor(rng() * 6) + 1; }
function roll2D() { return roll1D() + roll1D(); }
function rollFlux() { return roll1D() - roll1D(); }
function rollD3() { return Math.floor(rng() * 3) + 1; }
function rollND(n) {
    let total = 0;
    for (let i = 0; i < n; i++) total += roll1D();
    return total;
}

function roll3D() {
    return roll1D() + roll1D() + roll1D();
}

function roll4D() {
    return rollND(4);
}

// Convert to Traveller eHex (skipping I and O)
function toEHex(val) {
    if (val === undefined || val === null) return '0';
    if (val <= 9) return val.toString();
    const hexChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skip I and O
    return hexChars[val - 10] || '0';
}

// --- Traveller Translators (eHex: skips I and O) ---
const EHEX_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Skips I and O

function toUWPChar(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    val = Math.floor(val);
    if (val < 0) return '0';
    if (val < 10) return val.toString();
    return EHEX_CHARS[val - 10] || 'Z';
}

function fromUWPChar(char) {
    if (!char) return 0;
    const c = char.toUpperCase();
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48; // 0-9
    const idx = EHEX_CHARS.indexOf(c);
    if (idx >= 0) return idx + 10;
    return 0;
}

// =====================================================================
// BATCH LOGGING ARCHITECTURE
// =====================================================================

// --- Batch Logging State ---
window.isLoggingEnabled = false;
window.batchLogData = [];
window.logIndentLevel = 0;
let pendingRoll = null; // Deferred roll for math display

function logIndentIn() { window.logIndentLevel++; }
function logIndentOut() { window.logIndentLevel = Math.max(0, window.logIndentLevel - 1); }

function _writeRawLogLine(text) {
    if (!window.isLoggingEnabled) return;
    const indent = "    ".repeat(window.logIndentLevel);
    window.batchLogData.push(indent + text);
}

function flushPendingRoll() {
    if (!pendingRoll) return;
    const p = pendingRoll;
    pendingRoll = null; // Clear to prevent recursion

    if (!window.isLoggingEnabled) return;

    const totalDM = p.dms.reduce((acc, d) => acc + d.val, 0);
    const final = p.val + totalDM;

    if (totalDM !== 0) {
        const sign = totalDM >= 0 ? '+' : '-';
        _writeRawLogLine(`${p.label}: Rolled ${p.type} for ${p.val} ${sign} ${Math.abs(totalDM)} = ${final}`);
    } else {
        _writeRawLogLine(`${p.label}: Rolled ${p.type} for ${p.val}`);
    }

    p.dms.forEach(d => {
        _writeRawLogLine(`  DM (${d.label}): ${d.val >= 0 ? '+' : ''}${d.val}`);
    });
}

function writeLogLine(text) {
    flushPendingRoll();
    if (!window.isLoggingEnabled) return;
    _writeRawLogLine(text);
}

function startTrace(hexId, ruleset, name = null) {
    if (!window.isLoggingEnabled) return;
    writeLogLine(`========================================================`);
    writeLogLine(`SYSTEM: ${hexId}${name ? ' - ' + name : ''} (${ruleset})`);
    writeLogLine(`Master Seed: ${masterSeed} | Hex Hash: ${hashString(masterSeed + "-" + hexId)}`);
    writeLogLine(`========================================================`);
}

function tSection(title) { writeLogLine(`\n--- ${title.toUpperCase()} ---`); }
function tResult(label, value) { writeLogLine(`${label}: ${value}`); }

function tDM(label, value) {
    if (pendingRoll) {
        pendingRoll.dms.push({ label, val: value });
    } else {
        if (window.isLoggingEnabled) _writeRawLogLine(`  DM (${label}): ${value >= 0 ? '+' : ''}${value}`);
    }
}

function tSkip(reason) { writeLogLine(`  Skipped: ${reason}`); }
function tTrade(code, reason) { writeLogLine(`  Trade Code [${code}]: ${reason}`); }

function tRoll1D(label) {
    const roll = roll1D();
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: '1D' };
    return roll;
}

function tRoll2D(label) {
    const roll = roll2D();
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: '2D6' };
    return roll;
}

function tRoll1D3(label) {
    const roll = rollD3();
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: '1D3' };
    return roll;
}

function tRoll2D3(label) {
    const roll = rollD3() + rollD3();
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: '2D3' };
    return roll;
}

function tRoll3D(label) {
    const roll = rollND(3);
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: '3D6' };
    return roll;
}

function tRoll4D(label) {
    const roll = rollND(4);
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: '4D6' };
    return roll;
}

function tRollFlux(label) {
    const roll = rollFlux();
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: 'Flux' };
    return roll;
}

function tRollND(n, label) {
    const roll = rollND(n);
    flushPendingRoll();
    pendingRoll = { label, val: roll, dms: [], type: `${n}D` };
    return roll;
}

function tClamp(label, rolled, clamped) {
    if (window.isLoggingEnabled) writeLogLine(`  ${label} Rolled: ${rolled} -> Clamped to ${clamped}`);
}

function tOverride(label, original, newValue, reason) {
    if (window.isLoggingEnabled) writeLogLine(`  ${label} Override: ${original} -> ${newValue} (${reason})`);
}

function endTrace() {
    if (window.isLoggingEnabled) {
        flushPendingRoll();
        writeLogLine(`\n`);
    }
}

// =====================================================================
// NAME GENERATION UTILITIES
// =====================================================================

/**
 * Grabs a name from the pool.
 * If hexId is provided, it uses a deterministic hash to pick the name,
 * ensuring the same hex always gets the same name for a given Master Seed.
 */
function getNextSystemName(hexId) {
    if (namePool.length === 0) return "Unnamed System";

    let index;
    if (hexId) {
        // Deterministic pick based on location - absolute determinism
        const nameSeed = hashString(masterSeed + "-" + hexId + "-name");
        index = nameSeed % namePool.length;
        const name = namePool[index];
        usedNames.add(name);
        if (window.isLoggingEnabled) {
            writeLogLine(`System Name Selected: ${name}`);
        }
        return name;
    } else {
        // Fallback to current RNG stream
        index = Math.floor(rng() * namePool.length);
        const name = namePool[index];
        // DO NOT splice here; it breaks determinism based on generation order across the session
        usedNames.add(name);
        if (window.isLoggingEnabled) {
            writeLogLine(`System Name Selected: ${name}`);
        }
        return name;
    }
}

// =====================================================================
// INTERSTELLAR CONNECTIVITY (X-BOAT & TRADE)
// =====================================================================

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

function generateXboatRoutes() {
    window.sectorRoutes = [];
    const worlds = [];
    const importantWorlds = [];

    // Step 1: Identify "Important" Worlds (Ix 4+)
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

    const adj = new Map();

    // Step 2: Plot Primary Routes (Jump-4)
    for (let i = 0; i < importantWorlds.length; i++) {
        for (let j = i + 1; j < importantWorlds.length; j++) {
            const w1 = importantWorlds[i];
            const w2 = importantWorlds[j];
            const dist = getHexDistance(w1.q, w1.r, w2.q, w2.r);

            if (dist <= 4 && dist > 0) {
                // Check if there is another important world strictly between them
                // This prevents line stacking (A-B, B-C, and A-C overlapping)
                let isRedundant = false;
                for (let k = 0; k < importantWorlds.length; k++) {
                    const mid = importantWorlds[k];
                    if (mid.id === w1.id || mid.id === w2.id) continue;

                    const d1 = getHexDistance(w1.q, w1.r, mid.q, mid.r);
                    const d2 = getHexDistance(w2.q, w2.r, mid.q, mid.r);

                    // If mid is exactly on the line segment w1-w2
                    if (d1 + d2 === dist) {
                        isRedundant = true;
                        break;
                    }
                }

                if (!isRedundant) {
                    addRoute(w1.id, w2.id, "Xboat", adj);
                }
            }
        }
    }

    // Step 3: Intermediate Bridging (Recursive Search)
    importantWorlds.forEach(v => {
        if (adj.has(v.id) && adj.get(v.id).length > 0) return; // Already connected

        let current = v;
        const visited = new Set([v.id]);
        while (true) {
            let bestW = null, bestIx = -100, bestDist = 100;
            worlds.forEach(w => {
                if (w.id === current.id || visited.has(w.id)) return;
                const dist = getHexDistance(current.q, current.r, w.q, w.r);
                if (dist <= 4) {
                    if (w.ix > bestIx) { bestIx = w.ix; bestW = w; bestDist = dist; }
                    else if (w.ix === bestIx && dist < bestDist) { bestW = w; bestDist = dist; }
                }
            });
            if (!bestW) break;
            addRoute(current.id, bestW.id, "Xboat", adj);
            visited.add(bestW.id);
            // If we hit an Ix 4+ or a node already in the network, we're done
            if (bestW.ix >= 4 || (adj.has(bestW.id) && adj.get(bestW.id).length > 1)) break;
            current = bestW;
        }
    });

    const uniqueNodes = new Set();
    window.sectorRoutes.forEach(r => { uniqueNodes.add(r.startId); uniqueNodes.add(r.endId); });
    console.log(`Routes Generated: ${window.sectorRoutes.length}. Unique Nodes: ${uniqueNodes.size}.`);
}

/**
 * Global helper to add a route with duplicate prevention
 */
function addRoute(id1, id2, type = "Trade", adjMap = null) {
    if (!window.sectorRoutes) window.sectorRoutes = [];
    const sorted = [id1, id2].sort();

    const exists = window.sectorRoutes.some(r => r.startId === sorted[0] && r.endId === sorted[1]);
    if (!exists) {
        window.sectorRoutes.push({ startId: sorted[0], endId: sorted[1], type: type });
        if (adjMap) {
            if (!adjMap.has(id1)) adjMap.set(id1, []);
            if (!adjMap.has(id2)) adjMap.set(id2, []);
            adjMap.get(id1).push(id2);
            adjMap.get(id2).push(id1);
        }
    }
}
