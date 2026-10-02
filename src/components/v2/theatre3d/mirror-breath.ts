import * as THREE from "three";
import { oncePer, rng, type Work } from "@/components/v2/theatre3d/textures";

// Written in the breath. When you stand at the glass long enough it fogs
// from the inside, and a fingertip on the other side writes in the fog for
// you, one phrase at a time, then the fog breathes it away.
//
// The writing is a single-stroke hand (the way a finger writes), laid out in
// the glass's own space (metres, x across, y up) so it reads the right way
// round from the front. Each phrase becomes a small texture holding, for
// every pixel the finger passed over, when it passed (R) and how near the
// middle of the stroke it is (G). The glass shader clears the fog wherever
// the finger has been by now.

type Pt = [number, number] | [number, number, 1]; // a third element marks a sharp corner
interface Glyph {
    w: number; // advance, in x-heights
    s: Pt[][];
}

// Lower case, x-height 1, baseline 0, ascenders to 1.75, descenders to -0.7.
const GLYPHS: Record<string, Glyph> = {
    a: { w: 0.95, s: [[[0.72, 0.8], [0.5, 1.0], [0.2, 0.92], [0.04, 0.55], [0.12, 0.12], [0.38, 0.0], [0.62, 0.14], [0.74, 0.5]], [[0.76, 1.0], [0.76, 0.0]]] },
    b: { w: 0.95, s: [[[0.08, 1.75], [0.08, 0.0]], [[0.08, 0.55], [0.3, 0.93], [0.6, 0.95], [0.8, 0.6], [0.72, 0.15], [0.42, 0.0], [0.1, 0.12]]] },
    c: { w: 0.85, s: [[[0.74, 0.82], [0.48, 1.0], [0.15, 0.86], [0.03, 0.5], [0.15, 0.12], [0.45, 0.0], [0.75, 0.15]]] },
    d: { w: 0.95, s: [[[0.72, 0.72], [0.5, 0.97], [0.2, 0.92], [0.04, 0.55], [0.12, 0.12], [0.38, 0.0], [0.62, 0.14], [0.72, 0.42]], [[0.75, 1.75], [0.75, 0.0]]] },
    e: { w: 0.88, s: [[[0.08, 0.5], [0.78, 0.52], [0.7, 0.86], [0.42, 1.0], [0.12, 0.86], [0.03, 0.5], [0.15, 0.12], [0.45, 0.0], [0.76, 0.16]]] },
    f: { w: 0.62, s: [[[0.68, 1.6], [0.5, 1.75], [0.3, 1.62], [0.25, 1.2], [0.25, 0.0]], [[0.0, 0.96], [0.56, 0.96]]] },
    g: { w: 0.95, s: [[[0.72, 0.72], [0.5, 0.97], [0.2, 0.92], [0.04, 0.55], [0.12, 0.12], [0.38, 0.0], [0.62, 0.14], [0.72, 0.42]], [[0.75, 1.0], [0.75, -0.35], [0.56, -0.66], [0.26, -0.66], [0.06, -0.46]]] },
    h: { w: 0.9, s: [[[0.08, 1.75], [0.08, 0.0]], [[0.08, 0.58], [0.3, 0.94], [0.6, 0.96], [0.76, 0.66], [0.76, 0.0]]] },
    i: { w: 0.36, s: [[[0.15, 1.0], [0.15, 0.0]], [[0.15, 1.42], [0.16, 1.36]]] },
    j: { w: 0.46, s: [[[0.3, 1.0], [0.3, -0.4], [0.15, -0.66], [-0.1, -0.56]], [[0.3, 1.42], [0.31, 1.36]]] },
    k: { w: 0.8, s: [[[0.08, 1.75], [0.08, 0.0]], [[0.68, 1.0], [0.1, 0.42, 1], [0.74, 0.0]]] },
    l: { w: 0.42, s: [[[0.15, 1.75], [0.15, 0.18], [0.24, 0.0], [0.36, 0.02]]] },
    m: { w: 1.2, s: [[[0.08, 1.0], [0.08, 0.0]], [[0.08, 0.64], [0.25, 0.95], [0.45, 0.95], [0.55, 0.66], [0.55, 0.0]], [[0.55, 0.64], [0.72, 0.95], [0.92, 0.95], [1.03, 0.66], [1.03, 0.0]]] },
    n: { w: 0.9, s: [[[0.08, 1.0], [0.08, 0.0]], [[0.08, 0.6], [0.3, 0.95], [0.6, 0.96], [0.76, 0.66], [0.76, 0.0]]] },
    o: { w: 0.95, s: [[[0.5, 1.0], [0.16, 0.88], [0.02, 0.5], [0.14, 0.1], [0.45, 0.0], [0.76, 0.12], [0.87, 0.5], [0.76, 0.88], [0.5, 1.0], [0.36, 0.96]]] },
    p: { w: 0.95, s: [[[0.08, 1.0], [0.08, -0.7]], [[0.08, 0.55], [0.3, 0.93], [0.6, 0.95], [0.8, 0.6], [0.72, 0.15], [0.42, 0.0], [0.1, 0.12]]] },
    q: { w: 0.95, s: [[[0.72, 0.72], [0.5, 0.97], [0.2, 0.92], [0.04, 0.55], [0.12, 0.12], [0.38, 0.0], [0.62, 0.14], [0.72, 0.42]], [[0.75, 1.0], [0.75, -0.7], [0.88, -0.6]]] },
    r: { w: 0.7, s: [[[0.08, 1.0], [0.08, 0.0]], [[0.08, 0.6], [0.28, 0.92], [0.5, 1.0], [0.66, 0.92]]] },
    s: { w: 0.8, s: [[[0.7, 0.86], [0.45, 1.0], [0.15, 0.9], [0.12, 0.65], [0.4, 0.5], [0.68, 0.34], [0.65, 0.1], [0.38, 0.0], [0.05, 0.12]]] },
    t: { w: 0.62, s: [[[0.26, 1.45], [0.26, 0.15], [0.38, 0.0], [0.56, 0.06]], [[0.02, 1.0], [0.56, 1.0]]] },
    u: { w: 0.9, s: [[[0.08, 1.0], [0.08, 0.36], [0.22, 0.05], [0.45, 0.0], [0.68, 0.15], [0.75, 0.45]], [[0.76, 1.0], [0.76, 0.0]]] },
    v: { w: 0.8, s: [[[0.0, 1.0], [0.38, 0.0, 1], [0.76, 1.0]]] },
    w: { w: 1.1, s: [[[0.0, 1.0], [0.25, 0.0, 1], [0.52, 0.76, 1], [0.79, 0.0, 1], [1.04, 1.0]]] },
    x: { w: 0.82, s: [[[0.05, 1.0], [0.76, 0.0]], [[0.76, 1.0], [0.05, 0.0]]] },
    y: { w: 0.82, s: [[[0.02, 1.0], [0.4, 0.06]], [[0.78, 1.0], [0.4, 0.0], [0.2, -0.54], [0.02, -0.68]]] },
    z: { w: 0.85, s: [[[0.05, 1.0], [0.76, 1.0, 1], [0.05, 0.0, 1], [0.78, 0.0]]] },
    "'": { w: 0.26, s: [[[0.12, 1.75], [0.09, 1.38]]] },
    ",": { w: 0.32, s: [[[0.14, 0.1], [0.05, -0.26]]] },
    ".": { w: 0.32, s: [[[0.12, 0.05], [0.13, 0.0]]] },
    "-": { w: 0.6, s: [[[0.05, 0.5], [0.52, 0.5]]] },
    "?": { w: 0.78, s: [[[0.06, 1.45], [0.3, 1.72], [0.6, 1.66], [0.68, 1.36], [0.36, 1.0], [0.34, 0.6]], [[0.34, 0.06], [0.35, 0.0]]] },
    "!": { w: 0.36, s: [[[0.16, 1.75], [0.15, 0.5]], [[0.15, 0.06], [0.16, 0.0]]] },
};

