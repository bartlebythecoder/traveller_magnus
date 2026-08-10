// ============================================================================
// DISCLOSURE.JS - Player Fog of War: per-hex disclosure level (Release 2, WP4)
// Parallel architecture to regions.js — a single value per hex, bulk-assigned
// from the right-click menu over the existing selectedHexes set.
// state.disclosure stores the level id ('0'..'g') on each hex.
//
// This module is the DATA MODEL ONLY. It deliberately knows nothing about
// exporting or drawing:
//   WP5 (players' export) consumes it via DisclosureModel.atLeast()
//   WP6 (fogged map)      consumes it the same way
//
// The level definitions below are Sean's, agreed 2026-08-03 and recorded in
// directives/fog_of_war_field_tags.md. That file is the authority for which
// FIELD sits at which level; this file only stores and edits the per-hex value.
// ============================================================================

// ── The ladder ───────────────────────────────────────────────────────────────
// Ordered least- to most-disclosed. Index position IS the comparison order, so
// do not reorder without updating atLeast(). Level '0' was added 2026-08-03
// because (a) was otherwise an unavoidable baseline — see HX-4.
const DISCLOSURE_LEVELS = [
    { id: '0', name: 'Unknown',          hint: 'Hex is blank — no dot, no page, no index row', color: '#4a4a4a' },
    { id: 'a', name: 'Star Present',     hint: 'Star(s) present, travel zone, allegiance, region',  color: '#6c584c' },
    { id: 'b', name: 'Stellar Details',  hint: '+ spectral type, luminosity, mass, star orbits',    color: '#8d6b94' },
    { id: 'c', name: 'Gas Giants',       hint: '+ gas giant presence',                              color: '#5c7aea' },
    { id: 'd', name: 'System Layout',    hint: '+ world count, belts, orbits, body types, name',    color: '#4cc9f0' },
    { id: 'e', name: 'Physical Data',    hint: '+ size, hydrographics, atmosphere, temperature',    color: '#2a9d8f' },
    { id: 'f', name: 'Population & TL',  hint: '+ population, tech level, biosphere, economy',      color: '#8ab17d' },
    { id: 'g', name: 'Full UWP',         hint: 'Everything — UWP, starport, government, socio',     color: '#06d6a0' },
];

// Absent field means FULL disclosure, not hidden. Chosen so that every sector
// saved before this feature existed keeps behaving exactly as it did, and so a
// player export can never silently omit data the GM never chose to hide.
// A GM who wants the opposite selects the sector and assigns 'Unknown' once.
const DISCLOSURE_DEFAULT = 'g';

const DISCLOSURE_ORDER = DISCLOSURE_LEVELS.map(l => l.id);

// ── Core accessors ───────────────────────────────────────────────────────────

function getDisclosureDef(levelId) {
    return DISCLOSURE_LEVELS.find(l => l.id === levelId) || null;
}

// Accepts a hexId or a state object. Always returns a valid level id, so
// callers never have to handle undefined or a value from a hand-edited JSON.
function getDisclosure(hexIdOrState) {
    const state = (typeof hexIdOrState === 'string')
        ? hexStates.get(hexIdOrState)
        : hexIdOrState;
    if (!state) return DISCLOSURE_DEFAULT;
    const val = state.disclosure;
    return DISCLOSURE_ORDER.includes(val) ? val : DISCLOSURE_DEFAULT;
}

function setDisclosure(hexId, levelId) {
    if (!DISCLOSURE_ORDER.includes(levelId)) return false;
    let state = hexStates.get(hexId);
    if (!state) { state = { type: 'BLANK' }; hexStates.set(hexId, state); }
    state.disclosure = levelId;
    return true;
}

// ── "Not set" — a reviewed state, distinct from a level ─────────────────────
//
// getDisclosure() above deliberately keeps its original contract: an absent or
// corrupt value still reads as 'g'. Every exporter depends on that, so it must
// not change. What follows is ADDITIVE — it answers a different question:
// "has the referee ever looked at this system?"
//
// That matters because the default is FULL disclosure. A system nobody has
// reviewed exports everything, so "never set" is the number worth surfacing —
// it is the difference between "I checked this and it is public" and "I have
// not looked at it yet". Nothing here changes what any export produces.
function isDisclosureSet(hexIdOrState) {
    const state = (typeof hexIdOrState === 'string')
        ? hexStates.get(hexIdOrState)
        : hexIdOrState;
    return !!(state && DISCLOSURE_ORDER.includes(state.disclosure));
}

