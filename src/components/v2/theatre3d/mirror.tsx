"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import { getFrameGeometry, makeFrameMaterial } from "@/components/v2/theatre3d/mirror-frame";
import { GLASS, RECT, getBlankWrite, getGlassGeometry, getSilverTexture, makeGlassMaterial } from "@/components/v2/theatre3d/mirror-glass";
import { breathAt, writePhrase, type BreathState, type Phrase } from "@/components/v2/theatre3d/mirror-breath";
import { MirrorCamera } from "@/components/v2/theatre3d/mirror-camera";
import { MirrorLamp } from "@/components/v2/theatre3d/mirror-lamp";

export { Silhouette } from "@/components/v2/theatre3d/mirror-figure";

// The mirror at the end of the Magic Theatre. A real reflection of the
// corridor behind you, rendered each frame from your eye mirrored through the
// glass and broken across a couple of dozen old shards, each at its own small
// angle and in its own colour. But it lies: you are not in it, it shows where
// you stood a moment ago, and a lamp that gutters in the room burns steadily
// in the glass. Stay, and your breath fogs it from the inside and something
// writes in the fog for you. Let it see you, and it shows you to yourself,
// broken, some pieces of you a few seconds behind.
//
// Local space: base on the floor at y = 0, centred on x = 0, back against a
// wall at z = 0, facing +Z.

/** Layer for things only the mirror sees: the main camera never renders it, the mirror's camera does. */
export const MIRROR_LAYER = 1;
/** Layer for things the mirror must not see: the mirror's camera leaves it out (the scene enables it on the main camera). */
export const HIDDEN_FROM_MIRROR = 2;

const MAX_DISTANCE = 18; // beyond this the reflection isn't rendered at all
const FADE_FROM = 14.5; // and it fades out toward that distance, so nothing pops
const LATE = 0.42; // seconds the reflection trails you by
const BREATH_NEAR = 3.5; // you breathe on the glass within this distance of it

function isLowEnd() {
    if (typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    return coarse || (navigator.hardwareConcurrency ?? 8) <= 4;
}

export interface SteppenwolfMirrorProps {
    /** Clicking or tapping the glass. */
    onLook?: () => void;
    /** Width of the reflection render target in pixels; the height follows the glass. */
    resolution?: number;
    /**
     * Whether the reflection may be drawn (it can't tell when a wall stands in the way,
     * so the scene switches it off until the walk nears the end). Read every frame.
     */
    active?: React.MutableRefObject<boolean>;
    /** Phrases written in the breath on the glass, one at a time, while you linger. None: the fog just comes and goes. */
    words?: string[];
    /** The visitor's camera, once they have agreed to it. The page owns asking and stopping; the mirror only draws it. */
    stream?: MediaStream | null;
}

/**
 * Development only: ?mirrorWords=the boy|the wolf writes those, ?mirrorAt=12
 * holds the breath (or the camera's arrival) at 12 s, ?mirrorCam=1 asks for
 * the camera itself, ?mirrorCam=test fakes one from a photo (for headless shots).
 */
function devParams() {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return { words: undefined, at: undefined, cam: "" };
    const q = new URLSearchParams(window.location.search);
    const at = q.get("mirrorAt");
    return { words: q.get("mirrorWords")?.split("|").filter(Boolean), at: at === null ? undefined : Number(at), cam: q.get("mirrorCam") ?? "" };
}

/** Development only: a webcam-like stream made from a still photo, swaying slightly, for testing without a camera. */
function fakeCamera(src: string, onStream: (s: MediaStream) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    let raf = 0;
    const draw = (t: number) => {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, 640, 480);
        const s = 1.25 + 0.02 * Math.sin(t / 1700);
        ctx.drawImage(img, 320 - 256 * s + 6 * Math.sin(t / 1300), 250 - 256 * s * 1.05, 512 * s, 512 * s);
        raf = requestAnimationFrame(draw);
    };
    img.onload = () => {
        raf = requestAnimationFrame(draw);
        onStream(canvas.captureStream(24));
    };
    img.src = src;
    return () => cancelAnimationFrame(raf);
}