/** How the writing sits on the glass. */
export const HAND = {
    xHeight: 0.09, // metres
    finger: 0.0085, // half the width of the clear trail
    tracking: 0.14, // extra space between letters, in x-heights
    space: 0.62, // a word gap, in x-heights
    line: 2.75, // line spacing, in x-heights
    maxWidth: 0.95, // wrap wider phrases, so they fit a phone's view of the glass
    centre: new THREE.Vector2(0, 1.82), // where a phrase is centred on the glass
    speed: 0.55, // metres a second along the stroke
};

export interface Phrase {
    /** R: when the finger passed (0..1 of the writing time), G: closeness to the middle of the stroke. */
    texture: THREE.DataTexture;
    /** Glass-space rectangle the texture covers: min x, min y, width, height. */
    rect: THREE.Vector4;
    /** Seconds it takes to write. */
    duration: number;
    /** Up to two drips: x, y where they start, seconds into the writing they start, how far they run. */
    drips: THREE.Vector4[];
}

interface Seg {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    ta: number;
    tb: number;
}

/** Catmull-Rom through a run of points, sampled every `step` metres. */
function sampleRun(pts: [number, number][], step: number): [number, number][] {
    if (pts.length < 2) return pts.slice();
    const out: [number, number][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
        for (let j = 0; j < n; j++) {
            const t = j / n;
            const t2 = t * t;
            const t3 = t2 * t;
            const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
            out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
    }
    out.push(pts[pts.length - 1]);
    return out;
}

/** A stroke as a dense polyline, smooth except at its marked corners. */
function sampleStroke(pts: Pt[], step: number): [number, number][] {
    const out: [number, number][] = [];
    let run: [number, number][] = [];
    pts.forEach((p, i) => {
        run.push([p[0], p[1]]);
        if ((p.length === 3 && i > 0) || i === pts.length - 1) {
            const part = sampleRun(run, step);
            out.push(...(out.length ? part.slice(1) : part));
            run = [[p[0], p[1]]];
        }
    });
    return out;
}

/** Lay out a phrase in the glass's space and write it, stroke by stroke. Kept (the same phrase is the same writing). */
export function writePhrase(text: string): Phrase {
    return written(text);
}
/** Write these phrases a slice at a time: then writePhrase has them at once. */
export const preparePhrases = (texts: string[]) => Promise.all(texts.map((t) => written.of(t).prepare()));

const written = oncePer((text: string) => writePhraseWork(text));

function* writePhraseWork(text: string): Work<Phrase> {
    const seed = Array.from(text).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const r = rng(seed);
    const xh = HAND.xHeight;
    const words = text
        .toLowerCase()
        .split(/\s+/)
        .map((w) => Array.from(w).filter((c) => GLYPHS[c]))
        .filter((w) => w.length);
    const wordWidth = (w: string[]) => w.reduce((s, c) => s + GLYPHS[c].w + HAND.tracking, -HAND.tracking) * xh;

    // greedy wrap
    const lines: string[][][] = [];
    let line: string[][] = [];
    let width = 0;
    for (const w of words) {
        const ww = wordWidth(w);
        const add = line.length ? HAND.space * xh + ww : ww;
        if (line.length && width + add > HAND.maxWidth) {
            lines.push(line);
            line = [w];
            width = ww;
        } else {
            line.push(w);
            width += add;
        }
    }
    if (line.length) lines.push(line);

    // strokes in glass space, with the small unevenness of a hand: each letter
    // a touch bigger or smaller, leaning, off the line
    const strokes: { pts: [number, number][]; gap: number }[] = [];
    const lineH = HAND.line * xh;
    const top = HAND.centre.y + ((lines.length - 1) * lineH) / 2 - 0.35 * xh;
    lines.forEach((ln, li) => {
        const lw = ln.reduce((s, w, i) => s + wordWidth(w) + (i ? HAND.space * xh : 0), 0);
        let x = HAND.centre.x - lw / 2;
        const base = top - li * lineH;
        let drift = 0;
        ln.forEach((w, wi) => {
            w.forEach((c, ci) => {
                const g = GLYPHS[c];
                const size = xh * (0.94 + r() * 0.12);
                const lean = (r() - 0.5) * 0.08 + 0.05;
                drift += (r() - 0.5) * 0.006;
                const y0 = base + drift + (r() - 0.5) * 0.008;
                g.s.forEach((s, si) => {
                    const pts = s.map((p) => [x + (p[0] + p[1] * lean) * size, y0 + p[1] * size, p[2]].filter((v) => v !== undefined) as Pt);
                    strokes.push({ pts: sampleStroke(pts, 0.002), gap: si === 0 ? (ci === 0 ? (wi === 0 ? 0.05 : 0.28) : 0.09) : 0.07 });
                });
                x += (g.w + HAND.tracking) * xh;
            });
            x += HAND.space * xh;
        });
    });

    // timing: the finger moves at a steady pace, lifts between strokes
    const segs: Seg[] = [];
    let t = 0;
    const lows: { x: number; y: number; t: number }[] = [];
    for (const s of strokes) {
        t += s.gap;
        for (let i = 0; i < s.pts.length - 1; i++) {
            const [ax, ay] = s.pts[i];
            const [bx, by] = s.pts[i + 1];
            const dt = Math.hypot(bx - ax, by - ay) / HAND.speed;
            segs.push({ ax, ay, bx, by, ta: t, tb: t + dt });
            t += dt;
        }
        // where a downstroke ends near the line, a drop can gather and run
        const end = s.pts[s.pts.length - 1];
        const prev = s.pts[Math.max(0, s.pts.length - 9)];
        if (s.pts.length > 10 && prev[1] - end[1] > 0.011 && Math.abs(prev[0] - end[0]) < 0.008) lows.push({ x: end[0], y: end[1], t });
    }
    const duration = t + 0.2;

    // the texture, a little bigger than the writing
    const pad = HAND.finger * 2.5;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of segs) {
        minX = Math.min(minX, s.ax, s.bx);
        maxX = Math.max(maxX, s.ax, s.bx);
        minY = Math.min(minY, s.ay, s.by);
        maxY = Math.max(maxY, s.ay, s.by);
    }
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const px = Math.max(0.0011, (maxX - minX) / 1024);
    const W = Math.ceil((maxX - minX) / px);
    const H = Math.ceil((maxY - minY) / px);
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) data[i * 4] = 255;
    const rad = HAND.finger;
    yield;
    for (let si = 0; si < segs.length; si++) {
        const s = segs[si];
        if (si % 48 === 47) yield;
        const x0 = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - rad - minX) / px));
        const x1 = Math.min(W - 1, Math.ceil((Math.max(s.ax, s.bx) + rad - minX) / px));
        const y0 = Math.max(0, Math.floor((Math.min(s.ay, s.by) - rad - minY) / px));
        const y1 = Math.min(H - 1, Math.ceil((Math.max(s.ay, s.by) + rad - minY) / px));
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const len2 = dx * dx + dy * dy || 1e-9;
        for (let yi = y0; yi <= y1; yi++) {
            const py = minY + (yi + 0.5) * px;
            for (let xi = x0; xi <= x1; xi++) {
                const pxx = minX + (xi + 0.5) * px;
                const f = Math.min(1, Math.max(0, ((pxx - s.ax) * dx + (py - s.ay) * dy) / len2));
                const d = Math.hypot(pxx - (s.ax + dx * f), py - (s.ay + dy * f));
                if (d > rad) continue;
                const i = (yi * W + xi) * 4;
                const when = Math.round(((s.ta + (s.tb - s.ta) * f) / duration) * 254);
                if (when < data[i]) data[i] = when;
                const near = Math.round((1 - d / rad) * 255);
                if (near > data[i + 1]) data[i + 1] = near;
                data[i + 3] = 255;
            }
        }
    }
    const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    // one drip, sometimes two, from letters in the middle of the phrase
    const drips: THREE.Vector4[] = [];
    const mid = lows.filter((l, i) => i > 0 && i < lows.length - 1);
    const pick = (mid.length ? mid : lows).slice();
    const count = pick.length ? (r() < 0.45 ? 2 : 1) : 0;
    for (let i = 0; i < count && pick.length; i++) {
        const k = Math.floor(r() * pick.length);
        const l = pick.splice(k, 1)[0];
        drips.push(new THREE.Vector4(l.x + (r() - 0.5) * 0.004, l.y + 0.002, l.t + 0.35 + r() * 0.5, 0.07 + r() * 0.17));
    }
    return { texture, rect: new THREE.Vector4(minX, minY, maxX - minX, maxY - minY), duration, drips };
}

