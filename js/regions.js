// ============================================================================
// REGIONS.JS - Region Manager UI & Import
// Parallel architecture to borders.js — regions are first-class objects with
// their own slot definitions, window, and direct renderer fill pass.
// state.cluster stores the matching slot name on each hex.
// ============================================================================

const REGION_COLOR_CYCLE = [
    '#e63946','#f4a261','#e9c46a','#2a9d8f','#4cc9f0',
    '#7209b7','#f72585','#06d6a0','#ffffff','#ff6b35',
    '#b5e48c','#0077b6','#9d4edd','#ffbe0b','#d62828',
    '#52b788','#c77dff','#3a86ff','#fb8500','#a8dadc',
];

function getDefaultRegionDefinitions() {
    return Array.from({ length: 5 }, (_, i) => ({
        id:      i + 1,
        name:    `Region ${i + 1}`,
        color:   REGION_COLOR_CYCLE[i],
        visible: true,
    }));
}

window.ensureFreeRegionSlot = function () {
    if (!window.regionDefinitions) window.regionDefinitions = getDefaultRegionDefinitions();
    const hexCounts = new Map();
    hexStates.forEach(state => {
        if (state.cluster && state.cluster !== '----') {
            hexCounts.set(state.cluster, (hexCounts.get(state.cluster) || 0) + 1);
        }
    });
    const free = window.regionDefinitions.find(d =>
        /^Region \d+$/.test(d.name) && !hexCounts.has(d.name)
    );
    if (free) return false;
    const nextId = window.regionDefinitions.length > 0
        ? Math.max(...window.regionDefinitions.map(d => d.id)) + 1 : 1;
    window.regionDefinitions.push({
        id:      nextId,
        name:    `Region ${nextId}`,
        color:   REGION_COLOR_CYCLE[(nextId - 1) % REGION_COLOR_CYCLE.length],
        visible: true,
    });
    return true;
};

