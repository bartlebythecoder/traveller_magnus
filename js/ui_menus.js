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

    document.getElementById('ctx-assign-border').addEventListener('click', () => {
        if (typeof window.openAssignBorderModal === 'function') window.openAssignBorderModal();
    });

    // --- Assign Allegiance ---
    function openAssignAllegianceModal() {
        document.getElementById('context-menu').classList.remove('visible');
        const count = selectedHexes.size;
        if (count === 0) { showToast('No hexes selected.', 2000); return; }
        document.getElementById('allegiance-assign-count').textContent = count;
        document.getElementById('allegiance-assign-input').value = '';
        document.getElementById('allegiance-assign-modal').style.display = 'flex';
        document.getElementById('allegiance-assign-input').focus();
    }

    function applyAllegiance() {
        const code = document.getElementById('allegiance-assign-input').value.trim();
        if (!code) { showToast('Please enter an allegiance code.', 2000); return; }
        const hexList = [...selectedHexes];
        saveHistoryState('Assign Allegiance');
        hexList.forEach(hexId => {
            const s = hexStates.get(hexId);
            if (s) s.allegiance = code;
        });
        if (window.dbManager) window.dbManager.saveHexes(hexList);
        document.getElementById('allegiance-assign-modal').style.display = 'none';
        showToast(`Allegiance "${code}" assigned to ${hexList.length} system(s).`, 2500);
        requestAnimationFrame(draw);
    }

    document.getElementById('ctx-assign-allegiance').addEventListener('click', openAssignAllegianceModal);
    document.getElementById('btn-allegiance-assign-apply').addEventListener('click', applyAllegiance);
    document.getElementById('btn-allegiance-assign-cancel').addEventListener('click', () => {
        document.getElementById('allegiance-assign-modal').style.display = 'none';
    });
    document.getElementById('allegiance-assign-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyAllegiance();
        if (e.key === 'Escape') document.getElementById('allegiance-assign-modal').style.display = 'none';
    });

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
                let newSys = null;

                if (stateObj.mgtSystem && typeof expandLoadedSocioeconomicsMgT2E === 'function') {
                    // A physical system already exists (from the system editor, a prior physical
                    // expansion, or a full generation). Run socio without regenerating the
                    // physical structure — this is what preserves manually created systems.
                    newSys = expandLoadedSocioeconomicsMgT2E(hexId, stateObj);
                } else {
                    // No system yet (mainworld UWP only). Generate top-down first, which
                    // includes the socio pass, then surface the result.
                    newSys = generateMgT2ESystemTopDown(hexId, baseData);
                }

                if (newSys) {
                    // Find the mainworld to map the socio data (recursive to handle Lunar Mainworlds)
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

                    stateObj.mgtSystem = newSys;
                    stateObj.mgt2eData = mainworld;
                    stateObj.mgtSocio  = mainworld;
                    stateObj.t5Socio   = null;

                    hexStates.set(hexId, stateObj);
                }
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

        // Warn if any selected hex has manual field overrides that will be preserved
        let totalManualBodies = 0;
        selectedHexes.forEach(hexId => {
            const s = hexStates.get(hexId);
            if (s && s.t5System) totalManualBodies += countT5ManualBodies(s.t5System);
        });
        const manualNote = totalManualBodies > 0
            ? `\n\n${totalManualBodies} body/bodies have manual field overrides. These will be preserved.`
            : '';
        if (!confirm(`Re-expand the T5 system for ${selectedHexes.size} hex(es). Stars and orbits will be regenerated.${manualNote}\n\nProceed?`)) {
            return;
        }

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
                const oldSys = stateObj.t5System || null;
                if (window.System_Driver && window.System_Driver.generateT5SystemPreservingManuals) {
                    sys = window.System_Driver.generateT5SystemPreservingManuals(baseData, oldSys);
                } else if (window.T5_TopDown_Generator) {
                    sys = window.T5_TopDown_Generator.generateT5System(baseData);
                } else {
                    sys = generateT5SystemChunk1(baseData, stateObj.t5System, hexId);
                    sys = generateT5SystemChunk2(sys, baseData);
                    sys = generateT5SystemChunk3(sys, baseData);
                }
                stateObj.t5System = sys;
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

    // RTT Biographer Only
    document.getElementById('ctx-expand-rtt-bio').addEventListener('click', () => {
        if (!validateSelection('physical')) return;

        const targetHexes = Array.from(selectedHexes).filter(hexId => {
            const s = hexStates.get(hexId);
            return s && s.rttSystem;
        });

        if (targetHexes.length === 0) {
            alert('No selected hexes have an RTT system to re-expand.');
            return;
        }

        let totalManualBodies = 0;
        targetHexes.forEach(hexId => {
            const s = hexStates.get(hexId);
            if (s && s.rttSystem) totalManualBodies += countManualBodies(s.rttSystem);
        });

        const manualNote = totalManualBodies > 0
            ? `\n\n${totalManualBodies} body/bodies have manual field overrides. These will be preserved.`
            : '';

        if (!confirm(`Re-run the RTT Biographer (physical biography + social stats) on ${targetHexes.length} hex(es). Stars and orbits will NOT be changed.${manualNote}\n\nProceed?`)) {
            return;
        }

        saveHistoryState('RTT Re-expand Biographer');
        targetHexes.forEach(hexId => {
            reseedForHex(hexId);
            if (typeof window.expandRTTBiographerOnly === 'function') {
                window.expandRTTBiographerOnly(hexId);
            }
        });

        document.getElementById('context-menu').classList.remove('visible');
        showToast(`Re-ran RTT Biographer for ${targetHexes.length} hex(es)`);

        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
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

    document.getElementById('ctx-gen-sys-aow-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runAoWMacro(true);
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

    document.getElementById('ctx-full-aow-bu').addEventListener('click', () => {
        document.getElementById('context-menu').classList.remove('visible');
        runAoWMacro(false);
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
        'filter-trade-codes', 'filter-allegiance', 'filter-region', 'filter-gravity', 'filter-temperature',
        'filter-t5-ix', 'filter-mgt-importance', 'filter-mgt-wtn', 'filter-mgt-gwp'
    ];
    const checkboxIds = ['filter-belts', 'filter-gas-giant', 'filter-travel-zone'];

    const hasText = textInputIds.some(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.multiple) return Array.from(el.selectedOptions).some(o => o.value !== '');
        return el.value.trim() !== '';
    });
    const hasCheck = checkboxIds.some(id => {
        const el = document.getElementById(id);
        return el && el.checked;
    });
    return hasText || hasCheck;
}

// ============================================================================
// WORLD NAME RESOLUTION
// ============================================================================

// Returns the display name for a hex state, falling back through all
// edition-specific sub-objects. Required for OTU/JSON-imported worlds
// whose name lives in t5Data.name rather than the top-level state.name.
function getWorldName(state) {
    if (!state) return '';
    return state.name
        || (state.t5Data    && state.t5Data.name)
        || (state.mgt2eData && state.mgt2eData.name)
        || (state.rttData   && state.rttData.name)
        || (state.ctData    && state.ctData.name)
        || '';
}

// ============================================================================
// WORLD AUTOCOMPLETE
// ============================================================================

/**
 * Attaches a name-based autocomplete dropdown to a text input.
 * Matching worlds appear as "Name  HXXX" rows; selecting one writes the
 * hex ID into the input. Typing a raw hex ID directly still works.
 */
// ── World autocomplete dropdown positioning ──────────────────────────────────
// .wac-dropdown is position:fixed so it is never clipped by a scrollable
// ancestor (the P2P waypoint list scrolls once it passes ~10 rows). Fixed
// elements do not move with a scrolling container, so the visible dropdown is
// repositioned on scroll/resize. One shared listener is used rather than a pair
// per input — waypoint rows are created and destroyed freely and would leak.
let _wacActive = null;

// ── Dropdown portal ──────────────────────────────────────────────────────────
// position:fixed only means "positioned against the viewport" while no ancestor
// establishes a containing block for it, and .draggable-palette establishes one:
// its backdrop-filter makes the Route Manager the containing block for every
// fixed descendant. The viewport coordinates measured above were therefore read
// back as offsets from the window's own corner, so the list appeared ~112px
// below its field — and vanished entirely, clipped by the palette's
// overflow:hidden, once the window was dragged right or down. Parking the
// dropdown on <body> while it is open is what makes those coordinates mean what
// this code assumes. It goes home again on close, so removing a waypoint row
// still disposes of that row's dropdown along with it.
function _wacPortalOpen(dropdownEl) {
    if (dropdownEl._wacHome) return;
    dropdownEl._wacHome = dropdownEl.parentNode;
    document.body.appendChild(dropdownEl);
}

function _wacPortalClose(dropdownEl) {
    const home = dropdownEl._wacHome;
    if (!home) return;
    dropdownEl._wacHome = null;
    home.appendChild(dropdownEl);
}

// Closes whichever dropdown is open. Global because a portaled dropdown is no
// longer inside the panel: hiding the panel no longer hides it.
function _wacHideActive() {
    if (!_wacActive) return;
    const { dropdownEl } = _wacActive;
    dropdownEl.style.display = 'none';
    _wacPortalClose(dropdownEl);
    _wacActive = null;
}

function _wacPositionDropdown(inputEl, dropdownEl) {
    const r = inputEl.getBoundingClientRect();
    dropdownEl.style.width = `${r.width}px`;
    dropdownEl.style.left  = `${r.left}px`;

    // Flip above the input when there isn't room for the list below it.
    const dropH     = dropdownEl.offsetHeight || 160;
    const roomBelow = window.innerHeight - r.bottom;
    const flipUp    = roomBelow < dropH && r.top > roomBelow;

    dropdownEl.style.top          = flipUp ? `${r.top - dropH}px` : `${r.bottom}px`;
    dropdownEl.style.borderRadius = flipUp ? '3px 3px 0 0' : '0 0 3px 3px';
    dropdownEl.style.borderTop    = flipUp ? '1px solid #45a29e' : 'none';
    dropdownEl.style.borderBottom = flipUp ? 'none' : '1px solid #45a29e';
}

function _wacSyncPosition() {
    if (!_wacActive) return;
    const { inputEl, dropdownEl } = _wacActive;
    // The input's liveness, not the dropdown's: a portaled dropdown is parented
    // to <body>, so it stays connected even after its waypoint row is removed.
    if (!inputEl.isConnected || dropdownEl.style.display !== 'block') {
        _wacHideActive();
        return;
    }
    _wacPositionDropdown(inputEl, dropdownEl);
}

window.addEventListener('scroll', _wacSyncPosition, true);
window.addEventListener('resize', _wacSyncPosition);

function setupWorldAutocomplete(inputEl, dropdownEl) {
    let activeIndex = -1;

    function hideDropdown() {
        dropdownEl.style.display = 'none';
        _wacPortalClose(dropdownEl);
        if (_wacActive && _wacActive.dropdownEl === dropdownEl) _wacActive = null;
        activeIndex = -1;
    }

    function getMatches(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        const results = [];
        hexStates.forEach((state, hexId) => {
            if (state.type !== 'SYSTEM_PRESENT') return;
            const name = getWorldName(state);
            if (name.toLowerCase().startsWith(q)) results.push({ hexId, name });
        });
        return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
    }

    function renderDropdown(matches) {
        dropdownEl.innerHTML = '';
        if (matches.length === 0) {
            hideDropdown();
            return;
        }
        matches.forEach((m) => {
            const item = document.createElement('div');
            item.className = 'wac-item';
            item.dataset.hexId = m.hexId;
            item.innerHTML = `<span class="wac-name">${m.name}</span><span class="wac-hexid">${m.hexId}</span>`;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                inputEl.value = formatWorldLabel(m.hexId, m.name);
                hideDropdown();
            });
            dropdownEl.appendChild(item);
        });
        activeIndex = -1;
        _wacPortalOpen(dropdownEl);
        dropdownEl.style.display = 'block';
        _wacActive = { inputEl, dropdownEl };
        _wacPositionDropdown(inputEl, dropdownEl);
    }

    function updateActive() {
        [...dropdownEl.querySelectorAll('.wac-item')].forEach((el, i) =>
            el.classList.toggle('wac-active', i === activeIndex));
    }

    inputEl.addEventListener('input', () => {
        renderDropdown(getMatches(inputEl.value.trim()));
        // A hex ID typed by hand can be deep space; flag it as the user types.
        refreshStopFieldStyles();
    });

    inputEl.addEventListener('keydown', (e) => {
        const items = [...dropdownEl.querySelectorAll('.wac-item')];
        if (dropdownEl.style.display === 'none' || items.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            updateActive();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            updateActive();
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            const hexId = items[activeIndex]?.dataset.hexId;
            if (hexId) {
                inputEl.value = formatWorldLabel(hexId);
                hideDropdown();
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    });

    inputEl.addEventListener('focus', () => {
        const matches = getMatches(inputEl.value.trim());
        if (matches.length > 0) renderDropdown(matches);
    });

    inputEl.addEventListener('blur', () => {
        setTimeout(hideDropdown, 150);
    });
}

/**
 * Renders a world as "Name (hexId)" for display in a Start/End/Waypoint field.
 * Long waypoint lists are unreadable as bare hex IDs, so both are shown.
 * Falls back to the bare hex ID when the world has no name.
 */
function formatWorldLabel(hexId, name) {
    const label = name || (hexStates.has(hexId) ? getWorldName(hexStates.get(hexId)) : '');
    if (label) return `${label} (${hexId})`;
    // A nameless stop is either vacant space the user deliberately chose or an
    // unnamed system. Naming the vacancy is what tells a deep-space stop apart
    // from a typo in the field.
    if (isVacantHex(hexId)) return `Deep Space (${hexId})`;
    return hexId;
}

/**
 * Resolves a P2P input value to a hex ID.
 * Accepts a raw hex ID, a system name (case-insensitive, first match wins),
 * or the "Name (hexId)" form written by the autocomplete.
 *
 * A vacant hex resolves to itself: a stop may be deep space, not only a world.
 * Vacant hexes have no name to match, so they are reachable by clicking the map
 * or by typing the hex ID — never through the name autocomplete.
 *
 * Returns null if nothing matches.
 */
function resolveWorldInput(value) {
    const v = value.trim();
    if (!v) return null;
    if (hexStates.has(v) && hexStates.get(v).type === 'SYSTEM_PRESENT') return v;
    if (isVacantHex(v)) return v;

    // "Name (hexId)" — trust the explicit hex ID in the suffix over the name,
    // which may be duplicated across the sector.
    const suffix = v.match(/^(.*)\s+\(([^()]+)\)$/);
    if (suffix) {
        const hexId = suffix[2].trim();
        if (hexStates.has(hexId) && hexStates.get(hexId).type === 'SYSTEM_PRESENT') return hexId;
        if (isVacantHex(hexId)) return hexId;   // "Deep Space (1-A-1910)"
    }

    const q = (suffix ? suffix[1] : v).trim().toLowerCase();
    let found = null;
    hexStates.forEach((state, hexId) => {
        if (found) return;
        if (state.type === 'SYSTEM_PRESENT' && getWorldName(state).toLowerCase() === q) found = hexId;
    });
    return found;
}

/**
 * Flags every P2P stop field that currently holds a vacant hex.
 *
 * A deep-space stop is legitimate but unusual, and there is no checkbox
 * announcing it — so the field itself has to say so. Called from MapPick._sync
 * (which runs after every pick), from the autocomplete's input handler, and
 * wherever fields are populated programmatically.
 */
function refreshStopFieldStyles() {
    const inputs = [
        document.getElementById('route-auto-p2p-start'),
        document.getElementById('route-auto-p2p-end'),
        ...document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-input')
    ];
    inputs.forEach(input => {
        if (!input) return;
        const id = resolveWorldInput(input.value);
        input.classList.toggle('wac-input-vacant', !!id && isVacantHex(id));
    });
}

// ============================================================================
// ROUTE SYSTEMS PANEL
// ============================================================================

function getRouteSystemList(routeId) {
    const segments = (window.sectorRoutes || []).filter(r => r.routeId === routeId);
    if (segments.length === 0) return { ordered: false, worlds: [] };

    const isP2P = segments[0].subtype === 'PointToPoint';

    if (isP2P) {
        // walkRouteChain (js/routes.js) — the single definition of "is this one
        // unbroken chain", shared with Continue and Combine so the three cannot
        // drift apart.
        //
        // It is also STRICTER than the walk that used to live here, which tested
        // only for exactly two degree-1 nodes. A chain plus a separate closed
        // loop passes that test — the loop contributes no ends — and the walk
        // then stopped at the end of the chain and returned ordered:true while
        // silently omitting every world in the loop. Measured 2026-09-01: 3 of 6
        // worlds listed, here and in the CSV export alike. walkRouteChain checks
        // coverage and rejects it, so such a route now lists unordered — every
        // world present — instead of ordered and incomplete.
        const walk = walkRouteChain(segments);
        if (walk.ok) return { ordered: true, worlds: walk.path };

        const allIds = [...new Set(segments.flatMap(s => [s.startId, s.endId]))];
        return { ordered: false, worlds: allIds };
    }

    // Network / XBoat / AutoRoute — collect unique IDs, sort by world name
    const allIds = [...new Set(segments.flatMap(s => [s.startId, s.endId]))];
    allIds.sort((a, b) => {
        const na = getWorldName(hexStates.get(a)) || a;
        const nb = getWorldName(hexStates.get(b)) || b;
        return na.localeCompare(nb);
    });
    return { ordered: false, worlds: allIds };
}

// ── Route Export Field Registry ───────────────────────────────────────────────
const ROUTE_EXPORT_FIELDS = [
    { group: 'Location',       id: 'name',       label: 'Name',            defaultOn: true  },
    { group: 'Location',       id: 'hex',         label: 'Hex',             defaultOn: true  },
    { group: 'Location',       id: 'sector',      label: 'Sector',          defaultOn: false },
    { group: 'Location',       id: 'subsector',   label: 'Subsector',       defaultOn: false },
    { group: 'Identity',       id: 'uwp',         label: 'UWP',             defaultOn: true  },
    { group: 'Identity',       id: 'zone',        label: 'Zone',            defaultOn: true  },
    { group: 'Identity',       id: 'allegiance',  label: 'Allegiance',      defaultOn: true  },
    { group: 'UWP Components', id: 'starport',    label: 'Star Port',       defaultOn: false },
    { group: 'UWP Components', id: 'size',        label: 'World Size',      defaultOn: false },
    { group: 'UWP Components', id: 'atm',         label: 'Atmosphere',      defaultOn: false },
    { group: 'UWP Components', id: 'hydro',       label: 'Hydrographics',   defaultOn: false },
    { group: 'UWP Components', id: 'pop',         label: 'Population Code', defaultOn: false },
    { group: 'UWP Components', id: 'gov',         label: 'Government',      defaultOn: false },
    { group: 'UWP Components', id: 'law',         label: 'Law Level',       defaultOn: false },
    { group: 'UWP Components', id: 'tl',          label: 'Tech Level',      defaultOn: false },
    { group: 'Demographics',   id: 'totalpop',    label: 'Total Population', defaultOn: false },
    { group: 'Demographics',   id: 'nobility',    label: 'Nobilities',      defaultOn: false },
    { group: 'Classification', id: 'tradecodes',  label: 'Trade Codes',     defaultOn: true  },
    { group: 'System',         id: 'belts',       label: 'Planetoid Belts', defaultOn: false },
    { group: 'System',         id: 'gasgiant',    label: 'Gas Giants',      defaultOn: false },
    { group: 'System',         id: 'stars',       label: 'Stars',           defaultOn: false },
    { group: 'System',         id: 'worlds',      label: 'System Worlds',   defaultOn: false },
    { group: 'Bases',          id: 'bases',       label: 'Bases',           defaultOn: false },
    { group: 'Bases',          id: 'navalbase',   label: 'Naval Base',      defaultOn: false },
    { group: 'Bases',          id: 'scoutbase',   label: 'Scout Base',      defaultOn: false },
    { group: 'Bases',          id: 'milbase',     label: 'Military Base',   defaultOn: false },
];

const _ROUTE_EXPORT_LS_KEY = 'traveller_routeExportFields';

function _getRouteExportValue(fieldId, hexId, state, data) {
    switch (fieldId) {
        case 'name':      return getWorldName(state) || (isVacantHex(hexId) ? 'Deep Space' : '(unnamed)');
        case 'hex': {
            const parts = hexId.split('-');
            return parts[parts.length - 1];
        }
        case 'sector': {
            const sNum = parseInt(hexId.split('-')[0], 10);
            return (window.sectorNames && window.sectorNames[sNum]) || `Sector ${sNum}`;
        }
        case 'subsector':  return hexId.split('-')[1] || '-';
        case 'uwp':        return data.uwp || '???????-?';
        case 'starport':   return String(data.starport || '-');
        case 'size':       return data.size  != null ? toEHex(data.size)  : '-';
        case 'atm':        return data.atm   != null ? toEHex(data.atm)   : '-';
        case 'hydro':      return data.hydro != null ? toEHex(data.hydro) : '-';
        case 'pop':        return data.pop   != null ? toEHex(data.pop)   : '-';
        case 'gov':        return data.gov   != null ? toEHex(data.gov)   : '-';
        case 'law':        return data.law   != null ? toEHex(data.law)   : '-';
        case 'tl':         return data.tl    != null ? String(data.tl)       : '-';
        case 'zone':       return data.travelZone || 'Green';
        case 'allegiance': return state.allegiance || data.allegiance || '-';
        case 'totalpop': {
            // MgT2E stores fine-grained total population on mgtSocio
            const mgtTotal = state.mgtSocio && state.mgtSocio.totalWorldPop;
            if (mgtTotal != null && mgtTotal > 0) return mgtTotal.toLocaleString();
            const pop = data.pop != null ? data.pop : 0;
            if (!pop) return '0';
            const mult = data.popDigit != null ? data.popDigit : 5;
            return Math.round(Math.pow(10, pop) * mult).toLocaleString();
        }
        case 'tradecodes': return (data.tradeCodes || []).join(' ') || '-';
        case 'nobility':   return '-';
        case 'belts':      return String(data.planetoidBelts != null ? data.planetoidBelts : (state.beltCount != null ? state.beltCount : 0));
        case 'gasgiant':   return String(data.gasGiantsCount != null ? data.gasGiantsCount : (state.gasGiantCount != null ? state.gasGiantCount : (data.gasGiant ? 1 : 0)));
        case 'stars': {
            if (state.t5Data && state.t5Data.stars && state.t5Data.stars.length > 0)
                return state.t5Data.stars.map(s => s.name).join(' ');
            if (state.t5Data && state.t5Data.homestar && state.t5Data.homestar !== 'Unknown')
                return state.t5Data.homestar;
            const sys = state.t5System || state.mgtSystem || state.ctSystem || state.rttSystem || state.aowSystem;
            if (sys && sys.stars) return sys.stars.map(s => s.classification || s.name || '?').join(' ');
            return '-';
        }
        case 'worlds': {
            if (state.t5System && state.t5System.totalWorlds) return String(state.t5System.totalWorlds);
            if (state.mgtSystem && state.mgtSystem.worlds)    return String(state.mgtSystem.worlds.length);
            if (state.aowSystem && state.aowSystem.worlds)    return String(state.aowSystem.worlds.length);
            if (state.ctSystem && state.ctSystem.orbits) {
                let w = state.ctSystem.orbits.filter(o => o.contents).length;
                if (state.ctSystem.capturedPlanets) w += state.ctSystem.capturedPlanets.length;
                return String(w);
            }
            if (state.rttSystem && state.rttSystem.stars) {
                let w = 0;
                state.rttSystem.stars.forEach(s => { if (s.planetarySystem) w += s.planetarySystem.orbits.length; });
                return String(w);
            }
            return '1';
        }
        case 'bases': {
            let b = '';
            if (data.navalBase)    b += 'N';
            if (data.scoutBase)    b += 'S';
            if (data.researchBase) b += 'R';
            if (data.militaryBase) b += 'M';
            if (data.tas)          b += 'T';
            if (data.wayStation)   b += 'W';
            if (data.govEstate)    b += 'G';
            return b || '-';
        }
        case 'navalbase': return data.navalBase    ? 'Y' : '-';
        case 'scoutbase': return data.scoutBase    ? 'Y' : '-';
        case 'milbase':   return data.militaryBase ? 'Y' : '-';
        default:          return '-';
    }
}

function _buildRouteExportModal() {
    if (document.getElementById('route-export-modal')) return;

    const groups = {};
    const groupOrder = ['Location', 'Identity', 'UWP Components', 'Demographics', 'Classification', 'System', 'Bases'];
    ROUTE_EXPORT_FIELDS.forEach(f => {
        if (!groups[f.group]) groups[f.group] = [];
        groups[f.group].push(f);
    });

    let gridHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px 20px;">';
    groupOrder.forEach(gName => {
        if (!groups[gName]) return;
        gridHtml += `<div><span style="color:#66fcf1; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px; display:block;">${gName}</span>`;
        groups[gName].forEach(f => {
            gridHtml += `<label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-bottom:3px;"><input type="checkbox" data-field="${f.id}" style="cursor:pointer; accent-color:#66fcf1;"><span style="color:#c5c6c7; font-size:0.82rem;">${f.label}</span></label>`;
        });
        gridHtml += '</div>';
    });
    gridHtml += '</div>';

    const modal = document.createElement('div');
    modal.id = 'route-export-modal';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:2000; align-items:center; justify-content:center;';
    modal.innerHTML = `
        <div style="background:#1f2833; border:1px solid #45a29e; border-radius:8px; padding:24px; width:600px; max-height:85vh; display:flex; flex-direction:column; gap:14px; box-shadow:0 8px 32px rgba(0,0,0,0.6);">
            <h3 style="margin:0; color:#66fcf1; font-size:1.1rem;">Export Route Systems</h3>
            <div style="display:flex; gap:8px;">
                <button id="route-export-all" class="menu-btn" style="padding:4px 12px; font-size:0.75rem;">Select All</button>
                <button id="route-export-none" class="menu-btn" style="padding:4px 12px; font-size:0.75rem;">Select None</button>
            </div>
            <div style="overflow-y:auto; flex:1; padding-right:4px;">${gridHtml}</div>
            <div id="route-export-dest" style="font-size:0.78rem; color:#8b9398; border-top:1px solid #2a3a3a; padding-top:10px;"></div>
            <div style="display:flex; gap:8px; justify-content:flex-end; padding-top:2px;">
                <button id="route-export-cancel" class="menu-btn" style="padding:8px 20px;">Cancel</button>
                <button id="route-export-download" class="menu-btn" style="padding:8px 20px; background:#45a29e; color:#0b0c10; border-color:#45a29e;">Download CSV</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#route-export-all').addEventListener('click', () => {
        modal.querySelectorAll('input[data-field]').forEach(cb => { cb.checked = true; });
    });
    modal.querySelector('#route-export-none').addEventListener('click', () => {
        modal.querySelectorAll('input[data-field]').forEach(cb => { cb.checked = false; });
    });
    modal.querySelector('#route-export-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
}

/** Filename this route's CSV will be written as. Sanitised to a safe charset. */
// ============================================================================
// ROUTE FILES (save / load one route's connections)
// ============================================================================
// Spec: directives/route_file_spec.md
//
// A route file carries connections and nothing else — no colour, no name, no
// group. Identity belongs to the slot you load into, which is what keeps this
// feature small: the whole-sector XML importer has to *derive* identity from
// the file, and every one of its failure modes (two routes merging because they
// shared a colour, names lost, running out of slots) comes from that guesswork.
// Here the user answered the question by choosing which row to load into.
//
// Distinct from the CSV beside it: that exports the *worlds* a route passes
// through, richly and configurably, and carries no connections at all.

const ROUTE_FILE_FORMAT  = 'asab-route';
const ROUTE_FILE_VERSION = 1;

function _routeFileFilename(routeName) {
    return `route_${String(routeName).replace(/[^a-z0-9_\-]/gi, '_')}.json`;
}

/**
 * Is this a hex that actually exists on the current grid?
 *
 * getHexCoords is lenient about malformed ids, so the round trip is the guard —
 * the same test isVacantHex uses. Kept local rather than shared with core.js:
 * two copies of a three-line idiom is not yet a duplication worth editing
 * working generation code to remove.
 */
function _isRealHexId(hexId) {
    if (typeof hexId !== 'string' || !hexId) return false;
    const c = getHexCoords(hexId);
    if (!c || !Number.isFinite(c.q) || !Number.isFinite(c.r)) return false;
    return getHexId(c.q, c.r) === hexId;
}

/**
 * Writes one route slot's connections to a .json file.
 * Returns the filename on success, null otherwise.
 */
function exportRouteFile(routeId, routeName) {
    const segs = (window.sectorRoutes || []).filter(r => r.routeId === routeId);
    if (segs.length === 0) {
        showToast(`"${routeName}" has no connections to save.`, 2500);
        return null;
    }

    const payload = {
        format:  ROUTE_FILE_FORMAT,
        version: ROUTE_FILE_VERSION,
        grid:    { width: gridWidth, height: gridHeight },
        savedAs: routeName,
        savedAt: new Date().toISOString(),
        segments: segs.map(r => [r.startId, r.endId])
    };

    // subtype is topology, not decoration: getRouteSystemList lists a route in
    // travel order only when it sees 'PointToPoint'. Recorded only when every
    // segment agrees, so a slot holding mixed output makes no false claim.
    const subtypes = new Set(segs.map(s => s.subtype));
    if (subtypes.size === 1 && segs[0].subtype) payload.subtype = segs[0].subtype;

    const filename = _routeFileFilename(routeName);
    // downloadBlob, not a hand-rolled anchor — it defers blob-URL cleanup,
    // without which large downloads intermittently produce no file at all.
    const ok = downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json');
    showToast(ok
        ? `Saved ${segs.length} connection(s) to "${filename}" — check your browser's downloads.`
        : `Save failed — "${filename}" could not be written. See the console for details.`,
        4000);
    return ok ? filename : null;
}

