import * as THREE from "three";
import { INNER, OUTER, theta } from "@/components/v2/theatre3d/layout";

// Geometry helpers for the corridor's shell. Parts are described in a flat
// "wall space" (u metres along the wall, left to right as you face it; y up;
// d metres out of the wall toward you) and a Frame maps that onto the world:
// bent around the curve for the long walls, flat for the end walls and props.
// Everything that shares a material is accumulated into one Mesher, so the
// whole corridor costs a handful of draw calls.

export interface Frame {
    point(u: number, y: number, d: number, out: THREE.Vector3): THREE.Vector3;
    dir(nu: number, ny: number, nd: number, u: number, out: THREE.Vector3): THREE.Vector3;
}

export type Side = "outer" | "inner";

export interface WallFrame extends Frame {
    /** Wall-space u of a point s along the corridor. */
    uAt(s: number): number;
    radius: number;
}

/**
 * The outer or inner wall, unrolled. u starts at s0 and runs to the right as
 * you face the wall: along the walk on the outer wall, against it on the inner.
 */
export function wallFrame(side: Side, s0: number): WallFrame {
    const R = side === "outer" ? OUTER : INNER;
    const k = side === "outer" ? 1 : -1;
    const t0 = theta(s0);
    return {
        radius: R,
        uAt: (s) => k * (theta(s) - t0) * R,
        point(u, y, d, out) {
            const t = t0 + (k * u) / R;
            const r = R - k * d;
            return out.set(r * Math.cos(t), y, r * Math.sin(t));
        },
        dir(nu, ny, nd, u, out) {
            const t = t0 + (k * u) / R;
            const c = Math.cos(t);
            const s = Math.sin(t);
            // u follows k * tangent, d follows -k * outward
            return out.set(-k * s * nu - k * c * nd, ny, k * c * nu - k * s * nd);
        },
    };
}

/** A flat wall: u along `right`, y up, d out of it (right x up). */
export function flatFrame(origin: THREE.Vector3, right: THREE.Vector3): Frame {
    const o = origin.clone();
    const U = right.clone().setY(0).normalize();
    const D = new THREE.Vector3().crossVectors(U, new THREE.Vector3(0, 1, 0));
    return {
        point: (u, y, d, out) => out.copy(o).addScaledVector(U, u).addScaledVector(D, d).setY(o.y + y),
        dir: (nu, ny, nd, _u, out) => out.set(U.x * nu + D.x * nd, ny, U.z * nu + D.z * nd),
    };
}

/**
 * Horizontal surfaces along the corridor: u is arc length along the
 * centreline from s0, y is metres out from the inner wall, d is height. With
 * `local`, positions come out in the XY plane (z up), for a mesh that is
 * rotated -90 degrees about X: the reflector needs its plane in local XY.
 */
export function ringFrame(s0: number, centre: number, local = false): Frame {
    const t0 = theta(s0);
    return {
        point(u, y, d, out) {
            const t = t0 + u / centre;
            const r = INNER + y;
            const x = r * Math.cos(t);
            const z = r * Math.sin(t);
            return local ? out.set(x, -z, d) : out.set(x, d, z);
        },
        dir(nu, ny, nd, u, out) {
            const t = t0 + u / centre;
            const c = Math.cos(t);
            const s = Math.sin(t);
            // u follows the tangent, y the outward direction, d is up
            const x = -s * nu + c * ny;
            const z = c * nu + s * ny;
            return local ? out.set(x, -z, nd) : out.set(x, nd, z);
        },
    };
}

/** World space as-is, for odd pieces placed by hand. */
export const WORLD: Frame = {
    point: (u, y, d, out) => out.set(u, y, d),
    dir: (nu, ny, nd, _u, out) => out.set(nu, ny, nd),
};

export type Shade = number | readonly [number, number, number] | readonly [number, number, number, number];

/** Accumulates triangles for one material, with normals, uvs and vertex colours. */
export class Mesher {
    private pos: number[] = [];
    private nor: number[] = [];
    private uvs: number[] = [];
    private col: number[] = [];
    private idx: number[] = [];
    private p = new THREE.Vector3();
    private n = new THREE.Vector3();

    constructor(readonly alpha = false) {}

    get count() {
        return this.pos.length / 3;
    }

