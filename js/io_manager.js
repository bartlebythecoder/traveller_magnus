// ============================================================================
// IO_MANAGER.JS - File Saving, Loading, and Sector Exports
// ============================================================================

// ============================================================================
// SAVE/LOAD MAP STATE
// ============================================================================

function downloadBatchLog(actionName, hexCount) {
    if (!window.batchLogData || window.batchLogData.length === 0) return;

    // Generate Timestamp YYYYMMDD_HHMMSS
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const fileName = `${timestamp}_${actionName}_${hexCount}_Hexes.txt`;
    const content = window.batchLogData.join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Clear memory
    window.batchLogData = [];
}

// Save thresholds (in JSON string character count, which approximates UTF-8 bytes for ASCII JSON)
const SAVE_CHUNK_THRESHOLD = 250 * 1024 * 1024; // 250 MB — single file below this
const SAVE_CHUNK_SIZE      = 250 * 1024 * 1024; // 250 MB per chunk above threshold

/** Promise-based FileReader helper. */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/** Trigger a single blob download. */
function triggerDownload(content, filename) {
    const blob = new Blob([content], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setupSaveLoad() {
    // -----------------------------------------------------------------------
    // SAVE
    // -----------------------------------------------------------------------
    document.getElementById('btn-save-map').addEventListener('click', async () => {
        if (typeof tSection === 'function') tSection("JSON Export: Map & Aesthetics");

        const aesthetics = {
            defaultColor: (typeof window.captureGlobalDefaults === 'function') ? window.captureGlobalDefaults() : '#ffffff',
            activeRules:  window.activeFilterRules || []
        };

        // Build hexStates as a plain object (current format, backward compatible)
        const hexObj = {};
        hexStates.forEach((value, key) => { hexObj[key] = value; });

        const stateObj = {
            version:              APP_VERSION,
            gridWidth,
            gridHeight,
            routes:               window.sectorRoutes || [],
            routeDefinitions:     window.routeDefinitions || [],
            rules:                window.activeFilterRules || [], // legacy support
            aesthetics,
            sectorNames:          window.sectorNames || {},
            hexStates:            hexObj,
            borderDefinitions:    window.borderDefinitions || [],
            hexBorderAssignments: Array.from((window.hexBorderAssignments || new Map()).entries()),
            borderPaths:          Array.from((window.borderPaths || new Map()).entries()),
            regionDefinitions:    window.regionDefinitions || [],
            regionPaths:          Array.from((window.regionPaths || new Map()).entries()),
        };

        // Toast before the blocking stringify so the UI doesn't appear frozen
        if (typeof showToast === 'function') showToast('Preparing save file…', 8000);

        // Yield to the browser to render the toast, then do the heavy work
        await new Promise(r => setTimeout(r, 100));

        try {
            const jsonStr = JSON.stringify(stateObj);

            if (jsonStr.length <= SAVE_CHUNK_THRESHOLD) {
                // ---- Single file (the common case) ----
                if (window.showSaveFilePicker) {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'traveller_map.json',
                        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(jsonStr);
                    await writable.close();
                } else {
                    triggerDownload(jsonStr, 'traveller_map.json');
                }
                if (typeof showToast === 'function') showToast('Map saved successfully.', 3000);

            } else {
                // ---- Chunked save ----
                const sizeMB     = Math.round(jsonStr.length / (1024 * 1024));
                const numChunks  = Math.ceil(jsonStr.length / SAVE_CHUNK_SIZE);
                const entries    = Array.from(hexStates.entries());
                const perChunk   = Math.ceil(entries.length / numChunks);

                const confirmed = confirm(
                    `Your map is approximately ${sizeMB} MB — too large for a single file.\n\n` +
                    `It will be saved in ${numChunks} parts. Keep all ${numChunks} files together;\n` +
                    `you must select all of them at once when loading.\n\n` +
                    `Your work is also auto-saved locally and won't be lost if you skip this.\n\n` +
                    `Continue?`
                );
                if (!confirmed) return;

                for (let i = 0; i < numChunks; i++) {
                    const chunkEntries = entries.slice(i * perChunk, (i + 1) * perChunk);
                    const chunkObj = {
                        version:    APP_VERSION,
                        saveType:   'chunked',
                        part:       i + 1,
                        totalParts: numChunks,
                        gridWidth,
                        gridHeight,
                        hexStates:  chunkEntries   // array of [hexId, state] pairs
                    };
                    // Routes, aesthetics, and border/region state travel with Part 1 only
                    if (i === 0) {
                        chunkObj.routes               = window.sectorRoutes || [];
                        chunkObj.rules                = window.activeFilterRules || [];
                        chunkObj.aesthetics           = aesthetics;
                        chunkObj.borderDefinitions    = window.borderDefinitions || [];
                        chunkObj.hexBorderAssignments = Array.from((window.hexBorderAssignments || new Map()).entries());
                        chunkObj.borderPaths          = Array.from((window.borderPaths || new Map()).entries());
                        chunkObj.regionDefinitions    = window.regionDefinitions || [];
                        chunkObj.regionPaths          = Array.from((window.regionPaths || new Map()).entries());
                    }

                    triggerDownload(
                        JSON.stringify(chunkObj),
                        `traveller_map_Part${i + 1}of${numChunks}.json`
                    );

                    // Brief pause so the browser doesn't suppress sequential downloads
                    if (i < numChunks - 1) await new Promise(r => setTimeout(r, 400));
                }

                if (typeof showToast === 'function') {
                    showToast(`Saved in ${numChunks} parts. Select all files together when loading.`, 6000);
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Save failed:", err);
                alert("Failed to save file. Check console for details.");
            }
        }
    });

    // -----------------------------------------------------------------------
    // LOAD
    // -----------------------------------------------------------------------
    document.getElementById('file-load-map').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = ''; // reset so the same file can be reloaded
        if (files.length === 0) return;

        try {
            if (files.length === 1) {
                // --- Single file selected ---
                const text = await readFileAsText(files[0]);
                const data = JSON.parse(text);

                if (data.saveType === 'chunked' && data.totalParts > 1) {
                    alert(
                        `This is Part ${data.part} of ${data.totalParts} of a chunked save.\n\n` +
                        `Please select all ${data.totalParts} parts at once to load your map.`
                    );
                    return;
                }

                applyLoadedMapData(data);

            } else {
                // --- Multiple files selected — must be a chunked save ---
                const parts = [];
                for (const file of files) {
                    const text = await readFileAsText(file);
                    const data = JSON.parse(text);
                    if (!data.saveType || data.saveType !== 'chunked') {
                        alert('One or more selected files is not a chunked save part. Please select only the parts of a single chunked save.');
                        return;
                    }
                    parts.push(data);
                }

                // Sort by part number
                parts.sort((a, b) => a.part - b.part);

                const totalParts = parts[0].totalParts;

                // Validate correct number of parts
                if (parts.length !== totalParts) {
                    alert(`This save has ${totalParts} parts but ${parts.length} were selected. Please select all ${totalParts} parts together.`);
                    return;
                }

                // Validate no gaps (e.g. parts 1, 2, 4 with 3 missing)
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].part !== i + 1) {
                        alert(`Part ${i + 1} of ${totalParts} is missing. Please select all parts together.`);
                        return;
                    }
                }

                // Merge all hexStates chunks into a single object
                const mergedHexStates = {};
                for (const part of parts) {
                    if (Array.isArray(part.hexStates)) {
                        for (const [hexId, state] of part.hexStates) {
                            mergedHexStates[hexId] = state;
                        }
                    }
                }

                // Build a unified data object using metadata from Part 1
                const merged = {
                    version:    parts[0].version,
                    gridWidth:  parts[0].gridWidth,
                    gridHeight: parts[0].gridHeight,
                    routes:     parts[0].routes     || [],
                    rules:      parts[0].rules       || [],
                    aesthetics: parts[0].aesthetics  || {},
                    hexStates:  mergedHexStates
                };

                applyLoadedMapData(merged);
                if (typeof showToast === 'function') {
                    showToast(`Loaded ${parts.length}-part save successfully.`, 3000);
                }
            }
        } catch (err) {
            alert(`Error loading map file: ${err.message}`);
            console.error("Load error:", err);
        }
    });

    const btnSolo6 = document.getElementById('btn-load-solo6');
    if (btnSolo6) {
        btnSolo6.addEventListener('click', () => {
            if (!window.SOLO_6_DATA) {
                alert("Solo 6 sector data not found. Run convert_solo6.ps1 to generate js/solo_6_data.js.");
                return;
            }
            applyLoadedMapData(window.SOLO_6_DATA);
        });
    }

    const btnClear = document.getElementById('btn-clear-canvas');
    if (btnClear) btnClear.addEventListener('click', clearCanvas);
}

