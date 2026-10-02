"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { flicker, rng } from "@/components/v2/theatre3d/textures";
import { D, HANDLE, HINGE_X, KEYHOLE, KNOCKER, doorVariant, onWall, type DoorVariant } from "@/components/v2/theatre3d/door-variants";
import {
    backingGeometry,
    holeGeometry,
    dustGeometry,
    ironGeometry,
    keyholeGlowGeometry,
    leafGeometry,
    leafHitGeometry,
    pintleGeometry,
    plateGeometry,
    poolGeometry,
    pullGeometry,
    ringGeometry,
    roomGeometry,
    screwGeometry,
    surroundGeometry,
    surroundHitGeometry,
} from "@/components/v2/theatre3d/door-geometry";
import { FIGURE_Z, LAMP, makeDoorMaterials, makeDoorUniforms, sharedMaterials } from "@/components/v2/theatre3d/door-materials";
import { PLAQUE } from "@/components/v2/theatre3d/door-textures";

// One door of the Magic Theatre: an arched stone surround, an old planked
// leaf hung on strap hinges, and a brass plaque on the wall beside it. Behind
// it, a long dark chamber with a candle burning far in; its light leaks round
// the leaf, under it and through the keyhole. Every so often someone inside
// walks past the candle, and their shadow crosses the light.

export interface DoorProps {
    index: number; // 0-based position along the corridor; drives a deterministic variant
    plate: string; // the inscription on the brass plaque beside the door
    state: "idle" | "hover" | "visited" | "open";
    onOver?: () => void;
    onOut?: () => void;
    onKnock?: () => void; // click / tap
}

type State = DoorProps["state"];

const FONT = "/fonts/IMFellEnglishSC.ttf";
const NO_RAYCAST: THREE.Object3D["raycast"] = () => undefined;
const DEG = Math.PI / 180;

// How far the leaf stands open in each state, and how it gets there: the
// target eases in (drive), and the leaf follows it on a spring, so an old
// door is slow to start, and a light push overshoots a little and settles.
const LEAF: Record<State, { angle: number; drive: number; omega: number; zeta: number }> = {
    idle: { angle: 0, drive: 4, omega: 6, zeta: 0.8 },
    hover: { angle: 11 * DEG, drive: 6, omega: 7.5, zeta: 0.4 },
    visited: { angle: 5 * DEG, drive: 3, omega: 5, zeta: 0.75 },
    open: { angle: 105 * DEG, drive: 3.4, omega: 4.6, zeta: 0.92 },
};

// Light levels per state: the leak round the leaf, the keyhole, the candle as
// it reaches out past the leaf, the candle as it lights the chamber, and how
// far it has burned down to red.
const GLOW: Record<State, { gap: number; key: number; lamp: number; expo: number; warm: number }> = {
    idle: { gap: 1, key: 2.2, lamp: 24, expo: 1, warm: 0 },
    hover: { gap: 1.5, key: 5, lamp: 34, expo: 1.1, warm: 0.15 },
    visited: { gap: 1.25, key: 3.2, lamp: 30, expo: 1.05, warm: 1 },
    open: { gap: 1.2, key: 2, lamp: 48, expo: 1.25, warm: 0.3 },
};

// The candle's colour (linear), and the deeper red it burns once you have been inside.
const ROOM = new THREE.Color(1, 0.4, 0.13);
const WARM = new THREE.Color(1, 0.2, 0.07);
const LEAK = new THREE.Color(1, 0.8, 0.6); // light through a narrow gap looks deeper and warmer

