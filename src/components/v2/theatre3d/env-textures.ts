import * as THREE from "three";
import { canvasTextureWork, normalFromHeightWork, once, putWork, readWork, rng, type Draw, type DrawWork, type Work } from "@/components/v2/theatre3d/textures";

// The corridor's surfaces, painted from code: damask wallpaper, panelling,
// floorboards, the runner, beams, plaster, cobwebs and the soft glows. Each is
// built on first use and then shared for the life of the page; painted a
// slice at a time beforehand when prepareEnvTextures() is called (textures.ts).

type Sampler = (x: number, y: number) => number;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
    const t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
};

/** Value noise that wraps every px cells across and py cells down, so textures that aren't square still tile. */
function periodic(seed: number, px: number, py: number): Sampler {
    const r = rng(seed);
    const g = new Float32Array(px * py);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        let xf = x - xi;
        let yf = y - yi;
        xf = xf * xf * (3 - 2 * xf);
        yf = yf * yf * (3 - 2 * yf);
        const x0 = ((xi % px) + px) % px;
        const y0 = ((yi % py) + py) % py;
        const x1 = (x0 + 1) % px;
        const y1 = (y0 + 1) % py;
        const a = g[y0 * px + x0];
        const b = g[y0 * px + x1];
        const c = g[y1 * px + x0];
        const d = g[y1 * px + x1];
        const top = a + (b - a) * xf;
        return top + (c + (d - c) * xf - top) * yf;
    };
}

/** Fractal noise in [0, 1] that wraps when x spans [0, px) and y spans [0, py). */
function fractal(seed: number, px: number, py: number, octaves = 4): Sampler {
    const layers = Array.from({ length: octaves }, (_, i) => periodic(seed + i * 977, px << i, py << i));
    return (x, y) => {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        let f = 1;
        for (const n of layers) {
            sum += n(x * f, y * f) * amp;
            norm += amp;
            amp *= 0.5;
            f *= 2;
        }
        return sum / norm;
    };
}

/** A field worked out on a coarse grid and read back bilinearly (wrapping): smooth noise for big textures, cheaply. */
function* coarse(gw: number, gh: number, fn: Sampler): Work<Sampler> {
    const data = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) data[y * gw + x] = fn(x, y);
        yield;
        yield;
    }
    return (x, y) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const x0 = ((xi % gw) + gw) % gw;
        const y0 = ((yi % gh) + gh) % gh;
        const x1 = (x0 + 1) % gw;
        const y1 = (y0 + 1) % gh;
        const top = data[y0 * gw + x0] + (data[y0 * gw + x1] - data[y0 * gw + x0]) * xf;
        const bot = data[y1 * gw + x0] + (data[y1 * gw + x1] - data[y1 * gw + x0]) * xf;
        return top + (bot - top) * yf;
    };
}

/**
 * A canvas to draw on and read back. Kept on the CPU (willReadFrequently), so
 * reading it doesn't stall on the GPU. normalFromHeight reads these too.
 */
function readable(w: number, h: number, draw: Draw) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d", { willReadFrequently: true })!, w, h);
    return canvas;
}

/** readable(), with drawing that's Work of its own. */
function* readableWork(w: number, h: number, draw: DrawWork): Work<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const drawing = draw(canvas.getContext("2d", { willReadFrequently: true })!, w, h);
    if (drawing) yield drawing;
    return canvas;
}

const pixels = (c: HTMLCanvasElement) => readWork(c.getContext("2d", { willReadFrequently: true })!, c.width, c.height);

/** Pixel buffers for one surface: colour, roughness and height, written in a single pass. */
class Layers {
    readonly col: Uint8ClampedArray;
    readonly rough: Uint8ClampedArray;
    readonly height: Uint8ClampedArray;
    constructor(
        readonly w: number,
        readonly h: number,
    ) {
        this.col = new Uint8ClampedArray(w * h * 4);
        this.rough = new Uint8ClampedArray(w * h * 4);
        this.height = new Uint8ClampedArray(w * h * 4);
    }
    set(i: number, r: number, g: number, b: number, rough: number, height: number, a = 255) {
        const k = i * 4;
        this.col[k] = r;
        this.col[k + 1] = g;
        this.col[k + 2] = b;
        this.col[k + 3] = a;
        const ro = rough * 255;
        this.rough[k] = this.rough[k + 1] = this.rough[k + 2] = ro;
        this.rough[k + 3] = 255;
        const he = height * 255;
        this.height[k] = this.height[k + 1] = this.height[k + 2] = he;
        this.height[k + 3] = 255;
    }
    /** Colour, roughness and a normal map (worked out at `normalSize` to keep it quick). */
    *textures(normalStrength: number, normalSize = 1): Work<Surface> {
        const { w, h } = this;
        const put = (data: Uint8ClampedArray) => (ctx: CanvasRenderingContext2D) => putWork(ctx, new ImageData(data, w, h));
        const map = (yield canvasTextureWork(w, h, put(this.col), { repeat: [1, 1] })) as THREE.CanvasTexture;
        const roughnessMap = (yield canvasTextureWork(w, h, put(this.rough), { srgb: false, repeat: [1, 1] })) as THREE.CanvasTexture;
        let hc = (yield readableWork(w, h, put(this.height))) as HTMLCanvasElement;
        if (normalSize < 1) {
            const full = hc;
            hc = readable(Math.round(w * normalSize), Math.round(h * normalSize), (ctx, cw, ch) => ctx.drawImage(full, 0, 0, cw, ch));
            yield;
        }
        const normalMap = (yield normalFromHeightWork(hc, normalStrength, [1, 1])) as THREE.CanvasTexture;
        return { map, roughnessMap, normalMap };
    }
}

