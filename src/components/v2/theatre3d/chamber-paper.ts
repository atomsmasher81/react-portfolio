import * as THREE from "three";
import { rng } from "@/components/v2/theatre3d/textures";
import { cssFont, type LetterPaper, type Paper, type PrintPaper } from "@/components/v2/theatre3d/chamber-layout";
import { drawLines } from "@/components/v2/theatre3d/chamber-face";
import { hash2, makeCanvas, readableCanvas } from "@/components/v2/theatre3d/chamber-pixels";

// The papers left on the shrine: old photographic prints with a white border
// and a caption in ink, and a letter, folded in three and opened again. Each
// is drawn on a canvas (paper, picture, handwriting) and hung on a nail as a
// slightly curled sheet.

const INK = "rgba(34, 22, 16, 0.94)";
const INK_FADED = "rgba(62, 44, 32, 0.86)";

let grain: HTMLCanvasElement | null = null;
/** A tile of paper fibre and mottling, multiplied over every sheet. */
function paperGrain() {
    if (grain) return grain;
    const S = 256;
    grain = readableCanvas(S, S);
    const ctx = grain.getContext("2d")!;
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            // fibres run mostly one way
            const f = hash2(x >> 2, y, 7) * 0.5 + hash2(x, y, 9) * 0.5;
            const v = 236 + f * 19;
            const i = (y * S + x) * 4;
            img.data[i] = v;
            img.data[i + 1] = v - 2;
            img.data[i + 2] = v - 6;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return grain;
}

