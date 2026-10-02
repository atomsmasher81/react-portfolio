import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Built, later, rng, type Work } from "@/components/v2/theatre3d/textures";
import { D, HANDLE, HINGE_X, KEYHOLE, KNOCKER, LEAF_R, LEAF_SPRING, leafTop, type DoorVariant } from "@/components/v2/theatre3d/door-variants";
import { LEAF_UV, ironRuns } from "@/components/v2/theatre3d/door-textures";

// The shapes of a door. Built once per variant and shared by every door that
// uses it. Stone blocks are subdivided boxes with rounded, displaced, chipped
// faces; the leaf is a set of extruded planks with broken outlines; the iron
// is extruded straps and riveted heads.

// ---------------------------------------------------------------- noise

function hash3(i: number, j: number, k: number, seed: number) {
    let h = (i * 374761393 + j * 668265263 + k * 1274126177 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** Smooth 3D value noise in [0, 1]. */
function noise3(x: number, y: number, z: number, seed: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const f = (t: number) => t * t * (3 - 2 * t);
    const xf = f(x - xi);
    const yf = f(y - yi);
    const zf = f(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf), l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}

// ---------------------------------------------------------------- stone blocks

interface Chip {
    n: THREE.Vector3; // outward normal of the cut, block-local
    k: number; // the cut plane is dot(p, n) = k
}

interface BlockOpts {
    size: [number, number, number];
    seg: [number, number, number];
    round: number;
    rough: number;
    seed: number;
    chips?: Chip[];
    /** Extra shaping in block-local space, after rounding. */
    shape?: (p: THREE.Vector3) => void;
    /** Block-local to door space. */
    place: (p: THREE.Vector3) => void;
    tint: [number, number, number];
    uvOffset: [number, number];
}

const v3 = new THREE.Vector3();
const c3 = new THREE.Vector3();

/** A rough stone: a box with rounded edges, a lumpy face and maybe a chipped corner. */
function stoneBlock(o: BlockOpts) {
    const [w, h, d] = o.size;
    const g = new THREE.BoxGeometry(1, 1, 1, o.seg[0], o.seg[1], o.seg[2]);
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    const pos = g.attributes.position as THREE.BufferAttribute;
    const r = o.round;
    // Put the outer rows of each axis at the bevel (and, given enough rows, a
    // second ring just inside it so the face stays flat to its edge), the rest
    // evenly between.
    const remap = (c: number, n: number, s: number) => {
        const k = Math.round((c + 0.5) * n);
        if (k <= 0) return -s / 2;
        if (k >= n) return s / 2;
        if (n < 5) return -s / 2 + r + ((k - 1) / (n - 2)) * (s - 2 * r);
        const e = Math.min(0.012, (s - 2 * r) * 0.15);
        if (k === 1) return -s / 2 + r;
        if (k === n - 1) return s / 2 - r;
        return -s / 2 + r + e + ((k - 2) / (n - 4)) * (s - 2 * r - 2 * e);
    };
    const fresh = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
        v3.set(remap(pos.getX(i), o.seg[0], w), remap(pos.getY(i), o.seg[1], h), remap(pos.getZ(i), o.seg[2], d));
        // round the edges
        c3.set(THREE.MathUtils.clamp(v3.x, -w / 2 + r, w / 2 - r), THREE.MathUtils.clamp(v3.y, -h / 2 + r, h / 2 - r), THREE.MathUtils.clamp(v3.z, -d / 2 + r, d / 2 - r));
        const nx = v3.x - c3.x;
        const ny = v3.y - c3.y;
        const nz = v3.z - c3.z;
        const len = Math.hypot(nx, ny, nz) || 1;
        v3.set(c3.x + (nx / len) * r, c3.y + (ny / len) * r, c3.z + (nz / len) * r);
        // lumpy surface, but flat against the wall behind
        const back = v3.z < -d / 2 + r * 0.5 ? 0 : 1;
        const n1 = noise3(v3.x * 6, v3.y * 6, v3.z * 6, o.seed) - 0.5;
        const n2 = noise3(v3.x * 26, v3.y * 26, v3.z * 26, o.seed + 7) - 0.5;
        const disp = (n1 * 2 + n2 * 0.6) * o.rough * back;
        v3.x += (nx / len) * disp;
        v3.y += (ny / len) * disp;
        v3.z += (nz / len) * disp;
        if (o.shape) o.shape(v3);
        if (o.chips)
            for (const chip of o.chips) {
                const over = v3.dot(chip.n) - chip.k;
                if (over > 0) {
                    v3.addScaledVector(chip.n, -over);
                    fresh[i] = Math.max(fresh[i], Math.min(1, over * 60));
                }
            }
        pos.setXYZ(i, v3.x, v3.y, v3.z);
    }
    g.setAttribute("fresh", new THREE.BufferAttribute(fresh, 1));
    const welded = mergeVertices(g, 1e-5);
    g.dispose();
    const wp = welded.attributes.position as THREE.BufferAttribute;
    const wf = welded.attributes.fresh as THREE.BufferAttribute;
    const colors = new Float32Array(wp.count * 3);
    const uvs = new Float32Array(wp.count * 2);
    for (let i = 0; i < wp.count; i++) {
        v3.fromBufferAttribute(wp, i);
        o.place(v3);
        wp.setXYZ(i, v3.x, v3.y, v3.z);
        // Rising damp at the foot, old lamp soot toward the top, paler where chipped.
        const damp = 1 - 0.45 * (1 - THREE.MathUtils.smoothstep(v3.y, 0.05, 0.7));
        const soot = 1 - 0.3 * THREE.MathUtils.smoothstep(v3.y, 2.0, 3.0);
        const f = 1 + wf.getX(i) * 0.55;
        colors[i * 3] = o.tint[0] * damp * soot * f;
        colors[i * 3 + 1] = o.tint[1] * damp * soot * f;
        colors[i * 3 + 2] = o.tint[2] * damp * soot * f;
        uvs[i * 2] = (v3.x + v3.z * 0.8) * 1.5 + o.uvOffset[0];
        uvs[i * 2 + 1] = (v3.y + v3.z * 0.8) * 1.5 + o.uvOffset[1];
    }
    welded.deleteAttribute("fresh");
    welded.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    welded.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    welded.computeVertexNormals();
    return welded;
}

/** A random chipped corner on the front of a block of the given size. */
function chipFor(r: () => number, size: [number, number, number]): Chip {
    const sx = r() < 0.5 ? -1 : 1;
    const sy = r() < 0.5 ? -1 : 1;
    const n = new THREE.Vector3(sx * (0.5 + r()), sy * (0.5 + r()), 0.6 + r() * 0.8).normalize();
    const corner = new THREE.Vector3((sx * size[0]) / 2, (sy * size[1]) / 2, size[2] / 2);
    return { n, k: corner.dot(n) - (0.022 + r() * 0.04) };
}

const stoneCache = new Map<number, Built<THREE.BufferGeometry>>();
const stonesOf = (v: DoorVariant) => {
    let b = stoneCache.get(v.id);
    if (!b) stoneCache.set(v.id, (b = new Built(() => surroundWork(v))));
    return b;
};

/** The arched stone surround and the worn threshold. */
export function surroundGeometry(v: DoorVariant) {
    return stonesOf(v).get();
}

/** Build these doors' shapes a slice at a time: then they're there at once. */
export function prepareDoorShapes(variants: DoorVariant[]) {
    return Promise.all(
        variants.map((v) =>
            later(
                (function* (): Work<void> {
                    yield stonesOf(v).work();
                    leafGeometry(v);
                    yield;
                    ironGeometry(v);
                    yield;
                    pintleGeometry(v);
                })(),
            ),
        ),
    );
}

function* surroundWork(v: DoorVariant): Work<THREE.BufferGeometry> {
    const r = rng(v.seed + 11);
    const parts: THREE.BufferGeometry[] = [];
    const gap = 0.008;
    const tint = (): [number, number, number] => {
        const b = 0.78 + r() * 0.4;
        const warm = (r() - 0.5) * 0.1;
        return [b * (1 + warm), b, b * (1 - warm)];
    };
    const euler = new THREE.Euler();
    const mat = new THREE.Matrix4();
    const rect = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => {
        mat.makeRotationFromEuler(euler.set(rx, ry, rz)).setPosition(cx, cy, cz);
        const m = mat.clone();
        return (p: THREE.Vector3) => void p.applyMatrix4(m);
    };
    const jitter = (a: number) => (r() - 0.5) * 2 * a;

    // Jambs: courses shared by both sides, long and short stones alternating.
    const impostH = 0.17;
    const courses: number[] = [0.3 + r() * 0.04];
    let top = courses[0];
    while (top < D.spring - impostH - 0.2) {
        const h = Math.min(0.24 + r() * 0.07, D.spring - impostH - top);
        courses.push(h);
        top += h;
    }
    courses[courses.length - 1] += D.spring - impostH - top;
    for (const side of [-1, 1]) {
        let y = 0;
        for (let i = 0; i < courses.length; i++) {
            const h = courses[i];
            const plinth = i === 0;
            const long = (i + (side > 0 ? 1 : 0)) % 2 === 0;
            const w = plinth ? 0.4 : long ? 0.36 + r() * 0.03 : 0.26 + r() * 0.03;
            const depth = (plinth ? 0.15 : D.face) + jitter(0.012);
            const size: [number, number, number] = [w - gap, h - gap, depth];
            const inner = D.half + 0.002 + Math.max(0, jitter(0.004));
            const cx = side * (inner + w / 2);
            const chips = r() < 0.55 ? [chipFor(r, size)] : [];
            if (r() < 0.2) chips.push(chipFor(r, size));
            const shear = jitter(0.05);
            // one stone a little out of true: pushed forward and turned
            const loose = !plinth && r() < 0.15;
            parts.push(
                stoneBlock({
                    size,
                    seg: [6, 6, 3],
                    round: 0.012 + r() * 0.012,
                    rough: 0.006 + r() * 0.005,
                    seed: v.seed + i * 17 + (side > 0 ? 500 : 0),
                    chips,
                    shape: (p) => void (p.x += p.y * shear),
                    place: rect(cx, y + h / 2 + jitter(0.002), depth / 2 + (loose ? 0.012 : 0), jitter(0.006), jitter(0.01), jitter(loose ? 0.025 : 0.01)),
                    tint: tint(),
                    uvOffset: [r() * 10, r() * 10],
                }),
            );
            y += h;
            yield;
        }
        // Impost: the stone the arch springs from, a little proud and moulded.
        const size: [number, number, number] = [0.42, impostH - gap, 0.155];
        parts.push(
            stoneBlock({
                size,
                seg: [5, 4, 3],
                round: 0.03,
                rough: 0.003,
                seed: v.seed + 900 + side,
                chips: r() < 0.5 ? [chipFor(r, size)] : [],
                place: rect(side * (D.half + 0.004 + 0.21), D.spring - impostH / 2, 0.155 / 2, 0, 0, jitter(0.006)),
                tint: tint(),
                uvOffset: [r() * 10, r() * 10],
            }),
        );
    }

    // Voussoirs: wedges around the semicircle, the keystone wider, longer and proud.
    const N = 11;
    const weights = Array.from({ length: N }, (_, i) => (i === (N - 1) / 2 ? 1.3 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let phi = Math.PI;
    for (let i = 0; i < N; i++) {
        const span = (weights[i] / total) * Math.PI;
        const p1 = phi;
        const p0 = phi - span;
        phi = p0;
        const key = i === (N - 1) / 2;
        const len = key ? 0.44 : i % 2 === 0 ? 0.36 + r() * 0.03 : 0.29 + r() * 0.03;
        const depth = key ? 0.16 : D.face + jitter(0.01);
        const rin = D.half + 0.003;
        const rmid = rin + len / 2;
        const w = rmid * span - gap;
        const size: [number, number, number] = [w, len, depth];
        const drop = key ? v.keystoneDrop : 0;
        const tilt = jitter(0.008);
        const dz = jitter(0.006);
        const pc = (p0 + p1) / 2;
        const ca = Math.cos(tilt);
        const sa = Math.sin(tilt);
        parts.push(
            stoneBlock({
                size,
                seg: [5, 6, 3],
                round: 0.012 + r() * 0.01,
                rough: 0.006 + r() * 0.004,
                seed: v.seed + 300 + i * 13,
                chips: r() < 0.5 ? [chipFor(r, size)] : [],
                place: (p) => {
                    // polar warp: local y is radial, local x runs clockwise
                    const rad = rin + (p.y + len / 2);
                    const t = (p.x + w / 2) / w;
                    const g = gap / 2 / rad;
                    const a = p1 - g - t * (p1 - p0 - 2 * g);
                    let x = rad * Math.cos(a);
                    let y = rad * Math.sin(a);
                    // a slight twist about the wedge's middle, then settle
                    const mx = rmid * Math.cos(pc);
                    const my = rmid * Math.sin(pc);
                    const qx = x - mx;
                    const qy = y - my;
                    x = mx + qx * ca - qy * sa;
                    y = my + qx * sa + qy * ca;
                    p.set(x, D.spring + y - drop, p.z + depth / 2 + dz);
                },
                tint: tint(),
                uvOffset: [r() * 10, r() * 10],
            }),
        );
        yield;
    }

    // Threshold: one long stone, dished in the middle by centuries of feet.
    {
        const size: [number, number, number] = [1.62, D.sill, 0.33];
        parts.push(
            stoneBlock({
                size,
                seg: [12, 3, 6],
                round: 0.014,
                rough: 0.0025,
                seed: v.seed + 1200,
                chips: [chipFor(r, size)],
                shape: (p) => {
                    if (p.y > 0) {
                        const wear = Math.exp(-((p.x / 0.42) ** 2)) * (0.6 + 0.4 * THREE.MathUtils.smoothstep(p.z, -0.1, 0.12));
                        p.y -= wear * 0.012;
                    }
                },
                place: rect(0, D.sill / 2, D.roomZ + 0.165, 0, 0, 0),
                tint: [0.92, 0.9, 0.86],
                uvOffset: [r() * 10, r() * 10],
            }),
        );
    }

    yield;
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    merged.computeBoundingSphere();
    return merged;
}

let backing: THREE.BufferGeometry | null = null;

/** Dark mortar behind the stones, seen in the joints. */
export function backingGeometry() {
    if (backing) return backing;
    const outer = new THREE.Shape();
    const jw = 0.24;
    const ar = D.half + 0.27;
    outer.moveTo(-D.half - jw, 0);
    outer.lineTo(D.half + jw, 0);
    outer.lineTo(D.half + jw, D.spring);
    outer.absarc(0, D.spring, ar, 0, Math.PI, false);
    outer.lineTo(-D.half - jw, 0);
    const hole = new THREE.Path();
    hole.moveTo(-D.half + 0.004, 0);
    hole.lineTo(-D.half + 0.004, D.spring);
    hole.absarc(0, D.spring, D.half - 0.004, Math.PI, 0, true);
    hole.lineTo(D.half - 0.004, 0);
    hole.lineTo(-D.half + 0.004, 0);
    outer.holes.push(hole);
    backing = new THREE.ShapeGeometry(outer, 24);
    backing.translate(0, 0, 0.004);
    return backing;
}

let room: THREE.BufferGeometry | null = null;

/** The doorway, filled: the surface the lit room is drawn on. */
export function roomGeometry() {
    if (room) return room;
    const s = new THREE.Shape();
    const a = D.half + 0.012;
    s.moveTo(-a, 0.03);
    s.lineTo(a, 0.03);
    s.lineTo(a, D.spring);
    s.absarc(0, D.spring, a, 0, Math.PI, false);
    s.lineTo(-a, 0.03);
    room = new THREE.ShapeGeometry(s, 24);
    room.translate(0, 0, D.roomZ);
    return room;
}

let surroundHit: THREE.BufferGeometry | null = null;

/** Invisible stand-in for the surround and the doorway, for the pointer. */
export function surroundHitGeometry() {
    if (surroundHit) return surroundHit;
    const s = new THREE.Shape();
    const a = D.half + 0.32;
    s.moveTo(-a, 0);
    s.lineTo(a, 0);
    s.lineTo(a, D.spring);
    s.absarc(0, D.spring, a + 0.06, 0, Math.PI, false);
    s.lineTo(-a, 0);
    surroundHit = new THREE.ShapeGeometry(s, 12);
    surroundHit.translate(0, 0, D.face + 0.005);
    return surroundHit;
}

let leafHit: THREE.BufferGeometry | null = null;

/** Invisible stand-in for the leaf (leaf-local), for the pointer. */
export function leafHitGeometry() {
    if (leafHit) return leafHit;
    leafHit = new THREE.BoxGeometry(D.leafW, LEAF_SPRING + LEAF_R, D.leafT);
    leafHit.translate(D.leafW / 2, (LEAF_SPRING + LEAF_R) / 2, -D.leafT / 2);
    return leafHit;
}

// ---------------------------------------------------------------- the leaf

/** Leaf-local outline of one plank, its outer edges chipped and rotten. */
function plankOutline(v: DoorVariant, i: number, r: () => number) {
    const n = v.planks.length - 1;
    const x0 = v.planks[i];
    const x1 = v.planks[i + 1];
    const first = i === 0;
    const last = i === n - 1;
    const pts: THREE.Vector2[] = [];
    const chip = (big: number, small: number) => (r() < 0.25 ? r() * big : r() * small);
    const base = r() * 0.01; // the foot of each plank has rotted back by a different amount

    const brokenBottom = (v.broken === "bl" && first) || (v.broken === "br" && last);
    const brokenTop = (v.broken === "tl" && first) || (v.broken === "tr" && last);
    const pw = x1 - x0;
    const bw = Math.min(pw - 0.03, 0.17);
    const bh = 0.17 + r() * 0.05;

    // splintered break between two points: saw-toothed along the grain
    const splinter = (ax: number, ay: number, bx: number, by: number) => {
        const steps = 9;
        for (let k = 1; k < steps; k++) {
            const t = k / steps;
            const x = ax + (bx - ax) * t + (r() - 0.5) * 0.012;
            const y = ay + (by - ay) * t + (k % 2 ? 1 : -1) * (0.012 + r() * 0.03);
            pts.push(new THREE.Vector2(x, y));
        }
    };

    // bottom edge, left to right
    if (brokenBottom && first) {
        pts.push(new THREE.Vector2(0, bh));
        splinter(0, bh, bw, base);
        pts.push(new THREE.Vector2(bw, base + chip(0.01, 0.002)));
    } else {
        pts.push(new THREE.Vector2(x0 + (first ? chip(0.01, 0.003) : 0), base + chip(0.01, 0.002)));
    }
    const bStart = brokenBottom && first ? bw : x0;
    const bEnd = brokenBottom && last ? x1 - bw : x1;
    for (let x = bStart + 0.025; x < bEnd - 0.012; x += 0.02 + r() * 0.015) pts.push(new THREE.Vector2(x, base + chip(0.014, 0.003)));
    if (brokenBottom && last) {
        pts.push(new THREE.Vector2(bEnd, base + chip(0.01, 0.002)));
        splinter(bEnd, base, x1, bh);
        pts.push(new THREE.Vector2(x1, bh));
    } else {
        pts.push(new THREE.Vector2(x1 - (last ? chip(0.01, 0.003) : 0), base + chip(0.01, 0.002)));
    }

    // right edge, upward (only the last plank's is an outer, chipped edge)
    const rightTop = last ? LEAF_SPRING : leafTop(x1);
    if (last) for (let y = (brokenBottom ? bh : 0) + 0.06; y < rightTop - 0.03; y += 0.035 + r() * 0.03) pts.push(new THREE.Vector2(x1 - chip(0.012, 0.0025), y));

    // the arch, from right to left, by angle around the arch's centre
    const ang = (x: number) => Math.acos(THREE.MathUtils.clamp((x - LEAF_R) / LEAF_R, -1, 1));
    const a0 = ang(x1);
    const a1 = ang(x0);
    const steps = Math.max(2, Math.ceil(((a1 - a0) * LEAF_R) / 0.022));
    // where a bite has broken out of the arch
    const biteA = last ? a0 + 0.12 : a1 - 0.12 - Math.min(0.42, (a1 - a0) * 0.8);
    const biteB = biteA + Math.min(0.42, (a1 - a0) * 0.8);
    const biteDepth = 0.08 + r() * 0.04;
    for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps;
        let inset = (first && k === steps) || (last && k === 0) ? 0 : chip(0.012, 0.0025);
        if (brokenTop && a > biteA && a < biteB) {
            const t = (a - biteA) / (biteB - biteA);
            inset = Math.sin(t * Math.PI) ** 0.6 * biteDepth + (k % 2 ? 0.018 : -0.008) * Math.sin(t * Math.PI) + r() * 0.012;
        }
        const rr = LEAF_R - inset;
        pts.push(new THREE.Vector2(LEAF_R + Math.cos(a) * rr, LEAF_SPRING + Math.sin(a) * rr));
    }

    // left edge, downward
    if (first) {
        const stop = brokenBottom ? bh : 0;
        for (let y = LEAF_SPRING - 0.04; y > stop + 0.05; y -= 0.035 + r() * 0.03) pts.push(new THREE.Vector2(x0 + chip(0.012, 0.0025), y));
    }
    return pts;
}

const leafCache = new Map<number, THREE.BufferGeometry>();

/** The leaf, leaf-local: hinge line at x = 0, front face at z = 0, underside at y = 0. */
export function leafGeometry(v: DoorVariant) {
    const hit = leafCache.get(v.id);
    if (hit) return hit;
    const r = rng(v.seed + 21);
    const parts: THREE.BufferGeometry[] = [];
    const n = v.planks.length - 1;
    const bevel = 0.0028;
    for (let i = 0; i < n; i++) {
        const shape = new THREE.Shape(plankOutline(v, i, r));
        const thick = D.leafT - 0.002 + r() * 0.004;
        const g = new THREE.ExtrudeGeometry(shape, { depth: thick - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
        g.translate(0, 0, -(thick - bevel) + (r() - 0.5) * 0.004);
        parts.push(g);
    }
    // Ledges and a brace on the back, seen when the door swings open; set just
    // behind the deepest plank so they never cut through one.
    const backZ = -D.leafT - 0.006 - 0.0125;
    for (const y of v.hinges) {
        const g = new THREE.BoxGeometry(D.leafW - 0.08, 0.13, 0.025);
        g.translate(D.leafW / 2, y, backZ);
        parts.push(g);
    }
    {
        const [y0, y1] = v.hinges;
        const dx = D.leafW - 0.2;
        const dy = y1 - y0 - 0.13;
        const len = Math.hypot(dx, dy);
        const g = new THREE.BoxGeometry(len, 0.11, 0.022);
        g.rotateZ(-Math.atan2(dy, dx));
        g.translate(D.leafW / 2, (y0 + y1) / 2, backZ);
        parts.push(g);
    }
    const flat = parts.map((g) => {
        const out = g.index ? g.toNonIndexed() : g;
        if (out !== g) g.dispose();
        return out;
    });
    // One planar projection for all of it, so the texture lines up across planks.
    for (const g of flat) {
        const p = g.attributes.position as THREE.BufferAttribute;
        const uv = new Float32Array(p.count * 2);
        for (let k = 0; k < p.count; k++) {
            uv[k * 2] = p.getX(k) * LEAF_UV.sx;
            uv[k * 2 + 1] = p.getY(k) * LEAF_UV.sy;
        }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }
    const merged = mergeGeometries(flat, false);
    for (const g of flat) g.dispose();
    merged.computeBoundingSphere();
    leafCache.set(v.id, merged);
    return merged;
}

// ---------------------------------------------------------------- iron

/** A forged strap, leaf-local, lying on the wood (z from 0 up). */
function strap(points: THREE.Vector2[]) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(points), { depth: 0.005, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, 0.002);
    return g;
}

function rivet(x: number, y: number, z: number, r = 0.0105) {
    const g = new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    g.rotateX(Math.PI / 2);
    g.scale(1, 1, 0.75);
    g.translate(x, y, z);
    return g;
}

/** The keyhole, centred on the escutcheon's origin. */
export function keyholePath<T extends THREE.Path>(p: T, grow = 0) {
    const r = 0.0085 + grow;
    p.moveTo(-0.004 - grow, 0.006);
    p.lineTo(-0.0068 - grow, -0.028 - grow);
    p.lineTo(0.0068 + grow, -0.028 - grow);
    p.lineTo(0.004 + grow, 0.006);
    p.absarc(0, 0.012, r, -Math.PI / 2 + 0.5, Math.PI * 1.5 - 0.5, false);
    return p;
}

let keyholeGlow: THREE.BufferGeometry | null = null;

/** The light seen through the keyhole, leaf-local. */
export function keyholeGlowGeometry() {
    if (keyholeGlow) return keyholeGlow;
    keyholeGlow = new THREE.ShapeGeometry(keyholePath(new THREE.Shape(), 0.0015), 8);
    keyholeGlow.translate(KEYHOLE.x, KEYHOLE.y, 0.004);
    return keyholeGlow;
}

const ironCache = new Map<number, THREE.BufferGeometry>();

/** All the ironwork fixed to the leaf, leaf-local. */
export function ironGeometry(v: DoorVariant) {
    const hit = ironCache.get(v.id);
    if (hit) return hit;
    const r = rng(v.seed + 31);
    const parts: THREE.BufferGeometry[] = [];
    const j = (a: number) => (r() - 0.5) * 2 * a;
    const front = 0.0088; // top of a strap

    // Strap hinges ending in arrowheads.
    v.hinges.forEach((y, i) => {
        const len = v.hingeLen[i] * D.leafW * 0.78;
        const sag = i === 0 ? v.sag : v.sag * 0.3;
        const top: THREE.Vector2[] = [];
        const bot: THREE.Vector2[] = [];
        for (let x = -0.014; x < len - 0.02; x += 0.05) {
            const w = THREE.MathUtils.lerp(0.034, 0.025, Math.max(0, x) / len);
            top.push(new THREE.Vector2(x, w + j(0.0012)));
            bot.push(new THREE.Vector2(x, -w + j(0.0012)));
        }
        const head = [new THREE.Vector2(len - 0.012, 0.024), new THREE.Vector2(len + 0.014, 0.052), new THREE.Vector2(len + 0.125, 0), new THREE.Vector2(len + 0.014, -0.052), new THREE.Vector2(len - 0.012, -0.024)];
        const pts = [...bot, ...head.reverse(), ...top.reverse()];
        const c = Math.cos(-sag);
        const s = Math.sin(-sag);
        for (const p of pts) p.set(p.x * c - p.y * s, p.x * s + p.y * c + y);
        parts.push(strap(pts));
        // rivets along it, and in the arrowhead
        for (let x = 0.07; x < len - 0.03; x += 0.15 + r() * 0.04) {
            if (r() < 0.1) continue;
            parts.push(rivet(x * c, x * s + y + j(0.002), front));
        }
        parts.push(rivet((len + 0.04) * c, (len + 0.04) * s + y, front, 0.007));
        // the barrel round the pintle
        const barrel = new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10);
        barrel.translate(0, y, 0);
        parts.push(barrel);
    });

    // Plain bands across, slightly wavy as forged by hand.
    for (const run of ironRuns(v).slice(2)) {
        const top: THREE.Vector2[] = [];
        const bot: THREE.Vector2[] = [];
        const bend = j(0.004);
        for (let x = run.x0; x <= run.x1 + 1e-6; x += (run.x1 - run.x0) / 14) {
            const t = (x - run.x0) / (run.x1 - run.x0);
            const yc = run.y + Math.sin(t * Math.PI) * bend;
            top.push(new THREE.Vector2(x, yc + run.h / 2 - 0.002 + j(0.0012)));
            bot.push(new THREE.Vector2(x, yc - run.h / 2 + 0.002 + j(0.0012)));
        }
        parts.push(strap([...bot, ...top.reverse()]));
        for (let p = 0; p < v.planks.length - 1; p++) {
            const x = (v.planks[p] + v.planks[p + 1]) / 2 + j(0.01);
            if (x < run.x0 + 0.02 || x > run.x1 - 0.02 || r() < 0.08) continue;
            parts.push(rivet(x, run.y + j(0.002), front));
        }
    }
    // The nails left where a band fell away.
    if (v.ghostBand !== null)
        for (let p = 0; p < v.planks.length - 1; p += 2) parts.push(rivet((v.planks[p] + v.planks[p + 1]) / 2, v.ghostBand + j(0.003), 0.001, 0.007));

    // Escutcheon round the keyhole.
    {
        const s = new THREE.Shape();
        s.moveTo(0, 0.085);
        s.quadraticCurveTo(0.012, 0.06, 0.036, 0.05);
        s.lineTo(0.036, -0.05);
        s.quadraticCurveTo(0.012, -0.06, 0, -0.085);
        s.quadraticCurveTo(-0.012, -0.06, -0.036, -0.05);
        s.lineTo(-0.036, 0.05);
        s.quadraticCurveTo(-0.012, 0.06, 0, 0.085);
        s.holes.push(keyholePath(new THREE.Path()));
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 6 });
        // planks stand up to 2 mm proud of z = 0, so sit it clear of them
        g.translate(KEYHOLE.x, KEYHOLE.y, 0.0032);
        parts.push(g);
        parts.push(rivet(KEYHOLE.x, KEYHOLE.y + 0.066, 0.0075, 0.0055));
        parts.push(rivet(KEYHOLE.x, KEYHOLE.y - 0.066, 0.0075, 0.0055));
    }

    // Knocker boss (a scalloped rosette) and its strike plate, or a small pull boss.
    const boss = (x: number, y: number, scale: number) => {
        const prof = [new THREE.Vector2(0.0001, 0.02), new THREE.Vector2(0.012, 0.019), new THREE.Vector2(0.024, 0.014), new THREE.Vector2(0.036, 0.007), new THREE.Vector2(0.046, 0.002), new THREE.Vector2(0.046, 0)];
        const g = new THREE.LatheGeometry(prof, 18);
        const p = g.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) {
            const a = Math.atan2(p.getZ(k), p.getX(k));
            const f = 1 + 0.1 * Math.cos(a * 6);
            p.setXYZ(k, p.getX(k) * f, p.getY(k), p.getZ(k) * f);
        }
        g.rotateX(Math.PI / 2);
        g.scale(scale, scale, scale);
        g.translate(x, y, 0);
        g.computeVertexNormals();
        return g;
    };
    if (v.knocker) {
        parts.push(boss(KNOCKER.x, KNOCKER.y, 1));
        const staple = new THREE.TorusGeometry(0.011, 0.004, 6, 10, Math.PI);
        staple.rotateY(Math.PI / 2);
        staple.rotateX(-Math.PI / 2);
        staple.translate(KNOCKER.x, KNOCKER.y - 0.036, 0.011);
        parts.push(staple);
        const strike = new THREE.CylinderGeometry(0.016, 0.02, 0.008, 10);
        strike.rotateX(Math.PI / 2);
        strike.translate(KNOCKER.x, KNOCKER.y - 0.036 - 0.15, 0.004);
        parts.push(strike);
    } else {
        parts.push(boss(HANDLE.x, HANDLE.y, 0.6));
    }

    const flat = parts.map((g) => {
        g.deleteAttribute("uv");
        const out = g.index ? g.toNonIndexed() : g;
        if (out !== g) g.dispose();
        return out;
    });
    for (const g of flat) {
        const p = g.attributes.position as THREE.BufferAttribute;
        const uv = new Float32Array(p.count * 2);
        for (let k = 0; k < p.count; k++) {
            uv[k * 2] = (p.getX(k) + p.getZ(k)) * 2;
            uv[k * 2 + 1] = (p.getY(k) + p.getZ(k)) * 2;
        }
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }
    const merged = mergeGeometries(flat, false);
    for (const g of flat) g.dispose();
    merged.computeBoundingSphere();
    ironCache.set(v.id, merged);
    return merged;
}

