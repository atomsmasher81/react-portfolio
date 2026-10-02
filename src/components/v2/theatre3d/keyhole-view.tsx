'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, createPortal, useFrame, useThree, type RootState } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import { TheatreDoor } from "@/components/v2/theatre3d/door";
import { Environment } from "@/components/v2/theatre3d/environment";
import { Marquee } from "@/components/v2/theatre3d/marquee";
import { Silhouette } from "@/components/v2/theatre3d/mirror-figure";
import { CAMERA, CORRIDOR, DOOR_S, INNER, MARQUEE_S, MARQUEE_Y, OUTER, PALETTE, onArc, yawFacingBack, yawFromOuterWall } from "@/components/v2/theatre3d/layout";
import { canvasTextureWork, fbm, heightCanvasWork, normalFromHeightWork, once, paintPixelsWork, suspendUntil, type Work } from "@/components/v2/theatre3d/textures";
import { prepareCorridorShell, prepareDoors, prepareMarquee } from "@/components/v2/theatre3d/prepare";
import { usePlates } from "@/components/v2/theatre-data";
import { AT_REST, TIMELINES, TIMELINE_REDUCED, moment, type Entry, type KeyholeMoment, type Timeline } from "@/components/v2/theatre3d/keyhole-timeline";
import { isPortrait, theatreFov, viewAt } from "@/components/v2/theatre3d/walk";
import { compileQuietly } from "@/components/v2/theatre3d/gpu";

// The way into the theatre on the Now and Journey pages: an old iron keyhole
// plate, in 3D, sitting on the page. Through the hole you see the real
// corridor (drawn separately and shown only through the hole).
//
// Going through (`startedAt`, the click time, on the clock in
// keyhole-timeline.ts): the canvas quietly takes the whole screen, with the
// plate exactly where it was, and the camera leans in and goes through the
// keyhole into the dark on the other side. In the "light" entry a golden
// light shines out of the hole first, and then the light itself turns dark,
// rippling as it changes.
//
// Before it's ever seen, it gets itself ready (`onReady`): everything through
// the hole is built, every shader compiled (in parallel, off the page's main
// thread where the browser can) and a frame drawn out of sight, so the first
// frame anyone sees is as quick as every other. Until then it draws nothing
// (the sign shows its silhouette meanwhile). And once the hole fills the screen, the
// view through it takes on the theatre's own look (VIEW_FRAG), so the theatre
// itself can fade in over it without anything changing (theatre-host.tsx).

/** Where the keyhole's canvas sits around its 120 × 200 box on the page (css px): room for its shadow and its light. */
export const KEYHOLE_BOX = { left: -170, top: -78, width: 460, height: 620 };

// The camera looks straight at the plate with the keyhole's bowl on its axis,
// so leaning in keeps the hole where it is. Its principal point (where the
// axis meets the screen) starts where the bowl sits in the box and drifts to
// the middle of the screen as you go in. Lengths in css px.
const FOV = 43.7;
const FOCAL = KEYHOLE_BOX.height / 2 / Math.tan((FOV * Math.PI) / 360);
const LIFT = 1.3; // the plate sits high in its box, leaving room below for the light
const FACE = 0.03; // the plate's front face
const BOWL_Y = LIFT + 0.3;
const REST = 7.6 - FACE; // camera to plate, at rest
const CLOSE = 0.02; // and at the end: inside the keyhole
const REST_PP = { x: KEYHOLE_BOX.width / 2, y: KEYHOLE_BOX.height / 2 - (FOCAL * BOWL_Y) / REST };
// the view through the hole is drawn with this focal length (a 48° view over the box at rest)
const EYE_FOCAL = KEYHOLE_BOX.height / 2 / Math.tan((24 * Math.PI) / 180);

/** Run `f` once the page is idle (or after `timeout` ms at the latest). Returns a cancel. */
function idle(f: () => void, timeout: number) {
    if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(() => f(), { timeout });
        return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(f, Math.min(timeout, 1000)); // (no idle callbacks, as in Safari)
    return () => window.clearTimeout(id);
}

// What the canvas's parts share, read every frame (so changes never wait for React).
interface Live {
    startedAt: number | null;
    tl: Timeline;
    anchor: HTMLElement | null;
    m: KeyholeMoment;
    appearAt: number | null; // when it starts to show itself
    reveal: number; // how far it has, 0..1
    box: HTMLSpanElement | null;
    near: number; // how close to the plate, 0..1 (see aim)
    pp: THREE.Vector2; // where the keyhole's bowl is on the canvas
    size: THREE.Vector2; // the canvas
    ready: () => void; // it's all built, compiled and drawn once
    prepared: boolean; // and so the view through the hole can be drawn
    preparing: boolean; // (or it's being drawn out of sight, getting ready)
    hold: boolean; // not just now (see the prop)
}

