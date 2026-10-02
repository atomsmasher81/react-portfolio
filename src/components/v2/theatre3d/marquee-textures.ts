import * as THREE from "three";
import { canvasTextureWork, fbm, now, once, paintPixelsWork, putWork, rng, valueNoise, type Work } from "@/components/v2/theatre3d/textures";
import { BOOTH, FACE, FACE_RIVETS } from "@/components/v2/theatre3d/marquee-parts";

// The marquee's surfaces, painted from noise: the rusted face, the iron of the
// box and chains, the chipped gilt, the box office's wood and old glass, and
// the soft glow behind the letters. Built once, on first use, and shared;
// a slice at a time beforehand with prepareMarqueeTextures() (textures.ts).

export interface Surface {
    map: THREE.Texture;
    roughnessMap: THREE.Texture;
    normalMap: THREE.Texture;
    metalnessMap?: THREE.Texture;
}

export interface MarqueeTextures {
    face: Surface;
    iron: Surface;
    gilt: Surface;
    wood: Surface;
    glass: GlassMaps;
    grille: THREE.Texture; // alpha: where the brass is
    glow: THREE.Texture;
}

type RGB = [number, number, number];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Blend two colours into `out` (which may be `a`). No allocation: these run per pixel. */
const mixInto = (out: RGB, a: RGB, b: RGB, t: number): RGB => {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
};
const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};

/** Fractal noise that tiles across [0, 1) in both directions, `period` features wide at the base octave. */
function tilingFbm(seed: number, period: number, octaves = 4) {
    const layers = Array.from({ length: octaves }, (_, i) => ({ n: valueNoise(seed + i * 59, period << i), f: period << i }));
    return (u: number, v: number) => {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        for (const { n, f } of layers) {
            sum += n(u * f, v * f) * amp;
            norm += amp;
            amp *= 0.5;
        }
        return sum / norm;
    };
}

/**
 * A texture filled straight from code, a pixel at a time, into the canvas's
 * image data: no per-pixel arrays and no reading the canvas back, which is
 * what made these slow.
 */
export function pixelTexture(w: number, h: number, fill: (data: Uint8ClampedArray) => Work<void> | void, opts: { srgb?: boolean; repeat?: [number, number] } = {}) {
    return now(pixelTextureWork(w, h, fill, opts));
}

export function* pixelTextureWork(w: number, h: number, fill: (data: Uint8ClampedArray) => Work<void> | void, opts: { srgb?: boolean; repeat?: [number, number] } = {}): Work<THREE.CanvasTexture> {
    return (yield canvasTextureWork(
        w,
        h,
        function* (ctx) {
            const img = ctx.createImageData(w, h);
            const filling = fill(img.data);
            if (filling) yield filling;
            yield putWork(ctx, img);
        },
        opts,
    )) as THREE.CanvasTexture;
}

/**
 * A tangent-space normal map straight from a height field (0 to 1, tiling),
 * the same sums as normalFromHeight in textures.ts, without the canvas trip.
 */
