'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { theatre } from "@/data/v2/theatre";
import { fellSC } from "@/components/v2/theatre-fonts";

// Letters that buzz out of step like an old neon sign; `dead` stays mostly
// dark. Timings come from the index so server and client agree.
export function Neon({ text, dead = -1, className = "" }: { text: string; dead?: number; className?: string }) {
    return (
        <span className={className} aria-label={text}>
            {Array.from(text).map((ch, i) => (
                <span
                    key={i}
                    aria-hidden
                    className={ch === " " ? "" : i === dead ? "v2-neon v2-neon-dead" : "v2-neon"}
                    style={{ animationDuration: `${3.4 + ((i * 7) % 11) * 0.41}s`, animationDelay: `${-((i * 13) % 17) * 0.31}s` }}
                >
                    {ch}
                </span>
            ))}
        </span>
    );
}

// A small dark enamel plaque at the foot of a page, only lit at night (the
// visitor's night). `?theatre` lights it any time.
export function TheatreSign() {
    const [lit, setLit] = useState(false);
    useEffect(() => {
        const h = new Date().getHours();
        setLit(h >= 21 || h < 5 || new URLSearchParams(window.location.search).has("theatre"));
    }, []);
    if (!lit) return null;

    return (
        <motion.div className="mt-24 flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 4, delay: 1.5 }}>
            <Link href="/magic-theatre" aria-label={`${theatre.sign}. ${theatre.entrance}.`} className="group block -rotate-[1.5deg]">
                <span className="relative block rounded-[3px] border border-black/60 bg-[#0e0a09] px-6 pb-2.5 pt-3 text-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7),inset_0_0_0_3px_#1a1311,inset_0_0_24px_rgba(0,0,0,0.9)] transition-shadow duration-700 group-hover:shadow-[0_10px_40px_-10px_rgba(255,90,60,0.45),inset_0_0_0_3px_#1a1311,inset_0_0_24px_rgba(0,0,0,0.9)]">
                    {/* screws */}
                    {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((p) => (
                        <span key={p} className={`absolute ${p} h-1 w-1 rounded-full bg-[#3a2f2a]`} />
                    ))}
                    <Neon text={theatre.sign.toUpperCase()} dead={10} className={`${fellSC.className} block text-[16px] tracking-[0.38em]`} />
                    <span className="mt-1 block text-[8.5px] uppercase tracking-[0.34em] text-[#7d6b5d]">{theatre.entrance}</span>
                </span>
            </Link>
        </motion.div>
    );
}
