"use client";

import { useLayoutEffect, useMemo } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import { envTextures } from "@/components/v2/theatre3d/env-textures";
import { LAMP_OUT, LAMP_Y, getLamps, getShell, type Lamp } from "@/components/v2/theatre3d/env-shell";

// The mirror lies about a lamp. In the room it gutters like the rest; in the
// glass it burns steadily, a touch brighter, and warms the wall beside it.
// Everything here lives on the mirror's layer, so only the reflection sees it.

/**
 * Which lamp to lie about. The corridor bends so hard that the glass only
 * ever shows its last few metres, and the one lamp it shows from the end of
 * the walk is the outer one at s = 0.93, beside you. A faulty lamp is used
 * instead if one is ever moved onto that stretch.
 */
export function lampToLieAbout(): Lamp {
    const lamps = getLamps();
    return lamps.find((l) => l.faulty && l.side !== "end" && l.s >= 0.86) ?? lamps.find((l) => l.side === "outer" && l.s >= 0.93) ?? lamps[0];
}

const WARM = new THREE.Color(PALETTE.lamp);
const FLAME = new THREE.Color("#ffcf9a");

export function MirrorLamp({ layer }: { layer: number }) {
    const scene = useThree((s) => s.scene);
    const lamp = useMemo(lampToLieAbout, []);
    const shell = getShell();

    const parts = useMemo(() => {
        const at = new THREE.Matrix4().copy(lamp.basis).multiply(new THREE.Matrix4().makeTranslation(0, LAMP_Y, LAMP_OUT));
        const flame = new THREE.Mesh(shell.flame, new THREE.MeshBasicMaterial({ color: FLAME.clone().multiplyScalar(8), toneMapped: false }));
        const chimney = new THREE.Mesh(
            shell.chimney,
            new THREE.MeshBasicMaterial({ map: envTextures.chimney(), color: WARM.clone().multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
        );
        chimney.renderOrder = 6;
        const halo = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ alphaMap: envTextures.glow(), color: WARM.clone().multiplyScalar(0.45), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
        );
        halo.renderOrder = 7;
        // a warm wash on the wall around it, as if its light were steady there too
        const wash = new THREE.Mesh(
            new THREE.PlaneGeometry(2.6, 2.4),
            new THREE.MeshBasicMaterial({ alphaMap: envTextures.glow(), color: WARM.clone().multiplyScalar(0.07), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
        );
        wash.renderOrder = 5;
        for (const m of [flame, chimney]) {
            m.matrixAutoUpdate = false;
            m.matrix.copy(at);
        }
        wash.matrixAutoUpdate = false;
        wash.matrix.copy(lamp.basis).multiply(new THREE.Matrix4().makeTranslation(0, LAMP_Y - 0.3, 0.02));
        // the halo turns to whichever camera draws it: here, only ever the mirror's
        const p = new THREE.Vector3();
        const s = new THREE.Vector3(0.7, 0.7, 0.7);
        halo.matrixAutoUpdate = false;
        halo.matrixWorldAutoUpdate = false;
        halo.onBeforeRender = (_r, _s, camera) => {
            p.copy(camera.position).sub(lamp.core).normalize().multiplyScalar(0.1).add(lamp.core);
            halo.matrixWorld.compose(p, camera.quaternion, s);
        };
        const group = new THREE.Group();
        group.add(flame, chimney, halo, wash);
        for (const m of [flame, chimney, halo, wash]) {
            m.layers.set(layer);
            m.frustumCulled = false;
        }
        return { group, flame, halo };
    }, [lamp, shell, layer]);

    useLayoutEffect(
        () => () => {
            parts.group.traverse((o) => {
                if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
            });
            (parts.halo.geometry as THREE.BufferGeometry).dispose();
        },
        [parts],
    );

    // it breathes very slightly, the way a flame does, but never gutters
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        (parts.flame.material as THREE.MeshBasicMaterial).color.copy(FLAME).multiplyScalar(8 * (1 + 0.025 * Math.sin(t * 2.1) + 0.015 * Math.sin(t * 5.3)));
    });

    return createPortal(<primitive object={parts.group} />, scene);
}
