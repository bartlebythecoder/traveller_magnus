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
            version:     APP_VERSION,
            gridWidth,
            gridHeight,
            routes:      window.sectorRoutes || [],
            rules:       window.activeFilterRules || [], // legacy support
            aesthetics,
            sectorNames: window.sectorNames || {},
            hexStates:   hexObj
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
                    // Routes and aesthetics travel with Part 1 only
                    if (i === 0) {
                        chunkObj.routes     = window.sectorRoutes || [];
                        chunkObj.rules      = window.activeFilterRules || [];
                        chunkObj.aesthetics = aesthetics;
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
        'Clear Canvas will erase all hex data, routes, and auto-saved progress.\n\n' +
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
    window.sectorRoutes = [];
    window.undoStack    = [];
    window.redoStack    = [];
    selectedHexes.clear();

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

        window.sectorRoutes = parsedData.routes || [];
        window.sectorNames  = parsedData.sectorNames || {};

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
    const openBtn = document.getElementById('btn-open-sector-export');
    const closeBtn = document.getElementById('btn-close-sector-picker');
    const modal = document.getElementById('sector-picker-modal');
    const listContainer = document.getElementById('sector-list');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
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
                        generateT5TabData(s.id);
                        exportRoutesToXML(s.id);
                        showToast(`Exported ${s.name} Data and Routes`, 2000);
                        modal.style.display = 'none';
                    };
                    listContainer.appendChild(tile);
                });
            }
            modal.style.display = 'flex';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
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
            let socio = state.t5Socio;
            if (!socio && typeof generateT5Socioeconomics === 'function') {
                socio = generateT5Socioeconomics(data);
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

        const hexNum = row[idxHex]?.trim();
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