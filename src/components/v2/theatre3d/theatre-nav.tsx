'use client';

/**
 * The Magic Theatre's way-finding: what's drawn over the 3D to tell you where
 * you are and what you can do. All of it is presentational (no 3D); the page
 * owns the state and passes it in. Bench: /theatre-lab/nav (every piece, every
 * state, phone and desktop).
 *
 *   DoorRail     the map of the corridor, a brass rail at the right-hand edge (its "?" opens the programme)
 *   ActionBar    the one thing to do next, on a card at the foot of the screen
 *   MirrorAsk    the mirror asking for the camera, and every way that can fail
 *   AboutPanel   the programme: what this place is (Steppenwolf), why it's here, the book
 *   useFirstVisit  whether it's the visitor's first time (the start card then says how to walk)
 *   NavToggle    a small button, top left, that puts the rail and the bar away (useNavVisible remembers it)
 *
 * ONE THING AT A TIME AT THE FOOT OF THE SCREEN. The bottom of the screen is a
 * single slot: the ActionBar draws one card at a time, and nothing else is
 * drawn there except a dialog, which takes the slot over. Who gets it, highest
 * first (momentFor() applies exactly this; barFor() turns its answer into the
 * card):
 *
 *   1. a dialog: the mirror's question or the programme   the bar steps aside by itself while one is open
 *   2. through the dark (stage enter/push/exit)            nothing
 *   3. in a room (stage inside)                            "inside":  BIG Back to the corridor, Next door, Write to me (a letter room), hint
 *   4. a door opening (stage door)                         "opening": caption only, Door I · opening…
 *   5. a door that wouldn't open (for ~3.5 s)              "shut":    caption only
 *   6. the camera on (at the mirror)                       "camera":  Look away, Leave the theatre
 *   7. at a door (walk, nearest stop is a door)            "door":    Door I · plate, Knock (Go in again)
 *   8. at the mirror (walk, nearest stop is the mirror)    "mirror":  Look into the mirror, Leave the theatre
 *   9. at the entrance (walk, nearest stop is 0)           "start":   one low row: Walk in + a "What is this place?" link (+ how to
 *                                                           walk, the first time); bottom right on a wide screen, so the sign,
 *                                                           the box office and the playbill stay in view and tappable
 *  10. between stops                                       nothing: the rail says where you are
 *
 * The mirror's question only counts at the mirror: momentFor() ignores it
 * anywhere else, and the page should open MirrorAsk only when the nearest stop
 * is the mirror (and close it if you walk away). Long titles (door II's is ~70
 * characters) wrap inside the card, which grows upward; nothing else shares
 * its space.
 *
 * Which else to show:
 *
 *   DoorRail     stage walk and door; hidden for enter/push/exit and inside; fold={at the entrance}
 *                (on a phone it's then just "?" and a map button, clear of the sign). It steps aside by
 *                itself while the mirror asks; under the programme it stays put, covered, so
 *                focus can go back to its "?".
 *   AboutPanel   open from the rail's "?", the start card's "What is this place?", and the
 *                playbill by the box office in the 3D.
 *   First visit  useFirstVisit(): pass .show as momentFor's firstVisit; dismiss it on Walk in,
 *                the first rail tap, or walking past door I. (No separate note: the tips live in
 *                the start card, so the opening view keeps clear.)
 *   NavToggle    once the theatre is ready. With useNavVisible().visible false, hide the rail,
 *                and the bar too except the "camera" card (the way to look away) and the
 *                waiting start card while it gets ready.
 *
 * Wiring:
 *   - Rail stops: the entrance (at 0), doors I–VI, the mirror (at 1). A door's
 *     `at` is walkAt(DOOR_S[i], CAMERA.from, CAMERA.to). `current` is
 *     useNearestStop(progressRef, stops.map(s => s.at)), which re-renders only
 *     when the nearest stop changes; `progress` can be the page's progress ref
 *     itself. onGo(i): walkTo(stops[i].at) (and dismiss the first visit).
 *   - "Walk in" = walkTo(at of door I). "Next door" (inside) = leave, then
 *     walkTo the next door's `at` (or the mirror's from room VI).
 *   - MirrorAsk: open it on "Look into the mirror" or a tap on the glass; its
 *     onStream hands you the MediaStream: keep it, set open=false, and show the
 *     "camera" card straight away (no delay) so there's feedback while the glass
 *     wakes. onClose: set open=false. When a browser needs a reload to notice a
 *     camera it's just been allowed, MirrorAsk reloads the page with a note in
 *     sessionStorage: on arrival, if takeMirrorReturn(), walk to the mirror and
 *     open the question again.
 *   - Dialogs carry data-theatre-dialog and stop the page scrolling (walking)
 *     behind them. The room's own wheel/touch handlers call preventDefault on
 *     everything; if a dialog can ever open inside a room, have them ignore
 *     events whose target is inside [data-theatre-dialog].
 *   - The ActionBar publishes its height as --theatre-bar on <html> (0 when
 *     hidden). The rail keeps clear of it; readingPose could too, to frame the
 *     shrine above it on a phone.
 *   - Z-order: rail, bar and toggle at z-30, MirrorAsk at z-35 (above the
 *     theatre's overlays, ≤ z-20; below the site's header and dock, z-40);
 *     AboutPanel at z-60, over everything. On phones the controls stay below
 *     the header (76 px) and above the dock (96 px from the bottom); the dock
 *     zone switches off at md (768 px).
 *   - Remove the old bottom texts ("Scroll to walk in", the door caption, "Knock
 *     to enter", "Touch the glass", "Leave the theatre", the old mirror question,
 *     "It will wait.", "This door won't open tonight.", "Back to the corridor");
 *     the sr-only list of doors can go too, the rail is a real nav.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, DoorOpen, Eye, EyeOff, Footprints, LogOut, Mail } from "lucide-react";
import { useProgressValue, type ProgressSource } from "@/components/v2/theatre3d/theatre-nav-ui";
import type { ActionBarProps } from "@/components/v2/theatre3d/theatre-nav-bar";

export { DoorRail, type DoorRailProps, type RailStop } from "@/components/v2/theatre3d/theatre-nav-rail";
export { ActionBar, type ActionBarProps, type BarAction, type BarLink } from "@/components/v2/theatre3d/theatre-nav-bar";
export {
    MirrorAsk,
    MirrorAskView,
    MIRROR_CONSTRAINTS,
    cameraProblem,
    cameraUnavailable,
    reloadToMirror,
    takeMirrorReturn,
    type CameraProblem,
    type MirrorAskProps,
    type MirrorAskState,
} from "@/components/v2/theatre3d/theatre-nav-mirror";
export { useFirstVisit } from "@/components/v2/theatre3d/theatre-nav-hint";
export { NavToggle, useNavVisible, type NavToggleProps } from "@/components/v2/theatre3d/theatre-nav-toggle";
export { AboutPanel, type AboutPanelProps } from "@/components/v2/theatre3d/theatre-nav-about";
export { useProgressValue, useTheatreDialogOpen, railFraction, type ProgressSource } from "@/components/v2/theatre3d/theatre-nav-ui";

/** Where a point `s` along the corridor falls on the walk (0..1), given where the camera's walk starts and ends (CAMERA.from, CAMERA.to). */
export const walkAt = (s: number, from: number, to: number) => Math.min(1, Math.max(0, (s - from) / (to - from)));

