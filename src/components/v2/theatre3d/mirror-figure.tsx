"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import { ellipsoid, loft, taperedTube } from "@/components/v2/theatre3d/mirror-geometry";

// A dark, faceless man in a long coat: Harry Haller, or whoever is looking.
// Base on the floor at y = 0, facing +Z, 1.75 m to the crown. One merged
// mesh, matte near-black, with a faint warm rim so his outline reads against
// dim lamplight without ever showing a face.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

let figureGeometry: THREE.BufferGeometry | null = null;

function buildFigure() {
    // The coat, hem to neck: full at the hem, easing in at the waist, square
    // across the chest, then the long slope of the shoulders up to the neck.
    const coat = loft(
        [
            { y: 0.035, a: 0.272, b: 0.19, z: -0.012 },
            { y: 0.16, a: 0.262, b: 0.18, z: -0.01 },
            { y: 0.45, a: 0.238, b: 0.162, z: -0.006 },
            { y: 0.75, a: 0.214, b: 0.148 },
            { y: 0.98, a: 0.198, b: 0.138, n: 2.2 },
            { y: 1.12, a: 0.2, b: 0.136, z: 0.004, n: 2.3 },
            { y: 1.25, a: 0.206, b: 0.134, z: 0.006, n: 2.5 },
            { y: 1.33, a: 0.214, b: 0.126, z: 0.004, n: 2.7 },
            { y: 1.38, a: 0.212, b: 0.116, n: 2.8 },
            { y: 1.415, a: 0.19, b: 0.104, n: 2.6 },
            { y: 1.44, a: 0.15, b: 0.09, n: 2.3 },
            { y: 1.462, a: 0.1, b: 0.076, z: 0.002 },
            { y: 1.48, a: 0.066, b: 0.064, z: 0.006 },
        ],
        28,
    );
    const neck = new THREE.CylinderGeometry(0.054, 0.062, 0.14, 12, 1);
    neck.rotateX(0.12);
    neck.translate(0, 1.52, 0.016);
    // Head: skull, a jaw slightly forward, the back of the head a little fuller, ears.
    const skull = ellipsoid(0.081, 0.104, 0.098, V(0, 1.648, 0.016), 18, 14);
    const jaw = ellipsoid(0.06, 0.062, 0.072, V(0, 1.584, 0.036), 14, 10);
    const occiput = ellipsoid(0.076, 0.08, 0.08, V(0, 1.662, -0.02), 14, 10);
    const ears = [-1, 1].map((side) => ellipsoid(0.014, 0.03, 0.02, V(side * 0.079, 1.62, 0.006), 8, 6));
    const parts = [coat, neck, skull, jaw, occiput, ...ears];
    // Sleeves start inside the shoulder, round over it, bend a touch at the elbow and end in a cuff with the hand half in it.
    for (const side of [-1, 1]) {
        const sleeve = taperedTube(
            [V(side * 0.13, 1.4, -0.006), V(side * 0.2, 1.39, -0.004), V(side * 0.236, 1.31, 0.0), V(side * 0.246, 1.12, -0.014), V(side * 0.25, 0.95, 0.01), V(side * 0.252, 0.835, 0.034)],
            (t) => (t < 0.12 ? 0.05 + t * 0.15 : 0.068 - 0.02 * t) + (t > 0.94 ? 0.003 : 0),
            32,
            12,
        );
        const hand = ellipsoid(0.026, 0.06, 0.038, V(side * 0.25, 0.79, 0.04), 10, 8);
        parts.push(sleeve, hand);
    }
    // The toes of two shoes under the hem.
    for (const side of [-1, 1]) parts.push(ellipsoid(0.05, 0.035, 0.1, V(side * 0.09, 0.035, 0.11), 10, 6));
    // Merge needs matching attributes, so drop uvs and keep positions and normals.
    const cleaned = parts.map((g) => {
        const geo = g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(geo.attributes)) if (name !== "position" && name !== "normal") geo.deleteAttribute(name);
        return geo;
    });
    const merged = mergeGeometries(cleaned, false)!;
    merged.computeBoundingSphere();
    return merged;
}

/** The figure's geometry, built once and shared. */
export function getFigureGeometry() {
    if (!figureGeometry) figureGeometry = buildFigure();
    return figureGeometry;
}

/** Matte near-black cloth with a warm fresnel rim. `rim` scales the rim's brightness. */
export function makeFigureMaterial(rim = 1) {
    const uniforms = { uRim: { value: rim }, uRimColor: { value: new THREE.Color(PALETTE.lamp) } };
    const mat = new THREE.MeshStandardMaterial({ color: "#0c0a09", roughness: 0.88, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;")
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
                // light grazing the edges of the cloth, only right at the outline
                float rimF = smoothstep(0.45, 1.0, 1.0 - saturate(dot(normal, normalize(vViewPosition))));
                totalEmissiveRadiance += uRimColor * uRim * 0.2 * rimF * rimF;`,
            );
    };
    mat.userData.rim = uniforms.uRim;
    return mat;
}

export type SilhouetteProps = JSX.IntrinsicElements["group"] & {
    /** Brightness of the warm rim along the outline (1 is the default, 0 is a flat black shape). */
    rim?: number;
    /** Put the figure on this layer only (the mirror uses MIRROR_LAYER). Default: layer 0, like everything else. */
    layer?: number;
};

/** A dark faceless man in a long coat, base at y = 0, facing +Z, about 1.75 m tall. Not clickable. */
export function Silhouette({ rim = 1, layer, ...props }: SilhouetteProps) {
    const mesh = useRef<THREE.Mesh>(null);
    const geometry = getFigureGeometry();
    const material = useMemo(() => makeFigureMaterial(), []);

    useLayoutEffect(() => {
        (material.userData.rim as { value: number }).value = rim;
    }, [material, rim]);

    useLayoutEffect(() => {
        if (mesh.current && layer !== undefined) mesh.current.layers.set(layer);
    }, [layer]);

    useLayoutEffect(() => () => material.dispose(), [material]);

    return (
        <group {...props}>
            <mesh ref={mesh} geometry={geometry} material={material} raycast={() => null} />
        </group>
    );
}
