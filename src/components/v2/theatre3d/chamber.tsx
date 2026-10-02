"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Room, RoomObject } from "@/data/v2/theatre";
import { litPath } from "@/lib/moon";
import { rng } from "@/components/v2/theatre3d/textures";
import { ALTAR, FACE_Y0, FACE_Z, STEP, layoutChamber, loadFonts, resetMeasure, roomKey, seedOf, type Block, type ChamberLayout, type ChamberShot } from "@/components/v2/theatre3d/chamber-layout";
import { carveFace, type FaceBuild } from "@/components/v2/theatre3d/chamber-face";
import { nailY, paintPaper, paperGeometry, type PaperBuild } from "@/components/v2/theatre3d/chamber-paper";
import { chamberTextures, disposeChamberTextures } from "@/components/v2/theatre3d/chamber-textures";
import { breathe, makeCanvas } from "@/components/v2/theatre3d/chamber-pixels";
import {
    ROOM,
    STAND,
    bowlGeometry,
    candlesGeometry,
    chairGeometry,
    floorGeometry,
    flowerGeometry,
    grateGeometry,
    petalsGeometry,
    plinthGeometry,
    ribsGeometry,
    roomHeights,
    WELL_DEPTH,
    shellGeometry,
    shroudGeometry,
    steleGeometry,
    standGeometry,
    standTop,
    steleTop,
    webGeometry,
    type CandleSpec,
    type Heights,
} from "@/components/v2/theatre3d/chamber-geometry";
import { CandleLights, Dust, Flames, Shaft, disposeChamberFx, useFlame, type LightSpec } from "@/components/v2/theatre3d/chamber-fx";
import { ChamberObjects, disposeChamberObjects } from "@/components/v2/theatre3d/chamber-objects";

export type { ChamberShot } from "@/components/v2/theatre3d/chamber-layout";

// The room behind a door: a low brick cellar under a vault, and at its end a
// shrine: an old limestone stele on an altar, the room's words cut into its
// face, its pictures and letters nailed to it, candles guttering round it.
// Built in its own space: floor at y = 0, the shrine at the origin facing +Z,
// the doorway behind the visitor at z = 3.6.
//
// <Chamber room plate power quality onLayout /> draws it; onLayout reports
// the area to read (ChamberShot) once the fonts and pictures are in. Set
// behind one of the corridor's doors, it's built with `frontWall` false: no
// wall and no doorway of its own at the front, so the corridor door's arch
// is the only frame you look in through. A room's
// textures and shapes are kept, so going back in is instant;
// prepareChamber() starts that work early (as the door opens), and
// disposeChamberCache() frees it all when the theatre closes.

export interface ChamberProps {
    room: Room;
    plate: string;
    /** 0..1, how lit the room is; 0 is black. */
    power?: number;
    quality?: "high" | "low";
    /** Its own front wall and doorway (false: open at the front, for a room set right behind another doorway). */
    frontWall?: boolean;
    onLayout?: (shot: ChamberShot) => void;
}

/* ------------------------------------------------------------ the room's set */

const LEDGE = ALTAR.h;