function* normalsFrom(w: number, h: number, height: Float32Array, strength: number, repeat?: [number, number]): Work<THREE.CanvasTexture> {
    return (yield pixelTextureWork(
        w,
        h,
        function* (d) {
            for (let y = 0; y < h; y++) {
                const up = ((y + h - 1) % h) * w;
                const down = ((y + 1) % h) * w;
                for (let x = 0; x < w; x++) {
                    const dx = (height[y * w + ((x + 1) % w)] - height[y * w + ((x + w - 1) % w)]) * strength;
                    const dy = (height[down + x] - height[up + x]) * strength;
                    const len = Math.sqrt(dx * dx + dy * dy + 1);
                    const i = (y * w + x) * 4;
                    d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
                    d[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
                    d[i + 2] = (1 / len) * 127.5 + 127.5;
                    d[i + 3] = 255;
                }
                yield;
            }
        },
        { srgb: false, repeat },
    )) as THREE.CanvasTexture;
}

/** Wrap three per-pixel arrays (colour, roughness, height) as a surface. */
function* surfaceFrom(w: number, h: number, col: Float32Array, rough: Float32Array, height: Float32Array, strength: number, repeat?: [number, number], metal?: Float32Array): Work<Surface> {
    const map = (yield pixelTextureWork(
        w,
        h,
        function* (d) {
            for (let i = 0, n = w * h; i < n; i++) {
                d[i * 4] = col[i * 3];
                d[i * 4 + 1] = col[i * 3 + 1];
                d[i * 4 + 2] = col[i * 3 + 2];
                d[i * 4 + 3] = 255;
                if (i % 65536 === 65535) yield;
            }
        },
        { repeat },
    )) as THREE.CanvasTexture;
    // Roughness is read from green and metalness from blue, so one texture serves both.
    const roughnessMap = (yield pixelTextureWork(
        w,
        h,
        function* (d) {
            for (let i = 0, n = w * h; i < n; i++) {
                d[i * 4 + 1] = rough[i] * 255;
                d[i * 4 + 2] = metal ? metal[i] * 255 : 0;
                d[i * 4 + 3] = 255;
                if (i % 65536 === 65535) yield;
            }
        },
        { srgb: false, repeat },
    )) as THREE.CanvasTexture;
    const normalMap = (yield normalsFrom(w, h, height, strength, repeat)) as THREE.CanvasTexture;
    return { map, roughnessMap, normalMap, metalnessMap: metal ? roughnessMap : undefined };
}

/** Stamp a soft disc into a field. */
function stamp(field: Float32Array, w: number, h: number, cx: number, cy: number, r: number, value: number, op: "max" | "add" = "max") {
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const d = Math.hypot(x - cx, y - cy) / r;
            if (d >= 1) continue;
            const v = value * (1 - d * d);
            const i = y * w + x;
            field[i] = op === "max" ? Math.max(field[i], v) : field[i] + v;
        }
    }
}

