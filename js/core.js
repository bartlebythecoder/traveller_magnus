// =============================================================================
// CORE.JS - Application State & Coordinate Math
// =============================================================================

// -----------------------------------------------------------------------------
// Global Constants
// -----------------------------------------------------------------------------
const APP_VERSION = "v0.10.2";
const APP_BANNER = "v0.10.2: New: Allegiance Management";

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------

// Camera state (Centered on Sector R by default for fresh instances)
cameraX = 8400 - (window.innerWidth / 2);
cameraY = 8660 - (window.innerHeight / 2);
zoom = 1.0;

/**
 * Re-centers the camera on the middle of the current grid at 1:1 zoom.
 * Call this whenever gridWidth or gridHeight changes (e.g. Universe importer).
 */
function centerCameraOnGrid() {
    const centerQ = Math.floor(gridWidth * 32 / 2);
    const centerR = Math.floor(gridHeight * 40 / 2);
    const size = baseHexSize;
    const widthStep = (3 / 2) * size;
    const heightStep = Math.sqrt(3) * size;
    const offset = (centerQ & 1) ? 0.5 : 0;
    const px = widthStep * centerQ;
    const py = heightStep * (centerR + offset);
    cameraX = px - window.innerWidth / 2;
    cameraY = py - window.innerHeight / 2;
    zoom = 1.0;
}

// Mouse tracking
currentMouseX = 0;
currentMouseY = 0;

// Alt+Drag Route Creation State
isAltDragging = false;
altDragStartId = null;
altDragType = 'Trade';
altDragRouteId = null;

// Key state tracking
keysDown = new Set();

// Selection state
selectedHexes = new Set();

// UI Display state
showSubsectorBorders = true;
devView = false;
hideNoPlanetSystems = true;
showSectorNames = false;

// Sector name store — keyed by integer sector number
window.sectorNames = {};

// Hex state (Map of hexId -> STATE)
hexStates = new Map();

// Route state (Global array of route segment objects)
window.sectorRoutes = [];
window.autoRouteCounter = 0; // Persistent sequential counter for Auto Route group names

// Route definitions (ordered list of named/coloured route lanes)
window.routeDefinitions = [];

/**
 * Returns the 9 default route definitions used on a fresh map.
 * Route IDs are fixed and never change; name/color/shortcut are user-editable.
 */
function getDefaultRouteDefinitions() {
    return [
        { id: 1, name: "XBoat Route",     color: "#00ff00", shortcut: "1", visible: true, automationRef: null },
        { id: 2, name: "Trading Route",   color: "#ff0000", shortcut: "2", visible: true, automationRef: null },
        { id: 3, name: "Secondary Route", color: "#ffff00", shortcut: "3", visible: true, automationRef: null },
        { id: 4, name: "Route 4",         color: "#ff8800", shortcut: "4", visible: true, automationRef: null },
        { id: 5, name: "Route 5",         color: "#00ddff", shortcut: "5", visible: true, automationRef: null },
        { id: 6, name: "Route 6",         color: "#ff44aa", shortcut: "6", visible: true, automationRef: null },
        { id: 7, name: "Route 7",         color: "#aa66ff", shortcut: "7", visible: true, automationRef: null },
        { id: 8, name: "Route 8",         color: "#66aaff", shortcut: "8", visible: true, automationRef: null },
        { id: 9, name: "Route 9",         color: "#aaff44", shortcut: "9", visible: true, automationRef: null }
    ];
}

// System Naming State
namePool = [];
usedNames = new Set(); // Reset every load for machine-agnostic determinism

// Hex properties - Renderer needs this immediately
baseHexSize = 50;

