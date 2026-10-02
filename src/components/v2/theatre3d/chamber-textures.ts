import * as THREE from "three";
import { Built, rng, type Work } from "@/components/v2/theatre3d/textures";
import { Surface, clamp01, hash2, makeCanvas, mix, periodic, readableCanvas, smooth, tileFbm, type Maps } from "@/components/v2/theatre3d/chamber-pixels";

// The chamber's surfaces, painted from code and shared by every room: old
// brick for the walls and the vault, worn flagstones, the limestone of the
// shrine, rusted iron, dark wood, a dust sheet, cobwebs and soft glows. Built
// on first use and kept for the life of the page (disposeChamberTextures
// frees their GPU memory; they upload again if they're used again). Painted a
// slice at a time beforehand with prepareChamberTextures() (textures.ts).

const made: THREE.Texture[] = [];
const keep = <T extends Maps | THREE.Texture>(m: T): T => {
    if (m instanceof THREE.Texture) made.push(m);
    else made.push(m.map, m.roughnessMap, m.normalMap);
    return m;
};

function once<T extends Maps | THREE.Texture>(build: () => Work<T>) {
    const built = new Built(function* () {
        return keep((yield build()) as T);
    });
    return Object.assign(() => built.get(), { built });
}

/** Free the GPU memory of every shared texture. */
export function disposeChamberTextures() {
    for (const t of made) t.dispose();
}

/* ---------------------------------------------------------------- brick */

// Old brick, a metre square, running bond, tiling both ways. Some bricks
// burnt dark, some spalled, the mortar sunk and crumbling.
function* brick(): Work<Maps> {
    const S = 512;
    const rows = 14;
    const rh = S / rows;
    const per = 4;
    const bw = S / per;
    const half = 2.6;
    const mott = tileFbm(301, 8, 4);
    yield;
    const spall = tileFbm(302, 5, 3);
    yield;
    const erode = tileFbm(303, 16, 3);
    yield;
    const grime = tileFbm(304, 3, 3);
    yield;
    const pits = periodic(305, 160, 160);
    yield;
    const tones: [number, number, number][] = [
        [74, 42, 32],
        [62, 40, 32],
        [42, 31, 27],
        [84, 54, 42],
        [68, 46, 37],
    ];
    const out = new Surface(S, S);
    for (let y = 0; y < S; y++) {
        const row = Math.floor(y / rh);
        const yy = y - row * rh;
        const off = (row % 2) * (bw / 2);
        const v = y / S;
        for (let x = 0; x < S; x++) {
            const u = x / S;
            const xx = (x + off) % S;
            const col = Math.floor(xx / bw);
            const xb = xx - col * bw;
            const id = row * per + col;
            const hb = hash2(id, row, 31);
            const hb2 = hash2(id, row, 37);
            const m = mott(u, v);
            const e = erode(u, v);
            const dEdge = Math.min(xb, bw - xb, yy, rh - yy);
            const lip = half + 1.2 + e * 3.4 + (hb2 > 0.8 ? 2 : 0);
            const isMortar = dEdge < lip;
            const grain = hash2(x, y, 3);
            let R: number;
            let G: number;
            let B: number;
            let rough: number;
            let height: number;
            if (isMortar) {
                const mm = 0.75 + 0.5 * m + 0.15 * (grain - 0.5);
                R = 74 * mm;
                G = 67 * mm;
                B = 58 * mm;
                rough = 0.96;
                height = 0.18 + 0.1 * e + 0.05 * grain + smooth(0, lip, dEdge) * 0.12;
            } else {
                const t = tones[Math.floor(hb * tones.length)];
                const k = (0.74 + 0.4 * hb2) * (0.82 + 0.36 * m) * (0.94 + 0.12 * grain);
                R = t[0] * k;
                G = t[1] * k;
                B = t[2] * k;
                rough = 0.86 + 0.08 * grain;
                const bevel = smooth(lip, lip + 4, dEdge);
                height = 0.48 + 0.24 * bevel + 0.06 * (m - 0.5) + 0.03 * grain;
                // spalled faces: the skin has come away, paler and rougher beneath
                const sp = smooth(0.64, 0.7, spall(u, v) + (hb - 0.5) * 0.2);
                if (sp > 0) {
                    R = mix(R, R * 1.18 + 8, sp);
                    G = mix(G, G * 1.12 + 6, sp);
                    B = mix(B, B * 1.08 + 4, sp);
                    height -= sp * 0.12;
                    rough = 0.97;
                }
                const p = smooth(0.78, 0.9, pits(u * 160, v * 160));
                height -= p * 0.08;
                R *= 1 - p * 0.3;
                G *= 1 - p * 0.3;
                B *= 1 - p * 0.3;
            }
            const gr = 0.78 + 0.34 * grime(u, v);
            out.set(y * S + x, R * gr, G * gr, B * gr, clamp01(rough), height);
        }
        yield;
    }
    return (yield out.mapsWork(0.01 * S, true)) as Maps;
}

