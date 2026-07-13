// =============================================================================
// SYSTEM_EDITOR.JS — Full System Editor
// Allows users to create star systems from scratch or structurally edit
// existing generated systems. Renders as a side panel over the System Viewer.
// =============================================================================

'use strict';

const SystemEditor = (() => {

    // ── Private state ─────────────────────────────────────────────────────────

    let _workingCopy        = null;
    let _originalCopy       = null;
    let _history            = [];
    let _histIdx            = -1;
    let _editorPanel        = null;
    let _pendingCreateHexId = null;
    let _dragBodyId         = null;
    let _dragStarId         = null;
    let _dragCompanionId    = null;   // _id of the companion star being dragged
    let _previewOriginalState = null; // { hexId, existed, state } — snapshot before first Preview

    const HISTORY_CAP = 50;

    // ── Star spectral-type dropdown options ───────────────────────────────────

    const _STAR_TYPE_CHOICES = [
        { value: 'O',  label: 'O — Blue' },
        { value: 'B',  label: 'B — Blue-White' },
        { value: 'A',  label: 'A — White' },
        { value: 'F',  label: 'F — Yellow-White' },
        { value: 'G',  label: 'G — Yellow' },
        { value: 'K',  label: 'K — Orange' },
        { value: 'M',  label: 'M — Red' },
        { value: 'D',  label: 'D — White Dwarf' },
        { value: 'BD', label: 'BD — Brown Dwarf' },
    ];
    const _STAR_SUBTYPE_CHOICES = [0,1,2,3,4,5,6,7,8,9].map(n => ({ value: n, label: String(n) }));
    const _STAR_CLASS_CHOICES = [
        { value: 'Ia',  label: 'Ia — Supergiant' },
        { value: 'Ib',  label: 'Ib — Supergiant (dim)' },
        { value: 'II',  label: 'II — Bright Giant' },
        { value: 'III', label: 'III — Giant' },
        { value: 'IV',  label: 'IV — Subgiant' },
        { value: 'V',   label: 'V — Main Sequence' },
        { value: 'VI',  label: 'VI — Subdwarf' },
        { value: 'D',   label: 'D — White Dwarf' },
    ];

    // ── ID generator ──────────────────────────────────────────────────────────

    let _nextId = 0;
    function _uid(prefix) { return `${prefix}-${++_nextId}`; }

    // ── Orbit → AU helper ─────────────────────────────────────────────────────
    // Mirrors the viewer's _orbitToAU using MgT2EData (shared by all engines).

    function _orbitIdToAU(orbitId) {
        if (orbitId == null) return null;

        // CT models orbits as discrete integer slots (0="Orbit 0"=0.2 AU, 1=0.4 AU, ...) via its
        // own ORBIT_AU table, not MgT2E's continuous per-orbit AU curve — falling through to
        // MgT2E's table below (as this used to do unconditionally) coincidentally matches at low
        // orbit numbers but isn't CT's real data, and silently breaks for a non-integer orbitId:
        // ct_bottomup_generator.js's own array lookup on such a value returns undefined (not an
        // interpolated AU), which was corrupting the body's real distAU and, downstream, the
        // hex info panel's by-distance sort order (see js/ct_bottomup_generator.js's
        // orbitalAU[Math.floor(...)] fix). Floor here too so the editor's own live "→ AU"
        // preview and drag-reorder sort agree with what the generator will actually produce.
        if (_workingCopy && _workingCopy.engine === 'CT') {
            const ctTbl = (typeof ORBIT_AU !== 'undefined') ? ORBIT_AU
                : (typeof CT_CONSTANTS !== 'undefined' ? CT_CONSTANTS.ORBIT_AU : null);
            if (!ctTbl) return null;
            const idx = Math.max(0, Math.min(Math.floor(orbitId), ctTbl.length - 1));
            return ctTbl[idx];
        }

        const tbl = (window.MgT2EData && window.MgT2EData.stellar && window.MgT2EData.stellar.orbitAu) || null;
        if (!tbl) return null;
        const idx = Math.floor(orbitId);
        const frac = orbitId - idx;
        const lo = tbl[Math.min(idx, tbl.length - 1)];
        const hi = tbl[Math.min(idx + 1, tbl.length - 1)];
        return lo + frac * (hi - lo);
    }

    // ── Engine detection ──────────────────────────────────────────────────────

    function _detectEngine(stateObj) {
        if (!stateObj) return null;
        const aowDetected = _ENGINE_ADAPTERS.AoW.detect(stateObj);
        if (aowDetected) return aowDetected;
        const mgt2eDetected = _ENGINE_ADAPTERS.MgT2E.detect(stateObj);
        if (mgt2eDetected) return mgt2eDetected;
        const ctDetected = _ENGINE_ADAPTERS.CT.detect(stateObj);
        if (ctDetected) return ctDetected;
        const t5Detected = _ENGINE_ADAPTERS.T5.detect(stateObj);
        if (t5Detected) return t5Detected;
        const rttDetected = _ENGINE_ADAPTERS.RTT.detect(stateObj);
        if (rttDetected) return rttDetected;
        return null;
    }

    // ── Type helpers ──────────────────────────────────────────────────────────

    function _canonType(rawType) {
        if (!rawType) return 'World';
        const t = String(rawType).toLowerCase();
        if (t.includes('gas giant') || t.includes('jovian') || t.includes('helian') || t.includes('ice giant'))
            return 'Gas Giant';
        if (t.includes('belt') || t.includes('asteroid') || t.includes('planetoid') || t.includes('ring'))
            return 'Belt';
        return 'World';
    }

    function _ggTypeFrom(rawType) {
        const t = String(rawType || '').toLowerCase();
        if (t.includes('large') || t.includes('jovian'))                         return 'GL';
        if (t.includes('small') || t.includes('helian') || t.includes('ice'))   return 'GS';
        return 'GM';
    }

    function _isMW(w, mwRef) {
        if (!mwRef || !w) return false;
        if (w === mwRef)  return true;
        return mwRef.uwp && w.uwp && mwRef.uwp === w.uwp && mwRef.name === w.name;
    }

    // ── Moon builder ──────────────────────────────────────────────────────────

    function _buildMoon(m) {
        return {
            _id:           _uid('moon'),
            type:          m.isMainworld ? 'Mainworld' : (m.type || 'Satellite'),
            name:          m.name || '',
            uwp:           m.uwp  || null,
            isMainworld:   !!m.isMainworld,
            travelZone:    m.travelZone || m.zone || 'G',
            pd:            m.pd,
            pos:           m.pos,
            eccentricity:  m.eccentricity,
            retrograde:    m.retrograde,
            _manualFields: m._manualFields ? [...m._manualFields] : [],
            _uwpSeed:      null,
            _raw:          m,
        };
    }

    // ── Shared helpers exposed to external per-engine adapter files ────────────
    // Adapter files (js/mgt2e_editor_adapter.js, future js/ct_editor_adapter.js, etc.)
    // load as separate <script> tags and can't reach this IIFE's closures directly.
    // _clearSystemData is a hoisted function declaration defined later in this file,
    // so referencing it here (before its textual definition) is safe.
    window.SystemEditorShared = {
        uid:             _uid,
        orbitIdToAU:     _orbitIdToAU,
        canonType:       _canonType,
        ggTypeFrom:      _ggTypeFrom,
        isMW:            _isMW,
        buildMoon:       _buildMoon,
        normTz:          _normTz,
        applyUwpSeed:    _applyUwpSeed,
        clearSystemData: _clearSystemData,
    };

    // ── Per-engine adapters ───────────────────────────────────────────────────
    // Each engine's own file (js/<engine>_editor_adapter.js, loaded before this one — see
    // hex_map.html) registers an adapter object on window.SystemEditorAdapters.<Engine> so
    // engine-shape knowledge never lives as an `if/else if engine === '...'` branch in this
    // file. Four methods are required, two are optional:
    //   detect(stateObj)                  -> { raw, engine } | null
    //   readBodies(raw, starIdByIdx)      -> bodies[]  (working-copy body list)
    //   write(wc, starIdxById, engStars)  -> partial seedSys fields to merge in (e.g. { worlds })
    //   run(hexId, seedSys, stateObj)     -> newSys | null  (calls the real generator, writes stateObj)
    //   restoreManualFields(wc, newSys)   -> optional; re-stamps display-only _manualFields onto
    //                                        newSys's generated bodies/moons (see
    //                                        _restoreDisplayManualFields below)
    //   backfillFromGenerated(wc, newSys) -> optional; copies generator-derived body/moon fields
    //                                        (hillSpanPd, moon pd/pos/etc.) back onto the working
    //                                        copy after a Preview (see _preview below)
    // Not every adapter defines the two optional methods (AoW/T5/RTT don't yet, matching their
    // preliminary editor-support status — see directives/project_manifest.md Section 5's
    // T5/RTT/AoW overhaul banner) — both call sites below check for the method before calling it.

    const _ENGINE_ADAPTERS = {
        // Extracted to js/mgt2e_editor_adapter.js (loaded before this file — see
        // hex_map.html), registering itself on window.SystemEditorAdapters.MgT2E.
        MgT2E: window.SystemEditorAdapters.MgT2E,

        // Extracted to js/ct_editor_adapter.js (loaded before this file — see
        // hex_map.html), registering itself on window.SystemEditorAdapters.CT.
        CT: window.SystemEditorAdapters.CT,

        // Extracted to js/t5_editor_adapter.js (loaded before this file — see
        // hex_map.html), registering itself on window.SystemEditorAdapters.T5.
        T5: window.SystemEditorAdapters.T5,

        // Extracted to js/rtt_editor_adapter.js (loaded before this file — see
        // hex_map.html), registering itself on window.SystemEditorAdapters.RTT.
        RTT: window.SystemEditorAdapters.RTT,

        // Extracted to js/aow_editor_adapter.js (loaded before this file — see
        // hex_map.html), registering itself on window.SystemEditorAdapters.AoW.
        AoW: window.SystemEditorAdapters.AoW,
    };

    // ── Build working copy from engine state ──────────────────────────────────

    function _buildWorkingCopyFromState(stateObj, hexId) {
        const found = _detectEngine(stateObj);
        if (!found) return null;
        const { raw, engine } = found;

        const stars = (raw.stars || []).map((s, i) => {
            let orbitAU = null;
            if (i > 0) {
                const slotNum = s.orbitId ?? (typeof s.orbit === 'number' ? s.orbit : null);
                orbitAU = s.distAU ?? s.orbitAU
                    ?? (slotNum != null ? _orbitIdToAU(slotNum) : null)
                    ?? (engine === 'CT'
                        ? (s.orbit === 'Close' ? 0.05 : 10)
                        : null)
                    ?? (engine === 'RTT'
                        ? ({ Tight: 0.05, Close: 0.5, Moderate: 5, Distant: 60 }[s.orbitType] ?? 5)
                        : null);
            }
            return {
                _id:           _uid('star'),
                role:          s.role || (i === 0 ? 'Primary' : 'Companion'),
                sType:         s.type  || s.sType  || 'G',
                subType:       s.decimal != null ? s.decimal : (s.subType != null ? s.subType : 5),
                sClass:        s.size   || s.sClass || 'V',
                name:          s.name  || '',
                orbitId:       i === 0 ? null : (s.orbitId ?? (typeof s.orbit === 'number' ? s.orbit : null)),
                orbitAU,
                parentStarId:  null,
                mass:          s.mass  ?? null,
                // CT's native star format calls this field `luminosity`, not `lum` (MgT2E's
                // convention, which this generic working-copy shape otherwise follows) — fall
                // back to it so opening Edit on a CT system doesn't show a blank Lum field for
                // perfectly valid data (see the write-side counterpart in _buildSeedSys below).
                lum:           s.lum   ?? s.luminosity ?? null,
                diam:          s.diam  ?? null,
                temp:          s.temp  ?? null,
                mao:           s.mao   ?? null,
                _manualFields: s._manualFields ? [...s._manualFields] : [],
                _raw:          s,
            };
        });

        // Back-fill parentStarId from the raw engine's parentStarIdx field.
        // Primary (index 0) stays null; every other star links to its host star's _id.
        stars.forEach((s, i) => {
            if (i === 0) return;
            const rawIdx = (s._raw && s._raw.parentStarIdx != null) ? s._raw.parentStarIdx : 0;
            s.parentStarId = (stars[rawIdx] || stars[0])._id;
        });

        const _starIdByIdx = (idx) => (stars[idx] || stars[0] || {})._id || null;
        const adapter = _ENGINE_ADAPTERS[engine];
        let bodies = [];

        if (adapter) {
            bodies = adapter.readBodies(raw, _starIdByIdx);
        }

        // Identify mainworldRef from isMainworld flags on bodies and moons
        let mainworldRef = null;
        for (const b of bodies) {
            if (b.isMainworld) { mainworldRef = b._id; break; }
            const mwMoon = (b.moons || []).find(m => m.isMainworld);
            if (mwMoon) { mainworldRef = mwMoon._id; break; }
        }
        return { hexId, engine, allowAddBodies: false, mainworldRef, stars, bodies,
                 age: raw.age ?? null, hzco: raw.hzco ?? null };
    }

    function _buildBlankWorkingCopy(hexId, engine, starSpec) {
        const sp     = starSpec || {};
        const sType  = sp.sType  || 'G';
        const subType = sp.subType != null ? sp.subType : 2;
        const sClass = sp.sClass || 'V';
        return {
            hexId, engine, allowAddBodies: false, mainworldRef: null,
            age: null, hzco: null,
            stars: [{
                _id: _uid('star'), role: 'Primary',
                sType, subType, sClass,
                name: `${sType}${subType}${sClass}`,
                orbitAU: null, parentStarId: null,
                mass: null, lum: null, diam: null, temp: null, mao: null,
                _manualFields: [], _raw: {},
            }],
            bodies: [],
        };
    }

    // ── History ───────────────────────────────────────────────────────────────

    function _pushHistory() {
        _history.splice(_histIdx + 1);
        _history.push(JSON.parse(JSON.stringify(_workingCopy)));
        if (_history.length > HISTORY_CAP) _history.shift();
        _histIdx = _history.length - 1;
    }

    function _undo() {
        if (_histIdx <= 0) return;
        _histIdx--;
        _workingCopy = JSON.parse(JSON.stringify(_history[_histIdx]));
        _renderAndPreview();
    }

    function _redo() {
        if (_histIdx >= _history.length - 1) return;
        _histIdx++;
        _workingCopy = JSON.parse(JSON.stringify(_history[_histIdx]));
        _renderAndPreview();
    }

    function _isDirty() {
        return JSON.stringify(_workingCopy) !== JSON.stringify(_originalCopy);
    }

    // ── Warn dialog helper ────────────────────────────────────────────────────

    function _showWarn(title, message, buttons) {
        const dlg = document.getElementById('se-warn-dialog');
        if (!dlg) return;
        dlg.style.zIndex = '9200';
        document.getElementById('se-warn-title').textContent   = title;
        document.getElementById('se-warn-message').textContent = message;
        const btnArea = document.getElementById('se-warn-buttons');
        btnArea.innerHTML = '';
        buttons.forEach(({ label, cls, onClick }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className   = cls || '';
            Object.assign(btn.style, {
                flex: '1', padding: '10px', borderRadius: '4px',
                border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
            });
            btn.addEventListener('click', () => { dlg.style.display = 'none'; onClick(); });
            btnArea.appendChild(btn);
        });
        dlg.style.display = 'flex';
    }

    // ── Button factory ────────────────────────────────────────────────────────

    function _btn(label, title, onClick, highlight) {
        const b = document.createElement('button');
        b.textContent = label;
        b.title       = title;
        Object.assign(b.style, {
            background: 'transparent',
            border:     `1px solid ${highlight ? '#ffa500' : '#45a29e66'}`,
            color:      highlight ? '#ffa500' : '#8a8f94',
            padding:    '1px 5px', borderRadius: '3px',
            cursor: 'pointer', fontSize: '10px', fontFamily: 'inherit',
            flexShrink: '0', whiteSpace: 'nowrap',
        });
        b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        return b;
    }

    // ── Structural operations ─────────────────────────────────────────────────

    // "Append at the end" is supposed to mean "farther out than everything else in this star's
    // orbit", but a CT Captured Planet (RAW anomaly, always orbitId === null, real AU can be far
    // beyond every slot-numbered body — see OW-20) and a companion star (its own orbitId in the
    // same shared sequence — _insertAtOrbit/_wouldReorder already treat "bodies + companion
    // stars" as one combined pool, this didn't) were both invisible to a slot-number-only
    // `max(orbitId) + 1`. That could return a slot whose AU falls *short* of an already-farther-
    // out captured planet or companion, silently inserting the new body in the middle of the
    // list instead of at the true end (OW-21). Compare AU, not just slot numbers, to guarantee
    // the candidate slot is actually farther out than every sibling.
    function _nextOrbitId(parentStarId) {
        const siblingBodies = _workingCopy.bodies.filter(b => b.parentStarId === parentStarId);
        const siblingStars  = _workingCopy.stars.filter(s => s.parentStarId === parentStarId);

        const maxSiblingAU = Math.max(
            0,
            ...siblingBodies.map(b => _orbitIdToAU(b.orbitId) ?? b.au ?? b.orbitAU ?? 0),
            ...siblingStars.map(s => _orbitIdToAU(s.orbitId) ?? s.orbitAU ?? 0)
        );

        let candidate = siblingBodies.length > 0
            ? Math.max(...siblingBodies.map(b => b.orbitId || 0)) + 1
            : 1;

        // Bump the candidate slot until its AU actually exceeds every sibling's (captured
        // planets/companions included). Guarded to avoid looping forever if a CT orbit table
        // clamps to a fixed max AU short of an extreme captured-planet distance.
        let guard = 0;
        while (maxSiblingAU > 0 && (_orbitIdToAU(candidate) ?? Infinity) <= maxSiblingAU && guard++ < 100) {
            candidate++;
        }
        return candidate;
    }

    function _addStar(separation, parentStarId) {
        separation   = separation   || 'Companion';
        parentStarId = parentStarId || (_workingCopy.stars[0] || {})._id;

        // AoW design decision 3 (directives/project_manifest.md OW-9): restrict the shape at
        // build time to the 5 hierarchies aow_seed_bridge.js's mapHierarchy() actually supports
        // (Singleton/Binary/Trinary×2/Quaternary — always paired, max 4 stars), rather than
        // silently building something it can't represent. 1-3 stars are always representable
        // regardless of which existing star a new companion attaches to (both Trinary shapes are
        // covered); only the 4th star is constrained — it must pair with the most recently added
        // companion to form the Quaternary's second binary pair.
        if (_workingCopy.engine === 'AoW') {
            const companions = _workingCopy.stars.filter(s => s.role !== 'Primary');
            if (_workingCopy.stars.length >= 4) {
                _showWarn('Maximum Stars Reached',
                    'AoW supports at most 4 stars, always in paired arrangements (a Quaternary system) — ' +
                    'real multi-star systems beyond this are generally unstable. Remove a companion before adding another.',
                    [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
                return;
            }
            if (companions.length === 2 && parentStarId !== companions[1]._id) {
                _showWarn('Unsupported Star Arrangement',
                    'A 4th star in an AoW system must pair with the most recently added companion, forming a ' +
                    'second binary pair — use that companion\'s own "+Comp" button to add it.',
                    [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
                return;
            }
        }

        const _orbitBySep = { Companion: 0.15, Close: 0.5, Near: 6.0, Far: 12.0 };
        _pushHistory();
        _workingCopy.stars.push({
            _id: _uid('star'), role: separation,
            sType: 'M', subType: 0, sClass: 'V', name: 'M0V',
            orbitId: _orbitBySep[separation] ?? 12.0,
            orbitAU: null, parentStarId,
            mass: null, lum: null, diam: null, temp: null, mao: null,
            _manualFields: [], _raw: {},
        });
        _renderAndPreview();
    }

    function _addBody(parentStarId, bodyType) {
        _pushHistory();
        _workingCopy.bodies.push({
            _id: _uid('body'), type: bodyType,
            ggType:        bodyType === 'Gas Giant' ? 'GS' : null,
            name: '', uwp: null, au: null,
            orbitId:       _nextOrbitId(parentStarId),
            travelZone:    'G', parentStarId, isMainworld: false,
            moons: [], _manualFields: ['type'], _uwpSeed: null, _raw: {},
        });
        _renderAndPreview();
    }

    function _addMoon(parentBodyId) {
        const parent = _workingCopy.bodies.find(b => b._id === parentBodyId);
        if (!parent) return;
        _pushHistory();

        // Assign the new moon a pd (orbital distance, in planetary diameters) immediately
        // rather than leaving it undefined — an undefined pd invites the engine to free-roll
        // a position anywhere in the Hill Sphere on the next Preview, which can land it ahead
        // of existing moons. A locked, deliberately-larger slot keeps "add moon" behaving like
        // "add body" (always appended at the far end) and the engine already treats any
        // defined pd as locked (mgt2e_world_engine.js: `if (w.moons[mn].pd !== undefined)`).
        const SLOT_SPACING = 5; // simple fixed step, in planetary diameters
        const existingPds = (parent.moons || []).map(m => m.pd).filter(v => v != null);
        const nextPd = existingPds.length > 0 ? Math.max(...existingPds) + SLOT_SPACING : SLOT_SPACING;
        const hillLimit = parent._raw && parent._raw.hillSpanPd;
        const willCrowdHill = hillLimit != null && nextPd > hillLimit;

        parent.moons.push({
            _id: _uid('moon'), type: 'Satellite',
            name: '', uwp: null, isMainworld: false,
            travelZone: 'G', _uwpSeed: null, _raw: {},
            // hillLimit unknown (parent never previewed yet) — fall back to undefined and let
            // the engine roll a position once, same as before this fix.
            // Not added to _manualFields: locking only requires pd !== undefined (see engine
            // check above) — _manualFields is reserved for fields the user deliberately typed,
            // since it also drives the accordion's "manually edited" highlight.
            pd: hillLimit != null ? nextPd : undefined,
            _manualFields: [],
        });
        _renderAndPreview();
        // Force the parent body open so the new moon is immediately visible
        const bodyEl = _editorPanel && _editorPanel.querySelector(`details[data-body-id="${parentBodyId}"]`);
        if (bodyEl) bodyEl.open = true;

        if (willCrowdHill) {
            _showWarn('Hill Sphere Crowded',
                `This moon's orbit (${nextPd.toFixed(1)} pd) exceeds the gas giant's Hill Sphere limit ` +
                `(${hillLimit.toFixed(1)} pd) — it may be destroyed when the system regenerates. ` +
                `You can lower its orbit (⌀) value manually.`,
                [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
        }
    }

    function _deleteBody(bodyId) {
        const body = _workingCopy.bodies.find(b => b._id === bodyId);
        if (!body) return;
        const moonCount = (body.moons || []).length;
        const doDelete = () => {
            _pushHistory();
            _workingCopy.bodies = _workingCopy.bodies.filter(b => b._id !== bodyId);
            const mwGone = _workingCopy.mainworldRef === bodyId ||
                (body.moons || []).some(m => m._id === _workingCopy.mainworldRef);
            if (mwGone) _workingCopy.mainworldRef = null;
            _renderAndPreview();
        };
        if (moonCount > 0) {
            _showWarn('Delete Body?',
                `This body has ${moonCount} moon${moonCount !== 1 ? 's' : ''} that will also be deleted.`,
                [
                    { label: 'Delete All', cls: 'btn-cancel', onClick: doDelete },
                    { label: 'Keep',       cls: 'btn-save',   onClick: () => {} },
                ]
            );
        } else {
            doDelete();
        }
    }

    function _deleteMoon(parentBodyId, moonId) {
        const parent = _workingCopy.bodies.find(b => b._id === parentBodyId);
        if (!parent) return;
        const moon = parent.moons.find(m => m._id === moonId);
        _pushHistory();
        parent.moons = parent.moons.filter(m => m._id !== moonId);
        if (moon && moon.isMainworld) _workingCopy.mainworldRef = null;
        _renderAndPreview();
    }

    function _deleteStar(starId) {
        if (_workingCopy.stars.length <= 1) {
            _showWarn('Cannot Delete', 'A system must have at least one star.',
                [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]
            );
            return;
        }
        // Collect the target star plus any sub-companions that orbit it
        const subStarIds    = _workingCopy.stars.filter(s => s.parentStarId === starId).map(s => s._id);
        const allDeleteIds  = new Set([starId, ...subStarIds]);
        const starBodies    = _workingCopy.bodies.filter(b => allDeleteIds.has(b.parentStarId));
        const bodyCount     = starBodies.length;
        const mwBodyIds     = new Set(starBodies.map(b => b._id));
        const mwGone        = mwBodyIds.has(_workingCopy.mainworldRef) ||
            starBodies.some(b => b.moons.some(m => m._id === _workingCopy.mainworldRef));
        const doDelete = () => {
            _pushHistory();
            _workingCopy.stars  = _workingCopy.stars.filter(s => !allDeleteIds.has(s._id));
            _workingCopy.bodies = _workingCopy.bodies.filter(b => !allDeleteIds.has(b.parentStarId));
            if (mwGone) _workingCopy.mainworldRef = null;
            _renderAndPreview();
        };
        const subStarText  = subStarIds.length > 0 ? ` (and its companion)` : '';
        const bodyText     = bodyCount > 0
            ? ` and ${bodyCount} orbiting body${bodyCount !== 1 ? 'ies' : ''}` : '';
        _showWarn('Delete Star?',
            `This star${subStarText}${bodyText} will be permanently removed.`,
            [
                { label: 'Delete Star', cls: 'btn-cancel', onClick: doDelete },
                { label: 'Cancel',      cls: 'btn-save',   onClick: () => {} },
            ]
        );
    }

    function _restoreBeltType(b) {
        // At import, mainworld bodies have type forced to 'World' regardless of physical type.
        // Size 0 uniquely identifies an asteroid belt — restore the canonical type so
        // _buildSeedSys sends 'Planetoid Belt' to the generator instead of 'Terrestrial Planet'.
        const rawSize = b._raw && b._raw.size;
        if (rawSize === 0 || rawSize === '0') b.type = 'Belt';
    }

    function _setMainworld(bodyId, isMoon, parentBodyId) {
        _pushHistory();
        _workingCopy.bodies.forEach(b => {
            if (b.isMainworld) _restoreBeltType(b);
            b.isMainworld = false;
            (b.moons || []).forEach(m => { m.isMainworld = false; });
        });
        if (isMoon) {
            const parent = _workingCopy.bodies.find(b => b._id === parentBodyId);
            if (parent) {
                const moon = parent.moons.find(m => m._id === bodyId);
                if (moon) {
                    moon.isMainworld = true;
                    if (!moon._manualFields.includes('isMainworld')) moon._manualFields.push('isMainworld');
                }
            }
        } else {
            const body = _workingCopy.bodies.find(b => b._id === bodyId);
            if (body) {
                body.isMainworld = true;
                if (!body._manualFields.includes('isMainworld')) body._manualFields.push('isMainworld');
            }
        }
        _workingCopy.mainworldRef = bodyId;
        _renderAndPreview();
    }

    function _clearMainworld(bodyId, isMoon, parentBodyId) {
        _pushHistory();
        if (isMoon) {
            const parent = _workingCopy.bodies.find(b => b._id === parentBodyId);
            if (parent) {
                const moon = parent.moons.find(m => m._id === bodyId);
                if (moon) moon.isMainworld = false;
            }
        } else {
            const body = _workingCopy.bodies.find(b => b._id === bodyId);
            if (body) { body.isMainworld = false; _restoreBeltType(body); }
        }
        _workingCopy.mainworldRef = null;
        _renderAndPreview();
    }

    function _regenerateBody(bodyId) {
        const engine = _workingCopy.engine;
        if (engine !== 'MgT2E') {
            _showWarn('Unsupported Engine',
                'Regeneration is only available for MgT2E systems.',
                [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
            return;
        }

        const hexId   = _workingCopy.hexId;
        const seedSys = _buildSeedSys(_workingCopy);
        _resolveStarPhysics(seedSys, engine);

        const worlds    = seedSys.worlds || [];
        const targetIdx = worlds.findIndex(w => w._id === bodyId);
        if (targetIdx === -1) return;

        // Snapshot all non-target bodies' content for post-generation restoration.
        // The generators always re-roll every body, so we pin the others manually.
        const snapshots = worlds.map((w, i) => {
            if (i === targetIdx) return null;
            return {
                uwp:        w.uwp        ?? null,
                name:       w.name       || '',
                travelZone: w.travelZone || 'G',
                ggType:     w.ggType     || null,
                moons:      w.moons      ? JSON.parse(JSON.stringify(w.moons)) : [],
            };
        });

        _pushHistory();

        if (!_previewOriginalState) {
            const orig = (typeof hexStates !== 'undefined') ? hexStates.get(hexId) : undefined;
            _previewOriginalState = {
                hexId,
                existed: orig !== undefined,
                state:   orig ? JSON.parse(JSON.stringify(orig)) : null,
            };
        }

        let stateObj = (typeof hexStates !== 'undefined' && hexStates.get(hexId))
            ? hexStates.get(hexId)
            : { hexId, type: 'SYSTEM_PRESENT' };

        let newSys = null;
        try {
            newSys = _runGenerator(hexId, engine, seedSys, stateObj, _workingCopy);
        } catch (err) {
            console.error('[SystemEditor] Regenerate failed:', err);
            _showWarn('Regenerate Error',
                `The generator encountered an error:\n${err.message}`,
                [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
            return;
        }
        if (!newSys) return;

        // Restore non-target bodies. stateObj.mgtSystem === newSys (same ref), so
        // patching newSys.worlds[i] also patches the stored system object.
        const newWorlds = newSys.worlds || [];
        snapshots.forEach((snap, i) => {
            if (!snap || !newWorlds[i]) return;
            if (snap.uwp  != null)              newWorlds[i].uwp        = snap.uwp;
            if (snap.name)                      newWorlds[i].name       = snap.name;
            if (snap.travelZone)                newWorlds[i].travelZone = snap.travelZone;
            if (snap.ggType)                    newWorlds[i].ggType     = snap.ggType;
            if (snap.moons && snap.moons.length) newWorlds[i].moons     = snap.moons;
        });

        // Backfill the freshly-generated target body's properties into the working copy.
        const newTargetWorld = newWorlds[targetIdx];
        if (newTargetWorld) {
            const wcBody = _workingCopy.bodies.find(b => b._id === bodyId);
            if (wcBody) {
                wcBody.uwp = newTargetWorld.uwp || null;
                if (newTargetWorld.ggType) wcBody.ggType = newTargetWorld.ggType;
            }
        }

        // Preserve mainworld name (same pattern as _preview and _fillAndSave).
        const mwBody = _workingCopy.bodies.find(b => b._id === _workingCopy.mainworldRef)
            || _workingCopy.bodies.find(b => b.isMainworld);
        const mwName = mwBody && mwBody.name ? mwBody.name : null;
        if (mwName) {
            stateObj.name = mwName;
            if (stateObj.mgt2eData) stateObj.mgt2eData.name = mwName;
            if (stateObj.ctData)    stateObj.ctData.name    = mwName;
            if (stateObj.t5Data)    stateObj.t5Data.name    = mwName;
            if (stateObj.rttData)   stateObj.rttData.name   = mwName;
        } else if (!stateObj.name && typeof getNextSystemName === 'function') {
            stateObj.name = getNextSystemName(hexId);
        }

        stateObj.type = 'SYSTEM_PRESENT';
        if (typeof computeSystemCounts === 'function') computeSystemCounts(stateObj);
        if (typeof hexStates !== 'undefined') hexStates.set(hexId, stateObj);
        if (typeof requestAnimationFrame === 'function' && typeof draw === 'function') {
            requestAnimationFrame(draw);
        }
        if (typeof SystemViewer !== 'undefined' && SystemViewer.isOpen()) {
            SystemViewer.refresh(hexId);
        }
        _renderEditorTree();
    }

    // Insert draggedObj at targetOrbitId, shifting all items between old and new position by ±1.
    // Works on the combined pool of bodies + non-primary companion stars.
    function _insertAtOrbit(draggedObj, targetOrbitId) {
        const oldOrbit = draggedObj.orbitId;
        if (oldOrbit == null || targetOrbitId == null || oldOrbit === targetOrbitId) return;

        const nonPrimaryStars = _workingCopy.stars.slice(1);
        const pool = [
            ..._workingCopy.bodies,
            ...nonPrimaryStars,
        ].filter(obj => obj !== draggedObj && obj.orbitId != null);

        _pushHistory();

        if (targetOrbitId < oldOrbit) {
            // Moving inward: items in [targetOrbitId, oldOrbit - 1] shift out by +1
            pool.forEach(obj => {
                if (obj.orbitId >= targetOrbitId && obj.orbitId < oldOrbit) {
                    obj.orbitId += 1;
                    if (!obj._manualFields.includes('orbitId')) obj._manualFields.push('orbitId');
                }
            });
        } else {
            // Moving outward: items in [oldOrbit + 1, targetOrbitId] shift in by -1
            pool.forEach(obj => {
                if (obj.orbitId > oldOrbit && obj.orbitId <= targetOrbitId) {
                    obj.orbitId -= 1;
                    if (!obj._manualFields.includes('orbitId')) obj._manualFields.push('orbitId');
                }
            });
        }

        draggedObj.orbitId = targetOrbitId;
        if (!draggedObj._manualFields.includes('orbitId')) draggedObj._manualFields.push('orbitId');
        _renderAndPreview();
    }

    // Returns true if changing item's orbitId to newOrbitId would cross a neighbor in its merged list.
    function _wouldReorder(item, isStar, newOrbitId) {
        if (newOrbitId == null) return false;
        const oldAU = _orbitIdToAU(item.orbitId) ?? item.au ?? item.orbitAU;
        const newAU = _orbitIdToAU(newOrbitId);
        if (oldAU == null || newAU == null || oldAU === newAU) return false;

        const lo = Math.min(oldAU, newAU);
        const hi = Math.max(oldAU, newAU);

        let neighbors;
        if (isStar) {
            // Companion star: neighbors are primary bodies + other companion stars
            const primaryId = (_workingCopy.stars[0] || {})._id;
            const primaryBodies = _workingCopy.bodies.filter(b => b.parentStarId === primaryId && b !== item);
            const otherComps = _workingCopy.stars.slice(1).filter(s => s !== item);
            neighbors = [...primaryBodies, ...otherComps];
        } else {
            // Body: neighbors are siblings under same star; if under primary, also include companions
            const siblings = _workingCopy.bodies.filter(b => b.parentStarId === item.parentStarId && b !== item);
            const primaryId = (_workingCopy.stars[0] || {})._id;
            const comps = item.parentStarId === primaryId
                ? _workingCopy.stars.slice(1)
                : [];
            neighbors = [...siblings, ...comps];
        }

        return neighbors.some(n => {
            const au = _orbitIdToAU(n.orbitId) ?? n.au ?? n.orbitAU;
            return au != null && au > lo && au < hi;
        });
    }

    // ── Render editor tree ────────────────────────────────────────────────────

    function _renderAndPreview() { _renderEditorTree(); _preview(); }

    function _renderEditorTree() {
        if (!_editorPanel || !_workingCopy) return;
        const treeEl = _editorPanel.querySelector('#se-body-tree');
        if (!treeEl) return;

        // Preserve open/closed state of body and star <details> elements before re-render
        const openBodyIds = new Set();
        treeEl.querySelectorAll('details[data-body-id]').forEach(el => {
            if (el.open) openBodyIds.add(el.getAttribute('data-body-id'));
        });
        const openStarIds = new Set();
        treeEl.querySelectorAll('details[data-star-id]').forEach(el => {
            if (el.open) openStarIds.add(el.getAttribute('data-star-id'));
        });
        const primaryStarOpen = !!(treeEl.querySelector('details[data-primary-star]') || {}).open;
        treeEl.innerHTML = '';

        const P = {
            border: '#45a29e55', text: '#c5c6c7', accent: '#66fcf1',
            sub: '#8a8f94', mw: '#ffa500', star: '#ffe082', dim: '#555e66',
        };

        // Group bodies by parent star, sorted by orbit
        const _sortAU = obj => _orbitIdToAU(obj.orbitId) ?? obj.au ?? obj.orbitAU ?? Infinity;
        const bodiesByStarId = {};
        [..._workingCopy.bodies].sort((a, b) =>
            _sortAU(a) - _sortAU(b)
        ).forEach(b => {
            const key = b.parentStarId || '_none';
            (bodiesByStarId[key] = bodiesByStarId[key] || []).push(b);
        });

        // ── Helper: labelled input row for star spectral type fields
        function _starInputRow(labelText, value, opts, onChange) {
            const row = document.createElement('div');
            Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11px' });
            const lbl = document.createElement('label');
            lbl.textContent = labelText;
            Object.assign(lbl.style, { color: P.sub, minWidth: '54px' });
            const inp = document.createElement('input');
            inp.type = opts.type || 'text';
            inp.value = value != null ? value : '';
            if (opts.maxLength) inp.maxLength = opts.maxLength;
            if (opts.min != null) inp.min = String(opts.min);
            if (opts.max != null) inp.max = String(opts.max);
            if (opts.step != null) inp.step = String(opts.step);
            inp.placeholder = opts.placeholder || '';
            Object.assign(inp.style, {
                width: opts.width || '60px', background: 'transparent', border: `1px solid ${P.border}`,
                color: P.accent, fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
            });
            inp.addEventListener('change', () => onChange(inp.value));
            row.append(lbl, inp);
            return row;
        }

        // ── Helper: labelled dropdown row for star spectral fields
        function _starSelectRow(labelText, currentValue, choices, disabled, onChange) {
            const row = document.createElement('div');
            Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11px' });
            const lbl = document.createElement('label');
            lbl.textContent = labelText;
            Object.assign(lbl.style, { color: P.sub, minWidth: '54px' });
            const sel = document.createElement('select');
            Object.assign(sel.style, {
                background: '#0d1117', border: `1px solid ${P.border}`,
                color: disabled ? P.dim : P.accent,
                fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
                opacity: disabled ? '0.55' : '1', cursor: disabled ? 'not-allowed' : 'default',
            });
            sel.disabled = disabled;
            choices.forEach(c => {
                const opt = document.createElement('option');
                opt.value = String(c.value);
                opt.textContent = c.label;
                if (String(c.value) === String(currentValue)) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', () => onChange(sel.value));
            row.append(lbl, sel);
            return row;
        }

        // ── Helper: numeric input row for derived stellar properties (null = auto-derive)
        function _derivedRow(labelText, value, unit, onSet) {
            const row = document.createElement('div');
            Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', fontSize: '11px' });
            const lbl = document.createElement('label');
            lbl.textContent = labelText;
            Object.assign(lbl.style, { color: P.sub, minWidth: '42px', flexShrink: '0' });

            const inp = document.createElement('input');
            inp.type = 'number'; inp.step = 'any';
            inp.value = value != null ? String(+value.toFixed(5)) : '';
            inp.placeholder = 'auto';
            Object.assign(inp.style, {
                width: '78px', background: 'transparent',
                border: `1px solid ${P.border}`,
                color: value != null ? P.accent : P.dim,
                fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
            });
            inp.addEventListener('change', () => {
                const v = inp.value.trim();
                if (v === '') {
                    inp.style.color = P.dim;
                    onSet(null);
                    // No auto-preview — user is clearing fields for batch re-derivation;
                    // they'll click Preview when ready.
                } else {
                    const n = parseFloat(v);
                    if (!isNaN(n)) {
                        inp.style.color = P.accent;
                        onSet(n);
                        _preview();
                    }
                }
            });

            const unitSpan = document.createElement('span');
            unitSpan.textContent = unit;
            Object.assign(unitSpan.style, { color: P.dim, fontSize: '10px', minWidth: '22px' });

            const clearBtn = document.createElement('button');
            clearBtn.textContent = '×';
            clearBtn.title = 'Clear — engine auto-derives on next update';
            Object.assign(clearBtn.style, {
                background: 'none', border: 'none', color: P.dim,
                cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: '1',
            });
            clearBtn.addEventListener('click', () => {
                inp.value = ''; inp.style.color = P.dim;
                onSet(null);
                // No auto-preview — user may clear more fields before previewing.
            });

            row.append(lbl, inp, unitSpan, clearBtn);
            return row;
        }

        // ── Helper: builds the collapsible Derived Properties group for a star
        function _buildDerivedGroup(star) {
            const grp = document.createElement('details');
            Object.assign(grp.style, { marginTop: '4px', fontSize: '11px' });
            const sum = document.createElement('summary');
            sum.textContent = 'Derived Properties';
            Object.assign(sum.style, { cursor: 'pointer', color: P.sub, userSelect: 'none', padding: '1px 0' });
            grp.appendChild(sum);

            const pad = document.createElement('div');
            Object.assign(pad.style, { paddingLeft: '4px', paddingTop: '2px' });

            const fmt4 = v => v != null ? parseFloat(v.toFixed(4)) : null;

            pad.appendChild(_derivedRow('Mass:', fmt4(star.mass), 'M☉', val => {
                _pushHistory(); star.mass = val;
                if (val != null) { if (!star._manualFields.includes('mass')) star._manualFields.push('mass'); }
                else { star._manualFields = star._manualFields.filter(f => f !== 'mass'); }
            }));
            pad.appendChild(_derivedRow('Lum:', fmt4(star.lum), 'L☉', val => {
                _pushHistory(); star.lum = val;
                if (val != null) { if (!star._manualFields.includes('lum')) star._manualFields.push('lum'); }
                else { star._manualFields = star._manualFields.filter(f => f !== 'lum'); }
            }));
            pad.appendChild(_derivedRow('Diam:', fmt4(star.diam), 'D☉', val => {
                _pushHistory(); star.diam = val;
                if (val != null) { if (!star._manualFields.includes('diam')) star._manualFields.push('diam'); }
                else { star._manualFields = star._manualFields.filter(f => f !== 'diam'); }
            }));
            pad.appendChild(_derivedRow('Temp:', star.temp != null ? Math.round(star.temp) : null, 'K', val => {
                _pushHistory(); star.temp = val;
                if (val != null) { if (!star._manualFields.includes('temp')) star._manualFields.push('temp'); }
                else { star._manualFields = star._manualFields.filter(f => f !== 'temp'); }
            }));
            pad.appendChild(_derivedRow('MAO:', fmt4(star.mao), 'orb', val => {
                _pushHistory(); star.mao = val;
                if (val != null) { if (!star._manualFields.includes('mao')) star._manualFields.push('mao'); }
                else { star._manualFields = star._manualFields.filter(f => f !== 'mao'); }
            }));

            grp.appendChild(pad);
            return grp;
        }

        // ── Build a body <details> element (shared by primary and companion sections)
        function _buildBodyEl(body) {
            const bodyEl = document.createElement('details');
            Object.assign(bodyEl.style, {
                marginTop: '2px', border: `1px solid ${P.border}`, borderRadius: '3px',
            });
            bodyEl.setAttribute('data-body-id', body._id);
            bodyEl.draggable = true;

            bodyEl.addEventListener('dragstart', e => {
                _dragBodyId = body._id;
                _dragStarId = body.parentStarId;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { bodyEl.style.opacity = '0.4'; }, 0);
            });
            bodyEl.addEventListener('dragend', () => {
                bodyEl.style.opacity = '1';
                _dragBodyId = null; _dragStarId = null;
                treeEl.querySelectorAll('[data-body-id]').forEach(el => { el.style.borderColor = P.border; });
            });
            bodyEl.addEventListener('dragover', e => {
                if (_dragCompanionId) {
                    // Companion being dragged over a primary-level body
                    if (body.parentStarId !== (_workingCopy.stars[0] || {})._id) return;
                    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                    bodyEl.style.borderColor = P.accent;
                    return;
                }
                if (!_dragBodyId || _dragBodyId === body._id) return;
                if (body.parentStarId !== _dragStarId) { e.dataTransfer.dropEffect = 'none'; return; }
                e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                bodyEl.style.borderColor = P.accent;
            });
            bodyEl.addEventListener('dragleave', () => { bodyEl.style.borderColor = P.border; });
            bodyEl.addEventListener('drop', e => {
                e.preventDefault();
                bodyEl.style.borderColor = P.border;
                if (_dragCompanionId) {
                    // Drop companion onto this body — insert companion at body's orbit
                    const comp = _workingCopy.stars.find(s => s._id === _dragCompanionId);
                    if (comp && body.parentStarId === (_workingCopy.stars[0] || {})._id) {
                        _insertAtOrbit(comp, body.orbitId);
                    }
                    return;
                }
                if (_dragBodyId && _dragBodyId !== body._id && body.parentStarId === _dragStarId) {
                    const dragBody = _workingCopy.bodies.find(b => b._id === _dragBodyId);
                    if (dragBody) _insertAtOrbit(dragBody, body.orbitId);
                }
            });

            // Summary row
            const typeLabel = body.type === 'Gas Giant'
                ? `Gas Giant (${body.ggType || '?'})`
                : (body.isMainworld ? 'Mainworld' : body.type);
            const orbitStr = body.orbitId != null ? ` ·${parseFloat(body.orbitId.toFixed(3))}` :
                             body.au != null ? ` ·${Number(body.au).toFixed(1)}AU` : '';
            const nameStr = body.name ? ` "${body.name}"` : '';
            const uwpStr  = body.uwp  ? ` ${body.uwp}` : '';

            const summary = document.createElement('summary');
            Object.assign(summary.style, {
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 5px', cursor: 'pointer',
                color: body.isMainworld ? P.mw : P.text,
                listStyle: 'none', fontSize: '11px', userSelect: 'none',
            });

            const dragHandle = document.createElement('span');
            dragHandle.textContent = '≡';
            Object.assign(dragHandle.style, { color: P.dim, cursor: 'grab', marginRight: '2px', fontSize: '12px' });

            const summaryLabel = document.createElement('span');
            summaryLabel.textContent = `${body.isMainworld ? '★ ' : ''}${typeLabel}${nameStr}${uwpStr}${orbitStr}`;
            summaryLabel.style.flex = '1';

            summary.appendChild(dragHandle);
            summary.appendChild(summaryLabel);

            const isMW = body.isMainworld;
            if (body.type !== 'Gas Giant') {
                summary.appendChild(_btn(
                    isMW ? '★MW' : '☆MW',
                    isMW ? 'Remove mainworld flag' : 'Set as mainworld',
                    () => isMW ? _clearMainworld(body._id, false, null) : _setMainworld(body._id, false, null),
                    isMW
                ));
            }
            if (body.type !== 'Belt') {
                summary.appendChild(_btn('+Moon', 'Add moon', () => _addMoon(body._id)));
            }
            summary.appendChild(_btn('↻', 'Regenerate this body', () => _regenerateBody(body._id)));
            summary.appendChild(_btn('✕', 'Delete body', () => _deleteBody(body._id)));
            bodyEl.appendChild(summary);

            // Detail pad
            const detailPad = document.createElement('div');
            Object.assign(detailPad.style, { padding: '4px 8px 4px 12px' });

            // Name input
            const nameRow = document.createElement('div');
            Object.assign(nameRow.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11px' });
            const nameLbl = document.createElement('label');
            nameLbl.textContent = 'Name:';
            Object.assign(nameLbl.style, { color: P.sub, minWidth: '38px' });
            const nameInput = document.createElement('input');
            nameInput.type = 'text'; nameInput.value = body.name || '';
            Object.assign(nameInput.style, {
                flex: '1', background: 'transparent', border: `1px solid ${P.border}`,
                color: P.accent, fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
            });
            nameInput.addEventListener('change', () => {
                _pushHistory(); body.name = nameInput.value;
                summaryLabel.textContent = `${body.isMainworld ? '★ ' : ''}${typeLabel}${body.name ? ` "${body.name}"` : ''}${uwpStr}${orbitStr}`;
            });
            nameRow.append(nameLbl, nameInput);
            detailPad.appendChild(nameRow);

            // Orbit # input
            const orbitRow = document.createElement('div');
            Object.assign(orbitRow.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11px' });
            const orbitLbl = document.createElement('label');
            orbitLbl.textContent = 'Orbit #:';
            Object.assign(orbitLbl.style, { color: P.sub, minWidth: '38px' });
            const isCtOrbitSlot = _workingCopy.engine === 'CT';

            // A CT Captured Planet (RAW Book 6 anomaly) never occupies a discrete orbit slot —
            // it keeps its own already-rolled fractional orbit/distance permanently (see
            // ct_editor_adapter.js write()'s buildCaptured — "there's no UI to move one").
            // orbitId is therefore always null for one, which previously rendered as a plain
            // editable number input with an "auto" placeholder — indistinguishable from a
            // genuinely-undecided field the engine will roll on next Preview, when the real
            // value (body._raw.orbit) is already fixed and known. Show it read-only instead.
            const isCtCaptured = isCtOrbitSlot && body.orbitId == null && body._raw && body._raw.orbit != null;

            if (isCtCaptured) {
                const fixedSpan = document.createElement('span');
                const _capAu = body.au != null ? `→ ${Number(body.au).toFixed(2)} AU` : '';
                fixedSpan.textContent = `${body._raw.orbit} ${_capAu} (fixed — captured planet)`;
                fixedSpan.title = 'CT captured planets keep their originally-rolled orbit permanently; they are not repositioned via drag-and-drop or this field.';
                Object.assign(fixedSpan.style, { color: P.dim, fontSize: '11px' });
                orbitRow.append(orbitLbl, fixedSpan);
                detailPad.appendChild(orbitRow);
            } else {
            const orbitInput = document.createElement('input');
            orbitInput.type = 'number'; orbitInput.value = body.orbitId != null ? parseFloat(body.orbitId.toFixed(3)) : '';
            orbitInput.min = '0';
            // CT orbits are discrete integer slots (0="Orbit 0"=0.2 AU, 1=0.4 AU, ...) via
            // ORBIT_AU, not a continuous AU value — a fractional entry here (e.g. 0.2, meant as
            // an AU distance) missed CT's array lookup entirely and silently corrupted the
            // body's real distance to a hardcoded 1.0 AU fallback, which also scrambled the hex
            // info panel's by-distance sort order (see ct_bottomup_generator.js's fix). Other
            // engines keep the finer step for their own continuous-AU orbit conventions.
            orbitInput.step = isCtOrbitSlot ? '1' : '0.001';
            orbitInput.placeholder = 'auto';
            Object.assign(orbitInput.style, {
                width: '60px', background: 'transparent', border: `1px solid ${P.border}`,
                color: P.accent, fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
            });
            orbitInput.addEventListener('change', () => {
                let newOrbitId = orbitInput.value !== '' ? parseFloat(orbitInput.value) : null;
                if (isCtOrbitSlot && newOrbitId != null) newOrbitId = Math.round(newOrbitId);
                if (_wouldReorder(body, false, newOrbitId)) {
                    orbitInput.value = body.orbitId != null ? parseFloat(body.orbitId.toFixed(3)) : '';
                    _showWarn('Use Drag & Drop',
                        'Reorder orbital bodies by dragging and dropping.',
                        [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
                    return;
                }
                _pushHistory();
                body.orbitId = newOrbitId;
                if (!body._manualFields.includes('orbitId')) body._manualFields.push('orbitId');
                _renderAndPreview();
            });
            const orbitAuSpan = document.createElement('span');
            const _bodyAu = _orbitIdToAU(body.orbitId);
            orbitAuSpan.textContent = _bodyAu != null ? `→ ${_bodyAu.toFixed(2)} AU` : '';
            Object.assign(orbitAuSpan.style, { color: P.dim, fontSize: '11px' });
            orbitRow.append(orbitLbl, orbitInput, orbitAuSpan);
            detailPad.appendChild(orbitRow);
            }

            // Gas Giant size (CT only — RAW Book 3/6 has just two tiers, no Medium: a 1D roll
            // of 1-3 is Large, 4-6 is Small, rules/ct_data.js CT_BODY_SIZES.GG). Never had a UI
            // control before — ggType was fixed at creation ('+GG' always defaults to Small) or
            // read from a previously-generated body (readOrbitSlots in ct_editor_adapter.js,
            // fixed 2026-07-12 to compare against 'Small' instead of 'S' — see OW-23; the old
            // comparison never matched, so an existing Small Gas Giant was always silently
            // misread as Large, and re-saving without touching it would have flipped it).
            if (body.type === 'Gas Giant' && _workingCopy.engine === 'CT') {
                const ggRow = document.createElement('div');
                Object.assign(ggRow.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11px' });
                const ggLbl = document.createElement('label');
                ggLbl.textContent = 'Size:';
                Object.assign(ggLbl.style, { color: P.sub, minWidth: '38px' });
                const ggSel = document.createElement('select');
                Object.assign(ggSel.style, {
                    background: '#0d1117', border: `1px solid ${P.border}`,
                    color: P.accent, fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
                });
                [['GL', 'Large'], ['GS', 'Small']].forEach(([val, label]) => {
                    const opt = document.createElement('option');
                    opt.value = val; opt.textContent = label;
                    if ((body.ggType || 'GL') === val) opt.selected = true;
                    ggSel.appendChild(opt);
                });
                ggSel.addEventListener('change', () => {
                    _pushHistory();
                    body.ggType = ggSel.value;
                    // Gas Giant mass/gravity are hardcoded-by-size constants at CT skeleton
                    // placement (ct_world_engine.js: 2.5G/300 Earth masses Large, 0.8G/50
                    // Small) — not derived from a formula — so update them to match the new
                    // size here, rather than leaving the old size's values locked in via
                    // _ctUwpLockFor's unconditional GG mass/gravity/diamKm preservation.
                    body._raw = body._raw || {};
                    body._raw.gravity = ggSel.value === 'GS' ? 0.8 : 2.5;
                    body._raw.mass    = ggSel.value === 'GS' ? 50  : 300;
                    // Diameter is randomly rolled per-size (ct_physical_library.js /
                    // ct_bottomup_generator.js both only roll when `!body.diamKm`) — clear the
                    // old one so the next Preview rolls a fresh, size-appropriate diameter
                    // instead of carrying forward a value scaled for the previous size.
                    delete body._raw.diamKm;
                    _renderAndPreview();
                });
                ggRow.append(ggLbl, ggSel);
                detailPad.appendChild(ggRow);
            }

            if (body.uwp) {
                const uwpRow = document.createElement('div');
                Object.assign(uwpRow.style, { fontSize: '11px', color: P.sub, marginBottom: '2px' });
                uwpRow.textContent = `UWP: ${body.uwp}`;
                detailPad.appendChild(uwpRow);
            }

            // UWP seed boxes — only for newly added terrestrial/mainworld bodies (no generated UWP yet)
            if (!body.uwp && body.type !== 'Belt' && body.type !== 'Gas Giant') {
                if (!body._uwpSeed) body._uwpSeed = { st:null, s:null, a:null, h:null, p:null, g:null, l:null, tl:null };
                const seedSection = document.createElement('div');
                Object.assign(seedSection.style, { marginTop: '4px', marginBottom: '3px' });
                const seedLabel = document.createElement('div');
                seedLabel.textContent = 'Seed UWP digits (optional):';
                Object.assign(seedLabel.style, { fontSize: '10px', color: P.dim, marginBottom: '2px' });
                seedSection.appendChild(seedLabel);
                const boxRow = document.createElement('div');
                Object.assign(boxRow.style, { display: 'flex', gap: '5px', alignItems: 'flex-end' });
                [['st','St'],['s','S'],['a','A'],['h','H'],['p','P'],['g','G'],['l','L'],['tl','TL']].forEach(([key, lbl]) => {
                    const cell = document.createElement('div');
                    Object.assign(cell.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' });
                    const cellLbl = document.createElement('span');
                    cellLbl.textContent = lbl;
                    Object.assign(cellLbl.style, { fontSize: '9px', color: P.dim });
                    const inp = document.createElement('input');
                    inp.type = 'text'; inp.maxLength = 1;
                    inp.value = body._uwpSeed[key] || '';
                    Object.assign(inp.style, {
                        width: '20px', textAlign: 'center', background: 'transparent',
                        border: `1px solid ${body._uwpSeed[key] ? P.accent : P.border}`,
                        color: body._uwpSeed[key] ? P.accent : P.dim,
                        fontFamily: 'inherit', fontSize: '11px', padding: '2px 0',
                    });
                    inp.addEventListener('input', () => {
                        const v = _uwpSeedFilter(key, inp.value);
                        if (inp.value !== v) inp.value = v;
                        inp.style.color = v ? P.accent : P.dim;
                        inp.style.borderColor = v ? P.accent : P.border;
                    });
                    inp.addEventListener('change', () => {
                        const v = _uwpSeedFilter(key, inp.value);
                        inp.value = v;
                        _pushHistory();
                        body._uwpSeed[key] = v || null;
                        const fieldName = _UWP_SEED_FIELD_MAP[key];
                        if (fieldName) {
                            if (v) { if (!body._manualFields.includes(fieldName)) body._manualFields.push(fieldName); }
                            else { body._manualFields = body._manualFields.filter(f => f !== fieldName); }
                        }
                    });
                    cell.append(cellLbl, inp);
                    boxRow.appendChild(cell);
                });
                seedSection.appendChild(boxRow);
                detailPad.appendChild(seedSection);
            }
            if (body.travelZone && body.travelZone !== 'G') {
                const zoneRow = document.createElement('div');
                Object.assign(zoneRow.style, {
                    fontSize: '11px', marginBottom: '2px',
                    color: body.travelZone === 'Red' ? '#ff6b6b' : '#ffa500',
                });
                zoneRow.textContent = `Zone: ${body.travelZone}`;
                detailPad.appendChild(zoneRow);
            }

            // Moons
            if (body.moons && body.moons.length > 0) {
                const moonHeader = document.createElement('div');
                Object.assign(moonHeader.style, {
                    fontSize: '10px', color: P.sub, marginTop: '4px', marginBottom: '2px',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                });
                moonHeader.textContent = `Moons (${body.moons.length})`;
                detailPad.appendChild(moonHeader);

                const moonContainer = document.createElement('div');
                Object.assign(moonContainer.style, {
                    borderLeft: `1px solid ${P.border}`, marginLeft: '8px', paddingLeft: '8px', marginTop: '2px',
                });
                body.moons.forEach(moon => {
                    const moonRow = document.createElement('div');
                    Object.assign(moonRow.style, { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px', fontSize: '11px' });
                    const moonNameInput = document.createElement('input');
                    moonNameInput.type = 'text'; moonNameInput.value = moon.name || '';
                    moonNameInput.placeholder = moon.isMainworld ? '★ Mainworld Moon' : 'Moon name…';
                    Object.assign(moonNameInput.style, {
                        flex: '1', background: 'transparent', border: `1px solid ${P.border}`,
                        color: moon.isMainworld ? P.mw : P.sub, fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
                    });
                    moonNameInput.addEventListener('change', () => { _pushHistory(); moon.name = moonNameInput.value; });
                    const isMoonMW = moon.isMainworld;
                    moonRow.appendChild(moonNameInput);
                    moonRow.appendChild(_btn(
                        isMoonMW ? '★MW' : '☆MW',
                        isMoonMW ? 'Remove mainworld flag' : 'Set moon as mainworld',
                        () => isMoonMW ? _clearMainworld(moon._id, true, body._id) : _setMainworld(moon._id, true, body._id),
                        isMoonMW
                    ));
                    moonRow.appendChild(_btn('✕', 'Delete moon', () => _deleteMoon(body._id, moon._id)));
                    moonContainer.appendChild(moonRow);

                    // Orbit distance (pd) — directly editable, same pattern as the star
                    // Derived Properties fields. Clearing hands the moon back to the engine
                    // to roll a fresh position on the next Preview.
                    moonContainer.appendChild(_derivedRow(
                        'Orbit (⌀):',
                        moon.pd != null ? Math.round(moon.pd * 100) / 100 : null,
                        'pd',
                        val => {
                            _pushHistory();
                            // Must assign `undefined`, not `null` — mgt2e_world_engine.js checks
                            // `pd !== undefined` to decide whether to re-roll a position; `null`
                            // would incorrectly be treated as "already positioned at null".
                            moon.pd = (val == null) ? undefined : val;
                            if (val != null) { if (!moon._manualFields.includes('pd')) moon._manualFields.push('pd'); }
                            else { moon._manualFields = moon._manualFields.filter(f => f !== 'pd'); }
                        }
                    ));

                    // UWP seed boxes for newly added moons (no generated UWP yet)
                    if (!moon.uwp) {
                        if (!moon._uwpSeed) moon._uwpSeed = { st:null, s:null, a:null, h:null, p:null, g:null, l:null, tl:null };
                        const moonSeedRow = document.createElement('div');
                        Object.assign(moonSeedRow.style, { display: 'flex', gap: '5px', alignItems: 'flex-end', marginBottom: '4px', marginLeft: '2px' });
                        [['st','St'],['s','S'],['a','A'],['h','H'],['p','P'],['g','G'],['l','L'],['tl','TL']].forEach(([key, lbl]) => {
                            const cell = document.createElement('div');
                            Object.assign(cell.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' });
                            const cellLbl = document.createElement('span');
                            cellLbl.textContent = lbl;
                            Object.assign(cellLbl.style, { fontSize: '9px', color: P.dim });
                            const inp = document.createElement('input');
                            inp.type = 'text'; inp.maxLength = 1;
                            inp.value = moon._uwpSeed[key] || '';
                            Object.assign(inp.style, {
                                width: '20px', textAlign: 'center', background: 'transparent',
                                border: `1px solid ${moon._uwpSeed[key] ? P.accent : P.border}`,
                                color: moon._uwpSeed[key] ? P.accent : P.dim,
                                fontFamily: 'inherit', fontSize: '10px', padding: '1px 0',
                            });
                            inp.addEventListener('input', () => {
                                const v = _uwpSeedFilter(key, inp.value);
                                if (inp.value !== v) inp.value = v;
                                inp.style.color = v ? P.accent : P.dim;
                                inp.style.borderColor = v ? P.accent : P.border;
                            });
                            inp.addEventListener('change', () => {
                                const v = _uwpSeedFilter(key, inp.value);
                                inp.value = v;
                                _pushHistory();
                                moon._uwpSeed[key] = v || null;
                                const fieldName = _UWP_SEED_FIELD_MAP[key];
                                if (fieldName) {
                                    if (v) { if (!moon._manualFields.includes(fieldName)) moon._manualFields.push(fieldName); }
                                    else { moon._manualFields = moon._manualFields.filter(f => f !== fieldName); }
                                }
                            });
                            cell.append(cellLbl, inp);
                            moonSeedRow.appendChild(cell);
                        });
                        moonContainer.appendChild(moonSeedRow);
                    }
                });
                detailPad.appendChild(moonContainer);
            }

            bodyEl.appendChild(detailPad);
            if (openBodyIds.has(body._id)) bodyEl.open = true;
            return bodyEl;
        }

        // ── Build a companion block (expandable <details> header + nested body container)
        function _buildCompanionBlock(star) {
            const block = document.createElement('div');
            Object.assign(block.style, { marginTop: '2px' });

            // Companion header as <details> — expand to edit spectral type and orbit
            const compDetails = document.createElement('details');
            Object.assign(compDetails.style, { border: `1px solid ${P.border}`, borderRadius: '3px' });
            compDetails.setAttribute('data-star-id', star._id);
            compDetails.draggable = true;
            if (openStarIds.has(star._id)) compDetails.open = true;

            const compSummary = document.createElement('summary');
            Object.assign(compSummary.style, {
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 6px', cursor: 'pointer',
                background: '#0d1117', listStyle: 'none', userSelect: 'none',
            });

            const compDragHandle = document.createElement('span');
            compDragHandle.textContent = '≡';
            compDragHandle.title = 'Drag to reorder in orbit list — bodies follow';
            Object.assign(compDragHandle.style, { color: P.dim, cursor: 'grab', fontSize: '12px', flexShrink: '0' });
            compSummary.appendChild(compDragHandle);

            const compOrbitStr = () => star.orbitId != null ? ` ·${parseFloat(star.orbitId.toFixed(3))}` :
                                       star.orbitAU != null ? ` ·${Number(star.orbitAU).toFixed(1)}AU` : '';
            const compLabel = document.createElement('span');
            compLabel.textContent = `⊙ ${star.role}: ${star.sType}${star.subType}${star.sClass}${compOrbitStr()}`;
            Object.assign(compLabel.style, { color: P.star, fontWeight: 'bold', fontSize: '12px', flex: '1' });
            compSummary.appendChild(compLabel);

            // CT: only a Far companion has its own orbit sequence (CT_COMPANION_ORBIT_TABLE) —
            // a Close companion occupies a single slot inside the primary's own sequence and
            // structurally can't have orbiting bodies of its own (see OW-18/OW-19). Hide the
            // add-body buttons for a Close CT companion rather than let the user create bodies
            // that have nowhere valid to round-trip through.
            if (_workingCopy.engine !== 'CT' || star.role === 'Far') {
                compSummary.appendChild(_btn('+World', 'Add terrestrial world', () => _addBody(star._id, 'World')));
                compSummary.appendChild(_btn('+GG',    'Add gas giant',         () => _addBody(star._id, 'Gas Giant')));
                compSummary.appendChild(_btn('+Belt',  'Add planetoid belt',    () => _addBody(star._id, 'Belt')));
            }
            if (star.role !== 'Companion' && _workingCopy.engine !== 'CT') {
                compSummary.appendChild(_btn('+Comp', 'Add companion star to this secondary', () => _addStar('Companion', star._id)));
            }
            compSummary.appendChild(_btn('Del★',   'Delete this star',      () => _deleteStar(star._id)));
            compDetails.appendChild(compSummary);

            // Companion drag events (on the <details> element)
            compDetails.addEventListener('dragstart', e => {
                _dragCompanionId = star._id;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { compDetails.style.opacity = '0.4'; }, 0);
            });
            compDetails.addEventListener('dragend', () => {
                compDetails.style.opacity = '1';
                _dragCompanionId = null;
                treeEl.querySelectorAll('[data-star-id]').forEach(el => { el.style.outline = 'none'; });
                treeEl.querySelectorAll('[data-body-id]').forEach(el => { el.style.borderColor = P.border; });
            });
            compDetails.addEventListener('dragover', e => {
                if (!_dragCompanionId || _dragCompanionId === star._id) return;
                e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                compDetails.style.outline = `1px solid ${P.accent}`;
            });
            compDetails.addEventListener('dragleave', () => { compDetails.style.outline = 'none'; });
            compDetails.addEventListener('drop', e => {
                e.preventDefault();
                compDetails.style.outline = 'none';
                if (_dragCompanionId && _dragCompanionId !== star._id) {
                    const draggedComp = _workingCopy.stars.find(s => s._id === _dragCompanionId);
                    if (draggedComp) _insertAtOrbit(draggedComp, star.orbitId);
                }
            });

            // Companion edit inputs (visible when <details> is expanded)
            const compDetailPad = document.createElement('div');
            Object.assign(compDetailPad.style, { padding: '4px 8px 6px 12px' });

            const updateCompLabel = () => { compLabel.textContent = `⊙ ${star.role}: ${star.sType}${star.subType}${star.sClass}${compOrbitStr()}`; };

            const _compIsExotic = (star.sType === 'D' || star.sType === 'BD');
            compDetailPad.appendChild(_starSelectRow('Type:', star.sType, _STAR_TYPE_CHOICES, false, val => {
                _pushHistory(); star.sType = val;
                if (val === 'D')  { star.sClass = 'D'; star.subType = 0; }
                if (val === 'BD') { star.sClass = 'V'; star.subType = 0; }
                if (!star._manualFields.includes('sType')) star._manualFields.push('sType');
                if (val === 'D' || val === 'BD') { _renderAndPreview(); } else { updateCompLabel(); _preview(); }
            }));
            compDetailPad.appendChild(_starSelectRow('Subtype:', star.subType, _STAR_SUBTYPE_CHOICES, _compIsExotic, val => {
                _pushHistory(); star.subType = parseInt(val);
                if (!star._manualFields.includes('subType')) star._manualFields.push('subType');
                updateCompLabel(); _preview();
            }));
            compDetailPad.appendChild(_starSelectRow('Class:', star.sClass, _STAR_CLASS_CHOICES, _compIsExotic, val => {
                _pushHistory(); star.sClass = val;
                if (!star._manualFields.includes('sClass')) star._manualFields.push('sClass');
                updateCompLabel(); _preview();
            }));

            // Role / separation selector. CT has no "Companion" or "Near" separation category —
            // CT_COMPANION_ORBIT_TABLE (rules/ct_data.js) only ever produces Close, a rolled
            // numeric orbit slot, or Far — so those two options are hidden for CT to stop a
            // manually-added star (via +Secondary) from being set to a role CT rules don't
            // recognize, which was silently possible even after +Comp itself was removed (OW-17).
            const _isCT          = _workingCopy.engine === 'CT';
            const _roleChoices   = _isCT ? ['Close', 'Far'] : ['Companion', 'Close', 'Near', 'Far'];
            const _orbitBySep    = { Companion: 0.15, Close: 0.5, Near: 6.0, Far: 12.0 };
            const _roleFromOrbit = _isCT
                ? (id => id == null ? 'Far' : id <= 5 ? 'Close' : 'Far')
                : (id => id == null ? 'Far' : id <= 5 ? 'Close' : id <= 11 ? 'Near' : 'Far');
            const sepRow = document.createElement('div');
            Object.assign(sepRow.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', fontSize: '11px' });
            const sepLbl = document.createElement('label');
            sepLbl.textContent = 'Role:';
            Object.assign(sepLbl.style, { color: P.sub, minWidth: '54px' });
            const sepSel = document.createElement('select');
            Object.assign(sepSel.style, {
                background: '#0d1117', border: `1px solid ${P.border}`,
                color: P.accent, fontFamily: 'inherit', fontSize: '11px', padding: '2px 4px',
            });
            _roleChoices.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.textContent = opt;
                if ((star.role || (_isCT ? 'Far' : 'Companion')) === opt) o.selected = true;
                sepSel.appendChild(o);
            });
            sepSel.addEventListener('change', () => {
                _pushHistory();
                star.role = sepSel.value;
                if (!star._manualFields.includes('orbitId')) {
                    star.orbitId = _orbitBySep[sepSel.value] ?? star.orbitId;
                }
                updateCompLabel();
                _renderAndPreview();
            });
            sepRow.append(sepLbl, sepSel);
            compDetailPad.appendChild(sepRow);

            const compOrbitRow = _starInputRow('Orbit #:', star.orbitId != null ? parseFloat(star.orbitId.toFixed(3)) : null, { type: 'number', min: '0', step: '0.5', width: '60px', placeholder: 'auto' }, val => {
                const newOrbitId = val !== '' ? parseFloat(val) : null;
                if (_wouldReorder(star, true, newOrbitId)) {
                    _showWarn('Use Drag & Drop',
                        'Reorder orbital bodies by dragging and dropping.',
                        [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
                    return;
                }
                _pushHistory();
                star.orbitId = newOrbitId;
                if (!star._manualFields.includes('orbitId')) star._manualFields.push('orbitId');
                if (star.role !== 'Companion') {
                    star.role = _roleFromOrbit(newOrbitId);
                    sepSel.value = star.role;
                    updateCompLabel();
                }
                _renderAndPreview();
            });
            const compOrbitAuSpan = document.createElement('span');
            const _compAu = _orbitIdToAU(star.orbitId);
            compOrbitAuSpan.textContent = _compAu != null ? `→ ${_compAu.toFixed(2)} AU` : '';
            Object.assign(compOrbitAuSpan.style, { color: P.dim, fontSize: '11px' });
            compOrbitRow.appendChild(compOrbitAuSpan);
            compDetailPad.appendChild(compOrbitRow);
            compDetailPad.appendChild(_buildDerivedGroup(star));
            compDetails.appendChild(compDetailPad);
            block.appendChild(compDetails);

            // Companion body container (lighter connector, one indent deeper)
            // Interleave bodies and any sub-companions (stars that orbit this star), sorted by AU
            const compBodies    = bodiesByStarId[star._id] || [];
            const compSubStars  = _workingCopy.stars.filter(s => s.parentStarId === star._id);
            const compMerged    = [
                ...compBodies.map(b   => ({ kind: 'body',      item: b, sortKey: _sortAU(b) })),
                ...compSubStars.map(s => ({ kind: 'companion', item: s, sortKey: _sortAU(s) })),
            ].sort((a, b) => a.sortKey - b.sortKey);

            const compBodyContainer = document.createElement('div');
            Object.assign(compBodyContainer.style, {
                borderLeft: `1px solid ${P.border}`,
                marginLeft: '14px', paddingLeft: '6px',
                marginTop: '2px', marginBottom: '4px',
            });
            if (compMerged.length === 0) {
                const empty = document.createElement('div');
                Object.assign(empty.style, { padding: '3px 4px', color: P.dim, fontSize: '11px', fontStyle: 'italic' });
                empty.textContent = 'No bodies in orbit';
                compBodyContainer.appendChild(empty);
            } else {
                compMerged.forEach(({ kind, item }) => {
                    if (kind === 'companion') {
                        compBodyContainer.appendChild(_buildCompanionBlock(item));
                    } else {
                        compBodyContainer.appendChild(_buildBodyEl(item));
                    }
                });
            }
            block.appendChild(compBodyContainer);
            return block;
        }

        // ── System-level properties (age, hzco) — shown above the star tree
        const sysPropsEl = document.createElement('div');
        Object.assign(sysPropsEl.style, {
            padding: '4px 6px 6px', marginBottom: '6px',
            borderBottom: `1px solid ${P.border}`,
        });
        const sysPropTitle = document.createElement('div');
        sysPropTitle.textContent = 'System Properties';
        Object.assign(sysPropTitle.style, { color: P.sub, fontSize: '10px', marginBottom: '4px', letterSpacing: '0.04em' });
        sysPropsEl.appendChild(sysPropTitle);

        const fmt4sys = v => v != null ? parseFloat(v.toFixed(4)) : null;
        sysPropsEl.appendChild(_derivedRow('Age:', _workingCopy.age != null ? parseFloat(_workingCopy.age.toFixed(2)) : null, 'Gyr', val => {
            _pushHistory(); _workingCopy.age = val;
        }));
        // CT has no continuous HZCO formula — its "HZ Orbit" is the single RAW-table orbit
        // number classified 'H' (ZONE_H_TABLE), so label it distinctly from MgT2E/T5/RTT/AoW's
        // HZCO (sqrt(lum)-derived orbit position). Same field/editing mechanics either way:
        // blank = engine auto-derives, typed value = pinned override (see ct_bottomup_generator.js
        // generateSystemOrbits's hzOverride param).
        const hzLabel = _workingCopy.engine === 'CT' ? 'HZ Orbit:' : 'HZCO:';
        sysPropsEl.appendChild(_derivedRow(hzLabel, fmt4sys(_workingCopy.hzco), 'orb', val => {
            _pushHistory(); _workingCopy.hzco = val;
        }));
        treeEl.appendChild(sysPropsEl);

        // ── Render primary star + merged orbit list
        const primaryStar = _workingCopy.stars[0];
        const companions  = _workingCopy.stars.filter(s => s.parentStarId === primaryStar._id);

        const primaryEl = document.createElement('div');
        Object.assign(primaryEl.style, { marginBottom: '6px' });

        // Primary star header as <details> — expand to edit spectral type
        const primaryDetails = document.createElement('details');
        Object.assign(primaryDetails.style, {
            border: `1px solid ${P.border}`, borderRadius: '3px', marginBottom: '2px',
        });
        primaryDetails.setAttribute('data-primary-star', '');
        if (primaryStarOpen) primaryDetails.open = true;

        const primarySummary = document.createElement('summary');
        Object.assign(primarySummary.style, {
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 6px', cursor: 'pointer',
            background: '#0d1117', listStyle: 'none', userSelect: 'none',
        });
        const primaryLabel = document.createElement('span');
        primaryLabel.textContent = `★ Primary: ${primaryStar.sType}${primaryStar.subType}${primaryStar.sClass}`;
        Object.assign(primaryLabel.style, { color: P.star, fontWeight: 'bold', fontSize: '12px', flex: '1' });
        primarySummary.appendChild(primaryLabel);
        primarySummary.appendChild(_btn('+World', 'Add terrestrial world', () => _addBody(primaryStar._id, 'World')));
        primarySummary.appendChild(_btn('+GG',    'Add gas giant',         () => _addBody(primaryStar._id, 'Gas Giant')));
        primarySummary.appendChild(_btn('+Belt',  'Add planetoid belt',    () => _addBody(primaryStar._id, 'Belt')));
        // CT has no discretionary "Companion" placement — real CT companions only arise from
        // the Binary/Trinary Nature roll at generation time, placed via CT_COMPANION_ORBIT_TABLE
        // (Close / a rolled numeric orbit slot / Far), not a freeform orbitId. Offering +Comp
        // for CT wrote a companion the CT engine's own orbit-ordering logic couldn't interpret,
        // producing mismatched ordering across the Edit panel, orrery, and accordion.
        if (_workingCopy.engine !== 'CT') {
            primarySummary.appendChild(_btn('+Comp', 'Add companion star to primary', () => _addStar('Companion', primaryStar._id)));
        }
        primarySummary.appendChild(_btn('+Secondary', 'Add secondary star (Close/Near/Far)', () => _addStar('Far', primaryStar._id)));
        primaryDetails.appendChild(primarySummary);

        // Primary star edit inputs (visible when <details> is expanded)
        const primaryDetailPad = document.createElement('div');
        Object.assign(primaryDetailPad.style, { padding: '4px 8px 6px 12px' });
        const updatePrimaryLabel = () => {
            primaryLabel.textContent = `★ Primary: ${primaryStar.sType}${primaryStar.subType}${primaryStar.sClass}`;
        };
        const _primaryIsExotic = (primaryStar.sType === 'D' || primaryStar.sType === 'BD');
        primaryDetailPad.appendChild(_starSelectRow('Type:', primaryStar.sType, _STAR_TYPE_CHOICES, false, val => {
            _pushHistory(); primaryStar.sType = val;
            if (val === 'D')  { primaryStar.sClass = 'D'; primaryStar.subType = 0; }
            if (val === 'BD') { primaryStar.sClass = 'V'; primaryStar.subType = 0; }
            if (!primaryStar._manualFields.includes('sType')) primaryStar._manualFields.push('sType');
            if (val === 'D' || val === 'BD') { _renderAndPreview(); } else { updatePrimaryLabel(); _preview(); }
        }));
        primaryDetailPad.appendChild(_starSelectRow('Subtype:', primaryStar.subType, _STAR_SUBTYPE_CHOICES, _primaryIsExotic, val => {
            _pushHistory(); primaryStar.subType = parseInt(val);
            if (!primaryStar._manualFields.includes('subType')) primaryStar._manualFields.push('subType');
            updatePrimaryLabel(); _preview();
        }));
        primaryDetailPad.appendChild(_starSelectRow('Class:', primaryStar.sClass, _STAR_CLASS_CHOICES, _primaryIsExotic, val => {
            _pushHistory(); primaryStar.sClass = val;
            if (!primaryStar._manualFields.includes('sClass')) primaryStar._manualFields.push('sClass');
            updatePrimaryLabel(); _preview();
        }));
        primaryDetailPad.appendChild(_buildDerivedGroup(primaryStar));
        primaryDetails.appendChild(primaryDetailPad);
        primaryEl.appendChild(primaryDetails);

        // Merged list: primary bodies + companions sorted by AU (ascending)
        const primaryBodies = bodiesByStarId[primaryStar._id] || [];
        const mergedItems = [
            ...primaryBodies.map(b => ({ kind: 'body',      item: b, sortKey: _sortAU(b) })),
            ...companions.map(s    => ({ kind: 'companion', item: s, sortKey: _sortAU(s) })),
        ].sort((a, b) => a.sortKey - b.sortKey);

        const primaryBodyContainer = document.createElement('div');
        Object.assign(primaryBodyContainer.style, {
            borderLeft: `2px solid ${P.border}`,
            marginLeft: '14px', paddingLeft: '6px',
            marginTop: '2px', marginBottom: '4px',
        });

        if (mergedItems.length === 0) {
            const empty = document.createElement('div');
            Object.assign(empty.style, { padding: '3px 4px', color: P.dim, fontSize: '11px', fontStyle: 'italic' });
            empty.textContent = 'No bodies in orbit';
            primaryBodyContainer.appendChild(empty);
        }

        mergedItems.forEach(({ kind, item }) => {
            if (kind === 'companion') {
                primaryBodyContainer.appendChild(_buildCompanionBlock(item));
            } else {
                primaryBodyContainer.appendChild(_buildBodyEl(item));
            }
        });

        primaryEl.appendChild(primaryBodyContainer);
        treeEl.appendChild(primaryEl);
    }

    // ── Build editor panel ────────────────────────────────────────────────────

    function _buildPanel() {
        if (_editorPanel) { _editorPanel.remove(); _editorPanel = null; }

        // Sit below the System Viewer header — getBoundingClientRect forces a layout reflow
        // so the canvas top is accurate even before a paint frame.
        const _svCanvas  = document.querySelector('#system-viewer-overlay canvas');
        const _topOffset = _svCanvas ? Math.round(_svCanvas.getBoundingClientRect().top) : 0;

        _editorPanel = document.createElement('div');
        _editorPanel.id = 'se-editor-panel';
        Object.assign(_editorPanel.style, {
            position: 'fixed', top: `${_topOffset}px`, right: '0',
            width: '340px', height: `calc(100% - ${_topOffset}px)`,
            background: '#0a0e14f2', borderLeft: '1px solid #45a29e66',
            display: 'flex', flexDirection: 'column',
            zIndex: '9100',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
            fontSize: '12px', color: '#c5c6c7', boxSizing: 'border-box',
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '8px 10px', borderBottom: '1px solid #45a29e55', flexShrink: '0',
        });
        const titleLine = document.createElement('div');
        titleLine.textContent = 'SYSTEM EDITOR';
        Object.assign(titleLine.style, {
            color: '#66fcf1', fontWeight: 'bold', fontSize: '13px', marginBottom: '2px',
        });
        const subLine = document.createElement('div');
        subLine.textContent = `${_workingCopy.hexId}  ·  ${_workingCopy.engine}`;
        Object.assign(subLine.style, { color: '#8a8f94', fontSize: '11px' });
        header.append(titleLine, subLine);
        _editorPanel.appendChild(header);

        // Tree
        const treeEl = document.createElement('div');
        treeEl.id = 'se-body-tree';
        Object.assign(treeEl.style, { flex: '1', overflowY: 'auto', padding: '8px' });
        _editorPanel.appendChild(treeEl);

        // Footer
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '8px 10px', borderTop: '1px solid #45a29e55',
            display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: '0',
        });

        // "Allow engine to add bodies" checkbox
        const addBodiesWrap = document.createElement('label');
        Object.assign(addBodiesWrap.style, {
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: '#8a8f94', cursor: 'pointer',
        });
        const addBodiesChk = document.createElement('input');
        addBodiesChk.type    = 'checkbox';
        addBodiesChk.checked = !!(_workingCopy.allowAddBodies);
        Object.assign(addBodiesChk.style, { cursor: 'pointer' });
        addBodiesChk.addEventListener('change', () => {
            _workingCopy.allowAddBodies = addBodiesChk.checked;
        });
        const addBodiesLbl = document.createElement('span');
        addBodiesLbl.textContent = 'Allow engine to add additional bodies';
        addBodiesWrap.append(addBodiesChk, addBodiesLbl);
        footer.appendChild(addBodiesWrap);

        // Buttons row
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '8px' });
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className   = 'btn-cancel';
        Object.assign(cancelBtn.style, {
            flex: '1', padding: '8px', borderRadius: '4px', border: 'none',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
        });
        cancelBtn.addEventListener('click', close);
        btnRow.appendChild(cancelBtn);

        const previewBtn = document.createElement('button');
        previewBtn.textContent = 'Preview';
        previewBtn.className   = 'btn-cancel';
        Object.assign(previewBtn.style, {
            flex: '1', padding: '8px', borderRadius: '4px', border: 'none',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
        });
        previewBtn.addEventListener('click', _preview);
        btnRow.appendChild(previewBtn);

        const fillSaveBtn = document.createElement('button');
        fillSaveBtn.textContent = 'Save';
        fillSaveBtn.className   = 'btn-save';
        Object.assign(fillSaveBtn.style, {
            flex: '2', padding: '8px', borderRadius: '4px', border: 'none',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
            background: '#45a29e', color: '#0a0e14',
        });
        fillSaveBtn.addEventListener('click', _fillAndSave);
        btnRow.appendChild(fillSaveBtn);

        footer.appendChild(btnRow);

        _editorPanel.appendChild(footer);
        document.body.appendChild(_editorPanel);
        _renderEditorTree();
    }

    // ── Keyboard handler ──────────────────────────────────────────────────────

    function _onKeyDown(e) {
        const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
        const isRedo = (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));
        if (isUndo) { e.preventDefault(); e.stopPropagation(); _undo(); }
        if (isRedo) { e.preventDefault(); e.stopPropagation(); _redo(); }
    }

    // ── Fill & Save ───────────────────────────────────────────────────────────

    // For a fresh blank creation (no user-supplied bodies), force the mainworld
    // travel zone to Green regardless of what the generator computed from its
    // randomly-seeded UWP. Called after every generator run when working copy
    // has no bodies.
    function _forceGreenTravelZone(stateObj) {
        const dataKeys   = ['mgt2eData', 't5Data', 'ctData', 'rttData'];
        const systemKeys = ['mgtSystem', 't5System', 'ctSystem', 'rttSystem'];
        dataKeys.forEach(k => { if (stateObj[k]) stateObj[k].travelZone = 'Green'; });
        systemKeys.forEach(k => {
            const sys = stateObj[k];
            if (sys && Array.isArray(sys.worlds)) {
                const mw = sys.worlds.find(w => w.isMainworld);
                if (mw) mw.travelZone = 'Green';
            }
        });
    }

    // Maps a UWP seed digit key to the field name it represents. Shared between _applyUwpSeed
    // (applied to the transient seed body sent to the generator) and the UWP seed box UI
    // handlers (which mark the same field manual on the persistent working-copy body/moon, so
    // _restoreDisplayManualFields can later report it back to the accordion as user-edited).
    const _UWP_SEED_FIELD_MAP = { st: 'starport', s: 'size', a: 'atmCode', h: 'hydroCode', p: 'pop', g: 'gov', l: 'law', tl: 'tl' };

    // Filters a single typed character to the set a UWP seed digit box accepts for `key`.
    // Every digit is a hex nibble (0-9A-F) except starport (a full letter A-Z) and — CT only —
    // the size digit, which also accepts Book 6's satellite size codes 'S' (Small) and 'R'
    // (Ring). Both mean size 0 but are distinct labels the engine carries through everywhere it
    // reads `.size` (ct_bottomup_generator.js's LGG/SGG/Terrestrial satellite size rolls;
    // ct_physical_library.js/ct_world_engine.js already treat size==='S'/'R' as size-0-equivalent
    // wherever they read it — real dice rolls produce these values today). Without this, typing
    // S or R into the Size box was silently stripped, and even if it got through,
    // _applyUwpSeed's generic parseInt(ch, 16) would have discarded it anyway (OW-22). Gated to
    // CT specifically — other engines don't use this convention for a manually-typed seed digit.
    function _uwpSeedFilter(key, raw) {
        const up = (raw || '').toUpperCase();
        if (key === 'st') return up.replace(/[^A-Z]/g, '');
        if (key === 's' && _workingCopy && _workingCopy.engine === 'CT') return up.replace(/[^0-9A-FSR]/g, '');
        return up.replace(/[^0-9A-F]/g, '');
    }

    // Applies user-entered UWP seed digits to a seed body object in-place.
    // Sets numeric properties and records locked fields in _manualFields.
    // Returns the mutated seedBody for chaining.
    function _applyUwpSeed(seedBody, uwpSeed) {
        if (!uwpSeed) return seedBody;
        const mf = seedBody._manualFields = seedBody._manualFields || [];
        // Starport is a letter (A–X), not a hex digit — handle separately
        if (uwpSeed.st) {
            const sp = uwpSeed.st.toUpperCase();
            if (/^[A-Z]$/.test(sp)) {
                seedBody.starport = sp;
                if (!mf.includes('starport')) mf.push('starport');
            }
        }
        // Size ('s') is handled ahead of the generic hex-digit loop below: CT's satellite size
        // can be the non-hex codes 'S' (Small) or 'R' (Ring) — both size-0-equivalent, see
        // _uwpSeedFilter's comment — which the UI already restricts to CT working copies, so a
        // pass-through here is inert for other engines (their input boxes never produce it).
        if (uwpSeed.s === 'S' || uwpSeed.s === 'R') {
            seedBody.size = uwpSeed.s;
            if (!mf.includes('size')) mf.push('size');
        }

        const pairs = [
            ['s', 'size'], ['a', 'atmCode'], ['h', 'hydroCode'],
            ['p', 'pop'],  ['g', 'gov'],     ['l', 'law'], ['tl', 'tl'],
        ];
        pairs.forEach(([key, prop]) => {
            if (key === 's' && (uwpSeed.s === 'S' || uwpSeed.s === 'R')) return; // handled above
            const ch = uwpSeed[key];
            if (!ch) return;
            const val = parseInt(ch, 16);
            if (isNaN(val)) return;
            seedBody[prop] = val;
            if (prop === 'atmCode')   seedBody.atm   = val;
            if (prop === 'hydroCode') seedBody.hydro = val;
            if (!mf.includes(prop)) mf.push(prop);
        });
        return seedBody;
    }

    // Pre-pass: derives missing stellar physics on a seedSys (in-place) before
    // calling the generator.  Deterministic — table lookups only, no dice.
    function _resolveStarPhysics(seedSys, engine) {
        if (!seedSys || !seedSys.stars || !seedSys.stars.length) return;

        // Null age → 5 Gyr default (reasonable for inhabited systems)
        if (seedSys.age == null) seedSys.age = 5.0;

        // CT gets its own branch: it has its own RAW Book 6 tables (STAR_MASS/LUM in
        // rules/ct_data.js), not MgT2E's continuous stat tables. This used to fall through to
        // the MgT2E branch below unconditionally (no engine gate), so every manually-created
        // CT star's mass/luminosity/diameter came from MgT2E's tables instead of CT's own —
        // e.g. an F7V primary got MgT2E's continuous mass (1.22 Sol) instead of CT RAW's
        // table-snapped value (1.3 Sol, via the F5 anchor — see CT_StellarEngine's
        // _nearestTableKey). Silently wrong, and invisible in the UI since both look plausible.
        if (engine === 'CT') {
            const ctEng = (typeof CT_StellarEngine !== 'undefined') ? CT_StellarEngine : null;
            if (!ctEng) return;

            const resolveOneCT = star => {
                const sType   = star.sType   || star.type   || 'G';
                const subType = star.decimal ?? star.subType ?? 5;
                const sClass  = star.size    || star.sClass  || 'V';
                const specKey = `${sType}${subType}`;

                if (star.mass == null) star.mass = ctEng.starMass(sClass, specKey);
                if (star.lum  == null) star.lum  = ctEng.starLuminosity(sClass, specKey);
                if (star.diam == null) star.diam = ctEng.stellarDiam(sType, subType, sClass);
                // This runs after _buildSeedSys, which only had a chance to mirror the
                // pre-resolution (often still-null) `lum` into `luminosity` — resync here so
                // CT's own code (which reads `luminosity`, never `lum`) sees the resolved value.
                star.luminosity = star.lum;
                // star.temp is deliberately left null for CT: no CT generator code path
                // (ct_physical_library.js etc.) ever reads a star's surface temperature —
                // world thermal stats derive from luminosity directly — so there's no CT
                // RAW value to resolve it to, and borrowing MgT2E's formula would just
                // relabel that same cross-engine bug under a different field.
            };

            for (const star of seedSys.stars) {
                resolveOneCT(star);
                // A Far companion's nestedSystem.stars[0] is a separate shallow-copied object
                // (CT.write(), system_editor.js — copied to break circularity, not the same
                // reference as `star`), snapshotted before this function runs. Resolve it too,
                // rather than leaving it permanently null — otherwise a manually-added
                // companion's own bodies would derive physics (mass-dependent thermal/orbital
                // calcs) against an unresolved star (OW-19).
                if (star.nestedSystem && Array.isArray(star.nestedSystem.stars)) {
                    star.nestedSystem.stars.forEach(resolveOneCT);
                }
            }
            return;
        }

        const eng = (typeof MgT2EStellarEngine !== 'undefined') ? MgT2EStellarEngine : null;
        if (!eng || typeof eng.generateStarObject !== 'function') return;

        const resolveOne = star => {
            const sType   = star.sType   || star.type   || 'G';
            const subType = star.decimal ?? star.subType ?? 5;
            const sClass  = star.size    || star.sClass  || 'V';

            const needsPhysics = star.mass == null || star.lum == null ||
                                 star.diam == null || star.temp == null;
            if (needsPhysics) {
                const d = eng.generateStarObject(sType, subType, sClass, 'Resolve');
                if (star.mass == null) star.mass = d.mass;
                if (star.lum  == null) star.lum  = d.lum;
                if (star.diam == null) star.diam  = d.diam;
                if (star.temp == null) star.temp  = d.temp;
            }

            if (star.mao == null && typeof eng.getMAO === 'function') {
                star.mao = eng.getMAO(sType, subType, sClass);
            }
        };

        for (const star of seedSys.stars) {
            resolveOne(star);
            // CT: a Far companion's nestedSystem.stars[0] is a separate shallow-copied object
            // (CT.write(), system_editor.js — copied to break circularity, not the same
            // reference as `star`), snapshotted before this function runs. Resolve it too,
            // rather than leaving it permanently null — otherwise a manually-added companion's
            // own bodies would derive physics (mass-dependent thermal/orbital calcs) against an
            // unresolved star (OW-19).
            if (star.nestedSystem && Array.isArray(star.nestedSystem.stars)) {
                star.nestedSystem.stars.forEach(resolveOne);
            }
        }

        // Derive hzco from primary luminosity when not set. MgT2E-only: this is the MgT2E
        // Book 1.3 HZCO formula (sqrt(lum) AU -> orbit number), not a universal constant. CT
        // derives its own HZ orbit from the RAW ZONE_H_TABLE lookup inside generateSystemOrbits
        // (ct_bottomup_generator.js) — letting this formula fill seedSys.hzco first would look
        // like a deliberate user override and short-circuit that lookup.
        if (engine === 'MgT2E' && seedSys.hzco == null) {
            const primary = seedSys.stars[0];
            if (primary && primary.lum != null && typeof eng.convertAuToOrbit === 'function') {
                seedSys.hzco = eng.convertAuToOrbit(Math.sqrt(primary.lum));
            }
        }
    }

    // Normalises a working-copy travelZone value ('G' short-code) to the full-word
    // format expected by all generators and the renderer ('Green').
    function _normTz(tz) {
        if (!tz || tz === 'G') return 'Green';
        return tz;
    }

    // Converts the working-copy's normalized format to the engine's native seedSys object.
    function _buildSeedSys(workingCopy) {
        const wc = workingCopy;
        const engine = wc.engine;

        // Map star _id → array index for parentStarIdx derivation
        const starIdxById = {};
        wc.stars.forEach((s, i) => { starIdxById[s._id] = i; });

        // Common star format: spread _raw to preserve all engine-computed fields,
        // then apply editor overrides.  Derived properties (mass/lum/diam/temp/mao)
        // are taken from the working copy — null means "derive in _resolveStarPhysics".
        const engStars = wc.stars.map(s => ({
            ...(s._raw || {}),
            _id:          s._id,
            type:         s.sType || 'G',
            sType:        s.sType || 'G',
            decimal:      s.subType != null ? s.subType : 5,
            size:         s.sClass || 'V',
            sClass:       s.sClass || 'V',
            role:         s.role || 'Primary',
            name:         `${s.sType || 'G'}${s.subType != null ? s.subType : '5'} ${s.sClass || 'V'}`,
            // CT's own convention (ct_stellar_engine.js's _specKey) is type+decimal only, e.g.
            // "G5" — no luminosity class suffix. ZONE_H_TABLE/ZONE_TABLES key on that exact
            // format; appending sClass here (e.g. "G5V") never matches, silently breaking zone
            // classification (getZoneForOrbit/zoneHTable) for any star that passes through here.
            specKey:      `${s.sType || 'G'}${s.subType != null ? s.subType : 5}`,
            orbitId:      s.orbitId != null ? s.orbitId : undefined,
            parentStarIdx: s.parentStarId != null ? (starIdxById[s.parentStarId] ?? 0) : 0,
            separation:   s.role === 'Primary' ? null : (s.role || 'Companion'),
            _manualFields: s._manualFields ? [...s._manualFields] : [],
            // Explicitly override derived physics so _raw values don't shadow user-cleared fields
            mass: s.mass,
            lum:  s.lum,
            // CT's own code (ct_physical_library.js's getThermalStats call, etc.) reads
            // `star.luminosity`, never `star.lum` — without this a manually-created/edited CT
            // star's luminosity was invisible to CT's own generator despite being correctly
            // resolved into `lum` above, leaving every body's thermal calc reading
            // `undefined` (NaN temperature). Harmless no-op for other engines, which don't look
            // for this field.
            luminosity: s.lum,
            diam: s.diam,
            temp: s.temp,
            mao:  s.mao,
        }));

        const seed = {
            stars:           engStars,
            _mainworldRef:   wc.mainworldRef || null,
            _allowAddBodies: !!wc.allowAddBodies,
            age:  wc.age  ?? null,
            hzco: wc.hzco ?? null,
        };

        const adapter = _ENGINE_ADAPTERS[engine];
        if (adapter) {
            // engStars passed through so an adapter can attach data directly onto a specific
            // seeded star object (e.g. CT's write() attaching a Far companion's own nestedSystem
            // orbit list) — write() previously only returned top-level seed fields, with no way
            // to reach into an individual star's own seed object.
            Object.assign(seed, adapter.write(wc, starIdxById, engStars));
        }

        return seed;
    }

    // Wipes all existing engine data from stateObj so only the new engine's data remains.
    function _clearSystemData(stateObj) {
        stateObj.ctData     = null; stateObj.ctSystem    = null;
        stateObj.mgt2eData  = null; stateObj.mgtSystem   = null;
        stateObj.t5Data     = null; stateObj.t5System    = null;
        stateObj.aowSystem  = null;
        stateObj.rttSystem  = null; stateObj.rttData     = null;
        stateObj.ctPhysical = null; stateObj.mgtPhysical = null; stateObj.t5Physical = null;
        stateObj.mgtSocio   = null; stateObj.t5Socio     = null;
    }

    // Runs the appropriate generator for the given engine and writes results into stateObj.
    // Returns newSys on success, null if generator not found. Throws on engine error.
    function _runGenerator(hexId, engine, seedSys, stateObj, workingCopy) {
        const adapter = _ENGINE_ADAPTERS[engine];
        if (adapter) return adapter.run(hexId, seedSys, stateObj);
        return null;
    }

    // Restores the pre-preview hexStates snapshot, redraws, and refreshes the viewer.
    function _restorePreview() {
        if (!_previewOriginalState) return;
        const { hexId, existed, state } = _previewOriginalState;
        _previewOriginalState = null;
        if (typeof hexStates !== 'undefined') {
            if (!existed) {
                hexStates.delete(hexId);
            } else {
                hexStates.set(hexId, JSON.parse(JSON.stringify(state)));
            }
        }
        if (typeof requestAnimationFrame === 'function' && typeof draw === 'function') {
            requestAnimationFrame(draw);
        }
        if (typeof SystemViewer !== 'undefined' && SystemViewer.isOpen()) {
            SystemViewer.close();
            setTimeout(() => { if (typeof SystemViewer !== 'undefined') SystemViewer.open(hexId); }, 80);
        }
    }

    // Restores true (user-edited-only) _manualFields on the generated output. _uwpLockFor()/
    // _physSeed()/ggPhysFields (used in _buildSeedSys) deliberately mark every field present
    // in a body's/moon's _raw as "manually locked" so the generator won't re-roll values that
    // are only being preserved from a prior save — necessary for stability. But that same
    // _manualFields array is also what the accordion reads to highlight a field as user-edited
    // (isManual(), core.js:478). Left uncorrected, every pre-existing world's fields would show
    // as manually edited the moment the System Editor regenerates the system at all, even if
    // the user only touched one unrelated body. The working copy's own _manualFields (built up
    // only by explicit UI edits — star overrides, UWP seed digits, moon pd edits, drag-reorder,
    // etc.) is the source of truth for display purposes, so copy it onto the generated output.
    // Per-engine shape (where bodies/moons live in newSys, what moons are keyed) is owned by
    // each engine's own adapter now — see js/<engine>_editor_adapter.js's restoreManualFields().
    // Not every adapter defines one (AoW doesn't yet; this was a no-op for AoW before this
    // split too), so the dispatch is a straight optional-method call, same pattern as
    // _runGenerator's adapter.run() dispatch below.
    function _restoreDisplayManualFields(engine, newSys) {
        if (!newSys) return;
        const adapter = _ENGINE_ADAPTERS[engine];
        if (adapter && typeof adapter.restoreManualFields === 'function') {
            adapter.restoreManualFields(_workingCopy, newSys);
        }
    }

    // Shared commit path for _preview() and _fillAndSave(): builds a seedSys from the working
    // copy, runs the engine generator, and writes the result into hexStates. This is everything
    // the two callers had in common (OW-5) — the two remaining differences are deliberately left
    // to the caller rather than folded in here: (1) the pre-generation snapshot side effect
    // (_preview takes a _previewOriginalState snapshot; _fillAndSave calls the global
    // saveHistoryState() undo instead) and (2) what happens to the editor/viewer after a
    // successful commit (_preview refreshes in place and keeps editing; _fillAndSave closes the
    // editor). Folding either of those in here would risk a duplicate undo snapshot on every
    // Preview click, or a missing one on Fill & Save.
    // Returns { hexId, stateObj, newSys } on success, or null if generation failed (a warning
    // dialog has already been shown to the user in that case).
    function _generateAndCommit(errorLabel) {
        const hexId   = _workingCopy.hexId;
        const engine  = _workingCopy.engine;
        const seedSys = _buildSeedSys(_workingCopy);
        _resolveStarPhysics(seedSys, engine);

        // Use current hexStates entry as the write target (overwritten by _runGenerator).
        const stateObj = (typeof hexStates !== 'undefined' && hexStates.get(hexId))
            ? hexStates.get(hexId)
            : { hexId, type: 'SYSTEM_PRESENT' };

        let newSys = null;
        try {
            newSys = _runGenerator(hexId, engine, seedSys, stateObj, _workingCopy);
        } catch (err) {
            console.error(`[SystemEditor] ${errorLabel} failed:`, err);
            console.error('[SystemEditor] Stack trace:', err.stack);
            _showWarn(`${errorLabel} Error`,
                `The generator encountered an error:\n${err.message}`,
                [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
            return null;
        }

        if (!newSys) {
            _showWarn(`${errorLabel} Failed`,
                'No system was produced. Check the browser console for details.',
                [{ label: 'OK', cls: 'btn-save', onClick: () => {} }]);
            return null;
        }

        _restoreDisplayManualFields(engine, newSys);

        // Fresh blank creation: override generator's travel zone with Green
        if (_workingCopy.bodies.length === 0) _forceGreenTravelZone(stateObj);

        // Preserve name from working copy mainworld
        const mwBody = _workingCopy.bodies.find(b => b._id === _workingCopy.mainworldRef)
            || _workingCopy.bodies.find(b => b.isMainworld);
        const mwName = mwBody && mwBody.name ? mwBody.name : null;
        if (mwName) {
            stateObj.name = mwName;
            if (stateObj.mgt2eData) stateObj.mgt2eData.name = mwName;
            if (stateObj.ctData)    stateObj.ctData.name    = mwName;
            if (stateObj.t5Data)    stateObj.t5Data.name    = mwName;
            if (stateObj.rttData)   stateObj.rttData.name   = mwName;
        } else if (!stateObj.name && typeof getNextSystemName === 'function') {
            stateObj.name = getNextSystemName(hexId);
        }

        stateObj.type = 'SYSTEM_PRESENT';
        if (typeof computeSystemCounts === 'function') computeSystemCounts(stateObj);
        if (typeof hexStates !== 'undefined') hexStates.set(hexId, stateObj);
        if (typeof requestAnimationFrame === 'function' && typeof draw === 'function') {
            requestAnimationFrame(draw);
        }
        if (typeof populateEditorAccordions === 'function' &&
            typeof editingHexId !== 'undefined' && editingHexId === hexId) {
            populateEditorAccordions(stateObj);
        }

        return { hexId, stateObj, newSys };
    }

    function _preview() {
        if (!_workingCopy) return;
        const hexId  = _workingCopy.hexId;
        const engine = _workingCopy.engine;

        // On first preview only: snapshot the original state so Cancel can restore it.
        if (!_previewOriginalState) {
            const orig = (typeof hexStates !== 'undefined') ? hexStates.get(hexId) : undefined;
            _previewOriginalState = {
                hexId,
                existed: orig !== undefined,
                state:   orig ? JSON.parse(JSON.stringify(orig)) : null,
            };
        }

        const result = _generateAndCommit('Preview');
        if (!result) return;
        const { newSys } = result;

        if (typeof SystemViewer !== 'undefined') {
            if (SystemViewer.isOpen()) SystemViewer.refresh(hexId);
            else SystemViewer.open(hexId);
        }

        // Backfill derived properties into working copy for fields that were null (auto-derived).
        // This lets the user see what the engine computed and optionally lock the values.
        if (newSys && newSys.stars) {
            newSys.stars.forEach((genStar, i) => {
                const wcStar = _workingCopy.stars[i];
                if (!wcStar) return;
                if (wcStar.mass == null && genStar.mass != null) wcStar.mass = genStar.mass;
                if (wcStar.lum  == null && genStar.lum  != null) wcStar.lum  = genStar.lum;
                if (wcStar.diam == null && genStar.diam != null) wcStar.diam = genStar.diam;
                if (wcStar.temp == null && genStar.temp != null) wcStar.temp = genStar.temp;
                if (wcStar.mao  == null && genStar.mao  != null) wcStar.mao  = genStar.mao;
            });
            if (_workingCopy.age  == null && newSys.age  != null) _workingCopy.age  = newSys.age;
            if (_workingCopy.hzco == null && newSys.hzco != null) _workingCopy.hzco = newSys.hzco;

            // Body/moon backfill (hillSpanPd, moon pd/pos/eccentricity/retrograde, moon-list
            // resort to match the generator's own order) is per-engine shape, same as
            // restoreManualFields above — owned by each adapter's backfillFromGenerated(). Not
            // every adapter defines one (T5/RTT/AoW don't yet; this was a no-op for them before
            // this split too).
            const adapter = _ENGINE_ADAPTERS[engine];
            if (adapter && typeof adapter.backfillFromGenerated === 'function') {
                adapter.backfillFromGenerated(_workingCopy, newSys);
            }

            _renderEditorTree();
        }

    }

    // Completes Fill & Save after any audit warning has been resolved: closes the editor and
    // reopens the System Viewer on the freshly-committed system. Split out from _fillAndSave()
    // so the audit warn-and-proceed dialog (OW-3) can defer this tail without re-running
    // generation if the user picks "Proceed Anyway".
    function _finishFillAndSave(hexId) {
        // Clear preview snapshot and close editor before refreshing the viewer,
        // so the re-entrant SystemEditor.close() call from SystemViewer.close() is a no-op.
        _previewOriginalState = null;
        _forceClose();

        // Refresh System Viewer to show new data
        if (typeof SystemViewer !== 'undefined' && SystemViewer.isOpen()) {
            SystemViewer.close();
            setTimeout(() => { if (typeof SystemViewer !== 'undefined') SystemViewer.open(hexId); }, 80);
        }
    }

    function _fillAndSave() {
        if (!_workingCopy) return;
        const hexId = _workingCopy.hexId;

        // Save global undo snapshot before mutating
        if (typeof saveHistoryState === 'function') saveHistoryState('Fill & Save System');

        const result = _generateAndCommit('Fill & Save');
        if (!result) return;

        // AoW age-conflict gate (design decision 2, see directives/project_manifest.md OW-9):
        // aow_seed_bridge.js's reconcileSystemAge sets sys.ageConflict when manually-chosen
        // spectral types across stars imply system-age windows with no overlap — the system was
        // still generated (using a best-effort compromise age), so this is a warn-and-proceed,
        // same shape as the OW-3 audit gate below, just checked first since an age conflict is
        // upstream of everything else the audit might also flag.
        const ageConflict = result.newSys && result.newSys.ageConflict;
        if (ageConflict) {
            const starList = (ageConflict.stars || [])
                .map(s => `${s.label}: valid age ${s.minAge.toFixed(2)}-${s.maxAge.toFixed(2)} Gyr`)
                .join('; ');
            _showWarn('Star Ages Conflict',
                `These stars' chosen spectral types imply system ages that don't overlap (${starList}). ` +
                `The system was generated using a best-effort compromise age. You can proceed anyway, ` +
                `or go back and adjust one of the stars' spectral types.`,
                [
                    { label: 'Proceed Anyway', cls: 'btn-cancel', onClick: () => _checkAuditThenFinish(hexId, result) },
                    { label: 'Go Back & Fix',  cls: 'btn-save',   onClick: () => {} },
                ]
            );
            return;
        }

        _checkAuditThenFinish(hexId, result);
    }

    // OW-3: UWP Auditor gate. Not every engine's generator populates auditResult (only
    // MgT2E/CT/T5/AoW do today), so this is a no-op for engines that haven't been wired up yet.
    // The system is already committed to hexStates by this point (_generateAndCommit already
    // ran), so "Go Back & Fix" can't un-commit it — it just leaves the editor open (same as
    // dismissing any other warning) so the user can keep adjusting bodies and re-run Fill & Save,
    // instead of closing over a failing result. Split out from _fillAndSave() so the age-conflict
    // gate above it can defer to this same check after "Proceed Anyway".
    function _checkAuditThenFinish(hexId, result) {
        const audit = result.newSys && result.newSys.auditResult;
        if (audit && audit.pass === false) {
            const errCount = (audit.errors || []).length;
            _showWarn('Audit Warnings Found',
                `The UWP Auditor found ${errCount} issue${errCount !== 1 ? 's' : ''} with this system ` +
                `(see browser console for details). You can proceed anyway, or go back and adjust ` +
                `the system before saving.`,
                [
                    { label: 'Proceed Anyway', cls: 'btn-cancel', onClick: () => _finishFillAndSave(hexId) },
                    { label: 'Go Back & Fix',  cls: 'btn-save',   onClick: () => {} },
                ]
            );
            return;
        }
        _finishFillAndSave(hexId);
    }

    // ── Open/close ────────────────────────────────────────────────────────────

    function _openWithWorkingCopy(wc) {
        if (_workingCopy) return;
        _workingCopy  = wc;
        _originalCopy = JSON.parse(JSON.stringify(wc));
        _history      = [JSON.parse(JSON.stringify(wc))];
        _histIdx      = 0;
        if (typeof SystemViewer !== 'undefined' && !SystemViewer.isOpen()) {
            SystemViewer.open(wc.hexId);
        }
        _buildPanel();
        window.addEventListener('keydown', _onKeyDown, true);
        // For a create flow, hexStates has no entry yet so the viewer open above was a no-op.
        // Auto-preview now to generate a starter system and open the viewer.
        if (typeof SystemViewer !== 'undefined' && !SystemViewer.isOpen()) {
            _preview();
        }
    }

    function _forceClose() {
        window.removeEventListener('keydown', _onKeyDown, true);
        if (_editorPanel) { _editorPanel.remove(); _editorPanel = null; }
        _workingCopy = null; _originalCopy = null;
        _history = []; _histIdx = -1;
        _pendingCreateHexId = null;
        _dragBodyId = null; _dragStarId = null; _dragCompanionId = null;
        _previewOriginalState = null;
    }

    function openCreate(hexId) {
        if (_workingCopy) return;
        _pendingCreateHexId = hexId;
        // Reset primary star selects to G2V defaults each time the dialog opens
        const pType    = document.getElementById('se-primary-type');
        const pSubtype = document.getElementById('se-primary-subtype');
        const pClass   = document.getElementById('se-primary-class');
        if (pType)    { pType.value    = 'G'; pType.disabled    = false; pType.style.opacity    = '1'; }
        if (pSubtype) { pSubtype.value = '2'; pSubtype.disabled = false; pSubtype.style.opacity = '1'; }
        if (pClass)   { pClass.value   = 'V'; pClass.disabled   = false; pClass.style.opacity   = '1'; }
        const dlg = document.getElementById('se-engine-dialog');
        if (dlg) dlg.style.display = 'flex';
    }

    function openEdit(hexId) {
        if (_workingCopy) return;
        const stateObj = (typeof hexStates !== 'undefined') ? hexStates.get(hexId) : null;
        if (!stateObj) return;
        const wc = _buildWorkingCopyFromState(stateObj, hexId);
        if (!wc) return;
        _openWithWorkingCopy(wc);
    }

    function close() {
        if (_isDirty() || _previewOriginalState) {
            _showWarn('Discard Changes?',
                'You have unsaved changes. Discard them and close the editor?',
                [
                    { label: 'Discard',      cls: 'btn-cancel', onClick: () => { _restorePreview(); _forceClose(); } },
                    { label: 'Keep Editing', cls: 'btn-save',   onClick: () => {} },
                ]
            );
        } else {
            _forceClose();
        }
    }

    // ── DOM wiring ────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const ctxCreate = document.getElementById('ctx-create-system');
        const ctxEdit   = document.getElementById('ctx-edit-system');
        if (ctxCreate) ctxCreate.addEventListener('click', () => {
            const hexId = (typeof selectedHexes !== 'undefined' && selectedHexes.size === 1)
                ? [...selectedHexes][0] : null;
            if (hexId) openCreate(hexId);
        });
        if (ctxEdit) ctxEdit.addEventListener('click', () => {
            const hexId = (typeof selectedHexes !== 'undefined' && selectedHexes.size === 1)
                ? [...selectedHexes][0] : null;
            if (hexId) openEdit(hexId);
        });

        const engineDlg     = document.getElementById('se-engine-dialog');
        const engineCancel  = document.getElementById('btn-se-engine-cancel');
        const engineConfirm = document.getElementById('btn-se-engine-confirm');
        const dlgTypeSel    = document.getElementById('se-primary-type');
        const dlgSubtypeSel = document.getElementById('se-primary-subtype');
        const dlgClassSel   = document.getElementById('se-primary-class');

        // D/BD auto-set in the creation dialog
        if (dlgTypeSel) {
            dlgTypeSel.addEventListener('change', () => {
                const v = dlgTypeSel.value;
                const exotic = (v === 'D' || v === 'BD');
                if (v === 'D')  { dlgClassSel.value = 'D'; dlgSubtypeSel.value = '0'; }
                if (v === 'BD') { dlgClassSel.value = 'V'; dlgSubtypeSel.value = '0'; }
                if (dlgSubtypeSel) { dlgSubtypeSel.disabled = exotic; dlgSubtypeSel.style.opacity = exotic ? '0.55' : '1'; }
                if (dlgClassSel)   { dlgClassSel.disabled   = exotic; dlgClassSel.style.opacity   = exotic ? '0.55' : '1'; }
            });
        }

        if (engineCancel) engineCancel.addEventListener('click', () => {
            if (engineDlg) engineDlg.style.display = 'none';
            _pendingCreateHexId = null;
        });
        if (engineConfirm) engineConfirm.addEventListener('click', () => {
            const chosen = document.querySelector('input[name="se-engine-choice"]:checked');
            const engine = chosen ? chosen.value : 'MgT2E';
            const starSpec = {
                sType:   dlgTypeSel    ? dlgTypeSel.value                : 'G',
                subType: dlgSubtypeSel ? parseInt(dlgSubtypeSel.value)   : 2,
                sClass:  dlgClassSel   ? dlgClassSel.value               : 'V',
            };
            if (engineDlg) engineDlg.style.display = 'none';
            if (_pendingCreateHexId) {
                const hexId = _pendingCreateHexId;
                _pendingCreateHexId = null;
                _openWithWorkingCopy(_buildBlankWorkingCopy(hexId, engine, starSpec));
            }
        });
    });

    return { openCreate, openEdit, close };

})();
