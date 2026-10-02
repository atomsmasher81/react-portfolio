"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Room, RoomObject } from "@/data/v2/theatre";
import { isRoomObject } from "@/components/v2/theatre3d/chamber-objects";
import { fetchRoom } from "@/components/v2/theatre-data";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import { Chamber, chamberTimings, type ChamberShot } from "@/components/v2/theatre3d/chamber";
import { readingPose } from "@/components/v2/theatre3d/walk";

// Dev-only bench for the room behind a door: /theatre-lab/chamber
//   &kind=taming|personality|hunt|girls|love|laughter (the six doors), or
//         moon|photo|letter (the other kinds) or long|gallery (stress tests)
//   &objects=whip,chess,rifle,coin,knife,wireless   override the room's objects ("none" for none)
//   &room=<id>          a real room, fetched like the theatre does
//   &shot=read|enter|orbit   the reading pose (from the ChamberShot), the doorway, or free
//   &scroll=0..1        down a reading area taller than the screen
//   &power=0..1|ramp    how lit (ramp: up from black over two seconds)
//   &quality=low        the phone build      &fx=0   no post effects    &debug=1  print the shot
//   &dpr=1              render resolution (headless screenshots are slow)
//   &cam=x,y,z,tx,ty,tz any camera, looking at a point

// The six doors from private/theatre.example.json (the Magic Theatre's own,
// from Steppenwolf), and rooms of the other kinds made from the same words
// to exercise the layout: moon, photo, letter, gallery (a photo with words and
// three more prints, one of them missing) and long (every body at once).
const DOORS: Record<string, { plate: string; room: Room }> = {
    taming: {
        plate: "Marvellous Taming of the Steppenwolf",
        room: {
            kind: "text",
            body: [
                "Behind this door is a show. An animal-tamer puts a wolf through tricks with his whip until it obeys him like a trained dog.",
                "Then the roles are reversed. The tamer bows, lays his whip at the wolf's feet, and goes down on all fours; now the wolf gives the orders and the man obeys.",
                "The Treatise on the Steppenwolf says Harry lived like this every day. When the man in him thought or felt something fine, the wolf bared its teeth and laughed at him with bitter scorn. When the wolf had its way, the man lay in ambush and called it brute and beast.",
            ],
            objects: ["whip"],
        },
    },
    personality: {
        plate: "Guidance in the Building up of the Personality. Success Guaranteed.",
        room: {
            kind: "text",
            body: [
                "In the theatre's great mirror Harry's reflection falls apart into many Harrys at once: children, young men, old men, appearing and vanishing together.",
                "Behind this door a chess player sits with those pieces. He sets them out on the board as one life, sweeps them away, and builds another game from the same figures, one game after another, each figure a bit of Harry.",
                "When he has shown him how it is done, he gives Harry the pieces to take with him.",
            ],
            objects: ["chess"],
        },
    },
    hunt: {
        plate: "Jolly Hunting. Great Hunt in Automobiles.",
        room: {
            kind: "text",
            body: [
                "Behind this door a war has broken out between men and machines. Harry meets Gustav, a friend from his schooldays, now a professor of theology, and the two of them take up a post high above a road and shoot at the motor-cars that pass.",
                "They stop the car of Loering, the attorney-general. A young typist, Dora, comes through a crash and joins them at their post.",
                "When a quiet man comes by below, Harry finds he could not shoot him. Helping Dora down, he kisses her knee; she laughs, the planks give way, and they fall into nothing.",
            ],
            objects: ["rifle"],
        },
    },
    girls: {
        plate: "All Girls Are Yours. One Quarter in the Slot.",
        room: {
            kind: "text",
            body: [
                "In the great mirror one of the young Harrys breaks away from the rest and runs in through this door.",
                "Behind it Harry is young again, on a hillside in spring, and meets Rosa Kreisler, whom he loved as a boy and never dared to speak to. This time he speaks, and she loves him too.",
                "Then, one after another, every girl he ever loved or wanted and let go comes back to him, and none of them is missed this time.",
            ],
            objects: ["coin"],
        },
    },
    love: {
        plate: "How One Kills for Love",
        room: {
            kind: "quote",
            body: [
                "Behind this door Harry finds Hermine and Pablo asleep together. He takes the knife from his pocket and stabs her. Pablo covers her and goes.",
                "The Immortals put Harry on trial for misusing the magic theatre and mistaking its pictures for reality. The sentence is read out:",
            ],
            quote: "We condemn Haller to eternal life.",
            by: "The court of the Magic Theatre",
            objects: ["knife"],
        },
    },
    laughter: {
        plate: "Laughing Tears. Cabinet of Humour.",
        room: {
            kind: "quote",
            body: [
                "Before the theatre, Pablo tells Harry that true humour begins when a man stops taking himself seriously.",
                "At the end Mozart switches on a wireless, and Handel comes through it, mangled by the machine. The music is still in it, he says, as it is in life; Harry has got to learn to laugh. That will be required of him.",
                "Pablo shrinks Hermine to the size of a toy figure and puts her in his pocket. Harry resolves to begin the game again.",
            ],
            quote: "One day I would learn how to laugh.",
            by: "Harry Haller",
            objects: ["wireless"],
        },
    },
};

