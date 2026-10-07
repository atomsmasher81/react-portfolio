import * as THREE from "three";
import { BlendFunction, BloomEffect, ChromaticAberrationEffect, EffectPass, NoiseEffect, VignetteEffect, type Effect } from "postprocessing";
import type { Quality } from "@/components/v2/theatre3d/scene";

// How the theatre looks on this device: the quality it's drawn at, and its film
// (what its effects do to every frame: scene.tsx, Effects). The keyhole's view
// comes through the same film as you go through (keyhole-view.tsx), so the
// theatre fades in over a view that already looks just like it.

/** Phones and small machines get the lighter theatre (`?quality=` to force one). */
export function detectQuality(): Quality {
    const forced = new URLSearchParams(window.location.search).get("quality");
    if (forced === "low" || forced === "high") return forced;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return coarse || (navigator.hardwareConcurrency ?? 8) <= 4 || memory <= 4 ? "low" : "high";
}

// The film, for each quality. The blend functions are what the effects' React
// components use when given none (bloom added on, grain dodged).
export const FILM = {
    high: {
        bloom: { blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 0.72, luminanceSmoothing: 0.25, intensity: 1.15, radius: 0.72 },
        fringe: { offset: [0.0008, 0.0005] as [number, number], radialModulation: true, modulationOffset: 0.35 },
        grain: { blendFunction: BlendFunction.COLOR_DODGE, premultiply: true, opacity: 0.05 },
        vignette: { offset: 0.2, darkness: 0.9 },
    },
    low: {
        bloom: { blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: 0.75, intensity: 1, radius: 0.6 },
        fringe: null,
        grain: null,
        vignette: { offset: 0.2, darkness: 0.85 },
    },
};

/**
 * The film as one pass, as the theatre's composer makes it, to run on a picture
 * of the corridor (a render target) into another. `grain(on)`: the grain goes on
 * only at a high enough resolution, as in the theatre.
 */
export function filmPass(quality: Quality, camera: THREE.Camera) {
    const f = FILM[quality];
    const effects: Effect[] = [new BloomEffect(f.bloom)];
    if (f.fringe) effects.push(new ChromaticAberrationEffect({ ...f.fringe, offset: new THREE.Vector2(...f.fringe.offset) }));
    const noise = f.grain ? new NoiseEffect(f.grain) : null;
    if (noise) effects.push(noise);
    effects.push(new VignetteEffect(f.vignette));
    const pass = new EffectPass(camera, ...effects);
    const grain = (on: boolean) => {
        if (noise && f.grain) noise.blendMode.opacity.value = on ? f.grain.opacity : 0;
    };
    return { pass, grain };
}
