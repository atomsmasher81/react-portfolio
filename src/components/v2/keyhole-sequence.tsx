'use client';

import { useEffect, useRef } from "react";
import { moment, type Timeline } from "@/components/v2/theatre3d/keyhole-timeline";

// The page's side of going through the keyhole: the dark closing in round
// the keyhole (and, without 3D, the black at the end), on the same clock as
// the 3D keyhole (keyhole-timeline.ts). The page stays still meanwhile. The dark sits under
// the keyhole (z-84 under z-85) so the keyhole and its light stay above it.

type Props = {
    startedAt: number;
    timeline: Timeline;
    /** The keyhole's box on the page (120 × 200). */
    anchor: HTMLElement;
    onDone: () => void;
};

const KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

export function KeyholeSequence({ startedAt, timeline: tl, anchor, onDone }: Props) {
    const dark = useRef<HTMLDivElement>(null);
    const black = useRef<HTMLDivElement>(null);
    const done = useRef(onDone);
    done.current = onDone;

    useEffect(() => {
        let raf = 0;
        let finished = false;
        const tick = (now: number) => {
            const t = now - startedAt;
            const m = moment(t, tl);
            if (dark.current) {
                // darkest at the edges, a little lighter round the keyhole
                const r = anchor.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const y = r.top + r.height * 0.35;
                dark.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(4,5,10,${(m.page * 0.6).toFixed(3)}) 0, rgba(4,5,10,${m.page.toFixed(3)}) 70vmax)`;
            }
            if (black.current) black.current.style.opacity = String(m.fade);
            // hand over to the theatre (it comes in over the end of the dive)
            if (t >= tl.handoff && !finished) {
                finished = true;
                done.current();
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        // hold the page still while you go through
        const stop = (e: Event) => e.preventDefault();
        const stopKeys = (e: KeyboardEvent) => KEYS.has(e.key) && e.preventDefault();
        window.addEventListener("wheel", stop, { passive: false });
        window.addEventListener("touchmove", stop, { passive: false });
        window.addEventListener("keydown", stopKeys);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("wheel", stop);
            window.removeEventListener("touchmove", stop);
            window.removeEventListener("keydown", stopKeys);
        };
    }, [startedAt, tl, anchor]);

    return (
        <>
            <div ref={dark} aria-hidden className="pointer-events-none fixed inset-0 z-[84]" />
            <div ref={black} aria-hidden className="pointer-events-none fixed inset-0 z-[95] bg-[#030203]" style={{ opacity: 0 }} />
        </>
    );
}
