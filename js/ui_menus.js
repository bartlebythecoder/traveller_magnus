// ============================================================================
// UI_MENUS.JS - Context Menu & Settings Panel Handlers
// ============================================================================

// ============================================================================
// CONTEXT MENU HANDLERS
// ============================================================================

function setupContextMenu() {
    document.getElementById('ctx-manual-empty').addEventListener('click', () => {
        if (!validateSelection('populate')) return;
        saveHistoryState('Manual: Set Empty');
        selectedHexes.forEach(hexId => {
            hexStates.set(hexId, { type: 'EMPTY' });
        });
        document.getElementById('context-menu').classList.remove('visible');
        
        // Sean Protocol: Sync Rule Engine and Filters
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-manual-system').addEventListener('click', () => {
        if (!validateSelection('populate')) return;
        saveHistoryState('Manual: Populate System');
        selectedHexes.forEach(hexId => {
            hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
        });
        document.getElementById('context-menu').classList.remove('visible');
        
        // Sean Protocol: Sync Rule Engine and Filters
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-manual-clear').addEventListener('click', () => {
        if (!validateSelection('clear')) return;
        saveHistoryState('Batch Clear');
        selectedHexes.forEach(hexId => {
            hexStates.delete(hexId);
            removeRoutesForHex(hexId);
        });
        document.getElementById('context-menu').classList.remove('visible');
        
        // Sean Protocol: Sync Rule Engine and Filters
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        showToast(`Cleared ${selectedHexes.size} hex(es) and connected routes.`, 2000);
        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    function removeRoutesForHex(hexId) {
        if (!window.sectorRoutes) return;
        window.sectorRoutes = window.sectorRoutes.filter(r => r.startId !== hexId && r.endId !== hexId);
    }

    document.getElementById('ctx-sparse').addEventListener('click', () => autoPopulate(2));
    document.getElementById('ctx-regular').addEventListener('click', () => autoPopulate(3));
    document.getElementById('ctx-dense').addEventListener('click', () => autoPopulate(4));

    document.getElementById('ctx-select-hex').addEventListener('click', toggleSingleHex);
    document.getElementById('ctx-select-subsector').addEventListener('click', toggleSubsectorHexes);
    document.getElementById('ctx-select-sector').addEventListener('click', toggleSectorHexes);
    document.getElementById('ctx-deselect-all').addEventListener('click', deselectAllHexes);
    document.getElementById('ctx-help').addEventListener('click', openHelpModal);

    // --- Assign Allegiance ---
    function getEligibleForAllegiance() {
        return [...selectedHexes]; // All selected hexes are eligible (BLANK, EMPTY, SYSTEM_PRESENT)
    }

    function confirmAllegiance() {
        const val = document.getElementById('allegiance-input').value.trim() || '----';
        const eligible = getEligibleForAllegiance();
        saveHistoryState('Assign Allegiance');
        eligible.forEach(hexId => {
            let s = hexStates.get(hexId);
            if (!s) {
                s = { type: 'BLANK' };
                hexStates.set(hexId, s);
            }
            s.allegiance = val;
        });
        document.getElementById('allegiance-modal').style.display = 'none';
        showToast(`Allegiance "${val}" assigned to ${eligible.length} system(s).`, 2500);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();
    }

    document.getElementById('ctx-assign-allegiance').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        const eligible = getEligibleForAllegiance();
        if (eligible.length === 0) {
            showToast('No systems in selection to assign allegiance to.', 2500);
            return;
        }
        document.getElementById('allegiance-modal-count').textContent = eligible.length;
        document.getElementById('allegiance-input').value = '';
        document.getElementById('allegiance-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('allegiance-input').focus(), 50);
    });

    document.getElementById('btn-allegiance-confirm').addEventListener('click', confirmAllegiance);

    document.getElementById('btn-allegiance-cancel').addEventListener('click', () => {
        document.getElementById('allegiance-modal').style.display = 'none';
    });

    document.getElementById('allegiance-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmAllegiance();
        if (e.key === 'Escape') document.getElementById('allegiance-modal').style.display = 'none';
    });

    // --- Assign Background Color ---
    function openBgColorModal() {
        document.getElementById('context-menu').classList.remove('visible');
        const hexList = [...selectedHexes];
        if (hexList.length === 0) {
            showToast('No hexes selected.', 2000);
            return;
        }
        document.getElementById('bg-color-modal-count').textContent = hexList.length;

        // Pre-populate picker with the first selected hex's existing color, or a default
        const firstState = hexStates.get(hexList[0]);
        const existingColor = (firstState && firstState.manualBgColor) ? firstState.manualBgColor : '#4466aa';
        document.getElementById('bg-color-picker').value = existingColor;

        document.getElementById('bg-color-modal').style.display = 'flex';
    }

    function applyBgColor() {
        const color = document.getElementById('bg-color-picker').value;
        const hexList = [...selectedHexes];
        saveHistoryState('Assign Background Color');
        hexList.forEach(hexId => {
            let s = hexStates.get(hexId);
            if (!s) {
                s = { type: 'BLANK' };
                hexStates.set(hexId, s);
            }
            s.manualBgColor = color;
        });
        document.getElementById('bg-color-modal').style.display = 'none';
        showToast(`Background color applied to ${hexList.length} hex(es).`, 2000);
        requestAnimationFrame(draw);
    }

    function clearBgColor() {
        const hexList = [...selectedHexes];
        saveHistoryState('Clear Background Color');
        hexList.forEach(hexId => {
            const s = hexStates.get(hexId);
            if (s) delete s.manualBgColor;
        });
        document.getElementById('bg-color-modal').style.display = 'none';
        showToast(`Background color cleared from ${hexList.length} hex(es).`, 2000);
        requestAnimationFrame(draw);
    }

    document.getElementById('ctx-assign-bg-color').addEventListener('click', openBgColorModal);
    document.getElementById('btn-bg-color-apply').addEventListener('click', applyBgColor);
    document.getElementById('btn-bg-color-clear').addEventListener('click', clearBgColor);
    document.getElementById('btn-bg-color-cancel').addEventListener('click', () => {
        document.getElementById('bg-color-modal').style.display = 'none';
    });

    // Generation handlers are defined in the engine files but triggered here
    setupGenerationHandlers();
}