const MIRROR = "In the theatre there is a mirror, and the man who looks into it doesn't see one face. He sees hundreds of them, every one of them him.";

const SAMPLES: Record<string, { plate: string; room: Room }> = {
    ...DOORS,
    // the old names still work
    text: DOORS.taming,
    quote: DOORS.love,
    moon: { plate: "The mirror", room: { kind: "moon", body: [MIRROR] } },
    photo: {
        plate: "All Girls Are Yours. One Quarter in the Slot.",
        room: { kind: "photo", src: "/images/photos/BJoJr8HBisj.jpg", caption: "Harry is young again,\non a hillside in spring.", date: "1927" },
    },
    letter: {
        plate: "Laughing Tears. Cabinet of Humour.",
        room: { kind: "letter", body: [(DOORS.laughter.room as { body: string[] }).body[0], (DOORS.laughter.room as { body: string[] }).body[1]], email: "", subject: "" },
    },
    long: {
        plate: "Guidance in the Building up of the Personality. Success Guaranteed.",
        room: { kind: "text", body: Object.values(DOORS).flatMap((d) => (d.room as { body: string[] }).body) },
    },
    gallery: {
        plate: "All Girls Are Yours. One Quarter in the Slot.",
        room: {
            kind: "photo",
            src: "/images/photos/BJoJr8HBisj.jpg",
            caption: "Harry is young again,\non a hillside in spring.",
            date: "1927",
            body: [(DOORS.girls.room as { body: string[] }).body[1]],
            images: [
                { src: "/images/photos/B2hI0apgoII.jpg", caption: "Rosa Kreisler, whom he loved as a boy.", date: "1927-04" },
                { src: "/images/photos/BICzMWbhPfX.jpg" },
                { src: "/images/photos/does-not-exist.jpg", caption: "None of them is missed this time." },
            ],
        },
    },
};

function useParams() {
    const [p, setP] = useState<URLSearchParams | null>(null);
    useEffect(() => setP(new URLSearchParams(window.location.search)), []);
    return p;
}

// The camera: the doorway, any given pose, or the reading pose (readingPose in
// walk.ts, the same rule the theatre's camera uses).
function Rig({ shot, mode, scroll, cam: at }: { shot: ChamberShot | null; mode: string; scroll: number; cam: number[] | null }) {
    const { camera, size } = useThree();
    useEffect(() => {
        const cam = camera as THREE.PerspectiveCamera;
        const aspect = size.width / size.height;
        cam.fov = aspect < 0.85 ? 70 : 56;
        cam.updateProjectionMatrix();
        if (at && at.length === 6) {
            cam.position.set(at[0], at[1], at[2]);
            cam.lookAt(at[3], at[4], at[5]);
        } else if (mode === "enter") {
            cam.position.set(0, 1.62, 3.3);
            cam.lookAt(0, 1.15, 0);
        } else if (shot) {
            const pose = readingPose(shot, cam.fov, aspect, scroll);
            cam.position.copy(pose.pos);
            cam.lookAt(pose.look);
        }
    }, [camera, size, shot, mode, scroll, at]);
    return null;
}

