'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Film, Rows3, X } from "lucide-react";
import { thumb, type Photo } from "@/data/v2/photos";
import { track } from "@/lib/analytics";

type View = "essay" | "sheet";

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const meta = (p: Photo) => [p.place, monthYear(p.date)].filter(Boolean).join(" · ");
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Long, poem-like captions get a feature spread; everything else sits in clusters.
const isLong = (p: Photo) => p.caption.length > 180 || p.caption.split("\n").length > 4;

export function PhotoGallery({ photos }: { photos: Photo[] }) {
    const [view, setView] = useState<View>("essay");
    const [open, setOpen] = useState<{ index: number; origin: DOMRect | null } | null>(null);

    const openPhoto = useCallback(
        (id: string) => {
            const index = photos.findIndex((p) => p.id === id);
            if (index < 0) return;
            const el = document.querySelector<HTMLElement>(`[data-photo="${id}"]`);
            setOpen({ index, origin: el?.getBoundingClientRect() ?? null });
        },
        [photos],
    );

    // Every photo looked at up close, whether opened directly or swiped to.
    const openId = open ? photos[open.index]?.id : undefined;
    useEffect(() => {
        if (openId) track("photo_view", { photo_id: openId });
    }, [openId]);

    // Deep links: /photos#<id> opens that frame.
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id) return;
        const el = document.querySelector<HTMLElement>(`[data-photo="${id}"]`);
        el?.scrollIntoView({ block: "center" });
        requestAnimationFrame(() => openPhoto(id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div>
            <header className="mx-auto flex max-w-6xl items-end justify-between gap-6 pb-14 pt-14 sm:pt-24">
                <div className="max-w-xl">
                    <h1 className="v2-display text-[2.75rem] sm:text-[3.25rem]">Photos</h1>
                    <p className="mt-3 text-[var(--muted)]">
                        I love how a still freezes a moment, and how deep even an ordinary thing can look once it&apos;s frozen. The words
                        mattered as much as the pictures, so they&apos;re here too.
                    </p>
                </div>
                <div className="flex shrink-0 rounded-full border border-[var(--faint)] p-0.5">
                    {([
                        { id: "essay", icon: Rows3, label: "Photos with words" },
                        { id: "sheet", icon: Film, label: "Contact sheet" },
                    ] as const).map(({ id, icon: Icon, label }) => (
                        <button
                            key={id}
                            onClick={() => {
                                if (view !== id) track("photo_layout", { layout: id });
                                setView(id);
                            }}
                            aria-label={label}
                            aria-pressed={view === id}
                            title={label}
                            className={`rounded-full p-2 transition-colors ${view === id ? "bg-[var(--faint)] text-[var(--ink)]" : "text-[var(--muted)]"}`}
                        >
                            <Icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>
            </header>

            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                >
                    {view === "essay" ? <PhotoEssay photos={photos} onOpen={openPhoto} /> : <ContactSheet photos={photos} onOpen={openPhoto} />}
                </motion.div>
            </AnimatePresence>

            <Lightbox photos={photos} state={open} onChange={(index) => setOpen((s) => (s ? { ...s, index } : s))} onClose={() => setOpen(null)} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// The essay: a printed-zine rhythm. Photos with long captions become spreads,
// a large print beside the words set like a poem, alternating sides. The rest
// gather in clusters of smaller prints, each with its line underneath.

type Block = { kind: "spread"; photo: Photo; flip: boolean } | { kind: "cluster"; photos: Photo[] };

function toBlocks(photos: Photo[]): Block[] {
    const blocks: Block[] = [];
    let cluster: Photo[] = [];
    let flip = false;
    const flush = () => {
        if (cluster.length) blocks.push({ kind: "cluster", photos: cluster });
        cluster = [];
    };
    for (const p of photos) {
        if (isLong(p)) {
            flush();
            blocks.push({ kind: "spread", photo: p, flip });
            flip = !flip;
        } else cluster.push(p);
    }
    flush();
    return blocks;
}

function PhotoEssay({ photos, onOpen }: { photos: Photo[]; onOpen: (id: string) => void }) {
    return (
        <div className="mx-auto max-w-6xl space-y-28 sm:space-y-36">
            {toBlocks(photos).map((b) =>
                b.kind === "spread" ? (
                    <Spread key={b.photo.id} photo={b.photo} flip={b.flip} onOpen={onOpen} />
                ) : (
                    <Cluster key={b.photos[0].id} photos={b.photos} onOpen={onOpen} />
                ),
            )}
        </div>
    );
}

function Print({ photo, onOpen, className }: { photo: Photo; onOpen: (id: string) => void; className?: string }) {
    return (
        <button
            onClick={() => onOpen(photo.id)}
            aria-label={`Open ${photo.title}`}
            className={`group block w-full overflow-hidden rounded-sm bg-[var(--card)] ${className ?? ""}`}
            style={{ aspectRatio: `${photo.w} / ${photo.h}` }}
        >
            <FadeImage
                src={thumb(photo)}
                alt={photo.title}
                data-photo={photo.id}
                className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
            />
        </button>
    );
}

// Each line of a caption drifts in a beat after the one before it.
function Lines({ text, className }: { text: string; className?: string }) {
    const lines = text.split("\n");
    return (
        <div className={className}>
            {lines.map((line, i) =>
                line.trim() === "" ? (
                    <div key={i} className="h-[0.9em]" />
                ) : (
                    <motion.p
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 0.7, delay: Math.min(i, 24) * 0.05, ease: EASE }}
                    >
                        {line}
                    </motion.p>
                ),
            )}
        </div>
    );
}

function Spread({ photo, flip, onOpen }: { photo: Photo; flip: boolean; onOpen: (id: string) => void }) {
    return (
        <section className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
            <motion.div
                className={`md:col-span-7 ${flip ? "md:order-2" : ""}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, ease: EASE }}
            >
                <Print photo={photo} onOpen={onOpen} />
            </motion.div>
            <div className={`md:col-span-5 ${flip ? "md:order-1 md:text-right" : ""}`}>
                <Lines text={photo.caption} className="text-[16px] leading-[1.85] text-[var(--ink)] sm:text-[17px]" />
                <p className="v2-mono mt-6 text-[11px] uppercase tracking-wider text-[var(--muted)]">{meta(photo)}</p>
            </div>
        </section>
    );
}

// Smaller prints in two or three flowing columns, each with its words underneath.
function Cluster({ photos, onOpen }: { photos: Photo[]; onOpen: (id: string) => void }) {
    return (
        <section className="columns-1 gap-8 sm:columns-2 lg:columns-3">
            {photos.map((p, i) => {
                const said = p.caption.trim();
                return (
                    <motion.figure
                        key={p.id}
                        className="mb-12 break-inside-avoid"
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ duration: 0.8, delay: (i % 3) * 0.08, ease: EASE }}
                    >
                        <Print photo={p} onOpen={onOpen} />
                        <figcaption className="mt-4">
                            {said ? (
                                <p className="whitespace-pre-line text-[17px] leading-snug tracking-tight">{said}</p>
                            ) : (
                                <p className="text-[15px] text-[var(--muted)]">{p.title}</p>
                            )}
                            <p className="v2-mono mt-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">{meta(p)}</p>
                        </figcaption>
                    </motion.figure>
                );
            })}
        </section>
    );
}

// A nod to film: every frame on strips with sprocket holes and edge numbers.
function ContactSheet({ photos, onOpen }: { photos: Photo[]; onOpen: (id: string) => void }) {
    const PER_STRIP = 6;
    const strips: Photo[][] = [];
    for (let i = 0; i < photos.length; i += PER_STRIP) strips.push(photos.slice(i, i + PER_STRIP));

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            {strips.map((strip, s) => (
                <motion.div
                    key={s}
                    initial={{ opacity: 0, x: -24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: s * 0.05 }}
                    className="overflow-x-auto rounded-sm [scrollbar-width:none]"
                >
                    <div className="w-max min-w-full bg-[#1b1b1b]">
                        <div className="v2-sprockets" />
                        <div className="v2-mono flex justify-between px-3 text-[9px] tracking-[0.3em] text-[#e0a14a]/80">
                            <span>KG 400</span>
                            <span>SAFETY FILM</span>
                            <span>ROLL {String(s + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="flex gap-2 px-3 py-2">
                            {strip.map((p, i) => (
                                <button key={p.id} onClick={() => onOpen(p.id)} className="group relative shrink-0 text-left">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        data-photo={p.id}
                                        src={thumb(p)}
                                        alt={p.title}
                                        loading="lazy"
                                        className="h-24 w-36 object-cover grayscale-[35%] transition-[filter] duration-300 group-hover:grayscale-0 sm:h-28 sm:w-44"
                                    />
                                    <span className="v2-mono mt-1 block text-[10px] text-[#e0a14a]">
                                        ▸ {s * PER_STRIP + i + 1}
                                        <span className="text-[#e0a14a]/60">A</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="v2-sprockets" />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function FadeImage(props: React.ImgHTMLAttributes<HTMLImageElement> & { "data-photo"?: string }) {
    const [loaded, setLoaded] = useState(false);
    const ref = useRef<HTMLImageElement>(null);
    useEffect(() => {
        if (ref.current?.complete) setLoaded(true);
    }, []);
    return (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
            ref={ref}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            {...props}
            style={{ filter: loaded ? "blur(0)" : "blur(14px)", opacity: loaded ? 1 : 0, transition: "filter .7s ease, opacity .7s ease, transform 1.2s ease" }}
        />
    );
}

// ---------------------------------------------------------------------------
// Lightbox: zooms out of the print you tapped. On wide screens the words sit
// in their own column beside the photo; on phones they sit underneath it.
// Swipe or use the arrow keys to move, swipe down or Esc to close.

type Phase = { mode: "open" | "nav" | "close"; dir: number; from?: DOMRect | null; to?: DOMRect | null };

function useViewport() {
    const [vp, setVp] = useState({ w: 1200, h: 800 });
    useEffect(() => {
        const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);
    return vp;
}

function Lightbox({
    photos,
    state,
    onChange,
    onClose,
}: {
    photos: Photo[];
    state: { index: number; origin: DOMRect | null } | null;
    onChange: (index: number) => void;
    onClose: () => void;
}) {
    const vp = useViewport();
    const [phase, setPhase] = useState<Phase>({ mode: "open", dir: 0 });
    const photo = state ? photos[state.index] : null;

    // Where the photo may sit: beside the words on wide screens, above them on phones.
    const TOP = 56;
    const wide = vp.w >= 1024;
    const layout = (p: Photo) => {
        const words = !!p.caption;
        if (wide) {
            const right = words ? vp.w * 0.6 : vp.w - 96;
            return { left: 96, right, top: TOP, bottom: vp.h - 64 };
        }
        const below = words ? Math.min(vp.h * 0.42, 380) : 90;
        return { left: 16, right: vp.w - 16, top: TOP, bottom: vp.h - below };
    };
    const place = (p: Photo) => {
        const box = layout(p);
        const s = Math.min((box.right - box.left) / p.w, (box.bottom - box.top - 16) / p.h);
        const w = p.w * s;
        const h = p.h * s;
        const cx = (box.left + box.right) / 2;
        const cy = (box.top + box.bottom) / 2;
        return { w, h, cx, cy, left: cx - w / 2, top: cy - h / 2 };
    };

    const rectToTransform = (rect: DOMRect, p: Photo) => {
        const at = place(p);
        return { x: rect.left + rect.width / 2 - at.cx, y: rect.top + rect.height / 2 - at.cy, scale: rect.width / at.w, opacity: 1 };
    };

    // The first render after opening must already know where to zoom from.
    const wasOpen = useRef(false);
    const current: Phase = state && !wasOpen.current ? { mode: "open", dir: 0, from: state.origin } : phase;
    useEffect(() => {
        wasOpen.current = !!state;
    }, [state]);

    const go = useCallback(
        (dir: number) => {
            if (!state) return;
            setPhase({ mode: "nav", dir });
            onChange((state.index + dir + photos.length) % photos.length);
        },
        [state, photos.length, onChange],
    );

    const close = useCallback(() => {
        if (!photo) return;
        const rect = document.querySelector<HTMLElement>(`[data-photo="${photo.id}"]`)?.getBoundingClientRect();
        const onScreen = rect && rect.bottom > 0 && rect.top < window.innerHeight;
        setPhase({ mode: "close", dir: 0, to: onScreen ? rect : null });
        onClose();
    }, [photo, onClose]);

    useEffect(() => {
        if (photo) history.replaceState(null, "", `#${photo.id}`);
    }, [photo]);

    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
            else if (e.key === "Escape") close();
        };
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [state, go, close]);

    // Drop the #id once a photo is closed. Only on close: on first load the gallery
    // still needs to read that hash to know which photo to open.
    const hasOpened = useRef(false);
    useEffect(() => {
        if (state) hasOpened.current = true;
        else if (hasOpened.current && window.location.hash) history.replaceState(null, "", window.location.pathname);
    }, [state]);

    const onDragEnd = (_: unknown, info: PanInfo) => {
        const { x, y } = info.offset;
        if (Math.abs(y) > 120 && Math.abs(y) > Math.abs(x)) close();
        else if (x < -80) go(1);
        else if (x > 80) go(-1);
    };

    const variants = {
        initial: (c: Phase) => (c.mode === "open" && c.from && photo ? rectToTransform(c.from, photo) : { x: c.dir * 120, y: 0, scale: 0.98, opacity: 0 }),
        animate: { x: 0, y: 0, scale: 1, opacity: 1 },
        exit: (c: Phase) =>
            c.mode === "close" ? (c.to && photo ? rectToTransform(c.to, photo) : { scale: 0.92, opacity: 0 }) : { x: -c.dir * 120, scale: 0.98, opacity: 0 },
    };

    const at = photo ? place(photo) : null;

    return (
        <AnimatePresence custom={current}>
            {photo && (
                <motion.div
                    key="backdrop"
                    className="fixed inset-0 z-[55] bg-black/95"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={close}
                />
            )}
            {photo && at && (
                // eslint-disable-next-line @next/next/no-img-element
                <motion.img
                    key={photo.id}
                    src={photo.src}
                    alt={photo.title}
                    custom={current}
                    variants={variants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ type: "spring", bounce: 0.12, duration: 0.55 }}
                    drag
                    dragSnapToOrigin
                    dragElastic={0.5}
                    onDragEnd={onDragEnd}
                    draggable={false}
                    className="fixed z-[56] cursor-grab touch-none select-none rounded-sm object-cover shadow-2xl active:cursor-grabbing"
                    style={{ width: at.w, height: at.h, left: at.left, top: at.top }}
                />
            )}
            {photo && state && (
                <motion.div
                    key="chrome"
                    className="pointer-events-none fixed inset-0 z-[57] text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <div className="pointer-events-auto flex h-14 items-center justify-between px-4 sm:px-6">
                        <span className="v2-mono text-xs tabular-nums text-white/60">
                            {String(state.index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
                        </span>
                        <button onClick={close} aria-label="Close" className="-mr-2 rounded-full p-2 text-white/80 hover:bg-white/10">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <button onClick={() => go(-1)} aria-label="Previous photo" className="pointer-events-auto absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full p-3 text-white/70 hover:bg-white/10 md:block">
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button onClick={() => go(1)} aria-label="Next photo" className="pointer-events-auto absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full p-3 text-white/70 hover:bg-white/10 md:block">
                        <ChevronRight className="h-6 w-6" />
                    </button>

                    {/* The words: a column beside the photo on wide screens, a panel under it on phones. */}
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={photo.id}
                            className="pointer-events-auto absolute overflow-y-auto [scrollbar-width:thin]"
                            style={
                                wide
                                    ? photo.caption
                                        ? { left: vp.w * 0.63, right: 96, top: TOP + 24, bottom: 64, display: "flex", flexDirection: "column", justifyContent: "center" }
                                        : { left: 96, right: 96, bottom: 20 }
                                    : { left: 20, right: 20, top: layout(photo).bottom + 8, bottom: 16 }
                            }
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.35, ease: EASE }}
                        >
                            {photo.caption ? (
                                <Lines text={photo.caption} className="text-[15px] leading-[1.8] text-white/90 sm:text-[16px]" />
                            ) : (
                                <p className="text-lg font-medium">{photo.title}</p>
                            )}
                            <p className="v2-mono mt-5 text-[11px] uppercase tracking-wider text-white/50">{meta(photo)}</p>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
