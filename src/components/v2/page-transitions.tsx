'use client';

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Themed page changes inside the life side, so moving around still feels like
// one place rather than a new site:
//  - into Photos, a hexagonal aperture opens from the link you clicked;
//    out of it, the aperture closes toward the link you clicked.
//  - into Sky, night falls from the top; out of it, dawn rises from the bottom.
//    A link marked data-vt-origin ("Come look up") spreads the night out from itself,
//    and from the phone dock the night rises from the bottom, where the thumb is.
//
// How: on click, the current page is copied into a still overlay (canvases
// included), the real navigation happens underneath, and only once the new page
// has rendered does a growing hole open in the overlay to reveal it. The old
// page stays on screen until the new one is ready, so there's never a blank frame.

type Kind = "shutter-open" | "shutter-close" | "nightfall" | "nightrise" | "night-from" | "dawn" | "theatre";

const inside = (path: string, section: string) => path === section || path.startsWith(section + "/");

function pick(from: string, to: string): Kind | null {
    // The hidden theatre: the lights fail, then a doorway opens out of the dark.
    if (inside(to, "/magic-theatre")) return "theatre";
    if (inside(from, "/magic-theatre")) return inside(to, "/sky") ? null : "dawn";
    if (inside(to, "/sky") && !inside(from, "/sky")) return "nightfall";
    if (inside(to, "/photos") && !inside(from, "/photos")) return "shutter-open";
    if (inside(from, "/sky") && !inside(to, "/sky")) return "dawn";
    if (inside(from, "/photos") && !inside(to, "/photos")) return "shutter-close";
    return null;
}

const DURATION: Record<Kind, number> = {
    "shutter-open": 850,
    "shutter-close": 850,
    nightfall: 1100,
    nightrise: 1100,
    "night-from": 1200,
    dawn: 1100,
    theatre: 2100,
};

// The theatre entrance darkens the old page with a black layer (not a filter,
// which would dim the glow too) and draws a warm rim round the doorway.
function theatreLayers(frame: HTMLElement) {
    let dim = frame.querySelector<HTMLElement>("[data-dim]");
    let rim = frame.querySelector<SVGPathElement>("[data-rim]");
    if (!dim || !rim) {
        dim = document.createElement("div");
        dim.dataset.dim = "";
        Object.assign(dim.style, { position: "absolute", inset: "0", background: "#000", opacity: "0" });
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" });
        rim = document.createElementNS("http://www.w3.org/2000/svg", "path");
        rim.dataset.rim = "";
        rim.setAttribute("fill", "none");
        rim.setAttribute("stroke", "#ffab72");
        rim.setAttribute("stroke-width", "10");
        Object.assign(rim.style, { filter: "blur(7px)", opacity: "0" });
        svg.appendChild(rim);
        frame.append(dim, svg);
    }
    return { dim, rim };
}

// How the lights die before the theatre opens: bright, gone, back, gone…
const STUTTER = [1, 0.25, 0.95, 0.12, 0.75, 0.06, 0.5, 0.04, 0.2, 0.035];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reachFrom = (x: number, y: number) => Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

function hexagon(cx: number, cy: number, r: number, turn: number) {
    return Array.from({ length: 6 }, (_, i) => {
        const a = turn + (i * Math.PI) / 3;
        return `${cx + Math.cos(a) * r}px ${cy + Math.sin(a) * r}px`;
    }).join(", ");
}

// While a transition runs, the phone dock is lifted above the overlay (see
// v2.css) so it isn't frozen in the copy: the page does its effect behind it
// while the dock's highlight slides straight to the new button.
const dockAbove = (on: boolean) => {
    if (on) document.documentElement.dataset.vt = "";
    else delete document.documentElement.dataset.vt;
};

// A still copy of the page as it looks right now, pinned to the viewport.
function snapshot(): HTMLElement | null {
    const page = document.querySelector<HTMLElement>(".v2");
    if (!page) return null;
    const frame = document.createElement("div");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", inset: "0", zIndex: "90", overflow: "hidden", pointerEvents: "none" });

    const copy = page.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-dock]").forEach((n) => n.remove());
    // IDs are left as-is: SVG gradients (the moon) reference them, and the copy only lives ~1s.
    Object.assign(copy.style, { position: "absolute", left: "0", top: `${-window.scrollY}px`, width: `${page.offsetWidth}px` });
    // The sticky header would otherwise sit at the top of the copied document, off screen.
    const header = copy.querySelector<HTMLElement>("header");
    // Keep it in the layout (so nothing shifts) and just nudge it down into view.
    if (header) Object.assign(header.style, { position: "relative", top: `${window.scrollY}px` });
    // Canvases (stars, the pulsar) clone blank; paint their current frame across.
    const from = page.querySelectorAll("canvas");
    copy.querySelectorAll("canvas").forEach((c, i) => {
        const src = from[i];
        if (!src) return;
        c.width = src.width;
        c.height = src.height;
        c.getContext("2d")?.drawImage(src, 0, 0);
    });

    frame.appendChild(copy);
    // Inside .v2, not <body>: .v2 is its own stacking context (isolation), so only
    // an overlay in there can sit *below* the live phone dock.
    page.appendChild(frame);
    return frame;
}

