// ============================================================================
// KEYBOARD_SHORTCUTS.JS - Hotkeys and Key Event Listeners
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

        if (e.ctrlKey && !e.altKey && key === 's') {
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

    // FIX: Safety net to clear all keys if the window loses focus
    window.addEventListener('blur', () => {
        if (typeof keysDown !== 'undefined' && keysDown.clear) {
            keysDown.clear();
        }
    });
}