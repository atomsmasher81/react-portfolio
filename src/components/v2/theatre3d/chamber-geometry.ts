import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "@/components/v2/theatre3d/textures";
import { ALTAR, BASE_H, CAP_H, FACE_Y0, STELE, STEP } from "@/components/v2/theatre3d/chamber-layout";
import { smooth } from "@/components/v2/theatre3d/chamber-pixels";

// The chamber's shapes, in its own space: floor at y = 0, the shrine at the
// origin facing +Z, the doorway behind the visitor at z = ROOM.front.

/** The room: a low brick cellar under a segmental vault. */
export const ROOM = { halfW: 1.75, back: -0.72, front: 3.6, door: { w: 1.06, h: 2.02 }, rise: 0.62 };

/** The vault's height: tall enough to clear the stele with room to spare. */
export function roomHeights(steleTop: number) {
    const crown = Math.max(2.78, steleTop + 0.42);
    const spring = crown - ROOM.rise;
    const Rv = (ROOM.halfW * ROOM.halfW + ROOM.rise * ROOM.rise) / (2 * ROOM.rise);
    const cy = crown - Rv;
    return { crown, spring, Rv, cy, top: steleTop, alpha: Math.asin(ROOM.halfW / Rv), vaultY: (x: number) => cy + Math.sqrt(Math.max(0, Rv * Rv - x * x)) };
}
export type Heights = ReturnType<typeof roomHeights>;

/* ---------------------------------------------------------------- noise */

/** Smooth 3D value noise in [0, 1]. */
export function noise3(seed: number) {
    const hash = (x: number, y: number, z: number) => {
        let h = (x * 374761393 + y * 668265263 + z * 1440662683 + seed * 2246822519) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const f = (t: number) => t * t * (3 - 2 * t);
    return (x: number, y: number, z: number) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const zi = Math.floor(z);
        const xf = f(x - xi);
        const yf = f(y - yi);
        const zf = f(z - zi);
        const l = (a: number, b: number, t: number) => a + (b - a) * t;
        const c = (dz: number) =>
            l(l(hash(xi, yi, zi + dz), hash(xi + 1, yi, zi + dz), xf), l(hash(xi, yi + 1, zi + dz), hash(xi + 1, yi + 1, zi + dz), xf), yf);
        return l(c(0), c(1), zf);
    };
}

/* ----------------------------------------------------------- stonework */

export interface ChipOpts {
    /** how deep the big chips go (m) */
    chip?: number;
    /** how far in from an edge the wear reaches (m) */
    reach?: number;
    /** wear every edge has (m) */
    wear?: number;
    /** vertex spacing (m) */
    seg?: number;
    /** give the +Z face 0..1 UVs (for the inscription) and leave it flat inside its edges */
    face?: boolean;
    /** bumpiness of the other faces (m) */
    bump?: number;
}

/**
 * A block of stone: a subdivided box with its edges worn round and chipped
 * (deeper where the noise says so, deepest at the corners) and its faces a
 * little uneven. UVs are in metres (for tiling stone), except an inscribed
 * +Z face, which runs 0..1. Groups as BoxGeometry: +x, -x, +y, -y, +z, -z.
 */
export function chippedBox(w: number, h: number, d: number, seed: number, o: ChipOpts = {}) {
    const seg = o.seg ?? 0.035;
    const g = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.ceil(w / seg)), Math.max(2, Math.ceil(h / seg)), Math.max(2, Math.ceil(d / seg)));
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const index = g.index!;
    const group = new Int8Array(pos.count);
    g.groups.forEach((gr, gi) => {
        for (let k = gr.start; k < gr.start + gr.count; k++) group[index.getX(k)] = gi;
    });
    const n1 = noise3(seed);
    const n2 = noise3(seed + 7);
    const half = [w / 2, h / 2, d / 2];
    const reach = o.reach ?? 0.03;
    const chip = o.chip ?? 0.022;
    const wear = o.wear ?? 0.004;
    const bump = o.bump ?? 0.0025;
    const r = rng(seed);
    const ou = r() * 7;
    const ov = r() * 7;
    const p = [0, 0, 0];
    const e = [0, 0, 0];
    const s = [1, 1, 1];
    const disp = [0, 0, 0];
    const pairs = [
        [0, 1],
        [0, 2],
        [1, 2],
    ];
    for (let i = 0; i < pos.count; i++) {
        p[0] = pos.getX(i);
        p[1] = pos.getY(i);
        p[2] = pos.getZ(i);
        for (let a = 0; a < 3; a++) {
            e[a] = half[a] - Math.abs(p[a]);
            s[a] = p[a] < 0 ? -1 : 1;
            disp[a] = 0;
        }
        const nz = n1(p[0] * 8 + 3, p[1] * 8, p[2] * 8);
        const R = reach * (0.55 + 1.0 * nz);
        const D = wear + chip * smooth(0.5, 0.8, nz);
        for (const [a, b] of pairs) {
            if (e[a] >= R || e[b] >= R) continue;
            const f = Math.pow(1 - e[a] / R, 1.5) * Math.pow(1 - e[b] / R, 1.5);
            disp[a] -= s[a] * D * f;
            disp[b] -= s[b] * D * f;
        }
        const gi = group[i];
        const ax = gi >> 1;
        const front = o.face && gi === 4;
        if (!front) {
            const others = Math.min(e[(ax + 1) % 3], e[(ax + 2) % 3]);
            disp[ax] += s[ax] * (n2(p[0] * 14, p[1] * 14, p[2] * 14) - 0.5) * bump * smooth(0, 0.015, others);
        }
        if (front) uv.setXY(i, p[0] / w + 0.5, p[1] / h + 0.5);
        else if (ax === 0) uv.setXY(i, p[2] * s[0] + ou, p[1] + ov);
        else if (ax === 1) uv.setXY(i, p[0] + ou, p[2] * s[1] + ov);
        else uv.setXY(i, p[0] * s[2] + ou, p[1] + ov);
        pos.setXYZ(i, p[0] + disp[0], p[1] + disp[1], p[2] + disp[2]);
    }
    g.computeVertexNormals();
    return g;
}

