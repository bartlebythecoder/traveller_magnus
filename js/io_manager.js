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

function setupSaveLoad() {
    document.getElementById('btn-save-map').addEventListener('click', async () => {
        const stateObj = {
            hexStates: {},
            routes: window.sectorRoutes || [],
            rules: window.activeFilterRules || []
        };
        hexStates.forEach((value, key) => {
            stateObj.hexStates[key] = value;
        });
        const jsonStr = JSON.stringify(stateObj, null, 2);

        try {
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'traveller_map.json',
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
            } else {
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const dlAnchorElem = document.createElement('a');
                dlAnchorElem.setAttribute("href", url);
                dlAnchorElem.setAttribute("download", "traveller_map.json");
                document.body.appendChild(dlAnchorElem);
                dlAnchorElem.click();
                document.body.removeChild(dlAnchorElem);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Save failed:", err);
                alert("Failed to save file. Check console for details.");
            }
        }
    });

    document.getElementById('file-load-map').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const parsedData = JSON.parse(event.target.result);
                saveHistoryState('Load Map JSON');
                hexStates.clear();

                if (parsedData.hexStates) {
                    for (const key in parsedData.hexStates) {
                        hexStates.set(key, parsedData.hexStates[key]);
                    }
                    window.sectorRoutes = parsedData.routes || [];
                    window.activeFilterRules = parsedData.rules || [];

                    // Re-sync UI and redraw map based on loaded rules
                    if (typeof renderRulesLedger === 'function') renderRulesLedger();
                    if (typeof reapplyAllRules === 'function') reapplyAllRules();
                } else {
                    // Fallback for old format
                    for (const key in parsedData) {
                        hexStates.set(key, parsedData[key]);
                    }
                }

                selectedHexes.clear();
                document.getElementById('context-menu').classList.remove('visible');
                requestAnimationFrame(draw);

                alert("Map loaded successfully!");
            } catch (error) {
                alert("Error loading map file. Ensure it is a valid JSON.");
                console.error("Parse error:", error);
            }

            e.target.value = '';
        };
        reader.readAsText(file);
    });
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

    // Calculate X, Y coordinates for the sector based on its ID
    const sIdx = sectorID.length === 1 ? sectorID.charCodeAt(0) - 65 : (sectorID.charCodeAt(0) - 65) + 26;
    const sX = Math.floor(sIdx / 4);
    const sY = sIdx % 4;

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
    const header = "Hex\tName\tUWP\tBases\tRemarks\tZone\tPBG\tAllegiance\tStars\t{Ix}\t(Ex)\t[Cx]\tNobility\tW.";
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
                data.allegiance || "Im",
                stars,
                ixVal,
                exVal,
                cxVal,
                "-", // Nobility
                w
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

function importT5Tab(fileContent, fileName) {
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
    const idxIx = getIndex('{Ix}');
    const idxEx = getIndex('(Ex)');
    const idxCx = getIndex('[Cx]');
    const idxW = getIndex('W');

    if (idxHex === -1 || idxUWP === -1) {
        alert("Invalid file format. 'Hex' and 'UWP' columns (tab-separated) are required.");
        return;
    }

    let importCount = 0;
    let fallbackSectorSlot = "A";

    const nameMatch = fileName.match(/Sector_([A-Z]{1,2})/i);
    if (nameMatch) {
        fallbackSectorSlot = nameMatch[1].toUpperCase();
    } else {
        const userSlot = prompt(`Which Sector Slot (A to AF) should we import "${fileName}" into?`, "A");
        if (userSlot) fallbackSectorSlot = userSlot.toUpperCase();
    }

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
        const sectorID = fallbackSectorSlot;
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

        const t5Data = {
            name, uwp, starport, size, atm, hydro, pop, gov, law, tl,
            tradeCodes: idxRemarks !== -1 ? row[idxRemarks].split(/\s+/) : [],
            zone: idxZone !== -1 ? row[idxZone] : "-",
            popDigit: popMultiplier,
            planetoidBelts: belts,
            gasGiantsCount: gG,
            gasGiant: gG > 0,
            navalBase: idxBases !== -1 && row[idxBases].includes('N'),
            scoutBase: idxBases !== -1 && row[idxBases].includes('S'),
        };

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
            const hexId = `${fallbackSectorSlot}-${subChar}-${hexNum}`;

            if (!hexStates.has(hexId)) {
                hexStates.set(hexId, { type: 'EMPTY' });
                emptyCount++;
            }
        }
    }

    showToast(`Successfully imported ${importCount} worlds into Sector Slot ${fallbackSectorSlot}`);
    if (emptyCount > 0) showToast(`Initialized ${emptyCount} empty space hexes in sector bounds.`, 2000);

    selectedHexes.clear();
    if (typeof draw === 'function') {
        requestAnimationFrame(draw);
    }
}