export interface Surface {
    map: THREE.Texture;
    roughnessMap: THREE.Texture;
    normalMap: THREE.Texture;
}

/* ------------------------------------------------------------ wallpaper */

// One damask motif, mirrored about its centre: a vase-shaped medallion with a
// palmette inside, C-scrolls and flame leaves to the sides, leaves at its foot.
function* damask(ctx: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number): Work<void> {
    for (const flip of [1, -1]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sx * flip, sy);
        ctx.beginPath();
        ctx.moveTo(-0.01, -0.98);
        ctx.bezierCurveTo(0.1, -0.8, 0.16, -0.62, 0.3, -0.5);
        ctx.bezierCurveTo(0.48, -0.36, 0.6, -0.12, 0.56, 0.14);
        ctx.bezierCurveTo(0.52, 0.4, 0.3, 0.62, 0.1, 0.7);
        ctx.bezierCurveTo(0.05, 0.72, 0.02, 0.76, -0.01, 0.8);
        ctx.closePath();
        ctx.moveTo(-0.01, -0.62);
        ctx.bezierCurveTo(0.12, -0.45, 0.36, -0.2, 0.36, 0.1);
        ctx.bezierCurveTo(0.36, 0.34, 0.18, 0.5, -0.01, 0.54);
        ctx.closePath();
        ctx.fill("evenodd");
        ctx.beginPath();
        ctx.moveTo(-0.01, -0.42);
        ctx.bezierCurveTo(0.08, -0.25, 0.09, 0.05, -0.01, 0.4);
        ctx.closePath();
        ctx.moveTo(0.04, 0.38);
        ctx.bezierCurveTo(0.1, 0.1, 0.2, -0.12, 0.3, -0.04);
        ctx.bezierCurveTo(0.26, 0.1, 0.18, 0.28, 0.04, 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0.2, 0.36, 0.035, 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 0.075;
        ctx.beginPath();
        ctx.moveTo(0.48, 0.42);
        ctx.bezierCurveTo(0.72, 0.48, 0.93, 0.3, 0.9, 0.02);
        ctx.bezierCurveTo(0.88, -0.2, 0.7, -0.3, 0.62, -0.18);
        ctx.bezierCurveTo(0.56, -0.08, 0.66, 0.02, 0.74, -0.06);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.9, -0.08);
        ctx.bezierCurveTo(1.0, -0.36, 0.88, -0.6, 0.66, -0.74);
        ctx.bezierCurveTo(0.74, -0.52, 0.8, -0.3, 0.84, -0.12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-0.01, 0.76);
        ctx.bezierCurveTo(0.15, 0.78, 0.36, 0.84, 0.52, 0.98);
        ctx.bezierCurveTo(0.3, 0.97, 0.14, 0.92, -0.01, 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-0.01, -0.97);
        ctx.bezierCurveTo(0.07, -1.02, 0.08, -1.06, -0.01, -1.12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        yield;
    }
}

/** How much each strip's seam has peeled. */
const SEAM_PEEL = [1, 0.25, 0.85, 0, 0.6, 0.4];

