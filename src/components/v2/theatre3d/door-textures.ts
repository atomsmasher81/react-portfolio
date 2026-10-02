import * as THREE from "three";
import { Built, fbm, normalFromHeightWork, once, putWork, rng, valueNoise, type Work } from "@/components/v2/theatre3d/textures";
import { D, LEAF_R, LEAF_SPRING, KEYHOLE, KNOCKER, HANDLE, leafTop, type DoorVariant } from "@/components/v2/theatre3d/door-variants";

// Every surface of the doors, painted from noise. The stone, iron and brass
// are shared by all six doors; each door's wood is composed from one shared
// grain so its planks, rust runs, stains and cracks are its own. All built
// once, and a slice at a time beforehand with prepareDoorTextures() (textures.ts).

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
    const t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a: RGB, b: RGB, t: number, out: RGB): RGB => {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
};

/** Value noise that tiles across the canvas: u, v in [0, 1), `period` cells across. */
function tileNoise(seed: number, period: number) {
    const n = valueNoise(seed, period);
    return (u: number, v: number) => n(u * period, v * period);
}

/** Tiling fractal noise, octaves doubling from `period` cells across. */
function tileFbm(seed: number, period: number, octaves: number) {
    const layers = Array.from({ length: octaves }, (_, i) => tileNoise(seed + i * 131, period << i));
    return (u: number, v: number) => {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        for (const n of layers) {
            sum += n(u, v) * amp;
            norm += amp;
            amp *= 0.5;
        }
        return sum / norm;
    };
}

function makeCanvas(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
}

/** Paint a colour canvas and a greyscale height canvas in one pass, a row at a time. */
function* paintPair(w: number, h: number, px: (x: number, y: number, col: RGB) => number): Work<{ color: HTMLCanvasElement; height: HTMLCanvasElement }> {
    const color = makeCanvas(w, h);
    const height = makeCanvas(w, h);
    const cctx = color.getContext("2d")!;
    const hctx = height.getContext("2d")!;
    const ci = cctx.createImageData(w, h);
    const hi = hctx.createImageData(w, h);
    const col: RGB = [0, 0, 0];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const hv = px(x, y, col);
            const i = (y * w + x) * 4;
            ci.data[i] = col[0];
            ci.data[i + 1] = col[1];
            ci.data[i + 2] = col[2];
            ci.data[i + 3] = 255;
            const g = clamp01(hv) * 255;
            hi.data[i] = g;
            hi.data[i + 1] = g;
            hi.data[i + 2] = g;
            hi.data[i + 3] = 255;
        }
        yield;
    }
    yield putWork(cctx, ci);
    yield putWork(hctx, hi);
    return { color, height };
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean, repeat = false) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 4;
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
}

// ---------------------------------------------------------------- stone

export interface StoneMaps {
    map: THREE.Texture;
    normalMap: THREE.Texture;
}

/** Weathered limestone, tiling, about 1.1 m across. */
export function stoneMaps(): StoneMaps {
    return stone();
}

