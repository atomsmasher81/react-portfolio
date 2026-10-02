"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import { BOOTH, type MarqueeLive } from "@/components/v2/theatre3d/marquee-parts";
import { litBySign, type SignLights } from "@/components/v2/theatre3d/marquee-lights";
import { GILT_TILE, GLASS_GRILLE, WOOD_TILE, marqueeTextures } from "@/components/v2/theatre3d/marquee-textures";
import { GOLD, PLAYBILL, goldLeaf, inkCard, playbill, prepareLettering } from "@/components/v2/theatre3d/marquee-lettering";
import { boxBetween, metreUVs } from "@/components/v2/theatre3d/marquee-geometry";

// The theatre's old box office, built against the outer wall under the far
// end of the marquee: dark panelled wood, a counter at 1.1 m, and an arched
// window of old glass with PRICE OF ADMISSION in gold leaf across it. Inside
// it is dark and empty: a stool, a rack of empty pigeonholes, and one weak
// lamp on a cord, which lights mostly the card propped behind the glass
// where the price would be. Beside it stands tonight's bill in a glazed frame
// on an easel, which the visitor can tap to read the programme.
//
// In the booth's own space: x from its wall side toward the corridor, y up
// from the floor, z toward the visitor, the front face at z = 0.

const { w: W, depth: D, counter: C, win } = BOOTH;
const T = 0.05; // the window wall's thickness
const AR = win.w / 2; // the arch's radius
const SPRING = win.h - AR; // where the arch springs, above the sill
const TOP = C + win.h + 0.1; // the frieze starts here
const GLASS_Z = -0.024;
const SLOT = 0.085; // the half-moon slot under the glass
const GRILLE_R = 0.066;
const CARD = { w: 0.41, h: 0.32, x: -0.26, lean: 0.17 };

/** The booth's writing, painted beforehand (a slice at a time), lettering and all. */
export const prepareBoothLettering = () => prepareLettering(win, CARD);
const LAMP = { x: -0.24, y: 0.375, z: -0.04 }; // the bulb, in the window's space

const tile = (t: THREE.Texture, size: number) => {
    const c = t.clone();
    c.repeat.set(1 / size, 1 / size);
    return c;
};

// ---------------------------------------------------------------- geometry

/** The panelled front and side, the counter and the cornice, as one mesh. */
function outsideWood() {
    const parts = [
        // plinth and the lower front, panelled: frame, then two raised fields
        boxBetween(-0.01, 0, -0.04, W + 0.01, 0.12, 0.012),
        boxBetween(0, 0.12, -0.04, W, C - 0.05, -0.008),
        boxBetween(0, 0.12, -0.008, W, 0.19, 0.008),
        boxBetween(0, C - 0.12, -0.008, W, C - 0.05, 0.008),
        ...[0, W / 2 - 0.045, W - 0.09].map((x) => boxBetween(x, 0.19, -0.008, x + 0.09, C - 0.12, 0.008)),
        ...[0.09, W / 2 + 0.045].map((x) => boxBetween(x + 0.03, 0.22, -0.008, x + W / 2 - 0.135 - 0.03, C - 0.15, 0.002)),
        ...[0.09, W / 2 + 0.045].map((x) => boxBetween(x + 0.07, 0.27, -0.008, x + W / 2 - 0.135 - 0.07, C - 0.2, 0.007)),
        // the counter, running through to make the desk inside, on two brackets
        boxBetween(-0.03, C - 0.05, -0.45, W + 0.03, C, 0.16),
        ...[0.14, W - 0.14].map((x) => boxBetween(x - 0.025, C - 0.2, 0.0, x + 0.025, C - 0.05, 0.11)),
        // pilasters either side of the window
        boxBetween(0, C, 0, 0.1, TOP, 0.025),
        boxBetween(W - 0.1, C, 0, W, TOP, 0.025),
        // keystone over the arch
        boxBetween(win.x - 0.04, C + win.h - 0.01, 0, win.x + 0.04, C + win.h + 0.1, 0.03),
        // frieze and a stepped cornice
        boxBetween(-0.01, TOP, -0.03, W + 0.01, TOP + 0.1, 0.01),
        boxBetween(-0.03, TOP + 0.1, -0.05, W + 0.03, TOP + 0.13, 0.045),
        boxBetween(-0.05, TOP + 0.13, -0.07, W + 0.05, TOP + 0.18, 0.075),
        boxBetween(-0.06, TOP + 0.18, -0.08, W + 0.06, BOOTH.h, 0.085),
        // the side toward the corridor, with a rail at counter height, and the roof
        boxBetween(W - 0.035, 0, -D, W, BOOTH.h, 0),
        boxBetween(W, C - 0.06, -D + 0.04, W + 0.015, C - 0.01, -0.04),
        boxBetween(W, 0, -D + 0.02, W + 0.012, 0.12, 0),
        boxBetween(0, BOOTH.h - 0.03, -D, W, BOOTH.h, 0),
    ];
    return grimed(mergeGeometries(parts)!);
}

