import * as THREE from "three";
import { D, HINGE_X, LEAF_R } from "@/components/v2/theatre3d/door-variants";
import { LEAF_UV, brassMaps, dustSprite, ironMaps, stoneMaps, woodMaps } from "@/components/v2/theatre3d/door-textures";
import type { DoorVariant } from "@/components/v2/theatre3d/door-variants";

// What lies behind each door. There is no room: the doorway is a flat surface
// whose shader traces a long, dark chamber behind it (so it has real depth and
// parallax, even from a hand's breadth away). Far in, a candle burns on an
// iron stand in front of a red curtain; the boards catch its flame. The same
// candle, seen through the doorway and past the leaf, is what lights the
// stones, the threshold, the floor and the dust out here, so the light that
// escapes always matches the opening, the leaf's angle and whoever is
// walking about inside.

/** The candle, door space. */
export const LAMP = new THREE.Vector3(0.18, 0.62, D.roomZ - 7.3);
/** The plane someone inside walks along, door space z: well in, between you and the candle. */
export const FIGURE_Z = D.roomZ - 4.6;

const f = (n: number) => n.toFixed(5);

export interface DoorUniforms {
    [key: string]: THREE.IUniform;
    uLeafAng: { value: number }; // how far the leaf is open, radians
    uRoomI: { value: number }; // the candle as it reaches out here, past the leaf
    uGapI: { value: number }; // the glow under and around a shut leaf
    uExpo: { value: number }; // the candle as it lights the room itself
    uFig: { value: THREE.Vector4 }; // the walker: x, presence, bob; w is the flame's sway
    uRoomCol: { value: THREE.Color }; // the candle's colour
    uTime: { value: number };
    uPointScale: { value: number };
}

export function makeDoorUniforms(): DoorUniforms {
    return {
        uLeafAng: { value: 0 },
        uRoomI: { value: 0 },
        uGapI: { value: 1 },
        uExpo: { value: 1 },
        uFig: { value: new THREE.Vector4(-9, 0, 0, 0) },
        uRoomCol: { value: new THREE.Color(1, 0.4, 0.13) },
        uTime: { value: 0 },
        uPointScale: { value: 400 },
    };
}