export function KeyholeView({
    startedAt,
    entry = "dive",
    reduced = false,
    anchor,
    appearAt = null,
    onReady,
    hold = false,
}: {
    startedAt: number | null;
    entry?: Entry;
    reduced?: boolean;
    /** The 120 × 200 box the plate is drawn in. */
    anchor: HTMLElement | null;
    /** When it should start to show itself (it rises out of the shadow); until then it isn't there. */
    appearAt?: number | null;
    /** Everything is built, compiled and has been drawn once, out of sight: it can be shown without a stutter. */
    onReady?: () => void;
    /**
     * Something on the page is showing itself: hold off the steps of getting ready
     * that can't be done a slice at a time (compiling, the frames drawn out of sight).
     */
    hold?: boolean;
}) {
    const box = useRef<HTMLSpanElement>(null);
    const root = useRef<RootState | null>(null);
    const [visible, setVisible] = useState(false);
    const [ready, setReady] = useState(false);
    const full = startedAt !== null;
    const done = useRef(onReady);
    done.current = onReady;
    const live = useRef<Live>({
        startedAt,
        tl: TIMELINES.dive,
        anchor,
        m: AT_REST,
        appearAt,
        reveal: 0,
        box: null,
        near: 0,
        pp: new THREE.Vector2(REST_PP.x, REST_PP.y),
        size: new THREE.Vector2(KEYHOLE_BOX.width, KEYHOLE_BOX.height),
        ready: () => {
            live.current.prepared = true;
            setReady(true);
            done.current?.();
        },
        prepared: false,
        preparing: false,
        hold,
    });

    useLayoutEffect(() => {
        Object.assign(live.current, { startedAt, anchor, appearAt, hold, box: box.current, tl: reduced ? TIMELINE_REDUCED : TIMELINES[entry] });
    });

    // Going through, the canvas takes the whole screen so the camera can lean
    // into the keyhole. Resize it and draw a frame straight away, before the
    // browser paints, so there's never a stretched or empty frame.
    useLayoutEffect(() => {
        const r = box.current?.getBoundingClientRect();
        const state = root.current?.get();
        if (!full || !r || !state) return;
        state.setSize(r.width, r.height, true, r.top, r.left);
        state.advance(performance.now());
    }, [full]);

    useEffect(() => {
        if (!box.current) return;
        const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
        io.observe(box.current);
        return () => io.disconnect();
    }, []);

    // However getting ready goes (a font or the plaques that never come), it's never left unseen.
    useEffect(() => {
        const t = window.setTimeout(() => live.current.ready(), 15_000);
        return () => window.clearTimeout(t);
    }, []);

    return (
        <span
            ref={box}
            aria-hidden
            className={`pointer-events-none z-[85] block ${full ? "fixed inset-0" : "absolute"}`}
            style={full ? undefined : { left: KEYHOLE_BOX.left, top: KEYHOLE_BOX.top, width: KEYHOLE_BOX.width, height: KEYHOLE_BOX.height, opacity: 0 }}
        >
            <Canvas
                // nothing is drawn until it's all ready (it draws its frames out of sight itself)
                frameloop={full || (visible && ready) ? "always" : "never"}
                dpr={full ? [1, 1.5] : [1, 2]}
                camera={{ manual: true, fov: FOV, near: 0.015, far: 30, position: [0, BOWL_Y, FACE + REST], rotation: [0, 0, 0] }}
                onCreated={(state) => {
                    root.current = state;
                }}
                gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
            >
                <Suspense fallback={null}>
                    <group position={[0, LIFT, 0]}>
                        <Keyhole live={live} />
                    </group>
                </Suspense>
            </Canvas>
        </span>
    );
}

// The camera, every frame: where the box the plate was drawn in sits on the
// canvas (it's the canvas itself until you go through), how far in you are,
// and an off-centre projection that keeps the plate exactly in place.
function aim({ gl, camera }: RootState, live: Live, dive: number) {
    const c = gl.domElement.getBoundingClientRect();
    if (c.width < 1 || c.height < 1) return;
    const a = live.anchor?.getBoundingClientRect();
    const ox = a ? a.left + KEYHOLE_BOX.left - c.left : 0;
    const oy = a ? a.top + KEYHOLE_BOX.top - c.top : 0;
    // Distance falls geometrically (a steady approach feels like a steady zoom), slow at
    // first, so the hole only fills the screen about three quarters of the way in; the
    // rest is the passage through the iron. The hole drifts to the middle as it grows.
    const near = Math.pow(dive, 1.9);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(0, BOWL_Y, FACE + REST * Math.pow(CLOSE / REST, near));
    cam.rotation.set(0, 0, 0);
    cam.updateMatrixWorld();
    const centre = Math.min(1, near * 1.6);
    const px = THREE.MathUtils.lerp(ox + REST_PP.x, c.width / 2, centre);
    const py = THREE.MathUtils.lerp(oy + REST_PP.y, c.height / 2, centre);
    const n = cam.near;
    cam.projectionMatrix.makePerspective((-px * n) / FOCAL, ((c.width - px) * n) / FOCAL, (py * n) / FOCAL, (-(c.height - py) * n) / FOCAL, n, cam.far);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    live.near = near;
    live.pp.set(px, py);
    live.size.set(c.width, c.height);
}

/* ------------------------------------------------------- the plate */

// The escutcheon's outline and its keyhole (the plate is 1.06 × 1.92).
function plateShape() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.96);
    s.bezierCurveTo(0.33, 0.96, 0.53, 0.79, 0.53, 0.48);
    s.lineTo(0.53, -0.48);
    s.bezierCurveTo(0.53, -0.79, 0.33, -0.96, 0, -0.96);
    s.bezierCurveTo(-0.33, -0.96, -0.53, -0.79, -0.53, -0.48);
    s.lineTo(-0.53, 0.48);
    s.bezierCurveTo(-0.53, 0.79, -0.33, 0.96, 0, 0.96);
    s.holes.push(holePath());
    return s;
}

