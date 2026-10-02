import * as THREE from "three";
import { BULB_GROUPS, TUBE_LIGHTS } from "@/components/v2/theatre3d/marquee-parts";

// The sign is lit by its own bulbs and tubes, a few centimetres from the
// metal, and the box office under it by the one weak lamp inside. That many
// real lights would be far too costly, so these materials add them in the
// shader instead: one soft source per run of three bulbs, one per letter of
// tube and the lamp, diffuse plus a little specular so the brass glints. The sum is
// unrolled with constant indices, which every GPU (and software renderers
// especially) handles far better than a loop over a uniform array. Positions
// are in world space and refreshed every frame.

export interface SignLights {
    [uniform: string]: THREE.IUniform;
    uBulbs: THREE.IUniform<THREE.Vector4[]>; // xyz world position, w brightness
    uNeons: THREE.IUniform<THREE.Vector4[]>;
    uBulbColor: THREE.IUniform<THREE.Color>;
    uNeonColor: THREE.IUniform<THREE.Color>;
    uLamp: THREE.IUniform<THREE.Vector4>; // the lamp inside the box office
    uLampColor: THREE.IUniform<THREE.Color>;
}

export function createSignLights(bulbColor: THREE.ColorRepresentation, neonColor: THREE.ColorRepresentation, lampColor: THREE.ColorRepresentation): SignLights {
    return {
        uLamp: { value: new THREE.Vector4() },
        uLampColor: { value: new THREE.Color(lampColor) },
        uBulbs: { value: Array.from({ length: BULB_GROUPS }, () => new THREE.Vector4()) },
        uNeons: { value: Array.from({ length: TUBE_LIGHTS }, () => new THREE.Vector4()) },
        uBulbColor: { value: new THREE.Color(bulbColor) },
        uNeonColor: { value: new THREE.Color(neonColor) },
    };
}

const VERTEX = /* glsl */ `
vec4 signWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
    signWorld = instanceMatrix * signWorld;
#endif
vSignWorld = (modelMatrix * signWorld).xyz;
`;

// A run of bulbs is a short warm source that pools light; a letter is a long
// tube, so its light is softened over roughly the letter's size and wraps a
// little round the dents.
const DECLARE = /* glsl */ `
varying vec3 vSignWorld;
uniform vec4 uBulbs[${BULB_GROUPS}];
uniform vec4 uNeons[${TUBE_LIGHTS}];
uniform vec3 uBulbColor;
uniform vec3 uNeonColor;
uniform vec4 uLamp;
uniform vec3 uLampColor;

void signBulb(vec4 b, vec3 n, vec3 v, float shine, inout float diff, inout float spec) {
    if (b.w <= 0.001) return;
    vec3 d = b.xyz - vSignWorld;
    float d2 = dot(d, d);
    vec3 l = d * inversesqrt(d2);
    float e = b.w * max(dot(n, l), 0.0) / (d2 + 0.012);
    diff += e;
    spec += e * pow(max(dot(n, normalize(l + v)), 0.0), shine);
}

void signNeon(vec4 t, vec3 n, inout float diff) {
    if (t.w <= 0.001) return;
    vec3 d = t.xyz - vSignWorld;
    float d2 = dot(d, d);
    diff += t.w * (max(dot(n, d * inversesqrt(d2)), 0.0) * 0.8 + 0.2) / (d2 + 0.015);
}

float signLamp(vec4 p, vec3 n) {
    if (p.w <= 0.001) return 0.0;
    vec3 d = p.xyz - vSignWorld;
    float d2 = dot(d, d);
    return p.w * max(dot(n, d * inversesqrt(d2)), 0.0) / (d2 + 0.01);
}
`;

const ADD_LIGHT = /* glsl */ `
{
    vec3 signN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 signV = normalize(cameraPosition - vSignWorld);
    float shine = clamp(2.0 / max(pow4(material.roughness), 0.0005) - 2.0, 1.0, 400.0);
    float bulbDiff = 0.0;
    float bulbSpec = 0.0;
    float neonDiff = 0.0;
    ${Array.from({ length: BULB_GROUPS }, (_, i) => `signBulb(uBulbs[${i}], signN, signV, shine, bulbDiff, bulbSpec);`).join("\n    ")}
    ${Array.from({ length: TUBE_LIGHTS }, (_, i) => `signNeon(uNeons[${i}], signN, neonDiff);`).join("\n    ")}
    vec3 signLight = bulbDiff * uBulbColor + neonDiff * uNeonColor + signLamp(uLamp, signN) * uLampColor;
    reflectedLight.directDiffuse += signLight * BRDF_Lambert(material.diffuseColor);
    reflectedLight.directSpecular += bulbSpec * (shine + 2.0) / 8.0 * uBulbColor * material.specularColor;
}
`;

/** Make a standard material pick up the sign's bulbs and tubes and the booth's lamp. Returns the same material. */
export function litBySign<M extends THREE.MeshStandardMaterial>(mat: M, lights: SignLights): M {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        Object.assign(shader.uniforms, lights);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vSignWorld;")
            .replace("#include <project_vertex>", `#include <project_vertex>\n${VERTEX}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\n${DECLARE}`)
            .replace("#include <aomap_fragment>", `${ADD_LIGHT}\n#include <aomap_fragment>`);
    };
    const key = mat.customProgramCacheKey();
    mat.customProgramCacheKey = () => `${key}|marquee-sign-lights`;
    return mat;
}

const tmp = new THREE.Vector3();

/**
 * Write the sources' world positions and brightness. `points` are xyz
 * triples in the sign's local space; `levels` are multiplied by `scale`.
 */
export function placeLights(target: THREE.Vector4[], points: ArrayLike<number>, levels: ArrayLike<number>, scale: number, signMatrix: THREE.Matrix4) {
    for (let i = 0; i < target.length; i++) {
        tmp.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]).applyMatrix4(signMatrix);
        target[i].set(tmp.x, tmp.y, tmp.z, levels[i] * scale);
    }
}