/** The wall the window is cut through: from the counter to the frieze, with the arched opening. */
function windowWall() {
    const shape = new THREE.Shape();
    shape.moveTo(0.1, C - 0.03);
    shape.lineTo(W - 0.1, C - 0.03);
    shape.lineTo(W - 0.1, TOP);
    shape.lineTo(0.1, TOP);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(win.x - AR, C);
    hole.lineTo(win.x - AR, C + SPRING);
    hole.absarc(win.x, C + SPRING, AR, Math.PI, 0, true);
    hole.lineTo(win.x + AR, C);
    hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 24 });
    geo.translate(0, 0, -T);
    return grimed(metreUVs(geo));
}

/** Darken toward the floor, where boots and mops have been, and a little toward the top, with soot. */
function grimed(geo: THREE.BufferGeometry) {
    const p = geo.attributes.position;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = (0.45 + 0.55 * Math.min(1, y / 0.9)) * (1 - 0.25 * Math.min(1, Math.max(0, (y - 2.0) / 0.4)));
        c.fill(k, i * 3, i * 3 + 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return geo;
}

/** Tarnished brass: a bead round the arch, the counter's edge, the slot's rim and the grille's. */
function brassBits() {
    const pts: THREE.Vector3[] = [];
    const off = AR + 0.012;
    for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector3(win.x - off, C + (SPRING * k) / 10, 0.006));
    for (let k = 1; k < 32; k++) {
        const a = Math.PI - (Math.PI * k) / 32;
        pts.push(new THREE.Vector3(win.x + Math.cos(a) * off, C + SPRING + Math.sin(a) * off, 0.006));
    }
    for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector3(win.x + off, C + SPRING - (SPRING * k) / 10, 0.006));
    const bead = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.011, 8);
    const edge = new THREE.CylinderGeometry(0.009, 0.009, W + 0.06, 10).rotateZ(Math.PI / 2).translate(W / 2, C - 0.012, 0.16);
    const slotRim = new THREE.TorusGeometry(SLOT + 0.006, 0.005, 6, 32).rotateX(Math.PI / 2).translate(win.x, C + 0.002, GLASS_Z);
    const grilleRim = new THREE.TorusGeometry(GRILLE_R, 0.006, 8, 32).translate(win.x + GLASS_GRILLE[0], C + GLASS_GRILLE[1], GLASS_Z + 0.002);
    return mergeGeometries([bead, edge, slotRim, grilleRim])!;
}

/** The glass: the arched opening, less the half-moon slot at the sill and the hole for the grille. In the window's space. */
function glassGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-AR, 0);
    s.lineTo(-SLOT, 0);
    s.absarc(0, 0, SLOT, Math.PI, 0, true);
    s.lineTo(AR, 0);
    s.lineTo(AR, SPRING);
    s.absarc(0, SPRING, AR, 0, Math.PI, false);
    s.lineTo(-AR, 0);
    s.holes.push(new THREE.Path().absarc(GLASS_GRILLE[0], GLASS_GRILLE[1], GRILLE_R - 0.004, 0, Math.PI * 2, true));
    const geo = new THREE.ShapeGeometry(s, 32);
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / win.w + 0.5, p.getY(i) / win.h);
    return geo;
}