/**
 * Wipes all map data and resets the canvas to the default 7×5 grid.
 * Clears IndexedDB so the next startup starts fresh.
 * Triggered by the Settings button or Ctrl+Delete.
 */
async function clearCanvas() {
    const confirmed = confirm(
        'Clear Canvas will erase all hex data, routes, borders, and auto-saved progress.\n\n' +
        'The canvas will reset to the default 7×5 grid.\n\n' +
        'This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    // Wipe IndexedDB so the next startup doesn't reload old data
    if (window.dbManager) await window.dbManager.clearDB();

    // Reset grid dimensions to default
    gridWidth  = 7;
    gridHeight = 5;

    // Clear all in-memory state
    hexStates.clear();
    window.sectorNames        = {};
    window.sectorRoutes      = [];
    window.routeDefinitions  = (typeof getDefaultRouteDefinitions === 'function') ? getDefaultRouteDefinitions() : [];
    window.undoStack         = [];
    window.redoStack         = [];
    selectedHexes.clear();

    // Reset all border/region state to defaults
    window.hexBorderAssignments = new Map();
    window.borderPaths          = new Map();
    window.regionPaths          = new Map();
    window.borderDefinitions    = (typeof getDefaultBorderDefinitions === 'function') ? getDefaultBorderDefinitions() : [];
    window.regionDefinitions    = (typeof getDefaultRegionDefinitions === 'function') ? getDefaultRegionDefinitions() : [];
    if (typeof window.renderBorderWindow === 'function') window.renderBorderWindow();
    if (typeof window.renderRegionWindow === 'function') window.renderRegionWindow();

    // Re-centre camera on the fresh 7×5 canvas
    centerCameraOnGrid();

    if (typeof draw === 'function') requestAnimationFrame(draw);
    if (typeof showToast === 'function') showToast('Canvas cleared. Ready for a new map.', 3000);
}

/**
 * Migrates a hexStates object and routes array from the legacy letter-based
 * sector ID scheme to the current numeric scheme.
 * Legacy scheme: A=1, B=2 ... Z=26, AA=27, BB=28 ... on a fixed 7×5 grid.
 * Returns { hexStates, routes } with numeric IDs.
 */
function migrateLegacyIds(legacyHexStates, legacyRoutes) {
    const migrateHexId = (hexId) => {
        if (!hexId) return hexId;
        const parts = hexId.split('-');
        if (parts.length < 3) return hexId;
        if (isNaN(parseInt(parts[0], 10))) {
            const sectorNum = legacySectorLetterToIndex(parts[0]) + 1;
            return `${sectorNum}-${parts[1]}-${parts[2]}`;
        }
        return hexId;
    };

    const migratedHexStates = {};
    for (const key in legacyHexStates) {
        migratedHexStates[migrateHexId(key)] = legacyHexStates[key];
    }

    const migratedRoutes = (legacyRoutes || []).map(route => ({
        ...route,
        startId: migrateHexId(route.startId),
        endId:   migrateHexId(route.endId)
    }));

    return { hexStates: migratedHexStates, routes: migratedRoutes };
}

/**
 * Migrates a segments array that predates routeDefinitions (v0.9.x and earlier).
 * - Xboat → routeId 1, Trade → routeId 2, Secondary → routeId 3
 * - Each unique Filter groupId → routeId 4, 5, ... with a definition built from the segment data
 * Returns { routeDefinitions, routes } with routeId stamped on every segment.
 */
function migrateToRouteDefinitions(segments) {
    const defs = (typeof getDefaultRouteDefinitions === 'function')
        ? getDefaultRouteDefinitions()
        : [
            { id: 1, name: "XBoat Route",     color: "#00ff00", shortcut: "g", visible: true, automationRef: null },
            { id: 2, name: "Trading Route",   color: "#ff0000", shortcut: "r", visible: true, automationRef: null },
            { id: 3, name: "Secondary Route", color: "#ffff00", shortcut: "y", visible: true, automationRef: null }
          ];

    const groupIdToRouteId = {};
    let nextId = 4;

    const migratedSegments = (segments || []).map(seg => {
        let routeId;
        if (seg.type === 'Xboat')     routeId = 1;
        else if (seg.type === 'Trade')     routeId = 2;
        else if (seg.type === 'Secondary') routeId = 3;
        else if (seg.type === 'Filter') {
            const gid = seg.groupId || '_ungrouped';
            if (groupIdToRouteId[gid] === undefined) {
                groupIdToRouteId[gid] = nextId;
                defs.push({
                    id: nextId,
                    name: seg.name || gid,
                    color: seg.color || '#ffffff',
                    shortcut: null,
                    visible: true,
                    automationRef: null,
                    groupId: gid
                });
                nextId++;
            }
            routeId = groupIdToRouteId[gid];
        } else {
            routeId = 1;
        }
        return { ...seg, routeId };
    });

    return { routeDefinitions: defs, routes: migratedSegments };
}

function applyLoadedMapData(parsedData) {
    saveHistoryState('Load Map JSON');
    hexStates.clear();

    if (parsedData.hexStates) {
        if (typeof tSection === 'function') tSection("JSON Import: Analyzing Map Manifest");

        // Restore grid dimensions, or detect legacy and migrate.
        if (parsedData.gridWidth && parsedData.gridHeight) {
            gridWidth  = parsedData.gridWidth;
            gridHeight = parsedData.gridHeight;
        } else {
            // Legacy file — no grid block means fixed 7×5 with letter-based IDs.
            gridWidth  = 7;
            gridHeight = 5;
            const firstKey = Object.keys(parsedData.hexStates)[0] || '';
            const firstPart = firstKey.split('-')[0] || '';
            if (isNaN(parseInt(firstPart, 10))) {
                if (typeof writeLogLine === 'function') writeLogLine('JSON Load: Legacy letter-based IDs detected — migrating to numeric scheme.');
                const migrated = migrateLegacyIds(parsedData.hexStates, parsedData.routes);
                parsedData = { ...parsedData, hexStates: migrated.hexStates, routes: migrated.routes };
                if (typeof writeLogLine === 'function') writeLogLine(`JSON Load: Migration complete — ${Object.keys(migrated.hexStates).length} hex(es) converted.`);
            }
        }

        for (const key in parsedData.hexStates) {
            hexStates.set(key, parsedData.hexStates[key]);
        }

        // Backfill beltCount/gasGiantCount for states saved before this feature existed
        if (typeof window.computeSystemCounts === 'function') {
            let backfillCount = 0;
            hexStates.forEach(state => {
                if (state.type === 'SYSTEM_PRESENT' && state.beltCount === undefined) {
                    window.computeSystemCounts(state);
                    backfillCount++;
                }
            });
            if (typeof writeLogLine === 'function' && backfillCount > 0) {
                writeLogLine(`JSON Load: Backfilled belt/GG counts for ${backfillCount} pre-update system(s).`);
            }
        }

        // Restore routes — migrate to routeDefinitions model if save predates v0.10.0
        if (parsedData.routeDefinitions && parsedData.routeDefinitions.length > 0) {
            window.routeDefinitions = parsedData.routeDefinitions;
            window.sectorRoutes     = parsedData.routes || [];
            if (typeof writeLogLine === 'function') writeLogLine(`JSON Load: Route definitions restored (${window.routeDefinitions.length} routes).`);
        } else {
            const migrated = migrateToRouteDefinitions(parsedData.routes || []);
            window.routeDefinitions = migrated.routeDefinitions;
            window.sectorRoutes     = migrated.routes;
            if (typeof writeLogLine === 'function') writeLogLine(`JSON Load: Legacy routes migrated — ${window.routeDefinitions.length} route definition(s) created.`);
        }

        window.sectorNames  = parsedData.sectorNames || {};

        // Restore border and region state
        window.borderDefinitions    = Array.isArray(parsedData.borderDefinitions) && parsedData.borderDefinitions.length > 0
            ? parsedData.borderDefinitions
            : (typeof getDefaultBorderDefinitions === 'function' ? getDefaultBorderDefinitions() : []);
        // Migrate old single-string allegiance to allegianceCodes array
        window.borderDefinitions.forEach(def => {
            if (def.allegiance && !def.allegianceCodes) def.allegianceCodes = [def.allegiance];
        });
        window.hexBorderAssignments = Array.isArray(parsedData.hexBorderAssignments)
            ? new Map(parsedData.hexBorderAssignments)
            : new Map();
        window.borderPaths          = Array.isArray(parsedData.borderPaths)
            ? new Map(parsedData.borderPaths)
            : new Map();

        // Restore region definitions, auto-creating slots for any cluster labels not yet in the list
        window.regionDefinitions = Array.isArray(parsedData.regionDefinitions) && parsedData.regionDefinitions.length > 0
            ? parsedData.regionDefinitions
            : (typeof getDefaultRegionDefinitions === 'function' ? getDefaultRegionDefinitions() : []);
        // Ensure minimum 10 slots
        while (window.regionDefinitions.length < 10) {
            const nextId = window.regionDefinitions.length + 1;
            const CYCLE = typeof REGION_COLOR_CYCLE !== 'undefined' ? REGION_COLOR_CYCLE : [];
            window.regionDefinitions.push({
                id: nextId, name: `Region ${nextId}`,
                color: CYCLE[(nextId - 1) % CYCLE.length] || '#888888', visible: true,
            });
        }
        // Auto-create slots for cluster labels not yet covered (legacy/imported data)
        const knownRegionNames = new Set(window.regionDefinitions.map(d => d.name));
        const usedClusterNames = new Set();
        hexStates.forEach(state => { if (state.cluster && state.cluster !== '----') usedClusterNames.add(state.cluster); });
        usedClusterNames.forEach(label => {
            if (knownRegionNames.has(label)) return;
            knownRegionNames.add(label);
            const CYCLE = typeof REGION_COLOR_CYCLE !== 'undefined' ? REGION_COLOR_CYCLE : [];
            // Claim a free default-named slot (no hex assignments)
            const free = window.regionDefinitions.find(d => /^Region \d+$/.test(d.name) && !usedClusterNames.has(d.name));
            if (free) {
                free.name = label;
            } else {
                const nextId = Math.max(...window.regionDefinitions.map(d => d.id)) + 1;
                window.regionDefinitions.push({ id: nextId, name: label, color: CYCLE[(nextId - 1) % CYCLE.length] || '#888888', visible: true });
            }
        });

        window.regionPaths          = Array.isArray(parsedData.regionPaths)
            ? new Map(parsedData.regionPaths)
            : new Map();
        if (typeof window.renderBorderWindow === 'function') window.renderBorderWindow();
        if (typeof window.renderRegionWindow === 'function') window.renderRegionWindow();
        if (typeof writeLogLine === 'function') writeLogLine(`JSON Load: Border definitions (${window.borderDefinitions.length}), border assignments (${window.hexBorderAssignments.size}), region definitions (${window.regionDefinitions.length}), region paths (${window.regionPaths.size}) restored.`);

        // Priority Rule Capture: Use aesthetics.activeRules if available, else fallback to legacy field
        window.activeFilterRules = parsedData.rules || [];
        if (parsedData.aesthetics && parsedData.aesthetics.activeRules) {
            window.activeFilterRules = parsedData.aesthetics.activeRules;
        }

        // Restore Global Default Appearance
        if (parsedData.aesthetics && parsedData.aesthetics.defaultColor) {
            const defaultColor = parsedData.aesthetics.defaultColor;
            const defaultInput = document.getElementById('default-dot-color');
            if (defaultInput) {
                defaultInput.value = defaultColor;
                if (typeof tResult === 'function') tResult("Restored Global Default Color", defaultColor);
            }
        }

        if (typeof tResult === 'function') {
            tResult("Hexes Loaded", hexStates.size);
            tResult("Routes Loaded", window.sectorRoutes.length);
            tResult("Rules Restored", window.activeFilterRules.length);
        }

        // Re-sync UI and redraw map based on loaded rules
        if (typeof window.renderRulesLedger === 'function') window.renderRulesLedger();
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();
    } else {
        // Fallback for old format
        if (typeof writeLogLine === 'function') writeLogLine("Importing legacy map format (flat state)...");
        for (const key in parsedData) {
            hexStates.set(key, parsedData[key]);
        }

        // Backfill beltCount/gasGiantCount for states saved before this feature existed
        if (typeof window.computeSystemCounts === 'function') {
            let backfillCount = 0;
            hexStates.forEach(state => {
                if (state.type === 'SYSTEM_PRESENT' && state.beltCount === undefined) {
                    window.computeSystemCounts(state);
                    backfillCount++;
                }
            });
            if (typeof writeLogLine === 'function' && backfillCount > 0) {
                writeLogLine(`JSON Load (legacy): Backfilled belt/GG counts for ${backfillCount} pre-update system(s).`);
            }
        }
    }

    selectedHexes.clear();
    document.getElementById('context-menu').classList.remove('visible');
    requestAnimationFrame(draw);

    if (typeof showToast === 'function') showToast("Map loaded successfully!", 2000);

    // Sync the freshly loaded state to IndexedDB, replacing whatever was there.
    if (window.dbManager) {
        window.dbManager.syncAllHexes();
        window.dbManager.saveRoutes();
        window.dbManager.saveGridDimensions();
    }
}

// ============================================================================
// SECTOR EXPORT PICKER
// ============================================================================

function getAvailableSectors() {
    const sectors = new Map();
    hexStates.forEach((state, hexId) => {
        // HexId format: {SectorID}-{SubsectorID}-{Location}
        const parts = hexId.split('-');
        if (parts.length >= 1) {
            const sectorID = parts[0];
            const currentCount = sectors.get(sectorID) || 0;
            sectors.set(sectorID, currentCount + 1);
        }
    });

    const result = [];
    sectors.forEach((count, id) => {
        result.push({ id, name: `Sector ${id}`, count });
    });
    return result;
}

function setupSectorPicker() {
    const openBtn     = document.getElementById('btn-open-sector-export');
    const xmlBtn      = document.getElementById('btn-export-xml-metadata');
    const closeBtn    = document.getElementById('btn-close-sector-picker');
    const modal       = document.getElementById('sector-picker-modal');
    const listContainer = document.getElementById('sector-list');

    function openPicker(mode) {
        modal.dataset.exportMode = mode;
        const sectors = getAvailableSectors();
        listContainer.innerHTML = '';

        if (sectors.length === 0) {
            listContainer.innerHTML = '<p style="color: #666; grid-column: 1/-1;">No sectors discovered in memory. Populate some hexes first!</p>';
        } else {
            sectors.forEach(s => {
                const tile = document.createElement('div');
                tile.className = 'sector-tile';
                tile.innerHTML = `
                    <strong>${s.name}</strong>
                    <span>${s.count} Data Points</span>
                `;
                tile.onclick = () => {
                    if (modal.dataset.exportMode === 'xml') {
                        exportMetadataXml(s.id);
                    } else {
                        generateT5TabData(s.id);
                        exportMetadataXml(s.id);
                        showToast(`Exported ${s.name} Data and Routes`, 2000);
                    }
                    modal.style.display = 'none';
                };
                listContainer.appendChild(tile);
            });
        }
        modal.style.display = 'flex';
    }

    if (openBtn)  openBtn.addEventListener('click',  () => openPicker('full'));
    if (xmlBtn)   xmlBtn.addEventListener('click',   () => openPicker('xml'));
    if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
}

/**
 * TravellerMap Route XML Export
 */
function exportRoutesToXML(sectorID) {
    if (!window.sectorRoutes || window.sectorRoutes.length === 0) return;

    // Calculate X, Y grid coordinates for the sector from its numeric ID.
    const sNum = parseInt(sectorID, 10);
    const sX = (sNum - 1) % gridWidth;
    const sY = Math.floor((sNum - 1) / gridWidth);

    let xmlLines = [
        '<?xml version="1.0"?>',
        '<Sector>',
        `<Name>Sector ${sectorID}</Name>`,
        `<X>${sX}</X>`,
        `<Y>${sY}</Y>`,
        '<Routes>'
    ];
    let count = 0;

    window.sectorRoutes.forEach(route => {
        const sParts = route.startId.split('-');
        const eParts = route.endId.split('-');

        // Both ends must be in the same sector for this export
        if (sParts[0] === sectorID && eParts[0] === sectorID) {
            const startId = route.startId;
            const endId = route.endId;

            // Rule: Only include if both hexes exist and are SYSTEM_PRESENT
            const startState = hexStates.get(startId);
            const endState = hexStates.get(endId);

            if (startState?.type === 'SYSTEM_PRESENT' && endState?.type === 'SYSTEM_PRESENT') {
                const startHex = sParts[sParts.length - 1];
                const endHex = eParts[eParts.length - 1];

                // Validate 4-digit hex format and bounds (Max 3240)
                const isValidHex = (hex) => {
                    if (!/^\d{4}$/.test(hex)) return false;
                    const q = parseInt(hex.substring(0, 2), 10);
                    const r = parseInt(hex.substring(2, 4), 10);
                    return q >= 1 && q <= 32 && r >= 1 && r <= 40;
                };

                if (isValidHex(startHex) && isValidHex(endHex)) {
                    let type = route.type || "Trade";
                    let style = "Dashed";
                    let color = "Gray";

                    if (type === 'Xboat') {
                        type = "Communication";
                        style = "Solid";
                        color = "Green";
                    } else if (type === 'Trade') {
                        style = "Dashed";
                        color = "Red";
                    } else if (type === 'Secondary') {
                        style = "Dashed";
                        color = "Yellow";
                    }

                    xmlLines.push(`  <Route Start="${startHex}" End="${endHex}" Type="${type}" Style="${style}" Color="${color}" />`);
                    count++;
                }
            }
        }
    });

    if (count === 0) return;

    xmlLines.push('</Routes>');
    xmlLines.push('</Sector>');
    const content = xmlLines.join('\n');
    const blob = new Blob([content], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sector_${sectorID}_Routes.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Converts a list of local XXYY hex codes (interior of a border/region) into one or more
 * MSEC-format perimeter waypoint strings suitable for TravellerMap <Border>/<Region> elements.
 * Returns an array — one string per connected component — so callers emit one element each.
 *
 * Algorithm: flood-fill to find connected components, then for each component trace the
 * clockwise boundary starting from the topmost (min-r) hex in the leftmost (min-q) column
 * using a right-hand-rule walk on the flat-top odd-column-offset hex grid.
 */
function computeMsecPath(localXxyyCodes, sectorNum) {
    if (!localXxyyCodes || localXxyyCodes.length === 0) return [];

    const sX = (sectorNum - 1) % gridWidth;
    const sY = Math.floor((sectorNum - 1) / gridWidth);

    function toGlobal(code) {
        const v = parseInt(code, 10);
        return { q: sX * 32 + Math.floor(v / 100) - 1, r: sY * 40 + (v % 100) - 1 };
    }
    function toXxyy(q, r) {
        const col = q - sX * 32 + 1;
        const row = r - sY * 40 + 1;
        return String(col).padStart(2, '0') + String(row).padStart(2, '0');
    }
    // 6 neighbours in directions 0-5 (flat-top, odd-column-shifted-down offset grid)
    // Clockwise visual order: N(4) → NE(5) → SE(0) → S(1) → SW(2) → NW(3)
    function nbrs(q, r) {
        const p = q & 1;
        return [
            [q + 1, r + (p ? 1 : 0)],   // 0 SE/E
            [q,     r + 1],              // 1 S
            [q - 1, r + (p ? 1 : 0)],   // 2 SW/W
            [q - 1, r + (p ? 0 : -1)],  // 3 NW
            [q,     r - 1],              // 4 N
            [q + 1, r + (p ? 0 : -1)],  // 5 NE
        ];
    }

    // Build global coord set (deduplicated)
    const coordSet = new Set();
    const allCoords = [];
    localXxyyCodes.forEach(code => {
        if (!code || code.length !== 4) return;
        const { q, r } = toGlobal(code);
        const key = `${q},${r}`;
        if (!coordSet.has(key)) { coordSet.add(key); allCoords.push({ q, r }); }
    });
    if (allCoords.length === 0) return [];

    // Flood-fill to find connected components
    const visited = new Set();
    const components = [];
    allCoords.forEach(({ q, r }) => {
        const key = `${q},${r}`;
        if (visited.has(key)) return;
        const comp = [];
        const queue = [{ q, r }];
        visited.add(key);
        while (queue.length > 0) {
            const cur = queue.shift();
            comp.push(cur);
            nbrs(cur.q, cur.r).forEach(([nq, nr]) => {
                const nk = `${nq},${nr}`;
                if (coordSet.has(nk) && !visited.has(nk)) { visited.add(nk); queue.push({ q: nq, r: nr }); }
            });
        }
        components.push(comp);
    });

    const results = [];
    components.forEach(comp => {
        if (comp.length === 1) {
            results.push(toXxyy(comp[0].q, comp[0].r));
            return;
        }

        const compSet = new Set(comp.map(h => `${h.q},${h.r}`));

        // Start: topmost hex in leftmost column (min q, then min r for that q)
        let startQ = Infinity, startR = Infinity;
        comp.forEach(({ q, r }) => {
            if (q < startQ || (q === startQ && r < startR)) { startQ = q; startR = r; }
        });

        // Clockwise boundary walk (right-hand rule)
        // fromDir = direction index pointing back toward where we "came from"
        const path = [];
        let curQ = startQ, curR = startR;
        let fromDir = 4; // initially came from N (empty space above the topmost hex)
        const maxSteps = comp.length * 6 + 6;

        for (let step = 0; step < maxSteps; step++) {
            path.push(toXxyy(curQ, curR));
            let moved = false;
            const neighbours = nbrs(curQ, curR);
            for (let i = 0; i < 6; i++) {
                const tryDir = (fromDir + 1 + i) % 6;
                const [nq, nr] = neighbours[tryDir];
                if (compSet.has(`${nq},${nr}`)) {
                    fromDir = (tryDir + 3) % 6; // reverse: direction from new hex back to current
                    curQ = nq; curR = nr;
                    moved = true;
                    break;
                }
            }
            if (!moved || (curQ === startQ && curR === startR)) break;
        }

        results.push(path.join(' '));
    });

    return results;
}

/**
 * Export routes, borders, and regions for a sector as a TravellerMap metadata XML file.
 * Routes with one end in an adjacent sector carry EndOffsetX/Y attributes.
 * Borders and regions re-use the original polygon paths stored during import when
 * available; falls back to computing MSEC perimeter paths from interior hex assignments.
 */
function exportMetadataXml(sectorID) {
    const sectorNum = parseInt(sectorID, 10);
    const sectorX   = (sectorNum - 1) % gridWidth;
    const sectorY   = Math.floor((sectorNum - 1) / gridWidth);
    const secPrefix = sectorNum + '-';

    // ── Routes ────────────────────────────────────────────────────────────────
    const routeLines = [];
    const defs   = window.routeDefinitions || [];
    const defMap = new Map(defs.map(d => [d.id, d]));

    (window.sectorRoutes || []).forEach(route => {
        const sParts    = route.startId.split('-');
        const eParts    = route.endId.split('-');
        const startSlot = parseInt(sParts[0], 10);
        const endSlot   = parseInt(eParts[0], 10);
        if (startSlot !== sectorNum && endSlot !== sectorNum) return;

        const startHex = sParts[sParts.length - 1];
        const endHex   = eParts[eParts.length - 1];
        const def      = defMap.get(route.routeId);
        const color    = def ? def.color : '#ffffff';

        let startOffsetAttr = '';
        let endOffsetAttr   = '';
        if (startSlot !== sectorNum) {
            const offX = ((startSlot - 1) % gridWidth) - sectorX;
            const offY = Math.floor((startSlot - 1) / gridWidth) - sectorY;
            if (offX !== 0) startOffsetAttr += ` StartOffsetX="${offX}"`;
            if (offY !== 0) startOffsetAttr += ` StartOffsetY="${offY}"`;
        }
        if (endSlot !== sectorNum) {
            const offX = ((endSlot - 1) % gridWidth) - sectorX;
            const offY = Math.floor((endSlot - 1) / gridWidth) - sectorY;
            if (offX !== 0) endOffsetAttr += ` EndOffsetX="${offX}"`;
            if (offY !== 0) endOffsetAttr += ` EndOffsetY="${offY}"`;
        }
        routeLines.push(`    <Route Start="${startHex}"${startOffsetAttr} End="${endHex}"${endOffsetAttr} Color="${color}" />`);
    });

    // ── Borders ───────────────────────────────────────────────────────────────
    const borderLines      = [];
    const storedBorderPaths = window.borderPaths || new Map();
    const borderDefs       = window.borderDefinitions || [];
    const hexBorders       = window.hexBorderAssignments || new Map();

    borderDefs.forEach(def => {
        const pathEntries = storedBorderPaths.get(def.id);
        if (pathEntries && pathEntries.length > 0) {
            pathEntries.forEach(({ rawPath, labelPos, allegianceCode: pathAllegCode }) => {
                const allegCode = pathAllegCode || (def.allegianceCodes && def.allegianceCodes[0]) || def.allegiance || '';
                const allegAttr = allegCode ? ` Allegiance="${allegCode}"` : '';
                const colorAttr = def.color ? ` Color="${def.color}"` : '';
                const labelAttr = def.name ? ` Label="${def.name}"` : '';
                const lpAttr    = labelPos ? ` LabelPosition="${labelPos}"` : '';
                borderLines.push(`    <Border${allegAttr}${colorAttr}${labelAttr}${lpAttr}>${rawPath}</Border>`);
            });
        } else {
            // Fallback: compute MSEC perimeter path from assigned interior hexes
            const hexCodes = [];
            hexBorders.forEach((borderId, hexId) => {
                if (borderId !== def.id) return;
                if (!hexId.startsWith(secPrefix)) return;
                hexCodes.push(hexId.split('-').pop());
            });
            if (hexCodes.length === 0) return;
            const allegCode = (def.allegianceCodes && def.allegianceCodes[0]) || def.allegiance || '';
            const allegAttr = allegCode ? ` Allegiance="${allegCode}"` : '';
            const colorAttr = def.color ? ` Color="${def.color}"` : '';
            const labelAttr = def.name ? ` Label="${def.name}"` : '';
            const msecPaths = computeMsecPath(hexCodes, sectorNum);
            msecPaths.forEach(path => {
                borderLines.push(`    <Border${allegAttr}${colorAttr}${labelAttr}>${path}</Border>`);
            });
        }
    });

    // ── Regions ───────────────────────────────────────────────────────────────
    const regionLines       = [];
    const storedRegionPaths = window.regionPaths || new Map();

    // Build label → slot colour map from regionDefinitions (authoritative source)
    const regionSlotColorMap = new Map();
    (window.regionDefinitions || []).forEach(def => {
        if (def.name && def.color) regionSlotColorMap.set(def.name, def.color);
    });

    // Group hex IDs by cluster label for this sector
    const labelToHexes = new Map();
    hexStates.forEach((state, hexId) => {
        if (!hexId.startsWith(secPrefix)) return;
        const label = state.cluster;
        if (!label || typeof label !== 'string' || !label.trim() || label === '----') return;
        if (!labelToHexes.has(label)) labelToHexes.set(label, []);
        labelToHexes.get(label).push(hexId);
    });

    labelToHexes.forEach((hexIds, label) => {
        const stored = storedRegionPaths.get(`${sectorNum}:${label}`);
        const color  = regionSlotColorMap.get(label) || '#888888';
        if (stored && stored.rawPath) {
            const labelAttr = ` Label="${label}"`;
            const colorAttr = ` Color="${stored.color || color}"`;
            const lpAttr    = stored.labelPos ? ` LabelPosition="${stored.labelPos}"` : '';
            regionLines.push(`    <Region${labelAttr}${colorAttr}${lpAttr}>${stored.rawPath}</Region>`);
        } else {
            // Fallback: compute MSEC perimeter path from interior hex assignments
            const hexCodes  = hexIds.map(hexId => hexId.split('-').pop());
            const msecPaths = computeMsecPath(hexCodes, sectorNum);
            msecPaths.forEach(path => {
                regionLines.push(`    <Region Label="${label}" Color="${color}">${path}</Region>`);
            });
        }
    });

    // ── Guard ─────────────────────────────────────────────────────────────────
    if (routeLines.length === 0 && borderLines.length === 0 && regionLines.length === 0) {
        showToast(`No routes, borders, or regions to export for Sector ${sectorID}.`, 2500);
        return;
    }

    // ── Build XML ─────────────────────────────────────────────────────────────
    const xmlLines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<Sector>',
        `  <Name>Sector ${sectorID}</Name>`,
    ];

    if (routeLines.length > 0) {
        xmlLines.push('  <Routes>');
        routeLines.forEach(l => xmlLines.push(l));
        xmlLines.push('  </Routes>');
    }
    if (borderLines.length > 0) {
        xmlLines.push('  <Borders>');
        borderLines.forEach(l => xmlLines.push(l));
        xmlLines.push('  </Borders>');
    }
    if (regionLines.length > 0) {
        xmlLines.push('  <Regions>');
        regionLines.forEach(l => xmlLines.push(l));
        xmlLines.push('  </Regions>');
    }

    xmlLines.push('</Sector>');

    const content = xmlLines.join('\n');
    const blob    = new Blob([content], { type: 'text/xml;charset=utf-8' });
    const url     = URL.createObjectURL(blob);
    const link    = document.createElement('a');
    link.href     = url;
    link.download = `Sector_${sectorID}_Metadata.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const parts = [];
    if (routeLines.length > 0) parts.push(`${routeLines.length} route(s)`);
    if (borderLines.length > 0) parts.push(`${borderLines.length} border(s)`);
    if (regionLines.length > 0) parts.push(`${regionLines.length} region(s)`);
    showToast(`Exported ${parts.join(', ')} for Sector ${sectorID}.`, 2500);
}

function generateT5TabData(sectorID) {
    const header = "Hex\tName\tUWP\tBases\tRemarks\tZone\tPBG\tAllegiance\tStars\t{Ix}\t(Ex)\t[Cx]\tNobility\tW.\tNotes";
    let lines = [header];

    hexStates.forEach((state, hexId) => {
        if (hexId.startsWith(sectorID + "-")) {
            const data = state.t5Data || state.mgt2eData || state.ctData;
            if (!data) return;

            // Hex: Extract 0101 from A-B-0101
            const hexParts = hexId.split('-');
            const hexNum = hexParts[hexParts.length - 1];

            // Bases (T5 Mapping)
            let bases = "";
            if (data.navalBase) bases += "N";
            if (data.scoutBase) bases += "S";
            if (data.researchBase) bases += "R";
            if (data.tas) bases += "T";

            // PBG (Pop-Multiplier, Belts, Gas Giants)
            const p = data.popDigit !== undefined ? data.popDigit : (data.pop > 0 ? 5 : 0);
            const b = data.planetoidBelts !== undefined ? data.planetoidBelts : (data.size === 0 ? 1 : 0);
            const g = data.gasGiantsCount !== undefined ? data.gasGiantsCount : (data.gasGiant ? 1 : 0);
            const pbg = `${toUWPChar(p)}${toUWPChar(b)}${toUWPChar(g)}`;

            // Extensions (Importance, Economic, Cultural)
            // Tier 1: T5 worlds store a pre-computed t5Socio object.
            // Tier 2: Mongoose worlds store Im/ecoR/L/I/E on mgtSocio (= mgt2eData);
            //         Cx uses D/X/U/S from the Mongoose culturalProfile string.
            // Tier 3: CT/RTT worlds fall back to T5_Socio_Engine for a fresh calculation.
            let socio = state.t5Socio;

            if (!socio) {
                const mgt = state.mgtSocio;
                if (mgt && mgt.Im !== undefined) {
                    const Im   = mgt.Im;
                    const ecoR = mgt.ecoR ?? 0;
                    const ecoL = mgt.ecoL ?? 0;
                    const ecoI = mgt.ecoI ?? 0;
                    const ecoE = mgt.ecoE ?? 0;
                    const cp   = (mgt.culturalProfile || '').split('-')[0] || '0000';
                    socio = {
                        ixString: `{${Im >= 0 ? '+' : ''}${Im}}`,
                        exString: `(${toUWPChar(ecoR)}${toUWPChar(ecoL)}${toUWPChar(ecoI)}${ecoE >= 0 ? '+' : ''}${ecoE})`,
                        cxString: `[${cp.padEnd(4, '0').slice(0, 4)}]`
                    };
                }
            }

            if (!socio) {
                const t5Eng = window.T5_Socio_Engine;
                if (t5Eng && typeof t5Eng.generateT5Socioeconomics === 'function') {
                    socio = t5Eng.generateT5Socioeconomics(data);
                }
            }

            socio = socio || {};

            const ixVal = socio.ixString || (socio.Ix !== undefined ? `{ ${socio.Ix} }` : '{ 0 }');
            const exVal = socio.exString || "(000+0)";
            const cxVal = socio.cxString || "[0000]";

            // Stars String
            let stars = "-";
            if (state.t5Data && state.t5Data.stars && state.t5Data.stars.length > 0) {
                stars = state.t5Data.stars.map(s => s.name).join(' ');
            } else if (state.t5Data && state.t5Data.homestar && state.t5Data.homestar !== 'Unknown') {
                stars = state.t5Data.homestar;
            } else {
                const sys = state.t5System || state.mgtSystem || state.ctSystem;
                if (sys && sys.stars) {
                    stars = sys.stars.map(s => s.name).join(' ');
                }
            }

            // World Count (W)
            let w = 1;
            if (state.t5System && state.t5System.totalWorlds) w = state.t5System.totalWorlds;
            else if (state.mgtSystem && state.mgtSystem.worlds) w = state.mgtSystem.worlds.length;
            else if (state.ctSystem && state.ctSystem.orbits) {
                w = state.ctSystem.orbits.filter(o => o.contents).length;
                if (state.ctSystem.capturedPlanets) w += state.ctSystem.capturedPlanets.length;
            }

            const row = [
                hexNum,
                data.name || "Unnamed",
                data.uwp || "???????-?",
                bases || "-",
                (data.tradeCodes || []).join(' ') || "-",
                (data.travelZone === "Amber" ? "A" : (data.travelZone === "Red" ? "R" : "-")),
                pbg,
                state.allegiance || data.allegiance || "Im",
                stars,
                ixVal,
                exVal,
                cxVal,
                "-", // Nobility
                w,
                state.notes || ""
            ];
            lines.push(row.join('\t'));
        }
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sector_${sectorID}.tab`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function setupSectorImporter() {
    const fileInput = document.getElementById('file-import-sector');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                importT5Tab(content, file.name);
            };
            reader.readAsText(file);
        });
    }
}