    vert(f: Frame, u: number, y: number, d: number, nu: number, ny: number, nd: number, tu: number, tv: number, shade: Shade = 1) {
        f.point(u, y, d, this.p);
        f.dir(nu, ny, nd, u, this.n).normalize();
        this.pos.push(this.p.x, this.p.y, this.p.z);
        this.nor.push(this.n.x, this.n.y, this.n.z);
        this.uvs.push(tu, tv);
        if (typeof shade === "number") this.col.push(shade, shade, shade);
        else this.col.push(shade[0], shade[1], shade[2]);
        if (this.alpha) this.col.push(typeof shade === "number" || shade.length < 4 ? 1 : (shade as readonly number[])[3]);
        return this.count - 1;
    }

    /** A triangle, wound to face the way its vertex normals point. */
    tri(a: number, b: number, c: number) {
        const P = this.pos;
        const N = this.nor;
        const e1x = P[b * 3] - P[a * 3];
        const e1y = P[b * 3 + 1] - P[a * 3 + 1];
        const e1z = P[b * 3 + 2] - P[a * 3 + 2];
        const e2x = P[c * 3] - P[a * 3];
        const e2y = P[c * 3 + 1] - P[a * 3 + 1];
        const e2z = P[c * 3 + 2] - P[a * 3 + 2];
        const cx = e1y * e2z - e1z * e2y;
        const cy = e1z * e2x - e1x * e2z;
        const cz = e1x * e2y - e1y * e2x;
        const nx = N[a * 3] + N[b * 3] + N[c * 3];
        const ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1];
        const nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
        if (cx * nx + cy * ny + cz * nz < 0) this.idx.push(a, c, b);
        else this.idx.push(a, b, c);
    }

    /** Corners in order around the quad. */
    quad(a: number, b: number, c: number, d: number) {
        this.tri(a, b, c);
        this.tri(a, c, d);
    }

    /** Triangles exactly as given (for geometry that is already wound). */
    raw(a: number, b: number, c: number) {
        this.idx.push(a, b, c);
    }

    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
        g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, this.alpha ? 4 : 3));
        g.setIndex(this.idx);
        g.computeBoundingSphere();
        return g;
    }
}

type ShadeFn = (u: number, y: number) => Shade;
const shadeOf = (s: Shade | ShadeFn | undefined, u: number, y: number): Shade => (s === undefined ? 1 : typeof s === "function" ? s(u, y) : s);

/** A flat sheet facing +d (or -d), split into columns along u and the given rows. */
export function sheet(
    m: Mesher,
    f: Frame,
    u0: number,
    u1: number,
    rows: number[],
    d: number,
    o: { step?: number; facing?: 1 | -1; uv: (u: number, y: number) => [number, number]; shade?: Shade | ShadeFn },
) {
    const n = Math.max(1, Math.ceil((u1 - u0) / (o.step ?? 0.25)));
    const facing = o.facing ?? 1;
    const ids: number[][] = [];
    for (let i = 0; i <= n; i++) {
        const u = u0 + ((u1 - u0) * i) / n;
        ids.push(rows.map((y) => m.vert(f, u, y, d, 0, 0, facing, ...o.uv(u, y), shadeOf(o.shade, u, y))));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < rows.length - 1; j++) m.quad(ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1]);
}

export interface SweepOpts {
    step?: number;
    caps?: [boolean, boolean];
    /** Which texture axis u runs along: "uy" for wood grained along y (mouldings), "ux" for the beams. */
    uv?: "ux" | "uy";
    shade?: Shade | ShadeFn;
    /** Profile corners sharper than this (radians) stay hard. */
    crease?: number;
    uvOffset?: number;
}

/**
 * Extrude a profile (points [d, y], bottom to top, the visible side facing +d)
 * along u from u0 to u1. Used for skirting, rails, wall plates and corbels.
 */