/** Scroll the page so the walk is at `at` (0..1); smoothly, unless the visitor prefers reduced motion. */
export function walkTo(at: number) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.round(Math.min(1, Math.max(0, at)) * max), behavior: reduced ? "auto" : "smooth" });
}

/**
 * The stop you're at: the nearest of `ats` within `within` of the progress,
 * else null. Holds on a little longer than it takes to arrive (no flicker at
 * the edge). Re-renders only when it changes.
 */
export function useNearestStop(progress: ProgressSource, ats: (number | undefined)[], within = 0.04) {
    const p = useProgressValue(progress);
    const [near, setNear] = useState<number | null>(null);
    const list = useRef(ats);
    list.current = ats;
    useEffect(() => {
        const pick = (v: number) =>
            setNear((prev) => {
                const xs = list.current;
                const held = prev !== null ? xs[prev] : undefined;
                if (held !== undefined && Math.abs(v - held) <= within * 1.5) {
                    // still near the one we're at, unless another is nearer
                    const closer = xs.findIndex((a) => a !== undefined && Math.abs(v - a) < Math.abs(v - held));
                    if (closer < 0) return prev;
                }
                let best: number | null = null;
                let d = within;
                xs.forEach((a, i) => {
                    if (a === undefined) return;
                    const x = Math.abs(v - a);
                    if (x <= d) {
                        d = x;
                        best = i;
                    }
                });
                return best;
            });
        pick(p.get());
        return p.on("change", pick);
    }, [p, within]);
    return near;
}

