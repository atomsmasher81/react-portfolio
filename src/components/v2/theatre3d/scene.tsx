'use client';

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { TheatreDoor, type DoorProps } from "@/components/v2/theatre3d/door";
import { D, HINGE_X } from "@/components/v2/theatre3d/door-variants";
import { roomGeometry } from "@/components/v2/theatre3d/door-geometry";
import { Environment } from "@/components/v2/theatre3d/environment";
import { Marquee } from "@/components/v2/theatre3d/marquee";
import { HIDDEN_FROM_MIRROR, MIRROR_LAYER, SteppenwolfMirror } from "@/components/v2/theatre3d/mirror";
import { CAMERA, CORRIDOR, DOOR_S, FOG_DENSITY, MARQUEE_S, MARQUEE_Y, MIRROR_S, OUTER, PALETTE, onArc, yawFacingBack, yawFromOuterWall } from "@/components/v2/theatre3d/layout";
import { ROOM_ENTRY, isPortrait, readingPose, theatreFov, viewAt } from "@/components/v2/theatre3d/walk";
import { Chamber, type ChamberShot } from "@/components/v2/theatre3d/chamber";
import { ROOM } from "@/components/v2/theatre3d/chamber-geometry";
import { compileByParts, drawAll, introduceSome, picturesOf, programsReady, uploadSome } from "@/components/v2/theatre3d/gpu";
import { prepareCorridor, prepareDoor, prepareEntrance } from "@/components/v2/theatre3d/prepare";
import { lampsLit } from "@/components/v2/theatre3d/readiness";
import { prepareChamberTextures } from "@/components/v2/theatre3d/chamber-textures";
import { suspendUntil } from "@/components/v2/theatre3d/textures";
import { FILM } from "@/components/v2/theatre3d/look";
import type { Room } from "@/data/v2/theatre";

// The whole theatre in one canvas. The page around it owns the content and
// state (which doors exist, which is open); this draws the place and walks the
// camera through it as the page scrolls.
//
// Behind the door you knock on is its room (chamber.tsx), really there, right
// behind the wall: while you're in the corridor it's drawn through the doorway
// (a portal: the room rendered from your own eye, pasted into the doorway), so
// as the leaf swings you see the shrine and its candles; then the camera walks
// through the doorway in one move, and from the moment it passes the doorway
// it sees only the room. Both are drawn from the same eye, so there is no cut.

export type Quality = "high" | "low";

export interface SceneDoor {
    id: string;
    plate: string;
    state: DoorProps["state"];
}

/** The room behind the door being visited, built and ready to draw. */
export interface SceneRoom {
    door: number;
    id: string;
    room: Room;
    plate: string;
}

/**
 * Going through a door: you knock and the camera steps up while the room is
 * built behind it and the leaf swings open ("door"); one move carries you
 * over the threshold to the shrine ("enter"); you read ("inside"); and the
 * same move backwards takes you out to where you stood ("exit"), back to
 * walking ("walk").
 */
export type VisitStage = "walk" | "door" | "enter" | "inside" | "exit";

/**
 * What the scene tells the page as a visit goes on: the room is drawn in the
 * doorway, so the door can open ("ready"); the camera has set off through it
 * ("enter"), arrived at the shrine ("inside"), or is back in the corridor
 * ("walk"); and the door has shut behind you, so the room can go ("shut").
 */
export type VisitEvent = "ready" | "enter" | "inside" | "walk" | "shut";

/** Shared, read and written every frame by the page and the scene (no re-renders). */
export interface Visit {
    stage: VisitStage;
    door: number;
    since: number; // when this stage began (performance.now)
    shot: ChamberShot | null; // what there is to read in the room (the scene writes it)
    scroll: number; // 0..1, down an inscription taller than the screen
    extra: number; // how much of it is out of view (m); written by the camera
    pull: number; // 0..1, pushing on past the end of it (on the way out)
    pullUntil: number; // the push holds until then (performance.now)
    // written by the scene:
    ready: boolean; // the room is drawn in the doorway
    readyAt: number;
    leaf: number; // 0..1, how far the door's leaf stands open
    through: boolean; // the camera is on the room's side of the doorway
}

export const newVisit = (): Visit => ({ stage: "walk", door: 0, since: 0, shot: null, scroll: 0, extra: 0, pull: 0, pullUntil: 0, ready: false, readyAt: 0, leaf: 0, through: false });

export interface TheatreSceneProps {
    doors: SceneDoor[];
    /** 0..1 along the walk, written by the page on scroll (a ref, so scrolling doesn't re-render). */
    progress: React.MutableRefObject<number>;
    /** The door being opened: the camera steps up to it. */
    focus: number | null;
    quality: Quality;
    reducedMotion: boolean;
    onOver: (i: number) => void;
    onOut: (i: number) => void;
    onKnock: (i: number) => void;
    onMirror?: () => void;
    /** The playbill on its easel by the box office was tapped (the programme). */
    onPlaybill?: () => void;
    /** The pointer went over (true) or off (false) the playbill. */
    onPlaybillHover?: (over: boolean) => void;
    /** What the mirror writes in its breath. */
    words?: string[];
    /** The visitor's camera, if they've let the mirror see them. */
    stream?: MediaStream | null;
    /** Where you are on a visit through a door (read every frame). */
    visit: React.MutableRefObject<Visit>;
    /** The room behind the door being visited: there from when it's built until the door has shut again. */
    room: SceneRoom | null;
    onVisit: (e: VisitEvent, door: number) => void;
    onReady: () => void;
    /** Lights come on as you arrive (false: they're already on, as when you come through the keyhole). */
    introduce?: boolean;
    /** Built but not running (drawn only when something changes): waiting, out of sight, to be walked into. */
    paused?: boolean;
    /** What isn't seen from the entrance (the far doors, the mirror) is built after the rest, once you can walk in. */
    later?: boolean;
}

/* ---------------------------------------------------- the rooms behind */

