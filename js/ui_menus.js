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

    document.getElementById('btn-xboat-confirm').addEventListener('click', () => {
        const maxJump  = Math.min(8,  Math.max(1,  parseInt(document.getElementById('xboat-max-jump').value,  10) || 4));
        const maxRange = Math.min(32, Math.max(1,  parseInt(document.getElementById('xboat-max-range').value, 10) || 4));
        const minIx    = Math.min(8,  Math.max(0,  parseInt(document.getElementById('xboat-min-ix').value,    10) || 4));
        document.getElementById('xboat-modal').style.display = 'none';
        saveHistoryState('Generate Xboat Routes');
        generateXboatRoutes(maxJump, maxRange, minIx);
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
            const maxJump  = Math.min(20, Math.max(1, parseInt(document.getElementById('autoroute-max-jump').value,  10) || 4));
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
// WORLD AUTOCOMPLETE
// ============================================================================

/**
 * Attaches a name-based autocomplete dropdown to a text input.
 * Matching worlds appear as "Name  HXXX" rows; selecting one writes the
 * hex ID into the input. Typing a raw hex ID directly still works.
 */
function setupWorldAutocomplete(inputEl, dropdownEl) {
    let activeIndex = -1;

    function getMatches(query) {
        if (!query) return [];
        const q = query.toLowerCase();
        const results = [];
        hexStates.forEach((state, hexId) => {
            if (state.type !== 'SYSTEM_PRESENT') return;
            const name = state.name || '';
            if (name.toLowerCase().startsWith(q)) results.push({ hexId, name });
        });
        return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);
    }

    function renderDropdown(matches) {
        dropdownEl.innerHTML = '';
        if (matches.length === 0) { dropdownEl.style.display = 'none'; return; }
        matches.forEach((m) => {
            const item = document.createElement('div');
            item.className = 'wac-item';
            item.dataset.hexId = m.hexId;
            item.innerHTML = `<span class="wac-name">${m.name}</span><span class="wac-hexid">${m.hexId}</span>`;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                inputEl.value = m.hexId;
                dropdownEl.style.display = 'none';
                activeIndex = -1;
            });
            dropdownEl.appendChild(item);
        });
        activeIndex = -1;
        dropdownEl.style.display = 'block';
    }

    function updateActive() {
        [...dropdownEl.querySelectorAll('.wac-item')].forEach((el, i) =>
            el.classList.toggle('wac-active', i === activeIndex));
    }

    inputEl.addEventListener('input', () => {
        renderDropdown(getMatches(inputEl.value.trim()));
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
            if (hexId) { inputEl.value = hexId; dropdownEl.style.display = 'none'; activeIndex = -1; }
        } else if (e.key === 'Escape') {
            dropdownEl.style.display = 'none'; activeIndex = -1;
        }
    });

    inputEl.addEventListener('focus', () => {
        const matches = getMatches(inputEl.value.trim());
        if (matches.length > 0) renderDropdown(matches);
    });

    inputEl.addEventListener('blur', () => {
        setTimeout(() => { dropdownEl.style.display = 'none'; activeIndex = -1; }, 150);
    });
}

/**
 * Resolves a P2P input value to a hex ID.
 * Accepts a raw hex ID or a system name (case-insensitive, first match wins).
 * Returns null if nothing matches.
 */
function resolveWorldInput(value) {
    const v = value.trim();
    if (!v) return null;
    if (hexStates.has(v) && hexStates.get(v).type === 'SYSTEM_PRESENT') return v;
    const q = v.toLowerCase();
    let found = null;
    hexStates.forEach((state, hexId) => {
        if (found) return;
        if (state.type === 'SYSTEM_PRESENT' && (state.name || '').toLowerCase() === q) found = hexId;
    });
    return found;
}

// ============================================================================
// ROUTE SYSTEMS PANEL
// ============================================================================

