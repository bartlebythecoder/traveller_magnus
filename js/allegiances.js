// ============================================================================
// ALLEGIANCES.JS - Allegiance Manager UI, Import & Rendering Support
// Architecture mirrors regions.js but uses a separate hexAllegianceAssignments
// Map (like borders) so blank hexes can also carry an allegiance.
// state.allegiance stays as the per-system TSV field; hexAllegianceAssignments
// is the rendering source of truth and covers all hexes including empty ones.
//
// Each definition slot holds a codes[] array (parallel to borderDefinitions
// allegianceCodes[]) so that multiple TSV codes sharing a canonical name
// (e.g. ImDd, ImSy, ImDc → "Third Imperium") collapse into one slot.
// importAllegianceCodesFromXml uses name-first grouping, mirroring the
// label-first grouping in importBordersFromXml in borders.js.
// ============================================================================

// Same 20 colors as BORDER_COLOR_CYCLE so slot N matches border slot N visually.
const ALLEGIANCE_COLOR_CYCLE = [
    '#e63946','#f4a261','#e9c46a','#2a9d8f','#4cc9f0','#7209b7','#f72585','#06d6a0',
    '#ffffff','#ff6b35','#b5e48c','#0077b6','#9d4edd','#ffbe0b','#d62828','#52b788',
    '#c77dff','#3a86ff','#fb8500','#a8dadc',
];

function getDefaultAllegianceDefinitions() {
    return Array.from({ length: 5 }, (_, i) => ({
        id:      i + 1,
        codes:   [],
        name:    `Allegiance ${i + 1}`,
        color:   ALLEGIANCE_COLOR_CYCLE[i],
        visible: true,
    }));
}

// Migrate a saved definition from the old single-code format to the codes array.
function _migrateAllegianceDef(def) {
    if (!def.codes) {
        def.codes = def.code ? [def.code] : [];
        delete def.code;
    }
}

// ── Slot management ───────────────────────────────────────────────────────────

window.ensureFreeAllegianceSlot = function () {
    if (!window.allegianceDefinitions) window.allegianceDefinitions = getDefaultAllegianceDefinitions();
    window.allegianceDefinitions.forEach(_migrateAllegianceDef);
    const free = window.allegianceDefinitions.find(d => d.codes.length === 0);
    if (free) return false;
    const nextId = window.allegianceDefinitions.length > 0
        ? Math.max(...window.allegianceDefinitions.map(d => d.id)) + 1 : 1;
    window.allegianceDefinitions.push({
        id:      nextId,
        codes:   [],
        name:    `Allegiance ${nextId}`,
        color:   ALLEGIANCE_COLOR_CYCLE[(nextId - 1) % ALLEGIANCE_COLOR_CYCLE.length],
        visible: true,
    });
    if (window.dbManager) window.dbManager.saveAllegianceDefinitions?.();
    return true;
};