export function sweep(m: Mesher, f: Frame, profile: [number, number][], u0: number, u1: number, o: SweepOpts = {}) {
    const n = Math.max(1, Math.ceil((u1 - u0) / (o.step ?? 0.25)));
    const crease = o.crease ?? 0.6;
    const segN: [number, number][] = [];
    const len: number[] = [0];
    for (let i = 0; i < profile.length - 1; i++) {
        const dd = profile[i + 1][0] - profile[i][0];
        const dy = profile[i + 1][1] - profile[i][1];
        const l = Math.hypot(dd, dy) || 1;
        segN.push([dy / l, -dd / l]); // [nd, ny]
        len.push(len[i] + l);
    }
    const blend = (a: [number, number] | undefined, b: [number, number]): [number, number] => {
        if (!a) return b;
        const dot = a[0] * b[0] + a[1] * b[1];
        if (Math.acos(Math.max(-1, Math.min(1, dot))) > crease) return b;
        return [a[0] + b[0], a[1] + b[1]];
    };
    const off = o.uvOffset ?? 0;
    const uvAt = (u: number, along: number): [number, number] => (o.uv === "ux" ? [u + off, along + profile[0][1]] : [along + off, u]);
    for (let i = 0; i < segN.length; i++) {
        const nA = blend(segN[i - 1], segN[i]);
        const nB = blend(segN[i + 1], segN[i]);
        const [dA, yA] = profile[i];
        const [dB, yB] = profile[i + 1];
        let prevA = -1;
        let prevB = -1;
        for (let k = 0; k <= n; k++) {
            const u = u0 + ((u1 - u0) * k) / n;
            const a = m.vert(f, u, yA, dA, 0, nA[1], nA[0], ...uvAt(u, len[i]), shadeOf(o.shade, u, yA));
            const b = m.vert(f, u, yB, dB, 0, nB[1], nB[0], ...uvAt(u, len[i + 1]), shadeOf(o.shade, u, yB));
            if (k > 0) m.quad(prevA, a, b, prevB);
            prevA = a;
            prevB = b;
        }
    }
    const caps = o.caps ?? [false, false];
    if (caps[0] || caps[1]) {
        const first = profile[0];
        const last = profile[profile.length - 1];
        // close the outline back against the wall
        const poly = profile.map(([d, y]) => new THREE.Vector2(d, y));
        if (first[0] > 0) poly.unshift(new THREE.Vector2(0, first[1]));
        if (last[0] > 0) poly.push(new THREE.Vector2(0, last[1]));
        const tris = THREE.ShapeUtils.triangulateShape(poly, []);
        ([0, 1] as const).forEach((end) => {
            if (!caps[end]) return;
            const u = end === 0 ? u0 : u1;
            const nu = end === 0 ? -1 : 1;
            const ids = poly.map((p) => m.vert(f, u, p.y, p.x, nu, 0, 0, p.x + off, p.y, shadeOf(o.shade, u, p.y)));
            for (const [a, b, c] of tris) m.tri(ids[a], ids[b], ids[c]);
        });
    }
}

export interface PanelOpts {
    raise?: number;
    bevel?: number;
    step?: number;
    shade?: Shade;
    uvOffset?: [number, number];
}

/**
 * A raised panel: a flat field standing proud of the board at depth d0, with
 * four bevels running down to it. Each face keeps its own vertices so the
 * bevels catch the light with hard edges.
 */
export function raisedPanel(m: Mesher, f: Frame, u0: number, u1: number, y0: number, y1: number, d0: number, o: PanelOpts = {}) {
    const r = o.raise ?? 0.016;
    const b = Math.min(o.bevel ?? 0.055, (u1 - u0) / 3, (y1 - y0) / 3);
    const n = Math.max(1, Math.ceil((u1 - u0 - 2 * b) / (o.step ?? 0.2)));
    const [ou, ov] = o.uvOffset ?? [0, 0];
    const shade = o.shade ?? 1;
    const fd = d0 + r;
    const uv = (u: number, y: number): [number, number] => [u + ou, y + ov];
    const lerpU = (a: number, c: number, k: number) => a + ((c - a) * k) / n;
    // the field
    const field: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
        const u = lerpU(u0 + b, u1 - b, k);
        field.push([m.vert(f, u, y0 + b, fd, 0, 0, 1, ...uv(u, y0 + b), shade), m.vert(f, u, y1 - b, fd, 0, 0, 1, ...uv(u, y1 - b), shade)]);
    }
    for (let k = 0; k < n; k++) m.quad(field[k][0], field[k + 1][0], field[k + 1][1], field[k][1]);
    // bottom and top bevels
    const nl = Math.hypot(r, b);
    for (const top of [false, true]) {
        const yOut = top ? y1 : y0;
        const yIn = top ? y1 - b : y0 + b;
        const ny = (top ? r : -r) / nl;
        const nd = b / nl;
        let pa = -1;
        let pb = -1;
        for (let k = 0; k <= n; k++) {
            const uo = lerpU(u0, u1, k);
            const ui = lerpU(u0 + b, u1 - b, k);
            const a = m.vert(f, uo, yOut, d0, 0, ny, nd, ...uv(uo, yOut), shade);
            const c = m.vert(f, ui, yIn, fd, 0, ny, nd, ...uv(ui, yIn), shade);
            if (k > 0) m.quad(pa, a, c, pb);
            pa = a;
            pb = c;
        }
    }
    // left and right bevels
    for (const right of [false, true]) {
        const uOut = right ? u1 : u0;
        const uIn = right ? u1 - b : u0 + b;
        const nu = (right ? r : -r) / nl;
        const nd = b / nl;
        const a = m.vert(f, uOut, y0, d0, nu, 0, nd, ...uv(uOut, y0), shade);
        const c = m.vert(f, uIn, y0 + b, fd, nu, 0, nd, ...uv(uIn, y0 + b), shade);
        const e = m.vert(f, uIn, y1 - b, fd, nu, 0, nd, ...uv(uIn, y1 - b), shade);
        const g = m.vert(f, uOut, y1, d0, nu, 0, nd, ...uv(uOut, y1), shade);
        m.quad(a, c, e, g);
    }
}

