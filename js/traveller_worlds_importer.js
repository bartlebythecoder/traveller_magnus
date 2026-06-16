/**
 * js/traveller_worlds_importer.js
 *
 * Imports a Traveller Worlds JSON export into hexStates.
 *
 * Public API:
 *   TravellerWorldsImporter.importSystem(jsonObj, hexId, edition)
 *   edition: 'T5' | 'MgT2E'
 *   Returns true on success, throws on validation failure.
 *
 * Sean Protocol: Zero generation logic, zero RPG assumptions.
 * All values are sourced directly from the JSON; Ix is the only
 * derived value and uses the T5 formula verbatim from t5_socio_engine.js.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'));
    } else {
        root.TravellerWorldsImporter = factory(root.UniversalMath);
    }
}(typeof self !== 'undefined' ? self : this, function (UniversalMath) {
    'use strict';

    const { toEHex } = UniversalMath;

    // =========================================================================
    // PHASE 0: VALIDATION
    // =========================================================================

    function validate(jsonObj, hexId, edition) {
        if (!jsonObj || typeof jsonObj !== 'object')
            throw new Error('TW Import: jsonObj is null or not an object');
        if (!jsonObj.mainWorld)
            throw new Error('TW Import: jsonObj.mainWorld missing');
        if (!jsonObj.stars || typeof jsonObj.stars !== 'object')
            throw new Error('TW Import: jsonObj.stars missing');
        if (!Array.isArray(jsonObj.orbitSets) || jsonObj.orbitSets.length === 0)
            throw new Error('TW Import: jsonObj.orbitSets missing or empty');
        if (!hexId || typeof hexId !== 'string' || hexId.trim() === '')
            throw new Error(`TW Import: invalid hexId "${hexId}"`);
        if (edition !== 'T5' && edition !== 'MgT2E')
            throw new Error(`TW Import: edition must be 'T5' or 'MgT2E', got "${edition}"`);
    }

    // =========================================================================
    // PHASE 1: PARSE STARS
    // =========================================================================
    //
    // Traveller Worlds key naming convention:
    //   star0, star1, star2  → S-type companions (own subsystem nested in primary orbits)
    //   companion0, companion1 → P-type companions (tight binary; worlds orbit both)
    //
    // Returns parsedStars[] where [0] is always the primary.
    // orbitId is null initially; set later when the nested orbitSet is found.

    function parseStars(starsObj) {
        const starKeys      = Object.keys(starsObj).filter(k => /^star\d/.test(k)).sort();
        const companionKeys = Object.keys(starsObj).filter(k => /^companion\d/.test(k)).sort();

        const parsedStars = [];

        for (const key of starKeys) {
            parsedStars.push(buildParsedStar(key, starsObj[key], false));
        }
        for (const key of companionKeys) {
            parsedStars.push(buildParsedStar(key, starsObj[key], true));
        }

        return parsedStars;
    }

    function buildParsedStar(key, s, isCompanion) {
        const rawClass   = s.spectral_class || 'G2';        // e.g. "F7", "M0"
        const sType      = rawClass.replace(/\d/g, '').charAt(0).toUpperCase() || 'G';
        const subMatch   = rawClass.match(/\d/);
        const subType    = subMatch ? parseInt(subMatch[0]) : 0;
        const sClass     = s.spectral_size || 'V';
        return {
            key,
            isCompanion,
            sType,
            subType,
            sClass,
            spectralClass: rawClass,
            spectralSize:  sClass,
            name:          `${rawClass} ${sClass}`,
            orbitId:       null,    // populated when nested orbitSet is encountered
        };
    }

    function findStarIndex(centralStar, parsedStars) {
        if (!centralStar) return -1;
        return parsedStars.findIndex(ps =>
            ps.spectralClass === centralStar.spectral_class &&
            ps.spectralSize  === centralStar.spectral_size
        );
    }

    // =========================================================================
    // PHASES 2 + 5: WALK ORBIT SETS, COLLECT WORLDS
    // =========================================================================
    //
    // Only orbitSets[0] (the primary star's orbit set) is walked. Subsequent
    // top-level entries duplicate the nested companion data and are skipped.
    //
    // Nested orbitSet entries (contents.type === 'orbitSet') are S-type
    // companion star subsystems; their position in the primary orbits gives
    // the companion's orbitId.
    //
    // P-type (circumbinary) is detected by orbitSets[0].companionStar being
    // present; all worlds in that set get orbitType = 'P-Type'.
    //
    // Returns: { allWorlds[], mainworldOrbitId, mainworldStarIdx }
    // Side effect: sets parsedStars[i].orbitId for S-type companions.

    function collectWorlds(orbitSets, parsedStars) {
        const allWorlds       = [];
        let mainworldOrbitId  = 0;
        let mainworldStarIdx  = 0;

        const primaryOrbitSet = orbitSets[0];
        const isPType         = !!primaryOrbitSet.companionStar;

        function walkOrbitSet(orbitSet, parentStarIdx, orbitType) {
            for (const orbit of (orbitSet.orbits || [])) {
                const orbitId  = orbit.baseOrbit + orbit.increment;
                const contents = orbit.contents;
                if (!contents) continue;

                // Ring — no UWP, nothing to import
                if (contents.type === 'ring') continue;

                // Nested orbitSet → S-type companion star subsystem
                if (contents.type === 'orbitSet') {
                    const matchedIdx = findStarIndex(contents.centralStar, parsedStars);
                    const compIdx    = matchedIdx >= 0 ? matchedIdx : (parsedStars.length > 1 ? 1 : 0);
                    // Record the companion's orbital position within the primary system
                    if (compIdx < parsedStars.length && parsedStars[compIdx].orbitId === null) {
                        parsedStars[compIdx].orbitId = orbitId;
                    }
                    walkOrbitSet(contents, compIdx, 'S-Type');
                    continue;
                }

                // Regular world body
                const world = parseWorldContents(contents, orbitId, parentStarIdx, orbitType);
                if (contents.isMainWorld) {
                    mainworldOrbitId = orbitId;
                    mainworldStarIdx = parentStarIdx;
                }
                allWorlds.push(world);
            }
        }

        walkOrbitSet(primaryOrbitSet, 0, isPType ? 'P-Type' : 'S-Type');

        return { allWorlds, mainworldOrbitId, mainworldStarIdx };
    }

    // =========================================================================
    // PHASES 3 + 4: PARSE A SINGLE WORLD CONTENTS OBJECT
    // =========================================================================

    function parseWorldContents(c, orbitId, parentStarIdx, orbitType) {
        const u      = c.uwp || {};
        const port   = u.port  !== undefined ? u.port  : 'X';
        const size   = u.size  !== undefined ? u.size  : 0;
        const atm    = u.atmos !== undefined ? u.atmos : 0;
        const hydro  = u.hydro !== undefined ? u.hydro : 0;
        const pop    = u.popul !== undefined ? u.popul : 0;
        const gov    = u.gov   !== undefined ? u.gov   : 0;
        const law    = u.law   !== undefined ? u.law   : 0;
        const tl     = u.TL    !== undefined ? u.TL    : 0;

        const uwpStr = `${port}${toEHex(size)}${toEHex(atm)}${toEHex(hydro)}${toEHex(pop)}${toEHex(gov)}${toEHex(law)}-${toEHex(tl)}`;

        const tradeCodes = (c.tcs && Array.isArray(c.tcs.classes)) ? [...c.tcs.classes] : [];
        const bases      = c.bases || '';
        const isMainworld = !!c.isMainWorld;

        // Determine body type
        const genObj  = c.generationObject || '';
        let worldType = 'Terrestrial Planet';
        let ggType    = null;
        if (isMainworld) {
            worldType = 'Mainworld';
        } else if (size === 0) {
            worldType = 'Planetoid Belt';
        } else if (genObj.includes('Gas Giant') || genObj === 'Ice Giant') {
            worldType = 'Gas Giant';
            if      (genObj.includes('Large'))                           ggType = 'GL';
            else if (genObj.includes('Small') || genObj === 'Ice Giant') ggType = 'GS';
            else                                                          ggType = 'GM';
        }

        // Planetoid Belt physical nulls
        const isBelt      = size === 0;
        const axialTilt   = isBelt ? null : (c.axialTilt  !== undefined ? c.axialTilt  : null);
        const solarDay    = isBelt ? null : (c.rotationalPeriod !== undefined ? c.rotationalPeriod : null);

        const world = {
            // Identity
            name:             c.name || '',
            type:             worldType,
            ggType,
            isMainWorld:      isMainworld,

            // UWP fields (integer + display string)
            uwp:              uwpStr,
            size,   atm,   atmCode:   atm,
            hydro,          hydroCode: hydro,
            pop,            popCode:   pop,
            gov,            govCode:   gov,
            law,            lawCode:   law,
            tl,             tlCode:    tl,

            starport: port,
            ...(isMainworld ? {} : { uwpSecondary: uwpStr }),

            // Trade / social / routing
            tradeCodes,
            travelZone:       c.travelZone || '',
            allegiance:       c.allegiance || '',

            // Bases (parsed from character string)
            navalBase:        bases.includes('N'),
            scoutBase:        bases.includes('S') || bases.includes('s'),
            militaryBase:     bases.includes('M'),
            wayStation:       bases.includes('W'),

            // Orbital position
            orbitId,
            parentStarIdx,
            orbitType,

            // Physical — fields native to MgT2E engine
            diamKm:           c.diameter        !== undefined ? c.diameter        : 0,
            density:          c.density         !== undefined ? c.density         : 1,
            composition:      c.densityType     || '',
            axialTilt,
            solarDayHours:    solarDay,
            totalPressureBar: c.atmosPressure   !== undefined ? c.atmosPressure   : null,
            hydroPercent:     c.hydroPercentage !== undefined ? c.hydroPercentage : null,
            lifeProfile:      c.nativeLife      ? '1000' : '0000',
            nativeLife:       !!c.nativeLife,

            // worldType stored verbatim from generationObject (T5 + display; H&C B-3)
            worldType:        c.generationObject || '',
            generationObject: c.generationObject || '',

            // Display-only physical (stored on both editions; no engine reads these)
            albedo:              c.albedo           !== undefined ? c.albedo           : null,
            greenhouse:          c.greenhouse       !== undefined ? c.greenhouse       : null,
            surfaceLiquid:       c.surfaceLiquid    || '',
            atmosComposition:    c.atmosComposition || '',
            atmosPressureLabel:  c.atmosPressureTbl || '',
            stressFactor:        c.stressFactor     !== undefined ? c.stressFactor     : null,
            populLimit:          c.populLimit       !== undefined ? c.populLimit       : null,
            nilName:             (c.nil && c.nil.name) ? c.nil.name : '',
            resourcesList:       Array.isArray(c.resources) ? [...c.resources] : [],

            // Belt detail block (Planetoid Belt only)
            beltDetails:         c.beltDetails || null,
        };

        // Moons/satellites from satelliteSystem.sats[]
        const satSys = c.satelliteSystem;
        if (satSys && Array.isArray(satSys.sats) && satSys.sats.length > 0) {
            world.moons = satSys.sats
                .filter(sat => sat && sat.contents)
                .map((sat, satIdx) => {
                    const moon = parseWorldContents(sat.contents, satIdx, parentStarIdx, orbitType);
                    moon.isMoon      = true;
                    moon.isSatellite = true;
                    return moon;
                });
        } else {
            world.moons = [];
        }

        return world;
    }

    // =========================================================================
    // PHASE 6: SOCIOECONOMICS
    // =========================================================================

    // T5 Ix formula — mirrors t5_socio_engine.js exactly
    function calcIx(port, tl, pop, tradeCodes, navalBase, scoutBase, wayStation) {
        let Ix = 0;
        if (['A', 'B'].includes(port))       Ix += 1;
        if (['D', 'E', 'X'].includes(port))  Ix -= 1;
        if (tl >= 16) Ix += 1;
        if (tl >= 10) Ix += 1;
        if (tl <= 8)  Ix -= 1;
        if (tradeCodes.includes('Ag')) Ix += 1;
        if (tradeCodes.includes('Hi')) Ix += 1;
        if (tradeCodes.includes('In')) Ix += 1;
        if (tradeCodes.includes('Ri')) Ix += 1;
        if (pop <= 6)                  Ix -= 1;
        if (navalBase && scoutBase)    Ix += 1;
        if (wayStation)                Ix += 1;
        return Ix;
    }

    function buildT5Socio(mainworld, economicExt, culturalExt, nobleCodes) {
        const Ix = calcIx(
            mainworld.starport,
            mainworld.tl,
            mainworld.pop,
            mainworld.tradeCodes || [],
            mainworld.navalBase,
            mainworld.scoutBase,
            mainworld.wayStation
        );

        const R   = economicExt.resources      !== undefined ? economicExt.resources      : 0;
        const L   = economicExt.labour         !== undefined ? economicExt.labour         : Math.max(0, mainworld.pop - 1);
        const I   = economicExt.infrastructure !== undefined ? economicExt.infrastructure : 0;
        const E   = economicExt.efficiency     !== undefined ? economicExt.efficiency     : 0;
        const H   = culturalExt.homogeneity    !== undefined ? culturalExt.homogeneity    : 0;
        const A   = culturalExt.acceptance     !== undefined ? culturalExt.acceptance     : 0;
        const S   = culturalExt.strangeness    !== undefined ? culturalExt.strangeness    : 0;
        const Sym = culturalExt.symbols        !== undefined ? culturalExt.symbols        : 0;

        const calcR  = R === 0 ? 1 : R;
        const calcL  = L === 0 ? 1 : L;
        const calcI  = I === 0 ? 1 : I;
        const calcE  = E === 0 ? 1 : E;
        const RU     = calcR * calcL * calcI * calcE;

        const ixStr  = `{${Ix >= 0 ? '+' : ''}${Ix}}`;
        const exStr  = `(${toEHex(R)}${toEHex(L)}${toEHex(I)}${E >= 0 ? '+' : ''}${E})`;
        const cxStr  = `[${toEHex(H)}${toEHex(A)}${toEHex(S)}${toEHex(Sym)}]`;

        return {
            Ix, R, L, I, E, RU, H, A, S, Sym,
            ixString:        ixStr,
            exString:        exStr,
            cxString:        cxStr,
            displayString:   `${ixStr} ${exStr} ${cxStr} RU:${RU}`,
            importance:      Ix,
            resourceUnits:   RU,
            ecoResources:    R,
            ecoLabor:        L,
            ecoInfrastructure: I,
            ecoEfficiency:   E,
            culturalProfile: `${toEHex(H)}${toEHex(A)}${toEHex(S)}${toEHex(Sym)}`,
            nobleCodes:      nobleCodes || '',
            popMultiplier:   mainworld.popDigit,
            belts:           mainworld.planetoidBelts || 0,
            gasGiants:       mainworld.gasGiantsCount || 0,
            worlds:          mainworld._importedWorldCount || 0,
        };
    }

    function applyMgT2ESocio(mainworld, economicExt, culturalExt, nobleCodes) {
        const Ix = calcIx(
            mainworld.starport,
            mainworld.tl,
            mainworld.pop,
            mainworld.tradeCodes || [],
            mainworld.navalBase,
            mainworld.scoutBase,
            mainworld.wayStation
        );

        mainworld.ecoR  = economicExt.resources      !== undefined ? economicExt.resources      : 0;
        mainworld.ecoL  = economicExt.labour         !== undefined ? economicExt.labour         : Math.max(0, mainworld.pop - 1);
        mainworld.ecoI  = economicExt.infrastructure !== undefined ? economicExt.infrastructure : 0;
        mainworld.ecoE  = economicExt.efficiency     !== undefined ? economicExt.efficiency     : 0;
        mainworld.H     = culturalExt.homogeneity    !== undefined ? culturalExt.homogeneity    : 0;
        mainworld.A     = culturalExt.acceptance     !== undefined ? culturalExt.acceptance     : 0;
        mainworld.S     = culturalExt.strangeness    !== undefined ? culturalExt.strangeness    : 0;
        mainworld.Sym   = culturalExt.symbols        !== undefined ? culturalExt.symbols        : 0;
        mainworld.Im             = Ix;
        mainworld.nobleCodes     = nobleCodes || '';
        mainworld.culturalProfile = `${toEHex(H)}${toEHex(A)}${toEHex(S)}${toEHex(Sym)}`;
    }

    // =========================================================================
    // PHASE 7: BUILD EDITION-SPECIFIC SYSTEM OBJECTS
    // =========================================================================

    // Interpolates an orbital AU distance from an orbitId using the MgT2E table.
    // Mirrors the same logic in system_viewer._orbitToAU.
    const _MGT_FALLBACK_AU = [0, 0.2, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10.0, 19.6, 38.8, 77.2, 154.0];

    function _mgtOrbitToAU(orbitId) {
        const tbl = (typeof MgT2EData !== 'undefined' && MgT2EData.stellar && MgT2EData.stellar.orbitAu)
                    ? MgT2EData.stellar.orbitAu
                    : _MGT_FALLBACK_AU;
        const idx  = Math.floor(orbitId);
        const frac = orbitId - idx;
        const max  = tbl.length - 1;
        const lo   = tbl[Math.min(idx, max)];
        const hi   = idx < max ? tbl[idx + 1] : lo;
        return lo + frac * (hi - lo);
    }

    function buildT5System(hexId, parsedStars, allWorlds) {
        const ORBIT_AU = (typeof T5_Data !== 'undefined' && T5_Data.ORBIT_AU) ? T5_Data.ORBIT_AU : [];
        const ROLE_MAP = ['Primary', 'Close', 'Near', 'Far'];

        const stars = parsedStars.map((ps, idx) => {
            // P-type companions are tight binaries co-located with the primary.
            // They have no meaningful orbit slot in the primary's array; give them
            // a small distAU so the viewer positions them close to the centre rather
            // than at the S-type fallback of 0.5 (which overlaps orbit 0).
            if (ps.isCompanion) {
                const star = {
                    role:    'Companion',
                    type:    ps.sType,
                    decimal: ps.subType,
                    size:    ps.sClass,
                    name:    ps.name,
                    orbitID: null,
                    distAU:  0.05,
                    orbits:  [],
                };
                for (let i = 0; i < 20; i++) {
                    star.orbits.push({ orbit: i, distAU: ORBIT_AU[i] || 0, contents: null });
                }
                return star;
            }

            const defaultOrbitIds = [null, 0.5, 6.0, 12.0];
            const orbitID = ps.orbitId !== null ? ps.orbitId
                          : (defaultOrbitIds[idx] !== undefined ? defaultOrbitIds[idx] : 12.0);
            const star = {
                role:    ROLE_MAP[idx] || 'Far',
                type:    ps.sType,
                decimal: ps.subType,
                size:    ps.sClass,
                name:    ps.name,
                orbitID,
                orbits:  [],
            };
            for (let i = 0; i < 20; i++) {
                star.orbits.push({ orbit: i, distAU: ORBIT_AU[i] || 0, contents: null });
            }
            return star;
        });

        // Place each world into the correct star's orbit slot
        for (const w of allWorlds) {
            const starIdx  = w.parentStarIdx !== undefined ? w.parentStarIdx : 0;
            const orbitIdx = Math.round(w.orbitId);
            if (stars[starIdx] && orbitIdx >= 0 && orbitIdx < 20) {
                stars[starIdx].orbits[orbitIdx].contents = w;
            }
            // Alias .moons as .satellites so applyT5OrbitalNames can find them
            if (w.moons && w.moons.length > 0) w.satellites = w.moons;
        }

        const mainworld = allWorlds.find(w => w.isMainWorld) || allWorlds[0];

        // Set distAU on the mainworld so _normalizeT5 can place the HZ band correctly.
        if (mainworld && mainworld.orbitId != null) {
            const slotIdx = Math.round(mainworld.orbitId);
            const mwStar  = stars[mainworld.parentStarIdx || 0];
            if (mwStar && mwStar.orbits[slotIdx]) {
                mainworld.distAU = mwStar.orbits[slotIdx].distAU;
            }
        }

        return {
            hexId,
            stars,
            mainworld,
            worlds:      allWorlds,
            totalWorlds: allWorlds.length,
            sggCount:    0,
        };
    }

    function buildMgT2ESystem(hexId, parsedStars, allWorlds, gasGiants, planetoidBelts) {
        const ROLE_MAP = ['Primary', 'Close', 'Near', 'Far'];

        const stars = parsedStars.map((ps, idx) => {
            let role, separation;
            if (idx === 0) {
                role       = 'Primary';
                separation = null;
            } else if (ps.isCompanion) {
                role       = 'Companion';
                separation = 'Companion';
            } else {
                role       = ROLE_MAP[idx] || 'Far';
                separation = role;
            }
            const defaultOrbitIds = [null, 0.5, 6.0, 12.0];
            const orbitId = ps.orbitId !== null ? ps.orbitId
                          : (defaultOrbitIds[idx] !== undefined ? defaultOrbitIds[idx] : 12.0);
            return {
                role,
                separation,
                sType:         ps.sType,
                subType:       ps.subType,
                sClass:        ps.sClass,
                name:          ps.name,
                orbitId:       idx === 0 ? null : orbitId,
                parentStarIdx: idx === 0 ? undefined : 0,
                eccentricity:  0,
                mass:          1,
                lum:           1,
                diam:          1,
                temp:          5800,
                mao:           0,
            };
        });

        const mainworld = allWorlds.find(w => w.isMainWorld) || allWorlds[0];

        // Compute AU distances so the system viewer can position worlds correctly.
        for (const w of allWorlds) {
            if (w.orbitId != null) w.au = _mgtOrbitToAU(w.orbitId);
        }

        return {
            hexId,
            stars,
            worlds:            allWorlds,
            mainworld,
            age:               0,
            hzco:              mainworld ? mainworld.orbitId : 3,
            gasGiants:         gasGiants || 0,
            planetoidBelts:    planetoidBelts || 0,
            terrestrialPlanets: allWorlds.filter(w => w.type === 'Terrestrial Planet').length,
            totalWorlds:       allWorlds.length,
            forbiddenZones:    [],
        };
    }

    // =========================================================================
    // MAIN ENTRY POINT
    // =========================================================================

    function importSystem(jsonObj, hexId, edition) {
        // PHASE 0: Validate
        validate(jsonObj, hexId, edition);

        const mw            = jsonObj.mainWorld;
        const economicExt   = mw.economicExt  || {};
        const culturalExt   = mw.culturalExt  || {};
        const nobleCodes    = mw.noblesExt     || '';
        const gasGiants     = mw.gas_giants    || 0;
        const belts         = mw.belts         || 0;
        const worldCount    = mw.worlds        || 0;
        const popMulti      = mw.popMulti      || 0;

        // PHASE 1: Parse stars
        const parsedStars = parseStars(jsonObj.stars);
        if (parsedStars.length === 0) throw new Error('TW Import: no stars found in jsonObj.stars');

        // PHASES 2+5: Walk orbits, collect worlds
        // Side effect: populates parsedStars[i].orbitId for S-type companions
        const { allWorlds, mainworldOrbitId, mainworldStarIdx } =
            collectWorlds(jsonObj.orbitSets, parsedStars);

        const mainworld = allWorlds.find(w => w.isMainWorld);
        if (!mainworld) throw new Error(`TW Import: no mainWorld found in orbitSets for hex ${hexId}`);

        // Attach hex identity and inventory fields to the mainworld
        mainworld.hexId          = hexId;
        mainworld.name           = mw.name || jsonObj.name || '';
        mainworld.allegiance     = mw.allegiance || '';
        mainworld.popDigit       = popMulti > 0 ? popMulti : undefined;
        mainworld.popMulti       = popMulti > 0 ? popMulti : undefined;
        mainworld.gasGiant       = gasGiants > 0;
        mainworld.gasGiantsCount = gasGiants;
        mainworld.planetoidBelts = belts;
        mainworld._importedWorldCount = worldCount;

        // PHASE 6: Socioeconomics
        let t5Socio = null;

        if (edition === 'T5') {
            t5Socio = buildT5Socio(mainworld, economicExt, culturalExt, nobleCodes);
        } else {
            applyMgT2ESocio(mainworld, economicExt, culturalExt, nobleCodes);
        }

        // Clean up temp field
        delete mainworld._importedWorldCount;

        // PHASE 7: Build system
        let t5System  = null;
        let mgtSystem = null;

        if (edition === 'T5') {
            t5System = buildT5System(hexId, parsedStars, allWorlds);
        } else {
            mgtSystem = buildMgT2ESystem(hexId, parsedStars, allWorlds, gasGiants, belts);
        }

        // PHASE 7.5: Assign orbital names — preserve any names already in the JSON;
        // bodies with blank names receive edition-standard systematic names.
        if (edition === 'T5') {
            if (typeof applyT5OrbitalNames === 'function') applyT5OrbitalNames(t5System);
        } else {
            if (typeof applyMgT2EOrbitalNames === 'function') applyMgT2EOrbitalNames(mgtSystem);
        }

        // PHASE 8: Write to hexStates
        const stateObj = (typeof hexStates !== 'undefined' && hexStates.get(hexId))
            || { hexId };

        if (edition === 'T5') {
            stateObj.t5System   = t5System;
            stateObj.t5Data     = t5System.mainworld;
            stateObj.t5Socio    = t5Socio;
            stateObj.name       = t5System.mainworld.name;
            stateObj.mgtSystem  = null;
            stateObj.mgt2eData  = null;
            stateObj.mgtSocio   = null;
        } else {
            stateObj.mgtSystem  = mgtSystem;
            stateObj.mgt2eData  = mgtSystem.mainworld;
            stateObj.mgtSocio   = mgtSystem.mainworld;
            stateObj.name       = mgtSystem.mainworld.name;
            stateObj.t5System   = null;
            stateObj.t5Data     = null;
            stateObj.t5Socio    = null;
        }

        stateObj.type       = 'SYSTEM_PRESENT';
        stateObj.allegiance = mainworld.allegiance;

        if (typeof computeSystemCounts === 'function') computeSystemCounts(stateObj);
        if (typeof hexStates !== 'undefined')          hexStates.set(hexId, stateObj);
        if (typeof redrawCanvas === 'function')        redrawCanvas();

        return true;
    }

    // Public API
    if (typeof window !== 'undefined') {
        window.TravellerWorldsImporter = { importSystem };
    }

    return { importSystem };
}));
