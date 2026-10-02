'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Neon } from "@/components/v2/theatre-sign";
import { fell, fellSC } from "@/components/v2/theatre-fonts";
import { RoomView } from "@/components/v2/theatre-room";
import { fetchRoom, useOpened, usePlates } from "@/components/v2/theatre-data";
import { theatre, type DoorPlate, type Room } from "@/data/v2/theatre";

// After Steppenwolf: a hidden theatre, reached only by its sign at night. A
// dim corridor under one stuttering lamp, and behind each old door a small
// room. Content lives in data/v2/theatre.ts.

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const NEON = "#ff8f66";

export function MagicTheatre() {
    const router = useRouter();
    const { plates } = usePlates();
    const doors = plates ?? [];
    const [opened, mark] = useOpened();
    const [open, setOpen] = useState<{ door: DoorPlate; room: Room | null; missing?: boolean } | null>(null);
    const [swinging, setSwinging] = useState<string | null>(null);
    const all = doors.length > 0 && doors.every((d) => opened.includes(d.id));

    const enter = (door: DoorPlate) => {
        if (swinging) return;
        setSwinging(door.id);
        mark(door.id);
        const room = fetchRoom(door.id);
        window.setTimeout(() => {
            setOpen({ door, room: null });
            setSwinging(null);
            room.then((d) => setOpen((o) => (o && o.door.id === door.id ? { door, room: d?.room ?? null, missing: !d } : o)));
        }, 900);
    };

    const leave = () => (window.history.length > 1 ? router.back() : router.push("/now"));

    return (
        <div className={fell.className}>
            <Gloom />

            <div className="relative z-10 mx-auto max-w-3xl pb-28 pt-24 text-center sm:pt-32">
                <Marquee />
                <Ticket />
                <p className="mx-auto mt-14 max-w-sm text-[15px] italic leading-relaxed text-[var(--muted)]">
                    {all ? "You have been in every room. Come back some other night." : "Each door opens once you knock. Some of them would rather you didn't."}
                </p>

                <div className="mt-16 grid grid-cols-2 gap-x-5 gap-y-14 sm:grid-cols-3 sm:gap-x-10">
                    {doors.map((door, i) => (
                        <DoorView key={door.id} door={door} n={i} visited={opened.includes(door.id)} swinging={swinging === door.id} onEnter={() => enter(door)} />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={leave}
                    className={`${fellSC.className} mt-24 text-[13px] tracking-[0.35em] text-[var(--muted)] transition-colors hover:text-[var(--ink)]`}
                >
                    Leave the theatre
                </button>
            </div>

            <AnimatePresence>
                {open && <RoomView key={open.door.id} plate={open.door.plate} room={open.room} missing={open.missing} onClose={() => setOpen(null)} />}
            </AnimatePresence>
        </div>
    );
}

/* ------------------------------------------------------------ the room */

// Fog on the floor, one lamp, dust in its light, a heavy vignette and grain.
const DUST = Array.from({ length: 18 }, (_, i) => ({
    left: 28 + ((i * 37) % 44),
    top: (i * 23) % 30,
    size: 1.2 + ((i * 7) % 5) * 0.45,
    dur: 16 + ((i * 11) % 17),
    delay: -((i * 13) % 29),
    dx: `${((i * 17) % 9) - 4}vw`,
}));

function Gloom() {
    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
            {/* a red undertone low down, like light from somewhere you can't see */}
            <div className="absolute inset-x-0 bottom-0 h-[60vh]" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 110%, rgba(120,24,12,0.22), transparent 70%)" }} />
            {/* fog */}
            <div className="v2-fog absolute -left-[25%] bottom-[-15%] h-[55vh] w-[90%] rounded-full bg-[rgba(110,80,72,0.16)] blur-[70px]" />
            <div
                className="v2-fog absolute -right-[20%] bottom-[5%] h-[45vh] w-[80%] rounded-full bg-[rgba(90,64,60,0.14)] blur-[80px]"
                style={{ animationDuration: "63s", animationDirection: "alternate-reverse" }}
            />
            <div className="v2-fog absolute left-[10%] top-[35%] h-[40vh] w-[70%] rounded-full bg-[rgba(70,52,50,0.1)] blur-[90px]" style={{ animationDuration: "77s" }} />
            {/* the lamp, and the dust in its light */}
            <div className="v2-lamp absolute inset-x-0 top-0 h-[85vh]">
                <div
                    className="absolute inset-0"
                    style={{ background: "radial-gradient(ellipse 34% 62% at 50% -6%, rgba(255,186,120,0.2), rgba(255,140,80,0.06) 45%, transparent 72%)" }}
                />
                {DUST.map((d, i) => (
                    <span
                        key={i}
                        className="v2-dust absolute rounded-full bg-[rgba(255,222,186,0.7)]"
                        style={{
                            left: `${d.left}%`,
                            top: `${d.top}%`,
                            width: d.size,
                            height: d.size,
                            animationDuration: `${d.dur}s`,
                            animationDelay: `${d.delay}s`,
                            ["--dx" as string]: d.dx,
                        }}
                    />
                ))}
            </div>
            {/* vignette and grain */}
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 75% 70% at 50% 40%, transparent 35%, rgba(0,0,0,0.88) 100%)" }} />
            <div className="v2-grain absolute -inset-[50%] opacity-[0.07] mix-blend-overlay" />
        </div>
    );
}

