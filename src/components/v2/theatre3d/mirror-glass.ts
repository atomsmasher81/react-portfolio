import * as THREE from "three";
import { canvasTextureWork, fbm, once, paintPixelsWork, readWork, rng, type Work } from "@/components/v2/theatre3d/textures";
import { RING } from "@/components/v2/theatre3d/mirror-camera";

// The mirror's glass: its outline, how it broke, how its silvering has aged,
// and the shader that turns one reflection into many slightly wrong ones.
// All in the mirror's local space, in metres: x across, y up from the floor.

/** The glass: a tall pane with a shallow arched top, set into the frame a few centimetres off the wall. */
export const GLASS = {
    half: 0.95, // half width
    bottom: 0.3,
    shoulder: 2.86, // where the sides meet the arch
    apex: 3.12, // top of the arch
    z: 0.06,
};

/** The arch is part of a circle through both shoulders and the apex. */
export const ARCH = (() => {
    const sag = GLASS.apex - GLASS.shoulder;
    const radius = (GLASS.half * GLASS.half + sag * sag) / (2 * sag);
    return { cx: 0, cy: GLASS.apex - radius, radius, from: Math.atan2(GLASS.shoulder - (GLASS.apex - radius), GLASS.half) };
})();

/** Top edge of the glass at x. */
export const archY = (x: number) => ARCH.cy + Math.sqrt(Math.max(0, ARCH.radius * ARCH.radius - x * x));

/**
 * The reflection is rendered for a rectangle a little larger than the glass,
 * so shards that look slightly off to one side still find something there.
 */
export const RECT = (() => {
    const margin = 0.12;
    const minY = GLASS.bottom - margin;
    const maxY = GLASS.apex + margin;
    return { cx: 0, cy: (minY + maxY) / 2, hx: GLASS.half + margin, hy: (maxY - minY) / 2 };
})();

export function glassShape() {
    const s = new THREE.Shape();
    s.moveTo(-GLASS.half, GLASS.bottom);
    s.lineTo(GLASS.half, GLASS.bottom);
    s.lineTo(GLASS.half, GLASS.shoulder);
    s.absarc(ARCH.cx, ARCH.cy, ARCH.radius, ARCH.from, Math.PI - ARCH.from, false);
    s.lineTo(-GLASS.half, GLASS.bottom);
    return s;
}

let glassGeometry: THREE.ShapeGeometry | null = null;
export function getGlassGeometry() {
    if (!glassGeometry) glassGeometry = new THREE.ShapeGeometry(glassShape(), 48);
    return glassGeometry;
}

const insideGlass = (x: number, y: number, pad = 0) => Math.abs(x) <= GLASS.half + pad && y >= GLASS.bottom - pad && y <= archY(x) + pad;

/** Where something struck the glass: a little above and beside where your face would be. */
export const IMPACT = new THREE.Vector2(0.27, 1.97);

export interface Shards {
    count: number;
    seeds: THREE.Vector2[];
    shift: THREE.Vector4[]; // offset x, offset y, how thickly it fogs, missing
    warp: THREE.Vector4[]; // rotation, scale, drift phase, drift speed
    tint: THREE.Vector4[]; // colour, strength
    cam: THREE.Vector4[]; // x: which of your selves it holds when the camera is on (1 up), 0 for none
    selfAt: THREE.Vector4[]; // per self: centre of its piece, the picture's size there, its tilt
    selfKind: THREE.Vector4[]; // per self: how it is shown, seconds behind, crop
}

// Tints for the many selves, in linear colour.
const TINTS: Record<string, [number, number, number, number]> = {
    clear: [1, 0.96, 0.9, 0.15],
    amber: [1.45, 0.86, 0.42, 0.7],
    blue: [0.42, 0.66, 1.3, 0.7],
    red: [1.5, 0.24, 0.18, 0.75],
    grey: [0.78, 0.78, 0.8, 0.85],
    black: [0.05, 0.045, 0.045, 0.94],
};

/** How a self is shown: live, some seconds late, the still taken when the camera began, or late and aged. */
export const CAM = { live: 0, late: 1, still: 2, aged: 3 };

/**
 * Your selves, when the camera is on: some of the pieces each reflect a
 * different version of you, filling the piece edge to edge, the crack its only
 * border. Each names a point on the glass (the piece there holds it), how much
 * the picture is turned in it, how close it crops in on you, how it is shown
 * and how many seconds behind it runs. Two pieces hold you as you are now, at
 * different crops and angles. The rest of the glass keeps the corridor.
 */