/** The candles, and which light each belongs to (its flicker). */
const CANDLES: CandleSpec[] = [
    // the altar, left of the stele
    { x: -0.6, y: LEDGE, z: 0.2, r: 0.033, h: 0.27, lit: true, light: 0 },
    { x: -0.7, y: LEDGE, z: 0.31, r: 0.026, h: 0.17, lit: true, light: 0 },
    { x: -0.56, y: LEDGE, z: 0.35, r: 0.021, h: 0.1, lit: true, light: 0, lean: 0.06 },
    { x: -0.75, y: LEDGE, z: 0.12, r: 0.03, h: 0.06, lit: false, light: 0 },
    // and right
    { x: 0.61, y: LEDGE, z: 0.22, r: 0.034, h: 0.21, lit: true, light: 1 },
    { x: 0.71, y: LEDGE, z: 0.32, r: 0.024, h: 0.12, lit: true, light: 1, lean: -0.07 },
    { x: 0.55, y: LEDGE, z: 0.36, r: 0.02, h: 0.05, lit: false, light: 1 },
    // on the step
    { x: -0.84, y: STEP.h, z: 0.55, r: 0.028, h: 0.12, lit: true, light: 0 },
    { x: 0.88, y: STEP.h, z: 0.58, r: 0.03, h: 0.085, lit: true, light: 1 },
    // a few on the floor to the right, one knocked over
    { x: 1.27, y: 0, z: 0.98, r: 0.03, h: 0.16, lit: true, light: 3 },
    { x: 1.36, y: 0, z: 1.08, r: 0.026, h: 0.08, lit: false, light: 3 },
    { x: 1.18, y: 0, z: 1.14, r: 0.024, h: 0.15, lit: false, light: 3, fallen: true, lean: 0.9 },
];

/** The candles on the iron stands, at the stands' height. */
const standCandles = (top: number): CandleSpec[] => [
    { x: -STAND.x, y: top + 0.004, z: STAND.z, r: 0.043, h: 0.25, lit: true, light: 2 },
    { x: STAND.x, y: top + 0.004, z: STAND.z, r: 0.04, h: 0.2, lit: true, light: 3 },
];

/** Warm key lights: one per cluster of flames on high; two that stand in for all of them on low. */
function lightsFor(quality: "high" | "low", faceH: number, top: number): LightSpec[] {
    // a taller stele needs its upper lights to reach further
    const tall = 1 + Math.max(0, faceH - 1.45) * 0.45;
    if (quality === "low") {
        const y = FACE_Y0 + faceH * 0.42;
        return [
            { pos: [-0.8, y + 0.02, 0.42], k: 2.9 * tall, seed: 1, dist: 3.0 * Math.sqrt(tall) },
            { pos: [0.8, y - 0.02, 0.42], k: 2.6 * tall, seed: 2, dist: 3.0 * Math.sqrt(tall) },
        ];
    }
    return [
        { pos: [-0.63, 0.98, 0.27], k: 1.5, seed: 1, dist: 2.6 },
        { pos: [0.65, 0.94, 0.27], k: 1.3, seed: 2, dist: 2.6 },
        { pos: [-STAND.x, top + 0.28, STAND.z + 0.02], k: 1.5 * tall, seed: 3, dist: 2.8 * Math.sqrt(tall) },
        { pos: [STAND.x, top + 0.24, STAND.z + 0.02], k: 1.3 * tall, seed: 4, dist: 2.8 * Math.sqrt(tall) },
        // the two candles on the step, low down, light the altar's front and the floor
        { pos: [0, 0.34, 0.66], k: 0.32, seed: 5, dist: 2.2 },
    ];
}
const CANDLE_LIGHT = "#ffa862";

const CHAIR = { x: -0.98, z: 1.62, yaw: 2.55 };
const SHROUD = { x: 1.3, z: -0.46, yaw: -0.5 };

/* -------------------------------------------------------- shared things */

let shared: ReturnType<typeof buildShared> | null = null;
const waxGlow = { value: 0 };

