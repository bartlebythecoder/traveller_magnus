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
    return Array.from({ length: 10 }, (_, i) => ({
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

// ── Render the Region Manager window list ─────────────────────────────────────
window.renderRegionWindow = function () {
    const list = document.getElementById('region-window-list');
    if (!list) return;
    list.innerHTML = '';

    if (!window.regionDefinitions) window.regionDefinitions = getDefaultRegionDefinitions();

    // Ensure minimum 10 slots
    while (window.regionDefinitions.length < 10) {
        const nextId = window.regionDefinitions.length + 1;
        window.regionDefinitions.push({
            id:      nextId,
            name:    `Region ${nextId}`,
            color:   REGION_COLOR_CYCLE[(nextId - 1) % REGION_COLOR_CYCLE.length],
            visible: true,
        });
    }

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
        row.dataset.regionId = def.id;
        row.innerHTML = `
            <span class="border-num">#${def.id}</span>
            <span class="border-hex-count ${hexClass}" title="${hexCount} hex(es)">${hexLabel}</span>
            <input type="text" class="border-name-input" value="${def.name.replace(/"/g, '&quot;')}" title="Region name" />
            <input type="color" class="border-color-swatch" value="${def.color}" title="Region color" />
            <label class="border-vis-label"><input type="checkbox" class="border-visible-check" ${def.visible ? 'checked' : ''}> Vis</label>
            <button class="border-clear-btn" title="Remove all hex assignments for this region">C</button>
        `;

        const nameIn   = row.querySelector('.border-name-input');
        const colorIn  = row.querySelector('.border-color-swatch');
        const visIn    = row.querySelector('.border-visible-check');
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
            requestAnimationFrame(draw);
        });

        colorIn.addEventListener('input', () => {
            def.color = colorIn.value;
            requestAnimationFrame(draw);
        });

        visIn.addEventListener('change', () => {
            def.visible = visIn.checked;
            requestAnimationFrame(draw);
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
            requestAnimationFrame(draw);
            window.renderRegionWindow();
            showToast(`Cleared all hexes for "${def.name}".`, 2000);
        });

        list.appendChild(row);
    });

    if (typeof window.populateFilterRegionDropdown === 'function') window.populateFilterRegionDropdown();
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

    if (!window.regionDefinitions) window.regionDefinitions = getDefaultRegionDefinitions();
    if (!window.regionPaths)       window.regionPaths       = new Map();
}
