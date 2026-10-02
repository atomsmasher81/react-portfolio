"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "@/components/v2/theatre3d/layout";
import {
    FACE,
    MADMEN_LIGHTS,
    MADMEN_LINE,
    NEON_BASELINE,
    NEON_COUNT,
    NEON_SIZE,
    NEON_TEXT,
    NEON_TRACK,
    TUBE_Z,
    type MarqueeLive,
} from "@/components/v2/theatre3d/marquee-parts";
import { litBySign, type SignLights } from "@/components/v2/theatre3d/marquee-lights";
import { marqueeTextures } from "@/components/v2/theatre3d/marquee-textures";

// "MAGIC THEATRE" in neon, one tube per letter so each can fail on its own,
// and beneath it a thinner run of script, "FOR MADMEN ONLY", on a transformer
// of its own.

const FONT = "/fonts/IMFellEnglishSC.ttf";
const SCRIPT = "/fonts/IMFellEnglish-Italic.ttf";

// Each letter is a glass tube bent round the outline of the type, the way old
// theatre signs were made, sitting in a shallow channel that catches its
// light. Nothing is tone-mapped after the bloom, so the tube is kept just hot
// enough to bloom without clipping to cream; the halo carries the deeper red
// of the gas.
const CORE = new THREE.Color(PALETTE.neon);
const TUBE_GAIN = 3.6;
const CHANNEL_GAIN = 0.45;
const TUBE_WIDTH = 0.006;
const SCRIPT_WIDTH = 0.0045;
const GLASS = new THREE.Color("#090706"); // an unlit tube
const HALO = new THREE.Color(PALETTE.neon).lerp(new THREE.Color("#ff2a10"), 0.35).multiplyScalar(1.1);

// Where each letter's tube is clipped to its posts, as fractions of the
// letter's advance, at its foot and at its head.
const CLIPS: Record<string, { foot: number[]; head: number[] }> = {
    M: { foot: [-0.36, 0.36], head: [-0.31, 0.31] },
    A: { foot: [-0.36, 0.34], head: [0] },
    G: { foot: [0.05], head: [0] },
    I: { foot: [0], head: [0] },
    C: { foot: [0.05], head: [0] },
    T: { foot: [0], head: [-0.33, 0.33] },
    H: { foot: [-0.3, 0.3], head: [-0.3, 0.3] },
    E: { foot: [-0.22, 0.25], head: [-0.22, 0.22] },
    R: { foot: [-0.24, 0.32], head: [-0.1] },
};

// The bits of troika's text mesh we read and drive.
type TroikaText = THREE.Mesh & {
    textRenderInfo: { caretPositions?: Float32Array; visibleBounds?: number[] } | null;
    outlineOpacity: number;
};

interface Measured {
    x: number[]; // centre of each character
    w: number[]; // advance of each character
    cap: number;
}

// The script line is held at its baseline, at these fractions of its width.
const SCRIPT_CLIPS = [-0.43, -0.16, 0.12, 0.4];

// Enough room for every clip in CLIPS across the title, and the script's.
const MAX_CLIPS = Array.from(NEON_TEXT).reduce((n, ch) => n + (CLIPS[ch] ? CLIPS[ch].foot.length + CLIPS[ch].head.length : 0), 0) + SCRIPT_CLIPS.length;
const clipGeo = new THREE.BoxGeometry(0.022, 0.007, 0.01);
const postGeo = new THREE.CylinderGeometry(0.0026, 0.0032, TUBE_Z - FACE.z, 6).rotateX(Math.PI / 2);

