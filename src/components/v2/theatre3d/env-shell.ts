import * as THREE from "three";
import { CORRIDOR, DOOR_S, INNER, LAMP_S, OUTER, metres, onArc, outward, tangent } from "@/components/v2/theatre3d/layout";
import { once, rng, valueNoise, type Work } from "@/components/v2/theatre3d/textures";
import { smoothstep } from "@/components/v2/theatre3d/env-textures";
import { Mesher, WORLD, addGeometry, flatFrame, raisedPanel, ringFrame, sheet, slab, sweep, wallFrame, type Frame, type Shade, type Side, type WallFrame } from "@/components/v2/theatre3d/env-geometry";

// The corridor's fixed parts, built once into a few merged geometries (one per
// material): wallpaper, panelling, beams, ceiling, floor, runner, sconce
// ironwork, picture frames, grime and cobwebs. Also where the lamps are.

const S0 = CORRIDOR.start;
const S1 = CORRIDOR.end;
const H = CORRIDOR.height;
const R = CORRIDOR.radius;
/** The long walls run this far (in s) past each end wall, hidden behind it, so no corner ever opens. */
const OVER = 0.0045;
/** Wainscot: the frame's face stands this far off the wallpaper. */
const FACE = 0.04;
/** Mouldings stop this far either side of each door's centre. */
const DOOR_HALF = 1.1;
/** The far end wall sits this far behind s = 1, so nothing of ours pokes through the mirror. */
const FAR_BACK = 0.09;
/** The face of its raised panels. */
const PANEL_FACE = -FAR_BACK + 0.034;

export const LAMP_Y = 2.255;
export const LAMP_OUT = 0.215; // the flame, out from the wall

/* ------------------------------------------------------------ the lamps */

export interface Lamp {
    s: number;
    /** "end": the pair flanking the mirror on the far wall. */
    side: Side | "end";
    seed: number;
    /** The power level at which it comes on. */
    order: number;
    /** Has a real light on high / on low. */
    real: boolean;
    realLow: boolean;
    /** Runs dim and stutters now and then. */
    faulty: boolean;
    /** Light output relative to the others: the last lamp lights the mirror, so it burns brighter. */
    strength: number;
    /** Wall space at the lamp (x along the wall, y up, z out of it) to world. */
    basis: THREE.Matrix4;
    frame: Frame;
    core: THREE.Vector3;
    light: THREE.Vector3;
}

const LOW_LIGHTS = [0.1, 0.4, 0.667, 0.93];
const HIGH_INNER = [0.02, 0.333, 0.6];
/** The far wall, seen from the corridor: u runs from the outer wall to the inner. */
const farFrame = () => flatFrame(onArc(S1, OUTER + 0.06), outward(S1).negate());
/** Two sconces flank the mirror, on the far wall's narrow side bays (u along it). */
const END_LAMPS = [0.34, 3.18];

function makeLamps(): Lamp[] {
    const up = new THREE.Vector3(0, 1, 0);
    const make = (s: number, side: Lamp["side"], seed: number, origin: THREE.Vector3, right: THREE.Vector3): Lamp => {
        const out = new THREE.Vector3().crossVectors(right, up);
        return {
            s,
            side,
            seed,
            order: 0,
            real: side === "outer" || (side === "inner" && HIGH_INNER.includes(s)),
            realLow: side === "outer" && LOW_LIGHTS.includes(s),
            // the failing outer lamp is the one by the mirror, which burns steady in the glass
            faulty: (side === "outer" && s === 0.93) || (side === "inner" && s === 0.466),
            strength: side === "outer" && s >= 0.93 ? 1.6 : 1,
            basis: new THREE.Matrix4().makeBasis(right, up, out).setPosition(origin),
            frame: flatFrame(origin, right),
            core: origin.clone().addScaledVector(out, LAMP_OUT).setY(LAMP_Y),
            light: origin.clone().addScaledVector(out, 0.6).setY(2.25),
        };
    };
    const list = (["outer", "inner"] as const).flatMap((side) =>
        LAMP_S[side].map((s, i) => make(s, side, (side === "outer" ? 1 : 21) + i * 3.7, onArc(s, side === "outer" ? OUTER : INNER), side === "outer" ? tangent(s) : tangent(s).negate())),
    );
    const far = farFrame();
    END_LAMPS.forEach((u, i) => list.push(make(S1, "end", 41 + i * 3.7, far.point(u, 0, PANEL_FACE, new THREE.Vector3()), outward(S1).negate())));
    // They come back on roughly from the entrance inward, not quite in order.
    const r = rng(17);
    const ranked = list.map((l, i) => ({ i, key: l.s + (r() - 0.5) * 0.16 })).sort((a, b) => a.key - b.key);
    ranked.forEach(({ i }, rank) => (list[i].order = 0.15 + (0.72 * rank) / (list.length - 1)));
    // The faulty outer lamp hesitates until last.
    list.forEach((l) => l.faulty && l.side === "outer" && (l.order = 0.93));
    return list;
}

