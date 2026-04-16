/**
 * PROJECT AS ABOVE, SO BELOW - Expectation Tables
 * Data Shield element for Topic 5.1 (Statistical Validation SOP)
 * Provides baseline statistical targets and tolerances for Sector Auditing.
 */

const ExpectationTables = {
    // Basic fallback or generic expectations
    baseline: {
        astrophysical: {
            multi_star_pct: { target: 33, sector_tolerance: 5, subsector_tolerance: 15 }
        },
        ecological: {
            garden_world_pct: { target: 27, sector_tolerance: 5, subsector_tolerance: 15 },
            asteroid_belt_pct: { target: 2.77, sector_tolerance: 2, subsector_tolerance: 10 },
            vacuum_world_pct: { target: 10.8, sector_tolerance: 5, subsector_tolerance: 15 }
        },
        societal: {
            high_pop_pct: { target: 8.33, sector_tolerance: 2.5, subsector_tolerance: 15 },
            max_tech_level: { target_sector: 15, target_subsector: 10, type: "ceiling" },
            // Averages the CT and T5 raw probability curves
            major_starport_pct: { target: 34.7, sector_tolerance: 5, subsector_tolerance: 15 }
        }
    },

    // Traveller 5 Ruleset
    t5: {
        astrophysical: {
            moon_mainworld_pct: { target: 16.67, sector_tolerance: 5, subsector_tolerance: 15 }
        },
        ecological: {
            garden_world_pct: { target: 26.5, sector_tolerance: 5, subsector_tolerance: 15 },
            asteroid_belt_pct: { target: 2.77, sector_tolerance: 2, subsector_tolerance: 10 },
            vacuum_world_pct: { target: 10.8, sector_tolerance: 5, subsector_tolerance: 15 }
        },
        societal: {
            high_pop_pct: { target: 8.33, sector_tolerance: 2.5, subsector_tolerance: 15 },
            max_tech_level: { target_sector: 15, target_subsector: 10, type: "ceiling" },
            major_starport_pct: { target: 41.67, sector_tolerance: 5, subsector_tolerance: 15 }
        }
    },
    
    // Mongoose 2nd Edition Ruleset
    mgt2e: {
        astrophysical: {
            moon_mainworld_pct: { type: "emergent" }
        },
        biological: {
            systems_life_pct: { type: "emergent" },
            worlds_life_pct: { type: "emergent" }
        },
        ecological: {
            garden_world_pct: { target: 25, sector_tolerance: 5, subsector_tolerance: 15 },
            asteroid_belt_pct: { target: 2.77, sector_tolerance: 2, subsector_tolerance: 10 },
            vacuum_world_pct: { target: 14.12, sector_tolerance: 5, subsector_tolerance: 15 }
        },
        societal: {
            high_pop_pct: { target: 8.33, sector_tolerance: 2.5, subsector_tolerance: 15 },
            max_tech_level: { target_sector: 15, target_subsector: 10, type: "ceiling" },
            // Dependent on Population DMs
            major_starport_pct: { type: "emergent" }
        }
    },

    // Classic Traveller Ruleset
    ct: {
        astrophysical: {
            moon_mainworld_pct: { type: "emergent" }
        },
        ecological: {
            garden_world_pct: { target: 28, sector_tolerance: 5, subsector_tolerance: 15 },
            asteroid_belt_pct: { target: 2.77, sector_tolerance: 2, subsector_tolerance: 10 },
            vacuum_world_pct: { target: 10.8, sector_tolerance: 5, subsector_tolerance: 15 }
        },
        societal: {
            high_pop_pct: { target: 8.33, sector_tolerance: 2.5, subsector_tolerance: 15 },
            max_tech_level: { target_sector: 15, target_subsector: 10, type: "ceiling" },
            major_starport_pct: { target: 41.67, sector_tolerance: 5, subsector_tolerance: 15 }
        }
    },

    // RTT Worldgen Ruleset
    rtt: {
        astrophysical: {
            moon_mainworld_pct: { type: "emergent" }
        },
        ecological: {
            garden_world_pct: { target: 15, sector_tolerance: 5, subsector_tolerance: 15 },
            asteroid_belt_pct: { type: "emergent" },
            vacuum_world_pct: { type: "emergent" }
        },
        societal: {
            high_pop_pct: { type: "emergent" },
            max_tech_level: { target_sector: 15, target_subsector: 10, type: "ceiling" },
            // Dependent on Industry, Trade Codes, and Habitation checks
            major_starport_pct: { type: "emergent" }
        }
    }
};

// Exposed as a browser global (loaded via <script> tag in hex_map.html).
// No module.exports — this project uses vanilla JS, not Node.js.