/** The camera layer the room behind a door lives on, its lights too: the corridor's camera never sees it, nor its lights the corridor. */
export const CHAMBER_LAYER = 3;
/** The room in a door's space: its open front in the door's opening, which is all the frame it has. */
const ROOM_Z = D.roomZ - ROOM.front;
/** Nearer the doorway than this (door space z), the camera is in the room. */
const CROSS_Z = 0.12;
/** How far the leaf swings when it's open (door.tsx). */
const OPEN_ANGLE = (105 * Math.PI) / 180;
/** The doors stand this far proud of the corridor's outer wall. */
const DOOR_PROUD = 0.04;
const NO_RAYCAST: THREE.Object3D["raycast"] = () => undefined;

/** Each door's place (door space to world) and its inverse. */
const FRAMES = DOOR_S.map((s) => {
    const m = new THREE.Matrix4().compose(onArc(s, OUTER - DOOR_PROUD), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFromOuterWall(s)), new THREE.Vector3(1, 1, 1));
    return { m, inv: m.clone().invert() };
});

/** A point in door i's space, in the world. */
const inDoor = (i: number, x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(FRAMES[i].m);
/** A point in the space of the room behind door i, in the world. */
const inRoom = (i: number, p: THREE.Vector3, out = new THREE.Vector3()) => out.set(p.x, p.y, p.z + ROOM_Z).applyMatrix4(FRAMES[i].m);

export function TheatreScene(props: TheatreSceneProps) {
    const { quality } = props;
    // The mirror can't see the walls between you and it, so its reflection is only
    // drawn on the last stretch of the walk, where it can actually be seen.
    const mirrorLive = useRef(false);
    const [dpr, setDpr] = useState(quality === "high" ? 1.6 : 1.2);
    const [portrait, setPortrait] = useState(false);
    useEffect(() => {
        const update = () => setPortrait(isPortrait());
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return (
        <Canvas
            dpr={dpr}
            camera={{ fov: theatreFov(portrait), near: 0.05, far: 60 }}
            frameloop={props.paused ? "demand" : "always"}
            gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
            onCreated={({ camera, gl, scene }) => {
                // Dev only: the measuring and checking scripts look the theatre up here.
                if (process.env.NODE_ENV !== "production") Object.assign(window, { __theatre: { gl, scene, camera, visit: props.visit } });
                onArc(CAMERA.from, CAMERA.radius, CAMERA.eye, camera.position);
                camera.lookAt(onArc(MARQUEE_S, CORRIDOR.radius, MARQUEE_Y));
            }}
        >
            {/* Drop the resolution, not the frame rate, when a device struggles. Never
                below 1 on a desktop: on a big (retina) screen anything less looks blocky. */}
            <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(quality === "high" ? 1 : 0.75, d - 0.3))} onIncline={() => setDpr((d) => Math.min(quality === "high" ? 1.75 : 1.25, d + 0.2))} />
            <color attach="background" args={[PALETTE.void]} />
            <fogExp2 attach="fog" args={[PALETTE.fog, FOG_DENSITY]} />
            <Suspense fallback={null}>
                <World {...props} mirrorLive={mirrorLive} />
            </Suspense>
            <Rig progress={props.progress} focus={props.focus} reducedMotion={props.reducedMotion} portrait={portrait} mirrorLive={mirrorLive} visit={props.visit} onVisit={props.onVisit} />
            <Effects quality={quality} grain={dpr >= 1.3} />
        </Canvas>
    );
}

/* ------------------------------------------------------------ the place */

/** From the entrance only the first door can be seen, and the second soon after you set off. */
export const NEAR_DOORS = 2;

function World({
    doors,
    focus,
    quality,
    onOver,
    onOut,
    onKnock,
    onMirror,
    onPlaybill,
    onPlaybillHover,
    words,
    stream,
    onReady,
    introduce = true,
    mirrorLive,
    visit,
    room,
    onVisit,
    later: deferred = false,
}: TheatreSceneProps & { mirrorLive: React.MutableRefObject<boolean> }) {
    // Everything it paints and shapes from code is done first, a slice at a time,
    // so building it never holds the page up (prepare.ts). With `later`, only what's
    // seen from the entrance (the corridor, the marquee and box office, the first
    // doors) before it's first drawn; the rest once you can walk in (Later), each
    // far door as soon as it's painted, nearest first, then the mirror.
    const [later] = useState(deferred);
    const near = later ? Math.min(doors.length, NEAR_DOORS) : doors.length;
    const all = () => prepareCorridor(doors.length, words ?? []);
    suspendUntil(later ? `entrance ${near}` : `corridor ${doors.length} ${(words ?? []).join("|")}`, later ? () => prepareEntrance(near) : all);
    const [rest, setRest] = useState(!later);
    const parts = useRef(new Map<string, Promise<unknown>>());
    const place = useRef<THREE.Group>(null);
    const power = usePower(
        () => {
            // The rest, asked for in the order it's wanted (each far door, nearest first, then
            // the mirror), and before the rooms' shared surfaces, which usePower asks for next.
            if (later) {
                for (let i = near; i < Math.min(doors.length, DOOR_S.length); i++) parts.current.set(`far door ${i}`, prepareDoor(i));
                parts.current.set("mirror", all());
                setRest(true);
            }
            onReady();
        },
        introduce,
        place,
    );
    const active = focus ?? doors.findIndex((d) => d.state === "hover");
    const lastDoor = Math.min(doors.length, DOOR_S.length) - 1;
    const slot = (d: SceneDoor, i: number) => (
        <DoorSlot
            key={d.id}
            index={i}
            door={d}
            last={i === lastDoor}
            onOver={onOver}
            onOut={onOut}
            onKnock={onKnock}
            room={room && room.door === i ? room : null}
            quality={quality}
            visit={visit}
            onVisit={onVisit}
        />
    );
    const far = doors.slice(near, DOOR_S.length).map((d, i) => slot(d, near + i));
    const mirror = (
        <group position={onArc(MIRROR_S - 0.001, CORRIDOR.radius)} rotation-y={yawFacingBack(MIRROR_S)}>
            <SteppenwolfMirror onLook={onMirror} resolution={quality === "high" ? 768 : 384} active={mirrorLive} words={words} stream={stream} />
        </group>
    );

    // The corridor stays where it is while you're in a room (the camera just stops seeing it).
    return (
        <group ref={place}>
            {/* Lights you can't place: a faint warm floor of light, so nothing is pure black. */}
            <hemisphereLight args={["#3a2418", "#080404", 0.12 * power]} />
            <Environment power={power} quality={quality} />
            <group position={onArc(MARQUEE_S, CORRIDOR.radius, MARQUEE_Y)} rotation-y={yawFacingBack(MARQUEE_S)}>
                <Marquee power={power} onPlaybill={onPlaybill} />
            </group>
            {onPlaybillHover && <PlaybillHover onHover={onPlaybillHover} />}
            {doors.slice(0, Math.min(near, DOOR_S.length)).map(slot)}
            {rest &&
                (later ? (
                    <>
                        {far.map((door, k) => (
                            <Suspense key={door.key} fallback={null}>
                                <Later name={`far door ${near + k}`} prepare={() => parts.current.get(`far door ${near + k}`) ?? prepareDoor(near + k)}>
                                    {door}
                                </Later>
                            </Suspense>
                        ))}
                        <Suspense fallback={null}>
                            <Later name={`mirror ${(words ?? []).join("|")}`} prepare={() => parts.current.get("mirror") ?? all()}>
                                {mirror}
                            </Later>
                        </Suspense>
                    </>
                ) : (
                    <>
                        {far}
                        {mirror}
                    </>
                ))}
            <Spill index={active >= 0 ? active : null} opening={focus !== null} />
        </group>
    );
}

/**
 * Something that can't be seen from the entrance (a far door, the mirror),
 * built once you can walk in: painted a slice at a time like the rest
 * (`prepare`), then got onto the GPU out of sight the same way (see usePower:
 * compiled a few things a frame, as each camera sees it, then its pictures
 * uploaded a few a frame, then drawn once, unseen), and only then shown, so it
 * never holds up a frame.
 */
function Later({ name, prepare, children }: { name: string; prepare: () => Promise<unknown>; children: React.ReactNode }) {
    suspendUntil(name, prepare);
    const group = useRef<THREE.Group>(null);
    const prep = useMemo(
        () => ({
            phase: "start" as "start" | "compiling" | "uploading" | "done",
            cameras: [] as THREE.Camera[],
            compiling: null as (() => boolean) | null,
            pictures: [] as THREE.Texture[],
            target: null as THREE.WebGLRenderTarget | null,
        }),
        [],
    );
    useEffect(() => () => prep.target?.dispose(), [prep]);
    useLayoutEffect(() => {
        if (group.current && prep.phase !== "done") group.current.visible = false;
    }, [prep]);
    useFrame(({ gl, scene, camera, invalidate }) => {
        const g = group.current;
        if (!g || prep.phase === "done") return;
        if (prep.phase !== "compiling") invalidate();
        if (prep.phase === "start") {
            prep.target ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
            if (!prep.cameras.length && !prep.compiling) prep.cameras = seenBy(camera);
            const prev = gl.getRenderTarget();
            gl.setRenderTarget(prep.target);
            // lit by the scene's lights, though out of sight itself
            prep.compiling ??= compileByParts(gl, g, prep.cameras[0], 4, scene);
            if (prep.compiling()) {
                prep.compiling = null;
                prep.cameras.shift();
            }
            gl.setRenderTarget(prev);
            if (!prep.cameras.length) {
                prep.phase = "compiling";
                programsReady(gl, 8000).then(() => {
                    prep.pictures = picturesOf(g);
                    prep.phase = "uploading";
                    invalidate();
                });
            }
        } else if (prep.phase === "uploading" && uploadSome(gl, prep.pictures, 4).length === 0 && introduceSome(gl, 4)) {
            const prev = gl.getRenderTarget();
            gl.setRenderTarget(prep.target);
            g.visible = true;
            drawAll(gl, scene, camera, g);
            gl.setRenderTarget(prev);
            prep.target?.dispose();
            prep.target = null;
            prep.phase = "done"; // and seen from this frame on
        }
    });
    return <group ref={group}>{children}</group>;
}

/**
 * Whether the pointer is over the playbill by the box office (its hit area,
 * the mesh named "playbill", only listens for clicks): one ray against that
 * one mesh as the pointer moves, so the page can show a pointing hand.
 */
function PlaybillHover({ onHover }: { onHover: (over: boolean) => void }) {
    const { scene, camera, gl } = useThree();
    const say = useRef(onHover);
    say.current = onHover;
    useEffect(() => {
        const el = gl.domElement;
        const ray = new THREE.Raycaster();
        const at = new THREE.Vector2();
        let bill: THREE.Object3D | null = null;
        let over = false;
        const set = (v: boolean) => {
            if (v === over) return;
            over = v;
            say.current(v);
        };
        const move = (e: PointerEvent) => {
            bill ??= scene.getObjectByName("playbill") ?? null;
            if (!bill) return;
            const r = el.getBoundingClientRect();
            at.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(at, camera);
            set(ray.intersectObject(bill, false).length > 0);
        };
        const off = () => set(false);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", off);
        return () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerleave", off);
            off();
        };
    }, [scene, camera, gl]);
    return null;
}

