"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RoomObject } from "@/data/v2/theatre";
import { flicker, rng } from "@/components/v2/theatre3d/textures";
import { ALTAR, STEP } from "@/components/v2/theatre3d/chamber-layout";
import { chamberTextures } from "@/components/v2/theatre3d/chamber-textures";
import { hash2, makeCanvas, smooth } from "@/components/v2/theatre3d/chamber-pixels";
import type { Flame } from "@/components/v2/theatre3d/chamber-fx";

// Things left by the shrine, each from its scene in Steppenwolf, put down as
// if a moment ago: the tamer's whip, the chess player's pieces, the rifle from
// the hunt on the motor-cars, a quarter in the slot, the pocket knife, and
// Mozart's wireless. They sit on the altar's ledge below the inscription, on
// the step or on the floor, never in front of the words.

type Quality = "high" | "low";
const LEDGE = ALTAR.h;
const FRONT = ALTAR.z + ALTAR.d / 2;
const STEP_H = STEP.h;

/* ------------------------------------------------------------- helpers */

/** Merge parts into one geometry (position, normal, uv), freeing the parts. */
function merge(parts: THREE.BufferGeometry[]) {
    const flat = parts.map((p) => {
        const g = p.index ? p.toNonIndexed() : p.clone();
        for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.normal) g.computeVertexNormals();
        g.clearGroups();
        return g;
    });
    const out = mergeGeometries(flat)!;
    parts.forEach((p) => p.dispose());
    flat.forEach((p) => p.dispose());
    return out;
}

const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
/** Rotate (x, then y, then z... in Euler XYZ order), then move. */
function put(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, order: THREE.EulerOrder = "XYZ") {
    quat.setFromEuler(euler.set(rx, ry, rz, order));
    return g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(1, 1, 1)));
}

const lathe = (pts: [number, number][], seg: number) =>
    new THREE.LatheGeometry(
        pts.map(([r, y]) => new THREE.Vector2(r, y)),
        seg,
    );

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
    const c = makeCanvas(w, h);
    draw(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
}

/* ------------------------------------------------------------ textures */

/** Plaited leather: two sets of strands crossing on the diagonal. */
function braidTexture() {
    return canvasTex(
        64,
        64,
        (ctx) => {
            ctx.fillStyle = "rgb(38,24,16)";
            ctx.fillRect(0, 0, 64, 64);
            for (let k = -2; k < 6; k++) {
                for (const dir of [1, -1]) {
                    const g = ctx.createLinearGradient(0, 0, 10, 10);
                    g.addColorStop(0, "rgb(70,46,30)");
                    g.addColorStop(0.5, "rgb(104,72,48)");
                    g.addColorStop(1, "rgb(62,40,26)");
                    ctx.strokeStyle = g;
                    ctx.lineWidth = 6;
                    ctx.beginPath();
                    for (let x = -8; x <= 72; x += 16) {
                        const y0 = k * 16 + (dir > 0 ? x : 64 - x);
                        if (x === -8) ctx.moveTo(x, y0);
                        else ctx.lineTo(x, y0);
                    }
                    ctx.stroke();
                }
            }
        },
        [1, 1],
    );
}

/** An old chessboard: boxwood and walnut squares, a walnut border, worn pale in the middle, scratched. */
function boardTexture() {
    return canvasTex(256, 256, (ctx) => {
        const r = rng(611);
        ctx.fillStyle = "rgb(52,34,24)";
        ctx.fillRect(0, 0, 256, 256);
        const b = 12;
        const s = (256 - 2 * b) / 8;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const light = (i + j) % 2 === 0;
                const k = 0.85 + r() * 0.25;
                ctx.fillStyle = light ? `rgb(${168 * k},${134 * k},${88 * k})` : `rgb(${70 * k},${44 * k},${28 * k})`;
                ctx.fillRect(b + i * s, b + j * s, s, s);
                // grain
                ctx.strokeStyle = light ? "rgba(120,86,50,0.35)" : "rgba(30,18,10,0.4)";
                ctx.lineWidth = 0.6;
                for (let g = 0; g < 5; g++) {
                    const yy = b + j * s + r() * s;
                    ctx.beginPath();
                    ctx.moveTo(b + i * s, yy);
                    ctx.lineTo(b + (i + 1) * s, yy + (r() - 0.5) * 3);
                    ctx.stroke();
                }
            }
        }
        // worn pale where hands have moved the pieces for years
        const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 130);
        g.addColorStop(0, "rgba(220,200,160,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0.22)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = "rgba(230,210,170,0.25)";
        for (let k = 0; k < 40; k++) {
            ctx.lineWidth = 0.4 + r() * 0.6;
            const x = r() * 256;
            const y = r() * 256;
            const a = r() * Math.PI;
            const l = 6 + r() * 30;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(20,12,8,0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(b - 1, b - 1, 256 - 2 * b + 2, 256 - 2 * b + 2);
    });
}