// Grid dimensions — default 7×5 (35 sectors).
// These are runtime variables; the Universe importer will change them.
gridWidth  = 7;
gridHeight = 5;

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
    if (typeof val === 'string' && (val === 'S' || val === 'R' || val === 'GG')) return val;
    const v = Number(val);
    if (isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
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
    // Cap undo history by grid size: 50 snapshots for the default 7×5 canvas,
    // 5 for larger canvases where each snapshot can be hundreds of MB.
    const undoLimit = (gridWidth * gridHeight) > 35 ? 5 : 50;
    window.undoStack.push(stateSnapshot);
    if (window.undoStack.length > undoLimit) window.undoStack.shift();
    window.redoStack = []; // Clear redo stack on new action

    // Schedule a debounced DB sync. Fires 2 seconds after the last action,
    // so bulk generation runs produce one write rather than thousands.
    if (window.dbManager) window.dbManager.scheduleSyncAll();
}

// -----------------------------------------------------------------------------
// Coordinate Math Functions
// -----------------------------------------------------------------------------

/**
 * Converts a legacy letter-based sector identifier to a zero-based index.
 * Supports the old doubled scheme (AA=26, BB=27 ... ZZ=51).
 * Used only during migration of pre-numeric JSON save files.
 */
function legacySectorLetterToIndex(letter) {
    if (!letter || letter.length === 0) return 0;
    if (letter.length === 1) return letter.toUpperCase().charCodeAt(0) - 65;
    // Old scheme: same letter doubled (AA, BB, CC...)
    return (letter.toUpperCase().charCodeAt(0) - 65) + 26;
}

/**
 * Converts a sector slot label (letter OR numeric string) to a sector number (1-based).
 * Letters use the legacy index mapping; numeric strings are parsed directly.
 */
function sectorSlotToNumber(slot) {
    if (!slot) return 1;
    const n = parseInt(slot, 10);
    if (!isNaN(n)) return n;
    return legacySectorLetterToIndex(slot) + 1;
}

