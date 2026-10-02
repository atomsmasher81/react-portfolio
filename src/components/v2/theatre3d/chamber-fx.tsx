"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flicker, rng } from "@/components/v2/theatre3d/textures";
import { chamberTextures } from "@/components/v2/theatre3d/chamber-textures";
import { ROOM, type CandleSpec, flameAt } from "@/components/v2/theatre3d/chamber-geometry";

// What moves in the chamber: the candle flames and their halos, the lights
// they cast (flickering, and all leaning together when a draught comes under
// the door), dust turning in the air, and a shaft of cold light falling from
// the grate in the vault.

/* ---------------------------------------------------------- the driver */

export interface LightSpec {
    pos: [number, number, number];
    /** candela at full power */
    k: number;
    seed: number;
    /** where its light gives out (m) */
    dist: number;
}

/** How bright everything is this frame: written once a frame, read by the lights, flames and dust. */
export interface Flame {
    power: number;
    /** 0..1: a draught under the door, every so often */
    gust: number;
    /** each light's flicker × power × gust */
    level: Float32Array;
    lights: LightSpec[];
}

/** A draught: every dozen seconds or so the flames bow and dim, then recover. */
function draught(t: number) {
    const period = 13.7;
    const k = t / period;
    const phase = k - Math.floor(k);
    const which = Math.floor(k);
    const strong = 0.55 + 0.45 * Math.abs(Math.sin(which * 12.9898));
    if (phase > 0.16) return 0;
    const x = phase / 0.16;
    return strong * Math.sin(x * Math.PI) * (0.8 + 0.2 * Math.sin(t * 23));
}

export function useFlame(lights: LightSpec[], power: number, reduced: boolean): Flame {
    const state = useMemo<Flame>(() => ({ power: 0, gust: 0, level: new Float32Array(lights.length), lights }), [lights]);
    const powerRef = useRef(power);
    powerRef.current = power;
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        state.power = powerRef.current;
        state.gust = reduced ? 0 : draught(t);
        for (let i = 0; i < lights.length; i++) {
            const f = reduced ? 1 : flicker(t * 1.6, lights[i].seed) * (1 + 0.05 * Math.sin(t * 9.1 + i * 2));
            state.level[i] = state.power * f * (1 - 0.32 * state.gust);
        }
    }, -1);
    return state;
}

/** The point lights, swaying a little with their flames. */
export function CandleLights({ flame, color }: { flame: Flame; color: THREE.ColorRepresentation }) {
    const refs = useRef<(THREE.PointLight | null)[]>([]);
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        flame.lights.forEach((l, i) => {
            const light = refs.current[i];
            if (!light) return;
            light.intensity = l.k * flame.level[i];
            light.position.set(l.pos[0] + Math.sin(t * 3.1 + i) * 0.006, l.pos[1] + Math.sin(t * 4.3 + i * 2) * 0.004, l.pos[2] - flame.gust * 0.02);
        });
    });
    return (
        <>
            {flame.lights.map((l, i) => (
                <pointLight
                    key={i}
                    ref={(r) => {
                        refs.current[i] = r;
                    }}
                    position={l.pos}
                    color={color}
                    intensity={0}
                    distance={l.dist}
                    decay={2}
                />
            ))}
        </>
    );
}

/* ------------------------------------------------------------- flames */

