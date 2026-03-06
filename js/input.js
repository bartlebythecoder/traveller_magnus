// ============================================================================
// INPUT.JS - User Interaction & Event Handling
// ============================================================================
// All mouse, keyboard, and UI event handlers are centralized here.
// Depends on: core.js, renderer.js, and engine files
// ============================================================================

// UI State Variables
let width = window.innerWidth;
let height = window.innerHeight;

let isDragging = false;
let hasMoved = false;
let lastMouseX = 0;
let lastMouseY = 0;

// currentMouseX and currentMouseY are global in core.js

let isPainting = false;
let paintAction = 'select';
let lastPaintedHexId = null;

let contextHexId = null;
let contextSectorPrefix = null;
let contextSubsectorPrefix = null;

// routing state is global in core.js

// Hex Editor State
let editingHexId = null;

// Make Hex Editor Draggable
let isDraggingEditor = false;
let editorDragOffsetX = 0;
let editorDragOffsetY = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeInput() {
    // UI Elements
    const contextMenu = document.getElementById('context-menu');
    const hexEditor = document.getElementById('hex-editor');
    const hexEditorHeader = hexEditor.querySelector('h3');

    // Make Hex Editor Draggable
    hexEditorHeader.addEventListener('mousedown', (e) => {
        isDraggingEditor = true;
        const style = window.getComputedStyle(hexEditor);
        editorDragOffsetX = e.clientX - parseInt(style.left, 10);
        editorDragOffsetY = e.clientY - parseInt(style.top, 10);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingEditor) return;
        hexEditor.style.left = (e.clientX - editorDragOffsetX) + 'px';
        hexEditor.style.top = (e.clientY - editorDragOffsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDraggingEditor = false;
    });

    // Setup all event listeners
    setupAccordions();
    setupCanvasEvents();
    setupKeyboardShortcuts();
    setupContextMenu();
    setupSettingsPanel();
    setupHexEditor();
    setupHelpModal();
    setupSaveLoad();

    setupSectorPicker();
    setupSectorImporter();
    setupSplashScreen();
}

// ============================================================================
// ACCORDION FUNCTIONALITY
// ============================================================================

function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-btn');
    accordions.forEach(acc => {
        // Default all accordions to closed state
        acc.classList.remove('active');
        if (acc.nextElementSibling) acc.nextElementSibling.style.display = 'none';

        acc.addEventListener('click', function () {
            const isActive = this.classList.contains('active');

            // Close all first to ensure mutual exclusivity
            accordions.forEach(btn => {
                btn.classList.remove('active');
                if (btn.nextElementSibling) btn.nextElementSibling.style.display = 'none';
            });

            // If it wasn't active before, open it
            if (!isActive) {
                this.classList.add('active');
                this.nextElementSibling.style.display = 'block';
            }
        });
    });
}

// ============================================================================
// CANVAS EVENT HANDLERS
// ============================================================================

