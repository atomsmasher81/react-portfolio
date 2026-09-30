'use client';

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { track } from "@/lib/analytics";

export interface CardProject {
    title: string;
    description: string;
    subtext: string;
    link?: string;
    github?: string;
    year: string;
    highlight?: boolean;
    details?: { technology: string[]; role: string; duration: string[]; description: string };
}

// Readable as-is: name, what it is, what I did, the stack. Hovering tilts the
// card toward the cursor with a soft light under it and swaps the year for a
// link; clicking opens the full story.
export function ProjectCard({ project, id }: { project: CardProject; id: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const rx = useSpring(0, { stiffness: 200, damping: 20 });
    const ry = useSpring(0, { stiffness: 200, damping: 20 });
    const mx = useMotionValue(-200);
    const my = useMotionValue(-200);
    const spotlight = useMotionTemplate`radial-gradient(260px circle at ${mx}px ${my}px, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%)`;

    const onMove = (e: React.MouseEvent) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        mx.set(x);
        my.set(y);
        ry.set(((x - r.width / 2) / r.width) * 7);
        rx.set(-((y - r.height / 2) / r.height) * 7);
    };
    const onLeave = () => {
        rx.set(0);
        ry.set(0);
    };

    const stack = project.details?.technology.slice(0, 3).join(" · ");

    return (
        <>
            <motion.div
                ref={ref}
                layoutId={`project-${id}`}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                onClick={() => {
                    onLeave();
                    track("project_open", { label: project.title });
                    setOpen(true);
                }}
                style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
                className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--faint)] bg-[var(--card)] p-5 transition-shadow duration-300 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.18)]"
            >
                <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: spotlight }}
                />
                <div className="relative flex items-baseline justify-between gap-3">
                    <h3 className="font-medium">{project.title}</h3>
                    {/* Both labels share one grid cell, so the slot is as wide as the longer one. */}
                    <span className="relative inline-grid h-5 shrink-0 overflow-hidden text-sm leading-5">
                        <span className="col-start-1 row-start-1 justify-self-end text-[var(--muted)] transition-transform duration-300 group-hover:-translate-y-full">
                            {project.year.split(" ").pop()}
                        </span>
                        <span className="col-start-1 row-start-1 flex translate-y-full items-center gap-0.5 justify-self-end whitespace-nowrap text-[var(--accent)] transition-transform duration-300 group-hover:translate-y-0">
                            Details <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                    </span>
                </div>
                <p className="relative mt-3 text-[15px] leading-snug">{project.description}</p>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">{project.subtext}</p>
                {project.details && (
                    <p className="relative mt-4 truncate text-xs text-[var(--muted)]">
                        <span className="text-[var(--ink)]">{project.details.role}</span>
                        {stack && <span className="v2-mono"> · {stack}</span>}
                    </p>
                )}
            </motion.div>

            <AnimatePresence>{open && <ProjectDialog project={project} id={id} onClose={() => setOpen(false)} />}</AnimatePresence>
        </>
    );
}

function ProjectDialog({ project, id, onClose }: { project: CardProject; id: string; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    const d = project.details;

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6">
            <motion.div
                className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                layoutId={`project-${id}`}
                role="dialog"
                aria-modal="true"
                aria-label={project.title}
                className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--faint)] bg-[var(--card)] p-6 shadow-2xl"
                transition={{ type: "spring", bounce: 0.12, duration: 0.5 }}
            >
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-2xl font-medium tracking-tight">{project.title}</h3>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                                {d ? `${d.role} · ${d.duration.join(" to ")}` : project.year}
                            </p>
                        </div>
                        <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-full p-2 text-[var(--muted)] hover:bg-[var(--faint)]">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="mt-5 text-[16px] leading-relaxed">{d?.description ?? project.subtext}</p>
                    {d && (
                        <div className="mt-5 flex flex-wrap gap-1.5">
                            {d.technology.map((t) => (
                                <span key={t} className="rounded-md bg-[var(--faint)] px-2 py-0.5 text-xs">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                    {(project.link || project.github) && (
                        <div className="mt-6 flex gap-2">
                            {project.link && (
                                <a
                                    href={project.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--bg)] transition-transform active:scale-95"
                                >
                                    Visit <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                            )}
                            {project.github && (
                                <a
                                    href={project.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--faint)] px-4 py-2 text-sm transition-transform active:scale-95"
                                >
                                    Source <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
}