function getHexId(q, r) {
    if (q < 0 || r < 0) return null;
    if (q >= gridWidth * 32 || r >= gridHeight * 40) return null;
    const sectorX  = Math.floor(q / 32);
    const sectorY  = Math.floor(r / 40);
    const sectorNum = sectorY * gridWidth + sectorX + 1;
    const subsectorX = Math.floor((q % 32) / 8);
    const subsectorY = Math.floor((r % 40) / 10);
    const subsectorChar = String.fromCharCode(65 + (subsectorY * 4 + subsectorX));
    const localQ = (q % 32) + 1;
    const localR = (r % 40) + 1;
    return `${sectorNum}-${subsectorChar}-${localQ.toString().padStart(2, '0')}${localR.toString().padStart(2, '0')}`;
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
    const sectorNum = parseInt(parts[0], 10);
    if (isNaN(sectorNum) || sectorNum < 1) return null;
    const sectorX = (sectorNum - 1) % gridWidth;
    const sectorY = Math.floor((sectorNum - 1) / gridWidth);
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
    if (val === undefined || val === null || isNaN(val)) {
        if (typeof val === 'string' && (val === 'S' || val === 'R' || val === 'GG')) return val;
        return '0';
    }
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
// MANUAL OVERRIDE HELPERS
// =====================================================================

/**
 * Marks a field on a body/star object as manually set by the user.
 * Engines check this before writing to a field during re-expansion.
 * @param {Object} obj - The body or star object.
 * @param {string} field - The field name to mark as manual.
 */
function markManual(obj, field) {
    if (!obj) return;
    if (!Array.isArray(obj._manualFields)) obj._manualFields = [];
    if (!obj._manualFields.includes(field)) obj._manualFields.push(field);
}

/**
 * Returns true if a field on a body/star object has been manually set.
 * @param {Object} obj - The body or star object.
 * @param {string} field - The field name to check.
 * @returns {boolean}
 */
function isManual(obj, field) {
    if (!obj || !Array.isArray(obj._manualFields)) return false;
    return obj._manualFields.includes(field);
}

/**
 * Clears the manual flag for a specific field, or all fields if none specified.
 * @param {Object} obj - The body or star object.
 * @param {string} [field] - The field to clear. Omit to clear all manual flags.
 */
function clearManual(obj, field) {
    if (!obj || !Array.isArray(obj._manualFields)) return;
    if (field === undefined) {
        obj._manualFields = [];
    } else {
        obj._manualFields = obj._manualFields.filter(f => f !== field);
    }
}

/**
 * Counts all manually-overridden bodies/stars across a CT system.
 * Used by the re-expansion warning dialog.
 * @param {Object} ctSystem - The sys object from stateObj.ctSystem.
 * @returns {number} Total count of stars/bodies with at least one manual field.
 */
function countManualCTBodies(ctSystem) {
    let count = 0;
    if (!ctSystem) return 0;
    (ctSystem.stars || []).forEach(star => {
        if (Array.isArray(star._manualFields) && star._manualFields.length > 0) count++;
    });
    (ctSystem.orbits || []).forEach(slot => {
        const body = slot.contents;
        if (!body) return;
        if (Array.isArray(body._manualFields) && body._manualFields.length > 0) count++;
        (body.satellites || []).forEach(sat => {
            if (Array.isArray(sat._manualFields) && sat._manualFields.length > 0) count++;
        });
    });
    (ctSystem.capturedPlanets || []).forEach(cp => {
        if (Array.isArray(cp._manualFields) && cp._manualFields.length > 0) count++;
    });
    return count;
}

/**
 * Counts all manually-overridden bodies across a T5 system.
 * Used by the re-expansion warning dialog.
 * @param {Object} t5System - The sys object from stateObj.t5System.
 * @returns {number} Total count of bodies with at least one manual field.
 */
function countT5ManualBodies(t5System) {
    let count = 0;
    if (!t5System || !t5System.stars) return 0;
    t5System.stars.forEach(star => {
        if (Array.isArray(star._manualFields) && star._manualFields.length > 0) count++;
        if (!star.orbits) return;
        star.orbits.forEach(o => {
            const body = o.contents;
            if (!body || body.type === 'Empty') return;
            if (Array.isArray(body._manualFields) && body._manualFields.length > 0) count++;
            (body.satellites || []).forEach(sat => {
                if (Array.isArray(sat._manualFields) && sat._manualFields.length > 0) count++;
            });
        });
    });
    return count;
}

/**
 * Counts all manually-overridden bodies across an RTT system.
 * Used by the re-expansion warning dialog.
 * @param {Object} rttSystem - The sys object from stateObj.rttSystem.
 * @returns {number} Total count of bodies with at least one manual field.
 */
function countManualBodies(rttSystem) {
    let count = 0;
    if (!rttSystem || !rttSystem.stars) return 0;
    rttSystem.stars.forEach(star => {
        if (!star.planetarySystem) return;
        star.planetarySystem.orbits.forEach(body => {
            if (Array.isArray(body._manualFields) && body._manualFields.length > 0) count++;
            (body.satellites || []).forEach(sat => {
                if (Array.isArray(sat._manualFields) && sat._manualFields.length > 0) count++;
            });
        });
    });
    return count;
}

/**
 * Counts all manually-overridden bodies across a MgT2E system.
 * Used by the re-expansion warning dialog.
 * @param {Object} mgtSystem - The sys object from stateObj.mgtSystem.
 * @returns {number} Total count of bodies with at least one manual field.
 */
function countManualMgt2eBodies(mgtSystem) {
    let count = 0;
    if (!mgtSystem) return 0;
    (mgtSystem.stars || []).forEach(star => {
        if (Array.isArray(star._manualFields) && star._manualFields.length > 0) count++;
    });
    (mgtSystem.worlds || []).forEach(world => {
        if (Array.isArray(world._manualFields) && world._manualFields.length > 0) count++;
        (world.moons || []).forEach(m => {
            if (Array.isArray(m._manualFields) && m._manualFields.length > 0) count++;
        });
        (world.significantBodies || []).forEach(sb => {
            if (Array.isArray(sb._manualFields) && sb._manualFields.length > 0) count++;
        });
    });
    return count;
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

/**
 * Assigns systematic orbital names to all bodies in a fully-generated MgT2E system.
 * Must be called after all generation phases are complete (world tree fully assembled).
 * - Mainworld keeps the plain system name.
 * - Other primary bodies (sorted by orbitId): "SystemName I", "SystemName II", …
 * - Moons of primaries: "SystemName I-a", "SystemName I-b", …
 * - Moons of the mainworld (rare): "SystemName-a", "SystemName-b", …
 */
function applyMgT2EOrbitalNames(sys) {
    const _mw = (sys.mainworld) ||
                sys.worlds.find(w => w.type === 'Mainworld' || w.isLunarMainworld) ||
                sys.worlds[0];

    if (_mw && !_mw.name) {
        _mw.name = (typeof getNextSystemName === 'function') ? getNextSystemName(sys.hexId) : 'Unnamed';
    }
    const _sysName = (_mw && _mw.name) ||
                     ((typeof getNextSystemName === 'function') ? getNextSystemName(sys.hexId) : 'Unknown');

    const _toRoman = (n) => {
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let r = '';
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
        }
        return r;
    };

    const isMultiStar = sys.stars && sys.stars.length > 1;

    // Group non-mainworld bodies by parentStarIdx for multi-star prefix support
    const starGroups = {};
    sys.worlds
        .filter(w => w.type !== 'Empty' && w.type !== 'Mainworld' && !w.isLunarMainworld)
        .forEach(w => {
            const idx = (w.parentStarIdx !== undefined) ? w.parentStarIdx : 0;
            if (!starGroups[idx]) starGroups[idx] = [];
            starGroups[idx].push(w);
        });

    Object.keys(starGroups).sort((a, b) => Number(a) - Number(b)).forEach(idxStr => {
        const idx = Number(idxStr);
        const namePrefix = isMultiStar
            ? `${_sysName} ${String.fromCharCode(65 + idx)}-`
            : `${_sysName} `;

        const group = starGroups[idx].sort((a, b) => (a.orbitId || 0) - (b.orbitId || 0));
        let _ordinal = 1;
        group.forEach(w => {
            const _roman = _toRoman(_ordinal++);
            w.name = `${namePrefix}${_roman}`;
            if (w.moons && w.moons.length > 0) {
                w.moons.forEach((m, mi) => {
                    if (m.type !== 'Mainworld' && !m.isLunarMainworld) {
                        m.name = `${namePrefix}${_roman}-${String.fromCharCode(97 + mi)}`;
                    }
                });
            }
        });
    });

    if (_mw && _mw.moons && _mw.moons.length > 0) {
        _mw.moons.forEach((m, mi) => {
            if (m.type !== 'Mainworld' && !m.isLunarMainworld) {
                m.name = `${_sysName}-${String.fromCharCode(97 + mi)}`;
            }
        });
    }

    sys.name = _sysName;
}

function applyCTOrbitalNames(sys) {
    if (!sys || !sys.orbits) return;

    let _mw = null;
    for (const slot of sys.orbits) {
        if (slot.contents && slot.contents.type === 'Mainworld') { _mw = slot.contents; break; }
    }
    if (!_mw && sys.capturedPlanets) {
        _mw = sys.capturedPlanets.find(p => p.type === 'Mainworld') || null;
    }

    const _sysName = (_mw && _mw.name) ||
                     sys.name ||
                     ((typeof getNextSystemName === 'function') ? getNextSystemName(sys.hexId || '') : 'Unknown');
    if (_mw && !_mw.name) _mw.name = _sysName;

    const _toRoman = (n) => {
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let r = '';
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
        }
        return r;
    };

    // CT has a flat orbit pool with no per-star attribution — use single ordinal sequence
    const bodies = sys.orbits
        .filter(slot => slot.contents && slot.contents.type !== 'Empty' && slot.contents.type !== 'Mainworld')
        .sort((a, b) => (a.orbit || 0) - (b.orbit || 0))
        .map(slot => slot.contents);

    let _ordinal = 1;
    bodies.forEach(w => {
        const _roman = _toRoman(_ordinal++);
        w.name = `${_sysName} ${_roman}`;
        if (w.satellites && w.satellites.length > 0) {
            // Sort by pd (periapsis distance) to match hex_editor display order
            const sortedSats = [...w.satellites].sort((a, b) => (a.pd || 0) - (b.pd || 0));
            sortedSats.forEach((m, mi) => {
                if (m.type !== 'Mainworld') {
                    m.name = `${_sysName} ${_roman}-${String.fromCharCode(97 + mi)}`;
                }
            });
        }
    });

    sys.name = _sysName;
}

