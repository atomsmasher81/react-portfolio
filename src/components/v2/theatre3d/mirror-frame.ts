import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTexture, canvasTextureWork, once, paintPixelsWork, rng, valueNoise, type Work } from "@/components/v2/theatre3d/textures";
import { ARCH, GLASS } from "@/components/v2/theatre3d/mirror-glass";
import { ellipsoid, place2D, scroll2D, taperedTube } from "@/components/v2/theatre3d/mirror-geometry";

// The frame: a heavy carved and gilded moulding swept around the glass, with
// a shell and scrolls for a crest, rosettes at the feet and a dark plinth.
// Every vertex carries an `aWear` attribute (how recessed it is, how exposed
// to hands and cloths, and whether it is bare wood) that the material uses to
// rub the gilt through to red bole, gesso and wood, and to pack grime into
// the hollows.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

interface ProfilePoint {
    u: number; // outward from the glass edge
    z: number; // out from the wall
    recess: number;
    expo: number;
    crease?: boolean;
}

// The moulding's cross-section, from the lip over the glass out to the wall:
// a sight-edge bead, a cove (beads sit in it), a big rounded torus, a flat
// frieze, an outer bead and a stepped back edge.
const P = (u: number, z: number, recess: number, expo: number, crease = false): ProfilePoint => ({ u, z, recess, expo, crease });
const PROFILE: ProfilePoint[] = [
    P(-0.016, 0.05, 0.6, 0, true),
    P(-0.016, 0.082, 0.4, 0.2, true),
    P(-0.009, 0.094, 0, 0.8),
    P(0.003, 0.091, 0.1, 0.5),
    P(0.01, 0.083, 0.6, 0, true),
    P(0.024, 0.087, 0.85, 0),
    P(0.04, 0.099, 0.65, 0),
    P(0.054, 0.117, 0.4, 0.1),
    P(0.064, 0.133, 0.35, 0.3, true),
    P(0.07, 0.137, 0.3, 0.4, true),
    P(0.08, 0.15, 0, 0.7),
    P(0.095, 0.162, 0, 1),
    P(0.112, 0.166, 0, 1),
    P(0.128, 0.16, 0, 0.9),
    P(0.14, 0.146, 0.1, 0.5),
    P(0.146, 0.132, 0.6, 0, true),
    P(0.151, 0.126, 0.55, 0.1, true),
    P(0.178, 0.12, 0.45, 0.2, true),
    P(0.184, 0.128, 0.2, 0.5),
    P(0.193, 0.134, 0, 0.9),
    P(0.202, 0.13, 0, 0.8),
    P(0.208, 0.118, 0.3, 0.4, true),
    P(0.214, 0.108, 0.45, 0.2, true),
    P(0.226, 0.098, 0.2, 0.5),
    P(0.232, 0.08, 0.2, 0.4),
    P(0.234, 0.0, 0.5, 0, true),
];
export const FRAME_WIDTH = 0.234;

interface ProfileVertex {
    u: number;
    z: number;
    nu: number;
    nz: number;
    v: number;
    recess: number;
    expo: number;
}

/** The profile as vertices with 2D normals; creases get two vertices so they stay sharp. */
function profileVertices() {
    const out: ProfileVertex[] = [];
    let arc = 0;
    const perp = (a: ProfilePoint, b: ProfilePoint) => {
        const du = b.u - a.u;
        const dz = b.z - a.z;
        const l = Math.hypot(du, dz);
        return [-dz / l, du / l];
    };
    PROFILE.forEach((p, i) => {
        const prev = PROFILE[i - 1];
        const next = PROFILE[i + 1];
        if (prev) arc += Math.hypot(p.u - prev.u, p.z - prev.z);
        const nIn = prev ? perp(prev, p) : null;
        const nOut = next ? perp(p, next) : null;
        const push = (n: number[]) => out.push({ u: p.u, z: p.z, nu: n[0], nz: n[1], v: arc, recess: p.recess, expo: p.expo });
        if (p.crease || !nIn || !nOut) {
            if (nIn) push(nIn);
            if (nOut) push(nOut);
        } else {
            const nu = nIn[0] + nOut[0];
            const nz = nIn[1] + nOut[1];
            const l = Math.hypot(nu, nz);
            push([nu / l, nz / l]);
        }
    });
    return out;
}