let lamps: Lamp[] | null = null;
export const getLamps = () => (lamps ??= makeLamps());

/* ------------------------------------------------------------ profiles */

// Profiles are [d, y] from the bottom up, the visible side facing +d.
const SKIRT: [number, number][] = [
    [FACE + 0.016, 0],
    [FACE + 0.016, 0.15],
    [FACE + 0.012, 0.162],
    [FACE + 0.007, 0.176],
    [FACE + 0.002, 0.19],
    [FACE, 0.2],
];
const RAIL: [number, number][] = [
    [FACE, 1.15],
    [FACE + 0.012, 1.156],
    [FACE + 0.02, 1.168],
    [FACE + 0.024, 1.185],
    [FACE + 0.022, 1.2],
    [FACE + 0.028, 1.21],
    [FACE + 0.036, 1.225],
    [FACE + 0.04, 1.245],
    [FACE + 0.038, 1.265],
    [FACE + 0.03, 1.282],
    [FACE + 0.018, 1.293],
    [FACE + 0.002, 1.299],
    [0, 1.3],
];
const PLATE: [number, number][] = [
    [-0.1, 3.84],
    [0.17, 3.84],
    [0.19, 3.86],
    [0.19, H + 0.02],
];
const shift = (p: [number, number][], dd: number): [number, number][] => p.map(([d, y]) => [d + dd, y]);

/* ------------------------------------------------------------ builders */

/**
 * Wainscot between u = a and b: a frame of rails and stiles, raised panels in
 * it, skirting and a chair rail. Panels are laid out between `from` and `to`
 * (the faces of the end walls); `caps` closes the ends at a door.
 */
function wainscot(m: Mesher, f: Frame, a: number, b: number, from: number, to: number, seed: number, caps: [boolean, boolean], base = 0, shade = 1) {
    const r = rng(seed);
    const tone = (): Shade => {
        const k = shade * (0.86 + r() * 0.26);
        return [k, k * 0.97, k * 0.94];
    };
    const skip = (...faces: ("front" | "back" | "top" | "bottom" | "left" | "right")[]) => faces;
    const endSkip = skip(...(caps[0] ? [] : (["left"] as const)), ...(caps[1] ? [] : (["right"] as const)));
    slab(m, f, a, b, 0, 0.34, base, base + FACE, { step: 0.4, shade: tone(), skip: [...skip("back", "bottom"), ...endSkip], uvOffset: [0, r() * 9] });
    slab(m, f, a, b, 1.03, 1.15, base, base + FACE, { step: 0.4, shade: tone(), skip: [...skip("back", "top"), ...endSkip], uvOffset: [0, r() * 9] });
    sweep(m, f, shift(SKIRT, base), a, b, { step: 0.4, caps, uv: "uy", shade: tone() });
    sweep(m, f, shift(RAIL, base), a, b, { step: 0.3, caps, uv: "uy", shade: tone() });
    const stile = 0.11;
    const lo = Math.max(a, from);
    const hi = Math.min(b, to);
    const L = hi - lo;
    if (L < stile * 3) {
        slab(m, f, a, b, 0.34, 1.03, base, base + FACE, { shade: tone(), skip: skip("back", "top", "bottom") });
        return;
    }
    const n = Math.max(1, Math.round((L - stile) / (0.92 + stile)));
    const pw = (L - stile * (n + 1)) / n;
    for (let k = 0; k <= n; k++) {
        // stiles; the end ones reach out to the run's ends
        const s0 = k === 0 ? a : lo + k * (pw + stile);
        const s1 = k === n ? b : lo + k * (pw + stile) + stile;
        const sk = skip("back", "top", "bottom");
        if (k === 0 && !caps[0]) sk.push("left");
        if (k === n && !caps[1]) sk.push("right");
        slab(m, f, s0, s1, 0.34, 1.03, base, base + FACE, { step: 0.4, shade: tone(), skip: sk, uvOffset: [r() * 9, 0] });
        if (k < n) {
            const u0 = lo + stile + k * (pw + stile);
            raisedPanel(m, f, u0, u0 + pw, 0.34, 1.03, base + 0.022, { raise: 0.012, bevel: 0.05, shade: tone(), uvOffset: [r() * 9, r() * 9] });
        }
    }
}

