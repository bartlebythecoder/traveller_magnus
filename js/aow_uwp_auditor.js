/**
 * js/aow_uwp_auditor.js
 *
 * AoW UWP AUDITOR
 * Validates Architect of Worlds system generation and enforces basic UWP consistency,
 * mirroring ct_uwp_auditor.js / t5_uwp_auditor.js's shape and runAndLog pattern.
 *
 * Did not exist before this pass — aow_bottomup_generator.js required/referenced it in its
 * module wiring, but the file itself was missing, so its audit call was permanently dead code.
 * See directives/project_manifest.md, OW-9.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AoW_UWP_Auditor = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const _log = (typeof writeLogLine === 'function') ? writeLogLine : () => {};
    const _tSection = (typeof tSection === 'function') ? tSection : () => {};
    const _tResult = (typeof tResult === 'function') ? tResult : () => {};

    /**
     * Executes the final system audit. Runs against sys.worlds (the flat list
     * populateAoWWorldsList produces) rather than sys.diskWorksheets — by the time
     * runAndLog is called (Phase 6), sys.worlds is the up-to-date, fully-generated view.
     */
    function auditAoWSystem(sys, options) {
        if (!sys || !sys.worlds) return { pass: true, errors: [] };
        const errors = [];
        let totalErrors = 0;
        const logFail = (msg, orbitId) => {
            _log(`[FAIL] ${msg}`);
            totalErrors++;
            errors.push({ orbitId: orbitId != null ? orbitId : null, message: msg });
        };

        _tSection('AoW System Audit');

        // --- 1. Structure: exactly one Mainworld, unless the barren-system placeholder applies ---
        const mainworlds = sys.worlds.filter(w => w.type === 'Mainworld')
            .concat(sys.worlds.reduce((acc, w) => acc.concat((w.moons || []).filter(m => m.type === 'Mainworld')), []));
        const isBarren = sys.mainworld && sys.mainworld.isBarrenSystem;
        if (!isBarren) {
            if (mainworlds.length === 0) {
                logFail('Structure: No Mainworld found in system.');
            } else if (mainworlds.length > 1) {
                logFail(`Structure: Multiple Mainworlds found (${mainworlds.length}).`);
            } else {
                _log('[PASS] Structure: Exactly 1 Mainworld present.');
            }
        } else {
            _log('[PASS] Structure: Barren-system placeholder — no Mainworld expected.');
        }

        // --- 2. Belt integrity: Planetoid Belts must not carry a physical size ---
        sys.worlds.forEach(w => {
            if (w.type === 'Planetoid Belt' && w.size !== undefined && w.size !== 0) {
                logFail(`Belt Check: Planetoid Belt at Orbit ${w.orbitId} has Size ${w.size}. Must be 0.`, w.orbitId);
            }
        });

        // --- 3. Satellite size must not exceed parent size ---
        sys.worlds.forEach(w => {
            if (!w.moons || w.moons.length === 0 || w.size === undefined) return;
            w.moons.forEach((m, idx) => {
                if (m.size !== undefined && m.size > w.size) {
                    logFail(`Physics: Orbit ${w.orbitId} Satellite ${idx + 1} Size (${m.size}) exceeds Parent Size (${w.size}).`, w.orbitId);
                }
            });
        });

        // --- 4. Population cap: no subordinate world may equal/exceed the Mainworld's population ---
        const mainworldPop = (sys.mainworld && sys.mainworld.pop !== undefined) ? sys.mainworld.pop : 0;
        if (mainworldPop < 15) {
            sys.worlds.forEach(w => {
                if (w.type === 'Mainworld') return;
                if (w.pop > 0 && w.pop >= mainworldPop) {
                    logFail(`Pop Cap: Orbit ${w.orbitId} has Pop ${w.pop}, which is >= Mainworld Pop ${mainworldPop}.`, w.orbitId);
                }
                (w.moons || []).forEach((m, idx) => {
                    if (m.type !== 'Mainworld' && m.pop > 0 && m.pop >= mainworldPop) {
                        logFail(`Pop Cap: Orbit ${w.orbitId} Satellite ${idx + 1} has Pop ${m.pop}, which is >= Mainworld Pop ${mainworldPop}.`, w.orbitId);
                    }
                });
            });
        }

        _tResult('AoW Audit Summary', totalErrors === 0 ? 'ALL CLEAR' : `${totalErrors} error(s) detected`);

        return { pass: totalErrors === 0, errors };
    }

    /**
     * Runs the audit, attaches the result to sys.auditResult, and logs/backlogs failures.
     * Mirrors ct_uwp_auditor.js's / t5_uwp_auditor.js's runAndLog for the System Editor's
     * engine-agnostic OW-3 gate.
     */
    function runAndLog(sys, hexId) {
        const results = auditAoWSystem(sys, { mode: 'bottom-up' });
        sys.auditResult = results;
        if (!results.pass) {
            const errorSummary = results.errors.map(e => `  • ${e.message}`).join('\n');
            console.warn(`[AoW Auditor] System ${hexId} — ${results.errors.length} violation(s):\n${errorSummary}`);
            if (typeof window !== 'undefined') {
                window.auditBacklog = window.auditBacklog || [];
                results.errors.forEach(e => {
                    window.auditBacklog.push({ hexId, orbitId: e.orbitId != null ? e.orbitId : null, engine: 'AoW', message: e.message });
                });
            }
        }
        return results;
    }

    return {
        auditAoWSystem,
        runAndLog
    };
}));
