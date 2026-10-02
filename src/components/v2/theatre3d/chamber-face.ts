import { later, readWork, valueNoise, type Work } from "@/components/v2/theatre3d/textures";
import { STELE, cssFont, type Block, type ChamberLayout, type Face, type Line } from "@/components/v2/theatre3d/chamber-layout";
import { Surface, boxBlurWork, channelWork, clamp01, fbm2, hash2, lowresWork, mix, readableCanvas, smooth, type Maps, type Sampler } from "@/components/v2/theatre3d/chamber-pixels";

// The face of the stele: weathered limestone with the room's words cut into
// it. The words are drawn on a canvas, then that mask becomes a V-cut groove
// in a height field (normal map), dark grime packed into the grooves with
// flecks of old gilt (colour map), and a little polish where hands have
// touched (roughness). The candles rake across it, so the letters catch the
// light on one wall of each groove and fall into shadow on the other.

export interface FaceBuild extends Maps {
    w: number;
    h: number;
    ppm: number;
}

const PPM = { high: 820, low: 540 };
const MAX = { high: 4096, low: 2048 };

/* ------------------------------------------------------------- drawing */

function drawWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, trackPx: number) {
    if (!trackPx) {
        ctx.fillText(word, x, y);
        return;
    }
    for (const ch of word) {
        ctx.fillText(ch, x, y);
        x += ctx.measureText(ch).width + trackPx;
    }
}

/** Lines of type, in metres, onto a canvas at `ppm`. Returns the height used (m). */
export function drawLines(
    ctx: CanvasRenderingContext2D,
    lines: Line[],
    face: Face,
    size: number,
    x0: number,
    y0: number,
    colW: number,
    align: "justify" | "center" | "left" | "right",
    lead: number,
    ppm: number,
    track = 0,
    jitter?: (i: number) => { dy: number; rot: number },
) {
    const px = size * ppm;
    ctx.font = cssFont(face, px);
    ctx.textBaseline = "alphabetic";
    let n = 0;
    lines.forEach((ln, i) => {
        const base = y0 + i * size * lead + (size * (lead - 1)) / 2 + size * 0.8;
        const natural = ln.width * size;
        let x = align === "center" ? x0 + (colW - natural) / 2 : align === "right" ? x0 + colW - natural : x0;
        let extra = 0;
        // justified, unless that would open gaps wider than a third of an em
        if (align === "justify" && !ln.last && ln.words.length > 1 && (colW - natural) / (ln.words.length - 1) < size * 0.34) extra = (colW - natural) / (ln.words.length - 1);
        for (let k = 0; k < ln.words.length; k++) {
            const j = jitter?.(n++);
            if (j) {
                ctx.save();
                ctx.translate(x * ppm, (base + j.dy) * ppm);
                ctx.rotate(j.rot);
                drawWord(ctx, ln.words[k], 0, 0, track * px);
                ctx.restore();
            } else drawWord(ctx, ln.words[k], x * ppm, base * ppm, track * px);
            x += (ln.widths[k] + ln.space) * size + extra;
        }
    });
    return lines.length * size * lead;
}

/** A rectangle with its corners cut as concave quarter circles, like an old cartouche or a ticket. */
function notchedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w, y, r, Math.PI, Math.PI / 2, true);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w, y + h, r, -Math.PI / 2, -Math.PI, true);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x, y + h, r, 0, -Math.PI / 2, true);
    ctx.lineTo(x, y + r);
    ctx.arc(x, y, r, Math.PI / 2, 0, true);
    ctx.closePath();
}

/** A crack: a jagged random walk from (x, y) heading `dir`, kept inside a box. */
function crack(ctx: CanvasRenderingContext2D, r: () => number, x: number, y: number, dir: number, steps: number, len: number, box: [number, number, number, number], width: number) {
    const pts: [number, number][] = [[x, y]];
    for (let i = 0; i < steps; i++) {
        dir += (r() - 0.5) * 0.9;
        x += Math.cos(dir) * len * (0.6 + r() * 0.8);
        y += Math.sin(dir) * len * (0.6 + r() * 0.8);
        x = Math.min(box[2], Math.max(box[0], x));
        y = Math.min(box[3], Math.max(box[1], y));
        pts.push([x, y]);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < pts.length; i++) {
        ctx.lineWidth = width * (1 - (i / pts.length) * 0.75);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
        ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
    }
    return pts;
}