/* ----------------------------------------------------------- flagstones */

// Flagstones, 2 m square, tiling: rows of slabs set unevenly, the joints
// packed with dirt, worn smooth where feet go, a couple cracked, and damp
// patches that shine.
function* flags(): Work<Maps> {
    const S = 512;
    const ppm = S / 2;
    const r = rng(411);
    const rowsM: number[] = [];
    let acc = 0;
    while (acc < 2 - 0.3) {
        const h = 0.36 + r() * 0.26;
        rowsM.push(h);
        acc += h;
    }
    const scaleY = 2 / acc;
    const rowEdges: number[] = [0];
    for (const h of rowsM) rowEdges.push(rowEdges[rowEdges.length - 1] + h * scaleY * ppm);
    const cuts: number[][] = rowsM.map(() => {
        const c: number[] = [];
        let a = r() * 0.4;
        while (a < 2) {
            c.push(a * ppm);
            a += 0.42 + r() * 0.45;
        }
        return c;
    });
    const cracks = readableCanvas(S, S);
    const cc = cracks.getContext("2d")!;
    cc.fillStyle = "#000";
    cc.fillRect(0, 0, S, S);
    cc.strokeStyle = "#fff";
    cc.lineCap = "round";
    for (let k = 0; k < 5; k++) {
        let x = r() * S;
        let y = r() * S;
        let a = r() * Math.PI * 2;
        cc.lineWidth = 0.8 + r() * 0.7;
        cc.beginPath();
        cc.moveTo(x, y);
        for (let i = 0; i < 14; i++) {
            a += (r() - 0.5) * 1.1;
            x += Math.cos(a) * 7;
            y += Math.sin(a) * 7;
            cc.lineTo(x, y);
        }
        cc.stroke();
    }
    const ck = cracks.getContext("2d")!.getImageData(0, 0, S, S).data;
    const mott = tileFbm(412, 6, 4);
    yield;
    const wear = tileFbm(413, 3, 3);
    yield;
    const damp = tileFbm(414, 4, 4);
    yield;
    const erode = tileFbm(415, 24, 2);
    yield;
    const fine = periodic(416, 256, 256);
    yield;
    const out = new Surface(S, S);
    for (let y = 0; y < S; y++) {
        let row = 0;
        while (row < rowsM.length - 1 && y >= rowEdges[row + 1]) row++;
        const y0 = rowEdges[row];
        const y1 = rowEdges[row + 1];
        const v = y / S;
        const c = cuts[row];
        for (let x = 0; x < S; x++) {
            const u = x / S;
            let id = 0;
            let cd = S;
            for (let k = 0; k < c.length; k++) {
                if (c[k] <= x) id = k + 1;
                const dd = Math.abs(x - c[k]);
                cd = Math.min(cd, dd, S - dd);
            }
            id %= Math.max(1, c.length);
            const dEdge = Math.min(cd, y - y0, y1 - y);
            const e = erode(u, v);
            const joint = 1.6 + e * 2.2;
            const hs = hash2(row * 17 + id, 5, 9);
            const hs2 = hash2(row * 17 + id, 7, 11);
            const m = mott(u, v);
            const grain = hash2(x, y, 13);
            const f = fine(u * 256, v * 256) * 0.7 + hash2(x, y, 17) * 0.3;
            const wet = smooth(0.6, 0.7, damp(u, v));
            let R: number;
            let G: number;
            let B: number;
            let rough: number;
            let height: number;
            if (dEdge < joint) {
                const k = 0.8 + 0.4 * m;
                R = 34 * k;
                G = 28 * k;
                B = 22 * k;
                rough = 0.95;
                height = 0.15 + 0.05 * grain;
            } else {
                const tone = (0.78 + 0.38 * hs) * (0.84 + 0.3 * m) * (0.95 + 0.1 * f);
                const warm = hs2 - 0.5;
                R = (86 + warm * 14) * tone;
                G = (78 + warm * 6) * tone;
                B = (68 - warm * 6) * tone;
                const wr = smooth(0.55, 0.8, wear(u, v));
                R = mix(R, R * 1.15, wr);
                G = mix(G, G * 1.15, wr);
                B = mix(B, B * 1.12, wr);
                rough = 0.82 - wr * 0.18 + 0.06 * grain;
                const bevel = smooth(joint, joint + 3, dEdge);
                const tilt = (hs - 0.5) * ((x - (c[0] ?? 0)) / S) * 0.1 + (hs2 - 0.5) * ((y - y0) / (y1 - y0)) * 0.08;
                height = 0.45 + 0.25 * bevel + tilt + 0.04 * (m - 0.5) + 0.03 * f;
                const p = smooth(0.8, 0.9, f);
                height -= p * 0.05;
                const cr = ck[(y * S + x) * 4] / 255;
                if (cr > 0) {
                    R *= 1 - cr * 0.7;
                    G *= 1 - cr * 0.7;
                    B *= 1 - cr * 0.7;
                    height -= cr * 0.2;
                }
            }
            // damp: darker, and it shines
            R *= 1 - wet * 0.32;
            G *= 1 - wet * 0.3;
            B *= 1 - wet * 0.26;
            rough = mix(rough, 0.22, wet * 0.85);
            out.set(y * S + x, R, G, B, clamp01(rough), height);
        }
        yield;
    }
    return (yield out.mapsWork(0.01 * ppm, true)) as Maps;
}

