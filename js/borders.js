// ============================================================================
// BORDERS.JS - Border Manager UI & Import
// ============================================================================

// Maps common CSS/TravellerMap color name strings to in-app hex colors.
const BORDER_COLOR_MAP = {
    'red':       '#e63946', 'crimson':   '#dc143c', 'darkred':   '#8b0000',
    'orange':    '#f4a261', 'gold':      '#ffd700', 'amber':     '#ffbf00',
    'yellow':    '#e9c46a', 'olive':     '#808000',
    'green':     '#06d6a0', 'lime':      '#32cd32', 'darkgreen': '#006400',
    'teal':      '#2a9d8f', 'cyan':      '#00e5ff', 'aqua':      '#00e5ff',
    'blue':      '#4cc9f0', 'navy':      '#003580', 'darkblue':  '#00008b',
    'purple':    '#7209b7', 'violet':    '#8a2be2', 'indigo':    '#4b0082',
    'magenta':   '#e040fb', 'fuchsia':   '#ff00ff',
    'pink':      '#f72585', 'hotpink':   '#ff69b4', 'rose':      '#ff007f',
    'brown':     '#a0522d', 'maroon':    '#800000', 'sienna':    '#a0522d',
    'white':     '#ffffff', 'silver':    '#c0c0c0',
    'gray':      '#888888', 'grey':      '#888888', 'darkgray':  '#555555',
    'black':     '#333333',
};

const BORDER_COLOR_CYCLE = [
    '#e63946','#f4a261','#e9c46a','#2a9d8f','#4cc9f0','#7209b7','#f72585','#06d6a0',
    '#ffffff','#ff6b35','#b5e48c','#0077b6','#9d4edd','#ffbe0b','#d62828','#52b788',
    '#c77dff','#3a86ff','#fb8500','#a8dadc',
];

function getDefaultBorderDefinitions() {
    return [
        { id:  1, name: 'Border 1',  color: '#e63946', visible: true },
        { id:  2, name: 'Border 2',  color: '#f4a261', visible: true },
        { id:  3, name: 'Border 3',  color: '#e9c46a', visible: true },
        { id:  4, name: 'Border 4',  color: '#2a9d8f', visible: true },
        { id:  5, name: 'Border 5',  color: '#4cc9f0', visible: true },
        { id:  6, name: 'Border 6',  color: '#7209b7', visible: true },
        { id:  7, name: 'Border 7',  color: '#f72585', visible: true },
        { id:  8, name: 'Border 8',  color: '#06d6a0', visible: true },
        { id:  9, name: 'Border 9',  color: '#ffffff', visible: true },
        { id: 10, name: 'Border 10', color: '#ff6b35', visible: true },
        { id: 11, name: 'Border 11', color: '#b5e48c', visible: true },
        { id: 12, name: 'Border 12', color: '#0077b6', visible: true },
        { id: 13, name: 'Border 13', color: '#9d4edd', visible: true },
        { id: 14, name: 'Border 14', color: '#ffbe0b', visible: true },
        { id: 15, name: 'Border 15', color: '#d62828', visible: true },
        { id: 16, name: 'Border 16', color: '#52b788', visible: true },
        { id: 17, name: 'Border 17', color: '#c77dff', visible: true },
        { id: 18, name: 'Border 18', color: '#3a86ff', visible: true },
        { id: 19, name: 'Border 19', color: '#fb8500', visible: true },
        { id: 20, name: 'Border 20', color: '#a8dadc', visible: true },
    ];
}

window.ensureFreeBorderSlot = function () {
    if (!window.borderDefinitions) window.borderDefinitions = getDefaultBorderDefinitions();
    if (!window.borderPaths)       window.borderPaths       = new Map();
    const assignments = window.hexBorderAssignments
        ? [...window.hexBorderAssignments.values()] : [];
    const free = window.borderDefinitions.find(d =>
        (!d.allegianceCodes || d.allegianceCodes.length === 0) &&
        !d.allegiance &&
        !assignments.includes(d.id) &&
        !window.borderPaths.has(d.id)
    );
    if (free) return false;
    const nextId = window.borderDefinitions.length > 0
        ? Math.max(...window.borderDefinitions.map(d => d.id)) + 1 : 1;
    window.borderDefinitions.push({
        id:      nextId,
        name:    `Border ${nextId}`,
        color:   BORDER_COLOR_CYCLE[(nextId - 1) % BORDER_COLOR_CYCLE.length],
        visible: true,
    });
    if (window.dbManager) window.dbManager.saveBorderDefinitions?.();
    return true;
};

window.renderBorderWindow = function () {
    const list = document.getElementById('border-window-list');
    if (!list) return;
    list.innerHTML = '';

    const allDefaults = getDefaultBorderDefinitions();
    let padded = false;
    while (window.borderDefinitions.length < 10) {
        const nextId = window.borderDefinitions.length + 1;
        const def = allDefaults.find(d => d.id === nextId);
        window.borderDefinitions.push(def || { id: nextId, name: `Border ${nextId}`, color: '#ffffff', visible: true });
        padded = true;
    }
    if (padded && window.dbManager) window.dbManager.saveBorderDefinitions?.();

    const hexCounts = new Map();
    (window.hexBorderAssignments || new Map()).forEach((borderId) => {
        hexCounts.set(borderId, (hexCounts.get(borderId) || 0) + 1);
    });

    const defs = window.borderDefinitions;
    defs.forEach((def) => {
        const hexCount = hexCounts.get(def.id) || 0;
        const hexClass = hexCount > 0 ? 'used' : 'free';
        const hexLabel = hexCount > 0 ? String(hexCount) : '—';

        const row = document.createElement('div');
        row.className = 'border-row';
        row.dataset.borderId = def.id;
        row.innerHTML = `
            <span class="border-num">#${def.id}</span>
            <span class="border-hex-count ${hexClass}" title="${hexCount} hex(es)">${hexLabel}</span>
            <input type="text" class="border-name-input" value="${def.name.replace(/"/g, '&quot;')}" title="Border name" />
            <input type="color" class="border-color-swatch" value="${def.color}" title="Border color" />
            <label class="border-vis-label"><input type="checkbox" class="border-visible-check" ${def.visible ? 'checked' : ''}> Vis</label>
            <button class="border-clear-btn" title="Remove all hex assignments for this border">C</button>
        `;

        const nameIn   = row.querySelector('.border-name-input');
        const colorIn  = row.querySelector('.border-color-swatch');
        const visIn    = row.querySelector('.border-visible-check');
        const clearBtn = row.querySelector('.border-clear-btn');

        nameIn.addEventListener('change', () => {
            def.name = nameIn.value;
            if (window.dbManager) window.dbManager.saveBorderDefinitions?.();
        });

        colorIn.addEventListener('input', () => {
            def.color = colorIn.value;
            if (window.dbManager) window.dbManager.saveBorderDefinitions?.();
            requestAnimationFrame(draw);
        });

        visIn.addEventListener('change', () => {
            def.visible = visIn.checked;
            if (window.dbManager) window.dbManager.saveBorderDefinitions?.();
            // Keep "Show All" header checkbox in sync
            const allCb = document.getElementById('border-vis-all-check');
            if (allCb) {
                const defs2 = window.borderDefinitions || [];
                const vis2 = defs2.filter(d => d.visible).length;
                allCb.indeterminate = vis2 > 0 && vis2 < defs2.length;
                allCb.checked       = vis2 === defs2.length;
            }
            requestAnimationFrame(draw);
        });

        clearBtn.addEventListener('click', () => {
            const count = hexCounts.get(def.id) || 0;
            if (count === 0) { showToast(`Border #${def.id} has no hexes to clear.`, 2000); return; }
            if (!confirm(`Clear all ${count} hex assignment(s) for "${def.name}"?`)) return;
            if (window.hexBorderAssignments) {
                window.hexBorderAssignments.forEach((bId, hexId) => {
                    if (bId === def.id) window.hexBorderAssignments.delete(hexId);
                });
            }
            if (window.borderPaths) window.borderPaths.delete(def.id);
            if (window.dbManager) window.dbManager.saveBorderAssignments?.();
            requestAnimationFrame(draw);
            window.renderBorderWindow();
            showToast(`Cleared all hexes for "${def.name}".`, 2000);
        });

        list.appendChild(row);
    });

    // Sync the "Show All" header checkbox to the current visibility state.
    const visAllCb = document.getElementById('border-vis-all-check');
    if (visAllCb) {
        const defs = window.borderDefinitions || [];
        const visCount = defs.filter(d => d.visible).length;
        visAllCb.indeterminate = visCount > 0 && visCount < defs.length;
        visAllCb.checked       = visCount === defs.length;
    }
};

