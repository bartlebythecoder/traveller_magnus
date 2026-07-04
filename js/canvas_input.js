// ============================================================================
// CANVAS_INPUT.JS - Canvas Events & Selection Helpers
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

    // 2. Right-Click: Open Context Menu  (Ctrl+Right-Click: open Hex Editor directly)
    mapCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Stop default browser menu

        const world = getMouseWorldCoords(e);
        const coords = pixelToHex(world.x, world.y, baseHexSize);
        const hexId = getHexId(coords.q, coords.r);

        if (e.ctrlKey) {
            if (hexId && hexStates.get(hexId)) openHexEditor(hexId, e);
            return;
        }

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
        
        // DEV VIEW Toggle for advanced socio expansion
        const socioDev = document.getElementById('ctx-expand-socio-mgt2e-dev');
        if (socioDev) socioDev.style.display = (window.devView === true) ? 'block' : 'none';

        // Import / Export System submenu — only when exactly 1 hex is selected;
        // Export child additionally requires a system to be present in the hex.
        {
            const importExportMenu = document.getElementById('ctx-import-export-system');
            if (importExportMenu) {
                if (selectedHexes.size === 1) {
                    importExportMenu.style.display = 'block';
                    const _ieHexId = [...selectedHexes][0];
                    const _ieState = hexStates.get(_ieHexId);
                    const _hasSystem = !!(_ieState && _ieState.type === 'SYSTEM_PRESENT');
                    const exportBtn = document.getElementById('ctx-export-asab-system');
                    if (exportBtn) exportBtn.style.display = _hasSystem ? 'block' : 'none';
                } else {
                    importExportMenu.style.display = 'none';
                }
            }
        }

        // System Editor — create for empty hex, edit for populated hex
        {
            const createBtn = document.getElementById('ctx-create-system');
            const editBtn   = document.getElementById('ctx-edit-system');
            if (selectedHexes.size === 1) {
                const _seHexId = [...selectedHexes][0];
                const _seState = hexStates.get(_seHexId);
                const _seHasSystem    = !!(_seState && (_seState.ctData || _seState.ctSystem ||
                    _seState.mgt2eData || _seState.mgtSystem ||
                    _seState.t5Data || _seState.t5System ||
                    _seState.aowSystem || _seState.rttData));
                const _seCanEdit = !!(_seState && (_seState.mgt2eData || _seState.mgtSystem ||
                    _seState.ctData || _seState.ctSystem ||
                    _seState.t5Data || _seState.t5System ||
                    _seState.rttData || _seState.rttSystem));
                if (createBtn) createBtn.style.display = _seHasSystem ? 'none' : 'block';
                if (editBtn)   editBtn.style.display   = _seCanEdit ? 'block' : 'none';
            } else {
                if (createBtn) createBtn.style.display = 'none';
                if (editBtn)   editBtn.style.display   = 'none';
            }
        }

        // Show first to measure dimensions
        contextMenu.classList.add('visible');

        let x = e.clientX;
        let y = e.clientY;
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;

        // Boundary checks
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10; // 10px buffer
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        // Safety floor
        x = Math.max(10, x);
        y = Math.max(10, y);

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        // Check if submenus will go off-screen to the right
        const submenuWidth = 180; // Estimated from CSS
        if (x + menuWidth + submenuWidth > window.innerWidth) {
            contextMenu.classList.add('reverse-submenus');
        } else {
            contextMenu.classList.remove('reverse-submenus');
        }

        // Check if each submenu will go off-screen downward; flip up if needed
        contextMenu.querySelectorAll('.has-submenu').forEach(item => {
            item.classList.remove('flip-up');
            item.addEventListener('mouseenter', function onEnter() {
                const submenu = this.querySelector('.submenu');
                if (!submenu) return;
                const rect = submenu.getBoundingClientRect();
                if (rect.bottom > window.innerHeight) {
                    this.classList.add('flip-up');
                } else {
                    this.classList.remove('flip-up');
                }
            }, { once: true });
        });
    });

    // 3. Mouse Down: Start Pan, Paint, or Hex Editor
    mapCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // ONLY process Left-Click here

        const world = getMouseWorldCoords(e);
        const coords = pixelToHex(world.x, world.y, baseHexSize);
        const hexId = getHexId(coords.q, coords.r);

        if (e.ctrlKey) {
            // Ctrl+Left-Click: Open Hex Editor
            if (hexId) openHexEditor(hexId, e);
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
        } else {
            // Check if any held key is a route shortcut
            const defs = window.routeDefinitions || [];
            let activeDef = null;
            for (const key of keysDown) {
                const match = defs.find(d => d.shortcut && d.shortcut === key);
                if (match) { activeDef = match; break; }
            }

            if (activeDef && hexId) {
                // Route shortcut + Left-Click: Start Manual Route Creation
                saveHistoryState('Manual Route');
                isAltDragging = true;
                altDragStartId = hexId;
                altDragRouteId = activeDef.id;
                const typeMap = { 1: 'Xboat', 2: 'Trade', 3: 'Secondary' };
                altDragType = typeMap[activeDef.id] || 'Filter';
                console.log(`Routing Mode Active: Route #${activeDef.id} (${activeDef.name})`);
                requestAnimationFrame(draw);
            } else {
                // Plain Left-Click: ONLY Panning (No selection logic whatsoever)
                isDragging = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                mapCanvas.classList.add('dragging');
            }
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
        if (isAltDragging && altDragStartId && altDragRouteId != null) {
            const world = getMouseWorldCoords(e);
            const coords = pixelToHex(world.x, world.y, baseHexSize);
            const endHexId = getHexId(coords.q, coords.r);

            if (endHexId && endHexId !== altDragStartId) {
                const sorted = [altDragStartId, endHexId].sort();
                if (!window.sectorRoutes) window.sectorRoutes = [];

                // Toggle: remove if the same routeId already exists on this segment
                const existingIndex = window.sectorRoutes.findIndex(r =>
                    r.startId === sorted[0] && r.endId === sorted[1] && r.routeId === altDragRouteId
                );

                if (existingIndex !== -1) {
                    window.sectorRoutes.splice(existingIndex, 1);
                    console.log(`Route #${altDragRouteId} Removed: ${sorted[0]} to ${sorted[1]}`);
                    showToast(`Route removed: ${sorted[0]} → ${sorted[1]}`, 2000);
                } else {
                    const def = (window.routeDefinitions || []).find(d => d.id === altDragRouteId);
                    const label = def ? def.name : `Route #${altDragRouteId}`;
                    const typeMap = { 1: 'Xboat', 2: 'Trade', 3: 'Secondary' };
                    const type = typeMap[altDragRouteId] || 'Filter';
                    const routeObj = { startId: sorted[0], endId: sorted[1], type, routeId: altDragRouteId };
                    if (type === 'Filter' && def) routeObj.color = def.color;
                    window.sectorRoutes.push(routeObj);
                    console.log(`${label} Added: ${sorted[0]} to ${sorted[1]}`);
                    showToast(`${label}: ${sorted[0]} → ${sorted[1]}`, 2000);
                }
                if (window.dbManager) window.dbManager.saveRoutes();
                if (window.refreshRouteWindowCounts) window.refreshRouteWindowCounts();
            }
        }

        isDragging = false;
        isPainting = false;
        isAltDragging = false;
        altDragStartId = null;
        altDragRouteId = null;
        lastPaintedHexId = null;
        mapCanvas.classList.remove('dragging');
        requestAnimationFrame(draw);
    });

    // 6. Mouse Wheel: Zoom
    mapCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const direction  = e.deltaY > 0 ? -1 : 1;

        // Route to system viewer when open
        if (window.SystemViewer && window.SystemViewer.isOpen()) {
            window.SystemViewer.handleWheel(direction);
            return;
        }

        // Trigger system viewer on scroll-in at max zoom
        if (direction > 0 && zoom >= 10 && window.SystemViewer) {
            window.SystemViewer.open();
            return;
        }

        const mouseWorldX = cameraX + e.clientX / zoom;
        const mouseWorldY = cameraY + e.clientY / zoom;

        if (direction > 0) zoom *= zoomFactor;
        else zoom /= zoomFactor;

        zoom = Math.max(0.03, Math.min(zoom, 10));
        cameraX = mouseWorldX - e.clientX / zoom;
        cameraY = mouseWorldY - e.clientY / zoom;
        requestAnimationFrame(draw);
    }, { passive: false });
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
    for (let q = 0; q <= 223; q++) {
        for (let r = 0; r <= 199; r++) {
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
    for (let q = 0; q <= 223; q++) {
        for (let r = 0; r <= 199; r++) {
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
