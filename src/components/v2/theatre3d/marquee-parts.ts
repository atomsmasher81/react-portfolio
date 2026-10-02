import { flicker } from "@/components/v2/theatre3d/textures";

// Measurements and behaviour of the marquee, in metres, in the sign's own
// space: centre at the origin, facing +Z, the ceiling at y = CEILING.

export const SIGN = {
    w: 3.0,
    h: 1.05,
    back: -0.1, // the steel box runs from here...
    front: 0.02, // ...to here, where the frame and face sit
};
export const CEILING = 1.05;

// The bevelled frame around the face, and the gilt moulding laid on it.
export const FRAME = { depth: 0.035, bevel: 0.012, z: 0.02 };
export const FRAME_FRONT = FRAME.z + FRAME.depth + 2 * FRAME.bevel; // 0.079
export const HOLE = { w: 2.72, h: 0.76 }; // the opening that shows the face
export const MOULD = { outerW: 2.81, outerH: 0.85, innerW: 2.75, innerH: 0.79, depth: 0.006, bevel: 0.007 };

// The rusted face is a little larger than the hole so its edge hides under the frame.
export const FACE = { w: 2.76, h: 0.8, z: 0.03 };

// Neon tubes stand off the face on little posts.
export const TUBE_Z = FACE.z + 0.045;

// Bulbs run round the band between the moulding and the outer edge, clockwise
// from the top left, with brass rosettes in the four corners.
export const BULB = { r: 0.026, socketZ: FRAME_FRONT, z: FRAME_FRONT + 0.05 };
const BAND_X = (MOULD.outerW / 2 + SIGN.w / 2) / 2; // 1.4525
const BAND_Y = (MOULD.outerH / 2 + SIGN.h / 2) / 2; // 0.475
export const CORNERS: [number, number][] = [
    [-BAND_X, BAND_Y],
    [BAND_X, BAND_Y],
    [BAND_X, -BAND_Y],
    [-BAND_X, -BAND_Y],
];

function bulbRing() {
    const out: [number, number][] = [];
    const row = 12;
    const span = 2.6;
    const side = [0.22, 0, -0.22];
    for (let i = 0; i < row; i++) out.push([-span / 2 + (span * i) / (row - 1), BAND_Y]);
    for (const y of side) out.push([BAND_X, y]);
    for (let i = 0; i < row; i++) out.push([span / 2 - (span * i) / (row - 1), -BAND_Y]);
    for (const y of side) out.push([-BAND_X, -y]);
    return out;
}
export const BULBS = bulbRing();
export const BULB_COUNT = BULBS.length; // 30
// For lighting the sign's own metal the bulbs count in runs of three (each
// side divides evenly), lit from the middle of the run.
export const BULB_GROUPS = BULB_COUNT / 3;
export const BULB_GROUP_POINTS = new Float32Array(
    Array.from({ length: BULB_GROUPS }, (_, g) => {
        const [a, b, c] = [BULBS[g * 3], BULBS[g * 3 + 1], BULBS[g * 3 + 2]];
        return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, BULB.z];
    }).flat(),
);

// Character, not chance: a dead bulb, an empty socket and a few on bad contacts.
export const DEAD_BULBS = new Set([4, 23]);
export const MISSING_BULB = 17;
export const UNSURE_BULBS = new Set([9, 14, 27]);

// Rivets: a row round the face just inside the moulding (rust runs down from
// these in the face texture), and a row along the box's underside.
function faceRivets() {
    const out: [number, number][] = [];
    const x0 = 1.31;
    const y0 = 0.345;
    const n = 11;
    for (let i = 0; i < n; i++) {
        const x = -x0 + (2 * x0 * i) / (n - 1);
        out.push([x, y0], [x, -y0]);
    }
    for (const y of [0.17, -0.17]) out.push([-x0, y], [x0, y]);
    return out;
}
export const FACE_RIVETS = faceRivets();

export const NEON_TEXT = "MAGIC THEATRE";
export const NEON_COUNT = NEON_TEXT.length;
export const DYING_LETTER = 10; // the second T
export const NEON_SIZE = 0.25; // font size of the neon letters
export const NEON_BASELINE = 0.02;
export const NEON_TRACK = 0.012; // extra space between tubes

// FOR MADMEN ONLY, a second, smaller run of tube in script beneath the title,
// on its own transformer. It lights the face from three points along it.
export const MADMEN_LINE = { text: "FOR MADMEN ONLY", size: 0.135, baseline: -0.215 };
export const MADMEN_LIGHTS = 3;
export const TUBE_LIGHTS = NEON_COUNT + MADMEN_LIGHTS;