// Faded oxblood damask, 3.2 m wide by 3.2 m tall (chair rail to ceiling, the
// top of the canvas is the ceiling). Tiles across. Water damage creeps down
// from the ceiling, the paper has peeled at a few seams, and there's mould.
const wallpaper = once(function* (): Work<Surface> {
    const W = 1024;
    const H = 1024;
    const strips = 6;
    const cw = W / strips;
    const ch = H * (0.62 / 3.2);
    // The motif, drawn once and stamped across the paper in a half-drop repeat.
    const sx = cw * 0.46;
    const sy = ch * 0.47;
    const sw = Math.ceil(sx * 2.1) + 4;
    const sh = Math.ceil(sy * 2.3) + 4;
    const oy = Math.ceil(sy * 1.18);
    const sprite = (yield readableWork(sw, sh, (ctx) => {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#fff";
        ctx.lineCap = "round";
        return damask(ctx, sw / 2, oy, sx, sy);
    })) as HTMLCanvasElement;
    const motif = readable(W, H, (ctx) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        for (let c = -1; c <= strips; c++) {
            for (let row = -2; row <= Math.ceil(H / ch) + 1; row++) {
                const cx = (c + 0.5) * cw;
                const cy = (row + 0.5 + (((c % 2) + 2) % 2) * 0.5) * ch;
                ctx.drawImage(sprite, Math.round(cx - sw / 2), Math.round(cy - oy));
            }
        }
    });
    const mask = (yield pixels(motif)) as Uint8ClampedArray;

    // Drips and mould, painted straight into fields (wrapping across).
    const r = rng(311);
    const drips = new Float32Array(W * H);
    const mould = new Float32Array(W * H);
    for (let i = 0; i < 52; i++) {
        let x = r() * W;
        const y0 = Math.floor(H * (0.06 + r() * 0.3));
        const len = H * (0.06 + r() * r() * 0.5);
        const a = (30 + r() * 80) / 255;
        const half = (1 + r() * 3.5) / 2;
        for (let y = y0; y < Math.min(H, y0 + len); y++) {
            if ((y - y0) % 12 === 0) x += (r() - 0.5) * 1.8;
            const v = a * (1 - (y - y0) / len);
            for (let dx = Math.floor(-half - 1); dx <= Math.ceil(half + 1); dx++) {
                const cover = clamp01(half + 0.5 - Math.abs(dx + (Math.floor(x) - x)));
                const k = y * W + ((((Math.floor(x) + dx) % W) + W) % W);
                drips[k] = Math.max(drips[k], v * cover);
            }
        }
    }
    for (let k = 0; k < 8; k++) {
        const cx = r() * W;
        const cy = H * r() * (k < 5 ? 0.35 : 1);
        const spread = 18 + r() * 46;
        for (let i = 0; i < 110; i++) {
            const ang = r() * Math.PI * 2;
            const dist = spread * Math.sqrt(-2 * Math.log(r() + 1e-6)) * 0.5;
            const x = cx + Math.cos(ang) * dist;
            const y = cy + Math.sin(ang) * dist * 0.7;
            const rad = 0.5 + r() * 1.7;
            const v = (50 + r() * 110) / 255;
            for (let py = Math.floor(y - rad - 1); py <= Math.ceil(y + rad + 1); py++) {
                if (py < 0 || py >= H) continue;
                for (let px = Math.floor(x - rad - 1); px <= Math.ceil(x + rad + 1); px++) {
                    const cover = clamp01(rad + 0.5 - Math.hypot(px - x, py - y));
                    const k2 = py * W + (((px % W) + W) % W);
                    mould[k2] = Math.min(1, mould[k2] + v * cover);
                }
            }
        }
    }

    const G = 256;
    const gs = W / G;
    const fadeN = (yield coarse(G, G, ((n) => (x, y) => n((x / G) * 4, (y / G) * 4))(fractal(21, 4, 4, 3)))) as Sampler;
    const stainN = (yield coarse(G, G, ((n) => (x, y) => n((x / G) * 6, (y / G) * 6))(fractal(22, 6, 6, 4)))) as Sampler;
    const wetN = (yield coarse(G, G, ((n) => (x, y) => n((x / G) * 5, (y / G) * 5))(fractal(23, 5, 5, 4)))) as Sampler;
    const peelN = (yield coarse(G, G, ((n) => (x, y) => n((x / G) * 7, (y / G) * 7))(fractal(24, 7, 7, 4)))) as Sampler;
    const h1 = periodic(25, 128, 128);
    yield;
    const h2 = periodic(26, 256, 256);
    yield;
    const tearN = fractal(27, 16, 9, 3);
    yield;

    const out = new Layers(W, H);
    for (let y = 0; y < H; y++) {
        const vy = y / H; // 0 at the ceiling, 1 at the chair rail
        const gy = y / gs;
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const i4 = i * 4;
            const gx = x / gs;
            const m = mask[i4] / 255;
            const ml = mask[(y * W + ((x + W - 1) % W)) * 4];
            const mr = mask[(y * W + ((x + 1) % W)) * 4];
            const mu = y > 0 ? mask[i4 - W * 4] : mask[i4];
            const md = y < H - 1 ? mask[i4 + W * 4] : mask[i4];
            const edge = Math.min(1, (Math.abs(mr - ml) + Math.abs(md - mu)) / 255);
            const hi = h1((x / W) * 128, (y / H) * 128);
            const hi2 = h2((x / W) * 256, (y / H) * 256);

            // Tone on tone: a satin ground, a velvet flock, a fine thread outline.
            let R = lerp(66, 47, m);
            let Gc = lerp(24, 15, m);
            let B = lerp(21, 15, m);
            const e = edge * 0.05;
            R = lerp(R, 112, e);
            Gc = lerp(Gc, 66, e);
            B = lerp(B, 42, e);
            const weave = 1 + 0.04 * Math.sin((x + y) * 1.7) * (1 - m);
            let rough = lerp(0.58, 0.92, m);
            let height = 0.5 + m * 0.07;

            // Faded by decades of light, and brown blotches.
            const fade = smoothstep(0.42, 0.8, fadeN(gx, gy)) * 0.5;
            R = lerp(R, 108, fade);
            Gc = lerp(Gc, 70, fade);
            B = lerp(B, 56, fade);
            const st = smoothstep(0.6, 0.78, stainN(gx, gy) + hi * 0.05) * 0.7;
            R = lerp(R, 38, st);
            Gc = lerp(Gc, 22, st);
            B = lerp(B, 14, st);

            // The paper strips: a hairline gap at each seam, the edges lifting.
            const xs = x % cw;
            const ds = Math.min(xs, cw - xs);
            const seam = ds < 0.9 ? 1 : 0;
            const lift = 1 - smoothstep(0, 3.5, ds);
            R = lerp(R, 26, seam * 0.45) + lift * 5;
            Gc = lerp(Gc, 14, seam * 0.45) + lift * 3;
            B = lerp(B, 12, seam * 0.45) + lift * 2;
            height += lift * 0.05 - seam * 0.12;

            // Water from the ceiling: a bleached, yellowed zone with dark tide lines.
            const wet = wetN(gx, gy) * 0.85 + (1 - vy) * 0.62 + (hi - 0.5) * 0.06;
            const T = 0.93;
            if (wet > T) {
                const k = Math.min(1, (wet - T) * 6);
                R = lerp(R, 104, 0.35 * k);
                Gc = lerp(Gc, 74, 0.35 * k);
                B = lerp(B, 48, 0.35 * k);
                rough = lerp(rough, 0.78, 0.6);
            }
            const ring = (1 - smoothstep(0, 0.028, Math.abs(wet - T))) * 0.42 + (wet > T ? (1 - smoothstep(0, 0.018, Math.abs(wet - T - 0.07))) * 0.25 : 0);
            R = lerp(R, 30, ring);
            Gc = lerp(Gc, 17, ring);
            B = lerp(B, 10, ring);

            // Drips running down from the stains.
            const drip = drips[i];
            R = lerp(R, 36, drip * 0.6);
            Gc = lerp(Gc, 22, drip * 0.6);
            B = lerp(B, 13, drip * 0.6);
            rough -= drip * 0.12;

            // Mould.
            const mo = mould[i];
            R = lerp(R, 18, mo * 0.85);
            Gc = lerp(Gc, 17, mo * 0.85);
            B = lerp(B, 11, mo * 0.85);

            // Peeling: the paper has lifted away from some seams, mostly up
            // high, tearing back to older paper and plaster underneath, with
            // a pale torn edge. Now and then a bigger patch has come off.
            const seamK = Math.round(x / cw) % strips;
            const tear = tearN(seamK * 2.3 + 0.5, vy * 9);
            const act = smoothstep(0.46, 0.72, tear) * SEAM_PEEL[seamK];
            const reach = act * (12 + 64 * (1 - vy) * (1 - vy) + (hi - 0.5) * 16 + (hi2 - 0.5) * 6) - (1 - act) * 12;
            const blob = (peelN(gx, gy) + (1 - vy) * 0.07 + (hi - 0.5) * 0.08 - 0.9) * 400;
            const p = Math.max(reach - ds, blob);
            if (p > 1.5) {
                const deep = smoothstep(6, 16, p);
                const pl = (0.8 + 0.35 * hi2) * (1 - (1 - smoothstep(1.5, 5, p)) * 0.45);
                R = lerp(84, 58, deep) * pl;
                Gc = lerp(68, 50, deep) * pl;
                B = lerp(52, 42, deep) * pl;
                rough = 0.95;
                height = 0.3 + hi * 0.1 - deep * 0.08;
            } else if (p > -1.2) {
                R = 104;
                Gc = 90;
                B = 70;
                rough = 0.88;
                height = 0.78;
            }

            // Grime gathers toward the ceiling.
            const grime = (1 - 0.32 * (1 - vy) * (1 - vy)) * (0.94 + 0.12 * hi2) * weave;
            out.set(i, R * grime, Gc * grime, B * grime, clamp01(rough), clamp01(height));
        }
        yield;
    }
    return (yield out.textures(1.6, 0.5)) as Surface;
});