/** A box in frame space: u0..u1, y0..y1, d0..d1, split along u so it can follow a curve. */
export function slab(
    m: Mesher,
    f: Frame,
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    d0: number,
    d1: number,
    o: { step?: number; shade?: Shade; uvScale?: number; uvOffset?: [number, number]; skip?: ("front" | "back" | "top" | "bottom" | "left" | "right")[] } = {},
) {
    const n = Math.max(1, Math.ceil((u1 - u0) / (o.step ?? 1)));
    const sc = o.uvScale ?? 1;
    const [ou, ov] = o.uvOffset ?? [0, 0];
    const shade = o.shade ?? 1;
    const skip = o.skip ?? [];
    // Long faces: grain along u. [y, d] at each edge of the face, and its normal.
    const faces: { name: "front" | "back" | "top" | "bottom"; a: [number, number]; b: [number, number]; n: [number, number] }[] = [
        { name: "front", a: [y0, d1], b: [y1, d1], n: [0, 1] },
        { name: "back", a: [y0, d0], b: [y1, d0], n: [0, -1] },
        { name: "top", a: [y1, d0], b: [y1, d1], n: [1, 0] },
        { name: "bottom", a: [y0, d0], b: [y0, d1], n: [-1, 0] },
    ];
    let vOff = 0;
    for (const face of faces) {
        const span = Math.abs(face.b[0] - face.a[0]) + Math.abs(face.b[1] - face.a[1]);
        if (!skip.includes(face.name)) {
            let pa = -1;
            let pb = -1;
            for (let k = 0; k <= n; k++) {
                const u = u0 + ((u1 - u0) * k) / n;
                const a = m.vert(f, u, face.a[0], face.a[1], 0, face.n[0], face.n[1], (u + ou) * sc, (vOff + ov) * sc, shade);
                const b = m.vert(f, u, face.b[0], face.b[1], 0, face.n[0], face.n[1], (u + ou) * sc, (vOff + span + ov) * sc, shade);
                if (k > 0) m.quad(pa, a, b, pb);
                pa = a;
                pb = b;
            }
        }
        vOff += span;
    }
    for (const end of ["left", "right"] as const) {
        if (skip.includes(end)) continue;
        const u = end === "left" ? u0 : u1;
        const nu = end === "left" ? -1 : 1;
        const c = [
            [y0, d0],
            [y0, d1],
            [y1, d1],
            [y1, d0],
        ].map(([y, d]) => m.vert(f, u, y, d, nu, 0, 0, (d + ou) * sc, (y + ov) * sc, shade));
        m.quad(c[0], c[1], c[2], c[3]);
    }
}

/** Append a ready-made geometry (built with x = u, y = y, z = d), optionally transformed first. */
export function addGeometry(m: Mesher, geo: THREE.BufferGeometry, f: Frame, pre?: THREE.Matrix4, shade: Shade = 1) {
    const g = pre ? geo.clone().applyMatrix4(pre) : geo;
    const P = g.getAttribute("position");
    const N = g.getAttribute("normal");
    const UV = g.getAttribute("uv");
    const base = m.count;
    for (let i = 0; i < P.count; i++) {
        m.vert(f, P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i), UV ? UV.getX(i) : 0, UV ? UV.getY(i) : 0, shade);
    }
    const index = g.getIndex();
    if (index) for (let j = 0; j < index.count; j += 3) m.raw(base + index.getX(j), base + index.getX(j + 1), base + index.getX(j + 2));
    else for (let j = 0; j < P.count; j += 3) m.raw(base + j, base + j + 1, base + j + 2);
    if (pre) g.dispose();
}