const pintleCache = new Map<number, THREE.BufferGeometry>();

/** The pins on the jamb that the hinge barrels turn on, door space. */
export function pintleGeometry(v: DoorVariant) {
    const hit = pintleCache.get(v.id);
    if (hit) return hit;
    const parts = v.hinges.map((y) => {
        const g = new THREE.BoxGeometry(0.075, 0.024, 0.03);
        g.translate(HINGE_X - 0.045, D.leafB + y - 0.067, D.leafZ);
        return g;
    });
    const flat = parts.map((g) => {
        const out = g.toNonIndexed();
        g.dispose();
        const p = out.attributes.position as THREE.BufferAttribute;
        const uv = out.attributes.uv as THREE.BufferAttribute;
        for (let k = 0; k < p.count; k++) uv.setXY(k, (p.getX(k) + p.getZ(k)) * 2, (p.getY(k) + p.getZ(k)) * 2);
        return out;
    });
    const merged = mergeGeometries(flat, false);
    for (const g of flat) g.dispose();
    pintleCache.set(v.id, merged);
    return merged;
}

let ring: THREE.BufferGeometry | null = null;
let pull: THREE.BufferGeometry | null = null;

/** Knocker ring, hanging from its pivot at the origin. */
export function ringGeometry() {
    if (ring) return ring;
    ring = new THREE.TorusGeometry(0.075, 0.0095, 8, 28);
    ring.translate(0, -0.075, 0);
    return ring;
}