/** One door in the outer wall, and (while it's being visited) the room behind it. */
function DoorSlot({
    index,
    door,
    last,
    onOver,
    onOut,
    onKnock,
    room,
    quality,
    visit,
    onVisit,
}: {
    index: number;
    door: SceneDoor;
    last: boolean;
    onOver: (i: number) => void;
    onOut: (i: number) => void;
    onKnock: (i: number) => void;
    room: SceneRoom | null;
    quality: Quality;
    visit: React.MutableRefObject<Visit>;
    onVisit: (e: VisitEvent, door: number) => void;
}) {
    const real = useRef<THREE.Group>(null);
    const el = <TheatreDoor index={index} plate={door.plate} state={door.state} onOver={() => onOver(index)} onOut={() => onOut(index)} onKnock={() => onKnock(index)} />;
    return (
        <group position={onArc(DOOR_S[index], OUTER - DOOR_PROUD)} rotation-y={yawFromOuterWall(DOOR_S[index])}>
            <group ref={real}>{last ? <OnLayer layer={HIDDEN_FROM_MIRROR}>{el}</OnLayer> : el}</group>
            {last && (
                // The mirror lies: the last door, shut behind you, stands open in the glass.
                <OnLayer layer={MIRROR_LAYER}>
                    <TheatreDoor index={index} plate={door.plate} state="open" />
                </OnLayer>
            )}
            {room && <DoorVisit key={room.id} index={index} room={room} quality={quality} visit={visit} onVisit={onVisit} door={real} />}
        </group>
    );
}

