'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { track } from "@/lib/analytics";

// The 404 page. My wizard cat stays exactly as drawn, staring into his crystal
// ball; the magic happens around him. Tap the ball and he summons every page of
// the site but the one you wanted. They flutter down like leaves; catch one
// and it lands beside him as a way out.

// The glass of the crystal ball, in % of the cat image (368×276).
const BALL = { left: "59.5%", top: "51.4%", width: "27.2%" };

const pick = <T,>(xs: readonly T[], n: number) => [...xs].sort(() => Math.random() - 0.5).slice(0, n);

export function LostCat() {
    return (
        <MotionConfig reducedMotion="user">
            <div className="mx-auto flex max-w-2xl flex-col items-center pb-24 pt-10 text-center sm:pt-16">
                <RainingPages />
            </div>
        </MotionConfig>
    );
}

/* ------------------------------------------------------------ shared */

function Cat({
    onBall,
    ballLabel,
    boxRef,
    children,
}: {
    onBall?: () => void;
    ballLabel?: string;
    boxRef?: React.Ref<HTMLDivElement>;
    children?: React.ReactNode;
}) {
    return (
        <div ref={boxRef} className="relative w-[260px] sm:w-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/cat.png" alt="My wizard cat, staring into his crystal ball" draggable={false} className="relative block w-full select-none" />
            {children}
            {onBall && (
                <button
                    type="button"
                    onClick={onBall}
                    aria-label={ballLabel}
                    className="absolute aspect-square cursor-pointer rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    style={BALL}
                />
            )}
        </div>
    );
}

function Line({ text }: { text: string }) {
    return (
        <AnimatePresence mode="wait">
            <motion.p
                key={text}
                className="mt-3 max-w-md text-[17px] leading-relaxed text-[var(--muted)] transition-colors duration-700"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
            >
                {text}
            </motion.p>
        </AnimatePresence>
    );
}

const PRIMARY =
    "rounded-full bg-[var(--ink)] px-5 py-2.5 text-[15px] font-medium text-[var(--bg)] transition-[transform,background-color,color] duration-300 hover:scale-[1.03] active:scale-[0.98]";

function Actions({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-8 flex items-center gap-5 text-[15px]">
            {children}
            <Link href="/" className="v2-link text-[var(--muted)] transition-colors duration-700 hover:text-[var(--ink)]">
                Back home
            </Link>
        </div>
    );
}

function Title() {
    return <h1 className="v2-display mt-8 text-[2.5rem] leading-tight text-[var(--ink)] transition-colors duration-700">Nothing here.</h1>;
}

/* ------------------------------------------------ raining pages */

// Real pages of this site, screenshotted. Every page he summons is one of
// these, and catching one tells you where it goes.
const SHOTS = [
    { id: "work", href: "/?lens=work", quip: "The work side. Tidy, a bit serious." },
    { id: "life", href: "/?lens=life", quip: "The life side. Much more cat-friendly." },
    { id: "photos", href: "/photos", quip: "The photos. Lovely, but not yours." },
    { id: "sky", href: "/sky", quip: "The night sky. He approves." },
    { id: "notes", href: "/notes", quip: "Some notes. Half-baked on purpose." },
    { id: "journey", href: "/journey", quip: "The journey. It's a long story." },
    { id: "now", href: "/now", quip: "What I'm up to now. Not your page, though." },
    { id: "projects", href: "/projects", quip: "Projects. All nineteen of them." },
] as const;
type Shot = (typeof SHOTS)[number];
const shotSrc = (s: Shot) => `/images/404/${s.id}.webp`;
const RATIO = 395 / 300;

// One falling page, simulated like a leaf: it swings on a pendulum, hanging at
// the ends of each swing and dropping fastest through the middle, leans into
// the direction it's gliding, pitches back as it catches air, and some tumble.
type Flake = {
    id: number;
    shot: Shot;
    w: number;
    x: number;
    y: number;
    phase: number;
    omega: number;
    amp: number;
    fall: number;
    tilt: number;
    spin: number;
    spinSpeed: number;
    windK: number;
    wait: number;
    rz: number;
};

type Catch = { id: number; shot: Shot; boxW: number; from: { x: number; y: number; w: number; h: number; rz: number } };