function setupGenerationHandlers() {
    // CT Generation
    document.getElementById('ctx-gen-ct').addEventListener('click', async () => {
        if (!validateSelection('generate')) return;
        saveHistoryState('Generate CT Mainworld');
        await ensureNamesLoaded();
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') stateObj = { type: stateObj };

            if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                if (window.CT_World_Engine) {
                    stateObj.ctData = window.CT_World_Engine.generateModularMainworld(hexId);
                } else {
                    console.error("CT World Engine not found.");
                }
                stateObj.mgt2eData = null;
                stateObj.t5Data = null;
                stateObj.mgtSystem = null;
                stateObj.t5System = null;
                stateObj.ctSystem = null;
                stateObj.mgtPhysical = null;
                stateObj.t5Physical = null;
                hexStates.set(hexId, stateObj);
                count++;
            }
        });
        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('CT_Mainworlds', count);
        }

        // v0.6.1.0: Individual System Audit to console
        if (count > 0 && typeof StatisticalAuditor !== 'undefined') {
            const auditor = new StatisticalAuditor('ct', true);
            selectedHexes.forEach(hexId => {
                const s = hexStates.get(hexId);
                if (s && s.ctData) {
                    auditor.recordSystem({
                        stars: 1, // Mainworld only context
                        isMoonMainworld: !!(s.ctData.isLunarMainworld || s.ctData.isMoon),
                        size: s.ctData.size || 0,
                        atmosphere: s.ctData.atm || 0,
                        hydrosphere: s.ctData.hydro || 0,
                        population: s.ctData.pop || 0,
                        starport: s.ctData.starport || 'X',
                        techLevel: s.ctData.tl || 0
                    });
                }
            });
            auditor.generateDeviationReport();
        }
        document.getElementById('context-menu').classList.remove('visible');
        if (count > 0) {
            showToast(`Generated Classic Traveller Mainworlds for ${count} hex(es)`);
            
            // Sean Protocol: Sync Rule Engine and Filters with new data
            if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${count} newly generated systems.`);
            if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
            if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();
        } else {
            showToast("No populated hexes selected");
        }
        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    // MgT2E Generation
    document.getElementById('ctx-gen-mgt2e').addEventListener('click', async () => {
        if (!validateSelection('generate')) return;
        saveHistoryState('Generate MgT2E Mainworld');
        await ensureNamesLoaded();
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') stateObj = { type: stateObj };

            if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                try {
                    if (typeof reseedForHex === 'function') reseedForHex(hexId);
                    if (window.isLoggingEnabled && typeof startTrace === 'function') startTrace(hexId, 'MgT2E Mainworld');

                    // Use modularized UWP generation for single world
                    stateObj.mgt2eData = MgT2ESocioEngine.generateMainworldUWP(hexId);
                    stateObj.name = stateObj.mgt2eData.name;

                    // --- AUDIT: Mainworld Only ---
                    if (typeof MgT2E_UWP_Auditor !== 'undefined') {
                        const tempSys = { worlds: [stateObj.mgt2eData], hexId: hexId };
                        MgT2E_UWP_Auditor.auditMgT2ESystem(tempSys, { mode: 'mainworld-only' });
                    }

                    if (window.isLoggingEnabled && typeof endTrace === 'function') endTrace();

                    // Clear artifacts of full system generation to prevent "ghost" accordions
                    stateObj.mgtSystem = null;
                    stateObj.mgtSocio = null;

                    // Clear other engine data
                    stateObj.ctData = null;
                    stateObj.t5Data = null;
                    stateObj.ctSystem = null;
                    stateObj.t5System = null;
                    stateObj.ctPhysical = null;
                    stateObj.t5Physical = null;
                    stateObj.t5Socio = null;

                    hexStates.set(hexId, stateObj);
                    count++;
                } catch (err) {
                    console.error(`MgT2E generation failed for ${hexId}:`, err);
                }
            }
        });
        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Mainworlds', count);
        }

        // v0.6.1.0: Individual System Audit to console
        if (count > 0 && typeof StatisticalAuditor !== 'undefined') {
            const auditor = new StatisticalAuditor('mgt2e', true);
            selectedHexes.forEach(hexId => {
                const s = hexStates.get(hexId);
                if (s && s.mgt2eData) {
                    const mw = s.mgt2eData;
                    auditor.recordSystem({
                        stars: 1, 
                        isMoonMainworld: !!(mw.isLunarMainworld || mw.isMoon),
                        size: mw.size || 0,
                        atmosphere: mw.atmCode !== undefined ? mw.atmCode : (mw.atm || 0),
                        hydrosphere: mw.hydroCode !== undefined ? mw.hydroCode : (mw.hydro || 0),
                        population: mw.popCode !== undefined ? mw.popCode : (mw.pop || 0),
                        starport: mw.starport || 'X',
                        techLevel: mw.tl || 0
                    });
                }
            });
            auditor.generateDeviationReport();
        }
        document.getElementById('context-menu').classList.remove('visible');
        if (count > 0) {
            showToast(`Generated MgT2E Mainworlds for ${count} hex(es)`);
            
            // Sean Protocol: Sync Rule Engine and Filters with new data
            if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${count} newly generated systems.`);
            if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
            if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();
        } else {
            showToast("No populated hexes selected");
        }
        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    // T5 Generation
    document.getElementById('ctx-gen-t5').addEventListener('click', async () => {
        if (!validateSelection('generate')) return;
        saveHistoryState('Generate T5 Mainworld');
        await ensureNamesLoaded();
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (typeof stateObj === 'string') stateObj = { type: stateObj };

            if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                if (window.T5_World_Engine) {
                    stateObj.t5Data = window.T5_World_Engine.generateT5Mainworld(hexId);
                } else {
                    // Fallback to legacy if necessary, but modular should be preferred
                    stateObj.t5Data = typeof generateT5Mainworld === 'function' ? generateT5Mainworld(hexId) : null;
                }
                // FIX: Assign name to the generated T5 mainworld
                stateObj.name = getNextSystemName(hexId);
                if (stateObj.t5Data) stateObj.t5Data.name = stateObj.name;

                stateObj.ctData = null;
                stateObj.mgt2eData = null;
                stateObj.ctSystem = null;
                stateObj.mgtSystem = null;
                stateObj.ctPhysical = null;
                stateObj.mgtPhysical = null;
                hexStates.set(hexId, stateObj);
                count++;
            }
        });
        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Mainworlds', count);
        }

        // v0.6.1.0: Individual System Audit to console
        if (count > 0 && typeof StatisticalAuditor !== 'undefined') {
            const auditor = new StatisticalAuditor('t5', true);
            selectedHexes.forEach(hexId => {
                const s = hexStates.get(hexId);
                if (s && s.t5Data) {
                    const mw = s.t5Data;
                    auditor.recordSystem({
                        stars: 1,
                        isMoonMainworld: !!(mw.isLunarMainworld || mw.isMoon),
                        size: mw.size || 0,
                        atmosphere: mw.atmCode !== undefined ? mw.atmCode : (mw.atm || 0),
                        hydrosphere: mw.hydroCode !== undefined ? mw.hydroCode : (mw.hydro || 0),
                        population: mw.popCode !== undefined ? mw.popCode : (mw.pop || 0),
                        starport: mw.starport || 'X',
                        techLevel: mw.tl || 0
                    });
                }
            });
            auditor.generateDeviationReport();
        }
        document.getElementById('context-menu').classList.remove('visible');
        if (count > 0) {
            showToast(`Generated T5 Mainworlds for ${count} hex(es)`);
            
            // Sean Protocol: Sync Rule Engine and Filters with new data
            if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${count} newly generated systems.`);
            if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
            if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();
        } else {
            showToast("No populated hexes selected");
        }
        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    // Socioeconomics
    document.getElementById('ctx-expand-socio-t5').addEventListener('click', () => {
        if (!validateSelection('socio')) return;

        saveHistoryState('Expand T5 Socioeconomics');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = null;
            if (stateObj) {
                baseData = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;
            }

            if (baseData) {
                if (window.T5_Socio_Engine) {
                    stateObj.t5Socio = window.T5_Socio_Engine.generateT5Socioeconomics(baseData, hexId);
                } else {
                    stateObj.t5Socio = typeof generateT5Socioeconomics === 'function' ? generateT5Socioeconomics(baseData, hexId) : null;
                }
                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Socio', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded T5 Socioeconomics for ${selectedHexes.size} hex(es)`);

        // Sean Protocol: Sync Rule Engine and Filters with updated socio data
        if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${selectedHexes.size} updated systems (Socio Expansion).`);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-expand-socio-mgt2e').addEventListener('click', () => {
        if (!validateSelection('socio')) return;

        saveHistoryState('Expand MgT2E Socioeconomics');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = null;
            if (stateObj) {
                baseData = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;
            }

            if (baseData) {
                // 1. Generate the full system deterministically to guarantee all social profiles exist
                let newSys = generateMgT2ESystemTopDown(hexId, baseData);

                // 2. Find the mainworld to map the socio data (Recursive to handle Lunar Mainworlds)
                let mainworld = null;
                const findMW = (wList) => {
                    for (let w of wList) {
                        if (w.type === 'Mainworld' || w.isLunarMainworld) { mainworld = w; return true; }
                        if (w.moons && findMW(w.moons)) return true;
                    }
                    return false;
                };
                findMW(newSys.worlds);
                if (!mainworld) mainworld = newSys.worlds[0];

                // Sean Protocol: Propagate gasGiant flag to Lunar Mainworlds so the renderer
                // can display the ringed GG icon correctly from stateObj.mgt2eData.
                if (mainworld && mainworld.isLunarMainworld) {
                    mainworld.gasGiant = newSys.gasGiants > 0;
                } else if (mainworld) {
                    mainworld.gasGiant = mainworld.gasGiant || (newSys.gasGiants > 0);
                }

                // 3. Map the data back to stateObj
                stateObj.mgtSystem = newSys; // Keep physical data in sync
                stateObj.mgt2eData = mainworld;
                stateObj.mgtSocio = mainworld; // The new engine puts socio data directly on the world object

                // 4. Clear UI ghosting variables
                stateObj.t5Socio = null;

                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Socio', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded MgT2E Socioeconomics for ${selectedHexes.size} hex(es)`);
        
        // Sean Protocol: Sync Rule Engine and Filters with updated socio data
        if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${selectedHexes.size} updated systems (Socio Expansion).`);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-expand-socio-mgt2e-dev').addEventListener('click', () => {
        if (!validateSelection('socio')) return;

        saveHistoryState('Expand MgT2E Socioeconomics (Dev)');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingSystem = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            if (stateObj && stateObj.mgtSystem) {
                // Call the new non-regenerative orchestrator
                if (typeof expandLoadedSocioeconomicsMgT2E === 'function') {
                    let newSys = expandLoadedSocioeconomicsMgT2E(hexId, stateObj);
                    if (newSys) {
                        let mainworld = null;
                        const findMW = (wList) => {
                            for (let w of wList) {
                                if (w.type === 'Mainworld' || w.isLunarMainworld) { mainworld = w; return true; }
                                if (w.moons && findMW(w.moons)) return true;
                            }
                            return false;
                        };
                        findMW(newSys.worlds);
                        if (!mainworld) mainworld = newSys.worlds[0];

                        // Sean Protocol: Propagate gasGiant flag to Lunar Mainworlds.
                        // The renderer reads stateObj.mgt2eData for the ringed GG icon.
                        if (mainworld && mainworld.isLunarMainworld) {
                            mainworld.gasGiant = newSys.gasGiants > 0;
                        } else if (mainworld) {
                            mainworld.gasGiant = mainworld.gasGiant || (newSys.gasGiants > 0);
                        }

                        stateObj.mgtSystem = newSys;
                        stateObj.mgt2eData = mainworld;
                        stateObj.mgtSocio = mainworld;
                        hexStates.set(hexId, stateObj);
                    } else {
                        console.error(`[UI] DEV expansion returned null for ${hexId} - no newSys!`);
                    }
                }
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingSystem = true;
            }
        });

        if (missingSystem) {
            alert("Note: Some selected hexes skipped because they do not have an MgT2E System generated. This Dev expansion requires an existing System object.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Socio_Dev', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`[DEV] Expanded Socioeconomics for ${selectedHexes.size} hex(es) (No Regen)`);
        
        // Sean Protocol: Sync Rule Engine and Filters with updated socio data
        if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${selectedHexes.size} updated systems (Socio Expansion).`);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);

        // Auto-refresh the hex editor if it is currently open
        if (typeof editingHexId !== 'undefined' && editingHexId && selectedHexes.has(editingHexId)) {
            if (typeof openHexEditor === 'function') {
                openHexEditor(editingHexId);
            }
        }
    });

    // Physical System Expansion
    document.getElementById('ctx-expand-physical-ct').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        saveHistoryState('Expand CT System');
        let missingData = false;

        if (window.isLoggingEnabled) window.batchLogData = [];

        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = stateObj ? (stateObj.ctData || stateObj.mgt2eData || stateObj.t5Data) : null;

            if (baseData) {
                if (window.CT_Generator) {
                    const sys = window.CT_Generator.generateSystem({
                        mode: 'top-down',
                        mainworldUWP: baseData,
                        hexId: hexId
                    });
                    stateObj.ctSystem = sys;
                    if (sys && sys.mainworld) stateObj.ctData = sys.mainworld; // Sync post-expansion mainworld (lunar flags, gasGiant, etc.)
                }

                stateObj.t5Physical = null;
                stateObj.ctPhysical = null;
                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData && window.batchLogData.length > 0) {
            downloadBatchLog('CT_Systems', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded CT System for ${selectedHexes.size} hex(es)`);
        
        // Sean Protocol: Sync Rule Engine and Filters with updated physical data
        if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${selectedHexes.size} updated systems (Physical Expansion).`);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });


    document.getElementById('ctx-expand-physical-mgt2e').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        saveHistoryState('Expand MgT2E System');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = stateObj ? (stateObj.mgt2eData || stateObj.t5Data || stateObj.ctData || stateObj.rttData) : null;

            if (baseData) {
                // 1. Call the new Orchestrator
                let newSys = generateMgT2ESystemTopDown(hexId, baseData);

                // 2. Map the data back to stateObj
                stateObj.mgtSystem = newSys;

                // Find the mainworld to map the UWP (Recursive to handle Lunar Mainworlds)
                let mainworld = null;
                const findMW = (wList) => {
                    for (let w of wList) {
                        if (w.type === 'Mainworld' || w.isLunarMainworld) { mainworld = w; return true; }
                        if (w.moons && findMW(w.moons)) return true;
                    }
                    return false;
                };
                findMW(newSys.worlds);
                if (!mainworld) mainworld = newSys.worlds[0];

                // Sean Protocol: Propagate gasGiant flag to Lunar Mainworlds.
                // The renderer reads stateObj.mgt2eData for the ringed GG icon check.
                // If the mainworld is a moon, it lives inside a parent Gas Giant but
                // the gasGiant flag is only on that parent object. We surface it here.
                if (mainworld && mainworld.isLunarMainworld) {
                    mainworld.gasGiant = newSys.gasGiants > 0;
                    if (window.isLoggingEnabled && typeof writeLogLine === 'function') {
                        writeLogLine(`[EXPAND MW] Hex ${hexId}: Lunar Mainworld detected. Propagating gasGiant=${mainworld.gasGiant} flag to UI state.`);
                    }
                } else if (mainworld) {
                    // Standard mainworld: gasGiant flag from sys-level count
                    mainworld.gasGiant = mainworld.gasGiant || (newSys.gasGiants > 0);
                }
                
                stateObj.mgt2eData = mainworld;

                // 3. Clear UI ghosting variables
                stateObj.t5Physical = null;
                stateObj.ctPhysical = null;

                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have Mainworld data generated yet.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Systems', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded MgT2E Physical system for ${selectedHexes.size} hex(es)`);
        
        // Sean Protocol: Sync Rule Engine and Filters with updated physical data
        if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${selectedHexes.size} updated systems (Physical Expansion).`);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    document.getElementById('ctx-expand-physical-t5').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        saveHistoryState('Expand T5 System');
        if (window.isLoggingEnabled) window.batchLogData = [];
        let missingData = false;
        selectedHexes.forEach(hexId => {
            let stateObj = hexStates.get(hexId);
            let baseData = null;
            if (stateObj) {
                baseData = stateObj.t5Data || stateObj.mgt2eData || stateObj.ctData;
            }

            if (baseData) {
                let sys = null;
                if (window.T5_TopDown_Generator) {
                    sys = window.T5_TopDown_Generator.generateT5System(baseData);
                } else {
                    // Fallback to old chunked generation if global exists
                    sys = generateT5SystemChunk1(baseData, stateObj.t5System, hexId);
                    sys = generateT5SystemChunk2(sys, baseData);
                    sys = generateT5SystemChunk3(sys, baseData);
                }
                stateObj.t5System = sys;
                stateObj.t5Physical = null; // Clean up old physical object if it exists
                stateObj.ctPhysical = null;
                hexStates.set(hexId, stateObj);
            } else if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                missingData = true;
            }
        });

        if (missingData) {
            alert("Note: Some selected hexes skipped because they do not have any Mainworld data generated yet. You must run a GENERATE MAINWORLD function first.");
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Systems', selectedHexes.size);
        }

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Expanded T5 Physical system for ${selectedHexes.size} hex(es)`);
        
        // Sean Protocol: Sync Rule Engine and Filters with updated physical data
        if (typeof writeLogLine === 'function') writeLogLine(`Refreshing rules for ${selectedHexes.size} updated systems (Physical Expansion).`);
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    // X-Boat Routes — open options modal
    document.getElementById('ctx-gen-xboat').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        document.getElementById('xboat-max-jump').value = 4;
        document.getElementById('xboat-max-range').value = 12;
        document.getElementById('xboat-modal').style.display = 'flex';
    });

    document.getElementById('btn-xboat-confirm').addEventListener('click', () => {
        const maxJump  = Math.min(8,  Math.max(1,  parseInt(document.getElementById('xboat-max-jump').value,  10) || 4));
        const maxRange = Math.min(32, Math.max(1,  parseInt(document.getElementById('xboat-max-range').value, 10) || 4));
        document.getElementById('xboat-modal').style.display = 'none';
        saveHistoryState('Generate Xboat Routes');
        generateXboatRoutes(maxJump, maxRange);
        const routeCount = window.sectorRoutes ? window.sectorRoutes.length : 0;
        showToast(`Interstellar Network Generated (Jump-${maxJump}, Range-${maxRange}): ${routeCount} routes.`, 3000);
        selectedHexes.clear();
        requestAnimationFrame(draw);
    });

    document.getElementById('btn-xboat-clear').addEventListener('click', () => {
        const routes = window.sectorRoutes || [];
        const list = document.getElementById('clear-routes-list');
        list.innerHTML = '';

        // Static route types
        const staticTypes = [
            { type: 'Xboat',     label: 'Xboat Routes',     color: '#00FF00' },
            { type: 'Trade',     label: 'Trade Routes',     color: '#FF0000' },
            { type: 'Secondary', label: 'Secondary Routes', color: '#FFFF00' },
        ];
        staticTypes.forEach(({ type, label, color }) => {
            const count = routes.filter(r => r.type === type).length;
            if (count === 0) return;
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-bottom:1px solid #1f2833;';
            row.innerHTML = `
                <input type="checkbox" data-cleartype="static" data-routetype="${type}"
                    style="cursor:pointer;accent-color:#66fcf1;flex-shrink:0;">
                <span style="display:inline-block;width:16px;height:16px;border-radius:3px;
                    background:${color};flex-shrink:0;border:1px solid rgba(255,255,255,0.25);"></span>
                <span style="color:#c5c6c7;font-size:0.9rem;flex:1;">${label}</span>
                <span style="color:#666;font-size:0.8rem;white-space:nowrap;">${count} segment(s)</span>
            `;
            list.appendChild(row);
        });

        // Auto Route / Point-to-Point groups
        getAutoRouteGroups().forEach(g => {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-bottom:1px solid #1f2833;';
            row.innerHTML = `
                <input type="checkbox" data-cleartype="group" data-groupid="${g.groupId}"
                    style="cursor:pointer;accent-color:#66fcf1;flex-shrink:0;">
                <span style="display:inline-block;width:16px;height:16px;border-radius:3px;
                    background:${g.color};flex-shrink:0;border:1px solid rgba(255,255,255,0.25);"></span>
                <span style="color:#c5c6c7;font-size:0.9rem;flex:1;">${g.name}</span>
                <span style="color:#666;font-size:0.8rem;white-space:nowrap;">${g.count} segment(s)</span>
            `;
            list.appendChild(row);
        });

        if (list.children.length === 0) {
            showToast('No routes to clear.', 2000);
            return;
        }

        document.getElementById('xboat-modal').style.display = 'none';
        document.getElementById('clear-routes-modal').style.display = 'flex';
    });

    document.getElementById('btn-clear-routes-confirm').addEventListener('click', () => {
        const checked = [...document.querySelectorAll('#clear-routes-list input[type="checkbox"]:checked')];
        if (checked.length === 0) { showToast('No sets selected.', 2000); return; }

        saveHistoryState('Clear Routes');
        checked.forEach(cb => {
            if (cb.dataset.cleartype === 'static') {
                const type = cb.dataset.routetype;
                window.sectorRoutes = window.sectorRoutes.filter(r => r.type !== type);
            } else if (cb.dataset.cleartype === 'group') {
                clearAutoRouteGroup(cb.dataset.groupid);
            }
        });

        document.getElementById('clear-routes-modal').style.display = 'none';
        showToast(`Removed ${checked.length} route set(s).`, 2500);
        if (window.dbManager) window.dbManager.saveRoutes();
        requestAnimationFrame(draw);
    });

    document.getElementById('btn-clear-routes-cancel').addEventListener('click', () => {
        document.getElementById('clear-routes-modal').style.display = 'none';
    });

    document.getElementById('btn-xboat-cancel').addEventListener('click', () => {
        document.getElementById('xboat-modal').style.display = 'none';
    });

    // New GENERATE SYSTEM Row Handlers (Continuation Macros - Skip Pop)
    document.getElementById('ctx-gen-sys-ct').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runCTNewMacro(true);
    });

    document.getElementById('ctx-gen-sys-mgt2e').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runMgT2EMacro(true);
    });

    document.getElementById('ctx-gen-sys-t5').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runT5Macro(true);
    });

    document.getElementById('ctx-gen-sys-mgt2e-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runMgT2EBottomUpMacro(true);
    });

    document.getElementById('ctx-gen-sys-ct-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runCTBottomUpMacro(true);
    });

    document.getElementById('ctx-gen-sys-rtt-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runRTTMacro(true);
    });

    // POPULATE & GENERATE FULL SYSTEM Row Handlers (Macros - Include Pop)
    document.getElementById('ctx-full-ct').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runCTNewMacro(false);
    });

    document.getElementById('ctx-full-mgt2e').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runMgT2EMacro(false);
    });

    document.getElementById('ctx-full-t5').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runT5Macro(false);
    });

    document.getElementById('ctx-full-mgt2e-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runMgT2EBottomUpMacro(false);
    });

    document.getElementById('ctx-full-rtt-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runRTTMacro(false);
    });

    document.getElementById('ctx-full-ct-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runCTBottomUpMacro(false);
    });
}