/** A worn silver coin: a raised rim, a rubbed-down head, tarnish in the hollows. */
function coinTexture() {
    return canvasTex(64, 64, (ctx) => {
        const img = ctx.createImageData(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) {
                const d = Math.hypot(x - 32, y - 32) / 32;
                const rim = smooth(0.82, 0.9, d) * (1 - smooth(0.96, 1, d));
                const head = Math.exp(-(((x - 30) / 9) ** 2) - (((y - 28) / 12) ** 2)) * 0.5;
                const n = hash2(x, y, 3);
                const v = 120 + rim * 70 + head * 50 + n * 30 - (1 - rim) * 20;
                const i = (y * 64 + x) * 4;
                img.data[i] = v;
                img.data[i + 1] = v * 0.97;
                img.data[i + 2] = v * 0.9;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    });
}

/** The loudspeaker: a wooden fretwork sunburst over gold-brown cloth. */
function grilleTexture() {
    return canvasTex(256, 256, (ctx) => {
        const r = rng(721);
        ctx.fillStyle = "rgb(112,88,58)";
        ctx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 2) {
            ctx.fillStyle = `rgba(60,44,28,${0.25 + r() * 0.2})`;
            ctx.fillRect(0, y, 256, 1);
        }
        for (let x = 0; x < 256; x += 2) {
            ctx.fillStyle = `rgba(150,120,80,${0.1 + r() * 0.1})`;
            ctx.fillRect(x, 0, 1, 256);
        }
        // faded, stained
        const g = ctx.createRadialGradient(110, 100, 10, 128, 128, 140);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(30,20,12,0.55)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        // the fretwork
        ctx.fillStyle = "rgb(46,30,20)";
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.arc(128, 128, 112, 0, Math.PI * 2, true);
        ctx.fill();
        for (let k = 0; k < 12; k++) {
            ctx.save();
            ctx.translate(128, 128);
            ctx.rotate((k / 12) * Math.PI * 2);
            ctx.fillRect(-5, 20, 10, 100);
            ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(128, 128, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(120,86,56,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(128, 128, 22, 0, Math.PI * 2);
        ctx.stroke();
    });
}

/** The tuning dial: yellowed celluloid with a scale from 0 to 100 and a needle. */
function dialTexture() {
    return canvasTex(128, 128, (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, "rgb(236,208,150)");
        g.addColorStop(1, "rgb(176,140,84)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = "rgb(60,40,24)";
        ctx.fillStyle = "rgb(60,40,24)";
        ctx.font = "bold 11px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let k = 0; k <= 50; k++) {
            const a = Math.PI * 0.8 + (k / 50) * Math.PI * 1.4;
            const long = k % 5 === 0;
            ctx.lineWidth = long ? 1.6 : 0.8;
            ctx.beginPath();
            ctx.moveTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54);
            ctx.lineTo(64 + Math.cos(a) * (long ? 44 : 48), 64 + Math.sin(a) * (long ? 44 : 48));
            ctx.stroke();
            if (k % 10 === 0) ctx.fillText(String(k * 2), 64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34);
        }
        // the needle, left where the music was
        ctx.strokeStyle = "rgb(30,18,10)";
        ctx.lineWidth = 2;
        const a = Math.PI * 0.8 + 0.62 * Math.PI * 1.4;
        ctx.beginPath();
        ctx.moveTo(64, 64);
        ctx.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(64, 64, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

/* ----------------------------------------------------------- materials */

let mats: ReturnType<typeof makeMaterials> | null = null;

function makeMaterials() {
    const t = chamberTextures;
    const braid = braidTexture();
    const lashBraid = braid.clone();
    lashBraid.repeat.set(110, 2);
    lashBraid.needsUpdate = true;
    const handleBraid = braid.clone();
    handleBraid.repeat.set(3, 16);
    handleBraid.needsUpdate = true;
    const board = boardTexture();
    const dial = dialTexture();
    return {
        textures: [braid, lashBraid, handleBraid, board, dial],
        lash: new THREE.MeshStandardMaterial({ map: lashBraid, color: "#a58a74", roughness: 0.58 }),
        handle: new THREE.MeshStandardMaterial({ map: handleBraid, color: "#a58a74", roughness: 0.5 }),
        wood: new THREE.MeshStandardMaterial({ ...t.wood(), color: "#a48c78" }),
        walnut: new THREE.MeshStandardMaterial({ ...t.wood(), color: "#6c5646" }),
        // darkened steel: still steel, so the open blade reads against the stone
        steel: new THREE.MeshStandardMaterial({ color: "#56504a", metalness: 0.55, roughness: 0.34 }),
        gunmetal: new THREE.MeshStandardMaterial({ color: "#2c2a28", metalness: 0.55, roughness: 0.48 }),
        brass: new THREE.MeshStandardMaterial({ color: "#b08a46", metalness: 0.45, roughness: 0.36 }),
        silver: new THREE.MeshStandardMaterial({ map: coinTexture(), color: "#c2bcb0", metalness: 0.4, roughness: 0.4 }),
        ivory: new THREE.MeshStandardMaterial({ color: "#cbb690", roughness: 0.42 }),
        ebony: new THREE.MeshStandardMaterial({ color: "#1b140f", roughness: 0.3 }),
        board: new THREE.MeshStandardMaterial({ map: board, roughness: 0.5 }),
        bakelite: new THREE.MeshStandardMaterial({ color: "#1d1712", roughness: 0.32 }),
        grille: new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.92 }),
        dial: new THREE.MeshStandardMaterial({ map: dial, emissive: "#ffb05a", emissiveMap: dial, emissiveIntensity: 0, roughness: 0.3 }),
        black: new THREE.MeshStandardMaterial({ color: "#0a0807", roughness: 0.85 }),
    };
}
const materials = () => (mats ??= makeMaterials());

/* --------------------------------------------------------------- whip */

/**
 * The tamer's whip on the floor in front of the step: the handle, plaited
 * leather over a stock with a knob at its butt; the lash laid in loose coils
 * from it, its end crossing back over the coils and trailing off across the
 * flagstones, thinning to the fall.
 */
function whip(q: Quality) {
    const r = rng(301);
    const cx = 0.12;
    const cz = 0.86;
    const R0 = 0.0095;
    const pts: THREE.Vector3[] = [];
    const turns = 2.2;
    const NC = 40;
    // from the handle (outside the coil) inward
    for (let i = 0; i <= NC; i++) {
        const f = i / NC;
        const a = -0.4 + f * turns * Math.PI * 2;
        const rad = 0.175 - 0.026 * f * turns + 0.004 * Math.sin(a * 2.3) + (r() - 0.5) * 0.003;
        pts.push(new THREE.Vector3(cx + Math.cos(a) * rad, 0, cz + Math.sin(a) * rad * 0.82));
    }
    const coilEnd = pts.length - 1;
    // out over the coils, then away across the floor
    const inner = pts[coilEnd].clone();
    const out = new THREE.Vector3(-1, 0, 0.12).normalize();
    for (let i = 1; i <= 5; i++) pts.push(inner.clone().addScaledVector(out, i * 0.05));
    const exit = pts[pts.length - 1].clone();
    for (let i = 1; i <= 12; i++) {
        const f = i / 12;
        pts.push(new THREE.Vector3(exit.x - f * 0.85, 0, exit.z + f * 0.05 + Math.sin(f * Math.PI * 2.1) * 0.06));
    }
    const n = pts.length - 1;
    const taper = (t: number) => 1 - 0.72 * smooth(0.38, 1, t);
    pts.forEach((p, i) => {
        const t = i / n;
        // the crossing rests on top of the coils beneath it
        const over = i > coilEnd && i <= coilEnd + 4 ? 0.017 : i === coilEnd + 5 ? 0.008 : 0;
        p.y = R0 * taper(t) + over;
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
    const seg = q === "high" ? 300 : 160;
    const radial = q === "high" ? 7 : 5;
    const lash = new THREE.TubeGeometry(curve, seg, R0, radial, false);
    const pos = lash.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        curve.getPointAt(t, c);
        const k = taper(t) * (t > 0.95 ? 1 - (t - 0.95) * 8 : 1);
        for (let j = 0; j <= radial; j++) {
            const idx = i * (radial + 1) + j;
            v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
            pos.setXYZ(idx, v.x, v.y, v.z);
        }
    }
    lash.computeVertexNormals();

    // the handle: from where the lash begins, out and away from the coil
    const start = pts[0];
    const dir = start.clone().sub(pts[1]).setY(0).normalize();
    const handle = lathe(
        [
            [0.0001, 0],
            [0.015, 0.002],
            [0.021, 0.014],
            [0.02, 0.03],
            [0.0155, 0.04],
            [0.0158, 0.17],
            [0.0132, 0.3],
            [0.0112, 0.4],
            [0.0001, 0.405],
        ],
        q === "high" ? 12 : 8,
    );
    // lay it along `dir`, its tip at the lash, its knob resting on the floor
    const along = dir.clone().negate();
    const butt = start.clone().addScaledVector(dir, 0.4);
    handle.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(butt.x, 0.02, butt.z), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.setY(-0.012).normalize()), new THREE.Vector3(1, 1, 1)));
    return { lash, handle };
}

/* -------------------------------------------------------------- chess */

const BASE: [number, number][] = [
    [0.0001, 0],
    [0.0125, 0],
    [0.0128, 0.003],
    [0.0114, 0.0055],
    [0.0094, 0.0072],
];
const PIECES: Record<string, [number, number][]> = {
    pawn: [...BASE, [0.006, 0.012], [0.0045, 0.018], [0.0075, 0.02], [0.0045, 0.022], [0.0058, 0.025], [0.0065, 0.029], [0.0055, 0.033], [0.003, 0.0355], [0.0001, 0.036]],
    rook: [...BASE, [0.0075, 0.012], [0.0071, 0.03], [0.0096, 0.034], [0.0096, 0.041], [0.0072, 0.041], [0.0072, 0.038], [0.0001, 0.038]],
    bishop: [...BASE, [0.0055, 0.014], [0.0042, 0.028], [0.0075, 0.03], [0.0045, 0.032], [0.0065, 0.038], [0.0068, 0.043], [0.0055, 0.048], [0.003, 0.051], [0.0035, 0.0535], [0.002, 0.056], [0.0001, 0.0565]],
    queen: [...BASE, [0.006, 0.015], [0.0045, 0.035], [0.0085, 0.037], [0.005, 0.039], [0.0086, 0.049], [0.0076, 0.052], [0.004, 0.053], [0.0036, 0.0565], [0.0001, 0.0585]],
    king: [...BASE, [0.0062, 0.016], [0.0047, 0.038], [0.009, 0.04], [0.0052, 0.042], [0.008, 0.052], [0.006, 0.055], [0.0001, 0.056]],
    knight: [...BASE, [0.0085, 0.012], [0.0001, 0.012]],
};

/** One chess piece, standing at the origin. */
function piece(kind: string, seg: number) {
    const parts: THREE.BufferGeometry[] = [lathe(PIECES[kind], seg)];
    if (kind === "king") {
        parts.push(new THREE.BoxGeometry(0.0026, 0.013, 0.0026).translate(0, 0.0615, 0), new THREE.BoxGeometry(0.009, 0.0026, 0.0026).translate(0, 0.063, 0));
    }
    if (kind === "knight") {
        const s = new THREE.Shape();
        const p: [number, number][] = [
            [-0.0075, 0.011],
            [0.008, 0.011],
            [0.008, 0.02],
            [0.012, 0.027],
            [0.0165, 0.034],
            [0.0158, 0.039],
            [0.0095, 0.041],
            [0.005, 0.0465],
            [0.0015, 0.0445],
            [-0.003, 0.041],
            [-0.0068, 0.033],
            [-0.0082, 0.022],
        ];
        p.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
        const head = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 4 });
        head.translate(0, 0, -0.0035);
        parts.push(head);
    }
    return merge(parts);
}