function importT5Tab(fileContent, fileName, forcedSectorSlot = null) {
    saveHistoryState('Import Sector');
    const lines = fileContent.split(/\r?\n/);
    if (lines.length < 2) return;

    const header = lines[0].split('\t');
    const getIndex = (label) => header.indexOf(label);

    const idxSector = getIndex('Sector');
    const idxSS = getIndex('SS');
    const idxHex = getIndex('Hex');
    const idxName = getIndex('Name');
    const idxUWP = getIndex('UWP');
    const idxBases = getIndex('Bases');
    const idxRemarks = getIndex('Remarks');
    const idxZone = getIndex('Zone');
    const idxPBG = getIndex('PBG');
    const idxStars = getIndex('Stars');
    const idxAlleg = getIndex('Allegiance');
    const idxIx = getIndex('{Ix}');
    const idxEx = getIndex('(Ex)');
    const idxCx = getIndex('[Cx]');
    const idxW = getIndex('W.') !== -1 ? getIndex('W.') : getIndex('W');
    const idxNotes = getIndex('Notes');

    if (idxHex === -1 || idxUWP === -1) {
        alert("Invalid file format. 'Hex' and 'UWP' columns (tab-separated) are required.");
        return;
    }

    let importCount = 0;
    let fallbackSectorSlot = "18";

    if (forcedSectorSlot) {
        fallbackSectorSlot = forcedSectorSlot.toUpperCase();
    } else {
        const nameMatch = fileName.match(/Sector_([A-Z]{1,2}|\d+)/i);
        if (nameMatch) {
            fallbackSectorSlot = nameMatch[1].toUpperCase();
        } else {
            const userSlot = prompt(`Which Sector number (1 to ${gridWidth * gridHeight}; ${Math.ceil(gridWidth * gridHeight / 2)} is centre) should we import "${fileName}" into?`, String(Math.ceil(gridWidth * gridHeight / 2)));
            if (userSlot) fallbackSectorSlot = userSlot.toUpperCase();
        }
    }

    // Convert the slot label (letter or number string) to a numeric sector ID.
    const sectorNum = sectorSlotToNumber(fallbackSectorSlot);

    const importedHexes = new Set();
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split('\t');
        if (row.length < header.length) continue;

        let hexNum = row[idxHex]?.trim();
        if (hexNum?.length === 3) hexNum = '0' + hexNum;
        const uwp = row[idxUWP]?.trim();

        if (!hexNum || !uwp || hexNum.length !== 4 || uwp.length < 7) {
            continue;
        }

        const name = idxName !== -1 ? row[idxName].trim() : "Unnamed";
        const sectorID = sectorNum;
        let subChar = idxSS !== -1 ? row[idxSS].trim() : "";

        if (!subChar || subChar.length > 1) {
            const hexVal = parseInt(hexNum, 10);
            const lQ = Math.floor(hexVal / 100);
            const lR = hexVal % 100;
            const subX = Math.floor((lQ - 1) / 8);
            const subY = Math.floor((lR - 1) / 10);
            subChar = String.fromCharCode(65 + (subY * 4 + subX));
        }

        const hexId = `${sectorID}-${subChar}-${hexNum}`;

        const starport = uwp[0] || 'C';
        const size = fromUWPChar(uwp[1]);
        const atm = fromUWPChar(uwp[2]);
        const hydro = fromUWPChar(uwp[3]);
        const pop = fromUWPChar(uwp[4]);
        const gov = fromUWPChar(uwp[5]);
        const law = fromUWPChar(uwp[6]);
        const tl = fromUWPChar(uwp.split('-')[1]?.[0] || '7');

        const pbgStr = idxPBG !== -1 ? row[idxPBG].trim() : "000";
        const popMultiplier = fromUWPChar(pbgStr[0]);
        const belts = fromUWPChar(pbgStr[1]);

        function pbgChar(c) { return c !== undefined && c !== null; }
        const gG = pbgChar(pbgStr[2]) ? fromUWPChar(pbgStr[2]) : 0;

        const ixRaw = idxIx !== -1 ? row[idxIx].replace(/[{}]/g, '') : "0";
        const exRaw = idxEx !== -1 ? row[idxEx].replace(/[()]/g, '') : "000+0";
        const cxRaw = idxCx !== -1 ? row[idxCx].replace(/[\[\]]/g, '') : "0000";

        const Ix = parseInt(ixRaw, 10) || 0;
        const R = fromUWPChar(exRaw[0]);
        const L = fromUWPChar(exRaw[1]);
        const I_val = fromUWPChar(exRaw[2]);
        const E_val = parseInt(exRaw.substring(3), 10) || 0;

        const H = fromUWPChar(cxRaw[0]);
        const A = fromUWPChar(cxRaw[1]);
        const S = fromUWPChar(cxRaw[2]);
        const Sym = fromUWPChar(cxRaw[3]);

        const calcR = R === 0 ? 1 : R;
        const calcL = L === 0 ? 1 : L;
        const calcI = I_val === 0 ? 1 : I_val;
        const calcE = E_val === 0 ? 1 : E_val;
        const RU = Math.abs(calcR * calcL * calcI * calcE);

        const zoneRaw = (idxZone !== -1 ? row[idxZone] : "").trim().toUpperCase();
        const travelZone = zoneRaw === 'A' ? 'Amber' : (zoneRaw === 'R' ? 'Red' : 'Green');

        const t5Data = {
            name, uwp, starport, size, atm, hydro, pop, gov, law, tl,
            tradeCodes: idxRemarks !== -1 ? row[idxRemarks].split(/\s+/) : [],
            travelZone,
            popDigit: popMultiplier,
            planetoidBelts: belts,
            gasGiantsCount: gG,
            gasGiant: gG > 0,
            navalBase: idxBases !== -1 && row[idxBases].includes('N'),
            scoutBase: idxBases !== -1 && row[idxBases].includes('S'),
            worldCount: idxW !== -1 ? parseInt(row[idxW], 10) : undefined,
        };

        // Action 4.4: Gas Giant Trace Logging (Selection Process)
        if (t5Data.gasGiant && window.isLoggingEnabled) {
            let ggVariant = 'SOLID';
            let reason = 'Default (Solid)';
            
            if (t5Data.tradeCodes && t5Data.tradeCodes.includes('Sa')) {
                ggVariant = 'RINGED';
                reason = "Condition 1: 'Sa' trade code present";
            } else if (t5Data.isMoon || t5Data.isSatellite) {
                ggVariant = 'RINGED';
                reason = "Condition 2: Main world is a moon/satellite";
            }
            
            writeLogLine(`[GAS GIANT LOG] Hex ${hexId}: Icon Variant = ${ggVariant} (${reason})`);
        }

        const t5Socio = {
            Ix, R, L, I: I_val, E: E_val, RU, H, A, S, Sym,
            importance: Ix,
            resourceUnits: RU,
            ecoResources: R,
            ecoLabor: L,
            ecoInfrastructure: I_val,
            ecoEfficiency: E_val,
            popMultiplier,
            belts,
            gasGiants: gG,
            worlds: idxW !== -1 ? parseInt(row[idxW], 10) : 1,
            ixString: (idxIx !== -1) ? row[idxIx] : `{${Ix >= 0 ? '+' : ''}${Ix}}`,
            exString: (idxEx !== -1) ? row[idxEx] : `(${toUWPChar(R)}${toUWPChar(L)}${toUWPChar(I_val)}${E_val >= 0 ? '+' : ''}${E_val})`,
            cxString: (idxCx !== -1) ? row[idxCx] : `[${toUWPChar(H)}${toUWPChar(A)}${toUWPChar(S)}${toUWPChar(Sym)}]`
        };

        let t5System = { totalWorlds: idxW !== -1 ? parseInt(row[idxW], 10) : 1 };
        if (idxStars !== -1 && row[idxStars] !== "-") {
            const rawStars = row[idxStars].trim();
            t5Data.homestar = rawStars;

            const tokens = rawStars.split(/\s+/);
            const parsedStars = [];
            for (let i = 0; i < tokens.length; i++) {
                if (i > 0 && /^(Ia|Ib|II|III|IV|V|VI|VII|D|BD)$/i.test(tokens[i]) && !parsedStars[parsedStars.length - 1].includes(" ")) {
                    parsedStars[parsedStars.length - 1] += " " + tokens[i];
                } else {
                    parsedStars.push(tokens[i]);
                }
            }
            t5System.stars = parsedStars.map((sn, idx) => ({ name: sn, role: idx === 0 ? 'Primary' : 'Companion', orbits: [] }));
            t5System.orbits = [];
        } else {
            t5Data.homestar = "";
            t5System.stars = [];
            t5System.orbits = [];
        }

        const stateObj = {
            type: 'SYSTEM_PRESENT',
            name: name,
            allegiance: idxAlleg !== -1 ? row[idxAlleg].trim() : "Im",
            notes: idxNotes !== -1 ? row[idxNotes].trim() : "",
            beltCount: belts,
            gasGiantCount: gG,
            t5Data,
            t5Socio,
            t5System
        };

        hexStates.set(hexId, stateObj);
        importedHexes.add(hexNum);
        importCount++;
    }

    let emptyCount = 0;
    for (let q = 1; q <= 32; q++) {
        for (let r = 1; r <= 40; r++) {
            const hexNum = q.toString().padStart(2, '0') + r.toString().padStart(2, '0');
            if (importedHexes.has(hexNum)) continue;

            const subX = Math.floor((q - 1) / 8);
            const subY = Math.floor((r - 1) / 10);
            const subChar = String.fromCharCode(65 + (subY * 4 + subX));
            const hexId = `${sectorNum}-${subChar}-${hexNum}`;

            if (!hexStates.has(hexId)) {
                hexStates.set(hexId, { type: 'EMPTY' });
                emptyCount++;
            }
        }
    }

    showToast(`Successfully imported ${importCount} worlds into Sector ${sectorNum} (${fallbackSectorSlot})`);
    if (emptyCount > 0) showToast(`Initialized ${emptyCount} empty space hexes in sector bounds.`, 2000);

    selectedHexes.clear();
    
    // Sean Protocol: Refresh Styling Rules (Ledger) and Visibility Filters
    if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
    if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

    if (typeof draw === 'function') {
        requestAnimationFrame(draw);
    }

    // Persist the imported sector to IndexedDB in the background.
    if (window.dbManager) window.dbManager.saveHexesBySectorNum(sectorNum);
}

