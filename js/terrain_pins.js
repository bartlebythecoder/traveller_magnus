'use strict';

// =============================================================================
// TERRAIN_PINS.JS — User-pinned regional map locations (v0.18)
//
// A world offers N site slots. Each slot is either DERIVED (computed from the
// seed by TerrainField.findSites) or PINNED (a location the user chose). A
// pinned slot is never recomputed — the same relationship `_manualFields` /
// isManual() in core.js already has with generated body stats, and for the same
// reason: regeneration must not silently overwrite a deliberate human choice.
//
// At most MAX_PINS slots may be pinned. Slots above that are always derived.
//
// IDENTITY — pins are keyed by hexId + body NAME. The name matches
// PlanetRenderer.imageSeed() and the rest of the terrain code; orbitId is not
// unique and body list indexes differ between engines, and both have caused
// shipped export bugs. The name is the only stable handle.
//
// STORAGE — pins are MAP DATA and live on the hex state, so they travel with a
// saved .json file. See the backend below for why, and for what happens when
// there is no map to write to.
//
// Exposes: window.TerrainPins
// =============================================================================

const TerrainPins = (() => {

    const MAX_PINS = 5;
    const PREFIX   = 'abs.terrainPins.';

    // ── Storage backend ──────────────────────────────────────────────────────
    //
    // Pins are MAP DATA, so they live on the hex state object. io_manager.js and
    // db_manager.js both persist hex states WHOLE, so a pin travels with a saved
    // .json file, survives a browser change and rides the autosave — without a
    // line of serialisation code of its own.
    //
    // They must NEVER be added to HEX_VIEW_STATE_KEYS (core.js). That list is
    // for DERIVED view state, which is deliberately stripped at save time; a pin
    // is a deliberate human choice, and stripping it would throw it away. This
    // is the opposite case to the filter flag that list exists for.
    //
    // Shape on the hex state:
    //   state.terrainPins = { "<body name>": { "0": {...}, "3": {...} } }
    //
    // The key drops masterSeed, which the old flat key carried only because
    // localStorage is shared across every sector a browser has ever opened.
    // Inside one hex of one file there is nothing left to disambiguate.
    //
    // FALLBACK — utilities/test_regional_terrain.html loads this module without
    // core.js, so it has no hexStates to write to. When none is reachable the
    // backend keeps using localStorage, which is what the harness has always
    // had. The app never takes that path.

    function _hexState(hexId) {
        try {
            return (typeof hexStates !== 'undefined' && hexStates &&
                    typeof hexStates.get === 'function')
                ? (hexStates.get(hexId) || null)
                : null;
        } catch (e) { return null; }
    }

    // Hex states reach IndexedDB only when something asks. Pinning deliberately
    // takes no undo snapshot — saveStateForUndo() deep-clones every hex state,
    // which the core.js comment puts at hundreds of MB on a large canvas, and
    // that is far too much to spend on a pin — so it must schedule its own
    // write, or a reload would lose the pin. The trade is that an undo of some
    // LATER action restores a snapshot taken before the pin and drops it, which
    // is how this application treats every edit that takes no snapshot.
    function _persist(hexId) {
        try {
            if (window.dbManager && typeof window.dbManager.saveHexes === 'function') {
                window.dbManager.saveHexes([hexId]);
            }
        } catch (e) { /* best effort */ }
    }

    const _backend = {
        read(key) {
            const st = _hexState(key.hexId);
            if (st) {
                const v = st.terrainPins && st.terrainPins[key.bodyName];
                return (v && typeof v === 'object') ? v : null;
            }
            try {
                const raw = localStorage.getItem(PREFIX + key.legacy);
                return raw ? JSON.parse(raw) : null;
            } catch (e) { return null; }
        },
        // Returns whether the value reached storage that outlives the session,
        // so setPin can say so rather than showing a pin that quietly evaporates.
        write(key, value) {
            const st  = _hexState(key.hexId);
            const has = !!(value && Object.keys(value).length);
            if (st) {
                if (has) {
                    if (!st.terrainPins) st.terrainPins = {};
                    st.terrainPins[key.bodyName] = value;
                } else if (st.terrainPins) {
                    delete st.terrainPins[key.bodyName];
                    if (!Object.keys(st.terrainPins).length) delete st.terrainPins;
                }
                _persist(key.hexId);
                return true;
            }
            try {
                if (has) localStorage.setItem(PREFIX + key.legacy, JSON.stringify(value));
                else     localStorage.removeItem(PREFIX + key.legacy);
                return true;
            } catch (e) { return false; }   // quota or disabled storage
        },
    };

    // ── Carry-over from the localStorage spike ───────────────────────────────
    // Pins made before pins were saved in the file are moved into the hex state
    // the first time that body's map is opened, and the old copy is dropped only
    // once the new one reads back — so a failed move leaves the original alone
    // rather than losing it. Costs one localStorage read per body when there is
    // nothing to move, and never runs twice.
    function _migrateLegacy(key) {
        let raw = null;
        try { raw = localStorage.getItem(PREFIX + key.legacy); } catch (e) { return null; }
        if (!raw) return null;
        let v = null;
        try { v = JSON.parse(raw); } catch (e) { v = null; }
        if (!v || typeof v !== 'object' || !Object.keys(v).length) {
            try { localStorage.removeItem(PREFIX + key.legacy); } catch (e) {}
            return null;
        }
        if (!_hexState(key.hexId)) return v;      // harness — localStorage IS the store
        _backend.write(key, v);
        if (_backend.read(key)) {
            try { localStorage.removeItem(PREFIX + key.legacy); } catch (e) {}
        }
        return v;
    }

    // ── Identity ─────────────────────────────────────────────────────────────

    // Returns a COMPOUND key, not a string: the store is a hex state, which
    // needs the hex and the body separately. `legacy` is the old flat
    // localStorage key, kept so pins made before this change can still be found
    // and carried over, and so the standalone harness keeps working unchanged.
    // The name a body's pins are FILED UNDER. One definition, because the
    // fallback matters: a nameless body files under 'Unnamed', and a caller that
    // guessed '' instead would silently find no pins. export_core.js calls this
    // before looking pins up for the same reason.
    function bodyNameOf(name) {
        return (typeof name === 'string' ? name.trim() : '') || 'Unnamed';
    }

    function bodyKey(masterSeed, hexId, bodyName) {
        const ms = masterSeed || 'default';
        const hx = hexId || '0000';
        const nm = (typeof bodyName === 'string' ? bodyName.trim() : '') || 'w0';
        // toString() matters: utilities/test_regional_terrain.html builds a
        // redraw signature with `key + '#' + ...`, and an object would coerce to
        // "[object Object]" there, dropping the body from the signature and
        // suppressing a redraw when switching bodies. Stringifying to the old
        // flat key keeps every such use working exactly as it did.
        return {
            hexId: hx, bodyName: nm, legacy: `${ms}|${hx}|${nm}`,
            toString() { return this.legacy; },
        };
    }

    // ── Read / write ─────────────────────────────────────────────────────────
    // Stored shape is a sparse object keyed by slot index:
    //   { "0": {lat, lon, widthKm, label, pinnedAt}, "3": {...} }

    function load(key) {
        const v = _backend.read(key);
        if (v && typeof v === 'object') return v;
        return _migrateLegacy(key) || {};
    }

    function pinnedCount(key) {
        return Object.keys(load(key)).length;
    }

    // Returns { ok, reason }. Refuses beyond MAX_PINS unless overwriting a slot
    // that is already pinned (which does not increase the total).
    function setPin(key, slot, pin) {
        const map = load(key);
        const isNew = !(String(slot) in map);
        if (isNew && Object.keys(map).length >= MAX_PINS) {
            return { ok: false, reason: `Limit is ${MAX_PINS} pinned locations. Clear one first.` };
        }
        map[String(slot)] = {
            lat:     +(+pin.lat).toFixed(4),
            lon:     +(+pin.lon).toFixed(4),
            widthKm: +pin.widthKm || 150,
            label:   (pin.label || '').toString().slice(0, 60),
            pinnedAt: pin.pinnedAt || new Date().toISOString().slice(0, 10),
            // The master seed this pin's terrain was built from. A pin stores a
            // lat/lon, not a picture, and the surface is rebuilt from
            // masterSeed + hex + body name every time it is viewed — so under a
            // different seed the same coordinates are different ground. The
            // seed is NOT in the save envelope (it lives in localStorage as
            // traveller_gen_seed), so a file can genuinely arrive under another
            // one. Recorded so mergeSites() can flag that, never to hide it.
            seed: pin.seed || ((typeof masterSeed !== 'undefined' && masterSeed) || ''),
        };
        if (!_backend.write(key, map)) {
            return { ok: false,
                     reason: 'Could not save the pin \u2014 browser storage is full or disabled.' };
        }
        return { ok: true };
    }

    function clearPin(key, slot) {
        const map = load(key);
        delete map[String(slot)];
        _backend.write(key, map);
        return { ok: true };
    }

    function clearAll(key) {
        _backend.write(key, {});
    }

    // ── Merge ────────────────────────────────────────────────────────────────
    // Derived rank i occupies slot i unless slot i is pinned. Pure function —
    // no storage access — so it is trivially testable.
    //
    // `currentSeed` is optional. When given, a pin recorded under a DIFFERENT
    // master seed comes back with `staleSeed: true` — the terrain under it has
    // been rebuilt, so the coordinates now point at different ground. It is
    // still returned and still shown: a pin that silently vanished would be the
    // worse failure, and is the same shape as the filter that outlived its own
    // form in R9. A pin with no recorded seed predates this field and is never
    // flagged, because its provenance is simply unknown.
    function mergeSites(derived, pinMap, count, currentSeed) {
        const out = [];
        for (let i = 0; i < count; i++) {
            const p = pinMap ? pinMap[String(i)] : null;
            if (p) {
                out.push({
                    slot: i, pinned: true,
                    lat: p.lat, lon: p.lon,
                    widthKm: p.widthKm,
                    label: p.label || `Pinned ${i + 1}`,
                    pinnedAt: p.pinnedAt,
                    seed: p.seed,
                    staleSeed: !!(currentSeed && p.seed && p.seed !== currentSeed),
                });
            } else {
                const d = derived[i];
                out.push(d ? {
                    slot: i, pinned: false,
                    lat: d.lat, lon: d.lon,
                    widthKm: null,
                    relief: d.relief,
                    label: `Site ${i + 1}`,
                } : { slot: i, pinned: false, empty: true, label: `Site ${i + 1}` });
            }
        }
        return out;
    }

    return { MAX_PINS, bodyKey, bodyNameOf, load, setPin, clearPin, clearAll,
             pinnedCount, mergeSites };
})();

window.TerrainPins = TerrainPins;