function setupCanvasEvents() {
    // Grab a private reference to the canvas that won't conflict with renderer.js
    const mapCanvas = document.getElementById('map-canvas');

    // 1. Hide context menu when clicking OUTSIDE it
    window.addEventListener('mousedown', (e) => {
        if (e.target.closest('#context-menu') === null) {
            document.getElementById('context-menu').classList.remove('visible');
        }
    });

    // 2. Right-Click: Open Context Menu
    mapCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Stop default browser menu

        const world = getMouseWorldCoords(e);
        const coords = pixelToHex(world.x, world.y, baseHexSize);
        const hexId = getHexId(coords.q, coords.r);

        if (hexId) {
            const parts = hexId.split('-');
            contextHexId = hexId;
            contextSectorPrefix = parts[0];
            contextSubsectorPrefix = parts[0] + '-' + parts[1];

            document.getElementById('ctx-select-hex').style.display = 'block';
            document.getElementById('ctx-select-sector').style.display = 'block';
            document.getElementById('ctx-select-subsector').style.display = 'block';
        } else {
            // Hide selection options if clicking empty space
            contextHexId = null;
            document.getElementById('ctx-select-hex').style.display = 'none';
            document.getElementById('ctx-select-sector').style.display = 'none';
            document.getElementById('ctx-select-subsector').style.display = 'none';
        }

        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.classList.add('visible');
    });

    // 3. Mouse Down: Start Pan, Paint, or Hex Editor
    mapCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // ONLY process Left-Click here

        const world = getMouseWorldCoords(e);
        const coords = pixelToHex(world.x, world.y, baseHexSize);
        const hexId = getHexId(coords.q, coords.r);

        if (e.ctrlKey) {
            // Ctrl+Left-Click: Open Hex Editor
            if (hexId) openHexEditor(hexId);
        } else if (e.shiftKey) {
            // Shift+Left-Click: Highlight Single Hex AND Start Painting
            isPainting = true;
            if (hexId) {
                paintAction = selectedHexes.has(hexId) ? 'deselect' : 'select';
                if (paintAction === 'select') selectedHexes.add(hexId);
                else selectedHexes.delete(hexId);
                lastPaintedHexId = hexId;
                requestAnimationFrame(draw);
            }
        } else if (keysDown.has('g') || keysDown.has('r') || keysDown.has('y')) {
            // G, R, or Y Key + Left-Click: Start Manual Route Creation
            if (hexId) {
                saveHistoryState('Manual Route');
                isAltDragging = true;
                altDragStartId = hexId;

                if (keysDown.has('g')) {
                    altDragType = 'Xboat';
                    console.log("Routing Mode Active: Green (Xboat)");
                } else if (keysDown.has('r')) {
                    altDragType = 'Trade';
                    console.log("Routing Mode Active: Red (Trade)");
                } else if (keysDown.has('y')) {
                    altDragType = 'Secondary';
                    console.log("Routing Mode Active: Yellow (Secondary)");
                }

                requestAnimationFrame(draw);
            }
        } else {
            // Plain Left-Click: ONLY Panning (No selection logic whatsoever)
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            mapCanvas.classList.add('dragging');
        }
    });

    // 4. Mouse Move: Pan Camera or Paint Hexes
    window.addEventListener('mousemove', (e) => {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;

        if (isPainting) {
            const world = getMouseWorldCoords(e);
            const coords = pixelToHex(world.x, world.y, baseHexSize);
            const hexId = getHexId(coords.q, coords.r);

            if (hexId && hexId !== lastPaintedHexId) {
                if (paintAction === 'select') selectedHexes.add(hexId);
                else selectedHexes.delete(hexId);
                lastPaintedHexId = hexId;
                requestAnimationFrame(draw);
            }
        } else if (isDragging) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;

            cameraX -= dx / zoom;
            cameraY -= dy / zoom;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            requestAnimationFrame(draw);
        } else if (isAltDragging) {
            // Just request redraw to show the preview line
            requestAnimationFrame(draw);
        }
    });

    // 5. Mouse Up: Stop Actions entirely
    window.addEventListener('mouseup', (e) => {
        if (isAltDragging && altDragStartId) {
            const world = getMouseWorldCoords(e);
            const coords = pixelToHex(world.x, world.y, baseHexSize);
            const endHexId = getHexId(coords.q, coords.r);

            if (endHexId && endHexId !== altDragStartId) {
                // Toggle route
                const sorted = [altDragStartId, endHexId].sort();
                if (!window.sectorRoutes) window.sectorRoutes = [];

                const existingIndex = window.sectorRoutes.findIndex(r =>
                    (r.startId === sorted[0] && r.endId === sorted[1])
                );

                if (existingIndex !== -1) {
                    window.sectorRoutes.splice(existingIndex, 1);
                    console.log(`Route Removed: ${sorted[0]} to ${sorted[1]}`);
                    showToast(`Route removed: ${sorted[0]} -> ${sorted[1]}`, 2000);
                } else {
                    window.sectorRoutes.push({ startId: sorted[0], endId: sorted[1], type: altDragType });
                    console.log(`${altDragType} Route Added: ${sorted[0]} to ${sorted[1]}`);
                    const colorName = altDragType === 'Xboat' ? 'Green' : (altDragType === 'Trade' ? 'Red' : 'Yellow');
                    showToast(`${colorName} Route added: ${sorted[0]} -> ${sorted[1]}`, 2000);
                }
            }
        }

        isDragging = false;
        isPainting = false;
        isAltDragging = false;
        altDragStartId = null;
        lastPaintedHexId = null;
        mapCanvas.classList.remove('dragging');
        requestAnimationFrame(draw);
    });

    // 6. Mouse Wheel: Zoom
    mapCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const direction = e.deltaY > 0 ? -1 : 1;
        const mouseWorldX = cameraX + e.clientX / zoom;
        const mouseWorldY = cameraY + e.clientY / zoom;

        if (direction > 0) zoom *= zoomFactor;
        else zoom /= zoomFactor;

        zoom = Math.max(0.1, Math.min(zoom, 10));
        cameraX = mouseWorldX - e.clientX / zoom;
        cameraY = mouseWorldY - e.clientY / zoom;
        requestAnimationFrame(draw);
    }, { passive: false });
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', async (e) => {
        // Skip shortcuts if the user is typing in an input field or textarea, except for Escape
        if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) && e.key !== 'Escape') {
            return;
        }

        const key = e.key.toLowerCase();
        keysDown.add(key);

        // Prevent default for routing keys
        if (['g', 'r', 'y'].includes(key)) {
            e.preventDefault();
        }

        if (e.ctrlKey && key === 's') {
            e.preventDefault();
            const world = getMouseWorldCoords({ clientX: currentMouseX, clientY: currentMouseY });
            const coords = pixelToHex(world.x, world.y, baseHexSize);
            const hexId = getHexId(coords.q, coords.r);
            if (hexId) {
                const parts = hexId.split('-');
                contextSectorPrefix = parts[0];
                toggleSectorHexes();
            }
        } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const world = getMouseWorldCoords({ clientX: currentMouseX, clientY: currentMouseY });
            const coords = pixelToHex(world.x, world.y, baseHexSize);
            const hexId = getHexId(coords.q, coords.r);
            if (hexId) {
                const parts = hexId.split('-');
                contextSubsectorPrefix = parts[0] + '-' + parts[1];
                toggleSubsectorHexes();
            }
        } else if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            if (!validateSelection('generate')) return;

            saveHistoryState('Mongoose Macro');
            if (window.isLoggingEnabled) window.batchLogData = [];

            console.log("Bulk Generating MgT2E Full System...");
            await ensureNamesLoaded();

            if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Full Mongoose 2E Generation sequence. Proceed?")) {
                return;
            }

            // Capture the target hexes NOW so they don't change if the user deselects during the wait
            const targetHexes = Array.from(selectedHexes);

            // Auto Populate
            targetHexes.forEach(hexId => {
                const roll = roll1D();
                if (roll <= 3) {
                    hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
                } else {
                    hexStates.set(hexId, { type: 'EMPTY' });
                }
            });
            requestAnimationFrame(draw);
            showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);

            // Generate Mainworlds
            setTimeout(() => {
                targetHexes.forEach(hexId => {
                    try {
                        let stateObj = hexStates.get(hexId);
                        if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                            stateObj.mgt2eData = generateMgT2EMainworld(hexId);
                            // Clear all variants to ensure fresh generation
                            stateObj.ctData = null;
                            stateObj.t5Data = null;
                            stateObj.ctSystem = null;
                            stateObj.mgtSystem = null;
                            stateObj.t5System = null;
                            stateObj.ctPhysical = null;
                            stateObj.mgtPhysical = null;
                            stateObj.t5Physical = null;
                            stateObj.mgtSocio = null;
                            stateObj.t5Socio = null;
                            hexStates.set(hexId, stateObj);
                        }
                    } catch (err) {
                        console.error(`Mongoose Macro Step 2 failed for hex ${hexId}:`, err);
                    }
                });
                requestAnimationFrame(draw);
                showToast(`Generated MgT2E Mainworlds...`, 1000);

                // Socioeconomics
                setTimeout(() => {
                    targetHexes.forEach(hexId => {
                        try {
                            let stateObj = hexStates.get(hexId);
                            let baseData = stateObj ? (stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData) : null;
                            if (baseData) {
                                stateObj.mgtSocio = generateMgT2ESocioeconomics(baseData);
                                stateObj.t5Socio = null;
                                hexStates.set(hexId, stateObj);
                            }
                        } catch (err) {
                            console.error(`Mongoose Macro Step 3 failed for hex ${hexId}:`, err);
                        }
                    });
                    requestAnimationFrame(draw);
                    showToast(`Expanded MgT2E Socioeconomics...`, 1000);

                    // Physical System
                    setTimeout(() => {
                        targetHexes.forEach(hexId => {
                            try {
                                let stateObj = hexStates.get(hexId);
                                let baseData = stateObj ? (stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData) : null;
                                if (baseData) {
                                    let chunk1System = generateMgT2ESystemChunk1(baseData);
                                    let systemWithOrbits = generateMgT2ESystemChunk2(chunk1System, baseData);
                                    let systemWithSizes = generateMgT2ESystemChunk3(systemWithOrbits, baseData);
                                    let systemWithAtmosphere = generateMgT2ESystemChunk4(systemWithSizes, baseData);
                                    let systemWithTemps = generateMgT2ESystemChunk5(systemWithAtmosphere);
                                    let systemWithRatings = generateMgT2ESystemChunk6(systemWithTemps);
                                    let systemWithUWP = generateMgT2ESystemChunk7(systemWithRatings, baseData);

                                    stateObj.mgtSystem = systemWithUWP;
                                    stateObj.t5Physical = null;
                                    stateObj.ctPhysical = null;
                                    hexStates.set(hexId, stateObj);
                                }
                            } catch (err) {
                                console.error(`Mongoose Macro Step 4 failed for hex ${hexId}:`, err);
                            }
                        });
                        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
                            downloadBatchLog('MgT2E_Full_Macro', targetHexes.length);
                        }
                        requestAnimationFrame(draw);
                        showToast(`Full MgT2E Generation Complete!`, 4000);
                    }, 500);
                }, 500);
            }, 500);
        } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            if (!validateSelection('generate')) return;

            saveHistoryState('CT Macro');

            console.log("Bulk Generating CT Full System...");
            await ensureNamesLoaded();

            if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Full Classic Traveller Generation sequence. Proceed?")) {
                return;
            }

            // Capture the target hexes NOW
            const targetHexes = Array.from(selectedHexes);

            // 1. Auto Populate (Standard 3 in 6)
            targetHexes.forEach(hexId => {
                reseedForHex(hexId);
                const roll = roll1D();
                if (roll <= 3) {
                    hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
                } else {
                    hexStates.set(hexId, { type: 'EMPTY' });
                }
            });
            requestAnimationFrame(draw);
            showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);

            // 2. Generate Mainworlds
            setTimeout(() => {
                if (window.isLoggingEnabled) window.batchLogData = [];
                targetHexes.forEach(hexId => {
                    try {
                        let stateObj = hexStates.get(hexId);
                        if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                            stateObj.ctData = generateCTMainworld(hexId);
                            // Clear all variants to ensure fresh generation
                            stateObj.mgt2eData = null;
                            stateObj.t5Data = null;
                            stateObj.mgtSystem = null;
                            stateObj.t5System = null;
                            stateObj.ctSystem = null;
                            stateObj.mgtPhysical = null;
                            stateObj.t5Physical = null;
                            stateObj.ctPhysical = null;
                            stateObj.mgtSocio = null;
                            stateObj.t5Socio = null;
                            hexStates.set(hexId, stateObj);
                        }
                    } catch (err) {
                        console.error(`Macro Step 2 (Mainworld) failed for hex ${hexId}:`, err);
                    }
                });
                requestAnimationFrame(draw);
                showToast(`Generated CT Mainworlds...`, 1000);

                // 3. Expand Book 6 Systems
                setTimeout(() => {
                    targetHexes.forEach(hexId => {
                        try {
                            let stateObj = hexStates.get(hexId);
                            let baseData = stateObj ? stateObj.ctData : null;
                            if (baseData) {
                                let systemName = baseData.name || stateObj.name || hexId;
                                if (window.isLoggingEnabled) startTrace(hexId, 'CT System Macro Expansion', systemName);

                                let chunk1 = generateCTSystemChunk1(baseData, hexId);
                                let chunk2 = generateCTSystemChunk2(chunk1, baseData);
                                let chunk3 = generateCTSystemChunk3(chunk2, baseData);
                                let chunk4 = generateCTSystemChunk4(chunk3, baseData);
                                let chunk5 = generateCTSystemChunk5(chunk4, baseData);
                                stateObj.ctSystem = chunk5;
                                stateObj.ctPhysical = generateCTPhysical(baseData, hexId);

                                // Clean up cross-engine remnants
                                stateObj.t5Physical = null;
                                stateObj.mgtSystem = null;
                                hexStates.set(hexId, stateObj);
                            }
                        } catch (err) {
                            console.error(`Macro Step 3 (Expansion) failed for hex ${hexId}:`, err);
                        }
                    });
                    if (window.isLoggingEnabled && window.batchLogData.length > 0) {
                        downloadBatchLog('CT_Full_Macro', targetHexes.length);
                    }
                    requestAnimationFrame(draw);
                    showToast(`Full CT Generation Complete!`, 4000);
                }, 500);
            }, 500);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            const hexEditor = document.getElementById('hex-editor');
            const helpModal = document.getElementById('help-modal');
            if (hexEditor.style.display === 'flex') {
                closeHexEditor();
            } else if (helpModal.style.display === 'flex') {
                closeHelpModal();
            } else {
                deselectAllHexes();
            }
        } else if (e.ctrlKey && key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                // REDO
                if (window.redoStack.length > 0) {
                    const snap = window.redoStack.pop();
                    const current = {
                        action: snap.action,
                        routes: JSON.parse(JSON.stringify(window.sectorRoutes || [])),
                        hexStates: JSON.parse(JSON.stringify(Array.from(hexStates.entries())))
                    };
                    window.undoStack.push(current);
                    window.sectorRoutes = snap.routes;
                    hexStates.clear();
                    snap.hexStates.forEach(([id, st]) => hexStates.set(id, st));
                    showToast(`Redid: ${snap.action}`, 2000);
                    requestAnimationFrame(draw);
                }
            } else {
                // UNDO
                if (window.undoStack.length > 0) {
                    const snap = window.undoStack.pop();
                    const current = {
                        action: snap.action,
                        routes: JSON.parse(JSON.stringify(window.sectorRoutes || [])),
                        hexStates: JSON.parse(JSON.stringify(Array.from(hexStates.entries())))
                    };
                    window.redoStack.push(current);
                    window.sectorRoutes = snap.routes;
                    hexStates.clear();
                    snap.hexStates.forEach(([id, st]) => hexStates.set(id, st));
                    showToast(`Undid: ${snap.action}`, 2000);
                    requestAnimationFrame(draw);
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        keysDown.delete(e.key.toLowerCase());
    });
}

// ============================================================================
// SELECTION HELPERS
// ============================================================================