/**
 * Validates route-file text. Pure — no side effects, nothing touched — so the
 * whole error table can be exercised without a map loaded.
 * @returns {{ok: true, data: Object} | {ok: false, error: string}}
 */
function _parseRouteFile(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (_) {
        return { ok: false, error: "That file isn't a route file — it could not be read as JSON." };
    }

    if (!data || data.format !== ROUTE_FILE_FORMAT) {
        return { ok: false, error: "That isn't a route file. Route files are saved from the Route Manager." };
    }
    if (data.version !== ROUTE_FILE_VERSION) {
        return { ok: false, error: `This route file is in format v${data.version}, which this version of the app cannot read.` };
    }

    const g = data.grid;
    if (!g || !Number.isFinite(g.width) || !Number.isFinite(g.height)) {
        return { ok: false, error: 'That route file does not say which sector grid it was saved from.' };
    }
    // Absolute hex ids on a resized grid still resolve to perfectly valid
    // hexes — just the wrong ones — so this has to be a refusal rather than a
    // silently misplaced route.
    if (g.width !== gridWidth || g.height !== gridHeight) {
        return { ok: false, error: `This route file was saved from a map of ${g.width}×${g.height} sectors. `
            + `This map is ${gridWidth}×${gridHeight}. Route files don't survive a change to the sector grid.` };
    }

    if (!Array.isArray(data.segments) || data.segments.length === 0) {
        return { ok: false, error: 'That route file contains no connections.' };
    }

    for (const pair of data.segments) {
        if (!Array.isArray(pair) || pair.length !== 2) {
            return { ok: false, error: 'That route file is damaged — one of its connections is not a pair of hexes.' };
        }
        for (const id of pair) {
            if (!_isRealHexId(id)) {
                return { ok: false, error: `This route file refers to a hex that doesn't exist on this map (${id}). Nothing was loaded.` };
            }
        }
    }

    return { ok: true, data };
}

/**
 * Loads a route file into one slot, replacing whatever that slot held.
 * The slot's name, colour, shortcut and visibility are never touched.
 */
function importRouteFile(routeId, routeName, file) {
    readFileAsText(file).then(text => {
        const parsed = _parseRouteFile(text);
        if (!parsed.ok) { showToast(parsed.error, 5000); return; }

        const data     = parsed.data;
        const existing = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
        const source   = data.savedAs
            ? `"${data.savedAs}" (${data.segments.length} connections)`
            : `${data.segments.length} connections`;

        // Replacing someone's work asks first; filling an empty slot does not.
        if (existing > 0 && !window.confirm(
            `Load ${source} into "${routeName}"?\n\n`
            + `This replaces the ${existing} segment(s) currently in "${routeName}".\n`
            + `It keeps that route's name and colour, and can be undone with Ctrl+Z.`)) return;

        saveHistoryState(`Import route: ${routeName}`);
        window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);

        // The same mapping canvas_input.js uses for hand-drawn segments. An
        // imported segment has to be indistinguishable from one drawn by hand
        // on the same slot, or the renderer draws it on a different layer.
        const typeMap = { 1: 'Xboat', 2: 'Trade', 3: 'Secondary' };
        const type    = typeMap[routeId] || 'Filter';

        data.segments.forEach(([startId, endId]) => {
            const extras = { routeId };
            // Filter routes are de-duplicated per group, so one is required.
            if (type === 'Filter') extras.groupId = `import_${routeId}`;
            if (data.subtype) extras.subtype = data.subtype;
            // Deliberately no `color`: the renderer prefers the definition's
            // colour and only falls back to the segment's, so leaving it off is
            // what makes the route wear the destination slot's colour.
            addRoute(startId, endId, type, null, extras);
        });

        const added = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
        if (window.dbManager) window.dbManager.saveRoutes();
        requestAnimationFrame(draw);
        window.refreshRouteWindowCounts();
        showToast(`Loaded ${added} segment(s) into "${routeName}".`, 3000);
    }).catch(err => {
        console.error('[Route File]', err);
        showToast('That route file could not be read.', 3000);
    });
}

/**
 * Opens the shared file picker on behalf of one route row.
 * onchange is assigned rather than added — every row shares one input, and
 * listeners would stack one import per row visited.
 */
function _pickRouteFileFor(routeId, routeName) {
    const input = document.getElementById('file-import-route');
    if (!input) return;
    input.value = '';
    input.onchange = (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) importRouteFile(routeId, routeName, f);
    };
    input.click();
}

function _routeCsvFilename(routeName) {
    return `route_${String(routeName).replace(/[^a-z0-9_\-]/gi, '_')}.csv`;
}

function openRouteExportModal(routeId, routeName) {
    _buildRouteExportModal();
    const modal = document.getElementById('route-export-modal');

    // Tell the user what the file is called and where it lands — a browser
    // download gives no other feedback, so a silent failure was previously
    // indistinguishable from a successful one.
    const destEl = modal.querySelector('#route-export-dest');
    if (destEl) {
        destEl.innerHTML =
            `Saves as <span style="color:#66fcf1; font-family:'Courier New',monospace;">` +
            `${_routeCsvFilename(routeName)}</span> to your browser's download folder.`;
    }

    // Restore checkbox state from localStorage or fall back to defaults
    let savedFields;
    try { savedFields = JSON.parse(localStorage.getItem(_ROUTE_EXPORT_LS_KEY)); } catch (_) {}
    const enabled = new Set(savedFields || ROUTE_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.id));
    modal.querySelectorAll('input[data-field]').forEach(cb => { cb.checked = enabled.has(cb.dataset.field); });

    // Re-wire Download for this routeId/routeName (cloneNode removes old listeners)
    const oldBtn = modal.querySelector('#route-export-download');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', () => {
        const checked = [...modal.querySelectorAll('input[data-field]:checked')].map(cb => cb.dataset.field);
        try { localStorage.setItem(_ROUTE_EXPORT_LS_KEY, JSON.stringify(checked)); } catch (_) {}
        modal.style.display = 'none';
        exportRouteSystemsCSV(routeId, routeName, checked);
    });

    modal.style.display = 'flex';
}