/** A beam across the corridor (its length along d), with its grain along the length. */
function beamBox(m: Mesher, f: Frame, half: number, y0: number, y1: number, d0: number, d1: number, off: number) {
    const sc = 0.5; // the beam texture is 2 m long
    const quad = (pts: [number, number, number][], n: [number, number, number], uvs: [number, number][]) => {
        const ids = pts.map(([u, y, d], i) => m.vert(f, u, y, d, n[0], n[1], n[2], (uvs[i][0] + off) * sc, uvs[i][1] * sc));
        m.quad(ids[0], ids[1], ids[2], ids[3]);
    };
    const w = half * 2;
    const h = y1 - y0;
    quad(
        [
            [-half, y0, d0],
            [half, y0, d0],
            [half, y0, d1],
            [-half, y0, d1],
        ],
        [0, -1, 0],
        [
            [d0, 0],
            [d0, w],
            [d1, w],
            [d1, 0],
        ],
    );
    for (const side of [-1, 1]) {
        quad(
            [
                [side * half, y0, d0],
                [side * half, y1, d0],
                [side * half, y1, d1],
                [side * half, y0, d1],
            ],
            [side, 0, 0],
            [
                [d0, w + (side > 0 ? h : 0)],
                [d0, w + (side > 0 ? 0 : h)],
                [d1, w + (side > 0 ? 0 : h)],
                [d1, w + (side > 0 ? h : 0)],
            ],
        );
    }
}

const CORBEL: [number, number][] = [
    [0.06, 3.4],
    [0.1, 3.43],
    [0.17, 3.52],
    [0.22, 3.64],
    [0.25, 3.76],
    [0.26, 4.0],
];

/* ------------------------------------------------------------ the shell */

export interface Shell {
    paper: THREE.BufferGeometry;
    wood: THREE.BufferGeometry;
    beams: THREE.BufferGeometry;
    ceiling: THREE.BufferGeometry;
    /** In local XY: rotate the mesh -90 degrees about X. */
    floor: THREE.BufferGeometry;
    runner: THREE.BufferGeometry;
    fringe: THREE.BufferGeometry;
    iron: THREE.BufferGeometry;
    gilt: THREE.BufferGeometry;
    canvas: THREE.BufferGeometry;
    grime: THREE.BufferGeometry;
    webs: THREE.BufferGeometry;
    /** Sconce parts placed per lamp by instancing: the glass and the flame. */
    chimney: THREE.BufferGeometry;
    flame: THREE.BufferGeometry;
}

const IRON: Shade = [0.3, 0.28, 0.27];
const BRASS: Shade = [1.6, 1.15, 0.55];

