'use client';

import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { theatre } from "@/data/v2/theatre";
import { fell, fellSC } from "@/components/v2/theatre-fonts";
import { KeyholeSequence } from "@/components/v2/keyhole-sequence";
import { TIMELINES, TIMELINE_PLAIN, TIMELINE_REDUCED, type Entry } from "@/components/v2/theatre3d/keyhole-timeline";
import { THEATRE_PATH, useTheatreHost } from "@/components/v2/theatre-host";

// The way into the Magic Theatre, at the foot of the Now and Journey pages: an
// old iron keyhole on the page, and through it the theatre itself, live. Only
// at night (the visitor's night); `?theatre` lights it any time.
//
// Going through: you lean in and go through the keyhole, and on the other
// side you're simply in the theatre: it has been built, out of sight, since
// the keyhole got ready (theatre-host.tsx), and it fades in over the last
// stretch of the dive, from the same viewpoint. (`&entry=light` tries the other way in: a
// golden light shines out of the keyhole first and then turns dark.) The 3D
// keyhole and the page's side, KeyholeSequence, share one clock:
// theatre3d/keyhole-timeline.ts.

const KeyholeView = dynamic(() => import("@/components/v2/theatre3d/keyhole-view").then((m) => m.KeyholeView), { ssr: false });

// Letters that buzz out of step like an old neon sign; `dead` stays mostly
// dark. Timings come from the index so server and client agree. With `on`
// false the tubes are dark; when it turns true they strike, one by one in no
// particular order, the way old neon comes on.
export function Neon({ text, dead = -1, on = true, className = "" }: { text: string; dead?: number; on?: boolean; className?: string }) {
    const wasOff = useRef(!on);
    const n = text.length;
    return (
        <span className={className} aria-label={text}>
            {Array.from(text).map((ch, i) => {
                if (ch === " ") return <span key={i} aria-hidden>{ch}</span>;
                const idle = i === dead ? "v2-neon-dead" : "v2-neon";
                const duration = 3.4 + ((i * 7) % 11) * 0.41;
                if (!on) return <span key={i} aria-hidden className="v2-neon-off">{ch}</span>;
                if (!wasOff.current)
                    return (
                        <span key={i} aria-hidden className={i === dead ? "v2-neon v2-neon-dead" : "v2-neon"} style={{ animationDuration: `${duration}s`, animationDelay: `${-((i * 13) % 17) * 0.31}s` }}>
                            {ch}
                        </span>
                    );
                const at = (((i * 7) % n) / n) * 0.75 + ((i * 5) % 3) * 0.04;
                const strike = i === dead ? "v2-neon-strike-dead" : "v2-neon-strike";
                return (
                    <span
                        key={i}
                        aria-hidden
                        className={i === dead ? "v2-neon v2-neon-dead" : "v2-neon"}
                        style={{ animation: `${strike} 0.85s steps(1, end) ${at.toFixed(2)}s both, ${idle} ${duration}s steps(1, end) ${(at + 0.85).toFixed(2)}s infinite` }}
                    >
                        {ch}
                    </span>
                );
            })}
        </span>
    );
}

// If anything in the 3D keyhole fails, show the drawn one rather than nothing.
class Fallback extends Component<{ children: ReactNode; fallback: ReactNode; onFail: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch() {
        this.props.onFail();
    }
    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function canWebGL() {
    try {
        const c = document.createElement("canvas");
        return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
        return false;
    }
}

/** Run `f` once the page is idle (or after `timeout` ms at the latest). Returns a cancel. */
function idle(f: () => void, timeout: number) {
    if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(() => f(), { timeout });
        return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(f, Math.min(timeout, 1000)); // (no idle callbacks, as in Safari)
    return () => window.clearTimeout(id);
}

// The longest the keyhole waits for the theatre behind it to be ready (once it's
// ready itself and the sign has been seen) before it shows itself anyway.
const MAX_WAIT = 10_000;

// The drawn keyhole, for browsers without 3D: a plate with the hole cut out (even-odd).
const PLATE = "M60 4 C 93 4 113 21 113 52 L 113 148 C 113 179 93 196 60 196 C 27 196 7 179 7 148 L 7 52 C 7 21 27 4 60 4 Z";
const HOLE = "M52 90.3 A20 20 0 1 1 68 90.3 L 74 152 L 46 152 Z";

export function TheatreSign() {
    const router = useRouter();
    const host = useTheatreHost();
    const [lit, setLit] = useState(false);
    const [near, setNear] = useState(false);
    const [live, setLive] = useState<boolean | null>(null); // 3D, once that's been decided
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [reduced, setReduced] = useState(false);
    const [entry, setEntry] = useState<Entry>("dive");
    const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
    const box = useRef<HTMLAnchorElement>(null);
    // Getting ready, out of sight and before it's needed: the keyhole is built (the
    // corridor through it, every shader compiled, a frame drawn unseen), and then the
    // theatre behind it (theatre-host.tsx), all a slice at a time while the page is idle.
    const [ready, setReady] = useState(false); // the keyhole
    const [done, setDone] = useState(0); // how far it has got with that, 0..1
    const [asked, setAsked] = useState(false); // the theatre's been asked to warm up
    const [capped, setCapped] = useState(false); // waited long enough for the theatre
    // How it shows itself, once you've scrolled to it: the plate settles, its neon
    // strikes, the line under it comes, all at once. Then the keyhole rises out of the
    // shadow as the light finds it, an ember kindles in the hole, and the hint last.
    // If the keyhole (or the theatre behind it) isn't ready yet, you see it being
    // made in its place meanwhile, as far as it has really got (MakingKeyhole), and
    // once it's made, the real one takes over from the drawing, lit.
    const [seen, setSeen] = useState(false);
    const seenAt = useRef(0);
    const [stage, setStage] = useState(0); // 1 neon, 2 the line, 3 the hint
    const [due, setDue] = useState(false); // the keyhole's moment has come (ready or not)
    const [appearAt, setAppearAt] = useState<number | null>(null);
    const [up, setUp] = useState(false); // the keyhole has risen: look through it
    const [tried, setTried] = useState(0); // tried to go through while it was still being made
    const [told, setTold] = useState(false); // (and been told it isn't ready yet)
    const [making, setMaking] = useState(false); // it wasn't ready when its moment came: it's being made
    const [made, setMade] = useState(false); // (and the drawing of that is finished)
    const [handed, setHanded] = useState(false); // the real one has taken over from the drawing
    const [cleared, setCleared] = useState(false); // (and the drawing has gone)
    const [failed, setFailed] = useState(false); // the 3D keyhole failed: the drawn one stands in
    const [freeze, setFreeze] = useState<number>(); // (development: `&making=0.5` holds the drawing there)

    useEffect(() => {
        const h = new Date().getHours();
        const q = new URLSearchParams(window.location.search);
        setLit(h >= 21 || h < 5 || q.has("theatre"));
        if (q.get("entry") === "light") setEntry("light");
        if (process.env.NODE_ENV !== "production" && q.has("making")) setFreeze(Math.min(1, Math.max(0, Number(q.get("making")) || 0)));
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, []);

    // Build the keyhole as it comes near, or as soon as the page is idle, whichever is first.
    useEffect(() => {
        if (!lit || !box.current) return;
        const wake = () => setNear(true);
        const io = new IntersectionObserver(([e]) => e.isIntersecting && wake(), { rootMargin: "400px" });
        io.observe(box.current);
        const cancel = idle(wake, 2500);
        return () => {
            io.disconnect();
            cancel();
        };
    }, [lit]);

    // Building is done a slice at a time, but a few steps can't be split (making the
    // keyhole's canvas, loading the theatre's code, mounting it): none of them start
    // while the plate is showing itself.
    const showing = seen && stage < 3 && !reduced;
    // The code first, as early as the page allows (evaluating it is one of those steps).
    useEffect(() => {
        if (!lit || showing) return;
        return idle(() => {
            router.prefetch(THEATRE_PATH);
            import("@/components/v2/theatre3d/keyhole-view").catch(() => {});
            import("@/components/v2/theatre3d/theatre").catch(() => {});
        }, 600);
    }, [lit, showing, router]);
    const [build, setBuild] = useState(false);
    useEffect(() => {
        if (near && !showing) setBuild(true);
    }, [near, showing]);
    useEffect(() => {
        if (build) setLive(canWebGL());
    }, [build]);
    // (and its canvas is made only then too, if it hasn't been already)
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        if (live && !showing) setMounted(true);
    }, [live, showing]);