/** Inside: walls, ceiling, the pigeonhole rack on the back wall and the stool. */
function insideWood() {
    const parts = [
        boxBetween(0, 0, -D, W, TOP, -D + 0.02),
        boxBetween(0, 0, -D, 0.03, TOP, 0),
        boxBetween(0, TOP - 0.02, -D, W, TOP, -T),
    ];
    // Pigeonholes: four by three, on the back wall.
    const rack = { x0: 0.34, x1: 1.08, y0: C + 0.28, y1: C + 0.74, z: -D + 0.02 };
    for (let i = 0; i <= 4; i++) {
        const x = rack.x0 + ((rack.x1 - rack.x0) * i) / 4;
        parts.push(boxBetween(x - 0.007, rack.y0, rack.z, x + 0.007, rack.y1, rack.z + 0.11));
    }
    for (let j = 0; j <= 3; j++) {
        const y = rack.y0 + ((rack.y1 - rack.y0) * j) / 3;
        parts.push(boxBetween(rack.x0, y - 0.007, rack.z, rack.x1, y + 0.007, rack.z + 0.11));
    }
    // An empty stool, pushed back from the desk.
    const stool = new THREE.Vector3(win.x + 0.2, 0, -0.52);
    parts.push(metreUVs(new THREE.CylinderGeometry(0.16, 0.15, 0.035, 20).translate(stool.x, 0.72, stool.z)));
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.4;
        const leg = new THREE.CylinderGeometry(0.013, 0.016, 0.72, 6);
        leg.rotateZ(0.08 * Math.cos(a)).rotateX(-0.08 * Math.sin(a));
        parts.push(metreUVs(leg.translate(stool.x + Math.cos(a) * 0.1, 0.36, stool.z + Math.sin(a) * 0.1)));
    }
    parts.push(metreUVs(new THREE.TorusGeometry(0.13, 0.008, 6, 24).rotateX(Math.PI / 2).translate(stool.x, 0.28, stool.z)));
    return grimed(mergeGeometries(parts)!);
}

// ---------------------------------------------------------------- the playbill easel

// Where the easel stands, in the booth's space: just past its corridor side,
// a little back from its front, turned toward the entrance. The bill's
// centre is at `centre` above the floor, and it leans back by `lean`.
const EASEL = { x: 1.65, z: -0.43, yaw: 0.42, lean: 0.1, centre: 1.3 };
const BILL_FRAME = 0.03;

/** A box running from a to b, w by d in section, with metre UVs. */
function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number) {
    const dir = b.clone().sub(a);
    const g = new THREE.BoxGeometry(w, dir.length(), d);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    return metreUVs(g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2));
}

/** From the bill's own plane (x across, y up its face, z out of it) into the easel's space. */
const onBill = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), -EASEL.lean).add(new THREE.Vector3(0, EASEL.centre, 0));
const tilted = (g: THREE.BufferGeometry) => g.rotateX(-EASEL.lean).translate(0, EASEL.centre, 0);

/** The easel and the bill's frame, in one piece of wood. */
function easelGeometry() {
    const { w, h } = PLAYBILL;
    const f = BILL_FRAME;
    const parts = [
        // the frame, standing proud of the bill where the glass would sit, and its backing board
        boxBetween(-w / 2 - f, -h / 2 - f, -0.012, -w / 2, h / 2 + f, 0.018),
        boxBetween(w / 2, -h / 2 - f, -0.012, w / 2 + f, h / 2 + f, 0.018),
        boxBetween(-w / 2, h / 2, -0.012, w / 2, h / 2 + f, 0.018),
        boxBetween(-w / 2, -h / 2 - f, -0.012, w / 2, -h / 2, 0.018),
        boxBetween(-w / 2, -h / 2, -0.022, w / 2, h / 2, -0.012),
        // the ledge it rests on
        boxBetween(-0.32, -h / 2 - f - 0.025, -0.035, 0.32, -h / 2 - f, 0.05),
    ].map(tilted);
    // Two legs in front, splayed, and one behind; a brace across.
    const tops = [-1, 1].map((s) => onBill(s * 0.2, h / 2 + 0.13, -0.04));
    const feet = [-1, 1].map((s) => new THREE.Vector3(s * 0.29, 0, 0.11));
    parts.push(beam(feet[0], tops[0], 0.032, 0.026), beam(feet[1], tops[1], 0.032, 0.026));
    parts.push(beam(new THREE.Vector3(0, 0, -0.48), onBill(0, h / 2 + 0.1, -0.05), 0.03, 0.024));
    const brace = (k: number) => [0, 1].map((i) => feet[i].clone().lerp(tops[i], k));
    const [b0, b1] = brace(0.32);
    parts.push(beam(b0, b1, 0.024, 0.02));
    return grimed(mergeGeometries(parts)!);
}