// Chains hang from eye bolts on the box's top to plates on the ceiling.
export const CHAIN_X = 1.22;

// The box office: a little booth built against the outer wall (local -X)
// under the marquee's far end, its window facing the visitor coming in. In
// metres; x runs from the wall toward the middle of the corridor, y is height
// above the floor, z = 0 is the booth's front face.
export const BOOTH = {
    wallX: -1.72, // its left side, just inside the corridor's outer wall
    frontZ: 0.05, // its front face, in the sign's space
    w: 1.38,
    depth: 0.85,
    h: 2.46, // to the top of the cornice, clear of the marquee above
    counter: 1.1, // the sill outside the window
    win: { w: 1.0, h: 1.06, x: 0.69 }, // the arched window: width, height to the top of the arch, centre from the left
};

/** Live state shared by the parts: written once a frame by driveMarquee, read by everyone else. */
export interface MarqueeLive {
    neon: Float32Array; // per character, 0 (dark) to about 1
    neonAvg: number;
    madmen: number; // the script line under the title
    tubeLevels: Float32Array; // every tube light source: the title's letters, then the script line's three
    tubePoints: Float32Array; // where those sources are (xyz), filled in once the type is measured
    bulbs: Float32Array; // per bulb, 0 to about 1
    bulbGroups: Float32Array; // mean of each run of three
    bulbAvg: number;
    lamp: number; // the weak lamp inside the box office, 0 to about 1
}

export function createLive(): MarqueeLive {
    return {
        neon: new Float32Array(NEON_COUNT),
        neonAvg: 0,
        madmen: 0,
        tubeLevels: new Float32Array(TUBE_LIGHTS),
        tubePoints: new Float32Array(TUBE_LIGHTS * 3),
        bulbs: new Float32Array(BULB_COUNT),
        bulbGroups: new Float32Array(BULB_GROUPS),
        bulbAvg: 0,
        lamp: 0,
    };
}

// Cheap deterministic hash in [0, 1).
const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// When the power comes back the tubes don't catch at once: each letter starts
// trying at its own point and fights for a while before it holds.
const IGNITE = Array.from({ length: NEON_COUNT }, (_, k) => 0.56 + 0.06 * hash(k * 7.1 + 2));
const CATCH = 0.22;

/** A healthy tube: a faint buzz, and now and then a stutter that lasts a blink. */
function healthy(k: number, t: number) {
    const buzz = 0.95 + 0.03 * Math.sin(t * 23.0 + k * 1.9) + 0.02 * Math.sin(t * 61.0 + k * 4.3);
    const len = 0.8;
    const tt = t + k * 0.37;
    const w = Math.floor(tt / len);
    if (hash(w * 13.7 + k * 3.3) < 0.06) {
        const local = tt / len - w;
        const start = 0.2 + 0.5 * hash(w * 5.1 + k);
        const dur = 0.07 + 0.12 * hash(w * 9.7 + k * 2.0);
        if (local > start && local < start + dur) {
            const q = (local - start) / dur;
            return buzz * (q < 0.3 || q > 0.7 ? 0.1 : 0.55);
        }
    }
    // The whole transformer sags together, rarely.
    const sag = Math.floor(t / 5.3);
    if (hash(sag * 3.7) < 0.2) {
        const local = t / 5.3 - sag;
        const s0 = 0.3 + 0.4 * hash(sag * 1.3);
        if (local > s0 && local < s0 + 0.025) return buzz * 0.35;
    }
    return buzz;
}

/** The second T: a dull ember at the electrodes, and every few seconds a sputter. */
function dying(t: number) {
    const ember = 0.07 + 0.04 * hash(Math.floor(t * 18) * 1.1);
    const len = 2.7;
    const w = Math.floor(t / len);
    if (hash(w * 7.7 + 1.3) < 0.3) {
        const local = t / len - w;
        const start = 0.15 + 0.6 * hash(w * 3.9);
        const dur = 0.11;
        if (local > start && local < start + dur) {
            const q = (local - start) / dur;
            const on = hash(Math.floor(q * 7) + w * 11.0) > 0.4;
            return on ? 0.45 + 0.55 * hash(w * 2.3) : ember;
        }
    }
    return ember;
}

