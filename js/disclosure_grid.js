// ============================================================================
// DISCLOSURE_GRID.JS - Player Disclosure status grid (shortcut: D)
//
// Answers the question the right-click assign cannot: "what is every system in
// this subsector set to, and which have I never looked at?"
//
// SELF-CONTAINED BY DESIGN. Sean asked that this not bloat hex_map.html or the
// existing modules, so this file owns:
//   - its own markup, built at runtime (nothing in hex_map.html but a <script>)
//   - its own stylesheet, injected once as a scoped <style>
//   - its own keydown listener, so keyboard_shortcuts.js is untouched
//
// It only ever reads and writes `state.disclosure` through DisclosureModel, so
// it cannot reach the exporters or the renderer.
//
// The "never set" column is the point of the whole screen. The default is FULL
// disclosure, so a system nobody has reviewed exports everything — "not set" is
// therefore a warning, not a neutral state, and it is coloured as one.
// ============================================================================

const DisclosureGrid = (() => {

    const WIN_ID = 'disclosure-grid-window';
    let _win = null;
    let _sortKey = 'hex';       // 'hex' | 'name' | 'level'
    let _filterText = '';
    // Remembered between openings. Without this the window re-derives its scope
    // every time and, because `selectedHexes` is normally empty by then, always
    // lands on the first sector with data — sector 1 on a Universe import,
    // which is rarely where the referee is working. Found by screenshot.
    let _lastScope = null;      // { sector, sub }

    // ── Styles ────────────────────────────────────────────────────────────────
    // Injected once. Deliberately namespaced under #disclosure-grid-window so
    // nothing here can affect the rest of the app.

    const CSS = `
#${WIN_ID} {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(1100px, 94vw); height: min(760px, 88vh);
    background: #1f2833; border: 1px solid #45a29e; border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.6); z-index: 300;
    display: none; flex-direction: column; font-family: 'Inter', sans-serif;
    color: #c5c6c7;
}
#${WIN_ID}.visible { display: flex; }
#${WIN_ID} .dg-head {
    padding: 12px 16px; border-bottom: 1px solid #2c3a47;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
#${WIN_ID} h3 { margin: 0; color: #66fcf1; font-size: 1.05rem; flex: 1 1 auto; }
#${WIN_ID} select, #${WIN_ID} input[type="text"] {
    padding: 5px 8px; background: #1a2332; color: #cdd6e3;
    border: 1px solid #45a29e; border-radius: 4px; font-size: 0.85rem;
}
#${WIN_ID} .dg-warn {
    margin: 0; padding: 8px 16px; background: rgba(255,170,60,0.12);
    border-bottom: 1px solid #2c3a47; color: #ffcf8a; font-size: 0.8rem;
}
#${WIN_ID} .dg-warn.clean { background: rgba(102,252,241,0.08); color: #a8d8d4; }
#${WIN_ID} .dg-body { flex: 1; min-height: 0; overflow: auto; }
#${WIN_ID} table { border-collapse: collapse; width: 100%; font-size: 0.82rem; }
#${WIN_ID} thead th {
    position: sticky; top: 0; background: #16202b; color: #a0a8b0;
    padding: 8px 6px; text-align: center; font-weight: 600;
    border-bottom: 1px solid #2c3a47; white-space: nowrap; z-index: 1;
}
#${WIN_ID} thead th.dg-sortable { cursor: pointer; }
#${WIN_ID} thead th.dg-sortable:hover { color: #66fcf1; }
#${WIN_ID} thead th.dg-lvl { font-size: 0.72rem; line-height: 1.25; }
#${WIN_ID} thead th .dg-count {
    display: block; font-size: 0.7rem; font-weight: 700; margin-top: 3px;
}
#${WIN_ID} tbody td {
    padding: 5px 6px; border-bottom: 1px solid #232f3b; text-align: center;
}
#${WIN_ID} tbody td.dg-hex  { text-align: left; color: #8fa0b5; white-space: nowrap; }
#${WIN_ID} tbody td.dg-name { text-align: left; color: #cdd6e3; }
#${WIN_ID} tbody tr:hover td { background: rgba(69,162,158,0.10); }
#${WIN_ID} tbody tr.dg-unset td.dg-name::after {
    content: ' • never set'; color: #ffaa3c; font-size: 0.72rem;
}
#${WIN_ID} input[type="radio"] { cursor: pointer; accent-color: #45a29e; }
#${WIN_ID} .dg-foot {
    padding: 10px 16px; border-top: 1px solid #2c3a47;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
#${WIN_ID} .dg-foot .dg-spacer { flex: 1; }
#${WIN_ID} button {
    padding: 6px 12px; border-radius: 4px; border: 1px solid #45a29e;
    background: #1a2332; color: #cdd6e3; cursor: pointer; font-size: 0.82rem;
}
#${WIN_ID} button:hover { background: #24313f; }
#${WIN_ID} button.dg-close { background: #45a29e; color: #0b0c10; font-weight: 600; }
#${WIN_ID} .dg-empty { padding: 40px 16px; text-align: center; color: #8fa0b5; }
`;

    function _injectCss() {
        if (document.getElementById('dg-style')) return;
        const el = document.createElement('style');
        el.id = 'dg-style';
        el.textContent = CSS;
        document.head.appendChild(el);
    }

    // ── Scope helpers ─────────────────────────────────────────────────────────

    // Only populated hexes can meaningfully carry a level — there is nothing to
    // disclose about empty space. Same filter the exporters use.
    function _systemsIn(sectorNum, subChar) {
        const out = [];
        hexStates.forEach((state, hexId) => {
            const p = hexId.split('-');
            if (parseInt(p[0], 10) !== sectorNum) return;
            if (subChar && p[1] !== subChar) return;
            if (!state || state.type === 'EMPTY') return;
            out.push({ hexId, hexCode: p[2], sub: p[1], state });
        });
        return out;
    }

    function _sectorsWithData() {
        const seen = new Map();
        hexStates.forEach((state, hexId) => {
            if (!state || state.type === 'EMPTY') return;
            const n = parseInt(hexId.split('-')[0], 10);
            seen.set(n, (seen.get(n) || 0) + 1);
        });
        return [...seen.keys()].sort((a, b) => a - b);
    }

    function _subsectorsIn(sectorNum) {
        const seen = new Set();
        hexStates.forEach((state, hexId) => {
            const p = hexId.split('-');
            if (parseInt(p[0], 10) === sectorNum && state && state.type !== 'EMPTY') seen.add(p[1]);
        });
        return [...seen].sort();
    }

    // Default the pickers to whatever the user is already looking at: the
    // current selection if there is one, else the first sector with data.
    function _defaultScope() {
        if (typeof selectedHexes !== 'undefined' && selectedHexes.size) {
            const p = [...selectedHexes][0].split('-');
            return { sector: parseInt(p[0], 10), sub: p[1] };
        }
        const secs = _sectorsWithData();
        if (!secs.length) return { sector: null, sub: null };
        const subs = _subsectorsIn(secs[0]);
        return { sector: secs[0], sub: subs[0] || null };
    }

    function _systemName(state, hexCode) {
        return (typeof ExportCore !== 'undefined')
            ? ExportCore.resolveSystemName(state)
            : (state.name || `System ${hexCode}`);
    }

    // ── Window construction ───────────────────────────────────────────────────

    function _build() {
        _injectCss();
        const w = document.createElement('div');
        w.id = WIN_ID;
        w.innerHTML = `
            <div class="dg-head">
                <h3>Player Disclosure</h3>
                <label style="font-size:0.8rem;color:#a0a8b0;">Sector
                    <select id="dg-sector"></select></label>
                <label style="font-size:0.8rem;color:#a0a8b0;">Subsector
                    <select id="dg-sub"></select></label>
                <input type="text" id="dg-search" placeholder="Filter by name or hex…" style="width:190px;">
            </div>
            <p class="dg-warn" id="dg-warn"></p>
            <div class="dg-body" id="dg-body"></div>
            <div class="dg-foot">
                <span style="font-size:0.8rem;color:#8fa0b5;">Set all shown to:</span>
                <select id="dg-bulk"></select>
                <button id="dg-bulk-apply">Apply</button>
                <span class="dg-spacer"></span>
                <button id="dg-close" class="dg-close">Close</button>
            </div>`;
        document.body.appendChild(w);
        _win = w;

        w.querySelector('#dg-close').addEventListener('click', close);
        w.querySelector('#dg-sector').addEventListener('change', () => {
            _fillSubs(); _rememberScope(); _render();
        });
        w.querySelector('#dg-sub').addEventListener('change', () => { _rememberScope(); _render(); });
        w.querySelector('#dg-search').addEventListener('input', (e) => {
            _filterText = e.target.value.trim().toLowerCase();
            _render();
        });
        w.querySelector('#dg-bulk-apply').addEventListener('click', _applyBulk);

        const bulk = w.querySelector('#dg-bulk');
        bulk.innerHTML = '<option value="">— unset (never reviewed) —</option>'
            + DisclosureModel.LEVELS.map(l =>
                `<option value="${l.id}">${l.id.toUpperCase()} — ${l.name}</option>`).join('');
        return w;
    }

    function _fillSectors() {
        const sel = _win.querySelector('#dg-sector');
        const cur = sel.value;
        sel.innerHTML = _sectorsWithData().map(n => {
            const nm = (window.sectorNames && window.sectorNames[n]) || `Sector ${n}`;
            return `<option value="${n}">${nm}</option>`;
        }).join('');
        if (cur) sel.value = cur;
    }

    function _fillSubs() {
        const sel = _win.querySelector('#dg-sub');
        const sector = parseInt(_win.querySelector('#dg-sector').value, 10);
        const cur = sel.value;
        const subs = _subsectorsIn(sector);
        sel.innerHTML = '<option value="">All subsectors</option>'
            + subs.map(s => `<option value="${s}">Subsector ${s}</option>`).join('');
        if (cur && subs.includes(cur)) sel.value = cur;
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    function _render() {
        if (!_win) return;
        const sector = parseInt(_win.querySelector('#dg-sector').value, 10);
        const sub    = _win.querySelector('#dg-sub').value || null;
        let rows = _systemsIn(sector, sub).map(r => ({
            ...r,
            name:  _systemName(r.state, r.hexCode),
            level: DisclosureModel.getRaw(r.state),      // null when never set
        }));

        if (_filterText) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(_filterText) ||
                r.hexCode.toLowerCase().includes(_filterText));
        }

        const ORDER = DisclosureModel.ORDER;
        rows.sort((a, b) => {
            if (_sortKey === 'name') return a.name.localeCompare(b.name);
            if (_sortKey === 'level') {
                // Never-set first: it is what the referee most needs to act on.
                const ai = a.level == null ? -1 : ORDER.indexOf(a.level);
                const bi = b.level == null ? -1 : ORDER.indexOf(b.level);
                if (ai !== bi) return ai - bi;
            }
            return a.hexCode.localeCompare(b.hexCode);
        });

        const counts = { unset: 0 };
        ORDER.forEach(id => { counts[id] = 0; });
        rows.forEach(r => { if (r.level == null) counts.unset++; else counts[r.level]++; });

        // The warning line — the real point of the screen.
        const warn = _win.querySelector('#dg-warn');
        if (counts.unset > 0) {
            warn.className = 'dg-warn';
            warn.textContent =
                `${counts.unset} of ${rows.length} system(s) shown have never been set. `
                + `Unset systems export in FULL to players — they are not hidden.`;
        } else {
            warn.className = 'dg-warn clean';
            warn.textContent = `All ${rows.length} system(s) shown have a disclosure level set.`;
        }

        const body = _win.querySelector('#dg-body');
        if (!rows.length) {
            body.innerHTML = '<p class="dg-empty">No populated systems in this scope.</p>';
            return;
        }

        const head = [
            `<th class="dg-sortable" data-sort="hex" style="text-align:left;">Hex</th>`,
            `<th class="dg-sortable" data-sort="name" style="text-align:left;">System</th>`,
            `<th class="dg-sortable dg-lvl" data-sort="level" style="color:#ffaa3c;">Not set`
                + `<span class="dg-count">${counts.unset}</span></th>`,
            ...DisclosureModel.LEVELS.map(l =>
                `<th class="dg-lvl" title="${l.hint}" style="color:${l.color};">`
                + `${l.id.toUpperCase()} — ${l.name}<span class="dg-count">${counts[l.id]}</span></th>`),
        ].join('');

        const trs = rows.map(r => {
            const cells = [`<td><input type="radio" name="dg-${r.hexId}" value=""`
                           + `${r.level == null ? ' checked' : ''}></td>`];
            DisclosureModel.LEVELS.forEach(l => {
                cells.push(`<td><input type="radio" name="dg-${r.hexId}" value="${l.id}"`
                           + `${r.level === l.id ? ' checked' : ''}></td>`);
            });
            return `<tr class="${r.level == null ? 'dg-unset' : ''}" data-hex="${r.hexId}">`
                 + `<td class="dg-hex">${r.hexCode}</td>`
                 + `<td class="dg-name">${_esc(r.name)}</td>`
                 + cells.join('') + '</tr>';
        }).join('');

        body.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table>`;

        body.querySelectorAll('th.dg-sortable').forEach(th => {
            th.addEventListener('click', () => { _sortKey = th.dataset.sort; _render(); });
        });
        // Delegated: one listener for the whole table, not one per radio.
        body.addEventListener('change', _onRadio);
    }

    function _esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Editing ───────────────────────────────────────────────────────────────

    function _onRadio(e) {
        const input = e.target;
        if (!input || input.type !== 'radio') return;
        const tr = input.closest('tr');
        if (!tr) return;
        const hexId = tr.dataset.hex;
        const val   = input.value;

        // One undo entry per change, matching the right-click assign.
        saveHistoryState(val ? 'Assign Disclosure' : 'Clear Disclosure');
        if (val) DisclosureModel.set(hexId, val);
        else     DisclosureModel.clear(hexId);

        tr.classList.toggle('dg-unset', !val);
        _refreshCountsOnly();
        requestAnimationFrame(draw);
    }

    // Recompute the header counts and warning without rebuilding the table —
    // rebuilding would lose focus and scroll position on every click.
    function _refreshCountsOnly() {
        const sector = parseInt(_win.querySelector('#dg-sector').value, 10);
        const sub    = _win.querySelector('#dg-sub').value || null;
        let rows = _systemsIn(sector, sub);
        if (_filterText) {
            rows = rows.filter(r => {
                const nm = _systemName(r.state, r.hexCode).toLowerCase();
                return nm.includes(_filterText) || r.hexCode.toLowerCase().includes(_filterText);
            });
        }
        const counts = { unset: 0 };
        DisclosureModel.ORDER.forEach(id => { counts[id] = 0; });
        rows.forEach(r => {
            const lv = DisclosureModel.getRaw(r.state);
            if (lv == null) counts.unset++; else counts[lv]++;
        });

        const ths = _win.querySelectorAll('#dg-body thead th .dg-count');
        if (ths.length) {
            ths[0].textContent = counts.unset;
            DisclosureModel.LEVELS.forEach((l, i) => {
                if (ths[i + 1]) ths[i + 1].textContent = counts[l.id];
            });
        }
        const warn = _win.querySelector('#dg-warn');
        if (counts.unset > 0) {
            warn.className = 'dg-warn';
            warn.textContent =
                `${counts.unset} of ${rows.length} system(s) shown have never been set. `
                + `Unset systems export in FULL to players — they are not hidden.`;
        } else {
            warn.className = 'dg-warn clean';
            warn.textContent = `All ${rows.length} system(s) shown have a disclosure level set.`;
        }
    }

    function _applyBulk() {
        const val = _win.querySelector('#dg-bulk').value;
        const hexIds = [..._win.querySelectorAll('#dg-body tbody tr')].map(tr => tr.dataset.hex);
        if (!hexIds.length) return;
        // One undo entry for the whole bulk action, not one per system.
        saveHistoryState(val ? 'Assign Disclosure' : 'Clear Disclosure');
        hexIds.forEach(id => { if (val) DisclosureModel.set(id, val); else DisclosureModel.clear(id); });
        _render();
        requestAnimationFrame(draw);
        if (typeof showToast === 'function') {
            const def = val ? DisclosureModel.def(val) : null;
            showToast(`${hexIds.length} system(s) set to "${def ? def.name : 'not set'}".`, 2500);
        }
    }

    // ── Open / close ──────────────────────────────────────────────────────────

    function open() {
        if (!_win) _build();
        _fillSectors();
        // A stale filter makes the window look empty for no visible reason.
        _filterText = '';
        const search = _win.querySelector('#dg-search');
        if (search) search.value = '';
        const scope = _lastScope || _defaultScope();
        if (scope.sector != null) {
            const ss = _win.querySelector('#dg-sector');
            if ([...ss.options].some(o => o.value === String(scope.sector))) ss.value = String(scope.sector);
        }
        _fillSubs();
        if (scope.sub) {
            const sb = _win.querySelector('#dg-sub');
            if ([...sb.options].some(o => o.value === scope.sub)) sb.value = scope.sub;
        }
        _render();
        _win.classList.add('visible');
    }

    // Remember whatever scope the user last looked at.
    function _rememberScope() {
        if (!_win) return;
        const sector = parseInt(_win.querySelector('#dg-sector').value, 10);
        if (!isNaN(sector)) _lastScope = { sector, sub: _win.querySelector('#dg-sub').value || null };
    }

    function close() { if (_win) _win.classList.remove('visible'); }
    function isOpen() { return !!(_win && _win.classList.contains('visible')); }
    function toggle() { isOpen() ? close() : open(); }

    // ── Wiring ────────────────────────────────────────────────────────────────
    // Own listener, so keyboard_shortcuts.js needs no edit. The typing guard is
    // duplicated from keyboard_shortcuts.js:8 on purpose — better a few repeated
    // lines than a change to a working file.

    function setup() {
        window.addEventListener('keydown', (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
                if (e.key === 'Escape' && isOpen()) close();
                return;
            }
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (e.key === 'Escape' && isOpen()) { close(); return; }
            if (e.key && e.key.toLowerCase() === 'd') { e.preventDefault(); toggle(); }
        });

        const ctxBtn = document.getElementById('ctx-open-disclosure-grid');
        if (ctxBtn) ctxBtn.addEventListener('click', () => {
            document.getElementById('context-menu').classList.remove('visible');
            open();
        });
    }

    return { open, close, toggle, isOpen, setup };
})();

window.DisclosureGrid = DisclosureGrid;
window.toggleDisclosureGrid = DisclosureGrid.toggle;

// Self-initialise — no edit to input_init.js.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DisclosureGrid.setup);
} else {
    DisclosureGrid.setup();
}