/** I, II, III … for the plaque. */
function roman(n: number) {
    const table: [number, string][] = [
        [1000, "M"],
        [900, "CM"],
        [500, "D"],
        [400, "CD"],
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let out = "";
    for (const [v, s] of table)
        while (n >= v) {
            out += s;
            n -= v;
        }
    return out;
}

export function TheatreDoor({ index, plate, state, onOver, onOut, onKnock }: DoorProps) {
    const v = doorVariant(index);
    const u = useMemo(makeDoorUniforms, []);
    const mats = useMemo(() => makeDoorMaterials(v, u), [v, u]);
    useEffect(() => () => mats.dispose(), [mats]);
    const shared = sharedMaterials();
    const geo = useMemo(() => ({ stones: surroundGeometry(v), leaf: leafGeometry(v), iron: ironGeometry(v), pintles: pintleGeometry(v) }), [v]);

    const leaf = useRef<THREE.Group>(null);
    const ring = useRef<THREE.Group>(null);
    const pool = useRef<THREE.Mesh>(null);
    const dust = useRef<THREE.Points>(null);

    // Everything that moves, kept out of React.
    const sim = useRef({
        ang: 0,
        vel: 0,
        drive: 0,
        gap: GLOW.idle.gap,
        key: GLOW.idle.key,
        lamp: GLOW.idle.lamp,
        expo: GLOW.idle.expo,
        warm: 0,
        ring: 0,
        ringVel: 0,
        knockAt: -10,
        figNext: -1,
        figStart: -1,
        figDir: 1,
        figPause: false,
    });
    const figRand = useMemo(() => rng(v.seed + index * 31 + 99), [v.seed, index]);

    // Latest callbacks, so the handlers below never go stale.
    const cb = useRef({ onOver, onOut, onKnock });
    cb.current = { onOver, onOut, onKnock };

    // Moving the pointer from one part of the door to another fires out then
    // over in the same tick; hold the out back a microtask so it only reaches
    // the parent when the pointer has really left.
    const hover = useRef({ inside: false, pendingOut: false });
    const handlers = useMemo(
        () => ({
            onPointerOver: (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                const h = hover.current;
                h.pendingOut = false;
                if (!h.inside) {
                    h.inside = true;
                    cb.current.onOver?.();
                }
            },
            onPointerOut: (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                const h = hover.current;
                h.pendingOut = true;
                queueMicrotask(() => {
                    if (!h.pendingOut) return;
                    h.pendingOut = false;
                    h.inside = false;
                    cb.current.onOut?.();
                });
            },
            onClick: (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                const s = sim.current;
                s.ringVel = 9; // lift the knocker ring and let it fall
                s.vel += 0.35; // the leaf rattles in its frame
                s.knockAt = -1; // stamped with the clock on the next frame
                cb.current.onKnock?.();
            },
        }),
        [],
    );

    useFrame((three, delta) => {
        const s = sim.current;
        const t = three.clock.elapsedTime;
        const dt = Math.min(delta, 0.1);
        const L = LEAF[state];
        const G = GLOW[state];
        if (s.knockAt === -1) s.knockAt = t;

        // The leaf: an eased target, followed on a spring, stopped by the frame.
        s.drive = THREE.MathUtils.damp(s.drive, L.angle, L.drive, dt);
        let rem = dt;
        while (rem > 1e-6) {
            const h = Math.min(rem, 1 / 240);
            const acc = L.omega * L.omega * (s.drive - s.ang) - 2 * L.zeta * L.omega * s.vel;
            s.vel += acc * h;
            s.ang += s.vel * h;
            if (s.ang < 0) {
                s.ang = 0;
                s.vel = -s.vel * 0.25;
            }
            rem -= h;
        }
        // old hinges: a faint judder while it moves
        const judder = Math.sin(t * 53) * Math.sin(t * 31.7) * Math.min(Math.abs(s.vel), 1) * 0.004;
        const ang = Math.max(0, s.ang + judder);
        if (leaf.current) leaf.current.rotation.y = -ang;

        // The knocker ring: a short pendulum that clacks on its strike plate.
        if (ring.current) {
            let r = dt;
            while (r > 1e-6) {
                const h = Math.min(r, 1 / 240);
                s.ringVel += (-130 * s.ring - 1.2 * s.ringVel) * h;
                s.ring += s.ringVel * h;
                if (s.ring < 0) {
                    s.ring = 0;
                    s.ringVel = -s.ringVel * 0.35;
                }
                r -= h;
            }
            ring.current.rotation.x = 0.055 - s.ring;
        }

        // Light levels.
        s.gap = THREE.MathUtils.damp(s.gap, G.gap, 3, dt);
        s.key = THREE.MathUtils.damp(s.key, G.key, 3, dt);
        s.lamp = THREE.MathUtils.damp(s.lamp, G.lamp, state === "open" ? 1.8 : 3, dt);
        s.expo = THREE.MathUtils.damp(s.expo, G.expo, state === "open" ? 1.6 : 3, dt);
        s.warm = THREE.MathUtils.damp(s.warm, G.warm, 2, dt);
        // the candle gutters unevenly, and flinches just after a knock
        const since = t - s.knockAt;
        const flinch = since > 0.25 && since < 1.2 ? 1 - 0.55 * Math.sin(((since - 0.25) / 0.95) * Math.PI) : 1;
        const breath = (1 + 0.07 * Math.sin(t * 7.1 + v.id) * Math.sin(t * 3.3 + index) + 0.04 * Math.sin(t * 13.7 + v.id * 1.7) + (flicker(t * 1.3, v.id + index) - 1) * 0.6) * flinch;

        // Someone walks past inside every 6 to 14 seconds; sometimes they stop behind the door.
        if (s.figNext < 0) s.figNext = t + 2 + figRand() * 7;
        let figX = -9;
        let figBob = 0;
        let present = 0;
        if (s.figStart < 0 && t >= s.figNext) {
            s.figStart = t;
            s.figDir = figRand() < 0.5 ? -1 : 1;
            // they only stop behind a shut door, never in plain sight of an open one
            s.figPause = figRand() < 0.3 && state !== "open";
        }
        if (s.figStart >= 0) {
            const speed = 1.1;
            const halfway = 2.3 + 0.2; // walk from x = -2.3 to the stopping place, whose shadow falls on the keyhole
            const pause = s.figPause ? 2.2 : 0;
            let e = t - s.figStart;
            const t1 = halfway / speed;
            if (e > t1) e = e < t1 + pause ? t1 : e - pause;
            const walked = e * speed;
            figX = s.figDir * (-2.3 + walked);
            const moving = s.figPause && t - s.figStart > t1 && t - s.figStart < t1 + pause ? 0 : 1;
            figBob = Math.abs(Math.sin(walked * 3.4)) * 0.025 * moving;
            present = 1;
            if (walked > 4.6) {
                s.figStart = -1;
                s.figNext = t + 6 + figRand() * 8;
                present = 0;
            }
        }
        u.uFig.value.set(figX, present, figBob, 0.004 * Math.sin(t * 2.3 + index) + 0.002 * Math.sin(t * 7.7));

        u.uLeafAng.value = ang;
        u.uGapI.value = s.gap * breath * 1.3 * (1 - THREE.MathUtils.smoothstep(ang, 0.03, 0.6));
        u.uRoomI.value = s.lamp * breath;
        u.uExpo.value = s.expo * breath;
        u.uTime.value = t;
        u.uRoomCol.value.copy(ROOM).lerp(WARM, s.warm * 0.6);

        // Keyhole, dimmed when the walker's shadow crosses it.
        const shadowX = figX * ((D.roomZ - LAMP.z) / (FIGURE_Z - LAMP.z));
        const keyX = HINGE_X + KEYHOLE.x;
        const keyShade = 1 - present * 0.9 * Math.exp(-(((shadowX - keyX) / 0.32) ** 2));
        const k = s.key * breath * keyShade * (1 - THREE.MathUtils.smoothstep(ang, 0.4, 1.2));
        mats.keyhole.color.copy(u.uRoomCol.value).multiply(LEAK).multiplyScalar(Math.max(k, 0.15));
        mats.wood.emissiveIntensity = s.gap * breath * 1.3 * (1 - THREE.MathUtils.smoothstep(ang, 0.05, 0.6));

        // Pool of light on the floor and dust in it, only while the leaf is off its frame.
        const lit = ang > 0.004;
        if (pool.current) pool.current.visible = lit;
        if (dust.current) {
            dust.current.visible = ang > 0.03;
            const cam = three.camera as THREE.PerspectiveCamera;
            if (dust.current.visible && cam.isPerspectiveCamera) u.uPointScale.value = (three.size.height * three.viewport.dpr) / (2 * Math.tan((cam.fov * DEG) / 2));
        }
    });

    return (
        <group {...handlers}>
            <mesh geometry={geo.stones} material={mats.stone} raycast={NO_RAYCAST} />
            <mesh geometry={backingGeometry()} material={shared.mortar} raycast={NO_RAYCAST} />
            <mesh geometry={geo.pintles} material={shared.iron} raycast={NO_RAYCAST} />
            <mesh geometry={roomGeometry()} material={mats.room} raycast={NO_RAYCAST} />
            <mesh geometry={surroundHitGeometry()} visible={false} />

            <group ref={leaf} position={[HINGE_X, D.leafB, D.leafZ]} rotation-z={-0.003}>
                <mesh geometry={geo.leaf} material={mats.wood} raycast={NO_RAYCAST} />
                <mesh geometry={geo.iron} material={shared.iron} raycast={NO_RAYCAST} />
                <mesh geometry={keyholeGlowGeometry()} material={mats.keyhole} raycast={NO_RAYCAST} />
                {v.knocker ? (
                    <group ref={ring} position={[KNOCKER.x, KNOCKER.y - 0.036, 0.026]}>
                        <mesh geometry={ringGeometry()} material={shared.iron} raycast={NO_RAYCAST} />
                    </group>
                ) : (
                    <group position={[HANDLE.x, HANDLE.y - 0.012, 0.016]} rotation-x={0.12}>
                        <mesh geometry={pullGeometry()} material={shared.iron} raycast={NO_RAYCAST} />
                    </group>
                )}
                <mesh geometry={leafHitGeometry()} visible={false} />
            </group>

            <Plaque v={v} index={index} plate={plate} />

            <mesh ref={pool} geometry={poolGeometry()} material={mats.pool} raycast={NO_RAYCAST} visible={false} renderOrder={2} />
            <points ref={dust} geometry={dustGeometry()} material={mats.dust} raycast={NO_RAYCAST} visible={false} renderOrder={3} />
        </group>
    );
}

const SCREW_TURN = [0.6, -0.3, 1.2, 0.15];

/** The tarnished brass plaque on the wall beside the door, its numeral and title engraved. */
function Plaque({ v, index, plate }: { v: DoorVariant; index: number; plate: string }) {
    const shared = sharedMaterials();
    const sx = D.plateW / 2 - PLAQUE.screw;
    const sy = D.plateH / 2 - PLAQUE.screw;
    // Long titles get smaller type, wrapped to at most three lines.
    const size = THREE.MathUtils.clamp(2.3 / Math.max(plate.length, 1), 0.042, 0.068);
    const engraved = (text: string, y: number, fontSize: number) => (
        <>
            <Text position={[0, y - fontSize * 0.03, 0.0082]} fontSize={fontSize} font={FONT} maxWidth={PLAQUE.textWidth} lineHeight={1.08} textAlign="center" material={shared.engraveLight} raycast={NO_RAYCAST}>
                {text}
            </Text>
            <Text position={[0, y, 0.0088]} fontSize={fontSize} font={FONT} maxWidth={PLAQUE.textWidth} lineHeight={1.08} textAlign="center" material={shared.engraveDark} raycast={NO_RAYCAST}>
                {text}
            </Text>
        </>
    );
    const corners: [number, number][] = [
        [-sx, sy],
        [sx, sy],
        [-sx, -sy],
        [sx, -sy],
    ];
    const body = (
        <>
            <mesh geometry={plateGeometry()} material={shared.brass} />
            {corners.map(([x, y], i) =>
                v.plaqueHang && i > 0 ? (
                    <mesh key={i} geometry={holeGeometry()} material={shared.mortar} position={[x, y, 0.0079]} raycast={NO_RAYCAST} />
                ) : (
                    <mesh key={i} geometry={screwGeometry()} material={shared.screw} position={[x, y, 0.0076]} rotation-z={SCREW_TURN[i]} raycast={NO_RAYCAST} />
                ),
            )}
            {engraved(roman(index + 1), PLAQUE.numeral, 0.088)}
            {engraved(plate, PLAQUE.text, size)}
        </>
    );
    // On the curved wall, a little proud of it on its screws.
    const at = onWall(D.plateU);
    if (v.plaqueHang) {
        // It has lost three screws and swung down on the last one, top left;
        // one of the others is still in the wall where the corner used to be.
        // Hung a little higher, so its low corner clears the wainscot rail.
        return (
            <group position={[at.x, D.plateY + 0.1, at.z]} rotation-y={at.yaw}>
                <group position={[0.1 - sx, sy, 0.016]} rotation={[0.02, 0.03, -v.plaqueTilt]}>
                    <group position={[sx, -sy, 0]}>{body}</group>
                </group>
                <mesh geometry={screwGeometry()} material={shared.screw} position={[0.1 + sx, sy, 0.004]} rotation-z={0.9} raycast={NO_RAYCAST} />
            </group>
        );
    }
    return (
        <group position={[at.x, D.plateY, at.z]} rotation-y={at.yaw}>
            <group position-z={0.016} rotation-z={v.plaqueTilt}>
                {body}
            </group>
        </group>
    );
}
