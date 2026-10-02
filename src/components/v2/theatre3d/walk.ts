import * as THREE from "three";
import { CAMERA, CORRIDOR, DOOR_S, MARQUEE_S, MARQUEE_Y, MIRROR_S, OUTER, onArc } from "@/components/v2/theatre3d/layout";
import type { ChamberShot } from "@/components/v2/theatre3d/chamber-layout";

// How the camera walks the corridor: where it stands and where it looks at
// each point of the walk. Shared by the theatre and the keyhole on the way
// in, whose view through the hole ends exactly where the theatre begins.

export const isPortrait = () => window.innerWidth / window.innerHeight < 0.85;

/** The theatre camera's vertical field of view. */
export const theatreFov = (portrait: boolean) => (portrait ? 70 : 56);

const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

const tmp = new THREE.Vector3();

/**
 * Where the camera stands and looks at `at` (0..1) along the walk, before
 * stepping up to a door, breathing, or turning toward the pointer. Returns
 * the door it's glancing at (its position along the walk).
 */
export function viewAt(at: number, portrait: boolean, pos: THREE.Vector3, look: THREE.Vector3) {
    // Where we stand, and where we look: ahead along the curve.
    onArc(at, CAMERA.radius, CAMERA.eye, pos);
    onArc(Math.min(at + 0.07, 1), CORRIDOR.radius + 0.35, 1.5, look);

    // A glance at each door as we pass it, toward the door and the plaque beside it
    // (on its far side); on a narrow screen turn further, so both are in view.
    let best = 0;
    let bestS = 0;
    for (const ds of DOOR_S) {
        const w = 1 - smooth(0.012, 0.075, Math.abs(at - ds));
        if (w > best) {
            best = w;
            bestS = ds;
        }
    }
    if (best > 0) look.lerp(onArc(bestS + (portrait ? 0.01 : 0.004), OUTER - 0.3, 1.5, tmp), best * (portrait ? 0.85 : 0.72));
    // Up at the signs over the entrance on arrival, and at the mirror at the end.
    const arrive = 1 - smooth(-0.035, 0.045, at);
    if (arrive > 0) look.lerp(onArc(MARQUEE_S, CORRIDOR.radius, MARQUEE_Y - 0.2, tmp), arrive * 0.85);
    const end = smooth(0.85, 0.925, at);
    if (end > 0) look.lerp(onArc(MIRROR_S, CORRIDOR.radius, 1.75, tmp), end);
    return bestS;
}

/**
 * In a room behind a door: where to stand to read the shrine. A phone in
 * portrait fits the inscription's width; a wider screen fits its height (but
 * never more than 1.6× its width); anything taller than that is read by
 * scrolling down it (`scroll` 0..1). `insets` (css px) are the parts of the
 * screen covered by the page (the site's header above, the room's card below):
 * the inscription is framed in what's left, and can be scrolled all the way
 * up above the card. Returns how much is out of view (`extra`, m).
 */
export function readingPose(
    shot: ChamberShot,
    fovDeg: number,
    aspect: number,
    scroll = 0,
    pos = new THREE.Vector3(),
    look = new THREE.Vector3(),
    insets: { top: number; bottom: number; height: number } | null = null,
) {
    const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
    const tanH = tanV * aspect;
    const top = insets ? Math.max(0, insets.top) : 0;
    const bottom = insets ? Math.max(0, insets.bottom) : 0;
    const open = insets ? Math.max(0.35, (insets.height - top - bottom) / insets.height) : 1; // the share of the screen's height left to read in
    // with a little room round it; without insets, room for the header and the card anyway
    const dist = insets
        ? aspect < 1
            ? (shot.width / 2 / tanH) * 1.06
            : (Math.min(shot.height, shot.width * 1.6) / 2 / (tanV * open)) * 1.06
        : aspect < 1
          ? (shot.width / 2 / tanH) * 1.06
          : (Math.min(shot.height, shot.width * 1.6) / 2 / tanV) * 1.2;
    const visible = 2 * dist * tanV * open;
    const extra = Math.max(0, shot.height - visible);
    const y = shot.center[1] + extra / 2 - extra * Math.min(1, Math.max(0, scroll));
    // aim a little below what's being read, so it sits in the middle of the open part of the screen
    const shift = insets ? ((bottom - top) / insets.height) * dist * tanV : 0;
    pos.set(shot.center[0], y - shift, shot.center[2] + dist);
    look.set(shot.center[0], y - shift, shot.center[2]);
    return { pos, look, extra };
}

/** Coming into a room: standing just inside its doorway, looking at the shrine. */
export const ROOM_ENTRY = { pos: new THREE.Vector3(0, 1.62, 3.3), look: new THREE.Vector3(0, 1.15, 0) };