// ============================================================================
// XML METADATA IMPORTER
// ============================================================================

// ── Hex coordinate helpers ────────────────────────────────────────────────────

function _hexCodeToSubChar(hexCode) {
    const hexVal = parseInt(hexCode, 10);
    const lQ     = Math.floor(hexVal / 100);
    const lR     = hexVal % 100;
    const subX   = Math.floor((lQ - 1) / 8);
    const subY   = Math.floor((lR - 1) / 10);
    return String.fromCharCode(65 + (subY * 4 + subX));
}

function _hexCodeToHexId(slotNum, hexCode) {
    return `${slotNum}-${_hexCodeToSubChar(hexCode)}-${hexCode}`;
}

/**
 * Extract the sector slot number and 4-digit hex code from a hexId.
 * Exposed on window for use by the forthcoming XML export feature.
 */
function hexIdToSectorAndCode(hexId) {
    const parts = hexId.split('-');
    return { slotNum: parseInt(parts[0], 10), hexCode: parts[parts.length - 1] };
}
window.hexIdToSectorAndCode = hexIdToSectorAndCode;

// ── Sector coord lookup ───────────────────────────────────────────────────────

function _buildSectorCoordLookup() {
    const lookup = new Map();
    const seen = new Set();
    hexStates.forEach((state, hexId) => {
        const slotNum = parseInt(hexId.split('-')[0], 10);
        if (seen.has(slotNum)) return;
        seen.add(slotNum);
        const sx = (slotNum - 1) % gridWidth;
        const sy = Math.floor((slotNum - 1) / gridWidth);
        lookup.set(`${sx},${sy}`, slotNum);
    });
    return lookup;
}