const geometry = (() => {
    let built: ReturnType<typeof build> | null = null;
    function build() {
        return {
            outside: outsideWood(),
            wall: windowWall(),
            brass: brassBits(),
            glass: glassGeometry(),
            inside: insideWood(),
            gold: new THREE.PlaneGeometry(win.w, win.h - GOLD.y0).translate(0, (GOLD.y0 + win.h) / 2, 0.0015),
            grille: new THREE.CircleGeometry(GRILLE_R, 32).translate(GLASS_GRILLE[0], GLASS_GRILLE[1], 0.0005),
            slot: new THREE.CircleGeometry(SLOT, 32).rotateX(-Math.PI / 2).translate(win.x, C + 0.0015, GLASS_Z),
            card: new THREE.PlaneGeometry(CARD.w, CARD.h),
            shade: new THREE.ConeGeometry(0.05, 0.05, 18, 1, true),
            cord: new THREE.CylinderGeometry(0.0025, 0.0025, 1, 5),
            bulb: new THREE.SphereGeometry(0.019, 14, 10),
            easel: easelGeometry(),
            bill: tilted(new THREE.PlaneGeometry(PLAYBILL.w, PLAYBILL.h)),
            // Generous, so it is easy to hit with a thumb.
            billHit: tilted(new THREE.BoxGeometry(0.85, 1.1, 0.45).translate(0, 0, 0.08)),
        };
    }
    return () => (built ??= build());
})();

// ---------------------------------------------------------------- the booth

const LAMP_GAIN = 0.75;
const LAMP_COLOR = new THREE.Color(PALETTE.lamp).lerp(new THREE.Color("#ffd9a0"), 0.3);