// ============================================================================
// AUTO ROUTES
// ============================================================================

/**
 * Returns hex IDs of all populated, non-hidden worlds (the current filter result).
 * This is what "filtered worlds" means for Auto Route generation.
 */
function getFilteredHexIds() {
    const ids = [];
    hexStates.forEach((state, id) => {
        if (state.type === 'SYSTEM_PRESENT' && !state.isHiddenByFilter) ids.push(id);
    });
    return ids;
}

/**
 * Returns true if any filter input field currently has a non-empty value.
 * Used to block Auto Routes when no filter is active.
 */
function hasAnyActiveFilter() {
    const textInputIds = [
        'filter-name', 'filter-starport', 'filter-size', 'filter-atm', 'filter-hydro',
        'filter-pop', 'filter-total-pop', 'filter-gov', 'filter-law', 'filter-tl',
        'filter-trade-codes', 'filter-allegiance', 'filter-gravity', 'filter-temperature',
        'filter-t5-ix', 'filter-mgt-importance', 'filter-mgt-wtn', 'filter-mgt-gwp'
    ];
    const checkboxIds = ['filter-belts', 'filter-gas-giant', 'filter-travel-zone'];

    const hasText = textInputIds.some(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
    });
    const hasCheck = checkboxIds.some(id => {
        const el = document.getElementById(id);
        return el && el.checked;
    });
    return hasText || hasCheck;
}