function deselectAllHexes() {
    selectedHexes.clear();
    document.getElementById('context-menu').classList.remove('visible');
    console.log("Cleared all hexes.");
    requestAnimationFrame(draw);
}

function toggleSectorHexes() {
    console.log("Sector Toggle Fired! Prefix:", contextSectorPrefix);
    if (!contextSectorPrefix) return;
    for (let q = 0; q <= 255; q++) {
        for (let r = 0; r <= 159; r++) {
            const id = getHexId(q, r);
            if (id && id.startsWith(contextSectorPrefix + '-')) {
                if (selectedHexes.has(id)) selectedHexes.delete(id);
                else selectedHexes.add(id);
            }
        }
    }
    document.getElementById('context-menu').classList.remove('visible');
    console.log("Selected hexes size:", selectedHexes.size);
    requestAnimationFrame(draw);
}

function toggleSubsectorHexes() {
    console.log("Subsector Toggle Fired! Prefix:", contextSubsectorPrefix);
    if (!contextSubsectorPrefix) return;
    for (let q = 0; q <= 255; q++) {
        for (let r = 0; r <= 159; r++) {
            const id = getHexId(q, r);
            if (id && id.startsWith(contextSubsectorPrefix)) {
                if (selectedHexes.has(id)) selectedHexes.delete(id);
                else selectedHexes.add(id);
            }
        }
    }
    document.getElementById('context-menu').classList.remove('visible');
    console.log("Selected hexes size:", selectedHexes.size);
    requestAnimationFrame(draw);
}

function toggleSingleHex() {
    console.log("Menu Toggle Single Hex Fired! target ID:", contextHexId);
    if (!contextHexId) return;
    if (selectedHexes.has(contextHexId)) {
        selectedHexes.delete(contextHexId);
    } else {
        selectedHexes.add(contextHexId);
    }
    console.log("Selected hexes size is now:", selectedHexes.size);
    document.getElementById('context-menu').classList.remove('visible');
    requestAnimationFrame(draw);
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, duration = 3000) {
    console.log("Toast:", message);
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, duration);
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateSelection(actionType) {
    if (selectedHexes.size === 0) {
        alert("Please select one or more hexes first (Shift + Left Click).");
        document.getElementById('context-menu').classList.remove('visible');
        return false;
    }

    if (actionType !== 'clear' && selectedHexes.size > 1280) {
        alert("We are currently limited to generating one sector (1280 hexes) at a time to prevent browser crashes. Please reduce your selection.");
        document.getElementById('context-menu').classList.remove('visible');
        return false;
    }

    if (actionType === 'populate') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            if (hexStates.has(hexId)) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already contain data. Do you want to overwrite them?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    } else if (actionType === 'generate') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && (state.ctData || state.mgt2eData || state.t5Data)) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already have generated Mainworld data. Do you want to overwrite them?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    } else if (actionType === 'socio') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && (state.t5Socio || state.mgtSocio)) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already have generated Socioeconomic data. Generating new data will overwrite the existing socioeconomics. Are you sure?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    } else if (actionType === 'physical') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && state.t5Physical) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already have generated Physical Stats. Generating new data will overwrite the existing physical stats. Are you sure?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    }
    return true;
}

// ============================================================================
// CONTEXT MENU HANDLERS
// ============================================================================

function setupContextMenu() {
    document.getElementById('ctx-manual-empty').addEventListener('click', () => {
        if (!validateSelection('populate')) return;
        saveHistoryState('Manual: Set Empty');
        selectedHexes.forEach(hexId => {
            hexStates.set(hexId, { type: 'EMPTY' });
        });
        document.getElementById('context-menu').classList.remove('visible');
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-manual-system').addEventListener('click', () => {
        if (!validateSelection('populate')) return;
        saveHistoryState('Manual: Populate System');
        selectedHexes.forEach(hexId => {
            hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
        });
        document.getElementById('context-menu').classList.remove('visible');
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-manual-clear').addEventListener('click', () => {
        if (!validateSelection('clear')) return;
        saveHistoryState('Batch Clear');
        selectedHexes.forEach(hexId => {
            hexStates.delete(hexId);
            removeRoutesForHex(hexId);
        });
        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Cleared ${selectedHexes.size} hex(es) and connected routes.`, 2000);
        requestAnimationFrame(draw);
    });

    function removeRoutesForHex(hexId) {
        if (!window.sectorRoutes) return;
        window.sectorRoutes = window.sectorRoutes.filter(r => r.startId !== hexId && r.endId !== hexId);
    }

    document.getElementById('ctx-sparse').addEventListener('click', () => autoPopulate(2));
    document.getElementById('ctx-regular').addEventListener('click', () => autoPopulate(3));
    document.getElementById('ctx-dense').addEventListener('click', () => autoPopulate(4));

    document.getElementById('ctx-select-hex').addEventListener('click', toggleSingleHex);
    document.getElementById('ctx-select-subsector').addEventListener('click', toggleSubsectorHexes);
    document.getElementById('ctx-select-sector').addEventListener('click', toggleSectorHexes);
    document.getElementById('ctx-deselect-all').addEventListener('click', deselectAllHexes);
    document.getElementById('ctx-help').addEventListener('click', openHelpModal);

    // Generation handlers are defined in the engine files but triggered here
    setupGenerationHandlers();
}

function autoPopulate(chanceOutOfSix) {
    if (!validateSelection('populate')) return;
    saveHistoryState('Auto Populate');
    selectedHexes.forEach(hexId => {
        reseedForHex(hexId);
        const roll = roll1D();
        if (roll <= chanceOutOfSix) {
            hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
        } else {
            hexStates.set(hexId, { type: 'EMPTY' });
        }
    });
    document.getElementById('context-menu').classList.remove('visible');
    requestAnimationFrame(draw);
}

function setupGenerationHandlers() {
    // CT Generation
    document.getElementById('ctx-gen-ct').addEventListener('click', async () => {
        if (!validateSelection('generate')) return;
        saveHistoryState('Generate CT Mainworld');
        await ensureNamesLoaded();
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') stateObj = { type: stateObj };

            if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                stateObj.ctData = generateCTMainworld(hexId);
                stateObj.mgt2eData = null;
                stateObj.t5Data = null;
                stateObj.mgtSystem = null;
                stateObj.t5System = null;
                stateObj.mgtPhysical = null;
                stateObj.t5Physical = null;
                hexStates.set(hexId, stateObj);
                count++;
            }
        });
        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('CT_Mainworlds', count);
        }
        document.getElementById('context-menu').classList.remove('visible');
        if (count > 0) {
            showToast(`Generated Classic Traveller Mainworlds for ${count} hex(es)`);
        } else {
            showToast("No populated hexes selected");
        }
        requestAnimationFrame(draw);
    });

    // MgT2E Generation
    document.getElementById('ctx-gen-mgt2e').addEventListener('click', async () => {
        if (!validateSelection('generate')) return;
        saveHistoryState('Generate MgT2E Mainworld');
        await ensureNamesLoaded();
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') stateObj = { type: stateObj };

            if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                stateObj.mgt2eData = generateMgT2EMainworld(hexId);
                stateObj.ctData = null;
                stateObj.t5Data = null;
                stateObj.ctSystem = null;
                stateObj.t5System = null;
                stateObj.ctPhysical = null;
                stateObj.t5Physical = null;
                hexStates.set(hexId, stateObj);
                count++;
            }
        });
        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Mainworlds', count);
        }
        document.getElementById('context-menu').classList.remove('visible');
        if (count > 0) {
            showToast(`Generated MgT2E Mainworlds for ${count} hex(es)`);
        } else {
            showToast("No populated hexes selected");
        }
        requestAnimationFrame(draw);
    });

    // T5 Generation
    document.getElementById('ctx-gen-t5').addEventListener('click', async () => {
        if (!validateSelection('generate')) return;
        saveHistoryState('Generate T5 Mainworld');
        await ensureNamesLoaded();
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') stateObj = { type: stateObj };

            if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                stateObj.t5Data = generateT5Mainworld(hexId);
                stateObj.ctData = null;
                stateObj.mgt2eData = null;
                stateObj.ctSystem = null;
                stateObj.mgtSystem = null;
                stateObj.ctPhysical = null;
                stateObj.mgtPhysical = null;
                hexStates.set(hexId, stateObj);
                count++;
            }
        });
        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Mainworlds', count);
        }
        document.getElementById('context-menu').classList.remove('visible');
        if (count > 0) {
            showToast(`Generated T5 Mainworlds for ${count} hex(es)`);
        } else {
            showToast("No populated hexes selected");
        }
        requestAnimationFrame(draw);
    });

    // Socioeconomics
    document.getElementById('ctx-expand-socio-t5').addEventListener('click', () => {
        if (selectedHexes.size === 0) {
            alert("Please select one or more hexes first (Shift + Left Click).");
            document.getElementById('context-menu').classList.remove('visible');
            return;
        }

        saveHistoryState('Expand T5 Socioeconomics');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = null;
            if (stateObj) {
                baseData = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;
            }

            if (baseData) {
                stateObj.t5Socio = generateT5Socioeconomics(baseData, hexId);
                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Socio', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded T5 Socioeconomics for ${selectedHexes.size} hex(es)`);
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-expand-socio-mgt2e').addEventListener('click', () => {
        if (!validateSelection('socio')) return;

        saveHistoryState('Expand MgT2E Socioeconomics');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = null;
            if (stateObj) {
                baseData = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;
            }

            if (baseData) {
                stateObj.mgtSocio = generateMgT2ESocioeconomics(baseData, hexId);
                stateObj.t5Socio = null;
                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Socio', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded MgT2E Socioeconomics for ${selectedHexes.size} hex(es)`);
        requestAnimationFrame(draw);
    });

    // Physical System Expansion
    document.getElementById('ctx-expand-physical-ct').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        saveHistoryState('Expand CT System');
        let missingData = false;

        if (window.isLoggingEnabled) window.batchLogData = [];

        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = stateObj ? (stateObj.ctData || stateObj.mgt2eData || stateObj.t5Data) : null;

            if (baseData) {
                let systemName = baseData.name || stateObj.name || hexId;
                if (window.isLoggingEnabled) startTrace(hexId, 'Classic Traveller System Expansion', systemName);

                let chunk1 = generateCTSystemChunk1(baseData, hexId);
                let chunk2 = generateCTSystemChunk2(chunk1, baseData);
                let chunk3 = generateCTSystemChunk3(chunk2, baseData);
                let chunk4 = generateCTSystemChunk4(chunk3, baseData);
                let chunk5 = generateCTSystemChunk5(chunk4, baseData);
                stateObj.ctSystem = chunk5;
                stateObj.ctPhysical = generateCTPhysical(baseData, hexId);
                stateObj.t5Physical = null;
                hexStates.set(hexId, stateObj);

                if (chunk5) {
                    console.log(`[CT System Chunk 5] Hex ${hexId} | ${chunk5.nature} | Primary: ${chunk5.stars[0].name}`);
                    const tableData = chunk5.orbits.map(o => ({
                        Orbit: o.orbit,
                        Zone: o.zone,
                        Contents: o.contents ? (o.contents.type + (o.contents.size ? ` (${o.contents.size})` : '')) : 'Empty',
                        UWP: o.contents ? (o.contents.uwpSecondary || (o.contents.type === 'Mainworld' ? 'Auth' : '-')) : '-',
                        Satellites: o.contents && o.contents.satellites ? o.contents.satellites.map(s => `${s.size} ${s.uwpSecondary} (${s.pd}r)`).join(', ') : '-'
                    }));
                    if (chunk5.capturedPlanets) {
                        chunk5.capturedPlanets.forEach(p => {
                            tableData.push({
                                Orbit: p.orbit.toFixed(1),
                                Zone: p.zone,
                                Contents: 'Captured Planet',
                                UWP: p.uwpSecondary || '-',
                                Satellites: p.satellites ? p.satellites.map(s => `${s.size} ${s.uwpSecondary} (${s.pd}r)`).join(', ') : '-'
                            });
                        });
                        tableData.sort((a, b) => parseFloat(a.Orbit) - parseFloat(b.Orbit));
                    }
                    console.table(tableData);
                }
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData && window.batchLogData.length > 0) {
            downloadBatchLog('CT_Systems', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded CT System for ${selectedHexes.size} hex(es)`);
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-expand-physical-mgt2e').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        saveHistoryState('Expand MgT2E System');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = stateObj ? stateObj.mgt2eData : null;

            if (baseData) {
                let chunk1System = generateMgT2ESystemChunk1(baseData, hexId);
                let systemWithOrbits = generateMgT2ESystemChunk2(chunk1System, baseData);
                let systemWithSizes = generateMgT2ESystemChunk3(systemWithOrbits, baseData);
                let systemWithAtmosphere = generateMgT2ESystemChunk4(systemWithSizes, baseData);
                let systemWithTemps = generateMgT2ESystemChunk5(systemWithAtmosphere);
                let systemWithRatings = generateMgT2ESystemChunk6(systemWithTemps);
                let systemWithUWP = generateMgT2ESystemChunk7(systemWithRatings, baseData);

                console.log(`[MgT2E System Gen] Hex ${hexId} | Age: ${systemWithUWP.age.toFixed(2)} Gyr | HZCO: ${systemWithUWP.hzco.toFixed(2)} | Stars: ${systemWithUWP.stars.map(s => s.name).join(', ')}`);
                console.table(systemWithUWP.worlds.map(w => ({
                    Type: w.type,
                    Orbit: typeof w.orbitId === 'number' ? w.orbitId.toFixed(2) : w.orbitId,
                    Size: w.size,
                    Atm: w.atmCode !== undefined ? w.atmCode : '-',
                    Hydro: w.hydroCode !== undefined ? w.hydroCode : '-',
                    UWP: w.uwpSecondary || (w.type === 'Mainworld' ? 'MW' : '-'),
                    Class: w.classifications ? w.classifications.join('/') || 'None' : '-',
                    Hab: w.habitability !== undefined ? w.habitability : '-',
                    Parent: w.parentStarIdx !== undefined ? w.parentStarIdx : 0,
                    OType: w.orbitType || '-'
                })));

                stateObj.mgtSystem = systemWithUWP;
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have MgT2E Mainworld data generated yet.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Systems', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded MgT2E Physical system for ${selectedHexes.size} hex(es)`);
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-expand-physical-t5').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        saveHistoryState('Expand T5 System');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = null;
            if (stateObj) {
                baseData = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;
            }

            if (baseData) {
                let sys = generateT5SystemChunk1(baseData, stateObj.t5System, hexId);
                sys = generateT5SystemChunk2(sys, baseData);
                sys = generateT5SystemChunk3(sys, baseData);

                stateObj.t5System = sys;
                stateObj.t5Physical = null; // Clean up old physical object if it exists
                stateObj.ctPhysical = null;
                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Systems', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded T5 Physical system for ${selectedHexes.size} hex(es)`);
        requestAnimationFrame(draw);
    });

    // X-Boat Routes
    document.getElementById('ctx-gen-xboat').addEventListener('click', () => {
        saveHistoryState('Generate Xboat Routes');
        generateXboatRoutes();
        const routeCount = window.sectorRoutes ? window.sectorRoutes.length : 0;
        showToast(`Interstellar Network Generated: ${routeCount} routes.`, 3000);
        document.getElementById('context-menu').classList.remove('visible');
        requestAnimationFrame(draw);
    });
}