/* ---------------------------------------------------------------- wood */

// Dark walnut for the panelling: vertical grain, 1 m square, tiles both ways.
// Rubbed pale and dull where hands and shoulders have worn the varnish.
const wood = once(function* (): Work<Surface> {
    const S = 512;
    const warp = fractal(41, 3, 2, 3);
    yield;
    const drift = fractal(45, 8, 1, 2);
    yield;
    const broad = fractal(42, 24, 2, 2);
    yield;
    const pores = fractal(46, 128, 6, 2);
    yield;
    const wear = fractal(43, 5, 5, 3);
    yield;
    const out = new Layers(S, S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const u = x / S;
            const v = y / S;
            const ring = 0.5 + 0.5 * Math.sin((u * 34 + warp(u * 3, v * 2) * 1.3 + drift(u * 8, v) * 0.35) * Math.PI * 2);
            const line = Math.pow(ring, 12);
            const b = broad(u * 24, v * 2);
            const pore = pores(u * 128, v * 6);
            const tone = 0.78 + 0.36 * b + 0.12 * (pore - 0.5) - 0.22 * line;
            const wr = smoothstep(0.68, 0.84, wear(u * 5, v * 5));
            const R = lerp(66 * tone, 92, wr * 0.25);
            const G = lerp(39 * tone, 60, wr * 0.25);
            const B = lerp(25 * tone, 39, wr * 0.25);
            out.set(y * S + x, R, G, B, clamp01(0.4 + 0.12 * line + wr * 0.3 + (1 - b) * 0.06), 0.5 - line * 0.2 + pore * 0.1 - wr * 0.06);
        }
        yield;
    }
    return (yield out.textures(1.4)) as Surface;
});

/* ---------------------------------------------------------------- floor */