export const SELVES: { near: [number, number]; tilt: number; zoom: number; kind: number; late: number }[] = [
    { near: [-0.11, 1.61], tilt: 0, zoom: 1.0, kind: CAM.live, late: 0 },
    { near: [0.2, 1.69], tilt: -0.12, zoom: 1.45, kind: CAM.live, late: 0 },
    { near: [0.44, 2.35], tilt: 0.12, zoom: 1.1, kind: CAM.late, late: 1.5 },
    { near: [-0.17, 2.2], tilt: 0.06, zoom: 1.0, kind: CAM.late, late: 3.4 },
    { near: [0.5, 1.6], tilt: -0.08, zoom: 1.15, kind: CAM.still, late: 0 },
    { near: [-0.5, 0.89], tilt: 0.1, zoom: 1.0, kind: CAM.aged, late: 2.6 },
];

let shards: Shards | null = null;

/**
 * The break: rings of seeds around the impact (small shards close in, long
 * ones further out, like a real strike), plus a few small ones where the
 * bottom-left corner took a knock and lost two pieces.
 */
export function getShards(): Shards {
    if (shards) return shards;
    const r = rng(1927);
    const seeds: THREE.Vector2[] = [];
    const rings: [number, number][] = [
        [0.055, 3],
        [0.16, 4],
        [0.34, 4],
        [0.62, 5],
        [1.0, 5],
        [1.45, 5],
    ];
    for (const [radius, count] of rings) {
        const turn = r() * Math.PI * 2;
        for (let k = 0; k < count; k++) {
            const a = turn + ((k + 0.5 + (r() - 0.5) * 0.55) / count) * Math.PI * 2;
            const rr = radius * (0.82 + r() * 0.36);
            const x = IMPACT.x + Math.cos(a) * rr;
            const y = IMPACT.y + Math.sin(a) * rr * 1.18;
            if (insideGlass(x, y, 0.12)) seeds.push(new THREE.Vector2(x, y));
        }
    }
    // the knocked corner: two small pieces gone (the first two), two more cracked around them
    const holes = seeds.length;
    seeds.push(new THREE.Vector2(-0.87, 0.41), new THREE.Vector2(-0.71, 0.36), new THREE.Vector2(-0.8, 0.62), new THREE.Vector2(-0.55, 0.5));
    // and one more to split the long piece at the bottom right
    seeds.push(new THREE.Vector2(0.75, 0.55));
    const count = seeds.length;
    const missing = (i: number) => i === holes || i === holes + 1;

    const kinds = ["amber", "blue", "red", "grey", "clear", "amber", "grey", "blue", "clear", "red", "grey", "amber", "blue", "clear", "grey", "amber", "red", "blue", "grey", "clear", "amber", "grey", "blue", "clear", "red", "amber", "grey", "blue", "clear", "grey", "amber", "blue"];
    const shift: THREE.Vector4[] = [];
    const warp: THREE.Vector4[] = [];
    const tint: THREE.Vector4[] = [];
    const cam: THREE.Vector4[] = [];
    // the one almost black shard: a mid-sized one low on the right
    let black = 0;
    let bestScore = Infinity;
    seeds.forEach((s, i) => {
        const score = Math.hypot(s.x - 0.55, s.y - 1.05);
        if (score < bestScore) {
            bestScore = score;
            black = i;
        }
    });
    seeds.forEach((_, i) => {
        // each piece sits at its own small angle; a few have shifted further than the rest
        const loose = r() < 0.25;
        const k = loose ? 1 : 0.35;
        shift.push(new THREE.Vector4((r() - 0.5) * 0.16 * k, (r() - 0.5) * 0.16 * k, 0.8 + r() * 0.35, missing(i) ? 1 : 0));
        warp.push(new THREE.Vector4((r() - 0.5) * 0.3 * k, 1 + (r() - 0.5) * 0.3 * k, r() * Math.PI * 2, 0.16 + r() * 0.2));
        const t = TINTS[i === black ? "black" : kinds[i % kinds.length]];
        tint.push(new THREE.Vector4(t[0], t[1], t[2], t[3] * (0.75 + r() * 0.25)));
        cam.push(new THREE.Vector4(0, 0, 0, 0));
    });
    // Each self takes the piece at its point. Its picture is centred on the
    // piece's extent and sized to cover all of it (turned as it is), so it
    // fills the piece to the crack.
    const nearest = (x: number, y: number) => {
        let best = 0;
        let bd = Infinity;
        seeds.forEach((sd, i) => {
            const d = (sd.x - x) ** 2 + (sd.y - y) ** 2;
            if (d < bd) {
                bd = d;
                best = i;
            }
        });
        return best;
    };
    const box = seeds.map(() => [Infinity, -Infinity, Infinity, -Infinity]);
    for (let x = -GLASS.half; x <= GLASS.half; x += 0.01) {
        for (let y = GLASS.bottom; y <= GLASS.apex; y += 0.01) {
            if (!insideGlass(x, y)) continue;
            const b = box[nearest(x, y)];
            b[0] = Math.min(b[0], x);
            b[1] = Math.max(b[1], x);
            b[2] = Math.min(b[2], y);
            b[3] = Math.max(b[3], y);
        }
    }
    const selfAt: THREE.Vector4[] = [];
    const selfKind: THREE.Vector4[] = [];
    SELVES.forEach((self, j) => {
        const i = nearest(self.near[0], self.near[1]);
        if (missing(i)) return;
        const [x0, x1, y0, y1] = box[i];
        const w = x1 - x0;
        const h = y1 - y0;
        const c = Math.abs(Math.cos(self.tilt));
        const sn = Math.abs(Math.sin(self.tilt));
        const size = Math.max(w * c + h * sn, w * sn + h * c) * 1.12;
        cam[i].x = j + 1;
        selfAt[j] = new THREE.Vector4((x0 + x1) / 2, (y0 + y1) / 2, size, self.tilt);
        selfKind[j] = new THREE.Vector4(self.kind, self.late, self.zoom, 0);
    });
    for (let j = 0; j < SELVES.length; j++) {
        selfAt[j] ??= new THREE.Vector4(0, 0, 1, 0);
        selfKind[j] ??= new THREE.Vector4();
    }
    shards = { count, seeds, shift, warp, tint, cam, selfAt, selfKind };
    return shards;
}


