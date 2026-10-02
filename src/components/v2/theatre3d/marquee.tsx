"use client";

import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MARQUEE_Y, PALETTE } from "@/components/v2/theatre3d/layout";
import {
    BOOTH,
    BULB_GROUP_POINTS,
    CEILING,
    CORNERS,
    FACE,
    FRAME,
    FRAME_FRONT,
    HOLE,
    MOULD,
    SIGN,
    createLive,
    driveMarquee,
} from "@/components/v2/theatre3d/marquee-parts";
import { createSignLights, litBySign, placeLights } from "@/components/v2/theatre3d/marquee-lights";
import { metreUVs, roundedRect } from "@/components/v2/theatre3d/marquee-geometry";
import { GILT_TILE, marqueeTextures } from "@/components/v2/theatre3d/marquee-textures";
import { Bulbs, Chains, Rivets, ironMaterial } from "@/components/v2/theatre3d/marquee-hardware";
import { BoxOffice } from "@/components/v2/theatre3d/marquee-booth";
import { NeonTitle } from "@/components/v2/theatre3d/marquee-neon";

// The marquee over the Magic Theatre's entrance: a heavy iron box gone to
// rust, a ring of bulbs, MAGIC THEATRE in neon and FOR MADMEN ONLY in script
// beneath it. It hangs on two chains from the ceiling and moves, very
// slightly, in the draught. Under its far end, against the outer wall,
// stands the theatre's old box office (see marquee-booth.tsx).
//
// `power` (0 to 1) is the intro: the lights have failed and are coming back.
// The sign stays dark until about 0.55, the neon fights its way on, then the
// bulbs chase round. `onPlaybill` is called when the visitor taps the
// playbill on its easel by the box office.

// How strongly the bulbs and tubes light the sign's own metal.
const BULB_GAIN = 0.12;
const NEON_GAIN = 0.3;
// The one real light: thrown down and forward by the neon onto the floor and walls.
const LIGHT_GAIN = 11;

// ---------------------------------------------------------------- geometry

/** A flat ring with a hole, extruded and bevelled. Sizes are the finished outside and the narrowest hole. */
function ring(outerW: number, outerH: number, holeW: number, holeH: number, depth: number, bevel: number, segments: number, r: number) {
    const shape = roundedRect(new THREE.Shape(), outerW - 2 * bevel, outerH - 2 * bevel, r);
    shape.holes.push(roundedRect(new THREE.Path(), holeW + 2 * bevel, holeH + 2 * bevel, r * 0.5));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segments, curveSegments: 4 });
    // Its back face sits at z = 0.
    geo.translate(0, 0, bevel);
    return metreUVs(geo);
}

const caseGeo = metreUVs(new RoundedBoxGeometry(SIGN.w, SIGN.h, SIGN.front - SIGN.back, 3, 0.022).translate(0, 0, (SIGN.back + SIGN.front) / 2));
const frameGeo = ring(SIGN.w, SIGN.h, HOLE.w, HOLE.h, FRAME.depth, FRAME.bevel, 2, 0.03).translate(0, 0, FRAME.z);
const mouldGeo = ring(MOULD.outerW, MOULD.outerH, MOULD.innerW, MOULD.innerH, MOULD.depth, MOULD.bevel, 3, 0.02).translate(0, 0, FRAME_FRONT - 0.003);

/** The face plate, dented here and there and bellied out a little, held flat at its edges. */
function faceGeometry() {
    const geo = new THREE.PlaneGeometry(FACE.w, FACE.h, 140, 40);
    const p = geo.attributes.position;
    const dents: [number, number, number, number][] = [
        // x, y, radius, depth
        [0.62, 0.04, 0.17, 0.0065],
        [-0.92, -0.12, 0.1, 0.0045],
        [1.02, 0.17, 0.07, 0.004],
        [-0.28, 0.2, 0.06, 0.003],
        [0.18, -0.2, 0.05, 0.0035],
    ];
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const held = Math.min(1, Math.max(0, (FACE.w / 2 - 0.06 - Math.abs(x)) / 0.12)) * Math.min(1, Math.max(0, (FACE.h / 2 - 0.06 - Math.abs(y)) / 0.1));
        let z = 0.0025 * Math.cos((x / FACE.w) * Math.PI) * Math.cos((y / FACE.h) * Math.PI);
        for (const [dx, dy, r, d] of dents) z -= d * Math.exp(-((x - dx) ** 2 + (y - dy) ** 2) / (r * r));
        // A buckle running in from the lower right, where something once hit it.
        const along = (x - 1.0) * 0.8 + (y + 0.28) * 0.6;
        const across = (x - 1.0) * 0.6 - (y + 0.28) * 0.8;
        z -= 0.004 * Math.exp(-(across * across) / 0.0004) * Math.exp(-(along * along) / 0.03);
        p.setZ(i, z * held);
    }
    geo.computeVertexNormals();
    return geo.translate(0, 0, FACE.z);
}
const faceGeo = faceGeometry();

// Gilt rosettes in the corners: a dished disc, a bead and a boss.
const rosetteGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.031, 0.034, 0.008, 24).rotateX(Math.PI / 2).translate(0, 0, 0.004),
    new THREE.TorusGeometry(0.022, 0.0035, 6, 24).translate(0, 0, 0.009),
    new THREE.SphereGeometry(0.012, 14, 8).scale(1, 1, 0.55).translate(0, 0, 0.009),
]).translate(0, 0, FRAME_FRONT);