function getRouteSystemList(routeId) {
    const segments = (window.sectorRoutes || []).filter(r => r.routeId === routeId);
    if (segments.length === 0) return { ordered: false, worlds: [] };

    const isP2P = segments[0].subtype === 'PointToPoint';

    if (isP2P) {
        // Build adjacency map from segments
        const adj = new Map();
        segments.forEach(seg => {
            if (!adj.has(seg.startId)) adj.set(seg.startId, []);
            if (!adj.has(seg.endId))   adj.set(seg.endId,   []);
            adj.get(seg.startId).push(seg.endId);
            adj.get(seg.endId).push(seg.startId);
        });

        // Endpoints are nodes with exactly one neighbour (degree 1)
        const endpoints = [...adj.keys()].filter(id => adj.get(id).length === 1);

        // Guard: if not a clean chain, fall back to unordered
        if (endpoints.length !== 2) {
            const allIds = [...new Set(segments.flatMap(s => [s.startId, s.endId]))];
            return { ordered: false, worlds: allIds };
        }

        // Walk the chain from one endpoint to the other
        const path = [endpoints[0]];
        const visited = new Set([endpoints[0]]);
        let current = endpoints[0];
        while (true) {
            const next = (adj.get(current) || []).find(n => !visited.has(n));
            if (!next) break;
            path.push(next);
            visited.add(next);
            current = next;
        }
        return { ordered: true, worlds: path };
    }

    // Network / XBoat / AutoRoute — collect unique IDs, sort by world name
    const allIds = [...new Set(segments.flatMap(s => [s.startId, s.endId]))];
    allIds.sort((a, b) => {
        const na = (hexStates.get(a) || {}).name || a;
        const nb = (hexStates.get(b) || {}).name || b;
        return na.localeCompare(nb);
    });
    return { ordered: false, worlds: allIds };
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

    if (worlds.length === 0) {
        listEl.innerHTML = '<div style="color:#555;font-style:italic;padding:4px 0;">No systems found.</div>';
    } else {
        worlds.forEach((hexId, i) => {
            const state = hexStates.get(hexId);
            const name  = (state && state.name) ? state.name : '(unnamed)';
            const item  = document.createElement('div');
            item.className = 'route-systems-item';
            const marker = ordered ? `${i + 1}.` : '•';
            item.innerHTML = `<span class="route-systems-item-num">${marker}</span>`
                           + `<span class="route-systems-item-name">${name}</span>`
                           + `<span class="route-systems-item-id">${hexId}</span>`;
            listEl.appendChild(item);
        });
    }

    const segCount = (window.sectorRoutes || []).filter(r => r.routeId === routeId).length;
    footerEl.textContent = `${segCount} segment${segCount !== 1 ? 's' : ''} · ${worlds.length} world${worlds.length !== 1 ? 's' : ''}`;

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
// WAYPOINT HELPERS (P2P Route Builder)
// ============================================================================

function addWaypointRow() {
    const list = document.getElementById('route-auto-p2p-waypoints-list');
    if (!list) return;
    const index = list.children.length + 1;

    const row = document.createElement('div');
    row.className = 'p2p-waypoint-row';

    const wrap = document.createElement('div');
    wrap.className = 'wac-wrap';
    wrap.style.flex = '1';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'wac-input p2p-waypoint-input';
    input.placeholder = `Waypoint ${index}`;

    const drop = document.createElement('div');
    drop.className = 'wac-dropdown';

    wrap.appendChild(input);
    wrap.appendChild(drop);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'p2p-waypoint-remove';
    removeBtn.title = 'Remove waypoint';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        row.remove();
        renumberWaypoints();
    });

    row.appendChild(wrap);
    row.appendChild(removeBtn);
    list.appendChild(row);

    setupWorldAutocomplete(input, drop);
    input.focus();
}

function renumberWaypoints() {
    document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-input').forEach((inp, i) => {
        if (!inp.value) inp.placeholder = `Waypoint ${i + 1}`;
    });
}