/** Knock a corner off: everything beyond the plane through `at` (normal `n`) is pushed back onto it, roughly. */
export function breakCorner(g: THREE.BufferGeometry, at: THREE.Vector3, n: THREE.Vector3, seed: number, rough = 0.005) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nn = noise3(seed);
    const v = new THREE.Vector3();
    const dir = n.clone().normalize();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const dd = v.clone().sub(at).dot(dir);
        if (dd > 0) {
            v.addScaledVector(dir, -dd - nn(v.x * 40, v.y * 40, v.z * 40) * rough);
            pos.setXYZ(i, v.x, v.y, v.z);
        }
    }
    g.computeVertexNormals();
    return g;
}

const strip = (g: THREE.BufferGeometry) => {
    g.clearGroups();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    return g;
};

const placed = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) =>
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));

/** The stele itself (its +Z face is the inscription, groups as chippedBox). */
export function steleGeometry(faceH: number, seed: number) {
    const g = chippedBox(STELE.faceW, faceH, STELE.depth, seed, { face: true, seg: 0.022, reach: 0.032, chip: 0.026 });
    g.translate(0, FACE_Y0 + faceH / 2, 0);
    // a corner knocked off at the top right, at the back
    breakCorner(g, new THREE.Vector3(STELE.faceW / 2 - 0.05, FACE_Y0 + faceH - 0.04, -STELE.depth / 2 + 0.05), new THREE.Vector3(0.8, 0.7, -0.7), seed + 3);
    return g;
}

/** Everything else of stone: the step, the altar and its top slab, the stele's base and its capstone. */
export function plinthGeometry(faceH: number, seed: number) {
    const parts: THREE.BufferGeometry[] = [];
    const stepG = chippedBox(STEP.w, STEP.h, STEP.d, seed + 1, { chip: 0.04, reach: 0.05 });
    parts.push(placed(stepG, 0, STEP.h / 2, STEP.z));
    const bodyH = ALTAR.h - 0.08;
    parts.push(placed(chippedBox(ALTAR.w - 0.08, bodyH, ALTAR.d - 0.08, seed + 2, { chip: 0.03, reach: 0.04 }), 0, bodyH / 2, ALTAR.z));
    const mensa = chippedBox(ALTAR.w, 0.08, ALTAR.d, seed + 3, { chip: 0.035, reach: 0.045 });
    breakCorner(mensa, new THREE.Vector3(-ALTAR.w / 2 + 0.07, 0.04, ALTAR.d / 2 - 0.05), new THREE.Vector3(-0.7, 0.25, 0.7), seed + 4);
    parts.push(placed(mensa, 0, ALTAR.h - 0.04, ALTAR.z));
    parts.push(placed(chippedBox(STELE.faceW + 0.12, BASE_H, STELE.depth + 0.12, seed + 5, { chip: 0.02, reach: 0.03 }), 0, ALTAR.h + BASE_H / 2, 0));
    const capW = STELE.faceW + 0.14;
    const cap = chippedBox(capW, CAP_H, STELE.depth + 0.12, seed + 6, { chip: 0.03, reach: 0.04 });
    breakCorner(cap, new THREE.Vector3(capW / 2 - 0.1, CAP_H / 2, (STELE.depth + 0.12) / 2 - 0.04), new THREE.Vector3(0.7, 0.45, 0.6), seed + 7, 0.008);
    parts.push(placed(cap, 0, FACE_Y0 + faceH + CAP_H / 2, 0));
    // a low gable on the capstone: a shallow ridge stone
    const ridge = chippedBox(capW - 0.2, 0.06, STELE.depth - 0.02, seed + 8, { chip: 0.02, reach: 0.03 });
    parts.push(placed(ridge, 0, FACE_Y0 + faceH + CAP_H + 0.03, 0));
    const g = mergeGeometries(parts.map(strip))!;
    parts.forEach((p) => p.dispose());
    return g;
}

