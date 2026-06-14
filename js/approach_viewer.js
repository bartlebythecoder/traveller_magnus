'use strict';

// =============================================================================
// APPROACH_VIEWER.JS — Orbital Approach
// Sits between the orrery and the surface view. Pre-renders the target world
// as 24 rotating sphere frames, then animates the viewer descending toward it.
// Drag to orbit; scroll in to descend; scroll out returns to orrery.
// Exposes window.ApproachViewer  { open, close, isOpen, handleWheel }
// =============================================================================

const ApproachViewer = (() => {

    // ── State ─────────────────────────────────────────────────────────────────
    let _overlay   = null;
    let _canvas    = null;
    let _ctx       = null;
    let _world     = null;
    let _sys       = null;
    let _hexId     = null;
    let _worldData = null;
    let _canvasW   = 0;
    let _canvasH   = 0;

    const FRAME_COUNT       = 24;
    const ZOOM_FACTOR       = 1.30;
    const AUTO_ROTATE_SPEED = 0.008;          // rad/sec ≈ one rotation per 13 min
    const MAX_LAT           = 70 * Math.PI / 180;

    let _frames      = [];
    let _frameReady  = 0;
    let _renderRafId = null;

    let _approachZoom = 1.0;
    let _approachLon  = 0;
    let _approachLat  = 0;
    let _prevElapsed  = 0;

    let _stars       = [];
    let _dragging    = false;
    let _dragLast    = null;
    let _startTime   = 0;
    let _animFrameId = null;

    // ── World data extraction ─────────────────────────────────────────────────

    function _worldDataFromNormalised(world) {
        const uwp = world.uwp || '';
        return {
            atmosphere:    uwp[2] || '0',
            hydrographics: uwp[3] || '0',
            population:    uwp[4] || '0',
            temperature:   world.temperature || '',
            temperatureK:  world.meanTempK   || 0,
            size:          (parseInt(uwp[1], 16) || 0),
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _wrapAz(az) {
        const TWO_PI = Math.PI * 2;
        return ((az % TWO_PI) + TWO_PI) % TWO_PI;
    }

    // ── Star field ────────────────────────────────────────────────────────────

    function _buildStarField(rng) {
        const stars = [];
        for (let i = 0; i < 220; i++) {
            stars.push({
                x:         rng() * 2 - 1,    // normalised [-1, 1] across canvas
                y:         rng() * 2 - 1,
                r:         0.4 + rng() * 0.9,
                baseAlpha: 0.15 + rng() * 0.65,
                freq:      0.20 + rng() * 1.20,
                phase:     rng() * Math.PI * 2,
            });
        }
        return stars;
    }

    // ── Pre-rendering ─────────────────────────────────────────────────────────

    function _startPrerender() {
        _frames     = new Array(FRAME_COUNT);
        _frameReady = 0;
        let i       = 0;

        function renderNext() {
            if (!_overlay) return;       // viewer closed during load — stop
            if (i < FRAME_COUNT) {
                const canvas  = document.createElement('canvas');
                canvas.width  = 300;
                canvas.height = 300;
                const lonOffset = i * (Math.PI * 2 / FRAME_COUNT);
                PlanetRenderer.renderApproachFrame(canvas, _worldData, _hexId, lonOffset);
                _frames[i]  = canvas;
                _frameReady = ++i;
                _renderRafId = requestAnimationFrame(renderNext);
            } else {
                _renderRafId = null;
            }
        }
        _renderRafId = requestAnimationFrame(renderNext);
    }

    // ── Screen geometry ───────────────────────────────────────────────────────

    function _discRadius() {
        return _canvasH * 0.12 * _approachZoom;
    }

    function _discCenter() {
        const r  = _discRadius();
        const dy = (_approachLat / (Math.PI / 2)) * r * 0.50;
        return { x: _canvasW / 2, y: _canvasH / 2 - dy };
    }

    // ── Draw ──────────────────────────────────────────────────────────────────

    function _drawStars(elapsed) {
        const ctx = _ctx;
        ctx.fillStyle = '#ffffff';
        for (const s of _stars) {
            const sx = s.x * _canvasW * 0.5 + _canvasW * 0.5;
            const sy = s.y * _canvasH * 0.5 + _canvasH * 0.5;
            const tw = 0.7 + 0.3 * Math.sin(s.freq * elapsed + s.phase);
            ctx.globalAlpha = s.baseAlpha * tw;
            ctx.beginPath();
            ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function _drawLoading(dc, elapsed) {
        const ctx = _ctx;
        const r   = _discRadius();
        const pct = _frameReady / FRAME_COUNT;

        // Pulsing outline
        const pulse = 0.35 + 0.30 * Math.sin(elapsed * 2.5);
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(69,162,158,${pulse.toFixed(2)})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Progress arc
        if (pct > 0) {
            ctx.beginPath();
            ctx.arc(dc.x, dc.y, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
            ctx.strokeStyle = '#66fcf1';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#66fcf1';
        ctx.font      = '12px "Share Tech Mono", monospace';
        ctx.fillText(`Preparing orbital view...  ${_frameReady} / ${FRAME_COUNT}`, dc.x, dc.y);
        ctx.fillStyle = '#55686b';
        ctx.font      = '11px "Share Tech Mono", monospace';
        ctx.fillText('Drag to orbit  ·  Scroll in to descend', dc.x, dc.y + 20);
    }

    function _drawPlanet(dc) {
        const ctx      = _ctx;
        const r        = _discRadius();
        const lonNorm  = _wrapAz(_approachLon) / (Math.PI * 2);
        const frameIdx = Math.round(lonNorm * FRAME_COUNT) % FRAME_COUNT;
        const frame    = _frames[frameIdx];
        if (!frame) return;

        // Clip to disc, scale frame image to fill it
        ctx.save();
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(frame, dc.x - r, dc.y - r, r * 2, r * 2);
        ctx.restore();

        // Atmosphere limb ring
        const limb = ctx.createRadialGradient(dc.x, dc.y, r * 0.85, dc.x, dc.y, r * 1.18);
        limb.addColorStop(0,   'rgba(0,0,0,0)');
        limb.addColorStop(0.4, 'rgba(100,160,255,0.30)');
        limb.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = limb;
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, r * 1.18, 0, Math.PI * 2);
        ctx.fill();

        // Terminator — consistent with the top-left light baked into the frames
        const tOX = r * 0.18;
        const tOY = r * 0.10;
        const term = ctx.createRadialGradient(
            dc.x - tOX, dc.y - tOY, r * 0.50,
            dc.x - tOX, dc.y - tOY, r * 1.08
        );
        term.addColorStop(0, 'rgba(0,0,0,0)');
        term.addColorStop(1, 'rgba(0,0,0,0.58)');
        ctx.save();
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = term;
        ctx.fillRect(dc.x - r * 1.2, dc.y - r * 1.2, r * 2.4, r * 2.4);
        ctx.restore();
    }

    function _drawFrame(elapsed) {
        if (!_ctx || !_canvasW || !_canvasH) return;

        const ctx = _ctx;
        ctx.clearRect(0, 0, _canvasW, _canvasH);
        ctx.fillStyle = '#000008';
        ctx.fillRect(0, 0, _canvasW, _canvasH);

        _drawStars(elapsed);

        const dc = _discCenter();

        if (_frameReady < FRAME_COUNT) {
            _drawLoading(dc, elapsed);
        } else {
            // Advance auto-rotation using frame delta
            const dt = elapsed - (_prevElapsed || elapsed);
            _prevElapsed = elapsed;
            _approachLon = _wrapAz(_approachLon + AUTO_ROTATE_SPEED * dt);
            _drawPlanet(dc);
        }
    }

    function _startLoop() {
        function tick() {
            const elapsed = _startTime > 0 ? (performance.now() - _startTime) / 1000 : 0;
            _drawFrame(elapsed);
            _animFrameId = requestAnimationFrame(tick);
        }
        _animFrameId = requestAnimationFrame(tick);
    }

    // ── DOM construction ──────────────────────────────────────────────────────

    function _buildOverlay() {
        const P = {
            bg: '#000000', border: '#45a29e55', text: '#c5c6c7', accent: '#66fcf1',
            sub: '#8a8f94', hint: '#55686b', badge: '#45a29e', badgeBorder: '#45a29e55',
        };

        _overlay = document.createElement('div');
        _overlay.id = 'approach-viewer-overlay';
        Object.assign(_overlay.style, {
            position: 'fixed', inset: '0', zIndex: '9200',
            background: P.bg,
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
            color: P.text, userSelect: 'none',
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '8px 18px', flexShrink: '0',
            borderBottom: `1px solid ${P.border}`,
        });

        const title = document.createElement('span');
        Object.assign(title.style, { color: P.accent, fontSize: '15px', fontWeight: 'bold' });
        title.textContent = `APPROACH  ${_hexId}`;

        const nameLabel = document.createElement('span');
        Object.assign(nameLabel.style, { fontSize: '12px', color: P.sub });
        nameLabel.textContent = _world.name || _world.type || '';

        const uwpLabel = document.createElement('span');
        Object.assign(uwpLabel.style, { fontSize: '11px', color: P.hint });
        uwpLabel.textContent = _world.uwp || '';

        const hint = document.createElement('span');
        Object.assign(hint.style, {
            fontSize: '11px', color: P.hint, marginLeft: 'auto', marginRight: '12px',
        });
        hint.textContent = 'Drag to orbit  ·  Scroll in to descend  ·  ESC to return';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: `1px solid ${P.badge}`,
            color: P.accent, padding: '3px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px',
        });
        closeBtn.addEventListener('click', close);

        header.append(title, nameLabel, uwpLabel, hint, closeBtn);
        _overlay.appendChild(header);

        _canvas = document.createElement('canvas');
        Object.assign(_canvas.style, { display: 'block', cursor: 'grab' });
        _overlay.appendChild(_canvas);

        document.body.appendChild(_overlay);

        const headerH = header.getBoundingClientRect().height || 44;
        _canvasW = window.innerWidth;
        _canvasH = window.innerHeight - headerH;

        const dpr = window.devicePixelRatio || 1;
        _canvas.width  = Math.round(_canvasW * dpr);
        _canvas.height = Math.round(_canvasH * dpr);
        _canvas.style.width  = _canvasW + 'px';
        _canvas.style.height = _canvasH + 'px';
        _ctx = _canvas.getContext('2d');
        _ctx.scale(dpr, dpr);

        _canvas.addEventListener('mousedown', _onMouseDown);
        _canvas.addEventListener('wheel',     _onWheel, { passive: false });
        window.addEventListener('mousemove',  _onWindowMouseMove);
        window.addEventListener('mouseup',    _onWindowMouseUp);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function _onMouseDown(e) {
        if (e.button !== 0) return;
        _dragging = true;
        _dragLast = { x: e.clientX, y: e.clientY };
        _canvas.style.cursor = 'grabbing';
    }

    function _onWindowMouseMove(e) {
        if (!_dragging) return;
        const dx = e.clientX - _dragLast.x;
        const dy = e.clientY - _dragLast.y;
        // Horizontal drag = full-rotation across full canvas width
        _approachLon = _wrapAz(_approachLon - (dx / _canvasW) * Math.PI * 2);
        // Vertical drag = latitude, clamped
        _approachLat = Math.max(-MAX_LAT, Math.min(MAX_LAT,
            _approachLat - (dy / _canvasH) * Math.PI));
        _dragLast = { x: e.clientX, y: e.clientY };
    }

    function _onWindowMouseUp() {
        if (!_dragging) return;
        _dragging = false;
        if (_canvas) _canvas.style.cursor = 'grab';
    }

    function _onWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        const direction = e.deltaY < 0 ? 1 : -1;

        if (direction > 0) {
            const newZoom  = _approachZoom * ZOOM_FACTOR;
            const newDiscR = _canvasH * 0.12 * newZoom;
            if (newDiscR >= _canvasH * 0.92) {
                // Planet fills the screen — descend to surface
                if (window.SurfaceViewer) {
                    window.SurfaceViewer.open({
                        world:        _world,
                        sys:          _sys,
                        hexId:        _hexId,
                        startAzimuth: _wrapAz(_approachLon),
                        startLat:     _approachLat,
                    });
                }
                close();
            } else {
                _approachZoom = newZoom;
            }
        } else {
            _approachZoom /= ZOOM_FACTOR;
            if (_approachZoom < 1.0) close();
        }
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) close();
    });

    // ── Public API ─────────────────────────────────────────────────────────────

    function isOpen() { return _overlay !== null; }

    function handleWheel(direction) { if (direction < 0 && _approachZoom <= 1.0) close(); }

    function open({ world, sys, hexId }) {
        if (isOpen()) close();

        _world        = world;
        _sys          = sys;
        _hexId        = hexId;
        _worldData    = _worldDataFromNormalised(world);
        _approachZoom = 1.0;
        _approachLon  = 0;
        _approachLat  = 0;
        _prevElapsed  = 0;

        _stars = _buildStarField(mulberry32(hashString(hexId + '-av-stars')));

        _buildOverlay();
        _startPrerender();
        _startTime = performance.now();
        _startLoop();
    }

    function close() {
        if (!_overlay) return;
        cancelAnimationFrame(_animFrameId);
        if (_renderRafId !== null) cancelAnimationFrame(_renderRafId);
        window.removeEventListener('mousemove', _onWindowMouseMove);
        window.removeEventListener('mouseup',   _onWindowMouseUp);
        _overlay.remove();
        _overlay      = null;
        _canvas       = null;
        _ctx          = null;
        _world        = null;
        _sys          = null;
        _hexId        = null;
        _worldData    = null;
        _frames       = [];
        _frameReady   = 0;
        _renderRafId  = null;
        _stars        = [];
        _dragging     = false;
        _dragLast     = null;
        _startTime    = 0;
        _animFrameId  = null;
        _prevElapsed  = 0;
    }

    return { open, close, isOpen, handleWheel };

})();

window.ApproachViewer = ApproachViewer;