/**
 * The chess player's game on the altar: an old board, a few pieces still
 * standing, most knocked over, two rolled off onto the stone and one down on
 * the step.
 */
function chess(q: Quality) {
    const seg = q === "high" ? 16 : 10;
    const r = rng(507);
    // the board, its top textured (BoxGeometry groups: +x, -x, +y, -y, +z, -z)
    const board = new THREE.BoxGeometry(0.26, 0.016, 0.26);
    const bx = -0.29;
    const bz = 0.25;
    const yaw = 0.16;
    put(board, bx, LEDGE + 0.008, bz, 0, yaw, 0);
    const top = LEDGE + 0.016;
    const toWorld = (x: number, z: number) => {
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        return [bx + x * c + z * s, bz - x * s + z * c];
    };
    const light: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    // [kind, light?, x, z on the board (m), standing?, or y if off the board]
    const set: [string, boolean, number, number, boolean, number?][] = [
        ["king", true, -0.045, 0.06, true],
        ["knight", false, 0.015, -0.045, true],
        ["pawn", true, -0.075, 0.015, true],
        ["pawn", false, 0.045, -0.075, true],
        ["rook", true, 0.09, 0.075, true],
        ["queen", false, 0.0, 0.025, false],
        ["bishop", true, -0.06, -0.06, false],
        ["pawn", true, 0.065, 0.02, false],
        ["rook", false, -0.09, -0.02, false],
        ["bishop", false, 0.03, 0.09, false],
        ["pawn", false, -0.02, -0.09, false],
        ["king", false, 0.17, 0.05, false, LEDGE],
        ["pawn", true, -0.17, -0.03, false, LEDGE],
        ["knight", true, 0.06, 0.16, false, LEDGE],
    ];
    for (const [kind, isLight, x, z, standing, y0] of set) {
        const g = piece(kind, seg);
        const [wx, wz] = toWorld(x, z);
        const y = y0 ?? top;
        if (standing) put(g, wx, y, wz, 0, r() * Math.PI * 2, 0);
        else {
            // lying on its side, resting on the rim of its base
            const lie = Math.PI / 2 - 0.1;
            put(g, 0, 0.0125, 0, 0, 0, lie);
            put(g, wx, y, wz, 0, r() * Math.PI * 2, 0);
        }
        (isLight ? light : dark).push(g);
    }
    // one has fallen to the step below
    const fallen = piece("pawn", seg);
    put(fallen, 0, 0.0125, 0, 0, 0, Math.PI / 2 - 0.1);
    put(fallen, -0.36, 0.16, 0.52, 0, 1.1, 0);
    light.push(fallen);
    return { board, light: merge(light), dark: merge(dark) };
}