function* buildShell(): Work<Shell> {
    const r = rng(4242);
    const blot = valueNoise(7, 64);
    const paper = new Mesher();
    const wood = new Mesher();
    const beams = new Mesher();
    const ceiling = new Mesher();
    const floor = new Mesher();
    const runner = new Mesher();
    const fringe = new Mesher();
    const iron = new Mesher();
    const gilt = new Mesher();
    const canvas = new Mesher();
    const grime = new Mesher(true);
    const webs = new Mesher();

    const outerF = wallFrame("outer", S0 - OVER);
    const innerF = wallFrame("inner", S1 + OVER);
    const oEnd = outerF.uAt(S1 + OVER);
    const iEnd = innerF.uAt(S0 - OVER);

    /* the wallpapered walls */
    const rows = [0, 1.0, 1.3, 1.8, 2.4, 3.0, 3.5, 3.85, H + 0.02];
    const paperShade = (k: number) => (u: number, y: number): Shade => {
        const top = 1 - 0.5 * smoothstep(2.4, 4.2, y);
        const b = (0.7 + 0.55 * blot(u * 0.35 + k * 40, y * 0.45)) * top;
        return [b * 1.02, b * 0.96, b * 0.92];
    };
    sheet(paper, outerF, 0, oEnd, rows, 0, { step: 0.2, uv: (u, y) => [u / 3.2, (y - 1) / 3.2], shade: paperShade(0) });
    sheet(paper, innerF, 0, iEnd, rows, 0, { step: 0.2, uv: (u, y) => [(u + 1.3) / 3.2, (y - 1) / 3.2], shade: paperShade(1) });
    yield;

    /* wainscot along both walls, broken at each door */
    const doorsU = DOOR_S.map((s) => outerF.uAt(s));
    const runs: [number, number][] = [];
    let at = 0;
    for (const du of doorsU) {
        runs.push([at, du - DOOR_HALF]);
        at = du + DOOR_HALF;
    }
    runs.push([at, oEnd]);
    const oFrom = outerF.uAt(S0) + 0.08;
    const oTo = outerF.uAt(S1) + FAR_BACK - FACE;
    runs.forEach(([a, b], i) => wainscot(wood, outerF, a, b, oFrom, oTo, 100 + i, [i > 0, i < runs.length - 1]));
    wainscot(wood, innerF, 0, iEnd, innerF.uAt(S1) - FAR_BACK + FACE, innerF.uAt(S0) - 0.08, 200, [false, false]);
    yield;

    /* wall plates: a heavy timber along the top of each wall */
    sweep(beams, outerF, PLATE, 0, oEnd, { step: 0.5, uv: "ux", uvOffset: 0 });
    sweep(beams, innerF, PLATE, 0, iEnd, { step: 0.5, uv: "ux", uvOffset: 3 });

    /* beams across, every two metres or so, resting on corbels */
    const count = 18;
    for (let k = 0; k < count; k++) {
        const s = S0 + ((k + 0.5) * (S1 - S0)) / count;
        const f = flatFrame(onArc(s, INNER - 0.06), tangent(s).negate());
        const half = 0.13 + r() * 0.03;
        const depth = 0.32 + r() * 0.07;
        beamBox(beams, f, half, H - depth, H + 0.01, 0, OUTER - INNER + 0.12, r() * 4);
        const nearDoor = DOOR_S.some((ds) => Math.abs(ds - s) < 0.032);
        sweep(beams, f, CORBEL, -half + 0.02, half - 0.02, { caps: [true, true], uv: "ux", step: 1 });
        if (!nearDoor) sweep(beams, flatFrame(onArc(s, OUTER + 0.06), tangent(s)), CORBEL, -half + 0.02, half - 0.02, { caps: [true, true], uv: "ux", step: 1 });
        // cobwebs in a few corners where a beam meets the wall plate
        if (k % 4 === 2) {
            const wf = k % 8 === 2 ? outerF : innerF;
            const ub = wf.uAt(s);
            const sideU = k % 3 === 0 ? 1 : -1;
            web(webs, wf, [ub + sideU * (half + 0.004), 4.16, 0.195], [ub + sideU * (half + 0.004), 3.9, 0.6 + r() * 0.2], [ub + sideU * (half + 0.45 + r() * 0.2), 3.86, 0.195]);
            web(webs, wf, [ub - sideU * (half + 0.004), H - 0.01, 0.4], [ub - sideU * (half + 0.004), H - 0.2, 0.95], [ub - sideU * (half + 0.4), H - 0.01, 0.85]);
        }
        yield;
    }

    /* the ceiling: sooty plaster */
    const ringW = ringFrame(S0 - OVER, R);
    const ringLen = metres(S1 - S0 + 2 * OVER);
    sheet(ceiling, ringW, 0, ringLen, [-0.1, 0.5, 1.2, 1.7, 2.2, 2.9, OUTER - INNER + 0.1], H, {
        step: 0.3,
        facing: -1,
        uv: (u, y) => [u / 2, y / 2],
        shade: (u, y) => 0.55 + 0.45 * (1 - Math.abs(y - 1.7) / 1.9) * (0.75 + 0.5 * blot(u * 0.2, 9)),
    });

    yield;
    /* the floor, built flat in XY for the reflector */
    const ringL = ringFrame(S0 - OVER, R, true);
    sheet(floor, ringL, 0, ringLen, [-0.1, 0.3, 0.8, 1.3, 1.7, 2.1, 2.6, 3.1, OUTER - INNER + 0.1], 0, {
        step: 0.25,
        uv: (u, y) => [u / 4, y / 1.6],
        shade: (u, y) => {
            const edge = Math.min(y, OUTER - INNER - y);
            return (0.62 + 0.38 * smoothstep(-0.1, 0.9, edge)) * (0.85 + 0.3 * blot(u * 0.25, 20));
        },
    });

    yield;
    /* the runner, its fringes, and the shadow along its edges */
    const ru0 = metres(-0.085 - S0 + OVER);
    const ru1 = metres(0.975 - S0 + OVER);
    const ry0 = R - 0.62 - INNER;
    const ry1 = R + 0.62 - INNER;
    sheet(runner, ringW, ru0, ru1, [ry0, (ry0 + ry1) / 2, ry1], 0.012, {
        step: 0.3,
        uv: (u, y) => [(y - ry0) / (ry1 - ry0), u / 2.4],
        shade: (u) => 0.82 + 0.3 * blot(u * 0.3, 31),
    });
    for (const [ua, ub] of [
        [ru1, ru1 + 0.075],
        [ru0, ru0 - 0.075],
    ]) {
        const ids = [
            [ua, ry0 + 0.02, 0.011, 1],
            [ua, ry1 - 0.02, 0.011, 1],
            [ub, ry1 - 0.02, 0.004, 0],
            [ub, ry0 + 0.02, 0.004, 0],
        ].map(([u, y, d, v]) => fringe.vert(ringW, u, y, d, 0, 0, 1, (y - ry0) / 0.31, v));
        fringe.quad(ids[0], ids[1], ids[2], ids[3]);
    }
    // grime strips: [u0, u1, y at the dark edge, y where it fades, alpha]
    const strips: [number, number, number, number, number][] = [
        [ru0, ru1, ry0, ry0 - 0.06, 0.85],
        [ru0, ru1, ry1, ry1 + 0.06, 0.85],
        [0, ringLen, 0, 0.42, 0.8],
        [0, ringLen, OUTER - INNER, OUTER - INNER - 0.42, 0.8],
    ];
    for (const [u0, u1, ya, yb, a] of strips) {
        const n = Math.ceil((u1 - u0) / 0.5);
        let pa = -1;
        let pb = -1;
        for (let k = 0; k <= n; k++) {
            const u = u0 + ((u1 - u0) * k) / n;
            const ia = grime.vert(ringW, u, ya, 0.003, 0, 0, 1, 0.8, 0.99, [0, 0, 0, a]);
            const ib = grime.vert(ringW, u, yb, 0.003, 0, 0, 1, 0.8, 0.01, [0, 0, 0, a]);
            if (k > 0) grime.quad(pa, ia, ib, pb);
            pa = ia;
            pb = ib;
        }
    }

    yield;
    /* the end walls */
    farWall(wood, beams);
    yield;
    nearWall(wood, beams, iron);
    yield;

    /* the sconces' ironwork, and the soot above them */
    const parts = sconceParts();
    for (const lamp of getLamps()) {
        for (const g of parts.iron) addGeometry(iron, g, lamp.frame, undefined, IRON);
        for (const g of parts.brass) addGeometry(iron, g, lamp.frame, undefined, BRASS);
        if (lamp.side === "end") continue;
        const ids = [
            [-0.3, 2.05, 0, 0.02],
            [0.3, 2.05, 0.48, 0.02],
            [0.3, 3.7, 0.48, 0.98],
            [-0.3, 3.7, 0, 0.98],
        ].map(([u, y, tu, tv]) => grime.vert(lamp.frame, u, y, 0.003, 0, 0, 1, tu + 0.01, tv, [0, 0, 0, lamp.faulty ? 0.5 : 0.32]));
        grime.quad(ids[0], ids[1], ids[2], ids[3]);
        if ((lamp.side === "outer" && lamp.s === 0.4) || (lamp.side === "inner" && lamp.s === 0.733)) {
            web(webs, lamp.frame, [0.004, 2.03, 0.016], [0.004, 2.15, 0.2], [0.17, 1.86, 0.004]);
        }
        yield;
    }

    /* picture frames on the inner wall, and one leaning on the floor */
    const frames: { s: number; w: number; h: number; y: number; tilt: number; lean?: number; empty?: boolean }[] = [
        { s: 0.267, w: 0.62, h: 0.82, y: 2.05, tilt: 0.06 },
        { s: 0.533, w: 0.92, h: 0.64, y: 2.02, tilt: -0.1, empty: true },
        { s: 0.8, w: 0.5, h: 0.66, y: 1.98, tilt: 0.025 },
        { s: 0.4, w: 0.72, h: 0.92, y: 0, tilt: 0.02, lean: 0.27 },
    ];
    for (const fr of frames) {
        const f = flatFrame(onArc(fr.s, INNER), tangent(fr.s).negate());
        const pre = new THREE.Matrix4();
        if (fr.lean !== undefined) {
            pre.makeTranslation(0, 0.012, 0.3)
                .multiply(new THREE.Matrix4().makeRotationX(-fr.lean))
                .multiply(new THREE.Matrix4().makeRotationZ(fr.tilt))
                .multiply(new THREE.Matrix4().makeTranslation(0, fr.h / 2 + 0.02, 0));
        } else {
            pre.makeTranslation(0, fr.y, 0.006).multiply(new THREE.Matrix4().makeRotationZ(fr.tilt));
        }
        const tone = 0.75 + r() * 0.35;
        for (const g of pictureFrame(fr.w, fr.h)) addGeometry(gilt, g, f, pre, [0.36 * tone, 0.26 * tone, 0.12 * tone]);
        if (fr.empty) {
            // where it used to hang straight, the paper is less faded
            const ids = [
                [-fr.w / 2 - 0.02, fr.y - fr.h / 2 + 0.05],
                [fr.w / 2 - 0.02, fr.y - fr.h / 2 + 0.05],
                [fr.w / 2 - 0.02, fr.y + fr.h / 2 + 0.05],
                [-fr.w / 2 - 0.02, fr.y + fr.h / 2 + 0.05],
            ].map(([u, y]) => grime.vert(f, u, y, 0.002, 0, 0, 1, 0.8, 0.99, [0, 0, 0, 0.3]));
            grime.quad(ids[0], ids[1], ids[2], ids[3]);
        } else {
            const plane = new THREE.PlaneGeometry(fr.w - 0.14, fr.h - 0.14);
            plane.translate(0, 0, 0.016);
            addGeometry(canvas, plane, f, pre, 1);
        }
    }

    yield;
    const meshers = { paper, wood, beams, ceiling, floor, runner, fringe, iron, gilt, canvas, grime, webs };
    const made = {} as Record<keyof typeof meshers, THREE.BufferGeometry>;
    for (const k of Object.keys(meshers) as (keyof typeof meshers)[]) {
        made[k] = meshers[k].geometry();
        yield;
    }
    return { ...made, chimney: parts.chimney, flame: parts.flame };
}