const LIGHT_GLSL = /* glsl */ `
uniform float uLeafAng;
uniform float uRoomI;
uniform float uGapI;
uniform vec4 uFig;
uniform vec3 uRoomCol;
#define DL_HALF ${f(D.half)}
#define DL_SPRING ${f(D.spring)}
#define DL_SILL ${f(D.sill)}
#define DL_ROOMZ ${f(D.roomZ)}
#define DL_LEAFZ ${f(D.leafZ)}
#define DL_LEAFB ${f(D.leafB)}
#define DL_LEAFW ${f(D.leafW)}
#define DL_LEAFT ${f(D.leafT)}
#define DL_LEAFR ${f(LEAF_R)}
#define DL_HINGEX ${f(HINGE_X)}
#define DL_FIGZ ${f(FIGURE_Z)}
#define DL_LAMPR 0.45
const vec3 DL_LAMP = vec3(${f(LAMP.x)}, ${f(LAMP.y)}, ${f(LAMP.z)});

// Someone standing, soft-edged: p is relative to their feet.
float dlFigure(vec2 p, float blur) {
    vec2 q = p - vec2(0.0, 0.46);
    float legs = max(abs(q.x) - 0.14 + q.y * 0.05, abs(q.y) - 0.46);
    vec2 t = p - vec2(0.0, clamp(p.y, 1.0, 1.36));
    float torso = length(t * vec2(1.0, 0.85)) - 0.2 + (p.y - 1.0) * 0.04;
    float head = length((p - vec2(0.0, 1.63)) * vec2(1.0, 0.9)) - 0.105;
    float d = min(min(legs, torso), head);
    return 1.0 - smoothstep(-blur, blur, d);
}

// How much of the walker stands between P and the candle (a soft shadow: the flame has size).
float dlFigOcc(vec3 P) {
    vec3 d = DL_LAMP - P;
    float t = (DL_FIGZ - P.z) / d.z;
    if (t <= 0.0 || t >= 1.0) return 0.0;
    vec3 c = P + d * t;
    return uFig.y * dlFigure(vec2(c.x - uFig.x, c.y - DL_SILL - uFig.z), 0.03 + 0.12 * t);
}

// Fraction of the candle P can see: through the doorway, past the leaf and the
// walker. Every edge casts a penumbra that widens with distance from it.
float dlReach(vec3 P) {
    vec3 d = DL_LAMP - P;
    float t0 = clamp((DL_ROOMZ - P.z) / d.z, 0.0, 1.0);
    vec3 c = P + d * t0;
    float arch = DL_HALF - length(vec2(c.x, max(c.y - DL_SPRING, 0.0)));
    float inside = min(arch, c.y - DL_SILL);
    float pen = DL_LAMPR * t0 + 0.004;
    float vis = smoothstep(-pen, pen, inside);
    // the leaf, seen from above: its front and back faces, two segments from the hinge
    vec2 dir = vec2(cos(uLeafAng), sin(uLeafAng));
    vec2 e = dir * DL_LEAFW;
    vec2 back = vec2(dir.y, -dir.x) * DL_LEAFT;
    vec2 dd = d.xz;
    float den = dd.x * e.y - dd.y * e.x;
    if (abs(den) > 1e-6) {
        for (int k = 0; k < 2; k++) {
            vec2 w = vec2(DL_HINGEX, DL_LEAFZ) + back * float(k) - P.xz;
            float s = (w.x * dd.y - w.y * dd.x) / den;
            float t = (w.x * e.y - w.y * e.x) / den;
            float y = P.y + d.y * t;
            float sx = s * DL_LEAFW - DL_LEAFR;
            float top = DL_SPRING + sqrt(max(DL_LEAFR * DL_LEAFR - sx * sx, 0.0));
            float p2 = DL_LAMPR * clamp(t, 0.0, 1.0) + 0.004;
            float along = smoothstep(-p2, p2, s * DL_LEAFW) * smoothstep(-p2, p2, (1.0 - s) * DL_LEAFW);
            float up = smoothstep(DL_LEAFB - p2, DL_LEAFB + p2, y) * smoothstep(top + p2, top - p2, y);
            vis *= 1.0 - step(0.0, t) * step(t, 1.0) * along * up;
        }
    }
    return vis * (1.0 - dlFigOcc(P));
}

// Candlelight from the doorway arriving at P (door space) on a surface facing N.
vec3 dlLight(vec3 P, vec3 N) {
    vec3 d = DL_LAMP - P;
    float d2 = dot(d, d);
    float lam = max(dot(N, d), 0.0) * inversesqrt(d2);
    return uRoomCol * (uRoomI * lam * dlReach(P) / d2);
}

// The thin strip of light that escapes under a shut leaf onto the sill.
vec3 dlGap(vec3 P, vec3 N) {
    float fwd = max(P.z - DL_LEAFZ + 0.01, 0.0);
    float g = exp(-fwd / 0.05) * smoothstep(0.0, 0.05, DL_HALF - 0.015 - abs(P.x)) * smoothstep(0.4, 0.9, N.y) * smoothstep(0.1, 0.065, P.y);
    return uRoomCol * (uGapI * g * (1.0 - dlFigOcc(P)));
}
`;

