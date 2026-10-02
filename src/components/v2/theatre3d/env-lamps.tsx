"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import { flicker, srgbLikeFiber8 } from "@/components/v2/theatre3d/textures";
import { envTextures, smoothstep } from "@/components/v2/theatre3d/env-textures";
import { LAMP_OUT, LAMP_Y, getLamps, getShell, type Lamp } from "@/components/v2/theatre3d/env-shell";

// The wall sconces: the lamp driver (power-on sputter and flicker, worked out
// once a frame), the real lights, the stand-in light for lamps without one,
// and everything that glows: the flames, the frosted chimneys, a halo each.

/** How bright every lamp is right now. Written by useLampDriver, read by anything that glows. */
export interface LampState {
    lamps: Lamp[];
    /** 0..1, how far on it is (after the sputter). */
    level: Float32Array;
    /** level times flicker: what you see. */
    glow: Float32Array;
    /** Clock time it last came on, or -1 while off. */
    onAt: Float32Array;
    first: boolean;
}

const hash = (n: number) => {
    const x = Math.sin(n) * 43758.5453;
    return x - Math.floor(x);
};

/** An old lamp catching: on, off, on, off, then warming up to full. t is seconds since it was switched on. */
function sputter(t: number, seed: number) {
    const x = t / (0.8 + hash(seed * 7.1) * 0.5);
    if (x < 0.07) return 0.9;
    if (x < 0.2) return 0.04;
    if (x < 0.27) return 0.6;
    if (x < 0.42) return 0.07;
    if (x < 0.8) return 0.3 + 0.7 * smoothstep(0.42, 0.8, x);
    return 1;
}

/** A failing bulb: every so often a burst of stutters. */
function stutter(t: number, seed: number) {
    const period = 6.5 + (seed % 3);
    const k = Math.floor(t / period);
    const h = hash(k * 12.9898 + seed * 78.233);
    if (h > 0.6) return 1;
    const local = t - k * period - h * (period - 1.4);
    if (local < 0 || local > 1) return 1;
    return Math.sin(local * 43 + seed + Math.sin(local * 17) * 2) > 0.15 ? 0.1 : 0.9;
}

export function useLampDriver(power: number): LampState {
    const state = useMemo<LampState>(() => {
        const lamps = getLamps();
        const n = lamps.length;
        return { lamps, level: new Float32Array(n), glow: new Float32Array(n), onAt: new Float32Array(n).fill(-1), first: true };
    }, []);
    const powerRef = useRef(power);
    powerRef.current = power;
    // Runs before everything else each frame, so lights and glows read this frame's values.
    useFrame(({ clock }, dt) => {
        const t = clock.elapsedTime;
        const p = powerRef.current;
        for (let i = 0; i < state.lamps.length; i++) {
            const lamp = state.lamps[i];
            const want = p >= lamp.order;
            // already lit when we arrive: no sputter
            if (want && state.onAt[i] === -1) state.onAt[i] = state.first ? -1000 : t;
            if (!want) state.onAt[i] = -1;
            state.level[i] = want ? sputter(t - state.onAt[i], lamp.seed) : THREE.MathUtils.damp(state.level[i], 0, 14, dt);
            let f = 1 + (flicker(t, lamp.seed) - 1) * 0.6;
            if (lamp.faulty) f *= lamp.side === "outer" ? stutter(t, lamp.seed) : 0.55 * (0.8 + 0.2 * stutter(t * 1.7, lamp.seed));
            state.glow[i] = state.level[i] * f;
        }
        state.first = false;
    }, -1);
    return state;
}

/** Candela per lamp at full power (a phone has fewer lights, so each reaches a little further). */
const INTENSITY = { high: 7, low: 10 };
const hasLight = (l: Lamp, high: boolean) => (high ? l.real : l.realLow);

/** Uniforms for the stand-in light, shared by every patched material of one Environment. */
export interface StandIn {
    uStandPos: { value: THREE.Vector3[] };
    uStandGlow: { value: Float32Array };
    uStandColor: { value: THREE.Color };
}

/**
 * Only some lamps get a real PointLight. The rest light the shell through
 * this: a plain diffuse point light worked out in the shell's own shaders,
 * in world space so it also holds in the floor's reflection pass.
 */
export function useStandIn(state: LampState, quality: "high" | "low"): StandIn {
    const high = quality === "high";
    const u = useMemo<StandIn>(
        () => ({
            uStandPos: { value: state.lamps.map((l) => l.light.clone()) },
            uStandGlow: { value: new Float32Array(state.lamps.length) },
            uStandColor: { value: new THREE.Color(PALETTE.lamp) },
        }),
        [state],
    );
    useFrame(() => {
        const g = u.uStandGlow.value;
        const k = high ? INTENSITY.high : INTENSITY.low;
        for (let i = 0; i < g.length; i++) {
            const l = state.lamps[i];
            g[i] = hasLight(l, high) ? 0 : k * l.strength * state.glow[i];
        }
    });
    return u;
}

