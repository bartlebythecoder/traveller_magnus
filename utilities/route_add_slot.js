/**
 * route_add_slot.js — verification for "+ Add Route" (v0.17.5).
 *
 * Routes could always be deleted and never created. The only thing that ever
 * made one was ensureFreeRouteSlot(), a top-up that fired solely when EVERY slot
 * was in use — so a list cut down to three, one of them empty, was stuck there
 * permanently: the top-up saw a free slot, decided nothing was needed, and there
 * was no control anywhere to press.
 *
 * v0.17.5 added window.addRouteSlot() behind a button, and removed the top-up
 * from the render path (where it was actively undoing deletions) while leaving
 * it on the import paths, where a user has NOT just asked for a slot to go away.
 *
 * This drives the real Route Manager rather than calling the allocators, because
 * the allocation rules — first unused colour, lowest free key, an id no orphaned
 * segment still holds — are only observable in what lands in the row.
 *
 *   node utilities/route_add_slot.js
 */
const { launchApp, buildMap } = require('./route_test_common');

const CFG = { gridW: 7, gridH: 5, cols: 14, rows: 16, density: 0.95, seed: 21 };
const results = [];

function check(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

const HELPERS = `
    window.__A = {
        defs() {
            return (window.routeDefinitions || []).map(d => ({
                id: d.id, name: d.name, color: (d.color || '').toLowerCase(),
                shortcut: d.shortcut || null
            }));
        },
        // A deliberately gappy list: three slots wearing the 1st, 3rd and 4th
        // default colours and the keys 1, 3 and 4. The first unused colour is
        // therefore the 2nd default and the lowest free key is 2 — neither of
        // which is "the first one in the list", so an allocator that just took
        // the head of the palette would fail rather than pass by luck.
        trim() {
            const d = getDefaultRouteDefinitions();
            window.routeDefinitions = [0, 2, 3].map((srcIdx, i) => ({
                id: i + 1,
                name: 'Route ' + (i + 1),
                color: d[srcIdx].color,
                shortcut: ['1', '3', '4'][i],
                visible: true,
                automationRef: null
            }));
            window.sectorRoutes = [];
            window.renderRouteWindow();
        },
        defaults() {
            return getDefaultRouteDefinitions().map(x => (x.color || '').toLowerCase());
        },
        open() {
            if (!document.getElementById('route-window').classList.contains('visible')) {
                window.toggleRouteWindow();
            }
        },
        rowIds() {
            return Array.from(document.querySelectorAll('#route-window-list .route-row'))
                .map(r => parseInt(r.dataset.routeId, 10));
        },
        focusedRow() {
            const el = document.activeElement;
            if (!el || !el.classList.contains('route-name-input')) return null;
            const row = el.closest('.route-row');
            return { id: row ? parseInt(row.dataset.routeId, 10) : null,
                     selected: el.selectionStart === 0 && el.selectionEnd === el.value.length };
        },
        clickDelete(routeId) {
            const row = document.querySelector(
                '#route-window-list .route-row[data-route-id="' + routeId + '"]');
            if (!row) return false;
            row.querySelector('.route-delete-btn').click();
            return true;
        }
    };
`;

(async () => {
    const { browser, page } = await launchApp({ headless: true });
    // Delete asks for confirmation, and promises Ctrl+Z will bring it back.
    page.on('dialog', d => d.accept());
    await buildMap(page, CFG);
    await page.evaluate(HELPERS);
    await page.evaluate(() => { window.showToast = m => { window.__lastToast = m; }; });

    // ── The fixture the whole file rests on ─────────────────────────────────
    let r = await page.evaluate(() => {
        window.__A.open();
        window.__A.trim();
        return { defs: window.__A.defs(), defaults: window.__A.defaults() };
    });
    check('fixture: three slots, wearing defaults 1, 3 and 4 and keys 1, 3, 4',
        r.defs.length === 3 && r.defs.map(d => d.shortcut).join('') === '134' &&
        r.defs[1].color === r.defaults[2],
        r.defs.map(d => d.id + ':' + d.color + '/' + d.shortcut).join(' '));
    const DEFAULTS = r.defaults;

    // ── Adding one ──────────────────────────────────────────────────────────
    r = await page.evaluate(() => {
        const before = window.__A.defs();
        window.addRouteSlot();
        const after = window.__A.defs();
        return { before, after, added: after[after.length - 1],
                 focused: window.__A.focusedRow(), rows: window.__A.rowIds(),
                 toast: window.__lastToast };
    });
    check('a slot can be added when an EMPTY one already exists',
        r.after.length === r.before.length + 1,
        r.before.length + ' -> ' + r.after.length + ' slots');
    check('it takes the first default colour NOT already on the map',
        r.added.color === DEFAULTS[1],
        r.added.color + ' (expected ' + DEFAULTS[1] + ', the 2nd default; 1st is in use)');
    check('it takes the lowest free 1-9 shortcut, not the next one up',
        r.added.shortcut === '2',
        'got ' + r.added.shortcut + ' with 1, 3 and 4 taken');
    check('the row is rendered, and the cursor is put in its name ready to type',
        r.rows.indexOf(r.added.id) !== -1 && r.focused &&
        r.focused.id === r.added.id && r.focused.selected === true,
        JSON.stringify(r.focused));
    check('the toast says Ctrl+Z will remove it',
        /Ctrl\+Z/.test(r.toast || ''), r.toast);

    // ── Ctrl+Z removes it again, exactly as it does a deletion ──────────────
    const undoBefore = await page.evaluate(() => {
        window.__A.trim();
        window.undoStack = []; window.redoStack = [];
        const before = window.__A.defs();
        window.addRouteSlot();
        // addRouteSlot focuses the new name input; the undo handler ignores keys
        // typed into a field, so a real user would click away first.
        document.activeElement && document.activeElement.blur();
        return { before, after: window.__A.defs() };
    });
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const undone = await page.evaluate(() => window.__A.defs());
    check('Ctrl+Z removes an added slot',
        undone.length === undoBefore.before.length &&
        JSON.stringify(undone.map(d => d.id)) === JSON.stringify(undoBefore.before.map(d => d.id)),
        undoBefore.before.length + ' -> ' + undoBefore.after.length + ' -> ' + undone.length);

    // ── The top-up no longer fights Delete ──────────────────────────────────
    // Deleting the last spare used to remove the row and re-create it in the
    // same breath — same id, colour and key, so it looked like the deletion had
    // simply not happened, under a toast saying it had.
    r = await page.evaluate(() => {
        window.__A.trim();
        // One slot with segments, two empty: slot 3 is the last spare but one.
        window.sectorRoutes = [{ startId: '1-A-0101', endId: '1-A-0102', type: 'Trade',
                                 routeId: 1, groupId: 'p2p_1' }];
        window.renderRouteWindow();
        window.__A.clickDelete(2);
        window.__A.clickDelete(3);          // now NO empty slot is left at all
        const afterDeletes = window.__A.defs();
        window.renderRouteWindow();         // the old top-up fired from here
        return { afterDeletes, afterRender: window.__A.defs() };
    });
    check('deleting every spare leaves them deleted; rendering does not top up',
        r.afterDeletes.length === 1 && r.afterRender.length === 1,
        'after deletes ' + r.afterDeletes.length + ', after render ' + r.afterRender.length);

    r = await page.evaluate(() => {
        const before = window.__A.defs().length;
        const made = window.ensureFreeRouteSlot();
        return { before, after: window.__A.defs().length, made: !!made };
    });
    check('CONTROL: the top-up still works when an IMPORT calls it',
        r.made === true && r.after === r.before + 1,
        r.before + ' -> ' + r.after + ' — it was removed from render, not deleted');

    // ── An id that orphaned segments still hold is not reused ───────────────
    // Deleting a route drops its own segments, but a route file loaded into a
    // slot that was later removed can leave some behind. A new slot arriving on
    // that number would silently come with those connections already drawn.
    r = await page.evaluate(() => {
        window.__A.trim();                                   // ids 1, 2, 3
        window.sectorRoutes = [{ startId: '1-A-0101', endId: '1-A-0102', type: 'Trade',
                                 routeId: 12, groupId: 'p2p_12' }];   // orphan
        window.addRouteSlot();
        const defs = window.__A.defs();
        const added = defs[defs.length - 1];
        const inherited = (window.sectorRoutes || []).filter(s => s.routeId === added.id).length;
        return { id: added.id, inherited };
    });
    check('a new slot skips an id that orphaned segments still use',
        r.id === 13 && r.inherited === 0,
        'got id ' + r.id + ' (expected 13, past the orphan on 12) with ' +
        r.inherited + ' inherited segment(s)');

    // ── NEGATIVE CONTROL ────────────────────────────────────────────────────
    // Every colour/key assertion above would pass vacuously if a fresh slot were
    // simply always green with no key — which is exactly what the old automatic
    // top-up produced, and what this release set out to stop.
    r = await page.evaluate(() => {
        window.__A.trim();
        window.addRouteSlot();
        window.addRouteSlot();
        const d = window.__A.defs();
        const a = d[d.length - 2], b = d[d.length - 1];
        return { colours: [a.color, b.color], keys: [a.shortcut, b.shortcut] };
    });
    check('NEGATIVE CONTROL: two added slots differ from each other',
        r.colours[0] !== r.colours[1] && r.keys[0] !== r.keys[1] &&
        r.keys[0] !== null && r.keys[1] !== null,
        'colours ' + r.colours.join(', ') + ' — keys ' + r.keys.join(', '));

    console.log('\npage errors: ' + (page._errors.length ? JSON.stringify(page._errors) : 'none'));
    const failed = results.filter(x => !x.pass);
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed.');
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})();