function setupAutoRoutes() {
    // "Auto Routes" button in filter modal footer → open generation modal
    const btnOpen = document.getElementById('btn-auto-routes');
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            const nextNum = (window.autoRouteCounter || 0) + 1;
            document.getElementById('autoroute-name').value = '';
            document.getElementById('autoroute-name').placeholder = `Auto Route #${nextNum}`;
            document.getElementById('autoroute-max-jump').value  = 4;
            document.getElementById('autoroute-max-range').value = 12;

            // Reset P2P state
            const p2pCheck = document.getElementById('autoroute-p2p');
            if (p2pCheck) p2pCheck.checked = false;
            const p2pOptions = document.getElementById('autoroute-p2p-options');
            if (p2pOptions) p2pOptions.style.display = 'none';

            // Pre-populate start/end from selection if two hexes selected
            const selArray = [...(window.selectedHexes || [])];
            if (selArray.length >= 1) document.getElementById('autoroute-p2p-start').value = selArray[0];
            if (selArray.length >= 2) document.getElementById('autoroute-p2p-end').value   = selArray[1];

            document.getElementById('autoroute-modal').style.display = 'flex';
        });
    }

    // P2P checkbox → show/hide options div; hide Range row (unused in P2P)
    const p2pCheckbox = document.getElementById('autoroute-p2p');
    if (p2pCheckbox) {
        p2pCheckbox.addEventListener('change', () => {
            const opts     = document.getElementById('autoroute-p2p-options');
            const rangeRow = document.getElementById('autoroute-range-row');
            if (opts)     opts.style.display     = p2pCheckbox.checked ? 'block' : 'none';
            if (rangeRow) rangeRow.style.display  = p2pCheckbox.checked ? 'none'  : 'flex';
        });
    }

    // "From Sel[0]" / "From Sel[1]" buttons
    // Confirm → branch on P2P mode vs. standard Auto Routes
    const btnConfirm = document.getElementById('btn-autoroute-confirm');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            const isP2P    = document.getElementById('autoroute-p2p')?.checked || false;
            const maxJump  = Math.min(8,  Math.max(1, parseInt(document.getElementById('autoroute-max-jump').value,  10) || 4));
            const color    = document.getElementById('autoroute-color').value || '#ff9900';
            const nameRaw  = document.getElementById('autoroute-name').value.trim();

            const nextCounter = (window.autoRouteCounter || 0) + 1;
            const name    = nameRaw || `Auto Route #${nextCounter}`;
            const groupId = `ar_${Date.now()}`;

            if (isP2P) {
                // ── Point-to-Point path ──────────────────────────────────
                const startId = document.getElementById('autoroute-p2p-start').value.trim();
                const endId   = document.getElementById('autoroute-p2p-end').value.trim();

                if (!startId || !endId) {
                    alert('Point-to-Point requires both a Start and End hex ID.');
                    return;
                }
                if (startId === endId) {
                    alert('Start and End hex must be different.');
                    return;
                }

                const filteredIds = getFilteredHexIds();

                saveHistoryState('Generate Point-to-Point Route');
                const count = generatePointToPointRoute(startId, endId, maxJump, color, groupId, name, true, filteredIds);

                if (count === null) {
                    alert(`No route found from ${startId} to ${endId} within Jump-${maxJump}.`);
                    return; // keep modal open
                }

                window.autoRouteCounter = nextCounter;
                document.getElementById('autoroute-modal').style.display = 'none';
                showToast(`"${name}" generated: ${count} segment(s).`, 3000);

            } else {
                // ── Standard Auto Routes path ────────────────────────────
                if (!hasAnyActiveFilter()) {
                    alert('No filter is active. Apply a filter before generating Auto Routes.');
                    return;
                }

                const filteredIds = getFilteredHexIds();
                if (filteredIds.length === 0) {
                    alert('The current filter matches no worlds.');
                    return;
                }

                const maxRange = Math.min(32, Math.max(1, parseInt(document.getElementById('autoroute-max-range').value, 10) || 12));

                saveHistoryState('Generate Auto Routes');
                const count = generateAutoRoutes(filteredIds, maxJump, maxRange, color, groupId, name);

                if (count === 0) {
                    alert('No route segments could be generated for the current filter.');
                    return; // keep modal open
                }

                window.autoRouteCounter = nextCounter;
                document.getElementById('autoroute-modal').style.display = 'none';
                showToast(`"${name}" generated: ${count} route segment(s).`, 3000);
            }

            if (window.dbManager) {
                window.dbManager.saveRoutes();
                window.dbManager.saveAutoRouteCounter();
            }
            requestAnimationFrame(draw);
        });
    }

    // Cancel
    const btnCancel = document.getElementById('btn-autoroute-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            document.getElementById('autoroute-modal').style.display = 'none';
        });
    }

    // "Clear Auto Routes" button → open clear modal
    const btnClearOpen = document.getElementById('btn-clear-auto-routes');
    if (btnClearOpen) {
        btnClearOpen.addEventListener('click', () => {
            const groups = getAutoRouteGroups();
            if (groups.length === 0) {
                showToast('No Auto Routes to clear.', 2000);
                return;
            }
            const list = document.getElementById('clear-autoroute-list');
            list.innerHTML = '';
            groups.forEach(g => {
                const row = document.createElement('label');
                row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-bottom:1px solid #1f2833;';
                row.innerHTML = `
                    <input type="checkbox" data-groupid="${g.groupId}"
                        style="cursor:pointer;accent-color:#66fcf1;flex-shrink:0;">
                    <span style="display:inline-block;width:16px;height:16px;border-radius:3px;
                        background:${g.color};flex-shrink:0;border:1px solid rgba(255,255,255,0.25);"></span>
                    <span style="color:#c5c6c7;font-size:0.9rem;flex:1;">${g.name}</span>
                    <span style="color:#666;font-size:0.8rem;white-space:nowrap;">${g.count} segment(s)</span>
                `;
                list.appendChild(row);
            });
            document.getElementById('clear-autoroute-modal').style.display = 'flex';
        });
    }

    // Confirm clear → remove selected groups
    const btnClearConfirm = document.getElementById('btn-clear-autoroute-confirm');
    if (btnClearConfirm) {
        btnClearConfirm.addEventListener('click', () => {
            const checked = [...document.querySelectorAll('#clear-autoroute-list input[type="checkbox"]:checked')];
            if (checked.length === 0) { showToast('No sets selected.', 2000); return; }
            saveHistoryState('Clear Auto Routes');
            checked.forEach(cb => clearAutoRouteGroup(cb.dataset.groupid));
            document.getElementById('clear-autoroute-modal').style.display = 'none';
            showToast(`Removed ${checked.length} Auto Route set(s).`, 2500);
            if (window.dbManager) window.dbManager.saveRoutes();
            requestAnimationFrame(draw);
        });
    }

    // Cancel clear
    const btnClearCancel = document.getElementById('btn-clear-autoroute-cancel');
    if (btnClearCancel) {
        btnClearCancel.addEventListener('click', () => {
            document.getElementById('clear-autoroute-modal').style.display = 'none';
        });
    }
}