// Floorboards, 4 m along by 1.6 m across (eight boards), tiling both ways:
// dark polished boards, staggered joints and nails, scratches and dull wear.
const floor = once(function* (): Work<Surface> {
    const W = 1024;
    const H = 512;
    const rows = 8;
    const bh = H / rows;
    const r = rng(61);
    const cuts: number[][] = [];
    const tones: number[][] = [];
    for (let j = 0; j < rows; j++) {
        const n = r() < 0.5 ? 2 : 3;
        const o = r() * W;
        const c: number[] = [];
        for (let k = 0; k < n; k++) c.push((o + (k + 0.15 + r() * 0.7) * (W / n)) % W);
        c.sort((a, b) => a - b);
        cuts.push(c);
        tones.push(c.map(() => 0.62 + r() * 0.62));
    }
    const marks = readable(W, H, (ctx) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let i = 0; i < 420; i++) {
            const x = r() * W;
            const y = r() * H;
            const len = 8 + r() * r() * 160;
            const ang = (r() - 0.5) * (r() < 0.8 ? 0.25 : 2.5);
            ctx.strokeStyle = `rgb(${Math.round(40 + r() * 120)},0,0)`;
            ctx.lineWidth = 0.6 + r() * 1.2;
            for (const ox of [-W, 0, W]) {
                ctx.beginPath();
                ctx.moveTo(x + ox, y);
                ctx.lineTo(x + ox + Math.cos(ang) * len, y + Math.sin(ang) * len);
                ctx.stroke();
            }
        }
        // old water rings
        for (let i = 0; i < 5; i++) {
            const x = r() * W;
            const y = r() * H;
            const rad = 10 + r() * 26;
            ctx.strokeStyle = `rgb(0,${Math.round(60 + r() * 80)},0)`;
            ctx.lineWidth = 1.5 + r() * 2;
            for (const ox of [-W, 0, W]) {
                ctx.beginPath();
                ctx.ellipse(x + ox, y, rad, rad * (0.8 + r() * 0.3), r() * 3, 0.3, Math.PI * 2 - r());
                ctx.stroke();
            }
        }
    });
    const mk = (yield pixels(marks)) as Uint8ClampedArray;
    const grain = fractal(62, 6, 64, 3);
    yield;
    const warp = fractal(63, 4, 8, 2);
    yield;
    const wearN = (yield coarse(256, 128, ((n) => (x, y) => n((x / 256) * 5, (y / 128) * 2))(fractal(64, 5, 2, 3)))) as Sampler;
    const fine = periodic(65, 512, 128);
    yield;
    const out = new Layers(W, H);
    for (let y = 0; y < H; y++) {
        const j = Math.floor(y / bh);
        const yy = y - j * bh;
        const c = cuts[j];
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            let id = 0;
            let cd = W;
            for (let k = 0; k < c.length; k++) {
                if (c[k] <= x) id = k + 1;
                const dd = Math.abs(x - c[k]);
                cd = Math.min(cd, dd, W - dd);
            }
            id %= c.length;
            const seed = j * 7 + id * 3;
            const gx = x / W;
            const gy = y / H;
            const g1 = grain(gx * 6, gy * 64 + seed * 1.7);
            const ring = 0.5 + 0.5 * Math.sin((gy * 72 + warp(gx * 4, gy * 8 + seed) * 2.2 + seed * 0.37) * Math.PI * 2);
            const f = fine((x / W) * 512, (y / H) * 128);
            const tone = tones[j][id] * (0.74 + 0.42 * g1 + 0.08 * f) * (1 - 0.18 * Math.pow(ring, 10));
            // some boards redder, some greyer
            const hue = (seed * 0.618) % 1;
            let R = 64 * tone * (0.94 + hue * 0.12);
            let G = 39 * tone;
            let B = 24 * tone * (1.06 - hue * 0.12);
            let rough = 0.46 + 0.08 * (1 - g1);
            const edgeDist = Math.min(yy, bh - yy, cd);
            let height = 0.62 - 0.03 * (1 - smoothstep(0, 10, Math.min(yy, bh - yy))) + (g1 - 0.5) * 0.04;
            // worn bevels on the board edges
            const ew = 1 - smoothstep(1.5, 5, edgeDist);
            R = lerp(R, 74, ew * 0.15);
            G = lerp(G, 50, ew * 0.15);
            B = lerp(B, 33, ew * 0.15);
            rough += ew * 0.2;
            // dull, walked patches
            const wr = smoothstep(0.55, 0.75, wearN(x / 4, y / 4));
            R = lerp(R, 72, wr * 0.35);
            G = lerp(G, 50, wr * 0.35);
            B = lerp(B, 36, wr * 0.35);
            rough += wr * 0.22;
            // scratches and rings
            const sc = mk[i * 4] / 255;
            R = lerp(R, 92, sc * 0.4);
            G = lerp(G, 66, sc * 0.4);
            B = lerp(B, 46, sc * 0.4);
            rough += sc * 0.3;
            height -= sc * 0.06;
            const rg = mk[i * 4 + 1] / 255;
            R = lerp(R, 22, rg * 0.5);
            G = lerp(G, 13, rg * 0.5);
            B = lerp(B, 8, rg * 0.5);
            // nails near each joint
            const nail = Math.hypot(cd - 7, Math.min(Math.abs(yy - 12), Math.abs(yy - (bh - 12)))) < 1.5;
            if (nail) {
                R *= 0.6;
                G *= 0.6;
                B *= 0.62;
                rough = 0.7;
            }
            // the gaps between boards
            if (yy < 1.2 || yy > bh - 1.2 || cd < 0.9) {
                R = 16;
                G = 10;
                B = 7;
                rough = 0.95;
                height = 0.05;
            }
            out.set(i, R, G, B, clamp01(rough), clamp01(height));
        }
        yield;
    }
    return (yield out.textures(0.8)) as Surface;
});

/* --------------------------------------------------------------- runner */