function RainingPages() {
    const flakes = useRef(new Map<number, Flake>());
    const els = useRef(new Map<number, HTMLButtonElement>());
    const cat = useRef<HTMLDivElement>(null);
    const raf = useRef(0);
    const [ids, setIds] = useState<number[]>([]);
    const [caught, setCaught] = useState<Catch | null>(null);
    const [summoned, setSummoned] = useState(false);
    const [line, setLine] = useState("Even my magic cat couldn't find this page. Maybe he can summon it?");

    useEffect(() => {
        track("page_not_found");
    }, []);

    // Warm the images so the first pages don't fall blank.
    useEffect(() => {
        SHOTS.forEach((s) => {
            const img = new Image();
            img.src = shotSrc(s);
        });
        return () => cancelAnimationFrame(raf.current);
    }, []);

    const loop = useCallback(() => {
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const wind = 22 * Math.sin(now / 1700) + 10 * Math.sin(now / 640 + 1.3);
            const gone: number[] = [];
            flakes.current.forEach((f) => {
                const el = els.current.get(f.id);
                if (!el) return;
                if (f.wait > 0) {
                    f.wait -= dt;
                    return;
                }
                f.phase += f.omega * dt;
                const swing = Math.sin(f.phase);
                const glide = Math.cos(f.phase);
                f.y += f.fall * (0.4 + 0.8 * Math.abs(glide)) * dt;
                f.x += wind * f.windK * dt;
                f.spin += f.spinSpeed * dt;
                const x = f.x + f.amp * swing;
                const y = f.y - f.amp * 0.22 * swing * swing; // rises a little at the ends, like a pendulum
                f.rz = f.tilt * glide;
                const rx = 28 + 24 * Math.sin(f.phase * 2 + 1);
                const ry = 16 * Math.sin(f.phase + 0.6) + f.spin;
                const light = 0.82 + 0.18 * Math.abs(Math.cos((ry * Math.PI) / 180)) * Math.cos((rx * Math.PI) / 360);
                el.style.transform = `translate3d(${x}px, ${y}px, 0) rotateZ(${f.rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
                el.style.filter = `brightness(${light.toFixed(3)})`;
                el.style.opacity = "1";
                if (f.y > window.innerHeight + 140) gone.push(f.id);
            });
            if (gone.length) {
                gone.forEach((id) => flakes.current.delete(id));
                setIds((xs) => xs.filter((x) => !gone.includes(x)));
            }
            if (flakes.current.size) raf.current = requestAnimationFrame(tick);
            else raf.current = 0;
        };
        if (!raf.current) raf.current = requestAnimationFrame(tick);
    }, []);

    const summon = () => {
        track("lost_cat_summon");
        const vw = window.innerWidth;
        const deck = pick(SHOTS, SHOTS.length);
        const base = performance.now();
        const made: number[] = [];
        for (let k = 0; k < 12; k++) {
            const id = base + k;
            const tumble = Math.random() < 0.3;
            flakes.current.set(id, {
                id,
                shot: deck[k % deck.length],
                w: 48 + Math.random() * 20,
                x: -30 + Math.random() * (vw + 20),
                y: -140 - Math.random() * 40,
                phase: Math.random() * Math.PI * 2,
                omega: 1.5 + Math.random() * 1.1,
                amp: 24 + Math.random() * 40,
                fall: 85 + Math.random() * 55,
                tilt: 22 + Math.random() * 20,
                spin: 0,
                spinSpeed: tumble ? (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 110) : 0,
                windK: 0.6 + Math.random() * 0.8,
                wait: Math.random() * 1.8,
                rz: 0,
            });
            made.push(id);
        }
        setIds((xs) => [...xs, ...made]);
        setSummoned(true);
        setLine("He summoned every page but yours. Catch one?");
        requestAnimationFrame(loop);
    };

    const catchFlake = (id: number) => {
        const f = flakes.current.get(id);
        const el = els.current.get(id);
        const box = cat.current?.getBoundingClientRect();
        if (!f || !el || !box) return;
        const r = el.getBoundingClientRect();
        flakes.current.delete(id);
        setIds((xs) => xs.filter((x) => x !== id));
        // Where it was, relative to the cat, so it can fly to its spot beside him.
        setCaught({ id, shot: f.shot, boxW: box.width, from: { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height, rz: f.rz } });
        setLine(`${f.shot.quip} Tap it to go there, or catch another.`);
        track("lost_cat_catch", { label: f.shot.href });
    };

    return (
        <>
            {/* the rain */}
            <div className="pointer-events-none fixed inset-0 z-[30] overflow-hidden [perspective:900px]">
                {ids.map((id) => {
                    const f = flakes.current.get(id);
                    if (!f) return null;
                    return (
                        <button
                            key={id}
                            ref={(el) => {
                                if (el) els.current.set(id, el);
                                else els.current.delete(id);
                            }}
                            type="button"
                            aria-label={`Catch this page (${f.shot.id})`}
                            onPointerDown={() => catchFlake(id)}
                            className="pointer-events-auto absolute left-0 top-0 cursor-grab opacity-0 [-webkit-tap-highlight-color:transparent] [transform-style:preserve-3d]"
                            style={{ width: f.w, height: f.w * RATIO, transform: `translate3d(${f.x}px, ${f.y}px, 0)` }}
                        >
                            <PageFace shot={f.shot} />
                            <PageBack />
                        </button>
                    );
                })}
            </div>

            <div className="relative z-[2] flex flex-col items-center">
                <Cat onBall={summon} ballLabel="Summon the page" boxRef={cat}>
                    <motion.span
                        className="pointer-events-none absolute aspect-square rounded-full mix-blend-screen"
                        style={{ ...BALL, background: "radial-gradient(circle, rgba(255,215,140,1), rgba(255,150,60,0.5) 45%, transparent 70%)" }}
                        initial={false}
                        animate={ids.length ? { opacity: [0.3, 0.9, 0.3] } : { opacity: 0 }}
                        transition={ids.length ? { duration: 1.2, repeat: Infinity } : { duration: 0.6 }}
                    />
                    <AnimatePresence>{caught && <CaughtPage key={caught.id} c={caught} />}</AnimatePresence>
                </Cat>
                <Title />
                <Line text={line} />
                <Actions>
                    <button type="button" onClick={summon} className={PRIMARY}>
                        {summoned ? "Summon more" : "Summon your page"}
                    </button>
                </Actions>
            </div>
        </>
    );
}

function PageFace({ shot }: { shot: Shot }) {
    return (
        <span className="absolute inset-0 overflow-hidden rounded-[3px] bg-white shadow-[0_8px_18px_-8px_rgba(14,28,51,0.5)] ring-1 ring-black/5 [backface-visibility:hidden]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shotSrc(shot)} alt="" draggable={false} className="h-full w-full select-none object-cover" />
        </span>
    );
}

// The back of a page: plain paper, seen when one tumbles over.
function PageBack() {
    return (
        <span className="absolute inset-0 rounded-[3px] bg-[#f1ede3] shadow-[0_8px_18px_-8px_rgba(14,28,51,0.5)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="absolute inset-x-[16%] top-[20%] space-y-[10%]">
                {[80, 95, 70, 90].map((w, k) => (
                    <span key={k} className="block h-[2px] rounded-full bg-black/[0.06]" style={{ width: `${w}%` }} />
                ))}
            </span>
        </span>
    );
}

// A caught page flies to a spot beside the cat (or, on narrow screens, the
// empty corner above his crystal ball) and becomes a link to that page.
function CaughtPage({ c }: { c: Catch }) {
    const [slot] = useState(() => {
        const wide = window.innerWidth >= 640;
        const w = wide ? 150 : 92;
        const h = w * RATIO;
        return wide ? { x: -w - 34, y: 6, w, h, rz: -6 } : { x: c.boxW - w + 6, y: -h * 0.3, w, h, rz: 7 };
    });
    return (
        <motion.div
            className="absolute left-0 top-0 z-10"
            initial={{ x: c.from.x, y: c.from.y, width: c.from.w, height: c.from.h, rotate: c.from.rz }}
            animate={{ x: slot.x, y: slot.y, width: slot.w, height: slot.h, rotate: slot.rz }}
            exit={{ opacity: 0, y: slot.y + 40, rotate: slot.rz + 20, transition: { duration: 0.4, ease: "easeIn" } }}
            transition={{ type: "spring", stiffness: 140, damping: 17 }}
        >
            <Link href={c.shot.href} aria-label={`Go to ${c.shot.href}`} className="group block h-full w-full">
                <span className="absolute inset-0 overflow-hidden rounded-[4px] bg-white shadow-[0_18px_36px_-14px_rgba(14,28,51,0.55)] ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shotSrc(c.shot)} alt={`A page of this site: ${c.shot.href}`} className="h-full w-full object-cover" />
                </span>
                <span className="absolute -bottom-6 left-0 right-0 whitespace-nowrap text-center font-mono text-[11px] text-[var(--muted)]">{c.shot.href.replace("/?lens=", "/")} →</span>
            </Link>
        </motion.div>
    );
}
