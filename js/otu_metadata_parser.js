/**
 * PROJECT AS ABOVE, SO BELOW
 * Module: OTU Metadata Parser
 * Description: Parses travellermap sector metadata XML and registers
 *   <Route> elements as Xboat routes in window.sectorRoutes.
 *
 * Sean Protocol: Zero RPG logic here. Pure XML → hexId mapping.
 * Depends on: routes.js (addRoute), core.js (sectorSlotToNumber)
 */

(function () {
    'use strict';

    // Derive the subsector letter from a 4-digit travellermap hex code.
    // Mirrors the identical logic in importT5Tab (io_manager.js).
    function hexCodeToSubChar(hexCode) {
        const hexVal = parseInt(hexCode, 10);
        const lQ     = Math.floor(hexVal / 100);
        const lR     = hexVal % 100;
        const subX   = Math.floor((lQ - 1) / 8);
        const subY   = Math.floor((lR - 1) / 10);
        return String.fromCharCode(65 + (subY * 4 + subX));
    }

    function hexCodeToHexId(slotNum, hexCode) {
        return `${slotNum}-${hexCodeToSubChar(hexCode)}-${hexCode}`;
    }

    /**
     * Parse metadata XML for one sector and add its <Route> elements to
     * window.sectorRoutes as Xboat-type routes.
     *
     * Cross-sector routes carry EndOffsetX / EndOffsetY attributes that shift
     * the end hex into an adjacent sector grid position.  coordLookup resolves
     * those offsets to a slot number; routes whose target sector is absent from
     * the lookup are skipped with a console warning.
     *
     * The renderer (drawRouteSegment) already handles routes whose endpoint
     * hexes are not yet populated — it silently skips them — so routes to
     * unloaded but known sectors are safe to store.
     *
     * @param {string} sectorName  - Human-readable name, used only for logs.
     * @param {string} xmlText     - Raw metadata XML from travellermap.
     * @param {number} slotNum     - Numeric slot assigned to this sector.
     * @param {number} sectorX     - Grid X position of this sector.
     * @param {number} sectorY     - Grid Y position of this sector.
     * @param {Map}    coordLookup - Map<"x,y" → slotNum> for all known sectors.
     */
    function parseAndAddOtuRoutes(sectorName, xmlText, slotNum, sectorX, sectorY, coordLookup) {
        if (!xmlText) return;

        let doc;
        try {
            doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        } catch (e) {
            console.warn(`[OTU Metadata] XML parse failed for "${sectorName}": ${e.message}`);
            return;
        }

        if (doc.querySelector('parsererror')) {
            console.warn(`[OTU Metadata] Malformed XML for "${sectorName}" — routes skipped.`);
            return;
        }

        const routeEls = doc.querySelectorAll('Route');
        let added = 0, skipped = 0;

        routeEls.forEach(el => {
            const startCode = el.getAttribute('Start');
            const endCode   = el.getAttribute('End');
            if (!startCode || !endCode) return;

            const startId = hexCodeToHexId(slotNum, startCode);

            const offsetX = parseInt(el.getAttribute('EndOffsetX') || '0', 10);
            const offsetY = parseInt(el.getAttribute('EndOffsetY') || '0', 10);

            let endSlotNum = slotNum;
            if (offsetX !== 0 || offsetY !== 0) {
                const targetKey  = `${sectorX + offsetX},${sectorY + offsetY}`;
                const targetSlot = coordLookup.get(targetKey);
                if (targetSlot === undefined) {
                    console.warn(`[OTU Metadata] "${sectorName}": cross-sector route to (${targetKey}) skipped — sector not in lookup.`);
                    skipped++;
                    return;
                }
                endSlotNum = targetSlot;
            }

            const endId = hexCodeToHexId(endSlotNum, endCode);
            if (typeof addRoute === 'function') {
                addRoute(startId, endId, 'Xboat');
                added++;
            }
        });

        if (added > 0 || skipped > 0) {
            console.log(`[OTU Metadata] "${sectorName}": ${added} route(s) added, ${skipped} cross-sector skipped.`);
        }
    }

    window.parseAndAddOtuRoutes = parseAndAddOtuRoutes;
}());