// Opens a hole in the overlay, frame by frame, then removes it.
function reveal(frame: HTMLElement, kind: Kind, x: number, y: number) {
    const duration = DURATION[kind];
    const start = performance.now();
    const w = innerWidth;
    const h = innerHeight;
    const radial = reachFrom(x, y) + 240;
    const hexReach = reachFrom(x, y) / 0.866 + 20; // a hexagon only covers 0.866× its corner radius

    const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const k = easeInOut(t);
        const s = frame.style as CSSStyleDeclaration & { webkitMaskImage: string };
        if (kind === "night-from") {
            const r = radial * k;
            s.maskImage = s.webkitMaskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${r - 220}px, #000 ${r}px)`;
        } else if (kind === "nightfall" || kind === "nightrise" || kind === "dawn") {
            // A soft edge 30% of the screen tall sweeping down (nightfall) or up (nightrise, dawn).
            const down = kind === "nightfall";
            // Either way the edge travels 1.3 screens, starting just off one end and
            // finishing just off the other, so nothing of the old page is left to pop.
            const edge = down ? -0.3 * h + k * 1.3 * h : h - k * 1.3 * h;
            const [a, b] = down ? ["transparent", "#000"] : ["#000", "transparent"];
            s.maskImage = s.webkitMaskImage = `linear-gradient(to bottom, ${a} ${edge}px, ${b} ${edge + 0.3 * h}px)`;
        } else if (kind === "theatre") {
            // First the lights fail: the old page stutters like a dying bulb and
            // goes dark. Then an arched doorway opens out of the dark from the
            // sign, warm light spilling round its edge.
            const { dim, rim } = theatreLayers(frame);
            if (t < 0.3) {
                dim.style.opacity = String(1 - STUTTER[Math.floor((t / 0.3) * STUTTER.length)]);
            } else {
                const p = easeInOut((t - 0.3) / 0.7);
                dim.style.opacity = "0.965";
                const d = Math.hypot(w, h) * 2.4 * p; // doorway width
                const l = x - d / 2;
                const r = x + d / 2;
                const spring = y - 0.6 * d; // where the arch starts
                const door = `M${l.toFixed(1)} ${(y + 0.6 * d).toFixed(1)} L${l.toFixed(1)} ${spring.toFixed(1)} A${(d / 2).toFixed(1)} ${(d / 2).toFixed(1)} 0 0 1 ${r.toFixed(1)} ${spring.toFixed(1)} L${r.toFixed(1)} ${(y + 0.6 * d).toFixed(1)} Z`;
                s.clipPath = `path(evenodd, "M0 0 H${w} V${h} H0 Z ${door}")`;
                rim.setAttribute("d", door);
                rim.style.opacity = String(Math.min(1, p * 6) * (1 - p * 0.6));
            }
        } else if (kind === "shutter-open") {
            // Everything except a growing, turning hexagon: the screen and the hexagon as two
            // separate sub-paths, so even-odd filling cuts a clean hole with no seam.
            const r = hexReach * k;
            const turn = (Math.PI / 3) * k;
            const hex = Array.from({ length: 6 }, (_, i) => {
                const a = turn + (i * Math.PI) / 3;
                return `${i ? "L" : "M"}${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
            }).join(" ");
            s.clipPath = `path(evenodd, "M0 0 H${w} V${h} H0 Z ${hex} Z")`;
        } else {
            // Only a shrinking, turning hexagon of the old page remains.
            s.clipPath = `polygon(${hexagon(x, y, hexReach * (1 - k), (Math.PI / 3) * (1 - k))})`;
        }
        if (t < 1) requestAnimationFrame(step);
        else {
            frame.remove();
            dockAbove(false);
        }
    };
    requestAnimationFrame(step);
}

export function PageTransitions() {
    const router = useRouter();
    const pathname = usePathname();
    const pending = useRef<(() => void) | null>(null);

    // The new page has committed; wait two frames so it has painted, then reveal.
    useEffect(() => {
        const go = pending.current;
        pending.current = null;
        if (go) requestAnimationFrame(() => requestAnimationFrame(go));
    }, [pathname]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = (e.target as HTMLElement | null)?.closest("a");
            if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.dragging) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin) return;
            let kind = pick(location.pathname, url.pathname);
            if (!kind || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            if (kind === "nightfall" && a.hasAttribute("data-vt-origin")) kind = "night-from";
            else if (kind === "nightfall" && a.closest("[data-dock]")) kind = "nightrise";

            e.preventDefault(); // Next's <Link> skips its own navigation when this is set
            const rect = a.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const frame = snapshot();
            if (frame) dockAbove(true);
            if (!frame) {
                router.push(url.pathname + url.search + url.hash);
                return;
            }

            let started = false;
            const begin = () => {
                if (started) return;
                started = true;
                reveal(frame, kind!, x, y);
            };
            pending.current = begin;
            setTimeout(begin, 4000); // never leave the overlay up if a route is slow
            router.push(url.pathname + url.search + url.hash);
        };

        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [router]);

    return null;
}
