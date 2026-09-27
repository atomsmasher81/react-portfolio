'use client';

import { useRef } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { Reveal } from "@/components/v2/motion";

// The long read, in order. A thin line runs down the left and fills as you
// read; each stage of life gets a dot and a label, and the prose just flows.
export function JourneyStory({ eras }: { eras: { era: string; paragraphs: string[] }[] }) {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 70%"] });
    const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

    return (
        <div ref={ref} className="relative">
            <span aria-hidden className="absolute bottom-2 left-[4px] top-2 w-px bg-[var(--faint)]" />
            <motion.span aria-hidden style={{ scaleY }} className="absolute bottom-2 left-[4px] top-2 w-px origin-top bg-[var(--ink)]" />
            <div className="space-y-14">
                {eras.map((e) => (
                    <section key={e.era} className="relative pl-8">
                        <span aria-hidden className="absolute left-0 top-[7px] h-[9px] w-[9px] rounded-full border-2 border-[var(--bg)] bg-[var(--ink)]" />
                        <h2 className="v2-eyebrow">{e.era}</h2>
                        <div className="mt-3 space-y-5">
                            {e.paragraphs.map((p) => (
                                <Reveal key={p}>
                                    <p className="text-[17px] leading-[1.8]">{p}</p>
                                </Reveal>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
