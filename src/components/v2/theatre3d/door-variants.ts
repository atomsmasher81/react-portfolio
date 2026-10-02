import { rng } from "@/components/v2/theatre3d/textures";
import { OUTER } from "@/components/v2/theatre3d/layout";

// Measurements of one door, in metres, in the door's own space: the wall is
// the plane z = 0, x = 0 is the middle of the opening, y = 0 the floor, and
// the door faces +Z. The hinge is on the left as you face it.

export const D = {
    half: 0.675, // half the opening's width
    spring: 1.875, // where the arch springs from the jambs (2.55 to the top)
    sill: 0.06, // top of the threshold step
    face: 0.125, // front of the stone surround
    roomZ: 0.03, // the glowing room surface; a little proud of z = 0 so a curved wall can't swallow it
    leafW: 1.326,
    leafB: 0.082, // underside of the leaf (a gap of ~2 cm above the sill)
    leafZ: 0.105, // front face of the leaf, and the hinge line
    leafT: 0.06,
    // The brass plaque hangs on the wall beside the door, on the +X side (deeper
    // along the corridor, where the walking camera glances), at eye height,
    // clear of the stones and above the wainscot rail.
    plateU: 1.52, // along the wall from the door's centre
    plateY: 1.56,
    plateW: 0.58,
    plateH: 0.46,
};

/**
 * The corridor's outer wall is curved, not the plane z = 0, and the scene sets
 * each door this far in front of it. Things mounted on the wall away from the
 * door (the plaque) follow the curve so they sit on it.
 */
export const WALL_PROUD = 0.04;

/** A point on the curved wall `u` metres along it from the door's centre: door-space x, z and the turn to face out from it. */
export function onWall(u: number) {
    const a = u / OUTER;
    return { x: OUTER * Math.sin(a), z: OUTER * (1 - Math.cos(a)) - WALL_PROUD, yaw: -a };
}

/** Hinge line in door space (x, z). */
export const HINGE_X = -D.leafW / 2;

/** Leaf-local arch: centre height above the leaf's underside, and radius. */
export const LEAF_SPRING = D.spring - D.leafB;
export const LEAF_R = D.leafW / 2;

/** Height of the leaf's top edge at leaf-local x (0 at the hinge). */
export function leafTop(x: number) {
    const dx = x - LEAF_R;
    return LEAF_SPRING + Math.sqrt(Math.max(LEAF_R * LEAF_R - dx * dx, 0));
}

export type Corner = "bl" | "br" | "tl" | "tr" | null;

export interface DoorVariant {
    id: number;
    seed: number;
    planks: number[]; // leaf-local x of each plank's left edge, plus the right edge
    hinges: [number, number]; // leaf-local heights of the two strap hinges
    hingeLen: [number, number];
    sag: number; // the lower hinge strap droops a little, radians
    bands: number[]; // leaf-local heights of plain iron bands across
    ghostBand: number | null; // a band that has fallen off, leaving its rust print
    knocker: boolean;
    broken: Corner;
    cracks: { x: number; y0: number; y1: number; leak: number }[]; // leaf-local, along the grain
    replaced: number; // a plank swapped in later (lighter), or -1
    hue: [number, number, number]; // multiplier on the wood colour
    plaqueTilt: number;
    plaqueHang: boolean; // hangs by one screw
    keystoneDrop: number; // the keystone has slipped a little, metres
}

// The six doors along the corridor. Everything else (stains, knots, chips)
// comes from the seed.
const TABLE: Omit<DoorVariant, "id" | "seed" | "planks" | "cracks">[] = [
    { hinges: [0.34, 1.66], hingeLen: [0.98, 0.9], sag: 0.012, bands: [0.76], ghostBand: null, knocker: true, broken: null, replaced: -1, hue: [1, 1, 1], plaqueTilt: -0.03, plaqueHang: false, keystoneDrop: 0.008 },
    { hinges: [0.3, 1.7], hingeLen: [0.92, 0.95], sag: 0.025, bands: [0.72, 1.36], ghostBand: null, knocker: false, broken: "br", replaced: 2, hue: [1.08, 0.98, 0.9], plaqueTilt: 0.045, plaqueHang: false, keystoneDrop: 0 },
    { hinges: [0.38, 1.62], hingeLen: [1.0, 0.94], sag: 0.006, bands: [0.8, 2.04], ghostBand: null, knocker: true, broken: "tl", replaced: -1, hue: [0.9, 0.92, 0.95], plaqueTilt: -0.06, plaqueHang: false, keystoneDrop: 0.014 },
    { hinges: [0.33, 1.68], hingeLen: [0.96, 0.88], sag: 0.018, bands: [0.74], ghostBand: 2.02, knocker: true, broken: null, replaced: 4, hue: [1.04, 0.95, 0.92], plaqueTilt: 0.46, plaqueHang: true, keystoneDrop: 0.004 },
    { hinges: [0.4, 1.64], hingeLen: [0.94, 1.0], sag: 0.03, bands: [0.78], ghostBand: 1.36, knocker: false, broken: "bl", replaced: -1, hue: [0.95, 1.0, 1.04], plaqueTilt: 0.02, plaqueHang: false, keystoneDrop: 0.02 },
    { hinges: [0.32, 1.72], hingeLen: [0.9, 0.97], sag: 0.01, bands: [0.7, 2.06], ghostBand: null, knocker: true, broken: "tr", replaced: 1, hue: [1.1, 1.0, 0.94], plaqueTilt: -0.025, plaqueHang: false, keystoneDrop: 0.01 },
];

const PLANK_COUNTS = [6, 5, 7, 6, 5, 7];

const cache = new Map<number, DoorVariant>();

/** The deterministic look of the door at a given corridor index. */
export function doorVariant(index: number): DoorVariant {
    const id = ((index % 6) + 6) % 6;
    const hit = cache.get(id);
    if (hit) return hit;
    const seed = 1009 + id * 7919;
    const r = rng(seed);

    // Plank widths: roughly equal, never quite.
    const n = PLANK_COUNTS[id];
    const widths = Array.from({ length: n }, () => 0.85 + r() * 0.3);
    const total = widths.reduce((a, b) => a + b, 0);
    const planks = [0];
    for (const w of widths) planks.push(planks[planks.length - 1] + (w / total) * D.leafW);
    planks[n] = D.leafW;

    // Splits run along the grain, from the top or bottom edge or mid-plank.
    const cracks: DoorVariant["cracks"] = [];
    const count = 1 + (id % 3);
    for (let i = 0; i < count; i++) {
        const p = 1 + Math.floor(r() * (n - 2));
        const x = planks[p] + (planks[p + 1] - planks[p]) * (0.3 + r() * 0.4);
        const fromBottom = r() < 0.5;
        const len = 0.35 + r() * 0.7;
        const y0 = fromBottom ? 0 : 0.5 + r() * 0.6;
        cracks.push({ x, y0, y1: Math.min(y0 + len, leafTop(x) - 0.02), leak: r() < 0.7 ? 1 : 0 });
    }

    const v: DoorVariant = { id, seed, planks, cracks, ...TABLE[id] };
    cache.set(id, v);
    return v;
}

/** Leaf-local position of the keyhole and the knocker. */
export const KEYHOLE = { x: D.leafW - 0.13, y: 1.0 };
export const KNOCKER = { x: D.leafW / 2, y: 1.44 };
export const HANDLE = { x: D.leafW - 0.13, y: 1.2 };