/* -------------------------------------------------------------- rifle */

/**
 * A bolt-action hunting rifle leaning on the wall beside the shrine, by the
 * left-hand candle stand, and the spent cartridges from it on the floor and
 * the step.
 */
function rifle(q: Quality) {
    const s = new THREE.Shape();
    const stock: [number, number][] = [
        [0, -0.075],
        [0, 0.044],
        [0.03, 0.046],
        [0.29, 0.033],
        [0.37, 0.029],
        [0.4, 0.024],
        [0.74, 0.018],
        [0.775, 0.01],
        [0.77, -0.008],
        [0.43, -0.016],
        [0.385, -0.02],
        [0.35, -0.045],
        [0.315, -0.042],
        [0.3, -0.032],
        [0.16, -0.045],
    ];
    stock.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const wood = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.006, bevelSegments: q === "high" ? 3 : 1, curveSegments: 4 });
    wood.translate(0, 0, -0.015);
    const rs = q === "high" ? 12 : 8;
    const metal: THREE.BufferGeometry[] = [];
    const along = (len: number, r0: number, r1: number, x: number, y: number) => {
        const g = new THREE.CylinderGeometry(r1, r0, len, rs);
        g.rotateZ(-Math.PI / 2);
        g.translate(x + len / 2, y, 0);
        return g;
    };
    metal.push(along(0.68, 0.0095, 0.0078, 0.42, 0.032)); // barrel
    metal.push(along(0.16, 0.0135, 0.0135, 0.34, 0.033)); // receiver
    metal.push(along(0.012, 0.0115, 0.0115, 1.095, 0.032)); // muzzle crown
    const bolt = new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 8);
    bolt.rotateX(Math.PI / 2 - 0.5);
    bolt.translate(0.405, 0.03, 0.024);
    metal.push(bolt);
    metal.push(new THREE.SphereGeometry(0.0085, 10, 8).translate(0.405, 0.018, 0.047));
    const guard = new THREE.TorusGeometry(0.017, 0.0026, 6, 14, Math.PI);
    guard.rotateZ(Math.PI);
    guard.translate(0.4, -0.014, 0);
    metal.push(guard);
    metal.push(new THREE.BoxGeometry(0.003, 0.016, 0.004).translate(0.398, -0.016, 0));
    metal.push(new THREE.BoxGeometry(0.006, 0.01, 0.003).translate(1.09, 0.044, 0)); // front sight
    metal.push(new THREE.BoxGeometry(0.02, 0.008, 0.012).translate(0.62, 0.042, 0)); // rear sight
    metal.push(new THREE.BoxGeometry(0.008, 0.12, 0.034).translate(0.004, -0.015, 0)); // butt plate
    // stand it on its butt, lean it back on the wall, turn it a little toward the room
    const place = (g: THREE.BufferGeometry) => {
        g.rotateZ(Math.PI / 2 + 0.22);
        g.rotateY(-0.12);
        g.translate(-1.47, 0.004, -0.06);
        return g;
    };
    const woodG = place(wood);
    const metalG = place(merge(metal));
    // spent cases: a rim, the body, a shoulder and the open neck
    const caseProfile: [number, number][] = [
        [0.0001, 0],
        [0.0062, 0],
        [0.0062, 0.002],
        [0.0054, 0.0026],
        [0.0058, 0.004],
        [0.0057, 0.042],
        [0.0044, 0.047],
        [0.0034, 0.048],
        [0.0034, 0.057],
        [0.0029, 0.057],
        [0.0029, 0.0485],
        [0.0001, 0.0485],
    ];
    const r = rng(77);
    const cases: THREE.BufferGeometry[] = [];
    for (const [x, y, z] of [
        [-1.3, 0, 0.22],
        [-1.18, 0, 0.66],
        [-0.62, STEP_H, 0.52],
        [-0.9, 0, 0.8],
    ]) {
        const g = lathe(caseProfile, q === "high" ? 12 : 8);
        g.rotateZ(Math.PI / 2 + 0.03);
        g.rotateY(r() * Math.PI * 2);
        g.translate(x, y + 0.006, z);
        cases.push(g);
    }
    return { wood: woodG, metal: metalG, brass: merge(cases) };
}

