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

    // Initialization
    window.addEventListener('DOMContentLoaded', () => {
        setupFilterListeners();
        setupFilterCloseButton();
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

    /**
     * Sean Protocol: Inject a default, visible style rule for liquid water worlds
     * on fresh session start.
     */
    function initializeDefaultStyleRule() {
        if (typeof tSection === 'function') tSection("Initialize Default Styling Rule");
        
        // Wait briefly to ensure any auto-loaded data has populated the global scope (if any)
        setTimeout(() => {
            if (window.activeFilterRules.length > 0) {
                if (typeof writeLogLine === 'function') writeLogLine("Rules Ledger already populated (likely from save). Skipping default rule injection.");
                return;
            }

            if (typeof writeLogLine === 'function') writeLogLine("Fresh session detected. Injecting 'Liquid Water' default rule.");

            const defaultRule = {
                id: 'rule_default_wet_world',
                filters: {
                    atm: "2-9",
                    hydro: ">0"
                },
                color: "#46b4e8", // Cyan-Blue
                iconStyle: "Classic",
                description: "Atm: 2-9 | Hydro: >0 (Liquid Water Presence)"
            };

            window.activeFilterRules.push(defaultRule);
            
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
            'filter-starport', 'filter-size', 'filter-atm', 'filter-hydro',
            'filter-pop', 'filter-gov', 'filter-law', 'filter-tl',
            'filter-t5-ix', 'filter-mgt-importance', 'filter-mgt-wtn', 'filter-mgt-gwp'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const toggles = ['filter-route-green', 'filter-route-yellow', 'filter-route-red'];
        toggles.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true; // Restore Visibility
        });

        if (typeof writeLogLine === 'function') writeLogLine("Filter inputs cleared. Restoring sector-wide visibility.");
        
        // Immediate trigger (bypass debounce)
        applyActiveFilters();
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

        hexStates.forEach(state => {
            // Optimization: Skip if we found everything
            if (hasT5Ix && hasMgImportance && hasMgWTN && hasMgGWP) return;

            const t5Socio = state.t5Socio;
            const mgtSocio = state.mgtSocio;

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
        
        const conditionalSection = document.getElementById('filter-conditional-section');
        conditionalSection.style.display = (hasT5Ix || hasMgImportance || hasMgWTN || hasMgGWP) ? 'block' : 'none';
    }

    /**
     * Main entry point for filter changes. Implements 300ms debounce.
     */
    function onFilterChanged() {
        if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
        
        filterDebounceTimer = setTimeout(() => {
            if (typeof tSection === 'function') tSection("Debounced Filter Triggered");
            applyActiveFilters();
        }, 300);
    }

    /**
     * Harvests all input values and executes the cross-engine filtering logic.
     */
    function applyActiveFilters() {
        if (typeof writeLogLine === 'function') writeLogLine("Filter Engine: Refreshing results...");
        if (typeof tSection === 'function') tSection("Executing Filter Update Loop");

        // 1. Harvest Field Filters
        activeFilters = {
            starport: document.getElementById('filter-starport')?.value || "",
            size: document.getElementById('filter-size')?.value || "",
            atm: document.getElementById('filter-atm')?.value || "",
            hydro: document.getElementById('filter-hydro')?.value || "",
            pop: document.getElementById('filter-pop')?.value || "",
            gov: document.getElementById('filter-gov')?.value || "",
            law: document.getElementById('filter-law')?.value || "",
            tl: document.getElementById('filter-tl')?.value || "",
            t5Ix: document.getElementById('filter-t5-ix')?.value || "",
            mgtImportance: document.getElementById('filter-mgt-importance')?.value || "",
            mgtWTN: document.getElementById('filter-mgt-wtn')?.value || "",
            mgtGWP: document.getElementById('filter-mgt-gwp')?.value || ""
        };

        let matchCount = 0;
        let totalCount = 0;

        // 3. Evaluation Loop
        hexStates.forEach((state, hexId) => {
            if (state.type !== 'SYSTEM_PRESENT') return;
            totalCount++;

            const worldData = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
            const socioData = state.t5Socio || state.mgtSocio || {};

            // Merge for evaluation
            const evalObject = { ...worldData, ...socioData };

            const isVisible = UniversalMath.applyFilters(evalObject, activeFilters, activeRouteStatus);
            state.isHiddenByFilter = !isVisible;

            if (isVisible) matchCount++;
        });

        const resultsLabel = document.getElementById('filter-results-count');
        if (resultsLabel) resultsLabel.innerText = `${matchCount} / ${totalCount}`;
        
        if (typeof writeLogLine === 'function') writeLogLine(`Filter Loop Complete: ${matchCount} matches found.`);

        // 4. Request Redraw
        if (typeof draw === 'function') requestAnimationFrame(draw);
    }

    /**
     * Tab Switching Logic for the Sector Control modal.
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
            starport: "Starport", size: "Size", atm: "Atm", hydro: "Hydro", 
            pop: "Pop", gov: "Gov", law: "Law", tl: "TL", 
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
            
            row.innerHTML = `
                <div style="display: flex; align-items: center; flex: 1; overflow: hidden;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${rule.color}; margin-right: 8px; flex-shrink: 0;"></span>
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
            if (state.type === 'SYSTEM_PRESENT') state.custom_ui = null;
        });

        // 2. Iterate through rules
        window.activeFilterRules.forEach(rule => {
            if (typeof writeLogLine === 'function') writeLogLine(`Applying Rule: ${rule.description}`);
            let ruleMatchCount = 0;
            
            hexStates.forEach((state, hexId) => {
                if (state.type !== 'SYSTEM_PRESENT') return;
                
                const worldData = state.rttData || state.t5Data || state.mgt2eData || state.ctData;
                const socioData = state.t5Socio || state.mgtSocio || {};
                const evalObject = { ...worldData, ...socioData };

                if (UniversalMath.applyFilters(evalObject, rule.filters)) {
                    if (!state.custom_ui) state.custom_ui = {};
                    state.custom_ui.glowColor = rule.color;
                    state.custom_ui.iconStyle = rule.iconStyle;
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
     * Captures current filter/style as a saved Rule.
     */
    window.applyBatchStyles = function() {
        if (typeof tSection === 'function') tSection("Generate New Filter Rule");
        
        const glowColor = document.getElementById('design-glow-color').value;
        const iconStyle = document.getElementById('design-icon-style').value;
        
        // Deep copy of active filters
        const lockedFilters = JSON.parse(JSON.stringify(activeFilters));
        const ruleId = 'rule_' + Date.now();
        const description = generateFilterDescription(lockedFilters);

        const newRule = {
            id: ruleId,
            filters: lockedFilters,
            color: glowColor,
            iconStyle: iconStyle,
            description: description
        };

        window.activeFilterRules.push(newRule);
        
        if (typeof writeLogLine === 'function') {
            writeLogLine(`New Rule Created: ${description} (Color: ${glowColor})`);
        }

        renderRulesLedger();
        window.reapplyAllRules();

        if (typeof showToast === 'function') {
            showToast(`Rule added to ledger.`, 2000);
        }
    };

    function setupFilterListeners() {
        const inputs = [
            'filter-starport', 'filter-size', 'filter-atm', 'filter-hydro',
            'filter-pop', 'filter-gov', 'filter-law', 'filter-tl',
            'filter-t5-ix', 'filter-mgt-importance', 'filter-mgt-wtn', 'filter-mgt-gwp'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', onFilterChanged);
        });

        const checks = ['filter-route-green', 'filter-route-yellow', 'filter-route-red'];
        checks.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', onFilterChanged);
        });
    }

})();
