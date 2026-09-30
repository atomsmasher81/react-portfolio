'use client';

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, X } from "lucide-react";
import { track } from "@/lib/analytics";

// "Book a call" opens the cal.com scheduler in a sheet on top of the page, so
// booking doesn't mean leaving the site. `variant` picks a quiet pill (hero)
// or the solid primary button (Say hello).
export function BookCall({ url, variant = "quiet", label = "Book a call" }: { url: string; variant?: "quiet" | "solid"; label?: string }) {
    const [open, setOpen] = useState(false);

    const styles =
        variant === "solid"
            ? "h-10 bg-[var(--ink)] px-4 text-sm font-medium text-[var(--bg)] hover:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)]"
            : "h-9 px-3 text-[var(--muted)] hover:bg-[var(--faint)] hover:text-[var(--ink)]";

    return (
        <>
            <button
                onClick={() => {
                    track("book_call_open", { label, variant }, { key: true });
                    setOpen(true);
                }}
                className={`group inline-flex items-center gap-2 rounded-full transition-all duration-300 active:scale-95 ${styles}`}
            >
                <CalendarDays className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12" strokeWidth={1.75} />
                {label}
            </button>
            <AnimatePresence>{open && <CalendarSheet url={url} onClose={() => setOpen(false)} />}</AnimatePresence>
        </>
    );
}

// cal.com switches layout by its own width: a stacked column below ~1000px, a
// three-pane view (details, month, time slots) above. The sheet is sized to one
// or the other, never the awkward width in between that leaves empty space.
function CalendarSheet({ url, onClose }: { url: string; onClose: () => void }) {
    const [loaded, setLoaded] = useState(false);

    // How long the scheduler stayed open: a few seconds is a glance, minutes is picking a slot.
    useEffect(() => {
        const opened = Date.now();
        return () => track("book_call_close", { seconds_open: Math.round((Date.now() - opened) / 1000) });
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
                className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            />
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Book a call"
                className="relative flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--card)] shadow-2xl sm:h-[min(84dvh,760px)] sm:max-w-[520px] sm:rounded-2xl xl:max-w-[1100px]"
                initial={{ y: "100%", opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0.6 }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
            >
                <div className="flex items-center justify-between border-b border-[var(--faint)] px-5 py-3">
                    <div>
                        <p className="font-medium">Book a 15-minute call</p>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]">
                            Open in cal.com <ArrowUpRight className="h-3 w-3" />
                        </a>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-full p-2 text-[var(--muted)] hover:bg-[var(--faint)]">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="relative flex-1">
                    {!loaded && (
                        <div className="absolute inset-0 grid place-items-center text-sm text-[var(--muted)]">
                            <span className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 animate-pulse" /> Loading calendar…
                            </span>
                        </div>
                    )}
                    <iframe
                        src={url}
                        title="Book a call with Kartik"
                        onLoad={() => setLoaded(true)}
                        className={`h-full w-full transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                    />
                </div>
            </motion.div>
        </div>
    );
}