/**
 * Old silvering, over the glass's bounding box. R: how much silver is left
 * (it has died back from the edges in dark feathery fronts and in patches),
 * G: foxing, the brown spots, B: haze, where the backing has gone cloudy.
 */
export function getSilverTexture() {
    return silver();
}
/** Paint the silvering a slice at a time (getSilverTexture then has it at once). */
export const prepareSilver = () => silver.built.prepare();

const silver = once(function* (): Work<THREE.CanvasTexture> {
    const W = 512;
    const H = Math.round((W * (GLASS.apex - GLASS.bottom)) / (2 * GLASS.half));
    const sx = (2 * GLASS.half) / W;
    const sy = (GLASS.apex - GLASS.bottom) / H;
    const r = rng(77);

    // foxing spots first, drawn as soft rings onto their own canvas
    const fox = document.createElement("canvas");
    fox.width = W;
    fox.height = H;
    const fctx = fox.getContext("2d")!;
    fctx.fillStyle = "#000";
    fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = "lighter";
    const blob = (x: number, y: number, rad: number, a: number) => {
        const g = fctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.55, `rgba(255,255,255,${a * 0.6})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        fctx.fillStyle = g;
        fctx.beginPath();
        fctx.arc(x, y, rad, 0, Math.PI * 2);
        fctx.fill();
    };
    for (let i = 0; i < 110; i++) {
        // more of them low down and toward the edges, where damp collects
        let x = r() * W;
        let y = H * (1 - Math.pow(r(), 1.6));
        if (r() < 0.45) x = r() < 0.5 ? r() * W * 0.18 : W - r() * W * 0.18;
        if (r() < 0.2) y = r() * H * 0.15;
        const rad = 1.5 + Math.pow(r(), 2.5) * 13;
        const a = 0.2 + r() * 0.35;
        // a spot is a few overlapping stains, never a clean circle, with pinpricks scattered round it
        const parts = 2 + Math.floor(r() * 4);
        for (let b = 0; b < parts; b++) blob(x + (r() - 0.5) * rad * 1.3, y + (r() - 0.5) * rad * 1.3, rad * (0.3 + r() * 0.6), a);
        const pricks = Math.floor(r() * 7);
        for (let k = 0; k < pricks; k++) {
            const t = r() * Math.PI * 2;
            const d = rad * (0.9 + r() * 1.6);
            blob(x + Math.cos(t) * d, y + Math.sin(t) * d, 0.6 + r() * 1.1, 0.3 + r() * 0.4);
        }
        if (i % 10 === 9) yield;
    }
    const foxData = (yield readWork(fctx, W, H)) as Uint8ClampedArray;

    const edgeNoise = fbm(311, 4);
    yield;
    const fineNoise = fbm(419, 3);
    yield;
    const patchNoise = fbm(523, 4);
    yield;
    const hazeNoise = fbm(631, 3);
    yield;
    const silverTexture = (yield canvasTextureWork(
        W,
        H,
        (ctx) =>
            paintPixelsWork(ctx, W, H, (px, py) => {
                const x = -GLASS.half + (px + 0.5) * sx;
                const y = GLASS.apex - (py + 0.5) * sy;
                const edge = Math.min(x + GLASS.half, GLASS.half - x, y - GLASS.bottom, archY(x) - y);
                // the black edge: silver dying back in a ragged front
                const front = edge - 0.12 * edgeNoise(x * 7, y * 7) - 0.05 * fineNoise(x * 34, y * 34);
                let silver = 0.06 + 0.94 * smooth(-0.015, 0.04, front);
                // a brown tarnish fringe just ahead of the dead edge
                const fringe = smooth(-0.02, 0.01, front) * (1 - smooth(0.02, 0.09, front));
                // cloudy patches where it has lifted from the glass
                const patch = patchNoise(x * 2.3 + 11, y * 2.3);
                silver *= 1 - 0.75 * smooth(0.64, 0.76, patch);
                // a few tarnish runs from the top edge
                const run = fineNoise(x * 60, y * 2.2);
                silver *= 1 - 0.35 * smooth(0.7, 0.85, run) * smooth(GLASS.apex - 0.7, GLASS.apex - 0.1, y);
                const f = Math.min(1, foxData[(py * W + px) * 4] / 255 + fringe * 0.7);
                silver *= 1 - 0.35 * f;
                const haze = Math.min(1, 0.75 * smooth(0.45, 0.8, hazeNoise(x * 1.4, y * 1.4 + 3)) + 0.5 * (1 - smooth(0.0, 0.3, edge)) + 0.25 * smooth(0.9, 0.3, y));
                return [silver * 255, f * 255, haze * 255];
            }),
        { srgb: false },
    )) as THREE.CanvasTexture;
    silverTexture.anisotropy = 1;
    return silverTexture;
});

function smooth(a: number, b: number, x: number) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

const vertexShader = /* glsl */ `
    varying vec2 vP;
    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    void main() {
        vP = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D tReflect;
    uniform sampler2D tSilver;
    uniform mat4 uTexMatrix;
    uniform vec2 uTexSize;
    uniform vec4 uBounds;
    uniform vec2 uSeeds[SHARDS];
    uniform vec4 uShift[SHARDS];
    uniform vec4 uWarp[SHARDS];
    uniform vec4 uTint[SHARDS];
    uniform vec4 uCamMode[SHARDS];
    uniform vec2 uImpact;
    uniform float uTime;
    uniform float uLive;
    // the breath
    uniform float uFog;
    uniform vec2 uBreathAt;
    uniform vec3 uClear;
    uniform sampler2D tWrite;
    uniform vec4 uWriteRect;
    uniform float uWriteT;
    uniform float uWriteSec;
    uniform float uRefog;
    uniform vec4 uDrip0;
    uniform vec4 uDrip1;
    // your face
    uniform sampler2D tCam;
    uniform sampler2D tRing;
    uniform float uCam;
    uniform vec4 uCamCrop;
    uniform vec4 uSelfAt[SELF_COUNT];
    uniform vec4 uSelfKind[SELF_COUNT];
    uniform float uRingHead;
    uniform float uRingCount;
    varying vec2 vP;

    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    // a point on the glass (local metres) to where it lands in the reflection
    vec2 toTex(vec2 p) {
        vec4 c = uTexMatrix * vec4(p, 0.0, 1.0);
        return c.xy / c.w;
    }

    // a soft five-tap read, so the old glass never looks quite sharp
    vec3 readReflection(vec2 uv, float lod) {
        vec2 r = exp2(lod) * 0.75 / uTexSize;
        vec3 c = textureLod(tReflect, uv, lod).rgb * 0.4;
        c += textureLod(tReflect, uv + vec2(r.x, r.y * 0.4), lod).rgb * 0.15;
        c += textureLod(tReflect, uv + vec2(-r.x * 0.4, r.y), lod).rgb * 0.15;
        c += textureLod(tReflect, uv + vec2(-r.x, -r.y * 0.4), lod).rgb * 0.15;
        c += textureLod(tReflect, uv + vec2(r.x * 0.4, -r.y), lod).rgb * 0.15;
        return c;
    }

    // how far a point is inside the glass's outline
    float glassEdge(vec2 p) {
        float top = ARCH_CY + sqrt(max(0.0, ARCH_R * ARCH_R - p.x * p.x));
        return min(min(p.x + GLASS_HALF, GLASS_HALF - p.x), min(p.y - GLASS_BOTTOM, top - p.y));
    }

    // a cell of the ring of past frames
    vec2 ringUv(float cell, vec2 uv) {
        return (vec2(mod(cell, RING_GRID), floor(cell / RING_GRID)) + clamp(uv, 0.004, 0.996)) * RING_CELL;
    }

    vec3 camNow(vec2 uv) {
        vec2 c = uCamCrop.xy + clamp(uv, 0.0, 1.0) * uCamCrop.zw;
        vec2 o = vec2(0.0011, 0.0015);
        return 0.25 * (texture2D(tCam, c + o).rgb + texture2D(tCam, c - o).rgb + texture2D(tCam, c + vec2(o.x, -o.y)).rgb + texture2D(tCam, c + vec2(-o.x, o.y)).rgb);
    }

    vec3 camBefore(float seconds, vec2 uv) {
        float k = min(floor(seconds * RING_FPS), max(uRingCount - 1.0, 0.0));
        return texture2D(tRing, ringUv(mod(uRingHead - k + RING_FRAMES, RING_FRAMES), uv)).rgb;
    }

    void main() {
        #include <logdepthbuf_fragment>
        vec2 p = vP;
        float px = max(fwidth(p.x), fwidth(p.y)) + 1e-6; // metres per pixel

        // cracks wander a little instead of running ruler-straight
        vec2 q = p + 0.007 * (vec2(vnoise(p * 16.0), vnoise(p * 16.0 + 7.3)) - 0.5);

        // Which shard: the nearest seed. The second nearest is almost always
        // the one across the closest border, so its bisector gives the
        // distance to the crack in a single pass over the seeds.
        int id = 0;
        int nb = 0;
        float d1 = 1e9;
        float d2 = 1e9;
        for (int i = 0; i < SHARDS; i++) {
            vec2 d = q - uSeeds[i];
            float dd = dot(d, d);
            if (dd < d1) {
                d2 = d1;
                nb = id;
                d1 = dd;
                id = i;
            } else if (dd < d2) {
                d2 = dd;
                nb = i;
            }
        }
        vec2 s0 = uSeeds[id];
        vec2 edgeN = normalize(uSeeds[nb] - s0);
        float edge = dot(0.5 * (s0 + uSeeds[nb]) - q, edgeN);

        vec4 shift = uShift[id];
        vec4 warp = uWarp[id];
        vec4 tint = uTint[id];
        bool hole = shift.w > 0.5;
        vec3 sil = texture2D(tSilver, (p - uBounds.xy) / uBounds.zw).rgb;

        // the light in front of the mirror, very blurred: what lights the dust, the backing, the broken edges, the fog
        vec2 uv0 = toTex(p);
        vec3 ambient = textureLod(tReflect, uv0, 6.0).rgb * uLive;

        // ---- breath on the glass: it spreads from where your mouth is, unevenly, a little differently on each piece
        float fogN = vnoise(p * 7.0) * 0.55 + vnoise(p * 19.0 + 3.1) * 0.3 + vnoise(p * 53.0 + 7.7) * 0.15;
        float density = 0.0;
        float trail = 0.0; // where the finger has wiped it
        float rim = 0.0; // water pushed up along the wiped line
        if (uFog > 0.001 && !hole) {
            float reach = uFog * 2.7;
            float rB = length((p - uBreathAt) * vec2(1.0, 0.85)) + (fogN - 0.5) * 0.5;
            density = uFog * smoothstep(reach, reach - 0.45, rB) * shift.z * (0.7 + 0.45 * fogN);
            if (uClear.z > 0.001) density *= smoothstep(uClear.z - 0.45, uClear.z + 0.1, length(p - uClear.xy) + (fogN - 0.5) * 0.35);
            // the fog creeping back over the writing, patch by patch
            float back = 1.0 - smoothstep(fogN * 0.7, fogN * 0.7 + 0.3, uRefog);
            // the finger's writing
            vec2 wuv = (p - uWriteRect.xy) / uWriteRect.zw;
            if (uWriteT >= 0.0 && wuv.x > 0.0 && wuv.y > 0.0 && wuv.x < 1.0 && wuv.y < 1.0) {
                vec4 w = texture2D(tWrite, wuv);
                float passed = smoothstep(w.r, w.r + 0.015, uWriteT) * step(w.r, 0.995);
                trail = smoothstep(0.1, 0.55, w.g) * passed * back;
                rim = smoothstep(0.0, 0.12, w.g) * (1.0 - smoothstep(0.12, 0.4, w.g)) * passed * back;
            }
            // a drop gathers at the foot of a stroke and runs
            if (uWriteT >= 0.0) {
                for (int i = 0; i < 2; i++) {
                    vec4 dr = i == 0 ? uDrip0 : uDrip1;
                    float t = uWriteSec - dr.z;
                    if (dr.w <= 0.0 || t <= 0.0) continue;
                    float len = dr.w * (1.0 - exp(-t * 0.55));
                    float y = dr.y - p.y;
                    float x = dr.x + 0.0022 * sin(y * 95.0 + dr.x * 40.0) - p.x;
                    float w = mix(0.0026, 0.0016, clamp(y / max(len, 0.001), 0.0, 1.0));
                    float run = (1.0 - smoothstep(w * 0.6, w + px, abs(x))) * step(0.0, y) * step(y, len);
                    float bead = 1.0 - smoothstep(0.0038, 0.0048 + px, length(vec2(x, y - len)));
                    trail = max(trail, max(run, bead) * back);
                    rim = max(rim, bead * 0.6 * back);
                }
            }
            density *= 1.0 - trail * 0.96;
        }

        // Each shard sits at its own small angle: it sees the room a little
        // shifted, turned and scaled, slowly breathing.
        float ph = uTime * warp.w + warp.z;
        float ang = warp.x + 0.03 * sin(ph);
        float sc = warp.y * (1.0 + 0.02 * sin(ph * 0.73 + 1.7));
        vec2 drift = 0.008 * vec2(sin(ph * 0.61 + 0.4), cos(ph * 0.83));
        float ca = cos(ang);
        float sa = sin(ang);
        // and old hand-made glass is never quite flat: a slow, faint waver
        vec2 waver = 0.0035 * (vec2(vnoise(p * 2.3 + uTime * 0.02), vnoise(p * 2.3 + 5.1 - uTime * 0.017)) - 0.5);
        vec2 uv = toTex(s0 + shift.xy + drift + mat2(ca, sa, -sa, ca) * (p - s0) * sc + waver);

        // pick a mip level from the pixel's footprint so a distant mirror doesn't shimmer; fog frosts it further
        vec2 du = dFdx(uv0) * uTexSize;
        vec2 dv = dFdy(uv0) * uTexSize;
        float footprint = 0.5 * log2(max(max(dot(du, du), dot(dv, dv)), 1e-8));
        float lod = max(footprint + log2(sc), 0.0) + 0.4 + sil.b * 1.6 + density * 3.2;
        vec3 refl = readReflection(uv, lod) * uLive;

        // old silver: a little dim, warm and greyed
        float lum = dot(refl, vec3(0.2126, 0.7152, 0.0722));
        refl = mix(refl, vec3(lum), 0.25) * vec3(1.0, 0.93, 0.82) * 0.8;

        // ---- your selves, if the camera is on: some pieces each reflect a different you, edge to edge
        float camVis = 0.0;
        int who = int(uCamMode[id].x + 0.5) - 1;
        if (uCam > 0.001 && !hole && who >= 0) {
            vec4 at = uSelfAt[who];
            vec4 kind = uSelfKind[who];
            int mode = int(kind.x + 0.5);
            // the piece's own small angle and drift, so it never quite lines up with its neighbours
            vec2 cp = s0 + shift.xy * 0.4 + drift * 0.6 + mat2(ca, sa, -sa, ca) * (p - s0) * sc;
            // the picture: centred on the piece, turned, covering it to the crack, cropped in by its zoom
            float ct = cos(at.w);
            float st = sin(at.w);
            vec2 fuv = mat2(ct, -st, st, ct) * (cp - at.xy) / at.z;
            fuv = fuv / kind.z + vec2(0.5, 0.53);
            fuv.x = 1.0 - fuv.x; // a mirror
            camVis = uCam;
            vec3 c = mode == 2 ? texture2D(tRing, ringUv(RING_STILL, fuv)).rgb : kind.y > 0.0 ? camBefore(kind.y, fuv) : camNow(fuv);
            c = pow(c, vec3(2.2));
            float cl = dot(c, vec3(0.2126, 0.7152, 0.0722));
            // bring any room to the theatre's light: a dim one is lifted, a bright one rolls off, nothing glows
            c *= 0.085 / (cl + 0.07);
            cl = dot(c, vec3(0.2126, 0.7152, 0.0722));
            vec3 g;
            if (mode == 3) {
                // drained and aged: sepia, flat, grainy, spotted
                float grain = hash12(floor(p * 900.0) + floor(uTime * 14.0)) - 0.5;
                g = (mix(cl, 0.05, 0.4) + grain * 0.016) * vec3(1.15, 0.86, 0.56);
                g *= 1.0 - 0.6 * smoothstep(0.55, 0.85, vnoise(p * 38.0 + 2.0)) - 0.5 * sil.g;
            } else if (mode == 2) {
                // the still that never blinks: cold, grey, a little dimmer
                g = vec3(cl) * vec3(0.72, 0.85, 1.05) * 1.3;
            } else {
                // you now: warm, as if the lamps were on you; the late ones run colder
                g = mix(c, vec3(cl), 0.5) * vec3(1.0, 0.88, 0.74);
                if (mode == 1) g = mix(c, vec3(cl), 0.6) * vec3(0.85, 0.9, 0.98) * 0.9;
            }
            // the reflection of the corridor still lies faintly under it, as in any glass
            refl = mix(refl, g, uCam * 0.86);
        }

        // each shard's own colour, the many selves
        lum = dot(refl, vec3(0.2126, 0.7152, 0.0722));
        refl = mix(refl, lum * tint.rgb, tint.a * (1.0 - 0.8 * camVis));
        refl *= 0.84 + 0.26 * hash12(vec2(float(id) * 7.13, 3.1));
        // foxing stains it brown
        refl = mix(refl, refl * vec3(0.32, 0.2, 0.11), sil.g * 0.9);

        // where the silver is gone you see the dark backing through the glass
        float silver = sil.r * (1.0 - 0.6 * exp(-edge / 0.008));
        // the backing: an old board, its grain running up the mirror, blotched with dried paint
        float grain = vnoise(vec2(p.x * 9.0, p.y * 150.0)) * 0.55 + vnoise(p * 48.0) * 0.45;
        vec3 board = vec3(0.05, 0.036, 0.026) * (0.35 + 0.9 * grain) * (0.7 + 0.5 * vnoise(p * 6.0 + 3.0));
        vec3 backing = board * (ambient * 6.0 + 0.11);
        vec3 col = mix(backing, refl, silver);

        // foxing: where it has eaten the silver it scatters a faint milky brown
        col = mix(col, ambient * vec3(0.45, 0.36, 0.26) + vec3(0.004, 0.003, 0.002), sil.g * 0.5);
        // dust and haze on the glass, lit by the room
        col += ambient * vec3(1.0, 0.9, 0.78) * (0.03 + 0.12 * sil.b);

        // two shards are gone: bare backing, in the shadow of the glass around it
        if (hole) {
            col = backing * (0.25 + 0.75 * smoothstep(0.0, 0.035, edge)) * 0.8;
            // flakes of silver left stuck to the board along the break
            float flake = (1.0 - smoothstep(0.0, 0.014, edge - 0.008 * vnoise(p * 90.0))) * step(0.55, vnoise(p * 260.0));
            col = mix(col, refl * 0.5 + ambient * 0.3, flake * 0.7);
        }

        // the cracks: a dark hairline with the broken edge beside it catching the light
        bool besideHole = uShift[nb].w > 0.5 && !hole;
        float w = besideHole ? 0.0005 : 0.0009;
        float core = (1.0 - smoothstep(0.0, w + px, edge)) * clamp(2.0 * w / px, 0.3, 1.0);
        float lit = pow(clamp(dot(-edgeN, normalize(vec2(0.3, 1.0))) * 0.5 + 0.5, 0.0, 1.0), 2.5);
        float bw = besideHole ? 0.005 : 0.0022;
        float bevel = smoothstep(w * 0.5, w + px, edge) * (1.0 - smoothstep(w + bw * 0.6, w + bw + px, edge)) * clamp(bw / px, 0.2, 1.0);
        float catchy = smoothstep(0.35, 0.8, vnoise(q * 70.0)); // it only catches in places
        vec3 glint = (ambient * 3.0 + vec3(0.006, 0.0045, 0.003)) * (0.12 + 1.5 * lit) * (0.25 + 1.1 * catchy) * (besideHole ? 1.8 : 1.0);
        col = col * (1.0 - 0.9 * core) + glint * bevel * (hole ? 0.0 : 1.0);

        // fine radial cracks running out from the point of impact
        vec2 dI = p - uImpact;
        float rI = length(dI);
        float k = 29.0;
        float f = atan(dI.y, dI.x) / 6.2831853 * k + 0.9 * vnoise(vec2(rI * 11.0, 0.0));
        float run = 0.05 + 0.32 * pow(hash12(vec2(floor(f), 9.7)), 1.5);
        float dArc = abs(fract(f) - 0.5) * 6.2831853 * rI / k;
        float hair = (1.0 - smoothstep(0.0, 0.0004 + px, dArc)) * (1.0 - smoothstep(run * 0.5, run, rI)) * smoothstep(0.01, 0.025, rI) * clamp(0.0012 / px, 0.15, 1.0);
        col = mix(col, col * 0.25 + glint * 0.9, hair * 0.9 * (hole ? 0.0 : 1.0));
        // at the very centre the glass is crushed white
        float crush = (1.0 - smoothstep(0.006, 0.03, rI + 0.006 * vnoise(p * 300.0)));
        col = mix(col, ambient * 2.5 + lum * 0.25 + vec3(0.01, 0.008, 0.006), crush * 0.75);

        // ---- the fog itself, on the glass in front of all of it: grey-white, lit faintly by the room
        if (uFog > 0.001) {
            // breath scatters whatever light there is: pale, a little cooler than the lamps
            float aL = dot(ambient, vec3(0.2126, 0.7152, 0.0722));
            vec3 fogLight = mix(ambient, vec3(aL), 0.6) * 2.0 + vec3(0.024, 0.025, 0.028);
            col = mix(col, fogLight, clamp(density, 0.0, 1.0) * 0.88);
            col += fogLight * rim * 0.45;
            // beads of water where it thins at its edge, along the cracks and the frame, beside the writing
            float thin = smoothstep(0.08, 0.3, density) * (1.0 - smoothstep(0.3, 0.6, density));
            float zone = clamp(thin * 1.2 + (1.0 - smoothstep(0.0, 0.05, edge)) * 0.6 * density + (1.0 - smoothstep(0.0, 0.08, glassEdge(p))) * uFog + rim * 1.2, 0.0, 1.0);
            if (zone > 0.01 && !hole) {
                vec2 cell = floor(p / 0.006);
                vec2 c = (cell + 0.25 + 0.5 * vec2(hash12(cell + 7.1), hash12(cell + 3.3))) * 0.006;
                float r = 0.0009 + 0.0014 * hash12(cell + 9.9);
                float drop = (1.0 - smoothstep(r - px, r + px, length(p - c))) * step(1.0 - zone * 0.9, hash12(cell));
                float hl = 1.0 - smoothstep(0.0, r * 0.45, length(p - c - vec2(-0.35, 0.4) * r));
                col = mix(col, refl * 0.7, drop * 0.7) + (ambient * 4.0 + 0.03) * hl * drop;
            }
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
    }
`;

let blankWrite: THREE.DataTexture | null = null;
/** Nothing written: every pixel "never". */
export function getBlankWrite() {
    if (!blankWrite) {
        blankWrite = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        blankWrite.needsUpdate = true;
    }
    return blankWrite;
}

export function makeGlassMaterial() {
    const s = getShards();
    return new THREE.ShaderMaterial({
        defines: {
            SHARDS: s.count,
            GLASS_HALF: GLASS.half.toFixed(4),
            GLASS_BOTTOM: GLASS.bottom.toFixed(4),
            ARCH_CY: ARCH.cy.toFixed(4),
            ARCH_R: ARCH.radius.toFixed(4),
            RING_GRID: RING.grid.toFixed(1),
            RING_CELL: (RING.cell / RING.size).toFixed(6),
            RING_FRAMES: RING.frames.toFixed(1),
            RING_FPS: RING.fps.toFixed(1),
            RING_STILL: RING.still.toFixed(1),
            SELF_COUNT: SELVES.length,
        },
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                tReflect: { value: null },
                tSilver: { value: null },
                uTexMatrix: { value: new THREE.Matrix4() },
                uTexSize: { value: new THREE.Vector2(1, 1) },
                uBounds: { value: new THREE.Vector4(-GLASS.half, GLASS.bottom, 2 * GLASS.half, GLASS.apex - GLASS.bottom) },
                uSeeds: { value: s.seeds },
                uShift: { value: s.shift },
                uWarp: { value: s.warp },
                uTint: { value: s.tint },
                uCamMode: { value: s.cam },
                uImpact: { value: IMPACT.clone() },
                uTime: { value: 0 },
                uLive: { value: 0 },
                uFog: { value: 0 },
                uBreathAt: { value: new THREE.Vector2(0, 1.5) },
                uClear: { value: new THREE.Vector3() },
                tWrite: { value: null },
                uWriteRect: { value: new THREE.Vector4(0, 0, 1, 1) },
                uWriteT: { value: -1 },
                uWriteSec: { value: 0 },
                uRefog: { value: 0 },
                uDrip0: { value: new THREE.Vector4() },
                uDrip1: { value: new THREE.Vector4() },
                tCam: { value: null },
                tRing: { value: null },
                uCam: { value: 0 },
                uCamCrop: { value: new THREE.Vector4(0, 0, 1, 1) },
                uSelfAt: { value: s.selfAt },
                uSelfKind: { value: s.selfKind },
                uRingHead: { value: 0 },
                uRingCount: { value: 0 },
            },
        ]),
        vertexShader,
        fragmentShader,
        fog: true,
    });
}