function buildShared() {
    const t0 = performance.now();
    const t = chamberTextures;

    const stone = new THREE.MeshStandardMaterial({ ...t.limestone(), color: "#e2d9c8" });
    const brick = new THREE.MeshStandardMaterial({ ...t.brick(), vertexColors: true });
    const flags = new THREE.MeshStandardMaterial({ ...t.flags(), vertexColors: true });
    const rust = new THREE.MeshStandardMaterial({ ...t.rust(), metalness: 0.35 });
    const wood = new THREE.MeshStandardMaterial({ ...t.wood(), color: "#b8a898" });
    const cloth = new THREE.MeshStandardMaterial({ ...t.cloth(), color: "#8e877c", side: THREE.DoubleSide });
    const darkStone = new THREE.MeshStandardMaterial({ ...t.limestone(), color: "#857a6a" });
    const wax = new THREE.MeshStandardMaterial({ color: "#c7b28c", roughness: 0.55, vertexColors: true });
    wax.onBeforeCompile = (shader) => {
        shader.uniforms.uGlow = waxGlow;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vGlow;\nuniform float uGlow;")
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.52, 0.2) * vGlow * vGlow * uGlow;");
    };
    wax.customProgramCacheKey = () => "chamber-wax";
    const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const ash = new THREE.MeshStandardMaterial({ color: "#26211c", roughness: 1 });
    const web = new THREE.MeshStandardMaterial({ color: "#cfc6b6", alphaMap: t.web(), transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, roughness: 1 });
    const sky = new THREE.MeshBasicMaterial({ color: "#000000", fog: false });
    const nail = new THREE.CylinderGeometry(0.0075, 0.009, 0.007, 10);
    nail.rotateX(Math.PI / 2);
    nail.translate(0, 0, 0.0045);
    const ashG = new THREE.CircleGeometry(0.07, 18);
    ashG.rotateX(-Math.PI / 2);
    ashG.translate(0, 0.024, 0);
    const out = {
        mats: { stone, darkStone, brick, flags, rust, wood, cloth, wax, plain, ash, web, sky },
        geo: {
            candles: candlesGeometry(CANDLES),
            bowl: bowlGeometry(),
            ash: ashG,
            flower: flowerGeometry(5),
            petals: petalsGeometry(6, [
                [0.36, LEDGE, 0.36],
                [-0.2, STEP.h, 0.5],
                [-0.1, 0, 0.82],
                [0.3, 0, 0.95],
                [-1.02, 0, 1.25],
            ]),
            chair: chairGeometry(),
            shroud: shroudGeometry(9),
            grate: grateGeometry(),
            web: webGeometry(),
            nail,
            sky: new THREE.PlaneGeometry(0.34, 0.34),
        },
    };
    chamberTimings.sharedSet = Math.round(performance.now() - t0);
    return out;
}

const getShared = () => (shared ??= buildShared());

/** Paint the shared surfaces one at a time, letting the page draw between them. */
async function warmShared() {
    if (shared) return;
    const t = chamberTextures;
    for (const k of Object.keys(t) as (keyof typeof t)[]) {
        const a = performance.now();
        t[k]();
        chamberTimings["tex-" + k] = Math.round(performance.now() - a);
        await breathe();
    }
}

/* ---------------------------------------------------------- per room */

interface PaperMesh {
    block: Extract<Block, { type: "paper" }>;
    geometry: THREE.BufferGeometry;
    material: THREE.MeshStandardMaterial;
    maps: PaperBuild;
}