/* ------------------------------------------------------------ limestone */

// The shrine's stone everywhere but its inscribed face: a metre square of
// pale, pitted limestone, the faint diagonal marks of a claw chisel.
function* limestone(): Work<Maps> {
    const S = 512;
    const mott = tileFbm(501, 7, 4);
    yield;
    const broad = tileFbm(502, 2, 3);
    yield;
    const streak = tileFbm(503, 32, 2, 2);
    yield;
    const lich = tileFbm(504, 10, 4);
    yield;
    const pits = periodic(505, 200, 200);
    yield;
    const out = new Surface(S, S);
    for (let y = 0; y < S; y++) {
        const v = y / S;
        for (let x = 0; x < S; x++) {
            const u = x / S;
            const m = mott(u, v);
            const b = broad(u, v);
            const grain = hash2(x, y, 21);
            const tone = 0.86 + 0.3 * (m - 0.5) + 0.3 * (b - 0.5) + 0.06 * (grain - 0.5);
            let R = 160 * tone;
            let G = 149 * tone;
            let B = 129 * tone;
            const st = smooth(0.55, 0.8, streak(u, v)) * 0.28;
            R *= 1 - st;
            G *= 1 - st;
            B *= 1 - st * 0.9;
            const lk = smooth(0.66, 0.74, lich(u, v));
            R = mix(R, 118, lk * 0.7);
            G = mix(G, 122, lk * 0.7);
            B = mix(B, 92, lk * 0.7);
            const p = smooth(0.76, 0.88, pits(u * 200, v * 200));
            R *= 1 - p * 0.3;
            G *= 1 - p * 0.3;
            B *= 1 - p * 0.3;
            const claw = Math.sin((u + v) * Math.PI * 2 * 60 + m * 8) * 0.5 + 0.5;
            const height = 0.5 + 0.06 * (m - 0.5) + 0.03 * grain - p * 0.1 + claw * 0.025 * smooth(0.4, 0.6, b);
            out.set(y * S + x, R, G, B, clamp01(0.86 + 0.08 * grain), height);
        }
        yield;
    }
    return (yield out.mapsWork(0.008 * S, true)) as Maps;
}