/* --------------------------------------------------------------- coin */

/**
 * A brass coin slot let into the altar's top at its front edge, a coin the
 * size of a quarter standing in it, two more on the stone.
 */
function coin(q: Quality) {
    const x = -0.19;
    const z = FRONT - 0.032;
    const plate = new RoundedBoxGeometry(0.084, 0.006, 0.05, 2, 0.002);
    plate.translate(x, LEDGE + 0.002, z);
    const screws = [-1, 1].map((s) => new THREE.CylinderGeometry(0.0034, 0.0034, 0.0016, 10).translate(x + s * 0.033, LEDGE + 0.0055, z));
    const slot = new THREE.BoxGeometry(0.03, 0.002, 0.0034).translate(x, LEDGE + 0.0052, z);
    const seg = q === "high" ? 32 : 18;
    const standing = new THREE.CylinderGeometry(0.012, 0.012, 0.0018, seg);
    standing.rotateX(Math.PI / 2);
    standing.translate(x, LEDGE + 0.005 + 0.012 - 0.0075, z);
    const loose1 = new THREE.CylinderGeometry(0.012, 0.012, 0.0018, seg).translate(-0.1, LEDGE + 0.0009, 0.335);
    const loose2 = new THREE.CylinderGeometry(0.012, 0.012, 0.0018, seg);
    loose2.rotateX(0.12);
    loose2.translate(-0.262, LEDGE + 0.0024, 0.352);
    return { brass: merge([plate, ...screws]), slot: merge([slot]), coins: merge([standing, loose1, loose2]) };
}

