import * as THREE from "three";

// Everything in the theatre is textured from code: no image downloads, and
// every surface (wood, iron, brass, plaster) comes out of the same few
// deterministic noise helpers so it all looks of a piece. Seeded, so a door
// looks the same on every visit.

/** Small, fast, seeded random numbers (mulberry32). */
export function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Smooth 2D value noise in [0, 1], tiling every `period` units. */
export function valueNoise(seed: number, period = 256) {
    const r = rng(seed);
    const grid = new Float32Array(period * period).map(() => r());
    const at = (x: number, y: number) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
    const fade = (t: number) => t * t * (3 - 2 * t);
    return (x: number, y: number) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = fade(x - xi);
        const yf = fade(y - yi);
        const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * xf;
        const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * xf;
        return a + (b - a) * yf;
    };
}

/** Fractal noise: several octaves of value noise, in roughly [0, 1]. */
export function fbm(seed: number, octaves = 4) {
    const layers = Array.from({ length: octaves }, (_, i) => valueNoise(seed + i * 101));
    return (x: number, y: number) => {
        let sum = 0;
        let amp = 0.5;
        let freq = 1;
        let norm = 0;
        for (const n of layers) {
            sum += n(x * freq, y * freq) * amp;
            norm += amp;
            amp *= 0.5;
            freq *= 2;
        }
        return sum / norm;
    };
}

/* --------------------------------------------- built a slice at a time */

// All this painting is a lot of work (a couple of seconds for the whole
// theatre), so it's written as Work: generators that yield wherever it's fine
// to stop for a moment (between rows, between textures). Run one to the end
// at once with `now`, or let `Built.prepare` do it a few milliseconds at a time
// while the page is idle, so building the theatre never holds the page up.
// Either way the result is exactly the same: it's the same code, run in pieces.
//
// Work yields nothing (a moment's pause), or other Work, which is done first
// and whose result comes back out of the `yield`:
//     const map = (yield canvasTextureWork(...)) as THREE.CanvasTexture;
// (a trampoline rather than `yield*`, which this project's TypeScript settings
// don't allow on generators).

/** Work done a slice at a time (see above). */
export type Work<T> = Generator<Work<unknown> | void, T, unknown>;

/** Steps a piece of Work and everything it hands on, one resumption at a time. */
class Runner<T> {
    private readonly stack: Work<unknown>[];
    private input: unknown = undefined;
    done = false;
    value: T | undefined;
    constructor(work: Work<T>) {
        this.stack = [work];
    }
    /** One step; true once it's all done. */
    step(): boolean {
        if (this.done) return true;
        const r = this.stack[this.stack.length - 1].next(this.input);
        this.input = undefined;
        if (r.done) {
            this.stack.pop();
            if (this.stack.length) this.input = r.value;
            else {
                this.done = true;
                this.value = r.value as T;
            }
        } else if (r.value) this.stack.push(r.value);
        return this.done;
    }
}

/** Do it all, now. */
export function now<T>(work: Work<T>): T {
    const r = new Runner(work);
    while (!r.step());
    return r.value as T;
}

const isWork = (x: unknown): x is Work<unknown> => !!x && typeof (x as Work<unknown>).next === "function";

// Everything being built a slice at a time, first come first served: in the
// page's idle moments, or (urgent: someone's waiting for it, as for a room
// behind a door being opened) in short turns between the page's own work.
const idleQueue: (() => boolean)[] = [];
const urgentQueue: (() => boolean)[] = [];
let idleArmed = false;
let urgentArmed = false;

// As much as the page has to spare (an idle moment lasts until the next frame
// is due, at most 50 ms), and never so much that it counts as a long task; a
// few ms when there's no idle time to be had (or no idle callbacks at all).
const MOST = 35;
const LEAST = 4;
const TURN = 6; // ms per urgent turn

function run(queue: (() => boolean)[], budget: number) {
    const end = performance.now() + budget;
    do {
        if (queue[0]()) queue.shift();
    } while (queue.length && performance.now() < end);
}

function idlePump(deadline?: IdleDeadline) {
    idleArmed = false;
    run(idleQueue, deadline && !deadline.didTimeout ? Math.min(MOST, Math.max(1, deadline.timeRemaining() - 1)) : LEAST);
    if (idleQueue.length) armIdle();
}

function armIdle() {
    if (idleArmed) return;
    idleArmed = true;
    if (typeof requestIdleCallback === "function") requestIdleCallback(idlePump, { timeout: 100 });
    else setTimeout(idlePump, 0);
}