function holePath() {
    const h = new THREE.Path();
    h.moveTo(-0.08, 0.097);
    h.absarc(0, 0.3, 0.2, Math.atan2(-0.203, -0.08), Math.atan2(-0.203, 0.08), true);
    h.lineTo(0.14, -0.52);
    h.lineTo(-0.14, -0.52);
    h.closePath();
    return h;
}

const RIVETS: [number, number][] = [
    [0, 0.82],
    [0, -0.82],
    [-0.4, 0],
    [0.4, 0],
];

// Old wrought iron under black paint that has mostly given up: flaking,
// rust blooming through, rust running down from the rivets and the hole.
// Matte throughout: rust and old paint don't shine.
// Painted a slice at a time before the plate is first built (it suspends till then).
type IronMaps = { map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture };
function useIron() {
    suspendUntil("keyhole iron", () => ironPaint.built.prepare());
    return ironPaint();
}
const ironPaint = once(function* (): Work<IronMaps> {
    {
        const W = 256;
        const H = 448;
        const grain = fbm(41, 5);
        yield;
        const flake = fbm(77, 5);
        yield;
        const mottle = fbm(13, 4);
        yield;
        // where things leak from: the rivets and the bottom of the keyhole (canvas pixels)
        const sources = [...RIVETS.map(([x, y]) => [(x / 1.12 + 0.5) * W, (0.5 - y / 2) * H] as const), [W / 2, (0.5 + 0.52 / 2) * H] as const];
        const streak = (x: number, y: number) => {
            let s = 0;
            for (const [sx, sy] of sources) {
                const dy = y - sy;
                if (dy < 0 || dy > H * 0.3) continue;
                const wobble = Math.sin(dy * 0.08 + sx) * 2.5;
                const w = 3 + dy * 0.05;
                s += Math.max(0, 1 - Math.abs(x - sx - wobble) / w) * (1 - dy / (H * 0.3));
            }
            return Math.min(1, s);
        };
        const rustAt = (x: number, y: number) => {
            const nx = (x / W) * 2 - 1;
            const ny = (y / H) * 2 - 1;
            const rim = Math.max(0, Math.hypot(nx * 1.05, ny * 0.95) - 0.6) * 2.2;
            const peeled = flake(x / 28, y / 28) * 1.5 - 0.62 + rim;
            return Math.min(1, Math.max(0, peeled * 2.4) + streak(x, y) * 0.8);
        };
        const map = (yield canvasTextureWork(W, H, (ctx) =>
            paintPixelsWork(ctx, W, H, (x, y) => {
                const g = grain(x / 10, y / 10);
                const rust = rustAt(x, y);
                const m = mottle(x / 18, y / 18);
                // old black paint, gone grey-brown with age, and rust from deep brown to orange
                const paint = [30 + g * 14, 26 + g * 11, 24 + g * 9];
                const r = [70 + m * 70, 32 + m * 30, 16 + m * 12];
                return [paint[0] + (r[0] - paint[0]) * rust, paint[1] + (r[1] - paint[1]) * rust, paint[2] + (r[2] - paint[2]) * rust];
            }),
        )) as THREE.CanvasTexture;
        const roughnessMap = (yield canvasTextureWork(
            W,
            H,
            (ctx) =>
                paintPixelsWork(ctx, W, H, (x, y) => {
                    const v = 205 + rustAt(x, y) * 45 + grain(x / 5, y / 5) * 5;
                    return [v, v, v];
                }),
            { srgb: false },
        )) as THREE.CanvasTexture;
        const height = (yield heightCanvasWork(W, H, (ctx) =>
            paintPixelsWork(ctx, W, H, (x, y) => {
                // paint sits proud of the rust; the rust itself is pitted
                const rust = rustAt(x, y);
                const v = 150 - rust * 60 + (grain(x / 4, y / 4) - 0.5) * 40 * rust + (grain(x / 12, y / 12) - 0.5) * 18;
                return [v, v, v];
            }),
        )) as HTMLCanvasElement;
        const normalMap = (yield normalFromHeightWork(height, 2)) as THREE.CanvasTexture;
        for (const t of [map, roughnessMap, normalMap]) {
            // the extruded face's UVs are its x/y, so stretch the texture over the plate
            t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
            t.repeat.set(1 / 1.12, 1 / 2);
            t.offset.set(0.5, 0.5);
        }
        return { map, roughnessMap, normalMap };
    }
});

