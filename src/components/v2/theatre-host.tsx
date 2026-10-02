'use client';

import { Component, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { THEATRE_FADE, THEATRE_WAKE } from "@/components/v2/theatre3d/keyhole-timeline";

// The 3D Magic Theatre lives here, in the site's shell, rather than in its
// page, so it can be ready before you arrive and survive the change of page.
//
// When the keyhole is lit on the Now or Journey page, the theatre is quietly
// built out of sight (warm): it draws its first frame, then runs on unseen
// until everything that eases in has settled (the marquee's bulbs and neon,
// the box office lamp, a visited door's glow, the late parts compiled), and
// only then waits, paused. Going through the keyhole wakes it; over the end of
// the dive it fades in over the keyhole's view, from the very same viewpoint,
// lamps lit and glowing, dust in the air, and only then does the address
// change to /magic-theatre underneath it, so there's no cut and no wait.
// Arriving any other way, it starts here as a page, lights coming on.
//
// Building it holds up the page now and then (a second or two, all told), so
// `warmth` says when that's going on: the keyhole's sign waits for it before it
// shows itself, so nothing is animating meanwhile.
//
// The theatre's page itself only draws the hand-drawn 2D theatre, for when
// 3D isn't possible (no WebGL, `?mode=2d`, or the 3D failing).

const Theatre3D = dynamic(() => import("@/components/v2/theatre3d/theatre").then((m) => m.Theatre3D), {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-[#050303]" />,
});

export const THEATRE_PATH = "/magic-theatre";

/**
 * How the theatre out of sight is coming along. "busy": being built and settling
 * (it holds up the page now and then); "ready": waiting, paused, lights on;
 * "idle": not being built (not asked yet, or it can't be).
 */
export type Warmth = "idle" | "busy" | "ready";

interface Host {
    /** Build the theatre out of sight, let it settle, and leave it paused (the keyhole is lit). */
    warm: () => void;
    /**
     * Wake it, fade it in over everything (THEATRE_WAKE + THEATRE_FADE), then call `done`
     * (which goes to its page). If there's no theatre waiting, `done` after `rest` ms.
     */
    reveal: (done: () => void, rest?: number) => void;
    /** Something on the page has to run smoothly now: if it hasn't got as far as its first frame, stop building it (warm it again later). */
    hold: () => void;
    /** Its page should draw the 2D theatre. */
    flat: boolean;
    warmth: Warmth;
}

interface Stage {
    mounted: boolean;
    active: boolean;
    entered: boolean;
    paused: boolean;
    shown: boolean;
    onReady: () => void;
    onFail: () => void;
}

const HostContext = createContext<Host>({ warm: () => {}, reveal: (done) => done(), hold: () => {}, flat: false, warmth: "idle" });
const StageContext = createContext<Stage | null>(null);

export const useTheatreHost = () => useContext(HostContext);

function canWebGL() {
    try {
        const c = document.createElement("canvas");
        return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
        return false;
    }
}

/**
 * Calls `f` once the page has been drawing steadily (no frame held up more than
 * 100 ms) for `quiet` ms, and at least `min` ms from now; `max` at the latest.
 * Returns a cancel.
 */
function whenSettled(f: () => void, min = 1200, quiet = 500, max = 7000) {
    const t0 = performance.now();
    let last = t0;
    let calm = t0;
    let raf = 0;
    const tick = (now: number) => {
        if (now - last > 100) calm = now;
        last = now;
        if ((now - t0 >= min && now - calm >= quiet) || now - t0 >= max) return f();
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
}

export function TheatreHost({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const here = pathname === THEATRE_PATH;
    const [can3d, setCan3d] = useState<boolean | null>(null);
    const [failed, setFailed] = useState(false);
    const [warmOn, setWarmOn] = useState<string | null>(null); // the page it's waiting on
    const [entered, setEntered] = useState(false);
    const [paused, setPaused] = useState(true);
    const [shown, setShown] = useState(false);
    const [warmth, setWarmth] = useState<Warmth>("idle");
    // out of sight: built → first frame drawn, running on unseen → settled, paused
    const phase = useRef<"cold" | "building" | "settling" | "ready">("cold");
    const settling = useRef<() => void>(() => {});
    const pending = useRef<(() => void) | null>(null);
    const mounted = can3d === true && !failed && (here || warmOn !== null);
    const mountedRef = useRef(mounted);
    mountedRef.current = mounted;

    const decide = useCallback(() => {
        if (can3d !== null) return can3d;
        const ok = canWebGL();
        setCan3d(ok);
        return ok;
    }, [can3d]);

    // On the theatre's own page: 3D unless asked for 2D (or it can't).
    useEffect(() => {
        if (!here) return;
        if (new URLSearchParams(window.location.search).get("mode") === "2d") setCan3d(false);
        else decide();
    }, [here, decide]);

    // Arrived: from now on it's just the page. Gone somewhere else: let it go.
    useEffect(() => {
        if (here) {
            setWarmOn(null);
            setPaused(false);
            return;
        }
        if (warmOn !== null && pathname === warmOn) return;
        setWarmOn(null);
        setEntered(false);
        setShown(false);
        setPaused(true);
        setWarmth("idle");
        settling.current();
        phase.current = "cold";
        pending.current = null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);
    useEffect(() => () => settling.current(), []);

    // Arriving through the keyhole, the page underneath was scrolled to the keyhole;
    // the walk starts at the top.
    const wasHere = useRef(here);
    useLayoutEffect(() => {
        if (here && !wasHere.current && entered) window.scrollTo(0, 0);
        wasHere.current = here;
    }, [here, entered]);

    const finish = useCallback(() => {
        const done = pending.current;
        pending.current = null;
        done?.();
    }, []);

    const show = useCallback(() => {
        if (!pending.current) return;
        // running again (and long since settled): a few frames unseen, so it fades in
        // moving, then the fade over the view, then go
        window.setTimeout(() => {
            setShown(true);
            window.setTimeout(finish, THEATRE_FADE + 40);
        }, THEATRE_WAKE);
    }, [finish]);

    const warm = useCallback(() => {
        if (failed || !decide()) return;
        setWarmOn(window.location.pathname);
        setEntered(true);
        if (phase.current === "cold") {
            phase.current = "building";
            setWarmth("busy");
        }
    }, [decide, failed]);

    const reveal = useCallback(
        (done: () => void, rest = 0) => {
            if (!mountedRef.current) {
                window.setTimeout(done, rest);
                return;
            }
            pending.current = done;
            setPaused(false);
            // not settled yet (you came through very quickly): it shows itself once it has
            if (phase.current === "ready") show();
            // never keep anyone waiting on a theatre that won't come
            window.setTimeout(() => pending.current === done && finish(), 9000);
        },
        [show, finish],
    );

    const hold = useCallback(() => {
        if (phase.current !== "building" || pending.current) return;
        phase.current = "cold";
        setWarmth("idle");
        setWarmOn(null);
        setEntered(false);
    }, []);

    // Its first frame is drawn (everything built, compiled once). Out of sight, let it
    // run on until it has settled: the things that ease in have, and the late parts
    // (the neon's letters) are drawn and compiled. Then pause it, unless it's wanted.
    const onReady = useCallback(() => {
        if (phase.current !== "building") return;
        phase.current = "settling";
        setPaused(false);
        settling.current = whenSettled(() => {
            phase.current = "ready";
            setWarmth("ready");
            if (pending.current) show();
            else setPaused(true);
        });
    }, [show]);
    const onFail = useCallback(() => {
        setFailed(true);
        setWarmth("idle");
        settling.current();
        phase.current = "cold";
        finish();
    }, [finish]);

    const host = useMemo(() => ({ warm, reveal, hold, flat: here && (can3d === false || failed), warmth }), [warm, reveal, hold, here, can3d, failed, warmth]);
    const stage = useMemo(
        () => ({ mounted, active: here, entered, paused: !here && paused, shown, onReady, onFail }),
        [mounted, here, entered, paused, shown, onReady, onFail],
    );

    return (
        <HostContext.Provider value={host}>
            <StageContext.Provider value={stage}>{children}</StageContext.Provider>
        </HostContext.Provider>
    );
}

class Fallback extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch() {
        this.props.onFail();
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

/** Where the theatre is drawn: put it in the page area of the shell, after the page. */
export function TheatreStage() {
    const s = useContext(StageContext);
    const wrap = useRef<HTMLDivElement>(null);
    // out of reach (no focus, no screen reader) until it's the page
    useEffect(() => {
        if (wrap.current) wrap.current.inert = !s?.active;
    }, [s?.active, s?.mounted]);
    if (!s?.mounted) return null;
    // Waiting, it's out of sight above everything; arriving, it fades in there; once it's
    // the page, it's in the page's flow (it scrolls). The same element throughout, so the
    // theatre is never rebuilt.
    return (
        <div
            ref={wrap}
            aria-hidden={s.active ? undefined : true}
            className={s.active ? undefined : "pointer-events-none fixed inset-0 z-[86] overflow-hidden"}
            style={s.active ? undefined : { opacity: s.shown ? 1 : 0, transition: `opacity ${THEATRE_FADE}ms cubic-bezier(0.45, 0, 0.55, 1)` }}
        >
            <Fallback onFail={s.onFail}>
                <Theatre3D active={s.active} entered={s.entered} paused={s.paused} onReady={s.onReady} />
            </Fallback>
        </div>
    );
}