/* ---------------------------------------------------------------- hero */

// Bulbs around the marquee: a few dead, a few unsure of themselves.
const DEAD = new Set([3, 9, 17, 24]);
const UNSURE = new Set([1, 7, 13, 20, 26]);

function Marquee() {
    const bulbs = 14;
    return (
        <div className="relative mx-auto w-full max-w-[560px]">
            {/* hanging from two chains */}
            {["left-[14%]", "right-[14%]"].map((side) => (
                <span
                    key={side}
                    className={`absolute -top-24 ${side} h-24 w-[3px]`}
                    style={{ background: "repeating-linear-gradient(to bottom, #3a2e28 0 5px, transparent 5px 7px, #2a201c 7px 12px, transparent 12px 14px)" }}
                />
            ))}
            <div className="relative -rotate-[0.6deg] rounded-[10px] border border-black bg-[#0c0706] px-6 pb-9 pt-10 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95),inset_0_0_0_4px_#1b110e,inset_0_0_0_5px_#2c1d17,inset_0_0_60px_rgba(0,0,0,0.95)] sm:px-12 sm:pb-11 sm:pt-12">
                {/* rust on the frame */}
                <span
                    className="absolute inset-0 rounded-[10px] opacity-60"
                    style={{ background: "radial-gradient(circle at 8% 90%, rgba(130,60,25,0.35), transparent 22%), radial-gradient(circle at 93% 12%, rgba(120,55,20,0.3), transparent 18%)" }}
                />
                {[0, 1].map((row) => (
                    <div key={row} className={`absolute inset-x-5 flex justify-between ${row ? "bottom-[10px]" : "top-[10px]"}`}>
                        {Array.from({ length: bulbs }, (_, i) => {
                            const k = row * bulbs + i;
                            const dead = DEAD.has(k);
                            return (
                                <span
                                    key={i}
                                    className={`h-[7px] w-[7px] rounded-full ${!dead && UNSURE.has(k) ? "v2-neon" : ""}`}
                                    style={
                                        dead
                                            ? { background: "#2a1d18", boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.6)" }
                                            : {
                                                  background: "radial-gradient(circle at 40% 35%, #fff3d6, #ffc27a 60%, #c46a2a)",
                                                  boxShadow: "0 0 6px 1px rgba(255,170,90,0.7)",
                                                  animationDuration: `${2.6 + (k % 5) * 0.7}s`,
                                              }
                                    }
                                />
                            );
                        })}
                    </div>
                ))}
                <h1>
                    <Neon
                        text={theatre.sign.toUpperCase()}
                        dead={10}
                        className={`${fellSC.className} block text-[28px] leading-none tracking-[0.26em] sm:text-[46px] sm:tracking-[0.3em]`}
                    />
                </h1>
                <p className={`${fellSC.className} mt-5 text-[11px] tracking-[0.4em] text-[#8a7766] sm:text-[13px]`}>{theatre.entrance}</p>
            </div>
        </div>
    );
}