const shell = once(buildShell);
export const getShell = () => shell();
/** Build the corridor's shell a slice at a time: then getShell() has it at once. */
export const prepareShell = () => shell.built.prepare();

/** A cobweb across a corner: A is the corner, B and C lie along its two edges. */
function web(m: Mesher, f: Frame, a: [number, number, number], b: [number, number, number], c: [number, number, number]) {
    const p = [a, b, c].map(([u, y, d]) => f.point(u, y, d, new THREE.Vector3()));
    const n = new THREE.Vector3().subVectors(p[1], p[0]).cross(new THREE.Vector3().subVectors(p[2], p[0])).normalize();
    const uv: [number, number][] = [
        [0, 1],
        [1, 1],
        [0, 0],
    ];
    const ids = p.map((q, i) => m.vert(WORLD, q.x, q.y, q.z, n.x, n.y, n.z, uv[i][0], uv[i][1]));
    m.raw(ids[0], ids[1], ids[2]);
}

/* ------------------------------------------------------------ end walls */

// The far end, where the mirror hangs: darker, fully panelled. The mirror
// (about 2.4 m across) covers the wide middle bay; a sconce hangs on each of
// the narrow bays either side of it.
function farWall(wood: Mesher, beams: Mesher) {
    const f = farFrame();
    const W = OUTER - INNER + 0.12;
    const base = -FAR_BACK;
    const shade = 0.6;
    sheet(wood, f, 0, W, [0, H + 0.02], base, { step: 1, uv: (u, y) => [u, y], shade: shade * 0.8 });
    // rails full width; the side walls' wainscot runs into them
    const tone = (k: number): Shade => [shade * k, shade * k * 0.96, shade * k * 0.92];
    slab(wood, f, 0, W, 0, 0.34, base, base + FACE, { shade: tone(1), skip: ["back", "bottom", "left", "right"] });
    slab(wood, f, 0, W, 1.03, 1.15, base, base + FACE, { shade: tone(1.05), skip: ["back", "top", "left", "right"] });
    slab(wood, f, 0, W, 1.3, 1.44, base, base + FACE, { shade: tone(0.95), skip: ["back", "left", "right"] });
    slab(wood, f, 0, W, 3.6, 3.86, base, base + FACE, { shade: tone(1), skip: ["back", "top", "left", "right"] });
    sweep(wood, f, shift(SKIRT, base), 0, W, { uv: "uy", shade: tone(1), step: 1 });
    sweep(wood, f, shift(RAIL, base), 0, W, { uv: "uy", shade: tone(1.1), step: 1 });
    sweep(beams, f, shift(PLATE.map(([d, y]) => [Math.min(d, 0.11), y]), base), 0, W, { uv: "ux", step: 1 });
    const stiles: [number, number][] = [
        [0, 0.18],
        [0.5, 0.62],
        [2.9, 3.02],
        [3.34, W],
    ];
    const r = rng(77);
    for (const [a, b] of stiles) {
        slab(wood, f, a, b, 0.34, 1.03, base, base + FACE, { shade: tone(0.9 + r() * 0.2), skip: ["back", "top", "bottom"] });
        slab(wood, f, a, b, 1.44, 3.6, base, base + FACE, { shade: tone(0.9 + r() * 0.2), skip: ["back", "top", "bottom"] });
    }
    for (let i = 0; i < 3; i++) {
        const u0 = stiles[i][1];
        const u1 = stiles[i + 1][0];
        raisedPanel(wood, f, u0, u1, 0.34, 1.03, base + 0.022, { raise: 0.012, shade: tone(0.9 + r() * 0.2), uvOffset: [r() * 9, r() * 9] });
        raisedPanel(wood, f, u0, u1, 1.44, 3.6, base + 0.022, { raise: 0.012, bevel: i === 1 ? 0.09 : 0.05, shade: tone(0.85 + r() * 0.2), uvOffset: [r() * 9, r() * 9] });
    }
}