function exportRouteSystemsCSV(routeId, routeName, fieldIds) {
    if (!fieldIds || !fieldIds.length) {
        try {
            const saved = JSON.parse(localStorage.getItem(_ROUTE_EXPORT_LS_KEY));
            fieldIds = (saved && saved.length) ? saved : ROUTE_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.id);
        } catch (_) {
            fieldIds = ROUTE_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.id);
        }
    }

    const { worlds } = getRouteSystemList(routeId);
    const labels = fieldIds.map(id => (ROUTE_EXPORT_FIELDS.find(f => f.id === id) || {}).label || id);
    const rows = [labels];

    worlds.forEach(hexId => {
        // A vacant stop may have no hexStates entry at all; it still belongs in
        // the export, as a row of dashes under "Deep Space", rather than
        // vanishing and leaving the route looking one stop shorter than it is.
        const state = hexStates.get(hexId) || (isVacantHex(hexId) ? { type: 'BLANK' } : null);
        if (!state) return;
        const data = state.rttData || state.t5Data || state.mgt2eData || state.ctData || {};
        rows.push(fieldIds.map(id => _getRouteExportValue(id, hexId, state, data)));
    });

    const csv = rows.map(row =>
        row.map(cell => {
            const s = String(cell);
            return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
    ).join('\r\n');

    const filename = _routeCsvFilename(routeName);
    // Shared helper in io_manager.js — it defers blob-URL cleanup, without which
    // this download intermittently produced no file at all.
    const ok = downloadBlob(csv, filename, 'text/csv;charset=utf-8');

    const worldCount = rows.length - 1;
    if (typeof showToast === 'function') {
        showToast(ok
            ? `Exported ${worldCount} world(s) to "${filename}" — check your browser's downloads.`
            : `Export failed — "${filename}" could not be written. See the console for details.`,
            4000);
    }
    return ok ? filename : null;
}

window.openRouteSystemsPanel = function (routeId, routeName) {
    window.closeRouteAutoPanel();

    const panel   = document.getElementById('route-systems-panel');
    const nameEl  = document.getElementById('route-systems-panel-name');
    const listEl  = document.getElementById('route-systems-list');
    const footerEl = document.getElementById('route-systems-footer');
    if (!panel || !nameEl || !listEl) return;

    // Toggle off if already showing this route
    if (panel.dataset.routeId === String(routeId) && panel.style.display !== 'none') {
        window.closeRouteSystemsPanel();
        return;
    }

    panel.dataset.routeId = String(routeId);
    nameEl.textContent = routeName;

    const { ordered, worlds } = getRouteSystemList(routeId);
    listEl.innerHTML = '';

    // A route that never reached its End says so at the top, before the list.
    // Read through getRouteShortfall so a mark left over from a generation the
    // user has since edited past is not repeated back to them as current.
    const sf = (typeof getRouteShortfall === 'function') ? getRouteShortfall(routeId) : null;
    if (sf) {
        const hexes = sf.distance === 1 ? '1 hex' : `${sf.distance} hexes`;
        const notice = document.createElement('div');
        notice.className = 'route-systems-shortfall';
        notice.innerHTML = `<strong>Stopped short.</strong> This route could not reach `
                         + `${formatWorldLabel(sf.targetId)} and ends at `
                         + `${formatWorldLabel(sf.reachedId)}, ${hexes} away. `
                         + `Add a waypoint near there and generate again to carry it on.`;
        listEl.appendChild(notice);
    }

    if (worlds.length === 0) {
        // Appended, not assigned: assigning innerHTML here would wipe the
        // shortfall notice above. A shortfall cannot currently coexist with an
        // empty list — getRouteShortfall returns null when the slot has no
        // segments — but the two are independent enough that relying on it is
        // asking for a silent regression.
        const none = document.createElement('div');
        none.style.cssText = 'color:#555;font-style:italic;padding:4px 0;';
        none.textContent = 'No systems found.';
        listEl.appendChild(none);
    } else {
        worlds.forEach((hexId, i) => {
            const state = hexStates.get(hexId);
            // A route may now stop in, or pass through, empty space — say so
            // rather than listing it as an unnamed world.
            const name  = getWorldName(state) || (isVacantHex(hexId) ? 'Deep Space' : '(unnamed)');
            const item  = document.createElement('div');
            item.className = 'route-systems-item';
            // The world the route ran out at is marked in the list too, so the
            // notice above and the row it refers to are visibly the same place.
            if (sf && hexId === sf.reachedId) item.classList.add('route-systems-item-stopped');
            const marker = ordered ? `${i + 1}.` : '•';
            item.innerHTML = `<span class="route-systems-item-num">${marker}</span>`
                           + `<span class="route-systems-item-name">${name}</span>`
                           + `<span class="route-systems-item-id">${hexId}</span>`
                           + (sf && hexId === sf.reachedId
                               ? '<span class="route-systems-item-stopmark" title="As far as this route could get">stops here</span>'
                               : '');
            listEl.appendChild(item);
        });
    }

    const segCount = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
    footerEl.textContent = `${segCount} segment${segCount !== 1 ? 's' : ''} · `
                         + `${worlds.length} world${worlds.length !== 1 ? 's' : ''}`
                         + (sf ? ' · incomplete' : '');

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.closeRouteSystemsPanel = function () {
    const panel = document.getElementById('route-systems-panel');
    if (!panel) return;
    panel.style.display = 'none';
    panel.dataset.routeId = '';
};

// ============================================================================
// MAP PICK (fill a P2P stop by clicking a hex on the map)
// ============================================================================
// The Route Manager is a non-modal floating palette, so the map underneath it
// stays live — a stop can be chosen by clicking it instead of typing it.
//
// Both modes share ONE controller with a single `mode` field rather than a
// pair of booleans: "armed for a field" and "chain mode" must never both be
// true, and two parallel state machines would drift apart.
//   'field' — one named input is armed; the next map click fills it.
//   'chain' — every map click extends the route. First click sets Start, the
//             second sets End, and from then on the standing End is demoted to
//             a waypoint and the hex just clicked becomes the new End. Last
//             click wins, which is how a route gets traced across a map by hand.
//
// Delivery happens on mouseup, and only when the pointer barely moved (see
// canvas_input.js), so drag-to-pan keeps working while a pick is armed.

const MapPick = {
    mode: null,         // null | 'field' | 'chain'
    targetInput: null,  // 'field' mode only — the input being filled
    targetLabel: ''
};
window.MapPick = MapPick;

// The orrery takes canvas input over wholesale, so picking refuses to arm
// while it is open rather than competing with it for clicks.
function _mapPickBlocked() {
    return !!(window.SystemViewer && window.SystemViewer.isOpen && window.SystemViewer.isOpen());
}

// "1-B-1910" → "1910". Toasts name the hex the way the map labels it.
function _mapPickHexLabel(hexId) {
    const parts = String(hexId).split('-');
    return parts[parts.length - 1];
}

MapPick.isArmed = function () {
    return this.mode !== null;
};

MapPick.armField = function (inputEl, label) {
    if (!inputEl) return;
    if (_mapPickBlocked()) {
        showToast('Close the system view before picking on the map.', 2500);
        return;
    }
    // Clicking an already-armed button disarms it.
    if (this.mode === 'field' && this.targetInput === inputEl) { this.cancel(); return; }
    this.mode = 'field';
    this.targetInput = inputEl;
    this.targetLabel = label || 'this stop';
    this._sync();
};

MapPick.startChain = function () {
    if (this.mode === 'chain') { this.cancel(); return; }
    if (_mapPickBlocked()) {
        showToast('Close the system view before picking on the map.', 2500);
        return;
    }

    const startEl = document.getElementById('route-auto-p2p-start');
    const endEl   = document.getElementById('route-auto-p2p-end');
    const wpList  = document.getElementById('route-auto-p2p-waypoints-list');

    // Chain mode rewrites End on every click, so it starts from an empty route
    // rather than silently demoting something the user typed by hand.
    const hasAny = !!((startEl && startEl.value.trim()) ||
                      (endEl && endEl.value.trim()) ||
                      (wpList && wpList.children.length > 0));
    if (hasAny) {
        if (!confirm('Build Route on Map starts from an empty route.\n\nClear the current Start, End and waypoints?')) return;
        if (startEl) startEl.value = '';
        if (endEl)   endEl.value   = '';
        if (wpList)  wpList.innerHTML = '';
    }

    this.mode = 'chain';
    this.targetInput = null;
    this.targetLabel = '';
    this._sync();
};

MapPick.cancel = function (msg) {
    if (this.mode === null) return;
    this.mode = null;
    this.targetInput = null;
    this.targetLabel = '';
    this._sync();
    if (msg) showToast(msg, 2000);
};

MapPick.deliver = function (hexId) {
    if (this.mode === null) return;
    if (_mapPickBlocked()) { this.cancel(); return; }

    // A stop may be a populated world or vacant space — some referees let
    // players jump into empty hexes, and deliberately choosing one IS the
    // opt-in, so there is no separate setting to check here. Anything else
    // (an id off the grid, say) would fail much later as a bare "no path".
    const state = hexStates.get(hexId);
    const isSystem = !!(state && state.type === 'SYSTEM_PRESENT');
    if (!isSystem && !isVacantHex(hexId)) {
        showToast(`${_mapPickHexLabel(hexId)} cannot be used as a stop.`, 2200);
        return;
    }

    if (this.mode === 'field') this._deliverField(hexId);
    else                       this._deliverChain(hexId);
};

MapPick._deliverField = function (hexId) {
    const input = this.targetInput;
    // Waypoint rows are created and destroyed freely, so the armed row may
    // have been removed while the pick was open.
    if (!input || !input.isConnected) {
        this.cancel('That field is gone — pick cancelled.');
        return;
    }

    const label = formatWorldLabel(hexId);
    input.value = label;

    // Auto-advance Start → End, but only when End is still empty: reopening a
    // saved route to change one field must not drag the user into the next.
    const startEl = document.getElementById('route-auto-p2p-start');
    const endEl   = document.getElementById('route-auto-p2p-end');
    if (input === startEl && endEl && !endEl.value.trim()) {
        showToast(`Start: ${label}`, 1600);
        this.armField(endEl, 'End');
        return;
    }

    showToast(`${this.targetLabel}: ${label}`, 1600);
    this.cancel();
};

MapPick._deliverChain = function (hexId) {
    const startEl = document.getElementById('route-auto-p2p-start');
    const endEl   = document.getElementById('route-auto-p2p-end');
    if (!startEl || !endEl) { this.cancel(); return; }

    const label = formatWorldLabel(hexId);

    if (!startEl.value.trim()) {
        startEl.value = label;
        showToast(`Start: ${label}`, 1600);

    } else if (!endEl.value.trim()) {
        if (resolveWorldInput(startEl.value) === hexId) {
            showToast('That is already the start of the route.', 2000);
            return;
        }
        endEl.value = label;
        showToast(`End: ${label}`, 1600);

    } else {
        if (resolveWorldInput(endEl.value) === hexId) {
            showToast('That is already the last stop.', 2000);
            return;
        }
        // Last click wins: the standing End becomes the next waypoint. It is
        // appended at the bottom because it was the furthest stop so far, and
        // legs are walked in list order.
        //
        // doFocus=false — focus must stay on the map, and the panel must not
        // scroll out from under the cursor on every click.
        addWaypointRow(endEl.value, false);
        endEl.value = label;
        const wpCount = document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-row').length;
        showToast(`End: ${label} — ${wpCount} waypoint${wpCount !== 1 ? 's' : ''}`, 1800);
    }

    this._sync();  // the hint text depends on how far along the chain is
};

MapPick._hintText = function () {
    if (this.mode === 'field') {
        return `Click a system on the map to set ${this.targetLabel}. Esc cancels.`;
    }
    const startEl = document.getElementById('route-auto-p2p-start');
    const endEl   = document.getElementById('route-auto-p2p-end');
    if (startEl && !startEl.value.trim()) return 'Click the system this route starts from. Esc cancels.';
    if (endEl   && !endEl.value.trim())   return 'Click the next system — it becomes the End. Esc cancels.';
    return 'Keep clicking: each system becomes the new End, and the one before it becomes a waypoint.';
};

// Repaints every piece of pick-mode feedback: button states, the map cursor,
// and the hint bar. Called after any state change so there is one place where
// what the user sees is derived from `mode`.
MapPick._sync = function () {
    const armedInput = this.mode === 'field' ? this.targetInput : null;

    document.querySelectorAll('.p2p-pick-btn').forEach(btn => {
        // Waypoint buttons carry a direct reference (rows are dynamic); the
        // Start/End buttons name their input in markup.
        const target = btn._pickInput ||
                       (btn.dataset.pickTarget ? document.getElementById(btn.dataset.pickTarget) : null);
        btn.classList.toggle('armed', !!target && target === armedInput);
    });

    const chainBtn = document.getElementById('btn-p2p-chain');
    if (chainBtn) {
        const on = this.mode === 'chain';
        chainBtn.classList.toggle('armed', on);
        chainBtn.innerHTML = on ? '◉ Building — click the map' : '◎ Build Route on Map';
    }

    const canvas = document.getElementById('map-canvas');
    if (canvas) canvas.classList.toggle('picking', this.isArmed());

    refreshStopFieldStyles();

    const hint = document.getElementById('route-auto-p2p-pick-hint');
    if (!hint) return;
    if (!this.isArmed()) {
        hint.style.display = 'none';
        hint.innerHTML = '';
        return;
    }

    hint.innerHTML = '';
    const text = document.createElement('span');
    text.className = 'pick-hint-text';
    text.textContent = this._hintText();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = this.mode === 'chain' ? 'Done' : 'Cancel';
    btn.addEventListener('click', () => MapPick.cancel());

    hint.appendChild(text);
    hint.appendChild(btn);
    hint.style.display = 'flex';
};

// ============================================================================
// WAYPOINT HELPERS (P2P Route Builder)
// ============================================================================

function addWaypointRow(prefillValue = '', doFocus = true) {
    const list = document.getElementById('route-auto-p2p-waypoints-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'p2p-waypoint-row';

    // Position badge — kept in sync by renumberWaypoints() after any reorder.
    const idxEl = document.createElement('span');
    idxEl.className = 'p2p-waypoint-index';

    const wrap = document.createElement('div');
    wrap.className = 'wac-wrap';
    wrap.style.flex = '1';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'wac-input p2p-waypoint-input';
    if (prefillValue) input.value = prefillValue;

    const drop = document.createElement('div');
    drop.className = 'wac-dropdown';

    wrap.appendChild(input);
    wrap.appendChild(drop);

    const pickBtn = document.createElement('button');
    pickBtn.type = 'button';
    pickBtn.className = 'p2p-pick-btn';
    pickBtn.title = 'Pick on map';
    pickBtn.textContent = '◎';
    pickBtn._pickInput = input;   // read back by MapPick._sync()
    pickBtn.addEventListener('click', () => {
        // Numbered at click time — rows reorder freely, so the position is not
        // fixed at creation.
        const rows = [...document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-row')];
        MapPick.armField(input, `Waypoint ${rows.indexOf(row) + 1}`);
    });

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'p2p-waypoint-move';
    upBtn.title = 'Move up';
    upBtn.textContent = '▲';
    upBtn.addEventListener('click', () => {
        const prev = row.previousElementSibling;
        if (prev) {
            list.insertBefore(row, prev);
            renumberWaypoints();
            row.scrollIntoView({ block: 'nearest' });
        }
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'p2p-waypoint-move';
    downBtn.title = 'Move down';
    downBtn.textContent = '▼';
    downBtn.addEventListener('click', () => {
        const next = row.nextElementSibling;
        if (next) {
            list.insertBefore(next, row);
            renumberWaypoints();
            row.scrollIntoView({ block: 'nearest' });
        }
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'p2p-waypoint-remove';
    removeBtn.title = 'Remove waypoint';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        // Disarm eagerly if this row's pick is open, so the hint bar cannot
        // sit there naming a field that no longer exists.
        if (MapPick.targetInput === input) MapPick.cancel();
        row.remove();
        renumberWaypoints();
    });

    row.appendChild(idxEl);
    row.appendChild(wrap);
    row.appendChild(pickBtn);
    row.appendChild(upBtn);
    row.appendChild(downBtn);
    row.appendChild(removeBtn);
    list.appendChild(row);

    setupWorldAutocomplete(input, drop);
    renumberWaypoints();
    refreshStopFieldStyles();
    if (doFocus) {
        input.focus();
        row.scrollIntoView({ block: 'nearest' });
    }
}

// Re-syncs position badges, placeholders, and move-button enablement after any
// add / remove / reorder.
function renumberWaypoints() {
    const rows = [...document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-row')];
    rows.forEach((row, i) => {
        const idxEl = row.querySelector('.p2p-waypoint-index');
        if (idxEl) idxEl.textContent = `${i + 1}.`;

        const inp = row.querySelector('.p2p-waypoint-input');
        if (inp && !inp.value) inp.placeholder = `Waypoint ${i + 1}`;

        const moves = row.querySelectorAll('.p2p-waypoint-move');
        if (moves[0]) moves[0].disabled = (i === 0);
        if (moves[1]) moves[1].disabled = (i === rows.length - 1);
    });
}

// ── Continue mode (route_extend_spec.md §4) ──────────────────────────────────
// Ticking "Continue existing route" changes what the Start/End/waypoint fields
// MEAN, so it has to change what they contain: the panel otherwise shows the
// stops of the route as it already is, while Generate would try to add them to
// itself. Unticking must put the form back exactly, so trying the box costs
// nothing.
let _continueStash = null;

/**
 * The stored P2P setup for a slot, or null. Used to orient the chain walk so
 * "the far end" means the end away from the route's own Start rather than
 * whichever end adjacency order happened to produce.
 */
function _storedP2pParams(routeId) {
    const def = (window.routeDefinitions || []).find(d => d.id === routeId);
    const ref = def && def.automationRef;
    return (ref && ref.type === 'p2p' && ref.params) ? ref.params : null;
}

function _applyContinueMode(on) {
    const startEl = document.getElementById('route-auto-p2p-start');
    const endEl   = document.getElementById('route-auto-p2p-end');
    const wpList  = document.getElementById('route-auto-p2p-waypoints-list');
    const panel   = document.getElementById('route-auto-panel');
    if (!startEl || !endEl || !wpList || !panel) return;
    const routeId = parseInt(panel.dataset.targetRouteId, 10);

    if (on) {
        _continueStash = {
            start:     startEl.value,
            end:       endEl.value,
            waypoints: collectWaypointRaws()
        };
        const stored = _storedP2pParams(routeId);
        const ends   = getRouteEnds(routeId, stored ? stored.startId : undefined);
        // Pre-fill the far end — the end away from the route's Start. On a route
        // that stopped short this is C, the ringed world, which is exactly the
        // world to bridge from. The field stays editable so the other end can be
        // typed instead and the route extended backwards.
        // ends[0] is the route's own Start when it is still an end, so ends[1] is
        // the far one. On a route with three ends that is simply another end —
        // the field stays editable and the guard on Generate names them all.
        const far = ends.ok ? (ends.ends[1] || ends.ends[0]) : null;
        startEl.value = far ? formatWorldLabel(far) : '';
        endEl.value   = '';
        wpList.innerHTML = '';
    } else if (_continueStash) {
        startEl.value = _continueStash.start;
        endEl.value   = _continueStash.end;
        wpList.innerHTML = '';
        // doFocus=false — restoring rows must not fight for focus or scroll.
        _continueStash.waypoints.forEach(v => addWaypointRow(v, false));
        _continueStash = null;
    }
    refreshStopFieldStyles();
}

/**
 * Resets the Continue box to off and sets whether it can be used at all.
 *
 * Off on every open is deliberate (spec C6): the box modifies one press, and a
 * remembered tick would silently append where the user expected a rebuild.
 *
 * Eligibility is getRouteEnds, NOT getRouteChain. Continue only needs the route
 * to have two ends to grow from; requiring one unbroken line also refused every
 * route that crosses back over itself, which any waypointed route can do — see
 * walkRouteEnds in routes.js.
 *
 * @param {boolean} [resetTick=true] - false when called because the segments
 *        changed under an open panel, where the user's own tick must survive.
 */
/**
 * "Regina (1-A-1910)", "A or B", "A, B or C" — a route may now have any number
 * of loose ends, and every message that offers them has to read as English.
 */
function _formatEndList(ids) {
    // Arrow, not a bare reference: formatWorldLabel's second parameter is a name
    // override, and .map hands it the index — which rendered the second end as
    // "1 (1-B-1106)" and the third as "2 (…)".
    const labels = (ids || []).map(id => formatWorldLabel(id));
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

/**
 * Forgets a slot's stored Point-to-Point setup.
 *
 * Used when a continuation leaves the route with more than two loose ends. The
 * setup is a single run of stops — Start, waypoints, End — and a route with
 * three ends is not one run, so there is no honest way to write it down. Keeping
 * the old one would be worse than having none: reopening the panel would show
 * stops that no longer describe the route, and an ordinary Generate would
 * silently replace what is on the map with what the stale setup says.
 *
 * Continue itself does not need it — the ends are walked from the segments every
 * time — so this costs nothing but the remembered Max Jump. It is the same
 * position the feature already takes for imported, file-loaded and hand-drawn
 * routes, whose real stops are equally unknown (route_extend_spec.md OQ-4).
 */
function _clearAutomationConfig(routeId) {
    const def = (window.routeDefinitions || []).find(d => d.id === routeId);
    if (!def || !def.automationRef) return false;
    def.automationRef = null;
    if (window.dbManager) window.dbManager.saveRouteDefinitions?.();
    return true;
}

function _syncContinueControl(routeId, resetTick = true) {
    const cb = document.getElementById('route-auto-p2p-continue');
    if (!cb) return;
    const label = document.getElementById('route-auto-p2p-continue-label');

    if (resetTick) {
        cb.checked = false;
        _continueStash = null;
    }

    const segCount = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
    const ends = getRouteEnds(routeId);
    cb.disabled = !ends.ok;

    let title;
    if (segCount === 0) {
        title = 'This route has no segments yet, so there is nothing to continue. ' +
                'Generate one first.';
    } else if (!ends.ok) {
        title = ends.reason === 'cycle'
            ? 'This route forms a closed loop, so it has no loose end to continue from.'
            : 'This route is in more than one piece. Continuing it would grow one ' +
              'piece and leave the rest behind, so join them up first — or use the ' +
              'link button to combine them into one route.';
    } else {
        title = `Add to this route instead of replacing it. Generate will append to it, ` +
                `starting from ${_formatEndList(ends.ends)}. The rest of the route ` +
                `is left alone.`;
        if (ends.crosses) {
            title += ' This route crosses back over itself, so its worlds are listed ' +
                     'alphabetically rather than in travel order.';
        }
        if (ends.ends.length > 2) {
            title += ` It has ${ends.ends.length} loose ends, so it is not a single run ` +
                     `of stops: continuing it will clear its saved setup rather than ` +
                     `keep one that no longer describes it.`;
        }
    }
    if (label) label.title = title;
    if (label) label.style.opacity = cb.disabled ? '0.45' : '';

    // The tick cannot outlive its own precondition. If the route stopped being
    // continuable while the box was ticked, put the form back the way Continue
    // found it — leaving it ticked-but-disabled would send the fields Continue
    // rewrote (Start = an end, End blank) into a plain rebuild.
    if (!resetTick && cb.checked && cb.disabled) {
        cb.checked = false;
        _applyContinueMode(false);
    }
}

/**
 * Re-runs the eligibility test for whichever route the Automation Panel is open
 * on, without disturbing the user's tick.
 *
 * The box used to be set once, when the panel opened, and never again — so every
 * way of changing a slot's segments with the panel already open left it stale.
 * Drawing segments by hand is the one that bites: open the panel on an empty
 * slot, draw a route on the map, and the box stayed greyed out insisting the
 * route had no segments. That is a tick-box the user can see and cannot tick,
 * with nothing on screen to say why.
 */
function _refreshContinueControl() {
    const panel = document.getElementById('route-auto-panel');
    if (!panel || panel.style.display !== 'block') return;
    const routeId = parseInt(panel.dataset.targetRouteId, 10);
    if (!Number.isFinite(routeId)) return;
    _syncContinueControl(routeId, false);
}

function collectWaypointRaws() {
    return Array.from(document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-input'))
        .map(inp => inp.value.trim())
        .filter(v => v !== '');
}

// ============================================================================
// AUTOMATION CONFIG PERSISTENCE (routeDefinitions[].automationRef)
// ============================================================================
// Reopening a slot's Automation Panel used to reset every field, so building a
// long Point-to-Point route in passes meant retyping every waypoint. The last
// successful generation is snapshotted onto the route definition instead.
//
// No save/load plumbing is needed: routeDefinitions is persisted wholesale —
// structured-cloned into IndexedDB by dbManager.saveRouteDefinitions() and
// JSON.stringify'd into the sector file — so extra fields round-trip as-is.
//
// Worlds are stored as resolved hex IDs rather than the raw field text, so a
// later rename still restores correctly (and re-renders with the current name).

function _saveAutomationConfig(routeId, type, params) {
    const def = (window.routeDefinitions || []).find(d => d.id === routeId);
    if (!def) return;
    def.automationRef = { type, params, savedAt: new Date().toISOString() };
    if (window.dbManager) window.dbManager.saveRouteDefinitions?.();
}

/**
 * Repopulates the Automation Panel from a slot's saved automationRef.
 * Returns true if a config was restored, false if the slot has none.
 */
function _restoreAutomationConfig(routeId) {
    const def = (window.routeDefinitions || []).find(d => d.id === routeId);
    const ref = def && def.automationRef;
    if (!ref || !ref.type || !ref.params) return false;
    const p = ref.params;

    const setNum = (id, v) => {
        const el = document.getElementById(id);
        if (el && Number.isFinite(v)) el.value = v;
    };
    const setChk = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!v;
    };
    const showOpts = (id, on) => {
        const el = document.getElementById(id);
        if (el) el.style.display = on ? 'block' : 'none';
    };

    if (ref.type === 'xboat') {
        setNum('route-auto-xboat-jump',   p.maxJump);
        setNum('route-auto-xboat-range',  p.maxRange);
        setNum('route-auto-xboat-min-ix', p.minIx);

    } else if (ref.type === 'btn') {
        setNum('route-auto-btn-lower', p.lowerBTN);
        setNum('route-auto-btn-min',   p.minBTN);
        // Max BTN is intentionally blankable — null means "no cap".
        const maxEl = document.getElementById('route-auto-btn-max');
        if (maxEl) maxEl.value = (p.maxBTN === null || p.maxBTN === undefined) ? '' : p.maxBTN;
        setNum('route-auto-btn-jump',  p.maxJump);
        setNum('route-auto-btn-range', p.range);

    } else if (ref.type === 'network') {
        setNum('route-auto-network-jump',      p.maxJump);
        setNum('route-auto-network-range',     p.maxRange);
        setChk('route-auto-network-allow-empty', p.allowEmptyHexes);
        setNum('route-auto-network-max-empty', p.maxEmptyJumps);
        showOpts('route-auto-network-empty-opts', p.allowEmptyHexes);

    } else if (ref.type === 'p2p') {
        const startEl = document.getElementById('route-auto-p2p-start');
        const endEl   = document.getElementById('route-auto-p2p-end');
        if (startEl && p.startId) startEl.value = formatWorldLabel(p.startId);
        if (endEl   && p.endId)   endEl.value   = formatWorldLabel(p.endId);

        const list = document.getElementById('route-auto-p2p-waypoints-list');
        if (list) {
            list.innerHTML = '';
            // doFocus=false — restoring 20 rows must not fight for focus/scroll.
            (p.waypointIds || []).forEach(id => addWaypointRow(formatWorldLabel(id), false));
        }
        setNum('route-auto-p2p-jump', p.maxJump);
        setChk('route-auto-p2p-allow-empty', p.allowEmptyHexes);
        setNum('route-auto-p2p-max-empty', p.maxEmptyJumps);
        showOpts('route-auto-p2p-empty-opts', p.allowEmptyHexes);
        setChk('route-auto-p2p-allow-partial', p.allowPartial);

    } else {
        return false;
    }

    refreshStopFieldStyles();

    // Select the saved type and open its accordion via the existing handler.
    const radio = document.querySelector(`input[name="route-auto-type"][value="${ref.type}"]`);
    if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
}

// ============================================================================
// ATOMIC ROUTE GENERATION
// ============================================================================

/**
 * Turns a Point-to-Point failure into a sentence that names what to go and look
 * at. The message used to name the route's Start and End, which on a long route
 * points at the two stops least likely to be the problem: a twenty-waypoint
 * route that cannot get from stop 7 to stop 8 reported "no path from A to T".
 *
 * Stops are named the way the builder's fields name them — "Regina (1-A-1910)"
 * — because a bare hex ID is not something a user can place on the map.
 */
function _p2pFailureMessage(outcome, maxJump, allowPartial) {
    const f = outcome && outcome.failure;

    if (f && f.kind === 'stop') {
        return `${formatWorldLabel(f.stopId)} can't be used as a stop — it is marked `
             + `as a system but has no system data. Nothing was changed.`;
    }

    if (f && f.kind === 'leg') {
        const where = f.total > 1 ? `leg ${f.index} of ${f.total}` : 'this route';
        let msg = `No path for ${where}: ${formatWorldLabel(f.fromId)} → ${formatWorldLabel(f.toId)} `
                + `within Jump-${maxJump}.`;

        // Naming how far the search actually got turns "it failed" into "bridge
        // from here" — the closest reachable world is exactly the one a user
        // would add as a waypoint to get past the obstacle. This costs the user
        // nothing and changes no state, so it is said whether or not they have
        // asked for partial routes.
        //
        // reachedId is null when nothing reachable was closer to the target than
        // the leg's own start: there is then no useful world to name, and
        // pointing at one further away would be worse than saying nothing.
        if (f.reachedId) {
            const hexes = f.shortfallDistance === 1 ? '1 hex' : `${f.shortfallDistance} hexes`;
            msg += ` The closest it could reach was ${formatWorldLabel(f.reachedId)}, ${hexes} short`;
            // Only worth saying when the option is off — it is the thing that
            // would have turned this failure into a usable route, and a user who
            // has never noticed the checkbox will not go looking for it.
            msg += allowPartial
                ? '.'
                : ' — tick "Build as far as possible" to keep the route up to there.';
        }
        return msg + ' Nothing was changed.';
    }

    return `No path found within Jump-${maxJump}. Nothing was changed.`;
}

/**
 * Clears a route slot, runs a generator into it, and puts everything back
 * exactly as it was if the generator produced nothing.
 *
 * Every route generator is destructive before it is productive: the slot is
 * emptied and only then does the search for paths begin. A run that came up
 * empty therefore used to cost the user the route they already had, on top of
 * not giving them a new one — and a Point-to-Point run that gave up midway
 * left the legs it had already committed lying on the map.
 *
 * Failure is judged by what actually landed in the slot rather than by the
 * count a generator reports, because those counts are not all trustworthy:
 * generateBTNRoutes measures the array's net growth, which reads as zero on
 * any segment that evicted a rival as it was added.
 *
 * @param {string}   actionName - undo label, as passed to saveHistoryState
 * @param {number}   routeId    - the slot to clear and generate into
 * @param {Function} generate   - performs the generation; its return value is
 *                                passed back as .result
 * @returns {{ result: *, produced: boolean }} produced is false when the slot
 *          was left empty and everything was rolled back. Callers must test
 *          this rather than re-inspecting the slot: after a rollback the slot
 *          holds the restored route again and is indistinguishable from a
 *          successful run.
 */
function _generateIntoSlot(actionName, routeId, generate, opts = {}) {
    // A shallow copy is enough: generation pushes to and splices this array but
    // never mutates the segment objects inside it, so anything evicted along
    // the way survives in the snapshot.
    const routesBefore = (window.sectorRoutes || []).slice();
    const redoBefore   = window.redoStack;
    const countBefore  = routesBefore.filter(r => r.routeId === routeId).length;

    saveHistoryState(actionName);
    // opts.append — Continue adds to the route already in the slot, so the one
    // destructive step every generator otherwise takes is skipped. Everything
    // else, including the restore-on-failure below, is unchanged: a continuation
    // that finds nothing must cost the user nothing.
    if (!opts.append) {
        window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);
    }

    let result;
    let produced = false;
    try {
        result = generate();
        const countAfter = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
        // In append mode the slot already held segments, so "did anything land"
        // has to be measured as growth rather than as presence.
        produced = opts.append ? (countAfter > countBefore) : (countAfter > 0);
    } finally {
        if (!produced) {
            window.sectorRoutes = routesBefore;
            // Drop the undo entry recorded for our own clear and restore the
            // redo stack it discarded: nothing happened in the end, so Ctrl+Z
            // must not step through a snapshot identical to the current state.
            window.undoStack.pop();
            window.redoStack = redoBefore;
        }
    }
    return { result, produced };
}

// ============================================================================
// ROUTE WINDOW
// ============================================================================

function setupRouteWindow() {
    const closeBtn = document.getElementById('btn-close-route-window');
    if (closeBtn) closeBtn.addEventListener('click', window.closeRouteWindow);

    const closeBtnFooter = document.getElementById('btn-close-route-window-footer');
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', window.closeRouteWindow);

    const ctxBtn = document.getElementById('ctx-open-route-window');
    if (ctxBtn) {
        ctxBtn.addEventListener('click', () => {
            document.getElementById('context-menu').classList.remove('visible');
            window.toggleRouteWindow();
        });
    }

    const addBtn = document.getElementById('btn-route-add');
    if (addBtn) addBtn.addEventListener('click', () => window.addRouteSlot());

    const visAllCb = document.getElementById('route-vis-all-check');
    if (visAllCb) {
        visAllCb.addEventListener('change', () => {
            const show = visAllCb.checked;
            (window.routeDefinitions || []).forEach(def => { def.visible = show; });
            if (window.dbManager) window.dbManager.saveRouteDefinitions();
            document.querySelectorAll('#route-window-list .route-row').forEach(row => {
                const eye = row.querySelector('.route-eye-btn');
                if (eye) {
                    eye.classList.toggle('fa-eye', show);
                    eye.classList.toggle('fa-eye-slash', !show);
                    eye.style.color = show ? '#45a29e' : '#666';
                    eye.title = show ? 'Disable route' : 'Enable route';
                }
                row.style.opacity = show ? '1' : '0.45';
            });
            visAllCb.indeterminate = false;
            requestAnimationFrame(draw);
        });
    }

    const autoPanelClose = document.getElementById('btn-route-auto-close');
    if (autoPanelClose) autoPanelClose.addEventListener('click', window.closeRouteAutoPanel);

    const sysPanelClose = document.getElementById('btn-route-systems-close');
    if (sysPanelClose) sysPanelClose.addEventListener('click', window.closeRouteSystemsPanel);

    const autoPanelCancel = document.getElementById('btn-route-auto-cancel');
    if (autoPanelCancel) autoPanelCancel.addEventListener('click', window.closeRouteAutoPanel);

    // Radio toggle: accordion open/close + enable Generate
    document.querySelectorAll('input[name="route-auto-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.route-auto-option').forEach(opt => opt.classList.remove('open'));
            const parentOption = radio.closest('.route-auto-option');
            if (parentOption) parentOption.classList.add('open');
            if (radio.value === 'p2p' || radio.value === 'network') {
                window.updateRouteFilterSummary();
            }
            // Switching away from P2P hides the fields a pick would fill.
            if (radio.value !== 'p2p') MapPick.cancel();
            const genBtn = document.getElementById('btn-route-auto-generate');
            if (genBtn) genBtn.disabled = false;
        });
    });

    // Generate button stub — logs config payload; replaced per-type in later phases
    const genBtn = document.getElementById('btn-route-auto-generate');
    if (genBtn) {
        genBtn.addEventListener('click', () => {
            const panel = document.getElementById('route-auto-panel');
            const routeId = parseInt(panel.dataset.targetRouteId, 10);
            const routeDef = (window.routeDefinitions || []).find(d => d.id === routeId);
            const routeName = routeDef ? routeDef.name : `Route #${routeId}`;
            const type = (document.querySelector('input[name="route-auto-type"]:checked') || {}).value;

            if (!type) {
                showToast('Select an automation type first.', 2000);
                return;
            }

            const configs = {
                xboat:   { maxJump:  parseInt(document.getElementById('route-auto-xboat-jump').value, 10),
                           maxRange: parseInt(document.getElementById('route-auto-xboat-range').value, 10),
                           minIx:    parseInt(document.getElementById('route-auto-xboat-min-ix').value, 10) },
                btn:     { lowerBTN: parseInt(document.getElementById('route-auto-btn-lower').value, 10),
                           minBTN:   parseInt(document.getElementById('route-auto-btn-min').value,   10),
                           maxBTN:   document.getElementById('route-auto-btn-max').value.trim() === ''
                                       ? null
                                       : parseInt(document.getElementById('route-auto-btn-max').value, 10),
                           maxJump:  parseInt(document.getElementById('route-auto-btn-jump').value,  10),
                           range:    parseInt(document.getElementById('route-auto-btn-range').value, 10) },
                p2p:     { startRaw:        document.getElementById('route-auto-p2p-start').value,
                           endRaw:          document.getElementById('route-auto-p2p-end').value,
                           maxJump:         parseInt(document.getElementById('route-auto-p2p-jump').value, 10),
                           allowEmptyHexes: document.getElementById('route-auto-p2p-allow-empty')?.checked || false,
                           maxEmptyJumps:   parseInt(document.getElementById('route-auto-p2p-max-empty')?.value || '1', 10),
                           allowPartial:    document.getElementById('route-auto-p2p-allow-partial')?.checked || false,
                           continueExisting: document.getElementById('route-auto-p2p-continue')?.checked || false },
                network: { maxJump:         parseInt(document.getElementById('route-auto-network-jump').value, 10),
                           maxRange:        parseInt(document.getElementById('route-auto-network-range').value, 10),
                           filterRules:     window.activeFilterRules || [],
                           allowEmptyHexes: document.getElementById('route-auto-network-allow-empty')?.checked || false,
                           maxEmptyJumps:   parseInt(document.getElementById('route-auto-network-max-empty')?.value || '1', 10) }
            };

            if (type === 'xboat') {
                const { maxJump, maxRange, minIx } = configs.xboat;
                const xbRun = _generateIntoSlot('Generate Xboat Routes', routeId,
                    () => generateXboatRoutes(maxJump, maxRange, minIx, routeId, `xboat_${routeId}`));
                if (!xbRun.produced) {
                    showToast(`No XBoat routes could be generated at Ix ${minIx}+ — nothing was changed.`, 3500);
                    return;
                }
                const xbCount = (window.sectorRoutes || []).filter(r => r.type === 'Xboat' && r.routeId === routeId).length;
                _saveAutomationConfig(routeId, 'xboat', { maxJump, maxRange, minIx });
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                showToast(`XBoat routes generated: ${xbCount} segment(s) added to Route #${routeId}.`, 3000);
                return;
            }

            if (type === 'network') {
                if (!hasAnyActiveFilter()) {
                    showToast('No filter is active. Apply a filter before generating a Custom Network.', 3000);
                    return;
                }
                const filteredIds = getFilteredHexIds();
                if (filteredIds.length === 0) {
                    showToast('The current filter matches no worlds.', 2500);
                    return;
                }
                const { maxJump, maxRange, allowEmptyHexes: netAllowEmpty, maxEmptyJumps: netMaxEmpty } = configs.network;
                const groupId = `net_${routeId}`;
                const netRun = _generateIntoSlot(`Generate Custom Network: ${routeName}`, routeId,
                    () => generateAutoRoutes(filteredIds, maxJump, maxRange, routeDef.color, groupId, routeName, routeId, netAllowEmpty, netMaxEmpty));
                const count = netRun.result;
                if (!netRun.produced) {
                    showToast('No route segments could be generated for the current filter — nothing was changed.', 3000);
                    return;
                }
                // filterRules is deliberately not persisted — network generation
                // reads the live filter at generate time, and it is not ours to own.
                _saveAutomationConfig(routeId, 'network', {
                    maxJump, maxRange,
                    allowEmptyHexes: netAllowEmpty,
                    maxEmptyJumps:   netMaxEmpty
                });
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                showToast(`"${routeName}" generated: ${count} segment(s).`, 3000);
                return;
            }

            if (type === 'p2p') {
                const { startRaw, endRaw, maxJump, allowEmptyHexes: p2pAllowEmpty, maxEmptyJumps: p2pMaxEmpty, allowPartial: p2pAllowPartial, continueExisting: p2pContinue } = configs.p2p;
                const startId = resolveWorldInput(startRaw);
                const endId   = resolveWorldInput(endRaw);
                if (!startRaw.trim() || !endRaw.trim()) {
                    showToast('Point-to-Point requires both a Start and End world.', 2500);
                    return;
                }
                if (!startId) {
                    showToast(`Cannot find world: "${startRaw.trim()}"`, 2500);
                    return;
                }
                if (!endId) {
                    showToast(`Cannot find world: "${endRaw.trim()}"`, 2500);
                    return;
                }
                if (startId === endId) {
                    showToast('Start and End must be different worlds.', 2500);
                    return;
                }

                // Resolve waypoints
                const waypointRaws = collectWaypointRaws();
                const waypointIds = [];
                for (let wi = 0; wi < waypointRaws.length; wi++) {
                    const wpId = resolveWorldInput(waypointRaws[wi]);
                    if (!wpId) {
                        showToast(`Cannot find waypoint ${wi + 1}: "${waypointRaws[wi]}"`, 2500);
                        return;
                    }
                    waypointIds.push(wpId);
                }

                const filteredIds = getFilteredHexIds();
                const groupId = `p2p_${routeId}`;

                // ── Continue: add to the route rather than replace it ─────────
                if (p2pContinue) {
                    const stored = _storedP2pParams(routeId);
                    const chain  = getRouteEnds(routeId, stored ? stored.startId : undefined);
                    if (!chain.ok) {
                        showToast(chain.reason === 'cycle'
                            ? `"${routeName}" forms a closed loop, so there is no loose end `
                              + `to continue from. Nothing was changed.`
                            : `"${routeName}" is in more than one piece, so continuing it would `
                              + `grow one piece and leave the rest behind. Nothing was changed.`, 6000);
                        return;
                    }
                    // The Start must be a loose END of the route. Joining anywhere
                    // else adds a branch to a route that did not have one, which
                    // is a change to its shape rather than a continuation of it.
                    if (chain.ends.indexOf(startId) === -1) {
                        showToast(`${formatWorldLabel(startId)} is not an end of "${routeName}". `
                                + `Continue from ${_formatEndList(chain.ends)}. `
                                + `Nothing was changed.`, 6000);
                        return;
                    }

                    const contRun = _generateIntoSlot(`Continue: ${routeName}`, routeId,
                        () => generatePointToPointRoute(startId, endId, maxJump, routeDef.color, groupId, routeName, true, filteredIds, routeId, waypointIds, p2pAllowEmpty, p2pMaxEmpty, p2pAllowPartial),
                        { append: true });

                    if (!contRun.produced) {
                        // A continuation can produce nothing WITHOUT failing: the
                        // path was found, and every connection on it was one this
                        // route already had, so addRoute skipped all of them.
                        // Continuing towards a world the route already reaches is
                        // the ordinary way to arrive here, and reporting it as
                        // "no path found within Jump-N" sent the user off to
                        // raise a jump number that was never the problem.
                        if (contRun.result && !contRun.result.failure) {
                            showToast(`"${routeName}" already connects `
                                    + `${formatWorldLabel(startId)} to ${formatWorldLabel(endId)}, `
                                    + `so there was nothing to add. Nothing was changed.`, 6000);
                            return;
                        }
                        const failMsg = _p2pFailureMessage(contRun.result, maxJump, p2pAllowPartial);
                        showToast(failMsg, failMsg.length > 180 ? 12000 : 9000);
                        return;
                    }

                    const added = contRun.result.segments;

                    // Travel order is gated on segments[0].subtype — the first
                    // segment IN THE ARRAY — so a route assembled from a generated
                    // part and a hand-drawn or imported one would list in travel
                    // order or alphabetically depending on nothing but array
                    // position. Stamp it, but only when the result really is a
                    // chain. See route_extend_spec.md §6.
                    stampRouteSubtype(routeId);
                    const merged = getRouteChain(routeId, chain.ends[0]);

                    // Accumulate the saved setup so it still describes the WHOLE
                    // route: reopening the panel shows every stop, and a later
                    // plain Generate rebuilds all of it rather than just this leg.
                    //
                    // Only a two-ended route HAS a single run of stops to write
                    // down. The accumulation below folds the new leg in by
                    // deciding whether the far end or the start end was grown,
                    // and on a route with a third end — a waypoint doubled back
                    // on, which Point-to-Point produces routinely — the world
                    // grown from is neither, so the result would be a setup that
                    // no longer describes the route. Drop it instead.
                    const merged0 = getRouteEnds(routeId);
                    const clearedSetup = (merged0.ends.length > 2) && _clearAutomationConfig(routeId);
                    if (stored && !clearedSetup) {
                        const oldWps = Array.isArray(stored.waypointIds) ? stored.waypointIds.slice() : [];
                        const extendedFarEnd = (startId === chain.ends[1]);
                        const acc = extendedFarEnd
                            // Forward: the end we grew from becomes a waypoint and
                            // the new target becomes the End. On a route that
                            // stopped short this is also what drops the stop it
                            // never reached — the user is steering now.
                            ? { startId: stored.startId,
                                endId:   endId,
                                waypointIds: oldWps.concat([startId], waypointIds) }
                            // Backward: mirror image. The new target becomes the
                            // Start and the old Start slides into the waypoints,
                            // which are held in travel order, hence the reverse.
                            : { startId: endId,
                                endId:   stored.endId,
                                waypointIds: waypointIds.slice().reverse().concat([startId], oldWps) };

                        _saveAutomationConfig(routeId, 'p2p', {
                            startId:         acc.startId,
                            endId:           acc.endId,
                            waypointIds:     acc.waypointIds,
                            maxJump,
                            allowEmptyHexes: p2pAllowEmpty,
                            maxEmptyJumps:   p2pMaxEmpty,
                            allowPartial:    p2pAllowPartial,
                            // A new shortfall wins; otherwise KEEP the old one.
                            // Overwriting it with null would silently drop the ring
                            // from a route that still stops short, since extending
                            // one end does not reach the stop the other end missed.
                            // getRouteShortfall's degree guard decides whether it is
                            // still true, so keeping it is safe.
                            shortfall: contRun.result.shortfall || stored.shortfall || null
                        });
                    }
                    // No stored setup (imported, loaded from a route file, or drawn
                    // by hand): deliberately none is invented. Such a route's real
                    // STOPS are unknown — only the path it happens to take — so a
                    // manufactured setup would either be empty, letting a later
                    // plain Generate silently replace the route with a direct line,
                    // or would list every intermediate world as a waypoint. Continue
                    // keeps working regardless: the chain is walked fresh from the
                    // segments every time. See route_extend_spec.md OQ-4.

                    if (window.dbManager) window.dbManager.saveRoutes();
                    requestAnimationFrame(draw);
                    window.closeRouteAutoPanel();
                    window.refreshRouteWindowCounts();

                    // Said out loud rather than left to be discovered: the panel
                    // will come back empty next time it is opened, and a plain
                    // Generate will no longer rebuild this route.
                    const setupNote = clearedSetup
                        ? ` Its saved setup was cleared — with ${merged0.ends.length} loose ends `
                          + `this route is no longer a single run of stops, so a later Generate `
                          + `will not rebuild it from settings that no longer fit.`
                        : '';

                    const sf = contRun.result.shortfall;
                    if (sf) {
                        const hexes = sf.distance === 1 ? '1 hex' : `${sf.distance} hexes`;
                        showToast(`"${routeName}": ${added} segment(s) added, but stopped short at `
                                + `${formatWorldLabel(sf.reachedId)} — ${hexes} from `
                                + `${formatWorldLabel(sf.targetId)}, which could not be reached.`
                                + setupNote, 12000);
                    } else if (!merged.ok) {
                        // Committed on purpose: the segments are real and draw
                        // correctly. What is lost is ordered listing, so say so
                        // rather than let the panel quietly go alphabetical.
                        // chain.crosses is the state BEFORE this continuation, so
                        // a route that already crossed itself is not told the new
                        // leg did it.
                        showToast((chain.crosses || chain.ends.length > 2
                            ? `"${routeName}": ${added} segment(s) added. This route does not run `
                              + `end to end, as it already did not, so its worlds are listed `
                              + `alphabetically rather than in travel order.`
                            : `"${routeName}": ${added} segment(s) added, but the new leg rejoins `
                              + `the route, so it no longer runs end to end — its worlds will be `
                              + `listed alphabetically rather than in travel order.`) + setupNote, 12000);
                    } else {
                        showToast(`"${routeName}": ${added} segment(s) added — the route now runs `
                                + `${formatWorldLabel(merged.ends[0])} to `
                                + `${formatWorldLabel(merged.ends[1])}.` + setupNote, 5000);
                    }
                    return;
                }

                const p2pRun = _generateIntoSlot(`Generate Point-to-Point: ${routeName}`, routeId,
                    () => generatePointToPointRoute(startId, endId, maxJump, routeDef.color, groupId, routeName, true, filteredIds, routeId, waypointIds, p2pAllowEmpty, p2pMaxEmpty, p2pAllowPartial));
                if (!p2pRun.produced) {
                    // Duration scales with the message: naming the closest world it
                    // could reach, and pointing at the option that would have kept
                    // the route, makes this far longer than the 6s it used to get —
                    // and it is the one message here the user most needs to finish.
                    const failMsg = _p2pFailureMessage(p2pRun.result, maxJump, p2pAllowPartial);
                    showToast(failMsg, failMsg.length > 180 ? 12000 : 9000);
                    return;
                }
                const count = p2pRun.result.segments;
                _saveAutomationConfig(routeId, 'p2p', {
                    startId, endId, waypointIds,
                    maxJump,
                    allowEmptyHexes: p2pAllowEmpty,
                    maxEmptyJumps:   p2pMaxEmpty,
                    allowPartial:    p2pAllowPartial,
                    // Persisted so reopening the panel can still say this route
                    // never reached its End. Regenerating rewrites it; hand-editing
                    // the segments afterwards makes it stale, which is accepted —
                    // the alternative was storing the whole generated path, which
                    // goes stale the same way and is far bigger.
                    shortfall:       p2pRun.result.shortfall || null
                });
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                const sf = p2pRun.result.shortfall;
                if (sf) {
                    // Never say "from X to Y" here: Y is the End it did NOT reach.
                    // Reporting the stop it actually ended on is the whole point.
                    const hexes = sf.distance === 1 ? '1 hex' : `${sf.distance} hexes`;
                    showToast(`"${routeName}": ${count} segment(s), but stopped short at `
                            + `${formatWorldLabel(sf.reachedId)} — ${hexes} from `
                            + `${formatWorldLabel(sf.targetId)}, which could not be reached.`, 9000);
                } else {
                    const wpNote = waypointIds.length > 0 ? ` via ${waypointIds.length} waypoint(s)` : '';
                    // formatWorldLabel, not the bare hex IDs this used to print:
                    // every other message in this flow names a stop the way the
                    // builder's own fields do, and a bare hex number is not
                    // something the user can place on the map at a glance.
                    // 4s rather than 3s — the labels make it about a third longer.
                    showToast(`"${routeName}" generated: ${count} segment(s) from `
                            + `${formatWorldLabel(startId)} to ${formatWorldLabel(endId)}${wpNote}.`, 4000);
                }
                return;
            }

            if (type === 'btn') {
                const { lowerBTN, minBTN, maxBTN, maxJump, range } = configs.btn;
                if (!Number.isFinite(lowerBTN) || !Number.isFinite(minBTN)) {
                    showToast('Lower BTN and Min BTN must be valid numbers.', 2500);
                    return;
                }
                if (lowerBTN > minBTN) {
                    showToast('Lower BTN must be ≤ Min BTN.', 2500);
                    return;
                }
                if (!Number.isFinite(maxJump) || !Number.isFinite(range)) {
                    showToast('Max Jump and Range must be valid numbers.', 2500);
                    return;
                }
                const groupId = `btn_${routeId}`;
                const btnRun = _generateIntoSlot(`Generate BTN Routes: ${routeName}`, routeId,
                    () => generateBTNRoutes({
                        lowerBTN, minBTN, maxBTN, maxJump, range,
                        color: routeDef.color, groupId, name: routeName, routeId
                    }));
                const result = btnRun.result;
                if (!btnRun.produced) {
                    showToast(`"${routeName}": no world pairs met BTN ${minBTN}${maxBTN !== null ? `–${maxBTN}` : '+'} — nothing was changed.`, 4000);
                    return;
                }
                if (window.isLoggingEnabled && window.batchLogData && window.batchLogData.length > 0) {
                    downloadBatchLog('BTN_Routes', result.included);
                }
                _saveAutomationConfig(routeId, 'btn', { lowerBTN, minBTN, maxBTN, maxJump, range });
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                const maxLabel = maxBTN !== null ? `–${maxBTN}` : '+';
                showToast(
                    `"${routeName}" BTN[${lowerBTN}/${minBTN}${maxLabel}]: ${result.segments} seg — ${result.fullRoutes} full + ${result.promoted} promoted seg. (${result.included} worlds, ${result.skipped} skipped)`,
                    5000
                );
                return;
            }

            showToast(`[Stub] ${type.toUpperCase()} → "${routeName}" — not yet implemented.`, 3000);
        });
    }

    // Wire Allow Empty Hexes checkboxes show/hide
    const networkAllowEmpty = document.getElementById('route-auto-network-allow-empty');
    const networkEmptyOpts  = document.getElementById('route-auto-network-empty-opts');
    if (networkAllowEmpty && networkEmptyOpts) {
        networkAllowEmpty.addEventListener('change', () => {
            networkEmptyOpts.style.display = networkAllowEmpty.checked ? 'block' : 'none';
        });
    }

    const p2pAllowEmpty = document.getElementById('route-auto-p2p-allow-empty');
    const p2pEmptyOpts  = document.getElementById('route-auto-p2p-empty-opts');
    if (p2pAllowEmpty && p2pEmptyOpts) {
        p2pAllowEmpty.addEventListener('change', () => {
            p2pEmptyOpts.style.display = p2pAllowEmpty.checked ? 'block' : 'none';
        });
    }

    // Continue mode rewrites the form on tick and restores it on untick.
    // Attached once at init, like the checkbox above — the panel's markup is
    // static, so listeners cannot stack.
    const p2pContinueCb = document.getElementById('route-auto-p2p-continue');
    if (p2pContinueCb) {
        p2pContinueCb.addEventListener('change', () => _applyContinueMode(p2pContinueCb.checked));
    }

    // Wire world autocomplete to the P2P start/end inputs (runs once at init)
    const p2pStartIn   = document.getElementById('route-auto-p2p-start');
    const p2pStartDrop = document.getElementById('route-auto-p2p-start-drop');
    const p2pEndIn     = document.getElementById('route-auto-p2p-end');
    const p2pEndDrop   = document.getElementById('route-auto-p2p-end-drop');
    if (p2pStartIn && p2pStartDrop) setupWorldAutocomplete(p2pStartIn, p2pStartDrop);
    if (p2pEndIn   && p2pEndDrop)   setupWorldAutocomplete(p2pEndIn,   p2pEndDrop);

    // Wire "Add Waypoint" button
    const addWpBtn = document.getElementById('btn-p2p-add-waypoint');
    // Wrapped, not passed directly — the click Event would land in prefillValue.
    if (addWpBtn) addWpBtn.addEventListener('click', () => addWaypointRow());

    // Wire the Start/End "pick on map" buttons and the chain-mode toggle.
    // Waypoint rows wire their own button in addWaypointRow().
    document.querySelectorAll('#route-auto-config-p2p .p2p-pick-btn[data-pick-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            MapPick.armField(document.getElementById(btn.dataset.pickTarget),
                             btn.dataset.pickLabel || 'this stop');
        });
    });

    const chainBtn = document.getElementById('btn-p2p-chain');
    if (chainBtn) chainBtn.addEventListener('click', () => MapPick.startChain());
}