/* -------------------------------------------------------------- knife */

/** A plain folding pocket knife lying open on the altar, its blade dark. */
function knife(q: Quality) {
    const handleShape = new THREE.Shape();
    handleShape.moveTo(0.004, -0.0085);
    handleShape.lineTo(0.09, -0.0075);
    handleShape.quadraticCurveTo(0.097, 0, 0.09, 0.0075);
    handleShape.lineTo(0.004, 0.0092);
    handleShape.quadraticCurveTo(-0.004, 0, 0.004, -0.0085);
    const bevel = { bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: q === "high" ? 2 : 1, curveSegments: q === "high" ? 8 : 4 };
    const handle = new THREE.ExtrudeGeometry(handleShape, { depth: 0.0075, ...bevel });
    handle.translate(0, 0, -0.00375);
    const brass = merge([
        new THREE.BoxGeometry(0.011, 0.0175, 0.0112).translate(0.0075, 0, 0),
        new THREE.BoxGeometry(0.011, 0.0165, 0.0112).translate(0.086, 0, 0),
        new THREE.CylinderGeometry(0.0022, 0.0022, 0.0125, 8).rotateX(Math.PI / 2).translate(0.045, 0, 0),
    ]);
    const blade = new THREE.Shape();
    blade.moveTo(0.088, -0.003);
    blade.lineTo(0.092, 0.0066);
    blade.lineTo(0.145, 0.0068);
    blade.quadraticCurveTo(0.162, 0.0062, 0.172, 0.0028);
    blade.quadraticCurveTo(0.158, -0.006, 0.128, -0.0074);
    blade.lineTo(0.096, -0.0074);
    blade.closePath();
    const steel = new THREE.ExtrudeGeometry(blade, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0006, bevelSegments: 1, curveSegments: 6 });
    steel.translate(0, 0, -0.0006);
    // lying flat on the stone: its width across, its thickness up
    const lay = (g: THREE.BufferGeometry, lift: number) => {
        g.rotateX(-Math.PI / 2);
        g.rotateY(0.28);
        g.translate(0.27, LEDGE + lift, 0.262);
        return g;
    };
    // clear of the stone's bumps: the handle on its back, the blade just above
    return { wood: lay(handle, 0.0082), brass: lay(brass, 0.0082), steel: lay(steel, 0.0052) };
}