export function Ticket() {
    const [madmen, price] = theatre.admission.split(". ");
    return (
        <div className="relative mx-auto mt-14 w-[290px] -rotate-[3deg] sm:w-[360px]">
            <div
                className="relative flex overflow-hidden text-left text-[#2b1a10] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.9)]"
                style={{
                    background: "linear-gradient(105deg, #c8b088, #d8c49e 40%, #c2a77a)",
                    // a torn left edge
                    clipPath:
                        "polygon(3% 0, 100% 0, 100% 100%, 2% 100%, 0 92%, 2.5% 84%, 0.5% 75%, 3% 66%, 1% 57%, 3.5% 48%, 0.5% 39%, 2.5% 30%, 0 21%, 2% 12%, 0.5% 5%)",
                }}
            >
                {/* age: grain, stains, burnt edges */}
                <span className="v2-grain pointer-events-none absolute -inset-[50%] opacity-[0.35] mix-blend-multiply" style={{ animation: "none" }} />
                <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(90,45,12,0.6)]" />
                <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full border-[3px] border-[rgba(110,60,20,0.22)]" />

                <div className="relative flex-1 py-5 pl-7 pr-4">
                    <p className={`${fellSC.className} text-[11px] tracking-[0.4em] opacity-80`}>Admit one</p>
                    <div className="my-2 h-[3px] border-y border-[#2b1a10]/40" />
                    <p className="text-[24px] italic leading-tight sm:text-[27px]">{madmen}.</p>
                    <p className="mt-1 text-[14px] opacity-85 sm:text-[15px]">{price}</p>
                    <p className={`${fellSC.className} mt-3 text-[10px] tracking-[0.3em] opacity-60`}>No. 1927</p>
                </div>
                {/* the stub, past the perforation */}
                <div className="relative w-[64px] border-l-2 border-dashed border-[#2b1a10]/35 sm:w-[76px]">
                    <p
                        className={`${fellSC.className} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] tracking-[0.35em] opacity-70`}
                    >
                        Magic theatre
                    </p>
                </div>
                {/* a faded red PAID stamp */}
                <span
                    className={`${fellSC.className} pointer-events-none absolute right-[22%] top-3 rotate-[14deg] rounded-sm border-2 border-[#9e2318] px-2 text-[15px] tracking-[0.25em] text-[#9e2318] opacity-55 mix-blend-multiply`}
                    style={{
                        WebkitMaskImage: "radial-gradient(circle at 30% 40%, #000 40%, rgba(0,0,0,0.45) 70%)",
                        maskImage: "radial-gradient(circle at 30% 40%, #000 40%, rgba(0,0,0,0.45) 70%)",
                    }}
                >
                    Paid
                </span>
            </div>
        </div>
    );
}

/* --------------------------------------------------------------- doors */

// Each door is a little different: where the iron bands sit, whether it has a
// knocker or a broken corner, how crooked its plaque hangs.
const VARIANTS = [
    { bands: [96, 182], knocker: true, chip: null, tilt: -3, cracks: ["M30 118 L33 127 L30.5 134 L34 146 L32 152", "M78 168 L74 174 L76 181"] },
    { bands: [104, 176], knocker: false, chip: "br", tilt: 2, cracks: ["M52 84 L55 92 L53 99", "M86 120 L83 131 L86 139 L84 147"] },
    { bands: [92, 186], knocker: false, chip: null, tilt: 0.5, cracks: ["M24 150 L28 158 L25 167 L29 175", "M64 130 L61 136"] },
    { bands: [100, 180], knocker: true, chip: "bl", tilt: -1.5, cracks: ["M90 96 L87 104 L90 112", "M40 186 L44 195 L41 203"] },
    { bands: [98, 184], knocker: false, chip: null, tilt: 7, cracks: ["M35 92 L31 101 L34 109 L31 118", "M70 150 L74 160"] },
    { bands: [106, 178], knocker: true, chip: "br", tilt: -2, cracks: ["M58 146 L61 154 L58 161 L62 170", "M28 104 L32 110"] },
] as const;
type Variant = (typeof VARIANTS)[number];