/** A door, as the bar talks about it. */
export interface DoorInfo {
    numeral: string;
    title: string;
    opened?: boolean;
}

/** The moment you're in, as far as the bar's concerned: exactly one at a time (see momentFor). */
export type TheatreMoment =
    | { kind: "dialog" }
    | { kind: "dark" }
    | { kind: "inside"; door: DoorInfo; next?: "door" | "mirror"; write?: string }
    | { kind: "opening"; door: DoorInfo }
    | { kind: "shut"; door: DoorInfo }
    | { kind: "camera" }
    | { kind: "door"; door: DoorInfo }
    | { kind: "mirror"; allOpened?: boolean }
    | { kind: "start"; firstVisit?: boolean }
    | { kind: "between" };

/** What the page knows, raw. */
export interface TheatreState {
    /** The visit's stage: "walk", "door" (swinging open), "enter"/"push"/"exit" (through the dark), "inside". */
    stage: string;
    /** The nearest rail stop: "entrance", "mirror", a door's index (0-based), or null between stops. */
    at: "entrance" | "mirror" | number | null;
    /** The doors, in order. */
    doors: DoorInfo[];
    /** The door being opened, or whose room you're in (index). */
    door?: number | null;
    /** A dialog is open (the mirror's question, the programme). */
    dialog?: boolean;
    /** The mirror's question is open (only counts at the mirror). */
    asking?: boolean;
    /** The camera is on. */
    camera?: boolean;
    /** A door that just wouldn't open (index), while its notice shows. */
    shut?: number | null;
    /** In a letter room: where to write (a mailto: link). */
    write?: string | null;
    /** The visitor's first time here (useFirstVisit): the start card adds a line on how to walk. */
    firstVisit?: boolean;
}

/** The one moment that has the foot of the screen, by the priority in the header comment. */
export function momentFor(s: TheatreState): TheatreMoment {
    const door = (i: number | null | undefined) => (i !== null && i !== undefined ? s.doors[i] : undefined);
    if (s.dialog || (s.asking && s.at === "mirror")) return { kind: "dialog" };
    if (s.stage === "enter" || s.stage === "push" || s.stage === "exit" || s.stage === "dark") return { kind: "dark" };
    const d = door(s.door);
    if (s.stage === "inside" && d) {
        const i = s.door as number;
        return { kind: "inside", door: d, next: i < s.doors.length - 1 ? "door" : "mirror", write: s.write ?? undefined };
    }
    if (s.stage === "door" && d) return { kind: "opening", door: d };
    if (s.stage !== "walk") return { kind: "dark" };
    const shut = door(s.shut);
    if (shut) return { kind: "shut", door: shut };
    if (s.camera && s.at === "mirror") return { kind: "camera" };
    if (typeof s.at === "number" && s.doors[s.at]) return { kind: "door", door: s.doors[s.at] };
    if (s.at === "mirror") return { kind: "mirror", allOpened: s.doors.length > 0 && s.doors.every((x) => x.opened) };
    if (s.at === "entrance") return { kind: "start", firstVisit: s.firstVisit };
    return { kind: "between" };
}