const FLAME_VERT = /* glsl */ `
attribute vec4 aFlame; // seed, height (m), brightness, unused
uniform float uTime;
uniform float uGust;
varying vec2 vUv;
varying float vBright;
#include <fog_pars_vertex>
void main() {
    vUv = uv;
    vBright = aFlame.z;
    float s = aFlame.x;
    float h = aFlame.y * (1.0 - 0.35 * uGust) * (0.9 + 0.1 * sin(uTime * 11.0 + s * 7.0) + 0.05 * sin(uTime * 23.0 + s));
    float w = aFlame.y * 0.38;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float y = position.y + 0.5;
    float sway = (sin(uTime * 5.3 + s * 11.0) * 0.07 + sin(uTime * 13.1 + s * 3.0) * 0.035 + uGust * 0.35) * y * y;
    mvPosition.x += position.x * w + sway * h;
    mvPosition.y += y * h - h * 0.14;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const FLAME_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vBright;
#include <fog_pars_fragment>
void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float y = vUv.y;
    // a teardrop: round at the root, drawn to a point
    float r = y < 0.3 ? sqrt(max(0.0, y / 0.3)) : pow(max(0.0, 1.0 - (y - 0.3) / 0.7), 1.25);
    r = max(r * 0.95, 0.001);
    float d = abs(x) / r;
    float a = (1.0 - smoothstep(0.45, 1.0, d)) * smoothstep(0.0, 0.07, y);
    float core = (1.0 - smoothstep(0.0, 0.75, d)) * smoothstep(0.08, 0.3, y) * (1.0 - smoothstep(0.35, 0.9, y));
    vec3 col = mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.88, 0.62), core) * (0.55 + 1.9 * core);
    float blue = (1.0 - smoothstep(0.02, 0.28, y)) * (1.0 - smoothstep(0.2, 1.0, d));
    col = mix(col, vec3(0.22, 0.32, 1.0) * 0.5, blue * 0.75);
    col *= a * vBright * 2.4;
    #ifdef USE_FOG
        col *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #endif
    gl_FragColor = vec4(col, 1.0);
}
`;

let quad: THREE.PlaneGeometry | null = null;
const getQuad = () => (quad ??= new THREE.PlaneGeometry(1, 1));

/** Free the geometry the effects keep between rooms. */
export function disposeChamberFx() {
    quad?.dispose();
    quad = null;
    dustCache.forEach((g) => g.dispose());
    dustCache.clear();
}

/** Every lit candle's flame (a shader on a billboard), and a soft halo round each. */
export function Flames({ candles, flame, lightOf }: { candles: CandleSpec[]; flame: Flame; lightOf: (c: CandleSpec) => number }) {
    const lit = useMemo(() => candles.filter((c) => c.lit), [candles]);
    const n = lit.length;
    const flames = useRef<THREE.InstancedMesh>(null);
    const halos = useRef<THREE.InstancedMesh>(null);
    const data = useMemo(() => {
        const r = rng(91);
        const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
        lit.forEach((c, i) => attr.setXYZW(i, r() * 10, 0.028 + c.r * 0.55, 0, 0));
        return { attr, seeds: lit.map((_, i) => i * 1.7 + 0.3), at: lit.map((c) => flameAt(c)) };
    }, [lit, n]);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uGust: { value: 0 } },
                vertexShader: FLAME_VERT,
                fragmentShader: FLAME_FRAG,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: true,
            }),
        [],
    );
    const geometry = useMemo(() => {
        const g = getQuad().clone();
        g.setAttribute("aFlame", data.attr);
        return g;
    }, [data]);
    useLayoutEffect(() => {
        const m = new THREE.Matrix4();
        const black = new THREE.Color(0, 0, 0);
        data.at.forEach((p, i) => {
            flames.current?.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
            // so the halos' material is built knowing it has per-instance colours
            halos.current?.setMatrixAt(i, m);
            halos.current?.setColorAt(i, black);
        });
        if (flames.current) flames.current.instanceMatrix.needsUpdate = true;
        if (halos.current?.instanceColor) halos.current.instanceColor.needsUpdate = true;
    }, [data]);
    useLayoutEffect(
        () => () => {
            material.dispose();
            geometry.dispose();
        },
        [material, geometry],
    );
    const v = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), s: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Quaternion(), warm: new THREE.Color("#ff9a4a") }), []);
    useFrame(({ clock, camera }) => {
        const t = clock.elapsedTime;
        material.uniforms.uTime.value = t;
        material.uniforms.uGust.value = flame.gust;
        const h = halos.current;
        // face the camera, whichever way the chamber itself has been turned
        if (h?.parent) h.parent.getWorldQuaternion(v.q).invert().multiply(camera.quaternion);
        else v.q.copy(camera.quaternion);
        lit.forEach((c, i) => {
            const own = flicker(t * 1.9, data.seeds[i]);
            const b = flame.level[lightOf(c)] * (0.75 + 0.25 * own);
            data.attr.setZ(i, b);
            if (h) {
                v.p.copy(data.at[i]);
                v.p.y += 0.02;
                v.s.setScalar(0.14 + c.r * 2.2);
                h.setMatrixAt(i, v.m.compose(v.p, v.q, v.s));
                h.setColorAt(i, v.c.copy(v.warm).multiplyScalar(0.28 * b));
            }
        });
        data.attr.needsUpdate = true;
        if (h) {
            h.instanceMatrix.needsUpdate = true;
            if (h.instanceColor) h.instanceColor.needsUpdate = true;
        }
    });
    return (
        <group>
            <instancedMesh ref={flames} args={[geometry, material, n]} frustumCulled={false} renderOrder={9} />
            <instancedMesh ref={halos} args={[getQuad(), undefined, n]} frustumCulled={false} renderOrder={10}>
                <meshBasicMaterial alphaMap={chamberTextures.glow()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </instancedMesh>
        </group>
    );
}

