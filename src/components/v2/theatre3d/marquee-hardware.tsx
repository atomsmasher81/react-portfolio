"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import {
    BULB,
    BULB_COUNT,
    BULBS,
    CEILING,
    CHAIN_X,
    FACE,
    FACE_RIVETS,
    MISSING_BULB,
    SIGN,
    type MarqueeLive,
} from "@/components/v2/theatre3d/marquee-parts";
import { litBySign, type SignLights } from "@/components/v2/theatre3d/marquee-lights";
import { IRON_TILE, marqueeTextures } from "@/components/v2/theatre3d/marquee-textures";

// The ironmongery of the sign: bulbs in their sockets, rivets, and the chains
// it hangs from.

const MID_Z = (SIGN.back + SIGN.front) / 2;
const dummy = new THREE.Object3D();

/** Old iron, from the shared rust texture. */
export function ironMaterial(lights: SignLights, repeat = 1 / IRON_TILE, opts: THREE.MeshStandardMaterialParameters = {}) {
    const { iron } = marqueeTextures();
    const tex = (t: THREE.Texture) => {
        const c = t.clone();
        c.repeat.set(repeat, repeat);
        return c;
    };
    return litBySign(
        new THREE.MeshStandardMaterial({
            map: tex(iron.map),
            roughnessMap: tex(iron.roughnessMap),
            normalMap: tex(iron.normalMap),
            normalScale: new THREE.Vector2(0.8, 0.8),
            metalness: 0.45,
            roughness: 1,
            ...opts,
        }),
        lights,
    );
}

// ---------------------------------------------------------------- bulbs

const socketGeo = new THREE.CylinderGeometry(0.0165, 0.019, 0.034, 14).rotateX(Math.PI / 2).translate(0, 0, BULB.socketZ + 0.017);
const collarGeo = new THREE.TorusGeometry(0.0168, 0.0028, 6, 18).translate(0, 0, BULB.socketZ + 0.033);
const globeGeo = new THREE.SphereGeometry(BULB.r, 20, 14).scale(1, 1, 1.12);
const filamentGeo = new THREE.TorusGeometry(0.0062, 0.0014, 5, 12);
const WARM = new THREE.Color(PALETTE.lamp);
const FILAMENT_HOT = new THREE.Color("#ffd7a8").multiplyScalar(5);
const FILAMENT_COLD = new THREE.Color("#171311");

