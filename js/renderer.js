// =============================================================================
// RENDERER.JS - Canvas & Rendering Logic
// =============================================================================

let canvas;
let ctx;

// -----------------------------------------------------------------------------
// Initialization Helper (Lazy Loading)
// -----------------------------------------------------------------------------
function initCanvas() {
    if (!canvas) {
        canvas = document.getElementById('map-canvas');
    }
    // Check if we need the context, regardless of when the canvas was found
    if (canvas && !ctx) {
        ctx = canvas.getContext('2d');
    }
    return canvas && ctx;
}
// -----------------------------------------------------------------------------
// Rendering Functions
// -----------------------------------------------------------------------------

function resize() {
    if (!initCanvas()) return;

    // Use the global width/height if they exist, otherwise window defaults
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Trigger initial draw after resize
    draw();
}

function getHexPath(x, y, size) {
    const path = new Path2D();
    for (let i = 0; i < 6; i++) {
        // Flat-topped hexagons start at 0 degrees instead of 30
        const angle_deg = 60 * i;
        const angle_rad = (Math.PI / 180) * angle_deg;
        const px = x + size * Math.cos(angle_rad);
        const py = y + size * Math.sin(angle_rad);
        if (i === 0) {
            path.moveTo(px, py);
        } else {
            path.lineTo(px, py);
        }
    }
    path.closePath();
    return path;
}