// The stored level, or null when never set / stored garbage. Use this when the
// distinction matters; use getDisclosure() when you need a level to act on.
function getRawDisclosure(hexIdOrState) {
    return isDisclosureSet(hexIdOrState)
        ? ((typeof hexIdOrState === 'string') ? hexStates.get(hexIdOrState) : hexIdOrState).disclosure
        : null;
}

// Return a hex to "never set". Mirrors regions.js's "Clear Region".
function clearDisclosure(hexId) {
    const state = hexStates.get(hexId);
    if (!state) return false;
    delete state.disclosure;
    return true;
}

// The primitive WP5 and WP6 are built on: is a field tagged `required`
// visible at a hex sitting on `current`? Cumulative — 'e' shows everything
// tagged 'a' through 'e'.
function atLeast(current, required) {
    const ci = DISCLOSURE_ORDER.indexOf(current);
    const ri = DISCLOSURE_ORDER.indexOf(required);
    if (ci === -1 || ri === -1) return false;
    return ci >= ri;
}

// Convenience for the two callers that will ask this constantly.
function isHexDisclosed(hexId) {
    return getDisclosure(hexId) !== '0';
}

// ── Bulk-assign modal ────────────────────────────────────────────────────────
// Mirrors openAssignRegionModal in regions.js, including its "no hexes
// selected" guard and its saveHistoryState/showToast bookends.

window.openAssignDisclosureModal = function () {
    document.getElementById('context-menu').classList.remove('visible');
    const count = selectedHexes.size;
    if (count === 0) { showToast('No hexes selected.', 2000); return; }

    document.getElementById('disclosure-assign-modal-count').textContent = count;

    // Show what the selection currently holds, so a GM can see at a glance
    // whether they are about to change a mixed set or a uniform one.
    const present = new Set([...selectedHexes].map(getDisclosure));
    const summaryEl = document.getElementById('disclosure-assign-current');
    if (summaryEl) {
        if (present.size === 1) {
            const def = getDisclosureDef([...present][0]);
            summaryEl.textContent = `Currently: ${def.id.toUpperCase()} — ${def.name}`;
        } else {
            summaryEl.textContent = `Currently: mixed (${present.size} different levels)`;
        }
    }

    const grid = document.getElementById('disclosure-assign-grid');
    grid.innerHTML = '';

    DISCLOSURE_LEVELS.forEach(def => {
        const btn = document.createElement('button');
        btn.className = 'border-assign-btn';
        btn.style.color       = def.color;
        btn.style.borderColor = def.color;
        btn.title = def.hint;
        btn.innerHTML = `<span class="border-assign-num">${def.id.toUpperCase()}</span>`
                      + `<span class="border-assign-name">${def.name}</span>`;
        btn.addEventListener('click', () => window.confirmAssignDisclosure(def.id));
        grid.appendChild(btn);
    });

    document.getElementById('disclosure-assign-modal').style.display = 'flex';
};

window.confirmAssignDisclosure = function (levelId) {
    const def = getDisclosureDef(levelId);
    if (!def) return;
    const hexList = [...selectedHexes];
    saveHistoryState('Assign Disclosure');

    hexList.forEach(hexId => setDisclosure(hexId, levelId));

    document.getElementById('disclosure-assign-modal').style.display = 'none';
    requestAnimationFrame(draw);
    showToast(`${hexList.length} hex(es) set to "${def.name}".`, 2500);
};

// ── Wire up event listeners ──────────────────────────────────────────────────

function setupDisclosureUI() {
    const ctxBtn = document.getElementById('ctx-assign-disclosure');
    if (ctxBtn) ctxBtn.addEventListener('click', window.openAssignDisclosureModal);

    const cancelBtn = document.getElementById('btn-disclosure-assign-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        document.getElementById('disclosure-assign-modal').style.display = 'none';
    });
}

// ── Public surface ───────────────────────────────────────────────────────────

window.DisclosureModel = {
    LEVELS:  DISCLOSURE_LEVELS,
    ORDER:   DISCLOSURE_ORDER,
    DEFAULT: DISCLOSURE_DEFAULT,
    get:     getDisclosure,
    set:     setDisclosure,
    def:     getDisclosureDef,
    atLeast,
    isHexDisclosed,
    // Additive — see the note above setDisclosure. `get` is unchanged.
    isSet:   isDisclosureSet,
    getRaw:  getRawDisclosure,
    clear:   clearDisclosure,
};

window.setupDisclosureUI = setupDisclosureUI;