// ============================================================================
// SETTINGS PANEL
// ============================================================================

function setupSettingsPanel() {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsToggle = document.getElementById('settings-toggle');
    const closeSettings = document.getElementById('btn-close-settings');

    settingsToggle.addEventListener('click', () => {
        settingsPanel.classList.toggle('collapsed');
    });

    closeSettings.addEventListener('click', () => {
        settingsPanel.classList.add('collapsed');
    });

    const loggingToggle = document.getElementById('toggle-logging');
    if (loggingToggle) {
        loggingToggle.addEventListener('change', (e) => {
            window.isLoggingEnabled = e.target.checked;
            showToast(window.isLoggingEnabled ? "Batch Logging Enabled" : "Batch Logging Disabled", 2000);
        });
    }

    document.getElementById('toggle-borders').addEventListener('change', (e) => {
        showSubsectorBorders = e.target.checked;
        requestAnimationFrame(draw);
    });

    document.getElementById('toggle-dev-view').addEventListener('change', (e) => {
        devView = e.target.checked;
        requestAnimationFrame(draw);
    });

    // --- Generation Seed ---
    const seedInput = document.getElementById('input-seed');
    const randomizeBtn = document.getElementById('btn-randomize-seed');

    // Load initial seed
    const savedSeed = localStorage.getItem('traveller_gen_seed') || "TravellerMagnus";
    seedInput.value = savedSeed;
    setRandomSeed(savedSeed);

    seedInput.addEventListener('input', (e) => {
        const newSeed = e.target.value;
        setRandomSeed(newSeed || "TravellerMagnus");
        localStorage.setItem('traveller_gen_seed', newSeed);
    });

    randomizeBtn.addEventListener('click', () => {
        const randomSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
        seedInput.value = randomSeed;
        setRandomSeed(randomSeed);
        localStorage.setItem('traveller_gen_seed', randomSeed);
        showToast(`Seed randomized: ${randomSeed}`, 2000);
    });
}

// ============================================================================
// HELP MODAL
// ============================================================================

function openHelpModal() {
    document.getElementById('context-menu').classList.remove('visible');
    document.getElementById('help-modal').style.display = 'flex';
}

function closeHelpModal() {
    document.getElementById('help-modal').style.display = 'none';
}

function setupHelpModal() {
    document.getElementById('btn-close-help').addEventListener('click', closeHelpModal);
}




// ============================================================================
// SAVE/LOAD
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
            routes: window.sectorRoutes || []
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
// HEX EDITOR
// ============================================================================

