// ============================================================================
// MACRO_ORCHESTRATOR.JS - Bulk Generation & Validation Rules
// ============================================================================

// ============================================================================
// VALIDATION
// ============================================================================

function validateSelection(actionType, skipPopCheck = false) {
    if (selectedHexes.size === 0) {
        alert("Please select one or more hexes first (Shift + Left Click).");
        document.getElementById('context-menu').classList.remove('visible');
        return false;
    }

    if (actionType !== 'clear' && selectedHexes.size > 1280) {
        alert("We are currently limited to generating one sector (1280 hexes) at a time to prevent browser crashes. Please reduce your selection.");
        document.getElementById('context-menu').classList.remove('visible');
        return false;
    }

    // New logic: Check for at least one populated hex if we are updating existing systems
    if (!skipPopCheck && (actionType === 'generate' || actionType === 'socio' || actionType === 'physical')) {
        let hasPopulated = false;
        let popCount = 0;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && state.type === 'SYSTEM_PRESENT') {
                hasPopulated = true;
                popCount++;
            }
        }
        if (window.isLoggingEnabled) {
            writeLogLine(`[AUDIT] validateSelection: Checked ${selectedHexes.size} selected hexes. Found ${popCount} populated hexes. hasPopulated=${hasPopulated}`);
        }
        if (!hasPopulated) {
            alert("No populated hexes to update. You must populate hexes first.");
            document.getElementById('context-menu').classList.remove('visible');
            return false;
        }
    }

    if (actionType === 'populate') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            if (hexStates.has(hexId)) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already contain data. Do you want to overwrite them?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    } else if (actionType === 'generate') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && (state.ctData || state.mgt2eData || state.t5Data)) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already have generated Mainworld data. Do you want to overwrite them?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    } else if (actionType === 'socio') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && (state.t5Socio || state.mgtSocio)) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already have generated Socioeconomic data. Generating new data will overwrite the existing socioeconomics. Are you sure?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    } else if (actionType === 'physical') {
        let willOverwrite = false;
        for (let hexId of selectedHexes) {
            let state = hexStates.get(hexId);
            if (state && state.t5Physical) {
                willOverwrite = true;
                break;
            }
        }
        if (willOverwrite) {
            if (!confirm("Some selected hexes already have generated Physical Stats. Generating new data will overwrite the existing physical stats. Are you sure?")) {
                document.getElementById('context-menu').classList.remove('visible');
                return false;
            }
        }
    }
    return true;
}

// ============================================================================
// AUTO POPULATE
// ============================================================================

function autoPopulate(chanceOutOfSix) {
    if (!validateSelection('populate')) return;
    saveHistoryState('Auto Populate');
    selectedHexes.forEach(hexId => {
        reseedForHex(hexId);
        const roll = roll1D();
        if (roll <= chanceOutOfSix) {
            hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
        } else {
            hexStates.set(hexId, { type: 'EMPTY' });
        }
    });
    document.getElementById('context-menu').classList.remove('visible');
    
    // Sean Protocol: Sync Rule Engine and Filters with new data
    if (typeof writeLogLine === 'function') writeLogLine(`Auto-Populate: Refreshing rules for sector.`);
    if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
    if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

    selectedHexes.clear();
    requestAnimationFrame(draw);
}

// ============================================================================
// BULK MACRO EXECUTION
// ============================================================================

