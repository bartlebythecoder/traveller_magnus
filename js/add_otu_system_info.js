/**
 * js/add_otu_system_info.js
 *
 * OTU SYSTEM DATA ENRICHMENT
 * Applies published planet/moon orbital structure to imported OTU hex states.
 * Called after OTU import completes when the "Published System Data" checkbox is checked.
 *
 * Sean Protocol: Zero RPG logic. All body data comes directly from OTU_WORLDS / OTU_STARS.
 * No Traveller rules are interpreted or invented.
 *
 * Gospel Rule: The OTU import (travellermap TSV) is the authoritative source for mainworld
 * UWP and stellar types. JSON data enriches with names, distances, and orbital structure only.
 * Any divergence is logged and the imported value is kept.
 *
 * Depends on: otu_system_data.js, universal_math.js (fromEHex), rules/t5_data.js (T5_Data.ORBIT_AU)
 */

(function () {
    'use strict';

    // --- Inconsistency Logger ---

    /**
     * Logs a data divergence between the imported OTU data and the JSON enrichment data.
     * Always writes to console.warn. Writes to the downloadable log when logging is enabled.
     */
    function logInconsistency(hexId, worldName, message) {
        const line = `[OTU Inconsistency] ${hexId} (${worldName}): ${message}`;
        console.warn(line);
        if (window.isLoggingEnabled && typeof writeLogLine === 'function') {
            writeLogLine(line);
        }
    }

    // --- Helpers ---

    /**
     * Parses a location string like "Acton / Kursa / Aldebaran  3220"
     * Returns { sectorName, hexNum } using only the final segment.
     * The leading world/subsystem name is discarded entirely.
     */
    function parseLocation(str) {
        if (!str) return null;
        const parts = str.split(' / ');
        const last = parts[parts.length - 1];
        const idx = last.indexOf('  ');
        if (idx === -1) return null;
        return {
            sectorName: last.slice(0, idx).trim(),
            hexNum: last.slice(idx).trim()
        };
    }

    /**
     * Derives the hexId from a slot number and hex number.
     * Replicates the identical formula from importT5Tab (io_manager.js).
     */
    function computeHexId(slotNum, hexNum) {
        const hexVal = parseInt(hexNum, 10);
        const lQ = Math.floor(hexVal / 100);
        const lR = hexVal % 100;
        const subX = Math.floor((lQ - 1) / 8);
        const subY = Math.floor((lR - 1) / 10);
        const subChar = String.fromCharCode(65 + (subY * 4 + subX));
        return `${slotNum}-${subChar}-${hexNum}`;
    }

    /**
     * Parses a spectral type string into { type, decimal, size }.
     * L-type brown dwarfs are normalised to M per plan Q1.
     * Also accepts the import format (e.g. "M1 V", "BD", "D").
     */
    function parseStarType(typeStr) {
        if (!typeStr) return { type: 'G', decimal: 5, size: 'V' };
        const s = typeStr.trim();
        if (s === 'D') return { type: 'D', decimal: 0, size: 'D' };
        if (s === 'BD') return { type: 'BD', decimal: 0, size: 'V' };
        const match = s.match(/^([OBAFGKML])(\d+(?:\.\d+)?)\s+(\S+)$/);
        if (match) {
            const rawType = match[1];
            return {
                type: rawType === 'L' ? 'M' : rawType,
                decimal: Math.floor(parseFloat(match[2])),
                size: match[3]
            };
        }
        const single = s.match(/^([OBAFGKM])/);
        return { type: single ? single[1] : 'G', decimal: 5, size: 'V' };
    }

    /**
     * Returns the T5 orbit number (0–19) closest to the given AU distance.
     */
    function auToOrbit(au) {
        const T5 = (typeof T5_Data !== 'undefined') ? T5_Data : null;
        if (!T5 || !T5.ORBIT_AU) return 3;
        const orbitAU = T5.ORBIT_AU;
        let closest = 0;
        let minDiff = Infinity;
        for (let i = 0; i < orbitAU.length; i++) {
            const diff = Math.abs(orbitAU[i] - au);
            if (diff < minDiff) { minDiff = diff; closest = i; }
        }
        return closest;
    }

    /**
     * Builds a body object from a UWP string or GG/Ring label.
     */
    function parseOtuUWP(str) {
        if (!str) return { type: 'Terrestrial World', size: 5, _manualFields: [] };
        const u = str.trim();
        if (u === 'Large GG') {
            return { type: 'Large Gas Giant', worldType: 'Large Gas Giant', size: 'S', _manualFields: [] };
        }
        if (u === 'Small GG') {
            return { type: 'Small Gas Giant', worldType: 'Small Gas Giant', size: 'M', _manualFields: [] };
        }
        if (u.length >= 7) {
            const sizeChar = u[1];
            const starport = u[0];
            if (sizeChar === 'R') {
                return {
                    type: 'Ring', worldType: 'Ring',
                    starport, size: 'R',
                    atm: 0, hydro: 0, pop: 0, gov: 0, law: 0, tl: 0,
                    uwp: u, uwpSecondary: u, _manualFields: []
                };
            }
            const size = fromEHex(sizeChar);
            const atm = fromEHex(u[2]);
            const hydro = fromEHex(u[3]);
            const pop = fromEHex(u[4]);
            const gov = fromEHex(u[5]);
            const law = fromEHex(u[6]);
            const tlPart = u.includes('-') ? u.split('-')[1] : '0';
            const tl = fromEHex(tlPart[0] || '0');
            return {
                type: 'Terrestrial World',
                starport, size, atm, hydro, pop, gov, law, tl,
                uwp: u, uwpSecondary: u, _manualFields: []
            };
        }
        return { type: 'Terrestrial World', size: 5, uwp: u, _manualFields: [] };
    }

    function getStarRole(distanceAU) {
        if (distanceAU === null || distanceAU === undefined) return 'Primary';
        if (distanceAU < 5) return 'Close';
        if (distanceAU <= 100) return 'Near';
        return 'Far';
    }

    function getOrbitIdForRole(role) {
        if (role === 'Primary') return 0;
        if (role === 'Close') return 0.5;
        if (role === 'Near') return 6.0;
        return 12.0;
    }

    // --- Core Builder ---

    /**
     * Builds a t5System object (matching the generateT5System output format)
     * from the published JSON data for one location.
     *
     * Gospel Rule: imported UWP and stellar types are authoritative.
     * JSON inconsistencies are logged and the imported values are kept.
     */
    function buildSys(stateObj, locationIds, hexId) {
        const T5 = (typeof T5_Data !== 'undefined') ? T5_Data : null;
        const orbitAU = (T5 && T5.ORBIT_AU) ? T5.ORBIT_AU : [];
        const worldName = stateObj.name || 'unknown';
        let inconsistencies = 0;

        const locationIdSet = new Set(Array.isArray(locationIds) ? locationIds : [locationIds]);

        // A. Build stars — deduplicate by (type, name) per plan Q5
        // Stars are gathered across all location entries for this hex; same star
        // appearing in multiple entries is collapsed by the type|name key.
        const rawStars = (window.OTU_STARS || [])
            .filter(s => locationIdSet.has(s.location_id))
            .sort((a, b) => {
                if (a.distance === null && b.distance !== null) return -1;
                if (a.distance !== null && b.distance === null) return 1;
                return (a.distance || 0) - (b.distance || 0);
            });

        const starKeyMap = new Map();
        rawStars.forEach(s => {
            const key = `${s.type}|${s.name || ''}`;
            if (!starKeyMap.has(key)) {
                const parsed = parseStarType(s.type);
                starKeyMap.set(key, {
                    ...parsed,
                    role: getStarRole(s.distance),
                    name: s.name || (parsed.type + parsed.decimal),
                    _ids: new Set([s.id])
                });
            } else {
                starKeyMap.get(key)._ids.add(s.id);
            }
        });

        const stars = [...starKeyMap.values()];

        const hasPrimary = stars.some(s => s.role === 'Primary');
        if (!hasPrimary && stars.length > 0) stars[0].role = 'Primary';

        // B. Reconcile star types against the gospel (imported t5System.stars)
        // The imported star's .name field IS the spectral type string (e.g. "M1 V").
        const importedStars = (stateObj.t5System && Array.isArray(stateObj.t5System.stars))
            ? stateObj.t5System.stars : [];

        if (importedStars.length > 0 && importedStars.length !== stars.length) {
            logInconsistency(hexId, worldName,
                `Star count mismatch — imported ${importedStars.length}, JSON has ${stars.length} (after dedup). Using JSON star count for orbital structure.`);
            inconsistencies++;
        }

        stars.forEach((star, i) => {
            const importedStar = importedStars[i];
            if (!importedStar) return;

            const imp = parseStarType(importedStar.name || '');

            // Significant mismatch: spectral class or luminosity class differ
            if (imp.type !== star.type || imp.size !== star.size) {
                logInconsistency(hexId, worldName,
                    `Star ${i + 1} "${star.name}": imported type "${importedStar.name}" ≠ JSON type "${star.type}${star.decimal} ${star.size}". Keeping imported type.`);
                inconsistencies++;
                // Gospel Rule: overwrite with imported values
                star.type = imp.type;
                star.decimal = imp.decimal;
                star.size = imp.size;
            }
            // OTU name is kept regardless — it's the enrichment the import lacks
        });

        stars.forEach(star => {
            star.orbitID = getOrbitIdForRole(star.role);
            star.orbits = [];
            for (let i = 0; i < 20; i++) {
                star.orbits.push({ orbit: i, distAU: orbitAU[i] || null, contents: null });
            }
        });

        const primaryStar = stars.find(s => s.role === 'Primary') || stars[0] || null;

        // C. Separate planets from moons — aggregate across all location entries for this hex
        const rawWorlds = (window.OTU_WORLDS || []).filter(w => locationIdSet.has(w.location_id));
        const planets = rawWorlds
            .filter(w => w.orbiting_world_id === null)
            .sort((a, b) => a.position - b.position);
        const moons = rawWorlds
            .filter(w => w.orbiting_world_id !== null)
            .sort((a, b) => a.position - b.position);

        const placedById = new Map();
        let sysMainworld = null;
        const mainworldName = (stateObj.name || '').trim().toLowerCase();

        // D. Place planets
        planets.forEach(planet => {
            const isMainworld = mainworldName && planet.name &&
                planet.name.trim().toLowerCase() === mainworldName;

            let body;
            if (isMainworld) {
                // Gospel Rule: mainworld body is built from the imported t5Data only.
                // Never use parseOtuUWP for the mainworld — t5Data IS the authoritative UWP.
                const importedUWP = stateObj.t5Data ? stateObj.t5Data.uwp : null;
                if (importedUWP && planet.uwp && planet.uwp !== importedUWP &&
                    planet.uwp !== 'Large GG' && planet.uwp !== 'Small GG') {
                    logInconsistency(hexId, worldName,
                        `Mainworld UWP mismatch — imported "${importedUWP}" ≠ JSON "${planet.uwp}". Keeping imported UWP.`);
                    inconsistencies++;
                }
                body = Object.assign({}, stateObj.t5Data, {
                    type: 'Mainworld',
                    distAU: planet.distance,
                    position: planet.position,
                    _manualFields: stateObj.t5Data._manualFields || []
                });
                sysMainworld = body;
            } else {
                body = parseOtuUWP(planet.uwp);
                body.name = planet.name;
                body.distAU = planet.distance;
                body.position = planet.position;

                if (body.size === 0 && planet.name && planet.name.toLowerCase().includes('belt')) {
                    body.worldType = 'Belt';
                    body.type = 'Planetoid Belt';
                }
            }

            let hostStar = primaryStar;
            if (planet.companion_star_id === null) {
                const matched = stars.find(s => s._ids && s._ids.has(planet.star_id));
                if (matched) hostStar = matched;
            }

            if (!hostStar) { placedById.set(planet.id, body); return; }

            const target = auToOrbit(planet.distance || 0);
            let placed = false;
            for (let d = 0; d < 20 && !placed; d++) {
                const slots = d === 0 ? [target] : [target + d, target - d];
                for (const slot of slots) {
                    if (slot >= 0 && slot < 20 && hostStar.orbits[slot] && !hostStar.orbits[slot].contents) {
                        hostStar.orbits[slot].contents = body;
                        placed = true;
                        break;
                    }
                }
            }

            placedById.set(planet.id, body);
        });

        // E. Attach moons — including lunar mainworld detection
        moons.forEach(moon => {
            const parent = placedById.get(moon.orbiting_world_id);
            if (!parent) return;

            const isMoonMainworld = mainworldName && moon.name &&
                moon.name.trim().toLowerCase() === mainworldName;

            let moonBody;
            if (isMoonMainworld) {
                // Gospel Rule: mainworld body built from t5Data, even when it's a satellite
                const importedUWP = stateObj.t5Data ? stateObj.t5Data.uwp : null;
                if (importedUWP && moon.uwp && moon.uwp !== importedUWP &&
                    moon.uwp !== 'Large GG' && moon.uwp !== 'Small GG') {
                    logInconsistency(hexId, worldName,
                        `Mainworld UWP mismatch (lunar) — imported "${importedUWP}" ≠ JSON "${moon.uwp}". Keeping imported UWP.`);
                    inconsistencies++;
                }
                moonBody = Object.assign({}, stateObj.t5Data, {
                    type: 'Mainworld',
                    isMoon: true,
                    isSatellite: true,
                    parentBody: parent.type || 'Planet',
                    orbitLetter: String.fromCharCode(96 + moon.position),
                    distAU: parent.distAU,
                    position: moon.position,
                    _manualFields: stateObj.t5Data._manualFields || []
                });
                sysMainworld = moonBody;
            } else {
                moonBody = parseOtuUWP(moon.uwp);
                moonBody.name = moon.name;
                moonBody.isMoon = true;
                moonBody.isSatellite = true;
                moonBody.parentBody = parent.type || 'Planet';
                moonBody.orbitLetter = String.fromCharCode(96 + moon.position);
                moonBody.distAU = parent.distAU;
            }

            if (!parent.satellites) parent.satellites = [];
            parent.satellites.push(moonBody);
            placedById.set(moon.id, moonBody);
        });

        // F. Mainworld fallback: no name match — use t5Data at first available orbit near orbit 3
        if (!sysMainworld) {
            logInconsistency(hexId, worldName,
                `No world in JSON matched mainworld name "${stateObj.name}". Placing imported mainworld at fallback orbit.`);
            inconsistencies++;
            sysMainworld = Object.assign({}, stateObj.t5Data, { type: 'Mainworld' });
            if (primaryStar) {
                let placed = false;
                for (let d = 0; d < 20 && !placed; d++) {
                    const slots = d === 0 ? [3] : [3 + d, 3 - d];
                    for (const slot of slots) {
                        if (slot >= 0 && slot < 20 && primaryStar.orbits[slot] && !primaryStar.orbits[slot].contents) {
                            primaryStar.orbits[slot].contents = sysMainworld;
                            placed = true; break;
                        }
                    }
                }
            }
        }

        return { mainworld: sysMainworld, stars, sggCount: 0, _inconsistencies: inconsistencies };
    }

    // --- Public Entry Point ---

    /**
     * Iterates OTU_LOCATIONS, groups entries by hex, and injects the combined
     * published orbital structure into stateObj.t5System.
     * All location entries for the same hex are merged (e.g. Jupiter + Neptune
     * for the Sol hex both contribute their worlds).
     * Inconsistencies between JSON and imported data are logged and the import wins.
     */
    function applyOtuSystemData() {
        if (!window.OTU_LOCATIONS || !window.OTU_STARS || !window.OTU_WORLDS) {
            console.warn('[OTU System Data] Constants not loaded — skipping enrichment.');
            return;
        }
        if (typeof hexStates === 'undefined' || !window.sectorNames) {
            console.warn('[OTU System Data] hexStates or sectorNames unavailable — skipping enrichment.');
            return;
        }

        if (window.isLoggingEnabled && typeof writeLogLine === 'function') {
            writeLogLine('=== OTU System Data Enrichment ===');
        }

        const sectorNameToSlot = new Map();
        for (const [slotNum, name] of Object.entries(window.sectorNames)) {
            if (name) sectorNameToSlot.set(name.trim(), parseInt(slotNum, 10));
        }

        // Group all location entries by hexId so every entry for the same system
        // is processed together rather than discarding all but the first.
        const hexLocationMap = new Map(); // hexId -> [locId, ...]
        let skipped = 0;

        for (const loc of window.OTU_LOCATIONS) {
            const parsed = parseLocation(loc.location);
            if (!parsed) { skipped++; continue; }

            const slotNum = sectorNameToSlot.get(parsed.sectorName);
            if (slotNum === undefined) { skipped++; continue; }

            const hexId = computeHexId(slotNum, parsed.hexNum);

            if (!hexLocationMap.has(hexId)) hexLocationMap.set(hexId, []);
            hexLocationMap.get(hexId).push(loc.id);
        }

        let enriched = 0;
        let totalInconsistencies = 0;

        for (const [hexId, locationIds] of hexLocationMap) {
            const stateObj = hexStates.get(hexId);
            if (!stateObj || stateObj.type === 'EMPTY') { skipped++; continue; }

            const sys = buildSys(stateObj, locationIds, hexId);
            totalInconsistencies += (sys._inconsistencies || 0);
            delete sys._inconsistencies;

            stateObj.t5System = sys;
            stateObj.t5Physical = null;
            enriched++;
        }

        const inconsistencyNote = totalInconsistencies > 0
            ? ` ${totalInconsistencies} inconsistenc${totalInconsistencies === 1 ? 'y' : 'ies'} logged — enable logging to download.`
            : '';

        const summary = `[OTU System Data] Enriched ${enriched} system(s). Skipped ${skipped}.${inconsistencyNote}`;
        if (window.isLoggingEnabled && typeof writeLogLine === 'function') writeLogLine(summary);
        console.log(summary);

        const toastMsg = totalInconsistencies > 0
            ? `Published system data applied to ${enriched} system(s). ${totalInconsistencies} inconsistenc${totalInconsistencies === 1 ? 'y' : 'ies'} found — see log.`
            : `Published system data applied to ${enriched} system(s).`;
        if (typeof showToast === 'function') showToast(toastMsg, totalInconsistencies > 0 ? 7000 : 4000);
    }

    window.applyOtuSystemData = applyOtuSystemData;

}());