function draw() {
    // 1. Structural Safety Check
    if (!initCanvas()) return;

    // 2. Clear the canvas using the actual pixel dimensions
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Fill the background color
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // 4. Apply Camera Transformations
    // NOTE: We use width/height from the window directly for the viewport calculation
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);

    // 5. Grid Styling
    ctx.strokeStyle = '#1f2833';
    ctx.lineWidth = 1 / zoom;

    const size = baseHexSize;
    const widthStep = (3 / 2) * size;
    const heightStep = Math.sqrt(3) * size;

    // 6. Calculate visible bounds
    const viewLeft = cameraX;
    const viewRight = cameraX + window.innerWidth / zoom;
    const viewTop = cameraY;
    const viewBottom = cameraY + window.innerHeight / zoom;

    const qMin = Math.floor(viewLeft / widthStep) - 2;
    const qMax = Math.ceil(viewRight / widthStep) + 2;
    const rMin = Math.floor(viewTop / heightStep) - 2;
    const rMax = Math.ceil(viewBottom / heightStep) + 2;

    // (Moved to layered pass below)

    const MAX_GLOBAL_Q = 223;
    const MAX_GLOBAL_R = 199;

    // =========================================================================
    // PASS 1: DRAW THE GRID & HEX BACKGROUNDS
    // =========================================================================
    ctx.beginPath();
    for (let q = Math.max(0, qMin); q <= Math.min(MAX_GLOBAL_Q, qMax); q++) {
        for (let r = Math.max(0, rMin); r <= Math.min(MAX_GLOBAL_R, rMax); r++) {
            const offset = (q & 1) ? 0.5 : 0;
            let cx = widthStep * q;
            let cy = heightStep * (r + offset);

            const hexId = getHexId(q, r);
            if (!hexId) continue;

            const path = getHexPath(cx, cy, size);

            // 1. Selection Fill
            if (selectedHexes.has(hexId)) {
                ctx.fillStyle = 'rgba(255, 69, 0, 0.3)';
                ctx.fill(path);
                ctx.strokeStyle = '#ff4500';
                ctx.lineWidth = 2 / zoom;
                ctx.stroke(path);
            } else {
                // 2. Standard Grid Line
                ctx.strokeStyle = '#1f2833';
                ctx.lineWidth = 1 / zoom;
                ctx.stroke(path);
            }
        }
    }

    // =========================================================================
    // LAYER 2: INTERSTELLAR ROUTES (Now safely on top of the grid)
    // =========================================================================
    if (window.sectorRoutes && window.sectorRoutes.length > 0) {
        ctx.save();
        ctx.lineWidth = 2 / zoom;
        const gap = 20;

        // Separate routes by type for efficient batching
        const xboatRoutes = window.sectorRoutes.filter(r => r.type === 'Xboat');
        const tradeRoutes = window.sectorRoutes.filter(r => r.type === 'Trade');
        const secondaryRoutes = window.sectorRoutes.filter(r => r.type === 'Secondary');

        const drawBatch = (routes, color) => {
            ctx.strokeStyle = color;
            ctx.beginPath();
            routes.forEach(route => {
                const startCoords = getHexCoords(route.startId);
                const endCoords = getHexCoords(route.endId);
                if (startCoords && endCoords) {
                    const sPx = getHexPixel(startCoords.q, startCoords.r);
                    const ePx = getHexPixel(endCoords.q, endCoords.r);
                    const dx = ePx.x - sPx.x;
                    const dy = ePx.y - sPx.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > gap * 2) {
                        const ux = dx / dist;
                        const uy = dy / dist;
                        ctx.moveTo(sPx.x + ux * gap, sPx.y + uy * gap);
                        ctx.lineTo(ePx.x - ux * gap, ePx.y - uy * gap);
                    }
                }
            });
            ctx.stroke();
        };

        if (xboatRoutes.length > 0) drawBatch(xboatRoutes, '#00FF00');     // Bright Green
        if (tradeRoutes.length > 0) drawBatch(tradeRoutes, '#FF0000');     // Red
        if (secondaryRoutes.length > 0) drawBatch(secondaryRoutes, '#FFFF00'); // Yellow

        ctx.restore();
    }

    // Alt+Drag Route Preview
    if (isAltDragging && altDragStartId) {
        const startCoords = getHexCoords(altDragStartId);
        if (startCoords) {
            const sPx = getHexPixel(startCoords.q, startCoords.r);
            const worldMouse = { x: cameraX + currentMouseX / zoom, y: cameraY + currentMouseY / zoom };

            let previewColor = 'rgba(0, 255, 0, 0.5)'; // Default green
            if (altDragType === 'Trade') previewColor = 'rgba(255, 0, 0, 0.5)';
            else if (altDragType === 'Secondary') previewColor = 'rgba(255, 255, 0, 0.5)';

            ctx.save();
            ctx.strokeStyle = previewColor;
            ctx.setLineDash([10, 5]); // Dashed line for preview
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.moveTo(sPx.x, sPx.y);
            ctx.lineTo(worldMouse.x, worldMouse.y);
            ctx.stroke();
            ctx.restore();
        }
    }

    // =========================================================================
    // PASS 2: DRAW WORLD CONTENT (Icons, Labels, Symbols)
    // =========================================================================
    for (let q = Math.max(0, qMin); q <= Math.min(MAX_GLOBAL_Q, qMax); q++) {
        for (let r = Math.max(0, rMin); r <= Math.min(MAX_GLOBAL_R, rMax); r++) {
            const offset = (q & 1) ? 0.5 : 0;
            let cx = widthStep * q;
            let cy = heightStep * (r + offset);

            const hexId = getHexId(q, r);
            if (!hexId) continue;

            const isSelected = selectedHexes.has(hexId);
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') {
                stateObj = { type: stateObj };
                hexStates.set(hexId, stateObj);
            }
            const stateType = stateObj ? stateObj.type : 'BLANK';

            if (stateType === 'SYSTEM_PRESENT') {
                const data = stateObj.rttData || stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;

                if (!devView) {
                    // =============================================
                    // PRESENTATION VIEW
                    // =============================================
                    const baseWorldRadius = 10;
                    const minWorldRadius = 1.5 / zoom;
                    const dotRadius = Math.max(minWorldRadius, baseWorldRadius);

                    // --- Travel Zone Halo (Amber/Red) ---
                    if (data && data.travelZone && data.travelZone !== 'Green') {
                        const zoneColor = data.travelZone === 'Red' ? '#FF0000' : '#FFBF00';
                        ctx.save();
                        ctx.beginPath();
                        // Slightly larger than the world dot
                        const haloRadius = dotRadius + 5;
                        ctx.arc(cx, cy, haloRadius, 0, 2 * Math.PI);

                        // Faint fill (0.2 opacity)
                        ctx.globalAlpha = 0.2;
                        ctx.fillStyle = zoneColor;
                        ctx.fill();

                        // Solid stroke (2-3px)
                        ctx.globalAlpha = 1.0;
                        ctx.strokeStyle = zoneColor;
                        ctx.lineWidth = 2.5 / zoom;
                        ctx.stroke();

                        ctx.closePath();
                        ctx.restore();
                    }

                    const pTextColor = isSelected ? '#ffb399' : '#ffffff';
                    const pFontSmall = 10;  // world-space px (coordinate, UWP)
                    const pFontName = 12;  // world-space px (system name)
                    const pFontPort = 18;  // world-space px (starport letter)

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = pTextColor;

                    // 1. Hex coordinate — top of hex
                    ctx.font = `${pFontSmall}px 'Inter', sans-serif`;
                    ctx.fillText(hexId, cx, cy - (size * 0.75));

                    if (data) {
                        const isAsteroid = (data.size === 0);
                        const isWet = (
                            data.hydro !== undefined && data.hydro >= 1 &&
                            data.atm !== undefined && (
                                (data.atm >= 2 && data.atm <= 9) || data.atm >= 13
                            )
                        );

                        // 2. Starport letter — above world dot
                        if (data.starport) {
                            ctx.font = `bold ${pFontPort}px 'Inter', sans-serif`;
                            ctx.fillStyle = pTextColor;
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(data.starport, cx, cy - dotRadius - 2);
                            ctx.textBaseline = 'top';
                        }

                        // 3. World dot (or asteroid cluster)
                        if (isAsteroid) {
                            // Asteroid belt: cluster of small dots
                            const aColor = isSelected ? '#ffb399' : '#aaaaaa';
                            const aPositions = [
                                { dx: -8, dy: -2 }, { dx: 0, dy: -5 }, { dx: 8, dy: -2 },
                                { dx: -5, dy: 5 }, { dx: 5, dy: 4 }
                            ];
                            aPositions.forEach(p => {
                                ctx.beginPath();
                                ctx.arc(cx + p.dx, cy + p.dy, 2.5, 0, 2 * Math.PI);
                                ctx.fillStyle = aColor;
                                ctx.fill();
                                ctx.closePath();
                            });
                        } else {
                            // Normal world dot
                            ctx.beginPath();
                            ctx.arc(cx, cy, dotRadius, 0, 2 * Math.PI);
                            ctx.fillStyle = isWet
                                ? (isSelected ? '#a8d8ff' : '#46b4e8')
                                : (isSelected ? '#ffb399' : '#ffffff');
                            ctx.fill();
                            ctx.closePath();
                        }

                        // 4. UWP string — just below dot
                        if (data.uwp) {
                            ctx.font = `${pFontSmall}px 'Inter', sans-serif`;
                            ctx.fillStyle = pTextColor;
                            ctx.textBaseline = 'top';
                            ctx.fillText(data.uwp, cx, cy + dotRadius + 3);
                        }

                        // 5. System name — bottom of hex (ALL CAPS for pop >= 9)
                        if (data.name) {
                            const isHighPop = (data.pop !== undefined && data.pop >= 9);
                            const displayName = isHighPop ? data.name.toUpperCase() : data.name;
                            ctx.font = `${pFontName}px 'Inter', sans-serif`;
                            ctx.fillStyle = pTextColor;
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(displayName, cx, cy + (size * 0.75));
                            ctx.textBaseline = 'top';
                        }

                        // ---- Symbols (relative to dot center) ----

                        const symOffset = dotRadius + 6;

                        // 6. Gas Giant — Saturn ring to the RIGHT of dot
                        if (data.gasGiant) {
                            const gx = cx + symOffset + 8;
                            const gy = cy;
                            const gr = 5;
                            ctx.beginPath();
                            ctx.arc(gx, gy, gr, 0, 2 * Math.PI);
                            ctx.fillStyle = pTextColor;
                            ctx.fill();
                            // Ring (ellipse drawn as scaled arc)
                            ctx.save();
                            ctx.translate(gx, gy);
                            ctx.scale(1.8, 0.55);
                            ctx.beginPath();
                            ctx.arc(0, 0, gr + 2, 0, 2 * Math.PI);
                            ctx.strokeStyle = pTextColor;
                            ctx.lineWidth = 1.2 / zoom;
                            ctx.stroke();
                            ctx.restore();
                        }

                        // 7. Scout Base — filled triangle BOTTOM-LEFT of dot
                        if (data.scoutBase) {
                            const tx = cx - symOffset - 2;
                            const ty = cy + symOffset * 0.3;
                            const ts = 7;
                            ctx.beginPath();
                            ctx.moveTo(tx, ty - ts);
                            ctx.lineTo(tx + ts, ty + ts * 0.6);
                            ctx.lineTo(tx - ts, ty + ts * 0.6);
                            ctx.closePath();
                            ctx.fillStyle = pTextColor;
                            ctx.fill();
                        }

                        // 8. Naval Base — 6-point star TOP-LEFT of dot
                        if (data.navalBase) {
                            const sx = cx - symOffset - 2;
                            const sy = cy - symOffset * 0.5;
                            const sr = 7;
                            const sir = sr * 0.45;
                            const pts = 6;
                            ctx.beginPath();
                            for (let i = 0; i < pts * 2; i++) {
                                const angle = (Math.PI / pts) * i - Math.PI / 2;
                                const r = i % 2 === 0 ? sr : sir;
                                const px = sx + Math.cos(angle) * r;
                                const py = sy + Math.sin(angle) * r;
                                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                            }
                            ctx.closePath();
                            ctx.fillStyle = pTextColor;
                            ctx.fill();
                        }
                    } else {
                        // No data yet — just draw a white dot and coordinate
                        ctx.beginPath();
                        const dotRadius2 = Math.max(1.5 / zoom, 10);
                        ctx.arc(cx, cy, dotRadius2, 0, 2 * Math.PI);
                        ctx.fillStyle = '#ffffff';
                        ctx.fill();
                        ctx.closePath();
                    }

                } else {
                    // =============================================
                    // DEVELOPMENT VIEW (existing behaviour)
                    // =============================================
                    ctx.beginPath();
                    const baseWorldRadius = 10;
                    const minWorldRadius = 1.5 / zoom;
                    const dotRadius = Math.max(minWorldRadius, baseWorldRadius);

                    // --- Travel Zone Halo (Amber/Red) ---
                    if (data && data.travelZone && data.travelZone !== 'Green') {
                        const zoneColor = data.travelZone === 'Red' ? '#FF0000' : '#FFBF00';
                        ctx.save();
                        ctx.beginPath();
                        const haloRadius = dotRadius + 5;
                        ctx.arc(cx, cy, haloRadius, 0, 2 * Math.PI);
                        ctx.globalAlpha = 0.2;
                        ctx.fillStyle = zoneColor;
                        ctx.fill();
                        ctx.globalAlpha = 1.0;
                        ctx.strokeStyle = zoneColor;
                        ctx.lineWidth = 2.5 / zoom;
                        ctx.stroke();
                        ctx.closePath();
                        ctx.restore();
                    }
                    ctx.arc(cx, cy, dotRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.closePath();

                    if (zoom > 0.4) {
                        ctx.textAlign = 'center';
                        const fontSize = 10 / zoom;
                        ctx.font = `${fontSize}px 'Inter', sans-serif`;
                        ctx.fillStyle = isSelected ? '#ffb399' : '#ffffff';
                        ctx.textBaseline = 'top';

                        let label = hexId;

                        if (data && data.uwp) {
                            let tcs = data.tradeCodes ? data.tradeCodes.join(" ") : "";
                            if (tcs.length > 0) tcs = " " + tcs;

                            const topLabel = data.name ? `${data.name} (${hexId})` : hexId;
                            ctx.fillText(topLabel, cx, cy - (size * 0.75));
                            ctx.fillText(data.uwp + tcs, cx, cy - (size * 0.75) + fontSize * 1.2);

                            if (stateObj.t5Socio) {
                                let sStrings = stateObj.t5Socio.displayStrings || [stateObj.t5Socio.displayString];
                                for (let si = 0; si < sStrings.length; si++) {
                                    ctx.fillText(sStrings[si], cx, cy - (size * 0.75) + fontSize * (2.4 + si * 1.2));
                                }
                            } else if (stateObj.mgtSocio) {
                                let sStrings = stateObj.mgtSocio.displayStrings || [stateObj.mgtSocio.displayString];
                                for (let si = 0; si < sStrings.length; si++) {
                                    ctx.fillText(sStrings[si], cx, cy - (size * 0.75) + fontSize * (2.4 + si * 1.2));
                                }
                            }
                        } else if (data) {
                            ctx.fillText(`${label} [${data.starport}]`, cx, cy - (size * 0.75));
                        } else {
                            ctx.fillText(label, cx, cy - (size * 0.75));
                        }
                    }
                }
            } else if (stateType === 'BLANK') {
                // Text in center
                if (zoom > 0.4) {
                    ctx.textAlign = 'center';
                    const fontSize = 10 / zoom;
                    ctx.font = `${fontSize}px 'Inter', sans-serif`;
                    ctx.fillStyle = isSelected ? '#ff4500' : '#45a29e';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(hexId, cx, cy);
                }
            } else if (stateType === 'EMPTY') {
                // Empty hexes have no coordinates or contents shown
            }
        }
    }

    // Draw Sector & Subsector Borders
    if (showSubsectorBorders) {
        const totalWidth = 223 * widthStep + size; // Extend lines to right edge of last hex
        const totalHeight = 199 * heightStep + (heightStep / 2) + size; // Roughly bottom edge

        // Subsector borders (thinner, darker)
        ctx.beginPath();
        for (let i = 1; i <= 27; i++) {
            const x = (i * 8 - 0.5) * widthStep;
            ctx.moveTo(x, -heightStep);
            ctx.lineTo(x, totalHeight);
        }
        for (let j = 1; j <= 19; j++) {
            const y = (j * 10 - 0.5) * heightStep;
            ctx.moveTo(-size, y);
            ctx.lineTo(totalWidth, y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();

        // Sector borders (thicker, brighter)
        ctx.beginPath();
        for (let i = 4; i <= 24; i += 4) {
            const x = (i * 8 - 0.5) * widthStep;
            ctx.moveTo(x, -heightStep);
            ctx.lineTo(x, totalHeight);
        }
        for (let j = 4; j <= 16; j += 4) {
            const y = (j * 10 - 0.5) * heightStep;
            ctx.moveTo(-size, y);
            ctx.lineTo(totalWidth, y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
    }

    ctx.restore();
}

// Listen for window resizing automatically
window.addEventListener('resize', resize);