async function runMgT2EMacro(skipPop = false) {
    if (!validateSelection('generate', !skipPop)) return;

    saveHistoryState('Mongoose Macro');
    if (window.isLoggingEnabled) window.batchLogData = [];

    console.log("Bulk Generating MgT2E Full System...");
    await ensureNamesLoaded();

    if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Full Mongoose 2E Generation sequence. Proceed?")) {
        return;
    }

    // Capture the target hexes NOW so they don't change if the user deselects during the wait
    const targetHexes = Array.from(selectedHexes);

    // Auto Populate
    if (!skipPop) {
        targetHexes.forEach(hexId => {
            const roll = roll1D();
            if (roll <= 3) {
                hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
            } else {
                hexStates.set(hexId, { type: 'EMPTY' });
            }
        });
        requestAnimationFrame(draw);
        showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);
    }


    // Generate Full Systems (Modular Top-Down)
    setTimeout(() => {
        let count = 0;
        let lunarCount = 0;
        let populatedTotal = 0;

        targetHexes.forEach(hexId => {
            try {
                let stateObj = hexStates.get(hexId);
                if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                    // 1. Call the new Orchestrator
                    let newSys = generateMgT2ESystemTopDown(hexId);

                    // 2. Find the Mainworld recursively to account for Lunar demotions
                    let mainworld = null;
                    const findMW = (wList) => {
                        for (let w of wList) {
                            if (w.type === 'Mainworld' || w.isLunarMainworld || w.targetWorld === 'Mainworld') {
                                mainworld = w;
                                return true;
                            }
                            if (w.moons && w.moons.length > 0) {
                                if (findMW(w.moons)) return true;
                            }
                        }
                        return false;
                    };
                    findMW(newSys.worlds);
                    
                    // Critical fallback: if no Mainworld found in tree, use system-level mainworld if defined, else first world
                    if (!mainworld) mainworld = newSys.mainworld || newSys.worlds[0]; 

                    // 3. Map the data back to stateObj so the Hex Editor UI doesn't break
                    stateObj.mgtSystem = newSys;
                    
                    // Sean Protocol: Propagate gasGiant flag to Lunar Mainworlds.
                    // The renderer reads stateObj.mgt2eData for the ringed GG icon.
                    // Lunar Mainworlds are moons of Gas Giants — the gasGiant flag lives
                    // on the sys object but must be surfaced to the UI state object.
                    if (mainworld && mainworld.isLunarMainworld) {
                        mainworld.gasGiant = newSys.gasGiants > 0;
                    } else if (mainworld) {
                        mainworld.gasGiant = mainworld.gasGiant || (newSys.gasGiants > 0);
                    }

                    stateObj.mgt2eData = mainworld;
                    stateObj.mgtSocio = mainworld; 
                    stateObj.name = mainworld.name;

                    // 4. Clear old variant data to prevent UI ghosting
                    stateObj.ctData = null;
                    stateObj.t5Data = null;
                    stateObj.ctSystem = null;
                    stateObj.t5System = null;
                    stateObj.ctPhysical = null;
                    stateObj.t5Socio = null;

                    // Action: AUDIT Trace (Verify Presence & Tags)
                    if (window.isLoggingEnabled) {
                        let mwInfo = mainworld ? `MW: ${mainworld.name || 'Unnamed'} (Sa: ${mainworld.tradeCodes?.includes('Sa') ? 'YES' : 'NO'})` : "MW NOT FOUND";
                        let parentInfo = mainworld?.parentType ? `Parent: ${mainworld.parentType}` : "Parent: Parent Star";
                        writeLogLine(`[WBH AUDIT DETAIL] Hex ${hexId}: ${mwInfo}, ${parentInfo}, Codes: [${mainworld?.tradeCodes?.join(' ')}]`);
                    }

                    // Check if Lunar Mainworld was found
                    if (mainworld && (mainworld.isMoon || mainworld.isSatellite || mainworld.tradeCodes?.includes('Sa'))) {
                        lunarCount++;
                    }

                    hexStates.set(hexId, stateObj);
                    count++;
                }
            } catch (err) {
                console.error(`MgT2E Modular Macro failed for hex ${hexId}:`, err);
            }
        });

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('MgT2E_Full_Macro', targetHexes.length);
        }
        requestAnimationFrame(draw);
        if (count > 0) {
            const lunarPercent = ((lunarCount / count) * 100).toFixed(1);
            let msg = `Full MgT2E Generation Complete! (${count} systems)`;

            // Sean Protocol: Reporting Detail Decoupled from core success message.
            // Detailed lunar statistics are only shown when Development View is enabled.
            if (typeof devView !== 'undefined' && devView) {
                msg = `Full MgT2E Generation Complete! (${count} systems, ${lunarCount} Lunar Mainworlds: ${lunarPercent}%)`;
            }

            showToast(msg, 6000);
            if (window.isLoggingEnabled) {
                writeLogLine(`[WBH AUDIT] Sector Frequency: ${lunarCount}/${count} (${lunarPercent}%) Lunar Mainworlds generated.`);
            }
        } else {
            showToast("No populated hexes were updated.", 4000);
        }
        // Refresh both visibility and styling rules for the new systems
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    }, 500);
}