/** Varyings carrying door-space position and normal into a patched standard material. */
function patchDoorSpace(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: DoorUniforms, emissive: string) {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vDoorPos;\nvarying vec3 vDoorN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDoorPos = transformed;\nvDoorN = objectNormal;");
    shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vDoorPos;\nvarying vec3 vDoorN;\n${LIGHT_GLSL}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${emissive}`);
}

// ---------------------------------------------------------------- shared materials

let shared: {
    iron: THREE.MeshStandardMaterial;
    brass: THREE.MeshStandardMaterial;
    screw: THREE.MeshStandardMaterial;
    mortar: THREE.MeshBasicMaterial;
    engraveDark: THREE.MeshStandardMaterial;
    engraveLight: THREE.MeshStandardMaterial;
} | null = null;

export function sharedMaterials() {
    if (shared) return shared;
    const im = ironMaps();
    const bm = brassMaps();
    // Old brass keeps a faint glow of the corridor in it, so the plate never goes quite black.
    const sheen = new THREE.Color("#ffd9a8");
    shared = {
        iron: new THREE.MeshStandardMaterial({ map: im.map, normalMap: im.normalMap, roughnessMap: im.mr, metalnessMap: im.mr, roughness: 1, metalness: 1 }),
        brass: new THREE.MeshStandardMaterial({ map: bm.map, normalMap: bm.normalMap, roughnessMap: bm.mr, metalnessMap: bm.mr, roughness: 1, metalness: 1, emissiveMap: bm.map, emissive: sheen, emissiveIntensity: 0.16 }),
        screw: new THREE.MeshStandardMaterial({ map: bm.map, roughness: 0.5, metalness: 0.8, color: "#c8b48c", emissiveMap: bm.map, emissive: sheen, emissiveIntensity: 0.1 }),
        mortar: new THREE.MeshBasicMaterial({ color: "#070504" }),
        engraveDark: new THREE.MeshStandardMaterial({ color: "#0d0805", roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
        engraveLight: new THREE.MeshStandardMaterial({ color: "#e0bd7c", roughness: 0.35, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    };
    return shared;
}

// ---------------------------------------------------------------- the chamber behind the door

const ROOM_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vPos;
varying vec3 vCam;
void main() {
    vPos = position;
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const ROOM_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uExpo;
varying vec3 vPos;
varying vec3 vCam;
${LIGHT_GLSL}
#define RW 2.1
#define RH 3.6
#define RD 8.5

float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rn(vec2 p) {
    vec2 i = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);
    return mix(mix(rh(i), rh(i + vec2(1, 0)), u.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), u.x), u.y);
}

void main() {
    vec3 ro = vPos;
    vec3 rd = normalize(vPos - vCam);
    rd.z = min(rd.z, -0.02);
    rd = normalize(rd);

    // Where the eye ray ends: walls, floor, ceiling or the curtain at the back.
    float tx = ((rd.x > 0.0 ? RW : -RW) - ro.x) / rd.x;
    float ty = ((rd.y > 0.0 ? RH : DL_SILL) - ro.y) / rd.y;
    float tz = (DL_ROOMZ - RD - ro.z) / rd.z;
    float t = min(min(tx, ty), tz);
    vec3 h = ro + rd * t;
    float far = smoothstep(2.0, 7.0, -h.z);
    vec3 n;
    vec3 alb;
    float gloss = 0.0;
    if (t == tz) {
        // a heavy curtain, deep red, hanging in folds; it fades into dark stone
        // at the sides and up into the dark, so the back wall has no edges
        float ph = h.x * 8.0 + sin(h.y * 0.8 + h.x * 1.3) * 1.2;
        float cloth = smoothstep(1.9, 0.9, abs(h.x)) * smoothstep(3.4, 2.2, h.y);
        n = normalize(vec3(-cos(ph) * 0.5 * cloth, 0.0, 1.0));
        vec3 red = vec3(0.3, 0.022, 0.018) * (0.55 + 0.45 * (0.5 + 0.5 * sin(ph))) * (0.85 + 0.3 * rn(h.xy * vec2(0.6, 4.0)));
        alb = mix(vec3(0.06, 0.055, 0.052), red, cloth);
    } else if (t == ty && rd.y < 0.0) {
        // old boards of uneven widths running in, worn smooth enough to catch the flame
        n = vec3(0.0, 1.0, 0.0);
        float u = h.x / 0.2 + 0.35 * sin(h.x * 1.7) + 0.2 * sin(h.x * 4.3);
        float seam = 0.5 - abs(fract(u) - 0.5);
        float aa = fwidth(u) * 1.5 + 0.02;
        float board = mix(smoothstep(0.0, aa + 0.05, seam), 0.8, smoothstep(0.1, 0.4, aa));
        float plank = rh(vec2(floor(u), 7.0));
        alb = vec3(0.15, 0.1, 0.075) * (0.62 + 0.38 * board) * (0.55 + 0.7 * plank) * (0.75 + 0.5 * rn(vec2(h.x * 2.0, h.z * 0.5)));
        gloss = board * (0.4 + 0.6 * plank);
    } else if (t == ty) {
        n = vec3(0.0, -1.0, 0.0);
        alb = vec3(0.05, 0.047, 0.045);
    } else {
        // rough stone, a little damp
        n = vec3(-sign(rd.x), 0.0, 0.0);
        alb = vec3(0.1, 0.092, 0.088) * (0.6 + 0.6 * rn(h.zy * vec2(1.4, 2.6)) * rn(h.zy * vec2(5.0, 7.0) + 3.0));
    }

    // The candle: steady-ish, falling off fast, throwing the walker's shadow.
    vec3 dl = DL_LAMP - h;
    float d2 = dot(dl, dl);
    vec3 ln = dl * inversesqrt(d2);
    float lam = max(dot(n, ln), 0.0);
    float lit = lam / (0.2 + d2 * (1.0 + 0.15 * d2)) * (1.0 - dlFigOcc(h));
    vec3 candle = uRoomCol * uExpo;
    vec3 cold = vec3(0.004, 0.006, 0.01);
    vec3 col = alb * (candle * lit * 1.5 + cold);
    if (gloss > 0.0) {
        vec3 rf = reflect(rd, n);
        float sp = pow(max(dot(rf, ln), 0.0), 120.0) + 0.08 * pow(max(dot(rf, ln), 0.0), 14.0);
        col += candle * sp * gloss * 0.45 / (1.0 + 0.12 * d2) * (1.0 - dlFigOcc(h));
    }

    // The flame, its wax and the iron stand it sits on, found by how close the ray passes.
    vec3 lo = DL_LAMP - ro;
    float s0 = dot(lo, rd);
    vec3 off = ro + rd * s0 - DL_LAMP;
    float hh = max(length(off), 0.04);
    float before = step(0.0, s0) * step(s0, t);
    vec2 fo = vec2(off.x - uFig.w * (off.y + 0.02) * 4.0, off.y - 0.03);
    float flame = exp(-(fo.x * fo.x) / 0.00012 - (fo.y * fo.y) / 0.0007) * before;
    float wax = (1.0 - smoothstep(0.009, 0.013, abs(off.x))) * smoothstep(-0.16, -0.15, off.y) * (1.0 - smoothstep(0.0, 0.006, off.y)) * before;
    float stand = (1.0 - smoothstep(0.006, 0.01, abs(off.x))) * smoothstep(-DL_LAMP.y + DL_SILL, -DL_LAMP.y + DL_SILL + 0.01, off.y) * (1.0 - smoothstep(-0.17, -0.15, off.y)) * before;
    col = mix(col, vec3(0.002), stand);
    col = mix(col, candle * vec3(0.9, 0.75, 0.6) * 0.35, wax);

    // Smoke in the air: a halo round the flame, split at the walker so they hide what's behind them.
    float tf = (DL_FIGZ - ro.z) / rd.z;
    float tm = min(tf, t);
    float sc1 = (atan((tm - s0) / hh) - atan(-s0 / hh)) / hh;
    float sc2 = (atan((t - s0) / hh) - atan((tm - s0) / hh)) / hh;
    float m = 0.0;
    if (tf < t) {
        vec3 pf = ro + rd * tf;
        m = uFig.y * dlFigure(vec2(pf.x - uFig.x, pf.y - DL_SILL - uFig.z), 0.03);
    }
    float behindFig = step(tf, s0);
    col = col * (1.0 - m) + candle * 0.012 * (sc1 + sc2 * (1.0 - m));
    col += candle * flame * 7.0 * (1.0 - m * behindFig);

    // Round a shut leaf the light squeezes through unevenly, orange where the
    // gap is wide and deep red where it narrows, dark when the walker passes.
    float edge = min(min(DL_HALF - abs(vPos.x), vPos.y - DL_SILL), DL_HALF - length(vec2(vPos.x, max(vPos.y - DL_SPRING, 0.0))));
    float wob = rn(vPos.xy * 11.0) * 0.6 + rn(vPos.xy * 37.0) * 0.4;
    float band = 1.0 - smoothstep(0.0, 0.03, edge);
    float tight = mix(0.35, 1.0, smoothstep(-0.55, -0.2, vPos.x)); // the hinges pull that side close
    float leak = band * tight * (0.04 + 1.5 * smoothstep(0.42, 0.85, wob)) * (1.0 - dlFigOcc(vec3(vPos.x, vPos.y, DL_LEAFZ)));
    vec3 leakCol = mix(vec3(0.75, 0.1, 0.04), vec3(1.0, 0.62, 0.3), smoothstep(0.35, 0.8, wob));
    col += leak * uGapI * leakCol * uRoomCol * 1.6;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

const POOL_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vPos;
void main() {
    vPos = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const FOG_FADE = /* glsl */ `
    #ifdef USE_FOG
        #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        c *= 1.0 - fogFactor;
    #endif
`;

const POOL_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying vec3 vPos;
${LIGHT_GLSL}
void main() {
    vec3 c = dlLight(vec3(vPos.x, 0.0, vPos.z), vec3(0.0, 1.0, 0.0)) * 0.8;
    ${FOG_FADE}
    gl_FragColor = vec4(c, 1.0);
}
`;

const DUST_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float phase;
uniform float uTime;
uniform float uPointScale;
varying float vBright;
${LIGHT_GLSL}
void main() {
    vec3 p = position;
    float t = uTime * 0.05 + phase;
    p.x += sin(t * 1.3 + phase) * 0.12;
    p.y = mod(p.y + uTime * 0.012 * (0.5 + fract(phase)) + sin(t * 0.7) * 0.1, 2.7) + 0.08;
    p.z += cos(t * 1.1 + phase * 2.0) * 0.1;
    vec3 d = DL_LAMP - p;
    float tw = sin(uTime * 0.8 + phase * 6.0);
    vBright = uRoomI * dlReach(p) / dot(d, d) * (0.3 + 0.7 * tw * tw);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    // motes right in front of the eye would be blots: fade them out
    vBright *= smoothstep(0.25, 0.7, -mvPosition.z);
    gl_PointSize = min(uPointScale * (0.004 + 0.004 * fract(phase * 7.0)) / -mvPosition.z, 10.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const DUST_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uSprite;
uniform vec3 uRoomCol;
varying float vBright;
void main() {
    vec3 c = uRoomCol * vBright * texture2D(uSprite, gl_PointCoord).r * 0.5;
    ${FOG_FADE}
    gl_FragColor = vec4(c, 1.0);
}
`;

const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

export interface DoorMaterials {
    stone: THREE.MeshStandardMaterial;
    wood: THREE.MeshStandardMaterial;
    room: THREE.ShaderMaterial;
    pool: THREE.ShaderMaterial;
    dust: THREE.ShaderMaterial;
    keyhole: THREE.MeshBasicMaterial;
    dispose: () => void;
}

/** The materials one door needs, wired to that door's uniforms. */
export function makeDoorMaterials(v: DoorVariant, u: DoorUniforms): DoorMaterials {
    const sm = stoneMaps();
    const wm = woodMaps(v);

    const stone = new THREE.MeshStandardMaterial({ map: sm.map, normalMap: sm.normalMap, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.94, metalness: 0, vertexColors: true });
    stone.onBeforeCompile = (shader) => patchDoorSpace(shader, u, "totalEmissiveRadiance += diffuseColor.rgb * (dlLight(vDoorPos, normalize(vDoorN)) * 3.0 + dlGap(vDoorPos, normalize(vDoorN)) * 1.5);");
    stone.customProgramCacheKey = () => "theatre-door-stone";

    const wood = new THREE.MeshStandardMaterial({
        map: wm.map,
        normalMap: wm.normalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.64,
        metalness: 0,
        emissiveMap: wm.emissiveMap,
        emissive: new THREE.Color(1, 0.45, 0.16),
        emissiveIntensity: 1,
    });
    // Light through the cracks dims when the walker passes behind them.
    wood.onBeforeCompile = (shader) =>
        patchDoorSpace(
            shader,
            u,
            `#ifdef USE_EMISSIVEMAP
            {
                vec3 lp = vec3(DL_HINGEX + vEmissiveMapUv.x / ${f(LEAF_UV.sx)}, DL_LEAFB + vEmissiveMapUv.y / ${f(LEAF_UV.sy)}, DL_LEAFZ - 0.06);
                totalEmissiveRadiance *= 1.0 - dlFigOcc(lp);
            }
            #endif`,
        );
    wood.customProgramCacheKey = () => "theatre-door-wood";

    const room = new THREE.ShaderMaterial({ uniforms: { ...fogUniforms(), ...u }, vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG, fog: true, toneMapped: false });

    const pool = new THREE.ShaderMaterial({
        uniforms: { ...fogUniforms(), ...u },
        vertexShader: POOL_VERT,
        fragmentShader: POOL_FRAG,
        fog: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });

    const dust = new THREE.ShaderMaterial({
        uniforms: { ...fogUniforms(), ...u, uSprite: { value: dustSprite() } },
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        fog: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
    });

    const keyhole = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.4, 0.13), toneMapped: false });

    return {
        stone,
        wood,
        room,
        pool,
        dust,
        keyhole,
        dispose: () => {
            for (const m of [stone, wood, room, pool, dust, keyhole]) m.dispose();
        },
    };
}