// The near end, behind you as you come in: a pair of tall doors, closed, and
// chained. You'd only see them if you turned round.
function nearWall(wood: Mesher, beams: Mesher, iron: Mesher) {
    const f = flatFrame(onArc(S0, INNER - 0.06), outward(S0));
    const W = OUTER - INNER + 0.12;
    const mid = W / 2;
    const dl = mid - 0.83;
    const dr = mid + 0.83;
    const top = 3.0;
    const shade = 0.62;
    const tone = (k: number): Shade => [shade * k, shade * k * 0.96, shade * k * 0.92];
    const r = rng(78);
    // the wall around the doorway
    sheet(wood, f, 0, dl, [0, H + 0.02], 0, { step: 1, uv: (u, y) => [u, y], shade: tone(0.8) });
    sheet(wood, f, dr, W, [0, H + 0.02], 0, { step: 1, uv: (u, y) => [u, y], shade: tone(0.8) });
    sheet(wood, f, dl, dr, [top, H + 0.02], 0, { step: 1, uv: (u, y) => [u, y], shade: tone(0.8) });
    // panelled bays either side, with the side walls' rails carried round
    for (const [a, b, caps] of [
        [0, dl - 0.13, [false, true]],
        [dr + 0.13, W, [true, false]],
    ] as [number, number, [boolean, boolean]][]) {
        wainscot(wood, f, a, b, a === 0 ? 0.06 : a, b === W ? W - 0.06 : b, 300 + a, caps, 0, shade);
        raisedPanel(wood, f, Math.max(a, 0.06) + 0.11, Math.min(b, W - 0.06) - 0.11, 1.5, 3.62, 0, { raise: 0.022, bevel: 0.07, shade: tone(0.95) });
    }
    // architrave and a heavy head over the doorway
    slab(wood, f, dl - 0.13, dl, 0, top + 0.13, 0, 0.05, { shade: tone(1.1), skip: ["back", "bottom"] });
    slab(wood, f, dr, dr + 0.13, 0, top + 0.13, 0, 0.05, { shade: tone(1.1), skip: ["back", "bottom"] });
    slab(wood, f, dl, dr, top, top + 0.13, 0, 0.05, { shade: tone(1.1), skip: ["back", "top", "left", "right"] });
    slab(wood, f, dl - 0.2, dr + 0.2, top + 0.13, top + 0.22, 0, 0.085, { shade: tone(1), skip: ["back"] });
    raisedPanel(wood, f, dl + 0.05, dr - 0.05, top + 0.32, top + 0.78, 0, { raise: 0.014, shade: tone(0.9) });
    // reveals, and the two leaves set back in them
    slab(wood, f, dl - 0.01, dl, 0, top, -0.08, 0, { shade: tone(0.5), skip: ["front", "back", "top", "bottom", "left"] });
    slab(wood, f, dr, dr + 0.01, 0, top, -0.08, 0, { shade: tone(0.5), skip: ["front", "back", "top", "bottom", "right"] });
    slab(wood, f, dl, dr, top, top + 0.01, -0.08, 0, { shade: tone(0.5), skip: ["front", "back", "top", "left", "right"] });
    for (const [a, b] of [
        [dl, mid - 0.005],
        [mid + 0.005, dr],
    ]) {
        slab(wood, f, a, b, 0, top, -0.08, -0.035, { shade: tone(0.85 + r() * 0.2), skip: ["back", "bottom", "top"] });
        for (const [y0, y1] of [
            [0.2, 0.95],
            [1.12, 2.25],
            [2.4, 2.86],
        ]) {
            raisedPanel(wood, f, a + 0.12, b - 0.12, y0, y1, -0.035, { raise: 0.014, bevel: 0.06, shade: tone(0.8 + r() * 0.25), uvOffset: [r() * 9, r() * 9] });
        }
    }
    sweep(beams, f, PLATE, 0, W, { uv: "ux", step: 1 });
    // pull handles, chained together through a padlock
    const pull = new THREE.CylinderGeometry(0.011, 0.011, 0.44, 8);
    const stand = new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6).rotateX(Math.PI / 2);
    const plate = new THREE.BoxGeometry(0.065, 0.56, 0.006);
    for (const x of [mid - 0.07, mid + 0.07]) {
        addGeometry(iron, pull, f, new THREE.Matrix4().makeTranslation(x, 1.2, 0.012), BRASS);
        addGeometry(iron, stand, f, new THREE.Matrix4().makeTranslation(x, 1.0, -0.012), BRASS);
        addGeometry(iron, stand, f, new THREE.Matrix4().makeTranslation(x, 1.4, -0.012), BRASS);
        addGeometry(iron, plate, f, new THREE.Matrix4().makeTranslation(x, 1.2, -0.033), BRASS);
    }
    const link = new THREE.TorusGeometry(0.022, 0.0055, 5, 10);
    const n = 9;
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = mid - 0.07 + 0.14 * t;
        const y = 1.26 - Math.sin(t * Math.PI) * 0.2;
        const m = new THREE.Matrix4().makeTranslation(x, y, 0.016).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(-Math.cos(t * Math.PI) * 0.2 * Math.PI, 0.14) + Math.PI / 2));
        if (i % 2) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        addGeometry(iron, link, f, m, IRON);
    }
    addGeometry(iron, new THREE.BoxGeometry(0.06, 0.07, 0.026), f, new THREE.Matrix4().makeTranslation(mid, 0.97, 0.02), [0.9, 0.7, 0.4]);
    addGeometry(iron, new THREE.TorusGeometry(0.02, 0.005, 5, 10, Math.PI), f, new THREE.Matrix4().makeTranslation(mid, 1.005, 0.02), IRON);
}