// ============================================================================
// SETTINGS PANEL
// ============================================================================

function setupSettingsPanel() {
    const settingsPanel = document.getElementById('settings-panel');
    const settingsToggle = document.getElementById('settings-toggle');
    const closeSettings = document.getElementById('btn-close-settings');

    settingsToggle.addEventListener('click', () => {
        const isOpening = !settingsPanel.classList.contains('open');
        if (isOpening) {
            // Mutually exclusive: close help if open
            const helpPanel = document.getElementById('help-panel');
            if (helpPanel) helpPanel.classList.remove('open');
        }
        settingsPanel.classList.toggle('open');
    });

    closeSettings.addEventListener('click', () => {
        settingsPanel.classList.remove('open');
    });

    const loggingToggle = document.getElementById('toggle-logging');
    if (loggingToggle) {
        loggingToggle.addEventListener('change', (e) => {
            window.isLoggingEnabled = e.target.checked;
            showToast(window.isLoggingEnabled ? "Batch Logging Enabled" : "Batch Logging Disabled", 2000);
        });
    }

    document.getElementById('toggle-borders').addEventListener('change', (e) => {
        showSubsectorBorders = e.target.checked;
        requestAnimationFrame(draw);
    });
    
    document.getElementById('toggle-hide-no-planets').addEventListener('change', (e) => {
        hideNoPlanetSystems = e.target.checked;
        requestAnimationFrame(draw);
    });

    document.getElementById('toggle-dev-view').addEventListener('change', (e) => {
        devView = e.target.checked;
        requestAnimationFrame(draw);
    });

    const printModeToggle = document.getElementById('toggle-print-mode');
    if (printModeToggle) {
        let savedDotColor = '#ffffff';
        printModeToggle.addEventListener('change', (e) => {
            window.printMode = e.target.checked;
            document.body.classList.toggle('print-mode', e.target.checked);
            const dotColorInput = document.getElementById('default-dot-color');
            if (dotColorInput) {
                if (e.target.checked) {
                    savedDotColor = dotColorInput.value;
                    dotColorInput.value = '#444444';
                } else {
                    dotColorInput.value = savedDotColor;
                }
            }
            requestAnimationFrame(draw);
        });
    }

    // --- Generation Seed ---
    const seedInput = document.getElementById('input-seed');
    const randomizeBtn = document.getElementById('btn-randomize-seed');

    // Load initial seed
    const savedSeed = localStorage.getItem('traveller_gen_seed') || "TravellerMagnus";
    seedInput.value = savedSeed;
    if (typeof setRandomSeed === 'function') setRandomSeed(savedSeed);

    seedInput.addEventListener('input', (e) => {
        const newSeed = e.target.value;
        if (typeof setRandomSeed === 'function') setRandomSeed(newSeed || "TravellerMagnus");
        localStorage.setItem('traveller_gen_seed', newSeed);
    });

    randomizeBtn.addEventListener('click', () => {
        const randomSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
        seedInput.value = randomSeed;
        if (typeof setRandomSeed === 'function') setRandomSeed(randomSeed);
        localStorage.setItem('traveller_gen_seed', randomSeed);
        showToast(`Seed randomized: ${randomSeed}`, 2000);
    });
}

function setupHelpToggle() {
    const helpToggle = document.getElementById('help-toggle');
    const helpPanel = document.getElementById('help-panel');
    const settingsPanel = document.getElementById('settings-panel');

    if (helpToggle) {
        helpToggle.addEventListener('click', () => {
            const isOpening = !helpPanel.classList.contains('open');
            if (isOpening) {
                // Mutually exclusive: close settings if open
                if (settingsPanel) settingsPanel.classList.remove('open');
            }
            helpPanel.classList.toggle('open');
        });
    }

    const closeHelp = document.getElementById('btn-close-help');
    if (closeHelp) {
        closeHelp.addEventListener('click', () => {
            helpPanel.classList.remove('open');
        });
    }
}