window.ensureFreeRouteSlot = function () {
    if (!window.routeDefinitions) window.routeDefinitions = getDefaultRouteDefinitions();
    const segCounts = new Map();
    (window.sectorRoutes || []).forEach(r => {
        if (r.routeId != null) segCounts.set(r.routeId, (segCounts.get(r.routeId) || 0) + 1);
    });
    const hasFree = window.routeDefinitions.some(d => (segCounts.get(d.id) || 0) === 0);
    if (hasFree) return false;
    const nextId = _nextRouteSlotId();
    window.routeDefinitions.push({
        id: nextId, name: `Route ${nextId}`, color: _nextRouteColor(),
        shortcut: _nextRouteShortcut(), visible: true, automationRef: null,
    });
    return true;
};

/**
 * The next free slot id.
 *
 * Counts the SEGMENTS as well as the definitions. Deleting the highest-numbered
 * route frees its number, and max + 1 would hand that number straight back to
 * the next slot created — which would then adopt any segment still carrying it.
 * Delete clears its own segments, so the everyday path is safe, but a route file
 * loaded into a slot that was later removed, or an import that left segments
 * behind, is not: the new route would silently arrive with someone else's
 * connections already drawn on it.
 *
 * Non-numeric ids are ignored rather than trusted, so one malformed definition
 * in a loaded file cannot make Math.max return NaN and poison every slot created
 * afterwards.
 */