/** Height of the top of the shrine. */
export const steleTop = (faceH: number) => FACE_Y0 + faceH + CAP_H + 0.06;

/* -------------------------------------------------------------- candles */

export interface CandleSpec {
    x: number;
    y: number;
    z: number;
    r: number;
    h: number;
    lit: boolean;
    /** which light it belongs to (for flicker) */
    light: number;
    lean?: number;
    /** lying on its side */
    fallen?: boolean;
}

/** One candle: melted at the rim, with drips running down and a pool at its foot. aGlow marks the wax lit from within. */
function candle(c: CandleSpec, seed: number) {
    const r = rng(seed);
    const pts: THREE.Vector2[] = [];
    const R = c.r;
    const H = c.h;
    pts.push(new THREE.Vector2(R * 1.32, 0), new THREE.Vector2(R * 1.22, 0.003), new THREE.Vector2(R * 1.08, 0.01), new THREE.Vector2(R * 1.01, 0.022));
    for (let y = 0.04; y < H - 0.018; y += 0.025) pts.push(new THREE.Vector2(R * (0.97 + r() * 0.07), y));
    pts.push(
        new THREE.Vector2(R * 1.01, H - 0.012),
        new THREE.Vector2(R * 0.98, H - 0.003),
        new THREE.Vector2(R * 0.86, H),
        new THREE.Vector2(R * 0.7, H - 0.005),
        new THREE.Vector2(R * 0.4, H - 0.013),
        new THREE.Vector2(0.001, H - 0.016),
    );
    const body = new THREE.LatheGeometry(pts, 14);
    // melted lower on one side, lumpy all round
    const pos = body.attributes.position as THREE.BufferAttribute;
    const side = r() * Math.PI * 2;
    const n = noise3(seed);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const a = Math.atan2(z, x);
        const top = smooth(H - 0.03, H, y);
        const k = 1 + (n(x * 90, y * 40, z * 90) - 0.5) * 0.12;
        pos.setXYZ(i, x * k, y - top * (0.5 + 0.5 * Math.cos(a - side)) * Math.min(0.022, H * 0.12), z * k);
    }
    const parts: THREE.BufferGeometry[] = [body];
    const drips = 2 + Math.floor(r() * 4);
    for (let k = 0; k < drips; k++) {
        const a = side + (r() - 0.5) * 2.4;
        const len = 0.012 + r() * r() * (H - 0.03);
        const rad = R * (0.1 + r() * 0.08);
        const d = new THREE.CapsuleGeometry(rad, len, 3, 6);
        d.scale(1, 1, 0.6);
        d.rotateY(-a);
        d.translate(Math.cos(a) * (R * 0.95), H - 0.01 - len / 2 - rad * 0.5, Math.sin(a) * (R * 0.95));
        parts.push(d);
    }
    if (c.lit) {
        const wick = new THREE.CylinderGeometry(0.0011, 0.0013, 0.016, 5);
        wick.rotateZ(0.25);
        wick.translate(0.001, H - 0.012, 0);
        parts.push(wick);
    }
    const g = mergeGeometries(parts.map(strip))!;
    parts.forEach((p) => p.dispose());
    const gp = g.attributes.position as THREE.BufferAttribute;
    const glow = new Float32Array(gp.count);
    const col = new Float32Array(gp.count * 3);
    const wickStart = c.lit ? gp.count - parts[parts.length - 1].attributes.position.count : gp.count;
    const tone = 0.86 + r() * 0.18;
    for (let i = 0; i < gp.count; i++) {
        const y = gp.getY(i);
        glow[i] = c.lit && i < wickStart ? smooth(H - 0.07, H - 0.004, y) : 0;
        const w = i >= wickStart ? 0.08 : tone * (0.9 + 0.1 * smooth(0, 0.05, y));
        col[i * 3] = w;
        col[i * 3 + 1] = w * (i >= wickStart ? 1 : 0.97);
        col[i * 3 + 2] = w * (i >= wickStart ? 1 : 0.9);
    }
    g.setAttribute("aGlow", new THREE.BufferAttribute(glow, 1));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if (c.fallen) {
        g.rotateZ(Math.PI / 2);
        g.rotateY(c.lean ?? 0);
        g.translate(c.x, c.y + c.r * 0.9, c.z);
    } else {
        g.rotateZ(c.lean ?? 0);
        g.translate(c.x, c.y, c.z);
    }
    return g;
}

/** Where a lit candle's flame sits. */
export function flameAt(c: CandleSpec, out = new THREE.Vector3()) {
    const lean = c.lean ?? 0;
    return out.set(c.x - Math.sin(lean) * c.h, c.y + Math.cos(lean) * c.h - 0.006, c.z);
}