    // Drawn rather than 3D: nothing to get ready.
    useEffect(() => {
        if (live === false) setReady(true);
    }, [live]);

    // The keyhole is ready, so someone may well go through: build the theatre now,
    // out of sight, when the page is next idle.
    const { warm, warmth, hold } = host;
    useEffect(() => {
        if (!ready || asked || startedAt !== null || showing) return;
        return idle(() => {
            warm();
            setAsked(true);
        }, 800);
    }, [ready, asked, startedAt, showing, warm]);

    useEffect(() => {
        if (!lit || !box.current) return;
        const io = new IntersectionObserver(
            ([e]) => {
                if (!e.isIntersecting) return;
                seenAt.current = performance.now();
                setSeen(true);
                io.disconnect();
            },
            { threshold: 0.35 },
        );
        io.observe(box.current);
        return () => io.disconnect();
    }, [lit]);

    // The plate, its neon and its line, as soon as it's seen.
    useEffect(() => {
        if (!seen) return;
        if (reduced) {
            setStage(3);
            setDue(true);
            return;
        }
        const timers = [
            window.setTimeout(() => setStage(1), 350),
            window.setTimeout(() => setStage(2), 1350),
            window.setTimeout(() => setDue(true), 1500),
            window.setTimeout(() => setStage(3), 3600),
        ];
        return () => timers.forEach(window.clearTimeout);
    }, [seen, reduced]);

    // The keyhole, once it's ready and so is the theatre behind it (so going through it
    // always ends in the theatre, lit, with no wait). A slow device may take its time
    // over the theatre: MAX_WAIT after both the sign is seen and the keyhole is ready,
    // the keyhole comes anyway, and the theatre, if it hasn't really started, is left
    // to be built on its own page if someone goes through.
    const settled = (asked && warmth !== "busy") || capped;
    const warmthNow = useRef(warmth);
    warmthNow.current = warmth;
    const readyAt = useRef(0);
    useEffect(() => {
        if (ready) readyAt.current = performance.now();
    }, [ready]);
    useEffect(() => {
        if (!seen || !ready || settled) return;
        const t = window.setTimeout(
            () => {
                if (warmthNow.current === "busy") hold();
                setCapped(true);
            },
            Math.max(0, Math.max(seenAt.current, readyAt.current) + MAX_WAIT - performance.now()),
        );
        return () => window.clearTimeout(t);
    }, [seen, ready, settled, hold]);
    // Not ready when its moment comes: it's made before your eyes meanwhile (only the
    // 3D one: the drawn one is always ready, and needs nothing from the theatre).
    useEffect(() => {
        if (due && appearAt === null && live !== false && (freeze !== undefined || !ready || !settled)) setMaking(true);
    }, [due, appearAt, live, freeze, ready, settled]);
    const drawn = live === false || failed;
    useEffect(() => {
        if (making && drawn) setMade(true);
    }, [making, drawn]);
    useEffect(() => {
        if (!due || !ready || !settled || appearAt !== null || (making && !made)) return;
        // (taking over from the drawing it fades in where it is, so even with reduced motion it takes its time)
        setAppearAt(reduced && !making ? performance.now() - 10_000 : performance.now());
    }, [due, ready, settled, appearAt, making, made, reduced]);
    useEffect(() => {
        if (appearAt === null) return;
        const t = window.setTimeout(() => setUp(true), Math.max(0, appearAt + (making ? 1000 : 2000) - performance.now()));
        return () => window.clearTimeout(t);
    }, [appearAt, making]);
    // (the drawn keyhole, without 3D, comes in over it slowly: the drawing goes once it has)
    useEffect(() => {
        if (!making || !drawn || appearAt === null) return;
        const t = window.setTimeout(() => setHanded(true), 1600);
        return () => window.clearTimeout(t);
    }, [making, drawn, appearAt]);
    useEffect(() => {
        if (!handed) return;
        const t = window.setTimeout(() => setCleared(true), 600);
        return () => window.clearTimeout(t);
    }, [handed]);