function _nextRouteSlotId() {
    const ids = [
        ...(window.routeDefinitions || []).map(d => d.id),
        ...(window.sectorRoutes     || []).map(r => r.routeId),
    ].map(Number).filter(n => Number.isFinite(n));
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

/**
 * A colour for a new slot: the first of the nine defaults not already on the
 * map, so a map whose routes have been deleted and rebuilt looks like a fresh
 * one rather than a column of identical green. Past nine routes the palette is
 * exhausted and a random colour is used, which the user can change anyway.
 */
function _nextRouteColor() {
    const used = new Set((window.routeDefinitions || [])
        .map(d => (d.color || '').toLowerCase()));
    const free = getDefaultRouteDefinitions().map(d => d.color)
        .find(c => !used.has(c.toLowerCase()));
    if (free) return free;
    return '#' + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0');
}

/**
 * The lowest digit key not already bound to a route, or null when all nine are
 * taken. Deleting a route frees its key, so a rebuilt map gets its 1-9 back.
 */
function _nextRouteShortcut() {
    const used = new Set((window.routeDefinitions || [])
        .map(d => (d.shortcut || '').toLowerCase()).filter(Boolean));
    return '123456789'.split('').find(k => !used.has(k)) || null;
}

/**
 * Adds an empty route slot on demand — the Add Route button.
 *
 * ensureFreeRouteSlot() above is a safety net, not a way to make routes: it
 * tops the list up to exactly one spare and only when every existing slot is
 * already in use, so a user who has deleted slots down to a set that still
 * contains one empty one has no way to obtain a second. This is that way.
 */
window.addRouteSlot = function () {
    if (!window.routeDefinitions) window.routeDefinitions = getDefaultRouteDefinitions();
    saveHistoryState('Add route', { includeRouteDefinitions: true });

    const id = _nextRouteSlotId();
    const def = {
        id,
        name: `Route ${id}`,
        color: _nextRouteColor(),
        shortcut: _nextRouteShortcut(),
        visible: true,
        automationRef: null,
    };
    window.routeDefinitions.push(def);
    if (window.dbManager) window.dbManager.saveRouteDefinitions();

    window.renderRouteWindow();

    // Put the cursor in the new row's name so it can be named straight away —
    // the row is appended at the bottom, which on a long list is off-screen.
    const row = document.querySelector(`#route-window-list .route-row[data-route-id="${def.id}"]`);
    if (row) {
        row.scrollIntoView({ block: 'nearest' });
        const nameIn = row.querySelector('.route-name-input');
        if (nameIn) { nameIn.focus(); nameIn.select(); }
    }
    showToast(`Added "${def.name}". Ctrl+Z removes it.`, 2500);
};


/**
 * Route definitions left behind by the pre-fix resolveRouteId(), which created
 * one for every Filter groupId it did not recognise — so a slot's first
 * Point-to-Point, Custom Network or BTN generation added an empty duplicate,
 * named after the route being generated.
 *
 * The three conditions are a conjunction on purpose. A groupId alone does NOT
 * mark a phantom: migrateToRouteDefinitions() legitimately stamps one on every
 * definition it rebuilds from a pre-v0.10 save file, and those own segments.
 * Requiring the slot to be empty and unconfigured as well is what makes the
 * test safe on an imported sector.
 */
function getOrphanRouteDefinitions() {
    const used = new Set((window.sectorRoutes || []).map(r => r.routeId));
    return (window.routeDefinitions || []).filter(d =>
        d.groupId && !used.has(d.id) && !d.automationRef);
}

/**
 * Shows the "duplicate empty slots" notice when there is anything to clean up.
 * Removal is offered rather than done: the detection is a heuristic about data
 * this app previously wrote, and a slot the user has renamed and is about to
 * fill would look identical to a phantom.
 */
function renderOrphanRouteNotice() {
    const notice = document.getElementById('route-orphan-notice');
    if (!notice) return;

    const orphans = getOrphanRouteDefinitions();
    if (orphans.length === 0) {
        notice.style.display = 'none';
        notice.innerHTML = '';
        return;
    }

    notice.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = orphans.length === 1
        ? '1 empty duplicate route slot was left behind by an earlier bug.'
        : `${orphans.length} empty duplicate route slots were left behind by an earlier bug.`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'route-orphan-remove';
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
        const names = orphans.map(d => `  • ${d.name}`).join('\n');
        if (!window.confirm(
            `Remove ${orphans.length} empty duplicate route slot${orphans.length !== 1 ? 's' : ''}?\n\n${names}\n\n` +
            'None of them holds any map segments. This can be undone with Ctrl+Z.')) return;

        saveHistoryState('Remove duplicate route slots', { includeRouteDefinitions: true });
        const doomed = new Set(orphans.map(d => d.id));
        window.routeDefinitions = (window.routeDefinitions || []).filter(d => !doomed.has(d.id));
        if (window.dbManager) window.dbManager.saveRouteDefinitions();
        window.renderRouteWindow();
        showToast(`Removed ${doomed.size} duplicate route slot${doomed.size !== 1 ? 's' : ''}.`, 2500);
    });

    notice.appendChild(text);
    notice.appendChild(btn);
    notice.style.display = 'flex';
}