const stone = once(function* (): Work<StoneMaps> {
    const S = 512;
    const big = tileFbm(11, 4, 5);
    yield;
    const mid = tileFbm(23, 12, 3);
    yield;
    const grain = tileNoise(37, 160);
    yield;
    const pits = tileNoise(41, 96);
    yield;
    const warm = tileFbm(53, 3, 3);
    yield;
    const veins = tileFbm(67, 6, 4);
    yield;
    const streakCol = tileNoise(71, 40);
    yield;
    const dark = hex("#231c16");
    const light = hex("#54493d");
    const cool = hex("#37332f");
    const tmp: RGB = [0, 0, 0];
    const { color, height } = (yield paintPair(S, S, (x, y, col) => {
        const u = x / S;
        const v = y / S;
        const b = big(u, v);
        const m = mid(u, v);
        const g = grain(u, v);
        const p = smooth(0.74, 0.86, pits(u, v)) * smooth(0.35, 0.6, m);
        const vein = 1 - smooth(0.0, 0.025, Math.abs(veins(u, v) - 0.5));
        const tone = smooth(0.2, 0.8, b + (m - 0.5) * 0.4);
        mixRGB(dark, light, tone, col);
        mixRGB(col, cool, smooth(0.4, 0.7, warm(u, v)) * 0.35, tmp);
        const streak = smooth(0.58, 0.86, streakCol(u, 0.37)) * (0.4 + 0.6 * b);
        const shade = 0.82 + (g - 0.5) * 0.35 - p * 0.45 - vein * 0.1 - streak * 0.35;
        col[0] = tmp[0] * shade;
        col[1] = tmp[1] * shade;
        col[2] = tmp[2] * shade;
        return 0.55 + (b - 0.5) * 0.45 + (m - 0.5) * 0.4 + (g - 0.5) * 0.22 - p * 0.55 - vein * 0.1;
    })) as { color: HTMLCanvasElement; height: HTMLCanvasElement };
    // A few hairline cracks, drawn wrapped so the tile still repeats.
    for (const [canvas, style] of [
        [color, "rgba(12,9,7,0.75)"],
        [height, "rgba(0,0,0,0.85)"],
    ] as const) {
        const ctx = canvas.getContext("2d")!;
        const rr = rng(77);
        ctx.strokeStyle = style;
        ctx.lineCap = "round";
        for (let c = 0; c < 5; c++) {
            const pts: [number, number][] = [];
            let px = rr() * S;
            let py = rr() * S;
            let a = rr() * Math.PI * 2;
            const n = 6 + Math.floor(rr() * 10);
            for (let i = 0; i < n; i++) {
                pts.push([px, py]);
                a += (rr() - 0.5) * 1.1;
                px += Math.cos(a) * 9;
                py += Math.sin(a) * 9;
            }
            ctx.lineWidth = 0.8 + rr() * 0.9;
            for (const ox of [-S, 0, S])
                for (const oy of [-S, 0, S]) {
                    ctx.beginPath();
                    pts.forEach(([qx, qy], i) => (i ? ctx.lineTo(qx + ox, qy + oy) : ctx.moveTo(qx + ox, qy + oy)));
                    ctx.stroke();
                }
        }
    }
    yield;
    return { map: toTexture(color, true, true), normalMap: (yield normalFromHeightWork(height, 3.2, [1, 1])) as THREE.CanvasTexture };
});

// ---------------------------------------------------------------- iron

export interface IronMaps {
    map: THREE.Texture;
    normalMap: THREE.Texture;
    mr: THREE.Texture; // roughness in G, metalness in B
}

/** Hand-forged iron gone to rust, tiling, half a metre across. */
export function ironMaps(): IronMaps {
    return iron();
}

const iron = once(function* (): Work<IronMaps> {
    const S = 512;
    const big = tileFbm(101, 3, 3);
    yield;
    const rust = tileFbm(113, 8, 4);
    yield;
    const flake = tileFbm(127, 24, 3);
    yield;
    const pits = tileNoise(131, 140);
    yield;
    const metalDark = hex("#1b1714");
    const metalLight = hex("#3b3430");
    const rustDark = hex("#2a150a");
    const rustMid = hex("#5a2c13");
    const rustLight = hex("#80461f");
    const crust = hex("#1c0f08");
    const mrCanvas = makeCanvas(S, S);
    const mctx = mrCanvas.getContext("2d")!;
    const mi = mctx.createImageData(S, S);
    const a: RGB = [0, 0, 0];
    const b: RGB = [0, 0, 0];
    const { color, height } = (yield paintPair(S, S, (x, y, col) => {
        const u = x / S;
        const v = y / S;
        const rr = rust(u, v) + (big(u, v) - 0.5) * 0.35;
        const f = flake(u, v);
        const amt = smooth(0.44, 0.64, rr);
        const heavy = smooth(0.6, 0.74, rr);
        const pit = smooth(0.72, 0.86, pits(u, v));
        mixRGB(metalDark, metalLight, f, a);
        mixRGB(rustDark, rustMid, smooth(0.3, 0.8, f), b);
        mixRGB(b, rustLight, smooth(0.65, 0.95, f) * 0.6, b);
        mixRGB(b, crust, heavy * smooth(0.45, 0.2, f), b);
        mixRGB(a, b, amt, col);
        const shade = 1 - pit * 0.55;
        col[0] *= shade;
        col[1] *= shade;
        col[2] *= shade;
        const i = (y * S + x) * 4;
        mi.data[i] = 0;
        mi.data[i + 1] = mix(0.48, 0.95, amt) * 255;
        mi.data[i + 2] = mix(0.7, 0.05, amt) * 255;
        mi.data[i + 3] = 255;
        return 0.45 + amt * 0.2 + heavy * (f - 0.3) * 0.5 - pit * 0.35;
    })) as { color: HTMLCanvasElement; height: HTMLCanvasElement };
    yield putWork(mctx, mi);
    return { map: toTexture(color, true, true), normalMap: (yield normalFromHeightWork(height, 4, [1, 1])) as THREE.CanvasTexture, mr: toTexture(mrCanvas, false, true) };
});