function applyT5OrbitalNames(sys) {
    if (!sys || !sys.stars) return;

    const _mw = sys.mainworld;
    const _hexId = (_mw && _mw.hexId) || sys.hexId || '';
    if (_mw && !_mw.name) {
        _mw.name = (typeof getNextSystemName === 'function') ? getNextSystemName(_hexId) : 'Unnamed';
    }
    const _sysName = (_mw && _mw.name) ||
                     ((typeof getNextSystemName === 'function') ? getNextSystemName(_hexId) : 'Unknown');

    const _toRoman = (n) => {
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let r = '';
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
        }
        return r;
    };

    const isMultiStar = sys.stars.length > 1;

    sys.stars.forEach((star, starIdx) => {
        if (!star.orbits) return;
        const namePrefix = isMultiStar
            ? `${_sysName} ${String.fromCharCode(65 + starIdx)}-`
            : `${_sysName} `;

        const bodies = star.orbits
            .filter(slot => slot.contents && slot.contents !== _mw)
            .sort((a, b) => (a.orbit || 0) - (b.orbit || 0))
            .map(slot => slot.contents);

        let _ordinal = 1;
        bodies.forEach(w => {
            const _roman = _toRoman(_ordinal++);
            w.name = `${namePrefix}${_roman}`;
            if (w.satellites) {
                let satLetterIdx = 0;
                w.satellites.forEach(s => {
                    if (s !== _mw) {
                        s.name = `${namePrefix}${_roman}-${String.fromCharCode(97 + satLetterIdx++)}`;
                    }
                });
            }
        });
    });

    if (_mw && _mw.satellites) {
        _mw.satellites.forEach((s, si) => {
            if (s !== _mw) {
                s.name = `${_sysName}-${String.fromCharCode(97 + si)}`;
            }
        });
    }

    sys.name = _sysName;
}