window.renderRouteWindow = function () {
    const list = document.getElementById('route-window-list');
    if (!list) return;
    list.innerHTML = '';
    window.closeRouteAutoPanel();
    window.closeRouteSystemsPanel();

    // No ensureFreeRouteSlot() here. It used to top the list up to one spare
    // every time the window drew, which put it in direct conflict with Delete:
    // deleting the last free slot re-created it on the spot, with the same id
    // (max + 1 hands back the number just freed), the same first-unused colour
    // and the same first-free shortcut — so the row reappeared identical to the
    // one just removed, under a toast saying it had been deleted. Deleting the
    // fourth of four routes looked like it had simply not worked.
    //
    // The Add Route button makes the top-up unnecessary as well as harmful:
    // slots are now created when the user asks for one. It still runs on the
    // import paths, where a bulk import can fill every slot and the user has not
    // just asked for one to go away.

    const segCounts = new Map();
    (window.sectorRoutes || []).forEach(r => {
        if (r.routeId != null) segCounts.set(r.routeId, (segCounts.get(r.routeId) || 0) + 1);
    });

    const defs = window.routeDefinitions;
    defs.forEach((def) => {
        const segCount = segCounts.get(def.id) || 0;
        const segClass = segCount > 0 ? 'used' : 'free';
        const segLabel = segCount > 0 ? segCount : '&mdash;';
        const row = document.createElement('div');
        row.className = 'route-row';
        row.dataset.routeId = def.id;
        row.style.opacity = def.visible ? '1' : '0.45';
        row.innerHTML = `
            <span class="route-seg-count ${segClass}" title="${segCount} segment(s)">${segLabel}</span>
            <input type="text" class="route-name-input" value="${def.name.replace(/"/g, '&quot;')}" title="Route name" />
            <input type="color" class="route-color-swatch" value="${def.color}" title="Route color" />
            <input type="text" class="route-shortcut-input" maxlength="1" placeholder="key" value="${def.shortcut || ''}" title="Shortcut key" />
            <i class="fas fa-eye${def.visible ? '' : '-slash'} route-eye-btn" style="color:${def.visible ? '#45a29e' : '#666'};cursor:pointer;font-size:0.8rem;" title="${def.visible ? 'Disable route' : 'Enable route'}"></i>
            <button class="route-clear-btn" title="Remove all map segments for this route">C</button>
            <button class="route-csv-btn route-export-btn"${segCount > 0 ? '' : ' disabled'} title="${segCount > 0 ? 'Export the worlds this route passes through, as a spreadsheet' : 'No segments to export'}">CSV</button>
            <span class="route-file-cell">
                <i class="fas fa-file-export route-save-btn" style="color:${segCount > 0 ? '#45a29e' : '#333'};cursor:${segCount > 0 ? 'pointer' : 'default'};opacity:${segCount > 0 ? '1' : '0.3'};" title="${segCount > 0 ? 'Save this route to a file' : 'No connections to save'}"></i>
                <i class="fas fa-file-import route-load-btn" style="color:#45a29e;cursor:pointer;" title="Load a route file into '${def.name.replace(/'/g, "&#39;")}'"></i>
            </span>
            <i class="fas fa-link route-combine-btn" style="color:#45a29e;" title="Combine another route into this one"></i>
            <button class="route-auto-btn" title="Set up automation for ${def.name}">&#9881; Auto</button>
            <i class="fas fa-times route-delete-btn" style="color:#ff4500;cursor:pointer;font-size:0.8rem;" title="Delete route '${def.name.replace(/'/g, "&#39;")}'"></i>
        `;
        const nameIn  = row.querySelector('.route-name-input');
        const colorIn = row.querySelector('.route-color-swatch');
        const shortIn = row.querySelector('.route-shortcut-input');
        const eyeBtn  = row.querySelector('.route-eye-btn');
        const delBtn  = row.querySelector('.route-delete-btn');
        const combBtn = row.querySelector('.route-combine-btn');
        if (combBtn) {
            combBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (combBtn.classList.contains('disabled')) return;
                _openCombinePicker(def.id, combBtn);
            });
        }

        nameIn.addEventListener('change', () => {
            def.name = nameIn.value;
            if (window.dbManager) window.dbManager.saveRouteDefinitions();
            requestAnimationFrame(draw);
        });
        colorIn.addEventListener('input', () => {
            def.color = colorIn.value;
            if (window.dbManager) window.dbManager.saveRouteDefinitions();
            requestAnimationFrame(draw);
        });
        shortIn.addEventListener('change', () => {
            const RESERVED = ['f', 'r'];
            const typed = shortIn.value.toLowerCase();
            if (RESERVED.includes(typed)) {
                showToast(`'${typed}' is reserved for a window shortcut.`, 2500);
                shortIn.value = def.shortcut || '';
                return;
            }
            def.shortcut = typed;
            if (window.dbManager) window.dbManager.saveRouteDefinitions();
        });
        eyeBtn.addEventListener('click', () => {
            def.visible = !def.visible;
            eyeBtn.classList.toggle('fa-eye', def.visible);
            eyeBtn.classList.toggle('fa-eye-slash', !def.visible);
            eyeBtn.style.color = def.visible ? '#45a29e' : '#666';
            eyeBtn.title = def.visible ? 'Disable route' : 'Enable route';
            row.style.opacity = def.visible ? '1' : '0.45';
            if (window.dbManager) window.dbManager.saveRouteDefinitions();
            const allCb = document.getElementById('route-vis-all-check');
            if (allCb) {
                const defs2 = window.routeDefinitions || [];
                const vis2 = defs2.filter(d => d.visible).length;
                allCb.indeterminate = vis2 > 0 && vis2 < defs2.length;
                allCb.checked       = vis2 === defs2.length;
            }
            requestAnimationFrame(draw);
        });

        delBtn.addEventListener('click', () => {
            const segments = (window.sectorRoutes || []).filter(r => r.routeId === def.id);
            const segMsg = segments.length > 0 ? `\nThis will also clear its ${segments.length} segment(s).` : '';
            if (!window.confirm(`Delete route "${def.name}"?${segMsg}\n\nThis can be undone with Ctrl+Z.`)) return;
            // The confirm above promises Ctrl+Z will bring it back, and until
            // the snapshot carried the definitions that was only half true: the
            // segments returned, orphaned, to a slot that no longer existed.
            saveHistoryState(`Delete ${def.name}`, { includeRouteDefinitions: true });
            window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== def.id);
            window.routeDefinitions = (window.routeDefinitions || []).filter(d => d.id !== def.id);
            if (window.dbManager) { window.dbManager.saveRoutes(); window.dbManager.saveRouteDefinitions(); }
            requestAnimationFrame(draw);
            window.renderRouteWindow();
            showToast(`Deleted route "${def.name}".`, 2000);
        });

        // Segment-count pill: click to view route systems
        const pill = row.querySelector('.route-seg-count');
        if (pill && segCount > 0) {
            pill.style.cursor = 'pointer';
            pill.title = `${segCount} segment(s) — click to view systems`;
            pill.addEventListener('click', () => window.openRouteSystemsPanel(def.id, def.name));
        }

        // .onclick for save, matching the export button below and for the same
        // reason: refreshRouteWindowCounts() re-assigns it as counts change, and
        // a listener here would stack alongside that one.
        const saveBtn = row.querySelector('.route-save-btn');
        if (saveBtn) saveBtn.onclick = segCount > 0 ? () => exportRouteFile(def.id, def.name) : null;

        // Load is always available — filling an empty slot is the normal case —
        // and refreshRouteWindowCounts() never touches it, so a listener is safe.
        const loadBtn = row.querySelector('.route-load-btn');
        if (loadBtn) loadBtn.addEventListener('click', () => _pickRouteFileFor(def.id, def.name));

        const exportBtn = row.querySelector('.route-export-btn');
        if (exportBtn) {
            // .onclick, not addEventListener — refreshRouteWindowCounts() assigns
            // this same property, and a listener here would stack alongside it so
            // one click opened the export modal twice.
            exportBtn.onclick = segCount > 0 ? () => openRouteExportModal(def.id, def.name) : null;
        }

        const autoBtn = row.querySelector('.route-auto-btn');
        autoBtn.addEventListener('click', () => {
            window.closeRouteSystemsPanel();
            window.openRouteAutoPanel(def.id, def.name);
        });

        const clearBtn = row.querySelector('.route-clear-btn');
        clearBtn.addEventListener('click', () => {
            const segments = (window.sectorRoutes || []).filter(r => r.routeId === def.id);
            if (segments.length === 0) {
                showToast(`No segments to clear for "${def.name}".`, 2000);
                return;
            }
            const confirmed = window.confirm(
                `Clear all ${segments.length} segment(s) from "${def.name}"?\n\nThis can be undone with Ctrl+Z.`
            );
            if (!confirmed) return;
            saveHistoryState(`Clear ${def.name}`);
            window.sectorRoutes = window.sectorRoutes.filter(r => r.routeId !== def.id);
            if (window.dbManager) window.dbManager.saveRoutes();
            requestAnimationFrame(draw);
            window.closeRouteSystemsPanel();
            window.refreshRouteWindowCounts();
            showToast(`Cleared ${segments.length} segment(s) from "${def.name}".`, 2000);
        });

        list.appendChild(row);
    });

    renderOrphanRouteNotice();

    // Sync the "Show All" header checkbox to the current visibility state.
    const visAllCb = document.getElementById('route-vis-all-check');
    if (visAllCb) {
        const visCount = defs.filter(d => d.visible).length;
        visAllCb.indeterminate = visCount > 0 && visCount < defs.length;
        visAllCb.checked       = visCount === defs.length;
    }
};

