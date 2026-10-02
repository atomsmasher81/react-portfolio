"use client";

import { Suspense, lazy, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA, CORRIDOR, MARQUEE_S, MARQUEE_Y, PALETTE, onArc, yawFacingBack } from "@/components/v2/theatre3d/layout";

// Dev only. Shows the marquee as the theatre's opening shot sees it, inside
// the lab: the whole world is moved so that the lab's fixed camera sits where
// the theatre's camera starts (s = CAMERA.from, looking up at the sign, as the
// scene's Rig does on arrival). Params: &mqenv=1 adds the corridor, &mqfov=70
// matches the portrait lens (56 otherwise).

const Environment = lazy(() => import("@/components/v2/theatre3d/environment").then((m) => ({ default: m.Environment })));

export function MarqueeCheck({ power, children }: { power: number; children: ReactNode }) {
    const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
    const scene = useThree((s) => s.scene);
    const [params] = useState(() => new URLSearchParams(window.location.search));
    const env = params.get("mqenv") === "1";

    const world = useMemo(() => {
        const start = new THREE.PerspectiveCamera();
        onArc(CAMERA.from, CAMERA.radius, CAMERA.eye, start.position);
        const look = onArc(CAMERA.from + 0.07, CORRIDOR.radius + 0.35, 1.5).lerp(onArc(MARQUEE_S, CORRIDOR.radius, MARQUEE_Y - 0.2), 0.85);
        start.lookAt(look);
        start.updateMatrixWorld();
        camera.updateMatrixWorld();
        return camera.matrixWorld.clone().multiply(start.matrixWorld.clone().invert());
    }, [camera]);

    useLayoutEffect(() => {
        camera.fov = Number(params.get("mqfov") ?? 56);
        camera.updateProjectionMatrix();
        scene.fog = new THREE.FogExp2(PALETTE.fog, 0.07);
        return () => {
            scene.fog = null;
        };
    }, [camera, scene, params]);

    return (
        <group matrixAutoUpdate={false} matrix={world}>
            <hemisphereLight args={["#3a2418", "#080404", 0.12 * power]} />
            {env && (
                <Suspense fallback={null}>
                    <Environment power={power} />
                </Suspense>
            )}
            <group position={onArc(MARQUEE_S, CORRIDOR.radius, MARQUEE_Y)} rotation-y={yawFacingBack(MARQUEE_S)}>
                {children}
            </group>
        </group>
    );
}