/** Every candle in `candles` as one mesh. */
export function candlesGeometry(candles: CandleSpec[], seed = 1000) {
    const parts = candles.map((c, i) => candle(c, seed + i * 17));
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
}

/* ------------------------------------------------------------- ironwork */

export const STAND = { x: 1.1, z: 0.26 };

/** How tall the iron stands are: they grow with the stele, so their candles keep its upper words lit. */
export const standTop = (faceH: number) => Math.max(1.44, FACE_Y0 + faceH * 0.66 - 0.25);

/** A tall pricket stand in wrought iron: three scrolled legs, a knopped shaft and a drip pan. Origin at its foot. */
export function standGeometry(top: number) {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.34, 0),
            new THREE.Vector3(0.06, 0.2, 0),
            new THREE.Vector3(0.16, 0.06, 0),
            new THREE.Vector3(0.23, 0.012, 0),
            new THREE.Vector3(0.27, 0.03, 0),
            new THREE.Vector3(0.255, 0.05, 0),
        ]);
        const leg = new THREE.TubeGeometry(curve, 24, 0.011, 6);
        leg.rotateY((k / 3) * Math.PI * 2 + 0.4);
        parts.push(leg);
    }
    const shaft = new THREE.CylinderGeometry(0.012, 0.017, top - 0.32, 8);
    shaft.translate(0, 0.32 + (top - 0.32) / 2, 0);
    parts.push(shaft);
    for (const y of [0.34, 0.86, top - 0.1]) {
        const knop = new THREE.SphereGeometry(0.028, 10, 6);
        knop.scale(1, 0.62, 1);
        knop.translate(0, y, 0);
        parts.push(knop);
    }
    const pan = new THREE.LatheGeometry(
        [
            new THREE.Vector2(0.004, -0.004),
            new THREE.Vector2(0.06, 0.0),
            new THREE.Vector2(0.095, 0.018),
            new THREE.Vector2(0.104, 0.032),
            new THREE.Vector2(0.098, 0.034),
            new THREE.Vector2(0.088, 0.02),
            new THREE.Vector2(0.06, 0.012),
            new THREE.Vector2(0.004, 0.012),
        ],
        18,
    );
    pan.translate(0, top - 0.012, 0);
    parts.push(pan);
    const g = mergeGeometries(parts.map(strip))!;
    parts.forEach((p) => p.dispose());
    return g;
}

/** A rusted iron bowl, for offerings. Origin at its foot. */
export function bowlGeometry() {
    return new THREE.LatheGeometry(
        [
            new THREE.Vector2(0.001, 0),
            new THREE.Vector2(0.035, 0),
            new THREE.Vector2(0.038, 0.008),
            new THREE.Vector2(0.03, 0.012),
            new THREE.Vector2(0.06, 0.03),
            new THREE.Vector2(0.084, 0.05),
            new THREE.Vector2(0.09, 0.056),
            new THREE.Vector2(0.084, 0.056),
            new THREE.Vector2(0.074, 0.046),
            new THREE.Vector2(0.05, 0.03),
            new THREE.Vector2(0.001, 0.022),
        ],
        22,
    );
}

/** The iron grate over the light well in the vault: a frame and bars, 0.34 m square, lying flat. */
export function grateGeometry() {
    const parts: THREE.BufferGeometry[] = [];
    const S = 0.34;
    for (const s of [-1, 1]) {
        const a = new THREE.BoxGeometry(S + 0.04, 0.02, 0.025);
        a.translate(0, 0, (s * S) / 2);
        parts.push(a);
        const b = new THREE.BoxGeometry(0.025, 0.02, S + 0.04);
        b.translate((s * S) / 2, 0, 0);
        parts.push(b);
    }
    for (let k = -2; k <= 2; k++) {
        const bar = new THREE.CylinderGeometry(0.007, 0.007, S, 6);
        bar.rotateX(Math.PI / 2);
        bar.translate((k * S) / 6, 0, 0);
        parts.push(bar);
    }
    const g = mergeGeometries(parts.map(strip))!;
    parts.forEach((p) => p.dispose());
    return g;
}

/* ---------------------------------------------------------- the leavings */