function neonTarget(k: number, t: number, power: number) {
    if (NEON_TEXT[k] === " ") return 0;
    const ig = IGNITE[k];
    if (power <= ig) return 0;
    const p = clamp01((power - ig) / CATCH);
    const steady = k === DYING_LETTER ? dying(t) : healthy(k, t);
    if (p >= 1) return steady;
    // Sputtering: the word and the letter both have to hold for the tube to light.
    const slot = Math.floor(t * 9);
    const word = k < 5 ? 0 : 1;
    const wordHolds = hash(slot * 1.7 + word * 91.3) < 0.15 + 1.1 * p;
    const letterHolds = hash(slot * 3.1 + k * 17.9) < 0.4 + 0.6 * p;
    if (wordHolds && letterHolds) return steady * (0.7 + 0.3 * p);
    return 0.03 * p;
}

function bulbTarget(i: number, t: number, power: number) {
    if (DEAD_BULBS.has(i) || i === MISSING_BULB) return 0;
    // They come on in a quick chase once the neon has caught.
    if (power < 0.8 + (0.15 * i) / BULB_COUNT) return 0;
    // A slow, gentle chase runs round the ring.
    const c = 0.5 + 0.5 * Math.cos((i / BULB_COUNT) * Math.PI * 6 - t * 1.15);
    let v = 0.74 + 0.26 * c * c;
    if (UNSURE_BULBS.has(i)) {
        v *= Math.min(1, flicker(t * 1.6, i));
        // On a loose contact: in bad spells it drops out for a few frames at a time.
        const bad = hash(Math.floor(t * 0.45) * 5.3 + i) < 0.5;
        if (bad && hash(Math.floor(t * 11) * 1.9 + i * 7.0) < 0.35) v *= 0.06;
    }
    return v;
}

/** The script line: catches a beat after the title, then buzzes along with its own small faults. */
function madmenTarget(t: number, power: number) {
    const ig = 0.66;
    if (power <= ig) return 0;
    const p = clamp01((power - ig) / 0.16);
    const steady = healthy(17, t * 0.9 + 4.1);
    if (p >= 1) return steady;
    const slot = Math.floor(t * 8);
    return hash(slot * 2.3 + 7.1) < 0.2 + 0.9 * p ? steady * (0.7 + 0.3 * p) : 0.03 * p;
}

/**
 * The lamp in the box office: one weak bulb, the last thing to come on. It
 * breathes, slowly and unevenly, and now and then it sinks almost to nothing
 * before it climbs back.
 */
function lampTarget(t: number, power: number) {
    if (power < 0.88) return 0;
    const warm = clamp01((power - 0.88) / 0.12);
    const breath = 0.62 + 0.24 * Math.sin(t * 1.05) + 0.09 * Math.sin(t * 2.71 + 1.3) + 0.04 * Math.sin(t * 6.3 + 0.4);
    const len = 7.3;
    const w = Math.floor(t / len);
    let sink = 1;
    if (hash(w * 4.1 + 0.3) < 0.45) {
        const local = t / len - w;
        const start = 0.2 + 0.5 * hash(w * 6.7);
        const q = (local - start) / 0.18;
        if (q > 0 && q < 1) sink = 1 - 0.8 * Math.sin(q * Math.PI) ** 2;
    }
    return breath * sink * warm;
}

/** Advance the live state by dt seconds at time t. */
export function driveMarquee(live: MarqueeLive, t: number, dt: number, power: number) {
    // Neon is near-instant; filaments take a moment to heat and cool.
    const kn = 1 - Math.exp(-dt * 40);
    const kb = 1 - Math.exp(-dt * 13);
    let sum = 0;
    for (let k = 0; k < NEON_COUNT; k++) {
        live.neon[k] += (neonTarget(k, t, power) - live.neon[k]) * kn;
        sum += live.neon[k];
    }
    live.neonAvg = sum / (NEON_COUNT - 1);
    sum = 0;
    for (let i = 0; i < BULB_COUNT; i++) {
        live.bulbs[i] += (bulbTarget(i, t, power) - live.bulbs[i]) * kb;
        sum += live.bulbs[i];
    }
    live.bulbAvg = sum / BULB_COUNT;
    for (let g = 0; g < BULB_GROUPS; g++) live.bulbGroups[g] = (live.bulbs[g * 3] + live.bulbs[g * 3 + 1] + live.bulbs[g * 3 + 2]) / 3;
    live.madmen += (madmenTarget(t, power) - live.madmen) * kn;
    live.tubeLevels.set(live.neon);
    for (let i = 0; i < MADMEN_LIGHTS; i++) live.tubeLevels[NEON_COUNT + i] = live.madmen;
    live.lamp += (lampTarget(t, power) - live.lamp) * (1 - Math.exp(-dt * 6));
}
