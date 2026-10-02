'use client';

import { forwardRef, useEffect, useRef, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { isMotionValue, useMotionValue, type MotionValue } from "framer-motion";
import { fell, fellSC } from "@/components/v2/theatre-fonts";

// The pieces the theatre's navigation is made of: a playbill card (a dark
// panel with a double brass rule and little diamonds at its corners), the big
// lit button and the plain one, and the type. Everything here sits over a
// busy, dark red 3D scene, so every bit of text has a solid backing.

/** Where things may go on a phone: under the site's header, and clear of its dock (fixed bottom-4, 56 px tall). */
export const SAFE = { top: 76, bottom: 96 };

export const ink = {
    eyebrow: `${fellSC.className} text-[14px] leading-tight tracking-[0.2em] text-[#ff9a72] [text-shadow:0_0_12px_rgba(255,90,40,0.35)]`,
    title: `${fell.className} text-[19px] leading-snug text-[#f4e6d2]`,
    body: `${fell.className} text-[16px] leading-relaxed text-[#e2d2bd]`,
    hint: `${fell.className} text-[16px] italic leading-snug text-[#d4c0a8]`,
};

export const focusRing =
    "outline-none focus-visible:ring-2 focus-visible:ring-[#ffb36b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0807]";

/** A playbill: dark card, brass rule, an inner hairline, a diamond at each corner. */
export function Playbill({ children, className = "", corners = true }: { children: ReactNode; className?: string; corners?: boolean }) {
    return (
        <div
            className={`relative rounded-[7px] border border-[#8f7142]/75 bg-[#0e0807]/[0.93] shadow-[0_18px_50px_rgba(0,0,0,0.7),0_0_44px_rgba(255,90,40,0.07),inset_0_0_0_3px_rgba(14,8,7,0.93),inset_0_0_0_4px_rgba(160,124,72,0.3)] backdrop-blur-md ${className}`}
        >
            {corners && (
                <>
                    <Diamond className="-left-[4px] -top-[4px]" />
                    <Diamond className="-right-[4px] -top-[4px]" />
                    <Diamond className="-bottom-[4px] -left-[4px]" />
                    <Diamond className="-bottom-[4px] -right-[4px]" />
                </>
            )}
            {children}
        </div>
    );
}

function Diamond({ className }: { className: string }) {
    return <span aria-hidden className={`pointer-events-none absolute h-[8px] w-[8px] rotate-45 border border-[#b08a50] bg-[#1a0f0a] ${className}`} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; trailing?: ReactNode };

/** The one thing to do: lit, velvet, brass-edged. At least 54 px tall. */
export const LitButton = forwardRef<HTMLButtonElement, ButtonProps>(function LitButton({ icon, trailing, children, className = "", ...rest }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            {...rest}
            className={`${fellSC.className} group relative inline-flex min-h-[56px] items-center justify-center gap-3 rounded-[6px] border border-[#c09a5f] bg-[linear-gradient(180deg,#61200f_0%,#43130b_52%,#2c0b07_100%)] px-6 text-[19px] leading-none tracking-[0.1em] text-[#fff1de] shadow-[inset_0_1px_0_rgba(255,205,150,0.22),inset_0_-1px_0_rgba(0,0,0,0.5),0_6px_18px_rgba(0,0,0,0.55),0_0_18px_rgba(255,100,50,0.16)] transition-[box-shadow,filter,transform] duration-200 [text-shadow:0_1px_0_rgba(0,0,0,0.6)] hover:shadow-[inset_0_1px_0_rgba(255,205,150,0.3),inset_0_-1px_0_rgba(0,0,0,0.5),0_6px_18px_rgba(0,0,0,0.55),0_0_30px_rgba(255,110,60,0.42)] hover:brightness-[1.18] active:translate-y-px disabled:cursor-default disabled:opacity-60 [touch-action:manipulation] ${focusRing} ${className}`}
        >
            {icon && <span className="grid h-5 w-5 shrink-0 place-items-center text-[#ffcf9e] [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
            <span className="pt-[2px]">{children}</span>
            {trailing && <span className="grid h-5 w-5 shrink-0 place-items-center text-[#ffcf9e] [&>svg]:h-5 [&>svg]:w-5">{trailing}</span>}
        </button>
    );
});

/** Everything else you might do: dark, brass hairline. At least 46 px tall. (Also for links that look like buttons.) */
export const plainClass = `${fellSC.className} inline-flex min-h-[46px] items-center justify-center gap-2.5 rounded-[6px] border border-[#8f7142]/80 bg-[#1b100c]/90 px-5 text-[17px] leading-none tracking-[0.08em] text-[#efe0cb] transition-colors duration-200 hover:border-[#c09a5f] hover:bg-[#2a1610] hover:text-[#fff1de] active:translate-y-px [touch-action:manipulation] ${focusRing}`;

export function PlainIcon({ children }: { children: ReactNode }) {
    return <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-[#d9b98c] [&>svg]:h-[18px] [&>svg]:w-[18px]">{children}</span>;
}

export const PlainButton = forwardRef<HTMLButtonElement, ButtonProps>(function PlainButton({ icon, trailing, children, className = "", ...rest }, ref) {
    return (
        <button ref={ref} type="button" {...rest} className={`${plainClass} ${className}`}>
            {icon && <PlainIcon>{icon}</PlainIcon>}
            <span className="pt-[2px]">{children}</span>
            {trailing && <PlainIcon>{trailing}</PlainIcon>}
        </button>
    );
});

/** How far along the corridor you are, 0..1: a number, a framer MotionValue, or a ref the page writes on scroll (read every frame, so scrolling never re-renders). */
export type ProgressSource = number | MotionValue<number> | { readonly current: number };

/** Any ProgressSource as a MotionValue. */
export function useProgressValue(src: ProgressSource): MotionValue<number> {
    const own = useMotionValue(typeof src === "number" ? src : 0);
    const isNumber = typeof src === "number";
    const isMV = !isNumber && isMotionValue(src);
    useEffect(() => {
        if (typeof src === "number") own.set(src);
    }, [src, own]);
    useEffect(() => {
        if (isNumber || isMV) return;
        const ref = src as { readonly current: number };
        let raf = 0;
        const tick = () => {
            if (own.get() !== ref.current) own.set(ref.current);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [src, own, isNumber, isMV]);
    return isMV ? (src as MotionValue<number>) : own;
}

/** Map progress (0..1) onto a rail whose stops are evenly spaced but sit at `ats` along the walk: 0 at the first stop, 1 at the last. */
export function railFraction(p: number, ats: number[]) {
    const n = ats.length;
    if (n < 2) return 0;
    if (p <= ats[0]) return 0;
    if (p >= ats[n - 1]) return 1;
    for (let k = 0; k < n - 1; k++) {
        const a = ats[k];
        const b = ats[k + 1];
        if (p <= b) return (k + (b > a ? (p - a) / (b - a) : 0)) / (n - 1);
    }
    return 1;
}

// ── Dialogs ──────────────────────────────────────────────────────────────────
// The theatre's dialogs (the mirror's question, the programme) register here
// while they're open. Whatever else would share the foot of the screen (the
// action bar) steps aside while any is open, so two
// things can never be drawn in the same place at once.

const openDialogs = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

/** Is any theatre dialog open (or the one named: "mirror", "about")? */
export function useTheatreDialogOpen(id?: string) {
    return useSyncExternalStore(
        subscribe,
        () => (id ? openDialogs.has(id) : openDialogs.size > 0),
        () => false,
    );
}

/**
 * A modal dialog's housekeeping: registers it as open, focuses `first` (or the
 * first button) when it opens, keeps Tab inside `box`, closes on Esc, stops
 * the page behind from scrolling (which would walk you down the corridor;
 * only an element marked data-scroll inside it scrolls), and gives focus back
 * to whatever had it before.
 */
export function useModal(id: string, open: boolean, box: RefObject<HTMLElement | null>, onClose: () => void, first?: RefObject<HTMLElement | null>) {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        if (!open) return;
        openDialogs.add(id);
        emit();
        const before = document.activeElement as HTMLElement | null;
        const focusFirst = window.setTimeout(() => {
            (first?.current ?? box.current?.querySelector<HTMLElement>("button, a[href], [tabindex='0']"))?.focus({ preventScroll: true });
        }, 40);
        const scroller = () => box.current?.querySelector<HTMLElement>("[data-scroll]") ?? null;
        const inScroller = (t: EventTarget | null) => t instanceof Node && !!scroller()?.contains(t);
        const wheel = (e: WheelEvent) => {
            if (!inScroller(e.target)) e.preventDefault();
        };
        const touch = (e: TouchEvent) => {
            if (!inScroller(e.target)) e.preventDefault();
        };
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close.current();
                return;
            }
            if (e.key === "Tab" && box.current) {
                const all = Array.from(box.current.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]:not([tabindex='-1'])")).filter((el) => el.offsetParent !== null);
                if (!all.length) return;
                const a = all[0];
                const z = all[all.length - 1];
                const inside = box.current.contains(document.activeElement);
                if (e.shiftKey && (document.activeElement === a || !inside)) {
                    e.preventDefault();
                    z.focus();
                } else if (!e.shiftKey && (document.activeElement === z || !inside)) {
                    e.preventDefault();
                    a.focus();
                }
                return;
            }
            const scrolls = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key);
            const space = e.key === " " && !(e.target as HTMLElement | null)?.closest?.("button, a, input, textarea, select");
            if ((scrolls || space) && !inScroller(e.target)) e.preventDefault();
        };
        window.addEventListener("wheel", wheel, { passive: false });
        window.addEventListener("touchmove", touch, { passive: false });
        window.addEventListener("keydown", key, true);
        return () => {
            window.clearTimeout(focusFirst);
            window.removeEventListener("wheel", wheel);
            window.removeEventListener("touchmove", touch);
            window.removeEventListener("keydown", key, true);
            openDialogs.delete(id);
            emit();
            if (before?.isConnected && typeof before.focus === "function") before.focus({ preventScroll: true });
        };
        // `first` and `box` are refs
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, open]);
}