interface PathSegment {
    points: THREE.Vector2[];
    normals: THREE.Vector2[]; // outward, unit
}

/** The glass outline as four runs (bottom, right, arch, left), counter-clockwise, with outward normals. */
function outline(): PathSegment[] {
    const h = GLASS.half;
    const straight = (a: THREE.Vector2, b: THREE.Vector2, n: THREE.Vector2): PathSegment => ({ points: [a, b], normals: [n, n] });
    const arch: PathSegment = { points: [], normals: [] };
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
        const a = ARCH.from + ((Math.PI - 2 * ARCH.from) * i) / steps;
        const n = new THREE.Vector2(Math.cos(a), Math.sin(a));
        arch.points.push(new THREE.Vector2(ARCH.cx, ARCH.cy).addScaledVector(n, ARCH.radius));
        arch.normals.push(n);
    }
    return [
        straight(new THREE.Vector2(-h, GLASS.bottom), new THREE.Vector2(h, GLASS.bottom), new THREE.Vector2(0, -1)),
        straight(new THREE.Vector2(h, GLASS.bottom), new THREE.Vector2(h, GLASS.shoulder), new THREE.Vector2(1, 0)),
        arch,
        straight(new THREE.Vector2(-h, GLASS.shoulder), new THREE.Vector2(-h, GLASS.bottom), new THREE.Vector2(-1, 0)),
    ];
}

/** Sweep the profile along each run, mitring the ends where runs meet, like a joiner would. */
function moulding() {
    const prof = profileVertices();
    const runs = outline();
    const geos: THREE.BufferGeometry[] = [];
    let pathArc = 0;
    runs.forEach((run, k) => {
        const before = runs[(k + runs.length - 1) % runs.length];
        const after = runs[(k + 1) % runs.length];
        const pos: number[] = [];
        const nor: number[] = [];
        const uv: number[] = [];
        const wear: number[] = [];
        const idx: number[] = [];
        const n = run.points.length;
        for (let i = 0; i < n; i++) {
            const p = run.points[i];
            const nrm = run.normals[i];
            if (i > 0) pathArc += p.distanceTo(run.points[i - 1]);
            // at the ends, offsets run along the mitre so the two runs meet cleanly
            let off = nrm;
            if (i === 0 || i === n - 1) {
                const other = i === 0 ? before.normals[before.normals.length - 1] : after.normals[0];
                const m = nrm.clone().add(other).normalize();
                off = m.multiplyScalar(1 / m.dot(nrm));
            }
            for (const v of prof) {
                pos.push(p.x + off.x * v.u, p.y + off.y * v.u, v.z);
                const nx = nrm.x * v.nu;
                const ny = nrm.y * v.nu;
                const l = Math.hypot(nx, ny, v.nz);
                nor.push(nx / l, ny / l, v.nz / l);
                uv.push(pathArc * 1.1, v.v * 3 + k * 0.37);
                wear.push(v.recess, v.expo, 0);
            }
        }
        const m = prof.length;
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < m - 1; j++) {
                const a = i * m + j;
                const b = (i + 1) * m + j;
                const c = i * m + j + 1;
                const d = (i + 1) * m + j + 1;
                idx.push(a, c, b, b, c, d);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute("aWear", new THREE.Float32BufferAttribute(wear, 3));
        g.setIndex(idx);
        geos.push(g);
    });
    return geos;
}