/** The smaller pull ring on doors without a knocker. */
export function pullGeometry() {
    if (pull) return pull;
    pull = new THREE.TorusGeometry(0.042, 0.0075, 8, 22);
    pull.translate(0, -0.042, 0);
    return pull;
}

// ---------------------------------------------------------------- plaque

let plate: THREE.BufferGeometry | null = null;

/** The brass plate, centred, its back at z = 0, with planar UVs over its face. */
export function plateGeometry() {
    if (plate) return plate;
    const w = D.plateW / 2;
    const h = D.plateH / 2;
    const c = 0.028;
    const s = new THREE.Shape();
    s.moveTo(-w + c, -h);
    s.lineTo(w - c, -h);
    s.quadraticCurveTo(w - c, -h + c, w, -h + c);
    s.lineTo(w, h - c);
    s.quadraticCurveTo(w - c, h - c, w - c, h);
    s.lineTo(-w + c, h);
    s.quadraticCurveTo(-w + c, h - c, -w, h - c);
    s.lineTo(-w, -h + c);
    s.quadraticCurveTo(-w + c, -h + c, -w + c, -h);
    plate = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0022, bevelSegments: 2, curveSegments: 6 });
    plate.translate(0, 0, 0.0018);
    const p = plate.attributes.position as THREE.BufferAttribute;
    const uv = plate.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) / D.plateW + 0.5, p.getY(k) / D.plateH + 0.5);
    return plate;
}