window.toggleRouteWindow = function () {
    const win = document.getElementById('route-window');
    if (!win) return;
    if (win.classList.contains('visible')) {
        window.closeRouteWindow();
    } else {
        window.renderRouteWindow();
        win.classList.add('visible');
    }
};

window.closeRouteWindow = function () {
    MapPick.cancel();
    _wacHideActive();   // portaled onto <body>; hiding the window won't hide it
    const win = document.getElementById('route-window');
    if (win) win.classList.remove('visible');
};

// ── Combine (route_extend_spec.md §5) ────────────────────────────────────────

let _combinePickerEl = null;

/**
 * The picker lives on <body>, not inside #route-window. `.draggable-palette`
 * carries backdrop-filter, which makes it the containing block for position:fixed
 * descendants, and its overflow:hidden then clips them — the failure is invisible
 * (built, display:block, correct contents, painted somewhere off-screen) and it
 * cost most of v0.17.2 item 1.
 */
function _ensureCombinePicker() {
    if (_combinePickerEl && document.body.contains(_combinePickerEl)) return _combinePickerEl;
    const el = document.createElement('div');
    el.id = 'route-combine-picker';
    el.style.display = 'none';
    document.body.appendChild(el);
    _combinePickerEl = el;
    return el;
}

function _closeCombinePicker() {
    if (_combinePickerEl) _combinePickerEl.style.display = 'none';
}