// ---------------------------------------------------------------- brass

/** Where things sit on the plaque, plate-local metres from its centre. */
export const PLAQUE = { numeral: 0.13, rule: 0.08, text: -0.058, textWidth: 0.44, screw: 0.03 };

export interface BrassMaps {
    map: THREE.Texture;
    normalMap: THREE.Texture;
    mr: THREE.Texture;
}

/** The plaque: old brass, polished in places, tarnished green-black in others, with an engraved border. */
export function brassMaps(): BrassMaps {
    return brass();
}

const brass = once(function* (): Work<BrassMaps> {
    const W = 512;
    const H = Math.round((512 * D.plateH) / D.plateW);
    const pw = D.plateW;
    const ph = D.plateH;
    const tarnishN = fbm(211, 5);
    yield;
    const verdN = fbm(223, 4);
    yield;
    const tone = fbm(229, 3);
    yield;
    const fine = valueNoise(233);
    yield;
    const brassLo = hex("#3a2c18");
    const brassHi = hex("#7a5e34");
    const tarnish = hex("#2b2116");
    const verd = hex("#4a5747");
    const mrCanvas = makeCanvas(W, H);
    const mctx = mrCanvas.getContext("2d")!;
    const mi = mctx.createImageData(W, H);
    // Distance (metres) to the engraved border, a rounded rectangle inside the corner screws.
    const border = (mx: number, my: number) => {
        const ix = pw / 2 - 0.052;
        const iy = ph / 2 - 0.052;
        const qx = Math.abs(mx) - ix + 0.02;
        const qy = Math.abs(my) - iy + 0.02;
        const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.02;
        return Math.abs(out);
    };
    const { color, height } = (yield paintPair(W, H, (x, y, col) => {
        const u = x / W;
        const v = y / H;
        const mx = (u - 0.5) * pw;
        const my = (0.5 - v) * ph;
        const edge = 1 - smooth(0.0, 0.06, Math.min(pw / 2 - Math.abs(mx), ph / 2 - Math.abs(my)));
        // rubbed brighter in the middle, where it has been touched and cleaned
        const rub = Math.exp(-((mx / 0.2) ** 2) - (((my + 0.02) / 0.14) ** 2));
        const f = fine(x * 0.7, y * 0.7);
        const tn = tarnishN(u * 4, v * 1.6) + edge * 0.28 - rub * 0.35;
        const tarn = smooth(0.48, 0.72, tn);
        const groove = 1 - smooth(0.0016, 0.0032, border(mx, my));
        const ry = my - PLAQUE.rule;
        const rule = (1 - smooth(0.0008, 0.0018, Math.abs(ry))) * (1 - smooth(0.06, 0.075, Math.abs(mx)));
        const lozenge = 1 - smooth(0.0, 0.002, Math.abs(Math.abs(mx) * 0.55 + Math.abs(ry)) - 0.007);
        const cut = Math.max(groove, rule, lozenge);
        const vd = smooth(0.6, 0.8, verdN(u * 8, v * 3) + edge * 0.3 + (1 - smooth(0.0, 0.008, border(mx, my))) * 0.25) * 0.75;
        mixRGB(brassLo, brassHi, clamp01(0.35 + (tone(u * 3, v * 1.2) - 0.5) * 0.6 + rub * 0.35 + (f - 0.5) * 0.12), col);
        mixRGB(col, tarnish, tarn * 0.85, col);
        mixRGB(col, verd, vd, col);
        mixRGB(col, [22, 15, 9], cut * 0.9, col);
        const i = (y * W + x) * 4;
        const rough = mix(0.34, 0.72, tarn) + vd * 0.2 + cut * 0.2;
        const metal = mix(0.85, 0.35, tarn) * (1 - vd);
        mi.data[i] = 0;
        mi.data[i + 1] = clamp01(rough) * 255;
        mi.data[i + 2] = clamp01(metal) * 255;
        mi.data[i + 3] = 255;
        return 0.6 - cut * 0.45 + vd * 0.1 + (f - 0.5) * 0.05;
    })) as { color: HTMLCanvasElement; height: HTMLCanvasElement };
    // Scratches and a few dents.
    const r = rng(239);
    const cctx = color.getContext("2d")!;
    const hctx = height.getContext("2d")!;
    for (let i = 0; i < 70; i++) {
        const x0 = r() * W;
        const y0 = r() * H;
        const a = (r() - 0.5) * 1.2 + (r() < 0.5 ? 0 : Math.PI / 2);
        const len = 6 + r() * 40;
        const x1 = x0 + Math.cos(a) * len;
        const y1 = y0 + Math.sin(a) * len;
        cctx.strokeStyle = `rgba(214,182,120,${0.05 + r() * 0.12})`;
        cctx.lineWidth = 0.6 + r() * 0.6;
        cctx.beginPath();
        cctx.moveTo(x0, y0);
        cctx.lineTo(x1, y1);
        cctx.stroke();
        hctx.strokeStyle = "rgba(0,0,0,0.35)";
        hctx.lineWidth = 0.8;
        hctx.beginPath();
        hctx.moveTo(x0, y0);
        hctx.lineTo(x1, y1);
        hctx.stroke();
    }
    yield;
    return { map: toTexture(color, true), normalMap: (yield normalFromHeightWork(height, 2.5)) as THREE.CanvasTexture, mr: toTexture(mrCanvas, false) };
});