window.toggleBorderWindow = function () {
    const win = document.getElementById('border-window');
    if (!win) return;
    if (win.classList.contains('visible')) {
        window.closeBorderWindow();
    } else {
        window.renderBorderWindow();
        win.classList.add('visible');
    }
};

window.closeBorderWindow = function () {
    const win = document.getElementById('border-window');
    if (win) win.classList.remove('visible');
};

window.refreshBorderWindowCounts = function () {
    const win = document.getElementById('border-window');
    if (!win || !win.classList.contains('visible')) return;

    const hexCounts = new Map();
    (window.hexBorderAssignments || new Map()).forEach((borderId) => {
        hexCounts.set(borderId, (hexCounts.get(borderId) || 0) + 1);
    });

    document.querySelectorAll('#border-window-list .border-row').forEach(row => {
        const borderId = parseInt(row.dataset.borderId, 10);
        const pill = row.querySelector('.border-hex-count');
        if (!pill) return;
        const count = hexCounts.get(borderId) || 0;
        pill.className = `border-hex-count ${count > 0 ? 'used' : 'free'}`;
        pill.textContent = count > 0 ? String(count) : '—';
        pill.title = `${count} hex(es)`;
    });
};

window.openAssignBorderModal = function () {
    document.getElementById('context-menu').classList.remove('visible');
    const count = selectedHexes.size;
    if (count === 0) { showToast('No hexes selected.', 2000); return; }

    document.getElementById('border-assign-modal-count').textContent = count;

    const grid = document.getElementById('border-assign-grid');
    grid.innerHTML = '';

    // "Clear Border" option at the top of the list
    const clearBtn = document.createElement('button');
    clearBtn.className = 'border-assign-btn';
    clearBtn.style.color       = '#888888';
    clearBtn.style.borderColor = '#888888';
    clearBtn.innerHTML = `<span class="border-assign-num">✕</span>`
                       + `<span class="border-assign-name">Clear Border</span>`;
    clearBtn.addEventListener('click', () => {
        const hexList = [...selectedHexes];
        saveHistoryState('Clear Border');
        hexList.forEach(hexId => {
            if (window.hexBorderAssignments) window.hexBorderAssignments.delete(hexId);
        });
        if (window.dbManager) window.dbManager.saveBorderAssignments?.();
        document.getElementById('border-assign-modal').style.display = 'none';
        window.renderBorderWindow();
        requestAnimationFrame(draw);
        showToast(`Border cleared for ${hexList.length} hex(es).`, 2500);
    });
    grid.appendChild(clearBtn);

    const defs = window.borderDefinitions || getDefaultBorderDefinitions();
    defs.forEach(def => {
        const btn = document.createElement('button');
        btn.className = 'border-assign-btn';
        btn.style.color = def.color;
        btn.style.borderColor = def.color;
        btn.innerHTML = `<span class="border-assign-num">#${def.id}</span>`
                      + `<span class="border-assign-name">${def.name}</span>`;
        btn.addEventListener('click', () => window.confirmAssignBorder(def.id));
        grid.appendChild(btn);
    });

    // Expand columns so all items fit within max-height without scrolling.
    // Each button row is ~51px tall; with 8px gap: row pitch ≈ 59px.
    // max-height is 530px → up to 9 rows fit cleanly.
    const BTN_COL_W = 90;  // px per column
    const MAX_ROWS  = 9;
    const total     = defs.length + 1; // +1 for Clear button
    const cols      = Math.max(4, Math.ceil(total / MAX_ROWS));
    grid.style.gridTemplateColumns = `repeat(${cols}, ${BTN_COL_W}px)`;

    const modalContent = document.getElementById('border-assign-modal').querySelector('.modal-content');
    if (cols > 4) {
        modalContent.style.width    = 'max-content';
        modalContent.style.maxWidth = 'calc(100vw - 40px)';
    } else {
        modalContent.style.width    = '360px';
        modalContent.style.maxWidth = '';
    }

    document.getElementById('border-assign-modal').style.display = 'flex';
};

window.confirmAssignBorder = function (borderId) {
    const hexList = [...selectedHexes];
    saveHistoryState('Assign Border');
    if (window.borderPaths) window.borderPaths.delete(borderId);
    hexList.forEach(hexId => {
        window.hexBorderAssignments.set(hexId, borderId);
    });
    if (window.dbManager) window.dbManager.saveBorderAssignments?.();
    document.getElementById('border-assign-modal').style.display = 'none';
    window.ensureFreeBorderSlot();
    window.renderBorderWindow();
    requestAnimationFrame(draw);
    const def = (window.borderDefinitions || []).find(d => d.id === borderId);
    const name = def ? def.name : `Border #${borderId}`;
    showToast(`${hexList.length} hex(es) assigned to "${name}".`, 2500);
};

// ============================================================================
// BORDER IMPORT FROM XML
// ============================================================================

/**
 * Parse a <Borders> DOM element from a TravellerMap metadata XML and append
 * polygon paths to window.borderPaths, grouped by Allegiance attribute.
 *
 * @param {Element} bordersElement  - The <Borders> DOM element.
 * @param {number}  slotNum         - Numeric sector slot for coord conversion.
 * @returns {{ assigned: Array, skipped: Array }}
 */