// The face: black-oxblood enamel gone chalky, flaking to red primer and bare
// iron, rust blooming from the edges and the rivets and running down in streaks.
function* buildFace(): Work<Surface> {
    const W = 768;
    const H = Math.round((W * FACE.h) / FACE.w);
    const m = FACE.w / W; // metres per pixel
    const k = W / 1024; // the stamps below were sized for a 1024 wide map
    const r = rng(9137);
    const rustN = fbm(311, 5);
    yield;
    const rustN2 = fbm(353, 4);
    yield;
    const flakeN = fbm(577, 5);
    yield;
    const chalkN = fbm(823, 3);
    yield;
    const fine = valueNoise(1201);
    yield;
    const streakN = valueNoise(1409);
    yield;

    // Pits, dings and scratches are stamped first, then read per pixel.
    const pits = new Float32Array(W * H);
    const dings = new Float32Array(W * H);
    const scratches = new Float32Array(W * H);
    const scratchHalo = new Float32Array(W * H); // rust creeping out from a scratch
    for (let i = 0; i < 900; i++) {
        const x = r() * W;
        const y = r() * H;
        // Pits gather where rust gathers: test the same noise before keeping one.
        const u = x * m;
        const v = y * m;
        const bias = rustN(u * 5, v * 5) + 0.3 * Math.exp(-(H - y) * m / 0.08);
        if (bias < 0.5 && r() > 0.15) continue;
        stamp(pits, W, H, x, y, Math.max(0.7, (0.8 + r() * 2.2) * k), 0.6 + r() * 0.4);
    }
    for (let i = 0; i < 14; i++) stamp(dings, W, H, r() * W, r() * H, (3 + r() * 6) * k, 0.5 + r() * 0.5);
    for (let i = 0; i < 26; i++) {
        let x = r() * W;
        let y = r() * H;
        let a = r() * Math.PI * 2;
        const len = (20 + r() * 90) * k;
        for (let s = 0; s < len; s++) {
            a += (r() - 0.5) * 0.08;
            x += Math.cos(a);
            y += Math.sin(a) * 0.6;
            stamp(scratches, W, H, x, y, 0.8, 0.7 + 0.3 * Math.sin(s * 0.2));
            if (s % 3 === 0) stamp(scratchHalo, W, H, x, y, 3.5 * k, 0.8);
        }
    }

    // Rivets in pixel space (the face texture's v runs down from the top).
    const rivets = new Float32Array(FACE_RIVETS.flatMap(([x, y]) => [(x + FACE.w / 2) / m, (FACE.h / 2 - y) / m]));

    const col = new Float32Array(W * H * 3);
    const rough = new Float32Array(W * H);
    const height = new Float32Array(W * H);
    const paintDark: RGB = [17, 12, 11];
    const paintChalk: RGB = [36, 27, 24];
    const primer: RGB = [58, 30, 22];
    const iron: RGB = [54, 50, 46];
    const rustDark: RGB = [36, 20, 13];
    const rustMid: RGB = [70, 38, 20];
    const rustHot: RGB = [112, 58, 26];
    const streakCol: RGB = [56, 32, 19];
    const scratched: RGB = [96, 88, 80];
    const c: RGB = [0, 0, 0];
    const under: RGB = [0, 0, 0];
    const rc: RGB = [0, 0, 0];

    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const i = py * W + px;
            const u = px * m;
            const v = py * m;
            const edge = Math.min(u, FACE.w - u, v, FACE.h - v);
            const bottom = FACE.h - v;

            // Rust comes from the edges (worst at the bottom, where water sat) and round the rivets.
            let rivetRust = 0;
            let streak = 0;
            for (let k = 0; k < rivets.length; k += 2) {
                const dx = px - rivets[k];
                if (dx < -30 || dx > 30) continue;
                const dy = py - rivets[k + 1];
                const d2 = (dx * dx + dy * dy) * m * m;
                rivetRust = Math.max(rivetRust, Math.exp(-d2 / 0.00025));
                if (dy > 0) {
                    const run = dy * m;
                    const spread = 0.003 + run * 0.05;
                    const fall = Math.exp(-run / 0.16);
                    streak = Math.max(streak, Math.exp(-(((dx * m) / spread) ** 2)) * fall);
                }
            }
            // Runs from the top edge too, here and there, each its own length.
            const drip = Math.pow(streakN(u * 23, 3.5), 7) * 3.5 * smooth(0.45, 0.7, chalkN(u * 2, 0.3));
            const dripLen = 0.08 + 0.3 * streakN(u * 23, 9.5);
            streak = Math.max(streak, drip * Math.exp(-v / dripLen)) * (0.55 + 0.45 * streakN(u * 70, v * 6));

            // Rust: a broad tendency, broken up at a smaller scale, worst at the
            // edges and round the rivets and scratches.
            const nRust = rustN(u * 5, v * 5);
            const nRust2 = rustN2(u * 14, v * 14);
            const nFine = fine(u * 160, v * 160);
            const rust = smooth(
                0.6,
                0.74,
                0.5 * nRust + 0.5 * nRust2 + 0.26 * Math.exp(-edge / 0.05) + 0.3 * Math.exp(-bottom / 0.07) + 0.35 * rivetRust + 0.25 * scratchHalo[i] + 0.12 * (nFine - 0.5),
            );
            const flakeV = flakeN(u * 12, v * 12) + 0.2 * rust;
            const flake = smooth(0.65, 0.665, flakeV);
            const chalk = smooth(0.4, 0.75, chalkN(u * 3, v * 3));

            mixInto(c, paintDark, paintChalk, chalk * 0.8);
            // Under the paint: red primer mostly, bare iron where it has gone too.
            mixInto(under, primer, iron, smooth(0.55, 0.7, flakeN(u * 31, v * 31)));
            mixInto(c, c, under, flake);
            mixInto(rc, rustDark, rustMid, smooth(0.3, 0.75, nFine));
            mixInto(rc, rc, rustHot, smooth(0.7, 0.85, nRust2 + 0.1 * nFine) * 0.6);
            mixInto(c, c, rc, rust);
            mixInto(c, c, streakCol, Math.min(1, streak) * 0.75 * (1 - rust * 0.5));
            const sc = scratches[i] * (1 - rust);
            mixInto(c, c, scratched, sc * 0.6);
            const pit = pits[i] * (0.4 + 0.6 * rust);
            // Grime gathers low and in the corners.
            const grime = 0.7 + 0.3 * smooth(0, 0.12, bottom) * smooth(0, 0.05, edge);
            const k = grime * (1 - 0.65 * pit);
            col[i * 3] = c[0] * k;
            col[i * 3 + 1] = c[1] * k;
            col[i * 3 + 2] = c[2] * k;

            let ro = mix(0.5, 0.7, chalk);
            ro = mix(ro, 0.82, flake);
            ro = mix(ro, 0.93, rust);
            ro = mix(ro, 0.78, Math.min(1, streak) * 0.6);
            ro = mix(ro, 0.35, sc);
            rough[i] = Math.min(1, ro + pit * 0.1);

            let hgt = 0.55 - 0.06 * flake;
            hgt = mix(hgt, 0.45 + 0.22 * nFine + 0.08 * fine(u * 260, v * 260), rust);
            // Paint blisters where rust is just starting under it.
            hgt += 0.07 * smooth(0.15, 0.35, rust) * (1 - smooth(0.45, 0.7, rust));
            hgt -= 0.3 * pit + 0.18 * dings[i] + 0.06 * scratches[i];
            height[i] = Math.min(1, Math.max(0, hgt));
        }
        yield;
    }
    return (yield surfaceFrom(W, H, col, rough, height, 3.5)) as Surface;
}

