'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { litPath, moonPhase, type MoonPhase } from "@/lib/moon";

// Tonight's moon, drawn from the real phase. Renders nothing until mounted so
// server and client never disagree about "tonight".
export function useMoon() {
    const [phase, setPhase] = useState<MoonPhase | null>(null);
    useEffect(() => setPhase(moonPhase()), []);
    return phase;
}

export function MoonDisc({ phase, size = 160, glow = true }: { phase: MoonPhase | null; size?: number; glow?: boolean }) {
    const id = `moon-${size}`;
    return (
        <motion.svg
            viewBox="-10 -10 120 120"
            width={size}
            height={size}
            aria-hidden
            initial={{ opacity: 0, scale: 0.9, rotate: -8 }}
            animate={phase ? { opacity: 1, scale: 1, rotate: 0 } : undefined}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: glow ? "drop-shadow(0 0 24px rgba(214,222,255,0.35))" : undefined }}
        >
            <defs>
                <radialGradient id={`${id}-lit`} cx="40%" cy="38%" r="70%">
                    <stop offset="0%" stopColor="#fbfbf4" />
                    <stop offset="70%" stopColor="#e4e3d6" />
                    <stop offset="100%" stopColor="#c9c7b8" />
                </radialGradient>
                <clipPath id={`${id}-clip`}>
                    <circle cx="50" cy="50" r="50" />
                </clipPath>
                {phase && (
                    <clipPath id={`${id}-lit-clip`}>
                        <path d={litPath(phase.fraction)} />
                    </clipPath>
                )}
            </defs>
            {/* earthshine: the dark side is never quite black */}
            <circle cx="50" cy="50" r="50" fill="#1a1f33" />
            {phase && (
                <g clipPath={`url(#${id}-clip)`}>
                    <path d={litPath(phase.fraction)} fill={`url(#${id}-lit)`} />
                    {/* a few maria, only visible on the lit side */}
                    <g opacity="0.09" fill="#6b6a5c" clipPath={`url(#${id}-lit-clip)`}>
                        <ellipse cx="38" cy="34" rx="12" ry="9" />
                        <ellipse cx="58" cy="44" rx="9" ry="7" />
                        <ellipse cx="46" cy="62" rx="14" ry="8" />
                        <circle cx="68" cy="70" r="4" />
                    </g>
                </g>
            )}
        </motion.svg>
    );
}