/** For the headless screenshots: how many frames have been drawn, and when the layout arrived. */
function Probe({ shot }: { shot: ChamberShot | null }) {
    const gl = useThree((s) => s.gl);
    useFrame(() => {
        const w = window as unknown as { __chamber?: Record<string, unknown> };
        const st = (w.__chamber ??= { frames: 0, t0: performance.now() });
        st.frames = (st.frames as number) + 1;
        if (shot && !st.shotAt) {
            st.shotAt = Math.round(performance.now() - (st.t0 as number));
            st.atShot = st.frames;
        }
        if (st.atShot !== undefined) st.since = (st.frames as number) - (st.atShot as number);
        st.calls = gl.info.render.calls;
        st.timings = chamberTimings;
        if (shot) st.shot = shot;
        st.programs = gl.info.programs?.length;
    });
    return null;
}

function Ramp({ on, set }: { on: boolean; set: (p: number) => void }) {
    useFrame(({ clock }) => {
        if (on) set(Math.min(1, clock.elapsedTime / 2));
    });
    return null;
}

function Effects({ quality }: { quality: "high" | "low" }) {
    const fringe = useMemo(() => new THREE.Vector2(0.0008, 0.0005), []);
    return quality === "high" ? (
        <EffectComposer multisampling={0}>
            <Bloom mipmapBlur luminanceThreshold={0.72} luminanceSmoothing={0.25} intensity={1.15} radius={0.72} />
            <ChromaticAberration offset={fringe} radialModulation modulationOffset={0.35} />
            <Noise opacity={0.07} />
            <Vignette offset={0.2} darkness={0.9} />
        </EffectComposer>
    ) : (
        <EffectComposer multisampling={0}>
            <Bloom mipmapBlur luminanceThreshold={0.75} intensity={1} radius={0.6} />
            <Vignette offset={0.2} darkness={0.85} />
        </EffectComposer>
    );
}

export function ChamberLab() {
    const params = useParams();
    const [fetched, setFetched] = useState<{ plate: string; room: Room } | null>(null);
    const [shot, setShot] = useState<ChamberShot | null>(null);
    const [ramp, setRamp] = useState(0);
    const id = params?.get("room");
    useEffect(() => {
        if (!id) return;
        fetchRoom(id).then((d) => d && setFetched({ plate: d.plate, room: d.room }));
    }, [id]);
    if (!params) return null;
    const base = id ? fetched : SAMPLES[params.get("kind") ?? "taming"] ?? SAMPLES.taming;
    const objectsParam = params.get("objects");
    const sample =
        base && objectsParam !== null
            ? { ...base, room: { ...base.room, objects: objectsParam.split(",").filter((o): o is RoomObject => isRoomObject(o)) } }
            : base;
    const quality = params.get("quality") === "low" ? "low" : "high";
    const mode = params.get("shot") ?? "read";
    const scroll = Number(params.get("scroll") ?? 0);
    const powerParam = params.get("power") ?? "1";
    const power = powerParam === "ramp" ? ramp : Number(powerParam);
    const fx = params.get("fx") !== "0";
    const debug = params.get("debug") === "1";
    const cam = params.get("cam")?.split(",").map(Number) ?? null;

    return (
        <div className="fixed inset-0 z-[100] bg-black">
            <Canvas
                dpr={params.get("dpr") ? Number(params.get("dpr")) : quality === "high" ? 1.6 : 1.2}
                camera={{ fov: 56, near: 0.05, far: 60, position: [0, 1.62, 3.3] }}
                gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
            >
                <color attach="background" args={[PALETTE.void]} />
                <fogExp2 attach="fog" args={[PALETTE.fog, 0.07]} />
                <Suspense fallback={null}>{sample && <Chamber room={sample.room} plate={sample.plate} power={power} quality={quality} onLayout={setShot} />}</Suspense>
                <Ramp on={powerParam === "ramp"} set={setRamp} />
                <Probe shot={shot} />
                {mode === "orbit" ? <OrbitControls target={shot ? new THREE.Vector3(...shot.center) : new THREE.Vector3(0, 1.3, 0)} /> : <Rig shot={shot} mode={mode} scroll={scroll} cam={cam} />}
                {fx && <Effects quality={quality} />}
            </Canvas>
            {debug && shot && (
                <pre className="pointer-events-none fixed bottom-2 left-2 text-[11px] text-white/70">
                    {JSON.stringify({ center: shot.center.map((v) => +v.toFixed(3)), width: +shot.width.toFixed(3), height: +shot.height.toFixed(3) })}
                </pre>
            )}
        </div>
    );
}