const IRON_DARK: RGB = [34, 29, 26];
const IRON_LIGHT: RGB = [52, 44, 38];
const RUST_DARK: RGB = [52, 25, 14];
const RUST_LIGHT: RGB = [104, 50, 22];

// Old iron for the box, the frame and the chains: dark, oily, rust in blooms.
// It tiles, and covers 0.6 m before repeating.
export const IRON_TILE = 0.6;
function* buildIron(): Work<Surface> {
    const S = 256;
    const c: RGB = [0, 0, 0];
    const rc: RGB = [0, 0, 0];
    const rustN = tilingFbm(41, 4, 5);
    yield;
    const fineN = tilingFbm(97, 32, 3);
    yield;
    const tintN = tilingFbm(131, 2, 3);
    yield;
    const r = rng(77);
    const pits = new Float32Array(S * S);
    for (let i = 0; i < 350; i++) stamp(pits, S, S, r() * S, r() * S, 0.6 + r() * 1.3, 0.5 + r() * 0.5);
    const col = new Float32Array(S * S * 3);
    const rough = new Float32Array(S * S);
    const height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const u = x / S;
            const v = y / S;
            const nr = rustN(u, v);
            const nf = fineN(u, v);
            const rust = smooth(0.52, 0.68, nr + 0.15 * (nf - 0.5));
            mixInto(c, IRON_DARK, IRON_LIGHT, tintN(u, v));
            mixInto(rc, RUST_DARK, RUST_LIGHT, nf);
            mixInto(c, c, rc, rust);
            const pit = pits[i] * (0.3 + 0.7 * rust);
            const k = 1 - 0.6 * pit;
            col[i * 3] = c[0] * k;
            col[i * 3 + 1] = c[1] * k;
            col[i * 3 + 2] = c[2] * k;
            rough[i] = mix(0.55, 0.92, rust) + 0.05 * nf;
            height[i] = 0.55 + mix(0.03 * nf, -0.1 + 0.25 * nf, rust) - 0.3 * pit;
        }
        yield;
    }
    const rep: [number, number] = [1 / IRON_TILE, 1 / IRON_TILE];
    return (yield surfaceFrom(S, S, col, rough, height, 3, rep)) as Surface;
}

