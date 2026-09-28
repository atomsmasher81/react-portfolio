'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { LocalTime, Prose, Reveal, SectionTitle, StaggerText } from "@/components/v2/motion";
import { NIGHT, NIGHT_VARS, SkyTeaser } from "@/components/v2/sky";
import { OnLoop } from "@/components/v2/on-loop";
import { ReadingPhoto } from "@/components/v2/reading-photo";
import { ReadThisFar } from "@/components/v2/read-this-far";
import type { NowEntry } from "@/data/v2/now";

export interface LifeHomeProps {
    firstName: string;
    timeZone: string;
    lines: string[];
    interests: string;
    aside: string;
    photos: { id: string; src: string; title: string; place: string }[];
    now: Pick<NowEntry, "updated" | "paragraphs" | "reading" | "listening">;
    journey: string;
    notes: { slug: string; title: string; excerpt: string }[];
}

export function LifeHome(props: LifeHomeProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const background = useLifeSky(rootRef);

    return (
        <div ref={rootRef} className="relative mx-auto max-w-2xl">
            <div
                aria-hidden
                className="pointer-events-none absolute -bottom-48 left-1/2 top-0 -z-10 w-screen -translate-x-1/2"
                style={{ background }}
            />
            <Hero {...props} />
            <div className="space-y-24">
                <TheseDays now={props.now} />
                <Journey text={props.journey} />
                <Notes notes={props.notes} />
                <PhotoStack photos={props.photos} />
                <div>
                    <SkyTeaser href="/sky" />
                    <div style={NIGHT_VARS} className="pt-4">
                        <ReadThisFar />
                    </div>
                </div>
            </div>
        </div>
    );
}

// The whole life page is one sky: it starts as day, deepens very slowly as you
// scroll, turns to dusk just before the last section and is full night by the
// time you reach it. The footer carries the night on (see Shell).
const DAY = [233, 240, 250]; // --bg on the life side
const TINT = [214, 225, 244];
const DUSK = [[214, 225, 244], [169, 187, 230], [91, 119, 207], [36, 58, 138], [15, 26, 69], [7, 11, 31]];

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const rgb = (c: number[]) => `rgb(${c.join(",")})`;
function along(palette: number[][], t: number) {
    const x = Math.min(0.9999, Math.max(0, t)) * (palette.length - 1);
    const i = Math.floor(x);
    return lerp(palette[i], palette[i + 1], x - i);
}

function useLifeSky(rootRef: React.RefObject<HTMLDivElement>) {
    const [background, setBackground] = useState<string>();

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const measure = () => {
            const band = root.querySelector<HTMLElement>("[data-sky-band]");
            if (!band) return;
            const bandTop = band.getBoundingClientRect().top - root.getBoundingClientRect().top;
            const duskStart = Math.max(0, bandTop - 460);
            const nightAt = bandTop + 260;
            const stops: string[] = [];
            // Day to a faint tint, very slowly, over everything above the dusk.
            for (let i = 0; i <= 8; i++) {
                const t = i / 8;
                stops.push(`${rgb(lerp(DAY, TINT, smooth(t)))} ${Math.round(duskStart * t)}px`);
            }
            // Tint to night, eased, across the last stretch before the sky section.
            for (let i = 1; i <= 16; i++) {
                const t = i / 16;
                stops.push(`${rgb(along(DUSK, smooth(t)))} ${Math.round(duskStart + (nightAt - duskStart) * t)}px`);
            }
            stops.push(`${NIGHT} 100%`);
            setBackground(`linear-gradient(to bottom, ${stops.join(", ")})`);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        return () => ro.disconnect();
    }, [rootRef]);

    return background;
}

