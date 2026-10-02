'use client';

import { Suspense, lazy, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { DoorProps } from "@/components/v2/theatre3d/door";
import { CAMERA, PALETTE, onArc, outward, tangent } from "@/components/v2/theatre3d/layout";

// Each part loads on its own, so one half-built part can't break the others.
const TheatreDoor = lazy(() => import("@/components/v2/theatre3d/door").then((m) => ({ default: m.TheatreDoor })));
const Environment = lazy(() => import("@/components/v2/theatre3d/environment").then((m) => ({ default: m.Environment })));
const Marquee = lazy(() => import("@/components/v2/theatre3d/marquee").then((m) => ({ default: m.Marquee })));
const SteppenwolfMirror = lazy(() => import("@/components/v2/theatre3d/mirror").then((m) => ({ default: m.SteppenwolfMirror })));

// Dev-only workbench: /theatre-lab?part=door|env|marquee|mirror
// Extra params: door → &state=idle|hover|visited|open (one door), or none for
// all four states side by side. env → &s=0..1 &look=ahead|outer|inner|up
// &quality=low. marquee/env → &power=0..1. Any part → &fx=0 turns bloom off.

type Part = "door" | "env" | "marquee" | "mirror";

function useParams() {
    const [p, setP] = useState<URLSearchParams | null>(null);
    useEffect(() => setP(new URLSearchParams(window.location.search)), []);
    return p;
}

export function TheatreLab() {
    const params = useParams();
    if (!params) return null;
    const part = (params.get("part") ?? "door") as Part;

    // env: &s=<0..1> walks the camera along the corridor; &look=ahead|outer|inner|up turns it.
    const at = Number(params.get("s") ?? CAMERA.from);
    const look = params.get("look") ?? "ahead";
    const start = onArc(at, CAMERA.radius, CAMERA.eye);
    const target = start.clone();
    if (look === "outer") target.add(outward(at).multiplyScalar(3));
    else if (look === "inner") target.add(outward(at).multiplyScalar(-3));
    else if (look === "up") target.add(tangent(at).multiplyScalar(2)).setY(4);
    else target.add(tangent(at).multiplyScalar(4));
    const power = Number(params.get("power") ?? 1);
    const fx = params.get("fx") !== "0";
    const views: Record<Part, { pos: [number, number, number]; target: [number, number, number] }> = {
        door: { pos: [0, 1.7, 5.2], target: [0, 1.6, 0] },
        marquee: { pos: [0, -0.4, 4.2], target: [0, 0, 0] },
        mirror: { pos: [0, 1.62, 4.5], target: [0, 1.6, 0] },
        env: { pos: [start.x, start.y, start.z], target: [target.x, target.y, target.z] },
    };
    const v = views[part] ?? views.door;

    return (
        <div className="fixed inset-0 z-[100] bg-black">
            <Canvas
                camera={{ position: v.pos, fov: 55, near: 0.05, far: 80 }}
                dpr={[1, 1.5]}
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
            >
                <color attach="background" args={[PALETTE.void]} />
                {part !== "marquee" && <fogExp2 attach="fog" args={[PALETTE.fog, 0.07]} />}
                <Suspense fallback={null}>
                    {part === "door" && <DoorBench state={params.get("state") as DoorProps["state"] | null} />}
                    {part === "marquee" && <Marquee power={power} />}
                    {part === "mirror" && <MirrorBench />}
                    {part === "env" && <Environment power={power} quality={params.get("quality") === "low" ? "low" : "high"} />}
                </Suspense>
                <OrbitControls target={v.target} />
                {fx && (
                    <EffectComposer>
                        <Bloom mipmapBlur luminanceThreshold={0.7} intensity={1.1} radius={0.7} />
                        <Vignette darkness={0.8} offset={0.25} />
                    </EffectComposer>
                )}
            </Canvas>
        </div>
    );
}

function DoorBench({ state }: { state: DoorProps["state"] | null }) {
    const states: DoorProps["state"][] = state ? [state] : ["idle", "hover", "visited", "open"];
    return (
        <>
            <ambientLight intensity={0.15} />
            <pointLight position={[0, 3.5, 3]} intensity={40} color={PALETTE.lamp} distance={14} />
            {/* a wall and a floor to sit against */}
            <mesh position={[0, 2.1, -0.01]}>
                <planeGeometry args={[12, 4.2]} />
                <meshStandardMaterial color="#1a110d" roughness={0.9} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0, 2]}>
                <planeGeometry args={[12, 4]} />
                <meshStandardMaterial color="#120b08" roughness={0.6} />
            </mesh>
            {states.map((s, i) => (
                <group key={s} position={[(i - (states.length - 1) / 2) * 2.5, 0, 0]}>
                    <TheatreDoor index={i} plate={["The first hack", "Why the moon followed me home", "One more photo", "All of you, and none"][i]} state={s} />
                </group>
            ))}
        </>
    );
}

function MirrorBench() {
    // Something to reflect: a floor, a lamp, coloured columns behind the viewer.
    return (
        <>
            <ambientLight intensity={0.2} />
            <pointLight position={[0, 3, 3]} intensity={20} color={PALETTE.lamp} distance={14} />
            <mesh position={[0, 2.1, -0.02]}>
                <planeGeometry args={[8, 4.2]} />
                <meshStandardMaterial color="#1a110d" roughness={0.9} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0, 3]}>
                <planeGeometry args={[8, 8]} />
                <meshStandardMaterial color="#20140e" roughness={0.5} />
            </mesh>
            {[-2, -0.7, 0.7, 2].map((x, i) => (
                <mesh key={x} position={[x, 1.2, 6]}>
                    <boxGeometry args={[0.5, 2.4, 0.5]} />
                    <meshStandardMaterial color={["#7a2a1a", "#2a4a6a", "#6a5a2a", "#3a6a3a"][i]} />
                </mesh>
            ))}
            <SteppenwolfMirror />
        </>
    );
}
