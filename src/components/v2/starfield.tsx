'use client';

import { useEffect, useRef } from "react";

// Three depths of stars that twinkle, drift with the pointer and the scroll
// (nearer stars move more), plus the odd shooting star. Fills its parent.
export function Starfield({ className, density = 1 }: { className?: string; density?: number }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        type Star = { x: number; y: number; r: number; depth: number; phase: number; speed: number; hue: number };
        let stars: Star[] = [];
        let w = 0;
        let h = 0;
        let raf = 0;
        const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
        let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = canvas.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(((w * h) / 2600) * density);
            stars = Array.from({ length: count }, () => {
                const depth = Math.random() < 0.7 ? 0.2 : Math.random() < 0.8 ? 0.5 : 1;
                return {
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.3 + depth * Math.random() * 1.3,
                    depth,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.5 + Math.random() * 1.5,
                    hue: Math.random() < 0.15 ? 30 : Math.random() < 0.3 ? 220 : 0, // a few warm, a few blue
                };
            });
        };

        const onMove = (e: PointerEvent) => {
            pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
            pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        };

        const draw = (t: number) => {
            pointer.x += (pointer.tx - pointer.x) * 0.04;
            pointer.y += (pointer.ty - pointer.y) * 0.04;
            const scroll = window.scrollY;
            ctx.clearRect(0, 0, w, h);

            for (const s of stars) {
                const px = s.x - pointer.x * 14 * s.depth;
                const py = (((s.y - pointer.y * 10 * s.depth - scroll * 0.12 * s.depth) % h) + h) % h;
                const twinkle = reduce ? 1 : 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
                ctx.globalAlpha = Math.min(1, (0.35 + s.depth * 0.65) * twinkle);
                ctx.fillStyle = s.hue ? `hsl(${s.hue}, 80%, 88%)` : "#ffffff";
                ctx.beginPath();
                ctx.arc(px, py, s.r, 0, Math.PI * 2);
                ctx.fill();
            }

            if (!reduce) {
                if (!shooting && Math.random() < 0.004) {
                    shooting = { x: Math.random() * w * 0.8, y: Math.random() * h * 0.4, vx: 7 + Math.random() * 4, vy: 3 + Math.random() * 2, life: 1 };
                }
                if (shooting) {
                    const s = shooting;
                    const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
                    grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
                    grad.addColorStop(1, "rgba(255,255,255,0)");
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12);
                    ctx.stroke();
                    s.x += s.vx;
                    s.y += s.vy;
                    s.life -= 0.018;
                    if (s.life <= 0) shooting = null;
                }
            }
            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(draw);
        };

        resize();
        raf = requestAnimationFrame(draw);
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", onMove);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", onMove);
        };
    }, [density]);

    return <canvas ref={ref} aria-hidden className={className} />;
}
