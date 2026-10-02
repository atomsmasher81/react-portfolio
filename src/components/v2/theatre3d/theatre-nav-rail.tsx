'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion, useIsomorphicLayoutEffect, useReducedMotion, useTransform } from "framer-motion";
import { fellSC } from "@/components/v2/theatre-fonts";
import { Playbill, ink, railFraction, useProgressValue, useTheatreDialogOpen, type ProgressSource } from "@/components/v2/theatre3d/theatre-nav-ui";

// The map of the corridor: a slim brass rail down the right-hand edge, like
// the floor dial of an old lift. One medallion per stop (the entrance, the
// doors I–VI, the mirror), a thread between them that lights up as you walk,
// and an ember at the point you've reached. A door you've been through wears
// an ember dot. Hover, focus or long-press a stop for its title; tap it to go
// there. Arrow keys move along it. A "?" at the top opens the programme.
// Every stop is a 44 px target; on a screen too short for all of them the
// list scrolls inside the rail (never the page) and keeps your stop in view.

export interface RailStop {
    key: string;
    /** What's on the medallion: the numeral for a door ("I"); the entrance and the mirror draw their own mark. */
    label: string;
    /** Its title, e.g. the inscription on the door's plaque. */
    title: string;
    /** You've been through this door before. */
    opened?: boolean;
    kind?: "entrance" | "door" | "mirror";
    /** Where it is along the walk (0..1, the same scale as `progress`). Evenly spaced if left out. */
    at?: number;
}

export interface DoorRailProps {
    stops: RailStop[];
    /** The stop you're at (index into `stops`), or null between stops. */
    current: number | null;
    /** How far along the walk you are, 0..1. A ref the page writes on scroll works too (no re-renders). */
    progress: ProgressSource;
    onGo(index: number): void;
    hidden?: boolean;
    /** Show this stop's title (e.g. to point it out); otherwise titles show on hover, focus and long-press. */
    peek?: number | null;
    /** If given, a "?" at the top of the rail: the programme (what is this place?). */
    onAbout?(): void;
    /**
     * On a phone, fold the list away behind a small "map" button (tap to unfold), so the rail
     * doesn't cover the view: at the entrance, where the sign reaches the right-hand edge.
     */
    fold?: boolean;
}

const LONG_PRESS = 420;

function eyebrowOf(s: RailStop) {
    if (s.kind === "entrance") return "The entrance";
    if (s.kind === "mirror") return "The mirror";
    return `Door ${s.label}`;
}