function openHexEditor(hexId) {
    const stateObj = hexStates.get(hexId);
    if (!stateObj || stateObj.type !== 'SYSTEM_PRESENT' || (!stateObj.ctData && !stateObj.mgt2eData && !stateObj.t5Data)) {
        return;
    }

    editingHexId = hexId;
    const data = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;

    // Check multiple potential locations for the name
    const systemName = data.name || stateObj.name || "";

    const nameStr = systemName ? `${systemName} [${hexId}]` : `${hexId} Details`;
    document.getElementById('hex-editor-title').innerText = nameStr;
    document.getElementById('edit-name').value = systemName;
    document.getElementById('edit-starport').value = data.starport;
    document.getElementById('edit-size').value = data.size;
    document.getElementById('edit-atm').value = data.atm;
    document.getElementById('edit-hydro').value = data.hydro;
    document.getElementById('edit-pop').value = data.pop;
    document.getElementById('edit-gov').value = data.gov;
    document.getElementById('edit-law').value = data.law;
    document.getElementById('edit-tl').value = data.tl;

    document.getElementById('edit-naval').checked = data.navalBase || false;
    document.getElementById('edit-scout').checked = data.scoutBase || false;
    document.getElementById('edit-military').checked = data.militaryBase || false;
    document.getElementById('edit-corsair').checked = data.corsairBase || false;
    document.getElementById('edit-gas').checked = data.gasGiant || false;

    document.getElementById('edit-trade-codes').value = data.tradeCodes ? data.tradeCodes.join(' ') : '';
    document.getElementById('edit-travel-zone').value = data.travelZone || 'Green';

    document.getElementById('edit-military').parentElement.style.display = stateObj.mgt2eData ? 'flex' : 'none';
    document.getElementById('edit-corsair').parentElement.style.display = stateObj.mgt2eData ? 'flex' : 'none';

    // Reset accordions
    document.getElementById('editor-socio-t5-container').style.display = 'none';
    document.getElementById('acc-btn-t5-socio').style.display = 'none';
    document.getElementById('acc-btn-t5-socio').classList.remove('active');

    document.getElementById('editor-socio-mgt-container').style.display = 'none';
    document.getElementById('acc-btn-mgt-socio').style.display = 'none';
    document.getElementById('acc-btn-mgt-socio').classList.remove('active');

    // Populate accordions if data exists
    populateEditorAccordions(stateObj);

    document.getElementById('hex-editor').style.display = 'flex';
}