// The theatre runner, 1.24 m across (not tiled) by 2.4 m along (tiled): deep
// red pile, a faded gold border of lozenges, a faint trellis in the field,
// worn to the weave down the middle, stained, frayed at the edges.
const carpet = once(function* (): Work<THREE.Texture> {
    const W = 512;
    const H = 1024;
    const pile = periodic(81, 256, 512);
    yield;
    const fadeN = fractal(82, 3, 6, 3);
    yield;
    const wearN = fractal(83, 2, 8, 4);
    yield;
    const stainN = fractal(84, 4, 8, 3);
    yield;
    const fray = periodic(85, 2, 256);
    yield;
    const col = new Uint8ClampedArray(W * H * 4);
    const RED = [112, 18, 22];
    const DEEP = [74, 11, 15];
    const GOLD = [158, 120, 60];
    const BIND = [54, 16, 14];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const a = x / (W - 1);
            const e = Math.min(a, 1 - a) * 1.24;
            let c = RED;
            if (e < 0.012) c = BIND;
            else if (e < 0.03) c = GOLD;
            else if (e < 0.038) c = DEEP;
            else if (e < 0.122) {
                const bx = (e - 0.038) / 0.084;
                const by = (y / (H / 20)) % 1;
                const dmd = Math.abs(bx - 0.5) * 2 + Math.abs(by - 0.5) * 2;
                const dot = Math.hypot(bx - 0.5, (by > 0.5 ? by - 1 : by) * 1.4) < 0.12;
                c = dmd < 0.24 ? GOLD : dmd < 0.5 ? DEEP : dmd < 0.78 ? GOLD : dot ? GOLD : DEEP;
            } else if (e < 0.132) c = GOLD;
            else {
                const fx = ((e - 0.132) / 0.16) % 1;
                const fy = (y / (H / 12)) % 1;
                const t1 = Math.abs(((fx + fy) % 1) - 0.5);
                const t2 = Math.abs(((fx - fy + 2) % 1) - 0.5);
                const cd = Math.hypot(fx - 0.5, fy - 0.5);
                c = t1 < 0.025 || t2 < 0.025 || (cd < 0.11 && cd > 0.06) ? DEEP : RED;
            }
            const pn = 0.86 + 0.26 * pile(x / 2, y / 2);
            let R = c[0] * pn;
            let G = c[1] * pn;
            let B = c[2] * pn;
            const fd = smoothstep(0.35, 0.8, fadeN(a * 3, (y / H) * 6)) * 0.35;
            R = lerp(R, 128, fd);
            G = lerp(G, 72, fd);
            B = lerp(B, 62, fd);
            // threadbare down the middle: the jute weave shows through
            // worn thin down the middle: the pile flattens and browns, and in
            // places the jute weave shows through
            const centre = 1 - smoothstep(0.05, 0.22, Math.abs(a - 0.5));
            const worn = smoothstep(0.42, 0.78, wearN(a * 2, (y / H) * 8) * 0.75 + centre * 0.32);
            R = lerp(R, 96, worn * 0.45);
            G = lerp(G, 44, worn * 0.45);
            B = lerp(B, 36, worn * 0.45);
            const bare = smoothstep(0.62, 0.8, wearN(a * 2 + 0.5, (y / H) * 8) * 0.7 + centre * 0.3);
            const weave = (Math.sin(y * 1.9) > 0 ? 1 : 0.8) * (Math.sin(x * 2.3) > 0.6 ? 0.85 : 1);
            R = lerp(R, 86 * weave, bare * 0.75);
            G = lerp(G, 64 * weave, bare * 0.75);
            B = lerp(B, 46 * weave, bare * 0.75);
            const st = smoothstep(0.64, 0.78, stainN(a * 4, (y / H) * 8)) * 0.55;
            R = lerp(R, 36, st);
            G = lerp(G, 14, st);
            B = lerp(B, 12, st);
            // frayed edges: the binding has worn through in bites
            const bite = fray(a < 0.5 ? 0.25 : 1.25, (y / H) * 256);
            const depth = 0.003 + Math.pow(bite, 3) * 0.022;
            const k = (y * W + x) * 4;
            col[k] = R;
            col[k + 1] = G;
            col[k + 2] = B;
            col[k + 3] = e < depth ? 0 : 255;
        }
        yield;
    }
    const tex = (yield canvasTextureWork(W, H, (ctx) => putWork(ctx, new ImageData(col, W, H)), { repeat: [1, 1] })) as THREE.CanvasTexture;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    return tex;
});

// Fringe at the runner's ends: cream threads hanging from the binding, about
// 0.3 m of fringe across the texture. The top of the canvas is the carpet.
const fringe = once(function* () {
    return (yield canvasTextureWork(
        256,
        64,
        (ctx, w, h) => {
            const r = rng(91);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "rgb(118,86,58)";
            ctx.fillRect(0, 0, w, 7);
            ctx.lineCap = "round";
            for (let x = 1; x < w; x += 3) {
                const len = 34 + r() * 26;
                const tone = 0.75 + r() * 0.35;
                ctx.strokeStyle = `rgb(${Math.round(170 * tone)},${Math.round(144 * tone)},${Math.round(104 * tone)})`;
                ctx.lineWidth = 1.4 + r() * 0.8;
                ctx.beginPath();
                ctx.moveTo(x, 4);
                ctx.quadraticCurveTo(x + (r() - 0.5) * 4, len * 0.5, x + (r() - 0.5) * 7, len);
                ctx.stroke();
            }
        },
        { repeat: [1, 1] },
    )) as THREE.CanvasTexture;
});

/* ---------------------------------------------------------------- beams */

// Rough-hewn beams, 2 m along by 1 m around: grain, adze scallops, long checks.
const beam = once(function* (): Work<Surface> {
    const W = 512;
    const H = 256;
    const r = rng(101);
    const checks = readable(W, H, (ctx) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#fff";
        ctx.lineCap = "round";
        for (let i = 0; i < 16; i++) {
            const x = r() * W;
            const y = r() * H;
            const len = 60 + r() * 300;
            const pts: [number, number][] = [];
            for (let t = 0; t <= len; t += 10) pts.push([x + t, y + Math.sin(t * 0.03 + i) * 2 + (r() - 0.5) * 1.5]);
            ctx.lineWidth = 0.8 + r() * 2.2;
            for (const ox of [-W, 0, W]) {
                ctx.beginPath();
                pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py) : ctx.moveTo(px + ox, py)));
                ctx.stroke();
            }
        }
    });
    const ck = (yield pixels(checks)) as Uint8ClampedArray;
    const grain = fractal(102, 4, 32, 3);
    yield;
    const warp = fractal(103, 3, 3, 2);
    yield;
    const out = new Layers(W, H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            const gx = x / W;
            const gy = y / H;
            const g = grain(gx * 4, gy * 32);
            const adze = 0.5 + 0.5 * Math.sin((gx * 16 + warp(gx * 3, gy * 3) * 1.5) * Math.PI * 2);
            const c = ck[i * 4] / 255;
            const tone = (0.74 + 0.36 * g) * (0.92 + 0.08 * adze) * (1 - c * 0.75);
            out.set(i, 42 * tone, 27 * tone, 18 * tone, 0.86, clamp01(0.55 + adze * 0.14 + g * 0.1 - c * 0.5));
        }
        yield;
    }
    return (yield out.textures(2.4)) as Surface;
});

/* -------------------------------------------------------------- plaster */

