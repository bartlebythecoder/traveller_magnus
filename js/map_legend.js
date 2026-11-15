// ============================================================================
// MAP LEGEND (v0.18.3)
//
// A movable window that keys every symbol and styling rule in use on the map.
// Turned on in Settings > Visual Options > Show Map Legend.
//
// Rulings (Sean, 2026-11-14; directives/project_manifest.md §0.0.D):
//   * "In use" means anywhere on the WHOLE map, not just the part on screen.
//   * World symbols and filter rules only: no routes, borders, regions or
//     manual hex fills.
//   * A rule is labelled by its optional `name`, else its generated description.
//   * The on/off state saves with the map (io_manager.js `mapLegendEnabled`);
//     the window's position is per-browser (localStorage).
//
// Swatches are drawn by the map's own symbol functions in renderer.js
// (drawWorldIcon, drawGasGiantSymbol, ...), so the key cannot drift from the map.
//
// The scan mirrors draw()'s presentation view: hidden-by-filter hexes (unless
// Shift+F) and stellar-only systems when "Hide systems without planets" is on
// don't count. Gas giant and base symbols count on every drawn world, named or
// not (they were tied to the name until the v0.18.3 fix).
//
// It never runs per frame (a Universe import is 163,840 hexes): it runs after a
// rule pass, a filter pass, an undo, and after any draw whose cheap signature
// (settings, hex count, rule pass) has changed, debounced.
// ============================================================================