function populateEditorAccordions(stateObj) {
    // MgT2E Socioeconomics
    if (stateObj.mgtSocio) { // Only run if data exists
        // 1. Make the accordion button visible
        document.getElementById('acc-btn-mgt-socio').style.display = 'flex';

        // 2. Start the accordion closed
        document.getElementById('editor-socio-mgt-container').style.display = 'none';

        const ms = stateObj.mgtSocio;

        // Map engine keys to HTML IDs
        const fields = {
            'edit-mgt-pvalue': ms.pValue,
            'edit-mgt-totalpop': ms.totalWorldPop ? ms.totalWorldPop.toLocaleString() : '0',
            'edit-mgt-pcr': ms.pcr,
            'edit-mgt-urban': ms.urbanPercent + '%',
            'edit-mgt-totalurban': ms.totalUrbanPop ? ms.totalUrbanPop.toLocaleString() : '0',
            'edit-mgt-mcities': ms.majorCities,
            'edit-mgt-totalmcpop': ms.totalMajorCityPop ? ms.totalMajorCityPop.toLocaleString() : '0',
            'edit-mgt-gov-profile': ms.govProfile,
            'edit-mgt-fac': ms.factions,
            'edit-mgt-judicial-profile': ms.judicialSystemProfile,
            'edit-mgt-law-profile': ms.lawProfile,
            'edit-mgt-tech-profile': ms.techProfile,
            'edit-mgt-cul-profile': ms.culturalProfile,
            'edit-mgt-im': ms.Im,
            'edit-mgt-eco-profile': ms.economicProfile,
            'edit-mgt-ru': ms.RU,
            'edit-mgt-gwp': ms.pcGWP,
            'edit-mgt-wtn': ms.WTN,
            'edit-mgt-ir': ms.IR,
            'edit-mgt-dr': ms.DR,
            'edit-mgt-starport-profile': ms.starportProfile,
            'edit-mgt-mil-profile': ms.militaryProfile
        };

        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) {
                if ("value" in el) el.value = val;
                else el.innerText = val;
            }
        }
    } // End if (stateObj.mgtSocio)

    // T5 Socioeconomics
    if (stateObj.t5Socio) {
        document.getElementById('acc-btn-t5-socio').style.display = 'flex';
        document.getElementById('editor-socio-t5-container').style.display = 'none';
        const ts = stateObj.t5Socio;
        const fields = {
            'edit-popm': ts.popMultiplier,
            'edit-belts': ts.belts,
            'edit-gas-giants': ts.gasGiants,
            'edit-worlds': ts.worlds,
            'edit-ix': ts.Importance || ts.Ix,
            'edit-ru': ts.ResourceUnits || ts.RU,
            'edit-r': ts.ecoResources || ts.R,
            'edit-l': ts.ecoLabor || ts.L,
            'edit-i': ts.ecoInfrastructure || ts.I,
            'edit-e': ts.ecoEfficiency || ts.E,
            'edit-h': ts.H,
            'edit-a': ts.A,
            'edit-s': ts.S,
            'edit-sym': ts.Sym
        };
        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) {
                if ("value" in el) el.value = val;
                else el.innerText = val;
            }
        }
    }

    // MgT2E Star System Tree (RESTORED CRUNCHY UI)
    if (stateObj.mgtSystem) {
        document.getElementById('acc-btn-mgt-system').style.display = 'flex';
        const root = document.getElementById('editor-mgt-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.mgtSystem;

            // System Overview Header with P-Type Limits
            let html = `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">System Overview</div>
                <span>HZco (Primary): <strong>${sys.hzco.toFixed(2)}</strong></span>
                <span>Age: <strong>${sys.age.toFixed(2)} Gyr</strong></span>`;

            const mwBase = stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData;
            if (mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                const zoneColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                html += `<span style="color: ${zoneColor};">Travel Zone: <strong>${mwBase.travelZone}</strong></span>`;
            }

            if (sys.stars.length > 1 && sys.ptypeHzco !== undefined) {
                html += `<span style="color:#66fcf1;">P-Type HZco: <strong>${sys.ptypeHzco.toFixed(2)}</strong></span>`;
                let ptypeLimit = sys.ptypeInnerLimit !== undefined && sys.ptypeInnerLimit !== Infinity
                    ? sys.ptypeInnerLimit.toFixed(2) : 'N/A';
                html += `<span style="color:#66fcf1;">P-Type Inner Limit: <strong>${ptypeLimit}</strong></span>`;
            }
            html += `</div>`;

            // System Tree Structure
            html += `<div class="system-tree">`;

            // Iterate through each star and build nested tree
            sys.stars.forEach((star, starIdx) => {
                html += `<details open>`;
                html += `<summary>${star.role || 'Star'} - ${star.name} <span class="sys-title-info">Star</span></summary>`;
                html += `<div class="system-node">`;
                html += `<div class="system-stats">`;
                html += `<span>Mass: <strong>${star.mass.toFixed(2)} M☉</strong></span>`;
                html += `<span>Lum: <strong>${star.lum.toFixed(3)} L☉</strong></span>`;

                if (star.orbitId !== null && starIdx > 0) {
                    html += `<span>Orbit ID: <strong>${star.orbitId.toFixed(2)}</strong></span>`;
                    html += `<span>Ecc: <strong>${(star.eccentricity || 0).toFixed(3)}</strong></span>`;
                    if (star.mao) {
                        html += `<span>MAO: <strong>${star.mao.toFixed(2)}</strong></span>`;
                    }
                }
                html += `</div>`;

                // Worlds orbiting this star
                sys.worlds.forEach((w, widx) => {
                    let worldParent = w.parentStarIdx !== undefined ? w.parentStarIdx : 0;
                    if (worldParent !== starIdx || w.type === 'Empty') return;

                    // Physical characteristics (non-gas-giant, non-belt)
                    let mwBase = stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData;
                    let uwp = w.type === 'Mainworld' ? (mwBase ? mwBase.uwp : '-') : (w.uwpSecondary || '-');
                    let labelColor = w.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                    let summaryStyle = w.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                    let zoneLabel = '';
                    if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                        const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                        zoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                    }

                    let classLabel = (w.classifications && w.classifications.length > 0) ? ` | ${w.classifications[0]}` : '';

                    html += `<details open>`;
                    html += `<summary ${summaryStyle}>Orbit ${w.orbitId.toFixed(2)} (${w.orbitType || 'S-Type'})${classLabel}${zoneLabel} <span class="sys-title-info">${w.type}</span></summary>`;
                    html += `<div class="system-node">`;

                    if (w.type !== 'Planetoid Belt' && w.type !== 'Gas Giant' && uwp !== '-') {
                        html += `<div style="margin-bottom: 6px; font-family: monospace; font-size: 1.1em;">UWP: <strong style="color: ${labelColor}">${uwp}</strong></div>`;
                    }
                    if (w.classifications && w.classifications.length > 0) {
                        html += `<div style="margin-bottom: 6px; font-size: 0.85em; color: #a0a8b0;">Classification: <strong style="color: #66fcf1;">${w.classifications.join(', ')}</strong></div>`;
                    }

                    html += `<div class="system-stats">`;
                    html += `<span>Orbit ID: <strong>${w.orbitId.toFixed(2)}</strong></span>`;
                    html += `<span>Type: <strong>${w.orbitType || 'S-Type'}</strong></span>`;
                    html += `<span>Distance: <strong>${w.au ? w.au.toFixed(2) : '?'} AU</strong></span>`;
                    html += `<span>Ecc: <strong>${(w.eccentricity || 0).toFixed(3)}</strong></span>`;

                    if (w.periodYears) {
                        let periodStr = w.periodYears < 1.0
                            ? `${(w.periodYears * 365.25).toFixed(1)} days`
                            : `${w.periodYears.toFixed(2)} years`;
                        html += `<span class="system-stats-full">Period: <strong>${periodStr}</strong></span>`;
                    }

                    // Physical characteristics (non-gas-giant, non-belt)
                    if (w.type === 'Terrestrial Planet' || w.type === 'Mainworld') {
                        if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                            const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                            html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor};">Caution: ${mwBase.travelZone} Zone</div>`;
                        }
                        html += `<span>Axial Tilt: <strong>${w.axialTilt ? w.axialTilt.toFixed(1) : '0'}°</strong></span>`;
                        html += `<span>Mean Temp: <strong>${w.meanTempK ? (w.meanTempK - 273).toFixed(0) : '?'}°C</strong></span>`;
                        html += `<span>Habitability: <strong>${w.habitability !== undefined ? w.habitability : '?'}/15</strong></span>`;

                        if (w.resourceRating) {
                            html += `<span>Resource: <strong>${toUWPChar(w.resourceRating)}</strong></span>`;
                        }
                        if (w.secRU !== undefined && w.secPop > 0) {
                            html += `<span>RU: <strong>${w.secRU}</strong></span>`;
                        }
                    }

                    html += `</div>`;

                    // Moons with detailed stats
                    if (w.moons && w.moons.length > 0) {
                        w.moons.forEach((m, midx) => {
                            let mUwp = m.uwpSecondary || '-';
                            let mLabelColor = m.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                            let mSummaryStyle = m.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                            let mClassLabel = (m.classifications && m.classifications.length > 0) ? ` | ${m.classifications[0]}` : '';

                            html += `<details>`;
                            html += `<summary ${mSummaryStyle}>Moon ${midx + 1}${mClassLabel} <span class="sys-title-info">Size ${m.size}</span></summary>`;
                            html += `<div class="system-node">`;

                            if (mUwp !== '-') {
                                html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: ${mLabelColor}">${mUwp}</strong></div>`;
                            }
                            if (m.classifications && m.classifications.length > 0) {
                                html += `<div style="margin-bottom: 6px; font-size: 0.85em; color: #a0a8b0;">Classification: <strong style="color: #66fcf1;">${m.classifications.join(', ')}</strong></div>`;
                            }

                            html += `<div class="system-stats">`;
                            html += `<span>Orbit: <strong>${m.pd ? m.pd.toFixed(1) : '?'} ⌀</strong></span>`;
                            html += `<span>Ecc: <strong>${(m.eccentricity || 0).toFixed(3)}</strong></span>`;

                            if (m.periodHrs) {
                                let pStr = m.periodHrs < 24
                                    ? `${m.periodHrs.toFixed(1)}h`
                                    : `${(m.periodHrs / 24).toFixed(1)}d`;
                                html += `<span>Period: <strong>${pStr}</strong></span>`;
                            }

                            if (m.meanTempK) {
                                html += `<span>Temp: <strong>${(m.meanTempK - 273).toFixed(0)}°C</strong></span>`;
                            }

                            if (m.habitability !== undefined) {
                                html += `<span>Hab: <strong>${m.habitability}/15</strong></span>`;
                            }

                            html += `</div></div></details>`;
                        });
                    }

                    html += `</div></details>`;
                });

                html += `</div></details>`;
            });

            html += `</div>`;

            root.innerHTML = html;
            root.style.display = 'none';
        }
    }

    // CT Scouts System Tree (RESTORED CRUNCHY UI)
    if (stateObj.ctSystem) {
        document.getElementById('acc-btn-ct-system').style.display = 'flex';
        const root = document.getElementById('editor-ct-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.ctSystem;
            let mwBase = stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData;

            // System Overview Header
            let html = `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">CT Scouts Overview</div>
                <span>Nature: <strong>${sys.nature}</strong></span>
                <span>Total Orbits: <strong>${sys.maxOrbits}</strong></span>`;

            if (mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                const zoneColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                html += `<span style="color: ${zoneColor};">Travel Zone: <strong>${mwBase.travelZone}</strong></span>`;
            }
            html += `</div>`;

            // System Tree Structure
            html += `<div class="system-tree">`;

            // Iterate through each star
            sys.stars.forEach((star, starIdx) => {
                html += `<details open>`;
                html += `<summary>${starIdx === 0 ? 'Primary' : (star.role || 'Companion')} - ${star.name} <span class="sys-title-info">Star</span></summary>`;
                html += `<div class="system-node">`;
                html += `<div class="system-stats">`;
                html += `<span>Type: <strong>${star.type}</strong></span>`;
                html += `<span>Size: <strong>${star.size}</strong></span>`;
                if (star.mass) html += `<span>Mass: <strong>${star.mass.toFixed(2)} M☉</strong></span>`;
                if (star.luminosity) html += `<span>Lum: <strong>${star.luminosity.toFixed(3)} L☉</strong></span>`;
                if (starIdx > 0 && star.orbitLabel) html += `<span>Orbit: <strong>${star.orbitLabel}</strong></span>`;
                html += `</div>`;

                // Orbits for this star (assign to star based on structure if available, else primary)
                // Note: Logic simplification: system orbits are handled generally, but nested under the primary star.
                if (starIdx === 0) {
                    // Sort standard and captured orbits together
                    let allBodies = [];
                    sys.orbits.forEach(o => {
                        if (o.contents) {
                            allBodies.push({
                                isCaptured: false,
                                orbit: o.orbit,
                                zone: o.zone,
                                contents: o.contents
                            });
                        }
                    });
                    if (sys.capturedPlanets) {
                        sys.capturedPlanets.forEach(p => {
                            allBodies.push({
                                isCaptured: true,
                                orbit: p.orbit,
                                zone: p.zone,
                                contents: p
                            });
                        });
                    }
                    allBodies.sort((a, b) => a.orbit - b.orbit);

                    allBodies.forEach(body => {
                        let w = body.contents;
                        let o = body; // Simplified reference for orbit/zone

                        let uwp = (w.type === 'Mainworld' && mwBase) ? mwBase.uwp : (w.uwpSecondary || '-');
                        let typeLabel = w.type === 'Gas Giant'
                            ? (w.size + ' Gas Giant')
                            : (w.type === 'Planetoid Belt' ? 'Belt' : (body.isCaptured ? 'Captured' : w.type));
                        let labelColor = w.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                        let summaryStyle = w.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                        let zoneLabel = '';
                        if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                            const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                            zoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                        }

                        let orbitLabel = body.isCaptured
                            ? `Captured [${o.orbit.toFixed(1)}]`
                            : `Orbit ${o.orbit}`;

                        html += `<details open>`;
                        html += `<summary ${summaryStyle}>${orbitLabel} [${o.zone}] <span class="sys-title-info">${typeLabel} | ${uwp}${zoneLabel}</span></summary>`;
                        html += `<div class="system-node">`;

                        // UWP Line
                        html += `<div style="margin-bottom: 6px; font-family: monospace; font-size: 1.1em;">UWP: <strong style="color: ${labelColor}">${uwp}</strong></div>`;

                        // Physical Stats Grid
                        if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                            const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                            html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor}; margin-bottom: 8px;">Caution: ${mwBase.travelZone} Zone</div>`;
                        }
                        html += `<div class="system-stats">`;

                        // Orbital Data
                        html += `<span>Orbit: <strong>${body.isCaptured ? o.orbit.toFixed(1) : o.orbit}</strong></span>`;
                        if (w.distAU) html += `<span>Distance: <strong>${w.distAU.toFixed(2)} AU</strong></span>`;
                        if (w.orbitalPeriod) {
                            let pStr = w.orbitalPeriod < 1.0
                                ? `${(w.orbitalPeriod * 365.25).toFixed(1)}d`
                                : `${w.orbitalPeriod.toFixed(2)}y`;
                            html += `<span>Year: <strong>${pStr}</strong></span>`;
                        }

                        // Physicals
                        if (w.diamKm) html += `<span>Diameter: <strong>${w.diamKm.toLocaleString()} km</strong></span>`;
                        if (w.gravity !== undefined) html += `<span>Gravity: <strong>${w.gravity.toFixed(2)} G</strong></span>`;
                        if (w.mass !== undefined) html += `<span>Mass: <strong>${w.mass.toFixed(4)} M⊕</strong></span>`;

                        // Environment
                        if (w.temperature) {
                            html += `<span>Temp: <strong>${w.temperature}K / ${(w.temperature - 273).toFixed(0)}°C</strong></span>`;
                        }
                        if (w.rotationPeriod) html += `<span>Day: <strong>${w.rotationPeriod}</strong></span>`;
                        if (w.axialTilt !== undefined) html += `<span>Tilt: <strong>${w.axialTilt}°</strong></span>`;

                        html += `</div>`;

                        // Satellites
                        if (w.satellites && w.satellites.length > 0) {
                            // Sort satellites by distance (pd) before rendering
                            const sortedSats = [...w.satellites].sort((a, b) => (a.pd || 0) - (b.pd || 0));

                            sortedSats.forEach((sat, satIdx) => {
                                let satType = sat.type === 'Mainworld' ? 'Mainworld' : (sat.size === 'R' ? 'Ring' : (sat.size === 'S' ? 'Small Moon' : 'Moon'));
                                let satUwp = (sat.type === 'Mainworld' && mwBase) ? mwBase.uwp : (sat.uwpSecondary || '-');
                                let satLabelColor = sat.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                                let satSummaryStyle = sat.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                                let satZoneLabel = '';
                                if (sat.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                                    const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                                    satZoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                                }

                                html += `<details>`;
                                html += `<summary ${satSummaryStyle}>Satellite ${satIdx + 1} <span class="sys-title-info">${satType} | ${sat.pd || '?'}r | ${satUwp}${satZoneLabel}</span></summary>`;
                                html += `<div class="system-node">`;
                                html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: ${satLabelColor}">${satUwp}</strong></div>`;
                                html += `<div class="system-stats">`;

                                if (sat.distAU) html += `<span>Distance: <strong>${sat.distAU.toFixed(2)} AU</strong></span>`;
                                if (sat.gravity !== undefined) html += `<span>Gravity: <strong>${sat.gravity.toFixed(2)} G</strong></span>`;
                                if (sat.mass !== undefined) html += `<span>Mass: <strong>${sat.mass.toFixed(6)} M⊕</strong></span>`;
                                if (sat.temperature) html += `<span>Temp: <strong>${sat.temperature}K / ${(sat.temperature - 273).toFixed(0)}°C</strong></span>`;
                                if (sat.rotationPeriod) html += `<span>Day: <strong>${sat.rotationPeriod}</strong></span>`;
                                if (sat.axialTilt !== undefined) html += `<span>Tilt: <strong>${sat.axialTilt}°</strong></span>`;

                                html += `</div></div></details>`;
                            });
                        }

                        html += `</div></details>`;
                    });
                }

                html += `</div></details>`;
            });

            html += `</div>`;

            root.innerHTML = html;
            root.style.display = 'none';
        }
    }

    // T5 Star System Tree
    if (stateObj.t5System) {
        document.getElementById('acc-btn-t5-system').style.display = 'flex';
        const root = document.getElementById('editor-t5-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.t5System;
            let mwBase = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;

            // 1. Stellar Header
            let html = `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">T5: ${mwBase.name} Profile</div>`;
            sys.stars.forEach(star => {
                html += `<span>${star.role}: <strong>${star.name}</strong> (Lum: ${star.luminosity ? star.luminosity.toFixed(3) : '?'}, Mass: ${star.mass ? star.mass.toFixed(2) : '?'})</span>`;
            });

            if (mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                const zoneColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                html += `<span style="color: ${zoneColor}; text-align: center;">Travel Zone: <strong>${mwBase.travelZone}</strong></span>`;
            }
            html += `</div>`;

            // 2. System Tree Structure
            html += `<div class="system-tree">`;

            sys.orbits.forEach(o => {
                let w = o.contents;
                if (!w || w.type === 'Empty') {
                    html += `<div style="color: #666; font-size: 0.9em; padding: 2px 0; border-bottom: 1px solid #333;">Orbit ${o.orbit}: Empty</div>`;
                    return;
                }

                let uwp = w.type === 'Mainworld' ? mwBase.uwp : (w.uwpSecondary || '-');
                let typeLabel = w.type;
                if (w.type === 'Gas Giant') typeLabel = `${w.size === 15 ? 'Large' : 'Small'} Gas Giant`;
                let labelColor = w.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                let summaryStyle = w.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                let zoneLabel = '';
                if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                    const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                    zoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                }

                html += `<details open>`;
                html += `<summary ${summaryStyle}>Orbit ${o.orbit} [${w.climateZone || 'Cold'}] <span class="sys-title-info">${typeLabel}${zoneLabel}</span></summary>`;
                html += `<div class="system-node">`;

                if (w.type !== 'Planetoid Belt') {
                    html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: ${labelColor}">${uwp}</strong></div>`;
                }

                if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                    const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                    const specialCodes = mwBase.tradeCodes.filter(c => ['Fo', 'Da', 'Pz'].includes(c));
                    const codeStr = specialCodes.length > 0 ? ` - [${specialCodes.join('/')}]` : '';
                    html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor}; margin-bottom: 8px;">Caution: ${mwBase.travelZone} Zone${codeStr}</div>`;
                }

                if (w.type === 'Mainworld') {
                    html += `<div class="system-stats">`;
                    html += `<span>Referee Override:</span>`;
                    html += `<select class="travel-zone-select" style="grid-column: span 2;" onchange="handleT5ZoneChange(this)">
                        <option value="Green" ${mwBase.travelZone === 'Green' ? 'selected' : ''}>Green</option>
                        <option value="Amber" ${mwBase.travelZone === 'Amber' ? 'selected' : ''}>Amber</option>
                        <option value="Red" ${mwBase.travelZone === 'Red' ? 'selected' : ''}>Red</option>
                    </select>`;
                    html += `</div>`;
                }

                html += `<div class="system-stats">`;
                html += `<span>Distance: <strong>${o.distAU.toFixed(2)} AU</strong></span>`;

                if (w.type !== 'Planetoid Belt') {
                    if (w.diamKm) html += `<span>Diameter: <strong>${w.diamKm.toLocaleString()} km</strong></span>`;
                    if (w.density) html += `<span>Density: <strong>${w.density.toFixed(1)}</strong></span>`;
                    if (w.gravity !== undefined) html += `<span>Gravity: <strong>${w.gravity.toFixed(2)} G</strong></span>`;
                    if (w.mass !== undefined) html += `<span>Mass: <strong>${w.mass.toFixed(4)} M⊕</strong></span>`;
                    if (w.temperature) html += `<span>Temp: <strong>${w.temperature}K / ${(w.temperature - 273).toFixed(0)}°C</strong></span>`;
                    if (w.rotationPeriod) html += `<span>Day: <strong>${w.rotationPeriod}</strong></span>`;
                    if (w.orbitalPeriod) {
                        let yStr = w.orbitalPeriod < 1.0
                            ? `${(w.orbitalPeriod * 365.25).toFixed(1)}d`
                            : `${w.orbitalPeriod.toFixed(2)}y`;
                        html += `<span>Year: <strong>${yStr}</strong></span>`;
                    }
                }
                html += `</div>`;

                // Satellites
                if (w.satellites && w.satellites.length > 0) {
                    w.satellites.forEach((sat, satIdx) => {
                        html += `<details style="margin-left: 20px;">`;
                        html += `<summary>Moon ${satIdx + 1} <span class="sys-title-info">Size ${sat.size}</span></summary>`;
                        html += `<div class="system-node">`;

                        if (sat.uwpSecondary) {
                            html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: #66fcf1">${sat.uwpSecondary}</strong></div>`;
                        }

                        html += `<div class="system-stats">`;
                        html += `<span>Diameter: <strong>${sat.diamKm.toLocaleString()} km</strong></span>`;
                        html += `<span>Gravity: <strong>${sat.gravity.toFixed(2)} G</strong></span>`;
                        html += `<span>Mass: <strong>${sat.mass.toFixed(6)} M⊕</strong></span>`;
                        html += `<span>Temp: <strong>${sat.temperature}K</strong></span>`;
                        html += `<span>Day: <strong>${sat.rotationPeriod}</strong></span>`;
                        html += `</div></div></details>`;
                    });
                }

                html += `</div></details>`;
            });

            html += `</div>`;
            root.innerHTML = html;
            root.style.display = 'none';
        }
    }
}
// Global handler for T5 Travel Zone manual overrides
window.handleT5ZoneChange = function (el) {
    if (!editingHexId) return;
    const stateObj = hexStates.get(editingHexId);
    if (!stateObj || !stateObj.t5Data) return;

    const newZone = el.value;
    stateObj.t5Data.travelZone = newZone;

    // Sync T5 Trade Classifications (Fo, Da, Pz)
    let codes = stateObj.t5Data.tradeCodes || [];
    // Remove existing zone-related codes
    codes = codes.filter(c => !['Fo', 'Da', 'Pz'].includes(c));

    if (newZone === 'Red') {
        if (!codes.includes('Fo')) codes.push('Fo');
    } else if (newZone === 'Amber') {
        const pop = stateObj.t5Data.pop;
        if (pop <= 6) {
            if (!codes.includes('Da')) codes.push('Da');
        } else {
            if (!codes.includes('Pz')) codes.push('Pz');
        }
    }
    stateObj.t5Data.tradeCodes = codes;

    // Update the main hex editor dropdown to match
    const mainSelect = document.getElementById('edit-travel-zone');
    if (mainSelect) mainSelect.value = newZone;

    // Update the trade codes text field to reflect sync
    const tcInput = document.getElementById('edit-trade-codes');
    if (tcInput) tcInput.value = codes.join(' ');

    // Refresh the system expansion tray UI
    populateEditorAccordions(stateObj);

    // Redraw the map to show the new travel zone halo
    requestAnimationFrame(draw);
};


