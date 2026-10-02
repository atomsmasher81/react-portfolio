import * as THREE from "three";

// Small geometry builders shared by the mirror's frame and the silhouette:
// tubes that taper along a curve, lofts through elliptical rings, and the
// scroll curves that carved frames are made of. Everything is plain
// BufferGeometry so it can be merged into one draw call per material.

const tmpP = new THREE.Vector3();
const tmpN = new THREE.Vector3();

/** A tube along a smooth curve through `points`, its radius varying with t (0 at the start, 1 at the end). */
export function taperedTube(points: THREE.Vector3[], radius: (t: number) => number, segments = 32, radial = 8) {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const frames = curve.computeFrenetFrames(segments, false);
    const length = curve.getLength();
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        curve.getPointAt(t, tmpP);
        const r = radius(t);
        const N = frames.normals[i];
        const B = frames.binormals[i];
        for (let j = 0; j <= radial; j++) {
            const v = (j / radial) * Math.PI * 2;
            const sin = Math.sin(v);
            const cos = -Math.cos(v);
            tmpN.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
            pos.push(tmpP.x + r * tmpN.x, tmpP.y + r * tmpN.y, tmpP.z + r * tmpN.z);
            nor.push(tmpN.x, tmpN.y, tmpN.z);
            uv.push(t * length * 4, j / radial);
        }
    }
    for (let j = 1; j <= segments; j++) {
        for (let i = 1; i <= radial; i++) {
            const a = (radial + 1) * (j - 1) + (i - 1);
            const b = (radial + 1) * j + (i - 1);
            const c = (radial + 1) * j + i;
            const d = (radial + 1) * (j - 1) + i;
            idx.push(a, b, d, b, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
}

export interface Ring {
    y: number;
    a: number; // half width (x)
    b: number; // half depth (z)
    z?: number; // centre offset in z
    n?: number; // superellipse exponent: 2 is an ellipse, higher is squarer
}

/** A closed surface through horizontal rings, bottom to top, capped at the top. */
export function loft(rings: Ring[], segments = 24) {
    const pos: number[] = [];
    const idx: number[] = [];
    const ring = (r: Ring) => {
        const n = r.n ?? 2;
        for (let j = 0; j < segments; j++) {
            const phi = (j / segments) * Math.PI * 2;
            const c = Math.cos(phi);
            const s = Math.sin(phi);
            const x = r.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
            const z = (r.z ?? 0) + r.b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
            pos.push(x, r.y, z);
        }
    };
    rings.forEach(ring);
    for (let i = 0; i < rings.length - 1; i++) {
        for (let j = 0; j < segments; j++) {
            const a = i * segments + j;
            const b = i * segments + ((j + 1) % segments);
            const c = (i + 1) * segments + j;
            const d = (i + 1) * segments + ((j + 1) % segments);
            idx.push(a, c, b, b, c, d);
        }
    }
    // cap the top ring with a fan around its centre
    const top = rings[rings.length - 1];
    const centre = pos.length / 3;
    pos.push(0, top.y + 0.004, top.z ?? 0);
    const base = (rings.length - 1) * segments;
    for (let j = 0; j < segments; j++) idx.push(base + j, centre, base + ((j + 1) % segments));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** A sphere squashed into an ellipsoid and placed. Cheap stand-in for beads, bosses, heads. */
export function ellipsoid(rx: number, ry: number, rz: number, at: THREE.Vector3Like, w = 12, h = 8) {
    const g = new THREE.SphereGeometry(1, w, h);
    g.scale(rx, ry, rz);
    g.translate(at.x, at.y, at.z);
    return g;
}

/**
 * One end of a carved scroll: a spiral winding from radius r0 down to r1
 * around `c`, starting at angle a0 and turning through `sweep` radians.
 */
function spiral(c: THREE.Vector2, r0: number, r1: number, a0: number, sweep: number, steps: number) {
    const out: THREE.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = r0 * Math.pow(r1 / r0, t);
        const a = a0 + sweep * t;
        out.push(new THREE.Vector2(c.x + r * Math.cos(a), c.y + r * Math.sin(a)));
    }
    return out;
}

/**
 * A C-scroll in its own 2D space: two volutes joined by a bowed spine,
 * running from the eye of the top volute to the eye of the bottom one.
 * The spine bows to -x and both volutes curl toward +x. `s` turns the
 * bottom volute the other way, giving an S-scroll.
 */
export function scroll2D({ height = 1, top = 0.22, bottom = 0.16, bow = 0.08, turnsTop = 1.15, turnsBottom = 1.0, s = false } = {}) {
    const cTop = new THREE.Vector2(0, height / 2 - top);
    // an S-scroll's bottom volute hangs off the other side of the spine
    const cBot = new THREE.Vector2(s ? -top - bottom : 0, -height / 2 + bottom);
    const a = spiral(cTop, top, top * 0.18, Math.PI, -Math.PI * 2 * turnsTop, 28).reverse();
    const mid = new THREE.Vector2(-Math.max(top, bottom) - (s ? bow * 0.3 : bow), (cTop.y + cBot.y) / 2);
    const b = s
        ? spiral(cBot, bottom, bottom * 0.2, 0, -Math.PI * 2 * turnsBottom, 24)
        : spiral(cBot, bottom, bottom * 0.2, Math.PI, Math.PI * 2 * turnsBottom, 24);
    return { points: [...a, mid, ...b], eyes: [a[0], b[b.length - 1]] };
}

/** Place 2D points into 3D: scale, rotate by `angle`, mirror in x if `flip`, then move to `at` at depth z(t). */
export function place2D(points: THREE.Vector2[], { at, scale = 1, angle = 0, flip = false, z }: { at: THREE.Vector3; scale?: number; angle?: number; flip?: boolean; z: (t: number) => number }) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return points.map((p, i) => {
        const x = p.x * scale * (flip ? -1 : 1);
        const y = p.y * scale;
        const rx = x * c - y * s * (flip ? -1 : 1);
        const ry = x * s * (flip ? -1 : 1) + y * c;
        return new THREE.Vector3(at.x + rx, at.y + ry, at.z + z(i / (points.length - 1)));
    });
}