/** Walk the outline at a steady spacing, staying clear of the mitred corners. */
function alongOutline(spacing: number, clear: number, visit: (p: THREE.Vector2, n: THREE.Vector2, t: THREE.Vector2) => void) {
    for (const run of outline()) {
        let carried = spacing / 2;
        for (let i = 0; i < run.points.length - 1; i++) {
            const a = run.points[i];
            const b = run.points[i + 1];
            const len = a.distanceTo(b);
            const t = b.clone().sub(a).normalize();
            const runStart = run.points[0];
            const runEnd = run.points[run.points.length - 1];
            for (let s = carried; s < len; s += spacing) {
                const p = a.clone().addScaledVector(t, s);
                carried = s + spacing - len;
                if (p.distanceTo(runStart) < clear || p.distanceTo(runEnd) < clear) continue;
                const nn = run.normals[i].clone().lerp(run.normals[i + 1], s / len).normalize();
                visit(p, nn, t);
            }
            if (carried < 0) carried += spacing;
        }
    }
}

/** Give a geometry the attributes the merged frame needs, with wear judged from which way it faces. */
function asOrnament(g: THREE.BufferGeometry, { recessBias = 0, expoBias = 0, wood = 0 } = {}) {
    const geo = g;
    const nrm = geo.getAttribute("normal");
    const count = geo.getAttribute("position").count;
    const wear = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const nz = nrm.getZ(i);
        const ny = nrm.getY(i);
        wear[i * 3] = Math.min(1, Math.max(0, -nz * 0.7 + 0.12 + recessBias));
        wear[i * 3 + 1] = Math.min(1, Math.max(0, nz * 0.35 + ny * 0.15 + expoBias));
        wear[i * 3 + 2] = wood;
    }
    geo.setAttribute("aWear", new THREE.BufferAttribute(wear, 3));
    // Wear is sampled by position rather than by the part's own uvs, so small
    // carvings get the same grain as the moulding they sit on.
    const p = geo.getAttribute("position");
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        uv[i * 2] = p.getX(i) * 1.1 + p.getZ(i) * 0.7;
        uv[i * 2 + 1] = p.getY(i) * 1.1 - p.getZ(i) * 0.5;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv", "aWear"].includes(name)) geo.deleteAttribute(name);
    return geo;
}

/** A rosette: a boss, a ring of petals, a bead ring. Facing +Z at `at`. */
function rosette(at: THREE.Vector3, r: number) {
    const parts: THREE.BufferGeometry[] = [ellipsoid(r * 0.38, r * 0.38, r * 0.3, at, 12, 8)];
    const ring = new THREE.TorusGeometry(r * 0.88, r * 0.12, 6, 28);
    ring.translate(at.x, at.y, at.z - r * 0.15);
    parts.push(ring);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const petal = new THREE.SphereGeometry(1, 10, 6);
        petal.scale(r * 0.3, r * 0.13, r * 0.14);
        petal.rotateZ(a);
        petal.translate(at.x + Math.cos(a) * r * 0.55, at.y + Math.sin(a) * r * 0.55, at.z - r * 0.06);
        parts.push(petal);
    }
    return parts;
}

/** A fan shell: ribs curving out from a hinge, thickening toward a scalloped edge. `dir` is the way it opens. */
function shell(hinge: THREE.Vector3, radius: number, dir: number, ribs = 9) {
    const parts: THREE.BufferGeometry[] = [];
    const back = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    back.rotateX(Math.PI / 2);
    back.scale(radius * 0.92, radius * 0.92, radius * 0.16);
    back.rotateZ(dir - Math.PI / 2);
    back.translate(hinge.x, hinge.y, hinge.z - 0.012);
    // keep only the half that opens away from the hinge
    parts.push(halfDisc(back, hinge, dir));
    for (let i = 0; i < ribs; i++) {
        const a = dir - Math.PI * 0.42 + (Math.PI * 0.84 * i) / (ribs - 1);
        const c = Math.cos(a);
        const s = Math.sin(a);
        const pts = [0.08, 0.4, 0.72, 1].map((t) => V(hinge.x + c * radius * t, hinge.y + s * radius * t, hinge.z + 0.03 * Math.sin(t * Math.PI) + 0.004));
        parts.push(taperedTube(pts, (t) => radius * (0.035 + 0.06 * t), 16, 6));
        parts.push(ellipsoid(radius * 0.1, radius * 0.1, radius * 0.08, V(hinge.x + c * radius * 1.02, hinge.y + s * radius * 1.02, hinge.z + 0.006), 8, 6));
    }
    parts.push(ellipsoid(radius * 0.16, radius * 0.16, radius * 0.12, V(hinge.x, hinge.y, hinge.z + 0.01), 10, 8));
    return parts;
}

