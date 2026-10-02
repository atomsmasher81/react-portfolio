"use client";

import { memo, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CORRIDOR, INNER, OUTER, metres, onArc } from "@/components/v2/theatre3d/layout";
import { rng } from "@/components/v2/theatre3d/textures";
import { envTextures } from "@/components/v2/theatre3d/env-textures";
import { Mesher, ringFrame, sheet } from "@/components/v2/theatre3d/env-geometry";
import type { LampState } from "@/components/v2/theatre3d/env-lamps";

// The air in the corridor: dust drifting through it, catching the light near
// the lamps, and a low fog creeping along the floor.

/* ---------------------------------------------------------------- dust */

const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixel;
uniform vec3 uLamp[NLAMPS];
uniform float uGlow[NLAMPS];
attribute vec4 aSeed; // phase, size (m), drift speed, glint rate
varying float vBright;
#include <fog_pars_vertex>
void main() {
    vec3 p = position;
    float t = uTime * aSeed.z;
    float ph = aSeed.x * 6.2832;
    p.x += sin(t * 0.31 + ph) * 0.35 + sin(t * 0.13 + ph * 2.7) * 0.2;
    p.y += sin(t * 0.23 + ph * 1.7) * 0.22 + sin(t * 0.07 + ph * 3.1) * 0.15;
    p.z += cos(t * 0.27 + ph * 3.7) * 0.35 + sin(t * 0.11 + ph * 0.8) * 0.2;
    // lit by the lamps nearby
    float b = 0.012;
    for (int i = 0; i < NLAMPS; i++) {
        vec3 d = p - uLamp[i];
        b += uGlow[i] / (1.0 + dot(d, d) * 2.4);
    }
    // they glint as they turn
    float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.5 + aSeed.w * 1.6) + ph * 9.0), 3.0);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float size = aSeed.y * uPixel / -mvPosition.z;
    gl_PointSize = max(size, 1.0);
    // too small to see: fade rather than shimmer
    vBright = b * tw * min(1.0, size * size);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vBright;
#include <fog_pars_fragment>
void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c) * 4.0;
    if (r2 > 1.0) discard;
    float a = 1.0 - r2;
    vec3 col = uColor * vBright * a * a;
    #ifdef USE_FOG
        #ifdef FOG_EXP2
            col *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #else
            col *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
        #endif
    #endif
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

const dustCache = new Map<number, THREE.BufferGeometry>();

/** Motes: half spread through the corridor, half gathered in the air round the lamps. */
function dustGeometry(count: number, state: LampState) {
    const cached = dustCache.get(count);
    if (cached) return cached;
    const r = rng(501 + count);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        if (i % 2 === 0) {
            const s = CORRIDOR.start + 0.01 + r() * (CORRIDOR.end - CORRIDOR.start - 0.02);
            onArc(s, INNER + 0.3 + r() * (OUTER - INNER - 0.6), 0.15 + r() * 3.4, p);
        } else {
            const lamp = state.lamps[Math.floor(r() * state.lamps.length)];
            p.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(2.2).add(lamp.light);
            p.y = Math.min(3.7, Math.max(0.2, p.y));
            // keep inside the walls
            const rad = Math.hypot(p.x, p.z);
            const k = Math.min(OUTER - 0.3, Math.max(INNER + 0.3, rad)) / rad;
            p.x *= k;
            p.z *= k;
        }
        p.toArray(pos, i * 3);
        seed[i * 4] = r();
        seed[i * 4 + 1] = 0.005 + r() * r() * 0.012;
        seed[i * 4 + 2] = 0.5 + r() * 0.8;
        seed[i * 4 + 3] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    dustCache.set(count, g);
    return g;
}

export const Dust = memo(function Dust({ state, count }: { state: LampState; count: number }) {
    const geometry = useMemo(() => dustGeometry(count, state), [count, state]);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                defines: { NLAMPS: state.lamps.length },
                uniforms: {
                    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
                    uTime: { value: 0 },
                    uPixel: { value: 600 },
                    uLamp: { value: state.lamps.map((l) => l.core.clone()) },
                    uGlow: { value: new Float32Array(state.lamps.length) },
                    uColor: { value: new THREE.Color("#ffc896").multiplyScalar(1.6) },
                },
                vertexShader: DUST_VERT,
                fragmentShader: DUST_FRAG,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: true,
            }),
        [state],
    );
    useEffect(() => () => material.dispose(), [material]);
    useFrame(({ clock, camera, size, viewport }) => {
        const u = material.uniforms;
        u.uTime.value = clock.elapsedTime;
        const fov = (camera as THREE.PerspectiveCamera).fov ?? 55;
        u.uPixel.value = (size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
        (u.uGlow.value as Float32Array).set(state.glow);
    });
    return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={8} />;
});

/* ----------------------------------------------------------- ground fog */

let fogGeo: THREE.BufferGeometry | null = null;
/** One sheet of floor-wide fog along the whole corridor, at height 0 (placed per layer). */
function fogSheet() {
    if (fogGeo) return fogGeo;
    const m = new Mesher();
    const len = metres(CORRIDOR.end - CORRIDOR.start);
    sheet(m, ringFrame(CORRIDOR.start, CORRIDOR.radius), 0, len, [0, (OUTER - INNER) / 2, OUTER - INNER], 0, {
        step: 0.5,
        uv: (u, y) => [u / 7, y / 3.4],
    });
    fogGeo = m.geometry();
    return fogGeo;
}

const FOG_TINT = "#9a887c";

const LAYERS = [
    { y: 0.07, opacity: 0.22, speed: 0.01, repeat: [1, 1] },
    { y: 0.22, opacity: 0.1, speed: -0.007, repeat: [0.7, 1.3] },
    { y: 0.42, opacity: 0.05, speed: 0.005, repeat: [0.5, 0.8] },
];

/** Low fog: a few soft sheets of noise near the floor, each drifting its own way, lit by the lamps. */
export const GroundFog = memo(function GroundFog({ layers }: { layers: number }) {
    const geometry = fogSheet();
    const maps = useMemo(
        () =>
            LAYERS.slice(0, layers).map((l, i) => {
                const t = envTextures.fog().clone();
                t.repeat.set(l.repeat[0], l.repeat[1]);
                t.offset.set(i * 0.37, i * 0.21);
                return t;
            }),
        [layers],
    );
    useEffect(() => () => maps.forEach((t) => t.dispose()), [maps]);
    useFrame((_, dt) => {
        for (let i = 0; i < maps.length; i++) {
            const t = maps[i];
            t.offset.x = (t.offset.x + dt * LAYERS[i].speed) % 1;
            t.offset.y = (t.offset.y + dt * LAYERS[i].speed * 0.3) % 1;
        }
    });
    return (
        <group>
            {maps.map((map, i) => (
                <mesh key={i} geometry={geometry} position-y={LAYERS[i].y} renderOrder={3 + i}>
                    <meshLambertMaterial color={FOG_TINT} alphaMap={map} transparent opacity={LAYERS[i].opacity} depthWrite={false} />
                </mesh>
            ))}
        </group>
    );
});
