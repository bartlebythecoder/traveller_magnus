'use strict';

// =============================================================================
// SURFACE_VIEWER.JS — Planetary Surface Panorama
// Triggered when scrolling past max orrery zoom on a terrestrial body.
// Renders a seeded 360° cylindrical panorama: sky, stars, sun, terrain,
// companion stars, moons, parent body, city skyline, ground texture, tooltips.
// Exposes window.SurfaceViewer  { open, close, isOpen, handleWheel }
// =============================================================================

const SurfaceViewer = (() => {

    // ── State ─────────────────────────────────────────────────────────────────
    let _lightMode = false;
    let _overlay   = null;
    let _canvas    = null;
    let _ctx       = null;
    let _tooltip   = null;
    let _world     = null;
    let _sys       = null;
    let _hexId     = null;
    let _canvasW   = 0;
    let _canvasH   = 0;

    let _azimuth        = 0;                  // viewport centre, radians [0, 2π]
    const FOV           = Math.PI * 2 / 3;   // 120° horizontal field of view

    let _worldType      = 'standard';
    let _terrainProfile = null;               // Float32Array(720), normalised [0,1]
    let _stars          = [];
    let _sunAz          = 0;                  // radians
    let _sunAlt         = 30;                 // degrees above horizon
    let _daylight       = 0;                  // [0,1] — 0=night, 1=full day
    let _skyBodies      = [];                 // companion stars, moons, parent body
    let _skyBodyHits    = [];                 // hit targets rebuilt each frame for tooltip
    let _cityBuildings  = [];                 // seeded building descriptors (pop ≥ 6)

    let _dragging    = false;
    let _dragLast    = null;
    let _startTime   = 0;
    let _animFrameId = null;

    // ── Data tables ───────────────────────────────────────────────────────────

    const _STAR_COLORS = {
        O: '#9bb0ff', B: '#aabfff', A: '#cad7ff',
        F: '#f8f7ff', G: '#fff4ea', K: '#ffd2a1',
        M: '#ffcc6f', D: '#dce0ff', BD: '#a56432',
    };

    const _SKY_NIGHT = {
        rock:       { zenith: '#030306', mid: '#060609', horizon: '#0d0d14' },
        ice:        { zenith: '#04080f', mid: '#0a1624', horizon: '#182840' },
        desert:     { zenith: '#080610', mid: '#1a1230', horizon: '#38263a' },
        molten:     { zenith: '#080300', mid: '#180800', horizon: '#3c1200' },
        exotic_dry: { zenith: '#100800', mid: '#281400', horizon: '#5a3000' },
        exotic_wet: { zenith: '#060800', mid: '#121600', horizon: '#363c00' },
        standard:   { zenith: '#020510', mid: '#091726', horizon: '#1c3858' },
    };

    const _SKY_DAY = {
        rock:       { zenith: '#050408', mid: '#080608', horizon: '#181018' },
        ice:        { zenith: '#0e1e40', mid: '#1a3868', horizon: '#90b8d0' },
        desert:     { zenith: '#1e2860', mid: '#2a4888', horizon: '#a0805a' },
        molten:     { zenith: '#100400', mid: '#200800', horizon: '#4a1800' },
        exotic_dry: { zenith: '#180e00', mid: '#382000', horizon: '#7a4a10' },
        exotic_wet: { zenith: '#0a0e00', mid: '#182000', horizon: '#485820' },
        standard:   { zenith: '#0a2a5e', mid: '#1a5aa0', horizon: '#6ab0d8' },
    };

    const _TERRAIN = {
        rock:       { fill: '#706860', shadow: '#504840' },
        ice:        { fill: '#c8d4e0', shadow: '#a0b4c4' },
        desert:     { fill: '#b8946a', shadow: '#987050' },
        molten:     { fill: '#5c2210', shadow: '#3a1008' },
        exotic_dry: { fill: '#6a3810', shadow: '#4a2808' },
        exotic_wet: { fill: '#3a4a28', shadow: '#283818' },
        standard:   { fill: '#586058', shadow: '#384038' },
    };

    const _GROUND = {
        rock:       '#484038',
        ice:        '#d0dce8',
        desert:     '#c8a478',
        molten:     '#8a2008',
        exotic_dry: '#7a3818',
        exotic_wet: '#485830',
        standard:   '#1a5070',
    };

    const _TERRAIN_PARAMS = {
        rock:       { harmonics: 8, roughness: 0.65, base: 0.10 },
        ice:        { harmonics: 6, roughness: 0.45, base: 0.20 },
        desert:     { harmonics: 5, roughness: 0.35, base: 0.35 },
        molten:     { harmonics: 8, roughness: 0.70, base: 0.05 },
        exotic_dry: { harmonics: 7, roughness: 0.60, base: 0.20 },
        exotic_wet: { harmonics: 6, roughness: 0.50, base: 0.25 },
        standard:   { harmonics: 6, roughness: 0.52, base: 0.25 },
    };

    // Building count and max height (px) by population digit
    const _CITY_COUNT  = [0, 0, 0, 0, 0, 0, 15, 30,  55,  90, 130];
    const _CITY_MAX_PX = [0, 0, 0, 0, 0, 0, 40, 70, 110, 160, 210];

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _parseStat(v) {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseInt(v, 16) || 0;
        return 0;
    }

    function _wrapAz(az) {
        const TWO_PI = Math.PI * 2;
        return ((az % TWO_PI) + TWO_PI) % TWO_PI;
    }

    function _classifyWorld(world) {
        const uwp     = world.uwp || '';
        const atm     = _parseStat(uwp[2] || '0');
        const hydro   = _parseStat(uwp[3] || '0');
        const tempK   = world.meanTempK || 0;
        const tempStr = (world.temperature || '').toLowerCase();

        if (hydro === 15 || (hydro === 0 && tempK > 1000))             return 'molten';
        if (atm === 0 && hydro === 0)                                   return 'rock';
        if (atm === 0 && hydro > 0)                                     return 'ice';
        if (atm > 0 && hydro > 0 &&
            ((tempK > 0 && tempK < 223) || tempStr.includes('frozen'))) return 'ice';
        if (atm >= 10 && atm <= 12 && hydro === 0)                      return 'exotic_dry';
        if (atm >= 10 && atm <= 12 && hydro > 0)                        return 'exotic_wet';
        if (hydro === 0)                                                 return 'desert';
        return 'standard';
    }

    // ── Colour interpolation ──────────────────────────────────────────────────

    function _hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function _lerpHex(a, b, t) {
        const ca = _hexToRgb(a), cb = _hexToRgb(b);
        const r  = Math.round(ca[0] + (cb[0] - ca[0]) * t);
        const g  = Math.round(ca[1] + (cb[1] - ca[1]) * t);
        const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
    }

    // ── Daylight model ────────────────────────────────────────────────────────

    function _computeDaylight(altDeg) {
        if (altDeg <= 0)  return 0.0;
        if (altDeg <= 10) return (altDeg / 10) * 0.40;
        if (altDeg <= 30) return 0.40 + ((altDeg - 10) / 20) * 0.45;
        return Math.min(1.0, 0.85 + ((altDeg - 30) / 30) * 0.15);
    }

    // ── Terrain profile ───────────────────────────────────────────────────────

    function _buildTerrainProfile(rng, numHarmonics, roughness, base) {
        const N   = 720;
        const raw = new Float32Array(N);
        for (let k = 1; k <= numHarmonics; k++) {
            const weight = Math.pow(roughness, k - 1);
            const amp    = weight * (0.3 + rng() * 0.4);
            const phase  = rng() * Math.PI * 2;
            for (let i = 0; i < N; i++) {
                raw[i] += amp * (0.5 + 0.5 * Math.sin(k * (i / N) * Math.PI * 2 + phase));
            }
        }
        let lo = raw[0], hi = raw[0];
        for (let i = 1; i < N; i++) {
            if (raw[i] < lo) lo = raw[i];
            if (raw[i] > hi) hi = raw[i];
        }
        const span = (hi - lo) || 1;
        for (let i = 0; i < N; i++) {
            raw[i] = base + ((raw[i] - lo) / span) * (1 - base);
        }
        return raw;
    }

    function _sampleProfile(az) {
        const idx = _wrapAz(az) / (Math.PI * 2) * 720;
        const i0  = Math.floor(idx) % 720;
        const i1  = (i0 + 1) % 720;
        const f   = idx - Math.floor(idx);
        return _terrainProfile[i0] * (1 - f) + _terrainProfile[i1] * f;
    }

    // ── Star field ────────────────────────────────────────────────────────────

    function _buildStarField(rng) {
        const stars = [];
        for (let i = 0; i < 200; i++) {
            stars.push({
                az:        rng() * Math.PI * 2,
                alt:       (5 + rng() * 75) * Math.PI / 180,
                r:         0.5 + rng() * 1.0,
                baseAlpha: 0.2 + rng() * 0.6,
                freq:      0.3 + rng() * 1.7,
                phase:     rng() * Math.PI * 2,
            });
        }
        return stars;
    }

    // ── Sky body helpers ──────────────────────────────────────────────────────

    function _isSameBody(a, b) {
        if (!a || !b) return false;
        if (a === b)  return true;
        if (a.uwp  && b.uwp  && a.uwp  === b.uwp)  return true;
        if (a.name && b.name && a.name === b.name) return true;
        return false;
    }

    function _findParentWorld() {
        if (!_sys || !_sys.worlds) return null;
        for (const w of _sys.worlds) {
            if (!w.moons) continue;
            for (const m of w.moons) {
                if (_isSameBody(m, _world)) return w;
            }
        }
        return null;
    }

    function _buildSkyBodies() {
        const bodies  = [];
        const bodyRng = mulberry32(hashString(_hexId + '-sv-bodies'));

        // Companion stars
        const companions = (_sys && _sys.stars) ? _sys.stars.slice(1) : [];
        companions.forEach(s => {
            bodies.push({
                kind: 'companion',
                az:   bodyRng() * Math.PI * 2,
                alt:  (15 + bodyRng() * 55) * Math.PI / 180,
                star: s,
            });
        });

        // Moons orbiting this world
        const moons = (_world.moons || []).filter(m => m.type !== 'Empty');
        moons.forEach(m => {
            const parentDiamKm = _world.diamKm || 12800;
            const moonDiamKm   = m.diamKm      || 2000;
            const pd           = m.pd           || 5;
            const angDiam      = moonDiamKm / (pd * parentDiamKm);
            const screenR      = Math.max(3, Math.min(80, (angDiam / FOV) * _canvasW * 0.5));
            bodies.push({
                kind:        'moon',
                az:          bodyRng() * Math.PI * 2,
                alt:         (10 + bodyRng() * 65) * Math.PI / 180,
                moon:        m,
                screenR,
                isMainworld: m.type === 'Mainworld',
            });
        });

        // Parent body (standing on a moon)
        const parent = _findParentWorld();
        if (parent) {
            const isGG    = parent.type === 'Gas Giant';
            const pd      = _world.pd || 5;
            const angDiam = 1 / pd;
            const screenR = Math.max(40, Math.min(300, (angDiam / FOV) * _canvasW * 0.5));

            const entry = {
                kind:    'parent',
                az:      bodyRng() * Math.PI * 2,
                alt:     (20 + bodyRng() * 50) * Math.PI / 180,
                world:   parent,
                screenR,
                wType:   _classifyWorld(parent),
                isGG,
            };

            if (isGG) {
                const bandRng  = mulberry32(hashString(_hexId + '-sv-gg'));
                const numBands = 3 + Math.floor(bandRng() * 3);
                const bands    = [];
                for (let i = 0; i < numBands; i++) {
                    bands.push({
                        skip:   bandRng() >= 0.45,
                        offset: 0.2 + bandRng() * 0.5,
                        dark:   bandRng() < 0.5,
                        alpha:  0.15 + bandRng() * 0.20,
                    });
                }
                entry.numBands = numBands;
                entry.bands    = bands;
                entry.isLarge  = parent.ggType === 'GL';
            }

            bodies.push(entry);
        }

        return bodies;
    }

    // ── City building helpers ─────────────────────────────────────────────────

    function _buildCityBuildings(rng, popCode) {
        if (popCode < 6) return [];
        const count  = _CITY_COUNT[Math.min(popCode, 10)]  || 15;
        const maxHPx = _CITY_MAX_PX[Math.min(popCode, 10)] || 40;
        const buildings = [];
        for (let i = 0; i < count; i++) {
            const az           = rng() * Math.PI * 2;
            const halfWidthRad = 0.006 + rng() * 0.022;
            let   heightPx     = (0.2 + rng() * 0.8) * maxHPx;
            // Every ~15 buildings, a tower/spire to break up the uniform line
            if (i % 15 === 7) heightPx = Math.min(maxHPx * 2.2, heightPx * 1.8 + maxHPx * 0.4);
            buildings.push({ az, halfWidthRad, heightPx: Math.round(heightPx) });
        }
        return buildings;
    }

    // ── Screen coordinate mapping ─────────────────────────────────────────────

    function _toScreen(az, altRad) {
        const halfFOV  = FOV / 2;
        const horizonY = _canvasH * 0.62;
        let dAz = _wrapAz(az - _azimuth + Math.PI) - Math.PI;
        if (Math.abs(dAz) > halfFOV * 1.05) return null;
        const x = _canvasW / 2 + (dAz / halfFOV) * (_canvasW / 2);
        const y = horizonY - (altRad / (Math.PI / 2)) * horizonY;
        return { x, y };
    }

    // ── Draw: sky ─────────────────────────────────────────────────────────────

    function _drawSky() {
        const ctx      = _ctx;
        const horizonY = _canvasH * 0.62;
        const night    = _SKY_NIGHT[_worldType] || _SKY_NIGHT.standard;
        const day      = _SKY_DAY[_worldType]   || _SKY_DAY.standard;
        const t        = _daylight;
        const grad     = ctx.createLinearGradient(0, 0, 0, horizonY);
        grad.addColorStop(0,    _lerpHex(night.zenith,  day.zenith,  t));
        grad.addColorStop(0.55, _lerpHex(night.mid,     day.mid,     t));
        grad.addColorStop(1,    _lerpHex(night.horizon, day.horizon, t));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, _canvasW, horizonY + 1);
    }

    // ── Draw: ground strip ────────────────────────────────────────────────────

    function _drawGround() {
        const horizonY = _canvasH * 0.62;
        _ctx.fillStyle = _GROUND[_worldType] || _GROUND.standard;
        _ctx.fillRect(0, horizonY, _canvasW, _canvasH - horizonY);
    }

    // ── Draw: atmospheric haze ────────────────────────────────────────────────
    // Brightens the lower sky toward the horizon, simulating Rayleigh scattering.
    // Intensity scales with atmosphere code and daylight.

    function _drawAtmosphericHaze() {
        const atm = _parseStat((_world.uwp || '')[2] || '0');
        if (atm === 0) return;

        const ctx      = _ctx;
        const W = _canvasW, H = _canvasH;
        const horizonY = H * 0.62;
        const hazeH    = horizonY * 0.40;

        const atmStrength = Math.min(1, atm / 9);
        const hazeAlpha   = (0.06 + 0.14 * atmStrength) * _daylight;
        if (hazeAlpha < 0.005) return;

        const a = hazeAlpha.toFixed(3);
        const hazeColors = {
            standard:   `rgba(140,185,225,${a})`,
            ice:        `rgba(160,205,235,${a})`,
            desert:     `rgba(185,138,82,${a})`,
            molten:     `rgba(130,65,22,${a})`,
            exotic_dry: `rgba(225,148,42,${a})`,
            exotic_wet: `rgba(105,185,65,${a})`,
        };
        const color = hazeColors[_worldType] || hazeColors.standard;

        const grad = ctx.createLinearGradient(0, horizonY - hazeH, 0, horizonY);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizonY - hazeH, W, hazeH);
    }

    // ── Draw: horizon glow near sun direction ─────────────────────────────────

    function _drawDaylight() {
        if (_daylight < 0.05) return;
        const ctx      = _ctx;
        const W = _canvasW, H = _canvasH;
        const horizonY = H * 0.62;
        const halfFOV  = FOV / 2;

        let dAz = _wrapAz(_sunAz - _azimuth + Math.PI) - Math.PI;
        if (Math.abs(dAz) > Math.PI * 0.65) return;

        const sunX      = W / 2 + (dAz / halfFOV) * (W / 2);
        const altFactor = Math.max(0, 1 - _sunAlt / 60);
        const alpha     = _daylight * (0.12 + 0.38 * altFactor);
        const glowR     = W * 0.50;

        const glow = ctx.createRadialGradient(sunX, horizonY, 0, sunX, horizonY, glowR);
        glow.addColorStop(0,   `rgba(245,170,55,${alpha.toFixed(3)})`);
        glow.addColorStop(0.4, `rgba(225,95,25,${(alpha * 0.55).toFixed(3)})`);
        glow.addColorStop(1,   'rgba(0,0,0,0)');

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, horizonY);
        ctx.clip();
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, horizonY);
        ctx.restore();
    }

    // ── Draw: twinkling stars ─────────────────────────────────────────────────

    function _drawStars(elapsed) {
        const ctx      = _ctx;
        const atm      = _parseStat((_world.uwp || '')[2] || '0');
        const atmFade  = 1 - Math.min(1, atm / 9) * 0.70;
        const dayFade  = 1 - _daylight * 0.95;
        const alphaMax = atmFade * dayFade;
        if (alphaMax < 0.01) return;

        ctx.fillStyle = '#ffffff';
        for (const s of _stars) {
            const pos = _toScreen(s.az, s.alt);
            if (!pos) continue;

            let dAzSun    = _wrapAz(s.az - _sunAz + Math.PI) - Math.PI;
            const sunProx = Math.max(0, 1 - Math.abs(dAzSun) / (20 * Math.PI / 180));
            const twinkle = 0.7 + 0.3 * Math.sin(s.freq * elapsed + s.phase);
            const alpha   = s.baseAlpha * alphaMax * twinkle * (1 - sunProx * 0.9);
            if (alpha < 0.01) continue;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw: sky bodies ──────────────────────────────────────────────────────

    function _drawSkyBodies() {
        for (const body of _skyBodies) {
            if      (body.kind === 'companion') _drawCompanionStar(body);
            else if (body.kind === 'moon')      _drawMoonBody(body);
            else if (body.kind === 'parent')    _drawParentBody(body);
        }
    }

    function _drawCompanionStar(body) {
        const ctx   = _ctx;
        const pos   = _toScreen(body.az, body.alt);
        if (!pos) return;

        const s     = body.star;
        const color = _STAR_COLORS[s.sType] || '#fff4ea';
        const au    = (s.orbitAU !== undefined && s.orbitAU !== null) ? s.orbitAU : 10;
        const r     = au < 0.5 ? 10 : 4;

        const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.3, pos.x, pos.y, r * 5);
        glow.addColorStop(0, color + '99');
        glow.addColorStop(1, color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();

        _skyBodyHits.push({ kind: 'companion', body, x: pos.x, y: pos.y, r: 28 });
    }

    function _drawMoonBody(body) {
        const ctx = _ctx;
        const pos = _toScreen(body.az, body.alt);
        if (!pos) return;

        const r    = body.screenR;
        const disc = ctx.createRadialGradient(
            pos.x - r * 0.28, pos.y - r * 0.28, 0, pos.x, pos.y, r
        );
        disc.addColorStop(0,   '#dcdce8');
        disc.addColorStop(0.6, '#a0a0b0');
        disc.addColorStop(1,   '#505060');
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (body.isMainworld) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r + 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#66fcf188';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        _skyBodyHits.push({ kind: 'moon', body, x: pos.x, y: pos.y, r: r + 8 });
    }

    function _drawParentBody(body) {
        const ctx = _ctx;
        const pos = _toScreen(body.az, body.alt);
        if (!pos) return;

        const r = body.screenR;

        if (body.isGG) {
            _drawGasGiantDisc(ctx, pos.x, pos.y, r, body);
        } else {
            const ter  = _TERRAIN[body.wType] || _TERRAIN.standard;
            const disc = ctx.createRadialGradient(
                pos.x - r * 0.3, pos.y - r * 0.3, 0, pos.x, pos.y, r
            );
            disc.addColorStop(0,   '#ffffffaa');
            disc.addColorStop(0.3, ter.fill);
            disc.addColorStop(1,   ter.shadow);
            ctx.fillStyle = disc;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const hasAtmo = body.isGG || _parseStat((body.world.uwp || '')[2] || '0') > 0;
        if (hasAtmo) {
            const limbColor = body.isGG
                ? 'rgba(200,160,100,0.35)'
                : 'rgba(100,160,255,0.28)';
            const limb = ctx.createRadialGradient(pos.x, pos.y, r * 0.88, pos.x, pos.y, r * 1.14);
            limb.addColorStop(0,   'rgba(0,0,0,0)');
            limb.addColorStop(0.5, limbColor);
            limb.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = limb;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r * 1.14, 0, Math.PI * 2);
            ctx.fill();
        }

        _skyBodyHits.push({ kind: 'parent', body, x: pos.x, y: pos.y, r: r + 10 });
    }

    function _drawGasGiantDisc(ctx, cx, cy, r, entry) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = entry.isLarge ? '#c8a060' : '#d0b888';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        const bandH = (r * 2) / entry.numBands;
        entry.bands.forEach((b, i) => {
            if (b.skip) return;
            const by = cy - r + i * bandH;
            const bh = bandH * b.offset;
            ctx.fillStyle = b.dark
                ? `rgba(80,50,20,${b.alpha.toFixed(3)})`
                : `rgba(255,220,160,${b.alpha.toFixed(3)})`;
            ctx.fillRect(cx - r, by, r * 2, bh);
        });

        const light = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx, cy, r);
        light.addColorStop(0,   'rgba(255,255,255,0.18)');
        light.addColorStop(0.5, 'rgba(255,255,255,0.00)');
        light.addColorStop(0.8, 'rgba(0,0,0,0.00)');
        light.addColorStop(1,   'rgba(0,0,0,0.45)');
        ctx.fillStyle = light;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

        ctx.restore();
    }

    // ── Draw: primary star ────────────────────────────────────────────────────

    function _drawSun() {
        const ctx  = _ctx;
        const star = _sys && _sys.stars && _sys.stars[0];
        if (!star) return;

        const altRad = _sunAlt * Math.PI / 180;
        const pos    = _toScreen(_sunAz, altRad);
        if (!pos) return;

        const cls = star.sClass || 'V';
        let r;
        if      (cls === 'Ia' || cls === 'Ib') r = 32;
        else if (cls === 'II' || cls === 'III') r = 24;
        else if (cls === 'IV')                  r = 18;
        else if (star.sType === 'D')            r = 6;
        else if (star.sType === 'BD')           r = 7;
        else if (star.sType === 'M')            r = 10;
        else if (star.sType === 'K')            r = 13;
        else                                    r = 16;

        const color = _STAR_COLORS[star.sType] || '#fff4ea';

        const glow = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, r * 6);
        glow.addColorStop(0, color + '88');
        glow.addColorStop(1, color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        const disc = ctx.createRadialGradient(pos.x - r * 0.3, pos.y - r * 0.3, 0, pos.x, pos.y, r);
        disc.addColorStop(0,   '#ffffff');
        disc.addColorStop(0.4, color);
        disc.addColorStop(1,   color + 'bb');
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();

        _skyBodyHits.push({ kind: 'sun', body: null, x: pos.x, y: pos.y, r: r + 14 });
    }

    // ── Draw: terrain silhouette ──────────────────────────────────────────────
    // Ocean worlds get a water-blue gradient in the foreground so the surface
    // reads as a sea rather than bare terrain.

    function _drawTerrain() {
        const ctx      = _ctx;
        const W = _canvasW, H = _canvasH;
        const horizonY = H * 0.62;
        const maxTerrH = H * 0.26;
        const ter      = _TERRAIN[_worldType] || _TERRAIN.standard;

        ctx.beginPath();
        for (let xi = 0; xi <= W; xi++) {
            const az = _wrapAz(_azimuth - FOV / 2 + (xi / W) * FOV);
            const y  = horizonY - _sampleProfile(az) * maxTerrH;
            xi === 0 ? ctx.moveTo(xi, y) : ctx.lineTo(xi, y);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();

        const hydro   = _parseStat((_world.uwp || '')[3] || '0');
        const isOcean = _worldType === 'standard' && hydro > 0;

        const terrGrad = ctx.createLinearGradient(0, horizonY - maxTerrH, 0, H);
        terrGrad.addColorStop(0,    ter.fill);
        terrGrad.addColorStop(0.35, ter.shadow);
        if (isOcean) {
            terrGrad.addColorStop(0.58, '#1e4a6a');
            terrGrad.addColorStop(1.0,  '#122840');
        } else {
            terrGrad.addColorStop(1.0, ter.shadow);
        }
        ctx.fillStyle = terrGrad;
        ctx.fill();
    }

    // ── Draw: terrain atmospheric edge glow ───────────────────────────────────
    // Soft coloured halo along the terrain silhouette — the atmosphere's limb
    // glow as seen from the surface.  Skipped for vacuum worlds.

    function _drawTerrainGlow() {
        if (_worldType === 'rock') return;

        const ctx      = _ctx;
        const W = _canvasW, H = _canvasH;
        const horizonY = H * 0.62;
        const maxTerrH = H * 0.26;

        const GLOW = {
            standard:   { color: 'rgba(100,170,255,0.30)', blur: 14 },
            ice:        { color: 'rgba(160,200,235,0.25)', blur: 12 },
            desert:     { color: 'rgba(180,130,80,0.28)',  blur: 12 },
            molten:     { color: 'rgba(255,90,20,0.55)',   blur: 20 },
            exotic_dry: { color: 'rgba(220,140,40,0.35)',  blur: 14 },
            exotic_wet: { color: 'rgba(100,180,60,0.28)',  blur: 12 },
        };
        const g = GLOW[_worldType] || GLOW.standard;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, horizonY);
        ctx.clip();

        ctx.shadowBlur  = g.blur;
        ctx.shadowColor = g.color;
        ctx.strokeStyle = g.color;
        ctx.lineWidth   = 1.5;

        ctx.beginPath();
        for (let xi = 0; xi <= W; xi++) {
            const az = _wrapAz(_azimuth - FOV / 2 + (xi / W) * FOV);
            const y  = horizonY - _sampleProfile(az) * maxTerrH;
            xi === 0 ? ctx.moveTo(xi, y) : ctx.lineTo(xi, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // ── Draw: terrain night / lava glow ───────────────────────────────────────
    // Two effects sharing the same shadow-stroke technique, both clipped to sky:
    //   Molten worlds  — always-on orange-red lava light from terrain valleys.
    //   Populated worlds (pop ≥ 7) at night — warm city-light glow over the hills.

    function _drawTerrainNightGlow() {
        const ctx      = _ctx;
        const W = _canvasW, H = _canvasH;
        const horizonY = H * 0.62;
        const maxTerrH = H * 0.26;

        const isMolten  = _worldType === 'molten';
        const popCode   = _parseStat((_world.uwp || '')[4] || '0');
        const cityFade  = _daylight < 0.4 ? (1 - _daylight / 0.4) : 0;
        const cityAlpha = (popCode >= 7 && cityFade > 0)
            ? cityFade * Math.min(1, (popCode - 6) / 4) * 0.12
            : 0;

        if (!isMolten && cityAlpha < 0.005) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, horizonY);
        ctx.clip();

        const drawGlowStroke = (color, blur) => {
            ctx.shadowBlur  = blur;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth   = 1;
            ctx.beginPath();
            for (let xi = 0; xi <= W; xi++) {
                const az = _wrapAz(_azimuth - FOV / 2 + (xi / W) * FOV);
                const y  = horizonY - _sampleProfile(az) * maxTerrH;
                xi === 0 ? ctx.moveTo(xi, y) : ctx.lineTo(xi, y);
            }
            ctx.stroke();
        };

        if (isMolten) {
            drawGlowStroke('rgba(255,70,10,0.50)', 22);
        }
        if (cityAlpha >= 0.005) {
            drawGlowStroke(`rgba(255,190,70,${cityAlpha.toFixed(3)})`, 14);
        }

        ctx.restore();
    }

    // ── Draw: ground texture (ocean shimmer) ──────────────────────────────────

    function _drawGroundTexture(elapsed) {
        if (_worldType !== 'standard') return;
        const hydro = _parseStat((_world.uwp || '')[3] || '0');
        if (hydro <= 0) return;

        const ctx     = _ctx;
        const W = _canvasW, H = _canvasH;
        const horizonY = H * 0.62;
        const groundH  = H - horizonY;

        const lines = [
            { frac: 0.15, h: 2, base: 0.030, freq: 0.25, phase: 0.00 },
            { frac: 0.35, h: 2, base: 0.040, freq: 0.35, phase: 1.57 },
            { frac: 0.58, h: 3, base: 0.050, freq: 0.20, phase: 3.14 },
            { frac: 0.80, h: 3, base: 0.060, freq: 0.40, phase: 4.71 },
        ];

        for (const ln of lines) {
            const y     = horizonY + groundH * ln.frac;
            const alpha = ln.base + 0.025 * Math.sin(elapsed * ln.freq + ln.phase);
            if (alpha <= 0.005) continue;
            const grad = ctx.createLinearGradient(0, 0, W, 0);
            grad.addColorStop(0.0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.2, `rgba(255,255,255,${alpha.toFixed(3)})`);
            grad.addColorStop(0.8, `rgba(255,255,255,${alpha.toFixed(3)})`);
            grad.addColorStop(1.0, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, y, W, ln.h);
        }
    }

    // ── Draw: city skyline ────────────────────────────────────────────────────

    function _drawCity() {
        if (!_cityBuildings || _cityBuildings.length === 0) return;
        const ctx      = _ctx;
        const H = _canvasH;
        const horizonY = H * 0.62;
        const maxTerrH = H * 0.26;
        const halfFOV  = FOV / 2;

        _cityBuildings.forEach((b, bIdx) => {
            const dAzCentre = _wrapAz(b.az - _azimuth + Math.PI) - Math.PI;
            if (Math.abs(dAzCentre) > halfFOV + b.halfWidthRad + 0.01) return;

            const xCentre = _canvasW / 2 + (dAzCentre / halfFOV) * (_canvasW / 2);
            const xOffset = (b.halfWidthRad / halfFOV) * (_canvasW / 2);
            const xL      = Math.max(0, xCentre - xOffset);
            const xR      = Math.min(_canvasW, xCentre + xOffset);
            if (xR - xL < 1) return;

            const baseY = horizonY - _sampleProfile(b.az) * maxTerrH;
            const topY  = Math.max(0, baseY - b.heightPx);
            if (topY >= baseY) return;

            ctx.fillStyle = '#14141e';
            ctx.fillRect(xL, topY, xR - xL, baseY - topY);
            _drawBuildingWindows(ctx, xL, xR, topY, baseY, bIdx);
        });
    }

    function _drawBuildingWindows(ctx, xL, xR, topY, baseY, bIdx) {
        const bW = xR - xL;
        const bH = baseY - topY;
        if (bW < 5 || bH < 7) return;

        const winW = Math.max(3, Math.min(8,  Math.floor(bW / 3.5)));
        const winH = Math.max(4, Math.min(10, Math.floor(bH / 4.0)));
        const gapX = Math.max(2, Math.floor(winW * 0.5));
        const gapY = Math.max(2, Math.floor(winH * 0.5));

        const cols = Math.max(1, Math.floor((bW - gapX) / (winW + gapX)));
        const rows = Math.max(1, Math.floor((bH - gapY) / (winH + gapY)));

        // More windows lit in darkness; fewer during daylight
        const litThreshold = 0.38 - (1 - _daylight) * 0.26;
        const winAlpha     = 0.30 + (1 - _daylight) * 0.58;

        const marginX = (bW - cols * (winW + gapX) + gapX) / 2;
        const marginY = (bH - rows * (winH + gapY) + gapY) / 2;

        ctx.fillStyle = `rgba(255,240,170,${winAlpha.toFixed(2)})`;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hash = (((bIdx * 97 + r) * 31 + c) * 2654435761) >>> 0;
                if (hash / 0xffffffff < litThreshold) continue;
                ctx.fillRect(
                    xL + marginX + c * (winW + gapX),
                    topY + marginY + r * (winH + gapY),
                    winW, winH
                );
            }
        }
    }

    // ── Animation loop ────────────────────────────────────────────────────────

    function _drawFrame(elapsed) {
        if (!_ctx || !_canvasW || !_canvasH) return;
        _ctx.clearRect(0, 0, _canvasW, _canvasH);
        _skyBodyHits = [];
        _drawGround();
        _drawSky();
        _drawAtmosphericHaze();
        _drawDaylight();
        _drawStars(elapsed);
        _drawSkyBodies();
        _drawSun();
        _drawTerrain();
        _drawTerrainGlow();
        _drawTerrainNightGlow();
        _drawGroundTexture(elapsed);
        _drawCity();
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
        const name    = _world.name || _world.type || 'Unknown World';
        const edition = (_sys && _sys.edition) || '';

        const P = _lightMode
            ? { bg: '#ffffff', border: '#45a29e88', text: '#1a1a2e', accent: '#0d6b64',
                sub: '#4a5568', hint: '#6b7280', badge: '#45a29e', badgeBorder: '#45a29eaa' }
            : { bg: '#000000', border: '#45a29e55', text: '#c5c6c7', accent: '#66fcf1',
                sub: '#8a8f94', hint: '#55686b', badge: '#45a29e', badgeBorder: '#45a29e55' };

        _overlay = document.createElement('div');
        _overlay.id = 'surface-viewer-overlay';
        Object.assign(_overlay.style, {
            position: 'fixed', inset: '0', zIndex: '9500',
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
        title.textContent = `SURFACE  ${_hexId}`;

        const edBadge = document.createElement('span');
        Object.assign(edBadge.style, {
            fontSize: '10px', color: P.badge,
            border: `1px solid ${P.badgeBorder}`, padding: '1px 6px',
        });
        edBadge.textContent = edition;

        const worldLabel = document.createElement('span');
        Object.assign(worldLabel.style, { fontSize: '12px', color: P.sub });
        worldLabel.textContent = name;

        header.append(title, edBadge, worldLabel);

        if (_world.uwp) {
            const uwpLabel = document.createElement('span');
            Object.assign(uwpLabel.style, { fontSize: '11px', color: P.hint });
            uwpLabel.textContent = _world.uwp;
            header.appendChild(uwpLabel);
        }

        const hint = document.createElement('span');
        Object.assign(hint.style, {
            fontSize: '11px', color: P.hint, marginLeft: 'auto', marginRight: '12px',
        });
        hint.textContent = 'Drag or ←→ to pan  ·  Scroll out or ESC to return';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: `1px solid ${P.badge}`,
            color: P.accent, padding: '3px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px',
        });
        closeBtn.addEventListener('click', close);

        header.append(hint, closeBtn);
        _overlay.appendChild(header);

        _canvas = document.createElement('canvas');
        Object.assign(_canvas.style, { display: 'block', cursor: 'grab' });
        _overlay.appendChild(_canvas);

        // Tooltip
        _tooltip = document.createElement('div');
        Object.assign(_tooltip.style, {
            position:      'fixed',
            display:       'none',
            pointerEvents: 'none',
            background:    _lightMode ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,20,0.95)',
            border:        `1px solid ${P.badge}`,
            color:         P.text,
            padding:       '8px 12px',
            fontSize:      '12px',
            lineHeight:    '1.65',
            maxWidth:      '260px',
            zIndex:        '9600',
            fontFamily:    '"Share Tech Mono", "Courier New", monospace',
        });
        _overlay.appendChild(_tooltip);

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

        _canvas.addEventListener('mousedown',  _onMouseDown);
        _canvas.addEventListener('wheel',      _onWheel, { passive: false });
        _canvas.addEventListener('mousemove',  _onCanvasMouseMove);
        _canvas.addEventListener('mouseleave', _hideTooltip);
        window.addEventListener('mousemove',   _onWindowMouseMove);
        window.addEventListener('mouseup',     _onWindowMouseUp);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    function _onMouseDown(e) {
        if (e.button !== 0) return;
        _hideTooltip();
        _dragging = true;
        _dragLast = { x: e.clientX };
        _canvas.style.cursor = 'grabbing';
    }

    function _onWindowMouseMove(e) {
        if (!_dragging) return;
        const dx  = e.clientX - _dragLast.x;
        _azimuth  = _wrapAz(_azimuth - (dx / _canvasW) * FOV);
        _dragLast = { x: e.clientX };
    }

    function _onWindowMouseUp() {
        if (!_dragging) return;
        _dragging = false;
        if (_canvas) _canvas.style.cursor = 'grab';
    }

    function _onWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY > 0) close();
    }

    // ── Tooltip ───────────────────────────────────────────────────────────────

    function _onCanvasMouseMove(e) {
        if (_dragging) return;
        const mx = e.clientX;
        const my = e.clientY;
        for (let i = _skyBodyHits.length - 1; i >= 0; i--) {
            const h  = _skyBodyHits[i];
            const dx = mx - h.x;
            const dy = my - h.y;
            if (dx * dx + dy * dy <= h.r * h.r) {
                _showBodyTooltip(h, mx, my);
                return;
            }
        }
        _hideTooltip();
    }

    function _showBodyTooltip(hit, mx, my) {
        if (!_tooltip) return;
        const TH = _lightMode ? '#0d6b64' : '#66fcf1';
        const TB = '#45a29e44';
        let html = '';

        if (hit.kind === 'sun') {
            const s    = _sys && _sys.stars && _sys.stars[0];
            if (!s) return;
            const name = s.name || `${s.sType}${s.subType ?? ''} ${s.sClass || ''}`.trim();
            html += `<div style="color:${TH};border-bottom:1px solid ${TB};padding-bottom:4px;margin-bottom:5px">${name}</div>`;
            html += `<div>Primary Star</div>`;
            html += `<div>Type: ${s.sType}${s.subType ?? ''} ${s.sClass || ''}</div>`;
            if (s.lum  != null) html += `<div>Luminosity: ${s.lum.toFixed(3)} L☉</div>`;
            if (s.mass != null) html += `<div>Mass: ${s.mass.toFixed(3)} M☉</div>`;

        } else if (hit.kind === 'companion') {
            const s    = hit.body.star;
            const name = s.name || `${s.sType}${s.subType ?? ''} ${s.sClass || ''}`.trim();
            html += `<div style="color:${TH};border-bottom:1px solid ${TB};padding-bottom:4px;margin-bottom:5px">${name}</div>`;
            html += `<div>Companion Star</div>`;
            html += `<div>Type: ${s.sType}${s.subType ?? ''} ${s.sClass || ''}</div>`;
            const au = (s.orbitAU !== undefined && s.orbitAU !== null) ? s.orbitAU : null;
            if (au)            html += `<div>Distance: ${au.toFixed(2)} AU</div>`;
            if (s.lum  != null) html += `<div>Luminosity: ${s.lum.toFixed(3)} L☉</div>`;
            if (s.mass != null) html += `<div>Mass: ${s.mass.toFixed(3)} M☉</div>`;

        } else if (hit.kind === 'moon') {
            const m    = hit.body.moon;
            const name = m.name || 'Unnamed Satellite';
            const type = m.type === 'Mainworld' ? 'Mainworld Satellite' : 'Satellite';
            html += `<div style="color:${TH};border-bottom:1px solid ${TB};padding-bottom:4px;margin-bottom:5px">${name}</div>`;
            html += `<div>${type}</div>`;
            if (m.uwp) html += `<div style="margin-top:4px">UWP: <strong>${m.uwp}</strong></div>`;
            const pd       = m.pd || 5;
            const angDeg   = (m.diamKm || 2000) / (pd * (_world.diamKm || 12800)) * 180 / Math.PI;
            html += `<div>Apparent size: ${angDeg.toFixed(2)}°</div>`;
            if (m.gravity != null) html += `<div>Gravity: ${m.gravity.toFixed(2)} G</div>`;

        } else if (hit.kind === 'parent') {
            const w    = hit.body.world;
            const name = w.name || (hit.body.isGG ? 'Gas Giant' : 'Planet');
            html += `<div style="color:${TH};border-bottom:1px solid ${TB};padding-bottom:4px;margin-bottom:5px">${name}</div>`;
            html += `<div>${hit.body.isGG ? 'Gas Giant' : 'Terrestrial World'}</div>`;
            if (w.uwp) html += `<div style="margin-top:4px">UWP: <strong>${w.uwp}</strong></div>`;
            const pd     = _world.pd || 5;
            const angDeg = (180 / Math.PI) / pd;
            html += `<div>Apparent size: ${angDeg.toFixed(1)}°</div>`;
            if (w.gravity != null) html += `<div>Gravity: ${w.gravity.toFixed(2)} G</div>`;
        }

        if (!html) return;
        _tooltip.innerHTML    = html;
        _tooltip.style.display = 'block';

        const W = window.innerWidth, H = window.innerHeight;
        let tx = mx + 16, ty = my - 10;
        if (tx + 270 > W) tx = mx - 280;
        if (ty + 190 > H) ty = my - 200;
        _tooltip.style.left = Math.max(0, tx) + 'px';
        _tooltip.style.top  = Math.max(0, ty) + 'px';
    }

    function _hideTooltip() {
        if (_tooltip) _tooltip.style.display = 'none';
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────

    document.addEventListener('keydown', e => {
        if (!isOpen()) return;
        if (e.key === 'Escape')     { close(); return; }
        if (e.key === 'ArrowLeft')  _azimuth = _wrapAz(_azimuth - 3 * Math.PI / 180);
        if (e.key === 'ArrowRight') _azimuth = _wrapAz(_azimuth + 3 * Math.PI / 180);
    });

    // ── Public API ─────────────────────────────────────────────────────────────

    function isOpen() { return _overlay !== null; }

    function handleWheel(direction) { if (direction < 0) close(); }

    function open({ world, sys, hexId, startAzimuth, startLat }) {
        if (isOpen()) close();

        _world     = world;
        _sys       = sys;
        _hexId     = hexId;
        _lightMode = !!window.printMode;
        _azimuth   = (typeof startAzimuth === 'number') ? startAzimuth : 0;

        _worldType = _classifyWorld(world);

        const p = _TERRAIN_PARAMS[_worldType] || _TERRAIN_PARAMS.standard;
        _terrainProfile = _buildTerrainProfile(
            mulberry32(hashString(hexId + '-sv-terrain')),
            p.harmonics, p.roughness, p.base
        );

        _stars = _buildStarField(mulberry32(hashString(hexId + '-sv-stars')));

        const sunRng = mulberry32(hashString(hexId + '-sv-sun'));
        _sunAz  = sunRng() * Math.PI * 2;
        _sunAlt = 20 + sunRng() * 40;

        // _buildOverlay must run first — sets _canvasW used by sky bodies + city
        _buildOverlay();
        _daylight  = _computeDaylight(_sunAlt);
        _skyBodies = _buildSkyBodies();

        const popCode  = _parseStat((_world.uwp || '')[4] || '0');
        _cityBuildings = _buildCityBuildings(
            mulberry32(hashString(hexId + '-sv-city')), popCode
        );

        _startTime = performance.now();
        _startLoop();
    }

    function close() {
        if (!_overlay) return;
        cancelAnimationFrame(_animFrameId);
        window.removeEventListener('mousemove', _onWindowMouseMove);
        window.removeEventListener('mouseup',   _onWindowMouseUp);
        _overlay.remove();        // removes canvas, tooltip, and header from DOM
        _overlay        = null;
        _canvas         = null;
        _ctx            = null;
        _tooltip        = null;
        _world          = null;
        _sys            = null;
        _hexId          = null;
        _terrainProfile = null;
        _stars          = [];
        _daylight       = 0;
        _skyBodies      = [];
        _skyBodyHits    = [];
        _cityBuildings  = [];
        _dragging       = false;
        _dragLast       = null;
        _startTime      = 0;
        _animFrameId    = null;
    }

    return { open, close, isOpen, handleWheel };

})();

window.SurfaceViewer = SurfaceViewer;