/** Squash the vertices of a backing disc that fall behind the hinge line, so only a half fan shows. */
function halfDisc(g: THREE.BufferGeometry, hinge: THREE.Vector3, dir: number) {
    const pos = g.getAttribute("position");
    const dx = Math.cos(dir);
    const dy = Math.sin(dir);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) - hinge.x;
        const y = pos.getY(i) - hinge.y;
        const along = x * dx + y * dy;
        if (along < 0) pos.setXYZ(i, pos.getX(i) - along * dx, pos.getY(i) - along * dy, pos.getZ(i));
    }
    g.computeVertexNormals();
    return g;
}

/** A carved C- or S-scroll with bosses in the eyes of its volutes. */
function carvedScroll(opts: Parameters<typeof scroll2D>[0], place: { at: THREE.Vector3; scale: number; angle?: number; flip?: boolean; lift?: number }, thick: number) {
    const { points, eyes } = scroll2D(opts);
    const lift = place.lift ?? 0.02;
    // the spine stands proud in the middle and sinks back into the eyes
    const pts = place2D(points, { ...place, z: (t) => lift * Math.sin(t * Math.PI) });
    const e = place2D(eyes, { ...place, z: () => 0.004 });
    const body = (t: number) => 0.4 + 0.6 * Math.pow(Math.sin(Math.PI * t), 0.4);
    const parts = [taperedTube(pts, (t) => thick * body(t), 72, 9)];
    // a second, thinner roll running inside the first, as if carved with a groove between
    const inner: THREE.Vector2[] = [];
    for (let i = 4; i < points.length - 4; i++) {
        const a = points[i - 1];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        const off = (thick * 1.25) / (place.scale || 1);
        inner.push(new THREE.Vector2(points[i].x - (dy / l) * off, points[i].y + (dx / l) * off));
    }
    const innerPts = place2D(inner, { ...place, z: (t) => lift * 0.8 * Math.sin(t * Math.PI) - thick * 0.3 });
    parts.push(taperedTube(innerPts, (t) => thick * 0.42 * body(t), 64, 6));
    for (const p of e) parts.push(ellipsoid(thick * 1.05, thick * 1.05, thick * 0.8, p, 10, 8));
    return parts;
}

