// ============================================================================
// HEX_EDITOR.JS - World Details & Accordion UI Logic
// ============================================================================

// ============================================================================
// JOURNEY TIMES UI HELPER
// ============================================================================

/**
 * Shared helper to safely extract star diameter from varied engine storage locations.
 * Falls back to 0 if no diameter information is found.
 */
function getSafeStarDiameter(starObj) {
    if (!starObj) return 0;
    // Account for potential variations in how it's stored across different engines
    return starObj.diam || starObj.diameter || starObj.stellarDiameter || starObj.starDiam || 0;
}

/**
 * Builds the HTML block for Journey Times, factoring in Stellar Masking if eligible.
 */
function buildJourneyTimesUI(world, star, isMaskingPreference = null, overrideAU = null) {
    if (!world || !star) return '';
    // Skip bodies that don't have standard jump calculations (Empty remains skipped)
    if (world.type === 'Empty') return '';
    if (world.size === undefined || world.size === 'R' || world.size === 'S') return '';

    // Check the state of the global masking checkbox, with optional override
    let isMaskingActive = false;
    if (isMaskingPreference !== null && isMaskingPreference !== undefined) {
        isMaskingActive = !!isMaskingPreference;
    } else {
        const maskCheckbox = document.body.querySelector('#edit-stellar-mask');
        isMaskingActive = maskCheckbox ? maskCheckbox.checked : false;
    }

    let eligible = false;
    const starDiam = getSafeStarDiameter(star);

    // Check for masking eligibility using whichever property is available (au or distAU), with optional override for moons
    const effectiveAU = (overrideAU !== null) ? overrideAU : ((world.au !== undefined) ? world.au : (world.distAU !== undefined ? world.distAU : 0));

    // Extract high-precision diameter if it exists
    const worldDiam = (world.diamKm !== undefined) ? world.diamKm : null;

    // We now pass world.size and optional worldDiam to ensure precision
    if (starDiam > 0 && effectiveAU > 0 && world.size !== undefined) {
        eligible = UniversalMath.isMaskingEligible(starDiam, effectiveAU, world.size, worldDiam);
    }

    let times;
    if (eligible && isMaskingActive) {
        times = UniversalMath.calculateMaskedJourneyTimes(world.size, starDiam, effectiveAU, worldDiam);
    } else {
        times = UniversalMath.calculateBaseJourneyTimes(world.size, worldDiam);
    }

    return formatJourneyTimesHTML(times, eligible, isMaskingActive);
}

/**
 * Simplified helper for engines that don't support masking (like RTT)
 */
function buildBaseJourneyTimesUI(size, forcedDiamKm = null) {
    if (size === undefined || size === 'R' || size === 'S') return '';
    const times = UniversalMath.calculateBaseJourneyTimes(size, forcedDiamKm);
    return formatJourneyTimesHTML(times, false, false);
}

/**
 * Shared formatting for journey time blocks
 */
function formatJourneyTimesHTML(times, eligible, isMaskingActive) {
    let html = `<div class="system-stats-full" style="background: rgba(102, 252, 241, 0.05); padding: 6px; border: 1px solid rgba(69, 162, 158, 0.4); border-radius: 4px; margin-top: 4px;">`;

    let titleStr = `100D Jump Travel Times`;
    if (eligible) {
        titleStr += isMaskingActive ? ` <span style="color:#ffa500; font-size: 0.9em;">(Stellar Masked)</span>` : ` <span style="color:#a0a8b0; font-size: 0.9em;">(Masking Available)</span>`;
    }

    html += `<div style="color: #66fcf1; font-weight: bold; font-size: 0.85em; margin-bottom: 4px; border-bottom: 1px dotted rgba(102, 252, 241, 0.3); padding-bottom: 2px;">${titleStr}</div>`;
    html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 0.8em;">`;
    html += `<span>1G: <strong style="color: #fff;">${times[0]}h</strong></span><span>2G: <strong style="color: #fff;">${times[1]}h</strong></span><span>3G: <strong style="color: #fff;">${times[2]}h</strong></span>`;
    html += `<span>4G: <strong style="color: #fff;">${times[3]}h</strong></span><span>5G: <strong style="color: #fff;">${times[4]}h</strong></span><span>6G: <strong style="color: #fff;">${times[5]}h</strong></span>`;
    html += `</div></div>`;

    return html;
}

// ============================================================================
// HEX EDITOR MAIN FUNCTIONS
// ============================================================================

function openHexEditor(hexId, e = null) {
    const stateObj = hexStates.get(hexId);
    if (!stateObj || stateObj.type !== 'SYSTEM_PRESENT' || (!stateObj.ctData && !stateObj.mgt2eData && !stateObj.t5Data && !stateObj.rttData)) {
        return;
    }

    const hexEditor = document.getElementById('hex-editor');

    // Position the editor near the mouse click if an event is provided
    if (e && e.clientX !== undefined && e.clientY !== undefined) {
        setTimeout(() => {
            // Ensure visible before measuring
            hexEditor.classList.add('visible');

            const rect = hexEditor.getBoundingClientRect();
            const editorWidth = rect.width;
            const editorHeight = rect.height;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const padding = 15;

            let x = e.clientX + 30; // 30px offset to the right
            let y = e.clientY - (editorHeight / 2); // Center vertically on the click

            // Clamping logic: ensure it stays within viewport
            if (x + editorWidth > viewportWidth) {
                x = viewportWidth - editorWidth - padding;
            }
            if (y + editorHeight > viewportHeight) {
                y = viewportHeight - editorHeight - padding;
            }

            // Safeguards: ensure it doesn't clip off the top or left
            x = Math.max(padding, x);
            y = Math.max(padding, y);
            
            hexEditor.style.left = `${x}px`;
            hexEditor.style.right = 'auto'; // Clear any right alignment
            hexEditor.style.top = `${y}px`;
            
            // Clean up temp visibility styles
            hexEditor.style.visibility = '';
            hexEditor.style.display = '';
        }, 50);
    }

    editingHexId = hexId;
    const data = stateObj.rttData || stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;

    // Check multiple potential locations for the name
    const systemName = data.name || stateObj.name || "";

    const nameStr = systemName ? `${systemName} [${hexId}]` : `${hexId} Details`;
    document.getElementById('hex-editor-title').innerText = nameStr;
    document.getElementById('edit-name').value = systemName;
    document.getElementById('edit-starport').value = data.starport;
    document.getElementById('edit-size').value = data.size;
    document.getElementById('edit-atm').value = data.atm;
    document.getElementById('edit-hydro').value = data.hydro;
    document.getElementById('edit-pop').value = data.pop;
    document.getElementById('edit-gov').value = data.gov;
    document.getElementById('edit-law').value = data.law;
    document.getElementById('edit-tl').value = data.tl;

    const b = data.bases || [];
    document.getElementById('edit-naval').checked = data.navalBase || b.includes('N') || false;
    document.getElementById('edit-scout').checked = data.scoutBase || b.includes('S') || false;
    document.getElementById('edit-military').checked = data.militaryBase || false; // RTT uses M for Merchant
    document.getElementById('edit-corsair').checked = data.corsairBase || b.includes('P') || false;
    document.getElementById('edit-research').checked = data.researchBase || b.includes('R') || false;
    document.getElementById('edit-tas').checked = data.tas || b.includes('T') || false;
    document.getElementById('edit-waystation').checked = data.wayStation || b.includes('W') || false;
    document.getElementById('edit-gov-estate').checked = data.govEstate || b.includes('G') || false;
    document.getElementById('edit-embassy').checked = data.embassy || b.includes('F') || false;
    document.getElementById('edit-moot').checked = data.moot || b.includes('Moot') || false;
    document.getElementById('edit-merchant').checked = data.merchantBase || b.includes('M') || false;
    document.getElementById('edit-shipyard').checked = data.shipyard || b.includes('Y') || false;
    document.getElementById('edit-megacorp').checked = data.megaCorp || b.includes('MegaCorp HQ') || false;
    document.getElementById('edit-scout-hostel').checked = data.scoutHostel || b.includes('Scout Hostel') || false;
    document.getElementById('edit-psionics').checked = data.psionics || b.includes('Z') || false;
    document.getElementById('edit-sacred').checked = data.sacredSite || b.includes('K') || false;
    document.getElementById('edit-enclave').checked = data.enclave || b.includes('V') || false;
    document.getElementById('edit-ancients').checked = data.ancients || b.includes('Q') || false;
    document.getElementById('edit-gas').checked = data.gasGiant || false;

    document.getElementById('edit-trade-codes').value = data.tradeCodes ? data.tradeCodes.join(' ') : '';
    document.getElementById('edit-travel-zone').value = data.travelZone || 'Green';
    const allegVal = data.allegiance || stateObj.allegiance || '';
    document.getElementById('edit-allegiance').value = (allegVal === '----') ? '' : allegVal;
    document.getElementById('edit-notes').value = data.notes || stateObj.notes || '';

    // Dynamic UI Toggles based on active generation engine
    const isRTT = !!stateObj.rttData;
    const isMgT2E = !!stateObj.mgt2eData;
    const isT5 = !!stateObj.t5Data;
    const isCT = !!stateObj.ctData;

    let systemRequiresMaskingToggle = false;

    if (stateObj.mgtSystem) {
        const sys = stateObj.mgtSystem;
        sys.worlds.forEach(w => {
            const star = sys.stars[w.parentStarIdx || 0];
            const starDiam = getSafeStarDiameter(star);
            if (UniversalMath.isMaskingEligible(starDiam, w.au, w.size)) systemRequiresMaskingToggle = true;

            const subBodies = (w.moons || []).concat(w.significantBodies || []);
            subBodies.forEach(m => {
                if (UniversalMath.isMaskingEligible(starDiam, m.au, m.size)) systemRequiresMaskingToggle = true;
            });
        });
    } else if (stateObj.ctSystem) {
        const sys = stateObj.ctSystem;
        const star = sys.stars[0];
        const starDiam = getSafeStarDiameter(star);
        let scanBodies = [];
        sys.orbits.forEach(o => { if (o.contents) scanBodies.push(o.contents); });
        if (sys.capturedPlanets) sys.capturedPlanets.forEach(p => scanBodies.push(p));
        scanBodies.forEach(w => {
            if (UniversalMath.isMaskingEligible(starDiam, w.distAU, w.size)) systemRequiresMaskingToggle = true;
            if (w.satellites) {
                w.satellites.forEach(m => {
                    if (UniversalMath.isMaskingEligible(starDiam, m.distAU, m.size)) systemRequiresMaskingToggle = true;
                });
            }
        });
    } else if (stateObj.t5System) {
        const sys = stateObj.t5System;
        if (sys.stars) {
            sys.stars.forEach(s => {
                const starDiam = getSafeStarDiameter(s);
                if (s.orbits) {
                    s.orbits.forEach(o => {
                        let w = o.contents;
                        if (w && UniversalMath.isMaskingEligible(starDiam, w.distAU, w.size)) systemRequiresMaskingToggle = true;
                        if (w && w.satellites) {
                            w.satellites.forEach(sat => {
                                if (UniversalMath.isMaskingEligible(starDiam, sat.distAU, sat.size)) systemRequiresMaskingToggle = true;
                            });
                        }
                    });
                }
            });
        }
    }

    const maskContainer = document.getElementById('masking-toggle-container');
    if (maskContainer) maskContainer.style.display = 'none';

    // Note: Journey Times rendering moved to populateEditorAccordions to support dynamic updates via Masking toggle.
    if (document.getElementById('main-journey-row')) {
        document.getElementById('main-journey-row').style.display = 'none';
    }

    document.getElementById('edit-military').parentElement.style.display = (isMgT2E || isT5) ? 'flex' : 'none';
    document.getElementById('edit-corsair').parentElement.style.display = (isMgT2E || isT5 || isRTT) ? 'flex' : 'none';

    ['edit-research', 'edit-tas', 'edit-waystation'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.parentElement.style.display = (isT5 || isRTT) ? 'flex' : 'none';
    });

    const rttOnlyBases = [
        'edit-gov-estate', 'edit-embassy', 'edit-moot', 'edit-merchant',
        'edit-shipyard', 'edit-megacorp', 'edit-scout-hostel',
        'edit-psionics', 'edit-sacred', 'edit-enclave', 'edit-ancients'
    ];
    rttOnlyBases.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.parentElement.style.display = isRTT ? 'flex' : 'none';
    });

    // Reset accordions
    const accordionControls = [
        { btn: 'acc-btn-t5-socio', container: 'editor-socio-t5-container' },
        { btn: 'acc-btn-mgt-socio', container: 'editor-socio-mgt-container' },
        { btn: 'acc-btn-mgt-system', container: 'editor-mgt-system-root' },
        { btn: 'acc-btn-ct-system', container: 'editor-ct-system-root' },
        { btn: 'acc-btn-t5-system', container: 'editor-t5-system-root' },
        { btn: 'acc-btn-rtt-system', container: 'editor-rtt-system-root' }
    ];

    accordionControls.forEach(ctrl => {
        const btn = document.getElementById(ctrl.btn);
        const cont = document.getElementById(ctrl.container);
        if (btn) {
            btn.style.display = 'none';
            btn.classList.remove('active');
        }
        if (cont) cont.style.display = 'none';
    });

    populateEditorAccordions(stateObj);

    // T5 Quick Stats
    const t5QuickStatsDiv = document.getElementById('editor-t5-quick-stats');
    const pbgInput = document.getElementById('edit-pbg');
    const stellarInput = document.getElementById('edit-stellar');

    t5QuickStatsDiv.style.display = 'none';
    pbgInput.value = '';
    stellarInput.value = '';

    if (data && data.popDigit !== undefined) {
        const toHex = (val) => typeof toUWPChar === 'function' ? toUWPChar(val) : val.toString(16).toUpperCase();

        let belts = data.planetoidBelts !== undefined ? data.planetoidBelts : 0;
        let gasGiants = data.gasGiantsCount !== undefined ? data.gasGiantsCount : 0;
        pbgInput.value = `${toHex(data.popDigit)}${toHex(belts)}${toHex(gasGiants)}`;
        stellarInput.value = data.homestar || (data.stars && data.stars[0] ? data.stars[0].name : '');

        t5QuickStatsDiv.style.display = 'grid';
    }

    document.getElementById('hex-editor').classList.add('visible');
}

