/**
 * js/t5_socio_engine.js
 * 
 * T5 SOCIOECONOMIC ENGINE (v2.0 Modular Architecture)
 * Handles socioeconomic extensions (Ix, Ex, Cx) for Traveller 5.
 * 
 * Part of the Traveller Magnus v2.0 refactor.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./universal_math'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./universal_math'));
    } else {
        root.T5_Socio_Engine = factory(root.UniversalMath);
    }
}(this, function (UniversalMath) {
    const { toUWPChar, rollFlux } = UniversalMath;

    // Safe Fallback Utilities
    const _rng = (typeof rng === 'function') ? rng : Math.random;
    const _roll1D = (typeof tRoll1D === 'function') ? tRoll1D : (label) => Math.floor(_rng() * 6) + 1;
    const _roll2D = (typeof tRoll2D === 'function') ? tRoll2D : (label) => Math.floor(_rng() * 6) + 1 + Math.floor(_rng() * 6) + 1;
    const _log = (typeof writeLogLine === 'function') ? writeLogLine : console.log;
    const _tSection = (typeof tSection === 'function') ? tSection : () => {};
    const _tResult = (typeof tResult === 'function') ? tResult : () => {};
    const _tDM = (typeof tDM === 'function') ? tDM : () => {};

    /**
     * T5 SOCIOECONOMICS GENERATOR
     * Generates Importance {Ix}, Economic (Ex), and Cultural [Cx] profiles.
     */
    function generateT5Socioeconomics(base, hexId) {
        if (!base) return null;
        if (typeof reseedForHex === 'function' && hexId) reseedForHex(hexId);

        _tSection('T5 Socioeconomics Expansion');

        // 1. Importance (Ix)
        _tSection('Importance {Ix}');
        let Ix = 0;
        if (['A', 'B'].includes(base.starport)) { Ix += 1; _tDM('Port A/B', 1); }
        if (['D', 'E', 'X'].includes(base.starport)) { Ix -= 1; _tDM('Port D/E/X', -1); }

        if (base.tl >= 16) { Ix += 1; _tDM('TL 16+', 1); }
        if (base.tl >= 10) { Ix += 1; _tDM('TL 10+', 1); }
        if (base.tl <= 8) { Ix -= 1; _tDM('TL 8-', -1); }

        if (base.tradeCodes) {
            if (base.tradeCodes.includes("Ag")) { Ix += 1; _tDM('Agricultural', 1); }
            if (base.tradeCodes.includes("Hi")) { Ix += 1; _tDM('High Pop', 1); }
            if (base.tradeCodes.includes("In")) { Ix += 1; _tDM('Industrial', 1); }
            if (base.tradeCodes.includes("Ri")) { Ix += 1; _tDM('Rich', 1); }
        }

        if (base.pop <= 6) { Ix -= 1; _tDM('Low Pop (6-)', -1); }
        if (base.navalBase && base.scoutBase) { Ix += 1; _tDM('Naval & Scout', 1); }
        if (base.wayStation) { Ix += 1; _tDM('Way Station', 1); }

        _tResult('Final Importance', `{${Ix >= 0 ? '+' : ''}${Ix}}`);

        // 2. Economic (Ex)
        _tSection('Economic (Ex)');
        let rawR = _roll2D('Resources Roll');
        _log(`Resources Roll: ${rawR}`);
        let R = rawR;
        if (base.tl >= 8) {
            let rMod = (base.gasGiantsCount || 0) + (base.planetoidBelts || 0);
            R += rMod;
            _tDM('Gas Giants + Belts (TL 8+)', rMod);
        }
        R = Math.max(0, R);
        _tResult('Resources (R)', toUWPChar(R));

        let L = Math.max(0, (base.pop || 0) - 1);
        _tResult('Labor (L)', toUWPChar(L));

        let I = 0;
        if ((base.pop || 0) > 0) {
            if (base.pop <= 3) {
                I = Ix;
                _tResult('Infrastructure (Low Pop)', I);
            } else if (base.pop <= 6) {
                let iRoll = _roll1D('Infra Roll (1D)');
                _log(`Infra Roll (1D): ${iRoll}`);
                I = iRoll + Ix;
            } else {
                let iRoll = _roll2D('Infra Roll (2D)');
                _log(`Infra Roll (2D): ${iRoll}`);
                I = iRoll + Ix;
            }
        }
        I = Math.max(0, I);
        _tResult('Infrastructure (I)', toUWPChar(I));

        let E = rollFlux();
        if (E === 0) {
            E = 1;
            _log(`Efficiency Roll: Flux (0) Forced to 1`);
        } else {
            _log(`Efficiency Roll: Flux (${E >= 0 ? '+' : ''}${E})`);
        }
        _tResult('Efficiency (E)', E >= 0 ? `+${E}` : E);

        // 3. Resource Units (RU)
        _tSection('Resource Units (RU)');
        let calcR = R === 0 ? 1 : R;
        let calcL = L === 0 ? 1 : L;
        let calcI = I === 0 ? 1 : I;
        let calcE = E;
        let RU = calcR * calcL * calcI * calcE;
        _log(`Calculation: (R:${calcR} * L:${calcL} * I:${calcI} * E:${calcE})`);
        _tResult('RU', RU);

        // 4. Cultural (Cx)
        _tSection('Cultural [Cx]');
        let H = 0, A = 0, S = 0, Sym = 0;
        if ((base.pop || 0) > 0) {
            let hFlux = rollFlux();
            H = Math.max(1, base.pop + hFlux);
            _log(`Homogeneity Roll: Pop(${base.pop}) + Flux(${hFlux >= 0 ? '+' : ''}${hFlux}) = ${H}`);

            A = Math.max(1, base.pop + Ix);
            _log(`Acceptance Roll: Pop(${base.pop}) + Ix(${Ix}) = ${A}`);

            let sFlux = rollFlux();
            S = Math.max(1, sFlux + 5);
            _log(`Strangeness Roll: Flux(${sFlux >= 0 ? '+' : ''}${sFlux}) + 5 = ${S}`);

            let symFlux = rollFlux();
            Sym = Math.max(1, symFlux + (base.tl || 0));
            _log(`Symbols Roll: Flux(${symFlux >= 0 ? '+' : ''}${symFlux}) + TL(${base.tl}) = ${Sym}`);
        }

        let ixStr = `{${Ix >= 0 ? '+' : ''}${Ix}}`;
        let exStr = `(${toUWPChar(R)}${toUWPChar(L)}${toUWPChar(I)}${E >= 0 ? '+' : ''}${E})`;
        let cxStr = `[${toUWPChar(H)}${toUWPChar(A)}${toUWPChar(S)}${toUWPChar(Sym)}]`;

        _tResult('T5 Extension Line', `${ixStr} ${exStr} ${cxStr}`);

        return {
            Ix, R, L, I, E, RU, H, A, S, Sym,
            ixString: ixStr, exString: exStr, cxString: cxStr,
            displayString: `${ixStr} ${exStr} ${cxStr} RU:${RU}`,
            popMultiplier: base.popDigit,
            belts: base.planetoidBelts,
            gasGiants: base.gasGiantsCount,
            worlds: 0,
            importance: Ix,
            resourceUnits: RU,
            ecoResources: R,
            ecoLabor: L,
            ecoInfrastructure: I,
            ecoEfficiency: E,
            culturalProfile: `${toUWPChar(H)}${toUWPChar(A)}${toUWPChar(S)}${toUWPChar(Sym)}`
        };
    }

    return {
        generateT5Socioeconomics
    };
}));