    const goThrough = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab etc. as normal
        e.preventDefault();
        if (startedAt !== null) return;
        // Not there yet (it's still being made): there's nothing to look through. It
        // shakes like a locked door, and the line under it says so.
        if (appearAt === null) {
            setTried((n) => n + 1);
            return;
        }
        setStartedAt(performance.now());
        // Through before the theatre behind it is ready (it's still being built): building
        // it now would stall the dive, so it's left to its own page, behind its cover, the
        // lights coming on as it does when you arrive any other way.
        hold();
    };
    const timeline = reduced ? TIMELINE_REDUCED : live ? TIMELINES[entry] : TIMELINE_PLAIN;

    // Tried too soon: a rattle, and "not yet" for a little while.
    const rattle = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!tried) return;
        setTold(true);
        if (!reduced)
            rattle.current?.animate(
                [{ transform: "none" }, { transform: "translateX(-3px) rotate(-0.8deg)" }, { transform: "translateX(3px) rotate(0.8deg)" }, { transform: "translateX(-2px)" }, { transform: "translateX(1px)" }, { transform: "none" }],
                { duration: 420, easing: "ease-out" },
            );
        const t = window.setTimeout(() => setTold(false), 2600);
        return () => window.clearTimeout(t);
    }, [tried, reduced]);

    if (!lit) return null;

    return (
        <div className="mt-24 flex flex-col items-center">
            <Link
                ref={box}
                href={THEATRE_PATH}
                data-hold
                onClick={goThrough}
                aria-label={`${theatre.sign}. ${theatre.entrance}. Look through the keyhole.`}
                className={`flex flex-col items-center outline-none focus-visible:[&>span:first-child]:shadow-[0_0_0_2px_rgba(255,143,102,0.6)] ${appearAt === null ? "cursor-progress" : ""}`}
            >
                {/* the little enamel sign over it: out of the dark, settling a little crooked */}
                <motion.span
                    className="relative mb-4 block rounded-[3px] border border-black/60 bg-[#0e0a09] px-5 pb-2 pt-2.5 text-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7),inset_0_0_0_3px_#1a1311,inset_0_0_24px_rgba(0,0,0,0.9)]"
                    initial={{ opacity: 0, y: -10, rotate: -5 }}
                    animate={seen ? { opacity: 1, y: 0, rotate: -1.5 } : { opacity: 0, y: -10, rotate: -5 }}
                    transition={reduced ? { duration: 0.6 } : { opacity: { duration: 0.9, ease: "easeOut" }, y: { duration: 1.1, ease: [0.22, 1, 0.36, 1] }, rotate: { type: "spring", stiffness: 60, damping: 7, mass: 0.8 } }}
                >
                    {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((p) => (
                        <span key={p} className={`absolute ${p} h-1 w-1 rounded-full bg-[#3a2f2a]`} />
                    ))}
                    <Neon text={theatre.sign.toUpperCase()} dead={10} on={reduced || stage >= 1} className={`${fellSC.className} block text-[14px] tracking-[0.38em]`} />
                    <motion.span
                        className={`${fellSC.className} mt-1.5 block text-[10px] text-[#b39a84] [text-shadow:0_0_6px_rgba(255,160,110,0.25)]`}
                        initial={{ opacity: 0, letterSpacing: "0.55em" }}
                        animate={stage >= 2 ? { opacity: 1, letterSpacing: "0.3em" } : { opacity: 0, letterSpacing: "0.55em" }}
                        transition={{ duration: reduced ? 0.4 : 1.6, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {theatre.entrance}
                    </motion.span>
                </motion.span>

                {/* the keyhole */}
                <span ref={setAnchor} className="relative block h-[200px] w-[120px]">
                    {/* not ready yet: being made, in its place */}
                    <span ref={rattle} className="absolute inset-0 block">
                        {making && !cleared && <MakingKeyhole making={makingFrom(done, ready, settled)} reduced={reduced} freeze={freeze} gone={handed} onMade={() => setMade(true)} />}
                    </span>
                    {live ? (
                        // the 3D keyhole (it places its own canvas round this box, and takes the
                        // whole screen when you go through)
                        mounted && (
                            <Fallback
                                fallback={<DrawnKeyhole light={startedAt === null ? 0 : 1} shown={appearAt !== null} />}
                                onFail={() => {
                                    setFailed(true);
                                    setReady(true);
                                }}
                            >
                                <KeyholeView
                                    startedAt={startedAt}
                                    entry={entry}
                                    reduced={reduced}
                                    anchor={anchor}
                                    appearAt={appearAt}
                                    onReady={() => setReady(true)}
                                    hold={showing}
                                    onProgress={setDone}
                                    takeover={making}
                                    onShown={() => setHanded(true)}
                                />
                            </Fallback>
                        )
                    ) : (
                        <DrawnKeyhole light={startedAt === null ? 0 : 1} shown={appearAt !== null} />
                    )}
                </span>

                {/* the hint: while it's being made, then (once it's there) the invitation */}
                <motion.span
                    className={`${fell.className} mt-3.5 grid text-[14px] italic tracking-[0.01em] text-[var(--muted)]`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: told ? 1 : stage >= 3 ? 0.75 : 0 }}
                    transition={{ duration: reduced ? 0.4 : 1.4 }}
                >
                    <span className="col-start-1 row-start-1 text-center transition-opacity duration-700" style={{ opacity: !up && (making || told) ? 1 : 0 }} aria-hidden={up || !(making || told)}>
                        {told ? "Not yet. It\u2019s still being made" : "The keyhole is being made"}
                        <Ellipsis on={(making || told) && !up && !reduced} />
                    </span>
                    <span className="col-start-1 row-start-1 text-center transition-opacity duration-700" style={{ opacity: up ? 1 : 0 }} aria-hidden={!up}>
                        Look through the keyhole
                    </span>
                </motion.span>
            </Link>
            <span role="status" className="sr-only">
                {told ? "Not yet: the keyhole is still being made." : ""}
            </span>

            {startedAt !== null && anchor && (
                <KeyholeSequence
                    startedAt={startedAt}
                    timeline={timeline}
                    anchor={anchor}
                    onDone={() => host.reveal(() => router.push(THEATRE_PATH), timeline.go - timeline.handoff)}
                />
            )}
        </div>
    );
}

