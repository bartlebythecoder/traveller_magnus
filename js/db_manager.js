/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: DB Manager
 * Description: IndexedDB persistence layer. Automatically mirrors hexStates,
 *   sectorRoutes, and grid dimensions to IndexedDB so work is preserved across
 *   browser sessions without requiring a manual JSON save.
 *
 *   The in-memory state (hexStates, sectorRoutes) is always authoritative.
 *   All DB writes are background fire-and-forget operations. If the DB is
 *   unavailable or throws, a console warning is emitted and the app continues.
 *
 * Sean Protocol: Zero RPG logic. Pure storage orchestration.
 */

(function () {
    'use strict';

    const DB_NAME    = 'traveller_magnus';
    const DB_VERSION = 1;
    const STORE_HEX  = 'hexStates';
    const STORE_APP  = 'appState';

    let _db        = null;
    let _syncTimer = null;

    // -------------------------------------------------------------------------
    // Internal: open (or reuse) the database connection
    // -------------------------------------------------------------------------
    function _openDB() {
        return new Promise((resolve, reject) => {
            if (_db) { resolve(_db); return; }

            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_HEX)) {
                    database.createObjectStore(STORE_HEX); // key = hexId string
                }
                if (!database.objectStoreNames.contains(STORE_APP)) {
                    database.createObjectStore(STORE_APP); // key = named string
                }
            };

            req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
            req.onerror   = (e) => reject(e.target.error);
        });
    }

    // -------------------------------------------------------------------------
    // Startup: load all persisted data into the in-memory state.
    // Called once on page load before the map becomes interactive.
    // Returns true if any hex data was found (used to trigger an initial draw).
    // -------------------------------------------------------------------------
    async function loadFromDB() {
        try {
            const db = await _openDB();

            // Load app state (gridWidth, gridHeight, routes)
            const appState = await new Promise((resolve) => {
                const tx     = db.transaction(STORE_APP, 'readonly');
                const store  = tx.objectStore(STORE_APP);
                const result = {};
                store.openCursor().onsuccess = (e) => {
                    const cur = e.target.result;
                    if (cur) { result[cur.key] = cur.value; cur.continue(); }
                    else resolve(result);
                };
            });

            if (typeof appState.gridWidth       === 'number') gridWidth             = appState.gridWidth;
            if (typeof appState.gridHeight      === 'number') gridHeight            = appState.gridHeight;
            if (Array.isArray(appState.routes))               window.sectorRoutes   = appState.routes;
            if (typeof appState.autoRouteCounter === 'number') window.autoRouteCounter = appState.autoRouteCounter;

            // Load hex states
            const hexCount = await new Promise((resolve) => {
                const tx    = db.transaction(STORE_HEX, 'readonly');
                const store = tx.objectStore(STORE_HEX);
                let   count = 0;
                hexStates.clear();
                store.openCursor().onsuccess = (e) => {
                    const cur = e.target.result;
                    if (cur) {
                        hexStates.set(cur.key, cur.value);
                        count++;
                        cur.continue();
                    } else {
                        resolve(count);
                    }
                };
            });

            if (hexCount > 0) {
                console.log(`[DB] Loaded ${hexCount} hex(es) from IndexedDB (gridWidth=${gridWidth}, gridHeight=${gridHeight}).`);
            }
            return hexCount > 0;

        } catch (err) {
            console.warn('[DB] loadFromDB failed — starting fresh:', err);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Save all hexes belonging to one sector by numeric sector number.
    // Called after importT5Tab — efficient because it only touches one sector.
    // -------------------------------------------------------------------------
    async function saveHexesBySectorNum(sectorNum) {
        try {
            const prefix = sectorNum + '-';
            const db     = await _openDB();
            const tx     = db.transaction(STORE_HEX, 'readwrite');
            const store  = tx.objectStore(STORE_HEX);
            for (const [hexId, state] of hexStates) {
                if (hexId.startsWith(prefix)) store.put(state, hexId);
            }
        } catch (err) {
            console.warn('[DB] saveHexesBySectorNum failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Save a specific iterable of hexIds (Set or Array).
    // Used for targeted saves after manual edits or generation runs.
    // -------------------------------------------------------------------------
    async function saveHexes(hexIds) {
        if (!hexIds) return;
        try {
            const db    = await _openDB();
            const tx    = db.transaction(STORE_HEX, 'readwrite');
            const store = tx.objectStore(STORE_HEX);
            for (const hexId of hexIds) {
                const state = hexStates.get(hexId);
                if (state !== undefined) store.put(state, hexId);
            }
        } catch (err) {
            console.warn('[DB] saveHexes failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Full sync: replace every hex record with the current in-memory hexStates.
    // Used after JSON load, undo/redo, and Universe import.
    // -------------------------------------------------------------------------
    async function syncAllHexes() {
        try {
            const db = await _openDB();

            // Clear all existing hex records in one transaction
            await new Promise((resolve, reject) => {
                const tx  = db.transaction(STORE_HEX, 'readwrite');
                const req = tx.objectStore(STORE_HEX).clear();
                tx.oncomplete = resolve;
                req.onerror   = reject;
            });

            // Write the current in-memory state
            const db2   = await _openDB();
            const tx    = db2.transaction(STORE_HEX, 'readwrite');
            const store = tx.objectStore(STORE_HEX);
            for (const [hexId, state] of hexStates) {
                store.put(state, hexId);
            }
        } catch (err) {
            console.warn('[DB] syncAllHexes failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Debounced sync — safe to call from high-frequency hooks like
    // saveHistoryState. Waits 2 seconds of inactivity before writing, so a
    // bulk expansion run triggers one DB write rather than thousands.
    // -------------------------------------------------------------------------
    function scheduleSyncAll() {
        if (_syncTimer) clearTimeout(_syncTimer);
        _syncTimer = setTimeout(() => {
            _syncTimer = null;
            syncAllHexes();
            saveRoutes();
        }, 2000);
    }

    // -------------------------------------------------------------------------
    // Persist routes array
    // -------------------------------------------------------------------------
    async function saveRoutes() {
        try {
            const db    = await _openDB();
            const tx    = db.transaction(STORE_APP, 'readwrite');
            tx.objectStore(STORE_APP).put(window.sectorRoutes || [], 'routes');
        } catch (err) {
            console.warn('[DB] saveRoutes failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Persist grid dimensions
    // -------------------------------------------------------------------------
    async function saveGridDimensions() {
        try {
            const db    = await _openDB();
            const tx    = db.transaction(STORE_APP, 'readwrite');
            const store = tx.objectStore(STORE_APP);
            store.put(gridWidth,  'gridWidth');
            store.put(gridHeight, 'gridHeight');
        } catch (err) {
            console.warn('[DB] saveGridDimensions failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Persist the Auto Route sequential counter.
    // -------------------------------------------------------------------------
    async function saveAutoRouteCounter() {
        try {
            const db = await _openDB();
            const tx = db.transaction(STORE_APP, 'readwrite');
            tx.objectStore(STORE_APP).put(window.autoRouteCounter || 0, 'autoRouteCounter');
        } catch (err) {
            console.warn('[DB] saveAutoRouteCounter failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Wipe the entire database.
    // Called before Universe import or when the user starts a new map.
    // -------------------------------------------------------------------------
    async function clearDB() {
        try {
            const db = await _openDB();
            const tx = db.transaction([STORE_HEX, STORE_APP], 'readwrite');
            tx.objectStore(STORE_HEX).clear();
            tx.objectStore(STORE_APP).clear();
        } catch (err) {
            console.warn('[DB] clearDB failed:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    window.dbManager = {
        loadFromDB,
        saveHexesBySectorNum,
        saveHexes,
        syncAllHexes,
        scheduleSyncAll,
        saveRoutes,
        saveGridDimensions,
        saveAutoRouteCounter,
        clearDB
    };

}());