document.addEventListener('mousedown', (e) => {
    if (!_combinePickerEl || _combinePickerEl.style.display === 'none') return;
    if (_combinePickerEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.route-combine-btn')) return;
    _closeCombinePicker();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') _closeCombinePicker();
});

function _openCombinePicker(routeId, anchorEl) {
    const def = (window.routeDefinitions || []).find(d => d.id === routeId);
    if (!def) return;
    const cands = getCombineCandidates(routeId);
    if (cands.length === 0) {
        showToast(`No other route meets "${def.name}" end to end, so there is nothing to `
                + `combine it with.`, 4000);
        return;
    }

    const el = _ensureCombinePicker();
    el.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'rcp-head';
    head.textContent = `Combine into "${def.name}"`;
    el.appendChild(head);

    cands.forEach(c => {
        const row = document.createElement('div');
        row.className = 'rcp-item';

        const sw = document.createElement('span');
        sw.className = 'rcp-swatch';
        sw.style.background = c.color || '#888';
        row.appendChild(sw);

        const nm = document.createElement('span');
        nm.className = 'rcp-name';
        nm.textContent = c.name;
        row.appendChild(nm);

        const meta = document.createElement('span');
        meta.className = 'rcp-meta';
        meta.textContent = c.sharedIds.length === 1
            ? `meets at ${formatWorldLabel(c.sharedIds[0])}`
            : `${c.segCount} segment(s)`;
        row.appendChild(meta);

        row.title = `${c.segCount} segment(s) will move into "${def.name}".`;
        row.addEventListener('click', () => {
            _closeCombinePicker();
            _combineRoutes(routeId, c);
        });
        el.appendChild(row);
    });

    el.style.display = 'block';
    const r = anchorEl.getBoundingClientRect();
    const w = el.offsetWidth || 260;
    const h = el.offsetHeight || 120;
    let left = r.left;
    let top  = r.bottom + 4;
    if (left + w > window.innerWidth - 8)  left = window.innerWidth - w - 8;
    if (top  + h > window.innerHeight - 8) top  = Math.max(8, r.top - h - 4);
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top  = `${top}px`;
}

/**
 * Folds `cand` into `destId`. The destination keeps its name, colour and shortcut;
 * the absorbed slot is removed (M4).
 */
function _combineRoutes(destId, cand) {
    const defs    = window.routeDefinitions || [];
    const destDef = defs.find(d => d.id === destId);
    const srcDef  = defs.find(d => d.id === cand.routeId);
    if (!destDef || !srcDef) return;

    const all      = window.sectorRoutes || [];
    const destSegs = all.filter(r => r.routeId === destId);
    const srcSegs  = all.filter(r => r.routeId === cand.routeId);
    if (srcSegs.length === 0) return;

    const where = cand.sharedIds.length === 1
        ? `They meet at ${formatWorldLabel(cand.sharedIds[0])}.`
        : `They share ${cand.sharedIds.length} worlds.`;
    const ok = window.confirm(
        `Combine "${srcDef.name}" into "${destDef.name}"?\n\n` +
        `${where}\n` +
        `${srcSegs.length} segment(s) move across, and they take on "${destDef.name}"'s colour.\n` +
        `"${srcDef.name}" is then removed from the Route Manager.\n\n` +
        `This can be undone with Ctrl+Z.`
    );
    if (!ok) return;

    // includeRouteDefinitions: a definition is being deleted, and without it the
    // absorbed slot would not come back on undo — the segments would return
    // belonging to a route that no longer exists.
    saveHistoryState(`Combine ${srcDef.name} into ${destDef.name}`, { includeRouteDefinitions: true });

    // The same typeMap canvas_input, the XML importer and route-file import all
    // use. An absorbed segment has to be indistinguishable from one drawn on the
    // destination, or the renderer draws it on a different layer and the alt-drag
    // toggle behaves inconsistently.
    const typeMap = { 1: 'Xboat', 2: 'Trade', 3: 'Secondary' };
    const type    = typeMap[destId] || 'Filter';
    const groupId = (destSegs.length && destSegs[0].groupId) ? destSegs[0].groupId : `p2p_${destId}`;

    const key  = seg => [seg.startId, seg.endId].slice().sort().join('|');
    const have = new Set(destSegs.map(key));

    let moved = 0, duplicates = 0;
    for (const seg of srcSegs) {
        if (have.has(key(seg))) { duplicates++; continue; }   // left behind, dropped below
        seg.routeId = destId;
        seg.type    = type;
        if (type === 'Filter') seg.groupId = groupId; else delete seg.groupId;
        // No colour of its own: the renderer prefers the definition's colour and
        // only falls back to seg.color, so dropping it is what makes the segment
        // wear the destination's colour.
        delete seg.color;
        have.add(key(seg));
        moved++;
    }

    // Anything still carrying the source id is a duplicate of a segment the
    // destination already had, so this both removes the old slot's segments and
    // performs the dedupe.
    window.sectorRoutes = all.filter(r => r.routeId !== cand.routeId);

    stampRouteSubtype(destId);
    window.routeDefinitions = defs.filter(d => d.id !== cand.routeId);

    if (window.dbManager) { window.dbManager.saveRoutes(); window.dbManager.saveRouteDefinitions(); }
    window.renderRouteWindow();
    requestAnimationFrame(draw);

    const merged = getRouteChain(destId);
    const dupNote = duplicates > 0 ? ` ${duplicates} duplicate segment(s) were not added twice.` : '';
    if (merged.ok) {
        showToast(`Combined into "${destDef.name}": ${moved} segment(s) added — the route now runs `
                + `${formatWorldLabel(merged.ends[0])} to ${formatWorldLabel(merged.ends[1])}.${dupNote}`, 6000);
    } else {
        showToast(`Combined into "${destDef.name}": ${moved} segment(s) added.${dupNote}`, 5000);
    }
}

window.refreshRouteWindowCounts = function () {
    const win = document.getElementById('route-window');
    if (!win || !win.classList.contains('visible')) return;
    const segCounts = new Map();
    (window.sectorRoutes || []).forEach(r => {
        if (r.routeId != null) segCounts.set(r.routeId, (segCounts.get(r.routeId) || 0) + 1);
    });

    // If the systems panel is open for a route that now has 0 segments, close it
    const sysPanel = document.getElementById('route-systems-panel');
    const sysPanelRouteId = sysPanel ? parseInt(sysPanel.dataset.routeId, 10) : null;

    document.querySelectorAll('#route-window-list .route-row').forEach(row => {
        const routeId = parseInt(row.dataset.routeId, 10);
        const pill = row.querySelector('.route-seg-count');
        if (!pill) return;
        const count = segCounts.get(routeId) || 0;
        pill.innerHTML = count > 0 ? count : '&mdash;';
        pill.className = `route-seg-count ${count > 0 ? 'used' : 'free'}`;
        const def = (window.routeDefinitions || []).find(d => d.id === routeId);
        const routeName = def ? def.name : `Route #${routeId}`;

        if (count > 0) {
            pill.style.cursor = 'pointer';
            pill.title = `${count} segment(s) — click to view systems`;
            if (!pill.dataset.listenerAttached) {
                pill.addEventListener('click', () => window.openRouteSystemsPanel(routeId, routeName));
                pill.dataset.listenerAttached = 'true';
            }
        } else {
            pill.style.cursor = '';
            pill.title = '0 segment(s)';
            if (routeId === sysPanelRouteId) window.closeRouteSystemsPanel();
        }

        const saveBtn = row.querySelector('.route-save-btn');
        if (saveBtn) {
            saveBtn.style.color   = count > 0 ? '#45a29e' : '#333';
            saveBtn.style.cursor  = count > 0 ? 'pointer'  : 'default';
            saveBtn.style.opacity = count > 0 ? '1' : '0.3';
            saveBtn.title   = count > 0 ? 'Save this route to a file' : 'No connections to save';
            saveBtn.onclick = count > 0 ? () => exportRouteFile(routeId, routeName) : null;
        }

        // Eligibility depends on the segments in EVERY slot, so it changes whenever
        // any route does. Setting it only in renderRouteWindow would leave the icon
        // stale the moment a route was generated.
        const combBtn2 = row.querySelector('.route-combine-btn');
        if (combBtn2) {
            const eligible = count > 0 && getCombineCandidates(routeId).length > 0;
            combBtn2.classList.toggle('disabled', !eligible);
            combBtn2.style.color = eligible ? '#45a29e' : '#333';
            combBtn2.title = eligible
                ? 'Combine another route into this one'
                : (count === 0
                    ? 'This route has no segments to combine into'
                    : 'No other route meets this one end to end');
        }

        const exportBtn = row.querySelector('.route-export-btn');
        if (exportBtn) {
            // A <button> since WP5, so enablement is `disabled` rather than
            // inline opacity — .route-csv-btn:disabled carries the styling.
            exportBtn.disabled = count === 0;
            exportBtn.title = count > 0
                ? 'Export the worlds this route passes through, as a spreadsheet'
                : 'No segments to export';
            exportBtn.onclick = count > 0 ? () => openRouteExportModal(routeId, routeName) : null;
        }
    });

    // The Continue box has the same problem the Combine icon above has, and for
    // the same reason: it describes the segments in a slot, so it goes stale the
    // moment they change. Every path that alters a slot's segments with the
    // Automation Panel open — drawing on the map, Clear, loading a route file —
    // passes through here.
    _refreshContinueControl();
};

window.openRouteAutoPanel = function (routeId, routeName) {
    const panel = document.getElementById('route-auto-panel');
    const nameEl = document.getElementById('route-auto-panel-route-name');
    if (!panel || !nameEl) return;
    MapPick.cancel();   // never inherit an armed pick from the previous slot
    panel.dataset.targetRouteId = routeId;
    nameEl.textContent = routeName;
    document.querySelectorAll('input[name="route-auto-type"]').forEach(r => r.checked = false);
    document.querySelectorAll('.route-auto-option').forEach(opt => opt.classList.remove('open'));
    document.getElementById('btn-route-auto-generate').disabled = true;

    // Pre-populate P2P start/end from the current hex selection (1 or 2 hexes).
    const selArray = typeof selectedHexes !== 'undefined' ? [...selectedHexes] : [];
    const startIn = document.getElementById('route-auto-p2p-start');
    const endIn   = document.getElementById('route-auto-p2p-end');
    if (startIn) startIn.value = selArray[0] ? formatWorldLabel(selArray[0]) : '';
    if (endIn)   endIn.value   = selArray[1] ? formatWorldLabel(selArray[1]) : '';

    // Clear any waypoints from a previous session
    const wpList = document.getElementById('route-auto-p2p-waypoints-list');
    if (wpList) wpList.innerHTML = '';

    // Reset Allow Empty Hexes checkboxes and hide their option sections
    const netEmptyCb = document.getElementById('route-auto-network-allow-empty');
    const netEmptyOpts = document.getElementById('route-auto-network-empty-opts');
    if (netEmptyCb) netEmptyCb.checked = false;
    if (netEmptyOpts) netEmptyOpts.style.display = 'none';

    const p2pEmptyCb = document.getElementById('route-auto-p2p-allow-empty');
    const p2pEmptyOptsEl = document.getElementById('route-auto-p2p-empty-opts');
    if (p2pEmptyCb) p2pEmptyCb.checked = false;
    if (p2pEmptyOptsEl) p2pEmptyOptsEl.style.display = 'none';

    // Restore this slot's last generated setup, if it has one. Runs after the
    // resets above so it wins, and takes precedence over the hex-selection
    // prefill — reopening a configured route is for editing it, not restarting.
    _restoreAutomationConfig(routeId);

    // After the restore, so the box is off however the slot was last left (C6),
    // and its enabled state reflects the segments actually in the slot now.
    _syncContinueControl(routeId);

    refreshStopFieldStyles();

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.closeRouteAutoPanel = function () {
    const panel = document.getElementById('route-auto-panel');
    if (!panel) return;
    MapPick.cancel();   // the crosshair must not outlive the panel
    _wacHideActive();   // portaled onto <body>; hiding the panel won't hide it
    panel.style.display = 'none';
    panel.dataset.targetRouteId = '';
    document.querySelectorAll('input[name="route-auto-type"]').forEach(r => r.checked = false);
    document.querySelectorAll('.route-auto-option').forEach(opt => opt.classList.remove('open'));
    const genBtn = document.getElementById('btn-route-auto-generate');
    if (genBtn) genBtn.disabled = true;
};

window.updateRouteFilterSummary = function () {
    const filterActive = hasAnyActiveFilter();
    let html;

    if (!filterActive) {
        html = `<span class="filter-none">No active filter.</span> ` +
               `<button class="inline-link" onclick="window.toggleFilterModal()">Open Filter</button>`;
    } else {
        // Count using the same source as getFilteredHexIds() — the isHiddenByFilter flag
        // stamped by the filter bar. Styling rules (activeFilterRules) are intentionally
        // excluded: they control display only and do not drive route generation.
        let matchCount = 0;
        if (typeof hexStates !== 'undefined') {
            hexStates.forEach(state => {
                if (state.type === 'SYSTEM_PRESENT' && !state.isHiddenByFilter) matchCount++;
            });
        }

        html = `<span class="filter-active">${matchCount} world${matchCount !== 1 ? 's' : ''} match active filter</span>` +
               `<div style="margin-top:5px;"><button class="inline-link" onclick="window.toggleFilterModal()">Edit Filter</button></div>`;

        // The Shift+F bypass hides the filter on screen but not from route
        // generation, so the map and this count deliberately disagree. Say so
        // here rather than letting it read as a bug.
        if (window.filterSuspended) {
            html = `<span class="filter-suspended">Filter is suspended on screen (Shift+F) ` +
                   `— it still applies to route generation.</span><div style="margin-top:5px;"></div>` + html;
        }
    }

    ['route-auto-filter-summary-p2p', 'route-auto-filter-summary-network'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
};

// ============================================================================
// SETTINGS PANEL
// ============================================================================

// Hides borders below window.borderMinSystems and restores them when the
// threshold drops back below their count.  Uses a hiddenByMinSystems flag to
// distinguish auto-hidden borders from ones the user manually turned off.
window.applyBorderMinSystems = function () {
    if (!window.borderDefinitions || !window.hexBorderAssignments) return;
    const threshold = window.borderMinSystems || 0;
    const hexCounts = new Map();
    window.hexBorderAssignments.forEach(borderId => {
        hexCounts.set(borderId, (hexCounts.get(borderId) || 0) + 1);
    });
    let changed = false;
    window.borderDefinitions.forEach(def => {
        const count = hexCounts.get(def.id) || 0;
        if (threshold > 0 && count < threshold) {
            if (def.visible) {
                def.visible = false;
                def.hiddenByMinSystems = true;
                changed = true;
            }
        } else {
            if (def.hiddenByMinSystems) {
                def.visible = true;
                def.hiddenByMinSystems = false;
                changed = true;
            }
        }
    });
    if (changed) {
        if (window.dbManager) window.dbManager.saveBorderDefinitions?.();
        if (typeof window.renderBorderWindow === 'function') window.renderBorderWindow();
        requestAnimationFrame(draw);
    }
};

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

    document.getElementById('toggle-sector-names').addEventListener('change', (e) => {
        showSectorNames = e.target.checked;
        requestAnimationFrame(draw);
    });

    // --- Sector Name Editor ---
    document.getElementById('btn-edit-sector-names').addEventListener('click', () => {
        const modal = document.getElementById('sector-name-editor-modal');
        const grid  = document.getElementById('sector-name-grid');
        grid.innerHTML = '';

        // Build a row of inputs per grid row, mirroring the map layout
        for (let sY = 0; sY < gridHeight; sY++) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:4px;';
            for (let sX = 0; sX < gridWidth; sX++) {
                const sectorNum = sY * gridWidth + sX + 1;
                const current = (window.sectorNames && window.sectorNames[sectorNum]) || '';
                const cell = document.createElement('div');
                cell.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:2px;';
                cell.innerHTML = `
                    <span style="color:#45a29e; font-size:0.65rem; text-align:center;">${sectorNum}</span>
                    <input type="text" data-sector="${sectorNum}"
                        value="${current.replace(/"/g, '&quot;')}"
                        placeholder="Sector ${sectorNum}"
                        style="width:100%; padding:3px 4px; background:#0d0f13; border:1px solid #2a3a3a;
                               color:#c5c6c7; font-size:0.7rem; font-family:'Courier New',monospace;
                               border-radius:3px; box-sizing:border-box;">
                `;
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }

        modal.style.display = 'flex';
    });

    document.getElementById('btn-sector-names-save').addEventListener('click', () => {
        const inputs = document.querySelectorAll('#sector-name-grid input[data-sector]');
        inputs.forEach(input => {
            const num = parseInt(input.dataset.sector, 10);
            const val = input.value.trim();
            if (val) {
                window.sectorNames[num] = val;
            } else {
                delete window.sectorNames[num];
            }
        });
        document.getElementById('sector-name-editor-modal').style.display = 'none';
        if (window.dbManager) window.dbManager.saveSectorNames();
        requestAnimationFrame(draw);
    });

    document.getElementById('btn-sector-names-cancel').addEventListener('click', () => {
        document.getElementById('sector-name-editor-modal').style.display = 'none';
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

    // --- Border minimum systems ---
    const borderMinInput = document.getElementById('input-border-min-systems');
    if (borderMinInput) {
        const saved = localStorage.getItem('traveller_border_min_systems');
        const initial = saved !== null ? parseInt(saved, 10) : 20;
        borderMinInput.value = initial;
        window.borderMinSystems = initial;

        borderMinInput.addEventListener('change', () => {
            const threshold = Math.max(0, parseInt(borderMinInput.value, 10) || 0);
            borderMinInput.value = threshold;
            window.borderMinSystems = threshold;
            localStorage.setItem('traveller_border_min_systems', String(threshold));
            window.applyBorderMinSystems();
        });
    }

    // --- Border territory fill ---
    const borderFillToggle = document.getElementById('toggle-border-fill');
    if (borderFillToggle) {
        const saved = localStorage.getItem('traveller_border_fill');
        window.borderFillEnabled = saved === 'true';
        borderFillToggle.checked = window.borderFillEnabled;
        borderFillToggle.addEventListener('change', () => {
            window.borderFillEnabled = borderFillToggle.checked;
            localStorage.setItem('traveller_border_fill', String(window.borderFillEnabled));
            requestAnimationFrame(draw);
        });
    }

    // --- Border names ---
    const borderNamesToggle = document.getElementById('toggle-border-names');
    if (borderNamesToggle) {
        const saved = localStorage.getItem('traveller_border_names');
        window.borderNamesEnabled = saved === 'true';
        borderNamesToggle.checked = window.borderNamesEnabled;
        borderNamesToggle.addEventListener('change', () => {
            window.borderNamesEnabled = borderNamesToggle.checked;
            localStorage.setItem('traveller_border_names', String(window.borderNamesEnabled));
            requestAnimationFrame(draw);
        });
    }

    // --- Region names ---
    const regionNamesToggle = document.getElementById('toggle-region-names');
    if (regionNamesToggle) {
        const saved = localStorage.getItem('traveller_region_names');
        window.regionNamesEnabled = saved === 'true';
        regionNamesToggle.checked = window.regionNamesEnabled;
        regionNamesToggle.addEventListener('change', () => {
            window.regionNamesEnabled = regionNamesToggle.checked;
            localStorage.setItem('traveller_region_names', String(window.regionNamesEnabled));
            requestAnimationFrame(draw);
        });
    }

    // --- Generation Options: TL Max ---
    const tlMaxInput = document.getElementById('input-tl-max');
    if (tlMaxInput) {
        const savedTlMax = localStorage.getItem('traveller_gen_tl_max');
        const initialTlMax = savedTlMax !== null ? parseInt(savedTlMax, 10) : 20;
        tlMaxInput.value = initialTlMax;
        window.generationTlMax = initialTlMax;

        tlMaxInput.addEventListener('change', () => {
            const val = Math.max(0, Math.min(33, parseInt(tlMaxInput.value, 10) || 20));
            tlMaxInput.value = val;
            window.generationTlMax = val;
            localStorage.setItem('traveller_gen_tl_max', String(val));
        });
    }

    // --- Generation Options: TL Mod ---
    const tlModInput = document.getElementById('input-tl-mod');
    if (tlModInput) {
        const savedTlMod = localStorage.getItem('traveller_gen_tl_mod');
        const initialTlMod = savedTlMod !== null ? parseInt(savedTlMod, 10) : 0;
        tlModInput.value = initialTlMod;
        window.generationTlMod = initialTlMod;

        tlModInput.addEventListener('change', () => {
            const val = Math.max(-20, Math.min(20, parseInt(tlModInput.value, 10) || 0));
            tlModInput.value = val;
            window.generationTlMod = val;
            localStorage.setItem('traveller_gen_tl_mod', String(val));
        });
    }

    // --- Generation Options: Use Realistic Stellar Variant (MgT2e only) ---
    const realisticStellarInput = document.getElementById('input-use-realistic-stellar');
    if (realisticStellarInput) {
        const savedRealisticStellar = localStorage.getItem('traveller_gen_use_realistic_stellar');
        const initialRealisticStellar = savedRealisticStellar === 'true';
        realisticStellarInput.checked = initialRealisticStellar;
        window.generationUseRealisticStellar = initialRealisticStellar;

        realisticStellarInput.addEventListener('change', () => {
            window.generationUseRealisticStellar = realisticStellarInput.checked;
            localStorage.setItem('traveller_gen_use_realistic_stellar', String(realisticStellarInput.checked));
        });
    }

    // --- Generation Options: Use Min TL Floor (MgT2e only) ---
    const tlFloorInput = document.getElementById('input-use-tl-floor');
    if (tlFloorInput) {
        const savedTlFloor = localStorage.getItem('traveller_gen_use_tl_floor');
        const initialTlFloor = savedTlFloor === 'true';
        tlFloorInput.checked = initialTlFloor;
        window.generationUseTlFloor = initialTlFloor;

        tlFloorInput.addEventListener('change', () => {
            window.generationUseTlFloor = tlFloorInput.checked;
            localStorage.setItem('traveller_gen_use_tl_floor', String(tlFloorInput.checked));
        });
    }

    // --- Generation Options: No Red or Amber Zones (all editions) ---
    const noTravelZonesInput = document.getElementById('input-no-travel-zones');
    if (noTravelZonesInput) {
        const savedNoTravelZones = localStorage.getItem('traveller_gen_no_travel_zones');
        const initialNoTravelZones = savedNoTravelZones === 'true';
        noTravelZonesInput.checked = initialNoTravelZones;
        window.generationNoTravelZones = initialNoTravelZones;

        noTravelZonesInput.addEventListener('change', () => {
            window.generationNoTravelZones = noTravelZonesInput.checked;
            localStorage.setItem('traveller_gen_no_travel_zones', String(noTravelZonesInput.checked));
        });
    }

    // --- Generation Options: Settlement Centuries (RTT only) ---
    const rttSettlementInput = document.getElementById('input-rtt-settlement');
    if (rttSettlementInput) {
        const saved = localStorage.getItem('traveller_gen_rtt_settlement');
        const initial = saved !== null ? parseInt(saved, 10) : 2;
        rttSettlementInput.value = initial;
        window.generationRttSettlement = initial;

        rttSettlementInput.addEventListener('change', () => {
            const parsed = parseInt(rttSettlementInput.value, 10);
            const val = Math.max(0, Math.min(100, isNaN(parsed) ? 2 : parsed));
            rttSettlementInput.value = val;
            window.generationRttSettlement = val;
            localStorage.setItem('traveller_gen_rtt_settlement', String(val));
        });
    }

    // --- Display Options: Show Industry instead of TL (RTT only) ---
    const rttIndustryToggle = document.getElementById('toggle-rtt-industry');
    if (rttIndustryToggle) {
        const saved = localStorage.getItem('traveller_rtt_show_industry');
        window.rttShowIndustry = saved === 'true';
        rttIndustryToggle.checked = window.rttShowIndustry;

        rttIndustryToggle.addEventListener('change', () => {
            window.rttShowIndustry = rttIndustryToggle.checked;
            localStorage.setItem('traveller_rtt_show_industry', String(rttIndustryToggle.checked));
            requestAnimationFrame(draw);
        });
    }

    // --- Generation Options: Tech Level (RTT only) ---
    const rttTlInput = document.getElementById('input-rtt-tl');
    if (rttTlInput) {
        const saved = localStorage.getItem('traveller_gen_rtt_tl');
        const initial = saved !== null ? parseInt(saved, 10) : 15;
        rttTlInput.value = initial;
        window.generationRttTL = initial;

        rttTlInput.addEventListener('change', () => {
            const parsed = parseInt(rttTlInput.value, 10);
            const val = Math.max(0, Math.min(33, isNaN(parsed) ? 15 : parsed));
            rttTlInput.value = val;
            window.generationRttTL = val;
            localStorage.setItem('traveller_gen_rtt_tl', String(val));
        });
    }

    // --- Generation Options: Pop Max ---
    const popMaxInput = document.getElementById('input-pop-max');
    if (popMaxInput) {
        const savedPopMax = localStorage.getItem('traveller_gen_pop_max');
        const initialPopMax = savedPopMax !== null ? parseInt(savedPopMax, 10) : 20;
        popMaxInput.value = initialPopMax;
        window.generationPopMax = initialPopMax;

        popMaxInput.addEventListener('change', () => {
            const val = Math.max(0, Math.min(33, parseInt(popMaxInput.value, 10) || 20));
            popMaxInput.value = val;
            window.generationPopMax = val;
            localStorage.setItem('traveller_gen_pop_max', String(val));
        });
    }

    // --- Generation Options: Pop Mod ---
    const popModInput = document.getElementById('input-pop-mod');
    if (popModInput) {
        const savedPopMod = localStorage.getItem('traveller_gen_pop_mod');
        const initialPopMod = savedPopMod !== null ? parseInt(savedPopMod, 10) : 0;
        popModInput.value = initialPopMod;
        window.generationPopMod = initialPopMod;

        popModInput.addEventListener('change', () => {
            const val = Math.max(-20, Math.min(20, parseInt(popModInput.value, 10) || 0));
            popModInput.value = val;
            window.generationPopMod = val;
            localStorage.setItem('traveller_gen_pop_mod', String(val));
        });
    }

    // --- Generation Options: Pop Check Frequency ---
    const popCheckFreqInput = document.getElementById('input-pop-check-frequency');
    if (popCheckFreqInput) {
        const savedPopCheckFreq = localStorage.getItem('traveller_gen_pop_check_frequency');
        const initialPopCheckFreq = savedPopCheckFreq !== null ? parseInt(savedPopCheckFreq, 10) : 100;
        popCheckFreqInput.value = initialPopCheckFreq;
        window.generationPopCheckFrequency = initialPopCheckFreq;

        popCheckFreqInput.addEventListener('change', () => {
            const val = Math.max(0, Math.min(100, parseInt(popCheckFreqInput.value, 10) || 100));
            popCheckFreqInput.value = val;
            window.generationPopCheckFrequency = val;
            localStorage.setItem('traveller_gen_pop_check_frequency', String(val));
        });
    }

    // --- Generation Options: Starport Max ---
    const starportMaxInput = document.getElementById('input-starport-max');
    if (starportMaxInput) {
        const validStarportClasses = ['A', 'B', 'C', 'D', 'E', 'X'];
        const savedStarportMax = localStorage.getItem('traveller_gen_starport_max');
        const initialStarportMax = (savedStarportMax && validStarportClasses.includes(savedStarportMax)) ? savedStarportMax : 'A';
        starportMaxInput.value = initialStarportMax;
        window.generationStarportMax = initialStarportMax;

        starportMaxInput.addEventListener('change', () => {
            const val = starportMaxInput.value.toUpperCase().trim();
            const clamped = validStarportClasses.includes(val) ? val : 'A';
            starportMaxInput.value = clamped;
            window.generationStarportMax = clamped;
            localStorage.setItem('traveller_gen_starport_max', clamped);
        });
    }

    // --- Generation Options: Starport Mod ---
    const starportModInput = document.getElementById('input-starport-mod');
    if (starportModInput) {
        const savedStarportMod = localStorage.getItem('traveller_gen_starport_mod');
        const initialStarportMod = savedStarportMod !== null ? parseInt(savedStarportMod, 10) : 0;
        starportModInput.value = initialStarportMod;
        window.generationStarportMod = initialStarportMod;

        starportModInput.addEventListener('change', () => {
            const val = Math.max(-20, Math.min(20, parseInt(starportModInput.value, 10) || 0));
            starportModInput.value = val;
            window.generationStarportMod = val;
            localStorage.setItem('traveller_gen_starport_mod', String(val));
        });
    }

    const continentDefInput = document.getElementById('input-continent-def');
    const continentDefVal   = document.getElementById('continent-def-val');
    if (continentDefInput) {
        const saved   = localStorage.getItem('traveller_planet_continent_def');
        const initial = saved !== null ? parseFloat(saved) : 0.55;
        continentDefInput.value = initial;
        window.planetContinentalDefinition = initial;
        if (continentDefVal) continentDefVal.textContent = initial.toFixed(2);
        continentDefInput.addEventListener('input', () => {
            const val = parseFloat(continentDefInput.value);
            window.planetContinentalDefinition = val;
            if (continentDefVal) continentDefVal.textContent = val.toFixed(2);
            localStorage.setItem('traveller_planet_continent_def', String(val));
        });
    }

    const coastlineCompInput = document.getElementById('input-coastline-comp');
    const coastlineCompVal   = document.getElementById('coastline-comp-val');
    if (coastlineCompInput) {
        const saved   = localStorage.getItem('traveller_planet_coastline_comp');
        const initial = saved !== null ? parseFloat(saved) : 0.45;
        coastlineCompInput.value = initial;
        window.planetCoastlineComplexity = initial;
        if (coastlineCompVal) coastlineCompVal.textContent = initial.toFixed(2);
        coastlineCompInput.addEventListener('input', () => {
            const val = parseFloat(coastlineCompInput.value);
            window.planetCoastlineComplexity = val;
            if (coastlineCompVal) coastlineCompVal.textContent = val.toFixed(2);
            localStorage.setItem('traveller_planet_coastline_comp', String(val));
        });
    }

    // Default orrery start date
    const orreryYearInput = document.getElementById('input-orrery-default-year');
    const orreryDayInput  = document.getElementById('input-orrery-default-day');
    if (orreryYearInput && orreryDayInput) {
        const savedYear = localStorage.getItem('traveller_orrery_default_year');
        const savedDay  = localStorage.getItem('traveller_orrery_default_day');
        window.orreryDefaultYear = savedYear !== null ? parseInt(savedYear) : 0;
        window.orreryDefaultDay  = savedDay  !== null ? parseInt(savedDay)  : 1;
        orreryYearInput.value = window.orreryDefaultYear;
        orreryDayInput.value  = window.orreryDefaultDay;
        orreryYearInput.addEventListener('change', () => {
            const val = parseInt(orreryYearInput.value) || 0;
            orreryYearInput.value    = val;
            window.orreryDefaultYear = val;
            localStorage.setItem('traveller_orrery_default_year', String(val));
        });
        orreryDayInput.addEventListener('change', () => {
            const val = Math.min(365, Math.max(1, parseInt(orreryDayInput.value) || 1));
            orreryDayInput.value    = val;
            window.orreryDefaultDay = val;
            localStorage.setItem('traveller_orrery_default_day', String(val));
        });
    }
}

function toggleSettingsSection(header) {
    header.classList.toggle('open');
    const body = header.nextElementSibling;
    body.classList.toggle('open');
    if (body.classList.contains('open')) {
        body.style.display = 'flex';
    } else {
        body.style.display = 'none';
    }
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
