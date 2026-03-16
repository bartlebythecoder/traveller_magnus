// =====================================================================
// CLASSIC TRAVELLER: RULE EXPORTER
// =====================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CT_CONSTANTS;
} else {
    Object.assign(window, CT_CONSTANTS);
}