// "…", its dots coming and going like embers, while something's being done
function Ellipsis({ on }: { on: boolean }) {
    const dots = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!on || !dots.current) return;
        const runs = Array.from(dots.current.children).map((d, i) =>
            d.animate([{ opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }], { duration: 1800, delay: i * 300, iterations: Infinity, easing: "ease-in-out" }),
        );
        return () => runs.forEach((a) => a.cancel());
    }, [on]);
    return (
        <span ref={dots}>
            <span>.</span>
            <span>.</span>
            <span>.</span>
        </span>
    );
}

/* ---------------------------------------------- the keyhole being made */

// The plate as the 3D keyhole's camera sees it at rest (keyhole-view.tsx: its
// plateShape, holePath and RIVETS), on the 120 × 200 box: plate units (y up) are
// scaled about the bowl's centre, which is on the camera's axis, by how far away
// they are, so the face comes out a touch bigger than the bevelled edge round it.
const BOWL = { x: 60, y: 68.6 };
const FACE_S = 102.13; // px per plate unit at the plate's face
const EDGE_S = 101.72; // and at its bevelled edge, its widest
const at = (x: number, y: number, s = FACE_S) => `${(BOWL.x + x * s).toFixed(2)} ${(BOWL.y - (y - 0.3) * s).toFixed(2)}`;
const atY = (y: number, s = FACE_S) => BOWL.y - (y - 0.3) * s;
// the outline, half w wide and half h high (plateShape's), whole and as two halves from the top
function outline(w: number, h: number, s: number) {
    const k = (0.33 * w) / 0.53;
    const e = 0.48 + 0.31 * ((h - 0.48) / 0.48);
    const side = (d: number) => `C ${at(k * d, h, s)} ${at(w * d, e, s)} ${at(w * d, 0.48, s)} L ${at(w * d, -0.48, s)} C ${at(w * d, -e, s)} ${at(k * d, -h, s)} ${at(0, -h, s)}`;
    const back = (d: number) => `C ${at(k * d, -h, s)} ${at(w * d, -e, s)} ${at(w * d, -0.48, s)} L ${at(w * d, 0.48, s)} C ${at(w * d, e, s)} ${at(k * d, h, s)} ${at(0, h, s)}`;
    return { whole: `M ${at(0, h, s)} ${side(1)} ${back(-1)} Z`, right: `M ${at(0, h, s)} ${side(1)}`, left: `M ${at(0, h, s)} ${side(-1)}` };
}
const EDGE = outline(0.555, 0.985, EDGE_S); // the bevel adds 0.025 all round
const EDGE_D = EDGE.whole;
const FACE_D = outline(0.53, 0.96, FACE_S).whole;
// the hole: the bowl (radius 0.2 round 0, 0.3), and where its arc meets the slot
const BOWL_R = 0.2 * FACE_S;
const JOIN = { x: 0.2 * Math.cos(Math.atan2(-0.203, -0.08)), y: 0.3 + 0.2 * Math.sin(Math.atan2(-0.203, -0.08)) };
const ARC = `${BOWL_R.toFixed(2)} ${BOWL_R.toFixed(2)} 0 1`;
const HOLE_D = `M ${at(-0.08, 0.097)} L ${at(JOIN.x, JOIN.y)} A ${ARC} 1 ${at(-JOIN.x, JOIN.y)} L ${at(0.14, -0.52)} L ${at(-0.14, -0.52)} Z`;
// (and as it's cut: from the foot of the slot, up and round the bowl and back)
const CUT_D = `M ${at(0, -0.52)} L ${at(0.14, -0.52)} L ${at(-JOIN.x, JOIN.y)} A ${ARC} 0 ${at(JOIN.x, JOIN.y)} L ${at(-0.08, 0.097)} L ${at(-0.14, -0.52)} Z`;
// the rivets (their domes stand a touch nearer still)
const RIVET_AT = [
    [0, 0.82],
    [0.4, 0],
    [0, -0.82],
    [-0.4, 0],
].map(([x, y]) => ({ x: BOWL.x + x * 102.3, y: atY(y, 102.3) }));
const RIVET_R = 4.6;
// the layout: the compass arcs the plate's rounded ends are struck from (through the
// ends of its straight sides and its top, or foot), its straight sides ruled between
const LAYOUT = (() => {
    const w = 0.555 * EDGE_S;
    const h = (0.985 - 0.48) * EDGE_S;
    const r = (w * w + h * h) / (2 * h);
    const top = atY(0.48, EDGE_S);
    const foot = atY(-0.48, EDGE_S);
    const over = 9; // the arcs run on a little past where they're needed
    const dx = Math.sqrt(r * r - (over - (r - h)) ** 2);
    const R = r.toFixed(2);
    const xy = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
    return {
        capT: `M ${xy(60 - dx, top + over)} A ${R} ${R} 0 1 1 ${xy(60 + dx, top + over)}`,
        capB: `M ${xy(60 + dx, foot - over)} A ${R} ${R} 0 1 1 ${xy(60 - dx, foot - over)}`,
        sideL: `M ${(60 - w).toFixed(2)} ${(top - 14).toFixed(2)} L ${(60 - w).toFixed(2)} ${(foot + 14).toFixed(2)}`,
        sideR: `M ${(60 + w).toFixed(2)} ${(top - 14).toFixed(2)} L ${(60 + w).toFixed(2)} ${(foot + 14).toFixed(2)}`,
        axisV: `M 60 -10 L 60 210`,
        axisB: `M -6 ${BOWL.y} L 126 ${BOWL.y}`, // through the bowl
        axisR: `M -6 ${RIVET_AT[1].y.toFixed(2)} L 126 ${RIVET_AT[1].y.toFixed(2)}`, // through the side rivets
        bowl: `M 60 ${(BOWL.y - BOWL_R).toFixed(2)} A ${BOWL_R.toFixed(2)} ${BOWL_R.toFixed(2)} 0 1 1 60 ${(BOWL.y + BOWL_R).toFixed(2)} A ${BOWL_R.toFixed(2)} ${BOWL_R.toFixed(2)} 0 1 1 60 ${(BOWL.y - BOWL_R).toFixed(2)}`,
    };
})();