// Puts everything inside on one camera layer (again every frame, as parts load in late).
// `first`: before anything else runs in the frame (anything that might render, like the
// floor's reflection), so nothing new is ever drawn on the wrong layer, even once.
function OnLayer({ layer, first = false, children }: { layer: number; first?: boolean; children: React.ReactNode }) {
    const group = useRef<THREE.Group>(null);
    useFrame(() => group.current?.traverse((o) => o.layers.set(layer)), first ? -100 : 0);
    return <group ref={group}>{children}</group>;
}

/* ------------------------------------------- the room behind the door */

const PORTAL_VERT = /* glsl */ `
varying vec4 vClip;
void main() {
    vClip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = vClip;
}
`;

// The room as the camera sees it this frame, looked up by where on the screen
// this bit of doorway is.
const PORTAL_FRAG = /* glsl */ `
uniform sampler2D tRoom;
uniform float uMix;
varying vec4 vClip;
void main() {
    vec2 uv = vClip.xy / vClip.w * 0.5 + 0.5;
    gl_FragColor = vec4(texture2D(tRoom, uv).rgb, uMix);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

type Phase = "wait" | "compiling" | "uploading" | "ready";

/** Every texture the room's materials use. */
function texturesOf(root: THREE.Object3D) {
    const out = new Set<THREE.Texture>();
    const add = (x: unknown) => {
        if (x && (x as THREE.Texture).isTexture) out.add(x as THREE.Texture);
    };
    root.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (!m) return;
        for (const mat of Array.isArray(m) ? m : [m]) {
            Object.values(mat).forEach(add);
            const u = (mat as THREE.ShaderMaterial).uniforms;
            if (u) Object.values(u).forEach((x) => add(x?.value));
        }
    });
    return Array.from(out);
}

/**
 * The room behind door `index`, built in the door's space right behind its
 * opening, on its own camera layer; and the portal in the doorway that shows
 * it while the camera is still in the corridor. Before anything shows, its
 * shaders are compiled and its pictures uploaded (a little each frame), so
 * the door doesn't stutter as it swings.
 */
function DoorVisit({
    index,
    room,
    quality,
    visit,
    onVisit,
    door,
}: {
    index: number;
    room: SceneRoom;
    quality: Quality;
    visit: React.MutableRefObject<Visit>;
    onVisit: (e: VisitEvent, door: number) => void;
    door: React.RefObject<THREE.Group | null>;
}) {
    const group = useRef<THREE.Group>(null);
    const portal = useRef<THREE.Mesh>(null);
    const target = useMemo(
        () =>
            new THREE.WebGLRenderTarget(2, 2, {
                type: THREE.HalfFloatType,
                depthBuffer: true,
                stencilBuffer: false,
                generateMipmaps: false,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            }),
        [],
    );
    const geometry = useMemo(() => roomGeometry().clone().translate(0, 0, 0.004), []);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                uniforms: { tRoom: { value: target.texture }, uMix: { value: 0 } },
                vertexShader: PORTAL_VERT,
                fragmentShader: PORTAL_FRAG,
                transparent: true,
                depthWrite: true,
            }),
        [target],
    );
    const k = useMemo(
        () => ({
            cam: new THREE.PerspectiveCamera(),
            proxy: new THREE.Scene(), // stands in for the scene when compiling (its fog; no lights of its own)
            size: new THREE.Vector2(),
            frustum: new THREE.Frustum(),
            m: new THREE.Matrix4(),
            leaf: null as THREE.Object3D | null,
            painted: [] as THREE.Object3D[],
            has: false,
            shot: null as ChamberShot | null,
            phase: "wait" as Phase,
            textures: [] as THREE.Texture[],
            mix: 0,
            shut: false,
        }),
        [],
    );

    useLayoutEffect(() => {
        // the corridor's camera sees it; the mirror doesn't
        portal.current?.layers.set(HIDDEN_FROM_MIRROR);
    }, []);
    useEffect(
        () => () => {
            for (const o of k.painted) o.visible = true;
            target.dispose();
            geometry.dispose();
            material.dispose();
        },
        [k, target, geometry, material],
    );

    // A copy of the camera, as it is this frame, that sees only the room.
    const sync = (camera: THREE.Camera) => {
        camera.updateMatrixWorld();
        k.cam.copy(camera as THREE.PerspectiveCamera, false);
        k.cam.layers.set(CHAMBER_LAYER);
    };

    // After the camera has moved (the Rig, at 0), before the frame is drawn (the composer, at 1).
    useFrame((state, dt) => {
        const V = visit.current;
        const gl = state.gl;
        const mine = V.door === index;
        const live = mine && V.stage !== "walk";

        // The door's leaf, and the painted room that fills its doorway when there's nothing behind it.
        if (!k.leaf && door.current) {
            const painted = roomGeometry();
            k.painted = [];
            door.current.traverse((o) => {
                if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry === painted) k.painted.push(o);
                if (o.type === "Group" && Math.abs(o.position.x - HINGE_X) < 1e-6 && Math.abs(o.position.z - D.leafZ) < 1e-6) k.leaf = o;
            });
        }
        const ang = k.leaf ? -k.leaf.rotation.y : 0;
        if (mine) {
            V.leaf = ang / OPEN_ANGLE;
            if (k.shot) V.shot = k.shot;
        }

        // Getting it ready to be seen.
        const g = group.current;
        if (!k.has && g)
            g.traverse((o) => {
                if ((o as THREE.Mesh).isMesh) k.has = true;
            });
        if (k.phase === "wait" && k.has && k.shot && g) {
            k.phase = "compiling";
            sync(state.camera);
            // Compiled as it will be drawn: into a float target, lit by its own lights
            // (the camera sees only its layer), in the scene's fog.
            k.proxy.fog = state.scene.fog;
            const prev = gl.getRenderTarget();
            let job: Promise<unknown> = Promise.resolve();
            try {
                gl.setRenderTarget(target);
                job = gl.compileAsync(g, k.cam, k.proxy);
                // and the portal, as the corridor's camera draws it, among the corridor's lights
                if (portal.current) job = Promise.all([job, gl.compileAsync(portal.current, state.camera, state.scene)]);
            } catch {
                // drawn anyway; it just compiles on first sight
            } finally {
                gl.setRenderTarget(prev);
            }
            job.catch(() => undefined).then(() => {
                k.textures = texturesOf(g);
                k.phase = "uploading";
            });
        }
        if (k.phase === "uploading") {
            // a few pictures a frame
            const t0 = performance.now();
            while (k.textures.length && performance.now() - t0 < 4) {
                const t = k.textures.pop()!;
                const p = gl.properties.get(t) as { __version?: number };
                if (t.version > 0 && p.__version !== t.version) {
                    gl.initTexture(t);
                }
            }
            if (!k.textures.length) k.phase = "ready";
        }
        if (k.phase === "ready" && live && V.stage === "door" && !V.ready) {
            V.ready = true;
            V.readyAt = performance.now();
            onVisit("ready", index);
        }

        // In: fade the room in over the painted one (through the crack of the knocked
        // door). Out: once the door has swung nearly shut, back again, and it can go.
        const closing = !live && ang < 0.35;
        const want = k.phase === "ready" && !closing && (live || k.mix > 0);
        k.mix = want ? Math.min(1, k.mix + dt / 0.35) : Math.max(0, k.mix - dt / 0.45);
        if (live) k.shut = false;
        else if (closing && k.mix === 0 && !k.shut) {
            k.shut = true;
            onVisit("shut", index);
        }
        for (const o of k.painted) o.visible = k.mix < 1;

        const mesh = portal.current;
        if (!mesh) return;
        material.uniforms.uMix.value = k.mix;
        // Through the doorway the camera sees the room itself: no portal.
        mesh.visible = k.mix > 0 && !(mine && V.through);
        if (!mesh.visible) return;
        sync(state.camera);
        mesh.updateWorldMatrix(true, false);
        k.frustum.setFromProjectionMatrix(k.m.multiplyMatrices(k.cam.projectionMatrix, k.cam.matrixWorldInverse));
        if (!k.frustum.intersectsObject(mesh)) return;
        gl.getDrawingBufferSize(k.size);
        if (target.width !== k.size.x || target.height !== k.size.y) target.setSize(k.size.x, k.size.y);
        const prev = gl.getRenderTarget();
        gl.setRenderTarget(target);
        gl.clear();
        gl.render(state.scene, k.cam);
        gl.setRenderTarget(prev);
    }, 0.5);

    return (
        <>
            <group ref={group} position-z={ROOM_Z}>
                <OnLayer layer={CHAMBER_LAYER} first>
                    <Suspense fallback={null}>
                        <Chamber
                            room={room.room}
                            plate={room.plate}
                            quality={quality}
                            frontWall={false}
                            onLayout={(shot) => {
                                k.shot = shot;
                                if (visit.current.door === index) visit.current.shot = shot;
                            }}
                        />
                    </Suspense>
                </OnLayer>
            </group>
            <mesh ref={portal} geometry={geometry} material={material} renderOrder={1} visible={false} raycast={NO_RAYCAST} />
        </>
    );
}

// The intro: the lights come back on after they failed on the way in. Starts
// once the first frame has been drawn, so the page can lift its cover then.
//
// Before that first frame, the place is got onto the GPU without holding the
// page up (see gpu.ts): every shader in it compiled in parallel, as it will be
// drawn (into the effects' float target: linear, no tone mapping), and its
// pictures uploaded a few each frame, all while it's hidden; then it's drawn
// once, unseen and in full (some materials only settle when first drawn), and
// again until a round adds nothing new (late parts: the neon's letters once
// their type is measured). Drawn straight away instead, all of that would
// happen in its first frame, stalling for a second or more.
// Without an intro, the lights are simply on.
/** The camera, and copies of it seeing what the floor's reflection and the mirror see. */
function seenBy(camera: THREE.Camera) {
    const floor = camera.clone();
    floor.layers.set(0);
    const mirror = camera.clone();
    mirror.layers.mask = (camera.layers.mask | (1 << MIRROR_LAYER)) & ~(1 << HIDDEN_FROM_MIRROR);
    return [camera, floor, mirror];
}

function usePower(onReady: () => void, introduce: boolean, place: React.RefObject<THREE.Group | null>) {
    const [power, setPower] = useState(introduce ? 0 : 1);
    const started = useRef<number | null>(null);
    const last = useRef(0);
    const prep = useMemo(
        () => ({
            phase: "start" as "start" | "compiling" | "uploading" | "resting" | "done",
            cameras: [] as THREE.Camera[],
            compiling: null as (() => boolean) | null,
            pictures: [] as THREE.Texture[],
            uploads: 0,
            target: null as THREE.WebGLRenderTarget | null,
            round: 0,
            made: -1,
            since: 0,
            t0: 0,
        }),
        [],
    );
    useEffect(() => () => prep.target?.dispose(), [prep]);
    // ms of it a frame: arriving, the page is covered meanwhile and nothing else moves, so
    // more; out of sight on another page (the keyhole's), a little, so that page stays smooth
    const slice = introduce ? 12 : 4;
    // Hidden from the start, before anything draws it (the floor's reflection draws
    // the scene too, earlier in the frame than this), until it's ready.
    useLayoutEffect(() => {
        if (place.current && prep.phase !== "done") place.current.visible = false;
    }, [place, prep]);
    useFrame(({ clock, gl, scene, camera, invalidate }) => {
        if (prep.phase !== "done") {
            const g = place.current;
            if (!g) return;
            // (it may be waiting, paused, drawing only when asked: keep asking until it's done)
            if (prep.phase !== "compiling") invalidate();
            const now = performance.now();
            if (prep.phase === "start") {
                // as the corridor's camera sees it, and as the floor's reflection and the
                // mirror do (they see other layers, so other lights: other shaders), one a frame
                prep.t0 ||= now;
                prep.target ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
                if (!prep.cameras.length && !prep.compiling) prep.cameras = seenBy(camera);
                const prev = gl.getRenderTarget();
                g.visible = true;
                gl.setRenderTarget(prep.target);
                prep.compiling ??= compileByParts(gl, scene, prep.cameras[0], slice);
                if (prep.compiling()) {
                    prep.compiling = null;
                    prep.cameras.shift();
                    lampsLit(0.5 - prep.cameras.length / 6); // (how far the waiting card's rule has got: readiness.ts)
                }
                gl.setRenderTarget(prev);
                g.visible = false;
                if (!prep.cameras.length) {
                    // made, a few at a time; now let the browser finish them, off the page's thread
                    prep.phase = "compiling";
                    programsReady(gl, 8000).then(() => {
                        prep.pictures = picturesOf(scene);
                        prep.uploads = prep.pictures.length;
                        prep.phase = "uploading";
                        lampsLit(0.6);
                        invalidate();
                    });
                }
            } else if (prep.phase === "uploading") {
                const left = uploadSome(gl, prep.pictures, slice).length;
                lampsLit(0.6 + 0.35 * (1 - left / Math.max(1, prep.uploads)));
                if (left === 0 && introduceSome(gl, slice)) {
                    // once, unseen and in full
                    const prev = gl.getRenderTarget();
                    g.visible = true;
                    gl.setRenderTarget(prep.target);
                    drawAll(gl, scene, camera);
                    gl.setRenderTarget(prev);
                    const made = gl.info.programs?.length ?? 0;
                    const settled = made === prep.made || now - prep.t0 > 10_000;
                    prep.made = made;
                    prep.round++;
                    if (settled) {
                        prep.phase = "done";
                        prep.target?.dispose();
                        prep.target = null;
                        return; // shown from the next frame
                    }
                    g.visible = false;
                    prep.phase = "resting";
                    prep.since = now;
                }
            } else if (prep.phase === "resting" && now - prep.since > 250) {
                prep.phase = "start";
            }
            return;
        }
        const now = clock.elapsedTime;
        if (started.current === null) {
            started.current = now;
            onReady();
            // and, while nothing's happening, the rooms' shared surfaces: then a door opens without a stall
            prepareChamberTextures();
            return;
        }
        if (!introduce) return;
        const t = Math.min(1, (now - started.current) / 2.8);
        // Update at ~20 Hz: the lamps and the sign do their own sputtering in between.
        if (t < 1 ? now - last.current > 0.05 : power < 1) {
            last.current = now;
            setPower(t < 1 ? 0.12 + 0.88 * (1 - Math.pow(1 - t, 2)) : 1);
        }
    });
    return power;
}

// One warm light that spills out of whichever door is hovered or open, so a
// single light does the work of six. For a door that's opening it moves into
// the doorway itself, behind the line of the hinges, where the swinging leaf
// can't pass through it (it ducks out at the knock, as the candles flinch,
// and comes back there).
function Spill({ index, opening }: { index: number | null; opening: boolean }) {
    const light = useRef<THREE.PointLight>(null);
    const at = useMemo(() => new THREE.Vector3(), []);
    useFrame((_, dt) => {
        const l = light.current;
        if (!l) return;
        const want = index === null ? 0 : opening ? 9 : 5;
        if (index !== null) {
            onArc(DOOR_S[index], opening ? OUTER - DOOR_PROUD + 0.03 : OUTER - 0.75, 1.2, at);
            // Move only while it's dark, so it never visibly jumps.
            if (l.position.distanceToSquared(at) > 1e-4) {
                if (l.intensity > 0.3) {
                    l.intensity = THREE.MathUtils.damp(l.intensity, 0, 12, dt);
                    return;
                }
                l.position.copy(at);
            }
        }
        l.intensity = THREE.MathUtils.damp(l.intensity, want, opening ? 2.2 : 5, dt);
    });
    // the deep orange of the candles in the rooms, not a cosy lamp
    return <pointLight ref={light} color="#ff8a4a" intensity={0} distance={7} decay={2} />;
}

/* ------------------------------------------------------------ the walk */

const easeInOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

/** Where to stand and where to look. */
type Pose = [pos: THREE.Vector3, look: THREE.Vector3];

/** A scripted move: through a doorway and on, or back. */
interface Move {
    since: number; // the visit stage it belongs to
    pos: THREE.CatmullRomCurve3;
    look: THREE.CatmullRomCurve3;
    dur: number; // ms
    t: number; // ms along it
    sway: [number, number]; // breathing, at the start and at the end
}

const ENTER_MS = 4600;
const EXIT_MS = 3300;
/** About how far either move goes (m), from the step-up to the shrine; shorter ones take less time. */
const MOVE_M = 4.1;

/** The way through door i's doorway, from the corridor into the room. */
function doorwayPoses(i: number): Pose[] {
    return [
        // the threshold, looking in at the shrine
        [inDoor(i, 0, 1.58, 0.7), inRoom(i, new THREE.Vector3(0, 1.3, 0))],
        // just inside the room
        [inRoom(i, ROOM_ENTRY.pos), inRoom(i, ROOM_ENTRY.look)],
    ];
}

/** A smooth move from `from` through those of `via` that lie between it and `to` (along door i's axis). */
function plan(i: number, from: Pose, via: Pose[], to: Pose, since: number, ms: number, sway: [number, number], reduced: boolean): Move {
    const local = new THREE.Vector3();
    const z = (p: THREE.Vector3) => local.copy(p).applyMatrix4(FRAMES[i].inv).z;
    const z0 = z(from[0]);
    const z1 = z(to[0]);
    const lo = Math.min(z0, z1) + 0.3;
    const hi = Math.max(z0, z1) - 0.3;
    const poses = [from, ...via.filter(([p]) => z(p) > lo && z(p) < hi), to];
    const pos = new THREE.CatmullRomCurve3(poses.map((p) => p[0]), false, "centripetal");
    const look = new THREE.CatmullRomCurve3(poses.map((p) => p[1]), false, "centripetal");
    const dur = reduced ? 350 : ms * THREE.MathUtils.clamp(pos.getLength() / MOVE_M, 0.4, 1.2);
    return { since, pos, look, dur, t: 0, sway };
}

function Rig({
    progress,
    focus,
    reducedMotion,
    portrait,
    mirrorLive,
    visit,
    onVisit,
}: {
    progress: React.MutableRefObject<number>;
    focus: number | null;
    reducedMotion: boolean;
    portrait: boolean;
    mirrorLive: React.MutableRefObject<boolean>;
    visit: React.MutableRefObject<Visit>;
    onVisit: (e: VisitEvent, door: number) => void;
}) {
    const { camera, pointer, size } = useThree();
    const raycaster = useThree((st) => st.raycaster);
    const lastDoor = useRef(0);
    const reading = useRef(0);
    const frames = useRef(0);
    const insets = useRef<{ top: number; bottom: number; height: number } | null>(null);
    const s = useRef(CAMERA.from);
    const step = useRef(0); // 0..1, how far we've stepped up to an opening door
    const move = useRef<Move | null>(null);
    const v = useMemo(
        () => ({
            pos: new THREE.Vector3(),
            look: new THREE.Vector3(),
            smoothLook: new THREE.Vector3(),
            tmp: new THREE.Vector3(),
            tmp2: new THREE.Vector3(),
            fwd: new THREE.Vector3(),
            right: new THREE.Vector3(),
            up: new THREE.Vector3(0, 1, 0),
            local: new THREE.Vector3(),
            started: false,
            breath: 0.012, // how deep the breathing was last frame
            pull: 0,
        }),
        [],
    );

    useFrame(({ clock }, dt) => {
        const V = visit.current;
        const now = performance.now();
        const sway = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.9);
        const fov = (camera as THREE.PerspectiveCamera).fov;
        const aspect = size.width / size.height;
        const i = V.door;
        // what the page covers (the site's header, the room's card), re-measured now and then
        if (frames.current++ % 20 === 0) {
            const header = document.querySelector(".v2 > header")?.getBoundingClientRect().bottom ?? 0;
            // the action card's top edge (it sits above the phone's dock, so measure where it is)
            const card = document.querySelector("[data-theatre-bar]")?.getBoundingClientRect();
            const bottom = card && card.height > 0 ? Math.max(0, size.height - card.top + 14) : 0;
            insets.current = { top: header + 10, bottom, height: size.height };
        }

        // The door stands open on the room: go in. (Not before you've stepped up to it.)
        if (V.stage === "door" && V.ready && V.shot && (V.leaf > 0.6 || now - V.readyAt > 4000) && (reducedMotion || now - V.since > 1500)) {
            V.stage = "enter";
            V.since = now;
            onVisit("enter", i);
        }

        // Plan the move in (or out) from wherever the camera is now.
        if ((V.stage === "enter" || V.stage === "exit") && move.current?.since !== V.since) {
            const from: Pose = [camera.position.clone(), v.smoothLook.clone()];
            from[0].y -= sway * v.breath;
            if (V.stage === "enter") {
                const shot = V.shot!;
                const r = readingPose(shot, fov, aspect, 0, v.tmp, v.tmp2, insets.current);
                move.current = plan(i, from, doorwayPoses(i), [inRoom(i, r.pos), inRoom(i, r.look)], V.since, ENTER_MS, [v.breath, 0.006], reducedMotion);
            } else {
                const fd = DOOR_S[i];
                const to: Pose = [onArc(fd, OUTER - 2.05, 1.58), onArc(fd, OUTER, 1.4)];
                move.current = plan(i, from, doorwayPoses(i).reverse(), to, V.since, EXIT_MS, [v.breath, 0.012], reducedMotion);
            }
        }

        if (V.stage === "enter" || V.stage === "exit") {
            // Through the doorway and on to the shrine, or back out to where you stood.
            mirrorLive.current = false;
            const M = move.current!;
            // Never into a leaf that's still swinging (at a very low frame rate it lags).
            const hold = V.stage === "enter" && V.leaf < 0.8 && M.t / M.dur < 0.45 && now - V.readyAt < 4000;
            if (!hold) M.t = Math.min(M.dur, M.t + dt * 1000);
            const u = easeInOutSine(M.t / M.dur);
            const t = M.pos.getUtoTmapping(u, 0);
            M.pos.getPoint(t, v.pos);
            M.look.getPoint(t, v.look);
            v.breath = THREE.MathUtils.lerp(M.sway[0], M.sway[1], u);
            v.pos.y += sway * v.breath;
            v.smoothLook.copy(v.look);
            v.started = true;
            camera.position.copy(v.pos);
            camera.lookAt(v.smoothLook);
            if (M.t >= M.dur) {
                if (V.stage === "enter") {
                    V.stage = "inside";
                    V.since = now;
                    reading.current = V.scroll;
                    onVisit("inside", i);
                } else {
                    // exactly where the step back from the door starts
                    V.stage = "walk";
                    V.since = now;
                    step.current = 1;
                    lastDoor.current = i;
                    onVisit("walk", i);
                }
            }
        } else if (V.stage === "inside") {
            // In front of the shrine, reading (scrolling down it, if it's taller than the screen).
            mirrorLive.current = false;
            reading.current = THREE.MathUtils.damp(reading.current, V.scroll, 6, dt);
            if (V.shot) V.extra = readingPose(V.shot, fov, aspect, reading.current, v.tmp, v.tmp2, insets.current).extra;
            else {
                v.tmp.copy(ROOM_ENTRY.pos);
                v.tmp2.copy(ROOM_ENTRY.look);
            }
            inRoom(i, v.tmp, v.pos);
            inRoom(i, v.tmp2, v.look);
            // pushing on past the end, on the way out: the room gives a little
            const want = now < V.pullUntil ? V.pull : 0;
            v.pull = THREE.MathUtils.damp(v.pull, want, want > v.pull ? 12 : 5, dt);
            if (v.pull > 1e-4) v.pos.addScaledVector(v.fwd.subVectors(v.look, v.pos).normalize(), -0.16 * v.pull);
            v.breath = 0.006;
            v.pos.y += sway * v.breath;
            if (!v.started) {
                v.smoothLook.copy(v.look);
                v.started = true;
            }
            v.smoothLook.x = THREE.MathUtils.damp(v.smoothLook.x, v.look.x, 4, dt);
            v.smoothLook.y = THREE.MathUtils.damp(v.smoothLook.y, v.look.y, 4, dt);
            v.smoothLook.z = THREE.MathUtils.damp(v.smoothLook.z, v.look.z, 4, dt);
            camera.position.copy(v.pos);
            camera.lookAt(v.smoothLook);
        } else {
            reading.current = 0;
            v.pull = 0;
            const target = THREE.MathUtils.lerp(CAMERA.from, CAMERA.to, progress.current);
            s.current = THREE.MathUtils.damp(s.current, target, 2.4, dt);
            step.current = THREE.MathUtils.damp(step.current, focus === null ? 0 : 1, focus === null ? 2.5 : 1.6, dt);
            const at = s.current;
            mirrorLive.current = at > 0.62 && V.stage === "walk";

            const bestS = viewAt(at, portrait, v.pos, v.look);

            // Stepping up to a door that's opening (and back from it afterwards).
            if (focus !== null) lastDoor.current = focus;
            if (step.current > 0.001 && (focus !== null || step.current > 0.01)) {
                const fd = DOOR_S[lastDoor.current] ?? bestS;
                v.pos.lerp(onArc(fd, OUTER - 2.05, 1.58, v.tmp), step.current);
                v.look.lerp(onArc(fd, OUTER, 1.4, v.tmp), step.current);
            }

            // Breathing, and a little turn toward the pointer.
            v.breath = 0.012;
            v.pos.y += sway * v.breath;
            if (!reducedMotion) {
                v.fwd.subVectors(v.look, v.pos).normalize();
                v.right.crossVectors(v.fwd, v.up).normalize();
                v.look.addScaledVector(v.right, pointer.x * 0.45).addScaledVector(v.up, pointer.y * 0.25);
            }

            if (!v.started) {
                v.smoothLook.copy(v.look);
                v.started = true;
            }
            v.smoothLook.x = THREE.MathUtils.damp(v.smoothLook.x, v.look.x, 4, dt);
            v.smoothLook.y = THREE.MathUtils.damp(v.smoothLook.y, v.look.y, 4, dt);
            v.smoothLook.z = THREE.MathUtils.damp(v.smoothLook.z, v.look.z, 4, dt);
            camera.position.copy(v.pos);
            camera.lookAt(v.smoothLook);
        }

        // Past the doorway the camera sees only the room (and the room's lights only the room).
        const visiting = V.stage === "enter" || V.stage === "inside" || V.stage === "exit";
        const through = visiting && v.local.copy(camera.position).applyMatrix4(FRAMES[i].inv).z < CROSS_Z;
        V.through = through;
        if (through) {
            camera.layers.set(CHAMBER_LAYER);
            raycaster.layers.set(CHAMBER_LAYER);
        } else {
            camera.layers.set(0);
            camera.layers.enable(HIDDEN_FROM_MIRROR);
            raycaster.layers.set(0);
            raycaster.layers.enable(HIDDEN_FROM_MIRROR);
        }
    });
    return null;
}

/* --------------------------------------------------------- the film */

// The grain is drawn one speck per rendered pixel, so it only goes on while the
// resolution is high enough for the specks to stay fine; at a lowered resolution
// they'd be scaled up into a coarse, sandy noise. It's premultiplied, so it
// follows the light and leaves the dark walls clean.
// (The film itself is in look.ts: the keyhole's view comes through it too.)
function Effects({ quality, grain }: { quality: Quality; grain: boolean }) {
    const { high, low } = FILM;
    const fringe = useMemo(() => new THREE.Vector2(...FILM.high.fringe.offset), []);
    return quality === "high" ? (
        <EffectComposer multisampling={0}>
            <Bloom {...high.bloom} />
            <ChromaticAberration {...high.fringe} offset={fringe} />
            <Noise blendFunction={high.grain.blendFunction} premultiply={high.grain.premultiply} opacity={grain ? high.grain.opacity : 0} />
            <Vignette {...high.vignette} />
        </EffectComposer>
    ) : (
        <EffectComposer multisampling={0}>
            <Bloom {...low.bloom} />
            <Vignette {...low.vignette} />
        </EffectComposer>
    );
}
