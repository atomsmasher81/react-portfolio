"use client";

import { memo, useCallback, useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { envTextures } from "@/components/v2/theatre3d/env-textures";
import { srgbLikeFiber8 } from "@/components/v2/theatre3d/textures";
import { getShell } from "@/components/v2/theatre3d/env-shell";
import { Lamps, useLampDriver, useStandIn, withStandIn, type StandIn } from "@/components/v2/theatre3d/env-lamps";
import { Dust, GroundFog } from "@/components/v2/theatre3d/env-atmosphere";

// The Magic Theatre's corridor: the horseshoe of old wallpapered walls and
// panelling, beams overhead, polished boards and a worn runner underfoot, a
// closed pair of doors behind you and a dark panelled wall at the far end, all
// lit by flickering wall sconces. The doors, the marquee and the mirror are
// placed by the scene.
//
// `power` (0..1) is how far the lights have come back on: each lamp catches
// with a sputter as it passes its own threshold. `quality` "low" is for phones
// and the keyhole: no floor reflections, four real lights, less dust and fog.
// Lamps without a real light still light the walls and floor around them,
// through a cheap stand-in worked out in the shell's own shaders.

export function Environment({ power = 1, quality = "high" }: { power?: number; quality?: "high" | "low" }) {
    const lamps = useLampDriver(power);
    const standIn = useStandIn(lamps, quality);
    const high = quality === "high";
    return (
        <group>
            <Shell high={high} standIn={standIn} />
            <Lamps state={lamps} quality={quality} />
            <GroundFog layers={high ? 3 : 1} />
            <Dust state={lamps} count={high ? 600 : 200} />
        </group>
    );
}

const BLUR: [number, number] = [300, 100];

/**
 * drei's reflector only tints the floor's colour with what it reflects, so a
 * lamp's reflection vanishes wherever no light falls on the boards. Add some
 * of it back as a gloss that grows at grazing angles, like old varnish.
 */
function glossy(mat: THREE.Material) {
    if (mat.userData.glossy) return;
    mat.userData.glossy = true;
    const base = mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
        base(shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace(
            "diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);",
            `$&
            float sheen = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 5.0);
            totalEmissiveRadiance += merge.rgb * (0.05 + 0.95 * sheen) * (1.0 - reflectorRoughnessFactor) * GLOSS;`,
        );
        shader.fragmentShader = "#define GLOSS 1.4\n" + shader.fragmentShader;
    };
}
const NORMAL_SOFT = new THREE.Vector2(0.7, 0.7);
const PAPER_SHEEN = new THREE.Color("#e0987a");

// Everything that doesn't move. Memoised so the power ramp doesn't re-render it.
const Shell = memo(function Shell({ high, standIn }: { high: boolean; standIn: StandIn }) {
    const shell = getShell();
    // Ref callbacks that patch each lit material once, before it first compiles.
    const lit = useCallback(
        (m: THREE.Material | null) => {
            if (m) withStandIn(m, standIn, "lit");
        },
        [standIn],
    );
    const floor = useCallback(
        (m: THREE.Material | null) => {
            if (!m) return;
            glossy(m);
            withStandIn(m, standIn, "floor");
        },
        [standIn],
    );
    // all handed to the materials below as props (textures.ts: srgbLikeFiber8)
    const t = useMemo(
        () => srgbLikeFiber8({
            paper: envTextures.wallpaper(),
            wood: envTextures.wood(),
            floor: envTextures.floor(),
            beam: envTextures.beam(),
            plaster: envTextures.plaster(),
            painting: envTextures.painting(),
            carpet: envTextures.carpet(),
            fringe: envTextures.fringe(),
            cobweb: envTextures.cobweb(),
            iron: envTextures.iron(),
            tarnish: envTextures.tarnish(),
            decal: envTextures.decal(),
        }),
        [],
    );
    return (
        <group>
            <mesh geometry={shell.paper}>
                {/* paper and flock: a soft, warm sheen rather than a white one */}
                <meshPhysicalMaterial
                    ref={lit}
                    {...t.paper}
                    normalScale={NORMAL_SOFT}
                    vertexColors
                    roughness={1}
                    metalness={0}
                    specularIntensity={0.45}
                    specularColor={PAPER_SHEEN}
                />
            </mesh>
            <mesh geometry={shell.wood}>
                <meshStandardMaterial ref={lit} {...t.wood} vertexColors roughness={1} metalness={0} />
            </mesh>
            <mesh geometry={shell.beams}>
                <meshStandardMaterial ref={lit} map={t.beam.map} normalMap={t.beam.normalMap} color="#d8cfc8" roughness={0.88} metalness={0} />
            </mesh>
            <mesh geometry={shell.ceiling}>
                <meshStandardMaterial ref={lit} map={t.plaster.map} normalMap={t.plaster.normalMap} vertexColors roughness={0.96} metalness={0} />
            </mesh>
            <mesh geometry={shell.floor} rotation-x={-Math.PI / 2}>
                {high ? (
                    <MeshReflectorMaterial
                        ref={floor}
                        map={t.floor.map}
                        roughnessMap={t.floor.roughnessMap}
                        normalMap={t.floor.normalMap}
                        vertexColors
                        roughness={1}
                        metalness={0}
                        mirror={0.4}
                        blur={BLUR}
                        resolution={512}
                        mixBlur={2.5}
                        mixStrength={1.5}
                        mixContrast={1}
                        depthScale={1.2}
                        minDepthThreshold={0.4}
                        maxDepthThreshold={1.4}
                    />
                ) : (
                    <meshStandardMaterial ref={lit} {...t.floor} vertexColors roughness={1} metalness={0} />
                )}
            </mesh>
            <mesh geometry={shell.runner}>
                <meshStandardMaterial ref={lit} map={t.carpet} vertexColors alphaTest={0.5} roughness={1} metalness={0} />
            </mesh>
            <mesh geometry={shell.fringe}>
                <meshStandardMaterial map={t.fringe} alphaTest={0.5} roughness={1} metalness={0} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={shell.iron}>
                <meshStandardMaterial ref={lit} map={t.iron} vertexColors roughness={0.86} metalness={0.45} />
            </mesh>
            <mesh geometry={shell.gilt}>
                <meshStandardMaterial ref={lit} map={t.tarnish} vertexColors roughness={0.55} metalness={0.8} />
            </mesh>
            <mesh geometry={shell.canvas}>
                <meshStandardMaterial ref={lit} {...t.painting} roughness={1} metalness={0} />
            </mesh>
            <mesh geometry={shell.grime} renderOrder={1}>
                <meshBasicMaterial color="#000" alphaMap={t.decal} vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </mesh>
            <mesh geometry={shell.webs} renderOrder={5}>
                <meshStandardMaterial map={t.cobweb} color="#a9a39b" transparent alphaTest={0.02} depthWrite={false} side={THREE.DoubleSide} roughness={1} metalness={0} />
            </mesh>
        </group>
    );
});
