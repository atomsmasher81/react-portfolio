'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { theatre } from "@/data/v2/theatre";
import { fellSC } from "@/components/v2/theatre-fonts";
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
    const [asked, setAsked] = useState(false); // the theatre's been asked to warm up
    const [capped, setCapped] = useState(false); // waited long enough for the theatre
    // How it shows itself, once you've scrolled to it: the plate settles, its neon
    // strikes, the line under it comes, all at once. Then the keyhole rises out of the
    // shadow as the light finds it, an ember kindles in the hole, and the hint last;
    // if the keyhole (or the theatre behind it) isn't ready yet, its silhouette waits
    // in its place meanwhile, an ember breathing in the hole, "the keyhole is waking".
    const [seen, setSeen] = useState(false);
    const seenAt = useRef(0);
    const [stage, setStage] = useState(0); // 1 neon, 2 the line, 3 the hint
    const [due, setDue] = useState(false); // the keyhole's moment has come (ready or not)
    const [appearAt, setAppearAt] = useState<number | null>(null);
    const [up, setUp] = useState(false); // the keyhole has risen: look through it
    const [plain, setPlain] = useState(false); // gone through before the keyhole was there

    useEffect(() => {
        const h = new Date().getHours();
        const q = new URLSearchParams(window.location.search);
        setLit(h >= 21 || h < 5 || q.has("theatre"));
        if (q.get("entry") === "light") setEntry("light");
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
    useEffect(() => {
        if (!due || !ready || !settled || appearAt !== null || plain) return;
        setAppearAt(reduced ? performance.now() - 10_000 : performance.now());
    }, [due, ready, settled, appearAt, plain, reduced]);
    useEffect(() => {
        if (appearAt === null) return;
        const t = window.setTimeout(() => setUp(true), Math.max(0, appearAt + 2000 - performance.now()));
        return () => window.clearTimeout(t);
    }, [appearAt]);
    // waiting for it: its silhouette, from the moment it would have come
    const waking = due && appearAt === null && startedAt === null;

    const goThrough = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab etc. as normal
        e.preventDefault();
        if (startedAt !== null) return;
        // Not there yet (only its silhouette): the page simply goes dark and you're through.
        if (live && appearAt === null) setPlain(true);
        setStartedAt(performance.now());
        // Through before the theatre behind it is ready (it's still being built): building
        // it now would stall the dive, so it's left to its own page, behind its cover, the
        // lights coming on as it does when you arrive any other way.
        hold();
    };
    const timeline = reduced ? TIMELINE_REDUCED : live && !plain ? TIMELINES[entry] : TIMELINE_PLAIN;

    if (!lit) return null;

    return (
        <div className="mt-24 flex flex-col items-center">
            <Link
                ref={box}
                href={THEATRE_PATH}
                data-hold
                onClick={goThrough}
                aria-label={`${theatre.sign}. ${theatre.entrance}. Look through the keyhole.`}
                className="flex flex-col items-center outline-none focus-visible:[&>span:first-child]:shadow-[0_0_0_2px_rgba(255,143,102,0.6)]"
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
                    {/* waiting for it: its silhouette, an ember breathing in the hole */}
                    <WakingKeyhole on={waking} reduced={reduced} />
                    {live ? (
                        // the 3D keyhole (it places its own canvas round this box, and takes the
                        // whole screen when you go through)
                        mounted && (
                            <Fallback fallback={<DrawnKeyhole light={startedAt === null ? 0 : 1} shown={appearAt !== null} />} onFail={() => setReady(true)}>
                                <KeyholeView startedAt={plain ? null : startedAt} entry={entry} reduced={reduced} anchor={anchor} appearAt={appearAt} onReady={() => setReady(true)} hold={showing} />
                            </Fallback>
                        )
                    ) : (
                        <DrawnKeyhole light={startedAt === null ? 0 : 1} shown={appearAt !== null} />
                    )}
                </span>

                {/* the hint: while it's waking, then (once it has risen) the invitation */}
                <motion.span
                    className="mt-4 grid text-[13px] italic text-[var(--muted)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: stage >= 3 ? 0.6 : 0 }}
                    transition={{ duration: reduced ? 0.4 : 1.4 }}
                >
                    <span className="col-start-1 row-start-1 text-center transition-opacity duration-700" style={{ opacity: up ? 0 : 1 }} aria-hidden={up}>
                        The keyhole is waking&hellip;
                    </span>
                    <span className="col-start-1 row-start-1 text-center transition-opacity duration-700" style={{ opacity: up ? 1 : 0 }} aria-hidden={!up}>
                        Look through the keyhole
                    </span>
                </motion.span>
            </Link>

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

/**
 * The keyhole while it's still getting ready: its silhouette, faintly, exactly
 * where the plate will be (the same box and outline), and a small ember breathing
 * in the hole. It fades as the keyhole itself rises out of it.
 */
function WakingKeyhole({ on, reduced }: { on: boolean; reduced: boolean }) {
    return (
        <span aria-hidden className="pointer-events-none absolute inset-0 text-[var(--ink)] transition-opacity duration-[900ms] ease-out" style={{ opacity: on ? 1 : 0 }}>
            <svg viewBox="0 0 120 200" className="absolute inset-0 h-full w-full overflow-visible">
                <defs>
                    <radialGradient id="kh-waking-ember" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#ffc58a" stopOpacity="0.95" />
                        <stop offset="0.35" stopColor="#ff8a4a" stopOpacity="0.55" />
                        <stop offset="1" stopColor="#ff6a2a" stopOpacity="0" />
                    </radialGradient>
                </defs>
                {/* the 3D plate comes out a touch bigger than the drawn one's outline (its hole is the same) */}
                <g transform="translate(60 99.5) scale(1.063 1.031) translate(-60 -99.5)">
                    <path d={PLATE} fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                </g>
                <path d={HOLE} fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.8" />
            </svg>
            <motion.span
                className="absolute left-1/2 top-[33%] block h-7 w-7 -translate-x-1/2 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,197,138,0.9) 0, rgba(255,138,74,0.45) 32%, rgba(255,106,42,0) 70%)" }}
                initial={{ opacity: 0.3 }}
                animate={on && !reduced ? { opacity: [0.25, 0.85, 0.35, 0.7, 0.25] } : { opacity: on ? 0.6 : 0 }}
                transition={on && !reduced ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6 }}
            />
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