let channel: MessageChannel | null = null;
function urgentPump() {
    urgentArmed = false;
    run(urgentQueue, TURN);
    if (urgentQueue.length) armUrgent();
}

function armUrgent() {
    if (urgentArmed) return;
    urgentArmed = true;
    if (!channel) {
        channel = new MessageChannel();
        channel.port1.onmessage = urgentPump;
    }
    channel.port2.postMessage(0);
}

/** Step `step` (true when it's finished) a slice at a time: when the page is idle, or in short turns if `urgent`. */
export function sliced(step: () => boolean, urgent = false) {
    return new Promise<void>((resolve) => {
        (urgent ? urgentQueue : idleQueue).push(() => {
            const done = step();
            if (done) resolve();
            return done;
        });
        if (urgent) armUrgent();
        else armIdle();
    });
}

/** Do some Work a slice at a time (see sliced). */
export function later<T>(work: Work<T>, urgent = false): Promise<T> {
    const r = new Runner(work);
    return sliced(() => r.step(), urgent).then(() => r.value as T);
}

/**
 * Something built at most once, by some Work: `get()` has it now (finishing
 * the work at once, from wherever it had got to), `prepare()` has it built a
 * slice at a time, and `work()` is it as part of other work.
 */
export class Built<T> {
    private runner: Runner<T> | null = null;
    private ready: Promise<T> | null = null;
    constructor(private readonly make: () => Work<T>) {}
    private step() {
        return (this.runner ??= new Runner(this.make())).step();
    }
    get(): T {
        while (!this.step());
        return this.runner!.value as T;
    }
    *work(): Work<T> {
        while (!this.step()) yield;
        return this.runner!.value as T;
    }
    prepare(urgent = false): Promise<T> {
        if (this.runner?.done) return Promise.resolve(this.runner.value as T);
        return (this.ready ??= sliced(() => this.step(), urgent).then(() => this.runner!.value as T));
    }
}

/** A function of no arguments whose result is Built once (`.built` to prepare it). */
export function once<T>(make: () => Work<T>) {
    const built = new Built(make);
    return Object.assign(() => built.get(), { built });
}

/** Built once per key. */
export function oncePer<K, T>(make: (key: K) => Work<T>) {
    const all = new Map<K, Built<T>>();
    const of = (key: K) => {
        let b = all.get(key);
        if (!b) all.set(key, (b = new Built(() => make(key))));
        return b;
    };
    return Object.assign((key: K) => of(key).get(), { of, clear: () => all.clear() });
}

// For React: suspend (throw a promise) until something has been prepared.
const waits = new Map<string, { done: boolean; promise: Promise<unknown> }>();
/** Call during render, under a Suspense boundary: renders only once `start()`'s promise has settled. */
export function suspendUntil(key: string, start: () => Promise<unknown>) {
    let w = waits.get(key);
    if (!w) {
        const entry = { done: false, promise: Promise.resolve() as Promise<unknown> };
        entry.promise = start().then(
            () => void (entry.done = true),
            () => void (entry.done = true),
        );
        waits.set(key, (w = entry));
    }
    if (!w.done) throw w.promise;
}

/** putImageData, a band at a time (it's a lot of pixels at once on a big canvas). */
export function* putWork(ctx: CanvasRenderingContext2D, img: ImageData, dx = 0, dy = 0): Work<void> {
    const rows = Math.max(1, Math.floor(131072 / img.width));
    for (let y = 0; y < img.height; y += rows) {
        ctx.putImageData(img, dx, dy, 0, y, img.width, Math.min(rows, img.height - y));
        yield;
    }
}

/** A canvas's pixels, read back a band at a time. */
export function* readWork(ctx: CanvasRenderingContext2D, w: number, h: number): Work<Uint8ClampedArray> {
    const out = new Uint8ClampedArray(w * h * 4);
    const rows = Math.max(1, Math.floor(131072 / w));
    for (let y = 0; y < h; y += rows) {
        const n = Math.min(rows, h - y);
        out.set(ctx.getImageData(0, y, w, n).data, y * w * 4);
        yield;
    }
    return out;
}

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
/** Drawing that may be Work of its own. */
export type DrawWork = (ctx: CanvasRenderingContext2D, w: number, h: number) => Work<void> | void;