/* ---------------------------------------------------------------- timing */

export const BREATH = {
    wait: 2.5, // seconds of lingering before the glass begins to fog
    build: 3.0, // and how long the fog takes to spread
    hold: 4.0, // a written phrase stays this long
    away: 2.2, // the fog breathes it away
    rest: 1.0, // before the next is written
};

export interface BreathState {
    /** 0..1, how far the fog has spread and thickened. */
    fog: number;
    /** Which phrase is on the glass (index into the list), or -1. */
    phrase: number;
    /** Seconds into writing the phrase. */
    writeSec: number;
    /** 0..1, how far the fog has crept back over the writing. */
    refog: number;
}

/**
 * Where the breath is after `linger` seconds at the glass. With phrases it
 * writes them in turn (starting from `first`); without, the fog simply comes
 * and goes.
 */
export function breathAt(linger: number, durations: number[], first: number, out: BreathState) {
    out.phrase = -1;
    out.writeSec = 0;
    out.refog = 0;
    const t = linger - BREATH.wait;
    if (t <= 0) {
        out.fog = 0;
        return out;
    }
    const ease = (x: number) => x * x * (3 - 2 * x);
    if (t < BREATH.build) {
        out.fog = ease(t / BREATH.build);
        return out;
    }
    let u = t - BREATH.build;
    if (!durations.length) {
        // a slow breath: thick, thinning, thick again
        const cycle = 14;
        const k = u % cycle;
        out.fog = k < 7 ? 1 : k < 10 ? 1 - 0.65 * ease((k - 7) / 3) : k < 11.5 ? 0.35 : 0.35 + 0.65 * ease((k - 11.5) / 2.5);
        return out;
    }
    out.fog = 1;
    const n = durations.length;
    const at = (i: number) => durations[(first + i) % n];
    const period = (d: number) => d + BREATH.hold + BREATH.away + BREATH.rest;
    const total = durations.reduce((s, d) => s + period(d), 0);
    u -= Math.floor(u / total) * total;
    let i = 0;
    while (i < n - 1 && u > period(at(i))) {
        u -= period(at(i));
        i++;
    }
    const d = at(i);
    out.phrase = (first + i) % n;
    out.writeSec = Math.min(u, d + BREATH.hold + BREATH.away);
    const after = u - d - BREATH.hold;
    out.refog = after <= 0 ? 0 : ease(Math.min(1, after / BREATH.away));
    // the glass breathes a little as the phrase goes
    out.fog = 1 - 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, after / (BREATH.away + BREATH.rest))));
    return out;
}