let screw: THREE.BufferGeometry | null = null;

/** A domed screw head with its slot cut across, centred, facing +Z. */
export function screwGeometry() {
    if (screw) return screw;
    const r = 0.012;
    const parts: THREE.BufferGeometry[] = [];
    // two half domes either side of the slot
    for (const side of [-1, 1]) {
        const g = new THREE.SphereGeometry(r, 12, 5, side > 0 ? 0 : Math.PI, Math.PI, 0, Math.PI / 2);
        g.rotateX(Math.PI / 2);
        g.rotateZ(Math.PI / 2);
        g.scale(1, 1, 0.5);
        g.translate(0, side * 0.0013, 0);
        parts.push(g);
    }
    // the bottom of the slot
    const slot = new THREE.PlaneGeometry(r * 2, 0.0026);
    slot.translate(0, 0, 0.0018);
    parts.push(slot);
    screw = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    return screw;
}

let hole: THREE.BufferGeometry | null = null;

/** An empty screw hole. */
export function holeGeometry() {
    if (hole) return hole;
    hole = new THREE.CircleGeometry(0.0055, 10);
    return hole;
}

let dust: THREE.BufferGeometry | null = null;

/** Motes in the air in front of the doorway, door space, with a random phase each. */
export function dustGeometry() {
    if (dust) return dust;
    const r = rng(4242);
    const count = 90;
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (r() - 0.5) * 2.2;
        pos[i * 3 + 1] = 0.1 + r() * 2.6;
        pos[i * 3 + 2] = 0.15 + r() * 1.9;
        phase[i] = r() * 100;
    }
    dust = new THREE.BufferGeometry();
    dust.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    dust.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.4, 1), 2.6);
    return dust;
}

let pool: THREE.BufferGeometry | null = null;

/** The floor in front of the threshold, where the doorway's light falls. */
export function poolGeometry() {
    if (pool) return pool;
    pool = new THREE.PlaneGeometry(4.4, 3.2, 1, 1);
    pool.rotateX(-Math.PI / 2);
    pool.translate(0, 0.003, D.roomZ + 0.33 + 1.6);
    return pool;
}