// Glass that glows from inside: brightest where it faces you, like a frosted
// globe round a hot filament, and kept amber rather than white (they are old,
// low bulbs). Dark glass with a sheen when the bulb is off.
function globeMaterial() {
    const mat = new THREE.MeshStandardMaterial({
        color: "#3a2d24",
        roughness: 0.08,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        toneMapped: false,
    });
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWarm = { value: WARM };
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform vec3 uWarm;\nvarying float vGlow;")
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
                float facing = max(dot(normal, normalize(vViewPosition)), 0.0);
                totalEmissiveRadiance += uWarm * vGlow * (0.4 + 2.5 * pow(facing, 3.0));
                diffuseColor.a = mix(diffuseColor.a, 0.82, clamp(vGlow * 3.0, 0.0, 1.0));`,
            );
    };
    mat.customProgramCacheKey = () => "marquee-globe";
    return mat;
}

export function Bulbs({ live, lights }: { live: MarqueeLive; lights: SignLights }) {
    const sockets = useRef<THREE.InstancedMesh>(null);
    const collars = useRef<THREE.InstancedMesh>(null);
    const globes = useRef<THREE.InstancedMesh>(null);
    const filaments = useRef<THREE.InstancedMesh>(null);

    const parts = useMemo(() => {
        const geo = globeGeo.clone();
        const glow = new THREE.InstancedBufferAttribute(new Float32Array(BULB_COUNT), 1);
        glow.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("aGlow", glow);
        const { gilt } = marqueeTextures();
        const brass = litBySign(
            new THREE.MeshStandardMaterial({ color: "#6b5236", map: gilt.map, roughnessMap: gilt.roughnessMap, metalnessMap: gilt.metalnessMap, metalness: 1, roughness: 1 }),
            lights,
        );
        return {
            geo,
            glow,
            brass,
            glass: globeMaterial(),
            filament: new THREE.MeshBasicMaterial({ toneMapped: false }),
        };
    }, [lights]);

    useLayoutEffect(() => {
        BULBS.forEach(([x, y], i) => {
            dummy.position.set(x, y, 0);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            sockets.current?.setMatrixAt(i, dummy.matrix);
            collars.current?.setMatrixAt(i, dummy.matrix);
            // The empty socket keeps no glass.
            dummy.position.set(x, y, BULB.z);
            dummy.scale.setScalar(i === MISSING_BULB ? 0 : 1);
            dummy.updateMatrix();
            globes.current?.setMatrixAt(i, dummy.matrix);
            // Each filament sits a little differently.
            dummy.rotation.set(0.3 * Math.sin(i * 2.1), 0.4 * Math.cos(i * 1.3), i * 0.7);
            dummy.updateMatrix();
            filaments.current?.setMatrixAt(i, dummy.matrix);
            filaments.current?.setColorAt(i, FILAMENT_COLD);
        });
        for (const m of [sockets, collars, globes, filaments]) if (m.current) m.current.instanceMatrix.needsUpdate = true;
    }, []);

    useFrame(() => {
        const f = filaments.current;
        if (!f?.instanceColor) return;
        const arr = f.instanceColor.array as Float32Array;
        for (let i = 0; i < BULB_COUNT; i++) {
            const v = live.bulbs[i];
            parts.glow.array[i] = v;
            // Below a glow the wire is just dark metal; above it, white-hot.
            const k = Math.min(1, v * 4);
            arr[i * 3] = FILAMENT_COLD.r + (FILAMENT_HOT.r * v - FILAMENT_COLD.r) * k;
            arr[i * 3 + 1] = FILAMENT_COLD.g + (FILAMENT_HOT.g * v - FILAMENT_COLD.g) * k;
            arr[i * 3 + 2] = FILAMENT_COLD.b + (FILAMENT_HOT.b * v - FILAMENT_COLD.b) * k;
        }
        parts.glow.needsUpdate = true;
        f.instanceColor.needsUpdate = true;
    });

    return (
        <group>
            <instancedMesh ref={sockets} args={[socketGeo, parts.brass, BULB_COUNT]} frustumCulled={false} />
            <instancedMesh ref={collars} args={[collarGeo, parts.brass, BULB_COUNT]} frustumCulled={false} />
            <instancedMesh ref={filaments} args={[filamentGeo, parts.filament, BULB_COUNT]} frustumCulled={false} />
            <instancedMesh ref={globes} args={[parts.geo, parts.glass, BULB_COUNT]} frustumCulled={false} renderOrder={2} />
        </group>
    );
}

// ---------------------------------------------------------------- rivets

const rivetGeo = new THREE.SphereGeometry(0.0075, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1);

/** Where the rivets go and which way their heads face. */
function rivetMatrices() {
    const out: THREE.Matrix4[] = [];
    const put = (x: number, y: number, z: number, rx: number, rz: number) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(rx, 0, rz);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        out.push(dummy.matrix.clone());
    };
    for (const [x, y] of FACE_RIVETS) put(x, y, FACE.z, Math.PI / 2, 0);
    // A row along the underside, which is what you see from below.
    for (let i = 0; i < 15; i++) put(-1.4 + i * 0.2, -SIGN.h / 2, MID_Z, Math.PI, 0);
    for (const y of [-0.35, 0, 0.35]) {
        put(-SIGN.w / 2, y, MID_Z, 0, Math.PI / 2);
        put(SIGN.w / 2, y, MID_Z, 0, -Math.PI / 2);
    }
    return out;
}

export function Rivets({ lights }: { lights: SignLights }) {
    const ref = useRef<THREE.InstancedMesh>(null);
    const mats = useMemo(() => rivetMatrices(), []);
    const material = useMemo(() => litBySign(new THREE.MeshStandardMaterial({ color: "#3a2c24", roughness: 0.55, metalness: 0.55 }), lights), [lights]);
    useLayoutEffect(() => {
        mats.forEach((m, i) => ref.current?.setMatrixAt(i, m));
        if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    }, [mats]);
    return <instancedMesh ref={ref} args={[rivetGeo, material, mats.length]} frustumCulled={false} />;
}

// ---------------------------------------------------------------- chains

const LINK = { r: 0.0148, tube: 0.0042, stretch: 1.5 };
const linkGeo = new THREE.TorusGeometry(LINK.r, LINK.tube, 8, 18).scale(1, LINK.stretch, 1);
// Centre to centre of two interlocked links.
const PITCH = 2 * (LINK.r * LINK.stretch - LINK.tube) * 0.97;
const CHAIN_BOTTOM = SIGN.h / 2 + 0.048;
const CHAIN_TOP = CEILING - 0.036;
const LINKS = Math.round((CHAIN_TOP - CHAIN_BOTTOM) / PITCH);

const eyeGeo = new THREE.TorusGeometry(0.0155, 0.005, 8, 18);
const shankGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 8);
const nutGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.011, 6);
const plateGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.012, 20);

export function Chains({ lights }: { lights: SignLights }) {
    const links = useRef<THREE.InstancedMesh>(null);
    const iron = useMemo(() => ironMaterial(lights, 4, { metalness: 0.6 }), [lights]);
    useLayoutEffect(() => {
        let n = 0;
        for (const side of [-1, 1]) {
            for (let j = 0; j < LINKS; j++) {
                // Alternate links turn a quarter; none hangs quite true.
                const jitter = 0.18 * Math.sin(j * 3.7 + side * 1.3);
                dummy.position.set(side * CHAIN_X, CHAIN_BOTTOM + PITCH * (j + 0.5), MID_Z);
                dummy.rotation.set(0.05 * Math.sin(j * 1.9 + side), (j % 2) * (Math.PI / 2) + jitter, 0.04 * Math.cos(j * 2.3));
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                links.current?.setMatrixAt(n++, dummy.matrix);
            }
        }
        if (links.current) links.current.instanceMatrix.needsUpdate = true;
    }, []);
    // The top link's turn decides which way the ceiling eye faces.
    const topTurn = ((LINKS - 1) % 2) * (Math.PI / 2);
    return (
        <group>
            <instancedMesh ref={links} args={[linkGeo, iron, LINKS * 2]} frustumCulled={false} />
            {[-1, 1].map((side) => (
                <group key={side} position={[side * CHAIN_X, 0, MID_Z]}>
                    {/* Eye bolt through the box's lid. */}
                    <mesh geometry={eyeGeo} material={iron} position-y={SIGN.h / 2 + 0.03} rotation-y={Math.PI / 2} />
                    <mesh geometry={shankGeo} material={iron} position-y={SIGN.h / 2 + 0.008} />
                    <mesh geometry={nutGeo} material={iron} position-y={SIGN.h / 2 + 0.0055} rotation-y={0.3 * side} />
                    {/* Plate and eye on the ceiling. */}
                    <mesh geometry={plateGeo} material={iron} position-y={CEILING - 0.006} />
                    <mesh geometry={eyeGeo} material={iron} position-y={CEILING - 0.012 - 0.013} rotation-y={topTurn + Math.PI / 2} />
                </group>
            ))}
        </group>
    );
}