window.importBordersFromXml = function (bordersElement, slotNum) {
    const assigned = []; // { label, slotId, hexCount }
    const skipped  = []; // { allegianceCode, reason }

    if (!bordersElement) return { assigned, skipped };

    // ── Inline coord helper (mirrors otu_metadata_parser.js) ──────────────
    function _subChar(hexCode) {
        const v    = parseInt(hexCode, 10);
        const lQ   = Math.floor(v / 100);
        const lR   = v % 100;
        const subX = Math.floor((lQ - 1) / 8);
        const subY = Math.floor((lR - 1) / 10);
        return String.fromCharCode(65 + (subY * 4 + subX));
    }
    function _hexIdOf(code) { return `${slotNum}-${_subChar(code)}-${code}`; }

    // Returns the 6 neighbour [q,r] pairs for a flat-top odd-q offset grid.
    function _hexNeighbors(q, r) {
        const p = q & 1;
        return [
            [q + 1, r + (p ? 1 : 0)],
            [q,     r + 1           ],
            [q - 1, r + (p ? 1 : 0)],
            [q - 1, r + (p ? 0 :-1)],
            [q,     r - 1           ],
            [q + 1, r + (p ? 0 :-1)],
        ];
    }
    // Inverse of getHexCoords — converts global (q,r) back to a hexId string.
    function _qrToHexId(q, r) {
        const sX  = Math.floor(q / 32);
        const sY  = Math.floor(r / 40);
        const lQ  = q % 32;
        const lR  = r % 40;
        const sub = String.fromCharCode(65 + (Math.floor(lR / 10) * 4 + Math.floor(lQ / 8)));
        return `${sY * gridWidth + sX + 1}-${sub}-${String(lQ + 1).padStart(2, '0')}${String(lR + 1).padStart(2, '0')}`;
    }

    // ── Normalize allegiance for BFS expansion only (major polity family codes) ─
    // NOT used for grouping <Border> elements — label-first grouping handles that.
    function _normalizeAlleg(code) {
        if (code.startsWith('Im')) return 'Im';
        if (code.startsWith('As')) return 'As';
        if (code.startsWith('Zh')) return 'Zh';
        if (code.startsWith('Va')) return 'Va';
        if (code.startsWith('Kk')) return 'Kk';
        if (code.startsWith('Hv')) return 'Hv';
        if (code.startsWith('So')) return 'So';
        return code;
    }

    // ── Group <Border> elements by Label (when present) or raw allegiance ──
    // Label-first: <Border Label="Third Imperium"> and <Border Label="Vegan Autonomous District">
    // each get their own slot even though both carry Im* allegiance codes.
    const borderEls = Array.from(bordersElement.querySelectorAll('Border'));
    const byGroup   = new Map(); // groupKey (label || allegianceCode) → [ {el, allegianceCode, color, labelPos} ]

    borderEls.forEach(el => {
        const allegianceCode = (el.getAttribute('Allegiance') || '').trim();
        const label          = (el.getAttribute('Label')      || '').trim();
        const groupKey       = label || allegianceCode;
        if (!groupKey) return;
        const color    = (el.getAttribute('Color')         || '').trim().toLowerCase();
        const labelPos = (el.getAttribute('LabelPosition') || '').trim();
        if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
        byGroup.get(groupKey).push({ el, allegianceCode, color, labelPos });
    });

    if (byGroup.size === 0) return { assigned, skipped };

    // ── Ensure global state exists ─────────────────────────────────────────
    if (!window.borderDefinitions) window.borderDefinitions = getDefaultBorderDefinitions();
    if (!window.borderPaths)       window.borderPaths       = new Map();

    // ── Process each label/allegiance group ───────────────────────────────
    byGroup.forEach((items, groupKey) => {
        // 1. Find an existing slot already claimed by this group key.
        // Check name (handles label-keyed groups) AND allegianceCodes array (handles
        // code-keyed groups whose name was later changed to an English description).
        let def = window.borderDefinitions.find(d =>
            d.name === groupKey ||
            (d.allegianceCodes && d.allegianceCodes.includes(groupKey))
        );
        let isNewSlot = false;

        // 2. If none, find the next free slot
        if (!def) {
            def = window.borderDefinitions.find(d =>
                (!d.allegianceCodes || d.allegianceCodes.length === 0) &&
                !d.allegiance &&
                !(window.hexBorderAssignments && [...window.hexBorderAssignments.values()].includes(d.id)) &&
                !window.borderPaths.has(d.id)
            );
            isNewSlot = !!def;
        }

        // 3. No slot available — create one dynamically so imports never hit a cap.
        if (!def) {
            const nextId = window.borderDefinitions.length > 0
                ? Math.max(...window.borderDefinitions.map(d => d.id)) + 1
                : 1;
            def = {
                id:      nextId,
                name:    `Border ${nextId}`,
                color:   BORDER_COLOR_CYCLE[(nextId - 1) % BORDER_COLOR_CYCLE.length],
                visible: true,
            };
            window.borderDefinitions.push(def);
            isNewSlot = true;
        }

        // 4. Claim slot if new
        if (isNewSlot) {
            // groupKey is either the Label attribute (human-readable) or the raw
            // allegiance code (when no Label was present).  When it's a raw code,
            // look up the English description from <Allegiance Code="X"> in the XML.
            def.name = groupKey;
            const primaryAllegCode = items.length > 0 ? items[0].allegianceCode : null;
            if (primaryAllegCode && primaryAllegCode === groupKey) {
                const allegianceEl = bordersElement.ownerDocument &&
                    bordersElement.ownerDocument.querySelector(`Allegiance[Code="${primaryAllegCode}"]`);
                if (allegianceEl) {
                    const english = allegianceEl.textContent.trim();
                    if (english) def.name = english;
                }
            }

            // Color: first recognisable color found, applied only when slot is new.
            // Accepts both CSS name strings (mapped via BORDER_COLOR_MAP) and raw
            // hex codes (#rrggbb) so round-tripped exports survive re-import.
            const colorItem = items.find(it => it.color && (it.color.startsWith('#') || BORDER_COLOR_MAP[it.color]));
            if (colorItem) def.color = colorItem.color.startsWith('#') ? colorItem.color : BORDER_COLOR_MAP[colorItem.color];
        }

        // 5. Accumulate raw allegiance codes seen for this group (enables BFS expansion)
        if (!def.allegianceCodes) def.allegianceCodes = [];
        items.forEach(it => {
            if (it.allegianceCode && !def.allegianceCodes.includes(it.allegianceCode)) {
                def.allegianceCodes.push(it.allegianceCode);
            }
        });

        // 6. Process each <Border> element independently so each can use its own
        //    LabelPosition as the flood-fill seed, correctly orienting the fill
        //    even for sector-spanning borders and detached island territories.
        const secX    = (slotNum - 1) % gridWidth;
        const secY    = Math.floor((slotNum - 1) / gridWidth);
        const secMinQ = secX * 32, secMaxQ = secX * 32 + 31;
        const secMinR = secY * 40, secMaxR = secY * 40 + 39;

        let totalBoundaryCount = 0;

        items.forEach(({ el, allegianceCode: itemAllegCode, labelPos }) => {
            const seen               = new Set();
            const boundaryHexIds     = [];
            const boundaryCoords     = [];
            const boundaryIsAfterGap = []; // true when off-sector codes preceded this waypoint
            // Track which dimensions had adjacent-sector codes filtered so the
            // flood-fill leak threshold can be expanded to the sector edge in
            // those dimensions (the sector wall is the true closure there).
            let hadColLo = false, hadColHi = false;
            let hadRowLo = false, hadRowHi = false;
            let hadGapBefore = false; // off-sector codes seen since last in-sector waypoint

            const raw = (el.textContent || '').trim();
            if (!raw) return;

            // Store original polygon path for round-trip metadata export.
            if (!window.borderPaths.has(def.id)) window.borderPaths.set(def.id, []);
            window.borderPaths.get(def.id).push({ rawPath: raw, labelPos, allegianceCode: itemAllegCode });
            raw.split(/\s+/).forEach(code => {
                if (code.length !== 4 || seen.has(code)) return;
                // Skip adjacent-sector codes (col 00, col 33+, row 00, row 41+).
                // TravellerMap XML closes polygons across sector edges using these codes;
                // the sector boundary itself acts as the natural wall instead.
                const codeV  = parseInt(code, 10);
                const codeLQ = Math.floor(codeV / 100);
                const codeLR = codeV % 100;
                if (codeLQ < 1 || codeLQ > 32 || codeLR < 1 || codeLR > 40) {
                    if (codeLQ < 1)  hadColLo = true;
                    if (codeLQ > 32) hadColHi = true;
                    if (codeLR < 1)  hadRowLo = true;
                    if (codeLR > 40) hadRowHi = true;
                    hadGapBefore = true;
                    return;
                }
                seen.add(code);
                const hexId = _hexIdOf(code);
                const c     = getHexCoords(hexId);
                if (!c) return;
                boundaryHexIds.push(hexId);
                boundaryCoords.push(c);
                boundaryIsAfterGap.push(hadGapBefore);
                hadGapBefore = false;
            });

            if (boundaryCoords.length === 0) {
                // All hex codes were adjacent-sector codes — the entire sector is the interior.
                if (!hadColLo && !hadColHi && !hadRowLo && !hadRowHi) return;
                let wsQ = secMinQ + 15, wsR = secMinR + 19;
                if (labelPos && labelPos.length === 4) {
                    const lpV  = parseInt(labelPos, 10);
                    const lpLQ = Math.floor(lpV / 100);
                    const lpLR = lpV % 100;
                    if (lpLQ >= 1 && lpLQ <= 32 && lpLR >= 1 && lpLR <= 40) {
                        const lpCoords = getHexCoords(_hexIdOf(labelPos));
                        if (lpCoords) { wsQ = lpCoords.q; wsR = lpCoords.r; }
                    }
                }
                const wsVisited = new Set([`${wsQ},${wsR}`]);
                const wsQueue   = [[wsQ, wsR]];
                const wsInter   = [];
                while (wsQueue.length > 0) {
                    const [q, r] = wsQueue.shift();
                    wsInter.push([q, r]);
                    _hexNeighbors(q, r).forEach(([nq, nr]) => {
                        const k = `${nq},${nr}`;
                        if (!wsVisited.has(k)) {
                            wsVisited.add(k);
                            if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                                wsQueue.push([nq, nr]);
                            }
                        }
                    });
                }
                wsInter.forEach(([q, r]) => {
                    window.hexBorderAssignments.set(_qrToHexId(q, r), def.id);
                });
                totalBoundaryCount += wsInter.length;
                return;
            }
            totalBoundaryCount += boundaryHexIds.length;

            const boundaryQR = new Set(boundaryCoords.map(({ q, r }) => `${q},${r}`));

            // Bounding box of the boundary.
            let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
            boundaryCoords.forEach(({ q, r }) => {
                if (q < minQ) minQ = q;  if (q > maxQ) maxQ = q;
                if (r < minR) minR = r;  if (r > maxR) maxR = r;
            });

            // ── Seal waypoint gaps with straight hex lines ────────────────────────
            // TravellerMap border codes are sparse navigation waypoints, not every
            // hex along the border.  For sparse territories (e.g. Riftspan Reaches
            // Aslan) the gaps between consecutive codes allow the flood-fill to leak
            // immediately.  Drawing a straight hex line between each consecutive pair
            // seals those gaps so the fill correctly covers the enclosed interior.
            // The closing segment (last→first waypoint) is skipped when the polygon
            // closes via sector edges (had* flags set); the sector wall provides that
            // closure and a direct closing line could bisect the interior.
            // Pairs separated by off-sector codes (boundaryIsAfterGap) are also
            // skipped — the sector edge bridges those transitions and a direct line
            // would bisect the interior (e.g. Verge Imperial, Riftspan Aslan).
            {
                const closeLoop = !(hadColLo || hadColHi || hadRowLo || hadRowHi);
                const n         = boundaryCoords.length;
                const segments  = closeLoop ? n : n - 1;
                for (let i = 0; i < segments; i++) {
                    const nextIdx = (i + 1) % n;
                    if (boundaryIsAfterGap[nextIdx]) continue;
                    const { q: q1, r: r1 } = boundaryCoords[i];
                    const { q: q2, r: r2 } = boundaryCoords[nextIdx];
                    const s1   = -q1 - r1;
                    const s2   = -q2 - r2;
                    const dist = Math.max(Math.abs(q2 - q1), Math.abs(r2 - r1), Math.abs(s2 - s1));
                    for (let step = 1; step < dist; step++) {
                        const t  = step / dist;
                        const lq = q1 + (q2 - q1) * t;
                        const lr = r1 + (r2 - r1) * t;
                        const ls = s1 + (s2 - s1) * t;
                        let rq = Math.round(lq), rr = Math.round(lr), rs = Math.round(ls);
                        const dq = Math.abs(rq - lq), dr = Math.abs(rr - lr), ds = Math.abs(rs - ls);
                        if (dq > dr && dq > ds) rq = -rr - rs;
                        else if (dr > ds)       rr = -rq - rs;
                        if (rq < secMinQ || rq > secMaxQ || rr < secMinR || rr > secMaxR) continue;
                        const k = `${rq},${rr}`;
                        if (boundaryQR.has(k)) continue;
                        boundaryQR.add(k);
                        boundaryHexIds.push(_qrToHexId(rq, rr));
                    }
                }
            }

            // Build candidate seeds in priority order; try each until one doesn't leak.
            //
            // 1. LabelPosition — reliable when it falls inside the territory, but
            //    TravellerMap sometimes places it on the boundary or just outside.
            // 2. Corner probe — when the polygon closes via two sector edges forming
            //    a corner (e.g. hadColLo + hadRowLo → top-left), the sector corner
            //    is always inside the enclosed territory.  BFS outward from that
            //    corner to find the nearest non-boundary hex.
            // 3. Centroid probe — last resort; fans out from the average waypoint
            //    position and takes the first non-boundary neighbor found.
            const candidateSeeds = [];

            if (labelPos && labelPos.length === 4) {
                const lpV  = parseInt(labelPos, 10);
                const lpLQ = Math.floor(lpV / 100);
                const lpLR = lpV % 100;
                if (lpLQ >= 1 && lpLQ <= 32 && lpLR >= 1 && lpLR <= 40) {
                    const lpCoords = getHexCoords(_hexIdOf(labelPos));
                    if (lpCoords && !boundaryQR.has(`${lpCoords.q},${lpCoords.r}`)) {
                        candidateSeeds.push([lpCoords.q, lpCoords.r]);
                    }
                }
            }

            if ((hadColLo || hadColHi) && (hadRowLo || hadRowHi)) {
                const cornerQ = hadColLo ? secMinQ : secMaxQ;
                const cornerR = hadRowLo ? secMinR : secMaxR;
                const cProbe  = [[cornerQ, cornerR]];
                const cProbed = new Set([`${cornerQ},${cornerR}`]);
                let csQ = null, csR = null;
                for (let i = 0; i < cProbe.length; i++) {
                    const [pq, pr] = cProbe[i];
                    if (!boundaryQR.has(`${pq},${pr}`)) { csQ = pq; csR = pr; break; }
                    if (i < 50) {
                        _hexNeighbors(pq, pr).forEach(([nq, nr]) => {
                            if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                                const k = `${nq},${nr}`;
                                if (!cProbed.has(k)) { cProbed.add(k); cProbe.push([nq, nr]); }
                            }
                        });
                    }
                }
                if (csQ !== null) candidateSeeds.push([csQ, csR]);
            }

            {
                const avgQ   = Math.round(boundaryCoords.reduce((s, c) => s + c.q, 0) / boundaryCoords.length);
                const avgR   = Math.round(boundaryCoords.reduce((s, c) => s + c.r, 0) / boundaryCoords.length);
                const probe  = [[avgQ, avgR]];
                const probed = new Set([`${avgQ},${avgR}`]);
                let csQ = null, csR = null;
                for (let i = 0; i < probe.length; i++) {
                    const [pq, pr] = probe[i];
                    if (!boundaryQR.has(`${pq},${pr}`)) { csQ = pq; csR = pr; break; }
                    if (i < 50) {
                        _hexNeighbors(pq, pr).forEach(([nq, nr]) => {
                            const k = `${nq},${nr}`;
                            if (!probed.has(k)) { probed.add(k); probe.push([nq, nr]); }
                        });
                    }
                }
                if (csQ !== null) candidateSeeds.push([csQ, csR]);
            }

            // BFS flood-fill with leak detection.
            // If the fill reaches 1 hex outside the bounding box the boundary is
            // not closed (e.g. a small spur cluster with no interior) — discard.
            // When adjacent-sector codes were filtered for a dimension the sector
            // edge is the true closure, so expand the leak threshold to match.
            const eMinQ = hadColLo ? secMinQ - 1 : minQ - 1;
            const eMaxQ = hadColHi ? secMaxQ + 1 : maxQ + 1;
            const eMinR = hadRowLo ? secMinR - 1 : minR - 1;
            const eMaxR = hadRowHi ? secMaxR + 1 : maxR + 1;

            let filled = false;
            for (const [seedQ, seedR] of candidateSeeds) {
                const visited  = new Set(boundaryQR);
                const interior = [];
                let leaked = false;

                visited.add(`${seedQ},${seedR}`);
                const queue = [[seedQ, seedR]];

                while (queue.length > 0 && !leaked) {
                    const [q, r] = queue.shift();
                    if (q <= eMinQ || q >= eMaxQ || r <= eMinR || r >= eMaxR) {
                        leaked = true;
                        break;
                    }
                    interior.push([q, r]);
                    _hexNeighbors(q, r).forEach(([nq, nr]) => {
                        const k = `${nq},${nr}`;
                        if (!visited.has(k)) {
                            visited.add(k);
                            // Sector boundary is the natural wall for this border's flood-fill.
                            if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                                queue.push([nq, nr]);
                            }
                        }
                    });
                }

                if (!leaked) {
                    interior.forEach(([q, r]) => {
                        window.hexBorderAssignments.set(_qrToHexId(q, r), def.id);
                    });
                    // Boundary hexes are part of the territory; assign them too so they
                    // don't appear as unassigned rings inside the filled region.
                    boundaryHexIds.forEach(hId => window.hexBorderAssignments.set(hId, def.id));
                    filled = true;
                    break;
                }
            }

            if (!filled) {
                // All seeds leaked (open boundary or single-hex marker): fall back to
                // assigning the boundary hexes themselves so something is visible.
                boundaryHexIds.forEach(hId => window.hexBorderAssignments.set(hId, def.id));
            }

            // Second pass: fill isolated interior pockets the LabelPosition-seed fill
            // missed.  Sparse polygon boundaries can create disconnected chambers when
            // boundary hexes form a wall that cuts the interior into pieces unreachable
            // from a single seed.  Scan every hex in the expanded bounding box; any
            // unvisited hex that produces a non-leaking fill is an isolated pocket that
            // belongs to this border.  Each connected component is processed exactly
            // once — patchedSoFar accumulates all explored hexes so no hex is retried.
            if (filled) {
                const patchedSoFar = new Set(boundaryQR);
                for (let pq = eMinQ + 1; pq <= eMaxQ - 1; pq++) {
                    for (let pr = eMinR + 1; pr <= eMaxR - 1; pr++) {
                        if (patchedSoFar.has(`${pq},${pr}`)) continue;
                        const pWall     = new Set(boundaryQR);
                        const pQueue    = [[pq, pr]];
                        const pInterior = [];
                        let   pLeaked   = false;
                        pWall.add(`${pq},${pr}`);
                        while (pQueue.length > 0 && !pLeaked) {
                            const [q2, r2] = pQueue.shift();
                            if (q2 <= eMinQ || q2 >= eMaxQ || r2 <= eMinR || r2 >= eMaxR) {
                                pLeaked = true;
                                break;
                            }
                            pInterior.push([q2, r2]);
                            _hexNeighbors(q2, r2).forEach(([nq, nr]) => {
                                const nk = `${nq},${nr}`;
                                if (!pWall.has(nk)) {
                                    pWall.add(nk);
                                    if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                                        pQueue.push([nq, nr]);
                                    }
                                }
                            });
                        }
                        if (!pLeaked) {
                            // A true isolated interior pocket is fully enclosed by boundary
                            // hexes and cannot touch a sector edge.  If this component touches
                            // any sector edge it is the exterior of a sector-edge-closing
                            // polygon (e.g. Aslan Hierate NE area above a diagonal boundary),
                            // not a pocket — skip it.
                            const touchesSectorEdge = pInterior.some(
                                ([q2, r2]) => q2 === secMinQ || q2 === secMaxQ || r2 === secMinR || r2 === secMaxR
                            );
                            if (!touchesSectorEdge) {
                                pInterior.forEach(([q2, r2]) => window.hexBorderAssignments.set(_qrToHexId(q2, r2), def.id));
                            }
                        }
                        pWall.forEach(k => { if (!boundaryQR.has(k)) patchedSoFar.add(k); });
                    }
                }
            }
        });

        if (totalBoundaryCount > 0) {
            assigned.push({ label: groupKey, slotId: def.id, hexCount: totalBoundaryCount });
        }
    });

    // ── Post-import allegiance scan (BFS expansion) ───────────────────────────
    // After the polygon fills, expand each border outward through unassigned
    // worlds whose allegiance normalises to the same border slot.  Uses a BFS
    // seeded from the polygon fill frontier so the expansion is bounded — it can
    // only reach worlds connected to the fill through a chain of same-allegiance
    // neighbors.  This correctly pulls in AsSc / AsWc / AsT3 / ImDd / etc. that
    // the flood-fill missed, while leaving genuinely isolated worlds (no path
    // back to the polygon fill) unassigned.
    //
    // _normalizeAlleg handles the major/minor split automatically:
    //   • major polities  → 2-letter code  (AsWc→As, ImDd→Im, VaDr→Va, …)
    //   • minor polities  → full 4-letter  (CaPr stays CaPr, NaHu stays NaHu, …)
    if (window.hexStates) {
        // Build candidate map: unassigned worlds in this sector with a matching slot.
        const candidates = new Map(); // hexId → borderId
        window.hexStates.forEach((state, hexId) => {
            if (parseInt(hexId.split('-')[0], 10) !== slotNum) return;
            if (!state || state.type !== 'SYSTEM_PRESENT') return;
            const rawAlleg = (state.allegiance || '').trim();
            if (!rawAlleg || rawAlleg === '----') return;
            const norm = _normalizeAlleg(rawAlleg);
            const matchDef = window.borderDefinitions.find(d => {
                if (!d.allegianceCodes && !d.allegiance) return false;
                // Priority 1: exact raw allegiance code in slot's known codes
                if (d.allegianceCodes && d.allegianceCodes.includes(rawAlleg)) return true;
                // Priority 2: normalized match (e.g. ImSy → Im matches ImDd → Im)
                if (d.allegianceCodes && d.allegianceCodes.some(c => _normalizeAlleg(c) === norm)) return true;
                // Priority 3: backwards compat with old single-string allegiance field
                if (d.allegiance && _normalizeAlleg(d.allegiance) === norm) return true;
                return false;
            });
            if (matchDef && !window.hexBorderAssignments.has(hexId)) {
                candidates.set(hexId, matchDef.id);
            }
        });

        if (candidates.size > 0) {
            // Seed the BFS with candidates already adjacent to the polygon fill.
            const queue = [];
            candidates.forEach((borderId, hexId) => {
                const c = getHexCoords(hexId);
                if (!c) return;
                const seeded = _hexNeighbors(c.q, c.r).some(
                    ([nq, nr]) => window.hexBorderAssignments.get(_qrToHexId(nq, nr)) === borderId
                );
                if (seeded) queue.push(hexId);
            });

            // BFS: each assigned world unlocks its same-allegiance candidate neighbors.
            let qi = 0;
            while (qi < queue.length) {
                const hexId = queue[qi++];
                if (window.hexBorderAssignments.has(hexId)) continue; // already handled
                const borderId = candidates.get(hexId);
                if (borderId === undefined) continue;
                window.hexBorderAssignments.set(hexId, borderId);
                const c = getHexCoords(hexId);
                if (!c) continue;
                _hexNeighbors(c.q, c.r).forEach(([nq, nr]) => {
                    const nId = _qrToHexId(nq, nr);
                    if (candidates.has(nId) &&
                        candidates.get(nId) === borderId &&
                        !window.hexBorderAssignments.has(nId)) {
                        queue.push(nId);
                    }
                });
            }
        }
    }

    window.ensureFreeBorderSlot();
    if (typeof window.renderBorderWindow === 'function') {
        window.renderBorderWindow();
    }
    if (window.dbManager) {
        window.dbManager.saveBorderDefinitions?.();
        window.dbManager.saveBorderAssignments?.();
        window.dbManager.saveBorderPaths?.();
    }

    return { assigned, skipped };
};

