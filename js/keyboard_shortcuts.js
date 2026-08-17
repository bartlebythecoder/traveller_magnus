// ============================================================================
// KEYBOARD_SHORTCUTS.JS - Hotkeys and Key Event Listeners
// ============================================================================

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', async (e) => {
        // Skip shortcuts if the user is typing in an input field or textarea, except for Escape
        const _t = e.target;
        const _inField = _t.tagName === 'INPUT' || _t.tagName === 'TEXTAREA' || _t.isContentEditable;

        // Shift+F (suspend filter) additionally passes through from controls
        // that are not text entry. Clicking a radio or checkbox parks focus on
        // it, and the workflow this shortcut exists for — building a route with
        // a filter on — leaves focus sitting on the Route Manager's radios, so
        // the guard would otherwise swallow the key exactly when it is wanted.
        // A radio does not consume letter keys, so nothing is lost.
        const _nonTextControl = _t.tagName === 'INPUT' &&
            ['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'color', 'file']
                .includes((_t.type || '').toLowerCase());
        const _allowThrough = e.key === 'Escape' ||
            (e.shiftKey && e.key.toLowerCase() === 'f' && _nonTextControl);

        if (_inField && !_allowThrough) {
            return;
        }

        const key = e.key.toLowerCase();
        keysDown.add(key);

        // Prevent default for route shortcut keys (dynamic from definitions), R, B, and G
        const routeShortcuts = (window.routeDefinitions || []).map(d => d.shortcut).filter(s => s && s.length === 1);
        if (key === 'r' || key === 'b' || key === 'g' || routeShortcuts.includes(key)) {
            e.preventDefault();
        }

        if (e.ctrlKey && e.key === 'Delete') {
            e.preventDefault();
            if (typeof clearCanvas === 'function') clearCanvas();

        } else if (e.ctrlKey && !e.altKey && key === 's') {
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
        } else if (e.ctrlKey && e.altKey && key === 'm') {
            e.preventDefault();
            keysDown.clear(); // FIX: Prevent 'm' from getting stuck
            runMgT2EMacro();
        } else if (e.ctrlKey && e.altKey && key === 'c') {
            e.preventDefault();
            keysDown.clear(); // FIX: Prevent 'c' from getting stuck
            runCTNewMacro();
        } else if (e.ctrlKey && e.altKey && key === 'r') {
            e.preventDefault();
            keysDown.clear(); // FIX: Prevent 'r' from getting stuck
            runRTTMacro();
        } else if (e.ctrlKey && e.altKey && key === '5') {
            e.preventDefault();
            keysDown.clear();
            runT5Macro();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            const contextMenu = document.getElementById('context-menu');
            const helpPanel = document.getElementById('help-panel');
            const settingsPanel = document.getElementById('settings-panel');
            const hexEditor = document.getElementById('hex-editor');
            const filterModal = document.getElementById('filter-modal');

            // Priority 0: An armed map pick. Must come first — otherwise Escape
            // falls through to Priority 3 and closes the whole Route Manager
            // when the user only meant to cancel the pick.
            if (window.MapPick && window.MapPick.isArmed()) {
                window.MapPick.cancel();
                return;
            }

            // Priority 1: Context Menu
            if (contextMenu && contextMenu.classList.contains('visible')) {
                contextMenu.classList.remove('visible');
                return;
            }
            
            // Priority 2: Side Panels
            if (helpPanel && helpPanel.classList.contains('open')) {
                helpPanel.classList.remove('open');
                return;
            }
            if (settingsPanel && settingsPanel.classList.contains('open')) {
                settingsPanel.classList.remove('open');
                return;
            }
            
            // Priority 3: Floating Palettes
            if (hexEditor && hexEditor.classList.contains('visible')) {
                closeHexEditor();
                return;
            }
            if (filterModal && filterModal.classList.contains('visible')) {
                closeFilterModal();
                return;
            }
            const routeWindow = document.getElementById('route-window');
            if (routeWindow && routeWindow.classList.contains('visible')) {
                window.closeRouteWindow();
                return;
            }
            const borderWindow = document.getElementById('border-window');
            if (borderWindow && borderWindow.classList.contains('visible')) {
                window.closeBorderWindow();
                return;
            }

            // Cleanup
            deselectAllHexes();
        } else if (key === 'f' && e.shiftKey && !e.ctrlKey && !e.altKey) {
            // MUST be tested before the bare 'f' branch below: `key` is
            // lowercased above, so Shift+F arrives here as 'f' and would
            // otherwise just open the Filter Manager.
            e.preventDefault();
            if (typeof window.toggleFilterSuspension === 'function') window.toggleFilterSuspension();
        } else if (key === 'f') {
            e.preventDefault();
            toggleFilterModal();
        } else if (key === 'r') {
            e.preventDefault();
            if (typeof window.toggleRouteWindow === 'function') window.toggleRouteWindow();
        } else if (key === 'b' && !e.ctrlKey) {
            e.preventDefault();
            if (typeof window.toggleBorderWindow === 'function') window.toggleBorderWindow();
        } else if (key === 'g' && !e.ctrlKey) {
            e.preventDefault();
            if (typeof window.toggleRegionWindow === 'function') window.toggleRegionWindow();
        // NOTE: the 'A' key used to open an Allegiance Manager window. That
        // window was removed and #allegiance-window no longer exists, so the
        // shortcut swallowed the key and did nothing. Assigning allegiances is
        // still available from the right-click menu, and the allegiance field
        // and filter are unaffected.
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
                    if (window.dbManager) { window.dbManager.syncAllHexes(); window.dbManager.saveRoutes(); }
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
                    if (window.dbManager) { window.dbManager.syncAllHexes(); window.dbManager.saveRoutes(); }
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        keysDown.delete(e.key.toLowerCase());
    });

    // FIX: Safety net to clear all keys if the window loses focus
    window.addEventListener('blur', () => {
        if (typeof keysDown !== 'undefined' && keysDown.clear) {
            keysDown.clear();
        }
    });
}