// A length of old cable that has come loose and hangs in a loop under the box.
const cableGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.2, -SIGN.h / 2 + 0.01, -0.08),
        new THREE.Vector3(1.17, -SIGN.h / 2 - 0.07, -0.075),
        new THREE.Vector3(1.07, -SIGN.h / 2 - 0.125, -0.066),
        new THREE.Vector3(0.95, -SIGN.h / 2 - 0.1, -0.06),
        new THREE.Vector3(0.9, -SIGN.h / 2 - 0.04, -0.06),
        new THREE.Vector3(0.88, -SIGN.h / 2 + 0.01, -0.062),
    ]),
    40,
    0.0055,
    6,
);

// ---------------------------------------------------------------- the sign

// Dev only: /theatre-lab?part=marquee&mqview=start shows the sign from the
// theatre's opening camera (&mqenv=1 adds the corridor, &mqfov=70 for portrait).
const MarqueeCheck =
    process.env.NODE_ENV === "production" ? null : lazy(() => import("@/components/v2/theatre3d/marquee-check").then((m) => ({ default: m.MarqueeCheck })));

export function Marquee({ power = 1, onPlaybill }: { power?: number; onPlaybill?: () => void }) {
    const powerRef = useRef(power);
    powerRef.current = power;
    // Read through a ref, so a new callback each render doesn't rebuild the sign.
    const playbillRef = useRef(onPlaybill);
    playbillRef.current = onPlaybill;
    const [check] = useState(() => !!MarqueeCheck && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mqview") === "start");
    // On the dev check bench, a tap on the playbill just says so.
    if (check && !onPlaybill) playbillRef.current = () => console.warn("playbill tapped");
    const live = useMemo(createLive, []);
    const lights = useMemo(() => createSignLights(PALETTE.lamp, PALETTE.neon, PALETTE.lamp), []);
    const sway = useRef<THREE.Group>(null);
    const sign = useRef<THREE.Group>(null);
    const light = useRef<THREE.PointLight>(null);

    const mats = useMemo(() => {
        const { face, gilt } = marqueeTextures();
        const giltTex = (t: THREE.Texture) => {
            const c = t.clone();
            c.repeat.set(1 / GILT_TILE, 1 / GILT_TILE);
            return c;
        };
        return {
            box: ironMaterial(lights),
            frame: ironMaterial(lights, undefined, { metalness: 0.5 }),
            face: litBySign(
                new THREE.MeshStandardMaterial({ map: face.map, roughnessMap: face.roughnessMap, normalMap: face.normalMap, metalness: 0.3, roughness: 1 }),
                lights,
            ),
            gilt: litBySign(
                new THREE.MeshStandardMaterial({
                    map: giltTex(gilt.map),
                    roughnessMap: giltTex(gilt.roughnessMap),
                    metalnessMap: giltTex(gilt.roughnessMap),
                    normalMap: giltTex(gilt.normalMap),
                    metalness: 1,
                    roughness: 1,
                }),
                lights,
            ),
            cable: litBySign(new THREE.MeshStandardMaterial({ color: "#120e0c", roughness: 0.65, metalness: 0 }), lights),
        };
    }, [lights]);

    useFrame(({ clock }, dt) => {
        const t = clock.elapsedTime;
        driveMarquee(live, t, Math.min(dt, 0.1), powerRef.current);
        const s = sway.current;
        const g = sign.current;
        if (!s || !g) return;
        // Hanging from the ceiling, it rocks a few millimetres, slowly.
        s.rotation.x = 0.0045 * Math.sin(t * 0.61) + 0.0018 * Math.sin(t * 1.37 + 1.1);
        s.position.x = 0.003 * Math.sin(t * 0.43 + 2.0);
        g.updateWorldMatrix(true, false);
        placeLights(lights.uBulbs.value, BULB_GROUP_POINTS, live.bulbGroups, BULB_GAIN, g.matrixWorld);
        placeLights(lights.uNeons.value, live.tubePoints, live.tubeLevels, NEON_GAIN, g.matrixWorld);
        if (light.current) light.current.intensity = live.neonAvg * LIGHT_GAIN;
    }, -1);

    // Built once: the intro changes `power` many times a second, and none of
    // this needs to re-render for it (everything reads the live state instead).
    const body = useMemo(
        () => (
            <group>
                <group ref={sway} position={[0, CEILING, 0]}>
                    <group ref={sign} position={[0, -CEILING, 0]}>
                        <mesh geometry={caseGeo} material={mats.box} />
                        <mesh geometry={frameGeo} material={mats.frame} />
                        <mesh geometry={mouldGeo} material={mats.gilt} />
                        <mesh geometry={faceGeo} material={mats.face} />
                        {CORNERS.map(([x, y], i) => (
                            <mesh key={i} geometry={rosetteGeo} material={mats.gilt} position={[x, y, 0]} rotation-z={i * 0.7} />
                        ))}
                        <mesh geometry={cableGeo} material={mats.cable} />
                        <Rivets lights={lights} />
                        <Bulbs live={live} lights={lights} />
                        <NeonTitle live={live} lights={lights} />
                        <Chains lights={lights} />
                        <pointLight ref={light} color={PALETTE.neon} intensity={0} decay={2} distance={12} position={[0, -0.6, 1.4]} />
                    </group>
                </group>
                {/* The box office stands on the floor against the outer wall; it doesn't sway. */}
                <group position={[BOOTH.wallX, -MARQUEE_Y, BOOTH.frontZ]}>
                    <BoxOffice live={live} lights={lights} onPlaybill={playbillRef} />
                </group>
            </group>
        ),
        [live, lights, mats],
    );

    if (check && MarqueeCheck)
        return (
            <Suspense fallback={null}>
                <MarqueeCheck power={power}>{body}</MarqueeCheck>
            </Suspense>
        );
    return body;
}
