'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { pageLens } from "@/components/v2/nav";
import type { Lens } from "@/data/v2/profile";

const STORAGE_KEY = "kg-lens";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const LensContext = createContext<{ lens: Lens; setLens: (l: Lens) => void; ready: boolean }>({
    lens: "work",
    setLens: () => {},
    ready: false,
});

// The lens is the "who is this page for" switch: work (professional) or life (personal).
// `?lens=work` in the URL wins, so a shareable recruiter link always lands on the work side.
export function LensProvider({ children }: { children: React.ReactNode }) {
    const [lens, setLensState] = useState<Lens>("work");
    const [ready, setReady] = useState(false);
    const pathname = usePathname();

    // Priority on first load: the page's own side, then ?lens=, then the saved choice.
    useIsoLayoutEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get("lens");
        let initial: string | null = pageLens(pathname) ?? fromUrl;
        if (initial !== "work" && initial !== "life") {
            try {
                initial = localStorage.getItem(STORAGE_KEY);
            } catch {}
        }
        if (initial === "work" || initial === "life") setLensState(initial);
        setReady(true);
        // first load only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setLens = useCallback((next: Lens) => {
        setLensState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {}
    }, []);

    return <LensContext.Provider value={{ lens, setLens, ready }}>{children}</LensContext.Provider>;
}

export const useLens = () => useContext(LensContext);

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

// Switches lens with a circular reveal that grows out of `origin`, using the
// View Transitions API. Browsers without it (or with reduced motion) just swap.
export function useSwitchLens() {
    const { setLens } = useLens();

    return useCallback(
        (next: Lens, origin?: HTMLElement | null, then?: () => void) => {
            const doc = document as ViewTransitionDocument;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (!doc.startViewTransition || reduce || !origin) {
                setLens(next);
                then?.();
                return;
            }
            // Percentages rather than px, so the circle lands on the toggle even when the
            // snapshot is rendered at a different pixel scale than the page.
            const rect = origin.getBoundingClientRect();
            const w = innerWidth;
            const h = innerHeight;
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
            const radius = (reach / (Math.hypot(w, h) / Math.SQRT2)) * 100;
            const at = `at ${(x / w) * 100}% ${(y / h) * 100}%`;

            const transition = doc.startViewTransition(() => {
                flushSync(() => setLens(next));
                then?.();
            });
            transition.ready.then(() => {
                document.documentElement.animate(
                    { clipPath: [`circle(0% ${at})`, `circle(${radius}% ${at})`] },
                    { duration: 750, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
                );
            });
        },
        [setLens],
    );
}

const options: { id: Lens; label: string }[] = [
    { id: "work", label: "Work" },
    { id: "life", label: "Life" },
];

export function LensToggle({ onSwitch }: { onSwitch?: (next: Lens, origin: HTMLElement | null) => void }) {
    const { lens } = useLens();
    const switchLens = useSwitchLens();
    const refs = useRef<Record<Lens, HTMLButtonElement | null>>({ work: null, life: null });

    return (
        <div role="radiogroup" aria-label="View this site as" className="relative inline-flex rounded-full bg-[var(--faint)] p-[3px] text-[13px]">
            {options.map((o) => (
                <button
                    key={o.id}
                    ref={(el) => {
                        refs.current[o.id] = el;
                    }}
                    role="radio"
                    aria-checked={lens === o.id}
                    onClick={() => {
                        if (lens === o.id) return;
                        if (onSwitch) onSwitch(o.id, refs.current[o.id]);
                        else switchLens(o.id, refs.current[o.id]);
                    }}
                    className={`relative rounded-full px-3 py-1 font-medium transition-colors duration-300 ${
                        lens === o.id ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                >
                    {lens === o.id && (
                        <motion.span
                            layoutId="lens-pill"
                            className="absolute inset-0 rounded-full bg-[var(--card)] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                    )}
                    <span className="relative">{o.label}</span>
                </button>
            ))}
        </div>
    );
}