// ============================================================================
// REGION IMPORT FROM XML
// ============================================================================

/**
 * Parse a <Regions> DOM element from a TravellerMap metadata XML and assign
 * the region Label to every hex inside each Region polygon (stateObj.cluster).
 * Also upserts a bgFillColor filter rule for each region.
 *
 * Uses the same waypoint-path + BFS flood-fill algorithm as importBordersFromXml.
 *
 * @param {Element} regionsElement - The <Regions> DOM element.
 * @param {number}  slotNum        - Numeric sector slot for coord conversion.
 * @returns {{ assigned: Array, skipped: Array }}
 */
window.importRegionsFromXml = function (regionsElement, slotNum) {
    const assigned = []; // { label, hexCount }
    const skipped  = []; // { label, reason }

    if (!window.regionPaths) window.regionPaths = new Map();
    if (!regionsElement) return { assigned, skipped };

    // ── Inline coord helpers (mirrors importBordersFromXml) ──────────────────
    function _subChar(hexCode) {
        const v    = parseInt(hexCode, 10);
        const lQ   = Math.floor(v / 100);
        const lR   = v % 100;
        const subX = Math.floor((lQ - 1) / 8);
        const subY = Math.floor((lR - 1) / 10);
        return String.fromCharCode(65 + (subY * 4 + subX));
    }
    function _hexIdOf(code) { return `${slotNum}-${_subChar(code)}-${code}`; }

    function _hexNeighbors(q, r) {
        const p = q & 1;
        return [
            [q + 1, r + (p ? 1 : 0)],
            [q,     r + 1           ],
            [q - 1, r + (p ? 1 : 0)],
            [q - 1, r + (p ? 0 :-1)],
            [q,     r - 1           ],
            [q + 1, r + (p ? 0 :-1)],
        ];
    }

    function _qrToHexId(q, r) {
        const sX  = Math.floor(q / 32);
        const sY  = Math.floor(r / 40);
        const lQ  = q % 32;
        const lR  = r % 40;
        const sub = String.fromCharCode(65 + (Math.floor(lR / 10) * 4 + Math.floor(lQ / 8)));
        return `${sY * gridWidth + sX + 1}-${sub}-${String(lQ + 1).padStart(2, '0')}${String(lR + 1).padStart(2, '0')}`;
    }

    // Claim or create a region slot for the given label/color.
    // Mirrors the border slot-claiming pattern so imports populate the Region Manager.
    function _upsertRegionSlot(label, hexColor) {
        if (!window.regionDefinitions) {
            window.regionDefinitions = (typeof getDefaultRegionDefinitions === 'function')
                ? getDefaultRegionDefinitions() : [];
        }
        // Find existing slot by name
        let def = window.regionDefinitions.find(d => d.name === label);
        if (def) {
            def.color = hexColor;
            return;
        }
        // Claim the first default-named free slot (no hex assignments, default name pattern)
        const hexCounts = new Map();
        hexStates.forEach(state => {
            if (state.cluster && state.cluster !== '----') {
                hexCounts.set(state.cluster, (hexCounts.get(state.cluster) || 0) + 1);
            }
        });
        def = window.regionDefinitions.find(d =>
            /^Region \d+$/.test(d.name) && !hexCounts.has(d.name)
        );
        if (def) {
            def.name  = label;
            def.color = hexColor;
            return;
        }
        // No free slot — create one dynamically
        const nextId = window.regionDefinitions.length > 0
            ? Math.max(...window.regionDefinitions.map(d => d.id)) + 1 : 1;
        const CYCLE = typeof REGION_COLOR_CYCLE !== 'undefined' ? REGION_COLOR_CYCLE : ['#888888'];
        window.regionDefinitions.push({
            id:      nextId,
            name:    label,
            color:   hexColor || CYCLE[(nextId - 1) % CYCLE.length],
            visible: true,
        });
    }

    const secX    = (slotNum - 1) % gridWidth;
    const secY    = Math.floor((slotNum - 1) / gridWidth);
    const secMinQ = secX * 32, secMaxQ = secX * 32 + 31;
    const secMinR = secY * 40, secMaxR = secY * 40 + 39;

    const regionEls     = Array.from(regionsElement.querySelectorAll('Region'));
    const affectedHexIds = [];

    if (regionEls.length === 0) return { assigned, skipped };

    regionEls.forEach(el => {
        const label    = (el.getAttribute('Label')         || '').trim();
        const colorStr = (el.getAttribute('Color')         || '').trim().toLowerCase();
        const labelPos = (el.getAttribute('LabelPosition') || '').trim();

        if (!label) {
            skipped.push({ label: '(no label)', reason: 'Missing Label attribute' });
            return;
        }

        const hexColor = colorStr.startsWith('#') ? colorStr : (BORDER_COLOR_MAP[colorStr] || '#888888');

        // ── Parse waypoint path (identical format to <Border>) ────────────────
        const seen               = new Set();
        const boundaryHexIds     = [];
        const boundaryCoords     = [];
        const boundaryIsAfterGap = [];
        let hadColLo = false, hadColHi = false;
        let hadRowLo = false, hadRowHi = false;
        let hadGapBefore = false;

        const raw = (el.textContent || '').trim();
        if (!raw) {
            skipped.push({ label, reason: 'No hex path data' });
            return;
        }

        // Store original polygon path for round-trip metadata export.
        // Key includes slotNum to avoid collisions when multiple sectors are imported.
        window.regionPaths.set(`${slotNum}:${label}`, { rawPath: raw, color: hexColor, labelPos });

        raw.split(/\s+/).forEach(code => {
            if (code.length !== 4 || seen.has(code)) return;
            const codeV  = parseInt(code, 10);
            const codeLQ = Math.floor(codeV / 100);
            const codeLR = codeV % 100;
            if (codeLQ < 1 || codeLQ > 32 || codeLR < 1 || codeLR > 40) {
                if (codeLQ < 1)  hadColLo = true;
                if (codeLQ > 32) hadColHi = true;
                if (codeLR < 1)  hadRowLo = true;
                if (codeLR > 40) hadRowHi = true;
                hadGapBefore = true;
                return;
            }
            seen.add(code);
            const hexId = _hexIdOf(code);
            const c     = getHexCoords(hexId);
            if (!c) return;
            boundaryHexIds.push(hexId);
            boundaryCoords.push(c);
            boundaryIsAfterGap.push(hadGapBefore);
            hadGapBefore = false;
        });

        // ── Whole-sector fill when all codes were off-sector ──────────────────
        if (boundaryCoords.length === 0) {
            if (!hadColLo && !hadColHi && !hadRowLo && !hadRowHi) {
                skipped.push({ label, reason: 'Empty boundary path' });
                return;
            }
            let wsQ = secMinQ + 15, wsR = secMinR + 19;
            if (labelPos.length === 4) {
                const lpV  = parseInt(labelPos, 10);
                const lpLQ = Math.floor(lpV / 100);
                const lpLR = lpV % 100;
                if (lpLQ >= 1 && lpLQ <= 32 && lpLR >= 1 && lpLR <= 40) {
                    const lpCoords = getHexCoords(_hexIdOf(labelPos));
                    if (lpCoords) { wsQ = lpCoords.q; wsR = lpCoords.r; }
                }
            }
            const wsVisited = new Set([`${wsQ},${wsR}`]);
            const wsQueue   = [[wsQ, wsR]];
            let wsCount = 0;
            while (wsQueue.length > 0) {
                const [q, r] = wsQueue.shift();
                const hId = _qrToHexId(q, r);
                const state = hexStates.get(hId);
                if (state) { state.cluster = label; affectedHexIds.push(hId); wsCount++; }
                _hexNeighbors(q, r).forEach(([nq, nr]) => {
                    const k = `${nq},${nr}`;
                    if (!wsVisited.has(k)) {
                        wsVisited.add(k);
                        if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                            wsQueue.push([nq, nr]);
                        }
                    }
                });
            }
            assigned.push({ label, hexCount: wsCount });
            _upsertRegionSlot(label, hexColor);
            return;
        }

        // ── Seal waypoint gaps with straight hex lines ────────────────────────
        const boundaryQR = new Set(boundaryCoords.map(({ q, r }) => `${q},${r}`));
        {
            const closeLoop = !(hadColLo || hadColHi || hadRowLo || hadRowHi);
            const n         = boundaryCoords.length;
            const segments  = closeLoop ? n : n - 1;
            for (let i = 0; i < segments; i++) {
                const nextIdx = (i + 1) % n;
                if (boundaryIsAfterGap[nextIdx]) continue;
                const { q: q1, r: r1 } = boundaryCoords[i];
                const { q: q2, r: r2 } = boundaryCoords[nextIdx];
                const s1   = -q1 - r1;
                const s2   = -q2 - r2;
                const dist = Math.max(Math.abs(q2 - q1), Math.abs(r2 - r1), Math.abs(s2 - s1));
                for (let step = 1; step < dist; step++) {
                    const t  = step / dist;
                    const lq = q1 + (q2 - q1) * t;
                    const lr = r1 + (r2 - r1) * t;
                    const ls = s1 + (s2 - s1) * t;
                    let rq = Math.round(lq), rr = Math.round(lr), rs = Math.round(ls);
                    const dq = Math.abs(rq - lq), dr = Math.abs(rr - lr), ds = Math.abs(rs - ls);
                    if (dq > dr && dq > ds) rq = -rr - rs;
                    else if (dr > ds)       rr = -rq - rs;
                    if (rq < secMinQ || rq > secMaxQ || rr < secMinR || rr > secMaxR) continue;
                    const k = `${rq},${rr}`;
                    if (boundaryQR.has(k)) continue;
                    boundaryQR.add(k);
                    boundaryHexIds.push(_qrToHexId(rq, rr));
                }
            }
        }

        // ── Bounding box ──────────────────────────────────────────────────────
        let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
        boundaryCoords.forEach(({ q, r }) => {
            if (q < minQ) minQ = q;  if (q > maxQ) maxQ = q;
            if (r < minR) minR = r;  if (r > maxR) maxR = r;
        });

        // ── Candidate seeds (LabelPosition → corner probe → centroid) ─────────
        const candidateSeeds = [];

        if (labelPos.length === 4) {
            const lpV  = parseInt(labelPos, 10);
            const lpLQ = Math.floor(lpV / 100);
            const lpLR = lpV % 100;
            if (lpLQ >= 1 && lpLQ <= 32 && lpLR >= 1 && lpLR <= 40) {
                const lpCoords = getHexCoords(_hexIdOf(labelPos));
                if (lpCoords && !boundaryQR.has(`${lpCoords.q},${lpCoords.r}`)) {
                    candidateSeeds.push([lpCoords.q, lpCoords.r]);
                }
            }
        }

        if ((hadColLo || hadColHi) && (hadRowLo || hadRowHi)) {
            const cornerQ = hadColLo ? secMinQ : secMaxQ;
            const cornerR = hadRowLo ? secMinR : secMaxR;
            const cProbe  = [[cornerQ, cornerR]];
            const cProbed = new Set([`${cornerQ},${cornerR}`]);
            let csQ = null, csR = null;
            for (let i = 0; i < cProbe.length; i++) {
                const [pq, pr] = cProbe[i];
                if (!boundaryQR.has(`${pq},${pr}`)) { csQ = pq; csR = pr; break; }
                if (i < 50) {
                    _hexNeighbors(pq, pr).forEach(([nq, nr]) => {
                        if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                            const k = `${nq},${nr}`;
                            if (!cProbed.has(k)) { cProbed.add(k); cProbe.push([nq, nr]); }
                        }
                    });
                }
            }
            if (csQ !== null) candidateSeeds.push([csQ, csR]);
        }

        {
            const avgQ   = Math.round(boundaryCoords.reduce((s, c) => s + c.q, 0) / boundaryCoords.length);
            const avgR   = Math.round(boundaryCoords.reduce((s, c) => s + c.r, 0) / boundaryCoords.length);
            const probe  = [[avgQ, avgR]];
            const probed = new Set([`${avgQ},${avgR}`]);
            let csQ = null, csR = null;
            for (let i = 0; i < probe.length; i++) {
                const [pq, pr] = probe[i];
                if (!boundaryQR.has(`${pq},${pr}`)) { csQ = pq; csR = pr; break; }
                if (i < 50) {
                    _hexNeighbors(pq, pr).forEach(([nq, nr]) => {
                        const k = `${nq},${nr}`;
                        if (!probed.has(k)) { probed.add(k); probe.push([nq, nr]); }
                    });
                }
            }
            if (csQ !== null) candidateSeeds.push([csQ, csR]);
        }

        // ── BFS flood-fill with leak detection ────────────────────────────────
        const eMinQ = hadColLo ? secMinQ - 1 : minQ - 1;
        const eMaxQ = hadColHi ? secMaxQ + 1 : maxQ + 1;
        const eMinR = hadRowLo ? secMinR - 1 : minR - 1;
        const eMaxR = hadRowHi ? secMaxR + 1 : maxR + 1;

        let filled    = false;
        let fillCount = 0;

        for (const [seedQ, seedR] of candidateSeeds) {
            const visited  = new Set(boundaryQR);
            const interior = [];
            let leaked = false;

            visited.add(`${seedQ},${seedR}`);
            const queue = [[seedQ, seedR]];

            while (queue.length > 0 && !leaked) {
                const [q, r] = queue.shift();
                if (q <= eMinQ || q >= eMaxQ || r <= eMinR || r >= eMaxR) {
                    leaked = true;
                    break;
                }
                interior.push([q, r]);
                _hexNeighbors(q, r).forEach(([nq, nr]) => {
                    const k = `${nq},${nr}`;
                    if (!visited.has(k)) {
                        visited.add(k);
                        if (nq >= secMinQ && nq <= secMaxQ && nr >= secMinR && nr <= secMaxR) {
                            queue.push([nq, nr]);
                        }
                    }
                });
            }

            if (!leaked) {
                interior.forEach(([q, r]) => {
                    const hId = _qrToHexId(q, r);
                    const state = hexStates.get(hId);
                    if (state) { state.cluster = label; affectedHexIds.push(hId); fillCount++; }
                });
                boundaryHexIds.forEach(hId => {
                    const state = hexStates.get(hId);
                    if (state && state.cluster !== label) {
                        state.cluster = label; affectedHexIds.push(hId); fillCount++;
                    }
                });
                filled = true;
                break;
            }
        }

        if (!filled) {
            // Open boundary fallback — assign boundary hexes themselves.
            boundaryHexIds.forEach(hId => {
                const state = hexStates.get(hId);
                if (state) { state.cluster = label; affectedHexIds.push(hId); fillCount++; }
            });
        }

        _upsertRegionSlot(label, hexColor);
        if (fillCount > 0) {
            assigned.push({ label, hexCount: fillCount });
        } else {
            skipped.push({ label, reason: 'No interior hexes found' });
        }
    });

    // ── Persist changed hexes & refresh filter rules UI ──────────────────────
    if (affectedHexIds.length > 0 && window.dbManager) {
        window.dbManager.saveHexes(affectedHexIds);
    }
    if (window.dbManager) {
        window.dbManager.saveRegionDefinitions?.();
        window.dbManager.saveRegionPaths?.();
    }
    if (typeof window.renderRulesLedger === 'function') window.renderRulesLedger();
    if (typeof window.reapplyAllRules    === 'function') window.reapplyAllRules();
    if (typeof window.ensureFreeRegionSlot === 'function') window.ensureFreeRegionSlot();

    return { assigned, skipped };
};