function Keyhole({ live }: { live: MutableRefObject<Live> }) {
    const iron = useIron();
    const geometry = useMemo(
        () =>
            new THREE.ExtrudeGeometry(plateShape(), {
                depth: 0.07,
                bevelEnabled: true,
                bevelThickness: 0.03,
                bevelSize: 0.025,
                bevelSegments: 3,
                curveSegments: 48,
            }),
        [],
    );
    const normalScale = useMemo(() => new THREE.Vector2(0.55, 0.55), []);
    const front = useRef<THREE.PointLight>(null);
    const behind = useRef<THREE.PointLight>(null);
    const sun = useRef<THREE.DirectionalLight>(null);
    const stage = useRef<THREE.Group>(null);
    const born = useRef<number | null>(null);
    const shadow = useMemo(() => ({ uShow: { value: 0 } }), []);
    // the view through the hole is a good deal more to build: in its own turn, when the page is idle
    const [glimpse, setGlimpse] = useState(false);
    useEffect(() => idle(() => setGlimpse(true), 600), []);

    useFrame((state) => {
        const L = live.current;
        const m = L.startedAt === null ? AT_REST : moment(performance.now() - L.startedAt, L.tl);
        L.m = m;
        aim(state, L, m.dive);

        // Showing itself: out of the dark and a little back from the wall, the light
        // finds it and it settles into place; its shadow comes with it. (If it's
        // still getting ready when it's due, it starts from its first frame on screen;
        // the frames drawn out of sight while getting ready don't count.)
        const now = performance.now();
        if (state.frameloop !== "never") born.current ??= now;
        const start = L.appearAt === null ? null : Math.max(L.appearAt, born.current ?? Infinity);
        const r = L.startedAt !== null ? 1 : start === null ? 0 : Math.min(1, Math.max(0, (now - start) / 2200));
        L.reveal = r;
        const out = 1 - Math.pow(1 - Math.min(1, r * 1.25), 3); // ease out
        if (L.box && L.startedAt === null) L.box.style.opacity = String(Math.min(1, r * 2.2));
        if (stage.current) {
            stage.current.position.set(0, (1 - out) * 0.06, -(1 - out) * 0.7);
            stage.current.rotation.z = (1 - out) * 0.06;
        }
        shadow.uShow.value = THREE.MathUtils.smoothstep(r, 0.25, 0.9);
        // a lamp somewhere behind the door, never quite steady; when the light turns
        // dark it stops lighting the iron
        const t = state.clock.elapsedTime;
        const flame = 0.9 + 0.1 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
        const glow = m.light * (1 - 0.85 * m.eclipse);
        if (front.current) front.current.intensity = glow * 2.4 * flame;
        if (behind.current) behind.current.intensity = (0.25 + glow * 5) * flame;
        // and the room's daylight goes as the page darkens
        if (sun.current) sun.current.intensity = 1.15 * (1 - 0.75 * m.page) * (0.08 + 0.92 * THREE.MathUtils.smoothstep(r, 0.1, 0.75));
    });

    return (
        <group ref={stage}>
            {/* the room the page sits in: soft daylight from up and to the left */}
            <directionalLight ref={sun} position={[-2.5, 3, 4]} intensity={1.15} color="#fff1e0" />
            <directionalLight position={[3, -1, 2]} intensity={0.2} color="#b9c6e0" />
            <ambientLight intensity={0.14} />

            {/* a soft shadow where the plate meets the page */}
            <mesh position={[0, 0, -0.12]}>
                <planeGeometry args={[1.9, 2.8]} />
                <shaderMaterial uniforms={shadow} transparent depthWrite={false} vertexShader={QUAD_VERT} fragmentShader={SHADOW_FRAG} />
            </mesh>

            <mesh geometry={geometry} position={[0, 0, -0.07]}>
                <meshStandardMaterial {...iron} metalness={0.15} roughness={1} normalScale={normalScale} />
            </mesh>
            {RIVETS.map(([x, y]) => (
                <mesh key={`${x}-${y}`} position={[x, y, 0.02]} scale={[1, 1, 0.5]}>
                    <sphereGeometry args={[0.045, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <meshStandardMaterial color="#3d2416" metalness={0.15} roughness={0.95} />
                </mesh>
            ))}

            {/* black behind the hole, until the view is there */}
            <mesh position={[0, -0.03, -0.1]}>
                <planeGeometry args={[0.6, 1.2]} />
                <meshBasicMaterial color="#070404" />
            </mesh>
            {/* what's on the other side, seen only through the hole (it takes a moment to
                build, so the plate shows first and the view comes in behind it) */}
            {glimpse && (
                <Suspense fallback={null}>
                    <View live={live} />
                </Suspense>
            )}
            {/* light catching the hole's inner walls, and the iron round it */}
            <pointLight ref={behind} position={[0, 0.05, -0.35]} color="#ffad6a" distance={1.6} decay={2} />
            <pointLight ref={front} position={[0.15, -0.25, 0.4]} color="#ffb57a" distance={2.2} decay={2} />
            <Rim live={live} />
            <Beam live={live} />
        </group>
    );
}

/* -------------------------------------------- through the keyhole */

// The corridor is drawn into a texture from just inside the entrance, then
// shown on a card behind the hole. The view is centred on the hole and wide
// enough to fill the screen, at a fixed scale, so as you come closer you see
// more of the corridor through it, as you would.
function View({ live }: { live: MutableRefObject<Live> }) {
    // with mip levels: the theatre's glow, as you come through, is made from them (VIEW_FRAG)
    const fbo = useFBO({ type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const get = useThree((s) => s.get);
    const world = useMemo(() => {
        const s = new THREE.Scene();
        s.background = new THREE.Color(PALETTE.void);
        s.fog = new THREE.FogExp2(PALETTE.fog, 0.075);
        return s;
    }, []);
    const eye = useMemo(() => new THREE.PerspectiveCamera(48, 0.6, 0.05, 40), []);
    const [built, setBuilt] = useState(false);

    // Getting ready, before it's ever seen: compile every shader that will be drawn,
    // through the hole (into the texture: no tone mapping, linear) and on this side,
    // waiting for them without holding up the page where the browser can compile in
    // parallel; then draw a frame out of sight, which uploads the textures. Parts
    // arrive late (the neon's letters once its type is measured), so go round again
    // until a round adds nothing new.
    useEffect(() => {
        if (!built) return;
        let alive = true;
        let cancel = () => {};
        const quiet = (ms: number) =>
            new Promise<void>((resolve) => {
                cancel = idle(resolve, ms);
            });
        const nap = (ms: number) =>
            new Promise<void>((resolve) => {
                const t = window.setTimeout(resolve, ms);
                cancel = () => window.clearTimeout(t);
            });
        (async () => {
            const { gl, scene, camera, advance } = get();
            let last = "";
            for (let round = 0; round < 12; round++) {
                await quiet(250);
                while (alive && live.current.hold) await nap(100);
                if (!alive) return;
                gl.setRenderTarget(fbo);
                const through = compileQuietly(gl, world, eye);
                gl.setRenderTarget(null);
                await Promise.all([through, compileQuietly(gl, scene, camera)]);
                if (!alive) return;
                // Draw everything, even what's out of view from here (it comes into view
                // on the way through, and some materials only settle what they are when
                // first drawn), so there's nothing left to compile or upload later.
                const culled: THREE.Object3D[] = [];
                const uncull = (o: THREE.Object3D) => {
                    if (!o.frustumCulled) return;
                    o.frustumCulled = false;
                    culled.push(o);
                };
                world.traverse(uncull);
                scene.traverse(uncull);
                live.current.preparing = true;
                advance(performance.now() / 1000);
                live.current.preparing = false;
                for (const o of culled) o.frustumCulled = true;
                const made = `${gl.info.programs?.length}:${gl.info.memory.textures}:${gl.info.memory.geometries}`;
                if (made === last) break;
                last = made;
            }
            if (alive) live.current.ready();
        })().catch(() => alive && live.current.ready());
        return () => {
            alive = false;
            cancel();
        };
    }, [built, get, fbo, world, eye, live]);
    const uniforms = useMemo(
        () => ({
            uView: { value: fbo.texture },
            uCenter: { value: new THREE.Vector2() },
            uSpan: { value: new THREE.Vector2(1, 1) },
            uLight: { value: 0 },
            uEclipse: { value: 0 },
            uFade: { value: 0 },
            uBoost: { value: 1.6 },
            uEmber: { value: 0 },
            uTime: { value: 0 },
            uTheatre: { value: 0 },
            uScreen: { value: new THREE.Vector2(1, 1) },
        }),
        [fbo],
    );

    useFrame(({ gl, scene, camera, clock }) => {
        const L = live.current;
        const dpr = gl.getPixelRatio();
        const { x: px, y: py } = L.pp;
        const { x: w, y: h } = L.size;
        const hx = Math.max(px, w - px, 1);
        const hy = Math.max(py, h - py, 1);
        // through the hole, a fixed scale (never wider than 75° top to bottom on tall
        // screens); once the hole fills the screen, ease to the theatre's own lens, so
        // the last frame here is the theatre's first
        const peek = Math.max(EYE_FOCAL, window.innerHeight / 2 / Math.tan((37.5 * Math.PI) / 180));
        const own = h / 2 / Math.tan((theatreFov(isPortrait()) * Math.PI) / 360);
        const focal = THREE.MathUtils.lerp(peek, own, THREE.MathUtils.smoothstep(L.near, 0.55, 1));
        eye.fov = (2 * Math.atan(hy / focal) * 180) / Math.PI;
        eye.aspect = hx / hy;
        eye.updateProjectionMatrix();
        uniforms.uCenter.value.set(px * dpr, (h - py) * dpr);
        uniforms.uSpan.value.set(2 * hx * dpr, 2 * hy * dpr);
        uniforms.uLight.value = L.m.light;
        uniforms.uEclipse.value = L.m.eclipse;
        uniforms.uFade.value = L.m.fade;
        uniforms.uBoost.value = THREE.MathUtils.lerp(1.6, 1.15, THREE.MathUtils.smoothstep(L.near, 0.3, 1));
        // once the hole fills the screen, the view takes on the theatre's own look (what
        // its film does: see VIEW_FRAG), so the theatre comes in over a view just like it
        uniforms.uTheatre.value = THREE.MathUtils.smoothstep(L.near, 0.5, 0.98);
        uniforms.uScreen.value.set(w * dpr, h * dpr);
        // the ember far in catches last, unsteadily
        const kindle = THREE.MathUtils.smoothstep(L.reveal, 0.6, 1);
        uniforms.uEmber.value = kindle * (kindle < 1 ? 0.6 + 0.4 * Math.abs(Math.sin(clock.elapsedTime * 23) * Math.sin(clock.elapsedTime * 7.3)) : 1);
        uniforms.uTime.value = clock.elapsedTime;
        // the corridor first, into the texture (once it's ready to be drawn; until then
        // it's dark in there), then the page-side scene on top
        gl.setRenderTarget(fbo);
        gl.clear();
        if (L.prepared || L.preparing) gl.render(world, eye);
        gl.setRenderTarget(null);
        gl.render(scene, camera);
    }, 1);

    return (
        <>
            {createPortal(<Glimpse eye={eye} live={live} onBuilt={setBuilt} />, world, { camera: eye })}
            <mesh position={[0, -0.03, -0.09]}>
                <planeGeometry args={[0.6, 1.2]} />
                <shaderMaterial uniforms={uniforms} vertexShader={QUAD_VERT} fragmentShader={VIEW_FRAG} toneMapped />
            </mesh>
        </>
    );
}

// Just inside the entrance, looking down the curve, a little restless. As you
// come through the keyhole the view settles, exactly, on where the theatre's
// walk begins, so the theatre can take over from this very frame.
function Glimpse({ eye, live, onBuilt }: { eye: THREE.PerspectiveCamera; live: MutableRefObject<Live>; onBuilt: (built: true) => void }) {
    const { plates } = usePlates();
    // Built a part at a time, each when the page is idle (the corridor, the marquee,
    // the doors are each a good deal of work), so the page never stops for long.
    const [parts, setParts] = useState(1);
    useEffect(() => {
        if (parts < 3) return idle(() => setParts((n) => n + 1), 400);
    }, [parts]);
    // all there once the doors are (they wait on their plaques, though not for ever)
    const [late, setLate] = useState(false);
    useEffect(() => {
        const t = window.setTimeout(() => setLate(true), 6000);
        return () => window.clearTimeout(t);
    }, []);
    useEffect(() => {
        if (parts >= 3 && (plates || late)) onBuilt(true);
    }, [parts, plates, late, onBuilt]);
    const v = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), startPos: new THREE.Vector3(), startLook: new THREE.Vector3() }), []);
    // each part painted and shaped beforehand, a slice at a time (prepare.ts): it waits here till then
    suspendUntil("corridor shell", prepareCorridorShell);
    if (parts >= 2) suspendUntil("marquee", prepareMarquee);
    if (parts >= 3) suspendUntil("doors 2", () => prepareDoors(2));
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        onArc(CAMERA.from + 0.03, CAMERA.radius + 0.15, CAMERA.eye - 0.05 + Math.sin(t * 0.7) * 0.012, v.pos);
        onArc(0.2, CORRIDOR.radius + 0.4, 1.55, v.look);
        v.look.x += Math.sin(t * 0.23) * 0.3;
        const settle = THREE.MathUtils.smoothstep(live.current.near, 0.15, 0.9);
        if (settle > 0) {
            viewAt(CAMERA.from, isPortrait(), v.startPos, v.startLook);
            v.pos.lerp(v.startPos, settle);
            v.look.lerp(v.startLook, settle);
        }
        eye.position.copy(v.pos);
        eye.lookAt(v.look);
    });
    return (
        <>
            <hemisphereLight args={["#3a2418", "#080404", 0.15]} />
            <Environment power={1} quality="low" />
            {parts >= 2 && (
                <group position={onArc(MARQUEE_S, CORRIDOR.radius, MARQUEE_Y)} rotation-y={yawFacingBack(MARQUEE_S)}>
                    <Marquee power={1} />
                </group>
            )}
            {parts >= 3 &&
                (plates ?? []).slice(0, 2).map((d, i) => (
                    <group key={d.id} position={onArc(DOOR_S[i], OUTER - 0.04)} rotation-y={yawFromOuterWall(DOOR_S[i])}>
                        <TheatreDoor index={i} plate={d.plate} state="idle" />
                    </group>
                ))}
            {parts >= 3 && <Passerby live={live} />}
        </>
    );
}