/* ---------------------------------------------------------- the sconce */

/**
 * One wall sconce in wall space (x along the wall, y up, z out of it): a
 * cartouche-shaped backplate, a wrought-iron arm with a scroll under it, a
 * drip cup, a brass socket, a frosted glass chimney and a flame-shaped bulb.
 */
function sconceParts() {
    const ironParts: THREE.BufferGeometry[] = [];
    const brass: THREE.BufferGeometry[] = [];
    const plate = new THREE.Shape();
    plate.moveTo(0, -0.14);
    plate.bezierCurveTo(0.03, -0.11, 0.05, -0.05, 0.045, 0.0);
    plate.bezierCurveTo(0.04, 0.05, 0.055, 0.09, 0.03, 0.12);
    plate.bezierCurveTo(0.02, 0.135, 0.01, 0.14, 0, 0.16);
    plate.bezierCurveTo(-0.01, 0.14, -0.02, 0.135, -0.03, 0.12);
    plate.bezierCurveTo(-0.055, 0.09, -0.04, 0.05, -0.045, 0.0);
    plate.bezierCurveTo(-0.05, -0.05, -0.03, -0.11, 0, -0.14);
    const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 6 });
    plateGeo.translate(0, 2.12, 0.004);
    ironParts.push(plateGeo);
    const arm = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.07, 0.012),
        new THREE.Vector3(0, 2.03, 0.06),
        new THREE.Vector3(0, 2.04, 0.13),
        new THREE.Vector3(0, 2.1, 0.19),
        new THREE.Vector3(0, 2.145, LAMP_OUT),
    ]);
    ironParts.push(new THREE.TubeGeometry(arm, 20, 0.008, 6));
    // a scroll curling under the arm
    const scrollPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2.3;
        const rad = 0.045 * (1 - i / 34);
        scrollPts.push(new THREE.Vector3(0, 1.985 + Math.cos(a) * rad, 0.085 - Math.sin(a) * rad));
    }
    ironParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(scrollPts), 32, 0.0045, 5));
    // a finial below the plate
    ironParts.push(new THREE.SphereGeometry(0.011, 8, 6).translate(0, 1.975, 0.012));
    const cup = new THREE.LatheGeometry(
        [
            [0.004, -0.004],
            [0.018, 0],
            [0.04, 0.01],
            [0.05, 0.018],
            [0.047, 0.023],
            [0.03, 0.019],
            [0.014, 0.018],
            [0.012, 0.03],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        12,
    );
    cup.translate(0, 2.145, LAMP_OUT);
    ironParts.push(cup);
    brass.push(new THREE.CylinderGeometry(0.0105, 0.012, 0.045, 10).translate(0, 2.19, LAMP_OUT));
    // instanced per lamp (their glow changes): positioned around the flame
    const chimney = new THREE.LatheGeometry(
        [
            [0.022, 0],
            [0.03, 0.02],
            [0.048, 0.07],
            [0.052, 0.1],
            [0.045, 0.15],
            [0.036, 0.19],
            [0.04, 0.205],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        16,
    );
    chimney.translate(0, 2.165 - LAMP_Y, 0);
    const flame = new THREE.SphereGeometry(1, 12, 10).scale(0.013, 0.028, 0.013);
    flame.translate(0, -0.01, 0);
    return { iron: ironParts, brass, chimney, flame };
}

/* ---------------------------------------------------------- the frames */

/** A picture frame (gilt moulding with an inner lip) centred on the origin, its back at z = 0. */
function pictureFrame(w: number, h: number) {
    const ring = (ow: number, oh: number, border: number, depth: number, bevel: number) => {
        const s = new THREE.Shape();
        s.moveTo(-ow / 2, -oh / 2);
        s.lineTo(ow / 2, -oh / 2);
        s.lineTo(ow / 2, oh / 2);
        s.lineTo(-ow / 2, oh / 2);
        s.lineTo(-ow / 2, -oh / 2);
        const hole = new THREE.Path();
        const iw = ow / 2 - border;
        const ih = oh / 2 - border;
        hole.moveTo(-iw, -ih);
        hole.lineTo(-iw, ih);
        hole.lineTo(iw, ih);
        hole.lineTo(iw, -ih);
        hole.lineTo(-iw, -ih);
        s.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
        g.translate(0, 0, bevel);
        return g;
    };
    return [ring(w - 0.02, h - 0.02, 0.07, 0.022, 0.012), ring(w - 0.13, h - 0.13, 0.025, 0.01, 0.005)];
}
