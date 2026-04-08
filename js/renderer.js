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
    ctx.fillStyle = window.printMode ? '#ffffff' : '#0b0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // 4. Apply Camera Transformations
    // NOTE: We use width/height from the window directly for the viewport calculation
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);

    // 5. Grid Styling
    ctx.strokeStyle = window.printMode ? '#cccccc' : '#1f2833';
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

            const stateObj = hexStates.get(hexId);
            const path = getHexPath(cx, cy, size);

            // 0. Background Fill (Political Mapping)
            if (window.hexBgFillVisible !== false && stateObj && stateObj.custom_ui && stateObj.custom_ui.bgFillColor) {
                ctx.save();
                ctx.globalAlpha = 0.3; // Standard transparency for territories
                ctx.fillStyle = stateObj.custom_ui.bgFillColor;
                ctx.fill(path);
                ctx.restore();
            }

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
    // LAYER 2: INTERSTELLAR ROUTES (Sean Protocol: Visibility Decoupled)
    // =========================================================================
    if (window.sectorRoutes && window.sectorRoutes.length > 0) {
        if (typeof tSection === 'function') tSection("Render Sector Routes");

        ctx.save();
        ctx.lineWidth = 2 / zoom;
        const gap = 20;

        // Harvest visibility from checkboxes directly
        const showGreen = document.getElementById('filter-route-green')?.checked ?? true;
        const showRed = document.getElementById('filter-route-red')?.checked ?? true;
        const showYellow = document.getElementById('filter-route-yellow')?.checked ?? true;

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

        const xboatRoutes = window.sectorRoutes.filter(r => r.type === 'Xboat');
        const tradeRoutes = window.sectorRoutes.filter(r => r.type === 'Trade');
        const secondaryRoutes = window.sectorRoutes.filter(r => r.type === 'Secondary');

        if (xboatRoutes.length > 0 && showGreen) {
            drawBatch(xboatRoutes, '#00FF00'); // Bright Green
            if (typeof writeLogLine === 'function') writeLogLine(`Rendered ${xboatRoutes.length} Green (Xboat) routes.`);
        }
        if (tradeRoutes.length > 0 && showRed) {
            drawBatch(tradeRoutes, '#FF0000'); // Red
            if (typeof writeLogLine === 'function') writeLogLine(`Rendered ${tradeRoutes.length} Red (Trade) routes.`);
        }
        if (secondaryRoutes.length > 0 && showYellow) {
            drawBatch(secondaryRoutes, '#FFFF00'); // Yellow
            if (typeof writeLogLine === 'function') writeLogLine(`Rendered ${secondaryRoutes.length} Yellow (Secondary) routes.`);
        }

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

    // PASS 2: DRAW WORLD CONTENT (Icons, Labels, Symbols)
    // =========================================================================
    
    // Sean Protocol: Optimization: Detect and Log Typography Pass Init once per draw cycle
    const hasTypoRules = window.activeFilterRules && window.activeFilterRules.some(r => r.isItalic || r.isUnderline);
    if (hasTypoRules && typeof writeLogLine === 'function') {
        writeLogLine("Typography Styling Bridge: Initializing Italics/Underline checks in render pass.");
    }

    // Sean Protocol: Capture Global Default Style once per frame to minimize spam
    const currentGlobalDefaultColor = (typeof window.captureGlobalDefaults === 'function') ?
        window.captureGlobalDefaults() : '#ffffff';

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
            const isHidden = stateObj ? stateObj.isHiddenByFilter : false;

            if (stateType === 'SYSTEM_PRESENT' && !isHidden) {
                const data = stateObj.rttData || stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;

                // Sean Protocol: Check if this "System Present" hex actually has no planets 
                // and skip if the filter is active.
                if (hideNoPlanetSystems && data && data.isStellarOnly) {
                    continue;
                }

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

                    const pTextColor = isSelected ? '#ffb399' : (window.printMode ? '#000000' : '#ffffff');
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
                        // 2. Starport letter — above world dot
                        if (data.starport) {
                            ctx.font = `bold ${pFontPort}px 'Inter', sans-serif`;
                            ctx.fillStyle = pTextColor;
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(data.starport, cx, cy - dotRadius - 2);
                            ctx.textBaseline = 'top';
                        }                        
                        
                        // 3. World dot (or asteroid cluster) with Custom UI Support
                        const custom = stateObj.custom_ui || {};
                        const colors = custom.appliedColors && custom.appliedColors.length > 0 ? custom.appliedColors : null;
                        
                        // Sean Protocol: Dynamically use the captured Global Default as baseline dot color
                        const baseColor = isSelected ? '#ffb399' : currentGlobalDefaultColor;
                        const primary = colors ? colors[0] : baseColor;
                        const iconStyle = custom.iconStyle || 'Classic';

                        if (iconStyle === 'Asteroid Belt') {
                            const aPositions = [
                                { dx: -8, dy: -2 }, { dx: 0, dy: -5 }, { dx: 8, dy: -2 },
                                { dx: -5, dy: 5 }, { dx: 5, dy: 4 }
                            ];
                            aPositions.forEach((p, index) => {
                                ctx.beginPath();
                                ctx.arc(cx + p.dx, cy + p.dy, 2.5, 0, 2 * Math.PI);
                                
                                // Magic Multi-Color Cycling
                                let rockColor = primary;
                                if (colors && colors.length > 0) {
                                    rockColor = colors[index % colors.length]; 
                                }
                                
                                ctx.fillStyle = rockColor;
                                ctx.fill();
                                ctx.closePath();
                            });
                        } else if (iconStyle === 'Rounded Rectangle') {
                            // Geometry fix: Calculate dimensions so the furthest corners fit exactly
                            // within the dotRadius circle that defines the Ring boundary.
                            const rectWidth = dotRadius * 1.6;
                            const rectHeight = dotRadius * 1.0;
                            const rx = cx - rectWidth / 2;
                            const ry = cy - rectHeight / 2;
                            const cornerRadius = dotRadius * 0.3; // Proportionally adjusted

                            ctx.save();
                            ctx.beginPath();
                            // Use modern roundRect if available, fallback to standard rect
                            if (ctx.roundRect) {
                                ctx.roundRect(rx, ry, rectWidth, rectHeight, cornerRadius);
                            } else {
                                ctx.rect(rx, ry, rectWidth, rectHeight);
                            }
                            ctx.clip(); // Mask the drawing area to the rounded shape

                            if (colors && colors.length > 0) {
                                const stripeWidth = rectWidth / colors.length;
                                for (let i = 0; i < colors.length; i++) {
                                    ctx.fillStyle = colors[i];
                                    ctx.fillRect(rx + (i * stripeWidth), ry, stripeWidth + 1, rectHeight); // +1 prevents rendering gaps
                                }
                            } else {
                                ctx.fillStyle = baseColor;
                                ctx.fillRect(rx, ry, rectWidth, rectHeight);
                            }
                            ctx.restore();
                        } else if (iconStyle === 'Square') {
                            // Geometry: Side length = dotRadius * 1.414 (sqrt 2) to fit corners exactly inside the ring
                            const side = dotRadius * 1.414;
                            const rx = cx - side / 2;
                            const ry = cy - side / 2;

                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(rx, ry, side, side);
                            ctx.clip(); // Mask for stripes

                            if (colors && colors.length > 0) {
                                const stripeWidth = side / colors.length;
                                for (let i = 0; i < colors.length; i++) {
                                    ctx.fillStyle = colors[i];
                                    ctx.fillRect(rx + (i * stripeWidth), ry, stripeWidth + 1, side);
                                }
                            } else {
                                ctx.fillStyle = baseColor;
                                ctx.fillRect(rx, ry, side, side);
                            }
                            ctx.restore();
                        } else if (iconStyle === 'Diamond') {
                            // Geometry: Four points touching the exact edge of the dotRadius ring
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(cx, cy - dotRadius); // Top
                            ctx.lineTo(cx + dotRadius, cy); // Right
                            ctx.lineTo(cx, cy + dotRadius); // Bottom
                            ctx.lineTo(cx - dotRadius, cy); // Left
                            ctx.closePath();
                            ctx.clip(); // Mask for stripes

                            if (colors && colors.length > 0) {
                                const bboxWidth = dotRadius * 2;
                                const rx = cx - dotRadius;
                                const ry = cy - dotRadius;
                                const stripeWidth = bboxWidth / colors.length;
                                for (let i = 0; i < colors.length; i++) {
                                    ctx.fillStyle = colors[i];
                                    ctx.fillRect(rx + (i * stripeWidth), ry, stripeWidth + 1, bboxWidth);
                                }
                            } else {
                                ctx.fillStyle = baseColor;
                                ctx.fill();
                            }
                            ctx.restore();
                        } else if (iconStyle === 'Asteroid Grid') {
                            // 3-4-3 Structured Hex Grid Pattern
                            const gridPositions = [
                                { dx: -5, dy: -4.5 }, { dx: 0, dy: -4.5 }, { dx: 5, dy: -4.5 },         // Top 3
                                { dx: -7.5, dy: 0 }, { dx: -2.5, dy: 0 }, { dx: 2.5, dy: 0 }, { dx: 7.5, dy: 0 }, // Middle 4
                                { dx: -5, dy: 4.5 }, { dx: 0, dy: 4.5 }, { dx: 5, dy: 4.5 }           // Bottom 3
                            ];
                            
                            gridPositions.forEach((p, index) => {
                                ctx.beginPath();
                                ctx.arc(cx + p.dx, cy + p.dy, 1.8, 0, 2 * Math.PI);
                                
                                // Magic Multi-Color Cycling
                                let dotColor = primary;
                                if (colors && colors.length > 0) {
                                    dotColor = colors[index % colors.length]; 
                                }
                                
                                ctx.fillStyle = dotColor;
                                ctx.fill();
                                ctx.closePath();
                            });
                        } else if (iconStyle === 'Classic') {
                            if (colors && colors.length > 0) {
                                const sliceAngle = (2 * Math.PI) / colors.length;
                                for (let i = 0; i < colors.length; i++) {
                                    const startAngle = i * sliceAngle;
                                    const endAngle = (i + 1) * sliceAngle;
                                    ctx.beginPath();
                                    ctx.moveTo(cx, cy);
                                    ctx.arc(cx, cy, dotRadius, startAngle, endAngle);
                                    ctx.closePath();
                                    ctx.fillStyle = colors[i];
                                    ctx.fill();
                                }
                            } else {
                                // No rules: Solid Dot
                                ctx.beginPath();
                                ctx.arc(cx, cy, dotRadius, 0, 2 * Math.PI);
                                ctx.fillStyle = baseColor;
                                ctx.fill();
                                ctx.closePath();
                            }
                        } else if (iconStyle === 'Refined') {
                            // Glow Sphere
                            ctx.save();
                            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotRadius + 8);
                            grad.addColorStop(0, primary);
                            grad.addColorStop(0.3, primary);
                            grad.addColorStop(1, 'transparent');
                            ctx.fillStyle = grad;
                            ctx.beginPath();
                            ctx.arc(cx, cy, dotRadius + 8, 0, 2 * Math.PI);
                            ctx.fill();
                            // White core for systems
                            ctx.beginPath();
                            ctx.arc(cx, cy, dotRadius * 0.4, 0, 2 * Math.PI);
                            ctx.fillStyle = '#ffffff'; 
                            ctx.fill();
                            ctx.restore();
                        } else if (iconStyle === 'Minimal') {
                            // Crosshair
                            ctx.save();
                            ctx.strokeStyle = primary;
                            ctx.lineWidth = 1.5 / zoom;
                            ctx.beginPath();
                            const l = dotRadius + 5;
                            ctx.moveTo(cx - l, cy); ctx.lineTo(cx + l, cy);
                            ctx.moveTo(cx, cy - l); ctx.lineTo(cx, cy + l);
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.arc(cx, cy, dotRadius * 0.5, 0, 2 * Math.PI);
                            ctx.strokeStyle = primary;
                            ctx.stroke();
                            ctx.restore();
                        }

                        // --- Draw the Ring (Applies to any shape) ---
                        if (custom.ringColor) {
                            ctx.save();
                            ctx.beginPath();

                            // Align the ring's center path EXACTLY with the dot's edge.
                            ctx.arc(cx, cy, dotRadius, 0, 2 * Math.PI);

                            ctx.strokeStyle = custom.ringColor;

                            // NEW LOGIC: Scale thickness proportionally to the dot size, 
                            // rather than forcing a fixed screen thickness with '/ zoom'.
                            // This ensures the ring shrinks perfectly alongside the planet.
                            ctx.lineWidth = dotRadius * 0.3;

                            ctx.stroke();
                            ctx.closePath();
                            ctx.restore();
                        }

                        // 4. UWP string — just below dot
                        if (data.uwp) {
                            ctx.font = `${pFontSmall}px 'Inter', sans-serif`;
                            ctx.fillStyle = pTextColor;
                            ctx.textBaseline = 'top';
                            ctx.fillText(data.uwp, cx, cy + dotRadius + 3);
                        }

                        // 5. System name — bottom of hex (Sean Protocol: Typography Suite)
                        if (data.name) {
                            const custom = stateObj.custom_ui || {};
                            let displayName = data.name;

                            if (custom.textCase === 'ALL CAPS') {
                                displayName = data.name.toUpperCase();
                            } else if (custom.textCase === 'lowercase') {
                                displayName = data.name.toLowerCase();
                            }

                            // Sean Protocol: Apply Italics
                            const fontStyle = custom.isItalic ? "italic " : "";
                            ctx.font = `${fontStyle}${pFontName}px 'Inter', sans-serif`;
                            ctx.fillStyle = pTextColor;
                            ctx.textBaseline = 'bottom';
                            
                            const textY = cy + (size * 0.75);
                            ctx.fillText(displayName, cx, textY);

                            // Sean Protocol: Manual Underline (Canvas doesn't support text-decoration native)
                            if (custom.isUnderline) {
                                const textWidth = ctx.measureText(displayName).width;
                                const lineY = textY + 2; // Positioned 2px below baseline
                                ctx.save();
                                ctx.strokeStyle = pTextColor;
                                ctx.lineWidth = 1 / zoom;
                                ctx.beginPath();
                                // X-Coordinates are relative to centered text (cx)
                                ctx.moveTo(cx - textWidth / 2, lineY);
                                ctx.lineTo(cx + textWidth / 2, lineY);
                                ctx.stroke();
                                ctx.restore();
                            }
                            
                            ctx.textBaseline = 'top';
                                             // ---- Symbols (relative to dot center) (Sean Protocol: GUI Optimization) ----
                        // ---- Symbols (relative to dot center) (Sean Protocol: GUI Optimization) ----
                        const symOffset = dotRadius + GUI_CONFIG.OFFSETS.SYM_GAP;

                        // 6. Gas Giant — Optimized Positioning & Variant Selection
                        if (data.gasGiant) {
                            const gx = cx + symOffset + GUI_CONFIG.GAS_GIANT.X_OFFSET;
                            const gy = cy + GUI_CONFIG.GAS_GIANT.Y_OFFSET;
                            const gr = GUI_CONFIG.GAS_GIANT.RADIUS;
                            
                            // Variant Selection Logic (Sean Protocol: Data-Driven)
                            let ggVariant = 'SOLID';
                            
                            // Condition 1: 'Sa' (Satellite/Ring) trade code is present
                            if (data.tradeCodes && data.tradeCodes.includes('Sa')) {
                                ggVariant = 'RINGED';
                            }

                            ctx.beginPath();
                            ctx.arc(gx, gy, gr, 0, 2 * Math.PI);
                            ctx.fillStyle = pTextColor;
                            ctx.fill();
                            
                            if (ggVariant === 'RINGED') {
                                // Ring (ellipse drawn as scaled arc)
                                ctx.save();
                                ctx.translate(gx, gy);
                                ctx.scale(GUI_CONFIG.GAS_GIANT.RING_SCALE_X, GUI_CONFIG.GAS_GIANT.RING_SCALE_Y);
                                ctx.beginPath();
                                ctx.arc(0, 0, gr + 2, 0, 2 * Math.PI);
                                ctx.strokeStyle = pTextColor;
                                ctx.lineWidth = GUI_CONFIG.GAS_GIANT.RING_WIDTH / zoom;
                                ctx.stroke();
                                ctx.restore();
                            }
                        }

                        // 7. Scout Base — filled triangle BOTTOM-LEFT of dot
                        if (data.scoutBase) {
                            const tx = cx - symOffset + GUI_CONFIG.OFFSETS.BASE_X_ADJ;
                            const ty = cy + symOffset * GUI_CONFIG.OFFSETS.SCOUT_Y_FACTOR;
                            const ts = GUI_CONFIG.BASE_ICONS.RADIUS;
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
                            const sx = cx - symOffset + GUI_CONFIG.OFFSETS.BASE_X_ADJ;
                            const sy = cy - symOffset * GUI_CONFIG.OFFSETS.NAVAL_Y_FACTOR;
                            const sr = GUI_CONFIG.BASE_ICONS.RADIUS;
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
           }
                    } else {
                        // No data yet — use global baseline dot color
                        ctx.beginPath();
                        const dotRadius2 = Math.max(1.5 / zoom, 10);
                        ctx.arc(cx, cy, dotRadius2, 0, 2 * Math.PI);
                        ctx.fillStyle = currentGlobalDefaultColor;
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
                    ctx.fillStyle = window.printMode ? '#000000' : '#ffffff';
                    ctx.fill();
                    ctx.closePath();

                    if (zoom > 0.4) {
                        ctx.textAlign = 'center';
                        const fontSize = 10 / zoom;
                        ctx.font = `${fontSize}px 'Inter', sans-serif`;
                        ctx.fillStyle = isSelected ? '#ffb399' : (window.printMode ? '#000000' : '#ffffff');
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
            } else if (stateType === 'BLANK' && !isHidden) {
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
        ctx.strokeStyle = window.printMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.15)';
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
        ctx.strokeStyle = window.printMode ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
    }

    ctx.restore();
}

// Listen for window resizing automatically
window.addEventListener('resize', resize);