/* ----------------------------------------------------------------- rust */

// Rusted iron, 0.3 m square: dark scale, orange blooms, pitting and flakes.
function* rust(): Work<Maps> {
    const S = 256;
    const ppm = S / 0.3;
    const a = tileFbm(601, 5, 4);
    yield;
    const b = tileFbm(602, 12, 3);
    yield;
    const pits = periodic(603, 96, 96);
    yield;
    const out = new Surface(S, S);
    for (let y = 0; y < S; y++) {
        const v = y / S;
        for (let x = 0; x < S; x++) {
            const u = x / S;
            const n = a(u, v);
            const n2 = b(u, v);
            const grain = hash2(x, y, 41);
            const r1 = smooth(0.42, 0.62, n + (n2 - 0.5) * 0.3);
            const r2 = smooth(0.6, 0.72, n2);
            let R = mix(46, 116, r1);
            let G = mix(41, 58, r1);
            let B = mix(38, 30, r1);
            R = mix(R, 150, r2 * 0.5);
            G = mix(G, 78, r2 * 0.5);
            B = mix(B, 36, r2 * 0.5);
            const k = 0.86 + 0.28 * grain;
            const p = smooth(0.74, 0.86, pits(u * 96, v * 96));
            out.set(y * S + x, R * k * (1 - p * 0.4), G * k * (1 - p * 0.4), B * k * (1 - p * 0.4), clamp01(0.68 + r1 * 0.25 + grain * 0.05), 0.5 + r1 * 0.12 + r2 * 0.08 - p * 0.15 + grain * 0.04);
        }
        yield;
    }
    return (yield out.mapsWork(0.004 * ppm, true)) as Maps;
}

/* ----------------------------------------------------------------- wood */

// Dark old wood for the chair: half a metre, grain running along v.
function* wood(): Work<Maps> {
    const S = 256;
    const warp = tileFbm(701, 2, 3, 4);
    yield;
    const broad = tileFbm(702, 12, 2, 1);
    yield;
    const crack = tileFbm(703, 40, 1, 2);
    yield;
    const out = new Surface(S, S);
    for (let y = 0; y < S; y++) {
        const v = y / S;
        for (let x = 0; x < S; x++) {
            const u = x / S;
            const ring = 0.5 + 0.5 * Math.sin((u * 26 + warp(u, v) * 1.6) * Math.PI * 2);
            const line = Math.pow(ring, 10);
            const b = broad(u, v);
            const c = smooth(0.8, 0.86, crack(u, v));
            const grain = hash2(x, y, 51);
            const tone = (0.78 + 0.34 * b - 0.2 * line + 0.06 * grain) * (1 - c * 0.6);
            out.set(y * S + x, 56 * tone, 38 * tone, 27 * tone, clamp01(0.74 + 0.1 * line + c * 0.15), 0.5 - line * 0.15 - c * 0.3 + grain * 0.03);
        }
        yield;
    }
    return (yield out.mapsWork(3, true)) as Maps;
}

/* ---------------------------------------------------------------- cloth */

// The dust sheet: grey linen, a loose weave, stains and dust settled on it.
function* cloth(): Work<Maps> {
    const S = 256;
    const stain = tileFbm(801, 3, 4);
    yield;
    const dust = tileFbm(802, 6, 3);
    yield;
    const out = new Surface(S, S);
    for (let y = 0; y < S; y++) {
        const v = y / S;
        for (let x = 0; x < S; x++) {
            const u = x / S;
            const weave = (Math.sin(x * 1.6) * 0.5 + 0.5) * (Math.sin(y * 1.6 + 1) * 0.5 + 0.5);
            const grain = hash2(x, y, 61);
            const s = smooth(0.58, 0.72, stain(u, v));
            const d = smooth(0.45, 0.75, dust(u, v));
            const tone = 0.88 + 0.1 * weave + 0.06 * (grain - 0.5);
            const R = mix(mix(132, 98, s), 150, d * 0.35) * tone;
            const G = mix(mix(124, 86, s), 142, d * 0.35) * tone;
            const B = mix(mix(110, 70, s), 128, d * 0.35) * tone;
            out.set(y * S + x, R, G, B, 0.97, 0.5 + weave * 0.12 + grain * 0.04);
        }
        yield;
    }
    return (yield out.mapsWork(2.5, true)) as Maps;
}