// Gilt over iron, rubbed thin, tarnished and chipped. Covers 0.25 m.
export const GILT_TILE = 0.25;
const GILT_BRIGHT: RGB = [176, 136, 72];
const GILT_DULL: RGB = [140, 104, 52];
const GILT_TARNISH: RGB = [74, 56, 32];
const GILT_CHIP: RGB = [26, 19, 15];
function* buildGilt(): Work<Surface> {
    const S = 256;
    const c: RGB = [0, 0, 0];
    const tarnishN = tilingFbm(211, 3, 4);
    yield;
    const chipN = tilingFbm(307, 6, 4);
    yield;
    const fineN = tilingFbm(401, 32, 2);
    yield;
    const col = new Float32Array(S * S * 3);
    const rough = new Float32Array(S * S);
    const metal = new Float32Array(S * S);
    const height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const u = x / S;
            const v = y / S;
            const tarnish = smooth(0.4, 0.7, tarnishN(u, v));
            const chip = smooth(0.64, 0.67, chipN(u, v));
            const nf = fineN(u, v);
            mixInto(c, GILT_BRIGHT, GILT_DULL, nf);
            mixInto(c, c, GILT_TARNISH, tarnish * 0.75);
            mixInto(c, c, GILT_CHIP, chip);
            col[i * 3] = c[0];
            col[i * 3 + 1] = c[1];
            col[i * 3 + 2] = c[2];
            rough[i] = mix(mix(0.32, 0.55, tarnish), 0.85, chip);
            metal[i] = mix(0.9, 0.15, chip);
            height[i] = 0.6 - 0.25 * chip + 0.04 * nf;
        }
        yield;
    }
    const rep: [number, number] = [1 / GILT_TILE, 1 / GILT_TILE];
    return (yield surfaceFrom(S, S, col, rough, height, 2.5, rep, metal)) as Surface;
}

// Dark varnished wood for the box office, the grain running up the boards.
// The varnish has worn thin and grey where hands and coats rubbed it. Tiles
// every WOOD_TILE metres.
export const WOOD_TILE = 0.9;
const WOOD_EARLY: RGB = [33, 21, 14];
const WOOD_LATE: RGB = [19, 12, 8];
const WOOD_WORN: RGB = [46, 36, 30];
function* buildWood(): Work<Surface> {
    const S = 384;
    const c: RGB = [0, 0, 0];
    const warp = tilingFbm(1301, 3, 4);
    yield;
    const figure = tilingFbm(1327, 8, 3);
    yield;
    const pores = tilingFbm(1361, 64, 2);
    yield;
    const wearN = tilingFbm(1399, 4, 4);
    yield;
    const boards = valueNoise(1423, 8);
    yield;
    const col = new Float32Array(S * S * 3);
    const rough = new Float32Array(S * S);
    const height = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = y * S + x;
            const u = x / S;
            const v = y / S;
            // Rings: stripes across u, bent by noise, so the grain runs along v.
            const ring = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (u * 14 + 1.6 * warp(u, v) + 0.25 * figure(u, v)));
            const late = Math.pow(ring, 3);
            const p = pores(u, v);
            const worn = smooth(0.55, 0.75, wearN(u, v));
            // Each board a slightly different tone.
            const board = boards(Math.floor(u * 8), 0.5);
            mixInto(c, WOOD_EARLY, WOOD_LATE, 0.55 * late + 0.35 * figure(u, v));
            mixInto(c, c, WOOD_WORN, worn * 0.4);
            const k = (0.85 + 0.2 * p) * (0.8 + 0.35 * board);
            col[i * 3] = c[0] * k;
            col[i * 3 + 1] = c[1] * k;
            col[i * 3 + 2] = c[2] * k;
            rough[i] = mix(0.42, 0.78, worn) + 0.1 * late;
            height[i] = 0.5 + 0.1 * late + 0.08 * p - 0.05 * worn;
        }
        yield;
    }
    const rep: [number, number] = [1 / WOOD_TILE, 1 / WOOD_TILE];
    return (yield surfaceFrom(S, S, col, rough, height, 2, rep)) as Surface;
}