export interface ChamberBuild {
    key: string;
    quality: "high" | "low";
    layout: ChamberLayout;
    face: FaceBuild;
    faceMaterial: THREE.MeshStandardMaterial;
    stele: THREE.BufferGeometry;
    plinth: THREE.BufferGeometry;
    shell: THREE.BufferGeometry;
    floor: THREE.BufferGeometry;
    ribs: THREE.BufferGeometry;
    hts: Heights;
    papers: PaperMesh[];
    /** the iron stands and their candles: they grow with the stele */
    stand: THREE.BufferGeometry;
    standWax: THREE.BufferGeometry;
    standTop: number;
    candles: CandleSpec[];
    lights: LightSpec[];
    /** things from the novel's scene, left by the shrine */
    objects: RoomObject[];
    moon: { texture: THREE.CanvasTexture; material: THREE.MeshStandardMaterial; geometry: THREE.CircleGeometry } | null;
    /** the grate in the vault and where its light falls */
    well: { x: number; z: number; y: number; tilt: number; to: THREE.Vector3; from: THREE.Vector3; k: number; reach: number };
    dispose(): void;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();
const loader = new THREE.TextureLoader();

/** A picture, via TextureLoader (sRGB); null if it won't load within 12 s. */
function loadImage(src: string) {
    let p = images.get(src);
    if (!p) {
        p = Promise.race([
            loader.loadAsync(src).then((tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                const img = tex.image as HTMLImageElement;
                // drawn into the print's own texture, so this one is never uploaded
                tex.dispose();
                return img && img.width > 0 ? img : null;
            }),
            new Promise<null>((r) => setTimeout(() => r(null), 12000)),
        ]).catch(() => null);
        images.set(src, p);
        // let a failed picture be tried again next time
        p.then((img) => img || images.delete(src));
    }
    return p;
}

/** Tonight's moon on a disc: alabaster for the lit part, basalt for the dark, a polished bezel. */
function moonTexture(fraction: number) {
    const S = 512;
    const rand = rng(29);
    const c = makeCanvas(S, S);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    const R = S / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R * 0.97, 0, Math.PI * 2);
    ctx.clip();
    const dark = ctx.createRadialGradient(R * 0.8, R * 0.7, 0, R, R, R);
    dark.addColorStop(0, "#34363b");
    dark.addColorStop(1, "#1b1c20");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, S, S);
    // the lit part, from the same path the site's moon uses, inlaid in a pale, veined stone
    ctx.save();
    ctx.scale(S / 100, S / 100);
    const lit = new Path2D(litPath(fraction));
    const g = ctx.createRadialGradient(42, 40, 0, 50, 50, 68);
    g.addColorStop(0, "#d9d3c2");
    g.addColorStop(0.75, "#c3bca8");
    g.addColorStop(1, "#a39c88");
    ctx.fillStyle = g;
    ctx.fill(lit);
    ctx.clip(lit);
    // maria: soft grey shadows, roughly where they really are
    for (const [x, y, rx, ry, a] of [
        [36, 32, 12, 9, 0.4],
        [54, 30, 8, 7, 0],
        [61, 45, 10, 7, -0.3],
        [44, 58, 14, 8, 0.2],
        [29, 50, 7, 10, 0.1],
        [66, 66, 5, 4, 0],
        [48, 44, 6, 5, 0],
    ]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.scale(rx, ry);
        const m = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        m.addColorStop(0, "rgba(92,88,76,0.34)");
        m.addColorStop(0.6, "rgba(92,88,76,0.2)");
        m.addColorStop(1, "rgba(92,88,76,0)");
        ctx.fillStyle = m;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // veins in the stone
    ctx.strokeStyle = "rgba(120,110,92,0.35)";
    ctx.lineWidth = 0.3;
    for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        let x = rand() * 100;
        let y = rand() * 100;
        ctx.moveTo(x, y);
        for (let j = 0; j < 8; j++) {
            x += (rand() - 0.3) * 9;
            y += (rand() - 0.5) * 9;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
    // pits and scratches over both stones
    for (let k = 0; k < 700; k++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * R;
        ctx.fillStyle = `rgba(0,0,0,${0.06 + rand() * 0.16})`;
        ctx.fillRect(R + Math.cos(a) * d, R + Math.sin(a) * d, 1 + rand() * 2, 1 + rand() * 2);
    }
    ctx.restore();
    // the bezel
    ctx.strokeStyle = "#8d8576";
    ctx.lineWidth = S * 0.03;
    ctx.beginPath();
    ctx.arc(R, R, R * 0.97, 0, Math.PI * 2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

/** A built room's cache key: the room, and how it's built. */
const buildKey = (room: Room, plate: string, quality: "high" | "low", frontWall: boolean) => roomKey(room, plate, quality) + (frontWall ? "" : "|open");

const builds = new Map<string, Promise<ChamberBuild>>();
const finished = new Map<string, ChamberBuild>();
const users = new Map<string, number>();
const KEEP = { high: 4, low: 2 };

/** Free the oldest unused rooms beyond what we keep. */
function evict() {
    for (const q of ["high", "low"] as const) {
        const keys = Array.from(finished.keys()).filter((k) => finished.get(k)!.quality === q);
        let extra = keys.length - KEEP[q];
        for (const k of keys) {
            if (extra <= 0) break;
            if ((users.get(k) ?? 0) > 0) continue;
            finished.get(k)!.dispose();
            finished.delete(k);
            builds.delete(k);
            extra--;
        }
    }
}

/**
 * Lay out, carve and paint a room (fonts and pictures first). Cached: call it
 * as the door starts to open and the room will be ready when it's open.
 */
export function prepareChamber(room: Room, plate: string, quality: "high" | "low" = "high", frontWall = true): Promise<ChamberBuild> {
    const key = buildKey(room, plate, quality, frontWall);
    const hit = builds.get(key);
    if (hit) {
        // most recently used goes to the back of the queue
        const done = finished.get(key);
        if (done) {
            finished.delete(key);
            finished.set(key, done);
        }
        return hit;
    }
    const p = build(room, plate, quality, key, frontWall).then((b) => {
        finished.set(key, b);
        evict();
        return b;
    });
    p.catch(() => builds.delete(key));
    builds.set(key, p);
    return p;
}

/** Free everything the chambers have made (rooms, and the shared surfaces). */
export function disposeChamberCache() {
    finished.forEach((b) => b.dispose());
    finished.clear();
    builds.clear();
    if (shared) {
        Object.values(shared.mats).forEach((m) => m.dispose());
        Object.values(shared.geo).forEach((g) => g.dispose());
        shared = null;
    }
    disposeChamberTextures();
    disposeChamberFx();
    disposeChamberObjects();
}

/** How long the last build's steps took (ms), for the lab. */
export const chamberTimings: Record<string, number> = {};

async function build(room: Room, plate: string, quality: "high" | "low", key: string, frontWall: boolean): Promise<ChamberBuild> {
    let t = performance.now();
    const mark = (k: string) => {
        const now = performance.now();
        chamberTimings[k] = Math.round(now - t);
        t = now;
    };
    await loadFonts();
    mark("fonts");
    resetMeasure();
    const srcs = [...(room.kind === "photo" ? [room.src] : []), ...(room.images ?? []).map((i) => i.src)];
    const pics = new Map<string, HTMLImageElement | null>();
    await Promise.all(srcs.map(async (s) => pics.set(s, await loadImage(s))));
    mark("images");
    const aspect = (src: string) => {
        const img = pics.get(src);
        return img ? img.width / img.height : 4 / 3;
    };
    await warmShared();
    mark("shared");
    const layout = layoutChamber(room, plate, aspect);
    const seed = seedOf(roomKey(room, plate, quality)); // the same room, open-fronted or not
    await breathe();
    mark("layout");
    const face = await carveFace(layout, quality, seed);
    mark("carve");
    const faceMaterial = new THREE.MeshStandardMaterial({ map: face.map, normalMap: face.normalMap, roughnessMap: face.roughnessMap });
    await breathe();

    const papers: PaperMesh[] = [];
    for (const b of layout.blocks) {
        if (b.type !== "paper") continue;
        const maps = paintPaper(b.paper, b.paper.kind === "print" ? (pics.get(b.paper.src) ?? null) : null, quality);
        const material = new THREE.MeshStandardMaterial({ map: maps.map, roughnessMap: maps.roughnessMap, alphaTest: 0.5, side: THREE.DoubleSide });
        papers.push({ block: b, geometry: paperGeometry(b.paper, b.paper.kind === "letter" ? 0.03 : 0.04), material, maps });
        await breathe();
    }

    mark("papers");
    const hts = roomHeights(steleTop(layout.faceH));
    const top = standTop(layout.faceH);
    const standSpecs = standCandles(top);
    // the shapes, one at a time, letting the page breathe between them (on a slow
    // phone each can take tens of milliseconds)
    const stand = standGeometry(top);
    const standWax = candlesGeometry(standSpecs, 3000);
    await breathe();
    const stele = steleGeometry(layout.faceH, seed);
    await breathe();
    const plinth = plinthGeometry(layout.faceH, seed + 11);
    await breathe();
    // the grate: over the moon's disc for the moon, else over the empty chair
    const moonBlock = layout.blocks.find((b): b is Extract<Block, { type: "moon" }> => b.type === "moon");
    const faceTop = FACE_Y0 + layout.faceH;
    const wellAt = moonBlock ? { x: 0, z: 0.66 } : { x: -0.86, z: 1.5 };
    const wellY = hts.vaultY(wellAt.x);
    const from = new THREE.Vector3(wellAt.x, wellY - 0.02, wellAt.z);
    const to = moonBlock ? new THREE.Vector3(0, faceTop - moonBlock.y - moonBlock.d / 2, FACE_Z + 0.02) : new THREE.Vector3(CHAIR.x - 0.02, 0, CHAIR.z + 0.12);
    const well = { ...wellAt, y: wellY, tilt: -Math.asin(wellAt.x / hts.Rv), from, to, k: moonBlock ? 0.1 : 0.09, reach: moonBlock ? 0.62 : 0.85 };
    const shell = shellGeometry(
        hts,
        [
            { x: -STAND.x, y: top + 0.4, z: STAND.z, k: 0.75 },
            { x: STAND.x, y: top + 0.4, z: STAND.z, k: 0.7 },
            { x: -0.65, y: 1.0, z: 0.3, k: 0.3 },
            { x: 0.65, y: 1.0, z: 0.3, k: 0.3 },
        ],
        { x: wellAt.x, z: wellAt.z, size: 0.36 },
        seed + 21,
        frontWall,
    );
    await breathe();
    const floor = floorGeometry(seed + 31, frontWall);
    await breathe();
    const ribs = ribsGeometry(hts, seed + 41);

    mark("geometry");
    let moon: ChamberBuild["moon"] = null;
    if (moonBlock && layout.moon) {
        const texture = moonTexture(layout.moon.fraction);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0, emissive: "#b8c6e4", emissiveMap: texture, emissiveIntensity: 0 });
        moon = { texture, material, geometry: new THREE.CircleGeometry(moonBlock.d / 2, 64) };
    }

    return {
        key,
        quality,
        layout,
        face,
        faceMaterial,
        stele,
        plinth,
        shell,
        floor,
        ribs,
        hts,
        papers,
        stand,
        standWax,
        standTop: top,
        candles: [...CANDLES, ...standSpecs],
        lights: lightsFor(quality, layout.faceH, top),
        objects: room.objects ?? [],
        moon,
        well,
        dispose() {
            face.map.dispose();
            face.normalMap.dispose();
            face.roughnessMap.dispose();
            faceMaterial.dispose();
            for (const g of [stele, plinth, shell, floor, ribs, stand, standWax]) g.dispose();
            for (const p of papers) {
                p.geometry.dispose();
                p.material.dispose();
                p.maps.map.dispose();
                p.maps.roughnessMap.dispose();
            }
            if (moon) {
                moon.texture.dispose();
                moon.material.dispose();
                moon.geometry.dispose();
            }
        },
    };
}

/* ---------------------------------------------------------- the component */

export function Chamber({ room, plate, power = 1, quality = "high", frontWall = true, onLayout }: ChamberProps) {
    const key = buildKey(room, plate, quality, frontWall);
    const [ready, setReady] = useState<ChamberBuild | null>(() => finished.get(key) ?? null);
    const args = useRef({ room, plate, quality, frontWall });
    args.current = { room, plate, quality, frontWall };
    const report = useRef(onLayout);
    report.current = onLayout;
    const reported = useRef<string | null>(null);

    useEffect(() => {
        let alive = true;
        users.set(key, (users.get(key) ?? 0) + 1);
        const { room: r, plate: p, quality: q, frontWall: f } = args.current;
        prepareChamber(r, p, q, f)
            .then((b) => alive && setReady(b))
            .catch((e) => console.error("chamber:", e));
        return () => {
            alive = false;
            users.set(key, Math.max(0, (users.get(key) ?? 1) - 1));
            evict();
        };
    }, [key]);

    useEffect(() => {
        if (ready && ready.key === key && reported.current !== key) {
            reported.current = key;
            report.current?.(ready.layout.shot);
        }
    }, [ready, key]);

    if (!ready || ready.key !== key) return null;
    return <ChamberScene built={ready} power={power} quality={quality} />;
}

function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const m = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(m.matches);
        const on = () => setReduced(m.matches);
        m.addEventListener("change", on);
        return () => m.removeEventListener("change", on);
    }, []);
    return reduced;
}