// Sooty ceiling plaster between the beams, 2 m square, with cracks and stains.
const plaster = once(function* (): Work<Surface> {
    const S = 512;
    const r = rng(121);
    const cracks = readable(S, S, (ctx) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, S, S);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 0.7;
        for (let i = 0; i < 6; i++) {
            let x = r() * S;
            let y = r() * S;
            let a = r() * Math.PI * 2;
            const pts: [number, number][] = [[x, y]];
            for (let k = 0; k < 40; k++) {
                a += (r() - 0.5) * 1.3;
                x += Math.cos(a) * 4;
                y += Math.sin(a) * 4;
                pts.push([x, y]);
            }
            for (const ox of [-S, 0, S]) {
                for (const oy of [-S, 0, S]) {
                    ctx.beginPath();
                    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
                    ctx.stroke();
                }
            }
        }
    });
    const ck = (yield pixels(cracks)) as Uint8ClampedArray;
    const n1 = fractal(122, 6, 6, 5);
    yield;
    const stain = fractal(123, 3, 3, 3);
    yield;
    const out = new Layers(S, S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const n = n1((x / S) * 6, (y / S) * 6);
            const s = stain((x / S) * 3, (y / S) * 3);
            const c = ck[i * 4] / 255;
            const ring = 1 - smoothstep(0, 0.02, Math.abs(s - 0.62));
            const tone = (0.72 + 0.45 * n) * (1 - c * 0.45) * (1 - ring * 0.3) * (s > 0.62 ? 1.1 : 1);
            out.set(i, 36 * tone, 30 * tone, 25 * tone, 0.95, clamp01(0.5 + n * 0.25 - c * 0.25));
        }
        yield;
    }
    return (yield out.textures(2)) as Surface;
});

/* ------------------------------------------------------- little things */

// A cobweb strung across a corner: threads radiating from the corner at the
// canvas's top left, sagging spirals, a few broken strands. White on clear.
const cobweb = once(function* () {
    return (yield canvasTextureWork(
        256,
        256,
        (ctx, w) => {
            const r = rng(131);
            ctx.clearRect(0, 0, w, w);
            ctx.lineCap = "round";
            const spokes = 10;
            const angs = Array.from({ length: spokes }, (_, i) => (i / (spokes - 1)) * (Math.PI / 2) + (r() - 0.5) * 0.08);
            const reach = angs.map(() => 200 + r() * 60);
            ctx.strokeStyle = "rgba(235,230,220,0.75)";
            ctx.lineWidth = 1.1;
            angs.forEach((a, i) => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(a) * reach[i], Math.sin(a) * reach[i]);
                ctx.stroke();
            });
            ctx.lineWidth = 0.8;
            for (let k = 1; k < 16; k++) {
                const rad = 12 * Math.pow(k, 1.12);
                ctx.strokeStyle = `rgba(235,230,220,${0.35 + r() * 0.35})`;
                for (let i = 0; i < spokes - 1; i++) {
                    if (r() < 0.12 || rad > Math.min(reach[i], reach[i + 1])) continue;
                    const a0 = angs[i];
                    const a1 = angs[i + 1];
                    const am = (a0 + a1) / 2;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a0) * rad, Math.sin(a0) * rad);
                    ctx.quadraticCurveTo(Math.cos(am) * rad * 0.9, Math.sin(am) * rad * 0.9, Math.cos(a1) * rad, Math.sin(a1) * rad);
                    ctx.stroke();
                }
            }
            // dust caught near the corner
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
            g.addColorStop(0, "rgba(220,214,200,0.35)");
            g.addColorStop(1, "rgba(220,214,200,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 90, 90);
        },
        { repeat: [1, 1] },
    )) as THREE.CanvasTexture;
});

// A blackened old canvas: near-black varnish with craquelure and the faint
// ghost of a sitter. 0.75 by 1 (portrait); colour, roughness and normals.
const painting = once(function* (): Work<Surface> {
    const W = 256;
    const H = 320;
    const r = rng(141);
    const cracks: [number, number][][] = [];
    for (let i = 0; i < 260; i++) {
        let x = r() * W;
        let y = r() * H;
        let a = r() * Math.PI * 2;
        const pts: [number, number][] = [[x, y]];
        for (let k = 0; k < 3 + r() * 4; k++) {
            a += (r() - 0.5) * 1.4;
            x += Math.cos(a) * 6;
            y += Math.sin(a) * 6;
            pts.push([x, y]);
        }
        cracks.push(pts);
    }
    const drawCracks = (ctx: CanvasRenderingContext2D, style: string, width: number) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        for (const pts of cracks) {
            ctx.beginPath();
            pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
            ctx.stroke();
        }
    };
    const map = (yield canvasTextureWork(W, H, (ctx) => {
        ctx.fillStyle = "rgb(15,10,8)";
        ctx.fillRect(0, 0, W, H);
        const ghost = (x: number, y: number, rx: number, ry: number, a: number) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(rx, ry);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
            g.addColorStop(0, `rgba(58,44,32,${a})`);
            g.addColorStop(1, "rgba(58,44,32,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        };
        ghost(W * 0.5, H * 0.36, 42, 54, 0.5);
        ghost(W * 0.5, H * 0.86, 120, 80, 0.35);
        drawCracks(ctx, "rgba(4,3,2,0.7)", 0.8);
        const sheen = ctx.createLinearGradient(0, 0, W, H);
        sheen.addColorStop(0, "rgba(60,40,24,0.12)");
        sheen.addColorStop(0.5, "rgba(0,0,0,0)");
        sheen.addColorStop(1, "rgba(40,26,16,0.1)");
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, W, H);
    })) as THREE.CanvasTexture;
    const roughnessMap = (yield canvasTextureWork(
        W,
        H,
        (ctx) => {
            ctx.fillStyle = "rgb(140,140,140)";
            ctx.fillRect(0, 0, W, H);
            drawCracks(ctx, "rgb(180,180,180)", 1.2);
        },
        { srgb: false },
    )) as THREE.CanvasTexture;
    const normalMap = (yield normalFromHeightWork(
        readable(W, H, (ctx) => {
            ctx.fillStyle = "rgb(160,160,160)";
            ctx.fillRect(0, 0, W, H);
            drawCracks(ctx, "rgb(110,110,110)", 1.0);
        }),
        0.8,
    )) as THREE.CanvasTexture;
    return { map, roughnessMap, normalMap };
});