/* --------------------------------------------------------------- dust */

const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixel;
uniform vec3 uLight[NL];
uniform float uGlow[NL];
uniform vec3 uBeamA;
uniform vec3 uBeamB;
uniform float uBeam;
attribute vec4 aSeed; // phase, size (m), drift speed, glint rate
varying float vBright;
varying float vCold;
#include <fog_pars_vertex>
void main() {
    vec3 p = position;
    float t = uTime * aSeed.z;
    float ph = aSeed.x * 6.2832;
    p.x += sin(t * 0.21 + ph) * 0.22 + sin(t * 0.09 + ph * 2.7) * 0.14;
    p.y += sin(t * 0.17 + ph * 1.7) * 0.16 - mod(t * 0.004 + aSeed.x, 1.0) * 0.1;
    p.z += cos(t * 0.19 + ph * 3.7) * 0.22 + sin(t * 0.07 + ph * 0.8) * 0.12;
    float b = 0.0;
    for (int i = 0; i < NL; i++) {
        vec3 d = p - uLight[i];
        b += uGlow[i] / (1.0 + dot(d, d) * 9.0);
    }
    // in the shaft of cold light
    vec3 ab = uBeamB - uBeamA;
    float k = clamp(dot(p - uBeamA, ab) / dot(ab, ab), 0.0, 1.0);
    float r = length(p - (uBeamA + ab * k));
    float cold = uBeam * (1.0 - smoothstep(0.0, 0.08 + k * 0.22, r)) * (1.0 - smoothstep(0.6, 1.0, k));
    float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.5 + aSeed.w * 1.6) + ph * 9.0), 3.0);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float size = aSeed.y * uPixel / -mvPosition.z;
    gl_PointSize = max(size, 1.0);
    float fade = min(1.0, size * size);
    vBright = b * tw * fade;
    vCold = cold * tw * fade;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uWarm;