function setupBorderWindow() {
    const closeBtn = document.getElementById('btn-close-border-window');
    if (closeBtn) closeBtn.addEventListener('click', window.closeBorderWindow);

    const closeBtnFooter = document.getElementById('btn-close-border-window-footer');
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', window.closeBorderWindow);

    const ctxBtn = document.getElementById('ctx-open-border-window');
    if (ctxBtn) {
        ctxBtn.addEventListener('click', () => {
            const menu = document.getElementById('context-menu');
            if (menu) menu.classList.remove('visible');
            window.toggleBorderWindow();
        });
    }

    const visAllCb = document.getElementById('border-vis-all-check');
    if (visAllCb) {
        visAllCb.addEventListener('change', () => {
            const show = visAllCb.checked;
            (window.borderDefinitions || []).forEach(def => { def.visible = show; });
            if (window.dbManager) window.dbManager.saveBorderDefinitions?.();
            document.querySelectorAll('#border-window-list .border-visible-check').forEach(cb => { cb.checked = show; });
            visAllCb.indeterminate = false;
            requestAnimationFrame(draw);
        });
    }

    const cancelBtn = document.getElementById('btn-border-assign-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        document.getElementById('border-assign-modal').style.display = 'none';
    });

    if (!window.borderDefinitions) {
        window.borderDefinitions = getDefaultBorderDefinitions();
    }
    if (!window.hexBorderAssignments) {
        window.hexBorderAssignments = new Map();
    }
    if (!window.borderPaths) {
        window.borderPaths = new Map();
    }
}