export function BoxOffice({ live, lights, onPlaybill }: { live: MarqueeLive; lights: SignLights; onPlaybill?: MutableRefObject<(() => void) | undefined> }) {
    const root = useRef<THREE.Group>(null);
    const lampPos = useMemo(() => new THREE.Vector3(), []);
    const geo = geometry();

    const mats = useMemo(() => {
        const t = marqueeTextures();
        const wood = (color: THREE.ColorRepresentation) =>
            litBySign(
                new THREE.MeshStandardMaterial({
                    map: tile(t.wood.map, WOOD_TILE),
                    roughnessMap: tile(t.wood.roughnessMap, WOOD_TILE),
                    normalMap: tile(t.wood.normalMap, WOOD_TILE),
                    color,
                    vertexColors: true,
                    metalness: 0,
                    roughness: 1,
                }),
                lights,
            );
        const brass = {
            map: tile(t.gilt.map, GILT_TILE),
            roughnessMap: tile(t.gilt.roughnessMap, GILT_TILE),
            metalnessMap: tile(t.gilt.roughnessMap, GILT_TILE),
            color: "#8c7a58",
            metalness: 0.85,
            roughness: 1,
        };
        const gold = goldLeaf(win);
        lights.uLampColor.value.copy(LAMP_COLOR);
        return {
            outside: wood("#ffffff"),
            inside: wood("#8a7466"),
            brass: litBySign(new THREE.MeshStandardMaterial(brass), lights),
            grille: litBySign(new THREE.MeshStandardMaterial({ ...brass, alphaMap: t.grille, alphaTest: 0.5, side: THREE.DoubleSide }), lights),
            glass: litBySign(
                new THREE.MeshStandardMaterial({
                    map: t.glass.map,
                    alphaMap: t.glass.alpha,
                    normalMap: t.glass.waves,
                    normalScale: new THREE.Vector2(0.35, 0.35),
                    transparent: true,
                    depthWrite: false,
                    roughness: 0.14,
                    metalness: 0,
                }),
                lights,
            ),
            // The leaf catches what light there is; a touch of its own keeps it legible in the gloom.
            gold: litBySign(
                new THREE.MeshStandardMaterial({ map: gold, emissiveMap: gold, emissive: "#ffffff", emissiveIntensity: 0, transparent: true, depthWrite: false, metalness: 0.55, roughness: 0.32 }),
                lights,
            ),
            card: litBySign(new THREE.MeshStandardMaterial({ map: inkCard(CARD), roughness: 0.92, metalness: 0 }), lights),
            slot: new THREE.MeshBasicMaterial({ color: "#050303" }),
            shade: litBySign(new THREE.MeshStandardMaterial({ color: "#1b211b", roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), lights),
            cord: new THREE.MeshStandardMaterial({ color: "#0c0a09", roughness: 0.7 }),
            bulb: new THREE.MeshBasicMaterial({ color: "#000000", toneMapped: false }),
            // The bill behind its glass: a little gloss for the glazing, and a touch of its own light so it reads.
            bill: litBySign(
                new THREE.MeshStandardMaterial({ map: playbill(), emissiveMap: playbill(), emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.3, metalness: 0 }),
                lights,
            ),
        };
    }, [lights]);

    const openBill = (e: ThreeEvent<MouseEvent>) => {
        const open = onPlaybill?.current;
        if (!open) return;
        e.stopPropagation();
        open();
    };

    useFrame(() => {
        const r = root.current;
        if (!r) return;
        const v = live.lamp;
        mats.bulb.color.copy(LAMP_COLOR).multiplyScalar(0.01 + 2.6 * v);
        mats.gold.emissiveIntensity = 0.45 * live.bulbAvg;
        mats.bill.emissiveIntensity = 0.07 * live.bulbAvg;
        lampPos.set(win.x + LAMP.x, C + LAMP.y, GLASS_Z + LAMP.z).applyMatrix4(r.matrixWorld);
        lights.uLamp.value.set(lampPos.x, lampPos.y, lampPos.z, v * LAMP_GAIN);
    });

    return (
        <group ref={root}>
            <mesh geometry={geo.outside} material={mats.outside} />
            <mesh geometry={geo.wall} material={mats.outside} />
            <mesh geometry={geo.brass} material={mats.brass} />
            <mesh geometry={geo.slot} material={mats.slot} />
            <mesh geometry={geo.inside} material={mats.inside} />
            <group position={[EASEL.x, 0, EASEL.z]} rotation-y={EASEL.yaw}>
                <mesh geometry={geo.easel} material={mats.outside} />
                <mesh geometry={geo.bill} material={mats.bill} />
                <mesh geometry={geo.billHit} visible={false} name="playbill" onClick={openBill} />
            </group>
            <group position={[win.x, C, GLASS_Z]}>
                <mesh geometry={geo.glass} material={mats.glass} renderOrder={1} />
                <mesh geometry={geo.gold} material={mats.gold} renderOrder={2} />
                <mesh geometry={geo.grille} material={mats.grille} />
                {/* The card, propped on the desk behind the glass, leaning back a little and turned to the door. */}
                <mesh
                    geometry={geo.card}
                    material={mats.card}
                    position={[CARD.x, (CARD.h / 2) * Math.cos(CARD.lean), -0.065 - (CARD.h / 2) * Math.sin(CARD.lean)]}
                    rotation={[-CARD.lean, 0.16, -0.03]}
                />
                {/* The lamp: a bulb under a little tin shade, hanging on its cord just inside the glass. */}
                <group position={[LAMP.x, LAMP.y, LAMP.z]}>
                    <mesh geometry={geo.bulb} material={mats.bulb} />
                    <mesh geometry={geo.shade} material={mats.shade} position-y={0.04} />
                    <mesh geometry={geo.cord} material={mats.cord} position-y={(TOP - C - LAMP.y + 0.065) / 2} scale={[1, TOP - C - LAMP.y - 0.065, 1]} />
                </group>
            </group>
        </group>
    );
}