// ── XML parser ────────────────────────────────────────────────────────────────

/**
 * Parse a TravellerMap metadata XML string and return a Map of color groups.
 * Keys are normalised lowercase color strings, or '__default__' for routes
 * with no Color attribute.  Values are arrays of segment descriptor objects.
 */
function parseXmlRouteGroups(xmlText) {
    if (!xmlText) return null;
    let doc;
    try {
        doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    } catch (e) {
        console.warn('[XML Import] XML parse failed:', e.message);
        return null;
    }
    if (doc.querySelector('parsererror')) {
        console.warn('[XML Import] Malformed XML — routes skipped.');
        return null;
    }

    const routeEls = doc.querySelectorAll('Route');
    const groups = new Map();

    routeEls.forEach(el => {
        const startCode = el.getAttribute('Start');
        const endCode   = el.getAttribute('End');
        if (!startCode || !endCode) return;

        const color    = (el.getAttribute('Color') || '').trim().toLowerCase();
        const colorKey = color || '__default__';

        const segment = {
            startCode,
            endCode,
            startOffsetX: parseInt(el.getAttribute('StartOffsetX') || '0', 10),
            startOffsetY: parseInt(el.getAttribute('StartOffsetY') || '0', 10),
            endOffsetX:   parseInt(el.getAttribute('EndOffsetX')   || '0', 10),
            endOffsetY:   parseInt(el.getAttribute('EndOffsetY')   || '0', 10)
        };

        if (!groups.has(colorKey)) groups.set(colorKey, []);
        groups.get(colorKey).push(segment);
    });

    return groups.size > 0 ? groups : null;
}