// Someone crosses the corridor, far in, every so often, and is gone.
function Passerby({ live }: { live: MutableRefObject<Live> }) {
    const ref = useRef<THREE.Group>(null);
    const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
    useFrame(({ clock }) => {
        const g = ref.current;
        if (!g) return;
        const walk = ((clock.elapsedTime + 4) % 13) / 5.5; // 5.5 s across, then an empty corridor for a while
        g.visible = walk < 1 && live.current.near < 0.2;
        if (!g.visible) return;
        onArc(0.27, INNER + 0.35, 0, v.a);
        onArc(0.27, OUTER - 0.35, 0, v.b);
        g.position.lerpVectors(v.a, v.b, walk);
        g.position.y = Math.abs(Math.sin(walk * Math.PI * 7)) * 0.025;
        g.lookAt(v.b.x, 0, v.b.z);
    });
    return (
        <group ref={ref}>
            <Silhouette />
        </group>
    );
}

/* --------------------------------------------------- the light */

// Light catching the rim of the keyhole, and a soft halo round it. When the
// light turns dark, a thin gold ring is what's left, like an eclipse.
function Rim({ live }: { live: MutableRefObject<Live> }) {
    const uniforms = useMemo(() => ({ uLight: { value: 0 }, uColor: { value: new THREE.Color("#ffb46e") } }), []);
    const mesh = useRef<THREE.Mesh>(null);
    useFrame(() => {
        const { light, eclipse } = live.current.m;
        uniforms.uLight.value = light * (1 - 0.55 * eclipse);
        if (mesh.current) mesh.current.visible = light > 0.002;
    });
    return (
        <mesh ref={mesh} position={[0, -0.02, 0.045]}>
            <planeGeometry args={[1.2, 1.5]} />
            <shaderMaterial uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={QUAD_VERT} fragmentShader={RIM_FRAG} />
        </mesh>
    );
}