uniform vec3 uCool;
varying float vBright;
varying float vCold;
#include <fog_pars_fragment>
void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c) * 4.0;
    if (r2 > 1.0) discard;
    float a = (1.0 - r2);
    vec3 col = (uWarm * vBright + uCool * vCold) * a * a;
    #ifdef USE_FOG
        col *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #endif
    gl_FragColor = vec4(col, 1.0);
}
`;

const dustCache = new Map<number, THREE.BufferGeometry>();
function dustGeometry(count: number) {
    const hit = dustCache.get(count);
    if (hit) return hit;
    const r = rng(733 + count);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        // most of it in the air round the shrine, the rest through the room
        const near = i % 3 !== 0;
        const x = near ? (r() - 0.5) * 2.6 : (r() - 0.5) * (ROOM.halfW * 2 - 0.3);
        const z = near ? -0.1 + r() * 1.5 : ROOM.back + 0.2 + r() * (ROOM.front - ROOM.back - 0.4);
        pos.set([x, 0.15 + r() * 2.3, z], i * 3);
        seed.set([r(), 0.0035 + r() * r() * 0.008, 0.4 + r() * 0.8, r()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    dustCache.set(count, g);
    return g;
}

export function Dust({ count, flame, beam }: { count: number; flame: Flame; beam: { from: THREE.Vector3; to: THREE.Vector3; k: number } }) {
    const geometry = dustGeometry(count);
    const nl = flame.lights.length;
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                defines: { NL: nl },
                uniforms: {
                    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
                    uTime: { value: 0 },
                    uPixel: { value: 600 },
                    uLight: { value: flame.lights.map((l) => new THREE.Vector3(...l.pos)) },
                    uGlow: { value: new Float32Array(nl) },
                    uBeamA: { value: beam.from.clone() },
                    uBeamB: { value: beam.to.clone() },
                    uBeam: { value: 0 },
                    uWarm: { value: new THREE.Color("#ffc08a").multiplyScalar(1.4) },
                    uCool: { value: new THREE.Color("#a9bde0").multiplyScalar(1.2) },
                },
                vertexShader: DUST_VERT,
                fragmentShader: DUST_FRAG,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: true,
            }),
        [flame, nl, beam],
    );
    useLayoutEffect(() => () => material.dispose(), [material]);
    useFrame(({ clock, camera, size, viewport }) => {
        const u = material.uniforms;
        u.uTime.value = clock.elapsedTime;
        const fov = (camera as THREE.PerspectiveCamera).fov ?? 55;
        u.uPixel.value = (size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
        const g = u.uGlow.value as Float32Array;
        for (let i = 0; i < nl; i++) g[i] = flame.lights[i].k * 0.32 * flame.level[i];
        u.uBeam.value = beam.k * flame.power;
    });
    return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={8} />;
}

/* ---------------------------------------------------------- the shaft */

const BEAM_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vT;
varying vec3 vW;
void main() {
    vT = uv.y;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mv = viewMatrix * w;
    vV = -mv.xyz;
    vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
}
`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uK;
uniform float uTime;
uniform float uReach;
varying vec3 vN;
varying vec3 vV;
varying float vT;
varying vec3 vW;
void main() {
    float edge = abs(dot(normalize(vN), normalize(vV)));
    float soft = pow(edge, 2.5);
    // brightest just under the grate, gone before it lands
    float along = (1.0 - smoothstep(0.9, 1.0, vT)) * smoothstep(1.0 - uReach, 1.0, vT);
    float drift = 0.72 + 0.28 * sin(vW.y * 6.0 + vW.x * 4.0 - uTime * 0.35) * sin(vW.z * 5.0 + uTime * 0.21);
    gl_FragColor = vec4(uColor * soft * along * drift * uK, 1.0);
}
`;

/** A soft cone of cold light from the grate toward `to`, fading out `reach` of the way down. */
export function Shaft({ from, to, flame, k, reach = 0.75 }: { from: THREE.Vector3; to: THREE.Vector3; flame: Flame; k: number; reach?: number }) {
    const { geometry, matrix } = useMemo(() => {
        const len = from.distanceTo(to);
        const g = new THREE.CylinderGeometry(0.08, 0.22, len, 18, 1, true);
        const dir = to.clone().sub(from).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        const mid = from.clone().add(to).multiplyScalar(0.5);
        return { geometry: g, matrix: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)) };
    }, [from, to]);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color("#8fa6cf") }, uK: { value: 0 }, uTime: { value: 0 }, uReach: { value: reach } },
                vertexShader: BEAM_VERT,
                fragmentShader: BEAM_FRAG,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
            }),
        [reach],
    );
    useLayoutEffect(
        () => () => {
            geometry.dispose();
            material.dispose();
        },
        [geometry, material],
    );
    useFrame(({ clock }) => {
        material.uniforms.uTime.value = clock.elapsedTime;
        material.uniforms.uK.value = k * flame.power;
    });
    return <mesh geometry={geometry} material={material} matrix={matrix} matrixAutoUpdate={false} renderOrder={7} />;
}