/* ------------------------------------------------------------- carving */

/** Carve a room's stele face: a slice at a time, in short turns (someone's at the door waiting for it). */
export function carveFace(layout: ChamberLayout, quality: "high" | "low", seed: number): Promise<FaceBuild> {
    return later(carveWork(layout, quality, seed), true);
}

function* carveWork(layout: ChamberLayout, quality: "high" | "low", seed: number): Work<FaceBuild> {
    const { faceW, faceH, colW, blocks } = layout;
    const ppm = Math.min(PPM[quality], MAX[quality] / faceH, MAX[quality] / faceW);
    const W = Math.round(faceW * ppm);
    const H = Math.round(faceH * ppm);
    const padX = STELE.padX;

    // Red: every cut. Green: cuts that kept their gilt (the plate).
    const cut = readableCanvas(W, H);
    const cx = cut.getContext("2d")!;
    cx.fillStyle = "#000";
    cx.fillRect(0, 0, W, H);
    // The sunk panel of a cartouche.
    const panel = readableCanvas(W, H);
    const px = panel.getContext("2d")!;
    px.fillStyle = "#000";
    px.fillRect(0, 0, W, H);
    // Shadows the papers cast on the stone.
    const shade = readableCanvas(W, H);
    const sx = shade.getContext("2d")!;
    sx.fillStyle = "#000";
    sx.fillRect(0, 0, W, H);
    // Cracks.
    const cracks = readableCanvas(W, H);
    const kx = cracks.getContext("2d")!;
    kx.fillStyle = "#000";
    kx.fillRect(0, 0, W, H);

    const P = (m: number) => m * ppm;
    const BODY = "#ff0000";
    const GILT = "#ffff00";

    // A border line cut all the way round, with notched corners.
    cx.strokeStyle = BODY;
    cx.lineWidth = P(0.0034);
    notchedRect(cx, P(0.032), P(0.032), P(faceW - 0.064), P(faceH - 0.064), P(0.034));
    cx.stroke();

    for (const b of blocks) carveBlock(b);

    function carveBlock(b: Block) {
        cx.fillStyle = BODY;
        cx.strokeStyle = BODY;
        switch (b.type) {
            case "title": {
                cx.fillStyle = GILT;
                // tracking leaves a space after the last letter: don't count it when centring
                const fit = b.lines.map((l) => ({ ...l, width: l.width - b.track }));
                drawLines(cx, fit, "sc", b.size, (faceW - b.w) / 2, b.y, b.w, "center", 1.18, ppm, b.track);
                break;
            }
            case "rule": {
                const y = P(b.y + b.h / 2);
                const c = P(faceW / 2);
                const L = P(colW * 0.27);
                cx.lineWidth = P(0.0032);
                cx.lineCap = "round";
                cx.beginPath();
                cx.moveTo(c - L, y);
                cx.lineTo(c - P(0.034), y);
                cx.moveTo(c + P(0.034), y);
                cx.lineTo(c + L, y);
                cx.stroke();
                cx.fillStyle = GILT;
                cx.beginPath();
                cx.moveTo(c - P(0.022), y);
                cx.lineTo(c, y - P(0.012));
                cx.lineTo(c + P(0.022), y);
                cx.lineTo(c, y + P(0.012));
                cx.closePath();
                cx.fill();
                cx.fillStyle = BODY;
                for (const s of [-1, 1]) {
                    cx.beginPath();
                    cx.arc(c + s * (L + P(0.012)), y, P(0.0042), 0, Math.PI * 2);
                    cx.fill();
                }
                break;
            }
            case "moon": {
                const c = P(faceW / 2);
                const cy = P(b.y + b.d / 2);
                cx.lineWidth = P(0.0034);
                cx.beginPath();
                cx.arc(c, cy, P(b.d / 2 + 0.018), 0, Math.PI * 2);
                cx.stroke();
                cx.lineWidth = P(0.002);
                cx.beginPath();
                cx.arc(c, cy, P(b.d / 2 + 0.03), 0, Math.PI * 2);
                cx.stroke();
                // eight short rays between the rings and beyond
                cx.lineWidth = P(0.0026);
                for (let k = 0; k < 8; k++) {
                    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
                    const r0 = P(b.d / 2 + 0.04);
                    const r1 = P(b.d / 2 + (k % 2 ? 0.058 : 0.07));
                    cx.beginPath();
                    cx.moveTo(c + Math.cos(a) * r0, cy + Math.sin(a) * r0);
                    cx.lineTo(c + Math.cos(a) * r1, cy + Math.sin(a) * r1);
                    cx.stroke();
                }
                const lines: Line[] = [{ words: [b.label], widths: [0], width: 0, space: 0, last: true }];
                cx.font = cssFont("sc", P(b.labelSize));
                lines[0].widths[0] = lines[0].width = cx.measureText(b.label).width / P(b.labelSize);
                drawLines(cx, lines, "sc", b.labelSize, padX, b.y + b.d + 0.03 + 0.012, colW, "center", 1.1, ppm);
                break;
            }
            case "text": {
                let y = b.y;
                for (const para of b.paras) {
                    y += drawLines(cx, para, "roman", b.size, padX, y, colW, "justify", 1.36, ppm) + b.size * 0.5;
                }
                break;
            }
            case "cartouche": {
                const x = padX;
                px.fillStyle = "#fff";
                notchedRect(px, P(x), P(b.y), P(b.w), P(b.h), P(0.03));
                px.fill();
                cx.lineWidth = P(0.0028);
                notchedRect(cx, P(x + 0.016), P(b.y + 0.016), P(b.w - 0.032), P(b.h - 0.032), P(0.022));
                cx.stroke();
                cx.lineWidth = P(0.0022);
                notchedRect(cx, P(x - 0.014), P(b.y - 0.014), P(b.w + 0.028), P(b.h + 0.028), P(0.04));
                cx.stroke();
                const inner = b.w - 2 * b.padX;
                const used = drawLines(cx, b.lines, "italic", b.size, x + b.padX, b.y + b.padY, inner, "center", 1.3, ppm);
                if (b.by.length) drawLines(cx, b.by, "sc", b.bySize, x + b.padX, b.y + b.padY + used + 0.022, inner, "center", 1.25, ppm);
                break;
            }
            case "paper": {
                // a soft shadow below and to the right of the paper
                const p = b.paper;
                sx.save();
                sx.translate(P(faceW / 2 + b.x), P(b.y));
                sx.rotate(-b.tilt);
                sx.fillStyle = "#fff";
                sx.fillRect(P(-p.w / 2 + 0.004), P(0.012), P(p.w), P(p.h + 0.004));
                sx.restore();
                break;
            }
        }
    }

    // Two cracks: one from the right edge down the margin, a hairline at the bottom left.
    const r = (() => {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    })();
    kx.strokeStyle = "#fff";
    const right: [number, number, number, number] = [P(faceW - padX + 0.012), 0, W, H];
    const main = crack(kx, r, W, P(0.16 + r() * 0.2), Math.PI * 0.62, 18, P(0.03), right, P(0.0034));
    crack(kx, r, main[6][0], main[6][1], Math.PI * 0.5, 9, P(0.022), right, P(0.0022));
    crack(kx, r, 0, P(faceH - 0.12 - r() * 0.1), -Math.PI * 0.3, 7, P(0.022), [0, P(faceH * 0.6), P(padX - 0.01), H], P(0.0026));

    yield;

    const raw = (yield readWork(cx, W, H)) as Uint8ClampedArray;
    const mask = new Float32Array(W * H);
    const gilded = new Float32Array(W * H);
    for (let i = 0; i < mask.length; i++) {
        mask[i] = raw[i * 4] / 255;
        gilded[i] = raw[i * 4 + 1] / 255;
    }
    // The V of the chisel: the cut's centre deeper than its edges.
    const vcut = (yield boxBlurWork(Float32Array.from(mask), W, H, Math.max(1, Math.round(P(0.0016))), 2)) as Float32Array;
    // a wider, softer spread of the cuts: the stone round each letter a touch darker, as if in its shade
    const halo = (yield boxBlurWork(Float32Array.from(mask), W, H, Math.max(2, Math.round(P(0.005))), 2)) as Float32Array;
    const sunk = (yield boxBlurWork((yield channelWork(panel)) as Float32Array, W, H, Math.max(1, Math.round(P(0.004))), 2)) as Float32Array;
    const shadow = (yield boxBlurWork((yield channelWork(shade)) as Float32Array, W, H, Math.max(2, Math.round(P(0.012))), 3)) as Float32Array;
    const crackM = (yield boxBlurWork((yield channelWork(cracks)) as Float32Array, W, H, 1, 1)) as Float32Array;

    yield;

    const mott = (yield lowresWork(W, H, 3, ((n) => (x, y) => n((x / ppm) * 7, (y / ppm) * 7))(fbm2(seed + 1, 4)))) as Sampler;
    const broad = (yield lowresWork(W, H, 6, ((n) => (x, y) => n((x / ppm) * 1.6, (y / ppm) * 1.6))(fbm2(seed + 2, 3)))) as Sampler;
    const streak = (yield lowresWork(W, H, 3, ((n) => (x, y) => n((x / ppm) * 36, (y / ppm) * 2.2))(fbm2(seed + 3, 3)))) as Sampler;
    const lich = (yield lowresWork(W, H, 2, ((n) => (x, y) => n((x / ppm) * 12, (y / ppm) * 12))(fbm2(seed + 4, 4)))) as Sampler;
    const lichTone = (yield lowresWork(W, H, 8, ((n) => (x, y) => n((x / ppm) * 4, (y / ppm) * 4))(fbm2(seed + 5, 2)))) as Sampler;
    const giltN = (yield lowresWork(W, H, 1, ((n) => (x, y) => n((x / ppm) * 170, (y / ppm) * 170))(fbm2(seed + 6, 2)))) as Sampler;
    const giltPatch = (yield lowresWork(W, H, 8, ((n) => (x, y) => n((x / ppm) * 9, (y / ppm) * 9))(fbm2(seed + 9, 2)))) as Sampler;
    const touch = (yield lowresWork(W, H, 8, ((n) => (x, y) => n((x / ppm) * 2.5, (y / ppm) * 2.5))(fbm2(seed + 7, 2)))) as Sampler;
    const pitN = valueNoise(seed + 8, 256);

    yield;

    const out = new Surface(W, H);
    for (let y = 0; y < H; y++) {
        // a row at a time, so the page keeps drawing while the stone is cut
        yield;
        const ym = y / ppm;
        const bottom = smooth(faceH - 0.24, faceH, ym);
        const top = 1 - smooth(0, 0.18, ym);
        // soot rising from the candles at the face's lower corners
        const plume = smooth(faceH, faceH - 0.2, ym) * smooth(faceH - 1.05, faceH - 0.3, ym);
        const runs = 1 - smooth(0.05, faceH * 0.85, ym);
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const xm = x / ppm;
            const edge = Math.min(xm, faceW - xm, ym, faceH - ym);
            const eK = 1 - smooth(0, 0.085, edge);
            const m = mott(x, y);
            const b = broad(x, y);
            const grain = hash2(x, y, seed);

            // pale, warm limestone
            const tone = 0.9 + 0.3 * (m - 0.5) + 0.3 * (b - 0.5) + 0.07 * (grain - 0.5);
            let R = 176 * tone;
            let G = 164 * tone;
            let B = 142 * tone;

            // weathered darker toward the edges, the foot and the head
            const dk = 0.32 * eK + 0.24 * bottom + 0.12 * top;
            R *= 1 - dk;
            G *= 1 - dk * 0.96;
            B *= 1 - dk * 0.9;
            // where hands have touched it, a little cleaner and smoother
            const worn = smooth(0.55, 0.75, touch(x, y)) * (1 - eK);
            R = mix(R, R * 1.08, worn);
            G = mix(G, G * 1.07, worn);
            B = mix(B, B * 1.05, worn);

            // rain and seep running down from the top
            const inCol = smooth(0.0, 0.05, Math.min(xm - padX, faceW - padX - xm));
            const st = smooth(0.5, 0.78, streak(x, y)) * runs * (0.34 - 0.18 * inCol);
            R *= 1 - st;
            G *= 1 - st;
            B *= 1 - st * 0.85;

            const soot = Math.min(1, (Math.exp(-xm / 0.1) + Math.exp(-(faceW - xm) / 0.1)) * plume * (0.65 + 0.7 * m)) * 0.62;
            R *= 1 - soot;
            G *= 1 - soot;
            B *= 1 - soot * 0.95;

            // lichen: grey-green and mustard crusts, mostly near the edges and foot
            const lk = smooth(0.6, 0.7, lich(x, y) + eK * 0.24 + bottom * 0.12 + top * 0.05 - 0.07 - inCol * 0.06);
            if (lk > 0) {
                const lt = smooth(0.42, 0.62, lichTone(x, y));
                const sp = 0.8 + 0.4 * hash2(x >> 1, y >> 1, seed + 3);
                R = mix(R, mix(112, 158, lt) * sp, lk * 0.85);
                G = mix(G, mix(120, 124, lt) * sp, lk * 0.85);
                B = mix(B, mix(94, 56, lt) * sp, lk * 0.85);
            }

            // pitting
            const pit = smooth(0.76, 0.88, pitN(xm * 260, ym * 260));
            R *= 1 - pit * 0.3;
            G *= 1 - pit * 0.3;
            B *= 1 - pit * 0.28;

            // the cartouche's panel is sunk and a shade darker
            const pnl = sunk[i];
            R *= 1 - pnl * 0.08;
            G *= 1 - pnl * 0.08;
            B *= 1 - pnl * 0.07;

            // the cuts: packed with dark grime, a few flecks of old gilt
            const ms = mask[i];
            const mb = vcut[i];
            const ao = halo[i] * (1 - ms) * 0.3;
            R *= 1 - ao;
            G *= 1 - ao;
            B *= 1 - ao * 0.95;
            const fill = smooth(0.1, 0.6, 0.5 * ms + 0.8 * mb);
            // gilt: flakes of it left in the plate's letters, the odd fleck elsewhere
            const flake = smooth(0.5, 0.58, giltN(x, y)) * smooth(0.3, 0.6, giltPatch(x, y));
            const gk = (gilded[i] > 0.5 ? flake * 0.85 : flake * smooth(0.72, 0.8, giltPatch(x, y)) * 0.5) * smooth(0.55, 0.95, ms);
            const gr = 0.8 + 0.4 * m;
            R = mix(R, 36 * gr, fill * 0.95);
            G = mix(G, 28 * gr, fill * 0.95);
            B = mix(B, 22 * gr, fill * 0.95);
            if (gk > 0) {
                const gs = 0.8 + 0.4 * grain;
                R = mix(R, 178 * gs, gk);
                G = mix(G, 134 * gs, gk);
                B = mix(B, 58 * gs, gk);
            }

            // cracks, and the papers' shadows
            const ck = crackM[i];
            const sh = shadow[i] * 0.6;
            R *= (1 - ck * 0.8) * (1 - sh);
            G *= (1 - ck * 0.8) * (1 - sh);
            B *= (1 - ck * 0.78) * (1 - sh);

            const height = 0.6 + 0.06 * (m - 0.5) + 0.03 * (grain - 0.5) - pit * 0.1 - (0.4 * ms + 0.6 * mb) * 0.46 - ao * 0.1 - pnl * 0.1 - ck * 0.3 + lk * 0.015;
            const rough = clamp01(0.86 + 0.08 * grain - worn * 0.12 + fill * 0.08 - gk * 0.35 - bottom * 0.08);
            out.set(i, R, G, B, rough, height);
        }
    }

    yield;
    const maps = (yield out.mapsWork(0.016 * ppm, false)) as Maps;
    return { ...maps, w: W, h: H, ppm };
}