// ---------------------------------------------------------------- wood

const WOOD_W = 512;
const WOOD_H = 1024;
/** Leaf-local metres to the wood texture's [0, 1] UVs. */
export const LEAF_UV = { sx: 1 / D.leafW, sy: 1 / (LEAF_SPRING + LEAF_R) };

/** One wide sheet of oak grain with knots; each door cuts its planks from it. */
const woodGrain = once(function* (): Work<{ color: HTMLCanvasElement; height: HTMLCanvasElement }> {
    const r = rng(401);
    const knots = Array.from({ length: 11 }, () => ({ x: 20 + r() * (WOOD_W - 40), y: 40 + r() * (WOOD_H - 80), r: 4 + r() * 9 }));
    const warp = fbm(409, 3);
    yield;
    const ringN = fbm(419, 2);
    yield;
    const fibre = valueNoise(421);
    yield;
    const tone = fbm(431, 3);
    yield;
    const fine = valueNoise(433);
    yield;
    const darkest = hex("#0e0805");
    const dark = hex("#24170e");
    const mid = hex("#3e2a19");
    const light = hex("#5a412a");
    const grey = hex("#4a443d");
    const a: RGB = [0, 0, 0];
    return (yield paintPair(WOOD_W, WOOD_H, (x, y, col) => {
        let gx = x;
        let knot = 0;
        let knotRing = 0;
        for (const k of knots) {
            const dx = x - k.x;
            const dy = (y - k.y) * 0.28;
            const d2 = dx * dx + dy * dy;
            gx += (k.r * k.r * 2.6 * dx) / (d2 + k.r * k.r * 3);
            const kd = Math.hypot(dx, (y - k.y) * 0.62) / k.r;
            if (kd < 1.4) {
                knot = Math.max(knot, 1 - smooth(0.55, 1.2, kd));
                knotRing = Math.max(knotRing, (1 - smooth(0.8, 1.4, kd)) * (0.5 + 0.5 * Math.sin(kd * 9)));
            }
        }
        const w = gx * 0.075 + warp(x * 0.005, y * 0.0012) * 2.4 + ringN(x * 0.02, y * 0.004) * 0.9;
        const ring = w - Math.floor(w);
        const late = smooth(0.5, 0.86, ring) * (1 - smooth(0.9, 1, ring)) * (0.55 + 0.45 * ringN(x * 0.05, y * 0.01));
        const f = fibre(x * 0.3, y * 0.012);
        const t = tone(x * 0.004, y * 0.0012);
        const fn = fine(x * 0.45, y * 0.45);
        let val = 0.52 + (f - 0.5) * 0.24 - late * 0.3 + (t - 0.5) * 0.75 + (fn - 0.5) * 0.08;
        val -= knot * 0.55 + knotRing * 0.15;
        val = clamp01(val);
        if (val < 0.35) mixRGB(darkest, dark, val / 0.35, col);
        else if (val < 0.7) mixRGB(dark, mid, (val - 0.35) / 0.35, col);
        else mixRGB(mid, light, (val - 0.7) / 0.3, col);
        // the raised grain has silvered a little with age
        mixRGB(col, grey, (smooth(0.5, 0.85, f) * 0.22 + smooth(0.55, 0.8, t) * 0.18) * (1 - late), a);
        col[0] = a[0];
        col[1] = a[1];
        col[2] = a[2];
        return 0.5 - late * 0.35 + (f - 0.5) * 0.15 + (t - 0.5) * 0.25 - knot * 0.3 + knotRing * 0.12 + (fn - 0.5) * 0.04;
    })) as { color: HTMLCanvasElement; height: HTMLCanvasElement };
});