/**
 * The box office glass, covering its arched opening: old and dirty, grime
 * thick at the edges and corners, a smeared patch where someone once wiped a
 * hole to look through, fingermarks round the grille and the slot, and a
 * starburst crack in the upper left. Colour in `map`, how opaque the dirt is
 * in `alpha`.
 */
export interface GlassMaps {
    map: THREE.Texture;
    alpha: THREE.Texture;
    waves: THREE.Texture;
}
const GLASS_CLEAN: RGB = [26, 30, 27];
const GLASS_GRIME: RGB = [92, 82, 66];
const GLASS_CRACKED: RGB = [190, 186, 170];
function* buildGlass(w: number, h: number, grille: [number, number], crack: [number, number]): Work<GlassMaps> {
    const W = 384;
    const c: RGB = [0, 0, 0];
    const H = Math.round((W * h) / w);
    const m = w / W;
    const r = rng(2203);
    const dirtN = fbm(2221, 5);
    yield;
    const smearN = fbm(2239, 3);
    yield;
    const fine = valueNoise(2251);
    yield;
    const cracks = new Float32Array(W * H);
    // The crack: a dozen lines from a point, kinking as they go, with a few rings between.
    const [cx, cy] = [(crack[0] + w / 2) / m, (h - crack[1]) / m];
    for (let k = 0; k < 13; k++) {
        let a = (k / 13) * Math.PI * 2 + r() * 0.4;
        let x = cx;
        let y = cy;
        const len = 30 + r() * 110;
        for (let s = 0; s < len; s++) {
            a += (r() - 0.5) * 0.12;
            x += Math.cos(a);
            y += Math.sin(a);
            stamp(cracks, W, H, x, y, 0.8, 1);
        }
    }
    for (let ring = 1; ring <= 3; ring++) {
        const rad = ring * 13 + r() * 6;
        for (let s = 0; s < rad * 5; s++) {
            const a = (s / (rad * 5)) * Math.PI * 2;
            if (fine(a * 4 + ring * 9, 2) < 0.45) continue;
            stamp(cracks, W, H, cx + Math.cos(a) * rad * (1 + 0.1 * Math.sin(a * 3)), cy + Math.sin(a) * rad, 0.7, 0.8);
        }
    }
    const [gx, gy] = [(grille[0] + w / 2) / m, (h - grille[1]) / m];
    const col = new Float32Array(W * H * 3);
    const alpha = new Float32Array(W * H);
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const i = py * W + px;
            const u = px * m;
            const v = py * m;
            const edge = Math.min(u, w - u, h - v, Math.abs(v) + 0.2);
            const bottom = h - v;
            // Grime: worst in the corners and along the bottom, thinning toward the middle.
            let dirt = 0.2 + 0.45 * dirtN(u * 6, v * 6) * (0.5 + 0.5 * Math.exp(-edge / 0.12)) + 0.25 * Math.exp(-bottom / 0.08);
            // A rough oval wiped clearer, low on the left where the card is, with smeared arcs round it.
            const wx = (u - w * 0.28) / 0.24;
            const wy = (v - h * 0.72) / 0.2;
            const wipe = Math.exp(-(wx * wx + wy * wy) * 1.6);
            dirt *= 1 - 0.55 * wipe;
            dirt += 0.12 * smooth(0.55, 0.7, smearN(u * 4 + Math.atan2(wy, wx), Math.hypot(wx, wy) * 3)) * (1 - wipe);
            // Fingers round the grille.
            const gd = Math.hypot(px - gx, py - gy) * m;
            dirt += 0.18 * Math.exp(-((gd - 0.1) ** 2) / 0.002) * smooth(0.5, 0.7, fine(u * 90, v * 90));
            const crackV = cracks[i];
            const a = Math.min(0.92, dirt + 0.6 * crackV);
            alpha[i] = a;
            mixInto(c, GLASS_CLEAN, GLASS_GRIME, smooth(0.25, 0.6, dirt));
            mixInto(c, c, GLASS_CRACKED, crackV);
            col[i * 3] = c[0];
            col[i * 3 + 1] = c[1];
            col[i * 3 + 2] = c[2];
        }
        yield;
    }
    const map = (yield pixelTextureWork(W, H, (d) => {
        for (let i = 0; i < W * H; i++) {
            d[i * 4] = col[i * 3];
            d[i * 4 + 1] = col[i * 3 + 1];
            d[i * 4 + 2] = col[i * 3 + 2];
            d[i * 4 + 3] = 255;
        }
    })) as THREE.CanvasTexture;
    const alphaTex = (yield pixelTextureWork(
        W,
        H,
        (d) => {
            for (let i = 0; i < W * H; i++) {
                d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = alpha[i] * 255;
                d[i * 4 + 3] = 255;
            }
        },
        { srgb: false },
    )) as THREE.CanvasTexture;
    // Old cylinder glass: long shallow ripples, mostly running across.
    const ripple = tilingFbm(2281, 4, 3);
    yield;
    const waves = new Float32Array(256 * 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) waves[y * 256 + x] = 0.5 + 0.47 * Math.sin(Math.PI * 2 * ((y / 256) * 9 + 0.7 * ripple(x / 256, y / 256)));
        yield;
    }
    return { map, alpha: alphaTex, waves: (yield normalsFrom(256, 256, waves, 0.6, [2, 2])) as THREE.CanvasTexture };
}