function applyRTTOrbitalNames(sys) {
    if (!sys || !sys.stars) return;

    const _sysName = sys.name ||
                     ((typeof getNextSystemName === 'function') ? getNextSystemName(sys.hexId || '') : 'Unknown');
    sys.name = _sysName;

    const _toRoman = (n) => {
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let r = '';
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
        }
        return r;
    };

    const isMultiStar = sys.stars.length > 1;

    sys.stars.forEach((star, starIdx) => {
        if (!star.planetarySystem || !star.planetarySystem.orbits) return;
        const namePrefix = isMultiStar
            ? `${_sysName} ${String.fromCharCode(65 + starIdx)}-`
            : `${_sysName} `;

        const bodies = [...star.planetarySystem.orbits]
            .filter(b => !b.isMainworld)
            .sort((a, b) => (a.orbitNumber || 0) - (b.orbitNumber || 0));

        let _ordinal = 1;
        bodies.forEach(b => {
            const _roman = _toRoman(_ordinal++);
            b.name = `${namePrefix}${_roman}`;
            if (b.satellites) {
                let satLetterIdx = 0;
                b.satellites.forEach(s => {
                    if (!s.isMainworld) {
                        s.name = `${namePrefix}${_roman}-${String.fromCharCode(97 + satLetterIdx++)}`;
                    }
                });
            }
        });
    });
}

// calculateT5Ix(), generateXboatRoutes(), and addRoute() live in js/routes.js