/** Where the making has really got (0..1), what comes next, and about how long that takes (s). */
type Making = { at: number; next: number; tau: number };
// The keyhole's own steps of getting ready (KeyholeView's onProgress: its canvas, its
// iron painted, the corridor, the marquee, the doors, compiled, drawn), and then the
// theatre behind it warming, as how far along the making is: the layout is scribed
// while its canvas is made and its iron painted, the hole is cut with the corridor,
// the rivets set with the marquee and the doors, the iron poured as it's compiled
// and drawn, and it rusts while the theatre warms.
const MAKING_AT = [0, 0.1, 0.2, 0.3, 0.38, 0.46, 0.6, 0.72];
const MAKING_TAU = [1.6, 1, 1.2, 0.8, 0.8, 1.2, 1.2];
function makingFrom(done: number, ready: boolean, settled: boolean): Making {
    if (ready && settled) return { at: 1, next: 1, tau: 1 };
    if (ready) return { at: 0.72, next: 0.97, tau: 3 };
    const n = Math.min(MAKING_AT.length - 2, Math.round(done * 7));
    return { at: MAKING_AT[n], next: MAKING_AT[n + 1], tau: MAKING_TAU[n] };
}
const ZIP = 0.6; // the fastest it goes (when it's all ready at once): all of it in under two seconds
const STILL = 0.5; // with reduced motion: drawn, the hole cut and the rivets set, and so it stays