/** A pierced brass speaking grille: alpha only, rings of holes round a rosette. */
function* buildGrille(): Work<THREE.CanvasTexture> {
    return (yield canvasTextureWork(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        for (let ring = 1; ring <= 5; ring++) {
            const rad = ring * 21;
            const n = ring * 7;
            const size = 4.5 + ring * 0.3;
            for (let k = 0; k < n; k++) {
                const a = (k / n) * Math.PI * 2 + ring * 0.3;
                ctx.beginPath();
                ctx.arc(w / 2 + Math.cos(a) * rad, h / 2 + Math.sin(a) * rad, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // A four-petalled cut in the middle.
        for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.ellipse(w / 2 + Math.cos((k * Math.PI) / 2) * 9, h / 2 + Math.sin((k * Math.PI) / 2) * 9, 7, 3.5, (k * Math.PI) / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }, { srgb: false })) as THREE.CanvasTexture;
}

/** A soft elliptical pool of light, white in the middle, for additive planes. */
function* buildGlow(): Work<THREE.CanvasTexture> {
    return (yield canvasTextureWork(256, 96, (ctx, w, h) =>
        paintPixelsWork(ctx, w, h, (x, y) => {
            const dx = (x / (w - 1)) * 2 - 1;
            const dy = (y / (h - 1)) * 2 - 1;
            const d = Math.sqrt(dx * dx + dy * dy);
            const v = Math.pow(Math.max(0, 1 - d), 2.2) * 255;
            return [v, v, v];
        }),
    )) as THREE.CanvasTexture;
}

// Where the grille and the crack are, in the window's own space (x from its
// centre, y up from the sill), so the grime can gather round them.
export const GLASS_GRILLE: [number, number] = [0.05, 0.31];
export const GLASS_CRACK: [number, number] = [-0.33, 0.8];

/** Every marquee texture, generated on first call. */
export function marqueeTextures(): MarqueeTextures {
    return all();
}

/** Paint them all a slice at a time: then marqueeTextures() has them at once. */
export const prepareMarqueeTextures = () => all.built.prepare();

const all = once(function* (): Work<MarqueeTextures> {
    const face = (yield buildFace()) as Surface;
    const iron = (yield buildIron()) as Surface;
    const gilt = (yield buildGilt()) as Surface;
    const wood = (yield buildWood()) as Surface;
    const glass = (yield buildGlass(BOOTH.win.w, BOOTH.win.h, GLASS_GRILLE, GLASS_CRACK)) as GlassMaps;
    const grille = (yield buildGrille()) as THREE.CanvasTexture;
    const glow = (yield buildGlow()) as THREE.CanvasTexture;
    return { face, iron, gilt, wood, glass, grille, glow };
});
