/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: StatisticalAuditor
 * Version: 0.6.1.0 (Sector-Wide Statistical Validation)
 *
 * Maintains a memory-resident running tally of generated world properties
 * and compares the final distribution against the expectation tables in
 * rules/expectations_data.js. Outputs a Markdown deviation report to the
 * trace log and the console.
 *
 * Sean Protocol: Zero generation logic. Pure counting and comparison.
 * Data source: window.ExpectationTables (rules/expectations_data.js)
 */

class StatisticalAuditor {

    /**
     * @param {string} engineCode  - One of: 'mgt2e', 'ct', 't5', 'rtt'
     * @param {boolean} isSubsector - true = subsector tolerances, false = sector tolerances
     */
    constructor(engineCode, isSubsector = false) {
        this.engine      = (engineCode || 'baseline').toLowerCase();
        this.isSubsector = isSubsector;

        // Resolve expectation table: prefer exact engine match, fall back to baseline
        const tables = (typeof ExpectationTables !== 'undefined') ? ExpectationTables : {};
        this.expectations = tables[this.engine] || tables['baseline'] || {};

        this.tally = {
            total_systems:  0,
            multi_star:     0,
            moon_mainworld: 0,
            garden_world:   0,
            asteroid_belt:  0,
            vacuum_world:   0,
            high_pop:       0,
            major_starport: 0,
            max_tech_level: 0
        };

        // Temperature peaks — tracked separately for Gas Giants and all other bodies
        this.hottestGasGiant = null; // { tempK, tempC, hexId, orbitId, label }
        this.hottestNonGG    = null; // { tempK, tempC, hexId, orbitId, label }
    }

    /**
     * Record one system into the running tally.
     *
     * @param {Object} worldStats - Normalised snapshot of one system's mainworld.
     *   Expected properties (all numeric codes, not UWP characters):
     *     stars       {number}  - Total star count in the system
     *     isMoonMainworld {boolean} - true when mainworld orbits a parent body
     *     size        {number}  - UWP Size digit  (0-15)
     *     atmosphere  {number}  - UWP Atm digit   (0-15)
     *     hydrosphere {number}  - UWP Hydro digit (0-10)
     *     population  {number}  - UWP Pop digit   (0-15)
     *     starport    {string}  - Single letter starport class (A-X)
     *     techLevel   {number}  - UWP TL digit    (0-33)
     */
    recordSystem(worldStats) {
        this.tally.total_systems++;

        // ── Astrophysical ─────────────────────────────────────────────────────
        if ((worldStats.stars || 1) > 1)   this.tally.multi_star++;
        if (worldStats.isMoonMainworld)     this.tally.moon_mainworld++;

        // ── Ecological ────────────────────────────────────────────────────────
        // Garden World: temperate size, breathable atmosphere, liquid water present
        const sz  = worldStats.size       || 0;
        const atm = worldStats.atmosphere  || 0;
        const hyd = worldStats.hydrosphere || 0;
        if (sz >= 5 && sz <= 10 && atm >= 4 && atm <= 9 && hyd >= 4 && hyd <= 8) {
            this.tally.garden_world++;
        }
        // Asteroid Belt mainworld
        if (sz === 0) this.tally.asteroid_belt++;
        // Vacuum World: no atmosphere
        if (atm === 0) this.tally.vacuum_world++;

        // ── Societal ──────────────────────────────────────────────────────────
        const pop = worldStats.population || 0;
        const tl  = worldStats.techLevel  || 0;
        const sp  = worldStats.starport   || 'X';

        if (pop >= 9)                        this.tally.high_pop++;
        if (sp === 'A' || sp === 'B')        this.tally.major_starport++;
        if (tl > this.tally.max_tech_level)  this.tally.max_tech_level = tl;
    }

    /**
     * Record the temperature of any body (mainworld or otherwise).
     * Keeps track of the single hottest body seen across the entire run.
     * Called for every world and moon that has a meanTempK value.
     *
     * @param {number} tempK    - Mean temperature in Kelvin
     * @param {string} hexId    - Hex coordinate string (e.g. '0101')
     * @param {number} orbitId  - Orbital position (may be undefined for moons)
     * @param {string} label    - Body name or type label
     * @param {string} bodyType - Body type string (e.g. 'Gas Giant', 'Mainworld', 'Satellite')
     */
    recordWorldTemp(tempK, hexId, orbitId, label, bodyType) {
        if (tempK === undefined || tempK === null || isNaN(tempK)) return;
        const entry = {
            tempK:   Math.round(tempK),
            tempC:   Math.round(tempK - 273),
            hexId:   hexId || '?',
            orbitId: (orbitId !== undefined && orbitId !== null)
                         ? (typeof orbitId === 'number' ? orbitId.toFixed(2) : orbitId)
                         : '?',
            label:   label || 'Unknown'
        };
        if (bodyType === 'Gas Giant') {
            if (!this.hottestGasGiant || tempK > this.hottestGasGiant.tempK) this.hottestGasGiant = entry;
        } else {
            if (!this.hottestNonGG    || tempK > this.hottestNonGG.tempK)    this.hottestNonGG    = entry;
        }
    }