const LEAF = "M15.5 212.5 L15.5 74 A44.5 44.5 0 0 1 104.5 74 L104.5 212.5 Z";
const OPENING = "M14 214 L14 74 A46 46 0 0 1 106 74 L106 214 Z";
const STONE = "M2 218 L2 66 A58 58 0 0 1 118 66 L118 218 Z";
const CHIPS = {
    br: "104.5,196 98,201 101.5,205 96,212.5 104.5,212.5",
    bl: "15.5,194 21,199 18,204 23,212.5 15.5,212.5",
};
const KEYHOLE = "M89.25 145.2 m-2.2 0 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 M88.2 146.4 L87.4 153.4 L91.1 153.4 L90.3 146.4 Z";

function DoorView({ door, n, visited, swinging, onEnter }: { door: DoorPlate; n: number; visited: boolean; swinging: boolean; onEnter: () => void }) {
    const [hover, setHover] = useState(false);
    const v = VARIANTS[n % VARIANTS.length];
    const angle = swinging ? -112 : hover ? -15 : visited ? -7 : 0;
    const light = swinging ? 1 : hover ? 0.9 : visited ? 0.65 : 0.38;

    return (
        <div className="flex flex-col items-center">
            <Plaque n={n} text={door.plate} tilt={v.tilt} lit={visited || hover} />

            <button
                type="button"
                onClick={onEnter}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onFocus={() => setHover(true)}
                onBlur={() => setHover(false)}
                aria-label={`Door ${ROMAN[n]}: ${door.plate}`}
                className="relative mt-5 aspect-[6/11] w-full max-w-[168px] outline-none [perspective:900px] focus-visible:drop-shadow-[0_0_10px_rgba(255,140,90,0.6)]"
            >
                {/* stone surround, and the light inside */}
                <svg viewBox="0 0 120 220" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                    <defs>
                        <filter id={`rough-${n}`} x="-5%" y="-5%" width="110%" height="110%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={n + 3} />
                            <feDisplacementMap in="SourceGraphic" scale="5" />
                        </filter>
                        <radialGradient id={`inner-${n}`} cx="50%" cy="72%" r="70%">
                            <stop offset="0" stopColor="#ffe2ad" />
                            <stop offset="0.4" stopColor="#ff9e5a" />
                            <stop offset="1" stopColor="#5a1a0c" />
                        </radialGradient>
                        <linearGradient id={`stone-${n}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#231c18" />
                            <stop offset="1" stopColor="#120d0b" />
                        </linearGradient>
                    </defs>
                    <ellipse cx="60" cy="219" rx="62" ry="5" fill="rgba(0,0,0,0.6)" />
                    <path d={STONE} fill={`url(#stone-${n})`} filter={`url(#rough-${n})`} />
                    <g stroke="#0a0706" strokeWidth="1.1" opacity="0.8" filter={`url(#rough-${n})`}>
                        {/* stone blocks: around the arch, then down the jambs */}
                        {[-60, -35, -12, 12, 35, 60].map((a) => {
                            const r = (a * Math.PI) / 180;
                            return <line key={a} x1={60 + Math.sin(r) * 46} y1={74 - Math.cos(r) * 46} x2={60 + Math.sin(r) * 58} y2={66 - Math.cos(r) * 58} />;
                        })}
                        {[100, 134, 168, 200].map((y) => (
                            <g key={y}>
                                <line x1="2" y1={y} x2="14" y2={y} />
                                <line x1="106" y1={y + 9} x2="118" y2={y + 9} />
                            </g>
                        ))}
                    </g>
                    <motion.g initial={false} animate={{ opacity: light }} transition={{ duration: 0.5 }}>
                        <path d={OPENING} fill={`url(#inner-${n})`} />
                        <path d={OPENING} fill="none" stroke="#ffb06a" strokeWidth="2" opacity="0.6" style={{ filter: "blur(2px)" }} />
                        <rect x="12" y="212" width="96" height="5" rx="2" fill="#ffd29a" style={{ filter: "blur(2.5px)" }} />
                    </motion.g>
                </svg>

                {/* the door, hinged on its left edge */}
                <motion.div
                    className="absolute inset-0 [transform-style:preserve-3d]"
                    style={{ originX: 0.13 }}
                    initial={false}
                    animate={{ rotateY: angle }}
                    transition={swinging ? { type: "spring", stiffness: 40, damping: 12 } : { type: "spring", stiffness: 110, damping: 15 }}
                >
                    <DoorLeaf n={n} v={v} light={light} />
                </motion.div>
            </button>
        </div>
    );
}

function DoorLeaf({ n, v, light }: { n: number; v: Variant; light: number }) {
    const id = (s: string) => `${s}-${n}`;
    return (
        <svg viewBox="0 0 120 220" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
                <linearGradient id={id("wood")} x1="0" y1="0" x2="1" y2="0.3">
                    <stop offset="0" stopColor="#2c1e17" />
                    <stop offset="0.5" stopColor="#231710" />
                    <stop offset="1" stopColor="#170f0a" />
                </linearGradient>
                <linearGradient id={id("iron")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4a3f39" />
                    <stop offset="0.5" stopColor="#2e2622" />
                    <stop offset="1" stopColor="#1b1513" />
                </linearGradient>
                <linearGradient id={id("rust")} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="rgba(118,50,18,0.6)" />
                    <stop offset="0.6" stopColor="rgba(96,40,14,0.25)" />
                    <stop offset="1" stopColor="rgba(96,40,14,0)" />
                </linearGradient>
                <filter id={id("leafrough")} x="-5%" y="-5%" width="110%" height="110%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed={n + 11} />
                    <feDisplacementMap in="SourceGraphic" scale="3.2" />
                </filter>
                <filter id={id("grime")}>
                    <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={n + 21} />
                    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05" />
                </filter>
                <filter id={id("glow")} x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="2.4" />
                </filter>
                <clipPath id={id("clip")}>
                    <path d={LEAF} />
                </clipPath>
            </defs>

            <g filter={`url(#${id("leafrough")})`}>
                <path d={LEAF} fill={`url(#${id("wood")})`} />
                <g clipPath={`url(#${id("clip")})`}>
                    {/* planks and their grain */}
                    {[37.75, 60, 82.25].map((x) => (
                        <line key={x} x1={x} y1="20" x2={x} y2="214" stroke="#0b0705" strokeWidth="1.2" />
                    ))}
                    {[26, 48, 71, 93].map((x, i) => (
                        <path
                            key={x}
                            d={`M${x} 30 C ${x + 3} 80, ${x - 3} 130, ${x + 2} 214 M${x + 5} 40 C ${x + 7} 100, ${x + 3} 150, ${x + 6} 214`}
                            stroke="rgba(0,0,0,0.28)"
                            strokeWidth="0.45"
                            fill="none"
                            opacity={0.6 + (i % 2) * 0.3}
                        />
                    ))}
                    {/* iron bands with rivets, rust bleeding down the wood */}
                    {v.bands.map((y) => (
                        <g key={y}>
                            {[23, 31, 47, 58, 72, 86, 95].map((x, i) => {
                                const len = 5 + ((x * 7 + y) % 19);
                                const w = 0.7 + ((x + i) % 3) * 0.55;
                                // a drip: wider where it leaves the iron, wandering a little on the way down
                                return (
                                    <path
                                        key={x}
                                        d={`M${x} ${y + 7} q ${w} ${len * 0.4} ${(i % 2 ? 0.6 : -0.6)} ${len} l ${-w * 0.6} 0 q ${-w * 0.2} ${-len * 0.6} ${-w * 0.9} ${-len} Z`}
                                        fill={`url(#${id("rust")})`}
                                        opacity={0.55 + (i % 3) * 0.15}
                                    />
                                );
                            })}
                            <rect x="14" y={y} width="92" height="7.5" fill={`url(#${id("iron")})`} />
                            <rect x="14" y={y} width="92" height="7.5" fill="rgba(140,62,24,0.35)" style={{ mixBlendMode: "multiply" }} />
                            {[21, 37.75, 60, 82.25, 99].map((x) => (
                                <g key={x}>
                                    <circle cx={x} cy={y + 3.75} r="1.7" fill="#3d332e" />
                                    <circle cx={x - 0.5} cy={y + 3.2} r="0.6" fill="rgba(255,220,190,0.25)" />
                                </g>
                            ))}
                        </g>
                    ))}
                    {/* cracks */}
                    {v.cracks.map((d) => (
                        <g key={d}>
                            <path d={d} stroke="#050302" strokeWidth="0.9" fill="none" strokeLinejoin="bevel" />
                            <path d={d} stroke="rgba(255,190,140,0.08)" strokeWidth="0.5" fill="none" transform="translate(0.6 0.3)" />
                        </g>
                    ))}
                    {/* grime over everything, darker at the edges */}
                    <rect x="0" y="0" width="120" height="220" filter={`url(#${id("grime")})`} opacity="0.5" />
                    <path d={LEAF} fill="none" stroke="rgba(0,0,0,0.75)" strokeWidth="5" />
                </g>
            </g>

            {/* a broken corner, the room's light showing through */}
            {v.chip && (
                <g>
                    <polygon points={CHIPS[v.chip]} fill="#ffb873" opacity={0.35 + light * 0.6} />
                    <polygon points={CHIPS[v.chip]} fill="#ffb873" opacity={light * 0.7} filter={`url(#${id("glow")})`} />
                </g>
            )}

            {/* a ring knocker */}
            {v.knocker && (
                <g>
                    <circle cx="60" cy="122" r="3.4" fill="#2f2622" stroke="#4a3d36" strokeWidth="0.6" />
                    <circle cx="60" cy="131" r="8.5" fill="none" stroke="#3a2f2a" strokeWidth="2.6" />
                    <circle cx="60" cy="131" r="8.5" fill="none" stroke="rgba(150,70,30,0.45)" strokeWidth="1.1" strokeDasharray="4 6" />
                </g>
            )}

            {/* keyhole, glowing from the room behind */}
            <rect x="84" y="140" width="10.5" height="19" rx="2.5" fill="#2a221e" stroke="#463a33" strokeWidth="0.6" />
            <circle cx="86" cy="142.5" r="0.7" fill="#5a4c44" />
            <circle cx="92.5" cy="156.5" r="0.7" fill="#5a4c44" />
            <path d={KEYHOLE} fill="#ffc98a" opacity={0.45 + light * 0.55} />
            <path d={KEYHOLE} fill="#ff9d55" opacity={light} filter={`url(#${id("glow")})`} />
        </svg>
    );
}

// Tarnished brass, engraved, hung a little crooked.
function Plaque({ n, text, tilt, lit }: { n: number; text: string; tilt: number; lit: boolean }) {
    return (
        <div className="flex min-h-[5.6rem] items-end">
            <div
                className="relative max-w-[11.5rem] rounded-[2px] px-4 pb-2 pt-1.5 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.9)] transition-[filter] duration-700"
                style={{
                    transform: `rotate(${tilt}deg)`,
                    transformOrigin: tilt > 5 ? "10% 20%" : "50% 0",
                    background: "linear-gradient(170deg, #8f7142 0%, #5d4423 40%, #77592f 70%, #4c371b 100%)",
                    filter: lit ? "brightness(1.15)" : "brightness(0.8)",
                }}
            >
                {/* tarnish */}
                <span
                    className="pointer-events-none absolute inset-0 rounded-[2px]"
                    style={{ background: "radial-gradient(circle at 20% 80%, rgba(30,55,40,0.45), transparent 40%), radial-gradient(circle at 85% 25%, rgba(30,50,40,0.35), transparent 35%)" }}
                />
                <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#2f2416] shadow-[inset_0_0.5px_0_rgba(255,230,180,0.3)]" />
                <span className="absolute right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#2f2416] shadow-[inset_0_0.5px_0_rgba(255,230,180,0.3)]" />
                <span className={`${fellSC.className} relative block text-[11px] tracking-[0.35em] text-[#24170a] [text-shadow:0_1px_0_rgba(255,226,170,0.35)]`}>{ROMAN[n]}</span>
                <span className={`${fellSC.className} relative block text-[13px] leading-snug text-[#24170a] [text-shadow:0_1px_0_rgba(255,226,170,0.35)] sm:text-[14px]`}>{text}</span>
            </div>
        </div>
    );
}