export function NeonTitle({ live, lights }: { live: MarqueeLive; lights: SignLights }) {
    const [measured, setMeasured] = useState<Measured | null>(null);
    const [scriptWidth, setScriptWidth] = useState(0);
    const halos = useRef<(TroikaText | null)[]>([]);
    const scriptHalo = useRef<TroikaText>(null);
    const strokes = useMemo(() => Array.from({ length: NEON_COUNT + 1 }, () => new THREE.Color()), []);
    const clipRef = useRef<THREE.InstancedMesh>(null);
    const postRef = useRef<THREE.InstancedMesh>(null);

    const onMeasure = useCallback((mesh: TroikaText) => {
        const info = mesh.textRenderInfo;
        const carets = info?.caretPositions;
        const ink = info?.visibleBounds;
        if (!carets || !ink) return;
        setMeasured((prev) => {
            if (prev) return prev;
            const x: number[] = [];
            const w: number[] = [];
            for (let k = 0; k < NEON_COUNT; k++) {
                x.push((carets[k * 4] + carets[k * 4 + 1]) / 2 + (k - (NEON_COUNT - 1) / 2) * NEON_TRACK);
                w.push(carets[k * 4 + 1] - carets[k * 4]);
            }
            // Set on the baseline, the top of the ink is the height of the capitals.
            return { x, w, cap: ink[3] };
        });
    }, []);

    const onScript = useCallback((mesh: TroikaText) => {
        const b = mesh.textRenderInfo?.visibleBounds;
        if (b) setScriptWidth((prev) => prev || b[2] - b[0]);
    }, []);

    const mats = useMemo(() => {
        // The channel: dark painted tin, lit from within by its tube.
        const cores = Array.from(
            { length: NEON_COUNT + 1 },
            () => new THREE.MeshStandardMaterial({ color: "#1e1513", roughness: 0.6, metalness: 0.2, emissive: HALO, emissiveIntensity: 0, toneMapped: false }),
        );
        const halo = new THREE.MeshBasicMaterial({ color: HALO, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const glow = new THREE.MeshBasicMaterial({
            map: marqueeTextures().glow,
            color: PALETTE.neon,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
        });
        const iron = litBySign(new THREE.MeshStandardMaterial({ color: "#1c1714", roughness: 0.5, metalness: 0.6 }), lights);
        return { cores, halo, glow, iron };
    }, [lights]);

    // Place the clips and posts once the type is measured, and tell the
    // sign's lighting where each letter and the script line are.
    useLayoutEffect(() => {
        const clips = clipRef.current;
        const posts = postRef.current;
        if (!measured || !clips || !posts) return;
        const m = new THREE.Matrix4();
        let n = 0;
        const at = (x: number, y: number) => {
            m.makeTranslation(x, y, TUBE_Z + 0.004);
            clips.setMatrixAt(n, m);
            m.makeTranslation(x, y, (TUBE_Z + FACE.z) / 2);
            posts.setMatrixAt(n, m);
            n++;
        };
        for (let k = 0; k < NEON_COUNT; k++) {
            const ch = NEON_TEXT[k];
            live.tubePoints.set([measured.x[k], NEON_BASELINE + measured.cap / 2, TUBE_Z + 0.01], k * 3);
            const c = CLIPS[ch];
            if (!c) continue;
            for (const f of c.foot) at(measured.x[k] + f * measured.w[k], NEON_BASELINE + 0.014);
            for (const f of c.head) at(measured.x[k] + f * measured.w[k], NEON_BASELINE + measured.cap - 0.014);
        }
        if (scriptWidth > 0) {
            for (let i = 0; i < MADMEN_LIGHTS; i++) {
                const x = ((i + 0.5) / MADMEN_LIGHTS - 0.5) * scriptWidth;
                live.tubePoints.set([x, MADMEN_LINE.baseline + MADMEN_LINE.size * 0.3, TUBE_Z + 0.01], (NEON_COUNT + i) * 3);
            }
            for (const f of SCRIPT_CLIPS) at(f * scriptWidth, MADMEN_LINE.baseline + 0.008);
        }
        clips.count = posts.count = n;
        clips.instanceMatrix.needsUpdate = posts.instanceMatrix.needsUpdate = true;
    }, [measured, scriptWidth, live]);

    useFrame(() => {
        for (let k = 0; k < NEON_COUNT; k++) {
            const v = live.neon[k];
            mats.cores[k].emissiveIntensity = v * CHANNEL_GAIN;
            strokes[k].setRGB(GLASS.r + CORE.r * v * TUBE_GAIN, GLASS.g + CORE.g * v * TUBE_GAIN, GLASS.b + CORE.b * v * TUBE_GAIN);
            const h = halos.current[k];
            if (h) h.outlineOpacity = v;
        }
        const v = live.madmen;
        mats.cores[NEON_COUNT].emissiveIntensity = v * CHANNEL_GAIN;
        strokes[NEON_COUNT].setRGB(GLASS.r + CORE.r * v * TUBE_GAIN, GLASS.g + CORE.g * v * TUBE_GAIN, GLASS.b + CORE.b * v * TUBE_GAIN);
        if (scriptHalo.current) scriptHalo.current.outlineOpacity = v * 0.9;
        mats.glow.opacity = (live.neonAvg * 0.8 + live.madmen * 0.2) * 0.35;
    });

    const textWidth = measured ? measured.x[NEON_COUNT - 1] - measured.x[0] + measured.w[0] : 2.3;
    const script = { font: SCRIPT, fontSize: MADMEN_LINE.size, letterSpacing: 0.02, anchorX: "center" as const, anchorY: "bottom-baseline" as const, sdfGlyphSize: 128 };

    return (
        <group>
            {/* Measures the line once; the letters are then set one by one. */}
            <Text font={FONT} fontSize={NEON_SIZE} anchorX="center" anchorY="bottom-baseline" visible={false} onSync={onMeasure}>
                {NEON_TEXT}
            </Text>

            {measured &&
                Array.from(NEON_TEXT).map((ch, k) =>
                    ch === " " ? null : (
                        <group key={k} position={[measured.x[k], NEON_BASELINE, 0]}>
                            {/* The halo: a fatter, softer copy just behind the tube. */}
                            <Text
                                ref={(el: TroikaText | null) => {
                                    halos.current[k] = el;
                                }}
                                font={FONT}
                                fontSize={NEON_SIZE}
                                anchorX="center"
                                anchorY="bottom-baseline"
                                position-z={TUBE_Z - 0.004}
                                fillOpacity={0}
                                outlineWidth="4.5%"
                                outlineBlur="11%"
                                outlineColor={HALO}
                                outlineOpacity={0}
                                material={mats.halo}
                                sdfGlyphSize={128}
                            >
                                {ch}
                            </Text>
                            <Text
                                font={FONT}
                                fontSize={NEON_SIZE}
                                anchorX="center"
                                anchorY="bottom-baseline"
                                position-z={TUBE_Z}
                                material={mats.cores[k]}
                                sdfGlyphSize={128}
                                strokeWidth={TUBE_WIDTH}
                                strokeColor={strokes[k]}
                            >
                                {ch}
                            </Text>
                        </group>
                    ),
                )}

            {/* FOR MADMEN ONLY: one run of script tube with its halo. */}
            <group position-y={MADMEN_LINE.baseline}>
                <Text {...script} ref={scriptHalo} position-z={TUBE_Z - 0.004} fillOpacity={0} outlineWidth="5%" outlineBlur="12%" outlineColor={HALO} outlineOpacity={0} material={mats.halo}>
                    {MADMEN_LINE.text}
                </Text>
                <Text {...script} position-z={TUBE_Z} material={mats.cores[NEON_COUNT]} strokeWidth={SCRIPT_WIDTH} strokeColor={strokes[NEON_COUNT]} onSync={onScript}>
                    {MADMEN_LINE.text}
                </Text>
            </group>

            {/* Clips across the tubes, and the posts that hold them off the face. */}
            <instancedMesh ref={clipRef} args={[clipGeo, mats.iron, MAX_CLIPS]} frustumCulled={false} />
            <instancedMesh ref={postRef} args={[postGeo, mats.iron, MAX_CLIPS]} frustumCulled={false} />

            {/* Red light thrown back onto the face behind the lettering. */}
            <mesh position={[0, -0.02, FACE.z + 0.008]} material={mats.glow}>
                <planeGeometry args={[textWidth + 0.7, 0.72]} />
            </mesh>
        </group>
    );
}