/* ------------------------------------------------------------ wireless */

/**
 * A 1920s wireless set on the floor to the right of the shrine, by the candles
 * there: a wooden cabinet, a cloth
 * loudspeaker behind fretwork, black knobs, and its tuning dial still faintly
 * lit, as if it had just been switched off and hadn't quite gone out.
 */
function wireless(q: Quality) {
    const W = 0.46;
    const H = 0.28;
    const D = 0.23;
    const seg = q === "high" ? 3 : 2;
    const wood = merge([
        new RoundedBoxGeometry(W, H, D, seg, 0.008).translate(0, 0.022 + H / 2, 0),
        new RoundedBoxGeometry(W + 0.022, 0.018, D + 0.02, seg, 0.004).translate(0, 0.022 + H + 0.009, 0),
        ...[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ].map(([sx, sz]) => new THREE.BoxGeometry(0.03, 0.022, 0.03).translate((sx * (W - 0.05)) / 2, 0.011, (sz * (D - 0.05)) / 2)),
    ]);
    const panel = new THREE.PlaneGeometry(W - 0.04, H - 0.04).translate(0, 0.022 + H / 2, D / 2 + 0.0015);
    const grille = new THREE.CircleGeometry(0.078, q === "high" ? 40 : 24).translate(-0.1, 0.022 + H / 2 + 0.012, D / 2 + 0.003);
    const dial = new THREE.CircleGeometry(0.034, q === "high" ? 40 : 24).translate(0.105, 0.022 + H / 2 + 0.03, D / 2 + 0.003);
    const bezel = new THREE.TorusGeometry(0.036, 0.0035, 6, q === "high" ? 32 : 18).translate(0.105, 0.022 + H / 2 + 0.03, D / 2 + 0.004);
    const knobs = merge(
        [0.06, 0.105, 0.15].map((x) => {
            const k = lathe(
                [
                    [0.0001, 0],
                    [0.013, 0],
                    [0.0135, 0.004],
                    [0.012, 0.014],
                    [0.008, 0.017],
                    [0.0001, 0.018],
                ],
                q === "high" ? 14 : 8,
            );
            k.rotateX(Math.PI / 2);
            return k.translate(x, 0.022 + H / 2 - 0.055, D / 2 + 0.0015);
        }),
    );
    const place = (g: THREE.BufferGeometry) => g.rotateY(-0.6).translate(1.43, 0, 0.64);
    return { wood: place(wood), panel: place(panel), grille: place(grille), dial: place(dial), brass: place(bezel), knobs: place(knobs) };
}