// Sort used region slots alphabetically, trim excess free slots to one sentinel,
// then renumber IDs.  Safe because hex assignments use def.name (state.cluster),
// not def.id, and regionPaths is also keyed by name.
window.sortAndTrimRegionDefinitions = function () {
    if (!window.regionDefinitions || window.regionDefinitions.length === 0) return;

    const usedNames = new Set();
    hexStates.forEach(state => {
        if (state.cluster && state.cluster !== '----') usedNames.add(state.cluster);
    });
    const isUsed = d => usedNames.has(d.name);

    window.regionDefinitions.sort((a, b) => {
        const aUsed = isUsed(a);
        const bUsed = isUsed(b);
        if (aUsed !== bUsed) return aUsed ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    // Trim to one free sentinel slot.
    const firstFreeIdx = window.regionDefinitions.findIndex(d => !isUsed(d));
    if (firstFreeIdx !== -1) {
        window.regionDefinitions.splice(firstFreeIdx + 1);
    }

    window.regionDefinitions.forEach((d, i) => { d.id = i + 1; });

    window.ensureFreeRegionSlot();
    if (window.dbManager) window.dbManager.saveRegionDefinitions?.();
};

// ── Render the Region Manager window list ─────────────────────────────────────
window.renderRegionWindow = function () {
    const list = document.getElementById('region-window-list');
    if (!list) return;
    list.innerHTML = '';

    if (!window.regionDefinitions) window.regionDefinitions = getDefaultRegionDefinitions();

    window.ensureFreeRegionSlot();

    // Count hexes per region by scanning state.cluster
    const hexCounts = new Map();
    hexStates.forEach(state => {
        if (state.cluster && state.cluster !== '----') {
            hexCounts.set(state.cluster, (hexCounts.get(state.cluster) || 0) + 1);
        }
    });

    window.regionDefinitions.forEach(def => {
        const hexCount = hexCounts.get(def.name) || 0;
        const hexClass = hexCount > 0 ? 'used' : 'free';
        const hexLabel = hexCount > 0 ? String(hexCount) : '—';

        const row = document.createElement('div');
        row.className = 'border-row';
        row.style.opacity = def.visible ? '1' : '0.45';
        row.dataset.regionId = def.id;
        row.innerHTML = `
            <span class="border-hex-count ${hexClass}" title="${hexCount} hex(es)">${hexLabel}</span>
            <input type="text" class="border-name-input" value="${def.name.replace(/"/g, '&quot;')}" title="Region name" />
            <input type="color" class="border-color-swatch" value="${def.color}" title="Region color" />
            <i class="fas fa-eye${def.visible ? '' : '-slash'} region-eye-btn"
               style="color:${def.visible ? '#45a29e' : '#666'};cursor:pointer;font-size:0.8rem;"
               title="${def.visible ? 'Disable region' : 'Enable region'}"></i>
            <button class="border-clear-btn" title="Remove all hex assignments for this region">C</button>
            <i class="fas fa-times region-delete-btn"
               style="color:#ff4500;cursor:pointer;font-size:0.8rem;"
               title="Delete region '${def.name.replace(/'/g, "&#39;")}'"></i>
        `;

        const nameIn   = row.querySelector('.border-name-input');
        const colorIn  = row.querySelector('.border-color-swatch');
        const eyeBtn   = row.querySelector('.region-eye-btn');
        const delBtn   = row.querySelector('.region-delete-btn');
        const clearBtn = row.querySelector('.border-clear-btn');

        nameIn.addEventListener('change', () => {
            const oldName = def.name;
            const newName = nameIn.value.trim() || def.name;
            nameIn.value  = newName;
            if (oldName === newName) return;
            // Rename cluster values on all matching hexes
            hexStates.forEach(state => {
                if (state.cluster === oldName) state.cluster = newName;
            });
            // Invalidate stored region paths for the old name
            if (window.regionPaths) {
                window.regionPaths.forEach((val, key) => {
                    if (key.endsWith(':' + oldName)) window.regionPaths.delete(key);
                });
            }
            def.name = newName;
            if (window.dbManager) { window.dbManager.saveRegionDefinitions?.(); window.dbManager.saveRegionPaths?.(); }
            requestAnimationFrame(draw);
        });

        colorIn.addEventListener('input', () => {
            def.color = colorIn.value;
            if (window.dbManager) window.dbManager.saveRegionDefinitions?.();
            requestAnimationFrame(draw);
        });

        eyeBtn.addEventListener('click', () => {
            def.visible = !def.visible;
            const vis = def.visible;
            eyeBtn.className = `fas fa-eye${vis ? '' : '-slash'} region-eye-btn`;
            eyeBtn.style.color = vis ? '#45a29e' : '#666';
            eyeBtn.title = vis ? 'Disable region' : 'Enable region';
            row.style.opacity = vis ? '1' : '0.45';
            if (window.dbManager) window.dbManager.saveRegionDefinitions?.();
            const allCb = document.getElementById('region-vis-all-check');
            if (allCb) {
                const defs2 = window.regionDefinitions || [];
                const vis2 = defs2.filter(d => d.visible).length;
                allCb.indeterminate = vis2 > 0 && vis2 < defs2.length;
                allCb.checked       = vis2 === defs2.length;
            }
            requestAnimationFrame(draw);
        });

        delBtn.addEventListener('click', () => {
            const hexMsg = hexCount > 0
                ? `\nThis will also clear its ${hexCount} hex assignment(s).` : '';
            if (!confirm(`Delete region "${def.name}"?${hexMsg}\n\nThis can be undone with Ctrl+Z.`)) return;
            saveHistoryState(`Delete ${def.name}`);
            hexStates.forEach(state => {
                if (state.cluster === def.name) state.cluster = '----';
            });
            if (window.regionPaths) {
                window.regionPaths.forEach((val, key) => {
                    if (key.endsWith(':' + def.name)) window.regionPaths.delete(key);
                });
            }
            window.regionDefinitions = (window.regionDefinitions || []).filter(d => d.id !== def.id);
            if (window.dbManager) {
                window.dbManager.saveRegionDefinitions?.();
                window.dbManager.saveRegionPaths?.();
            }
            requestAnimationFrame(draw);
            window.renderRegionWindow();
            showToast(`Deleted region "${def.name}".`, 2000);
        });

        clearBtn.addEventListener('click', () => {
            const count = hexCounts.get(def.name) || 0;
            if (count === 0) { showToast(`Region #${def.id} has no hexes to clear.`, 2000); return; }
            if (!confirm(`Clear all ${count} hex assignment(s) for "${def.name}"?`)) return;
            hexStates.forEach(state => {
                if (state.cluster === def.name) state.cluster = '----';
            });
            if (window.regionPaths) {
                window.regionPaths.forEach((val, key) => {
                    if (key.endsWith(':' + def.name)) window.regionPaths.delete(key);
                });
            }
            if (window.dbManager) window.dbManager.saveRegionPaths?.();
            requestAnimationFrame(draw);
            window.renderRegionWindow();
            showToast(`Cleared all hexes for "${def.name}".`, 2000);
        });

        list.appendChild(row);
    });

    if (typeof window.populateFilterRegionDropdown === 'function') window.populateFilterRegionDropdown();

    // Sync the "Show All" header checkbox to the current visibility state.
    const visAllCb = document.getElementById('region-vis-all-check');
    if (visAllCb) {
        const defs = window.regionDefinitions || [];
        const visCount = defs.filter(d => d.visible).length;
        visAllCb.indeterminate = visCount > 0 && visCount < defs.length;
        visAllCb.checked       = visCount === defs.length;
    }
};

// ── Toggle / close ────────────────────────────────────────────────────────────
window.toggleRegionWindow = function () {
    const win = document.getElementById('region-window');
    if (!win) return;
    if (win.classList.contains('visible')) {
        window.closeRegionWindow();
    } else {
        window.renderRegionWindow();
        win.classList.add('visible');
    }
};

window.closeRegionWindow = function () {
    const win = document.getElementById('region-window');
    if (win) win.classList.remove('visible');
};

// ── Refresh hex-count pills without full re-render ────────────────────────────
window.refreshRegionWindowCounts = function () {
    const win = document.getElementById('region-window');
    if (!win || !win.classList.contains('visible')) return;

    const hexCounts = new Map();
    hexStates.forEach(state => {
        if (state.cluster && state.cluster !== '----') {
            hexCounts.set(state.cluster, (hexCounts.get(state.cluster) || 0) + 1);
        }
    });

    document.querySelectorAll('#region-window-list .border-row').forEach(row => {
        const regionId = parseInt(row.dataset.regionId, 10);
        const def = (window.regionDefinitions || []).find(d => d.id === regionId);
        if (!def) return;
        const pill = row.querySelector('.border-hex-count');
        if (!pill) return;
        const count = hexCounts.get(def.name) || 0;
        pill.className   = `border-hex-count ${count > 0 ? 'used' : 'free'}`;
        pill.textContent = count > 0 ? String(count) : '—';
        pill.title       = `${count} hex(es)`;
    });
};

// ── Assign-modal: open (called from right-click context menu) ─────────────────
window.openAssignRegionModal = function () {
    document.getElementById('context-menu').classList.remove('visible');
    const count = selectedHexes.size;
    if (count === 0) { showToast('No hexes selected.', 2000); return; }

    document.getElementById('region-assign-modal-count').textContent = count;

    const grid = document.getElementById('region-assign-grid');
    grid.innerHTML = '';

    // "Clear Region" option at the top of the list
    const clearBtn = document.createElement('button');
    clearBtn.className = 'border-assign-btn';
    clearBtn.style.color       = '#888888';
    clearBtn.style.borderColor = '#888888';
    clearBtn.innerHTML = `<span class="border-assign-num">✕</span>`
                       + `<span class="border-assign-name">Clear Region</span>`;
    clearBtn.addEventListener('click', () => {
        const hexList = [...selectedHexes];
        saveHistoryState('Clear Region');
        hexList.forEach(hexId => {
            const s = hexStates.get(hexId);
            if (!s) return;
            s.cluster = '----';
        });
        document.getElementById('region-assign-modal').style.display = 'none';
        window.renderRegionWindow();
        requestAnimationFrame(draw);
        showToast(`Region cleared for ${hexList.length} hex(es).`, 2500);
    });
    grid.appendChild(clearBtn);

    (window.regionDefinitions || getDefaultRegionDefinitions()).forEach(def => {
        const btn = document.createElement('button');
        btn.className = 'border-assign-btn';
        btn.style.color       = def.color;
        btn.style.borderColor = def.color;
        btn.innerHTML = `<span class="border-assign-num">#${def.id}</span>`
                      + `<span class="border-assign-name">${def.name}</span>`;
        btn.addEventListener('click', () => window.confirmAssignRegion(def.id));
        grid.appendChild(btn);
    });

    document.getElementById('region-assign-modal').style.display = 'flex';
};

// ── Assign-modal: confirm selection ──────────────────────────────────────────
window.confirmAssignRegion = function (regionId) {
    const def = (window.regionDefinitions || []).find(d => d.id === regionId);
    if (!def) return;
    const hexList = [...selectedHexes];
    saveHistoryState('Assign Region');

    hexList.forEach(hexId => {
        let s = hexStates.get(hexId);
        if (!s) { s = { type: 'BLANK' }; hexStates.set(hexId, s); }
        if (window.regionPaths) {
            const sn = parseInt(hexId.split('-')[0], 10);
            if (s.cluster && s.cluster !== '----') window.regionPaths.delete(`${sn}:${s.cluster}`);
            window.regionPaths.delete(`${sn}:${def.name}`);
        }
        s.cluster = def.name;
    });

    document.getElementById('region-assign-modal').style.display = 'none';
    window.ensureFreeRegionSlot();
    window.renderRegionWindow();
    if (window.dbManager) window.dbManager.saveRegionDefinitions?.();
    requestAnimationFrame(draw);
    showToast(`${hexList.length} hex(es) assigned to "${def.name}".`, 2500);
};

// ── Populate the hex-editor region dropdown ───────────────────────────────────
window.populateRegionDropdown = function (currentCluster) {
    const sel = document.getElementById('edit-region');
    if (!sel) return;
    sel.innerHTML = '<option value="----">— None —</option>';
    (window.regionDefinitions || getDefaultRegionDefinitions()).forEach(def => {
        const opt = document.createElement('option');
        opt.value       = def.name;
        opt.textContent = def.name;
        sel.appendChild(opt);
    });
    const val = (!currentCluster || currentCluster === '----') ? '----' : currentCluster;
    sel.value = val;
    // If value doesn't match any option (legacy free-text), add it as a temporary option
    if (sel.value !== val) {
        const opt = document.createElement('option');
        opt.value       = val;
        opt.textContent = val + ' (unassigned)';
        sel.insertBefore(opt, sel.children[1]);
        sel.value = val;
    }
};

// ── Wire up event listeners ───────────────────────────────────────────────────
function setupRegionWindow() {
    const closeBtn = document.getElementById('btn-close-region-window');
    if (closeBtn) closeBtn.addEventListener('click', window.closeRegionWindow);

    const closeBtnFooter = document.getElementById('btn-close-region-window-footer');
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', window.closeRegionWindow);

    const ctxOpenBtn = document.getElementById('ctx-open-region-window');
    if (ctxOpenBtn) {
        ctxOpenBtn.addEventListener('click', () => {
            document.getElementById('context-menu').classList.remove('visible');
            window.toggleRegionWindow();
        });
    }

    // Right-click "Assign Region" now opens the slot-grid modal
    const ctxAssignBtn = document.getElementById('ctx-assign-region');
    if (ctxAssignBtn) {
        // Remove the old listener by cloning and replacing the node
        const fresh = ctxAssignBtn.cloneNode(true);
        ctxAssignBtn.parentNode.replaceChild(fresh, ctxAssignBtn);
        fresh.addEventListener('click', window.openAssignRegionModal);
    }

    const cancelBtn = document.getElementById('btn-region-assign-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        document.getElementById('region-assign-modal').style.display = 'none';
    });

    const visAllCb = document.getElementById('region-vis-all-check');
    if (visAllCb) {
        visAllCb.addEventListener('change', () => {
            const show = visAllCb.checked;
            (window.regionDefinitions || []).forEach(def => { def.visible = show; });
            if (window.dbManager) window.dbManager.saveRegionDefinitions?.();
            document.querySelectorAll('#region-window-list .border-row').forEach(row => {
                const regionId = parseInt(row.dataset.regionId, 10);
                const d = (window.regionDefinitions || []).find(x => x.id === regionId);
                if (!d) return;
                const eye = row.querySelector('.region-eye-btn');
                if (eye) {
                    eye.className = `fas fa-eye${show ? '' : '-slash'} region-eye-btn`;
                    eye.style.color = show ? '#45a29e' : '#666';
                    eye.title = show ? 'Disable region' : 'Enable region';
                }
                row.style.opacity = show ? '1' : '0.45';
            });
            visAllCb.indeterminate = false;
            requestAnimationFrame(draw);
        });
    }

    if (!window.regionDefinitions) window.regionDefinitions = getDefaultRegionDefinitions();
    if (!window.regionPaths)       window.regionPaths       = new Map();
}
