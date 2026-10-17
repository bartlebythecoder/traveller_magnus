// =============================================================================
// GIF_ENCODER.JS  —  Animated GIF89a writer
// Exposes window.GifEncoder { buildPalette, create }
//
// Hand-written for the same reason export_core.js writes its own crc32/zip:
// the app is one HTML file opened from disk, with no build step and no
// libraries. gif.js in particular cannot be used — it encodes in Web Workers,
// and browsers refuse to load worker scripts from file://.
//
// Shape of the output, chosen for the orrery (system_viewer.js):
//   - ONE global palette for the whole animation, built up front from sample
//     frames. Per-frame palettes make flat colours flicker as the palette
//     shifts underneath them.
//   - No dithering. Dither noise differs frame to frame, so a still background
//     would shimmer and every frame would differ everywhere, defeating the
//     frame diffing below.
//   - Frame diffing. Each frame after the first stores only the bounding box
//     of pixels that changed, with unchanged pixels inside the box written as
//     a reserved transparent index over a "do not dispose" previous frame. An
//     orrery is mostly a still background with small moving bodies, so this
//     is what keeps the files small.
// =============================================================================

'use strict';

const GifEncoder = (() => {

    // Palette index 255 is never a colour: it marks "unchanged since the
    // previous frame". So the palette proper holds at most 255 colours.
    const TRANSPARENT = 255;
    const MAX_COLORS  = 255;

    // Colours are bucketed to 5 bits per channel (32768 buckets) for both the
    // histogram and the colour lookup cache.
    function _key(r, g, b) { return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3); }
    function _chan(k, c)   { return c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31; }
    // 5-bit back to 8-bit such that 0 -> 0 and 31 -> 255, so pure black and
    // pure white (the two orrery backgrounds) survive exactly.
    function _expand(v)    { return (v << 3) | (v >> 2); }

    // ── Palette ───────────────────────────────────────────────────────────────
    // Median cut over the 5-bit histogram of every pixel in `samples` (an array
    // of RGBA byte arrays, e.g. ImageData.data). Returns
    // { palette: Uint8Array(768), size } with `size` <= 255 colours.
    //
    // The box to split next is the one with the largest channel range weighted
    // by sqrt(pixel count). Pure range would spend colours on a handful of
    // stray anti-aliasing pixels; pure count would spend them all on the
    // background. The sqrt sits between the two so small but distinct colours
    // (labels, the mainworld highlight) still get entries of their own.
    function buildPalette(samples) {
        const hist = new Uint32Array(32768);
        samples.forEach(px => {
            for (let i = 0; i < px.length; i += 4) hist[_key(px[i], px[i + 1], px[i + 2])]++;
        });

        const keys = [];
        for (let k = 0; k < 32768; k++) if (hist[k]) keys.push(k);

        function makeBox(lo, hi) {
            const min = [31, 31, 31], max = [0, 0, 0];
            let count = 0;
            for (let i = lo; i < hi; i++) {
                const k = keys[i];
                for (let c = 0; c < 3; c++) {
                    const v = _chan(k, c);
                    if (v < min[c]) min[c] = v;
                    if (v > max[c]) max[c] = v;
                }
                count += hist[k];
            }
            const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
            const axis   = ranges.indexOf(Math.max(...ranges));
            return { lo, hi, count, axis, score: (hi - lo > 1) ? ranges[axis] * Math.sqrt(count) : -1 };
        }

        const boxes = keys.length ? [makeBox(0, keys.length)] : [];
        while (boxes.length < MAX_COLORS) {
            let bi = -1;
            for (let i = 0; i < boxes.length; i++)
                if (boxes[i].score > 0 && (bi < 0 || boxes[i].score > boxes[bi].score)) bi = i;
            if (bi < 0) break;   // every box is a single bucket — nothing left to split

            const b = boxes[bi];
            const sub = keys.slice(b.lo, b.hi).sort((p, q) => _chan(p, b.axis) - _chan(q, b.axis));
            for (let i = 0; i < sub.length; i++) keys[b.lo + i] = sub[i];

            // Weighted median, kept strictly inside the box so both halves are non-empty.
            let acc = 0, m = b.lo + 1;
            for (let i = b.lo; i < b.hi; i++) {
                acc += hist[keys[i]];
                if (acc * 2 >= b.count) { m = i + 1; break; }
            }
            m = Math.min(Math.max(m, b.lo + 1), b.hi - 1);
            boxes.splice(bi, 1, makeBox(b.lo, m), makeBox(m, b.hi));
        }

        const palette = new Uint8Array(768);
        boxes.forEach((b, i) => {
            let r = 0, g = 0, bl = 0;
            for (let j = b.lo; j < b.hi; j++) {
                const k = keys[j], n = hist[k];
                r  += _expand(_chan(k, 0)) * n;
                g  += _expand(_chan(k, 1)) * n;
                bl += _expand(_chan(k, 2)) * n;
            }
            palette[i * 3]     = Math.round(r  / b.count);
            palette[i * 3 + 1] = Math.round(g  / b.count);
            palette[i * 3 + 2] = Math.round(bl / b.count);
        });
        return { palette, size: Math.max(1, boxes.length) };
    }

    // ── Byte output ───────────────────────────────────────────────────────────

    function _sink() {
        const chunks = [];
        let buf = new Uint8Array(65536), len = 0;
        function byte(b) {
            if (len === buf.length) { chunks.push(buf); buf = new Uint8Array(65536); len = 0; }
            buf[len++] = b;
        }
        return {
            byte,
            u16(v)     { byte(v & 0xff); byte((v >> 8) & 0xff); },
            bytes(arr) { for (let i = 0; i < arr.length; i++) byte(arr[i]); },
            ascii(s)   { for (let i = 0; i < s.length; i++) byte(s.charCodeAt(i)); },
            result() {
                const total = chunks.reduce((n, c) => n + c.length, 0) + len;
                const out = new Uint8Array(total);
                let off = 0;
                chunks.forEach(c => { out.set(c, off); off += c.length; });
                out.set(buf.subarray(0, len), off);
                return out;
            },
        };
    }

    // ── LZW ───────────────────────────────────────────────────────────────────
    // GIF's variable-width LZW, written as packed codes in 255-byte sub-blocks.
    // Follows the classic open-addressed hash design (hash size 5003) used by
    // GIFENCOD/jsgif, including exactly when the code width grows: the check
    // runs after each emitted code and BEFORE that code's new table entry is
    // added, which is what keeps the encoder in step with a decoder that adds
    // its entries one code late. Clears and restarts when the table is full.
    function _lzw(sink, pixels, minCodeSize) {
        sink.byte(minCodeSize);

        const clearCode = 1 << minCodeSize;
        const eoiCode   = clearCode + 1;
        const HSIZE     = 5003;
        const htab      = new Int32Array(HSIZE).fill(-1);
        const codetab   = new Int32Array(HSIZE);

        let nBits     = minCodeSize + 1;
        let maxCode   = (1 << nBits) - 1;
        let freeEnt   = clearCode + 2;
        let clearFlag = false;

        let accum = 0, accBits = 0;
        const block = new Uint8Array(255);
        let blockLen = 0;

        function flushBlock() {
            if (!blockLen) return;
            sink.byte(blockLen);
            for (let i = 0; i < blockLen; i++) sink.byte(block[i]);
            blockLen = 0;
        }
        function put(b) {
            block[blockLen++] = b;
            if (blockLen === 255) flushBlock();
        }
        function output(code) {
            accum |= code << accBits;
            accBits += nBits;
            while (accBits >= 8) { put(accum & 0xff); accum >>>= 8; accBits -= 8; }
            if (clearFlag) {
                nBits = minCodeSize + 1; maxCode = (1 << nBits) - 1; clearFlag = false;
            } else if (freeEnt > maxCode) {
                nBits++; maxCode = (nBits === 12) ? 4096 : (1 << nBits) - 1;
            }
        }

        output(clearCode);
        let ent = pixels[0];
        outer: for (let i = 1; i < pixels.length; i++) {
            const c     = pixels[i];
            const fcode = (c << 12) + ent;
            let h       = (c << 4) ^ ent;
            if (htab[h] === fcode) { ent = codetab[h]; continue; }
            if (htab[h] >= 0) {
                const disp = (h === 0) ? 1 : HSIZE - h;
                do {
                    h -= disp;
                    if (h < 0) h += HSIZE;
                    if (htab[h] === fcode) { ent = codetab[h]; continue outer; }
                } while (htab[h] >= 0);
            }
            output(ent);
            ent = c;
            if (freeEnt < 4096) {
                codetab[h] = freeEnt++;
                htab[h]    = fcode;
            } else {
                htab.fill(-1);
                freeEnt   = clearCode + 2;
                clearFlag = true;
                output(clearCode);
            }
        }
        output(ent);
        output(eoiCode);
        while (accBits > 0) { put(accum & 0xff); accum >>>= 8; accBits -= 8; }
        flushBlock();
        sink.byte(0);   // block terminator
    }

    // ── Encoder ───────────────────────────────────────────────────────────────
    // create(width, height, pal, { loop }) -> { addFrame(rgba, delayCs), finish() }
    //   pal   — the object buildPalette returned.
    //   loop  — 0 (default) loops forever.
    //   rgba  — width*height*4 RGBA bytes (ImageData.data). Alpha is ignored:
    //           callers paint an opaque background first.
    //   delayCs — this frame's delay in hundredths of a second. Browsers treat
    //           anything under 2 as 10, so callers should stay at 2 or more.
    // finish() returns the complete file as a Uint8Array.
    function create(width, height, pal, opts) {
        opts = opts || {};
        const n    = width * height;
        const sink = _sink();

        const palette = pal.palette;
        const size    = Math.min(pal.size, MAX_COLORS);
        const cache   = new Int16Array(32768).fill(-1);
        function nearest(k) {
            const r = _expand(_chan(k, 0)), g = _expand(_chan(k, 1)), b = _expand(_chan(k, 2));
            let best = 0, bestD = Infinity;
            for (let i = 0; i < size; i++) {
                const dr = palette[i * 3] - r, dg = palette[i * 3 + 1] - g, db = palette[i * 3 + 2] - b;
                const d  = dr * dr + dg * dg + db * db;
                if (d < bestD) { bestD = d; best = i; if (d === 0) break; }
            }
            cache[k] = best;
            return best;
        }

        // Header, logical screen (global colour table of 256 entries), palette.
        sink.ascii('GIF89a');
        sink.u16(width);
        sink.u16(height);
        sink.byte(0xF7);   // global table present, 8-bit colour resolution, 2^(7+1) entries
        sink.byte(0);      // background colour index
        sink.byte(0);      // pixel aspect ratio: unspecified
        for (let i = 0; i < 768; i++) sink.byte(i < size * 3 ? palette[i] : 0);

        // NETSCAPE2.0 looping extension.
        sink.bytes([0x21, 0xFF, 0x0B]);
        sink.ascii('NETSCAPE2.0');
        sink.bytes([0x03, 0x01]);
        sink.u16(opts.loop || 0);
        sink.byte(0);

        let prev = null;
        let cur  = new Uint8Array(n);

        function writeFrame(x, y, w, h, pixels, delayCs, transparent) {
            // Graphic Control Extension: disposal 1 (leave in place) so the
            // transparent "unchanged" pixels show the previous frame through.
            sink.bytes([0x21, 0xF9, 0x04, (1 << 2) | (transparent ? 1 : 0)]);
            sink.u16(Math.max(0, Math.round(delayCs)));
            sink.byte(transparent ? TRANSPARENT : 0);
            sink.byte(0);
            // Image descriptor: no local colour table, not interlaced.
            sink.byte(0x2C);
            sink.u16(x); sink.u16(y); sink.u16(w); sink.u16(h);
            sink.byte(0);
            _lzw(sink, pixels, 8);
        }

        function addFrame(rgba, delayCs) {
            for (let p = 0, i = 0; p < n; p++, i += 4) {
                const k = _key(rgba[i], rgba[i + 1], rgba[i + 2]);
                const v = cache[k];
                cur[p] = v >= 0 ? v : nearest(k);
            }

            if (!prev) {
                writeFrame(0, 0, width, height, cur, delayCs, false);
            } else {
                let x0 = width, y0 = height, x1 = -1, y1 = -1;
                for (let y = 0, p = 0; y < height; y++) {
                    for (let x = 0; x < width; x++, p++) {
                        if (cur[p] !== prev[p]) {
                            if (x < x0) x0 = x;
                            if (x > x1) x1 = x;
                            if (y < y0) y0 = y;
                            if (y > y1) y1 = y;
                        }
                    }
                }
                if (x1 < 0) {
                    // Nothing moved: a single transparent pixel still carries the delay.
                    writeFrame(0, 0, 1, 1, new Uint8Array([TRANSPARENT]), delayCs, true);
                } else {
                    const w = x1 - x0 + 1, h = y1 - y0 + 1;
                    const sub = new Uint8Array(w * h);
                    for (let y = 0, q = 0; y < h; y++) {
                        let p = (y0 + y) * width + x0;
                        for (let x = 0; x < w; x++, p++, q++)
                            sub[q] = (cur[p] === prev[p]) ? TRANSPARENT : cur[p];
                    }
                    writeFrame(x0, y0, w, h, sub, delayCs, true);
                }
            }

            const t = prev || new Uint8Array(n);
            prev = cur;
            cur  = t;
        }

        function finish() {
            sink.byte(0x3B);   // trailer
            return sink.result();
        }

        return { addFrame, finish };
    }

    return { buildPalette, create };

})();

window.GifEncoder = GifEncoder;