/** Teach a lit material about the stand-in lamps (same falloff as a PointLight with decay 2, distance 7). */
export function withStandIn(mat: THREE.Material, u: StandIn, key: string) {
    if (mat.userData.standIn) return;
    mat.userData.standIn = true;
    const n = u.uStandGlow.value.length;
    const prev = mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
        prev(shader, renderer);
        Object.assign(shader.uniforms, u);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vStandWorld;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvStandWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nvarying vec3 vStandWorld;\nuniform vec3 uStandPos[${n}];\nuniform float uStandGlow[${n}];\nuniform vec3 uStandColor;`)
            .replace(
                "#include <lights_fragment_end>",
                `#include <lights_fragment_end>
                {
                    vec3 standN = inverseTransformDirection(geometryNormal, viewMatrix);
                    float stand = 0.0;
                    for (int i = 0; i < ${n}; i++) {
                        vec3 L = uStandPos[i] - vStandWorld;
                        float d2 = max(dot(L, L), 0.04);
                        float w = saturate(1.0 - d2 * d2 / 2401.0);
                        stand += uStandGlow[i] * max(dot(standN, L * inversesqrt(d2)), 0.0) * w * w / d2;
                    }
                    reflectedLight.directDiffuse += stand * uStandColor * BRDF_Lambert(material.diffuseColor);
                }`,
            );
    };
    mat.customProgramCacheKey = () => `env-stand-in-${key}`;
    mat.needsUpdate = true;
}

const WARM = new THREE.Color(PALETTE.lamp);
const FLAME = new THREE.Color("#ffcf9a");
let quad: THREE.PlaneGeometry | null = null;
const getQuad = () => (quad ??= new THREE.PlaneGeometry(1, 1));

export const Lamps = memo(function Lamps({ state, quality }: { state: LampState; quality: "high" | "low" }) {
    const shell = getShell();
    const n = state.lamps.length;
    const high = quality === "high";
    const lit = useMemo(() => state.lamps.flatMap((l, i) => (hasLight(l, high) ? [i] : [])), [state, high]);
    const intensity = high ? INTENSITY.high : INTENSITY.low;
    const lights = useRef<(THREE.PointLight | null)[]>([]);
    const flames = useRef<THREE.InstancedMesh>(null);
    const glass = useRef<THREE.InstancedMesh>(null);
    const halos = useRef<THREE.InstancedMesh>(null);
    const v = useMemo(() => ({ m: new THREE.Matrix4(), m2: new THREE.Matrix4(), c: new THREE.Color(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

    useLayoutEffect(() => {
        const { m, m2, c } = v;
        c.setRGB(0, 0, 0);
        state.lamps.forEach((lamp, i) => {
            m.copy(lamp.basis).multiply(m2.makeTranslation(0, LAMP_Y, LAMP_OUT));
            flames.current?.setMatrixAt(i, m);
            glass.current?.setMatrixAt(i, m);
            halos.current?.setMatrixAt(i, m);
            flames.current?.setColorAt(i, c);
            glass.current?.setColorAt(i, c);
            halos.current?.setColorAt(i, c);
        });
        for (const im of [flames.current, glass.current, halos.current]) {
            if (!im) continue;
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
        }
    }, [state, v]);

    useFrame(({ camera }) => {
        const { m, c, p, s } = v;
        const f = flames.current;
        const g = glass.current;
        const h = halos.current;
        if (!f || !g || !h) return;
        s.setScalar(0.62);
        for (let i = 0; i < n; i++) {
            const glow = state.glow[i];
            f.setColorAt(i, c.copy(FLAME).multiplyScalar(0.03 + 7 * glow));
            g.setColorAt(i, c.copy(WARM).multiplyScalar(0.015 + 1.3 * glow));
            // halo: face the camera, nudged toward it so it clears the glass
            p.subVectors(camera.position, state.lamps[i].core).normalize().multiplyScalar(0.1).add(state.lamps[i].core);
            h.setMatrixAt(i, m.compose(p, camera.quaternion, s));
            h.setColorAt(i, c.copy(WARM).multiplyScalar(0.32 * glow));
        }
        for (let k = 0; k < lit.length; k++) {
            const l = lights.current[k];
            if (l) l.intensity = intensity * state.lamps[lit[k]].strength * state.glow[lit[k]];
        }
        f.instanceColor!.needsUpdate = true;
        g.instanceColor!.needsUpdate = true;
        h.instanceColor!.needsUpdate = true;
        h.instanceMatrix.needsUpdate = true;
    });

    return (
        <group>
            {lit.map((i, k) => (
                <pointLight
                    key={i}
                    ref={(l) => {
                        lights.current[k] = l;
                    }}
                    position={state.lamps[i].light}
                    color={PALETTE.lamp}
                    intensity={0}
                    distance={high ? 7 : 8.5}
                    decay={2}
                />
            ))}
            <instancedMesh ref={flames} args={[shell.flame, undefined, n]} frustumCulled={false}>
                <meshBasicMaterial toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={glass} args={[shell.chimney, undefined, n]} frustumCulled={false} renderOrder={6}>
                <meshBasicMaterial map={envTextures.chimney()} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
            </instancedMesh>
            <instancedMesh ref={halos} args={[getQuad(), undefined, n]} frustumCulled={false} renderOrder={7}>
                <meshBasicMaterial alphaMap={srgbLikeFiber8(envTextures.glow())} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </instancedMesh>
        </group>
    );
});
