'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NEAR_DOORS, TheatreScene, newVisit, type Quality, type SceneDoor, type SceneRoom, type Visit, type VisitEvent, type VisitStage } from "@/components/v2/theatre3d/scene";
import { disposeChamberCache, prepareChamber } from "@/components/v2/theatre3d/chamber";
import { prepareEntrance } from "@/components/v2/theatre3d/prepare";
import { theatreMounted, theatreReady } from "@/components/v2/theatre3d/readiness";
import { hurry } from "@/components/v2/theatre3d/textures";
import { CAMERA, DOOR_S } from "@/components/v2/theatre3d/layout";
import { detectQuality } from "@/components/v2/theatre3d/look";
import { fetchRoom, useOpened, usePlates } from "@/components/v2/theatre-data";
import { Neon } from "@/components/v2/theatre-sign";
import { fell, fellSC } from "@/components/v2/theatre-fonts";
import { theatre, type DoorPlate, type Room } from "@/data/v2/theatre";
import { AboutPanel, ActionBar, DoorRail, MirrorAsk, NavToggle, barFor, momentFor, takeMirrorReturn, useFirstVisit, useNavVisible, walkAt, type RailStop } from "@/components/v2/theatre3d/theatre-nav";

// The Magic Theatre in 3D: a fixed canvas, and a tall page you scroll to walk
// the corridor. Behind each door is a room (chamber.tsx): knock, and the door
// opens on it, and you walk in, all in one move (scene.tsx). Everything that
// isn't the place itself lives here in HTML, drawn by theatre-nav.tsx: the map
// of the corridor (the rail), the one thing to do next (the action bar: walk
// in, knock, back out of a room, next door, look into the mirror, leave), the
// mirror's question, and the programme (also on the playbill by the box office).
// Rooms can also be left with Esc, the back button, or a swipe or scroll on
// past the end of what's written.

const WALK_VH = 720; // how much scrolling the whole corridor takes
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** You're at a door when the camera is this near it along the walk (s). */
const NEAR_DOOR = 0.035;
/** How much wheel (px) past the end of an inscription, in one deliberate go, takes you out of the room. */
const WHEEL_OUT = 520;
/** A wheel gesture ends after this long without an event (ms). */
const WHEEL_GAP = 280;
/** How long a knocked door may take to open (its room fetched and built) before it won't, tonight (ms). */
const KNOCK_WAIT = 15000;
/** Along the walk (0..1): you're at the entrance up to here, and at the mirror from here. */
const ENTRANCE_UNTIL = 0.04;
const MIRROR_FROM = 0.975;
/** A tap on the glass from further back than this walks you up to it first. */
const MIRROR_SEEN_FROM = 0.9;
/** How long "this door won't open" stays up (ms). */
const SHUT_FOR = 3500;
/** Where you are, for the navigation: a landmark, a door (index), or between. */
type Spot = "entrance" | "mirror" | number | null;
/** Walked past the first door: the first-visit tips have done their job. */
const PAST_FIRST_DOOR = walkAt(DOOR_S[0], CAMERA.from, CAMERA.to) + 0.03;

/** What the navigation UI needs: where you are, and the ways to go. */
export interface TheatreNav {
    stage: VisitStage;
    doors: DoorPlate[];
    /** The door the camera is standing at, along the walk (null between doors). */
    nearDoor: number | null;
    /** Knock on door i (only while walking). */
    knock: (i: number) => void;
    /** Out of the room you're in (or away from a door that's opening). */
    leave: () => void;
    /** Walk (scroll) to door i. */
    goToDoor: (i: number) => void;
    /** Walk (scroll) to the mirror at the end. */
    goToMirror: () => void;
}

// The camera stays on only while you're standing at the mirror: it stops when you
// look away, walk off, switch tabs, leave the theatre, or after a minute and a half.
function useMirrorStream(stream: MediaStream | null, stop: () => void, progress: React.MutableRefObject<number>) {
    useEffect(() => {
        if (!stream) return;
        const end = () => stop();
        const onHide = () => document.hidden && stop();
        const timer = window.setTimeout(end, 90_000);
        const walk = window.setInterval(() => progress.current < 0.85 && stop(), 500);
        document.addEventListener("visibilitychange", onHide);
        stream.getVideoTracks().forEach((t) => t.addEventListener("ended", end));
        return () => {
            window.clearTimeout(timer);
            window.clearInterval(walk);
            document.removeEventListener("visibilitychange", onHide);
            stream.getTracks().forEach((t) => t.stop());
        };
    }, [stream, stop, progress]);
}