// The light out of the keyhole, as a real volume: for every pixel, a ray is
// marched through a beam in the keyhole's own shape, spreading and softening
// as it goes (the lamp isn't a point, so the edges blur with distance), with
// dust drifting in it. When the light turns dark, the change travels down the
// beam from the hole, rippling at its front and here and there behind it,
// and the beam becomes a shaft of shadow taking light away from the page.
function Beam({ live }: { live: MutableRefObject<Live> }) {
    const geometry = useMemo(() => new THREE.PlaneGeometry(4.8, 6.5).translate(1.2, -2.25, FACE), []);
    const uniforms = useMemo(() => ({ uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uLight: { value: 0 }, uFront: { value: 0 } }), []);
    const mesh = useRef<THREE.Mesh>(null);
    useFrame(({ camera, clock }) => {
        const { light, front } = live.current.m;
        if (mesh.current) mesh.current.visible = light > 0.002;
        uniforms.uCam.value.copy(camera.position).y -= LIFT;
        uniforms.uTime.value = clock.elapsedTime;
        uniforms.uLight.value = light;
        uniforms.uFront.value = front;
    });
    return (
        <mesh ref={mesh} geometry={geometry} renderOrder={10} visible={false}>
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={BEAM_VERT}
                fragmentShader={BEAM_FRAG}
                transparent
                depthTest={false}
                depthWrite={false}
                blending={THREE.CustomBlending}
                blendSrc={THREE.OneFactor}
                blendDst={THREE.OneMinusSrcAlphaFactor}
                blendSrcAlpha={THREE.OneFactor}
                blendDstAlpha={THREE.OneMinusSrcAlphaFactor}
            />
        </mesh>
    );
}