// A rusty iron finish for the sconces and the door hardware, tiling.
const iron = once(function* () {
    const S = 128;
    const n = fractal(151, 4, 4, 3);
    yield;
    const speck = periodic(152, 64, 64);
    yield;
    return (yield canvasTextureWork(
        S,
        S,
        function* (ctx) {
            const img = ctx.createImageData(S, S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const rust = smoothstep(0.5, 0.72, n((x / S) * 4, (y / S) * 4) + (speck((x / S) * 64, (y / S) * 64) - 0.5) * 0.25);
                    const k = (y * S + x) * 4;
                    img.data[k] = lerp(66, 128, rust);
                    img.data[k + 1] = lerp(62, 70, rust);
                    img.data[k + 2] = lerp(60, 40, rust);
                    img.data[k + 3] = 255;
                }
                yield;
            }
            yield putWork(ctx, img);
        },
        { repeat: [1, 1] },
    )) as THREE.CanvasTexture;
});

/** Tarnish for the old gilt frames: mostly bright, with dark blooms and specks (multiplies the gold). */
const tarnish = once(function* () {
    const S = 128;
    const n = fractal(171, 4, 4, 4);
    yield;
    const speck = periodic(172, 128, 128);
    yield;
    return (yield canvasTextureWork(
        S,
        S,
        function* (ctx) {
            const img = ctx.createImageData(S, S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const dark = smoothstep(0.42, 0.8, n((x / S) * 4, (y / S) * 4)) * 0.55 + (speck(x, y) - 0.5) * 0.12;
                    const v = 225 * (1 - clamp01(dark));
                    const k = (y * S + x) * 4;
                    img.data[k] = v;
                    img.data[k + 1] = v * 0.97;
                    img.data[k + 2] = v * 0.92;
                    img.data[k + 3] = 255;
                }
                yield;
            }
            yield putWork(ctx, img);
        },
        { repeat: [1, 1] },
    )) as THREE.CanvasTexture;
});

/** A soft round glow, white with the falloff in the grey level (for alpha maps). */
const glow = once(function* () {
    return (yield canvasTextureWork(
        128,
        128,
        (ctx, w) => {
            const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
            const stops: [number, number][] = [
                [0, 255],
                [0.12, 190],
                [0.3, 90],
                [0.5, 34],
                [0.72, 9],
                [1, 0],
            ];
            for (const [at, v] of stops) g.addColorStop(at, `rgb(${v},${v},${v})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, w);
        },
        { srgb: false },
    )) as THREE.CanvasTexture;
});

/**
 * Shapes for the grime decals, as grey levels: the left square is a soft round
 * blob, the right square fades from solid at the top to nothing at the bottom.
 */
const decal = once(function* () {
    return (yield canvasTextureWork(
        128,
        64,
        (ctx) => {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, 128, 64);
            const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, "rgb(255,255,255)");
            g.addColorStop(0.35, "rgb(190,190,190)");
            g.addColorStop(0.7, "rgb(60,60,60)");
            g.addColorStop(1, "rgb(0,0,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 64, 64);
            const l = ctx.createLinearGradient(0, 0, 0, 64);
            l.addColorStop(0, "rgb(255,255,255)");
            l.addColorStop(0.4, "rgb(120,120,120)");
            l.addColorStop(1, "rgb(0,0,0)");
            ctx.fillStyle = l;
            ctx.fillRect(66, 0, 62, 64);
        },
        { srgb: false },
    )) as THREE.CanvasTexture;
});

/** Soft drifting wisps for the ground fog, tiling, as grey levels. */
const fog = once(function* () {
    const S = 256;
    const n = fractal(161, 4, 4, 4);
    yield;
    return (yield canvasTextureWork(
        S,
        S,
        function* (ctx) {
            const img = ctx.createImageData(S, S);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const v = smoothstep(0.3, 0.78, n((x / S) * 4, (y / S) * 4)) * 255;
                    const k = (y * S + x) * 4;
                    img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
                    img.data[k + 3] = 255;
                }
                yield;
            }
            yield putWork(ctx, img);
        },
        { srgb: false, repeat: [1, 1] },
    )) as THREE.CanvasTexture;
});

/** The frosted chimney's glow from bottom (v = 0) to top: brightest at the flame. */
const chimney = once(function* () {
    return (yield canvasTextureWork(
        8,
        64,
        (ctx) => {
            const g = ctx.createLinearGradient(0, 64, 0, 0);
            g.addColorStop(0, "rgb(70,70,70)");
            g.addColorStop(0.3, "rgb(200,200,200)");
            g.addColorStop(0.5, "rgb(255,255,255)");
            g.addColorStop(0.8, "rgb(150,150,150)");
            g.addColorStop(1, "rgb(60,60,60)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 8, 64);
        },
        { srgb: false },
    )) as THREE.CanvasTexture;
});

export const envTextures = { wallpaper, wood, floor, carpet, fringe, beam, plaster, cobweb, painting, iron, tarnish, glow, decal, fog, chimney };

/** Paint every corridor surface a slice at a time: then envTextures has them at once. */
export const prepareEnvTextures = () => Promise.all(Object.values(envTextures).map((t) => t.built.prepare()));