function collectWaypointRaws() {
    return Array.from(document.querySelectorAll('#route-auto-p2p-waypoints-list .p2p-waypoint-input'))
        .map(inp => inp.value.trim())
        .filter(v => v !== '');
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
                btn:     { minBTN:   parseInt(document.getElementById('route-auto-btn-min').value, 10),
                           maxJump:  parseInt(document.getElementById('route-auto-btn-jump').value, 10) },
                p2p:     { startRaw: document.getElementById('route-auto-p2p-start').value,
                           endRaw:   document.getElementById('route-auto-p2p-end').value,
                           maxJump:  parseInt(document.getElementById('route-auto-p2p-jump').value, 10) },
                network: { maxJump:  parseInt(document.getElementById('route-auto-network-jump').value, 10),
                           maxRange: parseInt(document.getElementById('route-auto-network-range').value, 10),
                           filterRules: window.activeFilterRules || [] }
            };

            if (type === 'xboat') {
                const { maxJump, maxRange, minIx } = configs.xboat;
                saveHistoryState('Generate Xboat Routes');
                generateXboatRoutes(maxJump, maxRange, minIx);
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                const count = (window.sectorRoutes || []).filter(r => r.type === 'Xboat').length;
                showToast(`XBoat routes generated: ${count} segment(s) added to Route #1.`, 3000);
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
                const { maxJump, maxRange } = configs.network;
                const groupId = `net_${routeId}`;
                saveHistoryState(`Generate Custom Network: ${routeName}`);
                window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);
                const count = generateAutoRoutes(filteredIds, maxJump, maxRange, routeDef.color, groupId, routeName, routeId);
                if (count === 0) {
                    showToast('No route segments could be generated for the current filter.', 2500);
                    return;
                }
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                showToast(`"${routeName}" generated: ${count} segment(s).`, 3000);
                return;
            }

            if (type === 'p2p') {
                const { startRaw, endRaw, maxJump } = configs.p2p;
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
                saveHistoryState(`Generate Point-to-Point: ${routeName}`);
                window.sectorRoutes = (window.sectorRoutes || []).filter(r => r.routeId !== routeId);
                const count = generatePointToPointRoute(startId, endId, maxJump, routeDef.color, groupId, routeName, true, filteredIds, routeId, waypointIds);
                if (count === null) {
                    const wpNote = waypointIds.length > 0 ? ` via ${waypointIds.length} waypoint(s)` : '';
                    showToast(`No path found from ${startId} to ${endId}${wpNote} within Jump-${maxJump}.`, 3000);
                    return;
                }
                if (window.dbManager) window.dbManager.saveRoutes();
                requestAnimationFrame(draw);
                window.closeRouteAutoPanel();
                window.refreshRouteWindowCounts();
                const wpNote = waypointIds.length > 0 ? ` via ${waypointIds.length} waypoint(s)` : '';
                showToast(`"${routeName}" generated: ${count} segment(s) from ${startId} to ${endId}${wpNote}.`, 3000);
                return;
            }

            showToast(`[Stub] ${type.toUpperCase()} → "${routeName}" — not yet implemented.`, 3000);
        });
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
    if (addWpBtn) addWpBtn.addEventListener('click', addWaypointRow);
}