// ── Route applier ─────────────────────────────────────────────────────────────

function _applyXmlRoutesForGroup(segments, slotNum, sectorX, sectorY, targetRouteId, coordLookup, groupKey) {
    const typeMap = { 1: 'Xboat', 2: 'Trade', 3: 'Secondary' };
    const routeType = typeMap[targetRouteId] || 'Filter';
    const isFilter  = routeType === 'Filter';
    let added = 0, skipped = 0;

    segments.forEach(seg => {
        const { startCode, endCode, startOffsetX, startOffsetY, endOffsetX, endOffsetY } = seg;

        let startSlotNum = slotNum;
        if (startOffsetX !== 0 || startOffsetY !== 0) {
            const key      = `${sectorX + startOffsetX},${sectorY + startOffsetY}`;
            const resolved = coordLookup.get(key);
            if (resolved === undefined) {
                console.warn(`[XML Import] Cross-sector start (${key}) skipped — sector not loaded.`);
                skipped++;
                return;
            }
            startSlotNum = resolved;
        }

        let endSlotNum = slotNum;
        if (endOffsetX !== 0 || endOffsetY !== 0) {
            const key      = `${sectorX + endOffsetX},${sectorY + endOffsetY}`;
            const resolved = coordLookup.get(key);
            if (resolved === undefined) {
                console.warn(`[XML Import] Cross-sector end (${key}) skipped — sector not loaded.`);
                skipped++;
                return;
            }
            endSlotNum = resolved;
        }

        const startId = _hexCodeToHexId(startSlotNum, startCode);
        const endId   = _hexCodeToHexId(endSlotNum, endCode);

        const before = (window.sectorRoutes || []).length;
        if (isFilter) {
            addRoute(startId, endId, 'Filter', null, { routeId: targetRouteId, groupId: groupKey });
        } else {
            addRoute(startId, endId, routeType);
        }
        if ((window.sectorRoutes || []).length > before) added++;
    });

    if (added > 0 || skipped > 0) {
        console.log(`[XML Import] ${added} segment(s) added to Route #${targetRouteId}, ${skipped} skipped.`);
    }
    return added;
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

function _openXmlRouteModal(fileName, slotNum, groups) {
    const modal      = document.getElementById('xml-route-modal');
    const desc       = document.getElementById('xml-route-modal-desc');
    const table      = document.getElementById('xml-route-modal-table');
    const confirmBtn = document.getElementById('btn-xml-route-confirm');
    if (!modal) return;

    desc.textContent = `Assign each color group from "${fileName}" to a route slot.`;
    table.innerHTML  = '';

    const defs = window.routeDefinitions || [];

    const optionsHtml = defs.slice(0, 9).map(d => {
        const count = (window.sectorRoutes || []).filter(r => r.routeId === d.id).length;
        const hint  = count > 0 ? ` (${count} segs)` : '';
        return `<option value="${d.id}">#${d.id} ${d.name}${hint}</option>`;
    }).join('');

    const header = document.createElement('div');
    header.style.cssText = 'display:grid;grid-template-columns:28px 1fr 200px;gap:8px;padding:4px 0;color:#a0a8b0;font-size:0.82em;border-bottom:1px solid #45a29e;';
    header.innerHTML = '<span></span><span>Color Group</span><span>Route Slot</span>';
    table.appendChild(header);

    let nextSlot = 1;
    for (const [colorKey, segments] of groups) {
        const isDefault   = colorKey === '__default__';
        const displayName = isDefault ? 'No color (default)' : colorKey;
        const swatch      = isDefault ? '#888888' : colorKey;
        const count       = segments.length;

        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:28px 1fr 200px;gap:8px;align-items:center;';
        row.dataset.colorKey = colorKey;
        row.innerHTML = `
            <div style="width:22px;height:22px;border-radius:3px;background:${swatch};border:1px solid #555;flex-shrink:0;"></div>
            <span style="color:#c5c6c7;font-size:0.88em;">${displayName} &mdash; ${count} segment${count !== 1 ? 's' : ''}</span>
            <select class="xml-route-select" style="background:#1f2833;color:#c5c6c7;border:1px solid #45a29e;padding:3px 6px;border-radius:4px;width:100%;font-size:0.88em;">
                ${optionsHtml}
            </select>`;

        const sel  = row.querySelector('.xml-route-select');
        sel.value  = String(Math.min(nextSlot, 9));
        nextSlot++;
        table.appendChild(row);
    }

    // Replace confirmBtn to drop any previous listener
    const fresh = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(fresh, confirmBtn);
    fresh.addEventListener('click', () => {
        modal.style.display = 'none';
        _confirmXmlRouteImport(slotNum, groups, table);
    });

    modal.style.display = 'flex';
}

function _confirmXmlRouteImport(slotNum, groups, table) {
    const rows = table.querySelectorAll('[data-color-key]');
    const mapping = new Map();
    rows.forEach(row => {
        mapping.set(row.dataset.colorKey, parseInt(row.querySelector('.xml-route-select').value, 10));
    });

    // Warn if any chosen slot already has segments
    const defs = window.routeDefinitions || [];
    const seenIds = new Set();
    const occupiedLabels = [];
    mapping.forEach(routeId => {
        if (seenIds.has(routeId)) return;
        seenIds.add(routeId);
        const count = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
        if (count > 0) {
            const def = defs.find(d => d.id === routeId);
            occupiedLabels.push(`Route #${routeId} "${def ? def.name : routeId}" (${count} segment${count !== 1 ? 's' : ''})`);
        }
    });

    if (occupiedLabels.length > 0) {
        const ok = confirm(
            `The following route slot(s) already have data:\n\n${occupiedLabels.join('\n')}\n\nAdd XML routes anyway?`
        );
        if (!ok) return;
    }

    saveHistoryState('Import XML Metadata');
    const coordLookup = _buildSectorCoordLookup();
    const sectorX     = (slotNum - 1) % gridWidth;
    const sectorY     = Math.floor((slotNum - 1) / gridWidth);
    const ts          = Date.now();
    let totalAdded    = 0;

    mapping.forEach((targetRouteId, colorKey) => {
        const segments = groups.get(colorKey);
        if (!segments || segments.length === 0) return;
        const groupKey = `xml_import_${ts}_${colorKey}`;
        totalAdded += _applyXmlRoutesForGroup(segments, slotNum, sectorX, sectorY, targetRouteId, coordLookup, groupKey);
    });

    if (window.dbManager) window.dbManager.saveRoutes();
    requestAnimationFrame(draw);
    showToast(`Imported ${totalAdded} route segment(s) from XML.`, 3000);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function setupXmlMetadataImporter() {
    const btn       = document.getElementById('btn-import-xml-metadata');
    const fileInput = document.getElementById('file-import-xml-metadata');
    const modal     = document.getElementById('xml-route-modal');
    const cancelBtn = document.getElementById('btn-xml-route-cancel');

    if (!btn || !fileInput) return;

    btn.addEventListener('click', () => fileInput.click());

    cancelBtn?.addEventListener('click', () => { modal.style.display = 'none'; });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        const userSlot = prompt(
            `Which Sector number (1 to ${gridWidth * gridHeight}; ${Math.ceil(gridWidth * gridHeight / 2)} is centre) does "${file.name}" apply to?`,
            String(Math.ceil(gridWidth * gridHeight / 2))
        );
        if (!userSlot) return;
        const slotNum = sectorSlotToNumber(userSlot.toUpperCase());

        readFileAsText(file).then(xmlText => {
            let parsedDoc;
            try { parsedDoc = new DOMParser().parseFromString(xmlText, 'application/xml'); } catch (e) { /* ignore */ }

            // Border import — runs regardless of whether routes are present
            if (typeof window.importBordersFromXml === 'function') {
                const bordersEl = parsedDoc && parsedDoc.querySelector('Borders');
                if (bordersEl) {
                    const borderResult = window.importBordersFromXml(bordersEl, slotNum);
                    if (borderResult.assigned.length > 0 || borderResult.skipped.length > 0) {
                        const assignedMsg = borderResult.assigned.length > 0
                            ? `${borderResult.assigned.length} border allegiance(s) imported.`
                            : '';
                        const skippedMsg = borderResult.skipped.length > 0
                            ? ` ${borderResult.skipped.length} skipped (no free slots): ${borderResult.skipped.map(s => s.allegianceCode).join(', ')}`
                            : '';
                        showToast((assignedMsg + skippedMsg).trim(), 4000);
                        if (window.dbManager) {
                            window.dbManager.saveBorderDefinitions?.();
                        }
                        requestAnimationFrame(draw);
                    }
                }
            }

            // Region import — runs whenever <Regions> is present in the XML
            if (typeof window.importRegionsFromXml === 'function') {
                const regionsEl = parsedDoc && parsedDoc.querySelector('Regions');
                if (regionsEl) {
                    const regionResult = window.importRegionsFromXml(regionsEl, slotNum);
                    if (regionResult.assigned.length > 0) {
                        showToast(`${regionResult.assigned.length} region(s) imported: ${regionResult.assigned.map(r => r.label).join(', ')}`, 4000);
                        requestAnimationFrame(draw);
                    }
                }
            }

            const groups = parseXmlRouteGroups(xmlText);
            if (!groups) {
                showToast('No routes found in XML file.', 3000);
                return;
            }

            const colorKeys    = Array.from(groups.keys());
            const isDefaultOnly = colorKeys.length === 1 && colorKeys[0] === '__default__';

            if (isDefaultOnly) {
                // Auto-assign to first empty route slot
                const segCounts = new Map();
                (window.sectorRoutes || []).forEach(r => {
                    if (r.routeId != null) segCounts.set(r.routeId, (segCounts.get(r.routeId) || 0) + 1);
                });

                const defs = window.routeDefinitions || [];
                let targetId = null;
                for (const def of defs.slice(0, 9)) {
                    if ((segCounts.get(def.id) || 0) === 0) { targetId = def.id; break; }
                }

                if (targetId === null) {
                    const ok = confirm('All route slots have existing data.\n\nImport XML routes to Route #1 anyway?');
                    if (!ok) return;
                    targetId = 1;
                }

                saveHistoryState('Import XML Metadata');
                const coordLookup = _buildSectorCoordLookup();
                const sectorX     = (slotNum - 1) % gridWidth;
                const sectorY     = Math.floor((slotNum - 1) / gridWidth);
                const added = _applyXmlRoutesForGroup(
                    groups.get('__default__'), slotNum, sectorX, sectorY,
                    targetId, coordLookup, `xml_default_${Date.now()}`
                );

                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                showToast(`Imported ${added} route segment(s) to Route #${targetId}.`, 3000);

            } else {
                _openXmlRouteModal(file.name, slotNum, groups);
            }
        }).catch(err => {
            showToast('Error reading XML file.', 3000);
            console.error('[XML Import]', err);
        });
    });
}