const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const mix = (a: [number, number, number], b: [number, number, number], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const HOT: [number, number, number] = [255, 170, 92];
const COOLED: [number, number, number] = [42, 14, 8];

/**
 * The keyhole while the real one is still getting ready: the plate being made on
 * the page, in its exact place. Its layout scribed (a centre mark, the axes, compass
 * arcs for the bowl and the rounded ends, the straight sides ruled, the outline),
 * the hole cut, the rivets set one by one, the iron poured from the edges in and
 * cooling from ember-orange to dark behind, and rust creeping in from the edges
 * last. It goes as far as the real preparation has (`making`), creeping on while a
 * step takes its time, so a slow device sees it slowly made and a fast one sees it
 * zip through. Once it's finished (`onMade`), the real one fades in over it, lit,
 * and then it goes (`gone`).
 */
function MakingKeyhole({ making, reduced, freeze, gone, onMade }: { making: Making; reduced: boolean; freeze?: number; gone: boolean; onMade: () => void }) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
    const id = (k: string) => `kh${uid}${k}`;
    const url = (k: string) => `url(#${id(k)})`;
    const root = useRef<HTMLSpanElement>(null);
    const target = useRef({ ...making, since: 0 });
    useEffect(() => {
        target.current = { at: making.at, next: making.next, tau: making.tau, since: 0 };
    }, [making.at, making.next, making.tau]);
    const made = useRef(onMade);
    made.current = onMade;

    useEffect(() => {
        const box = root.current;
        if (!box) return;
        const els: Record<string, SVGElement | HTMLElement> = {};
        box.querySelectorAll<SVGElement | HTMLElement>("[data-k]").forEach((e) => (els[e.dataset.k as string] = e));
        const cut = els.cut as SVGPathElement;
        const cutLength = cut.getTotalLength();
        // (only what has changed is touched, so a stage at rest costs nothing to redraw)
        const was = new Map<string, string>();
        const put = (k: string, prop: string, v: string) => {
            const key = `${k} ${prop}`;
            if (was.get(key) === v) return;
            was.set(key, v);
            const e = els[k];
            if (prop.startsWith("@")) e.setAttribute(prop.slice(1), v);
            else e.style.setProperty(prop, v);
        };
        const draw = (k: string, f: number) => {
            put(k, "stroke-dashoffset", (1 - f).toFixed(4));
            put(k, "visibility", f > 0 ? "" : "hidden"); // ("" inherits: a hidden group hides it)
        };
        const show = (k: string, o: number) => {
            put(k, "opacity", o.toFixed(3));
            put(k, "visibility", o > 0 ? "" : "hidden");
        };
        const widen = (k: string, w: number) => {
            put(`${k}a`, "@stroke-width", Math.max(0, w).toFixed(2));
            put(`${k}b`, "@stroke-width", Math.max(0, w - 4).toFixed(2));
        };
        const paint = (p: number) => {
            // the layout, scribed on the page
            show("mark", seg(p, 0, 0.02));
            draw("axisV", seg(p, 0.01, 0.07));
            draw("axisB", seg(p, 0.025, 0.08));
            draw("axisR", seg(p, 0.04, 0.095));
            const c = seg(p, 0.06, 0.12);
            draw("bowl", c);
            put("arm", "@transform", `rotate(${(c * 360).toFixed(1)} ${BOWL.x} ${BOWL.y})`);
            show("arm", c > 0 && c < 1 ? Math.sin(Math.PI * c) : 0);
            draw("capT", seg(p, 0.08, 0.13));
            draw("capB", seg(p, 0.095, 0.145));
            draw("sideL", seg(p, 0.11, 0.15));
            draw("sideR", seg(p, 0.12, 0.16));
            RIVET_AT.forEach((_, i) => show(`mark${i}`, seg(p, 0.13 + i * 0.008, 0.145 + i * 0.008)));
            draw("edgeR", seg(p, 0.15, 0.2));
            draw("edgeL", seg(p, 0.15, 0.2));
            // (the layout goes as the iron covers it, and the scribed outline gives way to the iron's own edge)
            show("layout", 1 - seg(p, 0.6, 0.85));
            show("edge", 1 - seg(p, 0.86, 1));
            // the hole cut, a spark running round it, glowing behind it and cooling
            const f = seg(p, 0.2, 0.3);
            draw("cut", f);
            put("cut", "stroke", mix(HOT, COOLED, seg(p, 0.3, 0.42)));
            if (f > 0 && f < 1) {
                const tip = cut.getPointAtLength(f * cutLength);
                put("spark", "transform", `translate(${(tip.x - 5).toFixed(2)}px, ${(tip.y - 5).toFixed(2)}px)`);
            }
            show("spark", f > 0 && f < 1 ? 1 : 0);
            // (the dark beyond, spreading from the bowl as the piece comes away)
            const d = seg(p, 0.27, 0.35);
            show("dark", d > 0 ? 1 : 0);
            put("gap", "@r", (d * 120).toFixed(2));
            show("ember", seg(p, 0.3, 0.38) * (1 - 0.8 * seg(p, 0.88, 1)));
            show("smoke", seg(p, 0.24, 0.32) * (1 - seg(p, 0.7, 0.9)));
            // the rivets set, one by one, hot, and cooling
            RIVET_AT.forEach((_, i) => {
                const r = seg(p, 0.35 + i * 0.033, 0.4 + i * 0.033);
                show(`rivet${i}`, Math.min(1, r * 5));
                show(`hot${i}`, 1 - seg(r, 0.3, 1));
                put(`ring${i}`, "@r", (RIVET_R + r * 9).toFixed(2));
                show(`ring${i}`, r > 0 && r < 1 ? 0.7 * (1 - r) : 0);
            });
            // the iron, poured from the edges in: a hot front, cooling to dark behind it
            const w = seg(p, 0.5, 0.82) * 140;
            show("pour", p > 0.5 && p < 1 ? 1 : 0);
            widen("m1", w);
            widen("m2", w - 7);
            widen("m3", w - 15);
            widen("m4", w - 26);
            // and then rust, from the edges in: the iron as it is
            show("aged", p > 0.82 ? 1 : 0);
            widen("m5", seg(p, 0.82, 1) * 136);
            show("far", seg(p, 0.9, 1)); // and the far side's light in the hole
        };

        if (reduced || freeze !== undefined) {
            paint(reduced ? STILL : (freeze as number));
            return;
        }
        // Every frame while it moves along briskly, every other frame while it creeps, and a
        // few times a second when it has all but stopped: so the page keeps as much of its
        // idle time as it can for the very preparation being shown.
        let p = 0;
        let last = performance.now();
        let raf = 0;
        let timer = 0;
        const tick = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            const T = target.current;
            if (!T.since) T.since = now;
            // the goal: as far as it's really got, creeping on towards the next step
            const goal = T.at >= 1 ? 1 : T.at + (T.next - T.at) * 0.9 * (1 - Math.exp(-(now - T.since) / 1000 / T.tau));
            const step = goal > p ? Math.min(goal - p, ZIP * dt, Math.max((goal - p) * 4 * dt, (T.at >= 1 ? 0.2 : 0.03) * dt)) : 0;
            p += step;
            paint(p);
            if (p >= 1) {
                made.current();
                return;
            }
            const speed = dt > 0 ? step / dt : 0;
            if (speed > 0.06) raf = requestAnimationFrame(tick);
            else timer = window.setTimeout(() => (raf = requestAnimationFrame(tick)), speed > 0.003 ? 16 : 110);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(timer);
        };
    }, [reduced, freeze]);

    // (with reduced motion it stays as it is drawn, and is done when the real one is ready)
    useEffect(() => {
        if (reduced && freeze === undefined && making.at >= 1) made.current();
    }, [reduced, freeze, making.at]);

    // what moves on its own (on the compositor): the ember breathing, smoke, the spark
    useEffect(() => {
        const box = root.current;
        if (!box || reduced) return;
        const runs = [
            ...Array.from(box.querySelectorAll<HTMLElement>("[data-puff]")).map((e, i) =>
                e.animate(
                    [
                        { transform: "translate(0, 0) scale(0.5)", opacity: 0 },
                        { opacity: 0.55, offset: 0.25 },
                        { transform: `translate(${i % 2 ? 4 : -5}px, -38px) scale(1.6)`, opacity: 0 },
                    ],
                    { duration: 3400 + i * 700, delay: i * 1300, iterations: Infinity, easing: "cubic-bezier(0.3, 0.6, 0.5, 1)" },
                ),
            ),
            box.querySelector<HTMLElement>("[data-glow]")?.animate([{ opacity: 0.35 }, { opacity: 0.95 }, { opacity: 0.45 }, { opacity: 0.8 }, { opacity: 0.35 }], {
                duration: 3200,
                iterations: Infinity,
                easing: "ease-in-out",
            }),
            box.querySelector<HTMLElement>("[data-flicker]")?.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }, { opacity: 0.7 }, { opacity: 1 }], { duration: 260, iterations: Infinity }),
        ];
        return () => runs.forEach((a) => a?.cancel());
    }, [reduced]);

    const line = { pathLength: 1, strokeDasharray: "1 1", style: { strokeDashoffset: 1, visibility: "hidden" as const } };
    const hidden = { style: { opacity: 0, visibility: "hidden" as const } };
    return (
        <span ref={root} aria-hidden className="pointer-events-none absolute inset-0 text-[var(--ink)] transition-opacity duration-500 ease-out" style={{ opacity: gone ? 0 : 1 }}>
            <svg viewBox="0 0 120 200" className="absolute inset-0 h-full w-full overflow-visible">
                <defs>
                    <clipPath id={id("plate")}>
                        <path d={`${EDGE_D} ${HOLE_D}`} clipRule="evenodd" />
                    </clipPath>
                    <clipPath id={id("hole")}>
                        <path d={HOLE_D} />
                    </clipPath>
                    {/* fronts moving in from the edge: a band as wide as the stroke, half of it inside (softened by a second, narrower one) */}
                    {["m1", "m2", "m3", "m4", "m5"].map((m) => (
                        <mask key={m} id={id(m)} maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="240">
                            {/* (rust doesn't keep to a line: its front is ragged) */}
                            <g filter={m === "m5" ? url("ragged") : undefined}>
                                <path data-k={`${m}a`} d={EDGE_D} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0" strokeLinejoin="round" />
                                <path data-k={`${m}b`} d={EDGE_D} fill="none" stroke="#fff" strokeWidth="0" strokeLinejoin="round" />
                            </g>
                        </mask>
                    ))}
                    <filter id={id("ragged")} filterUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="240" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="9" />
                        <feDisplacementMap in="SourceGraphic" scale="16" xChannelSelector="R" yChannelSelector="G" />
                        <feGaussianBlur stdDeviation="1.5" />
                    </filter>
                    <radialGradient id={id("soft")}>
                        <stop offset="0.75" stopColor="#fff" />
                        <stop offset="1" stopColor="#fff" stopOpacity="0" />
                    </radialGradient>
                    <mask id={id("gap")} maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="240">
                        <circle data-k="gap" cx={BOWL.x} cy={BOWL.y} r="0" fill={url("soft")} />
                    </mask>
                    <linearGradient id={id("cool")} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#2a1813" />
                        <stop offset="1" stopColor="#140b09" />
                    </linearGradient>
                    <linearGradient id={id("rust")} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#2a0904" />
                        <stop offset="0.5" stopColor="#1f0603" />
                        <stop offset="1" stopColor="#170402" />
                    </linearGradient>
                    <radialGradient id={id("paint")} cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#000" stopOpacity="1" />
                        <stop offset="0.6" stopColor="#000" stopOpacity="0.75" />
                        <stop offset="1" stopColor="#000" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#ffc8a0" stopOpacity="0.2" />
                        <stop offset="0.45" stopColor="#ffc8a0" stopOpacity="0.04" />
                        <stop offset="0.55" stopColor="#000" stopOpacity="0.1" />
                        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
                    </linearGradient>
                    <linearGradient id={id("slot")} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#331406" />
                        <stop offset="0.3" stopColor="#542810" />
                        <stop offset="1" stopColor="#5e2f16" />
                    </linearGradient>
                    <radialGradient id={id("bowl")} cx="0.55" cy="0.45" r="0.55">
                        <stop offset="0" stopColor="#3a0603" />
                        <stop offset="1" stopColor="#170201" />
                    </radialGradient>
                    <radialGradient id={id("dome")} cx="0.35" cy="0.3" r="0.75">
                        <stop offset="0" stopColor="#3c0e06" />
                        <stop offset="0.65" stopColor="#260804" />
                        <stop offset="1" stopColor="#0c0201" />
                    </radialGradient>
                    {/* lighter rust here and there */}
                    <filter id={id("mottle")} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" />
                        <feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.055  0 0 0 0 0.022  1.9 0 0 0 -0.86" />
                        <feComposite in2="SourceGraphic" operator="in" />
                    </filter>
                    {/* old black paint, in blotches, holding on round the hole */}
                    <filter id={id("blotch")} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="4" seed="4" />
                        <feColorMatrix values="0 0 0 0 0.02  0 0 0 0 0.012  0 0 0 0 0.01  -6 0 0 0 3.75" />
                        <feComposite in2="SourceGraphic" operator="in" />
                    </filter>
                    <filter id={id("grain")} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
                        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 0.85" />
                        <feComposite in2="SourceGraphic" operator="in" />
                    </filter>
                </defs>

                {/* the layout, scribed on the page */}
                <g data-k="layout" fill="none" stroke="currentColor" strokeWidth="0.55" strokeOpacity="0.42" strokeLinecap="round">
                    <path data-k="axisV" d={LAYOUT.axisV} {...line} />
                    <path data-k="axisB" d={LAYOUT.axisB} {...line} />
                    <path data-k="axisR" d={LAYOUT.axisR} {...line} />
                    <path data-k="capT" d={LAYOUT.capT} {...line} />
                    <path data-k="capB" d={LAYOUT.capB} {...line} />
                    <path data-k="sideL" d={LAYOUT.sideL} {...line} />
                    <path data-k="sideR" d={LAYOUT.sideR} {...line} />
                    <path data-k="bowl" d={LAYOUT.bowl} {...line} strokeOpacity="0.7" />
                    {/* the compass, swinging round the bowl */}
                    <path data-k="arm" d={`M ${BOWL.x} ${BOWL.y} L ${BOWL.x} ${(BOWL.y - BOWL_R).toFixed(2)}`} strokeOpacity="0.8" {...hidden} />
                    <g data-k="mark" strokeOpacity="0.9" {...hidden}>
                        <path d={`M ${BOWL.x - 4} ${BOWL.y} L ${BOWL.x + 4} ${BOWL.y} M ${BOWL.x} ${BOWL.y - 4} L ${BOWL.x} ${BOWL.y + 4}`} />
                        <circle cx={BOWL.x} cy={BOWL.y} r="0.9" fill="currentColor" stroke="none" />
                    </g>
                    {RIVET_AT.map(({ x, y }, i) => (
                        <g key={i} data-k={`mark${i}`} strokeOpacity="0.8" {...hidden}>
                            <circle cx={x} cy={y} r={RIVET_R} />
                            <circle cx={x} cy={y} r="0.7" fill="currentColor" stroke="none" />
                        </g>
                    ))}
                </g>

                {/* the iron, poured from the edges in: a hot front, cooling behind it */}
                <g data-k="pour" clipPath={url("plate")} {...hidden}>
                    <rect x="0" y="-5" width="120" height="210" fill="#ffd08a" mask={url("m1")} />
                    <rect x="0" y="-5" width="120" height="210" fill="#f2782e" mask={url("m2")} />
                    <rect x="0" y="-5" width="120" height="210" fill="#8e2a0c" mask={url("m3")} />
                    <rect x="0" y="-5" width="120" height="210" fill={url("cool")} mask={url("m4")} />
                </g>

                {/* rust, creeping in from the edges: the iron as it is */}
                <g data-k="aged" mask={url("m5")} {...hidden}>
                    <g clipPath={url("plate")}>
                        <path d={EDGE_D} fill={url("rust")} />
                        <path d={EDGE_D} fill="#000" filter={url("mottle")} />
                        <ellipse cx="60" cy="104" rx="46" ry="80" fill={url("paint")} filter={url("blotch")} />
                        <path d={EDGE_D} fill="#000" filter={url("grain")} opacity="0.2" />
                        <path d={FACE_D} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
                        <path d={EDGE_D} fill="none" stroke={url("rim")} strokeWidth="2.6" />
                    </g>
                </g>

                {/* the outline, scribed */}
                <g data-k="edge" fill="none" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.75" strokeLinecap="round">
                    <path data-k="edgeR" d={EDGE.right} {...line} />
                    <path data-k="edgeL" d={EDGE.left} {...line} />
                </g>

                {/* the hole: cut, dark beyond it, and in the end the far side's light */}
                <path data-k="dark" d={HOLE_D} fill="#0b0605" mask={url("gap")} {...hidden} />
                <g data-k="far" clipPath={url("hole")} {...hidden}>
                    <rect x="40" y="80" width="40" height="80" fill={url("slot")} />
                    <circle cx={BOWL.x} cy={BOWL.y} r={BOWL_R + 1} fill={url("bowl")} />
                </g>
                <path data-k="cut" d={CUT_D} fill="none" stroke={mix(HOT, COOLED, 0)} strokeWidth="1.2" strokeLinejoin="round" {...line} />

                {/* the rivets, set one by one */}
                {RIVET_AT.map(({ x, y }, i) => (
                    <g key={i}>
                        <circle data-k={`ring${i}`} cx={x} cy={y} r={RIVET_R} fill="none" stroke="#ffb066" strokeWidth="0.8" {...hidden} />
                        <g data-k={`rivet${i}`} {...hidden}>
                            <circle cx={x} cy={y} r={RIVET_R} fill={url("dome")} />
                            <circle data-k={`hot${i}`} cx={x} cy={y} r={RIVET_R} fill="#ff9a4a" />
                        </g>
                    </g>
                ))}
            </svg>
            {/* an ember breathing in the hole, deep in */}
            <span data-k="ember" className="absolute inset-0" style={{ clipPath: `path("${HOLE_D}")`, opacity: 0, visibility: "hidden" }}>
                <span
                    data-glow
                    className="absolute block h-[30px] w-[30px] rounded-full"
                    style={{ left: BOWL.x - 15, top: BOWL.y - 13, opacity: 0.6, background: "radial-gradient(circle, rgba(255,197,138,0.9) 0, rgba(255,138,74,0.45) 32%, rgba(255,106,42,0) 70%)" }}
                />
            </span>
            {/* and a wisp of smoke from the work */}
            <span data-k="smoke" className="absolute inset-0" style={{ opacity: 0, visibility: "hidden" }}>
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        data-puff
                        className="absolute block h-6 w-6 rounded-full"
                        style={{ left: BOWL.x - 12 + (i - 1) * 3, top: BOWL.y - 10, opacity: 0, background: "radial-gradient(closest-side, color-mix(in srgb, var(--muted) 45%, transparent), transparent)" }}
                    />
                ))}
            </span>
            <span data-k="spark" className="absolute left-0 top-0 block h-[10px] w-[10px] will-change-transform" style={{ opacity: 0, visibility: "hidden" }}>
                <span data-flicker className="block h-full w-full rounded-full" style={{ background: "radial-gradient(circle, #fff7df 0, #ffc070 28%, rgba(255,120,40,0.5) 50%, rgba(255,120,40,0) 72%)" }} />
            </span>
        </span>
    );
}

