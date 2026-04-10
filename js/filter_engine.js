/**
 * js/filter_engine.js
 * 
 * UNIVERSAL FILTER ORCHESTRATOR (Phase 2)
 * Handles UI binding, debouncing, and DOM updates for the filtering system.
 * Strictly adheres to the Sean Protocol with trace logging.
 */

(function() {
    let filterDebounceTimer = null;
    let activeFilters = {};
    let activeRouteStatus = { green: true, yellow: true, red: true };

    const DESIGN_CHECKBOX_IDS = [
        'enable-design-color', 'enable-design-ring', 'enable-design-icon',
        'enable-design-text-case', 'enable-design-italics', 'enable-design-underline',
        'enable-design-bg-fill'
    ];
    const DESIGN_CHECKBOX_STORAGE_KEY = 'traveller_design_checkboxes';

    // Hex Background Fill global visibility flag (default on)
    window.hexBgFillVisible = true;

    // Initialization
    window.addEventListener('DOMContentLoaded', () => {
        setupFilterListeners();
        setupFilterCloseButton();
        restoreDesignCheckboxes();
        // initDraggable(); // Now handled globally in input_init.js
        initializeDefaultStyleRule();
    });

    /**
     * Sean Protocol: Dedicated listener for the draggable palette close button.
     * Includes stopPropagation to avoid triggering global drag handlers.
     */
    function setupFilterCloseButton() {
        const btnX = document.getElementById('btn-close-filter');
        if (btnX) {
            btnX.addEventListener('click', (e) => {
                e.stopPropagation();
                window.closeFilterModal();
            });
            btnX.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        const btnFooter = document.getElementById('btn-footer-close-filter');
        if (btnFooter) {
            btnFooter.addEventListener('click', () => {
                window.closeFilterModal();
            });
        }
    }

    function initializeDefaultStyleRule() {
        if (typeof tSection === 'function') tSection("Initialize Default Styling Rule");
        
        // Wait briefly to ensure any auto-loaded data has populated the global scope (if any)
        setTimeout(() => {
            if (window.activeFilterRules.length > 0) {
                if (typeof writeLogLine === 'function') writeLogLine("Rules Ledger already populated (likely from save). Skipping default rule injection.");
                return;
            }

            if (typeof writeLogLine === 'function') writeLogLine("Fresh session detected. Injecting default rules.");

            // 1. Default Asteroid Rule
            const defaultAsteroidRule = {
                id: 'rule_default_asteroid',
                filters: { size: "0" },
                color: null, // Set to null to inherit Global Default and prevent stacking
                iconStyle: "Asteroid Belt",
                description: "Size: 0 (Asteroid Belt)"
            };

            // 2. Default Liquid Water Rule
            const defaultWetRule = {
                id: 'rule_default_wet_world',
                filters: {
                    atm: "2-9",
                    hydro: ">0"
                },
                color: "#46b4e8", // Cyan-Blue
                iconStyle: "Classic",
                description: "Atm: 2-9 | Hydro: >0 (Liquid Water Presence)"
            };

            window.activeFilterRules.push(defaultAsteroidRule);
            window.activeFilterRules.push(defaultWetRule);
            
            if (typeof window.renderRulesLedger === 'function') window.renderRulesLedger();
            if (typeof window.reapplyAllRules === 'function') window.reapplyAllRules();
        }, 500);
    }



    /**
     * Toggles the filter modal visibility and performs a data scan for conditional fields.
     */
    window.toggleFilterModal = function() {
        if (typeof tSection === 'function') tSection("Toggle Filter Modal");
        const modal = document.getElementById('filter-modal');
        const isOpening = !modal.classList.contains('visible');

        if (isOpening) {
            modal.classList.add('visible');
            scanForConditionalFields();
            if (typeof writeLogLine === 'function') writeLogLine("Filter Modal Opened - Performing data scan for Ix/GWP/WTN.");
        } else {
            modal.classList.remove('visible');
            if (typeof writeLogLine === 'function') writeLogLine("Filter Modal Closed.");
        }
    };

    /**
     * Closes the filter modal.
     */
    window.closeFilterModal = function() {
        document.getElementById('filter-modal').classList.remove('visible');
    };

    /**
     * Clears all filter inputs without affecting the persistent Rules Ledger.
     */
    window.clearFilterInputs = function() {
        if (typeof tSection === 'function') tSection("Clear Filter Inputs");
        
        const inputs = [
            'filter-name',
            'filter-starport', 'filter-size', 'filter-atm', 'filter-hydro',
            'filter-pop', 'filter-total-pop', 'filter-gov', 'filter-law', 'filter-tl', 'filter-trade-codes',
            'filter-allegiance', 'filter-gas-giant',
            'filter-gravity', 'filter-temperature', 'filter-t5-ix', 'filter-mgt-importance', 'filter-mgt-wtn', 'filter-mgt-gwp'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = false;
                else el.value = '';
            }
        });

        const toggles = ['filter-route-green', 'filter-route-yellow', 'filter-route-red'];
        toggles.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true; // Restore Visibility
        });

        if (typeof writeLogLine === 'function') writeLogLine("Filter inputs cleared. Restoring sector-wide visibility.");
        
        // Immediate trigger (bypass debounce)
        window.applyActiveFilters();
    };

    /**
    * Scans the current hexStates to determine if advanced socioeconomic properties exist.
    * Shows/hides the conditional inputs based on presence.
    */
    function scanForConditionalFields() {
        if (typeof tSection === 'function') tSection("Scan Sector for Conditional Fields");
        
        let hasT5Ix = false;
        let hasMgImportance = false;
        let hasMgWTN = false;
        let hasMgGWP = false;
        let hasGravity = false;
        let hasTemp = false;

        hexStates.forEach(state => {
            // Optimization: Skip if we found everything
            if (hasT5Ix && hasMgImportance && hasMgWTN && hasMgGWP && hasGravity && hasTemp) return;

            const t5Socio = state.t5Socio;
            const mgtSocio = state.mgtSocio;
            const worldData = state.rttData || state.t5Data || state.mgt2eData || state.ctData || {};

            // Physical Data Check (Gravity & Temp)
            if (worldData.gravity !== undefined || worldData.Gravity !== undefined) hasGravity = true;
            if (worldData.temperature !== undefined || worldData.temp !== undefined || worldData.Temperature !== undefined) hasTemp = true;

            // T5 Importance Check
            if (t5Socio && (t5Socio.Ix !== undefined || t5Socio.Importance !== undefined)) {
                hasT5Ix = true;
            }

            // Mongoose Importance and WTN Check
            if (mgtSocio) {
                if (mgtSocio.Im !== undefined || mgtSocio.Importance !== undefined || mgtSocio.ImProf !== undefined) {
                    hasMgImportance = true;
                }
                if (mgtSocio.WTN !== undefined || mgtSocio.worldTradeNo !== undefined) {
                    hasMgWTN = true;
                }
                if (mgtSocio.pcGWP !== undefined || mgtSocio.gwp !== undefined || mgtSocio.GWP !== undefined) {
                    hasMgGWP = true;
                }
            }
        });

        if (typeof writeLogLine === 'function') {
            writeLogLine(`Scan Complete: T5Ix=${hasT5Ix}, MgImp=${hasMgImportance}, MgWTN=${hasMgWTN}, MgGWP=${hasMgGWP}`);
        }

        document.getElementById('filter-field-t5-ix').style.display = hasT5Ix ? 'flex' : 'none';
        document.getElementById('filter-field-mgt-importance').style.display = hasMgImportance ? 'flex' : 'none';
        document.getElementById('filter-field-mgt-wtn').style.display = hasMgWTN ? 'flex' : 'none';
        document.getElementById('filter-field-mgt-gwp').style.display = hasMgGWP ? 'flex' : 'none';
        document.getElementById('filter-field-gravity').style.display = hasGravity ? 'flex' : 'none';
        document.getElementById('filter-field-temperature').style.display = hasTemp ? 'flex' : 'none';
        
        const conditionalSection = document.getElementById('filter-conditional-section');
        conditionalSection.style.display = (hasT5Ix || hasMgImportance || hasMgWTN || hasMgGWP || hasGravity || hasTemp) ? 'block' : 'none';
    }

    /**
     * Main entry point for filter changes. Implements 300ms debounce.
     */
    function onFilterChanged() {
        if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
        
        filterDebounceTimer = setTimeout(() => {
            if (typeof tSection === 'function') tSection("Debounced Filter Triggered");
            window.applyActiveFilters();
        }, 300);
    }

    /**
     * Harvests all input values and executes the cross-engine filtering logic.
     */
    window.applyActiveFilters = function() {
        if (typeof writeLogLine === 'function') writeLogLine("Filter Engine: Refreshing results...");
        if (typeof tSection === 'function') tSection("Executing Filter Update Loop");

        // 1. Harvest Field Filters
        activeFilters = {
            name: document.getElementById('filter-name')?.value || "",
            starport: document.getElementById('filter-starport')?.value || "",
            size: document.getElementById('filter-size')?.value || "",
            atm: document.getElementById('filter-atm')?.value || "",
            hydro: document.getElementById('filter-hydro')?.value || "",
            pop: document.getElementById('filter-pop')?.value || "",
            totalPop: document.getElementById('filter-total-pop')?.value || "",
            gasGiant: document.getElementById('filter-gas-giant')?.value || "",
            gov: document.getElementById('filter-gov')?.value || "",
            law: document.getElementById('filter-law')?.value || "",
            tl: document.getElementById('filter-tl')?.value || "",
            tradeCodes: document.getElementById('filter-trade-codes')?.value || "",
            allegiance: document.getElementById('filter-allegiance')?.value || "",
            gravity: document.getElementById('filter-gravity')?.value || "",
            temperature: document.getElementById('filter-temperature')?.value || "",
            t5Ix: document.getElementById('filter-t5-ix')?.value || "",
            mgtImportance: document.getElementById('filter-mgt-importance')?.value || "",
            mgtWTN: document.getElementById('filter-mgt-wtn')?.value || "",
            mgtGWP: document.getElementById('filter-mgt-gwp')?.value || ""
        };

        let matchCount = 0;
        let totalCount = 0;

        // 3. Evaluation Loop
        hexStates.forEach((state, hexId) => {
            const isSystemPresent = state.type === 'SYSTEM_PRESENT';
            const isBlank = state.type === 'BLANK';
            const isEmpty = state.type === 'EMPTY';
            if (!isSystemPresent && !isBlank && !isEmpty) return;
            if (isSystemPresent) totalCount++;

            const worldData = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
            const socioData = state.t5Socio || state.mgtSocio || {};

            // Merge for evaluation
            const evalObject = { ...worldData, ...socioData, allegiance: state.allegiance, notes: state.notes };

            // Name prefix filter (case-insensitive, applied before UWP filters)
            let isVisible = true;
            const nameQuery = activeFilters.name.trim().toLowerCase();
            if (nameQuery) {
                const worldName = (evalObject.name || evalObject.systemName || state.name || '').toLowerCase();
                if (!worldName.startsWith(nameQuery)) isVisible = false;
            }
            // Strip 'name' before passing to UniversalMath — it handles UWP tokens only
            const uwpFilters = Object.assign({}, activeFilters);
            delete uwpFilters.name;
            if (isVisible) isVisible = UniversalMath.applyFilters(evalObject, uwpFilters, activeRouteStatus);
            state.isHiddenByFilter = !isVisible;

            if (isSystemPresent && isVisible) matchCount++;
        });

        const resultsLabel = document.getElementById('filter-results-count');
        if (resultsLabel) resultsLabel.innerText = `${matchCount} / ${totalCount}`;
        
        if (typeof writeLogLine === 'function') writeLogLine(`Filter Loop Complete: ${matchCount} matches found.`);

        // 4. Request Redraw
        if (typeof draw === 'function') requestAnimationFrame(draw);
    };

    /**
     * Tab Switching Logic for the Filter Control modal.
     */
    window.switchFilterTab = function(tabName) {
        if (typeof tSection === 'function') tSection(`Switch Tab: ${tabName}`);
        
        // Update Buttons
        document.getElementById('tab-btn-filter').classList.toggle('active', tabName === 'filter');
        document.getElementById('tab-btn-design').classList.toggle('active', tabName === 'design');

        // Update Content Panes
        document.getElementById('filter-content-pane').classList.toggle('active', tabName === 'filter');
        document.getElementById('design-content-pane').classList.toggle('active', tabName === 'design');

        if (typeof writeLogLine === 'function') writeLogLine(`UI Tab switched to ${tabName}.`);
    };

    // --- RULES LEDGER ARCHITECTURE (Phase 3 Expansion) ---
    window.activeFilterRules = []; // Store criteria + style

    /**
     * Generates a concise, human-readable summary of the active filter criteria.
     */
    window.generateFilterDescription = function(filters) {
        let parts = [];
        const labels = {
            name: "Name",
            starport: "Starport", size: "Size", atm: "Atm", hydro: "Hydro",
            pop: "Pop", totalPop: "Total Pop", gov: "Gov", law: "Law", tl: "TL", tradeCodes: "Codes",
            allegiance: "Alleg", gasGiant: "Gas Giant",
            gravity: "Grav", temperature: "Temp (°C)",
            t5Ix: "T5 Ix", mgtImportance: "Mg Imp", mgtWTN: "Mg WTN", mgtGWP: "Mg GWP"
        };
        for (const key in filters) {
            if (filters[key] && filters[key].trim() !== "") {
                parts.push(`${labels[key] || key}: ${filters[key]}`);
            }
        }
        return parts.length > 0 ? parts.join(" | ") : "All Worlds";
    }

    /**
     * Renders the Active Rules Ledger in the UI.
     */
    window.renderRulesLedger = function() {
        const listContainer = document.getElementById('active-rules-list');
        if (!listContainer) return;

        if (window.activeFilterRules.length === 0) {
            listContainer.innerHTML = `<div style="color: #45a29e; font-size: 0.7rem; text-align: center; padding: 10px;">No active rules.</div>`;
            return;
        }

        listContainer.innerHTML = '';
        window.activeFilterRules.forEach((rule, index) => {
            const row = document.createElement('div');
            row.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(102, 252, 241, 0.05); border: 1px solid rgba(102, 252, 241, 0.2); border-radius: 3px; margin-bottom: 4px; padding: 4px 8px; font-size: 0.7rem; color: #fff;";
            
            // Determine what little badge to show in the ledger based on iconStyle
            let styleIndicator = '';
            let iconType = rule.iconStyle || 'Classic';
            let colorHex = rule.color || '#a0a8b0'; // Fallback gray for display
            let borderCSS = rule.ringColor ? `border: 1.5px solid ${rule.ringColor}; box-sizing: border-box;` : '';
            
            // Ensure the shape is visible in the ledger even if the user didn't apply a custom color
            let bgCSS = '';
            if (rule.color) {
                bgCSS = `background: ${rule.color};`;
            } else if (rule.ringColor) {
                bgCSS = `background: transparent;`; // Ring only
            } else if (rule.bgFillColor) {
                bgCSS = `background: ${rule.bgFillColor};`;
            } else {
                bgCSS = `background: #a0a8b0;`; // Fallback fill so the shape isn't invisible
            }

            if (iconType === 'Asteroid Belt') {
                styleIndicator = `<i class="fas fa-braille" style="font-size: 10px; color: ${colorHex}; margin-right: 8px; flex-shrink: 0;" title="Asteroid Belt"></i>`;
            } else if (iconType === 'Asteroid Grid') {
                styleIndicator = `<i class="fas fa-grip-horizontal" style="font-size: 10px; color: ${colorHex}; margin-right: 8px; flex-shrink: 0;" title="Asteroid Grid"></i>`;
            } else if (iconType === 'Minimal') {
                styleIndicator = `<i class="fas fa-crosshairs" style="font-size: 10px; color: ${colorHex}; margin-right: 8px; flex-shrink: 0;" title="Minimal"></i>`;
            } else if (iconType === 'Square') {
                styleIndicator = `<span style="display: inline-block; width: 10px; height: 10px; ${bgCSS} ${borderCSS} margin-right: 8px; flex-shrink: 0;" title="Square"></span>`;
            } else if (iconType === 'Diamond') {
                styleIndicator = `<span style="display: inline-block; width: 8px; height: 8px; ${bgCSS} ${borderCSS} transform: rotate(45deg); margin-right: 8px; margin-left: 2px; flex-shrink: 0;" title="Diamond"></span>`;
            } else if (iconType === 'Rounded Rectangle') {
                styleIndicator = `<span style="display: inline-block; width: 14px; height: 8px; border-radius: 2px; ${bgCSS} ${borderCSS} margin-right: 8px; flex-shrink: 0;" title="Rounded Rectangle"></span>`;
            } else if (rule.bgFillColor && !rule.color && !rule.ringColor) {
                // Hex background fill only — show a flat-top hex shape in the fill color
                styleIndicator = `<span style="display: inline-block; width: 12px; height: 10px; background: ${rule.bgFillColor}; clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); margin-right: 8px; flex-shrink: 0;" title="Hex Background Fill"></span>`;
            } else {
                // Classic Dot or Refined
                styleIndicator = `<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; ${bgCSS} ${borderCSS} margin-right: 8px; flex-shrink: 0;" title="${iconType}"></span>`;
            }

            row.innerHTML = `
                <div style="display: flex; align-items: center; flex: 1; overflow: hidden;">
                    ${styleIndicator}
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${rule.description}">${rule.description}</span>
                </div>
                <i class="fas fa-times" style="color: #ff4500; cursor: pointer; margin-left: 10px; font-size: 0.8rem;" onclick="deleteFilterRule('${rule.id}')"></i>
            `;
            listContainer.appendChild(row);
        });
    }

    /**
     * Clears all custom UI overrides and reapplies rules in chronological order.
     */
    window.reapplyAllRules = function() {
        if (typeof tSection === 'function') tSection("Reapply Global Filter Rules");
        
        // 1. Reset all worlds
        hexStates.forEach(state => {
            if (state.type === 'SYSTEM_PRESENT' || state.type === 'BLANK' || state.type === 'EMPTY') {
                state.custom_ui = { appliedColors: [] };
            }
        });

        // 2. Iterate through rules
        window.activeFilterRules.forEach(rule => {
            if (typeof writeLogLine === 'function') writeLogLine(`Applying Rule: ${rule.description}`);
            let ruleMatchCount = 0;
            
            hexStates.forEach((state, hexId) => {
                const isSystemPresent = state.type === 'SYSTEM_PRESENT';
                const isBgOnly = state.type === 'BLANK' || state.type === 'EMPTY';
                if (!isSystemPresent && !isBgOnly) return;

                const worldData = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
                const socioData = state.t5Socio || state.mgtSocio || {};
                const evalObject = { ...worldData, ...socioData, allegiance: state.allegiance };

                if (UniversalMath.applyFilters(evalObject, rule.filters)) {
                    if (!state.custom_ui) state.custom_ui = { appliedColors: [] };

                    if (isSystemPresent) {
                        // Full rule application — dots, rings, icons, text styling
                        if (rule.color !== null) state.custom_ui.appliedColors.push(rule.color);
                        if (rule.ringColor !== null && rule.ringColor !== undefined) state.custom_ui.ringColor = rule.ringColor;
                        if (rule.iconStyle !== null) state.custom_ui.iconStyle = rule.iconStyle;
                        if (rule.textCase !== null && rule.textCase !== undefined) state.custom_ui.textCase = rule.textCase;
                        if (rule.isItalic) state.custom_ui.isItalic = true;
                        if (rule.isUnderline) state.custom_ui.isUnderline = true;
                    }

                    // Background fill applies to all hex types (SYSTEM_PRESENT, BLANK, EMPTY)
                    if (rule.bgFillColor) state.custom_ui.bgFillColor = rule.bgFillColor;

                    ruleMatchCount++;
                }
            });
            if (typeof writeLogLine === 'function') writeLogLine(`Rule Completed: ${ruleMatchCount} systems updated.`);
        });

        if (typeof draw === 'function') requestAnimationFrame(draw);
    };

    /**
     * Public handler for deleting a rule.
     */
    window.deleteFilterRule = function(ruleId) {
        if (typeof tSection === 'function') tSection("Delete Filter Rule");
        window.activeFilterRules = window.activeFilterRules.filter(r => r.id !== ruleId);
        
        if (typeof writeLogLine === 'function') writeLogLine(`Rule ${ruleId} deleted. Re-syncing map...`);
        
        renderRulesLedger();
        window.reapplyAllRules();
    };

    /**
     * Sean Protocol: Math Chassis / UI Orchestrator Data Capture.
     * Reads the baseline world color from the Global Defaults accordion.
     * @returns {string} HEX color string.
     */
    window.captureGlobalDefaults = function() {
        if (typeof tSection === 'function') tSection("Capture Global Defaults");
        const defaultColor = document.getElementById('default-dot-color')?.value || "#ffffff";
        if (typeof tResult === 'function') tResult("Default World Color", defaultColor);
        return defaultColor;
    };
    /**
     * Sean Protocol: Math Chassis / UI Orchestrator Data Capture.
     * Harvests all checked styling overrides from the Styling Rule accordion.
     * @returns {Object} A Rule state object with nullable properties and boolean flags.
     */
    window.captureNewRuleState = function() {
        if (typeof tSection === 'function') tSection("Capture New Rule State");
        
        const applyPrimary = document.getElementById('enable-design-color')?.checked || false;
        const applyRing = document.getElementById('enable-design-ring')?.checked || false;
        const applyIcon = document.getElementById('enable-design-icon')?.checked || false;
        const applyTextCase = document.getElementById('enable-design-text-case')?.checked || false;
        const applyBgFill = document.getElementById('enable-design-bg-fill')?.checked || false;
        const applyItalics = document.getElementById('enable-design-italics')?.checked || false;
        const applyUnderline = document.getElementById('enable-design-underline')?.checked || false;

        const ruleState = {
            color: applyPrimary ? document.getElementById('design-glow-color').value : null,
            ringColor: applyRing ? document.getElementById('design-ring-color').value : null,
            iconStyle: applyIcon ? document.getElementById('design-icon-style').value : null,
            textCase: applyTextCase ? document.getElementById('design-text-case').value : null,
            bgFillColor: applyBgFill ? document.getElementById('design-bg-fill-color').value : null,
            isItalic: applyItalics,
            isUnderline: applyUnderline
        };

        if (typeof writeLogLine === 'function') writeLogLine("Analyzing DOM for enabled styling toggles...");
        if (typeof tResult === 'function') {
            tResult("Primary Color Enabled", applyPrimary);
            tResult("Ring Color Enabled", applyRing);
            tResult("Icon Style Enabled", applyIcon);
            tResult("Text Case Enabled", applyTextCase);
            tResult("Italics Enabled", applyItalics);
            tResult("Underline Enabled", applyUnderline);
        }

        if (ruleState.color && typeof tResult === 'function') tResult("Captured Primary Color", ruleState.color);
        if (ruleState.ringColor && typeof tResult === 'function') tResult("Captured Ring Color", ruleState.ringColor);
        if (ruleState.iconStyle && typeof tResult === 'function') tResult("Captured Icon Style", ruleState.iconStyle);
        if (ruleState.textCase && typeof tResult === 'function') tResult("Captured Text Case", ruleState.textCase);

        return ruleState;
    };

    /**
     * Captures current filter/style as a saved Rule.
     */
    window.applyBatchStyles = function() {
        // Capture rule state via modular Chassis logic
        const ruleState = captureNewRuleState();

        if (ruleState.color === null && ruleState.ringColor === null &&
            ruleState.iconStyle === null && ruleState.textCase === null &&
            ruleState.bgFillColor === null &&
            !ruleState.isItalic && !ruleState.isUnderline) {
            if (typeof showToast === 'function') showToast("Please select at least one style to apply.", 2000);
            if (typeof writeLogLine === 'function') writeLogLine("Abort: No style toggles were enabled.");
            return;
        }
        
        // 2. Package the Rule
        const lockedFilters = JSON.parse(JSON.stringify(activeFilters)); // Deep copy
        const ruleId = 'rule_' + Date.now();
        const description = generateFilterDescription(lockedFilters);

        const newRule = {
            id: ruleId,
            filters: lockedFilters,
            color: ruleState.color,
            ringColor: ruleState.ringColor,
            iconStyle: ruleState.iconStyle,
            textCase: ruleState.textCase,
            bgFillColor: ruleState.bgFillColor,
            isItalic: ruleState.isItalic,
            isUnderline: ruleState.isUnderline,
            description: description
        };

        window.activeFilterRules.push(newRule);
        
        if (typeof writeLogLine === 'function') {
            writeLogLine(`New Rule Created: ${description}`);
            if (typeof tResult === 'function') tResult("Rule ID", ruleId);
        }

        renderRulesLedger();
        window.reapplyAllRules();

        if (typeof showToast === 'function') {
            showToast(`Rule added to ledger.`, 2000);
        }
    };

    /**
     * Phase 5: Export active styling rules as a standalone JSON file.
     * Strictly adheres to the Sean Protocol with trace logging.
     */
    window.exportFilterRules = function() {
        if (typeof tSection === 'function') tSection("Export Filter Rules (Phase 5)");

        if (!window.activeFilterRules || window.activeFilterRules.length === 0) {
            if (typeof writeLogLine === 'function') writeLogLine("Export Aborted: No active rules in ledger.");
            if (typeof showToast === 'function') showToast("Rules ledger is empty.", 2000);
            return;
        }

        if (typeof writeLogLine === 'function') writeLogLine(`Exporting ${window.activeFilterRules.length} rules to JSON...`);

        const rulesJson = JSON.stringify(window.activeFilterRules, null, 4);
        const blob = new Blob([rulesJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `traveller_filter_rules_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        if (typeof showToast === 'function') showToast("Rules exported successfully.", 2000);
    };

    /**
     * Phase 5: Import styling rules from a JSON file.
     * Immediately applies the rules to the map upon successful parse.
     */
    window.importFilterRules = function(event) {
        if (typeof tSection === 'function') tSection("Import Filter Rules (Phase 5)");

        const file = event.target.files[0];
        if (!file) {
            if (typeof writeLogLine === 'function') writeLogLine("Import Aborted: No file selected.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedRules = JSON.parse(e.target.result);
                
                if (!Array.isArray(importedRules)) {
                    throw new Error("Invalid format: Rule file must contain a JSON array.");
                }

                if (typeof writeLogLine === 'function') writeLogLine(`Successfully parsed ${importedRules.length} rules from file.`);
                
                // Directly assign to the global rule manager
                window.activeFilterRules = importedRules;

                // Immediate Repaint Orchestration
                window.renderRulesLedger();
                window.reapplyAllRules();
                
                if (typeof showToast === 'function') showToast(`Successfully imported ${importedRules.length} rules.`, 2500);

            } catch (err) {
                if (typeof writeLogLine === 'function') writeLogLine(`Import Failed: ${err.message}`);
                if (typeof showToast === 'function') showToast("Import Error: Invalid rule file.", 3000);
            } finally {
                // Clear the input value so the user can re-import the same file if needed
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    };

    function saveDesignCheckboxes() {
        const state = {};
        DESIGN_CHECKBOX_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) state[id] = el.checked;
        });
        try { localStorage.setItem(DESIGN_CHECKBOX_STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
    }

    function restoreDesignCheckboxes() {
        try {
            const raw = localStorage.getItem(DESIGN_CHECKBOX_STORAGE_KEY);
            if (!raw) return; // First open — leave all unchecked (HTML defaults)
            const state = JSON.parse(raw);
            DESIGN_CHECKBOX_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el && state[id] !== undefined) el.checked = state[id];
            });
        } catch(e) {}
    }

    function setupFilterListeners() {
        const inputs = [
            'filter-name',
            'filter-starport', 'filter-size', 'filter-atm', 'filter-hydro',
            'filter-pop', 'filter-total-pop', 'filter-gov', 'filter-law', 'filter-tl', 'filter-trade-codes',
            'filter-allegiance', 'filter-gas-giant',
            'filter-gravity', 'filter-temperature', 'filter-t5-ix', 'filter-mgt-importance', 'filter-mgt-wtn', 'filter-mgt-gwp'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = el.type === 'checkbox' ? 'change' : 'input';
                el.addEventListener(eventType, onFilterChanged);
            }
        });

        const checks = ['filter-route-green', 'filter-route-yellow', 'filter-route-red'];
        checks.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', onFilterChanged);
        });

        // Persist design checkbox state on any change
        DESIGN_CHECKBOX_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', saveDesignCheckboxes);
        });

        // Hex Background Fill visibility toggle
        const hexBgToggle = document.getElementById('filter-hex-bg-visible');
        if (hexBgToggle) {
            hexBgToggle.addEventListener('change', () => {
                window.hexBgFillVisible = hexBgToggle.checked;
                if (typeof draw === 'function') requestAnimationFrame(draw);
            });
        }

        // Phase 5: Independent Rule I/O
        const importInput = document.getElementById('file-import-rules');
        if (importInput) {
            importInput.addEventListener('change', window.importFilterRules);
        }
    }

})();
