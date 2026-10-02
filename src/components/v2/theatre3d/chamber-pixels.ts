import * as THREE from "three";
import { now, putWork, readWork, rng, valueNoise, type Work } from "@/components/v2/theatre3d/textures";

// Pixel-level helpers for the chamber's textures: fields of noise worked out
// coarse and read back smooth, a box blur, and colour / roughness / normal
// maps written straight from typed arrays. The heavy ones also come as Work,
// to be done a slice at a time (textures.ts).

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
    const t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
};

/** Cheap white noise in [0, 1) for a pixel. */
export function hash2(x: number, y: number, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type Sampler = (x: number, y: number) => number;

/** Value noise on a px × py grid that wraps: x in [0, px), y in [0, py). */
export function periodic(seed: number, px: number, py: number): Sampler {
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

/** Fractal noise that tiles: u, v in [0, 1) wrap; `px` × `py` cells at the first octave. */
export function tileFbm(seed: number, px: number, octaves: number, py = px): Sampler {
    const layers = Array.from({ length: octaves }, (_, i) => ({ n: periodic(seed + i * 131, px << i, py << i), px: px << i, py: py << i }));
    return (u, v) => {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        for (const l of layers) {
            sum += l.n(u * l.px, v * l.py) * amp;
            norm += amp;
            amp *= 0.5;
        }
        return sum / norm;
    };
}

/** Plain fractal noise (no tiling), for one-off textures. Coordinates in cells. */
export function fbm2(seed: number, octaves: number): Sampler {
    const layers = Array.from({ length: octaves }, (_, i) => valueNoise(seed + i * 977, 256));
    return (x, y) => {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        let f = 1;
        for (const n of layers) {
            sum += n(x * f + 17.3 * f, y * f + 9.1 * f) * amp;
            norm += amp;
            amp *= 0.5;
            f *= 2;
        }
        return sum / norm;
    };
}

/** A field sampled every `step` pixels and read back bilinearly. */
export function lowres(w: number, h: number, step: number, fn: Sampler): Sampler {
    return now(lowresWork(w, h, step, fn));
}

export function* lowresWork(w: number, h: number, step: number, fn: Sampler): Work<Sampler> {
    const gw = Math.ceil(w / step) + 2;
    const gh = Math.ceil(h / step) + 2;
    const g = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) g[j * gw + i] = fn(i * step, j * step);
        yield;
    }
    return (x, y) => {
        const fx = Math.max(0, x / step);
        const fy = Math.max(0, y / step);
        const i = Math.min(gw - 2, fx | 0);
        const j = Math.min(gh - 2, fy | 0);
        const tx = fx - i;
        const ty = fy - j;
        const k = j * gw + i;
        const a = g[k];
        const b = g[k + 1];
        const c = g[k + gw];
        const d = g[k + gw + 1];
        const top = a + (b - a) * tx;
        return top + (c + (d - c) * tx - top) * ty;
    };
}

/** Separable box blur, `passes` times (three passes is close to a gaussian). In place. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 2) {
    return now(boxBlurWork(src, w, h, r, passes));
}

export function* boxBlurWork(src: Float32Array, w: number, h: number, r: number, passes = 2): Work<Float32Array> {
    if (r < 1) return src;
    const tmp = new Float32Array(src.length);
    const inv = 1 / (2 * r + 1);
    for (let p = 0; p < passes; p++) {
        for (let y = 0; y < h; y++) {
            const row = y * w;
            let acc = 0;
            for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
            for (let x = 0; x < w; x++) {
                tmp[row + x] = acc * inv;
                acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
            }
            if ((y & 15) === 15) yield;
        }
        for (let x = 0; x < w; x++) {
            let acc = 0;
            for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
            for (let y = 0; y < h; y++) {
                src[y * w + x] = acc * inv;
                acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
            }
            if ((x & 15) === 15) yield;
        }
    }
    return src;
}

/** A canvas's red channel as 0..1 floats. */
export function channel(canvas: HTMLCanvasElement) {
    return now(channelWork(canvas));
}

export function* channelWork(canvas: HTMLCanvasElement): Work<Float32Array> {
    const { width: w, height: h } = canvas;
    const d = (yield readWork(canvas.getContext("2d")!, w, h)) as Uint8ClampedArray;
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
    return out;
}

export function makeCanvas(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
}