function DrawnKeyhole({ light, shown }: { light: number; shown: boolean }) {
    return (
        <span className="absolute inset-0 transition-opacity duration-[1600ms] ease-out" style={{ opacity: shown ? 1 : 0 }}>
            {/* light from the other side */}
            <span className="absolute inset-0" style={{ clipPath: `path("${HOLE}")` }}>
                <span
                    className="absolute inset-0 transition-opacity duration-500"
                    style={{ background: "radial-gradient(ellipse 30% 40% at 50% 60%, #ffd29a, #ff9a52 35%, #5a1a0c 70%, #0b0605)", opacity: 0.35 + light * 0.65 }}
                />
            </span>
            <svg viewBox="0 0 120 200" className="absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_14px_18px_rgba(0,0,0,0.45)]" aria-hidden>
                <defs>
                    <linearGradient id="kh-iron" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#2e2622" />
                        <stop offset="0.5" stopColor="#1f1916" />
                        <stop offset="1" stopColor="#120e0c" />
                    </linearGradient>
                    <radialGradient id="kh-rust1" cx="0.22" cy="0.8" r="0.4">
                        <stop offset="0" stopColor="rgba(140,62,24,0.6)" />
                        <stop offset="1" stopColor="rgba(140,62,24,0)" />
                    </radialGradient>
                    <radialGradient id="kh-rust2" cx="0.85" cy="0.18" r="0.35">
                        <stop offset="0" stopColor="rgba(120,52,20,0.55)" />
                        <stop offset="1" stopColor="rgba(120,52,20,0)" />
                    </radialGradient>
                    <filter id="kh-grain" x="0" y="0" width="100%" height="100%">
                        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" />
                        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 0.85" />
                        <feComposite in2="SourceGraphic" operator="in" />
                    </filter>
                    <filter id="kh-rough" x="-5%" y="-5%" width="110%" height="110%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="3" />
                        <feDisplacementMap in="SourceGraphic" scale="2.5" />
                    </filter>
                </defs>
                <g filter="url(#kh-rough)">
                    <path d={`${PLATE} ${HOLE}`} fillRule="evenodd" fill="url(#kh-iron)" />
                    <path d={`${PLATE} ${HOLE}`} fillRule="evenodd" fill="url(#kh-rust1)" />
                    <path d={`${PLATE} ${HOLE}`} fillRule="evenodd" fill="url(#kh-rust2)" />
                    <path d={`${PLATE} ${HOLE}`} fillRule="evenodd" fill="#000" filter="url(#kh-grain)" opacity="0.6" />
                    <path d={PLATE} fill="none" stroke="rgba(255,226,190,0.1)" strokeWidth="1.5" transform="translate(-0.6 -0.6)" />
                    <path d={PLATE} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" transform="translate(0.8 0.8)" />
                    <path d={HOLE} fill="none" stroke="rgba(0,0,0,0.85)" strokeWidth="3" />
                </g>
                {[
                    [60, 18],
                    [60, 182],
                    [20, 100],
                    [100, 100],
                ].map(([x, y]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#2a1d16" stroke="rgba(0,0,0,0.6)" strokeWidth="0.8" />
                ))}
            </svg>
        </span>
    );
}