/* -------------------------------------------------- shaders */

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The plate's shadow on the page: its own rounded shape (a stadium), offset
// down and right from a light up and to the left, tight and dark where the
// iron meets the page and soft further out.
const SHADOW_FRAG = /* glsl */ `
uniform float uShow;
varying vec2 vUv;
void main() {
    vec2 p = (vUv - 0.5) * vec2(1.9, 2.8) - vec2(0.035, -0.05);
    float d = length(vec2(p.x, max(abs(p.y) - 0.43, 0.0))) - 0.53;
    float contact = 1.0 - smoothstep(-0.02, 0.05, d);
    float soft = 1.0 - smoothstep(-0.05, 0.3, d);
    float a = (contact * 0.35 + soft * 0.22) * uShow;
    gl_FragColor = vec4(0.05, 0.05, 0.08, a);
}`;

// The corridor, as seen through the hole, a little brighter than it is so you
// can make it out from here (easing to its true brightness as you go in), with a faint warm breath from far in even when
// nothing is happening. The golden light fills the hole; when it turns dark
// the hole goes black; and on the far side, the dark (uFade).
//
// Coming through (uTheatre), the view takes on the theatre's own look, which
// is what its film does to the same picture (scene.tsx, Effects): no tone
// mapping, a glow round everything bright (its bloom: thresholded at 0.72 and
// screened on), and a heavy vignette. So when the theatre itself fades in
// over it, nothing changes: the lamps already glow.
const VIEW_FRAG = /* glsl */ `
uniform sampler2D uView;
uniform vec2 uCenter;
uniform vec2 uSpan;
uniform float uLight;
uniform float uEclipse;
uniform float uFade;
uniform float uBoost;
uniform float uEmber;
uniform float uTime;
uniform float uTheatre;
uniform vec2 uScreen;
varying vec2 vUv;

// what the theatre's bloom picks out, at one size of blur (a mip level of the
// view): the bright parts only (blurring spreads a light thin, so the threshold
// comes down with the blur)
vec3 bright(vec2 p, float lod, float threshold) {
    vec3 s = textureLod(uView, p, lod).rgb;
    return s * smoothstep(threshold, threshold + 0.25, dot(s, vec3(0.2126, 0.7152, 0.0722)));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - uCenter) / uSpan + 0.5;
    vec3 scene = texture2D(uView, uv).rgb;
    vec3 c = scene * uBoost;
    float flick = 0.94 + 0.06 * sin(uTime * 11.0) * sin(uTime * 4.3);
    float low = smoothstep(0.9, 0.0, length((vUv - vec2(0.5, 0.22)) * vec2(2.2, 1.6)));
    c += vec3(0.15, 0.055, 0.02) * low * flick * (1.0 - uLight) * uEmber;

    float core = smoothstep(0.75, 0.0, length((vUv - vec2(0.5, 0.36)) * vec2(1.9, 1.2)));
    vec3 gold = mix(vec3(0.9, 0.42, 0.16), vec3(1.0, 0.8, 0.55), core) * mix(1.1, 2.0, uLight) * flick;
    c = mix(c, gold, smoothstep(0.0, 0.8, uLight) * (0.7 + 0.3 * core));
    c *= 1.0 - 0.97 * uEclipse * smoothstep(0.0, 0.3, uLight);
    #ifdef TONE_MAPPING
        c = toneMapping(c);
    #endif

    if (uTheatre > 0.0) {
        // its bloom, roughly: the bright parts, blurred near and far, screened on
        vec3 glow = bright(uv, 1.0, 0.72) * 0.33 + bright(uv, 2.0, 0.55) * 0.23 + bright(uv, 3.0, 0.4) * 0.17
            + bright(uv, 4.0, 0.28) * 0.12 + bright(uv, 5.0, 0.2) * 0.09 + bright(uv, 6.0, 0.15) * 0.06;
        glow *= 1.15;
        vec3 s = min(scene, vec3(1.0));
        vec3 t = min(s + glow - s * glow, vec3(1.0));
        // its vignette (offset 0.2, darkness 0.9), over the whole screen
        float v = distance(gl_FragCoord.xy / uScreen, vec2(0.5));
        t *= smoothstep(0.8, 0.2 * 0.799, v * (0.9 + 0.2));
        c = mix(c, t, uTheatre);
    }
    c *= 1.0 - uFade;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
}`;

