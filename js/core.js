// =============================================================================
// CORE.JS - Application State & Coordinate Math
// =============================================================================

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------

// Camera state
cameraX = 0;
cameraY = 0;
zoom = 1.0;

// Selection state
selectedHexes = new Set();

// UI Display state
showSubsectorBorders = true;
devView = false;

// Hex state (Map of hexId -> STATE)
hexStates = new Map();

// System Naming State
namePool = [];
usedNames = new Set(JSON.parse(localStorage.getItem('traveller_used_names') || '[]'));

// Hex properties - Renderer needs this immediately
baseHexSize = 50;

// Generation Trace State
const MAX_GEN_TRACES = 5;
let genTraces = [];
let currentTrace = null;
let genTraceCount = 0;
let activeTrace = null;

// -----------------------------------------------------------------------------
// Coordinate Math Functions
// -----------------------------------------------------------------------------

function getHexId(q, r) {
    if (q < 0 || q > 255 || r < 0 || r > 159) return null;
    const sectorX = Math.floor(q / 32);
    const sectorY = Math.floor(r / 40);
    const sectorIndex = sectorY * 8 + sectorX;
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

function getMouseWorldCoords(e) {
    return { x: cameraX + e.clientX / zoom, y: cameraY + e.clientY / zoom };
}

// ============================================================================
// AUDITED UTILITIES & LOGGING (FINAL VERSION)
// ============================================================================

// --- Core Math & Dice ---
async function ensureNamesLoaded() { return true; }
function roll1D() { return Math.floor(Math.random() * 6) + 1; }
function roll2D() { return roll1D() + roll1D(); }
function rollFlux() { return roll1D() - roll1D(); }
function rollD3() { return Math.floor(Math.random() * 3) + 1; }
function rollND(n) {
    let total = 0;
    for (let i = 0; i < n; i++) total += roll1D();
    return total;
}

// --- Traveller Translators ---
function toUWPChar(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    if (val < 10) return val.toString();
    return String.fromCharCode(55 + Math.floor(val));
}

function fromUWPChar(char) {
    if (!char) return 0;
    const code = char.toUpperCase().charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48; // 0-9
    if (code >= 65 && code <= 90) return code - 55; // A-Z (A=10)
    return 0;
}

// --- Logging Suite (Fixes all MgT2E Trace Errors) ---
function startTrace(hexId, ruleset) {
    currentTrace = { ruleset: ruleset, hexId: hexId, lines: [] };
    genTraceCount++;
}

function tSection(title) {
    logTrace(`--- ${title.toUpperCase()} ---`, 'gl-system-header');
}

function tResult(label, value) {
    logTrace(`${label}: ${value}`, 'gl-result');
}

function tDM(label, value) {
    logTrace(`DM (${label}): ${value >= 0 ? '+' : ''}${value}`, 'gl-dm');
}

function tSkip(reason) {
    logTrace(`Skipped: ${reason}`, 'gl-skip');
}

function tTrade(code, reason) {
    logTrace(`Trade Code [${code}]: ${reason}`, 'gl-trade');
}

function tRoll1D(label) {
    const roll = roll1D();
    logTrace(`${label}: Rolled 1D for ${roll}`, 'gl-roll');
    return roll;
}

function tRoll2D(label) {
    const roll = roll2D();
    logTrace(`${label}: Rolled 2D6 for ${roll}`, 'gl-roll');
    return roll;
}

function logTrace(text, cssClass = 'gl-line') {
    if (currentTrace) {
        currentTrace.lines.push({ text: text, cssClass: cssClass });
    }
}

function endTrace() {
    if (currentTrace) {
        genTraces.unshift(currentTrace);
        if (genTraces.length > MAX_GEN_TRACES) genTraces.pop();
        currentTrace = null;
    }
}

// =====================================================================
// NAME GENERATION UTILITIES
// =====================================================================

/**
 * Grabs the next available name from the loaded names.js pool.
 * If the pool is empty or not loaded, it returns "Unnamed System".
 */
function getNextSystemName() {
    if (namePool.length > 0) {
        const index = Math.floor(Math.random() * namePool.length);
        const name = namePool[index];
        namePool.splice(index, 1);
        usedNames.add(name);
        return name;
    }
    return "Unnamed System"; // Fallback if no names are available
}
