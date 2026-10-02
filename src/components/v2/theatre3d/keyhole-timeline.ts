// One clock for going through the keyhole, shared by the 3D keyhole and the
// page around it (the dark closing in). Times in ms from the click.
//
// Two ways in:
//  - "dive" (the default): you lean in and go through the keyhole, into the
//    dark on the other side.
//  - "light": first a golden light shines out of the keyhole, then the light
//    itself turns dark, rippling as it changes, and then you go through.

export type Entry = "dive" | "light";

export interface Timeline {
    gold: number[]; // the golden light gathers and shines out (empty: no light)
    turn: number[]; // the light turns dark, from the hole outward
    dive: number[]; // through the keyhole
    fade: number[]; // into the dark on the other side
    go: number; // and you're through
    handoff: number; // when the theatre itself starts to come in over the view (theatre-host.tsx)
}

// How long the theatre takes to come in over the keyhole's view: it wakes, runs
// a few frames unseen, then fades in (theatre-host.tsx). Through the keyhole
// this ends exactly as the dive does, so the last stretch of the dive (the hole
// fills the screen and the view has settled on the theatre's own) is a
// cross-fade from the view through the keyhole to the theatre itself.
export const THEATRE_WAKE = 150;
export const THEATRE_FADE = 600;
const HANDOFF = THEATRE_WAKE + THEATRE_FADE;

export const TIMELINES: Record<Entry, Timeline> = {
    // No fade at the end: the theatre itself fades in over the end of the dive.
    dive: { gold: [], turn: [], dive: [150, 3000], fade: [], go: 3000, handoff: 3000 - HANDOFF },
    light: { gold: [0, 1300], turn: [1500, 3100], dive: [3500, 6300], fade: [], go: 6300, handoff: 6300 - HANDOFF },
};

// For people who'd rather not have motion: no light, no dive, just the dark (the theatre fades in over it).
export const TIMELINE_REDUCED: Timeline = { gold: [], turn: [], dive: [], fade: [0, 450], go: 500, handoff: 500 };

// Without 3D (the drawn keyhole): the page goes dark and you're through.
export const TIMELINE_PLAIN: Timeline = { gold: [], turn: [], dive: [], fade: [250, 1000], go: 1050, handoff: 1050 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const span = (t: number, r: number[]) => (r.length < 2 ? 0 : clamp01((t - r[0]) / (r[1] - r[0])));

export interface KeyholeMoment {
    light: number; // how much light comes out of the hole, 0..1
    front: number; // how far down the beam the light has turned dark, 0..1.35 (past the end)
    eclipse: number; // the source itself gone dark, 0..1
    dive: number; // how far through the keyhole, 0..1
    fade: number; // the dark on the other side, 0..1
    page: number; // how dark the page around the keyhole is, 0..1
}

export const AT_REST: KeyholeMoment = { light: 0, front: 0, eclipse: 0, dive: 0, fade: 0, page: 0 };

export function moment(t: number, tl: Timeline = TIMELINES.dive): KeyholeMoment {
    if (t < 0) return AT_REST;
    const lit = tl.gold.length > 0;
    const diveStart = tl.dive.length ? tl.dive[0] : Infinity;
    // the light dies away as you lean in
    const light = lit ? ease(span(t, tl.gold)) * (1 - ease(span(t, [diveStart, diveStart + 700]))) : 0;
    const front = lit ? 1.35 * ease(span(t, tl.turn)) : 0;
    const eclipse = lit && tl.turn.length ? ease(span(t, [tl.turn[0] - 150, tl.turn[0] + 600])) : 0;
    const dive = smoother(span(t, tl.dive));
    const fade = ease(span(t, tl.fade));
    // the page dims so the light shows, then goes dark as you go in
    const dim = lit ? 0.68 * ease(span(t, [0, tl.gold[1]])) : 0;
    const closing = tl.dive.length ? 0.97 * ease(span(t, [diveStart, diveStart + 1500])) : 0.97 * ease(span(t, tl.fade));
    return { light, front, eclipse, dive, fade, page: Math.max(dim, closing) };
}