export interface WoodMaps {
    map: THREE.Texture;
    normalMap: THREE.Texture;
    emissiveMap: THREE.Texture;
}

const woodCache = new Map<number, Built<WoodMaps>>();
const woodOf = (v: DoorVariant) => {
    let b = woodCache.get(v.id);
    if (!b) woodCache.set(v.id, (b = new Built(() => woodWork(v))));
    return b;
};

/** The ironwork each door carries, as leaf-local rectangles (used for rust runs). */
export function ironRuns(v: DoorVariant) {
    const runs: { x0: number; x1: number; y: number; h: number }[] = [];
    v.hinges.forEach((y, i) => runs.push({ x0: 0, x1: v.hingeLen[i] * D.leafW * 0.78 + 0.1, y, h: 0.066 }));
    for (const y of v.bands) {
        const half = Math.min(LEAF_R, Math.sqrt(Math.max(LEAF_R * LEAF_R - Math.max(y - LEAF_SPRING, 0) ** 2, 0)));
        runs.push({ x0: LEAF_R - half + 0.04, x1: LEAF_R + half - 0.04, y, h: 0.056 });
    }
    return runs;
}

/** A door's wood: its planks cut from the shared grain, then aged. */
export function woodMaps(v: DoorVariant): WoodMaps {
    return woodOf(v).get();
}

/** Paint the shared surfaces and these doors' wood a slice at a time: then they're there at once. */
export function prepareDoorTextures(variants: DoorVariant[]) {
    return Promise.all([stone.built.prepare(), iron.built.prepare(), brass.built.prepare(), ...variants.map((v) => woodOf(v).prepare())]);
}

