import * as THREE from "three";

// The Magic Theatre is a horseshoe-shaped corridor, like the one in
// Steppenwolf: you walk a 270° curve with doors on the outer wall and the
// mirror at the far end. Everything in the scene is placed along that curve
// with the helpers below, in metres, Y up.
//
// The curve is parameterised by s: 0 is the entrance mouth, 1 is the end wall.
// The camera starts a little before 0 so the marquee over the entrance is in
// frame, and stops short of 1 to face the mirror.
//
// Seen from above, the walker starts at (-R, 0, 0) facing -Z and curves to the
// right, around the origin. The outer wall (doors) is on the walker's LEFT,
// the inner wall on the RIGHT.

export const CORRIDOR = {
    radius: 7, // centreline
    width: 3.4,
    height: 4.2,
    start: -0.1, // the geometry begins here (an end wall closes it behind you)
    end: 1, // and ends here (the mirror's wall)
};

export const OUTER = CORRIDOR.radius + CORRIDOR.width / 2; // 8.7, the door wall
export const INNER = CORRIDOR.radius - CORRIDOR.width / 2; // 5.3

const THETA0 = Math.PI;
const SWEEP = Math.PI * 1.5;

/** Angle around the origin for a point s along the corridor. */
export const theta = (s: number) => THETA0 + s * SWEEP;

/** Arc length in metres between two values of s, along the centreline. */
export const metres = (ds: number) => ds * SWEEP * CORRIDOR.radius;

/** A point on the floor at s, `r` metres from the origin (use OUTER, INNER, CORRIDOR.radius…). */
export function onArc(s: number, r: number = CORRIDOR.radius, y = 0, out = new THREE.Vector3()) {
    const t = theta(s);
    return out.set(r * Math.cos(t), y, r * Math.sin(t));
}

/** Unit direction of travel at s. */
export function tangent(s: number, out = new THREE.Vector3()) {
    const t = theta(s);
    return out.set(-Math.sin(t), 0, Math.cos(t));
}

/** Unit direction from the origin outward at s (toward the outer, door wall). */
export function outward(s: number, out = new THREE.Vector3()) {
    const t = theta(s);
    return out.set(Math.cos(t), 0, Math.sin(t));
}

// Rotation.y values that turn an object's local +Z to face a given way. Build
// every part facing +Z with its base on y = 0, then place it with these.

/** On the outer wall, facing into the corridor (toward the origin). */
export const yawFromOuterWall = (s: number) => {
    const t = theta(s);
    return Math.atan2(-Math.cos(t), -Math.sin(t));
};

/** On the inner wall, facing into the corridor (away from the origin). */
export const yawFromInnerWall = (s: number) => {
    const t = theta(s);
    return Math.atan2(Math.cos(t), Math.sin(t));
};

/** Facing back down the corridor, toward someone walking in (the marquee, the mirror). */
export const yawFacingBack = (s: number) => {
    const t = theta(s);
    return Math.atan2(Math.sin(t), -Math.cos(t));
};

// Where things are.
export const DOOR_S = [0.2, 0.333, 0.466, 0.6, 0.733, 0.866];
export const MARQUEE_S = 0.07;
export const MARQUEE_Y = 3.15; // centre of the sign
export const MIRROR_S = CORRIDOR.end;
export const LAMP_S = { outer: [0.1, 0.267, 0.4, 0.533, 0.667, 0.8, 0.93], inner: [0.02, 0.2, 0.333, 0.466, 0.6, 0.733, 0.866] };

// The walk.
export const CAMERA = {
    from: -0.06,
    to: 0.93,
    eye: 1.62,
    radius: CORRIDOR.radius - 0.45, // a little toward the inner wall, so the doors are seen at an angle
};

// Colours the whole scene shares.
export const PALETTE = {
    void: "#070404",
    fog: "#0a0605",
    wood: "#2a1a12",
    woodDark: "#160d09",
    iron: "#2e2723",
    brass: "#8f7142",
    lamp: "#ffb36b",
    neon: "#ff6a3d",
    room: "#ffc58a",
};