/* -------------------------------------------------------------- cobweb */

// A web strung across a corner: anchored at the top-left of the texture, its
// spokes fanning down and across, the spiral sagging between them, torn in
// places, furred with dust. White on black, used as an alpha map.
function* web(): Work<THREE.Texture> {
    const S = 512;
    const c = makeCanvas(S, S);
    const ctx = c.getContext("2d")!;
    const r = rng(901);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    ctx.lineCap = "round";
    const spokes: number[] = [];
    for (let a = 0.05; a < Math.PI / 2 - 0.04; a += 0.16 + r() * 0.14) spokes.push(a);
    const len = (a: number) => S * (0.82 + 0.25 * Math.sin(a * 2)) * (0.85 + r() * 0.2);
    const ends = spokes.map((a) => len(a));
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    spokes.forEach((a, i) => {
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * ends[i], Math.sin(a) * ends[i]);
        ctx.stroke();
    });
    // the spiral: sagging catenaries between neighbouring spokes
    for (let d = 30; d < S * 0.95; d += 16 + r() * 14) {
        for (let i = 0; i < spokes.length - 1; i++) {
            if (d > ends[i] * 0.96 || d > ends[i + 1] * 0.96 || r() < 0.12) continue;
            const a0 = spokes[i];
            const a1 = spokes[i + 1];
            const x0 = Math.cos(a0) * d;
            const y0 = Math.sin(a0) * d;
            const x1 = Math.cos(a1) * (d + (r() - 0.5) * 4);
            const y1 = Math.sin(a1) * (d + (r() - 0.5) * 4);
            const sag = 3 + d * 0.025;
            ctx.lineWidth = 0.5 + r() * 0.5;
            ctx.globalAlpha = 0.25 + r() * 0.45;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo((x0 + x1) / 2 + sag * 0.3, (y0 + y1) / 2 + sag, x1, y1);
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1;
    // torn strands hanging loose
    for (let k = 0; k < 6; k++) {
        const a = r() * Math.PI * 0.5;
        const d = S * (0.3 + r() * 0.5);
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 6, y + 30, x - 8, y + 60, x + (r() - 0.5) * 20, y + 80 + r() * 60);
        ctx.stroke();
    }
    yield;
    // dust caught in it
    for (let k = 0; k < 500; k++) {
        const a = r() * Math.PI * 0.5;
        const d = Math.sqrt(r()) * S * 0.9;
        ctx.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.35})`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 0.6 + r() * r() * 3, 0, Math.PI * 2);
        ctx.fill();
    }
    // a soft film of dust near the corner, where it's thickest
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.45);
    g.addColorStop(0, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // ragged where it has torn away
    ctx.fillStyle = "#000";
    for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(r() * S, r() * S, 30 + r() * 70, 0, Math.PI * 2);
        ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
}

/** A soft round glow, white at the centre to nothing at the rim (alpha map). */
function* glow(): Work<THREE.Texture> {
    const S = 128;
    const c = makeCanvas(S, S);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgb(255,255,255)");
    g.addColorStop(0.15, "rgb(120,120,120)");
    g.addColorStop(0.45, "rgb(28,28,28)");
    g.addColorStop(1, "rgb(0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
}

export const chamberTextures = {
    brick: once(brick),
    flags: once(flags),
    limestone: once(limestone),
    rust: once(rust),
    wood: once(wood),
    cloth: once(cloth),
    web: once(web),
    glow: once(glow),
};

/** Paint every shared surface of the rooms a slice at a time (while the page is idle): then they're there at once. */
export const prepareChamberTextures = () => Promise.all(Object.values(chamberTextures).map((t) => t.built.prepare()));