function closeHexEditor() {
    editingHexId = null;

    // Hide and reset all accordions
    document.getElementById('editor-socio-t5-container').style.display = 'none';
    document.getElementById('acc-btn-t5-socio').style.display = 'none';
    document.getElementById('acc-btn-t5-socio').classList.remove('active');

    document.getElementById('editor-socio-mgt-container').style.display = 'none';
    document.getElementById('acc-btn-mgt-socio').style.display = 'none';
    document.getElementById('acc-btn-mgt-socio').classList.remove('active');

    document.getElementById('editor-physical-container').style.display = 'none';
    document.getElementById('acc-btn-physical').style.display = 'none';
    document.getElementById('acc-btn-physical').classList.remove('active');

    document.getElementById('editor-mgt-system-root').style.display = 'none';
    document.getElementById('editor-mgt-system-root').innerHTML = '';
    document.getElementById('acc-btn-mgt-system').style.display = 'none';
    document.getElementById('acc-btn-mgt-system').classList.remove('active');

    document.getElementById('editor-ct-system-root').style.display = 'none';
    document.getElementById('editor-ct-system-root').innerHTML = '';
    document.getElementById('acc-btn-ct-system').style.display = 'none';
    document.getElementById('acc-btn-ct-system').classList.remove('active');

    document.getElementById('editor-t5-system-root').style.display = 'none';
    document.getElementById('editor-t5-system-root').innerHTML = '';
    document.getElementById('acc-btn-t5-system').style.display = 'none';
    document.getElementById('acc-btn-t5-system').classList.remove('active');

    // Reset position
    const hexEditor = document.getElementById('hex-editor');
    hexEditor.style.left = 'calc(50% - 220px)';
    hexEditor.style.top = '100px';
    hexEditor.style.width = '440px';
    hexEditor.style.height = 'auto';
    hexEditor.style.display = 'none';
}