export function SteppenwolfMirror({ onLook, resolution = 768, active, words, stream }: SteppenwolfMirrorProps) {
    const gl = useThree((s) => s.gl);
    const lowEnd = useMemo(isLowEnd, []);
    // On slow devices: no MSAA, and the reflection refreshes every other frame.
    const everyOtherFrame = lowEnd;
    const texW = Math.max(64, Math.round(resolution));
    const texH = Math.round((texW * RECT.hy) / RECT.hx);
    const fbo = useFBO(texW, texH, {
        samples: lowEnd ? 0 : 4,
        type: THREE.HalfFloatType,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
    });

    const group = useRef<THREE.Group>(null);
    const glass = useRef<THREE.Mesh>(null);

    const glassGeometry = getGlassGeometry();
    const frameGeometry = getFrameGeometry();
    const glassMaterial = useMemo(() => makeGlassMaterial(), []);
    const frameMaterial = useMemo(() => makeFrameMaterial(gl), [gl]);
    const dev = useMemo(devParams, []);

    useLayoutEffect(() => {
        const u = glassMaterial.uniforms;
        u.tReflect.value = fbo.texture;
        u.tSilver.value = getSilverTexture();
        u.tWrite.value = getBlankWrite();
        u.uTexSize.value.set(texW, texH);
    }, [glassMaterial, fbo, texW, texH]);

    useEffect(
        () => () => {
            glassMaterial.dispose();
            frameMaterial.dispose();
        },
        [glassMaterial, frameMaterial],
    );

    // The phrases, each written out once into its own small texture.
    const list = words ?? dev.words;
    const key = list?.join("\n") ?? "";
    const phrases = useMemo<Phrase[]>(() => (key ? key.split("\n").map(writePhrase) : []), [key]);
    const durations = useMemo(() => phrases.map((p) => p.duration), [phrases]);
    useEffect(() => () => phrases.forEach((p) => p.texture.dispose()), [phrases]);

    // In development the mirror can ask for the camera itself, to be looked at.
    const [devStream, setDevStream] = useState<MediaStream | null>(null);
    useEffect(() => {
        if (!dev.cam) return;
        let s: MediaStream | null = null;
        const got = (stream: MediaStream) => {
            s = stream;
            setDevStream(stream);
        };
        const stop = dev.cam === "test" ? fakeCamera("/img/kartik-512.jpg", got) : (navigator.mediaDevices?.getUserMedia({ video: true }).then(got).catch(() => {}), undefined);
        return () => {
            stop?.();
            s?.getTracks().forEach((t) => t.stop());
        };
    }, [dev.cam]);
    const camStream = stream ?? devStream;

    // Everything the frame loop needs, allocated once.
    const k = useMemo(
        () => ({
            camera: new THREE.PerspectiveCamera(),
            frustum: new THREE.Frustum(),
            sphere: new THREE.Sphere(),
            viewProj: new THREE.Matrix4(),
            basis: new THREE.Matrix4(),
            toLocal: new THREE.Matrix4(),
            eye: new THREE.Vector3(),
            late: new THREE.Vector3(),
            local: new THREE.Vector3(),
            forward: new THREE.Vector3(),
            centre: new THREE.Vector3(),
            rel: new THREE.Vector3(),
            ax: new THREE.Vector3(),
            ay: new THREE.Vector3(),
            az: new THREE.Vector3(),
            negX: new THREE.Vector3(),
            negZ: new THREE.Vector3(),
            // where you stood, the last couple of seconds: time, x, y, z
            poses: new Float32Array(128 * 4),
            poseHead: -1,
            poseCount: 0,
            live: 0,
            frame: 0,
            // the breath
            linger: 0,
            presence: 0,
            first: 0,
            breath: { fog: 0, phrase: -1, writeSec: 0, refog: 0 } as BreathState,
            lastPhrase: -1,
            started: 0,
            // the camera
            cam: null as MirrorCamera | null,
            camWanted: false,
            camT: 0,
            camMix: 0,
        }),
        [],
    );

    // A stream arrives: start drawing it. It goes: let it fade, then let it go.
    useEffect(() => {
        if (camStream) {
            k.cam?.dispose();
            k.cam = new MirrorCamera(camStream);
            k.camWanted = true;
            k.camT = 0;
        } else k.camWanted = false;
    }, [camStream, k]);
    useEffect(
        () => () => {
            k.cam?.dispose();
            k.cam = null;
        },
        [k],
    );

    /** Where the eye was `ago` seconds back, from the ring of poses. */
    const eyeAgo = (now: number, ago: number, out: THREE.Vector3) => {
        const want = now - ago;
        const n = k.poseCount;
        let newer = k.poseHead;
        for (let i = 1; i < n; i++) {
            const older = (k.poseHead - i + 128) % 128;
            const to = k.poses[older * 4];
            if (to <= want) {
                const tn = k.poses[newer * 4];
                const f = tn > to ? (want - to) / (tn - to) : 0;
                const a = older * 4;
                const b = newer * 4;
                return out.set(k.poses[a + 1] + (k.poses[b + 1] - k.poses[a + 1]) * f, k.poses[a + 2] + (k.poses[b + 2] - k.poses[a + 2]) * f, k.poses[a + 3] + (k.poses[b + 3] - k.poses[a + 3]) * f);
            }
            newer = older;
        }
        const o = newer * 4;
        return out.set(k.poses[o + 1], k.poses[o + 2], k.poses[o + 3]);
    };

    useFrame((state, delta) => {
        const g = group.current;
        const gm = glass.current;
        if (!g || !gm) return;
        const cam = state.camera;
        const u = glassMaterial.uniforms;
        const now = state.clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        u.uTime.value = now;
        k.frame++;

        cam.updateMatrixWorld();
        gm.updateWorldMatrix(true, false);
        k.eye.setFromMatrixPosition(cam.matrixWorld);
        k.poseHead = (k.poseHead + 1) % 128;
        k.poseCount = Math.min(128, k.poseCount + 1);
        const slot = k.poseHead * 4;
        k.poses[slot] = now;
        k.poses[slot + 1] = k.eye.x;
        k.poses[slot + 2] = k.eye.y;
        k.poses[slot + 3] = k.eye.z;

        // You, in the mirror's own space.
        k.toLocal.copy(g.matrixWorld).invert();
        k.local.copy(k.eye).applyMatrix4(k.toLocal);
        k.forward.set(0, 0, -1).transformDirection(cam.matrixWorld).transformDirection(k.toLocal);

        // The glass's frame of reference in the world.
        const m = gm.matrixWorld;
        k.ax.setFromMatrixColumn(m, 0);
        const sx = k.ax.length();
        k.ax.divideScalar(sx);
        k.ay.setFromMatrixColumn(m, 1);
        const sy = k.ay.length();
        k.ay.divideScalar(sy);
        k.az.setFromMatrixColumn(m, 2).normalize();
        k.centre.set(RECT.cx, RECT.cy, 0).applyMatrix4(m);
        k.rel.subVectors(k.eye, k.centre);
        const d = k.rel.dot(k.az); // your distance in front of the glass
        const dist = k.rel.length();

        // Only bother when the glass is in front of you, near enough, and in view.
        k.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        k.frustum.setFromProjectionMatrix(k.viewProj);
        k.sphere.center.copy(k.centre);
        k.sphere.radius = Math.hypot(RECT.hx * sx, RECT.hy * sy);
        const allowed = active?.current ?? true;
        const visible = allowed && d > 0.05 && dist < MAX_DISTANCE && k.frustum.intersectsSphere(k.sphere);
        const target = visible ? 1 - THREE.MathUtils.smoothstep(dist, FADE_FROM, MAX_DISTANCE) : 0;
        k.live += (target - k.live) * (1 - Math.exp(-dt * 4));
        u.uLive.value = k.live;

        // ---- the camera: in through fog that clears, out by fading back to the corridor
        const c = k.cam;
        const camOn = !!c && k.camWanted && c.ready;
        if (c) c.update(state.gl, now);
        if (camOn) k.camT = dev.at ?? k.camT + dt;
        else k.camT = 0;
        const camFog = camOn ? THREE.MathUtils.smoothstep(k.camT, 0, 1.2) * (1 - THREE.MathUtils.smoothstep(k.camT, 4.5, 6.5)) : 0;
        const camIn = camOn ? THREE.MathUtils.smoothstep(k.camT, 1.2, 1.5) : 0;
        k.camMix += (camIn - k.camMix) * (1 - Math.exp(-dt * (camIn > k.camMix ? 12 : 1.6)));
        if (c && !k.camWanted && k.camMix < 0.005) {
            c.dispose();
            k.cam = null;
        }
        u.uCam.value = k.camMix;
        if (c) {
            u.tCam.value = c.live;
            u.tRing.value = c.ring.texture;
            u.uCamCrop.value.copy(c.crop);
            u.uRingHead.value = Math.max(0, c.head);
            u.uRingCount.value = c.count;
        }
        // the fog clears outward from the middle of the glass, uncovering all of them
        u.uClear.value.set(0, 1.75, camOn ? Math.max(0, (k.camT - 1.5) * 1.3) : 0);

        // ---- the breath: stand close, in front, facing it, and it fogs; walk away and it clears
        const near = allowed && k.local.z > 0.2 && Math.hypot(k.local.x, k.local.z) < BREATH_NEAR && k.forward.z < -0.5;
        const lingering = near && !camOn;
        if (dev.at !== undefined) k.linger = near ? dev.at : 0;
        else if (lingering) k.linger += dt;
        k.presence += ((lingering ? 1 : 0) - k.presence) * (1 - Math.exp(-dt * (lingering ? 3 : 1.4)));
        if (!lingering && k.presence < 0.02 && k.linger > 0 && dev.at === undefined) {
            // it has cleared: next time, carry on from the next phrase
            if (phrases.length) k.first = (k.first + k.started) % phrases.length;
            k.linger = 0;
            k.started = 0;
        }
        const b = breathAt(k.linger, durations, k.first, k.breath);
        u.uFog.value = Math.max(b.fog * k.presence, camFog);
        u.uBreathAt.value.set(THREE.MathUtils.clamp(k.local.x, -GLASS.half, GLASS.half), THREE.MathUtils.clamp(k.local.y - 0.12, GLASS.bottom + 0.3, GLASS.shoulder));
        const p = b.phrase >= 0 && !camOn ? phrases[b.phrase] : undefined;
        if (p) {
            if (b.phrase !== k.lastPhrase) {
                k.lastPhrase = b.phrase;
                k.started++;
                u.tWrite.value = p.texture;
                u.uWriteRect.value.copy(p.rect);
                if (p.drips[0]) u.uDrip0.value.copy(p.drips[0]);
                else u.uDrip0.value.set(0, 0, 0, 0);
                if (p.drips[1]) u.uDrip1.value.copy(p.drips[1]);
                else u.uDrip1.value.set(0, 0, 0, 0);
            }
            u.uWriteT.value = Math.min(0.998, b.writeSec / p.duration);
            u.uWriteSec.value = b.writeSec;
            u.uRefog.value = b.refog;
        } else {
            k.lastPhrase = -1;
            u.uWriteT.value = -1;
        }

        if (!visible) return;
        if (everyOtherFrame && k.frame % 2 === 1) return;

        // The mirror camera: your eye as it was a moment ago, reflected through
        // the glass, looking straight out of it, with an off-axis frustum
        // fitted to the glass (plus a margin). Its near plane lies exactly in
        // the glass, so nothing behind the mirror can leak in, the same job
        // Reflector's oblique clip plane does, and the whole render target
        // lands on the glass instead of on the rest of the screen.
        eyeAgo(now, LATE, k.late);
        k.rel.subVectors(k.late, k.centre);
        const dl = Math.max(0.06, k.rel.dot(k.az));
        const vc = k.camera;
        vc.position.copy(k.late).addScaledVector(k.az, -2 * dl);
        k.basis.makeBasis(k.negX.copy(k.ax).negate(), k.ay, k.negZ.copy(k.az).negate());
        vc.quaternion.setFromRotationMatrix(k.basis);
        vc.updateMatrixWorld();
        const ex = k.rel.dot(k.ax);
        const ey = k.rel.dot(k.ay);
        const hx = RECT.hx * sx;
        const hy = RECT.hy * sy;
        const far = dl + ((cam as THREE.PerspectiveCamera).far ?? 100);
        vc.projectionMatrix.makePerspective(ex - hx, ex + hx, hy - ey, -hy - ey, dl, far);
        vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();
        vc.layers.mask = (cam.layers.mask | (1 << MIRROR_LAYER)) & ~(1 << HIDDEN_FROM_MIRROR);

        // Texture matrix, as in three's Reflector: glass space to the mirror camera's screen.
        u.uTexMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse).multiply(m);

        // Render, with the glass itself hidden.
        const renderer = state.gl;
        const prevTarget = renderer.getRenderTarget();
        const prevXr = renderer.xr.enabled;
        const prevShadows = renderer.shadowMap.autoUpdate;
        renderer.xr.enabled = false;
        renderer.shadowMap.autoUpdate = false;
        gm.visible = false;
        renderer.setRenderTarget(fbo);
        renderer.state.buffers.depth.setMask(true);
        if (!renderer.autoClear) renderer.clear();
        renderer.render(state.scene, vc);
        renderer.setRenderTarget(prevTarget);
        gm.visible = true;
        renderer.xr.enabled = prevXr;
        renderer.shadowMap.autoUpdate = prevShadows;
    });

    const look = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onLook?.();
    };

    return (
        <group ref={group}>
            <mesh geometry={frameGeometry} material={frameMaterial} />
            <mesh ref={glass} geometry={glassGeometry} material={glassMaterial} position-z={GLASS.z} onClick={look} />
            <MirrorLamp layer={MIRROR_LAYER} />
        </group>
    );
}
