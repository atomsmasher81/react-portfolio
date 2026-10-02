import { useSyncExternalStore } from "react";

// How the 3D theatre is getting on with getting ready, for whoever is waiting
// at the door. The steps are the real ones, in the order they happen: its code
// arriving, the corridor, the doors, the marquee (and the mirror) painted from
// code (prepare.ts, a slice at a time: textures.ts counts the slices), then the
// lamps lit, which is its shaders compiled and its pictures sent to the GPU
// (scene.tsx). `progress` (0..1) is how much of that is done, never going back.
// No three.js in here: the page reads it before the theatre's code has arrived.

export type ReadyStep = "arriving" | "corridor" | "marquee" | "doors" | "mirror" | "lamps" | "ready";

/** What the waiting card says during each step. */
export const READY_LINE: Record<ReadyStep, string> = {
    arriving: "Unlocking the theatre…",
    corridor: "Papering the corridor…",
    marquee: "Hanging the marquee…",
    doors: "Hanging the doors…",
    mirror: "Silvering the mirror…",
    lamps: "Lighting the lamps…",
    ready: "",
};

export interface Readiness {
    step: ReadyStep;
    progress: number;
    /** The 3D theatre is on the page (its code has arrived): it shows its own waiting card from now on. */
    mounted: boolean;
}

const PAINTED: ReadyStep[] = ["corridor", "doors", "marquee", "mirror"]; // in the order they're painted (prepare.ts)
const pending = new Map<ReadyStep, number>(); // painting still to finish, per step
let slices = { queued: 0, done: 0 };
let asked = false; // painting has been asked for (perhaps all done before)
let generation = 0; // which arrival of the theatre the painting being tracked is for
let lamps = 0;
let mounted = false;
let ready = false;
const SERVER: Readiness = { step: "arriving", progress: 0.03, mounted: false };
let shown: Readiness = SERVER;
const listeners = new Set<() => void>();
let telling = false;

function update() {
    const painting = PAINTED.find((s) => (pending.get(s) ?? 0) > 0);
    const step: ReadyStep = ready ? "ready" : !mounted ? "arriving" : painting ?? (asked ? "lamps" : "arriving");
    const painted = slices.queued ? Math.min(1, slices.done / slices.queued) : 0;
    const raw = ready ? 1 : !mounted ? 0.03 : step === "lamps" ? 0.8 + 0.2 * lamps : 0.08 + 0.72 * painted;
    // in steps of 2%, and never backwards (more may be asked for as it goes)
    const progress = Math.max(mounted === shown.mounted ? shown.progress : 0, Math.floor(raw * 50) / 50);
    if (step === shown.step && progress === shown.progress && mounted === shown.mounted) return;
    shown = { step, progress, mounted };
    // told a moment later (still before the next paint): this is often called while React is rendering
    if (telling) return;
    telling = true;
    queueMicrotask(() => {
        telling = false;
        listeners.forEach((l) => l());
    });
}

/** The 3D theatre has arrived on the page (true) or gone (false). */
export function theatreMounted(on: boolean) {
    generation++;
    mounted = on;
    ready = false;
    lamps = 0;
    pending.clear();
    slices = { queued: 0, done: 0 };
    asked = false;
    update();
}

/** Painting for `step`: says so until it's done. */
export function track<T>(step: ReadyStep, work: Promise<T>) {
    const gen = generation;
    pending.set(step, (pending.get(step) ?? 0) + 1);
    asked = true;
    update();
    const done = () => {
        if (gen !== generation) return;
        pending.set(step, (pending.get(step) ?? 1) - 1);
        update();
    };
    work.then(done, done);
    return work;
}

/** A slice of painting was asked for (textures.ts), or finished. */
export function slicesQueued() {
    slices.queued++;
    update();
}
export function sliceDone() {
    slices.done++;
    update();
}

/** How far the lamps are (0..1): shaders compiled, pictures uploaded. */
export function lampsLit(f: number) {
    lamps = Math.max(lamps, Math.min(1, f));
    update();
}

/** Ready: you can walk in. */
export function theatreReady() {
    ready = true;
    update();
}

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export function useReadiness() {
    return useSyncExternalStore(
        subscribe,
        () => shown,
        () => SERVER,
    );
}