/** An acanthus leaf: a fat central rib with two lobes, curling over at the tip. */
function leaf(points: THREE.Vector3[], width: number) {
    const parts = [taperedTube(points, (t) => width * (0.55 - 0.45 * t) * (t < 0.08 ? 0.6 + t * 5 : 1), 28, 7)];
    const n = points.length;
    for (const side of [-1, 1]) {
        const lobe = points.map((p, i) => {
            const t = i / (n - 1);
            const next = points[Math.min(n - 1, i + 1)];
            const prev = points[Math.max(0, i - 1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const l = Math.hypot(dx, dy) || 1;
            const spread = width * 1.1 * Math.sin(Math.PI * Math.min(1, t * 1.15));
            return V(p.x - (dy / l) * spread * side, p.y + (dx / l) * spread * side, p.z - 0.008 * Math.sin(Math.PI * t));
        });
        parts.push(taperedTube(lobe.slice(0, Math.max(3, Math.round(n * 0.85))), (t) => width * 0.32 * (1 - 0.7 * t), 20, 6));
    }
    return parts;
}

/** A turned finial: a flame on a bead and a cup. */
function finial(at: THREE.Vector3, h: number) {
    const pts = [
        [0.0, 0],
        [0.22, 0.02],
        [0.3, 0.1],
        [0.18, 0.2],
        [0.3, 0.28],
        [0.36, 0.38],
        [0.32, 0.5],
        [0.2, 0.68],
        [0.09, 0.86],
        [0.0, 1],
    ].map(([r, y]) => new THREE.Vector2(r * h * 0.5, y * h));
    const g = new THREE.LatheGeometry(pts, 14);
    g.translate(at.x, at.y, at.z);
    return g;
}

/** The whole frame as one geometry (position, normal, uv, aWear). Built once. */
export function getFrameGeometry() {
    return frameShape();
}

const frameShape = once(function* (): Work<THREE.BufferGeometry> {
    const r = rng(5150);
    const parts: THREE.BufferGeometry[] = [...moulding()];
    const orn: THREE.BufferGeometry[] = [];
    yield;

    // pearls sitting in the cove, all the way round
    alongOutline(0.024, 0.045, (p, n) => {
        orn.push(ellipsoid(0.0085, 0.0085, 0.0068, V(p.x + n.x * 0.025, p.y + n.y * 0.025, 0.095), 8, 6));
    });
    // gadroons: short slanted ribs over the big torus
    alongOutline(0.036, 0.07, (p, n, t) => {
        const g = new THREE.SphereGeometry(1, 10, 6);
        g.scale(0.021, 0.0072, 0.0075);
        g.rotateZ(Math.atan2(t.y, t.x) + 0.75);
        g.translate(p.x + n.x * 0.104, p.y + n.y * 0.104, 0.163);
        orn.push(g);
    });
    // a run of small beads on the outer edge
    alongOutline(0.019, 0.05, (p, n) => {
        orn.push(ellipsoid(0.0058, 0.0058, 0.0048, V(p.x + n.x * 0.193, p.y + n.y * 0.193, 0.134), 6, 5));
    });
    yield;

    // rosettes at the two bottom corners
    for (const side of [-1, 1]) orn.push(...rosette(V(side * (GLASS.half + 0.11), GLASS.bottom - 0.11, 0.165), 0.068));

    // the crest: a shell framed by two C-scrolls, leaves running down the arch, a flame on top
    const apexOuter = GLASS.apex + FRAME_WIDTH;
    orn.push(...shell(V(0, apexOuter - 0.08, 0.172), 0.22, Math.PI / 2, 11));
    for (const flip of [false, true]) {
        const sx = flip ? -1 : 1;
        // S-scrolls either side of the shell: the top curls in over it, the foot curls out along the arch
        orn.push(
            ...carvedScroll(
                { height: 1, top: 0.2, bottom: 0.14, bow: 0.1, turnsTop: 1.2, turnsBottom: 1.0, s: true },
                { at: V(sx * 0.25, apexOuter + 0.03, 0.16), scale: 0.36, angle: sx * -0.3, flip: !flip, lift: 0.04 },
                0.026,
            ),
        );
        // a small leaf flicking up and out from the outer side of each scroll
        const fx = sx * 0.36;
        const fy = apexOuter + 0.07;
        orn.push(...leaf([V(fx, fy - 0.06, 0.16), V(fx + sx * 0.04, fy, 0.175), V(fx + sx * 0.1, fy + 0.03, 0.18), V(fx + sx * 0.15, fy + 0.0, 0.17), V(fx + sx * 0.16, fy - 0.035, 0.16)], 0.026));
        // a leaf from the foot of each C-scroll, lying along the top of the arch and curling over before the shoulder
        const leafPts: THREE.Vector3[] = [];
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const a = Math.PI / 2 - sx * (0.17 + t * 0.29);
            const rad = ARCH.radius + FRAME_WIDTH * (0.74 - 0.12 * t);
            leafPts.push(V(ARCH.cx + Math.cos(a) * rad, ARCH.cy + Math.sin(a) * rad, 0.17 + 0.035 * Math.sin(t * Math.PI)));
        }
        const last = leafPts[leafPts.length - 1];
        leafPts.push(V(last.x + sx * 0.035, last.y + 0.035, 0.185), V(last.x + sx * 0.01, last.y + 0.07, 0.19), V(last.x - sx * 0.025, last.y + 0.055, 0.18));
        orn.push(...leaf(leafPts, 0.048));
        // shoulder ornament: a C-scroll standing out past the corner, opening toward the frame, a leaf hanging below
        const shoulderY = GLASS.shoulder + 0.05;
        orn.push(
            ...carvedScroll(
                { height: 1, top: 0.25, bottom: 0.17, bow: 0.05, turnsTop: 1.2, turnsBottom: 1.0 },
                { at: V(sx * (GLASS.half + FRAME_WIDTH - 0.015), shoulderY, 0.14), scale: 0.3, angle: sx * 0.1, flip: !flip, lift: 0.035 },
                0.024,
            ),
        );
        const drop: THREE.Vector3[] = [];
        for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            drop.push(V(sx * (GLASS.half + FRAME_WIDTH * 0.58 + 0.01 * Math.sin(t * 6)), shoulderY - 0.16 - t * 0.4, 0.152 + 0.022 * Math.sin(t * Math.PI)));
        }
        orn.push(...leaf(drop, 0.026));
        orn.push(ellipsoid(0.022, 0.022, 0.018, V(sx * (GLASS.half + FRAME_WIDTH * 0.58), shoulderY - 0.6, 0.152), 10, 8));
        yield;
    }
    orn.push(ellipsoid(0.034, 0.034, 0.03, V(0, apexOuter + 0.155, 0.16), 12, 10));
    orn.push(finial(V(0, apexOuter + 0.17, 0.16), 0.17));
    // an apron shell hanging under the bottom rail's centre
    orn.push(...shell(V(0, GLASS.bottom - 0.03, 0.17), 0.13, -Math.PI / 2, 9));

    for (let i = 0; i < orn.length; i++) {
        parts.push(asOrnament(orn[i], { expoBias: r() * 0.1 }));
        if (i % 40 === 39) yield;
    }
    yield;

    // the plinth it stands on: dark wood with a rounded nose
    const plinth = new THREE.BoxGeometry(2 * (GLASS.half + FRAME_WIDTH) + 0.08, 0.07, 0.25);
    plinth.translate(0, 0.035, 0.125);
    const nose = new THREE.CylinderGeometry(0.026, 0.026, 2 * (GLASS.half + FRAME_WIDTH) + 0.08, 12, 1);
    nose.rotateZ(Math.PI / 2);
    nose.translate(0, 0.058, 0.232);
    parts.push(asOrnament(plinth, { wood: 1 }), asOrnament(nose, { wood: 0.85 }));

    const frameGeometry = mergeGeometries(parts, false)!;
    frameGeometry.computeBoundingSphere();
    return frameGeometry;
});