const RIM_FRAG = /* glsl */ `
uniform float uLight;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
    vec2 p = (vUv - 0.5) * vec2(1.2, 1.5);
    p.y += 0.02;
    float hole = min(length(p - vec2(0.0, 0.3)) - 0.2, max(abs(p.x) - 0.11, abs(p.y + 0.2) - 0.32));
    float outside = hole > 0.0 ? 1.0 : 0.0;
    float a = (exp(-hole * 26.0) * 0.9 + exp(-hole * 7.0) * 0.14) * outside * uLight;
    gl_FragColor = vec4(uColor * a, a * 0.5);
}`;

const BEAM_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uCam;
uniform float uTime;
uniform float uLight;
uniform float uFront;
varying vec3 vPos;

const float Z0 = ${FACE.toFixed(3)};
const float LEN = 3.6;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// the keyhole's shape, as a distance (negative inside)
float keyhole(vec2 p) {
    float bowl = length(p - vec2(0.0, 0.3)) - 0.2;
    float k = clamp((0.097 - p.y) / 0.617, 0.0, 1.0);
    float slot = max(abs(p.x) - mix(0.08, 0.14, k), max(p.y - 0.2, -0.52 - p.y));
    return min(bowl, slot);
}

void main() {
    // the lamp behind the door moves a little, so the beam is never quite still
    vec3 dir = normalize(vec3(0.42 + 0.012 * sin(uTime * 0.63), -0.86 + 0.008 * sin(uTime * 0.41 + 1.0), 0.55));
    vec3 rd = normalize(vPos - uCam);
    float t0 = max(0.0, (Z0 + dir.z * LEN - uCam.z) / rd.z);
    float t1 = (Z0 - uCam.z) / rd.z;
    const int N = 26;
    float dt = (t1 - t0) / float(N);
    float jitter = hash(gl_FragCoord.xy + fract(uTime * 7.3) * 31.0);
    float front = uFront * LEN;
    bool turning = uFront > 0.0;
    vec3 warm = vec3(0.0);
    float dark = 0.0;
    for (int i = 0; i < N; i++) {
        vec3 p = uCam + rd * (t0 + (float(i) + jitter) * dt);
        float s = (p.z - Z0) / dir.z;
        if (s < 0.0 || s > LEN) continue;
        float grow = 1.0 + 0.3 * s;
        vec2 q = (p.xy - dir.xy * s) / grow;
        float turned = 0.0;
        float r = 0.0;
        if (turning) {
            // where the light is changing, and behind it: ripples, here and there
            turned = smoothstep(front + 0.3, front - 0.3, s);
            float edge = exp(-pow((s - front) / 0.35, 2.0));
            float patches = smoothstep(0.5, 0.85, noise(vec2(s * 1.6 - uTime * 0.5, q.x * 5.0 + q.y * 3.0)));
            r = sin(s * 20.0 - uTime * 6.0 + noise(q * 6.0 + uTime * 0.2) * 5.0) * (edge * 0.9 + turned * patches * 0.7);
            q *= 1.0 + 0.045 * r;
        }
        // soft edges that widen with distance, as light from a lamp (not a point) does
        float soft = 0.012 + 0.075 * s;
        float d = keyhole(q);
        float inside = 1.0 - smoothstep(-soft, soft, d);
        if (inside <= 0.0) continue;
        float fall = (1.0 / (grow * grow)) * smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(LEN * 0.45, LEN, s));
        float dust = 0.75 + 0.25 * noise(p.xy * 2.6 + vec2(p.z * 1.3, uTime * 0.04));
        float amount = inside * fall * dust * dt;
        float core = 1.0 - smoothstep(-0.1, 0.02, d);
        warm += amount * (1.0 - turned) * mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.86, 0.62), core);
        dark += amount * turned * (1.0 + 0.5 * r);
    }
    vec3 gold = warm * 3.2 * uLight;
    float shade = (1.0 - exp(-dark * 11.0)) * uLight;
    // premultiplied: the gold adds light, the dark takes it away
    vec3 col = gold * (1.0 - shade) + vec3(0.008, 0.008, 0.016) * shade;
    float alpha = clamp(dot(gold, vec3(0.3)) * 0.35, 0.0, 1.0) * (1.0 - shade) + shade;
    gl_FragColor = vec4(col, alpha);
}`;