/** A dried rose: a crumpled head, a crooked stem, two shrivelled leaves; and a few fallen petals. Vertex coloured. */
export function flowerGeometry(seed: number) {
    const r = rng(seed);
    const parts: THREE.BufferGeometry[] = [];
    const colour = (g: THREE.BufferGeometry, c: [number, number, number]) => {
        const n = g.attributes.position.count;
        const a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const k = 0.8 + r() * 0.35;
            a[i * 3] = c[0] * k;
            a[i * 3 + 1] = c[1] * k;
            a[i * 3 + 2] = c[2] * k;
        }
        strip(g);
        g.setAttribute("color", new THREE.BufferAttribute(a, 3));
        return g;
    };
    // stem along +x, lying on the ledge
    const stem = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.012, 0), new THREE.Vector3(0.08, 0.008, 0.01), new THREE.Vector3(0.17, 0.006, -0.005), new THREE.Vector3(0.27, 0.005, 0.012)]),
        16,
        0.0035,
        5,
    );
    parts.push(colour(stem, [0.16, 0.13, 0.08]));
    // the head: a crumpled ball of dark petals
    const head = new THREE.IcosahedronGeometry(0.026, 2);
    const hp = head.attributes.position as THREE.BufferAttribute;
    const n = noise3(seed);
    for (let i = 0; i < hp.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(hp, i);
        const k = 0.75 + n(v.x * 120, v.y * 120, v.z * 120) * 0.5;
        hp.setXYZ(i, v.x * k * 1.1, v.y * k * 0.85, v.z * k);
    }
    head.computeVertexNormals();
    head.translate(-0.018, 0.024, 0);
    parts.push(colour(head, [0.26, 0.05, 0.05]));
    for (const [x, s] of [
        [0.09, 1],
        [0.19, -1],
    ]) {
        const leaf = new THREE.PlaneGeometry(0.045, 0.02, 4, 1);
        const lp = leaf.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < lp.count; i++) lp.setZ(i, Math.abs(lp.getX(i)) * 0.3 + (lp.getY(i) > 0 ? 0.004 : 0));
        leaf.rotateX(-Math.PI / 2 + 0.3);
        leaf.rotateY(s * 0.7);
        leaf.translate(x, 0.012, s * 0.016);
        parts.push(colour(leaf, [0.15, 0.13, 0.07]));
    }
    const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
    const g = mergeGeometries(flat)!;
    parts.forEach((p) => p.dispose());
    flat.forEach((p) => p.dispose());
    return g;
}

/** Fallen petals, scattered, vertex coloured. Positions are in chamber space. */
export function petalsGeometry(seed: number, spots: [number, number, number][]) {
    const r = rng(seed);
    const parts: THREE.BufferGeometry[] = [];
    for (const [x, y, z] of spots) {
        const p = new THREE.CircleGeometry(0.012 + r() * 0.008, 7);
        p.scale(1, 0.7, 1);
        const pp = p.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pp.count; i++) pp.setZ(i, (pp.getX(i) ** 2 + pp.getY(i) ** 2) * 6);
        p.rotateX(-Math.PI / 2);
        p.rotateY(r() * 6);
        p.translate(x, y + 0.002, z);
        strip(p);
        const c = new Float32Array(pp.count * 3);
        const k = 0.7 + r() * 0.4;
        for (let i = 0; i < pp.count; i++) c.set([0.24 * k, 0.05 * k, 0.05 * k], i * 3);
        p.setAttribute("color", new THREE.BufferAttribute(c, 3));
        parts.push(p);
    }
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
}

/** An old ladder-back chair, one slat gone, one leg short. Origin at its foot, facing +Z. */
export function chairGeometry() {
    const parts: THREE.BufferGeometry[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, rz = 0) => {
        const b = new THREE.BoxGeometry(w, h, d);
        b.rotateX(rx);
        b.rotateZ(rz);
        b.translate(x, y, z);
        parts.push(b);
    };
    const W = 0.42;
    const D = 0.38;
    const seat = 0.45;
    for (const sx of [-1, 1]) {
        box(0.034, seat, 0.034, (sx * (W - 0.04)) / 2, seat / 2, (D - 0.04) / 2);
        box(0.036, 0.98, 0.036, (sx * (W - 0.04)) / 2, 0.49, -(D - 0.04) / 2, -0.06);
        box(0.02, 0.02, D - 0.06, (sx * (W - 0.04)) / 2, 0.16, 0);
    }
    box(W - 0.06, 0.02, 0.02, 0, 0.12, (D - 0.04) / 2);
    box(W + 0.02, 0.028, D + 0.02, 0, seat + 0.014, 0.004);
    for (const y of [0.66, 0.92]) box(W - 0.05, 0.055, 0.018, 0, y, -(D - 0.04) / 2 - (y - 0.45) * 0.06, -0.06);
    // the broken slat: one end still in its mortise, hanging
    box(0.2, 0.05, 0.016, 0.1, 0.76, -(D - 0.04) / 2 - 0.02, -0.06, -0.5);
    const g = mergeGeometries(parts.map(strip))!;
    parts.forEach((p) => p.dispose());
    return g;
}

/**
 * A tall mirror (or a painting) leaning on the wall under a dust sheet. The
 * sheet hangs from the frame's top edge, sagging between its corners, folds
 * running down from the corners, its sides falling back toward the wall, its
 * hem pooled on the floor. Origin at its foot, facing +Z.
 */
