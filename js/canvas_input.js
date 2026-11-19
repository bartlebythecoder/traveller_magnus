// ============================================================================
// CANVAS_INPUT.JS - Canvas Events & Selection Helpers
// ============================================================================

function setupCanvasEvents() {
    // Grab a private reference to the canvas that won't conflict with renderer.js
    const mapCanvas = document.getElementById('map-canvas');

    // Map-pick tracking (Route Manager — see MapPick in ui_menus.js). A pick is
    // delivered on mouseup, and only when the pointer barely moved, so
    // drag-to-pan still works while one is armed: the user has to be able to
    // reach the hex they mean to click.
    let pickDownX = 0, pickDownY = 0, pickDownArmed = false;
    const PICK_SLOP_PX = 4;

    // Alt + drag on a border or region name moves it (v0.18.3, Sean 2026-11-14).
    // { hit, grabDx, grabDy, downX, downY, moved } while a name is held.
    let labelDrag = null;
    let contextLabelHit = null;   // the placed name a right-click landed on

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
            document.getElementById('ctx-name-subsector').style.display = 'block';
        } else {
            // Hide selection options if clicking empty space
            contextHexId = null;
            document.getElementById('ctx-select-hex').style.display = 'none';
            document.getElementById('ctx-select-sector').style.display = 'none';
            document.getElementById('ctx-select-subsector').style.display = 'none';
            document.getElementById('ctx-name-subsector').style.display = 'none';
        }

        const contextMenu = document.getElementById('context-menu');

        // RESET NAME POSITION — only on a border/region name that was moved.
        {
            const hit = hitTestMapLabel(world);
            contextLabelHit = (hit && hit.def.labelPos) ? hit : null;
            const resetBtn = document.getElementById('ctx-reset-label');
            if (resetBtn) resetBtn.style.display = contextLabelHit ? 'block' : 'none';
        }

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
            // World Details (the Ctrl+click panel), offered beside Edit System
            // for the same single selected hex.
            const detailsBtn = document.getElementById('ctx-world-details');
            if (detailsBtn) detailsBtn.style.display = (selectedHexes.size === 1 &&
                canOpenHexEditor(hexStates.get([...selectedHexes][0]))) ? 'block' : 'none';
            // v0.19.0 published systems: one hex = choose any snapshot system for it; several =
            // load the ones that match (add_otu_system_info.js wires the click).
            const publishedBtn = document.getElementById('ctx-load-published');
            if (publishedBtn) {
                const canLoad = selectedHexes.size > 0 && !!window.OTU_SNAPSHOT && !!window.PublishedSystems;
                publishedBtn.style.display = canLoad ? 'block' : 'none';
                publishedBtn.textContent = selectedHexes.size > 1 ? 'LOAD WIKI-PUBLISHED SYSTEMS' : 'LOAD WIKI-PUBLISHED SYSTEM…';
            }
            if (selectedHexes.size === 1) {
                const _seHexId = [...selectedHexes][0];
                const _seState = hexStates.get(_seHexId);
                const _seHasSystem    = !!(_seState && (_seState.ctData || _seState.ctSystem ||
                    _seState.mgt2eData || _seState.mgtSystem ||
                    _seState.t5Data || _seState.t5System ||
                    _seState.aowSystem || _seState.rttData));
                // RTT/AoW System Editor support is still preliminary and slated for an overhaul —
                // T5 was closed out 2026-07-16 (OW-19/42/43/44/45/46/47) and is now exposed too,
                // matching the orrery's "Edit System" button gating in system_viewer.js.
                const _seCanEdit = !!(_seState && (_seState.mgt2eData || _seState.mgtSystem ||
                    _seState.ctData || _seState.ctSystem || _seState.t5Data || _seState.t5System));
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

        // Clear any inline offsets left by a previous opening, so each submenu
        // is measured at its natural position next time it is hovered.
        contextMenu.querySelectorAll('.submenu').forEach(sm => { sm.style.top = ''; });
        contextMenu.querySelectorAll('.has-submenu').forEach(it => it.classList.remove('flip-up'));
    });

    // Keep every submenu fully on screen.
    //
    // This replaces a `flip-up` class that swapped `top: 0` for `bottom: 0`.
    // Flipping only moves the overflow: a submenu opened near the bottom of the
    // window then ran off the TOP instead, hiding its LAST entries — which is
    // how ASSIGN (the longest submenu) could lose "Assign Player Disclosure".
    // Clamping fits the submenu into the viewport instead, so no entry is ever
    // unreachable; if it is genuinely taller than the window, the CSS
    // max-height lets it scroll.
    //
    // Delegated and attached ONCE at setup. The previous version added a
    // `{ once: true }` mouseenter listener per item on every right-click, which
    // (a) never re-evaluated if you hovered the same item twice, and
    // (b) accumulated listeners each time the menu opened without being hovered.
    function _positionSubmenu(item) {
        const submenu = item.querySelector(':scope > .submenu');
        if (!submenu) return;

        submenu.style.top = '';                       // measure unshifted
        const itemRect = item.getBoundingClientRect();
        const height   = submenu.offsetHeight;
        const MARGIN   = 8;

        // Where the submenu would like to sit, in viewport coordinates, and the
        // range it may actually occupy.
        const lowest  = window.innerHeight - height - MARGIN;
        const clamped = Math.max(MARGIN, Math.min(itemRect.top, lowest));

        // `.submenu` is absolutely positioned within the item, so convert the
        // chosen viewport position back into an offset from the item's top.
        submenu.style.top = `${Math.round(clamped - itemRect.top)}px`;
    }

    // `contextMenu` above is scoped to the contextmenu handler, so resolve the
    // element again here rather than reaching into it.
    const ctxMenuEl = document.getElementById('context-menu');
    if (ctxMenuEl) {
        ctxMenuEl.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.context-menu-item.has-submenu');
            if (item && ctxMenuEl.contains(item)) _positionSubmenu(item);
        });
    }

    // Right-click > RESET NAME POSITION: back to automatic placement (undoable).
    const ctxResetLabel = document.getElementById('ctx-reset-label');
    if (ctxResetLabel) {
        ctxResetLabel.addEventListener('click', () => {
            ctxMenuEl.classList.remove('visible');
            const hit = contextLabelHit;
            contextLabelHit = null;
            if (!hit || !hit.def.labelPos) return;
            saveHistoryState(`Reset ${hit.def.name} name position`, { includeLabelPositions: true });
            delete hit.def.labelPos;
            saveMapLabelDefinitions(hit.kind);
            requestAnimationFrame(draw);
        });
    }

    // Right-click > WORLD DETAILS: the same panel as Ctrl+click, for the one
    // selected hex (the hex Edit System would open).
    const ctxDetailsBtn = document.getElementById('ctx-world-details');
    if (ctxDetailsBtn) {
        ctxDetailsBtn.addEventListener('click', (e) => {
            ctxMenuEl.classList.remove('visible');
            if (selectedHexes.size === 1) openHexEditor([...selectedHexes][0], e);
        });
    }

    // 3. Mouse Down: Start Pan, Paint, or Hex Editor
    mapCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // ONLY process Left-Click here

        pickDownArmed = false;      // re-armed below only on a plain left-click

        const world = getMouseWorldCoords(e);
        const coords = pixelToHex(world.x, world.y, baseHexSize);
        const hexId = getHexId(coords.q, coords.r);

        // Alt + drag on a border/region name: pick it up. Anywhere else, Alt
        // changes nothing and the click carries on as before.
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            const hit = hitTestMapLabel(world);
            if (hit) {
                e.preventDefault();
                labelDrag = { hit, grabDx: world.x - hit.cx, grabDy: world.y - hit.cy,
                              downX: e.clientX, downY: e.clientY, moved: false };
                mapCanvas.style.cursor = 'grabbing';
                return;
            }
        }

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
                // — or, when a Route Manager pick is armed, a candidate pick.
                pickDownArmed = !!(window.MapPick && window.MapPick.isArmed());
                pickDownX = e.clientX;
                pickDownY = e.clientY;
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

        if (labelDrag) {
            if (!labelDrag.moved) {
                if (Math.hypot(e.clientX - labelDrag.downX, e.clientY - labelDrag.downY) <= PICK_SLOP_PX) return;
                labelDrag.moved = true;
                // One undo entry per move, taken before the first change.
                saveHistoryState(`Move ${labelDrag.hit.def.name} name`, { includeLabelPositions: true });
            }
            const w = getMouseWorldCoords(e);
            const cx = w.x - labelDrag.grabDx;
            const cy = w.y - labelDrag.grabDy;
            const c = pixelToHex(cx, cy, baseHexSize);
            const anchor = getHexId(c.q, c.r);
            if (anchor) {   // off the map: the name stays at its last spot on it
                const p = getHexPixel(c.q, c.r);
                labelDrag.hit.def.labelPos = { hex: anchor, dx: cx - p.x, dy: cy - p.y };
                requestAnimationFrame(draw);
            }
            return;
        }

        // Alt over a name shows it can be moved.
        if (!isDragging && !isPainting && !isAltDragging && e.target === mapCanvas) {
            const over = e.altKey && hitTestMapLabel(getMouseWorldCoords(e));
            const want = over ? 'move' : '';
            if (mapCanvas.style.cursor !== want) mapCanvas.style.cursor = want;
        }

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
        if (labelDrag) {
            const { hit, moved } = labelDrag;
            labelDrag = null;
            mapCanvas.style.cursor = '';
            if (moved) saveMapLabelDefinitions(hit.kind);
            requestAnimationFrame(draw);
            return;
        }

        // Deliver an armed Route Manager pick — a click, not a drag.
        if (pickDownArmed && window.MapPick && window.MapPick.isArmed() && !e.ctrlKey && !e.shiftKey) {
            const moved = Math.hypot(e.clientX - pickDownX, e.clientY - pickDownY);
            if (moved <= PICK_SLOP_PX) {
                const pw = getMouseWorldCoords(e);
                const pc = pixelToHex(pw.x, pw.y, baseHexSize);
                const pickedId = getHexId(pc.q, pc.r);
                if (pickedId) window.MapPick.deliver(pickedId);
            }
        }
        pickDownArmed = false;

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
// PLACEABLE NAMES (v0.18.3)
// ============================================================================

// The border/region name under a world point, topmost first, from the boxes
// the last draw() recorded (renderer.js). Names too small to draw are not there.
function hitTestMapLabel(world) {
    const hits = (typeof window.getMapLabelHits === 'function') ? window.getMapLabelHits() : [];
    for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i];
        if (world.x >= h.x && world.x <= h.x + h.w && world.y >= h.y && world.y <= h.y + h.h) return h;
    }
    return null;
}

function saveMapLabelDefinitions(kind) {
    if (!window.dbManager) return;
    if (kind === 'region') window.dbManager.saveRegionDefinitions?.();
    else window.dbManager.saveBorderDefinitions?.();
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