/* --------------------------------------------------------- the component */

const built = new Map<string, Record<string, THREE.BufferGeometry>>();
const BUILDERS: Record<RoomObject, (q: Quality) => Record<string, THREE.BufferGeometry>> = { whip, chess, rifle, coin, knife, wireless };

function geometryOf(o: RoomObject, q: Quality) {
    const key = `${o}|${q}`;
    let g = built.get(key);
    if (!g) {
        g = BUILDERS[o](q);
        built.set(key, g);
    }
    return g;
}

/** Free the objects' geometry, materials and textures. */
export function disposeChamberObjects() {
    built.forEach((g) => Object.values(g).forEach((x) => x.dispose()));
    built.clear();
    if (mats) {
        Object.values(mats).forEach((m) => (m instanceof THREE.Material ? m.dispose() : null));
        mats.textures.forEach((t) => t.dispose());
        mats.silver.map?.dispose();
        mats.grille.map?.dispose();
        mats = null;
    }
}

export const isRoomObject = (o: string): o is RoomObject => o in BUILDERS;

export function ChamberObjects({ objects, quality, flame }: { objects: RoomObject[]; quality: Quality; flame: Flame }) {
    const m = materials();
    const list = useMemo(() => Array.from(new Set(objects.filter(isRoomObject))), [objects]);
    useFrame(({ clock }) => {
        // the wireless's dial, glowing faintly, trembling a little as old valves do
        if (list.includes("wireless")) m.dial.emissiveIntensity = 0.55 * flame.power * (0.9 + 0.1 * flicker(clock.elapsedTime * 0.7, 9));
    });
    return (
        <group>
            {list.map((o) => {
                const g = geometryOf(o, quality);
                switch (o) {
                    case "whip":
                        return (
                            <group key={o}>
                                <mesh geometry={g.lash} material={m.lash} />
                                <mesh geometry={g.handle} material={m.handle} />
                            </group>
                        );
                    case "chess":
                        return (
                            <group key={o}>
                                <mesh geometry={g.board} material={[m.walnut, m.walnut, m.board, m.walnut, m.walnut, m.walnut]} />
                                <mesh geometry={g.light} material={m.ivory} />
                                <mesh geometry={g.dark} material={m.ebony} />
                            </group>
                        );
                    case "rifle":
                        return (
                            <group key={o}>
                                <mesh geometry={g.wood} material={m.wood} />
                                <mesh geometry={g.metal} material={m.gunmetal} />
                                <mesh geometry={g.brass} material={m.brass} />
                            </group>
                        );
                    case "coin":
                        return (
                            <group key={o}>
                                <mesh geometry={g.brass} material={m.brass} />
                                <mesh geometry={g.slot} material={m.black} />
                                <mesh geometry={g.coins} material={m.silver} />
                            </group>
                        );
                    case "knife":
                        return (
                            <group key={o}>
                                <mesh geometry={g.wood} material={m.walnut} />
                                <mesh geometry={g.brass} material={m.brass} />
                                <mesh geometry={g.steel} material={m.steel} />
                            </group>
                        );
                    case "wireless":
                        return (
                            <group key={o}>
                                <mesh geometry={g.wood} material={m.walnut} />
                                <mesh geometry={g.panel} material={m.bakelite} />
                                <mesh geometry={g.grille} material={m.grille} />
                                <mesh geometry={g.dial} material={m.dial} />
                                <mesh geometry={g.brass} material={m.brass} />
                                <mesh geometry={g.knobs} material={m.bakelite} />
                            </group>
                        );
                }
            })}
        </group>
    );
}