function populateEditorAccordions(stateObj) {
    // Note: Mainworld Journey Times row removed from top display as per user request to reduce clutter.
    // Jump times are now only displayed within the expanded system tree accordions.

    // 2. MgT2E Socioeconomics
    if (stateObj.mgtSocio) {
        document.getElementById('acc-btn-mgt-socio').style.display = 'flex';
        const ms = stateObj.mgtSocio;
        const fields = {
            'edit-mgt-pvalue': ms.pValue,
            'edit-mgt-totalpop': ms.totalWorldPop ? ms.totalWorldPop.toLocaleString() : '0',
            'edit-mgt-pcr': ms.pcr,
            'edit-mgt-urban': ms.urbanPercent + '%',
            'edit-mgt-totalurban': ms.totalUrbanPop ? ms.totalUrbanPop.toLocaleString() : '0',
            'edit-mgt-mcities': ms.majorCities,
            'edit-mgt-totalmcpop': ms.totalMajorCityPop ? ms.totalMajorCityPop.toLocaleString() : '0',
            'edit-mgt-gov-profile': ms.govProfile,
            'edit-mgt-fac': ms.factions,
            'edit-mgt-judicial-profile': ms.judicialSystemProfile,
            'edit-mgt-law-profile': ms.lawProfile,
            'edit-mgt-tech-profile': ms.techProfile,
            'edit-mgt-cul-profile': ms.culturalProfile,
            'edit-mgt-im': ms.Im,
            'edit-mgt-eco-profile': ms.economicProfile,
            'edit-mgt-ru': ms.RU,
            'edit-mgt-gwp': ms.pcGWP,
            'edit-mgt-wtn': ms.WTN,
            'edit-mgt-ir': ms.IR,
            'edit-mgt-dr': ms.DR,
            'edit-mgt-starport-profile': ms.starportProfile,
            'edit-mgt-mil-profile': ms.militaryProfile
        };

        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) {
                if ("value" in el) el.value = val;
                else el.innerText = val;
            }
        }

        // Mapping Cultural Quirks (Narrative)
        const quirksContainer = document.getElementById('edit-mgt-quirks');
        if (quirksContainer) {
            const dataQuirks = stateObj.mgt2eData?.culturalQuirks || [];
            if (dataQuirks.length > 0) {
                quirksContainer.innerHTML = dataQuirks.join(', ');
                quirksContainer.parentElement.style.display = 'flex'; // Use flex to match CSS
            } else {
                quirksContainer.innerHTML = 'None';
                quirksContainer.parentElement.style.display = 'none'; // Hide row if empty
            }
        }
    }

    // T5 Socioeconomics
    if (stateObj.t5Socio) {
        document.getElementById('acc-btn-t5-socio').style.display = 'flex';
        const ts = stateObj.t5Socio;
        const fields = {
            'edit-popm': ts.popMultiplier,
            'edit-belts': ts.belts,
            'edit-gas-giants': ts.gasGiants,
            'edit-worlds': ts.worlds,
            'edit-ix': ts.Importance || ts.Ix,
            'edit-ru': ts.ResourceUnits || ts.RU,
            'edit-r': ts.ecoResources || ts.R,
            'edit-l': ts.ecoLabor || ts.L,
            'edit-i': ts.ecoInfrastructure || ts.I,
            'edit-e': ts.ecoEfficiency || ts.E,
            'edit-h': ts.H,
            'edit-a': ts.A,
            'edit-s': ts.S,
            'edit-sym': ts.Sym
        };
        for (const [id, val] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) {
                if ("value" in el) el.value = val;
                else el.innerText = val;
            }
        }
    }

    // MgT2E Star System Tree
    if (stateObj.mgtSystem) {
        document.getElementById('acc-btn-mgt-system').style.display = 'flex';
        const root = document.getElementById('editor-mgt-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.mgtSystem;

            let systemIsMaskingEligible = false;
            sys.worlds.forEach(w => {
                const star = sys.stars[w.parentStarIdx || 0];
                const starDiam = getSafeStarDiameter(star);
                const effectiveAU = (w.au !== undefined) ? w.au : (w.distAU !== undefined ? w.distAU : 0);
                if (starDiam > 0 && effectiveAU > 0 && w.size !== undefined) {
                    if (UniversalMath.isMaskingEligible(starDiam, effectiveAU, w.size)) systemIsMaskingEligible = true;
                }
                if (w.satellites && !systemIsMaskingEligible) {
                    w.satellites.forEach(m => {
                        const effectiveMoonAU = (m.au !== undefined) ? m.au : (m.distAU !== undefined ? m.distAU : 0);
                        if (starDiam > 0 && effectiveMoonAU > 0 && m.size !== undefined) {
                            if (UniversalMath.isMaskingEligible(starDiam, effectiveMoonAU, m.size)) systemIsMaskingEligible = true;
                        }
                    });
                }
            });

            const isChecked = stateObj.isStellarMaskingActive ? 'checked' : '';
            let html = ``;

            if (systemIsMaskingEligible) {
                html += `<div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: center; background: rgba(255, 165, 0, 0.1); border: 1px solid #ffa500; border-radius: 4px; padding: 8px;">
                    <label for="edit-stellar-mask" style="color: #ffa500; font-size: 0.9em; font-weight: bold; margin-right: 12px; cursor: pointer;">
                        <i class="fas fa-sun"></i> Enable Stellar Mask Distances
                    </label>
                    <input type="checkbox" id="edit-stellar-mask" ${isChecked} style="width: 20px; height: 20px; cursor: pointer; margin: 0;">
                </div>`;
            }

            html += `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">System Overview</div>
                <span>HZco (Primary): <strong>${(sys.hzco || 0).toFixed(2)}</strong></span>
                <span>Age: <strong>${(sys.age || 0).toFixed(2)} Gyr</strong></span>`;

            const mwBase = stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData;
            if (mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                const zoneColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                html += `<span style="color: ${zoneColor};">Travel Zone: <strong>${mwBase.travelZone}</strong></span>`;
            }

            if (sys.stars.length > 1 && sys.ptypeHzco !== undefined) {
                html += `<span style="color:#66fcf1;">P-Type HZco: <strong>${(sys.ptypeHzco || 0).toFixed(2)}</strong></span>`;
                let ptypeLimit = sys.ptypeInnerLimit !== undefined && sys.ptypeInnerLimit !== Infinity
                    ? (sys.ptypeInnerLimit || 0).toFixed(2) : 'N/A';
                html += `<span style="color:#66fcf1;">P-Type Inner Limit: <strong>${ptypeLimit}</strong></span>`;
            }
            html += `</div>`;

            html += `<div class="system-tree">`;

            sys.stars.forEach((star, starIdx) => {
                html += `<details open>`;
                html += `<summary>${star.role || 'Star'} - ${star.name} <span class="sys-title-info">Star</span></summary>`;
                html += `<div class="system-node">`;
                html += `<div class="system-stats">`;
                html += `<span>Mass: <strong>${(star.mass || 0).toFixed(2)} M☉</strong></span>`;
                html += `<span>Lum: <strong>${(star.lum || 0).toFixed(3)} L☉</strong></span>`;

                if (star.orbitId !== null && starIdx > 0) {
                    html += `<span>Orbit ID: <strong>${(star.orbitId || 0).toFixed(2)}</strong></span>`;
                    html += `<span>Ecc: <strong>${(star.eccentricity || 0).toFixed(3)}</strong></span>`;
                    if (star.mao) {
                        html += `<span>MAO: <strong>${(star.mao || 0).toFixed(2)}</strong></span>`;
                    }
                }
                html += `</div>`;

                const sortedWorlds = [...sys.worlds].sort((a, b) => (a.orbitId || 0) - (b.orbitId || 0));
                sortedWorlds.forEach((w, widx) => {
                    let worldParent = w.parentStarIdx !== undefined ? w.parentStarIdx : 0;
                    if (worldParent !== starIdx || w.type === 'Empty') return;

                    let mwBase = stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData;
                    let isMainworldEntry = w.type === 'Mainworld' || w.isLunarMainworld;
                    let uwp = isMainworldEntry ? (mwBase ? mwBase.uwp : '-') : (w.uwpSecondary || '-');
                    let labelColor = isMainworldEntry ? '#ffa500' : '#66fcf1';
                    let summaryStyle = isMainworldEntry ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                    let zoneLabel = '';
                    if (isMainworldEntry && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                        const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                        zoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                    }

                    html += `<details open>`;
                    html += `<summary ${summaryStyle}>Orbit ${(w.orbitId || 0).toFixed(2)} (${w.orbitType || 'S-Type'})${zoneLabel} <span class="sys-title-info">${w.type}</span></summary>`;
                    html += `<div class="system-node">`;

                    if (w.type !== 'Planetoid Belt' && w.type !== 'Gas Giant' && uwp !== '-') {
                        html += `<div style="margin-bottom: 6px; font-family: monospace; font-size: 1.1em;">UWP: <strong style="color: ${labelColor}">${uwp}</strong></div>`;
                    }
                    if (w.type === 'Gas Giant' && w.uwpGG) {
                        html += `<div style="margin-bottom: 6px; font-family: monospace; font-size: 1.1em;">SAH: <strong style="color: ${labelColor}">${w.uwpGG}</strong></div>`;
                    }
                    if (w.classifications && w.classifications.length > 0) {
                        html += `<div style="margin-bottom: 6px; font-size: 0.85em; color: #a0a8b0;">Classification: <strong style="color: #66fcf1;">${w.classifications.join(', ')}</strong></div>`;
                    }

                    html += `<div class="system-stats">`;
                    html += `<span>Orbit ID: <strong>${(w.orbitId || 0).toFixed(2)}</strong></span>`;
                    html += `<span>Type: <strong>${w.orbitType || 'S-Type'}</strong></span>`;
                    html += `<span>Distance: <strong>${w.au ? (w.au || 0).toFixed(2) : '?'} AU</strong></span>`;
                    html += `<span>Ecc: <strong>${(w.eccentricity || 0).toFixed(3)}</strong></span>`;

                    if (w.periodYears) {
                        let periodStr = w.periodYears < 1.0
                            ? `${(w.periodYears * 365.25).toFixed(1)} days`
                            : `${(w.periodYears || 0).toFixed(2)} years`;
                        html += `<span class="system-stats-full">Period: <strong>${periodStr}</strong></span>`;
                        if (w.type !== 'Planetoid Belt' && w.size != 0 && w.size !== 'R') {
                            html += `<span>Composition: <strong>${w.composition || '?'}</strong></span>`;
                            if (w.density != null) html += `<span>Density: <strong>${(w.density || 0).toFixed(2)}</strong></span>`;

                            let atmComp = 'None';
                            if (w.gases && w.gases.length > 0) {
                                atmComp = w.gases.slice(0, 3).join(', ');
                                if (w.gases.length > 3) atmComp += ', ...';
                            } else if (w.oxygenFraction !== undefined) {
                                atmComp = `N2/O2 (${(w.oxygenFraction * 100).toFixed(1)}% O2)`;
                            }
                            if (w.taints && w.taints.length > 0) {
                                atmComp += ` [Taint: ${w.taints.join(', ')}]`;
                            }
                            html += `<span class="system-stats-full">Atmosphere: <strong>${atmComp}</strong></span>`;
                        }
                    }

                    if (w.type !== 'Planetoid Belt' && w.size != 0 && w.size !== 'R') {
                        if (w.gravity != null) html += `<span>Gravity: <strong>${(w.gravity || 0).toFixed(2)} G</strong></span>`;
                        if (w.mass != null) html += `<span>Mass: <strong>${(w.mass || 0).toFixed(4)} M⊕</strong></span>`;
                        if (w.type === 'Gas Giant' && w.diamTerra != null) html += `<span>Diameter: <strong>${w.diamTerra} T⊕</strong></span>`;
                        if (w.meanTempK != null) {
                            if (w.highTempK != null && w.lowTempK != null && !isNaN(w.highTempK) && !isNaN(w.lowTempK)) {
                                html += `<span class="system-stats-full">Temp: <strong>${((w.meanTempK || 273) - 273).toFixed(0)}°C</strong> (L:${(w.lowTempK - 273).toFixed(0)}° / H:${(w.highTempK - 273).toFixed(0)}°)</span>`;
                            } else {
                                html += `<span>Temp: <strong>${((w.meanTempK || 273) - 273).toFixed(0)}°C</strong></span>`;
                            }
                        }
                    }

                    if (w.solarDayHours != null) {
                        let dayStr = '';
                        if (w.solarDayHours === Infinity || w.isTwilightZone) {
                            dayStr = 'Twilight Zone';
                        } else if (w.solarDayHours >= 24) {
                            dayStr = `${(w.solarDayHours / 24).toFixed(1)}d`;
                        } else {
                            dayStr = `${w.solarDayHours.toFixed(1)}h`;
                        }
                        html += `<span>Solar Day: <strong>${dayStr}</strong></span>`;
                    }

                    if (w.type === 'Terrestrial Planet' || isMainworldEntry) {
                        if (isMainworldEntry && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                            const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                            html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor};">Caution: ${mwBase.travelZone} Zone</div>`;
                        }
                        if (w.axialTilt != null) html += `<span>Axial Tilt: <strong>${w.axialTilt ? w.axialTilt.toFixed(1) : '0'}°</strong></span>`;
                        if (w.lifeProfile) {
                            html += `<span>Native Life: <strong>${w.lifeProfile}</strong></span>`;
                        }
                        html += `<span>Habitability: <strong>${w.habitability !== undefined ? w.habitability : '?'}/15</strong></span>`;

                        if (w.resourceRating !== undefined) {
                            html += `<span>Res: <strong>${toUWPChar(w.resourceRating)}</strong></span>`;
                        }
                        if (w.secRU !== undefined && w.secPop > 0) {
                            html += `<span>RU: <strong>${w.secRU}</strong></span>`;
                        }
                    } else if (w.type === 'Planetoid Belt') {
                        if (w.beltProfileString) {
                            html += `<div class="system-stats-full" style="color: #66fcf1; font-family: monospace;">Profile: ${w.beltProfileString}</div>`;
                            html += `<span>Span: <strong>${w.span ? w.span.toFixed(2) : '?'}</strong></span>`;
                            html += `<span>Bulk: <strong>${w.bulk !== undefined ? w.bulk : '?'}</strong></span>`;
                            html += `<span>Resource: <strong>${w.resourceRating !== undefined ? toUWPChar(w.resourceRating) : '?'}</strong></span>`;
                            html += `<span>Sig Size 1: <strong>${w.size1Count || 0}</strong></span>`;
                            html += `<span>Sig Size S: <strong>${w.sizeSCount || 0}</strong></span>`;
                            html += `<div class="system-stats-full">Comp: M:${w.mType}% S:${w.sType}% C:${w.cType}% O:${w.oType}%</div>`;
                        } else {
                            html += `<div class="system-stats-full" style="color: #a0a8b0;">No profile data generated.</div>`;
                        }
                    }

                    html += `</div>`;

                    if (isMainworldEntry) {
                        const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                        html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Allegiance: <strong style="color: #66fcf1">${alleg}</strong></div>`;
                    }

                    html += buildJourneyTimesUI(w, sys.stars[starIdx], stateObj.isStellarMaskingActive);

                    let subBodies = [];
                    if (w.moons && w.moons.length > 0) subBodies = subBodies.concat(w.moons);
                    if (w.significantBodies && w.significantBodies.length > 0) subBodies = subBodies.concat(w.significantBodies);

                    if (subBodies.length > 0) {
                        subBodies.forEach((m, midx) => {
                            let isSigBody = m.type === 'Planetoid Belt Body';
                            let isMoonMainworld = m.type === 'Mainworld' || m.isLunarMainworld;
                            let mUwp = isMoonMainworld ? (m.uwp || m.uwpSecondary || mwBase?.uwp || '-') : (m.uwpSecondary || '-');
                            let mLabelColor = isMoonMainworld ? '#ffa500' : '#66fcf1';
                            let mSummaryStyle = isMoonMainworld ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                            let titlePrefix = isSigBody ? 'Sig Body' : 'Moon';

                            html += `<details>`;
                            html += `<summary ${mSummaryStyle}>${titlePrefix} ${midx + 1} <span class="sys-title-info">Size ${m.size}</span></summary>`;
                            html += `<div class="system-node">`;

                            if (!isSigBody && mUwp !== '-') {
                                html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: ${mLabelColor}">${mUwp}</strong></div>`;
                            }
                            if (m.classifications && m.classifications.length > 0) {
                                html += `<div style="margin-bottom: 6px; font-size: 0.85em; color: #a0a8b0;">Classification: <strong style="color: #66fcf1;">${m.classifications.join(', ')}</strong></div>`;
                            }

                            html += `<div class="system-stats">`;

                            if (isSigBody) {
                                html += `<span>Orbit: <strong>${(m.orbitId !== undefined && m.orbitId !== null) ? m.orbitId.toFixed(2) : '?'}</strong></span>`;
                            } else {
                                html += `<span>Orbit: <strong>${(m.pd !== undefined && m.pd !== null) ? m.pd.toFixed(1) : '?'} ⌀</strong></span>`;
                            }

                            html += `<span>Ecc: <strong>${(m.eccentricity || 0).toFixed(3)}</strong></span>`;

                            if (m.periodHrs) {
                                let pStr = m.periodHrs < 24
                                    ? `${m.periodHrs.toFixed(1)}h`
                                    : `${(m.periodHrs / 24).toFixed(1)}d`;
                                html += `<span>Period: <strong>${pStr}</strong></span>`;
                            }

                            if (m.type !== 'Planetoid Belt' && m.size != 0 && m.size !== 'R') {
                                if (m.composition) html += `<span>Comp: <strong>${m.composition}</strong></span>`;
                                if (m.density != null) html += `<span>Density: <strong>${m.density !== undefined ? m.density.toFixed(2) : '?'}</strong></span>`;

                                let mAtmComp = 'None';
                                if (m.gases && m.gases.length > 0) {
                                    mAtmComp = m.gases.slice(0, 3).join(', ');
                                    if (m.gases.length > 3) mAtmComp += ', ...';
                                } else if (m.oxygenFraction !== undefined) {
                                    mAtmComp = `N2/O2 (${(m.oxygenFraction * 100).toFixed(1)}% O2)`;
                                }
                                if (m.taints && m.taints.length > 0) {
                                    mAtmComp += ` [Taint: ${m.taints.join(', ')}]`;
                                }
                                html += `<span class="system-stats-full">Atmosphere: <strong>${mAtmComp}</strong></span>`;
                            }

                            if (m.type !== 'Planetoid Belt' && m.size != 0 && m.size !== 'R') {
                                if (m.gravity != null) html += `<span>Gravity: <strong>${m.gravity !== undefined ? m.gravity.toFixed(2) : '?'} G</strong></span>`;
                                if (m.mass != null) html += `<span>Mass: <strong>${m.mass !== undefined ? m.mass.toFixed(4) : '?'} M⊕</strong></span>`;

                                if (m.meanTempK != null) {
                                    if (m.highTempK != null && m.lowTempK != null && !isNaN(m.highTempK) && !isNaN(m.lowTempK)) {
                                        html += `<span class="system-stats-full">Temp: <strong>${(m.meanTempK - 273).toFixed(0)}°C</strong> (L:${(m.lowTempK - 273).toFixed(0)}° / H:${(m.highTempK - 273).toFixed(0)}°)</span>`;
                                    } else {
                                        html += `<span>Temp: <strong>${(m.meanTempK - 273).toFixed(0)}°C</strong></span>`;
                                    }
                                }
                            }

                            if (m.solarDayHours != null) {
                                let mDayStr = '';
                                if (m.solarDayHours === Infinity || m.isTwilightZone) {
                                    mDayStr = 'Twilight Zone';
                                } else if (m.solarDayHours >= 24) {
                                    mDayStr = `${(m.solarDayHours / 24).toFixed(1)}d`;
                                } else {
                                    mDayStr = `${m.solarDayHours.toFixed(1)}h`;
                                }
                                html += `<span>Solar Day: <strong>${mDayStr}</strong></span>`;
                            }

                            if (m.axialTilt != null) {
                                html += `<span>Axial Tilt: <strong>${m.axialTilt.toFixed(1)}°</strong></span>`;
                            }

                            if (m.lifeProfile) {
                                html += `<span>Native Life: <strong>${m.lifeProfile}</strong></span>`;
                            }

                            if (m.habitability !== undefined) {
                                html += `<span>Hab: <strong>${m.habitability}/15</strong></span>`;
                            }

                            if (m.resourceRating !== undefined) {
                                html += `<span>Res: <strong>${toUWPChar(m.resourceRating)}</strong></span>`;
                            }

                            html += `</div>`;

                            if (isMoonMainworld) {
                                const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                                html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Allegiance: <strong style="color: #66fcf1">${alleg}</strong></div>`;
                            }

                            html += buildJourneyTimesUI(m, sys.stars[starIdx], stateObj.isStellarMaskingActive, (w.au || w.distAU));

                            html += `</div></details>`;
                        });
                    }

                    html += `</div></details>`;
                });

                html += `</div></details>`;
            });

            html += `</div>`;

            root.innerHTML = html;
        }
    }

    // CT Scouts System Tree
    if (stateObj.ctSystem) {
        document.getElementById('acc-btn-ct-system').style.display = 'flex';
        const root = document.getElementById('editor-ct-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.ctSystem;

            let systemIsMaskingEligible = false;
            let scanBodies = [];
            sys.orbits.forEach(o => { if (o.contents) scanBodies.push(o.contents); });
            if (sys.capturedPlanets) sys.capturedPlanets.forEach(p => scanBodies.push(p));

            const star = sys.stars[0];
            const starDiam = getSafeStarDiameter(star);
            if (starDiam > 0) {
                scanBodies.forEach(w => {
                    if (w.distAU !== undefined && w.size !== undefined) {
                        if (UniversalMath.isMaskingEligible(starDiam, w.distAU, w.size)) systemIsMaskingEligible = true;
                    }
                    if (w.satellites && !systemIsMaskingEligible) {
                        w.satellites.forEach(m => {
                            if (m.distAU !== undefined && m.size !== undefined) {
                                if (UniversalMath.isMaskingEligible(starDiam, m.distAU, m.size)) systemIsMaskingEligible = true;
                            }
                        });
                    }
                });
            }

            const isChecked = stateObj.isStellarMaskingActive ? 'checked' : '';
            let html = ``;

            if (systemIsMaskingEligible) {
                html += `<div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: center; background: rgba(255, 165, 0, 0.1); border: 1px solid #ffa500; border-radius: 4px; padding: 8px;">
                    <label for="edit-stellar-mask" style="color: #ffa500; font-size: 0.9em; font-weight: bold; margin-right: 12px; cursor: pointer;">
                        <i class="fas fa-sun"></i> Enable Stellar Mask Distances
                    </label>
                    <input type="checkbox" id="edit-stellar-mask" ${isChecked} style="width: 20px; height: 20px; cursor: pointer; margin: 0;">
                </div>`;
            }

            let mwBase = stateObj.ctData || stateObj.mgt2eData || stateObj.t5Data;
            const ctSysName = (mwBase && mwBase.name) || stateObj.name || 'System';
            const _ctMc = (obj, field) =>
                (typeof isManual === 'function' && isManual(obj, field)) ? ' is-manual' : '';
            function ctToRoman(n) {
                const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
                const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
                let r = '';
                for (let i = 0; i < vals.length; i++) {
                    while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
                }
                return r || String(n);
            }
            // ── Field builder helpers (body/satellite) ────────────────────────
            function _ctNum(obj, field, orbit, captured, sIdx, min, max) {
                const val = (obj[field] !== undefined && obj[field] !== null) ? obj[field] : '';
                return `<input type="number" class="rtt-field-input${_ctMc(obj, field)}" data-ct-field="${field}" data-ct-orbit="${orbit}" data-ct-captured="${captured}" data-ct-satidx="${sIdx}" value="${val}" min="${min}" max="${max}" step="any">`;
            }
            function _ctText(obj, field, orbit, captured, sIdx) {
                const val = (obj[field] !== undefined && obj[field] !== null) ? String(obj[field]).replace(/"/g, '&quot;') : '';
                return `<input type="text" class="rtt-field-input${_ctMc(obj, field)}" data-ct-field="${field}" data-ct-orbit="${orbit}" data-ct-captured="${captured}" data-ct-satidx="${sIdx}" value="${val}">`;
            }
            function _ctArray(obj, field, orbit, captured, sIdx) {
                const val = Array.isArray(obj[field]) ? obj[field].join(' ') : (obj[field] || '');
                return `<input type="text" class="rtt-field-input${_ctMc(obj, field)}" data-ct-field="${field}" data-ct-orbit="${orbit}" data-ct-captured="${captured}" data-ct-satidx="${sIdx}" value="${String(val).replace(/"/g, '&quot;')}">`;
            }
            // ── Field builder helpers (star) ──────────────────────────────────
            function _ctStarText(star, field, sidx) {
                const val = (star[field] !== undefined && star[field] !== null) ? String(star[field]).replace(/"/g, '&quot;') : '';
                return `<input type="text" class="rtt-field-input${_ctMc(star, field)}" data-ct-field="${field}" data-ct-sidx="${sidx}" value="${val}">`;
            }
            function _ctStarNum(star, field, sidx, min, max) {
                const val = (star[field] !== undefined && star[field] !== null) ? star[field] : '';
                return `<input type="number" class="rtt-field-input${_ctMc(star, field)}" data-ct-field="${field}" data-ct-sidx="${sidx}" value="${val}" min="${min}" max="${max}" step="any">`;
            }
            html += `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">CT Scouts Overview</div>
                <span>Nature: <strong>${sys.nature}</strong></span>
                <span>Total Orbits: <strong>${sys.maxOrbits}</strong></span>`;

            if (mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                const zoneColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                html += `<span style="color: ${zoneColor};">Travel Zone: <strong>${mwBase.travelZone}</strong></span>`;
            }
            html += `</div>`;

            html += `<div class="system-tree">`;

            sys.stars.forEach((star, starIdx) => {
                html += `<details open>`;
                html += `<summary>${starIdx === 0 ? 'Primary' : (star.role || 'Companion')} - ${star.name} <span class="sys-title-info">Star</span></summary>`;
                html += `<div class="system-node">`;
                html += `<div class="system-stats">`;
                html += `<span>Type: ${_ctStarText(star, 'type', starIdx)}</span>`;
                html += `<span>Size: ${_ctStarText(star, 'size', starIdx)}</span>`;
                html += `<span>Mass: ${_ctStarNum(star, 'mass', starIdx, 0, 200)} M☉</span>`;
                html += `<span>Lum: ${_ctStarNum(star, 'luminosity', starIdx, 0, 1000000)} L☉</span>`;
                if (starIdx > 0 && star.orbitLabel) html += `<span>Orbit: <strong>${star.orbitLabel}</strong></span>`;
                html += `</div>`;

                if (starIdx === 0) {
                    let allBodies = [];
                    sys.orbits.forEach(o => {
                        if (o.contents) {
                            allBodies.push({
                                isCaptured: false,
                                orbit: o.orbit,
                                zone: o.zone,
                                contents: o.contents
                            });
                        }
                    });
                    if (sys.capturedPlanets) {
                        sys.capturedPlanets.forEach(p => {
                            allBodies.push({
                                isCaptured: true,
                                orbit: p.orbit,
                                zone: p.zone,
                                contents: p
                            });
                        });
                    }
                    allBodies.sort((a, b) => a.orbit - b.orbit);

                    allBodies.forEach((body, bodyIdx) => {
                        let w = body.contents;
                        let o = body;

                        let uwp = (w.type === 'Mainworld' && mwBase) ? mwBase.uwp : (w.uwpSecondary || '-');
                        let typeLabel = w.type === 'Gas Giant'
                            ? (w.size + ' Gas Giant')
                            : (w.type === 'Planetoid Belt' ? 'Belt' : (body.isCaptured ? 'Captured' : w.type));
                        let labelColor = w.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                        let summaryStyle = w.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                        let zoneLabel = '';
                        if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                            const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                            zoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                        }

                        let orbitLabel = body.isCaptured
                            ? `Captured [${o.orbit.toFixed(1)}]`
                            : `Orbit ${o.orbit}`;

                        const _ctBodyDflt  = `${ctSysName} ${ctToRoman(bodyIdx + 1)}`;
                        const _ctBodyNVal  = (w.name || '').replace(/"/g, '&quot;');
                        const _ctBodyNPh   = _ctBodyDflt.replace(/"/g, '&quot;');
                        const _ctBodyNCls  = `rtt-field-input rtt-name-input${w.type === 'Mainworld' ? ' rtt-name-mainworld' : ''}${_ctMc(w, 'name')}`;
                        const _ctBodyNAttr = `data-ct-field="name" data-ct-orbit="${o.orbit}" data-ct-captured="${body.isCaptured}" data-ct-satidx="-1"`;
                        html += `<details open>`;
                        html += `<summary ${summaryStyle}><input type="text" class="${_ctBodyNCls}" ${_ctBodyNAttr} value="${_ctBodyNVal}" placeholder="${_ctBodyNPh}" onclick="event.stopPropagation()" style="max-width:160px;"> ${orbitLabel} [${o.zone}] <span class="sys-title-info">${typeLabel} | ${uwp}${zoneLabel}</span></summary>`;
                        const _isMain = w.type === 'Mainworld';
                        html += `<div class="system-node">`;

                        // UWP — read-only for mainworld (top editor owns it), editable for all others
                        if (_isMain) {
                            html += `<div style="margin-bottom: 6px; font-family: monospace; font-size: 1.1em;">UWP: <strong style="color: ${labelColor}">${uwp}</strong></div>`;
                        } else {
                            const _uwpManual = typeof isManual === 'function' &&
                                ['starport','size','atm','hydro','pop','gov','law','tl'].some(f => isManual(w, f));
                            html += `<div style="margin-bottom: 6px; font-family: monospace; font-size: 1.1em;">UWP: <input type="text" class="rtt-field-input${_uwpManual ? ' is-manual' : ''}" data-ct-field="uwp" data-ct-orbit="${o.orbit}" data-ct-captured="${body.isCaptured}" data-ct-satidx="-1" value="${uwp.replace(/"/g, '&quot;')}" style="color: ${labelColor}; max-width:140px; font-weight:bold;"></div>`;
                        }

                        if (_isMain && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                            const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                            html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor}; margin-bottom: 8px;">Caution: ${mwBase.travelZone} Zone</div>`;
                        }
                        html += `<div class="system-stats">`;

                        html += `<span>Orbit: <strong>${body.isCaptured ? o.orbit.toFixed(1) : o.orbit}</strong></span>`;
                        html += `<span>Distance (AU): ${_ctNum(w, 'distAU', o.orbit, body.isCaptured, -1, 0, 1000)}</span>`;
                        html += `<span>Year (yr): ${_ctNum(w, 'orbitalPeriod', o.orbit, body.isCaptured, -1, 0, 100000)}</span>`;
                        html += `<span>Diameter (km): ${_ctNum(w, 'diamKm', o.orbit, body.isCaptured, -1, 0, 200000)}</span>`;
                        html += `<span>Gravity (G): ${_ctNum(w, 'gravity', o.orbit, body.isCaptured, -1, 0, 100)}</span>`;
                        html += `<span>Mass (M⊕): ${_ctNum(w, 'mass', o.orbit, body.isCaptured, -1, 0, 10000)}</span>`;
                        html += `<span>Temp (K): ${_ctNum(w, 'temperature', o.orbit, body.isCaptured, -1, 0, 10000)}</span>`;
                        html += `<span>Day: ${_ctText(w, 'rotationPeriod', o.orbit, body.isCaptured, -1)}</span>`;
                        html += `<span>Tilt (°): ${_ctNum(w, 'axialTilt', o.orbit, body.isCaptured, -1, 0, 180)}</span>`;

                        html += `</div>`;

                        if (_isMain) {
                            const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                            html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Allegiance: <strong style="color: #66fcf1">${alleg}</strong></div>`;
                        }

                        html += buildJourneyTimesUI(w, sys.stars[starIdx], stateObj.isStellarMaskingActive);

                        if (w.satellites && w.satellites.length > 0) {
                            const sortedSats = [...w.satellites].sort((a, b) => (a.pd || 0) - (b.pd || 0));

                            sortedSats.forEach((sat, satIdx) => {
                                let satType = sat.type === 'Mainworld' ? 'Mainworld' : (sat.size === 'R' ? 'Ring' : (sat.size === 'S' ? 'Small Moon' : 'Moon'));
                                let satUwp = (sat.type === 'Mainworld' && mwBase) ? mwBase.uwp : (sat.uwpSecondary || '-');
                                let satLabelColor = sat.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                                let satSummaryStyle = sat.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                                let satZoneLabel = '';
                                if (sat.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                                    const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                                    satZoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                                }

                                const _ctSatDflt  = `${ctSysName} ${ctToRoman(bodyIdx + 1)}-${String.fromCharCode(97 + satIdx)}`;
                                const _ctSatNVal  = (sat.name || '').replace(/"/g, '&quot;');
                                const _ctSatNPh   = _ctSatDflt.replace(/"/g, '&quot;');
                                const _ctSatNCls  = `rtt-field-input rtt-name-input${sat.type === 'Mainworld' ? ' rtt-name-mainworld' : ''}${_ctMc(sat, 'name')}`;
                                const _ctSatNAttr = `data-ct-field="name" data-ct-orbit="${o.orbit}" data-ct-captured="${body.isCaptured}" data-ct-satidx="${satIdx}"`;
                                html += `<details>`;
                                html += `<summary ${satSummaryStyle}><input type="text" class="${_ctSatNCls}" ${_ctSatNAttr} value="${_ctSatNVal}" placeholder="${_ctSatNPh}" onclick="event.stopPropagation()" style="max-width:160px;"> Satellite ${satIdx + 1} <span class="sys-title-info">${satType} | ${(sat.pd !== undefined && sat.pd !== null) ? sat.pd : '?'}r | ${satUwp}${satZoneLabel}</span></summary>`;
                                const _isSatMain = sat.type === 'Mainworld';
                                html += `<div class="system-node">`;

                                // UWP — read-only for mainworld sat, editable for all others
                                if (_isSatMain) {
                                    html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: ${satLabelColor}">${satUwp}</strong></div>`;
                                } else {
                                    const _satUwpManual = typeof isManual === 'function' &&
                                        ['starport','size','atm','hydro','pop','gov','law','tl'].some(f => isManual(sat, f));
                                    html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <input type="text" class="rtt-field-input${_satUwpManual ? ' is-manual' : ''}" data-ct-field="uwp" data-ct-orbit="${o.orbit}" data-ct-captured="${body.isCaptured}" data-ct-satidx="${satIdx}" value="${satUwp.replace(/"/g, '&quot;')}" style="color: ${satLabelColor}; max-width:140px; font-weight:bold;"></div>`;
                                }
                                html += `<div class="system-stats">`;

                                html += `<span>Distance (AU): ${_ctNum(sat, 'distAU', o.orbit, body.isCaptured, satIdx, 0, 1000)}</span>`;
                                html += `<span>Gravity (G): ${_ctNum(sat, 'gravity', o.orbit, body.isCaptured, satIdx, 0, 100)}</span>`;
                                html += `<span>Mass (M⊕): ${_ctNum(sat, 'mass', o.orbit, body.isCaptured, satIdx, 0, 10000)}</span>`;
                                html += `<span>Temp (K): ${_ctNum(sat, 'temperature', o.orbit, body.isCaptured, satIdx, 0, 10000)}</span>`;
                                html += `<span>Day: ${_ctText(sat, 'rotationPeriod', o.orbit, body.isCaptured, satIdx)}</span>`;
                                html += `<span>Tilt (°): ${_ctNum(sat, 'axialTilt', o.orbit, body.isCaptured, satIdx, 0, 180)}</span>`;

                                html += `</div>`;

                                if (_isSatMain) {
                                    const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                                    html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Allegiance: <strong style="color: #66fcf1">${alleg}</strong></div>`;
                                }

                                html += buildJourneyTimesUI(sat, sys.stars[starIdx], stateObj.isStellarMaskingActive, (w.au || w.distAU));

                                html += `</div></details>`;
                            });
                        }

                        html += `</div></details>`;
                    });
                }

                html += `</div></details>`;
            });

            html += `</div>`;

            root.innerHTML = html;
        }
    }

    // T5 Star System Tree
    if (stateObj.t5System) {
        document.getElementById('acc-btn-t5-system').style.display = 'flex';
        const root = document.getElementById('editor-t5-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.t5System;
            let mwBase = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;

            let systemIsMaskingEligible = false;
            if (sys.stars) {
                sys.stars.forEach(s => {
                    const starDiam = getSafeStarDiameter(s);
                    if (starDiam > 0 && s.orbits) {
                        s.orbits.forEach(o => {
                            let w = o.contents;
                            if (w && w.distAU !== undefined && w.size !== undefined) {
                                if (UniversalMath.isMaskingEligible(starDiam, w.distAU, w.size)) systemIsMaskingEligible = true;
                            }
                            if (w && w.satellites && !systemIsMaskingEligible) {
                                w.satellites.forEach(sat => {
                                    if (sat.distAU !== undefined && sat.size !== undefined) {
                                        if (UniversalMath.isMaskingEligible(starDiam, sat.distAU, sat.size)) systemIsMaskingEligible = true;
                                    }
                                });
                            }
                        });
                    }
                });
            }

            const isChecked = stateObj.isStellarMaskingActive ? 'checked' : '';
            let html = ``;

            if (systemIsMaskingEligible) {
                html += `<div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: center; background: rgba(255, 165, 0, 0.1); border: 1px solid #ffa500; border-radius: 4px; padding: 8px;">
                    <label for="edit-stellar-mask" style="color: #ffa500; font-size: 0.9em; font-weight: bold; margin-right: 12px; cursor: pointer;">
                        <i class="fas fa-sun"></i> Enable Stellar Mask Distances
                    </label>
                    <input type="checkbox" id="edit-stellar-mask" ${isChecked} style="width: 20px; height: 20px; cursor: pointer; margin: 0;">
                </div>`;
            }

            html += `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">T5: ${mwBase.name || stateObj.name || 'Unnamed'} Profile</div>`;
            if (sys.stars) {
                sys.stars.forEach(star => {
                    html += `<span>${star.role}: <strong>${star.name}</strong> (Lum: ${star.luminosity ? star.luminosity.toFixed(3) : '?'})</span>`;
                });
            }

            if (mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                const zoneColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                html += `<span style="color: ${zoneColor}; text-align: center;">Travel Zone: <strong>${mwBase.travelZone}</strong></span>`;
            }
            html += `</div>`;

            html += `<div class="system-tree">`;

            if (sys.stars) {
                sys.stars.forEach(star => {
                    const starLabel = `${star.role}: ${star.name}`;
                    html += `<div style="background: rgba(102, 252, 241, 0.05); padding: 8px; border: 1px solid rgba(102, 252, 241, 0.2); margin-top: 15px; border-radius: 4px;">`;
                    html += `<div style="color: #66fcf1; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(102, 252, 241, 0.3); padding-bottom: 4px;">${starLabel}</div>`;

                    if (star.orbits) {
                        star.orbits.forEach(o => {
                            let w = o.contents;
                            if (!w || w.type === 'Empty') {
                                return;
                            }

                            let uwp = w.type === 'Mainworld' ? mwBase.uwp : (w.uwpSecondary || w.uwp || '-');
                            let typeLabel = w.worldType || w.type;
                            if (w.type === 'Mainworld') typeLabel = `Mainworld (${typeLabel})`;
                            if (w.type === 'Gas Giant' && !w.worldType) typeLabel = `${w.size === 15 ? 'Large' : 'Small'} Gas Giant`;
                            let labelColor = w.type === 'Mainworld' ? '#ffa500' : '#66fcf1';
                            let summaryStyle = w.type === 'Mainworld' ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                            let zoneLabel = '';
                            if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                                const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                                zoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                            }

                            html += `<details>`;
                            html += `<summary ${summaryStyle}>Orbit ${o.orbit} [${w.climateZone || 'Cold'}] <span class="sys-title-info">${typeLabel}${zoneLabel}</span></summary>`;
                            html += `<div class="system-node">`;

                            if (w.type !== 'Planetoid Belt') {
                                html += `<div style="margin-bottom: 6px; font-family: monospace;">UWP: <strong style="color: ${labelColor}">${uwp}</strong></div>`;

                                const tCodes = (w.type === 'Mainworld' && mwBase && mwBase.tradeCodes)
                                    ? mwBase.tradeCodes
                                    : (w.tradeCodes || []);
                                if (tCodes.length > 0) {
                                    html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Codes: <strong style="color: #66fcf1">${tCodes.join(' ')}</strong></div>`;
                                }
                                if (w.type === 'Mainworld') {
                                    const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                                    html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Allegiance: <strong style="color: #66fcf1">${alleg}</strong></div>`;
                                }
                            }

                            if (w.type === 'Mainworld' && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                                const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                                const specialCodes = (mwBase.tradeCodes || []).filter(c => ['Fo', 'Da', 'Pz'].includes(c));
                                const codeStr = specialCodes.length > 0 ? ` - [${specialCodes.join('/')}]` : '';
                                html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor}; margin-bottom: 8px;">Caution: ${mwBase.travelZone} Zone${codeStr}</div>`;
                            }

                            html += `<div class="system-stats">`;
                            html += `<span>Distance: <strong>${(o.distAU || 0).toFixed(2)} AU</strong></span>`;

                            if (w.type !== 'Planetoid Belt') {
                                if (w.diamKm) html += `<span>Diameter: <strong>${w.diamKm.toLocaleString()} km</strong></span>`;
                                if (w.density !== undefined) html += `<span>Density: <strong>${(w.density || 0).toFixed(1)}</strong></span>`;
                                if (w.gravity !== undefined) html += `<span>Gravity: <strong>${(w.gravity || 0).toFixed(2)} G</strong></span>`;
                            }
                            html += `</div>`;

                            html += buildJourneyTimesUI(w, star, stateObj.isStellarMaskingActive);

                            if (w.satellites && w.satellites.length > 0) {
                                w.satellites.forEach((sat, satIdx) => {
                                    const isMW = sat.type === 'Mainworld';
                                    const satLabel = isMW ? 'Mainworld' : `Moon ${satIdx + 1} - ${sat.worldType || 'Satellite'}`;
                                    const satUwp = isMW ? (mwBase ? mwBase.uwp : sat.uwp || '-') : (sat.uwpSecondary || sat.uwp || '-');
                                    const satColor = isMW ? '#ffa500' : '#66fcf1';
                                    const satSummaryStyle = isMW ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';

                                    let satZoneLabel = '';
                                    if (isMW && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                                        const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                                        satZoneLabel = ` | <span style="color: ${zColor}">${mwBase.travelZone}</span>`;
                                    }

                                    html += `<details style="margin-left: 20px;" ${isMW ? 'open' : ''}>`;
                                    html += `<summary ${satSummaryStyle}>${satLabel} <span class="sys-title-info">Size ${sat.size} | ${satUwp}${satZoneLabel}</span></summary>`;
                                    html += `<div class="system-node">`;

                                    html += `<div style="margin-bottom: 6px; font-family: monospace;"><span style="color: ${satColor};">UWP:</span> <strong style="color: ${satColor};">${satUwp}</strong></div>`;

                                    const sCodes = (isMW && mwBase && mwBase.tradeCodes)
                                        ? mwBase.tradeCodes
                                        : (sat.tradeCodes || []);
                                    if (sCodes.length > 0) {
                                        html += `<div style="margin-bottom: 6px; font-size: 0.85em; color: #a0a8b0;">Codes: <strong style="color: #66fcf1">${sCodes.join(' ')}</strong></div>`;
                                    }
                                    if (isMW) {
                                        const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                                        html += `<div style="margin-bottom: 6px; font-size: 0.9em; color: #a0a8b0;">Allegiance: <strong style="color: #66fcf1">${alleg}</strong></div>`;
                                    }

                                    if (isMW && mwBase && mwBase.travelZone && mwBase.travelZone !== 'Green') {
                                        const zColor = mwBase.travelZone === 'Red' ? '#ff0000' : '#ffcc00';
                                        html += `<div class="system-stats-full" style="color: ${zColor}; border-color: ${zColor}; margin-bottom: 8px;">Caution: ${mwBase.travelZone} Zone</div>`;
                                    }

                                    html += `<div class="system-stats">`;
                                    if (sat.diamKm) html += `<span>Diameter: <strong>${sat.diamKm.toLocaleString()} km</strong></span>`;
                                    if (sat.gravity !== undefined) html += `<span>Gravity: <strong>${(sat.gravity || 0).toFixed(2)} G</strong></span>`;
                                    html += `</div>`;

                                    html += buildJourneyTimesUI(sat, star, stateObj.isStellarMaskingActive, o.distAU);

                                    html += `</div></details>`;
                                });
                            }

                            html += `</div></details>`;
                        });
                    }
                    html += `</div>`;
                });
            }

            html += `</div>`;
            root.innerHTML = html;
        }
    }

    // RTT Star System Tree
    if (stateObj.rttSystem) {
        document.getElementById('acc-btn-rtt-system').style.display = 'flex';
        const root = document.getElementById('editor-rtt-system-root');
        if (root) {
            root.innerHTML = '';
            const sys = stateObj.rttSystem;

            // --- Click-to-edit field builder helpers ---
            const _da = (field, sIdx, oIdx, satIdx) =>
                `data-rtt-field="${field}" data-rtt-sidx="${sIdx}" data-rtt-oidx="${oIdx}" data-rtt-satidx="${satIdx}"`;
            const _mc = (obj, field) =>
                (typeof isManual === 'function' && isManual(obj, field)) ? ' is-manual' : '';

            function _rttNum(obj, field, sIdx, oIdx, satIdx, min, max) {
                const val = (obj[field] !== undefined && obj[field] !== null) ? obj[field] : 0;
                return `<input type="number" class="rtt-field-input${_mc(obj, field)}" ${_da(field, sIdx, oIdx, satIdx)} value="${val}" min="${min}" max="${max}">`;
            }
            function _rttText(obj, field, sIdx, oIdx, satIdx) {
                const val = (obj[field] !== undefined && obj[field] !== null) ? String(obj[field]).replace(/"/g, '&quot;') : '';
                return `<input type="text" class="rtt-field-input${_mc(obj, field)}" ${_da(field, sIdx, oIdx, satIdx)} value="${val}">`;
            }
            function _rttArray(obj, field, sIdx, oIdx, satIdx) {
                const val = Array.isArray(obj[field]) ? obj[field].join(' ') : (obj[field] || '');
                return `<input type="text" class="rtt-field-input${_mc(obj, field)}" ${_da(field, sIdx, oIdx, satIdx)} value="${String(val).replace(/"/g, '&quot;')}">`;
            }
            function _rttSelect(obj, field, sIdx, oIdx, satIdx, opts) {
                const cur = (obj[field] !== undefined && obj[field] !== null) ? String(obj[field]) : '';
                let s = `<select class="rtt-field-select${_mc(obj, field)}" ${_da(field, sIdx, oIdx, satIdx)}>`;
                opts.forEach(o => { s += `<option value="${o}"${String(o) === cur ? ' selected' : ''}>${o}</option>`; });
                return s + `</select>`;
            }

            const _WC  = ['Acheronian','Arean','Arid','Asphodelian','Asteroid Belt','Chthonian',
                          'Hebean','Helian','JaniLithic','Jovian','Meltball','Oceanic',
                          'Panthalassic','Promethean','Rockball','Small Body','Snowball',
                          'Stygian','Tectonic','Telluric','Vesperian'];
            const _HAB = ['Uninhabited','Outpost','Colony','Homeworld'];
            const _CHM = ['None','Water','Ammonia','Methane','Sulfur','Chlorine'];
            const _RNG = ['None','Minor ring system','Complex ring system'];

            // Roman numeral helper for default world names (e.g. "Regina III")
            function toRoman(n) {
                const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
                const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
                let r = '';
                for (let i = 0; i < vals.length; i++) {
                    while (n >= vals[i]) { r += syms[i]; n -= vals[i]; }
                }
                return r || String(n);
            }

            function renderRTTBody(body, isSatellite, sIdx, oIdx, satIdx) {
                const uwp = `${body.starport || 'X'}${toUWPChar(body.size)}${toUWPChar(body.atmosphere)}${toUWPChar(body.hydrosphere)}${toUWPChar(body.population)}${toUWPChar(body.government)}${toUWPChar(body.lawLevel)}-${body.tl || 0}`;
                const isMain = body.habitationType === 'Homeworld' || body.isMainworld;
                const summaryStyle = isMain ? 'style="background-color: rgba(255, 165, 0, 0.1); border-color: #ffa500;"' : '';
                const uwpColor = isMain ? '#ffa500' : '#66fcf1';
                const baseType = body.type || body.worldClass || 'Body';
                const typeLabel = isMain ? `Mainworld (${baseType})` : baseType;
                const orbitLabel = isSatellite ? 'Satellite' : `Orbit ${body.orbitNumber || '?'}`;
                // Default name: "SystemName III" for planets, "SystemName III-a" for moons
                const defaultBodyName = isSatellite
                    ? `${sysName} ${toRoman(oIdx + 1)}-${String.fromCharCode(97 + Math.max(0, satIdx))}`
                    : `${sysName} ${toRoman(oIdx + 1)}`;

                let bHtml = `<details ${!isSatellite ? 'open' : ''}>`;

                // All bodies have an editable name input in the header.
                // Mainworld stays orange; non-mainworld uses the teal palette.
                // Blank = show the fallback (system name for mainworld, auto-generated default for others).
                if (isMain) {
                    const _mwNameCls = `rtt-field-input rtt-name-input rtt-name-mainworld${_mc(body, 'name')}`;
                    const _mwNameVal = (body.name || '').replace(/"/g, '&quot;');
                    const _mwNamePh  = (stateObj.name || defaultBodyName).replace(/"/g, '&quot;');
                    bHtml += `<summary ${summaryStyle}><input type="text" class="${_mwNameCls}" ${_da('name', sIdx, oIdx, satIdx)} value="${_mwNameVal}" placeholder="${_mwNamePh}" onclick="event.stopPropagation()" style="max-width: 160px;"> (${orbitLabel} · ${body.zone || '?'}) <span class="sys-title-info">${typeLabel} | <strong style="color: ${uwpColor}">${uwp}</strong></span></summary>`;
                } else {
                    const _uwpManual = typeof isManual === 'function' &&
                        ['starport','size','atmosphere','hydrosphere','population','government','lawLevel','tl'].some(f => isManual(body, f));
                    const _uwpCls = `rtt-field-input${_uwpManual ? ' is-manual' : ''}`;
                    const _nameCls = `rtt-field-input rtt-name-input${_mc(body, 'name')}`;
                    const _nameVal = (body.name || '').replace(/"/g, '&quot;');
                    const _namePh  = defaultBodyName.replace(/"/g, '&quot;');
                    bHtml += `<summary ${summaryStyle}><input type="text" class="${_nameCls}" ${_da('name', sIdx, oIdx, satIdx)} value="${_nameVal}" placeholder="${_namePh}" onclick="event.stopPropagation()" style="max-width: 160px;"> (${orbitLabel} · ${body.zone || '?'}) <span class="sys-title-info">${typeLabel} | <input type="text" class="${_uwpCls}" ${_da('uwp', sIdx, oIdx, satIdx)} value="${uwp.replace(/"/g, '&quot;')}" onclick="event.stopPropagation()" style="color: ${uwpColor}; max-width: 120px; font-weight: bold;"></span></summary>`;
                }

                bHtml += `<div class="system-node"><div class="system-stats">`;

                bHtml += `<span>Type: <strong>${body.type || '—'}</strong></span>`;
                bHtml += `<span>Class: ${_rttSelect(body, 'worldClass',     sIdx, oIdx, satIdx, _WC)}</span>`;
                bHtml += `<span>Chemistry: ${_rttSelect(body, 'chemistry',  sIdx, oIdx, satIdx, _CHM)}</span>`;
                bHtml += `<span>Biosphere: ${_rttNum(body, 'biosphere',     sIdx, oIdx, satIdx, 0, 15)}</span>`;
                bHtml += `<span>Rings: ${_rttSelect(body, 'rings',          sIdx, oIdx, satIdx, _RNG)}</span>`;
                bHtml += `<span>Habitation: ${_rttSelect(body, 'habitationType', sIdx, oIdx, satIdx, _HAB)}</span>`;
                bHtml += `<span>Desirability: ${_rttNum(body, 'desirability', sIdx, oIdx, satIdx, -10, 20)}</span>`;
                bHtml += `<span>Industry: ${_rttNum(body, 'industry',       sIdx, oIdx, satIdx, 0, 15)}</span>`;

                if (body.starport && body.habitationType !== 'Uninhabited') {
                    bHtml += `<span>Starport: <strong>${body.starport}</strong></span>`;
                }

                bHtml += `<span class="system-stats-full">Trade Codes: ${_rttArray(body, 'tradeCodes', sIdx, oIdx, satIdx)}</span>`;
                bHtml += `<span class="system-stats-full">Bases: ${_rttArray(body, 'bases', sIdx, oIdx, satIdx)}</span>`;

                if (isMain) {
                    const alleg = (stateObj.allegiance && stateObj.allegiance.trim()) || '----';
                    bHtml += `<span>Allegiance: <strong>${alleg}</strong></span>`;
                }
                if (body.canBeTerraformed) {
                    bHtml += `<span class="system-stats-full" style="color: #66fcf1; border-color: #45a29e;">Terraforming Potential: ${_rttNum(body, 'terraformPoints', sIdx, oIdx, satIdx, 0, 99)} pts</span>`;
                }

                bHtml += `</div>`;
                bHtml += buildBaseJourneyTimesUI(body.size);

                if (body.satellites && body.satellites.length > 0) {
                    body.satellites.forEach((sat, satI) => {
                        bHtml += renderRTTBody(sat, true, sIdx, oIdx, satI);
                    });
                }

                bHtml += `</div></details>`;
                return bHtml;
            }

            const mwBase  = stateObj.rttData;
            const sysName = (mwBase && mwBase.name) ? mwBase.name : 'Unknown';
            const _sysAgeClass = `rtt-field-input${_mc(sys, 'age')}`;

            let html = `<div class="system-stats" style="grid-template-columns: 1fr;">
                <div style="text-align: center; color: #66fcf1; border-bottom: 1px dotted #45a29e; padding-bottom: 4px;">RTT: ${sysName} Profile</div>
                <span>Age: <input type="number" class="${_sysAgeClass}" data-rtt-field="age" data-rtt-level="system" value="${sys.age !== undefined ? parseFloat(sys.age).toFixed(1) : '1.0'}" min="0.1" max="14" step="0.1"> Gyr</span>
                <span>Total Stars: <strong>${sys.stars.length}</strong></span>
            </div>`;

            html += `<div class="system-tree">`;
            sys.stars.forEach((star, sIdx) => {
                const starOrbitLabel = (star.orbitType && star.role !== 'Primary') ? ` (${star.orbitType} Orbit)` : '';
                const _starClassCss  = `rtt-field-input${_mc(star, 'classification')}`;
                html += `<details open>`;
                html += `<summary>${star.role}${starOrbitLabel} — <input type="text" class="${_starClassCss}" data-rtt-field="classification" data-rtt-level="star" data-rtt-sidx="${sIdx}" value="${(star.classification || '').replace(/"/g, '&quot;')}" onclick="event.stopPropagation()"> <span class="sys-title-info">Star</span></summary>`;
                html += `<div class="system-node">`;

                if (star.planetarySystem && star.planetarySystem.orbits) {
                    star.planetarySystem.orbits.forEach((body, oIdx) => {
                        html += renderRTTBody(body, false, sIdx, oIdx, -1);
                    });
                }

                html += `</div></details>`;
            });
            html += `</div>`;
            root.innerHTML = html;
        }
    }
}

// Global handler for T5 Travel Zone manual overrides
window.handleT5ZoneChange = function (el) {
    if (!editingHexId) return;
    const stateObj = hexStates.get(editingHexId);
    if (!stateObj || !stateObj.t5Data) return;

    const newZone = el.value;
    stateObj.t5Data.travelZone = newZone;

    let codes = stateObj.t5Data.tradeCodes || [];
    codes = codes.filter(c => !['Fo', 'Da', 'Pz'].includes(c));

    if (newZone === 'Red') {
        if (!codes.includes('Fo')) codes.push('Fo');
    } else if (newZone === 'Amber') {
        const pop = stateObj.t5Data.pop;
        if (pop <= 6) {
            if (!codes.includes('Da')) codes.push('Da');
        } else {
            if (!codes.includes('Pz')) codes.push('Pz');
        }
    }
    stateObj.t5Data.tradeCodes = codes;

    const mainSelect = document.getElementById('edit-travel-zone');
    if (mainSelect) mainSelect.value = newZone;

    const tcInput = document.getElementById('edit-trade-codes');
    if (tcInput) tcInput.value = codes.join(' ');

    populateEditorAccordions(stateObj);
    requestAnimationFrame(draw);
};

function closeHexEditor() {
    editingHexId = null;

    document.getElementById('editor-socio-t5-container').style.display = 'none';
    document.getElementById('acc-btn-t5-socio').style.display = 'none';
    document.getElementById('acc-btn-t5-socio').classList.remove('active');

    document.getElementById('editor-socio-mgt-container').style.display = 'none';
    document.getElementById('acc-btn-mgt-socio').style.display = 'none';
    document.getElementById('acc-btn-mgt-socio').classList.remove('active');

    document.getElementById('editor-physical-container').style.display = 'none';
    document.getElementById('acc-btn-physical').style.display = 'none';
    document.getElementById('acc-btn-physical').classList.remove('active');

    document.getElementById('editor-mgt-system-root').style.display = 'none';
    document.getElementById('editor-mgt-system-root').innerHTML = '';
    document.getElementById('acc-btn-mgt-system').style.display = 'none';
    document.getElementById('acc-btn-mgt-system').classList.remove('active');

    document.getElementById('editor-ct-system-root').style.display = 'none';
    document.getElementById('editor-ct-system-root').innerHTML = '';
    document.getElementById('acc-btn-ct-system').style.display = 'none';
    document.getElementById('acc-btn-ct-system').classList.remove('active');

    document.getElementById('editor-t5-system-root').style.display = 'none';
    document.getElementById('editor-t5-system-root').innerHTML = '';
    document.getElementById('acc-btn-t5-system').style.display = 'none';
    document.getElementById('acc-btn-t5-system').classList.remove('active');

    document.getElementById('editor-rtt-system-root').style.display = 'none';
    document.getElementById('editor-rtt-system-root').innerHTML = '';
    document.getElementById('acc-btn-rtt-system').style.display = 'none';
    document.getElementById('acc-btn-rtt-system').classList.remove('active');

    const hexEditor = document.getElementById('hex-editor');
    hexEditor.classList.remove('visible');
}

function setupHexEditor() {
    document.getElementById('btn-editor-cancel').addEventListener('click', closeHexEditor);
    document.getElementById('btn-editor-save').addEventListener('click', saveHexEditorChanges);

    // Use delegation on document because panels may have been moved out of #hex-editor to body
    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'edit-stellar-mask') {
            if (editingHexId && hexStates.has(editingHexId)) {
                const s = hexStates.get(editingHexId);
                s.isStellarMaskingActive = e.target.checked;
                populateEditorAccordions(s);
            }
        }
    });
}

function saveHexEditorChanges() {
    if (!editingHexId) return;

    const stateObj = hexStates.get(editingHexId);
    if (!stateObj || stateObj.type !== 'SYSTEM_PRESENT') return;

    const name = document.getElementById('edit-name').value.trim();
    const starport = document.getElementById('edit-starport').value.toUpperCase();
    const size = parseInt(document.getElementById('edit-size').value, 10) || 0;
    const atm = parseInt(document.getElementById('edit-atm').value, 10) || 0;
    const hydro = parseInt(document.getElementById('edit-hydro').value, 10) || 0;
    const pop = parseInt(document.getElementById('edit-pop').value, 10) || 0;
    const gov = parseInt(document.getElementById('edit-gov').value, 10) || 0;
    const law = parseInt(document.getElementById('edit-law').value, 10) || 0;
    const tl = parseInt(document.getElementById('edit-tl').value, 10) || 0;

    const navalBase = document.getElementById('edit-naval').checked;
    const scoutBase = document.getElementById('edit-scout').checked;
    const militaryBase = document.getElementById('edit-military').checked;
    const corsairBase = document.getElementById('edit-corsair').checked;
    const researchBase = document.getElementById('edit-research').checked;
    const tas = document.getElementById('edit-tas').checked;
    const wayStation = document.getElementById('edit-waystation').checked;
    const govEstate = document.getElementById('edit-gov-estate').checked;
    const embassy = document.getElementById('edit-embassy').checked;
    const moot = document.getElementById('edit-moot').checked;
    const merchantBase = document.getElementById('edit-merchant').checked;
    const shipyard = document.getElementById('edit-shipyard').checked;
    const megaCorp = document.getElementById('edit-megacorp').checked;
    const scoutHostel = document.getElementById('edit-scout-hostel').checked;
    const psionics = document.getElementById('edit-psionics').checked;
    const sacredSite = document.getElementById('edit-sacred').checked;
    const enclave = document.getElementById('edit-enclave').checked;
    const ancients = document.getElementById('edit-ancients').checked;
    const gasGiant = document.getElementById('edit-gas').checked;

    let bases = [];
    if (navalBase) bases.push('N');
    if (scoutBase) bases.push('S');
    if (corsairBase) bases.push('P');
    if (researchBase) bases.push('R');
    if (tas) bases.push('T');
    if (wayStation) bases.push('W');
    if (govEstate) bases.push('G');
    if (embassy) bases.push('F');
    if (moot) bases.push('Moot');
    if (merchantBase) bases.push('M');
    if (shipyard) bases.push('Y');
    if (megaCorp) bases.push('MegaCorp HQ');
    if (scoutHostel) bases.push('Scout Hostel');
    if (psionics) bases.push('Z');
    if (sacredSite) bases.push('K');
    if (enclave) bases.push('V');
    if (ancients) bases.push('Q');

    const tradeCodes = document.getElementById('edit-trade-codes').value
        .split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    const uwp = `${starport}${toUWPChar(size)}${toUWPChar(atm)}${toUWPChar(hydro)}${toUWPChar(pop)}${toUWPChar(gov)}${toUWPChar(law)}-${toUWPChar(tl)}`;

    const allegiance = document.getElementById('edit-allegiance').value.trim() || '----';
    const notes = document.getElementById('edit-notes').value.trim();

    const sharedData = { uwp, travelZone: document.getElementById('edit-travel-zone').value, tradeCodes, starport, size, atm, hydro, pop, gov, law, tl, bases, navalBase, scoutBase, militaryBase, corsairBase, researchBase, tas, wayStation, govEstate, embassy, moot, merchantBase, shipyard, megaCorp, scoutHostel, psionics, sacredSite, enclave, ancients, gasGiant, allegiance, notes };

    // Helper to sync PBG quick-stats if visible
    const t5QuickStatsDiv = document.getElementById('editor-t5-quick-stats');
    let pbgData = {};
    if (t5QuickStatsDiv && t5QuickStatsDiv.style.display !== 'none') {
        const pbgVal = document.getElementById('edit-pbg').value.padEnd(3, '0').toUpperCase();
        const fromHex = (char) => typeof fromUWPChar === 'function' ? fromUWPChar(char) : parseInt(char, 16) || 0;
        pbgData = {
            popDigit: fromHex(pbgVal[0]),
            planetoidBelts: fromHex(pbgVal[1]),
            gasGiantsCount: fromHex(pbgVal[2]),
            pbg: pbgVal,
            homestar: document.getElementById('edit-stellar').value.trim()
        };
        pbgData.gasGiant = pbgData.gasGiantsCount > 0;
    }

    // GATHER SOCIOECONOMIC DATA (User-editable fields in accordions)
    let mgtSocioInputs = {};
    const mgtCheckEl = document.getElementById('edit-mgt-pvalue');
    if (mgtCheckEl) {
        mgtSocioInputs = {
            pValue: parseInt(document.getElementById('edit-mgt-pvalue').value, 10) || 0,
            pcr: parseInt(document.getElementById('edit-mgt-pcr').value, 10) || 0,
            majorCities: parseInt(document.getElementById('edit-mgt-mcities').value, 10) || 0,
            govProfile: document.getElementById('edit-mgt-gov-profile').value,
            factions: document.getElementById('edit-mgt-fac').value,
            judicialSystemProfile: document.getElementById('edit-mgt-judicial-profile').value,
            lawProfile: document.getElementById('edit-mgt-law-profile').value,
            techProfile: document.getElementById('edit-mgt-tech-profile').value,
            culturalProfile: document.getElementById('edit-mgt-cul-profile').value,
            Im: document.getElementById('edit-mgt-im').value,
            economicProfile: document.getElementById('edit-mgt-eco-profile').value,
            RU: parseInt(document.getElementById('edit-mgt-ru').value, 10) || 0,
            pcGWP: document.getElementById('edit-mgt-gwp').value,
            WTN: document.getElementById('edit-mgt-wtn').value,
            IR: parseInt(document.getElementById('edit-mgt-ir').value, 10) || 0,
            DR: document.getElementById('edit-mgt-dr').value,
            starportProfile: document.getElementById('edit-mgt-starport-profile').value,
            militaryProfile: document.getElementById('edit-mgt-mil-profile').value,
            culturalQuirks: stateObj.mgt2eData ? stateObj.mgt2eData.culturalQuirks : []
        };
        // Update derived population
        mgtSocioInputs.totalWorldPop = mgtSocioInputs.pValue * Math.pow(10, sharedData.pop);
    }

    let t5SocioInputs = {};
    const t5CheckEl = document.getElementById('edit-popm');
    if (t5CheckEl) {
        t5SocioInputs = {
            popMultiplier: parseInt(document.getElementById('edit-popm').value, 10) || 0,
            belts: parseInt(document.getElementById('edit-belts').value, 10) || 0,
            gasGiants: parseInt(document.getElementById('edit-gas-giants').value, 10) || 0,
            worlds: parseInt(document.getElementById('edit-worlds').value, 10) || 0,
            Importance: parseInt(document.getElementById('edit-ix').value, 10) || 0,
            ResourceUnits: parseInt(document.getElementById('edit-ru').value, 10) || 0,
            ecoResources: parseInt(document.getElementById('edit-r').value, 10) || 0,
            ecoLabor: parseInt(document.getElementById('edit-l').value, 10) || 0,
            ecoInfrastructure: parseInt(document.getElementById('edit-i').value, 10) || 0,
            ecoEfficiency: parseInt(document.getElementById('edit-e').value, 10) || 0,
            H: parseInt(document.getElementById('edit-h').value, 10) || 1,
            A: parseInt(document.getElementById('edit-a').value, 10) || 1,
            S: parseInt(document.getElementById('edit-s').value, 10) || 1,
            Sym: parseInt(document.getElementById('edit-sym').value, 10) || 1
        };
        // Aliases and Sync
        t5SocioInputs.Ix = t5SocioInputs.Importance;
        t5SocioInputs.RU = t5SocioInputs.ResourceUnits;
        t5SocioInputs.R = t5SocioInputs.ecoResources;
        t5SocioInputs.L = t5SocioInputs.ecoLabor;
        t5SocioInputs.I = t5SocioInputs.ecoInfrastructure;
        t5SocioInputs.E = t5SocioInputs.ecoEfficiency;
    }

    // --- PERSISTENCE & SYNC (SEAN PROTOCOL) ---
    stateObj.name = name;
    stateObj.allegiance = allegiance;
    stateObj.notes = notes;

    // 1. Update MgT2E Socio Profile (Expansion or Native)
    // CRITICAL: We update this independently so expansions on T5 worlds persist.
    if (stateObj.mgtSocio) {
        Object.assign(stateObj.mgtSocio, sharedData, pbgData, mgtSocioInputs, { name });
    }

    // 2. Update T5 Socio Overlay
    if (stateObj.t5Socio) {
        Object.assign(stateObj.t5Socio, t5SocioInputs);
    }

    // 3. Update Domain-Specific Primary Data Objects
    if (stateObj.t5Data) {
        stateObj.t5Data = { ...stateObj.t5Data, ...sharedData, ...pbgData, ...t5SocioInputs, name };
        if (stateObj.t5System && stateObj.t5System.mainworld) {
            Object.assign(stateObj.t5System.mainworld, sharedData, pbgData, t5SocioInputs, { name });
        }
    } else if (stateObj.mgt2eData) {
        stateObj.mgt2eData = { ...stateObj.mgt2eData, ...sharedData, ...pbgData, ...mgtSocioInputs, name };
        // Ensure mgtSocio points to the primary if it was null
        if (!stateObj.mgtSocio) stateObj.mgtSocio = stateObj.mgt2eData;
    } else if (stateObj.ctData) {
        stateObj.ctData = { ...stateObj.ctData, ...sharedData, ...pbgData, name };
    } else if (stateObj.rttData) {
        stateObj.rttData = { ...stateObj.rttData, ...sharedData, ...pbgData, name };
        // Sync the RTT System mainworld body so the RTT System Details panel reflects edits.
        // RTT body field names differ from sharedData: atmosphere/hydrosphere/population/government/lawLevel.
        if (stateObj.rttSystem) {
            let rttMW = null;
            outer: for (const star of stateObj.rttSystem.stars) {
                if (!star.planetarySystem) continue;
                for (const body of star.planetarySystem.orbits) {
                    if (body.isMainworld || body.habitationType === 'Homeworld') { rttMW = body; break outer; }
                    if (body.satellites) {
                        const sat = body.satellites.find(s => s.isMainworld || s.habitationType === 'Homeworld');
                        if (sat) { rttMW = sat; break outer; }
                    }
                }
            }
            if (rttMW) {
                rttMW.starport    = sharedData.starport;
                rttMW.size        = sharedData.size;
                rttMW.atmosphere  = sharedData.atm;
                rttMW.hydrosphere = sharedData.hydro;
                rttMW.population  = sharedData.pop;
                rttMW.government  = sharedData.gov;
                rttMW.lawLevel    = sharedData.law;
                rttMW.tl          = sharedData.tl;
                rttMW.tradeCodes  = sharedData.tradeCodes;
                rttMW.bases       = sharedData.bases;
                ['starport','size','atmosphere','hydrosphere','population','government','lawLevel','tl'].forEach(f => markManual(rttMW, f));
            }
        }
    }

    // 4. Update internal Mongoose System if present (Multi-layer consistency)
    if (stateObj.mgtSystem) {
        let mw = stateObj.mgtSystem.worlds.find(w => w.type === 'Mainworld' || w.type === 'Main World') || stateObj.mgtSystem.worlds[0];
        if (mw) Object.assign(mw, sharedData, pbgData, mgtSocioInputs, { name });
    }

    // Re-derive system counts if PBG was edited explicitly
    if (pbgData.planetoidBelts !== undefined) stateObj.beltCount     = pbgData.planetoidBelts;
    if (pbgData.gasGiantsCount !== undefined) stateObj.gasGiantCount = pbgData.gasGiantsCount;

    hexStates.set(editingHexId, stateObj);

    requestAnimationFrame(draw);

    // Sean Protocol: Sync Rule Engine and Filters with modified world data
    if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
    if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

    // Refresh the UI to reflect changes (and Keep Window Open as requested)
    populateEditorAccordions(stateObj);

    // Provide visual feedback that save occurred
    if (typeof showToast === 'function') {
        showToast("Changes saved successfully.", 2500);
    }

    // Optional: Update the "Cancel" button to "Close" if saved?
    // For now we just stay open.
}

// =============================================================================
// RTT SYSTEM TREE — INLINE EDIT EVENT DELEGATION
// Listens on the persistent root container; survives innerHTML re-renders.
// =============================================================================
(function () {
    const root = document.getElementById('editor-rtt-system-root');
    if (!root) return;

    root.addEventListener('change', function (e) {
        const el = e.target;
        const field = el.dataset.rttField;
        if (!field) return;

        if (typeof editingHexId === 'undefined' || !editingHexId) return;
        const stateObj = hexStates.get(editingHexId);
        if (!stateObj || !stateObj.rttSystem) return;
        const sys = stateObj.rttSystem;

        const level = el.dataset.rttLevel;

        if (level === 'system') {
            // System-level field (e.g. age)
            const val = parseFloat(el.value);
            if (isNaN(val)) return;
            sys[field] = val;
            markManual(sys, field);

        } else if (level === 'star') {
            // Star-level field (e.g. classification)
            const sIdx = parseInt(el.dataset.rttSidx, 10);
            const star = sys.stars[sIdx];
            if (!star) return;
            star[field] = el.value.trim();
            markManual(star, field);

        } else {
            // Body-level field (orbit or satellite)
            const sIdx   = parseInt(el.dataset.rttSidx,   10);
            const oIdx   = parseInt(el.dataset.rttOidx,   10);
            const satIdx = parseInt(el.dataset.rttSatidx, 10);

            const star = sys.stars[sIdx];
            if (!star || !star.planetarySystem) return;
            const orbit = star.planetarySystem.orbits[oIdx];
            if (!orbit) return;

            const body = (satIdx >= 0) ? orbit.satellites[satIdx] : orbit;
            if (!body) return;

            // Name — empty value resets to auto-generated default (don't store)
            if (field === 'name') {
                const trimmed = el.value.trim();
                if (trimmed) {
                    body.name = trimmed;
                    markManual(body, 'name');
                    el.classList.add('is-manual');
                } else {
                    delete body.name;
                    if (Array.isArray(body._manualFields)) {
                        body._manualFields = body._manualFields.filter(f => f !== 'name');
                    }
                    el.classList.remove('is-manual');
                }
                hexStates.set(editingHexId, stateObj);
                return;
            }

            // UWP compact string — parse all eight UWP fields at once
            if (field === 'uwp') {
                const raw = el.value.trim().toUpperCase().replace(/\s/g, '');
                if (raw.length >= 9 && raw[7] === '-') {
                    const pc = c => { const n = parseInt(c, 10); return isNaN(n) ? c : n; };
                    body.starport    = raw[0];
                    body.size        = pc(raw[1]);
                    body.atmosphere  = pc(raw[2]);
                    body.hydrosphere = pc(raw[3]);
                    body.population  = pc(raw[4]);
                    body.government  = pc(raw[5]);
                    body.lawLevel    = pc(raw[6]);
                    body.tl          = parseInt(raw.slice(8), 10) || 0;
                    ['starport','size','atmosphere','hydrosphere','population','government','lawLevel','tl'].forEach(f => markManual(body, f));
                }
                hexStates.set(editingHexId, stateObj);
                el.classList.add('is-manual');
                return;
            }

            // Parse value by field type
            let val;
            if (field === 'tradeCodes' || field === 'bases') {
                val = el.value.trim() ? el.value.trim().split(/\s+/) : [];
            } else if (['biosphere', 'desirability', 'industry', 'terraformPoints',
                        'population', 'government', 'lawLevel', 'tl'].includes(field)) {
                val = parseInt(el.value, 10);
                if (isNaN(val)) return;
            } else if (['size', 'atmosphere', 'hydrosphere'].includes(field)) {
                // Smart-parse: store as number if the user typed a digit, else uppercase string (e.g. 'A', 'G', 'F')
                const s = el.value.trim().toUpperCase();
                const n = parseInt(s, 10);
                val = isNaN(n) ? s : n;
            } else {
                val = el.value;
            }

            body[field] = val;
            markManual(body, field);
        }

        hexStates.set(editingHexId, stateObj);

        // Highlight the changed element as manual immediately (no full re-render needed)
        el.classList.add('is-manual');
    });
}());

// =============================================================================
// CT SYSTEM TREE — INLINE EDIT EVENT DELEGATION
// Listens on the persistent root container; survives innerHTML re-renders.
// =============================================================================
(function () {
    const root = document.getElementById('editor-ct-system-root');
    if (!root) return;

    root.addEventListener('change', function (e) {
        const el = e.target;
        const field = el.dataset.ctField;
        if (!field) return;

        if (typeof editingHexId === 'undefined' || !editingHexId) return;
        const stateObj = hexStates.get(editingHexId);
        if (!stateObj || !stateObj.ctSystem) return;
        const sys = stateObj.ctSystem;

        // ── Star fields (data-ct-sidx present, no data-ct-orbit) ─────────────
        if (el.dataset.ctSidx !== undefined) {
            const star = sys.stars[parseInt(el.dataset.ctSidx, 10)];
            if (!star) return;
            if (field === 'mass' || field === 'luminosity') {
                const val = parseFloat(el.value);
                if (isNaN(val)) return;
                star[field] = val;
            } else {
                star[field] = el.value.trim();
            }
            markManual(star, field);
            hexStates.set(editingHexId, stateObj);
            el.classList.add('is-manual');
            return;
        }

        // ── Resolve body/satellite ────────────────────────────────────────────
        const orbitVal   = parseFloat(el.dataset.ctOrbit);
        const isCaptured = el.dataset.ctCaptured === 'true';
        const satIdx     = parseInt(el.dataset.ctSatidx, 10);

        let body = null;
        if (!isNaN(orbitVal)) {
            if (isCaptured) {
                body = (sys.capturedPlanets || []).find(p => p.orbit === orbitVal);
            } else {
                const orbitEntry = sys.orbits.find(o => o.orbit === orbitVal);
                body = orbitEntry ? orbitEntry.contents : null;
            }
            if (satIdx >= 0 && body) body = body.satellites[satIdx];
        }
        if (!body) return;

        // ── Name ─────────────────────────────────────────────────────────────
        if (field === 'name') {
            const trimmed = el.value.trim();
            if (trimmed) {
                body.name = trimmed;
                markManual(body, 'name');
                el.classList.add('is-manual');
            } else {
                delete body.name;
                if (Array.isArray(body._manualFields)) {
                    body._manualFields = body._manualFields.filter(f => f !== 'name');
                }
                el.classList.remove('is-manual');
            }
            hexStates.set(editingHexId, stateObj);
            return;
        }

        // ── UWP compact string — parse all eight digits at once ───────────────
        if (field === 'uwp') {
            const raw = el.value.trim().toUpperCase().replace(/\s/g, '');
            if (raw.length >= 9 && raw[7] === '-') {
                // Traveller UWP digits are hex (0-9, A-F); TL can also be hex
                const ph = c => { const n = parseInt(c, 16); return isNaN(n) ? c : n; };
                body.starport = raw[0];
                body.size     = ph(raw[1]);
                body.atm      = ph(raw[2]);
                body.hydro    = ph(raw[3]);
                body.pop      = ph(raw[4]);
                body.gov      = ph(raw[5]);
                body.law      = ph(raw[6]);
                body.tl       = ph(raw[8]) !== raw[8] ? ph(raw[8]) : (parseInt(raw.slice(8), 16) || 0);
                ['starport','size','atm','hydro','pop','gov','law','tl'].forEach(f => markManual(body, f));
                // Rebuild the uwpSecondary string so the summary stays current on next render
                body.uwpSecondary = raw;
            }
            hexStates.set(editingHexId, stateObj);
            el.classList.add('is-manual');
            return;
        }

        // ── Array fields ──────────────────────────────────────────────────────
        if (field === 'tradeCodes' || field === 'bases') {
            body[field] = el.value.trim() ? el.value.trim().split(/\s+/) : [];
            markManual(body, field);
            hexStates.set(editingHexId, stateObj);
            el.classList.add('is-manual');
            return;
        }

        // ── Text fields ───────────────────────────────────────────────────────
        if (field === 'rotationPeriod') {
            body[field] = el.value.trim();
            markManual(body, field);
            hexStates.set(editingHexId, stateObj);
            el.classList.add('is-manual');
            return;
        }

        // ── Numeric fields ────────────────────────────────────────────────────
        const _numericFields = ['distAU','orbitalPeriod','diamKm','gravity','mass','temperature','axialTilt'];
        if (_numericFields.includes(field)) {
            const val = parseFloat(el.value);
            if (isNaN(val)) return;
            body[field] = val;
            markManual(body, field);
            hexStates.set(editingHexId, stateObj);
            el.classList.add('is-manual');
            return;
        }
    });
}());