function Avatar() {
    const [waving, setWaving] = useState(false);
    return (
        <span
            className="relative mx-[0.08em] inline-block h-[0.82em] w-[0.82em] translate-y-[0.08em] align-baseline"
            onMouseEnter={() => setWaving(true)}
            onMouseLeave={() => setWaving(false)}
        >
            <Image src="/img/img.png" alt="" fill sizes="64px" className="rounded-full object-cover ring-2 ring-[var(--card)]" priority />
            <motion.span
                aria-hidden
                className="absolute -right-[0.25em] -top-[0.2em] origin-[70%_70%] text-[0.42em]"
                initial={false}
                animate={waving ? { opacity: 1, scale: 1, rotate: [0, 18, -8, 18, -4, 12, 0] } : { opacity: 0, scale: 0.4, rotate: 0 }}
                transition={waving ? { duration: 1.1 } : { duration: 0.2 }}
            >
                👋
            </motion.span>
        </span>
    );
}

function Hero({ firstName, timeZone, lines, interests, aside }: LifeHomeProps) {
    return (
        <section className="pb-20 pt-14 sm:pt-24">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="v2-eyebrow">
                It&apos;s <LocalTime timeZone={timeZone} /> where I am
            </motion.p>
            <h1 className="v2-display mt-5 whitespace-nowrap text-[2.5rem] min-[400px]:text-[2.8rem] sm:text-[4.5rem]">
                <StaggerText parts={["Hi, I'm", " ", <Avatar key="avatar" />, " ", `${firstName}.`]} />
            </h1>
            <p className="mt-6 text-[1.45rem] leading-snug tracking-tight text-[var(--muted)] sm:text-[1.7rem]">
                {lines.map((line, i) => (
                    <motion.span
                        key={line}
                        className="block"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {line}
                    </motion.span>
                ))}
            </p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.8 }}>
                <Prose text={interests} className="mt-8 text-[17px] leading-relaxed text-[var(--muted)]" />
                <p className="mt-4 text-[15px] text-[var(--muted)]">{aside}</p>
            </motion.div>
        </section>
    );
}

// A loose pile of prints. Hover to fan them out, drag one around, tap to open it.
// x is a percentage of a print's own width, y is in pixels.
const PILE = [
    { x: -84, y: 8, r: -9 },
    { x: -42, y: -6, r: 4 },
    { x: 0, y: 10, r: -3 },
    { x: 42, y: -8, r: 7 },
    { x: 84, y: 4, r: -5 },
];