/** A canvas we'll read pixels back from: kept in memory, so reading it never waits on the GPU. */
export function readableCanvas(w: number, h: number) {
    const c = makeCanvas(w, h);
    c.getContext("2d", { willReadFrequently: true });
    return c;
}

/** Wrap RGBA bytes as a texture (via a canvas, so it mipmaps and flips like the others). */
export function rgbaTexture(data: Uint8ClampedArray, w: number, h: number, srgb: boolean, repeat = false) {
    return now(rgbaTextureWork(data, w, h, srgb, repeat));
}

export function* rgbaTextureWork(data: Uint8ClampedArray, w: number, h: number, srgb: boolean, repeat = false): Work<THREE.CanvasTexture> {
    const c = makeCanvas(w, h);
    yield putWork(c.getContext("2d")!, new ImageData(data, w, h));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
}

/** A grey 0..1 field as a data map (roughness and the like). */
export function greyTexture(v: Float32Array, w: number, h: number, repeat = false) {
    return now(greyTextureWork(v, w, h, repeat));
}

export function* greyTextureWork(v: Float32Array, w: number, h: number, repeat = false): Work<THREE.CanvasTexture> {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < v.length; i++) {
        const g = clamp01(v[i]) * 255;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g;
        d[i * 4 + 3] = 255;
        if (i % 65536 === 65535) yield;
    }
    return (yield rgbaTextureWork(d, w, h, false, repeat)) as THREE.CanvasTexture;
}

/**
 * A tangent-space normal map (OpenGL convention, +Y up, as three.js expects
 * with flipped canvas textures) from a height field, row 0 at the top.
 * `k` is how many pixels one unit of height spans: the steepness.
 */
export function normalTexture(height: Float32Array, w: number, h: number, k: number, repeat = false) {
    return now(normalTextureWork(height, w, h, k, repeat));
}

export function* normalTextureWork(height: Float32Array, w: number, h: number, k: number, repeat = false): Work<THREE.CanvasTexture> {
    const d = new Uint8ClampedArray(w * h * 4);
    const at = repeat
        ? (x: number, y: number) => height[((y + h) % h) * w + ((x + w) % w)]
        : (x: number, y: number) => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * k;
            const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5 * k;
            // canvas y runs down the texture, v up it: dh/dv = -dy
            const nx = -dx;
            const ny = dy;
            const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
            const i = (y * w + x) * 4;
            d[i] = (nx * inv * 0.5 + 0.5) * 255;
            d[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
            d[i + 2] = (inv * 0.5 + 0.5) * 255;
            d[i + 3] = 255;
        }
        yield;
    }
    return (yield rgbaTextureWork(d, w, h, false, repeat)) as THREE.CanvasTexture;
}

/** Colour (RGB bytes), roughness and height for one surface, painted in one pass. */
export class Surface {
    readonly col: Uint8ClampedArray;
    readonly rough: Float32Array;
    readonly height: Float32Array;
    constructor(
        readonly w: number,
        readonly h: number,
    ) {
        this.col = new Uint8ClampedArray(w * h * 4);
        this.rough = new Float32Array(w * h);
        this.height = new Float32Array(w * h);
    }
    set(i: number, r: number, g: number, b: number, rough: number, height: number) {
        const k = i * 4;
        this.col[k] = r;
        this.col[k + 1] = g;
        this.col[k + 2] = b;
        this.col[k + 3] = 255;
        this.rough[i] = rough;
        this.height[i] = height;
    }
    maps(steep: number, repeat: boolean) {
        return now(this.mapsWork(steep, repeat));
    }
    *mapsWork(steep: number, repeat: boolean): Work<Maps> {
        const map = (yield rgbaTextureWork(this.col, this.w, this.h, true, repeat)) as THREE.CanvasTexture;
        const roughnessMap = (yield greyTextureWork(this.rough, this.w, this.h, repeat)) as THREE.CanvasTexture;
        const normalMap = (yield normalTextureWork(this.height, this.w, this.h, steep, repeat)) as THREE.CanvasTexture;
        return { map, roughnessMap, normalMap };
    }
}

export interface Maps {
    map: THREE.Texture;
    roughnessMap: THREE.Texture;
    normalMap: THREE.Texture;
}

/** Let the browser breathe between long steps. */
export const breathe = () => new Promise<void>((r) => setTimeout(r, 0));