async function runMgT2EBottomUpMacro(skipPop = false) {
    if (!validateSelection('generate', !skipPop)) return;

    saveHistoryState('MgT2E Bottom-Up Macro');

    console.log("Bulk Generating MgT2E Bottom-Up Full System...");
    await ensureNamesLoaded();

    if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Bottom-Up Mongoose 2E Generation sequence. Proceed?")) {
        return;
    }

    const targetHexes = Array.from(selectedHexes);

    // 1. Auto Populate
    if (!skipPop) {
        targetHexes.forEach(hexId => {
            if (typeof reseedForHex === 'function') reseedForHex(hexId);
            const roll = typeof roll1D === 'function' ? roll1D() : Math.floor(Math.random() * 6) + 1;
            if (roll <= 3) {
                hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
            } else {
                hexStates.set(hexId, { type: 'EMPTY' });
            }
        });
        if (typeof draw === 'function') requestAnimationFrame(draw);
        if (typeof showToast === 'function') showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);
    }

    // 2. Generate
    setTimeout(() => {
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        targetHexes.forEach(hexId => {
            try {
                let stateObj = hexStates.get(hexId);
                if (window.isLoggingEnabled) {
                    writeLogLine(`[PROBE] Target Hex ${hexId}: stateObj exists? ${!!stateObj}, type: ${stateObj?.type}`);
                }
                if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                    if (window.isLoggingEnabled && typeof startTrace === 'function') {
                        startTrace(hexId, 'Bottom-Up MgT2E Generation', hexId);
                    }

                    if (typeof MgT2EBottomUpGenerator !== 'undefined') {
                        if (window.isLoggingEnabled) writeLogLine(`[PROBE] Calling MgT2EBottomUpGenerator.generateSystem for ${hexId}...`);
                        const sys = MgT2EBottomUpGenerator.generateSystem(hexId);
                        if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${hexId} generator returned: ${sys ? 'SYSTEM_OBJECT' : 'NULL'}`);

                        // Ensure Mainworld exists and has a name
                        if (sys) {
                            // Find the Mainworld - explicitly check for lunar mainworlds if not at top level
                            let mainworld = sys.worlds.find(w => w.type === 'Mainworld' || w.isLunarMainworld);
                            
                            if (!mainworld) {
                                // Search moons
                                for (let w of sys.worlds) {
                                    if (w.moons) {
                                        let foundMoon = w.moons.find(m => m.type === 'Mainworld' || m.isLunarMainworld);
                                        if (foundMoon) {
                                            mainworld = foundMoon;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            mainworld = mainworld || sys.mainworld || sys.worlds[0];
                            if (window.isLoggingEnabled) writeLogLine(`[PROBE] ${hexId} mapped mainworld: ${mainworld?.name || 'Unnamed'}`);

                            // Map resulting data to stateObj (Sean Protocol: Orchestrator maps generated data to UI state)
                            stateObj.mgtSystem = sys;
                            stateObj.mgt2eData = mainworld;
                            stateObj.mgtSocio = mainworld; // The engine puts socio data directly on the world object
                            stateObj.name = mainworld.name;

                            // Clean up old data variants to prevent UI ghosting
                            stateObj.ctData = null;
                            stateObj.t5Data = null;
                            stateObj.ctSystem = null;
                            stateObj.t5System = null;
                            stateObj.ctPhysical = null;
                            stateObj.t5Socio = null;
                            stateObj.rttData = null;

                            hexStates.set(hexId, stateObj);
                            count++;
                        }
                    } else {
                        console.error(`MgT2EBottomUpGenerator object not globally available.`);
                    }

                    if (window.isLoggingEnabled && typeof endTrace === 'function') {
                        endTrace();
                    }
                }
            } catch (err) {
                console.error(`Bottom-Up MgT2E Macro failed for hex ${hexId}:`, err);
            }
        });

        if (window.isLoggingEnabled && window.batchLogData && window.batchLogData.length > 0) {
            if (typeof downloadBatchLog === 'function') downloadBatchLog('MgT2E_BottomUp_Full_Macro', targetHexes.length);
        }

        if (typeof draw === 'function') {
            requestAnimationFrame(draw);
        }

        if (count > 0) {
            if (typeof showToast === 'function') {
                showToast(`Full Bottom-Up MgT2E Generation Complete for ${count} system(s)!`, 4000);
            }
        } else {
            console.warn("No populated hexes were updated.");
            if (typeof showToast === 'function') {
                showToast("No populated hexes to update. Ensure selection contains populated hexes.", 4000);
            }
        }
        // Refresh both visibility and styling rules for the new systems
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    }, 500);
}

async function runCTNewMacro(skipPop = false) {
    if (!validateSelection('generate', !skipPop)) return;

    saveHistoryState('CT New Macro');

    console.log("Bulk Generating CT (New Modular) Full System...");
    await ensureNamesLoaded();

    if (!confirm("This will completely overwrite ANY existing data in the selected hexes with the NEW Modular Classic Traveller Generation sequence. Proceed?")) {
        return;
    }

    const targetHexes = Array.from(selectedHexes);

    // 1. Auto Populate
    if (!skipPop) {
        targetHexes.forEach(hexId => {
            reseedForHex(hexId);
            const roll = roll1D();
            if (roll <= 3) {
                hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
            } else {
                hexStates.set(hexId, { type: 'EMPTY' });
            }
        });
        requestAnimationFrame(draw);
        showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);
    }


    // 2. Generate and Expand
    setTimeout(() => {
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        targetHexes.forEach(hexId => {
            try {
                let stateObj = hexStates.get(hexId);
                if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                    // Start trace if logging
                    if (window.isLoggingEnabled) startTrace(hexId, 'Modular CT Generation', hexId);

                    // Step A: Generate Mainworld UWP (Port, size, atm, hyd, pop, gov, law, tl)
                    let mwData = null;
                    if (window.CT_World_Engine) {
                        mwData = window.CT_World_Engine.generateModularMainworld(hexId);
                    } else {
                        // Fallback to legacy if world engine is somehow not globally available, though it should be.
                        mwData = generateCTMainworld(hexId);
                    }
                    // Step B: Modular Expansion (Top-Down)
                    if (window.CT_Generator) {
                        const sys = window.CT_Generator.generateSystem({
                            mode: 'top-down',
                            mainworldUWP: mwData,
                            hexId: hexId
                        });
                        stateObj.ctSystem = sys;
                        stateObj.ctData = sys.mainworld; // Sean Protocol: Map finalized world to UI state
                    }

                    // Clean up variants
                    stateObj.rttData = null;
                    stateObj.mgt2eData = null;
                    stateObj.t5Data = null;
                    stateObj.mgtSystem = null;
                    stateObj.t5System = null;
                    stateObj.ctPhysical = null;
                    hexStates.set(hexId, stateObj);

                    count++;
                    if (window.isLoggingEnabled) endTrace();
                }
            } catch (err) {
                console.error(`Modular CT Macro failed for hex ${hexId}:`, err);
                alert(`CT Macro Error for hex ${hexId}:\n${err.message}\nCheck console for full trace.`);
            }
        });

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('CT_Modular_Full_Macro', targetHexes.length);
        }
        requestAnimationFrame(draw);
        if (count > 0) {
            showToast(`Full Modular CT Generation Complete for ${count} system(s)!`, 4000);
        } else {
            alert("No populated hexes to update. Ensure selection contains populated hexes.");
        }
        // Refresh both visibility and styling rules for the new systems
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    }, 500);
}

async function runCTBottomUpMacro(skipPop = false) {
    if (!validateSelection('generate', !skipPop)) return;

    saveHistoryState('CT Bottom-Up Macro');

    console.log("Bulk Generating CT Bottom-Up Full System...");
    await ensureNamesLoaded();

    if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Bottom-Up Classic Traveller Generation sequence. Proceed?")) {
        return;
    }

    const targetHexes = Array.from(selectedHexes);

    // 1. Auto Populate
    if (!skipPop) {
        targetHexes.forEach(hexId => {
            reseedForHex(hexId);
            const roll = roll1D();
            if (roll <= 3) {
                hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
            } else {
                hexStates.set(hexId, { type: 'EMPTY' });
            }
        });
        requestAnimationFrame(draw);
        showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);
    }


    // 2. Generate
    setTimeout(() => {
        if (window.isLoggingEnabled) window.batchLogData = [];
        let count = 0;
        targetHexes.forEach(hexId => {
            try {
                let stateObj = hexStates.get(hexId);
                if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                    if (window.isLoggingEnabled) startTrace(hexId, 'Bottom-Up CT Generation', hexId);

                    if (window.CT_Generator) {
                        const sys = window.CT_Generator.generateSystem({
                            mode: 'bottom-up',
                            hexId: hexId
                        });

                        // Ensure Mainworld exists and has a name
                        if (sys && sys.mainworld) {
                            if (!sys.mainworld.name) {
                                sys.mainworld.name = (typeof getNextSystemName !== 'undefined') ? getNextSystemName(hexId) : 'Unknown';
                            }
                            stateObj.ctSystem = sys;
                            stateObj.ctData = sys.mainworld;

                            // Clean up variants
                            stateObj.rttData = null;
                            stateObj.mgt2eData = null;
                            stateObj.t5Data = null;
                            stateObj.mgtSystem = null;
                            stateObj.t5System = null;
                            stateObj.ctPhysical = null;
                            hexStates.set(hexId, stateObj);
                            count++;
                        }
                    }

                    if (window.isLoggingEnabled) endTrace();
                }
            } catch (err) {
                console.error(`Bottom-Up CT Macro failed for hex ${hexId}:`, err);
            }
        });

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('CT_BottomUp_Full_Macro', targetHexes.length);
        }
        requestAnimationFrame(draw);
        if (count > 0) {
            showToast(`Full Bottom-Up CT Generation Complete for ${count} system(s)!`, 4000);
        } else {
            alert("No populated hexes to update. Ensure selection contains populated hexes.");
        }
        // Refresh both visibility and styling rules for the new systems
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    }, 500);
}

async function runRTTMacro(skipPop = false) {
    if (!validateSelection('generate', !skipPop)) return;

    saveHistoryState('RTT Macro');
    if (window.isLoggingEnabled) window.batchLogData = [];

    console.log("Bulk Generating RTT Full System...");
    await ensureNamesLoaded();

    if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Full RTT Generation sequence. Proceed?")) {
        return;
    }

    const targetHexes = Array.from(selectedHexes);

    // 1. Auto Populate (Standard 3 in 6)
    if (!skipPop) {
        targetHexes.forEach(hexId => {
            reseedForHex(hexId);
            const roll = roll1D();
            if (roll <= 3) {
                hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
            } else {
                hexStates.set(hexId, { type: 'EMPTY' });
            }
        });
        requestAnimationFrame(draw);
        showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);
    }


    // 2. Generate Systems
    setTimeout(() => {
        let count = 0;
        let noWorldCount = 0;
        targetHexes.forEach(hexId => {
            try {
                let stateObj = hexStates.get(hexId);
                if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                    // Start RTT Generation Pipeline
                    stateObj.rttSystem = generateRTTSectorStep1(hexId);

                    // Extract UW for display
                    if (stateObj.rttSystem) {
                        stateObj.rttData = extractRTTMainworld(stateObj.rttSystem);

                        // Track systems with no planetary bodies
                        const hasAnyOrbits = stateObj.rttSystem.stars.some(
                            s => s.planetarySystem && s.planetarySystem.orbits.length > 0
                        );
                        if (!hasAnyOrbits) noWorldCount++;

                        // Clear other data
                        stateObj.ctData = null;
                        stateObj.mgt2eData = null;
                        stateObj.t5Data = null;
                        stateObj.ctSystem = null;
                        stateObj.mgtSystem = null;
                        stateObj.t5System = null;
                        stateObj.ctPhysical = null;
                        stateObj.mgtPhysical = null;
                        stateObj.t5Physical = null;
                        stateObj.mgtSocio = null;
                        stateObj.t5Socio = null;
                        hexStates.set(hexId, stateObj);
                        count++;
                    }
                }
            } catch (err) {
                console.error(`RTT Macro Step 2 failed for hex ${hexId}:`, err);
            }
        });

        if (window.isLoggingEnabled && count > 0) {
            const noWorldPct = ((noWorldCount / count) * 100).toFixed(1);
            window.batchLogData.push(`========================================================`);
            window.batchLogData.push(`RTT GENERATION SUMMARY`);
            window.batchLogData.push(`  Systems generated : ${count}`);
            window.batchLogData.push(`  No-world systems  : ${noWorldCount} (${noWorldPct}%)`);
            window.batchLogData.push(`========================================================`);
        }

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('RTT_Full_Macro', targetHexes.length);
        }

        if (window.isLoggingEnabled && count > 0) {
            const noWorldPct = ((noWorldCount / count) * 100).toFixed(1);
            alert(`RTT Generation Summary\n\nSystems generated: ${count}\nNo-world systems: ${noWorldCount} (${noWorldPct}%)`);
        }

        requestAnimationFrame(draw);
        if (count > 0) {
            showToast(`Full RTT Generation Complete for ${count} system(s)!`, 4000);
        } else {
            alert("No populated hexes to update. Ensure selection contains populated hexes.");
        }
        // Refresh both visibility and styling rules for the new systems
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    }, 500);
}

async function runT5Macro(skipPop = false) {
    if (!validateSelection('generate', !skipPop)) return;

    saveHistoryState('T5 Macro');
    if (window.isLoggingEnabled) window.batchLogData = [];

    console.log("Bulk Generating T5 Full System...");
    await ensureNamesLoaded();

    if (!confirm("This will completely overwrite ANY existing data in the selected hexes with a Full T5 Generation sequence. Proceed?")) {
        return;
    }

    const targetHexes = Array.from(selectedHexes);

    // 1. Auto Populate (Standard 3 in 6)
    if (!skipPop) {
        targetHexes.forEach(hexId => {
            reseedForHex(hexId);
            const roll = roll1D();
            if (roll <= 3) {
                hexStates.set(hexId, { type: 'SYSTEM_PRESENT' });
            } else {
                hexStates.set(hexId, { type: 'EMPTY' });
            }
        });
        requestAnimationFrame(draw);
        showToast(`Populated ${targetHexes.length} hex(es)...`, 1000);
    }


    // 2. Generate T5 Mainworlds
    setTimeout(() => {
        targetHexes.forEach(hexId => {
            try {
                let stateObj = hexStates.get(hexId);
                if (stateObj && stateObj.type === 'SYSTEM_PRESENT') {
                    if (window.System_Driver) {
                        const sys = window.System_Driver.generateSystem({
                            edition: 'T5',
                            mode: 'top-down',
                            mainworldUWP: window.T5_World_Engine.generateT5Mainworld(hexId),
                            hexId: hexId
                        });
                        stateObj.t5System = sys;
                        stateObj.t5Data = sys.mainworld;
                        stateObj.name = getNextSystemName(hexId);
                        if (stateObj.t5Data) stateObj.t5Data.name = stateObj.name;
                        stateObj.t5Socio = (window.T5_Socio_Engine) ? window.T5_Socio_Engine.generateT5Socioeconomics(sys.mainworld, hexId) : null;
                    } else {
                        // Legacy Fallback
                        stateObj.t5Data = generateT5Mainworld(hexId);
                        stateObj.name = getNextSystemName(hexId);
                    }

                    // Clear variants to ensure fresh generation
                    stateObj.ctData = null;
                    stateObj.mgt2eData = null;
                    stateObj.ctSystem = null;
                    stateObj.mgtSystem = null;
                    stateObj.ctPhysical = null;
                    stateObj.mgtPhysical = null;
                    stateObj.t5Physical = null;
                    stateObj.mgtSocio = null;
                    hexStates.set(hexId, stateObj);
                }
            } catch (err) {
                console.error(`T5 Macro Step 2 failed for hex ${hexId}:`, err);
            }
        });
        requestAnimationFrame(draw);
        showToast(`Generated T5 Systems (Top-Down)...`, 1000);

        if (window.isLoggingEnabled && window.batchLogData.length > 0) {
            downloadBatchLog('T5_Full_Macro', targetHexes.length);
        }

        // Count how many hexes are actually populated now
        let count = 0;
        targetHexes.forEach(hx => {
            if (hexStates.get(hx)?.type === 'SYSTEM_PRESENT') count++;
        });

        if (count > 0) {
            if (typeof showToast === 'function') {
                showToast(`Full T5 Generation Complete!`, 4000);
            }
        } else {
            alert("No populated hexes to update. Ensure selection contains populated hexes.");
        }
        // Refresh both visibility and styling rules for the new systems
        if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        if (typeof window.applyActiveFilters === 'function') window.applyActiveFilters();

        selectedHexes.clear();
        requestAnimationFrame(draw);
    }, 500);
}