function setupHexEditor() {
    document.getElementById('btn-editor-cancel').addEventListener('click', closeHexEditor);
    document.getElementById('btn-editor-save').addEventListener('click', saveHexEditorChanges);
}

function saveHexEditorChanges() {
    if (!editingHexId) return;

    const stateObj = hexStates.get(editingHexId);
    if (!stateObj || stateObj.type !== 'SYSTEM_PRESENT') return;

    // Read all editor fields and update the state object
    const name = document.getElementById('edit-name').value.trim();
    const starport = document.getElementById('edit-starport').value.toUpperCase();
    const size = parseInt(document.getElementById('edit-size').value, 10) || 0;
    const atm = parseInt(document.getElementById('edit-atm').value, 10) || 0;
    const hydro = parseInt(document.getElementById('edit-hydro').value, 10) || 0;
    const pop = parseInt(document.getElementById('edit-pop').value, 10) || 0;
    const gov = parseInt(document.getElementById('edit-gov').value, 10) || 0;
    const law = parseInt(document.getElementById('edit-law').value, 10) || 0;
    const tl = parseInt(document.getElementById('edit-tl').value, 10) || 0;

    const navalBase = document.getElementById('edit-naval').checked;
    const scoutBase = document.getElementById('edit-scout').checked;
    const militaryBase = document.getElementById('edit-military').checked;
    const corsairBase = document.getElementById('edit-corsair').checked;
    const gasGiant = document.getElementById('edit-gas').checked;

    const tcString = document.getElementById('edit-trade-codes').value;
    const tradeCodes = tcString.split(/\s+/).filter(tc => tc.length > 0);

    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;

    // Update the appropriate data object and explicitly save the name
    if (stateObj.t5Data) {
        stateObj.t5Data.name = name;
        const travelZone = document.getElementById('edit-travel-zone').value;
        stateObj.t5Data = { ...stateObj.t5Data, uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, navalBase, scoutBase, militaryBase, corsairBase, gasGiant };
        stateObj.mgt2eData = null;
        stateObj.ctData = null;
    } else if (stateObj.mgt2eData) {
        stateObj.mgt2eData.name = name;
        const travelZone = document.getElementById('edit-travel-zone').value;
        stateObj.mgt2eData = { ...stateObj.mgt2eData, uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, navalBase, scoutBase, militaryBase, corsairBase, gasGiant };
        stateObj.t5Data = null;
        stateObj.ctData = null;
    } else if (stateObj.ctData) {
        stateObj.ctData.name = name;
        const travelZone = document.getElementById('edit-travel-zone').value;
        stateObj.ctData = { ...stateObj.ctData, uwp, travelZone, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, navalBase, scoutBase, gasGiant };
        stateObj.t5Data = null;
        stateObj.mgt2eData = null;
    }

    // Also save name at the stateObj level for consistency
    stateObj.name = name;

    // Update socio and physical data if present (abbreviated for file size)
    // Full implementation would read and save all accordion data

    hexStates.set(editingHexId, stateObj);
    requestAnimationFrame(draw);
    closeHexEditor();
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
    // We follow the user's example: Sector A at 0,0, Sector B at 0,1 etc.
    // This assumes a grid 4 sectors high (A-D, E-H, etc.)
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
            // Ensure T5 Socio exists for export (run on-the-fly if missing)
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
            const sys = state.t5System || state.mgtSystem || state.ctSystem;
            if (sys && sys.stars) {
                stars = sys.stars.map(s => s.name).join(' ');
            }

            // World Count (W)
            let w = 1;
            if (state.t5System && state.t5System.totalWorlds) w = state.t5System.totalWorlds;
            else if (state.mgtSystem && state.mgtSystem.worlds) w = state.mgtSystem.worlds.length;
            else if (state.ctSystem && state.ctSystem.orbits) {
                // Count occupied orbits including mainworld
                w = state.ctSystem.orbits.filter(o => o.contents).length;
                if (state.ctSystem.capturedPlanets) w += state.ctSystem.capturedPlanets.length;
            }

            const row = [
                hexNum,
                data.name || "Unnamed",
                data.uwp || "???????-?",
                bases || "-",
                (data.tradeCodes || []).join(' ') || "-",
                data.zone || "-",
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

    console.log("Importer Header Map:", {
        Hex: idxHex, UWP: idxUWP, Sector: idxSector, SS: idxSS, Name: idxName,
        PBG: idxPBG, Stars: idxStars, Ix: idxIx, Ex: idxEx, Cx: idxCx
    });

    if (idxHex === -1 || idxUWP === -1) {
        alert("Invalid file format. 'Hex' and 'UWP' columns (tab-separated) are required.");
        return;
    }

    let importCount = 0;
    let fallbackSectorSlot = "A"; // Default to Sector Slot A (e.g., A-A-0101)

    // Check if filename suggests a slot (Sector_B.tab)
    const nameMatch = fileName.match(/Sector_([A-Z]{1,2})/i);
    if (nameMatch) {
        fallbackSectorSlot = nameMatch[1].toUpperCase();
    } else {
        const userSlot = prompt(`Which Sector Slot (A to AF) should we import "${fileName}" into?`, "A");
        if (userSlot) fallbackSectorSlot = userSlot.toUpperCase();
    }

    console.log(`Starting import into Sector Slot: ${fallbackSectorSlot}`);

    const importedHexes = new Set();
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split('\t');
        if (row.length < header.length) continue;

        const hexNum = row[idxHex]?.trim();
        const uwp = row[idxUWP]?.trim();

        // Validation
        if (!hexNum || !uwp || hexNum.length !== 4 || uwp.length < 7) {
            if (i < 5 && hexNum) console.warn(`Skipping invalid row ${i}: Hex=${hexNum}, UWP=${uwp}`);
            continue;
        }

        const name = idxName !== -1 ? row[idxName].trim() : "Unnamed";

        // Sector & SS Mapping
        // We force the Sector part to be the coordinate slot ID (A, B, C...)
        const sectorID = fallbackSectorSlot;
        let subChar = idxSS !== -1 ? row[idxSS].trim() : "";

        // Reconstruct Subsector (A-P) from local Hex coordinate (0101-3240) if missing
        if (!subChar || subChar.length > 1) {
            const hexVal = parseInt(hexNum, 10);
            const lQ = Math.floor(hexVal / 100);
            const lR = hexVal % 100;
            const subX = Math.floor((lQ - 1) / 8);
            const subY = Math.floor((lR - 1) / 10);
            subChar = String.fromCharCode(65 + (subY * 4 + subX));
        }

        // Final HexID used by the Map's draw() function: [Slot]-[Sub]-[Hex]
        const hexId = `${sectorID}-${subChar}-${hexNum}`;

        // Basic UWP Parsing
        const starport = uwp[0] || 'C';
        const size = fromUWPChar(uwp[1]);
        const atm = fromUWPChar(uwp[2]);
        const hydro = fromUWPChar(uwp[3]);
        const pop = fromUWPChar(uwp[4]);
        const gov = fromUWPChar(uwp[5]);
        const law = fromUWPChar(uwp[6]);
        const tl = fromUWPChar(uwp.split('-')[1]?.[0] || '7');

        // PBG
        const pbgStr = idxPBG !== -1 ? row[idxPBG].trim() : "000";
        const popMultiplier = fromUWPChar(pbgStr[0]);
        const belts = fromUWPChar(pbgStr[1]);

        // Small fix for fromUWPChar safety
        function pbgChar(c) { return c !== undefined && c !== null; }
        const gG = pbgChar(pbgStr[2]) ? fromUWPChar(pbgStr[2]) : 0;

        // Extensions
        const ixRaw = idxIx !== -1 ? row[idxIx].replace(/[{}]/g, '') : "0";
        const exRaw = idxEx !== -1 ? row[idxEx].replace(/[()]/g, '') : "000+0";
        const cxRaw = idxCx !== -1 ? row[idxCx].replace(/[\[\]]/g, '') : "0000";

        // Deconstruct Extensions
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
            const starNames = row[idxStars].split(/\s+/);
            t5System.stars = starNames.map(sn => ({ name: sn, role: 'Star' }));
            t5System.orbits = [];
        }

        const stateObj = {
            type: 'SYSTEM_PRESENT',
            t5Data,
            t5Socio,
            t5System
        };

        if (importCount < 3) {
            console.log(`Parsed Sample #${importCount + 1} -> ${hexId}:`, stateObj);
        }

        hexStates.set(hexId, stateObj);
        importedHexes.add(hexNum);
        importCount++;
    }

    // Fill the voids for the imported sector slot (32x40 grid)
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

    console.log(`Import Complete. Total Worlds: ${importCount}. Filled voids: ${emptyCount}.`);
    showToast(`Successfully imported ${importCount} worlds into Sector Slot ${fallbackSectorSlot}`);
    if (emptyCount > 0) showToast(`Initialized ${emptyCount} empty space hexes in sector bounds.`, 2000);

    // Force immediate redraw
    if (typeof draw === 'function') {
        requestAnimationFrame(draw);
    }
}

function setupSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const launchBtn = document.getElementById('btn-launch-app');

    if (splash && launchBtn) {
        launchBtn.addEventListener('click', () => {
            splash.classList.add('hidden');
            // Give a small toast welcome
            setTimeout(() => {
                showToast("Welcome to As Above So Below", 3000);
            }, 800);
        });
    }
}

window.addEventListener('load', () => {
    initializeInput();
    if (typeof resize === 'function') {
        resize();
    }
});