/** Draw on a canvas and wrap it as a texture. Colour maps are sRGB; data maps (roughness, height) are not. */
export function* canvasTextureWork(w: number, h: number, draw: DrawWork, { srgb = true, repeat }: { srgb?: boolean; repeat?: [number, number] } = {}): Work<THREE.CanvasTexture> {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const drawing = draw(ctx, w, h);
    if (isWork(drawing)) yield drawing;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 4;
    if (repeat) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
    }
    tex.needsUpdate = true;
    return tex;
}

export function canvasTexture(w: number, h: number, draw: DrawWork, options: { srgb?: boolean; repeat?: [number, number] } = {}) {
    return now(canvasTextureWork(w, h, draw, options));
}

/** Fill every pixel from a function returning [r, g, b] (0–255), a row at a time. */
export function* paintPixelsWork(ctx: CanvasRenderingContext2D, w: number, h: number, px: (x: number, y: number) => [number, number, number]): Work<void> {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const [r, g, b] = px(x, y);
            const i = (y * w + x) * 4;
            img.data[i] = r;
            img.data[i + 1] = g;
            img.data[i + 2] = b;
            img.data[i + 3] = 255;
        }
        yield;
    }
    yield putWork(ctx, img);
}

export function paintPixels(ctx: CanvasRenderingContext2D, w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
    now(paintPixelsWork(ctx, w, h, px));
}

/**
 * A tangent-space normal map from a greyscale height map (a canvas you've
 * drawn heights into, white = high). `strength` exaggerates the bumps.
 */
export function* normalFromHeightWork(height: HTMLCanvasElement, strength = 2, repeat?: [number, number]): Work<THREE.CanvasTexture> {
    const w = height.width;
    const h = height.height;
    const src = (yield readWork(height.getContext("2d")!, w, h)) as Uint8ClampedArray;
    const hAt = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    return (yield canvasTextureWork(
        w,
        h,
        (ctx) =>
            paintPixelsWork(ctx, w, h, (x, y) => {
                const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength;
                const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * strength;
                const len = Math.hypot(dx, dy, 1);
                return [((-dx / len) * 0.5 + 0.5) * 255, ((-dy / len) * 0.5 + 0.5) * 255, (1 / len) * 0.5 * 255 + 127.5];
            }),
        { srgb: false, repeat },
    )) as THREE.CanvasTexture;
}

export function normalFromHeight(height: HTMLCanvasElement, strength = 2, repeat?: [number, number]) {
    return now(normalFromHeightWork(height, strength, repeat));
}

/** A blank canvas you can draw heights into before calling normalFromHeight. */
export function* heightCanvasWork(w: number, h: number, draw: DrawWork): Work<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const drawing = draw(canvas.getContext("2d")!, w, h);
    if (isWork(drawing)) yield drawing;
    return canvas;
}

export function heightCanvas(w: number, h: number, draw: DrawWork) {
    return now(heightCanvasWork(w, h, draw));
}

/** Flicker for a flame or an old bulb: mostly steady, with the odd sag and dropout. */
export function flicker(t: number, seed: number) {
    const s = seed * 13.37;
    const wobble = 0.08 * Math.sin(t * 7.3 + s) + 0.05 * Math.sin(t * 17.1 + s * 2) + 0.03 * Math.sin(t * 31.7 + s * 3);
    // every few seconds a lamp sags hard for a moment
    const cycle = (t * 0.31 + seed * 0.17) % 1;
    const dropout = cycle > 0.965 ? 0.55 * Math.sin(((cycle - 0.965) / 0.035) * Math.PI) : 0;
    return Math.max(0.05, 1 + wobble - dropout);
}

/**
 * React Three Fiber 8 marked every 8-bit texture handed to a material as a JSX prop
 * as sRGB, data maps (normal, roughness, alpha) included, and the theatre's look was
 * tuned with that. Fiber 9 only does it for colour maps, so the textures passed as
 * props go through this to look as they did. Takes a texture, or an object of them
 * (nested once, as the corridor's surfaces are), marks them and returns it unchanged.
 */
export function srgbLikeFiber8<T>(value: T): T {
    const mark = (v: unknown, depth: number) => {
        if (v instanceof THREE.Texture) {
            if (v.format === THREE.RGBAFormat && v.type === THREE.UnsignedByteType) v.colorSpace = THREE.SRGBColorSpace;
        } else if (v && typeof v === "object" && depth < 2) {
            for (const x of Object.values(v)) mark(x, depth + 1);
        }
    };
    mark(value, 0);
    return value;
}