export interface TheatreActs {
    walkIn(): void;
    /** Open the programme (AboutPanel). */
    about(): void;
    knock(): void;
    back(): void;
    next(): void;
    lookIn(): void;
    lookAway(): void;
    leave(): void;
}

const noop = () => {};

/** The ActionBar's props for a moment: the words, the buttons and what they do. Use it, or copy from it. */
export function barFor(m: TheatreMoment, act: Partial<TheatreActs>, touch = false): ActionBarProps {
    const leave = { label: "Leave the theatre", icon: <LogOut strokeWidth={1.6} />, onClick: act.leave ?? noop };
    switch (m.kind) {
        case "start":
            // one low row, off to the right on a wide screen: the opening view is the sign,
            // the box office and its playbill, and they have to be seen (and the playbill tapped)
            return {
                contextKey: "start",
                compact: true,
                align: "end",
                primary: { label: "Walk in", icon: <Footprints strokeWidth={1.6} />, onClick: act.walkIn ?? noop },
                secondary: act.about ? { label: "What is this place?", onClick: act.about } : undefined,
                // (on a wide screen only: on a phone the card stays one low row)
                hint: m.firstVisit ? `${touch ? "Swipe up" : "Scroll"} to walk, or use the map on the right.` : undefined,
            };
        case "door":
            return {
                contextKey: `door-${m.door.numeral}`,
                caption: { eyebrow: `Door ${m.door.numeral}${m.door.opened ? " · you've been in" : ""}`, title: m.door.title },
                primary: {
                    label: m.door.opened ? "Go in again" : "Knock",
                    icon: <DoorOpen strokeWidth={1.6} />,
                    ariaLabel: `${m.door.opened ? "Go in again" : "Knock"}: door ${m.door.numeral}, ${m.door.title}`,
                    onClick: act.knock ?? noop,
                },
                hint: touch ? "or tap the door itself" : "or click the door itself",
            };
        case "opening":
            return { contextKey: `opening-${m.door.numeral}`, caption: { eyebrow: `Door ${m.door.numeral} · opening…`, title: m.door.title } };
        case "shut":
            return { contextKey: `shut-${m.door.numeral}`, caption: { eyebrow: `Door ${m.door.numeral}`, title: "This door won't open tonight." } };
        case "inside":
            return {
                contextKey: `inside-${m.door.numeral}`,
                caption: { eyebrow: `Room ${m.door.numeral}`, title: m.door.title },
                primary: { label: "Back to the corridor", icon: <ArrowLeft strokeWidth={1.6} />, onClick: act.back ?? noop, autoFocus: true },
                secondary: m.next
                    ? { label: m.next === "mirror" ? "On to the mirror" : "Next door", trailing: <ArrowRight strokeWidth={1.6} />, onClick: act.next ?? noop }
                    : undefined,
                link: m.write ? { label: "Write to me", href: m.write, icon: <Mail strokeWidth={1.6} /> } : undefined,
                hint: touch ? "or swipe up to leave" : "or press Esc",
            };
        case "mirror":
            return {
                contextKey: m.allOpened ? "mirror-all" : "mirror",
                caption: { eyebrow: "The mirror", title: m.allOpened ? "You have been in every room. Come back some other night." : "Touch the glass, if you like." },
                primary: { label: "Look into the mirror", icon: <Eye strokeWidth={1.6} />, onClick: act.lookIn ?? noop },
                secondary: leave,
            };
        case "camera":
            return {
                contextKey: "camera",
                caption: { eyebrow: "The mirror", title: "It sees you. Nothing leaves this screen." },
                primary: { label: "Look away", icon: <EyeOff strokeWidth={1.6} />, onClick: act.lookAway ?? noop },
                secondary: leave,
            };
        default:
            return { hidden: true };
    }
}