function PhotoStack({ photos }: { photos: LifeHomeProps["photos"] }) {
    const [fanned, setFanned] = useState(false);
    const [hovered, setHovered] = useState<string | null>(null);
    const [lastDragged, setLastDragged] = useState<string | null>(null);
    const pileRef = useRef<HTMLDivElement>(null);
    const inView = useInView(pileRef, { once: true, margin: "-60px" });

    return (
        <section aria-labelledby="photos">
            <SectionTitle
                id="photos"
                aside={
                    <Link href="/photos" className="v2-link text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                        All photos
                    </Link>
                }
            >
                Through the lens
            </SectionTitle>
            <div ref={pileRef} className="relative h-[250px] sm:h-[330px]" onMouseEnter={() => setFanned(true)} onMouseLeave={() => setFanned(false)}>
                {photos.slice(0, PILE.length).map((p, i) => {
                    const pos = PILE[i];
                    return (
                        <div
                            key={p.id}
                            className="pointer-events-none absolute left-1/2 top-1/2 w-[32%] -translate-x-1/2 -translate-y-1/2 sm:w-[30%]"
                            style={{ zIndex: hovered === p.id ? 30 : lastDragged === p.id ? 20 : i }}
                        >
                            <motion.div
                                // Only the card itself takes the pointer; its centred holder would otherwise block the cards beneath.
                                className="pointer-events-auto cursor-grab touch-none"
                                initial={{ opacity: 0, x: "0%", y: 60, rotate: 0 }}
                                animate={
                                    inView
                                        ? {
                                              opacity: 1,
                                              x: `${pos.x * (fanned ? 1.22 : 1)}%`,
                                              y: pos.y * (fanned ? 1.8 : 1),
                                              rotate: pos.r * (fanned ? 1.25 : 1),
                                          }
                                        : undefined
                                }
                                whileHover={{ scale: 1.07, rotate: 0 }}
                                whileDrag={{ scale: 1.1, rotate: 0, cursor: "grabbing" }}
                                onHoverStart={() => setHovered(p.id)}
                                // Moving straight onto the next card can end this hover after that one started.
                                onHoverEnd={() => setHovered((h) => (h === p.id ? null : h))}
                                drag
                                dragSnapToOrigin
                                dragElastic={0.35}
                                onPointerDown={(e) => {
                                    const a = e.currentTarget.querySelector("a");
                                    if (a) delete a.dataset.dragging;
                                }}
                                onDragStart={(e) => {
                                    setLastDragged(p.id);
                                    const a = (e.target as HTMLElement | null)?.closest("a");
                                    // Tells the page transition (and the click below) that this wasn't a tap.
                                    if (a) a.dataset.dragging = "1";
                                }}
                                transition={{ type: "spring", stiffness: 220, damping: 22, delay: fanned ? 0 : i * 0.05 }}
                            >
                                <a
                                    href={`/photos#${p.id}`}
                                    draggable={false}
                                    aria-label={`${p.title}, open in photos`}
                                    onClick={(e) => {
                                        if (e.currentTarget.dataset.dragging) {
                                            e.preventDefault();
                                            delete e.currentTarget.dataset.dragging;
                                        }
                                    }}
                                    className="block rounded-[3px] bg-white p-[6%] pb-[18%] shadow-[0_12px_32px_-12px_rgba(14,28,51,0.4)]"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p.src} alt={p.title} draggable={false} className="aspect-[4/5] w-full select-none object-cover" />
                                    <p className="mt-[7%] truncate text-center text-[11px] text-neutral-500">{p.title}</p>
                                </a>
                            </motion.div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// Free text, not a form. The three verbs carry a soft highlight.
function TheseDays({ now }: { now: LifeHomeProps["now"] }) {
    return (
        <Reveal>
            <section aria-labelledby="days">
                <SectionTitle
                    id="days"
                    aside={
                        <Link href="/now" className="v2-link text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                            Updated {new Date(now.updated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </Link>
                    }
                >
                    These days
                </SectionTitle>
                <div className="gap-10 sm:grid sm:grid-cols-[1fr_170px] sm:items-start">
                    <div className="min-w-0 space-y-4">
                        {now.paragraphs.map((p) => (
                            <Prose key={p} text={p} className="text-[1.2rem] leading-relaxed tracking-tight sm:text-[1.3rem]" />
                        ))}
                    </div>
                    {now.reading && (
                        <div className="mt-8 flex justify-center sm:mt-1 sm:block">
                            <ReadingPhoto {...now.reading} />
                        </div>
                    )}
                </div>
                {now.listening && (
                    <div className="mt-14 flex justify-center">
                        <OnLoop song={now.listening} />
                    </div>
                )}
            </section>
        </Reveal>
    );
}

function Journey({ text }: { text: string }) {
    return (
        <Reveal>
            <section aria-labelledby="journey">
                <SectionTitle
                    id="journey"
                    aside={
                        <Link href="/journey" className="v2-link text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                            The longer version
                        </Link>
                    }
                >
                    The journey so far
                </SectionTitle>
                <p className="text-[17px] leading-[1.8]">{text}</p>
            </section>
        </Reveal>
    );
}

function Notes({ notes }: { notes: LifeHomeProps["notes"] }) {
    return (
        <Reveal>
            <section aria-labelledby="notes">
                <SectionTitle
                    id="notes"
                    aside={
                        <Link href="/notes" className="v2-link text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                            All notes
                        </Link>
                    }
                >
                    Notes
                </SectionTitle>
                <ul className="v2-focus-list">
                    {notes.map((n) => (
                        <li key={n.slug}>
                            <Link href={`/notes/${n.slug}`} className="group block py-3">
                                <span className="block font-medium">{n.title}</span>
                                <span className="block text-[15px] text-[var(--muted)]">{n.excerpt}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </Reveal>
    );
}