window.renderRouteWindow = function () {
    const list = document.getElementById('route-window-list');
    if (!list) return;
    list.innerHTML = '';
    window.closeRouteAutoPanel();
    window.closeRouteSystemsPanel();

    // Ensure exactly 9 definitions; pad with defaults for any missing slots
    const allDefaults = typeof getDefaultRouteDefinitions === 'function' ? getDefaultRouteDefinitions() : [];
    let padded = false;
    while (window.routeDefinitions.length < 9) {
        const nextId = window.routeDefinitions.length + 1;
        const def = allDefaults.find(d => d.id === nextId);
        window.routeDefinitions.push(def || { id: nextId, name: `Route ${nextId}`, color: '#ffffff', shortcut: String(nextId), visible: true, automationRef: null });
        padded = true;
    }
    if (padded && window.dbManager) window.dbManager.saveRouteDefinitions();

    const segCounts = new Map();
    (window.sectorRoutes || []).forEach(r => {
        if (r.routeId != null) segCounts.set(r.routeId, (segCounts.get(r.routeId) || 0) + 1);
    });

    const defs = window.routeDefinitions.slice(0, 9);
    defs.forEach((def) => {
        const segCount = segCounts.get(def.id) || 0;
        const segClass = segCount > 0 ? 'used' : 'free';
        const segLabel = segCount > 0 ? segCount : '&mdash;';
        const row = document.createElement('div');
        row.className = 'route-row';
        row.dataset.routeId = def.id;
        row.innerHTML = `
            <span class="route-num">#${def.id}</span>
            <span class="route-seg-count ${segClass}" title="${segCount} segment(s)">${segLabel}</span>
            <input type="text" class="route-name-input" value="${def.name.replace(/"/g, '&quot;')}" title="Route name" />
            <input type="color" class="route-color-swatch" value="${def.color}" title="Route color" />
            <input type="text" class="route-shortcut-input" maxlength="1" placeholder="key" value="${def.shortcut || ''}" title="Shortcut key" />
            <label style="display:flex;align-items:center;gap:3px;color:#c5c6c7;font-size:0.8rem;cursor:pointer;">
                <input type="checkbox" class="route-visible-check" ${def.visible ? 'checked' : ''}> Vis
            </label>
            <button class="route-clear-btn" title="Remove all map segments for this route">C</button>
            <button class="route-auto-btn" title="Set up automation for ${def.name}">&#9881; Auto</button>
        `;
        const nameIn  = row.querySelector('.route-name-input');
        const colorIn = row.querySelector('.route-color-swatch');
        const shortIn = row.querySelector('.route-shortcut-input');
        const visIn   = row.querySelector('.route-visible-check');

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
        visIn.addEventListener('change', () => {
            def.visible = visIn.checked;
            if (window.dbManager) window.dbManager.saveRouteDefinitions();
            requestAnimationFrame(draw);
        });

        // Segment-count pill: click to view route systems
        const pill = row.querySelector('.route-seg-count');
        if (pill && segCount > 0) {
            pill.style.cursor = 'pointer';
            pill.title = `${segCount} segment(s) — click to view systems`;
            pill.addEventListener('click', () => window.openRouteSystemsPanel(def.id, def.name));
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
    const win = document.getElementById('route-window');
    if (win) win.classList.remove('visible');
};

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
        if (count > 0) {
            pill.style.cursor = 'pointer';
            pill.title = `${count} segment(s) — click to view systems`;
            if (!pill.dataset.listenerAttached) {
                const def = (window.routeDefinitions || []).find(d => d.id === routeId);
                const routeName = def ? def.name : `Route #${routeId}`;
                pill.addEventListener('click', () => window.openRouteSystemsPanel(routeId, routeName));
                pill.dataset.listenerAttached = 'true';
            }
        } else {
            pill.style.cursor = '';
            pill.title = '0 segment(s)';
            if (routeId === sysPanelRouteId) window.closeRouteSystemsPanel();
        }
    });
};

window.openRouteAutoPanel = function (routeId, routeName) {
    const panel = document.getElementById('route-auto-panel');
    const nameEl = document.getElementById('route-auto-panel-route-name');
    if (!panel || !nameEl) return;
    panel.dataset.targetRouteId = routeId;
    nameEl.textContent = routeName;
    document.querySelectorAll('input[name="route-auto-type"]').forEach(r => r.checked = false);
    document.querySelectorAll('.route-auto-option').forEach(opt => opt.classList.remove('open'));
    document.getElementById('btn-route-auto-generate').disabled = true;

    // Pre-populate P2P start/end from the current hex selection (1 or 2 hexes).
    const selArray = typeof selectedHexes !== 'undefined' ? [...selectedHexes] : [];
    const startIn = document.getElementById('route-auto-p2p-start');
    const endIn   = document.getElementById('route-auto-p2p-end');
    if (startIn) startIn.value = selArray[0] || '';
    if (endIn)   endIn.value   = selArray[1] || '';

    // Clear any waypoints from a previous session
    const wpList = document.getElementById('route-auto-p2p-waypoints-list');
    if (wpList) wpList.innerHTML = '';

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.closeRouteAutoPanel = function () {
    const panel = document.getElementById('route-auto-panel');
    if (!panel) return;
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
    }

    ['route-auto-filter-summary-p2p', 'route-auto-filter-summary-network'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
};

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