// ── Auto-discover allegiance codes from state.allegiance on all system hexes ──
// Creates or claims definition slots for any code not yet covered by any slot's
// codes array.  Also syncs state.allegiance into hexAllegianceAssignments for
// system hexes not already in the map (e.g. after TSV import).
window.autoDiscoverAllegianceCodes = function () {
    if (!window.allegianceDefinitions) window.allegianceDefinitions = getDefaultAllegianceDefinitions();
    if (!window.hexAllegianceAssignments) window.hexAllegianceAssignments = new Map();
    window.allegianceDefinitions.forEach(_migrateAllegianceDef);

    // Sync state.allegiance → hexAllegianceAssignments for any system hex not yet mapped
    hexStates.forEach((state, hexId) => {
        if (state.allegiance && state.allegiance !== '----') {
            if (!window.hexAllegianceAssignments.has(hexId)) {
                window.hexAllegianceAssignments.set(hexId, state.allegiance);
            }
        }
    });

    // Collect all codes currently in the assignments map, sorted alphabetically
    // so any newly claimed slots land in alpha order by raw code.
    const usedCodes = [];
    window.hexAllegianceAssignments.forEach(code => {
        if (code && code !== '----' && !usedCodes.includes(code)) usedCodes.push(code);
    });
    usedCodes.sort((a, b) => a.localeCompare(b));

    // For each code not yet in any slot's codes array, claim a free slot or push a new one
    const knownCodes = new Set(window.allegianceDefinitions.flatMap(d => d.codes));
    usedCodes.forEach(code => {
        if (knownCodes.has(code)) return;
        knownCodes.add(code);
        const free = window.allegianceDefinitions.find(d => d.codes.length === 0);
        if (free) {
            free.codes = [code];
        } else {
            const nextId = Math.max(...window.allegianceDefinitions.map(d => d.id)) + 1;
            window.allegianceDefinitions.push({
                id:    nextId,
                codes: [code],
                name:  `Allegiance ${nextId}`,
                color: ALLEGIANCE_COLOR_CYCLE[(nextId - 1) % ALLEGIANCE_COLOR_CYCLE.length],
                visible: true,
            });
        }
    });

    // Final global sort: used slots alphabetically by name, free slots after.
    // Safe because hexAllegianceAssignments keys on allegiance codes, not slot IDs.
    window.allegianceDefinitions.sort((a, b) => {
        const aUsed = a.codes.length > 0;
        const bUsed = b.codes.length > 0;
        if (aUsed !== bUsed) return aUsed ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    // Trim excess free slots — keep exactly one sentinel at the end.
    // Pre-populated defaults leave up to 20 blanks; after import we only want one.
    const firstFreeIdx = window.allegianceDefinitions.findIndex(d => d.codes.length === 0);
    if (firstFreeIdx !== -1) {
        window.allegianceDefinitions.splice(firstFreeIdx + 1);
    }

    window.allegianceDefinitions.forEach((d, i) => { d.id = i + 1; });

    // Persist both the definitions (sorted/trimmed) and the assignments map so
    // hexAllegianceAssignments survives a page refresh.  saveAllegianceAssignments
    // is NOT called by scheduleSyncAll during imports, so we call it explicitly here.
    if (window.dbManager) {
        window.dbManager.saveAllegianceDefinitions?.();
        window.dbManager.saveAllegianceAssignments?.();
    }
};

// ── Populate hexAllegianceAssignments from border flood-fill results ───────────
// Runs after border import. Any hex already in the map (from TSV) is skipped.
window.autoPopulateAllegianceFromBorders = function () {
    if (!window.hexBorderAssignments || !window.borderDefinitions) return;
    if (!window.hexAllegianceAssignments) window.hexAllegianceAssignments = new Map();

    // Build borderId → allegianceCode lookup
    const borderAllegMap = new Map();
    (window.borderDefinitions || []).forEach(def => {
        const code = (def.allegianceCodes && def.allegianceCodes[0]) || def.allegiance || null;
        if (code && code !== '----') borderAllegMap.set(def.id, code);
    });

    // Assign allegiance to border-covered hexes not yet in the map
    window.hexBorderAssignments.forEach((borderId, hexId) => {
        if (window.hexAllegianceAssignments.has(hexId)) return; // TSV system data wins
        const code = borderAllegMap.get(borderId);
        if (code) window.hexAllegianceAssignments.set(hexId, code);
    });

    window.autoDiscoverAllegianceCodes();
    if (typeof window.renderAllegianceWindow === 'function') window.renderAllegianceWindow();
};

// ── Import allegiance names from <Allegiances> XML section ───────────────────
// Uses border-label-first grouping: if a <Border Label="Third Imperium" Allegiance="ImDd">
// exists, "Third Imperium" becomes the grouping key so that ImDd and ImDv (which both
// appear as Label="Third Imperium" in their respective sectors' Borders elements) collapse
// into one slot.  Falls back to the allegiance element's own text name when no border label
// is available (e.g. NaHu, CsIm).
window.importAllegianceCodesFromXml = function (allegiancesElement, bordersElement) {
    if (!allegiancesElement) return;
    if (!window.allegianceDefinitions) window.allegianceDefinitions = getDefaultAllegianceDefinitions();
    window.allegianceDefinitions.forEach(_migrateAllegianceDef);

    // Build code → border label map from the <Borders> section when provided.
    // Only the first Label seen for each code is stored (sectors are consistent).
    const borderLabelMap = new Map();
    if (bordersElement) {
        bordersElement.querySelectorAll('Border').forEach(el => {
            const code  = (el.getAttribute('Allegiance') || '').trim();
            const label = (el.getAttribute('Label')      || '').trim();
            if (code && label && !borderLabelMap.has(code)) borderLabelMap.set(code, label);
        });
    }

    // Build a base-code → canonical name map from the allegiances section itself.
    // e.g. <Allegiance Code="As">Aslan Hierate</Allegiance> → baseNameMap.get('As') = 'Aslan Hierate'
    // Used so that sub-codes with Base="As" (AsSc, AsMw, AsT0 …) collapse into one slot
    // when no border Label is present to do the same job.
    const baseNameMap = new Map();
    allegiancesElement.querySelectorAll('Allegiance').forEach(el => {
        const code = (el.getAttribute('Code') || '').trim();
        const name = el.textContent.trim();
        if (code && name) baseNameMap.set(code, name);
    });

    // Synthesize canonical names for base codes present only as a Base= attribute.
    // Some sectors list ZhCo/ZhJp/ZhIa but omit the bare Zh entry; without this
    // pass each sub-code would fall back to its own full name and land in separate
    // slots.  The shortest name among codes sharing a base has the fewest qualifiers
    // and is therefore the canonical group name (e.g. "Zhodani Consulate" wins over
    // "Zhodani Consulate, Jadlapriants Province").
    {
        const baseCandidates = new Map();
        allegiancesElement.querySelectorAll('Allegiance').forEach(el => {
            const code = (el.getAttribute('Code') || '').trim();
            const base = (el.getAttribute('Base') || '').trim();
            const name = el.textContent.trim();
            if (!base || base === code) return;
            if (!baseCandidates.has(base) || name.length < baseCandidates.get(base).length) {
                baseCandidates.set(base, name);
            }
        });
        baseCandidates.forEach((name, base) => {
            if (!baseNameMap.has(base)) baseNameMap.set(base, name);
        });
    }

    // Collect all entries first so we can sort alphabetically by groupKey before claiming slots.
    const allegianceEntries = [];
    allegiancesElement.querySelectorAll('Allegiance').forEach(el => {
        const code = (el.getAttribute('Code') || '').trim();
        const name = el.textContent.trim();
        if (!code || !name) return;
        const base = (el.getAttribute('Base') || '').trim();
        const groupKey = code.startsWith('Kk')
            ? 'Two Thousand Worlds'
            : code.startsWith('V')
            ? 'Vargr Extents'
            : (borderLabelMap.get(code)
                || (base && baseNameMap.get(base))
                || name);
        allegianceEntries.push({ code, groupKey });
    });
    allegianceEntries.sort((a, b) => a.groupKey.localeCompare(b.groupKey));

    allegianceEntries.forEach(({ code, groupKey }) => {
        // Check if this code already lives in some slot (e.g. placed there by autoDiscoverAllegianceCodes).
        const existingSlot = window.allegianceDefinitions.find(d => d.codes.includes(code));

        // Group key first: all codes sharing the same group key collapse into one slot.
        const byKey = window.allegianceDefinitions.find(d => d.name === groupKey);
        if (byKey) {
            if (!byKey.codes.includes(code)) byKey.codes.push(code);
            // Evict the code from any other slot it was previously in (avoids color split).
            if (existingSlot && existingSlot.id !== byKey.id) {
                existingSlot.codes = existingSlot.codes.filter(c => c !== code);
            }
            return;
        }

        // Code fallback: slot already claims this exact code — upgrade its name if still default.
        if (existingSlot) {
            if (/^Allegiance \d+$/.test(existingSlot.name)) existingSlot.name = groupKey;
            return;
        }

        // Claim a free slot or create a new one.
        const free = window.allegianceDefinitions.find(d => d.codes.length === 0);
        if (free) {
            free.codes = [code];
            free.name  = groupKey;
        } else {
            const nextId = Math.max(...window.allegianceDefinitions.map(d => d.id)) + 1;
            window.allegianceDefinitions.push({
                id:    nextId,
                codes: [code],
                name:  groupKey,
                color: ALLEGIANCE_COLOR_CYCLE[(nextId - 1) % ALLEGIANCE_COLOR_CYCLE.length],
                visible: true,
            });
        }
    });
    window.ensureFreeAllegianceSlot();
};

// ── Render the Allegiance Manager window list ─────────────────────────────────
window.renderAllegianceWindow = function () {
    const list = document.getElementById('allegiance-window-list');
    if (!list) return;
    list.innerHTML = '';

    if (!window.allegianceDefinitions) window.allegianceDefinitions = getDefaultAllegianceDefinitions();
    if (!window.hexAllegianceAssignments) window.hexAllegianceAssignments = new Map();
    window.allegianceDefinitions.forEach(_migrateAllegianceDef);

    window.ensureFreeAllegianceSlot();

    // Build per-code hex counts, then aggregate per definition
    const hexCounts = new Map();
    window.hexAllegianceAssignments.forEach(code => {
        if (code && code !== '----') hexCounts.set(code, (hexCounts.get(code) || 0) + 1);
    });

    window.allegianceDefinitions.forEach(def => {
        const count    = def.codes.reduce((sum, c) => sum + (hexCounts.get(c) || 0), 0);
        const hexClass = count > 0 ? 'used' : 'free';
        const hexLabel = count > 0 ? String(count) : '—';
        const codesStr = def.codes.join(', ');

        const row = document.createElement('div');
        row.className = 'border-row';
        row.dataset.allegianceId = def.id;
        row.style.opacity = def.visible ? '1' : '0.45';
        row.innerHTML = `
            <span class="border-hex-count ${hexClass}" title="${count} hex(es)">${hexLabel}</span>
            <input type="text" class="alleg-code-input" value="${codesStr.replace(/"/g, '&quot;')}" placeholder="----" title="Allegiance codes (comma-separated, e.g. ImDd, ImSy)" />
            <input type="text" class="border-name-input" value="${def.name.replace(/"/g, '&quot;')}" title="Allegiance name" />
            <input type="color" class="border-color-swatch" value="${def.color}" title="Allegiance color" />
            <i class="fas fa-eye${def.visible ? '' : '-slash'} alleg-eye-btn" style="color:${def.visible ? '#45a29e' : '#666'};cursor:pointer;font-size:0.8rem;" title="${def.visible ? 'Disable allegiance' : 'Enable allegiance'}"></i>
            <button class="border-clear-btn" title="Remove all hex assignments for this allegiance">C</button>
            <i class="fas fa-times alleg-delete-btn" style="color:#ff4500;cursor:pointer;font-size:0.8rem;" title="Delete allegiance '${def.name.replace(/'/g, "&#39;")}'"></i>
        `;

        const codeIn   = row.querySelector('.alleg-code-input');
        const nameIn   = row.querySelector('.border-name-input');
        const colorIn  = row.querySelector('.border-color-swatch');
        const eyeBtn   = row.querySelector('.alleg-eye-btn');
        const clearBtn = row.querySelector('.border-clear-btn');
        const delBtn   = row.querySelector('.alleg-delete-btn');

        codeIn.addEventListener('change', () => {
            const raw      = codeIn.value.trim();
            const newCodes = raw ? raw.split(',').map(c => c.trim()).filter(c => c.length > 0) : [];
            const oldCodes = def.codes;
            if (newCodes.join(',') === oldCodes.join(',')) return;

            // Validate: no code already claimed by another slot
            const conflict = newCodes.find(c =>
                window.allegianceDefinitions.find(d => d.id !== def.id && d.codes.includes(c))
            );
            if (conflict) {
                showToast(`Code "${conflict}" is already used by another slot.`, 2500);
                codeIn.value = oldCodes.join(', ');
                return;
            }

            // Remap hexes for codes being removed from this slot
            const removedCodes = oldCodes.filter(c => !newCodes.includes(c));
            if (removedCodes.length > 0) {
                const remapTo = newCodes.length > 0 ? newCodes[0] : null;
                if (window.hexAllegianceAssignments) {
                    window.hexAllegianceAssignments.forEach((c, hexId) => {
                        if (removedCodes.includes(c)) {
                            if (remapTo) window.hexAllegianceAssignments.set(hexId, remapTo);
                            else         window.hexAllegianceAssignments.delete(hexId);
                        }
                    });
                }
                hexStates.forEach(state => {
                    if (removedCodes.includes(state.allegiance)) {
                        state.allegiance = remapTo || '----';
                    }
                });
            }

            def.codes = newCodes;
            if (window.dbManager) window.dbManager.saveAllegianceDefinitions?.();
            requestAnimationFrame(draw);
        });

        nameIn.addEventListener('change', () => {
            def.name = nameIn.value.trim() || def.name;
            nameIn.value = def.name;
            if (window.dbManager) window.dbManager.saveAllegianceDefinitions?.();
        });

        colorIn.addEventListener('input', () => {
            def.color = colorIn.value;
            if (window.dbManager) window.dbManager.saveAllegianceDefinitions?.();
            requestAnimationFrame(draw);
        });

        eyeBtn.addEventListener('click', () => {
            def.visible = !def.visible;
            eyeBtn.classList.toggle('fa-eye', def.visible);
            eyeBtn.classList.toggle('fa-eye-slash', !def.visible);
            eyeBtn.style.color = def.visible ? '#45a29e' : '#666';
            eyeBtn.title = def.visible ? 'Disable allegiance' : 'Enable allegiance';
            row.style.opacity = def.visible ? '1' : '0.45';
            if (window.dbManager) window.dbManager.saveAllegianceDefinitions?.();
            const allCb = document.getElementById('allegiance-vis-all-check');
            if (allCb) {
                const defs2 = window.allegianceDefinitions || [];
                const vis2  = defs2.filter(d => d.visible).length;
                allCb.indeterminate = vis2 > 0 && vis2 < defs2.length;
                allCb.checked       = vis2 === defs2.length;
            }
            requestAnimationFrame(draw);
        });

        delBtn.addEventListener('click', () => {
            const codeStr = def.codes.length > 0 ? ` (${def.codes.join(', ')})` : '';
            const hexMsg  = count > 0 ? `\nThis will also clear its ${count} hex assignment(s).` : '';
            if (!confirm(`Delete allegiance "${def.name}"${codeStr}?${hexMsg}\n\nThis can be undone with Ctrl+Z.`)) return;
            saveHistoryState(`Delete ${def.name}`);
            if (window.hexAllegianceAssignments) {
                window.hexAllegianceAssignments.forEach((c, hexId) => {
                    if (def.codes.includes(c)) window.hexAllegianceAssignments.delete(hexId);
                });
            }
            hexStates.forEach(state => {
                if (def.codes.includes(state.allegiance)) state.allegiance = '----';
            });
            window.allegianceDefinitions = (window.allegianceDefinitions || []).filter(d => d.id !== def.id);
            if (window.dbManager) {
                window.dbManager.saveAllegianceAssignments?.();
                window.dbManager.saveAllegianceDefinitions?.();
            }
            requestAnimationFrame(draw);
            window.renderAllegianceWindow();
            showToast(`Deleted allegiance "${def.name}".`, 2000);
        });

        clearBtn.addEventListener('click', () => {
            if (count === 0) { showToast(`Allegiance #${def.id} has no hexes to clear.`, 2000); return; }
            const label = def.codes.length > 0 ? `"${def.name}" (${def.codes.join(', ')})` : `"${def.name}"`;
            if (!confirm(`Clear all ${count} hex assignment(s) for ${label}?`)) return;
            if (window.hexAllegianceAssignments) {
                window.hexAllegianceAssignments.forEach((c, hexId) => {
                    if (def.codes.includes(c)) window.hexAllegianceAssignments.delete(hexId);
                });
            }
            hexStates.forEach(state => {
                if (def.codes.includes(state.allegiance)) state.allegiance = '----';
            });
            if (window.dbManager) window.dbManager.saveAllegianceAssignments?.();
            requestAnimationFrame(draw);
            window.renderAllegianceWindow();
            showToast(`Cleared all hexes for ${label}.`, 2000);
        });

        list.appendChild(row);
    });

    if (typeof window.populateAllegianceDropdown === 'function') {
        const sel = document.getElementById('edit-allegiance');
        if (sel && sel.tagName === 'SELECT') {
            const cur = sel.value;
            window.populateAllegianceDropdown(cur);
        }
    }

    const visAllCb = document.getElementById('allegiance-vis-all-check');
    if (visAllCb) {
        const defs     = window.allegianceDefinitions || [];
        const visCount = defs.filter(d => d.visible).length;
        visAllCb.indeterminate = visCount > 0 && visCount < defs.length;
        visAllCb.checked       = visCount === defs.length;
    }
};

// ── Toggle / close ────────────────────────────────────────────────────────────
window.toggleAllegianceWindow = function () {
    const win = document.getElementById('allegiance-window');
    if (!win) return;
    if (win.classList.contains('visible')) {
        window.closeAllegianceWindow();
    } else {
        window.renderAllegianceWindow();
        win.classList.add('visible');
    }
};

window.closeAllegianceWindow = function () {
    const win = document.getElementById('allegiance-window');
    if (win) win.classList.remove('visible');
};

// ── Refresh hex-count pills without full re-render ────────────────────────────
window.refreshAllegianceWindowCounts = function () {
    const win = document.getElementById('allegiance-window');
    if (!win || !win.classList.contains('visible')) return;

    const hexCounts = new Map();
    (window.hexAllegianceAssignments || new Map()).forEach(code => {
        if (code && code !== '----') hexCounts.set(code, (hexCounts.get(code) || 0) + 1);
    });

    document.querySelectorAll('#allegiance-window-list .border-row').forEach(row => {
        const allegianceId = parseInt(row.dataset.allegianceId, 10);
        const def  = (window.allegianceDefinitions || []).find(d => d.id === allegianceId);
        if (!def) return;
        const pill = row.querySelector('.border-hex-count');
        if (!pill) return;
        const count = def.codes.reduce((sum, c) => sum + (hexCounts.get(c) || 0), 0);
        pill.className   = `border-hex-count ${count > 0 ? 'used' : 'free'}`;
        pill.textContent = count > 0 ? String(count) : '—';
        pill.title       = `${count} hex(es)`;
    });
};

// ── Assign-modal: open (called from right-click context menu) ─────────────────
window.openAssignAllegianceModal = function () {
    document.getElementById('context-menu').classList.remove('visible');
    const count = selectedHexes.size;
    if (count === 0) { showToast('No hexes selected.', 2000); return; }

    document.getElementById('allegiance-assign-modal-count').textContent = count;

    // Always start at step 1
    document.getElementById('allegiance-assign-step1').style.display = '';
    document.getElementById('allegiance-code-step').style.display    = 'none';

    const grid = document.getElementById('allegiance-assign-grid');
    grid.innerHTML = '';

    // "Clear Allegiance" button at the top
    const clearBtn = document.createElement('button');
    clearBtn.className = 'border-assign-btn';
    clearBtn.style.color       = '#888888';
    clearBtn.style.borderColor = '#888888';
    clearBtn.innerHTML = `<span class="border-assign-num">✕</span>`
                       + `<span class="border-assign-name">Clear</span>`;
    clearBtn.addEventListener('click', () => {
        const hexList = [...selectedHexes];
        saveHistoryState('Clear Allegiance');
        hexList.forEach(hexId => {
            if (window.hexAllegianceAssignments) window.hexAllegianceAssignments.delete(hexId);
            const s = hexStates.get(hexId);
            if (s) s.allegiance = '----';
        });
        if (window.dbManager) window.dbManager.saveAllegianceAssignments?.();
        document.getElementById('allegiance-assign-modal').style.display = 'none';
        window.renderAllegianceWindow();
        requestAnimationFrame(draw);
        showToast(`Allegiance cleared for ${hexList.length} hex(es).`, 2500);
    });
    grid.appendChild(clearBtn);

    // Only show definitions that have at least one code assigned
    const defs = (window.allegianceDefinitions || getDefaultAllegianceDefinitions()).filter(d => d.codes.length > 0);
    defs.forEach(def => {
        const multiCode = def.codes.length > 1;
        const btn = document.createElement('button');
        btn.className = 'border-assign-btn';
        btn.title     = `${def.name} (${def.codes.join(', ')})`;
        btn.style.color       = def.color;
        btn.style.borderColor = def.color;
        // Show "+" badge on the code label for multi-code slots so users know a second step follows
        const codeLabel = multiCode
            ? `${def.codes[0]} <span style="opacity:0.6;font-size:0.6rem;">+${def.codes.length - 1}</span>`
            : def.codes[0];
        btn.innerHTML = `<span class="border-assign-num">#${def.id}</span>`
                      + `<span class="border-assign-name">${def.name}</span>`
                      + `<span style="font-size:0.65rem;font-family:'Courier New',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${codeLabel}</span>`;
        btn.addEventListener('click', () => window.confirmAssignAllegiance(def.id));
        grid.appendChild(btn);
    });

    if (defs.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'color:#888;font-size:0.85rem;padding:8px;grid-column:1/-1;margin:0;';
        msg.textContent = 'No allegiance codes defined yet. Import a sector or add codes in the Allegiance Manager.';
        grid.appendChild(msg);
    }

    const BTN_COL_W = 100;
    const MAX_ROWS  = 9;
    const total     = defs.length + 1;
    const cols      = Math.max(4, Math.ceil(total / MAX_ROWS));
    grid.style.gridTemplateColumns = `repeat(${cols}, ${BTN_COL_W}px)`;

    // Set modal width to exactly fit the grid columns (col widths + 8px gaps).
    const gridPixelW   = cols * BTN_COL_W + (cols - 1) * 8;
    const modalContent = document.getElementById('allegiance-assign-modal').querySelector('.modal-content');
    modalContent.style.width    = gridPixelW + 'px';
    modalContent.style.maxWidth = '';

    document.getElementById('allegiance-assign-modal').style.display = 'flex';
};

// ── Assign-modal: confirm selection ──────────────────────────────────────────
// If the chosen slot has multiple codes, show step 2 (code picker) before writing.
// Otherwise write immediately.
window.confirmAssignAllegiance = function (allegianceId) {
    const def = (window.allegianceDefinitions || []).find(d => d.id === allegianceId);
    if (!def || def.codes.length === 0) return;

    if (def.codes.length > 1) {
        _showAllegianceCodeStep(def);
        return;
    }

    _writeAllegianceAssignment(def, def.codes[0]);
};

// Show step 2: a chip for each code in the slot.
function _showAllegianceCodeStep(def) {
    document.getElementById('allegiance-assign-step1').style.display = 'none';

    const stepEl = document.getElementById('allegiance-code-step');
    stepEl.style.display = '';
    document.getElementById('allegiance-code-step-slotname').textContent = def.name;

    // Resize modal to a comfortable fixed width for the chip row
    const modalContent = document.getElementById('allegiance-assign-modal').querySelector('.modal-content');
    modalContent.style.width    = '420px';
    modalContent.style.maxWidth = '';

    const chips = document.getElementById('allegiance-code-chips');
    chips.innerHTML = '';
    def.codes.forEach(code => {
        const chip = document.createElement('button');
        chip.className        = 'alleg-code-chip';
        chip.style.color      = def.color;
        chip.style.borderColor= def.color;
        chip.textContent      = code;
        chip.title            = `Assign code ${code}`;
        chip.addEventListener('click', () => _writeAllegianceAssignment(def, code));
        chips.appendChild(chip);
    });
}

// Write the assignment for all selected hexes and close the modal.
function _writeAllegianceAssignment(def, code) {
    const hexList = [...selectedHexes];
    saveHistoryState('Assign Allegiance');

    if (!window.hexAllegianceAssignments) window.hexAllegianceAssignments = new Map();
    hexList.forEach(hexId => {
        window.hexAllegianceAssignments.set(hexId, code);
        let s = hexStates.get(hexId);
        if (!s) { s = { type: 'BLANK' }; hexStates.set(hexId, s); }
        s.allegiance = code;
    });

    if (window.dbManager) window.dbManager.saveAllegianceAssignments?.();
    window.ensureFreeAllegianceSlot();
    document.getElementById('allegiance-assign-modal').style.display = 'none';
    window.renderAllegianceWindow();
    if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
    if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();
    requestAnimationFrame(draw);
    showToast(`${hexList.length} hex(es) assigned to "${def.name}" (${code}).`, 2500);
}

// ── Hex-editor allegiance dropdown ───────────────────────────────────────────
window.populateAllegianceDropdown = function (currentCode) {
    const sel = document.getElementById('edit-allegiance');
    if (!sel || sel.tagName !== 'SELECT') return;
    sel.innerHTML = '<option value="----">— None —</option>';
    (window.allegianceDefinitions || getDefaultAllegianceDefinitions())
        .filter(d => d.codes.length > 0)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(def => {
            if (def.codes.length === 1) {
                const opt = document.createElement('option');
                opt.value       = def.codes[0];
                opt.textContent = `${def.name} (${def.codes[0]})`;
                sel.appendChild(opt);
            } else {
                // One option per code so the user can select and preserve the exact 4-digit value
                def.codes.forEach(code => {
                    const opt = document.createElement('option');
                    opt.value       = code;
                    opt.textContent = `${def.name} — ${code}`;
                    sel.appendChild(opt);
                });
            }
        });

    const val = (!currentCode || currentCode === '----') ? '----' : currentCode;
    if (val !== '----') {
        sel.value = val;
        // If the exact code isn't in any slot, add a temporary unassigned entry
        if (sel.value !== val) {
            const opt = document.createElement('option');
            opt.value       = val;
            opt.textContent = `${val} (unassigned)`;
            sel.insertBefore(opt, sel.children[1]);
            sel.value = val;
        }
    } else {
        sel.value = '----';
    }
};

// ── Wire up event listeners ───────────────────────────────────────────────────
function setupAllegianceWindow() {
    const closeBtn = document.getElementById('btn-close-allegiance-window');
    if (closeBtn) closeBtn.addEventListener('click', window.closeAllegianceWindow);

    const closeBtnFooter = document.getElementById('btn-close-allegiance-window-footer');
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', window.closeAllegianceWindow);

    const ctxOpenBtn = document.getElementById('ctx-open-allegiance-window');
    if (ctxOpenBtn) {
        ctxOpenBtn.addEventListener('click', () => {
            document.getElementById('context-menu').classList.remove('visible');
            window.toggleAllegianceWindow();
        });
    }

    const ctxAssignBtn = document.getElementById('ctx-assign-allegiance');
    if (ctxAssignBtn) {
        const fresh = ctxAssignBtn.cloneNode(true);
        ctxAssignBtn.parentNode.replaceChild(fresh, ctxAssignBtn);
        fresh.addEventListener('click', window.openAssignAllegianceModal);
    }

    const cancelBtn = document.getElementById('btn-allegiance-assign-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        document.getElementById('allegiance-assign-modal').style.display = 'none';
    });

    const backBtn = document.getElementById('btn-allegiance-code-back');
    if (backBtn) backBtn.addEventListener('click', () => {
        document.getElementById('allegiance-code-step').style.display    = 'none';
        document.getElementById('allegiance-assign-step1').style.display = '';
        // Restore modal width to match the step-1 grid
        const grid    = document.getElementById('allegiance-assign-grid');
        const colDef  = grid.style.gridTemplateColumns || '';
        const colMatch = colDef.match(/repeat\((\d+)/);
        if (colMatch) {
            const cols = parseInt(colMatch[1], 10);
            const w    = cols * 100 + (cols - 1) * 8;
            document.getElementById('allegiance-assign-modal').querySelector('.modal-content').style.width = w + 'px';
        }
    });

    const visAllCb = document.getElementById('allegiance-vis-all-check');
    if (visAllCb) {
        visAllCb.addEventListener('change', () => {
            const show = visAllCb.checked;
            (window.allegianceDefinitions || []).forEach(def => { def.visible = show; });
            if (window.dbManager) window.dbManager.saveAllegianceDefinitions?.();
            document.querySelectorAll('#allegiance-window-list .border-row').forEach(row => {
                const eye = row.querySelector('.alleg-eye-btn');
                if (eye) {
                    eye.classList.toggle('fa-eye', show);
                    eye.classList.toggle('fa-eye-slash', !show);
                    eye.style.color = show ? '#45a29e' : '#666';
                    eye.title = show ? 'Disable allegiance' : 'Enable allegiance';
                }
                row.style.opacity = show ? '1' : '0.45';
            });
            visAllCb.indeterminate = false;
            requestAnimationFrame(draw);
        });
    }

    if (!window.allegianceDefinitions)    window.allegianceDefinitions    = getDefaultAllegianceDefinitions();
    if (!window.hexAllegianceAssignments) window.hexAllegianceAssignments = new Map();
}