export function DoorRail({ stops, current, progress, onGo, hidden = false, peek = null, onAbout, fold = false }: DoorRailProps) {
    const reduced = useReducedMotion();
    // out of the way while the mirror asks (it would run down behind the question on a phone)
    const asking = useTheatreDialogOpen("mirror");
    const p = useProgressValue(progress);
    const ats = useMemo(() => stops.map((s, i) => s.at ?? (stops.length > 1 ? i / (stops.length - 1) : 0)), [stops]);
    const f = useTransform(p, (v) => railFraction(v, ats));
    const emberTop = useTransform(f, (v) => `${(v * 100).toFixed(3)}%`);

    const [tip, setTip] = useState<number | null>(null);
    const [roving, setRoving] = useState<number | null>(null);
    const [unfolded, setUnfolded] = useState(false);
    useEffect(() => setUnfolded(false), [fold]);
    const folded = fold && !unfolded; // (only below md: on a wide screen the rail is always open)
    const nav = useRef<HTMLElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const help = useRef<HTMLButtonElement>(null);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const press = useRef<{ timer: number; long: boolean; hide: number }>({ timer: 0, long: false, hide: 0 });
    useEffect(() => {
        const r = press.current;
        return () => {
            window.clearTimeout(r.timer);
            window.clearTimeout(r.hide);
        };
    }, []);

    const shown = tip ?? peek;
    const tabStop = roving ?? current ?? 0;
    const n = stops.length;

    // Where the title card goes: level with the stop it's about. (It's drawn outside the
    // list, so a list that has to scroll on a short screen doesn't clip it.)
    const [tipY, setTipY] = useState<number | null>(null);
    useIsomorphicLayoutEffect(() => {
        if (shown === null) {
            setTipY(null);
            return;
        }
        const place = () => {
            const b = shown === -1 ? help.current : buttons.current[shown];
            const box = nav.current?.getBoundingClientRect();
            if (!b || !box) return setTipY(null);
            const r = b.getBoundingClientRect();
            setTipY(r.top + r.height / 2 - box.top);
        };
        place();
        const sc = scroller.current;
        sc?.addEventListener("scroll", place, { passive: true });
        return () => sc?.removeEventListener("scroll", place);
    }, [shown, hidden, asking]);

    // On a screen too short for every stop, the list scrolls (inside itself, never the
    // page): keep the stop you're at in view, and fade the edges that run on.
    const reveal = (i: number, smooth = true) => {
        const sc = scroller.current;
        const li = buttons.current[i]?.parentElement;
        if (!sc || !li || sc.scrollHeight <= sc.clientHeight) return;
        const top = li.offsetTop - (sc.clientHeight - li.offsetHeight) / 2;
        sc.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced ? "smooth" : "auto" });
    };
    const [runs, setRuns] = useState({ up: false, down: false });
    const here = useRef(current);
    here.current = current;
    useEffect(() => {
        const sc = scroller.current;
        if (!sc) return;
        const check = () => setRuns({ up: sc.scrollTop > 2, down: sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2 });
        check();
        // the list's room changes with the bar below it: keep your stop in view
        const ro = new ResizeObserver(() => {
            if (here.current !== null) reveal(here.current, false);
            check();
        });
        ro.observe(sc);
        sc.addEventListener("scroll", check, { passive: true });
        return () => {
            ro.disconnect();
            sc.removeEventListener("scroll", check);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hidden, asking]);
    useEffect(() => {
        if (current !== null) reveal(current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, hidden, asking]);

    const move = (e: KeyboardEvent, i: number) => {
        let to = -1;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") to = Math.min(n - 1, i + 1);
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to = Math.max(0, i - 1);
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = n - 1;
        else if (e.key === "Escape") setTip(null);
        if (to < 0) return;
        e.preventDefault();
        setRoving(to);
        buttons.current[to]?.focus({ preventScroll: true });
        reveal(to, false);
    };

    const down = (e: PointerEvent, i: number) => {
        if (e.pointerType === "mouse") return;
        const r = press.current;
        window.clearTimeout(r.timer);
        window.clearTimeout(r.hide);
        r.long = false;
        r.timer = window.setTimeout(() => {
            r.long = true;
            setTip(i);
        }, LONG_PRESS);
    };
    const up = () => {
        const r = press.current;
        window.clearTimeout(r.timer);
        if (r.long) r.hide = window.setTimeout(() => setTip(null), 2600);
    };

    const tipFor = (i: number) => {
        if (i === -1) return { eyebrow: "The programme", title: "What is this place?" };
        const s = stops[i];
        if (!s) return null;
        return { eyebrow: `${eyebrowOf(s)}${current === i ? " · you are here" : s.opened ? " · you've been in" : ""}`, title: s.title };
    };
    const tipText = shown !== null ? tipFor(shown) : null;
    const fade = `linear-gradient(to bottom, ${runs.up ? "transparent, #000 18px" : "#000, #000"}, ${runs.down ? "#000 calc(100% - 18px), transparent" : "#000, #000"})`;

    return (
        <div className="pointer-events-none fixed right-2 top-[76px] z-30 md:right-4 md:top-[calc(50%_+_32px)] md:-translate-y-1/2">
            <AnimatePresence>
                {!hidden && !asking && (
                    <motion.nav
                        ref={nav}
                        key="rail"
                        aria-label="Map of the corridor"
                        className="pointer-events-auto relative"
                        initial={{ opacity: 0, x: reduced ? 0 : 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: reduced ? 0 : 14 }}
                        transition={{ duration: reduced ? 0.15 : 0.4, ease: "easeOut" }}
                    >
                        <div className="relative flex w-[50px] flex-col items-center rounded-full border border-[#8f7142]/70 bg-[#0e0807]/[0.9] py-[5px] shadow-[0_10px_30px_rgba(0,0,0,0.6),inset_0_0_0_3px_rgba(14,8,7,0.9),inset_0_0_0_4px_rgba(160,124,72,0.22)] backdrop-blur-md">
                            {onAbout && (
                                <>
                                    <button
                                        ref={help}
                                        type="button"
                                        onClick={onAbout}
                                        aria-label="The programme: what is this place?"
                                        onPointerEnter={(e) => e.pointerType === "mouse" && setTip(-1)}
                                        onPointerLeave={() => setTip((t) => (t === -1 ? null : t))}
                                        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setTip(-1)}
                                        onBlur={() => setTip((t) => (t === -1 ? null : t))}
                                        className="group grid h-[44px] w-[44px] shrink-0 place-items-center outline-none [touch-action:manipulation]"
                                    >
                                        <span
                                            aria-hidden
                                            className={`${fellSC.className} grid h-[28px] w-[28px] place-items-center rounded-full text-[17px] leading-none text-[#d9c2a6] transition-colors group-hover:text-[#fff1de] group-focus-visible:ring-2 group-focus-visible:ring-[#ffb36b] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#0e0807]`}
                                        >
                                            ?
                                        </span>
                                    </button>
                                    <span aria-hidden className="mb-[3px] h-px w-5 shrink-0 bg-[#8f7142]/60" />
                                </>
                            )}

                            {folded && (
                                <button
                                    type="button"
                                    aria-label="Show the map of the corridor"
                                    aria-expanded={false}
                                    onClick={() => {
                                        setUnfolded(true);
                                        window.setTimeout(() => buttons.current[current ?? 0]?.focus({ preventScroll: true }), 50);
                                    }}
                                    className="group grid h-[44px] w-[44px] shrink-0 place-items-center outline-none [touch-action:manipulation] md:hidden"
                                >
                                    <span
                                        aria-hidden
                                        className="grid h-[30px] w-[30px] place-items-center rounded-full border border-[#8f7142]/80 bg-[#140b08] text-[#d9c2a6] transition-colors group-hover:border-[#c9a46a] group-hover:text-[#fff1de] group-focus-visible:ring-2 group-focus-visible:ring-[#ffb36b] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#0e0807]"
                                    >
                                        <svg viewBox="0 0 12 18" className="h-[18px] w-[12px]" fill="currentColor">
                                            <rect x="5.5" y="2" width="1" height="14" opacity="0.6" />
                                            <circle cx="6" cy="2.5" r="2" />
                                            <circle cx="6" cy="9" r="2" />
                                            <circle cx="6" cy="15.5" r="2" />
                                        </svg>
                                    </span>
                                </button>
                            )}
                            <div
                                ref={scroller}
                                className={`${folded ? "max-md:hidden" : ""} min-h-[88px] w-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                                    onAbout
                                        ? "max-h-[calc(100dvh_-_242px_-_var(--theatre-bar,0px))] md:max-h-[calc(100dvh_-_160px)]"
                                        : "max-h-[calc(100dvh_-_194px_-_var(--theatre-bar,0px))] md:max-h-[calc(100dvh_-_112px)]"
                                }`}
                                style={runs.up || runs.down ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
                            >
                                <ol onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setRoving(null)} className="relative flex flex-col items-center">
                                    {/* the thread, lit as far as you've walked, and the ember where you are */}
                                    <span aria-hidden className="absolute left-1/2 w-px -translate-x-1/2 bg-[#8f7142]/50" style={{ top: 22, bottom: 22 }}>
                                        <motion.span className="absolute inset-x-[-0.5px] top-0 h-full origin-top bg-[linear-gradient(#ffb36b,#ff6a3d)]" style={{ scaleY: f }} />
                                        <motion.span
                                            className="absolute left-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd9ad] shadow-[0_0_6px_2px_rgba(255,150,80,0.9),0_0_16px_4px_rgba(255,90,40,0.5)]"
                                            style={{ top: emberTop }}
                                        />
                                    </span>

                                    {stops.map((s, i) => {
                                        const here = current === i;
                                        const name = `${eyebrowOf(s)}: ${s.title}${s.opened ? " (you've been in)" : ""}`;
                                        return (
                                            <li key={s.key} className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center">
                                                <button
                                                    ref={(el) => {
                                                        buttons.current[i] = el;
                                                    }}
                                                    type="button"
                                                    tabIndex={i === tabStop ? 0 : -1}
                                                    aria-label={name}
                                                    aria-current={here ? "location" : undefined}
                                                    onClick={() => {
                                                        if (press.current.long) {
                                                            press.current.long = false;
                                                            return;
                                                        }
                                                        onGo(i);
                                                    }}
                                                    onKeyDown={(e) => move(e, i)}
                                                    onPointerDown={(e) => down(e, i)}
                                                    onPointerUp={up}
                                                    onPointerCancel={up}
                                                    onPointerEnter={(e) => e.pointerType === "mouse" && setTip(i)}
                                                    onPointerLeave={(e) => {
                                                        if (e.pointerType === "mouse") setTip((t) => (t === i ? null : t));
                                                        else window.clearTimeout(press.current.timer);
                                                    }}
                                                    onFocus={(e) => {
                                                        setRoving(i);
                                                        if (e.currentTarget.matches(":focus-visible")) setTip(i);
                                                    }}
                                                    onBlur={() => setTip((t) => (t === i ? null : t))}
                                                    onContextMenu={(e) => e.preventDefault()}
                                                    className="group relative grid h-[44px] w-[44px] select-none place-items-center outline-none [-webkit-touch-callout:none] [touch-action:manipulation]"
                                                >
                                                    <span
                                                        aria-hidden
                                                        className={`${fellSC.className} grid h-[30px] w-[30px] place-items-center rounded-full border text-[15px] leading-none transition-[transform,box-shadow,background-color,color,border-color] duration-300 group-focus-visible:ring-2 group-focus-visible:ring-[#ffb36b] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#0e0807] ${
                                                            here
                                                                ? "scale-[1.16] border-[#ffb36b] bg-[#45160c] text-[#fff1de] shadow-[0_0_0_2px_rgba(14,8,7,0.95),0_0_16px_rgba(255,120,60,0.65)]"
                                                                : s.opened
                                                                  ? "border-[#a8854e] bg-[#2a120c] text-[#f1e2cc] group-hover:border-[#d6b27a]"
                                                                  : "border-[#8f7142]/80 bg-[#140b08] text-[#cdb79c] group-hover:border-[#c9a46a] group-hover:text-[#f1e2cc]"
                                                        }`}
                                                    >
                                                        <Glyph stop={s} />
                                                    </span>
                                                    {s.opened && !here && (
                                                        <span aria-hidden className="absolute right-[4px] top-1/2 h-[8px] w-[8px] -translate-y-[15px] rounded-full bg-[#ff8f66] shadow-[0_0_6px_rgba(255,120,60,0.9)] ring-2 ring-[#0e0807]" />
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>
                        </div>
                        <Tip show={!!tipText && tipY !== null} y={tipY ?? 0} reduced={!!reduced} eyebrow={tipText?.eyebrow ?? ""} title={tipText?.title ?? ""} k={shown ?? -2} />
                    </motion.nav>
                )}
            </AnimatePresence>
        </div>
    );
}

// The entrance is a ticket; the mirror an oval glass with a crack. Doors wear their numeral.
function Glyph({ stop }: { stop: RailStop }) {
    if (stop.kind === "entrance")
        return (
            <svg viewBox="0 0 16 12" className="h-[12px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
                <path d="M1 2.2h14v2.3a1.5 1.5 0 0 0 0 3v2.3H1V7.5a1.5 1.5 0 0 0 0-3Z" />
                <path d="M10.5 3v6" strokeDasharray="1 1.2" />
            </svg>
        );
    if (stop.kind === "mirror")
        return (
            <svg viewBox="0 0 12 16" className="h-[16px] w-[12px]" fill="none" stroke="currentColor" strokeWidth="1.3">
                <ellipse cx="6" cy="8" rx="4.6" ry="6.6" />
                <path d="M4.2 3.6 6.6 7.4 5.4 9.2 7.6 12.6" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    return <span className="pt-[1px]">{stop.label}</span>;
}

function Tip({ show, y, reduced, eyebrow, title, k }: { show: boolean; y: number; reduced: boolean; eyebrow: string; title: string; k: number }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key={k}
                    aria-hidden
                    className="pointer-events-none absolute right-[calc(100%+12px)] z-10 w-max max-w-[min(280px,calc(100vw-96px))]"
                    style={{ top: y, y: "-50%" }}
                    initial={{ opacity: 0, x: reduced ? 0 : 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduced ? 0 : 4 }}
                    transition={{ duration: reduced ? 0.1 : 0.2 }}
                >
                    <Playbill corners={false} className="px-4 py-2.5">
                        <p className={ink.eyebrow}>{eyebrow}</p>
                        <p className={`${ink.title} mt-0.5 text-[17px]`}>{title}</p>
                    </Playbill>
                    {/* the point, toward the rail */}
                    <span aria-hidden className="absolute -right-[5px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rotate-45 border-r border-t border-[#8f7142]/75 bg-[#0e0807]" />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