export function shroudGeometry(seed: number) {
    const fw = 0.66; // the frame under it
    const fh = 1.7;
    const lean = 0.12; // how far its top leans back (m)
    const Ws = 1.18; // the sheet
    const Ls = 2.02;
    const nx = 44;
    const ny = 70;
    const g = new THREE.PlaneGeometry(1, 1, nx, ny);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const n = noise3(seed);
    const r = rng(seed);
    const folds = Array.from({ length: 6 }, () => ({ k: 9 + r() * 22, ph: r() * 6, a: 0.4 + r() * 0.6 }));
    for (let i = 0; i < pos.count; i++) {
        const s = pos.getX(i) + 0.5; // 0..1 across
        const t = 0.5 - pos.getY(i); // 0 at the top edge, 1 at the far end
        const u = (s - 0.5) * Ws;
        let y = fh - t * Ls;
        // the frame's face, leaning back: z at height y
        const face = (yy: number) => 0.06 + lean * (1 - Math.max(0, Math.min(fh, yy)) / fh);
        let x = u;
        let z = face(y);
        // sagging between the corners along the top
        const across = Math.min(1, Math.abs(u) / (fw / 2));
        y -= 0.05 * (1 - across * across) * Math.max(0, 1 - t * 6);
        // beyond the frame's sides the sheet falls back toward the wall
        const over = Math.max(0, Math.abs(u) - fw / 2);
        if (over > 0) {
            const a = Math.min(Math.PI / 2, over / 0.16);
            x = Math.sign(u) * (fw / 2 + Math.sin(a) * 0.1 + Math.max(0, over - 0.16 * (Math.PI / 2)) * 0.15);
            z -= (1 - Math.cos(a)) * 0.1 + Math.max(0, over - 0.16 * (Math.PI / 2)) * 0.9;
        }
        // folds: from the top corners outward and down, then hanging straight
        const hang = Math.min(1, t * 1.6);
        let f = 0;
        for (const fo of folds) f += Math.sin(u * fo.k + fo.ph + n(u * 3, t * 2, 0) * 2) * fo.a;
        const diag = Math.exp(-(((Math.abs(u) - fw / 2 + t * 0.35) / 0.07) ** 2)) * (1 - hang);
        z += (f / folds.length) * 2.2 * (0.02 + 0.06 * hang) + diag * 0.045;
        // the sides hang in loose, uneven folds of their own
        x += (n(u * 4, t * 4, 3) - 0.5) * 0.07 * hang + Math.sign(u) * over * Math.sin(t * 14 + u * 9) * 0.08;
        // the hem pools on the floor and spreads forward
        if (y < 0.012) {
            const extra = 0.012 - y;
            y = 0.008 + (n(u * 6, t * 6, 5) - 0.3) * 0.025 * Math.min(1, extra * 8);
            z += extra * 0.85;
            x *= 1 + extra * 0.4;
        }
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

/* ------------------------------------------------------------ the room */

const col3 = (c: number, cold = 0) => [c, c * (1 - cold * 0.02), c * (1 - cold * 0.04)];

/**
 * A grid surface. `us`, `vs` are the grid lines (any spacing), `at` places a
 * point, `uvAt` gives its texture coordinates, `colour` its vertex colour,
 * `skip` leaves a quad out (a hole). Triangles wound so `at`'s u × v is the front.
 */
function gridSurface(
    us: number[],
    vs: number[],
    at: (u: number, v: number, out: THREE.Vector3) => THREE.Vector3,
    uvAt: (u: number, v: number, p: THREE.Vector3) => [number, number],
    colour: (p: THREE.Vector3) => number[],
    skip?: (u: number, v: number) => boolean,
    flip = false,
) {
    const nu = us.length;
    const nv = vs.length;
    const pos = new Float32Array(nu * nv * 3);
    const uv = new Float32Array(nu * nv * 2);
    const col = new Float32Array(nu * nv * 3);
    const p = new THREE.Vector3();
    for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
            const k = j * nu + i;
            at(us[i], vs[j], p);
            p.toArray(pos, k * 3);
            const t = uvAt(us[i], vs[j], p);
            uv[k * 2] = t[0];
            uv[k * 2 + 1] = t[1];
            const c = colour(p);
            col[k * 3] = c[0];
            col[k * 3 + 1] = c[1];
            col[k * 3 + 2] = c[2];
        }
    }
    const idx: number[] = [];
    for (let j = 0; j < nv - 1; j++) {
        for (let i = 0; i < nu - 1; i++) {
            if (skip?.((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2)) continue;
            const a = j * nu + i;
            const b = a + 1;
            const c = a + nu;
            const d = c + 1;
            if (flip) idx.push(a, c, b, b, c, d);
            else idx.push(a, b, c, b, d, c);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** Grid lines from a to b about `step` apart, with `extra` lines (hole edges) added. */
function lines(a: number, b: number, step: number, extra: number[] = []) {
    const n = Math.max(1, Math.round((b - a) / step));
    const out = Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
    for (const e of extra) if (e > a && e < b) out.push(e);
    return Array.from(new Set(out.map((x) => Math.round(x * 1e5) / 1e5))).sort((x, y) => x - y);
}

export interface Soot {
    x: number;
    y: number;
    z: number;
    k: number;
}

/**
 * The brick shell: back wall (with the vault's lunette), side walls, the
 * front wall and its doorway, and the vault. Vertex colours carry the damp
 * rising from the floor, stains, and soot over the flames.
 *
 * `frontWall` false leaves the front open (no wall, no doorway): for a room
 * set straight behind another doorway, whose own opening frames it.
 */
export const WELL_DEPTH = 0.5;

export function shellGeometry(hts: Heights, soot: Soot[], well: { x: number; z: number; size: number }, seed: number, frontWall = true) {
    const { halfW: HW, back, front, door } = ROOM;
    const { crown, spring, Rv, cy, alpha, vaultY, top: shrine } = hts;
    const n = noise3(seed);
    const shade = (p: THREE.Vector3) => {
        let c = 0.5 + 0.4 * n(p.x * 1.6, p.y * 1.6, p.z * 1.6);
        // the vault: decades of smoke
        c *= 1 - 0.45 * smooth(spring - 0.3, crown, p.y);
        // the back wall behind the stele, in its shadow
        if (p.z < back + 0.01) c *= 1 - 0.7 * smooth(0.95, 0.55, Math.abs(p.x)) * smooth(shrine + 0.35, shrine - 0.15, p.y);
        // damp rising from the floor
        const tide = 0.5 + 0.35 * n(p.x * 3 + 9, 0, p.z * 3);
        c *= 1 - 0.5 * (1 - smooth(0, tide, p.y));
        c *= 1 + 0.12 * Math.exp(-((p.y - tide - 0.03) ** 2) / 0.002);
        // runs of water from the vault
        c *= 1 - 0.3 * smooth(0.6, 0.8, n(p.x * 9, p.y * 0.8, p.z * 9)) * smooth(0.6, spring, p.y);
        for (const s of soot) {
            const up = smooth(s.y, s.y + 0.6, p.y);
            if (up <= 0) continue;
            const d2 = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
            c *= 1 - s.k * up * Math.exp(-d2 / (0.06 + (p.y - s.y) * 0.08));
        }
        // dark in the corners: where the walls meet the floor, each other and the vault
        const side = HW - Math.abs(p.x);
        const ends = Math.min(p.z - back, front - p.z);
        const d = Math.min(p.y, side + ends, Math.abs(p.y - spring) + side);
        c *= 0.42 + 0.58 * smooth(0, 0.5, d);
        return col3(Math.max(0.03, c));
    };
    const parts: THREE.BufferGeometry[] = [];
    // back wall, up into the lunette under the vault
    parts.push(
        gridSurface(
            lines(-HW, HW, 0.1),
            lines(0, crown, 0.1),
            (u, v, o) => o.set(u, Math.min(v, vaultY(u)), back),
            (u, v) => [u, Math.min(v, vaultY(u))],
            shade,
        ),
    );
    // side walls
    for (const s of [-1, 1]) {
        parts.push(
            gridSurface(
                lines(back, front, 0.1),
                lines(0, spring, 0.1),
                (u, v, o) => o.set(s * HW, v, u),
                (u, v) => [u * s, v],
                shade,
                undefined,
                s < 0,
            ),
        );
    }
    // front wall with the doorway, and the doorway's reveals and lintel, half a metre deep
    if (frontWall) {
        const dx = door.w / 2;
        const depth = 0.5;
        parts.push(
            gridSurface(
                lines(-HW, HW, 0.1, [-dx, dx]),
                lines(0, crown, 0.1, [door.h]),
                (u, v, o) => o.set(u, Math.min(v, vaultY(u)), front),
                (u, v) => [-u, Math.min(v, vaultY(u))],
                shade,
                (u, v) => Math.abs(u) < dx && v < door.h,
                true,
            ),
        );
        for (const s of [-1, 1]) {
            parts.push(
                gridSurface(
                    lines(front, front + depth, 0.1),
                    lines(0, door.h, 0.1),
                    (u, v, o) => o.set(s * dx, v, u),
                    (u, v) => [u, v],
                    (p) => col3(0.5 * shade(p)[0]),
                    undefined,
                    s < 0,
                ),
            );
        }
        parts.push(
            gridSurface(
                lines(-dx, dx, 0.1),
                lines(front, front + depth, 0.1),
                (u, v, o) => o.set(u, door.h, v),
                (u, v) => [u, v],
                () => col3(0.4),
            ),
        );
    }
    // the vault, with a square hole for the light well
    const hw = well.size / 2;
    parts.push(
        gridSurface(
            lines(-alpha, alpha, 0.04, [Math.asin((well.x - hw) / Rv), Math.asin((well.x + hw) / Rv)]),
            lines(back, front, 0.1, [well.z - hw, well.z + hw]),
            (a, z, o) => o.set(Rv * Math.sin(a), cy + Rv * Math.cos(a), z),
            (a, z) => [a * Rv, z],
            shade,
            (a, z) => Math.abs(Rv * Math.sin(a) - well.x) < hw && Math.abs(z - well.z) < hw,
        ),
    );
    // the well's four walls, straight up to the night
    const top = vaultY(well.x) + WELL_DEPTH;
    const dark = (p: THREE.Vector3) => col3(0.35 * shade(p)[0]);
    for (const s of [-1, 1]) {
        const x = well.x + s * hw;
        parts.push(
            gridSurface(
                lines(well.z - hw, well.z + hw, 0.06),
                lines(0, 1, 0.2),
                (u, v, o) => o.set(x, THREE.MathUtils.lerp(vaultY(x) - 0.03, top, v), u),
                (u, v, p) => [u, p.y],
                dark,
                undefined,
                s < 0,
            ),
        );
        const z = well.z + s * hw;
        parts.push(
            gridSurface(
                lines(well.x - hw, well.x + hw, 0.06),
                lines(0, 1, 0.2),
                (u, v, o) => o.set(u, THREE.MathUtils.lerp(vaultY(u) - 0.03, top, v), z),
                (u, v, p) => [u, p.y],
                dark,
                undefined,
                s > 0,
            ),
        );
    }
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
}

/** The flagstone floor, and the threshold under the doorway (`sill`). Darker toward the walls, where the dirt gathers. */
export function floorGeometry(seed: number, sill = true) {
    const { halfW: HW, back, front, door } = ROOM;
    const n = noise3(seed);
    const shade = (p: THREE.Vector3) => {
        const wall = Math.min(HW - Math.abs(p.x), p.z - back, Math.max(0, front - p.z) + (Math.abs(p.x) < door.w / 2 ? 1 : 0));
        let c = 0.5 + 0.5 * smooth(0, 0.6, wall);
        c *= 0.8 + 0.4 * n(p.x * 1.3, 0, p.z * 1.3);
        return col3(c);
    };
    const main = gridSurface(lines(-HW, HW, 0.15), lines(back, front, 0.15), (u, v, o) => o.set(u, 0, v), (u, v) => [u / 2, -v / 2], shade, undefined, true);
    if (!sill) return main;
    const step = gridSurface(lines(-door.w / 2, door.w / 2, 0.15), lines(front, front + 0.5, 0.1), (u, v, o) => o.set(u, 0, v), (u, v) => [u / 2, -v / 2], () => col3(0.35), undefined, true);
    const g = mergeGeometries([main, step])!;
    main.dispose();
    step.dispose();
    return g;
}

/** Stone ribs across the vault, on pilasters, and a string course at the springing. */
export function ribsGeometry(hts: Heights, seed: number) {
    const { halfW: HW, back, front } = ROOM;
    const { spring, Rv, cy, alpha } = hts;
    const parts: THREE.BufferGeometry[] = [];
    const depth = 0.12;
    const width = 0.26;
    for (const [k, z] of [[0, 1.12], [1, 2.55]]) {
        const z0 = z - width / 2;
        const z1 = z + width / 2;
        const ri = Rv - depth;
        const shade = () => col3(1);
        const as = lines(-alpha, alpha, 0.05);
        parts.push(gridSurface(as, [z0, z1], (a, zz, o) => o.set(ri * Math.sin(a), cy + ri * Math.cos(a), zz), (a, zz) => [a * ri, zz], shade));
        for (const [zz, flip] of [
            [z0, true],
            [z1, false],
        ] as const) {
            parts.push(
                gridSurface(
                    as,
                    [ri, Rv + 0.01],
                    (a, rr, o) => o.set(rr * Math.sin(a), cy + rr * Math.cos(a), zz),
                    (a, rr) => [a * Rv, rr],
                    shade,
                    undefined,
                    flip,
                ),
            );
        }
        for (const s of [-1, 1]) {
            const p = chippedBox(depth + 0.02, spring, width, seed + k * 10 + s, { chip: 0.03, reach: 0.04 });
            parts.push(placed(p, s * (HW - depth / 2 + 0.01), spring / 2, z));
        }
    }
    for (const s of [-1, 1]) {
        const course = chippedBox(0.07, 0.08, front - back, seed + 40 + s, { chip: 0.02, reach: 0.03, seg: 0.06 });
        parts.push(placed(course, s * (HW - 0.025), spring - 0.04, (front + back) / 2));
    }
    const g = mergeGeometries(parts.map(strip))!;
    parts.forEach((p) => p.dispose());
    return g;
}

/** Cobweb sheets: a plane anchored at its top-left corner (where the web's hub is). */
export function webGeometry() {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0.5, -0.5, 0);
    return g;
}