(function () {
    const POS_KEY = 'traveller_map_legend_pos';
    const SCAN_DELAY_MS = 150;

    let _setupDone = false;
    let _scanTimer = null;
    let _lastSig = null;
    let _matchPass = 0;          // bumps whenever ruleMatchesByHex is replaced
    let _seenMatches = null;

    // ---- scan --------------------------------------------------------------

    function _isDevView() {
        return (typeof devView !== 'undefined') && !!devView;
    }

    function _defaultColor() {
        const el = document.getElementById('default-dot-color');
        return (el && el.value) || '#ffffff';
    }

    /**
     * Walks the whole map once and reports what draw() would show.
     * Exposed as window.scanMapLegend for the test harness.
     */
    function scanMapLegend() {
        const found = {
            world: false, noData: false, gasGiant: false, gasGiantRinged: false,
            scoutBase: false, navalBase: false, amber: false, red: false,
            rules: new Set(), hexes: 0, ms: 0,
        };
        const t0 = performance.now();
        const matches = window.ruleMatchesByHex || null;
        const ruleById = new Map((window.activeFilterRules || []).map(r => [r.id, r]));
        const suspended = window.filterSuspended === true;
        const bgVisible = window.hexBgFillVisible !== false;
        const hideStellar = (typeof hideNoPlanetSystems !== 'undefined') && hideNoPlanetSystems;
        const ringedOn = window.ringedGasGiantSatellites !== false;

        // A rule counts on a hex only if it matched there in the last rule pass
        // AND some part of its styling actually shows on that hex. The second
        // test drops a rule that a later rule overrode completely (last rule wins
        // the icon, ring and fill), and a match list left stale by an undo, which
        // restores hex styling without a new rule pass.
        const addRules = (hexId, st, drawn, named) => {
            if (!matches) return;
            const ids = matches.get(hexId);
            if (!ids) return;
            const cu = (st && st.custom_ui) || {};
            for (const id of ids) {
                if (found.rules.has(id)) continue;
                const rule = ruleById.get(id);
                if (!rule || rule.visible === false) continue;
                // A hidden world shows none of a rule's styling except its hex
                // fill, which draw() paints under every hex regardless.
                const fill = bgVisible && rule.bgFillColor && cu.bgFillColor === rule.bgFillColor;
                const shows = fill || (drawn && (
                    (rule.color && cu.appliedColors && cu.appliedColors.includes(rule.color)) ||
                    (rule.iconStyle && cu.iconStyle === rule.iconStyle) ||
                    (rule.ringColor && cu.ringColor === rule.ringColor) ||
                    (named && ((rule.textCase && cu.textCase === rule.textCase) ||
                               (rule.isItalic && cu.isItalic) ||
                               (rule.isUnderline && cu.isUnderline)))));
                if (shows) found.rules.add(id);
            }
        };

        hexStates.forEach((raw, hexId) => {
            found.hexes++;
            const st = (typeof raw === 'string') ? { type: raw } : raw;
            if (!st) return;
            if (st.type !== 'SYSTEM_PRESENT') { addRules(hexId, st, false, false); return; }

            const hidden = suspended ? false : !!st.isHiddenByFilter;
            const data = st.rttData || st.t5Data || st.mgt2eData || st.ctData;
            let drawn = !hidden;
            if (drawn && hideStellar) {
                const aowStellarOnly = st.aowSystem && !st.aowSystem.mainworld;
                if ((data && data.isStellarOnly) || aowStellarOnly) drawn = false;
            }
            addRules(hexId, st, drawn && !!data, !!(data && data.name));
            if (!drawn) return;
            if (!data) { found.noData = true; return; }

            if (data.travelZone && data.travelZone !== 'Green' && data.travelZone !== 'G') {
                if (data.travelZone === 'Red') found.red = true; else found.amber = true;
            }

            const custom = st.custom_ui || {};
            const hasColors = custom.appliedColors && custom.appliedColors.length > 0;
            if (!hasColors && !custom.iconStyle && !custom.ringColor) found.world = true;

            if (data.gasGiant) {
                if (ringedOn && mainworldOrbitsGasGiant(data, st)) found.gasGiantRinged = true;
                else found.gasGiant = true;
            }
            if (data.scoutBase) found.scoutBase = true;
            if (data.navalBase) found.navalBase = true;
        });
        found.ms = performance.now() - t0;
        return found;
    }
    window.scanMapLegend = scanMapLegend;

    // ---- swatches ------------------------------------------------------------

    const SW_W = 44, SW_H = 34;

    function _swatch(paint) {
        const c = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(SW_W * dpr);
        c.height = Math.round(SW_H * dpr);
        c.style.width = SW_W + 'px';
        c.style.height = SW_H + 'px';
        c.className = 'map-legend-swatch';
        const ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.fillStyle = window.printMode ? '#ffffff' : '#0b0c10';
        ctx.fillRect(0, 0, SW_W, SW_H);
        paint(ctx, SW_W / 2, SW_H / 2);
        return c;
    }

    // Symbols are tiny at map scale (a gas giant is 3.5 px), so they are keyed
    // at twice size, as they look on the map at zoom 2.
    function _symbolSwatch(fn) {
        return _swatch((ctx, cx, cy) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(2, 2);
            fn(ctx);
            ctx.restore();
        });
    }

    function _ink() { return window.printMode ? '#000000' : '#ffffff'; }

    function _ruleSwatch(rule) {
        const base = _defaultColor();
        return _swatch((ctx, cx, cy) => {
            if (rule.bgFillColor) {
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = rule.bgFillColor;
                ctx.fill(getHexPath(cx, cy, 16));
                ctx.restore();
            }
            const styled = rule.color || rule.iconStyle || rule.ringColor;
            if (styled) {
                const colors = rule.color ? [rule.color] : null;
                drawWorldIcon(ctx, cx, cy, 10, rule.iconStyle || 'Classic', colors, base,
                              rule.color || base, 1);
                if (rule.ringColor) drawWorldRing(ctx, cx, cy, 10, rule.ringColor);
            } else if (!rule.bgFillColor) {
                // Text styling only: show it on a sample name.
                ctx.fillStyle = _ink();
                ctx.font = `${rule.isItalic ? 'italic ' : ''}12px 'Inter', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const sample = rule.textCase === 'ALL CAPS' ? 'NAME' : 'Name';
                ctx.fillText(sample, cx, cy);
                if (rule.isUnderline) {
                    const w = ctx.measureText(sample).width;
                    ctx.fillRect(cx - w / 2, cy + 7, w, 1);
                }
            }
        });
    }

    // ---- window --------------------------------------------------------------

    function _row(list, swatch, text, opts) {
        const row = document.createElement('div');
        row.className = 'map-legend-row';
        row.appendChild(swatch);
        const label = document.createElement('span');
        label.className = 'map-legend-label';
        label.textContent = text;
        if (opts && opts.title) label.title = opts.title;
        if (opts && opts.rule) {
            const r = opts.rule;
            if (r.textCase === 'ALL CAPS') label.style.textTransform = 'uppercase';
            if (r.isItalic) label.style.fontStyle = 'italic';
            if (r.isUnderline) label.style.textDecoration = 'underline';
        }
        row.appendChild(label);
        list.appendChild(row);
    }

    function _heading(list, text) {
        const h = document.createElement('div');
        h.className = 'map-legend-heading';
        h.textContent = text;
        list.appendChild(h);
    }

    function renderMapLegend() {
        const win = document.getElementById('map-legend');
        const list = document.getElementById('map-legend-list');
        if (!win || !list || !win.classList.contains('visible')) return;
        list.textContent = '';

        if (_isDevView()) {
            const p = document.createElement('div');
            p.className = 'map-legend-empty';
            p.textContent = 'Development view draws no map symbols. Turn it off to see the legend.';
            list.appendChild(p);
            return;
        }

        // A map reopened from the browser's autosave brings its rule styling back
        // on the hexes, but no rule pass runs, so there is no match list yet. Run
        // the app's own pass once (it rebuilds the same styling from the same
        // rules); it calls refreshMapLegend, which lands back here with the list.
        if (!window.ruleMatchesByHex && (window.activeFilterRules || []).length > 0 &&
            typeof window.reapplyAllRules === 'function') {
            window.reapplyAllRules();
        }

        const f = scanMapLegend();
        window._mapLegendLastScan = f;
        const base = _defaultColor();
        const ink = _ink();
        let any = false;

        const sym = [];
        if (f.world || f.noData) sym.push([_swatch((c, x, y) => drawWorldIcon(c, x, y, 10, 'Classic', null, base, base, 1)), 'World']);
        if (f.gasGiant) sym.push([_symbolSwatch(c => drawGasGiantSymbol(c, 0, 0, ink, false, 1)), 'Gas giant present']);
        if (f.gasGiantRinged) sym.push([_symbolSwatch(c => drawGasGiantSymbol(c, 0, 0, ink, true, 1)), 'Gas giant (mainworld is its satellite)']);
        if (f.navalBase) sym.push([_symbolSwatch(c => drawNavalBaseSymbol(c, 0, 0, ink)), 'Naval base']);
        if (f.scoutBase) sym.push([_symbolSwatch(c => drawScoutBaseSymbol(c, 0, 0, ink)), 'Scout base']);
        const zone = (color) => _swatch((c, x, y) => {
            drawTravelZoneHalo(c, x, y, 10, color, 1);
            drawWorldIcon(c, x, y, 10, 'Classic', null, base, base, 1);
        });
        if (f.amber) sym.push([zone('#FFBF00'), 'Amber Zone']);
        if (f.red) sym.push([zone('#FF0000'), 'Red Zone']);
        if (sym.length) {
            any = true;
            _heading(list, 'Map Symbols');
            sym.forEach(([s, t]) => _row(list, s, t));
        }

        const rules = (window.activeFilterRules || []).filter(r => f.rules.has(r.id));
        if (rules.length) {
            any = true;
            _heading(list, 'Styling Rules');
            rules.forEach(r => _row(list, _ruleSwatch(r), r.name || r.description,
                                    { rule: r, title: r.name ? `${r.name} — ${r.description}` : r.description }));
        }

        if (!any) {
            const p = document.createElement('div');
            p.className = 'map-legend-empty';
            p.textContent = 'Nothing on the map to key yet.';
            list.appendChild(p);
        }
        _clampIntoView(win);
    }
    window.renderMapLegend = renderMapLegend;

    // Debounced rescan; every caller goes through here.
    function refreshMapLegend() {
        if (window.mapLegendEnabled !== true) return;
        if (_scanTimer) clearTimeout(_scanTimer);
        _scanTimer = setTimeout(() => { _scanTimer = null; renderMapLegend(); }, SCAN_DELAY_MS);
    }
    window.refreshMapLegend = refreshMapLegend;

    // Called at the end of every draw(). Cheap: compares a handful of values and
    // only schedules a scan when one of them moved.
    window.mapLegendAfterDraw = function () {
        if (window.mapLegendEnabled !== true) return;
        if (window.ruleMatchesByHex !== _seenMatches) { _seenMatches = window.ruleMatchesByHex; _matchPass++; }
        const sig = [
            window.printMode ? 1 : 0, _isDevView() ? 1 : 0,
            window.ringedGasGiantSatellites !== false ? 1 : 0,
            window.filterSuspended === true ? 1 : 0,
            (typeof hideNoPlanetSystems !== 'undefined' && hideNoPlanetSystems) ? 1 : 0,
            window.hexBgFillVisible !== false ? 1 : 0,
            _defaultColor(), hexStates.size, _matchPass,
        ].join('|');
        if (sig === _lastSig) return;
        _lastSig = sig;
        refreshMapLegend();
    };

    // ---- placement -------------------------------------------------------------

    function _clampIntoView(win) {
        const r = win.getBoundingClientRect();
        const m = 8;
        let left = r.left, top = r.top;
        left = Math.max(m, Math.min(left, window.innerWidth - r.width - m));
        top = Math.max(m, Math.min(top, window.innerHeight - r.height - m));
        if (left !== r.left || top !== r.top) {
            win.style.left = left + 'px';
            win.style.top = top + 'px';
            win.style.right = 'auto';
            win.style.bottom = 'auto';
        }
    }

    function _savePos(win) {
        const r = win.getBoundingClientRect();
        try { localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })); } catch (e) { /* storage blocked */ }
    }

    function _restorePos(win) {
        let pos = null;
        try { pos = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch (e) { pos = null; }
        if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
            win.style.left = pos.left + 'px';
            win.style.top = pos.top + 'px';
        } else {
            // Default: bottom-right corner, clear of the left-hand palettes.
            win.style.left = Math.max(8, window.innerWidth - 300) + 'px';
            win.style.top = Math.max(8, window.innerHeight - 420) + 'px';
        }
        win.style.right = 'auto';
        win.style.bottom = 'auto';
    }

    function _setup() {
        if (_setupDone) return;
        const win = document.getElementById('map-legend');
        if (!win) return;
        _setupDone = true;
        const handle = win.querySelector('.modal-drag-handle');
        if (handle && typeof makeDraggable === 'function') makeDraggable(win, handle);
        if (handle) handle.addEventListener('mouseup', () => _savePos(win));
        _restorePos(win);

        const close = document.getElementById('btn-close-map-legend');
        if (close) {
            close.addEventListener('mousedown', e => e.stopPropagation());
            close.addEventListener('click', () => window.setMapLegendEnabled(false));
        }
        window.addEventListener('resize', () => {
            if (win.classList.contains('visible')) _clampIntoView(win);
        });
    }

    /** Shows or hides the window to match window.mapLegendEnabled. */
    window.updateMapLegendVisibility = function () {
        _setup();
        const win = document.getElementById('map-legend');
        if (!win) return;
        const on = window.mapLegendEnabled === true;
        win.classList.toggle('visible', on);
        if (on) {
            _lastSig = null;
            renderMapLegend();
        }
    };

    /** The one place the setting changes from the UI (tick-box or the window's X). */
    window.setMapLegendEnabled = function (on) {
        window.mapLegendEnabled = !!on;
        const box = document.getElementById('toggle-map-legend');
        if (box) box.checked = window.mapLegendEnabled;
        try { localStorage.setItem('traveller_map_legend', String(window.mapLegendEnabled)); } catch (e) { /* storage blocked */ }
        window.updateMapLegendVisibility();
    };
})();