/** Tiling fractal noise: each octave's lattice wraps exactly once across the texture. */
function tiledFbm(seed: number, base: number, octaves: number) {
    const layers = Array.from({ length: octaves }, (_, i) => ({ n: valueNoise(seed + i * 37, base << i), f: base << i }));
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

/** R: broad rub-through patches, G: fine grain, B: tarnish. Tiles. */
const wear = once(function* (): Work<THREE.CanvasTexture> {
    const S = 256;
    const broad = tiledFbm(901, 4, 5);
    yield;
    const fine = tiledFbm(902, 16, 3);
    yield;
    const tarnish = tiledFbm(903, 3, 4);
    yield;
    const wearTexture = (yield canvasTextureWork(S, S, (ctx) => paintPixelsWork(ctx, S, S, (x, y) => [broad(x / S, y / S) * 255, fine(x / S, y / S) * 255, tarnish(x / S, y / S) * 255]), { srgb: false })) as THREE.CanvasTexture;
    wearTexture.wrapS = wearTexture.wrapT = THREE.RepeatWrapping;
    return wearTexture;
});
const getWearTexture = () => wear();
/** Paint the frame's wear a slice at a time (and build its shape): then they're there at once. */
export const prepareFrame = () => Promise.all([wear.built.prepare(), frameShape.built.prepare()]);

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/**
 * A small made-up surrounding for the gilt to reflect: near-black, a row of
 * warm lamps at eye level, a faint red glow far off, a warmer floor. Without
 * it the metal reads as flat black between highlights.
 */
export function getFrameEnvironment(gl: THREE.WebGLRenderer) {
    const hit = envCache.get(gl);
    if (hit) return hit;
    const W = 256;
    const H = 128;
    const tex = canvasTexture(W, H, (ctx) => {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#030202");
        sky.addColorStop(0.45, "#120a06");
        sky.addColorStop(0.55, "#1a0f08");
        sky.addColorStop(1, "#0a0604");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        const glow = (x: number, y: number, r: number, color: string, a: number) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, color);
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = a;
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
        };
        const r = rng(4242);
        for (let i = 0; i < 9; i++) glow((i / 9) * W + r() * 12, H * (0.4 + r() * 0.06), 10 + r() * 8, "#ffb36b", 0.55 + r() * 0.35);
        glow(W * 0.62, H * 0.38, 22, "#ff4a2a", 0.35);
        glow(W * 0.5, H * 0.2, 40, "#3a2416", 0.6);
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    envCache.set(gl, env);
    return env;
}

/** Worn gilt over red bole and gesso, dark wood where it is rubbed through, grime in every hollow. */
export function makeFrameMaterial(gl: THREE.WebGLRenderer) {
    const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45, metalness: 0.9, envMap: getFrameEnvironment(gl), envMapIntensity: 1.2 });
    const tWear = { value: getWearTexture() };
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.tWear = tWear;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute vec3 aWear;\nvarying vec3 vWear;\nvarying vec2 vWearUv;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWear = aWear;\nvWearUv = uv;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform sampler2D tWear;\nvarying vec3 vWear;\nvarying vec2 vWearUv;")
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
                vec3 wa = texture2D(tWear, vWearUv * 1.4).rgb;
                vec3 wb = texture2D(tWear, vWearUv * 5.3 + 0.37).rgb;
                float recess = vWear.x;
                float expo = vWear.y;
                // gilt rubs through on the high, handled places first, in small worn islands
                float rub = wa.r * 0.5 + wb.g * 0.5 + expo * 0.32 - recess * 0.4;
                float worn = max(smoothstep(0.62, 0.67, rub), vWear.z);
                float deep = max(smoothstep(0.73, 0.79, rub), vWear.z);
                vec3 gold = mix(vec3(0.3, 0.19, 0.07), vec3(0.62, 0.45, 0.18), smoothstep(0.3, 0.7, wb.r));
                gold = mix(gold, vec3(0.15, 0.12, 0.065), smoothstep(0.5, 0.75, wa.b) * 0.65);
                vec3 bole = vec3(0.15, 0.045, 0.025);
                vec3 gesso = vec3(0.3, 0.27, 0.22);
                // red bole under the gilt; chalky gesso and then wood only where it is worn deepest
                vec3 under = mix(bole, gesso, smoothstep(0.55, 0.75, wb.b) * deep);
                under = mix(under, vec3(0.03, 0.017, 0.01), max(smoothstep(0.82, 0.9, rub), vWear.z));
                float grime = clamp(recess * (0.55 + 0.7 * wa.g), 0.0, 1.0);
                diffuseColor.rgb = mix(gold, under, worn) * (1.0 - 0.82 * grime);`,
            )
            .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.3 + 0.25 * wb.g, 0.85, worn) + grime * 0.2;")
            .replace("#include <metalnessmap_fragment>", "float metalnessFactor = mix(0.92, 0.0, worn) * (1.0 - grime * 0.6);")
            .replace("#include <aomap_fragment>", "#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= 1.0 - grime * 0.7;\nreflectedLight.indirectSpecular *= 1.0 - grime * 0.8;");
    };
    return mat;
}