/** Scroll position (px) that puts the camera at `s` along the walk. */
function scrollFor(s: number) {
    const p = Math.min(1, Math.max(0, (s - CAMERA.from) / (CAMERA.to - CAMERA.from)));
    return p * Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export function Theatre3D({
    active = true,
    entered = false,
    paused = false,
    onReady,
}: {
    /** It's the page you're on (false while it waits, out of sight, on the page with the keyhole). */
    active?: boolean;
    /** You came in through the keyhole: no cover, no intro, the lights are already on. */
    entered?: boolean;
    /** Built, but not running yet. */
    paused?: boolean;
    onReady?: () => void;
} = {}) {
    const router = useRouter();
    const { plates, words } = usePlates();
    const [opened, mark] = useOpened();
    const [hover, setHover] = useState<number | null>(null);
    const [focus, setFocus] = useState<number | null>(null); // the door you're going through: the camera steps up to it
    const [opening, setOpening] = useState(false); // and it stands open (once its room is drawn behind it)
    const [room, setRoom] = useState<SceneRoom | null>(null);
    const [stage, setStage] = useState<VisitStage>("walk");
    const [nearDoor, setNearDoor] = useState<number | null>(null);
    const [spot, setSpot] = useState<Spot>("entrance");
    const spotRef = useRef<Spot>("entrance");
    const [shut, setShut] = useState<number | null>(null); // a door that wouldn't open
    const [about, setAbout] = useState(false); // the programme is open
    const [overBill, setOverBill] = useState(false); // the pointer is on the playbill
    const first = useFirstVisit();
    const navShown = useNavVisible(); // the rail and the bar can be put away (NavToggle)
    const firstRef = useRef(first);
    firstRef.current = first;
    const visit = useRef<Visit>(newVisit());
    const pushed = useRef(false); // there's a history entry for the room you're in
    const roomRef = useRef(room);
    roomRef.current = room;
    const [ready, setReady] = useState(false);
    const [env, setEnv] = useState<{ quality: Quality; reduced: boolean; touch: boolean } | null>(null);
    const progress = useRef(0);
    const page = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEnv({
            quality: detectQuality(),
            reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            touch: window.matchMedia("(pointer: coarse)").matches,
        });
    }, []);

    // From now on the start card is drawn here, waiting until it's ready (until now the page
    // drew it: readiness.ts). Painting what's seen from the entrance starts at once, without
    // waiting for the doors' plaques to arrive.
    useLayoutEffect(() => {
        theatreMounted(true);
        return () => theatreMounted(false);
    }, []);
    useEffect(() => void prepareEntrance(NEAR_DOORS), []);
    // and while you're at the door, waiting, it's painted without waiting for the page to be idle
    useEffect(() => {
        hurry(active && !ready);
        return () => hurry(false);
    }, [active, ready]);

    // Scrolling is walking. The overlays read --p, so scrolling never re-renders React
    // (except to say which door you're at, when that changes).
    // (Not while it's waiting on another page: that page's scrolling isn't ours.)
    useEffect(() => {
        if (!active) {
            progress.current = 0;
            page.current?.style.setProperty("--p", "0");
            spotRef.current = "entrance";
            setSpot("entrance");
            return;
        }
        const onScroll = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
            progress.current = p;
            page.current?.style.setProperty("--p", p.toFixed(4));
            const s = CAMERA.from + (CAMERA.to - CAMERA.from) * p;
            let near: number | null = null;
            let best = NEAR_DOOR;
            DOOR_S.forEach((ds, i) => {
                const d = Math.abs(s - ds);
                if (d <= best) {
                    best = d;
                    near = i;
                }
            });
            setNearDoor(near);
            const at: Spot = p >= MIRROR_FROM ? "mirror" : near !== null ? near : p <= ENTRANCE_UNTIL ? "entrance" : null;
            spotRef.current = at;
            setSpot(at);
            if (p > PAST_FIRST_DOOR && firstRef.current.show) firstRef.current.dismiss();
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [active]);

    useEffect(() => {
        document.body.style.cursor = (hover !== null && focus === null) || (overBill && stage === "walk") ? "pointer" : "";
        return () => {
            document.body.style.cursor = "";
        };
    }, [hover, focus, overBill, stage]);

    const doors: DoorPlate[] = useMemo(() => plates ?? [], [plates]);
    const sceneDoors: SceneDoor[] = doors.map((d, i) => ({
        id: d.id,
        plate: d.plate,
        state: focus === i ? (opening ? "open" : "hover") : hover === i ? "hover" : opened.includes(d.id) ? "visited" : "idle",
    }));

    useEffect(() => () => disposeChamberCache(), []);

    // Fetch what's behind a door as you come up to it, so it's there when you knock.
    const prefetch = hover ?? nearDoor;
    useEffect(() => {
        const id = prefetch !== null ? doors[prefetch]?.id : undefined;
        if (id) fetchRoom(id);
    }, [prefetch, doors]);

    // Knocking: the camera steps up while the room is fetched and built; once it's
    // drawn behind the door (the scene says "ready"), the door opens on it, and the
    // scene takes you in.
    const knock = useCallback(
        (i: number) => {
            const door = doors[i];
            const V = visit.current;
            if (!door || !env || V.stage !== "walk" || i >= DOOR_S.length) return;
            setFocus(i);
            setOpening(false);
            mark(door.id);
            Object.assign(V, newVisit(), { stage: "door", door: i, since: performance.now() });
            setStage("door");
            const built = fetchRoom(door.id).then(async (d) => {
                if (!d) return null;
                // open at the front: the door's own arch is its frame
                await prepareChamber(d.room, d.plate, env.quality, false);
                return d;
            });
            // never left standing at a door that won't open (it's still built, for next time)
            const late = new Promise<null>((r) => window.setTimeout(() => r(null), KNOCK_WAIT));
            Promise.race([built, late])
                .catch(() => null)
                .then((d) => {
                    if (V.stage !== "door" || V.door !== i) return;
                    if (!d) {
                        setShut(i);
                        setFocus(null);
                        Object.assign(V, { stage: "walk", since: performance.now() });
                        setStage("walk");
                        return;
                    }
                    setRoom({ door: i, id: door.id, plate: d.plate, room: d.room });
                });
        },
        [doors, env, mark],
    );

    // The scene moving the visit along.
    const onVisit = useCallback((e: VisitEvent, i: number) => {
        const V = visit.current;
        if (e === "ready") {
            if (V.stage === "door" && V.door === i) setOpening(true);
        } else if (e === "enter") {
            setStage("enter");
            // Going in is a step in the browser's history: Back brings you out again.
            // Next keeps its own state in history.state; without its __NA mark, its
            // patched pushState copies that state over and takes the new URL into its
            // router (with the mark it would skip that, and later put its own URL back).
            try {
                const state = { ...window.history.state, theatreDoor: roomRef.current?.id ?? i };
                delete state.__NA;
                window.history.pushState(state, "", `#door-${roomRef.current?.id ?? i}`);
                pushed.current = true;
            } catch {
                pushed.current = false;
            }
        } else if (e === "inside") {
            setStage("inside");
        } else if (e === "walk") {
            // back in the corridor: the door swings to behind you
            setStage("walk");
            setFocus(null);
            setOpening(false);
        } else if (e === "shut") {
            setRoom((r) => (r && r.door === i && !(V.door === i && V.stage !== "walk") ? null : r));
        }
    }, []);

    // Out of the room, back the way you came (`consume`: take the room's history entry back off too).
    const exit = useCallback((consume: boolean) => {
        const V = visit.current;
        if (V.stage === "enter" || V.stage === "inside") {
            Object.assign(V, { stage: "exit", since: performance.now(), pull: 0, pullUntil: 0 });
            setStage("exit");
        } else if (V.stage === "door") {
            // never went in: the door swings to again
            Object.assign(V, { stage: "walk", since: performance.now() });
            setStage("walk");
            setFocus(null);
            setOpening(false);
        } else return;
        if (consume && pushed.current) {
            pushed.current = false;
            window.history.back();
        }
    }, []);
    const leave = useCallback(() => exit(true), [exit]);

    // The browser's back button, from a room.
    useEffect(() => {
        const onPop = () => {
            if (!pushed.current) return;
            pushed.current = false;
            exit(false);
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [exit]);

    // Away from the corridor the page doesn't scroll (that would walk you off down it).
    // In a room, scrolling reads down an inscription too tall for the screen, and
    // carrying on past its end (a deliberate swipe up, or a strong scroll down,
    // begun once there's nothing more to read) takes you back out. Esc leaves too.
    useEffect(() => {
        if (stage === "walk") return;
        const V = visit.current;
        const atEnd = () => V.extra <= 0.01 || V.scroll >= 0.995;
        // a dialog over the room (the programme, say) scrolls and takes keys for itself
        const inDialog = (t: EventTarget | null) => t instanceof Element && !!t.closest("[data-theatre-dialog]");
        const nudge = (d: number) => {
            if (V.extra > 0.01) V.scroll = Math.min(1, Math.max(0, V.scroll + d));
        };
        // a gesture already going when this began (it brought you here) doesn't count
        let wheelLast = performance.now();
        let wheelFromEnd = false;
        let over = 0;
        const onWheel = (e: WheelEvent) => {
            if (inDialog(e.target)) return;
            e.preventDefault();
            if (V.stage !== "inside") return;
            const now = performance.now();
            const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
            if (now - wheelLast > WHEEL_GAP) {
                wheelFromEnd = atEnd();
                over = 0;
            }
            wheelLast = now;
            nudge(dy / 900);
            if (!wheelFromEnd) return;
            over = dy > 0 ? over + dy : 0;
            V.pull = Math.min(1, over / WHEEL_OUT);
            V.pullUntil = now + WHEEL_GAP;
            if (over >= WHEEL_OUT) leave();
        };
        let x0 = 0;
        let y0 = 0;
        let x = 0;
        let y = 0;
        let tracking = false;
        let fromEnd = false;
        const swipe = () => Math.max(100, window.innerHeight * 0.18); // how far a deliberate swipe goes
        const onStart = (e: TouchEvent) => {
            const t = e.touches[0];
            tracking = e.touches.length === 1 && !!t && !inDialog(e.target);
            if (!tracking) return;
            x0 = x = t.clientX;
            y0 = y = t.clientY;
            fromEnd = V.stage === "inside" && atEnd();
        };
        const onMove = (e: TouchEvent) => {
            if (inDialog(e.target)) return;
            e.preventDefault();
            const t = e.touches[0];
            if (!tracking || !t || V.stage !== "inside") return;
            nudge((y - t.clientY) / 500);
            x = t.clientX;
            y = t.clientY;
            if (fromEnd) {
                V.pull = Math.min(1, Math.max(0, (y0 - y) / swipe()));
                V.pullUntil = Number.POSITIVE_INFINITY;
            }
        };
        const onEnd = () => {
            if (!tracking) return;
            tracking = false;
            V.pullUntil = 0;
            const up = y0 - y;
            if (V.stage === "inside" && fromEnd && up > swipe() && up > Math.abs(x - x0)) leave();
        };
        const onKey = (e: KeyboardEvent) => {
            if (inDialog(e.target)) return;
            if (e.key === "Escape") {
                leave();
                return;
            }
            const scrolls = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"];
            if (!scrolls.includes(e.key)) return;
            // a space on a button presses it
            if (e.key === " " && (e.target as HTMLElement | null)?.closest?.("button, a, input, textarea")) return;
            e.preventDefault();
            if (V.stage !== "inside") return;
            if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") nudge(0.15);
            else if (e.key === "ArrowUp" || e.key === "PageUp") nudge(-0.15);
        };
        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("touchstart", onStart, { passive: true });
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd, { passive: true });
        window.addEventListener("touchcancel", onEnd, { passive: true });
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("touchstart", onStart);
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onEnd);
            window.removeEventListener("touchcancel", onEnd);
            window.removeEventListener("keydown", onKey);
            V.pullUntil = 0;
        };
    }, [stage, leave]);

    // Walking the corridor by its landmarks.
    const goToDoor = useCallback(
        (i: number) => {
            if (visit.current.stage !== "walk" || i < 0 || i >= DOOR_S.length) return;
            window.scrollTo({ top: scrollFor(DOOR_S[i]), behavior: env?.reduced ? "auto" : "smooth" });
        },
        [env],
    );
    const goToMirror = useCallback(() => {
        if (visit.current.stage !== "walk") return;
        window.scrollTo({ top: scrollFor(CAMERA.to), behavior: env?.reduced ? "auto" : "smooth" });
    }, [env]);

    /** For the navigation UI. */
    const nav: TheatreNav = useMemo(
        () => ({ stage, doors, nearDoor: nearDoor !== null && nearDoor < doors.length ? nearDoor : null, knock, leave, goToDoor, goToMirror }),
        [stage, doors, nearDoor, knock, leave, goToDoor, goToMirror],
    );

    // The mirror asks to see you, only once you're standing at it (its glass can be
    // tapped through the walls from anywhere down the corridor: from the last
    // stretch that walks you up to it; from further back it's ignored). Only on an
    // explicit yes does the camera start (MirrorAsk); the picture goes straight into
    // the glass and nowhere else, and stops when you look away or walk off.
    const [asking, setAsking] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const lookInMirror = useCallback(() => {
        if (visit.current.stage !== "walk" || stream) return;
        if (spotRef.current === "mirror") setAsking(true);
        else if (progress.current >= MIRROR_SEEN_FROM) goToMirror();
    }, [stream, goToMirror]);
    const lookAway = useCallback(() => setStream(null), []);
    useMirrorStream(stream, lookAway, progress);
    // the question goes if you walk away from the glass
    useEffect(() => {
        if (asking && (spot !== "mirror" || stage !== "walk")) setAsking(false);
    }, [asking, spot, stage]);
    // Back from a reload the mirror asked for (a browser that only notices a camera it's
    // just been allowed after one): straight back to the glass, and it asks again.
    const backToGlass = useRef(false);
    useEffect(() => {
        if (!active || !ready || !takeMirrorReturn()) return;
        backToGlass.current = true;
        window.scrollTo({ top: scrollFor(CAMERA.to), behavior: "auto" });
    }, [active, ready]);
    useEffect(() => {
        if (!backToGlass.current || spot !== "mirror" || stage !== "walk") return;
        backToGlass.current = false;
        setAsking(true);
    }, [spot, stage]);
    // and everything is put away when the theatre is left (it waits on, out of sight)
    useEffect(() => {
        if (active) return;
        setAsking(false);
        setStream(null);
        setAbout(false);
    }, [active]);

    // A door that wouldn't open says so for a moment.
    useEffect(() => {
        if (shut === null) return;
        const t = window.setTimeout(() => setShut(null), SHUT_FOR);
        return () => window.clearTimeout(t);
    }, [shut]);

    // Next door, from a room: out of this one, then on along the corridor to the next
    // (from the last room, on to the mirror), once you're back in the corridor.
    const after = useRef<number | "mirror" | null>(null);
    const nextDoor = useCallback(() => {
        const i = visit.current.door;
        after.current = i + 1 < Math.min(doors.length, DOOR_S.length) ? i + 1 : "mirror";
        leave();
    }, [doors.length, leave]);
    useEffect(() => {
        if (stage !== "walk" || after.current === null) return;
        const to = after.current;
        after.current = null;
        // (after the room's history entry has come off, so its scroll restore can't undo this)
        window.setTimeout(() => (to === "mirror" ? goToMirror() : goToDoor(to)), 150);
    }, [stage, goToDoor, goToMirror]);

    const leaveTheatre = useCallback(() => (window.history.length > 1 ? router.back() : router.push("/now")), [router]);

    // The map: the entrance, the doors, the mirror.
    const shown = Math.min(doors.length, DOOR_S.length);
    const stops: RailStop[] = useMemo(
        () => [
            { key: "entrance", label: "Entrance", title: theatre.entrance, kind: "entrance", at: 0 },
            ...doors.slice(0, DOOR_S.length).map((d, i) => ({
                key: d.id,
                label: ROMAN[i],
                title: d.plate,
                opened: opened.includes(d.id),
                kind: "door" as const,
                at: walkAt(DOOR_S[i], CAMERA.from, CAMERA.to),
            })),
            { key: "mirror", label: "Mirror", title: "The mirror at the end", kind: "mirror", at: 1 },
        ],
        [doors, opened],
    );
    const railAt = spot === "entrance" ? 0 : spot === "mirror" ? shown + 1 : spot !== null && spot < shown ? spot + 1 : null;
    const go = useCallback(
        (i: number) => {
            if (visit.current.stage !== "walk") return;
            if (firstRef.current.show) firstRef.current.dismiss();
            if (i === 0) window.scrollTo({ top: 0, behavior: env?.reduced ? "auto" : "smooth" });
            else if (i > shown) nav.goToMirror();
            else nav.goToDoor(i - 1);
        },
        [env, shown, nav],
    );

    // The one thing to do next (theatre-nav.tsx: momentFor has the order of who gets the slot).
    const moment = momentFor({
        stage,
        at: spot,
        doors: doors.slice(0, DOOR_S.length).map((d, i) => ({ numeral: ROMAN[i], title: d.plate, opened: opened.includes(d.id) })),
        door: focus ?? room?.door ?? null,
        dialog: about,
        asking,
        camera: !!stream,
        shut,
        write: room && room.room.kind === "letter" ? `mailto:${room.room.email}?subject=${encodeURIComponent(room.room.subject)}` : null,
        firstVisit: first.show,
    });
    const bar = barFor(
        moment,
        {
            walkIn: () => {
                if (firstRef.current.show) firstRef.current.dismiss();
                nav.goToDoor(0);
            },
            about: () => setAbout(true),
            knock: () => typeof spot === "number" && nav.knock(spot),
            back: nav.leave,
            next: nextDoor,
            lookIn: () => setAsking(true),
            lookAway,
            leave: leaveTheatre,
        },
        !!env?.touch,
    );

    return (
        <div ref={page} className={fell.className} style={{ height: `${100 + WALK_VH}vh`, ["--p" as string]: 0 }}>
            <div className="fixed inset-0 z-0 bg-[#070404]">
                {env && plates && (
                    <TheatreScene
                        doors={sceneDoors}
                        progress={progress}
                        focus={focus}
                        quality={env.quality}
                        reducedMotion={env.reduced}
                        onOver={setHover}
                        onOut={(i) => setHover((h) => (h === i ? null : h))}
                        onKnock={knock}
                        onMirror={lookInMirror}
                        onPlaybill={() => visit.current.stage === "walk" && setAbout(true)}
                        onPlaybillHover={setOverBill}
                        stream={stream}
                        words={words}
                        onReady={() => {
                            setReady(true);
                            theatreReady();
                            onReady?.();
                        }}
                        introduce={!entered}
                        later={!entered}
                        paused={paused}
                        visit={visit}
                        room={room}
                        onVisit={onVisit}
                    />
                )}
            </div>

            {/* Dark until the first frame is drawn, and the sign keeps you company (carrying on from the page's: magic-theatre-page.tsx). */}
            <div
                aria-hidden
                className={`pointer-events-none fixed inset-0 z-[5] grid place-items-center bg-[#050303] ${entered ? "" : "transition-opacity duration-1000"}`}
                style={{ opacity: ready ? 0 : 1 }}
            >
                {!ready && !entered && <Neon text={theatre.sign.toUpperCase()} dead={10} className={`${fellSC.className} text-[20px] tracking-[0.4em] opacity-70`} />}
            </div>

            {/* The room in words, for screen readers (it's carved in the 3D). */}
            {room && stage === "inside" && (
                <section aria-label={room.plate}>
                    <RoomText plate={room.plate} room={room.room} />
                </section>
            )}

            {/* The way through (theatre-nav.tsx), only on the theatre's own page. */}
            {active && (
                <>
                    <DoorRail
                        stops={stops}
                        current={railAt}
                        progress={progress}
                        onGo={go}
                        hidden={!ready || !navShown.visible || (stage !== "walk" && stage !== "door")}
                        onAbout={() => setAbout(true)}
                        fold={spot === "entrance"}
                    />
                    {/* at the entrance it's there from the start, waiting (Walk in not yet lit) until it's ready;
                        put away with the rail, all but the camera's card (the way to look away) */}
                    <ActionBar
                        {...bar}
                        waiting={!ready}
                        hidden={(!ready && moment.kind !== "start") || (ready && !navShown.visible && moment.kind !== "camera") || bar.hidden}
                    />
                    <NavToggle visible={navShown.visible} onToggle={navShown.toggle} hidden={!ready} />
                    <MirrorAsk
                        open={asking && spot === "mirror" && stage === "walk"}
                        touch={!!env?.touch}
                        onStream={(s) => {
                            setStream(s);
                            setAsking(false);
                        }}
                        onClose={() => setAsking(false)}
                    />
                    <AboutPanel open={about} onClose={() => setAbout(false)} />
                </>
            )}
        </div>
    );
}

// What's carved and written in a room, as plain text for screen readers.
function RoomText({ plate, room }: { plate: string; room: Room }) {
    const images = [...(room.kind === "photo" ? [{ src: room.src, caption: room.caption }] : []), ...(room.images ?? [])];
    return (
        <div className="sr-only">
            <h2>{plate}</h2>
            {"body" in room && room.body?.map((p) => <p key={p}>{p}</p>)}
            {room.kind === "quote" && (
                <blockquote>
                    {room.quote} ({room.by})
                </blockquote>
            )}
            {images.map((im) => im.caption && <p key={im.src}>A photograph: {im.caption}</p>)}
        </div>
    );
}