function ChamberScene({ built, power, quality }: { built: ChamberBuild; power: number; quality: "high" | "low" }) {
    const high = quality === "high";
    const { mats, geo } = getShared();
    const reduced = useReducedMotion();
    // fade up from black the first time this room is drawn, whatever `power` says
    const appear = useRef(0);
    const flame = useFlame(built.lights, power, reduced);
    const hemi = useRef<THREE.HemisphereLight>(null);
    const spot = useRef<THREE.SpotLight>(null);
    const { layout, hts, well } = built;
    const faceTop = FACE_Y0 + layout.faceH;
    const lightOf = useMemo(() => (high ? (c: CandleSpec) => c.light : (c: CandleSpec) => c.light % 2), [high]);
    const steleMaterials = useMemo(() => [mats.stone, mats.stone, mats.stone, mats.stone, built.faceMaterial, mats.stone], [mats, built]);
    const beam = useMemo(() => ({ from: well.from, to: well.to, k: well.k * 7 }), [well]);
    const spotTarget = useMemo(() => {
        const o = new THREE.Object3D();
        o.position.copy(well.to);
        return o;
    }, [well]);

    useLayoutEffect(() => {
        appear.current = 0;
    }, [built]);

    useFrame((_, dt) => {
        appear.current = Math.min(1, appear.current + dt / 0.9);
        const a = appear.current * appear.current;
        flame.power *= a;
        for (let i = 0; i < flame.level.length; i++) flame.level[i] *= a;
        const p = flame.power;
        let avg = 0;
        for (let i = 0; i < flame.level.length; i++) avg += flame.level[i];
        avg /= Math.max(1, flame.level.length);
        waxGlow.value = 0.5 * avg;
        if (hemi.current) hemi.current.intensity = 0.9 * p;
        if (spot.current) spot.current.intensity = (layout.moon ? 3 : 3.2) * p;
        if (built.moon) built.moon.material.emissiveIntensity = (high ? 0.04 : 0.12) * p;
        mats.sky.color.setRGB(0.012 * p, 0.016 * p, 0.03 * p);
    }, -0.5);

    return (
        <group>
            <hemisphereLight ref={hemi} args={["#4b5a7c", "#120b07", 0]} />
            <CandleLights flame={flame} color={CANDLE_LIGHT} />
            {high && (
                <>
                    <primitive object={spotTarget} />
                    <spotLight ref={spot} position={well.from} target={spotTarget} color="#a8bce2" intensity={0} angle={0.26} penumbra={0.9} distance={6} decay={1.6} />
                </>
            )}

            {/* the cellar */}
            <mesh geometry={built.shell} material={mats.brick} />
            <mesh geometry={built.floor} material={mats.flags} />
            <mesh geometry={built.ribs} material={mats.darkStone} />

            {/* the shrine */}
            <mesh geometry={built.plinth} material={mats.stone} />
            <mesh geometry={built.stele} material={steleMaterials} />
            {built.papers.map((p, i) => (
                <group key={i} position={[p.block.x, faceTop - p.block.y, FACE_Z]} rotation-z={p.block.tilt}>
                    <mesh geometry={p.geometry} material={p.material} />
                    <mesh geometry={geo.nail} material={mats.rust} position={[0, -nailY(p.block.paper), 0.002]} />
                </group>
            ))}
            {built.moon &&
                layout.blocks.map((b, i) =>
                    b.type === "moon" ? (
                        <mesh key={i} geometry={built.moon!.geometry} material={built.moon!.material} position={[0, faceTop - b.y - b.d / 2, FACE_Z + 0.004]} />
                    ) : null,
                )}

            {/* what's been left on it */}
            <mesh geometry={geo.candles} material={mats.wax} />
            {[-1, 1].map((s) => (
                <mesh key={s} geometry={built.stand} material={mats.rust} position={[s * STAND.x, 0, STAND.z]} rotation-y={s * 0.7} />
            ))}
            <mesh geometry={built.standWax} material={mats.wax} />
            <group position={[0.02, LEDGE, 0.3]} rotation-y={0.4}>
                <mesh geometry={geo.bowl} material={mats.rust} />
                <mesh geometry={geo.ash} material={mats.ash} />
            </group>
            <mesh geometry={geo.flower} material={mats.plain} position={[0.16, LEDGE, 0.33]} rotation-y={-0.35} />
            <mesh geometry={geo.petals} material={mats.plain} />
            <ChamberObjects objects={built.objects} quality={quality} flame={flame} />

            {/* the dark corners */}
            <mesh geometry={geo.chair} material={mats.wood} position={[CHAIR.x, 0, CHAIR.z]} rotation-y={CHAIR.yaw} rotation-z={0.012} />
            <group position={[SHROUD.x, 0, SHROUD.z]} rotation-y={SHROUD.yaw}>
                <mesh geometry={geo.shroud} material={mats.cloth} />
            </group>
            <Webs hts={hts} material={mats.web} geometry={geo.web} />

            {/* the grate in the vault, and the night beyond it */}
            <group position={[well.x, well.y + 0.01, well.z]} rotation-z={well.tilt}>
                <mesh geometry={geo.grate} material={mats.rust} />
            </group>
            <mesh geometry={geo.sky} material={mats.sky} position={[well.x, well.y + WELL_DEPTH - 0.01, well.z]} rotation-x={Math.PI / 2} />

            <Flames candles={built.candles} flame={flame} lightOf={lightOf} />
            <Dust count={high ? 320 : 110} flame={flame} beam={beam} />
            <Shaft from={well.from} to={well.to} flame={flame} k={well.k} reach={well.reach} />
        </group>
    );
}

/** Cobwebs strung across the upper corners at the back, and one by the door. */
function Webs({ hts, material, geometry }: { hts: Heights; material: THREE.Material; geometry: THREE.BufferGeometry }) {
    const { halfW: HW, back, front } = ROOM;
    const y = hts.spring + 0.05;
    return (
        <group>
            <mesh geometry={geometry} material={material} position={[-HW + 0.01, y, back + 0.62]} rotation-y={Math.PI / 4} rotation-x={-0.15} scale={[0.88, 0.95, 1]} renderOrder={5} />
            <mesh geometry={geometry} material={material} position={[HW - 0.6, y + 0.02, back + 0.01]} rotation-y={-Math.PI / 4} rotation-x={-0.1} scale={[-0.85, 0.85, 1]} renderOrder={5} />
            <mesh geometry={geometry} material={material} position={[-HW + 0.01, y - 0.1, front - 0.55]} rotation-y={Math.PI * 0.75} scale={[0.75, 0.7, 1]} renderOrder={5} />
        </group>
    );
}