function* woodWork(v: DoorVariant): Work<WoodMaps> {
    const base = (yield woodGrain.built.work()) as { color: HTMLCanvasElement; height: HTMLCanvasElement };
    const r = rng(v.seed + 5);
    const W = WOOD_W;
    const H = WOOD_H;
    const color = makeCanvas(W, H);
    const height = makeCanvas(W, H);
    const glow = makeCanvas(W / 2, H / 2);
    const cc = color.getContext("2d")!;
    const hc = height.getContext("2d")!;
    const gc = glow.getContext("2d")!;
    const pxX = W * LEAF_UV.sx;
    const pxY = H * LEAF_UV.sy;

    // Planks: each a different strip of the grain, some flipped.
    const n = v.planks.length - 1;
    for (let i = 0; i < n; i++) {
        const x0 = Math.floor(v.planks[i] * pxX);
        const x1 = Math.ceil(v.planks[i + 1] * pxX);
        const pw = x1 - x0;
        const sx = Math.floor(r() * (W - pw));
        const flipX = r() < 0.5;
        const flipY = r() < 0.5;
        for (const [ctx, src] of [
            [cc, base.color],
            [hc, base.height],
        ] as const) {
            ctx.save();
            ctx.translate(x0 + (flipX ? pw : 0), flipY ? H : 0);
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
            ctx.drawImage(src, sx, 0, pw, H, 0, 0, pw, H);
            ctx.restore();
        }
        // Each plank aged a little differently; the replaced one is newer and redder.
        const shade = i === v.replaced ? 0 : 0.04 + r() * 0.36;
        cc.fillStyle = `rgba(8,4,2,${shade})`;
        cc.fillRect(x0, 0, pw, H);
        if (i === v.replaced) {
            cc.globalCompositeOperation = "screen";
            cc.fillStyle = "rgba(52,26,12,0.2)";
            cc.fillRect(x0, 0, pw, H);
            cc.globalCompositeOperation = "source-over";
        }
        yield;
    }
    // Overall tint for this door.
    const hmax = Math.max(...v.hue);
    cc.globalCompositeOperation = "multiply";
    cc.fillStyle = `rgb(${(v.hue[0] / hmax) * 255},${(v.hue[1] / hmax) * 255},${(v.hue[2] / hmax) * 255})`;
    cc.fillRect(0, 0, W, H);
    cc.globalCompositeOperation = "source-over";

    // From here on, draw in leaf metres with y up.
    const toLeaf = (ctx: CanvasRenderingContext2D, sx = pxX, sy = pxY, h = H) => ctx.setTransform(sx, 0, 0, -sy, 0, h);
    toLeaf(cc);
    toLeaf(hc);
    toLeaf(gc, pxX / 2, pxY / 2, H / 2);

    // Dark seams between planks.
    for (let i = 1; i < n; i++) {
        const x = v.planks[i];
        const g = cc.createLinearGradient(x - 0.012, 0, x + 0.012, 0);
        g.addColorStop(0, "rgba(4,2,1,0)");
        g.addColorStop(0.5, "rgba(4,2,1,0.95)");
        g.addColorStop(1, "rgba(4,2,1,0)");
        cc.fillStyle = g;
        cc.fillRect(x - 0.012, 0, 0.024, 3);
        hc.fillStyle = "rgba(0,0,0,0.9)";
        hc.fillRect(x - 0.003, 0, 0.006, 3);
    }

    yield;
    // Water stains: dark blooms with a harder tide line at the edge.
    for (let s = 0; s < 4; s++) {
        const cx = 0.15 + r() * (D.leafW - 0.3);
        const cy = 0.2 + r() * 1.8;
        const rad = 0.08 + r() * 0.22;
        for (let k = 0; k < 3; k++) {
            const ox = cx + (r() - 0.5) * rad;
            const oy = cy + (r() - 0.5) * rad;
            const rr = rad * (0.6 + r() * 0.5);
            const g = cc.createRadialGradient(ox, oy, 0, ox, oy, rr);
            g.addColorStop(0, "rgba(6,4,2,0.05)");
            g.addColorStop(0.82, "rgba(6,4,2,0.22)");
            g.addColorStop(0.93, "rgba(4,3,1,0.4)");
            g.addColorStop(1, "rgba(6,4,2,0)");
            cc.fillStyle = g;
            cc.beginPath();
            cc.arc(ox, oy, rr, 0, Math.PI * 2);
            cc.fill();
        }
        // water ran down from it
        for (let k = 0; k < 6; k++) {
            const x = cx + (r() - 0.5) * rad;
            const len = 0.1 + r() * 0.5;
            const g = cc.createLinearGradient(0, cy, 0, cy - len);
            g.addColorStop(0, "rgba(6,4,2,0.25)");
            g.addColorStop(1, "rgba(6,4,2,0)");
            cc.fillStyle = g;
            cc.fillRect(x, cy - len, 0.004 + r() * 0.01, len);
        }
    }

    // Rust: a stain where the iron sits, and runs bleeding down beneath it.
    const runs = ironRuns(v);
    if (v.ghostBand !== null) {
        const y = v.ghostBand;
        const half = Math.sqrt(Math.max(LEAF_R * LEAF_R - Math.max(y - LEAF_SPRING, 0) ** 2, 0));
        runs.push({ x0: LEAF_R - half + 0.04, x1: LEAF_R + half - 0.04, y, h: 0.046 });
        // the wood under a lost band stayed cleaner: a pale print of it
        cc.fillStyle = "rgba(92,66,42,0.22)";
        cc.fillRect(LEAF_R - half + 0.04, y - 0.022, half * 2 - 0.08, 0.044);
    }
    for (const run of runs) {
        cc.fillStyle = "rgba(84,36,12,0.55)";
        cc.fillRect(run.x0 - 0.006, run.y - run.h / 2 - 0.008, run.x1 - run.x0 + 0.012, run.h + 0.016);
        const count = Math.floor((run.x1 - run.x0) / 0.01);
        for (let k = 0; k < count; k++) {
            const x = run.x0 + r() * (run.x1 - run.x0);
            const top = run.y - run.h / 2 + 0.004;
            const len = 0.02 + r() * r() * 0.42;
            const w = 0.0015 + r() * 0.006;
            const a = 0.15 + r() * 0.45;
            const g = cc.createLinearGradient(0, top, 0, top - len);
            g.addColorStop(0, `rgba(118,50,18,${a})`);
            g.addColorStop(0.4, `rgba(92,40,14,${a * 0.6})`);
            g.addColorStop(1, "rgba(70,30,10,0)");
            cc.fillStyle = g;
            cc.fillRect(x, top - len, w, len);
        }
        yield;
    }
    // Under the keyhole and the knocker too.
    for (const p of [KEYHOLE, v.knocker ? KNOCKER : HANDLE]) {
        for (let k = 0; k < 10; k++) {
            const x = p.x + (r() - 0.5) * 0.05;
            const top = p.y - 0.05;
            const len = 0.05 + r() * 0.25;
            const g = cc.createLinearGradient(0, top, 0, top - len);
            g.addColorStop(0, "rgba(110,46,16,0.45)");
            g.addColorStop(1, "rgba(70,30,10,0)");
            cc.fillStyle = g;
            cc.fillRect(x, top - len, 0.002 + r() * 0.004, len);
        }
    }

    // Hands have darkened the wood around the latch side for a century.
    {
        const g = cc.createRadialGradient(KEYHOLE.x - 0.05, 1.15, 0, KEYHOLE.x - 0.05, 1.15, 0.32);
        g.addColorStop(0, "rgba(4,2,1,0.35)");
        g.addColorStop(1, "rgba(4,2,1,0)");
        cc.fillStyle = g;
        cc.fillRect(KEYHOLE.x - 0.4, 0.8, 0.8, 0.7);
    }

    // Grime rising from the floor, and splashes.
    {
        const g = cc.createLinearGradient(0, 0, 0, 0.55);
        g.addColorStop(0, "rgba(5,3,2,0.85)");
        g.addColorStop(0.35, "rgba(5,3,2,0.45)");
        g.addColorStop(1, "rgba(5,3,2,0)");
        cc.fillStyle = g;
        cc.fillRect(0, 0, D.leafW, 0.55);
        for (let k = 0; k < 160; k++) {
            const x = r() * D.leafW;
            const y = r() * r() * 0.35;
            cc.fillStyle = `rgba(4,3,2,${0.2 + r() * 0.4})`;
            cc.beginPath();
            cc.arc(x, y, 0.0015 + r() * 0.004, 0, Math.PI * 2);
            cc.fill();
        }
    }

    // Edges are darker: dirt in the reveal, and the sun never reached them.
    cc.strokeStyle = "rgba(4,2,1,0.55)";
    cc.lineWidth = 0.05;
    cc.beginPath();
    cc.moveTo(0, 0);
    cc.lineTo(0, LEAF_SPRING);
    cc.arc(LEAF_R, LEAF_SPRING, LEAF_R, Math.PI, 0, true);
    cc.lineTo(D.leafW, 0);
    cc.stroke();

    yield;
    // Scratches, most of them low on the latch side.
    for (let k = 0; k < 90; k++) {
        const latch = r() < 0.6;
        const x = latch ? D.leafW * (0.45 + r() * 0.55) : r() * D.leafW;
        const y = latch ? 0.1 + r() * 1.3 : r() * 2.2;
        const a = (r() - 0.5) * 2.2;
        const len = 0.015 + r() * r() * 0.16;
        const x1 = x + Math.cos(a) * len;
        const y1 = y + Math.sin(a) * len;
        cc.strokeStyle = `rgba(150,112,74,${0.08 + r() * 0.22})`;
        cc.lineWidth = 0.0008 + r() * 0.0014;
        cc.beginPath();
        cc.moveTo(x, y);
        cc.lineTo(x1, y1);
        cc.stroke();
        hc.strokeStyle = "rgba(0,0,0,0.5)";
        hc.lineWidth = 0.0016;
        hc.beginPath();
        hc.moveTo(x, y);
        hc.lineTo(x1, y1);
        hc.stroke();
    }

    // Chalk tallies on one door, half rubbed away.
    if (v.id === 4) {
        cc.strokeStyle = "rgba(210,200,180,0.16)";
        cc.lineWidth = 0.007;
        cc.lineCap = "round";
        for (let k = 0; k < 5; k++) {
            const x = 0.38 + k * 0.035;
            cc.beginPath();
            if (k < 4) {
                cc.moveTo(x + (r() - 0.5) * 0.01, 1.08);
                cc.lineTo(x + (r() - 0.5) * 0.01, 1.22);
            } else {
                cc.moveTo(0.36, 1.1);
                cc.lineTo(0.52, 1.2);
            }
            cc.stroke();
        }
    }

    yield;
    // Cracks along the grain. The ones that go through leak light.
    gc.fillStyle = "#000";
    gc.save();
    gc.setTransform(1, 0, 0, 1, 0, 0);
    gc.fillRect(0, 0, glow.width, glow.height);
    gc.restore();
    gc.lineCap = "round";
    gc.lineJoin = "round";
    cc.lineJoin = hc.lineJoin = "round";
    for (const c of v.cracks) {
        const pts: [number, number][] = [];
        const steps = Math.max(4, Math.floor((c.y1 - c.y0) / 0.03));
        let x = c.x;
        for (let i = 0; i <= steps; i++) {
            x += (r() - 0.5) * 0.004;
            pts.push([x, c.y0 + ((c.y1 - c.y0) * i) / steps]);
        }
        const path = (ctx: CanvasRenderingContext2D, from = 0, to = pts.length) => {
            ctx.beginPath();
            for (let i = from; i < to; i++) (i === from ? ctx.moveTo : ctx.lineTo).call(ctx, pts[i][0], pts[i][1]);
        };
        cc.strokeStyle = "rgba(3,2,1,0.95)";
        cc.lineWidth = 0.0035;
        path(cc);
        cc.stroke();
        cc.strokeStyle = "rgba(3,2,1,0.35)";
        cc.lineWidth = 0.009;
        path(cc);
        cc.stroke();
        hc.strokeStyle = "rgba(0,0,0,1)";
        hc.lineWidth = 0.004;
        path(hc);
        hc.stroke();
        if (c.leak) {
            const a = Math.floor(pts.length * (0.15 + r() * 0.3));
            const b = Math.min(pts.length, a + Math.max(2, Math.ceil(pts.length * 0.25)));
            gc.strokeStyle = "rgba(255,255,255,0.8)";
            gc.lineWidth = 0.0016;
            path(gc, a, b);
            gc.stroke();
        }
    }
    // Light through a couple of seams where the planks have shrunk apart.
    for (let k = 0; k < 1; k++) {
        const i = 1 + Math.floor(r() * (n - 1));
        const x = v.planks[i];
        const y0 = 0.15 + r() * 1.4;
        const len = 0.08 + r() * 0.16;
        const g = gc.createLinearGradient(0, y0, 0, y0 + len);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.3, "rgba(255,255,255,0.9)");
        g.addColorStop(0.7, "rgba(255,255,255,0.9)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        gc.strokeStyle = g;
        gc.lineWidth = 0.002;
        gc.beginPath();
        gc.moveTo(x, y0);
        gc.lineTo(x, y0 + len);
        gc.stroke();
    }
    // A knot fallen out of one plank: a hole with light behind it.
    if (v.id % 2 === 0) {
        const x = 0.25 + r() * 0.5;
        const y = 1.7 + r() * 0.4;
        cc.fillStyle = "rgba(3,2,1,1)";
        cc.beginPath();
        cc.ellipse(x, y, 0.009, 0.013, 0, 0, Math.PI * 2);
        cc.fill();
        cc.strokeStyle = "rgba(20,10,5,0.8)";
        cc.lineWidth = 0.006;
        cc.stroke();
        gc.fillStyle = "#fff";
        gc.beginPath();
        gc.ellipse(x, y, 0.006, 0.009, 0, 0, Math.PI * 2);
        gc.fill();
    }

    // Splintered, paler wood where a piece broke away.
    if (v.broken) {
        const right = v.broken.endsWith("r");
        const bottom = v.broken.startsWith("b");
        const cx = right ? D.leafW : 0;
        const cy = bottom ? 0 : leafTop(right ? D.leafW - 0.1 : 0.1);
        const g = cc.createRadialGradient(cx, cy, 0, cx, cy, 0.3);
        g.addColorStop(0, "rgba(120,80,48,0.35)");
        g.addColorStop(1, "rgba(120,80,48,0)");
        cc.fillStyle = g;
        cc.fillRect(cx - 0.3, cy - 0.3, 0.6, 0.6);
    }

    yield;
    const map = toTexture(color, true);
    const normalMap = (yield normalFromHeightWork(height, 2.2)) as THREE.CanvasTexture;
    return { map, normalMap, emissiveMap: toTexture(glow, true) };
}

let sprite: THREE.Texture | null = null;

/** A soft round dot for dust motes. */
export function dustSprite() {
    if (sprite) return sprite;
    const c = makeCanvas(32, 32);
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    sprite = toTexture(c, false);
    return sprite;
}
