'use client';

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView } from "framer-motion";
import { Check, Copy, Mail } from "lucide-react";
import { track } from "@/lib/analytics";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Fade + rise as content scrolls into view.
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, delay, ease: EASE }}
        >
            {children}
        </motion.div>
    );
}

export function SectionTitle({ children, aside, id }: { children: React.ReactNode; aside?: React.ReactNode; id?: string }) {
    return (
        <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id={id} className="v2-eyebrow">
                {children}
            </h2>
            {aside}
        </div>
    );
}

// Words settle in one after another, un-blurring as they go. Children may mix
// plain strings and inline elements (e.g. an avatar); each gets its own beat.
// A CSS animation (.v2-word-in in v2.css), so a headline plays from the first
// paint rather than waiting for the page's JavaScript.
export function StaggerText({ parts, className, delay = 0 }: { parts: React.ReactNode[]; className?: string; delay?: number }) {
    const pieces = parts.flatMap((part, i) =>
        typeof part === "string"
            ? part
                  .split(/(\s+)/)
                  .filter(Boolean)
                  .map((word, j) => ({ key: `${i}-${j}`, node: word, space: /^\s+$/.test(word) }))
            : [{ key: `${i}`, node: part, space: false }],
    );
    let beat = 0;
    return (
        <span className={className}>
            {pieces.map((p) =>
                p.space ? (
                    p.node
                ) : (
                    <span key={p.key} className="v2-word-in inline-block" style={{ animationDelay: `${Math.round((delay + beat++ * 0.045) * 1000)}ms` }}>
                        {p.node}
                    </span>
                ),
            )}
        </span>
    );
}

// Counts up once the number scrolls into view.
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: "-40px" });
    const [shown, setShown] = useState(0);

    useEffect(() => {
        if (!inView) return;
        const controls = animate(0, value, { duration: 1.4, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) });
        return () => controls.stop();
    }, [inView, value]);

    return (
        <span ref={ref} className="tabular-nums">
            {shown}
            {suffix}
        </span>
    );
}

// Email as a quiet chip. Hovering swaps the mail icon for a copy icon (that's
// the hint); clicking copies, and both icon and text confirm. The two labels
// share one grid cell so the chip never changes width.
export function CopyEmail({ email, className }: { email: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1800);
        return () => clearTimeout(t);
    }, [copied]);

    return (
        <button
            onClick={() => {
                track("email_copy", { source: "chip" }, { key: true });
                navigator.clipboard?.writeText(email).then(() => setCopied(true), () => (window.location.href = `mailto:${email}`));
            }}
            title="Copy email"
            className={`group inline-flex h-9 items-center gap-2 rounded-full px-3 text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--faint)] hover:text-[var(--ink)] active:scale-[0.97] ${className ?? ""}`}
        >
            <span className="relative grid h-4 w-4 place-items-center">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                        key={copied ? "check" : "idle"}
                        className="col-start-1 row-start-1"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", bounce: 0.4, duration: 0.35 }}
                    >
                        {copied ? (
                            <Check className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        ) : (
                            <span className="grid">
                                <Mail className="col-start-1 row-start-1 h-4 w-4 transition-all duration-200 group-hover:scale-50 group-hover:opacity-0" strokeWidth={1.75} />
                                <Copy className="col-start-1 row-start-1 h-4 w-4 scale-50 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" strokeWidth={1.75} />
                            </span>
                        )}
                    </motion.span>
                </AnimatePresence>
            </span>
            <span className="grid overflow-hidden text-left">
                <motion.span
                    className="col-start-1 row-start-1"
                    animate={{ y: copied ? "-110%" : 0, opacity: copied ? 0 : 1 }}
                    transition={{ duration: 0.3, ease: EASE }}
                >
                    {email}
                </motion.span>
                <motion.span
                    aria-live="polite"
                    className="col-start-1 row-start-1"
                    initial={false}
                    animate={{ y: copied ? 0 : "110%", opacity: copied ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                >
                    {copied ? "Copied" : ""}
                </motion.span>
            </span>
        </button>
    );
}

// "It's 9:42 pm for me": a small live clock, colon ticks every second.
export function LocalTime({ timeZone }: { timeZone: string }) {
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    if (!now) return <span className="opacity-0">00:00</span>;
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return (
        <span className="tabular-nums">
            {get("hour")}
            <span className={now.getSeconds() % 2 ? "opacity-30" : ""} style={{ transition: "opacity .3s" }}>
                :
            </span>
            {get("minute")} {get("dayPeriod").toLowerCase()}
        </span>
    );
}

// Plain prose where **words** get a highlighter stroke that draws in once the
// paragraph scrolls into view. Keeps copy free-form, with a little emphasis.
export function Prose({ text, className }: { text: string; className?: string }) {
    const ref = useRef<HTMLParagraphElement>(null);
    const inView = useInView(ref, { once: true, margin: "-60px" });
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

    return (
        <p ref={ref} className={className}>
            {parts.map((part, i) =>
                part.startsWith("**") ? (
                    <span
                        key={i}
                        className="v2-mark font-medium text-[var(--ink)]"
                        data-drawn={inView ? "" : undefined}
                        style={{ transitionDelay: `${0.2 + i * 0.12}s` }}
                    >
                        {part.slice(2, -2)}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </p>
    );
}