    /**
     * Compare tallies against expectation tables and output a report.
     * Logs ANSI-coloured status lines to console.
     * Writes a Markdown table to window.batchLogData (if logging is enabled)
     * and to the trace log via writeLogLine.
     *
     * @returns {string} The Markdown report string.
     */
    generateDeviationReport() {
        const n     = this.tally.total_systems;
        const scope = this.isSubsector ? 'Subsector' : 'Sector';

        console.log(`\n=== STATISTICAL AUDIT: ${this.engine.toUpperCase()} — ${n} systems (${scope}) ===`);

        let md = `\n## Statistical Deviation Report — ${this.engine.toUpperCase()} (${n} systems, ${scope})\n`;
        md    += `| Metric | Actual | Expected | Deviation | Status |\n`;
        md    += `| :--- | ---: | ---: | ---: | :---: |\n`;

        // ── Helpers ───────────────────────────────────────────────────────────

        const processRatePct = (label, count, block) => {
            if (!block) return;

            if (block.type === 'emergent') {
                const pct = n > 0 ? ((count / n) * 100).toFixed(1) : '0.0';
                md += `| ${label} | ${pct}% | Emergent | N/A | [EMERGENT] |\n`;
                console.log(`  [EMERGENT] ${label}: ${pct}% (no fixed target)`);
                return;
            }

            const actual    = n > 0 ? (count / n) * 100 : 0;
            const actualStr = actual.toFixed(1);
            const target    = block.target;
            const tol       = this.isSubsector ? block.subsector_tolerance : block.sector_tolerance;
            const dev       = actual - target;
            const devStr    = (dev >= 0 ? '+' : '') + dev.toFixed(1);
            const pass      = Math.abs(dev) <= tol;
            const status    = pass ? '[PASS]' : '[STATISTICAL WARNING]';

            md += `| ${label} | ${actualStr}% | ${target}% ±${tol}% | ${devStr}% | ${status} |\n`;

            if (pass) {
                console.log(`  \x1b[32m${status}\x1b[0m ${label}: ${actualStr}%`);
            } else {
                console.warn(`  \x1b[33m${status}\x1b[0m ${label}: ${actualStr}% (target ${target}%, deviation ${devStr}%)`);
            }
        };

        const processCeiling = (label, block) => {
            if (!block) return;
            const cap    = this.isSubsector ? block.target_subsector : block.target_sector;
            const actual = this.tally.max_tech_level;
            const pass   = actual >= cap;
            const status = pass ? '[PASS]' : '[STATISTICAL WARNING]';

            md += `| ${label} | TL ${actual} | TL ${cap}+ | N/A | ${status} |\n`;

            if (pass) {
                console.log(`  \x1b[32m${status}\x1b[0m ${label}: reached TL ${actual}`);
            } else {
                console.warn(`  \x1b[33m${status}\x1b[0m ${label}: max TL ${actual} (expected ${cap}+)`);
            }
        };

        // ── Astrophysical ─────────────────────────────────────────────────────
        const astro = this.expectations.astrophysical || {};
        processRatePct('Multi-Star Systems', this.tally.multi_star,     astro.multi_star_pct);
        processRatePct('Moon Mainworlds',    this.tally.moon_mainworld,  astro.moon_mainworld_pct);

        // ── Ecological ────────────────────────────────────────────────────────
        const eco = this.expectations.ecological || {};
        processRatePct('Garden Worlds',   this.tally.garden_world,   eco.garden_world_pct);
        processRatePct('Asteroid Belts',  this.tally.asteroid_belt,  eco.asteroid_belt_pct);
        processRatePct('Vacuum Worlds',   this.tally.vacuum_world,   eco.vacuum_world_pct);

        // ── Societal ──────────────────────────────────────────────────────────
        const soc = this.expectations.societal || {};
        processRatePct('High Population',  this.tally.high_pop,       soc.high_pop_pct);
        processRatePct('Major Starports',  this.tally.major_starport, soc.major_starport_pct);
        processCeiling('Max Tech Level',                               soc.max_tech_level);

        // ── Temperature Peaks (Gas Giants and non-GG bodies tracked separately) ──
        const hasTempData = this.hottestGasGiant || this.hottestNonGG;
        if (hasTempData) {
            md += `\n### Temperature Peaks\n`;
            md += `| Category | Body | Hex | Orbit | Temp (K) | Temp (°C) |\n`;
            md += `| :--- | :--- | :--- | ---: | ---: | ---: |\n`;
            if (this.hottestGasGiant) {
                const gg = this.hottestGasGiant;
                md += `| Gas Giant | ${gg.label} | ${gg.hexId} | ${gg.orbitId} | ${gg.tempK} | ${gg.tempC} |\n`;
                console.log(`  [TEMP PEAK — GG]     ${gg.label} @ Hex ${gg.hexId}, Orbit ${gg.orbitId} — ${gg.tempK} K (${gg.tempC}°C)`);
            }
            if (this.hottestNonGG) {
                const ngg = this.hottestNonGG;
                md += `| Planet/Moon | ${ngg.label} | ${ngg.hexId} | ${ngg.orbitId} | ${ngg.tempK} | ${ngg.tempC} |\n`;
                console.log(`  [TEMP PEAK — Non-GG] ${ngg.label} @ Hex ${ngg.hexId}, Orbit ${ngg.orbitId} — ${ngg.tempK} K (${ngg.tempC}°C)`);
            }
        }

        console.log(`=== END AUDIT ===\n`);

        // Push to trace / batch log if logging is active
        if (typeof writeLogLine === 'function') {
            md.split('\n').forEach(line => writeLogLine(line));
        }
        if (typeof window !== 'undefined' && Array.isArray(window.batchLogData)) {
            window.batchLogData.push(md);
        }

        return md;
    }
}

// Expose as a browser global
window.StatisticalAuditor = StatisticalAuditor;
