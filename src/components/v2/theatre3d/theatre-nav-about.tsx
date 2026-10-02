'use client';

import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { fell, fellSC } from "@/components/v2/theatre-fonts";
import { useModal } from "@/components/v2/theatre3d/theatre-nav-ui";
import { theatre } from "@/data/v2/theatre";

// The programme: what you'd be handed at the door of an old theatre. Printed
// on paper (dark ink, an oxblood accent, a double rule round the edge), so it
// reads clearly over the dark corridor: what the Magic Theatre is (Hesse's
// Steppenwolf), why it's here, how to walk it, and where to read the book.
// The words come from theatre.about in src/data/v2/theatre.ts. It scrolls on
// a small screen; Esc, the × and "Back to the theatre" close it; focus stays
// inside while it's open.

export interface AboutPanelProps {
    open: boolean;
    onClose(): void;
}

const paper = {
    background:
        "radial-gradient(ellipse at 18% 8%, rgba(255,251,238,0.75), transparent 52%), radial-gradient(ellipse at 88% 94%, rgba(140,96,48,0.22), transparent 58%), radial-gradient(circle at 30% 70%, rgba(150,100,50,0.07) 0 2px, transparent 3px) 0 0/43px 47px, radial-gradient(circle at 70% 20%, rgba(150,100,50,0.06) 0 1.5px, transparent 2.5px) 0 0/29px 31px, #eadcc1",
    boxShadow: "inset 0 0 70px rgba(110,70,30,0.38), inset 0 0 0 1px rgba(80,50,25,0.35), 0 30px 90px rgba(0,0,0,0.75)",
};

const inkFocus = "outline-none focus-visible:ring-2 focus-visible:ring-[#8b2313] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eadcc1]";

export function AboutPanel({ open, onClose }: AboutPanelProps) {
    const reduced = useReducedMotion();
    const box = useRef<HTMLDivElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    useModal("about", open, box, onClose, scroller);
    const a = theatre.about;
    const entrance = theatre.entrance;
    const admission = theatre.admission.replace(/\.\s+/g, ".\n").split("\n");

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="about"
                    data-theatre-dialog="about"
                    className="fixed inset-0 z-[60]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0.12 : 0.35 }}
                >
                    <div aria-hidden className="absolute inset-0 bg-[#050202]/80 backdrop-blur-[2px]" onClick={onClose} />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2.5 pb-[max(10px,env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))] md:p-8">
                        <motion.div
                            ref={box}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="theatre-about-title"
                            className="pointer-events-auto relative flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-[3px] text-[#2b1a10]"
                            style={paper}
                            initial={{ y: reduced ? 0 : 18, scale: reduced ? 1 : 0.985 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: reduced ? 0 : 10, opacity: 0 }}
                            transition={{ duration: reduced ? 0.12 : 0.45, ease: [0.2, 0.7, 0.2, 1] }}
                        >
                            {/* the double rule round the edge */}
                            <span aria-hidden className="pointer-events-none absolute inset-[9px] border border-[#3b2416]/70" />
                            <span aria-hidden className="pointer-events-none absolute inset-[13px] border border-[#3b2416]/30" />

                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close the programme"
                                className={`absolute right-[18px] top-[18px] z-10 grid h-11 w-11 place-items-center rounded-full bg-[#eadcc1]/90 text-[#3b2416] transition-colors hover:bg-[#dccaa8] hover:text-[#1a0f08] ${inkFocus}`}
                            >
                                <X className="h-5 w-5" strokeWidth={1.7} />
                            </button>

                            <div
                                ref={scroller}
                                data-scroll
                                tabIndex={0}
                                aria-label="The programme"
                                className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-8 pt-10 outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(139,35,19,0.5)] md:px-12 md:pb-10 md:pt-12"
                            >
                                <header className="text-center">
                                    <p className={`${fellSC.className} text-[14px] tracking-[0.38em] text-[#8b2313]`}>Programme</p>
                                    <Rule />
                                    <h2 id="theatre-about-title" className={`${fellSC.className} text-[36px] leading-[1.05] tracking-[0.04em] text-[#24150c] md:text-[44px]`}>
                                        {a.title}
                                    </h2>
                                    <p className={`${fell.className} mt-3 text-[17px] italic leading-snug text-[#5a3d2a]`}>
                                        {entrance}.
                                        {admission.map((line) => (
                                            <span key={line} className="block">
                                                {line}
                                            </span>
                                        ))}
                                    </p>
                                    <Rule />
                                </header>

                                <Section title="From the book">
                                    {a.source.map((p, i) =>
                                        i === 0 ? (
                                            <p key={p}>
                                                <span className={`${fellSC.className} float-left mr-2 mt-[5px] text-[58px] leading-[0.8] text-[#8b2313]`}>{p.charAt(0)}</span>
                                                {p.slice(1)}
                                            </p>
                                        ) : (
                                            <p key={p}>{p}</p>
                                        ),
                                    )}
                                </Section>
                                {a.why.length > 0 && (
                                    <Section title="Why it's here">
                                        {a.why.map((p) => (
                                            <p key={p}>{p}</p>
                                        ))}
                                    </Section>
                                )}
                                {a.how.length > 0 && (
                                    <Section title="How to walk it">
                                        {a.how.map((p) => (
                                            <p key={p}>{p}</p>
                                        ))}
                                    </Section>
                                )}
                                {a.links.length > 0 && (
                                    <Section title="Read the book">
                                        <ul className="space-y-1">
                                            {a.links.map((l) => (
                                                <li key={l.href}>
                                                    <a
                                                        href={l.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`group -mx-2 inline-flex min-h-[44px] items-center gap-2 rounded-[4px] px-2 text-[#8b2313] underline decoration-[#8b2313]/45 underline-offset-[5px] transition-colors hover:bg-[#8b2313]/[0.07] hover:decoration-[#8b2313] ${inkFocus}`}
                                                    >
                                                        <span>{l.label}</span>
                                                        <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.8} />
                                                        <span className="sr-only"> (opens in a new tab)</span>
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </Section>
                                )}

                                <div className="mt-9 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className={`${fellSC.className} min-h-[52px] w-full rounded-[4px] border border-[#24150c] bg-[#2b1a10] px-8 text-[18px] tracking-[0.1em] text-[#f4e6d0] shadow-[inset_0_1px_0_rgba(255,220,180,0.15)] transition-colors hover:bg-[#3d2416] md:w-auto ${inkFocus}`}
                                    >
                                        Back to the theatre
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="mt-8">
            <h3 className={`${fellSC.className} flex items-center justify-center gap-3 text-[15px] tracking-[0.26em] text-[#8b2313]`}>
                <Diamond />
                {title}
                <Diamond />
            </h3>
            <div className={`${fell.className} mx-auto mt-3 max-w-[34em] space-y-3 text-[17.5px] leading-[1.62] text-[#2b1a10] [hyphens:auto]`}>{children}</div>
        </section>
    );
}

function Rule() {
    return (
        <div aria-hidden className="mx-auto my-4 flex max-w-[260px] items-center gap-3 text-[#3b2416]/60">
            <span className="h-px flex-1 bg-current" />
            <Diamond />
            <span className="h-px flex-1 bg-current" />
        </div>
    );
}

function Diamond() {
    return <span aria-hidden className="inline-block h-[6px] w-[6px] shrink-0 rotate-45 bg-[#8b2313]/80" />;
}