/** The sheet itself: aged paper with a deckled outline (transparent outside it), yellowed edges and foxing. */
function sheet(ctx: CanvasRenderingContext2D, W: number, H: number, ppm: number, seed: number, base: [number, number, number]) {
    const r = rng(seed);
    const step = Math.max(3, Math.round(0.006 * ppm));
    const amp = 0.0022 * ppm;
    const inset = 0.0035 * ppm;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const outline = new Path2D();
    // a torn corner on some sheets
    const torn = r() < 0.45 ? Math.floor(r() * 4) : -1;
    const tear = (0.025 + r() * 0.03) * ppm;
    const edge: [number, number][] = [];
    for (let x = inset; x <= W - inset; x += step) edge.push([x, inset + (r() - 0.5) * amp]);
    for (let y = inset; y <= H - inset; y += step) edge.push([W - inset + (r() - 0.5) * amp, y]);
    for (let x = W - inset; x >= inset; x -= step) edge.push([x, H - inset + (r() - 0.5) * amp]);
    for (let y = H - inset; y >= inset; y -= step) edge.push([inset + (r() - 0.5) * amp, y]);
    const corners: [number, number][] = [
        [inset, inset],
        [W - inset, inset],
        [W - inset, H - inset],
        [inset, H - inset],
    ];
    edge.forEach(([x, y], i) => {
        if (torn >= 0) {
            const [cx, cy] = corners[torn];
            const d = Math.abs(x - cx) + Math.abs(y - cy);
            if (d < tear) {
                // pull points inside the tear onto a ragged diagonal
                const k = (tear - d) / 2;
                x += cx < W / 2 ? k : -k;
                y += cy < H / 2 ? k : -k;
                x += (r() - 0.5) * amp * 2;
                y += (r() - 0.5) * amp * 2;
            }
        }
        if (i === 0) outline.moveTo(x, y);
        else outline.lineTo(x, y);
    });
    outline.closePath();
    ctx.clip(outline);

    ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = ctx.createPattern(paperGrain(), "repeat")!;
    ctx.fillRect(0, 0, W, H);
    // yellowed and darkened toward the edges
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.56);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.75, "rgba(236,214,170,1)");
    g.addColorStop(1, "rgba(170,128,78,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // a tide mark from damp
    if (r() < 0.8) {
        const sx = r() * W;
        const sy = r() * H;
        const sr = (0.05 + r() * 0.12) * ppm;
        ctx.strokeStyle = "rgba(150,108,60,0.35)";
        ctx.lineWidth = 0.002 * ppm;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sr, sr * (0.7 + r() * 0.4), r() * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(200,170,120,0.18)";
        ctx.fill();
    }
    // foxing: rusty little spots, in clusters
    for (let c = 0; c < 4; c++) {
        const fx = r() * W;
        const fy = r() * H;
        for (let k = 0; k < 18; k++) {
            const a = r() * Math.PI * 2;
            const d = r() * r() * 0.06 * ppm;
            const rad = (0.0005 + r() * r() * 0.0028) * ppm;
            ctx.fillStyle = `rgba(${130 + r() * 30},${80 + r() * 20},${40},${0.15 + r() * 0.35})`;
            ctx.beginPath();
            ctx.arc(fx + Math.cos(a) * d, fy + Math.sin(a) * d, rad, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    return { r, outline };
}

/** Handwriting: each word a touch off the line and off the level, the ink a little uneven. */
function hand(seed: number, size: number) {
    const r = rng(seed);
    let drift = 0;
    return () => {
        drift = drift * 0.7 + (r() - 0.5) * 0.4;
        return { dy: size * (drift * 0.05 + (r() - 0.5) * 0.03), rot: (r() - 0.5) * 0.025 + drift * 0.012 };
    };
}

/** The photograph, aged: faded to warm sepia, lifted blacks, a vignette, scratches and dust. */
function photo(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, w: number, h: number, seed: number) {
    const r = rng(seed + 5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (image) {
        ctx.drawImage(image, x, y, w, h);
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "rgba(128,128,128,0.62)";
        ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgb(246,222,180)";
        ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(64,44,26,0.55)";
        ctx.fillRect(x, y, w, h);
    } else {
        // the picture didn't come: a blank, darkened patch where it was
        ctx.fillStyle = "rgb(150,128,98)";
        ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = "multiply";
        const ghost = ctx.createRadialGradient(x + w * 0.5, y + h * 0.45, 0, x + w * 0.5, y + h * 0.45, Math.max(w, h) * 0.6);
        ghost.addColorStop(0, "rgb(200,186,160)");
        ghost.addColorStop(1, "rgb(120,98,72)");
        ctx.fillStyle = ghost;
        ctx.fillRect(x, y, w, h);
    }
    ctx.globalCompositeOperation = "multiply";
    const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.55);
    v.addColorStop(0, "rgb(255,255,255)");
    v.addColorStop(1, "rgb(150,112,74)");
    ctx.fillStyle = v;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = ctx.createPattern(paperGrain(), "repeat")!;
    ctx.fillRect(x, y, w, h);
    // scratches and dust, pale
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    for (let k = 0; k < 9; k++) {
        ctx.strokeStyle = `rgba(230,214,190,${0.12 + r() * 0.22})`;
        ctx.lineWidth = 0.6 + r() * 1.1;
        const sx = x + r() * w;
        const sy = y + r() * h;
        const len = (0.1 + r() * 0.5) * h;
        const a = Math.PI / 2 + (r() - 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + Math.cos(a) * len * 0.5 + (r() - 0.5) * 10, sy + Math.sin(a) * len * 0.5, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        ctx.stroke();
    }
    for (let k = 0; k < 60; k++) {
        ctx.fillStyle = `rgba(240,228,206,${0.2 + r() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x + r() * w, y + r() * h, 0.4 + r() * r() * 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    // a hairline where the emulsion meets the border
    ctx.strokeStyle = "rgba(90,70,50,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** A rusty ring round the nail hole. */
function nailStain(ctx: CanvasRenderingContext2D, x: number, y: number, ppm: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 0.022 * ppm);
    g.addColorStop(0, "rgba(90,44,18,0.75)");
    g.addColorStop(0.35, "rgba(120,62,26,0.35)");
    g.addColorStop(1, "rgba(120,62,26,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 0.022 * ppm, 0, Math.PI * 2);
    ctx.fill();
    // and a run of rust down from it
    const run = ctx.createLinearGradient(0, y, 0, y + 0.05 * ppm);
    run.addColorStop(0, "rgba(110,56,22,0.35)");
    run.addColorStop(1, "rgba(110,56,22,0)");
    ctx.fillStyle = run;
    ctx.fillRect(x - 0.002 * ppm, y, 0.004 * ppm, 0.05 * ppm);
}

/** Where the nail goes, metres below the paper's top edge. */
export const nailY = (p: Paper) => (p.kind === "print" ? 0.016 : 0.032);

export interface PaperBuild {
    map: THREE.CanvasTexture;
    roughnessMap: THREE.CanvasTexture;
}

const PPM = { high: 1250, low: 760 };
const MAXD = { high: 1600, low: 1024 };

/** Paint a print or a letter. `image` is the loaded picture for a print (null if it failed). */
export function paintPaper(p: Paper, image: HTMLImageElement | null, quality: "high" | "low"): PaperBuild {
    const ppm = Math.min(PPM[quality], MAXD[quality] / Math.max(p.w, p.h));
    const W = Math.round(p.w * ppm);
    const H = Math.round(p.h * ppm);
    const c = makeCanvas(W, H);
    const ctx = c.getContext("2d")!;
    // roughness at a quarter of the size: paper is matt, a photograph's emulsion has a little sheen
    const rc = makeCanvas(Math.max(4, W >> 2), Math.max(4, H >> 2));
    const rctx = rc.getContext("2d")!;
    rctx.fillStyle = "rgb(225,225,225)";
    rctx.fillRect(0, 0, rc.width, rc.height);

    const outline = p.kind === "print" ? paintPrint(ctx, p, image, ppm, rctx, rc.width / W) : paintLetter(ctx, p, ppm);
    nailStain(ctx, W / 2, nailY(p) * ppm, ppm);
    // nothing outside the deckled edge
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#000";
    ctx.fill(outline);
    ctx.globalCompositeOperation = "source-over";

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    const roughnessMap = new THREE.CanvasTexture(rc);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    return { map, roughnessMap };
}

function paintPrint(ctx: CanvasRenderingContext2D, p: PrintPaper, image: HTMLImageElement | null, ppm: number, rctx: CanvasRenderingContext2D, rs: number) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const { outline } = sheet(ctx, W, H, ppm, p.seed, [208, 196, 170]);
    const { x, y, w, h } = p.img;
    photo(ctx, image, x * ppm, y * ppm, w * ppm, h * ppm, p.seed);
    rctx.fillStyle = "rgb(150,150,150)";
    rctx.fillRect(x * ppm * rs, y * ppm * rs, w * ppm * rs, h * ppm * rs);

    const side = 0.03;
    ctx.fillStyle = INK;
    if (p.caption.length) {
        const j = hand(p.seed + 11, p.capSize);
        drawLines(ctx, p.caption, "italic", p.capSize, side + 0.012, p.capY, p.w - 2 * side - 0.03, "left", 1.3, ppm, 0, j);
    }
    if (p.date) {
        ctx.fillStyle = INK_FADED;
        ctx.font = cssFont("italic", p.dateSize * ppm);
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(p.date, (p.w - side - 0.008) * ppm, (p.dateY + p.dateSize * 1.05) * ppm);
        ctx.textAlign = "left";
    }
    return outline;
}

function paintLetter(ctx: CanvasRenderingContext2D, p: LetterPaper, ppm: number) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const { r, outline } = sheet(ctx, W, H, ppm, p.seed, [204, 188, 158]);
    ctx.save();
    // the folds: each panel weathered a little differently, a crease between them
    const ys = [0, ...p.folds, p.h];
    for (let k = 0; k < ys.length - 1; k++) {
        ctx.fillStyle = `rgba(${k % 2 ? 90 : 255},${k % 2 ? 66 : 248},${k % 2 ? 40 : 230},${k % 2 ? 0.07 : 0.05})`;
        ctx.fillRect(0, ys[k] * ppm, W, (ys[k + 1] - ys[k]) * ppm);
    }
    for (const f of p.folds) {
        const y = f * ppm;
        const g = ctx.createLinearGradient(0, y - 0.012 * ppm, 0, y + 0.012 * ppm);
        g.addColorStop(0, "rgba(60,40,20,0)");
        g.addColorStop(0.48, "rgba(60,40,20,0.22)");
        g.addColorStop(0.5, "rgba(50,32,16,0.45)");
        g.addColorStop(0.53, "rgba(255,250,236,0.35)");
        g.addColorStop(1, "rgba(255,250,236,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 0.012 * ppm, W, 0.024 * ppm);
    }
    // the words, in ink
    ctx.fillStyle = INK;
    const j = hand(p.seed + 3, p.size);
    let y = p.padTop;
    for (const para of p.paras) {
        y += drawLines(ctx, para, "italic", p.size, p.padX, y, p.w - 2 * p.padX, "left", 1.3, ppm, 0, j) + p.size * 0.5;
    }
    // signed off with a flourish (a name you can't quite read)
    const sx = (p.w - p.padX - 0.26) * ppm;
    const sy = (p.signY + 0.055) * ppm;
    const u = 0.01 * ppm;
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.0024 * ppm;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + 1.5 * u, sy - 6 * u, sx + 4 * u, sy - 6.5 * u, sx + 3.2 * u, sy - 1 * u);
    ctx.bezierCurveTo(sx + 2.5 * u, sy + 3 * u, sx + 1 * u, sy + 1.5 * u, sx + 3.5 * u, sy - 1.2 * u);
    ctx.bezierCurveTo(sx + 6 * u, sy - 4 * u, sx + 6.5 * u, sy + 1 * u, sx + 8.5 * u, sy - 1.5 * u);
    ctx.bezierCurveTo(sx + 10 * u, sy - 3.5 * u, sx + 11 * u, sy + 0.5 * u, sx + 12.5 * u, sy - 2 * u);
    ctx.bezierCurveTo(sx + 14 * u, sy - 4.5 * u, sx + 15 * u, sy + 1 * u, sx + 17 * u, sy - 0.5 * u);
    ctx.bezierCurveTo(sx + 19 * u, sy - 2 * u, sx + 20 * u, sy - 1 * u, sx + 21 * u, sy - 1.5 * u);
    ctx.stroke();
    ctx.lineWidth = 0.0018 * ppm;
    ctx.beginPath();
    ctx.moveTo(sx - 1 * u, sy + 3.2 * u);
    ctx.bezierCurveTo(sx + 7 * u, sy + 1.8 * u, sx + 16 * u, sy + 3.8 * u, sx + 24 * u, sy + 1.6 * u);
    ctx.stroke();
    // a blot and its spatter
    const bx = sx + 23 * u;
    const by = sy - 4 * u;
    ctx.fillStyle = "rgba(30,20,14,0.85)";
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rad = u * (0.55 + r() * 0.35);
        if (k === 0) ctx.moveTo(bx + Math.cos(a) * rad, by + Math.sin(a) * rad);
        else ctx.lineTo(bx + Math.cos(a) * rad, by + Math.sin(a) * rad);
    }
    ctx.fill();
    for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.arc(bx + (r() - 0.5) * 4 * u, by + (r() - 0.5) * 4 * u, u * 0.12 * (0.5 + r()), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    return outline;
}

/**
 * The sheet as a mesh: hanging from its top edge (y = 0) down to y = -h,
 * pinned at the top centre, standing off the stone a few millimetres, a bottom
 * corner curling up and away, cockled a little; the letter rises at its folds.
 */
export function paperGeometry(p: Paper, curl = 0.035) {
    const nx = Math.max(10, Math.round(p.w / 0.022));
    const ny = Math.max(10, Math.round(p.h / 0.022));
    const g = new THREE.PlaneGeometry(p.w, p.h, nx, ny);
    g.translate(0, -p.h / 2, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const r = rng(p.seed + 1);
    const corner = r() < 0.5 ? -1 : 1;
    const phase = r() * 6;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const t = -y / p.h; // 0 at the top, 1 at the bottom
        let z = 0.0022 + 0.0045 * t * t;
        const dx = (x - (corner * p.w) / 2) / Math.max(p.w, 0.3);
        const dy = (y + p.h) / Math.max(p.h, 0.3);
        const d = Math.hypot(dx * 1.2, dy);
        z += curl * Math.pow(Math.max(0, 1 - d / 0.45), 2.4);
        z += 0.0035 * Math.pow(Math.abs(x) / (p.w / 2), 2) * (1 - t);
        z += 0.0016 * Math.sin((x / p.w) * 7 + phase) * Math.sin(t * 5 + phase) * t;
        if (p.kind === "letter") {
            for (const f of p.folds) {
                const k = Math.max(0, 1 - Math.abs(-y - f) / 0.06);
                z += 0.007 * k * k;
            }
        }
        pos.setZ(i, z);
    }
    g.computeVertexNormals();
    return g;
}
